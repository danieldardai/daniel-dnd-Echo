# Echoes Beneath — Website

A real-time D&D campaign site: character selection + live action-driven character sheets, powered by Firebase Firestore + Netlify.

## Project Structure

```
echoes-beneath/
├── index.html           ← character selection + session log
├── character.html       ← live character sheet
├── css/
│   ├── style.css
│   └── sheet.css
└── js/
    ├── firebase-config.js
    ├── characters.js    ← real-time card grid
    ├── session-log.js   ← live log feed
    ├── sheet.js         ← full sheet logic
    └── ui.js
```

## Deploy to Netlify

Drag `echoes-beneath/` onto app.netlify.com/drop — no build step needed.

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /characters/{id} {
      allow read, write: if true;
    }
    match /sessionLog/{id} {
      allow read, create: if true;
      allow update, delete: if false;
    }
  }
}
```

## Character Document Fields

| Field        | Type   | Notes                                              |
|--------------|--------|----------------------------------------------------|
| name         | string | Required                                           |
| player       | string | Player name                                        |
| class        | string | e.g. "Ranger"                                      |
| race         | string | e.g. "Half-Elf"                                    |
| level        | number |                                                    |
| tagline      | string | Short quote on card                                |
| portrait     | string | Image URL                                          |
| emoji        | string | Fallback e.g. "🏹"                                 |
| hp           | number | Current HP (updated by UI)                         |
| hpMax        | number | Max HP                                             |
| hpTemp       | number | Temp HP                                            |
| deathSaves   | map    | { successes:[f,f,f], failures:[f,f,f] }            |
| conditions   | map    | { Poisoned: false, Blinded: true, … }              |
| spellSlots   | map    | { "Level 1": { total:4, used:0 }, … }              |
| spells       | array  | [{ name, school, level, slotLevel, castingTime, range, notes }] |
| inventory    | array  | [{ name, qty, consumable }]                        |
| stats        | map    | { AC:15, Speed:30, Initiative:"+3" }               |
| notes        | string | Player notes                                       |

## spells — slotLevel

Set `slotLevel` to the slot tier the spell consumes (1, 2, 3…).
Cantrips: omit `slotLevel`.

## inventory — consumable

`consumable: true` → Use button, decrements qty.
`consumable: false` → shown as equipped, no button.

## Session Log

Every action auto-writes to `sessionLog` collection and appears live on the index page. Entries are append-only.
