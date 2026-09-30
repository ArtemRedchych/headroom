#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const LONG_WORDS = 80;
const SKIM_GAP_MS = 10_000;
const BREAK_MARKER = "The user is taking a short break.";

function followupMessage() {
  return [
    "The user is taking a short break.",
    "Decide whether any work is needed.",
    "If the current task is already done, or the only remaining step needs the user, do not invent work and do not edit files. The user can leave without a plan.",
    "If safe work is already in progress, write a plan of at most 3 steps from that work, do only those steps, and stop.",
    "If unsure, do nothing.",
    "Stop before architecture changes, database or schema changes, public API changes, new dependencies, destructive operations, security-sensitive decisions, or any new task.",
    'When you stop, start the summary with "While you were away:". If you did nothing, say that no work was needed. If you followed a plan, include that plan.',
  ].join(" ");
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function resolveRoot(input) {
  const roots = Array.isArray(input.workspace_roots) ? input.workspace_roots.filter(Boolean) : [];
  if (roots[0]) return roots[0];
  return process.cwd();
}

function firstCaller(root, raw) {
  const crypto = require("crypto");
  const key = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 16);
  const dir = path.join(root, ".headroom", "seen");
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, key), String(Date.now()), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

function eventsFile(root) {
  return path.join(root, ".headroom", "events.jsonl");
}

function readEvents(root) {
  try {
    return fs
      .readFileSync(eventsFile(root), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function append(root, event) {
  fs.mkdirSync(path.join(root, ".headroom"), { recursive: true });
  fs.appendFileSync(eventsFile(root), JSON.stringify(event) + "\n");
}

function lastOf(events, type) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === type) return events[index];
  }
  return undefined;
}

function readBreak(root) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, ".headroom", "break.json"), "utf8"));
    return {
      active: Boolean(parsed.active),
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
      followupSent: Boolean(parsed.followupSent),
      approvedPlan: typeof parsed.approvedPlan === "string" ? parsed.approvedPlan : "",
    };
  } catch {
    return { active: false, startedAt: null, followupSent: false, approvedPlan: "" };
  }
}

function handle(raw) {
  let input = {};
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    input = {};
  }
  const event = input.hook_event_name || "";
  const root = resolveRoot(input);
  const now = Date.now();
  if (event && !firstCaller(root, raw)) return {};

  if (event === "beforeSubmitPrompt") {
    const events = readEvents(root);
    const lastResponse = lastOf(events, "response");
    const lastPrompt = lastOf(events, "prompt");
    if (lastResponse && (!lastPrompt || lastResponse.at > lastPrompt.at)) {
      const gap = now - lastResponse.at;
      if ((lastResponse.words || 0) >= LONG_WORDS && gap >= 0 && gap < SKIM_GAP_MS) {
        append(root, { type: "skim", at: now, words: lastResponse.words, gapMs: gap });
      }
    }
    append(root, { type: "prompt", at: now });
    const state = readBreak(root);
    if (state.active && !state.followupSent && String(input.prompt || "").includes(BREAK_MARKER)) {
      fs.writeFileSync(
        path.join(root, ".headroom", "break.json"),
        JSON.stringify({ ...state, followupSent: true }, null, 2),
      );
    }
    return { continue: true };
  }

  if (event === "afterAgentResponse") {
    const text = String(input.text || "");
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    append(root, { type: "response", at: now, words, excerpt: trimmed.slice(0, 240) });
    return {};
  }

  if (event === "postToolUseFailure") {
    if (!input.is_interrupt) {
      append(root, { type: "failure", at: now, tool: String(input.tool_name || "") });
    }
    return {};
  }

  if (event === "afterFileEdit") {
    append(root, { type: "edit", at: now });
    return {};
  }

  if (event === "stop") {
    const state = readBreak(root);
    const loopCount = Number(input.loop_count || 0);
    if (state.active && !state.followupSent && input.status === "completed" && loopCount === 0) {
      fs.writeFileSync(
        path.join(root, ".headroom", "break.json"),
        JSON.stringify({ ...state, followupSent: true }, null, 2),
      );
      return { followup_message: followupMessage() };
    }
    return {};
  }

  return {};
}

readStdin()
  .then((raw) => {
    process.stdout.write(JSON.stringify(handle(raw)));
  })
  .catch(() => {
    process.stdout.write("{}");
  });
