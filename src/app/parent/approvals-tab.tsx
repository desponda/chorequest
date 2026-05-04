'use client'

import { motion } from 'framer-motion'
import { QuestCard } from '@/components/quest-card'
import type { Kid, Quest, Completion, Reward, Redemption } from '@/lib/types'
import { Empty, fadeSlide } from './_ui'
import type { ParentActions } from './use-parent-actions'

interface Props {
  pendingCompletions: Completion[]
  pendingRedemptions: Redemption[]
  approvedRedemptions: Redemption[]
  reviewedCompletions: Completion[]
  actions: ParentActions
}

export function ApprovalsTab({
  pendingCompletions,
  pendingRedemptions,
  approvedRedemptions,
  reviewedCompletions,
  actions,
}: Props) {
  type ReviewedItem =
    | { kind: 'completion'; ts: string; item: Completion }
    | { kind: 'redemption'; ts: string; item: Redemption }

  const reviewed: ReviewedItem[] = [
    ...reviewedCompletions.map((c) => ({ kind: 'completion' as const, ts: c.completed_at, item: c })),
    ...approvedRedemptions.map((r) => ({ kind: 'redemption' as const, ts: r.redeemed_at, item: r })),
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
                  <p className="text-white/40 text-xs">completed a quest</p>
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
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Reviewed today</p>
          {reviewed.map((entry) => {
            if (entry.kind === 'completion') {
              const c = entry.item
              const kid = c.kid as Kid | undefined
              if (!kid) return null
              return (
                <div key={c.id} className="flex items-center gap-3 py-2">
                  <span className="text-lg">{kid.avatar}</span>
                  <span className="text-white/50 text-sm">{kid.name}</span>
                  <span className="text-white/35 text-sm flex-1 truncate">{(c.quest as Quest)?.title}</span>
                  <span className={`text-xs font-semibold flex-shrink-0 ${c.status === 'approved' ? 'text-cq-forest' : 'text-red-400'}`}>
                    {c.status === 'approved' ? `✓ +${c.coins_awarded}🪙` : '✗'}
                  </span>
                  <button
                    onClick={() => c.status === 'approved' ? actions.undoApproval(c.id) : actions.undoRejection(c.id)}
                    className="text-xs text-white/20 hover:text-cq-gold transition-all flex-shrink-0 ml-1"
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
              <div key={r.id} className="flex items-center gap-3 py-2">
                <span className="text-lg">{kid.avatar}</span>
                <span className="text-white/50 text-sm">{kid.name}</span>
                <span className="text-white/35 text-sm flex-1 truncate flex items-center gap-1.5"><span>{reward.icon}</span> {reward.title}</span>
                <span className="text-xs font-semibold flex-shrink-0 text-cq-gold">
                  🎁 -{reward.cost}🪙
                </span>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
