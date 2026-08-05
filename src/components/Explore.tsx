import { useCallback, useState, useEffect } from 'react'
import {
  Search, Download, ExternalLink, FileText, Music, Image, Video,
  Globe, Loader, AlertCircle, Lock, Unlock, DollarSign,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import type { FullObjectMetadata } from '@shelby-protocol/sdk/browser'
import { downloadShelbyBlob, getShelbyBlobs } from '../lib/shelby'
import { usePremium, isPremiumBlob, parsePremiumPrice, getDisplayName } from '../hooks/usePremium'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { toast } from '../lib/toast'
import { ShelbyImagePreview } from './ShelbyImagePreview'

// â”€â”€ Types & constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type FileCategory = 'all' | 'image' | 'audio' | 'video' | 'document'
const IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','svg']
const AUDIO_EXTS = ['mp3','wav','flac','aac','ogg']
const VIDEO_EXTS = ['mp4','mov','avi','mkv','webm']
const PAGE_SIZE = 24

const getCategory = (name: string): Exclude<FileCategory, 'all'> => {
  const ext = (name || '').split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (AUDIO_EXTS.includes(ext)) return 'audio'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  return 'document'
}
const isImage = (name: string) => IMAGE_EXTS.includes((name || '').split('.').pop()?.toLowerCase() || '')

const FileIcon = ({ name, size = 16 }: { name: string; size?: number }) => {
  const cat = getCategory(name)
  if (cat === 'image') return <Image size={size} />
  if (cat === 'audio') return <Music size={size} />
  if (cat === 'video') return <Video size={size} />
  return <FileText size={size} />
}

const getOwnerStr = (owner: FullObjectMetadata['owner'] | string | null | undefined): string => {
  if (!owner) return ''
  return owner.toString()
}

const shortAddr = (a: string) => (!a || a.length < 10) ? a : a.slice(0, 6) + '...' + a.slice(-4)
const formatSize = (n: number) => {
  if (!n) return 'â€”'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(2)} MB`
}

// â”€â”€ Buy Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BuyModal({ blob, ownerAddr, onClose, onSuccess }: { blob: FullObjectMetadata; ownerAddr: string; onClose: () => void; onSuccess: () => void }) {
  const { buyAccess } = usePremium()
  const suffix = blob.blobNameSuffix || blob.name || ''
  const price = parsePremiumPrice(suffix)
  const displayName = getDisplayName(suffix)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleBuy = () => {
    setBusy(true); setErr('')
    buyAccess(ownerAddr, suffix,
      () => { setBusy(false); toast.success(`Access unlocked for "${displayName}"!`); onSuccess() },
      (e) => { setBusy(false); setErr(e) }
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: '#141414', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color="#c9a84c" />
          </div>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Premium Content</h3>
          <p style={{ color: '#666', fontSize: 13 }}>{displayName}</p>
          <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>by {shortAddr(ownerAddr)}</p>
        </div>
        <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 10, padding: '14px', marginBottom: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 30, fontFamily: 'Syne, sans-serif', fontWeight: 800, color: '#c9a84c' }}>{price}</span>
          <span style={{ fontSize: 14, color: '#888', marginLeft: 6 }}>SUSD</span>
          <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Experimental demo payment - access enforcement is not active yet</p>
        </div>
        {err && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#f87171', fontSize: 12, marginBottom: 14, background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '8px 12px' }}><AlertCircle size={13} />{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleBuy} disabled={busy} style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: '#c9a84c', color: '#0a0a0a', fontSize: 13, cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, opacity: busy ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {busy ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</> : <><DollarSign size={13} /> Buy Â· {price} SUSD</>}
          </button>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

// â”€â”€ Blob Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BlobCard({ blob, ownerAddr, isOwner, unlocked, onBuy, onDownload }: {
  blob: FullObjectMetadata; ownerAddr: string; isOwner: boolean; unlocked: boolean; onBuy: () => void; onDownload: () => void
}) {
  const suffix = blob.blobNameSuffix || blob.name || ''
  const premium = isPremiumBlob(suffix)
  const price = parsePremiumPrice(suffix)
  const displayName = getDisplayName(suffix)
  const imgFile = isImage(displayName)
  const [imgErr, setImgErr] = useState(false)
  const handleImageError = useCallback(() => setImgErr(true), [])
  const locked = premium && !unlocked && !isOwner

  return (
    <div className="card" style={{ borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Preview area */}
      <div style={{
        height: imgFile && !imgErr ? 160 : 72, position: 'relative', overflow: 'hidden',
        background: imgFile && !imgErr ? '#0d0d0d' : 'rgba(201,168,76,0.03)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {imgFile && !imgErr && !locked ? (
          <ShelbyImagePreview account={ownerAddr} blobName={suffix} alt={displayName} onError={handleImageError}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ color: '#c9a84c', opacity: 0.4 }}><FileIcon name={displayName} size={26} /></div>
        )}
        {/* Lock overlay */}
        {locked && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Lock size={18} color="#c9a84c" />
            <span style={{ fontSize: 11, color: '#c9a84c', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{price} SUSD</span>
          </div>
        )}
        {/* Badges */}
        {premium && !locked && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '2px 7px' }}>
            <Unlock size={9} color="#22c55e" />
            <span style={{ fontSize: 9, color: '#22c55e', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>UNLOCKED</span>
          </div>
        )}
        {premium && !imgFile && locked && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '2px 7px' }}>
            <Lock size={9} color="#c9a84c" />
            <span style={{ fontSize: 9, color: '#c9a84c', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{price} SUSD</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{displayName}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>{shortAddr(ownerAddr)}</span>
            <span style={{ fontSize: 11, color: '#666' }}>{formatSize(blob.size)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {locked ? (
            <button onClick={onBuy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: 'none', background: '#c9a84c', color: '#0a0a0a', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
              <Lock size={11} /> Buy Â· {price} SUSD
            </button>
          ) : (
            <button onClick={onDownload} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#c9a84c', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
              <Download size={11} /> Download
            </button>
          )}
          <button onClick={() => window.open(`https://explorer.shelby.xyz/shelbynet/blobs/${ownerAddr}/${encodeURIComponent(suffix)}`, '_blank')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
            <ExternalLink size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// â”€â”€ Main Explore â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CAT_LABELS: Record<FileCategory, string> = { all: 'All', image: 'Images', audio: 'Audio', video: 'Video', document: 'Documents' }

export default function Explore() {
  const { account } = useWallet()
  const { hasAccess } = usePremium()
  const myAddr = account?.address?.toString() || ''

  const [blobs, setBlobs] = useState<FullObjectMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<FileCategory>('all')
  const [page, setPage] = useState(1)
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>({})
  const [buyTarget, setBuyTarget] = useState<{ blob: FullObjectMetadata; ownerAddr: string } | null>(null)

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null)
      try {
        const result = await getShelbyBlobs()
        const nowMicros = Date.now() * 1000
        const all = result.filter(blob => blob.isWritten && !blob.isDeleted && blob.expirationMicros > nowMicros)
        if (!active) return
        setBlobs(all)
        const map: Record<string, boolean> = {}
        all.forEach(blob => {
          const o = getOwnerStr(blob.owner)
          const s = blob.blobNameSuffix || blob.name || ''
          map[`${o}_${s}`] = hasAccess(o, s)
        })
        setUnlockedMap(map)
      } catch (error: unknown) {
        if (active) setError(error instanceof Error ? error.message : 'Failed to fetch')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [hasAccess])

  const filtered = blobs.filter(b => {
    const suffix = b.blobNameSuffix || b.name || ''
    const name = getDisplayName(suffix).toLowerCase()
    const owner = getOwnerStr(b.owner).toLowerCase()
    const matchSearch = !search.trim() || name.includes(search.toLowerCase()) || owner.includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || getCategory(getDisplayName(suffix)) === catFilter
    return matchSearch && matchCat
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, catFilter])

  // Counts per category
  const counts: Record<FileCategory, number> = { all: blobs.length, image: 0, audio: 0, video: 0, document: 0 }
  blobs.forEach(b => { const c = getCategory(getDisplayName(b.blobNameSuffix || b.name || '')); counts[c]++ })

  const handleDownload = async (blob: FullObjectMetadata, ownerAddr: string) => {
    const suffix = blob.blobNameSuffix || blob.name || ''
    const name = getDisplayName(suffix)
    try {
      const data = await downloadShelbyBlob(ownerAddr, suffix)
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    toast.success(`Downloading "${name}"`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Download failed.')
    }
  }

  const handleBuySuccess = (ownerAddr: string, suffix: string) => {
    setUnlockedMap(prev => ({ ...prev, [`${ownerAddr}_${suffix}`]: true }))
    setBuyTarget(null)
  }

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', maxWidth: 1140, margin: '0 auto' }}>
      {buyTarget && (
        <BuyModal blob={buyTarget.blob} ownerAddr={buyTarget.ownerAddr} onClose={() => setBuyTarget(null)}
          onSuccess={() => handleBuySuccess(buyTarget.ownerAddr, buyTarget.blob.blobNameSuffix || buyTarget.blob.name || '')} />
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
          <Globe size={12} color="#c9a84c" />
          <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#c9a84c', textTransform: 'uppercase' }}>Shelbynet</span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Explore Works</h1>
        <p style={{ color: '#666', fontSize: 15 }}>Browse readable content on the Shelby developer network. Premium labels are experimental in this MVP.</p>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
          <Search size={15} color="#666" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search by name or address..." value={search} onChange={e => setSearch(e.target.value)}
            className="input-field" style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10, fontSize: 14 }} />
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {(Object.keys(CAT_LABELS) as FileCategory[]).map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              fontFamily: 'Syne, sans-serif', fontWeight: 600,
              border: catFilter === cat ? '1px solid #c9a84c' : '1px solid rgba(255,255,255,0.1)',
              background: catFilter === cat ? 'rgba(201,168,76,0.1)' : 'transparent',
              color: catFilter === cat ? '#c9a84c' : '#666', transition: 'all 0.2s',
            }}>
              {CAT_LABELS[cat]}{!loading && <span style={{ marginLeft: 5, opacity: 0.55, fontSize: 10 }}>{counts[cat]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#666', fontSize: 13 }}>
            <span style={{ color: '#c9a84c', fontWeight: 600 }}>{Math.min(page * PAGE_SIZE, filtered.length)}</span> / <span style={{ color: '#c9a84c', fontWeight: 600 }}>{filtered.length}</span> blobs
          </span>
          {totalPages > 1 && <span style={{ color: '#555', fontSize: 12 }}>Page {page} of {totalPages}</span>}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
          <Loader size={32} color="#c9a84c" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#666', fontSize: 14 }}>Fetching from Shelby Protocol...</p>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {error && <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '16px 20px', color: '#f87171' }}><AlertCircle size={18} /><span style={{ fontSize: 14 }}>{error}</span></div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
          <Globe size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>{search ? `No results for "${search}"` : 'No blobs found.'}</p>
        </div>
      )}

      {/* Grid */}
      {!loading && paginated.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16, marginBottom: 32 }}>
          {paginated.map((blob, i) => {
            const ownerAddr = getOwnerStr(blob.owner)
            const suffix = blob.blobNameSuffix || blob.name || ''
            const isOwner = !!myAddr && myAddr.toLowerCase() === ownerAddr.toLowerCase()
            const unlocked = unlockedMap[`${ownerAddr}_${suffix}`] ?? !isPremiumBlob(suffix)
            return (
              <BlobCard key={i} blob={blob} ownerAddr={ownerAddr} isOwner={isOwner} unlocked={unlocked}
                onBuy={() => setBuyTarget({ blob, ownerAddr })}
                onDownload={() => handleDownload(blob, ownerAddr)} />
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#333' : '#888' }}>
            <ChevronLeft size={15} /> Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce((acc: (number | string)[], p, idx, arr) => {
              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('â€¦')
              acc.push(p); return acc
            }, [])
            .map((p, i) => p === 'â€¦' ? (
              <span key={`e${i}`} style={{ color: '#444', padding: '0 2px' }}>â€¦</span>
            ) : (
              <button key={p} onClick={() => setPage(p as number)} style={{ width: 36, height: 36, borderRadius: 8, fontSize: 13, cursor: 'pointer', border: page === p ? '1px solid #c9a84c' : '1px solid rgba(255,255,255,0.1)', background: page === p ? 'rgba(201,168,76,0.1)' : 'transparent', color: page === p ? '#c9a84c' : '#777', fontFamily: 'Syne, sans-serif', fontWeight: page === p ? 700 : 400 }}>{p}</button>
            ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#333' : '#888' }}>
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
