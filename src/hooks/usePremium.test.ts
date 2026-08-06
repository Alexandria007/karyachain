import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TransactionResponse } from '@aptos-labs/ts-sdk'
import { aptosClient } from '../lib/shelby'
import { encodeWorkBlobName, priceToMicroUnits } from '../lib/karyaMetadata'
import { SHELBY_USD_METADATA, verifyShelbyUsdPayment } from './usePremium'

const buyer = '0x1111'
const owner = '0x2222'
const priceMicro = priceToMicroUnits('0.02')
const blobName = encodeWorkBlobName({ category: 'photo', fileName: 'premium.png', priceMicro })
const legacyBlobName = 'KARYA:v1:photo:premium:20000:legacy-premium.png'

const paymentPayload = (amount = priceMicro) => ({
  type: 'entry_function_payload' as const,
  function: '0x1::primary_fungible_store::transfer',
  type_arguments: ['0x1::fungible_asset::Metadata'],
  arguments: [SHELBY_USD_METADATA, owner, amount],
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
  it('accepts only a finalized exact 8-decimal transfer to the creator', async () => {
    vi.spyOn(aptosClient, 'getTransactionByHash').mockResolvedValue(paymentTransaction())

    await expect(verifyShelbyUsdPayment({
      txHash: '0xpayment',
      buyerAddr: buyer,
      ownerAddr: owner,
      blobNameSuffix: blobName,
    })).resolves.toMatchObject({
      buyer,
      owner,
      amountMicro: priceMicro,
    })
  })

  it('accepts the correct raw amount for a v1 blob after scale migration', async () => {
    vi.spyOn(aptosClient, 'getTransactionByHash').mockResolvedValue(paymentTransaction())

    await expect(verifyShelbyUsdPayment({
      txHash: '0xpayment',
      buyerAddr: buyer,
      ownerAddr: owner,
      blobNameSuffix: legacyBlobName,
    })).resolves.toMatchObject({
      amountMicro: priceMicro,
    })
  })

  it('accepts Aptos REST object-shaped metadata arguments', async () => {
    const payload = paymentPayload()
    const restPayload = {
      ...payload,
      arguments: [{ inner: SHELBY_USD_METADATA }, { inner: owner }, priceMicro],
    }
    vi.spyOn(aptosClient, 'getTransactionByHash').mockResolvedValue(
      paymentTransaction({ payload: restPayload }),
    )

    await expect(verifyShelbyUsdPayment({
      txHash: '0xpayment',
      buyerAddr: buyer,
      ownerAddr: owner,
      blobNameSuffix: blobName,
    })).resolves.toMatchObject({
      buyer,
      owner,
      amountMicro: priceMicro,
    })
  })

  it.each([
    ['wrong sender', { sender: '0x9999' }, 'payment sender'],
    ['wrong asset', { payload: { ...paymentPayload(), arguments: ['0xdead', owner, priceMicro] } }, 'different asset'],
    ['wrong recipient', { payload: { ...paymentPayload(), arguments: [SHELBY_USD_METADATA, buyer, priceMicro] } }, 'recipient'],
    ['wrong amount', { payload: { ...paymentPayload(), arguments: [SHELBY_USD_METADATA, owner, '2000001'] } }, 'Expected'],
    ['old six-decimal amount', { payload: { ...paymentPayload(), arguments: [SHELBY_USD_METADATA, owner, '20000'] } }, 'Expected'],
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
