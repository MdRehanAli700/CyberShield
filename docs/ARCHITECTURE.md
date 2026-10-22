# Architecture

## Request flow

```text
React website  →  FastAPI API  →  PostgreSQL
                       └──────→  Tesseract OCR (image submissions)
```

The frontend is a Vite single-page application. `src/main.jsx` mounts the app and loads shared styles. `src/App.jsx` owns the signed-in experience and its page-level state. Reusable UI pieces live in `src/components/`; API URL and timeout helpers live in `src/lib/`.

The backend is a FastAPI application. It validates request and response shapes with Pydantic schemas, uses SQLAlchemy models and sessions for PostgreSQL, and keeps risk-pattern analysis and OCR in separate modules. The API stores user accounts, hashed passwords, hashed session tokens, payment-check summaries, and trusted payees. Raw payment text and OCR output are not stored in PostgreSQL.

For the hosted demo, the Docker image builds the frontend and serves it from FastAPI on the same origin. It applies reviewed Alembic migrations when the container starts. Account verification and password reset email use SMTP for local development or Brevo's HTTPS API for the free hosted service.

## Main folders

| Path | Responsibility |
| --- | --- |
| `frontend/src/App.jsx` | Main app state and page composition |
| `frontend/src/components/` | Reusable React interface components |
| `frontend/src/lib/` | Frontend API helpers |
| `frontend/src/styles/` | Shared design tokens and global styles |
| `frontend/public/` | Static assets such as the app icon |
| `backend/app/main.py` | FastAPI setup, authentication, and API routes |
| `backend/alembic/versions/0005_social_auth.py` | Provider identity and one-time OAuth handoff tables |
| `backend/alembic/versions/0006_payee_identifier_type.py` | Saved trusted-payee identifier type |
| `backend/app/models.py` | SQLAlchemy database tables |
| `backend/alembic/` | Versioned database schema migrations |
| `backend/app/schemas.py` | Pydantic request and response validation |
| `backend/app/risk.py` | Explainable text-based warning rules |
| `backend/app/ocr.py` | Image validation and Tesseract OCR |

## Important limits

- Risk levels are heuristic signals, not fraud verdicts or payment verification.
- URL checks inspect submitted text and do not visit or reputation-check a website.
- Alembic migration files track database schema changes. The API does not create tables at startup; initialize new databases with the migrations first.
- New accounts must use a short-lived, single-use email verification token before signing in. Existing accounts stay verified during migration.
- Password recovery uses separate short-lived, single-use reset tokens.
- Public authentication endpoints use per-client, per-process sliding-window limits; reset and verification emails also have per-account resend cooldowns.
- Google and Microsoft use Authlib OpenID Connect authorization-code flows. Provider identities are never silently attached to password accounts. Existing users can link Google from Settings after signing in; the callback validates the signed-in account, OAuth state, and Google's verified matching email. Normal callbacks issue short-lived, single-use handoff codes instead of placing VerifyPay bearer tokens in URLs.
- Payment-check notifications are browser-local and scoped to the signed-in account. They are not persisted on the server and do not generate external messages.
- The app is an educational prototype and is not ready for sensitive production data.
