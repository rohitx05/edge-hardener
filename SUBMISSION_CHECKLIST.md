# Submission checklist — map to points, tick as you go

Deadline: **Aug 31, 18:00 UTC (11:30 PM IST)**. Freeze code ~6 PM IST, submit ~9 PM IST.
Checkpoint target (everything works): **Aug 30, 23:59 UTC (5:29 AM IST 31st)**.

## Four required deliverables (a missing one can fail the gate)
- [ ] **Solution code + Improvement Changelog** — full runnable project, `CHANGELOG.md` filled with real numbers, README intended-user/bottleneck/value + main failure mode + hot take.
- [ ] **Reproduction guide** — `REPRODUCTION.md`, tested from a *fresh* clone/container.
- [ ] **Solution video ≤5 min** — problem → baseline → one full live run → final comparison → the change that mattered most → one experiment removed. Your voice.
- [ ] **Agent trajectories** — for every agent used, in `/trajectories`, captured live, legible (instruction → tool calls → tool responses → retries → human checkpoints). Do not fabricate.

## Rubric coverage (100)
- [ ] Problem & User Value (15): specific user = you; concrete bottleneck in README.
- [ ] Agent Solution & Engineering (30, TB#1): each component justified by an observed failure in the changelog; removed experiment documented.
- [ ] End-to-End Quality (20): hardened component is a clean, mergeable diff; deliverables read human, not AI.
- [ ] Measured Improvement (15, TB#3): same cases, same model, baseline→final table filled; the one challenging case explained.
- [ ] Reproducibility (15, TB#2): 3 one-liners work from clean env; versions + runtime + cost pinned.
- [ ] Hot Take (5): content-presence gaming story, sharpened with real numbers.

## Ground-rule gate (integrity checks Aug 31–Sep 1)
- [ ] Sandbox: harness runs headless; no live/destructive actions.
- [ ] Human approval: patches that change rendered content are flagged for review (state this in README).
- [ ] Data: corpus fully synthetic + self-authored (say so). Credentials: none in repo.
- [ ] Pre-existing vs original section present and accurate.
- [ ] Every results claim points to a `results/*.json` file (rule #9).

## Order of work (highest leverage first)
1. Today: `npm i`, generate cases, run harness on fragile component → **post the floor number.** Then run baseline → baseline number. (Locks 15+15 machinery + honest floor.)
2. Aug 30: build advanced agent iteratively; fill a changelog row per change with its eval number; capture trajectories live; hit the gaming demo (Iter 4).
3. Aug 31 AM: freeze; write README/changelog prose in your voice.
4. Aug 31 PM: test REPRODUCTION.md in a fresh clone; record video; submit with buffer.
