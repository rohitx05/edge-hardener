export function render(p) {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;gap:12px;padding:12px;font-family:sans-serif';

  const img = document.createElement('img');
  // Avoid 404 by providing fallback for null image
  if (p.image) {
    img.src = p.image;
  } else {
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23eee" width="80" height="80"/%3E%3C/svg%3E';
  }
  img.style.cssText = 'width:80px;height:80px;object-fit:cover;flex-shrink:0';
  img.alt = p.name || 'Restaurant';
  el.appendChild(img);

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1;min-width:0';
  
  const h = document.createElement('h3');
  h.textContent = p.name;
  h.style.cssText = 'margin:0;overflow-wrap:break-word';
  body.appendChild(h);

  const cui = document.createElement('div');
  let cuisineText = 'Unlisted';
  if (p.cuisine && Array.isArray(p.cuisine) && p.cuisine.length > 0) {
    cuisineText = p.cuisine[0];
  }
  cui.textContent = cuisineText;
  cui.style.cssText = 'font-size:0.9em;color:#666;overflow-wrap:break-word';
  body.appendChild(cui);

  const priceRating = document.createElement('div');
  let priceText = p.price !== null && p.price !== undefined ? p.price : 'Price N/A';
  let ratingText = p.rating !== null && p.rating !== undefined ? ' · ' + p.rating.toFixed(1) : '';
  priceRating.textContent = priceText + ratingText;
  priceRating.style.cssText = 'font-size:0.9em;overflow-wrap:break-word';
  body.appendChild(priceRating);

  if (p.address) {
    const address = document.createElement('div');
    address.textContent = p.address;
    address.style.cssText = 'font-size:0.85em;color:#999;overflow-wrap:break-word';
    body.appendChild(address);
  }

  if (p.author) {
    const author = document.createElement('div');
    author.textContent = p.author;
    author.style.cssText = 'font-size:0.85em;color:#999;overflow-wrap:break-word';
    body.appendChild(author);
  }

  el.appendChild(body);
  return el;
}
