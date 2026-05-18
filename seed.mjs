/**
 * seed.mjs
 * Run once to populate Firestore with all 5 characters.
 *
 * HOW TO USE:
 *   1. Install the Firebase Admin SDK:
 *        npm install firebase-admin
 *
 *   2. Generate a service account key:
 *        Firebase Console → Project Settings → Service Accounts
 *        → Generate new private key → save as serviceAccountKey.json
 *        in the same folder as this file
 *
 *   3. Run:
 *        node seed.mjs
 *
 *   Done — refresh your site and the characters will appear.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore }        from "firebase-admin/firestore";
import { createRequire }       from "module";

const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const characters = [
  {
    name:    "Varek Ashborne",
    player:  "???",
    class:   "Blood Hunter",
    race:    "Human",
    level:   6,
    tagline: "Some debts are paid in blood. Mine is no exception.",
    emoji:   "🩸",
    hp:      48,
    hpMax:   48,
    hpTemp:  0,
    deathSaves: { successes: [false,false,false], failures: [false,false,false] },
    conditions: { Poisoned:false, Blinded:false, Frightened:false, Exhausted:false, Cursed:false },
    spellSlots: {
      "Level 1": { total:3, used:0 },
      "Level 2": { total:2, used:0 }
    },
    spells: [
      { name:"Crimson Rite",   level:0, castingTime:"1 bonus action", range:"Self",  notes:"Imbue weapon with elemental damage" },
      { name:"Wrathful Smite", level:1, slotLevel:1, castingTime:"1 bonus action", range:"Self" },
      { name:"Misty Step",     level:2, slotLevel:2, castingTime:"1 bonus action", range:"Self" }
    ],
    inventory: [
      { name:"Hunter's Mark Sigil",   qty:1,  consumable:false },
      { name:"Silvered Dagger",       qty:2,  consumable:false },
      { name:"Vial of Monster Blood", qty:3,  consumable:true  },
      { name:"Health Potion",         qty:2,  consumable:true  }
    ],
    stats: { AC:16, Speed:"9 m", Initiative:"+3", "Passive Perc":13 },
    notes: ""
  },
  {
    name:    "Sable Voss",
    player:  "???",
    class:   "Rogue (Phantom)",
    race:    "Shadar-Kai",
    level:   6,
    tagline: "I have already died once. I am in no hurry to do it again.",
    emoji:   "🌑",
    hp:      42,
    hpMax:   42,
    hpTemp:  0,
    deathSaves: { successes:[false,false,false], failures:[false,false,false] },
    conditions: { Poisoned:false, Blinded:false, Invisible:false, Exhausted:false, Cursed:false },
    spellSlots: {
      "Level 2": { total:2, used:0 }
    },
    spells: [
      { name:"Tokens of the Departed", level:0, castingTime:"1 reaction",    range:"9 m",  notes:"Soul trinket on kill — Advantage or +1d6 necrotic" },
      { name:"Misty Step",             level:2, slotLevel:2, castingTime:"1 bonus action", range:"Self" }
    ],
    inventory: [
      { name:"Thieves' Tools", qty:1,  consumable:false },
      { name:"Hand Crossbow",  qty:1,  consumable:false },
      { name:"Crossbow Bolt",  qty:20, consumable:true  },
      { name:"Smoke Bomb",     qty:3,  consumable:true  },
      { name:"Health Potion",  qty:1,  consumable:true  },
      { name:"Soul Trinket",   qty:0,  consumable:false }
    ],
    stats: { AC:15, Speed:"9 m", Initiative:"+5", "Passive Perc":14, "Sneak Attack":"3d6" },
    notes: ""
  },
  {
    name:    "Thessaly Wren",
    player:  "???",
    class:   "Cleric (Twilight)",
    race:    "Half-Elf",
    level:   6,
    tagline: "Light is not the absence of darkness. It is the courage to face it.",
    emoji:   "🌙",
    hp:      44,
    hpMax:   44,
    hpTemp:  0,
    deathSaves: { successes:[false,false,false], failures:[false,false,false] },
    conditions: { Poisoned:false, Blinded:false, Frightened:false, Exhausted:false, Concentrating:false },
    spellSlots: {
      "Level 1": { total:4, used:0 },
      "Level 2": { total:3, used:0 },
      "Level 3": { total:3, used:0 }
    },
    spells: [
      { name:"Sacred Flame",      level:0, castingTime:"1 action", range:"18 m", notes:"2d8 radiant, Dex save" },
      { name:"Toll the Dead",     level:0, castingTime:"1 action", range:"18 m", notes:"1d12 necrotic if damaged" },
      { name:"Cure Wounds",       level:1, slotLevel:1, castingTime:"1 action", range:"Touch" },
      { name:"Guiding Bolt",      level:1, slotLevel:1, castingTime:"1 action", range:"36 m", notes:"4d6 radiant + Advantage on next attack" },
      { name:"Faerie Fire",       level:1, slotLevel:1, castingTime:"1 action", range:"18 m", notes:"Twilight domain — outlines creatures" },
      { name:"Moonbeam",          level:2, slotLevel:2, castingTime:"1 action", range:"36 m", notes:"2d10 radiant per turn, concentration" },
      { name:"Prayer of Healing", level:2, slotLevel:2, castingTime:"10 min",   range:"9 m" },
      { name:"Beacon of Hope",    level:3, slotLevel:3, castingTime:"1 action", range:"9 m",  notes:"Max healing rolls, Wis save vs death" }
    ],
    inventory: [
      { name:"Holy Symbol",        qty:1, consumable:false },
      { name:"Health Potion",      qty:3, consumable:true  },
      { name:"Scroll of Revivify", qty:1, consumable:true  },
      { name:"Rations",            qty:5, consumable:true  }
    ],
    stats: { AC:17, Speed:"9 m", Initiative:"+1", "Passive Perc":14, "Channel Div":"1/rest" },
    notes: ""
  },
  {
    name:    "Mordechai",
    player:  "NPC",
    class:   "Keeper of the Sealed Vaults",
    race:    "Dwarf (Ancient)",
    level:   12,
    tagline: "I have sealed seven horrors in my lifetime. You are standing above the eighth.",
    emoji:   "🔑",
    hp:      90,
    hpMax:   90,
    hpTemp:  0,
    deathSaves: { successes:[false,false,false], failures:[false,false,false] },
    conditions: { Poisoned:false, Exhausted:false },
    spellSlots: {},
    spells:    [],
    inventory: [
      { name:"Vault Key (obsidian)", qty:1, consumable:false },
      { name:"Warding Totem",        qty:3, consumable:true  },
      { name:"Lantern of Revealing", qty:1, consumable:false }
    ],
    stats: { AC:18, Speed:"7.5 m", Disposition:"Cautious" },
    notes: "Knows the location of the first seal. Does not trust the party yet."
  },
  {
    name:    "The Hollow Maiden",
    player:  "NPC",
    class:   "Unknown",
    race:    "Unknown",
    level:   0,
    tagline: "She has been standing at that crossroads for longer than the village has existed.",
    emoji:   "🕯️",
    hp:      1,
    hpMax:   1,
    hpTemp:  0,
    deathSaves: { successes:[false,false,false], failures:[false,false,false] },
    conditions: { Cursed:true },
    spellSlots: {},
    spells:    [],
    inventory: [
      { name:"Withered Rose", qty:1, consumable:false },
      { name:"Sealed Letter", qty:1, consumable:false }
    ],
    stats: { AC:"—", Disposition:"Enigmatic" },
    notes: "Cannot be harmed. Speaks only in questions. Knows something about the party's past."
  }
];

async function seed() {
  const col = db.collection("characters");
  for (const char of characters) {
    const ref = await col.add(char);
    console.log(`✓ Added "${char.name}" → ${ref.id}`);
  }
  console.log("\nAll characters seeded successfully!");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
