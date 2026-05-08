'use client'

import { motion } from 'framer-motion'
import { QuestCard } from '@/components/quest-card'
import { StatusChip } from '@/components/ui/status-chip'
import type { Kid, Quest, Completion, Reward, Redemption, CurseInstance, Curse } from '@/lib/types'
import { Empty, fadeSlide } from './_ui'
import type { ParentActions } from './use-parent-actions'

function formatQuestDate(date: string): string {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const yest = new Date(now)
  yest.setDate(yest.getDate() - 1)
  const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`
  if (date === todayStr) return 'Today'
  if (date === yestStr) return 'Yesterday'
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Props {
  pendingCompletions: Completion[]
  pendingRedemptions: Redemption[]
  approvedRedemptions: Redemption[]
  reviewedCompletions: Completion[]
  resolvedCurseInstances: CurseInstance[]
  actions: ParentActions
}

export function ApprovalsTab({
  pendingCompletions,
  pendingRedemptions,
  approvedRedemptions,
  reviewedCompletions,
  resolvedCurseInstances,
  actions,
}: Props) {
  type ReviewedItem =
    | { kind: 'completion'; ts: string; item: Completion }
    | { kind: 'redemption'; ts: string; item: Redemption }
    | { kind: 'curse'; ts: string; item: CurseInstance }

  const reviewed: ReviewedItem[] = [
    ...reviewedCompletions.map((c) => ({ kind: 'completion' as const, ts: c.completed_at, item: c })),
    ...approvedRedemptions.map((r) => ({ kind: 'redemption' as const, ts: r.redeemed_at, item: r })),
    ...resolvedCurseInstances.map((ci) => ({ kind: 'curse' as const, ts: ci.resolved_at ?? ci.cast_at, item: ci })),
  ].sort((a, b) => b.ts.localeCompare(a.ts))

  return (
    <motion.div key="approvals" {...fadeSlide} className="flex flex-col gap-4">
      {pendingRedemptions.length > 0 && (
        <div>
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Reward requests</p>
          <div className="flex flex-col gap-2">
            {pendingRedemptions.map((r) => {
              const kid = r.kid as Kid | undefined
              const reward = r.reward as Reward | undefined
              if (!kid || !reward) return null
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}
                >
                  <span className="text-2xl">{reward.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm font-semibold truncate">{reward.title}</p>
                    <p className="text-white/45 text-xs">
                      <span>{kid.avatar}</span> {kid.name} · 🪙 {reward.cost} coins
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => actions.fulfillRedemption(r.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80' }}
                    >
                      ✓ Give
                    </button>
                    <button
                      onClick={() => actions.denyRedemption(r.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {pendingCompletions.length === 0 ? (
        <Empty
          icon="✅"
          message={pendingRedemptions.length === 0 ? 'All clear — nothing pending!' : 'No pending quests'}
        />
      ) : (
        pendingCompletions.map((c) => {
          const kid = c.kid as Kid | undefined
          if (!kid) return null
          return (
            <div key={c.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <span className="text-2xl">{kid.avatar}</span>
                <div>
                  <p className="font-semibold text-white/90 text-sm">{kid.name}</p>
                  <p className="text-white/40 text-xs">completed a quest · {formatQuestDate(c.date)}</p>
                </div>
                {kid.streak > 1 && (
                  <span className="ml-auto text-xs text-cq-ember">🔥 {kid.streak} streak</span>
                )}
              </div>
              <div className="px-4 pb-4">
                <QuestCard
                  quest={c.quest as Quest}
                  completion={c}
                  kidColor={kid.color}
                  isParent
                  onApprove={actions.approve}
                  onReject={actions.reject}
                />
              </div>
            </div>
          )
        })
      )}

      {reviewed.length > 0 && (
        <div>
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Review history</p>
          {reviewed.map((entry) => {
            if (entry.kind === 'completion') {
              const c = entry.item
              const kid = c.kid as Kid | undefined
              if (!kid) return null
              return (
                <div key={c.id} className="grid items-center gap-x-2 py-1.5" style={{ gridTemplateColumns: '1fr auto auto 1.5rem' }}>
                  <span className="text-sm truncate flex items-center gap-1.5 min-w-0">
                    <span className="text-base flex-shrink-0">{kid.avatar}</span>
                    <span className="text-white/50 flex-shrink-0">{kid.name}</span>
                    <span className="text-white/35 truncate">{(c.quest as Quest)?.title}</span>
                  </span>
                  <span className="text-white/25 text-xs whitespace-nowrap">{formatQuestDate(c.date)}</span>
                  <StatusChip status={c.status === 'approved' ? 'approved' : 'rejected'} />
                  <button
                    onClick={() => c.status === 'approved' ? actions.undoApproval(c.id) : actions.undoRejection(c.id)}
                    className="text-xs text-white/20 hover:text-cq-gold transition-all text-center w-6"
                    title="Undo"
                  >
                    ↩
                  </button>
                </div>
              )
            }
            if (entry.kind === 'curse') {
              const ci = entry.item
              const kid = ci.kid as Kid | undefined
              const curse = ci.curse as Curse | undefined
              if (!kid || !curse) return null
              return (
                <div key={ci.id} className="grid items-center gap-x-2 py-1.5" style={{ gridTemplateColumns: '1fr auto auto 1.5rem' }}>
                  <span className="text-sm truncate flex items-center gap-1.5 min-w-0">
                    <span className="text-base flex-shrink-0">{kid.avatar}</span>
                    <span className="text-white/50 flex-shrink-0">{kid.name}</span>
                    <span className="text-white/35 truncate flex items-center gap-1"><span>{curse.icon}</span>{curse.title}</span>
                  </span>
                  <span className="text-white/25 text-xs whitespace-nowrap">{ci.resolved_at ? formatQuestDate(ci.resolved_at.slice(0, 10)) : ''}</span>
                  <span className="text-xs font-semibold text-red-400 whitespace-nowrap">☠️ -{ci.coins_deducted}🪙</span>
                  <button
                    onClick={() => actions.undoResolvedCurse(ci.id)}
                    className="text-xs text-white/20 hover:text-cq-gold transition-all text-center w-6"
                    title="Undo"
                  >
                    ↩
                  </button>
                </div>
              )
            }
            const r = entry.item
            const kid = r.kid as Kid | undefined
            const reward = r.reward as Reward | undefined
            if (!kid || !reward) return null
            return (
              <div key={r.id} className="grid items-center gap-x-2 py-1.5" style={{ gridTemplateColumns: '1fr auto auto 1.5rem' }}>
                <span className="text-sm truncate flex items-center gap-1.5 min-w-0">
                  <span className="text-base flex-shrink-0">{kid.avatar}</span>
                  <span className="text-white/50 flex-shrink-0">{kid.name}</span>
                  <span className="text-white/35 truncate flex items-center gap-1"><span>{reward.icon}</span>{reward.title}</span>
                </span>
                <span className="text-white/25 text-xs whitespace-nowrap">{formatQuestDate(r.redeemed_at.slice(0, 10))}</span>
                <span className="text-xs font-semibold text-cq-gold whitespace-nowrap">🎁 -{reward.cost}🪙</span>
                <button
                  onClick={() => actions.undoRedemption(r.id)}
                  className="text-xs text-white/20 hover:text-cq-gold transition-all text-center w-6"
                  title="Undo"
                >
                  ↩
                </button>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
