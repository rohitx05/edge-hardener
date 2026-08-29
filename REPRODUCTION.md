# Reproduction guide  ·  [Reproducibility — 15, tie-break #2]

Written for someone starting from a clean machine. Fill the `[...]` before submitting.

## Versions (pin these)
- Node `[e.g. 20.x]`, npm `[x]`, Playwright `[x]`, coding agent `[tool + version]`, model `[id]`.

## Setup (clean env)
```bash
git clone [your-repo] && cd edge-hardener
npm install
npx playwright install chromium
node eval/generate_cases.mjs > results/cases.json   # deterministic corpus
```

## 1. Baseline (one command)
```bash
[exact command that runs the one-shot baseline agent on corpus/restaurant-card.mjs,
 writes the hardened file to results/baseline-card.mjs]
node eval/harness.mjs --component results/baseline-card.mjs --cases results/cases.json > results/baseline.json
```

## 2. Solution (one command)
```bash
[exact command that runs the advanced verify-fix agent -> results/agent-card.mjs]
node eval/harness.mjs --component results/agent-card.mjs --cases results/cases.json > results/agent.json
```

## 3. Eval / compare (one command)
```bash
node eval/harness.mjs --component corpus/restaurant-card.mjs --cases results/cases.json   # raw fragile floor
# survival_rate for: fragile floor vs baseline.json vs agent.json
```

## Expected output
- Fragile floor: `[~%]`  ·  Baseline: `[%]`  ·  Agent: `[%]`.
- The `fails` array names each losing (case, viewport, reason). Reason `content-lost`
  is the anti-gaming check firing.

## Runtime & cost
- Harness run: `[~s]`. Full agent run: `[~min, ~tokens, ~$]`. Baseline: `[~min, ~tokens]`.
