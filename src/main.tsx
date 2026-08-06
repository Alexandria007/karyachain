import './polyfills'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import BootFallback from './components/BootFallback'
import AppErrorBoundary from './components/AppErrorBoundary'
import './index.css'
import './App.css'

// Provider code includes the wallet SDK and is loaded behind a visible fallback.
// eslint-disable-next-line react-refresh/only-export-components
const AppProviders = lazy(() => import('./providers/AppProviders').then(module => ({ default: module.AppProviders })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <Suspense fallback={<BootFallback />}>
        <AppProviders>
          <App />
        </AppProviders>
      </Suspense>
    </AppErrorBoundary>
  </StrictMode>,
)