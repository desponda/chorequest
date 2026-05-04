import type { IconType } from 'react-icons'
import {
  GiBroom, GiVacuumCleaner, GiTrashCan, GiWashingMachine, GiHanger,
  GiBed, GiCookingPot, GiKnifeFork, GiSoap, GiToothbrush,
  GiGardeningShears, GiWateringCan, GiFlowerPot, GiShoppingCart, GiWindow,
  GiPaintBrush, GiMusicalNotes, GiRunningShoe, GiWhiteBook, GiPencilBrush,
  GiSwordman, GiShield, GiCrown, GiStarMedal, GiTrophyCup, GiTreasureMap,
  GiWizardFace, GiNinjaHead, GiPirateCaptain, GiVikingHead, GiBlackKnightHelm,
  GiElfEar, GiDwarfFace, GiGoblinHead, GiDragonHead, GiFoxHead,
  GiUnicorn, GiCat, GiPanda, GiWolfHead, GiEagleHead, GiVintageRobot,
  GiPresent, GiPopcorn, GiRetroController, GiPizzaSlice, GiTicket,
  GiTwoCoins, GiSpiralLollipop, GiRibbonMedal, GiRoundStar, GiUnicycle,
} from 'react-icons/gi'

export type IconKey = string

const REGISTRY: Record<string, IconType> = {
  // ── Quest / chore icons ─────────────────────────────────────────────────
  GiBroom,
  GiVacuumCleaner,
  GiTrashCan,
  GiWashingMachine,
  GiHanger,
  GiBed,
  GiCookingPot,
  GiKnifeFork,
  GiSoap,
  GiToothbrush,
  GiGardeningShears,
  GiWateringCan,
  GiFlowerPot,
  GiShoppingCart,
  GiWindow,
  GiPaintBrush,
  GiMusicalNotes,
  GiRunningShoe,
  GiWhiteBook,
  GiPencilBrush,
  GiSwordman,
  GiShield,
  GiCrown,
  GiStarMedal,
  GiTrophyCup,
  GiTreasureMap,

  // ── Kid avatars ─────────────────────────────────────────────────────────
  GiWizardFace,
  GiNinjaHead,
  GiPirateCaptain,
  GiVikingHead,
  GiBlackKnightHelm,
  GiElfEar,
  GiDwarfFace,
  GiGoblinHead,
  GiDragonHead,
  GiFoxHead,
  GiUnicorn,
  GiCat,
  GiPanda,
  GiWolfHead,
  GiEagleHead,
  GiVintageRobot,

  // ── Reward icons ────────────────────────────────────────────────────────
  GiPresent,
  GiPopcorn,
  GiRetroController,
  GiPizzaSlice,
  GiTicket,
  GiTwoCoins,
  GiSpiralLollipop,
  GiRibbonMedal,
  GiRoundStar,
  GiUnicycle,
}

export function getIcon(key: string): IconType | null {
  return REGISTRY[key] ?? null
}

export function isIconKey(value: string): boolean {
  return value in REGISTRY
}

export const QUEST_ICON_KEYS = [
  'GiBroom', 'GiVacuumCleaner', 'GiTrashCan', 'GiWashingMachine', 'GiHanger',
  'GiBed', 'GiCookingPot', 'GiKnifeFork', 'GiSoap', 'GiToothbrush',
  'GiGardeningShears', 'GiWateringCan', 'GiFlowerPot', 'GiShoppingCart', 'GiWindow',
  'GiPaintBrush', 'GiMusicalNotes', 'GiRunningShoe', 'GiWhiteBook', 'GiPencilBrush',
  'GiSwordman', 'GiShield', 'GiCrown', 'GiStarMedal', 'GiTrophyCup', 'GiTreasureMap',
] as const

export const KID_AVATAR_KEYS = [
  'GiWizardFace', 'GiNinjaHead', 'GiPirateCaptain', 'GiVikingHead', 'GiBlackKnightHelm',
  'GiElfEar', 'GiDwarfFace', 'GiGoblinHead', 'GiDragonHead', 'GiFoxHead',
  'GiUnicorn', 'GiCat', 'GiPanda', 'GiWolfHead', 'GiEagleHead', 'GiVintageRobot',
] as const

export const REWARD_ICON_KEYS = [
  'GiPresent', 'GiPopcorn', 'GiRetroController', 'GiPizzaSlice', 'GiTicket',
  'GiTwoCoins', 'GiSpiralLollipop', 'GiRibbonMedal', 'GiRoundStar', 'GiBicycle',
  'GiTrophyCup', 'GiTreasureMap', 'GiCrown', 'GiStarMedal',
] as const
