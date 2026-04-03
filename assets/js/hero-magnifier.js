/**
 * Magnifying glass over hero landing text only. Renders below #cursor-invert (mix-blend unchanged).
 */
(function () {
  "use strict";

  var mq;
  try {
    mq = window.matchMedia("(hover: hover) and (pointer: fine)");
  } catch (e) {
    return;
  }

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var source = document.getElementById("hero-magnifier-source");
  if (!source) return;

  var root = null;
  var viewport = null;
  var sheet = null;
  var cloneRoot = null;

  var R = 92;
  var scale = 1.62;
  var raf = 0;
  var pending = null;
  var lastX = 0;
  var lastY = 0;

  function build() {
    if (root) return;

    root = document.createElement("div");
    root.id = "hero-magnifier";
    root.className = "hero-magnifier";
    root.setAttribute("aria-hidden", "true");

    viewport = document.createElement("div");
    viewport.className = "hero-magnifier__viewport";

    sheet = document.createElement("div");
    sheet.className = "hero-magnifier__sheet";

    cloneRoot = source.cloneNode(true);
    cloneRoot.removeAttribute("id");
    cloneRoot.setAttribute("aria-hidden", "true");
    cloneRoot.className = source.className + " hero-magnifier__clone";

    sheet.appendChild(cloneRoot);
    viewport.appendChild(sheet);
    root.appendChild(viewport);
    document.body.appendChild(root);

    source.style.setProperty("--hero-magnifier-r", R + "px");
  }

  function destroy() {
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    root = viewport = sheet = cloneRoot = null;
  }

  function syncCloneFromSource() {
    if (!cloneRoot || !source) return;
    cloneRoot.innerHTML = source.innerHTML;
  }

  function clearSourceMask() {
    source.classList.remove("hero-magnifier-source--masked");
    source.style.removeProperty("--mask-x");
    source.style.removeProperty("--mask-y");
  }

  function applySourceMask(mx, my) {
    var rect = source.getBoundingClientRect();
    source.classList.add("hero-magnifier-source--masked");
    source.style.setProperty("--mask-x", mx - rect.left + "px");
    source.style.setProperty("--mask-y", my - rect.top + "px");
  }

  function updatePosition(mx, my) {
    if (!root || !viewport || !sheet || !cloneRoot) return;

    var rect = source.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      root.classList.remove("hero-magnifier--on");
      clearSourceMask();
      return;
    }

    var bx = mx - rect.left;
    var by = my - rect.top;

    root.style.left = mx - R + "px";
    root.style.top = my - R + "px";

    sheet.style.width = rect.width + "px";
    sheet.style.height = rect.height + "px";
    sheet.style.transform = "scale(" + scale + ")";
    sheet.style.transformOrigin = "0 0";
    sheet.style.left = R - bx * scale + "px";
    sheet.style.top = R - by * scale + "px";

    root.classList.add("hero-magnifier--on");
    applySourceMask(mx, my);
  }

  function frame() {
    raf = 0;
    if (!pending) return;
    var mx = pending[0];
    var my = pending[1];
    pending = null;

    if (document.body.classList.contains("drawer-active")) {
      if (root) root.classList.remove("hero-magnifier--on");
      clearSourceMask();
      return;
    }

    var rect = source.getBoundingClientRect();
    var over =
      mx >= rect.left &&
      mx <= rect.right &&
      my >= rect.top &&
      my <= rect.bottom;

    if (!over) {
      if (root) root.classList.remove("hero-magnifier--on");
      clearSourceMask();
      return;
    }

    updatePosition(mx, my);
  }

  function onMove(e) {
    if (!mq.matches || reducedMotion) return;
    lastX = e.clientX;
    lastY = e.clientY;
    pending = [lastX, lastY];
    if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  }

  function onResize() {
    syncCloneFromSource();
    if (root && root.classList.contains("hero-magnifier--on")) {
      pending = [lastX, lastY];
      if (!raf) raf = requestAnimationFrame(frame);
    }
  }

  function onScroll() {
    if (root && root.classList.contains("hero-magnifier--on")) {
      pending = [lastX, lastY];
      if (!raf) raf = requestAnimationFrame(frame);
    }
  }

  function enable() {
    if (reducedMotion) return;
    build();
    syncCloneFromSource();
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onResize);
    source.addEventListener("mouseleave", onSourceLeave);
    new MutationObserver(function () {
      syncCloneFromSource();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function onSourceLeave() {
    clearSourceMask();
    if (root) root.classList.remove("hero-magnifier--on");
  }

  function disable() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize);
    if (source) {
      source.removeEventListener("mouseleave", onSourceLeave);
    }
    clearSourceMask();
    destroy();
  }

  function sync() {
    if (mq.matches && !reducedMotion) {
      enable();
    } else {
      disable();
    }
  }

  sync();
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", sync);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(sync);
  }
})();
