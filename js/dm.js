import { db } from "./firebase-config.js";
import {
  collection, onSnapshot, orderBy, query,
  doc, updateDoc, addDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const DM_PASSWORD = "1234";

const ALL_STATS = [
  "Might", "Agility", "Endurance",
  "Knowledge", "Perception", "Ingenuity",
  "Presence", "Will", "Empathy",
  "Resonance",
];

const CONDITIONS = [
  "Poisoned", "Blinded", "Stunned", "Prone", "Frightened",
  "Charmed", "Paralyzed", "Exhausted", "Burning", "Bleeding",
];

// ── State ─────────────────────────────────────────────────
let characters = {};
let selectedCharId = null;
let dmUnlocked = false;
let unsubCharacters = null;

// ── DOM refs ──────────────────────────────────────────────
const dmBtn            = document.getElementById("dmBtn");
const dmPasswordModal  = document.getElementById("dmPasswordModal");
const dmPasswordInput  = document.getElementById("dmPasswordInput");
const dmPasswordError  = document.getElementById("dmPasswordError");
const dmPasswordSubmit = document.getElementById("dmPasswordSubmit");
const dmPasswordCancel = document.getElementById("dmPasswordCancel");
const dmOverlay        = document.getElementById("dmOverlay");
const dmCloseBtn       = document.getElementById("dmCloseBtn");
const dmCharList       = document.getElementById("dmCharList");

// ── Password flow ─────────────────────────────────────────
dmBtn.addEventListener("click", () => {
  if (dmUnlocked) { openPanel(); return; }
  dmPasswordModal.classList.remove("hidden");
  dmPasswordInput.value = "";
  dmPasswordError.classList.add("hidden");
  setTimeout(() => dmPasswordInput.focus(), 50);
});

dmPasswordSubmit.addEventListener("click", checkPassword);
dmPasswordInput.addEventListener("keydown", e => {
  if (e.key === "Enter") checkPassword();
  if (e.key === "Escape") closePasswordModal();
});
dmPasswordCancel.addEventListener("click", closePasswordModal);

function checkPassword() {
  if (dmPasswordInput.value === DM_PASSWORD) {
    dmUnlocked = true;
    closePasswordModal();
    openPanel();
  } else {
    dmPasswordError.classList.remove("hidden");
    dmPasswordInput.select();
  }
}

function closePasswordModal() {
  dmPasswordModal.classList.add("hidden");
}

function openPanel() {
  dmOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  startListening();
}

dmCloseBtn.addEventListener("click", () => {
  dmOverlay.classList.add("hidden");
  document.body.style.overflow = "";
});

// ── Firestore listener ────────────────────────────────────
function startListening() {
  if (unsubCharacters) return;
  const q = query(collection(db, "characters"), orderBy("name"));
  unsubCharacters = onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      const id = change.doc.id;
      if (change.type === "removed") {
        delete characters[id];
      } else {
        characters[id] = { id, ...change.doc.data() };
      }
    });
    renderCharList();
    if (selectedCharId) renderActiveTab();
  });
}

// ── Character sidebar ─────────────────────────────────────
function renderCharList() {
  dmCharList.innerHTML = "";
  Object.values(characters)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .forEach(char => {
      const btn = document.createElement("button");
      btn.className = "dm-char-btn" + (char.id === selectedCharId ? " active" : "");
      const pct = char.hpMax ? Math.round(((char.hp ?? 0) / char.hpMax) * 100) : 100;
      const hpClass = pct <= 30 ? "low" : pct <= 60 ? "mid" : "";
      btn.innerHTML = `
        <span class="dm-char-name">${char.name || char.id}</span>
        <span class="dm-char-hp ${hpClass}">${char.hp ?? "?"}/${char.hpMax ?? "?"} HP</span>
      `;
      btn.addEventListener("click", () => {
        selectedCharId = char.id;
        renderCharList();
        renderActiveTab();
      });
      dmCharList.appendChild(btn);
    });
}

// ── Tab switching ─────────────────────────────────────────
document.querySelectorAll(".dm-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".dm-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".dm-tab-panel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("dm-tab-" + btn.dataset.tab).classList.remove("hidden");
    renderActiveTab();
  });
});

function activeTab() {
  return document.querySelector(".dm-tab-btn.active")?.dataset.tab || "combat";
}

function renderActiveTab() {
  const char = selectedCharId ? characters[selectedCharId] : null;
  if (!char) {
    ["combat", "inventory", "stats", "log"].forEach(t => {
      const el = document.getElementById("dm-tab-" + t);
      if (el) el.innerHTML = `<div class="dm-no-char">Select a character from the list.</div>`;
    });
    return;
  }
  const tab = activeTab();
  switch (tab) {
    case "combat":    renderCombatTab(char);    break;
    case "inventory": renderInventoryTab(char); break;
    case "stats":     renderStatsTab(char);     break;
    case "log":       renderLogTab(char);       break;
  }
}

// ── Helpers ───────────────────────────────────────────────
function hpPct(char) {
  const max = char.hpMax || 1;
  return Math.min(100, Math.max(0, Math.round(((char.hp ?? 0) / max) * 100)));
}
function hpColor(pct) {
  if (pct > 60) return "#2ecc71";
  if (pct > 30) return "#f39c12";
  return "#c0392b";
}
function charRef() {
  return doc(db, "characters", selectedCharId);
}
async function dmLog(type, actor, message) {
  await addDoc(collection(db, "sessionLog"), {
    type, actor, message,
    timestamp: serverTimestamp(),
    charId: selectedCharId || null,
  });
}

// ── COMBAT TAB ────────────────────────────────────────────
function renderCombatTab(char) {
  const el = document.getElementById("dm-tab-combat");
  const conds = char.conditions || {};
  const pct = hpPct(char);
  const ds = char.deathSaves || { successes: 0, failures: 0 };

  el.innerHTML = `
    <div class="dm-section">
      <h3 class="dm-section-title">Hit Points</h3>
      <div class="dm-hp-display">
        <span class="dm-hp-cur">${char.hp ?? 0}</span>
        <span class="dm-hp-sep">/</span>
        <span class="dm-hp-max">${char.hpMax ?? 0}</span>
        <span class="dm-hp-label">HP</span>
      </div>
      <div class="dm-hp-bar-track">
        <div class="dm-hp-bar-fill" style="width:${pct}%;background:${hpColor(pct)}"></div>
      </div>
      <div class="dm-hp-actions">
        <input type="number" class="dm-input" id="dmHpAmt" min="0" max="9999" placeholder="Amount" />
        <button class="dm-btn dm-btn-damage" id="dmBtnDamage">Damage</button>
        <button class="dm-btn dm-btn-heal"   id="dmBtnHeal">Heal</button>
        <button class="dm-btn dm-btn-neutral" id="dmBtnSetHP">Set HP</button>
        <button class="dm-btn dm-btn-neutral" id="dmBtnSetMax">Set Max HP</button>
      </div>
    </div>

    <div class="dm-section">
      <h3 class="dm-section-title">Conditions</h3>
      <div class="dm-conditions-grid" id="dmCondGrid"></div>
    </div>

    <div class="dm-section">
      <h3 class="dm-section-title">Death Saves</h3>
      <div class="dm-death-saves">
        <div class="dm-saves-row">
          <span class="dm-saves-label">Successes</span>
          ${[0,1,2].map(i => `
            <input type="checkbox" class="dm-save-check success" data-type="successes" data-i="${i}"
              ${(ds.successes || 0) > i ? "checked" : ""} />
          `).join("")}
        </div>
        <div class="dm-saves-row">
          <span class="dm-saves-label">Failures</span>
          ${[0,1,2].map(i => `
            <input type="checkbox" class="dm-save-check failure" data-type="failures" data-i="${i}"
              ${(ds.failures || 0) > i ? "checked" : ""} />
          `).join("")}
        </div>
        <button class="dm-btn dm-btn-neutral" id="dmBtnClearDS" style="margin-top:0.4rem">Clear All</button>
      </div>
    </div>
  `;

  // Conditions checkboxes
  const condGrid = el.querySelector("#dmCondGrid");
  CONDITIONS.forEach(c => {
    const label = document.createElement("label");
    label.className = "dm-cond-label" + (conds[c] ? " active" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!conds[c];
    cb.addEventListener("change", async () => {
      const isActive = cb.checked;
      label.classList.toggle("active", isActive);
      await updateDoc(charRef(), { [`conditions.${c}`]: isActive });
      dmLog("condition", "DM", `${isActive ? "applied" : "removed"} ${c} on ${char.name}`);
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + c));
    condGrid.appendChild(label);
  });

  // HP buttons
  el.querySelector("#dmBtnDamage").addEventListener("click", async () => {
    const amt = parseInt(el.querySelector("#dmHpAmt").value) || 0;
    if (!amt) return;
    const c = characters[selectedCharId];
    const newHp = Math.max(0, (c.hp ?? 0) - amt);
    await updateDoc(charRef(), { hp: newHp });
    dmLog("damage", "DM", `dealt ${amt} damage to ${c.name} (${newHp}/${c.hpMax ?? "?"} HP)`);
  });
  el.querySelector("#dmBtnHeal").addEventListener("click", async () => {
    const amt = parseInt(el.querySelector("#dmHpAmt").value) || 0;
    if (!amt) return;
    const c = characters[selectedCharId];
    const newHp = Math.min(c.hpMax ?? 9999, (c.hp ?? 0) + amt);
    await updateDoc(charRef(), { hp: newHp });
    dmLog("heal", "DM", `healed ${c.name} for ${amt} HP (${newHp}/${c.hpMax ?? "?"} HP)`);
  });
  el.querySelector("#dmBtnSetHP").addEventListener("click", async () => {
    const amt = parseInt(el.querySelector("#dmHpAmt").value);
    if (isNaN(amt)) return;
    const c = characters[selectedCharId];
    await updateDoc(charRef(), { hp: amt });
    dmLog("system", "DM", `set ${c.name}'s HP to ${amt}`);
  });
  el.querySelector("#dmBtnSetMax").addEventListener("click", async () => {
    const amt = parseInt(el.querySelector("#dmHpAmt").value);
    if (isNaN(amt)) return;
    const c = characters[selectedCharId];
    await updateDoc(charRef(), { hpMax: amt });
    dmLog("system", "DM", `set ${c.name}'s max HP to ${amt}`);
  });

  // Death saves
  el.querySelectorAll(".dm-save-check").forEach(cb => {
    cb.addEventListener("change", async () => {
      const c = characters[selectedCharId];
      const type = cb.dataset.type;
      const i = parseInt(cb.dataset.i);
      const saves = { successes: c.deathSaves?.successes || 0, failures: c.deathSaves?.failures || 0 };
      saves[type] = cb.checked ? i + 1 : i;
      await updateDoc(charRef(), { deathSaves: saves });
    });
  });
  el.querySelector("#dmBtnClearDS").addEventListener("click", async () => {
    await updateDoc(charRef(), { deathSaves: { successes: 0, failures: 0 } });
  });
}

// ── STATS TAB ─────────────────────────────────────────────
function renderStatsTab(char) {
  const el = document.getElementById("dm-tab-stats");
  const stats = char.stats || {};
  const mods  = char.statModifiers || {};

  el.innerHTML = `
    <div class="dm-section">
      <h3 class="dm-section-title">Base Stats</h3>
      <div class="dm-stats-grid" id="dmBaseStatsGrid"></div>
    </div>
    <div class="dm-section">
      <h3 class="dm-section-title">
        Temporary Modifiers
        <button class="dm-btn dm-btn-neutral dm-btn-sm" id="dmBtnClearMods">Clear All</button>
      </h3>
      <div class="dm-stats-grid" id="dmModStatsGrid"></div>
    </div>
  `;

  function makeStatRow(stat, value, cssClass, onMinus, onPlus) {
    const row = document.createElement("div");
    row.className = "dm-stat-row";
    const nameEl = document.createElement("span");
    nameEl.className = "dm-stat-name";
    nameEl.textContent = stat;
    const valEl = document.createElement("span");
    valEl.className = "dm-stat-val" + (cssClass ? " " + cssClass : "");
    valEl.textContent = value;
    const minusBtn = document.createElement("button");
    minusBtn.className = "dm-stat-btn";
    minusBtn.textContent = "−";
    minusBtn.addEventListener("click", onMinus);
    const plusBtn = document.createElement("button");
    plusBtn.className = "dm-stat-btn";
    plusBtn.textContent = "+";
    plusBtn.addEventListener("click", onPlus);
    row.append(nameEl, minusBtn, valEl, plusBtn);
    return row;
  }

  const baseGrid = el.querySelector("#dmBaseStatsGrid");
  ALL_STATS.forEach(stat => {
    const val = stats[stat] ?? 0;
    baseGrid.appendChild(makeStatRow(stat, val, "", async () => {
      await updateDoc(charRef(), { [`stats.${stat}`]: (characters[selectedCharId]?.stats?.[stat] ?? 0) - 1 });
    }, async () => {
      await updateDoc(charRef(), { [`stats.${stat}`]: (characters[selectedCharId]?.stats?.[stat] ?? 0) + 1 });
    }));
  });

  const modGrid = el.querySelector("#dmModStatsGrid");
  ALL_STATS.forEach(stat => {
    const val = mods[stat] ?? 0;
    const cls = val > 0 ? "pos" : val < 0 ? "neg" : "";
    modGrid.appendChild(makeStatRow(stat, val, cls, async () => {
      const cur = characters[selectedCharId]?.statModifiers?.[stat] ?? 0;
      await updateDoc(charRef(), { [`statModifiers.${stat}`]: cur - 1 });
    }, async () => {
      const cur = characters[selectedCharId]?.statModifiers?.[stat] ?? 0;
      await updateDoc(charRef(), { [`statModifiers.${stat}`]: cur + 1 });
    }));
  });

  el.querySelector("#dmBtnClearMods").addEventListener("click", async () => {
    const updates = {};
    ALL_STATS.forEach(s => { updates[`statModifiers.${s}`] = 0; });
    await updateDoc(charRef(), updates);
  });
}

// ── INVENTORY TAB ─────────────────────────────────────────
function isEquip(item) {
  return item.type === "weapon" || item.type === "armor" || item.type === "equipment" || item.weapon;
}

function renderInventoryTab(char) {
  const el = document.getElementById("dm-tab-inventory");
  const inv = char.inventory || [];
  const consumables = inv.filter(i => !isEquip(i));
  const equipment   = inv.filter(i =>  isEquip(i));

  el.innerHTML = `
    <div class="dm-inv-layout">
      <div class="dm-inv-col">
        <h3 class="dm-section-title">🧪 Consumables</h3>
        <div class="dm-inv-list" id="dmConsumablesList"></div>
        <details class="dm-add-form" id="dmAddConsumableForm">
          <summary>+ Add Consumable</summary>
          <div class="dm-form-fields">
            <input class="dm-input" id="dmCName" placeholder="Name" style="flex:2;min-width:120px" />
            <input class="dm-input" id="dmCEmoji" placeholder="🎒" maxlength="4" style="width:54px;min-width:unset;flex:none" />
            <input class="dm-input" type="number" id="dmCQty" placeholder="Qty" min="1" value="1" style="width:60px;min-width:unset;flex:none" />
            <input class="dm-input" type="number" id="dmCWeight" placeholder="kg" step="0.1" min="0" value="0.1" style="width:64px;min-width:unset;flex:none" />
            <button class="dm-btn dm-btn-heal" id="dmBtnAddConsumable">Add</button>
          </div>
        </details>
      </div>
      <div class="dm-inv-col">
        <h3 class="dm-section-title">⚔️ Equipment</h3>
        <div class="dm-inv-list" id="dmEquipmentList"></div>
        <details class="dm-add-form" id="dmAddEquipmentForm">
          <summary>+ Add Equipment</summary>
          <div class="dm-form-fields">
            <input class="dm-input" id="dmEName" placeholder="Name" style="flex:2;min-width:120px" />
            <input class="dm-input" id="dmEEmoji" placeholder="⚔️" maxlength="4" style="width:54px;min-width:unset;flex:none" />
            <select class="dm-input" id="dmEType" style="flex:none">
              <option value="weapon">Weapon</option>
              <option value="armor">Armor</option>
              <option value="equipment">Equipment</option>
            </select>
            <input class="dm-input" type="number" id="dmEWeight" placeholder="kg" step="0.1" min="0" value="1" style="width:64px;min-width:unset;flex:none" />
            <input class="dm-input" id="dmEDamage" placeholder="Damage (1d6)" style="width:110px;flex:none" />
            <input class="dm-input" type="number" id="dmEArmor" placeholder="AC bonus" style="width:80px;flex:none" />
            <div class="dm-effects-grid">
              <span class="dm-effects-label">Stat Effects (0 = no effect)</span>
              ${ALL_STATS.map(s => `
                <label class="dm-effect-label">${s}
                  <input class="dm-input dm-effect-input" type="number" data-stat="${s}" value="0" />
                </label>
              `).join("")}
            </div>
            <button class="dm-btn dm-btn-heal" id="dmBtnAddEquipment" style="width:100%">Add Equipment</button>
          </div>
        </details>
      </div>
    </div>
  `;

  // Render consumables list
  const cList = el.querySelector("#dmConsumablesList");
  if (consumables.length) {
    consumables.forEach(item => {
      const realIdx = inv.indexOf(item);
      cList.appendChild(makeInvRow(item, realIdx, char, true));
    });
  } else {
    cList.innerHTML = `<div class="dm-empty">No consumables.</div>`;
  }

  // Render equipment list
  const eList = el.querySelector("#dmEquipmentList");
  if (equipment.length) {
    equipment.forEach(item => {
      const realIdx = inv.indexOf(item);
      eList.appendChild(makeInvRow(item, realIdx, char, false));
    });
  } else {
    eList.innerHTML = `<div class="dm-empty">No equipment.</div>`;
  }

  // Add consumable
  el.querySelector("#dmBtnAddConsumable").addEventListener("click", async () => {
    const name = el.querySelector("#dmCName").value.trim();
    if (!name) return;
    const item = {
      name,
      emoji:  el.querySelector("#dmCEmoji").value.trim() || "🎒",
      qty:    parseInt(el.querySelector("#dmCQty").value) || 1,
      weight: parseFloat(el.querySelector("#dmCWeight").value) || 0.1,
      type:   "consumable",
    };
    const c = characters[selectedCharId];
    await updateDoc(charRef(), { inventory: [...(c.inventory || []), item] });
    dmLog("system", "DM", `added ${item.qty}x ${item.name} to ${c.name}'s inventory`);
    el.querySelector("#dmAddConsumableForm").removeAttribute("open");
  });

  // Add equipment
  el.querySelector("#dmBtnAddEquipment").addEventListener("click", async () => {
    const name = el.querySelector("#dmEName").value.trim();
    if (!name) return;
    const effects = {};
    el.querySelectorAll(".dm-effect-input").forEach(inp => {
      const val = parseInt(inp.value) || 0;
      if (val !== 0) effects[inp.dataset.stat] = val;
    });
    const item = {
      name,
      emoji:   el.querySelector("#dmEEmoji").value.trim() || "⚔️",
      type:    el.querySelector("#dmEType").value,
      weight:  parseFloat(el.querySelector("#dmEWeight").value) || 1,
      equipped: false,
    };
    const damage = el.querySelector("#dmEDamage").value.trim();
    const armor  = parseInt(el.querySelector("#dmEArmor").value) || 0;
    if (damage) item.damage = damage;
    if (armor)  item.armor  = armor;
    if (Object.keys(effects).length) item.statEffects = effects;

    const c = characters[selectedCharId];
    await updateDoc(charRef(), { inventory: [...(c.inventory || []), item] });
    dmLog("system", "DM", `added ${item.name} to ${c.name}'s inventory`);
    el.querySelector("#dmAddEquipmentForm").removeAttribute("open");
  });
}

function makeInvRow(item, realIdx, char, isConsumable) {
  const div = document.createElement("div");
  div.className = "dm-inv-item" + (item.equipped ? " equipped" : "");

  const emoji = document.createElement("span");
  emoji.className = "dm-inv-emoji";
  emoji.textContent = item.emoji || (isConsumable ? "🎒" : "⚔️");

  const name = document.createElement("span");
  name.className = "dm-inv-name";
  name.textContent = item.name;

  const del = document.createElement("button");
  del.className = "dm-btn-del";
  del.textContent = "✕";
  del.title = "Remove item";
  del.addEventListener("click", async () => {
    const c = characters[selectedCharId];
    const inv = [...(c.inventory || [])];
    inv.splice(realIdx, 1);
    await updateDoc(charRef(), { inventory: inv });
  });

  div.append(emoji, name);

  if (isConsumable) {
    const qty = document.createElement("span");
    qty.className = "dm-inv-qty";
    qty.textContent = `${item.qty ?? 1}×`;

    const minus = document.createElement("button");
    minus.className = "dm-stat-btn";
    minus.textContent = "−";
    minus.addEventListener("click", async () => {
      const c = characters[selectedCharId];
      const inv = [...(c.inventory || [])];
      const newQty = Math.max(0, (inv[realIdx]?.qty ?? 1) - 1);
      if (newQty === 0) inv.splice(realIdx, 1);
      else inv[realIdx] = { ...inv[realIdx], qty: newQty };
      await updateDoc(charRef(), { inventory: inv });
    });

    const plus = document.createElement("button");
    plus.className = "dm-stat-btn";
    plus.textContent = "+";
    plus.addEventListener("click", async () => {
      const c = characters[selectedCharId];
      const inv = [...(c.inventory || [])];
      inv[realIdx] = { ...inv[realIdx], qty: (inv[realIdx]?.qty ?? 1) + 1 };
      await updateDoc(charRef(), { inventory: inv });
    });

    div.append(qty, minus, plus, del);
  } else {
    const typeEl = document.createElement("span");
    typeEl.className = "dm-inv-type";
    typeEl.textContent = item.type || "";

    const equipBtn = document.createElement("button");
    equipBtn.className = "dm-btn dm-btn-neutral dm-btn-sm";
    equipBtn.textContent = item.equipped ? "Unequip" : "Equip";
    equipBtn.addEventListener("click", async () => {
      const c = characters[selectedCharId];
      const inv = [...(c.inventory || [])];
      inv[realIdx] = { ...inv[realIdx], equipped: !inv[realIdx].equipped };
      await updateDoc(charRef(), { inventory: inv });
    });

    div.append(typeEl, equipBtn, del);
  }

  return div;
}

// ── LOG TAB ───────────────────────────────────────────────
function renderLogTab(char) {
  const el = document.getElementById("dm-tab-log");
  el.innerHTML = `
    <div class="dm-section">
      <h3 class="dm-section-title">Add Session Event</h3>
      <div class="dm-form-fields">
        <select class="dm-input" id="dmLogType" style="flex:none">
          <option value="system">System</option>
          <option value="combat">Combat</option>
          <option value="roleplay">Roleplay</option>
          <option value="loot">Loot</option>
          <option value="spell">Spell</option>
        </select>
        <input class="dm-input" id="dmLogActor" placeholder="Actor" value="DM" style="width:120px;flex:none" />
        <input class="dm-input" id="dmLogMsg" placeholder="Event description…" style="flex:1;min-width:180px" />
        <button class="dm-btn dm-btn-neutral" id="dmBtnAddLog">Add Event</button>
      </div>
    </div>
    <div class="dm-section">
      <h3 class="dm-section-title">Character Notes — ${char.name}</h3>
      <textarea class="dm-notes-area" id="dmNotesArea" placeholder="Notes for ${char.name}…">${char.notes || ""}</textarea>
      <button class="dm-btn dm-btn-neutral" id="dmBtnSaveNotes">Save Notes</button>
    </div>
  `;

  el.querySelector("#dmBtnAddLog").addEventListener("click", async () => {
    const type    = el.querySelector("#dmLogType").value;
    const actor   = el.querySelector("#dmLogActor").value.trim() || "DM";
    const message = el.querySelector("#dmLogMsg").value.trim();
    if (!message) return;
    await addDoc(collection(db, "sessionLog"), {
      type, actor, message,
      timestamp: serverTimestamp(),
      charId: selectedCharId || null,
    });
    el.querySelector("#dmLogMsg").value = "";
  });

  el.querySelector("#dmBtnSaveNotes").addEventListener("click", async () => {
    const notes = el.querySelector("#dmNotesArea").value || "";
    await updateDoc(charRef(), { notes });
    dmLog("system", "DM", `updated notes for ${char.name}`);
  });
}
