'use client'

import { CoinLedger } from '@/components/coin-ledger'
import type { LedgerEntry, PendingLedgerEntry } from '@/lib/ledger'

const LEDGER: LedgerEntry[] = [
  {
    id: 'tx-4',
    kind: 'manual_adjustment',
    description: 'Birthday bonus',
    icon: '🛠️',
    amount: 20,
    balance_after: 85,
    occurred_at: '2026-08-01T14:00:00.000Z',
    is_estimated: false,
  },
  {
    id: 'tx-3',
    kind: 'reward_redeemed',
    description: 'Movie night',
    icon: '🎬',
    amount: -25,
    balance_after: 65,
    occurred_at: '2026-08-01T13:00:00.000Z',
    is_estimated: false,
  },
  {
    id: 'tx-2',
    kind: 'quest_reward',
    description: 'Clean the kitchen',
    icon: '🧽',
    amount: 15,
    balance_after: 90,
    occurred_at: '2026-08-01T12:00:00.000Z',
    is_estimated: false,
  },
  {
    id: 'tx-1',
    kind: 'migration_opening_balance',
    description: 'Imported opening balance',
    icon: '🧾',
    amount: 75,
    balance_after: 75,
    occurred_at: '2026-07-31T12:00:00.000Z',
    is_estimated: true,
  },
]

const PENDING: PendingLedgerEntry[] = [
  {
    id: 'reward:pending-1',
    kind: 'reward_pending',
    description: 'Extra game time',
    icon: '🎮',
    amount: -30,
    occurred_at: '2026-08-01T15:00:00.000Z',
  },
  {
    id: 'quest:pending-2',
    kind: 'quest_pending',
    description: 'Fold the laundry',
    icon: '🧺',
    amount: 10,
    occurred_at: '2026-08-01T14:30:00.000Z',
  },
]

export default function CoinLedgerFixturePage() {
  return (
    <main className="bg-quest-void min-h-screen p-4 sm:p-8">
      <div className="max-w-lg mx-auto">
        <CoinLedger
          ledger={LEDGER}
          pending={PENDING}
          currentBalance={85}
          availableBalance={55}
          timeZone="America/New_York"
        />
      </div>
    </main>
  )
}
