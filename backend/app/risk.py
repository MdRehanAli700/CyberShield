import ipaddress
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

from .schemas import EvidenceItem


AMOUNT_PATTERN = re.compile(
    r"(?:₹|\bINR\b|\bRs\.?\s*|\$|\bUSD\b|€|\bEUR\b|£|\bGBP\b)\s*\d[\d,]*(?:\.\d{1,2})?",
    re.IGNORECASE,
)
LABELED_AMOUNT_PATTERN = re.compile(
    r"\b(?:amount|total|payment)(?:\s+of)?\s*[:\-]?\s*(?:(?:INR|Rs\.?|USD|EUR|GBP)\s*|[₹$€£]\s*)?\d[\d,]*(?:\.\d{1,2})?",
    re.IGNORECASE,
)
RECIPIENT_LINE_PATTERN = re.compile(
    r"(?im)^\s*(?:recipient|payee|beneficiary|to)\s*[:\-]\s*([^\r\n,;]{2,100})"
)
RECIPIENT_PHRASE_PATTERN = re.compile(
    r"\b(?:transfer\s+to|pay\s+to|send\s+to)\s+([^\r\n,;.!]{2,80})",
    re.IGNORECASE,
)
RECIPIENT_AMOUNT_PHRASE_PATTERN = re.compile(
    r"\b(?:transfer|pay|send)\s+(?:(?:INR|Rs\.?|USD|EUR|GBP)\s*|[₹$€£]\s*)?"
    r"\d[\d,]*(?:\.\d{1,2})?\s+to\s+([^\r\n,;.!]{2,80})",
    re.IGNORECASE,
)
TIME_PATTERN = re.compile(r"\b(?:0?[1-9]|1[0-2]):[0-5]\d\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b", re.IGNORECASE)
SHORTENER_HOSTS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "shorturl.at"}
EMBEDDED_URL_PATTERN = re.compile(r"\b(?:https?://|www\.)[^\s<>()\[\]{}\"']+", re.IGNORECASE)
PAYMENT_DOMAIN_TERMS = {"upi", "pay", "payment", "wallet", "bank", "gpay", "phonepe", "paytm", "paypal", "stripe", "venmo", "cashapp"}
AUTH_DOMAIN_TERMS = {"verify", "secure", "login", "signin", "account", "confirm", "update"}
MAX_LINKS_PER_CHECK = 5
_SECRET_TERMS = r"(?:otp|one[ -]time\s+password|verification\s+code|pin|password|security\s+code)"
_SECRET_REQUEST_PATTERN = re.compile(
    rf"\b(?:send|share|provide|disclose|reveal|reply\s+with|give(?:\s+(?:me|us))?|enter|tell(?:\s+(?:me|us))?|ask(?:\s+for)?)\b"
    rf".{{0,45}}\b{_SECRET_TERMS}\b|\b{_SECRET_TERMS}\b.{{0,45}}"
    r"\b(?:send|share|provide|disclose|reveal|reply|give|tell|ask)\b",
    re.IGNORECASE,
)
_SECRET_WARNING_PATTERN = re.compile(
    rf"\b(?:never|do\s+not|don't|dont|must\s+not|should\s+not|cannot|can't|avoid)\b"
    rf".{{0,70}}\b(?:send|share|provide|disclose|reveal|reply\s+with|give|enter|tell|ask(?:\s+for)?)\b"
    rf".{{0,70}}\b{_SECRET_TERMS}\b|"
    rf"\b(?:banks?|financial\s+institutions?)\b.{{0,35}}\bnever\s+ask\b.{{0,35}}\b{_SECRET_TERMS}\b",
    re.IGNORECASE,
)

_EVIDENCE_NUMBER = r"(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?"
_CURRENCY_AMOUNT_PATTERN = re.compile(
    rf"(?P<currency>₹|\bINR\b|\bRs\.?|\$|\bUSD\b|€|\bEUR\b|£|\bGBP\b)\s*(?P<number>{_EVIDENCE_NUMBER})",
    re.IGNORECASE,
)
_LABELED_EVIDENCE_AMOUNT_PATTERN = re.compile(
    rf"\b(?:amount|total|payment)(?:\s+of)?\s*[:\-]?\s*(?:(?P<currency>₹|\bINR\b|\bRs\.?|\$|\bUSD\b|€|\bEUR\b|£|\bGBP\b)\s*)?(?P<number>{_EVIDENCE_NUMBER})",
    re.IGNORECASE,
)
_SUFFIX_CURRENCY_AMOUNT_PATTERN = re.compile(
    rf"\b(?:amount|total|payment)(?:\s+of)?\s*[:\-]?\s*(?P<number>{_EVIDENCE_NUMBER})\s*"
    r"(?P<suffix_currency>₹|\bINR\b|\bRs\.?|\$|\bUSD\b|€|\bEUR\b|£|\bGBP\b)(?![\w.])",
    re.IGNORECASE,
)
_UPI_ID_PATTERN = re.compile(
    r"(?i)\b(?:upi(?:\s*id)?|vpa)\s*[:\-]\s*"
    r"(?P<value>[a-z0-9](?:[a-z0-9._-]{0,48}[a-z0-9])?@[a-z][a-z0-9]{1,19})"
    r"(?![a-z0-9-]|\.[a-z0-9])"
)
_REFERENCE_PATTERN = re.compile(
    r"(?i)\b(?:utr|transaction\s*(?:id|no\.?|number|reference|ref)|"
    r"reference\s*(?:id|no\.?|number|#)?|ref\.?\s*(?:no\.?|#))"
    r"\s*[:#=\-]\s*(?P<value>[a-z0-9][a-z0-9/-]{5,31})(?![\w@])"
)
_DATE_PATTERN = re.compile(
    r"(?<!\d)(?P<value>\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})"
    r"(?!\d)|(?<!\w)(?P<text_date>\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})(?!\w)",
    re.IGNORECASE,
)
_EVIDENCE_TIME_PATTERN = re.compile(
    r"(?<!\d)(?P<value>(?:0?[1-9]|1[0-2]):[0-5]\d(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)|"
    r"(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)(?!\d)",
    re.IGNORECASE,
)
_PAYMENT_STATUS_PATTERN = re.compile(
    r"(?i)\b(?P<value>(?:(?:payment|transaction)\s+(?:status\s*[:=\-]?\s*)?"
    r"(?:successful|success|completed|pending|failed|failure|processing|paid|received)|"
    r"status\s*[:=\-]\s*(?:successful|success|completed|pending|failed|failure|processing|paid|received)))\b"
)
_CURRENCY_CODES = {
    "₹": "INR", "INR": "INR", "RS": "INR", "RS.": "INR",
    "USD": "USD", "€": "EUR", "EUR": "EUR", "£": "GBP", "GBP": "GBP",
}


def extract_amount(content: str) -> str | None:
    match = AMOUNT_PATTERN.search(content) or LABELED_AMOUNT_PATTERN.search(content)
    return " ".join(match.group(0).split()) if match else None


def extract_time(content: str) -> str | None:
    match = TIME_PATTERN.search(content)
    return " ".join(match.group(0).split()) if match else None


def _recipient_candidates(content: str) -> list[tuple[str, int, int, int, int]]:
    """Return distinct recipient candidates with value and source spans."""
    candidates: list[tuple[str, int, int, int, int]] = []
    seen: set[str] = set()
    patterns = (
        RECIPIENT_LINE_PATTERN,
        RECIPIENT_AMOUNT_PHRASE_PATTERN,
        RECIPIENT_PHRASE_PATTERN,
    )
    abbreviations = {"mr", "mrs", "ms", "dr", "jr", "sr", "st"}

    for pattern in patterns:
        for match in pattern.finditer(content):
            raw = match.group(1)
            sentence_end = None
            for punctuation in re.finditer(r"[.!?]\s+(?=[A-Za-z])", raw):
                previous_word = re.search(r"([A-Za-z]+)$", raw[:punctuation.start()])
                if previous_word and previous_word.group(1).casefold() in abbreviations:
                    continue
                sentence_end = punctuation.start()
                break
            if sentence_end is not None:
                raw = raw[:sentence_end]

            metadata = re.search(
                r"\s+(?:amount|total|date|reference|invoice)\s*[:\-]|\s+(?:for|towards|regarding)\b",
                raw,
                re.IGNORECASE,
            )
            if metadata:
                raw = raw[:metadata.start()]

            leading = len(raw) - len(raw.lstrip())
            trimmed = raw.strip(" .:-")
            if len(trimmed) < 2:
                continue
            normalized = re.sub(r"\s+", " ", trimmed)
            key = normalized.casefold()
            if key in seen:
                continue
            seen.add(key)

            raw_start = match.start(1) + leading
            raw_end = raw_start + len(trimmed)
            candidates.append((normalized[:100], raw_start, raw_end, match.start(1), match.end(1)))
    return candidates


def extract_recipient(content: str) -> str | None:
    candidates = _recipient_candidates(content)
    return candidates[0][0] if candidates else None


def _source_snippet(content: str, start: int, end: int) -> str:
    """Return a concise, single-line excerpt surrounding one evidence match."""
    line_start = content.rfind("\n", 0, start) + 1
    line_end = content.find("\n", end)
    if line_end < 0:
        line_end = len(content)
    if line_end - line_start <= 240:
        return content[line_start:line_end].strip()[:240]

    match_length = min(end - start, 120)
    left_context = (240 - match_length) // 2
    snippet_start = max(line_start, start - left_context)
    snippet_end = min(line_end, snippet_start + 240)
    snippet_start = max(line_start, snippet_end - 240)
    return content[snippet_start:snippet_end].strip()[:240]


def _normalized_amount(number: str) -> tuple[str | None, bool]:
    if "," in number and not (
        re.fullmatch(r"\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?", number)
        or re.fullmatch(r"\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d{1,2})?", number)
    ):
        return None, False
    try:
        value = Decimal(number.replace(",", ""))
    except InvalidOperation:
        return None, False
    return format(value.normalize(), "f"), True


def _normalized_date(raw_date: str) -> tuple[str | None, bool]:
    formats = (
        "%Y-%m-%d",
        "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%m-%d-%Y",
        "%d %B %Y", "%d %b %Y", "%d %B. %Y", "%d %b. %Y",
        "%B %d %Y", "%B %d, %Y", "%b %d %Y", "%b %d, %Y",
        "%B. %d %Y", "%b. %d %Y", "%B. %d, %Y", "%b. %d, %Y",
    )
    cleaned = re.sub(r"\s+", " ", raw_date.strip())
    parsed = None
    for date_format in formats:
        try:
            parsed = datetime.strptime(cleaned, date_format).date()
            break
        except ValueError:
            continue
    if parsed is None:
        return None, False

    if re.fullmatch(r"\d{1,2}[/-]\d{1,2}[/-]\d{4}", cleaned):
        first, second, _year = re.split(r"[/-]", cleaned)
        if int(first) <= 12 and int(second) <= 12:
            return None, True
    return parsed.isoformat(), True


def extract_payment_evidence(content: str, payees: list | None = None) -> list[EvidenceItem]:
    """Extract structured evidence without asserting that a payment is genuine.

    All new observations are DETECTED. A MATCHED recipient item is emitted only
    when the existing trusted-payee text matcher finds a local record match.
    This extractor does not assign VERIFIED.
    """
    evidence_with_positions: list[tuple[int, EvidenceItem]] = []
    occupied_number_spans: set[tuple[int, int]] = set()

    def add_amount(match: re.Match[str]) -> None:
        currency = match.groupdict().get("currency") or match.groupdict().get("suffix_currency")
        number = match.group("number")
        number_start, number_end = match.span("number")
        if (number_start, number_end) in occupied_number_spans:
            return
        occupied_number_spans.add((number_start, number_end))
        currency_start = (
            match.start("currency") if match.groupdict().get("currency")
            else match.start("suffix_currency") if match.groupdict().get("suffix_currency")
            else None
        )
        prefix_currency = bool(match.groupdict().get("currency"))
        raw_amount = content[currency_start:number_end] if prefix_currency and currency_start is not None else content[number_start:number_end]
        normalized, valid_grouping = _normalized_amount(number)
        quality = "low" if not valid_grouping else "high" if currency else "medium"
        evidence_with_positions.append((
            number_start,
            EvidenceItem(
                field="amount",
                value=raw_amount.strip(),
                normalized_value=normalized,
                source_snippet=_source_snippet(content, match.start(), match.end()),
                extraction_method="currency_amount_pattern" if currency else "labeled_amount_pattern",
                quality=quality,
                verification_state="DETECTED",
            ),
        ))
        if currency:
            raw_currency = currency.strip()
            currency_code = _CURRENCY_CODES.get(raw_currency.upper())
            # A bare dollar sign does not identify USD uniquely.
            if raw_currency == "$":
                currency_code = None
            evidence_with_positions.append((
                currency_start if currency_start is not None else number_end,
                EvidenceItem(
                    field="currency",
                    value=raw_currency,
                    normalized_value=currency_code,
                    source_snippet=_source_snippet(content, match.start(), match.end()),
                    extraction_method="currency_amount_pattern",
                    quality="high" if currency_code else "medium",
                    verification_state="DETECTED",
                ),
            ))

    for amount_match in _CURRENCY_AMOUNT_PATTERN.finditer(content):
        add_amount(amount_match)
    for amount_match in _SUFFIX_CURRENCY_AMOUNT_PATTERN.finditer(content):
        add_amount(amount_match)
    for amount_match in _LABELED_EVIDENCE_AMOUNT_PATTERN.finditer(content):
        add_amount(amount_match)

    for match in _UPI_ID_PATTERN.finditer(content):
        value = match.group("value")
        local, handle = value.split("@", 1)
        if re.search(r"[._-]{2}", local) or len(local) < 2 or len(handle) < 2:
            continue
        evidence_with_positions.append((
            match.start("value"),
            EvidenceItem(
                field="upi_id",
                value=value,
                normalized_value=value.casefold(),
                source_snippet=_source_snippet(content, match.start(), match.end()),
                extraction_method="labeled_upi_id_pattern",
                quality="high",
                verification_state="DETECTED",
            ),
        ))

    reference_spans: list[tuple[int, int]] = []
    for match in _REFERENCE_PATTERN.finditer(content):
        value = match.group("value")
        value_span = match.span("value")
        if re.fullmatch(r"\d{1,4}[/-]\d{1,2}[/-]\d{2,4}", value):
            reference_spans.append(value_span)
            continue
        if not re.search(r"\d", value):
            continue
        reference_spans.append(value_span)
        evidence_with_positions.append((
            match.start("value"),
            EvidenceItem(
                field="transaction_id",
                value=value,
                normalized_value=value.upper(),
                source_snippet=_source_snippet(content, match.start(), match.end()),
                extraction_method="labeled_transaction_reference_pattern",
                quality="medium",
                verification_state="DETECTED",
            ),
        ))

    recipients = _recipient_candidates(content)
    for recipient, _value_start, _value_end, source_start, source_end in recipients:
        evidence_with_positions.append((
            source_start,
            EvidenceItem(
                field="recipient",
                value=recipient,
                source_snippet=_source_snippet(content, source_start, source_end),
                extraction_method="existing_recipient_pattern",
                quality="low" if len(recipients) > 1 else "medium",
                verification_state="DETECTED",
            ),
        ))

    for match in _DATE_PATTERN.finditer(content):
        if any(start <= match.start() and match.end() <= end for start, end in reference_spans):
            continue
        raw_date = match.group("value") or match.group("text_date")
        normalized, valid = _normalized_date(raw_date)
        if not valid:
            continue
        evidence_with_positions.append((
            match.start(),
            EvidenceItem(
                field="date",
                value=raw_date,
                normalized_value=normalized,
                source_snippet=_source_snippet(content, match.start(), match.end()),
                extraction_method="calendar_date_pattern",
                quality="medium" if normalized is None else "high",
                verification_state="DETECTED",
            ),
        ))

    for match in _EVIDENCE_TIME_PATTERN.finditer(content):
        value = match.group("value")
        evidence_with_positions.append((
            match.start("value"),
            EvidenceItem(
                field="time",
                value=value,
                normalized_value=" ".join(value.upper().split()),
                source_snippet=_source_snippet(content, match.start(), match.end()),
                extraction_method="clock_time_pattern",
                quality="high",
                verification_state="DETECTED",
            ),
        ))

    for match in _PAYMENT_STATUS_PATTERN.finditer(content):
        value = match.group("value")
        status_word = re.search(
            r"successful|success|completed|pending|failed|failure|processing|paid|received",
            value,
            re.IGNORECASE,
        )
        evidence_with_positions.append((
            match.start("value"),
            EvidenceItem(
                field="payment_status",
                value=value,
                normalized_value=status_word.group(0).casefold() if status_word else None,
                source_snippet=_source_snippet(content, match.start(), match.end()),
                extraction_method="payment_status_wording_pattern",
                quality="medium",
                verification_state="DETECTED",
            ),
        ))

    if len(recipients) == 1:
        recipient, _value_start, _value_end, source_start, source_end = recipients[0]
        matched_payee = find_trusted_payee(recipient, payees or [])
        if matched_payee:
            evidence_with_positions.append((
                source_start,
                EvidenceItem(
                    field="recipient",
                    value=matched_payee,
                    source_snippet=_source_snippet(content, source_start, source_end),
                    extraction_method="trusted_payee_text_match",
                    quality="medium",
                    verification_state="MATCHED",
                ),
            ))

    evidence_with_positions.sort(key=lambda entry: entry[0])
    return [item for _, item in evidence_with_positions]


def find_trusted_payee(recipient_text: str, payees: list) -> str | None:
    """Return a local payee whose name or identifier appears in supplied text.

    Evidence extraction passes only one extracted recipient candidate here.
    """
    for payee in payees:
        name = payee.name.strip()
        identifier = payee.payment_identifier.strip()
        name_match = len(name) >= 3 and re.search(rf"(?<!\w){re.escape(name)}(?!\w)", recipient_text, re.IGNORECASE)
        identifier_match = len(identifier) >= 4 and re.search(rf"(?<!\w){re.escape(identifier)}(?!\w)", recipient_text, re.IGNORECASE)
        if name_match or identifier_match:
            return name
    return None


def _is_quoted_or_educational_secret_request(text: str, match: re.Match[str]) -> bool:
    """Avoid treating warnings and quoted scam examples as a live request."""
    for opening, closing in (("\"", "\""), ("'", "'"), ("“", "”"), ("‘", "’")):
        open_at = text.rfind(opening, 0, match.start())
        close_at = text.find(closing, match.end())
        if open_at >= 0 and close_at >= 0:
            intervening_close = text.find(closing, open_at + len(opening), match.start())
            if intervening_close < 0:
                return True

    clause_start = max(
        text.rfind(".", 0, match.start()),
        text.rfind("!", 0, match.start()),
        text.rfind("?", 0, match.start()),
        text.rfind(";", 0, match.start()),
        text.rfind("\n", 0, match.start()),
    ) + 1
    clause_end_candidates = [
        position for punctuation in (".", "!", "?", ";", "\n")
        if (position := text.find(punctuation, match.end())) >= 0
    ]
    clause_end = min(clause_end_candidates, default=len(text))
    clause = text[clause_start:clause_end]
    prefix = text[clause_start:match.start()]
    if _SECRET_WARNING_PATTERN.search(clause):
        return True
    if re.search(
        r"\b(?:the\s+)?(?:message|text|sender)\s+(?:says|said|reads|states|asks|contains)\b|"
        r"\b(?:example|quoted|sample)\b|\b(?:security|safety)\s+(?:advice|warning|tip)\b|"
        r"\bscammers?\b|\bcommon\s+otp\s+scams?\b",
        prefix,
        re.IGNORECASE,
    ):
        return True
    return False


def inspect_link(content: str) -> tuple[str | None, list[str], int]:
    candidate = content.strip()
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    try:
        parsed = urlparse(candidate)
        hostname = parsed.hostname
        if not hostname:
            return None, ["The link domain could not be read."], 20
        port = parsed.port
        domain = hostname.encode("idna").decode("ascii").casefold()
    except (ValueError, UnicodeError):
        return None, ["The link format could not be read reliably."], 20

    warnings: list[str] = []
    added_score = 0
    if parsed.scheme.casefold() != "https":
        warnings.append("The payment link does not use HTTPS.")
        added_score += 25
    if domain in SHORTENER_HOSTS:
        warnings.append("The link uses a URL shortener, so its destination is hidden.")
        added_score += 25
    if len(domain) > 60:
        warnings.append("The hostname is unusually long; check the domain ending carefully. Long domains can be legitimate, so this is only a caution.")
        added_score += 10
    labels = domain.split(".")
    if len(labels) > 5:
        warnings.append("The link uses several nested subdomains. Check which organization owns the final domain; nested subdomains can be legitimate.")
        added_score += 10
    standard_port = 443 if parsed.scheme.casefold() == "https" else 80
    if port is not None and port != standard_port:
        warnings.append("The link uses a nonstandard web port. This can be valid, but confirm the destination independently.")
        added_score += 15
    try:
        ipaddress.ip_address(hostname)
        warnings.append("The link uses a numeric IP address instead of a familiar domain name.")
        added_score += 20
    except ValueError:
        pass
    if any(label.startswith("xn--") for label in domain.split(".")):
        warnings.append("The domain contains an internationalized label that may resemble other characters.")
        added_score += 15
    domain_terms = set(re.split(r"[-.]", domain))
    if "-" in domain and domain_terms & PAYMENT_DOMAIN_TERMS and domain_terms & AUTH_DOMAIN_TERMS:
        warnings.append("The domain combines payment-service wording with sign-in or security wording, a look-alike pattern worth checking independently. This does not confirm fraud.")
        added_score += 20
    if parsed.username is not None or parsed.password is not None:
        warnings.append("The link includes text before the domain that can make its destination look misleading.")
        added_score += 20
    return domain, warnings, added_score


def assess_payment(source_type: str, content: str, payees: list | None = None) -> tuple[str, int, str, str | None, str | None, str | None, str | None, list[str], list[str]]:
    text = content.strip()
    normalized = text.casefold()
    score = 10
    findings: list[str] = []
    amount = extract_amount(text)
    amount_values: set[Decimal] = set()
    for pattern in (AMOUNT_PATTERN, LABELED_AMOUNT_PATTERN):
        for match in pattern.finditer(text):
            number = re.search(r"\d[\d,]*(?:\.\d{1,2})?", match.group(0))
            if number:
                try:
                    amount_values.add(Decimal(number.group(0).replace(",", "")))
                except InvalidOperation:
                    continue
    recipient_candidates = _recipient_candidates(text)
    recipient = recipient_candidates[0][0] if len(recipient_candidates) == 1 else None
    trusted_match = find_trusted_payee(recipient, payees or []) if recipient else None
    link_domain = None
    link_domains: list[str] = []

    if not amount:
        score += 20
        findings.append("No clear payment amount was detected.")
    elif len(amount_values) > 1:
        findings.append("More than one different amount appears in the submitted content. Confirm the exact amount independently; only the first amount is shown above.")

    if not recipient:
        score += 20
        findings.append("Recipient details were not clear in the submitted content.")

    if trusted_match:
        findings.append("The submitted content contains a name or identifier from your trusted-payee list. This text match does not verify account ownership.")

    if source_type == "file" and len(re.findall(r"[A-Za-z0-9]{2,}", text)) < 4:
        findings.append("Only a few readable words were extracted from the image. This score may be incomplete; review the image text or paste the payment details manually.")

    asks_for_secret = any(
        not _is_quoted_or_educational_secret_request(text, match)
        for match in _SECRET_REQUEST_PATTERN.finditer(text)
    )
    if asks_for_secret:
        score += 75
        findings.append("The message appears to request a one-time code, PIN, password, or security code.")

    if re.search(r"\b(?:urgent|immediately|right now|act now|final warning|account.{0,20}blocked|within\s+\d+\s+minutes)\b", normalized):
        score += 30
        findings.append("Urgent or pressure-based wording was detected.")

    if re.search(r"\b(?:gift\s*cards?|crypto(?:currency)?|bitcoin|wire\s+transfer)\b", normalized):
        score += 25
        findings.append("A payment method that can be difficult to reverse was mentioned.")

    if source_type == "url":
        link_candidates = [text]
    else:
        link_candidates = [match.group(0).rstrip(".,;:!?") for match in EMBEDDED_URL_PATTERN.finditer(text)]
    unique_links = list(dict.fromkeys(candidate.casefold() for candidate in link_candidates))
    checked_links = unique_links[:MAX_LINKS_PER_CHECK]
    for link_candidate in checked_links:
        domain, link_warnings, link_score = inspect_link(link_candidate)
        if domain and domain not in link_domains:
            link_domains.append(domain)
        if domain:
            findings.extend(f"{domain}: {warning}" for warning in link_warnings)
        else:
            findings.extend(link_warnings)
        score += link_score
    if len(unique_links) > MAX_LINKS_PER_CHECK:
        findings.append(f"Only the first {MAX_LINKS_PER_CHECK} distinct links were checked; review any additional links separately.")
    link_domain = link_domains[0] if link_domains else None

    score = min(score, 100)
    level = "high" if score >= 70 else "medium" if score >= 35 else "low"
    if not findings:
        findings.append("No warning phrases were detected in the submitted content.")

    explanation = (
        f"Preliminary pattern score: {score}/100 ({level} signal level). "
        + " ".join(findings)
        + " This is an early text-based check; it does not verify who controls an account or whether a payment is legitimate."
    )
    return level, score, explanation, amount, recipient, trusted_match, link_domain, findings, link_domains


def recommended_action(level: str, findings: list[str] | None = None) -> str:
    if level == "high":
        return "Do not send money or share verification codes. Contact your bank or intended recipient through an official channel you already trust."
    findings = findings or []
    if any("More than one different amount appears" in finding for finding in findings):
        return "Confirm the exact amount and payee through a contact method you already trust before sending money."
    if any("Only a few readable words were extracted from the image" in finding for finding in findings):
        return "Review the image text or paste the payment details manually, then confirm the recipient and amount independently."
    if level == "medium":
        return "Pause and confirm the amount and payee using a contact method you already trust."
    if findings:
        return "Review the listed signals and confirm the recipient and payment details independently before sending money. A low score does not prove a payment is safe."
    return "No warning pattern was found by these basic rules. Independently confirm the recipient and payment details before sending money."
