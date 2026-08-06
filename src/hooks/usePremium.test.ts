import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TransactionResponse } from '@aptos-labs/ts-sdk'
import { aptosClient } from '../lib/shelby'
import { encodeWorkBlobName } from '../lib/karyaMetadata'
import { SHELBY_USD_METADATA, verifyShelbyUsdPayment } from './usePremium'

const buyer = '0x1111'
const owner = '0x2222'
const blobName = encodeWorkBlobName({ category: 'photo', fileName: 'premium.png', priceMicro: '20000' })

const paymentPayload = () => ({
  type: 'entry_function_payload' as const,
  function: '0x1::primary_fungible_store::transfer',
  type_arguments: ['0x1::fungible_asset::Metadata'],
  arguments: [SHELBY_USD_METADATA, owner, '20000'],
})

const paymentTransaction = (overrides: Record<string, unknown> = {}): TransactionResponse => ({
  type: 'user_transaction',
  version: '1',
  hash: '0xpayment',
  state_change_hash: '0xstate',
  event_root_hash: '0xevents',
  state_checkpoint_hash: null,
  accumulator_root_hash: '0xaccumulator',
  gas_used: '0',
  success: true,
  vm_status: 'Executed successfully',
  epoch: '0',
  failed_transaction: false,
  block_height: '0',
  id: '0',
  timestamp: '0',
  sender: buyer,
  sequence_number: '0',
  max_gas_amount: '0',
  gas_unit_price: '0',
  expiration_timestamp_secs: '0',
  payload: paymentPayload(),
  signature: { type: 'ed25519_signature', public_key: '', signature: '' },
  events: [],
  changes: [],
  ...overrides,
} as unknown as TransactionResponse)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ShelbyUSD payment verification', () => {
  it('accepts only a finalized exact transfer to the creator', async () => {
    vi.spyOn(aptosClient, 'getTransactionByHash').mockResolvedValue(paymentTransaction())

    await expect(verifyShelbyUsdPayment({
      txHash: '0xpayment',
      buyerAddr: buyer,
      ownerAddr: owner,
      blobNameSuffix: blobName,
    })).resolves.toMatchObject({
      buyer,
      owner,
      amountMicro: '20000',
    })
  })

  it.each([
    ['wrong sender', { sender: '0x9999' }, 'payment sender'],
    ['wrong asset', { payload: { ...paymentPayload(), arguments: ['0xdead', owner, '20000'] } }, 'different asset'],
    ['wrong recipient', { payload: { ...paymentPayload(), arguments: [SHELBY_USD_METADATA, buyer, '20000'] } }, 'recipient'],
    ['wrong amount', { payload: { ...paymentPayload(), arguments: [SHELBY_USD_METADATA, owner, '20001'] } }, 'Expected'],
    ['wrong function', { payload: { ...paymentPayload(), function: '0x1::coin::transfer' } }, 'primary fungible-asset transfer'],
  ])('rejects %s', async (_caseName, overrides, message) => {
    vi.spyOn(aptosClient, 'getTransactionByHash').mockResolvedValue(paymentTransaction(overrides))

    await expect(verifyShelbyUsdPayment({
      txHash: '0xpayment',
      buyerAddr: buyer,
      ownerAddr: owner,
      blobNameSuffix: blobName,
    })).rejects.toThrow(message)
  })

  it('rejects unsuccessful transactions before inspecting payment arguments', async () => {
    vi.spyOn(aptosClient, 'getTransactionByHash').mockResolvedValue(paymentTransaction({ success: false }))

    await expect(verifyShelbyUsdPayment({
      txHash: '0xpayment',
      buyerAddr: buyer,
      ownerAddr: owner,
      blobNameSuffix: blobName,
    })).rejects.toThrow('not successful')
  })
})
