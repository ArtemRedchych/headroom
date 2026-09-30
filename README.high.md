# Headroom

The model doesn't get tired. You do.

Human Effort for this page: [LOW](README.low.md) · [MEDIUM](README.md) · **HIGH**

Headroom is a Cursor extension that adapts the collaboration to how much you can process right now. Machine reasoning stays available. The amount of text you have to read goes down. A break becomes a handoff instead of lost time.

```text
🧠 22% · Human: LOW · BREAK
```

`22%` is the Headroom estimate for this session. `Human: LOW` is how much you asked to read. `BREAK` means a handoff is active.

As human bandwidth drops, interface complexity should drop with it. The model can keep thinking.

## The problem

AI coding tools raise throughput. They do not raise the number of good decisions a person can make in an hour.

After a long session, replies get skimmed, diffs get approved quickly, and alternatives get less scrutiny. The expensive failure is a bad decision made while the chat still looks productive.

People often know they should step away. They stay because the context is fresh, the agent is mid-task, and stopping feels like throwing away momentum.

Headroom is a prototype of the other control: how much of that throughput the human has to process.

## The idea

Cursor lets you choose model thinking effort. Headroom is the human-side control: how much information you want to process.

Human Effort and the Headroom score are independent. You set the effort. The score never changes it, and changing effort never changes the score.

| | Meaning |
| --- | --- |
| Headroom | What the extension estimates about session pressure, from 0 to 100 |
| Human Effort | How much information you explicitly want to process: LOW, MEDIUM, or HIGH |

Your selection is the communication style. The next agent turn follows it.

## How it works

### 1. Human Effort

Click the status bar, or run **Headroom: Set Human Effort**.

- **HIGH.** Alternatives, the tradeoff for each, and the reasoning you need to decide.
- **MEDIUM.** A concise recommendation and the key tradeoff.
- **LOW.** The recommendation first, at most three reasons, the risk, and details only if you ask. The model is still told to reason as deeply as the task needs. A risky choice stays explicit.

The choice is written to `.cursor/rules/headroom-runtime.mdc`. Cursor loads that file on the next agent turn.

Same question: "Should we add Redis for this cache?"

HIGH is instructed to compare the options and leave the reasoning in the answer. LOW is instructed to look like this:

```text
Recommendation: do not add Redis.
- one process today
- reversible
- no new dependency
Risk: a second instance serves stale reads.
```

### 2. Headroom

The score is a simple heuristic, clamped from 0 to 100. It estimates interaction bandwidth for this session. It does not measure fatigue, attention, or health.

The baseline is a focus window you configure. The defaults are 08:00–11:00 at 100, 11:00–17:00 at 55, and 17:00–19:00 at 90. Outside those windows the baseline is 70. Headroom does not learn your day.

Session signals then subtract from that baseline:

- how long the session has run
- how many prompts arrived in the last 10 minutes
- possible skimming: a reply of at least 80 words, then another prompt in under 10 seconds
- tool failures in the last 15 minutes

A fast follow-up is only a proxy. It is recorded as possible skimming, not as proof you skipped the reply.

**Headroom: Show Diagnostics** prints each term. A break is suggested below `headroom.breakThreshold` (default 35). After a suggestion, the next one waits 30 minutes. When that time is up, a score that is still low can ask again. A score of 50 or higher arms the next dip and does not ask while it stays there.

On another machine, set `headroom.timeZone` to your timezone, for example `Europe/Warsaw`. An empty value uses that machine's clock.

### 3. Break & Delegate

This is the feature to watch. The break is a handoff, not a stop.

When the estimate is under the threshold you see:

```text
Headroom is 22%. Take a 7-minute break?
[Break & Delegate]  [Keep Working]
```

**Keep Working** hides the question for 30 minutes. You can also run **Headroom: Keep Working**.

**Break & Delegate** opens a new agent chat with the break prompt already in the input box. Press Enter and leave. The same command is in the palette. The agent decides whether any work is needed:

- The task is done, or the only next step needs you. It edits nothing. You can leave without a plan.
- Safe work is already in progress. It writes at most three steps from that work, does those steps, and stops.

If it is unsure, it does nothing. It must not invent a new task. It stops before architecture changes, database or schema changes, public API changes, new dependencies, destructive operations, or security-sensitive decisions. The reply starts with **While you were away:**. If it did nothing, it says no work was needed.

The status bar gains `· BREAK`. That limit is an instruction in the chat, not a sandbox.

If the prompt never gets sent, whether the chat did not open or you did not press Enter, the next agent turn to finish receives the same instructions, once. Once the prompt is sent from the new chat, that fallback is off.

Seven minutes later, a reminder tells you to run **Headroom: End Break**. The break does not end by itself. The summary is:

```text
While you were away:
✓ 1 file edit
✓ 0 tool failures
✓ Last reply: While you were away: …

Needs your attention:
⚠ Review anything the agent stopped before deciding.
```

The counts and the last reply come from the local session log. The attention line is a standing reminder, not a detected decision.

The break becomes a handoff rather than lost time. Sometimes the handoff is: nothing was left to do.

## Architecture

```text
Cursor hooks
    → .headroom/events.jsonl
    → Headroom extension
    → score, status bar, diagnostics

Human Effort
    → .cursor/rules/headroom-runtime.mdc
    → the next agent response

Break mode
    → new agent chat, or one stop-hook follow-up
    → Headroom: End Break
```

On launch, the extension copies its hook into your Cursor user hooks folder and registers it. You do not edit `hooks.json`. This repository also includes the same hook under `.cursor/` so the project can run it directly.

Hooks record prompts, responses, tool failures, and file edits. `beforeSubmitPrompt` cannot change the prompt, so communication style goes through the runtime rule. A break opens a new agent chat and pastes the prompt from the clipboard. The `stop` hook sends the same instructions only if that prompt was never sent, and only once.

## Try it in 2 minutes

Use a normal Cursor window with the extension installed. Command Palette: `Cmd+Shift+P` on macOS.

1. Run **Headroom: Reset Session**, so an earlier break cannot hide the suggestion.
2. Click the status bar and choose **LOW**. Ask: "Should we add Redis for this cache?"
3. Choose **HIGH** and ask the same question. The answer should get longer. The percentage should stay put. The runtime rule file should match the mode you picked.
4. Run **Headroom: Simulate Session Pressure**. You should see `Headroom is N%. Take a 7-minute break?`
5. Choose **Break & Delegate**. The status bar should show `· BREAK`, and a new chat should open with the break prompt in its input box. Press Enter. If the box is empty, press `Cmd+V` first.
6. The reply should start with **While you were away:**. It either says no work was needed, or it names at most three steps it took from work already in progress.
7. Run **Headroom: End Break** and read the summary.

If no new chat opens, send a short message in any chat. When that turn finishes, it receives the same instructions once.

Optional: **Headroom: Show Diagnostics** lists the baseline and each penalty. **Headroom: Keep Working** at step 4 dismisses the ask for 30 minutes instead of starting a break.

## Installation

Install [`artem.headroom`](https://open-vsx.org/extension/artem/headroom) from Cursor's extension search, then reload the window. The first launch registers the hook. The status bar item appears at the bottom-left.

Over Remote SSH, install it only on the SSH host. A second copy under **Local - Installed** can take over and hide the status bar. Uninstall that local copy.

From this repository:

```bash
npm install
npm run package
cursor --install-extension headroom-0.1.2.vsix
```

Extensions → **Install from VSIX** uses the same file.

## Why this matters

AI tools are built to increase model intelligence and throughput. Headroom is an experiment on the other side of the interface: the person's reading and decision capacity changes during a session, and the collaboration can change with it.

The practical question is whether a shorter answer, an honest session estimate, and a break that either finishes safe work or leaves the files alone make it easier to step away.

## Privacy

Headroom stays on the machine where the folder is open.

- Session events are appended to `.headroom/events.jsonl` in the workspace. That directory is gitignored.
- Break state is `.headroom/break.json`. Effort and session timing sit in workspace state.
- The communication rule is `.cursor/rules/headroom-runtime.mdc`, also gitignored.
- The extension and the hook do not call an external API, model, or analytics service.
- There is no account, backend, or cloud sync.

The hook does see prompt and reply text, long enough to count words, store a short excerpt, and notice possible skimming. That log remains local.

Break & Delegate puts the break prompt on your clipboard so it can be pasted into the new chat. It replaces whatever you had copied.

## Prototype limitations

- The score is a transparent heuristic, not a measurement of a person.
- Focus windows are configured by hand. Nothing learns a schedule.
- Possible skimming is only the 80-word / 10-second proxy.
- The agent decides whether a break has any safe work. That decision is an instruction, and the agent can ignore it.
- You press Enter to send the break prompt. Cursor has no supported command that sends a chat message for you.
- "Stop before architecture, schema, API, dependencies, destructive actions, or security decisions" is text in that prompt. It is not a sandbox.
- The return summary counts edits and failures and quotes the last reply. It does not classify which decision was left open.
- The seven minutes are a reminder. Ending the break is **Headroom: End Break**.
- The hook integration targets Cursor.

# Detail

## The score, exactly

The score is `baseline − penalties`, clamped to 0–100. The constants live in `SCORE` in `src/score.ts`.

| Term | Rule | Cap |
| --- | --- | --- |
| Baseline | Capacity of the focus window that contains the clock. 70 outside every window. | — |
| Session | −1 per 3 minutes after the first 45 | −25 |
| Prompts | −4 for each prompt above 8 in the last 10 minutes | −20 |
| Possible skimming | −8 for each in the last 30 minutes | −24 |
| Tool failures | −6 for each in the last 15 minutes. User interrupts do not count. | −18 |

Possible skimming is recorded when a reply of at least 80 words is followed by the next prompt in under 10 seconds.

Focus windows include `from` and exclude `to`, and can cross midnight. `headroom.timeZone` picks the clock. Left empty, it uses the machine the folder is on, which over SSH is the remote host.

Human Effort is not a parameter of `computeScore`.

**Headroom: Simulate Session Pressure** moves the session start back 130 minutes, then adds 15 prompts, 4 possible skims, and 4 tool failures.

## When a break is suggested

- Below `headroom.breakThreshold` (default 35), and only when armed.
- Showing the question, or choosing Keep Working, silences it for 30 minutes.
- Suggestions re-arm when the score reaches 50, or when the 30 minutes are over.
- No suggestion appears while a break is active.

This keeps a score that sits near 35 from asking every few seconds.

## Hooks

On activation, the extension copies `hooks/headroom-hook.js` to `~/.cursor/hooks/` and merges `~/.cursor/hooks.json`. Entries from other tools stay in place. This repository has the same hook under `.cursor/` too. Identical input is handled once, using a marker file in `.headroom/seen/`.

| Event | What Headroom does |
| --- | --- |
| `beforeSubmitPrompt` | Logs the prompt and checks for possible skimming. Marks the break prompt as sent. |
| `afterAgentResponse` | Logs the word count and a 240-character excerpt. |
| `postToolUseFailure` | Logs failures that are not user interrupts. |
| `afterFileEdit` | Logs the edit. |
| `stop` | During a break, sends the break prompt once if it was never sent. |

Events are appended to `.headroom/events.jsonl`. The extension watches that file and rescores every 3 seconds.

## The break, step by step

1. **Break & Delegate** writes `.headroom/break.json` with `active: true`.
2. The break prompt is copied to the clipboard. `composer.newAgentChat` opens a chat, and a paste drops the prompt into its input box.
3. You press Enter.
4. `beforeSubmitPrompt` sees the break prompt and sets `followupSent`.
5. If the prompt was never sent, the next `stop` with `status: completed` and `loop_count: 0` returns it as `followup_message`. `loop_limit` 1 caps it at one continuation.
6. **Headroom: End Break** shows the edits, failures, and last reply since the break began.

## Why it is built this way

- **Effort is a rule file.** `beforeSubmitPrompt` cannot add context to the prompt. A gitignored `.cursor/rules/headroom-runtime.mdc` with `alwaysApply` can, starting on the next turn.
- **Effort stays out of the score.** The score is an estimate. Effort is your choice. Mixing them would let a preference look like evidence.
- **The agent decides whether work is left.** A fixed plan made the demo edit a README line nobody needed. The current prompt allows "no work was needed," and says to do nothing when unsure.
- **One continuation, then stop.** A break is a handoff, not an autonomous run.
- **The paste, not an auto-send.** Cursor has no supported command that submits a chat message.

## Smoke test

`npm test` compiles and runs 16 Node tests in UTC. They cover focus windows, each penalty, the suggestion cooldown, the effort rule text, the diagnostics lines, the hook's event records, sending the break prompt exactly once, and the hook installer keeping unrelated hooks.

For extension development, Run and Debug → **Run Extension** opens an Extension Development Host. The installed extension is what the steps above use.
