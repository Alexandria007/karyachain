import { describe, expect, it } from 'vitest'
import {
  encodeWorkBlobName,
  formatSUSDPrice,
  parseWorkMetadata,
  priceToMicroUnits,
} from './karyaMetadata'

describe('KaryaChain work metadata', () => {
  it('round-trips category, premium price, and filenames containing colons', () => {
    const blobName = encodeWorkBlobName({
      category: 'photo',
      fileName: '/portfolio/cover:final.png',
      priceMicro: '20000',
    })

    expect(blobName).toBe('KARYA:v1:photo:premium:20000:portfolio/cover:final.png')
    expect(parseWorkMetadata(blobName)).toEqual({
      category: 'photo',
      fileName: 'portfolio/cover:final.png',
      premium: true,
      priceMicro: '20000',
      format: 'karya-v1',
    })
  })

  it('keeps free works explicitly free', () => {
    const blobName = encodeWorkBlobName({ category: 'writing', fileName: 'notes.md' })
    const metadata = parseWorkMetadata(blobName)

    expect(blobName).toBe('KARYA:v1:writing:free:0:notes.md')
    expect(metadata.premium).toBe(false)
    expect(metadata.priceMicro).toBe('0')
    expect(metadata.category).toBe('writing')
  })

  it('parses legacy premium names without treating malformed prices as payable', () => {
    expect(parseWorkMetadata('PREMIUM:2.5:track.mp3')).toMatchObject({
      category: 'music',
      fileName: 'track.mp3',
      premium: true,
      priceMicro: '2500000',
      format: 'legacy-premium',
    })
    expect(parseWorkMetadata('PREMIUM:not-a-price:track.mp3')).toMatchObject({
      premium: false,
      priceMicro: '0',
    })
  })

  it('normalizes six-decimal prices and rejects unsafe values', () => {
    expect(priceToMicroUnits('0.02')).toBe('20000')
    expect(formatSUSDPrice('20000')).toBe('0.02')
    expect(() => priceToMicroUnits('0')).toThrow('greater than zero')
    expect(() => priceToMicroUnits('1.1234567')).toThrow('up to 6 decimal places')
  })
})
