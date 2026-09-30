import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  computeScore,
  nextSuggestion,
  SCORE,
  type FocusWindow,
  type HumanEffort,
  type ScoreBreakdown,
} from "./score";

interface HeadroomEvent {
  type: "prompt" | "response" | "skim" | "failure" | "edit";
  at: number;
  words?: number;
  gapMs?: number;
  tool?: string;
  excerpt?: string;
}

interface Persisted {
  humanEffort: HumanEffort;
  sessionStartedAt: number;
  suppressUntil: number;
  armed: boolean;
}

interface BreakFile {
  active: boolean;
  startedAt: number | null;
  followupSent: boolean;
}

const STATE_KEY = "headroom.session";
const BREAK_MS = 7 * 60_000;

let output: vscode.OutputChannel;
let status: vscode.StatusBarItem;
let persisted: Persisted;
let root = "";
let lastLog = "";
let suggestionOpen = false;
let breakTimer: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("Headroom");
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = "headroom.setEffort";
  root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  persisted = readPersisted(context);

  context.subscriptions.push(output, status);
  context.subscriptions.push(
    vscode.commands.registerCommand("headroom.setEffort", () => setEffort(context)),
    vscode.commands.registerCommand("headroom.break", () => startBreak(context)),
    vscode.commands.registerCommand("headroom.keepWorking", () => keepWorking(context)),
    vscode.commands.registerCommand("headroom.endBreak", () => endBreak(context)),
    vscode.commands.registerCommand("headroom.simulate", () => simulate(context)),
    vscode.commands.registerCommand("headroom.reset", () => resetSession(context)),
    vscode.commands.registerCommand("headroom.diagnostics", () => {
      refresh(context);
      output.show(true);
    }),
  );

  if (root) {
    fs.mkdirSync(path.join(root, ".headroom"), { recursive: true });
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, ".headroom/events.jsonl"),
    );
    watcher.onDidChange(() => refresh(context));
    watcher.onDidCreate(() => refresh(context));
    context.subscriptions.push(watcher);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("headroom")) refresh(context);
    }),
  );

  writeRule(persisted.humanEffort);
  void savePersisted(context);
  refresh(context);
  status.show();
  refreshTimer = setInterval(() => refresh(context), 3_000);
  context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });
  output.appendLine("Headroom active. Human Effort does not change the score.");
}

export function deactivate(): void {
  clearTimeout(breakTimer);
  clearInterval(refreshTimer);
}

function readPersisted(context: vscode.ExtensionContext): Persisted {
  const stored = context.workspaceState.get<Persisted>(STATE_KEY);
  if (stored?.sessionStartedAt && stored.humanEffort) return stored;
  return {
    humanEffort: "medium",
    sessionStartedAt: Date.now(),
    suppressUntil: 0,
    armed: true,
  };
}

async function savePersisted(context: vscode.ExtensionContext): Promise<void> {
  await context.workspaceState.update(STATE_KEY, persisted);
}

function eventsPath(): string {
  return path.join(root, ".headroom", "events.jsonl");
}

function breakPath(): string {
  return path.join(root, ".headroom", "break.json");
}

function readEvents(): HeadroomEvent[] {
  if (!root || !fs.existsSync(eventsPath())) return [];
  return fs
    .readFileSync(eventsPath(), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as HeadroomEvent];
      } catch {
        return [];
      }
    });
}

function readBreak(): BreakFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(breakPath(), "utf8")) as Partial<BreakFile>;
    return {
      active: Boolean(parsed.active),
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
      followupSent: Boolean(parsed.followupSent),
    };
  } catch {
    return { active: false, startedAt: null, followupSent: false };
  }
}

function writeBreak(state: BreakFile): void {
  if (!root) return;
  fs.mkdirSync(path.join(root, ".headroom"), { recursive: true });
  fs.writeFileSync(breakPath(), JSON.stringify(state, null, 2));
}

function focusWindows(): FocusWindow[] {
  const configured = vscode.workspace.getConfiguration("headroom").get<FocusWindow[]>("focusWindows", []);
  return configured.filter(
    (window) =>
      typeof window?.from === "string" &&
      typeof window?.to === "string" &&
      typeof window?.capacity === "number",
  );
}

function currentBreakdown(): ScoreBreakdown {
  const events = readEvents();
  return computeScore({
    now: Date.now(),
    sessionStartedAt: persisted.sessionStartedAt,
    promptTimestamps: events.filter((event) => event.type === "prompt").map((event) => event.at),
    failureTimestamps: events.filter((event) => event.type === "failure").map((event) => event.at),
    skimmingTimestamps: events.filter((event) => event.type === "skim").map((event) => event.at),
    focusWindows: focusWindows(),
    timeZone: vscode.workspace.getConfiguration("headroom").get<string>("timeZone") || undefined,
  });
}

function refresh(context: vscode.ExtensionContext): void {
  const breakdown = currentBreakdown();
  const breaking = readBreak();
  const label = `🧠 ${breakdown.score}% · Human: ${persisted.humanEffort.toUpperCase()}${breaking.active ? " · BREAK" : ""}`;
  status.text = label;
  status.tooltip = breakdown.lines.join("\n");
  const detail = `${label} | ${breakdown.lines.join(" | ")}`;
  if (detail !== lastLog) {
    lastLog = detail;
    output.appendLine(`${new Date().toISOString()} ${detail}`);
  }
  const threshold = vscode.workspace.getConfiguration("headroom").get<number>("breakThreshold", 35);
  const decision = nextSuggestion(
    { armed: persisted.armed, suppressUntil: persisted.suppressUntil, breakActive: breaking.active },
    breakdown.score,
    Date.now(),
    threshold,
  );
  persisted.armed = decision.armed;
  if (decision.suggest && !suggestionOpen) {
    persisted.suppressUntil = decision.suppressUntil;
    void savePersisted(context);
    void suggestBreak(context, breakdown.score);
    return;
  }
  if (decision.armed !== readPersisted(context).armed) {
    void savePersisted(context);
  }
}

async function suggestBreak(context: vscode.ExtensionContext, score: number): Promise<void> {
  if (suggestionOpen) return;
  suggestionOpen = true;
  output.appendLine(`Break suggestion at ${score}%. Threshold ${vscode.workspace.getConfiguration("headroom").get("breakThreshold", 35)}.`);
  try {
    const choice = await vscode.window.showInformationMessage(
      `Headroom is ${score}%. Take a 7-minute break?`,
      "Break & Delegate",
      "Keep Working",
    );
    if (choice === "Break & Delegate") await startBreak(context);
    if (choice === "Keep Working") await keepWorking(context);
  } finally {
    suggestionOpen = false;
  }
}

async function setEffort(context: vscode.ExtensionContext): Promise<void> {
  const breaking = readBreak();
  const breakdown = currentBreakdown();
  const items: Array<vscode.QuickPickItem & { action: string }> = [
    { label: "LOW", description: "Recommendation first, at most 3 reasons, explicit risk", action: "low" },
    { label: "MEDIUM", description: "Concise recommendation and the key tradeoff", action: "medium" },
    { label: "HIGH", description: "Alternatives, tradeoffs, and decision reasoning", action: "high" },
  ];
  if (breaking.active) {
    items.push({ label: "End break", description: "Show the return summary", action: "end" });
  } else if (breakdown.score < vscode.workspace.getConfiguration("headroom").get<number>("breakThreshold", 35)) {
    items.push({ label: "Break & Delegate", description: "Hand off one safe continuation", action: "break" });
  }
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `Headroom ${breakdown.score}% · Human ${persisted.humanEffort.toUpperCase()}`,
  });
  if (!picked) return;
  if (picked.action === "break") return startBreak(context);
  if (picked.action === "end") return endBreak(context);
  persisted.humanEffort = picked.action as HumanEffort;
  await savePersisted(context);
  writeRule(persisted.humanEffort);
  output.appendLine(`Human Effort set to ${persisted.humanEffort.toUpperCase()}. Score is unchanged.`);
  refresh(context);
}

function writeRule(effort: HumanEffort): void {
  if (!root) return;
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
  const dir = path.join(root, ".cursor", "rules");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "headroom-runtime.mdc"),
    ["---", "description: Headroom communication preference", "alwaysApply: true", "---", "", guidance[effort], ""].join("\n"),
  );
}

async function startBreak(context: vscode.ExtensionContext): Promise<void> {
  const startedAt = Date.now();
  writeBreak({ active: true, startedAt, followupSent: false });
  persisted.suppressUntil = 0;
  await savePersisted(context);
  clearTimeout(breakTimer);
  breakTimer = setTimeout(() => {
    void vscode.window.showInformationMessage("7 minutes are up. Run Headroom: End Break for the summary.");
  }, BREAK_MS);
  output.appendLine("Break & Delegate started. The next completed agent turn may continue once with safe work.");
  void vscode.window.showInformationMessage("Break & Delegate is on. One safe continuation can run when the current agent turn stops.");
  refresh(context);
}

async function keepWorking(context: vscode.ExtensionContext): Promise<void> {
  persisted.suppressUntil = Date.now() + SCORE.suppressMs;
  persisted.armed = false;
  await savePersisted(context);
  output.appendLine("Keep Working. Break suggestions suppressed for 30 minutes.");
  refresh(context);
}

async function endBreak(context: vscode.ExtensionContext): Promise<void> {
  const breaking = readBreak();
  const since = breaking.startedAt ?? Date.now();
  const summary = buildSummary(readEvents(), since);
  writeBreak({ active: false, startedAt: null, followupSent: false });
  clearTimeout(breakTimer);
  persisted.suppressUntil = Date.now() + SCORE.suppressMs;
  persisted.armed = false;
  await savePersisted(context);
  output.appendLine(summary);
  output.show(true);
  await vscode.window.showInformationMessage(summary, { modal: true }, "OK");
  refresh(context);
}

function buildSummary(events: HeadroomEvent[], since: number): string {
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

async function simulate(context: vscode.ExtensionContext): Promise<void> {
  if (!root) return;
  const now = Date.now();
  persisted.sessionStartedAt = now - 130 * 60_000;
  persisted.suppressUntil = 0;
  persisted.armed = true;
  await savePersisted(context);
  const lines: HeadroomEvent[] = [
    ...Array.from({ length: 15 }, () => ({ type: "prompt" as const, at: now - 30_000 })),
    ...Array.from({ length: 4 }, () => ({ type: "skim" as const, at: now - 60_000, words: 180, gapMs: 2_000 })),
    ...Array.from({ length: 4 }, (_, index) => ({ type: "failure" as const, at: now - (index + 1) * 60_000, tool: "Shell" })),
  ];
  fs.mkdirSync(path.join(root, ".headroom"), { recursive: true });
  fs.appendFileSync(eventsPath(), lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
  output.appendLine("Simulated session pressure. These events are marked only by being written from Headroom: Simulate Session Pressure.");
  refresh(context);
}

async function resetSession(context: vscode.ExtensionContext): Promise<void> {
  persisted.sessionStartedAt = Date.now();
  persisted.suppressUntil = 0;
  persisted.armed = true;
  await savePersisted(context);
  writeBreak({ active: false, startedAt: null, followupSent: false });
  clearTimeout(breakTimer);
  if (root) {
    fs.mkdirSync(path.join(root, ".headroom"), { recursive: true });
    fs.writeFileSync(eventsPath(), "");
  }
  output.appendLine("Session signals reset. Human Effort was left as-is.");
  refresh(context);
}
