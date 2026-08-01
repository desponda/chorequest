import { createServiceClient } from './supabase/service'

export type LedgerEntry = {
  id: string
  kind:
    | 'quest_reward'
    | 'quest_reversal'
    | 'reward_redeemed'
    | 'curse'
    | 'curse_refund'
    | 'curse_reopened'
    | 'dungeon_reward'
    | 'raid_bounty'
    | 'manual_adjustment'
    | 'migration_opening_balance'
  description: string
  icon: string
  amount: number
  balance_after: number
  occurred_at: string
  is_estimated: boolean
}

export type PendingLedgerEntry = {
  id: string
  kind: 'quest_pending' | 'reward_pending'
  description: string
  icon: string
  amount: number
  occurred_at: string
}

export async function buildLedger(kidId: string): Promise<{
  ledger: LedgerEntry[]
  pending: PendingLedgerEntry[]
}> {
  const supabase = createServiceClient()

  const [transactionsRes, completionsRes, redemptionsRes] = await Promise.all([
    supabase
      .from('coin_transactions')
      .select('id, kind, description, icon, amount, balance_after, occurred_at, is_estimated')
      .eq('kid_id', kidId)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false }),

    supabase
      .from('completions')
      .select('id, completed_at, coins_requested, quest:quests(title, icon, coins)')
      .eq('kid_id', kidId)
      .eq('status', 'pending')
      .order('completed_at', { ascending: false }),

    supabase
      .from('redemptions')
      .select('id, redeemed_at, cost_charged, reward:rewards(title, icon, cost)')
      .eq('kid_id', kidId)
      .eq('status', 'pending')
      .order('redeemed_at', { ascending: false }),
  ])

  const queryError = transactionsRes.error ?? completionsRes.error ?? redemptionsRes.error
  if (queryError) {
    throw new Error(`Could not load coin history: ${queryError.message}`)
  }

  const ledger = (transactionsRes.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as LedgerEntry['kind'],
    description: row.description,
    icon: row.icon,
    amount: row.amount,
    balance_after: row.balance_after,
    occurred_at: row.occurred_at,
    is_estimated: row.is_estimated,
  }))

  const pending: PendingLedgerEntry[] = []

  for (const completion of completionsRes.data ?? []) {
    const quest = completion.quest as unknown as { title: string; icon: string; coins: number } | null
    pending.push({
      id: `quest:${completion.id}`,
      kind: 'quest_pending',
      description: quest?.title ?? 'Quest',
      icon: quest?.icon ?? '⚔️',
      amount: completion.coins_requested ?? quest?.coins ?? 0,
      occurred_at: completion.completed_at ?? new Date().toISOString(),
    })
  }

  for (const redemption of redemptionsRes.data ?? []) {
    const reward = redemption.reward as unknown as { title: string; icon: string; cost: number } | null
    pending.push({
      id: `reward:${redemption.id}`,
      kind: 'reward_pending',
      description: reward?.title ?? 'Reward',
      icon: reward?.icon ?? '🎁',
      amount: -(redemption.cost_charged ?? reward?.cost ?? 0),
      occurred_at: redemption.redeemed_at ?? new Date().toISOString(),
    })
  }

  pending.sort((a, b) => {
    const timeOrder = b.occurred_at.localeCompare(a.occurred_at)
    return timeOrder === 0 ? b.id.localeCompare(a.id) : timeOrder
  })

  return { ledger, pending }
}
