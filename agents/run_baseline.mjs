// Baseline agent — one shot, no tools, no feedback. The honest floor for Measured Improvement.
//
// Run: node agents/run_baseline.mjs
// Out: results/baseline-card.mjs  (+ results/baseline-run.json, trajectories/baseline-*.jsonl)
//
// It gets the same model, the same effort, and the same task description as the advanced
// agent. What it does NOT get is the harness: it never sees a failing assertion and never
// re-runs the oracle. That single difference is the thing being measured.

import { MODEL, EFFORT, callModel, extractCode, read, write, trajectory } from './_shared.mjs';

const COMPONENT = process.env.COMPONENT || 'corpus/restaurant-card.mjs';
const OUT = process.env.OUT || 'results/baseline-card.mjs';

const traj = trajectory('baseline');
const instruction = read('agents/baseline.md');
const source = read(COMPONENT);

const system = `${instruction}

You are hardening a framework-free ES module that exports render(props) -> HTMLElement.
Return ONLY the full updated file in a single \`\`\`js code block. No commentary.`;

const user = `Component file: ${COMPONENT}

\`\`\`js
${source}
\`\`\`

Rewrite this file so it survives adversarial data: absurdly long names, empty arrays, many
array items, "₹0" and other falsy-looking-but-real values, null image, null rating, null
author, zero counts, and unicode/emoji text — at 360px, 768px and 1280px wide.

Nothing may overflow its container, nothing may throw, and every meaningful value must stay
visible. Never hide content with display:none, visibility:hidden, opacity:0 or clipping;
if you truncate visually, expose the full value via title/aria-label.`;

console.log(`baseline · model=${MODEL} effort=${EFFORT} · one shot, no harness`);
traj.log('instruction', { model: MODEL, effort: EFFORT, component: COMPONENT, system, user });

const t0 = Date.now();
const res = await callModel({ system, user });
const seconds = ((Date.now() - t0) / 1000).toFixed(1);

traj.log('model_response', { stop_reason: res.stop_reason, usage: res.usage, text: res.text });

const code = extractCode(res.text);
write(OUT, code);
traj.log('write', { path: OUT, bytes: code.length });

write('results/baseline-run.json', JSON.stringify({
  agent: 'baseline', model: MODEL, effort: EFFORT, component: COMPONENT, out: OUT,
  calls: 1, seconds: Number(seconds), usage: res.usage, trajectory: traj.file,
}, null, 2));

console.log(`wrote ${OUT} in ${seconds}s · ${res.usage.input_tokens} in / ${res.usage.output_tokens} out · $${(res.usage.cost_usd || 0).toFixed(4)}`);
console.log(`score it:  node eval/harness.mjs --component ${OUT} --cases results/cases.json`);
