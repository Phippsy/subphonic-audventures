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
const BOSS_HEAD_HP = 15;
const BOSS_HEART_HP = 15;
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

const sonicShellDialog: { lines: string[]; speaker: string }[] = [
  { speaker: 'Count Crosstalk', lines: ['Ha ha ha! You think a few dents', 'to my cockpit would stop me?', 'FOOL!'] },
  { speaker: 'Count Crosstalk', lines: ['Activating SONIC SHELL!', 'My head is now impenetrable.', 'Nothing gets through this frequency barrier!'] },
  { speaker: 'Sonia', lines: ['His cockpit\'s sealed itself in', 'some kind of resonant shield...', 'I can\'t get through!'] },
  { speaker: 'Sonia', lines: ['Wait — his power core. It\'s', 'exposed inside the chest cavity!', 'That\'s his weak point now!'] },
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

  // Two-stage boss: head phase then heart phase
  let bossStage: 'head' | 'transition' | 'heart' = 'head';
  let headHP = BOSS_HEAD_HP;
  let heartHP = BOSS_HEART_HP;
  // Heart target position (moves inside torso)
  let heartY = 310; // starts at power core position
  let heartPhase = 0;
  // Barriers that protect the heart
  let barriers: { y: number; hp: number; maxHp: number }[] = [];
  let barrierRespawnTimer = 0;

  let projectiles: Projectile[] = [];
  let beams: Beam[] = [];
  let flyingBots: FlyingBot[] = [];
  let particles: Particle[] = [];

  let beamSpawnTimer = 2.0;
  let botSpawnTimer = 4.0;
  let animTime = 0;
  let elapsed = 0;
  let difficulty = 0; // 0-1, increases over time

  // Screen shake
  let screenShakeX = 0;
  let screenShakeY = 0;
  let screenShakeIntensity = 0;

  // Phase transition effects
  let phaseFlash = 0;
  let lastPhase = 1;

  let gameOver = false;
  let gameOverTimer = 0;
  let wonDialogActive = false;
  let wonDialogPage = 0;
  let wonDialogAlpha = 0;
  let wonDialogCooldown = 0;
  let showingCredits = false;
  let creditsTimer = 0;

  // Sonic Shell transition dialog
  let shellDialogActive = false;
  let shellDialogPage = 0;
  let shellDialogAlpha = 0;
  let shellDialogCooldown = 0;

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

    // Screen shake decay
    if (screenShakeIntensity > 0) {
      screenShakeX = (Math.random() - 0.5) * screenShakeIntensity;
      screenShakeY = (Math.random() - 0.5) * screenShakeIntensity;
      screenShakeIntensity *= 0.9;
      if (screenShakeIntensity < 0.3) screenShakeIntensity = 0;
    } else {
      screenShakeX = 0;
      screenShakeY = 0;
    }

    // Phase transition detection
    if (phaseFlash > 0) phaseFlash -= dt * 2;
    const currentPhase = bossStage === 'head' ? (headHP > BOSS_HEAD_HP * 0.5 ? 1 : 2) : 3;
    if (currentPhase !== lastPhase && bossPhase === 'fight') {
      lastPhase = currentPhase;
      phaseFlash = 1.0;
      screenShakeIntensity = 12;
      // Phase transition explosion particles
      for (let i = 0; i < 20; i++) {
        particles.push({
          x: BOSS_X + 90,
          y: HEIGHT / 2,
          vx: (Math.random() - 0.5) * 400,
          vy: (Math.random() - 0.5) * 400,
          life: 1.0,
          maxLife: 1.0,
          color: `hsl(${Math.random() * 60 + 300}, 100%, 60%)`,
        });
      }
    }

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

    // Sonic Shell transition dialog
    if (shellDialogActive) {
      shellDialogAlpha = Math.min(1, shellDialogAlpha + dt * 3);
      if (shellDialogCooldown > 0) shellDialogCooldown -= dt;
      if (shellDialogCooldown <= 0 && (keys[' '] || keys['enter'])) {
        keys[' '] = false;
        keys['enter'] = false;
        sfxMenuSelect();
        shellDialogPage++;
        shellDialogAlpha = 0;
        shellDialogCooldown = 0.3;
        if (shellDialogPage >= sonicShellDialog.length) {
          shellDialogActive = false;
          bossStage = 'heart';
          // Spawn initial barriers
          barriers = [
            { y: heartY - 40, hp: 3, maxHp: 3 },
            { y: heartY, hp: 3, maxHp: 3 },
            { y: heartY + 40, hp: 3, maxHp: 3 },
          ];
          barrierRespawnTimer = 8;
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
        headHP = BOSS_HEAD_HP;
        heartHP = BOSS_HEART_HP;
        bossStage = 'head';
        bossPhase = 'fight';
        bossDeathTimer = 0;
        projectiles = [];
        beams = [];
        flyingBots = [];
        particles = [];
        barriers = [];
        barrierRespawnTimer = 0;
        heartY = 310;
        heartPhase = 0;
        playerX = 100;
        playerY = HEIGHT / 2;
        gameOver = false;
        gameOverTimer = 0;
        elapsed = 0;
        difficulty = 0;
        beamSpawnTimer = 2.0;
        botSpawnTimer = 4.0;
        lastPhase = 1;
        startBossBGM();
      }
      return;
    }

    // Boss death sequence
    if (bossPhase === 'dying') {
      bossDeathTimer += dt;
      // Escalating explosions — more frequent and bigger over time
      const intensity = Math.min(1, bossDeathTimer / 2.5);
      const spawnRate = 0.2 + intensity * 0.6;
      if (Math.random() < spawnRate) {
        const cx = BOSS_X + Math.random() * 180 - 40;
        const cy = Math.random() * HEIGHT * 0.7 + 40;
        // Burst of particles at each explosion point
        const count = 3 + Math.floor(intensity * 5);
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 80 + Math.random() * 250;
          particles.push({
            x: cx + (Math.random() - 0.5) * 20,
            y: cy + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.5 + Math.random() * 0.6,
            maxLife: 1.1,
            color: `hsl(${Math.random() * 50 + 10}, 100%, ${50 + Math.random() * 30}%)`,
          });
        }
      }
      // Screen shake during death (increasing)
      screenShakeIntensity = 3 + intensity * 8;
      if (bossDeathTimer > 3) {
        bossPhase = 'dead';
        wonDialogActive = true;
        wonDialogPage = 0;
        wonDialogAlpha = 0;
        wonDialogCooldown = 0.5;
        stopBossBGM();
        screenShakeIntensity = 0;
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

      if (bossStage === 'head') {
        // Phase 1: Hit the head
        const headCX = BOSS_X + 90;
        const headCY = bossHeadY;
        const dist = Math.hypot(p.x - headCX, p.y - headCY);
        if (dist < BOSS_HEAD_RADIUS + 4) {
          p.life = 0;
          headHP--;
          bossHP--;
          bossHitFlash = 0.2;
          screenShakeIntensity = Math.max(screenShakeIntensity, 4);
          sfxBossHit();
          // Hit particles
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
            const speed = 150 + Math.random() * 250;
            particles.push({
              x: p.x, y: p.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 0.4 + Math.random() * 0.3,
              maxLife: 0.7,
              color: `hsl(${100 + Math.random() * 60}, 90%, ${50 + Math.random() * 30}%)`,
            });
          }
          if (headHP <= 0) {
            // Transition to heart phase
            bossStage = 'transition';
            shellDialogActive = true;
            shellDialogPage = 0;
            shellDialogAlpha = 0;
            shellDialogCooldown = 0.5;
            screenShakeIntensity = 15;
            phaseFlash = 1.5;
          }
        }
      } else if (bossStage === 'heart') {
        // Phase 2: Hit the heart (moving inside torso)
        // First check barriers
        let hitBarrier = false;
        for (const bar of barriers) {
          if (bar.hp <= 0) continue;
          // Barrier is a horizontal shield in front of the heart
          const barX = BOSS_X + 30;
          const barW = 40;
          const barH = 20;
          if (p.x >= barX && p.x <= barX + barW &&
              p.y >= bar.y - barH / 2 && p.y <= bar.y + barH / 2) {
            p.life = 0;
            bar.hp--;
            hitBarrier = true;
            screenShakeIntensity = Math.max(screenShakeIntensity, 2);
            // Barrier hit particles (purple/blue)
            for (let i = 0; i < 6; i++) {
              particles.push({
                x: p.x, y: p.y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.3 + Math.random() * 0.2,
                maxLife: 0.5,
                color: `hsl(${260 + Math.random() * 40}, 80%, ${50 + Math.random() * 30}%)`,
              });
            }
            break;
          }
        }
        if (!hitBarrier) {
          // Check heart hit
          const heartCX = BOSS_X + 90;
          const heartCY = heartY;
          const heartDist = Math.hypot(p.x - heartCX, p.y - heartCY);
          if (heartDist < 28) {
            p.life = 0;
            heartHP--;
            bossHP--;
            bossHitFlash = 0.2;
            screenShakeIntensity = Math.max(screenShakeIntensity, 5);
            sfxBossHit();
            // Hit particles (red/orange for heart)
            for (let i = 0; i < 12; i++) {
              const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
              const speed = 150 + Math.random() * 250;
              particles.push({
                x: p.x, y: p.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.7,
                color: `hsl(${Math.random() * 40}, 90%, ${50 + Math.random() * 30}%)`,
              });
            }
            if (heartHP <= 0) {
              bossPhase = 'dying';
              bossDeathTimer = 0;
              sfxBossDefeat();
            }
          }
        }
      }
    }
    projectiles = projectiles.filter(p => p.life > 0 && p.x < WIDTH + 20);

    // === HEART MOVEMENT (phase 2) ===
    if (bossStage === 'heart') {
      heartPhase += dt * (1.5 + difficulty * 1.0);
      heartY = 280 + Math.sin(heartPhase) * 80;
      heartY = Math.max(200, Math.min(400, heartY));
      // Update barrier positions to follow heart loosely
      if (barriers.length > 0) {
        barriers[0].y = heartY - 40 + Math.sin(heartPhase * 0.7) * 10;
        barriers[1].y = heartY + Math.sin(heartPhase * 0.5 + 1) * 15;
        barriers[2].y = heartY + 40 + Math.sin(heartPhase * 0.8 + 2) * 10;
      }
      // Respawn destroyed barriers periodically
      barrierRespawnTimer -= dt;
      if (barrierRespawnTimer <= 0) {
        for (const bar of barriers) {
          if (bar.hp <= 0) bar.hp = bar.maxHp;
        }
        barrierRespawnTimer = 10 - difficulty * 3;
      }
    }

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
          screenShakeIntensity = Math.max(screenShakeIntensity, 6);
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
      const speedMult = bossStage === 'heart' ? 1.2 : 1.0;
      const baseSpeed = -(BOT_SPEED + difficulty * 120 + Math.random() * 60) * speedMult;
      const baseY = 60 + Math.random() * (HEIGHT - 160);

      if (formationType < 0.15 || difficulty < 0.15) {
        // Single bot (early game / rare)
        flyingBots.push({
          x: WIDTH + 40,
          y: baseY,
          w: 28, h: 28,
          vx: baseSpeed,
          type: botType,
          alive: true,
        });
      } else if (formationType < 0.55) {
        // Sine wave formation (3-6 bots flowing in sine pattern)
        const count = 3 + Math.floor(difficulty * 3);
        for (let i = 0; i < count; i++) {
          flyingBots.push({
            x: WIDTH + 40 + i * 45,
            y: baseY + Math.sin(i * 1.0) * 60,
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
        // Tight horizontal wall of bots
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
      // Faster spawns in heart phase
      const stageMultiplier = bossStage === 'heart' ? 0.6 : 1.0;
      botSpawnTimer = ((1.8 - difficulty * 1.0) + Math.random() * 1.2) * stageMultiplier;
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
    // Apply screen shake
    ctx.save();
    ctx.translate(screenShakeX, screenShakeY);

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
        // Charging indicator: dramatic buildup
        const chargeProgress = 1 - beam.chargeTimer / BEAM_CHARGE_TIME;
        const flash = Math.sin(animTime * 20) * 0.5 + 0.5;
        // Warning zone (where beam will hit)
        ctx.fillStyle = `rgba(255, 0, 40, ${chargeProgress * 0.05})`;
        ctx.fillRect(0, beam.y - beam.width / 2, BOSS_X - 20, beam.width);
        // Charging line
        ctx.strokeStyle = `rgba(255, 0, 60, ${chargeProgress * flash * 0.9})`;
        ctx.lineWidth = 1 + chargeProgress * 2;
        ctx.setLineDash([6 - chargeProgress * 4, 6 + chargeProgress * 2]);
        ctx.beginPath();
        ctx.moveTo(BOSS_X - 20, beam.y);
        ctx.lineTo(0, beam.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Charge buildup at emitter
        const chargeGlow = ctx.createRadialGradient(BOSS_X - 25, beam.y, 0, BOSS_X - 25, beam.y, 20 * chargeProgress);
        chargeGlow.addColorStop(0, `rgba(255, 100, 50, ${chargeProgress * 0.8})`);
        chargeGlow.addColorStop(0.5, `rgba(255, 0, 50, ${chargeProgress * 0.4})`);
        chargeGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = chargeGlow;
        ctx.beginPath();
        ctx.arc(BOSS_X - 25, beam.y, 20 * chargeProgress, 0, Math.PI * 2);
        ctx.fill();
        // Warning icons (pulsing)
        ctx.fillStyle = `rgba(255, 200, 0, ${chargeProgress * flash})`;
        ctx.font = `${12 + chargeProgress * 6}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText('⚠', BOSS_X - 35, beam.y + 6);
        ctx.textAlign = 'left';
      } else if (beam.active) {
        // Active beam: massive energy discharge
        const beamAlpha = Math.min(1, beam.duration / 0.3);
        // Outer glow (wide, faint)
        const outerGrad = ctx.createLinearGradient(0, beam.y - beam.width, 0, beam.y + beam.width);
        outerGrad.addColorStop(0, `rgba(255, 0, 40, 0)`);
        outerGrad.addColorStop(0.3, `rgba(255, 20, 60, ${0.15 * beamAlpha})`);
        outerGrad.addColorStop(0.5, `rgba(255, 50, 80, ${0.25 * beamAlpha})`);
        outerGrad.addColorStop(0.7, `rgba(255, 20, 60, ${0.15 * beamAlpha})`);
        outerGrad.addColorStop(1, `rgba(255, 0, 40, 0)`);
        ctx.fillStyle = outerGrad;
        ctx.fillRect(0, beam.y - beam.width, BOSS_X - 10, beam.width * 2);
        // Main beam core
        const coreGrad = ctx.createLinearGradient(0, beam.y - beam.width / 2, 0, beam.y + beam.width / 2);
        coreGrad.addColorStop(0, `rgba(255, 0, 60, 0)`);
        coreGrad.addColorStop(0.2, `rgba(255, 40, 80, ${0.7 * beamAlpha})`);
        coreGrad.addColorStop(0.4, `rgba(255, 150, 150, ${0.9 * beamAlpha})`);
        coreGrad.addColorStop(0.5, `rgba(255, 255, 255, ${beamAlpha})`);
        coreGrad.addColorStop(0.6, `rgba(255, 150, 150, ${0.9 * beamAlpha})`);
        coreGrad.addColorStop(0.8, `rgba(255, 40, 80, ${0.7 * beamAlpha})`);
        coreGrad.addColorStop(1, `rgba(255, 0, 60, 0)`);
        ctx.fillStyle = coreGrad;
        ctx.fillRect(0, beam.y - beam.width / 2, BOSS_X - 10, beam.width);
        // Crackling edges (more chaotic)
        ctx.strokeStyle = `rgba(255, 220, 100, ${0.6 * beamAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let bx2 = 0; bx2 < BOSS_X - 10; bx2 += 8) {
          ctx.lineTo(bx2, beam.y - beam.width / 2 + (Math.random() - 0.3) * 6);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let bx2 = 0; bx2 < BOSS_X - 10; bx2 += 8) {
          ctx.lineTo(bx2, beam.y + beam.width / 2 - (Math.random() - 0.3) * 6);
        }
        ctx.stroke();
        // Interior energy streaks
        ctx.strokeStyle = `rgba(255, 255, 200, ${0.4 * beamAlpha})`;
        ctx.lineWidth = 1;
        for (let s = 0; s < 3; s++) {
          ctx.beginPath();
          const yOff = (Math.random() - 0.5) * beam.width * 0.5;
          for (let bx2 = 0; bx2 < BOSS_X - 10; bx2 += 15) {
            ctx.lineTo(bx2, beam.y + yOff + Math.sin(bx2 * 0.1 + animTime * 10 + s) * 3);
          }
          ctx.stroke();
        }
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
      // Green sig bullet with glow trail
      const trail = p.life < 1.8 ? 1 : 0.6;
      // Trail
      ctx.fillStyle = `rgba(0, 255, 80, ${trail * 0.3})`;
      ctx.fillRect(p.x - 12, p.y + 1, 12, 2);
      ctx.fillStyle = `rgba(0, 200, 60, ${trail * 0.15})`;
      ctx.fillRect(p.x - 24, p.y + 1.5, 12, 1);
      // Core bullet
      ctx.fillStyle = `rgba(0, 255, 100, ${trail})`;
      ctx.fillRect(p.x, p.y, 12, 4);
      ctx.fillStyle = '#ccffcc';
      ctx.fillRect(p.x + 8, p.y + 1, 4, 2);
      // Glow
      const bulletGlow = ctx.createRadialGradient(p.x + 6, p.y + 2, 0, p.x + 6, p.y + 2, 10);
      bulletGlow.addColorStop(0, `rgba(0, 255, 100, ${0.4 * trail})`);
      bulletGlow.addColorStop(1, 'rgba(0, 255, 100, 0)');
      ctx.fillStyle = bulletGlow;
      ctx.beginPath();
      ctx.arc(p.x + 6, p.y + 2, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // === DRAW PLAYER (Sonia in jetpack) ===
    drawPlayer(ctx);

    // === PARTICLES (improved rendering) ===
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      // Larger particles fade to smaller
      const size = 2 + alpha * 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      // Bright core
      if (alpha > 0.5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
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
    if (shellDialogActive) {
      drawDialog(ctx, sonicShellDialog[shellDialogPage], shellDialogAlpha);
    }

    // === GAME OVER ===
    if (gameOver) {
      const fadeIn = Math.min(1, gameOverTimer * 0.6);
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeIn * 0.75})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Static noise overlay
      ctx.globalAlpha = fadeIn * 0.08;
      for (let i = 0; i < 200; i++) {
        const nx = Math.random() * WIDTH;
        const ny = Math.random() * HEIGHT;
        const grey = Math.random() * 255;
        ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
        ctx.fillRect(nx, ny, 2 + Math.random() * 3, 1);
      }
      ctx.globalAlpha = 1;
      // Glitch text effect
      const glitchX = Math.random() < 0.1 ? (Math.random() - 0.5) * 6 : 0;
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SIGNAL LOST', WIDTH / 2 + glitchX, HEIGHT / 2 - 20);
      // Red chromatic aberration
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillText('SIGNAL LOST', WIDTH / 2 + glitchX + 2, HEIGHT / 2 - 21);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.2)';
      ctx.fillText('SIGNAL LOST', WIDTH / 2 + glitchX - 2, HEIGHT / 2 - 19);
      // Subtitle
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '14px monospace';
      ctx.fillText('The static overwhelmed your systems', WIDTH / 2, HEIGHT / 2 + 20);
      // Scan lines
      ctx.globalAlpha = fadeIn * 0.04;
      for (let sy = 0; sy < HEIGHT; sy += 3) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, sy, WIDTH, 1);
      }
      ctx.globalAlpha = 1;
      if (gameOverTimer > 1.5) {
        const blink = Math.sin(animTime * 3) > 0;
        if (blink) {
          ctx.fillStyle = '#00ff00';
          ctx.font = '14px monospace';
          ctx.fillText('SPACE to retry', WIDTH / 2, HEIGHT / 2 + 60);
        }
      }
      ctx.textAlign = 'left';
    }

    // === CREDITS ===
    if (showingCredits) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Floating particles (freed sound waves)
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 30; i++) {
        const px = (i * 53 + animTime * 20 * (1 + (i % 3) * 0.3)) % WIDTH;
        const py = HEIGHT - ((animTime * 30 + i * 40) % (HEIGHT + 50));
        const hue = 100 + (i * 17) % 80;
        ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

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

    // Phase transition flash overlay
    if (phaseFlash > 0) {
      ctx.fillStyle = `rgba(255, 100, 200, ${phaseFlash * 0.3})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Restore screen shake transform
    ctx.restore();
  };

  const drawBoss = (ctx: CanvasRenderingContext2D) => {
    if (bossPhase === 'dead') return;

    const bx = BOSS_X;
    const shake = bossPhase === 'dying' ? (Math.random() - 0.5) * 10 : 0;

    ctx.save();
    ctx.translate(shake, shake * 0.5);

    // === MASSIVE ENERGY AURA ===
    if (bossPhase === 'fight') {
      const auraAlpha = 0.1 + Math.sin(animTime * 2) * 0.04;
      const auraGrad = ctx.createRadialGradient(bx + 90, 300, 30, bx + 90, 300, 300);
      auraGrad.addColorStop(0, `rgba(255, 20, 60, ${auraAlpha * 1.5})`);
      auraGrad.addColorStop(0.3, `rgba(180, 0, 80, ${auraAlpha})`);
      auraGrad.addColorStop(0.7, `rgba(80, 0, 60, ${auraAlpha * 0.4})`);
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.fillRect(bx - 120, 20, 420, 530);
    }

    // === LEGS (massive, armoured, with thrusters) ===
    // Left leg
    const legGrad1 = ctx.createLinearGradient(bx + 15, 0, bx + 65, 0);
    legGrad1.addColorStop(0, '#0d0d1a');
    legGrad1.addColorStop(0.3, '#2a2a4a');
    legGrad1.addColorStop(0.7, '#1a1a3a');
    legGrad1.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = legGrad1;
    ctx.fillRect(bx + 15, HEIGHT - 140, 50, 140);
    // Right leg
    ctx.fillRect(bx + 95, HEIGHT - 140, 50, 140);

    // Leg armour panels (beveled)
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx + 18, HEIGHT - 130, 44, 25);
    ctx.fillRect(bx + 98, HEIGHT - 130, 44, 25);
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(bx + 20, HEIGHT - 128, 40, 5); // highlight edge
    ctx.fillRect(bx + 100, HEIGHT - 128, 40, 5);

    // Hydraulic pistons (chrome)
    const pistonShine = 0.6 + Math.sin(animTime * 3) * 0.2;
    ctx.fillStyle = `rgba(140, 140, 180, ${pistonShine})`;
    ctx.fillRect(bx + 28, HEIGHT - 100, 6, 55);
    ctx.fillRect(bx + 46, HEIGHT - 100, 6, 55);
    ctx.fillRect(bx + 108, HEIGHT - 100, 6, 55);
    ctx.fillRect(bx + 126, HEIGHT - 100, 6, 55);
    // Piston caps
    ctx.fillStyle = '#5a5a8a';
    ctx.fillRect(bx + 26, HEIGHT - 102, 10, 6);
    ctx.fillRect(bx + 44, HEIGHT - 102, 10, 6);
    ctx.fillRect(bx + 106, HEIGHT - 102, 10, 6);
    ctx.fillRect(bx + 124, HEIGHT - 102, 10, 6);

    // Knee joints (large, glowing)
    ctx.fillStyle = '#1a1a2a';
    ctx.beginPath();
    ctx.arc(bx + 40, HEIGHT - 135, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 120, HEIGHT - 135, 12, 0, Math.PI * 2);
    ctx.fill();
    const kneeGlow = 0.5 + Math.sin(animTime * 5) * 0.3;
    ctx.fillStyle = `rgba(255, 40, 80, ${kneeGlow})`;
    ctx.beginPath();
    ctx.arc(bx + 40, HEIGHT - 135, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 120, HEIGHT - 135, 6, 0, Math.PI * 2);
    ctx.fill();

    // Feet (heavy, anchored)
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(bx + 5, HEIGHT - 12, 70, 12);
    ctx.fillRect(bx + 85, HEIGHT - 12, 70, 12);
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx + 8, HEIGHT - 14, 64, 6);
    ctx.fillRect(bx + 88, HEIGHT - 14, 64, 6);
    // Foot thrusters (ground glow)
    const thrustGlow = 0.3 + Math.sin(animTime * 6) * 0.15;
    const thrustGrad = ctx.createRadialGradient(bx + 40, HEIGHT, 0, bx + 40, HEIGHT, 25);
    thrustGrad.addColorStop(0, `rgba(255, 100, 50, ${thrustGlow})`);
    thrustGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = thrustGrad;
    ctx.fillRect(bx + 15, HEIGHT - 8, 50, 16);
    const thrustGrad2 = ctx.createRadialGradient(bx + 120, HEIGHT, 0, bx + 120, HEIGHT, 25);
    thrustGrad2.addColorStop(0, `rgba(255, 100, 50, ${thrustGlow})`);
    thrustGrad2.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = thrustGrad2;
    ctx.fillRect(bx + 95, HEIGHT - 8, 50, 16);

    // === TORSO (massive, heavily armoured) ===
    // Main torso shape - tapered trapezoid
    const torsoTop = 160;
    const torsoBot = 420;
    const torsoGrad = ctx.createLinearGradient(bx - 10, torsoTop, bx + 190, torsoBot);
    torsoGrad.addColorStop(0, '#10101a');
    torsoGrad.addColorStop(0.15, '#1a1a3a');
    torsoGrad.addColorStop(0.4, '#2a2a5a');
    torsoGrad.addColorStop(0.6, '#252550');
    torsoGrad.addColorStop(0.85, '#1a1a3a');
    torsoGrad.addColorStop(1, '#10101a');
    ctx.fillStyle = torsoGrad;
    ctx.beginPath();
    ctx.moveTo(bx + 5, torsoTop + 30);
    ctx.lineTo(bx + 175, torsoTop + 30);
    ctx.lineTo(bx + 185, torsoBot);
    ctx.lineTo(bx - 5, torsoBot);
    ctx.closePath();
    ctx.fill();

    // Torso edge highlight (3D bevel)
    ctx.strokeStyle = 'rgba(100, 100, 160, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 5, torsoTop + 30);
    ctx.lineTo(bx + 175, torsoTop + 30);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40, 40, 80, 0.6)';
    ctx.beginPath();
    ctx.moveTo(bx + 185, torsoBot);
    ctx.lineTo(bx - 5, torsoBot);
    ctx.stroke();

    // Chest plate (upper section, recessed)
    ctx.fillStyle = '#151530';
    ctx.fillRect(bx + 20, torsoTop + 45, 140, 80);
    ctx.strokeStyle = '#3a3a6a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 20, torsoTop + 45, 140, 80);
    // Chest detail lines (hex-panel look)
    ctx.strokeStyle = 'rgba(80, 80, 140, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 90, torsoTop + 45);
    ctx.lineTo(bx + 90, torsoTop + 125);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 20, torsoTop + 85);
    ctx.lineTo(bx + 160, torsoTop + 85);
    ctx.stroke();

    // === MASSIVE POWER CORE (center of torso) ===
    const coreY = 310;
    const corePulse = 0.6 + Math.sin(animTime * 3) * 0.3;
    // Outer housing
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.arc(bx + 90, coreY, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3a6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx + 90, coreY, 38, 0, Math.PI * 2);
    ctx.stroke();
    // Spinning ring
    ctx.strokeStyle = `rgba(255, 80, 150, ${corePulse * 0.7})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx + 90, coreY, 32, animTime * 2, animTime * 2 + Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx + 90, coreY, 32, animTime * 2 + Math.PI, animTime * 2 + Math.PI * 2.2);
    ctx.stroke();
    // Inner core (bright!)
    const innerCoreGrad = ctx.createRadialGradient(bx + 90, coreY, 0, bx + 90, coreY, 25);
    innerCoreGrad.addColorStop(0, `rgba(255, 220, 255, ${corePulse})`);
    innerCoreGrad.addColorStop(0.3, `rgba(255, 50, 120, ${corePulse * 0.9})`);
    innerCoreGrad.addColorStop(0.6, `rgba(200, 0, 80, ${corePulse * 0.6})`);
    innerCoreGrad.addColorStop(1, 'rgba(100, 0, 40, 0)');
    ctx.fillStyle = innerCoreGrad;
    ctx.beginPath();
    ctx.arc(bx + 90, coreY, 25, 0, Math.PI * 2);
    ctx.fill();
    // Core center pip
    ctx.fillStyle = `rgba(255, 255, 255, ${corePulse})`;
    ctx.beginPath();
    ctx.arc(bx + 90, coreY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Energy conduits from core (to arms, head, legs)
    const conduitAlpha = 0.4 + Math.sin(animTime * 5) * 0.2;
    ctx.strokeStyle = `rgba(255, 60, 100, ${conduitAlpha})`;
    ctx.lineWidth = 2.5;
    // To left arm
    ctx.beginPath();
    ctx.moveTo(bx + 55, coreY);
    ctx.quadraticCurveTo(bx + 10, coreY - 30, bx - 20, 240);
    ctx.stroke();
    // To right arm
    ctx.beginPath();
    ctx.moveTo(bx + 125, coreY);
    ctx.quadraticCurveTo(bx + 170, coreY - 30, bx + 200, 240);
    ctx.stroke();
    // To head
    ctx.beginPath();
    ctx.moveTo(bx + 90, coreY - 38);
    ctx.lineTo(bx + 90, torsoTop + 35);
    ctx.stroke();
    // To legs
    ctx.strokeStyle = `rgba(255, 60, 100, ${conduitAlpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 70, coreY + 38);
    ctx.lineTo(bx + 40, torsoBot + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 110, coreY + 38);
    ctx.lineTo(bx + 120, torsoBot + 10);
    ctx.stroke();

    // Animated energy pulses along conduits
    const pulsePos = (animTime * 2) % 1;
    ctx.fillStyle = `rgba(255, 200, 255, ${0.6})`;
    ctx.beginPath();
    ctx.arc(bx + 55 - pulsePos * 75, coreY - pulsePos * 30 - (1 - pulsePos) * 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 125 + pulsePos * 75, coreY - pulsePos * 30 - (1 - pulsePos) * 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Belly plate (below core)
    ctx.fillStyle = '#151530';
    ctx.fillRect(bx + 25, coreY + 45, 130, 65);
    ctx.strokeStyle = '#3a3a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 25, coreY + 45, 130, 65);
    // Vent slats on belly
    ctx.fillStyle = `rgba(255, 40, 60, ${0.25 + Math.sin(animTime * 4) * 0.15})`;
    for (let v = 0; v < 5; v++) {
      ctx.fillRect(bx + 35, coreY + 52 + v * 12, 110, 4);
    }

    // === ARMS (massive beam cannons) ===
    // Left arm
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(bx - 55, 215, 65, 30);
    // Arm armour
    const armGradL = ctx.createLinearGradient(bx - 55, 215, bx - 55, 245);
    armGradL.addColorStop(0, '#3a3a5a');
    armGradL.addColorStop(0.5, '#2a2a4a');
    armGradL.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = armGradL;
    ctx.fillRect(bx - 50, 218, 55, 24);
    // Cannon barrel
    ctx.fillStyle = '#222240';
    ctx.fillRect(bx - 70, 224, 20, 12);
    ctx.fillStyle = '#1a1a30';
    ctx.fillRect(bx - 75, 226, 8, 8);
    // Emitter glow
    const emitGlow = 0.5 + Math.sin(animTime * 7) * 0.3;
    ctx.fillStyle = `rgba(255, 60, 30, ${emitGlow})`;
    ctx.beginPath();
    ctx.arc(bx - 75, 230, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 150, 50, ${emitGlow * 0.4})`;
    ctx.beginPath();
    ctx.arc(bx - 75, 230, 10, 0, Math.PI * 2);
    ctx.fill();

    // Right arm
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(bx + 170, 215, 65, 30);
    const armGradR = ctx.createLinearGradient(bx + 170, 215, bx + 170, 245);
    armGradR.addColorStop(0, '#3a3a5a');
    armGradR.addColorStop(0.5, '#2a2a4a');
    armGradR.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = armGradR;
    ctx.fillRect(bx + 175, 218, 55, 24);
    // Cannon barrel
    ctx.fillStyle = '#222240';
    ctx.fillRect(bx + 230, 224, 20, 12);
    ctx.fillStyle = '#1a1a30';
    ctx.fillRect(bx + 247, 226, 8, 8);
    // Emitter glow
    ctx.fillStyle = `rgba(255, 60, 30, ${emitGlow})`;
    ctx.beginPath();
    ctx.arc(bx + 255, 230, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 150, 50, ${emitGlow * 0.4})`;
    ctx.beginPath();
    ctx.arc(bx + 255, 230, 10, 0, Math.PI * 2);
    ctx.fill();

    // === SHOULDER PAULDRONS (massive, layered) ===
    // Left shoulder
    ctx.fillStyle = '#2a2a4a';
    ctx.beginPath();
    ctx.ellipse(bx + 5, torsoTop + 50, 35, 22, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3a6a';
    ctx.beginPath();
    ctx.ellipse(bx + 5, torsoTop + 48, 28, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Shoulder orb
    const orbPulse = 0.4 + Math.sin(animTime * 4 + 1) * 0.3;
    ctx.fillStyle = `rgba(200, 50, 150, ${orbPulse})`;
    ctx.beginPath();
    ctx.arc(bx + 5, torsoTop + 48, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 150, 220, ${orbPulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(bx + 5, torsoTop + 46, 3, 0, Math.PI * 2);
    ctx.fill();
    // Spike
    ctx.fillStyle = '#4a4a8a';
    ctx.beginPath();
    ctx.moveTo(bx - 10, torsoTop + 45);
    ctx.lineTo(bx - 25, torsoTop + 20);
    ctx.lineTo(bx, torsoTop + 40);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - 5, torsoTop + 35);
    ctx.lineTo(bx - 15, torsoTop + 5);
    ctx.lineTo(bx + 5, torsoTop + 32);
    ctx.closePath();
    ctx.fill();

    // Right shoulder
    ctx.fillStyle = '#2a2a4a';
    ctx.beginPath();
    ctx.ellipse(bx + 175, torsoTop + 50, 35, 22, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3a6a';
    ctx.beginPath();
    ctx.ellipse(bx + 175, torsoTop + 48, 28, 16, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Shoulder orb
    ctx.fillStyle = `rgba(200, 50, 150, ${orbPulse})`;
    ctx.beginPath();
    ctx.arc(bx + 175, torsoTop + 48, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 150, 220, ${orbPulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(bx + 175, torsoTop + 46, 3, 0, Math.PI * 2);
    ctx.fill();
    // Spike
    ctx.fillStyle = '#4a4a8a';
    ctx.beginPath();
    ctx.moveTo(bx + 190, torsoTop + 45);
    ctx.lineTo(bx + 205, torsoTop + 20);
    ctx.lineTo(bx + 180, torsoTop + 40);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 185, torsoTop + 35);
    ctx.lineTo(bx + 195, torsoTop + 5);
    ctx.lineTo(bx + 175, torsoTop + 32);
    ctx.closePath();
    ctx.fill();

    // === NECK (armoured, segmented) ===
    const headY = bossHeadY;
    const neckTop = Math.min(headY + BOSS_HEAD_RADIUS + 5, torsoTop + 30);
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(bx + 60, neckTop, 60, torsoTop + 30 - neckTop + 10);
    // Neck segments
    ctx.strokeStyle = '#3a3a5a';
    ctx.lineWidth = 1;
    for (let ny = neckTop + 5; ny < torsoTop + 35; ny += 8) {
      ctx.beginPath();
      ctx.moveTo(bx + 62, ny);
      ctx.lineTo(bx + 118, ny);
      ctx.stroke();
    }
    // Neck energy line
    ctx.strokeStyle = `rgba(255, 60, 100, ${conduitAlpha * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 90, neckTop);
    ctx.lineTo(bx + 90, torsoTop + 35);
    ctx.stroke();

    // === COCKPIT / HEAD (Count Crosstalk's command pod) ===
    const headFlash = bossHitFlash > 0;

    // Head danger glow (only in head phase)
    if (bossPhase === 'fight' && bossStage === 'head') {
      const headGlowR = BOSS_HEAD_RADIUS + 18 + Math.sin(animTime * 3) * 5;
      const headGlowGrad = ctx.createRadialGradient(bx + 90, headY, BOSS_HEAD_RADIUS, bx + 90, headY, headGlowR);
      headGlowGrad.addColorStop(0, 'rgba(255, 0, 60, 0)');
      headGlowGrad.addColorStop(0.5, `rgba(255, 0, 60, ${0.08 + Math.sin(animTime * 4) * 0.04})`);
      headGlowGrad.addColorStop(1, 'rgba(255, 0, 60, 0)');
      ctx.fillStyle = headGlowGrad;
      ctx.beginPath();
      ctx.arc(bx + 90, headY, headGlowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer head shell
    ctx.fillStyle = headFlash ? '#ffffff' : '#1a1030';
    ctx.beginPath();
    ctx.arc(bx + 90, headY, BOSS_HEAD_RADIUS + 8, 0, Math.PI * 2);
    ctx.fill();
    // Armour ring
    ctx.strokeStyle = headFlash ? '#ffff00' : '#5a3a7a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bx + 90, headY, BOSS_HEAD_RADIUS + 8, 0, Math.PI * 2);
    ctx.stroke();
    // Inner shell
    ctx.fillStyle = headFlash ? '#ffffaa' : '#2a1a3a';
    ctx.beginPath();
    ctx.arc(bx + 90, headY, BOSS_HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = headFlash ? '#ffcc00' : '#6a4a8a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx + 90, headY, BOSS_HEAD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Visor (cockpit glass — wide, angular)
    const visorGrad = ctx.createLinearGradient(bx + 68, headY - 12, bx + 112, headY + 12);
    if (headFlash) {
      visorGrad.addColorStop(0, 'rgba(255, 255, 100, 0.9)');
      visorGrad.addColorStop(1, 'rgba(255, 200, 0, 0.8)');
    } else {
      visorGrad.addColorStop(0, 'rgba(180, 0, 40, 0.7)');
      visorGrad.addColorStop(0.5, 'rgba(255, 20, 60, 0.8)');
      visorGrad.addColorStop(1, 'rgba(120, 0, 30, 0.6)');
    }
    ctx.fillStyle = visorGrad;
    ctx.beginPath();
    ctx.ellipse(bx + 90, headY, 26, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Visor edge
    ctx.strokeStyle = headFlash ? '#ffffff' : '#8a4a6a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(bx + 90, headY, 26, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Visor reflection (shine)
    ctx.fillStyle = 'rgba(255, 200, 220, 0.2)';
    ctx.beginPath();
    ctx.ellipse(bx + 82, headY - 6, 10, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Count Crosstalk's EYES (menacing, glowing)
    const eyeGlow = 0.8 + Math.sin(animTime * 6) * 0.2;
    // Eye sockets
    ctx.fillStyle = '#1a0000';
    ctx.beginPath();
    ctx.ellipse(bx + 80, headY - 2, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 100, headY - 2, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris glow
    ctx.fillStyle = `rgba(255, 0, 0, ${eyeGlow})`;
    ctx.beginPath();
    ctx.ellipse(bx + 80, headY - 2, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 100, headY - 2, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bright center
    ctx.fillStyle = `rgba(255, 200, 0, ${eyeGlow})`;
    ctx.beginPath();
    ctx.ellipse(bx + 80, headY - 2, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 100, headY - 2, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye glow bleed
    ctx.fillStyle = `rgba(255, 0, 0, ${eyeGlow * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(bx + 80, headY - 2, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 100, headY - 2, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Angry brow plates
    ctx.fillStyle = '#3a1a2a';
    ctx.beginPath();
    ctx.moveTo(bx + 70, headY - 12);
    ctx.lineTo(bx + 82, headY - 8);
    ctx.lineTo(bx + 82, headY - 10);
    ctx.lineTo(bx + 70, headY - 15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 110, headY - 12);
    ctx.lineTo(bx + 98, headY - 8);
    ctx.lineTo(bx + 98, headY - 10);
    ctx.lineTo(bx + 110, headY - 15);
    ctx.closePath();
    ctx.fill();

    // Crown / horns (dramatic, multi-layered)
    const hornBase = headY - BOSS_HEAD_RADIUS - 6;
    // Left horn
    ctx.fillStyle = '#cc2244';
    ctx.beginPath();
    ctx.moveTo(bx + 68, hornBase + 4);
    ctx.lineTo(bx + 60, hornBase - 30);
    ctx.lineTo(bx + 56, hornBase - 28);
    ctx.lineTo(bx + 62, hornBase + 6);
    ctx.closePath();
    ctx.fill();
    // Right horn
    ctx.beginPath();
    ctx.moveTo(bx + 112, hornBase + 4);
    ctx.lineTo(bx + 120, hornBase - 30);
    ctx.lineTo(bx + 124, hornBase - 28);
    ctx.lineTo(bx + 118, hornBase + 6);
    ctx.closePath();
    ctx.fill();
    // Center horn (tallest)
    ctx.fillStyle = '#ff3355';
    ctx.beginPath();
    ctx.moveTo(bx + 85, hornBase + 2);
    ctx.lineTo(bx + 90, hornBase - 38);
    ctx.lineTo(bx + 95, hornBase + 2);
    ctx.closePath();
    ctx.fill();
    // Horn tips glow
    ctx.fillStyle = `rgba(255, 100, 100, ${0.5 + Math.sin(animTime * 5) * 0.3})`;
    ctx.beginPath();
    ctx.arc(bx + 60, hornBase - 30, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 120, hornBase - 30, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 90, hornBase - 38, 4, 0, Math.PI * 2);
    ctx.fill();

    // === SONIC SHELL (phase 2 — head shield) ===
    if (bossStage === 'heart' || bossStage === 'transition') {
      const shellPulse = 0.4 + Math.sin(animTime * 4) * 0.2;
      const shellR = BOSS_HEAD_RADIUS + 16;
      // Outer resonant shell (hexagonal energy field)
      ctx.strokeStyle = `rgba(0, 200, 255, ${shellPulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + animTime * 0.5;
        const hx = bx + 90 + Math.cos(angle) * shellR;
        const hy = headY + Math.sin(angle) * shellR;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner shell glow
      const shellGlow = ctx.createRadialGradient(bx + 90, headY, BOSS_HEAD_RADIUS, bx + 90, headY, shellR + 5);
      shellGlow.addColorStop(0, 'rgba(0, 200, 255, 0)');
      shellGlow.addColorStop(0.7, `rgba(0, 150, 255, ${shellPulse * 0.15})`);
      shellGlow.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.fillStyle = shellGlow;
      ctx.beginPath();
      ctx.arc(bx + 90, headY, shellR + 5, 0, Math.PI * 2);
      ctx.fill();
      // "SONIC SHELL" label
      ctx.fillStyle = `rgba(0, 200, 255, ${shellPulse * 0.7})`;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SONIC SHELL', bx + 90, headY + BOSS_HEAD_RADIUS + 22);
      ctx.textAlign = 'left';
    }

    // === HEART TARGET (phase 2 — exposed power core) ===
    if (bossStage === 'heart') {
      const hCX = bx + 90;
      const hCY = heartY;
      const heartPulse = 0.7 + Math.sin(animTime * 5) * 0.3;
      // Heart target glow (pulsing, bright, indicating vulnerability)
      const heartGlow = ctx.createRadialGradient(hCX, hCY, 0, hCX, hCY, 35);
      heartGlow.addColorStop(0, `rgba(255, 50, 100, ${heartPulse * 0.6})`);
      heartGlow.addColorStop(0.4, `rgba(255, 0, 60, ${heartPulse * 0.3})`);
      heartGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = heartGlow;
      ctx.beginPath();
      ctx.arc(hCX, hCY, 35, 0, Math.PI * 2);
      ctx.fill();
      // Heart core (bright target)
      const heartCoreGrad = ctx.createRadialGradient(hCX, hCY, 0, hCX, hCY, 20);
      heartCoreGrad.addColorStop(0, `rgba(255, 255, 200, ${heartPulse})`);
      heartCoreGrad.addColorStop(0.3, `rgba(255, 80, 120, ${heartPulse * 0.9})`);
      heartCoreGrad.addColorStop(0.7, `rgba(200, 0, 60, ${heartPulse * 0.6})`);
      heartCoreGrad.addColorStop(1, 'rgba(100, 0, 30, 0)');
      ctx.fillStyle = heartCoreGrad;
      ctx.beginPath();
      ctx.arc(hCX, hCY, 20, 0, Math.PI * 2);
      ctx.fill();
      // Spinning ring around heart
      ctx.strokeStyle = `rgba(255, 100, 150, ${heartPulse * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hCX, hCY, 24, animTime * 3, animTime * 3 + Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hCX, hCY, 24, animTime * 3 + Math.PI, animTime * 3 + Math.PI * 2);
      ctx.stroke();
      // Target crosshair hint
      ctx.strokeStyle = `rgba(255, 200, 100, ${0.3 + Math.sin(animTime * 2) * 0.1})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hCX - 28, hCY); ctx.lineTo(hCX - 18, hCY);
      ctx.moveTo(hCX + 18, hCY); ctx.lineTo(hCX + 28, hCY);
      ctx.moveTo(hCX, hCY - 28); ctx.lineTo(hCX, hCY - 18);
      ctx.moveTo(hCX, hCY + 18); ctx.lineTo(hCX, hCY + 28);
      ctx.stroke();

      // === BARRIERS (energy shields protecting heart) ===
      for (const bar of barriers) {
        if (bar.hp <= 0) continue;
        const barX = bx + 30;
        const barAlpha = bar.hp / bar.maxHp;
        const barPulse = 0.5 + Math.sin(animTime * 4 + bar.y * 0.05) * 0.2;
        // Shield plate
        ctx.fillStyle = `rgba(100, 50, 200, ${barAlpha * barPulse * 0.6})`;
        ctx.beginPath();
        ctx.roundRect(barX, bar.y - 10, 40, 20, 4);
        ctx.fill();
        // Shield edge glow
        ctx.strokeStyle = `rgba(150, 100, 255, ${barAlpha * barPulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(barX, bar.y - 10, 40, 20, 4);
        ctx.stroke();
        // Energy pattern inside
        ctx.strokeStyle = `rgba(200, 150, 255, ${barAlpha * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(barX + 5, bar.y);
        ctx.lineTo(barX + 15, bar.y - 5);
        ctx.lineTo(barX + 25, bar.y);
        ctx.lineTo(barX + 35, bar.y + 5);
        ctx.stroke();
      }
    }

    // === HP BAR (dramatic, above boss — two-phase) ===
    const hpBarW = 170;
    const hpBarH = 14;
    const hpBarX = bx + 5;
    const hpBarY = 30;
    // Background
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(hpBarX - 3, hpBarY - 3, hpBarW + 6, hpBarH + 6);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    // HP fill — show active phase HP
    const activeHP = bossStage === 'head' ? headHP : heartHP;
    const activeMaxHP = bossStage === 'head' ? BOSS_HEAD_HP : BOSS_HEART_HP;
    const hpRatio = Math.max(0, activeHP / activeMaxHP);
    const hpColor = bossStage === 'head'
      ? (hpRatio > 0.5 ? '#ff2244' : hpRatio > 0.25 ? '#ff8800' : '#ffcc00')
      : (hpRatio > 0.5 ? '#cc00ff' : hpRatio > 0.25 ? '#ff00aa' : '#ff6600');
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpBarX + 1, hpBarY + 1, (hpBarW - 2) * hpRatio, hpBarH - 2);
    // Shimmer on HP
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + Math.sin(animTime * 6) * 0.08})`;
    ctx.fillRect(hpBarX + 1, hpBarY + 1, (hpBarW - 2) * hpRatio, (hpBarH - 2) / 2);
    // Phase divider (midpoint marker)
    ctx.fillStyle = '#aaa';
    ctx.fillRect(hpBarX + hpBarW / 2, hpBarY, 1, hpBarH);
    // Border
    ctx.strokeStyle = '#5a3a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);
    // Name + stage indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const stageLabel = bossStage === 'head' ? '☠ COCKPIT' : '♥ POWER CORE';
    ctx.fillText(stageLabel, hpBarX + hpBarW / 2, hpBarY - 6);
    ctx.textAlign = 'left';

    // === AMBIENT EFFECTS ===
    if (bossPhase === 'fight') {
      // Static electricity arcing across the mech
      ctx.strokeStyle = `rgba(255, 50, 100, ${0.25 + Math.sin(animTime * 5) * 0.15})`;
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 6; s++) {
        const sx2 = bx + 10 + Math.random() * 160;
        const sy2 = torsoTop + 50 + Math.random() * 200;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 + (Math.random() - 0.5) * 25, sy2 + (Math.random() - 0.5) * 25);
        ctx.lineTo(sx2 + (Math.random() - 0.5) * 20, sy2 + (Math.random() - 0.5) * 35);
        ctx.stroke();
      }
      // Shoulder energy arc
      if (Math.sin(animTime * 6) > 0.4) {
        ctx.strokeStyle = `rgba(200, 100, 255, ${0.35 + Math.sin(animTime * 8) * 0.15})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx + 5, torsoTop + 48);
        ctx.quadraticCurveTo(bx + 90, torsoTop + 20 + Math.random() * 20, bx + 175, torsoTop + 48);
        ctx.stroke();
      }
      // Exhaust smoke from vents
      for (let v = 0; v < 3; v++) {
        const vx = bx + 35 + v * 45;
        const vy = coreY + 110 - Math.sin(animTime * 2 + v) * 5;
        ctx.fillStyle = `rgba(60, 20, 40, ${0.2 - v * 0.05})`;
        ctx.beginPath();
        ctx.arc(vx + Math.sin(animTime + v) * 5, vy - animTime * 5 % 30, 6 + v * 2, 0, Math.PI * 2);
        ctx.fill();
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
    jpGrad.addColorStop(0.5, '#5a5a7a');
    jpGrad.addColorStop(1, '#2a2a4a');
    ctx.fillStyle = jpGrad;
    ctx.beginPath();
    ctx.roundRect(x - 7, y + 6, 12, 30, 3);
    ctx.fill();
    // Chrome highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x - 5, y + 8, 3, 20);
    // Nozzle
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(x - 5, y + 36, 8, 5, [0, 0, 2, 2]);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 4, y + 36, 6, 1);
    // Thrust flame (dual-color, animated)
    const flameH = 8 + Math.sin(animTime * 12) * 3;
    const flameW = 4 + Math.sin(animTime * 8) * 1;
    // Outer flame (blue)
    const outerFlame = ctx.createLinearGradient(x - 1, y + 41, x - 1, y + 41 + flameH);
    outerFlame.addColorStop(0, 'rgba(0, 150, 255, 0.9)');
    outerFlame.addColorStop(0.4, 'rgba(0, 80, 255, 0.6)');
    outerFlame.addColorStop(1, 'rgba(0, 30, 200, 0)');
    ctx.fillStyle = outerFlame;
    ctx.beginPath();
    ctx.moveTo(x - flameW - 1, y + 41);
    ctx.lineTo(x - 1, y + 41 + flameH);
    ctx.lineTo(x + flameW - 1, y + 41);
    ctx.closePath();
    ctx.fill();
    // Inner flame (white-cyan)
    const innerFlame = ctx.createLinearGradient(x - 1, y + 41, x - 1, y + 41 + flameH * 0.6);
    innerFlame.addColorStop(0, 'rgba(200, 255, 255, 0.9)');
    innerFlame.addColorStop(1, 'rgba(0, 200, 255, 0)');
    ctx.fillStyle = innerFlame;
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 41);
    ctx.lineTo(x - 1, y + 41 + flameH * 0.6);
    ctx.lineTo(x, y + 41);
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
    ctx.beginPath();
    ctx.roundRect(x + 30, y + 19, 14, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(x + 32, y + 20, 10, 8);
    // Barrel highlight
    ctx.fillStyle = 'rgba(0, 255, 100, 0.15)';
    ctx.fillRect(x + 38, y + 20, 4, 8);
    // Emitter glow
    const emitPulse = 0.5 + Math.sin(animTime * 10) * 0.3;
    const emitGlow = ctx.createRadialGradient(x + 44, y + 24, 0, x + 44, y + 24, 6);
    emitGlow.addColorStop(0, `rgba(0, 255, 100, ${emitPulse * 0.8})`);
    emitGlow.addColorStop(1, 'rgba(0, 255, 100, 0)');
    ctx.fillStyle = emitGlow;
    ctx.beginPath();
    ctx.arc(x + 44, y + 24, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(x + 42, y + 22, 3, 4);

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
    const dx = 60, dy = HEIGHT - 180, dw = WIDTH - 120, dh = 150;
    ctx.globalAlpha = alpha;
    // Background with slight gradient
    const bgGrad = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    bgGrad.addColorStop(0, 'rgba(5, 5, 20, 0.92)');
    bgGrad.addColorStop(1, 'rgba(10, 10, 30, 0.88)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, 4);
    ctx.fill();
    // Double border
    const borderColor = dialog.speaker === 'Count Crosstalk' ? `rgba(255, 50, 50, ${0.6})` : `rgba(0, 255, 170, ${0.5})`;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, 4);
    ctx.stroke();
    ctx.strokeStyle = borderColor.replace(/[\d.]+\)$/, '0.2)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(dx + 3, dy + 3, dw - 6, dh - 6, 3);
    ctx.stroke();
    // Corner accents
    const cornerSize = 8;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    // Top-left
    ctx.beginPath(); ctx.moveTo(dx, dy + cornerSize); ctx.lineTo(dx, dy); ctx.lineTo(dx + cornerSize, dy); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(dx + dw - cornerSize, dy); ctx.lineTo(dx + dw, dy); ctx.lineTo(dx + dw, dy + cornerSize); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(dx, dy + dh - cornerSize); ctx.lineTo(dx, dy + dh); ctx.lineTo(dx + cornerSize, dy + dh); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(dx + dw - cornerSize, dy + dh); ctx.lineTo(dx + dw, dy + dh); ctx.lineTo(dx + dw, dy + dh - cornerSize); ctx.stroke();
    // Scan lines (subtle)
    ctx.globalAlpha = alpha * 0.03;
    for (let sy = dy; sy < dy + dh; sy += 3) {
      ctx.fillStyle = '#000';
      ctx.fillRect(dx, sy, dw, 1);
    }
    ctx.globalAlpha = alpha;

    // Speaker indicator bar
    const speakerColor = dialog.speaker === 'Sonia' ? '#00ccaa' :
                         dialog.speaker === 'Count Crosstalk' ? '#ff3344' : '#ffffff';
    ctx.fillStyle = speakerColor;
    ctx.fillRect(dx + 10, dy + 8, 3, 18);
    // Speaker name
    ctx.fillStyle = speakerColor;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(dialog.speaker, dx + 20, dy + 22);

    // Lines
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '13px monospace';
    dialog.lines.forEach((line, i) => {
      ctx.fillText(line, dx + 20, dy + 48 + i * 22);
    });

    // Advance hint
    const blink = Math.sin(animTime * 3) > 0;
    if (blink) {
      ctx.fillStyle = '#555555';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('SPACE ▶', dx + dw - 15, dy + dh - 12);
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
