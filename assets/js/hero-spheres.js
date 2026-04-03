(function () {
  var canvas = document.querySelector(".hero__spheres-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
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

  /* nx, ny: offset from canvas center (× w/h); r: scale factor; filled by generateSpheres */
  var spheres = [];
  var sphereGenW = 0;
  var sphereGenH = 0;

  var TARGET_COUNT = 6;
  /** Keep icosahedra inset from edges (fraction of half-width / half-height). */
  var EDGE_MARGIN = 0.07;
  /** Min separation between centers in px — scales with projected mesh size. */
  function minCenterSeparationPx(r1, r2, w, h) {
    var scale = Math.min(w, h) * 0.45;
    return 0.5 * (r1 + r2) * scale;
  }

  function centerPx(sp, w, h) {
    return [w * (0.5 + sp.nx), h * (0.5 + sp.ny)];
  }

  function distPx(a, b, w, h) {
    var ca = centerPx(a, w, h);
    var cb = centerPx(b, w, h);
    return Math.hypot(ca[0] - cb[0], ca[1] - cb[1]);
  }

  /**
   * Random non-overlacing placements; rejects samples that are too close in screen space.
   * Falls back to a jittered hex-ish grid if rejection sampling stalls.
   */
  function generateSpheres(w, h) {
    var placed = [];
    var maxAttempts = 900;
    var attempts = 0;
    var halfInset = 0.5 - EDGE_MARGIN;

    while (placed.length < TARGET_COUNT && attempts < maxAttempts) {
      attempts++;
      var r = 0.3 + Math.random() * 0.2;
      var nx = (Math.random() - 0.5) * 2 * halfInset;
      var ny = (Math.random() - 0.5) * 2 * halfInset;
      var candidate = { nx: nx, ny: ny, r: r };
      var ok = true;
      for (var i = 0; i < placed.length; i++) {
        if (distPx(candidate, placed[i], w, h) < minCenterSeparationPx(r, placed[i].r, w, h)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        placed.push({
          nx: nx,
          ny: ny,
          r: r,
          srx: (Math.random() - 0.5) * 0.92,
          sry: (Math.random() - 0.5) * 0.92,
          srz: (Math.random() - 0.5) * 0.92,
          ox: Math.random() * Math.PI * 2,
          oy: Math.random() * Math.PI * 2,
          oz: Math.random() * Math.PI * 2,
        });
      }
    }

    /* Grid fallback: deterministic slots around the hero so we always show TARGET_COUNT */
    if (placed.length < TARGET_COUNT) {
      var slots = [
        { nx: -0.34, ny: -0.28 },
        { nx: 0.34, ny: -0.22 },
        { nx: -0.28, ny: 0.32 },
        { nx: 0.3, ny: 0.28 },
        { nx: 0, ny: -0.38 },
        { nx: -0.38, ny: 0.08 },
        { nx: 0.38, ny: 0.06 },
        { nx: 0, ny: 0.36 },
      ];
      var rs = [0.36, 0.38, 0.34, 0.4, 0.33, 0.37];
      for (var s = 0; s < slots.length && placed.length < TARGET_COUNT; s++) {
        var jitter = 0.04;
        var cand = {
          nx: slots[s].nx + (Math.random() - 0.5) * jitter,
          ny: slots[s].ny + (Math.random() - 0.5) * jitter,
          r: rs[placed.length % rs.length],
        };
        if (Math.abs(cand.nx) > halfInset - 0.02) cand.nx *= 0.92;
        if (Math.abs(cand.ny) > halfInset - 0.02) cand.ny *= 0.92;
        var clash = false;
        for (var j = 0; j < placed.length; j++) {
          if (distPx(cand, placed[j], w, h) < minCenterSeparationPx(cand.r, placed[j].r, w, h) * 0.92) {
            clash = true;
            break;
          }
        }
        if (!clash) {
          placed.push({
            nx: cand.nx,
            ny: cand.ny,
            r: cand.r,
            srx: (Math.random() - 0.5) * 0.92,
            sry: (Math.random() - 0.5) * 0.92,
            srz: (Math.random() - 0.5) * 0.92,
            ox: Math.random() * Math.PI * 2,
            oy: Math.random() * Math.PI * 2,
            oz: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    /* Tighter packing if still short — smaller meshes, relaxed separation */
    var extraAttempts = 0;
    while (placed.length < TARGET_COUNT && extraAttempts < 1200) {
      extraAttempts++;
      var rSmall = 0.26 + Math.random() * 0.14;
      var nx2 = (Math.random() - 0.5) * 2 * halfInset;
      var ny2 = (Math.random() - 0.5) * 2 * halfInset;
      var cand2 = { nx: nx2, ny: ny2, r: rSmall };
      var ok2 = true;
      for (var k = 0; k < placed.length; k++) {
        if (distPx(cand2, placed[k], w, h) < minCenterSeparationPx(rSmall, placed[k].r, w, h) * 0.58) {
          ok2 = false;
          break;
        }
      }
      if (ok2) {
        placed.push({
          nx: nx2,
          ny: ny2,
          r: rSmall,
          srx: (Math.random() - 0.5) * 0.92,
          sry: (Math.random() - 0.5) * 0.92,
          srz: (Math.random() - 0.5) * 0.92,
          ox: Math.random() * Math.PI * 2,
          oy: Math.random() * Math.PI * 2,
          oz: Math.random() * Math.PI * 2,
        });
      }
    }

    return placed;
  }

  function maybeRegenerateSpheres(w, h) {
    if (w < 24 || h < 24) return;
    var need =
      spheres.length === 0 ||
      !sphereGenW ||
      Math.abs(w - sphereGenW) / sphereGenW > 0.14 ||
      Math.abs(h - sphereGenH) / sphereGenH > 0.14;
    if (need) {
      spheres = generateSpheres(w, h);
      sphereGenW = w;
      sphereGenH = h;
    }
  }

  var t0 = performance.now();

  function lineColor() {
    var light = document.documentElement.getAttribute("data-theme") === "light";
    return light ? "rgba(79, 134, 198, 0.24)" : "rgba(224, 215, 48, 0.16)";
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(v, cx, cy, scale, perspective) {
    var z = v[2] + perspective;
    var inv = 1 / z;
    return [cx + v[0] * inv * scale, cy - v[1] * inv * scale];
  }

  function draw() {
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    maybeRegenerateSpheres(w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = lineColor();
    ctx.lineWidth = 3.25;
    ctx.lineJoin = "round";

    var t = (performance.now() - t0) / 1000;
    var scale = Math.min(w, h) * 0.45;
    var persp = 2.5;

    for (var s = 0; s < spheres.length; s++) {
      var sp = spheres[s];
      var rx = sp.ox + t * sp.srx;
      var ry = sp.oy + t * sp.sry;
      var rz = sp.oz + t * sp.srz;
      var R = buildRotMatrix(rx, ry, rz);

      var cx = w * (0.5 + sp.nx);
      var cy = h * (0.5 + sp.ny);
      var rScale = scale * sp.r;

      ctx.beginPath();
      for (var e = 0; e < edges.length; e++) {
        var ei = edges[e];
        var va = mulMatVec(R, baseVerts[ei[0]]);
        var vb = mulMatVec(R, baseVerts[ei[1]]);
        var pa = project(va, cx, cy, rScale, persp);
        var pb = project(vb, cx, cy, rScale, persp);
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
      }
      ctx.stroke();
    }
  }

  function frame() {
    draw();
    if (!reducedMotion) {
      requestAnimationFrame(frame);
    }
  }

  resize();
  var rect0 = canvas.getBoundingClientRect();
  maybeRegenerateSpheres(rect0.width, rect0.height);
  window.addEventListener("resize", function () {
    resize();
    draw();
  });

  if (reducedMotion) {
    draw();
  } else {
    requestAnimationFrame(frame);
  }

  new MutationObserver(function () {
    if (reducedMotion) draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
