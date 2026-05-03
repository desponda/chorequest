'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { QuestCard } from '@/components/quest-card'
import type { Kid, Quest, Completion, Reward, Family } from '@/lib/types'
import { KID_COLORS, KID_AVATARS, QUEST_ICONS, DEFAULT_QUESTS } from '@/lib/constants'
import { toast } from 'sonner'

const PARENT_PIN_SESSION_KEY = 'cq_parent_unlocked'

type Tab = 'approvals' | 'quests' | 'family' | 'rewards'

export default function ParentDashboard() {
  const [tab, setTab] = useState<Tab>('approvals')
  const [family, setFamily] = useState<Family | null>(null)
  const [kids, setKids] = useState<Kid[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)

  // Forms
  const [newKidName, setNewKidName] = useState('')
  const [newKidAvatar, setNewKidAvatar] = useState('🧙')
  const [newKidColor, setNewKidColor] = useState<'azure' | 'mystic'>('azure')
  const [newKidPin, setNewKidPin] = useState('')
  const [newQuestTitle, setNewQuestTitle] = useState('')
  const [newQuestDesc, setNewQuestDesc] = useState('')
  const [newQuestIcon, setNewQuestIcon] = useState('⚔️')
  const [newQuestCoins, setNewQuestCoins] = useState(10)
  const [newQuestFor, setNewQuestFor] = useState<string>('all')
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardDesc, setNewRewardDesc] = useState('')
  const [newRewardIcon, setNewRewardIcon] = useState('🎁')
  const [newRewardCost, setNewRewardCost] = useState(50)
  const [familyName, setFamilyName] = useState('')
  const [savingFamily, setSavingFamily] = useState(false)
  const [parentLocked, setParentLocked] = useState(false)
  const [lockPinInput, setLockPinInput] = useState('')
  const [lockPinError, setLockPinError] = useState(false)
  const [newParentPin, setNewParentPin] = useState('')
  const [savingParentPin, setSavingParentPin] = useState(false)

  const [supabase] = useState(createClient)
  const router = useRouter()

  const fetchData = useCallback(async () => {
    const { data: profile } = await supabase.from('profiles').select('family_id').single()
    if (!profile) return

    const today = new Date().toISOString().split('T')[0]

    const [familyRes, kidsRes, questsRes, completionsRes, rewardsRes] = await Promise.all([
      supabase.from('families').select('*').eq('id', profile.family_id).single(),
      supabase.from('kids').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('quests').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('completions').select('*, quest:quests(*), kid:kids(*)').eq('date', today).order('completed_at', { ascending: false }),
      supabase.from('rewards').select('*').eq('family_id', profile.family_id).order('created_at'),
    ])

    if (familyRes.data) {
      setFamily(familyRes.data)
      setFamilyName(familyRes.data.name)
      if (familyRes.data.parent_pin) {
        const unlocked = typeof window !== 'undefined'
          ? sessionStorage.getItem(PARENT_PIN_SESSION_KEY) === '1'
          : false
        if (!unlocked) setParentLocked(true)
      }
    }
    if (kidsRes.data) setKids(kidsRes.data)
    if (questsRes.data) setQuests(questsRes.data)
    if (completionsRes.data) setCompletions(completionsRes.data)
    if (rewardsRes.data) setRewards(rewardsRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel('parent-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData, supabase])

  const handleApprove = async (completionId: string) => {
    const completion = completions.find((c) => c.id === completionId)
    if (!completion) return

    const bonus = getStreakBonus(completion.kid?.streak ?? 0)
    const coinsAwarded = Math.round((completion.quest?.coins ?? 0) * bonus)

    const { error } = await supabase
      .from('completions')
      .update({ status: 'approved', approved_at: new Date().toISOString(), coins_awarded: coinsAwarded })
      .eq('id', completionId)

    if (!error) {
      await supabase
        .from('kids')
        .update({ coins: (completion.kid?.coins ?? 0) + coinsAwarded })
        .eq('id', completion.kid_id)

      const today = new Date().toISOString().split('T')[0]
      const lastDate = completion.kid?.last_completed_date
      const newStreak = lastDate === yesterday() ? (completion.kid?.streak ?? 0) + 1 : 1

      await supabase
        .from('kids')
        .update({ streak: newStreak, last_completed_date: today })
        .eq('id', completion.kid_id)

      toast.success(`Quest approved! +${coinsAwarded} coins awarded ✨`)
      await fetchData()
    }
  }

  const handleReject = async (completionId: string) => {
    await supabase
      .from('completions')
      .update({ status: 'rejected' })
      .eq('id', completionId)
    toast.success('Quest rejected')
    await fetchData()
  }

  const handleAddKid = async () => {
    if (!newKidName.trim() || newKidPin.length !== 4 || !family) return
    const { error } = await supabase.from('kids').insert({
      family_id: family.id,
      name: newKidName.trim(),
      avatar: newKidAvatar,
      color: newKidColor,
      pin: newKidPin,
    })
    if (!error) {
      toast.success(`${newKidName} joined the realm! 🎉`)
      setNewKidName('')
      setNewKidPin('')
      await fetchData()
    } else {
      toast.error('Failed to add adventurer')
    }
  }

  const handleAddQuest = async () => {
    if (!newQuestTitle.trim() || !family) return
    const { error } = await supabase.from('quests').insert({
      family_id: family.id,
      title: newQuestTitle.trim(),
      description: newQuestDesc.trim() || null,
      icon: newQuestIcon,
      coins: newQuestCoins,
      assigned_to: newQuestFor === 'all' ? null : newQuestFor,
      frequency: 'daily',
      active: true,
    })
    if (!error) {
      toast.success('Quest added to the board! ⚔️')
      setNewQuestTitle('')
      setNewQuestDesc('')
      await fetchData()
    } else {
      toast.error('Failed to add quest')
    }
  }

  const handleToggleQuest = async (questId: string, active: boolean) => {
    await supabase.from('quests').update({ active: !active }).eq('id', questId)
    await fetchData()
  }

  const handleDeleteQuest = async (questId: string) => {
    await supabase.from('quests').delete().eq('id', questId)
    await fetchData()
  }

  const handleAddReward = async () => {
    if (!newRewardTitle.trim() || !family) return
    const { error } = await supabase.from('rewards').insert({
      family_id: family.id,
      title: newRewardTitle.trim(),
      description: newRewardDesc.trim() || null,
      icon: newRewardIcon,
      cost: newRewardCost,
      available: true,
    })
    if (!error) {
      toast.success('Reward added to the store! 🎁')
      setNewRewardTitle('')
      setNewRewardDesc('')
      await fetchData()
    }
  }

  const handleSaveFamilyName = async () => {
    if (!family || !familyName.trim()) return
    setSavingFamily(true)
    await supabase.from('families').update({ name: familyName.trim() }).eq('id', family.id)
    setSavingFamily(false)
    toast.success('Realm name updated!')
    await fetchData()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleSeedDefaultQuests = async () => {
    if (!family) return
    await supabase.from('quests').insert(
      DEFAULT_QUESTS.map((q) => ({ ...q, family_id: family.id, frequency: 'daily' as const, active: true }))
    )
    toast.success('Default quests added! ✨')
    await fetchData()
  }

  const handleParentPinDigit = (digit: string) => {
    const next = lockPinInput + digit
    setLockPinInput(next)
    if (next.length === 4) {
      if (family?.parent_pin && next === family.parent_pin) {
        sessionStorage.setItem(PARENT_PIN_SESSION_KEY, '1')
        setParentLocked(false)
        setLockPinError(false)
        setLockPinInput('')
      } else {
        setLockPinError(true)
        setTimeout(() => {
          setLockPinInput('')
          setLockPinError(false)
        }, 700)
      }
    }
  }

  const handleLock = () => {
    sessionStorage.removeItem(PARENT_PIN_SESSION_KEY)
    setParentLocked(true)
    setLockPinInput('')
  }

  const handleSaveParentPin = async () => {
    if (!family || newParentPin.length !== 4) return
    setSavingParentPin(true)
    const { error } = await supabase
      .from('families')
      .update({ parent_pin: newParentPin })
      .eq('id', family.id)
    if (!error) {
      sessionStorage.setItem(PARENT_PIN_SESSION_KEY, '1')
      setNewParentPin('')
      toast.success('Parent lock PIN set! 🔒')
      await fetchData()
    } else {
      toast.error('Failed to set PIN')
    }
    setSavingParentPin(false)
  }

  const handleRemoveParentPin = async () => {
    if (!family) return
    await supabase.from('families').update({ parent_pin: null }).eq('id', family.id)
    sessionStorage.removeItem(PARENT_PIN_SESSION_KEY)
    toast.success('Parent lock removed')
    await fetchData()
  }

  const pendingCompletions = completions.filter((c) => c.status === 'pending')

  if (loading) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center">
        <StarField />
        <motion.p
          className="relative z-10 font-heading text-2xl text-white/40"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✦ Loading ✦
        </motion.p>
      </div>
    )
  }

  if (parentLocked) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center px-4">
        <StarField />
        <motion.div
          className="relative z-10 w-full max-w-xs text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.span
            className="text-6xl block mb-4"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            🔒
          </motion.span>
          <h2 className="font-heading text-3xl font-bold text-white mb-1">Parent Command</h2>
          <p className="text-white/40 text-sm mb-8">Enter your parent PIN</p>

          <div className="flex justify-center gap-4 mb-8">
            {Array.from({ length: 4 }, (_, i) => (
              <motion.div
                key={i}
                className="w-4 h-4 rounded-full border-2"
                style={{
                  borderColor: lockPinError ? '#f87171' : 'rgba(251,191,36,0.5)',
                  background: lockPinInput.length > i
                    ? (lockPinError ? '#f87171' : '#fbbf24')
                    : 'transparent',
                }}
                animate={lockPinError ? { x: [-4, 4, -4, 4, 0] } : {}}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d) => (
              <motion.button
                key={d}
                onClick={() => {
                  if (d === '⌫') {
                    setLockPinInput((p) => p.slice(0, -1))
                    setLockPinError(false)
                  } else if (d && lockPinInput.length < 4) {
                    handleParentPinDigit(d)
                  }
                }}
                disabled={!d}
                className="h-14 rounded-2xl font-heading font-bold text-xl transition-all disabled:opacity-0"
                style={{
                  background: d ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: d ? '1px solid rgba(255,255,255,0.09)' : 'none',
                  color: d === '⌫' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
                }}
                whileHover={d ? { background: 'rgba(251,191,36,0.12)' } : {}}
                whileTap={d ? { scale: 0.93 } : {}}
              >
                {d}
              </motion.button>
            ))}
          </div>

          <Link href="/" className="block mt-8 text-white/25 text-sm hover:text-white/50 transition-all">
            ← Back to Realm
          </Link>
        </motion.div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'approvals', label: '✓ Approvals', badge: pendingCompletions.length },
    { id: 'quests', label: '⚔️ Quests' },
    { id: 'family', label: '👨‍👩‍👧 Family' },
    { id: 'rewards', label: '🎁 Rewards' },
  ]

  return (
    <div className="min-h-screen bg-quest-void flex flex-col">
      <StarField />

      <div className="relative z-10 flex flex-col flex-1 w-full max-w-2xl mx-auto">
      {/* Header */}
      <motion.header
        className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link href="/" className="text-white/40 hover:text-white/70 transition-all text-sm flex-shrink-0">
          ← Realm
        </Link>
        <div className="flex-1 text-center">
          <span className="font-heading text-lg font-bold text-white/80">Parent Command</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {family?.parent_pin && (
            <button
              onClick={handleLock}
              className="text-white/30 hover:text-cq-gold transition-all text-lg"
              title="Lock parent area"
            >
              🔒
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="text-white/30 hover:text-white/60 transition-all text-sm"
          >
            Sign out
          </button>
        </div>
      </motion.header>

      {/* Tab nav */}
      <div className="flex gap-2 px-6 py-4 overflow-x-auto flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tab === t.id ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${tab === t.id ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: tab === t.id ? '#fbbf24' : 'rgba(255,255,255,0.5)',
            }}
          >
            {t.label}
            {t.badge && t.badge > 0 ? (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: '#fbbf24', color: '#0a0620' }}
              >
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 px-6 pb-8 overflow-y-auto scrollbar-thin-glass">
        <AnimatePresence mode="wait">
          {tab === 'approvals' && (
            <motion.div key="approvals" {...fadeSlide} className="flex flex-col gap-4">
              {pendingCompletions.length === 0 ? (
                <Empty icon="✅" message="All clear — no pending quests!" />
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
                          onApprove={handleApprove}
                          onReject={handleReject}
                        />
                      </div>
                    </div>
                  )
                })
              )}

              {completions.filter((c) => c.status !== 'pending').length > 0 && (
                <div>
                  <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Reviewed today</p>
                  {completions
                    .filter((c) => c.status !== 'pending')
                    .map((c) => {
                      const kid = c.kid as Kid | undefined
                      if (!kid) return null
                      return (
                        <div key={c.id} className="flex items-center gap-3 py-2 opacity-50">
                          <span>{kid.avatar}</span>
                          <span className="text-white/60 text-sm">{kid.name}</span>
                          <span className="text-white/40 text-sm flex-1">{(c.quest as Quest)?.title}</span>
                          <span className={`text-xs font-semibold ${c.status === 'approved' ? 'text-cq-forest' : 'text-red-400'}`}>
                            {c.status === 'approved' ? `✓ +${c.coins_awarded}🪙` : '✗'}
                          </span>
                        </div>
                      )
                    })}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'quests' && (
            <motion.div key="quests" {...fadeSlide} className="flex flex-col gap-6">
              {/* Add quest form */}
              <Section title="Add New Quest">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {QUEST_ICONS.slice(0, 14).map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setNewQuestIcon(icon)}
                        className="text-xl w-10 h-10 rounded-xl transition-all"
                        style={{
                          background: newQuestIcon === icon ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${newQuestIcon === icon ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <FormInput placeholder="Quest title..." value={newQuestTitle} onChange={setNewQuestTitle} />
                  <FormInput placeholder="Description (optional)" value={newQuestDesc} onChange={setNewQuestDesc} />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-white/40 mb-1 block">Coins</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={newQuestCoins}
                        onChange={(e) => setNewQuestCoins(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-white/40 mb-1 block">For</label>
                      <select
                        value={newQuestFor}
                        onChange={(e) => setNewQuestFor(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                        style={{ background: 'rgba(12,8,32,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <option value="all">All kids</option>
                        {kids.map((k) => (
                          <option key={k.id} value={k.id}>{k.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <ActionButton onClick={handleAddQuest} label="+ Add Quest" />
                </div>
              </Section>

              {/* Seed defaults */}
              {quests.length === 0 && (
                <button
                  onClick={handleSeedDefaultQuests}
                  className="text-sm text-white/40 hover:text-white/70 transition-all text-center underline underline-offset-4"
                >
                  Or add default starter quests →
                </button>
              )}

              {/* Quest list */}
              <Section title="Active Quests">
                {quests.filter((q) => q.active).length === 0 ? (
                  <Empty icon="⚔️" message="No active quests" />
                ) : (
                  quests.filter((q) => q.active).map((q) => (
                    <QuestRow key={q.id} quest={q} kids={kids} onToggle={handleToggleQuest} onDelete={handleDeleteQuest} />
                  ))
                )}
              </Section>

              {quests.filter((q) => !q.active).length > 0 && (
                <Section title="Archived Quests">
                  {quests.filter((q) => !q.active).map((q) => (
                    <QuestRow key={q.id} quest={q} kids={kids} onToggle={handleToggleQuest} onDelete={handleDeleteQuest} />
                  ))}
                </Section>
              )}
            </motion.div>
          )}

          {tab === 'family' && (
            <motion.div key="family" {...fadeSlide} className="flex flex-col gap-6">
              {/* Realm name */}
              <Section title="Realm Name">
                <div className="flex gap-2">
                  <FormInput
                    placeholder="Family name..."
                    value={familyName}
                    onChange={setFamilyName}
                    className="flex-1"
                  />
                  <ActionButton
                    onClick={handleSaveFamilyName}
                    label={savingFamily ? '...' : 'Save'}
                    className="flex-shrink-0 px-5"
                  />
                </div>
              </Section>

              {/* Parent lock */}
              <Section title="Parent Lock">
                {family?.parent_pin ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔒</span>
                      <div className="flex-1">
                        <p className="text-white/80 text-sm font-semibold">Parent lock is active</p>
                        <p className="text-white/40 text-xs">Kids cannot access this area</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="tel"
                          maxLength={4}
                          pattern="[0-9]{4}"
                          placeholder="New 4-digit PIN"
                          value={newParentPin}
                          onChange={(e) => setNewParentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none tracking-widest"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </div>
                      <ActionButton
                        onClick={handleSaveParentPin}
                        label={savingParentPin ? '...' : 'Change'}
                        disabled={newParentPin.length !== 4 || savingParentPin}
                        className="flex-shrink-0 px-5"
                      />
                    </div>
                    <button
                      onClick={handleRemoveParentPin}
                      className="text-xs text-white/30 hover:text-red-400 transition-all text-center"
                    >
                      Remove parent lock
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-white/50 text-sm">
                      Set a PIN so kids can&apos;t access this area on a shared device.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="tel"
                          maxLength={4}
                          pattern="[0-9]{4}"
                          placeholder="4-digit PIN"
                          value={newParentPin}
                          onChange={(e) => setNewParentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none tracking-widest"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </div>
                      <ActionButton
                        onClick={handleSaveParentPin}
                        label={savingParentPin ? '...' : 'Set PIN'}
                        disabled={newParentPin.length !== 4 || savingParentPin}
                        className="flex-shrink-0 px-5"
                      />
                    </div>
                  </div>
                )}
              </Section>

              {/* Add kid */}
              <Section title="Add Adventurer">
                <div className="flex flex-col gap-3">
                  <FormInput placeholder="Name..." value={newKidName} onChange={setNewKidName} />

                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Avatar</label>
                    <div className="flex flex-wrap gap-2">
                      {KID_AVATARS.map((av) => (
                        <button
                          key={av}
                          onClick={() => setNewKidAvatar(av)}
                          className="text-2xl w-10 h-10 rounded-xl transition-all"
                          style={{
                            background: newKidAvatar === av ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${newKidAvatar === av ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Color Theme</label>
                    <div className="flex gap-2">
                      {(['azure', 'mystic'] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewKidColor(c)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize"
                          style={{
                            background: newKidColor === c ? KID_COLORS[c].bg : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${newKidColor === c ? KID_COLORS[c].border : 'rgba(255,255,255,0.08)'}`,
                            color: newKidColor === c ? KID_COLORS[c].primary : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          <span className="w-3 h-3 rounded-full" style={{ background: KID_COLORS[c].primary }} />
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">4-Digit PIN</label>
                    <input
                      type="tel"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      placeholder="e.g. 1234"
                      value={newKidPin}
                      onChange={(e) => setNewKidPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none tracking-widest"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>

                  <ActionButton
                    onClick={handleAddKid}
                    label="+ Add Adventurer"
                    disabled={!newKidName.trim() || newKidPin.length !== 4}
                  />
                </div>
              </Section>

              {/* Kid list */}
              <Section title="Your Adventurers">
                {kids.length === 0 ? (
                  <Empty icon="🧙" message="No adventurers yet" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {kids.map((kid) => {
                      const colors = KID_COLORS[kid.color]
                      return (
                        <div
                          key={kid.id}
                          className="flex items-center gap-4 p-4 rounded-2xl"
                          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                        >
                          <span className="text-3xl">{kid.avatar}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-white/90">{kid.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: colors.primary }}>
                              🪙 {kid.coins} coins · 🔥 {kid.streak} streak · Lv {Math.floor(kid.coins / 50) + 1}
                            </p>
                          </div>
                          <span className="text-xs text-white/30 font-mono">PIN: {kid.pin}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
            </motion.div>
          )}

          {tab === 'rewards' && (
            <motion.div key="rewards" {...fadeSlide} className="flex flex-col gap-6">
              <Section title="Add Reward">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {['🎁', '🎮', '📱', '🍕', '🎬', '🎡', '🎪', '🛒', '💤', '🎯', '🎨', '🎵'].map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setNewRewardIcon(icon)}
                        className="text-xl w-10 h-10 rounded-xl transition-all"
                        style={{
                          background: newRewardIcon === icon ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${newRewardIcon === icon ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <FormInput placeholder="Reward title..." value={newRewardTitle} onChange={setNewRewardTitle} />
                  <FormInput placeholder="Description (optional)" value={newRewardDesc} onChange={setNewRewardDesc} />
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Coin cost</label>
                    <input
                      type="number"
                      min={1}
                      value={newRewardCost}
                      onChange={(e) => setNewRewardCost(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <ActionButton onClick={handleAddReward} label="+ Add Reward" />
                </div>
              </Section>

              <Section title="Reward Store">
                {rewards.length === 0 ? (
                  <Empty icon="🎁" message="No rewards yet" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {rewards.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <span className="text-2xl">{r.icon}</span>
                        <div className="flex-1">
                          <p className="text-white/90 text-sm font-semibold">{r.title}</p>
                          {r.description && <p className="text-white/40 text-xs">{r.description}</p>}
                        </div>
                        <span className="text-cq-gold text-sm font-bold font-heading">🪙 {r.cost}</span>
                        <button
                          onClick={async () => {
                            await supabase.from('rewards').delete().eq('id', r.id)
                            await fetchData()
                          }}
                          className="text-white/20 hover:text-red-400 transition-all text-xs ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">{title}</p>
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {children}
      </div>
    </div>
  )
}

function Empty({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="text-center py-8 text-white/30">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-sm">{message}</p>
    </div>
  )
}

function FormInput({
  placeholder, value, onChange, className = ''
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
    />
  )
}

function ActionButton({
  onClick, label, disabled = false, className = 'w-full'
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`${className} py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40`}
      style={{
        background: 'rgba(251, 191, 36, 0.15)',
        border: '1px solid rgba(251, 191, 36, 0.35)',
        color: '#fbbf24',
      }}
      whileHover={{ background: 'rgba(251, 191, 36, 0.22)' }}
      whileTap={{ scale: 0.98 }}
    >
      {label}
    </motion.button>
  )
}

function QuestRow({
  quest, kids, onToggle, onDelete
}: {
  quest: Quest
  kids: Kid[]
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}) {
  const assignedKid = kids.find((k) => k.id === quest.assigned_to)
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl mb-2"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <span className="text-xl">{quest.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${quest.active ? 'text-white/90' : 'text-white/40 line-through'}`}>
          {quest.title}
        </p>
        <p className="text-white/35 text-xs">
          🪙 {quest.coins} · {assignedKid ? assignedKid.name : 'All kids'}
        </p>
      </div>
      <button
        onClick={() => onToggle(quest.id, quest.active)}
        className="text-xs px-2.5 py-1 rounded-lg transition-all"
        style={{
          background: quest.active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
          color: quest.active ? '#4ade80' : 'rgba(255,255,255,0.35)',
        }}
      >
        {quest.active ? 'On' : 'Off'}
      </button>
      <button
        onClick={() => onDelete(quest.id)}
        className="text-white/20 hover:text-red-400 transition-all text-xs ml-1"
      >
        ✕
      </button>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStreakBonus(streak: number): number {
  if (streak >= 14) return 2.0
  if (streak >= 7) return 1.5
  if (streak >= 3) return 1.25
  return 1.0
}

function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 },
}
