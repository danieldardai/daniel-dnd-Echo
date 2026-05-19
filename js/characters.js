import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const grid      = document.getElementById("characterGrid");
const loadingEl = document.getElementById("loadingState");
const emptyEl   = document.getElementById("emptyState");
const errorEl   = document.getElementById("errorState");
const errorMsg  = document.getElementById("errorMessage");

const cardMap = {};

function hpPercent(data) {
  const cur = data.hp ?? 0;
  const max = data.hpMax ?? cur;
  if (!max) return 100;
  return Math.min(100, Math.max(0, Math.round((cur / max) * 100)));
}

function hpColor(pct) {
  if (pct > 60) return "var(--hp-green)";
  if (pct > 30) return "var(--hp-amber)";
  return "var(--hp-red)";
}

function conditionPips(data) {
  const conds = data.conditions;
  if (!conds || !Object.keys(conds).length) return "";
  const active = Object.entries(conds).filter(([, v]) => v).map(([k]) => k);
  if (!active.length) return "";
  return `<div class="card-conditions">${active.map(c =>
    `<span class="condition-pip">${c}</span>`
  ).join("")}</div>`;
}

function buildCard(id, data) {
  const pct = hpPercent(data);
  const cur = data.hp ?? "?";
  const max = data.hpMax ?? "?";

  const card = document.createElement("article");
  card.className = "character-card";
  card.setAttribute("data-id", id);

  const portraitHTML = data.portrait
    ? `<img src="${data.portrait}" alt="Portrait of ${data.name}" loading="lazy" />`
    : `<div class="card-portrait-placeholder">${data.emoji || "⚔️"}</div>`;

  card.innerHTML = `
    <a class="card-link" href="character.html?id=${id}" aria-label="Open ${data.name}'s sheet">
      <div class="card-hp-bar-wrap" style="position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(0,0,0,0.3);">
        <div class="card-hp-bar" style="height:100%;width:${pct}%;background:${hpColor(pct)};transition:width 0.5s ease;"></div>
      </div>
      ${data.taken ? `<span class="card-taken-badge" title="Character taken">⚔️</span>` : ""}
      <span class="card-emoji">${data.emoji || "⚔️"}</span>
      <h2 class="card-name">${data.name}</h2>
      <div class="card-hp-label">HP <strong>${cur}</strong> / ${max}</div>
      ${conditionPips(data)}
    </a>
  `;
  return card;
}

function updateCard(id, data) {
  const card = cardMap[id];
  if (!card) return;
  const pct = hpPercent(data);
  const cur = data.hp ?? "?";
  const max = data.hpMax ?? "?";

  const bar = card.querySelector(".card-hp-bar");
  if (bar) { bar.style.width = `${pct}%`; bar.style.background = hpColor(pct); }

  const label = card.querySelector(".card-hp-label");
  if (label) label.innerHTML = `HP <strong>${cur}</strong> / ${max}`;

  const condEl = card.querySelector(".card-conditions");
  const pip = conditionPips(data);
  if (condEl) condEl.remove();
  if (pip) {
    const link = card.querySelector(".card-link");
    link.insertAdjacentHTML("beforeend", pip);
  }

  const existingBadge = card.querySelector(".card-taken-badge");
  if (data.taken && !existingBadge) {
    const badge = document.createElement("span");
    badge.className = "card-taken-badge";
    badge.title = "Character taken";
    badge.textContent = "⚔️";
    card.querySelector(".card-link").prepend(badge);
  } else if (!data.taken && existingBadge) {
    existingBadge.remove();
  }
}

const q = query(collection(db, "characters"), orderBy("name"));

onSnapshot(q, (snapshot) => {
  loadingEl.classList.add("hidden");
  if (snapshot.empty) { emptyEl.classList.remove("hidden"); return; }
  emptyEl.classList.add("hidden");

  snapshot.docChanges().forEach((change) => {
    const id   = change.doc.id;
    const data = change.doc.data();
    if (change.type === "added")         { const c = buildCard(id, data); cardMap[id] = c; grid.appendChild(c); }
    else if (change.type === "modified") { updateCard(id, data); }
    else if (change.type === "removed")  { cardMap[id]?.remove(); delete cardMap[id]; }
  });
}, (err) => {
  loadingEl.classList.add("hidden");
  errorEl.classList.remove("hidden");
  errorMsg.textContent = `Could not reach the realm… (${err.message})`;
  console.error("Firestore error:", err);
});
