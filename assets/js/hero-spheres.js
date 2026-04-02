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

  /* nx, ny: normalized anchor (-0.5..0.5 from center); r: relative radius; s*: rad/s; o*: phase */
  var spheres = [
    { nx: 0.1, ny: -0.06, r: 0.44, srx: 0.33, sry: 0.41, srz: 0.29, ox: 0.4, oy: 0.9, oz: 0.5 },
    { nx: -0.32, ny: 0.2, r: 0.37, srx: -0.24, sry: 0.52, srz: 0.21, ox: 2.1, oy: 0.7, oz: 1.5 },
    { nx: 0.36, ny: 0.3, r: 0.34, srx: 0.44, sry: -0.28, srz: 0.35, ox: 0.8, oy: 2.0, oz: 0.55 },
    { nx: -0.12, ny: -0.36, r: 0.49, srx: 0.2, sry: 0.36, srz: -0.42, ox: 2.9, oy: 2.2, oz: 1.1 },
    { nx: 0.4, ny: -0.26, r: 0.32, srx: -0.37, sry: 0.23, srz: 0.4, ox: 4.2, oy: 1.2, oz: 2.6 },
    { nx: -0.4, ny: 0.04, r: 0.45, srx: 0.29, sry: -0.4, srz: 0.24, ox: 5.0, oy: 3.4, oz: 0.85 },
  ];

  var t0 = performance.now();

  function lineColor() {
    var light = document.documentElement.getAttribute("data-theme") === "light";
    return light ? "rgba(79, 134, 198, 0.24)" : "rgba(147, 197, 253, 0.18)";
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
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = lineColor();
    ctx.lineWidth = 1;
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
