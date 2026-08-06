type DiagnosticValue = string | number | boolean | null | undefined
type DiagnosticContext = Record<string, DiagnosticValue>

// Keep browser diagnostics useful without ever printing credentials, file bytes,
// signatures, or arbitrary request payloads to the console.
const SAFE_CONTEXT_KEYS = new Set([
  'phase',
  'source',
  'network',
  'offset',
  'limit',
  'page',
  'category',
  'status',
  'retryable',
  'hasRegistrationTx',
  'hasCommitTx',
])

const redact = (value: string): string => value
  .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
  .replace(/(api[_-]?key|token|secret|signature)=([^&\s]+)/gi, '$1=[redacted]')

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong.'): string => {
  if (error instanceof Error && error.message) return redact(error.message)
  if (typeof error === 'string' && error) return redact(error)
  return fallback
}

export function reportClientError(scope: string, error: unknown, context: DiagnosticContext = {}): void {
  if (typeof console === 'undefined') return

  const safeContext = Object.fromEntries(
    Object.entries(context).filter(([key]) => SAFE_CONTEXT_KEYS.has(key)),
  )

  console.error(`[KaryaChain:${scope}]`, {
    message: getErrorMessage(error),
    ...safeContext,
  })
}
