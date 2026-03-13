import { useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import UploadSection from './components/UploadSection'
import MyWorks from './components/MyWorks'
import './App.css'

type Page = 'home' | 'upload' | 'works'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Header
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        walletAddress={walletAddress}
        setWalletAddress={setWalletAddress}
      />
      <main>
        {currentPage === 'home' && (
          <Hero setCurrentPage={setCurrentPage} />
        )}
        {currentPage === 'upload' && (
          <UploadSection walletAddress={walletAddress} />
        )}
        {currentPage === 'works' && (
          <MyWorks walletAddress={walletAddress} />
        )}
      </main>
    </div>
  )
}

export default App
