import { db } from "./firebase-config.js";
import {
  collection, doc, onSnapshot, orderBy, query, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ── State ─────────────────────────────────────────────────
let activeLocId  = null;
let allChars     = {};   // charId → data
let charToLocId  = {};   // charId → locationId
let allLocations = {};   // locId → data
let allMonsters  = {};   // monsterId → data
let allEntries   = {};   // entryId → { el, data }
let sceneData    = null;

let _renderSeq   = 0;
let unsubScene   = null;

// ── Firestore ─────────────────────────────────────────────

// Characters
onSnapshot(collection(db, "characters"), snap => {
  snap.docChanges().forEach(change => {
    const id = change.doc.id;
    if (change.type === "removed") { delete allChars[id]; delete charToLocId[id]; }
    else {
      allChars[id]    = { id, ...change.doc.data() };
      charToLocId[id] = change.doc.data().locationId ?? null;
    }
  });
  renderScene();
  rerenderLog();
});

// Locations
onSnapshot(query(collection(db, "locations"), orderBy("order")), snap => {
  snap.docChanges().forEach(change => {
    const id = change.doc.id;
    if (change.type === "removed") delete allLocations[id];
    else allLocations[id] = { id, ...change.doc.data() };
  });
  updateHeader();
});

// Monsters
onSnapshot(collection(db, "monsters"), snap => {
  snap.docChanges().forEach(change => {
    const id = change.doc.id;
    if (change.type === "removed") delete allMonsters[id];
    else allMonsters[id] = { id, ...change.doc.data() };
  });
  // Live-update dead state on scene tokens
  document.querySelectorAll(".spec-token[data-monster-id]").forEach(el => {
    const m = allMonsters[el.dataset.monsterId];
    if (m) el.classList.toggle("spec-token--dead", (m.hp ?? 0) <= 0);
  });
  rerenderLog();
});

// Session log
onSnapshot(
  query(collection(db, "sessionLog"), orderBy("timestamp", "desc"), limit(60)),
  snap => {
    snap.docChanges().forEach(change => {
      const id   = change.doc.id;
      const data = change.doc.data();
      if (change.type === "removed") delete allEntries[id];
      else allEntries[id] = { el: buildLogEntry(data), data };
    });
    rerenderLog();
  }
);

// Spectator config — controls which location is shown
onSnapshot(doc(db, "spectator", "config"), snap => {
  const locId = snap.data()?.locationId ?? null;
  if (locId === activeLocId) return;
  activeLocId = locId;
  updateHeader();
  subscribeScene();
  rerenderLog();
});

// ── Scene subscription ────────────────────────────────────

function subscribeScene() {
  if (unsubScene) { unsubScene(); unsubScene = null; }
  sceneData = null;
  renderScene();
  if (!activeLocId) return;

  unsubScene = onSnapshot(doc(db, "scenes", activeLocId), snap => {
    sceneData = snap.data()?.current ?? null;
    renderScene();
  });
}

// ── Scene rendering ───────────────────────────────────────

function drawGrid(canvas, natW, natH, widthM) {
  canvas.width  = natW;
  canvas.height = natH;
  const ctx     = canvas.getContext("2d");
  const cols    = Math.ceil(widthM);
  const heightM = (natH / natW) * widthM;
  const rows    = Math.ceil(heightM);
  const cellW   = natW / cols;
  const cellH   = natH / rows;
  ctx.clearRect(0, 0, natW, natH);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth   = 1;
  for (let x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x * cellW, 0); ctx.lineTo(x * cellW, natH); ctx.stroke(); }
  for (let y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * cellH); ctx.lineTo(natW, y * cellH); ctx.stroke(); }
}

function renderTokensOnLayer(tokenLayer, widthM, heightM, tokens) {
  tokenLayer.innerHTML = "";
  const cols = Math.ceil(widthM);
  const rows = Math.ceil(heightM);

  tokens.forEach(token => {
    if (token.charId) {
      const char = allChars[token.charId];
      if (!char) return;
      const pct  = char.hpMax ? Math.min(100, Math.max(0, (char.hp / char.hpMax) * 100)) : 100;
      const ring = pct > 60 ? "#2ecc71" : pct > 30 ? "#c8a840" : "#c0392b";
      const portrait = char.portrait || null;
      const fallback = char.emoji || "⚔️";

      const div = document.createElement("div");
      div.className = "spec-token";
      div.style.left   = `${(token.x / cols) * 100}%`;
      div.style.top    = `${(token.y / rows) * 100}%`;
      div.style.width  = `${(1 / cols) * 100}%`;
      div.style.height = `${(1 / rows) * 100}%`;
      div.innerHTML = `
        <div class="spec-token-bubble">
          ${portrait ? `<img src="${portrait}" class="spec-bubble-img" alt="${char.name}" />` : `<span class="spec-bubble-emoji">${fallback}</span>`}
          <span class="spec-bubble-name">${char.name || "?"}</span>
        </div>
        <div class="spec-token-marker" style="border-color:${ring}">
          ${portrait ? `<img src="${portrait}" class="spec-marker-img" alt="" />` : `<span class="spec-marker-emoji">${fallback}</span>`}
        </div>`;
      tokenLayer.appendChild(div);

    } else if (token.monsterId) {
      const m = allMonsters[token.monsterId];
      if (!m) return;
      const sizeX  = token.sizeX || 1;
      const sizeY  = token.sizeY || 1;
      const pct    = m.hpMax ? Math.min(100, Math.max(0, (m.hp / m.hpMax) * 100)) : 100;
      const ring   = pct > 60 ? "#2ecc71" : pct > 30 ? "#c8a840" : "#c0392b";
      const icon   = m.type === "npc" ? "👤" : "💀";
      const isDead = (m.hp ?? 0) <= 0;

      const div = document.createElement("div");
      div.className          = "spec-token" + (isDead ? " spec-token--dead" : "");
      div.dataset.monsterId  = token.monsterId;
      div.style.left         = `${(token.x / cols) * 100}%`;
      div.style.top          = `${(token.y / rows) * 100}%`;
      div.style.width        = `${(sizeX / cols) * 100}%`;
      div.style.height       = `${(sizeY / rows) * 100}%`;
      div.innerHTML = `
        <div class="spec-token-bubble">
          <span class="spec-bubble-emoji">${icon}</span>
          <span class="spec-bubble-name">${m.name || "?"}</span>
        </div>
        <div class="spec-token-marker spec-token-marker--enc" style="border-color:${ring}">
          <span class="spec-marker-emoji">${icon}</span>
        </div>
        <div class="spec-dead-x">✕</div>`;
      tokenLayer.appendChild(div);
    }
  });
}

function renderScene() {
  _renderSeq++;
  const seq  = _renderSeq;
  const wrap = document.getElementById("specSceneWrap");
  if (!wrap) return;

  if (!sceneData?.image) {
    wrap.innerHTML = `<div class="spec-no-scene">${activeLocId ? "No scene loaded for this location" : "Waiting for DM to select a location…"}</div>`;
    return;
  }

  const widthM  = sceneData.widthM  || 20;
  const heightM = sceneData.heightM || 15;
  const tokens  = sceneData.tokens  || [];

  const mapWrap       = document.createElement("div");
  mapWrap.className   = "spec-map-wrap";
  const img           = document.createElement("img");
  img.className       = "spec-map-img";
  img.alt             = "Scene map";
  const canvas        = document.createElement("canvas");
  canvas.className    = "spec-grid-canvas";
  const tokenLayer    = document.createElement("div");
  tokenLayer.className = "spec-token-layer";
  mapWrap.append(img, canvas, tokenLayer);
  wrap.innerHTML = "";
  wrap.appendChild(mapWrap);

  const onReady = () => {
    if (seq !== _renderSeq) return;
    const natW  = img.naturalWidth;
    const natH  = img.naturalHeight;
    const contW = wrap.offsetWidth;
    const contH = wrap.offsetHeight;
    const scale = Math.min(contW / natW, contH / natH);
    const dW    = natW * scale;
    const dH    = natH * scale;
    const oX    = (contW - dW) / 2;
    const oY    = (contH - dH) / 2;
    for (const el of [canvas, tokenLayer]) {
      el.style.left   = `${oX}px`;
      el.style.top    = `${oY}px`;
      el.style.width  = `${dW}px`;
      el.style.height = `${dH}px`;
    }
    drawGrid(canvas, natW, natH, widthM);
    renderTokensOnLayer(tokenLayer, widthM, heightM, tokens);
  };

  img.src = sceneData.image;
  if (img.complete && img.naturalWidth) onReady();
  else img.addEventListener("load", onReady);
}

// ── Log rendering ─────────────────────────────────────────

const LOG_ICONS = { damage: "⚔️", heal: "💚", spell: "✨", slot: "🔮", condition: "🌀", inventory: "🎒", death: "💀", note: "📜", roll: "🎲", turn: "🔔", default: "📖" };

function buildLogEntry(data) {
  const el = document.createElement("div");
  const isTurn = data.type === "turn";
  el.className = "spec-log-entry" + (isTurn ? " spec-log-entry--turn" : "");
  el.innerHTML = isTurn
    ? `<div class="spec-log-turn-inner">
         <span class="spec-log-turn-label">DM</span>
         <span class="spec-log-turn-text">${data.message || ""}</span>
       </div>`
    : `<span class="spec-log-icon">${LOG_ICONS[data.type] || LOG_ICONS.default}</span>
       <div class="spec-log-content">
         <span class="spec-log-actor">${data.actor || "?"}</span>
         <span class="spec-log-msg">${data.message || ""}</span>
       </div>`;
  return el;
}

function isVisible(data) {
  if (!activeLocId) return false;
  if (data.locationId) return data.locationId === activeLocId;
  if (!data.charId) return false;
  return charToLocId[data.charId] === activeLocId;
}

function rerenderLog() {
  const feed = document.getElementById("specLogFeed");
  if (!feed) return;

  const visible = Object.values(allEntries)
    .filter(e => isVisible(e.data))
    .sort((a, b) => {
      const ta = a.data.timestamp?.seconds ?? Number.MAX_SAFE_INTEGER;
      const tb = b.data.timestamp?.seconds ?? Number.MAX_SAFE_INTEGER;
      return tb - ta;
    });

  feed.innerHTML = "";
  if (!visible.length) {
    feed.innerHTML = `<div class="spec-log-empty">No events for this location yet…</div>`;
    return;
  }
  visible.forEach(e => feed.appendChild(e.el));
}

// ── Header ────────────────────────────────────────────────

function updateHeader() {
  const el  = document.getElementById("specLocationName");
  if (!el) return;
  const loc = allLocations[activeLocId];
  el.textContent = loc ? `${loc.emoji || "🗺️"} ${loc.name}` : "Awaiting location…";
}
