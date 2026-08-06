import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react'
import { subscribeToasts, type ToastItem, type ToastPayload } from '../lib/toast'

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  useEffect(() => {
    const handler = (t: ToastPayload) => {
      const id = String(++counter.current)
      setToasts(prev => [...prev, { ...t, id }])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3500)
    }
    return subscribeToasts(handler)
  }, [])

  const dismiss = useCallback((id: string) => setToasts(prev => prev.filter(x => x.id !== id)), [])

  if (!toasts.length) return null

  return (
    <div role="region" aria-live="polite" aria-label="Notifications" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
      {toasts.map(t => (
        <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: t.type === 'success' ? 'rgba(34,197,94,0.12)' : t.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(201,168,76,0.12)',
          border: `1px solid ${t.type === 'success' ? 'rgba(34,197,94,0.3)' : t.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(201,168,76,0.3)'}`,
          borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', minWidth: 240, maxWidth: 360,
          animation: 'toastIn 0.25s ease',
        }}>
          {t.type === 'success' && <CheckCircle size={15} color="#22c55e" style={{ flexShrink: 0 }} />}
          {t.type === 'error' && <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0 }} />}
          {t.type === 'info' && <Info size={15} color="#c9a84c" style={{ flexShrink: 0 }} />}
          <span style={{ fontSize: 13, flex: 1, color: t.type === 'success' ? '#22c55e' : t.type === 'error' ? '#f87171' : '#c9a84c' }}>{t.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#666', padding: 2, flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
