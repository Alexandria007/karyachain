import { afterEach, describe, expect, it, vi } from 'vitest'
import { getErrorMessage, reportClientError } from './diagnostics'

describe('client diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redacts bearer credentials and query-style secrets from messages', () => {
    expect(getErrorMessage(new Error('Bearer abc123 api_key=secret-value')))
      .toBe('Bearer [redacted] api_key=[redacted]')
  })

  it('keeps only the allow-listed diagnostic context', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportClientError('test', new Error('failed'), {
      source: 'unit-test',
      network: 'shelbynet',
      apiKey: 'must-not-appear' as unknown as undefined,
    })

    expect(consoleError).toHaveBeenCalledWith('[KaryaChain:test]', {
      message: 'failed',
      source: 'unit-test',
      network: 'shelbynet',
    })
  })
})
