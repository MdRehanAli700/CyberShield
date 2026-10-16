# CyberShield VerifyPay

CyberShield VerifyPay is a payment-message review prototype. It lets a signed-in user submit payment text, a URL, or an image and review explainable warning signals before deciding what to do next.

> **Prototype notice:** VerifyPay is not a fraud detector and does not verify a payment, account owner, or live website reputation. Its rule-based signals can miss scams or flag ordinary messages. Confirm the payee and amount using a contact method you already trust. Use fake accounts and payment examples while demonstrating this project.

## Features

- Review pasted payment messages, payment links, and PNG, JPG, or WEBP images.
- Read uploaded images with Tesseract OCR.
- Show a preliminary low, medium, or high pattern signal with reasons and a suggested next step.
- Create an account, sign in and out, change a password, and keep each account's history and trusted payees separate.
- Request an expiring, single-use password reset link by email.
- Search and filter history, export it as CSV, and switch between dark and light themes.
- Avoid saving the submitted text or OCR output; save a result summary for the signed-in account.

Email verification is not available yet. Password reset requires SMTP settings in `backend/.env`. URL checks inspect text only and do not visit the submitted links.

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
6. To enable forgotten-password recovery, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM` in `backend/.env`. Set `FRONTEND_URL` to the local website address or your deployed HTTPS frontend. Keep these settings private; never commit `.env`.
7. Open another VS Code terminal in `frontend` and install the website packages:

   ```powershell
   npm install
   ```

### Start the app

1. In the `backend` terminal, start the API and leave the terminal open:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
   ```

2. In the `frontend` terminal, start the website and leave that terminal open:

   ```powershell
   npm run dev
   ```

3. Open the local address Vite prints, usually <http://localhost:5173/>. If that port is busy, use the alternate address Vite prints.

The API status is available at <http://localhost:8000/health>; its interactive reference is at <http://localhost:8000/docs>. PostgreSQL, the API terminal, and the website terminal must remain running while you use the local app.

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

Database changes are tracked in `backend/alembic/`. The API does not create tables at startup; initialize a fresh database with the `upgrade head` command above and apply reviewed migrations before starting the API. The Docker image includes the migration files, but does not apply them automatically.

## Hosting status

This repository is prepared for future hosting, but the app has not been published. A possible no-cost demo arrangement is a Render static site, a Render free API service, and a Neon free PostgreSQL database. The API may sleep when idle, and free-plan limits can interrupt access. Read the providers' current terms and limits before using them: [Render free services](https://render.com/docs/free) and [Neon plans](https://neon.com/pricing).

This setup is for learning and demonstrations, not a dependable production service. Do not use it for real payment decisions or sensitive production data.
