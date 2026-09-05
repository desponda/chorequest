'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Quest, Completion, KidColor } from '@/lib/types'
import { KID_COLORS, TIER_CONFIG } from '@/lib/constants'
import { CoinBurst } from './coin-burst'
import { TierBadge } from './ui/tier-badge'
import { RealmIcon } from './ui/realm-icon'
import { CoinMark } from './ui/realm-emblem'

interface QuestCardProps {
  quest: Quest
  completion?: Completion
  /** For shared quests, how many family-wide claims this period (across all kids). */
  sharedClaimed?: number
  /** Locked because the shared period is fully claimed and this kid hasn't claimed. */
  isShareLocked?: boolean
  kidColor: KidColor
  onComplete?: () => Promise<void>
  onUndo?: () => Promise<void>
  isParent?: boolean
  onApprove?: (completionId: string) => Promise<void>
  onReject?: (completionId: string) => Promise<void>
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function cadenceLabel(quest: Quest): string | null {
  if (quest.kind === 'oneoff') return 'one-time'
  if (quest.kind === 'shared') {
    const period = quest.frequency === 'weekly' ? 'week' : 'day'
    if (quest.slots > 1) return `${quest.slots}× per ${period} · first to claim`
    return `${quest.frequency} · first to claim`
  }
  // personal
  if (quest.frequency === 'weekly') return 'weekly'
  return null
}

export function QuestCard({
  quest,
  completion,
  sharedClaimed = 0,
  isShareLocked = false,
  kidColor,
  onComplete,
  onUndo,
  isParent,
  onApprove,
  onReject,
}: QuestCardProps) {
  const [loading, setLoading] = useState(false)
  const [bursting, setBursting] = useState(false)
  const colors = KID_COLORS[kidColor]

  const isShared = quest.kind === 'shared' || quest.kind === 'oneoff'
  const status = completion?.status
  const isTodo = !isShareLocked && !status
  const isPending = status === 'pending'
  const isApproved = status === 'approved'
  const isRejected = status === 'rejected'

  const tier = TIER_CONFIG[quest.tier ?? 'normal']
  const isNormal = (quest.tier ?? 'normal') === 'normal'
  const hasCompletionState = isApproved || isPending || isRejected || isShareLocked

  const cardBg = isApproved
    ? 'rgba(74, 222, 128, 0.06)'
    : isPending
    ? 'rgba(251, 191, 36, 0.06)'
    : isRejected
    ? 'rgba(239, 68, 68, 0.05)'
    : isShareLocked
    ? 'rgba(255,255,255,0.02)'
    : tier.bg

  const cardBorder = isApproved
    ? 'rgba(74, 222, 128, 0.25)'
    : isPending
    ? 'rgba(251, 191, 36, 0.35)'
    : isRejected
    ? 'rgba(239, 68, 68, 0.2)'
    : isShareLocked
    ? 'rgba(255,255,255,0.06)'
    : tier.border

  const cardShadow = isPending
    ? '0 0 20px rgba(251, 191, 36, 0.12)'
    : isApproved
    ? '0 0 16px rgba(74, 222, 128, 0.1)'
    : isShareLocked
    ? 'none'
    : tier.glow ?? 'none'

  const freqLabel = cadenceLabel(quest)
  const hasActiveDays = quest.active_days && quest.active_days.length > 0 && quest.active_days.length < 7
  const hasSecondLine = !isNormal || freqLabel || hasActiveDays || (isShared && quest.kind === 'shared' && quest.slots > 0)

  const handleComplete = async () => {
    if (!onComplete || loading || (!isTodo && !isRejected)) return
    setLoading(true)
    setBursting(true)
    await onComplete()
    setLoading(false)
    setTimeout(() => setBursting(false), 1000)
  }

  const actionLabel = loading ? 'Submitting' : isRejected ? 'Retry' : isShared ? 'Claim' : 'Complete'
  const actionIcon = loading ? '✨' : isRejected ? '↺' : isShared ? '⚡' : '⚔️'
  const actionAriaLabel = loading ? 'Submitting quest' : isRejected ? 'Retry quest' : isShared ? 'Claim quest' : 'Mark quest done'
  const kidRgb = kidColor === 'azure' ? '56,189,248' : '167,139,250'

  return (
    <motion.div
      className="cq-quest-card relative rounded-2xl overflow-hidden"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        backdropFilter: 'blur(4px)',
        opacity: isShareLocked ? 0.45 : 1,
      }}
      whileHover={isTodo && onComplete ? { boxShadow: `0 0 0 2px rgba(${kidRgb}, 0.5), 0 8px 28px rgba(${kidRgb}, 0.18)` } : {}}
      whileTap={isTodo && onComplete ? { boxShadow: `0 0 0 1px rgba(${kidRgb}, 0.3)` } : {}}
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <CoinBurst coins={quest.coins} active={bursting} />

      {!isNormal && !hasCompletionState && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${tier.color} 40%, ${tier.color} 60%, transparent 100%)`,
            opacity: 0.8,
          }}
        />
      )}

      {quest.tier === 'legendary' && !hasCompletionState && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
          initial={{ x: '-120%' }}
          animate={{ x: '220%' }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
        >
          <div
            className="absolute inset-y-0 w-1/3 -skew-x-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.1), transparent)' }}
          />
        </motion.div>
      )}

      {quest.tier === 'epic' && !hasCompletionState && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
          initial={{ x: '-120%' }}
          animate={{ x: '220%' }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 7, ease: 'easeInOut' }}
        >
          <div
            className="absolute inset-y-0 w-1/3 -skew-x-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.12), transparent)' }}
          />
        </motion.div>
      )}

      <div className="px-3 py-2.5">
        {/* Single row: icon | title+badge | action | coins */}
        <div className="flex items-center gap-2.5">
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${kidRgb}, 0.11)`, color: colors.primary }}
            aria-hidden="true"
          >
            <RealmIcon name={quest.icon} size={18} />
          </span>

          {/* Title + tier badge, flex-1 truncates long titles */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <p
                className={`font-semibold text-sm leading-snug truncate ${
                  isApproved ? 'text-white/60' : isShareLocked ? 'text-white/35' : 'text-white/90'
                }`}
              >
                {quest.title}
              </p>
              <TierBadge tier={quest.tier} className="max-[359px]:hidden" />
            </div>

            {hasSecondLine && (
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {!isNormal && (
                  <TierBadge tier={quest.tier} className="min-[360px]:hidden" />
                )}
                {freqLabel && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {freqLabel}
                  </span>
                )}
                {hasActiveDays && (
                  <div className="flex gap-0.5">
                    {DAY_LABELS.map((label, i) => (
                      <span
                        key={i}
                        className="text-[9px] w-3.5 h-3.5 flex items-center justify-center rounded font-mono"
                        style={{
                          background: quest.active_days!.includes(i) ? 'rgba(255,255,255,0.12)' : 'transparent',
                          color: quest.active_days!.includes(i) ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)',
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {isShared && quest.kind === 'shared' && quest.slots > 0 && (
                  <span
                    className="text-[10px]"
                    style={{ color: sharedClaimed >= quest.slots ? '#4ade80' : 'rgba(255,255,255,0.4)' }}
                  >
                    {sharedClaimed >= quest.slots ? '✓ ' : ''}{sharedClaimed}/{quest.slots} claimed
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right side: truly fixed columns — inline styles + flexShrink:0 bypass flex shrink bugs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Action slot: fixed 96px, content right-aligned */}
            <div className="quest-action-slot" data-testid="quest-action-slot" style={{ width: '96px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
              {(isTodo || isRejected) && onComplete ? (
                <motion.button
                  data-testid="quest-action-content"
                  onClick={handleComplete}
                  disabled={loading}
                  aria-label={actionAriaLabel}
                  className="min-h-11 min-w-11 text-sm px-3 py-2 rounded-xl font-bold transition-all disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, rgba(${kidRgb}, 0.16), rgba(${kidRgb}, 0.06))`,
                    border: `1px solid ${colors.border}`,
                    color: colors.primary,
                  }}
                  whileHover={{ background: `linear-gradient(135deg, rgba(${kidRgb}, 0.26), rgba(${kidRgb}, 0.10))` }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="quest-action-label-full inline-flex items-center gap-1.5">
                    <RealmIcon name={actionIcon} size={15} strokeWidth={2.2} />
                    {actionLabel}
                  </span>
                  <span className="quest-action-label-short" aria-hidden="true">
                    <RealmIcon name={actionIcon} size={17} strokeWidth={2.2} />
                  </span>
                </motion.button>
              ) : (isPending || isApproved || isShareLocked) ? (
                <>
                  {/* Status pill — same height as the action button so card rhythm stays consistent. */}
                  {isPending ? (
                    <motion.span
                      data-testid="quest-action-content"
                      role="status"
                      aria-label="Awaiting approval"
                      className="min-h-11 min-w-11 inline-flex items-center justify-center text-sm px-3 py-2 rounded-xl font-semibold whitespace-nowrap"
                      style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                      animate={{ opacity: [0.6, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                    >
                      <span className="quest-action-label-full inline-flex items-center gap-1.5"><RealmIcon name="⏳" size={17} /> Pending</span>
                      <span className="quest-action-label-short" aria-hidden="true"><RealmIcon name="⏳" size={17} /></span>
                    </motion.span>
                  ) : isApproved ? (
                    <span
                      data-testid="quest-action-content"
                      className="min-h-11 min-w-11 inline-flex items-center justify-center text-sm px-3 py-2 rounded-xl font-semibold whitespace-nowrap"
                      style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                    >
                      <span className="quest-action-label-full inline-flex items-center gap-1.5"><RealmIcon name="✓" size={15} /> Earned</span>
                      <span className="quest-action-label-short" aria-hidden="true"><RealmIcon name="✓" size={17} /></span>
                    </span>
                  ) : (
                    <span
                      data-testid="quest-action-content"
                      className="min-h-11 min-w-11 inline-flex items-center justify-center text-sm px-3 py-2 rounded-xl font-semibold whitespace-nowrap"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}
                    >
                      <span className="quest-action-label-full">Claimed</span>
                      <span className="quest-action-label-short" aria-hidden="true"><span className="text-base leading-none">—</span></span>
                    </span>
                  )}
                  {!isParent && isPending && onUndo && (
                    <motion.button
                      onClick={async () => { setLoading(true); await onUndo(); setLoading(false) }}
                      disabled={loading}
                      className="quest-undo-button min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-sm text-white/55 transition-all disabled:opacity-40"
                      whileHover={{ color: 'rgba(255,255,255,0.65)' }}
                      whileTap={{ scale: 0.9 }}
                      title="Undo submission"
                      aria-label="Undo quest submission"
                    >
                      <RealmIcon name="↩" size={17} />
                    </motion.button>
                  )}
                </>
              ) : null}
            </div>

            {/* Coin mark stays fixed-width so the amount remains visually aligned. */}
            <div className="quest-coin-slot" style={{ width: '56px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <span data-testid="quest-coin-icon" className="flex items-center justify-center" style={{ width: '18px', flexShrink: 0, color: '#fbbf24' }}>
                <CoinMark size={16} />
              </span>
              <span className="font-heading font-bold text-sm" style={{ flex: 1, textAlign: 'right', color: isNormal ? '#fbbf24' : tier.color }}>
                +{quest.coins}
              </span>
            </div>
          </div>
        </div>

        {/* Parent approve/reject panel */}
        {isParent && isPending && completion && (
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => onApprove?.(completion.id)}
              className="min-h-11 flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: 'rgba(74, 222, 128, 0.12)',
                border: '1px solid rgba(74, 222, 128, 0.28)',
                color: '#4ade80',
              }}
            >
              <span className="inline-flex items-center justify-center gap-1.5"><RealmIcon name="✓" size={15} /> Approve</span>
            </button>
            <button
              onClick={() => onReject?.(completion.id)}
              className="min-h-11 flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                color: '#f87171',
              }}
            >
              <span className="inline-flex items-center justify-center gap-1.5"><RealmIcon name="✗" size={15} /> Reject</span>
            </button>
          </div>
        )}
      </div>

      {isApproved && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, transparent 0%, rgba(74,222,128,0.04) 100%)',
          }}
        />
      )}
    </motion.div>
  )
}
