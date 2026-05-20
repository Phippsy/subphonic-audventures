// Level completion persistence
// Tracks which levels have been completed

const PROGRESS_KEY = 'subphonic-audventures-progress-v1';

export interface LevelProgress {
  level1Complete: boolean;
  level2Complete: boolean;
}

export function loadProgress(): LevelProgress {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) return { level1Complete: false, level2Complete: false };
  try {
    const parsed = JSON.parse(raw) as Partial<LevelProgress>;
    return {
      level1Complete: parsed.level1Complete ?? false,
      level2Complete: parsed.level2Complete ?? false,
    };
  } catch {
    return { level1Complete: false, level2Complete: false };
  }
}

export function saveProgress(progress: LevelProgress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function markLevel1Complete(): void {
  const p = loadProgress();
  p.level1Complete = true;
  saveProgress(p);
}

export function markLevel2Complete(): void {
  const p = loadProgress();
  p.level2Complete = true;
  saveProgress(p);
}

export function isLevel2Unlocked(): boolean {
  return loadProgress().level1Complete;
}
