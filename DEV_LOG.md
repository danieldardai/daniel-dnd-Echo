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

### Session 8 — Encounter sidebar: Monsters & NPCs
- **`index.html`:** Added `<div class="dm-encounter-sidebar" id="dmEncounterSidebar">` as a third column inside `.dm-body` (right of dm-main)
- **`js/dm.js`:**
  - New state: `monsters {}`, `selectedEncType` ("monster"|"npc"), `unsubMonsters`
  - `startListening()` now also subscribes to `monsters` collection (ordered by `createdAt`)
  - `renderEncounterSidebar()` — builds shell once (filter buttons + add form), then calls `renderEncounterList()`
  - `addEncounter()` — writes to `monsters` collection with name, hp, hpMax, type, createdAt
  - `renderEncounterList()` — renders HP bar + Dmg/Heal controls per entry; damage logs to `sessionLog`
  - Delete button with confirm dialog calls `deleteDoc`
- **`css/dm.css`:** Added `.dm-encounter-sidebar` (200px right sidebar), `.dm-enc-header`, `.dm-enc-filter-btn`, `.dm-enc-add`, `.dm-enc-hp-row`, `.dm-enc-list`, `.dm-enc-card`, `.dm-enc-bar-track`, `.dm-enc-actions`, `.dm-enc-amt`
- **`patch-monsters.mjs`:** Seeds 4 monsters (Goblin Scout, Orc Warrior, Shadow Wraith, Giant Spider) and 4 NPCs (Torven the Innkeeper, Guard Captain Mira, The Mysterious Stranger, Elder Morthis)
- **Firestore:** Requires `monsters` collection with `allow read, write: if true` rule

### Session 9 — Scenes: map images, grid overlay, character tokens
- **`index.html`:** Added `🏞️ Scenes` tab button + `#dm-tab-scenes` panel inside the DM panel
- **`js/dm.js`:**
  - New state: `scenes {}`, `selectedSceneLocId`, `unsubScenes`
  - `startListening()` now subscribes to `scenes` collection (`onSnapshot`)
  - `renderActiveTab()` handles `"scenes"` tab (no char required, like Locations)
  - `renderCharList()`: character sidebar buttons are now `draggable = true` with `charId` in dataTransfer — characters can be dragged onto the scene grid
  - `renderScenesTab()` — location selector + two side-by-side scene panels (current / next)
  - `buildScenePanel()` — builds upload area (no image) OR image+grid+tokens (has image); shows scale row; attach dragover for image file drops
  - `drawGrid(canvas, natW, natH, widthM)` — draws 1m×1m grid lines on canvas at natural image resolution; CSS scales to display size
  - `renderTokens()` — renders character tokens as percentage-positioned absolute divs; HP ring color matches HP level; hover shows ✕ remove button
  - `setupTokenDropZone()` — dragover/drop on token layer; calculates grid cell from mouse position; writes to Firestore
  - `saveScene(locId, sceneKey, data)` — `setDoc` with `{ merge: true }` to `scenes/{locId}`
  - `handleSceneImageUpload()` — canvas-compress to max 1200px JPEG 0.65; stores base64 in Firestore; reads current scale input for widthM; auto-calculates heightM from aspect ratio
- **`css/dm.css`:** Added scene styles: `.dm-scene-loc-selector`, `.dm-scene-panels` (2-col grid), `.dm-scene-panel`, `.dm-scene-map-wrap` (position: relative container), `.dm-scene-img`, `.dm-scene-grid-canvas` (absolute overlay), `.dm-scene-token-layer`, `.dm-scene-token`, `.dm-scene-token-inner`, `.dm-scene-token-remove`, `.dm-scene-scale-row`, `.dm-scene-upload-area`
- **Firestore:** Requires `scenes` collection with `allow read, write: if true` rule added in Firebase Console
- **Scenes Firestore structure:**
  ```
  scenes/{locId}: {
    current: { image: "data:image/jpeg;base64,…", widthM: 20, heightM: 15, tokens: [{charId, x, y}] },
    next:    { image: "…", widthM: 10, heightM: 8, tokens: [] }
  }
  ```

### Session 11 — DM Scenes tab: dropdown + Go Live + character filter

#### Overview
Replaced the all-locations-at-once Scenes view with a single-location dropdown, added a **▶ Go Live** button that atomically promotes the Next Scene to Current, fixed the Scenes tab character sidebar filter, and hardened the Go Live → character sheet live-update path.

#### DM Scenes tab: dropdown (`js/dm.js`, `css/dm.css`)
- `renderScenesTab()` now builds a **dropdown** (`<select>`) at the top + an empty `#dmScenePanelsWrap` div below.
- New `renderScenePanels()` function builds ONLY the two scene panels for `selectedSceneLocId`. Called by:
  - `renderScenesTab()` after creating the header
  - The dropdown `change` listener (preserves header, replaces panels only)
  - The Firestore `scenes` snapshot callback — but ONLY if `#dmScenePanelsWrap` already exists; otherwise falls back to `renderScenesTab()` (full init)
- **Why the split matters:** the previous `renderScenesTab()` rebuilt everything on every Firestore update, resetting the dropdown to whatever was in state. Now only the panels refresh, so the dropdown selection survives live data updates.
- `selectedSceneLocId` (already existed as module-level state) is preserved across every panel re-render. Defaults to `sortedLocs[0].id` if null or pointing to a deleted location.
- `css/dm.css` — `.dm-scene-loc-selector` gains `padding`, `border-bottom`, and `flex-shrink: 0`; added `.dm-scene-loc-select` alias to the existing width rule; `#dmScenePanelsWrap` gets `flex: 1; overflow-y: auto; padding`.

#### Character sidebar filter
- `renderCharList()` now reads `activeTab()`. When `=== "scenes"` AND `selectedSceneLocId` is set, it filters to only characters whose `char.locationId === selectedSceneLocId`.
- The dropdown `change` listener calls `renderCharList()` after `renderScenePanels()` so the sidebar updates immediately on location switch.

#### ▶ Go Live button (`js/dm.js`)
- Added to the **Next Scene** panel header (only when image is present, `sceneKey === "next" && hasImage`).
- **Original bug: two sequential writes → two Firestore events → render race on character sheet.**
  - `await saveScene(locId, "current", nextData)` — event 1
  - `await saveScene(locId, "next", null)` — event 2
  - The character sheet's `_sceneRenderSeq` guard killed the first render (superseded by event 2), and the second render sometimes didn't complete visually.
- **Fix:** single atomic `updateDoc` call with `deleteField()` for `next`:
  ```javascript
  await updateDoc(doc(db, "scenes", locId), {
    current: nextData,
    next: deleteField(),
  });
  ```
  One write → ONE Firestore snapshot on the character sheet → ONE `renderScene()` call → no guard interference.
- Added `deleteField` to dm.js imports.
- `nextData` is read from live `scenes[locId]?.next` (falls back to the render-time `sceneData` parameter) to ensure the latest token positions are included.

---

### Session 10 — Campaign tab: current scene viewer + layout overhaul

#### Final layout of `#tab-log`
```
#tab-log  (flex column, position:absolute inset:0)
├── .campaign-scene-section   (flex: 1 — fills ~80% of height)
│   └── .campaign-scene-wrap  (flex:1; overflow:hidden; position:relative)
│       └── .campaign-scene-map-wrap  (position:absolute; inset:0)
│           ├── .campaign-scene-img          (width/height:100%; object-fit:contain)
│           ├── .campaign-scene-grid-canvas  (position:absolute — JS-positioned)
│           └── .campaign-scene-token-layer  (position:absolute — JS-positioned)
└── .log-split  (flex: 0 0 20% — pinned bottom strip)
    ├── .log-tab-bar   (toggle buttons: Character Log / Location Log)
    └── .log-col × 2  (only one visible at a time via .hidden class)
```

#### `character.html` changes
- Nav tab renamed `"📜 Campaign Log"` → `"📜 Campaign"`
- `#tab-log` restructured: `.campaign-scene-section` on top (scene map), `.log-split` at bottom (log strip)
- `.log-split` now has `.log-tab-bar` with two toggle `<button class="log-tab-btn">` elements (`data-log="local"` / `data-log="location"`) instead of two always-visible columns
- Each `.log-col` gets an `id` (`logColLocal` / `logColLocation`); second starts with `.hidden`

#### `js/sheet.js` changes
- **Imports:** added `getDocFromServer`
- **State:** `sceneData`, `unsubScene`, `monsters`, `_sceneRenderSeq`
- **`initSceneListener(locationId)`** — unsubscribes old listener, re-subscribes to `scenes/{locId}`; called from `renderLocation()` whenever `locationId` changes
- **`renderScene()`** — rebuilds the entire `#campaignSceneWrap` DOM on each call; increments `_sceneRenderSeq` so stale async renders are discarded (see Tricky Bits below)
- **`drawSceneGrid(canvas, natW, natH, widthM)`** — draws at natural image resolution; CSS scales it
- **`renderSceneTokens(tokenLayer, widthM, heightM, tokens)`** — character tokens get portrait bubble + HP-color ring; current character gets gold ring; monster tokens get emoji bubble + red rectangle; **orphaned monster tokens (monster deleted but token remains in scene doc) are skipped with `if (!m) return`**
- **Monsters listener** added inside `initLogs()` — subscribes to `monsters` collection; calls `renderScene()` on any change so token labels stay current
- **Tab switch:** `renderScene()` called immediately + `getDocFromServer` fetch fires asynchronously to catch any missed Firestore events (stale WebSocket protection)
- **Log toggle:** `document.querySelectorAll(".log-tab-btn")` handler toggles `#logColLocal` / `#logColLocation` hidden state

#### `css/sheet.css` changes
- `.campaign-scene-section` — `flex: 1; overflow: hidden` (no fixed height — fills all space above the log strip)
- `.campaign-scene-wrap` — `flex: 1; overflow: hidden; position: relative` (no scrolling — scene must fit)
- `.campaign-scene-map-wrap` — `position: absolute; inset: 0` (fills wrap completely)
- `.campaign-scene-img` — `width: 100%; height: 100%; object-fit: contain` (letterbox to fit without cropping)
- `.campaign-scene-grid-canvas` and `.campaign-scene-token-layer` — `position: absolute` only; left/top/width/height set by JS to align with actual image display rect
- `#tab-log .log-split` override — `flex: 0 0 20%; display: flex; flex-direction: column; grid-template-columns: unset; border-top`
- `#tab-log .log-col` override — `flex: 1; border: none; border-radius: 0; background: transparent`
- `.log-tab-bar`, `.log-tab-btn`, `.log-tab-btn.active` — tab-strip toggle styling
- Token styles: `.campaign-scene-token-bubble` (speech bubble above token with `::after` downward arrow), `.campaign-scene-bubble-img` (30px circle portrait), `.campaign-scene-token-marker` (circle, CSS var `--ring-color`), `.me` (gold ring for current char), `--enc` (rect for monsters)

#### ⚠️ Tricky Bits — read before touching this code

**1. `object-fit: contain` breaks canvas/token overlay alignment**
When an `<img>` uses `object-fit: contain` inside a fixed container, the image is letterboxed. A canvas `position:absolute; inset:0` over the same container covers the FULL container including the letterbox bars — the grid lines don't align with the image content. Fix: after the image loads, calculate the actual displayed rect in JS:
```javascript
const scale = Math.min(containerW / natW, containerH / natH);
const dW = natW * scale;  const dH = natH * scale;
const oX = (containerW - dW) / 2;  const oY = (containerH - dH) / 2;
canvas.style.left = `${oX}px`; canvas.style.top = `${oY}px`;
canvas.style.width = `${dW}px`; canvas.style.height = `${dH}px`;
// same for tokenLayer
```
This must run AFTER `img.offsetWidth` is valid (i.e., after the image fires `onload` or synchronously if `img.complete && img.naturalWidth > 0`).

**2. Render sequence guard (`_sceneRenderSeq`)**
`renderScene()` increments a counter and captures it in the `onReady` closure. Before writing to the DOM, the closure checks `if (seq !== _sceneRenderSeq) return`. This discards stale renders when two Firestore events arrive close together (e.g., monsters listener fires while a scene update is in flight). Without this, a slow-decoding base64 image from render N could overwrite the correct DOM from render N+1.

**3. Base64/data URI image loading is unpredictably sync or async**
For `data:` URIs, `img.complete` may be `true` immediately after setting `img.src` in some browsers (image decoded synchronously). In others it fires `onload` asynchronously. Always handle both: `if (img.complete && img.naturalWidth) onReady(); else img.addEventListener("load", onReady)`.
`img.offsetWidth` accessed synchronously (after DOM append but before a layout tick) forces a reflow and returns the correct value. Do NOT trust it when the containing element is `display:none`.

**4. Orphaned monster tokens**
When a monster is deleted from the `monsters` collection but its token is still in `scenes/{locId}.current.tokens`, `monsters[token.monsterId]` is `undefined`. The guard `if (!m) return` inside `renderSceneTokens` silently skips these. Without it, `|| {}` fallback would render an empty-name `💀` token forever.

**5. `getDocFromServer` as live-update safety net**
Firestore's WebSocket can go stale (brief disconnect, mobile background, tab sleep). When this happens `onSnapshot` stops delivering updates; after a refresh the latest data appears because `getDoc` hits the server directly. Fix: on Campaign tab click, fire `getDocFromServer(doc(db, "scenes", locId))` in the background. If the fetched data differs from `sceneData`, update and re-render. This is additive — it does NOT replace the `onSnapshot` listener.

### Session 7 — General Actions narrate interface
- **`js/sheet.js`:** Replaced direct-log general action buttons with a narrate workflow:
  - Textarea at top of General Actions column for free-form input (English/Hungarian/mixed)
  - `✨ Narrate` send button calls `callClaudeAction()` → Claude outputs `🇬🇧 English` + `🇭🇺 Hungarian` versions → logged to `sessionLog`
  - 10 quick-action buttons (Search, Reveal, Heal, Dash, Dodge, Help, Hide, Ready, Disengage, Stabilize) now prefill the textarea with a first-person sentence instead of firing immediately; player edits then sends
  - Ctrl/Cmd+Enter keyboard shortcut to send
  - API key prompt on first use (same `localStorage["ebClaudeApiKey"]` as DM panel)
  - Status line shows `✨ Narrating…` while awaiting API, error message on failure
- **`css/sheet.css`:** Added `.action-narrate-textarea`, `.action-narrate-send-row`, `.action-narrate-status`, `.btn-narrate` (purple/arcane theme), `.action-narrate-divider`, `.action-narrate-grid`, `.action-narrate-btn`, `.action-narrate-icon`, `.action-narrate-name`
- **`callClaudeAction(text, charName)`** added in `sheet.js` — same model (`claude-haiku-4-5-20251001`) and key storage as DM's `callClaude()`; prompt instructs bilingual output in `🇬🇧 / 🇭🇺` format

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
