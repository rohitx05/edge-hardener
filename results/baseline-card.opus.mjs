// Hardened restaurant card.
// export render(props) -> HTMLElement  (framework-free, no global CSS, no innerHTML)
//
// Contract: props = { address, author, cuisine, image, name, price, rating, review, reviews, tags }
// Guarantees:
//   * never throws (bad/absent/hostile props all degrade to visible empty states)
//   * nothing overflows at 360 / 768 / 1280 (everything wraps; flex children get min-width:0)
//   * no display:none / visibility:hidden / opacity:0 / text clipping — full values always rendered
//   * every prop that has a value is rendered; absent props get an explicit empty state

const FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,' +
  '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol",sans-serif';

// Every element gets these: border-box sizing, shrinkable in flex, never wider than parent.
const BASE = 'box-sizing:border-box;min-width:0;max-width:100%;';
// Long unbroken tokens (URLs, 400-char names, CJK, emoji runs) must break rather than overflow.
const WRAP = 'overflow-wrap:anywhere;word-break:break-word;white-space:normal;';

const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';

/* ------------------------------------------------------------------ helpers */

function make(tag, css, text) {
  const node = document.createElement(tag);
  node.style.cssText = BASE + (css || '');
  if (text != null && text !== '') node.textContent = String(text);
  return node;
}

// Safe property read: props may be null, a primitive, a Proxy with throwing getters, etc.
function pick(source, key) {
  try {
    if (source == null) return undefined;
    return source[key];
  } catch (_) {
    return undefined;
  }
}

// Coerce anything to display text without ever throwing. Preserves falsy-but-real
// values like 0 and false; only null/undefined/NaN/whitespace become "".
function toText(value, depth) {
  const d = depth || 0;
  if (value == null) return '';
  const t = typeof value;
  if (t === 'string') return value.trim();
  if (t === 'number') return Number.isFinite(value) ? String(value) : '';
  if (t === 'bigint') return String(value);
  if (t === 'boolean') return String(value);
  if (t === 'symbol' || t === 'function') return '';
  if (d > 2) return '';
  if (Array.isArray(value)) {
    return value.map((v) => toText(v, d + 1)).filter(Boolean).join(', ');
  }
  if (t === 'object') {
    if (value instanceof Date) {
      const ms = value.getTime();
      return Number.isFinite(ms) ? value.toLocaleDateString() : '';
    }
    // Common shapes: { name }, { label }, { title }, { text }, { value }
    for (const k of ['name', 'label', 'title', 'text', 'value']) {
      const inner = toText(pick(value, k), d + 1);
      if (inner) return inner;
    }
    try {
      const s = JSON.stringify(value);
      if (s && s !== '{}' && s !== '[]') return s.slice(0, 400);
    } catch (_) {
      /* circular / getters that throw */
    }
    return '';
  }
  return '';
}

// Normalize any prop into a flat list of non-empty display strings.
// Keeps duplicates and keeps every item — nothing is capped or dropped.
function toList(value) {
  if (value == null) return [];
  let raw;
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'object' && typeof value[Symbol.iterator] === 'function' &&
           typeof value !== 'string') {
    try { raw = Array.from(value); } catch (_) { raw = [value]; }
  } else raw = [value];

  const out = [];
  for (const item of raw) {
    const s = toText(item);
    if (!s) continue;
    // A single comma-joined string ("Thai, Vietnamese") becomes separate chips.
    if (raw.length === 1 && typeof item === 'string' && s.includes(',')) {
      for (const part of s.split(',')) {
        const p = part.trim();
        if (p) out.push(p);
      }
    } else {
      out.push(s);
    }
  }
  return out;
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const cleaned = value.replace(/[\s,\u00a0]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatCount(n) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch (_) {
    return String(n);
  }
}

// Block javascript:/vbscript:/non-image data: URLs; allow http(s), data:image, blob, relative.
function safeUrl(value) {
  const s = toText(value);
  if (!s) return '';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s.replace(/[\u0000-\u0020]/g, ''));
  if (!scheme) return s; // relative path
  const proto = scheme[1].toLowerCase();
  if (proto === 'http' || proto === 'https' || proto === 'blob') return s;
  if (proto === 'data') return /^data:image\//i.test(s.trim()) ? s : '';
  return '';
}

function firstGrapheme(text) {
  const s = toText(text);
  if (!s) return '';
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      for (const g of seg.segment(s)) return g.segment;
    }
  } catch (_) {
    /* fall through */
  }
  return Array.from(s)[0] || '';
}

/* ------------------------------------------------------------- micro-pieces */

function label(text) {
  return make(
    'div',
    'font:600 11px/1.4 ' + FONT + ';letter-spacing:.06em;text-transform:uppercase;' +
      'color:' + MUTED + ';margin:0 0 4px;' + WRAP,
    text
  );
}

function emptyNote(text) {
  const n = make(
    'span',
    'font:italic 13px/1.5 ' + FONT + ';color:' + MUTED + ';' + WRAP,
    text
  );
  n.setAttribute('data-empty', 'true');
  return n;
}

function chip(text, tone) {
  const bg = tone === 'tag' ? '#f1f5f9' : '#eef2ff';
  const fg = tone === 'tag' ? '#334155' : '#3730a3';
  const c = make(
    'span',
    'display:inline-block;padding:3px 9px;border-radius:999px;background:' + bg + ';' +
      'color:' + fg + ';font:500 12px/1.45 ' + FONT + ';' + WRAP,
    text
  );
  c.title = text;
  return c;
}

function chipRow(items, tone) {
  const row = make('div', 'display:flex;flex-wrap:wrap;gap:6px;width:100%;');
  for (const item of items) row.appendChild(chip(item, tone));
  return row;
}

function section(titleText, contentNode) {
  const wrap = make('section', 'width:100%;margin:10px 0 0;');
  wrap.appendChild(label(titleText));
  wrap.appendChild(contentNode);
  return wrap;
}

/* ------------------------------------------------------------------- pieces */

function buildMedia(imageProp, nameText) {
  const box = make(
    'div',
    'flex:0 0 auto;width:84px;height:84px;border-radius:10px;background:' +
      'linear-gradient(135deg,#fde68a,#fca5a5);border:1px solid ' + LINE + ';' +
      'position:relative;display:flex;align-items:center;justify-content:center;'
  );

  const src = safeUrl(imageProp);
  const initial = firstGrapheme(nameText);

  const placeholder = make(
    'span',
    'font:600 26px/1 ' + FONT + ';color:#7c2d12;user-select:none;'
  );
  placeholder.textContent = initial || '🍽';
  placeholder.setAttribute('role', 'img');
  placeholder.setAttribute(
    'aria-label',
    src ? 'Image unavailable' : 'No photo provided'
  );
  box.appendChild(placeholder);

  if (src) {
    const img = make(
      'img',
      'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
        'border-radius:10px;display:block;'
    );
    img.alt = nameText ? nameText + ' photo' : 'Restaurant photo';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    // A broken URL removes the <img>, revealing the placeholder underneath.
    // (Removal, not hiding — no display:none anywhere.)
    img.addEventListener(
      'error',
      () => {
        try {
          if (img.parentNode) img.parentNode.removeChild(img);
        } catch (_) {
          /* no-op */
        }
      },
      { once: true }
    );
    img.src = src;
    box.appendChild(img);
  }

  return box;
}

function buildName(nameProp) {
  const text = toText(nameProp);
  const h = make(
    'h3',
    'margin:0;font:700 17px/1.3 ' + FONT + ';color:' + INK + ';width:100%;' + WRAP
  );
  if (text) {
    h.textContent = text;
    h.title = text; // full value always available even though it is never truncated
  } else {
    h.appendChild(emptyNote('Unnamed restaurant'));
    h.setAttribute('aria-label', 'Unnamed restaurant');
  }
  return h;
}

function buildRatingRow(ratingProp, reviewsProp) {
  const row = make(
    'div',
    'display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;width:100%;margin:4px 0 0;'
  );

  // ---- rating
  const ratingNum = toNumber(ratingProp);
  const ratingRaw = toText(ratingProp);
  const rating = make(
    'span',
    'display:inline-flex;align-items:baseline;gap:4px;font:600 14px/1.5 ' + FONT +
      ';color:' + INK + ';' + WRAP
  );
  if (ratingNum !== null) {
    const shown = ratingNum.toFixed(1);
    rating.appendChild(make('span', 'color:#f59e0b;', '★'));
    rating.appendChild(make('span', WRAP, shown));
    rating.setAttribute('aria-label', 'Rating ' + shown + ' out of 5');
    rating.title = 'Rating ' + shown;
  } else if (ratingRaw) {
    rating.appendChild(make('span', 'color:#f59e0b;', '★'));
    rating.appendChild(make('span', WRAP, ratingRaw));
    rating.title = 'Rating ' + ratingRaw;
  } else {
    rating.appendChild(emptyNote('Not rated yet'));
  }
  row.appendChild(rating);

  // ---- review count (0 is a real value and must stay visible)
  const countNum = toNumber(reviewsProp);
  const countList = Array.isArray(reviewsProp) ? reviewsProp.length : null;
  const n = countNum !== null ? countNum : countList;
  const countEl = make(
    'span',
    'font:400 13px/1.5 ' + FONT + ';color:' + MUTED + ';' + WRAP
  );
  if (n !== null) {
    const pretty = formatCount(n);
    countEl.textContent = pretty + (Math.abs(n) === 1 ? ' review' : ' reviews');
    countEl.title = countEl.textContent;
  } else {
    const raw = toText(reviewsProp);
    if (raw) {
      countEl.textContent = raw;
      countEl.title = raw;
    } else {
      countEl.appendChild(emptyNote('No reviews yet'));
    }
  }
  row.appendChild(countEl);

  return row;
}

function buildPrice(priceProp) {
  const text = toText(priceProp); // "₹0", "0", "Free", 0 -> all preserved
  const box = make(
    'span',
    'display:inline-block;padding:3px 9px;border-radius:8px;background:#ecfdf5;' +
      'color:#065f46;font:600 13px/1.45 ' + FONT + ';border:1px solid #a7f3d0;' + WRAP
  );
  if (text) {
    box.textContent = text;
    box.title = 'Price: ' + text;
  } else {
    box.style.cssText += 'background:#f8fafc;color:' + MUTED + ';border-color:' + LINE + ';';
    box.appendChild(emptyNote('Price N/A'));
  }
  return box;
}

function buildAddress(addressProp) {
  const text = toText(addressProp);
  const a = make(
    'address',
    'display:block;font:400 13px/1.5 ' + FONT + ';font-style:normal;color:' +
      MUTED + ';width:100%;margin:0;' + WRAP
  );
  if (text) {
    a.textContent = '📍 ' + text;
    a.title = text;
  } else {
    a.appendChild(emptyNote('Address not available'));
  }
  return a;
}

function buildReview(reviewProp, authorProp) {
  const text = toText(reviewProp);
  const author = toText(authorProp);
  if (!text && !author) return null;

  const fig = make(
    'figure',
    'margin:0;padding:8px 10px;border-left:3px solid ' + LINE + ';background:#fafafa;' +
      'border-radius:0 8px 8px 0;width:100%;'
  );

  const quote = make(
    'blockquote',
    'margin:0;font:400 13px/1.55 ' + FONT + ';color:' + INK + ';width:100%;' + WRAP
  );
  if (text) {
    quote.textContent = '“' + text + '”'; // rendered in full — wraps, never clipped
    quote.title = text;
  } else {
    quote.appendChild(emptyNote('No review text'));
  }
  fig.appendChild(quote);

  const cite = make(
    'figcaption',
    'margin:6px 0 0;font:500 12px/1.5 ' + FONT + ';color:' + MUTED + ';width:100%;' + WRAP
  );
  if (author) {
    cite.textContent = '— ' + author;
    cite.title = author;
  } else {
    cite.appendChild(emptyNote('— Anonymous'));
  }
  fig.appendChild(cite);

  return fig;
}

/* -------------------------------------------------------------------- shell */

function fallbackCard(nameGuess) {
  const card = make(
    'div',
    'display:block;padding:12px;border:1px solid ' + LINE + ';border-radius:12px;' +
      'background:#fff;font:400 14px/1.5 ' + FONT + ';color:' + MUTED + ';width:100%;' + WRAP
  );
  card.setAttribute('role', 'group');
  card.appendChild(
    make('strong', 'display:block;color:' + INK + ';' + WRAP, nameGuess || 'Restaurant')
  );
  card.appendChild(emptyNote('Details unavailable'));
  return card;
}

export function render(p) {
  let nameText = '';
  try {
    nameText = toText(pick(p, 'name'));

    const card = make(
      'article',
      'display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;padding:12px;' +
        'width:100%;border:1px solid ' + LINE + ';border-radius:12px;background:#fff;' +
        'color:' + INK + ';font-family:' + FONT + ';' + WRAP
    );
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', nameText || 'Restaurant card');

    card.appendChild(buildMedia(pick(p, 'image'), nameText));

    // flex:1 1 180px + min-width:0 => wraps under the image at 360px, sits beside it at 768/1280.
    const body = make('div', 'flex:1 1 180px;display:block;width:auto;');
    body.appendChild(buildName(pick(p, 'name')));
    body.appendChild(buildRatingRow(pick(p, 'rating'), pick(p, 'reviews')));

    const meta = make(
      'div',
      'display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%;margin:8px 0 0;'
    );
    meta.appendChild(buildPrice(pick(p, 'price')));
    body.appendChild(meta);

    const cuisines = toList(pick(p, 'cuisine'));
    body.appendChild(
      section(
        'Cuisine',
        cuisines.length ? chipRow(cuisines, 'cuisine') : emptyNote('Cuisine not listed')
      )
    );

    const tags = toList(pick(p, 'tags'));
    body.appendChild(
      section('Tags', tags.length ? chipRow(tags, 'tag') : emptyNote('No tags'))
    );

    body.appendChild(section('Address', buildAddress(pick(p, 'address'))));

    const review = buildReview(pick(p, 'review'), pick(p, 'author'));
    body.appendChild(
      section('Review', review || emptyNote('No reviews yet'))
    );

    card.appendChild(body);
    return card;
  } catch (_) {
    return fallbackCard(nameText);
  }
}

export default render;
