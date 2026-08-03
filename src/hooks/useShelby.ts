import { useQuery } from '@tanstack/react-query'
import type { BlobMetadata } from '@shelby-protocol/sdk/browser'
import { shelbyClient } from '../lib/shelby'

// ── useAccountBlobs ────────────────────────────────────────────────────────────

export function useAccountBlobs(ownerAddress: string | null | undefined) {
  return useQuery<BlobMetadata[]>({
    queryKey: ['shelby', 'accountBlobs', ownerAddress],
    enabled: !!ownerAddress,
    staleTime: 30_000,
    queryFn: async () => {
      if (!ownerAddress) return []

      // Inject API key into all fetch requests to Aptos indexer
      const blobs = await shelbyClient.coordination.getAccountBlobs({ account: ownerAddress })
      const nowMicros = Date.now() * 1000
      return blobs.filter(blob => !blob.isDeleted && blob.isWritten && blob.expirationMicros > nowMicros)

        // No need to restore fetch — patch is idempotent
    },
  })
}
