// Advanced agent — verify-fix loop against the real oracle.
//
// Run: node agents/run_advanced.mjs
// Out: results/agent-card.mjs (+ results/agent-run.json, results/agent-memory.json,
//      trajectories/advanced-*.jsonl)
//
// Same model and effort as the baseline. The differences, each of which exists because of an
// observed failure mode:
//   · BETTER CONTEXT — the prompt carries the specific failing assertions from the harness
//     (case, viewport, reason, detail), not just the source file.
//   · VERIFICATION — every candidate is scored by eval/harness.mjs before it is accepted.
//     A candidate that does not raise survival is reverted, never kept.
//   · DEAD-PATCH MEMORY — rejected candidates are remembered by content hash AND by the
//     approach the model declared, and fed back so the loop stops re-proposing them.
//   · CONTENT-PRESENCE GUARD — a static hard-rule scan rejects display:none / opacity:0 /
//     clipping / bare truncation before it costs a harness run.

import {
  MODEL, EFFORT, callModel, extractCode, runHarness, pct, hardRuleViolations, sha,
  read, write, trajectory, propContract,
} from './_shared.mjs';

const COMPONENT = process.env.COMPONENT || 'corpus/restaurant-card.mjs';
const OUT = process.env.OUT || 'results/agent-card.mjs';
const CASES = process.env.CASES || 'results/cases.json';
const MAX_ITERS = Number(process.env.MAX_ITERS || 8);   // hard safety cap
const NO_PROGRESS_LIMIT = 2;                             // stop rule from agents/advanced.md

const traj = trajectory('advanced');
const instruction = read('agents/advanced.md');
const cases = JSON.parse(read(CASES));

const system = `${instruction}

You are hardening a framework-free ES module that exports render(props) -> HTMLElement.
Reply with EXACTLY this shape and nothing else:

APPROACH: <one sentence naming the specific fix you are making this round>
\`\`\`js
<the complete updated file>
\`\`\``;

/** Compact the harness fails into something a model can act on without drowning in JSON. */
function summariseFails(result) {
  const byKey = new Map();
  for (const f of result.fails) {
    const key = `${f.case}::${f.reason}`;
    if (!byKey.has(key)) byKey.set(key, { ...f, viewports: [] });
    byKey.get(key).viewports.push(f.viewport);
  }
  return [...byKey.values()].map((f) => {
    const kase = cases.find((c) => c.id === f.case);
    let line = `- case "${f.case}" [${f.viewports.join(', ')}] -> ${f.reason}`;
    if (f.detail) {
      const d = typeof f.detail === 'string' ? f.detail.split('\n')[0] : JSON.stringify(f.detail);
      line += `\n    detail: ${d.slice(0, 300)}`;
    }
    if (kase) {
      line += `\n    props: ${JSON.stringify(kase.props)}`;
      line += `\n    mustContain: ${JSON.stringify(kase.mustContain)}`;
    }
    return line;
  }).join('\n');
}

const memory = [];   // dead patches: things already tried that did not raise survival
const deadHashes = new Set();

function memoryBlock() {
  if (!memory.length) return '(empty — this is the first attempt)';
  return memory.map((m, i) =>
    `${i + 1}. APPROACH: ${m.approach}\n   rejected: ${m.why}` +
    (m.left ? `\n   it left: ${m.left}` : '')).join('\n');
}

// Identical to the line the baseline gets, so the only asymmetry between the two agents is
// the harness feedback loop.
const contract = propContract(cases);

function buildUser(currentSrc, result) {
  return `Current component (survival ${result.survival_rate}, ${result.pass}/${result.total}):

\`\`\`js
${currentSrc}
\`\`\`

DATA CONTRACT — render(props) is called with these props:
${contract.join(', ')}
Every prop that has a value must be rendered and must stay visible; a prop that is
null/absent needs a sensible empty state.

FAILING ASSERTIONS from eval/harness.mjs — fix these specifically:
${summariseFails(result)}

DEAD-PATCH MEMORY — these were already tried and did NOT raise survival. Do not repeat them;
propose a materially different fix:
${memoryBlock()}

The host container is width:min(viewport,420)px with box-sizing:border-box. "overflow" means
some element's right edge passed the host's, or its scrollWidth exceeded its clientWidth.
Keep the diff minimal and mergeable — this is a real component a frontend dev has to review.`;
}

// ── iteration 0: the starting point, scored by the oracle ────────────────────────────────
let bestSrc = read(COMPONENT);
write(OUT, bestSrc);
let bestResult = await runHarness(OUT, CASES);

console.log(`advanced · model=${MODEL} effort=${EFFORT}`);
console.log(`iter 0 (unpatched): ${bestResult.survival_rate}  ${bestResult.pass}/${bestResult.total}`);
traj.log('instruction', { model: MODEL, effort: EFFORT, component: COMPONENT, out: OUT, system });
traj.log('harness', { iteration: 0, label: 'starting point', survival_rate: bestResult.survival_rate,
  pass: bestResult.pass, total: bestResult.total, fails: bestResult.fails });

const startedAt = Date.now();
const usageTotal = {
  input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0, cost_usd: 0,
};
let calls = 0, noProgress = 0, iteration = 0, stopReason = 'max-iterations';

while (iteration < MAX_ITERS) {
  if (pct(bestResult) >= 100) { stopReason = 'survival-100%'; break; }
  if (noProgress >= NO_PROGRESS_LIMIT) { stopReason = `no-progress-x${NO_PROGRESS_LIMIT}`; break; }
  iteration++;

  const user = buildUser(bestSrc, bestResult);
  traj.log('prompt', { iteration, user });

  const res = await callModel({ system, user });
  calls++;
  for (const k of Object.keys(usageTotal)) usageTotal[k] += res.usage[k] || 0;
  traj.log('model_response', { iteration, stop_reason: res.stop_reason, usage: res.usage, text: res.text });

  const approach = (res.text.match(/APPROACH:\s*(.+)/) || [, '(none declared)'])[1].trim();
  const candidate = extractCode(res.text);
  const hash = sha(candidate);

  // — memory check: refuse to re-run the oracle on a file we already rejected —
  if (deadHashes.has(hash)) {
    memory.push({ approach, why: `byte-identical to an already-rejected candidate (${hash})` });
    noProgress++;
    console.log(`iter ${iteration}: repeat of dead patch ${hash} — skipped (no harness run)`);
    traj.log('rejected', { iteration, hash, approach, why: 'duplicate-of-dead-patch', harness_run: false });
    continue;
  }

  // — hard-rule guard: cheating is rejected without spending a harness run —
  const violations = hardRuleViolations(candidate);
  if (violations.length) {
    deadHashes.add(hash);
    memory.push({ approach, why: `violates HARD RULES: ${violations.join('; ')}` });
    noProgress++;
    console.log(`iter ${iteration}: HARD RULE violation — ${violations.join('; ')}`);
    traj.log('rejected', { iteration, hash, approach, why: 'hard-rule-violation', violations, harness_run: false });
    continue;
  }

  // — verification: the oracle decides, not the model —
  write(OUT, candidate);
  let result;
  try {
    result = await runHarness(OUT, CASES);
  } catch (e) {
    deadHashes.add(hash);
    memory.push({ approach, why: `harness could not score it: ${String(e.message).slice(0, 200)}` });
    noProgress++;
    write(OUT, bestSrc);
    console.log(`iter ${iteration}: harness error — reverted`);
    traj.log('rejected', { iteration, hash, approach, why: 'harness-error', error: String(e.message) });
    continue;
  }

  traj.log('harness', { iteration, hash, approach, survival_rate: result.survival_rate,
    pass: result.pass, total: result.total, fails: result.fails });

  if (pct(result) > pct(bestResult)) {
    console.log(`iter ${iteration}: ${bestResult.survival_rate} -> ${result.survival_rate}  ACCEPTED  (${approach})`);
    traj.log('accepted', { iteration, hash, approach, from: bestResult.survival_rate, to: result.survival_rate });
    bestSrc = candidate;
    bestResult = result;
    noProgress = 0;
  } else {
    const left = [...new Set(result.fails.map((f) => `${f.case}:${f.reason}`))].join(', ');
    deadHashes.add(hash);
    memory.push({ approach, why: `survival ${bestResult.survival_rate} -> ${result.survival_rate} (no gain)`, left });
    noProgress++;
    write(OUT, bestSrc);   // the file on disk always holds the best-known version
    console.log(`iter ${iteration}: ${bestResult.survival_rate} -> ${result.survival_rate}  REJECTED  (${approach})`);
    traj.log('rejected', { iteration, hash, approach, why: 'no-improvement',
      survival_rate: result.survival_rate, left });
  }
}

if (pct(bestResult) >= 100) stopReason = 'survival-100%';

write(OUT, bestSrc);
write('results/agent-memory.json', JSON.stringify(memory, null, 2));

const seconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
write('results/agent-run.json', JSON.stringify({
  agent: 'advanced', model: MODEL, effort: EFFORT, component: COMPONENT, out: OUT,
  iterations: iteration, model_calls: calls, stop_reason: stopReason, seconds,
  usage: usageTotal, dead_patches: memory.length,
  survival_rate: bestResult.survival_rate, pass: bestResult.pass, total: bestResult.total,
  fails: bestResult.fails, trajectory: traj.file,
}, null, 2));

traj.log('done', { stop_reason: stopReason, survival_rate: bestResult.survival_rate,
  iterations: iteration, model_calls: calls, dead_patches: memory.length });

console.log(`\nstopped: ${stopReason}`);
console.log(`final:   ${bestResult.survival_rate}  ${bestResult.pass}/${bestResult.total}`);
console.log(`cost:    ${calls} model calls · ${usageTotal.input_tokens} in / ${usageTotal.output_tokens} out · $${usageTotal.cost_usd.toFixed(4)} · ${seconds}s`);
console.log(`wrote    ${OUT}`);
