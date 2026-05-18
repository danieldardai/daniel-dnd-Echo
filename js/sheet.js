import { db } from "./firebase-config.js";
import {
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const charId = params.get("id");

const loadingEl = document.getElementById("sheetLoading");
const errorEl   = document.getElementById("sheetError");
const mainEl    = document.getElementById("sheetMain");

if (!charId) showError();

const headerClass  = document.getElementById("headerClass");
const headerName   = document.getElementById("headerName");
const headerPlayer = document.getElementById("headerPlayer");
const sheetPortrait= document.getElementById("sheetPortrait");
const identityMeta = document.getElementById("identityMeta");

const hpCurrentEl  = document.getElementById("hpCurrent");
const hpMaxEl      = document.getElementById("hpMax");
const hpTempLabel  = document.getElementById("hpTempLabel");
const hpBarFill    = document.getElementById("hpBarFill");
const hpAmountIn   = document.getElementById("hpAmount");
const btnDamage    = document.getElementById("btnDamage");
const btnHeal      = document.getElementById("btnHeal");
const btnTemp      = document.getElementById("btnTemp");

const dsSuccessPips= document.querySelectorAll("#dsSuccess .ds-pip");
const dsFailPips   = document.querySelectorAll("#dsFailure .ds-pip");
const btnResetDS   = document.getElementById("btnResetDS");

const condGrid     = document.getElementById("conditionsGrid");
const slotsGrid    = document.getElementById("slotsGrid");
const spellsGrid   = document.getElementById("spellsGrid");
const invList      = document.getElementById("inventoryList");
const statsGrid    = document.getElementById("statsGrid");
const notesArea    = document.getElementById("notesArea");
const btnSaveNotes = document.getElementById("btnSaveNotes");
const toastEl      = document.getElementById("toast");

function showError() {
  loadingEl.classList.add("hidden");
  errorEl.classList.remove("hidden");
}

function showMain() {
  loadingEl.classList.add("hidden");
  mainEl.classList.remove("hidden");
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2800);
}

function hpColor(pct) {
  if (pct > 60) return "var(--hp-green)";
  if (pct > 30) return "var(--hp-amber)";
  return "var(--hp-red)";
}

async function logEvent(type, actor, message) {
  try {
    await addDoc(collection(db, "sessionLog"), {
      type, actor, message, timestamp: serverTimestamp()
    });
  } catch (e) { console.warn("Log write failed:", e); }
}

const charRef = doc(db, "characters", charId);

async function update(data, logType, logMsg, actorName) {
  try {
    await updateDoc(charRef, data);
    if (logType && logMsg) await logEvent(logType, actorName, logMsg);
  } catch (e) {
    toast("❌ Update failed — check console");
    console.error(e);
  }
}

let currentData = {};

function renderIdentity(data) {
  document.title = `${data.name || "Hero"} — Echoes Beneath`;
  headerName.textContent   = data.name || "Unknown Hero";
  headerClass.textContent  = [data.race, data.class, data.level ? `Lvl ${data.level}` : ""].filter(Boolean).join(" · ");
  headerPlayer.textContent = data.player ? `Played by ${data.player}` : "";
  identityMeta.textContent = [data.race, data.class, data.level ? `Level ${data.level}` : ""].filter(Boolean).join(" · ");

  if (data.portrait) {
    sheetPortrait.innerHTML = `<img src="${data.portrait}" alt="${data.name}" />`;
  } else {
    sheetPortrait.innerHTML = `<div class="portrait-emoji">${data.emoji || "⚔️"}</div>`;
  }
}

function renderHP(data) {
  const cur  = data.hp     ?? 0;
  const max  = data.hpMax  ?? 0;
  const temp = data.hpTemp ?? 0;
  const pct  = max ? Math.min(100, Math.max(0, Math.round((cur / max) * 100))) : 0;
  hpCurrentEl.textContent = cur;
  hpMaxEl.textContent     = max;
  hpBarFill.style.width   = `${pct}%`;
  hpBarFill.style.background = hpColor(pct);
  hpTempLabel.textContent = temp > 0 ? `+${temp} temp` : "";
}

function renderDeathSaves(data) {
  const ds = data.deathSaves || { successes:[false,false,false], failures:[false,false,false] };
  dsSuccessPips.forEach((pip, i) => pip.classList.toggle("filled", !!(ds.successes?.[i])));
  dsFailPips.forEach(   (pip, i) => pip.classList.toggle("filled", !!(ds.failures?.[i])));
}

function renderConditions(data) {
  const DEFAULT_CONDITIONS = [
    "Blinded","Charmed","Deafened","Exhausted","Frightened","Grappled",
    "Incapacitated","Invisible","Paralyzed","Petrified","Poisoned",
    "Prone","Restrained","Stunned","Unconscious","Cursed","Concentrating"
  ];
  const saved = data.conditions || {};
  const all   = [...new Set([...DEFAULT_CONDITIONS, ...Object.keys(saved)])];

  condGrid.innerHTML = "";
  all.forEach(name => {
    const active = !!saved[name];
    const btn = document.createElement("button");
    btn.className = `condition-toggle${active ? " active" : ""}`;
    btn.textContent = name;
    btn.addEventListener("click", async () => {
      const newVal = !active;
      await update(
        { [`conditions.${name}`]: newVal },
        "condition",
        `${currentData.name} ${newVal ? "is now" : "is no longer"} ${name}`,
        currentData.name
      );
      toast(newVal ? `⚠️ ${name} applied` : `✓ ${name} removed`);
    });
    condGrid.appendChild(btn);
  });
}

function renderSpellSlots(data) {
  const slots = data.spellSlots;
  if (!slots || !Object.keys(slots).length) {
    document.getElementById("spellSlotsSection").classList.add("hidden");
    return;
  }
  document.getElementById("spellSlotsSection").classList.remove("hidden");
  slotsGrid.innerHTML = "";

  Object.entries(slots).forEach(([level, info]) => {
    const total = info.total ?? 0;
    const used  = info.used  ?? 0;
    const row   = document.createElement("div");
    row.className = "slot-row";
    row.innerHTML = `<span class="slot-row-label">${level}</span><div class="slot-pips"></div>`;
    const pipsEl = row.querySelector(".slot-pips");

    for (let i = 0; i < total; i++) {
      const pip = document.createElement("button");
      pip.className = `slot-pip${i < used ? " used" : ""}`;
      pip.title     = i < used ? "Expended — click to restore" : "Available — click to expend";
      pip.addEventListener("click", async () => {
        const curUsed = currentData.spellSlots?.[level]?.used ?? 0;
        const isUsed  = i < curUsed;
        const newUsed = isUsed ? Math.max(0, curUsed - 1) : Math.min(total, curUsed + 1);
        await update(
          { [`spellSlots.${level}.used`]: newUsed },
          "slot",
          `${currentData.name} ${isUsed ? "recovered" : "expended"} a ${level} slot`,
          currentData.name
        );
        toast(isUsed ? `🔮 ${level} slot recovered` : `🔮 ${level} slot expended`);
      });
      pipsEl.appendChild(pip);
    }
    slotsGrid.appendChild(row);
  });
}

function renderSpells(data) {
  const spells = data.spells;
  if (!spells || !spells.length) {
    document.getElementById("spellsSection").classList.add("hidden");
    return;
  }
  document.getElementById("spellsSection").classList.remove("hidden");
  spellsGrid.innerHTML = "";

  spells.forEach((spell) => {
    const card      = document.createElement("div");
    card.className  = "spell-card";
    const slotLevel = spell.slotLevel || null;
    const slots     = slotLevel ? (currentData.spellSlots?.[`Level ${slotLevel}`] ?? null) : null;
    const noSlots   = slots && slots.used >= slots.total;

    card.innerHTML = `
      <div class="spell-name">${spell.name}</div>
      <div class="spell-meta">
        ${spell.school ? `<span>${spell.school}</span>` : ""}
        ${spell.level  ? `· Lvl ${spell.level}` : "· Cantrip"}
        ${spell.castingTime ? `· ${spell.castingTime}` : ""}
        ${spell.range  ? `· ${spell.range}` : ""}
      </div>
      ${spell.notes ? `<div class="spell-meta" style="margin-top:0.25rem;font-style:italic;">${spell.notes}</div>` : ""}
      <button class="spell-cast-btn" ${noSlots ? "disabled title='No slots remaining'" : ""}>${slotLevel ? "Cast" : "Use"}</button>
    `;

    card.querySelector(".spell-cast-btn").addEventListener("click", async () => {
      if (slotLevel) {
        const curSlots = currentData.spellSlots?.[`Level ${slotLevel}`];
        if (curSlots) {
          if (curSlots.used >= curSlots.total) { toast("❌ No spell slots remaining!"); return; }
          await update(
            { [`spellSlots.Level ${slotLevel}.used`]: (curSlots.used ?? 0) + 1 },
            "spell",
            `${currentData.name} cast ${spell.name} (expended Lvl ${slotLevel} slot)`,
            currentData.name
          );
        }
      } else {
        await logEvent("spell", currentData.name, `${currentData.name} used ${spell.name}`);
      }
      toast(`✨ ${spell.name} cast!`);
    });
    spellsGrid.appendChild(card);
  });
}

function renderInventory(data) {
  const inv = data.inventory;
  if (!inv || !inv.length) {
    document.getElementById("inventorySection").classList.add("hidden");
    return;
  }
  document.getElementById("inventorySection").classList.remove("hidden");
  invList.innerHTML = "";

  inv.forEach((item, idx) => {
    const row          = document.createElement("div");
    row.className      = "inventory-row";
    const qty          = item.qty ?? 1;
    const isConsumable = item.consumable !== false;

    row.innerHTML = `
      <span class="inv-name">${item.name}</span>
      <span class="inv-qty">${qty > 1 ? `×${qty}` : ""}</span>
      ${isConsumable
        ? `<button class="inv-use-btn" ${qty <= 0 ? "disabled" : ""}>Use</button>`
        : `<span style="font-size:0.65rem;color:var(--parchment-dim);font-style:italic;">equipped</span>`
      }
    `;

    if (isConsumable) {
      row.querySelector(".inv-use-btn").addEventListener("click", async () => {
        const curInv  = [...(currentData.inventory || [])];
        const curItem = curInv[idx];
        if (!curItem || (curItem.qty ?? 1) <= 0) { toast("❌ None left!"); return; }
        const newQty  = (curItem.qty ?? 1) - 1;
        curInv[idx]   = { ...curItem, qty: newQty };
        await update(
          { inventory: curInv },
          "inventory",
          `${currentData.name} used ${item.name}${newQty === 0 ? " (last one)" : ` (${newQty} left)`}`,
          currentData.name
        );
        toast(`🎒 ${item.name} used${newQty === 0 ? " — none left!" : ""}`);
      });
    }
    invList.appendChild(row);
  });
}

function renderStats(data) {
  const stats = data.stats;
  if (!stats || !Object.keys(stats).length) {
    document.getElementById("statsSection").classList.add("hidden");
    return;
  }
  document.getElementById("statsSection").classList.remove("hidden");
  statsGrid.innerHTML = Object.entries(stats).map(([k, v]) => `
    <div class="stat-cell">
      <span class="stat-cell-label">${k}</span>
      <span class="stat-cell-value">${v}</span>
    </div>
  `).join("");
}

function renderNotes(data) {
  if (document.activeElement !== notesArea) notesArea.value = data.notes || "";
}

function getAmount() {
  const val = parseInt(hpAmountIn.value, 10);
  if (!val || val <= 0) { toast("Enter a number first"); return null; }
  return val;
}

btnDamage.addEventListener("click", async () => {
  const amt  = getAmount(); if (amt === null) return;
  const data = currentData;
  let hp     = data.hp    ?? 0;
  let temp   = data.hpTemp ?? 0;
  let dmg    = amt;
  if (temp > 0) { const abs = Math.min(temp, dmg); temp -= abs; dmg -= abs; }
  hp = Math.max(0, hp - dmg);
  await update({ hp, hpTemp: temp }, "damage", `${data.name} took ${amt} damage (HP: ${hp}/${data.hpMax ?? 0})`, data.name);
  hpAmountIn.value = "";
  toast(`⚔️ ${amt} damage taken`);
});

btnHeal.addEventListener("click", async () => {
  const amt  = getAmount(); if (amt === null) return;
  const data = currentData;
  const max  = data.hpMax ?? 0;
  const hp   = Math.min(max, (data.hp ?? 0) + amt);
  await update({ hp }, "heal", `${data.name} healed ${amt} HP (now ${hp}/${max})`, data.name);
  hpAmountIn.value = "";
  toast(`💚 Healed ${amt} HP`);
});

btnTemp.addEventListener("click", async () => {
  const amt     = getAmount(); if (amt === null) return;
  const newTemp = Math.max(currentData.hpTemp ?? 0, amt);
  await update({ hpTemp: newTemp }, "heal", `${currentData.name} gained ${amt} temporary HP`, currentData.name);
  hpAmountIn.value = "";
  toast(`🛡️ ${amt} temp HP granted`);
});

function dsClickHandler(type, index) {
  return async () => {
    const ds  = currentData.deathSaves || { successes:[false,false,false], failures:[false,false,false] };
    const arr = [...(ds[type] || [false,false,false])];
    arr[index] = !arr[index];
    await update(
      { [`deathSaves.${type}`]: arr },
      "death",
      `${currentData.name}: death save ${type.slice(0,-1)} ${arr[index] ? "marked" : "cleared"}`,
      currentData.name
    );
    toast(`💀 Death save ${type.slice(0,-1)} ${arr[index] ? "marked" : "cleared"}`);
  };
}

dsSuccessPips.forEach((pip, i) => pip.addEventListener("click", dsClickHandler("successes", i)));
dsFailPips.forEach(   (pip, i) => pip.addEventListener("click", dsClickHandler("failures",  i)));

btnResetDS.addEventListener("click", async () => {
  await update(
    { deathSaves: { successes:[false,false,false], failures:[false,false,false] } },
    "death", `${currentData.name}'s death saves reset`, currentData.name
  );
  toast("💀 Death saves reset");
});

btnSaveNotes.addEventListener("click", async () => {
  await update({ notes: notesArea.value }, "note", null, null);
  toast("📜 Notes saved");
});

let firstLoad = true;

onSnapshot(charRef, (snap) => {
  if (!snap.exists()) { showError(); return; }
  const data = snap.data();
  currentData = data;
  if (firstLoad) { showMain(); firstLoad = false; }
  renderIdentity(data);
  renderHP(data);
  renderDeathSaves(data);
  renderConditions(data);
  renderSpellSlots(data);
  renderSpells(data);
  renderInventory(data);
  renderStats(data);
  renderNotes(data);
}, (err) => {
  showError();
  console.error("Sheet listener error:", err);
});
