import { Player } from './player.js';
import { Enemy } from './enemy.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  hud: document.getElementById('hud'),
  mainMenu: document.getElementById('mainMenu'),
  pauseMenu: document.getElementById('pauseMenu'),
  gameOverMenu: document.getElementById('gameOverMenu'),
  playButton: document.getElementById('playButton'),
  resumeButton: document.getElementById('resumeButton'),
  restartButton: document.getElementById('restartButton'),
  backToMenuButton: document.getElementById('backToMenuButton'),
  muteButton: document.getElementById('muteButton'),
  pauseMuteButton: document.getElementById('pauseMuteButton'),
  healthValue: document.getElementById('healthValue'),
  ammoValue: document.getElementById('ammoValue'),
  scoreValue: document.getElementById('scoreValue'),
  waveValue: document.getElementById('waveValue'),
  monsterValue: document.getElementById('monsterValue'),
  gameOverStats: document.getElementById('gameOverStats'),
};

const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,2,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,0,0,1,1,0,0,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,2,1,0,1],
  [1,0,1,0,0,1,0,1,1,0,0,0,0,1],
  [1,0,1,0,0,0,0,0,1,0,1,1,0,1],
  [1,0,0,0,1,1,0,0,0,0,0,0,0,1],
  [1,0,1,0,0,0,0,1,0,1,0,1,0,1],
  [1,0,0,0,0,1,0,0,0,1,0,0,0,1],
  [1,0,1,1,0,0,0,1,0,0,0,1,0,1],
  [1,0,0,0,0,0,0,1,0,1,0,0,0,1],
  [1,0,1,0,1,0,0,0,0,1,0,1,0,1],
  [1,0,0,0,0,0,2,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const WALL_TEXTURES = {};
const SPRITES = {};
const SOUNDS = {};

const input = {
  keys: new Set(),
  mouseDown: false,
  rightMouseDown: false,
  wheelDirection: 0,
  pointerLocked: false,
};

const state = {
  gameMode: 'menu',
  muted: false,
  lastTime: 0,
  frameCount: 0,
  levelProgress: 0,
  damageVignette: 0,
};

const player = new Player(1.5, 1.5);
let enemies = [];
let depthBuffer = [];

const spawnPoints = [
  [10.5, 2.5],
  [11.5, 10.5],
  [7.5, 12.5],
  [2.5, 10.5],
  [9.5, 6.5],
  [4.5, 8.5],
];

const eventTracker = new Set();
const fov = Math.PI / 3;
const maxDepth = 20;

const audioNames = ['shoot', 'monster', 'hurt', 'levelup', 'bgm'];
const textureMap = {
  1: 'wall-stone',
  2: 'wall-metal',
};

const preloadAssets = async () => {
  const imageNames = ['wall-stone', 'wall-metal', 'floor', 'ceiling', 'monster'];
  await Promise.all(imageNames.map((name) => loadImage(`./assets/images/${name}.png`).then((img) => { WALL_TEXTURES[name] = img; })));
  SPRITES.monster = WALL_TEXTURES.monster;
  await Promise.all(audioNames.map(async (name) => {
    const audio = new Audio(`./assets/sounds/${name}.wav`);
    audio.preload = 'auto';
    if (name === 'bgm') {
      audio.loop = true;
      audio.volume = 0.18;
    } else {
      audio.volume = 0.5;
    }
    SOUNDS[name] = audio;
  }));
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const cloneAndPlay = (name) => {
  if (state.muted || !SOUNDS[name]) {
    return;
  }

  if (name === 'bgm') {
    SOUNDS.bgm.play().catch(() => {});
    return;
  }

  const audio = SOUNDS[name].cloneNode();
  audio.volume = SOUNDS[name].volume;
  audio.play().catch(() => {});
};

const stopMusic = () => {
  if (SOUNDS.bgm) {
    SOUNDS.bgm.pause();
    SOUNDS.bgm.currentTime = 0;
  }
};

const resizeCanvas = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};

const buildEnemies = () => {
  enemies = spawnPoints.map(([x, y], index) => new Enemy(x, y, index + 1));
};

const resetGame = () => {
  player.reset(1.5, 1.5);
  buildEnemies();
  state.levelProgress = 0;
  state.damageVignette = 0;
  ui.gameOverStats.textContent = 'You reached wave 1.';
};

const setGameMode = (mode) => {
  state.gameMode = mode;

  const syncOverlay = (element, shouldShow) => {
    element.classList.toggle('hidden', !shouldShow);
    element.classList.toggle('visible', shouldShow);
  };

  syncOverlay(ui.mainMenu, mode === 'menu');
  syncOverlay(ui.pauseMenu, mode === 'paused');
  syncOverlay(ui.gameOverMenu, mode === 'gameover');
  ui.hud.classList.toggle('hidden', mode !== 'playing' && mode !== 'paused');
};

const updateMuteButtons = () => {
  const label = `Mute: ${state.muted ? 'On' : 'Off'}`;
  ui.muteButton.textContent = label;
  ui.pauseMuteButton.textContent = label;
  if (state.muted) {
    stopMusic();
  } else if (state.gameMode === 'playing') {
    cloneAndPlay('bgm');
  }
};

const startGame = async () => {
  resetGame();
  setGameMode('playing');
  document.dispatchEvent(new CustomEvent('gameStart', { detail: { wave: player.wave } }));
  cloneAndPlay('bgm');
  await lockPointer();
};

const gameOver = () => {
  setGameMode('gameover');
  document.dispatchEvent(new CustomEvent('gameOver', { detail: { score: player.score, wave: player.wave } }));
  ui.gameOverStats.textContent = `Final score: ${player.score} · Wave reached: ${player.wave}`;
  document.exitPointerLock?.();
  stopMusic();
};

const togglePause = () => {
  if (state.gameMode === 'playing') {
    setGameMode('paused');
    document.exitPointerLock?.();
  } else if (state.gameMode === 'paused') {
    setGameMode('playing');
    lockPointer();
  }
};

const lockPointer = async () => {
  if (!canvas.requestPointerLock) {
    return;
  }

  try {
    const result = canvas.requestPointerLock({ unadjustedMovement: true });
    if (result && typeof result.then === 'function') {
      await result;
    }
  } catch (error) {
    try {
      const fallback = canvas.requestPointerLock();
      if (fallback && typeof fallback.then === 'function') {
        await fallback;
      }
    } catch (_) {
      // Pointer lock can fail until the user interacts with the page.
    }
  }
};

const castRay = (angle) => {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  for (let depth = 0; depth < maxDepth; depth += 0.015) {
    const hitX = player.x + cos * depth;
    const hitY = player.y + sin * depth;
    const tileX = Math.floor(hitX);
    const tileY = Math.floor(hitY);
    const cell = MAP[tileY]?.[tileX] ?? 1;
    if (cell > 0) {
      const hitOffset = Math.abs(hitX - tileX - 0.5) > Math.abs(hitY - tileY - 0.5) ? hitY - Math.floor(hitY) : hitX - Math.floor(hitX);
      return { depth, cell, offset: hitOffset };
    }
  }

  return { depth: maxDepth, cell: 1, offset: 0 };
};

const isPathBlocked = (x, y) => MAP[Math.floor(y)]?.[Math.floor(x)] > 0;

const updateGame = (dt) => {
  if (state.gameMode !== 'playing') {
    return;
  }

  const wasReloading = player.reloadTimer > 0;
  player.update(dt, input, MAP);
  if (wasReloading && player.reloadTimer <= 0) {
    player.finishReload();
  }

  if (player.reloadTimer <= 0 && player.ammo === 0) {
    player.reload();
  }
  if (player.reloadTimer <= 0 && player.ammo < player.maxAmmo && (input.rightMouseDown || input.wheelDirection !== 0)) {
    player.reload();
  }

  state.damageVignette = Math.max(0, state.damageVignette - dt);
  if (player.damageFlash > 0) {
    state.damageVignette = 0.35;
  }

  const aliveEnemies = enemies.filter((enemy) => enemy.state !== 'DEAD' && enemy.state !== 'RESPAWN');
  ui.monsterValue.textContent = `${aliveEnemies.length}`;

  for (const enemy of enemies) {
    enemy.update({
      dt,
      player,
      map: MAP,
      sound: cloneAndPlay,
    });
  }

  const defeated = enemies.filter((enemy) => enemy.state === 'DEAD').length;
  state.levelProgress = defeated / enemies.length;
  if (state.levelProgress >= 0.6 && player.wave === 1) {
    player.wave = 2;
    document.dispatchEvent(new CustomEvent('levelUp', { detail: { wave: player.wave } }));
    cloneAndPlay('levelup');
  }
  if (state.levelProgress >= 0.95 && player.wave === 2) {
    player.wave = 3;
    document.dispatchEvent(new CustomEvent('levelUp', { detail: { wave: player.wave } }));
    cloneAndPlay('levelup');
  }

  if (player.health <= 0) {
    gameOver();
  }
};

const render = () => {
  resizeCanvas();
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  renderFloorAndSky();
  renderWalls();
  renderEnemies();
  renderWeapon();
  renderDamageOverlay();
  updateHud();
};

const renderFloorAndSky = () => {
  const width = canvas.width;
  const height = canvas.height;
  const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.5);
  skyGradient.addColorStop(0, '#0b1730');
  skyGradient.addColorStop(1, '#233659');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height * 0.5);

  const floorGradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
  floorGradient.addColorStop(0, '#3a3028');
  floorGradient.addColorStop(1, '#17110e');
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);
};

const renderWalls = () => {
  const width = canvas.width;
  const height = canvas.height;
  depthBuffer = new Array(width);

  for (let column = 0; column < width; column += 1) {
    const cameraX = (column / width) * 2 - 1;
    const rayAngle = player.angle + Math.atan(cameraX * Math.tan(fov / 2));
    const ray = castRay(rayAngle);
    const correctedDepth = ray.depth * Math.cos(rayAngle - player.angle);
    depthBuffer[column] = correctedDepth;
    const wallHeight = Math.min(height, (height / Math.max(correctedDepth, 0.0001)) * 0.95);
    const startY = (height - wallHeight) / 2;
    const shade = Math.max(0.2, 1 - correctedDepth / maxDepth);
    const textureName = textureMap[ray.cell] || 'wall-stone';
    const texture = WALL_TEXTURES[textureName];
    const texX = Math.max(0, Math.min(texture.width - 1, Math.floor(ray.offset * texture.width)));

    ctx.globalAlpha = 1;
    ctx.drawImage(texture, texX, 0, 1, texture.height, column, startY, 1, wallHeight);
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - shade})`;
    ctx.fillRect(column, startY, 1, wallHeight);
  }
};

const renderEnemies = () => {
  const width = canvas.width;
  const height = canvas.height;
  const projected = [];

  for (const enemy of enemies) {
    if (!enemy.visible || enemy.state === 'DEAD') {
      continue;
    }

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy);
    const angleToEnemy = Math.atan2(dy, dx) - player.angle;
    const normalizedAngle = Math.atan2(Math.sin(angleToEnemy), Math.cos(angleToEnemy));

    if (Math.abs(normalizedAngle) > fov * 0.7 || distance < 0.2) {
      continue;
    }

    const screenX = (0.5 + normalizedAngle / fov) * width;
    const size = Math.min(height * 0.9, height / distance);
    projected.push({ enemy, distance, screenX, size });
  }

  projected.sort((a, b) => b.distance - a.distance);

  for (const item of projected) {
    const sprite = SPRITES.monster;
    const drawX = item.screenX - item.size / 2;
    const drawY = canvas.height / 2 - item.size / 2 + 18;
    const left = Math.max(0, Math.floor(drawX));
    const right = Math.min(canvas.width - 1, Math.floor(drawX + item.size));

    let visible = false;
    for (let x = left; x <= right; x += 4) {
      if (item.distance < depthBuffer[x]) {
        visible = true;
        break;
      }
    }

    if (!visible) {
      continue;
    }

    ctx.drawImage(sprite, drawX, drawY, item.size, item.size);

    const healthRatio = item.enemy.health / item.enemy.maxHealth;
    const barWidth = item.size * 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(item.screenX - barWidth / 2, drawY - 16, barWidth, 8);
    ctx.fillStyle = '#47d37a';
    ctx.fillRect(item.screenX - barWidth / 2, drawY - 16, barWidth * healthRatio, 8);
  }
};

const renderWeapon = () => {
  const width = canvas.width;
  const height = canvas.height;
  const bob = Math.sin(state.frameCount * 0.07) * 6;
  ctx.save();
  ctx.translate(width * 0.72, height * 0.82 + bob);
  ctx.fillStyle = '#1d2735';
  ctx.fillRect(-10, -20, 140, 110);
  ctx.fillStyle = '#2d3a4f';
  ctx.fillRect(0, 0, 110, 55);
  ctx.fillStyle = '#4db0ff';
  ctx.fillRect(55, 12, 65, 8);
  ctx.fillStyle = '#151c27';
  ctx.fillRect(32, 42, 22, 52);
  ctx.restore();
};

const renderDamageOverlay = () => {
  if (state.damageVignette <= 0) {
    return;
  }

  const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.2, canvas.width / 2, canvas.height / 2, canvas.width * 0.6);
  gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(255, 40, 60, ${Math.min(0.38, state.damageVignette)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const updateHud = () => {
  ui.healthValue.textContent = `${Math.ceil(player.health)}`;
  ui.ammoValue.textContent = player.reloadTimer > 0 ? 'Reloading' : `${player.ammo}/${player.maxAmmo}`;
  ui.scoreValue.textContent = `${player.score}`;
  ui.waveValue.textContent = `${player.wave}`;
};

const attemptShoot = () => {
  if (state.gameMode !== 'playing' || !player.canShoot()) {
    return;
  }

  player.shoot();
  cloneAndPlay('shoot');

  const hitEnemies = [];
  for (const enemy of enemies) {
    if (!enemy.visible || enemy.state === 'DEAD') {
      continue;
    }
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy);
    const angleToEnemy = Math.atan2(dy, dx) - player.angle;
    const normalizedAngle = Math.atan2(Math.sin(angleToEnemy), Math.cos(angleToEnemy));
    if (Math.abs(normalizedAngle) < 0.1 && distance < 8.5) {
      if (hasLineOfSight(player.x, player.y, enemy.x, enemy.y)) {
        hitEnemies.push({ enemy, distance });
      }
    }
  }

  hitEnemies.sort((a, b) => a.distance - b.distance);
  const target = hitEnemies[0];
  if (target) {
    const killed = target.enemy.takeDamage(40);
    if (killed) {
      player.score += 100;
    } else {
      player.score += 20;
    }
  }
};

const hasLineOfSight = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(3, Math.floor(Math.hypot(dx, dy) * 10));
  for (let i = 1; i < steps; i += 1) {
    const px = x1 + (dx * i) / steps;
    const py = y1 + (dy * i) / steps;
    if (isPathBlocked(px, py)) {
      return false;
    }
  }
  return true;
};

const handleLevelUp = (event) => {
  console.info(`Level up event triggered for wave ${event.detail.wave}`);
};

const bindEvents = () => {
  window.addEventListener('load', () => eventTracker.add('load'));
  window.addEventListener('resize', () => {
    resizeCanvas();
    eventTracker.add('resize');
  });

  window.addEventListener('focus', () => {
    eventTracker.add('focus');
  });

  window.addEventListener('blur', () => {
    eventTracker.add('blur');
    if (state.gameMode === 'playing') {
      setGameMode('paused');
      document.exitPointerLock?.();
    }
  });

  document.addEventListener('visibilitychange', () => {
    eventTracker.add('visibilitychange');
    if (document.hidden && state.gameMode === 'playing') {
      setGameMode('paused');
      document.exitPointerLock?.();
    }
  });

  document.addEventListener('keydown', (event) => {
    eventTracker.add('keydown');
    input.keys.add(event.code);

    if (event.code === 'Escape' && (state.gameMode === 'playing' || state.gameMode === 'paused')) {
      event.preventDefault();
      togglePause();
    }

    if (event.code === 'KeyR') {
      player.reload();
    }

    if (event.code === 'KeyM') {
      state.muted = !state.muted;
      updateMuteButtons();
    }
  });

  document.addEventListener('keyup', (event) => {
    eventTracker.add('keyup');
    input.keys.delete(event.code);
  });

  document.addEventListener('keypress', (event) => {
    eventTracker.add('keypress');
    if (event.key.toLowerCase() === 'p' && state.gameMode === 'menu') {
      startGame();
    }
  });

  document.addEventListener('click', (event) => {
    eventTracker.add('click');
    if (state.gameMode === 'playing' && input.pointerLocked) {
      attemptShoot();
    }
  });

  document.addEventListener('mousemove', (event) => {
    eventTracker.add('mousemove');
    if (state.gameMode === 'playing' && input.pointerLocked) {
      player.applyMouseMovement(event.movementX);
    }
  });

  document.addEventListener('mousedown', (event) => {
    eventTracker.add('mousedown');
    input.mouseDown = true;
    input.rightMouseDown = event.button === 2;
    if (state.gameMode === 'playing' && event.button === 0) {
      attemptShoot();
    }
  });

  document.addEventListener('mouseup', () => {
    eventTracker.add('mouseup');
    input.mouseDown = false;
    input.rightMouseDown = false;
  });

  document.addEventListener('contextmenu', (event) => {
    eventTracker.add('contextmenu');
    event.preventDefault();
    player.reload();
  });

  document.addEventListener('wheel', (event) => {
    eventTracker.add('wheel');
    input.wheelDirection = Math.sign(event.deltaY);
    if (input.wheelDirection !== 0) {
      player.reload();
    }
  }, { passive: true });

  document.addEventListener('touchstart', () => eventTracker.add('touchstart'), { passive: true });
  document.addEventListener('touchmove', () => eventTracker.add('touchmove'), { passive: true });
  document.addEventListener('touchend', () => eventTracker.add('touchend'), { passive: true });

  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener('gameStart', () => console.info('gameStart triggered'));
  document.addEventListener('gameOver', () => console.info('gameOver triggered'));
  document.addEventListener('levelUp', handleLevelUp);

  ui.playButton.addEventListener('click', startGame);
  ui.resumeButton.addEventListener('click', () => {
    setGameMode('playing');
    lockPointer();
  });
  ui.restartButton.addEventListener('click', startGame);
  ui.backToMenuButton.addEventListener('click', () => {
    setGameMode('menu');
    stopMusic();
  });
  ui.muteButton.addEventListener('click', () => {
    state.muted = !state.muted;
    updateMuteButtons();
  });
  ui.pauseMuteButton.addEventListener('click', () => {
    state.muted = !state.muted;
    updateMuteButtons();
  });
};

const mainLoop = (timestamp) => {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;
  state.frameCount += 1;

  updateGame(dt);
  render();

  requestAnimationFrame(mainLoop);
};

const bootstrap = async () => {
  resizeCanvas();
  resetGame();
  bindEvents();
  updateMuteButtons();
  await preloadAssets();
  setGameMode('menu');
  setInterval(() => {
    input.wheelDirection = 0;
  }, 160);
  setTimeout(() => {
    console.info('Project initialized');
  }, 350);
  requestAnimationFrame(mainLoop);
};

bootstrap().catch((error) => {
  console.error('Failed to initialize the game.', error);
});
