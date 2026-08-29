// Generates the adversarial battery. Fully synthetic + self-authored => license-clean,
// zero data/privacy risk, maximal reproducibility. Seeded so cases are deterministic.
//
// Run:  node eval/generate_cases.mjs > results/cases.json
//
// Each case declares mustContain: the values that HAVE to survive visibly. That list is
// what makes the content-presence check possible — the agent can't win by hiding them.

const base = { name: 'Bombay House', cuisine: ['North Indian'], price: '₹₹', rating: 4.3,
  image: 'ok.jpg', reviews: 128, author: 'Aarav' };

const EDGE = {
  longName: { name: 'The Absolutely Enormous Roof-Top Family Restaurant & Grill House Deluxe' },
  emptyCuisine: { cuisine: [] },
  manyCuisine: { cuisine: ['North Indian','Mughlai','Chinese','Continental','Thai','Dessert'] },
  zeroPrice: { price: '₹0' },
  noImage: { image: null },
  noRating: { rating: null },
  zeroReviews: { reviews: 0 },
  noAuthor: { author: null },
  unicodeName: { name: '🍜 café— naïve “Ræstaurant” 北京烤鸭' },
};

const cases = [];
// singles
for (const [id, patch] of Object.entries(EDGE)) {
  const props = { ...base, ...patch };
  cases.push({ id, props, mustContain: mustFrom(props) });
}
// the required "one challenging case": stacked worst-case, mobile is where it breaks
cases.push({
  id: 'stacked-nightmare',
  props: { ...base, ...EDGE.longName, ...EDGE.manyCuisine, ...EDGE.zeroPrice,
           ...EDGE.noImage, ...EDGE.noAuthor },
  mustContain: mustFrom({ ...base, ...EDGE.longName, ...EDGE.zeroPrice }),
});

function mustFrom(p) {
  // The human-meaningful values that must remain visible. Tune per component.
  const m = [];
  if (p.name) m.push(p.name);
  if (p.price != null) m.push(String(p.price));
  if (Array.isArray(p.cuisine) && p.cuisine.length) m.push(p.cuisine[0]);
  return m;
}

process.stdout.write(JSON.stringify(cases, null, 2));
