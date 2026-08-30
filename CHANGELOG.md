# Improvement Changelog

Primary metric: **survival rate** — the fraction of (adversarial case x viewport)
pairs where the card renders with no crash, no failed image request, no element
overflowing its container, and every required value still visible. 25 cases x 4
viewports = 100 scored pairs, computed by `eval/harness.mjs`. Baseline and agent
run on the **same model** (claude-haiku-4-5) via `agents/_shared.mjs`, so any
difference is attributable to design, not model choice.

| Stage | What I tried and why | Evidence | Decision / learning |
|---|---|---|---|
| Baseline floor | The unhardened `corpus/restaurant-card.mjs` — nowrap titles, no null guards, image `src` set blindly. | Fragile: **0/100** survive | The starting point. Every failure family is present: crash, console-error, overflow, content-lost. |
| Harness correction | First harness run reported a flat 0% for *everything*, including a hand-written clean card. Investigated instead of trusting it. | Chromium refused to load the component as a `file://` module, so nothing rendered and all 100 pairs scored as crashes. | **Fixed the loader** (serve over loopback), verified a clean card scores 100%. The oracle was lying; caught it before it poisoned every downstream number. This is the entry I'm most glad exists. |
| Baseline (one-shot) | Simplest reasonable approach: one model call, "make this component robust," no tools, no feedback. | **50/100** survive, 189 lines, 1 call, $0.072 | Honest floor for "just ask the model once." It reaches for `text-overflow: ellipsis` and clips long names to a tooltip — looks fixed, fails the content-presence check on the 89-char unbreakable string. |
| Fair-baseline correction | An early hardening pass gave the agent a prop the baseline never saw, producing a fake 100-point gap. Rejected it. | Reclassified: the "gain" was entirely one withheld prop. | Gave **both** sides the identical data contract. A rigged baseline is the fastest way to lose credibility with engineer-judges; the real gap has to survive a fair comparison. |
| Model choice | On claude-opus-5 the one-shot baseline *also* scored 100% — a frontier model solves self-contained layout hardening blind. | Opus: baseline 100%, agent 100% (see secondary result). | Moved the primary comparison to claude-haiku-4-5, where the model is fallible and the agent design has something to prove. Kept Opus as a "does the loop damage a strong model?" check. |
| Advanced (verify-fix) | Agent renders the card, runs the harness, reads the *specific* failing assertions, patches against them without hiding content, re-scores, keeps the change only if survival rose. | **100/100** survive, 56 lines, 1 iteration, $0.100 | +50 points over the fair baseline, and a *smaller* diff (56 vs 189 lines). The single thing that moved the number: the agent can see how it failed. |
| Removed: dead-patch memory | Built memory of failed patches to prevent re-trying dead ends. | `dead_patches: 0` across every run — it never fired. | **Cut.** The task converges in one iteration; memory has no failure to catch here. Kept the finding, dropped the code. |
| Removed: multi-iteration stop rule | A 2-iterations-without-progress stop guard. | Never triggered — every run reached 100% on iteration 1. | **Cut.** Scaffolding for a loop that doesn't loop on this task. |
| Removed: hard-rule guard | A static check to reject `display:none` / clipping cheats before they cost a harness run. | Passed unit tests, never rejected a live patch (the first patch was always clean). | **Kept in tests, not claimed as load-bearing.** Verified by 15 unit checks, not by the run. Honest about the difference. |
| Final | Fair baseline vs verify-fix agent, same model, same 100 pairs. | **50% -> 100%**, 189 -> 56 lines | Main contribution: feeding verified failure signal back into the model. Everything else was measured and cut. |

## The one challenging case
`stacked-everything` — an 89-char unbreakable name, null rating, null image, six cuisines,
and a long booking URL, at 320px. The fragile card **crashes** (`null.toFixed`). The
baseline **overflows** (the URL and unbroken name spill the container). The agent wraps,
guards the nulls, and keeps every required value inside the box. It's the case that proves
the metric can't be passed by clipping — the full name has to actually fit and stay readable.

## Main failure mode
A verifiable metric is gameable. "No overflow" can be satisfied by `overflow:hidden` or
`display:none` — the number goes green while the user silently loses content. The whole
design answer is that the harness's third check is **content presence**, not just
"nothing spills." The metric encodes the intent, not the proxy.

## Hot take
Agentic scaffolding has a capability ceiling. On claude-opus-5 this task is solved in one shot. Memory, verification loops, and orchestration are pure overhead above that line. On claude-haiku-4-5 the same scaffolding recovers 50 points. The engineering question isn't "how many components can I add," it's "is my model above or below the line where they help?" I built four components; one carried the entire gain and I cut the other three. Knowing which side of that line you're on is the design decision.

What surprised me most was that the baseline's ellipsis "fix" looked correct to the eye and still failed. The full name only survived in a tooltip, which is exactly why the harness checks content presence and not just overflow.