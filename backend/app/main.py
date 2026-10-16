import csv
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
from io import StringIO
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from . import models
from .database import get_db
from .ocr import ImageTooLargeError, MAX_IMAGE_BYTES, OcrTimeoutError, OcrUnavailableError, UnreadableImageError, image_to_text
from .risk import assess_payment, recommended_action
from .schemas import AuthCredentials, AuthRead, CheckCreate, CheckRead, PasswordChange, PasswordResetComplete, PasswordResetRequest, PasswordVerify, PayeeCreate, PayeeRead, UserRead


app = FastAPI(title="CyberShield VerifyPay API", version="0.2.0")
default_cors_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
cors_origins = [origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", default_cors_origins).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

auth_scheme = HTTPBearer(auto_error=False)


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


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    sender = os.getenv("SMTP_FROM", "").strip()
    provider = os.getenv("EMAIL_PROVIDER", "smtp").strip().casefold()
    body = (
        "We received a request to reset your VerifyPay password.\n\n"
        f"Open this link within 30 minutes to choose a new password:\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )

    if provider == "brevo":
        api_key = os.getenv("BREVO_API_KEY", "").strip()
        if not api_key or not sender:
            raise RuntimeError("Password reset email is not configured.")
        request = Request(
            "https://api.brevo.com/v3/smtp/email",
            data=json.dumps({
                "sender": {"name": "CyberShield VerifyPay", "email": sender},
                "to": [{"email": recipient}],
                "subject": "Reset your VerifyPay password",
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
        raise RuntimeError("Password reset email is not configured.")
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as exc:
        raise RuntimeError("SMTP_PORT must be a valid port number.") from exc

    message = EmailMessage()
    message["Subject"] = "Reset your VerifyPay password"
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


@app.post("/api/auth/register", response_model=AuthRead, status_code=201)
def register(payload: AuthCredentials, db: Session = Depends(get_db)):
    email = payload.email.strip().casefold()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if db.scalar(select(models.User).where(models.User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = models.User(email=email, password_hash=password_digest(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc
    db.refresh(user)
    return create_session(user, db)


@app.post("/api/auth/login", response_model=AuthRead)
def login(payload: AuthCredentials, db: Session = Depends(get_db)):
    email = payload.email.strip().casefold()
    user = db.scalar(select(models.User).where(models.User.email == email))
    if user is None or not password_matches(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return create_session(user, db)


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
    user = db.scalar(select(models.User).where(models.User.email == email))
    if user is None:
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
    except (OSError, RuntimeError, smtplib.SMTPException):
        db.delete(reset_token)
        db.commit()
        return {"message": "If an account matches that email, a reset link will be sent."}
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
