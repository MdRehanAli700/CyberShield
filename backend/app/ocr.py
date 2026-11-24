import os
import re
from collections import Counter
from dataclasses import dataclass
from io import BytesIO

import pytesseract
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import TesseractError, TesseractNotFoundError


MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
OCR_TIMEOUT_SECONDS = 15
OCR_TARGET_LONG_EDGE = 3_200
OCR_UPSCALE_THRESHOLD = 2_400
CURRENCY_CONTEXT_WINDOW_BEFORE = 40
CURRENCY_CONTEXT_WINDOW_AFTER = 24
CURRENCY_CONTEXT_PATTERN = re.compile(
    r"(?:\b(?:send|pay|transfer|payment|amount|total|inr|rs\.?|rupees?)\b|₹)",
    re.IGNORECASE,
)
INR_CONTEXT_PATTERN = re.compile(r"(?:\b(?:INR|Rs\.?|rupees?)\b|₹)", re.IGNORECASE)
USD_CONTEXT_PATTERN = re.compile(r"\b(?:USD|US\s+dollars?)\b", re.IGNORECASE)
OCR_RUPEE_SUBSTITUTION_PATTERN = re.compile(
    r"(?<![\w%/])%\s*(?P<amount>\d[\d,]*(?:\.\d{1,2})?)(?![\w%])"
)
OCR_DOLLAR_SUBSTITUTION_PATTERN = re.compile(
    r"(?<![\w$])\$\s*(?P<amount>\d[\d,]*(?:\.\d{1,2})?)(?![\w%])"
)
PUNCTUATION_WHITESPACE_PATTERN = re.compile(r"\s*([,.;:/!?])\s*")


@dataclass(frozen=True)
class OcrPassResult:
    """Unmodified text returned by one Tesseract page-segmentation pass."""

    psm: int
    raw_text: str


def _line_comparison_key(line: str) -> str:
    compact = " ".join(line.split())
    # Retain punctuation identity, but ignore spacing around it for comparison.
    return PUNCTUATION_WHITESPACE_PATTERN.sub(r"\1", compact)


def _has_currency_context(line: str, start: int, end: int) -> bool:
    # Keep the context local to this line and close to the suspected symbol.
    context = (
        line[max(0, start - CURRENCY_CONTEXT_WINDOW_BEFORE):start]
        + " "
        + line[end:min(len(line), end + CURRENCY_CONTEXT_WINDOW_AFTER)]
    )
    return CURRENCY_CONTEXT_PATTERN.search(context) is not None


def _has_explicit_inr_context(line: str, start: int, end: int) -> bool:
    prefix = line[max(0, start - CURRENCY_CONTEXT_WINDOW_BEFORE):start]
    for context_match in reversed(list(INR_CONTEXT_PATTERN.finditer(prefix))):
        bridge = prefix[context_match.end():]
        if not re.search(r"[\d$₹€£%]", bridge):
            return True

    suffix = line[end:min(len(line), end + CURRENCY_CONTEXT_WINDOW_AFTER)]
    for context_match in INR_CONTEXT_PATTERN.finditer(suffix):
        bridge = suffix[:context_match.start()]
        if not re.search(r"[\d$₹€£%]", bridge):
            return True

    return False


def _has_explicit_usd_context(line: str, start: int, end: int) -> bool:
    context = (
        line[max(0, start - CURRENCY_CONTEXT_WINDOW_BEFORE):start]
        + " "
        + line[end:min(len(line), end + CURRENCY_CONTEXT_WINDOW_AFTER)]
    )
    return USD_CONTEXT_PATTERN.search(context) is not None


def _normalize_currency_symbols(text: str) -> str:
    """Correct likely symbol confusions only when nearby currency text disambiguates."""
    normalized_lines: list[str] = []
    for line in text.splitlines():
        def replace_percent(match: re.Match[str]) -> str:
            if not _has_currency_context(line, match.start(), match.end()):
                return match.group(0)
            return f"₹{match.group('amount')}"

        normalized_line = OCR_RUPEE_SUBSTITUTION_PATTERN.sub(replace_percent, line)

        def replace_dollar(match: re.Match[str]) -> str:
            start, end = match.span()
            has_inr = _has_explicit_inr_context(normalized_line, start, end)
            has_usd = _has_explicit_usd_context(normalized_line, start, end)
            if not has_inr or has_usd:
                return match.group(0)
            return f"₹{match.group('amount')}"

        normalized_lines.append(
            OCR_DOLLAR_SUBSTITUTION_PATTERN.sub(replace_dollar, normalized_line)
        )
    return "\n".join(normalized_lines)


def _clean_ocr_results(results: tuple[OcrPassResult, ...]) -> str:
    """Merge OCR passes, removing exact normalized line overlap across passes.

    Repetition inside an individual PSM result is retained. The earlier pass
    keeps priority, so the usual PSM 6 reading order remains first.
    """
    merged_passes: list[str] = []
    prior_line_counts: Counter[str] = Counter()

    for result in results:
        lines = result.raw_text.strip().splitlines()
        if not lines:
            continue

        skipped_from_prior = Counter()
        current_pass_counts: Counter[str] = Counter()
        retained_lines: list[str] = []

        for line in lines:
            key = _line_comparison_key(line)
            if key and skipped_from_prior[key] < prior_line_counts[key]:
                skipped_from_prior[key] += 1
                current_pass_counts[key] += 1
                continue
            retained_lines.append(line.strip())
            if key:
                current_pass_counts[key] += 1

        merged_passes.append("\n".join(retained_lines).strip())
        prior_line_counts.update(current_pass_counts)

    merged = "\n".join(text for text in merged_passes if text)
    return _normalize_currency_symbols(merged)


class OcrUnavailableError(Exception):
    pass


class UnreadableImageError(Exception):
    pass


class ImageTooLargeError(Exception):
    pass


class OcrTimeoutError(Exception):
    pass


def image_to_text(image_bytes: bytes) -> str:
    command = os.getenv("TESSERACT_CMD")
    if command:
        pytesseract.pytesseract.tesseract_cmd = command

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise ImageTooLargeError
            image.verify()
        with Image.open(BytesIO(image_bytes)) as image:
            image = ImageOps.exif_transpose(image)
            image = ImageOps.autocontrast(ImageOps.grayscale(image))
            # Screenshots often contain small chat or receipt text inside a
            # much larger image. Enlarge modestly so Tesseract can resolve it.
            longest_edge = max(image.size)
            if longest_edge < OCR_UPSCALE_THRESHOLD:
                scale = min(3.0, OCR_TARGET_LONG_EDGE / longest_edge)
                if scale > 1:
                    image = image.resize(
                        (round(image.width * scale), round(image.height * scale)),
                        Image.Resampling.LANCZOS,
                    )
            primary_text = pytesseract.image_to_string(
                image, lang="eng", config="--psm 6", timeout=OCR_TIMEOUT_SECONDS
            )
            layout_text = pytesseract.image_to_string(
                image, lang="eng", config="--psm 11", timeout=OCR_TIMEOUT_SECONDS
            )
            raw_results = (
                OcrPassResult(psm=6, raw_text=primary_text),
                OcrPassResult(psm=11, raw_text=layout_text),
            )
            return _clean_ocr_results(raw_results)
    except TesseractNotFoundError as exc:
        raise OcrUnavailableError from exc
    except TesseractError as exc:
        raise OcrUnavailableError from exc
    except RuntimeError as exc:
        raise OcrTimeoutError from exc
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise UnreadableImageError from exc
