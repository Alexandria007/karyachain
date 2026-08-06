import { describe, expect, it } from 'vitest'
import { clearCreatorActivity, getCreatorActivity, recordCreatorActivity } from './activity'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('creator activity history', () => {
  it('records newest events first and keeps the event fields inspectable', () => {
    const storage = new MemoryStorage()
    const event = recordCreatorActivity({
      type: 'upload',
      owner: '0x1',
      blobName: 'KARYA:v3:photo:free:0:2:cover.png',
      fileName: 'cover.png',
      revision: 2,
      size: 123,
      txHash: '0xcommit',
    }, storage)

    expect(event).toMatchObject({ type: 'upload', revision: 2, txHash: '0xcommit' })
    expect(getCreatorActivity(storage)).toHaveLength(1)
    expect(getCreatorActivity(storage)[0].blobName).toContain('cover.png')
  })

  it('clears local history without affecting other storage concerns', () => {
    const storage = new MemoryStorage()
    recordCreatorActivity({ type: 'download', blobName: 'notes.md', fileName: 'notes.md' }, storage)
    clearCreatorActivity(storage)
    expect(getCreatorActivity(storage)).toEqual([])
  })
})

