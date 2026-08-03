import { useState, useEffect } from 'react'
import { Search, Download, ExternalLink, FileText, Music, Image, Video, Globe, Loader, AlertCircle } from 'lucide-react'
import { shelbyClient } from '../lib/shelby'

const fileTypeIcon = (name: string) => {
  const ext = (name || '').split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <Image size={16} />
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return <Music size={16} />
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return <Video size={16} />
  return <FileText size={16} />
}

const formatSize = (bytes: number) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const formatDate = (micros: number) => {
  if (!micros) return '—'
  return new Date(micros / 1000).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

// Handle AccountAddress object dari Aptos SDK yang bisa berbagai format
const getOwnerStr = (owner: any): string => {
  if (!owner) return ''
  if (typeof owner === 'string') return owner
  // AccountAddress punya .toString() tapi kadang returnnya object description
  // Coba via .data (Uint8Array internal Aptos AccountAddress)
  if (owner.data) {
    return '0x' + Array.from(owner.data as number[])
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  try { return owner.toString() } catch { return '' }
}

const shortAddr = (addr: string) => {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

export default function Explore() {
  const [blobs, setBlobs] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchBlobs = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await shelbyClient.coordination.getBlobs({})
        const all = result as any[]
        console.log('[Explore] total:', all.length)
        console.log('[Explore] sample blob:', all[0])
        console.log('[Explore] owner type:', typeof all[0]?.owner, all[0]?.owner)
        const active = all.filter(b => !b.isDeleted)
        setBlobs(active)
        setFiltered(active)
      } catch (err: any) {
        console.error('[Explore] error:', err)
        setError(err?.message || 'Failed to fetch blobs')
      } finally {
        setLoading(false)
      }
    }
    fetchBlobs()
  }, [])

  useEffect(() => {
    if (!search.trim()) { setFiltered(blobs); return }
    const q = search.toLowerCase()
    setFiltered(blobs.filter(b => {
      const name = String(b.blobNameSuffix || b.name || '').toLowerCase()
      const owner = getOwnerStr(b.owner).toLowerCase()
      return name.includes(q) || owner.includes(q)
    }))
  }, [search, blobs])

  const handleDownload = (blob: any) => {
    const ownerAddr = getOwnerStr(blob.owner)
    const suffix = blob.blobNameSuffix || blob.name || ''
    const url = `https://api.testnet.shelby.xyz/shelby/v1/blobs/${ownerAddr}/${encodeURIComponent(suffix)}`
    const a = document.createElement('a')
    a.href = url
    a.download = suffix
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleExplorer = (blob: any) => {
    const ownerAddr = getOwnerStr(blob.owner)
    const suffix = blob.blobNameSuffix || blob.name || ''
    window.open(`https://explorer.shelby.xyz/testnet/blobs/${ownerAddr}/${encodeURIComponent(suffix)}`, '_blank')
  }

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 20, padding: '4px 14px', marginBottom: 16,
        }}>
          <Globe size={12} color="#c9a84c" />
          <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#c9a84c', textTransform: 'uppercase' }}>
            Shelby Testnet
          </span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          Explore Works
        </h1>
        <p style={{ color: '#666', fontSize: 15 }}>
          All content stored on Shelby Protocol — decentralized, permanent, creator-owned.
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 32, maxWidth: 480 }}>
        <Search size={16} color="#666" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Search by name or wallet address..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field"
          style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: 10, fontSize: 14 }}
        />
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div style={{ marginBottom: 28 }}>
          <span style={{ color: '#666', fontSize: 13 }}>
            Showing{' '}
            <span style={{ color: '#c9a84c', fontWeight: 600 }}>{filtered.length}</span>
            {' '}of{' '}
            <span style={{ color: '#c9a84c', fontWeight: 600 }}>{blobs.length}</span>
            {' '}blobs
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
          <Loader size={32} color="#c9a84c" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#666', fontSize: 14 }}>Fetching from Shelby Protocol...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '16px 20px', color: '#f87171',
        }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: 14 }}>{error}</span>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
          <Globe size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>{search ? `No blobs found for "${search}"` : 'No blobs found.'}</p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {filtered.map((blob, i) => {
            const ownerStr = getOwnerStr(blob.owner)
            const blobName = String(blob.blobNameSuffix || blob.name || 'Unnamed')
            return (
              <div key={i} className="card" style={{ borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a84c',
                  }}>
                    {fileTypeIcon(blobName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4,
                    }}>
                      {blobName}
                    </p>
                    <p style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>
                      {shortAddr(ownerStr)}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, color: '#888',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, padding: '3px 8px',
                  }}>
                    {formatSize(blob.size)}
                  </span>
                  {blob.creationMicros ? (
                    <span style={{
                      fontSize: 11, color: '#888',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6, padding: '3px 8px',
                    }}>
                      {formatDate(blob.creationMicros)}
                    </span>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDownload(blob)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
                      color: '#c9a84c', fontFamily: 'Syne, sans-serif', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.1)')}
                  >
                    <Download size={13} /> Download
                  </button>
                  <button
                    onClick={() => handleExplorer(blob)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#888', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#888')}
                    title="View on Explorer"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
