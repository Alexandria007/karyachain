import { useQuery } from '@tanstack/react-query'
import { shelbyClient } from '../lib/shelby'

// ── useAccountBlobs ────────────────────────────────────────────────────────────

export function useAccountBlobs(ownerAddress: string | null | undefined) {
  return useQuery({
    queryKey: ['shelby', 'accountBlobs', ownerAddress],
    enabled: !!ownerAddress,
    staleTime: 30_000,
    queryFn: async () => {
      if (!ownerAddress) return []

      // Inject API key into all fetch requests to Aptos indexer
      const apiKey = import.meta.env.VITE_APTOS_API_KEY as string | undefined

      if (apiKey) {
        const originalFetch = window.fetch.bind(window)
        const patchedFetch = (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
          if (url.includes('aptoslabs.com') || url.includes('shelby.xyz')) {
            const headers = new Headers(init?.headers)
            if (!headers.has('Authorization')) {
              headers.set('Authorization', `Bearer ${apiKey}`)
            }
            return originalFetch(input, { ...init, headers })
          }
          return originalFetch(input, init)
        }
        ;(window as any).fetch = patchedFetch
      }

      try {
        const result = await shelbyClient.coordination.getAccountBlobs({ account: ownerAddress })
        console.log('[Shelby] blobs fetched:', (result as any[]).length)
        return result as any[]
      } finally {
        // No need to restore fetch — patch is idempotent
      }
    },
  })
}
