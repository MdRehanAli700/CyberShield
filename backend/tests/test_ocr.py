from io import BytesIO
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException, UploadFile
from PIL import Image
from starlette.datastructures import Headers
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import main, models, ocr
from app.ocr import OcrPassResult, _clean_ocr_results, _normalize_currency_symbols
from app.database import Base
from app.risk import assess_payment


def make_image_bytes(image_format="PNG", size=(80, 40), mode="RGB", color=(120, 121, 122), exif=None):
    image = Image.new(mode, size, color)
    output = BytesIO()
    save_options = {"format": image_format}
    if exif is not None:
        save_options["exif"] = exif
    image.save(output, **save_options)
    return output.getvalue()


class OcrImageTests(unittest.TestCase):
    def run_mocked_ocr(self, image_bytes, outputs=("Readable payment text", "Readable payment text")):
        with patch.object(ocr.pytesseract, "image_to_string", side_effect=outputs) as recognize:
            result = ocr.image_to_text(image_bytes)
        return result, recognize

    def test_accepts_png_jpeg_and_webp_images(self):
        for image_format in ("PNG", "JPEG", "WEBP"):
            with self.subTest(image_format=image_format):
                result, recognize = self.run_mocked_ocr(make_image_bytes(image_format))
                self.assertEqual(result, "Readable payment text")
                self.assertEqual(recognize.call_count, 2)

    def test_invalid_image_bytes_raise_unreadable_image(self):
        with self.assertRaises(ocr.UnreadableImageError):
            ocr.image_to_text(b"not an image")

    def test_image_content_does_not_need_a_client_supplied_mime_type(self):
        # MIME validation is performed by the API route; the OCR helper validates
        # the actual image bytes through Pillow.
        result, _ = self.run_mocked_ocr(make_image_bytes("PNG"))
        self.assertEqual(result, "Readable payment text")

    def test_excessive_decoded_pixel_count_is_rejected_before_ocr(self):
        class OversizedImage:
            width = 8_000
            height = 6_000

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def verify(self):
                raise AssertionError("pixel limit should be checked before verify")

        with patch.object(ocr.Image, "open", return_value=OversizedImage()), patch.object(
            ocr.pytesseract, "image_to_string"
        ) as recognize:
            with self.assertRaises(ocr.ImageTooLargeError):
                ocr.image_to_text(b"placeholder")
        recognize.assert_not_called()

    def test_exif_orientation_grayscale_autocontrast_and_small_image_upscale(self):
        exif = Image.Exif()
        exif[274] = 6  # Rotate a portrait source to landscape.
        source_image = Image.new("RGB", (40, 80))
        source_image.putdata(
            [(100 + (x % 2), 100 + (x % 2), 100 + (x % 2)) for y in range(80) for x in range(40)]
        )
        output = BytesIO()
        source_image.save(output, format="JPEG", quality=100, exif=exif)
        source = output.getvalue()
        seen_images = []

        def recognize(image, **_kwargs):
            seen_images.append(image.copy())
            return "Readable payment text"

        with patch.object(ocr.pytesseract, "image_to_string", side_effect=recognize):
            ocr.image_to_text(source)

        self.assertEqual(len(seen_images), 2)
        processed = seen_images[0]
        self.assertEqual(processed.mode, "L")
        self.assertEqual(processed.size, (240, 120))
        self.assertEqual(processed.getextrema(), (0, 255))
        self.assertEqual(seen_images[1].size, processed.size)

    def test_tesseract_uses_psm_6_then_psm_11_with_english_and_timeout(self):
        _, recognize = self.run_mocked_ocr(make_image_bytes())
        self.assertEqual(
            [item.kwargs for item in recognize.call_args_list],
            [
                {"lang": "eng", "config": "--psm 6", "timeout": ocr.OCR_TIMEOUT_SECONDS},
                {"lang": "eng", "config": "--psm 11", "timeout": ocr.OCR_TIMEOUT_SECONDS},
            ],
        )

    def test_identical_complete_ocr_outputs_are_returned_once(self):
        result, _ = self.run_mocked_ocr(make_image_bytes(), ("Same text", "Same text"))
        self.assertEqual(result, "Same text")

    def test_partially_overlapping_ocr_outputs_remove_shared_lines_in_order(self):
        first = "Amount: INR 500\nRecipient: Maya Rao"
        second = "Recipient: Maya Rao\nDate: 01/02/2026"
        result, _ = self.run_mocked_ocr(make_image_bytes(), (first, second))
        self.assertEqual(result, "Amount: INR 500\nRecipient: Maya Rao\nDate: 01/02/2026")

    def test_whitespace_differences_do_not_prevent_cross_pass_deduplication(self):
        result, _ = self.run_mocked_ocr(
            make_image_bytes(), ("Amount: INR 500", "Amount:  INR 500 ")
        )
        self.assertEqual(result, "Amount: INR 500")

    def test_punctuation_spacing_is_normalized_for_comparison_only(self):
        first = "UTR/ Transaction Ref: REF-ABC-123"
        second = "UTR / Transaction Ref: REF-ABC-123"
        result, _ = self.run_mocked_ocr(make_image_bytes(), (first, second))

        self.assertEqual(result, first)

    def test_meaningful_punctuation_difference_keeps_both_lines(self):
        first = "Reference: AB/123"
        second = "Reference: AB-123"
        result, _ = self.run_mocked_ocr(make_image_bytes(), (first, second))

        self.assertEqual(result, f"{first}\n{second}")

    def test_meaningfully_different_lines_are_both_preserved(self):
        result, _ = self.run_mocked_ocr(
            make_image_bytes(), ("Amount: INR 500", "Amount: INR 5,000")
        )
        self.assertEqual(result, "Amount: INR 500\nAmount: INR 5,000")

    def test_intentionally_repeated_paragraphs_inside_one_output_are_preserved(self):
        repeated = "Pay Maya Rao INR 500\n\nPay Maya Rao INR 500"
        result, _ = self.run_mocked_ocr(make_image_bytes(), (repeated, ""))
        self.assertEqual(result, repeated)

    def test_repeated_lines_in_the_later_psm_output_are_not_collapsed(self):
        first = "Recipient: Maya Rao"
        repeated = "Recipient: Maya Rao\nRecipient: Maya Rao"
        results = (
            OcrPassResult(psm=6, raw_text=first),
            OcrPassResult(psm=11, raw_text=repeated),
        )

        self.assertEqual(
            _clean_ocr_results(results),
            "Recipient: Maya Rao\nRecipient: Maya Rao",
        )

    def test_empty_output_from_either_or_both_psm_passes_is_handled(self):
        only_layout = _clean_ocr_results(
            (OcrPassResult(6, ""), OcrPassResult(11, "Layout text"))
        )
        only_primary = _clean_ocr_results(
            (OcrPassResult(6, "Primary text"), OcrPassResult(11, ""))
        )
        both_empty = _clean_ocr_results(
            (OcrPassResult(6, ""), OcrPassResult(11, "  \n "))
        )

        self.assertEqual(only_layout, "Layout text")
        self.assertEqual(only_primary, "Primary text")
        self.assertEqual(both_empty, "")

    def test_raw_psm_outputs_remain_unchanged_after_cleaning(self):
        raw_primary = "Send %2,500 immediately"
        raw_layout = "Send %2,500 immediately\nRecipient Maya Rao"
        results = (
            OcrPassResult(6, raw_primary),
            OcrPassResult(11, raw_layout),
        )

        cleaned = _clean_ocr_results(results)

        self.assertEqual(results[0].raw_text, raw_primary)
        self.assertEqual(results[1].raw_text, raw_layout)
        self.assertEqual(cleaned, "Send ₹2,500 immediately\nRecipient Maya Rao")

    def test_rupee_substitution_is_corrected_in_payment_context(self):
        result = _normalize_currency_symbols(
            "Send %2,500 immediately to restore access.\nAmount: % 2,50,000"
        )
        self.assertEqual(
            result,
            "Send ₹2,500 immediately to restore access.\nAmount: ₹2,50,000",
        )

    def test_legitimate_percentage_expressions_are_preserved(self):
        content = "Discount 10%; service fee 5.5%; confidence is 25%. Send ₹2,500."
        self.assertEqual(_normalize_currency_symbols(content), content)

    def test_ambiguous_percent_amount_and_ordinary_text_are_preserved(self):
        examples = (
            "%2,500 appeared in the scan",
            "The symbol % is visible in ordinary text",
            "A 10% discount applies",
        )
        for content in examples:
            with self.subTest(content=content):
                self.assertEqual(_normalize_currency_symbols(content), content)

    def test_dollar_amount_with_explicit_inr_context_is_corrected(self):
        content = "Amount (INR): $2,500"
        self.assertEqual(_normalize_currency_symbols(content), "Amount (INR): ₹2,500")

    def test_dollar_amount_with_explicit_usd_context_is_preserved(self):
        examples = (
            "Amount (USD): $2,500",
            "$2,500 US dollars",
        )
        for content in examples:
            with self.subTest(content=content):
                self.assertEqual(_normalize_currency_symbols(content), content)

    def test_ambiguous_dollar_amount_is_preserved(self):
        content = "Amount: $2,500"
        self.assertEqual(_normalize_currency_symbols(content), content)

    def test_nearby_unrelated_inr_amount_does_not_relabel_a_dollar_amount(self):
        content = "INR 1,250; separate USD amount: $2,500"
        self.assertEqual(_normalize_currency_symbols(content), content)

    def test_ocr_pipeline_returns_corrected_text_without_mutating_raw_result(self):
        first = "Send %2,500 immediately"
        second = "Send %2,500 immediately"
        result, _ = self.run_mocked_ocr(make_image_bytes(), (first, second))

        self.assertEqual(result, "Send ₹2,500 immediately")
        self.assertEqual(first, "Send %2,500 immediately")
        self.assertEqual(second, "Send %2,500 immediately")

    def test_contextual_currency_correction_reaches_existing_amount_extractor(self):
        cleaned, _ = self.run_mocked_ocr(
            make_image_bytes(),
            ("Send %2,500 to Maya Rao", "Send %2,500 to Maya Rao"),
        )

        self.assertEqual(assess_payment("file", cleaned)[3], "₹2,500")

    def test_tesseract_timeout_is_translated(self):
        with patch.object(ocr.pytesseract, "image_to_string", side_effect=RuntimeError("timeout")):
            with self.assertRaises(ocr.OcrTimeoutError):
                ocr.image_to_text(make_image_bytes())

    def test_tesseract_execution_error_is_translated(self):
        from pytesseract import TesseractError

        error = TesseractError(1, "recognizer failed")
        with patch.object(ocr.pytesseract, "image_to_string", side_effect=error):
            with self.assertRaises(ocr.OcrUnavailableError):
                ocr.image_to_text(make_image_bytes())


class ImageCheckEndpointTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = models.User(email="ocr-test@example.test", password_hash="test-hash")
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def upload(self, content, content_type="image/png", filename="sample.png"):
        return UploadFile(
            file=BytesIO(content),
            filename=filename,
            headers=Headers({"content-type": content_type}),
        )

    async def test_upload_over_byte_limit_is_rejected_without_persistence(self):
        upload = self.upload(b"x" * (ocr.MAX_IMAGE_BYTES + 1))
        with patch("app.main.run_in_threadpool", new=AsyncMock()) as recognize:
            with self.assertRaises(HTTPException) as raised:
                await main.create_image_check(upload, self.user, self.db)
        self.assertEqual(raised.exception.status_code, 413)
        recognize.assert_not_awaited()
        self.assertEqual(self.db.query(models.PaymentCheck).count(), 0)

    async def test_non_image_mime_is_rejected_without_persistence(self):
        upload = self.upload(make_image_bytes(), content_type="text/plain")
        with self.assertRaises(HTTPException) as raised:
            await main.create_image_check(upload, self.user, self.db)
        self.assertEqual(raised.exception.status_code, 415)
        self.assertEqual(self.db.query(models.PaymentCheck).count(), 0)

    async def test_image_mime_mismatch_is_accepted_when_bytes_are_decodable(self):
        # The current route checks only the image/* MIME prefix; Pillow validates
        # the actual payload, but the declared subtype is not compared to it.
        upload = self.upload(make_image_bytes("PNG"), content_type="image/jpeg")
        with patch("app.main.run_in_threadpool", new=AsyncMock(return_value="Readable payment text")):
            result = await main.create_image_check(upload, self.user, self.db)
        self.assertEqual(result["source_type"], "file")
        self.assertEqual(self.db.query(models.PaymentCheck).count(), 1)

    async def test_unreadable_image_is_rejected_without_persistence(self):
        upload = self.upload(b"not an image")
        with patch("app.main.run_in_threadpool", new=AsyncMock(side_effect=ocr.UnreadableImageError)):
            with self.assertRaises(HTTPException) as raised:
                await main.create_image_check(upload, self.user, self.db)
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(self.db.query(models.PaymentCheck).count(), 0)

    async def test_insufficient_ocr_text_is_rejected_without_persistence(self):
        upload = self.upload(make_image_bytes())
        with patch("app.main.run_in_threadpool", new=AsyncMock(return_value="OK")):
            with self.assertRaises(HTTPException) as raised:
                await main.create_image_check(upload, self.user, self.db)
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(self.db.query(models.PaymentCheck).count(), 0)

    async def test_raw_ocr_and_extracted_evidence_are_returned_but_not_saved(self):
        raw_text = (
            "Amount: INR 2,500\nRecipient: Maya Rao\nAt 10:30 AM "
            "reference: REF-ABC-123456; contact private@example.test"
        ) * 12
        upload = self.upload(make_image_bytes())
        with patch("app.main.run_in_threadpool", new=AsyncMock(return_value=raw_text)):
            result = await main.create_image_check(upload, self.user, self.db)

        self.assertEqual(result["ocr_text_preview"], raw_text[:1200])
        self.assertEqual(result["detected_amount"], "INR 2,500")
        self.assertEqual(result["detected_time"], "10:30 AM")
        self.assertEqual(result["recipient_guess"], "Maya Rao")
        self.assertEqual(
            {item["field"] for item in result["evidence"]},
            {"amount", "currency", "recipient", "time", "transaction_id"},
        )
        self.assertTrue(all(item["verification_state"] == "DETECTED" for item in result["evidence"]))

        saved = self.db.get(models.PaymentCheck, result["id"])
        self.assertEqual(saved.source_type, "file")
        self.assertEqual(saved.input_label, "Uploaded receipt image")
        for column in models.PaymentCheck.__table__.columns:
            if isinstance(getattr(saved, column.name), str):
                self.assertNotIn(raw_text, getattr(saved, column.name))
                self.assertNotIn("private@example.test", getattr(saved, column.name))
        self.assertEqual(
            set(models.PaymentCheck.__table__.columns.keys()),
            {"id", "owner_key", "source_type", "input_label", "risk_level", "risk_score", "explanation", "created_at"},
        )


if __name__ == "__main__":
    unittest.main()
