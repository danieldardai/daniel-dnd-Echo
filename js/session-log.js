import { db } from "./firebase-config.js";
import {
  collection, onSnapshot, orderBy, query, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const feed   = document.getElementById("logFeed");
const tabsEl = document.getElementById("logLocationTabs");
if (!feed) throw new Error("No #logFeed element found");

const ICONS = {
  damage:    "⚔️",
  heal:      "💚",
  spell:     "✨",
  slot:      "🔮",
  condition: "🌀",
  inventory: "🎒",
  death:     "💀",
  note:      "📜",
  roll:      "🎲",
  default:   "📖"
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

function buildEntry(id, data) {
  const el = document.createElement("div");
  el.className = "log-entry";
  el.setAttribute("data-id", id);
  el.innerHTML = `
    <span class="log-icon" aria-hidden="true">${ICONS[data.type] || ICONS.default}</span>
    <div class="log-content">
      <span class="log-actor">${data.actor || "Unknown"}</span>
      <span class="log-message">${data.message || ""}</span>
    </div>
    <span class="log-time">${timeAgo(data.timestamp)}</span>
  `;
  return el;
}

// ── State ─────────────────────────────────────────────────

let selectedLocId = "all";
let charToLocId   = {};   // charId → locationId | null
let locMap        = {};   // locationId → { id, name, emoji, order }
let allEntries    = {};   // entryId → { el, data }

// ── Filter & render ───────────────────────────────────────

function isVisible(data) {
  if (selectedLocId === "all") return true;
  if (!data.charId) return false;
  return charToLocId[data.charId] === selectedLocId;
}

function rerenderFeed() {
  feed.innerHTML = "";
  const visible = Object.values(allEntries)
    .filter(e => isVisible(e.data))
    .sort((a, b) => {
      const ta = a.data.timestamp?.seconds ?? Number.MAX_SAFE_INTEGER;
      const tb = b.data.timestamp?.seconds ?? Number.MAX_SAFE_INTEGER;
      return tb - ta;
    });

  if (!visible.length) {
    const msg = selectedLocId === "all"
      ? "No events yet this session…"
      : "No events for this location yet…";
    feed.innerHTML = `<div class="log-empty">${msg}</div>`;
    return;
  }
  visible.forEach(e => feed.appendChild(e.el));
}

// ── Location tabs ─────────────────────────────────────────

function renderTabs() {
  if (!tabsEl) return;
  const locs = Object.values(locMap).sort((a, b) => (a.order || 0) - (b.order || 0));

  tabsEl.innerHTML = "";

  const makeTab = (locId, label) => {
    const btn = document.createElement("button");
    btn.className = "log-loc-tab" + (selectedLocId === locId ? " active" : "");
    btn.dataset.loc = locId;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      selectedLocId = locId;
      tabsEl.querySelectorAll(".log-loc-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      rerenderFeed();
    });
    return btn;
  };

  tabsEl.appendChild(makeTab("all", "All"));
  locs.forEach(loc => tabsEl.appendChild(makeTab(loc.id, `${loc.emoji || "🗺️"} ${loc.name}`)));
}

// ── Listeners ─────────────────────────────────────────────

// Characters — track charId → locationId mapping
onSnapshot(collection(db, "characters"), (snapshot) => {
  let changed = false;
  snapshot.docChanges().forEach(change => {
    const id = change.doc.id;
    if (change.type === "removed") {
      delete charToLocId[id];
      changed = true;
    } else {
      const locId = change.doc.data().locationId ?? null;
      if (charToLocId[id] !== locId) {
        charToLocId[id] = locId;
        changed = true;
      }
    }
  });
  if (changed && selectedLocId !== "all") rerenderFeed();
});

// Locations — build tab labels
onSnapshot(
  query(collection(db, "locations"), orderBy("order")),
  (snapshot) => {
    snapshot.docChanges().forEach(change => {
      const id = change.doc.id;
      if (change.type === "removed") delete locMap[id];
      else locMap[id] = { id, ...change.doc.data() };
    });
    renderTabs();
  },
  (err) => {
    console.warn("Locations listener error (check Firestore rules):", err);
  }
);

// Session log entries
onSnapshot(
  query(collection(db, "sessionLog"), orderBy("timestamp", "desc"), limit(50)),
  (snapshot) => {
    let changed = false;
    snapshot.docChanges().forEach(change => {
      const id   = change.doc.id;
      const data = change.doc.data();
      if (change.type === "added" || change.type === "modified") {
        allEntries[id] = { el: buildEntry(id, data), data };
        changed = true;
      } else if (change.type === "removed") {
        delete allEntries[id];
        changed = true;
      }
    });
    if (changed) rerenderFeed();
  }
);
