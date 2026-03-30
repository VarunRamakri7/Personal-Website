(function () {
  var STORAGE_KEY = "theme";

  function getTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    return t === "light" ? "light" : "dark";
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
      meta.setAttribute("content", theme === "light" ? "#eef2ff" : "#0a0a0b");
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
