# Headroom — Agent Instructions

## What Headroom is

Headroom is a Cursor extension/plugin that adapts AI-assisted development
to the developer's current cognitive bandwidth.

AI coding tools can continue generating and reasoning indefinitely, while
human ability to read, evaluate, and make good decisions degrades during
long, high-intensity sessions.

Headroom helps manage that mismatch.

The core idea:

> As human cognitive bandwidth decreases, machine reasoning can stay high,
> while the amount of information the human must process should decrease.

Headroom must never claim to medically or scientifically measure cognitive
state. It estimates a lightweight "Headroom" score from user configuration
and observable development-session signals.

---

## Product principles

### 1. Human stays in control

The user can explicitly set:

- LOW human effort
- MEDIUM human effort
- HIGH human effort

Manual user selection takes priority over inferred state.

Headroom may suggest a different mode, but should not silently override the
user.

Human Effort is a communication preference. It does not change the Headroom score.

---

### 2. Adapt communication, not model intelligence

LOW human effort does NOT mean the model should think less.

It means:

- shorter final responses
- fewer alternatives presented
- clear recommendation
- short reasons
- explicit risk
- details only when requested

Example:

Instead of:

"There are three possible approaches..."

Prefer:

Recommendation: A

Why:
- smallest change
- reversible
- no new dependency

Risk: low

Ask if the user wants deeper reasoning.

The current preference is written to `.cursor/rules/headroom-runtime.mdc`.
That file is generated runtime state. This `AGENTS.md` file stays stable.

---

### 3. Never pretend to know the user's brain

Use language such as:

- "possible skimming"
- "session pressure is high"
- "Headroom estimate"
- "you may benefit from a short break"

Never state:

- "you are cognitively impaired"
- "you are definitely tired"
- "you didn't read this"
- medical or psychological claims

---

### 4. Personal rhythm matters

Users do not share the same productivity curve.

Headroom therefore supports user-defined focus windows.

Example:

08:00–11:00 -> 100
11:00–17:00 -> 55
17:00–19:00 -> 90

For the MVP these are configured manually.

Do NOT attempt to learn the user's circadian rhythm automatically.

---

### 5. Breaks are handoffs, not forced stops

Headroom may suggest a 5–10 minute break when estimated Headroom becomes low.

The key product idea is:

> A break should not feel like lost development time.

When the user chooses "Break & Delegate", Cursor can continue only with
safe, reversible work that follows already agreed direction.

Examples of acceptable break work:

- finish already-agreed implementation
- add tests
- run tests
- fix straightforward test failures
- inspect errors
- safe cleanup
- documentation
- prepare a summary

Examples of work that should stop and wait for the user:

- architecture decisions
- database schema changes
- public API contract changes
- new dependencies
- destructive actions
- security-sensitive decisions
- ambiguous product behavior
- major infrastructure decisions

---

## MVP scope

The hackathon build has a hard implementation budget of approximately
3 hours.

The MVP contains ONLY:

1. Human Effort selector
2. Headroom score
3. Personal focus-window configuration
4. Session-signal tracking
5. Adaptive communication instructions
6. Break & Delegate mode
7. Return-from-break summary

Anything outside this list should be treated as post-MVP unless required
to make one of these features work.

---

## Explicit non-goals

DO NOT build:

- accounts
- authentication
- backend API
- database
- cloud sync
- mobile app
- browser app
- external LLM integration
- analytics dashboard
- multi-day history
- charts
- ML fatigue detection
- camera tracking
- eye tracking
- physiological signals
- learned circadian rhythm
- team features
- Decision Debt system
- sophisticated autonomous task planner
- complex risk classification model
- Pomodoro system
- notifications outside Cursor

Do not introduce infrastructure that is not necessary for the local MVP.

---

## Technical philosophy

Prefer:

- TypeScript
- local state
- simple deterministic heuristics
- Cursor/VS Code APIs
- Cursor hooks
- small modules
- explicit types
- easy-to-debug behavior

Avoid:

- premature abstractions
- generic frameworks
- dependency-heavy solutions
- unnecessary services
- AI calls for logic that can be deterministic

This is a prototype whose purpose is to test the interaction.

---

## Headroom score philosophy

The score is an estimate from observable signals.

Inputs:

- personal focus baseline
- session duration
- prompt frequency
- long-response / rapid-next-prompt pattern
- recent tool failures

Human Effort is not an input.

The scoring function should be:

- deterministic
- transparent
- easy to tune
- bounded from 0 to 100

Do not overengineer the formula.

---

## Possible-skimming heuristic

One valuable MVP signal is:

1. Agent produces a long response.
2. User submits another prompt much sooner than normal reading time.

This may increase session pressure.

This is only a proxy.

Never present it as proof that the user did not read the response.

---

## UI philosophy

The product should feel native to Cursor and stay out of the way.

Primary status bar concept:

🧠 72% · Human: MEDIUM

Clicking it should provide quick access to:

- Headroom score
- LOW / MEDIUM / HIGH human effort
- Break & Delegate when relevant

Avoid building a large dashboard.

---

## Definition of success

The MVP succeeds if a developer can:

1. use Cursor normally;
2. see Headroom respond to the session;
3. manually change Human Effort;
4. observe AI communication becoming more concise in LOW mode;
5. receive a short-break suggestion during a high-pressure session;
6. hand safe work to Cursor while away;
7. return to a concise summary and any decisions that require attention.

The goal is NOT to prove scientific accuracy.

The goal is to test:

> Does Headroom improve human-AI collaboration when the developer's
> attention becomes the bottleneck?
