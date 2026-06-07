import { db } from "./firebase-config.js";
import {
  collection, onSnapshot, orderBy, query, limit,
  doc, getDoc, updateDoc, addDoc, deleteDoc, setDoc, serverTimestamp, deleteField, getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { registerPush } from "./push-utils.js";

const DM_PASSWORD = "1234";

const ALL_STATS = [
  "Might", "Agility", "Endurance",
  "Knowledge", "Perception", "Ingenuity",
  "Presence", "Will", "Empathy",
];

const CONDITIONS = [
  "Poisoned", "Blinded", "Stunned", "Prone", "Frightened",
  "Charmed", "Paralyzed", "Exhausted", "Burning", "Bleeding",
];

const ABILITY_DB = {
  // ── NASHT (Body) ──────────────────────────────────────────
  "Sure Step":               { tier: 1, bloodline: "Nasht",  description: "You never lose your footing on uneven ground for a scene. Climb a cliff face, run across rooftops, dance across stepping stones in a flood — your body knows where to be." },
  "Quick Hands":             { tier: 1, bloodline: "Nasht",  description: "React first in a sudden moment. Catch a falling object, draw a blade before an attacker can finish their swing, snatch the dagger from someone's belt. You move before others can think." },
  "Long Wind":               { tier: 1, bloodline: "Nasht",  description: "Run, climb, or swim past where you should have stopped. Useful for chases, escapes, long pursuits. Your body simply does not tire when you call this." },
  "Press On":                { tier: 2, bloodline: "Nasht",  description: "Ignore one wound's penalty for a scene. The injury is real and bleeding, but it does not slow you. The cost comes later — the wound is worse when the scene ends." },
  "Hunter's Sense":          { tier: 2, bloodline: "Nasht",  description: "Find a trail, scent, or path that others have lost. Read tracks, smell what passed through a room hours ago, sense which way the prey ran. The world tells you where things have been." },
  "Strike True":             { tier: 2, bloodline: "Nasht",  description: "Your next blow lands cleanly. No roll needed — it hits exactly where you intended, with full force. Save this for the moment that matters." },
  "Beast's Speed":           { tier: 3, bloodline: "Nasht",  description: "For one scene, move twice as fast as anyone watching. You blur. You arrive at the other side of the room before the door has finished closing. You become hard to hit and harder to track." },
  "Iron Skin":               { tier: 3, bloodline: "Nasht",  description: "A blow that would have killed you only wounds. Activated reactively — when struck by a fatal hit, you survive it, badly hurt but alive." },
  "Killing Rhythm":          { tier: 3, bloodline: "Nasht",  description: "Once you draw first blood in a scene your body finds its groove — each strike flows from the last, faster and surer. The rhythm holds until you stop moving or take a hit." },
  "Wear the Hunt":           { tier: 4, bloodline: "Nasht",  description: "For one scene, you become more than human. Leap rooftop to rooftop, shrug off spear-thrusts, run down a horse at full gallop, strike with the weight of a falling tree. When the scene ends you collapse — no further Shaper abilities that day." },
  // ── AREMU (Mind) ──────────────────────────────────────────
  "True Recall":             { tier: 1, bloodline: "Aremu",  description: "Remember a detail you saw but didn't consciously notice. The pattern on the assassin's blade. The name on the parchment glimpsed in passing. The exact words a stranger said three days ago. Your mind held it; now it gives it back." },
  "Steady Heart":            { tier: 1, bloodline: "Aremu",  description: "Resist one moment of fear, charm, or panic. The fear is still real — you simply choose, for this moment, that it does not move you." },
  "Read the Fight":          { tier: 1, bloodline: "Aremu",  description: "Study one opponent for a breath. You understand them — how they move, where they flinch, what they guard. The DM tells you one truth about how they fight." },
  "Predict the Strike":      { tier: 2, bloodline: "Aremu",  description: "Before an opponent acts, declare what you think they will do. If you read them right the response comes without effort — dodge, block, or counter lands cleanly." },
  "Hold the Name":           { tier: 2, bloodline: "Aremu",  description: "Hear someone speak their true name. You now hold it. While you hold it, you have an edge against them — in social conflict, resisting their magic, finding them across distance. They feel you holding it but cannot remove it." },
  "Cold Calculation":        { tier: 2, bloodline: "Aremu",  description: "Take a moment of stillness in the middle of chaos. Everything becomes clear — positions, intentions, what happens next if nobody changes course. Act on it." },
  "Overload":                { tier: 3, bloodline: "Aremu",  description: "Flood a target's mind with the weight of every choice that led them here. For a moment they can only experience it — they cannot act." },
  "Unravel":                 { tier: 3, bloodline: "Aremu",  description: "Find the thread of something in a target's mind and pull. For this scene they lose access to it — a fighting style, a language, a trained skill. They feel it go." },
  "Bind the Mind":           { tier: 3, bloodline: "Aremu",  description: "For a few sentences, the person you are speaking to cannot lie to you. They may refuse, deflect, or speak in riddles — but no false statement can pass their lips. They know you are doing this and resent it." },
  "The Perfect Move":        { tier: 4, bloodline: "Aremu",  description: "One breath of absolute clarity. You see every person in the scene, every intention, every likely outcome. The single action that changes everything becomes obvious. Take it." },
  // ── ANUBET (Spirit) ───────────────────────────────────────
  "Numb":                    { tier: 1, bloodline: "Anubet", description: "Touch yourself or another. Dull the pain of one wound — it still bleeds but it does not slow you down for this scene." },
  "Hush":                    { tier: 1, bloodline: "Anubet", description: "Make a small sound never have been heard. The footstep on the gravel. The breath you just exhaled. The creaking shutter. The sound is unmade — anyone who could have heard it now did not." },
  "Quiet Wound":             { tier: 1, bloodline: "Anubet", description: "Close a small cut. Soothe a small pain. A scrape, a shallow knife-wound, a burn the size of a coin. The wound knits in moments. Larger wounds need higher-tier abilities or simple medicine." },
  "Still the Heart":         { tier: 2, bloodline: "Anubet", description: "Slow your own pulse to nothing for up to a minute. You appear dead — cold to the touch, not breathing. Useful for hiding from things that hunt the living, or escaping pursuers who will check the body." },
  "Walk Unseen":             { tier: 2, bloodline: "Anubet", description: "For one scene, eyes slide off you if you don't draw attention. You can stand in a crowded room and be unnoticed. You can pass a guard who is looking right at you. Speaking, fighting, or doing anything sudden breaks the effect." },
  "Speak with the Just-Dead":{ tier: 2, bloodline: "Anubet", description: "Ask one question of a person who died less than a day ago. They will answer truthfully — but as they were in life, with all their biases. They may not know what killed them. They may not know they are dead." },
  "Unmake a Moment":         { tier: 3, bloodline: "Anubet", description: "Undo one small thing you just did. Five seconds of time, witnesses included. The dropped cup is back in your hand. The sentence never spoken. The arrow returned to your quiver. Only those touched by the strange feel a faint chill." },
  "Touch of Sleep":          { tier: 3, bloodline: "Anubet", description: "A creature you touch falls into deep sleep for an hour. They cannot be woken by normal means. Useful in combat, infiltration, mercy, or interrogation. Larger creatures may resist." },
  "Drain Presence":          { tier: 3, bloodline: "Anubet", description: "Reach into a target's spirit and pull out their will to be noticed. For a scene, anything that hunts by sense — the strange, predators, searching minds — simply passes over them." },
  "The Door That Closes":    { tier: 4, bloodline: "Anubet", description: "Choose: Kill one living thing within sight with a word — their heart simply stops, no resistance. Or Keep one dying thing alive for a day, wounds stable, to be healed or make peace. After either, no further Shaper abilities that day." },
};

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
let characters        = {};
let locations         = {};
let monsters          = {};          // id → monster/npc doc
let byParent          = {};          // parentId → [instance docs]
let scenes            = {};          // locId → { current, next }
let allTurnStates     = {};          // locationId → turnData
let selectedTurnLocId  = "__global__";
let selectedCharId    = null;
let selectedEncType   = "monster";   // "monster" | "npc"
let selectedSceneLocId = null;
let movingToken        = null;   // { locId, sceneKey, token } — token selected for click-to-move
let pinnedMonsterId    = null;   // monsterId pinned to top of encounter list
let spectatorLocId     = null;   // locationId shown on spectator screen
let dmLogEntries       = {};     // entryId → { el, data } for scenes-tab log
// ── Tooltip (escapes scroll containers via fixed positioning) ──
(function initTooltip() {
  const tip = document.createElement("div");
  tip.id = "dm-ability-tooltip";
  tip.style.cssText = "position:fixed;z-index:9999;display:none;max-width:290px;padding:0.5rem 0.7rem;background:#1a1008;border:1px solid #5a3a1a;color:#d4c4a0;font-family:Georgia,serif;font-size:0.78rem;line-height:1.5;border-radius:4px;box-shadow:0 4px 16px rgba(0,0,0,0.75);pointer-events:none;white-space:normal";
  document.body.appendChild(tip);

  document.addEventListener("mouseover", e => {
    const el = e.target.closest("[data-tooltip]");
    if (!el) { tip.style.display = "none"; return; }
    tip.textContent = el.dataset.tooltip;
    tip.style.display = "block";
  });
  document.addEventListener("mousemove", e => {
    if (tip.style.display === "none") return;
    const x = e.clientX + 14, y = e.clientY + 14;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = (x + tw > window.innerWidth  ? x - tw - 28 : x) + "px";
    tip.style.top  = (y + th > window.innerHeight ? y - th - 28 : y) + "px";
  });
  document.addEventListener("mouseout", e => {
    if (!e.target.closest("[data-tooltip]")) tip.style.display = "none";
  });
})();

let dmUnlocked        = false;
let unsubCharacters   = null;
let unsubLocations    = null;
let unsubTurn         = null;
let unsubMonsters     = null;
let unsubScenes       = null;
let unsubSettings     = null;

// ── Game settings (live from Firestore settings/game) ─────
// Defaults are used until the doc loads or if a field is absent
let gameSettings = {
  tierThresholds:  { 1: 10, 2: 13, 3: 16, 4: 19 },
  tierCooldowns:   { 1: 3,  2: 5,  3: 7,  4: 9  },
  hpBase:          5,
  hpEnduranceMult: 3,
  hpMightMult:     1,
  callBudgetMult:  1,   // Aremu sum × this = calls per turn
  recoveryDivisor: 3,   // ceil(Anubet sum / this) = HP recovered on turn end
};
function gsThreshold(tier)    { return gameSettings.tierThresholds?.[tier]  ?? [null,10,13,16,19][tier]; }
function gsCooldown(tier)     { return gameSettings.tierCooldowns?.[tier]   ?? [null,3,5,7,9][tier]; }
function gsHpBase()           { return gameSettings.hpBase          ?? 5; }
function gsHpEndMult()        { return gameSettings.hpEnduranceMult ?? 3; }
function gsHpMightMult()      { return gameSettings.hpMightMult     ?? 1; }
function gsCallMult()         { return gameSettings.callBudgetMult  ?? 1; }
function gsRecoveryDiv()      { return gameSettings.recoveryDivisor ?? 3; }

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
    initDmNotifButton();
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

// ── Claude AI helpers — routed through Netlify serverless proxy ───────────────
// The API key lives in ANTHROPIC_API_KEY env var on Netlify; never in the browser.

async function claudeProxy(messages, max_tokens = 500) {
  const response = await fetch("/.netlify/functions/claude", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens, messages }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `API error ${response.status}`);
  return data.content[0].text.trim();
}

/** Strip markdown fences then parse the outermost JSON object from a Claude response. */
function extractJson(raw) {
  const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found: " + cleaned.slice(0, 80));
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * DM always types in English.
 * messageEN = original text (no Claude needed).
 * messageHU = Hungarian translation from Claude (plain text, no JSON).
 * Returns { messageEN, messageHU } or { messageEN } on failure.
 */
async function translateMessage(message) {
  const messageEN = message;
  try {
    const prompt =
      `Translate the following dark fantasy tabletop RPG log message into Hungarian. ` +
      `Keep character names, location names, numbers, and game terms (HP, round, etc.) unchanged.\n\n` +
      `${message}\n\n` +
      `Reply with ONLY the Hungarian translation, nothing else:`;
    const raw = await claudeProxy([{ role: "user", content: prompt }], 300);
    const messageHU = raw.trim();
    if (!messageHU) throw new Error("Empty translation");
    return { messageEN, messageHU };
  } catch (e) {
    console.error("DM translation failed:", e);
    return { messageEN };
  }
}

/**
 * For automated entries (heal ticks, encounter damage) — patch translations
 * onto an already-written Firestore doc.
 */
async function translateAndUpdate(docRef, message) {
  const t = await translateMessage(message);
  try { await updateDoc(docRef, t); } catch (e) { console.error("translateAndUpdate patch failed:", e); }
}

// ── Push notifications ────────────────────────────────────

let dmPushSub = null;   // DM's own push subscription (set when DM opts in)

async function initDmNotifButton() {
  const btn = document.getElementById("dmNotifBtn");
  if (!btn) return;

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    btn.style.display = "none";
    return;
  }

  const updateBtn = (state) => {
    if (state === "granted") {
      btn.textContent = "🔔 Notifications On";
      btn.title = "Push notifications enabled";
      btn.classList.add("dm-notif-btn--on");
      btn.disabled = true;
    } else if (state === "denied") {
      btn.textContent = "🔕 Blocked";
      btn.title = "Notifications blocked — enable in browser settings";
      btn.disabled = true;
    } else {
      btn.textContent = "🔔 Enable Notifications";
      btn.title = "Enable push notifications for player actions";
      btn.classList.remove("dm-notif-btn--on");
      btn.disabled = false;
    }
  };

  if (Notification.permission === "denied") {
    updateBtn("denied");
    return;
  }

  // Primary: ask the service worker if there's already an active push subscription
  // on this device. This is the reliable source of truth — Firestore is just storage.
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing && Notification.permission === "granted") {
      dmPushSub = existing.toJSON();
      // Refresh Firestore with the current subscription so notifyDM works from any device
      setDoc(doc(db, "config", "dm"), { pushSubscription: dmPushSub }, { merge: true }).catch(() => {});
      updateBtn("granted");
      return;
    }
  } catch (_) {}

  // Fallback: check Firestore (e.g. service worker not yet ready on first load)
  try {
    const snap = await getDoc(doc(db, "config", "dm"));
    if (snap.exists() && snap.data().pushSubscription) {
      dmPushSub = snap.data().pushSubscription;
      updateBtn("granted");
    }
  } catch (_) {}

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const sub = await registerPush();
    if (sub) {
      dmPushSub = sub;
      await setDoc(doc(db, "config", "dm"), { pushSubscription: sub }, { merge: true });
      updateBtn("granted");
    } else {
      updateBtn(Notification.permission);
    }
  });
}

/**
 * Send Web Push to a list of subscriptions via the Netlify function.
 * Fire-and-forget — errors are logged but never surface to the UI.
 */
async function sendPush(subscriptions, title, body, url = "/", tag = "eb") {
  const subs = subscriptions.filter(Boolean);
  if (!subs.length) return;
  try {
    await fetch("/.netlify/functions/send-push", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ subscriptions: subs, title, body, url, tag }),
    });
  } catch (err) {
    console.warn("Push send failed:", err);
  }
}

/** Notify all players at a given locationId. */
function notifyPlayers(locationId, title, body) {
  if (!locationId) return;
  const subs = Object.values(characters)
    .filter(c => c.locationId === locationId && c.pushSubscription)
    .map(c => c.pushSubscription);
  if (!subs.length) return;
  const locName = locationLabel(locationId) || "your location";
  sendPush(subs, title, body, "/", `turn-${locationId}`);
}

/** Notify the DM (uses the in-memory subscription acquired on unlock). */
function notifyDM(title, body) {
  if (!dmPushSub) return;
  sendPush([dmPushSub], title, body, "/", "dm-scene");
}

// Enhance a "speak as" message in the voice of a specific character/monster
async function callClaudeSpeakAs(text, actorName, actorMeta, type) {
  const typeContext = {
    roleplay: "a roleplay or social interaction",
    combat:   "an intense combat encounter",
    system:   "a dramatic narration moment",
  }[type] || "a scene";
  const metaStr = actorMeta ? ` (${actorMeta})` : "";
  const prompt =
    `You are a narrative assistant for "Echoes Beneath," a dark fantasy TTRPG.\n` +
    `The character ${actorName}${metaStr} is speaking during ${typeContext}.\n\n` +
    `The Dungeon Master wrote this draft in their voice:\n"${text}"\n\n` +
    `The input may be in any language — translate to English if needed.\n` +
    `Rewrite it as vivid, in-character speech — dark fantasy tone, 1-3 sentences, ` +
    `keeping the original intent and emotion. Fix any typos.\n\n` +
    `Respond with the English version only. No labels, no extra commentary.`;
  return claudeProxy([{ role: "user", content: prompt }], 400);
}

async function callClaude(text, phase) {
  const phaseContext = {
    combat:      "an intense combat encounter",
    exploration: "an exploration or discovery moment",
    roleplay:    "a roleplay or social interaction",
    downtime:    "a downtime or rest period",
  }[phase] || "a scene";
  const content =
    `You are a narrative assistant for "Echoes Beneath," a dark fantasy tabletop RPG. ` +
    `The Dungeon Master wrote this description for ${phaseContext}:\n\n"${text}"\n\n` +
    `The input may be in any language — translate to English if needed. ` +
    `Enhance it: fix typos, add atmospheric dark fantasy flair, improve clarity. Keep it 1-3 sentences.\n\n` +
    `Respond with the enhanced English text only. No labels, no extra commentary.`;
  return claudeProxy([{ role: "user", content }], 500);
}

function attachAiEnhance(strip, textareaId, phaseSelId, staticPhase) {
  const enhanceBtn = strip.querySelector("#dmBtnEnhance");
  const statusEl   = strip.querySelector("#dmAiStatus");
  const textarea   = strip.querySelector("#" + textareaId);
  if (!enhanceBtn || !textarea) return;

  // Remove key-config button if present (no longer needed — key lives on server)
  strip.querySelector("#dmBtnConfigKey")?.remove();

  let originalText = null;

  const setStatus = (msg, isError = false) => {
    statusEl.textContent = msg;
    statusEl.className = "dm-ai-status" + (isError ? " error" : "");
  };

  enhanceBtn.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text) { textarea.focus(); return; }

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
      const msg1 = `${PHASE_ICONS[phase]} [${locName}] Round 1 begins — ${desc}`;
      const t1   = await translateMessage(msg1);
      await addDoc(collection(db, "sessionLog"), {
        type: "turn", actor: "DM",
        message: msg1, ...t1,
        timestamp: serverTimestamp(), charId: null,
        locationId: turnDocId !== "__global__" ? turnDocId : null,
      });
      notifyPlayers(turnDocId !== "__global__" ? turnDocId : null, `${PHASE_ICONS[phase]} Round 1 begins`, desc);
      resetAllCalls(); // New turn — restore everyone's call budget
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
      const msgNext = `${icon} [${locName}] Round ${newRound} — ${newDesc}`;
      const tNext   = await translateMessage(msgNext);
      await addDoc(collection(db, "sessionLog"), {
        type: "turn", actor: "DM",
        message: msgNext, ...tNext,
        timestamp: serverTimestamp(), charId: null,
        locationId: turnDocId !== "__global__" ? turnDocId : null,
      });
      notifyPlayers(turnDocId !== "__global__" ? turnDocId : null, `${icon} Round ${newRound}`, newDesc);
      // Auto-decrement ability cooldowns for all characters
      tickAllCooldowns();
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
      const msgEnd = `✕ [${locName}] Turn ended after Round ${round}`;
      const tEnd   = await translateMessage(msgEnd);
      await addDoc(collection(db, "sessionLog"), {
        type: "turn", actor: "DM",
        message: msgEnd, ...tEnd,
        timestamp: serverTimestamp(), charId: null,
        locationId: turnDocId !== "__global__" ? turnDocId : null,
      });
      applySceneRecovery(turnDocId); // Spirit recovery for chars at this location
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
        // Update dead/alive state on scene tokens without a full panel rebuild
        document.querySelectorAll(".dm-scene-token[data-monster-id]").forEach(el => {
          const m = monsters[el.dataset.monsterId];
          if (m) el.classList.toggle("dm-scene-token--dead", (m.hp ?? 0) <= 0);
        });
      },
      () => renderEncounterSidebar()
    );
  }

  // Spectator config listener — sync tick state
  onSnapshot(doc(db, "spectator", "config"), snap => {
    spectatorLocId = snap.data()?.locationId ?? null;
    document.querySelectorAll(".dm-loc-spectator-radio").forEach(radio => {
      const active = radio.value === spectatorLocId;
      radio.checked = active;
      radio.closest(".dm-loc-spectator-label")?.classList.toggle("active", active);
    });
  });

  // Session log listener (for scenes-tab sidebar)
  onSnapshot(
    query(collection(db, "sessionLog"), orderBy("timestamp", "desc"), limit(80)),
    snap => {
      snap.docChanges().forEach(change => {
        const id = change.doc.id;
        if (change.type === "removed") delete dmLogEntries[id];
        else dmLogEntries[id] = { data: change.doc.data() };
      });
      rerenderDmLog();
    }
  );

  // Scenes listener
  if (!unsubScenes) {
    unsubScenes = onSnapshot(collection(db, "scenes"), snap => {
      snap.docChanges().forEach(change => {
        const id = change.doc.id;
        if (change.type === "removed") delete scenes[id];
        else scenes[id] = { id, ...change.doc.data() };
      });
      if (activeTab() === "scenes") {
        // Only rebuild panels — preserves the dropdown selection
        if (document.getElementById("dmScenePanelsWrap")) renderScenePanels();
        else renderScenesTab();
      }
    }, () => {});
  }

  if (!unsubSettings) {
    unsubSettings = onSnapshot(doc(db, "settings", "game"), snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.tierThresholds)        gameSettings.tierThresholds  = d.tierThresholds;
        if (d.tierCooldowns)         gameSettings.tierCooldowns   = d.tierCooldowns;
        if (d.hpBase          != null) gameSettings.hpBase          = d.hpBase;
        if (d.hpEnduranceMult != null) gameSettings.hpEnduranceMult = d.hpEnduranceMult;
        if (d.hpMightMult     != null) gameSettings.hpMightMult     = d.hpMightMult;
        if (d.callBudgetMult  != null) gameSettings.callBudgetMult  = d.callBudgetMult;
        if (d.recoveryDivisor != null) gameSettings.recoveryDivisor = d.recoveryDivisor;
      }
      if (activeTab() === "settings") renderSettingsTab();
      if (activeTab() === "spells" && selectedCharId) renderSpellsTab(characters[selectedCharId]);
    }, () => {});
  }
}

// ── Character sidebar ─────────────────────────────────────
function renderCharList() {
  dmCharList.innerHTML = "";
  const scenesActive = activeTab() === "scenes";
  const chars = Object.values(characters)
    .filter(char => !scenesActive || !selectedSceneLocId || char.locationId === selectedSceneLocId)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  chars.forEach(char => {
    const wrap = document.createElement("div");
    wrap.className = "dm-char-wrap";

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
    btn.draggable = true;
    btn.addEventListener("dragstart", e => {
      e.dataTransfer.setData("charId", char.id);
      e.dataTransfer.effectAllowed = "copy";
    });

    const delBtn = document.createElement("button");
    delBtn.className = "dm-char-delete";
    delBtn.title     = "Delete character";
    delBtn.textContent = "🗑";
    delBtn.addEventListener("click", async e => {
      e.stopPropagation();
      if (!confirm(`Permanently delete "${char.name}"?\nThis cannot be undone.`)) return;
      if (selectedCharId === char.id) {
        selectedCharId = null;
        document.querySelectorAll(".dm-tab-panel").forEach(p => {
          p.innerHTML = `<div class="dm-no-char">Select a character from the list.</div>`;
        });
      }
      await deleteDoc(doc(db, "characters", char.id));
    });

    wrap.appendChild(btn);
    wrap.appendChild(delBtn);
    dmCharList.appendChild(wrap);
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
    renderCharList(); // re-filter sidebar for new tab context
  });
});

function activeTab() {
  return document.querySelector(".dm-tab-btn.active")?.dataset.tab || "combat";
}

function renderActiveTab() {
  const tab  = activeTab();
  if (tab === "locations") { renderLocationsTab(); return; }
  if (tab === "scenes")    { renderScenesTab();    return; }
  if (tab === "settings")  { renderSettingsTab();  return; }

  const char = selectedCharId ? characters[selectedCharId] : null;
  if (!char) {
    ["combat", "inventory", "stats", "log", "spells"].forEach(t => {
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

// Finds which scene location a monster token is placed in.
// Falls back to selectedTurnLocId if the monster isn't on any map.
function findMonsterLocId(monsterId) {
  for (const [locId, scene] of Object.entries(scenes)) {
    const tokens = scene.current?.tokens || [];
    if (tokens.some(t => t.monsterId === monsterId)) return locId;
  }
  return selectedTurnLocId !== "__global__" ? selectedTurnLocId : null;
}

// Returns a narrative health state phrase based on HP percentage
function playerCombatState(hp, hpMax) {
  if (!hpMax) return null;
  const pct = hp / hpMax;
  if (hp <= 0)     return "has fallen unconscious";
  if (pct <= 0.10) return "is on the brink of death";
  if (pct <= 0.25) return "is in dire condition";
  if (pct <= 0.50) return "is badly wounded";
  if (pct <= 0.75) return "is wounded";
  return "is lightly wounded";
}

// HP formula: hpBase + (Endurance × hpEndMult) + (Might × hpMightMult)
function calcHpMax(stats) {
  return gsHpBase() + ((stats.Endurance || 0) * gsHpEndMult()) + ((stats.Might || 0) * gsHpMightMult());
}

// Aremu sum × callBudgetMult = call budget per turn
function calcCallBudget(stats) {
  const aremu = (stats.Knowledge || 0) + (stats.Perception || 0) + (stats.Ingenuity || 0);
  return Math.max(1, Math.round(aremu * gsCallMult()));
}

// Anubet scene recovery = ceil(Anubet sum / recoveryDivisor)
function calcRecovery(stats) {
  const sum = (stats.Presence || 0) + (stats.Will || 0) + (stats.Empathy || 0);
  return Math.ceil(sum / gsRecoveryDiv());
}

// Reset callsUsed to 0 for all characters (called on New Turn / Begin)
async function resetAllCalls() {
  const updates = Object.entries(characters).map(([id]) =>
    updateDoc(doc(db, "characters", id), { callsUsed: 0 })
  );
  if (updates.length) await Promise.all(updates);
}

// Apply Anubet scene recovery HP to all characters (called on End Turn)
async function applySceneRecovery(locationId) {
  const updates = [];
  Object.entries(characters).forEach(([id, char]) => {
    // Only heal chars at this location (or all if global turn)
    if (locationId && locationId !== "__global__" && char.locationId !== locationId) return;
    const recovery = calcRecovery(char.stats || {});
    if (!recovery) return;
    const newHp = Math.min(char.hpMax || 0, (char.hp || 0) + recovery);
    if (newHp === char.hp) return;
    const recMsg = `✨ ${char.name} recovers ${recovery} HP (Spirit ${calcRecovery(char.stats||{})})`;
    updates.push(
      updateDoc(doc(db, "characters", id), { hp: newHp }),
      addDoc(collection(db, "sessionLog"), {
        type: "heal", actor: "Turn End",
        message: recMsg,
        charId: id, timestamp: serverTimestamp(),
      }).then(ref => translateAndUpdate(ref, recMsg))
    );
  });
  if (updates.length) await Promise.all(updates);
}

// Decrement every active ability cooldown by 1 for all characters (called on Next Round)
async function tickAllCooldowns() {
  const updates = [];
  Object.entries(characters).forEach(([id, char]) => {
    const cd = char.abilityCooldowns;
    if (!cd || !Object.keys(cd).length) return;
    const patch = {};
    Object.entries(cd).forEach(([name, turns]) => {
      if (turns <= 1) patch[`abilityCooldowns.${name}`] = deleteField();
      else            patch[`abilityCooldowns.${name}`] = turns - 1;
    });
    updates.push(updateDoc(doc(db, "characters", id), patch));
  });
  if (updates.length) await Promise.all(updates);
}

async function dmLog(type, actor, message, locationId = null) {
  const t = await translateMessage(message);
  const entry = {
    type, actor, message, ...t,
    timestamp: serverTimestamp(),
    charId: selectedCharId || null,
  };
  if (locationId) entry.locationId = locationId;
  await addDoc(collection(db, "sessionLog"), entry);
}


// ── COMBAT TAB ────────────────────────────────────────────
function renderCombatTab(char) {
  const el = document.getElementById("dm-tab-combat");
  const conds = char.conditions || {};
  const pct = hpPct(char);
  el.innerHTML = `
    <div class="dm-combat-grid">

      <!-- Left column: HP -->
      <div class="dm-combat-col">
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
      </div>

      <!-- Right column: Conditions -->
      <div class="dm-combat-col">
        <div class="dm-section">
          <h3 class="dm-section-title">Conditions</h3>
          <div class="dm-conditions-grid" id="dmCondGrid"></div>
        </div>
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
    const dmgState = playerCombatState(newHp, c.hpMax);
    dmLog("damage", "DM", `dealt ${amt} damage to ${c.name}${dmgState ? ` — ${c.name} ${dmgState}` : ""}`, c.locationId || null);
  });
  el.querySelector("#dmBtnHeal").addEventListener("click", async () => {
    const amt = parseInt(el.querySelector("#dmHpAmt").value) || 0;
    if (!amt) return;
    const c = characters[selectedCharId];
    const newHp = Math.min(c.hpMax ?? 9999, (c.hp ?? 0) + amt);
    await updateDoc(charRef(), { hp: newHp });
    const healState = playerCombatState(newHp, c.hpMax);
    dmLog("heal", "DM", `healed ${c.name} for ${amt} HP${healState ? ` — ${c.name} ${healState}` : ""}`, c.locationId || null);
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

  const STAT_GROUPS = [
    { label: "💪 Body",   stats: ["Might", "Agility", "Endurance"] },
    { label: "🧠 Mind",   stats: ["Knowledge", "Perception", "Ingenuity"] },
    { label: "👁️ Spirit", stats: ["Presence", "Will", "Empathy"] },
  ];

  function appendGroupedStats(container, valueGetter, classFn, onMinus, onPlus) {
    STAT_GROUPS.forEach(({ label, stats: groupStats }) => {
      const lbl = document.createElement("div");
      lbl.className = "dm-stat-group-label";
      lbl.textContent = label;
      container.appendChild(lbl);
      const grp = document.createElement("div");
      grp.className = "dm-stat-group";
      groupStats.forEach(stat => {
        const val = valueGetter(stat);
        const cls = classFn ? classFn(val) : "";
        grp.appendChild(makeStatRow(stat, val, cls, onMinus(stat), onPlus(stat)));
      });
      container.appendChild(grp);
    });
  }

  // Update a base stat and recalculate hpMax if Might or Endurance changed
  async function setBaseStat(stat, delta) {
    const c       = characters[selectedCharId];
    const newVal  = (c?.stats?.[stat] ?? 0) + delta;
    const patch   = { [`stats.${stat}`]: newVal };
    if (stat === "Might" || stat === "Endurance") {
      const newStats = { ...(c?.stats || {}), [stat]: newVal };
      patch.hpMax    = calcHpMax(newStats);
      // Clamp current HP to new max if it was exactly at max (levelling up)
      if ((c?.hp ?? 0) >= (c?.hpMax ?? 0)) patch.hp = patch.hpMax;
    }
    await updateDoc(charRef(), patch);
  }

  const baseGrid = el.querySelector("#dmBaseStatsGrid");
  appendGroupedStats(
    baseGrid,
    stat => stats[stat] ?? 0,
    null,
    stat => async () => setBaseStat(stat, -1),
    stat => async () => setBaseStat(stat, +1)
  );

  const modGrid = el.querySelector("#dmModStatsGrid");
  appendGroupedStats(
    modGrid,
    stat => mods[stat] ?? 0,
    val => val > 0 ? "pos" : val < 0 ? "neg" : "",
    stat => async () => {
      const cur = characters[selectedCharId]?.statModifiers?.[stat] ?? 0;
      await updateDoc(charRef(), { [`statModifiers.${stat}`]: cur - 1 });
    },
    stat => async () => {
      const cur = characters[selectedCharId]?.statModifiers?.[stat] ?? 0;
      await updateDoc(charRef(), { [`statModifiers.${stat}`]: cur + 1 });
    }
  );

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
            <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.82rem;color:var(--dm-muted);cursor:pointer">
              <input type="checkbox" id="dmEEquipped" style="cursor:pointer" />
              Add as equipped (stat effects apply immediately)
            </label>
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
      equipped: !!el.querySelector("#dmEEquipped")?.checked,
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

    // Show stat effects if any
    if (item.statEffects && Object.keys(item.statEffects).length) {
      const effectsRow = document.createElement("div");
      effectsRow.className = "dm-inv-effects";
      effectsRow.innerHTML = Object.entries(item.statEffects)
        .filter(([, v]) => v !== 0)
        .map(([stat, val]) => {
          const cls = val > 0 ? "pos" : "neg";
          return `<span class="dm-inv-effect-chip ${cls}">${stat} ${val > 0 ? "+" : ""}${val}</span>`;
        }).join("");
      div.appendChild(effectsRow);
    }
  }

  return div;
}

// ── SPELLS TAB ───────────────────────────────────────────
const TIER_LABELS = {
  1: "Tier 1 — Subtle",
  2: "Tier 2 — Visible",
  3: "Tier 3 — Flashy",
  4: "Tier 4 — Mythic",
};
const BLOODLINE_ICONS = { Nasht: "💪", Aremu: "🧠", Anubet: "👁️" };

function spellTier(spell) {
  if (spell.tier) return spell.tier;
  if (spell.level === 0) return 1;
  if (spell.level <= 2)  return 1;
  if (spell.level <= 4)  return 2;
  if (spell.level <= 6)  return 3;
  return 4;
}

const DM_TIER_THRESHOLDS = [null, 10, 13, 16, 19];
const DM_TIER_COST       = [null, "1 call", "1 call", "2 calls", "3 calls · once/session"];
const DM_TIER_COOLDOWNS  = [null, 3, 5, 7, 9]; // turns
const DM_BLOODLINES      = [
  { key: "Nasht",  statKeys: ["Might","Agility","Endurance"] },
  { key: "Aremu",  statKeys: ["Knowledge","Perception","Ingenuity"] },
  { key: "Anubet", statKeys: ["Presence","Will","Empathy"] },
];

function renderSpellsTab(char) {
  const el         = document.getElementById("dm-tab-spells");
  const stats      = char.stats || {};
  const cooldowns  = char.abilityCooldowns || {};
  const callsUsed  = char.callsUsed  || 0;
  const callsTotal = calcCallBudget(stats);
  const recovery   = calcRecovery(stats);

  // Bloodline sums
  const sums = {};
  DM_BLOODLINES.forEach(bl => {
    sums[bl.key] = bl.statKeys.reduce((t, s) => t + (stats[s] || 0), 0);
  });

  // Summary header HTML
  const summaryHtml = DM_BLOODLINES.map(({ key }) =>
    `<span class="dm-spell-bl-chip ${sums[key] >= DM_TIER_THRESHOLDS[1] ? "unlocked" : "locked"}">
      ${BLOODLINE_ICONS[key]} ${key} <strong>${sums[key]}</strong>
    </span>`
  ).join("");

  const callPips = Array.from({ length: callsTotal }, (_, i) =>
    `<span class="dm-call-pip${i < callsUsed ? " used" : ""}"></span>`
  ).join("");

  el.innerHTML = `
    <div class="dm-section">
      <h3 class="dm-section-title">
        Abilities
        <span class="dm-spells-hint">Hover for description · 🔒 = locked</span>
      </h3>
      <div class="dm-spell-bl-summary">${summaryHtml}</div>
      <div class="dm-call-budget-bar">
        <span class="dm-call-budget-label">🧠 Calls <strong>${callsTotal - callsUsed}/${callsTotal}</strong></span>
        <div class="dm-call-pips">${callPips}</div>
        <span class="dm-call-recovery">👁️ +${recovery} HP / turn end</span>
        <button class="dm-btn dm-btn-neutral dm-btn-sm" id="dmResetCalls" title="Reset calls (New Turn resets automatically)">↺ Reset</button>
      </div>
      <div class="dm-spell-list" id="dmSpellList"></div>
    </div>
  `;

  const list = el.querySelector("#dmSpellList");

  // Build ability map per bloodline
  const byBloodline = {};
  Object.entries(ABILITY_DB).forEach(([name, ab]) => {
    (byBloodline[ab.bloodline] = byBloodline[ab.bloodline] || []).push({ name, ...ab });
  });

  // Sort bloodlines by sum descending (most unlocked first)
  const sortedDmBloodlines = [...DM_BLOODLINES].sort((a, b) => sums[b.key] - sums[a.key]);

  sortedDmBloodlines.forEach(({ key }) => {
    const sum = sums[key];
    // Unlocked tiers first, then locked — within each group sort by tier asc
    const abilities = (byBloodline[key] || []).sort((a, b) => {
      const aU = sum >= DM_TIER_THRESHOLDS[a.tier] ? 0 : 1;
      const bU = sum >= DM_TIER_THRESHOLDS[b.tier] ? 0 : 1;
      if (aU !== bU) return aU - bU;
      return a.tier - b.tier || a.name.localeCompare(b.name);
    });

    // Bloodline header
    const blHdr = document.createElement("div");
    blHdr.className = "dm-spell-tier-header dm-spell-bl-header";
    blHdr.textContent = `${BLOODLINE_ICONS[key]} ${key}  ·  ${sum} pts`;
    list.appendChild(blHdr);

    let lastTier = 0;
    abilities.forEach(ability => {
      const unlocked   = sum >= gsThreshold(ability.tier);
      const cdLeft     = cooldowns[ability.name] || 0;
      const onCooldown = cdLeft > 0;

      if (ability.tier !== lastTier) {
        lastTier = ability.tier;
        const needed = gsThreshold(ability.tier);
        const tierHdr = document.createElement("div");
        tierHdr.className = "dm-spell-row dm-spell-row--header" + (unlocked ? "" : " dm-spell-row--locked-hdr");
        tierHdr.innerHTML = unlocked
          ? `<span style="grid-column:1/3">${TIER_LABELS[ability.tier]}</span><span>${DM_TIER_COST[ability.tier]} · ${gsCooldown(ability.tier)}t cd</span><span></span>`
          : `<span style="grid-column:1/3">${TIER_LABELS[ability.tier]}  🔒 need ${needed}</span><span></span><span></span>`;
        list.appendChild(tierHdr);
      }

      const desc = ability.description || "";
      const row  = document.createElement("div");
      row.className = "dm-spell-row dm-spell-row--ability"
        + (unlocked ? "" : " dm-spell-row--locked")
        + (onCooldown ? " dm-spell-row--cooldown" : "");
      if (desc) { row.setAttribute("data-tooltip", desc); row.classList.add("has-tooltip"); }

      const cdHtml = onCooldown
        ? `<span class="dm-cd-badge">⏳ ${cdLeft}t</span>
           <button class="dm-stat-btn dm-cd-minus" data-ability="${ability.name}" title="−1 turn">−</button>
           <button class="dm-stat-btn dm-stat-btn-danger dm-cd-reset" data-ability="${ability.name}" title="Reset cooldown">✕</button>`
        : `<span class="dm-spell-lock">${unlocked ? "" : "🔒"}</span><span></span><span></span>`;

      row.innerHTML = `
        <span class="dm-spell-cat-icon">${BLOODLINE_ICONS[key]}</span>
        <span class="dm-spell-name">${ability.name}</span>
        <input class="dm-input dm-spell-dice-input" type="text"
          value="" placeholder="e.g. 2d6"
          data-ability="${ability.name}"
          ${unlocked && !onCooldown ? "" : "disabled"} />
        ${cdHtml}
      `;
      list.appendChild(row);
    });
  });

  // Dice formula inputs
  const abilityDice = char.abilityDice || {};
  list.querySelectorAll(".dm-spell-dice-input").forEach(input => {
    const name = input.dataset.ability;
    input.value = abilityDice[name] || "";
    const save = async () => {
      const val = input.value.trim();
      const k   = `abilityDice.${name}`;
      if (val) await updateDoc(charRef(), { [k]: val });
      else     await updateDoc(charRef(), { [k]: deleteField() });
    };
    input.addEventListener("blur",    save);
    input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });
  });

  // Call budget reset button
  el.querySelector("#dmResetCalls")?.addEventListener("click", async () => {
    await updateDoc(charRef(), { callsUsed: 0 });
  });

  // Cooldown −1 and reset buttons
  list.querySelectorAll(".dm-cd-minus").forEach(btn => {
    btn.addEventListener("click", async () => {
      const name = btn.dataset.ability;
      const cur  = (characters[selectedCharId]?.abilityCooldowns?.[name] || 0);
      const next = cur - 1;
      if (next <= 0) await updateDoc(charRef(), { [`abilityCooldowns.${name}`]: deleteField() });
      else           await updateDoc(charRef(), { [`abilityCooldowns.${name}`]: next });
    });
  });
  list.querySelectorAll(".dm-cd-reset").forEach(btn => {
    btn.addEventListener("click", async () => {
      await updateDoc(charRef(), { [`abilityCooldowns.${btn.dataset.ability}`]: deleteField() });
    });
  });
}

// ── SETTINGS TAB ─────────────────────────────────────────
function renderSettingsTab() {
  const el = document.getElementById("dm-tab-settings");

  const th = gameSettings.tierThresholds || {};
  const tc = gameSettings.tierCooldowns  || {};

  const TIER_ROWS = [
    { tier: 1, label: "Tier 1 — Subtle",  color: "#9a8a7a" },
    { tier: 2, label: "Tier 2 — Visible", color: "#a07040" },
    { tier: 3, label: "Tier 3 — Flashy",  color: "#c06030" },
    { tier: 4, label: "Tier 4 — Mythic",  color: "#8050c0" },
  ];

  el.innerHTML = `
    <div class="dm-section">
      <h3 class="dm-section-title">⚙️ Game Rules</h3>
      <p class="dm-settings-hint">Changes save instantly and affect all player sheets live.</p>

      <h4 class="dm-settings-sub">HP Formula</h4>
      <p class="dm-settings-desc">hpMax = Base + (Endurance × End.Mult) + (Might × Might.Mult)</p>
      <div class="dm-settings-grid" id="dmSettingsHp"></div>

      <h4 class="dm-settings-sub" style="margin-top:1.2rem">Call Budget (Mind / Aremu)</h4>
      <p class="dm-settings-desc">Calls per turn = Aremu sum × multiplier.<br>Resets on New Turn.</p>
      <div class="dm-settings-grid" id="dmSettingsCalls"></div>

      <h4 class="dm-settings-sub" style="margin-top:1.2rem">Scene Recovery (Spirit / Anubet)</h4>
      <p class="dm-settings-desc">HP recovered on turn end = ⌈Anubet sum ÷ divisor⌉.</p>
      <div class="dm-settings-grid" id="dmSettingsRecovery"></div>

      <h4 class="dm-settings-sub" style="margin-top:1.2rem">Ability Unlock Thresholds</h4>
      <p class="dm-settings-desc">Bloodline stat sum required to access each tier.<br>
        (Nasht = Might+Agility+Endurance, etc.)</p>
      <div class="dm-settings-grid" id="dmSettingsThresholds"></div>

      <h4 class="dm-settings-sub" style="margin-top:1.2rem">Ability Cooldowns</h4>
      <p class="dm-settings-desc">Turns an ability is locked after use.</p>
      <div class="dm-settings-grid" id="dmSettingsCooldowns"></div>

      <button class="dm-btn dm-btn-neutral" id="dmSettingsReset" style="margin-top:1rem;width:100%">
        ↺ Reset All to Defaults
      </button>
    </div>
  `;

  // Shared save helper — merges a patch into settings/game
  async function saveSetting(patch) {
    await setDoc(doc(db, "settings", "game"), { ...gameSettings, ...patch }, { merge: true });
  }

  // Generic row builder
  function makeRow(containerId, label, color, value, unit, min, max, onSave, step = 1) {
    const container = el.querySelector(`#${containerId}`);
    const row = document.createElement("div");
    row.className = "dm-settings-row";
    row.innerHTML = `
      <span class="dm-settings-tier-label" style="color:${color}">${label}</span>
      <input class="dm-input dm-settings-input" type="number"
        min="${min}" max="${max}" step="${step}" value="${value}" />
      <span class="dm-settings-unit">${unit}</span>
    `;
    const input = row.querySelector("input");
    const save = async () => {
      const val = step < 1 ? parseFloat(input.value) : parseInt(input.value);
      if (isNaN(val) || val < min) return;
      await onSave(val);
    };
    input.addEventListener("blur",    save);
    input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });
    container.appendChild(row);
  }

  // ── HP formula ──────────────────────────────────────────
  makeRow("dmSettingsHp", "Base HP",            "#9a8a7a", gsHpBase(),      "pts",    0, 30,  1,
    async val => saveSetting({ hpBase: val }));
  makeRow("dmSettingsHp", "Endurance ×",        "#a07040", gsHpEndMult(),   "/ pt",   0, 10,  1,
    async val => saveSetting({ hpEnduranceMult: val }));
  makeRow("dmSettingsHp", "Might ×",            "#c06030", gsHpMightMult(), "/ pt",   0, 10,  1,
    async val => saveSetting({ hpMightMult: val }));

  // ── Call budget ─────────────────────────────────────────
  makeRow("dmSettingsCalls", "Aremu multiplier", "#6a8aba", gsCallMult(),    "× sum",  0.1, 5, 0.1,
    async val => saveSetting({ callBudgetMult: val }), 0.1);

  // ── Scene recovery ──────────────────────────────────────
  makeRow("dmSettingsRecovery", "Recovery divisor", "#6a8a6a", gsRecoveryDiv(), "÷ Anubet", 1, 20, 1,
    async val => saveSetting({ recoveryDivisor: val }));

  // ── Ability tiers ────────────────────────────────────────
  TIER_ROWS.forEach(({ tier, label, color }) => {
    makeRow("dmSettingsThresholds", label, color, gsThreshold(tier), "pts", 1, 50, 1,
      async val => saveSetting({ tierThresholds: { ...gameSettings.tierThresholds, [tier]: val } }));
    makeRow("dmSettingsCooldowns", label, color, gsCooldown(tier), "turns", 1, 20, 1,
      async val => saveSetting({ tierCooldowns: { ...gameSettings.tierCooldowns, [tier]: val } }));
  });

  el.querySelector("#dmSettingsReset").addEventListener("click", async () => {
    await setDoc(doc(db, "settings", "game"), {
      tierThresholds:  { 1: 10, 2: 13, 3: 16, 4: 19 },
      tierCooldowns:   { 1: 3,  2: 5,  3: 7,  4: 9  },
      hpBase:          5,
      hpEnduranceMult: 3,
      hpMightMult:     1,
      callBudgetMult:  1,
      recoveryDivisor: 3,
    });
  });
}

// ── LOG TAB ───────────────────────────────────────────────
function renderLogTab(char) {
  const el = document.getElementById("dm-tab-log");

  // Build voice options: all characters + monsters/NPCs
  const charOptions = Object.values(characters)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `<option value="char:${c.id}">${c.emoji || "🧑"} ${c.name}</option>`)
    .join("");
  const monsterOptions = Object.values(monsters)
    .sort((a, b) => (a.name||"").localeCompare(b.name||""))
    .map(m => `<option value="mon:${m.id}">${m.type === "npc" ? "🧑" : "👾"} ${m.name}</option>`)
    .join("");

  el.innerHTML = `
    <div class="dm-section">
      <h3 class="dm-section-title">💬 Speak As…</h3>
      <p class="dm-speak-hint">Message appears in the location log as if sent by that character — no DM label.</p>
      <div class="dm-form-fields" style="flex-wrap:wrap">
        <select class="dm-input" id="dmSpeakAs" style="flex:2;min-width:150px">
          ${charOptions ? `<optgroup label="Characters">${charOptions}</optgroup>` : ""}
          ${monsterOptions ? `<optgroup label="Monsters &amp; NPCs">${monsterOptions}</optgroup>` : ""}
        </select>
        <select class="dm-input" id="dmSpeakType" style="flex:none;width:auto">
          <option value="roleplay">💬 Roleplay</option>
          <option value="system">📢 Narration</option>
          <option value="combat">⚔️ Combat</option>
        </select>
      </div>
      <textarea class="dm-input dm-speak-textarea" id="dmSpeakMsg"
        placeholder="Write the message in character…" rows="3"></textarea>
      <div class="dm-form-fields" style="margin-top:0.35rem">
        <button class="dm-btn dm-btn-heal"    id="dmBtnSpeak">Send</button>
        <button class="dm-btn dm-btn-narrate" id="dmBtnNarrate">✨ Narrate</button>
        <button class="dm-btn-link dm-ai-undo-btn hidden" id="dmSpeakUndo">↩ Undo</button>
        <span class="dm-speak-status" id="dmSpeakStatus"></span>
      </div>
    </div>

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
      <h3 class="dm-section-title">🔒 Character Claim — ${char.name}</h3>
      <div class="dm-email-char-row">
        <span style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dm-muted);min-width:50px;">Status</span>
        ${char.claimedBy
          ? `<span class="dm-email-value">claimed (code: <strong>${char.claimedBy}</strong>)</span>
             <button class="dm-btn dm-btn-sm dm-stat-btn-danger" id="dmBtnUnclaim">Unclaim</button>`
          : `<span class="dm-email-none">Unclaimed</span>`
        }
      </div>
    </div>

    <div class="dm-section">
      <h3 class="dm-section-title">Character Notes — ${char.name}</h3>
      <textarea class="dm-notes-area" id="dmNotesArea" placeholder="Notes for ${char.name}…">${char.notes || ""}</textarea>
      <button class="dm-btn dm-btn-neutral" id="dmBtnSaveNotes">Save Notes</button>
    </div>
  `;

  // ── Speak As handler ────────────────────────────────────
  el.querySelector("#dmBtnSpeak").addEventListener("click", async () => {
    const raw     = el.querySelector("#dmSpeakAs").value;
    const type    = el.querySelector("#dmSpeakType").value;
    const message = el.querySelector("#dmSpeakMsg").value.trim();
    const status  = el.querySelector("#dmSpeakStatus");
    if (!message || !raw) return;

    const [kind, id] = raw.split(":");
    let actor, charId, locationId, emoji;

    if (kind === "char") {
      const c  = characters[id];
      if (!c) return;
      actor      = c.name;
      charId     = id;
      locationId = c.locationId || null;
      emoji      = c.emoji || null;
    } else {
      const m = monsters[id];
      if (!m) return;
      actor      = m.name;
      charId     = null;
      locationId = selectedTurnLocId !== "__global__" ? selectedTurnLocId : null;
      emoji      = m.type === "npc" ? "🧑" : "👾";
    }

    const entry = { type, actor, message, timestamp: serverTimestamp(), charId };
    if (locationId) entry.locationId = locationId;
    if (emoji)      entry.emoji      = emoji;

    status.textContent = "Sending…";
    const speakT = await translateMessage(message);
    await addDoc(collection(db, "sessionLog"), { ...entry, ...speakT });
    el.querySelector("#dmSpeakMsg").value = "";
    status.textContent = "✓ Sent";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });

  // Ctrl/Cmd+Enter sends; Ctrl/Cmd+Shift+Enter narrates
  el.querySelector("#dmSpeakMsg").addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      if (e.shiftKey) el.querySelector("#dmBtnNarrate").click();
      else            el.querySelector("#dmBtnSpeak").click();
    }
  });

  // ── Narrate button ───────────────────────────────────────
  el.querySelector("#dmBtnNarrate").addEventListener("click", async () => {
    const raw      = el.querySelector("#dmSpeakAs").value;
    const type     = el.querySelector("#dmSpeakType").value;
    const textarea = el.querySelector("#dmSpeakMsg");
    const status   = el.querySelector("#dmSpeakStatus");
    const undoBtn  = el.querySelector("#dmSpeakUndo");
    const narBtn   = el.querySelector("#dmBtnNarrate");
    const text     = textarea.value.trim();
    if (!text || !raw) return;

    // Get actor display meta for the prompt
    const [kind, id] = raw.split(":");
    let actorName, actorMeta;
    if (kind === "char") {
      const c  = characters[id];
      actorName = c?.name || "Character";
      actorMeta = [c?.race, c?.class].filter(Boolean).join(" ");
    } else {
      const m   = monsters[id];
      actorName = m?.name || "Creature";
      actorMeta = m?.type === "npc" ? "NPC" : "Monster";
    }

    narBtn.disabled = true;
    undoBtn.classList.add("hidden");
    status.textContent = "✨ Narrating…";
    status.className   = "dm-speak-status";

    try {
      const originalText = text;
      const enhanced     = await callClaudeSpeakAs(text, actorName, actorMeta, type);
      textarea.value = enhanced;
      status.textContent = "";
      undoBtn.classList.remove("hidden");
      undoBtn.onclick = () => {
        textarea.value = originalText;
        undoBtn.classList.add("hidden");
      };
    } catch (err) {
      status.textContent = "⚠ " + err.message;
      status.className   = "dm-speak-status error";
    } finally {
      narBtn.disabled = false;
    }
  });

  el.querySelector("#dmBtnAddLog").addEventListener("click", async () => {
    const type    = el.querySelector("#dmLogType").value;
    const actor   = el.querySelector("#dmLogActor").value.trim() || "DM";
    const message = el.querySelector("#dmLogMsg").value.trim();
    if (!message) return;
    const logT = await translateMessage(message);
    await addDoc(collection(db, "sessionLog"), {
      type, actor, message, ...logT,
      timestamp: serverTimestamp(),
      charId: selectedCharId || null,
    });
    el.querySelector("#dmLogMsg").value = "";
  });

  el.querySelector("#dmBtnUnclaim")?.addEventListener("click", async () => {
    if (!confirm(`Unclaim ${char.name}? This removes the access code, allowing anyone to claim it again.`)) return;
    await updateDoc(charRef(), { claimedBy: deleteField() });
    if (characters[selectedCharId]) delete characters[selectedCharId].claimedBy;
    renderLogTab(characters[selectedCharId]);
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
    const spectLabel = document.createElement("label");
    spectLabel.className = "dm-loc-spectator-label" + (locId === spectatorLocId ? " active" : "");
    spectLabel.title = "Show on spectator screen";
    const spectRadio = document.createElement("input");
    spectRadio.type      = "radio";
    spectRadio.name      = "spectatorLoc";
    spectRadio.className = "dm-loc-spectator-radio";
    spectRadio.value     = locId;
    spectRadio.checked   = locId === spectatorLocId;
    spectRadio.addEventListener("change", async () => {
      spectatorLocId = locId;
      document.querySelectorAll(".dm-loc-spectator-label").forEach(l => l.classList.remove("active"));
      spectLabel.classList.add("active");
      await setDoc(doc(db, "spectator", "config"), { locationId: locId });
    });
    const spectIcon = document.createElement("span");
    spectIcon.textContent = "📺";
    spectLabel.appendChild(spectRadio);
    spectLabel.appendChild(spectIcon);
    header.appendChild(spectLabel);

    const editBtn = document.createElement("button");
    editBtn.className = "dm-btn-edit dm-loc-edit";
    editBtn.title = "Edit location";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => {
      const editRow = document.createElement("div");
      editRow.className = "dm-loc-edit-row";
      editRow.innerHTML = `
        <input class="dm-input dm-loc-edit-emoji" value="${locData.emoji || "🗺️"}" maxlength="4" style="width:54px;flex:none" />
        <input class="dm-input dm-loc-edit-name" value="${locData.name || ""}" style="flex:1;min-width:100px" />
        <input class="dm-input dm-loc-edit-desc" value="${locData.description || ""}" placeholder="Description (optional)" style="flex:2;min-width:120px" />
        <button class="dm-btn dm-btn-heal dm-btn-sm">Save</button>
        <button class="dm-btn dm-btn-neutral dm-btn-sm">✕</button>
      `;
      const [saveBtn, cancelBtn] = editRow.querySelectorAll("button");
      cancelBtn.addEventListener("click", () => editRow.remove());
      saveBtn.addEventListener("click", async () => {
        const newName  = editRow.querySelector(".dm-loc-edit-name").value.trim();
        const newEmoji = editRow.querySelector(".dm-loc-edit-emoji").value.trim() || "🗺️";
        const newDesc  = editRow.querySelector(".dm-loc-edit-desc").value.trim();
        if (!newName) return;
        await updateDoc(doc(db, "locations", locId), { name: newName, emoji: newEmoji, description: newDesc });
        dmLog("system", "DM", `renamed location to "${newName}"`);
        editRow.remove();
      });
      col.insertBefore(editRow, col.querySelector(".dm-loc-drop-zone"));
    });
    header.appendChild(editBtn);

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
        <div class="dm-enc-size-row" id="dmEncSizeRow">
          <span class="dm-enc-size-label">Size</span>
          <input class="dm-input dm-enc-size-input" type="number" id="dmEncSizeX"
            placeholder="W" min="1" max="10" value="1" />
          <span class="dm-enc-hp-sep">×</span>
          <input class="dm-input dm-enc-size-input" type="number" id="dmEncSizeY"
            placeholder="H" min="1" max="10" value="1" />
          <span class="dm-enc-size-unit">m</span>
        </div>
      </div>
      <div class="dm-enc-list" id="dmEncList"></div>
    `;

    el.querySelectorAll(".dm-enc-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedEncType = btn.dataset.type;
        el.querySelectorAll(".dm-enc-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        el.querySelector("#dmEncSizeRow").classList.toggle("hidden", selectedEncType !== "monster");
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
  const name  = el.querySelector("#dmEncName").value.trim();
  if (!name) { el.querySelector("#dmEncName").focus(); return; }
  const hp    = parseInt(el.querySelector("#dmEncHp").value)    || 10;
  const hpMax = parseInt(el.querySelector("#dmEncHpMax").value) || hp;
  const sizeX = selectedEncType === "monster"
    ? (Math.max(1, parseInt(el.querySelector("#dmEncSizeX")?.value) || 1)) : 1;
  const sizeY = selectedEncType === "monster"
    ? (Math.max(1, parseInt(el.querySelector("#dmEncSizeY")?.value) || 1)) : 1;
  await addDoc(collection(db, "monsters"), {
    name, hp, hpMax, type: selectedEncType, sizeX, sizeY,
    createdAt: serverTimestamp(),
  });
  el.querySelector("#dmEncName").value  = "";
  el.querySelector("#dmEncHp").value    = "";
  el.querySelector("#dmEncHpMax").value = "";
  if (selectedEncType === "monster") {
    el.querySelector("#dmEncSizeX").value = "1";
    el.querySelector("#dmEncSizeY").value = "1";
  }
  el.querySelector("#dmEncName").focus();
}

function renderEncounterList() {
  const listEl = document.getElementById("dmEncList");
  if (!listEl) return;
  listEl.innerHTML = "";

  const all = Object.values(monsters).filter(m => m.type === selectedEncType);

  // Build parent → instances map (module-level so makeMonsterCard can read it)
  byParent = {};
  all.filter(m => m.parentId).forEach(m => {
    (byParent[m.parentId] = byParent[m.parentId] || []).push(m);
  });
  Object.values(byParent).forEach(arr =>
    arr.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
  );

  // Root monsters (no parentId), sorted with pinned group first
  const roots = all.filter(m => !m.parentId).sort((a, b) => {
    const aPinned = a.id === pinnedMonsterId || (byParent[a.id] || []).some(i => i.id === pinnedMonsterId);
    const bPinned = b.id === pinnedMonsterId || (byParent[b.id] || []).some(i => i.id === pinnedMonsterId);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
  });

  if (!roots.length) {
    const label = selectedEncType === "monster" ? "monsters" : "NPCs";
    listEl.innerHTML = `<div class="dm-empty">No ${label} yet.</div>`;
    return;
  }

  roots.forEach(root => {
    const instances = (byParent[root.id] || []).slice().sort((a, b) => {
      if (a.id === pinnedMonsterId) return -1;
      if (b.id === pinnedMonsterId) return 1;
      return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
    });
    listEl.appendChild(makeMonsterCard(root, false, instances.length));
    instances.forEach((inst, idx) => listEl.appendChild(makeMonsterCard(inst, true, idx + 1)));
  });
}

function makeMonsterCard(m, isInstance, instanceCountOrNum) {
  const pct      = m.hpMax ? Math.min(100, Math.max(0, Math.round((m.hp / m.hpMax) * 100))) : 100;
  const barColor = pct > 60 ? "#2ecc71" : pct > 30 ? "#c8a840" : "#c0392b";
  const hpClass  = pct <= 30 ? "low" : pct <= 60 ? "mid" : "";
  const label    = isInstance ? `${m.name} #${instanceCountOrNum}` : m.name;

  const sizeBadge = !isInstance && m.type === "monster"
    ? `<span class="dm-enc-size-badge">${m.sizeX || 1}×${m.sizeY || 1}m</span>` : "";
  const instBadge = !isInstance && instanceCountOrNum > 0
    ? `<span class="dm-enc-inst-count" title="${instanceCountOrNum} extra instance(s)">+${instanceCountOrNum}</span>` : "";
  const addInstBtn = !isInstance
    ? `<button class="dm-enc-add-inst" title="Add instance">＋</button>` : "";

  const card = document.createElement("div");
  card.className = [
    "dm-enc-card",
    m.id === pinnedMonsterId ? "dm-enc-card--pinned" : "",
    isInstance ? "dm-enc-card--instance" : "",
  ].filter(Boolean).join(" ");
  card.draggable = true;
  card.innerHTML = `
    <div class="dm-enc-card-top">
      <span class="dm-enc-name">${label}</span>
      ${sizeBadge}${instBadge}${addInstBtn}
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

  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("monsterId", m.id);
    e.dataTransfer.effectAllowed = "copy";
  });

  // Spawn new instance
  card.querySelector(".dm-enc-add-inst")?.addEventListener("click", async e => {
    e.stopPropagation();
    await addDoc(collection(db, "monsters"), {
      name: m.name, hp: m.hpMax, hpMax: m.hpMax,
      type: m.type, sizeX: m.sizeX || 1, sizeY: m.sizeY || 1,
      parentId: m.id,
      createdAt: serverTimestamp(),
    });
  });

  const mRef     = doc(db, "monsters", m.id);
  const amtInput = card.querySelector(".dm-enc-amt");

  card.querySelector(".dm-enc-dmg").addEventListener("click", async () => {
    const amt = parseInt(amtInput.value) || 0;
    if (!amt) return;
    const cur    = monsters[m.id]?.hp ?? 0;
    const newHp  = Math.max(0, cur - amt);
    await updateDoc(mRef, { hp: newHp });
    const slain  = newHp <= 0 ? " — slain!" : "";
    const encLoc = findMonsterLocId(m.id);
    const encEntry = {
      type: "damage", actor: "DM",
      message: `${label} took ${amt} damage${slain}`,
      timestamp: serverTimestamp(), charId: null,
    };
    if (encLoc) encEntry.locationId = encLoc;
    const encRef = await addDoc(collection(db, "sessionLog"), encEntry);
    translateAndUpdate(encRef, encEntry.message);
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
    const hasInsts = !isInstance && (byParent[m.id]?.length ?? 0) > 0;
    if (!confirm(`Remove "${label}"${hasInsts ? " and all its instances?" : "?"}`)) return;
    if (hasInsts) {
      await Promise.all((byParent[m.id] || []).map(i => deleteDoc(doc(db, "monsters", i.id))));
    }
    await deleteDoc(doc(db, "monsters", m.id));
  });

  return card;
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

// ── SCENES TAB ────────────────────────────────────────────

const DM_LOG_ICONS = { damage: "⚔️", heal: "💚", spell: "✨", slot: "🔮", condition: "🌀", inventory: "🎒", death: "💀", note: "📜", roll: "🎲", turn: "🔔", action: "🗣️", default: "📖" };

let dmLogLang = localStorage.getItem("dmLogLang") || "en";

function pickDmMsg(data) {
  if (dmLogLang === "hu" && data.messageHU) return data.messageHU;
  if (dmLogLang === "en" && data.messageEN) return data.messageEN;
  return data.message || "";
}

function setDmLogLang(lang) {
  dmLogLang = lang;
  localStorage.setItem("dmLogLang", lang);
  document.querySelectorAll(".dm-scene-lang-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  rerenderDmLog();
}

function buildDmLogEntry(id, data) {
  const el = document.createElement("div");
  const isTurn = data.type === "turn";
  el.className = "spec-log-entry dm-log-entry-deletable" + (isTurn ? " spec-log-entry--turn" : "");

  const delBtn = document.createElement("button");
  delBtn.className = "dm-log-del-btn";
  delBtn.title = "Delete entry";
  delBtn.textContent = "✕";
  delBtn.addEventListener("click", async () => {
    if (!confirm("Delete this log entry?")) return;
    try { await deleteDoc(doc(db, "sessionLog", id)); } catch (e) { console.error("Delete failed:", e); }
  });

  if (isTurn) {
    el.innerHTML = `<div class="spec-log-turn-inner">
         <span class="spec-log-turn-label">DM</span>
         <span class="spec-log-turn-text">${pickDmMsg(data)}</span>
       </div>`;
  } else {
    el.innerHTML = `<span class="spec-log-icon">${DM_LOG_ICONS[data.type] || DM_LOG_ICONS.default}</span>
       <div class="spec-log-content">
         <span class="spec-log-actor">${data.actor || "?"}</span>
         <span class="spec-log-msg">${pickDmMsg(data)}</span>
       </div>`;
  }
  el.appendChild(delBtn);
  return el;
}

function rerenderDmLog() {
  const feed = document.getElementById("dmSceneLogFeed");
  if (!feed) return;
  const locId = selectedSceneLocId;
  const charIds = Object.values(characters)
    .filter(c => c.locationId === locId)
    .map(c => c.id);

  const visible = Object.entries(dmLogEntries)
    .filter(([, e]) => {
      const d = e.data;
      if (d.locationId) return d.locationId === locId;
      if (d.charId) return charIds.includes(d.charId);
      return false;
    })
    .sort(([, a], [, b]) => {
      const ta = a.data.timestamp?.seconds ?? Number.MAX_SAFE_INTEGER;
      const tb = b.data.timestamp?.seconds ?? Number.MAX_SAFE_INTEGER;
      return tb - ta;
    });

  feed.innerHTML = "";
  if (!visible.length) {
    feed.innerHTML = `<div class="spec-log-empty">No events for this location yet…</div>`;
    return;
  }
  // Rebuild from data each time so lang changes are reflected immediately
  visible.forEach(([id, e]) => feed.appendChild(buildDmLogEntry(id, e.data)));
}

function renderScenesTab() {
  const el = document.getElementById("dm-tab-scenes");
  const sortedLocs = Object.values(locations).sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!sortedLocs.length) {
    el.innerHTML = `<div class="dm-no-char">No locations yet — create locations first.</div>`;
    return;
  }

  // Default to first location, or keep existing selection if still valid
  if (!selectedSceneLocId || !locations[selectedSceneLocId]) {
    selectedSceneLocId = sortedLocs[0].id;
  }

  el.innerHTML = `
    <div class="dm-scenes-layout">
      <div class="dm-scenes-main">
        <div class="dm-scene-loc-selector">
          <span class="dm-scene-loc-label">Location</span>
          <select class="dm-input dm-scene-loc-select" id="sceneLocSelect">
            ${sortedLocs.map(l =>
              `<option value="${l.id}"${l.id === selectedSceneLocId ? " selected" : ""}>${l.emoji || "🗺️"} ${l.name}</option>`
            ).join("")}
          </select>
        </div>
        <div id="dmScenePanelsWrap"></div>
      </div>
      <div class="dm-scenes-log spec-log-col">
        <div class="spec-log-header">
          <span>📜 Location Log</span>
          <div class="spec-lang-toggle">
            <button class="dm-scene-lang-btn spec-lang-btn${dmLogLang === "en" ? " active" : ""}" data-lang="en">EN</button>
            <button class="dm-scene-lang-btn spec-lang-btn${dmLogLang === "hu" ? " active" : ""}" data-lang="hu">HU</button>
          </div>
        </div>
        <div class="spec-log-feed" id="dmSceneLogFeed"></div>
      </div>
    </div>
  `;

  el.querySelector("#sceneLocSelect").addEventListener("change", e => {
    selectedSceneLocId = e.target.value;
    renderScenePanels();
    renderCharList();
    rerenderDmLog();
  });

  el.querySelectorAll(".dm-scene-lang-btn").forEach(btn => {
    btn.addEventListener("click", () => setDmLogLang(btn.dataset.lang));
  });

  renderScenePanels();
  rerenderDmLog();
}

function renderScenePanels() {
  const wrap = document.getElementById("dmScenePanelsWrap");
  if (!wrap || !selectedSceneLocId) return;
  const loc = locations[selectedSceneLocId];
  if (!loc) return;

  const sceneDoc = scenes[selectedSceneLocId] || {};
  wrap.innerHTML = "";

  const panels = document.createElement("div");
  panels.className = "dm-scene-panels";

  const curPanel  = document.createElement("div");
  curPanel.className = "dm-scene-panel";
  const nextPanel = document.createElement("div");
  nextPanel.className = "dm-scene-panel";

  buildScenePanel(curPanel,  loc.id, "current", sceneDoc.current || null);
  buildScenePanel(nextPanel, loc.id, "next",    sceneDoc.next    || null);

  panels.appendChild(curPanel);
  panels.appendChild(nextPanel);
  wrap.appendChild(panels);
}

function buildScenePanel(container, locId, sceneKey, sceneData) {
  const labelText = sceneKey === "current" ? "Current Scene" : "Next Scene";
  const icon      = sceneKey === "current" ? "⚔️" : "🔮";
  const hasImage  = !!sceneData?.image;
  const uid       = `${locId}-${sceneKey}`;

  container.innerHTML = `
    <div class="dm-scene-panel-header">
      <span class="dm-scene-panel-title">${icon} ${labelText}</span>
      ${hasImage && sceneKey === "current" ? `<button class="dm-btn dm-btn-neutral dm-btn-sm dm-scene-copy-btn" title="Copy map to Next Scene (tokens start fresh)">📋 Copy to Next</button>` : ""}
      ${hasImage && sceneKey === "next" ? `<button class="dm-btn dm-btn-heal dm-btn-sm dm-scene-golive-btn" title="Make this the current scene">▶ Go Live</button>` : ""}
      ${hasImage ? `<button class="dm-btn-del dm-scene-clear-btn" title="Remove scene image">✕</button>` : ""}
    </div>
    ${hasImage ? `
      <div class="dm-scene-map-wrap">
        <img class="dm-scene-img" src="${sceneData.image}" alt="Scene map" id="sceneImg-${uid}" />
        <canvas class="dm-scene-grid-canvas" id="sceneCanvas-${uid}"></canvas>
        <div class="dm-scene-token-layer" id="sceneTokens-${uid}"></div>
      </div>
      <div class="dm-scene-scale-row">
        <label class="dm-scene-scale-label">Width (m):</label>
        <input class="dm-input dm-scene-scale-input" type="number" min="1" max="500" step="1"
          id="scaleInput-${uid}" value="${sceneData.widthM || 20}" />
        <span class="dm-scene-height-display" id="heightDisplay-${uid}">
          × ${sceneData.heightM ? Math.round(sceneData.heightM) + " m" : "? m"}
        </span>
        <button class="dm-btn dm-btn-neutral dm-btn-sm" id="scaleApply-${uid}">Apply</button>
      </div>
    ` : `
      <div class="dm-scene-upload-area" id="uploadArea-${uid}">
        <span class="dm-scene-upload-icon">🗺️</span>
        <span class="dm-scene-upload-hint">Drop image here or choose a file</span>
        <input type="file" class="dm-scene-file-input" accept="image/*" id="fileInput-${uid}" />
        <label class="dm-btn dm-btn-neutral dm-btn-sm dm-scene-upload-btn"
          for="fileInput-${uid}">Choose Image</label>
      </div>
      <div class="dm-scene-scale-row">
        <label class="dm-scene-scale-label">Width (m):</label>
        <input class="dm-input dm-scene-scale-input" type="number" min="1" max="500" step="1"
          id="scaleInput-${uid}" value="20" />
        <span class="dm-scene-height-display" id="heightDisplay-${uid}">× ? m</span>
      </div>
    `}
  `;

  if (hasImage) {
    const img       = container.querySelector(`#sceneImg-${uid}`);
    const canvas    = container.querySelector(`#sceneCanvas-${uid}`);
    const tokenLayer = container.querySelector(`#sceneTokens-${uid}`);
    const widthM    = sceneData.widthM || 20;

    const initScene = () => {
      const natW   = img.naturalWidth;
      const natH   = img.naturalHeight;
      const heightM = widthM * (natH / natW);
      const hd = container.querySelector(`#heightDisplay-${uid}`);
      if (hd) hd.textContent = `× ${Math.round(heightM)} m`;
      drawGrid(canvas, natW, natH, widthM);
      renderTokens(tokenLayer, widthM, heightM, sceneData.tokens || [], locId, sceneKey);
      setupTokenDropZone(tokenLayer, widthM, heightM, locId, sceneKey);
    };

    if (img.complete && img.naturalWidth > 0) initScene();
    else img.onload = initScene;

    container.querySelector(`#scaleApply-${uid}`).addEventListener("click", async () => {
      const newWidthM = Math.max(1, parseFloat(container.querySelector(`#scaleInput-${uid}`).value) || 20);
      if (!img.complete || !img.naturalWidth) return;
      const natW    = img.naturalWidth;
      const natH    = img.naturalHeight;
      const newHeightM = newWidthM * (natH / natW);
      const hd = container.querySelector(`#heightDisplay-${uid}`);
      if (hd) hd.textContent = `× ${Math.round(newHeightM)} m`;
      drawGrid(canvas, natW, natH, newWidthM);
      const cur = scenes[locId]?.[sceneKey] || sceneData;
      await saveScene(locId, sceneKey, { ...cur, widthM: newWidthM, heightM: newHeightM });
    });

    container.querySelector(".dm-scene-clear-btn")?.addEventListener("click", async () => {
      if (!confirm("Remove this scene image and all its tokens?")) return;
      await saveScene(locId, sceneKey, null);
    });

    container.querySelector(".dm-scene-golive-btn")?.addEventListener("click", async () => {
      const nextData = { ...(scenes[locId]?.next || sceneData) };
      await updateDoc(doc(db, "scenes", locId), {
        current: nextData,
        next: deleteField(),
      });
      const lName = locationLabel(locId) || "a location";
      notifyPlayers(locId, "🏞️ New scene", `The scene at ${lName} has changed`);
      notifyDM("🏞️ Scene went live", `Current scene updated at ${lName}`);
    });

    container.querySelector(".dm-scene-copy-btn")?.addEventListener("click", async () => {
      const cur = scenes[locId]?.current || sceneData;
      if (!cur?.image) return;
      if (scenes[locId]?.next?.image) {
        if (!confirm("Next Scene already has a map. Overwrite it?")) return;
      }
      await saveScene(locId, "next", { image: cur.image, widthM: cur.widthM || 20, heightM: cur.heightM || 20, tokens: [...(cur.tokens || [])] });
    });

  } else {
    const fileInput  = container.querySelector(`#fileInput-${uid}`);
    const uploadArea = container.querySelector(`#uploadArea-${uid}`);

    fileInput?.addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) handleSceneImageUpload(file, locId, sceneKey, container, uid);
    });

    uploadArea?.addEventListener("dragover", e => {
      e.preventDefault();
      uploadArea.classList.add("drag-over");
    });
    uploadArea?.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over"));
    uploadArea?.addEventListener("drop", e => {
      e.preventDefault();
      uploadArea.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleSceneImageUpload(file, locId, sceneKey, container, uid);
    });
  }
}

function drawGrid(canvas, natW, natH, widthM) {
  canvas.width  = natW;
  canvas.height = natH;
  const ctx     = canvas.getContext("2d");
  ctx.clearRect(0, 0, natW, natH);
  const cellPx  = natW / widthM;
  const cols    = Math.ceil(widthM);
  const rows    = Math.ceil(natH / cellPx);
  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.lineWidth   = Math.max(1, natW / 2400);
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath(); ctx.moveTo(i * cellPx, 0); ctx.lineTo(i * cellPx, natH); ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    ctx.beginPath(); ctx.moveTo(0, j * cellPx); ctx.lineTo(natW, j * cellPx); ctx.stroke();
  }
}

function clearMoveMode() {
  movingToken = null;
  document.querySelectorAll(".dm-scene-token--moving").forEach(el => el.classList.remove("dm-scene-token--moving"));
  document.querySelectorAll(".dm-scene-token-layer.move-mode").forEach(el => el.classList.remove("move-mode"));
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && movingToken) clearMoveMode(); });

function renderTokens(tokenLayer, widthM, heightM, tokens, locId, sceneKey) {
  tokenLayer.innerHTML = "";
  const cols = Math.ceil(widthM);
  const rows = Math.ceil(heightM);
  const wPct = (1 / cols) * 100;
  const hPct = (1 / rows) * 100;

  tokens.forEach(token => {
    let div;

    if (token.charId) {
      const char = characters[token.charId];
      if (!char) return;
      const pct       = char.hpMax ? Math.round(((char.hp ?? 0) / char.hpMax) * 100) : 100;
      const ringColor = pct > 60 ? "#2ecc71" : pct > 30 ? "#c8a840" : "#c0392b";
      const icon = char.emoji || "⚔️";

      div = document.createElement("div");
      div.className    = "dm-scene-token";
      div.style.left   = `${(token.x / cols) * 100}%`;
      div.style.top    = `${(token.y / rows) * 100}%`;
      div.style.width  = `${wPct}%`;
      div.style.height = `${hPct}%`;
      div.innerHTML = `
        <div class="dm-scene-token-bubble">
          <span class="dm-scene-bubble-emoji">${icon}</span>
          <span class="dm-scene-bubble-name">${char.name || "?"}</span>
        </div>
        <div class="dm-scene-token-marker" style="border-color:${ringColor}">
          <span class="dm-scene-marker-emoji">${icon}</span>
        </div>
        <button class="dm-scene-token-remove" title="Remove">✕</button>
      `;
      div.querySelector(".dm-scene-token-remove").addEventListener("click", async e => {
        e.stopPropagation();
        if (movingToken?.token.charId === token.charId) clearMoveMode();
        const cur = scenes[locId]?.[sceneKey];
        if (!cur) return;
        await saveScene(locId, sceneKey, {
          ...cur,
          tokens: (cur.tokens || []).filter(
            t => !(t.charId === token.charId && t.x === token.x && t.y === token.y)
          ),
        });
      });
      div.querySelector(".dm-scene-token-bubble").addEventListener("click", e => {
        e.stopPropagation();
        if (movingToken?.locId === locId && movingToken?.sceneKey === sceneKey &&
            movingToken?.token.charId === token.charId) {
          clearMoveMode();
        } else {
          clearMoveMode();
          movingToken = { locId, sceneKey, token };
          div.classList.add("dm-scene-token--moving");
          tokenLayer.classList.add("move-mode");
        }
      });
      if (movingToken?.locId === locId && movingToken?.sceneKey === sceneKey &&
          movingToken?.token.charId === token.charId) {
        div.classList.add("dm-scene-token--moving");
      }

    } else if (token.monsterId) {
      const m = monsters[token.monsterId];
      if (!m) return;
      const sizeX     = token.sizeX || 1;
      const sizeY     = token.sizeY || 1;
      const pct       = m.hpMax ? Math.round(((m.hp ?? 0) / m.hpMax) * 100) : 100;
      const ringColor = pct > 60 ? "#2ecc71" : pct > 30 ? "#c8a840" : "#c0392b";
      const icon      = m.type === "npc" ? "👤" : "💀";

      div = document.createElement("div");
      div.className          = "dm-scene-token" + ((m.hp ?? 0) <= 0 ? " dm-scene-token--dead" : "");
      div.dataset.monsterId  = token.monsterId;
      div.style.left         = `${(token.x / cols) * 100}%`;
      div.style.top          = `${(token.y / rows) * 100}%`;
      div.style.width        = `${(sizeX / cols) * 100}%`;
      div.style.height       = `${(sizeY / rows) * 100}%`;
      div.innerHTML = `
        <div class="dm-scene-token-bubble">
          <span class="dm-scene-bubble-emoji">${icon}</span>
          <span class="dm-scene-bubble-name">${m.name || "?"}</span>
        </div>
        <div class="dm-scene-token-marker dm-scene-token-marker--enc" style="border-color:${ringColor}">
          <span class="dm-scene-marker-emoji">${icon}</span>
        </div>
        <div class="scene-token-dead-x">✕</div>
        <button class="dm-scene-token-remove" title="Remove">✕</button>
      `;
      div.querySelector(".dm-scene-token-remove").addEventListener("click", async e => {
        e.stopPropagation();
        if (movingToken?.token.monsterId === token.monsterId) clearMoveMode();
        const cur = scenes[locId]?.[sceneKey];
        if (!cur) return;
        await saveScene(locId, sceneKey, {
          ...cur,
          tokens: (cur.tokens || []).filter(
            t => !(t.monsterId === token.monsterId && t.x === token.x && t.y === token.y)
          ),
        });
      });
      div.querySelector(".dm-scene-token-bubble").addEventListener("click", e => {
        e.stopPropagation();
        // Pin monster in encounter sidebar on every bubble click
        const mType = m.type === "npc" ? "npc" : "monster";
        if (selectedEncType !== mType) {
          selectedEncType = mType;
          document.querySelectorAll(".dm-enc-filter-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.type === selectedEncType);
          });
        }
        pinnedMonsterId = token.monsterId;
        renderEncounterList();
        document.getElementById("dmEncList")?.scrollTo({ top: 0, behavior: "smooth" });
        // Move mode toggle
        if (movingToken?.locId === locId && movingToken?.sceneKey === sceneKey &&
            movingToken?.token.monsterId === token.monsterId) {
          clearMoveMode();
        } else {
          clearMoveMode();
          movingToken = { locId, sceneKey, token };
          div.classList.add("dm-scene-token--moving");
          tokenLayer.classList.add("move-mode");
        }
      });
      div.querySelector(".dm-scene-token-marker").addEventListener("click", e => {
        e.stopPropagation();
        const mType = m.type === "npc" ? "npc" : "monster";
        if (selectedEncType !== mType) {
          selectedEncType = mType;
          document.querySelectorAll(".dm-enc-filter-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.type === selectedEncType);
          });
        }
        pinnedMonsterId = token.monsterId;
        renderEncounterList();
        document.getElementById("dmEncList")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      if (movingToken?.locId === locId && movingToken?.sceneKey === sceneKey &&
          movingToken?.token.monsterId === token.monsterId) {
        div.classList.add("dm-scene-token--moving");
      }
    } else {
      return;
    }

    tokenLayer.appendChild(div);
  });

  if (movingToken?.locId === locId && movingToken?.sceneKey === sceneKey) {
    tokenLayer.classList.add("move-mode");
  }
}

function setupTokenDropZone(tokenLayer, widthM, heightM, locId, sceneKey) {
  const cols = Math.ceil(widthM);
  const rows = Math.ceil(heightM);

  tokenLayer.addEventListener("click", async e => {
    if (!movingToken || movingToken.locId !== locId || movingToken.sceneKey !== sceneKey) return;
    const rect = tokenLayer.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top)  / rect.height;
    const { token: mToken } = movingToken;
    const cur = scenes[locId]?.[sceneKey];
    if (!cur) { clearMoveMode(); return; }
    clearMoveMode();
    if (mToken.charId) {
      const x = Math.max(0, Math.min(cols - 1, Math.floor(relX * cols)));
      const y = Math.max(0, Math.min(rows - 1, Math.floor(relY * rows)));
      const existing = (cur.tokens || []).filter(t => t.charId !== mToken.charId);
      await saveScene(locId, sceneKey, { ...cur, tokens: [...existing, { charId: mToken.charId, x, y }] });
    } else if (mToken.monsterId) {
      const sizeX = mToken.sizeX || 1;
      const sizeY = mToken.sizeY || 1;
      const x = Math.max(0, Math.min(cols - sizeX, Math.floor(relX * cols)));
      const y = Math.max(0, Math.min(rows - sizeY, Math.floor(relY * rows)));
      const existing = (cur.tokens || []).filter(t => t.monsterId !== mToken.monsterId);
      await saveScene(locId, sceneKey, { ...cur, tokens: [...existing, { monsterId: mToken.monsterId, x, y, sizeX, sizeY }] });
    }
  });

  tokenLayer.addEventListener("dragover", e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    tokenLayer.classList.add("drag-over");
  });
  tokenLayer.addEventListener("dragleave", e => {
    if (!tokenLayer.contains(e.relatedTarget)) tokenLayer.classList.remove("drag-over");
  });
  tokenLayer.addEventListener("drop", async e => {
    e.preventDefault();
    tokenLayer.classList.remove("drag-over");
    const charId    = e.dataTransfer.getData("charId");
    const monsterId = e.dataTransfer.getData("monsterId");
    if (!charId && !monsterId) return;

    const rect = tokenLayer.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top)  / rect.height;
    const cur  = scenes[locId]?.[sceneKey];
    if (!cur) return;

    if (charId) {
      const x = Math.max(0, Math.min(cols - 1, Math.floor(relX * cols)));
      const y = Math.max(0, Math.min(rows - 1, Math.floor(relY * rows)));
      const existing = (cur.tokens || []).filter(t => t.charId !== charId);
      await saveScene(locId, sceneKey, { ...cur, tokens: [...existing, { charId, x, y }] });
    } else {
      const m     = monsters[monsterId];
      const sizeX = m?.sizeX || 1;
      const sizeY = m?.sizeY || 1;
      const x = Math.max(0, Math.min(cols - sizeX, Math.floor(relX * cols)));
      const y = Math.max(0, Math.min(rows - sizeY, Math.floor(relY * rows)));
      const existing = (cur.tokens || []).filter(t => t.monsterId !== monsterId);
      await saveScene(locId, sceneKey, { ...cur, tokens: [...existing, { monsterId, x, y, sizeX, sizeY }] });
    }
  });
}

async function saveScene(locId, sceneKey, data) {
  await setDoc(doc(db, "scenes", locId), { [sceneKey]: data ?? null }, { merge: true });
  // Notify DM whenever any scene slot changes (image upload, token placed, scale changed, etc.)
  if (data !== null) {
    const lName = locationLabel(locId) || "a location";
    const what  = sceneKey === "current" ? "Current" : "Next";
    notifyDM("🗺️ Scene updated", `${what} scene changed at ${lName}`);
  }
}

async function handleSceneImageUpload(file, locId, sceneKey, container, uid) {
  const widthM = Math.max(1, parseFloat(container.querySelector(`#scaleInput-${uid}`)?.value) || 20);
  const uploadArea = container.querySelector(`#uploadArea-${uid}`);
  if (uploadArea) uploadArea.innerHTML = `<span class="dm-scene-upload-hint">Processing…</span>`;

  const reader = new FileReader();
  reader.onload = async ev => {
    const img = new Image();
    img.onload = async () => {
      const MAX = 1200;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round((h / w) * MAX); w = MAX; }
        else        { w = Math.round((w / h) * MAX); h = MAX; }
      }
      const cvs = document.createElement("canvas");
      cvs.width = w; cvs.height = h;
      cvs.getContext("2d").drawImage(img, 0, 0, w, h);
      const base64  = cvs.toDataURL("image/jpeg", 0.65);
      const heightM = widthM * (img.naturalHeight / img.naturalWidth);
      await saveScene(locId, sceneKey, { image: base64, widthM, heightM, tokens: [] });
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
