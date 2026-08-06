export type ProofLinkData = {
  owner: string
  blobName: string
  registrationTxHash?: string
  commitTxHash?: string
}

/**
 * Build a stable, shareable proof URL without putting any private data in it.
 * The blob metadata is resolved from Shelby when the link is opened.
 */
export const createProofPath = ({
  owner,
  blobName,
  registrationTxHash,
  commitTxHash,
}: ProofLinkData): string => {
  const params = new URLSearchParams({
    proof: '1',
    owner,
    blob: blobName,
  })

  if (registrationTxHash) params.set('registrationTx', registrationTxHash)
  if (commitTxHash) params.set('commitTx', commitTxHash)

  return `/?${params.toString()}`
}

export const createProofUrl = (data: ProofLinkData): string =>
  `${window.location.origin}${createProofPath(data)}`
