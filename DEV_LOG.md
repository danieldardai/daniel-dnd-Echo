# Echoes Beneath — Development Log

A running record of all major changes, decisions, and implementation details.
Reference this before modifying any system to understand context and constraints.

---

## Project Overview

**Stack:** Vanilla JS (ES modules) + Firebase Firestore (realtime) + Netlify (static deploy)
**Pages:** `index.html` (lobby + session log), `character.html` (player sheet)
**Key files:**
| File | Purpose |
|------|---------|
| `js/firebase-config.js` | Firestore init |
| `js/characters.js` | Index page — character card grid + location grouping |
| `js/session-log.js` | Index page — live log feed + location tabs |
| `js/sheet.js` | Character sheet — HP, spells, inventory, actions, log |
| `js/dm.js` | DM overlay panel — all DM control logic |
| `js/ui.js` | UI helpers (stars background, modal) |
| `css/style.css` | Index page styles |
| `css/sheet.css` | Character sheet styles |
| `css/dm.css` | DM panel styles |
| `seed.mjs` | Node script — seed Firestore with initial character data |
| `patch-spells.mjs` | Node script — patch spell + slot data into existing characters |

**Firestore collections:**
- `characters/{id}` — character documents
- `sessionLog/{id}` — append-only event log
- `locations/{id}` — location documents (order, emoji, name, description)
- `campaign/{docId}` — per-location turn state (active, round, phase, description)

---

## Cumulative Feature List

### Session 1 — Initial build
- `index.html`: character card grid, loading/empty/error states
- `character.html`: full character sheet skeleton
- Firebase Firestore integration, real-time `onSnapshot` on characters
- Basic HP display, HP bar color (green > 60%, amber > 30%, red ≤ 30%)
- Character modal (click card → details popup)
- Stars background animation (`ui.js`)

### Session 2 — DM View
- DM float button (bottom-right, password-gated with hardcoded `"1234"`)
- DM panel overlay with sidebar character list + tab area
- **Combat tab:** HP damage/heal/set/setMax, conditions grid (10 conditions), death saves
- **Stats tab:** base stats (10 custom stats) + temporary modifiers, clear-all modifiers
- **Inventory tab:** consumables (qty ±) + equipment (equip/unequip), add forms with emoji picker
- **Log tab:** manual session event injection, character notes save
- `dmLog()` helper — all DM actions write to `sessionLog`
- Custom emoji picker popup (`EMOJI_CATEGORIES`, 8 categories)

### Session 3 — Ammo system + Dice rolls
- `sheet.js`: ammo auto-deduction on ranged weapon use
- Dice roll tab on character sheet — rolls weapon dice + logs to session log
- Merged into master via PR

### Session 4 — Turn system, Spells tab, AI narrative
- **Turn system** (`dm.js` + `campaign` collection):
  - Per-location turn tracking (each location/global gets its own `campaign/{locId}` doc)
  - DM turn strip (always visible at top of DM panel)
  - Phases: combat ⚔️, exploration 🗺️, roleplay 💬, downtime 🏕️
  - New Turn → Begin; active turn shows round number; Next Round; End Turn
  - All turn events write to `sessionLog` with `locationId`
- **Spells tab** (`dm.js`):
  - Spell slot tracker with pip visualization (used/total)
  - Spell list with category icons (attack ⚔️, defense 🛡️, general ✨)
  - Inline dice formula input per spell (saved to Firestore)
  - Reset/±  controls per slot level
- **AI narrative enhance** (`dm.js` → Claude API):
  - "✨ Enhance" button on turn description textarea
  - Calls `claude-haiku-4-5-20251001` via direct browser fetch
  - Prompt: accepts English or Hungarian input, returns both `🇬🇧 / 🇭🇺` versions
  - API key stored in `localStorage` under `ebClaudeApiKey`
  - Undo button to revert to original text
  - 🔑 key config button

### Session 5 — Turn descriptions in log feed
- DM turn entries appear in log feed as styled narrative blocks (`log-entry--turn`)
- Turn entries have `locationId` field for location-tab filtering
- **Moved** turn descriptions out of a banner and into the log feed directly

### Session 6 (current) — Location-grouped character cards + Spell patch script
- **`characters.js`:** rerender() now checks if any locations exist; if yes, groups cards into `<div class="location-section">` sections (one per location + "Unassigned" for unmapped chars)
- **`css/style.css`** (uncommitted): added `.location-section`, `.location-section-header`, `.location-section-name`, `.location-section-desc`, `.location-card-grid`, responsive breakpoints
- **`patch-spells.mjs`** (new, uncommitted): Node/Firebase-Admin script to bulk-patch spell + spellSlot data into Firestore for 8 characters (Korrath, Zeth, Lirien, Seraphine, Mara, Torvin, Finn, Sylvara)

---

## Important Architecture Notes

### Real-time pattern
Every page feature uses `onSnapshot` — no manual fetches. Data flows:
`Firestore → onSnapshot → local state object → render function`.
Never hold stale data; always read from the local state map (e.g. `characters[id]`) before writing back to Firestore.

### Session log — event types
`damage` | `heal` | `spell` | `slot` | `condition` | `inventory` | `death` | `note` | `roll` | `turn` | `system`
Each log doc: `{ type, actor, message, timestamp, charId, locationId? }`

### Location filtering
- `session-log.js` filters log entries: turn entries use `data.locationId`; character action entries resolve via `charToLocId[charId]`
- `characters.js` groups card grid by `char.locationId`
- DM turn strip uses `selectedTurnLocId` (defaults to `"__global__"`)

### DM password
Hardcoded `"1234"` in `dm.js:7`. Stored only in memory (`dmUnlocked` flag) — resets on page reload.

### AI (Claude) integration
Direct browser-to-Anthropic API call — requires `"anthropic-dangerous-direct-browser-access": "true"` header.
Model: `claude-haiku-4-5-20251001`. Key in `localStorage["ebClaudeApiKey"]`.

### Inventory item classification
`isEquip(item)` in `dm.js`: `type === "weapon" | "armor" | "equipment"` OR `item.weapon === true`.
Consumables are everything else. This drives the two-column layout in the Inventory tab.

### Spell slots Firestore structure
```
spellSlots: {
  "Level 1": { total: 4, used: 0 },
  "Level 2": { total: 3, used: 0 },
  ...
}
```
Cantrips: `level: 0`, no `slotLevel` field.

### Stats system (custom, not standard D&D)
10 stats: Might, Agility, Endurance, Knowledge, Perception, Ingenuity, Presence, Will, Empathy, Resonance
Stored in `character.stats` (base) and `character.statModifiers` (temporary). Equipment can have `statEffects` map.

---

## Known Constraints / Gotchas

- **No build step** — plain ES modules, everything loaded via CDN (Firebase 10.13.0, Google Fonts). Must stay deployable by drag-drop to Netlify.
- **Firestore rules** allow full public read/write on `characters` and `locations`; `sessionLog` is read+create only (no update/delete). `campaign` collection rules should mirror `characters`.
- `patch-spells.mjs` and `seed.mjs` require `serviceAccountKey.json` (gitignored) and run via `node`.
- `characters.js` uses a `cardMap` cache — cards are only rebuilt on location change or add/remove; HP/conditions update in-place via `updateCard()`.
- The `rerender()` in `characters.js` waits for both `charsLoaded` and `locsLoaded` before rendering, to avoid a flash of ungrouped cards.
