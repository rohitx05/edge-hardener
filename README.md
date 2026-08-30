# Edge Hardener

An agent that hardens UI components against the data that breaks them in production —
long names, missing images, null fields, right-to-left text, unbreakable strings — and
proves the improvement with a deterministic, reproducible metric.

## Who has this problem
Any frontend developer shipping data-dense UI. Components pass the happy path — the demo
data always fits — and then break on real content: an 80-character restaurant name, a
menu with zero items, a price of zero, a missing image. Hardening every edge state by
hand is slow, easy to get wrong, and easy to leave half-done, so the breakage ships.

I build in this space, and this is the failure mode I keep seeing. The happy-path data always fits, so the component looks done. Then real content arrives (an 80-character name, an empty menu, a missing image, a price of zero) and the layout breaks in a dozen small ways that are tedious to hunt down by hand. Hardening every edge state manually is slow, easy to get wrong, and easy to leave half-finished, so the breakage ships.

## What it does
Given a component, the agent renders it against an adversarial battery, reads the
*specific* way each case fails, patches the component to fix that failure without hiding
content, and re-scores — keeping a change only if the survival rate went up.

- **Corpus** (`eval/generate_cases.mjs`): 25 synthetic, self-authored adversarial cases,
  each declaring which values must remain visible.
- **Oracle** (`eval/harness.mjs`): renders each case across 4 viewports (100 scored
  pairs) in headless Chromium and applies three checks in order — no crash, no failed
  image request, no overflow, **and every required value still present and visible**.
- **Baseline** (`agents/run_baseline.mjs`): one model call, no tools, no feedback.
- **Agent** (`agents/run_advanced.mjs`): the verify-fix loop above.

Both agents import the model from `agents/_shared.mjs`, so "same model" is enforced by
construction, not by promise.

## Result

Primary comparison — claude-haiku-4-5, 100 scored pairs, identical cases and data
contract for both sides:

| Metric | Baseline (one-shot) | Agent (verify-fix) | Change |
|---|---|---|---|
| Survival rate | 50.0% (50/100) | 100.0% (100/100) | **+50.0** |
| Lines of code | 189 | 56 | 3.4x smaller |
| Model calls | 1 | 1 | same |
| Cost / run | $0.072 | $0.100 | +$0.028 |
| Wall time | 99.6s | 237.7s | +138s |

The agent wins on the metric *and* ships a smaller, more mergeable diff. The extra cost
and time buy a harness round-trip; the extra 50 points come from the agent being able to
see how it failed.

Secondary check — claude-opus-5: baseline and agent both score 100%. A frontier model
hardens this component in one shot, so the loop adds no survival there — but it produces
114 lines against the baseline's 468. The scaffolding doesn't help a strong model's
*score*, and it doesn't damage its output either. Full reasoning in `CHANGELOG.md`.

## Pre-existing vs. original
- **Original to this submission:** everything in `agents/`, `eval/`, `corpus/`, and
  `demo/` — the harness, the corpus generator, both agents, the demo page. All written
  during the hackathon.
- **Corpus data:** fully synthetic and self-authored. No scraped, private, or licensed
  data anywhere in the repo.
- **Coding agent used:** Claude Code. Representative trajectories for every agent run are
  in `trajectories/` (see `trajectories/README.md`), captured live — instruction, prompt,
  model response, harness result, accept/reject.

## Safety and human oversight
Every action here is a sandboxed render — the harness runs headless and writes only to
`results/`; nothing is deployed. The agent *proposes* component edits; a human reviews
the diff and decides whether to merge. No change ships without that review. The demo page
only reads and re-checks the committed cards; it never writes.

## Reproduce it
See `REPRODUCTION.md` for clean-environment setup and the exact commands for the baseline,
the agent, and the evaluation, with pinned versions and expected output. In short:
`npm install` -> `npx playwright install chromium` -> `npm run cases` ->
`npm run compare` reproduces the table above from committed snapshots with no model calls.

## The insight
See the Hot Take in `CHANGELOG.md`: agentic scaffolding has a capability ceiling, and the
engineering that matters is knowing which side of it your model is on.
