import { describe, expect, it } from 'vitest'
import { decryptPremiumBlob, encryptPremiumFile } from './karyaCrypto'

describe('premium browser encryption', () => {
  it('round-trips authenticated ciphertext without exposing plaintext in the ciphertext', async () => {
    const plaintext = 'KaryaChain private creator work'
    const source = new Blob([plaintext], { type: 'text/plain' }) as File
    Object.defineProperty(source, 'name', { value: 'work.txt' })

    const encrypted = await encryptPremiumFile(source)
    const ciphertext = new Blob([encrypted.ciphertext as unknown as BlobPart], { type: 'application/octet-stream' })
    expect(new TextDecoder().decode(encrypted.ciphertext)).not.toContain(plaintext)

    const decrypted = await decryptPremiumBlob(ciphertext, {
      keyBytes: encrypted.keyBytes,
      contentIv: encrypted.contentIv,
      contentType: 'text/plain',
      originalName: 'work.txt',
      expiresAtMicros: Date.now() * 1000 + 60_000_000,
    })

    expect(await decrypted.text()).toBe(plaintext)
    expect(decrypted.type).toBe('text/plain')
  })
})