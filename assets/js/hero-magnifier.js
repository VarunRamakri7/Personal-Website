/**
 * Magnifying glass over #hero-magnifier-source only: clones hero text, scales it, SVG lens filter, masks source.
 * z-index below #cursor-invert. Disabled when prefers-reduced-motion: reduce or site-effect-hero-magnifier === "0".
 *
 * Tunable (this file):
 *   R — lens radius (px); half of .hero-magnifier width/height in CSS (keep JS, CSS, index.html feImage width in sync).
 *   scale — zoom factor for the cloned text.
 *   buildLensDisplacementMapDataUrl: edgeInner, barrel/rim coefficients, final 0.42 strength — barrel “glass” warp.
 * Tunable (index.html): filter #hero-magnifier-lens feDisplacementMap @ scale — displacement strength in px.
 * Tunable (main.css): mask feather on #hero-magnifier-source.hero-magnifier-source--masked; glass rim .hero-magnifier::after.
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

  /** Lens radius (px); pair with CSS .hero-magnifier { width/height: 2*R } and feImage width/height in index.html */
  var R = 92;
  /** Zoom of the cloned hero text inside the lens */
  var scale = 1.62;
  /** Radial lens displacement map (once); matches SVG feDisplacementMap neutral 0.5 in R/G */
  var lensMapDataUrl = null;

  function buildLensDisplacementMapDataUrl() {
    if (lensMapDataUrl) return lensMapDataUrl;
    var size = 256;
    var cx = (size - 1) / 2;
    var cy = (size - 1) / 2;
    var radius = size / 2;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    if (!ctx) return "";
    var img = ctx.createImageData(size, size);
    var d = img.data;
    var i = 0;
    var j;
    var x;
    var y;
    var nx;
    var ny;
    var r;
    var ux;
    var uy;
    /** Rim falloff start (0–1 radius); higher = softer transition at circle edge */
    var edgeInner = 0.78;
    var barrel;
    var rim;
    var mag;
    var dr;
    var dg;
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        nx = (x - cx) / radius;
        ny = (y - cy) / radius;
        r = Math.sqrt(nx * nx + ny * ny);
        if (r > 1.001) {
          d[i] = 128;
          d[i + 1] = 128;
          d[i + 2] = 128;
          d[i + 3] = 255;
          i += 4;
          continue;
        }
        if (r < 1e-6) {
          ux = 0;
          uy = 0;
        } else {
          ux = nx / r;
          uy = ny / r;
        }
        barrel = r * r * (1 - 0.35 * r * r);
        rim = 1;
        if (r > edgeInner) {
          rim = (1 - r) / (1 - edgeInner);
          rim = rim * rim * (3 - 2 * rim);
        }
        /* Overall warp strength; tune with feDisplacementMap scale in index.html */
        mag = barrel * rim * 0.42;
        dr = ux * mag;
        dg = uy * mag;
        j = Math.round(255 * (0.5 + dr));
        if (j < 0) j = 0;
        if (j > 255) j = 255;
        d[i] = j;
        j = Math.round(255 * (0.5 + dg));
        if (j < 0) j = 0;
        if (j > 255) j = 255;
        d[i + 1] = j;
        d[i + 2] = 128;
        d[i + 3] = 255;
        i += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
    lensMapDataUrl = canvas.toDataURL("image/png");
    return lensMapDataUrl;
  }

  function attachLensDisplacementMap() {
    var url = buildLensDisplacementMapDataUrl();
    if (!url) return;
    var el = document.getElementById("hero-magnifier-lens-map");
    if (!el) return;
    /* Explicit px size (not %): parent SVG is 0×0 CSS, so % on feImage mis-centers the map vs SourceGraphic. */
    var side = R * 2;
    el.setAttribute("x", "0");
    el.setAttribute("y", "0");
    el.setAttribute("width", String(side));
    el.setAttribute("height", String(side));
    el.setAttribute("href", url);
    try {
      el.setAttributeNS("http://www.w3.org/1999/xlink", "href", url);
    } catch (err) {}
  }

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
    attachLensDisplacementMap();
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
    if (document.hidden) return;
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

  function isUserEnabled() {
    try {
      return localStorage.getItem("site-effect-hero-magnifier") !== "0";
    } catch (e) {
      return true;
    }
  }

  function sync() {
    if (mq.matches && !reducedMotion && isUserEnabled()) {
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
  window.addEventListener("site-effects-changed", sync);
  window.addEventListener("storage", function (e) {
    if (e.key === "site-effect-hero-magnifier") sync();
  });
})();
