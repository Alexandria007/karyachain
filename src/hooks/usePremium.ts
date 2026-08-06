import { useCallback } from 'react'
import { isUserTransactionResponse } from '@aptos-labs/ts-sdk'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { aptosClient } from '../lib/shelby'
import {
  encodeWorkBlobName,
  formatSUSDPrice,
  parseWorkMetadata,
  priceToMicroUnits,
} from '../lib/karyaMetadata'
import { reportClientError } from '../lib/diagnostics'

export const SHELBY_USD_METADATA = '0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1'

type StoredAccess = {
  version: 1
  txHash: string
  buyer: string
  owner: string
  blobName: string
  amountMicro: string
  paidAt: number
}

const verifiedAccess = new Set<string>()

const normalizeAddress = (value: string): string => {
  const hex = String(value || '').replace(/^0x/i, '').replace(/^0+/, '') || '0'
  return `0x${hex.toLowerCase()}`
}

const argumentToString = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['inner', 'address', 'value']) {
      if (key in record) {
        const nested = argumentToString(record[key])
        if (nested) return nested
      }
    }
  }
  return ''
}

const accessKey = (ownerAddr: string, blobNameSuffix: string): string =>
  `karya_access_${normalizeAddress(ownerAddr)}_${encodeURIComponent(blobNameSuffix)}`

const accessSetKey = (ownerAddr: string, blobNameSuffix: string, buyerAddr: string): string =>
  `${normalizeAddress(buyerAddr)}:${normalizeAddress(ownerAddr)}:${blobNameSuffix}`

const readStoredAccess = (ownerAddr: string, blobNameSuffix: string): StoredAccess | null => {
  try {
    const raw = localStorage.getItem(accessKey(ownerAddr, blobNameSuffix))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Partial<StoredAccess>
    if (
      record.version !== 1 ||
      typeof record.txHash !== 'string' ||
      typeof record.buyer !== 'string' ||
      typeof record.owner !== 'string' ||
      typeof record.blobName !== 'string' ||
      typeof record.amountMicro !== 'string'
    ) return null
    return record as StoredAccess
  } catch {
    return null
  }
}

export function hasStoredAccess(ownerAddr: string, blobNameSuffix: string): boolean {
  const record = readStoredAccess(ownerAddr, blobNameSuffix)
  return !!record && record.owner.toLowerCase() === ownerAddr.toLowerCase() && record.blobName === blobNameSuffix
}

const storeAccess = (record: StoredAccess): boolean => {
  try {
    localStorage.setItem(accessKey(record.owner, record.blobName), JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

/**
 * Verify the exact ShelbyUSD transfer that grants access. The transaction is
 * checked after Aptos finality; a localStorage flag alone is never sufficient.
 */
export async function verifyShelbyUsdPayment({
  txHash,
  buyerAddr,
  ownerAddr,
  blobNameSuffix,
}: {
  txHash: string
  buyerAddr: string
  ownerAddr: string
  blobNameSuffix: string
}): Promise<StoredAccess> {
  const metadata = parseWorkMetadata(blobNameSuffix)
  if (!metadata.premium || metadata.priceMicro === '0') {
    throw new Error('This blob does not contain a valid ShelbyUSD price.')
  }

  const transaction = await aptosClient.getTransactionByHash({ transactionHash: txHash })
  if (!isUserTransactionResponse(transaction) || !transaction.success) {
    throw new Error('The ShelbyUSD transaction was not successful or is not finalized.')
  }

  const payload = transaction.payload
  if (!('function' in payload) || !Array.isArray(payload.arguments)) {
    throw new Error('The payment transaction is not a fungible-asset transfer.')
  }

  const functionName = String(payload.function).toLowerCase()
  const args = payload.arguments as unknown[]
  const metadataAddress = normalizeAddress(argumentToString(args[0]))
  const recipient = normalizeAddress(argumentToString(args[1]))
  const amountMicro = argumentToString(args[2])

  if (normalizeAddress(transaction.sender) !== normalizeAddress(buyerAddr)) {
    throw new Error('The payment sender does not match the connected wallet.')
  }
  if (!functionName.endsWith('::primary_fungible_store::transfer')) {
    throw new Error('The transaction function is not a primary fungible-asset transfer.')
  }
  if (metadataAddress !== normalizeAddress(SHELBY_USD_METADATA)) {
    throw new Error('The transaction transferred a different asset, not ShelbyUSD.')
  }
  if (recipient !== normalizeAddress(ownerAddr)) {
    throw new Error('The payment recipient does not match this creator.')
  }
  if (amountMicro !== metadata.priceMicro) {
    throw new Error(`Expected ${formatSUSDPrice(metadata.priceMicro)} ShelbyUSD for this work.`)
  }

  return {
    version: 1,
    txHash,
    buyer: buyerAddr,
    owner: ownerAddr,
    blobName: blobNameSuffix,
    amountMicro,
    paidAt: Date.now(),
  }
}

export async function verifyStoredAccess(
  ownerAddr: string,
  blobNameSuffix: string,
  buyerAddr: string,
): Promise<boolean> {
  if (!parseWorkMetadata(blobNameSuffix).premium) return true
  const key = accessSetKey(ownerAddr, blobNameSuffix, buyerAddr)
  if (verifiedAccess.has(key)) return true

  const record = readStoredAccess(ownerAddr, blobNameSuffix)
  if (!record || normalizeAddress(record.buyer) !== normalizeAddress(buyerAddr)) return false

  try {
    const verified = await verifyShelbyUsdPayment({
      txHash: record.txHash,
      buyerAddr,
      ownerAddr,
      blobNameSuffix,
    })
    if (storeAccess(verified)) {
      verifiedAccess.add(key)
      return true
    }
  } catch (error) {
    reportClientError('premium.entitlement', error, { source: 'aptos', network: 'shelbynet', retryable: true })
  }
  return false
}

// Compatibility export used by older callers.
export function encodePremiumName(price: number, fileName: string): string {
  return encodeWorkBlobName({
    category: 'other',
    fileName,
    priceMicro: priceToMicroUnits(String(price)),
  })
}

export function isPremiumBlob(blobNameSuffix: string): boolean {
  return parseWorkMetadata(blobNameSuffix).premium
}

export function parsePremiumAmountMicro(blobNameSuffix: string): string {
  return parseWorkMetadata(blobNameSuffix).priceMicro
}

export function parsePremiumPrice(blobNameSuffix: string): number {
  const amount = parsePremiumAmountMicro(blobNameSuffix)
  return amount === '0' ? 0 : Number(amount) / 1_000_000
}

export function parsePremiumFileName(blobNameSuffix: string): string {
  return parseWorkMetadata(blobNameSuffix).fileName
}

export function getDisplayName(blobNameSuffix: string): string {
  return parseWorkMetadata(blobNameSuffix).fileName
}

export function usePremium() {
  const { account, signAndSubmitTransaction } = useWallet()
  const currentAddress = account?.address?.toString() || ''

  const hasAccess = useCallback(
    (ownerAddr: string, blobNameSuffix: string): boolean => {
      if (!isPremiumBlob(blobNameSuffix)) return true
      if (currentAddress && normalizeAddress(currentAddress) === normalizeAddress(ownerAddr)) return true
      return verifiedAccess.has(accessSetKey(ownerAddr, blobNameSuffix, currentAddress))
    },
    [currentAddress]
  )

  const verifyAccess = useCallback(
    (ownerAddr: string, blobNameSuffix: string): Promise<boolean> => {
      if (!currentAddress) return Promise.resolve(false)
      if (!isPremiumBlob(blobNameSuffix)) return Promise.resolve(true)
      if (normalizeAddress(currentAddress) === normalizeAddress(ownerAddr)) return Promise.resolve(true)
      return verifyStoredAccess(ownerAddr, blobNameSuffix, currentAddress)
    },
    [currentAddress]
  )

  const buyAccess = useCallback(
    async (
      ownerAddr: string,
      blobNameSuffix: string,
      onSuccess?: (txHash: string) => void,
      onError?: (err: string) => void,
    ) => {
      if (!account) { onError?.('Please connect your wallet first.'); return }
      const metadata = parseWorkMetadata(blobNameSuffix)
      if (!metadata.premium || metadata.priceMicro === '0') { onError?.('Invalid ShelbyUSD price.'); return }

      try {
        const response = await signAndSubmitTransaction({
          data: {
            function: '0x1::primary_fungible_store::transfer' as `${string}::${string}::${string}`,
            typeArguments: ['0x1::fungible_asset::Metadata'] as [`0x${string}::${string}::${string}`],
            functionArguments: [SHELBY_USD_METADATA, ownerAddr, metadata.priceMicro],
          },
        })
        await aptosClient.waitForTransaction({
          transactionHash: response.hash,
          options: { timeoutSecs: 30, checkSuccess: true },
        })

        const receipt = await verifyShelbyUsdPayment({
          txHash: response.hash,
          buyerAddr: currentAddress,
          ownerAddr,
          blobNameSuffix,
        })
        if (!storeAccess(receipt)) {
          onError?.('Payment verified, but this browser could not save the entitlement receipt.')
          return
        }
        verifiedAccess.add(accessSetKey(ownerAddr, blobNameSuffix, currentAddress))
        onSuccess?.(response.hash)
      } catch (err: unknown) {
        reportClientError('premium.purchase', err, { source: 'aptos', network: 'shelbynet', retryable: true })
        const message = err instanceof Error ? err.message : 'Transaction failed.'
        onError?.(message.toLowerCase().includes('rejected') ? 'Transaction cancelled.' : message)
      }
    },
    [account, currentAddress, signAndSubmitTransaction]
  )

  return { hasAccess, verifyAccess, buyAccess, currentAddress }
}