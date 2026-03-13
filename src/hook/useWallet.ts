import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react'

export function useWallet() {
  const {
    account,
    connected,
    connecting,
    wallets,
    connect,
    disconnect,
  } = useAptosWallet()

  const address = connected && account ? account.address.toString() : null
  const isConnecting = connecting
  const installed = wallets && wallets.length > 0

  const handleConnect = async () => {
    if (!wallets || wallets.length === 0) {
      window.open('https://petra.app/', '_blank')
      return
    }
    try {
      await connect(wallets[0].name)
    } catch (err) {
      console.error('Connect failed:', err)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  const shortAddress = address
    ? address.slice(0, 6) + '...' + address.slice(-4)
    : null

  return {
    address,
    shortAddress,
    isConnecting,
    installed: !!installed,
    connect: handleConnect,
    disconnect: handleDisconnect,
  }
}
