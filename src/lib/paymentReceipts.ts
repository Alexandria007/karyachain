export type PaymentReceiptRecord = {
  txHash: string
  buyer: string
  owner: string
  blobName: string
  amountMicro: string
  verifiedAt: number
}

const PAYMENT_RECEIPT_INDEX_KEY = 'karya_payment_receipts_v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const getStorage = (): StorageLike | undefined => {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return undefined
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

const normalize = (value: string): string => value.trim().toLowerCase()

const readIndex = (storage: StorageLike | undefined): PaymentReceiptRecord[] => {
  if (!storage) return []
  try {
    const raw = storage.getItem(PAYMENT_RECEIPT_INDEX_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is PaymentReceiptRecord => {
      if (typeof value !== 'object' || value === null) return false
      const record = value as Partial<PaymentReceiptRecord>
      return typeof record.txHash === 'string' && typeof record.buyer === 'string' && typeof record.owner === 'string' && typeof record.blobName === 'string' && typeof record.amountMicro === 'string' && typeof record.verifiedAt === 'number'
    })
  } catch {
    return []
  }
}

/** Find an already verified tx so one transfer cannot unlock another blob locally. */
export const findPaymentReceipt = (
  txHash: string,
  storage: StorageLike | undefined = getStorage(),
): PaymentReceiptRecord | undefined => readIndex(storage).find(record => normalize(record.txHash) === normalize(txHash))

/**
 * Returns false when a receipt is already bound to a different work.
 * This is a browser-level replay guard, not protocol-level authorization.
 */
export const savePaymentReceipt = (
  receipt: PaymentReceiptRecord,
  storage: StorageLike | undefined = getStorage(),
): boolean => {
  if (!storage) return true
  const existing = findPaymentReceipt(receipt.txHash, storage)
  if (existing && (normalize(existing.blobName) !== normalize(receipt.blobName) || normalize(existing.owner) !== normalize(receipt.owner) || normalize(existing.buyer) !== normalize(receipt.buyer))) return false
  try {
    const next = existing ? readIndex(storage) : [receipt, ...readIndex(storage)]
    storage.setItem(PAYMENT_RECEIPT_INDEX_KEY, JSON.stringify(next.slice(0, 100)))
    return true
  } catch {
    return false
  }
}

