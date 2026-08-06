import type { InputEntryFunctionData } from '@aptos-labs/ts-sdk'
import { aptosClient } from './shelby'
import {
  APTOS_INDEXER_URL,
  KARYA_REGISTRY_ADDRESS,
  KARYA_REGISTRY_ENABLED,
  SHELBY_NETWORK_NAME,
  SHELBY_USD_METADATA as CONFIGURED_SHELBY_USD_METADATA,
} from './config'
import { reportClientError } from './diagnostics'

export const KARYA_REGISTRY_MODULE = KARYA_REGISTRY_ADDRESS
  ? KARYA_REGISTRY_ADDRESS + '::registry'
  : undefined

export const SHELBY_USD_METADATA = CONFIGURED_SHELBY_USD_METADATA

export type RegistryWork = {
  creator: string
  shelbyOwner: string
  blobName: string
  merkleRoot: Uint8Array
  size: number
  createdAtMicros: number
  expiresAtMicros: number
  revision: number
  parentWorkId: Uint8Array
  priceMicro: string
  currencyMetadata: string
  encryptedKeyEnvelope: Uint8Array
  active: boolean
}

export type RegistryEvent = {
  type: string
  indexedType: string
  accountAddress: string
  transactionVersion: string
  transactionBlockHeight: string
  eventIndex: string
  sequenceNumber: string
  data: unknown
}

const encoder = new TextEncoder()

export const normalizeAddress = (value: string): string => {
  const hex = String(value || '').replace(/^0x/i, '').replace(/^0+/, '') || '0'
  return '0x' + hex.toLowerCase()
}

export const bytesToHex = (bytes: Uint8Array): string =>
  '0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const hexToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/^0x/i, '')
  if (!normalized) return new Uint8Array()
  const padded = normalized.length % 2 === 0 ? normalized : '0' + normalized
  if (!/^[0-9a-f]+$/i.test(padded)) throw new Error('Aptos returned invalid vector<u8> data.')
  const bytes = new Uint8Array(padded.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(padded.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

const vectorBytes = (value: Uint8Array | string): number[] =>
  Array.from(typeof value === 'string' ? encoder.encode(value) : value)

const valueToBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return new Uint8Array(value.map(item => Number(item)))
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return hexToBytes(value)
    try {
      return base64ToBytes(value)
    } catch {
      return encoder.encode(value)
    }
  }
  if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data
    if (data instanceof Uint8Array) return data
    if (Array.isArray(data)) return new Uint8Array(data.map(item => Number(item)))
  }
  throw new Error('Aptos returned an invalid vector<u8> value.')
}

const valueToAddress = (value: unknown): string => normalizeAddress(String(value))

const valueToNumber = (value: unknown): number => {
  const result = Number(value)
  if (!Number.isSafeInteger(result)) throw new Error('Aptos returned an invalid integer value.')
  return result
}

const valueToBool = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  return String(value).toLowerCase() === 'true' || String(value) === '1'
}

const requireRegistry = (): string => {
  if (!KARYA_REGISTRY_ENABLED || !KARYA_REGISTRY_MODULE) {
    throw new Error('The KaryaRegistry module is not configured for this environment.')
  }
  return KARYA_REGISTRY_MODULE
}

const viewFunctionName = (name: string): string =>
  requireRegistry() + '::' + name

const view = async (name: string, functionArguments: unknown[]): Promise<unknown[]> => {
  const result = await aptosClient.view({
    payload: {
      function: viewFunctionName(name) as never,
      functionArguments: functionArguments as never,
    },
  })
  return result as unknown[]
}

export async function deriveWorkId(ownerAddress: string, blobNameSuffix: string): Promise<Uint8Array> {
  const input = encoder.encode(
    'karyachain:work:v1:' + normalizeAddress(ownerAddress) + ':' + blobNameSuffix,
  )
  const digest = await crypto.subtle.digest('SHA-256', input)
  return new Uint8Array(digest)
}

export function createPublishWorkPayload(params: {
  workId: Uint8Array
  blobName: string
  merkleRoot: Uint8Array
  size: number
  expiresAtMicros: number
  revision: number
  parentWorkId: Uint8Array
  priceMicro: string
  currencyMetadata: string
  encryptedKeyEnvelope: Uint8Array
}): InputEntryFunctionData {
  const moduleName = requireRegistry()
  return {
    function: moduleName + '::publish_work',
    functionArguments: [
      vectorBytes(params.workId),
      vectorBytes(params.blobName),
      vectorBytes(params.merkleRoot),
      String(params.size),
      String(params.expiresAtMicros),
      String(params.revision),
      vectorBytes(params.parentWorkId),
      String(params.priceMicro),
      normalizeAddress(params.currencyMetadata),
      vectorBytes(params.encryptedKeyEnvelope),
    ],
  } as InputEntryFunctionData
}

export function createPurchaseWorkPayload(workId: Uint8Array): InputEntryFunctionData {
  const moduleName = requireRegistry()
  return {
    function: moduleName + '::purchase',
    functionArguments: [vectorBytes(workId), normalizeAddress(SHELBY_USD_METADATA)],
  } as InputEntryFunctionData
}

export function createSetWorkActivePayload(workId: Uint8Array, active: boolean): InputEntryFunctionData {
  const moduleName = requireRegistry()
  return {
    function: moduleName + '::set_work_active',
    functionArguments: [vectorBytes(workId), active],
  } as InputEntryFunctionData
}

export async function registryWorkExists(workId: Uint8Array): Promise<boolean> {
  const result = await view('work_exists', [vectorBytes(workId)])
  return valueToBool(result[0])
}

export async function getRegistryWork(workId: Uint8Array): Promise<RegistryWork> {
  const result = await view('get_work', [vectorBytes(workId)])
  if (result.length < 13) throw new Error('KaryaRegistry returned an incomplete Work record.')
  return {
    creator: valueToAddress(result[0]),
    shelbyOwner: valueToAddress(result[1]),
    blobName: new TextDecoder().decode(valueToBytes(result[2])),
    merkleRoot: valueToBytes(result[3]),
    size: valueToNumber(result[4]),
    createdAtMicros: valueToNumber(result[5]),
    expiresAtMicros: valueToNumber(result[6]),
    revision: valueToNumber(result[7]),
    parentWorkId: valueToBytes(result[8]),
    priceMicro: String(result[9]),
    currencyMetadata: valueToAddress(result[10]),
    encryptedKeyEnvelope: valueToBytes(result[11]),
    active: valueToBool(result[12]),
  }
}

export async function getRegistryWorkForBlob(
  ownerAddress: string,
  blobNameSuffix: string,
): Promise<{ workId: Uint8Array; work: RegistryWork } | null> {
  const workId = await deriveWorkId(ownerAddress, blobNameSuffix)
  if (!(await registryWorkExists(workId))) return null
  return { workId, work: await getRegistryWork(workId) }
}

export async function hasRegistryEntitlement(
  buyerAddress: string,
  ownerAddress: string,
  blobNameSuffix: string,
): Promise<boolean | null> {
  if (!KARYA_REGISTRY_ENABLED) return null
  const record = await getRegistryWorkForBlob(ownerAddress, blobNameSuffix)
  if (!record) return null
  if (normalizeAddress(buyerAddress) === normalizeAddress(record.work.creator)) return true
  const result = await view('has_entitlement', [
    normalizeAddress(buyerAddress),
    vectorBytes(record.workId),
  ])
  return valueToBool(result[0])
}

export async function getRegistryEntitlement(
  buyerAddress: string,
  workId: Uint8Array,
): Promise<{ exists: boolean; grantedAtMicros: number; expiresAtMicros: number }> {
  const result = await view('get_entitlement', [
    normalizeAddress(buyerAddress),
    vectorBytes(workId),
  ])
  return {
    exists: valueToBool(result[0]),
    grantedAtMicros: valueToNumber(result[1]),
    expiresAtMicros: valueToNumber(result[2]),
  }
}

export async function listRegistryEvents(limit = 100): Promise<RegistryEvent[]> {
  if (!KARYA_REGISTRY_MODULE || !APTOS_INDEXER_URL) return []
  const query = [
    'query KaryaRegistryEvents($where: events_bool_exp, $limit: Int!) {',
    '  events(where: $where, limit: $limit, order_by: {transaction_version: desc}) {',
    '    account_address',
    '    type',
    '    indexed_type',
    '    data',
    '    event_index',
    '    sequence_number',
    '    transaction_version',
    '    transaction_block_height',
    '  }',
    '}',
  ].join('\n')
  const response = await fetch(APTOS_INDEXER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: {
        where: { type: { _like: KARYA_REGISTRY_MODULE + '::%' } },
        limit: Math.min(100, Math.max(1, Math.floor(limit))),
      },
    }),
  })
  const body = await response.json() as {
    data?: { events?: RegistryEvent[] }
    errors?: Array<{ message?: string }>
  }
  if (!response.ok || body.errors?.length) {
    throw new Error(body.errors?.map(error => error.message).filter(Boolean).join('; ') || 'Aptos Indexer event query failed.')
  }
  return body.data?.events ?? []
}

export function reportRegistryError(operation: string, error: unknown): void {
  reportClientError('registry.' + operation, error, {
    source: 'aptos-registry',
    network: SHELBY_NETWORK_NAME,
    retryable: true,
  })
}
