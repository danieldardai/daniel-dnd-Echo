import { db } from "./firebase-config.js";
import {
  doc, onSnapshot, updateDoc, addDoc, getDoc,
  collection, serverTimestamp, orderBy, query, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const charId = params.get("id");

const loadingEl  = document.getElementById("sheetLoading");
const errorEl    = document.getElementById("sheetError");
const layoutEl   = document.getElementById("sheetLayout");

if (!charId) showError();

// Sidebar elements
const sidebarName         = document.getElementById("sidebarName");
const sidebarMeta         = document.getElementById("sidebarMeta");
const sidebarPlayer       = document.getElementById("sidebarPlayer");
const sidebarLocation     = document.getElementById("sidebarLocation");
const portraitImgWrap     = document.getElementById("portraitImgWrap");
const portraitPlaceholder = document.getElementById("portraitPlaceholder");
const portraitInput       = document.getElementById("portraitInput");

// HP elements
const hpCurrentEl = document.getElementById("hpCurrent");
const hpMaxEl     = document.getElementById("hpMax");
const hpTempLabel = document.getElementById("hpTempLabel");
const hpBarFill   = document.getElementById("hpBarFill");
const hpAmountIn  = document.getElementById("hpAmount");
const btnDamage   = document.getElementById("btnDamage");
const btnHeal     = document.getElementById("btnHeal");
const btnTemp     = document.getElementById("btnTemp");

// Actions tab columns
const generalActionsCol = document.getElementById("generalActionsCol");
const weaponsActionsCol = document.getElementById("weaponsActionsCol");
const spellsActionsCol  = document.getElementById("spellsActionsCol");

// Conditions (stats tab)
const condGrid = document.getElementById("conditionsGrid");

// Inventory / stats / notes
const consumablesList = document.getElementById("consumablesList");
const equipmentList   = document.getElementById("equipmentList");
const weightBarFill   = document.getElementById("weightBarFill");
const weightValues    = document.getElementById("weightValues");
const weightStatus    = document.getElementById("weightStatus");
const notesArea    = document.getElementById("notesArea");
const btnSaveNotes = document.getElementById("btnSaveNotes");
const takenCheckbox= document.getElementById("takenCheckbox");

// Log feeds
const locationLogFeed = document.getElementById("locationLogFeed");
const localLogFeed    = document.getElementById("localLogFeed");

const toastEl = document.getElementById("toast");

// ---- Utility ----------------------------------------------------------------

function showError() {
  loadingEl.classList.add("hidden");
  errorEl.classList.remove("hidden");
}

function showLayout() {
  loadingEl.classList.add("hidden");
  layoutEl.classList.remove("hidden");
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

// ---- Firestore helpers ------------------------------------------------------

const charRef = doc(db, "characters", charId);

async function update(data, logType, logMsg, actorName) {
  try {
    await updateDoc(charRef, data);
    if (logType && logMsg) {
      await addDoc(collection(db, "sessionLog"), {
        type: logType, actor: actorName, message: logMsg,
        charId, timestamp: serverTimestamp()
      });
    }
  } catch (e) {
    toast("❌ Update failed");
    console.error(e);
  }
}

// ---- Tab switching ----------------------------------------------------------

const navTabs  = document.querySelectorAll(".nav-tab");
const tabPanels = document.querySelectorAll(".tab-panel");

navTabs.forEach(btn => {
  btn.addEventListener("click", () => {
    navTabs.forEach(t => t.classList.remove("active"));
    tabPanels.forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
    if (btn.dataset.tab === "dice") renderDiceTab();
  });
});

function switchToTab(name) {
  navTabs.forEach(t => t.classList.remove("active"));
  tabPanels.forEach(p => p.classList.add("hidden"));
  const btn = document.querySelector(`.nav-tab[data-tab="${name}"]`);
  btn?.classList.add("active");
  document.getElementById(`tab-${name}`)?.classList.remove("hidden");
}

// ---- Portrait upload (canvas resize → base64 → Firestore) ------------------

portraitInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = async () => {
      const MAX_W = 400, MAX_H = 600;
      const scale  = Math.min(1, MAX_W / img.width, MAX_H / img.height);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

      try {
        await updateDoc(charRef, { portrait: dataUrl });
        toast("Portrait updated");
      } catch (err) {
        toast("❌ Failed to save portrait");
        console.error(err);
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ---- Render functions -------------------------------------------------------

let currentData = {};

function renderIdentity(data) {
  document.title = `${data.name || "Hero"} — Echoes Beneath`;
  sidebarName.textContent   = data.name || "Unknown Hero";
  sidebarMeta.textContent   = [data.race, data.class, data.level ? `Lvl ${data.level}` : ""].filter(Boolean).join(" · ");
  sidebarPlayer.textContent = data.player ? `Played by ${data.player}` : "";

  const img = portraitImgWrap.querySelector("img");
  if (data.portrait) {
    if (!img) {
      portraitImgWrap.innerHTML = `<img src="${data.portrait}" alt="${data.name}" />`;
    } else {
      img.src = data.portrait;
    }
    if (portraitPlaceholder) portraitPlaceholder.style.display = "none";
  } else {
    if (img) img.remove();
    if (portraitPlaceholder) {
      portraitPlaceholder.style.display = "";
      portraitPlaceholder.textContent = data.emoji || "⚔️";
    }
  }
}

function renderHP(data) {
  const cur  = data.hp     ?? 0;
  const max  = data.hpMax  ?? 0;
  const temp = data.hpTemp ?? 0;
  const pct  = max ? Math.min(100, Math.max(0, Math.round((cur / max) * 100))) : 0;
  hpCurrentEl.textContent    = cur;
  hpMaxEl.textContent        = max;
  hpBarFill.style.width      = `${pct}%`;
  hpBarFill.style.background = hpColor(pct);
  hpTempLabel.textContent    = temp > 0 ? `+${temp} tmp` : "";
}

// ---- Dice Roll tab ----------------------------------------------------------

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];

let diceState = { type: 20, qty: 1, bonus: 0, context: null };

function parseDamage(str) {
  const m = /(\d+)d(\d+)([+-]\d+)?/i.exec(str || "");
  if (!m) return null;
  return { qty: parseInt(m[1]) || 1, type: parseInt(m[2]) || 6, bonus: m[3] ? parseInt(m[3]) : 0 };
}

// Ammo auto-detection: explicit `ammo` field on weapon overrides name patterns.
const AMMO_PAIRS = [
  { weapon: /crossbow/i,                      ammo: /bolt/i },
  { weapon: /longbow|shortbow|\bbow\b/i,       ammo: /arrow/i },
  { weapon: /blowgun/i,                        ammo: /needle/i },
  { weapon: /sling\b/i,                        ammo: /bullet|stone/i },
  { weapon: /throwing.knife|shuriken|kunai/i,  ammo: /throwing.knife|shuriken|kunai/i },
];

function findAmmoConsumable(ctx, inventory) {
  if (!ctx) return null;
  const needle = ctx.ammo ? ctx.ammo.toLowerCase() : null;
  if (needle) {
    return inventory.find(i => (i.name || "").toLowerCase() === needle && !isEquipment(i)) ?? null;
  }
  const wName = ctx.label || "";
  for (const p of AMMO_PAIRS) {
    if (p.weapon.test(wName)) {
      const found = inventory.find(i => p.ammo.test(i.name || "") && !isEquipment(i));
      if (found) return found;
    }
  }
  return null;
}

function setDiceContext(label, damageStr, ammoOverride = null, spellSlot = null, icon = "⚔️") {
  const parsed = parseDamage(damageStr);
  if (parsed) Object.assign(diceState, parsed);
  diceState.context = { label, damage: damageStr, ammo: ammoOverride, spellSlot, icon };
  switchToTab("dice");
  renderDiceTab();
}

function renderDiceTab() {
  const el = document.getElementById("tab-dice");
  if (!el) return;

  const bonusStr = diceState.bonus > 0 ? `+${diceState.bonus}` : diceState.bonus < 0 ? `${diceState.bonus}` : "";
  const rollLabel = `${diceState.qty}d${diceState.type}${bonusStr}`;

  el.innerHTML = `
    <div class="dice-layout">
      <section class="dice-section">
        <h2 class="dice-section-title">Die Type</h2>
        <div class="dice-faces" id="diceFaces"></div>
      </section>
      <section class="dice-section">
        <div class="dice-controls-row">
          <div class="dice-ctrl-group">
            <span class="dice-ctrl-label">Quantity</span>
            <div class="dice-qty-ctrl">
              <button class="dice-qty-btn" id="diceQtyMinus">−</button>
              <span class="dice-qty-val" id="diceQtyVal">${diceState.qty}</span>
              <button class="dice-qty-btn" id="diceQtyPlus">+</button>
            </div>
          </div>
          <div class="dice-ctrl-group">
            <span class="dice-ctrl-label">Bonus / Modifier</span>
            <input type="number" class="dice-bonus-input" id="diceBonusInput" value="${diceState.bonus}" />
          </div>
          <span class="dice-formula">${rollLabel}</span>
        </div>
      </section>
      ${diceState.context ? (() => {
          const ctx      = diceState.context;
          const ctxIcon  = ctx.icon || "⚔️";
          // Ammo badge
          const ammoItem = findAmmoConsumable(ctx, currentData.inventory || []);
          const ammoQty  = ammoItem ? (ammoItem.qty ?? 1) : null;
          const ammoHtml = ammoItem
            ? ` <span class="dice-ammo-count ${ammoQty <= 0 ? "empty" : ammoQty <= 5 ? "low" : ""}">${ammoItem.emoji || "🏹"} ${ammoItem.name}: ${ammoQty}</span>`
            : "";
          // Spell slot badge
          let slotHtml = "";
          if (ctx.spellSlot) {
            const curInfo   = currentData.spellSlots?.[ctx.spellSlot.level];
            const remaining = curInfo ? (curInfo.total - curInfo.used) : 0;
            slotHtml = ` <span class="dice-ammo-count ${remaining <= 0 ? "empty" : remaining === 1 ? "low" : ""}">🔮 ${ctx.spellSlot.level}: ${remaining} left</span>`;
          }
          return `
        <div class="dice-context-bar">
          <span class="dice-context-label">${ctxIcon} ${ctx.label}${ctx.damage ? ` (${ctx.damage})` : ""}${ammoHtml}${slotHtml}</span>
          <button class="dice-context-clear" id="diceContextClear">✕ Clear</button>
        </div>`;
        })() : ""}
      <button class="dice-roll-btn" id="diceRollBtn">🎲 Roll ${rollLabel}</button>
      <div class="dice-result-area" id="diceResultArea"></div>
    </div>
  `;

  // Die face buttons
  const facesEl = el.querySelector("#diceFaces");
  DICE_TYPES.forEach(d => {
    const btn = document.createElement("button");
    btn.className = "dice-face-btn" + (diceState.type === d ? " active" : "");
    btn.textContent = `d${d}`;
    btn.addEventListener("click", () => { diceState.type = d; renderDiceTab(); });
    facesEl.appendChild(btn);
  });

  // Qty controls
  el.querySelector("#diceQtyMinus").addEventListener("click", () => {
    if (diceState.qty > 1) { diceState.qty--; renderDiceTab(); }
  });
  el.querySelector("#diceQtyPlus").addEventListener("click", () => {
    if (diceState.qty < 20) { diceState.qty++; renderDiceTab(); }
  });

  // Bonus input
  el.querySelector("#diceBonusInput").addEventListener("change", e => {
    diceState.bonus = parseInt(e.target.value) || 0;
    const bonusStr2 = diceState.bonus > 0 ? `+${diceState.bonus}` : diceState.bonus < 0 ? `${diceState.bonus}` : "";
    el.querySelector(".dice-formula").textContent = `${diceState.qty}d${diceState.type}${bonusStr2}`;
    el.querySelector("#diceRollBtn").textContent = `🎲 Roll ${diceState.qty}d${diceState.type}${bonusStr2}`;
  });

  // Clear context
  el.querySelector("#diceContextClear")?.addEventListener("click", () => {
    diceState.context = null;
    renderDiceTab();
  });

  // Roll
  el.querySelector("#diceRollBtn").addEventListener("click", executeDiceRoll);
}

async function executeDiceRoll() {
  // Spell slot check — block and consume if applicable
  if (diceState.context?.spellSlot) {
    const slotKey = diceState.context.spellSlot.level;
    const curInfo = currentData.spellSlots?.[slotKey];
    if (!curInfo || curInfo.used >= curInfo.total) {
      toast(`❌ No ${slotKey} slots remaining!`);
      renderDiceTab();
      return;
    }
    await update({ [`spellSlots.${slotKey}.used`]: (curInfo.used ?? 0) + 1 }, null, null, null);
  }

  // Ammo check — find linked consumable and block if depleted
  const inv      = [...(currentData.inventory || [])];
  const ammoItem = findAmmoConsumable(diceState.context, inv);
  const ammoIdx  = ammoItem ? inv.indexOf(ammoItem) : -1;

  if (ammoItem && (ammoItem.qty ?? 1) <= 0) {
    toast(`❌ No ${ammoItem.name} remaining!`);
    renderDiceTab();
    return;
  }

  const rolls  = Array.from({ length: diceState.qty }, () => Math.floor(Math.random() * diceState.type) + 1);
  const sum    = rolls.reduce((a, b) => a + b, 0);
  const total  = sum + diceState.bonus;
  const bonus  = diceState.bonus;
  const bonusStr = bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : "";
  const formula  = `${diceState.qty}d${diceState.type}${bonusStr}`;

  const isCrit   = diceState.type === 20 && diceState.qty === 1 && rolls[0] === 20;
  const isFumble = diceState.type === 20 && diceState.qty === 1 && rolls[0] === 1;

  let msg;
  if (diceState.context) {
    msg = `${currentData.name} used ${diceState.context.label} → rolled ${total} on ${formula}`;
    if (diceState.qty > 1 || bonus !== 0) {
      const parts = rolls.join(" + ") + (bonus !== 0 ? ` ${bonusStr}` : "");
      msg += ` (${parts})`;
    }
  } else {
    msg = `${currentData.name} rolled ${formula} → ${total}`;
    if (diceState.qty > 1) msg += ` (${rolls.join(" + ")})`;
  }
  if (isCrit)   msg += " — CRITICAL HIT!";
  if (isFumble) msg += " — FUMBLE!";

  // Deduct ammo and write log simultaneously
  const promises = [
    addDoc(collection(db, "sessionLog"), {
      type: "roll", actor: currentData.name, message: msg,
      charId, timestamp: serverTimestamp(),
    })
  ];
  if (ammoIdx !== -1) {
    const newQty = (ammoItem.qty ?? 1) - 1;
    inv[ammoIdx] = { ...ammoItem, qty: newQty };
    promises.push(updateDoc(charRef, { inventory: inv }));
  }
  await Promise.all(promises);

  if (ammoIdx !== -1) {
    const remaining = inv[ammoIdx].qty;
    if (remaining === 0) toast(`⚠️ ${ammoItem.name} — none left!`);
    else if (remaining <= 5) toast(`🎲 ${total} · ${ammoItem.name}: ${remaining} left`);
    else toast(`🎲 ${total}${isCrit ? " ✨ Crit!" : isFumble ? " 💀 Fumble!" : ""}`);
  } else {
    toast(`🎲 ${total}${isCrit ? " ✨ Crit!" : isFumble ? " 💀 Fumble!" : ""}`);
  }

  showRollResult(rolls, total, formula, isCrit, isFumble);
}

function showRollResult(rolls, total, formula, isCrit, isFumble) {
  const area = document.getElementById("diceResultArea");
  if (!area) return;

  const bonus    = diceState.bonus;
  const bonusStr = bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : "";
  const pipsHTML = rolls.length > 1 || bonus !== 0 ? `
    <div class="dice-result-pips">
      ${rolls.map(r => `<span class="dice-result-pip">${r}</span>`).join("")}
      ${bonus !== 0 ? `<span class="dice-result-bonus">${bonusStr}</span>` : ""}
    </div>` : "";

  area.innerHTML = `
    <div class="dice-result${isCrit ? " crit" : isFumble ? " fumble" : ""}">
      <div class="dice-result-total">${total}</div>
      <div class="dice-result-label">${formula}</div>
      ${pipsHTML}
      ${isCrit   ? `<div class="dice-result-flag">✨ Critical Hit!</div>` : ""}
      ${isFumble ? `<div class="dice-result-flag fumble-flag">💀 Fumble!</div>` : ""}
    </div>
  `;
}

// ---- Claude API helpers (shared key with DM panel) -------------------------

function getClaudeApiKey() {
  return localStorage.getItem("ebClaudeApiKey") || "";
}

async function callClaudeAction(text, charName) {
  const apiKey = getClaudeApiKey();
  if (!apiKey) throw new Error("No API key configured");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are a narrative assistant for "Echoes Beneath," a dark fantasy tabletop RPG. The player controlling ${charName} described their character's action. The input may be in English, Hungarian, or a mixture of both — accept all of these. Correct any typos, understand the intent, and write a vivid 1-2 sentence in-character action description in both languages.\n\nPlayer input: "${text}"\n\nRespond in exactly this format (no extra commentary):\n🇬🇧 [English description, 1-2 sentences]\n🇭🇺 [Hungarian description, 1-2 sentences]`,
      }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `API error ${response.status}`);
  return data.content[0].text.trim();
}

// ---- Actions tab: three columns -------------------------------------------

const GENERAL_ACTIONS = [
  { name: "Search",    icon: "🔍", prefill: "I examine the area carefully, searching for anything hidden or out of place." },
  { name: "Reveal",    icon: "👁️",  prefill: "I expose what has been concealed, bringing it into the open." },
  { name: "Heal",      icon: "💚", prefill: "I tend to my wounds, spending a moment to recover my strength." },
  { name: "Dash",      icon: "💨", prefill: "I sprint forward with all my speed, covering ground quickly." },
  { name: "Dodge",     icon: "🛡️",  prefill: "I focus entirely on staying out of harm's way." },
  { name: "Help",      icon: "🤝", prefill: "I lend my aid to an ally, helping them succeed." },
  { name: "Hide",      icon: "👤", prefill: "I slip into the shadows, attempting to conceal myself from sight." },
  { name: "Ready",     icon: "⏳", prefill: "I prepare myself, ready to act the moment the right opportunity arises." },
  { name: "Disengage", icon: "🏃", prefill: "I carefully break away from the fight, avoiding any opportunity attacks." },
  { name: "Stabilize", icon: "❤️", prefill: "I rush to a fallen ally and do my best to keep them alive." },
];

function makeActionCard(icon, name, desc, onClick, disabled = false) {
  const btn = document.createElement("button");
  btn.className = "action-card" + (disabled ? " depleted" : "");
  btn.disabled = disabled;
  btn.innerHTML = `
    <span class="action-card-icon">${icon}</span>
    <div class="action-card-info">
      <span class="action-card-name">${name}</span>
      ${desc ? `<span class="action-card-desc">${desc}</span>` : ""}
    </div>
  `;
  if (!disabled) btn.addEventListener("click", onClick);
  return btn;
}

function renderGeneralActions() {
  generalActionsCol.innerHTML = "";

  // Textarea
  const textarea = document.createElement("textarea");
  textarea.className = "action-narrate-textarea";
  textarea.placeholder = "Describe your action… (English, Hungarian, or both)";
  textarea.rows = 3;
  generalActionsCol.appendChild(textarea);

  // Send row
  const sendRow = document.createElement("div");
  sendRow.className = "action-narrate-send-row";
  const statusEl = document.createElement("span");
  statusEl.className = "action-narrate-status";
  const sendBtn = document.createElement("button");
  sendBtn.className = "action-btn btn-narrate";
  sendBtn.textContent = "✨ Narrate";
  sendRow.appendChild(statusEl);
  sendRow.appendChild(sendBtn);
  generalActionsCol.appendChild(sendRow);

  // Divider
  const divider = document.createElement("div");
  divider.className = "action-narrate-divider";
  divider.textContent = "Quick actions";
  generalActionsCol.appendChild(divider);

  // Prefill buttons grid
  const grid = document.createElement("div");
  grid.className = "action-narrate-grid";
  GENERAL_ACTIONS.forEach(action => {
    const btn = document.createElement("button");
    btn.className = "action-narrate-btn";
    btn.innerHTML = `<span class="action-narrate-icon">${action.icon}</span><span class="action-narrate-name">${action.name}</span>`;
    btn.addEventListener("click", () => {
      textarea.value = action.prefill;
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    });
    grid.appendChild(btn);
  });
  generalActionsCol.appendChild(grid);

  // Send on click
  sendBtn.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text) { textarea.focus(); return; }

    let apiKey = getClaudeApiKey();
    if (!apiKey) {
      apiKey = prompt("Enter your Anthropic API key (stored locally in this browser only):");
      if (!apiKey) return;
      localStorage.setItem("ebClaudeApiKey", apiKey.trim());
    }

    sendBtn.disabled = true;
    statusEl.textContent = "✨ Narrating…";

    try {
      const result = await callClaudeAction(text, currentData.name || "the hero");
      await addDoc(collection(db, "sessionLog"), {
        type: "action", actor: currentData.name,
        message: result,
        charId, timestamp: serverTimestamp(),
      });
      textarea.value = "";
      statusEl.textContent = "";
      toast("✨ Action narrated!");
    } catch (err) {
      statusEl.textContent = "⚠ " + err.message;
    } finally {
      sendBtn.disabled = false;
    }
  });

  // Ctrl/Cmd+Enter to send
  textarea.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendBtn.click();
    }
  });
}

function renderWeaponActions(data) {
  weaponsActionsCol.innerHTML = "";
  const inv     = data.inventory || [];
  const weapons = inv.filter(item => item.weapon === true || item.type === "weapon" || item.damage);

  if (!weapons.length) {
    weaponsActionsCol.innerHTML = `<p class="action-col-empty">No weapons found.<br>Add inventory items with a <code>damage</code> field or <code>weapon: true</code> in Firestore.</p>`;
    return;
  }

  weapons.forEach(item => {
    const meta = [item.damage, item.range ? `Range: ${item.range}` : null].filter(Boolean).join(" · ");
    weaponsActionsCol.appendChild(makeActionCard(
      item.emoji || "⚔️", item.name, meta,
      () => setDiceContext(item.name, item.damage || "1d6", item.ammo || null)
    ));
  });
}

function renderSpellActions(data) {
  spellsActionsCol.innerHTML = "";
  const spells = data.spells    || [];
  const slots  = data.spellSlots || {};

  // Slot tracker at top
  if (Object.keys(slots).length) {
    const tracker = document.createElement("div");
    tracker.className = "action-spell-slots";
    tracker.innerHTML = `<p class="action-spell-slots-label">Spell Slots</p>`;
    Object.entries(slots).forEach(([level, info]) => {
      const row = document.createElement("div");
      row.className = "action-slot-row";
      const pips = Array.from({ length: info.total ?? 0 }, (_, i) =>
        `<span class="action-slot-pip ${i < (info.used ?? 0) ? "used" : ""}"></span>`
      ).join("");
      row.innerHTML = `<span class="action-slot-label">${level}</span><div class="action-slot-pips">${pips}</div>`;
      tracker.appendChild(row);
    });
    spellsActionsCol.appendChild(tracker);
  }

  if (!spells.length) {
    const empty = document.createElement("p");
    empty.className = "action-col-empty";
    empty.textContent = "No spells available.";
    spellsActionsCol.appendChild(empty);
    return;
  }

  // Group by category field (attack / defense / general)
  const groups = { attack: [], defense: [], general: [] };
  spells.forEach(spell => {
    const cat = spell.category || spell.type || "general";
    (groups[cat] ?? groups.general).push(spell);
  });

  const GROUP_LABELS = { attack: "⚔️ Attack", defense: "🛡️ Defense", general: "✨ General" };
  Object.entries(groups).forEach(([key, list]) => {
    if (!list.length) return;
    const header = document.createElement("p");
    header.className = "action-spell-group-label";
    header.textContent = GROUP_LABELS[key];
    spellsActionsCol.appendChild(header);

    list.forEach(spell => {
      const slotLevel = spell.slotLevel || null;
      const slotInfo  = slotLevel ? (slots[`Level ${slotLevel}`] ?? null) : null;
      const noSlots   = !!(slotInfo && slotInfo.used >= slotInfo.total);
      const meta      = [
        spell.level ? `Lvl ${spell.level}` : "Cantrip",
        spell.castingTime,
        spell.range,
        spell.damage ? `🎲 ${spell.damage}` : null,
      ].filter(Boolean).join(" · ");

      spellsActionsCol.appendChild(makeActionCard(
        "✨", spell.name, meta,
        () => {
          if (spell.damage) {
            // Has dice formula — open dice tab (slot consumed on roll)
            const spellSlot = slotLevel ? { level: `Level ${slotLevel}`, info: slotInfo } : null;
            setDiceContext(spell.name, spell.damage, null, spellSlot, "✨");
          } else {
            // No damage dice — cast immediately and log
            (async () => {
              if (slotLevel && slotInfo) {
                if (slotInfo.used >= slotInfo.total) { toast("❌ No spell slots!"); return; }
                await update(
                  { [`spellSlots.Level ${slotLevel}.used`]: (slotInfo.used ?? 0) + 1 },
                  "spell", `${currentData.name} cast ${spell.name} (expended Lvl ${slotLevel} slot)`,
                  currentData.name
                );
              } else {
                await addDoc(collection(db, "sessionLog"), {
                  type: "spell", actor: currentData.name,
                  message: `${currentData.name} used ${spell.name}`,
                  charId, timestamp: serverTimestamp()
                });
              }
              toast(`✨ ${spell.name} cast!`);
            })();
          }
        },
        noSlots
      ));
    });
  });
}

function renderActions(data) {
  renderGeneralActions();
  renderWeaponActions(data);
  renderSpellActions(data);
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


// ---- Inventory helpers ------------------------------------------------------

function isEquipment(item) {
  return item.type === "weapon" || item.type === "armor" ||
         item.type === "equipment" || item.weapon === true;
}

function calcCarryCapacity(data) {
  const might     = data.stats?.Might     ?? 0;
  const endurance = data.stats?.Endurance ?? 0;
  return Math.round((25 + might * 2.5 + endurance * 1.5) * 10) / 10;
}

function calcCurrentWeight(inventory) {
  return Math.round(
    (inventory || []).reduce((sum, item) => {
      const w = item.weight ?? 0;
      const q = item.qty    ?? 1;
      return sum + w * q;
    }, 0) * 10
  ) / 10;
}

function getEquipmentModifiers(inventory) {
  const mods = {};
  (inventory || []).forEach(item => {
    if (item.equipped && item.statEffects) {
      Object.entries(item.statEffects).forEach(([stat, val]) => {
        mods[stat] = (mods[stat] ?? 0) + (val || 0);
      });
    }
  });
  return mods;
}

// ---- Render inventory -------------------------------------------------------

function renderInventory(data) {
  const inv      = data.inventory || [];
  const capacity = calcCarryCapacity(data);
  const carried  = calcCurrentWeight(inv);
  const pct      = Math.min(100, capacity > 0 ? (carried / capacity) * 100 : 0);
  const over     = carried > capacity;

  // Weight bar
  weightBarFill.style.width      = `${pct}%`;
  weightBarFill.style.background = over ? "var(--hp-red)" : pct > 75 ? "var(--hp-amber)" : "var(--hp-green)";
  weightValues.textContent       = `${carried} / ${capacity} kg`;
  weightStatus.textContent       = over ? "⚠ Encumbered" : "";

  const consumables = inv.filter(item => !isEquipment(item));
  const equipment   = inv.filter(item =>  isEquipment(item));

  // ---- Consumables column ----
  consumablesList.innerHTML = "";
  if (!consumables.length) {
    consumablesList.innerHTML = `<p class="inv-empty">No consumables.</p>`;
  } else {
    consumables.forEach(item => {
      const idx  = inv.indexOf(item);
      const qty  = item.qty ?? 1;
      const w    = item.weight ? `${(item.weight * qty).toFixed(2)} kg` : "";

      const card = document.createElement("div");
      card.className = "inv-card";
      card.innerHTML = `
        <div class="inv-card-header">
          <span class="inv-card-icon">${item.emoji || "🧪"}</span>
          <span class="inv-card-name">${item.name}</span>
          <span class="inv-card-qty ${qty <= 2 ? "low" : ""}">×${qty}</span>
        </div>
        ${w ? `<div class="inv-card-meta"><span class="inv-card-weight">${w}</span></div>` : ""}
        <div class="inv-card-actions">
          <button class="inv-btn use-btn" ${qty <= 0 ? "disabled" : ""}>Use</button>
        </div>
      `;
      card.querySelector(".use-btn").addEventListener("click", async () => {
        const curInv  = [...(currentData.inventory || [])];
        const cur     = curInv[idx];
        if (!cur || (cur.qty ?? 1) <= 0) { toast("❌ None left!"); return; }
        const newQty  = (cur.qty ?? 1) - 1;
        curInv[idx]   = { ...cur, qty: newQty };
        await update(
          { inventory: curInv },
          "inventory",
          `${currentData.name} used ${item.name}${newQty === 0 ? " (last one)" : ` (${newQty} left)`}`,
          currentData.name
        );
        toast(`🧪 ${item.name} used${newQty === 0 ? " — none left!" : ""}`);
      });
      consumablesList.appendChild(card);
    });
  }

  // ---- Equipment column ----
  equipmentList.innerHTML = "";
  if (!equipment.length) {
    equipmentList.innerHTML = `<p class="inv-empty">No equipment.</p>`;
  } else {
    equipment.forEach(item => {
      const idx      = inv.indexOf(item);
      const equipped = !!item.equipped;
      const effects  = item.statEffects ? Object.entries(item.statEffects) : [];
      const wText    = item.weight ? `${item.weight} kg` : "";

      const effectsHTML = effects.map(([stat, val]) => {
        const cls = val > 0 ? "pos" : val < 0 ? "neg" : "neu";
        return `<span class="inv-effect ${cls}">${stat} ${val > 0 ? "+" : ""}${val}</span>`;
      }).join("");

      const card = document.createElement("div");
      card.className = `inv-card${equipped ? " equipped" : ""}`;
      card.innerHTML = `
        <div class="inv-card-header">
          <span class="inv-card-icon">${item.emoji || (item.type === "armor" ? "🛡️" : "⚔️")}</span>
          <span class="inv-card-name">${item.name}</span>
        </div>
        <div class="inv-card-meta">
          ${wText ? `<span class="inv-card-weight">${wText}</span>` : ""}
          ${item.damage ? `<span class="inv-card-damage">⚔ ${item.damage}</span>` : ""}
          ${item.armor  ? `<span class="inv-card-damage">🛡 ${item.armor}</span>` : ""}
        </div>
        ${effectsHTML ? `<div class="inv-card-effects">${effectsHTML}</div>` : ""}
        <div class="inv-card-actions">
          ${item.damage || item.weapon === true ? `<button class="inv-btn attack-btn">⚔️ Attack</button>` : ""}
          <button class="inv-btn equip-btn ${equipped ? "equipped-btn" : ""}">
            ${equipped ? "Unequip" : "Equip"}
          </button>
        </div>
      `;
      card.querySelector(".attack-btn")?.addEventListener("click", () => {
        setDiceContext(item.name, item.damage || "1d6", item.ammo || null);
      });
      card.querySelector(".equip-btn").addEventListener("click", async () => {
        const curInv = [...(currentData.inventory || [])];
        curInv[idx]  = { ...curInv[idx], equipped: !equipped };
        await update(
          { inventory: curInv },
          "inventory",
          `${currentData.name} ${!equipped ? "equipped" : "unequipped"} ${item.name}`,
          currentData.name
        );
        toast(`${!equipped ? "✅ Equipped" : "❌ Unequipped"}: ${item.name}`);
      });
      equipmentList.appendChild(card);
    });
  }
}

const STAT_CATEGORIES = [
  { name: "BODY",      stats: ["Might", "Agility", "Endurance"] },
  { name: "MIND",      stats: ["Knowledge", "Perception", "Ingenuity"] },
  { name: "SPIRIT",    stats: ["Presence", "Will", "Empathy"] },
  { name: "RESONANCE", stats: ["Resonance"] },
];

function renderStats(data) {
  const base    = data.stats         || {};
  const spellMods = data.statModifiers || {};
  const equipMods = getEquipmentModifiers(data.inventory || []);
  const mods    = {};
  [...new Set([...Object.keys(spellMods), ...Object.keys(equipMods)])].forEach(k => {
    mods[k] = (spellMods[k] ?? 0) + (equipMods[k] ?? 0);
  });
  const container = document.getElementById("statCategories");
  container.innerHTML = "";

  STAT_CATEGORIES.forEach(cat => {
    const group = document.createElement("div");
    group.className = "stat-category";
    group.innerHTML = `<h3 class="stat-category-title">${cat.name}</h3>`;

    const grid = document.createElement("div");
    grid.className = "stat-category-grid";

    cat.stats.forEach(statName => {
      const baseVal      = base[statName] ?? 0;
      const modVal       = mods[statName] ?? 0;
      const effectiveVal = baseVal + modVal;

      const card = document.createElement("div");
      card.className = "stat-card";

      const modHTML = modVal !== 0
        ? `<span class="stat-card-mod ${modVal > 0 ? "pos" : "neg"}">${modVal > 0 ? "+" : ""}${modVal}</span>`
        : "";

      card.innerHTML = `
        <span class="stat-card-name">${statName}</span>
        <span class="stat-card-effective">${effectiveVal}</span>
        <div class="stat-card-base-row">
          <span class="stat-card-base-label">base</span>
          <button class="stat-card-base-val" data-stat="${statName}" data-val="${baseVal}">${baseVal}</button>
          ${modHTML}
        </div>
      `;

      card.querySelector(".stat-card-base-val").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        const input = document.createElement("input");
        input.type = "number";
        input.value = btn.dataset.val;
        input.className = "stat-card-base-input";
        btn.replaceWith(input);
        input.focus();
        input.select();

        const save = async () => {
          const newVal = parseInt(input.value, 10);
          if (!isNaN(newVal)) {
            await update({ [`stats.${statName}`]: newVal }, null, null, null);
          }
        };
        input.addEventListener("blur", save);
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter")  input.blur();
          if (ev.key === "Escape") { input.value = btn.dataset.val; input.blur(); }
        });
      });

      grid.appendChild(card);
    });

    group.appendChild(grid);
    container.appendChild(group);
  });
}

function renderNotes(data) {
  if (document.activeElement !== notesArea) notesArea.value = data.notes || "";
}

let lastLocationId = undefined;
async function renderLocation(locationId) {
  if (locationId === lastLocationId) return;
  lastLocationId = locationId;
  if (!locationId) { sidebarLocation.textContent = ""; return; }
  try {
    const snap = await getDoc(doc(db, "locations", locationId));
    if (snap.exists()) {
      const loc = snap.data();
      sidebarLocation.textContent = `${loc.emoji || "📍"} ${loc.name}`;
    }
  } catch (_) { sidebarLocation.textContent = ""; }
}

function renderTaken(data) {
  takenCheckbox.checked = !!data.taken;
}

// ---- HP actions -------------------------------------------------------------

function getAmount() {
  const val = parseInt(hpAmountIn.value, 10);
  if (!val || val <= 0) { toast("Enter a number first"); return null; }
  return val;
}

btnDamage.addEventListener("click", async () => {
  const amt = getAmount(); if (amt === null) return;
  let hp   = currentData.hp    ?? 0;
  let temp = currentData.hpTemp ?? 0;
  let dmg  = amt;
  if (temp > 0) { const abs = Math.min(temp, dmg); temp -= abs; dmg -= abs; }
  hp = Math.max(0, hp - dmg);
  await update({ hp, hpTemp: temp }, "damage",
    `${currentData.name} took ${amt} damage (HP: ${hp}/${currentData.hpMax ?? 0})`, currentData.name);
  hpAmountIn.value = "";
  toast(`⚔️ ${amt} damage taken`);
});

btnHeal.addEventListener("click", async () => {
  const amt = getAmount(); if (amt === null) return;
  const max = currentData.hpMax ?? 0;
  const hp  = Math.min(max, (currentData.hp ?? 0) + amt);
  await update({ hp }, "heal", `${currentData.name} healed ${amt} HP (now ${hp}/${max})`, currentData.name);
  hpAmountIn.value = "";
  toast(`💚 Healed ${amt} HP`);
});

btnTemp.addEventListener("click", async () => {
  const amt     = getAmount(); if (amt === null) return;
  const newTemp = Math.max(currentData.hpTemp ?? 0, amt);
  await update({ hpTemp: newTemp }, "heal",
    `${currentData.name} gained ${amt} temporary HP`, currentData.name);
  hpAmountIn.value = "";
  toast(`🛡️ ${amt} temp HP granted`);
});


// ---- Notes & taken ----------------------------------------------------------

btnSaveNotes.addEventListener("click", async () => {
  await update({ notes: notesArea.value }, null, null, null);
  toast("📜 Notes saved");
});

takenCheckbox.addEventListener("change", async () => {
  await update({ taken: takenCheckbox.checked }, null, null, null);
  toast(takenCheckbox.checked ? "⚔️ Character marked as taken" : "Character unmarked");
});

// ---- Campaign log (split: global + local) -----------------------------------

const LOG_ICONS = {
  damage:"⚔️", heal:"💚", spell:"✨", slot:"🔮",
  condition:"🌀", inventory:"🎒", death:"💀", note:"📜", roll:"🎲", turn:"🔔", default:"📖"
};

function timeAgo(ts) {
  if (!ts) return "";
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60)    return "just now";
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return d.toLocaleDateString();
}

function buildLogEntry(id, data) {
  const el = document.createElement("div");
  const isTurn = data.type === "turn";
  el.className = "log-entry" + (isTurn ? " log-entry--turn" : "");
  el.dataset.id = id;
  el.innerHTML = isTurn
    ? `<div class="log-turn-narrative">
         <span class="log-turn-label">DM</span>
         <span class="log-turn-text">${data.message || ""}</span>
         <span class="log-time">${timeAgo(data.timestamp)}</span>
       </div>`
    : `<span class="log-icon">${LOG_ICONS[data.type] || LOG_ICONS.default}</span>
       <div class="log-content">
         <span class="log-actor">${data.actor || "Unknown"}</span>
         <span class="log-message">${data.message || ""}</span>
       </div>
       <span class="log-time">${timeAgo(data.timestamp)}</span>`;
  return el;
}

const localEntries    = {};
const locationEntries = {};
let   allCharData     = {};
let   locationCharIds = new Set();

function rebuildLocationCharIds() {
  const myLocId = currentData.locationId ?? null;
  locationCharIds = new Set();
  if (myLocId) {
    Object.entries(allCharData).forEach(([id, d]) => {
      if ((d.locationId ?? null) === myLocId) locationCharIds.add(id);
    });
    locationCharIds.add(charId);
  }
}

function rerenderLocationFeed() {
  locationLogFeed.innerHTML = "";
  const myLocId = currentData.locationId ?? null;

  if (!myLocId) {
    locationLogFeed.innerHTML = `<div class="log-empty">Not assigned to a location yet…</div>`;
    return;
  }

  const visible = Object.values(locationEntries)
    .filter(e => {
      if (e.data.locationId) return e.data.locationId === myLocId;
      return locationCharIds.has(e.data.charId);
    })
    .sort((a, b) => {
      const ta = a.data.timestamp?.seconds ?? Number.MAX_SAFE_INTEGER;
      const tb = b.data.timestamp?.seconds ?? Number.MAX_SAFE_INTEGER;
      return tb - ta;
    });

  if (!visible.length) {
    locationLogFeed.innerHTML = `<div class="log-empty">No events in this location yet…</div>`;
    return;
  }
  visible.forEach(e => locationLogFeed.appendChild(e.el));
}

// ---- Turn banner ---------------------------------------------------------------

const TURN_PHASE_ICONS = { combat:"⚔️", exploration:"🗺️", roleplay:"💬", downtime:"🏕️" };

let allCampaignTurns = {};

function updateTurnBanner() {
  const myLocId = currentData.locationId ?? null;
  // Location-specific turn takes priority over global
  const turn = (myLocId && allCampaignTurns[myLocId]?.active && allCampaignTurns[myLocId])
            || (allCampaignTurns["__global__"]?.active && allCampaignTurns["__global__"])
            || null;
  renderTurnBanner(turn);
}

function renderTurnBanner(turnData) {
  const banner = document.getElementById("turnBanner");
  if (!banner) return;
  if (!turnData?.active) {
    banner.className = "turn-banner hidden";
    return;
  }
  const phase = turnData.phase || "combat";
  const icon  = TURN_PHASE_ICONS[phase] || "⚔️";
  banner.className = `turn-banner turn-banner--${phase}`;
  banner.innerHTML = `
    <span class="turn-banner-round">${icon} Round ${turnData.round}</span>
    <span class="turn-banner-sep">·</span>
    <span class="turn-banner-phase">${phase.charAt(0).toUpperCase() + phase.slice(1)}</span>
  `;
}

function initLogs() {
  const q = query(collection(db, "sessionLog"), orderBy("timestamp", "desc"), limit(80));

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const id   = change.doc.id;
      const data = change.doc.data();

      if (change.type === "added" || change.type === "modified") {
        // Character log — events for this character only
        if (data.charId === charId || data.actor === currentData.name) {
          localEntries[id]?.remove();
          const lEl = buildLogEntry(id, data);
          localEntries[id] = lEl;
          const lEmpty = localLogFeed.querySelector(".log-empty");
          if (lEmpty) lEmpty.remove();
          localLogFeed.insertBefore(lEl, localLogFeed.firstChild);
        }

        // Location feed — store all, filter on render
        locationEntries[id] = { el: buildLogEntry(id, data), data };
      } else if (change.type === "removed") {
        localEntries[id]?.remove();
        delete localEntries[id];
        delete locationEntries[id];
      }
    });
    rerenderLocationFeed();
  });

  // Turn banner — watches all per-location turn docs
  onSnapshot(collection(db, "campaign"), snap => {
    snap.docChanges().forEach(change => {
      if (change.type === "removed") delete allCampaignTurns[change.doc.id];
      else allCampaignTurns[change.doc.id] = change.doc.data();
    });
    updateTurnBanner();
  }, () => updateTurnBanner());

  // Track all characters to know who shares this location
  onSnapshot(collection(db, "characters"), (snapshot) => {
    snapshot.docChanges().forEach(change => {
      const id = change.doc.id;
      if (change.type === "removed") delete allCharData[id];
      else allCharData[id] = change.doc.data();
    });
    rebuildLocationCharIds();
    rerenderLocationFeed();
  });
}

// ---- Main snapshot ----------------------------------------------------------

let firstLoad = true;

onSnapshot(charRef, (snap) => {
  if (!snap.exists()) { showError(); return; }
  const data = snap.data();
  currentData = data;

  if (firstLoad) {
    showLayout();
    firstLoad = false;
    initLogs();
  }

  renderIdentity(data);
  renderHP(data);
  renderConditions(data);
  renderActions(data);
  renderInventory(data);
  renderStats(data);
  renderNotes(data);
  renderTaken(data);
  renderLocation(data.locationId ?? null);
  rebuildLocationCharIds();
  rerenderLocationFeed();
  updateTurnBanner();
}, (err) => {
  showError();
  console.error("Sheet listener error:", err);
});
