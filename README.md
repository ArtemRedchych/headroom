# Headroom

Cursor extension that estimates a local Headroom score from focus windows and session signals, and adapts how much the agent asks the human to read.

Human Effort (LOW, MEDIUM, HIGH) is a communication preference. It does not change the score.

## Run on the Mac, over this SSH workspace

1. In the SSH window, open Run and Debug.
2. Choose **Run Extension** and start it. That compiles TypeScript, then opens the Extension Development Host.
3. In that second window, the status bar shows `🧠 <score>% · Human: MEDIUM`.
4. Click it to set LOW, MEDIUM, or HIGH.

Hooks in `.cursor/hooks.json` record prompts, responses, tool failures, and edits into `.headroom/events.jsonl` on this VM. The extension reads that file.

## Settings

- `headroom.focusWindows`
- `headroom.breakThreshold` (default 35)
- `headroom.timeZone` — set this to the Mac timezone, for example `Europe/Warsaw`. An empty value uses the VM clock.

## Simulate a low score

In the Extension Development Host, run **Headroom: Simulate Session Pressure**.

That writes synthetic prompts, possible-skimming events, and tool failures, and backdates the session. The status bar should drop below 35 and offer a 7-minute break.

**Headroom: Reset Session** clears those signals and leaves Human Effort as it is.

## Smoke test

`npm test` runs the pure score tests.

In the Extension Development Host:

1. Confirm the status bar.
2. Switch Human Effort and confirm the score stays put. Open `.cursor/rules/headroom-runtime.mdc` and confirm the guidance changed.
3. Run **Headroom: Show Diagnostics** and read the baseline, session, prompt, skimming, and failure lines.
4. Run **Headroom: Simulate Session Pressure**. Confirm the break question.
5. Choose **Keep Working**. Confirm the Output channel says suggestions are suppressed for 30 minutes.
6. Simulate again, choose **Break & Delegate**, then **Headroom: End Break**. Confirm the summary.

A live skimming check: after a reply of about 80 words or more, send another prompt within 10 seconds. The score should fall and the log should say possible skimming.

Break & Delegate sends one safe-work follow-up when an agent turn completes. It does not start an agent by itself if nothing is running.
