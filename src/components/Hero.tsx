import { ArrowRight, Shield, Zap, Globe, Sparkles } from 'lucide-react'

type Page = 'home' | 'upload' | 'works'

interface HeroProps {
  setCurrentPage: (page: Page) => void
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
    desc: 'Powered by Shelby Protocol. Sub-second access from anywhere in the world.',
  },
  {
    icon: Globe,
    title: 'Creator Economy',
    desc: 'Gate premium content, set your price, get paid in ShelbyUSD.',
  },
]

export default function Hero({ setCurrentPage }: HeroProps) {
  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Gold radial glow */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, var(--gold) 0%, transparent 65%)' }}
          />
          {/* Subtle grid */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)',
            backgroundSize: '80px 80px'
          }} />
          {/* Vignette */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,10,10,0.8) 100%)'
          }} />
          {/* Floating orbs */}
          <div className="absolute top-1/4 right-1/4 w-2 h-2 rounded-full opacity-60" style={{ background: 'var(--gold)', boxShadow: '0 0 20px var(--gold)', animation: 'pulse-gold 3s infinite' }} />
          <div className="absolute bottom-1/3 left-1/5 w-1 h-1 rounded-full opacity-40" style={{ background: 'var(--gold)', boxShadow: '0 0 12px var(--gold)', animation: 'pulse-gold 4s infinite 1s' }} />
          <div className="absolute top-2/3 right-1/3 w-1.5 h-1.5 rounded-full opacity-50" style={{ background: 'var(--gold)', boxShadow: '0 0 16px var(--gold)', animation: 'pulse-gold 3.5s infinite 0.5s' }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="animate-fade-up delay-1 inline-flex items-center gap-2 mb-8 px-5 py-2.5 rounded-full border" 
            style={{ borderColor: 'rgba(201,168,76,0.25)', background: 'rgba(201,168,76,0.06)', backdropFilter: 'blur(10px)' }}>
            <Sparkles size={12} style={{ color: 'var(--gold)' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--gold)', fontFamily: 'Syne, sans-serif' }}>
              Built on Shelby Protocol × Aptos
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-2 font-extrabold leading-[1.05] mb-6 tracking-tight text-5xl md:text-6xl lg:text-7xl">
            Own Your{' '}
            <span className="gold-shimmer relative">
              Creative
              <span className="absolute -bottom-2 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />
            </span>
            <br />
            <span style={{ color: 'rgba(255,255,255,0.9)' }}>Work. Forever.</span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-up delay-3 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed" 
            style={{ color: 'rgba(255,255,255,0.45)' }}>
            KaryaChain is a decentralized platform for creators to store, verify, and monetize their work with cryptographic proof of ownership. No platform can take it away.
          </p>

          {/* CTA */}
          <div className="animate-fade-up delay-4 flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button
              onClick={() => setCurrentPage('upload')}
              className="btn-gold flex items-center gap-2.5 px-8 py-4 rounded-xl text-sm font-semibold"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Start Uploading
              <ArrowRight size={15} />
            </button>
            <button
              onClick={() => setCurrentPage('works')}
              className="btn-outline flex items-center gap-2.5 px-8 py-4 rounded-xl text-sm font-semibold"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              View My Works
            </button>
          </div>

          {/* Stats */}
          <div className="animate-fade-up delay-4 flex justify-center gap-3 max-w-sm mx-auto">
            {[
              { value: '100%', label: 'Decentralized' },
              { value: '0x', label: 'Censorship' },
              { value: '∞', label: 'Ownership' },
            ].map((stat) => (
              <div key={stat.label} className="flex-1 text-center py-4 px-2 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-center mb-2" style={{ height: '28px' }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', color: 'var(--gold)', fontWeight: 900, fontSize: stat.value === '∞' ? '28px' : '20px', lineHeight: 1 }}>
                    {stat.value}
                  </span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Syne, sans-serif', fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-6 pb-32">
        {/* Divider */}
        <div className="flex items-center gap-6 mb-20">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.2))' }} />
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
              Why <span style={{ color: 'var(--gold)' }}>KaryaChain?</span>
            </h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Syne, sans-serif' }}>
              Infrastructure-level ownership for the next generation of creators.
            </p>
          </div>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.2), transparent)' }} />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card rounded-2xl p-8 group relative overflow-hidden" style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(201,168,76,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
            >
              {/* Card glow on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" 
                style={{ background: 'radial-gradient(circle at top left, rgba(201,168,76,0.05), transparent 60%)' }} />
              
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 relative z-10" style={{ background: 'var(--gold-dim)' }}>
                <f.icon size={20} style={{ color: 'var(--gold)' }} />
              </div>
              <h3 className="text-lg font-bold mb-3 relative z-10" style={{ fontFamily: 'Syne, sans-serif' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed relative z-10" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps Section */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
            Get Started in <span style={{ color: 'var(--gold)' }}>3 Easy Steps</span>
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Syne, sans-serif' }}>
            From wallet to on-chain proof of ownership in minutes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              num: '01',
              title: 'Connect Wallet',
              desc: 'Connect your Petra wallet to authenticate your identity on the Aptos network.',
            },
            {
              num: '02',
              title: 'Upload Your Work',
              desc: 'Drag and drop your music, photo, writing, or video to Shelby Protocol decentralized storage.',
            },
            {
              num: '03',
              title: 'Own It Forever',
              desc: 'Receive a cryptographic proof of ownership anchored on Aptos shelbynet.',
            },
          ].map((step) => (
            <div key={step.num} className="relative p-8 rounded-2xl" style={{ background: 'var(--dark-2)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-5xl font-black mb-6 leading-none" style={{ fontFamily: 'Syne, sans-serif', color: 'rgba(201,168,76,0.15)', letterSpacing: '-0.02em' }}>
                {step.num}
              </div>
              <h3 className="text-base font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-6 pb-32">
        <div className="relative rounded-3xl p-12 text-center overflow-hidden"
          style={{ background: 'var(--dark-2)', border: '1px solid rgba(201,168,76,0.15)' }}>
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 60%)'
          }} />
          {/* Top border accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
              Ready to Own Your <span style={{ color: 'var(--gold)' }}>Creative Work?</span>
            </h2>
            <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
              Upload your karya, mint your proof of ownership, and monetize with ShelbyUSD. No platform can take it away from you.
            </p>
            <button
              onClick={() => setCurrentPage('upload')}
              className="btn-gold inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-sm font-semibold"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Start Uploading
              <ArrowRight size={15} />
            </button>
            <div className="flex items-center justify-center gap-6 mt-6">
              {['Decentralized storage', 'Pay with ShelbyUSD', 'On-chain proof'].map((item) => (
                <span key={item} className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Syne, sans-serif' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '10px' }}>✓</span>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
