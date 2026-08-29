// Hardened, framework-free component.
// export render(props) -> HTMLElement
//
// Robustness contract:
//   - Never throws, regardless of props shape (including null/undefined props entirely).
//   - Nothing overflows its container at 360 / 768 / 1280 px.
//   - Every meaningful value stays visible. Values that are visually truncated
//     (CSS line-clamp / ellipsis) always carry the full text in `title` + `aria-label`.
//   - Never uses display:none, visibility:hidden, opacity:0, or clip/clip-path to hide content.
//   - Falsy-but-real values ("₹0", 0, "0", false, "") are preserved; only null/undefined/NaN
//     and whitespace-only strings are treated as absent.

/* ---------------------------------------------------------------------------
 * Value normalization helpers
 * ------------------------------------------------------------------------ */

/** True only for genuinely absent values. 0, "", false, "₹0" are NOT absent. */
function isNil(v) {
  return v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));
}

/**
 * Coerce any value to a display string without throwing.
 * Objects with hostile toString/Symbol.toPrimitive are caught and skipped.
 */
function toText(v) {
  if (isNil(v)) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'symbol') {
    try { return v.description ? String(v.description) : ''; } catch { return ''; }
  }
  if (typeof v === 'function') return '';
  try {
    const s = String(v);
    // Avoid useless "[object Object]" noise.
    return s === '[object Object]' ? '' : s;
  } catch {
    return '';
  }
}

/** Strip control chars (except newline/tab) that can break layout or inject weirdness. */
function sanitize(s) {
  if (!s) return '';
  // Normalize newlines/tabs to spaces, drop other C0/C1 controls and zero-width junk.
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) { out += ' '; continue; }
    if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) continue;
    if (cp === 0x200b || cp === 0xfeff) continue; // zero-width space / BOM
    out += ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Normalized display string, or '' when the value is absent/blank. */
function text(v) {
  return sanitize(toText(v));
}

/** Hard cap on characters actually inserted into the DOM (full value goes to title). */
const MAX_CHARS = 400;

/** Array-code-point-safe truncation so we never split a surrogate pair or emoji. */
function capChars(s, max = MAX_CHARS) {
  if (!s) return '';
  const cps = Array.from(s);
  if (cps.length <= max) return s;
  return cps.slice(0, max).join('') + '…';
}

/** Coerce anything into a clean array of non-empty display strings. */
function toList(v) {
  if (isNil(v)) return [];
  let raw;
  if (Array.isArray(v)) {
    raw = v;
  } else if (typeof v === 'string') {
    raw = v.split(/[,\u2022|/]/);
  } else if (typeof v !== 'object' && typeof v !== 'function') {
    raw = [v];
  } else if (typeof v[Symbol.iterator] === 'function') {
    try { raw = Array.from(v); } catch { raw = []; }
  } else {
    raw = [v];
  }
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const t = text(item);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 24) break; // sanity bound on absurd arrays
  }
  return out;
}

/** Finite number or null. Accepts numeric strings. */
function toNumber(v) {
  if (isNil(v) || v === '' || typeof v === 'boolean') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Price may legitimately be "₹0", 0, "0", "Free", "$$" etc.
 * Only null/undefined/blank means unknown.
 */
function formatPrice(v) {
  if (isNil(v)) return null;
  if (typeof v === 'number') {
    return Number.isFinite(v) ? '₹' + v.toLocaleString('en-IN') : null;
  }
  const t = text(v);
  return t === '' ? null : t;
}

/** Rating: 0 is a real rating; null/garbage is not. Clamped to a sane band. */
function formatRating(v) {
  const n = toNumber(v);
  if (n === null) return null;
  const clamped = Math.min(Math.max(n, 0), 5);
  return clamped.toFixed(1);
}

/** Counts: 0 must render as "0", not vanish. */
function formatCount(v) {
  const n = toNumber(v);
  if (n === null) return null;
  const i = Math.max(0, Math.trunc(n));
  return i.toLocaleString('en-IN');
}

/** Best-effort safe image URL. Rejects non-http(s)/data/blob and javascript: URLs. */
function safeImageSrc(v) {
  const t = text(typeof v === 'object' && v && !Array.isArray(v)
    ? (v.src ?? v.url ?? v.href ?? '')
    : v);
  if (!t) return null;
  const lowered = t.trim().toLowerCase();
  if (/^(javascript|vbscript|file):/.test(lowered)) return null;
  if (/^(https?:|data:image\/|blob:|\/\/|\/|\.\/|\.\.\/)/.test(lowered)) return t.trim();
  // Bare relative path like "img/a.png" is fine; anything with a foreign scheme is not.
  if (/^[a-z][a-z0-9+.-]*:/.test(lowered)) return null;
  return t.trim();
}

/** Deterministic initials for the image fallback tile. */
function initialsOf(name) {
  const parts = (name || '').split(' ').filter(Boolean);
  if (!parts.length) return '🍽';
  const first = Array.from(parts[0])[0] || '';
  const second = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] || '') : '';
  const out = (first + second).toUpperCase();
  return out || '🍽';
}

/** Stable hue from a string, for the fallback tile background. */
function hueOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/* ---------------------------------------------------------------------------
 * DOM helpers
 * ------------------------------------------------------------------------ */

function el(tag, css, textContent) {
  const n = document.createElement(tag);
  if (css) n.style.cssText = css;
  if (textContent !== undefined && textContent !== null && textContent !== '') {
    n.textContent = textContent;
  }
  return n;
}

/**
 * Set visible text with a code-point cap, and always expose the untruncated
 * value via title + aria-label when anything was shortened (or may be
 * shortened later by CSS line-clamp / ellipsis).
 */
function setClampedText(node, full, { alwaysAnnotate = true } = {}) {
  const shown = capChars(full);
  node.textContent = shown;
  if (alwaysAnnotate || shown !== full) {
    node.title = full;
    node.setAttribute('aria-label', full);
  }
  return node;
}

/* Shared overflow-safety declarations. `min-width:0` is what actually lets a
   flex child shrink below its content width instead of blowing out the row. */
const SAFE_BOX = 'box-sizing:border-box;min-width:0;max-width:100%;';
const WRAP_TEXT =
  'overflow-wrap:anywhere;word-break:break-word;white-space:normal;hyphens:auto;';

/* ---------------------------------------------------------------------------
 * render
 * ------------------------------------------------------------------------ */

export function render(props) {
  const p = (props && typeof props === 'object') ? props : {};

  /* ---- normalize every field up front; nothing below may throw ---- */
  const name = text(p.name ?? p.title) || 'Unnamed restaurant';
  const cuisines = toList(p.cuisine ?? p.cuisines ?? p.tags);
  const price = formatPrice(p.price ?? p.priceRange);
  const rating = formatRating(p.rating);
  const reviewCount = formatCount(p.reviews ?? p.reviewCount ?? p.ratingCount);
  const author = text(p.author ?? p.reviewer ?? (p.author && p.author.name));
  const address = text(p.address ?? p.location ?? p.area);
  const imgSrc = safeImageSrc(p.image ?? p.photo ?? p.thumbnail);

  /* ---- root: wraps to a stacked layout on narrow viewports ---- */
  const root = el('div');
  root.className = 'rc-card';
  root.style.cssText =
    SAFE_BOX +
    'display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;padding:12px;' +
    'width:100%;max-width:100%;overflow:hidden;' +
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Color Emoji",sans-serif;' +
    'font-size:14px;line-height:1.4;color:#111;background:#fff;' +
    'border:1px solid #e3e3e3;border-radius:10px;' +
    'contain:layout;';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', name);

  /* ---- media: fixed square that never grows, never leaves a broken box ---- */
  const media = el('div');
  media.style.cssText =
    SAFE_BOX +
    'position:relative;flex:0 0 auto;width:80px;height:80px;' +
    'border-radius:8px;overflow:hidden;background:#f2f2f2;';

  const hue = hueOf(name);
  const fallback = el('div');
  fallback.setAttribute('aria-hidden', 'true');
  fallback.style.cssText =
    SAFE_BOX +
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    `background:hsl(${hue} 45% 90%);color:hsl(${hue} 45% 28%);` +
    'font-weight:700;font-size:24px;letter-spacing:0.5px;';
  fallback.textContent = initialsOf(name);
  media.appendChild(fallback);

  if (imgSrc) {
    const img = el('img');
    img.alt = name;
    img.loading = 'lazy';
    img.decoding = 'async';
    // Sits above the fallback tile; on error we simply remove it, revealing the tile.
    img.style.cssText =
      SAFE_BOX +
      'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
      'background:transparent;';
    img.addEventListener('error', () => {
      if (img.parentNode) img.parentNode.removeChild(img);
    }, { once: true });
    try { img.src = imgSrc; } catch { /* ignore hostile src */ }
    media.appendChild(img);
  }
  root.appendChild(media);

  /* ---- body: the shrinkable column. min-width:0 is load-bearing. ---- */
  const body = el('div');
  body.style.cssText =
    SAFE_BOX +
    'flex:1 1 200px;min-width:0;display:flex;flex-direction:column;gap:4px;';

  /* Name — wraps, clamps to 2 lines, full value always in title/aria-label.
     Uses -webkit-line-clamp (a visual clamp, not display:none / clipping of
     hidden content) and always advertises the complete string. */
  const h = el('h3');
  h.style.cssText =
    SAFE_BOX + WRAP_TEXT +
    'margin:0;font-size:16px;line-height:1.3;font-weight:650;' +
    'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;' +
    'max-height:2.6em;overflow:hidden;';
  setClampedText(h, name);
  body.appendChild(h);

  /* Cuisines — every item stays visible as a wrapping chip row.
     If the list is long we show the first N and a "+K more" chip whose title
     lists the remainder, and the row container also carries the full list. */
  if (cuisines.length) {
    const MAX_CHIPS = 6;
    const shown = cuisines.slice(0, MAX_CHIPS);
    const hidden = cuisines.slice(MAX_CHIPS);
    const fullList = cuisines.join(' · ');

    const row = el('div');
    row.style.cssText =
      SAFE_BOX +
      'display:flex;flex-wrap:wrap;gap:4px;align-items:center;';
    row.title = fullList;
    row.setAttribute('aria-label', 'Cuisines: ' + fullList);

    const chipCss =
      SAFE_BOX + WRAP_TEXT +
      'display:inline-block;padding:2px 8px;border-radius:999px;' +
      'background:#f3f4f6;color:#374151;font-size:12px;line-height:1.5;' +
      'max-width:100%;';

    for (const c of shown) {
      const chip = el('span');
      chip.style.cssText = chipCss;
      setClampedText(chip, c, { alwaysAnnotate: false });
      chip.title = c;
      row.appendChild(chip);
    }
    if (hidden.length) {
      const more = el('span');
      more.style.cssText = chipCss + 'background:#e5e7eb;font-weight:600;';
      more.textContent = '+' + hidden.length + ' more';
      const rest = hidden.join(' · ');
      more.title = rest;
      more.setAttribute('aria-label', hidden.length + ' more cuisines: ' + rest);
      row.appendChild(more);
    }
    body.appendChild(row);
  }

  /* Meta line — price / rating / reviews / author. Every present value renders,
     including "₹0", 0.0 stars and 0 reviews. Absent values are simply omitted
     rather than printing "undefined". Wraps instead of overflowing. */
  const meta = el('div');
  meta.style.cssText =
    SAFE_BOX + WRAP_TEXT +
    'display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;' +
    'font-size:13px;color:#4b5563;';

  const pieces = [];

  if (price !== null) {
    const n = el('span');
    n.style.cssText = SAFE_BOX + WRAP_TEXT + 'font-weight:600;color:#111;';
    setClampedText(n, price, { alwaysAnnotate: false });
    n.title = price;
    pieces.push(n);
  }

  if (rating !== null) {
    const n = el('span');
    n.style.cssText = SAFE_BOX + WRAP_TEXT + 'white-space:nowrap;';
    n.textContent = '★ ' + rating;
    n.setAttribute('aria-label', rating + ' out of 5 stars');
    n.title = rating + ' / 5';
    pieces.push(n);
  }

  if (reviewCount !== null) {
    const n = el('span');
    n.style.cssText = SAFE_BOX + WRAP_TEXT;
    n.textContent = '(' + reviewCount + ')';
    n.setAttribute('aria-label', reviewCount + ' reviews');
    n.title = reviewCount + ' reviews';
    pieces.push(n);
  }

  if (author) {
    const n = el('span');
    n.style.cssText = SAFE_BOX + WRAP_TEXT + 'min-width:0;';
    setClampedText(n, 'by ' + author, { alwaysAnnotate: false });
    n.title = 'Reviewed by ' + author;
    n.setAttribute('aria-label', 'Reviewed by ' + author);
    pieces.push(n);
  }

  pieces.forEach((node, i) => {
    if (i > 0) {
      const sep = el('span', 'flex:0 0 auto;color:#9ca3af;', '·');
      sep.setAttribute('aria-hidden', 'true');
      meta.appendChild(sep);
    }
    meta.appendChild(node);
  });

  if (!pieces.length) {
    const none = el('span', SAFE_BOX + WRAP_TEXT + 'color:#6b7280;font-style:italic;',
      'Details unavailable');
    meta.appendChild(none);
  }
  body.appendChild(meta);

  /* Address — wraps to at most 2 visual lines, full value in title. */
  if (address) {
    const a = el('div');
    a.style.cssText =
      SAFE_BOX + WRAP_TEXT +
      'font-size:12px;color:#6b7280;' +
      'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;' +
      'max-height:3em;overflow:hidden;';
    setClampedText(a, address);
    body.appendChild(a);
  }

  root.appendChild(body);
  return root;
}

export default render;
