import assert from "node:assert/strict";
import test from "node:test";
import { computeScore, focusBaseline, isPossibleSkim, nextSuggestion, type FocusWindow } from "./score";

const windows: FocusWindow[] = [
  { from: "08:00", to: "11:00", capacity: 100 },
  { from: "11:00", to: "17:00", capacity: 55 },
  { from: "17:00", to: "19:00", capacity: 90 },
];

const at = (iso: string) => Date.parse(iso);

test("focus baseline uses the window that contains the clock", () => {
  assert.equal(focusBaseline(at("2026-09-30T09:30:00Z"), windows), 100);
  assert.equal(focusBaseline(at("2026-09-30T11:00:00Z"), windows), 55);
  assert.equal(focusBaseline(at("2026-09-30T18:15:00Z"), windows), 90);
  assert.equal(focusBaseline(at("2026-09-30T21:00:00Z"), windows), 70);
});

test("focus baseline wraps windows that cross midnight", () => {
  const overnight: FocusWindow[] = [{ from: "22:00", to: "02:00", capacity: 40 }];
  assert.equal(focusBaseline(at("2026-09-30T23:10:00Z"), overnight), 40);
  assert.equal(focusBaseline(at("2026-09-30T01:10:00Z"), overnight), 40);
  assert.equal(focusBaseline(at("2026-09-30T03:00:00Z"), overnight), 70);
});

test("score subtracts session, prompt, skimming, and failure pressure", () => {
  const now = at("2026-09-30T12:00:00Z");
  const breakdown = computeScore({
    now,
    sessionStartedAt: now - 90 * 60_000,
    promptTimestamps: Array.from({ length: 14 }, () => now - 60_000),
    failureTimestamps: [now - 60_000, now - 2 * 60_000],
    skimmingTimestamps: [now - 5 * 60_000],
    focusWindows: windows,
  });
  assert.equal(breakdown.baseline, 55);
  assert.equal(breakdown.sessionPenalty, 15);
  assert.equal(breakdown.promptPenalty, 20);
  assert.equal(breakdown.skimmingPenalty, 8);
  assert.equal(breakdown.failurePenalty, 12);
  assert.equal(breakdown.score, 0);
});

test("score stays on the baseline when the session is quiet", () => {
  const now = at("2026-09-30T09:00:00Z");
  const breakdown = computeScore({
    now,
    sessionStartedAt: now - 10 * 60_000,
    promptTimestamps: [now - 60_000],
    failureTimestamps: [],
    skimmingTimestamps: [],
    focusWindows: windows,
  });
  assert.equal(breakdown.score, 100);
});

test("possible skimming is a long response followed quickly by the next prompt", () => {
  assert.equal(isPossibleSkim(80, 9_999), true);
  assert.equal(isPossibleSkim(79, 1_000), false);
  assert.equal(isPossibleSkim(200, 10_000), false);
});

test("break suggestion is below the threshold, suppressed for 30 minutes, and re-armed above 50", () => {
  const now = 1_000_000;
  const first = nextSuggestion({ armed: true, suppressUntil: 0, breakActive: false }, 34, now, 35);
  assert.equal(first.suggest, true);
  assert.equal(first.armed, false);
  assert.equal(first.suppressUntil, now + 30 * 60_000);

  const during = nextSuggestion(
    { armed: first.armed, suppressUntil: first.suppressUntil, breakActive: false },
    10,
    now + 60_000,
    35,
  );
  assert.equal(during.suggest, false);

  const afterSuppress = nextSuggestion(
    { armed: false, suppressUntil: now + 30 * 60_000, breakActive: false },
    10,
    now + 30 * 60_000,
    35,
  );
  assert.equal(afterSuppress.suggest, true);

  const recovered = nextSuggestion({ armed: false, suppressUntil: 0, breakActive: false }, 50, now, 35);
  assert.equal(recovered.suggest, false);
  assert.equal(recovered.armed, true);
});

test("an active break blocks suggestions", () => {
  const decision = nextSuggestion({ armed: true, suppressUntil: 0, breakActive: true }, 10, 5_000, 35);
  assert.equal(decision.suggest, false);
});
