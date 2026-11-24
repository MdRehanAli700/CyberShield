import unittest
from types import SimpleNamespace

from app.risk import (
    assess_payment,
    extract_amount,
    extract_payment_evidence,
    extract_recipient,
    extract_time,
    find_trusted_payee,
    inspect_link,
)
from app.schemas import CheckRead


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

    def test_currency_amount_baselines(self):
        examples = {
            "Send ₹2,500": "₹2,500",
            "Send Rs. 2,500": "Rs. 2,500",
            "Send INR 2,500": "INR 2,500",
            "Send %2,500": None,
            "Amount: 2,50,000": "Amount: 2,50,000",
        }
        for content, expected in examples.items():
            with self.subTest(content=content):
                self.assertEqual(extract_amount(content), expected)

    def test_first_amount_is_returned_and_multiple_amounts_are_reported(self):
        content = "Amount: ₹500, then pay ₹750"
        result = assess_payment("text", content)

        # Current extraction retains the separator comma after a currency match.
        self.assertEqual(result[3], "₹500,")
        self.assertTrue(any("More than one different amount" in finding for finding in result[7]))

    def test_phone_otp_date_and_arbitrary_long_number_are_not_amounts(self):
        examples = (
            "Call 9876543210",
            "Your OTP is 123456",
            "Date: 12/05/2026",
            "UTR: 123456789012345678",
        )
        for content in examples:
            with self.subTest(content=content):
                self.assertIsNone(extract_amount(content))

    def test_arbitrary_long_number_has_no_transaction_id_response_field(self):
        self.assertNotIn("transaction_id", CheckRead.model_fields)
        self.assertNotIn("utr", CheckRead.model_fields)
        self.assertNotIn("reference_number", CheckRead.model_fields)

    def test_missing_amount_is_reported_and_adds_current_score_weight(self):
        result = assess_payment("text", "Please send the payment today")

        self.assertEqual((result[0], result[1]), ("medium", 50))
        self.assertIsNone(result[3])
        self.assertTrue(any("No clear payment amount" in finding for finding in result[7]))

    def test_recipient_and_time_extraction_baselines(self):
        content = "Amount: INR 2,500\nRecipient: Maya Rao\nSent at 10:30 AM"

        self.assertEqual(extract_recipient(content), "Maya Rao")
        self.assertEqual(extract_time(content), "10:30 AM")
        self.assertIsNone(extract_time("Payment sent yesterday"))
        self.assertIsNone(extract_recipient("Send to"))

    def test_trusted_payee_identifier_match_returns_name_not_verified_owner(self):
        payees = [SimpleNamespace(name="Maya Rao", payment_identifier="maya@bank")]

        self.assertEqual(find_trusted_payee("UPI ID: maya@bank", payees), "Maya Rao")
        self.assertIsNone(find_trusted_payee("UPI ID: maya@banking", payees))

    def test_otp_request_and_urgency_have_separate_current_score_baselines(self):
        otp_result = assess_payment(
            "text", "Amount: INR 500\nRecipient: Maya Rao\nSend OTP now."
        )
        urgency_result = assess_payment(
            "text", "Amount: INR 500\nRecipient: Maya Rao\nSend immediately."
        )

        self.assertEqual((otp_result[0], otp_result[1]), ("high", 85))
        self.assertEqual((urgency_result[0], urgency_result[1]), ("medium", 40))

    def test_trusted_payee_mention_without_recipient_context_keeps_missing_recipient_penalty(self):
        payees = [SimpleNamespace(name="Maya Rao", payment_identifier="maya@ybl")]

        result = assess_payment("text", "Maya Rao is an old payee.", payees)

        self.assertIsNone(result[4])
        self.assertIsNone(result[5])
        self.assertEqual(result[1], 50)
        self.assertTrue(any("Recipient details were not clear" in finding for finding in result[7]))
        self.assertFalse(any("trusted-payee list" in finding for finding in result[7]))

    def test_actual_recipient_is_matched_to_trusted_payee(self):
        payees = [SimpleNamespace(name="Maya Rao", payment_identifier="maya@ybl")]

        result = assess_payment("text", "Amount: INR 500\nRecipient: Maya Rao", payees)
        evidence = extract_payment_evidence("Amount: INR 500\nRecipient: Maya Rao", payees)

        self.assertEqual(result[4:6], ("Maya Rao", "Maya Rao"))
        self.assertTrue(any(item.field == "recipient" and item.verification_state == "MATCHED" for item in evidence))

    def test_actual_recipient_not_in_trusted_payees_is_not_matched(self):
        payees = [SimpleNamespace(name="Maya Rao", payment_identifier="maya@ybl")]

        result = assess_payment("text", "Amount: INR 500\nRecipient: Alex Kumar", payees)

        self.assertEqual(result[4], "Alex Kumar")
        self.assertIsNone(result[5])
        self.assertFalse(any("trusted-payee list" in finding for finding in result[7]))

    def test_multiple_recipient_candidates_are_ambiguous_and_not_matched(self):
        payees = [SimpleNamespace(name="Maya Rao", payment_identifier="maya@ybl")]

        result = assess_payment(
            "text", "Amount: INR 500\nRecipient: Alex Kumar\nBeneficiary: Maya Rao", payees
        )

        self.assertIsNone(result[4])
        self.assertIsNone(result[5])
        self.assertEqual(result[1], 30)
        self.assertTrue(any("Recipient details were not clear" in finding for finding in result[7]))
        evidence = extract_payment_evidence(
            "Amount: INR 500\nRecipient: Alex Kumar\nBeneficiary: Maya Rao", payees
        )
        self.assertFalse(any(item.verification_state == "MATCHED" for item in evidence))

    def test_direct_secret_requests_still_trigger_the_existing_penalty(self):
        examples = (
            "Share your OTP with me.",
            "Send your verification code immediately.",
            "Tell me your banking PIN.",
            "Disclose your PIN to continue.",
        )
        for content in examples:
            with self.subTest(content=content):
                result = assess_payment("text", content)
                self.assertTrue(any("request a one-time code" in finding for finding in result[7]))

    def test_negated_secret_warnings_do_not_trigger_the_request_penalty(self):
        examples = (
            "Never share your OTP with anyone.",
            "Do not disclose your PIN.",
            "Banks will never ask for your password.",
        )
        for content in examples:
            with self.subTest(content=content):
                result = assess_payment("text", content)
                self.assertFalse(any("request a one-time code" in finding for finding in result[7]))

    def test_quoted_suspicious_and_educational_otp_content_is_not_a_live_request(self):
        examples = (
            'The message says, "Share your OTP to receive a reward."',
            "Security advice explains that scammers ask you to share your OTP.",
        )
        for content in examples:
            with self.subTest(content=content):
                result = assess_payment("text", content)
                self.assertFalse(any("request a one-time code" in finding for finding in result[7]))

    def test_secret_request_risk_score_baselines_remain_unchanged(self):
        direct = assess_payment(
            "text", "Amount: INR 500\nRecipient: Maya Rao\nSend OTP now."
        )
        protected = assess_payment(
            "text", "Amount: INR 500\nRecipient: Maya Rao\nNever share your OTP with anyone."
        )

        self.assertEqual((direct[0], direct[1]), ("high", 85))
        self.assertEqual((protected[0], protected[1]), ("low", 10))

    def test_rupee_ocr_substitution_baseline_increases_missing_amount_score(self):
        result = assess_payment("text", "Send %2,500 immediately to restore access.")

        self.assertIsNone(result[3])
        self.assertEqual((result[0], result[1]), ("high", 80))
        self.assertTrue(any("No clear payment amount" in finding for finding in result[7]))

    def test_representative_risk_inputs_are_deterministic(self):
        examples = (
            ("text", "Amount: ₹500\nRecipient: Maya Rao", 10),
            ("text", "Amount: INR 500\nRecipient: Maya Rao\nSend OTP now.", 85),
            ("text", "Amount: INR 500\nRecipient: Maya Rao\nSend immediately.", 40),
            ("url", "https://bit.ly/pay", 75),
        )
        for source_type, content, expected_score in examples:
            with self.subTest(source_type=source_type, content=content):
                first = assess_payment(source_type, content)
                second = assess_payment(source_type, content)
                self.assertEqual(first, second)
                self.assertEqual(first[1], expected_score)

    def test_structured_evidence_extracts_supported_payment_fields(self):
        content = (
            "Amount: INR 2,500\nUPI ID: maya@ybl\nUTR: HDFC123456789\n"
            "Payee: Maya Rao\nDate: 2026-11-20\nTime: 14:35\n"
            "Payment status: Processing"
        )

        evidence = extract_payment_evidence(content)
        by_field = {}
        for item in evidence:
            by_field.setdefault(item.field, []).append(item)

        self.assertEqual(
            set(by_field),
            {"amount", "currency", "upi_id", "transaction_id", "recipient", "date", "time", "payment_status"},
        )
        self.assertEqual(by_field["amount"][0].value, "INR 2,500")
        self.assertEqual(by_field["amount"][0].normalized_value, "2500")
        self.assertEqual(by_field["currency"][0].normalized_value, "INR")
        self.assertEqual(by_field["upi_id"][0].value, "maya@ybl")
        self.assertEqual(by_field["transaction_id"][0].value, "HDFC123456789")
        self.assertEqual(by_field["date"][0].normalized_value, "2026-11-20")
        self.assertEqual(by_field["time"][0].value, "14:35")
        self.assertEqual(by_field["payment_status"][0].verification_state, "DETECTED")

    def test_multiple_amounts_are_preserved_in_source_order(self):
        evidence = extract_payment_evidence("Amount: ₹500; fee ₹25; total INR 525")
        amounts = [item for item in evidence if item.field == "amount"]

        self.assertEqual([item.value for item in amounts], ["₹500", "₹25", "INR 525"])

    def test_amount_extraction_ignores_phone_otp_and_unlabeled_numbers(self):
        evidence = extract_payment_evidence(
            "Call 9876543210. OTP 123456. Reference number 987654321012345678."
        )

        self.assertEqual(evidence, [])

    def test_invalid_or_incomplete_upi_ids_are_ignored(self):
        content = "UPI ID: maya@ UPI ID: a@ybl UPI ID: maya..rao@ybl UPI ID: maya@bank.in"

        evidence = [item for item in extract_payment_evidence(content) if item.field == "upi_id"]

        self.assertEqual(evidence, [])

    def test_labeled_transaction_reference_formats_are_extracted(self):
        content = "UTR: 123456789012; Transaction ID = TXN-AB123456; Reference No: REF/ABC12345"

        evidence = [item for item in extract_payment_evidence(content) if item.field == "transaction_id"]

        self.assertEqual(
            [item.value for item in evidence],
            ["123456789012", "TXN-AB123456", "REF/ABC12345"],
        )
        self.assertIsNone(
            next((item for item in extract_payment_evidence("Call 987654321012345678") if item.field == "transaction_id"), None)
        )

    def test_dates_and_times_are_separate_and_ambiguous_date_is_not_normalized(self):
        content = "Date: 12/05/2026; paid on 20 Nov 2026 at 10:30 PM and 14:35:20"

        evidence = extract_payment_evidence(content)
        dates = [item for item in evidence if item.field == "date"]
        times = [item for item in evidence if item.field == "time"]

        self.assertEqual([item.value for item in dates], ["12/05/2026", "20 Nov 2026"])
        self.assertIsNone(dates[0].normalized_value)
        self.assertEqual(dates[1].normalized_value, "2026-11-20")
        self.assertEqual([item.value for item in times], ["10:30 PM", "14:35:20"])

    def test_payment_status_is_wording_only(self):
        evidence = extract_payment_evidence(
            "Payment successful; transaction pending; status: failed; processing the refund"
        )
        statuses = [item for item in evidence if item.field == "payment_status"]

        self.assertEqual([item.value for item in statuses], ["Payment successful", "transaction pending", "status: failed"])
        self.assertTrue(all(item.verification_state == "DETECTED" for item in statuses))
        self.assertEqual(extract_payment_evidence("The presentation was successful."), [])

    def test_evidence_snippets_are_bounded_and_states_are_not_auto_verified(self):
        content = "Amount: ₹500 " + ("context " * 80)
        evidence = extract_payment_evidence(content)

        self.assertTrue(evidence)
        self.assertTrue(all(item.source_snippet is None or len(item.source_snippet) <= 240 for item in evidence))
        self.assertTrue(all(item.verification_state == "DETECTED" for item in evidence))

    def test_trusted_payee_text_match_is_matched_not_verified(self):
        payees = [SimpleNamespace(name="Maya Rao", payment_identifier="maya@ybl")]

        evidence = extract_payment_evidence("Payee: Maya Rao; UPI ID: maya@ybl", payees)
        matched = [item for item in evidence if item.verification_state == "MATCHED"]

        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].field, "recipient")
        self.assertEqual(matched[0].value, "Maya Rao")
        self.assertEqual(matched[0].source_snippet, "Payee: Maya Rao; UPI ID: maya@ybl")
        self.assertFalse(any(item.verification_state == "VERIFIED" for item in evidence))

    def test_no_supported_content_returns_empty_evidence(self):
        self.assertEqual(extract_payment_evidence("Hello there"), [])

    def test_trusted_payee_mention_unrelated_to_recipient_is_not_matched(self):
        payees = [SimpleNamespace(name="Maya Rao", payment_identifier="maya@ybl")]

        evidence = extract_payment_evidence(
            "Recipient: Alex Kumar. Maya Rao is an old payee.", payees
        )

        recipients = [item for item in evidence if item.field == "recipient"]
        self.assertEqual([(item.value, item.verification_state) for item in recipients], [("Alex Kumar", "DETECTED")])

    def test_multiple_recipient_candidates_are_detected_without_trusted_match(self):
        payees = [SimpleNamespace(name="Maya Rao", payment_identifier="maya@ybl")]

        evidence = extract_payment_evidence(
            "Recipient: Alex Kumar\nBeneficiary: Maya Rao", payees
        )

        recipients = [item for item in evidence if item.field == "recipient"]
        self.assertEqual([item.value for item in recipients], ["Alex Kumar", "Maya Rao"])
        self.assertTrue(all(item.verification_state == "DETECTED" for item in recipients))
        self.assertTrue(all(item.quality == "low" for item in recipients))

    def test_valid_upi_id_with_terminal_period_is_extracted_without_period(self):
        evidence = [
            item for item in extract_payment_evidence("UPI ID: maya@ybl.")
            if item.field == "upi_id"
        ]

        self.assertEqual([item.value for item in evidence], ["maya@ybl"])

    def test_suffix_currency_is_extracted_without_duplicate_amounts(self):
        after = extract_payment_evidence("Amount: 2,500 INR")
        before = extract_payment_evidence("Amount: INR 2,500")

        after_amounts = [item for item in after if item.field == "amount"]
        after_currencies = [item for item in after if item.field == "currency"]
        before_amounts = [item for item in before if item.field == "amount"]
        before_currencies = [item for item in before if item.field == "currency"]
        self.assertEqual([(item.value, item.normalized_value) for item in after_amounts], [("2,500", "2500")])
        self.assertEqual([(item.value, item.normalized_value) for item in after_currencies], [("INR", "INR")])
        self.assertEqual(len(before_amounts), 1)
        self.assertEqual(len(before_currencies), 1)

    def test_date_inside_utr_is_not_extracted_as_payment_date(self):
        evidence = extract_payment_evidence("UTR: 12/05/2026")

        self.assertFalse(any(item.field == "date" for item in evidence))
        self.assertFalse(any(item.field == "transaction_id" for item in evidence))
        self.assertEqual(
            [item.value for item in extract_payment_evidence("Payment date: 12/05/2026") if item.field == "date"],
            ["12/05/2026"],
        )

    def test_recipient_repeated_spaces_are_normalized_to_single_spaces(self):
        recipient = extract_recipient("Recipient: Maya   Rao")
        evidence = [
            item for item in extract_payment_evidence("Recipient: Maya   Rao")
            if item.field == "recipient"
        ]

        self.assertEqual(recipient, "Maya Rao")
        self.assertEqual([item.value for item in evidence], ["Maya Rao"])

    def test_recipient_snippet_uses_the_labeled_occurrence(self):
        content = "Maya Rao was listed earlier.\nRecipient: Maya Rao"

        evidence = [item for item in extract_payment_evidence(content) if item.field == "recipient"]

        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0].source_snippet, "Recipient: Maya Rao")


if __name__ == "__main__":
    unittest.main()
