import { describe, expect, it } from 'vitest'

import { maskSensitiveText } from '../utils/sensitiveMasking'

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
})
