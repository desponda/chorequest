'use client'

import { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { StarField } from '@/components/star-field'
import { useEscapeToClose } from '@/lib/use-escape-to-close'

// ─── Scroll-reveal wrapper ────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

// ─── Static app mockup shown in the hero ────────────────────────────────────
function AppMockup() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden w-full max-w-2xl mx-auto"
      style={{
        background: 'rgba(5,3,16,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 0 80px rgba(56,189,248,0.08), 0 0 120px rgba(167,139,250,0.06), 0 40px 80px rgba(0,0,0,0.6)',
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <span className="font-heading text-sm font-bold tracking-widest text-cq-gold">ChoreQuest</span>
        <span className="text-white/30 text-xs tracking-widest uppercase">The Rivera Realm</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cq-gold opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cq-gold" />
          </span>
          2 pending
        </div>
      </div>

      {/* Two kid columns */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {/* Emma — azure */}
        <MockKidColumn
          name="Emma" avatar="🧙‍♀️" color="azure"
          coins={340} streak={7}
          quests={[
            { title: 'Make your bed', icon: '🛏️', coins: 15, status: 'approved' },
            { title: 'Feed the cat', icon: '🐱', coins: 20, status: 'pending', tier: 'rare' },
            { title: 'Clean desk', icon: '📚', coins: 25, status: 'todo' },
          ]}
        />
        {/* Liam — mystic */}
        <MockKidColumn
          name="Liam" avatar="🧝‍♂️" color="mystic"
          coins={210} streak={3}
          quests={[
            { title: 'Take out trash', icon: '🗑️', coins: 30, status: 'approved', tier: 'rare' },
            { title: 'Unload dishwasher', icon: '🍽️', coins: 20, status: 'todo' },
            { title: 'Vacuum living room', icon: '🧹', coins: 50, status: 'todo', tier: 'legendary' },
          ]}
        />
      </div>

      {/* Bounty board strip */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-px" style={{ background: 'rgba(251,191,36,0.15)' }} />
          <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: 'rgba(251,191,36,0.7)' }}>
            ⚡ Bounty Board
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(251,191,36,0.15)' }} />
        </div>
        <div className="flex gap-2">
          <MockBountyCard title="Wash the car" icon="🚗" coins={100} claimed={0} slots={1} tier="epic" />
          <MockBountyCard title="Mow the lawn" icon="🌿" coins={75} claimed={1} slots={2} tier="legendary" />
        </div>
      </div>
    </div>
  )
}

type QuestStatus = 'todo' | 'pending' | 'approved'
type QuestTier = 'normal' | 'rare' | 'epic' | 'legendary'

const TIER_COLORS: Record<QuestTier, string> = {
  normal: '#fbbf24',
  rare: '#38bdf8',
  epic: '#a78bfa',
  legendary: '#fbbf24',
}

function MockKidColumn({ name, avatar, color, coins, streak, quests }: {
  name: string; avatar: string; color: 'azure' | 'mystic'
  coins: number; streak: number
  quests: { title: string; icon: string; coins: number; status: QuestStatus; tier?: QuestTier }[]
}) {
  const primary = color === 'azure' ? '#38bdf8' : '#a78bfa'
  const bg = color === 'azure' ? 'rgba(56,189,248,0.07)' : 'rgba(167,139,250,0.07)'
  const border = color === 'azure' ? 'rgba(56,189,248,0.25)' : 'rgba(167,139,250,0.25)'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}` }}>
      {/* Kid header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b" style={{ borderColor: `${primary}20` }}>
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{avatar}</span>
          <span className="font-heading text-sm font-bold" style={{ color: primary }}>{name}</span>
          {streak >= 3 && <span className="text-xs text-cq-ember">🔥{streak}</span>}
        </div>
        <span className="text-xs font-bold text-cq-gold">🪙{coins}</span>
      </div>
      {/* Quest list */}
      <div className="p-2 flex flex-col gap-1.5">
        {quests.map((q, i) => {
          const tier = (q.tier ?? 'normal') as QuestTier
          const tc = TIER_COLORS[tier]
          const statusBg = q.status === 'approved' ? 'rgba(74,222,128,0.07)' : q.status === 'pending' ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)'
          const statusBorder = q.status === 'approved' ? 'rgba(74,222,128,0.2)' : q.status === 'pending' ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.07)'
          return (
            <div key={i} className="rounded-lg px-2.5 py-2 flex items-center gap-2"
              style={{ background: statusBg, border: `1px solid ${statusBorder}` }}>
              <span className="text-sm">{q.icon}</span>
              <span className="flex-1 text-xs font-medium truncate" style={{
                color: q.status === 'approved' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)',
                textDecoration: q.status === 'approved' ? 'line-through' : 'none',
              }}>{q.title}</span>
              {q.status === 'pending' ? (
                <motion.span className="text-[10px] text-amber-400"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.6, repeat: Infinity }}>⏳</motion.span>
              ) : q.status === 'approved' ? (
                <span className="text-[10px] text-cq-forest">✓</span>
              ) : (
                <span className="text-[10px] font-bold" style={{ color: tc }}>🪙{q.coins}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MockBountyCard({ title, icon, coins, claimed, slots, tier }: {
  title: string; icon: string; coins: number; claimed: number; slots: number; tier: QuestTier
}) {
  const tc = TIER_COLORS[tier]
  const isFull = claimed >= slots
  return (
    <div className="flex-1 rounded-xl p-2.5" style={{
      background: isFull ? 'rgba(255,255,255,0.02)' : `${tc}10`,
      border: `1px solid ${isFull ? 'rgba(255,255,255,0.06)' : `${tc}30`}`,
      opacity: isFull ? 0.5 : 1,
    }}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-bold" style={{ color: tc }}>🪙{coins}</span>
      </div>
      <p className="text-xs font-semibold text-white/80 leading-tight mb-1">{title}</p>
      <span className="text-[10px]" style={{ color: isFull ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
        {isFull ? '✓ claimed' : `${claimed}/${slots} taken`}
      </span>
    </div>
  )
}

// ─── Feature cards ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '🖥️',
    title: 'Live Wall Display',
    desc: 'Put it on your TV or tablet. Every quest, every kid, updating in real time — the whole family can see who\'s crushing it.',
    color: '#38bdf8',
  },
  {
    icon: '⭐',
    title: 'Quest Tiers',
    desc: 'Normal, Heroic, Legendary, Epic. Bigger jobs earn bigger coins. Kids learn that effort has a reward scale.',
    color: '#fbbf24',
  },
  {
    icon: '🔥',
    title: 'Streak Multipliers',
    desc: '3-day streak: +25% coins. 7-day: 1.5×. 14-day: double coins. The longer they go, the more they earn.',
    color: '#fb923c',
  },
  {
    icon: '⚡',
    title: 'Family Bounty Board',
    desc: 'Shared quests siblings compete for. First to claim a slot wins — natural motivation without parent nagging.',
    color: '#a78bfa',
  },
  {
    icon: '🎁',
    title: 'Custom Reward Store',
    desc: 'You set the prizes: screen time, a trip to the movies, a new toy. Real-world rewards make coins matter.',
    color: '#4ade80',
  },
  {
    icon: '🔒',
    title: 'PIN Protection',
    desc: 'Every kid gets their own PIN. Parents lock their dashboard separately. No accidental approvals, no meddling.',
    color: '#38bdf8',
  },
]

const HOW_IT_WORKS = [
  { step: '01', icon: '🗡️', title: 'You set the quests', desc: 'Create daily or weekly quests for each kid — or shared bounties the whole family can race to complete.' },
  { step: '02', icon: '⚔️', title: 'Kids complete their board', desc: 'Each kid logs in with their PIN and taps quests done. The wall display updates instantly for the whole family to see.' },
  { step: '03', icon: '🪙', title: 'Earn coins, claim rewards', desc: 'You approve completed quests and coins are awarded. Kids redeem coins from your custom reward store.' },
]

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeNav = () => setMobileNavOpen(false)
  useEscapeToClose(mobileNavOpen, closeNav)

  return (
    <div className="min-h-screen bg-quest-void text-white overflow-x-hidden">
      <StarField />

      {/* ── Nav ── */}
      <header
        className="safe-top fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-2 px-3 sm:px-6 pb-3 sm:pb-4"
        style={{ background: 'rgba(5,3,16,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">⚔️</span>
          <span className="font-heading font-bold text-lg tracking-widest text-white/90">ChoreQuest</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/45 font-medium">
          <a href="#how-it-works" className="hover:text-white/80 transition-colors">How It Works</a>
          <a href="#features" className="hover:text-white/80 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white/80 transition-colors">Pricing</a>
          <Link href="/blog" className="hover:text-white/80 transition-colors">Blog</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center whitespace-nowrap px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}
          >
            Start Free →
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen((o) => !o)}
            className="md:hidden w-11 h-11 flex flex-col items-center justify-center gap-1.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-panel"
          >
            <span
              className="block w-4 h-px bg-white/70 transition-transform"
              style={mobileNavOpen ? { transform: 'translateY(3px) rotate(45deg)' } : undefined}
            />
            <span
              className="block w-4 h-px bg-white/70 transition-transform"
              style={mobileNavOpen ? { transform: 'translateY(-3px) rotate(-45deg)' } : undefined}
            />
          </button>
        </div>
      </header>

      {/* Mobile nav panel */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            id="mobile-nav-panel"
            className="fixed inset-x-0 top-[calc(68px+env(safe-area-inset-top))] z-40 md:hidden px-4"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <nav
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: 'rgba(10,6,28,0.96)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              }}
            >
              {[
                { href: '#how-it-works', label: 'How It Works' },
                { href: '#features', label: 'Features' },
                { href: '#pricing', label: 'Pricing' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeNav}
                  className="px-5 py-4 text-white/75 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors text-base font-medium"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/blog"
                onClick={closeNav}
                className="px-5 py-4 text-white/75 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors text-base font-medium"
              >
                Blog
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero ── */}
      <section className="relative z-10 pt-32 pb-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(251,191,36,0.9)' }}
        >
          ✦ The chore app kids actually want to use
        </motion.div>

        <motion.h1
          className="font-heading font-black text-5xl sm:text-7xl leading-none tracking-tight mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <span className="text-white/90">Turn chores into</span>
          <br />
          <span
            className="inline-block mt-1"
            style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #fb923c 50%, #fbbf24 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200%',
            }}
          >
            Legendary Quests
          </span>
        </motion.h1>

        <motion.p
          className="text-white/50 text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          A fantasy quest board that makes your kids compete to help around the house — with real-time family displays, coin rewards, and streak bonuses.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <Link
            href="/login"
            className="group w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.12))',
              border: '1px solid rgba(251,191,36,0.45)',
              color: '#fbbf24',
              boxShadow: '0 0 30px rgba(251,191,36,0.12)',
            }}
          >
            Start for free — no credit card
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-semibold text-white/50 hover:text-white/80 transition-all glass border-glass"
          >
            See how it works ↓
          </a>
        </motion.div>

        {/* App mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {/* Glow behind mockup */}
          <div
            className="absolute inset-0 -z-10 blur-3xl opacity-30"
            style={{ background: 'radial-gradient(ellipse at center, rgba(56,189,248,0.4) 0%, rgba(167,139,250,0.3) 50%, transparent 70%)' }}
          />
          <AppMockup />
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="relative z-10 scroll-mt-20 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30 mb-3">The System</p>
            <h2 className="font-heading text-4xl sm:text-5xl font-bold text-white/90">Three steps to a calmer home</h2>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.step} delay={i * 0.1}>
                <div
                  className="rounded-2xl p-7 h-full"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <span
                      className="font-heading text-xs font-bold tracking-widest px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: 'rgba(251,191,36,0.7)' }}
                    >
                      {step.step}
                    </span>
                    <span className="text-2xl">{step.icon}</span>
                  </div>
                  <h3 className="font-heading text-lg font-bold text-white/90 mb-3">{step.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 scroll-mt-20 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30 mb-3">Everything you need</p>
            <h2 className="font-heading text-4xl sm:text-5xl font-bold text-white/90">Built different, on purpose</h2>
            <p className="text-white/40 mt-4 max-w-lg mx-auto">Every other chore app looks like a spreadsheet. ChoreQuest looks like the game your kids already play.</p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.07}>
                <div
                  className="rounded-2xl p-6 h-full group hover:scale-[1.02] transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${f.color}08 0%, rgba(255,255,255,0.02) 100%)`,
                    border: `1px solid ${f.color}20`,
                  }}
                >
                  <span className="text-3xl block mb-4">{f.icon}</span>
                  <h3 className="font-heading text-base font-bold mb-2" style={{ color: f.color }}>{f.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── For parents / for kids ── */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="font-heading text-4xl sm:text-5xl font-bold text-white/90">Designed for both sides</h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Parents */}
            <Reveal>
              <div
                className="rounded-2xl p-8 h-full"
                style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.18)' }}
              >
                <p className="text-xs font-bold tracking-[0.3em] uppercase text-cq-gold/60 mb-4">For Parents</p>
                <h3 className="font-heading text-2xl font-bold text-white/90 mb-6">Full control, less nagging</h3>
                <ul className="flex flex-col gap-3">
                  {[
                    '✓ Create quests with tiers, schedules, and coins',
                    '✓ Approve or reject completions with one tap',
                    '✓ Set a custom reward store with real-world prizes',
                    '✓ PIN-lock your dashboard so kids stay out',
                    '✓ Cast "curses" — deduct coins for bad behavior',
                    '✓ Invite kids via QR code or share link',
                  ].map(item => (
                    <li key={item} className="text-white/55 text-sm flex gap-2.5">
                      <span className="text-cq-gold/70 flex-shrink-0">{item.slice(0, 1)}</span>
                      <span>{item.slice(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Kids */}
            <Reveal delay={0.1}>
              <div
                className="rounded-2xl p-8 h-full"
                style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.18)' }}
              >
                <p className="text-xs font-bold tracking-[0.3em] uppercase text-cq-mystic/60 mb-4">For Kids</p>
                <h3 className="font-heading text-2xl font-bold text-white/90 mb-6">Their own realm to conquer</h3>
                <ul className="flex flex-col gap-3">
                  {[
                    '✓ Personal PIN — their space is theirs',
                    '✓ Quest board sorted by daily and weekly goals',
                    '✓ Watch coins build up in real time',
                    '✓ Redeem coins for rewards parents actually give',
                    '✓ Streak flames show daily consistency',
                    '✓ Race siblings for shared bounty quests',
                  ].map(item => (
                    <li key={item} className="text-white/55 text-sm flex gap-2.5">
                      <span className="text-cq-mystic/70 flex-shrink-0">{item.slice(0, 1)}</span>
                      <span>{item.slice(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 scroll-mt-20 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30 mb-3">Pricing</p>
            <h2 className="font-heading text-4xl sm:text-5xl font-bold text-white/90">Simple, honest pricing</h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Free */}
            <Reveal>
              <div
                className="rounded-2xl p-8 h-full"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <p className="font-heading text-xs tracking-widest uppercase text-white/35 mb-2">Free</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-heading text-5xl font-black text-white/90">$0</span>
                  <span className="text-white/30 text-sm">/ forever</span>
                </div>
                <p className="text-white/35 text-sm mb-8">Everything you need to run the realm</p>
                <ul className="flex flex-col gap-2.5 mb-8">
                  {[
                    'Up to 5 kids', 'Unlimited quests', 'All quest tiers', 'Custom rewards',
                    'Wall display', 'Streak system', 'Bounty board', 'Family invite links',
                  ].map(f => (
                    <li key={f} className="text-white/55 text-sm flex items-center gap-2">
                      <span className="text-cq-forest text-xs">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className="block w-full text-center px-6 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}
                >
                  Get started free
                </Link>
              </div>
            </Reveal>

            {/* Pro */}
            <Reveal delay={0.1}>
              <div
                className="rounded-2xl p-8 h-full relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.03) 100%)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  boxShadow: '0 0 40px rgba(251,191,36,0.06)',
                }}
              >
                <div
                  className="absolute top-4 right-4 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                >
                  Coming soon
                </div>
                <p className="font-heading text-xs tracking-widest uppercase text-cq-gold/50 mb-2">Family Pro</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-heading text-5xl font-black text-cq-gold">$5</span>
                  <span className="text-white/30 text-sm">/ month</span>
                </div>
                <p className="text-white/35 text-sm mb-8">For power families who want more</p>
                <ul className="flex flex-col gap-2.5 mb-8">
                  {[
                    'Everything in Free',
                    'Unlimited kids',
                    'Quest completion history',
                    'Coin analytics & charts',
                    'Custom realm themes',
                    'Multiple families / households',
                    'Priority support',
                    'Early access to new features',
                  ].map(f => (
                    <li key={f} className="text-white/55 text-sm flex items-center gap-2">
                      <span className="text-cq-gold/60 text-xs">✦</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  className="block w-full text-center px-6 py-3 rounded-xl font-bold text-sm opacity-50 cursor-not-allowed"
                  style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}
                >
                  Notify me when available
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="relative z-10 py-24 px-6">
        <Reveal>
          <div
            className="max-w-2xl mx-auto rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(167,139,250,0.08) 100%)',
              border: '1px solid rgba(251,191,36,0.25)',
              boxShadow: '0 0 60px rgba(251,191,36,0.06)',
            }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ x: '-120%' }}
              animate={{ x: '220%' }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 6, ease: 'easeInOut' }}
            >
              <div
                className="absolute inset-y-0 w-1/3 -skew-x-12"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.06), transparent)' }}
              />
            </motion.div>
            <p className="text-4xl mb-5">🏰</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white/90 mb-4">
              Ready to begin the quest?
            </h2>
            <p className="text-white/45 mb-8 max-w-md mx-auto">
              Free forever. No credit card. Set up your family realm in under 5 minutes.
            </p>
            <Link
              href="/login"
              className="inline-block px-10 py-4 rounded-2xl text-base font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.28), rgba(251,191,36,0.14))',
                border: '1px solid rgba(251,191,36,0.5)',
                color: '#fbbf24',
                boxShadow: '0 0 30px rgba(251,191,36,0.15)',
              }}
            >
              Create your realm — it&apos;s free →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 py-12 px-6"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚔️</span>
            <span className="font-heading font-bold tracking-widest text-white/60">ChoreQuest</span>
          </div>
          <p className="text-white/25 text-sm text-center">
            No ads. No tracking. Family-safe. Built with love for our own chaotic household.
          </p>
          <div className="flex items-center gap-5 text-white/30 text-sm">
            <Link href="/blog" className="hover:text-white/60 transition-colors">Blog</Link>
            <Link href="/login" className="hover:text-white/60 transition-colors">Sign in</Link>
            <Link href="/login" className="hover:text-white/60 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
