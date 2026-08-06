import { useCallback, useState } from 'react'
import { FileText, Music, Image, Video, Download, ExternalLink, Search, Lock, Loader, AlertCircle, DollarSign, ShieldCheck, RefreshCw } from 'lucide-react'
import type { FullObjectMetadata } from '@shelby-protocol/sdk/browser'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { useAccountBlobs } from '../hooks/useShelby'
import { getDisplayName } from '../hooks/usePremium'
import { formatSUSDPrice, getWorkCategoryLabel, parseWorkMetadata } from '../lib/karyaMetadata'
import { downloadShelbyBlob } from '../lib/shelby'
import { createProofPath } from '../lib/proof'
import { toast } from '../lib/toast'
import { getErrorMessage, reportClientError } from '../lib/diagnostics'
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

const getOwnerStr = (owner: FullObjectMetadata['owner'] | string | null | undefined): string => {
  if (!owner) return ''
  return owner.toString()
}


function effectivePrice(suffix: string) {
  return formatSUSDPrice(parseWorkMetadata(suffix).priceMicro)
}

// Shelby explorer URL — correct format
const explorerUrl = (ownerAddr: string, suffix: string) =>
  `https://explorer.shelby.xyz/shelbynet?address=${ownerAddr}&blob=${encodeURIComponent(suffix)}`

// ── Set Price Modal ────────────────────────────────────────────────────────────
function SetPriceModal({ blob, onClose, onDone }: {
  blob: FullObjectMetadata; onClose: () => void; onDone: () => void
}) {
  const suffix = blob.blobNameSuffix || blob.name || ''
  const metadata = parseWorkMetadata(suffix)
  const displayName = getDisplayName(suffix)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: '#141414', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 410 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Monetization status</h3>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 18 }}>{displayName}</p>
        {metadata.premium ? (
          <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: '#c9a84c' }}>
            Published premium price: <strong>{effectivePrice(suffix)} SUSD</strong>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 14px', marginBottom: 18, fontSize: 12, color: '#999' }}>
            This work is currently free. A price is embedded when you upload a new version with Premium enabled; Shelby blob names are immutable after registration.
          </div>
        )}
        <p style={{ fontSize: 11, color: '#666', marginBottom: 20 }}>
          Price metadata is stored in the Shelby blob name, and buyer payments are verified against finalized Aptos transactions.
        </p>
        <button onClick={() => { onDone(); onClose() }} style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#c9a84c', color: '#0a0a0a', fontSize: 13, cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>Close</button>
      </div>
    </div>
  )
}

// WorkCard
function WorkCard({ blob, ownerAddr, onSetPrice, onDownload }: {
  blob: FullObjectMetadata; ownerAddr: string; onSetPrice: () => void; onDownload: () => void
}) {
  const suffix = blob.blobNameSuffix || blob.name || ''
  const metadata = parseWorkMetadata(suffix)
  const premium = metadata.premium
  const price = formatSUSDPrice(metadata.priceMicro)
  const displayName = metadata.fileName
  const category = metadata.category
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
          <span style={{ fontSize: 11, color: '#666' }}>{getWorkCategoryLabel(category)} · {formatSize(blob.size)}</span>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={onSetPrice} title="View monetization status" aria-label={`View monetization status for ${displayName}`} style={{
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
            title="View on Shelby Explorer" aria-label={`Open ${displayName} on Shelby Explorer`}
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
          <a
            href={createProofPath({ owner: ownerAddr, blobName: suffix })}
            target="_blank"
            rel="noreferrer"
            title="Open public proof" aria-label={`Open public proof for ${displayName}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', color: '#65c986' }}
          >
            <ShieldCheck size={12} />
          </a>        </div>
      </div>
    </div>
  )
}

// ── Main MyWorks ───────────────────────────────────────────────────────────────
export default function MyWorks() {
  const { account, connected } = useWallet()
  const ownerAddr = getOwnerStr(account?.address)
  const { data: blobs, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAccountBlobs(ownerAddr)

  const [search, setSearch] = useState('')
  const [setPriceBlob, setSetPriceBlob] = useState<FullObjectMetadata | null>(null)

  const handleDownload = async (blob: FullObjectMetadata) => {
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
      reportClientError('my-works.download', error, { source: 'shelby-rpc', network: 'shelbynet', retryable: true })
      toast.error(getErrorMessage(error, 'Download failed.'))
    }
  }

  const filtered = (blobs || []).filter((b: FullObjectMetadata) => {
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
          blob={setPriceBlob}
          onClose={() => setSetPriceBlob(null)}
          onDone={() => setSetPriceBlob(null)}
        />
      )}

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>My Works</h1>
        <p style={{ color: '#666', fontSize: 15 }}>Your content stored on Shelby, with category and monetization metadata read from each blob.</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 28, maxWidth: 400 }}>
        <Search size={15} color="#666" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
        <input aria-label="Search your works" type="search" placeholder="Search your works..." value={search} onChange={e => setSearch(e.target.value)}
          className="input-field" style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10, fontSize: 14 }} />
      </div>

      {isLoading && (
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#666', padding: '60px 0' }}>
          <Loader size={20} color="#c9a84c" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading your works...</span>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', color: '#f87171' }}>
          <AlertCircle size={16} aria-hidden="true" />
          <span style={{ fontSize: 13, flex: 1 }}>{getErrorMessage(error, 'Failed to load your works.')}</span>
          <button type="button" onClick={() => { void refetch() }} className="btn-outline" aria-label="Retry loading your works">
            <RefreshCw size={13} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
          <FileText size={40} aria-hidden="true" style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>{search ? 'No works found for "' + search + '"' : "You haven't uploaded anything yet."}</p>
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map((blob: FullObjectMetadata) => (
            <WorkCard
              key={getOwnerStr(blob.owner) + ':' + (blob.blobNameSuffix || blob.name || '')}
              blob={blob}
              ownerAddr={ownerAddr}
              onSetPrice={() => setSetPriceBlob(blob)}
              onDownload={() => handleDownload(blob)}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && hasNextPage && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
          <button type="button" onClick={() => { void fetchNextPage() }} disabled={isFetchingNextPage} className="btn-outline" aria-label="Load more works">
            {isFetchingNextPage ? <Loader size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} aria-hidden="true" />}
            {isFetchingNextPage ? 'Loading more works...' : 'Load more works'}
          </button>
        </div>
      )}
    </div>
  )
}
