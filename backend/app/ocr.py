import os
from io import BytesIO

import pytesseract
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import TesseractError, TesseractNotFoundError


MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
OCR_TIMEOUT_SECONDS = 15


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
            return pytesseract.image_to_string(
                image,
                lang="eng",
                config="--psm 6",
                timeout=OCR_TIMEOUT_SECONDS,
            ).strip()
    except TesseractNotFoundError as exc:
        raise OcrUnavailableError from exc
    except TesseractError as exc:
        raise OcrUnavailableError from exc
    except RuntimeError as exc:
        raise OcrTimeoutError from exc
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise UnreadableImageError from exc
