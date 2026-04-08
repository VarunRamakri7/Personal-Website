/**
 * Hero background: solid page-colored backdrop, star field, shooting stars, drifting motes, plus rotating
 * icosahedron wireframes on .hero__spheres-canvas.
 *
 * Tunable:
 *   TARGET_COUNT — how many meshes to place; EDGE_MARGIN — inset from canvas edges (0–0.5 scale).
 *   STAR_DENSITY — stars per megapixel; SHOOTING_STAR_INTERVAL — base seconds between streaks.
 *   lineColor() — stroke rgba for light vs dark theme (reads data-theme).
 *   draw() — ctx.lineWidth, persp, scale multiplier (Math.min(w,h) * 0.45), and rotation speed from each sphere’s srx/sry/srz.
 *   dpr — capped at 2 for performance (devicePixelRatio).
 * Geometry: rawVerts/faces/edges define the mesh; change only if you want a different polyhedron.
 */
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
  /** Keep icosahedra inset from edges (fraction of half-width / half-height); increase for more margin. */
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
  var lastTs = performance.now();

  var STAR_DENSITY = 420;
  var MOTE_COUNT_MIN = 18;
  var MOTE_COUNT_MAX = 42;
  var shootingStars = [];
  var stars = [];
  var motes = [];
  var atmoW = 0;
  var atmoH = 0;
  var shootingTimer = 0;
  var nextShootingIn = 2;
  var heroBgCacheKey = "";
  var heroBgColor = "rgb(60, 42, 68)";

  function isLightTheme() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  /** High-contrast particles on light (cool blues); Moon Raker family on dark. */
  function atmosphericPalette() {
    if (isLightTheme()) {
      return {
        starDot: "rgba(38, 78, 140,",
        starGlow: "rgba(65, 118, 188,",
        mote: "rgba(52, 98, 165,",
        shootHead: "rgba(255, 255, 255,",
        shootBright: "rgba(120, 165, 220,",
        shootFade: "rgba(70, 120, 185,",
        starTwMul: 1.05,
        moteAlphaMul: 1.45,
      };
    }
    return {
      starDot: "rgba(235, 233, 255,",
      starGlow: "rgba(210, 208, 246,",
      mote: "rgba(220, 218, 252,",
      shootHead: "rgba(255, 255, 255,",
      shootBright: "rgba(230, 228, 255,",
      shootFade: "rgba(190, 188, 240,",
      starTwMul: 1,
      moteAlphaMul: 1,
    };
  }

  function solidBackdropFill() {
    var key = isLightTheme() ? "light" : "dark";
    if (heroBgCacheKey !== key) {
      heroBgCacheKey = key;
      try {
        var col = getComputedStyle(document.body).backgroundColor;
        if (col && col !== "rgba(0, 0, 0, 0)" && col !== "transparent") {
          heroBgColor = col;
        } else {
          heroBgColor = isLightTheme() ? "rgb(216, 223, 226)" : "rgb(60, 42, 68)";
        }
      } catch (e) {
        heroBgColor = isLightTheme() ? "#d8dfe2" : "#3c2a44";
      }
    }
    return heroBgColor;
  }

  function regenerateAtmosphere(w, h) {
    if (w < 24 || h < 24) return;
    stars = [];
    var n = Math.min(220, Math.max(48, Math.floor((w * h / 1e6) * STAR_DENSITY)));
    for (var i = 0; i < n; i++) {
      var roll = Math.random();
      var r;
      var glowMul;
      if (roll < 0.5) {
        r = 0.28 + Math.random() * 0.62;
        glowMul = 1;
      } else if (roll < 0.82) {
        r = 0.92 + Math.random() * 1.05;
        glowMul = 1.12;
      } else if (roll < 0.94) {
        r = 1.85 + Math.random() * 1.65;
        glowMul = 1.28;
      } else {
        r = 3.1 + Math.random() * 3.6;
        glowMul = 1.45;
      }
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: r,
        glowMul: glowMul,
        phase: Math.random() * Math.PI * 2,
        speed: 0.26 + Math.random() * 1.28,
      });
    }
    motes = [];
    var mn = Math.floor(MOTE_COUNT_MIN + Math.random() * (MOTE_COUNT_MAX - MOTE_COUNT_MIN));
    for (var m = 0; m < mn; m++) {
      var mr = Math.random();
      var rad = mr < 0.42 ? 0.22 + Math.random() * 0.58 : mr < 0.8 ? 0.72 + Math.random() * 1.15 : 1.65 + Math.random() * 1.45;
      motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28 - 0.06,
        r: rad,
        a: 0.048 + Math.random() * 0.095,
      });
    }
    shootingStars = [];
    shootingTimer = 0;
    nextShootingIn = 0.8 + Math.random() * 1.8;
    atmoW = w;
    atmoH = h;
  }

  function maybeRegenerateAtmosphere(w, h) {
    if (w < 24 || h < 24) return;
    var need =
      stars.length === 0 ||
      !atmoW ||
      Math.abs(w - atmoW) / atmoW > 0.14 ||
      Math.abs(h - atmoH) / atmoH > 0.14;
    if (need) regenerateAtmosphere(w, h);
  }

  function drawSolidBackdrop(w, h) {
    ctx.fillStyle = solidBackdropFill();
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars(w, h, t, frozen) {
    var pal = atmosphericPalette();
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = frozen
        ? 0.4 + 0.52 * (0.5 + 0.5 * Math.sin(s.phase))
        : 0.34 + 0.66 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      tw *= pal.starTwMul;
      var gm = s.glowMul || 1;
      var dotAlpha = tw * (0.86 + (s.r > 2.2 ? 0.1 : 0));
      ctx.globalAlpha = Math.min(1, dotAlpha);
      ctx.fillStyle = pal.starDot + "0.96)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (s.r < 0.85 ? 0.36 : 0.42), 0, Math.PI * 2);
      ctx.fill();
      var glowA = s.r < 0.75 ? 0.22 : s.r > 1.6 ? 0.48 : 0.34;
      ctx.globalAlpha = Math.min(1, tw * glowA);
      ctx.fillStyle = pal.starGlow + (s.r > 1.5 ? "0.48)" : "0.3)");
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * gm * 1.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function updateAndDrawMotes(w, h, dt) {
    var pal = atmosphericPalette();
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.x += m.vx * dt * 18;
      m.y += m.vy * dt * 18;
      if (m.x < -10) m.x = w + 6;
      if (m.x > w + 10) m.x = -6;
      if (m.y < -10) m.y = h + 6;
      if (m.y > h + 10) m.y = -6;
      var alpha = Math.min(1, m.a * pal.moteAlphaMul);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pal.mote + "0.55)";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function spawnShootingStar(w, h) {
    var x;
    var y;
    var vx;
    var vy;
    if (Math.random() < 0.72) {
      x = w * (0.06 + Math.random() * 0.88);
      y = -35 - Math.random() * 100;
      var angle = Math.PI * (0.48 + Math.random() * 0.22);
      var speed = 420 + Math.random() * 520;
      vx = Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1);
      vy = Math.sin(angle) * speed;
    } else if (Math.random() < 0.55) {
      x = -60 - Math.random() * 100;
      y = h * (0.08 + Math.random() * 0.42);
      vx = 340 + Math.random() * 420;
      vy = 100 + Math.random() * 280;
    } else {
      x = w + 50 + Math.random() * 80;
      y = h * (0.05 + Math.random() * 0.45);
      vx = -(360 + Math.random() * 400);
      vy = 90 + Math.random() * 260;
    }
    var len = 48 + Math.pow(Math.random(), 0.82) * 185;
    var lw = 1.05 + Math.random() * 2.45;
    var headR = 0.7 + Math.random() * 1.85;
    shootingStars.push({ x: x, y: y, vx: vx, vy: vy, len: len, lw: lw, headR: headR });
  }

  function updateShootingStars(w, h, dt) {
    for (var i = shootingStars.length - 1; i >= 0; i--) {
      var sh = shootingStars[i];
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      var out = sh.x < -220 || sh.y < -220 || sh.x > w + 220 || sh.y > h + 220;
      if (out) shootingStars.splice(i, 1);
    }
    shootingTimer += dt;
    if (shootingTimer >= nextShootingIn && shootingStars.length < 3) {
      spawnShootingStar(w, h);
      shootingTimer = 0;
      nextShootingIn = 1.2 + Math.random() * 3.6;
    }
  }

  function drawShootingStars() {
    var pal = atmosphericPalette();
    var light = isLightTheme();
    for (var i = 0; i < shootingStars.length; i++) {
      var sh = shootingStars[i];
      var sp = Math.hypot(sh.vx, sh.vy);
      if (sp < 1e-6) continue;
      var nx = -sh.vx / sp;
      var ny = -sh.vy / sp;
      var lx = sh.x + nx * sh.len;
      var ly = sh.y + ny * sh.len;
      var g = ctx.createLinearGradient(sh.x, sh.y, lx, ly);
      g.addColorStop(0, pal.shootHead + "1)");
      g.addColorStop(0.07, pal.shootBright + (light ? "0.96)" : "0.92)"));
      g.addColorStop(0.32, pal.shootFade + (light ? "0.62)" : "0.45)"));
      g.addColorStop(0.72, pal.shootFade + (light ? "0.22)" : "0.14)"));
      g.addColorStop(1, pal.shootFade + "0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = sh.lw != null ? sh.lw : 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.fillStyle = pal.shootHead + (light ? "0.98)" : "0.96)");
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.headR != null ? sh.headR : 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function lineColor() {
    var light = document.documentElement.getAttribute("data-theme") === "light";
    return light ? "rgba(42, 82, 145, 0.4)" : "rgba(210, 208, 246, 0.2)";
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
    var now = performance.now();
    var dt = Math.min(0.048, (now - lastTs) / 1000);
    lastTs = now;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    maybeRegenerateSpheres(w, h);
    maybeRegenerateAtmosphere(w, h);
    ctx.clearRect(0, 0, w, h);
    drawSolidBackdrop(w, h);

    var t = (now - t0) / 1000;
    if (!reducedMotion) {
      updateShootingStars(w, h, dt);
      drawStars(w, h, t, false);
      updateAndDrawMotes(w, h, dt);
      drawShootingStars();
    } else {
      drawStars(w, h, t, true);
    }

    ctx.strokeStyle = lineColor();
    ctx.lineWidth = 3.25;
    ctx.lineJoin = "round";
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
  maybeRegenerateAtmosphere(rect0.width, rect0.height);
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
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
