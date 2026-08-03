import { useState, useEffect } from 'react'

declare global {
  interface Window {
    petra?: {
      connect: () => Promise<{ address: string }>
      disconnect: () => Promise<void>
      isConnected: () => Promise<boolean>
      account: () => Promise<{ address: string }>
    }
  }
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setInstalled(!!window.petra)
      checkConnection()
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const checkConnection = async () => {
    if (!window.petra) return
    try {
      const connected = await window.petra.isConnected()
      if (connected) {
        const acc = await window.petra.account()
        setAddress(acc.address)
      }
    } catch (error) {
      console.warn('Unable to check Petra connection:', error)
    }
  }

  const connect = async () => {
    if (!window.petra) {
      window.open('https://petra.app/', '_blank')
      return
    }
    setIsConnecting(true)
    try {
      const response = await window.petra.connect()
      setAddress(response.address)
    } catch (err) {
      console.error('Connect failed:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      await window.petra?.disconnect()
    } catch (error) {
      console.warn('Unable to disconnect Petra:', error)
    }
    setAddress(null)
  }

  const shortAddress = address
    ? address.slice(0, 6) + '...' + address.slice(-4)
    : null

  return { address, shortAddress, isConnecting, installed, connect, disconnect }
}
