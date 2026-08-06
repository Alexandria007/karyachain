import { Ed25519PublicKey, Ed25519Signature } from '@aptos-labs/ts-sdk'
import { unwrapKeyEnvelope } from './_lib/keyEnvelope'
import { allowOptions, bodyRecord, sendJson, type ApiRequest, type ApiResponse } from './_lib/http'

const KEY_RELEASE_MESSAGE_VERSION = 'KARYACHAIN_KEY_RELEASE_V1'
const PROOF_MAX_AGE_MS = 5 * 60 * 1000

const normalizeAddress = (value: string): string => {
  const hex = value.replace(/^0x/i, '').replace(/^0+/, '') || '0'
  return '0x' + hex.toLowerCase()
}

const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-f]{1,64}$/i.test(value)

const viewEndpoint = (): string => {
  const configured = (process.env.KARYA_APTOS_FULLNODE_URL || process.env.APTOS_FULLNODE_URL || '').replace(/\/+$/, '')
  if (!configured) throw new Error('KARYA_APTOS_FULLNODE_URL is not configured.')
  return configured.endsWith('/v1') ? configured + '/view' : configured + '/v1/view'
}

const accountEndpoint = (address: string): string => {
  const configured = (process.env.KARYA_APTOS_FULLNODE_URL || process.env.APTOS_FULLNODE_URL || '').replace(/\/+$/, '')
  if (!configured) throw new Error('KARYA_APTOS_FULLNODE_URL is not configured.')
  return (configured.endsWith('/v1') ? configured : configured + '/v1') + '/accounts/' + address
}

const registryAddress = (): string => {
  const configured = (process.env.KARYA_REGISTRY_ADDRESS || '').trim()
  if (!isAddress(configured)) throw new Error('KARYA_REGISTRY_ADDRESS is not configured.')
  return normalizeAddress(configured)
}

const workIdHex = (value: Buffer): string => '0x' + value.toString('hex')

const vectorToBuffer = (value: unknown): Buffer => {
  if (typeof value === 'string') {
    if (!value.startsWith('0x')) throw new Error('Aptos returned an invalid vector<u8>.')
    return Buffer.from(value.slice(2), 'hex')
  }
  if (Array.isArray(value)) return Buffer.from(value.map(item => Number(item)))
  throw new Error('Aptos returned an invalid vector<u8>.')
}

const aptosHeaders = (): Record<string, string> => {
  const apiKey = (process.env.KARYA_APTOS_API_KEY || process.env.APTOS_API_KEY || '').trim()
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey
  return headers
}

const view = async (functionName: string, argumentsList: string[]): Promise<unknown[]> => {
  const response = await fetch(viewEndpoint(), {
    method: 'POST',
    headers: aptosHeaders(),
    body: JSON.stringify({
      function: registryAddress() + '::registry::' + functionName,
      type_arguments: [],
      arguments: argumentsList,
    }),
  })
  const body = await response.json().catch(() => ({})) as unknown
  if (!response.ok) throw new Error('Aptos view request failed with HTTP ' + response.status + '.')
  if (!Array.isArray(body)) throw new Error('Aptos view returned an invalid response.')
  return body
}

const isTrue = (value: unknown): boolean =>
  value === true || String(value).toLowerCase() === 'true' || String(value) === '1'

const base64WorkId = (value: string): Buffer => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error('The work ID must be canonical base64.')
  }
  const decoded = Buffer.from(value, 'base64')
  if (decoded.length !== 32) throw new Error('The work ID must be a 32-byte hash.')
  return decoded
}

const verifyWalletProof = async ({
  buyer,
  workIdValue,
  fullMessage,
  signature,
  nonce,
  message,
}: {
  buyer: string
  workIdValue: string
  fullMessage: string
  signature: string
  nonce: string
  message: string
}): Promise<void> => {
  const normalizedBuyer = normalizeAddress(buyer)
  const expected = new RegExp(
    '^' + KEY_RELEASE_MESSAGE_VERSION + '\\|work_id=(.+)\\|buyer=(0x[0-9a-f]{1,64})\\|issued_at=(\\d+)$',
    'i',
  ).exec(message)
  if (!expected || expected[1] !== workIdValue || normalizeAddress(expected[2]) !== normalizedBuyer) {
    throw new Error('The signed key-release message does not match this buyer and work.')
  }

  const issuedAt = Number(expected[3])
  if (!Number.isSafeInteger(issuedAt) || Math.abs(Date.now() - issuedAt) > PROOF_MAX_AGE_MS) {
    throw new Error('The wallet proof has expired. Sign the key-release request again.')
  }
  if (!/^[0-9a-f]{32,128}$/i.test(nonce)) {
    throw new Error('The wallet proof nonce is invalid.')
  }
  if (!fullMessage.startsWith('APTOS\n') || fullMessage.length > 4096) {
    throw new Error('The wallet returned an invalid Aptos signed message.')
  }
  if (!fullMessage.includes('\nmessage: ' + message + '\n') || !fullMessage.includes('\nnonce: ' + nonce)) {
    throw new Error('The signed Aptos message body does not match the request.')
  }
  const expectedApplication = (process.env.KARYA_SIGNING_APPLICATION || '').trim()
  if (!expectedApplication) {
    throw new Error('KARYA_SIGNING_APPLICATION is not configured for key-release origin binding.')
  }
  const signedApplication = /(?:^|\n)application:\s*(.+)(?:\n|$)/i.exec(fullMessage)?.[1]?.trim()
  if (signedApplication !== expectedApplication) {
    throw new Error('The wallet signature was created for a different application origin.')
  }
  const expectedChainId = (process.env.KARYA_APTOS_CHAIN_ID || '').trim()
  if (expectedChainId) {
    const signedChainId = /(?:^|\n)chainId:\s*([^\n]+)(?:\n|$)/i.exec(fullMessage)?.[1]?.trim()
    if (signedChainId !== expectedChainId) {
      throw new Error('The wallet signature was created for a different Aptos chain.')
    }
  }
  const signedAddress = /(?:^|\n)address:\s*(0x[0-9a-f]{1,64})(?:\n|$)/i.exec(fullMessage)
  if (signedAddress && normalizeAddress(signedAddress[1]) !== normalizedBuyer) {
    throw new Error('The wallet signature belongs to a different address.')
  }
  if (!/^0x[0-9a-f]{128}$/i.test(signature) && !/^[0-9a-f]{128}$/i.test(signature)) {
    throw new Error('The wallet returned an invalid Ed25519 signature.')
  }

  const accountResponse = await fetch(accountEndpoint(normalizedBuyer), {
    method: 'GET',
    headers: aptosHeaders(),
  })
  const accountBody = await accountResponse.json().catch(() => ({})) as { public_key?: unknown }
  if (!accountResponse.ok || typeof accountBody.public_key !== 'string') {
    throw new Error('The Aptos account public key could not be resolved for wallet proof verification.')
  }
  const publicKey = accountBody.public_key
  if (!/^0x[0-9a-f]{64}$/i.test(publicKey)) {
    throw new Error('This account uses a public-key scheme not supported by the current key-release verifier.')
  }

  const normalizedSignature = signature.startsWith('0x') ? signature : '0x' + signature
  const valid = new Ed25519PublicKey(publicKey).verifySignature({
    message: new TextEncoder().encode(fullMessage),
    signature: new Ed25519Signature(normalizedSignature),
  })
  if (!valid) throw new Error('The wallet signature could not be verified against the Aptos account key.')
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (allowOptions(req, res)) return
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'POST is required.' })
    return
  }

  try {
    const body = bodyRecord(req)
    if (body.version !== 1) {
      sendJson(res, 400, { error: 'Unsupported key-release version.' })
      return
    }
    const buyer = body.buyer
    const workIdValue = body.workId
    const fullMessage = body.fullMessage
    const signature = body.signature
    const nonce = body.nonce
    const message = body.message
    if (!isAddress(buyer)) {
      sendJson(res, 400, { error: 'A valid buyer Aptos address is required.' })
      return
    }
    if (typeof workIdValue !== 'string') {
      sendJson(res, 400, { error: 'A base64 work ID is required.' })
      return
    }
    if (
      typeof fullMessage !== 'string' ||
      typeof signature !== 'string' ||
      typeof nonce !== 'string' ||
      typeof message !== 'string'
    ) {
      sendJson(res, 400, { error: 'A signed Aptos wallet proof is required.' })
      return
    }

    let workId: Buffer
    try {
      workId = base64WorkId(workIdValue)
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'The work ID is invalid.' })
      return
    }
    try {
      await verifyWalletProof({ buyer, workIdValue, fullMessage, signature, nonce, message })
    } catch (error) {
      sendJson(res, 403, { error: error instanceof Error ? error.message : 'Wallet proof verification failed.' })
      return
    }

    const work = await view('get_work', [workIdHex(workId)])
    if (work.length < 13) throw new Error('Aptos returned an incomplete Work record.')
    const creator = normalizeAddress(String(work[0]))
    const expiresAtMicros = Number(work[6])
    const active = isTrue(work[12])
    if (!active) {
      sendJson(res, 403, { error: 'This work is inactive.' })
      return
    }
    if (!Number.isSafeInteger(expiresAtMicros) || expiresAtMicros < Date.now() * 1000) {
      sendJson(res, 410, { error: 'This work has expired.' })
      return
    }

    const normalizedBuyer = normalizeAddress(buyer)
    if (normalizedBuyer !== creator) {
      const entitlement = await view('has_entitlement', [normalizedBuyer, workIdHex(workId)])
      if (!isTrue(entitlement[0])) {
        sendJson(res, 403, { error: 'No on-chain entitlement exists for this wallet and work.' })
        return
      }
    }

    const envelope = vectorToBuffer(work[11])
    if (!envelope.length) {
      sendJson(res, 409, { error: 'This work was not uploaded with encrypted premium content.' })
      return
    }

    const released = unwrapKeyEnvelope(envelope)
    res
      .status(200)
      .setHeader('cache-control', 'no-store, no-cache, must-revalidate')
      .setHeader('pragma', 'no-cache')
      .json({
        version: 1,
        key: released.key.toString('base64'),
        contentIv: released.contentIv.toString('base64'),
        contentType: released.contentType,
        originalName: released.originalName,
        expiresAtMicros,
      })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Key release failed.'
    sendJson(res, 500, { error: message })
  }
}