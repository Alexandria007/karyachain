import type { Network } from '@aptos-labs/ts-sdk'

export type ShelbyRuntimeNetwork = Network.LOCAL | Network.SHELBYNET

type RuntimeEnv = Record<string, unknown>

const LOCAL_NETWORK = 'local' as Network.LOCAL
const SHELBYNET_NETWORK = 'shelbynet' as Network.SHELBYNET

const readEnv = (env: RuntimeEnv, key: string): string => {
  const value = env[key]
  return typeof value === 'string' ? value.trim() : ''
}

export type RuntimeConfig = {
  network: ShelbyRuntimeNetwork
  networkName: 'local' | 'shelbynet'
  networkLabel: string
  apiKey?: string
  location: string
  rpcUrl?: string
  indexerUrl: string
  aptosFullnodeUrl?: string
  aptosIndexerUrl?: string
  shelbyExplorerUrl: string
  aptosExplorerUrl: string
  warnings: string[]
}

/**
 * Build the browser runtime configuration from Vite's public environment.
 * Shelby's browser SDK currently supports shelbynet and local networks.
 * Endpoint overrides keep private/test environments out of the source tree.
 */
export function createRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  const requestedNetwork = readEnv(env, 'VITE_SHELBY_NETWORK').toLowerCase()
  const isLocal = requestedNetwork === 'local'
  const isSupported = requestedNetwork === '' || requestedNetwork === 'shelbynet' || isLocal
  const network: ShelbyRuntimeNetwork = isLocal ? LOCAL_NETWORK : SHELBYNET_NETWORK
  const networkName = isLocal ? 'local' : 'shelbynet'
  const apiKey = readEnv(env, 'VITE_SHELBY_API_KEY') || readEnv(env, 'VITE_APTOS_API_KEY') || undefined
  const defaultIndexerUrl = isLocal ? '' : 'https://api.shelbynet.shelby.xyz/v1/graphql'
  const defaultRpcUrl = isLocal ? '' : 'https://api.shelbynet.shelby.xyz/shelby'
  const warnings: string[] = []

  if (!isSupported) {
    warnings.push(`Unsupported Shelby network "${requestedNetwork}". Falling back to shelbynet.`)
  }
  if (!apiKey) {
    warnings.push('No Shelby/Aptos API key is configured. Requests may be rate-limited.')
  }
  if (isLocal && (!readEnv(env, 'VITE_SHELBY_RPC_URL') || !readEnv(env, 'VITE_SHELBY_INDEXER_URL'))) {
    warnings.push('Local mode needs VITE_SHELBY_RPC_URL and VITE_SHELBY_INDEXER_URL before it can be used.')
  }

  return {
    network,
    networkName,
    networkLabel: isLocal ? 'Local Shelby' : 'Shelbynet',
    apiKey,
    location: readEnv(env, 'VITE_SHELBY_LOCATION') || (isLocal ? 'local-1' : 'shelbynet-1'),
    rpcUrl: readEnv(env, 'VITE_SHELBY_RPC_URL') || defaultRpcUrl || undefined,
    indexerUrl: readEnv(env, 'VITE_SHELBY_INDEXER_URL') || defaultIndexerUrl,
    aptosFullnodeUrl: readEnv(env, 'VITE_APTOS_FULLNODE_URL') || undefined,
    aptosIndexerUrl: readEnv(env, 'VITE_APTOS_INDEXER_URL') || undefined,
    shelbyExplorerUrl: readEnv(env, 'VITE_SHELBY_EXPLORER_URL') || 'https://explorer.shelby.xyz/shelbynet',
    aptosExplorerUrl: readEnv(env, 'VITE_APTOS_EXPLORER_URL') || 'https://explorer.aptoslabs.com/txn',
    warnings,
  }
}

export const APP_CONFIG = createRuntimeConfig(import.meta.env)

export const SHELBY_NETWORK = APP_CONFIG.network
export const SHELBY_NETWORK_NAME = APP_CONFIG.networkName
export const SHELBY_NETWORK_LABEL = APP_CONFIG.networkLabel
export const SHELBY_API_KEY = APP_CONFIG.apiKey
export const SHELBY_LOCATION = APP_CONFIG.location
export const SHELBY_RPC_URL = APP_CONFIG.rpcUrl
export const SHELBY_INDEXER_URL = APP_CONFIG.indexerUrl
export const SHELBY_EXPLORER_URL = APP_CONFIG.shelbyExplorerUrl
export const APTOS_EXPLORER_URL = APP_CONFIG.aptosExplorerUrl
export const APTOS_FULLNODE_URL = APP_CONFIG.aptosFullnodeUrl
export const APTOS_INDEXER_URL = APP_CONFIG.aptosIndexerUrl
