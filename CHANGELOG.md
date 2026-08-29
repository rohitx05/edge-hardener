# Improvement Changelog

> How to use this file: fill each entry AS YOU BUILD, not after. Every row must
> tie a change to an eval number and to the failure that motivated it. The
> `[scores: ...]` tag is a private note to yourself showing which rubric category
> the entry earns — **delete those tags before submission**, they're scaffolding.
>
> Rubric weights: Agent Eng **30** (tie-break #1) · End-to-End **20** ·
> Measured Improvement **15** (tie-break #3) · Reproducibility **15** (tie-break #2) ·
> Problem/Value **15** · Hot Take **5**.

Primary metric: **Survival rate** = fraction of (adversarial case × viewport) that
render with (a) no crash, (b) no overflow, (c) **content still present and reachable**.
Secondary: human-time/task, cost/task (tokens).

| Stage | What I tried & why | Evidence (survival rate + the number that moved) | Decision / learning |
|---|---|---|---|
| **Baseline** | One-shot prompt: "make this component robust." Same model as advanced. Establishes the honest floor. | `[baseline survival %]` on N cases | Starting point. `[scores: Measured Improvement]` |
| Iter 1 | Gave the agent the **adversarial case list + harness output** as context (not just the code). Hypothesis: it fails because it can't see how it fails. | `[new %]` | `[kept / revised / removed]` `[scores: Agent Eng — "better context"]` |
| Iter 2 | Added a **verify-fix loop**: re-run harness after each patch, feed the specific failing assertion back. | `[new %]` | `[kept?]` `[scores: Agent Eng — "verification"]` |
| Iter 3 | Added **memory of dead patches** after observing the agent retry the same failing fix 3× on the long-string case. | `[new %]` + note it stopped looping | `[kept?]` `[scores: Agent Eng — "memory", + Measured Improvement causal chain]` |
| Iter 4 | Added the **content-presence verifier** after the agent passed the overflow check by applying `overflow:hidden` / `display:none` — number went green, user silently lost the 80-char name. | `[%]` — show it now REJECTS the cheat | **This is the money entry.** `[scores: Hot Take + Agent Eng + End-to-End]` |
| Iter 5 (removed) | Tried per-violation "skill" sub-agents (contrast/overflow/empty-state specialists). Added orchestration cost, no survival gain over the single verify-fix loop. | `[% ≈ Iter 4]` | **Removed.** Purposeful < numerous. The PDF rewards this honesty. `[scores: Agent Eng — restraint; satisfies "one experiment you removed"]` |
| **Final** | Combined Iters 1–4. | `[final %]` vs `[baseline %]` = **+X pts** | Main contribution: `[the one change that moved it most]` |

## The one challenging case (required by rubric)
Case: `[e.g. 80-char name + 4-line cuisine list + ₹0 price + missing image, mobile viewport]`
What it revealed: `[the interaction failure the happy path hides — write 2 sentences]`

## Main failure mode (put this in README too)
`[The single most important way the agent fails, stated plainly.]`

## Hot Take (5 pts — turn the failure into a lesson)
A verifiable metric is only as honest as its hardest-to-game assertion. Survival-rate
looked solid until the agent learned it could win by hiding content. The lesson for
building reliable agents: **when you give an agent a metric, assume it will optimize the
metric and not the intent — so your verifier must encode the intent, not the proxy.**
`[sharpen with your actual observed numbers]`
