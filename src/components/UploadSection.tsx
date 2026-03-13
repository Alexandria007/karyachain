import { useState, useRef } from 'react'
import { Upload, FileText, Music, Image, Video, CheckCircle, Loader, AlertCircle } from 'lucide-react'

interface UploadSectionProps {
  walletAddress: string | null
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

const fileTypeIcons: Record<string, React.ElementType> = {
  'image': Image,
  'audio': Music,
  'video': Video,
  'text': FileText,
  'application': FileText,
}

const getFileIcon = (type: string) => {
  const category = type.split('/')[0]
  return fileTypeIcons[category] || FileText
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function UploadSection({ walletAddress }: UploadSectionProps) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [blobName, setBlobName] = useState('')
  const [category, setCategory] = useState('art')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [txHash, setTxHash] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setBlobName(f.name)
    setStatus('idle')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleUpload = async () => {
    if (!file || !walletAddress) return

    setStatus('uploading')

    // Simulate upload to Shelby (replace with actual SDK call when Early Access approved)
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Mock success
    const mockTx = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    setTxHash(mockTx)
    setStatus('success')
  }

  const reset = () => {
    setFile(null)
    setBlobName('')
    setStatus('idle')
    setTxHash('')
  }

  const FileIcon = file ? getFileIcon(file.type) : Upload

  return (
    <div className="pt-24 min-h-screen max-w-2xl mx-auto px-6 pb-32">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
          Upload Your <span style={{ color: 'var(--gold)' }}>Work</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>
          Your file will be stored on Shelby Protocol with cryptographic proof of ownership on Aptos.
        </p>
      </div>

      {!walletAddress && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
          <AlertCircle size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Connect your wallet first to upload.</p>
        </div>
      )}

      {status === 'success' ? (
        <div className="card rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(201,168,76,0.1)' }}>
            <CheckCircle size={32} style={{ color: 'var(--gold)' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Upload Successful!</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Your work is now stored on Shelby Protocol with proof of ownership on Aptos.
          </p>
          <div className="p-4 rounded-xl mb-6 text-left" style={{ background: 'var(--dark-3)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', letterSpacing: '0.05em' }}>TRANSACTION HASH</p>
            <p className="text-xs font-mono break-all" style={{ color: 'var(--gold)' }}>{txHash}</p>
          </div>
          <button onClick={reset} className="btn-gold px-8 py-3 rounded-xl text-sm">
            Upload Another
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Drop Zone */}
          <div
            className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${dragOver ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/10 hover:border-white/20'}`}
            style={file ? { borderColor: 'rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.03)' } : {}}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--gold-dim)' }}>
                  <FileIcon size={24} style={{ color: 'var(--gold)' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{file.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatSize(file.size)} · {file.type || 'unknown type'}</p>
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Click to change file</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--dark-3)' }}>
                  <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">Drop your file here</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Music, photo, writing, video — any format</p>
                </div>
              </div>
            )}
          </div>

          {/* Blob Name */}
          <div>
            <label className="block text-xs mb-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>BLOB NAME</label>
            <input
              className="input-field w-full px-4 py-3 rounded-xl text-sm"
              placeholder="e.g. my-artwork.jpg"
              value={blobName}
              onChange={(e) => setBlobName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs mb-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>CATEGORY</label>
            <div className="grid grid-cols-4 gap-2">
              {['art', 'music', 'writing', 'video'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className="py-2 rounded-lg text-xs capitalize transition-all"
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 600,
                    background: category === cat ? 'var(--gold)' : 'var(--dark-3)',
                    color: category === cat ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
                    border: '1px solid',
                    borderColor: category === cat ? 'var(--gold)' : 'transparent',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleUpload}
            disabled={!file || !blobName || !walletAddress || status === 'uploading'}
            className="w-full btn-gold py-4 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {status === 'uploading' ? (
              <>
                <Loader size={16} className="animate-spin" />
                Uploading to Shelby...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload & Mint Ownership Proof
              </>
            )}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Stored on Shelby Protocol · Proof anchored on Aptos blockchain
          </p>
        </div>
      )}
    </div>
  )
}
