// Level 2: Static Fields Runner
// Geometry Dash / Flappy Bird inspired auto-scrolling level
// Player uses thrust to dodge obstacles, collects hats for invincibility

import { initAudio, startBGM, sfxCollectSig, sfxMenuSelect, sfxStaticHit, sfxInvincible, sfxRunnerWin, sfxThrust } from './audio';
import { addToL2Leaderboard, isL2HighScore } from './leaderboard';

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
  let thrustSfxCooldown = 0;

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
  let animTime = 0;

  // Damage feedback
  let screenFlash = 0; // 0-1, decays quickly after hit
  let screenShake = 0; // pixels offset, decays

  // Particles
  let particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];

  // Input
  const keys: Record<string, boolean> = {};
  const onKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
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
      if (keys[' '] || keys.enter) {
        keys[' '] = false;
        keys.enter = false;
        sfxMenuSelect();
        dialogPage++;
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
      if (gameOverTimer > 1.5 && (keys[' '] || keys.enter)) {
        keys[' '] = false;
        keys.enter = false;
        if (won) {
          onComplete();
        } else {
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
      if (isL2HighScore(score)) {
        addToL2Leaderboard('Runner', score);
      }
      sfxRunnerWin();
      return;
    }

    // Thrust physics
    thrusting = !!(keys.arrowup || keys.w || keys[' ']);
    if (thrusting) {
      playerVY += THRUST_FORCE * dt;
      // Play thrust sound on start or periodically
      if (!wasThrusting || thrustSfxCooldown <= 0) {
        sfxThrust();
        thrustSfxCooldown = 0.12;
      }
    } else {
      playerVY += GRAVITY * dt;
    }
    wasThrusting = thrusting;
    if (thrustSfxCooldown > 0) thrustSfxCooldown -= dt;
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
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, HEIGHT);
    floorGrad.addColorStop(0, `rgba(200, 60, 40, ${0.12 + progress * 0.06})`);
    floorGrad.addColorStop(0.4, `rgba(150, 30, 30, ${0.08})`);
    floorGrad.addColorStop(1, 'rgba(60, 0, 0, 0.04)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, WIDTH, HEIGHT - floorY);
    // Grid lines on floor (red/orange warning)
    ctx.strokeStyle = `rgba(255, 80, 60, ${0.12 + Math.sin(animTime * 2) * 0.04})`;
    ctx.lineWidth = 1;
    const gridOffset = (distance * 0.5) % 40;
    for (let gx = -gridOffset; gx < WIDTH + 40; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, floorY);
      ctx.lineTo(gx - 10, HEIGHT);
      ctx.stroke();
    }
    // Horizontal floor line (danger indicator)
    ctx.strokeStyle = `rgba(255, 60, 40, ${0.35 + Math.sin(animTime * 4) * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(WIDTH, floorY);
    ctx.stroke();
    // Warning chevrons
    ctx.fillStyle = `rgba(255, 80, 40, ${0.08 + Math.sin(animTime * 3) * 0.03})`;
    const chevOffset = (distance * 0.8) % 60;
    for (let cx = -chevOffset; cx < WIDTH + 60; cx += 60) {
      ctx.beginPath();
      ctx.moveTo(cx, floorY + 4);
      ctx.lineTo(cx + 15, floorY + 14);
      ctx.lineTo(cx + 30, floorY + 4);
      ctx.lineTo(cx + 25, floorY + 4);
      ctx.lineTo(cx + 15, floorY + 10);
      ctx.lineTo(cx + 5, floorY + 4);
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

    // === PROGRESS BAR (stylized) ===
    const barY = 4;
    const barH = 3;
    ctx.fillStyle = 'rgba(0, 255, 150, 0.08)';
    ctx.fillRect(0, barY, WIDTH, barH);
    const progGrad = ctx.createLinearGradient(0, barY, WIDTH * progress, barY);
    progGrad.addColorStop(0, 'rgba(0, 255, 150, 0.4)');
    progGrad.addColorStop(1, '#00ff88');
    ctx.fillStyle = progGrad;
    ctx.fillRect(0, barY, WIDTH * progress, barH);
    // Beacon indicator at end
    ctx.fillStyle = `rgba(0, 255, 150, ${0.4 + Math.sin(animTime * 4) * 0.2})`;
    ctx.fillRect(WIDTH - 6, barY - 1, 6, barH + 2);

    // Dialog overlay
    if (dialogActive) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.globalAlpha = dialogAlpha;
      ctx.textAlign = 'center';

      const page = jamesDialog[dialogPage];

      // Speaker
      ctx.fillStyle = page.speaker === 'James' ? '#ffaa00' : '#00ccff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(page.speaker, WIDTH / 2, 160);

      // Draw James (simple character)
      if (page.speaker === 'James') {
        drawJames(ctx, WIDTH / 2 - 20, 60);
      } else {
        drawSonia(ctx, WIDTH / 2 - 18, 60);
      }

      // Lines
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '14px monospace';
      page.lines.forEach((line, i) => {
        ctx.fillText(line, WIDTH / 2, 200 + i * 28);
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
      const trailCount = thrusting ? 5 : 3;
      for (let t = 1; t <= trailCount; t++) {
        const alpha = (1 - t / (trailCount + 1)) * 0.15;
        const trailX = PLAYER_X - t * (scrollSpeed * 0.008);
        const trailY = playerY + t * (playerVY * 0.006);
        ctx.fillStyle = invincibleTimer > 0
          ? `rgba(255, 200, 0, ${alpha})`
          : `rgba(0, 180, 255, ${alpha})`;
        ctx.fillRect(trailX + 4, trailY + 18, 28, 26);
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

    // === THRUST EXHAUST (multi-layered) ===
    if (thrusting) {
      // Core flame
      for (let i = 0; i < 8; i++) {
        const tx = PLAYER_X - 2 - Math.random() * 20;
        const ty = playerY + playerH - 2 + (Math.random() - 0.5) * 8;
        const size = 2 + Math.random() * 4;
        const alpha = 0.4 + Math.random() * 0.3;
        ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
        ctx.fillRect(tx, ty, size, size * 0.6);
      }
      // Outer glow
      const glowGrad = ctx.createRadialGradient(
        PLAYER_X - 8, playerY + playerH + 2, 0,
        PLAYER_X - 8, playerY + playerH + 2, 18
      );
      glowGrad.addColorStop(0, 'rgba(0, 180, 255, 0.2)');
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(PLAYER_X - 8, playerY + playerH + 2, 18, 0, Math.PI * 2);
      ctx.fill();
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

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2.5);
      ctx.fillStyle = p.color;
      const pSize = 2 + p.life * 3;
      ctx.fillRect(p.x - pSize / 2, p.y - pSize / 2, pSize, pSize);
    }
    ctx.globalAlpha = 1;

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

    // === CLARITY BEACON (destination visual) ===
    if (progress > 0.7) {
      const beaconIntensity = (progress - 0.7) / 0.3; // 0→1 from 70% to 100%
      const beaconX = WIDTH - 40 + (1 - beaconIntensity) * 60; // slides in from right
      const beaconY = HEIGHT / 2 - 20;
      const beaconSize = 20 + beaconIntensity * 40;
      const beaconPulse = 0.6 + Math.sin(animTime * 3) * 0.4;

      // Outer glow
      const bGrad = ctx.createRadialGradient(beaconX, beaconY, 0, beaconX, beaconY, beaconSize * 2);
      bGrad.addColorStop(0, `rgba(0, 255, 200, ${beaconIntensity * beaconPulse * 0.3})`);
      bGrad.addColorStop(0.5, `rgba(0, 200, 255, ${beaconIntensity * beaconPulse * 0.15})`);
      bGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bGrad;
      ctx.fillRect(beaconX - beaconSize * 2, beaconY - beaconSize * 2, beaconSize * 4, beaconSize * 4);

      // Core beacon
      ctx.beginPath();
      ctx.arc(beaconX, beaconY, beaconSize * 0.3 * beaconPulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 255, 240, ${beaconIntensity * 0.9})`;
      ctx.fill();

      // Inner bright point
      ctx.beginPath();
      ctx.arc(beaconX, beaconY, beaconSize * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${beaconIntensity})`;
      ctx.fill();

      // Rays
      ctx.strokeStyle = `rgba(0, 255, 200, ${beaconIntensity * beaconPulse * 0.5})`;
      ctx.lineWidth = 1;
      for (let r = 0; r < 6; r++) {
        const angle = (r / 6) * Math.PI * 2 + animTime * 0.5;
        ctx.beginPath();
        ctx.moveTo(beaconX + Math.cos(angle) * beaconSize * 0.4, beaconY + Math.sin(angle) * beaconSize * 0.4);
        ctx.lineTo(beaconX + Math.cos(angle) * beaconSize * 1.2, beaconY + Math.sin(angle) * beaconSize * 1.2);
        ctx.stroke();
      }

      // Label (when close enough)
      if (progress > 0.85) {
        ctx.fillStyle = `rgba(200, 255, 240, ${beaconIntensity * beaconPulse})`;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CLARITY BEACON', beaconX, beaconY + beaconSize + 16);
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Static noise
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#ff3333' : '#220000';
        ctx.fillRect(Math.random() * WIDTH, Math.random() * HEIGHT, Math.random() * 6 + 1, 2);
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('SIGNAL LOST', WIDTH / 2, HEIGHT / 2 - 40);
      ctx.fillStyle = '#ccc';
      ctx.font = '14px monospace';
      ctx.fillText(`Score: ${score}  |  Hats: ${hatsCollected}  |  SIGs: ${sigsCollected}`, WIDTH / 2, HEIGHT / 2 + 10);
      ctx.fillStyle = '#888';
      ctx.font = '12px monospace';
      ctx.fillText(`Distance: ${Math.floor(progress * 100)}%`, WIDTH / 2, HEIGHT / 2 + 40);
      if (gameOverTimer > 1.5) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText('SPACE to retry  |  Q to quit', WIDTH / 2, HEIGHT / 2 + 80);
      }
      ctx.textAlign = 'left';
    }

    // Win overlay
    if (won) {
      ctx.fillStyle = 'rgba(0, 20, 10, 0.85)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('CLARITY BEACON REACHED!', WIDTH / 2, HEIGHT / 2 - 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.fillText('The Static Fields are cleansed!', WIDTH / 2, HEIGHT / 2 - 20);
      ctx.fillStyle = '#ccc';
      ctx.font = '14px monospace';
      ctx.fillText(`Final Score: ${score}  |  Hats: ${hatsCollected}  |  SIGs: ${sigsCollected}`, WIDTH / 2, HEIGHT / 2 + 20);
      ctx.fillText(`Static destroyed: ${destroyedCount} (+${destroyedCount * DESTROY_POINTS} pts)`, WIDTH / 2, HEIGHT / 2 + 50);
      if (gameOverTimer > 1.5) {
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px monospace';
        ctx.fillText('SPACE to continue  |  Q to quit', WIDTH / 2, HEIGHT / 2 + 100);
      }
      ctx.textAlign = 'left';
    }
  };

  // === DRAW HELPERS ===
  function drawJames(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Body (jacket)
    ctx.fillStyle = '#1a3a5a';
    ctx.fillRect(x + 8, y + 26, 24, 28);
    ctx.fillStyle = '#2a5a8a';
    ctx.fillRect(x + 10, y + 28, 20, 24);
    // Collar
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 16, y + 26, 8, 4);
    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(x + 10, y + 10, 20, 16);
    // Hair
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(x + 9, y + 7, 22, 7);
    ctx.fillRect(x + 10, y + 5, 18, 4);
    // Hat stack! (he wears many)
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(x + 6, y + 1, 28, 6);
    ctx.fillRect(x + 10, y - 5, 20, 7);
    ctx.fillStyle = '#cc6600';
    ctx.fillRect(x + 12, y - 3, 16, 2);
    // Second hat on top
    ctx.fillStyle = '#44aa44';
    ctx.fillRect(x + 8, y - 9, 24, 5);
    ctx.fillRect(x + 12, y - 14, 16, 6);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 14, y + 16, 4, 4);
    ctx.fillRect(x + 22, y + 16, 4, 4);
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 15, y + 17, 2, 2);
    ctx.fillRect(x + 23, y + 17, 2, 2);
    // Smile
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 16, y + 22, 8, 2);
    ctx.fillRect(x + 15, y + 21, 2, 2);
    ctx.fillRect(x + 23, y + 21, 2, 2);
    // Swiss army knife in hand
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(x + 32, y + 32, 6, 14);
    ctx.fillStyle = '#eee';
    ctx.fillRect(x + 33, y + 30, 4, 3);
    ctx.fillRect(x + 38, y + 36, 4, 2);
  }

  function drawSonia(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Body (flight suit)
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(x + 8, y + 24, 20, 26);
    ctx.fillStyle = '#2a2a5a';
    ctx.fillRect(x + 10, y + 26, 16, 22);
    // Accent stripe
    ctx.fillStyle = '#00ccaa';
    ctx.fillRect(x + 10, y + 26, 2, 22);
    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(x + 10, y + 10, 16, 14);
    // Hair (purple, slightly wild)
    ctx.fillStyle = '#7a4a9a';
    ctx.fillRect(x + 8, y + 4, 20, 10);
    ctx.fillRect(x + 6, y + 8, 4, 8);
    ctx.fillRect(x + 26, y + 8, 4, 6);
    // Goggles
    ctx.fillStyle = '#00ccaa';
    ctx.fillRect(x + 10, y + 14, 7, 5);
    ctx.fillRect(x + 19, y + 14, 7, 5);
    ctx.fillStyle = '#aaffee';
    ctx.fillRect(x + 12, y + 15, 3, 3);
    ctx.fillRect(x + 21, y + 15, 3, 3);
  }

  function drawPlayerRunner(ctx: CanvasRenderingContext2D, x: number, y: number, boosting: boolean, invincible: boolean) {
    const tilt = boosting ? -0.2 : 0.1;
    ctx.save();
    ctx.translate(x + playerW / 2, y + playerH / 2);
    ctx.rotate(tilt);
    ctx.translate(-(x + playerW / 2), -(y + playerH / 2));

    // Jetpack (more detailed)
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(x - 6, y + 8, 10, 28);
    ctx.fillStyle = '#5a5a7a';
    ctx.fillRect(x - 5, y + 9, 8, 3);
    ctx.fillRect(x - 5, y + 32, 8, 3);
    // Jetpack nozzle
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(x - 4, y + 36, 6, 4);
    // Jetpack glow when boosting
    if (boosting) {
      ctx.fillStyle = `rgba(0, 200, 255, ${0.6 + Math.sin(animTime * 25) * 0.3})`;
      ctx.fillRect(x - 3, y + 40, 4, 3 + Math.sin(animTime * 30) * 2);
      ctx.fillStyle = `rgba(100, 230, 255, ${0.4 + Math.sin(animTime * 20) * 0.2})`;
      ctx.fillRect(x - 2, y + 42, 2, 2 + Math.sin(animTime * 35) * 1.5);
    }

    // Body (flight suit)
    const bodyColor = invincible ? '#aa8800' : '#1a1a3a';
    const suitColor = invincible ? '#ffcc22' : '#2a2a5a';
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x + 4, y + 18, 28, 26);
    ctx.fillStyle = suitColor;
    ctx.fillRect(x + 6, y + 20, 24, 22);
    // Suit accent
    ctx.fillStyle = invincible ? '#ffee88' : '#00ccaa';
    ctx.fillRect(x + 6, y + 20, 2, 22);
    ctx.fillRect(x + 28, y + 20, 2, 22);
    // Belt
    ctx.fillStyle = invincible ? '#ffdd00' : '#444';
    ctx.fillRect(x + 6, y + 32, 24, 3);
    ctx.fillStyle = invincible ? '#fff' : '#888';
    ctx.fillRect(x + 16, y + 31, 4, 5);

    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(x + 8, y + 4, 20, 16);
    // Hair (purple)
    ctx.fillStyle = invincible ? '#dda0ff' : '#7a4a9a';
    ctx.fillRect(x + 6, y, 24, 8);
    ctx.fillRect(x + 4, y + 4, 5, 8);
    ctx.fillRect(x + 27, y + 4, 5, 6);
    // Goggles
    ctx.fillStyle = invincible ? '#ffdd00' : '#00ccaa';
    ctx.fillRect(x + 8, y + 10, 9, 6);
    ctx.fillRect(x + 19, y + 10, 9, 6);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 17, y + 10, 2, 6);
    // Goggle shine
    ctx.fillStyle = invincible ? '#fff' : '#aaffee';
    ctx.fillRect(x + 10, y + 12, 4, 3);
    ctx.fillRect(x + 21, y + 12, 4, 3);
    // Mouth (determined expression)
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 14, y + 18, 8, 1);

    // Arms
    ctx.fillStyle = suitColor;
    ctx.fillRect(x + 30, y + 22, 6, 14);
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(x + 30, y + 34, 6, 4);

    ctx.restore();
  }

  function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    const pulse = 0.7 + Math.sin(animTime * 5 + obs.x * 0.03) * 0.3;
    const glowAlpha = pulse * 0.4;

    switch (obs.type) {
      case 'static-block': {
        // Outer glow
        ctx.shadowColor = `rgba(255, 60, 80, ${glowAlpha})`;
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(140, 20, 40, ${pulse * 0.9})`;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.shadowBlur = 0;
        // Inner gradient
        const blockGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
        blockGrad.addColorStop(0, `rgba(220, 60, 80, ${pulse * 0.6})`);
        blockGrad.addColorStop(0.5, `rgba(160, 30, 50, ${pulse * 0.8})`);
        blockGrad.addColorStop(1, `rgba(100, 10, 30, ${pulse * 0.9})`);
        ctx.fillStyle = blockGrad;
        ctx.fillRect(obs.x + 2, obs.y + 2, obs.w - 4, obs.h - 4);
        // Noise texture (animated)
        ctx.fillStyle = `rgba(255, 100, 100, ${pulse * 0.4})`;
        for (let i = 0; i < 10; i++) {
          const nx = obs.x + ((i * 37 + Math.floor(animTime * 8) * 7) % Math.max(1, obs.w - 4));
          const ny = obs.y + ((i * 23 + Math.floor(animTime * 5) * 11) % Math.max(1, obs.h - 4));
          ctx.fillRect(nx, ny, 3, 3);
        }
        // Border highlight
        ctx.strokeStyle = `rgba(255, 80, 100, ${pulse * 0.6})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        break;
      }
      case 'static-wave': {
        // Glow area
        ctx.fillStyle = `rgba(180, 40, 200, ${pulse * 0.08})`;
        ctx.fillRect(obs.x - 4, obs.y - 4, obs.w + 8, obs.h + 8);
        // Main wave
        ctx.strokeStyle = `rgba(220, 80, 240, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `rgba(200, 60, 220, ${glowAlpha})`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let wx = 0; wx < obs.w; wx += 3) {
          const wy = obs.y + obs.h / 2 + Math.sin((wx + animTime * 180) * 0.1) * (obs.h / 2.5);
          if (wx === 0) ctx.moveTo(obs.x + wx, wy);
          else ctx.lineTo(obs.x + wx, wy);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Secondary wave (fainter)
        ctx.strokeStyle = `rgba(160, 40, 180, ${pulse * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let wx = 0; wx < obs.w; wx += 3) {
          const wy = obs.y + obs.h / 2 + Math.sin((wx + animTime * 220 + 30) * 0.12) * (obs.h / 3);
          if (wx === 0) ctx.moveTo(obs.x + wx, wy);
          else ctx.lineTo(obs.x + wx, wy);
        }
        ctx.stroke();
        // Fill area
        ctx.fillStyle = `rgba(180, 40, 200, ${pulse * 0.1})`;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        break;
      }
      case 'static-pillar': {
        // Pillar glow
        ctx.shadowColor = `rgba(100, 100, 255, ${glowAlpha})`;
        ctx.shadowBlur = 10;
        // Main pillar body (gradient)
        const pillarGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y);
        pillarGrad.addColorStop(0, `rgba(60, 60, 160, ${pulse * 0.8})`);
        pillarGrad.addColorStop(0.5, `rgba(90, 90, 200, ${pulse * 0.9})`);
        pillarGrad.addColorStop(1, `rgba(60, 60, 160, ${pulse * 0.8})`);
        ctx.fillStyle = pillarGrad;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.shadowBlur = 0;
        // Electricity bolts (deterministic from position)
        ctx.strokeStyle = `rgba(180, 180, 255, ${pulse * 0.8})`;
        ctx.lineWidth = 1.5;
        const boltSeed = Math.floor(animTime * 6) * 31;
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          const startY2 = obs.y + ((boltSeed + j * 137) % Math.max(1, obs.h - 10)) + 5;
          ctx.moveTo(obs.x, startY2);
          let bx = obs.x;
          for (let seg = 0; seg < 3; seg++) {
            bx += obs.w / 3;
            const by = startY2 + ((boltSeed + j * 53 + seg * 17) % 20) - 10;
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
        }
        // Edge highlight
        ctx.fillStyle = `rgba(150, 150, 255, ${pulse * 0.4})`;
        ctx.fillRect(obs.x, obs.y, 2, obs.h);
        ctx.fillRect(obs.x + obs.w - 2, obs.y, 2, obs.h);
        // Top/bottom caps
        ctx.fillStyle = `rgba(120, 120, 220, ${pulse * 0.6})`;
        if (obs.y > 0) ctx.fillRect(obs.x - 2, obs.y, obs.w + 4, 4);
        if (obs.y + obs.h < HEIGHT) ctx.fillRect(obs.x - 2, obs.y + obs.h - 4, obs.w + 4, 4);
        break;
      }
    }
  }

  function drawSigRunner(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bob = Math.sin(animTime * 3 + x * 0.01) * 3;
    const cx2 = x + 12;
    const cy = y + 12 + bob;
    // Outer glow
    const sigGlow = ctx.createRadialGradient(cx2, cy, 0, cx2, cy, 16);
    sigGlow.addColorStop(0, `rgba(0, 255, 100, ${0.15 + Math.sin(animTime * 4) * 0.05})`);
    sigGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = sigGlow;
    ctx.beginPath();
    ctx.arc(cx2, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    // Core circle
    ctx.fillStyle = `rgba(0, 40, 20, 0.7)`;
    ctx.beginPath();
    ctx.arc(cx2, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    // Ring
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx2, cy, 10, 0, Math.PI * 2);
    ctx.stroke();
    // Sound wave arcs
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1.5;
    for (let w = 0; w < 3; w++) {
      const arcAlpha = 0.8 - w * 0.2;
      ctx.strokeStyle = `rgba(0, 255, 100, ${arcAlpha})`;
      ctx.beginPath();
      ctx.arc(cx2, cy, 4 + w * 3, -0.6, 0.6);
      ctx.stroke();
    }
    // Center dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx2, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHat(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bob = Math.sin(animTime * 2.5 + x * 0.02) * 3;
    const hx = x + 12;
    const hy = y + 12 + bob;
    // Golden radial glow
    const hatGlow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 22);
    hatGlow.addColorStop(0, `rgba(255, 200, 0, ${0.2 + Math.sin(animTime * 5) * 0.08})`);
    hatGlow.addColorStop(0.5, `rgba(255, 150, 0, ${0.1})`);
    hatGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = hatGlow;
    ctx.beginPath();
    ctx.arc(hx, hy, 22, 0, Math.PI * 2);
    ctx.fill();
    // Spinning sparkle ring
    for (let s = 0; s < 3; s++) {
      const angle = animTime * 3 + s * (Math.PI * 2 / 3);
      const sparkX = hx + Math.cos(angle) * 14;
      const sparkY = hy + Math.sin(angle) * 14;
      ctx.fillStyle = `rgba(255, 255, 200, ${0.5 + Math.sin(animTime * 6 + s) * 0.3})`;
      ctx.fillRect(sparkX - 1.5, sparkY - 1.5, 3, 3);
    }
    // Hat brim
    ctx.fillStyle = '#dd7700';
    ctx.fillRect(hx - 12, hy + 4, 24, 5);
    // Hat body
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(hx - 8, hy - 8, 16, 13);
    // Hat top highlight
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(hx - 6, hy - 7, 12, 4);
    // Band
    ctx.fillStyle = '#cc6600';
    ctx.fillRect(hx - 8, hy + 1, 16, 3);
    // Star badge
    ctx.fillStyle = '#fff';
    ctx.fillRect(hx - 2, hy - 4, 4, 4);
    ctx.fillRect(hx - 1, hy - 5, 2, 6);
    ctx.fillRect(hx - 3, hy - 3, 6, 2);
  }

  function drawHUD(ctx: CanvasRenderingContext2D, progress: number) {
    // Semi-transparent HUD background strip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 4, 200, 100);
    // Border accent
    ctx.fillStyle = 'rgba(0, 255, 150, 0.15)';
    ctx.fillRect(0, 4, 2, 100);

    // === ENERGY PIPS (health) ===
    const pipX = 12, pipY = 12, pipW = 28, pipH = 18, pipGap = 4;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('ENERGY', pipX, pipY + 1);
    for (let i = 0; i < MAX_HEALTH; i++) {
      const px = pipX + i * (pipW + pipGap);
      const py = pipY + 6;
      // Pip background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(px, py, pipW, pipH);
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
      ctx.strokeRect(px, py, pipW, pipH);
      if (i < health) {
        // Filled pip with gradient
        const pipGrad = ctx.createLinearGradient(px, py, px, py + pipH);
        if (health > 2) {
          pipGrad.addColorStop(0, '#00ff66');
          pipGrad.addColorStop(1, '#00aa44');
        } else if (health > 1) {
          pipGrad.addColorStop(0, '#ffcc00');
          pipGrad.addColorStop(1, '#cc8800');
        } else {
          // Last pip - pulsing red
          const rPulse = 0.7 + Math.sin(animTime * 8) * 0.3;
          pipGrad.addColorStop(0, `rgba(255, 60, 60, ${rPulse})`);
          pipGrad.addColorStop(1, `rgba(200, 0, 0, ${rPulse})`);
        }
        ctx.fillStyle = pipGrad;
        ctx.fillRect(px + 1, py + 1, pipW - 2, pipH - 2);
        // Pip shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(px + 1, py + 1, pipW - 2, (pipH - 2) / 2);
      }
    }

    // Score
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`${score}`, 12, 56);
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText('SCORE', 12, 66);

    // Hats & SIGs row
    ctx.fillStyle = '#ffaa00';
    ctx.font = '11px monospace';
    ctx.fillText(`\u{1F3A9} ${hatsCollected}`, 12, 84);
    ctx.fillStyle = '#00ff66';
    ctx.fillText(`SIG ${sigsCollected}`, 70, 84);

    // Invincibility indicator
    if (invincibleTimer > 0) {
      const invPulse = 0.7 + Math.sin(animTime * 8) * 0.3;
      ctx.fillStyle = `rgba(255, 200, 0, ${invPulse})`;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`\u26A1 INVINCIBLE ${invincibleTimer.toFixed(1)}s`, 12, 98);
    }

    // Right side: distance & speed
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(WIDTH - 180, 8, 180, 40);
    ctx.fillStyle = '#00ffaa';
    ctx.font = '12px monospace';
    ctx.fillText(`${Math.floor(progress * 100)}% \u2192 Clarity Beacon`, WIDTH - 12, 24);
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText(`SPEED ${Math.floor(scrollSpeed)}`, WIDTH - 12, 40);
    ctx.textAlign = 'left';

    // Controls hint (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
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
