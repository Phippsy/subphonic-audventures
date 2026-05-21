// Level 3: Final Boss — Lord Noise's Mech
// Sonia in jetpack (free flight) vs Lord Noise in a giant static mech
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
  { speaker: 'Sonia', lines: ['This is it. Lord Noise\'s fortress.', 'I can hear the static from here...', 'it\'s deafening.'] },
  { speaker: 'Sonia', lines: ['He\'s piloting some kind of', 'enormous mech — the Dissonance Engine.', 'It\'s generating anti-sound fields.'] },
  { speaker: 'Sonia', lines: ['My SIG blaster should pierce', 'his armour — but only at the', 'cockpit. I need headshots.'] },
  { speaker: 'Sonia', lines: ['Patrick cleared my jetpack for', 'full-axis flight. No thrust needed —', 'just pure sonic levitation.'] },
  { speaker: 'Sonia', lines: ['This ends now, Lord Noise.', 'Acoustica will sing again.'] },
];

const victoryDialog: { lines: string[]; speaker: string }[] = [
  { speaker: 'Sonia', lines: ['The Dissonance Engine is down!', 'Lord Noise\'s static field is...', 'collapsing!'] },
  { speaker: 'Lord Noise', lines: ['Impossible! My frequencies were', 'PERFECT! You can\'t silence—', '...you can\'t...'] },
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

  // Game loop
  let lastTime = performance.now();
  let animId = 0;

  const update = (dt: number) => {
    animTime += dt;
    elapsed += dt;
    difficulty = Math.min(1, elapsed / 90); // max difficulty at 90s

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

    // === FLYING BOTS ===
    botSpawnTimer -= dt;
    if (botSpawnTimer <= 0) {
      const botType = Math.random() < 0.5 ? 'noise' : 'muffle';
      flyingBots.push({
        x: WIDTH + 40,
        y: 40 + Math.random() * (HEIGHT - 100),
        w: 28,
        h: 28,
        vx: -(BOT_SPEED + difficulty * 80 + Math.random() * 60),
        type: botType,
        alive: true,
      });
      botSpawnTimer = (2.0 - difficulty * 0.8) + Math.random() * 2;
    }

    for (const bot of flyingBots) {
      if (!bot.alive) continue;
      bot.x += bot.vx * dt;
      // Sine wave movement
      bot.y += Math.sin(animTime * 3 + bot.x * 0.01) * 40 * dt;

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
    // === BACKGROUND (dark void with static noise) ===
    const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bgGrad.addColorStop(0, '#0a0a1a');
    bgGrad.addColorStop(0.5, '#0d0d2a');
    bgGrad.addColorStop(1, '#1a0a1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Static noise background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < 40; i++) {
      const nx = Math.random() * WIDTH;
      const ny = Math.random() * HEIGHT;
      ctx.fillRect(nx, ny, 2, 1);
    }

    // Grid lines (menacing)
    ctx.strokeStyle = 'rgba(255, 0, 80, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < WIDTH; gx += 80) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, HEIGHT);
      ctx.stroke();
    }
    for (let gy = 0; gy < HEIGHT; gy += 80) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(WIDTH, gy);
      ctx.stroke();
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
      if (bot.type === 'noise') {
        // Red angular bot with wings
        ctx.fillStyle = '#cc2222';
        ctx.fillRect(bot.x + 4, bot.y + 4, 20, 20);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(bot.x + 6, bot.y + 6, 16, 16);
        // Wings
        ctx.fillStyle = '#881111';
        ctx.beginPath();
        ctx.moveTo(bot.x + 14, bot.y);
        ctx.lineTo(bot.x + 4, bot.y + 4);
        ctx.lineTo(bot.x + 14, bot.y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bot.x + 14, bot.y + 28);
        ctx.lineTo(bot.x + 4, bot.y + 24);
        ctx.lineTo(bot.x + 14, bot.y + 20);
        ctx.closePath();
        ctx.fill();
        // Eye
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(bot.x + 8, bot.y + 10, 4, 4);
        ctx.fillRect(bot.x + 16, bot.y + 10, 4, 4);
      } else {
        // Purple rounded muffle bot
        ctx.fillStyle = '#6622aa';
        ctx.beginPath();
        ctx.arc(bot.x + 14, bot.y + 14, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9944dd';
        ctx.beginPath();
        ctx.arc(bot.x + 14, bot.y + 14, 8, 0, Math.PI * 2);
        ctx.fill();
        // Muffling waves
        ctx.strokeStyle = `rgba(200, 100, 255, ${0.5 + Math.sin(animTime * 6) * 0.3})`;
        ctx.lineWidth = 1;
        for (let w = 0; w < 2; w++) {
          ctx.beginPath();
          ctx.arc(bot.x + 14, bot.y + 14, 14 + w * 4, -0.5, 0.5);
          ctx.stroke();
        }
      }
    }

    // === DRAW BOSS (Lord Noise Mech) ===
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

    // === MECH BODY (giant, imposing) ===
    // Legs/base
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(bx + 20, HEIGHT - 120, 40, 120);
    ctx.fillRect(bx + 100, HEIGHT - 120, 40, 120);
    // Armour plates on legs
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx + 22, HEIGHT - 110, 36, 20);
    ctx.fillRect(bx + 102, HEIGHT - 110, 36, 20);

    // Torso (massive)
    const torsoGrad = ctx.createLinearGradient(bx, 150, bx + 180, 150);
    torsoGrad.addColorStop(0, '#1a1a3a');
    torsoGrad.addColorStop(0.5, '#2a2a5a');
    torsoGrad.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = torsoGrad;
    ctx.fillRect(bx, 180, 180, 240);

    // Armour plating
    ctx.strokeStyle = '#4a4a8a';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 10, 200, 160, 60);
    ctx.strokeRect(bx + 10, 270, 160, 60);
    ctx.strokeRect(bx + 10, 340, 160, 60);

    // Static energy vents
    ctx.fillStyle = `rgba(255, 0, 80, ${0.3 + Math.sin(animTime * 4) * 0.2})`;
    ctx.fillRect(bx + 15, 210, 30, 8);
    ctx.fillRect(bx + 135, 210, 30, 8);
    ctx.fillRect(bx + 15, 280, 30, 8);
    ctx.fillRect(bx + 135, 280, 30, 8);

    // Arms (beam emitters)
    // Left arm
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx - 30, 220, 35, 15);
    ctx.fillStyle = '#ff3344';
    ctx.fillRect(bx - 30, 225, 8, 5); // emitter tip
    // Right arm
    ctx.fillRect(bx + 175, 220, 35, 15);
    ctx.fillStyle = '#ff3344';
    ctx.fillRect(bx + 202, 225, 8, 5);

    // Shoulder pauldrons
    ctx.fillStyle = '#3a3a6a';
    ctx.beginPath();
    ctx.arc(bx + 10, 195, 25, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 170, 195, 25, Math.PI, 0);
    ctx.fill();

    // === COCKPIT / HEAD ===
    const headY = bossHeadY;
    const headFlash = bossHitFlash > 0 ? '#ffffff' : '#3a1a4a';

    // Neck connection
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx + 60, 180, 60, headY - 160);

    // Head (cockpit with Lord Noise inside)
    ctx.fillStyle = headFlash;
    ctx.beginPath();
    ctx.arc(bx + 60, headY, BOSS_HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Head armour
    ctx.strokeStyle = bossHitFlash > 0 ? '#ffff00' : '#6a3a8a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx + 60, headY, BOSS_HEAD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Visor / cockpit glass
    ctx.fillStyle = bossHitFlash > 0 ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 0, 60, 0.6)';
    ctx.beginPath();
    ctx.ellipse(bx + 60, headY, 22, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lord Noise's face behind visor (evil eyes)
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(bx + 52, headY - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 68, headY - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    // Angry brow
    ctx.strokeStyle = '#880000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 47, headY - 9);
    ctx.lineTo(bx + 55, headY - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 73, headY - 9);
    ctx.lineTo(bx + 65, headY - 6);
    ctx.stroke();

    // Crown/horns
    ctx.fillStyle = '#ff3344';
    ctx.beginPath();
    ctx.moveTo(bx + 40, headY - BOSS_HEAD_RADIUS);
    ctx.lineTo(bx + 45, headY - BOSS_HEAD_RADIUS - 15);
    ctx.lineTo(bx + 50, headY - BOSS_HEAD_RADIUS);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 70, headY - BOSS_HEAD_RADIUS);
    ctx.lineTo(bx + 75, headY - BOSS_HEAD_RADIUS - 15);
    ctx.lineTo(bx + 80, headY - BOSS_HEAD_RADIUS);
    ctx.closePath();
    ctx.fill();

    // HP bar above boss
    const hpBarW = 140;
    const hpBarH = 10;
    const hpBarX = bx + 20;
    const hpBarY = 40;
    ctx.fillStyle = '#333';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    const hpRatio = Math.max(0, bossHP / BOSS_MAX_HP);
    const hpColor = hpRatio > 0.5 ? '#ff3344' : hpRatio > 0.25 ? '#ff8800' : '#ffcc00';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LORD NOISE', hpBarX + hpBarW / 2, hpBarY - 4);
    ctx.textAlign = 'left';

    // Ambient static around mech
    if (bossPhase === 'fight') {
      ctx.strokeStyle = `rgba(255, 0, 80, ${0.15 + Math.sin(animTime * 5) * 0.1})`;
      ctx.lineWidth = 1;
      for (let s = 0; s < 5; s++) {
        const sx2 = bx + Math.random() * 180;
        const sy2 = 100 + Math.random() * 350;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 + (Math.random() - 0.5) * 20, sy2 + (Math.random() - 0.5) * 20);
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
                         dialog.speaker === 'Lord Noise' ? '#ff3344' : '#ffffff';
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
