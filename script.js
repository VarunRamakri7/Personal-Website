(function () {
  const { THREE } = window;

  const canvas = document.getElementById("planet-canvas");
  const popup = document.getElementById("particle-popup");
  const popupTag = document.getElementById("popup-tag");
  const popupTitle = document.getElementById("popup-title");
  const popupCopy = document.getElementById("popup-copy");
  // const warpIntro = document.getElementById("warp-intro");
  // const warpStartBtn = document.getElementById("warp-start");

  if (!THREE) {
    console.error("Three.js did not load. Check network/CDN access.");
    return;
  }

  // Page phases
  // const PHASE_INTRO = "intro";
  // const PHASE_WARP = "warp";
  const PHASE_MAIN = "main";

  // Bodies of three-body world.
  // position/velocity are intentionally hand-tuned for visually interesting motion.
  const sections = [
    {
      id: "home",
      tag: "HOME",
      title: "Home Section",
      copy: "Primary intro area. Hovering this body pauses the simulation.",
      color: "#97b6ff",
      mass: 1.18,
      position: new THREE.Vector3(-8.8, -1.6, 0.7),
      velocity: new THREE.Vector3(-0.22, 0.68, 0.84),
    },
    {
      id: "works",
      tag: "WORKS",
      title: "Works Section",
      copy: "Project showcase area. Use this body for featured case studies.",
      color: "#8de2cf",
      mass: 1.35,
      position: new THREE.Vector3(9.1, 0.5, -1.2),
      velocity: new THREE.Vector3(0.35, -0.56, -0.92),
    },
    {
      id: "contact",
      tag: "CONTACT",
      title: "Contact Section",
      copy: "Contact and CTA area. Keep this short and direct.",
      color: "#f7c3a4",
      mass: 1.05,
      position: new THREE.Vector3(0.4, 8.2, 1.4),
      velocity: new THREE.Vector3(-0.74, -0.16, 0.46),
    },
  ];

  // Physics/simulation tuning
  // Mostly "feel" adjustments
  const SIM_G = 23;
  const SOFTENING = 18;
  const CENTER_PULL = 0.045;
  const DAMPING = 0.9992;
  const SIM_SPEED = 0.9;
  const BODY_RADIUS = 2.05;
  const BODY_PARTICLES = 2600;
  const WORLD_RADIUS = 18;
  const BG_SPHERE_POINT_SIZE = 0.23;
  const BG_DUST_POINT_SIZE = 0.17;
  const OVERLAP_AVOID_DISTANCE = BODY_RADIUS * 3.30;
  const OVERLAP_REPULSION = 150;
  const HARD_MIN_DISTANCE = BODY_RADIUS * 2.0;
  const CLOSE_PASS_TANGENTIAL = 2.9;
  const RESONANCE_DISTANCE = BODY_RADIUS * 3.9;
  const MIN_KINETIC_ENERGY = 0.55;
  const LOW_ENERGY_DELAY = 1.8;
  const ENERGY_KICK = 1.7;
  const ENERGY_RANDOMNESS = 0.32;
  const BASE_CAMERA_Z = 36;
  const BASE_CAMERA_FOV = 40;

  // Core Three.js scene setup.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_CAMERA_FOV, 1, 0.1, 1000);
  camera.position.set(0, 0, BASE_CAMERA_Z);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const ambient = new THREE.AmbientLight("#ffffff", 0.45);
  const key = new THREE.DirectionalLight("#e2ecff", 0.9);
  key.position.set(10, 8, 10);
  scene.add(ambient, key);

  // worldGroup: interactive simulation space (rotated by drag during main phase)
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // backgroundGroup: always-visible ambience behind the simulation
  const backgroundGroup = new THREE.Group();
  scene.add(backgroundGroup);

  // Invisible "container sphere" for conceptual world boundary and easier future extensions
  const worldSphere = new THREE.Mesh(
    new THREE.SphereGeometry(WORLD_RADIUS, 32, 32),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  worldGroup.add(worldSphere);

  // Shader pair for each body's particle shell (Mobile-friendly)
  const bodyVertexShader = `
  uniform float uTime;
  uniform float uPointSize;
  attribute vec3 color;
  varying vec3 vColor;

  void main() {
    vColor = color;

    vec3 pos = position;
    float wiggle = sin(uTime * 2.2 + position.y * 2.6 + position.x * 1.3) * 0.04;
    pos += normalize(position) * wiggle;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (uPointSize / -mvPosition.z) * (1.0 + 0.12 * sin(uTime * 2.8 + position.x * 3.8));
    gl_Position = projectionMatrix * mvPosition;
  }
  `;

  const bodyFragmentShader = `
  varying vec3 vColor;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    float core = smoothstep(0.5, 0.03, dist);
    float halo = smoothstep(0.5, 0.22, dist);
    vec3 glow = vColor * (0.8 + halo * 0.9 + core * 0.5);

    gl_FragColor = vec4(glow, core * 0.95);
  }
  `;

  function createBackgroundSphereCluster(options) {
    // Builds one small static point cloud
    const {
      radius,
      pointsCount,
      shellSpread,
      colorHex,
      pointSize = BG_SPHERE_POINT_SIZE,
      opacity = 0.42,
      position = new THREE.Vector3(),
    } = options;

    const positions = new Float32Array(pointsCount * 3);
    const colors = new Float32Array(pointsCount * 3);
    const baseColor = new THREE.Color(colorHex);
    const pale = new THREE.Color("#f6fbff");

    for (let i = 0; i < pointsCount; i += 1) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius + (Math.random() - 0.5) * shellSpread;

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      const tint = baseColor.clone().lerp(pale, Math.random() * 0.35);
      colors[i3] = tint.r;
      colors[i3 + 1] = tint.g;
      colors[i3 + 2] = tint.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      transparent: true,
      opacity,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const cloud = new THREE.Points(geometry, material);
    cloud.position.copy(position);
    backgroundGroup.add(cloud);
  }

  function createBackgroundDust(count) {
    // Low-cost atmospheric filler points spread through deep space.
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorA = new THREE.Color("#a7c1ff");
    const colorB = new THREE.Color("#9ce2d8");
    const colorC = new THREE.Color("#f0bfd2");

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const spread = 90;
      positions[i3] = (Math.random() - 0.5) * spread;
      positions[i3 + 1] = (Math.random() - 0.5) * spread;
      positions[i3 + 2] = -18 + (Math.random() - 0.5) * spread;

      const roll = Math.random();
      const c = roll < 0.34 ? colorA : roll < 0.67 ? colorB : colorC;
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: BG_DUST_POINT_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const dust = new THREE.Points(geometry, material);
    backgroundGroup.add(dust);
  }

  function populateBackgroundAtmosphere() {
    // Populate ambience once at startup: dust + randomized mini spheres
    createBackgroundDust(2400);

    const palette = ["#9bb9ff", "#8fdbc9", "#f1c3ab", "#adc3ff", "#bfd8ff", "#9ad7ca", "#a7bfff", "#b7c8ff"];
    const backgroundSpheres = [];
    const targetCount = 12;
    let attempts = 0;

    while (backgroundSpheres.length < targetCount && attempts < targetCount * 80) {
      attempts += 1;

      const x = (Math.random() - 0.5) * 84;
      const y = (Math.random() - 0.5) * 54;
      const z = -20 - Math.random() * 34;

      // Keep the center area cleaner so the primary simulation remains readable
      if (Math.abs(x) < 11 && Math.abs(y) < 8 && z > -38) {
        continue;
      }

      let tooClose = false;
      for (const item of backgroundSpheres) {
        const dx = x - item.position.x;
        const dy = y - item.position.y;
        if (dx * dx + dy * dy < 70) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) {
        continue;
      }

      backgroundSpheres.push({
        position: new THREE.Vector3(x, y, z),
        radius: 2.1 + Math.random() * 2.2,
        pointsCount: 180 + Math.floor(Math.random() * 300),
        shellSpread: 0.7 + Math.random() * 0.9,
        colorHex: palette[Math.floor(Math.random() * palette.length)],
        opacity: 0.26 + Math.random() * 0.18,
      });
    }

    for (const sphere of backgroundSpheres) {
      createBackgroundSphereCluster(sphere);
    }
  }

  function createBodyCloud(baseColorHex) {
    // Creates the particle shell around one section body.
    const baseColor = new THREE.Color(baseColorHex);
    const white = new THREE.Color("#ffffff");

    const positions = new Float32Array(BODY_PARTICLES * 3);
    const colors = new Float32Array(BODY_PARTICLES * 3);

    for (let i = 0; i < BODY_PARTICLES; i += 1) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = BODY_RADIUS + (Math.random() - 0.5) * 0.45;

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      const blend = 0.2 + Math.random() * 0.8;
      const c = baseColor.clone().lerp(white, blend * 0.35);
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      vertexShader: bodyVertexShader,
      fragmentShader: bodyFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPointSize: { value: 150 },
      },
    });

    const points = new THREE.Points(geometry, material);
    return { points, material };
  }

  function createBody(section) {
    // Combines visual shell + small glowing core + invisible hit area used by raycasting.
    const group = new THREE.Group();
    const cloud = createBodyCloud(section.color);
    group.add(cloud.points);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      new THREE.MeshStandardMaterial({
        color: section.color,
        emissive: section.color,
        emissiveIntensity: 0.65,
        roughness: 0.3,
        metalness: 0.1,
      })
    );
    group.add(core);

    const hitArea = new THREE.Mesh(
      new THREE.SphereGeometry(BODY_RADIUS * 1.18, 20, 20),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitArea.userData.sectionId = section.id;
    group.add(hitArea);

    group.position.copy(section.position);
    worldGroup.add(group);

    return {
      ...section,
      group,
      core,
      hitArea,
      material: cloud.material,
      velocity: section.velocity.clone(),
      acceleration: new THREE.Vector3(),
      spin: new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35),
    };
  }

  // Build scene content.
  populateBackgroundAtmosphere();

  const bodies = sections.map(createBody);
  const hitAreas = bodies.map((body) => body.hitArea);

  // Mutable runtime state
  let phase = PHASE_MAIN;
  worldGroup.visible = true;

  const tempForce = new THREE.Vector3();
  const tempDelta = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();
  const tempTangent = new THREE.Vector3();
  const tempAxis = new THREE.Vector3();
  const tempRadial = new THREE.Vector3();
  const tempRandom = new THREE.Vector3();
  const centerOfMass = new THREE.Vector3();
  const velocityCenter = new THREE.Vector3();
  let resonancePulse = 0;
  let lowEnergyTimer = 0;

  function integrateThreeBody(dt) {
    // One simulation step:
    // 1) pairwise gravity + short-range avoidance/swirl
    // 2) integrate velocities/positions
    // 3) hard overlap correction
    // 4) center-of-mass stabilization
    // 5) resonance + anti-stall energy kick
    let minPairDistance = Infinity;

    // Reset per-frame acceleration.
    for (const body of bodies) {
      body.acceleration.set(0, 0, 0);
    }

    // Pairwise forces for all body pairs (N=3 here, so cost is tiny)
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];

        tempForce.subVectors(bodyB.group.position, bodyA.group.position);
        const rawDistSq = tempForce.lengthSq();
        const rawDist = Math.sqrt(rawDistSq) + 1e-6;
        if (rawDist < minPairDistance) {
          minPairDistance = rawDist;
        }
        const distSq = rawDistSq + SOFTENING;
        const invDist = 1 / Math.sqrt(distSq);
        const factor = SIM_G * invDist * invDist * invDist;

        bodyA.acceleration.addScaledVector(tempForce, factor * bodyB.mass);
        bodyB.acceleration.addScaledVector(tempForce, -factor * bodyA.mass);

        if (rawDist < OVERLAP_AVOID_DISTANCE) {
          // Soft repulsion keeps bodies from collapsing into each other.
          const overlapRatio = 1 - rawDist / OVERLAP_AVOID_DISTANCE;
          const repulsion = OVERLAP_REPULSION * overlapRatio * overlapRatio;
          const repulseScaleA = -(repulsion / rawDist) / Math.max(bodyA.mass, 0.12);
          const repulseScaleB = (repulsion / rawDist) / Math.max(bodyB.mass, 0.12);

          bodyA.acceleration.addScaledVector(tempForce, repulseScaleA);
          bodyB.acceleration.addScaledVector(tempForce, repulseScaleB);

          tempNormal.copy(tempForce).multiplyScalar(1 / rawDist);
          tempAxis.set(0, 0, 1);
          if (Math.abs(tempNormal.dot(tempAxis)) > 0.85) {
            tempAxis.set(0, 1, 0);
          }
          tempTangent.crossVectors(tempNormal, tempAxis).normalize();

          // Tangential impulse adds "slingshot-like" motion during close passes.
          const swirlStrength = CLOSE_PASS_TANGENTIAL * overlapRatio * dt * SIM_SPEED;
          bodyA.velocity.addScaledVector(tempTangent, -swirlStrength / Math.max(bodyA.mass, 0.12));
          bodyB.velocity.addScaledVector(tempTangent, swirlStrength / Math.max(bodyB.mass, 0.12));
        }
      }
    }

    centerOfMass.set(0, 0, 0);
    velocityCenter.set(0, 0, 0);
    let totalMass = 0;

    // Semi-implicit Euler integration with damping and mild center pull.
    for (const body of bodies) {
      body.velocity.addScaledVector(body.acceleration, dt * SIM_SPEED);
      body.velocity.addScaledVector(body.group.position, -CENTER_PULL * dt);
      body.velocity.multiplyScalar(DAMPING);
      body.group.position.addScaledVector(body.velocity, dt * SIM_SPEED);

      centerOfMass.addScaledVector(body.group.position, body.mass);
      velocityCenter.addScaledVector(body.velocity, body.mass);
      totalMass += body.mass;
    }

    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];

        tempDelta.subVectors(bodyB.group.position, bodyA.group.position);
        const dist = tempDelta.length();

        if (dist > 1e-6 && dist < HARD_MIN_DISTANCE) {
          // Hard separation safety net for any residual penetration.
          tempDelta.multiplyScalar(1 / dist);

          const penetration = HARD_MIN_DISTANCE - dist;
          const push = penetration * 0.5;

          bodyA.group.position.addScaledVector(tempDelta, -push);
          bodyB.group.position.addScaledVector(tempDelta, push);

          const relativeSpeed =
            bodyB.velocity.dot(tempDelta) - bodyA.velocity.dot(tempDelta);

          if (relativeSpeed < 0) {
            const bounceDamp = -relativeSpeed * 0.32;
            bodyA.velocity.addScaledVector(tempDelta, -bounceDamp);
            bodyB.velocity.addScaledVector(tempDelta, bounceDamp);
          }
        }
      }
    }

    if (totalMass > 0) {
      // Remove translation drift so bodies remain centered in view over time.
      centerOfMass.multiplyScalar(1 / totalMass);
      velocityCenter.multiplyScalar(1 / totalMass);

      for (const body of bodies) {
        body.group.position.sub(centerOfMass);
        body.velocity.sub(velocityCenter);
      }
    }

    if (minPairDistance < RESONANCE_DISTANCE) {
      // Drives visual pulse during near-collision moments.
      const resonanceGain = 1 - minPairDistance / RESONANCE_DISTANCE;
      resonancePulse = Math.max(resonancePulse, resonanceGain);
    }

    let totalKinetic = 0;
    for (const body of bodies) {
      totalKinetic += 0.5 * body.mass * body.velocity.lengthSq();
    }

    if (totalKinetic < MIN_KINETIC_ENERGY) {
      lowEnergyTimer += dt;
    } else {
      lowEnergyTimer = Math.max(0, lowEnergyTimer - dt * 0.8);
    }

    if (lowEnergyTimer > LOW_ENERGY_DELAY) {
      // If motion gets too slow, inject controlled kicks to re-energize system.
      for (const body of bodies) {
        const radialLength = body.group.position.length() + 1e-6;
        tempRadial.copy(body.group.position).multiplyScalar(1 / radialLength);

        tempAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        tempTangent.crossVectors(tempRadial, tempAxis);

        if (tempTangent.lengthSq() < 1e-6) {
          tempAxis.set(0, 1, 0);
          tempTangent.crossVectors(tempRadial, tempAxis);
        }
        tempTangent.normalize();

        tempRandom.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

        const baseKick = ENERGY_KICK * (0.8 + Math.random() * 0.6);
        body.velocity.addScaledVector(tempTangent, baseKick / Math.max(body.mass, 0.12));
        body.velocity.addScaledVector(
          tempRandom,
          (ENERGY_RANDOMNESS * (0.4 + Math.random() * 0.8)) / Math.max(body.mass, 0.12)
        );
      }

      resonancePulse = Math.max(resonancePulse, 0.7);
      lowEnergyTimer = 0;
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  const pointerPx = { x: 0, y: 0 };
  const dragState = {
    active: false,
    moved: false,
    previousX: 0,
    previousY: 0,
  };

  let hoveredBody = null;
  let pinnedBody = null;

  function showPopup(section, x, y, isPaused) {
    // Positions popup near cursor while clamping to viewport bounds.
    popupTag.textContent = section.tag;
    popupTitle.textContent = section.title;
    let copy = isPaused
      ? `${section.copy} (Simulation paused)`
      : section.copy;
    if (resonancePulse > 0.45) {
      copy += " Resonance surge.";
    }
    popupCopy.textContent = copy;

    const margin = 12;
    const popupWidth = popup.offsetWidth || 280;
    const popupHeight = popup.offsetHeight || 120;

    const left = Math.max(margin, Math.min(x + 16, window.innerWidth - popupWidth - margin));
    const top = Math.max(margin, Math.min(y + 16, window.innerHeight - popupHeight - margin));

    popup.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    popup.classList.remove("is-hidden");
  }

  function hidePopup() {
    popup.classList.add("is-hidden");
  }

  /*

  function updateHoverState() {
    // Raycast against invisible hit spheres so interactions are forgiving.
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(hitAreas, false);

    hoveredBody = null;

    if (intersections.length > 0) {
      const id = intersections[0].object.userData.sectionId;
      hoveredBody = bodies.find((body) => body.id === id) || null;
    }
  }

  function onPointerDown(event) {
    // Start drag rotation gesture.
    dragState.active = true;
    dragState.moved = false;
    dragState.previousX = event.clientX;
    dragState.previousY = event.clientY;
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointerPx.x = event.clientX;
    pointerPx.y = event.clientY;

    if (dragState.active) {
      const deltaX = event.clientX - dragState.previousX;
      const deltaY = event.clientY - dragState.previousY;

      if (Math.abs(deltaX) + Math.abs(deltaY) > 1.2) {
        // Prevent accidental click-selection after a true drag.
        dragState.moved = true;
      }

      worldGroup.rotation.y += deltaX * 0.005;
      worldGroup.rotation.x += deltaY * 0.005;
      worldGroup.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, worldGroup.rotation.x));

      dragState.previousX = event.clientX;
      dragState.previousY = event.clientY;
    }

    if (pinnedBody) {
      showPopup(pinnedBody, pointerPx.x, pointerPx.y, false);
    }
  }

  function onPointerUp() {
    dragState.active = false;
  }

  function onPointerLeave() {
    // Hide hover state when cursor exits canvas.
    pointer.set(2, 2);
    hoveredBody = null;
    dragState.active = false;
    canvas.style.cursor = "default";
    if (!pinnedBody) {
      hidePopup();
    }
  }

  function onClick() {
    // Click = pin hovered body popup. Click empty space = unpin.
    if (phase !== PHASE_MAIN) {
      return;
    }

    if (dragState.moved) {
      dragState.moved = false;
      return;
    }

    if (hoveredBody) {
      pinnedBody = hoveredBody;
      showPopup(pinnedBody, pointerPx.x, pointerPx.y, true);
      return;
    }

    pinnedBody = null;
    hidePopup();
  }


  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onClick);
  window.addEventListener("pointerup", onPointerUp);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      pinnedBody = null;
      hidePopup();
    }
  });

  function resize() {
    // Keep renderer/camera in sync with viewport.
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();

  function animate() {
    // Three-body simulation + interactions (intro / warp / popups commented out).
    const dt = Math.min(clock.getDelta(), 0.04);
    const elapsed = clock.elapsedTime;

    updateHoverState();

    const isPaused = hoveredBody !== null;
    if (!isPaused) {
      integrateThreeBody(dt);
    }
    resonancePulse = Math.max(0, resonancePulse - dt * 0.95);

    const activeBody = hoveredBody || pinnedBody;

    for (const body of bodies) {
      body.material.uniforms.uTime.value = elapsed * 1.2;
      const isActive = activeBody && activeBody.id === body.id;
      body.material.uniforms.uPointSize.value = (isActive ? 185 : 150) + resonancePulse * 36;
      body.core.material.emissiveIntensity = (isActive ? 0.85 : 0.65) + resonancePulse * 0.7;

      body.group.rotation.x += body.spin.x * dt;
      body.group.rotation.y += body.spin.y * dt;
      body.group.rotation.z += body.spin.z * dt;

      const targetScale = (isActive ? 1.08 : 1) + resonancePulse * 0.09;
      body.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
    }

    if (activeBody) {
      showPopup(activeBody, pointerPx.x, pointerPx.y, hoveredBody !== null);
    } else {
      hidePopup();
    }

    if (dragState.active) {
      canvas.style.cursor = "grabbing";
    } else if (hoveredBody) {
      canvas.style.cursor = "pointer";
    } else {
      canvas.style.cursor = "grab";
    }

    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }

  window.requestAnimationFrame(animate);
})();
