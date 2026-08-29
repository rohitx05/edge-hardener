// Hardened card component. Framework-free.
// export render(props) -> HTMLElement

const BOX = 'box-sizing:border-box';

export function render(p) {
  const props = p || {};

  const el = document.createElement('div');
  el.style.cssText =
    `${BOX};display:flex;gap:12px;padding:12px;font-family:sans-serif;` +
    'width:100%;max-width:100%;overflow:hidden;align-items:flex-start';

  // --- media: never point <img> at a null/empty src (that 404s and logs a console error)
  const src = typeof props.image === 'string' ? props.image.trim() : '';
  const mediaCss =
    `${BOX};flex:0 0 auto;width:80px;height:80px;border-radius:6px;` +
    'object-fit:cover;background:#eee';

  const makePlaceholder = () => {
    const ph = document.createElement('div');
    ph.style.cssText =
      mediaCss +
      ';display:flex;align-items:center;justify-content:center;' +
      'color:#888;font-size:11px;text-align:center;line-height:1.2';
    ph.textContent = 'No image';
    ph.setAttribute('role', 'img');
    ph.setAttribute('aria-label', 'No image available');
    return ph;
  };

  if (src) {
    const img = document.createElement('img');
    img.style.cssText = mediaCss;
    img.alt = typeof props.name === 'string' ? props.name : '';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      if (img.parentNode) img.parentNode.replaceChild(makePlaceholder(), img);
    });
    img.src = src;
    el.appendChild(img);
  } else {
    el.appendChild(makePlaceholder());
  }

  // --- body: min-width:0 is what actually lets a flex child shrink below content width
  const body = document.createElement('div');
  body.style.cssText = `${BOX};flex:1 1 auto;min-width:0;max-width:100%`;

  const wrapCss =
    'min-width:0;max-width:100%;white-space:normal;' +
    'overflow-wrap:anywhere;word-break:break-word';

  const name =
    typeof props.name === 'string' && props.name.trim() ? props.name : 'Unnamed restaurant';
  const h = document.createElement('h3');
  h.textContent = name;
  h.title = name;
  h.style.cssText = `${BOX};margin:0 0 4px;font-size:16px;line-height:1.3;${wrapCss}`;
  body.appendChild(h);

  const list = Array.isArray(props.cuisine)
    ? props.cuisine.filter((c) => typeof c === 'string' && c.trim())
    : typeof props.cuisine === 'string' && props.cuisine.trim()
      ? [props.cuisine]
      : [];
  const cui = document.createElement('div');
  cui.textContent = list.length ? list.join(' · ') : 'Cuisine not listed';
  if (list.length) cui.title = list.join(' · ');
  cui.style.cssText = `${BOX};color:#555;font-size:13px;${wrapCss}`;
  body.appendChild(cui);

  // --- meta row: wraps instead of pushing past the host's right edge
  const meta = document.createElement('div');
  meta.style.cssText =
    `${BOX};display:flex;flex-wrap:wrap;align-items:baseline;gap:0 6px;` +
    `margin-top:4px;font-size:13px;${wrapCss}`;

  const price = document.createElement('span');
  const rawPrice = props.price;
  const hasPrice =
    rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== '';
  price.textContent = hasPrice ? String(rawPrice) : 'Price N/A';
  price.style.cssText = `${BOX};${wrapCss}`;
  meta.appendChild(price);

  const rating = document.createElement('span');
  const r = typeof props.rating === 'number' ? props.rating : Number(props.rating);
  rating.textContent = Number.isFinite(r) ? `· ${r.toFixed(1)}` : '· Not rated';
  rating.style.cssText = `${BOX};${wrapCss}`;
  meta.appendChild(rating);

  const reviews = Number(props.reviews);
  if (Number.isFinite(reviews) && reviews > 0) {
    const rv = document.createElement('span');
    rv.textContent = `· ${reviews} reviews`;
    rv.style.cssText = `${BOX};color:#666;${wrapCss}`;
    meta.appendChild(rv);
  }

  body.appendChild(meta);
  el.appendChild(body);
  return el;
}
