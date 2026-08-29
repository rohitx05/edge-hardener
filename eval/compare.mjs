// Scores every variant that exists with the SAME oracle and the SAME cases, and writes the
// comparison to results/comparison.json so every number in the writeup points at a file.
//
// Run: node eval/compare.mjs

import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CASES = 'results/cases.json';

const VARIANTS = [
  { key: 'fragile_floor', label: 'Fragile floor (unpatched)', component: 'corpus/restaurant-card.mjs' },
  { key: 'baseline', label: 'Baseline (one-shot)', component: 'results/baseline-card.mjs' },
  { key: 'agent', label: 'Advanced (verify-fix loop)', component: 'results/agent-card.mjs' },
];

const score = (component) => JSON.parse(execFileSync('node',
  [join(ROOT, 'eval/harness.mjs'), '--component', component, '--cases', join(ROOT, CASES)],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));

const runMeta = (p) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), 'utf8')) : null);

// Survival rate is the primary metric, but it saturates: a component can hit 100% and still
// be 10x the size of the original, which the End-to-End Quality bar explicitly rejects
// ("a clean diff a frontend dev would merge, not agent-scarred code"). Line count is tracked
// alongside so the table shows both halves of "good".
const lineCount = (p) => readFileSync(join(ROOT, p), 'utf8').trimEnd().split('\n').length;
const corpusLines = lineCount('corpus/restaurant-card.mjs');

const out = { cases: CASES, generated_at: new Date().toISOString(), corpus_lines: corpusLines, variants: {} };
const rows = [];

for (const v of VARIANTS) {
  if (!existsSync(join(ROOT, v.component))) {
    rows.push([v.label, '—', 'not built', '—']);
    continue;
  }
  const r = score(v.component);
  const lines = lineCount(v.component);
  out.variants[v.key] = {
    label: v.label, component: v.component,
    survival_rate: r.survival_rate, pass: r.pass, total: r.total,
    lines, lines_vs_corpus: lines - corpusLines,
    fails: r.fails.map((f) => `${f.case}:${f.viewport}:${f.reason}`),
  };
  const grew = lines - corpusLines;
  rows.push([v.label, r.survival_rate, `${r.pass}/${r.total}`,
    `${lines}${grew ? ` (${grew > 0 ? '+' : ''}${grew})` : ''}`]);
}

const baseline = runMeta('results/baseline-run.json');
const agent = runMeta('results/agent-run.json');
if (baseline) out.baseline_run = { model: baseline.model, calls: baseline.calls, usage: baseline.usage, seconds: baseline.seconds };
if (agent) out.agent_run = { model: agent.model, iterations: agent.iterations, model_calls: agent.model_calls,
  stop_reason: agent.stop_reason, dead_patches: agent.dead_patches, usage: agent.usage, seconds: agent.seconds };

const f = out.variants.fragile_floor, b = out.variants.baseline, a = out.variants.agent;
const num = (x) => (x ? Number(x.survival_rate.replace('%', '')) : null);
if (f && a) out.delta_floor_to_agent = `${(num(a) - num(f)).toFixed(1)} pts`;
if (b && a) out.delta_baseline_to_agent = `${(num(a) - num(b)).toFixed(1)} pts`;

writeFileSync(join(ROOT, 'results/comparison.json'), JSON.stringify(out, null, 2));

const w = Math.max(...rows.map((r) => r[0].length));
console.log('\n' + 'Variant'.padEnd(w) + '  Survival   Cases   Lines');
console.log('-'.repeat(w + 32));
for (const [label, rate, cases, lines] of rows)
  console.log(label.padEnd(w) + '  ' + String(rate).padEnd(9) + '  ' + String(cases).padEnd(6) + '  ' + lines);
console.log(`\n(corpus is ${corpusLines} lines; "Lines" shows the hardened file and its growth)`);
if (out.delta_baseline_to_agent) console.log(`\nbaseline -> agent: ${out.delta_baseline_to_agent}`);
if (out.delta_floor_to_agent) console.log(`floor    -> agent: ${out.delta_floor_to_agent}`);
console.log('\nwrote results/comparison.json');
