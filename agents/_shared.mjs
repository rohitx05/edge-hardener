// Shared plumbing for both agents. The point of this file is that BASELINE and ADVANCED
// import the same MODEL and the same call path — the only difference between them is the
// harness feedback loop, which is what the Measured Improvement number is supposed to isolate.

import { execFile, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// PRIMARY comparison runs on Haiku 4.5. Opus 5 one-shot solved the whole adversarial battery
// blind — 100/100 with no feedback — so on a frontier model the verify-fix loop has no
// survival headroom to demonstrate and baseline/agent tie at 100%. A fallible model is what
// makes the loop's contribution measurable at all.
//
// The Opus 5 run is kept as a SECONDARY no-damage check (results/comparison-opus.json):
// both sides still reach 100%, and the separation there is merge quality, not survival.
// Override for that run with:  MODEL=claude-opus-5 npm run baseline
export const MODEL = process.env.MODEL || 'claude-haiku-4-5';
export const EFFORT = process.env.EFFORT || 'high';
export const MAX_TOKENS = 16000;

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const rel = (...p) => join(ROOT, ...p);

// Model access goes through the locally installed Claude Code CLI in headless mode, which
// uses the operator's existing logged-in session. No API key is read, stored, or passed —
// there is deliberately no ANTHROPIC_API_KEY code path in this repo.
//
// Tools are switched off so both agents are pure text-in/text-out generators: the baseline
// must be one-shot with no tool access (agents/baseline.md), and the advanced agent's loop
// is driven by THIS script, not by the CLI's own agentic loop. Only run_advanced.mjs may
// invoke the oracle, and it does so itself via runHarness().
const TOOLS_OFF = [
  'Bash', 'PowerShell', 'Read', 'Write', 'Edit', 'NotebookEdit', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'Task', 'Agent', 'TodoWrite', 'Skill', 'SlashCommand',
].join(',');

function resolveCli() {
  if (process.env.CLAUDE_CLI && existsSync(process.env.CLAUDE_CLI)) return process.env.CLAUDE_CLI;
  const home = process.env.APPDATA || process.env.HOME || '';
  const candidates = [
    join(home, 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe'),
    join(home, '.npm-global/lib/node_modules/@anthropic-ai/claude-code/bin/claude'),
    '/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude',
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return 'claude'; // fall back to PATH resolution
}
const CLI = resolveCli();

/** One model call through the logged-in Claude Code session. Returns { text, usage }. */
export async function callModel({ system, user }) {
  const args = [
    '-p',
    '--model', MODEL,
    '--effort', EFFORT,
    '--system-prompt', system,
    '--output-format', 'json',
    '--disallowedTools', TOOLS_OFF,
    '--disable-slash-commands',
    '--no-session-persistence',
    '--restricted',
  ];

  const raw = await new Promise((resolve, reject) => {
    const cp = spawn(CLI, args, { cwd: ROOT, shell: CLI === 'claude' && process.platform === 'win32' });
    let out = '', err = '';
    cp.stdout.on('data', (d) => { out += d; });
    cp.stderr.on('data', (d) => { err += d; });
    cp.on('error', (e) => reject(new Error(
      `could not start the Claude Code CLI (${CLI}): ${e.message}\n` +
      `The agents run on your logged-in session; make sure \`claude\` is installed and logged in.`)));
    cp.on('close', (code) => {
      if (code !== 0 && !out) return reject(new Error(`claude exited ${code}: ${err.slice(0, 500)}`));
      resolve(out);
    });
    cp.stdin.end(user);
  });

  let j;
  try { j = JSON.parse(raw); }
  catch { throw new Error(`claude returned non-JSON output:\n${raw.slice(0, 800)}`); }

  if (j.is_error || j.subtype !== 'success') {
    throw new Error(`claude call failed (${j.subtype}): ${j.api_error_status || j.result || 'unknown'}`);
  }
  const u = j.usage || {};
  return {
    text: j.result || '',
    usage: {
      input_tokens: u.input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
      cost_usd: j.total_cost_usd ?? 0,
    },
    stop_reason: j.stop_reason,
  };
}

/** Pull the component source out of a model reply (fenced block, or the raw reply). */
export function extractCode(text) {
  const fenced = [...text.matchAll(/```(?:js|javascript|mjs)?\s*\n([\s\S]*?)```/g)];
  const body = fenced.length ? fenced[fenced.length - 1][1] : text;
  return body.trim() + '\n';
}

/**
 * Run the oracle. Returns the parsed harness JSON.
 * The agent never scores itself — every number comes from eval/harness.mjs.
 */
export function runHarness(componentPath, casesPath = 'results/cases.json') {
  return new Promise((resolve, reject) => {
    execFile('node', [rel('eval/harness.mjs'), '--component', componentPath, '--cases', rel(casesPath)],
      { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && !stdout) return reject(new Error(`harness failed: ${stderr || err.message}`));
        try { resolve(JSON.parse(stdout)); }
        catch { reject(new Error(`harness produced non-JSON output:\n${stdout}\n${stderr}`)); }
      });
  });
}

export const pct = (r) => Number(String(r.survival_rate).replace('%', ''));

/**
 * Static guard for the HARD RULES. The harness already fails hidden content, but catching a
 * cheat here means we can reject the patch WITHOUT spending a harness run, and record it as a
 * dead patch with a reason the model can act on.
 */
/**
 * Blank out comments while preserving string and template literals — the violations we care
 * about live INSIDE strings (`cssText = 'display:none'`), whereas a component that documents
 * "never uses display:none" in a header comment is compliant, not cheating. Scanning raw
 * source flagged exactly that and would have burned an iteration on a clean patch.
 */
export function stripComments(src) {
  let out = '', i = 0, q = null, inLine = false, inBlock = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += c; } else out += ' '; i++; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; out += '  '; i += 2; } else { out += c === '\n' ? c : ' '; i++; } continue; }
    if (q) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '/' && n === '/') { inLine = true; i += 2; out += '  '; continue; }
    if (c === '/' && n === '*') { inBlock = true; i += 2; out += '  '; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

export function hardRuleViolations(rawSrc) {
  const src = stripComments(rawSrc);
  const v = [];
  // Each rule matches BOTH the cssText form (`display: none`) and the DOM-property form
  // (`el.style.display = 'none'`), which is why the separator class is [:=].
  if (/display\s*[:=]\s*['"`]?\s*none/i.test(src)) v.push('uses display:none');
  if (/visibility\s*[:=]\s*['"`]?\s*hidden/i.test(src)) v.push('uses visibility:hidden');
  if (/opacity\s*[:=]\s*['"`]?\s*0(?![.\d])/i.test(src)) v.push('uses opacity:0');
  if (/\.hidden\s*=\s*true/.test(src)) v.push('sets .hidden = true');
  if (/(font-size|fontSize)\s*[:=]\s*['"`]?\s*0(?![.\d])/i.test(src))
    v.push('uses font-size:0 to collapse content');
  if (/(clip-path|clipPath)\s*[:=]/i.test(src) || /\bclip\s*[:=]\s*['"`]?\s*rect/i.test(src))
    v.push('uses clipping to hide overflow');
  // Ellipsis truncation is allowed ONLY when the full value is exposed. If the file truncates
  // but never sets title/aria-label anywhere, that is a rule violation on its face.
  const truncates = /text-overflow:\s*ellipsis/i.test(src) || /\.slice\(|\.substring\(|\.substr\(/.test(src);
  const exposesFull = /title|aria-label/i.test(src);
  if (truncates && !exposesFull) v.push('truncates without exposing the full value via title/aria-label');
  return v;
}

export const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

/**
 * The data contract: which props the component is expected to render. Both agents get this,
 * identically. Without it the baseline is scored on a requirement it cannot infer — the
 * corpus component never touches `address`, so a one-shot rewrite has no reason to render it,
 * and every case fails content-lost for a reason that has nothing to do with hardening.
 * agents/baseline.md is explicit that the baseline must not be crippled; the loop's advantage
 * has to be iteration, not a withheld spec.
 */
export function propContract(cases) {
  const keys = new Set();
  for (const c of cases) for (const k of Object.keys(c.props || {})) keys.add(k);
  return [...keys].sort();
}

/** Live trajectory log — one JSON object per line, appended as it happens. */
export function trajectory(name) {
  mkdirSync(rel('trajectories'), { recursive: true });
  const file = rel('trajectories', `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
  return {
    file,
    log(event, data) {
      appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + '\n');
    },
  };
}

export const read = (p) => readFileSync(rel(p), 'utf8');
export function write(p, s) {
  mkdirSync(dirname(rel(p)), { recursive: true });
  writeFileSync(rel(p), s);
}
