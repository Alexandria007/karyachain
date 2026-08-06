import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { AccountAddress } from '@aptos-labs/ts-sdk'
import type { FullObjectMetadata } from '@shelby-protocol/sdk/browser'
import { getShelbyBlobs } from '../lib/shelby'
import { createProofPath } from '../lib/proof'
import { formatSUSDPrice, getWorkCategoryLabel, parseWorkMetadata } from '../lib/karyaMetadata'

const bytesToHex = (bytes: Uint8Array): string =>
  '0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const formatMicros = (micros: number): string => {
  if (!micros) return 'Unavailable'
  return new Date(micros / 1000).toLocaleString()
}

const shortHash = (hash: string): string =>
  hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash

const explorerTransactionUrl = (hash: string): string =>
  `https://explorer.aptoslabs.com/txn/${hash}?network=shelbynet`

export default function ProofPage() {
  const query = new URLSearchParams(window.location.search)
  const initialOwner = query.get('owner') || ''
  const initialBlob = query.get('blob') || ''
  const initialRegistrationTx = query.get('registrationTx') || ''
  const initialCommitTx = query.get('commitTx') || ''

  const [owner, setOwner] = useState(initialOwner)
  const [blobName, setBlobName] = useState(initialBlob)
  const [registrationTxHash, setRegistrationTxHash] = useState(initialRegistrationTx)
  const [commitTxHash, setCommitTxHash] = useState(initialCommitTx)
  const [metadata, setMetadata] = useState<FullObjectMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function resolveProof(ownerInput: string, blobInput: string, updateUrl = true) {
    const rawOwner = ownerInput.trim()
    const requestedBlob = blobInput.trim()

    if (!rawOwner || !requestedBlob) {
      setError('Enter the creator wallet address and the exact Shelby blob name.')
      setMetadata(null)
      return
    }

    let normalizedOwner: string
    try {
      normalizedOwner = AccountAddress.fromString(rawOwner).toString()
    } catch {
      setError('The owner value is not a valid Aptos address.')
      setMetadata(null)
      return
    }

    setLoading(true)
    setError('')
    setMetadata(null)
    try {
      const blobs = await getShelbyBlobs(normalizedOwner)
      const match = blobs.find(blob =>
        blob.blobNameSuffix === requestedBlob || blob.name === requestedBlob,
      )

      if (!match) {
        throw new Error('No Shelby metadata was found for this owner and blob name.')
      }
      if (match.isDeleted) {
        throw new Error('This proof points to a blob that has been deleted on Shelby.')
      }
      if (!match.isWritten) {
        throw new Error('Shelby has not marked this blob as readable yet. Try again shortly.')
      }
      if (match.expirationMicros <= Date.now() * 1000) {
        throw new Error('This Shelby developer-network blob has expired.')
      }

      setOwner(normalizedOwner)
      setBlobName(match.blobNameSuffix)
      setMetadata(match)
      if (updateUrl) {
        window.history.replaceState(
          null,
          '',
          createProofPath({
            owner: normalizedOwner,
            blobName: match.blobNameSuffix,
            registrationTxHash: registrationTxHash || undefined,
            commitTxHash: commitTxHash || undefined,
          }),
        )
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to resolve this proof from Shelby.')
    } finally {
      setLoading(false)
    }
  }

  // The initial query is intentionally resolved once when a public proof link opens.
  useEffect(() => {
    if (initialOwner && initialBlob) {
      void resolveProof(initialOwner, initialBlob, false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const proofPath = metadata
    ? createProofPath({
        owner: metadata.owner.toString(),
        blobName: metadata.blobNameSuffix,
        registrationTxHash: registrationTxHash || undefined,
        commitTxHash: commitTxHash || undefined,
      })
    : ''

  const proofUrl = proofPath ? `${window.location.origin}${proofPath}` : ''
  const work = metadata ? parseWorkMetadata(metadata.blobNameSuffix) : null

  const copyProofLink = async () => {
    if (!proofUrl) return
    try {
      await navigator.clipboard.writeText(proofUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('The proof is ready, but the browser blocked clipboard access. Copy the URL from the address bar.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 30 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 20, padding: '4px 14px', marginBottom: 16,
        }}>
          <ShieldCheck size={13} color="#c9a84c" />
          <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#c9a84c', textTransform: 'uppercase' }}>
            Proof &amp; Verify
          </span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Verify a Creator&apos;s Work
        </h1>
        <p style={{ color: '#777', fontSize: 15, lineHeight: 1.6 }}>
          Resolve a public KaryaChain proof link against live Shelby metadata and confirm the creator wallet, commitment, size, and storage status.
        </p>
      </div>

      <form
        onSubmit={event => {
          event.preventDefault()
          void resolveProof(owner, blobName)
        }}
        style={{
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 14, padding: 18, marginBottom: 22,
        }}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 7, color: '#aaa', fontSize: 12, fontWeight: 600 }}>
            Creator wallet address
            <input
              value={owner}
              onChange={event => { setOwner(event.target.value); setRegistrationTxHash(''); setCommitTxHash('') }}
              placeholder="0x..."
              className="input-field"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13 }}
              spellCheck={false}
            />
          </label>
          <label style={{ display: 'grid', gap: 7, color: '#aaa', fontSize: 12, fontWeight: 600 }}>
            Shelby blob name or suffix
            <input
              value={blobName}
              onChange={event => { setBlobName(event.target.value); setRegistrationTxHash(''); setCommitTxHash('') }}
              placeholder="KARYA:v1:photo:free:0:..."
              className="input-field"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13 }}
              spellCheck={false}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="btn-gold"
            style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none', fontSize: 14,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
            {loading ? 'Resolving from Shelby...' : 'Verify proof'}
          </button>
        </div>
      </form>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 22, color: '#f87171',
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      {metadata && work && (
        <div style={{
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 14, padding: 22,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={30} color="#22c55e" />
              <div>
                <p style={{ color: '#22c55e', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  Shelby metadata verified
                </p>
                <p style={{ color: '#7fae8b', fontSize: 12 }}>Readable, committed, not deleted, and not expired.</p>
              </div>
            </div>
            <span style={{ color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '4px 9px', fontSize: 11, whiteSpace: 'nowrap' }}>
              {getWorkCategoryLabel(work.category)}
            </span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, fontSize: 12 }}>
            <ProofRow label="Creator wallet" value={metadata.owner.toString()} mono />
            <ProofRow label="Work" value={work.fileName} />
            <ProofRow label="Access label" value={work.premium ? `Premium · ${formatSUSDPrice(work.priceMicro)} SUSD` : 'Free'} />
            <ProofRow label="Size" value={formatBytes(metadata.size)} />
            <ProofRow label="Created" value={formatMicros(metadata.creationMicros)} />
            <ProofRow label="Expires" value={formatMicros(metadata.expirationMicros)} />
            <ProofRow label="Merkle root" value={bytesToHex(metadata.blobMerkleRoot)} mono last />
          </div>

          <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, fontSize: 12 }}>
            <p style={{ color: '#aaa', fontWeight: 600, marginBottom: 10 }}>Aptos receipt links</p>
            {registrationTxHash ? (
              <ReceiptLink label="Registration transaction" hash={registrationTxHash} />
            ) : (
              <p style={{ color: '#666', marginBottom: 8 }}>Registration transaction was not included in this link.</p>
            )}
            {commitTxHash ? (
              <ReceiptLink label="Final commit transaction" hash={commitTxHash} />
            ) : (
              <p style={{ color: '#666' }}>Final commit transaction was not included in this link.</p>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 18 }}>
            <button
              type="button"
              onClick={copyProofLink}
              className="btn-outline"
              style={{ padding: '9px 14px', borderRadius: 8, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}
            >
              {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              {copied ? 'Copied proof link' : 'Copy proof link'}
            </button>
            <a
              href="https://explorer.shelby.xyz/shelbynet"
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
              style={{ padding: '9px 14px', borderRadius: 8, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 7, color: '#c9a84c', textDecoration: 'none' }}
            >
              <ExternalLink size={14} /> Shelby Explorer
            </a>
          </div>

          <p style={{ color: '#666', fontSize: 11, lineHeight: 1.55, marginTop: 18 }}>
            This proof confirms the wallet-controlled Shelby storage metadata and cryptographic commitment visible to this MVP. It is not a legal copyright registration. Shelby developer-network data is temporary, and premium read access is not enforced on the raw storage path yet.
          </p>
        </div>
      )}

      <p style={{ color: '#555', fontSize: 11, lineHeight: 1.5, marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link2 size={13} /> Proof links contain only public wallet, blob, and optional public transaction identifiers.
      </p>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ProofRow({ label, value, mono = false, last = false }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, padding: '8px 0', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: '#777' }}>{label}</span>
      <span style={{ color: '#ddd', wordBreak: 'break-word', fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 11 : undefined }}>{value}</span>
    </div>
  )
}

function ReceiptLink({ label, hash }: { label: string; hash: string }) {
  return (
    <p style={{ color: '#777', marginBottom: 8, wordBreak: 'break-all' }}>
      {label}:{' '}
      <a href={explorerTransactionUrl(hash)} target="_blank" rel="noreferrer" style={{ color: '#c9a84c' }}>
        {shortHash(hash)}
      </a>
    </p>
  )
}
