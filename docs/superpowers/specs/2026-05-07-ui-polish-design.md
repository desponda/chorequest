# ChoreQuest UI Polish — Design Spec

**Date:** 2026-05-07  
**Status:** Approved  
**Scope:** Alignment fixes across 5 problem areas + 3 extracted presentational components

---

## Problem Statement

Several UI components misalign when optional content is present — tier badges, status text, and notification badges all cause sibling elements to shift. The root causes are: raw text used where a fixed-height chip is needed, `items-start`/`items-center` mismatches, always-rendered empty containers, and variable-width columns in list rows.

---

## New Components

Three new files under `src/components/ui/`:

### `StatusChip`
**File:** `src/components/ui/status-chip.tsx`

A fixed-height pill for quest completion status. Replaces the raw `<p>` status text in QuestCard and the inline status spans in Approvals history rows.

Props:
```ts
{ status: 'pending' | 'approved' | 'rejected' | 'locked' }
```

Visual spec:
- `pending` — amber background/border, text `⏳ awaiting`, animated opacity pulse
- `approved` — green background/border, text `✓ done`
- `rejected` — red background/border, text `✗ retry`
- `locked` — white/5% background, text `claimed`
- All variants: `text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap`

### `TierBadge`
**File:** `src/components/ui/tier-badge.tsx`

The EPIC/LEGENDARY/RARE/NORMAL tier label. Consolidates copy-pasted inline badge markup from QuestCard and QuestRow.

Props:
```ts
{ tier: QuestTier }
```

- `normal` → renders nothing (return null)
- Other tiers → reads from `TIER_CONFIG[tier]` for color/label; `text-[10px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0`

### `KindBadge`
**File:** `src/components/ui/kind-badge.tsx`

The Shared / One-time kind indicator. Currently only in QuestRow; extracted for consistency.

Props:
```ts
{ kind: QuestKind }
```

- `personal` → renders nothing
- `shared` → `⚡ Shared` in amber
- `oneoff` → `⭐ One-time` in purple
- Style: `text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0`

---

## Fix 1 — QuestCard (`src/components/quest-card.tsx`)

**Root cause:** `flex items-start` on the outer row means the icon sits at the top-left while the coin+status column also starts at the top. When the status text (`awaiting...`, `✓ done!`, etc.) is raw `<p>` with variable width, the right column changes height between states and the layout jumps.

**Changes:**
1. Change outer row `items-start` → `items-center`
2. Replace all four status `<p>` elements with `<StatusChip status={...} />` — consistent pill height regardless of content
3. Right column structure becomes: `flex flex-col items-end gap-1` with coin row on top, `StatusChip` below (only rendered when there is a status)
4. Replace inline tier badge `<span>` with `<TierBadge tier={quest.tier} />`
5. Add `min-w-0` to middle `flex-1` div to prevent overflow pushing right column

**Result:** Icon and coin amount center-align with the title regardless of how many badges wrap in the middle. Right column is consistently 1–2 rows tall.

---

## Fix 2 — Parent tab bar (`src/app/parent/page.tsx`)

**Root cause:** 6 `flex-1` tabs each contain emoji + text label + optional badge. Below ~500px the content overflows: labels clip mid-character and badges overlap icons.

**Changes:**
- Below `sm` breakpoint: show emoji only (`<span className="sm:hidden">`) with badge as an absolute-positioned corner dot (`top-0.5 right-0.5`)
- At `sm` and above: current full-label layout unchanged
- Tab button gets `relative` so the corner badge positions correctly
- Badge dot on mobile shows count if > 0, otherwise not rendered (same logic as today)

**Result:** Each tab is a clean emoji square on mobile, full label on desktop. Badge never overlaps the icon.

---

## Fix 3 — QuestRow action buttons (`src/app/parent/quest-row.tsx`)

**Root cause:** Action buttons (✏️ / On / ✕) use `align-self: center` (default in `items-center` flex). When the title wraps to 2+ lines due to tier + kind badges, the buttons float to the vertical middle of the row instead of aligning with the title.

**Changes:**
1. Change outer row from `flex items-center gap-3` → `flex items-start gap-3`
2. Action button group `div`: add `self-start pt-0.5` so buttons pin to top
3. Replace inline tier badge `<span>` with `<TierBadge tier={quest.tier} />`
4. Replace inline kind badge `<span>` with `<KindBadge kind={quest.kind} />`

**Result:** Buttons always align with the first line of the title regardless of wrapping.

---

## Fix 4 — Kid column header badge row (`src/components/kid-column.tsx`)

**Root cause:** The `<div className="flex items-center gap-2">` that holds streak badge + curse badge always renders, even when both are absent. This adds ~8px of invisible vertical space to every kid column header that has no streak or curse, making columns with badges taller than columns without.

**Change:**
- Wrap the entire badge row div in a conditional: only render if `kid.streak > 1 || activeCurseCount > 0`
- When rendered, content and spacing are unchanged

**Result:** Consistent header card height across all kid columns regardless of which badges are active.

---

## Fix 5 — Approvals history rows (`src/app/parent/approvals-tab.tsx`)

**Root cause:** History rows use `flex items-center gap-3` with a variable-width status column (`+25🪙`, `✗`, `🎁 -50🪙`, `☠️ -5🪙`). The undo ↩ button shifts left/right depending on status text length.

**Changes:**
1. Switch each history row from `flex` to `grid` with fixed columns: `grid-cols-[1fr_auto_4rem_1.25rem]` — flexible title, auto date, fixed-width status (4rem), fixed-width undo (1.25rem)
2. Status column uses `text-right` so all values right-align within their fixed slot
3. Replace inline status text with `<StatusChip>` for completion rows

**Result:** ↩ button is always in the same horizontal position regardless of which status is shown.

---

## Files Changed

| File | Change type |
|------|------------|
| `src/components/ui/status-chip.tsx` | New |
| `src/components/ui/tier-badge.tsx` | New |
| `src/components/ui/kind-badge.tsx` | New |
| `src/components/quest-card.tsx` | Modified — Fix 1 |
| `src/app/parent/page.tsx` | Modified — Fix 2 |
| `src/app/parent/quest-row.tsx` | Modified — Fix 3 |
| `src/components/kid-column.tsx` | Modified — Fix 4 |
| `src/app/parent/approvals-tab.tsx` | Modified — Fix 5 |

---

## Out of Scope

- Display page bounty board cards (separate component, no reported issues)
- Kid page layout (no reported alignment issues)
- Any logic, data fetching, or animation changes
- New features or behavior changes
