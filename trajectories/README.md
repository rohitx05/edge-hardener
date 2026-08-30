# Trajectory legend

Eight live trajectory logs, one per agent run. Nothing here is reconstructed — each file is
appended line-by-line by `trajectory()` in `agents/_shared.mjs` while the run is happening,
so a file's last line is the run's last event.

Filenames are `<agent>-<ISO timestamp with : and . replaced by ->.jsonl`. The timestamp is
the moment the run started, in UTC.

## Which file is which run

The authoritative link is the `trajectory` field inside each `results/*-run.json`; the table
below just spells it out.

| Trajectory file | Agent | Model | Battery | Outcome | Status |
| --- | --- | --- | --- | --- | --- |
| `baseline-2026-08-29T15-59-23-373Z.jsonl` | baseline (one-shot) | `claude-opus-5` | early, 30 pairs | wrote a 14,395-byte card | superseded |
| `advanced-2026-08-29T16-01-44-265Z.jsonl` | advanced (verify-fix) | `claude-opus-5` | early, 30 pairs | 50.0% → 100.0% (15/30 → 30/30), 1 iteration | superseded |
| `baseline-2026-08-29T20-37-07-276Z.jsonl` | baseline | `claude-opus-5` | 100 pairs | wrote a 13,571-byte card | superseded |
| `advanced-2026-08-29T20-38-49-669Z.jsonl` | advanced | `claude-opus-5` | 100 pairs | 0.0% → 100.0% (0/100 → 100/100), 1 iteration | superseded |
| `baseline-2026-08-29T20-41-38-640Z.jsonl` | baseline | `claude-opus-5` | 100 pairs | wrote a 14,578-byte card | **final — Opus baseline** |
| `advanced-2026-08-29T20-43-45-251Z.jsonl` | advanced | `claude-opus-5` | 100 pairs | 0.0% → 100.0% (0/100 → 100/100), 1 iteration | **final — Opus agent** |
| `baseline-2026-08-29T20-49-58-083Z.jsonl` | baseline | `claude-haiku-4-5` | 100 pairs | wrote a 4,786-byte card | **final — Haiku baseline (primary)** |
| `advanced-2026-08-29T20-51-50-197Z.jsonl` | advanced | `claude-haiku-4-5` | 100 pairs | 0.0% → 100.0% (0/100 → 100/100), 1 iteration | **final — Haiku agent (primary)** |

Scored runs and their trajectories:

- **Primary comparison — Haiku 4.5** (`results/comparison-haiku.json`): baseline
  `…20-49-58-083Z` → `results/baseline-card.mjs`; agent `…20-51-50-197Z` →
  `results/agent-card.mjs`. Named in `results/baseline-run.json` and `results/agent-run.json`.
- **Secondary no-damage check — Opus 5** (`results/comparison-opus.json`): baseline
  `…20-41-38-640Z` → `results/baseline-card.opus.mjs`; agent `…20-43-45-251Z` →
  `results/agent-card.opus.mjs`. Named in `results/baseline-run.opus.json` and
  `results/agent-run.opus.json`.

The two 15:59/16:01 files predate the corpus expansion: the battery was 10 cases × 3
viewports = 30 pairs, before `mobile-sm` (320px) and the 15 extra cases were added. The
20:37/20:38 pair is an Opus run that was simply re-run four minutes later; only the later
pair was scored into a comparison file. Kept because the deliverable asks for every agent
run, not only the winning ones.

## How to read a line

Each line is one JSON object: `{ "ts": <ISO time>, "event": <name>, …event-specific fields }`.
A run reads top to bottom as **instruction** (the system prompt, model, effort, paths) →
**harness** at `iteration: 0` (the unpatched starting score, advanced only) → **prompt** (the
full user message that iteration, failing assertions and dead-patch memory included) →
**model_response** (raw reply text, token usage, cost) → **harness** for that iteration (the
oracle's verdict on the candidate) → **accepted** or **rejected** (what the loop did with it)
→ **done** (stop reason and totals).

Event fields, by name:

| `event` | Fields | Meaning |
| --- | --- | --- |
| `instruction` | `model`, `effort`, `component`, `system` (+ `out` on advanced, `user` on baseline) | Run setup. The baseline's only prompt is logged here, since it never sends a second one. |
| `harness` | `iteration`, `survival_rate`, `pass`, `total`, `fails[]` (+ `hash`, `approach` on iterations ≥ 1; `label` on iteration 0) | Advanced only — a real `eval/harness.mjs` score. Every number in the writeup traces to one of these. |
| `prompt` | `iteration`, `user` | Advanced only — the exact user message sent that round. |
| `model_response` | `stop_reason`, `usage`, `text` (+ `iteration` on advanced) | The unedited model reply. |
| `accepted` | `iteration`, `hash`, `approach`, `from`, `to` | Candidate raised survival; it becomes the new best. |
| `rejected` | `iteration`, `hash`, `approach`, `why` (+ `violations`, `left`, `harness_run`) | Candidate reverted. `why` is one of `duplicate-of-dead-patch`, `hard-rule-violation`, `harness-error`, `no-improvement`. |
| `write` | `path`, `bytes` | Baseline only — the one-shot file hitting disk. |
| `done` | `stop_reason`, `survival_rate`, `iterations`, `model_calls`, `dead_patches` | Advanced only. |

`hash` is the first 12 hex characters of the SHA-256 of the candidate file — the identity the
dead-patch memory keys on.

No file here contains a `rejected` event. Every advanced run reached 100% on its first
candidate, so the reject paths never executed; see `SUBMISSION_NOTES.md` for what that means
for the components that depend on them.

## Reading one quickly

```bash
# every event in a run, one per line
node -e "require('fs').readFileSync(process.argv[1],'utf8').trim().split('\n').forEach(l=>{const o=JSON.parse(l);console.log(o.ts,o.event,o.survival_rate||o.stop_reason||'')})" \
  trajectories/advanced-2026-08-29T20-51-50-197Z.jsonl
```
