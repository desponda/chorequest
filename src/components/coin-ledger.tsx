'use client'

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { LedgerEntry, PendingLedgerEntry } from '@/lib/ledger'
import { RealmIcon } from '@/components/ui/realm-icon'

interface CoinLedgerProps {
  ledger: LedgerEntry[]
  pending?: PendingLedgerEntry[]
  currentBalance: number
  availableBalance?: number
  timeZone?: string
  onRefresh?: () => void
}

type LedgerFilter = 'all' | 'earned' | 'spent' | 'adjustments'

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  quest_reward: 'Quest reward',
  quest_reversal: 'Quest approval reversed',
  reward_redeemed: 'Reward redeemed',
  curse: 'Curse applied',
  curse_refund: 'Curse forgiven',
  curse_reopened: 'Curse reopened',
  dungeon_reward: 'Dungeon reward',
  raid_bounty: 'Raid bounty',
  manual_adjustment: 'Parent adjustment',
  migration_opening_balance: 'Imported balance',
}

const FILTERS: Array<{ id: LedgerFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'earned', label: 'Earned' },
  { id: 'spent', label: 'Spent' },
  { id: 'adjustments', label: 'Adjustments' },
]

function dateKey(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function formatDate(iso: string, timeZone?: string): string {
  const date = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const entryDateKey = dateKey(date, timeZone)
  const todayDateKey = dateKey(now, timeZone)

  if (entryDateKey === todayDateKey) return 'Today'
  if (dateKey(date, timeZone) === dateKey(yesterday, timeZone)) return 'Yesterday'

  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: entryDateKey.slice(0, 4) !== todayDateKey.slice(0, 4) ? 'numeric' : undefined,
  }).format(date)
}

function formatTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function groupByDate(ledger: LedgerEntry[], timeZone?: string): Array<{ dateLabel: string; entries: LedgerEntry[] }> {
  const groups = new Map<string, LedgerEntry[]>()
  for (const entry of ledger) {
    const label = formatDate(entry.occurred_at, timeZone)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(entry)
  }
  return Array.from(groups.entries()).map(([dateLabel, entries]) => ({ dateLabel, entries }))
}

function matchesFilter(entry: { amount: number; kind: string }, filter: LedgerFilter): boolean {
  if (filter === 'earned') return entry.amount > 0 && entry.kind !== 'manual_adjustment'
  if (filter === 'spent') return entry.amount < 0 && entry.kind !== 'manual_adjustment'
  if (filter === 'adjustments') return entry.kind === 'manual_adjustment' || entry.kind === 'migration_opening_balance'
  return true
}

function Amount({ amount }: { amount: number }) {
  const color = amount > 0 ? '#86efac' : amount < 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)'
  return (
    <span className="font-heading text-sm font-bold" style={{ color }}>
      {amount > 0 ? `+${amount.toLocaleString()}` : amount.toLocaleString()} <RealmIcon name="🪙" size={14} strokeWidth={2.1} />
    </span>
  )
}

export function CoinLedger({
  ledger,
  pending = [],
  currentBalance,
  availableBalance = currentBalance,
  timeZone,
  onRefresh,
}: CoinLedgerProps) {
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const reduceMotion = useReducedMotion()

  const filteredLedger = useMemo(
    () => ledger.filter((entry) => matchesFilter(entry, filter)),
    [filter, ledger],
  )
  const filteredPending = useMemo(
    () => pending.filter((entry) => matchesFilter(entry, filter)),
    [filter, pending],
  )
  const groups = useMemo(
    () => groupByDate(filteredLedger, timeZone),
    [filteredLedger, timeZone],
  )
  const pendingCredits = pending.reduce((sum, entry) => sum + Math.max(0, entry.amount), 0)
  const pendingDebits = Math.abs(pending.reduce((sum, entry) => sum + Math.min(0, entry.amount), 0))
  const hasActivity = ledger.length > 0 || pending.length > 0

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {onRefresh && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-white/90">Coin activity</h2>
            <p className="text-xs text-white/60">Pending items post after parent approval.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-11 px-3 rounded-xl text-xs font-bold text-white/75 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            aria-label="Refresh coin activity"
          >
            <RealmIcon name="🔄" size={14} strokeWidth={2.1} /> Refresh
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2" aria-label="Coin balances">
        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.24)' }}
        >
          <p className="text-white/65 text-xs">Current balance</p>
          <p className="font-heading text-xl sm:text-2xl font-bold text-cq-gold mt-1">
            {currentBalance.toLocaleString()} <RealmIcon name="🪙" size={18} strokeWidth={2.1} />
          </p>
          <p className="text-white/50 text-xs mt-1">Posted transactions</p>
        </div>
        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)' }}
        >
          <p className="text-white/65 text-xs">Available to spend</p>
          <p className="font-heading text-xl sm:text-2xl font-bold text-sky-300 mt-1">
            {availableBalance.toLocaleString()} <RealmIcon name="🪙" size={18} strokeWidth={2.1} />
          </p>
          <p className="text-white/50 text-xs mt-1">
            {pendingDebits > 0 ? `${pendingDebits.toLocaleString()} reserved` : 'Nothing reserved'}
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <div
          className="rounded-xl px-3 py-2 text-xs text-amber-100/90 flex flex-wrap gap-x-3 gap-y-1"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}
          role="status"
        >
          <span className="font-bold">{pending.length} pending</span>
          {pendingCredits > 0 && <span>+{pendingCredits.toLocaleString()} awaiting approval</span>}
          {pendingDebits > 0 && <span>−{pendingDebits.toLocaleString()} reserved</span>}
        </div>
      )}

      {hasActivity && (
        <div className="flex gap-1 overflow-x-auto pb-1" role="group" aria-label="Filter coin history">
          {FILTERS.map((item) => {
            const selected = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={selected}
                className="min-h-11 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-colors"
                style={{
                  color: selected ? '#fef3c7' : 'rgba(255,255,255,0.68)',
                  background: selected ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selected ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.09)'}`,
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}

      {filteredPending.length > 0 && (
        <section aria-labelledby="pending-activity-title">
          <h3 id="pending-activity-title" className="text-xs font-bold uppercase tracking-wider text-amber-200/80 px-1 mb-2">
            Pending activity
          </h3>
          <div className="flex flex-col gap-2">
            {filteredPending.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl px-3 py-3"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px dashed rgba(251,191,36,0.28)' }}
              >
                <span className="text-cq-gold flex-shrink-0 w-7 inline-flex items-center justify-center" aria-hidden="true"><RealmIcon name={entry.icon} size={17} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">{entry.description}</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    {entry.kind === 'quest_pending' ? 'Quest awaiting approval' : 'Reward awaiting approval'} · {formatTime(entry.occurred_at, timeZone)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Amount amount={entry.amount} />
                  <p className="text-xs text-amber-200/70 mt-0.5">Pending</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section aria-labelledby="posted-activity-title">
          <h3 id="posted-activity-title" className="text-xs font-bold uppercase tracking-wider text-white/70 px-1 mb-1">
            Posted activity
          </h3>
          <div className="flex flex-col gap-2">
            {groups.map(({ dateLabel, entries }) => (
              <div key={dateLabel}>
                <p className="text-xs font-bold text-white/55 px-1 py-2">{dateLabel}</p>
                <div className="flex flex-col gap-2">
                  {entries.map((entry, index) => {
                    const isCredit = entry.amount > 0
                    const isDebit = entry.amount < 0

                    return (
                      <motion.div
                        key={entry.id}
                        initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: reduceMotion ? 0 : Math.min(index, 6) * 0.03 }}
                        className="flex items-center gap-3 rounded-xl px-3 py-3"
                        style={{
                          background: isCredit
                            ? 'rgba(74,222,128,0.06)'
                            : isDebit
                              ? 'rgba(248,113,113,0.06)'
                              : 'rgba(255,255,255,0.035)',
                          border: `1px solid ${isCredit ? 'rgba(74,222,128,0.16)' : isDebit ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.09)'}`,
                        }}
                      >
                        <span className="text-cq-gold flex-shrink-0 w-7 inline-flex items-center justify-center" aria-hidden="true"><RealmIcon name={entry.icon} size={17} /></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">{entry.description}</p>
                          <p className="text-xs text-white/60 mt-0.5">
                            {KIND_LABEL[entry.kind]} · {formatTime(entry.occurred_at, timeZone)}
                          </p>
                          {entry.is_estimated && (
                            <p className="text-xs text-amber-200/75 mt-0.5">Imported history · reconstructed balance</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <Amount amount={entry.amount} />
                          <p className="text-xs text-white/60 mt-0.5">
                            Balance after: {entry.balance_after.toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!hasActivity && (
        <div className="flex flex-col items-center justify-center py-12 text-white/60">
          <span className="text-cq-gold mb-3" aria-hidden="true"><RealmIcon name="📒" size={34} /></span>
          <p className="text-sm font-medium text-white/75">No coin activity yet</p>
          <p className="text-xs text-white/55 mt-1 text-center">Earned, spent, and adjusted coins will appear here.</p>
        </div>
      )}

      {hasActivity && filteredLedger.length === 0 && filteredPending.length === 0 && (
        <p className="text-sm text-white/60 text-center py-8">No activity matches this filter.</p>
      )}

      <p className="text-xs text-white/50 text-center pb-1">
        New posted entries record the exact balance after each transaction. Imported history is clearly marked.
      </p>
    </motion.div>
  )
}
