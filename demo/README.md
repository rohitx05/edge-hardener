# Demo page — Fragile / Baseline / Agent, side by side

One page. It **reads** the three card files that already exist and renders them against the
hardest cases in `results/cases.json`. It writes nothing, calls no model, and adds no
dependencies.

## Run it

From the repo root:

```bash
node demo/serve.mjs --open
```

That opens <http://127.0.0.1:4173/demo/>. Without `--open` it prints the URL instead. Set
`PORT=4174` if 4173 is busy. `/` and `/demo/` both serve this page.

A local server is required because Chromium refuses to `import` a `file://` ES module from a
`file://` page — the same reason `eval/harness.mjs` serves the component over loopback.
`demo/serve.mjs` mirrors that loader, including the 1×1 placeholder PNG for image paths with
no file on disk, so a case whose props say `image: "ok.jpg"` is not scored on a 404 the
harness would never have shown it.

## What's on it

Top to bottom: the headline, then the **scored battery** strip — survival, pairs and line
count for each version — then the coverage line, then the case grid with the width tabs and
a live tally.

| Column | File |
| --- | --- |
| Fragile | `corpus/restaurant-card.mjs` |
| Baseline | `results/baseline-card.mjs` (Haiku 4.5, one-shot) |
| Agent | `results/agent-card.mjs` (Haiku 4.5, verify-fix loop) |

Eight rows, covering every failure family the harness reports: `longName`, `unbrokenName`,
`rtlName`, `emojiName`, `stacked-nightmare`, `stacked-everything`, plus `noRating` and
`manyCuisine` — the two where the one-shot baseline genuinely recovers, so the middle column
is not just a second broken card.

The width tabs run the same four viewports as the harness (320 / 360 / 768 / 1280) and the
host container is `min(viewport, 420)px`, again matching the harness. It opens at **320px**,
where the stacked cases break hardest. The tally beside the tabs is the live count for the
width you are looking at; the strip at the top is the full scored battery and does not move.

The dashed crimson line marks the container's right edge, labelled with the current host
width. That is the line content is not allowed to cross, and you can watch the fragile card
cross it. Red outlines are measured on the DOM the page just built, never hardcoded; a clean
render gets a teal check.

## Where the numbers come from

Nothing is typed into the HTML. The strip is read at load time out of
`results/comparison-haiku.json`. The coverage line is derived the same way, so the 320px
default can't be misread as mobile-only: viewport names come from the committed fails (which
are `case:viewport:reason`, and the floor fails every pair, so its list names all four), the
case count is `pairs ÷ viewports`, and the pixel widths are parsed out of `eval/harness.mjs`
— the source of record for them. If that array's shape ever changes, the line names the
viewports without widths rather than guessing.

## Are the verdicts trustworthy?

They are recomputed in the page using the same three checks as `eval/harness.mjs`, in the
same order — crash → console-error → overflow → content presence — against an unstyled host,
so the geometry is comparable. Verified against `results/comparison-haiku.json`: at all four
widths the verdicts agree with the committed harness results, case for case and reason for
reason.

| Width | Fragile | Baseline | Agent |
| --- | --- | --- | --- |
| 320 (`mobile-sm`) | 0/8 | 2/8 | 8/8 |
| 360 / 768 / 1280 | 0/8 | 3/8 | 8/8 |

(Baseline picks up `rtlName` above 320px, which is exactly what
`results/comparison-haiku.json` records: its only `rtlName` failure is at `mobile-sm`.)

The page is a demo, not the oracle. The scored numbers of record are the ones in
`results/*.json`.

## Two things this demo changes about how the cards look

Both are disclosed in the page's own provenance footer. Neither changes what is measured —
re-verified after each.

### `demo/ok.jpg`

The cases set `image: "ok.jpg"`, and the harness serves a 1×1 transparent pixel for it
because it only cares about geometry. This demo ships an actual photograph at that path so
the cards look like something a team would ship rather than three grey boxes. All three cards
clamp the image to an 80×80 box, so it changes how the cards look and not what is measured.
**No card is ever shown a photograph for a case whose data says `image: null`.**

### The `image: null` empty state

Where `results/cases.json` says `image: null`, the three cards do three different things: the
fragile card points an `<img>` at `null` and gets a 404 glyph, the Baseline card builds a div
that reads "No image", and the hardened card points an `<img>` at an unlabelled grey SVG.
Side by side, the hardened card's unlabelled block reads as content that got lost rather than
an empty state someone designed.

The page swaps the hardened card's placeholder graphic for one labelled "No image", matching
the Baseline's treatment, and adds a short caption saying so. The swap happens **inside the
80×80 `<img>` the card itself sized**, so no geometry moves. It fires only when the case data
says `image: null`, and only on a `src` the card made a `data:` URI — a real image, and the
fragile card's broken `src`, are never touched. `results/agent-card.mjs` is unchanged on disk.
