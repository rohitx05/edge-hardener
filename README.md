# Edge-State Hardener — an agent that makes UI components survive real data

> Each `##` section below is slotted to the rubric. Write in your own voice —
> End-to-End Quality (20 pts) explicitly penalizes output that "reads as clearly
> AI generated." Short, plain, specific beats polished-and-generic.

## The user and the bottleneck  ·  [Problem & User Value — 15]
Intended user: a frontend developer shipping data-dense UI (I'm one — this is the
restaurant-card grind from my own work). Components pass the happy path and shatter on
real content: an 80-character name, a menu with zero items, a ₹0 price, a missing image,
a four-line cuisine list, a review with no author. Covering every edge state by hand is
slow and always incomplete, so the breakage ships to users. `[2–3 sentences, concrete.]`

## What the agent does  ·  [Agent Solution & Engineering — 30, tie-break #1]
Given a component, the agent: derives an adversarial battery of prop/state combos from
the prop types, renders each across viewports, reads the **specific** failing assertion,
patches, and re-runs — remembering dead-end patches so it doesn't loop. Design choices and
WHY each earned its place (this is what the 30 points grade):
- **Better context:** feeds harness output back, not just the code. `[why]`
- **Verification:** re-runs the oracle after every patch. `[why]`
- **Memory:** tracks failed patches after observing a retry loop. `[why]`
- **Content-presence verifier:** the anti-gaming assertion (see Hot Take). `[why]`
Components I tried and REMOVED are in the changelog — restraint is graded here.

## What "good" looks like + the result  ·  [End-to-End Quality — 20]
The deliverable a user actually uses is the **hardened component** — a clean diff a
frontend dev would merge, not agent-scarred code. Before running eval, "good" = survives
≥ `[target]%` of adversarial cases with content intact and a diff under `[N]` lines.
`[Link to one real before/after component so a judge can eyeball merge-quality.]`

## Baseline vs solution  ·  [Measured Improvement — 15, tie-break #3]
Same task, same cases, **same model**. See `CHANGELOG.md` for the iteration-by-iteration
story. Resource differences between baseline and solution are disclosed here honestly:
`[e.g. "advanced solution has harness access + verify loop; baseline is one-shot. Both
use <model>."]`

| Metric | Baseline | Agent | Change |
|---|---|---|---|
| Survival rate (primary) | `[%]` | `[%]` | `[+X]` |
| Human time / task | `[min]` | `[min]` | `[−]` |
| Cost / task (tokens) | `[n]` | `[n]` | `[±]` |

## Reproducibility  ·  [Reproducibility — 15, tie-break #2]
See `REPRODUCTION.md`. One command runs baseline, one runs the agent, one runs eval.
Pinned versions + approximate runtime and cost included.

## Pre-existing vs. original  ·  [clears the plagiarism / trace-integrity gate]
- **Original to this submission** (`/eval`, `/agents`, `/corpus`, harness, generator,
  both agents): written by me during the hackathon.
- **Pre-existing, cited:** `[if you use any third-party corpus or baseline, name it +
  license + link here. If your corpus is fully synthetic and self-authored, say so —
  that's the cleanest.]`
- **Coding agents used:** `[tool names]`. Trajectories in `/trajectories`, captured live.

## Main failure mode & Hot Take  ·  [Hot Take — 5]
See bottom of `CHANGELOG.md`. `[One-line pointer; keep the full version in the changelog.]`
