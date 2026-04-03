/**
 * Magnifying glass over the landing area (nav + hero). Renders below #cursor-invert (mix-blend unchanged).
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
  var canvasSyncRaf = 0;

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
    stripCloneIds();

    sheet.appendChild(cloneRoot);
    viewport.appendChild(sheet);
    root.appendChild(viewport);
    document.body.appendChild(root);

    source.style.setProperty("--hero-magnifier-r", R + "px");
  }

  function stripCloneIds() {
    if (!cloneRoot) return;
    cloneRoot.querySelectorAll("[id]").forEach(function (el) {
      el.removeAttribute("id");
    });
  }

  function destroy() {
    stopCanvasSyncLoop();
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    root = viewport = sheet = cloneRoot = null;
  }

  function syncCloneFromSource() {
    if (!cloneRoot || !source) return;
    cloneRoot.innerHTML = source.innerHTML;
    stripCloneIds();
    syncCloneCanvas();
  }

  function syncCloneCanvas() {
    if (!cloneRoot || !source) return;
    var orig = source.querySelector(".hero__spheres-canvas");
    var clone = cloneRoot.querySelector(".hero__spheres-canvas");
    if (!orig || !clone) return;
    if (clone.width !== orig.width || clone.height !== orig.height) {
      clone.width = orig.width;
      clone.height = orig.height;
    }
    var cctx = clone.getContext("2d");
    if (!cctx) return;
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    /* Transparent pixels in orig do not erase the destination under source-over; clear first or old strokes persist. */
    cctx.globalCompositeOperation = "source-over";
    cctx.clearRect(0, 0, clone.width, clone.height);
    cctx.drawImage(orig, 0, 0);
  }

  function startCanvasSyncLoop() {
    if (canvasSyncRaf) return;
    function tick() {
      syncCloneCanvas();
      if (root && root.classList.contains("hero-magnifier--on")) {
        canvasSyncRaf = requestAnimationFrame(tick);
      } else {
        canvasSyncRaf = 0;
      }
    }
    canvasSyncRaf = requestAnimationFrame(tick);
  }

  function stopCanvasSyncLoop() {
    if (canvasSyncRaf) {
      cancelAnimationFrame(canvasSyncRaf);
      canvasSyncRaf = 0;
    }
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
      stopCanvasSyncLoop();
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
    syncCloneCanvas();
    startCanvasSyncLoop();
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
      stopCanvasSyncLoop();
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
      stopCanvasSyncLoop();
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
    new MutationObserver(function () {
      syncCloneFromSource();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function disable() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize);
    stopCanvasSyncLoop();
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
