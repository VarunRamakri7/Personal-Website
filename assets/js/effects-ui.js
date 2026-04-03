/**
 * Toggles for optional cursor effects (persisted). Dispatches site-effects-changed for hero-magnifier / cursor-invert.
 */
(function () {
  "use strict";

  var KEY_CURSOR = "site-effect-cursor-invert";
  var KEY_MAGNIFIER = "site-effect-hero-magnifier";

  function read(key) {
    try {
      return localStorage.getItem(key) !== "0";
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
      var on = read(KEY_CURSOR);
      inv.setAttribute("aria-pressed", on ? "true" : "false");
      inv.classList.toggle("theme-effect-toggle--off", !on);
    }
    if (mag) {
      var on2 = read(KEY_MAGNIFIER);
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
        write(KEY_CURSOR, !read(KEY_CURSOR));
      });
    }
    if (mag) {
      mag.addEventListener("click", function (e) {
        e.stopPropagation();
        write(KEY_MAGNIFIER, !read(KEY_MAGNIFIER));
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
