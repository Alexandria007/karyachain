import { useEffect, useState } from 'react'
import { downloadShelbyBlob } from '../lib/shelby'

interface ShelbyImagePreviewProps {
  account: string
  blobName: string
  alt: string
  style?: React.CSSProperties
  onError?: () => void
}

export function ShelbyImagePreview({ account, blobName, alt, style, onError }: ShelbyImagePreviewProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    void downloadShelbyBlob(account, blobName)
      .then(blob => {
        objectUrl = URL.createObjectURL(blob)
        if (active) {
          setUrl(objectUrl)
        } else {
          URL.revokeObjectURL(objectUrl)
        }
      })
      .catch(() => {
        if (active) onError?.()
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [account, blobName, onError])

  if (!url) return null

  return <img src={url} alt={alt} style={style} onError={onError} />
}
