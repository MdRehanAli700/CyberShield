from datetime import datetime, timezone
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models
from app.database import Base
from app.main import delete_check, delete_payee, export_checks, get_stats, list_checks, list_payees


class AccountScopingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.owner = self.add_user("owner@example.test")
        self.other_user = self.add_user("other@example.test")

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_user(self, email):
        user = models.User(email=email, password_hash="test-hash")
        self.db.add(user)
        self.db.flush()
        return user

    def add_check(self, owner, label):
        check = models.PaymentCheck(
            owner_key=str(owner.id),
            source_type="text",
            input_label=label,
            risk_level="low",
            risk_score=10,
            explanation=f"Review details for {label}.",
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(check)
        self.db.flush()
        return check

    def add_payee(self, owner, name):
        payee = models.TrustedPayee(
            owner_key=str(owner.id),
            name=name,
            payment_identifier=f"{name.casefold()}@example.test",
        )
        self.db.add(payee)
        self.db.flush()
        return payee

    def test_history_lists_only_the_current_users_checks(self):
        own_check = self.add_check(self.owner, "Owner payment")
        self.add_check(self.other_user, "Other user's private payment")

        results = list_checks(
            limit=10,
            offset=0,
            risk_level=None,
            source_type=None,
            search=None,
            current_user=self.owner,
            db=self.db,
        )

        self.assertEqual([check.id for check in results], [own_check.id])

    def test_csv_export_contains_only_the_current_users_checks(self):
        self.add_check(self.owner, "Owner payment")
        self.add_check(self.other_user, "Other user's private payment")

        response = export_checks(
            risk_level=None,
            source_type=None,
            search=None,
            current_user=self.owner,
            db=self.db,
        )

        self.assertIn("Owner payment", response.body.decode("utf-8-sig"))
        self.assertNotIn("Other user's private payment", response.body.decode("utf-8-sig"))

    def test_trusted_payee_list_contains_only_the_current_users_payees(self):
        own_payee = self.add_payee(self.owner, "Maya")
        self.add_payee(self.other_user, "Private Other Payee")

        results = list_payees(current_user=self.owner, db=self.db)

        self.assertEqual([payee.id for payee in results], [own_payee.id])

    def test_stats_count_only_the_current_users_records(self):
        self.add_check(self.owner, "Owner payment")
        self.add_check(self.other_user, "Other payment")
        self.add_payee(self.owner, "Maya")
        self.add_payee(self.other_user, "Other Payee")

        self.assertEqual(get_stats(current_user=self.owner, db=self.db), {"checks": 1, "trusted_payees": 1})

    def test_user_cannot_delete_another_users_check(self):
        other_check = self.add_check(self.other_user, "Other user's private payment")

        with self.assertRaises(HTTPException) as raised:
            delete_check(check_id=other_check.id, current_user=self.owner, db=self.db)

        self.assertEqual(raised.exception.status_code, 404)
        self.assertIsNotNone(self.db.get(models.PaymentCheck, other_check.id))

    def test_user_cannot_delete_another_users_payee(self):
        other_payee = self.add_payee(self.other_user, "Other Payee")

        with self.assertRaises(HTTPException) as raised:
            delete_payee(payee_id=other_payee.id, current_user=self.owner, db=self.db)

        self.assertEqual(raised.exception.status_code, 404)
        self.assertIsNotNone(self.db.get(models.TrustedPayee, other_payee.id))


if __name__ == "__main__":
    unittest.main()
