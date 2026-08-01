'use client'

import { motion } from 'framer-motion'
import type { LedgerEntry } from '@/lib/ledger'

interface CoinLedgerProps {
  ledger: LedgerEntry[]
  currentBalance: number
}

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  quest_reward: 'Quest reward',
  quest_rejected: 'Quest rejected',
  reward_redeemed: 'Reward redeemed',
  reward_denied: 'Reward denied',
  curse: 'Curse applied',
  curse_refund: 'Curse forgiven',
  dungeon_reward: 'Dungeon reward',
  raid_bounty: 'Raid bounty',
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

function formatTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function groupByDate(ledger: LedgerEntry[]): Array<{ dateLabel: string; entries: LedgerEntry[] }> {
  const groups = new Map<string, LedgerEntry[]>()
  for (const entry of ledger) {
    const label = formatDate(entry.occurred_at)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(entry)
  }
  return Array.from(groups.entries()).map(([dateLabel, entries]) => ({ dateLabel, entries }))
}

export function CoinLedger({ ledger, currentBalance }: CoinLedgerProps) {
  if (ledger.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/25">
        <p className="text-4xl mb-3">📒</p>
        <p className="text-sm">No transactions yet</p>
      </div>
    )
  }

  const groups = groupByDate(ledger)

  return (
    <motion.div
      className="flex flex-col gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Running balance header */}
      <div
        className="rounded-2xl p-4 mb-3 flex items-center gap-3"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        <span className="text-2xl">🪙</span>
        <div>
          <p className="text-white/50 text-xs">Current balance</p>
          <p className="font-heading text-2xl font-bold text-cq-gold">{currentBalance.toLocaleString()}</p>
        </div>
      </div>

      {groups.map(({ dateLabel, entries }) => (
        <div key={dateLabel}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 px-1 py-2">{dateLabel}</p>
          <div className="flex flex-col gap-1.5">
            {entries.map((entry, i) => {
              const isCredit = entry.amount > 0
              const isDebit = entry.amount < 0
              const isNeutral = entry.amount === 0

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background: isCredit
                      ? 'rgba(74,222,128,0.05)'
                      : isDebit
                      ? 'rgba(239,68,68,0.05)'
                      : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isCredit ? 'rgba(74,222,128,0.12)' : isDebit ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {/* Icon */}
                  <span className="text-lg flex-shrink-0 w-7 text-center">{entry.icon}</span>

                  {/* Description + metadata */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isNeutral ? 'text-white/40' : 'text-white/80'}`}>
                      {entry.description}
                    </p>
                    <p className="text-[10px] text-white/25 mt-0.5">
                      {KIND_LABEL[entry.kind]} · {formatTime(entry.occurred_at)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-sm font-bold font-heading"
                      style={{
                        color: isCredit ? '#4ade80' : isDebit ? '#f87171' : 'rgba(255,255,255,0.3)',
                      }}
                    >
                      {isCredit ? `+${entry.amount}` : isDebit ? `${entry.amount}` : '—'}
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      → {entry.balance_after.toLocaleString()} 🪙
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}

      <p className="text-[10px] text-white/15 text-center pt-4 pb-2">
        Balance shown is estimated from tracked events.
        Manual adjustments may not be reflected.
      </p>
    </motion.div>
  )
}
