import { createServiceClient } from './supabase/service'

export type LedgerEntry = {
  id: string
  kind: 'quest_reward' | 'quest_rejected' | 'reward_redeemed' | 'reward_denied' | 'curse' | 'curse_refund' | 'dungeon_reward' | 'raid_bounty'
  description: string
  icon: string
  amount: number        // positive = credit, negative = debit
  balance_after: number
  occurred_at: string
}

export async function buildLedger(kidId: string, currentCoins: number): Promise<{ ledger: LedgerEntry[] }> {
  const supabase = createServiceClient()

  const [completionsRes, redemptionsRes, cursesRes, dungeonRes, raidRes] = await Promise.all([
    supabase
      .from('completions')
      .select('id, coins_awarded, approved_at, completed_at, status, quest:quests(title, icon)')
      .eq('kid_id', kidId)
      .in('status', ['approved', 'rejected'])
      .order('approved_at', { ascending: false }),

    supabase
      .from('redemptions')
      .select('id, status, redeemed_at, cost_charged, reward:rewards(title, icon, cost)')
      .eq('kid_id', kidId)
      .in('status', ['approved', 'denied'])
      .order('redeemed_at', { ascending: false }),

    supabase
      .from('curse_instances')
      .select('id, coins_deducted, cast_at, resolved_at, refunded, curse:curses(title, icon)')
      .eq('kid_id', kidId)
      .order('cast_at', { ascending: false }),

    supabase
      .from('dungeon_clears')
      .select('id, cleared_at, dungeon:dungeon_runs(title, icon, reward_coins)')
      .eq('kid_id', kidId)
      .order('cleared_at', { ascending: false }),

    supabase
      .from('raid_boss_payouts')
      .select('id, amount, paid_at, boss:raid_bosses(title, icon)')
      .eq('kid_id', kidId)
      .order('paid_at', { ascending: false }),
  ])

  type RawEvent = { id: string; kind: LedgerEntry['kind']; description: string; icon: string; amount: number; occurred_at: string }
  const raw: RawEvent[] = []

  for (const c of completionsRes.data ?? []) {
    const quest = c.quest as unknown as { title: string; icon: string } | null
    if (c.status === 'approved') {
      raw.push({
        id: c.id,
        kind: 'quest_reward',
        description: quest?.title ?? 'Quest',
        icon: quest?.icon ?? '⚔️',
        amount: c.coins_awarded ?? 0,
        occurred_at: c.approved_at ?? c.completed_at,
      })
    } else if (c.status === 'rejected') {
      raw.push({
        id: c.id,
        kind: 'quest_rejected',
        description: quest?.title ?? 'Quest',
        icon: quest?.icon ?? '⚔️',
        amount: 0,
        occurred_at: c.approved_at ?? c.completed_at,
      })
    }
  }

  for (const r of redemptionsRes.data ?? []) {
    const reward = r.reward as unknown as { title: string; icon: string; cost: number } | null
    raw.push({
      id: r.id,
      kind: r.status === 'approved' ? 'reward_redeemed' : 'reward_denied',
      description: reward?.title ?? 'Reward',
      icon: reward?.icon ?? '🎁',
      amount: r.status === 'approved' ? -(r.cost_charged ?? reward?.cost ?? 0) : 0,
      occurred_at: r.redeemed_at,
    })
  }

  for (const ci of cursesRes.data ?? []) {
    const curse = ci.curse as unknown as { title: string; icon: string } | null
    if ((ci.coins_deducted ?? 0) > 0) {
      raw.push({
        id: ci.id,
        kind: 'curse',
        description: curse?.title ?? 'Curse',
        icon: curse?.icon ?? '☠️',
        amount: -(ci.coins_deducted ?? 0),
        occurred_at: ci.cast_at,
      })
      if (ci.refunded && ci.resolved_at) {
        raw.push({
          id: `${ci.id}:refund`,
          kind: 'curse_refund',
          description: `${curse?.title ?? 'Curse'} forgiven`,
          icon: curse?.icon ?? '☠️',
          amount: ci.coins_deducted ?? 0,
          occurred_at: ci.resolved_at,
        })
      }
    }
  }

  for (const clear of dungeonRes.data ?? []) {
    const dungeon = clear.dungeon as unknown as { title: string; icon: string; reward_coins: number } | null
    raw.push({
      id: clear.id,
      kind: 'dungeon_reward',
      description: dungeon?.title ?? 'Dungeon clear',
      icon: dungeon?.icon ?? '🏰',
      amount: dungeon?.reward_coins ?? 0,
      occurred_at: clear.cleared_at,
    })
  }

  for (const payout of raidRes.data ?? []) {
    const boss = payout.boss as unknown as { title: string; icon: string } | null
    raw.push({
      id: payout.id,
      kind: 'raid_bounty',
      description: boss?.title ?? 'Raid boss bounty',
      icon: boss?.icon ?? '🐉',
      amount: payout.amount,
      occurred_at: payout.paid_at,
    })
  }

  // Sort newest first
  raw.sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))

  // Compute balance_after by working backwards from the current known balance
  let running = currentCoins
  const ledger: LedgerEntry[] = raw.map(event => {
    const entry: LedgerEntry = { ...event, balance_after: running }
    running -= event.amount
    return entry
  })

  return { ledger }
}
