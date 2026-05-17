'use client'

import { useEffect } from 'react'

/**
 * Closes a modal-like UI when the user presses Escape. The handler only attaches
 * while `active` is true, so multiple modals on a page don't all fire at once.
 */
export function useEscapeToClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])
}
