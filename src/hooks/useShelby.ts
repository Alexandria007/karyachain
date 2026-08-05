import { useQuery } from '@tanstack/react-query'
import type { FullObjectMetadata } from '@shelby-protocol/sdk/browser'
import { getShelbyBlobs } from '../lib/shelby'

// ── useAccountBlobs ────────────────────────────────────────────────────────────

export function useAccountBlobs(ownerAddress: string | null | undefined) {
  return useQuery<FullObjectMetadata[]>({
    queryKey: ['shelby', 'accountBlobs', ownerAddress],
    enabled: !!ownerAddress,
    staleTime: 30_000,
    queryFn: async () => {
      if (!ownerAddress) return []

      const blobs = await getShelbyBlobs(ownerAddress)
      const nowMicros = Date.now() * 1000
      return blobs.filter(blob => blob.isWritten && !blob.isDeleted && blob.expirationMicros > nowMicros)

        // No need to restore fetch — patch is idempotent
    },
  })
}
