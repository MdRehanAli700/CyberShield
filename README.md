# CyberShield VerifyPay

CyberShield VerifyPay is a payment-message review prototype. It lets a signed-in user submit payment text, a URL, or an image and review explainable warning signals before deciding what to do next.

> **Prototype notice:** VerifyPay is not a fraud detector and does not verify a payment, account owner, or live website reputation. Its rule-based signals can miss scams or flag ordinary messages. Confirm the payee and amount using a contact method you already trust. Use fake accounts and payment examples while demonstrating this project.

## Features

- Review pasted payment messages, payment links, and PNG, JPG, or WEBP images.
- Read uploaded images with Tesseract OCR.
- Show a preliminary low, medium, or high pattern signal with reasons and a suggested next step.
- Create an account, sign in and out, change a password, and keep each account's history and trusted payees separate.
- Search and filter history, export it as CSV, and switch between dark and light themes.
- Avoid saving the submitted text or OCR output; save a result summary for the signed-in account.

Email verification and forgotten-password recovery are not available yet. URL checks inspect text only and do not visit the submitted links.

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

4. Install Tesseract using the [official installation guide](https://github.com/tesseract-ocr/tessdoc/blob/main/Installation.md). If VerifyPay cannot find it, add the full path to `tesseract.exe` as `TESSERACT_CMD` in `backend/.env`.
5. Open another VS Code terminal in `frontend` and install the website packages:

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

The tests cover local risk-scoring rules, link warnings, trusted-payee text matching, password/token helpers, and valid or expired sessions using a temporary in-memory database. They do not connect to your PostgreSQL database. A successful run ends with `OK`.

## Environment files

- `backend/.env.example` documents the local PostgreSQL connection and optional Tesseract path.
- `frontend/.env.example` documents the optional API address for a hosted website and the local Vite proxy target.
- Copy each example to `.env` only when needed. Never commit passwords or connection strings.

The API creates missing database tables at startup. This prototype does not yet use database migrations.

## Hosting status

This repository is prepared for future hosting, but the app has not been published. A possible no-cost demo arrangement is a Render static site, a Render free API service, and a Neon free PostgreSQL database. The API may sleep when idle, and free-plan limits can interrupt access. Read the providers' current terms and limits before using them: [Render free services](https://render.com/docs/free) and [Neon plans](https://neon.com/pricing).

This setup is for learning and demonstrations, not a dependable production service. Do not use it for real payment decisions or sensitive production data.
