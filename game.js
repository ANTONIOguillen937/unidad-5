(() => {
  const canvas = document.getElementById('game');
  const hud = document.getElementById('hud');
  const menu = document.getElementById('menu');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOver = document.getElementById('gameOver');
  const touchControls = document.getElementById('touchControls');
  const speedEl = document.getElementById('speed');
  const distanceEl = document.getElementById('distance');
  const scoreEl = document.getElementById('score');
  const nitroEl = document.getElementById('nitro');
  const finalStats = document.getElementById('finalStats');

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) touchControls.classList.remove('hidden');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050816, 20, 140);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 4.5, 8);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0x9adfff, 1.1);
  dir.position.set(5, 10, 5);
  scene.add(dir);

  // Road
  const roadGeo = new THREE.PlaneGeometry(14, 400, 1, 20);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1b2238, roughness: 0.95, metalness: 0.05 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.z = -120;
  scene.add(road);

  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x0ef0ff, emissive: 0x08313a, emissiveIntensity: 0.4 });
  const leftShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 400), shoulderMat);
  leftShoulder.position.set(-7, 0.05, -120);
  const rightShoulder = leftShoulder.clone();
  rightShoulder.position.x = 7;
  scene.add(leftShoulder, rightShoulder);

  const laneMarks = [];
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 4), markMat);
    m.position.set(0, 0.06, -i * 12);
    scene.add(m);
    laneMarks.push(m);
  }

  // Ground glow
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(80, 400), new THREE.MeshBasicMaterial({ color: 0x08142c }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, -0.01, -120);
  scene.add(glow);

  // Player car
  const player = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3.6), new THREE.MeshStandardMaterial({ color: 0x1de9b6, metalness: 0.5, roughness: 0.25, emissive: 0x043d33 }));
  body.position.y = 0.5;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1.4), new THREE.MeshStandardMaterial({ color: 0x0b1020, metalness: 0.8, roughness: 0.1 }));
  cabin.position.set(0, 0.9, -0.2);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0xff3d81 }));
  spoiler.position.set(0, 0.85, 1.6);
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: 0xb3f7ff }));
  headL.position.set(-0.5, 0.55, -1.82);
  const headR = headL.clone(); headR.position.x = 0.5;
  player.add(body, cabin, spoiler, headL, headR);
  player.position.set(0, 0, 2);
  scene.add(player);

  function makeEnemy(color) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 3.4), new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.35 }));
    b.position.y = 0.5;
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.7, roughness: 0.15 }));
    c.position.set(0, 0.85, -0.1);
    g.add(b, c);
    return g;
  }

  const enemies = [];
  const enemyColors = [0xff5252, 0xffd740, 0x7c4dff, 0x40c4ff, 0xff6e40];
  function spawnEnemy(zBase = -120) {
    const e = makeEnemy(enemyColors[Math.floor(Math.random() * enemyColors.length)]);
    const lanes = [-4, -1.3, 1.3, 4];
    e.position.set(lanes[Math.floor(Math.random() * lanes.length)], 0, zBase - Math.random() * 80);
    e.userData.speed = 0.25 + Math.random() * 0.25;
    scene.add(e);
    enemies.push(e);
  }
  for (let i = 0; i < 8; i++) spawnEnemy(-40 - i * 18);

  const orbs = [];
  function spawnOrb(zBase = -120) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00aacc, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.1 }));
    const lanes = [-4, -1.3, 1.3, 4];
    orb.position.set(lanes[Math.floor(Math.random() * lanes.length)], 0.7, zBase - Math.random() * 100);
    scene.add(orb);
    orbs.push(orb);
  }
  for (let i = 0; i < 6; i++) spawnOrb(-30 - i * 25);

  const buildings = [];
  function addBuilding(x, z) {
    const h = 6 + Math.random() * 18;
    const b = new THREE.Mesh(new THREE.BoxGeometry(4 + Math.random()*3, h, 4 + Math.random()*3), new THREE.MeshStandardMaterial({ color: 0x101a33, emissive: 0x081020, roughness: 0.9 }));
    b.position.set(x, h / 2, z);
    scene.add(b);
    buildings.push(b);
  }
  for (let i = 0; i < 24; i++) {
    addBuilding(-14 - Math.random() * 8, -i * 18);
    addBuilding(14 + Math.random() * 8, -i * 18);
  }

  const state = {
    running: false, paused: false, over: false,
    speed: 0, maxSpeed: 1.35, accel: 0.012, brake: 0.02, friction: 0.006,
    steer: 0, distance: 0, score: 0, nitro: 100, nitroActive: false
  };
  const input = { left: false, right: false, accel: false, brake: false, nitro: false };

  function resetGame() {
    state.running = true; state.paused = false; state.over = false;
    state.speed = 0; state.steer = 0; state.distance = 0; state.score = 0; state.nitro = 100; state.nitroActive = false;
    player.position.set(0, 0, 2);
    enemies.forEach((e, i) => { e.position.z = -40 - i * 18; e.position.x = [-4,-1.3,1.3,4][i%4]; });
    orbs.forEach((o, i) => { o.position.z = -30 - i * 25; o.position.x = [-4,-1.3,1.3,4][(i+1)%4]; });
    hud.classList.remove('hidden');
    menu.classList.add('hidden');
    gameOver.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
  }

  function endGame() {
    state.over = true; state.running = false;
    finalStats.textContent = `Distancia: ${Math.floor(state.distance)} m · Puntos: ${Math.floor(state.score)}`;
    gameOver.classList.remove('hidden');
  }

  function setPause(p) {
    if (state.over || !state.running && !state.paused) return;
    state.paused = p;
    pauseOverlay.classList.toggle('hidden', !p);
  }

  // UI events
  document.getElementById('playBtn').onclick = resetGame;
  document.getElementById('retryBtn').onclick = resetGame;
  document.getElementById('restartBtn').onclick = resetGame;
  document.getElementById('resumeBtn').onclick = () => setPause(false);
  document.getElementById('pauseBtn').onclick = () => setPause(true);
  document.getElementById('menuBtn').onclick = () => { state.running = false; state.paused = false; hud.classList.add('hidden'); gameOver.classList.add('hidden'); menu.classList.remove('hidden'); };
  document.getElementById('howBtn').onclick = () => document.getElementById('howPanel').classList.toggle('hidden');

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') input.left = true;
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') input.right = true;
    if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') input.accel = true;
    if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') input.brake = true;
    if (e.key === ' ' || e.key === 'Shift') input.nitro = true;
    if (e.key.toLowerCase() === 'p') setPause(!state.paused);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') input.left = false;
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') input.right = false;
    if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') input.accel = false;
    if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') input.brake = false;
    if (e.key === ' ' || e.key === 'Shift') input.nitro = false;
  });

  function bindTouch(btn) {
    const action = btn.dataset.action;
    const on = (v) => (ev) => { ev.preventDefault(); input[action] = v; };
    btn.addEventListener('touchstart', on(true), { passive: false });
    btn.addEventListener('touchend', on(false), { passive: false });
    btn.addEventListener('touchcancel', on(false), { passive: false });
    btn.addEventListener('mousedown', on(true));
    btn.addEventListener('mouseup', on(false));
    btn.addEventListener('mouseleave', on(false));
  }
  document.querySelectorAll('.touch-btn').forEach(bindTouch);

  function update(dt) {
    if (!state.running || state.paused || state.over) return;

    const targetAccel = input.accel ? 1 : 0.35; // auto forward for arcade feel
    if (input.accel) state.speed += state.accel * 1.4;
    else state.speed += state.accel * 0.5;
    if (input.brake) state.speed -= state.brake;
    state.speed -= state.friction;

    state.nitroActive = input.nitro && state.nitro > 0 && state.speed > 0.2;
    if (state.nitroActive) {
      state.speed += 0.018;
      state.nitro = Math.max(0, state.nitro - 22 * dt);
      camera.fov = 76;
    } else {
      state.nitro = Math.min(100, state.nitro + 8 * dt);
      camera.fov += (70 - camera.fov) * 0.1;
    }
    camera.updateProjectionMatrix();

    const max = state.maxSpeed * (state.nitroActive ? 1.35 : 1);
    state.speed = Math.max(0, Math.min(max, state.speed));

    const steerPower = 0.075 + state.speed * 0.03;
    if (input.left) player.position.x -= steerPower;
    if (input.right) player.position.x += steerPower;
    player.position.x = Math.max(-5.6, Math.min(5.6, player.position.x));
    player.rotation.z = (input.left ? 0.08 : 0) + (input.right ? -0.08 : 0);
    player.rotation.y = player.rotation.z * 0.4;

    const worldSpeed = state.speed * 60 * dt;
    state.distance += worldSpeed * 12;
    state.score += worldSpeed * 10 + (state.nitroActive ? 2 : 0);

    laneMarks.forEach(m => {
      m.position.z += worldSpeed * 20;
      if (m.position.z > 10) m.position.z -= 360;
    });
    buildings.forEach(b => {
      b.position.z += worldSpeed * 20;
      if (b.position.z > 20) b.position.z -= 450;
    });

    enemies.forEach(e => {
      e.position.z += (worldSpeed * 20 - e.userData.speed);
      if (e.position.z > 12) {
        e.position.z = -180 - Math.random() * 120;
        const lanes = [-4, -1.3, 1.3, 4];
        e.position.x = lanes[Math.floor(Math.random() * lanes.length)];
        e.userData.speed = 0.2 + Math.random() * 0.35;
      }
      const dz = Math.abs(e.position.z - player.position.z);
      const dx = Math.abs(e.position.x - player.position.x);
      if (dz < 2.6 && dx < 1.5) endGame();
    });

    orbs.forEach(o => {
      o.position.z += worldSpeed * 20;
      o.rotation.y += dt * 2;
      o.position.y = 0.7 + Math.sin(performance.now() * 0.004 + o.position.z) * 0.12;
      if (o.position.z > 10) {
        o.position.z = -180 - Math.random() * 120;
        const lanes = [-4, -1.3, 1.3, 4];
        o.position.x = lanes[Math.floor(Math.random() * lanes.length)];
      }
      const dz = Math.abs(o.position.z - player.position.z);
      const dx = Math.abs(o.position.x - player.position.x);
      if (dz < 2.2 && dx < 1.4) {
        state.score += 150;
        state.nitro = Math.min(100, state.nitro + 20);
        o.position.z = -180 - Math.random() * 120;
      }
    });

    camera.position.x += (player.position.x * 0.35 - camera.position.x) * 0.08;
    camera.position.y = 4.4 + state.speed * 0.5;
    camera.position.z = 8 - state.speed * 1.2;
    camera.lookAt(player.position.x * 0.3, 0.8, -6);

    speedEl.textContent = Math.floor(state.speed * 220);
    distanceEl.textContent = Math.floor(state.distance);
    scoreEl.textContent = Math.floor(state.score);
    nitroEl.textContent = Math.floor(state.nitro);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();