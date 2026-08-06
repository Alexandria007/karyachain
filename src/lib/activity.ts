export type CreatorActivityType = 'upload' | 'download' | 'purchase'

export type CreatorActivity = {
  id: string
  type: CreatorActivityType
  createdAt: number
  owner?: string
  buyer?: string
  blobName: string
  fileName: string
  revision?: number
  size?: number
  amountMicro?: string
  txHash?: string
}

const ACTIVITY_STORAGE_KEY = 'karya_creator_activity_v1'
const MAX_ACTIVITY_ITEMS = 100

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const getStorage = (): StorageLike | undefined => {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return undefined
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isActivityType = (value: unknown): value is CreatorActivityType =>
  value === 'upload' || value === 'download' || value === 'purchase'

const isActivity = (value: unknown): value is CreatorActivity => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<CreatorActivity>
  return (
    typeof record.id === 'string' &&
    isActivityType(record.type) &&
    typeof record.createdAt === 'number' &&
    typeof record.blobName === 'string' &&
    typeof record.fileName === 'string'
  )
}

export const getCreatorActivity = (storage: StorageLike | undefined = getStorage()): CreatorActivity[] => {
  if (!storage) return []
  try {
    const raw = storage.getItem(ACTIVITY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isActivity).slice(0, MAX_ACTIVITY_ITEMS) : []
  } catch {
    return []
  }
}

export const recordCreatorActivity = (
  activity: Omit<CreatorActivity, 'id' | 'createdAt'>,
  storage: StorageLike | undefined = getStorage(),
): CreatorActivity | null => {
  if (!storage) return null
  const event: CreatorActivity = { ...activity, id: createId(), createdAt: Date.now() }
  try {
    const history = getCreatorActivity(storage)
    storage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify([event, ...history].slice(0, MAX_ACTIVITY_ITEMS)))
    return event
  } catch {
    return null
  }
}

export const clearCreatorActivity = (storage: StorageLike | undefined = getStorage()): void => {
  try {
    storage?.removeItem(ACTIVITY_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in private browsing; the UI remains usable.
  }
}

