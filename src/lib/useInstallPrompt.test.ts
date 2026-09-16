import { afterEach, describe, expect, it, vi } from 'vitest'
import { isIOSBrowser } from './useInstallPrompt'

function setUserAgent(ua: string) {
  vi.stubGlobal('navigator', { ...navigator, userAgent: ua, standalone: undefined })
  // jsdom doesn't implement matchMedia -- isStandalone() (called internally by isIOSBrowser) needs
  // it to exist. Stubbed to "not in standalone/installed mode" here, same as a fresh browser tab.
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
}

describe('isIOSBrowser', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is true for iPhone Safari', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    )
    expect(isIOSBrowser()).toBe(true)
  })

  it('is true for iPad Safari', () => {
    setUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    )
    expect(isIOSBrowser()).toBe(true)
  })

  it('is false for Chrome on iOS (CriOS) -- it has no beforeinstallprompt either, but this app only offers the static Share-sheet hint for actual Safari', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1',
    )
    expect(isIOSBrowser()).toBe(false)
  })

  it('is false for Android Chrome', () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    )
    expect(isIOSBrowser()).toBe(false)
  })

  it('is false for desktop Chrome', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    )
    expect(isIOSBrowser()).toBe(false)
  })
})
