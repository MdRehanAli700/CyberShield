import unittest
from types import SimpleNamespace

from app.risk import assess_payment, extract_amount, extract_recipient, find_trusted_payee, inspect_link


class RiskAnalysisTests(unittest.TestCase):
    def test_extracts_amount_and_recipient_from_clear_payment_text(self):
        message = "Amount: INR 1,250.00\nRecipient: Maya Rao"

        self.assertEqual(extract_amount(message), "INR 1,250.00")
        self.assertEqual(extract_recipient(message), "Maya Rao")

    def test_clear_payment_details_start_with_low_signal(self):
        level, score, explanation, amount, recipient, *_ = assess_payment(
            "text", "Amount: ₹500\nRecipient: Maya Rao"
        )

        self.assertEqual((level, score), ("low", 10))
        self.assertEqual(amount, "₹500")
        self.assertEqual(recipient, "Maya Rao")
        self.assertIn("does not verify", explanation)

    def test_otp_request_and_urgency_raise_score_to_high(self):
        level, score, explanation, *_ = assess_payment(
            "text",
            "Amount: ₹500\nRecipient: Maya Rao\nSend the OTP now, urgent!",
        )

        self.assertEqual((level, score), ("high", 100))
        self.assertIn("request a one-time code", explanation)
        self.assertIn("Urgent or pressure-based wording", explanation)

    def test_shortened_http_link_gets_link_warnings(self):
        domain, warnings, score = inspect_link("http://bit.ly/payment")

        self.assertEqual(domain, "bit.ly")
        self.assertEqual(score, 50)
        self.assertTrue(any("does not use HTTPS" in warning for warning in warnings))
        self.assertTrue(any("URL shortener" in warning for warning in warnings))

    def test_payment_and_security_wording_in_domain_is_flagged_cautiously(self):
        domain, warnings, score = inspect_link("https://pay-secure.example.com")

        self.assertEqual(domain, "pay-secure.example.com")
        self.assertEqual(score, 20)
        self.assertTrue(any("does not confirm fraud" in warning for warning in warnings))

    def test_unreadable_link_has_cautious_warning(self):
        domain, warnings, score = inspect_link("https://")

        self.assertIsNone(domain)
        self.assertEqual(score, 20)
        self.assertTrue(warnings)

    def test_only_first_five_distinct_links_are_checked(self):
        links = " ".join(f"https://site{number}.example" for number in range(6))
        *_, link_domain, findings, link_domains = assess_payment("text", links)

        self.assertEqual(len(link_domains), 5)
        self.assertEqual(link_domain, "site0.example")
        self.assertTrue(any("Only the first 5 distinct links" in finding for finding in findings))

    def test_trusted_payee_text_match_respects_word_boundaries(self):
        payees = [SimpleNamespace(name="Ann", payment_identifier="ann@example.test")]

        self.assertIsNone(find_trusted_payee("Pay Annabelle", payees))
        self.assertEqual(find_trusted_payee("Pay Ann today", payees), "Ann")


if __name__ == "__main__":
    unittest.main()
