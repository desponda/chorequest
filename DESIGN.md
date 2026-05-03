# ChoreQuest — Design System

## Aesthetic Direction

**Night-sky fantasy realm.** ChoreQuest feels like a magical RPG dashboard floating in deep space — dark and dramatic, with glowing celestial accents. The UI is simultaneously game-like (for kids) and refined (for parents). Every interaction should feel like casting a spell, not clicking a button.

---

## Color Palette

```css
--color-cq-void:    #050310   /* Background — near-black with deep violet undertone */
--color-cq-gold:    #fbbf24   /* Primary accent — amber gold for actions, rewards */
--color-cq-azure:   #38bdf8   /* Kid theme A — sky blue */
--color-cq-mystic:  #a78bfa   /* Kid theme B — violet purple */
--color-cq-ember:   #fb923c   /* Streaks, warnings, fire */
--color-cq-forest:  #4ade80   /* Success, approved, positive states */
```

### Background Treatment

`bg-quest-void` is never a flat color. It layers three radial gradients:
- Azure glow at top-left (20%, 15%) — 7% opacity
- Mystic glow at bottom-right (80%, 85%) — 7% opacity
- Gold center haze (50%, 50%) — 2.5% opacity

This creates a subtle "breathing" depth without being distracting.

### Opacity Scale

UI elements use consistent opacity levels for hierarchy:
- **100%** — interactive focus state
- **90–95%** — primary text, active elements
- **70–80%** — secondary text, labels
- **40–50%** — tertiary text, hints, inactive states
- **20–30%** — decorative text, dividers, timestamps
- **10–15%** — glass panel backgrounds

---

## Typography

| Use | Font | Weight | Class |
|-----|------|--------|-------|
| Titles, headings, buttons | Cinzel (serif) | 700–900 | `font-heading` |
| Body, labels, content | Nunito (rounded sans) | 400–700 | `font-sans` |

The Cinzel/Nunito pairing is intentional: Cinzel brings ancient gravitas (inscriptions on stone), Nunito softens it for readability and child-friendliness. Never use Inter, Roboto, or system fonts here.

**Tracking**: Headings and uppercase labels use generous letter-spacing (`tracking-widest`) for a regal, inscribed feel.

---

## Glass Morphism

Two levels of glass used throughout:

```css
.glass        { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); }
.glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); }
.border-glass { border: 1px solid rgba(255,255,255,0.09); }
```

Cards, panels, and overlays use these. Never use solid opaque backgrounds except for `bg-quest-void` itself.

---

## Kid Themes

Each kid has a color theme (`azure` or `mystic`) that tints their UI consistently:

```ts
KID_COLORS = {
  azure:  { primary: '#38bdf8', border: 'rgba(56,189,248,0.3)',  bg: 'rgba(56,189,248,0.08)'  },
  mystic: { primary: '#a78bfa', border: 'rgba(167,139,250,0.3)', bg: 'rgba(167,139,250,0.08)' },
}
```

Use `colors.primary` for text accents, `colors.bg` for card backgrounds, `colors.border` for borders.

Quest card glows are defined in globals.css as `.quest-card-glow-azure` and `.quest-card-glow-mystic`.

---

## Layout Principles

### Page Types

| Page | Layout | Notes |
|------|--------|-------|
| Wall display (`/`) | Fullscreen grid | Fills the entire TV/monitor — columns for each kid |
| Login (`/login`) | Centered `max-w-sm` | Single-column card, vertically centered |
| Kid view (`/kid/[id]`) | `max-w-md` centered | Phone-style UI, feels like a mobile app on desktop |
| Parent dashboard (`/parent`) | `max-w-2xl` centered | Management UI with tabs |

**Rule**: Only the wall display ever uses full viewport width. All other pages constrain content width so it never stretches across a wide desktop monitor.

### Spacing

- Page horizontal padding: `px-6` (24px) inside the content container
- Section gaps: `gap-4` (approvals), `gap-6` (management sections)
- Card padding: `p-4` standard, `p-8` for the login card

---

## Motion

Framer Motion is used throughout. Key principles:

- **Page entrances**: `initial={{ opacity: 0, y: 24 }}` → `animate={{ opacity: 1, y: 0 }}` with spring physics
- **Stagger children**: Each kid column and quest card delays by `i * 0.06–0.08s`
- **Idle animations**: The castle emoji bobs with `y: [0, -6, 0]` on a 4s repeat — subtle, not distracting
- **Loading state**: Opacity pulse `[0.3, 0.8, 0.3]` on a 2s repeat
- **Button interactions**: `whileHover` raises glow, `whileTap` scales to 0.97–0.98
- **Tab transitions**: `AnimatePresence mode="wait"` with `x: ±10` slide between tabs

Never add animations that feel "busy." One well-orchestrated entrance beats twelve micro-interactions.

---

## Interactive States

### Buttons

Primary action buttons (gold):
```
background: linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.12))
border: 1px solid rgba(251,191,36,0.4)
color: #fbbf24
hover: raise box-shadow to rgba(251,191,36,0.22)
```

Tab/toggle buttons (inactive → active):
```
inactive: rgba(255,255,255,0.05) bg, rgba(255,255,255,0.08) border, rgba(255,255,255,0.5) text
active:   rgba(251,191,36,0.14) bg, rgba(251,191,36,0.35) border, #fbbf24 text
```

### Form Inputs

```
background: rgba(255,255,255,0.06)
border: 1px solid rgba(255,255,255,0.1)
focus border: rgba(251,191,36,0.45) with box-shadow ring
```

---

## Component Patterns

### Section (parent dashboard)

Sections have a small-caps label above a glass panel:
```tsx
<p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">{title}</p>
<div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '...' }}>
  {children}
</div>
```

### Quest Card States

| State | Treatment |
|-------|-----------|
| Available | Normal glass card with kid-color glow on hover |
| Pending | Pulsing animation, amber/gold tint |
| Approved | Green (`cq-forest`) checkmark, reduced opacity |
| Rejected | Red tint, strikethrough |

### PIN Screen

The 4-digit PIN screen uses large numpad buttons on a `max-w-xs` centered layout. Dot indicators animate with `pinError` shake. The numpad is a 3-column grid with `⌫` in the bottom-right.

---

## Do Not

- Use Inter, Roboto, or any system font
- Stretch content to full viewport width (except the wall display)
- Use flat solid backgrounds for cards — always glass
- Add animations that repeat too fast (< 2s) or have too high amplitude
- Use pure white (`#ffffff`) text — use `text-white/90` or dimmer at most
- Use Tailwind's default purple/blue color palette — use the ChoreQuest custom tokens
