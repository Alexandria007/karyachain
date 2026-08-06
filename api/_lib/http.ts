export type ApiRequest = {
  method?: string
  body?: unknown
}

export type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  setHeader: (name: string, value: string) => ApiResponse
  json: (body: unknown) => void
  end: () => void
}

export function sendJson(res: ApiResponse, statusCode: number, body: unknown): void {
  res.status(statusCode).setHeader('content-type', 'application/json; charset=utf-8').json(body)
}

export function allowOptions(req: ApiRequest, res: ApiResponse): boolean {
  if (req.method !== 'OPTIONS') return false
  res.status(204).setHeader('allow', 'POST, OPTIONS').end()
  return true
}

export function bodyRecord(req: ApiRequest): Record<string, unknown> {
  if (typeof req.body === 'string') {
    try {
      const parsed: unknown = JSON.parse(req.body)
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
}
