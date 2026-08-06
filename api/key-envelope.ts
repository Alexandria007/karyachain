import { wrapKeyEnvelope } from './_lib/keyEnvelope'
import { allowOptions, bodyRecord, sendJson, type ApiRequest, type ApiResponse } from './_lib/http'

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (allowOptions(req, res)) return
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'POST is required.' })
    return
  }
  try {
    const body = bodyRecord(req)
    if (body.version !== 1) {
      sendJson(res, 400, { error: 'Unsupported key envelope version.' })
      return
    }
    const key = typeof body.key === 'string' ? Buffer.from(body.key, 'base64') : Buffer.alloc(0)
    const contentIv = typeof body.contentIv === 'string' ? Buffer.from(body.contentIv, 'base64') : Buffer.alloc(0)
    if (key.length !== 32 || contentIv.length !== 12) {
      sendJson(res, 400, { error: 'A 32-byte key and 12-byte content IV are required.' })
      return
    }
    const envelope = wrapKeyEnvelope({
      key,
      contentIv,
      contentType: body.contentType,
      originalName: body.fileName,
    })
    res
      .status(200)
      .setHeader('cache-control', 'no-store')
      .json({ version: 1, envelope: envelope.toString('base64') })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Key envelope creation failed.'
    sendJson(res, 500, { error: message })
  }
}
