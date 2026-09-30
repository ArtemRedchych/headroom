#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const LONG_WORDS = 80;
const SKIM_GAP_MS = 10_000;

function followupMessage(plan) {
  const approved = String(plan || "").trim();
  const task = approved
    ? `Approved plan, do only this and then stop: ${approved}`
    : "There is no approved plan. Do not invent work. Do not edit files.";
  return [
    "The user is taking a short break.",
    task,
    "Stop before architecture changes, database or schema changes, public API changes, new dependencies, destructive operations, security-sensitive decisions, or anything not in the approved plan.",
    "When you stop, summarize what was completed and what needs the user. Start that summary with \"While you were away:\".",
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
  if (fs.existsSync(path.join(process.cwd(), ".cursor", "hooks.json"))) return process.cwd();
  const roots = Array.isArray(input.workspace_roots) ? input.workspace_roots : [];
  return roots[0] || process.cwd();
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
      return { followup_message: followupMessage(state.approvedPlan) };
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
