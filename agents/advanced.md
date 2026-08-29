# Advanced agent instruction (verify-fix loop)

Goal: maximize SURVIVAL RATE on the adversarial battery without hiding content.

Loop:
1. Read the component + the adversarial case list.
2. Run `node eval/harness.mjs` and read the FAILING assertion for each case.
3. Patch the component to fix the specific failure. Keep the diff minimal and mergeable.
4. Re-run the harness. If a case still fails, do not repeat a patch you already tried
   (consult your dead-patch memory below).
5. Stop when survival = 100% or no further progress across 2 iterations.

HARD RULES (these encode intent, not the proxy metric):
- NEVER use display:none, visibility:hidden, opacity:0, or clip content to pass an
  overflow check. Truncation is allowed ONLY if the full value is exposed via title/aria-label.
- Every value in a case mustContain list must stay visible and reachable.
- Prefer wrapping, ellipsis-with-title, min-width:0, and empty-state fallbacks over hiding.

Dead-patch memory (append what failed so you do not loop):
- ...
