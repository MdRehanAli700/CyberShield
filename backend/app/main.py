import csv
from base64 import b32decode, b32encode, urlsafe_b64encode
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
from io import StringIO
import os
import re
import secrets
import smtplib
import struct
import time
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import parse_qs, quote, urlencode, urlsplit
from urllib.request import Request, urlopen

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from cryptography.fernet import Fernet, InvalidToken
try:
    from authlib.integrations.starlette_client import OAuth
except ImportError:
    OAuth = None
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.middleware.sessions import SessionMiddleware

from . import models
from .database import get_db
from .ocr import ImageTooLargeError, MAX_IMAGE_BYTES, OcrTimeoutError, OcrUnavailableError, UnreadableImageError, image_to_text
from .risk import assess_payment, recommended_action
from .rate_limit import check_auth_rate_limit
from .schemas import AuthCredentials, AuthRead, CheckCreate, CheckRead, EmailVerificationComplete, MFALoginChallengeComplete, OAuthHandoffExchange, PasswordChange, PasswordResetComplete, PasswordResetRequest, PasswordVerify, PayeeCreate, PayeeRead, PreferencesUpdate, ProfileUpdate, TOTPDisable, TOTPEnable, UserRead


app = FastAPI(title="CyberShield VerifyPay API", version="0.2.0")
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("OAUTH_SESSION_SECRET") or secrets.token_urlsafe(48),
    same_site="lax",
    https_only=os.getenv("OAUTH_COOKIE_SECURE", "false").strip().lower() == "true",
)
default_cors_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
cors_origins = [origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", default_cors_origins).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_auth_requests(request, call_next):
    if request.method == "POST":
        client_host = request.client.host if request.client else "unknown"
        retry_after = check_auth_rate_limit(request.url.path, client_host)
        if retry_after is not None:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Wait before trying again."},
                headers={"Retry-After": str(retry_after), "Cache-Control": "no-store"},
            )
    return await call_next(request)


@app.middleware("http")
async def trace_password_reset_request(request, call_next):
    is_reset_request = request.method == "POST" and request.url.path == "/api/auth/password-reset"
    is_health_request = request.method == "GET" and request.url.path == "/health"
    if not is_reset_request and not is_health_request:
        return await call_next(request)
    trace_label = "health check" if is_health_request else "password reset"
    print(f"[VerifyPay] {trace_label} request reached this backend.", flush=True)
    try:
        response = await call_next(request)
    except Exception as exc:
        print(f"[VerifyPay] {trace_label} request failed before response ({type(exc).__name__}).", flush=True)
        raise
    print(f"[VerifyPay] {trace_label} response: {response.status_code}.", flush=True)
    return response

auth_scheme = HTTPBearer(auto_error=False)
oauth = OAuth() if OAuth else None
registered_oauth_providers: set[str] = set()


class OAuthAccountConflict(Exception):
    """Raised when a provider email belongs to an existing password account."""


class OAuthIdentityConflict(Exception):
    """Raised when a provider identity is already attached to another account."""


class OAuthLinkEmailMismatch(Exception):
    """Raised when a provider email does not match the signed-in account."""


def oauth_client(provider: str):
    if oauth is None:
        raise HTTPException(status_code=503, detail="Provider sign-in dependencies are not installed yet.")
    if provider == "google":
        client_id, client_secret = os.getenv("GOOGLE_CLIENT_ID", "").strip(), os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
        metadata_url = "https://accounts.google.com/.well-known/openid-configuration"
    elif provider == "microsoft":
        client_id, client_secret = os.getenv("MICROSOFT_CLIENT_ID", "").strip(), os.getenv("MICROSOFT_CLIENT_SECRET", "").strip()
        tenant = os.getenv("MICROSOFT_TENANT_ID", "").strip()
        if tenant.casefold() in {"common", "organizations", "consumers"} or not re.fullmatch(r"[A-Za-z0-9.-]{1,128}", tenant):
            raise HTTPException(status_code=503, detail="Microsoft sign-in requires a specific tenant ID or tenant domain.")
        metadata_url = f"https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration"
    else:
        raise HTTPException(status_code=404, detail="Sign-in provider not found.")
    if not client_id or not client_secret or not os.getenv("OAUTH_SESSION_SECRET", "").strip():
        raise HTTPException(status_code=503, detail=f"{provider.title()} sign-in is not configured yet.")
    if provider not in registered_oauth_providers:
        oauth.register(
            name=provider,
            client_id=client_id,
            client_secret=client_secret,
            server_metadata_url=metadata_url,
            client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
        )
        registered_oauth_providers.add(provider)
    return oauth.create_client(provider)


def oauth_frontend_url() -> str:
    value = (os.getenv("FRONTEND_URL") or "http://localhost:5173").strip().rstrip("/")
    parsed = urlsplit(value)
    local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
    if parsed.scheme != "https" and not local_http:
        raise HTTPException(status_code=500, detail="FRONTEND_URL must use HTTPS outside local development.")
    return value


def oauth_api_url(request) -> str:
    value = (os.getenv("OAUTH_API_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or str(request.base_url)).strip().rstrip("/")
    return value


def password_digest(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def password_matches(password: str, stored: str) -> bool:
    try:
        algorithm, salt_hex, expected_hex = stored.split("$", 2)
        if algorithm != "scrypt":
            return False
        actual = password_digest(password, bytes.fromhex(salt_hex)).split("$", 2)[2]
        return hmac.compare_digest(actual, expected_hex)
    except (ValueError, TypeError):
        return False


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def totp_encryption_material() -> bytes:
    value = (os.getenv("TOTP_ENCRYPTION_KEY") or os.getenv("OAUTH_SESSION_SECRET") or "").strip()
    if len(value) < 32:
        raise HTTPException(
            status_code=503,
            detail="Two-factor setup needs a stable TOTP_ENCRYPTION_KEY or OAUTH_SESSION_SECRET of at least 32 characters.",
        )
    return value.encode("utf-8")


def totp_cipher() -> Fernet:
    key = hashlib.sha256(b"verifypay-totp-encryption-v1\0" + totp_encryption_material()).digest()
    return Fernet(urlsafe_b64encode(key))


def encrypt_totp_secret(secret: str) -> str:
    return totp_cipher().encrypt(secret.encode("ascii")).decode("ascii")


def decrypt_totp_secret(encrypted: str) -> str:
    try:
        return totp_cipher().decrypt(encrypted.encode("ascii")).decode("ascii")
    except (InvalidToken, UnicodeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="The authenticator secret cannot be read. Check that the backend encryption key has not changed.") from exc


def generate_totp_secret() -> str:
    return b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_value(secret: str, counter: int) -> str:
    key = b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{binary % 1_000_000:06d}"


def matching_totp_step(secret: str, code: str, now: float | None = None, last_used_step: int | None = None) -> int | None:
    if not re.fullmatch(r"\d{6}", code.strip()):
        return None
    current_step = int((time.time() if now is None else now) // 30)
    for step in (current_step, current_step - 1, current_step + 1):
        if step >= 0 and (last_used_step is None or step > last_used_step) and hmac.compare_digest(totp_value(secret, step), code.strip()):
            return step
    return None


def recovery_code_digest(code: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]", "", code).upper()
    return hmac.new(totp_encryption_material(), b"verifypay-recovery-v1\0" + normalized.encode("ascii"), hashlib.sha256).hexdigest()


def verify_user_totp_code(user: models.User, code: str, *, secret: str | None = None, consume: bool = False) -> bool:
    if secret is None and user.totp_secret_encrypted:
        active_secret = decrypt_totp_secret(user.totp_secret_encrypted)
        step = matching_totp_step(active_secret, code, last_used_step=user.totp_last_used_step)
        if step is not None:
            if consume:
                user.totp_last_used_step = step
            return True
    try:
        stored_hashes = json.loads(user.totp_recovery_code_hashes or "[]")
    except (TypeError, json.JSONDecodeError):
        stored_hashes = []
    if not isinstance(stored_hashes, list):
        return False
    candidate = recovery_code_digest(code)
    match_index = next((index for index, digest in enumerate(stored_hashes) if isinstance(digest, str) and hmac.compare_digest(digest, candidate)), None)
    if match_index is None:
        return False
    if consume:
        stored_hashes.pop(match_index)
        user.totp_recovery_code_hashes = json.dumps(stored_hashes)
    return True


def create_mfa_login_challenge(user: models.User, db: Session) -> dict[str, object]:
    now = datetime.now(timezone.utc)
    db.query(models.MFALoginChallenge).filter(
        (models.MFALoginChallenge.user_id == user.id)
        | (models.MFALoginChallenge.expires_at <= now)
    ).delete(synchronize_session=False)
    raw_token = secrets.token_urlsafe(32)
    db.add(models.MFALoginChallenge(
        user_id=user.id,
        token_hash=token_digest(raw_token),
        expires_at=now + timedelta(minutes=5),
    ))
    db.commit()
    return {"mfa_required": True, "challenge_token": raw_token}


def send_transactional_email(recipient: str, subject: str, body: str) -> None:
    sender = os.getenv("SMTP_FROM", "").strip()
    provider = os.getenv("EMAIL_PROVIDER", "smtp").strip().casefold()

    if provider == "brevo":
        api_key = os.getenv("BREVO_API_KEY", "").strip()
        if not api_key or not sender:
            raise RuntimeError("Email delivery is not configured.")
        request = Request(
            "https://api.brevo.com/v3/smtp/email",
            data=json.dumps({
                "sender": {"name": "CyberShield VerifyPay", "email": sender},
                "to": [{"email": recipient}],
                "subject": subject,
                "textContent": body,
            }).encode("utf-8"),
            headers={"accept": "application/json", "api-key": api_key, "content-type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=15):
            pass
        return

    if provider != "smtp":
        raise RuntimeError("EMAIL_PROVIDER must be smtp or brevo.")
    host = os.getenv("SMTP_HOST", "").strip()
    if not host or not sender:
        raise RuntimeError("Email delivery is not configured.")
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as exc:
        raise RuntimeError("SMTP_PORT must be a valid port number.") from exc

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(body)
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15) as server:
            if username:
                server.login(username, password)
            server.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.starttls()
            if username:
                server.login(username, password)
            server.send_message(message)


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    body = (
        "We received a request to reset your VerifyPay password.\n\n"
        f"Open this link within 30 minutes to choose a new password:\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    send_transactional_email(recipient, "Reset your VerifyPay password", body)


def send_email_verification_email(recipient: str, verification_url: str) -> None:
    body = (
        "Welcome to VerifyPay. Confirm your email address to finish setting up your account.\n\n"
        f"Open this link within 30 minutes to verify your email:\n{verification_url}\n\n"
        "If you did not create a VerifyPay account, you can ignore this email."
    )
    send_transactional_email(recipient, "Verify your VerifyPay email", body)


def issue_email_verification(user: models.User, db: Session) -> bool:
    raw_token = secrets.token_urlsafe(32)
    verification_token = models.EmailVerificationToken(
        user_id=user.id,
        token_hash=token_digest(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db.query(models.EmailVerificationToken).filter(models.EmailVerificationToken.user_id == user.id).delete(synchronize_session=False)
    db.add(verification_token)
    db.commit()

    frontend_url = (os.getenv("FRONTEND_URL") or os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:5173").rstrip("/")
    verification_url = f"{frontend_url}/?{urlencode({'verify_email_token': raw_token})}"
    try:
        send_email_verification_email(user.email, verification_url)
    except (OSError, RuntimeError, smtplib.SMTPException) as exc:
        print(f"[VerifyPay] Verification email delivery failed ({type(exc).__name__}).", flush=True)
        db.delete(verification_token)
        db.commit()
        return False
    print("[VerifyPay] Verification email accepted by the configured provider.", flush=True)
    return True


def create_session(user: models.User, db: Session) -> dict:
    token = secrets.token_urlsafe(32)
    session = models.UserSession(
        user_id=user.id,
        token_hash=token_digest(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(session)
    db.commit()
    return {"access_token": token, "token_type": "bearer", "user": UserRead.model_validate(user).model_dump()}


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    session = db.scalar(
        select(models.UserSession).where(
            models.UserSession.token_hash == token_digest(credentials.credentials),
            models.UserSession.expires_at > datetime.now(timezone.utc),
        )
    )
    user = db.get(models.User, session.user_id) if session else None
    if user is None:
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.", headers={"WWW-Authenticate": "Bearer"})
    return user


@app.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="The PostgreSQL database is unavailable.") from exc
    return {"status": "ok", "service": "verifypay-api", "database": "connected"}


@app.get("/api")
def api_home() -> dict[str, str]:
    return {
        "service": "CyberShield VerifyPay API",
        "status": "running",
        "health": "/health",
        "docs": "/docs",
    }


@app.post("/api/auth/register", status_code=202)
def register(payload: AuthCredentials, db: Session = Depends(get_db)):
    email = payload.email.strip().casefold()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if db.scalar(select(models.User).where(models.User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = models.User(email=email, password_hash=password_digest(payload.password), email_verified=False)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc
    db.refresh(user)
    sent = issue_email_verification(user, db)
    return {
        "email_sent": sent,
        "message": "Your account was created. Check your inbox for a verification link." if sent else
        "Your account was created, but the email could not be sent. Use resend to try again.",
    }


@app.post("/api/auth/login")
def login(payload: AuthCredentials, db: Session = Depends(get_db)):
    email = payload.email.strip().casefold()
    user = db.scalar(select(models.User).where(models.User.email == email))
    if user is None or not password_matches(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before signing in.")
    if user.totp_enabled:
        return create_mfa_login_challenge(user, db)
    return create_session(user, db)


@app.get("/api/auth/oauth/{provider}")
async def begin_oauth_sign_in(provider: str, request: Request):
    try:
        client = oauth_client(provider)
    except HTTPException as exc:
        if exc.status_code == 503:
            return RedirectResponse(f"{oauth_frontend_url()}/?oauth_error=provider_not_configured", status_code=303)
        raise
    redirect_uri = f"{oauth_api_url(request)}/api/auth/oauth/{provider}/callback"
    return await client.authorize_redirect(request, redirect_uri)


@app.post("/api/auth/oauth/google/link")
async def begin_google_account_link(
    request: Request,
    current_user: models.User = Depends(get_current_user),
):
    client = oauth_client("google")
    redirect_uri = f"{oauth_api_url(request)}/api/auth/oauth/google/callback"
    authorization = await client.authorize_redirect(request, redirect_uri)
    state = parse_qs(urlsplit(authorization.headers["location"]).query).get("state", [""])[0]
    if not state:
        raise HTTPException(status_code=502, detail="Google could not start account linking. Please try again.")
    request.session["oauth_link"] = {"state": state, "user_id": current_user.id}
    return {"authorization_url": authorization.headers["location"]}


@app.get("/api/auth/linked-identities")
def get_oauth_identities(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    providers = db.scalars(
        select(models.OAuthIdentity.provider).where(models.OAuthIdentity.user_id == current_user.id)
    ).all()
    return {"providers": sorted(set(providers))}


@app.get("/api/auth/oauth/{provider}/callback")
async def complete_oauth_sign_in(provider: str, request: Request, db: Session = Depends(get_db)):
    frontend_url = oauth_frontend_url()
    link_context = request.session.get("oauth_link")
    callback_state = request.query_params.get("state", "")
    link_user_id = None
    if (
        isinstance(link_context, dict)
        and callback_state
        and hmac.compare_digest(str(link_context.get("state", "")), callback_state)
    ):
        link_user_id = link_context.get("user_id")
        request.session.pop("oauth_link", None)
    try:
        client = oauth_client(provider)
        token = await client.authorize_access_token(request)
        profile = token.get("userinfo")
        if not profile:
            profile = await client.userinfo(token=token)
        email = (profile.get("email") or profile.get("preferred_username") or "").strip().casefold()
        subject = str(profile.get("sub") or "")
        if not subject or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            raise ValueError("The provider did not return a usable account profile.")

        if link_user_id is not None:
            user = db.get(models.User, link_user_id)
            if user is None:
                raise ValueError("The account being linked is no longer available.")
            verified_claim = profile.get("email_verified")
            if not (verified_claim is True or str(verified_claim).casefold() == "true") or email != user.email.casefold():
                raise OAuthLinkEmailMismatch
            identity = db.scalar(
                select(models.OAuthIdentity).where(
                    models.OAuthIdentity.provider == "google",
                    models.OAuthIdentity.subject == subject,
                ).with_for_update()
            )
            if identity and identity.user_id != user.id:
                raise OAuthIdentityConflict
            if identity is None:
                db.add(models.OAuthIdentity(user_id=user.id, provider="google", subject=subject))
            db.commit()
            return RedirectResponse(f"{frontend_url}/?oauth_linked=google", status_code=303)

        identity = db.scalar(
            select(models.OAuthIdentity).where(
                models.OAuthIdentity.provider == provider,
                models.OAuthIdentity.subject == subject,
            ).with_for_update()
        )
        if identity:
            user = db.get(models.User, identity.user_id)
            if user is None:
                db.delete(identity)
                db.commit()
                raise ValueError("This linked account is no longer available.")
        else:
            existing_user = db.scalar(select(models.User).where(models.User.email == email).with_for_update())
            if existing_user:
                raise OAuthAccountConflict
            verified_claim = profile.get("email_verified")
            email_verified = verified_claim is True or str(verified_claim).casefold() == "true"
            display_name = (profile.get("name") or "").strip()[:120] or None
            user = models.User(
                email=email,
                password_hash=password_digest(secrets.token_urlsafe(48)),
                display_name=display_name,
                email_verified=email_verified,
            )
            db.add(user)
            db.flush()
            db.add(models.OAuthIdentity(user_id=user.id, provider=provider, subject=subject))
            db.flush()

        handoff_code = secrets.token_urlsafe(32)
        db.add(models.OAuthHandoffToken(
            user_id=user.id,
            token_hash=token_digest(handoff_code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=2),
        ))
        db.commit()
        return RedirectResponse(f"{frontend_url}/?{urlencode({'oauth_code': handoff_code})}", status_code=303)
    except OAuthAccountConflict:
        db.rollback()
        message = "account_conflict"
    except OAuthIdentityConflict:
        db.rollback()
        message = "identity_conflict"
    except OAuthLinkEmailMismatch:
        db.rollback()
        message = "email_mismatch"
    except HTTPException as exc:
        db.rollback()
        message = "provider_not_configured" if exc.status_code == 503 else "sign_in_failed"
    except (IntegrityError, SQLAlchemyError):
        db.rollback()
        message = "identity_conflict" if link_user_id is not None else "account_conflict"
    except Exception:
        db.rollback()
        message = "sign_in_failed"
    if link_user_id is not None:
        return RedirectResponse(f"{frontend_url}/?oauth_link_error={message}", status_code=303)
    return RedirectResponse(f"{frontend_url}/?oauth_error={message}", status_code=303)


@app.post("/api/auth/oauth/exchange")
def exchange_oauth_handoff(payload: OAuthHandoffExchange, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    handoff = db.scalar(
        select(models.OAuthHandoffToken).where(
            models.OAuthHandoffToken.token_hash == token_digest(payload.code),
            models.OAuthHandoffToken.expires_at > now,
        ).with_for_update()
    )
    if handoff is None:
        raise HTTPException(status_code=400, detail="This sign-in link is invalid or expired. Please try again.")
    user = db.get(models.User, handoff.user_id)
    db.delete(handoff)
    if user is None:
        db.commit()
        raise HTTPException(status_code=400, detail="This account is no longer available. Please try again.")
    if user.totp_enabled:
        return create_mfa_login_challenge(user, db)
    db.flush()
    result = create_session(user, db)
    db.commit()
    return result


@app.post("/api/auth/mfa/complete", response_model=AuthRead)
def complete_mfa_login(payload: MFALoginChallengeComplete, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    challenge = db.scalar(
        select(models.MFALoginChallenge).where(
            models.MFALoginChallenge.token_hash == token_digest(payload.challenge_token),
            models.MFALoginChallenge.expires_at > now,
        ).with_for_update()
    )
    if challenge is None:
        raise HTTPException(status_code=401, detail="Your sign-in code expired. Sign in again to restart.")
    user = db.scalar(select(models.User).where(models.User.id == challenge.user_id).with_for_update())
    if user is None or not user.totp_enabled or not verify_user_totp_code(user, payload.code, consume=True):
        raise HTTPException(status_code=401, detail="That authenticator or recovery code is incorrect or already used.")
    db.delete(challenge)
    db.flush()
    return create_session(user, db)


@app.post("/api/auth/email-verification/request", status_code=202)
def request_email_verification(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    # Use the same response whether the address exists or is already verified.
    email = payload.email.strip().casefold()
    user = db.scalar(select(models.User).where(models.User.email == email).with_for_update())
    if user is not None and not user.email_verified:
        now = datetime.now(timezone.utc)
        recent_token = db.scalar(
            select(models.EmailVerificationToken).where(
                models.EmailVerificationToken.user_id == user.id,
                models.EmailVerificationToken.created_at > now - timedelta(minutes=1),
            )
        )
        if recent_token is None:
            issue_email_verification(user, db)
    return {"message": "If this account needs verification, an email will be sent."}


@app.post("/api/auth/email-verification/complete")
def complete_email_verification(payload: EmailVerificationComplete, db: Session = Depends(get_db)):
    verification_token = db.scalar(
        select(models.EmailVerificationToken).where(
            models.EmailVerificationToken.token_hash == token_digest(payload.token),
            models.EmailVerificationToken.expires_at > datetime.now(timezone.utc),
        ).with_for_update()
    )
    if verification_token is None:
        raise HTTPException(status_code=400, detail="This verification link is invalid or expired. Request a new one.")
    user = db.get(models.User, verification_token.user_id)
    if user is None:
        db.delete(verification_token)
        db.commit()
        raise HTTPException(status_code=400, detail="This verification link is invalid or expired. Request a new one.")
    user.email_verified = True
    db.query(models.EmailVerificationToken).filter(models.EmailVerificationToken.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return {"message": "Email verified. You can now sign in.", "email": user.email}


@app.delete("/api/auth/session", status_code=204)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_db),
):
    if credentials:
        session = db.scalar(select(models.UserSession).where(models.UserSession.token_hash == token_digest(credentials.credentials)))
        if session:
            db.delete(session)
            db.commit()
    return Response(status_code=204)


@app.get("/api/auth/me", response_model=UserRead)
def get_account(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.get("/api/auth/totp")
def get_totp_status(current_user: models.User = Depends(get_current_user)):
    return {"enabled": bool(current_user.totp_enabled)}


@app.post("/api/auth/totp/setup")
def start_totp_setup(
    payload: PasswordVerify,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not password_matches(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if current_user.totp_enabled:
        raise HTTPException(status_code=409, detail="Two-factor authentication is already enabled.")
    totp_encryption_material()
    secret = generate_totp_secret()
    current_user.totp_pending_secret_encrypted = encrypt_totp_secret(secret)
    current_user.totp_setup_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.commit()
    issuer = "CyberShield VerifyPay"
    label = quote(f"{issuer}:{current_user.email}", safe="")
    uri = f"otpauth://totp/{label}?{urlencode({'secret': secret, 'issuer': issuer, 'algorithm': 'SHA1', 'digits': 6, 'period': 30})}"
    return {"secret": secret, "otpauth_uri": uri, "expires_in_seconds": 600}


@app.post("/api/auth/totp/enable")
def enable_totp(
    payload: TOTPEnable,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    expiry = current_user.totp_setup_expires_at
    if expiry is not None and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if not current_user.totp_pending_secret_encrypted or expiry is None or expiry <= now:
        current_user.totp_pending_secret_encrypted = None
        current_user.totp_setup_expires_at = None
        db.commit()
        raise HTTPException(status_code=400, detail="Authenticator setup expired. Start setup again.")
    secret = decrypt_totp_secret(current_user.totp_pending_secret_encrypted)
    matched_step = matching_totp_step(secret, payload.code)
    if matched_step is None:
        raise HTTPException(status_code=400, detail="That authenticator code is incorrect. Check your device time and try again.")
    recovery_codes = [secrets.token_hex(6).upper() for _ in range(10)]
    current_user.totp_secret_encrypted = current_user.totp_pending_secret_encrypted
    current_user.totp_pending_secret_encrypted = None
    current_user.totp_setup_expires_at = None
    current_user.totp_last_used_step = matched_step
    current_user.totp_recovery_code_hashes = json.dumps([recovery_code_digest(code) for code in recovery_codes])
    current_user.totp_enabled = True
    db.query(models.MFALoginChallenge).filter(models.MFALoginChallenge.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"enabled": True, "recovery_codes": recovery_codes}


@app.post("/api/auth/totp/disable")
def disable_totp(
    payload: TOTPDisable,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.totp_enabled:
        raise HTTPException(status_code=409, detail="Two-factor authentication is not enabled.")
    if not password_matches(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if not verify_user_totp_code(current_user, payload.code, consume=True):
        raise HTTPException(status_code=400, detail="That authenticator or recovery code is incorrect or already used.")
    current_user.totp_secret_encrypted = None
    current_user.totp_pending_secret_encrypted = None
    current_user.totp_setup_expires_at = None
    current_user.totp_last_used_step = None
    current_user.totp_recovery_code_hashes = None
    current_user.totp_enabled = False
    db.query(models.MFALoginChallenge).filter(models.MFALoginChallenge.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"enabled": False}


@app.put("/api/auth/profile", response_model=UserRead)
def update_profile(
    payload: ProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    display_name = payload.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="Enter a name for your profile.")
    current_user.display_name = display_name
    current_user.phone_number = (payload.phone_number or "").strip() or None
    db.commit()
    db.refresh(current_user)
    return current_user


@app.put("/api/auth/preferences", response_model=UserRead)
def update_preferences(
    payload: PreferencesUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.theme = payload.theme
    current_user.language = payload.language
    current_user.currency = payload.currency
    db.commit()
    db.refresh(current_user)
    return current_user


@app.delete("/api/account", status_code=204)
def delete_account(
    payload: PasswordVerify,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not password_matches(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="The password is incorrect. Your account was not deleted.")
    owner_key = str(current_user.id)
    db.query(models.PaymentCheck).filter(models.PaymentCheck.owner_key == owner_key).delete(synchronize_session=False)
    db.query(models.TrustedPayee).filter(models.TrustedPayee.owner_key == owner_key).delete(synchronize_session=False)
    db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == current_user.id).delete(synchronize_session=False)
    db.query(models.EmailVerificationToken).filter(models.EmailVerificationToken.user_id == current_user.id).delete(synchronize_session=False)
    db.query(models.UserSession).filter(models.UserSession.user_id == current_user.id).delete(synchronize_session=False)
    db.delete(current_user)
    db.commit()
    return Response(status_code=204)


@app.post("/api/auth/password/verify")
def verify_current_password(
    payload: PasswordVerify,
    current_user: models.User = Depends(get_current_user),
):
    if not password_matches(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    return {"verified": True}


@app.put("/api/auth/password", response_model=AuthRead)
def change_password(
    payload: PasswordChange,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not password_matches(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if hmac.compare_digest(payload.current_password, payload.new_password):
        raise HTTPException(status_code=400, detail="Choose a new password that differs from the current one.")
    current_user.password_hash = password_digest(payload.new_password)
    db.query(models.UserSession).filter(models.UserSession.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    db.refresh(current_user)
    return create_session(current_user, db)


@app.post("/api/auth/password-reset", status_code=202)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    # Keep the response the same for known and unknown addresses to limit account discovery.
    email = payload.email.strip().casefold()
    user = db.scalar(select(models.User).where(models.User.email == email).with_for_update())
    if user is None:
        print("[VerifyPay] No matching account was found; no email was sent.", flush=True)
        return {"message": "If an account matches that email, a reset link will be sent."}

    now = datetime.now(timezone.utc)
    recent_token = db.scalar(
        select(models.PasswordResetToken).where(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.created_at > now - timedelta(minutes=1),
        )
    )
    if recent_token is not None:
        return {"message": "If an account matches that email, a reset link will be sent."}

    raw_token = secrets.token_urlsafe(32)
    reset_token = models.PasswordResetToken(
        user_id=user.id,
        token_hash=token_digest(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user.id).delete(synchronize_session=False)
    db.add(reset_token)
    db.commit()

    frontend_url = (os.getenv("FRONTEND_URL") or os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:5173").rstrip("/")
    reset_url = f"{frontend_url}/?{urlencode({'reset_token': raw_token})}"
    try:
        send_password_reset_email(user.email, reset_url)
    except (OSError, RuntimeError, smtplib.SMTPException) as exc:
        print(f"[VerifyPay] Reset email delivery failed ({type(exc).__name__}).", flush=True)
        db.delete(reset_token)
        db.commit()
        return {"message": "If an account matches that email, a reset link will be sent."}
    print("[VerifyPay] Reset email accepted by the configured provider.", flush=True)
    return {"message": "If an account matches that email, a reset link will be sent."}


@app.post("/api/auth/password-reset/complete", status_code=204)
def complete_password_reset(payload: PasswordResetComplete, db: Session = Depends(get_db)):
    reset_token = db.scalar(
        select(models.PasswordResetToken).where(
            models.PasswordResetToken.token_hash == token_digest(payload.token),
            models.PasswordResetToken.expires_at > datetime.now(timezone.utc),
        ).with_for_update()
    )
    if reset_token is None:
        raise HTTPException(status_code=400, detail="This reset link is invalid or expired. Request a new one.")
    user = db.get(models.User, reset_token.user_id)
    if user is None:
        db.delete(reset_token)
        db.commit()
        raise HTTPException(status_code=400, detail="This reset link is invalid or expired. Request a new one.")
    user.password_hash = password_digest(payload.new_password)
    db.query(models.UserSession).filter(models.UserSession.user_id == user.id).delete(synchronize_session=False)
    db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=204)


@app.post("/api/checks", response_model=CheckRead)
def create_check(payload: CheckCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.source_type == "file":
        raise HTTPException(status_code=400, detail="Upload an image to /api/checks/image.")
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="Enter payment details or a link to check.")
    if payload.source_type == "url" and len(content) > 2048:
        raise HTTPException(status_code=422, detail="Payment links must be 2,048 characters or shorter.")
    payees = db.scalars(
        select(models.TrustedPayee).where(models.TrustedPayee.owner_key == str(current_user.id))
    ).all()
    risk_level, risk_score, explanation, amount, recipient, trusted_match, link_domain, findings, link_domains = assess_payment(
        payload.source_type, content, payees
    )
    # Keep raw payment text and URLs out of the database.
    label = "Pasted payment details"
    if payload.source_type == "url":
        label = "Payment link submitted"

    check = models.PaymentCheck(
        owner_key=str(current_user.id),
        source_type=payload.source_type,
        input_label=label[:240],
        risk_level=risk_level,
        risk_score=risk_score,
        explanation=explanation,
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    result = CheckRead.model_validate(check).model_dump()
    result.update({"detected_amount": amount, "recipient_guess": recipient, "trusted_payee_match": trusted_match, "link_domain": link_domain, "link_domains": link_domains, "findings": findings, "recommended_action": recommended_action(risk_level, findings)})
    return result


@app.post("/api/checks/image", response_model=CheckRead)
async def create_image_check(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Choose an image file such as PNG or JPG.")
    image_bytes = await file.read(MAX_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller.")
    try:
        recognized_text = await run_in_threadpool(image_to_text, image_bytes)
    except ImageTooLargeError as exc:
        raise HTTPException(status_code=413, detail="This image has too many pixels to scan. Resize it or take a screenshot, then try again.") from exc
    except OcrTimeoutError as exc:
        raise HTTPException(status_code=504, detail="Reading this image took too long. Try cropping it to the payment details and upload again.") from exc
    except OcrUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Tesseract OCR is not installed or could not be found. Install it and restart the API.",
        ) from exc
    except UnreadableImageError as exc:
        raise HTTPException(status_code=422, detail="This image format could not be opened. Try a PNG or JPG image.") from exc
    if len(recognized_text.strip()) < 3:
        raise HTTPException(status_code=422, detail="No readable text was found. Try a sharper, well-lit image.")

    payees = db.scalars(
        select(models.TrustedPayee).where(models.TrustedPayee.owner_key == str(current_user.id))
    ).all()
    risk_level, risk_score, explanation, amount, recipient, trusted_match, link_domain, findings, link_domains = assess_payment(
        "file", recognized_text[:12000], payees
    )
    check = models.PaymentCheck(
        owner_key=str(current_user.id),
        source_type="file",
        input_label="Uploaded receipt image",
        risk_level=risk_level,
        risk_score=risk_score,
        explanation=explanation,
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    # Return a temporary text preview so the user can judge OCR quality; never persist it.
    result = CheckRead.model_validate(check).model_dump()
    result["ocr_text_preview"] = recognized_text[:1200]
    result["detected_amount"] = amount
    result["recipient_guess"] = recipient
    result["trusted_payee_match"] = trusted_match
    result["link_domain"] = link_domain
    result["link_domains"] = link_domains
    result["findings"] = findings
    result["recommended_action"] = recommended_action(risk_level, findings)
    return result


@app.get("/api/checks", response_model=list[CheckRead])
def list_checks(
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    risk_level: str | None = Query(default=None, pattern="^(low|medium|high)$"),
    source_type: str | None = Query(default=None, pattern="^(file|text|url)$"),
    search: str | None = Query(default=None, max_length=120),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(models.PaymentCheck).where(models.PaymentCheck.owner_key == str(current_user.id))
    if risk_level:
        query = query.where(models.PaymentCheck.risk_level == risk_level)
    if source_type:
        query = query.where(models.PaymentCheck.source_type == source_type)
    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        query = query.where(or_(models.PaymentCheck.input_label.ilike(search_pattern), models.PaymentCheck.explanation.ilike(search_pattern)))
    return db.scalars(
        query.order_by(models.PaymentCheck.created_at.desc(), models.PaymentCheck.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()


@app.get("/api/checks/export.csv")
def export_checks(
    risk_level: str | None = Query(default=None, pattern="^(low|medium|high)$"),
    source_type: str | None = Query(default=None, pattern="^(file|text|url)$"),
    search: str | None = Query(default=None, max_length=120),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(models.PaymentCheck).where(models.PaymentCheck.owner_key == str(current_user.id))
    if risk_level:
        query = query.where(models.PaymentCheck.risk_level == risk_level)
    if source_type:
        query = query.where(models.PaymentCheck.source_type == source_type)
    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        query = query.where(or_(models.PaymentCheck.input_label.ilike(search_pattern), models.PaymentCheck.explanation.ilike(search_pattern)))
    checks = db.scalars(query.order_by(models.PaymentCheck.created_at.desc(), models.PaymentCheck.id.desc())).all()
    output = StringIO(newline="")
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(["Saved at", "Input type", "Label", "Preliminary signal level", "Rules-based signal score (0-100; not a probability)", "Explanation"])
    def spreadsheet_text(value: str) -> str:
        return "'" + value if value.lstrip(" \t\r\n\x00").startswith(("=", "+", "-", "@")) else value

    for check in checks:
        writer.writerow([
            check.created_at.isoformat(),
            spreadsheet_text(check.source_type),
            spreadsheet_text(check.input_label),
            check.risk_level,
            check.risk_score,
            spreadsheet_text(check.explanation),
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=verifypay-history.csv"},
    )


@app.delete("/api/checks/{check_id}", status_code=204)
def delete_check(
    check_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check = db.scalar(
        select(models.PaymentCheck).where(
            models.PaymentCheck.id == check_id,
            models.PaymentCheck.owner_key == str(current_user.id),
        )
    )
    if check is None:
        raise HTTPException(status_code=404, detail="Saved check was not found.")
    db.delete(check)
    db.commit()
    return Response(status_code=204)


@app.get("/api/payees", response_model=list[PayeeRead])
def list_payees(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(models.TrustedPayee)
        .where(models.TrustedPayee.owner_key == str(current_user.id))
        .order_by(models.TrustedPayee.name)
    ).all()


@app.get("/api/stats")
def get_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    checks = db.scalar(
        select(func.count()).select_from(models.PaymentCheck).where(models.PaymentCheck.owner_key == str(current_user.id))
    ) or 0
    payees = db.scalar(
        select(func.count()).select_from(models.TrustedPayee).where(models.TrustedPayee.owner_key == str(current_user.id))
    ) or 0
    return {"checks": checks, "trusted_payees": payees}


@app.get("/api/account/export.json")
def export_account_data(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    owner_key = str(current_user.id)
    checks = db.scalars(
        select(models.PaymentCheck).where(models.PaymentCheck.owner_key == owner_key)
        .order_by(models.PaymentCheck.created_at.desc(), models.PaymentCheck.id.desc())
    ).all()
    payees = db.scalars(
        select(models.TrustedPayee).where(models.TrustedPayee.owner_key == owner_key)
        .order_by(models.TrustedPayee.name)
    ).all()
    return {
        "account": UserRead.model_validate(current_user).model_dump(mode="json"),
        "payment_checks": [CheckRead.model_validate(check).model_dump(mode="json") for check in checks],
        "trusted_payees": [PayeeRead.model_validate(payee).model_dump(mode="json") for payee in payees],
        "note": "Submitted payment text and image OCR text are not stored or included.",
    }


@app.post("/api/payees", response_model=PayeeRead, status_code=201)
def create_payee(payload: PayeeCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = payload.name.strip()
    identifier = payload.payment_identifier.strip()
    if not name or not identifier:
        raise HTTPException(status_code=422, detail="Enter both a payee name and payment identifier.")
    duplicate = db.scalar(
        select(models.TrustedPayee).where(
            models.TrustedPayee.owner_key == str(current_user.id),
            or_(
                func.lower(models.TrustedPayee.name) == name.lower(),
                func.lower(models.TrustedPayee.payment_identifier) == identifier.lower(),
            ),
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A trusted payee with this name or payment identifier already exists.")
    payee = models.TrustedPayee(
        owner_key=str(current_user.id),
        name=name,
        payment_identifier=identifier,
        identifier_type=payload.identifier_type,
        category=payload.category,
        notes=(payload.notes or "").strip() or None,
    )
    db.add(payee)
    db.commit()
    db.refresh(payee)
    return payee


@app.put("/api/payees/{payee_id}", response_model=PayeeRead)
def update_payee(
    payee_id: int,
    payload: PayeeCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payee = db.scalar(
        select(models.TrustedPayee).where(
            models.TrustedPayee.id == payee_id,
            models.TrustedPayee.owner_key == str(current_user.id),
        )
    )
    if payee is None:
        raise HTTPException(status_code=404, detail="Trusted payee was not found.")
    name = payload.name.strip()
    identifier = payload.payment_identifier.strip()
    if not name or not identifier:
        raise HTTPException(status_code=422, detail="Enter both a payee name and payment identifier.")
    duplicate = db.scalar(
        select(models.TrustedPayee).where(
            models.TrustedPayee.owner_key == str(current_user.id),
            models.TrustedPayee.id != payee_id,
            or_(
                func.lower(models.TrustedPayee.name) == name.lower(),
                func.lower(models.TrustedPayee.payment_identifier) == identifier.lower(),
            ),
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Another trusted payee already uses this name or payment identifier.")
    payee.name = name
    payee.payment_identifier = identifier
    payee.identifier_type = payload.identifier_type
    payee.category = payload.category
    payee.notes = (payload.notes or "").strip() or None
    db.commit()
    db.refresh(payee)
    return payee


@app.delete("/api/payees/{payee_id}", status_code=204)
def delete_payee(payee_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    payee = db.scalar(
        select(models.TrustedPayee).where(
            models.TrustedPayee.id == payee_id,
            models.TrustedPayee.owner_key == str(current_user.id),
        )
    )
    if payee is None:
        raise HTTPException(status_code=404, detail="Trusted payee was not found.")
    db.delete(payee)
    db.commit()
    return Response(status_code=204)


frontend_build = Path(__file__).resolve().parent.parent / "static"
if frontend_build.is_dir():
    app.mount("/", StaticFiles(directory=frontend_build, html=True), name="frontend")
