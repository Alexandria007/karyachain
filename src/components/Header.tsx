import { Wallet, Menu, X } from 'lucide-react'
import { useState } from 'react'

type Page = 'home' | 'upload' | 'works'

interface HeaderProps {
  currentPage: Page
  setCurrentPage: (page: Page) => void
  walletAddress: string | null
  setWalletAddress: (address: string | null) => void
}

export default function Header({ currentPage, setCurrentPage, walletAddress, setWalletAddress }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const connectWallet = () => {
    // Simulate wallet connection for demo
    const mockAddress = '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6)
    setWalletAddress(mockAddress)
  }

  const shortAddress = walletAddress
    ? walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)
    : null

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(20px)' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => setCurrentPage('home')} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--gold)' }}>
            <span className="text-black font-bold text-xs" style={{ fontFamily: 'Syne, sans-serif' }}>K</span>
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Karya<span style={{ color: 'var(--gold)' }}>Chain</span>
          </span>
        </button>

        {/* Nav - Desktop */}
        <nav className="hidden md:flex items-center gap-8">
          {(['home', 'upload', 'works'] as Page[]).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className="text-sm capitalize transition-colors"
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 600,
                color: currentPage === page ? 'var(--gold)' : 'rgba(255,255,255,0.5)',
              }}
            >
              {page === 'works' ? 'My Works' : page}
            </button>
          ))}
        </nav>

        {/* Wallet Button */}
        <div className="flex items-center gap-3">
          {walletAddress ? (
            <button
              onClick={() => setWalletAddress(null)}
              className="btn-outline flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            >
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--gold)', animation: 'pulse-gold 2s infinite' }} />
              {shortAddress}
            </button>
          ) : (
            <button
              onClick={connectWallet}
              className="btn-gold flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            >
              <Wallet size={14} />
              Connect Wallet
            </button>
          )}

          {/* Mobile menu */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/5 px-6 py-4 flex flex-col gap-4" style={{ background: 'var(--dark-2)' }}>
          {(['home', 'upload', 'works'] as Page[]).map((page) => (
            <button
              key={page}
              onClick={() => { setCurrentPage(page); setMenuOpen(false) }}
              className="text-left text-sm capitalize"
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 600,
                color: currentPage === page ? 'var(--gold)' : 'rgba(255,255,255,0.5)',
              }}
            >
              {page === 'works' ? 'My Works' : page}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
