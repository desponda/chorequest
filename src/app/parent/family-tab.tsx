'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import type { Family, Kid, KidColor } from '@/lib/types'
import { KID_COLORS } from '@/lib/constants'
import { KID_AVATAR_KEYS } from '@/lib/icons'
import { AppIcon } from '@/components/app-icon'
import { ActionButton, Empty, FormInput, Section, fadeSlide } from './_ui'
import type { ParentActions } from './use-parent-actions'

const RESET_HOUR_PRESETS = [0, 3, 5, 6] as const

interface Props {
  family: Family | null
  kids: Kid[]
  onShowQr: (kidId: string) => void
  actions: ParentActions
}

export function FamilyTab({ family, kids, onShowQr, actions }: Props) {
  return (
    <motion.div key="family" {...fadeSlide} className="flex flex-col gap-6">
      <RealmName family={family} actions={actions} />
      <DailyResetSettings family={family} actions={actions} />
      <ParentLockSettings family={family} actions={actions} />
      <AddKidForm actions={actions} />
      <KidList kids={kids} onShowQr={onShowQr} actions={actions} />
      {family && <InviteLink family={family} actions={actions} />}
      {family?.api_key && <ApiKey family={family} actions={actions} />}
    </motion.div>
  )
}

function RealmName({ family, actions }: { family: Family | null; actions: ParentActions }) {
  const [name, setName] = useState(family?.name ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (family) setName(family.name)
  }, [family])

  const handleSave = async () => {
    setSaving(true)
    await actions.saveFamilyName(name)
    setSaving(false)
  }

  return (
    <Section title="Realm Name">
      <div className="flex gap-2">
        <FormInput placeholder="Family name..." value={name} onChange={setName} className="flex-1" />
        <ActionButton onClick={handleSave} label={saving ? '...' : 'Save'} className="flex-shrink-0 px-5" />
      </div>
    </Section>
  )
}

function DailyResetSettings({ family, actions }: { family: Family | null; actions: ParentActions }) {
  return (
    <Section title="Daily Quest Reset">
      <div className="flex flex-col gap-3">
        <p className="text-white/45 text-xs">
          Quests reset each day at this time
          {typeof window !== 'undefined' && (
            <span className="text-white/30"> · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          )}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {RESET_HOUR_PRESETS.map((h) => {
            const label = h === 0 ? '12 AM' : `${h} AM`
            const selected = (family?.daily_reset_hour ?? 0) === h
            return (
              <button
                key={h}
                onClick={() => actions.saveResetHour(h)}
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
              actions.saveResetHour(v)
            }}
            className="w-16 px-2 py-1 rounded-lg text-xs text-white/90 outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
      </div>
    </Section>
  )
}

function ParentLockSettings({ family, actions }: { family: Family | null; actions: ParentActions }) {
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await actions.setParentPin(pin)
    setPin('')
    setSaving(false)
  }

  return (
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
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none tracking-widest"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <ActionButton
              onClick={handleSave}
              label={saving ? '...' : 'Change'}
              disabled={pin.length !== 4 || saving}
              className="flex-shrink-0 px-5"
            />
          </div>
          <button
            onClick={actions.removeParentPin}
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
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none tracking-widest"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <ActionButton
              onClick={handleSave}
              label={saving ? '...' : 'Set PIN'}
              disabled={pin.length !== 4 || saving}
              className="flex-shrink-0 px-5"
            />
          </div>
        </div>
      )}
    </Section>
  )
}

function AddKidForm({ actions }: { actions: ParentActions }) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('GiWizardFace')
  const [color, setColor] = useState<KidColor>('azure')
  const [pin, setPin] = useState('')

  const handleAdd = async () => {
    await actions.addKid({ name, avatar, color, pin })
    setName('')
    setPin('')
  }

  return (
    <Section title="Add Adventurer">
      <div className="flex flex-col gap-3">
        <FormInput placeholder="Name..." value={name} onChange={setName} />
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Avatar</label>
          <div className="flex flex-wrap gap-2">
            {KID_AVATAR_KEYS.map((av) => (
              <button
                key={av}
                onClick={() => setAvatar(av)}
                className="w-10 h-10 rounded-xl transition-all flex items-center justify-center"
                style={{
                  background: avatar === av ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${avatar === av ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: avatar === av ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                }}
              >
                <AppIcon icon={av} size={20} />
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
                onClick={() => setColor(c)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize"
                style={{
                  background: color === c ? KID_COLORS[c].bg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${color === c ? KID_COLORS[c].border : 'rgba(255,255,255,0.08)'}`,
                  color: color === c ? KID_COLORS[c].primary : 'rgba(255,255,255,0.5)',
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
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none tracking-widest"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>

        <ActionButton
          onClick={handleAdd}
          label="+ Add Adventurer"
          disabled={!name.trim() || pin.length !== 4}
        />
      </div>
    </Section>
  )
}

function KidList({ kids, onShowQr, actions }: { kids: Kid[]; onShowQr: (kidId: string) => void; actions: ParentActions }) {
  const [editingCoinsKidId, setEditingCoinsKidId] = useState<string | null>(null)
  const [editCoinsValue, setEditCoinsValue] = useState('')
  const [revealPinKidId, setRevealPinKidId] = useState<string | null>(null)

  const handleSaveCoins = async (kidId: string) => {
    const val = parseInt(editCoinsValue, 10)
    await actions.saveCoins(kidId, val)
    setEditingCoinsKidId(null)
  }

  return (
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
                <AppIcon icon={kid.avatar} size={32} />
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
                    onClick={() => onShowQr(kid.id)}
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
  )
}

function InviteLink({ family, actions }: { family: Family; actions: ParentActions }) {
  return (
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
            onClick={actions.regenerateInviteToken}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
            title="Regenerate to invalidate old link"
          >
            ↻
          </button>
        </div>
      </div>
    </Section>
  )
}

function ApiKey({ family, actions }: { family: Family; actions: ParentActions }) {
  return (
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
          onClick={actions.regenerateApiKey}
          className="text-xs text-white/25 hover:text-red-400 transition-all text-center"
        >
          Regenerate key (invalidates current key)
        </button>
      </div>
    </Section>
  )
}
