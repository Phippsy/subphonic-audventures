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
  const bpm = 138;
  const beatDur = 60 / bpm;
  const bars = 16;
  const duration = bars * 4 * beatDur; // 16 bars
  const sampleRate = ac.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ac.createBuffer(2, length, sampleRate);

  // Extended chord progression: 2 bars each, 8 chords over 16 bars
  // Dm - Am - Bb - Gm - Dm - F - C - A7 (i - v - VI - iv - i - III - VII - V7)
  const chords: number[][] = [
    [147, 175, 220, 294, 349],   // Dm: D3, F3, A3, D4, F4
    [110, 131, 165, 220, 262],   // Am: A2, C3, E3, A3, C4
    [117, 147, 175, 233, 294],   // Bb: Bb2, D3, F3, Bb3, D4
    [98, 117, 147, 196, 233],    // Gm: G2, Bb2, D3, G3, Bb3
    [147, 175, 220, 294, 349],   // Dm: D3, F3, A3, D4, F4
    [175, 220, 262, 349, 440],   // F:  F3, A3, C4, F4, A4
    [131, 165, 196, 262, 330],   // C:  C3, E3, G3, C4, E4
    [220, 277, 330, 415, 440],   // A7: A3, C#4, E4, G#4, A4
  ];

  // Bass line — root notes with passing tones
  const bassLines: number[][] = [
    [73.5, 73.5, 73.5, 69],     // D2, D2, D2, C#2 (chromatic approach)
    [55, 55, 62, 65],            // A1, A1, Bb1, C2 (walking up)
    [58.5, 58.5, 62, 65],       // Bb1, Bb1, B1, C2
    [49, 49, 55, 58.5],         // G1, G1, A1, Bb1
    [73.5, 69, 65, 62],         // D2, C#2, C2, B1 (descending)
    [87.5, 87.5, 82, 78],       // F2, F2, E2, Eb2
    [65, 65, 69, 73.5],         // C2, C2, C#2, D2 (leading back)
    [55, 58.5, 62, 65],         // A1, Bb1, B1, C2 (chromatic build)
  ];

  // Arpeggio patterns — more varied, with rhythmic interest
  const arpPatterns: number[][] = [
    [0, 2, 1, 3, 4, 3, 2, 1, 0, 3, 2, 4, 3, 1, 0, 2],  // flowing
    [0, 0, 2, 3, 4, 4, 3, 2, 1, 1, 3, 4, 2, 2, 0, 1],  // rhythmic doubles
    [4, 3, 2, 1, 0, 1, 2, 3, 4, 2, 0, 3, 1, 4, 2, 0],  // descending start
    [0, 2, 4, 2, 0, 3, 1, 4, 0, 2, 3, 1, 4, 3, 2, 0],  // wide jumps
    [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 3, 1, 0, 2, 4],  // ascending
    [4, 2, 0, 2, 4, 3, 1, 0, 3, 4, 2, 1, 0, 1, 3, 4],  // high emphasis
    [0, 3, 1, 4, 2, 0, 3, 1, 4, 2, 0, 3, 4, 2, 1, 0],  // interval jumps
    [2, 4, 3, 1, 0, 2, 4, 3, 0, 1, 2, 4, 3, 2, 1, 0],  // tension build
  ];

  // Counter-melody: a singable phrase per 2-bar section (beat positions + note indices)
  const melodyPhrases: { beat: number; noteIdx: number; dur: number }[][] = [
    [{ beat: 0, noteIdx: 4, dur: 1.5 }, { beat: 2, noteIdx: 3, dur: 1 }, { beat: 3.5, noteIdx: 2, dur: 0.5 }, { beat: 5, noteIdx: 3, dur: 1.5 }, { beat: 7, noteIdx: 4, dur: 1 }],
    [{ beat: 1, noteIdx: 3, dur: 1 }, { beat: 2.5, noteIdx: 4, dur: 1.5 }, { beat: 4.5, noteIdx: 2, dur: 1 }, { beat: 6, noteIdx: 3, dur: 2 }],
    [{ beat: 0, noteIdx: 2, dur: 2 }, { beat: 2.5, noteIdx: 3, dur: 1.5 }, { beat: 4.5, noteIdx: 4, dur: 1 }, { beat: 6, noteIdx: 2, dur: 1 }, { beat: 7.5, noteIdx: 3, dur: 0.5 }],
    [{ beat: 0.5, noteIdx: 4, dur: 1 }, { beat: 2, noteIdx: 3, dur: 1 }, { beat: 3.5, noteIdx: 2, dur: 1.5 }, { beat: 5.5, noteIdx: 1, dur: 1 }, { beat: 7, noteIdx: 2, dur: 1 }],
    [{ beat: 0, noteIdx: 3, dur: 1 }, { beat: 1.5, noteIdx: 4, dur: 1.5 }, { beat: 3.5, noteIdx: 3, dur: 0.5 }, { beat: 4.5, noteIdx: 2, dur: 1.5 }, { beat: 6.5, noteIdx: 4, dur: 1.5 }],
    [{ beat: 0, noteIdx: 4, dur: 2 }, { beat: 2.5, noteIdx: 3, dur: 1 }, { beat: 4, noteIdx: 4, dur: 1 }, { beat: 5.5, noteIdx: 3, dur: 1 }, { beat: 7, noteIdx: 4, dur: 1 }],
    [{ beat: 0.5, noteIdx: 3, dur: 1.5 }, { beat: 2.5, noteIdx: 2, dur: 1 }, { beat: 4, noteIdx: 3, dur: 1.5 }, { beat: 6, noteIdx: 4, dur: 2 }],
    [{ beat: 0, noteIdx: 4, dur: 1 }, { beat: 1.5, noteIdx: 3, dur: 1 }, { beat: 3, noteIdx: 4, dur: 1 }, { beat: 4.5, noteIdx: 3, dur: 0.5 }, { beat: 5.5, noteIdx: 4, dur: 2.5 }],
  ];

  // Swing feel: offset every other 16th note slightly
  const swingAmount = 0.08; // proportion of 16th note duration

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const beatPos = t / beatDur;
      const barIndex = Math.floor(beatPos / 4);
      const chordIndex = Math.floor(barIndex / 2) % 8;
      const chord = chords[chordIndex];
      const bassLine = bassLines[chordIndex];
      const arpPattern = arpPatterns[chordIndex];
      const intensity = barIndex / bars; // 0-1 builds over entire loop

      // Position within the bar/beat
      const barBeat = beatPos % 4;
      const rawSixteenth = Math.floor(barBeat * 4);
      // Apply swing to even-numbered 16ths
      const sixteenthInBeat = rawSixteenth % 4;
      const swingOffset = (sixteenthInBeat % 2 === 1) ? swingAmount : 0;
      const sixteenthT = ((barBeat * 4 + swingOffset) % 1);
      const arpStep = (Math.floor(barBeat * 4)) % 16;

      // Which beat of the bar (for bass walking)
      const currentBeatInBar = Math.floor(barBeat);
      const bassFreq = bassLine[currentBeatInBar % 4];

      let sample = 0;

      // === LAYER 1: WALKING BASS (square + sine, syncopated) ===
      const bassPhase = (t * bassFreq) % 1;
      // Dotted eighth rhythm: accent on beats 1, 2.5, 4
      const bassSyncPattern = (barBeat % 1);
      const bassAccent = (currentBeatInBar === 0 || currentBeatInBar === 3) ? 1.0 :
                         (barBeat % 1 > 0.4 && barBeat % 1 < 0.6) ? 0.8 : 0.5;
      const bassEnv = Math.max(0, 1 - bassSyncPattern * 2.0) * bassAccent;
      const bassWave = bassPhase < 0.5 ? 1 : -1;
      sample += bassWave * bassEnv * (0.07 + intensity * 0.03);
      // Sub-bass (sine)
      sample += Math.sin(2 * Math.PI * bassFreq * 0.5 * t) * bassEnv * 0.05;
      // Bass harmonics (add grit)
      sample += Math.sin(2 * Math.PI * bassFreq * 3 * t) * bassEnv * 0.015 * intensity;

      // === LAYER 2: ARPEGGIO (triangle wave, 16th notes with swing) ===
      const arpNoteIndex = arpPattern[arpStep];
      const arpFreq = chord[arpNoteIndex] * (ch === 0 ? 1 : 1.003);
      const arpPhase = (t * arpFreq) % 1;
      // Velocity accents: every 4th 16th louder
      const arpAccent = (arpStep % 4 === 0) ? 1.0 : (arpStep % 4 === 2) ? 0.7 : 0.5;
      const arpEnv = Math.max(0, 1 - sixteenthT * 2.2) * arpAccent;
      const arpWave = 4 * Math.abs(arpPhase - 0.5) - 1;
      sample += arpWave * arpEnv * (0.05 + intensity * 0.025);

      // === LAYER 3: COUNTER-MELODY (sine + slight saw, longer notes) ===
      const melPhrase = melodyPhrases[chordIndex];
      const barBeatAbs = (barIndex % 2) * 4 + barBeat; // 0-8 within 2-bar phrase
      let melSample = 0;
      for (const note of melPhrase) {
        if (barBeatAbs >= note.beat && barBeatAbs < note.beat + note.dur) {
          const noteProgress = (barBeatAbs - note.beat) / note.dur;
          // ADSR-ish: attack 10%, sustain, release 30%
          let melEnv = 1;
          if (noteProgress < 0.1) melEnv = noteProgress / 0.1;
          else if (noteProgress > 0.7) melEnv = (1 - noteProgress) / 0.3;
          const melFreq = chord[note.noteIdx] * 2 * (ch === 0 ? 1 : 0.998);
          // Sine with vibrato
          const vibrato = Math.sin(2 * Math.PI * 5.5 * t) * 3 * noteProgress;
          melSample += Math.sin(2 * Math.PI * (melFreq + vibrato) * t) * melEnv;
          // Add subtle sawtooth harmonic
          const melPhase2 = (t * melFreq * 2) % 1;
          melSample += (melPhase2 * 2 - 1) * melEnv * 0.15;
        }
      }
      sample += melSample * (0.03 + intensity * 0.015);

      // === LAYER 4: URGENCY TICK (syncopated, pitch rises with intensity) ===
      const tickPattern = [1, 0, 1, 0, 1, 1, 0, 1]; // syncopated 8th note pattern
      const eighthIndex = Math.floor(barBeat * 2) % 8;
      const eighthT = (barBeat * 2) % 1;
      if (tickPattern[eighthIndex]) {
        const tickEnv = eighthT < 0.08 ? (1 - eighthT / 0.08) : 0;
        const tickFreq = 2200 + chordIndex * 150 + intensity * 600;
        sample += Math.sin(2 * Math.PI * tickFreq * t) * tickEnv * (0.02 + intensity * 0.01);
        // Second partial for metallic feel
        sample += Math.sin(2 * Math.PI * tickFreq * 2.7 * t) * tickEnv * 0.008;
      }

      // === LAYER 5: PAD (evolving, filter sweep) ===
      const padRoot = chord[0] * 0.5;
      const padThird = chord[1] * 0.5;
      const padFifth = chord[2] * 0.5;
      // Slow filter sweep (simulated via harmonic mix)
      const filterSweep = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / (duration * 0.25)));
      const padBreath = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / (beatDur * 16));
      const padVol = padBreath * 0.025 * (0.7 + intensity * 0.3);
      sample += Math.sin(2 * Math.PI * padRoot * t) * padVol;
      sample += Math.sin(2 * Math.PI * padThird * t + Math.sin(t * 0.4) * 1.2) * padVol * 0.7;
      sample += Math.sin(2 * Math.PI * padFifth * t + Math.sin(t * 0.6) * 1.5) * padVol * filterSweep;
      // 7th for colour (adds tension)
      const pad7th = chord[3] * 0.25;
      sample += Math.sin(2 * Math.PI * pad7th * t) * padVol * 0.3 * intensity;

      // === LAYER 6: RHYTHMIC STABS (off-beat hits, builds energy) ===
      if (intensity > 0.3) {
        // Stabs on the "and" of beats 2 and 4
        const stabBeats = [1.5, 3.5];
        for (const sb of stabBeats) {
          const distToStab = barBeat - sb;
          if (distToStab >= 0 && distToStab < 0.15) {
            const stabEnv = 1 - distToStab / 0.15;
            const stabFreq = chord[2] * (ch === 0 ? 2 : 2.01);
            const stabWave = ((t * stabFreq) % 1 < 0.5 ? 1 : -1); // square
            sample += stabWave * stabEnv * 0.03 * (intensity - 0.3) / 0.7;
          }
        }
      }

      // === LAYER 7: FILLS (every 4 bars on bar 4, beat 4) ===
      if (barIndex % 4 === 3 && currentBeatInBar === 3) {
        // Rapid descending 32nd notes
        const fillStep = Math.floor(barBeat % 1 * 8);
        const fillFreq = chord[4] * 2 * Math.pow(0.92, fillStep);
        const fillT = (barBeat % 1 * 8) % 1;
        const fillEnv = fillT < 0.5 ? (1 - fillT * 2) : 0;
        sample += Math.sin(2 * Math.PI * fillFreq * t) * fillEnv * 0.04;
      }

      // === SUBTLE NOISE (shared DNA with Level 1, less prominent) ===
      sample += (Math.random() * 2 - 1) * 0.005;

      // Master envelope for seamless loop
      const fadeZone = 0.015;
      let masterEnv = 1;
      if (t < duration * fadeZone) {
        masterEnv = t / (duration * fadeZone);
      } else if (t > duration * (1 - fadeZone)) {
        masterEnv = (duration - t) / (duration * fadeZone);
      }

      data[i] = sample * masterEnv * 0.92; // slight headroom
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

// === LEVEL 3 BOSS BGM ===
// Dark, intense, driving boss battle music — minor key with dissonant tension

let bossBGMSource: AudioBufferSourceNode | null = null;
let bossBGMPlaying = false;

const buildBossBGMBuffer = (): AudioBuffer => {
  const ac = ensureContext();
  const bpm = 150;
  const beatDur = 60 / bpm;
  const bars = 8;
  const duration = bars * 4 * beatDur;
  const sampleRate = ac.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ac.createBuffer(2, length, sampleRate);

  // Dark chord progression: Em - C - Dm - Bb (repeating, tension throughout)
  const chords: number[][] = [
    [82, 165, 196, 247, 330],   // Em: E2, E3, G3, B3, E4
    [65, 131, 165, 196, 262],   // C:  C2, C3, E3, G3, C4
    [73, 147, 175, 220, 294],   // Dm: D2, D3, F3, A3, D4
    [58, 117, 147, 175, 233],   // Bb: Bb1, Bb2, D3, F3, Bb3
    [82, 165, 196, 247, 330],   // Em
    [65, 131, 165, 196, 262],   // C
    [55, 110, 131, 165, 220],   // Am: A1, A2, C3, E3, A3
    [62, 123, 147, 196, 247],   // B:  B1, B2, D3, G3, B3 (dominant tension)
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const beatPos = t / beatDur;
      const barIndex = Math.floor(beatPos / 4);
      const chordIndex = barIndex % 8;
      const chord = chords[chordIndex];
      const barBeat = beatPos % 4;
      const currentBeatInBar = Math.floor(barBeat);
      const intensity = 0.6 + 0.4 * (barIndex / bars);

      let sample = 0;

      // === HEAVY BASS (distorted pulse) ===
      const bassFreq = chord[0];
      const bassPhase = (t * bassFreq) % 1;
      const bassEnv = Math.max(0, 1 - (barBeat % 1) * 1.5);
      const bassWave = bassPhase < 0.3 ? 1 : -1; // asymmetric pulse
      sample += bassWave * bassEnv * 0.09 * intensity;
      // Sub
      sample += Math.sin(2 * Math.PI * bassFreq * 0.5 * t) * 0.06 * bassEnv;

      // === DRIVING 8TH NOTE RHYTHM (distorted saw) ===
      const eighthBeat = (barBeat * 2) % 1;
      const eighthEnv = eighthBeat < 0.5 ? (1 - eighthBeat * 1.5) : 0;
      const rhythmFreq = chord[2] * (ch === 0 ? 1 : 1.005);
      const rhythmPhase = (t * rhythmFreq) % 1;
      sample += (rhythmPhase * 2 - 1) * eighthEnv * 0.04 * intensity;
      // Power chord (fifth)
      const fifthFreq = chord[3] * (ch === 0 ? 1 : 0.997);
      sample += ((t * fifthFreq) % 1 * 2 - 1) * eighthEnv * 0.025 * intensity;

      // === MENACING ARPEGGIO (16th notes, high register) ===
      const arpStep = Math.floor(barBeat * 4) % 16;
      const arpPatterns = [0, 4, 3, 2, 4, 1, 3, 0, 4, 2, 1, 3, 0, 4, 2, 3];
      const arpNoteIdx = arpPatterns[arpStep];
      const arpFreq = chord[arpNoteIdx] * 2 * (ch === 0 ? 1 : 1.002);
      const sixteenthT = (barBeat * 4) % 1;
      const arpEnv = Math.max(0, 1 - sixteenthT * 2.5) * (arpStep % 4 === 0 ? 1 : 0.6);
      sample += (4 * Math.abs((t * arpFreq) % 1 - 0.5) - 1) * arpEnv * 0.03;

      // === DISSONANT PAD (tritone tension) ===
      const padFreq1 = chord[1] * 0.5;
      const padFreq2 = padFreq1 * 1.414; // tritone
      const padBreath = 0.4 + 0.6 * Math.sin(2 * Math.PI * t / (duration * 0.5));
      sample += Math.sin(2 * Math.PI * padFreq1 * t) * 0.02 * padBreath;
      sample += Math.sin(2 * Math.PI * padFreq2 * t + Math.sin(t * 2) * 0.8) * 0.015 * padBreath;

      // === WAR DRUMS (kick on 1/3, snare on 2/4) ===
      const kickBeats = [0, 2];
      const snareBeats = [1, 3];
      for (const kb of kickBeats) {
        const distToKick = barBeat - kb;
        if (distToKick >= 0 && distToKick < 0.15) {
          const kickEnv = 1 - distToKick / 0.15;
          const kickFreq = 60 - distToKick * 200;
          sample += Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.12;
        }
      }
      for (const sb of snareBeats) {
        const distToSnare = barBeat - sb;
        if (distToSnare >= 0 && distToSnare < 0.1) {
          const snareEnv = 1 - distToSnare / 0.1;
          sample += (Math.random() * 2 - 1) * snareEnv * 0.08;
          sample += Math.sin(2 * Math.PI * 200 * t) * snareEnv * 0.04;
        }
      }

      // === NOISE CRACKLE (atmospheric) ===
      if (currentBeatInBar % 2 === 1 && intensity > 0.7) {
        sample += (Math.random() * 2 - 1) * 0.008;
      }

      // Master envelope
      const fadeZone = 0.01;
      let masterEnv = 1;
      if (t < duration * fadeZone) masterEnv = t / (duration * fadeZone);
      else if (t > duration * (1 - fadeZone)) masterEnv = (duration - t) / (duration * fadeZone);

      data[i] = sample * masterEnv * 0.85;
    }
  }
  return buffer;
};

export const startBossBGM = () => {
  const ac = ensureContext();
  if (bossBGMPlaying) return;
  bossBGMPlaying = true;
  bossBGMSource = ac.createBufferSource();
  bossBGMSource.buffer = buildBossBGMBuffer();
  bossBGMSource.loop = true;
  bossBGMSource.connect(bgmGain!);
  bossBGMSource.start();
};

export const stopBossBGM = () => {
  if (bossBGMSource) {
    bossBGMSource.stop();
    bossBGMSource = null;
  }
  bossBGMPlaying = false;
};

// Boss-specific SFX
export const sfxBossHit = () => {
  // Impact on boss: heavy thud with metallic ring
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.2);
  gain.gain.setValueAtTime(0.2, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.25);
  // Metallic ring
  playTone(800, 0.15, 'triangle', 0.08, 0.01, 0.05);
  playNoise(0.08, 0.06, 1500, 'bandpass');
};

export const sfxBossBeam = () => {
  // Charging beam: rising static burst
  const ac = ensureContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.3);
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.12, ac.currentTime + 0.15);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.4);
  playNoise(0.3, 0.1, 3000, 'highpass');
};

export const sfxPlayerShoot = () => {
  // Green sig projectile: quick pew sound
  playTone(600, 0.06, 'square', 0.1, 0.005, 0.02);
  playTone(900, 0.04, 'triangle', 0.05, 0.005, 0.01);
};

export const sfxBossDefeat = () => {
  // Epic defeat: descending explosion + victory fanfare
  const ac = ensureContext();
  // Explosion rumble
  playNoise(1.5, 0.2, 400, 'lowpass');
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, ac.currentTime + 1.2);
  gain.gain.setValueAtTime(0.15, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 1.5);
  // Victory chime after delay
  setTimeout(() => {
    const freqs = [523, 659, 784, 1047];
    freqs.forEach((f, i) => {
      const osc2 = ac.createOscillator();
      const gain2 = ac.createGain();
      osc2.type = 'triangle';
      osc2.frequency.value = f;
      const t2 = ac.currentTime + i * 0.15;
      gain2.gain.setValueAtTime(0.15, t2);
      gain2.gain.linearRampToValueAtTime(0, t2 + 0.5);
      osc2.connect(gain2);
      gain2.connect(masterGain!);
      osc2.start(t2);
      osc2.stop(t2 + 0.5);
    });
  }, 800);
};
