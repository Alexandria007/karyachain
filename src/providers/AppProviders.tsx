import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'
import type { PropsWithChildren } from 'react'

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
          console.warn('[WalletAdapter]:', error)
        }}
      >
        {children}
      </AptosWalletAdapterProvider>
    </QueryClientProvider>
  )
}
