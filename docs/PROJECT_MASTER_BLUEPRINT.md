# CyberShield VerifyPay - Project Master Blueprint & State Snapshot
 
**Snapshot date:** 2026-11-01 (Asia/Calcutta)  
**Repository root:** C:/Users/Mdreh/Documents/Codex/2026-10-12/CyberShield  
**Project:** CyberShield VerifyPay (VerifyPay)  
**Git:** branch main, HEAD 5e0417e (Prepare CyberShield deployment).

> Use the live source and current Git status as final authority. Root HANDOFF.md is older (2026-10-22) and contains stale/conflicting status notes; retain it as historical context. This file is the newer snapshot. Never inspect/print private .env values.

## 1. Purpose, users, and limits

CyberShield VerifyPay is an educational payment-message review prototype. Signed-in users submit payment-related text, a URL, or an image and receive a preliminary, explainable pattern score, findings, extracted details, and a suggested next step. Intended use is learning/demonstrations with fictional examples.

It is **not** a fraud detector or payment service. Risk analysis is deterministic Python pattern matching, not a trained machine-learning model. It does not verify a transfer, recipient/account ownership, or live website reputation. It never fetches, opens, crawls, or queries submitted URLs. Rules can miss scams or flag legitimate messages. A low score is not proof of safety.

Documented data behavior: raw payment text, URL text, and OCR text are not persisted in PostgreSQL; only a check summary is saved. Image OCR text can be returned temporarily to the authenticated browser (up to 1,200 characters) to inspect OCR quality. A hosted URL is network-accessible; a URL alone does not restrict access to invited people. Do not use real payment credentials, verification codes, or sensitive production payment data.

## 2. Architecture and technology

Browser → React single-page website (Vite) → FastAPI API (JSON/multipart) → Pydantic validation, auth/session checks, Python risk rules, Tesseract OCR for images, and SQLAlchemy → PostgreSQL.

**Frontend:** React/React DOM 18, JavaScript/JSX, CSS, Vite 6, Lucide React. Single-page UI driven by activeItem in frontend/src/App.jsx; no React Router setup. main.jsx mounts the app and styles. Shared components in src/components; API helper in src/lib/api.js; theme tokens in src/styles/tokens.css; responsive app styles in global.css. Bearer token is stored in sessionStorage; theme and account-keyed browser notifications use localStorage. Dark/light brand assets are in frontend/public.

**Backend:** Python 3.12 container, FastAPI, Uvicorn, Pydantic schemas, SQLAlchemy, psycopg/PostgreSQL, Alembic, Authlib OIDC, cryptography/Fernet, Pillow and pytesseract/Tesseract. Main code is in backend/app; routes and security helpers are centralized in main.py.

**OCR:** image must be an image MIME type, <=10 MiB and <=40 million pixels. OCR has a 15-second timeout; image is EXIF-corrected, grayscale/autocontrasted, resized/upscaled, then read with Tesseract page segmentation modes 6 and 11. UI accepts PNG/JPEG/WEBP. OCR may omit/misread small, blurry, low contrast, or unusual-layout text.

**Hosting:** backend/Dockerfile builds frontend using Node 22, installs Python 3.12 requirements and Tesseract, copies frontend dist into the API image, runs alembic upgrade head, and starts Uvicorn on PORT (default 10000). render.yaml describes a Render Docker web service and health check; its existence does not prove deployment. A Netlify/Vercel static frontend still requires a reachable API and database.

## 3. Data models and migrations

ORM tables in backend/app/models.py:

| Model/table | Stored information |
|---|---|
| User / users | Email, password hash, display name, phone, theme/language/currency, email verification, creation time, TOTP status/encrypted active and pending secrets/setup expiry/last-used step/recovery-code hashes. |
| UserSession / user_sessions | User FK, session-token digest, expiration, creation time. |
| PasswordResetToken / password_reset_tokens | User FK, token digest, expiry and creation time. |
| EmailVerificationToken / email_verification_tokens | User FK, token digest, expiry and creation time. |
| OAuthIdentity / oauth_identities | User FK, provider, provider subject; provider/subject unique. |
| OAuthHandoffToken / oauth_handoff_tokens | User FK, short-lived token digest, expiry and creation time. |
| MFALoginChallenge / mfa_login_challenges | User FK, challenge-token digest, expiry and creation time. |
| PaymentCheck / payment_checks | Account owner key, source type, input label, risk level/score, explanation and timestamp. No submitted text/OCR. |
| TrustedPayee / trusted_payees | Account owner key, name, payment identifier/type, category, optional notes and timestamp. |

Checks/payees are account-scoped by owner_key (user ID string); related token/identity/MFA tables use user foreign keys/cascades where declared. Related data is queried explicitly; ORM relationship properties are not declared.

Migration chain:
1. 0001_initial: users, payment summaries, trusted payees, sessions.
2. 0002_password_reset: reset token table.
3. 0003_profile_prefs_payee: profile/preferences and payee category/notes.
4. 0004_email_verification: verified flag and verification tokens.
5. 0005_social_auth: provider identities and OAuth handoff tokens.
6. 0006_payee_identifier_type: trusted-payee identifier type.
7. 0007_totp_mfa: MFA fields and login challenge table.

Migration source head is 0007_totp_mfa. The existing local DB was historically checked at 0006, migration 0007 applied, and alembic current reported 0007 head in the older handoff. It was not re-queried on 2026-11-01; treat this as last-known, not freshly verified. API startup does not create schema. Use upgrade head only on fresh databases or after carefully verifying the existing migration baseline; never blindly stamp/upgrade.

## 4. Authentication and security mechanics

**Passwords:** Python hashlib.scrypt; random 16-byte salt; N=2^14, r=8, p=1, dklen=32. Stored format scrypt$<salt-hex>$<digest-hex>. Comparison is constant-time using hmac.compare_digest.

**Sessions:** random secrets.token_urlsafe(32) bearer; only SHA-256 digest stored; 7-day expiry; frontend holds raw token in sessionStorage; logout deletes corresponding DB session.

**Email verification/reset:** random 32-byte URL-safe token, only SHA-256 digest stored, expires in 30 minutes and consumed on completion. SMTP local or Brevo HTTPS hosted. Generic response avoids exposing whether an email exists/was verified. Email sends have a per-account one-minute resend cooldown.

**Google OIDC:** Authlib provider discovery, scopes openid email profile, authorization-code flow with PKCE S256 and Starlette session state/nonce. Google credentials and stable OAUTH_SESSION_SECRET are required. Existing accounts are not silently auto-linked by email. User signs into the existing account first, then links Google from Settings; verified email must match. Callback makes a random one-use handoff code stored as a digest for 2 minutes, then frontend exchanges it for an app session; bearer session token is not put in callback URL. Microsoft provider code exists but is explicitly deferred and requires a specific tenant.

**Latest OAuth symptom:** most recent local attempt did not render Google; browser showed accounts.google.com could not be loaded / ERR_NETWORK_CHANGED. That is a browser/network error, not evidence of redirect_uri_mismatch or invalid_client. Retry with stable network. Callback URL observed was http://localhost:5173/api/auth/oauth/google/callback. Local Vite proxy source defaults to port 8000 but README/VS Code task starts backend on 8001; private frontend/.env.local may override. Check port alignment without disclosing its contents.

**MFA (code exists; intentionally deferred):** TOTP secret is 20 random bytes in Base32, encrypted using Fernet derived from stable TOTP_ENCRYPTION_KEY or fallback OAUTH_SESSION_SECRET (at least 32 characters). Changing key makes stored secrets unreadable. Six-digit HMAC-SHA1 codes use 30-second period, accept current +/-1 step and store last-used step against replay. Setup reauthenticates with current password and expires after 10 minutes. Enabling returns ten 12-hex recovery codes once; only HMAC-SHA256 hashes of normalized codes are stored and a used code is removed. Login challenge token is random and stored hashed; expires in 5 minutes. Password and OAuth flows can issue this challenge. Disable requires current password and valid TOTP/recovery code. No MFA E2E validation is recorded; OAuth-only-account enrollment may be awkward because setup requires a local password. User requested MFA be last and only when they say so.

**Rate limits:** in-memory per-process sliding windows keyed by route and client IP: register 5/15 min; login 10/15; MFA completion 5/15; TOTP setup/enable/disable 5 each/15; password-reset request 3/15; reset completion 5/15; verification request 3/15; verification completion 5/15. Email resend also has one-minute per-account cooldown. Limits are not shared between instances; multi-instance hosting needs shared storage and proxy-aware client IP handling.

**Other boundaries:** CORS uses CORS_ORIGINS; OAUTH_COOKIE_SECURE is intended true on HTTPS, false locally. Links are text-only. Secrets stay private. .gitignore excludes .env/.env.* except examples, venvs, node_modules, dist, local DB exports, outputs, logs and caches.
 
## 5. Risk analysis behavior

Implementation: backend/app/risk.py (source is authoritative).

- Every check starts at 10 points. No detectable amount adds 20. No detectable recipient adds 20 unless a trusted-payee text match supplies one.
- A request to send/share/provide/reply with/give/enter an OTP, one-time password, PIN, password, or security code adds 75.
- Urgency/pressure wording (urgent, immediately, right now, act now, final warning, account-blocked wording, or “within N minutes”) adds 30.
- Gift cards, cryptocurrency/crypto, Bitcoin, or wire transfer adds 25.
- Link warnings, per unique link and only for the first five: non-HTTPS +25; known shortener +25; hostname longer than 60 chars +10; more than five domain labels +10; nonstandard port +15; IP host +20; punycode label +15; hyphenated hostname combining payment wording and authentication/security wording +20; userinfo before host +20. An unparseable host/format adds a cautious +20 finding.
- For text/image source, link extraction recognizes http://, https:// and www. URL-source input is parsed as the submitted URL. Duplicates are case-insensitively deduplicated. Extra links beyond five get an informational finding.
- Score caps at 100. Levels: low 0-34; medium 35-69; high 70-100.
- Multiple different amounts create a finding but add no points. Trusted-payee matching is text-only and adds no points. Too few OCR words creates a caution but adds no points. No warning triggers yields a no-warning finding.
- Structured extraction supports amount, time (12-hour and 24-hour forms), and recipient (recipient/payee/beneficiary/to labels or transfer/pay/send phrases). Payment/transaction ID extraction is not implemented.
- Recommended next steps depend on level/findings. A high signal advises not sending money/sharing codes and contacting a bank/intended recipient through an independently trusted channel. All scores remain preliminary text-pattern signals.

## 6. UI structure and feature map

Single-page conditional rendering is in frontend/src/App.jsx; desktop/mobile and light/dark CSS are in frontend/src/styles/global.css and tokens.css. Feature wiring in source does not mean all controls have been click-by-click audited. Full UI control audit remains incomplete.

| View/feature | Current wiring |
|---|---|
| Sign in / registration | Password sign-in, registration, email verification, Google provider entry, session bootstrap and logout. New password accounts require email verification. |
| OAuth return / MFA challenge | Parses OAuth handoff/error and exchanges code; MFA challenge handling is in frontend. Google browser flow currently network-blocked; MFA E2E is deferred. |
| Overview / Home | Activity summary, recent checks, quick actions, safety score, navigation. Score is data-derived from up to the latest 10 numeric risk scores (100 minus their average); do not hardcode. “Incidents tracked” is a placeholder. |
| Verify a payment | Upload image, paste message, enter manual details, or analyze URL text. Result shows signal/findings/recommendation and available amount/time/recipient/link info, OCR preview, and copy/download/share controls where wired. Backend never opens submitted URLs. |
| Payment History | Account-scoped list, search/filter, paging/loading, CSV export, print/save as PDF, open explanation, confirmed delete. |
| Trusted Payees | Account-scoped add/edit/delete, UPI ID/Bank Account/Contact types, categories/notes and UI filter/sort. A match is text only, not ownership verification. |
| Learn & Protect | Educational advice/examples; navigation can jump to a relevant section and highlight it temporarily. |
| Emergency Mode | Guidance workflow only; not an emergency service and does not contact a bank/authority. |
| Profile | View/edit display name and phone. |
| Settings | Theme/preferences, password/sign-in, Google link/status, MFA controls, account data export/delete. API preference schema currently only allows language en and currency INR; do not claim broader localization. |
| Change password | Separate activeItem view; verifies current password and updates password/session behavior via API. |
| Search/navigation | Search suggestions, desktop sidebar and mobile menu, theme toggle. |
| Notifications | Bell panel for completed payment checks; source has outside-pointer and Escape dismissal, mark-read/navigation handlers. Storage is local browser/account scoped; not push/email/server persisted. Verify in UI audit. |

### API route inventory

All in backend/app/main.py:
- Health/root: GET /health, GET /api.
- Auth/session: POST /api/auth/register, POST /api/auth/login, DELETE /api/auth/session, GET /api/auth/me.
- OAuth: GET /api/auth/oauth/{provider}, GET /api/auth/oauth/{provider}/callback, POST /api/auth/oauth/exchange, POST /api/auth/oauth/google/link, GET /api/auth/linked-identities.
- MFA: POST /api/auth/mfa/complete, GET /api/auth/totp, POST /api/auth/totp/setup, POST /api/auth/totp/enable, POST /api/auth/totp/disable.
- Email/password: POST /api/auth/email-verification/request, POST /api/auth/email-verification/complete, POST /api/auth/password/verify, PUT /api/auth/password, POST /api/auth/password-reset, POST /api/auth/password-reset/complete.
- Account: PUT /api/auth/profile, PUT /api/auth/preferences, DELETE /api/account, GET /api/account/export.json, GET /api/stats.
- Checks: POST /api/checks, POST /api/checks/image, GET /api/checks, GET /api/checks/export.csv, DELETE /api/checks/{check_id}.
- Payees: GET /api/payees, POST /api/payees, PUT /api/payees/{payee_id}, DELETE /api/payees/{payee_id}.

## 7. Current repository and verification state

### Git state

- Branch main tracks origin/main; HEAD 5e0417e, “Prepare CyberShield deployment”.
- Preserve all existing changes; do not reset, clean, checkout, overwrite, or regenerate:
  - Modified backend/app/main.py, backend/app/ocr.py, backend/app/risk.py, backend/app/schemas.py.
  - frontend/index.html is staged modified.
  - frontend/public/cybershield-symbol-dark.png and cybershield-symbol-light.png are staged new files.
  - frontend/src/App.jsx and frontend/src/styles/global.css each have staged and unstaged edits.
  - output/ is untracked and includes the recently generated technology/feasibility PDF plus its render-review PNGs and helper script. Do not assume these are app code.
- Three fictional scanner sample PNGs are at ignored outputs/presentation-samples/: 01-low-signal-demo.png, 02-medium-signal-demo.png, 03-high-signal-demo.png. .gitignore ignores outputs/, so Git will not carry them unless deliberately added/copied.
- Existing HANDOFF.md is tracked and unchanged. This file is a new master blueprint; it will be untracked until staged/committed by user.
- No commit/push/reset/deploy was performed as part of this handoff.

### Fully implemented / last-known evidence

- User previously reported normal password sign-in succeeded after migration 0007. User-reported, not reproduced in this snapshot.
- Older handoff reports existing DB migration at 0007_totp_mfa head. Not freshly queried 2026-11-01.
- Source contains registration, email verify/reset, password auth/change, Google OAuth/link, profile/preferences/account export/delete, checks, payees, history/CSV, stats, and UI flows above.
- Notification outside-click/Escape dismissal exists in source; full visual/control audit still outstanding.
- Safety score is calculated from up to the latest 10 actual scores (100 minus their average); exact current visual state not rechecked here.
- Earlier work reported API health success and frontend build success; neither was rerun during this snapshot.

### Remaining / unverified

- Latest Google attempt did not reach Google sign-in because browser showed ERR_NETWORK_CHANGED. Retry on stable network. Do not call this an OAuth configuration failure without provider error evidence.
- Run backend unittest suite fresh. There are 23 test methods across four files: risk 8, auth helpers 4, sessions 3, account scoping 8. It was not run in this handoff turn; no dedicated MFA test file exists.
- Complete systematic UI audit: desktop/mobile, dark/light, navigation/search, notification outside-click closure, Google-connected Settings positioning/link action, all payment input/results/copy/download/share/error states, history search/filter/export/print/delete, payee CRUD/filter/sort, profile/preferences/password/email verification/reset, account export/delete, learning jumps, Emergency Mode, loading/offline.
- MFA E2E and negative-path tests remain deferred until user explicitly says to do MFA last. Microsoft sign-in stays deferred.
- Reconcile local Vite target default 8000 with backend task/README 8001 without exposing frontend/.env.local.
- No live deployment is verified. Before launch, validate production DB and migration baseline, HTTPS/CORS/callbacks, email delivery, audience/access settings, legal/privacy copy, third-party licenses, OCR, backups, and operational behavior. Do not deploy without user authorization.
 
## 8. Environment variables — names only

Never copy private values to a handoff, prompt, screenshot, issue, or chat. Backend names discovered in code/examples/deployment:

- DATABASE_URL — required PostgreSQL/SQLAlchemy connection.
- EMAIL_PROVIDER — smtp default or brevo.
- SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM — local SMTP; SMTP_FROM is the sender address.
- BREVO_API_KEY — Brevo HTTPS email credential when provider is brevo.
- FRONTEND_URL — frontend origin for links/redirects; non-local origins must use HTTPS.
- OAUTH_SESSION_SECRET — stable Starlette OAuth state/session signing secret; also TOTP-key fallback. OAuth requires it.
- TOTP_ENCRYPTION_KEY — stable TOTP encryption key material; falls back to OAUTH_SESSION_SECRET.
- OAUTH_API_BASE_URL — provider callback base URL; falls back to RENDER_EXTERNAL_URL, then request base.
- RENDER_EXTERNAL_URL — Render-provided URL fallback.
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — Google OIDC.
- MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID — provider code exists but is deferred.
- OAUTH_COOKIE_SECURE — true for HTTPS deployment, false local HTTP.
- CORS_ORIGINS — comma-separated browser origins.
- TESSERACT_CMD — optional full path to Tesseract executable.
- PORT — hosting-provided Uvicorn port; Docker fallback is 10000.

Frontend names:
- VITE_API_BASE_URL — API origin for a separately hosted frontend; blank for same-origin.
- VITE_API_TARGET — Vite development proxy target; source default http://127.0.0.1:8000.

Actual backend/.env and frontend/.env.local are private and were not read. backend/.env.example/frontend/.env.example are the safe references.

## 9. Repository map and dependencies

Main tracked structure:
- .vscode/: Python/editor settings, extension suggestions, folder-open backend/frontend tasks and workspace files.
- backend/app/main.py: FastAPI middleware, authentication/OIDC/MFA, account, checks and payee routes.
- backend/app/database.py: loads backend/.env and configures database engine/session.
- backend/app/models.py: ORM tables.
- backend/app/schemas.py: request/response validation.
- backend/app/risk.py: extraction and heuristic rules.
- backend/app/ocr.py: image validation/preprocessing/Tesseract.
- backend/app/rate_limit.py: process-local auth throttles.
- backend/alembic/: environment, template, versions 0001-0007.
- backend/tests/: test_account_scoping.py, test_auth_helpers.py, test_risk.py, test_sessions.py.
- backend/Dockerfile, backend/requirements.txt, backend/alembic.ini.
- frontend/src/App.jsx: main UI state/views/handlers.
- frontend/src/main.jsx: React entry point.
- frontend/src/components/PasswordInput.jsx.
- frontend/src/lib/api.js.
- frontend/src/styles/tokens.css and global.css.
- frontend/public/: brand icons, shield assets, dark/light symbols.
- frontend/vite.config.js, package.json, package-lock.json, index.html.
- docs/ARCHITECTURE.md; this docs/PROJECT_MASTER_BLUEPRINT.md.
- README.md, HANDOFF.md (historical), render.yaml, .gitignore, .dockerignore, editor/workspace files.

Frontend dependencies: React and React DOM ^18.3.1; Lucide React ^0.468.0; Vite ^6.0.5; @vitejs/plugin-react ^4.3.4. Backend requirements: FastAPI 0.115.6, Uvicorn 0.34.0, psycopg[binary] 3.2.3, SQLAlchemy 2.0.36, Alembic 1.20.0, pydantic-settings 2.7.0, python-dotenv 1.0.1, Authlib 1.9.1, cryptography >=44, httpx2 2.15.1, itsdangerous 2.2.0, python-multipart >=0.0.20, Pillow >=11, pytesseract >=0.3.13.

## 10. Local development and delivery

Windows prerequisites documented: Python 3.12+, Node/npm, PostgreSQL, Tesseract OCR with English language data.

Local process:
1. Start PostgreSQL and confirm the intended database.
2. Configure backend/.env privately from backend/.env.example. Do not share secrets.
3. Install requirements from backend using the project venv Python.
4. For an empty database only, apply alembic upgrade head. For an existing DB, inspect its schema/version first; never blindly stamp/upgrade.
5. From backend, run: .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
6. In a second terminal from frontend, run: npm run dev; open Vite's printed URL, typically http://localhost:5173/.
7. Ensure frontend proxy target matches backend port. Checked-in default is 8000; README and VS Code task use 8001. Do not reveal private local env values.
8. Keep PostgreSQL and both server processes running. API health is /health and interactive docs are /docs on backend port.

Existing backend suite (from backend): .\.venv\Scripts\python.exe -m unittest discover -s tests -v. There are 23 test methods in the four test modules. They cover risk/link/trusted-payee text rules; password/token helpers; session valid/expired/invalid behavior; account isolation for history/CSV/payees/stats/deletion and payee identifier type. README says DB tests use temporary in-memory SQLite, not the user's PostgreSQL. There are no dedicated MFA tests. Fresh suite result is pending.

Frontend build (from frontend): npm run build. Previously reported successful, but not rerun in this snapshot.

Git workflow: inspect current diff; make a focused change; run relevant existing checks; inspect diff/status again. Do not reset or discard local edits. Commit/push only when user asks. Deploy only with explicit authorization after build/config/health/full workflow checks.

## 11. Immediate continuation checklist

1. Read this blueprint and inspect live repo status/diff before edits. Preserve all current staged, unstaged, and untracked work.
2. Retry Google sign-in from a fresh click on a stable connection. Current observed error is browser ERR_NETWORK_CHANGED, not a confirmed Google configuration error. Do not ask for passwords, OTPs, recovery codes, OAuth secrets, or a full OAuth URL.
3. Confirm local proxy/backend port alignment safely (8000 Vite source default vs 8001 README/task).
4. Run the 23 existing backend unittest methods fresh and report exact results.
5. Continue systematic UI audit across desktop/mobile and light/dark modes. Specifically verify notification outside-click/Escape dismissal and Google connected Settings placement/link workflow, then test all controls, errors, loading/offline states, exports, CRUD, and navigation. Fix only verified issues in place.
6. Leave MFA E2E tests/work until user explicitly says to do MFA as the last feature/audit item.
7. Microsoft sign-in remains deferred. Logo/major UI redesign remains last; preserve themes, responsive layouts, integration behavior, and current user changes.
8. Do not commit, push, deploy, reset, or clean without explicit authorization. Do not expose private environment values.

## 12. Ready-to-paste continuation prompt

Copy the following into the new AI session after opening the CyberShield repository:

    Continue the existing CyberShield VerifyPay repository. First read docs/PROJECT_MASTER_BLUEPRINT.md, then inspect the live repository root, branch, Git status/diff, README.md, and relevant source before editing. Source and Git state outrank the snapshot if they differ. Root HANDOFF.md is older historical context with stale/conflicting notes.

    This is an educational payment-message review prototype: React 18/Vite frontend; FastAPI/Python API; PostgreSQL/SQLAlchemy/Alembic backend; Tesseract OCR; Authlib Google OIDC; latest migration source is 0007_totp_mfa. Risk scoring is deterministic heuristics, not an ML model, fraud verdict, payment verification, or live reputation check. URLs are inspected as text only. Raw payment/OCR text is not saved in PostgreSQL; only result summaries persist. Payment ID extraction is not implemented.

    Preserve the current workspace exactly. At snapshot, branch main HEAD 5e0417e; staged/unstaged edits exist in backend/app/main.py, ocr.py, risk.py, schemas.py, frontend/index.html, frontend/src/App.jsx, frontend/src/styles/global.css and staged new dark/light shield-symbol PNGs. output/ contains an untracked PDF/review artifacts. outputs/presentation-samples/ has three ignored fictional sample images. Do not reset/clean/overwrite/regenerate, commit, push, or deploy unless explicitly asked.

    Last-known status: user reported normal password sign-in succeeded after DB migration; old handoff reported local DB at migration 0007 head. Neither was rechecked in this snapshot. Frontend build and API health succeeded in earlier work, not rerun now. Latest Google OAuth attempt failed before Google rendered, with browser ERR_NETWORK_CHANGED; retry on a stable connection and do not call it an OAuth provider error without evidence. Local callback observed: http://localhost:5173/api/auth/oauth/google/callback. Vite proxy source defaults to port 8000, while README and VS Code tasks start backend on 8001; frontend/.env.local may override. Never reveal/read private .env values.

    Source includes password scrypt, hashed bearer/reset/verification/OAuth handoff/MFA challenge tokens, Google OIDC PKCE S256, account-scoped data, TOTP MFA (encrypted secret, stable TOTP_ENCRYPTION_KEY or OAUTH_SESSION_SECRET, one-use hashed recovery codes, replay prevention, 10-minute setup, 5-minute challenge, rate limits). MFA E2E is untested and explicitly deferred until the user says to do it last. Microsoft auth is deferred. Never request/enter user passwords, OTPs, recovery codes, or secrets.

    Views/features include sign-in/register/verification/reset; Overview; Verify a payment (upload/paste/manual/URL); result; Payment History; Trusted Payees; Learn & Protect; Emergency Mode; Profile; Settings (Google link/password/preferences/MFA/export/delete); global search/navigation; browser-local notifications; desktop/mobile and dark/light. Full UI audit is incomplete. Notification source has outside-pointer/Escape handlers; verify visually. Safety score is data-derived from up to the latest 10 scores; never hardcode. Language/currency only accepts en/INR; incident tracking and biometric/device management are placeholders/unavailable.

    Next: inspect Git state; retry Google OAuth on stable network; reconcile proxy port; run the 23 existing backend tests fresh and report exact outcomes; systematically audit all visible controls across desktop/mobile and themes, fix verified defects in place. Keep MFA until the final item and only proceed when the user tells you. Keep Microsoft deferred and logo/major UI redesign last. Do not deploy or commit. Report clearly what you inspected and tested, and keep all secrets private.
 
## 13. Tracked-file manifest at snapshot

This is the tracked source/configuration manifest reported by Git before this blueprint was added. Current local modifications described in section 7 apply to these paths. This new blueprint itself is untracked until staged by the user.

    .dockerignore
    .editorconfig
    .gitattributes
    .gitignore
    .vscode/extensions.json
    .vscode/settings.json
    .vscode/tasks.json
    .vscode/workspaces/CyberShield-Backend-and-Frontend.code-workspace
    .vscode/workspaces/CyberShield-MultiRoot.code-workspace
    CyberShield-VerifyPay.code-workspace
    HANDOFF.md
    README.md
    backend/.dockerignore
    backend/.env.example
    backend/Dockerfile
    backend/alembic.ini
    backend/alembic/env.py
    backend/alembic/script.py.mako
    backend/alembic/versions/0001_initial_schema.py
    backend/alembic/versions/0002_password_reset_tokens.py
    backend/alembic/versions/0003_profile_preferences_payee_metadata.py
    backend/alembic/versions/0004_email_verification.py
    backend/alembic/versions/0005_social_auth.py
    backend/alembic/versions/0006_payee_identifier_type.py
    backend/alembic/versions/0007_totp_mfa.py
    backend/app/__init__.py
    backend/app/database.py
    backend/app/main.py
    backend/app/models.py
    backend/app/ocr.py
    backend/app/rate_limit.py
    backend/app/risk.py
    backend/app/schemas.py
    backend/requirements.txt
    backend/tests/test_account_scoping.py
    backend/tests/test_auth_helpers.py
    backend/tests/test_risk.py
    backend/tests/test_sessions.py
    docs/ARCHITECTURE.md
    frontend/.env.example
    frontend/index.html
    frontend/package-lock.json
    frontend/package.json
    frontend/public/cybershield-shield.png
    frontend/public/cybershield-symbol-dark.png
    frontend/public/cybershield-symbol-light.png
    frontend/public/cybershield.svg
    frontend/src/App.jsx
    frontend/src/components/PasswordInput.jsx
    frontend/src/lib/api.js
    frontend/src/main.jsx
    frontend/src/styles/global.css
    frontend/src/styles/tokens.css
    frontend/vite.config.js
    render.yaml

Local private environment files are never part of this manifest and are not part of safe handoff material. Generated ignored demo samples and the generated untracked output directory must be copied separately if they are needed in the next workspace.
