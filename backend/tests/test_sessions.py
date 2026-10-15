from datetime import datetime, timedelta, timezone
import unittest

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models
from app.database import Base
from app.main import get_current_user, token_digest


class SessionAuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_session(self, token, expires_at):
        user = models.User(email="test@example.test", password_hash="test-hash")
        self.db.add(user)
        self.db.flush()
        self.db.add(
            models.UserSession(
                user_id=user.id,
                token_hash=token_digest(token),
                expires_at=expires_at,
            )
        )
        self.db.commit()
        return user

    def test_valid_bearer_token_returns_its_user(self):
        token = "valid-test-token"
        expected_user = self.add_session(token, datetime.now(timezone.utc) + timedelta(minutes=5))
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        actual_user = get_current_user(credentials=credentials, db=self.db)

        self.assertEqual(actual_user.id, expected_user.id)

    def test_expired_bearer_token_is_rejected(self):
        token = "expired-test-token"
        self.add_session(token, datetime.now(timezone.utc) - timedelta(minutes=5))
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        with self.assertRaises(HTTPException) as raised:
            get_current_user(credentials=credentials, db=self.db)

        self.assertEqual(raised.exception.status_code, 401)

    def test_invalid_bearer_token_is_rejected(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="unknown-token")

        with self.assertRaises(HTTPException) as raised:
            get_current_user(credentials=credentials, db=self.db)

        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
