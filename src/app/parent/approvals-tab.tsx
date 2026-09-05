'use client'

import { motion } from 'framer-motion'
import { QuestCard } from '@/components/quest-card'
import type { Kid, Quest, Completion, Reward, Redemption, CurseInstance, Curse } from '@/lib/types'
import { Empty, fadeSlide } from './_ui'
import type { ParentActions } from './use-parent-actions'
import { RealmIcon } from '@/components/ui/realm-icon'
import { CoinMark } from '@/components/ui/realm-emblem'

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
  reviewedRedemptions: Redemption[]
  reviewedCompletions: Completion[]
  resolvedCurseInstances: CurseInstance[]
  actions: ParentActions
}

type OutcomeTone = 'positive' | 'negative' | 'gold' | 'muted'

function ReviewOutcome({
  amount,
  label,
  tone,
}: {
  amount?: number
  label?: string
  tone: OutcomeTone
}) {
  const styles: Record<OutcomeTone, { color: string; background: string; border: string }> = {
    positive: { color: '#86efac', background: 'rgba(74,222,128,0.09)', border: 'rgba(74,222,128,0.2)' },
    negative: { color: '#fca5a5', background: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.18)' },
    gold: { color: '#fbbf24', background: 'rgba(251,191,36,0.09)', border: 'rgba(251,191,36,0.2)' },
    muted: { color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
  }
  const style = styles[tone]

  return (
    <span
      className="inline-flex items-center justify-end gap-1 rounded-lg border px-2 py-1 text-xs font-bold whitespace-nowrap"
      style={{ color: style.color, background: style.background, borderColor: style.border }}
    >
      {amount !== undefined ? (
        <>
          <span>{amount > 0 ? `+${amount.toLocaleString()}` : amount.toLocaleString()}</span>
          <CoinMark size={13} />
        </>
      ) : label}
    </span>
  )
}

function ReviewRow({
  icon,
  title,
  meta,
  date,
  outcome,
  outcomeTone,
  onUndo,
  undoLabel,
}: {
  icon: string
  title: string
  meta: string
  date: string
  outcome: { amount?: number; label?: string }
  outcomeTone: OutcomeTone
  onUndo?: () => void
  undoLabel: string
}) {
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 sm:gap-x-5 px-4 sm:px-5 py-3 transition-colors hover:bg-white/[0.025]">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="h-9 w-9 rounded-xl flex-shrink-0 inline-flex items-center justify-center"
          style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.16)' }}
          aria-hidden="true"
        >
          <RealmIcon name={icon} size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/85 truncate">{title}</p>
          <p className="text-xs text-white/45 truncate mt-0.5">{meta}</p>
        </div>
      </div>
      <div className="flex min-w-[5.5rem] flex-col items-end gap-1">
        <span className="text-xs text-white/40 whitespace-nowrap">{date}</span>
        <ReviewOutcome {...outcome} tone={outcomeTone} />
      </div>
      {onUndo ? (
        <button
          onClick={onUndo}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-white/45 hover:text-cq-gold hover:bg-white/[0.06] transition-all"
          title={undoLabel}
          aria-label={undoLabel}
        >
          <RealmIcon name="↩" size={15} />
        </button>
      ) : (
        <span className="min-h-11 min-w-11" aria-hidden="true" />
      )}
    </div>
  )
}

export function ApprovalsTab({
  pendingCompletions,
  pendingRedemptions,
  reviewedRedemptions,
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
    ...reviewedRedemptions.map((r) => ({ kind: 'redemption' as const, ts: r.redeemed_at, item: r })),
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
                  <span className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}><RealmIcon name={reward.icon} size={21} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm font-semibold truncate">{reward.title}</p>
                    <p className="text-white/45 text-xs">
                      <span className="inline-flex items-center gap-1.5"><RealmIcon name={kid.avatar} size={14} /> {kid.name} · <RealmIcon name="🪙" size={12} /> {r.cost_charged ?? reward.cost} coins</span>
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => actions.fulfillRedemption(r.id)}
                      className="min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80' }}
                    >
                      <span className="inline-flex items-center gap-1.5"><RealmIcon name="✓" size={14} /> Give</span>
                    </button>
                    <button
                      onClick={() => actions.denyRedemption(r.id)}
                      className="min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                    >
                      <RealmIcon name="✗" size={15} />
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
          icon="✓"
          message={pendingRedemptions.length === 0 ? 'All clear — nothing pending!' : 'No pending quests'}
          hint={
            pendingRedemptions.length === 0
              ? 'Submissions from kids will show up here for you to approve or reject.'
              : undefined
          }
        />
      ) : (
        pendingCompletions.map((c) => {
          const kid = c.kid as Kid | undefined
          if (!kid) return null
          const pendingQuest = c.quest as Quest
          const questAtSubmission = {
            ...pendingQuest,
            coins: c.coins_requested ?? pendingQuest.coins,
          }
          return (
            <div key={c.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${kid.color === 'azure' ? 'rgba(56,189,248,0.12)' : 'rgba(167,139,250,0.12)'}`, color: kid.color === 'azure' ? '#38bdf8' : '#a78bfa' }}><RealmIcon name={kid.avatar} size={19} /></span>
                <div>
                  <p className="font-semibold text-white/90 text-sm">{kid.name}</p>
                  <p className="text-white/40 text-xs">completed a quest · {formatQuestDate(c.date)}</p>
                </div>
                {kid.streak > 1 && (
                  <span className="ml-auto text-xs text-cq-ember inline-flex items-center gap-1"><RealmIcon name="🔥" size={13} /> {kid.streak} streak</span>
                )}
              </div>
              <div className="px-4 pb-4">
                <QuestCard
                  quest={questAtSubmission}
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
        <section className="surface-panel rounded-2xl overflow-hidden max-w-5xl" aria-labelledby="review-history-title">
          <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/10">
            <div>
              <h2 id="review-history-title" className="text-xs font-bold uppercase tracking-widest text-white/65">Review history</h2>
              <p className="text-xs text-white/40 mt-1">Recent approvals, rewards, and adjustments</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/55 whitespace-nowrap">
              {reviewed.length} {reviewed.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {reviewed.map((entry) => {
            if (entry.kind === 'completion') {
              const c = entry.item
              const kid = c.kid as Kid | undefined
              if (!kid) return null
              const quest = c.quest as Quest | undefined
              const coins = c.coins_awarded ?? c.coins_requested ?? quest?.coins ?? 0
              return (
                <ReviewRow
                  key={c.id}
                  icon={quest?.icon ?? kid.avatar}
                  title={quest?.title ?? 'Quest completion'}
                  meta={`${kid.name} · ${c.status === 'approved' ? 'Approved quest' : 'Marked for retry'}`}
                  date={formatQuestDate(c.date)}
                  outcome={c.status === 'approved' ? { amount: coins } : { label: 'Rejected' }}
                  outcomeTone={c.status === 'approved' ? 'positive' : 'negative'}
                  onUndo={() => c.status === 'approved' ? actions.undoApproval(c.id) : actions.undoRejection(c.id)}
                  undoLabel={c.status === 'approved' ? 'Undo approval' : 'Undo rejection'}
                />
              )
            }
            if (entry.kind === 'curse') {
              const ci = entry.item
              const kid = ci.kid as Kid | undefined
              const curse = ci.curse as Curse | undefined
              if (!kid || !curse) return null
              return (
                <ReviewRow
                  key={ci.id}
                  icon={curse.icon}
                  title={curse.title}
                  meta={`${kid.name} · Coin adjustment`}
                  date={ci.resolved_at ? formatQuestDate(ci.resolved_at.slice(0, 10)) : 'Resolved'}
                  outcome={{ amount: -ci.coins_deducted }}
                  outcomeTone="negative"
                  onUndo={() => actions.undoResolvedCurse(ci.id)}
                  undoLabel="Undo coin adjustment"
                />
              )
            }
            const r = entry.item
            const kid = r.kid as Kid | undefined
            const reward = r.reward as Reward | undefined
            if (!kid || !reward) return null
            return (
              <ReviewRow
                key={r.id}
                icon={reward.icon}
                title={reward.title}
                meta={`${kid.name} · ${r.status === 'approved' ? 'Reward redeemed' : 'Reward denied'}`}
                date={formatQuestDate((r.processed_at ?? r.redeemed_at).slice(0, 10))}
                outcome={r.status === 'approved' ? { amount: -(r.cost_charged ?? reward.cost) } : { label: 'Denied' }}
                outcomeTone={r.status === 'approved' ? 'gold' : 'negative'}
                undoLabel="No action available"
              />
            )
            })}
          </div>
        </section>
      )}
    </motion.div>
  )
}
