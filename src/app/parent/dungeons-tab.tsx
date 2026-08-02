'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { DungeonRun, DungeonClear, RaidBoss, Kid, Completion } from '@/lib/types'
import { Section, FormInput, Empty, fadeSlide } from './_ui'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import type { ParentActions } from './use-parent-actions'

const DUNGEON_ICONS = ['🏰', '⚔️', '🗡️', '🛡️', '🔮', '🌋', '🕳️', '🐲']
const BOSS_ICONS = ['🐉', '👾', '💀', '🦂', '👹', '🔥', '🌩️', '🦇']

interface Props {
  activeDungeon: DungeonRun | null
  dungeonClears: DungeonClear[]
  weeklyCompletions: Completion[]
  kids: Kid[]
  activeBoss: RaidBoss | null
  pastDungeons: DungeonRun[]
  defeatedBosses: RaidBoss[]
  actions: ParentActions
}

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-white/35 mb-1">
        <span>{current.toLocaleString()} / {max.toLocaleString()}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

export function DungeonsTab({ activeDungeon, dungeonClears, weeklyCompletions, kids, activeBoss, pastDungeons, defeatedBosses, actions }: Props) {
  const kidCount = kids.length

  const getKidDamage = (kidId: string) =>
    weeklyCompletions
      .filter(c => c.kid_id === kidId)
      .reduce((s, c) => s + (c.coins_awarded ?? 0), 0)

  const kidCleared = (kidId: string) => dungeonClears.some(c => c.kid_id === kidId)
  // Dungeon form state
  const [dTitle, setDTitle] = useState('')
  const [dIcon, setDIcon] = useState('🏰')
  const [dHp, setDHp] = useState(200)
  const [dRewardCoins, setDRewardCoins] = useState(50)
  const [dRewardXp, setDRewardXp] = useState(100)

  // Raid boss form state
  const [bTitle, setBTitle] = useState('')
  const [bIcon, setBIcon] = useState('🐉')
  const [bHpPerKid, setBHpPerKid] = useState(200)
  const [bBounty, setBBounty] = useState(150)

  const handleAddDungeon = async () => {
    await actions.addDungeonRun({ title: dTitle, icon: dIcon, hp: dHp, rewardCoins: dRewardCoins, rewardXp: dRewardXp })
    setDTitle('')
  }

  const handleAddBoss = async () => {
    await actions.addRaidBoss({ title: bTitle, icon: bIcon, hpPerKid: bHpPerKid, bountyCoins: bBounty })
    setBTitle('')
  }

  return (
    <motion.div key="dungeons" {...fadeSlide} className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">

      {/* ── Active Dungeon ─────────────────────────────── */}
      <Section title="Weekly Dungeon">
        {activeDungeon ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{activeDungeon.icon}</span>
              <div className="flex-1">
                <p className="text-white/90 font-semibold">{activeDungeon.title}</p>
                <p className="text-white/40 text-xs">Goal: {activeDungeon.hp} coins each · Loot: +{activeDungeon.reward_coins} coins · +{activeDungeon.reward_xp} XP</p>
              </div>
              <ConfirmDelete
                onConfirm={() => actions.deleteDungeonRun(activeDungeon.id)}
                ariaLabel="Cancel this dungeon"
                prompt="Cancel?"
                confirmLabel="Yes, cancel"
                className="px-1 py-1"
              />
            </div>
            {kids.length === 0 && (
              <p className="text-white/30 text-xs text-center">Add kids to track progress</p>
            )}
            {kids.map(kid => {
              const damage = getKidDamage(kid.id)
              const cleared = kidCleared(kid.id)
              return (
                <div key={kid.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{kid.avatar}</span>
                    <span className="text-white/70 text-xs font-semibold flex-1">{kid.name}</span>
                    {cleared
                      ? <span className="text-xs font-bold text-cq-forest">Cleared ✓</span>
                      : <span className="text-xs text-white/30">{damage} / {activeDungeon.hp}</span>
                    }
                  </div>
                  <HpBar
                    current={cleared ? activeDungeon.hp : damage}
                    max={activeDungeon.hp}
                    color={cleared ? '#4ade80' : 'linear-gradient(90deg, #38bdf8, #a78bfa)'}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-white/40 text-xs">
              Create a weekly cooperative challenge. All kids contribute damage by completing quests. When cleared, everyone earns the loot.
            </p>
            <div className="flex gap-2 flex-wrap">
              {DUNGEON_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setDIcon(ic)}
                  aria-label={`Use ${ic} as the dungeon icon`}
                  aria-pressed={dIcon === ic}
                  className="text-xl w-11 h-11 rounded-xl transition-all"
                  style={{
                    background: dIcon === ic ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${dIcon === ic ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
            <FormInput placeholder="Dungeon name (e.g. Cave of Chaos)" value={dTitle} onChange={setDTitle} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-white/40 mb-1 block">HP (damage needed)</label>
                <input type="number" min={50} max={5000} value={dHp}
                  aria-label="Dungeon HP needed"
                  onChange={(e) => setDHp(Number(e.target.value))}
                  className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Reward coins (per kid)</label>
                <input type="number" min={10} max={500} value={dRewardCoins}
                  aria-label="Reward coins per kid"
                  onChange={(e) => setDRewardCoins(Number(e.target.value))}
                  className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Reward XP (per kid)</label>
                <input type="number" min={10} max={1000} value={dRewardXp}
                  aria-label="Reward experience points per kid"
                  onChange={(e) => setDRewardXp(Number(e.target.value))}
                  className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            <motion.button
              onClick={handleAddDungeon}
              disabled={!dTitle.trim()}
              className="w-full min-h-11 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.35)', color: '#38bdf8' }}
              whileHover={{ background: 'rgba(56,189,248,0.22)' }}
              whileTap={{ scale: 0.98 }}
            >
              🏰 Open This Week&apos;s Dungeon
            </motion.button>
          </div>
        )}
      </Section>

      {/* ── Active Raid Boss ───────────────────────────── */}
      <Section title="Raid Boss">
        {activeBoss ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <motion.span
                className="text-4xl"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                {activeBoss.icon}
              </motion.span>
              <div className="flex-1">
                <p className="text-white/90 font-semibold font-heading">{activeBoss.title}</p>
                <p className="text-white/40 text-xs">Bounty: {activeBoss.bounty_coins} coins split among all kids</p>
              </div>
              <ConfirmDelete
                onConfirm={() => actions.deleteRaidBoss(activeBoss.id)}
                ariaLabel="Dismiss raid boss"
                prompt="Dismiss?"
                confirmLabel="Yes, dismiss"
                className="px-1 py-1"
              />
            </div>
            <HpBar
              current={activeBoss.current_hp}
              max={activeBoss.max_hp}
              color="linear-gradient(90deg, #fb923c, #ef4444)"
            />
            <p className="text-xs text-white/30 text-center">
              {activeBoss.current_hp.toLocaleString()} HP remaining · {Math.floor(activeBoss.bounty_coins / Math.max(1, kidCount))} coins per kid on defeat
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-white/40 text-xs">
              Summon a persistent boss. HP scales with the number of kids. Every approved quest deals damage. Defeat splits the coin bounty equally.
            </p>
            <div className="flex gap-2 flex-wrap">
              {BOSS_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setBIcon(ic)}
                  aria-label={`Use ${ic} as the raid boss icon`}
                  aria-pressed={bIcon === ic}
                  className="text-xl w-11 h-11 rounded-xl transition-all"
                  style={{
                    background: bIcon === ic ? 'rgba(251,146,60,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${bIcon === ic ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
            <FormInput placeholder="Boss name (e.g. The Great Laziness)" value={bTitle} onChange={setBTitle} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-white/40 mb-1 block">HP per kid · total: {bHpPerKid * Math.max(1, kidCount)}</label>
                <input type="number" min={100} max={5000} value={bHpPerKid}
                  aria-label="Raid boss HP per kid"
                  onChange={(e) => setBHpPerKid(Number(e.target.value))}
                  className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Total coin bounty</label>
                <input type="number" min={50} max={2000} value={bBounty}
                  aria-label="Total raid boss coin bounty"
                  onChange={(e) => setBBounty(Number(e.target.value))}
                  className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            <p className="text-xs text-white/30 text-center">
              {kidCount > 0 ? `${Math.floor(bBounty / kidCount)} coins per kid on defeat` : 'Add kids first'}
            </p>
            <motion.button
              onClick={handleAddBoss}
              disabled={!bTitle.trim() || kidCount === 0}
              className="w-full min-h-11 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c' }}
              whileHover={{ background: 'rgba(251,146,60,0.22)' }}
              whileTap={{ scale: 0.98 }}
            >
              🐉 Summon Raid Boss
            </motion.button>
          </div>
        )}
      </Section>
      </div>

      {/* ── History ───────────────────────────────────── */}
      {(pastDungeons.length > 0 || defeatedBosses.length > 0) && (
        <Section title="Hall of Victories">
          <div className="flex flex-col gap-2">
            {defeatedBosses.map(boss => (
              <div key={boss.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)' }}>
                <span className="text-xl">{boss.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-semibold truncate">{boss.title}</p>
                  <p className="text-white/35 text-xs">Raid boss · {boss.bounty_coins} coin bounty</p>
                </div>
                <span className="text-xs text-cq-ember font-bold">Defeated ⚔️</span>
              </div>
            ))}
            {pastDungeons.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' }}>
                <span className="text-xl">{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-semibold truncate">{d.title}</p>
                  <p className="text-white/35 text-xs">Dungeon · +{d.reward_coins} coins each</p>
                </div>
                <span className="text-xs text-cq-azure font-bold">Cleared 🏆</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {pastDungeons.length === 0 && defeatedBosses.length === 0 && (
        <Empty icon="🏆" message="No victories yet — the realm awaits!" />
      )}
    </motion.div>
  )
}
