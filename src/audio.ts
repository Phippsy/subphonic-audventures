// Subphonic Audventures - Sound Design
// Procedural retro-inspired audio using Web Audio API

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmPlaying = false;

const ensureContext = (): AudioContext => {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.18;
    bgmGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
};

// === UTILITY ===

const playTone = (
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  attack: number,
  decay: number,
  detune = 0,
) => {
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + attack);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + duration - decay);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
};

const playNoise = (duration: number, volume: number, filterFreq: number, filterType: BiquadFilterType = 'lowpass') => {
  const ac = ensureContext();
  const bufferSize = ac.sampleRate * duration;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain!);
  source.start(ac.currentTime);
};

// === SOUND EFFECTS ===

export const sfxJump = () => {
  // Classic retro jump: quick upward frequency sweep
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(200, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.12);
  osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.18);
  gain.gain.setValueAtTime(0.18, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.2);
};

export const sfxEnemyKill = () => {
  // Satisfying squash: descending tone + noise burst
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(400, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.25);
  gain.gain.setValueAtTime(0.2, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.3);
  // Noise crunch
  playNoise(0.15, 0.12, 2000, 'bandpass');
};

export const sfxCollectSig = () => {
  // Ascending chime arpeggio - bright and rewarding
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    playTone(freq, 0.15, 'sine', 0.15, 0.01, 0.05, i * 5);
    // Harmonic shimmer
    playTone(freq * 2, 0.1, 'sine', 0.05, 0.01, 0.03, -i * 3);
  });
};

export const sfxKeyObtained = () => {
  // Triumphant fanfare: ascending major chord with sustain
  const ac = ensureContext();
  const times = [0, 0.12, 0.24, 0.36, 0.6];
  const freqs = [262, 330, 392, 523, 523]; // C4 E4 G4 C5 C5(hold)
  const durations = [0.2, 0.2, 0.2, 0.5, 0.8];

  times.forEach((t, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = i < 4 ? 'square' : 'sine';
    osc.frequency.value = freqs[i];
    gain.gain.setValueAtTime(0, ac.currentTime + t);
    gain.gain.linearRampToValueAtTime(i === 4 ? 0.12 : 0.15, ac.currentTime + t + 0.02);
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + t + durations[i]);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(ac.currentTime + t);
    osc.stop(ac.currentTime + t + durations[i]);
  });

  // Shimmer
  playTone(1047, 0.6, 'sine', 0.04, 0.3, 0.2);
};

export const sfxGateOpen = () => {
  // Big resonant chord with rising sweep - gate opening dramatically
  const ac = ensureContext();

  // Deep rumble
  const osc1 = ac.createOscillator();
  const gain1 = ac.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(65, ac.currentTime);
  osc1.frequency.linearRampToValueAtTime(130, ac.currentTime + 0.8);
  gain1.gain.setValueAtTime(0.12, ac.currentTime);
  gain1.gain.linearRampToValueAtTime(0, ac.currentTime + 1.2);
  osc1.connect(gain1);
  gain1.connect(masterGain!);
  osc1.start(ac.currentTime);
  osc1.stop(ac.currentTime + 1.2);

  // Ascending sweep
  const osc2 = ac.createOscillator();
  const gain2 = ac.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(200, ac.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.6);
  osc2.frequency.exponentialRampToValueAtTime(1200, ac.currentTime + 1.0);
  gain2.gain.setValueAtTime(0.08, ac.currentTime);
  gain2.gain.linearRampToValueAtTime(0.14, ac.currentTime + 0.5);
  gain2.gain.linearRampToValueAtTime(0, ac.currentTime + 1.0);
  osc2.connect(gain2);
  gain2.connect(masterGain!);
  osc2.start(ac.currentTime);
  osc2.stop(ac.currentTime + 1.0);

  // Chime resolution
  [523, 659, 784].forEach((freq, i) => {
    const delay = 0.7 + i * 0.08;
    playTone(freq, 0.5, 'sine', 0.1, 0.02, 0.2);
    setTimeout(() => playTone(freq, 0.5, 'sine', 0.1, 0.02, 0.2), delay * 1000);
  });
};

export const sfxDamage = () => {
  // Quick harsh buzz - getting hit
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(60, ac.currentTime + 0.2);
  gain.gain.setValueAtTime(0.2, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.25);
  playNoise(0.12, 0.1, 800, 'highpass');
};

export const sfxCheckpoint = () => {
  // Gentle two-note confirmation
  playTone(440, 0.15, 'sine', 0.12, 0.01, 0.05);
  setTimeout(() => playTone(660, 0.2, 'sine', 0.12, 0.01, 0.08), 100);
};

export const sfxWin = () => {
  // Victory melody: ascending major scale flourish
  const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.3, 'sine', 0.12, 0.01, 0.1);
      playTone(freq * 0.5, 0.3, 'sine', 0.06, 0.01, 0.1); // bass octave
    }, i * 90);
  });
  // Final chord
  setTimeout(() => {
    playTone(523, 1.2, 'sine', 0.1, 0.05, 0.4);
    playTone(659, 1.2, 'sine', 0.08, 0.05, 0.4);
    playTone(784, 1.2, 'sine', 0.08, 0.05, 0.4);
    playTone(1047, 1.2, 'sine', 0.06, 0.05, 0.4);
  }, notes.length * 90);
};

// === BACKGROUND MUSIC ===
// Harmonic drone with subtle rhythmic pulse - references both static/noise and classic game ambience
// Each chapter shifts the pitch/tonality for progression

// Chapter base frequencies (ascending tonality as tension builds)
const chapterDrones: [number, number, number, number][] = [
  [65, 98, 196, 262],   // Ch1: C2+G2 - calm, warm
  [73, 110, 220, 294],  // Ch2: D2+A2 - slightly brighter
  [82, 123, 247, 330],  // Ch3: E2+B2 - tension rising
  [98, 147, 294, 392],  // Ch4: G2+D3 - intense, higher
];

let currentBGMChapter = 0;

const buildBGMBuffer = (chapter: number): AudioBuffer => {
  const ac = ensureContext();
  const duration = 8;
  const sampleRate = ac.sampleRate;
  const length = sampleRate * duration;
  const buffer = ac.createBuffer(2, length, sampleRate);
  const [f1, f2, f3, f4] = chapterDrones[chapter] ?? chapterDrones[0];

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Base drone
      let sample = Math.sin(2 * Math.PI * f1 * t) * 0.15;
      sample += Math.sin(2 * Math.PI * f2 * t) * 0.08;
      // Higher harmonic shimmer (varies per channel for stereo width)
      sample += Math.sin(2 * Math.PI * (f3 + ch * 2) * t + Math.sin(t * 0.3) * 2) * 0.04;
      sample += Math.sin(2 * Math.PI * (f4 + ch * 3) * t + Math.sin(t * 0.5) * 1.5) * 0.025;
      // Subtle rhythmic pulse (gets faster in later chapters)
      const pulseRate = 2 + chapter * 0.5;
      const pulse = (Math.sin(2 * Math.PI * pulseRate * t) > 0.3) ? 1.0 : 0.7;
      sample *= pulse;
      // Noise layer (increases subtly per chapter)
      sample += (Math.random() * 2 - 1) * (0.012 + chapter * 0.004);
      // Slow amplitude envelope for breathing feel
      const breath = 0.7 + 0.3 * Math.sin(2 * Math.PI * t / duration);
      sample *= breath;
      data[i] = sample;
    }
  }
  return buffer;
};

export const startBGM = (chapter = 0) => {
  if (bgmPlaying && currentBGMChapter === chapter) return;
  const ac = ensureContext();

  if (bgmSource) {
    bgmSource.stop();
    bgmSource = null;
  }

  currentBGMChapter = chapter;
  bgmPlaying = true;
  bgmSource = ac.createBufferSource();
  bgmSource.buffer = buildBGMBuffer(chapter);
  bgmSource.loop = true;
  bgmSource.connect(bgmGain!);
  bgmSource.start();
};

export const setBGMChapter = (chapter: number) => {
  if (!bgmPlaying) return;
  if (chapter === currentBGMChapter) return;
  startBGM(chapter);
};

export const stopBGM = () => {
  if (bgmSource) {
    bgmSource.stop();
    bgmSource = null;
  }
  bgmPlaying = false;
};

// === LEVEL 2 RUNNER BGM ===
// Melodic, urgent, Jeopardy-style with arpeggios and chord progressions
// Same synth DNA as Level 1 (square/triangle waves) but with harmonic movement

let runnerBGMSource: AudioBufferSourceNode | null = null;
let runnerBGMPlaying = false;

const buildRunnerBGMBuffer = (): AudioBuffer => {
  const ac = ensureContext();
  const bpm = 132;
  const beatDur = 60 / bpm;
  const bars = 8;
  const duration = bars * 4 * beatDur; // 8 bars of 4 beats
  const sampleRate = ac.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ac.createBuffer(2, length, sampleRate);

  // Chord progression: Dm - Gm - Bb - A (i - iv - VI - V) — 2 bars each
  // Frequencies for each chord (root, third, fifth, octave)
  const chords: [number, number, number, number][] = [
    [147, 175, 220, 294],   // Dm: D3, F3, A3, D4
    [196, 233, 294, 392],   // Gm: G3, Bb3, D4, G4
    [117, 147, 175, 233],   // Bb: Bb2, D3, F3, Bb3
    [220, 277, 330, 440],   // A:  A3, C#4, E4, A4
  ];

  // Bass notes (root of each chord, one octave lower)
  const bassNotes = [73.5, 98, 58.5, 110]; // D2, G2, Bb1, A2

  // Arpeggio patterns (indices into chord array) — varied per chord
  const arpPatterns = [
    [0, 1, 2, 3, 2, 1, 0, 2],  // ascending-descending
    [0, 2, 1, 3, 0, 3, 2, 1],  // jumping
    [0, 1, 2, 3, 3, 2, 1, 0],  // up then down
    [2, 0, 3, 1, 2, 3, 0, 1],  // mixed tension
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const beatPos = t / beatDur;
      const barIndex = Math.floor(beatPos / 4);
      const chordIndex = Math.floor(barIndex / 2) % 4;
      const chord = chords[chordIndex];
      const bassFreq = bassNotes[chordIndex];
      const arpPattern = arpPatterns[chordIndex];

      // Position within the beat
      const sixteenthIndex = Math.floor((beatPos % 1) * 4);
      const barBeat = Math.floor(beatPos % 4);
      const arpStep = (barBeat * 4 + sixteenthIndex) % 8;

      // Time within current sixteenth note (0-1)
      const sixteenthT = ((beatPos % 1) * 4) % 1;

      let sample = 0;

      // === LAYER 1: BASS (square wave, quarter notes with decay) ===
      const bassPhase = (t * bassFreq) % 1;
      const bassEnv = Math.max(0, 1 - (beatPos % 1) * 1.8); // decay over beat
      const bassWave = bassPhase < 0.5 ? 1 : -1;
      sample += bassWave * bassEnv * 0.09;
      // Sub-bass (sine, one octave lower)
      sample += Math.sin(2 * Math.PI * bassFreq * 0.5 * t) * bassEnv * 0.06;

      // === LAYER 2: ARPEGGIO (triangle wave, 16th notes) ===
      const arpNoteIndex = arpPattern[arpStep];
      const arpFreq = chord[arpNoteIndex] * (ch === 0 ? 1 : 1.002); // slight stereo detune
      const arpPhase = (t * arpFreq) % 1;
      const arpEnv = Math.max(0, 1 - sixteenthT * 2.5); // quick decay
      // Triangle wave
      const arpWave = 4 * Math.abs(arpPhase - 0.5) - 1;
      sample += arpWave * arpEnv * 0.07;

      // === LAYER 3: TICKING PULSE (8th notes - urgency clock) ===
      const eighthPos = (beatPos * 2) % 1;
      const tickEnv = eighthPos < 0.1 ? (1 - eighthPos / 0.1) : 0;
      // High-pitched tick (noise-like)
      const tickFreq = 1800 + chordIndex * 200;
      sample += Math.sin(2 * Math.PI * tickFreq * t) * tickEnv * 0.025;

      // === LAYER 4: PAD/DRONE (connects to Level 1 DNA) ===
      const padRoot = chord[0] * 0.5;
      const padFifth = chord[2] * 0.5;
      const padBreath = 0.6 + 0.4 * Math.sin(2 * Math.PI * t / (beatDur * 8));
      sample += Math.sin(2 * Math.PI * padRoot * t) * 0.03 * padBreath;
      sample += Math.sin(2 * Math.PI * padFifth * t + Math.sin(t * 0.7) * 1.5) * 0.02 * padBreath;

      // === LAYER 5: MELODIC HOOK (every 2 bars, ascending phrase) ===
      const twoBarPos = (beatPos % 8) / 8; // 0-1 over 2 bars
      if (twoBarPos < 0.5) {
        // First bar: ascending motif on beats 1 and 3
        const motifBeat = barBeat;
        if (motifBeat === 0 || motifBeat === 2) {
          const motifFreq = chord[motifBeat === 0 ? 2 : 3] * 2; // high octave
          const motifEnv = Math.max(0, 1 - (beatPos % 1) * 3);
          sample += Math.sin(2 * Math.PI * motifFreq * t) * motifEnv * 0.035;
        }
      }

      // === SUBTLE NOISE (shared DNA with Level 1) ===
      sample += (Math.random() * 2 - 1) * 0.008;

      // Master envelope: slight fade at loop boundary for seamless loop
      const fadeZone = 0.02; // 2% of duration
      let masterEnv = 1;
      if (t < duration * fadeZone) {
        masterEnv = t / (duration * fadeZone);
      } else if (t > duration * (1 - fadeZone)) {
        masterEnv = (duration - t) / (duration * fadeZone);
      }

      data[i] = sample * masterEnv;
    }
  }
  return buffer;
};

export const startRunnerBGM = () => {
  const ac = ensureContext();
  if (runnerBGMPlaying) return;
  runnerBGMPlaying = true;
  runnerBGMSource = ac.createBufferSource();
  runnerBGMSource.buffer = buildRunnerBGMBuffer();
  runnerBGMSource.loop = true;
  runnerBGMSource.connect(bgmGain!);
  runnerBGMSource.start();
};

export const stopRunnerBGM = () => {
  if (runnerBGMSource) {
    runnerBGMSource.stop();
    runnerBGMSource = null;
  }
  runnerBGMPlaying = false;
};

export const sfxChapterTransition = () => {
  // Subtle whoosh + rising tone for entering a new zone
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.35);
  gain.gain.setValueAtTime(0.08, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.4);
  playNoise(0.2, 0.04, 1200, 'highpass');
};

export const sfxLand = () => {
  // Soft thud when landing from a jump
  playNoise(0.08, 0.06, 300, 'lowpass');
};

export const sfxDeath = () => {
  // Dramatic death: descending chromatic + static burst + low rumble
  const ac = ensureContext();
  // Descending wail
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.8);
  gain.gain.setValueAtTime(0.2, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.9);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.9);
  // Static burst
  playNoise(0.4, 0.15, 3000, 'highpass');
  // Low rumble
  const osc2 = ac.createOscillator();
  const gain2 = ac.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 45;
  gain2.gain.setValueAtTime(0.12, ac.currentTime + 0.2);
  gain2.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);
  osc2.connect(gain2);
  gain2.connect(masterGain!);
  osc2.start(ac.currentTime + 0.2);
  osc2.stop(ac.currentTime + 0.8);
};

export const sfxWarpIn = () => {
  // Materializing: rising shimmer + crystalline arrival
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.3);
  osc.frequency.exponentialRampToValueAtTime(500, ac.currentTime + 0.5);
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.1, ac.currentTime + 0.15);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.5);
  // Sparkle
  setTimeout(() => {
    playTone(880, 0.12, 'sine', 0.08, 0.01, 0.04);
    playTone(1320, 0.1, 'sine', 0.05, 0.01, 0.03);
  }, 250);
};

export const sfxMenuSelect = () => {
  // Tiny click for leaderboard name entry feedback
  playTone(800, 0.04, 'square', 0.05, 0.005, 0.01);
};

export const sfxExtraLife = () => {
  // Angelic sing-song: rising major chord arpeggio with shimmer
  const ac = ensureContext();
  const notes = [523, 659, 784, 1047, 1319]; // C5, E5, G5, C6, E6
  notes.forEach((freq, i) => {
    const delay = i * 0.12;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = Math.sin(i * 1.5) * 8; // gentle shimmer
    gain.gain.setValueAtTime(0, ac.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.15, ac.currentTime + delay + 0.06);
    gain.gain.linearRampToValueAtTime(0.08, ac.currentTime + delay + 0.3);
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + delay + 0.7);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + 0.7);
  });
  // Soft high harmonic pad underneath
  const pad = ac.createOscillator();
  const padGain = ac.createGain();
  pad.type = 'sine';
  pad.frequency.value = 1568; // G6
  padGain.gain.setValueAtTime(0, ac.currentTime);
  padGain.gain.linearRampToValueAtTime(0.04, ac.currentTime + 0.2);
  padGain.gain.linearRampToValueAtTime(0.03, ac.currentTime + 0.8);
  padGain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.2);
  pad.connect(padGain);
  padGain.connect(masterGain!);
  pad.start(ac.currentTime);
  pad.stop(ac.currentTime + 1.2);
};

export const sfxFall = () => {
  // Falling into a pit: descending whistle with doppler + fading echo
  const ac = ensureContext();
  // Falling whistle
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 1.2);
  gain.gain.setValueAtTime(0.18, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.2);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 1.2);
  // Wind whoosh (filtered noise)
  playNoise(1.0, 0.12, 800, 'lowpass');
};

// === RUNNER LEVEL AUDIO ===

export const sfxThrust = () => {
  // Jet/thrust burst: filtered noise + rising tone
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(200, ac.currentTime + 0.08);
  gain.gain.setValueAtTime(0.06, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.1);
  playNoise(0.06, 0.04, 400, 'lowpass');
};

export const sfxStaticHit = () => {
  // Getting hit by static: harsh crackle
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(120, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(40, ac.currentTime + 0.15);
  gain.gain.setValueAtTime(0.2, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.2);
  playNoise(0.12, 0.15, 2000, 'highpass');
};

export const sfxInvincible = () => {
  // Invincibility activate: bright ascending arpeggio
  const ac = ensureContext();
  const freqs = [440, 554, 659, 880];
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const t = ac.currentTime + i * 0.06;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  });
};

export const sfxRunnerWin = () => {
  // Level complete fanfare: major chord sweep
  const ac = ensureContext();
  const freqs = [262, 330, 392, 523, 659];
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const t = ac.currentTime + i * 0.1;
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.4);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(t);
    osc.stop(t + 0.4);
  });
};

// Initialize audio on first user interaction
export const initAudio = () => {
  ensureContext();
};
