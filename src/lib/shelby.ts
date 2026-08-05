import {
  AccountAddress,
  Aptos,
  AptosConfig,
  Network,
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

const aptosApiKey = import.meta.env.VITE_APTOS_API_KEY as string | undefined
const SHELBYNET_RPC_URL = 'https://api.shelbynet.shelby.xyz/shelby'
export const SHELBYNET_INDEXER_URL = 'https://api.shelbynet.shelby.xyz/v1/graphql'
export const SHELBY_LOCATION = 'shelbynet-1'
const SHELBY_GRAPHQL_PAGE_SIZE = 100
const SHELBY_GRAPHQL_MAX_PAGES = 50
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
  'query KaryaChainBlobs($limit: Int!, $offset: Int!) {',
  '  blobs(limit: $limit, offset: $offset) {',
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
  'query KaryaChainAccountBlobs($owner: String!, $limit: Int!, $offset: Int!) {',
  '  blobs(where: { owner: { _eq: $owner } }, limit: $limit, offset: $offset) {',
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

const fetchBlobPage = async (offset: number, owner?: string): Promise<ShelbyGraphqlBlob[]> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-aptos-client': 'karyachain',
  }
  if (aptosApiKey) headers.Authorization = 'Bearer ' + aptosApiKey

  const response = await fetch(SHELBYNET_INDEXER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: owner ? GET_ACCOUNT_BLOBS_QUERY : GET_BLOBS_QUERY,
      variables: owner
        ? { owner, limit: SHELBY_GRAPHQL_PAGE_SIZE, offset }
        : { limit: SHELBY_GRAPHQL_PAGE_SIZE, offset },
    }),
  })

  const payload = await response.json() as ShelbyGraphqlResponse
  const errors = payload.errors
    ?.map(error => error.message)
    .filter((message): message is string => !!message)

  if (!response.ok || errors?.length) {
    throw new Error(errors?.join('; ') || 'Shelby indexer request failed.')
  }

  return payload.data?.blobs ?? []
}

export const aptosClient = new Aptos(new AptosConfig({
  network: Network.SHELBYNET,
  clientConfig: aptosApiKey ? { API_KEY: aptosApiKey } : undefined,
}))

export const shelbyClient = new ShelbyClient({
  network: Network.SHELBYNET,
  apiKey: aptosApiKey,
  locationHint: SHELBY_LOCATION,
  rpc: {
    baseUrl: SHELBYNET_RPC_URL,
    ...(aptosApiKey ? { apiKey: aptosApiKey } : {}),
  },
  indexer: {
    baseUrl: SHELBYNET_INDEXER_URL,
    ...(aptosApiKey ? { apiKey: aptosApiKey } : {}),
  },
  aptos: {
    network: Network.SHELBYNET,
    clientConfig: aptosApiKey ? { API_KEY: aptosApiKey } : undefined,
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
