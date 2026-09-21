import { describe, expect, it } from 'vitest'

import { maskRegistrationField, maskSensitiveText } from '../utils/sensitiveMasking'

describe('sensitiveMasking', () => {
  it('masks date values by day/month last digit and year last two digits', () => {
    expect(maskSensitiveText('DOB 25-03-1965')).toBe('DOB 2*-0*-19**')
    expect(maskSensitiveText('DOB 01/12/2004')).toBe('DOB 0*/1*/20**')
  })

  it('masks emails, ids, and phone numbers deterministically', () => {
    const input = 'Email john.doe@example.com NRIC S1234567A Phone +6591234567'
    const once = maskSensitiveText(input)
    const twice = maskSensitiveText(input)

    expect(once).toBe('Email j*******@example.com NRIC S*****67A Phone +65******67')
    expect(twice).toBe(once)
  })

  it('masks passport numbers whose prefix is outside the NRIC/FIN set', () => {
    // NRIC runs first and only claims S/T/F/G/M prefixes, so 'A' falls through
    // to the passport rule.
    expect(maskSensitiveText('Passport A1234567B')).toBe('Passport A*****67B')
  })

  it('masks single-digit day and month components', () => {
    expect(maskSensitiveText('on 1/2/2020')).toBe('on */*/20**')
  })

  it('masks a two-digit year entirely', () => {
    expect(maskSensitiveText('DOB 25-03-65')).toBe('DOB 2*-0*-**')
  })

  it('leaves a single-character email local part intact', () => {
    // Nothing to hide behind a first character, so the address is returned as-is.
    expect(maskSensitiveText('mail a@example.com')).toBe('mail a@example.com')
  })

  it('leaves number runs shorter than eight digits alone', () => {
    // Matches the phone shape but is too short to be a phone number.
    expect(maskSensitiveText('ext 1234 567')).toBe('ext 1234 567')
  })

  it('returns empty output for blank and nullish input', () => {
    expect(maskSensitiveText('')).toBe('')
    expect(maskSensitiveText(null)).toBe('')
    expect(maskSensitiveText(undefined)).toBe('')
  })
})

describe('maskRegistrationField', () => {
  it('masks the sensitive registration fields', () => {
    expect(maskRegistrationField('phone_number', '+6591234567')).toBe('+65******67')
    expect(maskRegistrationField('email', 'john.doe@example.com')).toBe('j*******@example.com')
    expect(maskRegistrationField('patient_dob', '25-03-1965')).toBe('2*-0*-19**')
  })

  it('passes other fields through unmasked', () => {
    // A name is not masked — masking it would make the confirmation unreadable.
    expect(maskRegistrationField('patient_name', 'Tan Ah Kow')).toBe('Tan Ah Kow')
    expect(maskRegistrationField('patient_name', undefined)).toBe('')
  })
})
