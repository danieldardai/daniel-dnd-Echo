/**
 * ui.js  (non-module, loaded after the ES modules)
 * Handles modal open/close and keyboard navigation.
 */

(function () {
  const backdrop  = document.getElementById("modalBackdrop");
  const modal     = document.getElementById("characterModal");
  const closeBtn  = document.getElementById("modalClose");
  const portrait  = document.getElementById("modalPortrait");
  const modalClass  = document.getElementById("modalClass");
  const modalName   = document.getElementById("modalName");
  const modalPlayer = document.getElementById("modalPlayer");
  const modalBio    = document.getElementById("modalBio");
  const modalStats  = document.getElementById("modalStats");
  const modalExtra  = document.getElementById("modalExtra");

  // Exposed globally so characters.js can call it
  window.showCharacterModal = function (data, portraitHTML, buildStatsHTML, buildExtraHTML) {
    portrait.innerHTML    = portraitHTML(data, "modal");
    modalClass.textContent  = [data.race, data.class, data.level ? `Level ${data.level}` : ""].filter(Boolean).join(" · ");
    modalName.textContent   = data.name || "Unknown Hero";
    modalPlayer.textContent = data.player || "—";
    modalBio.textContent    = data.bio || "";
    modalStats.innerHTML    = buildStatsHTML(data.stats);
    modalExtra.innerHTML    = buildExtraHTML(data.extra);

    // Hide empty sections cleanly
    modalBio.style.display   = data.bio   ? "" : "none";
    modalStats.style.display = data.stats ? "" : "none";

    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };

  function closeModal() {
    backdrop.classList.add("hidden");
    document.body.style.overflow = "";
  }

  closeBtn.addEventListener("click", closeModal);

  backdrop.addEventListener("click", function (e) {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
})();
