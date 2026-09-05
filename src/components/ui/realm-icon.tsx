import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  BedDouble,
  BookOpen,
  BrushCleaning,
  CalendarDays,
  Castle,
  Check,
  CircleCheckBig,
  CircleDollarSign,
  CircleX,
  CloudLightning,
  Coins,
  CookingPot,
  Crown,
  Flame,
  Gift,
  House,
  Leaf,
  LockKeyhole,
  LogOut,
  Medal,
  Menu,
  Monitor,
  PawPrint,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Shield,
  ShieldCheck,
  Skull,
  Sparkles,
  Star,
  Sword,
  Swords,
  Timer,
  Trash2,
  Trophy,
  Undo2,
  UsersRound,
  Utensils,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'

/**
 * ChoreQuest stores a few icon choices as emoji strings for backwards
 * compatibility. Render those values through one consistent icon language so
 * the UI does not inherit the platform-specific look of emoji glyphs.
 */
const ICONS: Record<string, LucideIcon> = {
  '⚔️': Swords,
  '⚔': Swords,
  '🗡️': Sword,
  '🗡': Sword,
  '🛡️': Shield,
  '🛡': Shield,
  '🛏️': BedDouble,
  '🛏': BedDouble,
  '🐱': PawPrint,
  '📚': BookOpen,
  '🗑️': Trash2,
  '🗑': Trash2,
  '🍽️': Utensils,
  '🍽': Utensils,
  '🍳': CookingPot,
  '🧹': BrushCleaning,
  '🚗': House,
  '🌿': Leaf,
  '🖥️': Monitor,
  '🖥': Monitor,
  '⭐': Star,
  '🌟': Star,
  '🔥': Flame,
  '⚡': Zap,
  '🎁': Gift,
  '🔒': LockKeyhole,
  '🪙': Coins,
  '✦': Sparkles,
  '✨': Sparkles,
  '🏰': Castle,
  '☠️': Skull,
  '☠': Skull,
  '🌩️': CloudLightning,
  '🌩': CloudLightning,
  '🧙': WandSparkles,
  '🧙‍♀️': WandSparkles,
  '🧝': Crown,
  '🧝‍♂️': Crown,
  '🎯': CircleDollarSign,
  '🏆': Trophy,
  '💫': Sparkles,
  '👨‍👩‍👧': UsersRound,
  '👁️': Monitor,
  '👁': Monitor,
  '↺': RotateCcw,
  '↩': Undo2,
  '✓': Check,
  '✗': X,
  '⏳': Timer,
  '🔐': ShieldCheck,
  '←': ArrowLeft,
  '→': ArrowLeft,
  '✏️': Pencil,
  '✏': Pencil,
  '＋': Plus,
  '+': Plus,
  '☰': Menu,
  '⚙️': Settings,
  '⚙': Settings,
  '🚪': LogOut,
  '💰': CircleDollarSign,
  '🏅': Medal,
  '🔄': RotateCcw,
  '📅': CalendarDays,
  '📒': BookOpen,
  '⭕': CircleCheckBig,
  '❌': CircleX,
}

interface RealmIconProps {
  name: string
  size?: number
  strokeWidth?: number
  className?: string
  title?: string
}

export function RealmIcon({ name, size = 18, strokeWidth = 1.9, className, title }: RealmIconProps) {
  const Icon = ICONS[name]

  if (!Icon) {
    return <Sparkles size={size} strokeWidth={strokeWidth} className={className} aria-label={title ?? name} aria-hidden={title ? undefined : true} />
  }

  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden={title ? undefined : true} aria-label={title} />
}
