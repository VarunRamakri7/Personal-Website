/**
 * Light/dark theme: sets html[data-theme], meta theme-color, and persists user choice.
 *
 * Tunable:
 *   STORAGE_KEY — localStorage key for saved theme ("light" | "dark").
 *   applyTheme() — theme-color hex values (#d8dfe2 light, #465166 dark); keep in sync with design tokens.
 * Behavior: if STORAGE_KEY is unset, initial theme comes from the inline script in index/Resume (prefers-color-scheme);
 *   system scheme changes apply until the user clicks .theme-toggle once (then STORAGE_KEY is set).
 */
(function () {
  var STORAGE_KEY = "theme";

  function getTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    return t === "light" ? "light" : "dark";
  }

  function hasSavedTheme() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      return s === "light" || s === "dark";
    } catch (e) {
      return false;
    }
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.setAttribute("data-theme", "dark");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "light" ? "#d8dfe2" : "#465166");
    }
  }

  function syncToggle(btn) {
    if (!btn) return;
    var light = getTheme() === "light";
    btn.setAttribute("aria-pressed", light ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      light ? "Switch to dark mode" : "Switch to light mode"
    );
  }

  function init() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        applyTheme(saved);
      } else {
        applyTheme(getTheme());
      }
    } catch (e) {
      applyTheme(getTheme());
    }

    try {
      var schemeMq = window.matchMedia("(prefers-color-scheme: light)");
      function onSystemSchemeChange() {
        if (hasSavedTheme()) return;
        applyTheme(schemeMq.matches ? "light" : "dark");
        syncToggle(document.querySelector(".theme-toggle"));
      }
      if (typeof schemeMq.addEventListener === "function") {
        schemeMq.addEventListener("change", onSystemSchemeChange);
      } else if (typeof schemeMq.addListener === "function") {
        schemeMq.addListener(onSystemSchemeChange);
      }
    } catch (e) {}

    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;

    syncToggle(btn);
    btn.addEventListener("click", function () {
      var next = getTheme() === "light" ? "dark" : "light";
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {}
      syncToggle(btn);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
