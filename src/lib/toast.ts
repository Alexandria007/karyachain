export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

export type ToastPayload = Omit<ToastItem, 'id'>
type Listener = (toast: ToastPayload) => void

const listeners = new Set<Listener>()

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(payload: ToastPayload) {
  listeners.forEach(listener => listener(payload))
}

export const toast = {
  success: (message: string) => emit({ message, type: 'success' }),
  error: (message: string) => emit({ message, type: 'error' }),
  info: (message: string) => emit({ message, type: 'info' }),
}
