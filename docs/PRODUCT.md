# Headroom Product Context

## Problem

AI-assisted programming dramatically increases the amount of information
a developer can produce and process in a short period of time.

The model does not become tired.

The human does.

During long "vibe coding" sessions, developers may begin to:

- skim increasingly long AI responses
- approve changes quickly
- stop evaluating alternatives carefully
- make worse architectural decisions
- continue working because stopping feels like losing momentum
- switch to highly stimulating low-effort content such as social feeds
  when mentally saturated

The problem is not simply screen time.

The deeper problem is:

> AI throughput can exceed human decision-making bandwidth.

---

## FOMO / stopping problem

Developers may recognize that they would benefit from a break but still
avoid one because:

- the current code state is fresh in their mind
- restarting later has context reconstruction cost
- the agent is currently making progress
- stopping feels like wasting productive time

Headroom changes the break from a stop into a handoff.

While the developer recovers, the AI can continue machine-suitable work.

---

## Product thesis

Cursor already allows developers to choose how much effort the MODEL
should spend reasoning.

Headroom introduces a complementary concept:

> How much effort can the HUMAN spend right now?

The two dimensions are independent.

Example:

Model reasoning: HIGH
Human effort: LOW

In this state, the model should reason deeply but communicate the conclusion
very efficiently.

---

## Human Effort modes

### HIGH

User has sufficient capacity and wants detail.

Behavior:

- explain alternatives
- discuss tradeoffs
- expose reasoning relevant to decisions
- allow architecture discussion
- normal-length responses

### MEDIUM

Default collaborative mode.

Behavior:

- concise explanation
- recommendation where appropriate
- key tradeoffs
- avoid unnecessary detail

### LOW

The developer wants minimum cognitive overhead.

Behavior:

- recommendation first
- maximum ~3 important reasons
- explicit risk
- minimal prose
- no unnecessary background
- offer deeper explanation instead of giving it automatically

LOW mode must not reduce safety.

High-risk decisions should become MORE explicit, not less.

---

## Personal focus baseline

Different developers operate best at different times.

Examples:

Developer A:

08–11 high
13–16 low
17–19 high

Developer B:

11–14 medium
20–01 high

Therefore time-of-day should only influence Headroom through user-configured
personal focus windows.

Do not apply generic assumptions such as:

"People are always most productive in the morning."

---

## Break & Delegate

When Headroom is low, Headroom can suggest:

"Take 7 minutes?"

Two choices:

- Break & Delegate
- Keep Working

Keep Working suppresses another suggestion for 30 minutes.

A later dip can suggest again after that cooldown. The score is treated as
recovered once it is above 50, so a new dip can arm another suggestion.

If the user chooses Break & Delegate:

1. determine the already-agreed current work;
2. continue only safe/reversible implementation;
3. run useful checks/tests;
4. stop if meaningful human judgment is required;
5. prepare a concise return summary.

The key product promise:

> The human can recover without completely stopping project momentum.

---

## Example return summary

BREAK COMPLETE

While you were away:

✓ Finished validation
✓ Added 3 tests
✓ Fixed one edge case
✓ Tests pass

Stopped before:

⚠ API response contract change

Human decision required.

---

## Longer-term ideas — NOT MVP

Potential future directions:

- automatically learned personal focus curves
- Decision Debt
- review of decisions made under low Headroom
- task scheduling based on cognitive demand
- multi-session analytics
- smarter risk categorization
- team-level patterns
- wearable / physiological integrations
- calendar-aware focus planning

These are product possibilities, not implementation requirements.
