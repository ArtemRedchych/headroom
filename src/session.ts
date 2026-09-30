import { computeScore, type FocusWindow, type HumanEffort, type ScoreBreakdown } from "./score";

export interface SessionEvent {
  type: "prompt" | "response" | "skim" | "failure" | "edit";
  at: number;
  words?: number;
  gapMs?: number;
  tool?: string;
  excerpt?: string;
}

export const SIMULATED_SESSION_MS = 130 * 60_000;

export function statusText(score: number, effort: HumanEffort, breakActive: boolean): string {
  return `🧠 ${score}% · Human: ${effort.toUpperCase()}${breakActive ? " · BREAK" : ""}`;
}

export function effortGuidance(effort: HumanEffort): string {
  const guidance: Record<HumanEffort, string> = {
    low: [
      "Human Effort is LOW. This is a communication preference. Keep reasoning as deep as the task needs.",
      "Lead with the recommendation.",
      "Use at most 3 short reasons.",
      "State the risk.",
      "Skip background the user did not ask for.",
      "Offer a deeper explanation instead of including it.",
      "High-risk decisions stay explicit.",
    ].join("\n"),
    medium: [
      "Human Effort is MEDIUM.",
      "Be concise.",
      "Give a recommendation when one is clear.",
      "Include only the key tradeoff.",
      "Skip extra background.",
    ].join("\n"),
    high: [
      "Human Effort is HIGH.",
      "The user wants detail.",
      "Explain the real alternatives and the tradeoff for each.",
      "Include the reasoning they need to decide.",
      "Put the recommendation early so the rest is optional.",
    ].join("\n"),
  };
  return guidance[effort];
}

export function simulatedEvents(now: number): SessionEvent[] {
  return [
    ...Array.from({ length: 15 }, () => ({ type: "prompt" as const, at: now - 30_000 })),
    ...Array.from({ length: 4 }, () => ({ type: "skim" as const, at: now - 60_000, words: 180, gapMs: 2_000 })),
    ...Array.from({ length: 4 }, (_, index) => ({
      type: "failure" as const,
      at: now - (index + 1) * 60_000,
      tool: "Shell",
    })),
  ];
}

export function scoreFromEvents(
  now: number,
  sessionStartedAt: number,
  events: SessionEvent[],
  focusWindows: FocusWindow[],
): ScoreBreakdown {
  return computeScore({
    now,
    sessionStartedAt,
    promptTimestamps: events.filter((event) => event.type === "prompt").map((event) => event.at),
    failureTimestamps: events.filter((event) => event.type === "failure").map((event) => event.at),
    skimmingTimestamps: events.filter((event) => event.type === "skim").map((event) => event.at),
    focusWindows,
  });
}

export function buildSummary(events: SessionEvent[], since: number): string {
  const during = events.filter((event) => event.at >= since);
  const edits = during.filter((event) => event.type === "edit").length;
  const failures = during.filter((event) => event.type === "failure").length;
  const last = [...during].reverse().find((event) => event.type === "response" && event.excerpt);
  return [
    "While you were away:",
    `✓ ${edits} file edit${edits === 1 ? "" : "s"}`,
    `✓ ${failures} tool failure${failures === 1 ? "" : "s"}`,
    last?.excerpt ? `✓ Last reply: ${last.excerpt}` : "✓ No agent reply recorded during the break",
    "",
    "Needs your attention:",
    "⚠ Review anything the agent stopped before deciding.",
  ].join("\n");
}
