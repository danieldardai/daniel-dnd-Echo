import { db } from "./firebase-config.js";
import {
  collection, onSnapshot, orderBy, query,
  doc, updateDoc, addDoc, deleteDoc, setDoc, serverTimestamp,
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

const EMOJI_CATEGORIES = [
  { label: "Weapons",    emojis: ["⚔️","🗡️","🏹","🔱","🪃","🛡️","⚒️","🔨","🪓","🪖","🗺️","🧨"] },
  { label: "Potions",    emojis: ["🧪","💊","🍵","🫗","🧴","🫙","🍶","🍷","🍺","🧬","💉"] },
  { label: "Food",       emojis: ["🍖","🍗","🥩","🧀","🍞","🥖","🫓","🍎","🍇","🥜","🫘","🍯"] },
  { label: "Magic",      emojis: ["✨","🔮","💎","💍","📿","🪄","🌟","⭐","🌙","☀️","⚡","🔥","❄️","🌊","🪬"] },
  { label: "Tools",      emojis: ["🪢","🔑","🗝️","📜","📖","🧭","🕯️","🔦","🪔","⛏️","🧲","🪝","🧰","⚙️","🔩"] },
  { label: "Containers", emojis: ["🎒","💼","🧳","📦","🏺","💰","🪙","🎁","🛍️","🫧"] },
  { label: "Nature",     emojis: ["🦴","🪶","🌿","🍄","🌺","🐍","🦅","🐺","🕷️","🦋","🌾","🍀"] },
  { label: "Misc",       emojis: ["🧿","🎲","🎭","🗿","🔔","🎵","⚗️","🧲","📡","🪆","🎪","🪬"] },
];

// ── Emoji Picker ───────────────────────────────────────────
let _pickerCallback = null;

const emojiPickerPopup = (() => {
  const wrap = document.createElement("div");
  wrap.id = "dmEmojiPicker";
  wrap.className = "emoji-picker-popup hidden";

  EMOJI_CATEGORIES.forEach(cat => {
    const label = document.createElement("div");
    label.className = "emoji-cat-label";
    label.textContent = cat.label;
    wrap.appendChild(label);

    const grid = document.createElement("div");
    grid.className = "emoji-grid";
    cat.emojis.forEach(e => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-opt";
      btn.textContent = e;
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        _pickerCallback?.(e);
        wrap.classList.add("hidden");
      });
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
  });

  document.body.appendChild(wrap);
  document.addEventListener("click", () => wrap.classList.add("hidden"));
  return wrap;
})();

function showEmojiPicker(anchorEl, onSelect) {
  _pickerCallback = onSelect;
  const rect = anchorEl.getBoundingClientRect();
  let left = rect.left;
  if (left + 264 > window.innerWidth) left = window.innerWidth - 268;
  emojiPickerPopup.style.top  = `${rect.bottom + 4}px`;
  emojiPickerPopup.style.left = `${left}px`;
  emojiPickerPopup.classList.toggle("hidden");
}

function initEmojiPickers(container) {
  container.querySelectorAll(".emoji-picker-trigger").forEach(trigger => {
    const hiddenInput = container.querySelector("#" + trigger.dataset.target);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-picker-btn";
    btn.textContent = trigger.dataset.default || "🎒";
    btn.addEventListener("click", ev => {
      ev.stopPropagation();
      showEmojiPicker(btn, emoji => {
        btn.textContent = emoji;
        if (hiddenInput) hiddenInput.value = emoji;
      });
    });
    trigger.replaceWith(btn);
  });
}

const PHASE_ICONS = {
  combat:      "⚔️",
  exploration: "🗺️",
  roleplay:    "💬",
  downtime:    "🏕️",
};

// ── State ─────────────────────────────────────────────────
let characters       = {};
let locations        = {};
let monsters         = {};          // id → monster/npc doc
let allTurnStates    = {};          // locationId → turnData
let selectedTurnLocId = "__global__";
let selectedCharId   = null;
let selectedEncType  = "monster";   // "monster" | "npc"
let dmUnlocked       = false;
let unsubCharacters  = null;
let unsubLocations   = null;
let unsubTurn        = null;
let unsubMonsters    = null;

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

// ── Claude AI helpers ────────────────────────────────────
function getClaudeApiKey() {
  return localStorage.getItem("ebClaudeApiKey") || "";
}
function setClaudeApiKey(key) {
  if (key) localStorage.setItem("ebClaudeApiKey", key.trim());
  else localStorage.removeItem("ebClaudeApiKey");
}

async function callClaude(text, phase) {
  const apiKey = getClaudeApiKey();
  if (!apiKey) throw new Error("No API key configured");
  const phaseContext = {
    combat:      "an intense combat encounter",
    exploration: "an exploration or discovery moment",
    roleplay:    "a roleplay or social interaction",
    downtime:    "a downtime or rest period",
  }[phase] || "a scene";
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
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `You are a narrative assistant for "Echoes Beneath," a dark fantasy tabletop RPG. The Dungeon Master wrote this description for ${phaseContext}:\n\n"${text}"\n\nThe input may be in English or Hungarian. Enhance it: fix typos, add atmospheric dark fantasy flair, improve clarity. Then provide both language versions.\n\nRespond in exactly this format (no extra commentary):\n🇬🇧 [enhanced English version, 1-3 sentences]\n🇭🇺 [enhanced Hungarian version, 1-3 sentences]`,
      }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `API error ${response.status}`);
  return data.content[0].text.trim();
}

function attachAiEnhance(strip, textareaId, phaseSelId, staticPhase) {
  const enhanceBtn = strip.querySelector("#dmBtnEnhance");
  const keyBtn     = strip.querySelector("#dmBtnConfigKey");
  const statusEl   = strip.querySelector("#dmAiStatus");
  const textarea   = strip.querySelector("#" + textareaId);
  if (!enhanceBtn || !textarea) return;

  let originalText = null;

  const setStatus = (msg, isError = false) => {
    statusEl.textContent = msg;
    statusEl.className = "dm-ai-status" + (isError ? " error" : "");
  };

  enhanceBtn.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text) { textarea.focus(); return; }

    let apiKey = getClaudeApiKey();
    if (!apiKey) {
      apiKey = prompt("Enter your Anthropic API key (stored locally in this browser only):");
      if (!apiKey) return;
      setClaudeApiKey(apiKey);
    }

    const phase = phaseSelId
      ? (strip.querySelector("#" + phaseSelId)?.value || "combat")
      : (staticPhase || "combat");
    enhanceBtn.disabled = true;
    strip.querySelector(".dm-ai-undo-btn")?.remove();
    setStatus("✨ Enhancing…");

    try {
      const enhanced = await callClaude(text, phase);
      originalText = text;
      textarea.value = enhanced;
      setStatus("");
      const undoBtn = document.createElement("button");
      undoBtn.className = "dm-btn-link dm-ai-undo-btn";
      undoBtn.textContent = "↩ Undo";
      undoBtn.addEventListener("click", () => {
        textarea.value = originalText;
        originalText = null;
        undoBtn.remove();
      });
      statusEl.after(undoBtn);
    } catch (err) {
      setStatus("⚠ " + err.message, true);
    } finally {
      enhanceBtn.disabled = false;
    }
  });

  keyBtn.addEventListener("click", () => {
    const current = getClaudeApiKey();
    const key = prompt("Anthropic API key (leave blank to clear):", current ? "sk-ant-…(hidden)" : "");
    if (key === null) return;
    setClaudeApiKey(key);
    setStatus(key ? "🔑 Key saved" : "🔑 Key cleared");
    setTimeout(() => setStatus(""), 2000);
  });
}

// ── Turn strip ────────────────────────────────────────────

function buildLocOptions(selected) {
  const sorted = Object.values(locations).sort((a, b) => (a.order || 0) - (b.order || 0));
  return `
    <option value="__global__" ${selected === "__global__" ? "selected" : ""}>🌐 All Locations</option>
    ${sorted.map(loc => `
      <option value="${loc.id}" ${selected === loc.id ? "selected" : ""}>
        ${loc.emoji || "🗺️"} ${loc.name}
      </option>
    `).join("")}
  `;
}

function locationLabel(locId) {
  if (locId === "__global__") return "All Locations";
  return locations[locId] ? `${locations[locId].emoji || "🗺️"} ${locations[locId].name}` : locId;
}

function renderTurnStrip() {
  const strip = document.getElementById("dmTurnStrip");
  if (!strip) return;

  const currentTurn = allTurnStates[selectedTurnLocId] ?? null;
  const turnDocId   = selectedTurnLocId;

  // Location selector row — always visible
  const locRowHTML = `
    <div class="dm-turn-loc-row">
      <label class="dm-turn-loc-label">Location</label>
      <select class="dm-input dm-turn-loc-sel" id="dmTurnLocSel">
        ${buildLocOptions(selectedTurnLocId)}
      </select>
    </div>
  `;

  if (!currentTurn?.active) {
    strip.innerHTML = `
      ${locRowHTML}
      <div class="dm-turn-row dm-turn-idle">
        <span class="dm-turn-idle-label">No active turn for ${locationLabel(selectedTurnLocId)}</span>
        <button class="dm-btn dm-btn-damage dm-btn-sm" id="dmBtnNewTurn">▶ New Turn</button>
      </div>
      <div class="dm-turn-form hidden" id="dmTurnForm">
        <div class="dm-turn-form-inner">
          <select class="dm-input dm-turn-phase-sel" id="dmTurnPhase">
            <option value="combat">⚔️ Combat</option>
            <option value="exploration">🗺️ Exploration</option>
            <option value="roleplay">💬 Roleplay</option>
            <option value="downtime">🏕️ Downtime</option>
          </select>
          <textarea class="dm-turn-textarea" id="dmTurnDesc" rows="2"
            placeholder="Describe what is happening this turn…"></textarea>
        </div>
        <div class="dm-ai-row">
          <button class="dm-btn dm-btn-neutral dm-btn-sm" id="dmBtnEnhance">✨ Enhance</button>
          <span class="dm-ai-status" id="dmAiStatus"></span>
          <button class="dm-btn-link dm-ai-key-btn" id="dmBtnConfigKey" title="Configure AI API key">🔑</button>
        </div>
        <div class="dm-turn-form-btns">
          <button class="dm-btn dm-btn-heal" id="dmBtnBeginTurn">▶ Begin</button>
          <button class="dm-btn dm-btn-neutral dm-btn-sm" id="dmBtnCancelTurn">Cancel</button>
        </div>
      </div>
    `;

    strip.querySelector("#dmTurnLocSel").addEventListener("change", e => {
      selectedTurnLocId = e.target.value;
      renderTurnStrip();
    });
    strip.querySelector("#dmBtnNewTurn").addEventListener("click", () => {
      strip.querySelector("#dmTurnForm").classList.remove("hidden");
      strip.querySelector("#dmBtnNewTurn").classList.add("hidden");
      strip.querySelector("#dmTurnDesc").focus();
    });
    strip.querySelector("#dmBtnCancelTurn").addEventListener("click", () => {
      strip.querySelector("#dmTurnForm").classList.add("hidden");
      strip.querySelector("#dmBtnNewTurn").classList.remove("hidden");
    });
    attachAiEnhance(strip, "dmTurnDesc", "dmTurnPhase");

    strip.querySelector("#dmBtnBeginTurn").addEventListener("click", async () => {
      const desc  = strip.querySelector("#dmTurnDesc").value.trim();
      if (!desc) { strip.querySelector("#dmTurnDesc").focus(); return; }
      const phase   = strip.querySelector("#dmTurnPhase").value;
      const locName = locationLabel(turnDocId);
      await setDoc(doc(db, "campaign", turnDocId), {
        active: true, round: 1, phase, description: desc,
        locationId: turnDocId, startedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "sessionLog"), {
        type: "turn", actor: "DM",
        message: `${PHASE_ICONS[phase]} [${locName}] Round 1 begins — ${desc}`,
        timestamp: serverTimestamp(), charId: null,
        locationId: turnDocId !== "__global__" ? turnDocId : null,
      });
    });

  } else {
    const { round = 1, phase = "combat", description = "" } = currentTurn;
    const icon    = PHASE_ICONS[phase] || "⚔️";
    const locName = locationLabel(turnDocId);
    strip.innerHTML = `
      ${locRowHTML}
      <div class="dm-turn-row dm-turn-active-header">
        <span class="dm-turn-badge dm-turn-badge--${phase}">${icon} Round ${round}</span>
        <span class="dm-turn-phase-tag">${phase.toUpperCase()}</span>
        <div class="dm-turn-header-btns">
          <button class="dm-btn dm-btn-damage dm-btn-sm" id="dmBtnNextRound">▶ Next Round</button>
          <button class="dm-btn dm-btn-neutral dm-btn-sm" id="dmBtnEndTurn">✕ End</button>
        </div>
      </div>
      <div class="dm-turn-desc-bar" id="dmTurnDescBar">
        <span class="dm-turn-desc-text">${description}</span>
        <button class="dm-btn-link" id="dmBtnEditDesc">edit</button>
      </div>
      <div class="dm-turn-form hidden" id="dmNextForm">
        <div class="dm-turn-form-inner">
          <textarea class="dm-turn-textarea" id="dmNextDesc" rows="2"
            placeholder="Describe Round ${round + 1}… (leave blank to keep current)"></textarea>
        </div>
        <div class="dm-ai-row">
          <button class="dm-btn dm-btn-neutral dm-btn-sm" id="dmBtnEnhance">✨ Enhance</button>
          <span class="dm-ai-status" id="dmAiStatus"></span>
          <button class="dm-btn-link dm-ai-key-btn" id="dmBtnConfigKey" title="Configure AI API key">🔑</button>
        </div>
        <div class="dm-turn-form-btns">
          <button class="dm-btn dm-btn-heal" id="dmBtnConfirmNext">▶ Round ${round + 1}</button>
          <button class="dm-btn dm-btn-neutral dm-btn-sm" id="dmBtnCancelNext">Cancel</button>
        </div>
      </div>
    `;

    strip.querySelector("#dmTurnLocSel").addEventListener("change", e => {
      selectedTurnLocId = e.target.value;
      renderTurnStrip();
    });
    attachAiEnhance(strip, "dmNextDesc", null, phase);

    strip.querySelector("#dmBtnNextRound").addEventListener("click", () => {
      strip.querySelector("#dmNextForm").classList.remove("hidden");
      strip.querySelector("#dmBtnNextRound").classList.add("hidden");
      strip.querySelector("#dmNextDesc").focus();
    });
    strip.querySelector("#dmBtnCancelNext").addEventListener("click", () => {
      strip.querySelector("#dmNextForm").classList.add("hidden");
      strip.querySelector("#dmBtnNextRound").classList.remove("hidden");
    });
    strip.querySelector("#dmBtnConfirmNext").addEventListener("click", async () => {
      const newDesc  = strip.querySelector("#dmNextDesc").value.trim() || description;
      const newRound = round + 1;
      await setDoc(doc(db, "campaign", turnDocId), {
        active: true, round: newRound, phase, description: newDesc,
        locationId: turnDocId, startedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "sessionLog"), {
        type: "turn", actor: "DM",
        message: `${icon} [${locName}] Round ${newRound} — ${newDesc}`,
        timestamp: serverTimestamp(), charId: null,
        locationId: turnDocId !== "__global__" ? turnDocId : null,
      });
    });
    strip.querySelector("#dmBtnEditDesc").addEventListener("click", () => {
      const bar = strip.querySelector("#dmTurnDescBar");
      bar.innerHTML = `
        <input type="text" class="dm-input" id="dmDescEdit" style="flex:1" />
        <button class="dm-btn dm-btn-heal dm-btn-sm" id="dmBtnSaveDesc">Save</button>
      `;
      const inp = bar.querySelector("#dmDescEdit");
      inp.value = description;
      inp.focus();
      const save = async () => {
        const newDesc = inp.value.trim() || description;
        await setDoc(doc(db, "campaign", turnDocId), {
          active: true, round, phase, description: newDesc,
          locationId: turnDocId, startedAt: currentTurn.startedAt || serverTimestamp(),
        });
      };
      bar.querySelector("#dmBtnSaveDesc").addEventListener("click", save);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
    });
    strip.querySelector("#dmBtnEndTurn").addEventListener("click", async () => {
      if (!confirm(`End turn for ${locName} after Round ${round}?`)) return;
      await setDoc(doc(db, "campaign", turnDocId), {
        active: false, round: 0, phase: "exploration", description: "",
        locationId: turnDocId, endedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "sessionLog"), {
        type: "turn", actor: "DM",
        message: `✕ [${locName}] Turn ended after Round ${round}`,
        timestamp: serverTimestamp(), charId: null,
        locationId: turnDocId !== "__global__" ? turnDocId : null,
      });
    });
  }
}

// ── Firestore listener ────────────────────────────────────
function startListening() {
  if (unsubCharacters) return;

  const q = query(collection(db, "characters"), orderBy("name"));
  unsubCharacters = onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      const id = change.doc.id;
      if (change.type === "removed") delete characters[id];
      else characters[id] = { id, ...change.doc.data() };
    });
    renderCharList();
    const tab = activeTab();
    if (tab === "locations") renderLocationsTab();
    else if (selectedCharId) renderActiveTab();
  });

  const lq = query(collection(db, "locations"), orderBy("order"));
  unsubLocations = onSnapshot(lq, snap => {
    snap.docChanges().forEach(change => {
      const id = change.doc.id;
      if (change.type === "removed") delete locations[id];
      else locations[id] = { id, ...change.doc.data() };
    });
    if (activeTab() === "locations") renderLocationsTab();
  });

  // Turn listener — watches all per-location turn documents
  if (!unsubTurn) {
    unsubTurn = onSnapshot(collection(db, "campaign"), snap => {
      snap.docChanges().forEach(change => {
        if (change.type === "removed") delete allTurnStates[change.doc.id];
        else allTurnStates[change.doc.id] = change.doc.data();
      });
      renderTurnStrip();
    }, () => renderTurnStrip());
  }

  // Monsters / NPCs listener
  if (!unsubMonsters) {
    unsubMonsters = onSnapshot(
      query(collection(db, "monsters"), orderBy("createdAt")),
      snap => {
        snap.docChanges().forEach(change => {
          const id = change.doc.id;
          if (change.type === "removed") delete monsters[id];
          else monsters[id] = { id, ...change.doc.data() };
        });
        renderEncounterSidebar();
      },
      () => renderEncounterSidebar()
    );
  }
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
  const tab  = activeTab();
  if (tab === "locations") { renderLocationsTab(); return; }

  const char = selectedCharId ? characters[selectedCharId] : null;
  if (!char) {
    ["combat", "inventory", "stats", "log"].forEach(t => {
      const el = document.getElementById("dm-tab-" + t);
      if (el) el.innerHTML = `<div class="dm-no-char">Select a character from the list.</div>`;
    });
    return;
  }
  switch (tab) {
    case "combat":    renderCombatTab(char);    break;
    case "inventory": renderInventoryTab(char); break;
    case "stats":     renderStatsTab(char);     break;
    case "spells":    renderSpellsTab(char);    break;
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
            <span class="emoji-picker-trigger" data-target="dmCEmoji" data-default="🎒"></span>
            <input type="hidden" id="dmCEmoji" value="🎒" />
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
            <span class="emoji-picker-trigger" data-target="dmEEmoji" data-default="⚔️"></span>
            <input type="hidden" id="dmEEmoji" value="⚔️" />
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

  initEmojiPickers(el);

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

// ── SPELLS TAB ───────────────────────────────────────────
function renderSpellsTab(char) {
  const el     = document.getElementById("dm-tab-spells");
  const spells = char.spells     || [];
  const slots  = char.spellSlots || {};
  const sortedSlots = Object.entries(slots).sort(([a], [b]) => a.localeCompare(b));

  el.innerHTML = `
    <div class="dm-section">
      <h3 class="dm-section-title">Spell Slots</h3>
      ${sortedSlots.length
        ? `<div class="dm-spell-slots-grid" id="dmSpellSlotsGrid"></div>`
        : `<p class="dm-empty">No spell slots.</p>`}
    </div>
    <div class="dm-section">
      <h3 class="dm-section-title">
        Spells
        <span class="dm-spells-hint">Type a dice formula in the 🎲 column to link a roll</span>
      </h3>
      ${spells.length
        ? `<div class="dm-spell-list" id="dmSpellList"></div>`
        : `<p class="dm-empty">No spells configured for this character.</p>`}
    </div>
  `;

  // ── Slot tracker ──────────────────────────────────────
  if (sortedSlots.length) {
    const grid = el.querySelector("#dmSpellSlotsGrid");
    sortedSlots.forEach(([level, info]) => {
      const used  = info.used  ?? 0;
      const total = info.total ?? 0;
      const row   = document.createElement("div");
      row.className = "dm-spell-slot-row";
      const pips = Array.from({ length: total }, (_, i) =>
        `<span class="dm-slot-pip${i < used ? " used" : ""}"></span>`
      ).join("");
      row.innerHTML = `
        <span class="dm-spell-slot-label">${level}</span>
        <div class="dm-slot-pips">${pips}</div>
        <span class="dm-spell-slot-count">${used}/${total}</span>
        <button class="dm-btn dm-btn-neutral dm-btn-sm" data-level="${level}" data-action="reset">Reset</button>
        <button class="dm-stat-btn" data-level="${level}" data-action="minus" ${used <= 0 ? "disabled" : ""}>−</button>
        <button class="dm-stat-btn" data-level="${level}" data-action="plus"  ${used >= total ? "disabled" : ""}>+</button>
      `;
      grid.appendChild(row);
    });

    grid.addEventListener("click", async e => {
      const { level, action } = e.target.dataset;
      if (!level || !action) return;
      const c   = characters[selectedCharId];
      const cur = c.spellSlots?.[level] ?? { total: 0, used: 0 };
      let newUsed = cur.used ?? 0;
      if      (action === "reset") newUsed = 0;
      else if (action === "minus") newUsed = Math.max(0, newUsed - 1);
      else if (action === "plus")  newUsed = Math.min(cur.total ?? 0, newUsed + 1);
      else return;
      await updateDoc(charRef(), { [`spellSlots.${level}.used`]: newUsed });
    });
  }

  // ── Spell list ────────────────────────────────────────
  if (spells.length) {
    const list = el.querySelector("#dmSpellList");

    // Header row
    const hdr = document.createElement("div");
    hdr.className = "dm-spell-row dm-spell-row--header";
    hdr.innerHTML = `
      <span></span>
      <span>Name</span>
      <span>Level · Type</span>
      <span>Casting</span>
      <span>🎲 Dice</span>
    `;
    list.appendChild(hdr);

    spells.forEach((spell, idx) => {
      const row = document.createElement("div");
      row.className = "dm-spell-row";
      const levelLabel = spell.level === 0 ? "Cantrip" : `Lvl ${spell.level}`;
      const catLabel   = spell.category || "general";
      const catIcon    = catLabel === "attack" ? "⚔️" : catLabel === "defense" ? "🛡️" : "✨";
      row.innerHTML = `
        <span class="dm-spell-cat-icon" title="${catLabel}">${catIcon}</span>
        <span class="dm-spell-name">${spell.name}</span>
        <span class="dm-spell-meta">${levelLabel} · ${catLabel}</span>
        <span class="dm-spell-cast">${spell.castingTime || "—"}</span>
        <input class="dm-input dm-spell-dice-input" type="text"
          value="${spell.damage || ""}"
          placeholder="e.g. 2d10"
          data-idx="${idx}" />
      `;
      list.appendChild(row);
    });

    list.querySelectorAll(".dm-spell-dice-input").forEach(input => {
      const save = async () => {
        const idx      = parseInt(input.dataset.idx);
        const c        = characters[selectedCharId];
        const newSpells = (c.spells || []).map((s, i) => {
          if (i !== idx) return s;
          const updated = { ...s };
          if (input.value.trim()) updated.damage = input.value.trim();
          else delete updated.damage;
          return updated;
        });
        await updateDoc(charRef(), { spells: newSpells });
      };
      input.addEventListener("blur",    save);
      input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });
    });
  }
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

// ── LOCATIONS TAB ─────────────────────────────────────────
function renderLocationsTab() {
  const el = document.getElementById("dm-tab-locations");
  const sortedLocs = Object.values(locations).sort((a, b) => (a.order || 0) - (b.order || 0));
  const charList   = Object.values(characters).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  el.innerHTML = `
    <div class="dm-loc-toolbar">
      <button class="dm-btn dm-btn-neutral dm-btn-sm" id="dmBtnNewLoc">+ New Location</button>
    </div>
    <div class="dm-loc-create hidden" id="dmLocCreate">
      <div class="dm-form-fields">
        <input class="dm-input" id="dmLocEmoji" placeholder="🗺️" maxlength="4" style="width:54px;flex:none" />
        <input class="dm-input" id="dmLocName" placeholder="Location name" style="flex:1;min-width:120px" />
        <input class="dm-input" id="dmLocDesc" placeholder="Description (optional)" style="flex:2;min-width:160px" />
        <button class="dm-btn dm-btn-heal" id="dmLocSave">Create</button>
        <button class="dm-btn dm-btn-neutral" id="dmLocCancel">✕</button>
      </div>
    </div>
    <div class="dm-loc-board" id="dmLocBoard"></div>
  `;

  const createDiv = el.querySelector("#dmLocCreate");

  el.querySelector("#dmBtnNewLoc").addEventListener("click", () => {
    createDiv.classList.toggle("hidden");
    if (!createDiv.classList.contains("hidden")) el.querySelector("#dmLocName").focus();
  });
  el.querySelector("#dmLocCancel").addEventListener("click", () => createDiv.classList.add("hidden"));
  el.querySelector("#dmLocSave").addEventListener("click", async () => {
    const name = el.querySelector("#dmLocName").value.trim();
    if (!name) return;
    const maxOrder = Object.values(locations).reduce((m, l) => Math.max(m, l.order || 0), 0);
    await addDoc(collection(db, "locations"), {
      name,
      emoji:       el.querySelector("#dmLocEmoji").value.trim() || "🗺️",
      description: el.querySelector("#dmLocDesc").value.trim() || "",
      order:       maxOrder + 1,
      createdAt:   serverTimestamp(),
    });
    el.querySelector("#dmLocName").value  = "";
    el.querySelector("#dmLocEmoji").value = "";
    el.querySelector("#dmLocDesc").value  = "";
    createDiv.classList.add("hidden");
    dmLog("system", "DM", `created location "${name}"`);
  });

  const board = el.querySelector("#dmLocBoard");
  const unassigned = charList.filter(c => !c.locationId || !locations[c.locationId]);
  board.appendChild(makeLocColumn("__unassigned__", "🌐", "Unassigned", null, unassigned));
  sortedLocs.forEach(loc => {
    const inLoc = charList.filter(c => c.locationId === loc.id);
    board.appendChild(makeLocColumn(loc.id, loc.emoji || "🗺️", loc.name, loc, inLoc));
  });
}

function makeLocColumn(locId, emoji, name, locData, chars) {
  const isUnassigned = locId === "__unassigned__";
  const col = document.createElement("div");
  col.className = "dm-loc-col";

  const header = document.createElement("div");
  header.className = "dm-loc-col-header";

  const emojiEl = document.createElement("span");
  emojiEl.className = "dm-loc-emoji";
  emojiEl.textContent = emoji;

  const nameEl = document.createElement("span");
  nameEl.className = "dm-loc-name";
  nameEl.textContent = name;

  header.appendChild(emojiEl);
  header.appendChild(nameEl);

  if (locData?.description) {
    const descEl = document.createElement("span");
    descEl.className = "dm-loc-desc";
    descEl.textContent = locData.description;
    header.appendChild(descEl);
  }

  if (!isUnassigned) {
    const delBtn = document.createElement("button");
    delBtn.className = "dm-btn-del dm-loc-del";
    delBtn.title = "Delete location";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete "${name}"? Characters here will become unassigned.`)) return;
      const here = Object.values(characters).filter(c => c.locationId === locId);
      await Promise.all(here.map(c => updateDoc(doc(db, "characters", c.id), { locationId: null })));
      await deleteDoc(doc(db, "locations", locId));
    });
    header.appendChild(delBtn);
  }

  const dropZone = document.createElement("div");
  dropZone.className = "dm-loc-drop-zone";
  dropZone.dataset.locId = locId;

  if (!chars.length) {
    const hint = document.createElement("div");
    hint.className = "dm-loc-empty-hint";
    hint.textContent = "Drop characters here";
    dropZone.appendChild(hint);
  } else {
    chars.forEach(char => dropZone.appendChild(makeCharChip(char)));
  }

  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", e => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", async e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const charId = e.dataTransfer.getData("charId");
    if (!charId) return;
    const newLocId = isUnassigned ? null : locId;
    await updateDoc(doc(db, "characters", charId), { locationId: newLocId });
    const char = characters[charId];
    if (char) {
      const label = isUnassigned ? "Unassigned" : (locations[locId]?.name || locId);
      dmLog("system", "DM", `moved ${char.name} to ${label}`);
    }
  });

  col.appendChild(header);
  col.appendChild(dropZone);
  return col;
}

// ── ENCOUNTER SIDEBAR (Monsters / NPCs) ──────────────────

function renderEncounterSidebar() {
  const el = document.getElementById("dmEncounterSidebar");
  if (!el) return;

  // Build shell once
  if (!el.querySelector(".dm-enc-list")) {
    el.innerHTML = `
      <div class="dm-enc-header">
        <button class="dm-enc-filter-btn active" data-type="monster">⚔️ Monsters</button>
        <button class="dm-enc-filter-btn" data-type="npc">💬 NPCs</button>
      </div>
      <div class="dm-enc-add">
        <input class="dm-input dm-enc-name-input" id="dmEncName" placeholder="Name" />
        <div class="dm-enc-hp-row">
          <input class="dm-input" type="number" id="dmEncHp"    placeholder="HP"  min="1" />
          <span class="dm-enc-hp-sep">/</span>
          <input class="dm-input" type="number" id="dmEncHpMax" placeholder="Max" min="1" />
          <button class="dm-btn dm-btn-heal dm-btn-sm" id="dmEncAddBtn">+</button>
        </div>
      </div>
      <div class="dm-enc-list" id="dmEncList"></div>
    `;

    el.querySelectorAll(".dm-enc-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedEncType = btn.dataset.type;
        el.querySelectorAll(".dm-enc-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderEncounterList();
      });
    });

    el.querySelector("#dmEncAddBtn").addEventListener("click", () => addEncounter(el));
    el.querySelector("#dmEncName").addEventListener("keydown", e => {
      if (e.key === "Enter") addEncounter(el);
    });
  }

  renderEncounterList();
}

async function addEncounter(el) {
  const name   = el.querySelector("#dmEncName").value.trim();
  if (!name) { el.querySelector("#dmEncName").focus(); return; }
  const hp    = parseInt(el.querySelector("#dmEncHp").value)    || 10;
  const hpMax = parseInt(el.querySelector("#dmEncHpMax").value) || hp;
  await addDoc(collection(db, "monsters"), {
    name, hp, hpMax, type: selectedEncType,
    createdAt: serverTimestamp(),
  });
  el.querySelector("#dmEncName").value   = "";
  el.querySelector("#dmEncHp").value     = "";
  el.querySelector("#dmEncHpMax").value  = "";
  el.querySelector("#dmEncName").focus();
}

function renderEncounterList() {
  const listEl = document.getElementById("dmEncList");
  if (!listEl) return;
  listEl.innerHTML = "";

  const filtered = Object.values(monsters)
    .filter(m => m.type === selectedEncType)
    .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));

  if (!filtered.length) {
    const label = selectedEncType === "monster" ? "monsters" : "NPCs";
    listEl.innerHTML = `<div class="dm-empty">No ${label} yet.</div>`;
    return;
  }

  filtered.forEach(m => {
    const pct      = m.hpMax ? Math.min(100, Math.max(0, Math.round((m.hp / m.hpMax) * 100))) : 100;
    const barColor = pct > 60 ? "#2ecc71" : pct > 30 ? "#c8a840" : "#c0392b";
    const hpClass  = pct <= 30 ? "low" : pct <= 60 ? "mid" : "";

    const card = document.createElement("div");
    card.className = "dm-enc-card";
    card.innerHTML = `
      <div class="dm-enc-card-top">
        <span class="dm-enc-name">${m.name}</span>
        <button class="dm-btn-del dm-enc-del" title="Remove">✕</button>
      </div>
      <div class="dm-enc-bar-track">
        <div class="dm-enc-bar-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="dm-enc-hp-label dm-char-hp ${hpClass}">${m.hp} / ${m.hpMax} HP</div>
      <div class="dm-enc-actions">
        <input type="number" class="dm-input dm-enc-amt" placeholder="Amt" min="1" />
        <button class="dm-btn dm-btn-damage dm-btn-sm dm-enc-dmg">Dmg</button>
        <button class="dm-btn dm-btn-heal   dm-btn-sm dm-enc-heal">Heal</button>
      </div>
    `;

    const mRef     = doc(db, "monsters", m.id);
    const amtInput = card.querySelector(".dm-enc-amt");

    card.querySelector(".dm-enc-dmg").addEventListener("click", async () => {
      const amt = parseInt(amtInput.value) || 0;
      if (!amt) return;
      const cur   = monsters[m.id]?.hp ?? 0;
      const newHp = Math.max(0, cur - amt);
      await updateDoc(mRef, { hp: newHp });
      await addDoc(collection(db, "sessionLog"), {
        type: "damage", actor: "DM",
        message: `${m.name} took ${amt} damage (${newHp}/${m.hpMax} HP)`,
        timestamp: serverTimestamp(), charId: null,
      });
      amtInput.value = "";
    });

    card.querySelector(".dm-enc-heal").addEventListener("click", async () => {
      const amt = parseInt(amtInput.value) || 0;
      if (!amt) return;
      const cur   = monsters[m.id]?.hp ?? 0;
      const newHp = Math.min(m.hpMax, cur + amt);
      await updateDoc(mRef, { hp: newHp });
      amtInput.value = "";
    });

    card.querySelector(".dm-enc-del").addEventListener("click", async () => {
      if (!confirm(`Remove "${m.name}"?`)) return;
      await deleteDoc(doc(db, "monsters", m.id));
    });

    listEl.appendChild(card);
  });
}

function makeCharChip(char) {
  const chip = document.createElement("div");
  chip.className = "dm-loc-char-chip";
  chip.draggable = true;
  chip.dataset.charId = char.id;

  const pct     = char.hpMax ? Math.round(((char.hp ?? 0) / char.hpMax) * 100) : 100;
  const hpClass = pct <= 30 ? "low" : pct <= 60 ? "mid" : "";

  const nameEl = document.createElement("span");
  nameEl.className = "dm-char-name";
  nameEl.textContent = char.name;

  const hpEl = document.createElement("span");
  hpEl.className = `dm-char-hp ${hpClass}`;
  hpEl.textContent = `${char.hp ?? "?"}/${char.hpMax ?? "?"}`;

  chip.appendChild(nameEl);
  chip.appendChild(hpEl);

  chip.addEventListener("dragstart", e => {
    e.dataTransfer.setData("charId", char.id);
    e.dataTransfer.effectAllowed = "move";
    chip.classList.add("dragging");
  });
  chip.addEventListener("dragend", () => chip.classList.remove("dragging"));

  return chip;
}
