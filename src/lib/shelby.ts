import {
  AccountAddress,
  Aptos,
  AptosConfig,
  parseTypeTag,
  type EntryFunctionABI,
  type InputEntryFunctionData,
} from '@aptos-labs/ts-sdk'
import {
  defaultErasureCodingConfig,
  ShelbyBlobClient,
  ShelbyClient,
  type FullObjectMetadata,
} from '@shelby-protocol/sdk/browser'
import {
  APTOS_EXPLORER_URL,
  APTOS_FULLNODE_URL,
  APTOS_INDEXER_URL,
  SHELBY_API_KEY,
  SHELBY_INDEXER_URL,
  SHELBY_LOCATION,
  SHELBY_NETWORK,
  SHELBY_NETWORK_NAME,
  SHELBY_RPC_URL,
} from './config'

export { APTOS_EXPLORER_URL, SHELBY_INDEXER_URL as SHELBYNET_INDEXER_URL, SHELBY_LOCATION, SHELBY_NETWORK_NAME }
const SHELBY_GRAPHQL_PAGE_SIZE = 100
const SHELBY_GRAPHQL_MAX_PAGES = 50
const SHELBY_INDEXER_TIMEOUT_MS = 20_000
// Keep the registration ABI explicit for wallet adapters that build the
// transaction locally. This prevents an outdated/cached remote ABI from
// shifting the two Option<String> location arguments in Petra.
const SHELBY_REGISTER_BLOB_ABI: EntryFunctionABI = {
  signers: 1,
  typeParameters: [],
  parameters: [
    parseTypeTag('0x1::string::String'),
    parseTypeTag('0x1::option::Option<0x1::string::String>'),
    parseTypeTag('0x1::option::Option<0x1::string::String>'),
    parseTypeTag('u64'),
    parseTypeTag('vector<u8>'),
    parseTypeTag('u32'),
    parseTypeTag('u64'),
    parseTypeTag('u8'),
    parseTypeTag('u8'),
    parseTypeTag('u8'),
  ],
}

/**
 * Build the register payload in the exact shape expected by the live
 * shelbynet ABI and by older Petra wallet-standard implementations.
 */
export function createShelbyRegisterBlobPayload(
  params: Parameters<typeof ShelbyBlobClient.createRegisterBlobPayload>[0],
): InputEntryFunctionData {
  const payload = ShelbyBlobClient.createRegisterBlobPayload(params) as InputEntryFunctionData

  return {
    ...payload,
    abi: SHELBY_REGISTER_BLOB_ABI,
    functionArguments: payload.functionArguments.map((argument) => {
      if (argument instanceof Uint8Array) return Array.from(argument)
      if (typeof argument === 'number') return String(argument)
      return argument
    }),
  }
}

type ShelbyGraphqlBlob = {
  object_name: string
  owner: string
  blob_commitment: string
  expires_at: string | number | null
  created_at: string | number | null
  is_deleted: string | number | boolean | null
  is_persisted: string | number | boolean | null
  is_committed: string | number | boolean | null
  size: string | number | null
  slice_address: string | null
}

type ShelbyGraphqlResponse = {
  data?: { blobs?: ShelbyGraphqlBlob[] }
  errors?: Array<{ message?: string }>
}

const GET_BLOBS_QUERY = [
  'query KaryaChainBlobs($limit: Int!, $offset: Int!, $expiresAt: numeric!) {',
  '  blobs(where: { expires_at: { _gte: $expiresAt }, is_deleted: { _eq: "0" }, is_committed: { _eq: "1" } }, limit: $limit, offset: $offset) {',
  '    object_name',
  '    owner',
  '    blob_commitment',
  '    expires_at',
  '    created_at',
  '    is_deleted',
  '    is_persisted',
  '    is_committed',
  '    size',
  '    slice_address',
  '  }',
  '}',
].join('\n')

const GET_ACCOUNT_BLOBS_QUERY = [
  'query KaryaChainAccountBlobs($owner: String!, $limit: Int!, $offset: Int!, $expiresAt: numeric!) {',
  '  blobs(where: { owner: { _eq: $owner }, expires_at: { _gte: $expiresAt }, is_deleted: { _eq: "0" }, is_committed: { _eq: "1" } }, limit: $limit, offset: $offset) {',
  '    object_name',
  '    owner',
  '    blob_commitment',
  '    expires_at',
  '    created_at',
  '    is_deleted',
  '    is_persisted',
  '    is_committed',
  '    size',
  '    slice_address',
  '  }',
  '}',
].join('\n')

const toNumber = (value: string | number | null): number => Number(value ?? 0)

const toBoolean = (value: string | number | boolean | null): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return value === '1' || value?.toLowerCase() === 'true'
}

const hexToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/^0x/i, '')
  if (!normalized) return new Uint8Array()
  const padded = normalized.length % 2 === 0 ? normalized : '0' + normalized
  if (!/^[0-9a-f]+$/i.test(padded)) {
    throw new Error('Shelby returned an invalid blob commitment.')
  }

  const bytes = new Uint8Array(padded.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(padded.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

const getBlobNameSuffix = (fullName: string): string => {
  const separator = fullName.indexOf('/')
  return fullName.startsWith('@') && separator >= 0
    ? fullName.slice(separator + 1)
    : fullName
}

const toBlobMetadata = (blob: ShelbyGraphqlBlob): FullObjectMetadata => {
  const owner = AccountAddress.fromString(blob.owner)
  const isPersisted = toBoolean(blob.is_persisted)
  const isCommitted = toBoolean(blob.is_committed)

  return {
    owner,
    name: blob.object_name,
    blobNameSuffix: getBlobNameSuffix(blob.object_name),
    blobMerkleRoot: hexToBytes(blob.blob_commitment),
    size: toNumber(blob.size),
    encoding: {
      variant: 'clay',
      ...defaultErasureCodingConfig(),
    },
    expirationMicros: toNumber(blob.expires_at),
    creationMicros: toNumber(blob.created_at),
    sliceAddress: blob.slice_address
      ? AccountAddress.fromString(blob.slice_address)
      : owner,
    isWritten: isPersisted || isCommitted,
    isDeleted: toBoolean(blob.is_deleted),
  }
}

const fetchBlobPage = async (offset: number, owner?: string, limit = SHELBY_GRAPHQL_PAGE_SIZE): Promise<ShelbyGraphqlBlob[]> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-aptos-client': 'karyachain',
  }
  if (SHELBY_API_KEY) headers.Authorization = 'Bearer ' + SHELBY_API_KEY
  if (!SHELBY_INDEXER_URL) {
    throw new Error('Shelby indexer is not configured for this environment.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SHELBY_INDEXER_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(SHELBY_INDEXER_URL, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        query: owner ? GET_ACCOUNT_BLOBS_QUERY : GET_BLOBS_QUERY,
        variables: owner
          ? { owner, limit, offset, expiresAt: String(Date.now() * 1000) }
          : { limit, offset, expiresAt: String(Date.now() * 1000) },
      }),
    })
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error('Shelby indexer request timed out. Check the network and try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  let payload: ShelbyGraphqlResponse
  try {
    payload = await response.json() as ShelbyGraphqlResponse
  } catch {
    throw new Error('Shelby indexer returned an invalid response (' + response.status + ').')
  }
  const errors = payload.errors
    ?.map(error => error.message)
    .filter((message): message is string => !!message)

  if (!response.ok || errors?.length) {
    throw new Error(errors?.join('; ') || 'Shelby indexer request failed.')
  }

  return payload.data?.blobs ?? []
}


export type ShelbyBlobPage = {
  items: FullObjectMetadata[]
  offset: number
  limit: number
  hasMore: boolean
}

export async function getShelbyBlobsPage({
  account,
  offset = 0,
  limit = 24,
}: { account?: string; offset?: number; limit?: number } = {}): Promise<ShelbyBlobPage> {
  const safeOffset = Math.max(0, Math.floor(offset))
  const safeLimit = Math.min(SHELBY_GRAPHQL_PAGE_SIZE, Math.max(1, Math.floor(limit)))
  const normalizedAccount = account?.toLowerCase()
  const rows = await fetchBlobPage(safeOffset, normalizedAccount, safeLimit)
  const items = rows
    .filter(blob => !normalizedAccount || blob.owner.toLowerCase() === normalizedAccount)
    .map(toBlobMetadata)

  return {
    items,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: rows.length === safeLimit,
  }
}
const aptosSettings = {
  network: SHELBY_NETWORK,
  ...(APTOS_FULLNODE_URL ? { fullnode: APTOS_FULLNODE_URL } : {}),
  ...(APTOS_INDEXER_URL ? { indexer: APTOS_INDEXER_URL } : {}),
  clientConfig: SHELBY_API_KEY ? { API_KEY: SHELBY_API_KEY } : undefined,
}

export const aptosClient = new Aptos(new AptosConfig(aptosSettings))

export const shelbyClient = new ShelbyClient({
  network: SHELBY_NETWORK,
  apiKey: SHELBY_API_KEY,
  locationHint: SHELBY_LOCATION,
  rpc: {
    ...(SHELBY_RPC_URL ? { baseUrl: SHELBY_RPC_URL } : {}),
    ...(SHELBY_API_KEY ? { apiKey: SHELBY_API_KEY } : {}),
  },
  indexer: {
    ...(SHELBY_INDEXER_URL ? { baseUrl: SHELBY_INDEXER_URL } : {}),
    ...(SHELBY_API_KEY ? { apiKey: SHELBY_API_KEY } : {}),
  },
  aptos: {
    ...aptosSettings,
  },
})

export async function getShelbyBlobs(account?: string): Promise<FullObjectMetadata[]> {
  const normalizedAccount = account?.toLowerCase()
  const rows: ShelbyGraphqlBlob[] = []

  for (let page = 0; page < SHELBY_GRAPHQL_MAX_PAGES; page += 1) {
    const pageRows = await fetchBlobPage(page * SHELBY_GRAPHQL_PAGE_SIZE, normalizedAccount)
    rows.push(...pageRows)
    if (pageRows.length < SHELBY_GRAPHQL_PAGE_SIZE) break
  }
  return rows
    .filter(blob => !normalizedAccount || blob.owner.toLowerCase() === normalizedAccount)
    .map(toBlobMetadata)
}

export async function downloadShelbyBlob(account: string, blobName: string): Promise<Blob> {
  const response = await shelbyClient.rpc.getBlob({ account, blobName })
  return new Response(response.readable).blob()
}
