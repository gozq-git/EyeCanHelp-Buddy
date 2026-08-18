const EMAIL_PATTERN = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g
const SG_NRIC_FIN_PATTERN = /\b([STFGM])(\d{7})([A-Z])\b/gi
const PASSPORT_PATTERN = /\b([A-HJ-NP-Z])(\d{7})([A-Z])\b/g
const PHONE_PATTERN = /(^|[^\w])(\+?\d[\d\s\-()]{6,}\d)(?=$|[^\w])/g
const DATE_PATTERN = /(^|[^\d])(\d{1,2})([/-])(\d{1,2})\3(\d{2}|\d{4})(?!\d)/g

function maskEmail(local, domain) {
  if (local.length <= 1) {
    return `${local}@${domain}`
  }
  return `${local[0]}${'*'.repeat(local.length - 1)}@${domain}`
}

function maskPhoneDigits(token) {
  const chars = token.split('')
  const digitIndexes = []

  for (let i = 0; i < chars.length; i += 1) {
    if (/\d/.test(chars[i])) {
      digitIndexes.push(i)
    }
  }

  if (digitIndexes.length < 8) {
    return token
  }

  const keepHead = 2
  const keepTail = 2
  for (let i = 0; i < digitIndexes.length; i += 1) {
    if (i < keepHead || i >= digitIndexes.length - keepTail) {
      continue
    }
    chars[digitIndexes[i]] = '*'
  }

  return chars.join('')
}

function maskDatePart(part) {
  if (part.length <= 1) {
    return '*'
  }
  return `${part.slice(0, -1)}*`
}

function maskYearPart(part) {
  if (part.length <= 2) {
    return '*'.repeat(part.length)
  }
  return `${part.slice(0, -2)}**`
}

function maskDateToken(day, separator, month, year) {
  return `${maskDatePart(day)}${separator}${maskDatePart(month)}${separator}${maskYearPart(year)}`
}

export function maskSensitiveText(value) {
  const text = String(value || '')
  if (!text) {
    return text
  }

  let masked = text
  masked = masked.replace(EMAIL_PATTERN, (_match, local, domain) => maskEmail(local, domain))
  masked = masked.replace(SG_NRIC_FIN_PATTERN, (_match, prefix, digits, suffix) => {
    const hiddenCount = Math.max(digits.length - 2, 1)
    return `${prefix.toUpperCase()}${'*'.repeat(hiddenCount)}${digits.slice(-2)}${suffix.toUpperCase()}`
  })
  masked = masked.replace(PASSPORT_PATTERN, (_match, prefix, digits, suffix) => {
    const hiddenCount = Math.max(digits.length - 2, 1)
    return `${prefix}${'*'.repeat(hiddenCount)}${digits.slice(-2)}${suffix}`
  })
  masked = masked.replace(DATE_PATTERN, (_match, leftBoundary, day, separator, month, year) => {
    return `${leftBoundary}${maskDateToken(day, separator, month, year)}`
  })
  masked = masked.replace(PHONE_PATTERN, (_match, leftBoundary, token) => `${leftBoundary}${maskPhoneDigits(token)}`)

  return masked
}

export function maskRegistrationField(fieldName, value) {
  if (fieldName === 'phone_number' || fieldName === 'email' || fieldName === 'patient_dob') {
    return maskSensitiveText(value)
  }
  return String(value || '')
}
