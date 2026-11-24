import unittest
from unittest.mock import AsyncMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import main, models
from app.database import Base
from app.schemas import CheckCreate


class TextEvidenceRouteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = models.User(email="evidence-test@example.test", password_hash="test-hash")
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_text_check_returns_structured_evidence_and_legacy_fields(self):
        payload = CheckCreate(
            source_type="text",
            content=(
                "Amount: ₹2,500\nUPI ID: maya@ybl\nUTR: HDFC123456789\n"
                "Payee: Maya Rao\nDate: 2026-11-20\nTime: 14:35\nPayment successful"
            ),
        )
        result = main.create_check(payload, self.user, self.db)

        self.assertEqual(result["detected_amount"], "₹2,500")
        self.assertEqual(result["recipient_guess"], "Maya Rao")
        evidence = result["evidence"]
        self.assertTrue(evidence)
        self.assertTrue(all(item["verification_state"] == "DETECTED" for item in evidence))
        self.assertEqual({item["field"] for item in evidence}, {
            "amount", "currency", "upi_id", "transaction_id", "recipient", "date", "time", "payment_status"
        })

    def test_text_check_with_no_evidence_returns_empty_list(self):
        result = main.create_check(
            CheckCreate(source_type="text", content="Hello there"),
            self.user,
            self.db,
        )

        self.assertEqual(result["evidence"], [])

    def test_text_check_does_not_attribute_an_unlabeled_trusted_payee_mention(self):
        self.db.add(models.TrustedPayee(
            owner_key=str(self.user.id),
            name="Maya Rao",
            payment_identifier="maya@ybl",
            identifier_type="UPI",
            category="Personal",
        ))
        self.db.commit()

        result = main.create_check(
            CheckCreate(source_type="text", content="Maya Rao is an old payee."),
            self.user,
            self.db,
        )

        self.assertIsNone(result["recipient_guess"])
        self.assertIsNone(result["trusted_payee_match"])
        self.assertEqual(result["risk_score"], 50)
        self.assertFalse(any(item["field"] == "recipient" for item in result["evidence"]))
        self.assertTrue(any("Recipient details were not clear" in item for item in result["findings"]))

    def test_image_check_returns_structured_evidence_from_ocr_text(self):
        raw_text = (
            "Amount: INR 2,500\nUPI ID: maya@ybl\nUTR: HDFC123456789\n"
            "Payee: Maya Rao\nDate: 2026-11-20\nTime: 14:35\nPayment successful"
        )
        class ImmediateUpload:
            content_type = "image/png"

            async def read(self, _size):
                return b"mocked-image-bytes"

        upload = ImmediateUpload()
        with patch("app.main.run_in_threadpool", new=AsyncMock(return_value=raw_text)):
            result = self.run_to_completion(main.create_image_check(upload, self.user, self.db))

        self.assertEqual(result["source_type"], "file")
        self.assertEqual(
            {item["field"] for item in result["evidence"]},
            {"amount", "currency", "upi_id", "transaction_id", "recipient", "date", "time", "payment_status"},
        )
        self.assertTrue(all(item["verification_state"] == "DETECTED" for item in result["evidence"]))
        self.assertEqual(result["ocr_text_preview"], raw_text[:1200])

    def test_image_legacy_time_uses_same_bounded_text_as_evidence(self):
        raw_text = "x" * 12000 + " 14:35"

        class ImmediateUpload:
            content_type = "image/png"

            async def read(self, _size):
                return b"mocked-image-bytes"

        with patch("app.main.run_in_threadpool", new=AsyncMock(return_value=raw_text)):
            result = self.run_to_completion(
                main.create_image_check(ImmediateUpload(), self.user, self.db)
            )

        self.assertIsNone(result["detected_time"])
        self.assertFalse(any(item["field"] == "time" for item in result["evidence"]))

    @staticmethod
    def run_to_completion(coroutine):
        """Run this endpoint coroutine when all mocked awaits complete inline."""
        try:
            coroutine.send(None)
        except StopIteration as completed:
            return completed.value
        raise AssertionError("The mocked image route unexpectedly suspended.")


if __name__ == "__main__":
    unittest.main()
