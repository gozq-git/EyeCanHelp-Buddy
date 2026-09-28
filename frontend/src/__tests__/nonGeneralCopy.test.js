import { describe, expect, it } from 'vitest'
import { formatCopy, getCopy } from '../i18n/nonGeneralCopy'

describe('non-general copy helpers', () => {
  it('falls back to English for an unknown language and key', () => {
    const translate = getCopy('xx')

    expect(translate('welcomeBackPreProc')).toBe(getCopy('en')('welcomeBackPreProc'))
    expect(translate('missingKey')).toBe('')
  })

  it('replaces nullish values with an empty string', () => {
    expect(formatCopy('Hello {name}', { name: null })).toBe('Hello ')
    expect(formatCopy(null)).toBe('')
  })
})