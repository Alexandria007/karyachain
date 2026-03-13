import { ArrowRight, Shield, Zap, Globe } from 'lucide-react'

type Page = 'home' | 'upload' | 'works'

interface HeroProps {
  setCurrentPage: (page: Page) => void
  walletAddress: string | null
}

const features = [
  {
    icon: Shield,
    title: 'Proof of Ownership',
    desc: 'Every upload gets a cryptographic receipt anchored on Aptos blockchain.',
  },
  {
    icon: Zap,
    title: 'Hot Storage',
    desc: 'Powered by Shelby Protocol — sub-second access from anywhere in the world.',
  },
  {
    icon: Globe,
    title: 'Creator Economy',
    desc: 'Gate premium content, set your price, get paid in ShelbyUSD.',
  },
]

export default function Hero({ setCurrentPage, walletAddress }: HeroProps) {
  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--gold) 0%, transparent 70%)' }}
          />
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="animate-fade-up delay-1 inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border" style={{ borderColor: 'rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.05)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)' }} />
            <span className="badge" style={{ color: 'var(--gold)' }}>Built on Shelby Protocol × Aptos</span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-2 text-5xl md:text-7xl font-extrabold leading-none mb-6 tracking-tight">
            Own Your{' '}
            <span className="gold-shimmer">Creative</span>
            <br />Work. Forever.
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-up delay-3 text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            KaryaChain is a decentralized platform for creators to store, verify, and monetize their work with cryptographic proof of ownership — no platform can take it away.
          </p>

          {/* CTA */}
          <div className="animate-fade-up delay-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage('upload')}
              className="btn-gold flex items-center gap-2 px-8 py-4 rounded-xl text-base"
            >
              Start Uploading
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage('works')}
              className="btn-outline flex items-center gap-2 px-8 py-4 rounded-xl text-base"
            >
              View My Works
            </button>
          </div>

          {/* Stats */}
          <div className="animate-fade-up delay-4 mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto">
            {[
              { value: '100%', label: 'Decentralized' },
              { value: '0x', label: 'Censorship' },
              { value: '∞', label: 'Ownership' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--gold)' }}>
                  {stat.value}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', letterSpacing: '0.05em' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-6 pb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Why <span style={{ color: 'var(--gold)' }}>KaryaChain?</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Infrastructure-level ownership for the next generation of creators.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: 'var(--gold-dim)' }}>
                <f.icon size={22} style={{ color: 'var(--gold)' }} />
              </div>
              <h3 className="text-lg font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
