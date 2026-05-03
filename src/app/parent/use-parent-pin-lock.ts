'use client'

import { useState, useEffect, useRef } from 'react'
import type { Family } from '@/lib/types'
import { getLockDurationMs } from '@/lib/constants'

const PARENT_PIN_SESSION_KEY = 'cq_parent_unlocked'

export interface PinLockState {
  parentLocked: boolean
  lockPinInput: string
  lockPinError: boolean
  parentPinAttempts: number
  parentLockedUntil: number | null
  now: number
  setLockPinInput: (v: string | ((prev: string) => string)) => void
  setLockPinError: (v: boolean) => void
  handleParentPinDigit: (digit: string) => Promise<void>
  handleLock: () => void
  unlock: () => void
}

export function useParentPinLock(family: Family | null): PinLockState {
  const [parentLocked, setParentLocked] = useState(false)
  const [lockPinInput, setLockPinInput] = useState('')
  const [lockPinError, setLockPinError] = useState(false)
  const [parentPinAttempts, setParentPinAttempts] = useState(0)
  const [parentLockedUntil, setParentLockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const hasCheckedParentPin = useRef(false)

  useEffect(() => {
    if (!family || hasCheckedParentPin.current) return
    hasCheckedParentPin.current = true
    if (family.has_parent_pin) {
      const unlocked = sessionStorage.getItem(PARENT_PIN_SESSION_KEY) === '1'
      if (!unlocked) setParentLocked(true)
    }
  }, [family])

  useEffect(() => {
    return () => { sessionStorage.removeItem(PARENT_PIN_SESSION_KEY) }
  }, [])

  useEffect(() => {
    if (!parentLockedUntil) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [parentLockedUntil])

  const handleParentPinDigit = async (digit: string) => {
    if (parentLockedUntil && now < parentLockedUntil) return
    const next = lockPinInput + digit
    setLockPinInput(next)
    if (next.length === 4) {
      const res = await fetch('/api/parent/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: next }),
      })
      const { success } = await res.json()
      if (success) {
        sessionStorage.setItem(PARENT_PIN_SESSION_KEY, '1')
        setParentLocked(false)
        setLockPinError(false)
        setLockPinInput('')
        setParentPinAttempts(0)
        setParentLockedUntil(null)
      } else {
        const attempts = parentPinAttempts + 1
        setParentPinAttempts(attempts)
        if (attempts >= 5) {
          const lockMs = getLockDurationMs(attempts)
          setParentLockedUntil(now + lockMs)
        }
        setLockPinError(true)
        setTimeout(() => {
          setLockPinInput('')
          setLockPinError(false)
        }, 700)
      }
    }
  }

  const handleLock = () => {
    sessionStorage.removeItem(PARENT_PIN_SESSION_KEY)
    setParentLocked(true)
    setLockPinInput('')
  }

  const unlock = () => {
    sessionStorage.removeItem(PARENT_PIN_SESSION_KEY)
  }

  return {
    parentLocked, lockPinInput, lockPinError, parentPinAttempts, parentLockedUntil, now,
    setLockPinInput, setLockPinError, handleParentPinDigit, handleLock, unlock,
  }
}
