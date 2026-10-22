# CyberShield VerifyPay

CyberShield VerifyPay is a payment-message review prototype. It lets a signed-in user submit payment text, a URL, or an image and review explainable warning signals before deciding what to do next.

> **Prototype notice:** VerifyPay is not a fraud detector and does not verify a payment, account owner, or live website reputation. Its rule-based signals can miss scams or flag ordinary messages. Confirm the payee and amount using a contact method you already trust. Use fake accounts and payment examples while demonstrating this project.

## Features

- Review pasted payment messages, payment links, and PNG, JPG, or WEBP images.
- Read uploaded images with Tesseract OCR.
- Show a preliminary low, medium, or high pattern signal with reasons and a suggested next step.
- Create an account with email verification, sign in and out, change a password, and keep each account's history and trusted payees separate.
- Protect password and Google sign-in with authenticator-app codes and one-time recovery codes.
- Sign in with Google or Microsoft using OpenID Connect after provider app credentials are configured.
- Review recent payment-check notifications from the bell; notification history is stored locally in the current browser.
- Request an expiring, single-use password reset link by email.
- Search and filter history, export it as CSV, and switch between dark and light themes.
- Save each trusted payee's identifier type (UPI ID, bank account, or contact), then filter and sort the list.
- Avoid saving the submitted text or OCR output; save a result summary for the signed-in account.

Email verification and password reset emails use SMTP for local development or Brevo's HTTPS API when hosted; the selected email service must be configured before links can be delivered. Verification links expire after 30 minutes and can only be used once. Existing accounts remain verified when the migration is applied. Sign-up, sign-in, verification, and reset endpoints are throttled per client address, with an additional per-account cooldown for email sends. URL checks inspect text only and do not visit the submitted links.

Two-factor authentication can be enabled in **Settings → Password and sign-in**. Install an authenticator app, enter the setup key, verify its six-digit code, and save the recovery codes shown once. Before applying migration `0007_totp_mfa`, configure a stable random `TOTP_ENCRYPTION_KEY` in the backend environment (the existing `OAUTH_SESSION_SECRET` is used as a fallback). Keep the encryption key unchanged and private; changing it makes saved authenticator secrets unreadable. Apply the migration with `alembic upgrade head` from `backend` after confirming the database is already stamped at its current version. Do not stamp past a pending migration.

## How it is organized

```text
backend/       FastAPI service, PostgreSQL models, OCR, and risk rules
frontend/      React and Vite website
docs/          Project architecture notes
.vscode/       Helpful editor settings and extension suggestions
```

The browser sends requests to the FastAPI service. FastAPI validates and analyzes the submitted content, uses Tesseract for image text, and stores account-scoped summaries in PostgreSQL. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for more detail.

## Technology

| Area | Tools |
| --- | --- |
| Website | React, Vite, Lucide icons |
| API | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL, psycopg |
| Image text | Tesseract OCR, pytesseract, Pillow |

## Run it on Windows

### Requirements

- Python 3.12 or newer
- Node.js and npm
- PostgreSQL
- Tesseract OCR with English language data

### One-time setup

1. Start PostgreSQL. In pgAdmin, create a database named `VerifyPay`.
2. Open a VS Code terminal in `backend` and run:

   ```powershell
   py -m venv .venv
   Copy-Item .env.example .env
   notepad .env
   ```

   Replace `CHANGE_ME` in `DATABASE_URL` with your PostgreSQL password. Save and close Notepad. Keep `.env` private; Git ignores it.

3. In the same `backend` terminal, install the Python packages:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

4. Initialize the database schema before starting the API:

   - For the existing `VerifyPay` database used by this project, first make a database backup and confirm its tables match `alembic/versions/0001_initial_schema.py`. Then, from the `backend` terminal, run this once. It records the current schema version without creating or changing the tables:

     ```powershell
     .\.venv\Scripts\python.exe -m alembic stamp head
     ```

   - For a new, empty database, run this instead to create the tables from the migration files:

     ```powershell
     .\.venv\Scripts\python.exe -m alembic upgrade head
     ```

   For later model changes, generate a candidate migration from the `backend` terminal:

   ```powershell
   .\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "short description"
   ```

   Review the generated migration before applying it with `upgrade head`. Do not run `upgrade head` against the existing database before recording its baseline with `stamp head`; the initial migration would try to create tables that already exist.

5. Install Tesseract using the [official installation guide](https://github.com/tesseract-ocr/tessdoc/blob/main/Installation.md). If VerifyPay cannot find it, add the full path to `tesseract.exe` as `TESSERACT_CMD` in `backend/.env`.
6. To enable forgotten-password recovery locally, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM` in `backend/.env`. The hosted Render setup uses Brevo's HTTPS API with `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, and `SMTP_FROM`. Set `FRONTEND_URL` to the local website address or your deployed HTTPS frontend. Keep all mail credentials private; never commit `.env`.
7. To enable Google and Microsoft sign-in, first update backend dependencies with `python -m pip install -r requirements.txt`. Create an OAuth app for each provider. For local development, set `OAUTH_API_BASE_URL=http://localhost:5173` and register `http://localhost:5173/api/auth/oauth/google/callback` and `http://localhost:5173/api/auth/oauth/microsoft/callback`; Vite proxies these callbacks to the backend so the OAuth state cookie stays on the same local origin. Set a long, random `OAUTH_SESSION_SECRET` in `backend/.env`, then fill in the provider client IDs and secrets. For hosting, use HTTPS, configure `FRONTEND_URL`, and add `{API_BASE_URL}/api/auth/oauth/google/callback` and `{API_BASE_URL}/api/auth/oauth/microsoft/callback` to the provider registrations. Set `OAUTH_API_BASE_URL` to the public API URL and `OAUTH_COOKIE_SECURE=true`. Set `MICROSOFT_TENANT_ID` to the tenant GUID or domain registered for the Microsoft app; Microsoft sign-in is tenant-specific so the ID-token issuer can be checked exactly. Never commit provider secrets. See [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) and [Microsoft OpenID Connect](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc).
   - Provider identities are never silently attached to existing accounts. Sign in to the existing account first, then use **Settings → Google account** to link Google. Linking requires Google's verified email to match the VerifyPay account email. Microsoft account linking is not available yet.
   - In-app notifications cover completed payment checks only and are saved per account in the current browser. They are not push or email notifications.
   - The additive social sign-in migration is applied with `alembic upgrade head`. On an existing database, keep its recorded migration baseline and review the pending migration before applying it.
8. Open another VS Code terminal in `frontend` and install the website packages:

   ```powershell
   npm install
   ```

### Start the app

1. In the `backend` terminal, start the API and leave the terminal open:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
   ```

2. In the `frontend` terminal, start the website and leave that terminal open:

   ```powershell
   npm run dev
   ```

3. Open the local address Vite prints, usually <http://localhost:5173/>. If that port is busy, use the alternate address Vite prints.

The API status is available at <http://localhost:8001/health>; its interactive reference is at <http://localhost:8001/docs>. PostgreSQL, the API terminal, and the website terminal must remain running while you use the local app.

When you open the project folder in VS Code, approve its automatic tasks if prompted. The tasks in `.vscode/tasks.json` start the API and website in separate terminals. PostgreSQL must already be running.

## Run the backend tests

From the project root in a VS Code PowerShell terminal, run:

```powershell
Set-Location .\backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The tests cover local risk-scoring rules, link warnings, trusted-payee text matching, password/token helpers, valid or expired sessions, and account separation for history, exports, payees, statistics, and deletes. Database checks use a temporary in-memory SQLite database and do not connect to your PostgreSQL database. A successful run ends with `OK`.

## Environment files

- `backend/.env.example` documents the local PostgreSQL connection and optional Tesseract path.
- `frontend/.env.example` documents the optional API address for a hosted website and the local Vite proxy target.
- Copy each example to `.env` only when needed. Never commit passwords or connection strings.

Database changes are tracked in `backend/alembic/`. The API does not create tables at startup. For a fresh database, run the `upgrade head` command above. The deployment Docker image applies migrations before starting the API.

## Hosting status

The app has a Render Blueprint for a public demo. It serves the React site and API from one service, uses Neon for persistent PostgreSQL data, and uses Brevo's HTTPS API for reset emails. The deployment needs a GitHub repository, a Neon database connection string, and a Brevo API key and verified sender; secrets are entered in provider dashboards, not saved in this repository. Render's free web service can sleep after 15 minutes without traffic and may take about a minute to wake. Neon can pause its database compute when idle. Check the providers' current limits before inviting users: [Render free services](https://render.com/docs/free), [Neon plans](https://neon.com/pricing), and [Brevo free email limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

The deployed site is a public demo for learning. Do not submit real payment details, passwords used elsewhere, or sensitive personal information. VerifyPay is not a fraud detector or a production payment service. Authentication throttles are stored in each API process, so they are not shared across multiple service instances.

This setup is for learning and demonstrations, not a dependable production service. Do not use it for real payment decisions or sensitive production data.
