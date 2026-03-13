import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import './index.css'
import './App.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AptosWalletAdapterProvider
      autoConnect={false}
      dappConfig={{ network: 'testnet' as any }}
      onError={(error) => console.error('Wallet error:', error)}
    >
      <App />
    </AptosWalletAdapterProvider>
  </StrictMode>,
)
