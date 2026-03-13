import { useState, useEffect } from 'react'

interface PetraWalletAPI {
  connect: () => Promise<{ address: string }>
  disconnect: () => Promise<void>
  isConnected: () => Promise<boolean>
  account: () => Promise<{ address: string }>
  network: () => Promise<{ name: string }>
}

declare global {
  interface Window {
    petra?: PetraWalletAPI
  }
}

function getPetra(): PetraWalletAPI | null {
  // Only return if it's actually Petra, not MetaMask or other wallets
  if (typeof window === 'undefined') return null
  if (!window.petra) return null
  // Verify it has Aptos-specific methods
  if (typeof window.petra.network !== 'function') return null
  return window.petra
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Small delay to let extensions inject
    const timer = setTimeout(() => {
      setInstalled(!!getPetra())
      checkConnection()
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const checkConnection = async () => {
    const petra = getPetra()
    if (!petra) return
    try {
      const connected = await petra.isConnected()
      if (connected) {
        const acc = await petra.account()
        setAddress(acc.address)
      }
    } catch {}
  }

  const connect = async () => {
    const petra = getPetra()

    if (!petra) {
      // No Petra detected — redirect to install
      window.open('https://petra.app/', '_blank')
      return
    }

    setIsConnecting(true)
    try {
      const response = await petra.connect()
      setAddress(response.address)
    } catch (err: any) {
      if (err?.message?.includes('deprecated')) {
        // Petra is installed but using new API — still try
        console.warn('Petra API deprecated, trying anyway:', err.message)
      } else {
        console.error('Connect failed:', err)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    const petra = getPetra()
    try {
      await petra?.disconnect()
    } catch {}
    setAddress(null)
  }

  const shortAddress = address
    ? address.slice(0, 6) + '...' + address.slice(-4)
    : null

  return {
    address,
    shortAddress,
    isConnecting,
    installed,
    connect,
    disconnect,
  }
}
