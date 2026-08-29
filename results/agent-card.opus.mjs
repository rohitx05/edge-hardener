// Hardened restaurant card. render(props) -> HTMLElement, framework-free.
// Rules applied: nothing is hidden or clipped; every present prop is rendered and wraps;
// null/absent props get an explicit empty state; 0 / "0" / "₹0" are real values, not falsy holes.

const has = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const list = (v) => (Array.isArray(v) ? v.filter(has).map(String) : has(v) ? [String(v)] : []);

// Anything that can hold user text must be allowed to break mid-"word": unbroken URLs,
// 90-char CamelCase names and emoji runs all have to fit the 320px host.
const WRAP = 'min-width:0;overflow-wrap:anywhere;word-break:break-word;';

function text(tag, value, css) {
  const el = document.createElement(tag);
  el.textContent = value;
  el.dir = 'auto'; // keeps RTL / bidi-mixed strings laid out inside the box
  el.style.cssText = WRAP + (css || '');
  return el;
}

function chipRow(values, css) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;' + WRAP + (css || '');
  values.forEach((v) => {
    row.appendChild(
      text('span', v, 'max-width:100%;padding:2px 8px;border-radius:10px;background:#f1f1f1;font-size:12px;line-height:1.4;')
    );
  });
  return row;
}

function media(src, name) {
  const box = document.createElement('div');
  box.style.cssText =
    'flex:0 0 64px;width:64px;height:64px;border-radius:8px;background:#ececec;' +
    'display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;';
  if (!has(src)) {
    // No image prop: render an explicit placeholder rather than a broken <img> (no 404 noise).
    box.textContent = '🍽';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', has(name) ? name + ' (no photo available)' : 'No photo available');
    return box;
  }
  const img = document.createElement('img');
  img.src = String(src);
  img.alt = has(name) ? String(name) : '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
  img.addEventListener('error', () => {
    box.textContent = '🍽';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', 'Photo unavailable');
  });
  box.appendChild(img);
  return box;
}

export function render(p) {
  const props = p || {};

  const el = document.createElement('div');
  el.style.cssText =
    'display:flex;gap:12px;padding:12px;box-sizing:border-box;width:100%;max-width:100%;' +
    'align-items:flex-start;font-family:sans-serif;font-size:14px;line-height:1.4;color:#222;' +
    WRAP;

  el.appendChild(media(props.image, props.name));

  const body = document.createElement('div');
  // flex:1 + min-width:0 is what lets the long strings wrap instead of pushing the row wider.
  body.style.cssText = 'flex:1 1 auto;display:flex;flex-direction:column;gap:6px;' + WRAP;

  body.appendChild(
    text('h3', has(props.name) ? String(props.name) : 'Unnamed restaurant',
      'margin:0;font-size:16px;font-weight:600;line-height:1.3;')
  );

  const cuisines = list(props.cuisine);
  body.appendChild(
    cuisines.length
      ? chipRow(cuisines)
      : text('div', 'Cuisine not listed', 'color:#666;font-size:12px;')
  );

  // Price / rating / reviews: 0, "0" and "₹0" are values, so test for null, never truthiness.
  const facts = document.createElement('div');
  facts.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 10px;color:#444;' + WRAP;
  facts.appendChild(text('span', has(props.price) ? String(props.price) : 'Price N/A'));
  const rating = typeof props.rating === 'number' && isFinite(props.rating) ? props.rating : null;
  facts.appendChild(text('span', rating === null ? '★ New' : '★ ' + rating.toFixed(1)));
  const reviews = typeof props.reviews === 'number' && isFinite(props.reviews) ? props.reviews : null;
  facts.appendChild(
    text('span', reviews === null ? 'No reviews yet' : reviews + (reviews === 1 ? ' review' : ' reviews'),
      'color:#666;')
  );
  body.appendChild(facts);

  body.appendChild(
    text('div', has(props.address) ? String(props.address) : 'Address not available',
      'color:#555;font-size:13px;')
  );

  const tags = list(props.tags);
  if (tags.length) body.appendChild(chipRow(tags, 'color:#555;'));

  if (has(props.review)) {
    body.appendChild(text('p', String(props.review), 'margin:0;color:#333;'));
  }
  body.appendChild(
    text('div', '— ' + (has(props.author) ? String(props.author) : 'Anonymous'),
      'color:#666;font-size:13px;')
  );

  el.appendChild(body);
  return el;
}
