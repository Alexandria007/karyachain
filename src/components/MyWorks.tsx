import { useCallback, useState } from 'react'
import { FileText, Music, Image, Video, Download, ExternalLink, Search, Lock, Loader, AlertCircle, DollarSign } from 'lucide-react'
import type { BlobMetadata } from '@shelby-protocol/sdk/browser'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { useAccountBlobs } from '../hooks/useShelby'
import { isPremiumBlob, parsePremiumPrice, getDisplayName } from '../hooks/usePremium'
import { downloadShelbyBlob } from '../lib/shelby'
import { toast } from '../lib/toast'
import { ShelbyImagePreview } from './ShelbyImagePreview'

// ── Helpers ────────────────────────────────────────────────────────────────────
const IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','svg']
const isImageFile = (name: string) => IMAGE_EXTS.includes((name || '').split('.').pop()?.toLowerCase() || '')

const FileIcon = ({ name, size = 22 }: { name: string; size?: number }) => {
  const ext = (name || '').split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.includes(ext)) return <Image size={size} />
  if (['mp3','wav','flac','aac','ogg'].includes(ext)) return <Music size={size} />
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return <Video size={size} />
  return <FileText size={size} />
}

const formatSize = (n: number) => {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(2)} MB`
}

const getOwnerStr = (owner: BlobMetadata['owner'] | string | null | undefined): string => {
  if (!owner) return ''
  return owner.toString()
}

function getLocalPrice(ownerAddr: string, suffix: string): number | null {
  const raw = localStorage.getItem(`karya_premium_${ownerAddr}_${suffix}`)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('price' in parsed)) return null
    const price = (parsed as { price?: unknown }).price
    return typeof price === 'number' ? price : null
  } catch {
    return null
  }
}
function hasLocalPremium(ownerAddr: string, suffix: string): boolean {
  return getLocalPrice(ownerAddr, suffix) !== null
}

function setLocalPrice(ownerAddr: string, suffix: string, price: number): boolean {
  try {
    localStorage.setItem(`karya_premium_${ownerAddr}_${suffix}`, JSON.stringify({ price }))
    return true
  } catch {
    return false
  }
}

function removeLocalPrice(ownerAddr: string, suffix: string): boolean {
  try {
    localStorage.removeItem(`karya_premium_${ownerAddr}_${suffix}`)
    return true
  } catch {
    return false
  }
}
function effectiveIsPremium(suffix: string, ownerAddr: string) { return isPremiumBlob(suffix) || hasLocalPremium(ownerAddr, suffix) }
function effectivePrice(suffix: string, ownerAddr: string) { return getLocalPrice(ownerAddr, suffix) ?? parsePremiumPrice(suffix) }

// Shelby explorer URL — correct format
const explorerUrl = (ownerAddr: string, suffix: string) =>
  `https://explorer.shelby.xyz/testnet?address=${ownerAddr}&blob=${encodeURIComponent(suffix)}`

// ── Set Price Modal ────────────────────────────────────────────────────────────
function SetPriceModal({ blob, ownerAddr, onClose, onDone }: {
  blob: BlobMetadata; ownerAddr: string; onClose: () => void; onDone: () => void
}) {
  const suffix = blob.blobNameSuffix || blob.name || ''
  const displayName = getDisplayName(suffix)
  const isAlreadyPremium = effectiveIsPremium(suffix, ownerAddr)
  const currentPrice = effectivePrice(suffix, ownerAddr)
  const [price, setPrice] = useState(isAlreadyPremium ? String(currentPrice) : '')
  const [err, setErr] = useState('')

  const handleSave = () => {
    const p = parseFloat(price)
    if (isNaN(p) || p <= 0) { setErr('Enter a valid price.'); return }
    if (!setLocalPrice(ownerAddr, suffix, p)) {
      setErr('Could not save the local demo price in this browser.')
      return
    }
    toast.success(`Price set to ${p} SUSD for "${displayName}"`)
    onDone()
  }

  const handleRemove = () => {
    if (!removeLocalPrice(ownerAddr, suffix)) {
      setErr('Could not remove the local demo price in this browser.')
      return
    }
    toast.info(`Premium removed from "${displayName}"`)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: '#141414', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Set Premium Price</h3>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>{displayName}</p>
        {isAlreadyPremium && (
          <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#c9a84c' }}>
            Current price: {currentPrice} SUSD
          </div>
        )}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#888', fontFamily: 'Syne, sans-serif' }}>New Price (SUSD)</label>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
            placeholder={isAlreadyPremium ? String(currentPrice) : 'e.g. 5'}
            className="input-field" style={{ width: '100%', padding: '10px 50px 10px 14px', borderRadius: 8, fontSize: 14 }} />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#c9a84c', fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>SUSD</span>
        </div>
        <p style={{ fontSize: 11, color: '#555', marginBottom: err ? 8 : 20 }}>Price is saved locally in this MVP; it is not an on-chain access rule.</p>
        {err && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#f87171', fontSize: 12, marginBottom: 16 }}><AlertCircle size={13} />{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          {isAlreadyPremium && (
            <button onClick={handleRemove} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 13, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>Remove</button>
          )}
          <button onClick={handleSave} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#c9a84c', color: '#0a0a0a', fontSize: 13, cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>Set Price</button>
        </div>
      </div>
    </div>
  )
}

// ── WorkCard — extracted component so useState is never inside .map() ──────────
function WorkCard({ blob, ownerAddr, onSetPrice, onDownload }: {
  blob: BlobMetadata; ownerAddr: string; onSetPrice: () => void; onDownload: () => void
}) {
  const suffix = blob.blobNameSuffix || blob.name || ''
  const premium = effectiveIsPremium(suffix, ownerAddr)
  const price = effectivePrice(suffix, ownerAddr)
  const displayName = getDisplayName(suffix)
  const imgFile = isImageFile(displayName)
  // ✅ useState now safely inside a component, not inside .map()
  const [imgErr, setImgErr] = useState(false)
  const handleImageError = useCallback(() => setImgErr(true), [])

  return (
    <div className="card" style={{ borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Preview */}
      <div style={{
        height: imgFile && !imgErr ? 150 : 64, position: 'relative',
        background: imgFile && !imgErr ? '#0d0d0d' : 'rgba(201,168,76,0.03)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}>
        {imgFile && !imgErr ? (
          <ShelbyImagePreview account={ownerAddr} blobName={suffix} alt={displayName} onError={handleImageError}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ color: '#c9a84c', opacity: 0.4 }}><FileIcon name={displayName} size={22} /></div>
        )}
        {premium && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            display: 'flex', alignItems: 'center', gap: 3,
            background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)',
            borderRadius: 20, padding: '3px 8px',
          }}>
            <Lock size={9} color="#c9a84c" />
            <span style={{ fontSize: 9, color: '#c9a84c', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{price} SUSD</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
            {displayName}
          </p>
          <span style={{ fontSize: 11, color: '#666' }}>{formatSize(blob.size)}</span>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={onSetPrice} title="Set Premium Price" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
            background: premium ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.04)',
            border: premium ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(255,255,255,0.08)',
            color: premium ? '#c9a84c' : '#666',
          }}>
            <DollarSign size={13} />
          </button>
          <button onClick={onDownload} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '7px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
            color: '#c9a84c', fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>
            <Download size={12} /> Download
          </button>
          <button
            onClick={() => window.open(explorerUrl(ownerAddr, suffix), '_blank')}
            title="View on Shelby Explorer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px',
              borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', color: '#888', transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888')}
          >
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main MyWorks ───────────────────────────────────────────────────────────────
export default function MyWorks() {
  const { account, connected } = useWallet()
  const ownerAddr = getOwnerStr(account?.address)
  const { data: blobs, isLoading, error, refetch } = useAccountBlobs(ownerAddr)

  const [search, setSearch] = useState('')
  const [setPriceBlob, setSetPriceBlob] = useState<BlobMetadata | null>(null)

  const handleDownload = async (blob: BlobMetadata) => {
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

  const filtered = (blobs || []).filter((b: BlobMetadata) => {
    const s = b.blobNameSuffix || b.name || ''
    return getDisplayName(s).toLowerCase().includes(search.toLowerCase())
  })

  if (!connected) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <Lock size={40} color="#c9a84c" style={{ marginBottom: 16, opacity: 0.6 }} />
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, marginBottom: 8 }}>Connect your wallet</h2>
          <p style={{ color: '#666' }}>Connect Petra wallet to see your works.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {setPriceBlob && (
        <SetPriceModal
          blob={setPriceBlob} ownerAddr={ownerAddr}
          onClose={() => setSetPriceBlob(null)}
          onDone={() => { setSetPriceBlob(null); refetch() }}
        />
      )}

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>My Works</h1>
        <p style={{ color: '#666', fontSize: 15 }}>Your content stored on Shelby testnet.</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 28, maxWidth: 400 }}>
        <Search size={15} color="#666" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
        <input type="text" placeholder="Search your works..." value={search} onChange={e => setSearch(e.target.value)}
          className="input-field" style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10, fontSize: 14 }} />
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#666', padding: '60px 0' }}>
          <Loader size={20} color="#c9a84c" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading your works...</span>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', color: '#f87171' }}>
          <AlertCircle size={16} /><span style={{ fontSize: 13 }}>Failed to load. Check your API key in .env.</span>
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
          <FileText size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>{search ? `No works found for "${search}"` : "You haven't uploaded anything yet."}</p>
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map((blob: BlobMetadata, i: number) => (
            <WorkCard
              key={i}
              blob={blob}
              ownerAddr={ownerAddr}
              onSetPrice={() => setSetPriceBlob(blob)}
              onDownload={() => handleDownload(blob)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
