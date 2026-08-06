import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'
import type { PropsWithChildren } from 'react'
import { reportClientError } from '../lib/diagnostics'

const queryClient = new QueryClient()

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AptosWalletAdapterProvider
        autoConnect
        dappConfig={{
          network: Network.SHELBYNET,
          aptosApiKeys: {
            shelbynet: import.meta.env.VITE_APTOS_API_KEY,
          },
        }}
        onError={(error) => {
          reportClientError('wallet-adapter', error, { source: 'aptos-wallet-adapter', network: 'shelbynet', retryable: true })
        }}
      >
        {children}
      </AptosWalletAdapterProvider>
    </QueryClientProvider>
  )
}
