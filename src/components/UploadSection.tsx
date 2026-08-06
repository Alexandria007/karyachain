import { useState, useRef } from 'react'
import { Upload, FileText, Music, Image, Video, CheckCircle, Loader, AlertCircle, Lock, Copy, Check } from 'lucide-react'
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
import { createProofPath } from '../lib/proof'
import { getErrorMessage, reportClientError } from '../lib/diagnostics'

type UploadStatus = 'idle' | 'encoding' | 'registering' | 'uploading' | 'finalizing' | 'verifying' | 'success' | 'error'
type UploadReceipt = {
  blobName: string
  category: WorkCategory
  priceMicro: string
  merkleRoot: string
  size: number
  expirationMicros: number
  registrationTxHash: string
  commitTxHash: string
}

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024

const CATEGORY_EXTENSIONS: Record<WorkCategory, string[]> = {
  writing: ['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'odt', 'json'],
  music: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
  photo: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'],
  other: [],
}

const fileExtension = (fileName: string): string => fileName.split('.').pop()?.toLowerCase() || ''

const validateFileBasics = (selectedFile: File): string | null => {
  if (selectedFile.size <= 0) return 'This file is empty. Choose a file with content before uploading.'
  if (selectedFile.size > MAX_UPLOAD_SIZE_BYTES) return 'This file is larger than the 50 MB browser upload limit for the Shelby MVP.'
  return null
}

const validateSelectedFile = (selectedFile: File, selectedCategory: WorkCategory, selectedName: string): string | null => {
  const basicError = validateFileBasics(selectedFile)
  if (basicError) return basicError
  if (!selectedName.trim()) return 'Enter a file name before uploading.'
  if (selectedCategory === 'other') return null

  const extension = fileExtension(selectedFile.name)
  const allowedExtensions = CATEGORY_EXTENSIONS[selectedCategory]
  const mimeMatchesCategory =
    (selectedCategory === 'photo' && selectedFile.type.startsWith('image/')) ||
    (selectedCategory === 'music' && selectedFile.type.startsWith('audio/')) ||
    (selectedCategory === 'video' && selectedFile.type.startsWith('video/')) ||
    (selectedCategory === 'writing' && (selectedFile.type.startsWith('text/') || selectedFile.type === 'application/pdf'))

  if (!allowedExtensions.includes(extension) && !mimeMatchesCategory) {
    return `The selected file does not match the ${selectedCategory} category. Choose a supported file or switch the category to Other.`
  }
  return null
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
  const [registrationTxHash, setRegistrationTxHash] = useState<string | null>(null)
  const [commitTxHash, setCommitTxHash] = useState<string | null>(null)
  const [failedRegistrationTxHash, setFailedRegistrationTxHash] = useState<string | null>(null)
  const [failedCommitTxHash, setFailedCommitTxHash] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [proofCopied, setProofCopied] = useState(false)
  const [receipt, setReceipt] = useState<UploadReceipt | null>(null)

  // Premium
  const [isPremium, setIsPremium] = useState(false)
  const [premiumPrice, setPremiumPrice] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadInFlightRef = useRef(false)

  const handleFile = (f: File) => {
    setFile(f)
    setBlobName(f.name)
    setStatus('idle')
    setStatusMsg('')
    setRegistrationTxHash(null)
    setCommitTxHash(null)
    setFailedRegistrationTxHash(null)
    setFailedCommitTxHash(null)
    setProgress(0)
    setProofCopied(false)
    setReceipt(null)

    const basicError = validateFileBasics(f)
    if (basicError) {
      setStatus('error')
      setStatusMsg(basicError)
    }
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleUpload = async () => {
    if (!file || !connected || !account || uploadInFlightRef.current) return

    const validationError = validateSelectedFile(file, category, blobName || file.name)
    if (validationError) {
      setStatus('error')
      setStatusMsg(validationError)
      return
    }

    uploadInFlightRef.current = true
    let registrationHash: string | null = null
    let finalCommitHash: string | null = null

    try {
      const priceMicro = isPremium ? priceToMicroUnits(premiumPrice) : '0'
      const finalBlobName = encodeWorkBlobName({
        category,
        fileName: blobName || file.name,
        priceMicro,
      })

      // Step 1: encode the bytes and calculate the Shelby commitments.
      setStatus('encoding')
      setProgress(5)
      setStatusMsg('Encoding file with erasure coding...')
      const data = new Uint8Array(await file.arrayBuffer())
      const provider = await createDefaultErasureCodingProvider()
      const commitments = await generateCommitments(provider, data)
      setProgress(22)

      const erasureConfig = defaultErasureCodingConfig()
      const accountAddress = AccountAddress.fromString(account.address.toString())
      const expirationMicros = Date.now() * 1000 + 30 * 24 * 60 * 60 * 1000 * 1000

      const existingBlob = await findIndexedBlob(accountAddress, finalBlobName, 1)
      if (existingBlob && !existingBlob.isDeleted) {
        throw new Error(`A blob named ${finalBlobName} already exists. Choose another file name.`)
      }

      // Step 2: register the object on Aptos shelbynet.
      setStatus('registering')
      setProgress(30)
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

      const txResponse = await signAndSubmitTransaction({ data: payload })
      registrationHash = txResponse.hash
      setRegistrationTxHash(registrationHash)
      setProgress(42)

      const registrationTx = await aptosClient.waitForTransaction({
        transactionHash: registrationHash,
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

      // Step 3: transfer encoded bytes to Shelby storage providers.
      setStatus('uploading')
      setProgress(52)
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
      setProgress(76)

      // Step 4: commit the storage acknowledgements on Aptos.
      setStatus('finalizing')
      setProgress(82)
      setStatusMsg('Finalizing the cryptographic receipt on Aptos...')
      const commitPayload = ShelbyBlobClient.createCommitObjectPayload({
        deployer: shelbyClient.coordination.deployer,
        uid: registeredBlob.uid,
        blobName: finalBlobName,
        overwrite: false,
        storageProviderAcks: spAcks,
      })
      const commitTxResponse = await signAndSubmitTransaction({ data: commitPayload })
      finalCommitHash = commitTxResponse.hash
      setCommitTxHash(finalCommitHash)
      setProgress(87)

      const commitTx = await aptosClient.waitForTransaction({
        transactionHash: finalCommitHash,
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

      // Step 5: resolve metadata and read the committed bytes back from Shelby.
      setStatus('verifying')
      setProgress(91)
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
          setProgress(Math.min(98, 92 + Math.round((downloadedSize / data.byteLength) * 6)))
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
        registrationTxHash: registrationHash,
        commitTxHash: finalCommitHash,
      })
      setProgress(100)
      setStatus('success')
      setStatusMsg('Registered on Aptos shelbynet, uploaded to Shelby, and verified against Shelby metadata/RPC. Current expiration: 30 days.')
      setFile(null)
      setBlobName('')
      setIsPremium(false)
      setPremiumPrice('')
    } catch (err: unknown) {
      reportClientError('upload', err, { source: 'shelby-upload', network: 'shelbynet', hasRegistrationTx: !!registrationHash, hasCommitTx: !!finalCommitHash, retryable: true })
      setFailedRegistrationTxHash(registrationHash)
      setFailedCommitTxHash(finalCommitHash)
      let message = getErrorMessage(err, 'Upload failed. Please try again.')
      if (registrationHash && !finalCommitHash) {
        message += ` Registration succeeded (${registrationHash.slice(0, 10)}...), but the storage upload/final commit did not complete. Check the receipt before retrying.`
      } else if (finalCommitHash) {
        message += ` The final commit transaction was submitted (${finalCommitHash.slice(0, 10)}...). Verify it before retrying.`
      }
      setStatus('error')
      setStatusMsg(message)
    } finally {
      uploadInFlightRef.current = false
    }
  }
  const isBusy = ['encoding', 'registering', 'uploading', 'finalizing', 'verifying'].includes(status)
  const proofPath = receipt && account ? createProofPath({
    owner: account.address.toString(),
    blobName: receipt.blobName,
    registrationTxHash: receipt.registrationTxHash,
    commitTxHash: receipt.commitTxHash,
  }) : ''
  const proofUrl = proofPath ? `${window.location.origin}${proofPath}` : ''

  const copyProofLink = async () => {
    if (!proofUrl) return
    try {
      await navigator.clipboard.writeText(proofUrl)
      setProofCopied(true)
      window.setTimeout(() => setProofCopied(false), 1800)
    } catch {
      setStatusMsg('Proof link is ready, but clipboard access was blocked. Copy it from the address bar instead.')
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
          {registrationTxHash && (
            <p style={{ color: '#888', fontSize: 12, marginBottom: 10, wordBreak: 'break-all' }}>
              Registration transaction:{' '}
              <a
                href={`https://explorer.aptoslabs.com/txn/${registrationTxHash}?network=shelbynet`}
                target={'_blank'}
                rel={'noreferrer'}
                style={{ color: '#c9a84c' }}
              >
                {registrationTxHash}
              </a>
            </p>
          )}
          {commitTxHash && (
            <p style={{ color: '#888', fontSize: 12, marginBottom: 16, wordBreak: 'break-all' }}>
              Final commit transaction:{' '}
              <a
                href={`https://explorer.aptoslabs.com/txn/${commitTxHash}?network=shelbynet`}
                target={'_blank'}
                rel={'noreferrer'}
                style={{ color: '#c9a84c' }}
              >
                {commitTxHash}
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <a href={proofPath} target="_blank" rel="noreferrer" className="btn-outline" style={{ padding: '7px 11px', borderRadius: 7, color: '#c9a84c', textDecoration: 'none', fontSize: 12 }}>
                  Open public proof →
                </a>
                <button type="button" onClick={copyProofLink} className="btn-outline" style={{ padding: '7px 11px', borderRadius: 7, color: '#c9a84c', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  {proofCopied ? <Check size={13} /> : <Copy size={13} />}
                  {proofCopied ? 'Copied' : 'Copy proof link'}
                </button>
              </div>
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
        role="region"
        aria-label={file ? 'Selected file' : 'File drop zone'}
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
        <input ref={fileInputRef} type="file" accept="image/*,audio/*,video/*,text/*,.pdf,.doc,.docx,.rtf,.odt,.json" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {file ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: '#c9a84c' }}>
              {fileTypeIcon(file)}
            </div>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{file.name}</p>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>{formatSize(file.size)}</p>
            <button
              onClick={e => { e.stopPropagation(); setFile(null); setBlobName(''); setStatus('idle'); setStatusMsg(''); setProgress(0) }}
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
            <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Music, photos, writing, video - common formats - max 50 MB</p>
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
            <label htmlFor="blob-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#aaa', fontFamily: 'Syne, sans-serif' }}>
              File Name
            </label>
              <input id="blob-name"
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
            <div role="group" aria-label="Work category" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WORK_CATEGORIES.map(cat => (
                <button type="button" key={cat} aria-pressed={category === cat} onClick={() => setCategory(cat)} style={{
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
              <button
                type="button"
                role="switch"
                aria-checked={isPremium}
                aria-label="Mark this work as premium content"
                onClick={() => setIsPremium(p => !p)}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative',
                  background: isPremium ? '#c9a84c' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <span aria-hidden="true" style={{
                  position: 'absolute', top: 3, left: isPremium ? 23 : 3, width: 18, height: 18,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {isPremium && (
              <div>
                <label htmlFor="premium-price" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#888', fontFamily: 'Syne, sans-serif' }}>
                  Price (SUSD)
                </label>
                <div style={{ position: 'relative', maxWidth: 200 }}>
                  <input id="premium-price"
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
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#f87171',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{statusMsg}</span>
              </div>
              {(failedRegistrationTxHash || failedCommitTxHash) && (
                <div style={{ color: '#c98b8b', fontSize: 11, lineHeight: 1.5, margin: '10px 0 0 26px' }}>
                  <p style={{ marginBottom: 7 }}>A transaction was already submitted. Verify it before starting another upload.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {failedRegistrationTxHash && <a href={`https://explorer.aptoslabs.com/txn/${failedRegistrationTxHash}?network=shelbynet`} target="_blank" rel="noreferrer" style={{ color: '#c9a84c' }}>Registration receipt</a>}
                    {failedCommitTxHash && <a href={`https://explorer.aptoslabs.com/txn/${failedCommitTxHash}?network=shelbynet`} target="_blank" rel="noreferrer" style={{ color: '#c9a84c' }}>Final commit receipt</a>}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Progress */}
          {isBusy && (
            <div style={{
              background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Loader size={16} color="#c9a84c" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#c9a84c', flex: 1 }}>{statusMsg}</span>
                <span style={{ color: '#c9a84c', fontSize: 12, fontWeight: 700 }}>{progress}%</span>
              </div>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Upload progress" style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden', marginTop: 10 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: '#c9a84c', borderRadius: 5, transition: 'width 0.3s ease' }} />
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={isBusy || (isPremium && !premiumPrice)}
            className="btn-gold"
            style={{
              width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, border: 'none',
              cursor: isBusy || (isPremium && !premiumPrice) ? 'not-allowed' : 'pointer',
              opacity: isBusy || (isPremium && !premiumPrice) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isBusy ? (
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
