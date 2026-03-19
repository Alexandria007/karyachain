import { useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import UploadSection from './components/UploadSection'
import MyWorks from './components/MyWorks'
import Explore from './components/Explore'
import { ToastContainer } from './components/Toast'
import './App.css'

type Page = 'home' | 'upload' | 'works' | 'explore'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="pt-16">
        {currentPage === 'home'    && <Hero setCurrentPage={setCurrentPage} />}
        {currentPage === 'upload'  && <UploadSection />}
        {currentPage === 'works'   && <MyWorks />}
        {currentPage === 'explore' && <Explore />}
      </main>
      <ToastContainer />
    </div>
  )
}

export default App
