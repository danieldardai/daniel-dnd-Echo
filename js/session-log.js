import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const feed = document.getElementById("logFeed");
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
  default:   "📖"
};

function timeAgo(ts) {
  if (!ts) return "";
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60)   return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return d.toLocaleDateString();
}

function buildEntry(id, data) {
  const el = document.createElement("div");
  el.className = "log-entry";
  el.setAttribute("data-id", id);
  const icon = ICONS[data.type] || ICONS.default;
  el.innerHTML = `
    <span class="log-icon" aria-hidden="true">${icon}</span>
    <div class="log-content">
      <span class="log-actor">${data.actor || "Unknown"}</span>
      <span class="log-message">${data.message || ""}</span>
    </div>
    <span class="log-time">${timeAgo(data.timestamp)}</span>
  `;
  return el;
}

const entryMap = {};

const q = query(
  collection(db, "sessionLog"),
  orderBy("timestamp", "desc"),
  limit(50)
);

onSnapshot(q, (snapshot) => {
  const empty = feed.querySelector(".log-empty");

  snapshot.docChanges().forEach((change) => {
    const id   = change.doc.id;
    const data = change.doc.data();

    if (change.type === "added") {
      if (empty) empty.remove();
      const el = buildEntry(id, data);
      entryMap[id] = el;
      feed.insertBefore(el, feed.firstChild);
    } else if (change.type === "modified") {
      entryMap[id]?.remove();
      const el = buildEntry(id, data);
      entryMap[id] = el;
      feed.insertBefore(el, feed.firstChild);
    } else if (change.type === "removed") {
      entryMap[id]?.remove();
      delete entryMap[id];
    }
  });
});
