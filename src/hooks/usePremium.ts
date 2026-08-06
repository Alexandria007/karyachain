import { useCallback } from 'react'
import { isUserTransactionResponse } from '@aptos-labs/ts-sdk'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { aptosClient } from '../lib/shelby'
import {
  encodeWorkBlobName,
  formatSUSDPrice,
  parseWorkMetadata,
  priceToMicroUnits,
  SHELBY_USD_SCALE,
} from '../lib/karyaMetadata'
import { reportClientError } from '../lib/diagnostics'
import { KARYA_REGISTRY_ENABLED, SHELBY_NETWORK_NAME } from '../lib/config'
import { savePaymentReceipt } from '../lib/paymentReceipts'
import {
  bytesToBase64,
  bytesToHex,
  createPurchaseWorkPayload,
  getRegistryEntitlement,
  getRegistryWorkForBlob,
  hasRegistryEntitlement,
  KARYA_REGISTRY_MODULE,
  SHELBY_USD_METADATA,
} from '../lib/karyaRegistry'
import { decryptPremiumBlob, requestKeyRelease, type KeyRelease } from '../lib/karyaCrypto'

export { SHELBY_USD_METADATA } from '../lib/karyaRegistry'

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
const releasedKeyCache = new Map<string, { release: KeyRelease; cachedAt: number }>()

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
  if (normalizeAddress(transaction.sender) !== normalizeAddress(buyerAddr)) {
    throw new Error('The payment sender does not match the connected wallet.')
  }

  const registryPurchaseFunction = KARYA_REGISTRY_MODULE
    ? (KARYA_REGISTRY_MODULE + '::purchase').toLowerCase()
    : ''
  if (registryPurchaseFunction && functionName === registryPurchaseFunction) {
    const registryRecord = await getRegistryWorkForBlob(ownerAddr, blobNameSuffix)
    if (!registryRecord) throw new Error('This work is not registered in KaryaRegistry.')
    if (normalizeAddress(registryRecord.work.creator) !== normalizeAddress(ownerAddr)) {
      throw new Error('The registry creator does not match this Shelby owner.')
    }
    const paymentMetadata = normalizeAddress(argumentToString(args[1]))
    if (paymentMetadata !== normalizeAddress(SHELBY_USD_METADATA)) {
      throw new Error('The registry purchase used a different asset, not ShelbyUSD.')
    }
    if (registryRecord.work.priceMicro !== metadata.priceMicro) {
      throw new Error('The registered on-chain price does not match the Shelby metadata price.')
    }
    const entitlement = await getRegistryEntitlement(buyerAddr, registryRecord.workId)
    if (!entitlement.exists || entitlement.expiresAtMicros < Date.now() * 1000) {
      throw new Error('The on-chain purchase finalized without an active entitlement.')
    }
    return {
      version: 1,
      txHash,
      buyer: buyerAddr,
      owner: ownerAddr,
      blobName: blobNameSuffix,
      amountMicro: registryRecord.work.priceMicro,
      paidAt: Date.now(),
    }
  }

  if (!functionName.endsWith('::primary_fungible_store::transfer')) {
    throw new Error('The payment transaction is not a primary fungible-asset transfer.')
  }
  if (KARYA_REGISTRY_ENABLED) {
    throw new Error('The configured private registry requires an on-chain KaryaRegistry purchase.')
  }

  const metadataAddress = normalizeAddress(argumentToString(args[0]))
  const recipient = normalizeAddress(argumentToString(args[1]))
  const amountMicro = argumentToString(args[2])

  if (metadataAddress !== normalizeAddress(SHELBY_USD_METADATA)) {
    throw new Error('The transaction transferred a different asset, not ShelbyUSD.')
  }
  if (recipient !== normalizeAddress(ownerAddr)) {
    throw new Error('The payment recipient does not match this creator.')
  }
  if (amountMicro !== metadata.priceMicro) {
    throw new Error('Expected ' + formatSUSDPrice(metadata.priceMicro) + ' ShelbyUSD for this work.')
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

  if (KARYA_REGISTRY_ENABLED) {
    try {
      const registryAccess = await hasRegistryEntitlement(buyerAddr, ownerAddr, blobNameSuffix)
      if (registryAccess === null) return false
      if (registryAccess) verifiedAccess.add(key)
      return registryAccess
    } catch (error) {
      reportClientError('premium.registry-entitlement', error, { source: 'aptos-registry', network: SHELBY_NETWORK_NAME, retryable: true })
      return false
    }
  }

  const record = readStoredAccess(ownerAddr, blobNameSuffix)
  if (!record || normalizeAddress(record.buyer) !== normalizeAddress(buyerAddr)) return false

  try {
    const verified = await verifyShelbyUsdPayment({
      txHash: record.txHash,
      buyerAddr,
      ownerAddr,
      blobNameSuffix,
    })
    if (savePaymentReceipt({ txHash: verified.txHash, buyer: verified.buyer, owner: verified.owner, blobName: verified.blobName, amountMicro: verified.amountMicro, verifiedAt: verified.paidAt }) && storeAccess(verified)) {
      verifiedAccess.add(key)
      return true
    }
  } catch (error) {
    reportClientError('premium.entitlement', error, { source: 'aptos', network: SHELBY_NETWORK_NAME, retryable: true })
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
  return amount === '0' ? 0 : Number(amount) / Number(SHELBY_USD_SCALE)
}

export function parsePremiumFileName(blobNameSuffix: string): string {
  return parseWorkMetadata(blobNameSuffix).fileName
}

export function getDisplayName(blobNameSuffix: string): string {
  return parseWorkMetadata(blobNameSuffix).fileName
}

const createKeyReleaseMessage = (workId: Uint8Array, buyerAddress: string): { message: string; nonce: string } => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure wallet proof requires Web Crypto on HTTPS or localhost.')
  }
  const nonce = bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(16))).slice(2)
  const message = 'KARYACHAIN_KEY_RELEASE_V1|work_id=' + bytesToBase64(workId)
    + '|buyer=' + normalizeAddress(buyerAddress)
    + '|issued_at=' + Date.now()
  return { message, nonce }
}

export function usePremium() {
  const { account, signAndSubmitTransaction, signMessage } = useWallet()
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

  const createKeyReleaseProof = useCallback(
    async (workId: Uint8Array, buyerAddress: string) => {
      const cacheKey = normalizeAddress(buyerAddress) + ':' + bytesToBase64(workId)
      const cached = releasedKeyCache.get(cacheKey)
      if (cached && Date.now() - cached.cachedAt < 4 * 60 * 1000 && cached.release.expiresAtMicros > Date.now() * 1000) {
        return cached.release
      }
      const { message, nonce } = createKeyReleaseMessage(workId, buyerAddress)
      const signed = await signMessage({
        address: true,
        application: true,
        chainId: true,
        message,
        nonce,
      })
      const signature = typeof signed.signature === 'string'
        ? signed.signature
        : signed.signature.toString()
      const release = await requestKeyRelease({
        workId,
        buyerAddress,
        fullMessage: signed.fullMessage,
        signature,
        nonce,
        message,
      })
      releasedKeyCache.set(cacheKey, { release, cachedAt: Date.now() })
      return release
    },
    [signMessage],
  )

  const decryptDownload = useCallback(
    async (ownerAddr: string, blobNameSuffix: string, ciphertext: Blob): Promise<Blob> => {
      if (!isPremiumBlob(blobNameSuffix) || !KARYA_REGISTRY_ENABLED) return ciphertext
      const registryRecord = await getRegistryWorkForBlob(ownerAddr, blobNameSuffix)
      if (!registryRecord) return ciphertext
      if (!currentAddress) throw new Error('Connect Petra to prove wallet ownership before decrypting premium content.')
      const release = await createKeyReleaseProof(registryRecord.workId, currentAddress)
      return decryptPremiumBlob(ciphertext, release)
    },
    [currentAddress, createKeyReleaseProof],
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
      if (normalizeAddress(currentAddress) === normalizeAddress(ownerAddr)) {
        onError?.('You already own this work; no payment is needed.')
        return
      }

      try {
        const registryRecord = KARYA_REGISTRY_ENABLED
          ? await getRegistryWorkForBlob(ownerAddr, blobNameSuffix)
          : null
        if (KARYA_REGISTRY_ENABLED && !registryRecord) {
          throw new Error('This work is not registered in the configured KaryaRegistry.')
        }
        if (registryRecord && (
          normalizeAddress(registryRecord.work.creator) !== normalizeAddress(ownerAddr) ||
          registryRecord.work.priceMicro !== metadata.priceMicro ||
          normalizeAddress(registryRecord.work.currencyMetadata) !== normalizeAddress(SHELBY_USD_METADATA)
        )) {
          throw new Error('The on-chain work record does not match the Shelby premium metadata.')
        }

        const paymentData = registryRecord
          ? createPurchaseWorkPayload(registryRecord.workId)
          : {
              function: '0x1::primary_fungible_store::transfer' as never,
              typeArguments: ['0x1::fungible_asset::Metadata'] as never,
              functionArguments: [SHELBY_USD_METADATA, ownerAddr, metadata.priceMicro],
            }
        const response = await signAndSubmitTransaction({ data: paymentData })
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
        const receiptBoundToWork = savePaymentReceipt({
          txHash: receipt.txHash,
          buyer: receipt.buyer,
          owner: receipt.owner,
          blobName: receipt.blobName,
          amountMicro: receipt.amountMicro,
          verifiedAt: receipt.paidAt,
        })
        if (!receiptBoundToWork) {
          onError?.('This payment receipt has already been used for another work.')
          return
        }
        if (!storeAccess(receipt)) {
          onError?.('Payment verified, but this browser could not save the entitlement receipt.')
          return
        }
        verifiedAccess.add(accessSetKey(ownerAddr, blobNameSuffix, currentAddress))
        onSuccess?.(response.hash)
      } catch (err: unknown) {
        reportClientError('premium.purchase', err, { source: 'aptos', network: SHELBY_NETWORK_NAME, retryable: true })
        const message = err instanceof Error ? err.message : 'Transaction failed.'
        onError?.(message.toLowerCase().includes('rejected') ? 'Transaction cancelled.' : message)
      }
    },
    [account, currentAddress, signAndSubmitTransaction]
  )

  return { hasAccess, verifyAccess, buyAccess, decryptDownload, currentAddress }
}