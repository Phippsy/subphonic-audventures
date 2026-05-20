import { initAudio, startBGM, setBGMChapter, sfxJump, sfxEnemyKill, sfxCollectSig, sfxKeyObtained, sfxGateOpen, sfxCheckpoint, sfxWin, sfxChapterTransition, sfxLand, sfxMenuSelect, sfxDeath, sfxWarpIn, sfxExtraLife, sfxFall } from './audio';
import { getLeaderboard, addToLeaderboard, isHighScore, getTimeLeaderboard, addToTimeLeaderboard, isFastestTime, formatTime, getL2Leaderboard, type LeaderboardEntry, type TimeLeaderboardEntry } from './leaderboard';
import { markLevel1Complete, isLevel2Unlocked } from './progress';

export interface GameOptions {
  launchLevel2?: () => void;
}

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Enemy = Rect & {
  vx: number;
  leftBound: number;
  rightBound: number;
  alive: boolean;
};

type Sig = Rect & {
  collected: boolean;
};

type Platform = Rect & {
  moving?: boolean;
  moveVx?: number;
  moveLeft?: number;
  moveRight?: number;
};

type Ladder = Rect;

type Checkpoint = {
  x: number;
  y: number;
  activated: boolean;
  spinTimer: number;
};

type NPC = {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  talked: boolean;
  questionAnswered: boolean;
};

type Chapter = {
  name: string;
  startX: number;
  endX: number;
  groundColor: string;
  groundHighlight: string;
  bgTint: string;
};

type GameState = {
  score: number;
  lives: number;
  checkpointX: number;
  checkpointY: number;
  insight: number;
  hasKey: boolean;
};

const WIDTH = 960;
const HEIGHT = 540;
const WORLD_WIDTH = 9000;

const GRAVITY = 1800;
const PLAYER_SPEED = 260;
const JUMP_VELOCITY = -620;
const GROUND_Y = 470;
const FALL_DEATH_Y = HEIGHT + 80;

const REQUIRED_SIGS = 23;
const STORAGE_KEY = 'subphonic-audventures-save-v4';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const buildGroundPlatforms = (worldWidth: number, pits: Rect[]): Platform[] => {
  const sortedPits = [...pits].sort((a, b) => a.x - b.x);
  const segments: Platform[] = [];
  let cursor = 0;

  for (const pit of sortedPits) {
    if (pit.x > cursor) {
      segments.push({
        x: cursor,
        y: GROUND_Y,
        w: pit.x - cursor,
        h: HEIGHT - GROUND_Y,
      });
    }
    cursor = Math.max(cursor, pit.x + pit.w);
  }

  if (cursor < worldWidth) {
    segments.push({
      x: cursor,
      y: GROUND_Y,
      w: worldWidth - cursor,
      h: HEIGHT - GROUND_Y,
    });
  }

  return segments;
};

const createSaveState = (): GameState => ({
  score: 0,
  lives: 3,
  checkpointX: 72,
  checkpointY: GROUND_Y - 54,
  insight: 0,
  hasKey: false,
});

const loadState = (): GameState => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createSaveState();
  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    return {
      score: parsed.score ?? 0,
      lives: parsed.lives ?? 3,
      checkpointX: parsed.checkpointX ?? 72,
      checkpointY: parsed.checkpointY ?? GROUND_Y - 54,
      insight: parsed.insight ?? 0,
      hasKey: (parsed as Record<string, unknown>).hasKey as boolean ?? false,
    };
  } catch {
    return createSaveState();
  }
};

const persistState = (state: GameState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export function mountGame(container: HTMLElement, options: GameOptions = {}): void {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.className = 'game-canvas';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to start game: canvas context unavailable.');

  const state = loadState();

  const player = {
    x: state.checkpointX,
    y: state.checkpointY,
    w: 42,
    h: 54,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
  };

  // === CHAPTER DEFINITIONS ===
  // Ch1: Signal Suburbs (0-1800) - gentle intro, small pits, basic jumps
  // Ch2: Static Canopy (1800-3600) - ladders, vertical platforming, denser enemies
  // Ch3: Frequency Chasm (3600-5400) - big gaps, moving platforms, precision
  // Ch4: Noise Core (5400-7200) - gauntlet, fast enemies, tight jumps, gate

  const chapters: Chapter[] = [
    { name: 'Signal Suburbs', startX: 0, endX: 1800, groundColor: '#5f6f86', groundHighlight: '#a8bdd8', bgTint: 'rgba(40, 60, 90, 0.12)' },
    { name: 'Static Canopy', startX: 1800, endX: 3600, groundColor: '#4a6e5a', groundHighlight: '#8fcbaa', bgTint: 'rgba(30, 80, 50, 0.14)' },
    { name: 'Frequency Chasm', startX: 3600, endX: 6300, groundColor: '#6e5a4a', groundHighlight: '#d4a878', bgTint: 'rgba(90, 50, 20, 0.12)' },
    { name: 'Noise Core', startX: 6300, endX: 9000, groundColor: '#6e4a5a', groundHighlight: '#d478a8', bgTint: 'rgba(90, 20, 50, 0.14)' },
  ];

  // === PITS ===
  const pits: Rect[] = [
    // Ch1: small pits
    { x: 420, y: GROUND_Y, w: 95, h: 80 },
    { x: 850, y: GROUND_Y, w: 110, h: 80 },
    { x: 1300, y: GROUND_Y, w: 130, h: 80 },
    { x: 1600, y: GROUND_Y, w: 150, h: 80 },
    // Ch2: medium pits
    { x: 2050, y: GROUND_Y, w: 170, h: 80 },
    { x: 2550, y: GROUND_Y, w: 200, h: 80 },
    { x: 3050, y: GROUND_Y, w: 180, h: 80 },
    { x: 3350, y: GROUND_Y, w: 160, h: 80 },
    // Ch3: BIG chasms - must use platforms to cross
    { x: 3800, y: GROUND_Y, w: 350, h: 80 },
    { x: 4400, y: GROUND_Y, w: 400, h: 80 },
    { x: 5000, y: GROUND_Y, w: 320, h: 80 },
    // Ch3 Resonance Spire: MASSIVE chasm - entire vertical section is over the void
    { x: 5400, y: GROUND_Y, w: 900, h: 80 },
    // Ch4: dangerous gaps (shifted +900)
    { x: 6500, y: GROUND_Y, w: 250, h: 80 },
    { x: 7000, y: GROUND_Y, w: 300, h: 80 },
    { x: 7500, y: GROUND_Y, w: 220, h: 80 },
  ];

  const groundPlatforms = buildGroundPlatforms(WORLD_WIDTH, pits);

  // === PLATFORMS ===
  const platforms: Platform[] = [
    ...groundPlatforms,

    // Ch1: gentle staircase platforms
    { x: 180, y: 405, w: 140, h: 24 },
    { x: 370, y: 355, w: 120, h: 24 },
    { x: 560, y: 330, w: 130, h: 24 },
    { x: 750, y: 290, w: 120, h: 24 },
    { x: 1000, y: 360, w: 130, h: 24 },
    { x: 1180, y: 310, w: 150, h: 24 },
    { x: 1430, y: 350, w: 130, h: 24 },
    { x: 1650, y: 300, w: 120, h: 24 },

    // Ch2: vertical stacks (use ladders to reach)
    { x: 1880, y: 380, w: 160, h: 24 },
    { x: 1880, y: 280, w: 140, h: 24 },
    { x: 1880, y: 180, w: 120, h: 24 },
    { x: 2150, y: 340, w: 130, h: 24 },
    { x: 2300, y: 270, w: 140, h: 24 },
    { x: 2500, y: 360, w: 110, h: 24 },
    { x: 2750, y: 300, w: 150, h: 24 },
    { x: 2750, y: 200, w: 130, h: 24 },
    { x: 2950, y: 350, w: 140, h: 24 },
    { x: 3150, y: 280, w: 130, h: 24 },
    { x: 3350, y: 320, w: 110, h: 24 },
    { x: 3500, y: 260, w: 130, h: 24 },

    // Ch3: stepping stones across big chasms (reachable from ground y=470, max jump ~107px)
    { x: 3820, y: 410, w: 100, h: 24 },
    { x: 3980, y: 380, w: 90, h: 24 },
    { x: 4120, y: 410, w: 100, h: 24 },
    // Moving platform bridges first big gap
    { x: 3920, y: 430, w: 120, h: 24, moving: true, moveVx: 70, moveLeft: 3820, moveRight: 4140 },
    { x: 4450, y: 420, w: 100, h: 24 },
    { x: 4600, y: 380, w: 100, h: 24 },
    { x: 4750, y: 420, w: 100, h: 24 },
    // Moving platform bridges second big gap
    { x: 4520, y: 440, w: 120, h: 24, moving: true, moveVx: 80, moveLeft: 4450, moveRight: 4780 },
    // Patrick's tower (Ch3 vertical section) - long climb, out of sight from ground
    { x: 4850, y: 380, w: 120, h: 24 },
    { x: 4880, y: 280, w: 100, h: 24 },
    { x: 4860, y: 180, w: 130, h: 24 },
    { x: 4880, y: 80, w: 120, h: 24 },
    { x: 4870, y: -20, w: 130, h: 24 },
    { x: 4880, y: -120, w: 120, h: 24 },
    { x: 4870, y: -220, w: 150, h: 24 },  // Patrick stands here (far above screen)
    { x: 5050, y: 410, w: 100, h: 24 },
    { x: 5180, y: 380, w: 90, h: 24 },
    { x: 5280, y: 410, w: 90, h: 24 },
    // Moving platform bridges third gap
    { x: 5120, y: 440, w: 110, h: 24, moving: true, moveVx: -70, moveLeft: 5050, moveRight: 5300 },

    // Ch3 Resonance Spire: Vertical platforming over the void (x: 5400-6300)
    // Entry platform from ground level
    { x: 5370, y: 420, w: 140, h: 24 },
    // Ascending platforms - wide zigzag climb with generous spacing
    { x: 5450, y: 340, w: 130, h: 24 },
    { x: 5620, y: 260, w: 120, h: 24 },
    { x: 5440, y: 175, w: 130, h: 24 },
    { x: 5630, y: 95, w: 120, h: 24 },
    { x: 5430, y: 10, w: 140, h: 24 },
    { x: 5620, y: -75, w: 130, h: 24 },
    { x: 5440, y: -160, w: 130, h: 24 },
    // Summit ridge - wider platforms, traverse right
    { x: 5620, y: -240, w: 120, h: 24 },
    { x: 5790, y: -220, w: 110, h: 24 },
    { x: 5950, y: -240, w: 120, h: 24 },
    { x: 6100, y: -210, w: 110, h: 24 },
    // Moving platform at summit (slow, wide patrol)
    { x: 5700, y: -280, w: 90, h: 24, moving: true, moveVx: 40, moveLeft: 5620, moveRight: 5900 },
    // Descent on the far side - generous drops
    { x: 6180, y: -120, w: 120, h: 24 },
    { x: 6100, y: -20, w: 130, h: 24 },
    { x: 6190, y: 80, w: 120, h: 24 },
    { x: 6100, y: 180, w: 130, h: 24 },
    { x: 6200, y: 290, w: 120, h: 24 },
    { x: 6100, y: 380, w: 140, h: 24 },
    // Landing platform back at ground on far side
    { x: 6250, y: 430, w: 120, h: 24 },

    // Ch4: tight gauntlet (shifted +900, all first-step platforms reachable from ground)
    { x: 6400, y: 380, w: 100, h: 24 },
    { x: 6550, y: 380, w: 90, h: 24 },
    { x: 6670, y: 340, w: 100, h: 24 },
    { x: 6820, y: 400, w: 110, h: 24 },
    { x: 6970, y: 400, w: 100, h: 24 },
    { x: 7100, y: 370, w: 100, h: 24 },
    { x: 7250, y: 400, w: 90, h: 24 },
    { x: 7400, y: 380, w: 100, h: 24 },
    { x: 7550, y: 400, w: 100, h: 24 },
    { x: 7700, y: 370, w: 110, h: 24 },
    { x: 7860, y: 400, w: 120, h: 24 },
  ];

  // === SIGS (20 total, ~5 per chapter) ===
  const sigs: Sig[] = [
    // Ch1
    { x: 240, y: 360, w: 18, h: 18, collected: false },
    { x: 590, y: 284, w: 18, h: 18, collected: false },
    { x: 790, y: 244, w: 18, h: 18, collected: false },
    { x: 1210, y: 264, w: 18, h: 18, collected: false },
    { x: 1680, y: 254, w: 18, h: 18, collected: false },
    // Ch2
    { x: 1910, y: 134, w: 18, h: 18, collected: false },
    { x: 2330, y: 224, w: 18, h: 18, collected: false },
    { x: 2780, y: 154, w: 18, h: 18, collected: false },
    { x: 3180, y: 234, w: 18, h: 18, collected: false },
    { x: 3530, y: 214, w: 18, h: 18, collected: false },
    // Ch3 (spread out, one on Patrick's tower climb)
    { x: 3860, y: 364, w: 18, h: 18, collected: false },
    { x: 4620, y: 334, w: 18, h: 18, collected: false },
    { x: 4900, y: 34, w: 18, h: 18, collected: false },
    { x: 5080, y: 364, w: 18, h: 18, collected: false },
    { x: 5210, y: 334, w: 18, h: 18, collected: false },
    // Ch3 Resonance Spire: sigs on the vertical climb
    { x: 5470, y: -5, w: 18, h: 18, collected: false },
    { x: 5650, y: -90, w: 18, h: 18, collected: false },
    { x: 5970, y: -255, w: 18, h: 18, collected: false },
    // Ch4 (shifted +900)
    { x: 6430, y: 334, w: 18, h: 18, collected: false },
    { x: 6690, y: 294, w: 18, h: 18, collected: false },
    { x: 7130, y: 324, w: 18, h: 18, collected: false },
    { x: 7570, y: 354, w: 18, h: 18, collected: false },
    { x: 7890, y: 354, w: 18, h: 18, collected: false },
  ];

  // === ENEMIES ===
  const enemies: Enemy[] = [
    // Ch1: slow, predictable
    { x: 380, y: 321, w: 34, h: 34, vx: 80, leftBound: 345, rightBound: 480, alive: true },
    { x: 900, y: 436, w: 34, h: 34, vx: -70, leftBound: 760, rightBound: 1020, alive: true },
    { x: 1450, y: 316, w: 34, h: 34, vx: 75, leftBound: 1400, rightBound: 1560, alive: true },
    // Ch2: mid-speed on platforms
    { x: 2170, y: 306, w: 36, h: 36, vx: 90, leftBound: 2150, rightBound: 2280, alive: true },
    { x: 2770, y: 266, w: 36, h: 36, vx: -85, leftBound: 2750, rightBound: 2900, alive: true },
    { x: 3170, y: 246, w: 36, h: 36, vx: 88, leftBound: 3150, rightBound: 3280, alive: true },
    { x: 3400, y: 436, w: 36, h: 36, vx: -95, leftBound: 3230, rightBound: 3510, alive: true },
    // Ch3: guarding stepping stones
    { x: 3960, y: 336, w: 34, h: 34, vx: 70, leftBound: 3950, rightBound: 4035, alive: true },
    { x: 4560, y: 346, w: 34, h: 34, vx: -65, leftBound: 4550, rightBound: 4640, alive: true },
    { x: 5060, y: 376, w: 36, h: 36, vx: 80, leftBound: 5020, rightBound: 5120, alive: true },
    // Ch3 Resonance Spire: enemies on wide platforms (avoidable)
    { x: 5470, y: 142, w: 30, h: 30, vx: 45, leftBound: 5440, rightBound: 5560, alive: true },
    { x: 5820, y: -254, w: 30, h: 30, vx: -40, leftBound: 5790, rightBound: 5890, alive: true },
    { x: 6120, y: -54, w: 30, h: 30, vx: 40, leftBound: 6100, rightBound: 6220, alive: true },
    // Ch4: fast and aggressive (shifted +900)
    { x: 6570, y: 346, w: 38, h: 38, vx: -120, leftBound: 6550, rightBound: 6640, alive: true },
    { x: 6840, y: 362, w: 38, h: 38, vx: 110, leftBound: 6820, rightBound: 6930, alive: true },
    { x: 7120, y: 332, w: 38, h: 38, vx: -115, leftBound: 7100, rightBound: 7200, alive: true },
    { x: 7420, y: 342, w: 40, h: 40, vx: 125, leftBound: 7400, rightBound: 7500, alive: true },
    { x: 7720, y: 330, w: 40, h: 40, vx: -130, leftBound: 7700, rightBound: 7810, alive: true },
  ];

  // === LADDERS (mainly Ch2, some in Ch3) ===
  const ladders: Ladder[] = [
    { x: 530, y: 330, w: 36, h: 140 },       // Ch1: optional shortcut
    { x: 1910, y: 180, w: 36, h: 290 },      // Ch2: main vertical climb
    { x: 2780, y: 200, w: 36, h: 270 },      // Ch2: climb to high sig
    { x: 3510, y: 260, w: 36, h: 210 },      // Ch2/3 transition
    { x: 4870, y: -220, w: 36, h: 600 },      // Ch3: Patrick's tower ladder (very tall)
    { x: 5040, y: 250, w: 36, h: 220 },      // Ch3: access upper area
    { x: 7630, y: 300, w: 36, h: 170 },      // Ch4: access final platforms
  ];

  // === CHECKPOINTS ===
  const checkpoints: Checkpoint[] = [
    { x: 980, y: 402, activated: false, spinTimer: 0 },
    { x: 1800, y: 402, activated: false, spinTimer: 0 },
    { x: 2770, y: 402, activated: false, spinTimer: 0 },
    { x: 3600, y: 402, activated: false, spinTimer: 0 },
    { x: 4800, y: 402, activated: false, spinTimer: 0 },
    { x: 5330, y: 402, activated: false, spinTimer: 0 },
    { x: 6300, y: 402, activated: false, spinTimer: 0 },
    { x: 7300, y: 402, activated: false, spinTimer: 0 },
  ];

  const gate = { x: 8880, y: 402, w: 34, h: 68, open: false };

  // === PATRICK NPC (hidden far above screen in Ch3, gives key) ===
  const patrick: NPC = { x: 4920, y: -274, w: 42, h: 54, name: 'Patrick', talked: false, questionAnswered: state.hasKey };

  // === STORY INTERLUDES (shown on chapter transition) ===
  const chapterStories: { title: string; lines: string[] }[] = [
    {
      title: 'CHAPTER 1: SIGNAL SUBURBS',
      lines: [
        'Acoustica was once a realm of perfect signal.',
        'Subphonic\'s engineers maintained the clarity,',
        'routing audio with precision through the network.',
        'But Lord Noise has corrupted the suburbs...',
      ],
    },
    {
      title: 'CHAPTER 2: STATIC CANOPY',
      lines: [
        'The canopy grew dense with interference.',
        'Subphonic\'s compliance team warned of risks—',
        'unregulated AI was amplifying the static.',
        'Patrick was dispatched to investigate...',
      ],
    },
    {
      title: 'CHAPTER 3: FREQUENCY CHASM',
      lines: [
        'Deep in the chasm, Patrick found the source.',
        'He guards the Compliance Key high above.',
        'Without it, the final gate stays locked.',
        'Find Patrick. Prove you understand the rules.',
      ],
    },
    {
      title: 'CHAPTER 4: NOISE CORE',
      lines: [
        'The core pulses with Lord Noise\'s power.',
        'Only with all 20 sigs AND the key',
        'can the gate be opened to restore harmony.',
        'This is Subphonic\'s final stand.',
      ],
    },
  ];

  let storyInterludeActive = false;
  let storyInterludeChapter = 0;
  let storyInterludeTimer = 0;
  const shownInterludes = new Set<number>();

  // Patrick question UI state
  let patrickDialogActive = false;
  let patrickQuestionIndex = 0;
  let patrickSelectedOption = 0;
  let patrickAttempts = 0;
  let patrickFeedback = '';
  let patrickFeedbackTimer = 0;

  const patrickQuestions = [
    {
      question: 'Which principle is MOST important when building AI systems that make decisions about people?',
      options: [
        'Making the AI as fast as possible',
        'Keeping humans in the loop for oversight and accountability',
        'Training on the largest dataset available regardless of source',
        'Deploying quickly before competitors',
      ],
      correct: 1,
    },
  ];

  const keys: Record<string, boolean> = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    // Win screen name entry
    if (won && !wonNameSubmitted) {
      if (e.key === 'Backspace') {
        wonNameEntry = wonNameEntry.slice(0, -1);
        sfxMenuSelect();
      } else if (e.key === 'Enter' && wonNameEntry.length > 0) {
        wonLeaderboard = addToLeaderboard(wonNameEntry, state.score);
        wonTimeLeaderboard = addToTimeLeaderboard(wonNameEntry, finalTime);
        wonNameSubmitted = true;
        sfxKeyObtained();
      } else if (e.key.length === 1 && wonNameEntry.length < 16 && /^[a-zA-Z0-9 _\-.]$/.test(e.key)) {
        wonNameEntry += e.key;
        sfxMenuSelect();
      }
      e.preventDefault();
    } else if (won && wonNameSubmitted) {
      // Play again, next level, or switch tabs
      if (e.key === 'Enter' || e.key.toLowerCase() === 'r') {
        restartGame();
        e.preventDefault();
      } else if (e.key.toLowerCase() === 'n' && options.launchLevel2) {
        options.launchLevel2();
        e.preventDefault();
      } else if (e.key === '1') {
        wonLeaderboardTab = 'score';
      } else if (e.key === '2') {
        wonLeaderboardTab = 'time';
      }
    } else if (gameOver && gameOverTimer > 1.5) {
      // Game over - restart
      if (e.key === 'Enter' || e.key.toLowerCase() === 'r') {
        restartGame();
        e.preventDefault();
      }
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  let running = true;
  let won = false;
  let gameOver = false;
  let gameOverTimer = 0;
  let wonNameEntry = '';
  let wonNameSubmitted = false;
  let wonLeaderboard: LeaderboardEntry[] = [];
  let wonTimeLeaderboard: TimeLeaderboardEntry[] = [];
  let wonCursorBlink = 0;
  let wonLeaderboardTab: 'score' | 'time' = 'score';
  let missionTimer = 0; // seconds elapsed since game start
  let missionTimerRunning = false;
  let finalTime = 0; // locked at win
  let introActive = true;
  let introPage = 0;
  let introPageTimer = 0;
  let introFadeAlpha = 0;
  let startMenuActive = true; // NEW: splash/start screen
  let startMenuSelection = 0; // 0=New Game, 1=Leaderboard, 2=Story
  let startMenuLeaderboardTab: 'score' | 'time' | 'l2score' = 'score';
  let showingStory = false; // showing story pages from menu
  let storyPageFromMenu = 0;
  let fallDeathActive = false; // NEW: falling animation instead of explode
  let hintsEnabled = true; // Toggle tutorial popups (H key)
  let quitConfirmActive = false; // Q pressed, awaiting confirmation
  let infoMessage = 'Sonia has entered Acoustica Nightphase.';
  let chapterBanner = '';
  let chapterBannerTimer = 0;
  let gateOpenedTimer = 0;
  let currentChapter = 0;
  let cameraX = clamp(state.checkpointX - WIDTH * 0.35, 0, WORLD_WIDTH - WIDTH);
  let cameraY = 0;
  let lastTime = performance.now();

  // Animation state
  let animTime = 0;
  let walkFrame = 0;
  let playerState: 'idle' | 'walk' | 'jump' | 'climb' = 'idle';
  let dustParticles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  let sparkles: { x: number; y: number; life: number; color: string }[] = [];

  // Death & respawn animation state
  let deathAnimTimer = 0; // > 0 means death animation playing
  let deathAnimX = 0;
  let deathAnimY = 0;
  let warpInTimer = 0; // > 0 means warp-in animation playing
  let playerVisible = true;

  // Leaderboard overlay (accessible anytime)
  let leaderboardOverlayActive = false;
  let leaderboardOverlayTab: 'score' | 'time' = 'score';

  // Extra life notification
  let extraLifeTimer = 0;
  let extraLifeAwarded = false;

  // Tutorial popup state
  let tutorialPopup: { title: string; lines: string[]; showBots?: boolean } | null = null;
  let tutorialPopupAlpha = 0;
  let firstEnemyEncountered = false;
  let firstSigCollected = false;

  // Patrick wine bribe state
  let patrickWinePhase: 'intro' | 'wine-offer' | 'engine-oil' | 'no-wine' | 'question' | 'key-given' = 'intro';
  let patrickWineSelected = 2; // default to "Sorry, I don't have anything"

  // Multi-page intro story
  const introPages = [
    {
      title: 'THE WORLD OF ACOUSTICA',
      lines: [
        'A land shaped by sound, where every voice was heard.',
        'Lord Noise rose from the static, spreading',
        'interference with his MuffleBots and DistortBots.',
        '',
        'Sonia, Subphonic\'s finest signal analyst,',
        'steps into the Nightphase to restore harmony.',
      ],
    },
    {
      title: 'YOUR MISSION',
      lines: [
        'Collect 20 signal fragments (sigs)',
        'scattered across four zones.',
        '',
        'Find Patrick, the Compliance Officer,',
        'and earn the key to open the final gate.',
        '',
        'Defeat Lord Noise. Restore Acoustica.',
      ],
    },
  ];

  const resetWorld = () => {
    sigs.forEach((s) => { s.collected = false; });
    enemies.forEach((e) => { e.alive = true; });
    checkpoints.forEach((c) => { c.activated = false; c.spinTimer = 0; });
    state.insight = 0;
    state.hasKey = false;
    state.checkpointX = 72;
    state.checkpointY = GROUND_Y - 54;
    gate.open = false;
    patrick.questionAnswered = false;
    patrick.talked = false;
    patrickDialogActive = false;
    patrickWinePhase = 'intro';
    currentChapter = 0;
    firstEnemyEncountered = false;
    firstSigCollected = false;
  };

  const restartGame = () => {
    resetWorld();
    state.lives = 3;
    state.score = 0;
    persistState(state);
    won = false;
    gameOver = false;
    gameOverTimer = 0;
    wonNameEntry = '';
    wonNameSubmitted = false;
    wonLeaderboard = [];
    wonTimeLeaderboard = [];
    wonCursorBlink = 0;
    wonLeaderboardTab = 'score';
    running = true;
    missionTimer = 0;
    missionTimerRunning = true;
    finalTime = 0;
    extraLifeAwarded = false;
    extraLifeTimer = 0;
    deathAnimTimer = 0;
    warpInTimer = 0;
    playerVisible = true;
    placeAtCheckpoint();
    startBGM(0);
  };

  const placeAtCheckpoint = () => {
    player.x = state.checkpointX;
    player.y = state.checkpointY;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    cameraX = clamp(player.x - WIDTH * 0.35, 0, WORLD_WIDTH - WIDTH);
    // Start warp-in animation
    warpInTimer = 0.8;
    playerVisible = false;
    sfxWarpIn();
  };

  const handleDeath = (reason: string) => {
    state.lives -= 1;
    sfxDeath();
    infoMessage = reason;
    // Start death animation at current position
    deathAnimX = player.x;
    deathAnimY = player.y;
    deathAnimTimer = 1.0;
    playerVisible = false;
    if (state.lives < 0) {
      gameOver = true;
      gameOverTimer = 0;
      running = false;
      return;
    }
    persistState(state);
    placeAtCheckpoint();
  };
  void handleDeath; // kept for non-pit deaths (future use)

  const handleEnemyDamage = (reason: string, chapter: number) => {
    // MuffleBots (Ch1-2): 1 damage per hit (3 hits to die)
    // DistortBots (Ch3-4): instant kill (3 damage)
    const damage = chapter <= 1 ? 1 : 3;
    state.lives -= damage;
    sfxDeath();
    if (damage === 1) {
      infoMessage = reason;
    } else {
      infoMessage = reason + ' CRITICAL HIT!';
    }
    // Start death animation
    deathAnimX = player.x;
    deathAnimY = player.y;
    deathAnimTimer = 1.0;
    playerVisible = false;
    if (state.lives < 0) {
      gameOver = true;
      gameOverTimer = 0;
      running = false;
      return;
    }
    persistState(state);
    placeAtCheckpoint();
  };

  const handleFallDeath = (reason: string) => {
    state.lives -= 1;
    sfxFall();
    infoMessage = reason;
    // Fall animation — player drops off screen
    deathAnimX = player.x;
    deathAnimY = player.y;
    deathAnimTimer = 1.2;
    fallDeathActive = true;
    playerVisible = false;
    if (state.lives < 0) {
      gameOver = true;
      gameOverTimer = 0;
      running = false;
      return;
    }
    persistState(state);
    placeAtCheckpoint();
  };

  const getChapterAt = (x: number): number => {
    for (let i = 0; i < chapters.length; i++) {
      if (x >= chapters[i].startX && x < chapters[i].endX) return i;
    }
    return chapters.length - 1;
  };

  const update = (dt: number) => {
    // Game over timer (ticks even when not running)
    if (gameOver) {
      gameOverTimer += dt;
    }

    if (!running) return;

    // Leaderboard overlay toggle (L key)
    if (keys.l && !introActive && !won) {
      leaderboardOverlayActive = !leaderboardOverlayActive;
      keys.l = false;
    }
    if (leaderboardOverlayActive) {
      if (keys[' '] || keys.enter || keys.escape || keys.l) {
        leaderboardOverlayActive = false;
        keys[' '] = false;
        keys.enter = false;
        keys.escape = false;
        keys.l = false;
      }
      if (keys['1']) { leaderboardOverlayTab = 'score'; keys['1'] = false; }
      if (keys['2']) { leaderboardOverlayTab = 'time'; keys['2'] = false; }
      return;
    }

    // Quit confirmation (Q key)
    if (keys.q && !introActive && !won && !startMenuActive && !quitConfirmActive) {
      quitConfirmActive = true;
      keys.q = false;
    }
    if (quitConfirmActive) {
      if (keys.y) {
        // Confirmed quit — return to main menu
        keys.y = false;
        quitConfirmActive = false;
        startMenuActive = true;
        startMenuSelection = 0;
        introActive = true;
        introPage = 0;
        introFadeAlpha = 1;
        missionTimerRunning = false;
        return;
      }
      if (keys.n || keys.escape) {
        quitConfirmActive = false;
        keys.n = false;
        keys.escape = false;
      }
      return;
    }

    // Toggle hints (H key)
    if (keys.h && !introActive && !won && !startMenuActive) {
      hintsEnabled = !hintsEnabled;
      infoMessage = hintsEnabled ? 'Hints enabled' : 'Hints disabled';
      keys.h = false;
    }

    // Pause during death animation
    if (deathAnimTimer > 0) {
      animTime += dt;
      deathAnimTimer -= dt;
      if (deathAnimTimer <= 0) {
        fallDeathActive = false;
      }
      return;
    }

    const startPressed = keys[' '] || keys.enter;

    // Start menu
    if (startMenuActive) {
      introFadeAlpha = Math.min(1, introFadeAlpha + dt * 2);
      if (showingStory) {
        // Story pages from menu
        if (startPressed) {
          keys[' '] = false;
          keys.enter = false;
          if (storyPageFromMenu < introPages.length - 1) {
            storyPageFromMenu++;
          } else {
            showingStory = false;
            storyPageFromMenu = 0;
          }
        }
        if (keys.escape) {
          keys.escape = false;
          showingStory = false;
          storyPageFromMenu = 0;
        }
      } else if (startMenuSelection === 2 && keys.escape) {
        // Back from leaderboard view in menu
        keys.escape = false;
        startMenuSelection = 0;
      } else {
        if (keys.arrowup || keys.w || keys.arrowleft || keys.a) {
          startMenuSelection = (startMenuSelection + 3) % 4;
          keys.arrowup = false;
          keys.w = false;
          keys.arrowleft = false;
          keys.a = false;
          sfxMenuSelect();
        }
        if (keys.arrowdown || keys.s || keys.arrowright || keys.d) {
          startMenuSelection = (startMenuSelection + 1) % 4;
          keys.arrowdown = false;
          keys.s = false;
          keys.arrowright = false;
          keys.d = false;
          sfxMenuSelect();
        }
        if (startPressed) {
          keys[' '] = false;
          keys.enter = false;
          if (startMenuSelection === 0) {
            // Level 1 — reset game state
            startMenuActive = false;
            introActive = false;
            running = true;
            gameOver = false;
            won = false;
            missionTimerRunning = true;
            missionTimer = 0;
            state.score = 0;
            state.lives = 3;
            state.insight = 0;
            state.hasKey = false;
            state.checkpointX = 72;
            state.checkpointY = GROUND_Y - 54;
            player.x = 72;
            player.y = GROUND_Y - 54;
            player.vx = 0;
            player.vy = 0;
            playerVisible = true;
            currentChapter = 0;
            gate.open = false;
            shownInterludes.clear();
            for (const sig of sigs) sig.collected = false;
            for (const enemy of enemies) enemy.alive = true;
            for (const cp of checkpoints) { cp.activated = false; cp.spinTimer = 0; }
            patrick.talked = false;
            patrick.questionAnswered = false;
            extraLifeAwarded = false;
            firstEnemyEncountered = false;
            firstSigCollected = false;
            infoMessage = 'Mission live. Move right and restore Acoustica.';
            chapterBanner = chapters[0].name;
            chapterBannerTimer = 3;
            persistState(state);
            initAudio();
            startBGM();
          } else if (startMenuSelection === 1) {
            // Level 2 — launch runner
            if (isLevel2Unlocked() && options.launchLevel2) {
              options.launchLevel2();
            }
          } else if (startMenuSelection === 2) {
            // Leaderboard — handled in draw (just stays in menu)
          } else if (startMenuSelection === 3) {
            // Story
            showingStory = true;
            storyPageFromMenu = 0;
          }
        }
        if (startMenuSelection === 2) {
          if (keys['1']) { startMenuLeaderboardTab = 'score'; keys['1'] = false; }
          if (keys['2']) { startMenuLeaderboardTab = 'time'; keys['2'] = false; }
          if (keys['3']) { startMenuLeaderboardTab = 'l2score'; keys['3'] = false; }
        }
      }
      return;
    }

    if (introActive) {
      // Fade in the current page
      introPageTimer += dt;
      if (introFadeAlpha < 1) {
        introFadeAlpha = Math.min(1, introFadeAlpha + dt * 2); // fade in over 0.5s
      }
      if (startPressed && introFadeAlpha >= 0.8) {
        keys[' '] = false;
        keys.enter = false;
        if (introPage < introPages.length - 1) {
          introPage++;
          introFadeAlpha = 0;
          introPageTimer = 0;
        } else {
          introActive = false;
          missionTimerRunning = true;
          missionTimer = 0;
          infoMessage = 'Mission live. Move right and restore Acoustica.';
          chapterBanner = chapters[0].name;
          chapterBannerTimer = 3;
          initAudio();
          startBGM();
        }
      }
      return;
    }

    // Chapter detection
    const newChapter = getChapterAt(player.x);
    if (newChapter !== currentChapter) {
      currentChapter = newChapter;
      chapterBanner = chapters[currentChapter].name;
      chapterBannerTimer = 3;
      infoMessage = `Entering: ${chapters[currentChapter].name}`;
      setBGMChapter(currentChapter);
      sfxChapterTransition();
      // Trigger story interlude only on first visit
      if (!shownInterludes.has(currentChapter)) {
        shownInterludes.add(currentChapter);
        storyInterludeActive = true;
        storyInterludeChapter = currentChapter;
        storyInterludeTimer = 0;
      }
    }

    if (chapterBannerTimer > 0) {
      chapterBannerTimer -= dt;
    }
    if (gateOpenedTimer > 0) {
      gateOpenedTimer -= dt;
    }
    if (extraLifeTimer > 0) {
      extraLifeTimer -= dt;
    }

    // Story interlude pauses gameplay
    if (storyInterludeActive) {
      storyInterludeTimer += dt;
      if (keys[' '] || keys.enter) {
        storyInterludeActive = false;
        keys[' '] = false;
        keys.enter = false;
      }
      return;
    }

    // Tutorial popup pauses gameplay
    if (tutorialPopup) {
      tutorialPopupAlpha = Math.min(1, tutorialPopupAlpha + dt * 3);
      if (keys[' '] || keys.enter) {
        keys[' '] = false;
        keys.enter = false;
        tutorialPopup = null;
        tutorialPopupAlpha = 0;
      }
      return;
    }

    // Patrick dialog pauses gameplay
    if (patrickDialogActive) {
      patrickFeedbackTimer -= dt;
      if (patrickWinePhase === 'intro') {
        // Show Patrick's intro - press space to continue
        if (keys[' '] || keys.enter) {
          keys[' '] = false;
          keys.enter = false;
          patrickWinePhase = 'wine-offer';
        }
        return;
      }
      if (patrickWinePhase === 'wine-offer') {
        // Wine bribe options
        if (keys['arrowup'] || keys.w) {
          patrickWineSelected = (patrickWineSelected + 2) % 3;
          keys['arrowup'] = false;
          keys.w = false;
        }
        if (keys['arrowdown'] || keys.s) {
          patrickWineSelected = (patrickWineSelected + 1) % 3;
          keys['arrowdown'] = false;
          keys.s = false;
        }
        if (keys[' '] || keys.enter) {
          keys[' '] = false;
          keys.enter = false;
          if (patrickWineSelected === 1) {
            patrickWinePhase = 'engine-oil';
          } else if (patrickWineSelected === 2) {
            patrickWinePhase = 'no-wine';
          }
          // Option 0 (Give wine) does nothing - greyed out
        }
        return;
      }
      if (patrickWinePhase === 'engine-oil') {
        // Patrick's horrified response to engine oil
        if (keys[' '] || keys.enter) {
          keys[' '] = false;
          keys.enter = false;
          patrickWinePhase = 'question';
        }
        return;
      }
      if (patrickWinePhase === 'no-wine') {
        // Patrick's response - press space to continue to question
        if (keys[' '] || keys.enter) {
          keys[' '] = false;
          keys.enter = false;
          patrickWinePhase = 'question';
        }
        return;
      }
      if (patrickWinePhase === 'key-given') {
        // Patrick's farewell speech bubble - press space to dismiss
        if (keys[' '] || keys.enter) {
          keys[' '] = false;
          keys.enter = false;
          patrickDialogActive = false;
          infoMessage = 'You have the Compliance Key! Find the gate to complete your mission.';
        }
        return;
      }
      // Question phase (original logic)
      if (keys['arrowup'] || keys.w) {
        patrickSelectedOption = (patrickSelectedOption + patrickQuestions[patrickQuestionIndex].options.length - 1) % patrickQuestions[patrickQuestionIndex].options.length;
        keys['arrowup'] = false;
        keys.w = false;
      }
      if (keys['arrowdown'] || keys.s) {
        patrickSelectedOption = (patrickSelectedOption + 1) % patrickQuestions[patrickQuestionIndex].options.length;
        keys['arrowdown'] = false;
        keys.s = false;
      }
      if (keys[' '] || keys.enter) {
        keys[' '] = false;
        keys.enter = false;
        const q = patrickQuestions[patrickQuestionIndex];
        if (patrickSelectedOption === q.correct) {
          patrick.questionAnswered = true;
          state.hasKey = true;
          patrickWinePhase = 'key-given';
          patrickFeedback = '';
          sfxKeyObtained();
          persistState(state);
        } else {
          patrickAttempts++;
          patrickFeedback = 'Not quite. Think about responsible AI governance...';
          patrickFeedbackTimer = 2.5;
        }
      }
      return;
    }

    // Moving platforms
    for (const p of platforms) {
      if (p.moving && p.moveVx != null && p.moveLeft != null && p.moveRight != null) {
        p.x += p.moveVx * dt;
        if (p.x < p.moveLeft) { p.x = p.moveLeft; p.moveVx *= -1; }
        if (p.x + p.w > p.moveRight) { p.x = p.moveRight - p.w; p.moveVx *= -1; }
      }
    }

    // Patrick NPC interaction - triggers on proximity
    let nearPatrick = false;
    if (!patrick.questionAnswered) {
      nearPatrick = Math.abs(player.x + player.w / 2 - (patrick.x + patrick.w / 2)) < 60 &&
        Math.abs(player.y - patrick.y) < 80;
      if (nearPatrick) {
        patrickDialogActive = true;
        patrickWinePhase = 'intro';
        patrickSelectedOption = 0;
        patrickWineSelected = 2;
        patrickFeedback = '';
        keys[' '] = false;
        keys.enter = false;
        return;
      }
    }

    const left = keys['arrowleft'] || keys.a;
    const right = keys['arrowright'] || keys.d;
    const up = keys['arrowup'] || keys.w;
    const down = keys['arrowdown'] || keys.s;
    const jumpPressed = (up || keys[' ']) && !nearPatrick;

    // Ladder physics
    let onLadder = false;
    for (const ladder of ladders) {
      const cx = player.x + player.w / 2;
      const ladderOverlapX = cx > ladder.x - 8 && cx < ladder.x + ladder.w + 8;
      const ladderOverlapY = player.y + player.h > ladder.y && player.y < ladder.y + ladder.h;
      // Allow entering ladder from top by pressing down
      const atTopOfLadder = ladderOverlapX &&
        player.y + player.h >= ladder.y - 4 && player.y + player.h <= ladder.y + 16 &&
        player.onGround && down;
      if ((ladderOverlapX && ladderOverlapY) || atTopOfLadder) {
        onLadder = true;
        if (up) { player.vy = -200; player.onGround = false; }
        else if (down) { player.vy = 160; player.onGround = false; }
        else { player.vy = 0; }
        break;
      }
    }

    if (left && !right) { player.vx = -PLAYER_SPEED; player.facing = -1; }
    else if (right && !left) { player.vx = PLAYER_SPEED; player.facing = 1; }
    else { player.vx *= 0.82; if (Math.abs(player.vx) < 6) player.vx = 0; }

    if (jumpPressed && player.onGround && !onLadder) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      sfxJump();
      // Spawn dust
      for (let i = 0; i < 4; i++) {
        dustParticles.push({
          x: player.x + player.w / 2 + (Math.random() - 0.5) * 20,
          y: player.y + player.h,
          vx: (Math.random() - 0.5) * 80,
          vy: -Math.random() * 60 - 20,
          life: 0.4 + Math.random() * 0.3,
        });
      }
    }

    if (!onLadder) player.vy += GRAVITY * dt;

    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = clamp(player.x, 0, WORLD_WIDTH - player.w);

    // Platform collision (including moving platform carry)
    const wasAirborne = !player.onGround;
    player.onGround = false;
    for (const platform of platforms) {
      if (!overlap(player, platform)) continue;

      // Skip non-ground platform collisions while on a ladder (allow climbing through)
      if (onLadder && platform.y !== GROUND_Y) continue;

      const prevY = player.y - player.vy * dt;
      const playerPrevBottom = prevY + player.h;
      if (player.vy >= 0 && playerPrevBottom <= platform.y + 8) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
        // Carry player on moving platform
        if (platform.moving && platform.moveVx != null) {
          player.x += platform.moveVx * dt;
        }
      } else if (player.vy < 0 && prevY >= platform.y + platform.h - 8) {
        player.y = platform.y + platform.h;
        player.vy = 0;
      } else if (player.x + player.w / 2 < platform.x + platform.w / 2) {
        player.x = platform.x - player.w;
        player.vx = 0;
      } else {
        player.x = platform.x + platform.w;
        player.vx = 0;
      }
    }

    // Landing sound
    if (wasAirborne && player.onGround) {
      sfxLand();
    }

    // Pit death
    for (const pit of pits) {
      if (overlap(player, pit)) {
        handleFallDeath('Sonia was swallowed by a noise pit.');
        return;
      }
    }
    if (player.y > FALL_DEATH_Y) {
      handleFallDeath('Sonia fell into the void.');
      return;
    }

    // Checkpoints
    for (const checkpoint of checkpoints) {
      if (!checkpoint.activated && player.x > checkpoint.x) {
        checkpoint.activated = true;
        checkpoint.spinTimer = 2.0;
        state.checkpointX = checkpoint.x + 8;
        state.checkpointY = GROUND_Y - 54;
        infoMessage = 'Checkpoint stabilized.';
        sfxCheckpoint();
        // Emit checkpoint sparks
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          sparkles.push({
            x: checkpoint.x + 13 + Math.cos(angle) * 12,
            y: checkpoint.y + 10 + Math.sin(angle) * 8,
            life: 0.8 + Math.random() * 0.6,
            color: ['#4aff90', '#aaffcc', '#fff', '#00ff88'][Math.floor(Math.random() * 4)],
          });
        }
      }
      // Update spin timer
      if (checkpoint.spinTimer > 0) {
        checkpoint.spinTimer -= dt;
      }
    }

    // Sig collection
    for (const sig of sigs) {
      if (!sig.collected && overlap(player, sig)) {
        sig.collected = true;
        state.score += 100;
        state.insight += 1;
        sfxCollectSig();
        const remaining = REQUIRED_SIGS - state.insight;
        if (!firstSigCollected) {
          firstSigCollected = true;
          if (hintsEnabled) {
            tutorialPopup = {
              title: 'SIGNAL FRAGMENT COLLECTED!',
              lines: [
                'You collected a SIG — a fragment of pure signal.',
                'SIGs are echoes of Acoustica\'s original harmony,',
                'scattered when Lord Noise corrupted the land.',
                '',
                'Each SIG you collect lifts the darkness a little,',
                'restoring clarity to Acoustica.',
                `Collect ${REQUIRED_SIGS} to open the gate.`,
              ],
            };
          }
        } else if (remaining > 0) {
          infoMessage = `Signal captured! ${remaining} more to open the gate.`;
        } else {
          infoMessage = 'All signals collected! The gate is open!';
        }
        // Sparkle effect
        for (let i = 0; i < 6; i++) {
          sparkles.push({
            x: sig.x + 9 + (Math.random() - 0.5) * 20,
            y: sig.y + 9 + (Math.random() - 0.5) * 20,
            life: 0.5 + Math.random() * 0.4,
            color: ['#00ff00', '#fff', '#88ff88'][Math.floor(Math.random() * 3)],
          });
        }
        // Extra life at 10 SIGs
        if (state.insight === 10 && !extraLifeAwarded) {
          extraLifeAwarded = true;
          state.lives += 1;
          extraLifeTimer = 3.5;
          sfxExtraLife();
        }
      }
    }

    if (state.insight >= REQUIRED_SIGS && state.hasKey) {
      if (!gate.open) {
        gateOpenedTimer = 5; // show notification for 5 seconds
        infoMessage = 'The gate has opened! Head to the end of the final zone!';
        sfxGateOpen();
      }
      gate.open = true;
    }

    // Enemies
    // First encounter tutorial popup
    if (!firstEnemyEncountered) {
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dist = Math.abs((player.x + player.w / 2) - (enemy.x + enemy.w / 2));
        if (dist < 150 && Math.abs(player.y - enemy.y) < 100) {
          firstEnemyEncountered = true;
          if (hintsEnabled) {
            tutorialPopup = {
              title: 'ENEMY BOTS DETECTED!',
              showBots: true,
              lines: [],
            };
          }
          break;
        }
      }
    }
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.leftBound) { enemy.x = enemy.leftBound; enemy.vx *= -1; }
      if (enemy.x + enemy.w > enemy.rightBound) { enemy.x = enemy.rightBound - enemy.w; enemy.vx *= -1; }

      if (!overlap(player, enemy)) continue;
      if (player.vy > 80 && player.y + player.h - enemy.y < 18) {
        enemy.alive = false;
        player.vy = -350;
        state.score += 250;
        const botName = getChapterAt(enemy.x) <= 1 ? 'MuffleBot' : 'DistortBot';
        infoMessage = `${botName} neutralized.`;
        sfxEnemyKill();
      } else {
        const enemyChapter = getChapterAt(enemy.x);
        const botName = enemyChapter <= 1 ? 'MuffleBot' : 'DistortBot';
        handleEnemyDamage(`A ${botName} drained Sonia's clarity.`, enemyChapter);
        return;
      }
    }

    // Gate win
    if (gate.open && overlap(player, gate)) {
      won = true;
      running = false;
      missionTimerRunning = false;
      finalTime = missionTimer;
      markLevel1Complete();
      sfxWin();
      state.lives = 3;
      state.insight = 0;
      state.hasKey = false;
      state.checkpointX = 72;
      state.checkpointY = GROUND_Y - 54;
      persistState(state);
      infoMessage = 'Harmony returns to Acoustica. Lord Noise retreats!';
      return;
    }

    // Gate blocked without key
    if (!gate.open && overlap(player, gate)) {
      if (state.insight >= REQUIRED_SIGS && !state.hasKey) {
        infoMessage = 'The gate is locked. You need the Compliance Key from Patrick!';
      } else if (!state.hasKey) {
        infoMessage = `Gate locked. Need ${REQUIRED_SIGS - state.insight} more sigs AND the Compliance Key.`;
      }
    }

    cameraX = clamp(player.x - WIDTH * 0.35, 0, WORLD_WIDTH - WIDTH);
    // Vertical camera: follow player when above visible threshold (smooth for spire section)
    const targetCameraY = player.y < 200 ? player.y - 250 : 0;
    cameraY += (targetCameraY - cameraY) * 0.1; // smooth lerp
    persistState(state);

    // Update animation state
    animTime += dt;

    // Mission timer
    if (missionTimerRunning) {
      missionTimer += dt;
    }

    // Death & warp-in timers
    if (deathAnimTimer > 0) {
      deathAnimTimer -= dt;
    }
    if (warpInTimer > 0) {
      warpInTimer -= dt;
      if (warpInTimer <= 0) {
        playerVisible = true;
      }
    } else {
      playerVisible = true;
    }

    if (onLadder) playerState = 'climb';
    else if (!player.onGround) playerState = 'jump';
    else if (Math.abs(player.vx) > 20) playerState = 'walk';
    else playerState = 'idle';

    if (playerState === 'walk') {
      walkFrame = Math.floor(animTime * 8) % 4;
    }

    // Update particles
    dustParticles = dustParticles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
      return p.life > 0;
    });
    sparkles = sparkles.filter(s => {
      s.life -= dt;
      return s.life > 0;
    });
  };

  // === CHAPTER PALETTES (Subphonic brand: black, neon green #00FF00, white) ===
  const palettes = [
    // Ch1: Signal Suburbs - dark with green-blue signal tones
    { sky1: '#050808', sky2: '#0a1a18', skyHorizon: '#1a3a2a', mountain: '#0a1a14', tree: '#0c2a1a', grass: '#00cc44', grassLight: '#00ff55', dirt: '#1a1a14', dirtLight: '#2a2a1e' },
    // Ch2: Static Canopy - deeper green, forest feel
    { sky1: '#040a06', sky2: '#0a2010', skyHorizon: '#1a4020', mountain: '#081a0c', tree: '#0a3014', grass: '#00bb33', grassLight: '#00ee44', dirt: '#1a2010', dirtLight: '#2a3018' },
    // Ch3: Frequency Chasm - warm amber against black
    { sky1: '#0a0804', sky2: '#1a1008', skyHorizon: '#3a2010', mountain: '#141008', tree: '#2a1a0a', grass: '#aa8030', grassLight: '#ccaa40', dirt: '#1a1208', dirtLight: '#2a1a10' },
    // Ch4: Noise Core - electric green on pure black (full Subphonic)
    { sky1: '#020402', sky2: '#0a140a', skyHorizon: '#1a2a1a', mountain: '#081008', tree: '#0a200a', grass: '#00ff00', grassLight: '#44ff44', dirt: '#0a0a0a', dirtLight: '#1a1a1a' },
  ];

  // === RENDERING ===
  const drawSky = (tintStrength: number) => {
    const pal = palettes[currentChapter];
    // Gradient sky
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, pal.sky1);
    grad.addColorStop(0.5, pal.sky2);
    grad.addColorStop(1, pal.skyHorizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Stars (dim with tintStrength as world brightens)
    const starAlpha = 0.6 - tintStrength * 0.5;
    if (starAlpha > 0.05) {
      ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % WIDTH);
        const sy = ((i * 97 + 30) % (HEIGHT * 0.5));
        const size = (i % 3 === 0) ? 2 : 1;
        ctx.fillRect(sx, sy, size, size);
      }
    }

    // Clouds
    ctx.fillStyle = `rgba(180, 200, 230, ${0.08 + tintStrength * 0.06})`;
    for (let i = 0; i < 12; i++) {
      const cx = (i * 320 + 100) - (cameraX * 0.08) % (WIDTH * 2);
      const cy = 40 + (i % 3) * 35;
      const cw = 80 + (i % 4) * 30;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, 18 + (i % 2) * 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + cw * 0.3, cy - 8, cw * 0.6, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawMountains = (tintStrength: number) => {
    const pal = palettes[currentChapter];
    // Far mountains
    ctx.fillStyle = pal.mountain;
    for (let i = 0; i < 20; i++) {
      const mx = i * 400 - (cameraX * 0.15) % 4000;
      const mh = 120 + (i % 3) * 60;
      ctx.beginPath();
      ctx.moveTo(mx, HEIGHT * 0.75);
      ctx.lineTo(mx + 150, HEIGHT * 0.75 - mh);
      ctx.lineTo(mx + 300, HEIGHT * 0.75);
      ctx.fill();
    }

    // Mid trees/structures
    const treeAlpha = 0.7 + tintStrength * 0.2;
    ctx.globalAlpha = treeAlpha;
    ctx.fillStyle = pal.tree;
    for (let i = 0; i < 50; i++) {
      const tx = i * 150 - (cameraX * 0.35);
      const th = 80 + (i % 4) * 40;
      const tw = 30 + (i % 3) * 15;
      const ty = GROUND_Y - th + 10;
      // Tree trunk
      ctx.fillRect(tx + tw / 2 - 4, ty + th * 0.5, 8, th * 0.5);
      // Tree canopy (triangle)
      ctx.beginPath();
      ctx.moveTo(tx, ty + th * 0.6);
      ctx.lineTo(tx + tw / 2, ty);
      ctx.lineTo(tx + tw, ty + th * 0.6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx + 4, ty + th * 0.35);
      ctx.lineTo(tx + tw / 2, ty - 10);
      ctx.lineTo(tx + tw - 4, ty + th * 0.35);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const drawPlatformTextured = (sx: number, py: number, pw: number, ph: number, isGround: boolean, isMoving: boolean) => {
    const pal = palettes[getChapterAt(sx + cameraX)];

    if (isMoving) {
      // Metallic moving platform
      ctx.fillStyle = '#5a4a30';
      ctx.fillRect(sx, py, pw, ph);
      ctx.fillStyle = '#8a7a40';
      ctx.fillRect(sx + 2, py + 2, pw - 4, 4);
      ctx.fillStyle = '#d4a030';
      ctx.fillRect(sx, py, pw, 6);
      // Rivets
      ctx.fillStyle = '#ffe58a';
      for (let r = 8; r < pw; r += 16) {
        ctx.fillRect(sx + r, py + 8, 3, 3);
      }
      // Gear marks
      ctx.fillStyle = '#3a3020';
      ctx.fillRect(sx + 4, py + ph - 4, pw - 8, 2);
      return;
    }

    if (isGround) {
      // Earth body
      ctx.fillStyle = pal.dirt;
      ctx.fillRect(sx, py + 8, pw, ph - 8);
      // Dirt texture
      ctx.fillStyle = pal.dirtLight;
      for (let dx = 4; dx < pw - 4; dx += 12) {
        const dy = 14 + ((dx * 7) % 5) * 3;
        if (dy < ph - 4) {
          ctx.fillRect(sx + dx, py + dy, 4 + (dx % 3), 2);
        }
      }
      // Grass top layer
      ctx.fillStyle = pal.grass;
      ctx.fillRect(sx, py, pw, 8);
      ctx.fillStyle = pal.grassLight;
      ctx.fillRect(sx, py, pw, 4);
      // Grass tufts
      ctx.fillStyle = pal.grassLight;
      for (let gx = 2; gx < pw - 4; gx += 8 + ((gx * 3) % 5)) {
        const gh = 3 + ((gx * 7) % 4);
        ctx.fillRect(sx + gx, py - gh, 2, gh);
        ctx.fillRect(sx + gx + 3, py - gh + 1, 2, gh - 1);
      }
    } else {
      // Floating platform - wooden plank style
      ctx.fillStyle = '#5a4a38';
      ctx.fillRect(sx, py, pw, ph);
      ctx.fillStyle = '#7a6a4a';
      ctx.fillRect(sx + 2, py + 2, pw - 4, ph - 6);
      // Wood grain
      ctx.fillStyle = '#6a5a40';
      for (let wx = 6; wx < pw - 6; wx += 14) {
        ctx.fillRect(sx + wx, py + 4, 1, ph - 8);
      }
      // Mossy top edge
      ctx.fillStyle = pal.grass;
      ctx.fillRect(sx, py, pw, 3);
      ctx.fillStyle = pal.grassLight;
      for (let mx = 0; mx < pw; mx += 6 + ((mx * 5) % 4)) {
        ctx.fillRect(sx + mx, py - 2, 3, 3);
      }
      // Shadow underneath
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(sx + 2, py + ph, pw - 4, 3);
    }
  };

  const drawPlayer = (px: number) => {
    const py = player.y;
    const facing = player.facing;

    // Body proportions (refined hero proportions)
    const bodyW = 18;
    const bodyH = 20;
    const headW = 22;
    const headH = 18;
    const legW = 5;
    const legH = 14;

    const centerX = px + player.w / 2;
    const bodyX = centerX - bodyW / 2;
    const bodyY = py + headH + 3;
    const headX = centerX - headW / 2;
    const headY = py + 2;

    // Cape / scarf (behind body - flows with movement)
    ctx.fillStyle = '#2a0040';
    const capeFlutter = playerState === 'walk' ? Math.sin(animTime * 8) * 3 : Math.sin(animTime * 2) * 1;
    const capeDir = facing === 1 ? -1 : 1;
    if (playerState === 'jump') {
      // Cape billows up when jumping
      ctx.beginPath();
      ctx.moveTo(centerX - 6, bodyY + 2);
      ctx.lineTo(centerX + 6, bodyY + 2);
      ctx.lineTo(centerX + 10 * capeDir, bodyY + bodyH + 8);
      ctx.lineTo(centerX + 14 * capeDir, bodyY + bodyH + 12);
      ctx.lineTo(centerX - 2 * capeDir, bodyY + bodyH + 6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(centerX - 6, bodyY + 2);
      ctx.lineTo(centerX + 6, bodyY + 2);
      ctx.lineTo(centerX + 4 + capeFlutter * capeDir, bodyY + bodyH + 14);
      ctx.lineTo(centerX - 4 + capeFlutter * capeDir, bodyY + bodyH + 10);
      ctx.closePath();
      ctx.fill();
      // Cape highlight
      ctx.fillStyle = '#3d0060';
      ctx.beginPath();
      ctx.moveTo(centerX - 3, bodyY + 4);
      ctx.lineTo(centerX + 3, bodyY + 4);
      ctx.lineTo(centerX + 2 + capeFlutter * capeDir * 0.5, bodyY + bodyH + 8);
      ctx.lineTo(centerX - 2 + capeFlutter * capeDir * 0.5, bodyY + bodyH + 6);
      ctx.closePath();
      ctx.fill();
    }

    // Hair (behind head - flowing ponytail)
    ctx.fillStyle = '#7a3a9a';
    const hairSide = facing === 1 ? -1 : 1;
    // Main hair mass
    ctx.fillRect(headX + (facing === 1 ? -2 : headW - 2), headY + 2, 6, headH - 2);
    // Ponytail with physics-like bounce
    const ponytailBounce = playerState === 'walk' ? Math.sin(animTime * 9) * 4 : Math.sin(animTime * 2.5) * 2;
    ctx.beginPath();
    ctx.moveTo(centerX + hairSide * 8, headY + 6);
    ctx.quadraticCurveTo(
      centerX + hairSide * 14 + ponytailBounce,
      headY + 16,
      centerX + hairSide * 10 + ponytailBounce * 1.5,
      headY + headH + 10
    );
    ctx.lineTo(centerX + hairSide * 6, headY + headH + 6);
    ctx.quadraticCurveTo(
      centerX + hairSide * 10,
      headY + 12,
      centerX + hairSide * 6, headY + 6
    );
    ctx.closePath();
    ctx.fill();
    // Hair highlights
    ctx.fillStyle = '#9a4aba';
    ctx.beginPath();
    ctx.moveTo(centerX + hairSide * 8, headY + 8);
    ctx.quadraticCurveTo(
      centerX + hairSide * 12 + ponytailBounce * 0.7,
      headY + 14,
      centerX + hairSide * 9 + ponytailBounce,
      headY + headH + 4
    );
    ctx.lineTo(centerX + hairSide * 7, headY + headH + 2);
    ctx.closePath();
    ctx.fill();

    // Legs with better definition
    const legY = bodyY + bodyH;
    // Dark jeans
    ctx.fillStyle = '#1e2d4a';
    if (playerState === 'walk') {
      const legOffset = [0, -3, 0, 3][walkFrame];
      ctx.fillRect(centerX - 6, legY + legOffset, legW, legH - legOffset);
      ctx.fillRect(centerX + 1, legY - legOffset, legW, legH + legOffset);
      // Knee highlights
      ctx.fillStyle = '#2a3d5a';
      ctx.fillRect(centerX - 5, legY + 4 + legOffset, 3, 3);
      ctx.fillRect(centerX + 2, legY + 4 - legOffset, 3, 3);
    } else if (playerState === 'jump') {
      ctx.fillRect(centerX - 7, legY - 2, legW, legH - 4);
      ctx.fillRect(centerX + 2, legY - 2, legW, legH - 4);
    } else if (playerState === 'climb') {
      const climbOff = Math.sin(animTime * 6) * 3;
      ctx.fillRect(centerX - 6, legY + climbOff, legW, legH);
      ctx.fillRect(centerX + 1, legY - climbOff, legW, legH);
    } else {
      ctx.fillRect(centerX - 6, legY, legW, legH);
      ctx.fillRect(centerX + 1, legY, legW, legH);
    }

    // Boots (heroic boots with slight heel)
    ctx.fillStyle = '#3a1a1a';
    const shoeY = legY + legH - 5;
    if (playerState === 'walk') {
      const legOffset = [0, -3, 0, 3][walkFrame];
      ctx.fillRect(centerX - 7, shoeY + legOffset, legW + 2, 5);
      ctx.fillRect(centerX, shoeY - legOffset, legW + 2, 5);
      // Boot detail
      ctx.fillStyle = '#5a2a2a';
      ctx.fillRect(centerX - 7, shoeY + legOffset, legW + 2, 2);
      ctx.fillRect(centerX, shoeY - legOffset, legW + 2, 2);
    } else {
      ctx.fillRect(centerX - 7, shoeY, legW + 2, 5);
      ctx.fillRect(centerX, shoeY, legW + 2, 5);
      ctx.fillStyle = '#5a2a2a';
      ctx.fillRect(centerX - 7, shoeY, legW + 2, 2);
      ctx.fillRect(centerX, shoeY, legW + 2, 2);
    }

    // Body / jacket (signal analyst look)
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
    // Jacket lapels
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(bodyX + 1, bodyY, 4, bodyH - 3);
    ctx.fillRect(bodyX + bodyW - 5, bodyY, 4, bodyH - 3);
    // Inner shirt / collar visible
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(centerX - 3, bodyY, 6, 6);
    // Signal wave emblem on chest
    ctx.fillStyle = '#00cc66';
    const emblemY = bodyY + 9;
    ctx.fillRect(centerX - 4, emblemY, 1, 1);
    ctx.fillRect(centerX - 3, emblemY - 1, 1, 3);
    ctx.fillRect(centerX - 2, emblemY - 2, 1, 5);
    ctx.fillRect(centerX - 1, emblemY - 1, 1, 3);
    ctx.fillRect(centerX, emblemY, 1, 1);
    ctx.fillRect(centerX + 1, emblemY - 1, 1, 3);
    ctx.fillRect(centerX + 2, emblemY - 2, 1, 5);
    ctx.fillRect(centerX + 3, emblemY - 1, 1, 3);
    ctx.fillRect(centerX + 4, emblemY, 1, 1);
    // Belt with buckle
    ctx.fillStyle = '#2a2020';
    ctx.fillRect(bodyX, bodyY + bodyH - 3, bodyW, 3);
    ctx.fillStyle = '#aa9040';
    ctx.fillRect(centerX - 2, bodyY + bodyH - 3, 4, 3);

    // Arms (jacket sleeves with skin-tone hands)
    const armW = 5;
    if (playerState === 'walk') {
      const armSwing = Math.sin(animTime * 10) * 6;
      // Left arm
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(bodyX - armW, bodyY + 4 + armSwing, armW, 11);
      ctx.fillStyle = '#f0d0b0';
      ctx.fillRect(bodyX - armW, bodyY + 15 + armSwing, armW, 3);
      // Right arm
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(bodyX + bodyW, bodyY + 4 - armSwing, armW, 11);
      ctx.fillStyle = '#f0d0b0';
      ctx.fillRect(bodyX + bodyW, bodyY + 15 - armSwing, armW, 3);
    } else if (playerState === 'jump') {
      // Arms raised heroically
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(bodyX - armW - 1, bodyY - 6, armW, 12);
      ctx.fillRect(bodyX + bodyW + 1, bodyY - 6, armW, 12);
      ctx.fillStyle = '#f0d0b0';
      ctx.fillRect(bodyX - armW - 1, bodyY - 8, armW, 3);
      ctx.fillRect(bodyX + bodyW + 1, bodyY - 8, armW, 3);
    } else if (playerState === 'climb') {
      const climbArm = Math.sin(animTime * 6) * 5;
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(bodyX - armW, bodyY + 2 + climbArm, armW, 11);
      ctx.fillRect(bodyX + bodyW, bodyY + 2 - climbArm, armW, 11);
      ctx.fillStyle = '#f0d0b0';
      ctx.fillRect(bodyX - armW, bodyY + 13 + climbArm, armW, 3);
      ctx.fillRect(bodyX + bodyW, bodyY + 13 - climbArm, armW, 3);
    } else {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(bodyX - armW, bodyY + 6, armW, 11);
      ctx.fillRect(bodyX + bodyW, bodyY + 6, armW, 11);
      ctx.fillStyle = '#f0d0b0';
      ctx.fillRect(bodyX - armW, bodyY + 17, armW, 3);
      ctx.fillRect(bodyX + bodyW, bodyY + 17, armW, 3);
    }

    // Head (slightly more oval / refined)
    ctx.fillStyle = '#f0d0b0';
    ctx.fillRect(headX + 1, headY, headW - 2, headH);
    ctx.fillRect(headX, headY + 2, headW, headH - 4);
    // Fringe
    ctx.fillStyle = '#7a3a9a';
    ctx.fillRect(headX + 2, headY - 1, headW - 4, 4);
    if (facing === 1) {
      ctx.fillRect(headX + 2, headY - 1, 10, 5);
    } else {
      ctx.fillRect(headX + headW - 12, headY - 1, 10, 5);
    }

    // Eyes (more expressive - larger with proper pupils)
    const eyeY = headY + 7;
    if (facing === 1) {
      // Eye whites
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 7, eyeY, 5, 5);
      ctx.fillRect(headX + 14, eyeY, 5, 5);
      // Irises (green - signal colour)
      ctx.fillStyle = '#1a8a3a';
      ctx.fillRect(headX + 9, eyeY + 1, 3, 3);
      ctx.fillRect(headX + 16, eyeY + 1, 3, 3);
      // Pupils
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(headX + 10, eyeY + 2, 2, 2);
      ctx.fillRect(headX + 17, eyeY + 2, 2, 2);
      // Eye shine
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 9, eyeY + 1, 1, 1);
      ctx.fillRect(headX + 16, eyeY + 1, 1, 1);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 3, eyeY, 5, 5);
      ctx.fillRect(headX + 10, eyeY, 5, 5);
      ctx.fillStyle = '#1a8a3a';
      ctx.fillRect(headX + 4, eyeY + 1, 3, 3);
      ctx.fillRect(headX + 11, eyeY + 1, 3, 3);
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(headX + 4, eyeY + 2, 2, 2);
      ctx.fillRect(headX + 11, eyeY + 2, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 6, eyeY + 1, 1, 1);
      ctx.fillRect(headX + 13, eyeY + 1, 1, 1);
    }

    // Determined expression (slight smirk)
    ctx.fillStyle = '#9a5555';
    ctx.fillRect(centerX - 2, headY + 14, 5, 1);
    ctx.fillRect(centerX + 2, headY + 13, 2, 1);

    // Headphones (Subphonic branded - oversized & glowing!)
    const hpGlow = 0.6 + Math.sin(animTime * 3) * 0.3;
    // Ear cups (oversized)
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(headX - 6, headY + 2, 7, 15);
    ctx.fillRect(headX + headW - 1, headY + 2, 7, 15);
    // Outer cup rim
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(headX - 7, headY + 3, 2, 13);
    ctx.fillRect(headX + headW + 5, headY + 3, 2, 13);
    // Glowing ring on cups (bigger & brighter)
    ctx.fillStyle = `rgba(0, 255, 120, ${hpGlow})`;
    ctx.fillRect(headX - 5, headY + 4, 3, 11);
    ctx.fillRect(headX + headW, headY + 4, 3, 11);
    // Inner cup speaker detail
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(headX - 4, headY + 7, 2, 5);
    ctx.fillRect(headX + headW + 1, headY + 7, 2, 5);
    // Cup highlight
    ctx.fillStyle = `rgba(0, 200, 100, ${hpGlow * 0.3})`;
    ctx.fillRect(headX - 3, headY + 4, 1, 11);
    ctx.fillRect(headX + headW + 3, headY + 4, 1, 11);
    // Headband (thicker, arched)
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(headX - 1, headY - 4, headW + 2, 4);
    ctx.fillRect(headX + 1, headY - 5, headW - 2, 2);
    // Headband glow accent (wider)
    ctx.fillStyle = `rgba(0, 255, 120, ${hpGlow * 0.6})`;
    ctx.fillRect(centerX - 5, headY - 5, 10, 2);

    // Subtle glow particles around Sonia based on collected sigs
    if (state.insight > 0) {
      const glowAlpha = 0.1 + (state.insight / REQUIRED_SIGS) * 0.25;
      const glowCount = Math.min(state.insight, 8);
      for (let g = 0; g < glowCount; g++) {
        const angle = animTime * 2 + (g / glowCount) * Math.PI * 2;
        const radius = 28 + Math.sin(animTime * 3 + g) * 4;
        const gx = centerX + Math.cos(angle) * radius;
        const gy = py + player.h / 2 + Math.sin(angle) * radius * 0.6;
        ctx.fillStyle = `rgba(0, 255, 0, ${glowAlpha * (0.5 + Math.sin(animTime * 5 + g) * 0.5)})`;
        ctx.fillRect(gx - 1, gy - 1, 2, 2);
      }
    }
  };

  const drawEnemy = (sx: number, enemy: Enemy) => {
    const ew = enemy.w;
    const eh = enemy.h;
    const eChap = getChapterAt(enemy.x);
    const isDistortBot = eChap >= 2;

    if (isDistortBot) {
      // === DISTORTBOT: Angular, evil, static-crackling ===
      const bodyColors = ['', '', '#8a1a3a', '#6a0a4a'];
      const accentColors = ['', '', '#ff3060', '#cc20ff'];
      const bodyCol = bodyColors[eChap];
      const accentCol = accentColors[eChap];

      // Jagged body (angular trapezoid shape)
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.moveTo(sx + 4, enemy.y + eh - 4);
      ctx.lineTo(sx, enemy.y + 10);
      ctx.lineTo(sx + 6, enemy.y + 4);
      ctx.lineTo(sx + ew - 6, enemy.y + 4);
      ctx.lineTo(sx + ew, enemy.y + 10);
      ctx.lineTo(sx + ew - 4, enemy.y + eh - 4);
      ctx.closePath();
      ctx.fill();

      // Spiky crown / top plates
      ctx.fillStyle = accentCol;
      for (let s = 0; s < 4; s++) {
        const spikeX = sx + 6 + s * (ew - 12) / 3;
        ctx.beginPath();
        ctx.moveTo(spikeX, enemy.y + 4);
        ctx.lineTo(spikeX + (ew - 12) / 6, enemy.y - 2);
        ctx.lineTo(spikeX + (ew - 12) / 3, enemy.y + 4);
        ctx.fill();
      }

      // Antenna with STATIC crackling
      ctx.fillStyle = '#666';
      ctx.fillRect(sx + ew / 2 - 1, enemy.y - 10, 2, 12);
      // Static particles around antenna (animated)
      ctx.fillStyle = accentCol;
      for (let sp = 0; sp < 5; sp++) {
        const sparkAngle = animTime * 12 + sp * 1.3 + enemy.x;
        const sparkDist = 4 + Math.sin(animTime * 8 + sp * 2) * 3;
        const spx = sx + ew / 2 + Math.cos(sparkAngle) * sparkDist;
        const spy = enemy.y - 8 + Math.sin(sparkAngle) * sparkDist * 0.6;
        const sparkSize = 1 + Math.random();
        ctx.fillRect(spx, spy, sparkSize, sparkSize);
      }
      // Lightning bolt lines from antenna
      ctx.strokeStyle = `rgba(${eChap === 3 ? '200,50,255' : '255,60,100'}, ${0.4 + Math.sin(animTime * 10) * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const boltDir = Math.sin(animTime * 6 + enemy.x) > 0 ? 1 : -1;
      ctx.moveTo(sx + ew / 2, enemy.y - 8);
      ctx.lineTo(sx + ew / 2 + boltDir * 4, enemy.y - 12);
      ctx.lineTo(sx + ew / 2 + boltDir * 2, enemy.y - 14);
      ctx.lineTo(sx + ew / 2 + boltDir * 6, enemy.y - 18);
      ctx.stroke();

      // Angry eyes (red, slanted)
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(sx + 6, enemy.y + 12, 10, 8);
      ctx.fillRect(sx + ew - 16, enemy.y + 12, 10, 8);
      // Red glowing pupils
      ctx.fillStyle = '#ff2020';
      const pupilPulse = 0.7 + Math.sin(animTime * 6) * 0.3;
      ctx.globalAlpha = pupilPulse;
      ctx.fillRect(sx + 8 + (enemy.vx > 0 ? 3 : 0), enemy.y + 14, 5, 5);
      ctx.fillRect(sx + ew - 14 + (enemy.vx > 0 ? 3 : 0), enemy.y + 14, 5, 5);
      ctx.globalAlpha = 1;
      // Angry eyebrow slant
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.moveTo(sx + 5, enemy.y + 11);
      ctx.lineTo(sx + 16, enemy.y + 13);
      ctx.lineTo(sx + 16, enemy.y + 11);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + ew - 5, enemy.y + 11);
      ctx.lineTo(sx + ew - 16, enemy.y + 13);
      ctx.lineTo(sx + ew - 16, enemy.y + 11);
      ctx.fill();

      // Jagged mouth (teeth)
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(sx + 8, enemy.y + eh - 12, ew - 16, 7);
      ctx.fillStyle = '#fff';
      for (let t = 0; t < 5; t++) {
        const tx = sx + 10 + t * ((ew - 20) / 5);
        ctx.beginPath();
        ctx.moveTo(tx, enemy.y + eh - 12);
        ctx.lineTo(tx + (ew - 20) / 10, enemy.y + eh - 7);
        ctx.lineTo(tx + (ew - 20) / 5, enemy.y + eh - 12);
        ctx.fill();
      }

      // Clawed feet
      ctx.fillStyle = '#3a1a2a';
      const footBob = Math.sin(animTime * 8 + enemy.x) * 2;
      ctx.fillRect(sx + 2, enemy.y + eh - 4 + footBob, 10, 5);
      ctx.fillRect(sx + ew - 12, enemy.y + eh - 4 - footBob, 10, 5);
      // Claw tips
      ctx.fillStyle = accentCol;
      ctx.fillRect(sx, enemy.y + eh + footBob, 3, 3);
      ctx.fillRect(sx + 10, enemy.y + eh + footBob, 3, 3);
      ctx.fillRect(sx + ew - 13, enemy.y + eh - footBob, 3, 3);
      ctx.fillRect(sx + ew - 3, enemy.y + eh - footBob, 3, 3);

    } else {
      // === MUFFLEBOT: Rounded, less threatening ===
      const bodyColors = ['#4a6080', '#306848'];
      const accentColors = ['#80a0cc', '#60cc88'];
      const bodyCol = bodyColors[eChap];
      const accentCol = accentColors[eChap];

      // Rounded body (softer rectangle with highlights)
      ctx.fillStyle = bodyCol;
      ctx.fillRect(sx + 4, enemy.y + 6, ew - 8, eh - 8);
      // Rounded top
      ctx.fillStyle = bodyCol;
      ctx.fillRect(sx + 6, enemy.y + 3, ew - 12, 6);
      // Soft top highlight
      ctx.fillStyle = accentCol;
      ctx.fillRect(sx + 8, enemy.y + 2, ew - 16, 4);

      // Small simple antenna (no static)
      ctx.fillStyle = '#999';
      ctx.fillRect(sx + ew / 2 - 1, enemy.y - 4, 2, 6);
      // Soft dot on antenna
      ctx.fillStyle = accentCol;
      ctx.beginPath();
      ctx.arc(sx + ew / 2, enemy.y - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Friendly round eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx + ew * 0.32, enemy.y + 16, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + ew * 0.68, enemy.y + 16, 5, 0, Math.PI * 2);
      ctx.fill();
      // Pupils (look in movement direction)
      const pupilOff = enemy.vx > 0 ? 2 : -2;
      ctx.fillStyle = '#1a1a3a';
      ctx.beginPath();
      ctx.arc(sx + ew * 0.32 + pupilOff, enemy.y + 17, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + ew * 0.68 + pupilOff, enemy.y + 17, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Simple grille mouth (neutral expression)
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(sx + 10, enemy.y + eh - 12, ew - 20, 5);
      ctx.fillStyle = accentCol;
      for (let m = 0; m < 4; m++) {
        ctx.fillRect(sx + 12 + m * ((ew - 24) / 4), enemy.y + eh - 11, 2, 3);
      }

      // Stubby rounded feet
      ctx.fillStyle = '#3a3a4a';
      const footBob = Math.sin(animTime * 6 + enemy.x) * 1.5;
      ctx.fillRect(sx + 6, enemy.y + eh - 4 + footBob, 8, 5);
      ctx.fillRect(sx + ew - 14, enemy.y + eh - 4 - footBob, 8, 5);
    }
  };

  const drawSig = (sx: number, sy: number, worldX: number) => {
    const bob = Math.sin(animTime * 4 + worldX * 0.1) * 3;
    const cy = sy + 9 + bob;

    // Outer glow
    ctx.fillStyle = `rgba(0, 255, 0, ${0.15 + Math.sin(animTime * 3) * 0.05})`;
    ctx.beginPath();
    ctx.arc(sx + 9, cy, 12, 0, Math.PI * 2);
    ctx.fill();

    // Signal waves
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    for (let w = 0; w < 3; w++) {
      const waveOffset = animTime * 2 + w * 0.8;
      ctx.beginPath();
      ctx.arc(sx + 9, cy, 4 + w * 3, -Math.PI * 0.6 + Math.sin(waveOffset) * 0.3, Math.PI * 0.6 + Math.sin(waveOffset) * 0.3);
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx + 7, cy - 2, 4, 4);
  };

  const drawLadder = (sx: number, ladder: Ladder) => {
    const lw = ladder.w;
    const lh = ladder.h;
    // Rails - wood
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(sx, ladder.y, 5, lh);
    ctx.fillRect(sx + lw - 5, ladder.y, 5, lh);
    // Rail highlight
    ctx.fillStyle = '#7a5a40';
    ctx.fillRect(sx + 1, ladder.y, 2, lh);
    ctx.fillRect(sx + lw - 4, ladder.y, 2, lh);
    // Rungs
    const rungCount = Math.floor(lh / 16);
    for (let r = 0; r < rungCount; r++) {
      const ry = ladder.y + r * 16 + 8;
      ctx.fillStyle = '#6a5040';
      ctx.fillRect(sx + 5, ry, lw - 10, 5);
      ctx.fillStyle = '#8a7050';
      ctx.fillRect(sx + 5, ry, lw - 10, 2);
    }
  };

  const drawCheckpoint = (sx: number, cp: Checkpoint) => {
    // Pole
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(sx, cp.y, 6, 68);

    // Flag with wave-around-pole animation
    const spinning = cp.spinTimer > 0;
    if (spinning) {
      // Wave around pole: flag appears on left and right alternately
      const spinProgress = (2.0 - cp.spinTimer) / 2.0; // 0 to 1
      const waveAngle = spinProgress * Math.PI * 8; // 4 full wraps
      const wrapPhase = Math.cos(waveAngle); // -1 to 1 (left to right)
      const flagWidth = 20 * Math.abs(wrapPhase); // Perspective narrowing at center
      const poleX = sx + 3; // pole center

      ctx.save();
      // Flag on right when wrapPhase > 0, left when < 0
      const flagX = wrapPhase >= 0 ? poleX + 3 : poleX - 3 - flagWidth;

      // Activated flag (green)
      ctx.fillStyle = '#4aff90';
      ctx.fillRect(flagX, cp.y + 4, flagWidth, 14);
      ctx.fillStyle = '#2ada70';
      ctx.fillRect(flagX, cp.y + 12, flagWidth, 6);
      // Checkmark (only visible when flag is wide enough)
      if (flagWidth > 10) {
        ctx.fillStyle = '#fff';
        const cmX = flagX + flagWidth / 2 - 3;
        ctx.fillRect(cmX, cp.y + 10, 2, 4);
        ctx.fillRect(cmX + 2, cp.y + 12, 2, 2);
        ctx.fillRect(cmX + 4, cp.y + 8, 2, 6);
      }
      ctx.restore();

      // Glowing sparks orbiting the pole
      const sparkCount = Math.min(8, Math.ceil(cp.spinTimer * 5));
      for (let i = 0; i < sparkCount; i++) {
        const angle = animTime * 5 + (i / sparkCount) * Math.PI * 2;
        const radius = 14 + Math.sin(animTime * 8 + i * 2) * 6;
        const sparkX = poleX + Math.cos(angle) * radius;
        const sparkY = cp.y + 10 + Math.sin(angle) * radius * 0.7;
        const sparkAlpha = cp.spinTimer / 2.0;
        ctx.fillStyle = `rgba(74, 255, 144, ${sparkAlpha * (0.5 + Math.sin(animTime * 10 + i) * 0.5)})`;
        ctx.fillRect(sparkX - 1, sparkY - 1, 3, 3);
      }
      // Additional glow
      const glowAlpha = cp.spinTimer / 2.0 * 0.3;
      ctx.fillStyle = `rgba(74, 255, 144, ${glowAlpha})`;
      ctx.fillRect(sx - 4, cp.y - 4, 36, 26);
    } else if (cp.activated) {
      ctx.fillStyle = '#4aff90';
      ctx.fillRect(sx + 6, cp.y + 4, 20, 14);
      ctx.fillStyle = '#2ada70';
      ctx.fillRect(sx + 6, cp.y + 12, 20, 6);
      // Checkmark
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + 12, cp.y + 10, 2, 4);
      ctx.fillRect(sx + 14, cp.y + 12, 2, 2);
      ctx.fillRect(sx + 16, cp.y + 8, 2, 6);
    } else {
      ctx.fillStyle = '#6a7a8a';
      ctx.fillRect(sx + 6, cp.y + 4, 18, 12);
      ctx.fillStyle = '#4a5a6a';
      ctx.fillRect(sx + 6, cp.y + 10, 18, 6);
    }
    // Orb on top
    const orbGlow = spinning ? 1.0 : (cp.activated ? 0.5 + Math.sin(animTime * 3) * 0.2 : 0);
    ctx.fillStyle = cp.activated ? `rgba(170, 255, 204, ${0.6 + orbGlow * 0.4})` : '#5a6a7a';
    ctx.fillRect(sx + 1, cp.y - 4, 4, 4);
    if (spinning) {
      ctx.fillStyle = `rgba(170, 255, 204, ${cp.spinTimer / 2.0 * 0.5})`;
      ctx.fillRect(sx - 1, cp.y - 6, 8, 8);
    }
  };

  const drawGate = () => {
    const gx = gate.x - cameraX;
    if (gx + gate.w < -10 || gx > WIDTH + 10) return;

    // Gate frame
    ctx.fillStyle = gate.open ? '#00cc44' : '#1a1a1a';
    ctx.fillRect(gx - 4, gate.y - 4, gate.w + 8, gate.h + 4);
    // Gate body
    ctx.fillStyle = gate.open ? '#00ff00' : '#2a2a2a';
    ctx.fillRect(gx, gate.y, gate.w, gate.h);
    // Gate detail
    if (gate.open) {
      ctx.fillStyle = '#88ff88';
      ctx.fillRect(gx + 4, gate.y + 4, gate.w - 8, gate.h - 8);
      // Glow
      ctx.fillStyle = `rgba(0, 255, 0, ${0.3 + Math.sin(animTime * 3) * 0.1})`;
      ctx.fillRect(gx - 8, gate.y - 8, gate.w + 16, gate.h + 16);
    } else {
      // Lock - show key icon if locked
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(gx + gate.w / 2 - 6, gate.y + gate.h / 2 - 6, 12, 12);
      ctx.fillStyle = state.hasKey ? '#00ff00' : '#ff4040';
      ctx.fillRect(gx + gate.w / 2 - 4, gate.y + gate.h / 2 - 4, 8, 8);
      // Bars
      ctx.fillStyle = '#1a1a1a';
      for (let b = 8; b < gate.h - 8; b += 10) {
        ctx.fillRect(gx + 4, gate.y + b, gate.w - 8, 2);
      }
      // Green frame glow if has key
      if (state.hasKey) {
        ctx.strokeStyle = `rgba(0, 255, 0, ${0.3 + Math.sin(animTime * 2) * 0.1})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(gx - 2, gate.y - 2, gate.w + 4, gate.h + 4);
      }
    }
  };

  const drawPatrick = () => {
    const px = patrick.x - cameraX;
    const py = patrick.y;
    if (px + patrick.w < -10 || px > WIDTH + 10) return;

    const centerX = px + patrick.w / 2;

    // Patrick is a professional-looking NPC with a suit/tie
    // Legs
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(centerX - 7, py + 40, 6, 14);
    ctx.fillRect(centerX + 1, py + 40, 6, 14);
    // Shoes
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(centerX - 8, py + 50, 7, 4);
    ctx.fillRect(centerX, py + 50, 7, 4);

    // Body / suit jacket
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(centerX - 10, py + 20, 20, 22);
    // Shirt
    ctx.fillStyle = '#e0e8f0';
    ctx.fillRect(centerX - 4, py + 20, 8, 18);
    // Tie (Subphonic green!)
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(centerX - 2, py + 22, 4, 14);
    ctx.fillRect(centerX - 3, py + 22, 6, 3);

    // Arms
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(centerX - 14, py + 22, 5, 14);
    ctx.fillRect(centerX + 9, py + 22, 5, 14);

    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(centerX - 10, py + 2, 20, 18);
    // Hair (short, professional)
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(centerX - 10, py, 20, 6);
    ctx.fillRect(centerX - 11, py + 2, 3, 8);
    ctx.fillRect(centerX + 8, py + 2, 3, 8);

    // Glasses
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(centerX - 8, py + 9, 7, 5);
    ctx.fillRect(centerX + 1, py + 9, 7, 5);
    ctx.fillRect(centerX - 1, py + 10, 2, 2);
    // Lenses
    ctx.fillStyle = '#a0d0ff';
    ctx.fillRect(centerX - 7, py + 10, 5, 3);
    ctx.fillRect(centerX + 2, py + 10, 5, 3);

    // Mouth
    ctx.fillStyle = '#8a5a5a';
    ctx.fillRect(centerX - 2, py + 15, 4, 2);

    // Key indicator
    if (!patrick.questionAnswered) {
      // Floating exclamation mark
      const bobY = Math.sin(animTime * 3) * 3;
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(centerX - 2, py - 16 + bobY, 4, 8);
      ctx.fillRect(centerX - 2, py - 6 + bobY, 4, 3);
    } else {
      // Checkmark
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(centerX - 4, py - 10, 3, 6);
      ctx.fillRect(centerX - 1, py - 12, 3, 4);
      ctx.fillRect(centerX + 2, py - 14, 3, 6);
    }

    // Name tag
    ctx.fillStyle = '#00ff00';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PATRICK', centerX, py - 20);
    ctx.textAlign = 'left';
  };

  const drawSubphonicLogo = (x: number, y: number, size: number, color = '#ffffff') => {
    // Subphonic logo: symmetrical cymatic pattern — cross/plus arrangement
    // 13 nodes: 3 top, 1 upper-mid, 5 middle, 1 lower-mid, 3 bottom
    const s = size / 28; // scale factor

    // Node positions (symmetrical cross pattern)
    const nodes: { cx: number; cy: number; r: number }[] = [
      // Row 1 (top): left, center, right
      { cx: 3, cy: 3, r: 2.2 },    // 0: top-left
      { cx: 14, cy: 3, r: 2.4 },   // 1: top-center
      { cx: 25, cy: 3, r: 2.2 },   // 2: top-right
      // Row 2 (upper-mid): center only
      { cx: 14, cy: 9, r: 2.6 },   // 3: upper-mid
      // Row 3 (middle): full width
      { cx: 3, cy: 14, r: 2.2 },   // 4: mid-left
      { cx: 8.5, cy: 14, r: 2.4 }, // 5: mid-inner-left
      { cx: 14, cy: 14, r: 2.8 },  // 6: center
      { cx: 19.5, cy: 14, r: 2.4 },// 7: mid-inner-right
      { cx: 25, cy: 14, r: 2.2 },  // 8: mid-right
      // Row 4 (lower-mid): center only
      { cx: 14, cy: 19, r: 2.6 },  // 9: lower-mid
      // Row 5 (bottom): left, center, right
      { cx: 3, cy: 25, r: 2.2 },   // 10: bottom-left
      { cx: 14, cy: 25, r: 2.4 },  // 11: bottom-center
      { cx: 25, cy: 25, r: 2.2 },  // 12: bottom-right
    ];

    // Draw organic curved connections (cymatic wave paths)
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 1.6);
    ctx.globalAlpha = 0.7;

    // Helper to draw quadratic bezier
    const curve = (from: number, to: number, cpx: number, cpy: number) => {
      ctx.beginPath();
      ctx.moveTo(x + nodes[from].cx * s, y + nodes[from].cy * s);
      ctx.quadraticCurveTo(x + cpx * s, y + cpy * s, x + nodes[to].cx * s, y + nodes[to].cy * s);
      ctx.stroke();
    };
    const line = (from: number, to: number) => {
      ctx.beginPath();
      ctx.moveTo(x + nodes[from].cx * s, y + nodes[from].cy * s);
      ctx.lineTo(x + nodes[to].cx * s, y + nodes[to].cy * s);
      ctx.stroke();
    };

    // Top-left quadrant curves (mirrored in all 4 quadrants)
    curve(0, 3, 6, 4);     // top-left → upper-mid (curve right)
    curve(0, 5, 3, 8);     // top-left → mid-inner-left (curve down)
    curve(1, 3, 14, 6);    // top-center → upper-mid (straight-ish)
    curve(0, 4, 1, 8);     // top-left → mid-left (curve inward)

    // Top-right quadrant (mirror)
    curve(2, 3, 22, 4);    // top-right → upper-mid (curve left)
    curve(2, 7, 25, 8);    // top-right → mid-inner-right (curve down)
    curve(2, 8, 27, 8);    // top-right → mid-right (curve inward)

    // Bottom-left quadrant (mirror)
    curve(10, 9, 6, 24);   // bottom-left → lower-mid (curve right)
    curve(10, 5, 3, 20);   // bottom-left → mid-inner-left (curve up)
    curve(11, 9, 14, 22);  // bottom-center → lower-mid (straight-ish)
    curve(10, 4, 1, 20);   // bottom-left → mid-left (curve inward)

    // Bottom-right quadrant (mirror)
    curve(12, 9, 22, 24);  // bottom-right → lower-mid (curve left)
    curve(12, 7, 25, 20);  // bottom-right → mid-inner-right (curve up)
    curve(12, 8, 27, 20);  // bottom-right → mid-right (curve inward)

    // Central cross connections
    line(3, 6);   // upper-mid → center
    line(9, 6);   // lower-mid → center
    line(5, 6);   // mid-inner-left → center
    line(7, 6);   // mid-inner-right → center
    line(4, 5);   // mid-left → mid-inner-left
    line(7, 8);   // mid-inner-right → mid-right

    ctx.globalAlpha = 1;

    // Draw nodes (dots)
    ctx.fillStyle = color;
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(x + node.cx * s, y + node.cy * s, node.r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawStoryInterlude = () => {
    if (!storyInterludeActive) return;

    const story = chapterStories[storyInterludeChapter];
    const alpha = Math.min(storyInterludeTimer * 2, 1);

    // Full screen overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${0.88 * alpha})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Border lines (Subphonic green)
    ctx.strokeStyle = `rgba(0, 255, 0, ${0.6 * alpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(60, 80, WIDTH - 120, HEIGHT - 160);

    // Particle dots decoration (like the Subphonic website)
    ctx.fillStyle = `rgba(0, 255, 0, ${0.15 * alpha})`;
    for (let i = 0; i < 40; i++) {
      const dx = 80 + ((i * 137 + storyInterludeChapter * 50) % (WIDTH - 160));
      const dy = 90 + ((i * 97) % (HEIGHT - 180));
      ctx.fillRect(dx, dy, 2, 2);
    }

    // Title
    ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
    ctx.font = '22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(story.title, WIDTH / 2, 140);

    // Story lines (fade in sequentially)
    ctx.font = '15px monospace';
    story.lines.forEach((line, i) => {
      const lineAlpha = Math.max(0, Math.min(1, (storyInterludeTimer - 0.3 - i * 0.4) * 2));
      ctx.fillStyle = `rgba(220, 240, 220, ${lineAlpha * alpha})`;
      ctx.fillText(line, WIDTH / 2, 200 + i * 36);
    });

    // Continue prompt
    if (storyInterludeTimer > 2) {
      const blinkAlpha = (Math.sin(animTime * 4) + 1) / 2;
      ctx.fillStyle = `rgba(0, 255, 0, ${blinkAlpha * alpha})`;
      ctx.font = '13px monospace';
      ctx.fillText('[ PRESS SPACE TO CONTINUE ]', WIDTH / 2, HEIGHT - 100);
    }

    ctx.textAlign = 'left';
  };

  const drawPatrickDialog = () => {
    if (!patrickDialogActive) return;

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Dialog box
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(80, 60, WIDTH - 160, HEIGHT - 120);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 60, WIDTH - 160, HEIGHT - 120);

    // Patrick's name
    ctx.fillStyle = '#00ff00';
    ctx.font = '16px monospace';
    ctx.fillText('PATRICK - Compliance Officer', 110, 95);

    // Separator
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(100, 105, WIDTH - 200, 1);

    if (patrickWinePhase === 'intro') {
      // Patrick introduces himself
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('Ah, another traveller seeking passage.', 110, 140);
      ctx.fillText('I\'m Patrick. I keep things... compliant.', 110, 165);
      ctx.fillText('', 110, 190);
      ctx.fillText('Now, normally I can be persuaded with', 110, 210);
      ctx.fillText('a bottle of social lubricant...', 110, 235);
      // Continue prompt
      ctx.fillStyle = `rgba(0, 255, 0, ${0.5 + Math.sin(animTime * 4) * 0.3})`;
      ctx.font = '11px monospace';
      ctx.fillText('Press SPACE to continue', 110, HEIGHT - 65);
    } else if (patrickWinePhase === 'wine-offer') {
      // Wine bribe options
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('So, what do you say? Have you got', 110, 140);
      ctx.fillText('a nice bottle for old Patrick?', 110, 165);
      // Option 0: Give wine (greyed out, unselectable)
      const opt0Selected = patrickWineSelected === 0;
      ctx.fillStyle = '#444444';
      ctx.font = '14px monospace';
      ctx.fillText(opt0Selected ? '> Offer a fine vintage' : '  Offer a fine vintage', 120, 210);
      ctx.fillStyle = '#444444';
      ctx.font = '11px monospace';
      ctx.fillText('  (You don\'t have one)', 135, 228);
      // Option 1: Offer engine oil
      const opt1Selected = patrickWineSelected === 1;
      ctx.fillStyle = opt1Selected ? '#ffaa00' : '#888888';
      ctx.font = opt1Selected ? 'bold 14px monospace' : '14px monospace';
      ctx.fillText(opt1Selected ? '> Offer a bottle of engine oil' : '  Offer a bottle of engine oil', 120, 260);
      // Option 2: No wine
      const opt2Selected = patrickWineSelected === 2;
      ctx.fillStyle = opt2Selected ? '#00ff00' : '#888888';
      ctx.font = opt2Selected ? 'bold 14px monospace' : '14px monospace';
      ctx.fillText(opt2Selected ? '> "Sorry, I don\'t have anything."' : '  "Sorry, I don\'t have anything."', 120, 300);
      // Controls
      ctx.fillStyle = '#555555';
      ctx.font = '11px monospace';
      ctx.fillText('UP/DOWN to select, SPACE to confirm', 110, HEIGHT - 65);
    } else if (patrickWinePhase === 'engine-oil') {
      // Patrick's horrified/disgusted response to engine oil
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('*recoils in horror*', 110, 130);
      ctx.fillStyle = '#ff8888';
      ctx.font = '14px monospace';
      ctx.fillText('ENGINE OIL?!', 110, 160);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('What is this, a 2019 Bordeaux Sup\u00E9rieur?!', 110, 190);
      ctx.fillText('I wouldn\'t pour this on my SHOES.', 110, 215);
      ctx.fillStyle = '#cccccc';
      ctx.font = '13px monospace';
      ctx.fillText('*composes himself, straightens tie*', 110, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('Right. This won\'t do at all.', 110, 280);
      ctx.fillText('You\'ll have to answer my question instead.', 110, 305);
      // Continue prompt
      ctx.fillStyle = `rgba(0, 255, 0, ${0.5 + Math.sin(animTime * 4) * 0.3})`;
      ctx.font = '11px monospace';
      ctx.fillText('Press SPACE to continue', 110, HEIGHT - 65);
    } else if (patrickWinePhase === 'no-wine') {
      // Patrick's disappointed response
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('*sighs dramatically*', 110, 140);
      ctx.fillText('', 110, 165);
      ctx.fillText('No fine vintage? Not even a \'82 Lafleur?', 110, 185);
      ctx.fillText('A Rayas perhaps? Surely... nothing?', 110, 210);
      ctx.fillText('', 110, 235);
      ctx.fillStyle = '#cccccc';
      ctx.fillText('Well, in that case you\'ll have to', 110, 255);
      ctx.fillText('answer my compliance question instead.', 110, 280);
      // Continue prompt
      ctx.fillStyle = `rgba(0, 255, 0, ${0.5 + Math.sin(animTime * 4) * 0.3})`;
      ctx.font = '11px monospace';
      ctx.fillText('Press SPACE to continue', 110, HEIGHT - 65);
    } else if (patrickWinePhase === 'question') {
      // Question phase
      const q = patrickQuestions[patrickQuestionIndex];
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      const words = q.question.split(' ');
      let line = '';
      let lineY = 130;
      for (const word of words) {
        const test = line + word + ' ';
        if (test.length > 70) {
          ctx.fillText(line, 110, lineY);
          line = word + ' ';
          lineY += 22;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, 110, lineY);

      // Options
      const optStartY = lineY + 40;
      q.options.forEach((opt, i) => {
        const isSelected = i === patrickSelectedOption;
        ctx.fillStyle = isSelected ? '#00ff00' : '#888888';
        ctx.font = isSelected ? 'bold 14px monospace' : '14px monospace';
        const prefix = isSelected ? '> ' : '  ';
        ctx.fillText(`${prefix}${opt}`, 120, optStartY + i * 30);
      });

      // Feedback
      if (patrickFeedback && patrickFeedbackTimer > 0) {
        ctx.fillStyle = '#ff6060';
        ctx.font = '13px monospace';
        ctx.fillText(patrickFeedback, 110, HEIGHT - 80);
      }

      // Controls hint
      ctx.fillStyle = '#555555';
      ctx.font = '11px monospace';
      ctx.fillText('UP/DOWN to select, SPACE to confirm', 110, HEIGHT - 65);

      if (patrickAttempts > 0) {
        ctx.fillStyle = '#666';
        ctx.fillText(`Attempts: ${patrickAttempts}`, WIDTH - 240, HEIGHT - 65);
      }
    } else if (patrickWinePhase === 'key-given') {
      // Key given speech bubble
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('Correct! Well done.', 110, 140);
      ctx.fillText('', 110, 165);
      ctx.fillText('Here, take the Compliance Key.', 110, 185);
      ctx.fillText('Use it at the gate to proceed.', 110, 210);
      ctx.fillText('', 110, 235);
      ctx.fillStyle = '#00ff00';
      ctx.font = '14px monospace';
      ctx.fillText('🔑  COMPLIANCE KEY OBTAINED', 110, 260);
      ctx.fillStyle = '#cccccc';
      ctx.font = '13px monospace';
      ctx.fillText('Now go restore harmony to Acoustica.', 110, 300);
      ctx.fillText('And if you find a bottle of the good stuff', 110, 325);
      ctx.fillText('down there... you know where I am.', 110, 350);
      // Continue prompt
      ctx.fillStyle = `rgba(0, 255, 0, ${0.5 + Math.sin(animTime * 4) * 0.3})`;
      ctx.font = '11px monospace';
      ctx.fillText('Press SPACE to continue', 110, HEIGHT - 65);
    }
  };

  const drawHUD = () => {
    // HUD background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 180, 115);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 180, 115);

    // Hearts for lives
    for (let h = 0; h < 3; h++) {
      const hx = 22 + h * 24;
      const hy = 22;
      if (h < state.lives) {
        // Full heart
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(hx, hy + 2, 4, 8);
        ctx.fillRect(hx + 4, hy, 4, 10);
        ctx.fillRect(hx + 8, hy + 2, 4, 8);
        ctx.fillRect(hx + 12, hy + 2, 4, 8);
        ctx.fillRect(hx + 16, hy, 4, 10);
        ctx.fillRect(hx + 2, hy + 8, 16, 4);
        ctx.fillRect(hx + 4, hy + 10, 12, 2);
        ctx.fillRect(hx + 6, hy + 12, 8, 2);
        ctx.fillStyle = '#88ff88';
        ctx.fillRect(hx + 4, hy + 2, 4, 4);
      } else {
        // Empty heart
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(hx, hy + 2, 4, 8);
        ctx.fillRect(hx + 4, hy, 4, 10);
        ctx.fillRect(hx + 8, hy + 2, 4, 8);
        ctx.fillRect(hx + 12, hy + 2, 4, 8);
        ctx.fillRect(hx + 16, hy, 4, 10);
        ctx.fillRect(hx + 2, hy + 8, 16, 4);
        ctx.fillRect(hx + 4, hy + 10, 12, 2);
        ctx.fillRect(hx + 6, hy + 12, 8, 2);
      }
    }

    // Sig counter with icon
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(22, 44, 8, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(`${state.insight}/${REQUIRED_SIGS}`, 36, 52);

    // Key indicator
    ctx.fillStyle = state.hasKey ? '#00ff00' : '#333333';
    ctx.font = '12px monospace';
    ctx.fillText(state.hasKey ? 'KEY [✓]' : 'KEY [ ]', 100, 52);

    // Score
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`SCORE ${state.score}`, 22, 72);

    // Timer
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px monospace';
    ctx.fillText(`TIME  ${formatTime(missionTimer)}`, 22, 90);

    // Subphonic logo mark (top-left corner of HUD)
    drawSubphonicLogo(150, 86, 24);

    // Brightness meter (right side) — vertical thermometer with sun
    const meterX = WIDTH - 40;
    const meterTop = 60;
    const meterH = 180;
    const meterW = 14;
    const brightness = state.insight / REQUIRED_SIGS;

    // Meter background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(meterX - 8, meterTop - 20, meterW + 16, meterH + 50);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX - 8, meterTop - 20, meterW + 16, meterH + 50);

    // Sun icon at top
    const sunX = meterX + meterW / 2;
    const sunY = meterTop - 6;
    const sunAlpha = 0.3 + brightness * 0.7;
    const sunColor = brightness > 0.5 ? `rgba(255, 220, 50, ${sunAlpha})` : `rgba(180, 180, 80, ${sunAlpha})`;
    ctx.fillStyle = sunColor;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 5, 0, Math.PI * 2);
    ctx.fill();
    // Sun rays
    for (let r = 0; r < 8; r++) {
      const angle = (r / 8) * Math.PI * 2 + animTime;
      const rayLen = 3 + brightness * 3;
      ctx.strokeStyle = sunColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(angle) * 7, sunY + Math.sin(angle) * 7);
      ctx.lineTo(sunX + Math.cos(angle) * (7 + rayLen), sunY + Math.sin(angle) * (7 + rayLen));
      ctx.stroke();
    }

    // Meter track
    ctx.fillStyle = '#111';
    ctx.fillRect(meterX, meterTop + 10, meterW, meterH);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(meterX, meterTop + 10, meterW, meterH);

    // Filled portion (fills from bottom)
    const fillH = meterH * brightness;
    if (fillH > 0) {
      const grad = ctx.createLinearGradient(0, meterTop + 10 + meterH - fillH, 0, meterTop + 10 + meterH);
      grad.addColorStop(0, `rgba(200, 255, 50, ${0.6 + brightness * 0.4})`);
      grad.addColorStop(1, `rgba(0, 180, 0, 0.8)`);
      ctx.fillStyle = grad;
      ctx.fillRect(meterX + 1, meterTop + 10 + meterH - fillH, meterW - 2, fillH);
    }

    // Meter label
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LIGHT', meterX + meterW / 2, meterTop + meterH + 24);
    ctx.textAlign = 'left';

    // Zone indicator (top right)
    const chapter = chapters[currentChapter];
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(WIDTH - 195, 10, 185, 28);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.strokeRect(WIDTH - 195, 10, 185, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`ZONE ${currentChapter + 1}: ${chapter.name.toUpperCase()}`, WIDTH - 18, 28);
    ctx.textAlign = 'left';

    // Info message bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(10, HEIGHT - 34, WIDTH - 20, 24);
    ctx.fillStyle = '#ccffcc';
    ctx.font = '13px monospace';
    ctx.fillText(infoMessage, 20, HEIGHT - 17);
    // Leaderboard hint
    ctx.fillStyle = '#555';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[L] Leaderboard', WIDTH - 20, HEIGHT - 17);
    ctx.textAlign = 'left';
  };

  const draw = () => {
    const tintStrength = clamp(state.insight / REQUIRED_SIGS, 0, 1) * 0.65;
    // Snap camera to whole pixels for rendering to prevent sub-pixel jitter
    const realCameraX = cameraX;
    cameraX = Math.round(cameraX);

    // Phase 1: Rich parallax background
    drawSky(tintStrength);
    drawMountains(tintStrength);

    // Apply vertical camera offset for world elements (round to avoid sub-pixel jitter)
    ctx.save();
    ctx.translate(0, -Math.round(cameraY));

    // Phase 2: Textured platforms
    for (const platform of platforms) {
      const sx = platform.x - cameraX;
      if (sx + platform.w < -2 || sx > WIDTH + 2) continue;
      const isGround = platform.y === GROUND_Y;
      drawPlatformTextured(sx, platform.y, platform.w, platform.h, isGround, !!platform.moving);
    }

    // Pits
    for (const pit of pits) {
      const sx = pit.x - cameraX;
      if (sx + pit.w < -2 || sx > WIDTH + 2) continue;
      // Dark void
      ctx.fillStyle = '#080810';
      ctx.fillRect(sx, pit.y, pit.w, pit.h);
      // Danger glow
      ctx.fillStyle = `rgba(200, 40, 40, ${0.15 + Math.sin(animTime * 2 + pit.x) * 0.05})`;
      ctx.fillRect(sx, pit.y, pit.w, 4);
      // Crumbling edges
      ctx.fillStyle = '#3a2a20';
      for (let e = 0; e < 8; e++) {
        const ex = (e * pit.w / 8) + ((e * 17) % 6);
        ctx.fillRect(sx + ex, pit.y - 2, 4 + (e % 3), 4);
      }
    }

    // Ladders
    for (const ladder of ladders) {
      const sx = ladder.x - cameraX;
      if (sx + ladder.w < -5 || sx > WIDTH + 5) continue;
      drawLadder(sx, ladder);
    }

    // Checkpoints
    for (const cp of checkpoints) {
      const sx = cp.x - cameraX;
      if (sx < -30 || sx > WIDTH + 30) continue;
      drawCheckpoint(sx, cp);
    }

    // Sigs
    for (const sig of sigs) {
      if (sig.collected) continue;
      const sx = sig.x - cameraX;
      if (sx < -30 || sx > WIDTH + 30) continue;
      drawSig(sx, sig.y, sig.x);
    }

    // Enemies
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const sx = enemy.x - cameraX;
      if (sx + enemy.w < -10 || sx > WIDTH + 10) continue;
      drawEnemy(sx, enemy);
    }

    // Gate
    drawGate();

    // Patrick NPC
    drawPatrick();

    // Dust particles
    ctx.fillStyle = 'rgba(200, 190, 170, 0.7)';
    for (const p of dustParticles) {
      const psx = p.x - cameraX;
      ctx.fillRect(psx, p.y, 3, 3);
    }

    // Sparkles
    for (const s of sparkles) {
      const ssx = s.x - cameraX;
      ctx.fillStyle = s.color;
      const size = 2 + s.life * 4;
      ctx.fillRect(ssx - size / 2, s.y - size / 2, size, size);
    }

    // Phase 3: Animated player
    const playerX = player.x - cameraX;
    if (playerVisible && warpInTimer <= 0) {
      drawPlayer(playerX);
    } else if (warpInTimer > 0) {
      // Warp-in effect: converging particles forming Sonia's silhouette
      const progress = 1 - (warpInTimer / 0.8);
      const cx = playerX + player.w / 2;
      const cy = player.y + player.h / 2;
      // Converging sparkles
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + animTime * 4;
        const dist = (1 - progress) * 60 + 5;
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        const alpha = progress * 0.8;
        ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
      // Central glow growing
      ctx.fillStyle = `rgba(0, 255, 0, ${progress * 0.3})`;
      ctx.beginPath();
      ctx.arc(cx, cy, (1 - progress) * 30 + progress * 12, 0, Math.PI * 2);
      ctx.fill();
      // Show player fading in near the end
      if (progress > 0.6) {
        ctx.globalAlpha = (progress - 0.6) / 0.4;
        drawPlayer(playerX);
        ctx.globalAlpha = 1;
      }
    }

    // Death animation effect (at old position)
    if (deathAnimTimer > 0) {
      if (fallDeathActive) {
        // Falling animation — Sonia drops down with shrinking silhouette
        const progress = 1 - (deathAnimTimer / 1.2); // 0..1
        const dx = deathAnimX - cameraX + player.w / 2;
        const dy = deathAnimY + player.h / 2 + progress * 120;
        const scale = 1 - progress * 0.7;
        const alpha = 1 - progress;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(dx - 10 * scale, dy - 14 * scale, 20 * scale, 28 * scale);
        // Motion lines above
        ctx.strokeStyle = `rgba(150, 150, 180, ${alpha * 0.6})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const lx = dx + (i - 1.5) * 8;
          const ly = dy - 20 * scale - i * 6;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx, ly - 15 - progress * 20);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        // Explosion animation (original)
        const progress = 1 - deathAnimTimer; // 0..1
        const dx = deathAnimX - cameraX + player.w / 2;
        const dy = deathAnimY + player.h / 2;
        // Expanding red ring
        ctx.strokeStyle = `rgba(255, 60, 60, ${(1 - progress) * 0.8})`;
        ctx.lineWidth = 3 - progress * 2;
        ctx.beginPath();
        ctx.arc(dx, dy, progress * 50 + 10, 0, Math.PI * 2);
        ctx.stroke();
        // Fragmenting pixels flying outward
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2 + i * 0.5;
          const dist = progress * 80;
          const px = dx + Math.cos(angle) * dist;
          const py = dy + Math.sin(angle) * dist - progress * 20;
          const alpha = (1 - progress) * 0.9;
          const colors = ['#ff4040', '#ff8080', '#ffffff', '#00ff00'];
          ctx.globalAlpha = alpha;
          ctx.fillStyle = colors[i % 4];
          ctx.fillRect(px - 2, py - 2, 4 + (i % 2), 4 + (i % 2));
        }
        ctx.globalAlpha = 1;
        // Flash
        if (progress < 0.15) {
          ctx.fillStyle = `rgba(255, 255, 255, ${(0.15 - progress) * 4})`;
          ctx.fillRect(dx - 40, dy - 40, 80, 80);
        }
      }
    }

    // End vertical camera offset
    ctx.restore();

    // Darkness overlay — lifts as SIGs are collected
    const darkness = Math.max(0, 0.45 - (state.insight / REQUIRED_SIGS) * 0.45);
    if (darkness > 0.01) {
      ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Phase 5: HUD
    drawHUD();

    // Chapter banner overlay
    if (chapterBannerTimer > 0) {
      const alpha = Math.min(chapterBannerTimer, 1);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.65 * alpha})`;
      ctx.fillRect(0, HEIGHT / 2 - 44, WIDTH, 88);
      ctx.strokeStyle = `rgba(0, 255, 0, ${0.4 * alpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(20, HEIGHT / 2 - 44, WIDTH - 40, 88);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = '28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`- ${chapterBanner.toUpperCase()} -`, WIDTH / 2, HEIGHT / 2 + 8);
      ctx.textAlign = 'left';
    }

    // Gate opened notification (non-interruptive, floats at top)
    if (gateOpenedTimer > 0) {
      const alpha = Math.min(gateOpenedTimer, 1) * Math.min((5 - gateOpenedTimer) * 4, 1);
      const pulse = 0.8 + Math.sin(animTime * 6) * 0.2;
      ctx.fillStyle = `rgba(0, 20, 0, ${0.75 * alpha})`;
      ctx.fillRect(WIDTH / 2 - 200, 55, 400, 50);
      ctx.strokeStyle = `rgba(0, 255, 0, ${pulse * alpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(WIDTH / 2 - 200, 55, 400, 50);
      ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ THE GATE IS NOW OPEN ⚡', WIDTH / 2, 78);
      ctx.fillStyle = `rgba(200, 255, 200, ${alpha * 0.8})`;
      ctx.font = '11px monospace';
      ctx.fillText('Head to the final zone to complete your mission', WIDTH / 2, 96);
      ctx.textAlign = 'left';
    }

    // Extra life notification
    if (extraLifeTimer > 0) {
      const alpha = Math.min(extraLifeTimer, 1) * Math.min((3.5 - extraLifeTimer) * 5, 1);
      const glow = 0.7 + Math.sin(animTime * 8) * 0.3;
      ctx.fillStyle = `rgba(20, 0, 40, ${0.8 * alpha})`;
      ctx.fillRect(WIDTH / 2 - 180, 115, 360, 50);
      ctx.strokeStyle = `rgba(255, 220, 100, ${glow * alpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(WIDTH / 2 - 180, 115, 360, 50);
      ctx.fillStyle = `rgba(255, 220, 100, ${alpha})`;
      ctx.font = '15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✦ EXTRA LIFE EARNED! ✦', WIDTH / 2, 138);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.font = '11px monospace';
      ctx.fillText('10 SIGs collected — the signal rewards your clarity', WIDTH / 2, 156);
      ctx.textAlign = 'left';
    }

    // Tutorial popup overlay
    if (tutorialPopup) {
      const a = tutorialPopupAlpha;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.88 * a})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = `rgba(0, 255, 0, ${0.6 * a})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 60, WIDTH - 120, HEIGHT - 120);

      if (tutorialPopup.showBots) {
        // Special bot introduction layout with illustrations
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(0, 255, 0, ${a})`;
        ctx.font = '18px monospace';
        ctx.fillText(tutorialPopup.title, WIDTH / 2, 95);

        // --- MUFFLEBOT section (left half) ---
        const mLeft = 110;
        const mCenterX = WIDTH / 4 + 30;

        ctx.fillStyle = `rgba(0, 255, 0, ${a * 0.7})`;
        ctx.font = '14px monospace';
        ctx.fillText('MUFFLEBOT', mCenterX, 125);

        // Draw MuffleBot sprite inline
        const mbx = mCenterX - 17;
        const mby = 138;
        ctx.globalAlpha = a;
        // Body
        ctx.fillStyle = '#4a6080';
        ctx.fillRect(mbx + 4, mby + 6, 30, 28);
        ctx.fillRect(mbx + 6, mby + 3, 22, 6);
        ctx.fillStyle = '#80a0cc';
        ctx.fillRect(mbx + 8, mby + 2, 18, 4);
        // Antenna
        ctx.fillStyle = '#999';
        ctx.fillRect(mbx + 16, mby - 4, 2, 6);
        ctx.fillStyle = '#80a0cc';
        ctx.beginPath();
        ctx.arc(mbx + 17, mby - 5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(mbx + 11, mby + 16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mbx + 23, mby + 16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a3a';
        ctx.beginPath();
        ctx.arc(mbx + 12, mby + 17, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mbx + 24, mby + 17, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Grille mouth
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(mbx + 10, mby + 26, 14, 5);
        // Feet
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(mbx + 6, mby + 32, 8, 5);
        ctx.fillRect(mbx + 20, mby + 32, 8, 5);
        ctx.globalAlpha = 1;

        // MuffleBot description
        ctx.fillStyle = `rgba(200, 220, 200, ${a})`;
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Found in Zones 1 & 2.', mLeft, 195);
        ctx.fillText('Drains a small amount of', mLeft, 215);
        ctx.fillText('health per hit.', mLeft, 235);
        ctx.fillStyle = `rgba(100, 200, 100, ${a})`;
        ctx.fillText('You can survive 3 hits.', mLeft, 258);

        // --- DISTORTBOT section (right half) ---
        const dLeft = WIDTH / 2 + 50;
        const dCenterX = WIDTH * 3 / 4 - 10;

        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255, 60, 100, ${a})`;
        ctx.font = '14px monospace';
        ctx.fillText('DISTORTBOT', dCenterX, 125);

        // Draw DistortBot sprite inline
        const dbx = dCenterX - 19;
        const dby = 138;
        ctx.globalAlpha = a;
        // Jagged body
        ctx.fillStyle = '#8a1a3a';
        ctx.beginPath();
        ctx.moveTo(dbx + 4, dby + 34);
        ctx.lineTo(dbx, dby + 10);
        ctx.lineTo(dbx + 6, dby + 4);
        ctx.lineTo(dbx + 32, dby + 4);
        ctx.lineTo(dbx + 38, dby + 10);
        ctx.lineTo(dbx + 34, dby + 34);
        ctx.closePath();
        ctx.fill();
        // Spikes
        ctx.fillStyle = '#ff3060';
        for (let s = 0; s < 4; s++) {
          const spX = dbx + 6 + s * 7;
          ctx.beginPath();
          ctx.moveTo(spX, dby + 4);
          ctx.lineTo(spX + 3.5, dby - 3);
          ctx.lineTo(spX + 7, dby + 4);
          ctx.fill();
        }
        // Antenna with static
        ctx.fillStyle = '#666';
        ctx.fillRect(dbx + 18, dby - 10, 2, 12);
        ctx.fillStyle = '#ff3060';
        for (let sp = 0; sp < 4; sp++) {
          const spAngle = animTime * 10 + sp * 1.5;
          const spDist = 3 + Math.sin(animTime * 6 + sp) * 2;
          ctx.fillRect(dbx + 19 + Math.cos(spAngle) * spDist, dby - 9 + Math.sin(spAngle) * spDist * 0.5, 2, 2);
        }
        // Angry eyes
        ctx.fillStyle = '#1a0000';
        ctx.fillRect(dbx + 7, dby + 12, 10, 8);
        ctx.fillRect(dbx + 21, dby + 12, 10, 8);
        ctx.fillStyle = '#ff2020';
        ctx.fillRect(dbx + 9, dby + 14, 5, 5);
        ctx.fillRect(dbx + 23, dby + 14, 5, 5);
        // Eyebrow slant
        ctx.fillStyle = '#8a1a3a';
        ctx.beginPath();
        ctx.moveTo(dbx + 6, dby + 11);
        ctx.lineTo(dbx + 17, dby + 13);
        ctx.lineTo(dbx + 17, dby + 11);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(dbx + 32, dby + 11);
        ctx.lineTo(dbx + 21, dby + 13);
        ctx.lineTo(dbx + 21, dby + 11);
        ctx.fill();
        // Jagged teeth mouth
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(dbx + 9, dby + 25, 20, 7);
        ctx.fillStyle = '#fff';
        for (let t = 0; t < 4; t++) {
          const tx2 = dbx + 10 + t * 5;
          ctx.beginPath();
          ctx.moveTo(tx2, dby + 25);
          ctx.lineTo(tx2 + 2.5, dby + 30);
          ctx.lineTo(tx2 + 5, dby + 25);
          ctx.fill();
        }
        // Clawed feet
        ctx.fillStyle = '#3a1a2a';
        ctx.fillRect(dbx + 4, dby + 34, 10, 5);
        ctx.fillRect(dbx + 24, dby + 34, 10, 5);
        ctx.fillStyle = '#ff3060';
        ctx.fillRect(dbx + 2, dby + 38, 3, 3);
        ctx.fillRect(dbx + 12, dby + 38, 3, 3);
        ctx.fillRect(dbx + 23, dby + 38, 3, 3);
        ctx.fillRect(dbx + 33, dby + 38, 3, 3);
        ctx.globalAlpha = 1;

        // DistortBot description
        ctx.fillStyle = `rgba(200, 180, 180, ${a})`;
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Found in Zones 3 & 4.', dLeft, 195);
        ctx.fillText('Emits a lethal frequency', dLeft, 215);
        ctx.fillText('that kills instantly.', dLeft, 235);
        ctx.fillStyle = `rgba(255, 80, 80, ${a})`;
        ctx.fillText('ONE HIT = DEATH. Be careful!', dLeft, 258);

        // Shared tip at bottom
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(220, 220, 220, ${a})`;
        ctx.font = '13px monospace';
        ctx.fillText('Jump on their heads to neutralize them!', WIDTH / 2, 295);
        ctx.fillText('Touching from the side or below will damage you.', WIDTH / 2, 318);

      } else {
        // Standard tutorial popup (text only)
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(0, 255, 0, ${a})`;
        ctx.font = '18px monospace';
        ctx.fillText(tutorialPopup.title, WIDTH / 2, 110);
        ctx.font = '13px monospace';
        ctx.fillStyle = `rgba(220, 220, 220, ${a})`;
        tutorialPopup.lines.forEach((line, i) => {
          if (line === '') return;
          ctx.fillText(line, WIDTH / 2, 150 + i * 24);
        });
      }

      // Continue prompt
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(0, 255, 0, ${a * (0.5 + Math.sin(animTime * 4) * 0.3)})`;
      ctx.font = '11px monospace';
      ctx.fillText('Press SPACE or ENTER to continue', WIDTH / 2, HEIGHT - 80);
      ctx.textAlign = 'left';
    }

    // Start menu / Intro overlay
    if (startMenuActive) {
      const alpha = introFadeAlpha;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.97)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Particle decoration
      ctx.fillStyle = `rgba(0, 255, 0, ${0.05 * alpha})`;
      for (let i = 0; i < 60; i++) {
        const px2 = ((i * 137 + 50) % WIDTH);
        const py2 = ((i * 97 + 20 + Math.sin(animTime + i) * 3) % HEIGHT);
        ctx.fillRect(px2, py2, 2, 2);
      }

      ctx.globalAlpha = alpha;
      // Logo
      drawSubphonicLogo(WIDTH / 2 - 22, 20, 44);

      ctx.textAlign = 'center';
      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = '28px monospace';
      ctx.fillText('SUBPHONIC AUDVENTURES', WIDTH / 2, 92);

      // Subtitle
      ctx.fillStyle = '#888';
      ctx.font = '12px monospace';
      ctx.fillText('A retro platformer by Subphonic', WIDTH / 2, 115);

      // Separator
      ctx.fillStyle = `rgba(0, 255, 0, ${0.4 * alpha})`;
      ctx.fillRect(WIDTH / 2 - 100, 128, 200, 1);

      if (showingStory) {
        // Story page view
        const page = introPages[storyPageFromMenu];
        ctx.fillStyle = '#00ff00';
        ctx.font = '18px monospace';
        ctx.fillText(page.title, WIDTH / 2, 165);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#cccccc';
        page.lines.forEach((line, i) => {
          if (line === '') return;
          ctx.fillText(line, WIDTH / 2, 200 + i * 26);
        });
        const storyDots = introPages.map((_, i) => i === storyPageFromMenu ? '●' : '○').join(' ');
        ctx.fillStyle = '#555';
        ctx.font = '10px monospace';
        ctx.fillText(storyDots, WIDTH / 2, HEIGHT - 70);
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px monospace';
        if (storyPageFromMenu < introPages.length - 1) {
          ctx.fillText('SPACE/ENTER to continue • ESC to go back', WIDTH / 2, HEIGHT - 45);
        } else {
          ctx.fillText('SPACE/ENTER or ESC to return to menu', WIDTH / 2, HEIGHT - 45);
        }
      } else {
        // Always show menu items as selectable tabs
        const level2Unlocked = isLevel2Unlocked();
        const menuItems = ['LEVEL 1', level2Unlocked ? 'LEVEL 2' : 'LEVEL 2 🔒', 'LEADERBOARD', 'STORY'];
        const menuY = 155;
        const menuSpacing = 150;
        const menuStartX = WIDTH / 2 - menuSpacing * 1.5;
        menuItems.forEach((item, i) => {
          const selected = i === startMenuSelection;
          const locked = i === 1 && !level2Unlocked;
          ctx.fillStyle = locked ? '#333333' : selected ? '#00ff00' : '#555555';
          ctx.font = selected ? 'bold 13px monospace' : '12px monospace';
          const prefix = selected ? '▶ ' : '  ';
          ctx.fillText(prefix + item, menuStartX + i * menuSpacing, menuY);
        });

        // Separator below menu
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(WIDTH / 2 - 200, 170, 400, 1);

        if (startMenuSelection === 0) {
          // Level 1 selected — show description
          ctx.fillStyle = '#aaa';
          ctx.font = '13px monospace';
          ctx.fillText('Navigate Acoustica • Collect signals • Defeat Lord Noise', WIDTH / 2, 220);
          ctx.fillStyle = '#666';
          ctx.font = '12px monospace';
          ctx.fillText('Press ENTER or SPACE to start', WIDTH / 2, 270);
        } else if (startMenuSelection === 1) {
          // Level 2 selected
          if (level2Unlocked) {
            ctx.fillStyle = '#aaa';
            ctx.font = '13px monospace';
            ctx.fillText('Static Fields Runner • Thrust through chaos • Collect James\'s hats', WIDTH / 2, 220);
            ctx.fillStyle = '#666';
            ctx.font = '12px monospace';
            ctx.fillText('Press ENTER or SPACE to launch', WIDTH / 2, 270);
          } else {
            ctx.fillStyle = '#666';
            ctx.font = '13px monospace';
            ctx.fillText('Complete Level 1 to unlock the Static Fields', WIDTH / 2, 220);
            ctx.fillStyle = '#444';
            ctx.font = '12px monospace';
            ctx.fillText('Restore harmony to Acoustica first!', WIDTH / 2, 270);
          }
        } else if (startMenuSelection === 2) {
          // Leaderboard view with 3 tabs
          const tab = startMenuLeaderboardTab;
          ctx.fillStyle = tab === 'score' ? '#00ff00' : '#555';
          ctx.font = tab === 'score' ? 'bold 11px monospace' : '11px monospace';
          ctx.fillText('[1] L1 SCORE', WIDTH / 2 - 120, 195);
          ctx.fillStyle = tab === 'time' ? '#00ff00' : '#555';
          ctx.font = tab === 'time' ? 'bold 11px monospace' : '11px monospace';
          ctx.fillText('[2] L1 TIME', WIDTH / 2, 195);
          ctx.fillStyle = tab === 'l2score' ? '#00ff00' : '#555';
          ctx.font = tab === 'l2score' ? 'bold 11px monospace' : '11px monospace';
          ctx.fillText('[3] L2 SCORE', WIDTH / 2 + 120, 195);

          ctx.font = '11px monospace';
          const startY = 220;
          if (tab === 'score') {
            const board = getLeaderboard();
            if (board.length === 0) {
              ctx.fillStyle = '#666';
              ctx.fillText('No entries yet. Be the first!', WIDTH / 2, 280);
            } else {
              for (let i = 0; i < Math.min(board.length, 10); i++) {
                ctx.fillStyle = i === 0 ? '#ffdd44' : i < 3 ? '#00ff00' : '#cccccc';
                const rank = `${(i + 1).toString().padStart(2, ' ')}.`;
                const name = board[i].name.padEnd(16, ' ');
                const score = board[i].score.toString().padStart(8, ' ');
                ctx.fillText(`${rank} ${name} ${score}  ${board[i].date}`, WIDTH / 2, startY + i * 20);
              }
            }
          } else if (tab === 'time') {
            const board = getTimeLeaderboard();
            if (board.length === 0) {
              ctx.fillStyle = '#666';
              ctx.fillText('No entries yet. Be the first!', WIDTH / 2, 280);
            } else {
              for (let i = 0; i < Math.min(board.length, 10); i++) {
                ctx.fillStyle = i === 0 ? '#ffdd44' : i < 3 ? '#00ff00' : '#cccccc';
                const rank = `${(i + 1).toString().padStart(2, ' ')}.`;
                const name = board[i].name.padEnd(16, ' ');
                const time = formatTime(board[i].time).padStart(8, ' ');
                ctx.fillText(`${rank} ${name} ${time}  ${board[i].date}`, WIDTH / 2, startY + i * 20);
              }
            }
          } else {
            const board = getL2Leaderboard();
            if (board.length === 0) {
              ctx.fillStyle = '#666';
              ctx.fillText('No entries yet. Complete Level 2!', WIDTH / 2, 280);
            } else {
              for (let i = 0; i < Math.min(board.length, 10); i++) {
                ctx.fillStyle = i === 0 ? '#ffdd44' : i < 3 ? '#00ff00' : '#cccccc';
                const rank = `${(i + 1).toString().padStart(2, ' ')}.`;
                const name = board[i].name.padEnd(16, ' ');
                const score = board[i].score.toString().padStart(8, ' ');
                ctx.fillText(`${rank} ${name} ${score}  ${board[i].date}`, WIDTH / 2, startY + i * 20);
              }
            }
          }
          ctx.fillStyle = '#555';
          ctx.font = '10px monospace';
          ctx.fillText('1/2/3: switch tab • ←→: menu • ENTER: select', WIDTH / 2, HEIGHT - 48);
        } else if (startMenuSelection === 3) {
          // Story selected — show prompt
          ctx.fillStyle = '#aaa';
          ctx.font = '13px monospace';
          ctx.fillText('Read the story of Acoustica and Sonia\'s mission', WIDTH / 2, 220);
          ctx.fillStyle = '#666';
          ctx.font = '12px monospace';
          ctx.fillText('Press ENTER or SPACE to read', WIDTH / 2, 270);
        }

        // Controls hint
        ctx.fillStyle = '#444';
        ctx.font = '10px monospace';
        ctx.fillText('ARROWS/WASD: move • SPACE: jump • H: hints • L: leaderboard • Q: quit', WIDTH / 2, HEIGHT - 30);
      }

      // Border
      ctx.strokeStyle = `rgba(0, 255, 0, ${0.2 * alpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(40, 25, WIDTH - 80, HEIGHT - 50);

      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    if (introActive && !startMenuActive) {
      const page = introPages[introPage];
      const alpha = introFadeAlpha;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.96)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.globalAlpha = alpha;
      drawSubphonicLogo(WIDTH / 2 - 22, 20, 44);

      ctx.fillStyle = '#ffffff';
      ctx.font = '28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SUBPHONIC AUDVENTURES', WIDTH / 2, 92);

      ctx.fillStyle = `rgba(0, 255, 0, ${0.5 * alpha})`;
      ctx.fillRect(WIDTH / 2 - 100, 112, 200, 1);

      ctx.fillStyle = '#00ff00';
      ctx.font = '18px monospace';
      ctx.fillText(page.title, WIDTH / 2, 144);

      ctx.font = '14px monospace';
      ctx.fillStyle = '#cccccc';
      const lineStartY = 175;
      page.lines.forEach((line, i) => {
        if (line === '') return;
        ctx.fillText(line, WIDTH / 2, lineStartY + i * 26);
      });

      ctx.fillStyle = '#00ff00';
      ctx.font = '12px monospace';
      if (introPage < introPages.length - 1) {
        ctx.fillText('Press SPACE or ENTER to continue...', WIDTH / 2, HEIGHT - 50);
      } else {
        ctx.fillText('Press SPACE or ENTER to begin!', WIDTH / 2, HEIGHT - 50);
      }

      ctx.strokeStyle = `rgba(0, 255, 0, ${0.2 * alpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(40, 25, WIDTH - 80, HEIGHT - 50);

      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // Win overlay with scoreboard
    if (won) {
      wonCursorBlink += 0.05;
      ctx.fillStyle = 'rgba(5, 15, 30, 0.92)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Border
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 30, WIDTH - 80, HEIGHT - 60);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#00ff00';
      ctx.font = '32px monospace';
      ctx.fillText('HARMONY RESTORED', WIDTH / 2, 80);
      ctx.fillStyle = '#c8daf0';
      ctx.font = '14px monospace';
      ctx.fillText('Lord Noise retreats into static. Acoustica is saved!', WIDTH / 2, 110);

      // Score & time display
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px monospace';
      ctx.fillText(`FINAL SCORE: ${state.score}`, WIDTH / 2 - 80, 145);
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(`TIME: ${formatTime(finalTime)}`, WIDTH / 2 + 120, 145);

      if (!wonNameSubmitted) {
        // Name entry
        if (isHighScore(state.score) || isFastestTime(finalTime)) {
          ctx.fillStyle = '#00ff00';
          ctx.font = '14px monospace';
          const msg = isHighScore(state.score) && isFastestTime(finalTime)
            ? 'NEW HIGH SCORE & FASTEST TIME! Enter your name:'
            : isHighScore(state.score) ? 'NEW HIGH SCORE! Enter your name:'
            : 'FASTEST TIME! Enter your name:';
          ctx.fillText(msg, WIDTH / 2, 180);
        } else {
          ctx.fillStyle = '#aaaaaa';
          ctx.font = '14px monospace';
          ctx.fillText('Enter your name for the leaderboard:', WIDTH / 2, 180);
        }

        // Name input box
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(WIDTH / 2 - 120, 192, 240, 32);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(WIDTH / 2 - 120, 192, 240, 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px monospace';
        const cursor = Math.sin(wonCursorBlink * 4) > 0 ? '|' : '';
        ctx.fillText(wonNameEntry + cursor, WIDTH / 2, 213);

        ctx.fillStyle = '#555';
        ctx.font = '11px monospace';
        ctx.fillText('Type your name and press ENTER', WIDTH / 2, 240);
      } else {
        // Tabbed leaderboard
        const tabY = 170;
        // Score tab
        const scoreTabActive = wonLeaderboardTab === 'score';
        ctx.fillStyle = scoreTabActive ? '#00ff00' : '#555';
        ctx.font = scoreTabActive ? 'bold 13px monospace' : '13px monospace';
        ctx.fillText('[1] SCORE', WIDTH / 2 - 80, tabY);
        // Time tab
        const timeTabActive = wonLeaderboardTab === 'time';
        ctx.fillStyle = timeTabActive ? '#00ff00' : '#555';
        ctx.font = timeTabActive ? 'bold 13px monospace' : '13px monospace';
        ctx.fillText('[2] SPEEDRUN', WIDTH / 2 + 60, tabY);

        const startY = 200;
        ctx.font = '12px monospace';

        if (wonLeaderboardTab === 'score') {
          const board = wonLeaderboard.length > 0 ? wonLeaderboard : getLeaderboard();
          if (board.length === 0) {
            ctx.fillStyle = '#666';
            ctx.fillText('No entries yet.', WIDTH / 2, startY);
          } else {
            for (let i = 0; i < Math.min(board.length, 10); i++) {
              const entry = board[i];
              const isCurrentPlayer = entry.name === wonNameEntry && entry.score === state.score;
              ctx.fillStyle = isCurrentPlayer ? '#00ff00' : '#cccccc';
              const rank = `${(i + 1).toString().padStart(2, ' ')}.`;
              const name = entry.name.padEnd(16, ' ');
              const score = entry.score.toString().padStart(8, ' ');
              ctx.fillText(`${rank} ${name} ${score}  ${entry.date}`, WIDTH / 2, startY + i * 22);
            }
          }
        } else {
          const board = wonTimeLeaderboard.length > 0 ? wonTimeLeaderboard : getTimeLeaderboard();
          if (board.length === 0) {
            ctx.fillStyle = '#666';
            ctx.fillText('No entries yet.', WIDTH / 2, startY);
          } else {
            for (let i = 0; i < Math.min(board.length, 10); i++) {
              const entry = board[i];
              const isCurrentPlayer = entry.name === wonNameEntry && entry.time === finalTime;
              ctx.fillStyle = isCurrentPlayer ? '#00ff00' : '#cccccc';
              const rank = `${(i + 1).toString().padStart(2, ' ')}.`;
              const name = entry.name.padEnd(16, ' ');
              const time = formatTime(entry.time).padStart(8, ' ');
              ctx.fillText(`${rank} ${name} ${time}  ${entry.date}`, WIDTH / 2, startY + i * 22);
            }
          }
        }

        // Tab switch hint + play again / next level
        ctx.fillStyle = '#666';
        ctx.font = '11px monospace';
        ctx.fillText('Press 1 or 2 to switch leaderboard', WIDTH / 2, HEIGHT - 70);
        ctx.fillStyle = `rgba(0, 255, 0, ${0.5 + Math.sin(wonCursorBlink * 2) * 0.3})`;
        ctx.font = '12px monospace';
        if (options.launchLevel2) {
          ctx.fillText('R: play again • N: next level (Static Fields)', WIDTH / 2, HEIGHT - 50);
        } else {
          ctx.fillText('Press ENTER or R to play again', WIDTH / 2, HEIGHT - 50);
        }
      }
      ctx.textAlign = 'left';
    }

    // Game Over screen
    if (gameOver) {
      const fadeIn = Math.min(gameOverTimer / 1.0, 1);
      ctx.fillStyle = `rgba(10, 0, 0, ${0.9 * fadeIn})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Static noise effect
      if (fadeIn > 0.3) {
        ctx.globalAlpha = 0.04 * fadeIn;
        for (let i = 0; i < 60; i++) {
          const nx = Math.random() * WIDTH;
          const ny = Math.random() * HEIGHT;
          ctx.fillStyle = Math.random() > 0.5 ? '#ff2020' : '#1a1a1a';
          ctx.fillRect(nx, ny, Math.random() * 4 + 1, 2);
        }
        ctx.globalAlpha = 1;
      }

      // Border (red, pulsing)
      const borderPulse = 0.3 + Math.sin(gameOverTimer * 3) * 0.2;
      ctx.strokeStyle = `rgba(255, 40, 40, ${borderPulse * fadeIn})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 80, WIDTH - 120, HEIGHT - 160);

      ctx.textAlign = 'center';

      // GAME OVER title
      const titleAlpha = Math.min((gameOverTimer - 0.3) / 0.5, 1);
      if (titleAlpha > 0) {
        ctx.fillStyle = `rgba(255, 40, 40, ${titleAlpha})`;
        ctx.font = '42px monospace';
        ctx.fillText('GAME OVER', WIDTH / 2, 160);

        // Subtitle
        ctx.fillStyle = `rgba(200, 150, 150, ${titleAlpha * 0.8})`;
        ctx.font = '14px monospace';
        ctx.fillText('The noise consumed Sonia\'s clarity.', WIDTH / 2, 200);
        ctx.fillText('Acoustica falls deeper into silence.', WIDTH / 2, 222);
      }

      // Stats
      const statsAlpha = Math.min((gameOverTimer - 0.8) / 0.5, 1);
      if (statsAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${statsAlpha * 0.7})`;
        ctx.font = '13px monospace';
        ctx.fillText(`Final Score: ${state.score}`, WIDTH / 2, 270);
        ctx.fillText(`SIGs Collected: ${state.insight} / ${REQUIRED_SIGS}`, WIDTH / 2, 294);
        ctx.fillText(`Reached: ${chapters[getChapterAt(player.x)].name}`, WIDTH / 2, 318);
      }

      // Restart prompt (only after delay)
      if (gameOverTimer > 1.5) {
        const restartAlpha = 0.5 + Math.sin(gameOverTimer * 3) * 0.3;
        ctx.fillStyle = `rgba(0, 255, 0, ${restartAlpha})`;
        ctx.font = '14px monospace';
        ctx.fillText('Press ENTER or R to try again', WIDTH / 2, HEIGHT - 110);
      }

      ctx.textAlign = 'left';
    }

    // Story interlude overlay
    drawStoryInterlude();

    // Patrick dialog overlay
    drawPatrickDialog();

    // Leaderboard overlay (accessible anytime with L key)
    if (leaderboardOverlayActive) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(120, 60, WIDTH - 240, HEIGHT - 120);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#00ff00';
      ctx.font = '22px monospace';
      ctx.fillText('— LEADERBOARD —', WIDTH / 2, 100);

      // Tabs
      const scoreActive = leaderboardOverlayTab === 'score';
      ctx.fillStyle = scoreActive ? '#00ff00' : '#555';
      ctx.font = scoreActive ? 'bold 14px monospace' : '14px monospace';
      ctx.fillText('[1] SCORE', WIDTH / 2 - 90, 128);
      ctx.fillStyle = !scoreActive ? '#00ff00' : '#555';
      ctx.font = !scoreActive ? 'bold 14px monospace' : '14px monospace';
      ctx.fillText('[2] SPEEDRUN', WIDTH / 2 + 90, 128);

      ctx.fillStyle = '#00ff00';
      ctx.fillRect(160, 138, WIDTH - 320, 1);

      ctx.font = '13px monospace';

      if (leaderboardOverlayTab === 'score') {
        const board = getLeaderboard();
        if (board.length === 0) {
          ctx.fillStyle = '#666';
          ctx.fillText('No entries yet. Complete the game to earn a spot!', WIDTH / 2, 200);
        } else {
          ctx.fillStyle = '#888';
          ctx.fillText('RANK   NAME                 SCORE       DATE', WIDTH / 2, 158);
          for (let i = 0; i < Math.min(board.length, 10); i++) {
            const entry = board[i];
            ctx.fillStyle = i === 0 ? '#ffdd44' : i < 3 ? '#00ff00' : '#cccccc';
            const rank = `${(i + 1).toString().padStart(2, ' ')}.`;
            const name = entry.name.padEnd(16, ' ');
            const score = entry.score.toString().padStart(8, ' ');
            ctx.fillText(`${rank}   ${name}   ${score}     ${entry.date}`, WIDTH / 2, 185 + i * 26);
          }
        }
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.fillText(`Your current score: ${state.score}`, WIDTH / 2, HEIGHT - 95);
      } else {
        const board = getTimeLeaderboard();
        if (board.length === 0) {
          ctx.fillStyle = '#666';
          ctx.fillText('No entries yet. Complete the game to earn a spot!', WIDTH / 2, 200);
        } else {
          ctx.fillStyle = '#888';
          ctx.fillText('RANK   NAME                  TIME       DATE', WIDTH / 2, 158);
          for (let i = 0; i < Math.min(board.length, 10); i++) {
            const entry = board[i];
            ctx.fillStyle = i === 0 ? '#ffdd44' : i < 3 ? '#00ff00' : '#cccccc';
            const rank = `${(i + 1).toString().padStart(2, ' ')}.`;
            const name = entry.name.padEnd(16, ' ');
            const time = formatTime(entry.time).padStart(8, ' ');
            ctx.fillText(`${rank}   ${name}   ${time}     ${entry.date}`, WIDTH / 2, 185 + i * 26);
          }
        }
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.fillText(`Your current time: ${formatTime(missionTimer)}`, WIDTH / 2, HEIGHT - 95);
      }

      // Dismiss
      ctx.fillStyle = `rgba(0, 255, 0, ${0.5 + Math.sin(animTime * 4) * 0.3})`;
      ctx.font = '11px monospace';
      ctx.fillText('Press 1/2 to switch tabs • L, SPACE or ESC to close', WIDTH / 2, HEIGHT - 70);
      ctx.textAlign = 'left';
    }

    // Quit confirmation overlay
    if (quitConfirmActive) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('QUIT GAME?', WIDTH / 2, HEIGHT / 2 - 40);
      ctx.fillStyle = '#cccccc';
      ctx.font = '14px monospace';
      ctx.fillText('Your progress is saved at your last checkpoint.', WIDTH / 2, HEIGHT / 2);
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('[Y] Yes, quit to menu    [N] No, keep playing', WIDTH / 2, HEIGHT / 2 + 50);
      ctx.textAlign = 'left';
    }

    // HUD controls hint (bottom-right)
    if (!introActive && !won && !startMenuActive && !gameOver && running) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('H: toggle hints • L: leaderboard • Q: quit', WIDTH - 12, HEIGHT - 8);
      ctx.textAlign = 'left';
    }

    // Restore real camera position for next update
    cameraX = realCameraX;
  };

  const frame = (now: number) => {
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
