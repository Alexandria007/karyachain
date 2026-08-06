import { lazy, Suspense, useState } from 'react'
import AppErrorBoundary from './components/AppErrorBoundary'
import { ToastContainer } from './components/Toast'
import { APP_CONFIG, SHELBY_NETWORK_LABEL } from './lib/config'
import './App.css'

const Header = lazy(() => import('./components/Header'))
const Hero = lazy(() => import('./components/Hero'))
const UploadSection = lazy(() => import('./components/UploadSection'))
const MyWorks = lazy(() => import('./components/MyWorks'))
const Explore = lazy(() => import('./components/Explore'))
const ProofPage = lazy(() => import('./components/ProofPage'))

function PageFallback() {
  return (
    <div className="page-fallback" role="status" aria-live="polite">
      Loading workspace...
    </div>
  )
}

type Page = 'home' | 'upload' | 'works' | 'explore' | 'proof'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('proof') === '1' || (params.has('owner') && params.has('blob')) ? 'proof' : 'home'
  })
  const visibleConfigWarnings = APP_CONFIG.warnings.filter(warning => !warning.startsWith('No Shelby/Aptos API key'))

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <Suspense fallback={<PageFallback />}>
          <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />
          {visibleConfigWarnings.length > 0 && (
            <div className="config-warning" role="status">
              <span>{SHELBY_NETWORK_LABEL} configuration notice:</span>
              <span>{visibleConfigWarnings.join(' ')}</span>
            </div>
          )}
          <main className="pt-16" aria-label="KaryaChain workspace">
            {currentPage === 'home'    && <Hero setCurrentPage={setCurrentPage} />}
            {currentPage === 'upload'  && <UploadSection />}
            {currentPage === 'works'   && <MyWorks />}
            {currentPage === 'explore' && <Explore />}
            {currentPage === 'proof'   && <ProofPage />}
          </main>
        </Suspense>
        <ToastContainer />
      </div>
    </AppErrorBoundary>
  )
}

export default App