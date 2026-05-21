// Level 2: Static Fields Runner
// Geometry Dash / Flappy Bird inspired auto-scrolling level
// Player uses thrust to dodge obstacles, collects hats for invincibility

import { initAudio, startBGM, sfxCollectSig, sfxMenuSelect, sfxStaticHit, sfxInvincible, sfxRunnerWin, sfxThrust } from './audio';
import { addToL2Leaderboard, getL2Leaderboard, type LeaderboardEntry } from './leaderboard';

// === CONSTANTS ===
const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_X = 120; // fixed horizontal position
const GRAVITY = 600;
const THRUST_FORCE = -900;
const MAX_VY = 400;
const BASE_SCROLL_SPEED = 220;
const MAX_SCROLL_SPEED = 420;
const LEVEL_DURATION = 90; // seconds to complete
const INVINCIBLE_DURATION = 4; // seconds per hat
const MAX_HEALTH = 5;
const DAMAGE_COOLDOWN = 0.8; // seconds between damage hits
const SIG_POINTS = 150;
const HAT_POINTS = 300;
const DESTROY_POINTS = 50;

// === TYPES ===
interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'static-block' | 'static-wave' | 'static-pillar';
  passed: boolean;
}

interface Collectible {
  x: number;
  y: number;
  type: 'sig' | 'hat';
  collected: boolean;
}

// === JAMES DIALOG ===
const jamesDialog: { lines: string[]; speaker: string }[] = [
  { speaker: 'James', lines: ['Sonia! Excellent timing.', 'I\'m James — head of customer success,', 'dev lead, project manager, and general', 'Swiss army knife around here.'] },
  { speaker: 'James', lines: ['You\'ve done brilliantly restoring', 'Acoustica. But Lord Noise has one', 'final trick — the Static Fields.'] },
  { speaker: 'James', lines: ['These fields are pure sonic chaos.', 'You can\'t walk through them —', 'you\'ll need to FLY.'] },
  { speaker: 'James', lines: ['I\'ve rigged up an Insight Booster', 'for you. Hold UP to thrust upward,', 'release to glide down. Simple!'] },
  { speaker: 'James', lines: ['One more thing — I wear a LOT of hats.', 'Too many, honestly. They\'re scattered', 'all through the Static Fields.'] },
  { speaker: 'James', lines: ['Grab my hats and you\'ll be temporarily', 'INVINCIBLE. Blast right through the', 'static and score bonus points!'] },
  { speaker: 'James', lines: ['Collect as many SIGs and hats as you', 'can. Reach the Clarity Beacon at the', 'end and the Fields are cleansed!'] },
  { speaker: 'Sonia', lines: ['How many hats do you actually own?'] },
  { speaker: 'James', lines: ['...let\'s just say I need them ALL', 'back to achieve my true potential.', 'Good luck out there!'] },
];

const endDialog: { lines: string[]; speaker: string }[] = [
  { speaker: 'James', lines: ['Sonia! You absolute LEGEND.', 'The Static Fields are cleansed!', 'And... are those... MY HATS?!'] },
  { speaker: 'Sonia', lines: ['Every last one. You\'re welcome.'] },
  { speaker: 'James', lines: ['Magnificent. With all my hats returned,', 'I can finally achieve my ultimate form.', 'Behold... MEGA EVOLUTION!'] },
  { speaker: 'James', lines: ['*puts on all hats simultaneously*', '', '...nothing happened. But I FEEL powerful.'] },
  { speaker: 'Sonia', lines: ['James, that\'s just a headache.'] },
  { speaker: 'James', lines: ['Wait — I just had an INCREDIBLE idea.', 'What if we built a Subphonic app that', 'replaces the entire stock market?'] },
  { speaker: 'James', lines: ['Sound-based algorithmic trading!', 'Each stock has a unique frequency!', 'Bull markets sound like jazz!'] },
  { speaker: 'Sonia', lines: ['James, we just saved the world', 'from sonic destruction. Maybe take', 'a day off?'] },
  { speaker: 'James', lines: ['You\'re right, you\'re right.', 'I\'ll start the prototype tomorrow.', 'Tuesday at the latest.'] },
  { speaker: 'James', lines: ['Thanks Sonia. Genuinely.', 'Acoustica owes you everything.', 'Now... where did I put my whiteboard...'] },
];

// === LEVEL GENERATOR ===
function generateObstacles(_scrollSpeed: number, progress: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  // Density increases with progress
  const density = 0.3 + progress * 0.5;
  const segmentWidth = WIDTH * 3;
  const startX = WIDTH + 50;

  for (let x = startX; x < startX + segmentWidth; x += 180 - progress * 60) {
    if (Math.random() > density) continue;

    const type = (['static-block', 'static-wave', 'static-pillar'] as const)[Math.floor(Math.random() * 3)];
    let w: number, h: number, y: number;

    switch (type) {
      case 'static-block':
        w = 40 + Math.random() * 40;
        h = 50 + Math.random() * 60;
        y = 40 + Math.random() * (HEIGHT - h - 80);
        break;
      case 'static-wave':
        w = 60 + Math.random() * 50;
        h = 30 + Math.random() * 30;
        y = 30 + Math.random() * (HEIGHT - h - 60);
        break;
      case 'static-pillar':
        w = 25 + Math.random() * 20;
        h = 150 + Math.random() * 200;
        y = Math.random() < 0.5 ? 0 : HEIGHT - h;
        break;
    }

    obstacles.push({ x: x + Math.random() * 60, y, w, h, type, passed: false });
  }
  return obstacles;
}

function generateCollectibles(progress: number): Collectible[] {
  const items: Collectible[] = [];
  const startX = WIDTH + 100;
  const segmentWidth = WIDTH * 3;

  // SIGs — fairly common
  for (let x = startX; x < startX + segmentWidth; x += 200 + Math.random() * 150) {
    if (Math.random() < 0.4) continue;
    items.push({
      x: x + Math.random() * 80,
      y: 40 + Math.random() * (HEIGHT - 80),
      type: 'sig',
      collected: false,
    });
  }

  // Hats — rarer, more valuable
  for (let x = startX + 300; x < startX + segmentWidth; x += 500 + Math.random() * 400) {
    if (Math.random() < 0.3 + progress * 0.1) continue;
    items.push({
      x: x + Math.random() * 60,
      y: 50 + Math.random() * (HEIGHT - 100),
      type: 'hat',
      collected: false,
    });
  }

  return items;
}

// === MAIN EXPORT ===
export function mountRunner(container: HTMLElement, onComplete: () => void, onQuit: () => void): () => void {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.className = 'game-canvas';
  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx2 = canvas.getContext('2d');
  if (!ctx2) throw new Error('Canvas context unavailable');

  // State
  let running = true;
  let dialogActive = true;
  let dialogPage = 0;
  let dialogAlpha = 0;
  let dialogCooldown = 0.3; // prevent immediate advance on first frame

  let health = MAX_HEALTH;
  let score = 0;
  let distance = 0; // px traveled
  let totalDistance = BASE_SCROLL_SPEED * LEVEL_DURATION * 0.7; // approximate finish line
  let scrollSpeed = BASE_SCROLL_SPEED;
  let elapsed = 0;

  let playerY = HEIGHT / 2 - 20;
  let playerVY = 0;
  let playerW = 36;
  let playerH = 44;
  let thrusting = false;
  let wasThrusting = false;

  let invincibleTimer = 0;
  let damageCooldown = 0;
  let hatsCollected = 0;
  let sigsCollected = 0;
  let destroyedCount = 0;

  let obstacles: Obstacle[] = [];
  let collectibles: Collectible[] = [];
  let lastSpawnDist = 0;

  let gameOver = false;
  let gameOverTimer = 0;
  let won = false;
  let wonNameEntry = '';
  let wonNameSubmitted = false;
  let wonLeaderboard: LeaderboardEntry[] = [];
  let wonEndDialog = false;
  let wonEndDialogPage = 0;
  let wonEndDialogAlpha = 0;
  let wonEndDialogCooldown = 0;
  let animTime = 0;

  // Damage feedback
  let screenFlash = 0; // 0-1, decays quickly after hit
  let screenShake = 0; // pixels offset, decays

  // Particles
  let particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];

  // Input
  const keys: Record<string, boolean> = {};
  const onKeyDown = (e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = true;
    // Win screen name entry
    if (won && !wonNameSubmitted) {
      if (e.key === 'Backspace') {
        wonNameEntry = wonNameEntry.slice(0, -1);
      } else if (e.key === 'Enter' && wonNameEntry.length > 0) {
        wonLeaderboard = addToL2Leaderboard(wonNameEntry, score);
        wonNameSubmitted = true;
      } else if (e.key.length === 1 && wonNameEntry.length < 16 && /^[a-zA-Z0-9 _\-.]$/.test(e.key)) {
        wonNameEntry += e.key;
      }
      e.preventDefault();
      return;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  let lastTime = performance.now();
  let frameId = 0;

  // Initial obstacles
  obstacles = generateObstacles(scrollSpeed, 0);
  collectibles = generateCollectibles(0);

  const overlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // === UPDATE ===
  const update = (dt: number) => {
    animTime += dt;

    // Dialog
    if (dialogActive) {
      dialogAlpha = Math.min(1, dialogAlpha + dt * 3);
      if (dialogCooldown > 0) dialogCooldown -= dt;
      if (dialogCooldown <= 0 && (keys[' '] || keys.enter)) {
        keys[' '] = false;
        keys.enter = false;
        sfxMenuSelect();
        dialogPage++;
        dialogAlpha = 0;
        dialogCooldown = 0.35; // debounce between pages
        if (dialogPage >= jamesDialog.length) {
          dialogActive = false;
          initAudio();
          startBGM();
        }
      }
      return;
    }

    if (gameOver || won) {
      gameOverTimer += dt;
      if (won) {
        if (wonEndDialog) {
          // End dialog (James thanking Sonia)
          wonEndDialogAlpha = Math.min(1, wonEndDialogAlpha + dt * 3);
          if (wonEndDialogCooldown > 0) wonEndDialogCooldown -= dt;
          if (wonEndDialogCooldown <= 0 && (keys[' '] || keys.enter)) {
            keys[' '] = false;
            keys.enter = false;
            wonEndDialogPage++;
            wonEndDialogAlpha = 0;
            wonEndDialogCooldown = 0.35;
            if (wonEndDialogPage >= endDialog.length) {
              onComplete();
            }
          }
        } else if (wonNameSubmitted && gameOverTimer > 1.5 && (keys[' '] || keys.enter)) {
          keys[' '] = false;
          keys.enter = false;
          wonEndDialog = true;
          wonEndDialogPage = 0;
          wonEndDialogAlpha = 0;
          wonEndDialogCooldown = 0.5;
        }
      } else {
        if (gameOverTimer > 1.5 && (keys[' '] || keys.enter)) {
          keys[' '] = false;
          keys.enter = false;
          // Restart
          health = MAX_HEALTH;
          score = 0;
          distance = 0;
          scrollSpeed = BASE_SCROLL_SPEED;
          elapsed = 0;
          playerY = HEIGHT / 2 - 20;
          playerVY = 0;
          invincibleTimer = 0;
          damageCooldown = 0;
          hatsCollected = 0;
          sigsCollected = 0;
          destroyedCount = 0;
          obstacles = generateObstacles(scrollSpeed, 0);
          collectibles = generateCollectibles(0);
          lastSpawnDist = 0;
          gameOver = false;
          gameOverTimer = 0;
          particles = [];
        }
      }
      if (keys.q || keys.escape) {
        keys.q = false;
        keys.escape = false;
        onQuit();
      }
      return;
    }

    // Quit check
    if (keys.q || keys.escape) {
      keys.q = false;
      keys.escape = false;
      onQuit();
      return;
    }

    elapsed += dt;
    const progress = Math.min(distance / totalDistance, 1);

    // Scroll speed increases over time
    scrollSpeed = BASE_SCROLL_SPEED + (MAX_SCROLL_SPEED - BASE_SCROLL_SPEED) * progress;
    distance += scrollSpeed * dt;

    // Win condition
    if (distance >= totalDistance) {
      won = true;
      gameOverTimer = 0;
      score += 1000; // completion bonus
      wonNameEntry = '';
      wonNameSubmitted = false;
      sfxRunnerWin();
      return;
    }

    // Thrust physics
    thrusting = !!(keys.arrowup || keys.w || keys[' ']);
    if (thrusting) {
      playerVY += THRUST_FORCE * dt;
      // Play thrust sound only on initial press
      if (!wasThrusting) {
        sfxThrust();
      }
    } else {
      playerVY += GRAVITY * dt;
    }
    wasThrusting = thrusting;
    playerVY = Math.max(-MAX_VY, Math.min(MAX_VY, playerVY));
    playerY += playerVY * dt;

    // Ceiling clamp
    if (playerY < 0) { playerY = 0; playerVY = 0; }
    // Fall off bottom = death
    if (playerY > HEIGHT + 20) {
      gameOver = true;
      gameOverTimer = 0;
      screenFlash = 1.0;
      screenShake = 10;
      sfxStaticHit();
    }

    // Timers
    if (invincibleTimer > 0) invincibleTimer -= dt;
    if (damageCooldown > 0) damageCooldown -= dt;

    // Move obstacles
    for (const obs of obstacles) {
      obs.x -= scrollSpeed * dt;
    }
    // Remove off-screen obstacles
    obstacles = obstacles.filter(o => o.x + o.w > -50);

    // Move collectibles
    for (const c of collectibles) {
      if (!c.collected) c.x -= scrollSpeed * dt;
    }
    collectibles = collectibles.filter(c => !c.collected && c.x + 20 > -50);

    // Spawn new obstacles/collectibles
    if (distance - lastSpawnDist > WIDTH * 2.5) {
      lastSpawnDist = distance;
      obstacles.push(...generateObstacles(scrollSpeed, progress));
      collectibles.push(...generateCollectibles(progress));
    }

    // Collision: player vs obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      if (overlap(PLAYER_X, playerY, playerW, playerH, obs.x, obs.y, obs.w, obs.h)) {
        if (invincibleTimer > 0) {
          // Destroy obstacle
          score += DESTROY_POINTS;
          destroyedCount++;
          // Particles
          for (let p = 0; p < 6; p++) {
            particles.push({
              x: obs.x + obs.w / 2,
              y: obs.y + obs.h / 2,
              vx: (Math.random() - 0.5) * 200,
              vy: (Math.random() - 0.5) * 200,
              life: 0.5 + Math.random() * 0.3,
              color: ['#ff4444', '#ff8800', '#ffff00'][Math.floor(Math.random() * 3)],
            });
          }
          obstacles.splice(i, 1);
        } else if (damageCooldown <= 0) {
          // Take damage
          health--;
          damageCooldown = DAMAGE_COOLDOWN;
          screenFlash = 1.0;
          screenShake = 8;
          sfxStaticHit();
          // Damage burst particles
          for (let p = 0; p < 12; p++) {
            particles.push({
              x: PLAYER_X + playerW / 2,
              y: playerY + playerH / 2,
              vx: (Math.random() - 0.5) * 250,
              vy: (Math.random() - 0.5) * 250,
              life: 0.5 + Math.random() * 0.3,
              color: ['#ff0000', '#ff4400', '#ff2222', '#ffaa00'][Math.floor(Math.random() * 4)],
            });
          }
          if (health <= 0) {
            gameOver = true;
            gameOverTimer = 0;
          }
        }
      }
    }

    // Collision: player vs collectibles
    for (const c of collectibles) {
      if (c.collected) continue;
      if (overlap(PLAYER_X, playerY, playerW, playerH, c.x, c.y, 20, 20)) {
        c.collected = true;
        if (c.type === 'sig') {
          score += SIG_POINTS;
          sigsCollected++;
          sfxCollectSig();
        } else {
          score += HAT_POINTS;
          hatsCollected++;
          invincibleTimer = INVINCIBLE_DURATION;
          sfxInvincible();
        }
      }
    }

    // Update particles
    particles = particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      return p.life > 0;
    });

    // Decay screen effects
    if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - dt * 4);
    if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 30);
  };

  // === DRAW ===
  const draw = () => {
    const ctx = ctx2!;
    const progress = Math.min(distance / totalDistance, 1);

    // Screen shake offset
    const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake * 2 : 0;
    const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake * 2 : 0;
    if (screenShake > 0) {
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    // === BACKGROUND: Deep space gradient with shifting hue ===
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    const hueShift = progress * 30;
    bgGrad.addColorStop(0, `hsl(${260 + hueShift}, 40%, 5%)`);
    bgGrad.addColorStop(0.3, `hsl(${240 + hueShift}, 35%, 8%)`);
    bgGrad.addColorStop(0.7, `hsl(${220 + hueShift}, 30%, 6%)`);
    bgGrad.addColorStop(1, `hsl(${200 + hueShift}, 40%, 4%)`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // === PARALLAX STAR LAYER 1 (far, slow) ===
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 179 + 50) - (distance * 0.02)) % WIDTH;
      const sy = (i * 97 + 20) % HEIGHT;
      ctx.fillRect(sx < 0 ? sx + WIDTH : sx, sy, 1, 1);
    }

    // === PARALLAX STAR LAYER 2 (mid, medium) ===
    ctx.fillStyle = 'rgba(200, 180, 255, 0.4)';
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 211 + 80) - (distance * 0.06)) % WIDTH;
      const sy = (i * 131 + 10) % HEIGHT;
      const size = i % 4 === 0 ? 2 : 1;
      ctx.fillRect(sx < 0 ? sx + WIDTH : sx, sy, size, size);
    }

    // === PARALLAX STAR LAYER 3 (near, fast twinkle) ===
    for (let i = 0; i < 15; i++) {
      const sx = ((i * 277 + 30) - (distance * 0.12)) % WIDTH;
      const sy = (i * 163 + 40) % HEIGHT;
      const twinkle = 0.3 + Math.sin(animTime * 3 + i * 1.7) * 0.3;
      ctx.fillStyle = `rgba(255, 220, 255, ${twinkle})`;
      ctx.fillRect(sx < 0 ? sx + WIDTH : sx, sy, 2, 2);
    }

    // === NEBULA CLOUDS (parallax, atmospheric) ===
    ctx.globalAlpha = 0.04 + progress * 0.02;
    for (let i = 0; i < 5; i++) {
      const nx = ((i * 400 + 100) - (distance * 0.04)) % (WIDTH + 200) - 100;
      const ny = 60 + (i * 137) % (HEIGHT - 120);
      const nw = 120 + (i % 3) * 80;
      const nh = 40 + (i % 2) * 30;
      const nebGrad = ctx.createRadialGradient(nx + nw / 2, ny + nh / 2, 0, nx + nw / 2, ny + nh / 2, nw / 2);
      nebGrad.addColorStop(0, i % 2 === 0 ? 'rgba(150, 50, 200, 0.8)' : 'rgba(50, 100, 200, 0.8)');
      nebGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = nebGrad;
      ctx.beginPath();
      ctx.ellipse(nx + nw / 2, ny + nh / 2, nw / 2, nh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // === AURORA / ENERGY WAVES (mid-ground atmosphere) ===
    ctx.globalAlpha = 0.06 + progress * 0.04;
    for (let w = 0; w < 3; w++) {
      const waveY = HEIGHT * 0.3 + w * 60;
      const waveHue = 180 + w * 40 + hueShift;
      ctx.strokeStyle = `hsl(${waveHue}, 70%, 60%)`;
      ctx.lineWidth = 2 - w * 0.5;
      ctx.beginPath();
      for (let x = 0; x < WIDTH; x += 6) {
        const yOff = Math.sin((x * 0.008) + animTime * (0.8 + w * 0.3) + w * 2) * (20 + w * 10);
        const yOff2 = Math.sin((x * 0.015) + animTime * 1.2 + w) * 8;
        if (x === 0) ctx.moveTo(x, waveY + yOff + yOff2);
        else ctx.lineTo(x, waveY + yOff + yOff2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // === FLOATING DEBRIS / DUST MOTES ===
    ctx.fillStyle = 'rgba(150, 200, 255, 0.12)';
    for (let d = 0; d < 20; d++) {
      const dx = ((d * 251 + 70) - (distance * 0.15 * (1 + d % 3 * 0.3))) % WIDTH;
      const dy = (d * 89 + 30) % (HEIGHT - 60) + 30;
      const dSize = 1 + (d % 3);
      ctx.fillRect(dx < 0 ? dx + WIDTH : dx, dy, dSize, dSize);
    }

    // === ENERGY GRID FLOOR (danger zone — falling off = death) ===
    const floorY = HEIGHT - 24;
    // Glow above floor edge
    const edgeGlow = ctx.createLinearGradient(0, floorY - 12, 0, floorY);
    edgeGlow.addColorStop(0, 'transparent');
    edgeGlow.addColorStop(1, `rgba(255, 40, 20, ${0.06 + Math.sin(animTime * 3) * 0.02})`);
    ctx.fillStyle = edgeGlow;
    ctx.fillRect(0, floorY - 12, WIDTH, 12);
    // Main floor fill
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, HEIGHT);
    floorGrad.addColorStop(0, `rgba(200, 40, 30, ${0.18 + progress * 0.08})`);
    floorGrad.addColorStop(0.3, `rgba(140, 20, 15, ${0.12})`);
    floorGrad.addColorStop(0.7, `rgba(80, 10, 10, ${0.06})`);
    floorGrad.addColorStop(1, 'rgba(30, 0, 0, 0.02)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, WIDTH, HEIGHT - floorY);
    // Animated grid lines (perspective-shifted)
    const gridPulse = 0.1 + Math.sin(animTime * 2) * 0.04;
    ctx.strokeStyle = `rgba(255, 60, 40, ${gridPulse})`;
    ctx.lineWidth = 0.8;
    const gridOffset = (distance * 0.5) % 30;
    for (let gx = -gridOffset; gx < WIDTH + 30; gx += 30) {
      ctx.beginPath();
      ctx.moveTo(gx, floorY);
      ctx.lineTo(gx - 8, HEIGHT);
      ctx.stroke();
    }
    // Horizontal lines across floor
    ctx.strokeStyle = `rgba(255, 50, 30, ${gridPulse * 0.6})`;
    for (let fy = floorY + 6; fy < HEIGHT; fy += 6) {
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(WIDTH, fy);
      ctx.stroke();
    }
    // Top edge (bright danger line)
    ctx.shadowColor = 'rgba(255, 50, 30, 0.5)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = `rgba(255, 80, 50, ${0.5 + Math.sin(animTime * 4) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(WIDTH, floorY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Scrolling warning chevrons
    ctx.fillStyle = `rgba(255, 80, 40, ${0.1 + Math.sin(animTime * 3) * 0.03})`;
    const chevOffset = (distance * 0.8) % 50;
    for (let cx = -chevOffset; cx < WIDTH + 50; cx += 50) {
      ctx.beginPath();
      ctx.moveTo(cx, floorY + 3);
      ctx.lineTo(cx + 12, floorY + 12);
      ctx.lineTo(cx + 24, floorY + 3);
      ctx.lineTo(cx + 20, floorY + 3);
      ctx.lineTo(cx + 12, floorY + 9);
      ctx.lineTo(cx + 4, floorY + 3);
      ctx.closePath();
      ctx.fill();
    }

    // === ENERGY GRID CEILING ===
    const ceilY = 20;
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, ceilY);
    ceilGrad.addColorStop(0, 'rgba(0, 80, 80, 0.02)');
    ceilGrad.addColorStop(0.7, `rgba(0, 150, 130, ${0.06})`);
    ceilGrad.addColorStop(1, `rgba(0, 200, 180, ${0.1 + progress * 0.08})`);
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, WIDTH, ceilY);
    ctx.strokeStyle = `rgba(0, 255, 200, ${0.2 + Math.sin(animTime * 3 + 1) * 0.08})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, ceilY);
    ctx.lineTo(WIDTH, ceilY);
    ctx.stroke();

    // === SCROLLING DIAGONAL INTERFERENCE LINES ===
    ctx.strokeStyle = `rgba(100, 60, 140, ${0.06 + progress * 0.04})`;
    ctx.lineWidth = 1;
    const lineOffset = (distance * 0.3) % 80;
    for (let x = -lineOffset; x < WIDTH + 80; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 40, HEIGHT);
      ctx.stroke();
    }

    // === SUBTLE SCANLINES ===
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let y = 0; y < HEIGHT; y += 3) {
      ctx.fillRect(0, y, WIDTH, 1);
    }

    // === PROGRESS BAR (elegant top strip) ===
    const barY = 2;
    const barH = 3;
    // Background track
    ctx.fillStyle = 'rgba(0, 255, 150, 0.06)';
    ctx.beginPath();
    ctx.roundRect(0, barY, WIDTH, barH, 1.5);
    ctx.fill();
    // Filled progress with gradient
    if (progress > 0) {
      const progGrad = ctx.createLinearGradient(0, barY, WIDTH * progress, barY);
      progGrad.addColorStop(0, 'rgba(0, 200, 130, 0.5)');
      progGrad.addColorStop(0.8, '#00ff88');
      progGrad.addColorStop(1, '#aaffdd');
      ctx.fillStyle = progGrad;
      ctx.beginPath();
      ctx.roundRect(0, barY, WIDTH * progress, barH, 1.5);
      ctx.fill();
      // Leading edge glow
      ctx.shadowColor = 'rgba(0, 255, 150, 0.6)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(WIDTH * progress, barY + barH / 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Beacon indicator at end
    const beaconPip = 0.4 + Math.sin(animTime * 4) * 0.3;
    ctx.fillStyle = `rgba(0, 255, 180, ${beaconPip})`;
    ctx.beginPath();
    ctx.roundRect(WIDTH - 5, barY - 1, 5, barH + 2, 1);
    ctx.fill();

    // Dialog overlay
    if (dialogActive) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const page = jamesDialog[dialogPage];

      // Draw avatar at full alpha (no flicker on page change)
      ctx.textAlign = 'center';
      if (page.speaker === 'James') {
        drawJames(ctx, WIDTH / 2 - 40, 30);
      } else {
        drawSonia(ctx, WIDTH / 2 - 18, 40);
      }

      // Speaker name (full alpha, below avatar)
      ctx.fillStyle = page.speaker === 'James' ? '#ffaa00' : '#00ccff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(page.speaker, WIDTH / 2, 145);

      // Fade in text content only
      ctx.globalAlpha = dialogAlpha;

      // Lines (spaced below name with gap)
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '14px monospace';
      page.lines.forEach((line, i) => {
        ctx.fillText(line, WIDTH / 2, 190 + i * 30);
      });

      // Page indicator
      ctx.fillStyle = '#555';
      ctx.font = '10px monospace';
      ctx.fillText(`${dialogPage + 1} / ${jamesDialog.length}`, WIDTH / 2, HEIGHT - 80);

      // Prompt
      ctx.fillStyle = '#00ff00';
      ctx.font = '12px monospace';
      ctx.fillText('Press SPACE or ENTER to continue', WIDTH / 2, HEIGHT - 50);

      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      return;
    }

    // Obstacles
    for (const obs of obstacles) {
      if (obs.x > WIDTH + 10 || obs.x + obs.w < -10) continue;
      drawObstacle(ctx, obs);
    }

    // === SPEED LINES (intensity scales with speed) ===
    const speedFrac = (scrollSpeed - BASE_SCROLL_SPEED) / (MAX_SCROLL_SPEED - BASE_SCROLL_SPEED);
    if (speedFrac > 0.2) {
      const lineCount = Math.floor(speedFrac * 12);
      ctx.strokeStyle = `rgba(200, 230, 255, ${speedFrac * 0.15})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < lineCount; i++) {
        const ly = ((i * 97 + Math.floor(animTime * 3) * 41) % HEIGHT);
        const lx = ((i * 173 + Math.floor(animTime * 60) * 7) % (WIDTH * 0.6)) + WIDTH * 0.2;
        const len = 30 + speedFrac * 40;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - len, ly);
        ctx.stroke();
      }
    }

    // === PLAYER MOTION TRAIL ===
    if (!gameOver) {
      const trailCount = thrusting ? 6 : 3;
      for (let t = 1; t <= trailCount; t++) {
        const alpha = (1 - t / (trailCount + 1)) * 0.12;
        const trailX = PLAYER_X - t * (scrollSpeed * 0.009);
        const trailY = playerY + t * (playerVY * 0.005);
        const trailColor = invincibleTimer > 0
          ? `rgba(255, 200, 0, ${alpha})`
          : `rgba(0, 160, 255, ${alpha})`;
        const trailGrad = ctx.createRadialGradient(
          trailX + 18, trailY + 22, 0,
          trailX + 18, trailY + 22, 16
        );
        trailGrad.addColorStop(0, trailColor);
        trailGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.ellipse(trailX + 18, trailY + 22, 14 - t, 12 - t * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Collectibles
    for (const c of collectibles) {
      if (c.collected || c.x > WIDTH + 10 || c.x < -30) continue;
      if (c.type === 'sig') {
        drawSigRunner(ctx, c.x, c.y);
      } else {
        drawHat(ctx, c.x, c.y);
      }
    }

    // Player
    const flashVisible = damageCooldown <= 0 || Math.floor(animTime * 12) % 2 === 0;
    if (flashVisible) {
      drawPlayerRunner(ctx, PLAYER_X, playerY, thrusting, invincibleTimer > 0);
    }

    // === THRUST EXHAUST (layered particle system) ===
    if (thrusting) {
      // Wide ambient glow
      const ambGrad = ctx.createRadialGradient(
        PLAYER_X - 4, playerY + playerH + 4, 0,
        PLAYER_X - 4, playerY + playerH + 4, 28
      );
      ambGrad.addColorStop(0, 'rgba(0, 150, 255, 0.18)');
      ambGrad.addColorStop(0.5, 'rgba(0, 100, 200, 0.06)');
      ambGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = ambGrad;
      ctx.beginPath();
      ctx.arc(PLAYER_X - 4, playerY + playerH + 4, 28, 0, Math.PI * 2);
      ctx.fill();
      // Core hot particles (bright circles)
      for (let i = 0; i < 6; i++) {
        const tx = PLAYER_X - 3 - Math.random() * 14;
        const ty = playerY + playerH + (Math.random() - 0.3) * 6;
        const size = 1.5 + Math.random() * 2.5;
        const partGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, size);
        partGrad.addColorStop(0, 'rgba(220, 240, 255, 0.8)');
        partGrad.addColorStop(0.4, 'rgba(0, 180, 255, 0.5)');
        partGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = partGrad;
        ctx.beginPath();
        ctx.arc(tx, ty, size, 0, Math.PI * 2);
        ctx.fill();
      }
      // Trailing smoke wisps
      for (let i = 0; i < 4; i++) {
        const wx = PLAYER_X - 10 - Math.random() * 18;
        const wy = playerY + playerH - 2 + (Math.random() - 0.5) * 10;
        const wSize = 3 + Math.random() * 4;
        ctx.fillStyle = `rgba(80, 140, 200, ${0.1 + Math.random() * 0.08})`;
        ctx.beginPath();
        ctx.arc(wx, wy, wSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === INVINCIBILITY SHIELD (layered glow) ===
    if (invincibleTimer > 0) {
      const cx = PLAYER_X + playerW / 2;
      const cy = playerY + playerH / 2;
      const shimmer = animTime * 8;
      // Outer glow
      const shieldGrad = ctx.createRadialGradient(cx, cy, playerW * 0.4, cx, cy, playerW * 1.1);
      shieldGrad.addColorStop(0, 'rgba(255, 200, 0, 0.0)');
      shieldGrad.addColorStop(0.6, `rgba(255, 200, 0, ${0.08 + Math.sin(shimmer) * 0.04})`);
      shieldGrad.addColorStop(1, 'rgba(255, 200, 0, 0.0)');
      ctx.fillStyle = shieldGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, playerW * 1.1, 0, Math.PI * 2);
      ctx.fill();
      // Ring
      ctx.strokeStyle = `rgba(255, 220, 50, ${0.5 + Math.sin(shimmer) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, playerW * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      // Sparkles
      for (let s = 0; s < 4; s++) {
        const angle = shimmer * 0.5 + s * Math.PI / 2;
        const sparkX = cx + Math.cos(angle) * playerW * 0.85;
        const sparkY = cy + Math.sin(angle) * playerW * 0.85;
        ctx.fillStyle = `rgba(255, 255, 200, ${0.6 + Math.sin(shimmer + s) * 0.3})`;
        ctx.fillRect(sparkX - 2, sparkY - 2, 4, 4);
      }
    }

    // Particles (soft glow circles)
    for (const p of particles) {
      const pAlpha = Math.min(1, p.life * 2.5);
      const pSize = 2 + p.life * 3;
      ctx.globalAlpha = pAlpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = pSize * 1.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // === VIGNETTE ===
    const vigGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.3, WIDTH / 2, HEIGHT / 2, WIDTH * 0.7);
    vigGrad.addColorStop(0, 'transparent');
    vigGrad.addColorStop(1, `rgba(0, 0, 0, ${0.35 + progress * 0.15})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // === DAMAGE FLASH OVERLAY ===
    if (screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${screenFlash * 0.4})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // === LOW HEALTH WARNING ===
    if (health <= 2 && health > 0 && !gameOver) {
      const pulse = 0.08 + Math.sin(animTime * 6) * 0.06;
      ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Edge glow warning
      const warnGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.35, WIDTH / 2, HEIGHT / 2, WIDTH * 0.6);
      warnGrad.addColorStop(0, 'transparent');
      warnGrad.addColorStop(1, `rgba(255, 0, 0, ${pulse * 2})`);
      ctx.fillStyle = warnGrad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // === CLARITY BEACON (destination visual — major landmark) ===
    if (progress > 0.7) {
      const beaconIntensity = (progress - 0.7) / 0.3; // 0→1 from 70% to 100%
      const beaconX = WIDTH - 50 + (1 - beaconIntensity) * 80; // slides in from right
      const beaconY = HEIGHT / 2 - 30;
      const beaconSize = 30 + beaconIntensity * 60;
      const beaconPulse = 0.6 + Math.sin(animTime * 3) * 0.4;
      const beaconSpin = animTime * 0.8;

      // === BEACON COLUMN (energy pillar from floor to ceiling) ===
      if (beaconIntensity > 0.3) {
        const colAlpha = (beaconIntensity - 0.3) * 0.15;
        const colGrad = ctx.createLinearGradient(beaconX, 0, beaconX, HEIGHT);
        colGrad.addColorStop(0, `rgba(0, 255, 200, ${colAlpha * 0.3})`);
        colGrad.addColorStop(0.3, `rgba(0, 255, 200, ${colAlpha})`);
        colGrad.addColorStop(0.5, `rgba(100, 255, 220, ${colAlpha * 1.5})`);
        colGrad.addColorStop(0.7, `rgba(0, 255, 200, ${colAlpha})`);
        colGrad.addColorStop(1, `rgba(0, 255, 200, ${colAlpha * 0.3})`);
        ctx.fillStyle = colGrad;
        ctx.fillRect(beaconX - 6, 0, 12, HEIGHT);
      }

      // === OUTER AURA (large atmospheric glow) ===
      const auraGrad = ctx.createRadialGradient(beaconX, beaconY, 0, beaconX, beaconY, beaconSize * 3);
      auraGrad.addColorStop(0, `rgba(0, 255, 200, ${beaconIntensity * beaconPulse * 0.2})`);
      auraGrad.addColorStop(0.3, `rgba(0, 200, 255, ${beaconIntensity * beaconPulse * 0.1})`);
      auraGrad.addColorStop(0.6, `rgba(50, 150, 255, ${beaconIntensity * 0.05})`);
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(beaconX, beaconY, beaconSize * 3, 0, Math.PI * 2);
      ctx.fill();

      // === ROTATING RING SYSTEM ===
      ctx.strokeStyle = `rgba(0, 255, 200, ${beaconIntensity * 0.5})`;
      ctx.lineWidth = 2;
      // Outer ring
      ctx.beginPath();
      ctx.ellipse(beaconX, beaconY, beaconSize * 0.9, beaconSize * 0.3, beaconSpin, 0, Math.PI * 2);
      ctx.stroke();
      // Inner ring (counter-rotate)
      ctx.strokeStyle = `rgba(100, 255, 240, ${beaconIntensity * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(beaconX, beaconY, beaconSize * 0.6, beaconSize * 0.2, -beaconSpin * 1.3, 0, Math.PI * 2);
      ctx.stroke();
      // Third ring
      ctx.strokeStyle = `rgba(200, 255, 250, ${beaconIntensity * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(beaconX, beaconY, beaconSize * 1.1, beaconSize * 0.15, beaconSpin * 0.7 + 1, 0, Math.PI * 2);
      ctx.stroke();

      // === CORE ORB (multi-layered) ===
      // Outer orb glow
      const orbGrad = ctx.createRadialGradient(beaconX, beaconY, 0, beaconX, beaconY, beaconSize * 0.4);
      orbGrad.addColorStop(0, `rgba(255, 255, 255, ${beaconIntensity * 0.9})`);
      orbGrad.addColorStop(0.3, `rgba(150, 255, 230, ${beaconIntensity * 0.7})`);
      orbGrad.addColorStop(0.7, `rgba(0, 200, 180, ${beaconIntensity * 0.4})`);
      orbGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(beaconX, beaconY, beaconSize * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Core bright center
      ctx.beginPath();
      ctx.arc(beaconX, beaconY, beaconSize * 0.12 * beaconPulse, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // === RADIATING RAYS (animated) ===
      const rayCount = 12;
      for (let r = 0; r < rayCount; r++) {
        const angle = (r / rayCount) * Math.PI * 2 + beaconSpin;
        const rayLength = beaconSize * (0.8 + Math.sin(animTime * 4 + r * 1.5) * 0.3);
        const rayAlpha = beaconIntensity * (0.3 + Math.sin(animTime * 3 + r) * 0.15);
        ctx.strokeStyle = `rgba(0, 255, 200, ${rayAlpha})`;
        ctx.lineWidth = r % 3 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(
          beaconX + Math.cos(angle) * beaconSize * 0.3,
          beaconY + Math.sin(angle) * beaconSize * 0.3
        );
        ctx.lineTo(
          beaconX + Math.cos(angle) * rayLength,
          beaconY + Math.sin(angle) * rayLength
        );
        ctx.stroke();
      }

      // === ORBITING PARTICLES ===
      for (let p = 0; p < 8; p++) {
        const pAngle = beaconSpin * 2 + (p / 8) * Math.PI * 2;
        const pDist = beaconSize * (0.5 + Math.sin(animTime * 2 + p) * 0.2);
        const px = beaconX + Math.cos(pAngle) * pDist;
        const py = beaconY + Math.sin(pAngle) * pDist * 0.6;
        const pSize = 2 + Math.sin(animTime * 5 + p * 2) * 1;
        ctx.fillStyle = `rgba(200, 255, 240, ${beaconIntensity * 0.7})`;
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // === DIAMOND / CRYSTAL SHAPE (at high intensity) ===
      if (beaconIntensity > 0.5) {
        const crystalAlpha = (beaconIntensity - 0.5) * 2;
        const cSize = beaconSize * 0.25;
        ctx.fillStyle = `rgba(200, 255, 240, ${crystalAlpha * 0.5 * beaconPulse})`;
        ctx.beginPath();
        ctx.moveTo(beaconX, beaconY - cSize);
        ctx.lineTo(beaconX + cSize * 0.6, beaconY);
        ctx.lineTo(beaconX, beaconY + cSize);
        ctx.lineTo(beaconX - cSize * 0.6, beaconY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${crystalAlpha * 0.6})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // === LABEL ===
      if (progress > 0.82) {
        const labelAlpha = beaconIntensity * beaconPulse;
        ctx.fillStyle = `rgba(200, 255, 240, ${labelAlpha})`;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CLARITY BEACON', beaconX, beaconY + beaconSize * 1.3 + 10);
        if (progress > 0.92) {
          ctx.fillStyle = `rgba(150, 255, 220, ${labelAlpha * 0.7})`;
          ctx.font = '10px monospace';
          ctx.fillText('ALMOST THERE', beaconX, beaconY + beaconSize * 1.3 + 26);
        }
        ctx.textAlign = 'left';
      }
    }

    // Restore shake transform
    if (screenShake > 0) {
      ctx.restore();
    }

    // HUD
    drawHUD(ctx, progress);

    // Game over overlay
    if (gameOver) {
      // Gradient dark overlay
      const goGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, WIDTH * 0.6);
      goGrad.addColorStop(0, 'rgba(20, 0, 0, 0.8)');
      goGrad.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
      ctx.fillStyle = goGrad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Animated static noise (heavier)
      const noiseSeed = Math.floor(animTime * 10);
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 120; i++) {
        const nx = ((i * 173 + noiseSeed * 37) % WIDTH);
        const ny = ((i * 97 + noiseSeed * 53) % HEIGHT);
        ctx.fillStyle = i % 3 === 0 ? '#ff2222' : i % 3 === 1 ? '#440000' : '#110000';
        ctx.fillRect(nx, ny, (i % 5) + 2, 1.5);
      }
      ctx.globalAlpha = 1;

      // Horizontal glitch lines
      ctx.fillStyle = 'rgba(255, 0, 0, 0.04)';
      const glitchOffset = Math.floor(animTime * 6) * 17;
      for (let g = 0; g < 5; g++) {
        const gy = (glitchOffset + g * 113) % HEIGHT;
        ctx.fillRect(0, gy, WIDTH, 2);
      }

      // Red vignette edge
      const redVig = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.25, WIDTH / 2, HEIGHT / 2, WIDTH * 0.55);
      redVig.addColorStop(0, 'transparent');
      redVig.addColorStop(1, 'rgba(180, 0, 0, 0.15)');
      ctx.fillStyle = redVig;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.textAlign = 'center';
      // Glowing SIGNAL LOST text
      ctx.shadowColor = 'rgba(255, 50, 50, 0.6)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 30px monospace';
      ctx.fillText('SIGNAL LOST', WIDTH / 2, HEIGHT / 2 - 50);
      ctx.shadowBlur = 0;

      // Separator line
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2 - 120, HEIGHT / 2 - 30);
      ctx.lineTo(WIDTH / 2 + 120, HEIGHT / 2 - 30);
      ctx.stroke();

      // Stats
      ctx.fillStyle = '#eee';
      ctx.font = '14px monospace';
      ctx.fillText(`Score: ${score}  \u2022  Hats: ${hatsCollected}  \u2022  SIGs: ${sigsCollected}`, WIDTH / 2, HEIGHT / 2);
      ctx.fillStyle = '#999';
      ctx.font = '12px monospace';
      ctx.fillText(`Distance: ${Math.floor(progress * 100)}%  \u2022  Static destroyed: ${destroyedCount}`, WIDTH / 2, HEIGHT / 2 + 28);

      if (gameOverTimer > 1.5) {
        const promptPulse = 0.6 + Math.sin(animTime * 4) * 0.4;
        ctx.fillStyle = `rgba(0, 255, 100, ${promptPulse})`;
        ctx.font = '13px monospace';
        ctx.fillText('SPACE to retry  |  Q to quit', WIDTH / 2, HEIGHT / 2 + 75);
      }
      ctx.textAlign = 'left';
    }

    // Win overlay
    if (won) {
      ctx.fillStyle = 'rgba(0, 15, 10, 0.88)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // === BEACON CELEBRATION (drawn on top of overlay, centered) ===
      const bx = WIDTH / 2;
      const by = HEIGHT / 2 + 60;
      const bPulse = 0.6 + Math.sin(animTime * 3) * 0.4;
      const bSpin = animTime * 0.8;
      const bSize = 50;

      // Vertical beam
      const beamGrad = ctx.createLinearGradient(bx, 0, bx, HEIGHT);
      beamGrad.addColorStop(0, 'rgba(0, 255, 200, 0.02)');
      beamGrad.addColorStop(0.4, 'rgba(0, 255, 200, 0.08)');
      beamGrad.addColorStop(0.5, 'rgba(100, 255, 220, 0.12)');
      beamGrad.addColorStop(0.6, 'rgba(0, 255, 200, 0.08)');
      beamGrad.addColorStop(1, 'rgba(0, 255, 200, 0.02)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(bx - 8, 0, 16, HEIGHT);

      // Aura
      const auraGrad = ctx.createRadialGradient(bx, by, 0, bx, by, bSize * 2.5);
      auraGrad.addColorStop(0, `rgba(0, 255, 200, ${bPulse * 0.15})`);
      auraGrad.addColorStop(0.4, `rgba(0, 200, 180, ${bPulse * 0.06})`);
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(bx, by, bSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Rotating rings
      ctx.strokeStyle = `rgba(0, 255, 200, 0.35)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(bx, by, bSize * 0.8, bSize * 0.25, bSpin, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(100, 255, 240, 0.3)`;
      ctx.beginPath();
      ctx.ellipse(bx, by, bSize * 0.55, bSize * 0.18, -bSpin * 1.3, 0, Math.PI * 2);
      ctx.stroke();

      // Core orb
      const orbGrad = ctx.createRadialGradient(bx, by, 0, bx, by, bSize * 0.3);
      orbGrad.addColorStop(0, `rgba(255, 255, 255, ${bPulse * 0.7})`);
      orbGrad.addColorStop(0.5, `rgba(150, 255, 230, 0.4)`);
      orbGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(bx, by, bSize * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting particles
      for (let p = 0; p < 6; p++) {
        const pAngle = bSpin * 2 + (p / 6) * Math.PI * 2;
        const px = bx + Math.cos(pAngle) * bSize * 0.6;
        const py = by + Math.sin(pAngle) * bSize * 0.3;
        ctx.fillStyle = `rgba(200, 255, 240, ${0.5 + Math.sin(animTime * 4 + p) * 0.3})`;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // === TEXT OVERLAY ===
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('CLARITY BEACON REACHED!', WIDTH / 2, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('The Static Fields are cleansed!', WIDTH / 2, 78);
      ctx.fillStyle = '#ccc';
      ctx.font = '13px monospace';
      ctx.fillText(`Final Score: ${score}  |  Hats: ${hatsCollected}  |  SIGs: ${sigsCollected}`, WIDTH / 2, 108);
      ctx.fillText(`Static destroyed: ${destroyedCount} (+${destroyedCount * DESTROY_POINTS} pts)`, WIDTH / 2, 130);

      if (!wonNameSubmitted) {
        // Name entry
        ctx.fillStyle = '#00ffaa';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('ENTER YOUR NAME FOR THE LEADERBOARD', WIDTH / 2, 168);
        // Input box
        ctx.fillStyle = 'rgba(0, 40, 30, 0.85)';
        ctx.fillRect(WIDTH / 2 - 140, 178, 280, 32);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(WIDTH / 2 - 140, 178, 280, 32);
        // Name text with cursor
        const cursor = Math.floor(animTime * 3) % 2 === 0 ? '|' : '';
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px monospace';
        ctx.fillText(wonNameEntry + cursor, WIDTH / 2, 200);
        // Hint
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.fillText('Type your name and press ENTER to submit', WIDTH / 2, 226);
      } else {
        // Show leaderboard
        ctx.fillStyle = '#00ffaa';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('LEVEL 2 LEADERBOARD', WIDTH / 2, 165);
        ctx.font = '11px monospace';
        const board = wonLeaderboard.length > 0 ? wonLeaderboard : getL2Leaderboard();
        const startY = 188;
        for (let i = 0; i < Math.min(board.length, 8); i++) {
          const isYou = board[i].name === wonNameEntry && board[i].score === score;
          ctx.fillStyle = isYou ? '#00ffaa' : i === 0 ? '#ffdd44' : i < 3 ? '#00ff00' : '#cccccc';
          const rank = `${(i + 1).toString().padStart(2, ' ')}.`;
          const name = board[i].name.padEnd(16, ' ');
          const sc = board[i].score.toString().padStart(8, ' ');
          ctx.fillText(`${rank} ${name} ${sc}  ${board[i].date}`, WIDTH / 2, startY + i * 20);
        }
        if (gameOverTimer > 1.5) {
          ctx.fillStyle = '#00ff00';
          ctx.font = '12px monospace';
          ctx.fillText('SPACE to continue  |  Q to quit', WIDTH / 2, HEIGHT - 30);
        }
      }
      ctx.textAlign = 'left';
    }

    // End dialog (post-leaderboard, James thanking Sonia)
    if (wonEndDialog) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.97)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const ePage = endDialog[wonEndDialogPage];

      // Avatar (always full alpha)
      ctx.textAlign = 'center';
      if (ePage.speaker === 'James') {
        drawJames(ctx, WIDTH / 2 - 40, 30);
      } else {
        drawSonia(ctx, WIDTH / 2 - 18, 40);
      }

      // Speaker name
      ctx.fillStyle = ePage.speaker === 'James' ? '#ffaa00' : '#00ccff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(ePage.speaker, WIDTH / 2, 145);

      // Text (fades in)
      ctx.globalAlpha = wonEndDialogAlpha;
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '14px monospace';
      ePage.lines.forEach((line, i) => {
        ctx.fillText(line, WIDTH / 2, 190 + i * 30);
      });

      // Page indicator
      ctx.fillStyle = '#555';
      ctx.font = '10px monospace';
      ctx.fillText(`${wonEndDialogPage + 1} / ${endDialog.length}`, WIDTH / 2, HEIGHT - 80);

      // Prompt
      ctx.fillStyle = '#00ff00';
      ctx.font = '12px monospace';
      ctx.fillText('Press SPACE or ENTER to continue', WIDTH / 2, HEIGHT - 50);

      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  };

  // === DRAW HELPERS ===
  function drawJames(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // High-detail James portrait for dialog screens
    // Scale up: draw at ~80px wide, ~90px tall
    const cx = x + 40; // center x

    // === BODY / JACKET ===
    // Shoulders & torso (smart casual blazer)
    ctx.fillStyle = '#1a2d4a';
    ctx.beginPath();
    ctx.ellipse(cx, y + 72, 32, 18, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.fillStyle = '#1a2d4a';
    ctx.fillRect(cx - 30, y + 55, 60, 35);
    // Blazer lapels
    ctx.fillStyle = '#253d5a';
    ctx.beginPath();
    ctx.moveTo(cx - 8, y + 52);
    ctx.lineTo(cx - 18, y + 75);
    ctx.lineTo(cx - 8, y + 75);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 8, y + 52);
    ctx.lineTo(cx + 18, y + 75);
    ctx.lineTo(cx + 8, y + 75);
    ctx.closePath();
    ctx.fill();
    // Shirt underneath
    ctx.fillStyle = '#dde8f0';
    ctx.fillRect(cx - 7, y + 52, 14, 24);
    // Tie (subtle)
    ctx.fillStyle = '#2a6090';
    ctx.beginPath();
    ctx.moveTo(cx - 3, y + 52);
    ctx.lineTo(cx + 3, y + 52);
    ctx.lineTo(cx + 2, y + 68);
    ctx.lineTo(cx, y + 72);
    ctx.lineTo(cx - 2, y + 68);
    ctx.closePath();
    ctx.fill();

    // === NECK ===
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(cx - 6, y + 46, 12, 10);

    // === HEAD (oval) ===
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.ellipse(cx, y + 32, 18, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Jaw definition
    ctx.fillStyle = '#dbb890';
    ctx.beginPath();
    ctx.ellipse(cx, y + 42, 14, 8, 0, 0, Math.PI);
    ctx.fill();

    // === HAIR (ginger) ===
    ctx.fillStyle = '#c85a20';
    ctx.beginPath();
    ctx.ellipse(cx, y + 22, 19, 14, 0, Math.PI + 0.3, -0.3);
    ctx.fill();
    // Side hair
    ctx.fillRect(cx - 19, y + 22, 6, 14);
    ctx.fillRect(cx + 13, y + 22, 6, 12);
    // Hair detail/texture
    ctx.strokeStyle = '#a04818';
    ctx.lineWidth = 1;
    for (let h = 0; h < 5; h++) {
      ctx.beginPath();
      ctx.moveTo(cx - 12 + h * 6, y + 14);
      ctx.quadraticCurveTo(cx - 10 + h * 6, y + 20, cx - 8 + h * 6, y + 14);
      ctx.stroke();
    }

    // === EYES ===
    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx - 7, y + 32, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 7, y + 32, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Irises
    ctx.fillStyle = '#3a6020';
    ctx.beginPath();
    ctx.arc(cx - 7, y + 33, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 7, y + 33, 3, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx - 7, y + 33, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 7, y + 33, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 8, y + 32, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 6, y + 32, 1, 0, Math.PI * 2);
    ctx.fill();
    // Eyebrows (ginger)
    ctx.strokeStyle = '#c85a20';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, y + 27);
    ctx.quadraticCurveTo(cx - 7, y + 25, cx - 2, y + 27);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 2, y + 27);
    ctx.quadraticCurveTo(cx + 7, y + 25, cx + 12, y + 27);
    ctx.stroke();

    // === NOSE ===
    ctx.strokeStyle = '#c0a080';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, y + 32);
    ctx.lineTo(cx - 2, y + 38);
    ctx.lineTo(cx + 1, y + 38);
    ctx.stroke();

    // === MOUTH (friendly smile) ===
    ctx.strokeStyle = '#8a4a30';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, y + 41, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // === HAT STACK (signature look) ===
    // Hat 1: Orange project manager hat
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.ellipse(cx, y + 13, 24, 4, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.fillStyle = '#ee7700';
    ctx.fillRect(cx - 14, y + 3, 28, 11);
    ctx.beginPath();
    ctx.ellipse(cx, y + 3, 14, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9922';
    ctx.fill();
    // Band
    ctx.fillStyle = '#cc5500';
    ctx.fillRect(cx - 14, y + 9, 28, 3);

    // Hat 2: Green dev hat stacked on top
    ctx.fillStyle = '#33aa55';
    ctx.beginPath();
    ctx.ellipse(cx, y + 2, 18, 3, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.fillStyle = '#2a8844';
    ctx.fillRect(cx - 10, y - 7, 20, 10);
    ctx.beginPath();
    ctx.ellipse(cx, y - 7, 10, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#44bb66';
    ctx.fill();
    // Band
    ctx.fillStyle = '#226633';
    ctx.fillRect(cx - 10, y - 3, 20, 2);

    // Hat 3: Tiny purple hat on top (CS hat)
    ctx.fillStyle = '#7744aa';
    ctx.fillRect(cx - 6, y - 14, 12, 7);
    ctx.fillStyle = '#9955cc';
    ctx.beginPath();
    ctx.ellipse(cx, y - 7, 9, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, y - 14, 6, 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#aa66dd';
    ctx.fill();

    // === ARMS (one holding Swiss army knife) ===
    ctx.fillStyle = '#1a2d4a';
    // Left arm
    ctx.fillRect(cx - 30, y + 58, 8, 24);
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(cx - 30, y + 78, 8, 6);
    // Right arm (holding knife)
    ctx.fillStyle = '#1a2d4a';
    ctx.fillRect(cx + 22, y + 58, 8, 20);
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(cx + 22, y + 74, 8, 6);
    // Swiss army knife
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(cx + 31, y + 68, 5, 14);
    ctx.fillStyle = '#eee';
    ctx.fillRect(cx + 32, y + 66, 3, 4);
    ctx.fillRect(cx + 36, y + 72, 4, 2);
    ctx.fillRect(cx + 36, y + 76, 3, 2);
    // Knife cross emblem
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx + 32, y + 73, 3, 1);
    ctx.fillRect(cx + 33, y + 72, 1, 3);
  }

  function drawSonia(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // High-detail Sonia portrait — the hero of Subphonic Audventures
    const cx = x + 40; // center x

    // === BODY (flight suit with sonic tech) ===
    // Shoulders
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath();
    ctx.ellipse(cx, y + 72, 28, 16, 0, Math.PI, 0, true);
    ctx.fill();
    // Torso
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(cx - 26, y + 56, 52, 34);
    // Suit inner layer
    ctx.fillStyle = '#2a2a5a';
    ctx.fillRect(cx - 22, y + 58, 44, 30);
    // Sonic circuit patterns on suit
    ctx.strokeStyle = 'rgba(0, 200, 170, 0.6)';
    ctx.lineWidth = 1;
    // Left circuit line
    ctx.beginPath();
    ctx.moveTo(cx - 18, y + 60);
    ctx.lineTo(cx - 18, y + 72);
    ctx.lineTo(cx - 12, y + 76);
    ctx.lineTo(cx - 12, y + 86);
    ctx.stroke();
    // Right circuit line
    ctx.beginPath();
    ctx.moveTo(cx + 18, y + 60);
    ctx.lineTo(cx + 18, y + 72);
    ctx.lineTo(cx + 12, y + 76);
    ctx.lineTo(cx + 12, y + 86);
    ctx.stroke();
    // Circuit nodes
    ctx.fillStyle = '#00ffaa';
    ctx.beginPath();
    ctx.arc(cx - 12, y + 76, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 12, y + 76, 2, 0, Math.PI * 2);
    ctx.fill();
    // Central chest emblem (sound wave)
    ctx.strokeStyle = '#00ccaa';
    ctx.lineWidth = 1.5;
    for (let w = 0; w < 3; w++) {
      ctx.beginPath();
      ctx.arc(cx, y + 68, 4 + w * 4, -0.7, 0.7);
      ctx.stroke();
    }
    // Belt
    ctx.fillStyle = '#333';
    ctx.fillRect(cx - 22, y + 80, 44, 4);
    ctx.fillStyle = '#00ccaa';
    ctx.fillRect(cx - 4, y + 79, 8, 6);

    // === NECK ===
    ctx.fillStyle = '#e0b890';
    ctx.fillRect(cx - 5, y + 47, 10, 10);

    // === HEAD (slightly narrower/feminine) ===
    ctx.fillStyle = '#e0b890';
    ctx.beginPath();
    ctx.ellipse(cx, y + 33, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Chin
    ctx.beginPath();
    ctx.ellipse(cx, y + 44, 11, 7, 0, 0, Math.PI);
    ctx.fillStyle = '#d8a880';
    ctx.fill();

    // === HAIR (purple, flowing, wild — sonic powered) ===
    ctx.fillStyle = '#7a3a9a';
    // Main hair volume
    ctx.beginPath();
    ctx.ellipse(cx, y + 22, 20, 16, 0, Math.PI + 0.4, -0.4);
    ctx.fill();
    // Left flowing strand
    ctx.beginPath();
    ctx.moveTo(cx - 18, y + 24);
    ctx.quadraticCurveTo(cx - 24, y + 36, cx - 20, y + 48);
    ctx.quadraticCurveTo(cx - 22, y + 54, cx - 18, y + 58);
    ctx.lineTo(cx - 14, y + 52);
    ctx.quadraticCurveTo(cx - 18, y + 44, cx - 15, y + 34);
    ctx.closePath();
    ctx.fill();
    // Right flowing strand
    ctx.beginPath();
    ctx.moveTo(cx + 18, y + 24);
    ctx.quadraticCurveTo(cx + 22, y + 34, cx + 20, y + 44);
    ctx.quadraticCurveTo(cx + 24, y + 52, cx + 20, y + 56);
    ctx.lineTo(cx + 16, y + 50);
    ctx.quadraticCurveTo(cx + 18, y + 40, cx + 15, y + 30);
    ctx.closePath();
    ctx.fill();
    // Hair highlights
    ctx.fillStyle = '#9a5aba';
    ctx.beginPath();
    ctx.ellipse(cx - 6, y + 18, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 8, y + 20, 4, 3, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Sonic energy in hair (glowing strand tips)
    const hairGlow = 0.5 + Math.sin(animTime * 4) * 0.3;
    ctx.fillStyle = `rgba(0, 200, 255, ${hairGlow})`;
    ctx.beginPath();
    ctx.arc(cx - 18, y + 56, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 20, y + 54, 2, 0, Math.PI * 2);
    ctx.fill();

    // === GOGGLES (signature look — pushed up on forehead) ===
    // Strap
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, y + 24, 16, 8, 0, 0.3, Math.PI - 0.3);
    ctx.stroke();
    // Left lens
    ctx.fillStyle = '#004433';
    ctx.beginPath();
    ctx.ellipse(cx - 8, y + 23, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ccaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Right lens
    ctx.fillStyle = '#004433';
    ctx.beginPath();
    ctx.ellipse(cx + 8, y + 23, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ccaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Lens shine
    ctx.fillStyle = '#aaffee';
    ctx.beginPath();
    ctx.ellipse(cx - 10, y + 21, 3, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 6, y + 21, 3, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Bridge
    ctx.fillStyle = '#00aa88';
    ctx.fillRect(cx - 2, y + 22, 4, 3);

    // === EYES (large, expressive) ===
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx - 6, y + 34, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 6, y + 34, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Irises (violet)
    ctx.fillStyle = '#6a2a9a';
    ctx.beginPath();
    ctx.arc(cx - 6, y + 35, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 6, y + 35, 3, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx - 6, y + 35, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 6, y + 35, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine (double catch-light for liveliness)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 7, y + 33, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5, y + 33, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 5, y + 36, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 7, y + 36, 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Eyelashes
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx - 6, y + 34, 5, -2.5, -0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 6, y + 34, 5, -2.4, -0.6);
    ctx.stroke();

    // === EYEBROWS ===
    ctx.strokeStyle = '#5a2a7a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 11, y + 29);
    ctx.quadraticCurveTo(cx - 6, y + 27, cx - 2, y + 29);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 2, y + 29);
    ctx.quadraticCurveTo(cx + 6, y + 27, cx + 11, y + 29);
    ctx.stroke();

    // === NOSE (small, cute) ===
    ctx.strokeStyle = '#c09070';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y + 35);
    ctx.lineTo(cx - 1.5, y + 40);
    ctx.lineTo(cx + 1, y + 40);
    ctx.stroke();

    // === MOUTH (confident smirk) ===
    ctx.strokeStyle = '#8a4030';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, y + 44);
    ctx.quadraticCurveTo(cx, y + 47, cx + 6, y + 43);
    ctx.stroke();

    // === ARMS ===
    ctx.fillStyle = '#1a1a3a';
    // Left arm
    ctx.fillRect(cx - 26, y + 58, 7, 22);
    ctx.fillStyle = '#e0b890';
    ctx.fillRect(cx - 26, y + 76, 7, 6);
    // Right arm (raised slightly, holding something sonic)
    ctx.fillStyle = '#1a1a3a';
    ctx.save();
    ctx.translate(cx + 19, y + 58);
    ctx.rotate(-0.2);
    ctx.fillRect(0, 0, 7, 20);
    ctx.fillStyle = '#e0b890';
    ctx.fillRect(0, 18, 7, 6);
    ctx.restore();

    // === SONIC DEVICE in right hand ===
    ctx.fillStyle = '#1a3a4a';
    ctx.fillRect(cx + 26, y + 66, 4, 12);
    ctx.fillStyle = '#00ffaa';
    ctx.beginPath();
    ctx.arc(cx + 28, y + 64, 3, 0, Math.PI * 2);
    ctx.fill();
    // Sound waves from device
    const waveAlpha = 0.4 + Math.sin(animTime * 5) * 0.3;
    ctx.strokeStyle = `rgba(0, 255, 170, ${waveAlpha})`;
    ctx.lineWidth = 1;
    for (let w = 0; w < 3; w++) {
      ctx.beginPath();
      ctx.arc(cx + 28, y + 64, 5 + w * 4, -0.8, 0.8);
      ctx.stroke();
    }
  }

  function drawPlayerRunner(ctx: CanvasRenderingContext2D, x: number, y: number, boosting: boolean, invincible: boolean) {
    const tilt = boosting ? -0.2 : 0.1;
    ctx.save();
    ctx.translate(x + playerW / 2, y + playerH / 2);
    ctx.rotate(tilt);
    ctx.translate(-(x + playerW / 2), -(y + playerH / 2));

    // === JETPACK (high detail with panels and vents) ===
    // Main body
    const jpGrad = ctx.createLinearGradient(x - 7, y + 6, x + 5, y + 6);
    jpGrad.addColorStop(0, '#2a2a4a');
    jpGrad.addColorStop(0.5, '#4a4a6a');
    jpGrad.addColorStop(1, '#2a2a4a');
    ctx.fillStyle = jpGrad;
    ctx.beginPath();
    ctx.roundRect(x - 7, y + 6, 12, 30, 3);
    ctx.fill();
    // Panel lines
    ctx.strokeStyle = '#5a5a8a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 12);
    ctx.lineTo(x + 3, y + 12);
    ctx.moveTo(x - 5, y + 24);
    ctx.lineTo(x + 3, y + 24);
    ctx.stroke();
    // Vent slots
    ctx.fillStyle = '#1a1a2a';
    for (let v = 0; v < 3; v++) {
      ctx.fillRect(x - 4, y + 14 + v * 4, 6, 2);
    }
    // Nozzle
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(x - 5, y + 36, 8, 5, [0, 0, 2, 2]);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 4, y + 34, 6, 3);
    // Thrust flame
    if (boosting) {
      const flameH = 8 + Math.sin(animTime * 30) * 3;
      const flameGrad = ctx.createLinearGradient(x - 1, y + 41, x - 1, y + 41 + flameH);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.2, '#88ddff');
      flameGrad.addColorStop(0.5, '#0088ff');
      flameGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(x - 4, y + 41);
      ctx.lineTo(x - 1, y + 41 + flameH);
      ctx.lineTo(x + 2, y + 41);
      ctx.closePath();
      ctx.fill();
      // Side sparks
      ctx.fillStyle = `rgba(0, 200, 255, ${0.5 + Math.random() * 0.3})`;
      ctx.fillRect(x - 5 - Math.random() * 3, y + 40 + Math.random() * 4, 2, 2);
      ctx.fillRect(x + 3 + Math.random() * 3, y + 40 + Math.random() * 4, 2, 2);
    }
    // Status light on jetpack
    const lightPulse = 0.5 + Math.sin(animTime * 6) * 0.5;
    ctx.fillStyle = boosting ? `rgba(0, 255, 200, ${lightPulse})` : `rgba(255, 150, 0, ${lightPulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(x - 1, y + 8, 2, 0, Math.PI * 2);
    ctx.fill();

    // === BODY (flight suit with detail) ===
    const suitBase = invincible ? '#8a6600' : '#1a1a3a';
    const suitMid = invincible ? '#ccaa22' : '#2a2a5a';
    const accentColor = invincible ? '#ffee88' : '#00ccaa';

    // Torso base
    ctx.fillStyle = suitBase;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 16, 28, 26, 2);
    ctx.fill();
    // Suit inner
    ctx.fillStyle = suitMid;
    ctx.fillRect(x + 6, y + 18, 24, 22);
    // Circuit lines on suit
    ctx.strokeStyle = `${accentColor}88`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 20);
    ctx.lineTo(x + 8, y + 28);
    ctx.lineTo(x + 12, y + 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 28, y + 20);
    ctx.lineTo(x + 28, y + 28);
    ctx.lineTo(x + 24, y + 32);
    ctx.stroke();
    // Circuit nodes
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(x + 12, y + 32, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 24, y + 32, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Sound wave emblem on chest
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    for (let w = 0; w < 2; w++) {
      ctx.beginPath();
      ctx.arc(x + 18, y + 25, 3 + w * 3, -0.6, 0.6);
      ctx.stroke();
    }
    // Belt
    ctx.fillStyle = invincible ? '#ffdd00' : '#333';
    ctx.fillRect(x + 6, y + 36, 24, 3);
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(x + 18, y + 37.5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // === HEAD ===
    // Neck
    ctx.fillStyle = '#e0b890';
    ctx.fillRect(x + 14, y + 13, 8, 5);
    // Head shape (rounded, warm skin)
    ctx.fillStyle = '#e0b890';
    ctx.beginPath();
    ctx.roundRect(x + 7, y + 1, 22, 16, 6);
    ctx.fill();
    // Cheeks (warmer tone)
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(x + 12, y + 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 24, y + 11, 3, 0, Math.PI * 2);
    ctx.fill();

    // === EYES (expressive, visible) ===
    // Eye whites
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x + 11, y + 7, 6, 5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 19, y + 7, 6, 5, 2);
    ctx.fill();
    // Irises (green)
    ctx.fillStyle = invincible ? '#ffcc00' : '#44aa66';
    ctx.beginPath();
    ctx.arc(x + 14, y + 9.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 22, y + 9.5, 2, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + 14.5, y + 9.5, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 22.5, y + 9.5, 1, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 13.5, y + 8.5, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 21.5, y + 8.5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // === EXPRESSION (confident smile) ===
    ctx.strokeStyle = '#6a4030';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + 18, y + 13, 3.5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // === HAIR (purple, flowing back in wind) ===
    ctx.fillStyle = invincible ? '#cc88ff' : '#7a3a9a';
    // Main volume on top
    ctx.beginPath();
    ctx.roundRect(x + 5, y - 2, 24, 8, [4, 4, 0, 0]);
    ctx.fill();
    // Fringe
    ctx.fillRect(x + 7, y + 1, 5, 4);
    // Wind-blown strands trailing back
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 2);
    ctx.quadraticCurveTo(x + 2, y + 8, x + 0, y + 14);
    ctx.lineTo(x + 3, y + 12);
    ctx.quadraticCurveTo(x + 4, y + 7, x + 8, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5);
    ctx.quadraticCurveTo(x + 1, y + 12, x - 1, y + 18);
    ctx.lineTo(x + 2, y + 16);
    ctx.quadraticCurveTo(x + 3, y + 10, x + 7, y + 6);
    ctx.closePath();
    ctx.fill();
    // Hair highlight
    ctx.fillStyle = invincible ? '#ddaaff' : '#9a5aba';
    ctx.beginPath();
    ctx.roundRect(x + 14, y - 1, 8, 4, 2);
    ctx.fill();
    // Hair energy tips (glow at strand ends)
    const tipGlow = 0.4 + Math.sin(animTime * 5) * 0.3;
    ctx.fillStyle = invincible ? `rgba(255, 200, 100, ${tipGlow})` : `rgba(0, 200, 255, ${tipGlow})`;
    ctx.beginPath();
    ctx.arc(x + 0, y + 14, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 1, y + 18, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // === GOGGLES (pushed up on forehead) ===
    ctx.fillStyle = invincible ? '#443300' : '#003322';
    ctx.beginPath();
    ctx.roundRect(x + 10, y - 1, 5, 3, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 20, y - 1, 5, 3, 1);
    ctx.fill();
    // Goggle frame
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(x + 10, y - 1, 5, 3, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x + 20, y - 1, 5, 3, 1);
    ctx.stroke();
    // Strap across hair
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + 7, y + 1);
    ctx.moveTo(x + 25, y);
    ctx.lineTo(x + 28, y + 1);
    ctx.stroke();

    // === ARM (trailing back) ===
    ctx.fillStyle = suitMid;
    ctx.save();
    ctx.translate(x + 30, y + 20);
    ctx.rotate(boosting ? 0.4 : 0.2);
    ctx.fillRect(0, 0, 5, 12);
    // Glove
    ctx.fillStyle = invincible ? '#aa8800' : '#2a4a4a';
    ctx.beginPath();
    ctx.roundRect(0, 11, 6, 5, 2);
    ctx.fill();
    ctx.restore();

    // === PLAYER GLOW (invincible aura) ===
    if (invincible) {
      // Warm golden shield aura
      const auraAlpha = 0.25 + Math.sin(animTime * 8) * 0.1;
      const auraGrad = ctx.createRadialGradient(x + 18, y + 22, 5, x + 18, y + 22, 28);
      auraGrad.addColorStop(0, `rgba(255, 220, 50, ${auraAlpha * 0.3})`);
      auraGrad.addColorStop(0.7, `rgba(255, 180, 0, ${auraAlpha * 0.15})`);
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.ellipse(x + 18, y + 22, 24, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      // Edge ring
      ctx.strokeStyle = `rgba(255, 220, 50, ${0.4 + Math.sin(animTime * 8) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + 18, y + 22, 20, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    const pulse = 0.7 + Math.sin(animTime * 5 + obs.x * 0.03) * 0.3;
    const glowAlpha = pulse * 0.4;

    switch (obs.type) {
      case 'static-block': {
        // Danger glow aura
        ctx.shadowColor = `rgba(255, 40, 60, ${glowAlpha})`;
        ctx.shadowBlur = 16;
        // Outer shell
        ctx.fillStyle = `rgba(100, 10, 20, ${pulse * 0.95})`;
        ctx.beginPath();
        ctx.roundRect(obs.x - 1, obs.y - 1, obs.w + 2, obs.h + 2, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Inner gradient body
        const blockGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
        blockGrad.addColorStop(0, `rgba(200, 50, 60, ${pulse * 0.7})`);
        blockGrad.addColorStop(0.3, `rgba(140, 20, 40, ${pulse * 0.9})`);
        blockGrad.addColorStop(0.7, `rgba(120, 15, 30, ${pulse * 0.95})`);
        blockGrad.addColorStop(1, `rgba(180, 40, 50, ${pulse * 0.7})`);
        ctx.fillStyle = blockGrad;
        ctx.beginPath();
        ctx.roundRect(obs.x + 1, obs.y + 1, obs.w - 2, obs.h - 2, 2);
        ctx.fill();
        // Animated static noise texture
        ctx.fillStyle = `rgba(255, 120, 100, ${pulse * 0.35})`;
        for (let i = 0; i < Math.min(15, obs.w / 4); i++) {
          const nx = obs.x + 2 + ((i * 37 + Math.floor(animTime * 10) * 7) % Math.max(1, obs.w - 6));
          const ny = obs.y + 2 + ((i * 23 + Math.floor(animTime * 7) * 11) % Math.max(1, obs.h - 6));
          ctx.fillRect(nx, ny, 2 + (i % 3), 2);
        }
        // Horizontal interference lines
        ctx.strokeStyle = `rgba(255, 150, 130, ${pulse * 0.25})`;
        ctx.lineWidth = 0.5;
        const linePhase = Math.floor(animTime * 4) * 5;
        for (let ly = obs.y + 4; ly < obs.y + obs.h - 4; ly += 6) {
          const offset = ((ly + linePhase) % 12) - 6;
          if (Math.abs(offset) < 3) {
            ctx.beginPath();
            ctx.moveTo(obs.x + 2, ly);
            ctx.lineTo(obs.x + obs.w - 2, ly);
            ctx.stroke();
          }
        }
        // Glowing border
        ctx.strokeStyle = `rgba(255, 60, 80, ${pulse * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 3);
        ctx.stroke();
        // Corner warning indicators
        ctx.fillStyle = `rgba(255, 200, 100, ${pulse * 0.6})`;
        ctx.fillRect(obs.x + 2, obs.y + 2, 3, 3);
        ctx.fillRect(obs.x + obs.w - 5, obs.y + 2, 3, 3);
        ctx.fillRect(obs.x + 2, obs.y + obs.h - 5, 3, 3);
        ctx.fillRect(obs.x + obs.w - 5, obs.y + obs.h - 5, 3, 3);
        break;
      }
      case 'static-wave': {
        // Background energy field
        const waveGrad = ctx.createRadialGradient(
          obs.x + obs.w / 2, obs.y + obs.h / 2, 0,
          obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2
        );
        waveGrad.addColorStop(0, `rgba(200, 50, 220, ${pulse * 0.12})`);
        waveGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = waveGrad;
        ctx.fillRect(obs.x - 8, obs.y - 8, obs.w + 16, obs.h + 16);

        // Main wave (thick, glowing)
        ctx.shadowColor = `rgba(220, 80, 255, ${glowAlpha})`;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(230, 100, 255, ${pulse})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let wx = 0; wx < obs.w; wx += 2) {
          const wy = obs.y + obs.h / 2 + Math.sin((wx + animTime * 200) * 0.1) * (obs.h / 2.5);
          if (wx === 0) ctx.moveTo(obs.x + wx, wy);
          else ctx.lineTo(obs.x + wx, wy);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Secondary wave (out of phase)
        ctx.strokeStyle = `rgba(180, 60, 200, ${pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let wx = 0; wx < obs.w; wx += 2) {
          const wy = obs.y + obs.h / 2 + Math.sin((wx + animTime * 250 + 40) * 0.12) * (obs.h / 3);
          if (wx === 0) ctx.moveTo(obs.x + wx, wy);
          else ctx.lineTo(obs.x + wx, wy);
        }
        ctx.stroke();

        // Tertiary ghost wave
        ctx.strokeStyle = `rgba(140, 40, 160, ${pulse * 0.25})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let wx = 0; wx < obs.w; wx += 3) {
          const wy = obs.y + obs.h / 2 + Math.sin((wx + animTime * 150 - 20) * 0.08) * (obs.h / 2);
          if (wx === 0) ctx.moveTo(obs.x + wx, wy);
          else ctx.lineTo(obs.x + wx, wy);
        }
        ctx.stroke();

        // Sparkle points along wave
        const sparkCount = Math.floor(obs.w / 30);
        for (let s = 0; s < sparkCount; s++) {
          const sx = obs.x + (s + 0.5) * (obs.w / sparkCount);
          const sy = obs.y + obs.h / 2 + Math.sin((sx + animTime * 200) * 0.1) * (obs.h / 2.5);
          const sparkAlpha = Math.sin(animTime * 8 + s * 2) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(255, 200, 255, ${sparkAlpha * pulse})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'static-pillar': {
        // Pillar glow
        ctx.shadowColor = `rgba(80, 80, 255, ${glowAlpha})`;
        ctx.shadowBlur = 14;
        // Main pillar body (complex gradient)
        const pillarGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y);
        pillarGrad.addColorStop(0, `rgba(40, 40, 130, ${pulse * 0.8})`);
        pillarGrad.addColorStop(0.2, `rgba(60, 60, 180, ${pulse * 0.9})`);
        pillarGrad.addColorStop(0.5, `rgba(80, 80, 210, ${pulse})`);
        pillarGrad.addColorStop(0.8, `rgba(60, 60, 180, ${pulse * 0.9})`);
        pillarGrad.addColorStop(1, `rgba(40, 40, 130, ${pulse * 0.8})`);
        ctx.fillStyle = pillarGrad;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.shadowBlur = 0;

        // Vertical energy channels
        ctx.strokeStyle = `rgba(140, 140, 255, ${pulse * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w * 0.3, obs.y);
        ctx.lineTo(obs.x + obs.w * 0.3, obs.y + obs.h);
        ctx.moveTo(obs.x + obs.w * 0.7, obs.y);
        ctx.lineTo(obs.x + obs.w * 0.7, obs.y + obs.h);
        ctx.stroke();

        // Electricity bolts (animated)
        ctx.strokeStyle = `rgba(200, 200, 255, ${pulse * 0.9})`;
        ctx.lineWidth = 1.5;
        const boltSeed = Math.floor(animTime * 8) * 31;
        for (let j = 0; j < 5; j++) {
          ctx.beginPath();
          const startY2 = obs.y + ((boltSeed + j * 137) % Math.max(1, obs.h - 10)) + 5;
          ctx.moveTo(obs.x + 2, startY2);
          let bx = obs.x + 2;
          for (let seg = 0; seg < 4; seg++) {
            bx += (obs.w - 4) / 4;
            const by = startY2 + ((boltSeed + j * 53 + seg * 17) % 16) - 8;
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
        }

        // Glowing nodes at bolt intersections
        for (let n = 0; n < 3; n++) {
          const ny2 = obs.y + obs.h * (0.25 + n * 0.25);
          const nodeGlow = Math.sin(animTime * 6 + n * 2) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(200, 200, 255, ${nodeGlow * pulse})`;
          ctx.beginPath();
          ctx.arc(obs.x + obs.w / 2, ny2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Edge highlights (brighter)
        ctx.fillStyle = `rgba(160, 160, 255, ${pulse * 0.5})`;
        ctx.fillRect(obs.x, obs.y, 2, obs.h);
        ctx.fillRect(obs.x + obs.w - 2, obs.y, 2, obs.h);
        // Top/bottom caps with gradient
        const capGrad = ctx.createLinearGradient(obs.x, 0, obs.x + obs.w, 0);
        capGrad.addColorStop(0, `rgba(100, 100, 200, ${pulse * 0.4})`);
        capGrad.addColorStop(0.5, `rgba(160, 160, 255, ${pulse * 0.8})`);
        capGrad.addColorStop(1, `rgba(100, 100, 200, ${pulse * 0.4})`);
        ctx.fillStyle = capGrad;
        if (obs.y > 0) ctx.fillRect(obs.x - 3, obs.y, obs.w + 6, 4);
        if (obs.y + obs.h < HEIGHT) ctx.fillRect(obs.x - 3, obs.y + obs.h - 4, obs.w + 6, 4);
        break;
      }
    }
  }

  function drawSigRunner(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bob = Math.sin(animTime * 3 + x * 0.01) * 3;
    const spin = animTime * 2 + x * 0.005;
    const cx2 = x + 12;
    const cy = y + 12 + bob;

    // Outer glow (larger, more visible)
    const sigGlow = ctx.createRadialGradient(cx2, cy, 0, cx2, cy, 22);
    sigGlow.addColorStop(0, `rgba(0, 255, 100, ${0.2 + Math.sin(animTime * 4) * 0.08})`);
    sigGlow.addColorStop(0.5, `rgba(0, 200, 80, ${0.08})`);
    sigGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = sigGlow;
    ctx.beginPath();
    ctx.arc(cx2, cy, 22, 0, Math.PI * 2);
    ctx.fill();

    // Rotating outer ring
    ctx.strokeStyle = `rgba(0, 255, 120, ${0.4 + Math.sin(animTime * 3) * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx2, cy, 12, 12, spin, 0, Math.PI * 1.5);
    ctx.stroke();

    // Inner disc (gradient)
    const discGrad = ctx.createRadialGradient(cx2, cy, 0, cx2, cy, 9);
    discGrad.addColorStop(0, '#003320');
    discGrad.addColorStop(0.7, '#004428');
    discGrad.addColorStop(1, '#002818');
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.arc(cx2, cy, 9, 0, Math.PI * 2);
    ctx.fill();

    // Disc border (double ring)
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx2, cy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx2, cy, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Sound wave arcs (animated, emanating)
    for (let w = 0; w < 3; w++) {
      const wavePhase = (animTime * 3 + w * 0.8) % 3;
      const waveAlpha = Math.max(0, 1 - wavePhase / 2);
      ctx.strokeStyle = `rgba(0, 255, 130, ${waveAlpha * 0.8})`;
      ctx.lineWidth = 1.5 - w * 0.3;
      ctx.beginPath();
      ctx.arc(cx2 + 2, cy, 3 + wavePhase * 4, -0.6, 0.6);
      ctx.stroke();
    }

    // Center note symbol (musical)
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.ellipse(cx2, cy + 1, 2.5, 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx2 + 2.2, cy + 1);
    ctx.lineTo(cx2 + 2.2, cy - 4);
    ctx.lineTo(cx2 + 5, cy - 3);
    ctx.stroke();

    // Sparkle particles
    const sparkle = Math.sin(animTime * 6 + x) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(200, 255, 200, ${sparkle * 0.7})`;
    ctx.beginPath();
    ctx.arc(cx2 + 8 * Math.cos(spin * 2), cy + 8 * Math.sin(spin * 2), 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx2 - 6 * Math.cos(spin * 1.5 + 1), cy - 6 * Math.sin(spin * 1.5 + 1), 1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHat(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bob = Math.sin(animTime * 2.5 + x * 0.02) * 3;
    const rot = Math.sin(animTime * 1.5 + x * 0.01) * 0.1;
    const hx = x + 12;
    const hy = y + 12 + bob;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(rot);

    // Golden radial glow (warm, inviting)
    const hatGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    hatGlow.addColorStop(0, `rgba(255, 200, 0, ${0.25 + Math.sin(animTime * 5) * 0.1})`);
    hatGlow.addColorStop(0.6, `rgba(255, 150, 0, ${0.08})`);
    hatGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = hatGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    // Spinning sparkle ring
    for (let s = 0; s < 4; s++) {
      const angle = animTime * 3 + s * (Math.PI * 2 / 4);
      const sparkX = Math.cos(angle) * 14;
      const sparkY = Math.sin(angle) * 14;
      const sparkAlpha = 0.4 + Math.sin(animTime * 7 + s * 1.5) * 0.3;
      ctx.fillStyle = `rgba(255, 255, 200, ${sparkAlpha})`;
      // Cross sparkle shape
      ctx.fillRect(sparkX - 0.5, sparkY - 2, 1, 4);
      ctx.fillRect(sparkX - 2, sparkY - 0.5, 4, 1);
    }

    // Hat shadow (grounding)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 13, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hat brim (3D curved)
    ctx.fillStyle = '#bb6600';
    ctx.beginPath();
    ctx.ellipse(0, 4, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dd8800';
    ctx.beginPath();
    ctx.ellipse(0, 3, 13, 4, 0, 0, Math.PI);
    ctx.fill();

    // Hat body (tapered top hat shape)
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(-6, -9);
    ctx.lineTo(6, -9);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();

    // Hat top (flat crown)
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.ellipse(0, -9, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left shade (depth)
    ctx.fillStyle = 'rgba(150, 80, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-3, -9);
    ctx.lineTo(-5, 3);
    ctx.closePath();
    ctx.fill();

    // Band with buckle
    ctx.fillStyle = '#993300';
    ctx.fillRect(-8, -1, 16, 3);
    // Buckle
    ctx.strokeStyle = '#ffdd44';
    ctx.lineWidth = 1;
    ctx.strokeRect(-2, -2, 4, 4);
    ctx.fillStyle = '#ffee88';
    ctx.fillRect(-0.5, -1, 1, 2);

    // Top highlight (shine)
    ctx.fillStyle = 'rgba(255, 255, 200, 0.35)';
    ctx.beginPath();
    ctx.ellipse(2, -6, 3, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHUD(ctx: CanvasRenderingContext2D, progress: number) {
    // === LEFT PANEL (health, score, collectibles) ===
    // Panel background with rounded corners
    ctx.fillStyle = 'rgba(0, 10, 15, 0.65)';
    ctx.beginPath();
    ctx.roundRect(6, 8, 196, 96, [0, 8, 8, 0]);
    ctx.fill();
    // Panel border glow
    ctx.strokeStyle = `rgba(0, 200, 150, ${0.25 + Math.sin(animTime * 2) * 0.05})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(6, 8, 196, 96, [0, 8, 8, 0]);
    ctx.stroke();
    // Left accent bar
    const accentGrad = ctx.createLinearGradient(6, 8, 6, 104);
    accentGrad.addColorStop(0, 'rgba(0, 255, 180, 0.6)');
    accentGrad.addColorStop(0.5, 'rgba(0, 255, 150, 0.3)');
    accentGrad.addColorStop(1, 'rgba(0, 200, 130, 0.1)');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(6, 8, 2, 96);

    // === ENERGY PIPS (health) ===
    const pipX = 14, pipY = 14, pipW = 28, pipH = 14, pipGap = 3;
    ctx.fillStyle = 'rgba(200, 255, 220, 0.6)';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('ENERGY', pipX, pipY + 1);
    for (let i = 0; i < MAX_HEALTH; i++) {
      const px = pipX + i * (pipW + pipGap);
      const py = pipY + 5;
      // Pip background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(px, py, pipW, pipH, 2);
      ctx.fill();
      if (i < health) {
        // Filled pip with gradient
        const pipGrad = ctx.createLinearGradient(px, py, px, py + pipH);
        if (health > 2) {
          pipGrad.addColorStop(0, '#00ff88');
          pipGrad.addColorStop(0.5, '#00cc55');
          pipGrad.addColorStop(1, '#009944');
        } else if (health > 1) {
          pipGrad.addColorStop(0, '#ffdd22');
          pipGrad.addColorStop(0.5, '#ddaa00');
          pipGrad.addColorStop(1, '#bb8800');
        } else {
          const rPulse = 0.7 + Math.sin(animTime * 8) * 0.3;
          pipGrad.addColorStop(0, `rgba(255, 80, 60, ${rPulse})`);
          pipGrad.addColorStop(1, `rgba(180, 20, 10, ${rPulse})`);
        }
        ctx.fillStyle = pipGrad;
        ctx.beginPath();
        ctx.roundRect(px + 1, py + 1, pipW - 2, pipH - 2, 1.5);
        ctx.fill();
        // Shine highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.roundRect(px + 2, py + 1, pipW - 4, (pipH - 2) / 2, [1.5, 1.5, 0, 0]);
        ctx.fill();
      } else {
        // Empty pip indicator
        ctx.strokeStyle = 'rgba(60, 60, 80, 0.6)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(px, py, pipW, pipH, 2);
        ctx.stroke();
      }
    }

    // Score (large, prominent)
    ctx.fillStyle = '#00ffaa';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${score}`, 14, 52);
    ctx.fillStyle = 'rgba(150, 200, 180, 0.5)';
    ctx.font = '8px monospace';
    ctx.fillText('SCORE', 14, 61);

    // Hats & SIGs row (with mini icons)
    // Hat icon
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(14, 68, 10, 2);
    ctx.fillRect(16, 64, 6, 5);
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(17, 64, 4, 2);
    ctx.fillStyle = '#ffaa00';
    ctx.font = '11px monospace';
    ctx.fillText(`${hatsCollected}`, 28, 72);
    // SIG icon
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(64, 68, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(`${sigsCollected}`, 73, 72);

    // Invincibility indicator
    if (invincibleTimer > 0) {
      const invPulse = 0.7 + Math.sin(animTime * 8) * 0.3;
      // Glowing bar
      ctx.fillStyle = `rgba(255, 200, 0, ${invPulse * 0.15})`;
      ctx.beginPath();
      ctx.roundRect(12, 78, 180, 14, 3);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 220, 50, ${invPulse})`;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`\u26A1 INVINCIBLE ${invincibleTimer.toFixed(1)}s`, 16, 89);
      // Timer bar
      const invFrac = invincibleTimer / INVINCIBLE_DURATION;
      ctx.fillStyle = `rgba(255, 200, 0, ${invPulse * 0.4})`;
      ctx.beginPath();
      ctx.roundRect(12, 93, 180 * invFrac, 2, 1);
      ctx.fill();
    }

    // === RIGHT PANEL (progress, speed) ===
    ctx.fillStyle = 'rgba(0, 10, 15, 0.55)';
    ctx.beginPath();
    ctx.roundRect(WIDTH - 198, 8, 192, 44, [8, 0, 0, 8]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 200, 150, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(WIDTH - 198, 8, 192, 44, [8, 0, 0, 8]);
    ctx.stroke();
    // Right accent
    ctx.fillStyle = 'rgba(0, 255, 180, 0.4)';
    ctx.fillRect(WIDTH - 8, 8, 2, 44);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${Math.floor(progress * 100)}% \u2192 BEACON`, WIDTH - 14, 28);
    // Speed indicator with bar
    const speedFrac2 = (scrollSpeed - BASE_SCROLL_SPEED) / (MAX_SCROLL_SPEED - BASE_SCROLL_SPEED);
    ctx.fillStyle = 'rgba(100, 100, 120, 0.4)';
    ctx.beginPath();
    ctx.roundRect(WIDTH - 190, 36, 120, 6, 3);
    ctx.fill();
    const speedGrad = ctx.createLinearGradient(WIDTH - 190, 0, WIDTH - 70, 0);
    speedGrad.addColorStop(0, '#0088ff');
    speedGrad.addColorStop(1, speedFrac2 > 0.7 ? '#ff6644' : '#00ccff');
    ctx.fillStyle = speedGrad;
    ctx.beginPath();
    ctx.roundRect(WIDTH - 190, 36, 120 * speedFrac2, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText(`SPD ${Math.floor(scrollSpeed)}`, WIDTH - 14, 44);
    ctx.textAlign = 'left';

    // Controls hint (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '9px monospace';
    ctx.fillText('UP/W/SPACE: thrust \u2022 Q/ESC: quit', 10, HEIGHT - 8);
  }

  // === GAME LOOP ===
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    update(dt);
    draw();

    frameId = requestAnimationFrame(frame);
  };

  frameId = requestAnimationFrame(frame);

  // Return cleanup function
  return () => {
    running = false;
    cancelAnimationFrame(frameId);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
