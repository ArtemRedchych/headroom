export type HumanEffort = "low" | "medium" | "high";

export interface FocusWindow {
  from: string;
  to: string;
  capacity: number;
}

export interface ScoreSignals {
  now: number;
  sessionStartedAt: number;
  promptTimestamps: number[];
  failureTimestamps: number[];
  skimmingTimestamps: number[];
  focusWindows: FocusWindow[];
  timeZone?: string;
}

export interface ScoreBreakdown {
  score: number;
  baseline: number;
  sessionPenalty: number;
  promptPenalty: number;
  skimmingPenalty: number;
  failurePenalty: number;
  lines: string[];
}

export interface SuggestionState {
  armed: boolean;
  suppressUntil: number;
  breakActive: boolean;
}

export interface SuggestionDecision {
  suggest: boolean;
  armed: boolean;
  suppressUntil: number;
}

export const SCORE = {
  fallbackBaseline: 70,
  sessionFreeMinutes: 45,
  sessionStepMinutes: 3,
  sessionPenaltyCap: 25,
  promptWindowMs: 10 * 60_000,
  promptFreeCount: 8,
  promptPenaltyEach: 4,
  promptPenaltyCap: 20,
  skimWindowMs: 30 * 60_000,
  skimPenaltyEach: 8,
  skimPenaltyCap: 24,
  failureWindowMs: 15 * 60_000,
  failurePenaltyEach: 6,
  failurePenaltyCap: 18,
  longResponseWords: 80,
  skimGapMs: 10_000,
  recoveredAbove: 50,
  suppressMs: 30 * 60_000,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function isPossibleSkim(words: number, gapMs: number): boolean {
  return words >= SCORE.longResponseWords && gapMs >= 0 && gapMs < SCORE.skimGapMs;
}

function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function zonedParts(nowMs: number, timeZone: string | undefined): { hour: number; minute: number } {
  const date = new Date(nowMs);
  if (!timeZone) {
    return { hour: date.getHours(), minute: date.getMinutes() };
  }
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return { hour: date.getHours(), minute: date.getMinutes() };
    }
    return { hour, minute };
  } catch {
    return { hour: date.getHours(), minute: date.getMinutes() };
  }
}

export function focusBaseline(nowMs: number, windows: FocusWindow[], timeZone?: string): number {
  const { hour, minute } = zonedParts(nowMs, timeZone);
  const clock = hour * 60 + minute;
  for (const window of windows) {
    const from = parseHHMM(window.from);
    const to = parseHHMM(window.to);
    if (from === null || to === null) continue;
    const inside = from <= to ? clock >= from && clock < to : clock >= from || clock < to;
    if (inside) return clamp(window.capacity, 0, 100);
  }
  return SCORE.fallbackBaseline;
}

function countRecent(timestamps: number[], now: number, windowMs: number): number {
  return timestamps.filter((timestamp) => now - timestamp <= windowMs && timestamp <= now).length;
}

export function computeScore(signals: ScoreSignals): ScoreBreakdown {
  const baseline = focusBaseline(signals.now, signals.focusWindows, signals.timeZone);
  const sessionMinutes = Math.max(0, (signals.now - signals.sessionStartedAt) / 60_000);
  const sessionPenalty =
    sessionMinutes > SCORE.sessionFreeMinutes
      ? Math.min(
          SCORE.sessionPenaltyCap,
          Math.floor((sessionMinutes - SCORE.sessionFreeMinutes) / SCORE.sessionStepMinutes),
        )
      : 0;
  const prompts = countRecent(signals.promptTimestamps, signals.now, SCORE.promptWindowMs);
  const promptPenalty = Math.min(
    SCORE.promptPenaltyCap,
    Math.max(0, prompts - SCORE.promptFreeCount) * SCORE.promptPenaltyEach,
  );
  const skims = countRecent(signals.skimmingTimestamps, signals.now, SCORE.skimWindowMs);
  const skimmingPenalty = Math.min(SCORE.skimPenaltyCap, skims * SCORE.skimPenaltyEach);
  const failures = countRecent(signals.failureTimestamps, signals.now, SCORE.failureWindowMs);
  const failurePenalty = Math.min(SCORE.failurePenaltyCap, failures * SCORE.failurePenaltyEach);
  const score = clamp(baseline - sessionPenalty - promptPenalty - skimmingPenalty - failurePenalty, 0, 100);
  return {
    score,
    baseline,
    sessionPenalty,
    promptPenalty,
    skimmingPenalty,
    failurePenalty,
    lines: [
      `baseline ${baseline}`,
      `session -${sessionPenalty} (${Math.round(sessionMinutes)} min)`,
      `prompts -${promptPenalty} (${prompts} in 10 min)`,
      `possible skimming -${skimmingPenalty} (${skims} in 30 min)`,
      `failures -${failurePenalty} (${failures} in 15 min)`,
      `score ${score}`,
    ],
  };
}

export function nextSuggestion(
  state: SuggestionState,
  score: number,
  now: number,
  threshold: number,
): SuggestionDecision {
  let armed = state.armed;
  if (score >= SCORE.recoveredAbove || now >= state.suppressUntil) {
    armed = true;
  }
  if (state.breakActive || now < state.suppressUntil || score >= threshold || !armed) {
    return { suggest: false, armed, suppressUntil: state.suppressUntil };
  }
  return {
    suggest: true,
    armed: false,
    suppressUntil: now + SCORE.suppressMs,
  };
}
