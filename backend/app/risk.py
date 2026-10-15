import ipaddress
import re
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse


AMOUNT_PATTERN = re.compile(
    r"(?:₹|\bINR\b|\bRs\.?\s*|\$|\bUSD\b|€|\bEUR\b|£|\bGBP\b)\s*\d[\d,]*(?:\.\d{1,2})?",
    re.IGNORECASE,
)
LABELED_AMOUNT_PATTERN = re.compile(
    r"\b(?:amount|total|payment)\s*[:\-]?\s*(?:(?:INR|Rs\.?|USD|EUR|GBP)\s*|[₹$€£]\s*)?\d[\d,]*(?:\.\d{1,2})?",
    re.IGNORECASE,
)
RECIPIENT_LINE_PATTERN = re.compile(
    r"(?im)^\s*(?:recipient|payee|beneficiary|to)\s*[:\-]\s*([^\r\n,;]{2,100})"
)
RECIPIENT_PHRASE_PATTERN = re.compile(
    r"\b(?:transfer\s+to|pay\s+to|send\s+to)\s+([^\r\n,;.!]{2,80})",
    re.IGNORECASE,
)
SHORTENER_HOSTS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "shorturl.at"}
EMBEDDED_URL_PATTERN = re.compile(r"\b(?:https?://|www\.)[^\s<>()\[\]{}\"']+", re.IGNORECASE)
PAYMENT_DOMAIN_TERMS = {"upi", "pay", "payment", "wallet", "bank", "gpay", "phonepe", "paytm", "paypal", "stripe", "venmo", "cashapp"}
AUTH_DOMAIN_TERMS = {"verify", "secure", "login", "signin", "account", "confirm", "update"}
MAX_LINKS_PER_CHECK = 5


def extract_amount(content: str) -> str | None:
    match = AMOUNT_PATTERN.search(content) or LABELED_AMOUNT_PATTERN.search(content)
    return " ".join(match.group(0).split()) if match else None


def extract_recipient(content: str) -> str | None:
    match = RECIPIENT_LINE_PATTERN.search(content) or RECIPIENT_PHRASE_PATTERN.search(content)
    if not match:
        return None
    candidate = re.split(r"\s{2,}|\s+(?:amount|total|date|reference|invoice)\s*[:\-]", match.group(1), maxsplit=1, flags=re.IGNORECASE)[0]
    candidate = re.sub(r"\s+", " ", candidate).strip(" .:-")
    return candidate[:100] if len(candidate) >= 2 else None


def find_trusted_payee(content: str, payees: list) -> str | None:
    normalized = content.casefold()
    for payee in payees:
        name = payee.name.strip()
        identifier = payee.payment_identifier.strip()
        name_match = len(name) >= 3 and re.search(rf"(?<!\w){re.escape(name)}(?!\w)", content, re.IGNORECASE)
        identifier_match = len(identifier) >= 4 and re.search(rf"(?<!\w){re.escape(identifier)}(?!\w)", content, re.IGNORECASE)
        if name_match or identifier_match:
            return name
    return None


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
    recipient = extract_recipient(text)
    trusted_match = find_trusted_payee(text, payees or [])
    link_domain = None
    link_domains: list[str] = []

    if not amount:
        score += 20
        findings.append("No clear payment amount was detected.")
    elif len(amount_values) > 1:
        findings.append("More than one different amount appears in the submitted content. Confirm the exact amount independently; only the first amount is shown above.")

    if not recipient:
        if trusted_match:
            recipient = trusted_match
        else:
            score += 20
            findings.append("Recipient details were not clear in the submitted content.")

    if trusted_match:
        findings.append("The submitted content contains a name or identifier from your trusted-payee list. This text match does not verify account ownership.")

    if source_type == "file" and len(re.findall(r"[A-Za-z0-9]{2,}", text)) < 4:
        findings.append("Only a few readable words were extracted from the image. This score may be incomplete; review the image text or paste the payment details manually.")

    asks_for_secret = re.search(
        r"\b(?:send|share|provide|reply\s+with|give\s+(?:me|us)|enter)\b.{0,45}\b(?:otp|one[ -]time\s+password|pin|password|security\s+code)\b|\b(?:otp|one[ -]time\s+password|pin|password|security\s+code)\b.{0,45}\b(?:send|share|provide|reply|give)\b",
        normalized,
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
