'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { QuestCard } from '@/components/quest-card'
import type { Kid, Quest, Completion, Reward, Redemption, Family, Curse, CurseInstance } from '@/lib/types'
import { KID_COLORS, KID_AVATARS, QUEST_ICONS, DEFAULT_QUESTS, TIER_CONFIG, getLockDurationMs } from '@/lib/constants'
import { questDateString } from '@/lib/utils'
import type { QuestTier } from '@/lib/types'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'

const PARENT_PIN_SESSION_KEY = 'cq_parent_unlocked'

type Tab = 'approvals' | 'quests' | 'family' | 'rewards' | 'curses'

export default function ParentDashboard() {
  const [tab, setTab] = useState<Tab>('approvals')
  const [family, setFamily] = useState<Family | null>(null)
  const [kids, setKids] = useState<Kid[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [curses, setCurses] = useState<Curse[]>([])
  const [activeCurseInstances, setActiveCurseInstances] = useState<CurseInstance[]>([])
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
  const [newQuestFrequency, setNewQuestFrequency] = useState<'daily' | 'once'>('daily')
  const [newQuestTier, setNewQuestTier] = useState<QuestTier>('normal')
  const [qrKidId, setQrKidId] = useState<string | null>(null)
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardDesc, setNewRewardDesc] = useState('')
  const [newRewardIcon, setNewRewardIcon] = useState('🎁')
  const [newRewardCost, setNewRewardCost] = useState(50)
  const [newCurseTitle, setNewCurseTitle] = useState('')
  const [newCurseIcon, setNewCurseIcon] = useState('☠️')
  const [newCursePenalty, setNewCursePenalty] = useState(10)
  const [castingCurseId, setCastingCurseId] = useState<string | null>(null)
  const [familyName, setFamilyName] = useState('')
  const [savingFamily, setSavingFamily] = useState(false)
  const [parentLocked, setParentLocked] = useState(false)
  const [lockPinInput, setLockPinInput] = useState('')
  const [lockPinError, setLockPinError] = useState(false)
  const [newParentPin, setNewParentPin] = useState('')
  const [savingParentPin, setSavingParentPin] = useState(false)
  const [editingCoinsKidId, setEditingCoinsKidId] = useState<string | null>(null)
  const [editCoinsValue, setEditCoinsValue] = useState('')
  const [revealPinKidId, setRevealPinKidId] = useState<string | null>(null)
  const [parentPinAttempts, setParentPinAttempts] = useState(0)
  const [parentLockedUntil, setParentLockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [supabase] = useState(createClient)
  const router = useRouter()
  const hasCheckedParentPin = useRef(false)

  const fetchData = useCallback(async () => {
    const { data: profile } = await supabase.from('profiles').select('family_id').single()
    if (!profile) return

    // Fetch reset hour first so today is always computed against the correct boundary
    const { data: resetData } = await supabase.from('families').select('daily_reset_hour').eq('id', profile.family_id).single()
    const today = questDateString(resetData?.daily_reset_hour ?? 0)

    const kidCols = 'id, name, avatar, color, coins, streak, last_completed_date, family_id, created_at'

    const [familyRes, kidsRes, questsRes, completionsRes, rewardsRes, redemptionsRes, cursesRes, curseInstancesRes] = await Promise.all([
      supabase.from('families').select('id, name, invite_token, api_key, daily_reset_hour, created_at, parent_pin').eq('id', profile.family_id).single(),
      supabase.from('kids').select(kidCols).eq('family_id', profile.family_id).order('created_at'),
      supabase.from('quests').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('completions').select(`*, quest:quests(*), kid:kids(${kidCols})`).eq('date', today).order('completed_at', { ascending: false }),
      supabase.from('rewards').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('redemptions').select(`*, reward:rewards(*), kid:kids(${kidCols})`).eq('status', 'pending').order('redeemed_at', { ascending: false }),
      supabase.from('curses').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('curse_instances').select(`*, curse:curses(*), kid:kids(${kidCols})`).eq('status', 'active').order('cast_at', { ascending: false }),
    ])

    if (familyRes.data) {
      const { parent_pin, ...rest } = familyRes.data
      setFamily({ ...rest, has_parent_pin: parent_pin !== null, api_key: rest.api_key ?? undefined, daily_reset_hour: rest.daily_reset_hour ?? 0 })
      setFamilyName(familyRes.data.name)
    }
    if (kidsRes.data) setKids(kidsRes.data)
    if (questsRes.data) setQuests(questsRes.data)
    if (completionsRes.data) setCompletions(completionsRes.data)
    if (rewardsRes.data) setRewards(rewardsRes.data)
    if (redemptionsRes.data) setRedemptions(redemptionsRes.data)
    if (cursesRes.data) setCurses(cursesRes.data)
    if (curseInstancesRes.data) setActiveCurseInstances(curseInstancesRes.data as CurseInstance[])
    setLoading(false)
  }, [supabase])

  // Check parent PIN lock once, on initial family load only.
  // Using a ref so repeated fetchData calls (realtime, approvals) never re-lock.
  useEffect(() => {
    if (!family || hasCheckedParentPin.current) return
    hasCheckedParentPin.current = true
    if (family.has_parent_pin) {
      const unlocked = sessionStorage.getItem(PARENT_PIN_SESSION_KEY) === '1'
      if (!unlocked) setParentLocked(true)
    }
  }, [family])

  // Auto-lock when parent navigates away (back button, link, URL bar — all paths)
  useEffect(() => {
    return () => { sessionStorage.removeItem(PARENT_PIN_SESSION_KEY) }
  }, [])

  useEffect(() => {
    if (!parentLockedUntil) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [parentLockedUntil])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel('parent-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions' }, fetchData)
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

      const today = questDateString(family?.daily_reset_hour ?? 0)
      const lastDate = completion.kid?.last_completed_date
      const newStreak = lastDate === yesterday() ? (completion.kid?.streak ?? 0) + 1 : 1

      await supabase
        .from('kids')
        .update({ streak: newStreak, last_completed_date: today })
        .eq('id', completion.kid_id)

      if (completion.quest?.frequency === 'once') {
        await supabase.from('quests').update({ active: false }).eq('id', completion.quest.id)
      }

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

  const handleFulfillRedemption = async (redemptionId: string) => {
    const redemption = redemptions.find((r) => r.id === redemptionId)
    if (!redemption) return
    const kid = redemption.kid as Kid | undefined
    const reward = redemption.reward as Reward | undefined
    if (!kid || !reward) return

    const { error } = await supabase
      .from('redemptions')
      .update({ status: 'approved' })
      .eq('id', redemptionId)

    if (!error) {
      await supabase
        .from('kids')
        .update({ coins: Math.max(0, kid.coins - reward.cost) })
        .eq('id', kid.id)
      toast.success(`${kid.name} got ${reward.title}! 🎁 -${reward.cost} coins`)
      await fetchData()
    }
  }

  const handleDenyRedemption = async (redemptionId: string) => {
    await supabase.from('redemptions').delete().eq('id', redemptionId)
    toast.success('Reward request denied')
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
      frequency: newQuestFrequency,
      tier: newQuestTier,
      active: true,
    })
    if (!error) {
      toast.success('Quest added to the board! ⚔️')
      setNewQuestTitle('')
      setNewQuestDesc('')
      setNewQuestFrequency('daily')
      setNewQuestTier('normal')
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

  const handleSaveQuest = async (questId: string, updates: Partial<Quest>) => {
    const { error } = await supabase.from('quests').update(updates).eq('id', questId)
    if (error) {
      toast.error('Failed to save quest')
    } else {
      toast.success('Quest updated!')
      await fetchData()
    }
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

  const handleSaveResetHour = async (hour: number) => {
    if (!family) return
    await supabase.from('families').update({ daily_reset_hour: hour }).eq('id', family.id)
    toast.success('Daily reset time updated!')
    await fetchData()
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

  const handleUndoApproval = async (completionId: string) => {
    const completion = completions.find((c) => c.id === completionId)
    if (!completion) return
    const kid = completion.kid as Kid | undefined
    const coinsToRemove = completion.coins_awarded ?? 0

    await supabase
      .from('completions')
      .update({ status: 'pending', approved_at: null, coins_awarded: null })
      .eq('id', completionId)

    if (kid && coinsToRemove > 0) {
      await supabase
        .from('kids')
        .update({ coins: Math.max(0, (kid.coins ?? 0) - coinsToRemove) })
        .eq('id', kid.id)
    }

    toast.success('Approval undone — back to pending')
    await fetchData()
  }

  const handleUndoRejection = async (completionId: string) => {
    await supabase
      .from('completions')
      .update({ status: 'pending' })
      .eq('id', completionId)
    toast.success('Rejection undone — back to pending')
    await fetchData()
  }

  const handleSaveCoins = async (kidId: string) => {
    const val = parseInt(editCoinsValue, 10)
    if (isNaN(val) || val < 0) return
    await supabase.from('kids').update({ coins: val }).eq('id', kidId)
    toast.success('Coins updated! 🪙')
    setEditingCoinsKidId(null)
    await fetchData()
  }

  const handleParentPinDigit = async (digit: string) => {
    if (parentLockedUntil && now < parentLockedUntil) return
    const next = lockPinInput + digit
    setLockPinInput(next)
    if (next.length === 4) {
      const res = await fetch('/api/parent/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: next }),
      })
      const { success } = await res.json()
      if (success) {
        sessionStorage.setItem(PARENT_PIN_SESSION_KEY, '1')
        setParentLocked(false)
        setLockPinError(false)
        setLockPinInput('')
        setParentPinAttempts(0)
        setParentLockedUntil(null)
      } else {
        const attempts = parentPinAttempts + 1
        setParentPinAttempts(attempts)
        if (attempts >= 5) {
          const lockMs = getLockDurationMs(attempts)
          setParentLockedUntil(now + lockMs)
          toast.error(`Too many attempts — locked for ${attempts >= 8 ? '5 minutes' : '30 seconds'}`)
        }
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

  const handleRegenerateApiKey = async () => {
    if (!family) return
    await supabase.from('families').update({ api_key: crypto.randomUUID() }).eq('id', family.id)
    toast.success('API key regenerated')
    await fetchData()
  }

  const handleRegenerateToken = async () => {
    if (!family) return
    await supabase.from('families').update({ invite_token: crypto.randomUUID() }).eq('id', family.id)
    toast.success('Invite link regenerated')
    await fetchData()
  }

  const handleAddCurse = async () => {
    if (!newCurseTitle.trim() || !family) return
    const { error } = await supabase.from('curses').insert({
      family_id: family.id,
      title: newCurseTitle.trim(),
      icon: newCurseIcon,
      penalty: newCursePenalty,
    })
    if (!error) {
      toast.success('Curse added to the arsenal! ☠️')
      setNewCurseTitle('')
      await fetchData()
    }
  }

  const handleCastCurse = async (curseId: string, kidId: string) => {
    const curse = curses.find(c => c.id === curseId)
    const kid = kids.find(k => k.id === kidId)
    if (!curse || !kid) return

    const { error: instanceError } = await supabase.from('curse_instances').insert({
      curse_id: curseId,
      kid_id: kidId,
      coins_deducted: curse.penalty,
      status: 'active',
    })
    if (instanceError) { toast.error('Failed to cast curse'); return }

    await supabase.from('kids').update({ coins: Math.max(0, kid.coins - curse.penalty) }).eq('id', kidId)
    toast.success(`${curse.icon} ${curse.title} cast on ${kid.name}! −${curse.penalty} coins`)
    setCastingCurseId(null)
    await fetchData()
  }

  const handleResolveCurse = async (instanceId: string, refund: boolean) => {
    const instance = activeCurseInstances.find(ci => ci.id === instanceId)
    const kid = instance?.kid as Kid | undefined
    if (!instance || !kid) return

    await supabase.from('curse_instances').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', instanceId)
    if (refund) {
      await supabase.from('kids').update({ coins: kid.coins + instance.coins_deducted }).eq('id', kid.id)
      toast.success(`Curse lifted — ${instance.coins_deducted} coins refunded to ${kid.name}`)
    } else {
      toast.success('Curse resolved')
    }
    await fetchData()
  }

  const pendingCompletions = completions.filter((c) => c.status === 'pending')
  const pendingRedemptions = redemptions.filter((r) => r.status === 'pending')

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
          {parentLockedUntil && now < parentLockedUntil ? (
            <p className="text-red-400 text-sm mb-8">
              🔒 Too many attempts — try again in{' '}
              {Math.ceil((parentLockedUntil - now) / 1000)}s
            </p>
          ) : (
            <p className="text-white/40 text-sm mb-8">Enter your parent PIN</p>
          )}

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
    { id: 'approvals', label: '✓ Approvals', badge: pendingCompletions.length + pendingRedemptions.length },
    { id: 'quests', label: '⚔️ Quests' },
    { id: 'rewards', label: '🎁 Rewards' },
    { id: 'curses', label: '☠️ Curses', badge: activeCurseInstances.length || undefined },
    { id: 'family', label: '👨‍👩‍👧 Family' },
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
          {family?.has_parent_pin && (
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
                              {kid.avatar} {kid.name} · 🪙 {reward.cost} coins
                            </p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleFulfillRedemption(r.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80' }}
                            >
                              ✓ Give
                            </button>
                            <button
                              onClick={() => handleDenyRedemption(r.id)}
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
                <Empty icon="✅" message={pendingRedemptions.length === 0 ? "All clear — nothing pending!" : "No pending quests"} />
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
                        <div key={c.id} className="flex items-center gap-3 py-2">
                          <span className="text-lg">{kid.avatar}</span>
                          <span className="text-white/50 text-sm">{kid.name}</span>
                          <span className="text-white/35 text-sm flex-1 truncate">{(c.quest as Quest)?.title}</span>
                          <span className={`text-xs font-semibold flex-shrink-0 ${c.status === 'approved' ? 'text-cq-forest' : 'text-red-400'}`}>
                            {c.status === 'approved' ? `✓ +${c.coins_awarded}🪙` : '✗'}
                          </span>
                          <button
                            onClick={() => c.status === 'approved'
                              ? handleUndoApproval(c.id)
                              : handleUndoRejection(c.id)
                            }
                            className="text-xs text-white/20 hover:text-cq-gold transition-all flex-shrink-0 ml-1"
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
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Frequency</label>
                    <div className="flex gap-2">
                      {(['daily', 'once'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setNewQuestFrequency(f)}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background: newQuestFrequency === f ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${newQuestFrequency === f ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)'}`,
                            color: newQuestFrequency === f ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {f === 'daily' ? '🔁 Daily' : '⭐ One-time'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Tier</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['normal', 'heroic', 'legendary', 'epic'] as const).map((t) => {
                        const tc = TIER_CONFIG[t]
                        const selected = newQuestTier === t
                        return (
                          <button
                            key={t}
                            onClick={() => setNewQuestTier(t)}
                            className="py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{
                              background: selected ? tc.bg : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${selected ? tc.border : 'rgba(255,255,255,0.08)'}`,
                              color: selected ? tc.color : 'rgba(255,255,255,0.4)',
                              boxShadow: selected && tc.glow ? tc.glow : 'none',
                            }}
                          >
                            {tc.label}
                          </button>
                        )
                      })}
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
                    <QuestRow key={q.id} quest={q} kids={kids} onToggle={handleToggleQuest} onDelete={handleDeleteQuest} onSave={handleSaveQuest} />
                  ))
                )}
              </Section>

              {quests.filter((q) => !q.active).length > 0 && (
                <Section title="Archived Quests">
                  {quests.filter((q) => !q.active).map((q) => (
                    <QuestRow key={q.id} quest={q} kids={kids} onToggle={handleToggleQuest} onDelete={handleDeleteQuest} onSave={handleSaveQuest} />
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

              {/* Daily reset */}
              <Section title="Daily Quest Reset">
                <div className="flex flex-col gap-3">
                  <p className="text-white/45 text-xs">
                    Quests reset each day at this time
                    {typeof window !== 'undefined' && (
                      <span className="text-white/30"> · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                    )}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {([0, 3, 5, 6] as const).map((h) => {
                      const label = h === 0 ? '12 AM' : `${h} AM`
                      const selected = (family?.daily_reset_hour ?? 0) === h
                      return (
                        <button
                          key={h}
                          onClick={() => handleSaveResetHour(h)}
                          className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background: selected ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${selected ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)'}`,
                            color: selected ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/30 flex-shrink-0">Custom hour (0–23):</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={family?.daily_reset_hour ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0))
                        handleSaveResetHour(v)
                      }}
                      className="w-16 px-2 py-1 rounded-lg text-xs text-white/90 outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
              </Section>

              {/* Parent lock */}
              <Section title="Parent Lock">
                {family?.has_parent_pin ? (
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
                            {editingCoinsKidId === kid.id ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={editCoinsValue}
                                  onChange={(e) => setEditCoinsValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCoins(kid.id)
                                    if (e.key === 'Escape') setEditingCoinsKidId(null)
                                  }}
                                  autoFocus
                                  className="w-20 px-2 py-0.5 rounded-lg text-xs text-white/90 outline-none"
                                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(251,191,36,0.4)' }}
                                />
                                <button
                                  onClick={() => handleSaveCoins(kid.id)}
                                  className="text-xs text-cq-gold hover:opacity-80 transition-all font-bold"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setEditingCoinsKidId(null)}
                                  className="text-xs text-white/30 hover:text-white/60 transition-all"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingCoinsKidId(kid.id)
                                  setEditCoinsValue(String(kid.coins))
                                }}
                                className="text-xs mt-0.5 text-left hover:opacity-80 transition-all"
                                style={{ color: colors.primary }}
                              >
                                🪙 {kid.coins} coins · 🔥 {kid.streak} streak · Lv {Math.floor(kid.coins / 50) + 1}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setRevealPinKidId(revealPinKidId === kid.id ? null : kid.id)}
                              className="text-xs text-white/30 font-mono hover:text-white/60 transition-all"
                              title={revealPinKidId === kid.id ? 'Hide PIN' : 'Show PIN'}
                            >
                              {revealPinKidId === kid.id ? `PIN: ${kid.pin}` : 'PIN: ····'}
                            </button>
                            <button
                              onClick={() => setQrKidId(kid.id)}
                              className="text-lg hover:scale-110 transition-all"
                              title="Show QR code"
                            >
                              📱
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              {/* Invite link */}
              {family && (
                <Section title="Family Invite Link">
                  <div className="flex flex-col gap-3">
                    <p className="text-white/50 text-sm">
                      Share this link so anyone in your family can pick their adventurer and jump straight to their PIN screen.
                    </p>
                    <div
                      className="px-3 py-2.5 rounded-xl text-xs text-white/60 font-mono break-all select-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {typeof window !== 'undefined' ? `${window.location.origin}/join/${family.invite_token}` : `/join/${family.invite_token}`}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/join/${family.invite_token}`
                          navigator.clipboard.writeText(url)
                          toast.success('Invite link copied!')
                        }}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8' }}
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={handleRegenerateToken}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                        title="Regenerate to invalidate old link"
                      >
                        ↻
                      </button>
                    </div>
                  </div>
                </Section>
              )}

              {/* API Key */}
              {family?.api_key && (
                <Section title="API Key">
                  <div className="flex flex-col gap-3">
                    <p className="text-white/45 text-xs">
                      Use this key to access your family data via the REST API. Keep it secret.
                    </p>
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <code className="flex-1 text-xs text-white/60 font-mono truncate">
                        {family.api_key}
                      </code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(family.api_key!); toast.success('API key copied!') }}
                        className="text-xs text-white/40 hover:text-cq-azure transition-all flex-shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                    <button
                      onClick={handleRegenerateApiKey}
                      className="text-xs text-white/25 hover:text-red-400 transition-all text-center"
                    >
                      Regenerate key (invalidates current key)
                    </button>
                  </div>
                </Section>
              )}
            </motion.div>
          )}

          {tab === 'curses' && (
            <motion.div key="curses" {...fadeSlide} className="flex flex-col gap-6">
              {/* Define curses */}
              <Section title="Define Curses">
                <div className="flex flex-col gap-3">
                  <p className="text-white/45 text-xs">
                    Create named penalties you can cast instantly when bad behavior happens.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {['☠️','😈','🌩️','🔥','💀','👿','🦂','🕸️'].map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setNewCurseIcon(icon)}
                        className="text-xl w-10 h-10 rounded-xl transition-all"
                        style={{
                          background: newCurseIcon === icon ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${newCurseIcon === icon ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <FormInput placeholder="Curse name (e.g. Whining, Tantrum)..." value={newCurseTitle} onChange={setNewCurseTitle} />
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Coin penalty</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={newCursePenalty}
                      onChange={(e) => setNewCursePenalty(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <motion.button
                    onClick={handleAddCurse}
                    disabled={!newCurseTitle.trim()}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
                    whileHover={{ background: 'rgba(239,68,68,0.22)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    + Add Curse
                  </motion.button>

                  {curses.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                      {curses.map(curse => (
                        <div
                          key={curse.id}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                        >
                          <span className="text-xl">{curse.icon}</span>
                          <div className="flex-1">
                            <p className="text-white/85 text-sm font-semibold">{curse.title}</p>
                            <p className="text-red-400/60 text-xs">−{curse.penalty} coins</p>
                          </div>
                          {/* Cast button */}
                          {castingCurseId === curse.id ? (
                            <div className="flex gap-1 flex-wrap">
                              {kids.map(k => (
                                <button
                                  key={k.id}
                                  onClick={() => handleCastCurse(curse.id, k.id)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
                                >
                                  {k.avatar} {k.name}
                                </button>
                              ))}
                              <button
                                onClick={() => setCastingCurseId(null)}
                                className="px-2 py-1 rounded-lg text-xs text-white/30 hover:text-white/60 transition-all"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setCastingCurseId(curse.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                              >
                                Cast ⚡
                              </button>
                              <button
                                onClick={async () => {
                                  await supabase.from('curses').delete().eq('id', curse.id)
                                  await fetchData()
                                }}
                                className="text-white/20 hover:text-red-400 transition-all text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              {/* Active curses */}
              <Section title="Active Afflictions">
                {activeCurseInstances.length === 0 ? (
                  <Empty icon="✨" message="No active curses — all is well!" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {activeCurseInstances.map(ci => {
                      const curse = ci.curse as Curse | undefined
                      const kid = ci.kid as Kid | undefined
                      return (
                        <div
                          key={ci.id}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          <span className="text-xl">{curse?.icon ?? '☠️'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white/85 text-sm font-semibold truncate">{curse?.title ?? 'Curse'}</p>
                            <p className="text-white/40 text-xs">
                              {kid?.avatar} {kid?.name} · −{ci.coins_deducted} coins
                            </p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleResolveCurse(ci.id, true)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                              title="Lift curse and refund coins"
                            >
                              ↩ Forgive
                            </button>
                            <button
                              onClick={() => handleResolveCurse(ci.id, false)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                              title="Resolve without refund"
                            >
                              Resolve
                            </button>
                          </div>
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

      {/* QR code modal */}
      <AnimatePresence>
        {qrKidId && (() => {
          const kid = kids.find((k) => k.id === qrKidId)
          if (!kid) return null
          const kidUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/kid/${kid.id}`
            : `/kid/${kid.id}`
          return (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrKidId(null)}
            >
              <motion.div
                className="relative w-full max-w-xs rounded-3xl p-6 text-center"
                style={{ background: '#0e0b24', border: '1px solid rgba(255,255,255,0.12)' }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setQrKidId(null)}
                  className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-all text-lg"
                >
                  ✕
                </button>
                <span className="text-4xl block mb-2">{kid.avatar}</span>
                <h3 className="font-heading font-bold text-white text-xl mb-4">{kid.name}</h3>
                <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                  <QRCode value={kidUrl} size={160} />
                </div>
                <p className="text-white/40 text-xs mb-4">Scan to go straight to {kid.name}&apos;s PIN screen</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(kidUrl); toast.success('Link copied!') }}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8' }}
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                  >
                    Print
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
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
  quest, kids, onToggle, onDelete, onSave
}: {
  quest: Quest
  kids: Kid[]
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onSave: (id: string, updates: Partial<Quest>) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(quest.title)
  const [desc, setDesc] = useState(quest.description ?? '')
  const [icon, setIcon] = useState(quest.icon)
  const [coins, setCoins] = useState(quest.coins)
  const [forKid, setForKid] = useState<string>(quest.assigned_to ?? 'all')
  const [frequency, setFrequency] = useState<'daily' | 'once'>(quest.frequency === 'once' ? 'once' : 'daily')
  const [tier, setTier] = useState<QuestTier>(quest.tier ?? 'normal')

  const assignedKid = kids.find((k) => k.id === quest.assigned_to)
  const tierCfg = TIER_CONFIG[quest.tier ?? 'normal']

  const handleSave = async () => {
    await onSave(quest.id, {
      title: title.trim(),
      description: desc.trim() || null,
      icon,
      coins,
      assigned_to: forKid === 'all' ? null : forKid,
      frequency,
      tier,
    })
    setEditing(false)
  }

  return (
    <div
      className="rounded-xl mb-2 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Summary row */}
      <div className="flex items-center gap-3 p-3">
        <span className="text-xl">{quest.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${quest.active ? 'text-white/90' : 'text-white/40 line-through'}`}>
              {quest.title}
            </p>
            {(quest.tier ?? 'normal') !== 'normal' && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: `${tierCfg.color}18`, color: tierCfg.color, border: `1px solid ${tierCfg.border}` }}
              >
                {tierCfg.label}
              </span>
            )}
            {quest.frequency === 'once' && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}
              >
                one-time
              </span>
            )}
          </div>
          <p className="text-white/35 text-xs">
            🪙 {quest.coins} · {assignedKid ? assignedKid.name : 'All kids'}
          </p>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-xs px-2.5 py-1 rounded-lg transition-all"
          style={{
            background: editing ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
            color: editing ? '#fbbf24' : 'rgba(255,255,255,0.4)',
          }}
        >
          ✏️
        </button>
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

      {/* Inline edit form */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-3 pt-1 flex flex-col gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              {/* Icon picker */}
              <div className="flex flex-wrap gap-1.5">
                {QUEST_ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className="text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: icon === ic ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${icon === ic ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Quest title..."
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description (optional)..."
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white/60 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              />

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-white/40 mb-1 block">Coins</label>
                  <input
                    type="number"
                    min={1}
                    value={coins}
                    onChange={(e) => setCoins(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-white/40 mb-1 block">For</label>
                  <select
                    value={forKid}
                    onChange={(e) => setForKid(e.target.value)}
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

              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Frequency</label>
                <div className="flex gap-2">
                  {(['daily', 'once'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: frequency === f ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${frequency === f ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)'}`,
                        color: frequency === f ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {f === 'daily' ? '🔁 Daily' : '⭐ One-time'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Tier</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['normal', 'heroic', 'legendary', 'epic'] as const).map((t) => {
                    const tc = TIER_CONFIG[t]
                    const selected = tier === t
                    return (
                      <button
                        key={t}
                        onClick={() => setTier(t)}
                        className="py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: selected ? tc.bg : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selected ? tc.border : 'rgba(255,255,255,0.08)'}`,
                          color: selected ? tc.color : 'rgba(255,255,255,0.4)',
                          boxShadow: selected && tc.glow ? tc.glow : 'none',
                        }}
                      >
                        {tc.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-xl text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 },
}
