import os
from io import BytesIO

import pytesseract
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import TesseractError, TesseractNotFoundError


MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
OCR_TIMEOUT_SECONDS = 15
OCR_TARGET_LONG_EDGE = 3_200
OCR_UPSCALE_THRESHOLD = 2_400


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
            ).strip()
            layout_text = pytesseract.image_to_string(
                image, lang="eng", config="--psm 11", timeout=OCR_TIMEOUT_SECONDS
            ).strip()
            return "\n".join(dict.fromkeys(text for text in (primary_text, layout_text) if text))
    except TesseractNotFoundError as exc:
        raise OcrUnavailableError from exc
    except TesseractError as exc:
        raise OcrUnavailableError from exc
    except RuntimeError as exc:
        raise OcrTimeoutError from exc
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise UnreadableImageError from exc
