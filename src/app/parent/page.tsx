'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { StarField } from '@/components/star-field'
import { LoadingScreen } from '@/components/loading-screen'

import { useParentData } from './use-parent-data'
import { useParentActions } from './use-parent-actions'
import { useParentPinLock } from './use-parent-pin-lock'
import { PinLockScreen } from './pin-lock-screen'
import { QrModal } from './qr-modal'
import { ApprovalsTab } from './approvals-tab'
import { QuestsTab } from './quests-tab'
import { RewardsTab } from './rewards-tab'
import { CursesTab } from './curses-tab'
import { FamilyTab } from './family-tab'
import { DungeonsTab } from './dungeons-tab'

type Tab = 'approvals' | 'quests' | 'family' | 'rewards' | 'curses' | 'dungeons'

export default function ParentDashboard() {
  const data = useParentData()
  const actions = useParentActions(data)
  const lock = useParentPinLock(data.family)

  const [tab, setTab] = useState<Tab>('approvals')
  const [qrKidId, setQrKidId] = useState<string | null>(null)

  const pendingCompletions = data.completions.filter((c) => c.status === 'pending')
  const reviewedCompletions = data.completions.filter((c) => c.status !== 'pending')
  const pendingRedemptions = data.redemptions.filter((r) => r.status === 'pending')
  const reviewedRedemptions = data.redemptions.filter((r) => r.status === 'approved' || r.status === 'denied')

  if (data.loading) {
    return <LoadingScreen />
  }

  if (lock.parentLocked) {
    return (
      <PinLockScreen
        lockPinInput={lock.lockPinInput}
        lockPinError={lock.lockPinError}
        parentLockedUntil={lock.parentLockedUntil}
        now={lock.now}
        onDigit={lock.handleParentPinDigit}
        onBackspace={() => {
          lock.setLockPinInput((p) => p.slice(0, -1))
          lock.setLockPinError(false)
        }}
      />
    )
  }

  const tabs: { id: Tab; icon: string; label: string; badge?: number }[] = [
    { id: 'approvals', icon: '✓', label: 'Approvals', badge: pendingCompletions.length + pendingRedemptions.length },
    { id: 'quests', icon: '⚔️', label: 'Quests' },
    { id: 'rewards', icon: '🎁', label: 'Rewards' },
    { id: 'curses', icon: '☠️', label: 'Curses', badge: data.activeCurseInstances.length || undefined },
    { id: 'dungeons', icon: '🏰', label: 'Dungeons' },
    { id: 'family', icon: '👨‍👩‍👧', label: 'Family' },
  ]

  const qrKid = qrKidId ? data.kids.find((k) => k.id === qrKidId) ?? null : null

  return (
    <div className="min-h-screen bg-quest-void flex flex-col">
      <StarField />

      <div className="relative z-10 flex flex-col flex-1 w-full max-w-2xl mx-auto">
        <motion.header
          className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link href="/display" className="text-white/40 hover:text-white/70 transition-all text-sm flex-shrink-0">
            ← Realm
          </Link>
          <div className="flex-1 text-center">
            <span className="font-heading text-lg font-bold text-white/80">Parent Command</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {data.family?.has_parent_pin && (
              <button
                onClick={lock.handleLock}
                className="text-white/30 hover:text-cq-gold transition-all text-lg"
                title="Lock parent area"
              >
                🔒
              </button>
            )}
            <button
              onClick={actions.signOut}
              className="text-white/30 hover:text-white/60 transition-all text-sm"
            >
              Sign out
            </button>
          </div>
        </motion.header>

        <div
          className="flex gap-1.5 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0"
          role="tablist"
          aria-label="Parent dashboard sections"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
              aria-label={t.label}
              className="relative flex-1 min-w-0 min-h-[48px] sm:min-h-0 flex sm:flex-row flex-col items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-1.5 sm:py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tab === t.id ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${tab === t.id ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: tab === t.id ? '#fbbf24' : 'rgba(255,255,255,0.5)',
              }}
            >
              {/* Mobile: icon + tiny label stacked */}
              <span className="sm:hidden text-base leading-none">{t.icon}</span>
              <span className="sm:hidden text-[9px] font-bold tracking-wide uppercase leading-none mt-0.5">
                {t.label}
              </span>
              {/* Desktop: icon + full label inline */}
              <span className="hidden sm:inline">{t.icon} {t.label}</span>
              {/* Desktop badge: inline pill */}
              {t.badge && t.badge > 0 ? (
                <>
                  <span
                    className="hidden sm:inline px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: '#fbbf24', color: '#0a0620' }}
                  >
                    {t.badge}
                  </span>
                  {/* Mobile badge: corner dot */}
                  <span
                    className="sm:hidden absolute top-0.5 right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[8px] font-bold leading-none px-0.5"
                    style={{ background: '#fbbf24', color: '#0a0620' }}
                    aria-label={`${t.badge} pending`}
                  >
                    {t.badge}
                  </span>
                </>
              ) : null}
            </button>
          ))}
        </div>

        <main className="flex-1 px-6 pb-8 overflow-y-auto scrollbar-thin-glass">
          <AnimatePresence mode="wait">
            {tab === 'approvals' && (
              <ApprovalsTab
                pendingCompletions={pendingCompletions}
                pendingRedemptions={pendingRedemptions}
                reviewedRedemptions={reviewedRedemptions}
                reviewedCompletions={reviewedCompletions}
                resolvedCurseInstances={data.resolvedCurseInstances}
                actions={actions}
              />
            )}
            {tab === 'quests' && (
              <QuestsTab kids={data.kids} quests={data.quests} actions={actions} plan={data.family?.plan ?? 'free'} />
            )}
            {tab === 'rewards' && (
              <RewardsTab rewards={data.rewards} actions={actions} plan={data.family?.plan ?? 'free'} />
            )}
            {tab === 'curses' && (
              <CursesTab
                kids={data.kids}
                curses={data.curses}
                activeCurseInstances={data.activeCurseInstances}
                actions={actions}
                plan={data.family?.plan ?? 'free'}
              />
            )}
            {tab === 'dungeons' && (
              <DungeonsTab
                activeDungeon={data.activeDungeon}
                dungeonClears={data.dungeonClears}
                weeklyCompletions={data.weeklyCompletions}
                kids={data.kids}
                activeBoss={data.activeBoss}
                pastDungeons={data.pastDungeons}
                defeatedBosses={data.defeatedBosses}
                actions={actions}
              />
            )}
            {tab === 'family' && (
              <FamilyTab
                family={data.family}
                kids={data.kids}
                onShowQr={setQrKidId}
                actions={actions}
              />
            )}
          </AnimatePresence>
        </main>
      </div>

      <QrModal kid={qrKid} onClose={() => setQrKidId(null)} />
    </div>
  )
}
