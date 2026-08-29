// Generates the adversarial battery. Fully synthetic + self-authored => license-clean,
// zero data/privacy risk, maximal reproducibility. Seeded so cases are deterministic.
//
// Run:  node eval/generate_cases.mjs > results/cases.json
//
// Each case declares mustContain: the values that HAVE to survive visibly. That list is
// what makes the content-presence check possible — the agent can't win by hiding them.
//
// DIFFICULTY NOTE: the first version of this battery was cleared 100% blind by a one-shot
// model, which left nothing for the verify-fix loop to measure. The cases below are built
// around INTERACTING failures — individually reasonable fixes that regress each other — so
// that reaching 100% takes evidence rather than one good guess:
//   · `white-space:nowrap` + ellipsis tidies long names and destroys the unbroken token.
//   · `overflow-wrap:anywhere` on the text column fixes the token and does nothing for a
//     nested row whose CHILD still lacks min-width:0.
//   · `flex-wrap:nowrap` on the meta row keeps the rating on one line and spills the tags.
//   · Normalising/trimming unicode to buy width drops combining marks and ZWJ sequences,
//     which the content-presence check then reports as absent.

// A single unbroken 90-char token: no spaces, no hyphens, nothing for a line breaker to
// grab. Only anywhere/break-all style wrapping survives this.
const UNBROKEN_90 =
  'BombayHouseRooftopGrillAndFamilyDiningExperienceDeluxeMultiCuisineKitchen'.padEnd(90, 'X');
const UNBROKEN_URL =
  'https://bookings.example.test/reservations/bombay-house-rooftop-grill'.padEnd(90, 'Z');
const UNBROKEN_HANDLE = '@' + 'aarav'.padEnd(59, 'q');

// RTL and bidi. The bidi case mixes scripts and digits so a naive direction guess reorders
// something visible.
const RTL_NAME = 'مطعم برج الحمام الشهير في مدينة دبي القديمة';
const RTL_ADDRESS = 'شارع الشيخ زايد، بناية رقم ٤٢، دبي';
const BIDI_NAME = 'مطعم Bombay House رقم 42 — بيت بومباي';

// All-emoji, including a ZWJ family sequence and a skin-tone modifier: both are multi-code-
// point grapheme clusters that naive slicing splits into mojibake.
const EMOJI_NAME = '🍜🥟🍡🧋🍢🍤🍥🥠🍘🍙🍚🍛🍝🍞🍟 👨‍👩‍👧‍👦 👋🏽';
// Combining marks spread over many base characters — breakable between clusters, so this
// stays satisfiable, but stripping or normalising the marks loses the mustContain match.
const COMBINING_NAME = Array.from('Restaurant Cafe Bistro')
  .map((c) => (c === ' ' ? c : c + '́̈'))
  .join('');

const base = { name: 'Bombay House', cuisine: ['North Indian'], price: '₹₹', rating: 4.3,
  image: 'ok.jpg', reviews: 128, author: 'Aarav', address: '12 Linking Road, Bandra West',
  tags: ['Outdoor seating'], review: 'Great biryani, fast service.' };

const MANY_CUISINE = ['North Indian', 'Mughlai', 'Chinese', 'Continental', 'Thai', 'Dessert'];

const EDGE = {
  // — originals —
  longName: { name: 'The Absolutely Enormous Roof-Top Family Restaurant & Grill House Deluxe' },
  emptyCuisine: { cuisine: [] },
  manyCuisine: { cuisine: MANY_CUISINE },
  zeroPrice: { price: '₹0' },
  noImage: { image: null },
  noRating: { rating: null },
  zeroReviews: { reviews: 0 },
  noAuthor: { author: null },
  unicodeName: { name: '🍜 café— naïve “Ræstaurant” 北京烤鸭' },

  // — unbroken tokens: defeat word-boundary wrapping —
  unbrokenName: { name: UNBROKEN_90 },
  unbrokenAddress: { address: UNBROKEN_URL },
  unbrokenCuisine: { cuisine: ['NorthIndianMughlaiAwadhiHyderabadiChettinadMalabarKonkani'] },
  unbrokenAuthor: { author: UNBROKEN_HANDLE },

  // — bidi / script —
  rtlName: { name: RTL_NAME, address: RTL_ADDRESS },
  bidiMixed: { name: BIDI_NAME, address: RTL_ADDRESS },

  // — grapheme clusters —
  emojiName: { name: EMOJI_NAME },
  combiningName: { name: COMBINING_NAME },

  // — falsy-but-real, and total absence —
  falsyReal: { price: '0', rating: 0, reviews: 0 },
  nullEverything: { cuisine: null, rating: null, image: null, author: null,
    reviews: null, tags: null, review: null },
};

const cases = [];
for (const [id, patch] of Object.entries(EDGE)) {
  const props = { ...base, ...patch };
  cases.push({ id, props, mustContain: mustFrom(props) });
}

// ── stacked cases: where the interactions bite ───────────────────────────────────────────
// Each combines fixes that pull in different directions; mobile-sm (320px) decides them.
const STACKED = {
  // the original challenge case
  'stacked-nightmare': { ...EDGE.longName, ...EDGE.manyCuisine, ...EDGE.zeroPrice,
    ...EDGE.noImage, ...EDGE.noAuthor },

  // widest text column, least help: an unbroken name AND an unbroken address, no image, and
  // word-boundary wrapping cannot save either.
  'stacked-unbreakable': { ...EDGE.unbrokenName, ...EDGE.unbrokenAddress,
    ...EDGE.manyCuisine, ...EDGE.zeroPrice, ...EDGE.noImage, ...EDGE.noRating },

  // three competing long tokens landing in DIFFERENT nested rows — min-width:0 is needed on
  // the row and on the child, not only on the outer text column.
  'stacked-nested': { ...EDGE.unbrokenName, ...EDGE.unbrokenAddress, ...EDGE.unbrokenAuthor,
    ...EDGE.manyCuisine },

  // RTL name + RTL address + long cuisine list + no image
  'stacked-rtl': { ...EDGE.rtlName, ...EDGE.manyCuisine, ...EDGE.noImage, ...EDGE.zeroPrice },

  // grapheme clusters + an unbroken handle + falsy-but-real numbers
  'stacked-emoji': { ...EDGE.emojiName, ...EDGE.unbrokenAuthor, ...EDGE.falsyReal,
    cuisine: ['🍜 Ramen', 'Mughlai', 'Chinese', 'Continental'] },

  // the kitchen sink
  'stacked-everything': { ...EDGE.unbrokenName, ...EDGE.unbrokenAddress,
    ...EDGE.unbrokenCuisine, ...EDGE.falsyReal, ...EDGE.noImage, ...EDGE.noRating,
    tags: ['Outdoor seating', 'Late night', 'Family friendly', 'Rooftop'] },
};

for (const [id, patch] of Object.entries(STACKED)) {
  const props = { ...base, ...patch };
  cases.push({ id, props, mustContain: mustFrom(props) });
}

function mustFrom(p) {
  // The human-meaningful values that must remain visible. Tune per component.
  // address and author are included so the card cannot buy width by dropping a whole row.
  const m = [];
  if (p.name) m.push(p.name);
  if (p.price != null) m.push(String(p.price));
  if (Array.isArray(p.cuisine) && p.cuisine.length) m.push(p.cuisine[0]);
  if (p.address) m.push(p.address);
  if (p.author) m.push(p.author);
  return m;
}

process.stdout.write(JSON.stringify(cases, null, 2));
