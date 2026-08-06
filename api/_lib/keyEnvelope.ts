import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

type Envelope = {
  version: 1
  wrapIv: string
  wrappedKey: string
  contentIv: string
  contentType: string
  originalName: string
}

export type UnwrappedKey = {
  key: Buffer
  contentIv: Buffer
  contentType: string
  originalName: string
}

const secretKey = (): Buffer => {
  const secret = (process.env.KARYA_KEY_ENCRYPTION_SECRET || '').trim()
  if (secret.length < 32) {
    throw new Error('KARYA_KEY_ENCRYPTION_SECRET is not configured with sufficient entropy (minimum 32 characters).')
  }
  return createHash('sha256').update(secret, 'utf8').digest()
}

const decodeBase64 = (value: unknown, label: string): Buffer => {
  if (typeof value !== 'string' || !value) throw new Error('Invalid ' + label + '.')
  const decoded = Buffer.from(value, 'base64')
  if (!decoded.length) throw new Error('Invalid ' + label + '.')
  return decoded
}

const textValue = (value: unknown, fallback: string, maxLength: number): string => {
  if (typeof value !== 'string' || !value.trim()) return fallback
  return value.trim().slice(0, maxLength)
}

export function wrapKeyEnvelope(input: {
  key: Buffer
  contentIv: Buffer
  contentType: unknown
  originalName: unknown
}): Buffer {
  if (input.key.length !== 32) throw new Error('Premium data keys must be 32 bytes.')
  if (input.contentIv.length !== 12) throw new Error('Premium content IVs must be 12 bytes.')
  const wrapIv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secretKey(), wrapIv)
  const ciphertext = Buffer.concat([cipher.update(input.key), cipher.final()])
  const wrappedKey = Buffer.concat([ciphertext, cipher.getAuthTag()])
  const envelope: Envelope = {
    version: 1,
    wrapIv: wrapIv.toString('base64'),
    wrappedKey: wrappedKey.toString('base64'),
    contentIv: input.contentIv.toString('base64'),
    contentType: textValue(input.contentType, 'application/octet-stream', 160),
    originalName: textValue(input.originalName, 'download', 180),
  }
  return Buffer.from(JSON.stringify(envelope), 'utf8')
}

export function unwrapKeyEnvelope(encodedEnvelope: Buffer): UnwrappedKey {
  let parsed: Envelope
  try {
    parsed = JSON.parse(encodedEnvelope.toString('utf8')) as Envelope
  } catch {
    throw new Error('The on-chain premium key envelope is not valid JSON.')
  }
  if (parsed.version !== 1) throw new Error('Unsupported premium key envelope version.')
  const wrapIv = decodeBase64(parsed.wrapIv, 'key envelope IV')
  const wrappedKey = decodeBase64(parsed.wrappedKey, 'wrapped key')
  if (wrapIv.length !== 12 || wrappedKey.length <= 16) throw new Error('Malformed premium key envelope.')
  const ciphertext = wrappedKey.subarray(0, wrappedKey.length - 16)
  const authTag = wrappedKey.subarray(wrappedKey.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), wrapIv)
  decipher.setAuthTag(authTag)
  const key = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  const contentIv = decodeBase64(parsed.contentIv, 'content IV')
  if (key.length !== 32 || contentIv.length !== 12) throw new Error('Malformed premium key envelope.')
  return {
    key,
    contentIv,
    contentType: textValue(parsed.contentType, 'application/octet-stream', 160),
    originalName: textValue(parsed.originalName, 'download', 180),
  }
}
