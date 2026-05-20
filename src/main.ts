import './style.css';
import { mountGame } from './game';
import { mountRunner } from './runner';
import { markLevel2Complete } from './progress';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element.');
}

app.innerHTML = `
  <header class="top">
    <div class="logo-area">
      <div class="logo-dots"></div>
      <h1>Subphonic Audventures</h1>
    </div>
  </header>
  <main class="stage-wrap">
    <section id="game-root" aria-label="Audventures game stage"></section>
    <button class="fullscreen-toggle" aria-label="Toggle fullscreen">⛶</button>
    <button class="help-toggle" aria-label="Toggle controls help">?</button>
    <aside class="briefing hidden">
      <button class="briefing-close" aria-label="Close">\u00D7</button>
      <h2>Controls</h2>
      <p><kbd>\u2190\u2192</kbd> or <kbd>A/D</kbd> Move</p>
      <p><kbd>Space</kbd> Jump</p>
      <p><kbd>\u2191\u2193</kbd> or <kbd>W/S</kbd> Climb ladders</p>
      <p><kbd>F</kbd> Toggle fullscreen</p>
      <p class="tip">Squish bots from above. Find Patrick for the key.</p>
    </aside>
  </main>
`;

const gameRoot = document.querySelector<HTMLElement>('#game-root');
if (!gameRoot) {
  throw new Error('Missing #game-root element.');
}

// Dismissible help panel
const helpToggle = document.querySelector<HTMLButtonElement>('.help-toggle');
const briefing = document.querySelector<HTMLElement>('.briefing');
const briefingClose = document.querySelector<HTMLButtonElement>('.briefing-close');

helpToggle?.addEventListener('click', () => {
  briefing?.classList.toggle('hidden');
});
briefingClose?.addEventListener('click', () => {
  briefing?.classList.add('hidden');
});

// Fullscreen toggle
const fullscreenToggle = document.querySelector<HTMLButtonElement>('.fullscreen-toggle');
const stageWrap = document.querySelector<HTMLElement>('.stage-wrap');

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    stageWrap?.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

fullscreenToggle?.addEventListener('click', toggleFullscreen);

// F key for fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    // Don't trigger if typing in an input
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    toggleFullscreen();
  }
});

// Level orchestration
let runnerCleanup: (() => void) | null = null;

function launchLevel2() {
  runnerCleanup = mountRunner(
    gameRoot!,
    () => {
      // Level 2 complete
      markLevel2Complete();
      runnerCleanup?.();
      runnerCleanup = null;
      launchLevel1();
    },
    () => {
      // Quit back to Level 1 (start menu)
      runnerCleanup?.();
      runnerCleanup = null;
      launchLevel1();
    },
  );
}

function launchLevel1() {
  gameRoot!.innerHTML = '';
  mountGame(gameRoot!, { launchLevel2 });
}

launchLevel1();
