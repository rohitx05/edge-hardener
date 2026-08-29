// Deliberately fragile starting component. It renders the happy path fine and breaks on
// real data: long names overflow, empty cuisine prints "undefined", missing image leaves
// a broken box, ₹0 is falsy-dropped. This is what the agent has to harden.
// export render(props) -> HTMLElement  (framework-free so the harness stays portable)

export function render(p) {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;gap:12px;padding:12px;font-family:sans-serif';

  const img = document.createElement('img');
  img.src = p.image;                       // FRAGILE: no null/broken handling
  img.style.cssText = 'width:80px;height:80px;object-fit:cover';
  el.appendChild(img);

  const body = document.createElement('div');
  const h = document.createElement('h3');
  h.textContent = p.name;
  h.style.cssText = 'white-space:nowrap';  // FRAGILE: long name overflows
  body.appendChild(h);

  const cui = document.createElement('div');
  cui.textContent = p.cuisine[0];          // FRAGILE: empty array -> undefined; many -> untrimmed
  body.appendChild(cui);

  const price = document.createElement('span');
  price.textContent = p.price || 'Price N/A'; // FRAGILE: '₹0' is truthy, but '' would drop
  body.appendChild(price);

  const rating = document.createElement('span');
  rating.textContent = ' · ' + p.rating.toFixed(1); // FRAGILE: null.toFixed crashes
  body.appendChild(rating);

  el.appendChild(body);
  return el;
}
