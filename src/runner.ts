// Level 2: Static Fields Runner
// Geometry Dash / Flappy Bird inspired auto-scrolling level
// Player uses thrust to dodge obstacles, collects hats for invincibility

import { initAudio, startBGM, sfxCollectSig, sfxMenuSelect, sfxStaticHit, sfxInvincible, sfxRunnerWin } from './audio';
import { addToLeaderboard, isHighScore } from './leaderboard';

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
      if (isHighScore(score)) {
        addToLeaderboard('Runner', score);
      }
      sfxRunnerWin();
      return;
    }

    // Thrust physics
    thrusting = !!(keys.arrowup || keys.w || keys[' ']);
    if (thrusting) {
      playerVY += THRUST_FORCE * dt;
    } else {
      playerVY += GRAVITY * dt;
    }
    playerVY = Math.max(-MAX_VY, Math.min(MAX_VY, playerVY));
    playerY += playerVY * dt;

    // Clamp to screen
    if (playerY < 0) { playerY = 0; playerVY = 0; }
    if (playerY + playerH > HEIGHT) { playerY = HEIGHT - playerH; playerVY = 0; }

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
          sfxStaticHit();
          // Flash particles
          for (let p = 0; p < 4; p++) {
            particles.push({
              x: PLAYER_X + playerW / 2,
              y: playerY + playerH / 2,
              vx: (Math.random() - 0.5) * 150,
              vy: (Math.random() - 0.5) * 150,
              life: 0.4,
              color: '#ff0000',
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
  };

  // === DRAW ===
  const draw = () => {
    const ctx = ctx2!;
    const progress = Math.min(distance / totalDistance, 1);

    // Background - dark with scrolling noise pattern
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Scrolling background lines (static field effect)
    ctx.strokeStyle = `rgba(80, 40, 100, ${0.15 + progress * 0.1})`;
    ctx.lineWidth = 1;
    const lineOffset = (distance * 0.3) % 60;
    for (let x = -lineOffset; x < WIDTH + 60; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 30, HEIGHT);
      ctx.stroke();
    }

    // Horizontal scan lines
    ctx.fillStyle = `rgba(100, 50, 120, ${0.04 + progress * 0.03})`;
    for (let y = 0; y < HEIGHT; y += 4) {
      ctx.fillRect(0, y, WIDTH, 1);
    }

    // Progress bar (top)
    ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
    ctx.fillRect(0, 0, WIDTH * progress, 3);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(WIDTH * progress - 2, 0, 4, 3);

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

    // Thrust trail
    if (thrusting) {
      ctx.fillStyle = `rgba(0, 200, 255, ${0.3 + Math.sin(animTime * 20) * 0.15})`;
      for (let i = 0; i < 5; i++) {
        const tx = PLAYER_X - 5 - Math.random() * 15;
        const ty = playerY + playerH - 5 + (Math.random() - 0.5) * 10;
        ctx.fillRect(tx, ty, 3 + Math.random() * 4, 2 + Math.random() * 3);
      }
    }

    // Invincibility shield
    if (invincibleTimer > 0) {
      const shimmer = 0.3 + Math.sin(animTime * 8) * 0.15;
      ctx.strokeStyle = `rgba(255, 200, 0, ${shimmer})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(PLAYER_X + playerW / 2, playerY + playerH / 2, playerW * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 200, 0, ${shimmer * 0.2})`;
      ctx.fill();
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life * 2;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // HUD
    drawHUD(ctx, progress);

    // Game over overlay
    if (gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
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
    // Body
    ctx.fillStyle = '#2a4a6a';
    ctx.fillRect(x + 8, y + 24, 24, 30);
    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(x + 10, y + 10, 20, 16);
    // Hair
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(x + 10, y + 8, 20, 6);
    // Hat (he wears many!)
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(x + 6, y + 2, 28, 8);
    ctx.fillRect(x + 12, y - 4, 16, 8);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 14, y + 16, 4, 4);
    ctx.fillRect(x + 22, y + 16, 4, 4);
    // Smile
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 16, y + 22, 8, 2);
    // Swiss army knife in hand
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(x + 32, y + 30, 6, 12);
    ctx.fillStyle = '#ccc';
    ctx.fillRect(x + 33, y + 28, 2, 4);
  }

  function drawSonia(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Simple Sonia at smaller scale
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(x + 8, y + 22, 20, 28);
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(x + 10, y + 10, 16, 14);
    ctx.fillStyle = '#6a4a8a';
    ctx.fillRect(x + 8, y + 4, 20, 10);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 13, y + 16, 3, 3);
    ctx.fillRect(x + 20, y + 16, 3, 3);
  }

  function drawPlayerRunner(ctx: CanvasRenderingContext2D, x: number, y: number, boosting: boolean, invincible: boolean) {
    // Sonia with jetpack
    const tilt = boosting ? -0.15 : 0.08;
    ctx.save();
    ctx.translate(x + playerW / 2, y + playerH / 2);
    ctx.rotate(tilt);
    ctx.translate(-(x + playerW / 2), -(y + playerH / 2));

    // Jetpack
    ctx.fillStyle = '#4a4a6a';
    ctx.fillRect(x - 4, y + 10, 8, 24);
    ctx.fillStyle = '#00aaff';
    if (boosting) {
      ctx.fillRect(x - 3, y + 34, 6, 4 + Math.sin(animTime * 30) * 2);
    }

    // Body
    ctx.fillStyle = invincible ? '#ffdd44' : '#2a2a4a';
    ctx.fillRect(x + 6, y + 18, 24, 26);
    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(x + 8, y + 4, 18, 16);
    // Hair
    ctx.fillStyle = '#6a4a8a';
    ctx.fillRect(x + 6, y, 22, 8);
    // Goggles
    ctx.fillStyle = invincible ? '#ffaa00' : '#00ccaa';
    ctx.fillRect(x + 8, y + 10, 8, 6);
    ctx.fillRect(x + 18, y + 10, 8, 6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 10, y + 12, 4, 3);
    ctx.fillRect(x + 20, y + 12, 4, 3);

    ctx.restore();
  }

  function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    const pulse = 0.7 + Math.sin(animTime * 5 + obs.x * 0.05) * 0.3;

    switch (obs.type) {
      case 'static-block':
        ctx.fillStyle = `rgba(180, 40, 60, ${pulse * 0.8})`;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        // Noise texture
        ctx.fillStyle = `rgba(255, 100, 100, ${pulse * 0.3})`;
        for (let i = 0; i < 6; i++) {
          const nx = obs.x + ((i * 37 + obs.x) % obs.w);
          const ny = obs.y + ((i * 23 + obs.y) % obs.h);
          ctx.fillRect(nx, ny, 4, 4);
        }
        break;
      case 'static-wave':
        ctx.strokeStyle = `rgba(200, 60, 200, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let wx = 0; wx < obs.w; wx += 4) {
          const wy = obs.y + obs.h / 2 + Math.sin((wx + animTime * 200) * 0.08) * (obs.h / 2.5);
          if (wx === 0) ctx.moveTo(obs.x + wx, wy);
          else ctx.lineTo(obs.x + wx, wy);
        }
        ctx.stroke();
        // Fill area
        ctx.fillStyle = `rgba(200, 60, 200, ${pulse * 0.15})`;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        break;
      case 'static-pillar':
        ctx.fillStyle = `rgba(100, 100, 200, ${pulse * 0.7})`;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        // Electricity effect
        ctx.strokeStyle = `rgba(150, 150, 255, ${pulse})`;
        ctx.lineWidth = 1;
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          const startY = obs.y + Math.random() * obs.h;
          ctx.moveTo(obs.x, startY);
          ctx.lineTo(obs.x + obs.w, startY + (Math.random() - 0.5) * 20);
          ctx.stroke();
        }
        break;
    }
  }

  function drawSigRunner(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bob = Math.sin(animTime * 3 + x * 0.01) * 2;
    const cy = y + 10 + bob;
    ctx.fillStyle = `rgba(0, 255, 0, ${0.2 + Math.sin(animTime * 4) * 0.05})`;
    ctx.beginPath();
    ctx.arc(x + 10, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    for (let w = 0; w < 3; w++) {
      ctx.beginPath();
      ctx.arc(x + 10, cy, 3 + w * 3, -0.5, 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8, cy - 2, 4, 4);
  }

  function drawHat(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bob = Math.sin(animTime * 2.5 + x * 0.02) * 3;
    const hy = y + bob;
    // Golden glow
    ctx.fillStyle = `rgba(255, 180, 0, ${0.2 + Math.sin(animTime * 5) * 0.1})`;
    ctx.beginPath();
    ctx.arc(x + 10, hy + 10, 14, 0, Math.PI * 2);
    ctx.fill();
    // Hat brim
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(x, hy + 12, 20, 5);
    // Hat top
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(x + 4, hy + 2, 12, 12);
    // Band
    ctx.fillStyle = '#cc6600';
    ctx.fillRect(x + 4, hy + 10, 12, 3);
    // Star
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8, hy + 5, 4, 4);
  }

  function drawHUD(ctx: CanvasRenderingContext2D, progress: number) {
    // Health
    ctx.fillStyle = '#333';
    ctx.fillRect(10, 10, 110, 16);
    ctx.fillStyle = health > 2 ? '#00cc44' : health > 1 ? '#ffaa00' : '#ff3333';
    ctx.fillRect(12, 12, (health / MAX_HEALTH) * 106, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.fillText(`HP: ${health}/${MAX_HEALTH}`, 14, 22);

    // Score
    ctx.fillStyle = '#00ff00';
    ctx.font = '13px monospace';
    ctx.fillText(`SCORE: ${score}`, 10, 44);

    // Hats collected
    ctx.fillStyle = '#ffaa00';
    ctx.font = '11px monospace';
    ctx.fillText(`🎩 ${hatsCollected}`, 10, 62);

    // SIGs
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`SIG: ${sigsCollected}`, 80, 62);

    // Invincibility indicator
    if (invincibleTimer > 0) {
      ctx.fillStyle = `rgba(255, 200, 0, ${0.6 + Math.sin(animTime * 8) * 0.3})`;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`⚡ INVINCIBLE ${invincibleTimer.toFixed(1)}s`, 10, 80);
    }

    // Distance / progress
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(progress * 100)}% → Clarity Beacon`, WIDTH - 10, 20);
    ctx.fillText(`Speed: ${Math.floor(scrollSpeed)}`, WIDTH - 10, 36);
    ctx.textAlign = 'left';

    // Controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '9px monospace';
    ctx.fillText('UP/W/SPACE: thrust • Q/ESC: quit', 10, HEIGHT - 10);
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
