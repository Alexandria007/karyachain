import { useState, useRef } from 'react'
import { Upload, FileText, Music, Image, Video, CheckCircle, Loader, AlertCircle, Lock } from 'lucide-react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import {
  ShelbyBlobClient,
  createBlobKey,
  createDefaultErasureCodingProvider,
  defaultErasureCodingConfig,
  generateCommitments,
  expectedTotalChunksets,
  type FullObjectMetadata,
} from '@shelby-protocol/sdk/browser'
import { AccountAddress } from '@aptos-labs/ts-sdk'
import { aptosClient, createShelbyRegisterBlobPayload, getShelbyBlobs, SHELBY_LOCATION, shelbyClient } from '../lib/shelby'
import { encodeWorkBlobName, formatSUSDPrice, priceToMicroUnits, WORK_CATEGORIES, type WorkCategory } from '../lib/karyaMetadata'

type UploadStatus = 'idle' | 'encoding' | 'registering' | 'uploading' | 'verifying' | 'success' | 'error'
type UploadReceipt = {
  blobName: string
  category: WorkCategory
  priceMicro: string
  merkleRoot: string
  size: number
  expirationMicros: number
  txHash: string
}

const fileTypeIcon = (file: File) => {
  const t = file.type
  if (t.startsWith('image/')) return <Image size={24} />
  if (t.startsWith('audio/')) return <Music size={24} />
  if (t.startsWith('video/')) return <Video size={24} />
  return <FileText size={24} />
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const bytesToHex = (bytes: Uint8Array): string =>
  '0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

const normalizeHex = (value: string): string => value.replace(/^0x/i, '').toLowerCase()

const findIndexedBlob = async (
  account: AccountAddress,
  blobName: string,
  attempts = 6,
): Promise<FullObjectMetadata | undefined> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const blobs = await getShelbyBlobs(account.toString())
    const match = blobs.find(blob => blob.blobNameSuffix === blobName)
    if (match) return match

    if (attempt < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }

  return undefined
}

export default function UploadSection() {
  const { account, connected, signAndSubmitTransaction } = useWallet()
  const [file, setFile] = useState<File | null>(null)
  const [blobName, setBlobName] = useState('')
  const [category, setCategory] = useState<WorkCategory>('writing')
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<UploadReceipt | null>(null)

  // Premium
  const [isPremium, setIsPremium] = useState(false)
  const [premiumPrice, setPremiumPrice] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setBlobName(f.name)
    setStatus('idle')
    setStatusMsg('')
    setTxHash(null)
    setReceipt(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleUpload = async () => {
    if (!file || !connected || !account) return

    try {
      const priceMicro = isPremium ? priceToMicroUnits(premiumPrice) : '0'
      const finalBlobName = encodeWorkBlobName({
        category,
        fileName: blobName || file.name,
        priceMicro,
      })
      // ── Step 1: Encode ──────────────────────────────────────────────────────
      setStatus('encoding')
      setStatusMsg('Encoding file with erasure coding...')

      const data = new Uint8Array(await file.arrayBuffer())
      const provider = await createDefaultErasureCodingProvider()
      const commitments = await generateCommitments(provider, data)
      const erasureConfig = defaultErasureCodingConfig()
      const accountAddress = AccountAddress.fromString(account.address.toString())
      const expirationMicros = Date.now() * 1000 + 30 * 24 * 60 * 60 * 1000 * 1000

      const existingBlob = await findIndexedBlob(accountAddress, finalBlobName, 1)
      if (existingBlob && !existingBlob.isDeleted) {
        throw new Error(`A blob named ${finalBlobName} already exists. Choose another file name.`)
      }

      // ── Step 2: Register on-chain ───────────────────────────────────────────
      setStatus('registering')
      setStatusMsg('Registering on Aptos blockchain...')

      const payload = createShelbyRegisterBlobPayload({
        account: accountAddress,
        blobName: finalBlobName,
        selectedLocation: SHELBY_LOCATION,
        locationHint: SHELBY_LOCATION,
        blobMerkleRoot: commitments.blob_merkle_root,
        numChunksets: expectedTotalChunksets(
          commitments.raw_data_size,
          erasureConfig.chunkSizeBytes * erasureConfig.erasure_k,
        ),
        expirationMicros,
        blobSize: commitments.raw_data_size,
        encoding: erasureConfig.enumIndex,
      })

      const txResponse = await signAndSubmitTransaction({
        data: payload,
      })
      setTxHash(txResponse.hash)

      const registrationTx = await aptosClient.waitForTransaction({
        transactionHash: txResponse.hash,
        options: { timeoutSecs: 30, checkSuccess: true },
      })

      const registeredBlob = ShelbyBlobClient.registeredBlobUids(
        'events' in registrationTx ? registrationTx.events : [],
        shelbyClient.coordination.deployer,
      ).find(({ objectName }) => objectName === createBlobKey({
        account: accountAddress,
        blobName: finalBlobName,
      }))
      if (!registeredBlob) {
        throw new Error('Shelby registration succeeded, but no BlobRegisteredEvent UID was returned.')
      }

      // ── Step 3: Upload to RPC ───────────────────────────────────────────────
      setStatus('uploading')
      setStatusMsg('Uploading to Shelby storage network...')

      const { spAcks } = await shelbyClient.rpc.putBlobChunksets({
        accountAddress: account.address,
        uid: registeredBlob.uid,
        blobData: data,
        commitments,
        totalBytes: data.byteLength,
      })
      const requiredAcks = erasureConfig.erasure_d
      if (spAcks.length < requiredAcks) {
        throw new Error('Shelby returned ' + spAcks.length + ' storage acknowledgements; ' + requiredAcks + ' are required to finalize this blob.')
      }

      setStatus('registering')
      setStatusMsg('Finalizing the cryptographic receipt on Aptos...')

      const commitPayload = ShelbyBlobClient.createCommitObjectPayload({
        deployer: shelbyClient.coordination.deployer,
        uid: registeredBlob.uid,
        blobName: finalBlobName,
        overwrite: false,
        storageProviderAcks: spAcks,
      })
      const commitTxResponse = await signAndSubmitTransaction({
        data: commitPayload,
      })
      setTxHash(commitTxResponse.hash)

      const commitTx = await aptosClient.waitForTransaction({
        transactionHash: commitTxResponse.hash,
        options: { timeoutSecs: 30, checkSuccess: true },
      })
      const commitRejection = ShelbyBlobClient.findObjectCommitRejection(
        'events' in commitTx ? commitTx.events : [],
        shelbyClient.coordination.deployer,
        registeredBlob.uid,
      )
      if (commitRejection) {
        throw new Error('Shelby rejected the final commit: ' + commitRejection + '.')
      }

      setStatus('verifying')
      setStatusMsg('Verifying Shelby metadata and downloadable bytes...')

      const storedMetadata = await findIndexedBlob(accountAddress, finalBlobName)
      if (!storedMetadata || storedMetadata.isDeleted) {
        throw new Error('Shelby stored the upload, but the indexer did not expose metadata after 9 seconds. Check the explorer before retrying.')
      }
      if (storedMetadata.size !== data.byteLength) {
        throw new Error(
          'Shelby metadata size mismatch: expected ' + data.byteLength + ', received ' + storedMetadata.size + '.',
        )
      }
      if (storedMetadata.expirationMicros <= Date.now() * 1000) {
        throw new Error('Shelby returned an expired blob after upload.')
      }

      const storedBlob = await shelbyClient.rpc.getBlob({
        account: accountAddress,
        blobName: finalBlobName,
      })
      if (storedBlob.contentLength !== data.byteLength) {
        throw new Error(
          'Shelby RPC size mismatch: expected ' + data.byteLength + ', received ' + storedBlob.contentLength + '.',
        )
      }

      const reader = storedBlob.readable.getReader()
      let downloadedSize = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          downloadedSize += value.byteLength
        }
      } finally {
        reader.releaseLock()
      }
      if (downloadedSize !== data.byteLength) {
        throw new Error(
          'Shelby download size mismatch: expected ' + data.byteLength + ', received ' + downloadedSize + '.',
        )
      }

      const storedMerkleRoot = bytesToHex(storedMetadata.blobMerkleRoot)
      if (normalizeHex(storedMerkleRoot) !== normalizeHex(commitments.blob_merkle_root)) {
        throw new Error('Shelby metadata Merkle root does not match the upload commitment.')
      }

      setReceipt({
        blobName: storedMetadata.blobNameSuffix || finalBlobName,
        category,
        priceMicro,
        merkleRoot: storedMerkleRoot,
        size: storedMetadata.size,
        expirationMicros: storedMetadata.expirationMicros,
        txHash: txResponse.hash,
      })

      setStatus('success')
      setStatusMsg('Registered on Aptos shelbynet, uploaded to Shelby, and verified against Shelby metadata/RPC. Current expiration: 30 days.')
      setFile(null)
      setBlobName('')
      setIsPremium(false)
      setPremiumPrice('')

    } catch (err: unknown) {
      console.error('[Upload] error:', err)
      setStatus('error')
      setStatusMsg(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
  }

  if (!connected) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <Lock size={40} color="#c9a84c" style={{ marginBottom: 16, opacity: 0.6 }} />
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, marginBottom: 8 }}>Connect your wallet</h2>
          <p style={{ color: '#666', fontSize: 15 }}>You need to connect Petra wallet to upload content.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 20, padding: '4px 14px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#c9a84c', textTransform: 'uppercase' }}>
            Shelbynet
          </span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Upload Your Work</h1>
        <p style={{ color: '#666', fontSize: 15 }}>
          Your file will be stored on the Shelby developer network for 30 days, with a cryptographic commitment anchored on Aptos shelbynet.
        </p>
      </div>

      {/* Success */}
      {status === 'success' && (
        <div style={{
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 14, padding: 24, marginBottom: 28, textAlign: 'center',
        }}>
          <CheckCircle size={32} color="#22c55e" style={{ marginBottom: 12 }} />
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 6, color: '#22c55e' }}>
            Upload Successful!
          </p>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
            Your work is registered on Aptos shelbynet, stored on Shelby, and verified as readable. The category and price metadata are embedded in the blob name; this MVP uses a 30-day expiration.
          </p>
          {txHash && (
            <p style={{ color: '#888', fontSize: 12, marginBottom: 16, wordBreak: 'break-all' }}>
              Aptos receipt:{' '}
              <a
                href={`https://explorer.aptoslabs.com/txn/${txHash}?network=shelbynet`}
                target={'_blank'}
                rel={'noreferrer'}
                style={{ color: '#c9a84c' }}
              >
                {txHash}
              </a>
            </p>
          )}
          {receipt && (
            <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12 }}>
              <p style={{ color: '#aaa', marginBottom: 6 }}>Proof receipt</p>
              <p style={{ color: '#777', marginBottom: 4 }}>Blob: <span style={{ color: '#ddd', wordBreak: 'break-all' }}>{receipt.blobName}</span></p>
              <p style={{ color: '#777', marginBottom: 4 }}>Category: <span style={{ color: '#ddd', textTransform: 'capitalize' }}>{receipt.category}</span></p>
              <p style={{ color: '#777', marginBottom: 4 }}>Access: <span style={{ color: '#ddd' }}>{receipt.priceMicro === '0' ? 'Free' : `${formatSUSDPrice(receipt.priceMicro)} SUSD`}</span></p>
              <p style={{ color: '#777', marginBottom: 4 }}>Size: <span style={{ color: '#ddd' }}>{formatSize(receipt.size)}</span></p>
              <p style={{ color: '#777', marginBottom: 4 }}>Merkle root: <code style={{ color: '#c9a84c', wordBreak: 'break-all' }}>{receipt.merkleRoot}</code></p>
              <p style={{ color: '#777' }}>Expires: <span style={{ color: '#ddd' }}>{new Date(receipt.expirationMicros / 1000).toLocaleString()}</span></p>
            </div>
          )}
          <a
            href="https://explorer.shelby.xyz/shelbynet"
            target="_blank" rel="noreferrer"
            style={{
              display: 'inline-block', padding: '8px 20px', borderRadius: 8,
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
              color: '#c9a84c', fontSize: 13, fontWeight: 600, fontFamily: 'Syne, sans-serif', textDecoration: 'none',
            }}
          >
            View on Shelby Explorer →
          </a>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !file && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#c9a84c' : file ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 16, padding: 40, textAlign: 'center', cursor: file ? 'default' : 'pointer',
          background: isDragging ? 'rgba(201,168,76,0.05)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.2s', marginBottom: 24,
        }}
      >
        <input ref={fileInputRef} type="file" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {file ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: '#c9a84c' }}>
              {fileTypeIcon(file)}
            </div>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{file.name}</p>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>{formatSize(file.size)}</p>
            <button
              onClick={e => { e.stopPropagation(); setFile(null); setBlobName(''); setStatus('idle') }}
              style={{
                padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer',
              }}
            >Change file</button>
          </div>
        ) : (
          <div>
            <Upload size={32} color="#444" style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Drop your file here</p>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Music, photos, writing, video — any format</p>
            <button
              className="btn-outline"
              style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
            >Browse Files</button>
          </div>
        )}
      </div>

      {file && (
        <>
          {/* Blob name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#aaa', fontFamily: 'Syne, sans-serif' }}>
              File Name
            </label>
            <input
              type="text" value={blobName} onChange={e => setBlobName(e.target.value)}
              placeholder="Enter file name..." className="input-field"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14 }}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#aaa', fontFamily: 'Syne, sans-serif' }}>
              Category
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WORK_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  padding: '7px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif', fontWeight: 600, textTransform: 'capitalize',
                  border: category === cat ? '1px solid #c9a84c' : '1px solid rgba(255,255,255,0.1)',
                  background: category === cat ? 'rgba(201,168,76,0.1)' : 'transparent',
                  color: category === cat ? '#c9a84c' : '#888', transition: 'all 0.2s',
                }}>{cat}</button>
              ))}
            </div>
          </div>

          {/* Premium toggle */}
          <div style={{
            background: 'rgba(201,168,76,0.05)',
            border: `1px solid ${isPremium ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 12, padding: 18, marginBottom: 24, transition: 'border-color 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPremium ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={15} color={isPremium ? '#c9a84c' : '#666'} />
                <div>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: isPremium ? '#c9a84c' : '#aaa' }}>
                    Premium Content
                  </p>
                  <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Price is embedded in the Shelby blob metadata and checked against the Aptos payment receipt.</p>
                </div>
              </div>
              <div
                onClick={() => setIsPremium(p => !p)}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative',
                  background: isPremium ? '#c9a84c' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: isPremium ? 23 : 3, width: 18, height: 18,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>

            {isPremium && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#888', fontFamily: 'Syne, sans-serif' }}>
                  Price (SUSD)
                </label>
                <div style={{ position: 'relative', maxWidth: 200 }}>
                  <input
                    type="number" min="0.01" step="0.01" value={premiumPrice}
                    onChange={e => setPremiumPrice(e.target.value)} placeholder="e.g. 5"
                    className="input-field"
                    style={{ width: '100%', padding: '9px 50px 9px 14px', borderRadius: 8, fontSize: 14 }}
                  />
                  <span style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 12, color: '#c9a84c', fontWeight: 700, fontFamily: 'Syne, sans-serif',
                  }}>SUSD</span>
                </div>
                <p style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
                  The price is stored in the blob name as micro-ShelbyUSD and verified against the buyer's finalized Aptos transfer. The raw Shelby read path remains public in this MVP.
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {status === 'error' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#f87171',
            }}>
              <AlertCircle size={16} />
              <span style={{ fontSize: 13 }}>{statusMsg}</span>
            </div>
          )}

          {/* Progress */}
          {['encoding', 'registering', 'uploading', 'verifying'].includes(status) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            }}>
              <Loader size={16} color="#c9a84c" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#c9a84c' }}>{statusMsg}</span>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={['encoding', 'registering', 'uploading', 'verifying'].includes(status) || (isPremium && !premiumPrice)}
            className="btn-gold"
            style={{
              width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, border: 'none',
              cursor: ['encoding', 'registering', 'uploading', 'verifying'].includes(status) || (isPremium && !premiumPrice) ? 'not-allowed' : 'pointer',
              opacity: ['encoding', 'registering', 'uploading', 'verifying'].includes(status) || (isPremium && !premiumPrice) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {['encoding', 'registering', 'uploading', 'verifying'].includes(status) ? (
              <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
            ) : isPremium ? (
              <><Lock size={16} /> Upload with price label ({premiumPrice || '?'} SUSD)</>
            ) : (
              <><Upload size={16} /> Upload to Shelby</>
            )}
          </button>
        </>
      )}
    </div>
  )
}
