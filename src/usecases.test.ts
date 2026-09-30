import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { nextSuggestion, type FocusWindow } from "./score";
import {
  buildSummary,
  effortGuidance,
  scoreFromEvents,
  SIMULATED_SESSION_MS,
  simulatedEvents,
  statusText,
  type SessionEvent,
} from "./session";

const fullCapacity: FocusWindow[] = [{ from: "00:00", to: "23:59", capacity: 100 }];
const hookPath = path.join(__dirname, "..", ".cursor", "hooks", "headroom-hook.js");

function runHook(root: string, input: unknown): Record<string, unknown> {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout || "{}") as Record<string, unknown>;
}

function readEvents(root: string): SessionEvent[] {
  const file = path.join(root, ".headroom", "events.jsonl");
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as SessionEvent);
}

test("status bar shows the score and human effort, and a break marks BREAK", () => {
  assert.equal(statusText(82, "medium", false), "🧠 82% · Human: MEDIUM");
  assert.equal(statusText(22, "low", true), "🧠 22% · Human: LOW · BREAK");
});

test("switching human effort changes the guidance and leaves the score unchanged", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const events = simulatedEvents(now);
  const before = scoreFromEvents(now, now - SIMULATED_SESSION_MS, events, fullCapacity).score;
  const after = scoreFromEvents(now, now - SIMULATED_SESSION_MS, events, fullCapacity).score;
  assert.equal(before, after);
  assert.match(effortGuidance("low"), /at most 3/);
  assert.match(effortGuidance("low"), /risk/i);
  assert.match(effortGuidance("high"), /alternatives/i);
  assert.notEqual(effortGuidance("low"), effortGuidance("high"));
});

test("diagnostics list every score term", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const breakdown = scoreFromEvents(now, now - 10 * 60_000, [], fullCapacity);
  const text = breakdown.lines.join("\n");
  assert.match(text, /baseline/);
  assert.match(text, /session/);
  assert.match(text, /prompts/);
  assert.match(text, /possible skimming/);
  assert.match(text, /failures/);
});

test("simulated session pressure falls below 35 and suggests a break", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const breakdown = scoreFromEvents(now, now - SIMULATED_SESSION_MS, simulatedEvents(now), fullCapacity);
  assert.ok(breakdown.score < 35, `score was ${breakdown.score}`);
  const decision = nextSuggestion({ armed: true, suppressUntil: 0, breakActive: false }, breakdown.score, now, 35);
  assert.equal(decision.suggest, true);
});

test("Keep Working suppresses the next suggestion for 30 minutes", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const score = scoreFromEvents(now, now - SIMULATED_SESSION_MS, simulatedEvents(now), fullCapacity).score;
  const first = nextSuggestion({ armed: true, suppressUntil: 0, breakActive: false }, score, now, 35);
  assert.equal(first.suggest, true);
  const again = nextSuggestion(
    { armed: first.armed, suppressUntil: first.suppressUntil, breakActive: false },
    score,
    now + 60_000,
    35,
  );
  assert.equal(again.suggest, false);
  assert.ok(again.suppressUntil - now >= 30 * 60_000);
});

test("Break & Delegate blocks suggestions and End Break summarizes the interval", () => {
  const now = 5_000_000;
  const blocked = nextSuggestion({ armed: true, suppressUntil: 0, breakActive: true }, 10, now, 35);
  assert.equal(blocked.suggest, false);
  const summary = buildSummary(
    [
      { type: "edit", at: now - 10_000 },
      { type: "edit", at: now - 9_000 },
      { type: "edit", at: now - 8_000 },
      { type: "failure", at: now - 7_000, tool: "Shell" },
      { type: "response", at: now - 6_000, excerpt: "While you were away: added tests." },
      { type: "edit", at: now - 20_000 },
    ],
    now - 15_000,
  );
  assert.match(summary, /While you were away:/);
  assert.match(summary, /✓ 3 file edits/);
  assert.match(summary, /✓ 1 tool failure/);
  assert.match(summary, /added tests/);
  assert.match(summary, /Needs your attention:/);
});

test("the hook records possible skimming, ignores an interrupted failure, and follows up once", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "headroom-hook-"));
  fs.mkdirSync(path.join(root, ".cursor"));
  fs.writeFileSync(path.join(root, ".cursor", "hooks.json"), '{"version":1}\n');
  const longReply = Array.from({ length: 80 }, () => "alpha").join(" ");

  runHook(root, { hook_event_name: "afterAgentResponse", text: longReply });
  const prompt = runHook(root, { hook_event_name: "beforeSubmitPrompt", prompt: "next" });
  assert.equal(prompt.continue, true);
  runHook(root, { hook_event_name: "afterAgentResponse", text: "short reply" });
  runHook(root, { hook_event_name: "beforeSubmitPrompt", prompt: "later" });
  runHook(root, { hook_event_name: "postToolUseFailure", tool_name: "Shell", is_interrupt: true });
  runHook(root, { hook_event_name: "postToolUseFailure", tool_name: "Shell", is_interrupt: false });

  const events = readEvents(root);
  assert.equal(events.filter((event) => event.type === "skim").length, 1);
  assert.equal(events.filter((event) => event.type === "failure").length, 1);
  const skim = events.find((event) => event.type === "skim");
  assert.ok(skim && (skim.words ?? 0) >= 80 && (skim.gapMs ?? 99999) < 10_000);

  fs.writeFileSync(
    path.join(root, ".headroom", "break.json"),
    JSON.stringify({ active: true, startedAt: 1, followupSent: false }),
  );
  const firstStop = runHook(root, { hook_event_name: "stop", status: "completed", loop_count: 0 });
  const secondStop = runHook(root, { hook_event_name: "stop", status: "completed", loop_count: 0 });
  assert.match(String(firstStop.followup_message), /short break/);
  assert.equal(secondStop.followup_message, undefined);
  const breakFile = JSON.parse(fs.readFileSync(path.join(root, ".headroom", "break.json"), "utf8")) as {
    followupSent: boolean;
  };
  assert.equal(breakFile.followupSent, true);
});
