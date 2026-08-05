import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'
import { ShelbyClient } from '@shelby-protocol/sdk/browser'

const aptosApiKey = import.meta.env.VITE_APTOS_API_KEY as string | undefined

export const aptosClient = new Aptos(new AptosConfig({
  network: Network.SHELBYNET,
  clientConfig: aptosApiKey ? { API_KEY: aptosApiKey } : undefined,
}))

export const shelbyClient = new ShelbyClient({
  network: Network.SHELBYNET,
  apiKey: aptosApiKey,
  indexer: aptosApiKey ? { apiKey: aptosApiKey } : undefined,
  aptos: {
    network: Network.SHELBYNET,
    clientConfig: aptosApiKey ? { API_KEY: aptosApiKey } : undefined,
  },
})

export async function downloadShelbyBlob(account: string, blobName: string): Promise<Blob> {
  const response = await shelbyClient.rpc.getBlob({ account, blobName })
  return new Response(response.readable).blob()
}
