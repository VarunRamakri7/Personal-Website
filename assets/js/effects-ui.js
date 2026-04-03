/**
 * Effect toggles beside the theme button (hover/focus cluster). Updates button UI and localStorage.
 *
 * Dispatches window "site-effects-changed" after writes so cursor-invert.js and hero-magnifier.js resync.
 * Tunable:
 *   KEY_CURSOR — opt-in: enabled only when value is "1" (default off for new visitors).
 *   KEY_MAGNIFIER — opt-out: disabled only when value is "0" (default on).
 * HTML: #effect-toggle-cursor-invert, #effect-toggle-hero-magnifier inside .theme-toggle-cluster.
 */
(function () {
  "use strict";

  var KEY_CURSOR = "site-effect-cursor-invert";
  var KEY_MAGNIFIER = "site-effect-hero-magnifier";

  /** Inversion: opt-in (default off). */
  function readCursorInvert() {
    try {
      return localStorage.getItem(KEY_CURSOR) === "1";
    } catch (e) {
      return false;
    }
  }

  /** Magnifier: opt-out (default on). */
  function readMagnifier() {
    try {
      return localStorage.getItem(KEY_MAGNIFIER) !== "0";
    } catch (e) {
      return true;
    }
  }

  function write(key, enabled) {
    try {
      localStorage.setItem(key, enabled ? "1" : "0");
    } catch (e) {}
    window.dispatchEvent(new CustomEvent("site-effects-changed"));
  }

  function syncButtons() {
    var inv = document.getElementById("effect-toggle-cursor-invert");
    var mag = document.getElementById("effect-toggle-hero-magnifier");
    if (inv) {
      var on = readCursorInvert();
      inv.setAttribute("aria-pressed", on ? "true" : "false");
      inv.classList.toggle("theme-effect-toggle--off", !on);
    }
    if (mag) {
      var on2 = readMagnifier();
      mag.setAttribute("aria-pressed", on2 ? "true" : "false");
      mag.classList.toggle("theme-effect-toggle--off", !on2);
    }
  }

  function init() {
    var inv = document.getElementById("effect-toggle-cursor-invert");
    var mag = document.getElementById("effect-toggle-hero-magnifier");
    if (!inv && !mag) return;

    if (inv) {
      inv.addEventListener("click", function (e) {
        e.stopPropagation();
        write(KEY_CURSOR, !readCursorInvert());
      });
    }
    if (mag) {
      mag.addEventListener("click", function (e) {
        e.stopPropagation();
        write(KEY_MAGNIFIER, !readMagnifier());
      });
    }

    syncButtons();

    var cluster = document.querySelector(".theme-toggle-cluster");
    if (cluster) {
      cluster.addEventListener("mouseleave", function () {
        var a = document.activeElement;
        if (a && cluster.contains(a)) {
          a.blur();
        }
      });
    }

    window.addEventListener("storage", function (e) {
      if (e.key === KEY_CURSOR || e.key === KEY_MAGNIFIER) {
        syncButtons();
      }
    });
    window.addEventListener("site-effects-changed", syncButtons);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
