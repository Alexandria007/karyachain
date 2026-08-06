import { useInfiniteQuery } from '@tanstack/react-query'
import { getShelbyBlobsPage } from '../lib/shelby'

const ACCOUNT_BLOB_PAGE_SIZE = 24

// ── useAccountBlobs ────────────────────────────────────────────────────────────

export function useAccountBlobs(ownerAddress: string | null | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['shelby', 'accountBlobs', ownerAddress],
    enabled: !!ownerAddress,
    staleTime: 30_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const page = await getShelbyBlobsPage({
        account: ownerAddress ?? undefined,
        offset: pageParam,
        limit: ACCOUNT_BLOB_PAGE_SIZE,
      })
      const nowMicros = Date.now() * 1000
      return {
        ...page,
        items: page.items.filter(blob => blob.isWritten && !blob.isDeleted && blob.expirationMicros > nowMicros),
      }
    },
    getNextPageParam: (lastPage) => (
      lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined
    ),
  })

  const blobs = query.data?.pages.flatMap(page => page.items) ?? []

  return { ...query, data: blobs }
}
