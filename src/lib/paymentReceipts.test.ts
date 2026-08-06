import { describe, expect, it } from 'vitest'
import { findPaymentReceipt, savePaymentReceipt } from './paymentReceipts'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const receipt = (blobName: string) => ({
  txHash: '0xpayment',
  buyer: '0x1',
  owner: '0x2',
  blobName,
  amountMicro: '2000000',
  verifiedAt: 1,
})

describe('payment receipt replay guard', () => {
  it('allows the same verified receipt to be revalidated for the same work', () => {
    const storage = new MemoryStorage()
    expect(savePaymentReceipt(receipt('work-a.png'), storage)).toBe(true)
    expect(savePaymentReceipt(receipt('work-a.png'), storage)).toBe(true)
    expect(findPaymentReceipt('0xPAYMENT', storage)?.blobName).toBe('work-a.png')
  })

  it('rejects reusing one transaction for a different work', () => {
    const storage = new MemoryStorage()
    expect(savePaymentReceipt(receipt('work-a.png'), storage)).toBe(true)
    expect(savePaymentReceipt(receipt('work-b.png'), storage)).toBe(false)
  })
})

