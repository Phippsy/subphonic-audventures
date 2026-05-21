// Level 3: Final Boss — Count Crosstalk's Mech
// Sonia in jetpack (free flight) vs Count Crosstalk in a giant static mech
// Shoot green sigs at his head to do damage, avoid beams and flying bots

import { initAudio, startBossBGM, stopBossBGM, sfxBossHit, sfxBossBeam, sfxPlayerShoot, sfxBossDefeat, sfxStaticHit, sfxMenuSelect } from './audio';

// === CONSTANTS ===
const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_SPEED = 280;
const PLAYER_W = 36;
const PLAYER_H = 44;
const SHOOT_COOLDOWN = 0.28;
const PROJECTILE_SPEED = 500;
const BOSS_MAX_HP = 30;
const BOSS_X = WIDTH - 220;
const BOSS_HEAD_Y_CENTER = 160;
const BOSS_HEAD_RADIUS = 35;
const DAMAGE_COOLDOWN = 1.0;
const BEAM_CHARGE_TIME = 1.2;
const BEAM_DURATION = 1.8;
const BOT_SPEED = 180;
const MAX_PLAYER_HP = 8;

// === TYPES ===
interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Beam {
  y: number;
  chargeTimer: number;
  active: boolean;
  duration: number;
  width: number;
}

interface FlyingBot {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  type: 'noise' | 'muffle';
  alive: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

// === DIALOG ===
const introDialog: { lines: string[]; speaker: string }[] = [
  { speaker: 'Sonia', lines: ['This is it. Count Crosstalk\'s fortress.', 'I can hear the static from here...', 'it\'s deafening.'] },
  { speaker: 'Sonia', lines: ['He\'s piloting some kind of', 'enormous mech — the Dissonance Engine.', 'It\'s generating anti-sound fields.'] },
  { speaker: 'Sonia', lines: ['My SIG blaster should pierce', 'his armour — but only at the', 'cockpit. I need headshots.'] },
  { speaker: 'Sonia', lines: ['Patrick cleared my jetpack for', 'full-axis flight. No thrust needed —', 'just pure sonic levitation.'] },
  { speaker: 'Sonia', lines: ['This ends now, Count Crosstalk.', 'Acoustica will sing again.'] },
];

const victoryDialog: { lines: string[]; speaker: string }[] = [
  { speaker: 'Sonia', lines: ['The Dissonance Engine is down!', 'Count Crosstalk\'s static field is...', 'collapsing!'] },
  { speaker: 'Count Crosstalk', lines: ['Impossible! My frequencies were', 'PERFECT! You can\'t silence—', '...you can\'t...'] },
  { speaker: 'Sonia', lines: ['Sound isn\'t about power, Noise.', 'It\'s about harmony. And you\'ve', 'been out of tune from the start.'] },
  { speaker: 'Sonia', lines: ['Wait — what\'s that?', 'Something\'s emerging from the', 'wreckage of the mech...'] },
  { speaker: 'Sonia', lines: ['The Harmonic Resonance Core!', 'The original source of all sound', 'in Acoustica. He was HOARDING it!'] },
  { speaker: 'Sonia', lines: ['With this restored to the', 'Frequency Tower, every voice,', 'every note, every whisper...'] },
  { speaker: 'Sonia', lines: ['...they\'ll all sing again.', 'Acoustica is free.'] },
  { speaker: 'Sonia', lines: ['Thank you, everyone.', 'Patrick, James... even your hats.', 'We did this together.'] },
];

// === MOUNT ===
export function mountBoss(container: HTMLElement, onComplete: () => void, _onQuit: () => void): () => void {
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
  let dialogCooldown = 0.3;

  let playerX = 100;
  let playerY = HEIGHT / 2 - PLAYER_H / 2;
  let playerHP = MAX_PLAYER_HP;
  let damageCooldown = 0;
  let shootCooldown = 0;

  let bossHP = BOSS_MAX_HP;
  let bossPhase: 'fight' | 'dying' | 'dead' = 'fight';
  let bossDeathTimer = 0;
  let bossHitFlash = 0;
  let bossHeadY = BOSS_HEAD_Y_CENTER;
  let bossHeadPhase = 0;

  let projectiles: Projectile[] = [];
  let beams: Beam[] = [];
  let flyingBots: FlyingBot[] = [];
  let particles: Particle[] = [];

  let beamSpawnTimer = 2.0;
  let botSpawnTimer = 4.0;
  let animTime = 0;
  let elapsed = 0;
  let difficulty = 0; // 0-1, increases over time

  let gameOver = false;
  let gameOverTimer = 0;
  let wonDialogActive = false;
  let wonDialogPage = 0;
  let wonDialogAlpha = 0;
  let wonDialogCooldown = 0;
  let showingCredits = false;
  let creditsTimer = 0;

  // Input
  const keys: Record<string, boolean> = {};
  const keyDown = (e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') keys[' '] = true;
    if (e.key === 'Enter') keys['enter'] = true;
  };
  const keyUp = (e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === ' ') keys[' '] = false;
    if (e.key === 'Enter') keys['enter'] = false;
  };
  document.addEventListener('keydown', keyDown);
  document.addEventListener('keyup', keyUp);

  initAudio();

  // === BACKGROUND STATE ===
  let lightningTimer = 0;
  let lightningFlash = 0;
  let lightningBolts: { x: number; segments: { x: number; y: number }[]; alpha: number }[] = [];
  let lavaParticles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];

  // Game loop
  let lastTime = performance.now();
  let animId = 0;

  const update = (dt: number) => {
    animTime += dt;
    elapsed += dt;
    difficulty = Math.min(1, elapsed / 90); // max difficulty at 90s

    // === BACKGROUND EFFECTS UPDATE ===
    // Lightning
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightningTimer = 3 + Math.random() * 5 - difficulty * 2;
      lightningFlash = 0.4;
      // Generate bolt
      const boltX = 100 + Math.random() * (WIDTH - 300);
      const segs: { x: number; y: number }[] = [{ x: boltX, y: 0 }];
      let sy = 0;
      while (sy < HEIGHT * 0.6) {
        sy += 20 + Math.random() * 30;
        segs.push({ x: boltX + (Math.random() - 0.5) * 60, y: sy });
      }
      lightningBolts.push({ x: boltX, segments: segs, alpha: 1.0 });
    }
    if (lightningFlash > 0) lightningFlash -= dt * 2;
    for (const bolt of lightningBolts) bolt.alpha -= dt * 2.5;
    lightningBolts = lightningBolts.filter(b => b.alpha > 0);

    // Lava particles
    if (Math.random() < 0.15 + difficulty * 0.1) {
      lavaParticles.push({
        x: Math.random() * WIDTH,
        y: HEIGHT + 5,
        vx: (Math.random() - 0.5) * 30,
        vy: -(40 + Math.random() * 80),
        life: 1.5 + Math.random() * 1.5,
        size: 2 + Math.random() * 3,
      });
    }
    for (const lp of lavaParticles) {
      lp.x += lp.vx * dt;
      lp.y += lp.vy * dt;
      lp.life -= dt;
      lp.vy += 15 * dt; // slight gravity
    }
    lavaParticles = lavaParticles.filter(lp => lp.life > 0);

    // Dialog
    if (dialogActive) {
      dialogAlpha = Math.min(1, dialogAlpha + dt * 3);
      if (dialogCooldown > 0) dialogCooldown -= dt;
      if (dialogCooldown <= 0 && (keys[' '] || keys['enter'])) {
        keys[' '] = false;
        keys['enter'] = false;
        sfxMenuSelect();
        dialogPage++;
        dialogAlpha = 0;
        dialogCooldown = 0.3;
        if (dialogPage >= introDialog.length) {
          dialogActive = false;
          startBossBGM();
        }
      }
      return;
    }

    // Victory dialog
    if (wonDialogActive) {
      wonDialogAlpha = Math.min(1, wonDialogAlpha + dt * 3);
      if (wonDialogCooldown > 0) wonDialogCooldown -= dt;
      if (wonDialogCooldown <= 0 && (keys[' '] || keys['enter'])) {
        keys[' '] = false;
        keys['enter'] = false;
        sfxMenuSelect();
        wonDialogPage++;
        wonDialogAlpha = 0;
        wonDialogCooldown = 0.3;
        if (wonDialogPage >= victoryDialog.length) {
          wonDialogActive = false;
          showingCredits = true;
          creditsTimer = 0;
        }
      }
      return;
    }

    // Credits / ending
    if (showingCredits) {
      creditsTimer += dt;
      if (creditsTimer > 2 && (keys[' '] || keys['enter'])) {
        keys[' '] = false;
        keys['enter'] = false;
        onComplete();
      }
      return;
    }

    // Game over
    if (gameOver) {
      gameOverTimer += dt;
      if (gameOverTimer > 1.5 && (keys[' '] || keys['enter'])) {
        keys[' '] = false;
        keys['enter'] = false;
        // Restart
        playerHP = MAX_PLAYER_HP;
        bossHP = BOSS_MAX_HP;
        bossPhase = 'fight';
        bossDeathTimer = 0;
        projectiles = [];
        beams = [];
        flyingBots = [];
        particles = [];
        playerX = 100;
        playerY = HEIGHT / 2;
        gameOver = false;
        gameOverTimer = 0;
        elapsed = 0;
        difficulty = 0;
        beamSpawnTimer = 2.0;
        botSpawnTimer = 4.0;
        startBossBGM();
      }
      return;
    }

    // Boss death sequence
    if (bossPhase === 'dying') {
      bossDeathTimer += dt;
      // Explosions
      if (Math.random() < 0.3) {
        particles.push({
          x: BOSS_X + Math.random() * 180 - 40,
          y: Math.random() * HEIGHT * 0.7 + 40,
          vx: (Math.random() - 0.5) * 200,
          vy: (Math.random() - 0.5) * 200,
          life: 0.8,
          maxLife: 0.8,
          color: `hsl(${Math.random() * 60}, 100%, 60%)`,
        });
      }
      if (bossDeathTimer > 3) {
        bossPhase = 'dead';
        wonDialogActive = true;
        wonDialogPage = 0;
        wonDialogAlpha = 0;
        wonDialogCooldown = 0.5;
        stopBossBGM();
      }
      // Update particles during death
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter(p => p.life > 0);
      return;
    }

    // === PLAYER MOVEMENT (free flight) ===
    let dx = 0, dy = 0;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    // Normalize diagonal
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }
    playerX += dx * PLAYER_SPEED * dt;
    playerY += dy * PLAYER_SPEED * dt;
    // Bounds
    playerX = Math.max(10, Math.min(WIDTH * 0.55, playerX));
    playerY = Math.max(10, Math.min(HEIGHT - PLAYER_H - 10, playerY));

    // === SHOOTING ===
    shootCooldown -= dt;
    if ((keys[' '] || keys['enter']) && shootCooldown <= 0) {
      shootCooldown = SHOOT_COOLDOWN;
      sfxPlayerShoot();
      projectiles.push({
        x: playerX + PLAYER_W,
        y: playerY + PLAYER_H / 2 - 2,
        vx: PROJECTILE_SPEED,
        vy: 0,
        life: 2,
      });
    }

    // === UPDATE PROJECTILES ===
    for (const p of projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      // Check hit on boss head
      const headCX = BOSS_X + 60;
      const headCY = bossHeadY;
      const dist = Math.hypot(p.x - headCX, p.y - headCY);
      if (dist < BOSS_HEAD_RADIUS + 4) {
        p.life = 0;
        bossHP--;
        bossHitFlash = 0.2;
        sfxBossHit();
        // Hit particles
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: p.x,
            y: p.y,
            vx: (Math.random() - 0.5) * 300,
            vy: (Math.random() - 0.5) * 300,
            life: 0.4,
            maxLife: 0.4,
            color: `hsl(${120 + Math.random() * 40}, 90%, 60%)`,
          });
        }
        if (bossHP <= 0) {
          bossPhase = 'dying';
          bossDeathTimer = 0;
          sfxBossDefeat();
        }
      }
    }
    projectiles = projectiles.filter(p => p.life > 0 && p.x < WIDTH + 20);

    // === BOSS HEAD MOVEMENT ===
    bossHeadPhase += dt * (1.2 + difficulty * 0.8);
    bossHeadY = BOSS_HEAD_Y_CENTER + Math.sin(bossHeadPhase) * (60 + difficulty * 40);
    bossHeadY = Math.max(60, Math.min(HEIGHT - 120, bossHeadY));

    // === BEAM ATTACKS ===
    beamSpawnTimer -= dt;
    if (beamSpawnTimer <= 0) {
      const beamCount = difficulty > 0.6 ? 2 : 1;
      for (let b = 0; b < beamCount; b++) {
        beams.push({
          y: 60 + Math.random() * (HEIGHT - 120),
          chargeTimer: BEAM_CHARGE_TIME,
          active: false,
          duration: BEAM_DURATION,
          width: 20 + difficulty * 15,
        });
        sfxBossBeam();
      }
      beamSpawnTimer = (2.5 - difficulty * 1.2) + Math.random() * 1.5;
    }

    for (const beam of beams) {
      if (beam.chargeTimer > 0) {
        beam.chargeTimer -= dt;
        if (beam.chargeTimer <= 0) {
          beam.active = true;
        }
      } else {
        beam.duration -= dt;
        // Beam collision with player
        if (beam.active && damageCooldown <= 0) {
          const beamTop = beam.y - beam.width / 2;
          const beamBottom = beam.y + beam.width / 2;
          const playerCY = playerY + PLAYER_H / 2;
          if (playerCY > beamTop && playerCY < beamBottom && playerX < BOSS_X) {
            playerHP--;
            damageCooldown = DAMAGE_COOLDOWN;
            sfxStaticHit();
            if (playerHP <= 0) {
              gameOver = true;
              gameOverTimer = 0;
              stopBossBGM();
            }
          }
        }
      }
    }
    beams = beams.filter(b => b.duration > 0 || b.chargeTimer > 0);

    // === FLYING BOTS (cluster formations) ===
    botSpawnTimer -= dt;
    if (botSpawnTimer <= 0) {
      const formationType = Math.random();
      const botType: 'noise' | 'muffle' = Math.random() < 0.5 ? 'noise' : 'muffle';
      const baseSpeed = -(BOT_SPEED + difficulty * 100 + Math.random() * 60);
      const baseY = 60 + Math.random() * (HEIGHT - 160);

      if (formationType < 0.25 || difficulty < 0.2) {
        // Single bot (early game / occasional)
        flyingBots.push({
          x: WIDTH + 40,
          y: baseY,
          w: 28, h: 28,
          vx: baseSpeed,
          type: botType,
          alive: true,
        });
      } else if (formationType < 0.55) {
        // Wavy line formation (3-5 bots in a sine wave pattern)
        const count = 3 + Math.floor(difficulty * 2);
        for (let i = 0; i < count; i++) {
          flyingBots.push({
            x: WIDTH + 40 + i * 50,
            y: baseY + Math.sin(i * 1.2) * 50,
            w: 28, h: 28,
            vx: baseSpeed * (0.9 + Math.random() * 0.2),
            type: botType,
            alive: true,
          });
        }
      } else if (formationType < 0.75) {
        // V-formation cluster (mixed types)
        const count = 3 + Math.floor(difficulty * 2);
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / 2);
          const side = i % 2 === 0 ? -1 : 1;
          flyingBots.push({
            x: WIDTH + 40 + row * 45,
            y: baseY + side * (row + 1) * 30,
            w: 28, h: 28,
            vx: baseSpeed,
            type: i % 2 === 0 ? 'noise' : 'muffle',
            alive: true,
          });
        }
      } else {
        // Tight horizontal line (wall of bots)
        const count = 3 + Math.floor(difficulty * 3);
        const spacing = (HEIGHT - 120) / (count + 1);
        for (let i = 0; i < count; i++) {
          flyingBots.push({
            x: WIDTH + 40 + (Math.random() * 30),
            y: 60 + spacing * (i + 1) + (Math.random() - 0.5) * 20,
            w: 28, h: 28,
            vx: baseSpeed * 0.8,
            type: Math.random() < 0.5 ? 'noise' : 'muffle',
            alive: true,
          });
        }
      }
      botSpawnTimer = (2.5 - difficulty * 1.3) + Math.random() * 1.5;
    }

    for (const bot of flyingBots) {
      if (!bot.alive) continue;
      bot.x += bot.vx * dt;
      // Pronounced sine wave movement (more dramatic)
      bot.y += Math.sin(animTime * 3.5 + bot.x * 0.015 + bot.y * 0.01) * 60 * dt;

      // Collision with player
      if (damageCooldown <= 0 &&
          playerX + PLAYER_W > bot.x && playerX < bot.x + bot.w &&
          playerY + PLAYER_H > bot.y && playerY < bot.y + bot.h) {
        playerHP--;
        damageCooldown = DAMAGE_COOLDOWN;
        bot.alive = false;
        sfxStaticHit();
        if (playerHP <= 0) {
          gameOver = true;
          gameOverTimer = 0;
          stopBossBGM();
        }
      }

      // Projectile kills bot
      for (const p of projectiles) {
        if (p.life > 0 && p.x + 8 > bot.x && p.x < bot.x + bot.w &&
            p.y + 4 > bot.y && p.y < bot.y + bot.h) {
          bot.alive = false;
          p.life = 0;
          // Sparks
          for (let i = 0; i < 4; i++) {
            particles.push({
              x: bot.x + bot.w / 2,
              y: bot.y + bot.h / 2,
              vx: (Math.random() - 0.5) * 200,
              vy: (Math.random() - 0.5) * 200,
              life: 0.3,
              maxLife: 0.3,
              color: bot.type === 'noise' ? '#ff4444' : '#8844ff',
            });
          }
        }
      }
    }
    flyingBots = flyingBots.filter(b => b.alive && b.x > -60);

    // === DAMAGE COOLDOWN ===
    if (damageCooldown > 0) damageCooldown -= dt;
    if (bossHitFlash > 0) bossHitFlash -= dt;

    // === PARTICLES ===
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    // Ambient thrust particles from Sonia
    if (Math.random() < 0.3) {
      particles.push({
        x: playerX - 4,
        y: playerY + PLAYER_H / 2 + (Math.random() - 0.5) * 10,
        vx: -60 - Math.random() * 40,
        vy: (Math.random() - 0.5) * 30,
        life: 0.4,
        maxLife: 0.4,
        color: `rgba(0, 150, 255, ${0.3 + Math.random() * 0.3})`,
      });
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    // === BACKGROUND (epic volcanic void with layers) ===

    // Deep sky gradient - dark and ominous
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#030008');
    bgGrad.addColorStop(0.3, '#0a0418');
    bgGrad.addColorStop(0.6, '#1a0820');
    bgGrad.addColorStop(0.85, '#2a0a10');
    bgGrad.addColorStop(1, '#3a0a08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Lightning flash overlay
    if (lightningFlash > 0) {
      ctx.fillStyle = `rgba(180, 160, 255, ${lightningFlash * 0.15})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Stars (distant, twinkling)
    for (let i = 0; i < 50; i++) {
      const sx = (i * 137 + 50) % WIDTH;
      const sy = (i * 97 + 20) % (HEIGHT * 0.4);
      const twinkle = 0.3 + Math.sin(animTime * 2 + i * 1.3) * 0.2;
      ctx.fillStyle = `rgba(255, 200, 255, ${twinkle})`;
      ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, 1);
    }

    // Distant nebula clouds (parallax layer 1)
    ctx.globalAlpha = 0.06 + Math.sin(animTime * 0.3) * 0.02;
    for (let i = 0; i < 5; i++) {
      const nx = (i * 240 + 80 + Math.sin(animTime * 0.2 + i) * 20) % WIDTH;
      const ny = 40 + (i % 3) * 60;
      const nGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, 80 + i * 20);
      nGrad.addColorStop(0, i % 2 === 0 ? 'rgba(255, 50, 100, 0.4)' : 'rgba(100, 50, 255, 0.4)');
      nGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nGrad;
      ctx.fillRect(nx - 100, ny - 60, 200, 120);
    }
    ctx.globalAlpha = 1;

    // Volcanic mountains (parallax layer 2) - jagged silhouettes
    ctx.fillStyle = '#0a0412';
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let mx = 0; mx <= WIDTH; mx += 20) {
      const mh = Math.sin(mx * 0.008 + 1.5) * 80 + Math.sin(mx * 0.02 + 0.3) * 30 + 140;
      ctx.lineTo(mx, HEIGHT - mh);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Mountain highlights/lava veins
    ctx.strokeStyle = `rgba(255, 60, 20, ${0.15 + Math.sin(animTime * 1.5) * 0.08})`;
    ctx.lineWidth = 1;
    for (let mx = 0; mx < WIDTH; mx += 60) {
      const mh = Math.sin(mx * 0.008 + 1.5) * 80 + Math.sin(mx * 0.02 + 0.3) * 30 + 140;
      const baseY = HEIGHT - mh;
      ctx.beginPath();
      ctx.moveTo(mx + 10, baseY + 20);
      ctx.lineTo(mx + 15 + Math.sin(animTime + mx) * 5, baseY + 50);
      ctx.lineTo(mx + 8, baseY + 80);
      ctx.stroke();
    }

    // Closer volcanic range (parallax layer 3)
    ctx.fillStyle = '#12061a';
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let mx = 0; mx <= WIDTH; mx += 15) {
      const mh = Math.sin(mx * 0.012 + 3.0) * 50 + Math.sin(mx * 0.03) * 25 + 90;
      ctx.lineTo(mx, HEIGHT - mh);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Lava pool at the bottom
    const lavaGrad = ctx.createLinearGradient(0, HEIGHT - 40, 0, HEIGHT);
    lavaGrad.addColorStop(0, 'rgba(80, 10, 0, 0)');
    lavaGrad.addColorStop(0.3, `rgba(150, 30, 0, ${0.4 + Math.sin(animTime * 2) * 0.1})`);
    lavaGrad.addColorStop(0.7, `rgba(255, 80, 0, ${0.6 + Math.sin(animTime * 3) * 0.15})`);
    lavaGrad.addColorStop(1, `rgba(255, 150, 0, ${0.8 + Math.sin(animTime * 4) * 0.1})`);
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, HEIGHT - 40, WIDTH, 40);

    // Lava surface bubbling
    for (let i = 0; i < 8; i++) {
      const bx = (i * 130 + Math.sin(animTime * 1.5 + i * 2) * 20) % WIDTH;
      const bubSize = 3 + Math.sin(animTime * 4 + i * 1.7) * 2;
      if (bubSize > 3) {
        ctx.fillStyle = `rgba(255, 200, 50, ${0.5 + Math.sin(animTime * 5 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(bx, HEIGHT - 38 - Math.abs(Math.sin(animTime * 3 + i)) * 6, bubSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Lava particles (rising embers)
    for (const lp of lavaParticles) {
      const lpAlpha = lp.life / 3;
      ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, ${lpAlpha})`;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, lp.size * lpAlpha, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lightning bolts
    for (const bolt of lightningBolts) {
      ctx.strokeStyle = `rgba(200, 180, 255, ${bolt.alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
      for (let i = 1; i < bolt.segments.length; i++) {
        ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
      }
      ctx.stroke();
      // Glow
      ctx.strokeStyle = `rgba(150, 100, 255, ${bolt.alpha * 0.4})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
      for (let i = 1; i < bolt.segments.length; i++) {
        ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
      }
      ctx.stroke();
      // Branch
      if (bolt.segments.length > 3) {
        const branchIdx = 2;
        const bs = bolt.segments[branchIdx];
        ctx.strokeStyle = `rgba(200, 180, 255, ${bolt.alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bs.x, bs.y);
        ctx.lineTo(bs.x + 30, bs.y + 25);
        ctx.lineTo(bs.x + 20, bs.y + 50);
        ctx.stroke();
      }
    }

    // Energy grid (subtle, menacing)
    const gridPulse = 0.03 + Math.sin(animTime * 2) * 0.015;
    ctx.strokeStyle = `rgba(255, 0, 80, ${gridPulse})`;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < WIDTH; gx += 80) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, HEIGHT - 40);
      ctx.stroke();
    }
    for (let gy = 0; gy < HEIGHT - 40; gy += 80) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(WIDTH, gy);
      ctx.stroke();
    }

    // Static noise particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    for (let i = 0; i < 60; i++) {
      const nx = Math.random() * WIDTH;
      const ny = Math.random() * (HEIGHT - 40);
      ctx.fillRect(nx, ny, 2 + Math.random() * 2, 1);
    }

    // Atmospheric haze (vignette edges)
    const vigGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.3, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.8);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Floating debris / ash
    ctx.fillStyle = 'rgba(80, 40, 20, 0.3)';
    for (let i = 0; i < 15; i++) {
      const dx = ((i * 67 + animTime * 15) % WIDTH);
      const dy = ((i * 103 + animTime * (8 + i * 2)) % (HEIGHT - 60));
      ctx.fillRect(dx, dy, 2, 2);
    }

    // === DRAW BEAMS ===
    for (const beam of beams) {
      if (beam.chargeTimer > 0) {
        // Charging indicator: flashing line
        const chargeProgress = 1 - beam.chargeTimer / BEAM_CHARGE_TIME;
        const flash = Math.sin(animTime * 20) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(255, 0, 60, ${chargeProgress * flash * 0.8})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(BOSS_X - 20, beam.y);
        ctx.lineTo(0, beam.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Warning icon
        ctx.fillStyle = `rgba(255, 200, 0, ${chargeProgress * flash})`;
        ctx.font = '16px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('⚠', BOSS_X - 30, beam.y + 6);
        ctx.textAlign = 'left';
      } else if (beam.active) {
        // Active beam: solid static energy
        const beamAlpha = Math.min(1, beam.duration / 0.3); // fade out at end
        const grad = ctx.createLinearGradient(0, beam.y - beam.width / 2, 0, beam.y + beam.width / 2);
        grad.addColorStop(0, `rgba(255, 0, 60, 0)`);
        grad.addColorStop(0.3, `rgba(255, 40, 80, ${0.6 * beamAlpha})`);
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${0.9 * beamAlpha})`);
        grad.addColorStop(0.7, `rgba(255, 40, 80, ${0.6 * beamAlpha})`);
        grad.addColorStop(1, `rgba(255, 0, 60, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, beam.y - beam.width / 2, BOSS_X - 20, beam.width);
        // Crackling edges
        ctx.strokeStyle = `rgba(255, 200, 100, ${0.5 * beamAlpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let bx = 0; bx < BOSS_X - 20; bx += 12) {
          ctx.lineTo(bx, beam.y - beam.width / 2 + Math.random() * 4);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let bx = 0; bx < BOSS_X - 20; bx += 12) {
          ctx.lineTo(bx, beam.y + beam.width / 2 - Math.random() * 4);
        }
        ctx.stroke();
      }
    }

    // === DRAW FLYING BOTS ===
    for (const bot of flyingBots) {
      if (!bot.alive) continue;
      const bcx = bot.x + 14;
      const bcy = bot.y + 14;

      if (bot.type === 'noise') {
        // Red angular bot with wings + energy trail
        // Glow aura
        const botGlow = ctx.createRadialGradient(bcx, bcy, 0, bcx, bcy, 20);
        botGlow.addColorStop(0, 'rgba(255, 50, 30, 0.2)');
        botGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = botGlow;
        ctx.fillRect(bot.x - 6, bot.y - 6, 40, 40);
        // Body
        ctx.fillStyle = '#cc2222';
        ctx.fillRect(bot.x + 4, bot.y + 4, 20, 20);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(bot.x + 6, bot.y + 6, 16, 16);
        // Inner circuit lines
        ctx.strokeStyle = '#ff8866';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(bot.x + 8, bot.y + 8);
        ctx.lineTo(bot.x + 14, bot.y + 14);
        ctx.lineTo(bot.x + 20, bot.y + 8);
        ctx.stroke();
        // Wings (animated flutter)
        const wingFlutter = Math.sin(animTime * 12 + bot.x * 0.1) * 2;
        ctx.fillStyle = '#881111';
        ctx.beginPath();
        ctx.moveTo(bcx, bot.y + wingFlutter);
        ctx.lineTo(bot.x, bot.y + 4);
        ctx.lineTo(bcx, bot.y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bcx, bot.y + 28 - wingFlutter);
        ctx.lineTo(bot.x, bot.y + 24);
        ctx.lineTo(bcx, bot.y + 20);
        ctx.closePath();
        ctx.fill();
        // Eyes (glowing)
        const eyePulse = 0.7 + Math.sin(animTime * 8 + bot.x) * 0.3;
        ctx.fillStyle = `rgba(255, 200, 0, ${eyePulse})`;
        ctx.fillRect(bot.x + 8, bot.y + 10, 4, 4);
        ctx.fillRect(bot.x + 16, bot.y + 10, 4, 4);
        // Exhaust trail
        ctx.fillStyle = 'rgba(255, 80, 30, 0.3)';
        ctx.fillRect(bot.x + 28, bcy - 2, 8 + Math.random() * 6, 4);
        ctx.fillStyle = 'rgba(255, 40, 10, 0.15)';
        ctx.fillRect(bot.x + 34, bcy - 1, 10 + Math.random() * 8, 2);
      } else {
        // Purple rounded muffle bot + distortion field
        // Glow aura
        const muffGlow = ctx.createRadialGradient(bcx, bcy, 0, bcx, bcy, 22);
        muffGlow.addColorStop(0, 'rgba(150, 50, 255, 0.25)');
        muffGlow.addColorStop(1, 'rgba(100, 0, 200, 0)');
        ctx.fillStyle = muffGlow;
        ctx.beginPath();
        ctx.arc(bcx, bcy, 22, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#6622aa';
        ctx.beginPath();
        ctx.arc(bcx, bcy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9944dd';
        ctx.beginPath();
        ctx.arc(bcx, bcy, 8, 0, Math.PI * 2);
        ctx.fill();
        // Inner eye
        ctx.fillStyle = '#ddaaff';
        ctx.beginPath();
        ctx.arc(bcx, bcy, 3, 0, Math.PI * 2);
        ctx.fill();
        // Distortion waves (animated)
        ctx.strokeStyle = `rgba(200, 100, 255, ${0.5 + Math.sin(animTime * 6 + bot.x * 0.05) * 0.3})`;
        ctx.lineWidth = 1.5;
        for (let w = 0; w < 3; w++) {
          const waveR = 14 + w * 5 + Math.sin(animTime * 4 + w) * 2;
          ctx.beginPath();
          ctx.arc(bcx, bcy, waveR, -0.7 - w * 0.2, 0.7 + w * 0.2);
          ctx.stroke();
        }
        // Trailing mist
        ctx.fillStyle = 'rgba(100, 50, 200, 0.15)';
        ctx.beginPath();
        ctx.ellipse(bot.x + 30, bcy, 8 + Math.random() * 4, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === DRAW BOSS (Count Crosstalk Mech) ===
    drawBoss(ctx);

    // === DRAW PROJECTILES ===
    for (const p of projectiles) {
      // Green sig bullet
      const trail = p.life < 1.8 ? 1 : 0.5;
      ctx.fillStyle = `rgba(0, 255, 100, ${trail})`;
      ctx.fillRect(p.x, p.y, 10, 4);
      ctx.fillStyle = '#aaffaa';
      ctx.fillRect(p.x + 6, p.y + 1, 4, 2);
      // Glow
      ctx.fillStyle = `rgba(0, 255, 100, 0.2)`;
      ctx.beginPath();
      ctx.arc(p.x + 5, p.y + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // === DRAW PLAYER (Sonia in jetpack) ===
    drawPlayer(ctx);

    // === PARTICLES ===
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color.includes('rgba') ? p.color : p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // === HUD ===
    drawHUD(ctx);

    // === DIALOG OVERLAYS ===
    if (dialogActive) {
      drawDialog(ctx, introDialog[dialogPage], dialogAlpha);
    }
    if (wonDialogActive) {
      drawDialog(ctx, victoryDialog[wonDialogPage], wonDialogAlpha);
    }

    // === GAME OVER ===
    if (gameOver) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.7, gameOverTimer * 0.5)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SIGNAL LOST', WIDTH / 2, HEIGHT / 2 - 20);
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '14px monospace';
      ctx.fillText('The static overwhelmed your systems', WIDTH / 2, HEIGHT / 2 + 20);
      if (gameOverTimer > 1.5) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText('SPACE to retry', WIDTH / 2, HEIGHT / 2 + 60);
      }
      ctx.textAlign = 'left';
    }

    // === CREDITS ===
    if (showingCredits) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Harmonic Resonance Core visual
      const coreX = WIDTH / 2;
      const coreY = 140;
      const coreGlow = 0.5 + Math.sin(animTime * 2) * 0.3;
      // Outer rings
      for (let r = 0; r < 4; r++) {
        ctx.strokeStyle = `rgba(0, 255, 170, ${(0.3 - r * 0.06) * coreGlow})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(coreX, coreY, 40 + r * 15 + Math.sin(animTime * 3 + r) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Core
      const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 35);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, '#00ffaa');
      coreGrad.addColorStop(0.7, '#0088ff');
      coreGrad.addColorStop(1, 'rgba(0, 50, 100, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(coreX, coreY, 35, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00ffaa';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HARMONIC RESONANCE CORE RESTORED', WIDTH / 2, 230);

      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.fillText('ACOUSTICA IS FREE', WIDTH / 2, 270);

      ctx.fillStyle = '#88ffaa';
      ctx.font = '14px monospace';
      ctx.fillText('Peace has returned to all frequencies.', WIDTH / 2, 310);
      ctx.fillText('Every voice sings again.', WIDTH / 2, 335);

      ctx.fillStyle = '#666666';
      ctx.font = '12px monospace';
      ctx.fillText('SUBPHONIC AUDVENTURES', WIDTH / 2, 400);
      ctx.fillText('A Subphonic Production', WIDTH / 2, 420);

      if (creditsTimer > 2) {
        const blink = Math.sin(animTime * 3) > 0;
        if (blink) {
          ctx.fillStyle = '#00ff00';
          ctx.font = '14px monospace';
          ctx.fillText('SPACE to continue', WIDTH / 2, 480);
        }
      }
      ctx.textAlign = 'left';
    }
  };

  const drawBoss = (ctx: CanvasRenderingContext2D) => {
    if (bossPhase === 'dead') return;

    const bx = BOSS_X;
    const shake = bossPhase === 'dying' ? (Math.random() - 0.5) * 8 : 0;

    ctx.save();
    ctx.translate(shake, shake * 0.5);

    // === ENERGY AURA around mech ===
    if (bossPhase === 'fight') {
      const auraAlpha = 0.08 + Math.sin(animTime * 3) * 0.04;
      const auraGrad = ctx.createRadialGradient(bx + 90, 280, 50, bx + 90, 280, 250);
      auraGrad.addColorStop(0, `rgba(255, 0, 80, ${auraAlpha})`);
      auraGrad.addColorStop(0.5, `rgba(150, 0, 100, ${auraAlpha * 0.5})`);
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.fillRect(bx - 80, 50, 360, 480);
    }

    // === MECH BODY (giant, imposing) ===
    // Legs/base with hydraulics
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(bx + 20, HEIGHT - 120, 40, 120);
    ctx.fillRect(bx + 100, HEIGHT - 120, 40, 120);
    // Hydraulic pistons
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(bx + 30, HEIGHT - 100, 8, 60);
    ctx.fillRect(bx + 110, HEIGHT - 100, 8, 60);
    ctx.fillStyle = '#5a5a7a';
    ctx.fillRect(bx + 32, HEIGHT - 80, 4, 30);
    ctx.fillRect(bx + 112, HEIGHT - 80, 4, 30);
    // Armour plates on legs
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx + 22, HEIGHT - 110, 36, 20);
    ctx.fillRect(bx + 102, HEIGHT - 110, 36, 20);
    // Knee joints (glowing)
    ctx.fillStyle = `rgba(255, 50, 80, ${0.4 + Math.sin(animTime * 5) * 0.2})`;
    ctx.beginPath();
    ctx.arc(bx + 40, HEIGHT - 90, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 120, HEIGHT - 90, 5, 0, Math.PI * 2);
    ctx.fill();
    // Foot anchors
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(bx + 12, HEIGHT - 8, 56, 8);
    ctx.fillRect(bx + 92, HEIGHT - 8, 56, 8);

    // Torso (massive, layered armour)
    const torsoGrad = ctx.createLinearGradient(bx, 150, bx + 180, 400);
    torsoGrad.addColorStop(0, '#1a1a3a');
    torsoGrad.addColorStop(0.3, '#2a2a5a');
    torsoGrad.addColorStop(0.7, '#222244');
    torsoGrad.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = torsoGrad;
    ctx.fillRect(bx, 180, 180, 240);

    // Armour plating with rivets
    ctx.strokeStyle = '#4a4a8a';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 10, 200, 160, 60);
    ctx.strokeRect(bx + 10, 270, 160, 60);
    ctx.strokeRect(bx + 10, 340, 160, 60);
    // Rivets
    ctx.fillStyle = '#6a6a9a';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.beginPath();
        ctx.arc(bx + 16 + col * 150, 210 + row * 70, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Central power core (on torso)
    const corePulse = 0.5 + Math.sin(animTime * 4) * 0.3;
    const coreGrad = ctx.createRadialGradient(bx + 90, 300, 0, bx + 90, 300, 25);
    coreGrad.addColorStop(0, `rgba(255, 50, 100, ${corePulse})`);
    coreGrad.addColorStop(0.5, `rgba(200, 0, 60, ${corePulse * 0.6})`);
    coreGrad.addColorStop(1, 'rgba(100, 0, 30, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(bx + 90, 300, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 100, 150, ${corePulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx + 90, 300, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Static energy vents (pulsing brighter)
    const ventPulse = 0.4 + Math.sin(animTime * 4) * 0.3;
    ctx.fillStyle = `rgba(255, 0, 80, ${ventPulse})`;
    ctx.fillRect(bx + 15, 210, 30, 8);
    ctx.fillRect(bx + 135, 210, 30, 8);
    ctx.fillRect(bx + 15, 280, 30, 8);
    ctx.fillRect(bx + 135, 280, 30, 8);
    // Vent glow
    ctx.fillStyle = `rgba(255, 100, 100, ${ventPulse * 0.3})`;
    ctx.fillRect(bx + 10, 208, 40, 12);
    ctx.fillRect(bx + 130, 208, 40, 12);

    // Power conduits (connecting core to arms)
    ctx.strokeStyle = `rgba(255, 50, 80, ${0.3 + Math.sin(animTime * 6) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 65, 300);
    ctx.quadraticCurveTo(bx + 20, 280, bx - 10, 227);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 115, 300);
    ctx.quadraticCurveTo(bx + 160, 280, bx + 190, 227);
    ctx.stroke();

    // Arms (beam emitters, more detailed)
    // Left arm
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx - 40, 218, 45, 18);
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(bx - 35, 220, 35, 14);
    ctx.fillStyle = '#ff3344';
    ctx.fillRect(bx - 42, 223, 10, 8); // emitter tip
    ctx.fillStyle = `rgba(255, 100, 50, ${0.5 + Math.sin(animTime * 7) * 0.3})`;
    ctx.fillRect(bx - 42, 225, 10, 4); // emitter glow
    // Right arm
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx + 175, 218, 45, 18);
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(bx + 180, 220, 35, 14);
    ctx.fillStyle = '#ff3344';
    ctx.fillRect(bx + 212, 223, 10, 8);
    ctx.fillStyle = `rgba(255, 100, 50, ${0.5 + Math.sin(animTime * 7 + 1) * 0.3})`;
    ctx.fillRect(bx + 212, 225, 10, 4);

    // Shoulder pauldrons (larger, with spikes)
    ctx.fillStyle = '#3a3a6a';
    ctx.beginPath();
    ctx.arc(bx + 10, 195, 28, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 170, 195, 28, Math.PI, 0);
    ctx.fill();
    // Spikes on shoulders
    ctx.fillStyle = '#5a5a8a';
    ctx.beginPath();
    ctx.moveTo(bx - 5, 195);
    ctx.lineTo(bx - 15, 175);
    ctx.lineTo(bx + 5, 195);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 175, 195);
    ctx.lineTo(bx + 195, 175);
    ctx.lineTo(bx + 185, 195);
    ctx.closePath();
    ctx.fill();

    // === COCKPIT / HEAD ===
    const headY = bossHeadY;
    const headFlash = bossHitFlash > 0 ? '#ffffff' : '#3a1a4a';

    // Neck connection (armoured)
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx + 55, 180, 70, headY - 160);
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 1;
    for (let ny = 185; ny < headY - 10; ny += 12) {
      ctx.beginPath();
      ctx.moveTo(bx + 58, ny);
      ctx.lineTo(bx + 122, ny);
      ctx.stroke();
    }

    // Head glow (danger zone indicator)
    if (bossPhase === 'fight') {
      const headGlowR = BOSS_HEAD_RADIUS + 12 + Math.sin(animTime * 3) * 4;
      const headGlow = ctx.createRadialGradient(bx + 60, headY, BOSS_HEAD_RADIUS, bx + 60, headY, headGlowR);
      headGlow.addColorStop(0, 'rgba(255, 0, 60, 0)');
      headGlow.addColorStop(1, `rgba(255, 0, 60, ${0.1 + Math.sin(animTime * 5) * 0.05})`);
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(bx + 60, headY, headGlowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head (cockpit with Count Crosstalk inside)
    ctx.fillStyle = headFlash;
    ctx.beginPath();
    ctx.arc(bx + 60, headY, BOSS_HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Head armour ring
    ctx.strokeStyle = bossHitFlash > 0 ? '#ffff00' : '#6a3a8a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx + 60, headY, BOSS_HEAD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    // Secondary armour ring
    ctx.strokeStyle = bossHitFlash > 0 ? '#ffcc00' : '#4a2a6a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx + 60, headY, BOSS_HEAD_RADIUS + 5, 0, Math.PI * 2);
    ctx.stroke();

    // Visor / cockpit glass
    ctx.fillStyle = bossHitFlash > 0 ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 0, 60, 0.6)';
    ctx.beginPath();
    ctx.ellipse(bx + 60, headY, 22, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Visor reflection
    ctx.fillStyle = 'rgba(255, 200, 200, 0.15)';
    ctx.beginPath();
    ctx.ellipse(bx + 55, headY - 4, 8, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Count Crosstalk's face behind visor (evil eyes with pupils)
    const eyeGlow = 0.7 + Math.sin(animTime * 6) * 0.3;
    ctx.fillStyle = `rgba(255, 0, 0, ${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(bx + 52, headY - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 68, headY - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Yellow slit pupils
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(bx + 51, headY - 5, 2, 5);
    ctx.fillRect(bx + 67, headY - 5, 2, 5);
    // Angry brow
    ctx.strokeStyle = '#880000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx + 45, headY - 11);
    ctx.lineTo(bx + 55, headY - 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 75, headY - 11);
    ctx.lineTo(bx + 65, headY - 7);
    ctx.stroke();

    // Crown/horns (larger, more menacing)
    ctx.fillStyle = '#ff3344';
    ctx.beginPath();
    ctx.moveTo(bx + 38, headY - BOSS_HEAD_RADIUS + 2);
    ctx.lineTo(bx + 43, headY - BOSS_HEAD_RADIUS - 20);
    ctx.lineTo(bx + 48, headY - BOSS_HEAD_RADIUS + 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 72, headY - BOSS_HEAD_RADIUS + 2);
    ctx.lineTo(bx + 77, headY - BOSS_HEAD_RADIUS - 20);
    ctx.lineTo(bx + 82, headY - BOSS_HEAD_RADIUS + 2);
    ctx.closePath();
    ctx.fill();
    // Center horn (smaller)
    ctx.beginPath();
    ctx.moveTo(bx + 55, headY - BOSS_HEAD_RADIUS + 4);
    ctx.lineTo(bx + 60, headY - BOSS_HEAD_RADIUS - 12);
    ctx.lineTo(bx + 65, headY - BOSS_HEAD_RADIUS + 4);
    ctx.closePath();
    ctx.fill();

    // HP bar above boss (more dramatic)
    const hpBarW = 160;
    const hpBarH = 12;
    const hpBarX = bx + 10;
    const hpBarY = 38;
    // Bar background with glow
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(hpBarX - 2, hpBarY - 2, hpBarW + 4, hpBarH + 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    const hpRatio = Math.max(0, bossHP / BOSS_MAX_HP);
    const hpColor = hpRatio > 0.5 ? '#ff3344' : hpRatio > 0.25 ? '#ff8800' : '#ffcc00';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);
    // HP bar shimmer
    ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(animTime * 6) * 0.05})`;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio * 0.5, hpBarH / 2);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('COUNT CROSSTALK', hpBarX + hpBarW / 2, hpBarY - 6);
    // Skull icon next to name
    ctx.font = '10px monospace';
    ctx.fillText('☠', hpBarX - 10, hpBarY - 5);
    ctx.textAlign = 'left';

    // Ambient static arcs around mech (more dramatic)
    if (bossPhase === 'fight') {
      // Static crackling lines
      ctx.strokeStyle = `rgba(255, 0, 80, ${0.2 + Math.sin(animTime * 5) * 0.1})`;
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 8; s++) {
        const sx2 = bx + Math.random() * 180;
        const sy2 = 100 + Math.random() * 350;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 + (Math.random() - 0.5) * 30, sy2 + (Math.random() - 0.5) * 30);
        ctx.lineTo(sx2 + (Math.random() - 0.5) * 20, sy2 + (Math.random() - 0.5) * 40);
        ctx.stroke();
      }
      // Energy arcs between shoulders
      if (Math.sin(animTime * 7) > 0.5) {
        ctx.strokeStyle = 'rgba(255, 100, 200, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 10, 185);
        ctx.quadraticCurveTo(bx + 90, 170 + Math.random() * 20, bx + 170, 185);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const x = playerX;
    const y = playerY;
    const dmgFlash = damageCooldown > 0 && Math.sin(animTime * 20) > 0;
    if (dmgFlash) ctx.globalAlpha = 0.5;

    // === JETPACK ===
    const jpGrad = ctx.createLinearGradient(x - 7, y + 6, x + 5, y + 6);
    jpGrad.addColorStop(0, '#2a2a4a');
    jpGrad.addColorStop(0.5, '#4a4a6a');
    jpGrad.addColorStop(1, '#2a2a4a');
    ctx.fillStyle = jpGrad;
    ctx.beginPath();
    ctx.roundRect(x - 7, y + 6, 12, 30, 3);
    ctx.fill();
    // Nozzle
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(x - 5, y + 36, 8, 5, [0, 0, 2, 2]);
    ctx.fill();
    // Levitation glow (always on, no thrust needed)
    const glowH = 6 + Math.sin(animTime * 8) * 2;
    const glowGrad = ctx.createLinearGradient(x - 1, y + 41, x - 1, y + 41 + glowH);
    glowGrad.addColorStop(0, 'rgba(0, 200, 255, 0.8)');
    glowGrad.addColorStop(0.5, 'rgba(0, 100, 255, 0.4)');
    glowGrad.addColorStop(1, 'rgba(0, 50, 200, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 41);
    ctx.lineTo(x - 1, y + 41 + glowH);
    ctx.lineTo(x + 2, y + 41);
    ctx.closePath();
    ctx.fill();
    // Status light
    const lightPulse = 0.5 + Math.sin(animTime * 6) * 0.5;
    ctx.fillStyle = `rgba(0, 255, 200, ${lightPulse})`;
    ctx.beginPath();
    ctx.arc(x - 1, y + 8, 2, 0, Math.PI * 2);
    ctx.fill();

    // === BODY ===
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 16, 28, 26, 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a5a';
    ctx.fillRect(x + 6, y + 18, 24, 22);
    // Circuit lines
    ctx.strokeStyle = '#00ccaa88';
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
    // Sound wave emblem
    ctx.strokeStyle = '#00ccaa';
    ctx.lineWidth = 1;
    for (let w = 0; w < 2; w++) {
      ctx.beginPath();
      ctx.arc(x + 18, y + 25, 3 + w * 3, -0.6, 0.6);
      ctx.stroke();
    }
    // Belt
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 6, y + 36, 24, 3);
    ctx.fillStyle = '#00ccaa';
    ctx.beginPath();
    ctx.arc(x + 18, y + 37.5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // === HEAD ===
    ctx.fillStyle = '#e0b890';
    ctx.fillRect(x + 14, y + 13, 8, 5);
    ctx.beginPath();
    ctx.roundRect(x + 7, y + 1, 22, 16, 6);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x + 11, y + 7, 6, 5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 19, y + 7, 6, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#44aa66';
    ctx.beginPath();
    ctx.arc(x + 14, y + 9.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 22, y + 9.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + 14.5, y + 9.5, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 22.5, y + 9.5, 1, 0, Math.PI * 2);
    ctx.fill();

    // Hair (purple, flowing)
    ctx.fillStyle = '#7a3a9a';
    ctx.beginPath();
    ctx.roundRect(x + 5, y - 2, 24, 8, [4, 4, 0, 0]);
    ctx.fill();
    ctx.fillRect(x + 7, y + 1, 5, 4);
    // Wind strands
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 2);
    ctx.quadraticCurveTo(x + 2, y + 8, x + 0, y + 14);
    ctx.lineTo(x + 3, y + 12);
    ctx.quadraticCurveTo(x + 4, y + 7, x + 8, y + 3);
    ctx.closePath();
    ctx.fill();
    // Goggles on forehead
    ctx.fillStyle = '#003322';
    ctx.beginPath();
    ctx.roundRect(x + 10, y - 1, 5, 3, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 20, y - 1, 5, 3, 1);
    ctx.fill();
    ctx.strokeStyle = '#00ccaa';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(x + 10, y - 1, 5, 3, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x + 20, y - 1, 5, 3, 1);
    ctx.stroke();

    // SIG blaster (arm cannon, right side)
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(x + 30, y + 20, 12, 8);
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(x + 40, y + 22, 4, 4);

    ctx.globalAlpha = 1;
  };

  const drawHUD = (ctx: CanvasRenderingContext2D) => {
    // Player HP
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 35);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 200, 35);

    ctx.fillStyle = '#00ff00';
    ctx.font = '10px monospace';
    ctx.fillText('SIGNAL INTEGRITY', 18, 22);

    // HP pips
    for (let h = 0; h < MAX_PLAYER_HP; h++) {
      const pipX = 18 + h * 22;
      ctx.fillStyle = h < playerHP ? '#00ff00' : '#333';
      ctx.fillRect(pipX, 28, 18, 10);
      if (h < playerHP) {
        ctx.fillStyle = '#88ffaa';
        ctx.fillRect(pipX + 2, 30, 4, 4);
      }
    }

    // Boss phase indicator
    if (bossPhase === 'fight') {
      const phase = bossHP > BOSS_MAX_HP * 0.66 ? 'PHASE 1' :
                    bossHP > BOSS_MAX_HP * 0.33 ? 'PHASE 2' : 'PHASE 3';
      ctx.fillStyle = '#ff4444';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(phase, WIDTH - 20, HEIGHT - 20);
      ctx.textAlign = 'left';
    }
  };

  const drawDialog = (ctx: CanvasRenderingContext2D, dialog: { lines: string[]; speaker: string }, alpha: number) => {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.85 * alpha})`;
    ctx.fillRect(60, HEIGHT - 180, WIDTH - 120, 150);
    ctx.strokeStyle = `rgba(0, 255, 0, ${0.5 * alpha})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(60, HEIGHT - 180, WIDTH - 120, 150);

    // Speaker name
    const speakerColor = dialog.speaker === 'Sonia' ? '#00ccaa' :
                         dialog.speaker === 'Count Crosstalk' ? '#ff3344' : '#ffffff';
    ctx.fillStyle = speakerColor;
    ctx.font = 'bold 14px monospace';
    ctx.globalAlpha = alpha;
    ctx.fillText(dialog.speaker, 80, HEIGHT - 155);

    // Lines
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px monospace';
    dialog.lines.forEach((line, i) => {
      ctx.fillText(line, 80, HEIGHT - 130 + i * 22);
    });

    // Advance hint
    const blink = Math.sin(animTime * 3) > 0;
    if (blink) {
      ctx.fillStyle = '#666666';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('SPACE ▶', WIDTH - 80, HEIGHT - 40);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  };

  // === GAME LOOP ===
  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    update(dt);
    draw(ctx2!);

    animId = requestAnimationFrame(loop);
  };

  animId = requestAnimationFrame(loop);

  // Cleanup function
  return () => {
    running = false;
    cancelAnimationFrame(animId);
    document.removeEventListener('keydown', keyDown);
    document.removeEventListener('keyup', keyUp);
    stopBossBGM();
  };
}
