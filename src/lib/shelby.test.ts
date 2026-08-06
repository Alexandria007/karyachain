import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountAddress } from '@aptos-labs/ts-sdk'
import { createShelbyRegisterBlobPayload, getShelbyBlobsPage, SHELBY_LOCATION } from './shelby'

describe('Shelby register payload', () => {
  it('pins the live ABI and serializes wallet-facing arguments safely', () => {
    const payload = createShelbyRegisterBlobPayload({
      account: AccountAddress.fromString(
        '0x0000000000000000000000000000000000000000000000000000000000001234',
      ),
      blobName: 'KARYA:v1:photo:free:0:cover.png',
      selectedLocation: SHELBY_LOCATION,
      locationHint: SHELBY_LOCATION,
      blobMerkleRoot: '0x000102ff',
      numChunksets: 1,
      expirationMicros: 1_800_000_000_000_000,
      blobSize: 4,
      encoding: 0,
    })

    expect(payload.function).toContain('::blob_metadata::register_blob')
    expect(payload.abi?.parameters).toHaveLength(10)
    expect(payload.abi?.parameters[1].toString()).toContain('Option')
    expect(payload.abi?.parameters[2].toString()).toContain('Option')
    expect(payload.functionArguments[1]).toBe(SHELBY_LOCATION)
    expect(payload.functionArguments[2]).toBe(SHELBY_LOCATION)
    expect(payload.functionArguments[3]).toBe('1800000000000000')
    expect(payload.functionArguments[4]).toEqual([0, 1, 2, 255])
    expect(payload.functionArguments.slice(5).every(argument => typeof argument === 'string')).toBe(true)
  })

  it('fetches bounded indexer pages on demand', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { blobs: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const page = await getShelbyBlobsPage({ offset: 24, limit: 24 })

    expect(page).toEqual({ items: [], offset: 24, limit: 24, hasMore: false })
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(request.variables).toMatchObject({ limit: 24, offset: 24 })
    expect(typeof request.variables.expiresAt).toBe('string')
    expect(request.query).toContain('is_committed: { _eq: "1" }')
  })

  it("uses Shelby server-side owner filtering for creator searches", async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { blobs: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const account = '0x0000000000000000000000000000000000000000000000000000000000001234'

    await getShelbyBlobsPage({ account, offset: 24, limit: 24 })

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(request.query).toContain('owner: { _eq: $owner }')
    expect(request.variables).toMatchObject({ owner: account, limit: 24, offset: 24 })
    expect(typeof request.variables.expiresAt).toBe('string')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
})
