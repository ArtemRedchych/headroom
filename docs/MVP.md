# Headroom MVP

## Time constraint

Maximum implementation time: 3 hours.

After 3 hours, stop adding features.

Remaining time is for:

- testing
- evaluation
- bug fixing
- tuning
- demo preparation

---

# MVP user journey

## Step 1 — Start Cursor

User sees:

🧠 82% · Human: MEDIUM

---

## Step 2 — Work normally

Headroom observes lightweight session signals such as:

- session start
- submitted prompts
- agent responses
- relevant tool failures
- file-edit activity

The Headroom estimate changes over time.

---

## Step 3 — Manual Human Effort

User clicks the status item.

Options:

- LOW
- MEDIUM
- HIGH

Changing this updates Headroom's communication guidance immediately.

It does not change the score.

---

## Step 4 — Adaptive communication

Example LOW-mode guidance:

- lead with conclusion/recommendation
- maximum 3 primary reasons
- mention risk if relevant
- no long background explanation
- offer details only if requested

The purpose is to reduce reading cost.

Guidance lives in the generated file `.cursor/rules/headroom-runtime.mdc`.

---

## Step 5 — Low Headroom

If the Headroom estimate drops below a configurable threshold:

Show a lightweight suggestion:

"Headroom is low. Take a 7-minute break?"

Actions:

- Break & Delegate
- Keep Working

Do not repeatedly annoy the user.

Keep Working suppresses suggestions for 30 minutes.

Suggest again below 35. Treat the score as recovered above 50.

---

## Step 6 — Break & Delegate

When selected:

Set break mode = active.

Cursor receives context similar to:

"The user is taking a short break.

Continue only the already-agreed task.

Allowed:
- straightforward implementation
- tests
- debugging
- safe cleanup

Stop before:
- architecture changes
- DB/schema changes
- public API changes
- dependencies
- destructive operations
- security-sensitive decisions
- unclear product decisions

When finished, summarize what was completed and what requires user attention."

Allow only a small autonomous continuation count.

MVP target: 1 continuation.

Do not build a general autonomous planning system.

---

## Step 7 — User returns

Provide a concise summary.

Example:

While you were away:

✓ 3 safe tasks completed
✓ tests passing

Needs your attention:

⚠ API behavior decision

---

# MVP settings

Support minimal configuration.

Suggested configuration:

```json
{
  "headroom.focusWindows": [
    {
      "from": "08:00",
      "to": "11:00",
      "capacity": 100
    },
    {
      "from": "11:00",
      "to": "17:00",
      "capacity": 55
    },
    {
      "from": "17:00",
      "to": "19:00",
      "capacity": 90
    }
  ],
  "headroom.breakThreshold": 35
}
```
