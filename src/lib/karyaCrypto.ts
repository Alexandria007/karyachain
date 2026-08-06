import {
  base64ToBytes,
  bytesToBase64,
} from './karyaRegistry'
import { KARYA_KEY_SERVICE_URL } from './config'

export type PremiumEncryptionResult = {
  ciphertext: Uint8Array
  keyBytes: Uint8Array
  contentIv: Uint8Array
  originalSize: number
}

export type KeyRelease = {
  keyBytes: Uint8Array
  contentIv: Uint8Array
  contentType: string
  originalName: string
  expiresAtMicros: number
}

const serviceEndpoint = (route: string): string => {
  const base = KARYA_KEY_SERVICE_URL.replace(/\/+$/, '')
  if (!base) return '/api/' + route
  return base.endsWith('/api') ? base + '/' + route : base + '/api/' + route
}

const requireWebCrypto = (): Crypto => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable. Premium encryption requires HTTPS or localhost.')
  }
  return globalThis.crypto
}

const importAesKey = async (keyBytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> =>
  requireWebCrypto().subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'AES-GCM' },
    false,
    usages,
  )

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  const body = await response.json().catch(() => ({})) as unknown
  if (!response.ok || typeof body !== 'object' || body === null) {
    const message = typeof body === 'object' && body !== null && 'error' in body
      ? String((body as { error?: unknown }).error)
      : 'Key service request failed.'
    throw new Error(message)
  }
  return body as Record<string, unknown>
}

export async function encryptPremiumFile(file: File): Promise<PremiumEncryptionResult> {
  const webCrypto = requireWebCrypto()
  const keyBytes = webCrypto.getRandomValues(new Uint8Array(32))
  const contentIv = webCrypto.getRandomValues(new Uint8Array(12))
  const key = await importAesKey(keyBytes, ['encrypt'])
  const ciphertext = await webCrypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(contentIv) },
    key,
    await file.arrayBuffer(),
  )
  return {
    ciphertext: new Uint8Array(ciphertext),
    keyBytes: new Uint8Array(keyBytes),
    contentIv,
    originalSize: file.size,
  }
}

export async function requestKeyEnvelope(params: {
  keyBytes: Uint8Array
  contentIv: Uint8Array
  fileName: string
  contentType: string
}): Promise<Uint8Array> {
  const response = await fetch(serviceEndpoint('key-envelope'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: 1,
      key: bytesToBase64(params.keyBytes),
      contentIv: bytesToBase64(params.contentIv),
      fileName: params.fileName,
      contentType: params.contentType || 'application/octet-stream',
    }),
  })
  const body = await readJson(response)
  if (typeof body.envelope !== 'string') throw new Error('Key service returned an invalid key envelope.')
  return base64ToBytes(body.envelope)
}

export async function requestKeyRelease(params: {
  workId: Uint8Array
  buyerAddress: string
  fullMessage: string
  signature: string
  nonce: string
  message: string
}): Promise<KeyRelease> {
  const response = await fetch(serviceEndpoint('key-release'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: 1,
      workId: bytesToBase64(params.workId),
      buyer: params.buyerAddress,
      fullMessage: params.fullMessage,
      signature: params.signature,
      nonce: params.nonce,
      message: params.message,
    }),
  })
  const body = await readJson(response)
  if (
    typeof body.key !== 'string' ||
    typeof body.contentIv !== 'string' ||
    typeof body.contentType !== 'string' ||
    typeof body.originalName !== 'string' ||
    typeof body.expiresAtMicros !== 'number'
  ) {
    throw new Error('Key service returned an invalid release.')
  }
  return {
    keyBytes: base64ToBytes(body.key),
    contentIv: base64ToBytes(body.contentIv),
    contentType: body.contentType || 'application/octet-stream',
    originalName: body.originalName || 'download',
    expiresAtMicros: body.expiresAtMicros,
  }
}

export async function decryptPremiumBlob(blob: Blob, release: KeyRelease): Promise<Blob> {
  const key = await importAesKey(release.keyBytes, ['decrypt'])
  try {
    const plaintext = await requireWebCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(release.contentIv) },
      key,
      await blob.arrayBuffer(),
    )
    return new Blob([plaintext], { type: release.contentType || 'application/octet-stream' })
  } catch {
    throw new Error('Premium ciphertext authentication failed. The work or key envelope may be corrupted.')
  }
}
