/**
 * patch-spells.mjs
 * Updates existing Firestore characters with full spell data.
 * Run:  node patch-spells.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore }        from "firebase-admin/firestore";
import { createRequire }       from "module";

const require = createRequire(import.meta.url);
initializeApp({ credential: cert(require("./serviceAccountKey.json")) });
const db = getFirestore();

const PATCHES = {

  // ── Korrath the Grey — Sorcerer ───────────────────────────
  "Korrath the Grey": {
    spellSlots: {
      "Level 1": { total: 4, used: 0 },
      "Level 2": { total: 3, used: 0 },
      "Level 3": { total: 3, used: 0 },
    },
    spells: [
      { name: "Fire Bolt",       category: "attack",  level: 0, castingTime: "1 action", range: "36 m",  notes: "2d10 fire damage" },
      { name: "Prestidigitation",category: "general", level: 0, castingTime: "1 action", range: "3 m",   notes: "Minor magical trick" },
      { name: "Minor Illusion",  category: "general", level: 0, castingTime: "1 action", range: "9 m",   notes: "Sound or image for 1 min" },
      { name: "Magic Missile",   category: "attack",  level: 1, slotLevel: 1, castingTime: "1 action", range: "36 m",  notes: "3 darts, 1d4+1 force each — auto hit" },
      { name: "Chromatic Orb",   category: "attack",  level: 1, slotLevel: 1, castingTime: "1 action", range: "27 m",  notes: "3d8 damage — choose element" },
      { name: "Shield",          category: "defense", level: 1, slotLevel: 1, castingTime: "1 reaction", range: "Self", notes: "+5 AC until start of next turn" },
      { name: "Scorching Ray",   category: "attack",  level: 2, slotLevel: 2, castingTime: "1 action", range: "36 m",  notes: "3 rays, 2d6 fire each" },
      { name: "Mirror Image",    category: "defense", level: 2, slotLevel: 2, castingTime: "1 action", range: "Self",  notes: "3 duplicates, attacker must hit real you" },
      { name: "Fireball",        category: "attack",  level: 3, slotLevel: 3, castingTime: "1 action", range: "45 m", notes: "8d6 fire in 6 m radius — Dex save half" },
      { name: "Haste",           category: "defense", level: 3, slotLevel: 3, castingTime: "1 action", range: "9 m",  notes: "Double speed, +2 AC, extra action" },
    ],
  },

  // ── Zeth Shadowveil — Warlock ─────────────────────────────
  "Zeth Shadowveil": {
    spellSlots: {
      "Level 2": { total: 2, used: 0 },   // Pact Magic — always max level
    },
    spells: [
      { name: "Eldritch Blast",  category: "attack",  level: 0, castingTime: "1 action", range: "27 m",  notes: "1d10 force per beam (1 beam at lvl 1)" },
      { name: "Toll the Dead",   category: "attack",  level: 0, castingTime: "1 action", range: "18 m",  notes: "1d8 necrotic (1d12 if target is hurt)" },
      { name: "Minor Illusion",  category: "general", level: 0, castingTime: "1 action", range: "9 m",   notes: "Sound or image for 1 min" },
      { name: "Hex",             category: "attack",  level: 1, slotLevel: 2, castingTime: "1 bonus action", range: "27 m", notes: "+1d6 necrotic on hits, disadv on chosen ability" },
      { name: "Arms of Hadar",   category: "attack",  level: 1, slotLevel: 2, castingTime: "1 action", range: "Self (3 m)", notes: "2d6 necrotic — Str save, can't reactions until next turn" },
      { name: "Misty Step",      category: "general", level: 2, slotLevel: 2, castingTime: "1 bonus action", range: "Self", notes: "Teleport 18 m to visible space" },
      { name: "Hunger of Hadar", category: "attack",  level: 3, slotLevel: 2, castingTime: "1 action", range: "45 m", notes: "2d6 cold + 2d6 acid, blindness, concentration" },
    ],
  },

  // ── Lirien Starweave — Wizard ─────────────────────────────
  "Lirien Starweave": {
    spellSlots: {
      "Level 1": { total: 4, used: 0 },
      "Level 2": { total: 3, used: 0 },
      "Level 3": { total: 3, used: 0 },
    },
    spells: [
      { name: "Fire Bolt",     category: "attack",  level: 0, castingTime: "1 action", range: "36 m",  notes: "2d10 fire damage" },
      { name: "Mage Hand",     category: "general", level: 0, castingTime: "1 action", range: "9 m",   notes: "Spectral hand, carry up to 5 kg" },
      { name: "Prestidigitation", category: "general", level: 0, castingTime: "1 action", range: "3 m", notes: "Minor magical trick" },
      { name: "Magic Missile", category: "attack",  level: 1, slotLevel: 1, castingTime: "1 action", range: "36 m", notes: "3 darts, 1d4+1 force — auto hit" },
      { name: "Shield",        category: "defense", level: 1, slotLevel: 1, castingTime: "1 reaction", range: "Self", notes: "+5 AC until start of next turn" },
      { name: "Detect Magic",  category: "general", level: 1, slotLevel: 1, castingTime: "1 action", range: "Self (9 m)", notes: "Sense magic auras for 10 min, concentration" },
      { name: "Sleep",         category: "general", level: 1, slotLevel: 1, castingTime: "1 action", range: "27 m", notes: "5d8 HP of creatures fall unconscious" },
      { name: "Shatter",       category: "attack",  level: 2, slotLevel: 2, castingTime: "1 action", range: "18 m", notes: "3d8 thunder in 1.5 m sphere — Con save half" },
      { name: "Misty Step",    category: "general", level: 2, slotLevel: 2, castingTime: "1 bonus action", range: "Self", notes: "Teleport 18 m to visible space" },
      { name: "Web",           category: "defense", level: 2, slotLevel: 2, castingTime: "1 action", range: "18 m", notes: "Restrain creatures in 6 m cube — Str save" },
      { name: "Fireball",      category: "attack",  level: 3, slotLevel: 3, castingTime: "1 action", range: "45 m", notes: "8d6 fire in 6 m radius — Dex save half" },
      { name: "Counterspell",  category: "defense", level: 3, slotLevel: 3, castingTime: "1 reaction", range: "18 m", notes: "Interrupt a spell being cast" },
      { name: "Fly",           category: "general", level: 3, slotLevel: 3, castingTime: "1 action", range: "Touch", notes: "Flying speed 18 m, concentration" },
    ],
  },

  // ── Seraphine Dawnveil — Cleric ───────────────────────────
  "Seraphine Dawnveil": {
    spellSlots: {
      "Level 1": { total: 4, used: 0 },
      "Level 2": { total: 3, used: 0 },
      "Level 3": { total: 2, used: 0 },
    },
    spells: [
      { name: "Sacred Flame",      category: "attack",  level: 0, castingTime: "1 action", range: "18 m", notes: "2d8 radiant — Dex save, ignores cover" },
      { name: "Light",             category: "general", level: 0, castingTime: "1 action", range: "Touch", notes: "Object glows 6 m bright light for 1 hr" },
      { name: "Thaumaturgy",       category: "general", level: 0, castingTime: "1 action", range: "9 m",  notes: "Minor divine miracles — voice, flames, tremors" },
      { name: "Bless",             category: "defense", level: 1, slotLevel: 1, castingTime: "1 action", range: "9 m",  notes: "3 targets: +1d4 to attack rolls & saves, concentration" },
      { name: "Cure Wounds",       category: "general", level: 1, slotLevel: 1, castingTime: "1 action", range: "Touch", notes: "1d8 + spellcasting mod HP restored" },
      { name: "Guiding Bolt",      category: "attack",  level: 1, slotLevel: 1, castingTime: "1 action", range: "36 m", notes: "4d6 radiant + next attacker has Advantage" },
      { name: "Aid",               category: "defense", level: 2, slotLevel: 2, castingTime: "1 action", range: "9 m",  notes: "3 targets gain +5 max HP for 8 hr" },
      { name: "Spiritual Weapon",  category: "attack",  level: 2, slotLevel: 2, castingTime: "1 bonus action", range: "18 m", notes: "1d8+4 force per bonus action hit, 1 min" },
      { name: "Prayer of Healing", category: "general", level: 2, slotLevel: 2, castingTime: "10 min", range: "9 m",  notes: "Up to 6 targets heal 2d8 + modifier" },
      { name: "Mass Healing Word", category: "general", level: 3, slotLevel: 3, castingTime: "1 bonus action", range: "18 m", notes: "6 targets each heal 1d4 + modifier" },
      { name: "Dispel Magic",      category: "general", level: 3, slotLevel: 3, castingTime: "1 action", range: "18 m", notes: "End a spell of 3rd level or lower" },
    ],
  },

  // ── Mara Thornbark — Druid ────────────────────────────────
  "Mara Thornbark": {
    spellSlots: {
      "Level 1": { total: 4, used: 0 },
      "Level 2": { total: 3, used: 0 },
      "Level 3": { total: 2, used: 0 },
    },
    spells: [
      { name: "Shillelagh",       category: "attack",  level: 0, castingTime: "1 bonus action", range: "Self", notes: "Staff/club uses Wis mod, 1d8+Wis damage" },
      { name: "Poison Spray",     category: "attack",  level: 0, castingTime: "1 action", range: "3 m",  notes: "1d12 poison — Con save negates" },
      { name: "Druidcraft",       category: "general", level: 0, castingTime: "1 action", range: "4.5 m", notes: "Tiny nature effects — weather, plants, sounds" },
      { name: "Entangle",         category: "defense", level: 1, slotLevel: 1, castingTime: "1 action", range: "27 m", notes: "Restrain creatures in 6 m square — Str save" },
      { name: "Thunderwave",      category: "attack",  level: 1, slotLevel: 1, castingTime: "1 action", range: "Self (4.5 m)", notes: "2d8 thunder, push 3 m — Con save" },
      { name: "Cure Wounds",      category: "general", level: 1, slotLevel: 1, castingTime: "1 action", range: "Touch", notes: "1d8 + spellcasting mod HP restored" },
      { name: "Animal Friendship",category: "general", level: 1, slotLevel: 1, castingTime: "1 action", range: "9 m", notes: "Charm a beast with INT ≤ 3 for 24 hr" },
      { name: "Moonbeam",         category: "attack",  level: 2, slotLevel: 2, castingTime: "1 action", range: "36 m", notes: "2d10 radiant per turn in 1.5 m column, concentration" },
      { name: "Barkskin",         category: "defense", level: 2, slotLevel: 2, castingTime: "1 action", range: "Touch", notes: "Target's AC can't be below 16, concentration" },
      { name: "Spike Growth",     category: "defense", level: 2, slotLevel: 2, castingTime: "1 action", range: "45 m", notes: "6 m radius: 2d4 per 1.5 m moved through" },
      { name: "Call Lightning",   category: "attack",  level: 3, slotLevel: 3, castingTime: "1 action", range: "45 m", notes: "3d10 lightning per action for 10 min, concentration" },
      { name: "Plant Growth",     category: "defense", level: 3, slotLevel: 3, castingTime: "1 action", range: "45 m", notes: "Area overgrown — movement costs 4× in 30 m radius" },
    ],
  },

  // ── Torvin Emberclaw — Paladin ────────────────────────────
  "Torvin Emberclaw": {
    spellSlots: {
      "Level 1": { total: 3, used: 0 },
      "Level 2": { total: 2, used: 0 },
    },
    spells: [
      { name: "Divine Smite",      category: "attack",  level: 1, slotLevel: 1, castingTime: "On hit", range: "Self", notes: "2d8 radiant (+1d8 per slot above 1st) on a hit" },
      { name: "Wrathful Smite",    category: "attack",  level: 1, slotLevel: 1, castingTime: "1 bonus action", range: "Self", notes: "+1d6 psychic, target frightened — Wis save" },
      { name: "Bless",             category: "defense", level: 1, slotLevel: 1, castingTime: "1 action", range: "9 m",  notes: "3 targets: +1d4 to attack rolls & saves" },
      { name: "Cure Wounds",       category: "general", level: 1, slotLevel: 1, castingTime: "1 action", range: "Touch", notes: "1d8 + Cha mod HP restored" },
      { name: "Shield of Faith",   category: "defense", level: 1, slotLevel: 1, castingTime: "1 bonus action", range: "18 m", notes: "+2 AC to target, concentration" },
      { name: "Branding Smite",    category: "attack",  level: 2, slotLevel: 2, castingTime: "1 bonus action", range: "Self", notes: "+2d6 radiant, target glows — can't be invisible" },
      { name: "Lesser Restoration",category: "general", level: 2, slotLevel: 2, castingTime: "1 action", range: "Touch", notes: "End one disease or blinded/deafened/paralyzed/poisoned" },
      { name: "Find Steed",        category: "general", level: 2, slotLevel: 2, castingTime: "10 min", range: "Self", notes: "Summon a loyal mount (war horse, pony, etc.)" },
    ],
  },

  // ── Finn Coppercoil — Artificer ───────────────────────────
  "Finn Coppercoil": {
    spellSlots: {
      "Level 1": { total: 3, used: 0 },
      "Level 2": { total: 2, used: 0 },
    },
    spells: [
      { name: "Fire Bolt",    category: "attack",  level: 0, castingTime: "1 action", range: "36 m", notes: "2d10 fire damage" },
      { name: "Mending",      category: "general", level: 0, castingTime: "1 min",    range: "Touch", notes: "Repair a single break or tear in an object" },
      { name: "Cure Wounds",  category: "general", level: 1, slotLevel: 1, castingTime: "1 action", range: "Touch", notes: "1d8 + Int mod HP restored" },
      { name: "Identify",     category: "general", level: 1, slotLevel: 1, castingTime: "1 min",    range: "Touch", notes: "Learn a magic item's properties and attunement" },
      { name: "Thunderwave",  category: "attack",  level: 1, slotLevel: 1, castingTime: "1 action", range: "Self (4.5 m)", notes: "2d8 thunder, push 3 m — Con save" },
      { name: "Shield",       category: "defense", level: 1, slotLevel: 1, castingTime: "1 reaction", range: "Self", notes: "+5 AC until start of next turn" },
      { name: "Aid",          category: "defense", level: 2, slotLevel: 2, castingTime: "1 action", range: "9 m",  notes: "3 targets gain +5 max HP for 8 hr" },
      { name: "Scorching Ray",category: "attack",  level: 2, slotLevel: 2, castingTime: "1 action", range: "36 m", notes: "3 rays, 2d6 fire each" },
      { name: "Web",          category: "defense", level: 2, slotLevel: 2, castingTime: "1 action", range: "18 m", notes: "Restrain creatures in 6 m cube — Str save" },
    ],
  },

  // ── Sylvara Moonwhisper — Ranger ──────────────────────────
  "Sylvara Moonwhisper": {
    spellSlots: {
      "Level 1": { total: 3, used: 0 },
      "Level 2": { total: 2, used: 0 },
    },
    spells: [
      { name: "Hunter's Mark",      category: "attack",  level: 1, slotLevel: 1, castingTime: "1 bonus action", range: "27 m", notes: "+1d6 damage to marked target, concentration" },
      { name: "Cure Wounds",        category: "general", level: 1, slotLevel: 1, castingTime: "1 action", range: "Touch", notes: "1d8 + Wis mod HP restored" },
      { name: "Fog Cloud",          category: "defense", level: 1, slotLevel: 1, castingTime: "1 action", range: "36 m", notes: "6 m sphere of fog — heavily obscured" },
      { name: "Silence",            category: "defense", level: 2, slotLevel: 2, castingTime: "1 action", range: "45 m", notes: "9 m sphere: no sound in or out, concentration" },
      { name: "Pass Without Trace", category: "general", level: 2, slotLevel: 2, castingTime: "1 action", range: "Self", notes: "+10 to Stealth checks, can't be tracked" },
    ],
  },

};

async function patch() {
  const snapshot = await db.collection("characters").get();

  for (const docSnap of snapshot.docs) {
    const { name } = docSnap.data();
    const patch = PATCHES[name];
    if (!patch) {
      console.log(`  skipped  "${name}"`);
      continue;
    }
    await docSnap.ref.update({ spells: patch.spells, spellSlots: patch.spellSlots });
    console.log(`✓ patched  "${name}" — ${patch.spells.length} spells, ${Object.keys(patch.spellSlots).length} slot levels`);
  }

  console.log("\nDone.");
  process.exit(0);
}

patch().catch(err => { console.error(err); process.exit(1); });
