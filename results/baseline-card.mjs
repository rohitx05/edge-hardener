export function render(p) {
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    gap: 12px;
    padding: 12px;
    font-family: sans-serif;
    box-sizing: border-box;
  `;

  // Image container with fallback
  const imgContainer = document.createElement('div');
  imgContainer.style.cssText = `
    flex-shrink: 0;
    width: 80px;
    height: 80px;
    min-width: 80px;
    background: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #999;
  `;

  if (p.image) {
    const img = document.createElement('img');
    img.src = p.image;
    img.alt = p.name || 'Restaurant image';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    img.onerror = function() {
      imgContainer.innerHTML = '<div>No image</div>';
    };
    imgContainer.appendChild(img);
  } else {
    imgContainer.textContent = 'No image';
  }
  el.appendChild(imgContainer);

  // Body content
  const body = document.createElement('div');
  body.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  `;

  // Name
  const nameEl = document.createElement('h3');
  const nameText = String(p.name || 'Unnamed Restaurant');
  nameEl.textContent = nameText;
  nameEl.title = nameText;
  nameEl.style.cssText = `
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  body.appendChild(nameEl);

  // Cuisine
  const cuisineEl = document.createElement('div');
  const cuisineArray = Array.isArray(p.cuisine) 
    ? p.cuisine.filter(c => c != null && String(c).trim().length > 0) 
    : [];
  const cuisineText = cuisineArray.length > 0 
    ? cuisineArray.map(c => String(c).trim()).join(', ') 
    : 'Cuisine not specified';
  cuisineEl.textContent = cuisineText;
  cuisineEl.title = cuisineText;
  cuisineEl.style.cssText = `
    font-size: 14px;
    color: #666;
  `;
  body.appendChild(cuisineEl);

  // Price and rating row
  const metaEl = document.createElement('div');
  metaEl.style.cssText = `
    display: flex;
    gap: 8px;
    font-size: 14px;
    color: #333;
    flex-wrap: wrap;
  `;

  const priceEl = document.createElement('span');
  const priceText = (p.price == null || p.price === '')
    ? 'Price N/A'
    : String(p.price);
  priceEl.textContent = priceText;
  metaEl.appendChild(priceEl);

  if (p.rating != null && p.rating !== '') {
    const ratingNum = typeof p.rating === 'number' ? p.rating : parseFloat(p.rating);
    if (!isNaN(ratingNum)) {
      const ratingEl = document.createElement('span');
      ratingEl.textContent = ` · ${ratingNum.toFixed(1)}`;
      metaEl.appendChild(ratingEl);
    }
  }

  body.appendChild(metaEl);

  // Author
  if (p.author) {
    const authorEl = document.createElement('div');
    authorEl.textContent = `by ${p.author}`;
    authorEl.style.cssText = `
      font-size: 12px;
      color: #999;
    `;
    body.appendChild(authorEl);
  }

  // Tags
  if (Array.isArray(p.tags) && p.tags.length > 0) {
    const tagsEl = document.createElement('div');
    tagsEl.style.cssText = `
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      font-size: 12px;
    `;
    const validTags = p.tags.filter(tag => tag != null && String(tag).trim().length > 0);
    validTags.forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.textContent = String(tag).trim();
      tagEl.style.cssText = `
        background: #e8f5e9;
        color: #2e7d32;
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
      `;
      tagsEl.appendChild(tagEl);
    });
    if (validTags.length > 0) {
      body.appendChild(tagsEl);
    }
  }

  // Address
  if (p.address) {
    const addressEl = document.createElement('div');
    addressEl.textContent = p.address;
    addressEl.title = p.address;
    addressEl.style.cssText = `
      font-size: 12px;
      color: #666;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    body.appendChild(addressEl);
  }

  // Review
  if (p.review) {
    const reviewEl = document.createElement('div');
    reviewEl.textContent = p.review;
    reviewEl.title = p.review;
    reviewEl.style.cssText = `
      font-size: 13px;
      color: #555;
    `;
    body.appendChild(reviewEl);
  }

  // Reviews count
  if (p.reviews != null && p.reviews !== '') {
    const reviewsEl = document.createElement('div');
    reviewsEl.textContent = `${p.reviews} reviews`;
    reviewsEl.style.cssText = `
      font-size: 12px;
      color: #999;
    `;
    body.appendChild(reviewsEl);
  }

  el.appendChild(body);
  return el;
}
