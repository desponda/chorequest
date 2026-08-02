'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

let bodyLockCount = 0
let previousBodyOverflow = ''

function lockBodyScroll() {
  if (bodyLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bodyLockCount += 1
}

function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1)
  if (bodyLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
  }
}

/**
 * Traps Tab / Shift-Tab focus inside the returned ref while `active` is true,
 * and restores focus to whatever was focused before activation when it flips off.
 * Caller is responsible for closing the modal on Escape (see useEscapeToClose).
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null
    lockBodyScroll()

    // Move initial focus into the container. Prefer the first focusable element;
    // fall back to the container itself so screen readers announce it.
    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((el) => !el.hasAttribute('data-focus-skip'))
    const initial = focusables[0] ?? container
    initial.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const live = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => !el.hasAttribute('data-focus-skip') && el.offsetParent !== null)
      if (live.length === 0) {
        e.preventDefault()
        return
      }
      const first = live[0]
      const last = live[live.length - 1]
      const current = document.activeElement as HTMLElement | null

      if (e.shiftKey && (current === first || !container.contains(current))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockBodyScroll()
      previouslyFocused.current?.focus?.({ preventScroll: true })
    }
  }, [active])

  return ref
}
