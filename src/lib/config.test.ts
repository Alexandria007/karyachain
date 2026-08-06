import { describe, expect, it } from 'vitest'
import { Network } from '@aptos-labs/ts-sdk'
import { createRuntimeConfig } from './config'

describe('runtime configuration', () => {
  it('keeps shelbynet review defaults and location stable', () => {
    const config = createRuntimeConfig({
      VITE_SHELBY_NETWORK: 'shelbynet',
      VITE_APTOS_API_KEY: 'public-review-key',
    })

    expect(config.network).toBe(Network.SHELBYNET)
    expect(config.networkName).toBe('shelbynet')
    expect(config.location).toBe('shelbynet-1')
    expect(config.rpcUrl).toContain('api.shelbynet.shelby.xyz')
    expect(config.indexerUrl).toContain('/v1/graphql')
    expect(config.warnings).toEqual([])
  })

  it('supports endpoint overrides without source changes', () => {
    const config = createRuntimeConfig({
      VITE_SHELBY_NETWORK: 'local',
      VITE_SHELBY_LOCATION: 'private-1',
      VITE_SHELBY_API_KEY: 'private-review-key',
      VITE_SHELBY_RPC_URL: 'https://private.example/rpc',
      VITE_SHELBY_INDEXER_URL: 'https://private.example/graphql',
      VITE_APTOS_FULLNODE_URL: 'https://private.example/aptos',
      VITE_APTOS_INDEXER_URL: 'https://private.example/indexer',
    })

    expect(config.network).toBe(Network.LOCAL)
    expect(config.location).toBe('private-1')
    expect(config.rpcUrl).toBe('https://private.example/rpc')
    expect(config.indexerUrl).toBe('https://private.example/graphql')
    expect(config.aptosFullnodeUrl).toBe('https://private.example/aptos')
    expect(config.warnings).toEqual([])
  })

  it('falls back safely for an invalid network value', () => {
    const config = createRuntimeConfig({ VITE_SHELBY_NETWORK: 'wrong-network' })

    expect(config.network).toBe(Network.SHELBYNET)
    expect(config.warnings[0]).toContain('Unsupported Shelby network')
  })
})
