import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from './isSafeExternalUrl'

describe('isSafeExternalUrl', () => {
  it('accepts https links', () => {
    expect(isSafeExternalUrl('https://www.newrecruit.eu/app/list/hlzLE')).toBe(true)
  })

  it('accepts http links', () => {
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
  })

  it('rejects a javascript: URI', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects null/undefined/empty', () => {
    expect(isSafeExternalUrl(null)).toBe(false)
    expect(isSafeExternalUrl(undefined)).toBe(false)
    expect(isSafeExternalUrl('')).toBe(false)
  })
})
