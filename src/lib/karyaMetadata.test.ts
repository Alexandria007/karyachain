import { describe, expect, it } from 'vitest'
import {
  encodeWorkBlobName,
  formatSUSDPrice,
  parseWorkMetadata,
  priceToMicroUnits,
} from './karyaMetadata'

describe('KaryaChain work metadata', () => {
  it('round-trips v2 category, premium price, and filenames containing colons', () => {
    const blobName = encodeWorkBlobName({
      category: 'photo',
      fileName: '/portfolio/cover:final.png',
      priceMicro: priceToMicroUnits('0.02'),
    })

    expect(blobName).toBe('KARYA:v2:photo:premium:2000000:portfolio/cover:final.png')
    expect(parseWorkMetadata(blobName)).toEqual({
      category: 'photo',
      fileName: 'portfolio/cover:final.png',
      premium: true,
      priceMicro: '2000000',
      format: 'karya-v2',
    })
  })

  it('preserves the intended price of v1 premium works while migrating to raw 8-decimal units', () => {
    expect(parseWorkMetadata('KARYA:v1:photo:premium:20000:old-cover.png')).toEqual({
      category: 'photo',
      fileName: 'old-cover.png',
      premium: true,
      priceMicro: '2000000',
      format: 'karya-v1',
    })
    expect(formatSUSDPrice(parseWorkMetadata('KARYA:v1:photo:premium:20000:old-cover.png').priceMicro)).toBe('0.02')
  })

  it('keeps free works explicitly free', () => {
    const blobName = encodeWorkBlobName({ category: 'writing', fileName: 'notes.md' })
    const metadata = parseWorkMetadata(blobName)

    expect(blobName).toBe('KARYA:v2:writing:free:0:notes.md')
    expect(metadata.premium).toBe(false)
    expect(metadata.priceMicro).toBe('0')
    expect(metadata.category).toBe('writing')
  })

  it('parses legacy premium names without treating malformed prices as payable', () => {
    expect(parseWorkMetadata('PREMIUM:2.5:track.mp3')).toMatchObject({
      category: 'music',
      fileName: 'track.mp3',
      premium: true,
      priceMicro: '250000000',
      format: 'legacy-premium',
    })
    expect(parseWorkMetadata('PREMIUM:not-a-price:track.mp3')).toMatchObject({
      premium: false,
      priceMicro: '0',
    })
  })

  it('normalizes eight-decimal prices and rejects unsafe values', () => {
    expect(priceToMicroUnits('0.02')).toBe('2000000')
    expect(priceToMicroUnits('1.12345678')).toBe('112345678')
    expect(formatSUSDPrice('2000000')).toBe('0.02')
    expect(() => priceToMicroUnits('0')).toThrow('greater than zero')
    expect(() => priceToMicroUnits('1.123456789')).toThrow('up to 8 decimal places')
  })
})
