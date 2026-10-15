# Architecture

## Request flow

```text
React website  →  FastAPI API  →  PostgreSQL
                       └──────→  Tesseract OCR (image submissions)
```

The frontend is a Vite single-page application. `src/main.jsx` mounts the app and loads shared styles. `src/App.jsx` owns the signed-in experience and its page-level state. Reusable UI pieces live in `src/components/`; API URL and timeout helpers live in `src/lib/`.

The backend is a FastAPI application. It validates request and response shapes with Pydantic schemas, uses SQLAlchemy models and sessions for PostgreSQL, and keeps risk-pattern analysis and OCR in separate modules. The API stores user accounts, hashed passwords, hashed session tokens, payment-check summaries, and trusted payees. Raw payment text and OCR output are not stored in PostgreSQL.

## Main folders

| Path | Responsibility |
| --- | --- |
| `frontend/src/App.jsx` | Main app state and page composition |
| `frontend/src/components/` | Reusable React interface components |
| `frontend/src/lib/` | Frontend API helpers |
| `frontend/src/styles/` | Shared design tokens and global styles |
| `frontend/public/` | Static assets such as the app icon |
| `backend/app/main.py` | FastAPI setup, authentication, and API routes |
| `backend/app/models.py` | SQLAlchemy database tables |
| `backend/app/schemas.py` | Pydantic request and response validation |
| `backend/app/risk.py` | Explainable text-based warning rules |
| `backend/app/ocr.py` | Image validation and Tesseract OCR |

## Important limits

- Risk levels are heuristic signals, not fraud verdicts or payment verification.
- URL checks inspect submitted text and do not visit or reputation-check a website.
- Database tables are created at startup; schema migrations are not configured yet.
- Email verification and forgotten-password recovery are not implemented.
- The app is an educational prototype and is not ready for sensitive production data.
