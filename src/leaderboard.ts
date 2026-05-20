// Leaderboard module — localStorage + remote Cloudflare Worker API

const LEADERBOARD_KEY = 'subphonic-audventures-leaderboard-v1';
const TIME_LEADERBOARD_KEY = 'subphonic-audventures-leaderboard-time-v1';
const MAX_ENTRIES = 10;
const API_BASE = 'https://subphonic-leaderboard.subphonic.workers.dev';

export type LeaderboardEntry = {
  name: string;
  score: number;
  date: string;
};

export type TimeLeaderboardEntry = {
  name: string;
  time: number; // seconds
  date: string;
};

// --- Local storage helpers ---

const getLocalScores = (): LeaderboardEntry[] => {
  const raw = localStorage.getItem(LEADERBOARD_KEY);
  if (!raw) return [];
  try { return (JSON.parse(raw) as LeaderboardEntry[]).slice(0, MAX_ENTRIES); }
  catch { return []; }
};

const setLocalScores = (board: LeaderboardEntry[]) => {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
};

const getLocalTimes = (): TimeLeaderboardEntry[] => {
  const raw = localStorage.getItem(TIME_LEADERBOARD_KEY);
  if (!raw) return [];
  try { return (JSON.parse(raw) as TimeLeaderboardEntry[]).slice(0, MAX_ENTRIES); }
  catch { return []; }
};

const setLocalTimes = (board: TimeLeaderboardEntry[]) => {
  localStorage.setItem(TIME_LEADERBOARD_KEY, JSON.stringify(board));
};

// --- Remote sync (fire-and-forget, updates local on success) ---

const fetchRemoteScores = async (): Promise<LeaderboardEntry[]> => {
  try {
    const res = await fetch(`${API_BASE}/scores`);
    if (!res.ok) return [];
    return await res.json() as LeaderboardEntry[];
  } catch { return []; }
};

const postRemoteScore = async (entry: LeaderboardEntry): Promise<LeaderboardEntry[]> => {
  try {
    const res = await fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) return [];
    return await res.json() as LeaderboardEntry[];
  } catch { return []; }
};

const fetchRemoteTimes = async (): Promise<TimeLeaderboardEntry[]> => {
  try {
    const res = await fetch(`${API_BASE}/times`);
    if (!res.ok) return [];
    return await res.json() as TimeLeaderboardEntry[];
  } catch { return []; }
};

const postRemoteTime = async (entry: TimeLeaderboardEntry): Promise<TimeLeaderboardEntry[]> => {
  try {
    const res = await fetch(`${API_BASE}/times`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) return [];
    return await res.json() as TimeLeaderboardEntry[];
  } catch { return []; }
};

// --- Merge remote into local (union, re-sort, trim) ---

const mergeScores = (local: LeaderboardEntry[], remote: LeaderboardEntry[]): LeaderboardEntry[] => {
  const map = new Map<string, LeaderboardEntry>();
  for (const e of [...local, ...remote]) {
    const key = `${e.name}|${e.score}|${e.date}`;
    if (!map.has(key)) map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
};

const mergeTimes = (local: TimeLeaderboardEntry[], remote: TimeLeaderboardEntry[]): TimeLeaderboardEntry[] => {
  const map = new Map<string, TimeLeaderboardEntry>();
  for (const e of [...local, ...remote]) {
    const key = `${e.name}|${e.time}|${e.date}`;
    if (!map.has(key)) map.set(key, e);
  }
  return [...map.values()].sort((a, b) => a.time - b.time).slice(0, MAX_ENTRIES);
};

// --- Public API (same interface as before) ---

export const getLeaderboard = (): LeaderboardEntry[] => getLocalScores();

export const addToLeaderboard = (name: string, score: number): LeaderboardEntry[] => {
  const sanitizedName = name.trim().slice(0, 16) || 'ANON';
  const entry: LeaderboardEntry = {
    name: sanitizedName,
    score,
    date: new Date().toISOString().slice(0, 10),
  };
  const board = getLocalScores();
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, MAX_ENTRIES);
  setLocalScores(trimmed);
  // Sync to remote (fire-and-forget, merge result back)
  postRemoteScore(entry).then(remote => {
    if (remote.length > 0) setLocalScores(mergeScores(getLocalScores(), remote));
  });
  return trimmed;
};

export const isHighScore = (score: number): boolean => {
  const board = getLocalScores();
  if (board.length < MAX_ENTRIES) return true;
  return score > (board[board.length - 1]?.score ?? 0);
};

export const getTimeLeaderboard = (): TimeLeaderboardEntry[] => getLocalTimes();

export const addToTimeLeaderboard = (name: string, time: number): TimeLeaderboardEntry[] => {
  const sanitizedName = name.trim().slice(0, 16) || 'ANON';
  const entry: TimeLeaderboardEntry = {
    name: sanitizedName,
    time,
    date: new Date().toISOString().slice(0, 10),
  };
  const board = getLocalTimes();
  board.push(entry);
  board.sort((a, b) => a.time - b.time);
  const trimmed = board.slice(0, MAX_ENTRIES);
  setLocalTimes(trimmed);
  // Sync to remote (fire-and-forget, merge result back)
  postRemoteTime(entry).then(remote => {
    if (remote.length > 0) setLocalTimes(mergeTimes(getLocalTimes(), remote));
  });
  return trimmed;
};

export const isFastestTime = (time: number): boolean => {
  const board = getLocalTimes();
  if (board.length < MAX_ENTRIES) return true;
  return time < (board[board.length - 1]?.time ?? Infinity);
};

export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
};

// === LEVEL 2 LEADERBOARD (separate storage & endpoints) ===

const L2_LEADERBOARD_KEY = 'subphonic-audventures-leaderboard-l2-v1';

const getLocalL2Scores = (): LeaderboardEntry[] => {
  const raw = localStorage.getItem(L2_LEADERBOARD_KEY);
  if (!raw) return [];
  try { return (JSON.parse(raw) as LeaderboardEntry[]).slice(0, MAX_ENTRIES); }
  catch { return []; }
};

const setLocalL2Scores = (board: LeaderboardEntry[]) => {
  localStorage.setItem(L2_LEADERBOARD_KEY, JSON.stringify(board));
};

const fetchRemoteL2Scores = async (): Promise<LeaderboardEntry[]> => {
  try {
    const res = await fetch(`${API_BASE}/scores-l2`);
    if (!res.ok) return [];
    return await res.json() as LeaderboardEntry[];
  } catch { return []; }
};

const postRemoteL2Score = async (entry: LeaderboardEntry): Promise<LeaderboardEntry[]> => {
  try {
    const res = await fetch(`${API_BASE}/scores-l2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) return [];
    return await res.json() as LeaderboardEntry[];
  } catch { return []; }
};

export const getL2Leaderboard = (): LeaderboardEntry[] => getLocalL2Scores();

export const addToL2Leaderboard = (name: string, score: number): LeaderboardEntry[] => {
  const sanitizedName = name.trim().slice(0, 16) || 'ANON';
  const entry: LeaderboardEntry = {
    name: sanitizedName,
    score,
    date: new Date().toISOString().slice(0, 10),
  };
  const board = getLocalL2Scores();
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, MAX_ENTRIES);
  setLocalL2Scores(trimmed);
  postRemoteL2Score(entry).then(remote => {
    if (remote.length > 0) setLocalL2Scores(mergeScores(getLocalL2Scores(), remote));
  });
  return trimmed;
};

export const isL2HighScore = (score: number): boolean => {
  const board = getLocalL2Scores();
  if (board.length < MAX_ENTRIES) return true;
  return score > (board[board.length - 1]?.score ?? 0);
};

// --- Initial sync on load: pull remote leaderboards into local ---
fetchRemoteScores().then(remote => {
  if (remote.length > 0) setLocalScores(mergeScores(getLocalScores(), remote));
});
fetchRemoteTimes().then(remote => {
  if (remote.length > 0) setLocalTimes(mergeTimes(getLocalTimes(), remote));
});
fetchRemoteL2Scores().then(remote => {
  if (remote.length > 0) setLocalL2Scores(mergeScores(getLocalL2Scores(), remote));
});
