import { db } from "./firebase-config.js";
import {
  collection, doc, onSnapshot, orderBy, query, setDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const grid      = document.getElementById("characterGrid");
const loadingEl = document.getElementById("loadingState");
const emptyEl   = document.getElementById("emptyState");
const errorEl   = document.getElementById("errorState");
const errorMsg  = document.getElementById("errorMessage");

let charData       = {};
let locationData   = {};
let cardMap        = {};
let charsLoaded    = false;
let locsLoaded     = false;
let spectatorLocId = null;   // currently selected spectator location

// ── Card helpers ──────────────────────────────────────────

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
  if (!conds) return "";
  const active = Object.entries(conds).filter(([, v]) => v).map(([k]) => k);
  if (!active.length) return "";
  return `<div class="card-conditions">${active.map(c =>
    `<span class="condition-pip">${c}</span>`
  ).join("")}</div>`;
}

function buildCard(id, data) {
  const pct  = hpPercent(data);
  const card = document.createElement("article");
  card.className = "character-card";
  card.setAttribute("data-id", id);
  card.innerHTML = `
    <a class="card-link" href="character.html?id=${id}" aria-label="Open ${data.name}'s sheet">
      <div class="card-hp-bar-wrap" style="position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(0,0,0,0.3);">
        <div class="card-hp-bar" style="height:100%;width:${pct}%;background:${hpColor(pct)};transition:width 0.5s ease;"></div>
      </div>
      ${data.taken ? `<span class="card-taken-badge" title="Character taken">⚔️</span>` : ""}
      <span class="card-emoji">${data.emoji || "⚔️"}</span>
      <h2 class="card-name">${data.name}</h2>
      <div class="card-hp-label">HP <strong>${data.hp ?? "?"}</strong> / ${data.hpMax ?? "?"}</div>
      ${conditionPips(data)}
    </a>
  `;
  return card;
}

function updateCard(id, data) {
  const card = cardMap[id];
  if (!card) return;
  const pct = hpPercent(data);

  const bar = card.querySelector(".card-hp-bar");
  if (bar) { bar.style.width = `${pct}%`; bar.style.background = hpColor(pct); }

  const label = card.querySelector(".card-hp-label");
  if (label) label.innerHTML = `HP <strong>${data.hp ?? "?"}</strong> / ${data.hpMax ?? "?"}`;

  const condEl = card.querySelector(".card-conditions");
  const pip = conditionPips(data);
  if (condEl) condEl.remove();
  if (pip) card.querySelector(".card-link").insertAdjacentHTML("beforeend", pip);

  const badge = card.querySelector(".card-taken-badge");
  if (data.taken && !badge) {
    const b = document.createElement("span");
    b.className = "card-taken-badge"; b.title = "Character taken"; b.textContent = "⚔️";
    card.querySelector(".card-link").prepend(b);
  } else if (!data.taken && badge) {
    badge.remove();
  }
}

// ── Layout render ──────────────────────────────────────────

function rerender() {
  if (!charsLoaded || !locsLoaded) return;

  loadingEl.classList.add("hidden");
  grid.querySelectorAll(".location-section, .character-card").forEach(el => el.remove());

  const chars = Object.values(charData).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (!chars.length) { emptyEl.classList.remove("hidden"); return; }
  emptyEl.classList.add("hidden");

  const hasLocations = Object.keys(locationData).length > 0;

  if (!hasLocations) {
    grid.classList.remove("has-locations");
    chars.forEach(char => {
      if (!cardMap[char.id]) cardMap[char.id] = buildCard(char.id, char);
      grid.appendChild(cardMap[char.id]);
    });
    return;
  }

  grid.classList.add("has-locations");
  const sortedLocs = Object.values(locationData).sort((a, b) => (a.order || 0) - (b.order || 0));

  sortedLocs.forEach(loc => {
    const inLoc = chars.filter(c => c.locationId === loc.id);
    if (!inLoc.length) return;
    const section = makeSection(loc.emoji || "🗺️", loc.name, loc.description || "", inLoc, loc.id);
    grid.appendChild(section);
  });

  const unassigned = chars.filter(c => !c.locationId || !locationData[c.locationId]);
  if (unassigned.length) {
    const showHeader = chars.length > unassigned.length;
    const section = makeSection(
      showHeader ? "🌐" : null,
      showHeader ? "Unassigned" : null,
      "",
      unassigned,
      null
    );
    grid.appendChild(section);
  }
}

function makeSection(emoji, name, desc, chars, locId) {
  const section = document.createElement("div");
  section.className = "location-section";

  if (name) {
    const isSelected = locId && locId === spectatorLocId;
    section.innerHTML = `
      <div class="location-section-header">
        <span class="location-section-emoji">${emoji}</span>
        <span class="location-section-name">${name}</span>
        ${desc ? `<span class="location-section-desc">${desc}</span>` : ""}
        ${locId ? `<label class="spectator-loc-label${isSelected ? " active" : ""}" title="Show on spectator screen">
          <input type="radio" name="spectatorLoc" class="spectator-loc-radio" value="${locId}"${isSelected ? " checked" : ""} />
          <span class="spectator-loc-icon">📺</span>
          <span class="spectator-loc-text">Spectator</span>
        </label>` : ""}
      </div>
    `;
    if (locId) {
      section.querySelector(".spectator-loc-radio").addEventListener("change", async () => {
        spectatorLocId = locId;
        document.querySelectorAll(".spectator-loc-label").forEach(l => l.classList.remove("active"));
        section.querySelector(".spectator-loc-label").classList.add("active");
        await setDoc(doc(db, "spectator", "config"), { locationId: locId });
      });
    }
  }

  const cardGrid = document.createElement("div");
  cardGrid.className = "location-card-grid";
  chars.forEach(char => {
    if (!cardMap[char.id]) cardMap[char.id] = buildCard(char.id, char);
    cardGrid.appendChild(cardMap[char.id]);
  });
  section.appendChild(cardGrid);
  return section;
}

// ── Characters listener ───────────────────────────────────

onSnapshot(
  query(collection(db, "characters"), orderBy("name")),
  (snapshot) => {
    let needsRerender = false;
    snapshot.docChanges().forEach(change => {
      const id   = change.doc.id;
      const data = change.doc.data();
      if (change.type === "removed") {
        delete charData[id];
        cardMap[id]?.remove();
        delete cardMap[id];
        needsRerender = true;
      } else if (change.type === "added") {
        charData[id] = { id, ...data };
        needsRerender = true;
      } else {
        const oldLoc = charData[id]?.locationId ?? null;
        charData[id] = { id, ...data };
        if (oldLoc !== (data.locationId ?? null)) {
          cardMap[id]?.remove();
          delete cardMap[id];
          needsRerender = true;
        } else {
          updateCard(id, data);
        }
      }
    });
    charsLoaded = true;
    if (needsRerender) rerender();
  },
  (err) => {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorMsg.textContent = `Could not reach the realm… (${err.message})`;
    console.error("Firestore error:", err);
  }
);

// ── Spectator config listener ─────────────────────────────

onSnapshot(doc(db, "spectator", "config"), snap => {
  const locId = snap.data()?.locationId ?? null;
  if (locId === spectatorLocId) return;
  spectatorLocId = locId;
  // Sync radio state without full rerender
  document.querySelectorAll(".spectator-loc-radio").forEach(radio => {
    radio.checked = (radio.value === spectatorLocId);
    radio.closest(".spectator-loc-label")?.classList.toggle("active", radio.checked);
  });
});

// ── Locations listener ────────────────────────────────────

onSnapshot(
  query(collection(db, "locations"), orderBy("order")),
  (snapshot) => {
    snapshot.docChanges().forEach(change => {
      const id = change.doc.id;
      if (change.type === "removed") delete locationData[id];
      else locationData[id] = { id, ...change.doc.data() };
    });
    locsLoaded = true;
    rerender();
  },
  (err) => {
    console.warn("Locations listener error (check Firestore rules):", err);
    locsLoaded = true;
    rerender();
  }
);
