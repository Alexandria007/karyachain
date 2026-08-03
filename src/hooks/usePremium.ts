import { useCallback } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { aptosClient } from '../lib/shelby'

const SHELBY_USD_METADATA = '0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1'
const PREMIUM_PREFIX = 'PREMIUM:'

// ── Blob name helpers ──────────────────────────────────────────────────────────

export function encodePremiumName(price: number, fileName: string): string {
  return `${PREMIUM_PREFIX}${price}:${fileName}`
}

export function isPremiumBlob(blobNameSuffix: string): boolean {
  return String(blobNameSuffix || '').startsWith(PREMIUM_PREFIX)
}

export function parsePremiumPrice(blobNameSuffix: string): number {
  if (!isPremiumBlob(blobNameSuffix)) return 0
  const parts = blobNameSuffix.split(':')
  return parts.length >= 2 ? parseFloat(parts[1]) || 0 : 0
}

export function parsePremiumFileName(blobNameSuffix: string): string {
  if (!isPremiumBlob(blobNameSuffix)) return blobNameSuffix
  const parts = blobNameSuffix.split(':')
  return parts.slice(2).join(':') || blobNameSuffix
}

export function getDisplayName(blobNameSuffix: string): string {
  return isPremiumBlob(blobNameSuffix)
    ? parsePremiumFileName(blobNameSuffix)
    : blobNameSuffix
}

// ── localStorage helpers ───────────────────────────────────────────────────────

function accessKey(ownerAddr: string, blobNameSuffix: string): string {
  return `karya_access_${ownerAddr}_${blobNameSuffix}`
}

export function hasStoredAccess(ownerAddr: string, blobNameSuffix: string): boolean {
  try {
    return localStorage.getItem(accessKey(ownerAddr, blobNameSuffix)) === 'true'
  } catch {
    return false
  }
}

function storeAccess(ownerAddr: string, blobNameSuffix: string): boolean {
  try {
    localStorage.setItem(accessKey(ownerAddr, blobNameSuffix), 'true')
    return true
  } catch {
    return false
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function usePremium() {
  const { account, signAndSubmitTransaction } = useWallet()

  const hasAccess = useCallback(
    (ownerAddr: string, blobNameSuffix: string): boolean => {
      if (!isPremiumBlob(blobNameSuffix)) return true
      const myAddr = account?.address?.toString() || ''
      if (myAddr && myAddr.toLowerCase() === ownerAddr.toLowerCase()) return true
      return hasStoredAccess(ownerAddr, blobNameSuffix)
    },
    [account]
  )

  const buyAccess = useCallback(
    async (
      ownerAddr: string,
      blobNameSuffix: string,
      onSuccess?: () => void,
      onError?: (err: string) => void
    ) => {
      if (!account) { onError?.('Please connect your wallet first.'); return }
      const price = parsePremiumPrice(blobNameSuffix)
      if (price <= 0) { onError?.('Invalid price.'); return }

      // ShelbyUSD has 6 decimals
      const amountMicro = BigInt(Math.round(price * 1_000_000)).toString()

      try {
        const response = await signAndSubmitTransaction({
          data: {
            function: '0x1::primary_fungible_store::transfer' as `${string}::${string}::${string}`,
            typeArguments: ['0x1::fungible_asset::Metadata'] as [`0x${string}::${string}::${string}`],
            functionArguments: [SHELBY_USD_METADATA, ownerAddr, amountMicro],
          },
        })
        console.log('[Premium] tx:', response.hash)
        await aptosClient.waitForTransaction({
          transactionHash: response.hash,
          options: { timeoutSecs: 30, checkSuccess: true },
        })
        if (!storeAccess(ownerAddr, blobNameSuffix)) {
          onError?.('Payment succeeded, but this browser could not save the demo access state.')
          return
        }
        onSuccess?.()
      } catch (err: unknown) {
        console.error('[Premium] error:', err)
        const message = err instanceof Error ? err.message : 'Transaction failed.'
        onError?.(
          message.toLowerCase().includes('rejected') ? 'Transaction cancelled.' : message
        )
      }
    },
    [account, signAndSubmitTransaction]
  )

  return {
    hasAccess,
    buyAccess,
    currentAddress: account?.address?.toString() || '',
  }
}
