# Reproduction guide  ·  [Reproducibility — 15, tie-break #2]

Written for someone starting from a clean machine.

## What needs model access, and what does not

| Step | npm script | Needs a logged-in Claude Code CLI? |
| --- | --- | --- |
| Generate the case battery | `npm run cases` | No |
| Score the fragile floor | `npm run floor` | No |
| Re-score the committed snapshots | `npm run compare` | No |
| Produce a new baseline card | `npm run baseline` | **Yes** |
| Produce a new agent card | `npm run agent` | **Yes** |

There is **no API-key path in this repo**. `agents/_shared.mjs` calls the locally installed
Claude Code CLI in headless mode (`claude -p …`), which uses the operator's existing logged-in
session; `ANTHROPIC_API_KEY` is never read. If `claude` is not on `PATH`, point at the binary
with `CLAUDE_CLI=/path/to/claude`.

Everything in `results/` and `trajectories/` is committed, so **the whole comparison can be
verified without any model access** — steps 1, 2 and 4 below re-score the committed cards with
the real oracle. Only steps 3a/3b regenerate them.

## Versions (pinned, verified on the machine that produced `results/`)
- Node `v22.14.0`, npm `10.9.2`, Playwright `1.62.1`, Claude Code CLI `2.1.251`.
- Models: `claude-haiku-4-5` (primary comparison), `claude-opus-5` (secondary no-damage check).
- Effort: `high` on both sides of both comparisons (`EFFORT` in `agents/_shared.mjs`).

## Setup (clean env)
```bash
git clone [your-repo] && cd edge-hardener
npm install
npx playwright install chromium
npm run cases          # writes results/cases.json — deterministic, no randomness or clock
```
`npm run cases` regenerates `results/cases.json` byte-identically; run it or skip it, the
committed file is the same file. It produces **25 cases**, scored at 4 viewports = **100
(case, viewport) pairs**.

## 1. Fragile floor (one command)
```bash
npm run floor          # node eval/harness.mjs --component corpus/restaurant-card.mjs --cases results/cases.json
```
Prints the harness JSON to stdout; it writes no file. Do **not** redirect this into a `.json` —
npm prepends its own banner lines to stdout and the result will not parse. To capture it,
call the harness directly:
```bash
node eval/harness.mjs --component corpus/restaurant-card.mjs --cases results/cases.json > floor.json
```

## 2. Score the committed cards (no model needed)
```bash
node eval/harness.mjs --component results/baseline-card.mjs --cases results/cases.json   # Haiku baseline
node eval/harness.mjs --component results/agent-card.mjs   --cases results/cases.json    # Haiku agent
```

## 3a. Regenerate the baseline (needs the CLI)
```bash
npm run baseline
```
Runs `agents/run_baseline.mjs` (one shot, no tools, no harness feedback) → writes
`results/baseline-card.mjs`, `results/baseline-run.json` and a fresh
`trajectories/baseline-*.jsonl`, then scores it into `results/baseline.json`.

## 3b. Regenerate the solution (needs the CLI)
```bash
npm run agent
```
Runs `agents/run_advanced.mjs` (verify-fix loop against the oracle) → writes
`results/agent-card.mjs`, `results/agent-run.json`, `results/agent-memory.json` and a fresh
`trajectories/advanced-*.jsonl`, then scores it into `results/agent.json`.

Both scripts default to `MODEL=claude-haiku-4-5`. Overridable env vars: `MODEL`, `EFFORT`,
`COMPONENT`, `OUT`, `CASES`, and `MAX_ITERS` (advanced only, default 8).

## 4. Compare (one command)
```bash
npm run compare        # writes results/comparison.json and prints the table
```
Scores all three variants with the same oracle and the same cases.

> Heads-up: the committed `results/comparison.json` is a stale pre-switch Opus snapshot — its
> paths point at `results/baseline-card.mjs` / `results/agent-card.mjs`, which now hold the
> **Haiku** cards. Running `npm run compare` overwrites it with correct Haiku numbers. The
> two files to cite are `results/comparison-haiku.json` and `results/comparison-opus.json`.

Reproduce the primary (Haiku) comparison file exactly:
```bash
COMPARE_OUT=results/comparison-haiku.json npm run compare
```

## The Opus 5 comparison (env-var command)

Opus 5 is kept as a **secondary no-damage check**: it solved the whole battery one-shot, so
baseline and agent both sit at 100% and the loop has no survival headroom to demonstrate. A
fallible model is what makes the loop's contribution measurable, which is why Haiku 4.5 is
primary. (Reasoning is written above the `MODEL` export in `agents/_shared.mjs`.)

**Re-scoring the committed Opus snapshots — no model access needed:**
```bash
COMPARE_OUT=results/comparison-opus.json \
BASELINE_CARD=results/baseline-card.opus.mjs \
AGENT_CARD=results/agent-card.opus.mjs \
BASELINE_RUN=results/baseline-run.opus.json \
AGENT_RUN=results/agent-run.opus.json \
npm run compare
```
Verified: this reproduces the committed `results/comparison-opus.json` byte-for-byte apart
from `generated_at`. All five paths are resolved **relative to the repo root**, so pass
repo-relative paths, not absolute ones. `BASELINE_RUN`/`AGENT_RUN` matter — without them the
token and cost block in the output file would carry the Haiku run's numbers.

**Regenerating the Opus cards (needs the CLI):**
```bash
MODEL=claude-opus-5 npm run baseline
cp results/baseline-card.mjs results/baseline-card.opus.mjs
MODEL=claude-opus-5 npm run agent
cp results/agent-card.mjs results/agent-card.opus.mjs
cp results/baseline-run.json results/baseline-run.opus.json
cp results/agent-run.json    results/agent-run.opus.json
```
`MODEL` only changes the model — the scripts still write the **default** card paths
(`results/baseline-card.mjs`, `results/agent-card.mjs`), which is why the `.opus.mjs` files
are copies. Setting `OUT` instead would misalign the npm script, whose second half scores the
hardcoded default path. Restore the Haiku cards (steps 3a/3b) before running the primary
comparison again.

**On Windows** these are PowerShell sessions, so use PowerShell env syntax:
```powershell
$env:MODEL='claude-opus-5'; npm run baseline
$env:COMPARE_OUT='results/comparison-opus.json'; $env:BASELINE_CARD='results/baseline-card.opus.mjs'; npm run compare
Remove-Item Env:MODEL, Env:COMPARE_OUT, Env:BASELINE_CARD   # clear before the next run
```

## 5. Look at it (optional, no model needed)

```bash
node demo/serve.mjs --open
```

Opens <http://127.0.0.1:4173/demo/> — one page that imports the same three card files and
renders them against the hardest rows of the battery, at all four widths, with overflow
measured live in the browser. It reads `results/comparison-haiku.json` for the scored figures
and writes nothing. Details and the two cosmetic liberties it takes are in `demo/README.md`.

## Expected output

Haiku 4.5 — `results/comparison-haiku.json`:

| Variant | Survival | Cases | Lines |
| --- | --- | --- | --- |
| Fragile floor | 0.0% | 0/100 | 35 |
| Baseline (one-shot) | 50.0% | 50/100 | 189 (+154) |
| Advanced (verify-fix loop) | 100.0% | 100/100 | 56 (+21) |

Opus 5 — `results/comparison-opus.json`: floor 0.0%, baseline 100.0% (468 lines), agent
100.0% (114 lines).

The `fails` array names each losing (case, viewport, reason). Reasons are `crash`,
`console-error`, `overflow` and `content-lost`; `content-lost` is the anti-gaming check
firing. Steps 1, 2 and 4 are deterministic and reproduce these numbers exactly. Steps 3a/3b
call a model and may land on a different — usually still 100% — card.

## Runtime & cost
- Harness run (100 pairs): **~4 s**. `npm run compare` runs it three times: **~15 s**.
- Haiku baseline: **99.6 s**, 12,189 output tokens, **$0.071963** (`results/baseline-run.json`).
- Haiku agent: **237.7 s** (1 model call + 2 harness runs), 13,641 output tokens,
  **$0.0997874** (`results/agent-run.json`). Full Haiku comparison: **$0.1717504**.
- Opus baseline: **109.2 s**, 9,471 output tokens, **$0.25713** (`results/baseline-run.opus.json`).
- Opus agent: **51.1 s**, 3,544 output tokens, **$0.1996** (`results/agent-run.opus.json`).
  Full Opus comparison: **$0.4567370**.

Costs are `total_cost_usd` as reported by the Claude Code CLI. `SUBMISSION_NOTES.md` carries
the full per-side token breakdown; `trajectories/README.md` maps each run to its trajectory.
