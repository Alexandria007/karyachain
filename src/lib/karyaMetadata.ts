export const WORK_METADATA_PREFIX = 'KARYA:v2:'
export const WORK_METADATA_V1_PREFIX = 'KARYA:v1:'
export const SHELBY_USD_DECIMALS = 8
export const SHELBY_USD_SCALE = 100_000_000n
const LEGACY_APP_SCALE = 1_000_000n

export const WORK_CATEGORIES = ['writing', 'music', 'photo', 'video', 'other'] as const
export type WorkCategory = (typeof WORK_CATEGORIES)[number]

export type WorkMetadata = {
  category: WorkCategory
  fileName: string
  premium: boolean
  priceMicro: string
  format: 'karya-v2' | 'karya-v1' | 'legacy-premium' | 'plain'
}

const isWorkCategory = (value: string): value is WorkCategory =>
  (WORK_CATEGORIES as readonly string[]).includes(value)

const inferCategoryFromFileName = (fileName: string): WorkCategory => {
  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(extension)) return 'music'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'].includes(extension)) return 'photo'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(extension)) return 'video'
  if (['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'odt'].includes(extension)) return 'writing'
  return 'other'
}

const normalizeMicroAmount = (value: string | number | bigint | undefined): string => {
  if (value === undefined || value === '') return '0'
  try {
    const amount = BigInt(value)
    if (amount < 0n) throw new Error('Negative amount')
    return amount.toString()
  } catch {
    throw new Error('Invalid ShelbyUSD amount.')
  }
}

/** Convert a human ShelbyUSD value into the 8-decimal on-chain amount. */
export const priceToMicroUnits = (raw: string): string => {
  const value = raw.trim()
  if (!/^\d+(?:\.\d{1,8})?$/.test(value)) {
    throw new Error(`Enter a ShelbyUSD price with up to ${SHELBY_USD_DECIMALS} decimal places.`)
  }

  const [whole, fraction = ''] = value.split('.')
  const amount = BigInt(whole) * SHELBY_USD_SCALE + BigInt(fraction.padEnd(SHELBY_USD_DECIMALS, '0') || '0')
  if (amount <= 0n) throw new Error('ShelbyUSD price must be greater than zero.')
  return amount.toString()
}

export const formatSUSDPrice = (microAmount: string | number | bigint): string => {
  const amount = BigInt(microAmount)
  const whole = amount / SHELBY_USD_SCALE
  const fraction = (amount % SHELBY_USD_SCALE).toString().padStart(SHELBY_USD_DECIMALS, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

const legacyV1ToShelbyUnits = (value: string): string =>
  (BigInt(value) * SHELBY_USD_SCALE / LEGACY_APP_SCALE).toString()

/**
 * Encode application metadata into the Shelby blob name. Blob names are the
 * durable metadata boundary available to this MVP, so no browser-only state
 * is needed to reconstruct a work's category or price.
 */
export const encodeWorkBlobName = ({
  category,
  fileName,
  priceMicro = '0',
}: {
  category: WorkCategory
  fileName: string
  priceMicro?: string | number | bigint
}): string => {
  const safeName = fileName.trim().replace(/^\/+/, '') || 'untitled'
  const normalizedPrice = normalizeMicroAmount(priceMicro)
  const access = normalizedPrice === '0' ? 'free' : 'premium'
  return `${WORK_METADATA_PREFIX}${category}:${access}:${normalizedPrice}:${safeName}`
}

export const parseWorkMetadata = (blobNameSuffix: string): WorkMetadata => {
  const value = String(blobNameSuffix || '')

  if (value.startsWith(WORK_METADATA_PREFIX) || value.startsWith(WORK_METADATA_V1_PREFIX)) {
    const isV1 = value.startsWith(WORK_METADATA_V1_PREFIX)
    const prefix = isV1 ? WORK_METADATA_V1_PREFIX : WORK_METADATA_PREFIX
    const parts = value.slice(prefix.length).split(':')
    const rawCategory = parts[0] || ''
    const category: WorkCategory = isWorkCategory(rawCategory) ? rawCategory : 'other'
    const access = parts[1] || 'free'
    const priceMicro = (() => {
      try {
        const normalized = normalizeMicroAmount(parts[2] || '0')
        return isV1 ? legacyV1ToShelbyUnits(normalized) : normalized
      } catch {
        return '0'
      }
    })()
    const fileName = parts.slice(3).join(':') || 'untitled'
    return {
      category,
      fileName,
      premium: access === 'premium' && priceMicro !== '0',
      priceMicro,
      format: isV1 ? 'karya-v1' : 'karya-v2',
    }
  }

  // Backward compatibility for the original MVP naming convention.
  if (value.startsWith('PREMIUM:')) {
    const parts = value.split(':')
    const legacyPrice = parts[1] || '0'
    let priceMicro = '0'
    try {
      priceMicro = priceToMicroUnits(legacyPrice)
    } catch {
      // Keep malformed legacy names readable, but do not treat them as payable.
    }
    const fileName = parts.slice(2).join(':') || value
    return {
      category: inferCategoryFromFileName(fileName),
      fileName,
      premium: priceMicro !== '0',
      priceMicro,
      format: 'legacy-premium',
    }
  }

  return {
    category: inferCategoryFromFileName(value),
    fileName: value,
    premium: false,
    priceMicro: '0',
    format: 'plain',
  }
}

export const getWorkCategoryLabel = (category: WorkCategory): string => {
  const labels: Record<WorkCategory, string> = {
    writing: 'Writing',
    music: 'Music',
    photo: 'Photo',
    video: 'Video',
    other: 'Other',
  }
  return labels[category]
}
