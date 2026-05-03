'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { KidColumn } from '@/components/kid-column'
import type { Kid, Quest, Completion, Family } from '@/lib/types'
import { questDateString } from '@/lib/utils'
import { toast } from 'sonner'

export default function WallDisplay() {
  const [family, setFamily] = useState<Family | null>(null)
  const [kids, setKids] = useState<Kid[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [supabase] = useState(createClient)

  const fetchData = useCallback(async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .single()

    if (!profile) return

    const [familyRes, kidsRes, questsRes] = await Promise.all([
      supabase.from('families').select('id, name, invite_token, daily_reset_hour, created_at').eq('id', profile.family_id).single(),
      supabase.from('kids').select('id, name, avatar, color, coins, streak, last_completed_date, family_id, created_at').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('quests').select('*').eq('family_id', profile.family_id).eq('active', true).order('created_at'),
    ])

    const today = questDateString(familyRes.data?.daily_reset_hour ?? 0)
    const { data: completionsData } = await supabase
      .from('completions')
      .select('*')
      .eq('date', today)

    if (familyRes.data) setFamily({ ...familyRes.data, has_parent_pin: false })
    if (kidsRes.data) setKids(kidsRes.data)
    if (questsRes.data) setQuests(questsRes.data)
    if (completionsData) {
      setCompletions(completionsData)
      setPendingCount(completionsData.filter((c) => c.status === 'pending').length)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('wall-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kids' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, supabase])

  const handleComplete = useCallback(
    async (questId: string, kidId: string) => {
      const quest = quests.find((q) => q.id === questId)
      if (!quest) return

      const { error } = await supabase.from('completions').insert({
        quest_id: questId,
        kid_id: kidId,
        status: 'pending',
        date: questDateString(family?.daily_reset_hour ?? 0),
      })

      if (error) {
        toast.error(error.code === '23505' ? 'Already completed today!' : 'Something went wrong')
        return
      }

      toast.success(`Quest submitted! ✨`, {
        description: `${quest.coins} coins pending approval`,
      })

      await fetchData()
    },
    [quests, supabase, fetchData, family?.daily_reset_hour]
  )

  const getKidQuests = (kid: Kid) =>
    quests.filter((q) => !q.assigned_to || q.assigned_to === kid.id)

  const getKidCompletions = (kid: Kid) =>
    completions.filter((c) => c.kid_id === kid.id)

  if (loading) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center">
        <StarField />
        <motion.p
          className="relative z-10 font-heading text-3xl text-white/40"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✦ Loading the realm ✦
        </motion.p>
      </div>
    )
  }

  if (kids.length === 0) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center">
        <StarField />
        <motion.div
          className="relative z-10 text-center px-6 max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-7xl mb-6">🏰</p>
          <h1 className="font-heading text-4xl font-bold text-white mb-4">Welcome, Realm Master</h1>
          <p className="text-white/50 text-lg mb-8">
            Add your young adventurers to begin the quests.
          </p>
          <Link
            href="/parent"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition-all"
            style={{
              background: 'rgba(251, 191, 36, 0.15)',
              border: '1px solid rgba(251, 191, 36, 0.35)',
              color: '#fbbf24',
            }}
          >
            ⚙️ Set Up Your Realm
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-quest-void flex flex-col">
      <StarField />

      {/* Header */}
      <motion.header
        className="relative z-10 flex items-center justify-between px-8 py-5 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex-1" />

        <div className="text-center">
          <h1 className="font-heading text-4xl font-black text-gradient-gold tracking-widest">
            ChoreQuest
          </h1>
          {family && (
            <p className="text-white/35 text-xs tracking-[0.3em] uppercase mt-1">
              The {family.name} Realm
            </p>
          )}
        </div>

        <div className="flex-1 flex justify-end items-center gap-3">
          {pendingCount > 0 && (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              <Link
                href="/parent"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(251, 191, 36, 0.14)',
                  border: '1px solid rgba(251, 191, 36, 0.32)',
                  color: '#fbbf24',
                }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cq-gold opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cq-gold" />
                </span>
                {pendingCount} pending
              </Link>
            </motion.div>
          )}
          <Link
            href="/parent"
            className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 transition-all glass border-glass"
          >
            ⚙️ Parent
          </Link>
        </div>
      </motion.header>

      {/* Kid columns */}
      <main
        className="relative z-10 flex-1 grid gap-6 px-8 pb-8 min-h-0"
        style={{ gridTemplateColumns: `repeat(${kids.length}, 1fr)` }}
      >
        {kids.map((kid, i) => (
          <motion.div
            key={kid.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 220, damping: 24 }}
            className="min-h-0 flex flex-col"
          >
            <KidColumn
              kid={kid}
              quests={getKidQuests(kid)}
              completions={getKidCompletions(kid)}
              onComplete={(questId) => handleComplete(questId, kid.id)}
              linkToKidView
            />
          </motion.div>
        ))}
      </main>

      <motion.footer
        className="relative z-10 text-center pb-4 text-white/20 text-xs tracking-[0.25em] uppercase flex-shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        ✦ tap a quest to complete it ✦
      </motion.footer>
    </div>
  )
}
