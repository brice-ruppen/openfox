import { useCallback, useState } from 'react'
import { copyToClipboard } from '../lib/clipboard'

export function useCopyToClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string) => {
      try {
        await copyToClipboard(text)
        setCopied(true)
        setTimeout(() => setCopied(false), resetDelay)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    },
    [resetDelay],
  )

  return { copied, copy }
}
