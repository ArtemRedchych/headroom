# Headroom MVP Architecture

## Goal

Keep the architecture as small as possible.

Headroom runs locally alongside Cursor.

No external backend is required.

Human Effort and the Headroom score are independent. Effort changes only the generated communication rule.

---

## High-level architecture

```
Cursor / VS Code extension
        |
        +-- Status bar
        |
        +-- Commands
        |
        +-- Headroom state (workspaceState + .headroom/)
        |
        +-- Score engine (pure, deterministic)
        |
        +-- Settings (focus windows, break threshold, timezone)
        |
        +-- Generated rule .cursor/rules/headroom-runtime.mdc
        |
        +-- Project hooks .cursor/hooks.json
                  |
                  +-- prompts
                  +-- agent responses
                  +-- tool failures
                  +-- file edits
                  +-- one stop follow-up while a break is active
```

There is no in-extension Cursor events API. Hooks are scripts. They append JSON lines to `.headroom/events.jsonl`. The extension watches that file. The P-1 probe confirmed this works on the Remote SSH VM.

`beforeSubmitPrompt` cannot inject context. Communication guidance is the gitignored runtime rule, rewritten when Human Effort changes. `AGENTS.md` stays stable.

`stop` can return one `followup_message`. `loop_limit` is 1. That is the Break & Delegate continuation.

---

## Layout

```
src/extension.ts    UI, state, rule file, break summary
src/score.ts        baseline, score, suggestion policy
src/score.test.ts   pure tests
.cursor/hooks/headroom-hook.js
.cursor/hooks.json
```

---

## State

```ts
type HumanEffort = "low" | "medium" | "high";

interface HeadroomState {
  score: number;
  humanEffort: HumanEffort;
  sessionStartedAt: number;
  promptTimestamps: number[];
  recentFailures: number[];
  possibleSkimmingEvents: number;
  breakMode: boolean;
  suppressUntil: number;
}
```

Human Effort is stored. It is not passed into the score function.

Possible skimming is recorded when the hook sees an assistant reply of at least 80 words and the next prompt arrives in under 10 seconds.

---

## Break policy

Suggest when the score is below `headroom.breakThreshold` (default 35) and suggestions are armed.

Showing a suggestion, or choosing Keep Working, suppresses another suggestion for 30 minutes.

A score of 50 or higher arms the next dip. When the 30 minutes elapse, a still-low score can suggest again.

Break & Delegate writes `.headroom/break.json`. The next completed agent turn gets one safe-work follow-up. Headroom: End Break shows a summary built from events during the break.
