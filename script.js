(function () {
  const { THREE } = window;

  const canvas = document.getElementById("planet-canvas");
  const simNav = document.getElementById("sim-nav");
  const popup = document.getElementById("particle-popup");
  const popupTag = document.getElementById("popup-tag");
  const popupTitle = document.getElementById("popup-title");
  const popupCopy = document.getElementById("popup-copy");
  const warpIntro = document.getElementById("warp-intro");
  const warpStartBtn = document.getElementById("warp-start");

  if (!THREE) {
    console.error("Three.js did not load. Check network/CDN access.");
    return;
  }

  // Page phases:
  const PHASE_INTRO = "intro"; // atmospheric background + "Enter Warp Speed?" overlay
  const PHASE_WARP = "warp"; // short transition effect before revealing simulation
  const PHASE_MAIN = "main"; // interactive three-body scene

  // Bodies of three-body world
  // position/velocity are intentionally hand-tuned for visually interesting motion
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
  const WARP_DURATION = 2.8;
  const BASE_CAMERA_Z = 36;
  const BASE_CAMERA_FOV = 40;

  // Core Three.js scene setup
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

  // warpGroup: only visible during warp transition
  const warpGroup = new THREE.Group();
  scene.add(warpGroup);

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
    // Low-cost atmospheric filler points spread through deep space
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

  function createWarpField() {
    // Create line-segment "stars" used in the warp sequence
    const streakCount = 520;
    const positions = new Float32Array(streakCount * 2 * 3);
    const colors = new Float32Array(streakCount * 2 * 3);
    const speeds = new Float32Array(streakCount);
    const tailLengths = new Float32Array(streakCount);

    const color = new THREE.Color("#dfe9ff");

    for (let i = 0; i < streakCount; i += 1) {
      const i6 = i * 6;
      const x = (Math.random() - 0.5) * 56;
      const y = (Math.random() - 0.5) * 36;
      const z = -220 + Math.random() * 220;

      positions[i6] = x;
      positions[i6 + 1] = y;
      positions[i6 + 2] = z;
      positions[i6 + 3] = x;
      positions[i6 + 4] = y;
      positions[i6 + 5] = z - 2;

      colors[i6] = color.r;
      colors[i6 + 1] = color.g;
      colors[i6 + 2] = color.b;
      colors[i6 + 3] = color.r;
      colors[i6 + 4] = color.g;
      colors[i6 + 5] = color.b;

      speeds[i] = 95 + Math.random() * 165;
      tailLengths[i] = 7 + Math.random() * 16;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(geometry, material);
    warpGroup.add(lines);

    return { geometry, speeds, tailLengths, streakCount };
  }

  function createBodyCloud(baseColorHex) {
    // Creates the particle shell around one section body
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
    // Combines visual shell + small glowing core + invisible hit area used by raycasting
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

  // Build scene content
  populateBackgroundAtmosphere();
  const warpField = createWarpField();

  const bodies = sections.map(createBody);
  const hitAreas = bodies.map((body) => body.hitArea);

  // Mutable runtime state
  let phase = PHASE_INTRO;
  let warpElapsed = 0;

  worldGroup.visible = false;
  warpGroup.visible = false;

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

    // Reset per-frame acceleration
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
          // Soft repulsion keeps bodies from collapsing into each other
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

          // Tangential impulse adds "slingshot-like" motion during close passes
          const swirlStrength = CLOSE_PASS_TANGENTIAL * overlapRatio * dt * SIM_SPEED;
          bodyA.velocity.addScaledVector(tempTangent, -swirlStrength / Math.max(bodyA.mass, 0.12));
          bodyB.velocity.addScaledVector(tempTangent, swirlStrength / Math.max(bodyB.mass, 0.12));
        }
      }
    }

    centerOfMass.set(0, 0, 0);
    velocityCenter.set(0, 0, 0);
    let totalMass = 0;

    // Semi-implicit Euler integration with damping and mild center pull
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
          // Hard separation safety net for any residual penetration
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
      // Remove translation drift so bodies remain centered in view over time
      centerOfMass.multiplyScalar(1 / totalMass);
      velocityCenter.multiplyScalar(1 / totalMass);

      for (const body of bodies) {
        body.group.position.sub(centerOfMass);
        body.velocity.sub(velocityCenter);
      }
    }

    if (minPairDistance < RESONANCE_DISTANCE) {
      // Drives visual pulse during near-collision moments
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
      // If motion gets too slow, inject controlled kicks to re-energize system
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
  const navTabs = simNav ? [...simNav.querySelectorAll(".sim-nav__tab")] : [];
  let navLockedSectionId = null;
  /** When true, user picked a tab from the nav: freeze sim and block raycast. Canvas pin does not set this. */
  let navFreezeSim = false;
  const dragState = {
    active: false,
    moved: false,
    previousX: 0,
    previousY: 0,
  };

  let hoveredBody = null;
  let pinnedBody = null;

  function syncNavUI() {
    for (const tab of navTabs) {
      const id = tab.dataset.sectionId;
      const selected = navLockedSectionId === id;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
    }
  }

  const tempScreen = new THREE.Vector3();

  function getPopupAnchorForBody(body) {
    if (!body) {
      return { x: pointerPx.x, y: pointerPx.y };
    }
    body.group.getWorldPosition(tempScreen);
    tempScreen.project(camera);
    const rect = canvas.getBoundingClientRect();
    const x = (tempScreen.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-tempScreen.y * 0.5 + 0.5) * rect.height + rect.top;
    return { x, y };
  }

  function showPopup(section, x, y, isPaused) {
    // Positions popup near cursor while clamping to viewport bounds
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

  function beginWarp() {
    // Transition: intro -> warp
    if (phase !== PHASE_INTRO) {
      return;
    }

    phase = PHASE_WARP;
    warpElapsed = 0;
    hoveredBody = null;
    pinnedBody = null;
    navLockedSectionId = null;
    navFreezeSim = false;
    dragState.active = false;
    dragState.moved = false;
    warpGroup.visible = true;
    worldGroup.visible = false;
    hidePopup();
    if (warpIntro) {
      warpIntro.classList.add("is-hidden");
    }
  }

  function finishWarp() {
    // Transition: warp -> main simulation
    phase = PHASE_MAIN;
    warpElapsed = 0;
    warpGroup.visible = false;
    worldGroup.visible = true;
    camera.position.set(0, 0, BASE_CAMERA_Z);
    camera.fov = BASE_CAMERA_FOV;
    camera.updateProjectionMatrix();
  }

  function updateWarpField(dt) {
    // Moves warp streaks toward camera; recycled streaks re-enter from deep Z
    const posAttr = warpField.geometry.attributes.position;
    const arr = posAttr.array;
    const accel = Math.min(1, warpElapsed / (WARP_DURATION * 0.28));
    const warpIntensity = 1.1 + accel * 6.2;

    for (let i = 0; i < warpField.streakCount; i += 1) {
      const i6 = i * 6;
      let x = arr[i6];
      let y = arr[i6 + 1];
      let z = arr[i6 + 2];

      z += warpField.speeds[i] * dt * warpIntensity;

      if (z > 34) {
        x = (Math.random() - 0.5) * 66;
        y = (Math.random() - 0.5) * 42;
        z = -250 - Math.random() * 80;
      }

      const tail = warpField.tailLengths[i] * (0.8 + warpIntensity * 0.78);

      arr[i6] = x;
      arr[i6 + 1] = y;
      arr[i6 + 2] = z;
      arr[i6 + 3] = x;
      arr[i6 + 4] = y;
      arr[i6 + 5] = z - tail;
    }

    posAttr.needsUpdate = true;

    backgroundGroup.rotation.z += dt * 0.08;
    backgroundGroup.rotation.y += dt * 0.05;
    camera.position.z = BASE_CAMERA_Z - accel * 3.4;
    camera.fov = BASE_CAMERA_FOV + accel * 23;
    camera.updateProjectionMatrix();

    if (warpElapsed >= WARP_DURATION) {
      finishWarp();
    }
  }

  function updateHoverState() {
    // Raycast against invisible hit spheres so interactions are forgiving
    if (phase !== PHASE_MAIN) {
      hoveredBody = null;
      return;
    }

    if (navFreezeSim) {
      hoveredBody = null;
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(hitAreas, false);

    hoveredBody = null;

    if (intersections.length > 0) {
      const id = intersections[0].object.userData.sectionId;
      hoveredBody = bodies.find((body) => body.id === id) || null;
    }
  }

  function onPointerDown(event) {
    // Start drag rotation gesture (main phase only)
    if (phase !== PHASE_MAIN) {
      return;
    }

    dragState.active = true;
    dragState.moved = false;
    dragState.previousX = event.clientX;
    dragState.previousY = event.clientY;
  }

  function onPointerMove(event) {
    // Always track pointer for popup placement; only rotate in main phase
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointerPx.x = event.clientX;
    pointerPx.y = event.clientY;

    if (phase !== PHASE_MAIN) {
      return;
    }

    if (dragState.active) {
      const deltaX = event.clientX - dragState.previousX;
      const deltaY = event.clientY - dragState.previousY;

      if (Math.abs(deltaX) + Math.abs(deltaY) > 1.2) {
        // Prevent accidental click-selection after a true drag
        dragState.moved = true;
      }

      worldGroup.rotation.y += deltaX * 0.005;
      worldGroup.rotation.x += deltaY * 0.005;
      worldGroup.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, worldGroup.rotation.x));

      dragState.previousX = event.clientX;
      dragState.previousY = event.clientY;
    }

  }

  function onPointerUp() {
    dragState.active = false;
  }

  function onPointerLeave() {
    // Hide hover state when cursor exits canvas
    pointer.set(2, 2);
    hoveredBody = null;
    dragState.active = false;
    canvas.style.cursor = "default";
    if (!pinnedBody && !navLockedSectionId) {
      hidePopup();
    }
  }

  function clearSectionSelection() {
    pinnedBody = null;
    navLockedSectionId = null;
    navFreezeSim = false;
    syncNavUI();
  }

  function onClick() {
    // Click = pin hovered body popup. Click empty space = unpin
    if (phase !== PHASE_MAIN) {
      return;
    }

    if (dragState.moved) {
      dragState.moved = false;
      return;
    }

    if (hoveredBody) {
      pinnedBody = hoveredBody;
      navLockedSectionId = pinnedBody.id;
      navFreezeSim = false;
      syncNavUI();
      return;
    }

    clearSectionSelection();
    hidePopup();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onClick);
  window.addEventListener("pointerup", onPointerUp);
  if (warpStartBtn) {
    warpStartBtn.addEventListener("click", beginWarp);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearSectionSelection();
      hidePopup();
    }
  });

  for (const tab of navTabs) {
    tab.addEventListener("click", (e) => {
      e.stopPropagation();
      if (phase !== PHASE_MAIN) {
        return;
      }
      navLockedSectionId = tab.dataset.sectionId;
      pinnedBody = null;
      navFreezeSim = true;
      syncNavUI();
    });
  }

  document.addEventListener("click", (e) => {
    if (phase !== PHASE_MAIN) {
      return;
    }
    if (e.target.closest(".sim-nav")) {
      return;
    }
    if (e.target === canvas) {
      return;
    }
    clearSectionSelection();
  });

  function resize() {
    // Keep renderer/camera in sync with viewport
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
    // Single render loop with phase-based behavior:
    // intro -> idle atmosphere
    // warp -> streak animation
    // main -> full physics + interactions
    const dt = Math.min(clock.getDelta(), 0.04);
    const elapsed = clock.elapsedTime;

    updateHoverState();

    if (simNav) {
      simNav.classList.toggle("sim-nav--hidden", phase !== PHASE_MAIN);
    }
    if (phase !== PHASE_MAIN && (navLockedSectionId || navFreezeSim || pinnedBody)) {
      pinnedBody = null;
      navLockedSectionId = null;
      navFreezeSim = false;
      syncNavUI();
    }

    if (phase === PHASE_WARP) {
      warpElapsed += dt;
      updateWarpField(dt);
      hidePopup();
      canvas.style.cursor = "default";
    } else if (phase === PHASE_MAIN) {
      const simFrozen = navFreezeSim;
      const isPaused = hoveredBody !== null || simFrozen;
      if (!isPaused) {
        integrateThreeBody(dt);
      }
      resonancePulse = Math.max(0, resonancePulse - dt * 0.95);

      const activeBody = simFrozen
        ? bodies.find((b) => b.id === navLockedSectionId) || null
        : hoveredBody || pinnedBody;

      const spinDt = simFrozen ? 0 : dt;

      for (const body of bodies) {
        // Body-local idle spin + active/near-collision visual emphasis
        body.material.uniforms.uTime.value = elapsed * 1.2;
        const isActive = activeBody && activeBody.id === body.id;
        body.material.uniforms.uPointSize.value = (isActive ? 185 : 150) + resonancePulse * 36;
        body.core.material.emissiveIntensity = (isActive ? 0.85 : 0.65) + resonancePulse * 0.7;

        body.group.rotation.x += body.spin.x * spinDt;
        body.group.rotation.y += body.spin.y * spinDt;
        body.group.rotation.z += body.spin.z * spinDt;

        const targetScale = (isActive ? 1.08 : 1) + resonancePulse * 0.09;
        body.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
      }

      const anchor = activeBody ? getPopupAnchorForBody(activeBody) : { x: pointerPx.x, y: pointerPx.y };
      const pausedPopup = hoveredBody !== null || simFrozen;
      if (activeBody) {
        showPopup(activeBody, anchor.x, anchor.y, pausedPopup);
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
    } else {
      backgroundGroup.rotation.y += dt * 0.013;
      backgroundGroup.rotation.x += dt * 0.006;
      hidePopup();
      canvas.style.cursor = "default";
    }

    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }

  window.requestAnimationFrame(animate);
})();
