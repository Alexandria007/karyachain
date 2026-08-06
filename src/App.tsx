import { lazy, Suspense, useState } from 'react'
import Header from './components/Header'
import { ToastContainer } from './components/Toast'
import './App.css'

const Hero = lazy(() => import('./components/Hero'))
const UploadSection = lazy(() => import('./components/UploadSection'))
const MyWorks = lazy(() => import('./components/MyWorks'))
const Explore = lazy(() => import('./components/Explore'))
const ProofPage = lazy(() => import('./components/ProofPage'))

function PageFallback() {
  return (
    <div role="status" aria-live="polite" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', color: '#777', fontSize: 14 }}>
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="pt-16">
        <Suspense fallback={<PageFallback />}>
          {currentPage === 'home'    && <Hero setCurrentPage={setCurrentPage} />}
          {currentPage === 'upload'  && <UploadSection />}
          {currentPage === 'works'   && <MyWorks />}
          {currentPage === 'explore' && <Explore />}
          {currentPage === 'proof'   && <ProofPage />}
        </Suspense>
      </main>
      <ToastContainer />
    </div>
  )
}

export default App
