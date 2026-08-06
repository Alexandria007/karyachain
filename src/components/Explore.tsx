import { useCallback, useState, useEffect, useRef } from 'react'
import {
  Search, Download, ExternalLink, FileText, Music, Image, Video,
  Globe, Loader, AlertCircle, Lock, Unlock, DollarSign,
  RefreshCw, ShieldCheck
} from 'lucide-react'
import type { FullObjectMetadata } from '@shelby-protocol/sdk/browser'
import { downloadShelbyBlob, getShelbyBlobsPage } from '../lib/shelby'
import { createProofPath } from '../lib/proof'
import { usePremium, isPremiumBlob, getDisplayName } from '../hooks/usePremium'
import { formatSUSDPrice, getWorkCategoryLabel, parseWorkMetadata, type WorkCategory } from '../lib/karyaMetadata'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { toast } from '../lib/toast'
import { getErrorMessage, reportClientError } from '../lib/diagnostics'
import { ShelbyImagePreview } from './ShelbyImagePreview'

// â”€â”€ Types & constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type FileCategory = 'all' | WorkCategory
const IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','svg','heic']
const PAGE_SIZE = 24
const looksLikeAptosAddress = (value: string) => /^0x[0-9a-f]{8,64}$/i.test(value.trim())

const getCategory = (name: string): WorkCategory => parseWorkMetadata(name).category
const isImage = (name: string) => IMAGE_EXTS.includes((name || '').split('.').pop()?.toLowerCase() || '')

const FileIcon = ({ name, size = 16 }: { name: string; size?: number }) => {
  const cat = getCategory(name)
  if (cat === 'photo') return <Image size={size} />
  if (cat === 'music') return <Music size={size} />
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
function BuyModal({ blob, ownerAddr, onClose, onSuccess }: { blob: FullObjectMetadata; ownerAddr: string; onClose: () => void; onSuccess: (txHash: string) => void }) {
  const { buyAccess } = usePremium()
  const suffix = blob.blobNameSuffix || blob.name || ''
  const price = formatSUSDPrice(parseWorkMetadata(suffix).priceMicro)
  const displayName = getDisplayName(suffix)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleBuy = () => {
    setBusy(true); setErr('')
    buyAccess(ownerAddr, suffix,
      (txHash) => { setBusy(false); toast.success('Access unlocked for "' + displayName + '" · ' + txHash.slice(0, 10) + '...'); onSuccess(txHash) },
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
          <p style={{ fontSize: 11, color: '#777', marginTop: 4 }}>Finalized ShelbyUSD transfer is verified against this creator, blob price, and buyer wallet. Direct Shelby reads remain public in this MVP.</p>
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
  const price = formatSUSDPrice(parseWorkMetadata(suffix).priceMicro)
  const displayName = getDisplayName(suffix)
  const category = getCategory(suffix)
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
            <span style={{ fontSize: 11, color: '#666' }}>{getWorkCategoryLabel(category)} · {formatSize(blob.size)}</span>
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
          <button type="button" aria-label="Open work on Shelby Explorer" onClick={() => window.open(`https://explorer.shelby.xyz/shelbynet/blobs/${ownerAddr}/${encodeURIComponent(suffix)}`, '_blank')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
            <ExternalLink size={11} />
          </button>
          <a
            href={createProofPath({ owner: ownerAddr, blobName: suffix })}
            target="_blank"
            rel="noreferrer"
            title="Open public proof"
            aria-label="Open public proof"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', color: '#65c986', textDecoration: 'none' }}
          >
            <ShieldCheck size={11} />
          </a>        </div>
      </div>
    </div>
  )
}

// â”€â”€ Main Explore â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CAT_LABELS: Record<FileCategory, string> = { all: 'All', writing: 'Writing', music: 'Music', photo: 'Photo', video: 'Video', other: 'Other' }


export default function Explore() {
  const { account } = useWallet()
  const { hasAccess, verifyAccess } = usePremium()
  const myAddr = account?.address?.toString() || ''

  const [blobs, setBlobs] = useState<FullObjectMetadata[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<string | undefined>()
  const [catFilter, setCatFilter] = useState<FileCategory>('all')
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>({})
  const [buyTarget, setBuyTarget] = useState<{ blob: FullObjectMetadata; ownerAddr: string } | null>(null)
  const requestIdRef = useRef(0)

  const blobKey = (blob: FullObjectMetadata): string => {
    const owner = getOwnerStr(blob.owner)
    return `${owner}:${blob.blobNameSuffix || blob.name || ''}`
  }

  const loadPage = useCallback(async (pageOffset: number, append: boolean, accountFilter?: string) => {
    const requestId = ++requestIdRef.current
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)

    try {
      const result = await getShelbyBlobsPage({ account: accountFilter, offset: pageOffset, limit: PAGE_SIZE })
      if (requestId !== requestIdRef.current) return

      const nowMicros = Date.now() * 1000
      const readable = result.items.filter(blob => (
        blob.isWritten && !blob.isDeleted && blob.expirationMicros > nowMicros
      ))

      setBlobs(previous => {
        if (!append) return readable
        const existing = new Set(previous.map(blobKey))
        return [...previous, ...readable.filter(blob => !existing.has(blobKey(blob)))]
      })
      setOffset(pageOffset + result.limit)
      setHasMore(result.hasMore)

      const initialAccess: Record<string, boolean> = {}
      readable.forEach(blob => {
        const owner = getOwnerStr(blob.owner)
        const suffix = blob.blobNameSuffix || blob.name || ''
        initialAccess[`${owner}_${suffix}`] = hasAccess(owner, suffix)
      })
      setUnlockedMap(previous => append ? { ...previous, ...initialAccess } : initialAccess)

      await Promise.all(readable
        .filter(blob => isPremiumBlob(blob.blobNameSuffix || blob.name || ''))
        .map(async blob => {
          const owner = getOwnerStr(blob.owner)
          const suffix = blob.blobNameSuffix || blob.name || ''
          if (await verifyAccess(owner, suffix)) {
            setUnlockedMap(previous => ({ ...previous, [`${owner}_${suffix}`]: true }))
          }
        }))
    } catch (requestError: unknown) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(requestError, 'Failed to load works from Shelby.'))
      reportClientError('explore.fetch', requestError, {
        source: 'shelby-indexer',
        network: 'shelbynet',
        offset: pageOffset,
        limit: PAGE_SIZE,
        retryable: true,
      })
    } finally {
      if (requestId === requestIdRef.current) {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }, [hasAccess, verifyAccess])

  useEffect(() => {
    void loadPage(0, false)
  }, [loadPage])

  const filtered = blobs.filter(blob => {
    const suffix = blob.blobNameSuffix || blob.name || ''
    const name = getDisplayName(suffix).toLowerCase()
    const owner = getOwnerStr(blob.owner).toLowerCase()
    const query = search.trim().toLowerCase()
    const matchSearch = ownerFilter
      ? true
      : !query || name.includes(query) || owner.includes(query)
    const matchCat = catFilter === 'all' || getCategory(suffix) === catFilter
    return matchSearch && matchCat
  })

  const counts: Record<FileCategory, number> = { all: blobs.length, writing: 0, music: 0, photo: 0, video: 0, other: 0 }
  blobs.forEach(blob => { counts[getCategory(blob.blobNameSuffix || blob.name || '')] += 1 })

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
    } catch (downloadError: unknown) {
      reportClientError('explore.download', downloadError, { source: 'shelby-rpc', network: 'shelbynet', retryable: true })
      toast.error(getErrorMessage(downloadError, 'Download failed.'))
    }
  }

  const handleBuySuccess = (ownerAddr: string, suffix: string) => {
    setUnlockedMap(previous => ({ ...previous, [`${ownerAddr}_${suffix}`]: true }))
    setBuyTarget(null)
  }

  const handleSearchChange = (value: string) => {
    const trimmed = value.trim()
    const address = looksLikeAptosAddress(trimmed) ? trimmed : undefined
    const switchingAwayFromOwnerSearch = Boolean(ownerFilter && !address)

    setSearch(value)
    setOwnerFilter(address)

    // Exact creator-address searches use Shelby's server-side owner filter,
    // so a creator's works can be found regardless of their global page.
    // Reload when clearing or leaving an address search to restore the list.
    if (!trimmed || address || switchingAwayFromOwnerSearch) {
      void loadPage(0, false, address)
    }
  }

  const retry = () => { void loadPage(0, false, ownerFilter) }

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', maxWidth: 1140, margin: '0 auto' }}>
      {buyTarget && (
        <BuyModal
          blob={buyTarget.blob}
          ownerAddr={buyTarget.ownerAddr}
          onClose={() => setBuyTarget(null)}
          onSuccess={() => handleBuySuccess(buyTarget.ownerAddr, buyTarget.blob.blobNameSuffix || buyTarget.blob.name || '')}
        />
      )}

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
          <Globe size={12} color="#c9a84c" />
          <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#c9a84c', textTransform: 'uppercase' }}>Shelbynet</span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Explore Works</h1>
        <p style={{ color: '#666', fontSize: 15 }}>Browse readable content on the Shelby developer network. Metadata is loaded in pages so the explorer stays responsive as the network grows.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
          <Search size={15} color="#666" aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            aria-label="Search works by name or creator address"
            type="search"
            placeholder="Search by name or address..."
            value={search}
            onChange={event => handleSearchChange(event.target.value)}
            className="input-field"
            style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10, fontSize: 14 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }} role="group" aria-label="Filter works by category">
          {(Object.keys(CAT_LABELS) as FileCategory[]).map(category => (
            <button
              type="button"
              key={category}
              aria-pressed={catFilter === category}
              onClick={() => setCatFilter(category)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                fontFamily: 'Syne, sans-serif', fontWeight: 600,
                border: catFilter === category ? '1px solid #c9a84c' : '1px solid rgba(255,255,255,0.1)',
                background: catFilter === category ? 'rgba(201,168,76,0.1)' : 'transparent',
                color: catFilter === category ? '#c9a84c' : '#666', transition: 'all 0.2s',
              }}
            >
              {CAT_LABELS[category]}<span style={{ marginLeft: 5, opacity: 0.55, fontSize: 10 }}>{counts[category]}</span>
            </button>
          ))}
        </div>
      </div>

      {!loading && !error && (
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#666', fontSize: 13 }}>
            <span style={{ color: '#c9a84c', fontWeight: 600 }}>{filtered.length}</span> loaded result{filtered.length === 1 ? '' : 's'}
            {hasMore && <span style={{ color: '#555' }}> · more available</span>}
          </span>
          <span style={{ color: '#555', fontSize: 12 }}>Shelby metadata page {Math.max(1, Math.ceil(offset / PAGE_SIZE))}</span>
        </div>
      )}

      {loading && (
        <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
          <Loader size={32} color="#c9a84c" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#666', fontSize: 14 }}>Fetching the next Shelby metadata page...</p>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '16px 20px', color: '#f87171' }}>
          <AlertCircle size={18} aria-hidden="true" />
          <span style={{ fontSize: 14, flex: 1, minWidth: 220 }}>{error}</span>
          <button type="button" onClick={retry} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 7, border: '1px solid rgba(248,113,113,0.35)', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 12 }}>
            <RefreshCw size={13} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
          <Globe size={40} aria-hidden="true" style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>{search ? `No loaded results for "${search}"` : 'No readable works found.'}</p>
          {hasMore && <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Load more to search the next Shelby page.</p>}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filtered.map(blob => {
            const ownerAddr = getOwnerStr(blob.owner)
            const suffix = blob.blobNameSuffix || blob.name || ''
            const isOwner = !!myAddr && myAddr.toLowerCase() === ownerAddr.toLowerCase()
            const unlocked = unlockedMap[`${ownerAddr}_${suffix}`] ?? !isPremiumBlob(suffix)
            return (
              <BlobCard
                key={blobKey(blob)}
                blob={blob}
                ownerAddr={ownerAddr}
                isOwner={isOwner}
                unlocked={unlocked}
                onBuy={() => setBuyTarget({ blob, ownerAddr })}
                onDownload={() => handleDownload(blob, ownerAddr)}
              />
            )
          })}
        </div>
      )}

      {!loading && !error && hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 24 }}>
          <button
            type="button"
            onClick={() => void loadPage(offset, true, ownerFilter)}
            disabled={loadingMore}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.08)', color: '#c9a84c', cursor: loadingMore ? 'wait' : 'pointer', opacity: loadingMore ? 0.65 : 1, fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13 }}
          >
            {loadingMore ? <Loader size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} aria-hidden="true" />}
            {loadingMore ? 'Loading more works...' : 'Load more works'}
          </button>
        </div>
      )}
    </div>
  )
}
