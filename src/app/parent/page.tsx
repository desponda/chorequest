'use client'

export const dynamic = 'force-dynamic'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ParentSkeleton } from '@/components/skeletons'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import { RealmIcon } from '@/components/ui/realm-icon'
import { RealmEmblem, type RealmEmblemName } from '@/components/ui/realm-emblem'

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
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: Tab) => {
    const ids: Tab[] = ['approvals', 'quests', 'rewards', 'curses', 'dungeons', 'family']
    const currentIndex = ids.indexOf(current)
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % ids.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + ids.length) % ids.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = ids.length - 1
    else return

    event.preventDefault()
    const next = ids[nextIndex]
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  const pendingCompletions = data.completions.filter((c) => c.status === 'pending')
  const reviewedCompletions = data.completions.filter((c) => c.status !== 'pending')
  const pendingRedemptions = data.redemptions.filter((r) => r.status === 'pending')
  const reviewedRedemptions = data.redemptions.filter((r) => r.status === 'approved' || r.status === 'denied')

  if (data.loading) {
    return <ParentSkeleton />
  }

  if (data.error && !data.family) {
    return (
      <div className="min-h-screen cq-page-shell flex items-center justify-center px-4 text-center safe-top safe-bottom">
        <div className="relative z-10 max-w-sm">
          <div className="cq-hero-emblem h-14 w-14 flex items-center justify-center mx-auto mb-4 text-cq-azure" aria-hidden="true"><RealmEmblem name="spark" size={34} /></div>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">The command center is out of reach</h1>
          <p className="text-white/60 text-sm mb-6">{data.error}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={data.refetch}
              className="min-h-11 px-6 rounded-xl text-sm font-bold text-cq-gold"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              Try again
            </button>
            <Link href="/" className="min-h-11 inline-flex items-center rounded-xl px-3 text-sm text-white/60 hover:text-white/90 transition-colors">
              ← Back to ChoreQuest
            </Link>
          </div>
        </div>
      </div>
    )
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

  const tabs: { id: Tab; icon: RealmEmblemName; label: string; mobileLabel?: string; badge?: number }[] = [
    { id: 'approvals', icon: 'shield', label: 'Approvals', badge: pendingCompletions.length + pendingRedemptions.length },
    { id: 'quests', icon: 'quest', label: 'Quests' },
    { id: 'rewards', icon: 'reward', label: 'Rewards' },
    { id: 'curses', icon: 'curse', label: 'Coin adjustments', mobileLabel: 'Adjust', badge: data.activeCurseInstances.length || undefined },
    { id: 'dungeons', icon: 'dungeon', label: 'Challenges' },
    { id: 'family', icon: 'family', label: 'Family' },
  ]

  const qrKid = qrKidId ? data.kids.find((k) => k.id === qrKidId) ?? null : null

  return (
    <div className="min-h-screen cq-page-shell flex flex-col">
      <div className="workspace-frame workspace-frame-parent relative z-10 flex flex-col flex-1">
        <motion.header
          className="workspace-header cq-command-header safe-top grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6 pb-3 sm:pb-4 flex-shrink-0 border-b border-white/10 sm:border-b-0"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link
            href="/display"
            className="justify-self-start text-white/60 hover:text-white/90 transition-all text-sm flex-shrink-0 min-h-[44px] flex items-center px-1"
          >
            ← Realm
          </Link>
          <div className="text-center min-w-0">
            <span className="font-heading text-lg font-bold text-white/80">Parent Command</span>
          </div>
          <div className="justify-self-end flex items-center gap-1 flex-shrink-0">
            {data.family?.has_parent_pin && (
              <button
                onClick={lock.handleLock}
                className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-cq-gold transition-all text-lg rounded-lg"
                title="Lock parent area"
                aria-label="Lock parent area"
              >
                <RealmIcon name="🔒" size={18} />
              </button>
            )}
            <ConfirmDelete
              onConfirm={actions.signOut}
              trigger="Sign out"
              prompt="Sign out?"
              confirmLabel="Yes"
              ariaLabel="Sign out of the realm"
              className="text-sm text-white/45 hover:text-white/70 min-h-[44px] flex items-center px-2"
            />
          </div>
        </motion.header>

        <div
          className="workspace-tabs cq-command-tabs grid grid-cols-3 sm:grid-cols-6 gap-2 mx-4 sm:mx-6 my-3 sm:my-0 sm:mb-4 flex-shrink-0"
          role="tablist"
          aria-label="Parent dashboard sections"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(node) => { tabRefs.current[t.id] = node }}
              onClick={() => setTab(t.id)}
              onKeyDown={(event) => handleTabKeyDown(event, t.id)}
              role="tab"
              id={`parent-tab-${t.id}`}
              aria-controls={`parent-panel-${t.id}`}
              aria-selected={tab === t.id}
              aria-label={t.label}
              tabIndex={tab === t.id ? 0 : -1}
              className="relative min-w-0 min-h-11 sm:min-h-12 flex flex-row items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tab === t.id ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.025)',
                border: `1px solid ${tab === t.id ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.04)'}`,
                color: tab === t.id ? '#fbbf24' : 'rgba(255,255,255,0.68)',
              }}
            >
              {/* Mobile: icon + tiny label stacked */}
              <span className="sm:hidden leading-none text-cq-gold" aria-hidden="true"><RealmEmblem name={t.icon} size={18} /></span>
              <span className="sm:hidden text-[10px] font-bold tracking-wide uppercase leading-none">
                {t.mobileLabel ?? t.label}
              </span>
              {/* Desktop: icon + full label inline */}
              <span className="hidden sm:inline-flex items-center gap-1.5"><RealmEmblem name={t.icon} size={18} /> {t.label}</span>
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

        <main
          id={`parent-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`parent-tab-${tab}`}
          className="workspace-main workspace-main-parent flex-1 px-4 sm:px-6 pb-8 overflow-y-auto scrollbar-thin-glass safe-bottom"
        >
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
