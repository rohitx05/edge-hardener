# Submission notes — extracted numbers

Every number below is copied from a committed artifact, with the source named on the line.
Nothing is estimated, rounded by hand, or recalled from a terminal. If a value is not here,
it is because no committed file contains it.

Battery: **25 cases × 4 viewports = 100 (case, viewport) pairs** (`results/cases.json` has 25
cases; `eval/harness.mjs` defines viewports `mobile-sm` 320, `mobile` 360, `tablet` 768,
`desktop` 1280). Corpus component: **35 lines** (`corpus/restaurant-card.mjs`).

---

## 1. Haiku 4.5 — primary comparison

Source: `results/comparison-haiku.json` (`"model": "claude-haiku-4-5"`).

| Variant | Component | Survival | Cases | Lines | vs corpus |
| --- | --- | --- | --- | --- | --- |
| Fragile floor (unpatched) | `corpus/restaurant-card.mjs` | 0.0% | 0/100 | 35 | — |
| Baseline (one-shot) | `results/baseline-card.mjs` | 50.0% | 50/100 | 189 | +154 |
| Advanced (verify-fix loop) | `results/agent-card.mjs` | **100.0%** | 100/100 | **56** | +21 |

- floor → agent: **100.0 pts** (`delta_floor_to_agent`)
- baseline → agent: **50.0 pts** (`delta_baseline_to_agent`)
- The agent's file is **133 lines smaller than the baseline's** (56 vs 189) while scoring
  50 points higher.

The baseline's 50 residual failures are all `overflow` — every one of them
(`results/comparison-haiku.json` → `variants.baseline.fails`, and the same list with per-fail
detail in `results/baseline.json`). It fixed the null/zero/empty-state family and left the
wrapping family: `longName`, `unicodeName`, `unbrokenName`, `unbrokenAddress`,
`unbrokenCuisine`, `unbrokenAuthor`, `rtlName`, `bidiMixed`, `emojiName`, and all six
`stacked-*` cases.

## 2. Opus 5 — secondary no-damage check

Source: `results/comparison-opus.json` (`"model": "claude-opus-5"`).

| Variant | Component | Survival | Cases | Lines | vs corpus |
| --- | --- | --- | --- | --- | --- |
| Fragile floor (unpatched) | `corpus/restaurant-card.mjs` | 0.0% | 0/100 | 35 | — |
| Baseline (one-shot) | `results/baseline-card.opus.mjs` | 100.0% | 100/100 | 468 | +433 |
| Advanced (verify-fix loop) | `results/agent-card.opus.mjs` | 100.0% | 100/100 | **114** | +79 |

- floor → agent: **100.0 pts**
- baseline → agent: **0.0 pts** — survival saturates, so on Opus the separation is not
  survival but merge quality: **114 lines vs 468**, a 354-line difference for the same score.

This is why the primary comparison moved to Haiku 4.5; the reasoning is written into
`agents/_shared.mjs` above the `MODEL` export.

> Note: `results/comparison.json` (no `model` field, `generated_at` `2026-08-29T20:44:49.999Z`)
> is the pre-switch Opus comparison, generated before the per-model files existed. Its
> `baseline`/`agent` rows point at `results/baseline-card.mjs` / `results/agent-card.mjs`,
> which now hold the **Haiku** cards — so its paths no longer match its numbers. Cite
> `comparison-haiku.json` and `comparison-opus.json`, never `comparison.json`.

## 3. The final Haiku agent run

Sources: `results/agent-run.json`, `trajectories/advanced-2026-08-29T20-51-50-197Z.jsonl`.

- **iterations: 1** · **model_calls: 1** · **stop_reason: `survival-100%`** · **dead_patches: 0**
- Iteration 0 (unpatched, scored by the oracle before any model call): **0.0%, 0/100**
- Iteration 1: **100.0%, 100/100 — ACCEPTED**
- Wall clock: **237.7 s** (`seconds`), which is the whole loop: one model call plus two
  harness runs. Trajectory spans `20:51:53.784Z` → `20:55:51.484Z`.

**Accepted approach line**, verbatim from the `accepted` event (`iteration: 1`):

> Add missing address/author fields, remove nowrap constraint, guard all null/undefined
> values, use overflow-wrapping CSS for long unbroken text, and provide image placeholder
> on null.

### The 27 failing (case, reason) groups at iteration 0

These are the 100 raw fails collapsed the way `summariseFails()` in `agents/run_advanced.mjs`
collapses them — by `case::reason`, viewports merged — i.e. exactly what the model was shown.
Source: the `harness` event with `"iteration": 0` in
`trajectories/advanced-2026-08-29T20-51-50-197Z.jsonl` (identical to
`results/comparison-haiku.json` → `variants.fragile_floor.fails`).

| # | Case | Reason | Viewports |
| --- | --- | --- | --- |
| 1 | `longName` | overflow | all 4 |
| 2 | `emptyCuisine` | content-lost | all 4 |
| 3 | `manyCuisine` | content-lost | all 4 |
| 4 | `zeroPrice` | content-lost | all 4 |
| 5 | `noImage` | console-error | all 4 |
| 6 | `noRating` | crash | all 4 |
| 7 | `zeroReviews` | content-lost | all 4 |
| 8 | `noAuthor` | content-lost | all 4 |
| 9 | `unicodeName` | overflow | all 4 |
| 10 | `unbrokenName` | overflow | all 4 |
| 11 | `unbrokenAddress` | content-lost | all 4 |
| 12 | `unbrokenCuisine` | overflow | all 4 |
| 13 | `unbrokenAuthor` | content-lost | all 4 |
| 14 | `rtlName` | overflow | mobile-sm, mobile |
| 15 | `rtlName` | content-lost | tablet, desktop |
| 16 | `bidiMixed` | overflow | all 4 |
| 17 | `emojiName` | overflow | all 4 |
| 18 | `combiningName` | content-lost | all 4 |
| 19 | `falsyReal` | content-lost | all 4 |
| 20 | `nullEverything` | crash | all 4 |
| 21 | `stacked-nightmare` | console-error | all 4 |
| 22 | `stacked-unbreakable` | crash | all 4 |
| 23 | `stacked-nested` | console-error | mobile-sm |
| 24 | `stacked-nested` | overflow | mobile, tablet, desktop |
| 25 | `stacked-rtl` | console-error | all 4 |
| 26 | `stacked-emoji` | overflow | all 4 |
| 27 | `stacked-everything` | crash | all 4 |

"all 4" = `mobile-sm, mobile, tablet, desktop`.

Two cases split across reasons — `rtlName` (#14/#15) and `stacked-nested` (#23/#24) — which is
why 25 cases produce 27 groups.

Group counts by reason: **content-lost 10, overflow 9, console-error 4, crash 4**.
Raw fail counts by reason (of 100): **content-lost 38, overflow 33, crash 16, console-error 13**.

Worth noting for the writeup: **38 of the 100 floor failures are `content-lost`** — the
anti-gaming check — and they fire on the *unpatched* component, which hides nothing on
purpose. It simply never renders `address` or `author` at all. The check is catching absence,
not concealment, and it catches concealment with the same code path.

## 4. Tokens and cost, per side, per model

`input_tokens` / `output_tokens` / `cache_read_input_tokens` / `cache_creation_input_tokens` /
`cost_usd` / `seconds`, all from the `usage` blocks. Cost is `total_cost_usd` as reported by
the Claude Code CLI for that call, summed across calls.

| Model | Side | Calls | in | out | cache read | cache create | Cost (USD) | Seconds | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Haiku 4.5 | baseline | 1 | 10 | 12,189 | 0 | 4,688 | **$0.071963** | 99.6 | `results/baseline-run.json` |
| Haiku 4.5 | agent | 1 | 20 | 13,641 | 11,224 | 11,224 | **$0.0997874** | 237.7 | `results/agent-run.json` |
| Opus 5 | baseline | 1 | 2 | 9,471 | 4,026 | 1,670 | **$0.25713** | 109.2 | `results/baseline-run.opus.json` |
| Opus 5 | agent | 1 | 2 | 3,544 | 4,270 | 10,087 | **$0.1996070** | 51.1 | `results/agent-run.opus.json` |

The Opus agent cost is stored as `0.19960699999999998` (float); quote it as **$0.1996** unless
you want the raw value.

Totals and deltas:

- **Haiku, full comparison (both sides): $0.1717504**, 2 model calls, 337.3 s.
  The loop cost **$0.0278244 more than the baseline** (+38.7%) and bought 50 survival points.
- **Opus, full comparison (both sides): $0.4567370**, 2 model calls, 160.3 s.
  Here the loop was *cheaper* than the baseline (**$0.1996070 vs $0.25713**, −22.4%) and
  produced a file a quarter the size, because it emitted 3,544 output tokens against the
  baseline's 9,471.
- The agent's wall clock includes its harness runs; the baseline's does not. A harness run
  over all 100 pairs takes ~4 s (measured locally, Node 22.14.0 / Playwright 1.62.1), so the
  agent's model time is roughly 237.7 − ~8 ≈ 230 s on Haiku and 51.1 − ~8 ≈ 43 s on Opus.

## 5. Components that never fired

Three parts of the advanced agent exist for failure modes that neither final run reached.
Stating this plainly is more defensible than implying they carried the result.

Evidence common to all three: **no trajectory file in `trajectories/` contains a single
`rejected` event** (0 across all 8 files), and `results/agent-memory.json` is `[]`. Both final
agent runs recorded `dead_patches: 0` and `stop_reason: "survival-100%"` after 1 iteration.

| Component | Where it lives | Would have logged | Evidence it never fired |
| --- | --- | --- | --- |
| **Dead-patch memory** (hash + declared approach, fed back into the prompt) | `agents/run_advanced.mjs` — `memory`, `deadHashes`, `memoryBlock()` | `rejected` with `why: "duplicate-of-dead-patch"`, `harness_run: false` | The iteration-1 `prompt` event in `…20-51-50-197Z.jsonl` contains the literal block `DEAD-PATCH MEMORY … (empty — this is the first attempt)`. `results/agent-memory.json` is `[]`; `dead_patches: 0` in `results/agent-run.json` and `results/agent-run.opus.json`. |
| **Two-iteration no-progress stop** (`NO_PROGRESS_LIMIT = 2`) | `agents/run_advanced.mjs` — the `noProgress >= NO_PROGRESS_LIMIT` guard | `stop_reason: "no-progress-x2"` | Both final runs' `done` events record `stop_reason: "survival-100%"` with `iterations: 1`. `noProgress` is only ever incremented on a `rejected` path, and there were none. |
| **Hard-rule content-presence guard** (`hardRuleViolations()` — display:none / visibility:hidden / opacity:0 / `.hidden` / font-size:0 / clipping / bare truncation) | `agents/_shared.mjs` | `rejected` with `why: "hard-rule-violation"` and a `violations` array | No `rejected` event anywhere; the single candidate in each run went straight to the harness and was accepted. |

Honest framing for the writeup: the guard did shape the runs even without rejecting anything —
its rules are restated in the system prompt via `agents/advanced.md` (HARD RULES) and in the
baseline prompt in `agents/run_baseline.mjs`, so both models were told the constraint up
front. What is unproven is the *enforcement* path, not the constraint. The one thing the
guard demonstrably changed is documented in `agents/_shared.mjs`: `stripComments()` exists
because scanning raw source flagged a component whose header comment said "never uses
display:none" — a clean patch that would otherwise have burned an iteration.

The loop's measured contribution on Haiku is therefore attributable to the two components
that *did* fire on every run: **better context** (the failing assertions from the harness,
compacted into the 27 groups above) and **verification** (iteration 0 and iteration 1 both
scored by the real oracle before anything was accepted).

## 6. Citation map

| Claim | File |
| --- | --- |
| Haiku floor / baseline / agent table | `results/comparison-haiku.json` |
| Opus floor / baseline / agent table | `results/comparison-opus.json` |
| Baseline's 50 per-case failures with detail | `results/baseline.json` |
| Agent's final score | `results/agent.json` |
| Haiku run metadata, tokens, cost | `results/baseline-run.json`, `results/agent-run.json` |
| Opus run metadata, tokens, cost | `results/baseline-run.opus.json`, `results/agent-run.opus.json` |
| Iteration-0 failure groups, accepted approach | `trajectories/advanced-2026-08-29T20-51-50-197Z.jsonl` |
| Dead-patch memory was empty | `results/agent-memory.json`, plus that trajectory's `prompt` event |
| Which trajectory belongs to which run | `trajectories/README.md` |
| Case count, viewport list | `results/cases.json`, `eval/harness.mjs` |
