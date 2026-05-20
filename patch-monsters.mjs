/**
 * patch-monsters.mjs
 * Seeds example Monsters and NPCs into Firestore.
 * Run once:  node patch-monsters.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
initializeApp({ credential: cert(require("./serviceAccountKey.json")) });
const db = getFirestore();

const MONSTERS = [
  { name: "Goblin Scout",     hp: 7,  hpMax: 7,  type: "monster" },
  { name: "Orc Warrior",      hp: 15, hpMax: 15, type: "monster" },
  { name: "Shadow Wraith",    hp: 22, hpMax: 22, type: "monster" },
  { name: "Giant Spider",     hp: 11, hpMax: 11, type: "monster" },
  { name: "Torven the Innkeeper",      hp: 8,  hpMax: 8,  type: "npc" },
  { name: "Guard Captain Mira",        hp: 14, hpMax: 14, type: "npc" },
  { name: "The Mysterious Stranger",   hp: 10, hpMax: 10, type: "npc" },
  { name: "Elder Morthis",             hp: 6,  hpMax: 6,  type: "npc" },
];

async function patch() {
  for (const entry of MONSTERS) {
    await db.collection("monsters").add({ ...entry, createdAt: FieldValue.serverTimestamp() });
    console.log(`✓ added  ${entry.type.padEnd(7)}  "${entry.name}"`);
  }
  console.log("\nDone.");
  process.exit(0);
}

patch().catch(err => { console.error(err); process.exit(1); });
