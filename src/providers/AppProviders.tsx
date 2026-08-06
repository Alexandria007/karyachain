import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import type { PropsWithChildren } from 'react'
import { reportClientError } from '../lib/diagnostics'
import { SHELBY_API_KEY, SHELBY_NETWORK, SHELBY_NETWORK_NAME } from '../lib/config'

const queryClient = new QueryClient()

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AptosWalletAdapterProvider
        autoConnect
        dappConfig={{
          network: SHELBY_NETWORK,
          aptosApiKeys: {
            [SHELBY_NETWORK_NAME]: SHELBY_API_KEY,
          },
        }}
        onError={(error) => {
          reportClientError('wallet-adapter', error, { source: 'aptos-wallet-adapter', network: SHELBY_NETWORK_NAME, retryable: true })
        }}
      >
        {children}
      </AptosWalletAdapterProvider>
    </QueryClientProvider>
  )
}
