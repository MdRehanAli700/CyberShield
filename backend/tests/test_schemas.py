import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from app.schemas import CheckRead, EvidenceItem


class EvidenceSchemaTests(unittest.TestCase):
    def test_valid_evidence_item(self):
        item = EvidenceItem(
            field="amount",
            value="₹2,500",
            normalized_value="2500",
            source_snippet="Paid ₹2,500 to Maya",
            extraction_method="currency_amount_pattern",
            quality="high",
            verification_state="DETECTED",
        )

        self.assertEqual(item.field, "amount")
        self.assertEqual(item.normalized_value, "2500")
        self.assertEqual(item.verification_state, "DETECTED")

    def test_optional_evidence_fields_can_be_omitted(self):
        item = EvidenceItem(
            field="upi_id",
            value="maya@bank",
            extraction_method="labeled_upi_pattern",
            verification_state="MATCHED",
        )

        self.assertIsNone(item.normalized_value)
        self.assertIsNone(item.source_snippet)
        self.assertIsNone(item.quality)

    def test_verification_state_is_required(self):
        with self.assertRaises(ValidationError):
            EvidenceItem(
                field="email",
                value="maya@example.test",
                extraction_method="email_pattern",
            )

    def test_verified_state_can_only_be_supplied_explicitly(self):
        item = EvidenceItem(
            field="amount",
            value="₹2,500",
            extraction_method="authoritative_provider_reference",
            verification_state="VERIFIED",
        )

        self.assertEqual(item.verification_state, "VERIFIED")

    def test_invalid_verification_state_is_rejected(self):
        with self.assertRaises(ValidationError):
            EvidenceItem(
                field="transaction_id",
                value="REF-123456",
                extraction_method="labeled_reference_pattern",
                verification_state="CONFIRMED",
            )

    def test_source_snippet_is_length_bounded(self):
        with self.assertRaises(ValidationError):
            EvidenceItem(
                field="recipient",
                value="Maya Rao",
                source_snippet="x" * 241,
                extraction_method="recipient_label_pattern",
                verification_state="DETECTED",
            )

    def test_check_read_defaults_evidence_to_empty_list(self):
        response = CheckRead(
            id=1,
            source_type="text",
            input_label="Pasted payment details",
            risk_level="low",
            risk_score=10,
            explanation="Preliminary pattern score",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )

        self.assertEqual(response.evidence, [])

    def test_check_read_preserves_existing_response_fields(self):
        response = CheckRead(
            id=7,
            source_type="file",
            input_label="Uploaded receipt image",
            risk_level="medium",
            risk_score=40,
            explanation="Existing explanation",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            ocr_text_preview="Paid INR 500",
            detected_amount="INR 500",
            detected_time="10:30 AM",
            recipient_guess="Maya Rao",
            trusted_payee_match="Maya Rao",
            link_domain="example.test",
            link_domains=["example.test"],
            findings=["Existing finding"],
            recommended_action="Confirm independently",
        )

        self.assertEqual(response.detected_amount, "INR 500")
        self.assertEqual(response.detected_time, "10:30 AM")
        self.assertEqual(response.recipient_guess, "Maya Rao")
        self.assertEqual(response.trusted_payee_match, "Maya Rao")
        self.assertEqual(response.link_domain, "example.test")
        self.assertEqual(response.findings, ["Existing finding"])
        self.assertEqual(response.recommended_action, "Confirm independently")
        self.assertEqual(response.evidence, [])


if __name__ == "__main__":
    unittest.main()
