import re

EMAIL_PATTERN = re.compile(r"\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
SG_NRIC_FIN_PATTERN = re.compile(r"\b([STFGM])(\d{7})([A-Z])\b", re.IGNORECASE)
PASSPORT_PATTERN = re.compile(r"\b([A-HJ-NP-Z])(\d{7})([A-Z])\b")
PHONE_PATTERN = re.compile(r"(^|[^\w])(\+?\d[\d\s\-()]{6,}\d)(?=$|[^\w])")
DATE_PATTERN = re.compile(r"(^|[^\d])(\d{1,2})([/-])(\d{1,2})\3(\d{2}|\d{4})(?!\d)")


def _mask_email(match: re.Match[str]) -> str:
    local, domain = match.group(1), match.group(2)
    if len(local) <= 1:
        return f"{local}@{domain}"
    return f"{local[0]}{'*' * (len(local) - 1)}@{domain}"


def _mask_id(match: re.Match[str]) -> str:
    prefix, digits, suffix = match.group(1), match.group(2), match.group(3)
    hidden_count = max(len(digits) - 2, 1)
    return f"{prefix.upper()}{'*' * hidden_count}{digits[-2:]}{suffix.upper()}"


def _mask_phone_token(token: str) -> str:
    chars = list(token)
    digit_indexes = [idx for idx, ch in enumerate(chars) if ch.isdigit()]

    if len(digit_indexes) < 8:
        return token

    keep_head = 2
    keep_tail = 2
    for idx, digit_position in enumerate(digit_indexes):
        if idx < keep_head or idx >= len(digit_indexes) - keep_tail:
            continue
        chars[digit_position] = "*"

    return "".join(chars)


def _mask_date_token(day: str, separator: str, month: str, year: str) -> str:
    def mask_tail(value: str) -> str:
        if len(value) <= 1:
            return "*"
        return f"{value[:-1]}*"

    if len(year) <= 2:
        masked_year = "*" * len(year)
    else:
        masked_year = f"{year[:-2]}**"

    return f"{mask_tail(day)}{separator}{mask_tail(month)}{separator}{masked_year}"


def mask_sensitive_text(value: str | None) -> str:
    text = str(value or "")
    if not text:
        return text

    masked = EMAIL_PATTERN.sub(_mask_email, text)
    masked = SG_NRIC_FIN_PATTERN.sub(_mask_id, masked)
    masked = PASSPORT_PATTERN.sub(_mask_id, masked)
    masked = DATE_PATTERN.sub(
        lambda m: f"{m.group(1)}{_mask_date_token(m.group(2), m.group(3), m.group(4), m.group(5))}",
        masked,
    )
    masked = PHONE_PATTERN.sub(lambda m: f"{m.group(1)}{_mask_phone_token(m.group(2))}", masked)
    return masked


def mask_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    return [
        {
            "role": item.get("role", ""),
            "content": mask_sensitive_text(item.get("content", "")),
        }
        for item in messages
    ]
