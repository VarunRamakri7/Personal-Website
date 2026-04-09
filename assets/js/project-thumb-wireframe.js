/**
 * Optional Works thumbnails: same icosahedron wireframe as hero-spheres.js, one canvas per .project-card__canvas.
 * If no such elements exist, the script exits (home currently uses static images in .project-card__thumb).
 *
 * Tunable:
 *   presets[] — per-card initial angles (ox,oy,oz) and spin rates (srx,sry,srz); cycles with index % presets.length.
 *   lineColor() — stroke rgba for light/dark theme.
 *   drawEntry() — lineWidth, scale (* 0.38), persp (2.5) to match thumbnail size/depth.
 */
(function () {
  "use strict";

  var canvases = document.querySelectorAll(".project-card__canvas");
  if (!canvases.length) return;

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var phi = (1 + Math.sqrt(5)) / 2;
  var rawVerts = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ];

  var baseVerts = rawVerts.map(function (v) {
    var len = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  });

  var faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  var edgeSet = {};
  function addEdge(a, b) {
    if (a === b) return;
    var lo = a < b ? a : b;
    var hi = a < b ? b : a;
    edgeSet[lo + "," + hi] = true;
  }
  for (var f = 0; f < faces.length; f++) {
    var tri = faces[f];
    addEdge(tri[0], tri[1]);
    addEdge(tri[1], tri[2]);
    addEdge(tri[2], tri[0]);
  }
  var edges = [];
  for (var key in edgeSet) {
    if (Object.prototype.hasOwnProperty.call(edgeSet, key)) {
      var parts = key.split(",");
      edges.push([parseInt(parts[0], 10), parseInt(parts[1], 10)]);
    }
  }

  function mulMatVec(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  }

  function rotX(a) {
    var c = Math.cos(a);
    var s = Math.sin(a);
    return [1, 0, 0, 0, c, -s, 0, s, c];
  }

  function rotY(a) {
    var c = Math.cos(a);
    var s = Math.sin(a);
    return [c, 0, s, 0, 1, 0, -s, 0, c];
  }

  function rotZ(a) {
    var c = Math.cos(a);
    var s = Math.sin(a);
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  }

  function mulMat(a, b) {
    return [
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
      a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
      a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
      a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
      a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
      a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
      a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
    ];
  }

  function buildRotMatrix(rx, ry, rz) {
    return mulMat(rotZ(rz), mulMat(rotY(ry), rotX(rx)));
  }

  /** Distinct motion per Works row (matches hero sphere variety). */
  var presets = [
    { ox: 0.35, oy: 0.85, oz: 0.45, srx: 0.38, sry: 0.32, srz: 0.26 },
    { ox: 2.0, oy: 1.1, oz: 2.4, srx: -0.28, sry: 0.44, srz: 0.31 },
    { ox: 0.9, oy: 2.2, oz: 0.6, srx: 0.42, sry: -0.26, srz: 0.36 },
    { ox: 3.1, oy: 0.5, oz: 1.8, srx: 0.22, sry: 0.4, srz: -0.34 },
  ];

  function lineColor() {
    var light = document.documentElement.getAttribute("data-theme") === "light";
    return light ? "rgba(79, 134, 198, 0.42)" : "rgba(210, 208, 246, 0.28)";
  }

  function project(v, cx, cy, scale, perspective) {
    var z = v[2] + perspective;
    var inv = 1 / z;
    return [cx + v[0] * inv * scale, cy - v[1] * inv * scale];
  }

  var t0 = performance.now();
  var ctxList = [];

  function setupCanvas(canvas, index) {
    var p = presets[index % presets.length];
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctxList.push({
      ctx: ctx,
      canvas: canvas,
      p: p,
    });
    return ctx;
  }

  function resizeOne(entry) {
    var canvas = entry.canvas;
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.floor(rect.width * dpr));
    var h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    entry.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resizeAll() {
    for (var i = 0; i < ctxList.length; i++) {
      resizeOne(ctxList[i]);
    }
  }

  function drawEntry(entry, t) {
    var ctx = entry.ctx;
    var canvas = entry.canvas;
    var p = entry.p;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (w < 2 || h < 2) return;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = lineColor();
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";

    var rx = p.ox + t * p.srx;
    var ry = p.oy + t * p.sry;
    var rz = p.oz + t * p.srz;
    var R = buildRotMatrix(rx, ry, rz);
    var cx = w * 0.5;
    var cy = h * 0.5;
    var scale = Math.min(w, h) * 0.38;
    var persp = 2.5;

    ctx.beginPath();
    for (var e = 0; e < edges.length; e++) {
      var ei = edges[e];
      var va = mulMatVec(R, baseVerts[ei[0]]);
      var vb = mulMatVec(R, baseVerts[ei[1]]);
      var pa = project(va, cx, cy, scale, persp);
      var pb = project(vb, cx, cy, scale, persp);
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
    }
    ctx.stroke();
  }

  function drawFrame() {
    var t = reducedMotion ? 0 : (performance.now() - t0) / 1000;
    for (var i = 0; i < ctxList.length; i++) {
      drawEntry(ctxList[i], t);
    }
  }

  for (var c = 0; c < canvases.length; c++) {
    setupCanvas(canvases[c], c);
  }

  resizeAll();
  window.addEventListener("resize", function () {
    resizeAll();
    drawFrame();
  });

  var panelProjects = document.getElementById("panel-projects");
  if (panelProjects) {
    var mo = new MutationObserver(function () {
      if (!panelProjects.hidden) {
        requestAnimationFrame(function () {
          resizeAll();
          drawFrame();
        });
      }
    });
    mo.observe(panelProjects, { attributes: true, attributeFilter: ["hidden"] });
  }

  function frame() {
    drawFrame();
    if (!reducedMotion) {
      requestAnimationFrame(frame);
    }
  }

  if (reducedMotion) {
    drawFrame();
  } else {
    requestAnimationFrame(frame);
  }

  new MutationObserver(function () {
    if (reducedMotion) drawFrame();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
