import { useState } from 'react'
import { FileText, Music, Image, Video, Download, ExternalLink, Clock, Search } from 'lucide-react'

interface MyWorksProps {
  walletAddress: string | null
}

// Mock data — will be replaced with real Shelby SDK calls after Early Access
const mockWorks = [
  {
    id: '1',
    name: 'karya-utama.jpg',
    category: 'art',
    size: '2.4 MB',
    uploaded: '2026-03-13',
    expires: '2026-04-13',
    txHash: '0x4a7b9c2d1e3f...',
  },
  {
    id: '2',
    name: 'lagu-demo.mp3',
    category: 'music',
    size: '8.1 MB',
    uploaded: '2026-03-12',
    expires: '2026-04-12',
    txHash: '0x8d2e4f6a1b3c...',
  },
  {
    id: '3',
    name: 'cerpen-pertama.txt',
    category: 'writing',
    size: '12 KB',
    uploaded: '2026-03-11',
    expires: '2026-04-11',
    txHash: '0x1c3e5a7b9d2f...',
  },
]

const categoryIcons: Record<string, React.ElementType> = {
  art: Image,
  music: Music,
  writing: FileText,
  video: Video,
}

const categoryColors: Record<string, string> = {
  art: '#c9a84c',
  music: '#7c9885',
  writing: '#8b7cb8',
  video: '#b87c7c',
}

export default function MyWorks({ walletAddress }: MyWorksProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = mockWorks.filter((w) => {
    const matchSearch = w.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || w.category === filter
    return matchSearch && matchFilter
  })

  if (!walletAddress) {
    return (
      <div className="pt-24 min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--dark-3)' }}>
            <FileText size={32} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>Connect Your Wallet</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Connect your Aptos wallet to view your works.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 min-h-screen max-w-4xl mx-auto px-6 pb-32">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
          My <span style={{ color: 'var(--gold)' }}>Works</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>
          All your works stored on Shelby Protocol with proof of ownership.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm"
            placeholder="Search works..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'art', 'music', 'writing', 'video'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="px-4 py-2 rounded-xl text-xs capitalize transition-all"
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 600,
                background: filter === cat ? 'var(--gold)' : 'var(--dark-3)',
                color: filter === cat ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Works Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <p style={{ fontFamily: 'Syne, sans-serif' }}>No works found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((work) => {
            const Icon = categoryIcons[work.category] || FileText
            const color = categoryColors[work.category] || 'var(--gold)'

            return (
              <div key={work.id} className="card rounded-2xl p-5 flex items-center gap-5">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
                  <Icon size={20} style={{ color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>{work.name}</p>
                  <div className="flex items-center gap-3">
                    <span className="badge" style={{ color, background: `${color}15`, padding: '2px 8px', borderRadius: '4px' }}>
                      {work.category}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={10} />
                      Expires {work.expires}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{work.size}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                    style={{ background: 'var(--dark-3)' }}
                    title="Download"
                  >
                    <Download size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  </button>
                  <a
                    href={`https://explorer.aptoslabs.com/txn/${work.txHash}?network=shelbynet`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                    style={{ background: 'var(--dark-3)' }}
                    title="View on Explorer"
                  >
                    <ExternalLink size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Storage info */}
      <div className="mt-8 p-5 rounded-2xl" style={{ background: 'var(--dark-2)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>STORAGE USED</span>
          <span className="text-xs" style={{ color: 'var(--gold)' }}>10.5 MB / ∞</span>
        </div>
        <div className="w-full h-1 rounded-full" style={{ background: 'var(--dark-4)' }}>
          <div className="h-1 rounded-full" style={{ width: '2%', background: 'var(--gold)' }} />
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          Powered by Shelby Protocol · Network: shelbynet
        </p>
      </div>
    </div>
  )
}
