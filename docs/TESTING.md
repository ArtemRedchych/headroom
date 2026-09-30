# Headroom MVP Testing

## Testing goal

We are not testing whether Headroom scientifically measures cognition.

We are testing whether the interaction helps a developer work better with
Cursor when attention is limited.

---

# Technical test

## Status bar

Verify:

- Headroom score is visible
- Human Effort is visible
- updates happen without restarting Cursor

---

## Manual Human Effort

Switch:

HIGH -> MEDIUM -> LOW

Verify the active mode changes immediately.

Verify the score does not change when only Human Effort changes.

Verify `.cursor/rules/headroom-runtime.mdc` matches the selected mode.

---

## Focus baseline

Change configured focus windows.

Verify the score baseline responds appropriately to current time.

On Remote SSH, set `headroom.timeZone` to the Mac timezone. The extension host clock is the VM.

---

## Session pressure

Generate many prompts quickly, or run Headroom: Simulate Session Pressure.

Verify session pressure increases.

The Output channel named Headroom explains each term.

---

## Possible skimming

Create a long Cursor response.

Send another prompt within 10 seconds.

Verify:

- event is detected as possible skimming
- Headroom decreases
- logs explain why

---

## Failures

Cause a tool failure that is not a user interrupt.

Verify recent failures influence pressure.

---

# Adaptive-response test

Set:

Human Effort = HIGH

Ask:

"Which architecture should we use?"

Observe response style.

Then:

Human Effort = LOW

Ask a similarly complex question.

Expected LOW behavior:

- answer/recommendation first
- short
- max ~3 main reasons
- risk surfaced
- details available only on request

The rule applies on the next agent turn after the file is written.

---

# Break test

Force Headroom below the break threshold if necessary.

Expected:

"Take a 7-minute break?"

Choose Keep Working and verify another suggestion waits about 30 minutes.

Choose:

Break & Delegate

Give Cursor an existing task with safe remaining work, with an agent turn in progress or just finishing.

Expected:

- one follow-up continues already agreed work
- no major decisions are silently made
- the agent is told to stop when human judgment is required
- Headroom: End Break shows a concise summary

---

# Evaluation questions

After using it for real, answer:

1. Did I actually read more of Cursor's important responses?

2. Did LOW mode reduce mental friction?

3. Did it hide information I actually needed?

4. Did Headroom interrupt me too often?

5. Did the score feel directionally useful?

6. Did Break & Delegate make leaving the computer easier?

7. Did I trust what the agent was doing while I was away?

8. Did the break feel like lost time?

9. What did Headroom detect incorrectly?

10. Which single feature would make me use this tomorrow?

---

# Hackathon demo test

The final demo should show:

1. Normal Cursor coding
2. Headroom score decreasing
3. Possible-skimming detection
4. Switching Human Effort to LOW
5. Agent response becoming dramatically shorter
6. Break suggestion
7. Break & Delegate
8. User physically leaves
9. Agent continues safe work
10. User returns to concise summary

Target demo length:

2–3 minutes.
