// Pantry: what is likely in the house. Receipts say what came in, never what was eaten,
// so confidence fades with typical shelf life, and one tap says "we are out".

// Typical days before something is probably gone or past its best.
export const SHELF = { fresh: 6, dairy: 8, bread: 4, eggs: 21, roots: 21, frozen: 90, dry: 180, tinned: 365 };

export function confidence(item, today) {
  if (item.out) return 0;
  const age = today - item.bought;
  const life = SHELF[item.category] || 14;
  return Math.max(0, Math.min(1, 1 - age / life));
}

// Three plain levels, because a percentage would pretend to a precision nobody has.
export function levelOf(item, today) {
  const c = confidence(item, today);
  if (c >= 0.5) return 'likely';
  if (c > 0.1) return 'maybe';
  return 'unlikely';
}

export function checkDish(dish, pantry, today) {
  const out = { have: [], unsure: [], missing: [] };
  for (const need of dish.needs) {
    const item = pantry.filter((p) => p.key === need).sort((a, b) => b.bought - a.bought)[0];
    const level = item ? levelOf(item, today) : 'unlikely';
    if (level === 'likely') out.have.push(need);
    else if (level === 'maybe') out.unsure.push(need);
    else out.missing.push(need);
  }
  out.ready = out.missing.length === 0 && out.unsure.length === 0;
  return out;
}

// Words on a receipt mapped to what the kitchen calls the thing.
const KNOWN = [
  ['salmon', 'salmon', 'fresh'], ['broccoli', 'broccoli', 'fresh'], ['lemon', 'lemon', 'fresh'], ['milk', 'milk', 'dairy'],
  ['tofu', 'tofu', 'dairy'], ['spring onion', 'spring onion', 'fresh'], ['egg', 'eggs', 'eggs'], ['noodle', 'noodles', 'fresh'],
  ['carrot', 'carrot', 'roots'], ['rice', 'rice', 'dry'], ['spaghetti', 'pasta', 'dry'], ['pasta', 'pasta', 'dry'],
  ['chicken', 'chicken', 'fresh'], ['minced beef', 'minced beef', 'fresh'], ['beef mince', 'minced beef', 'fresh'],
  ['tomato', 'tinned tomatoes', 'tinned'], ['onion', 'onion', 'roots'], ['garlic', 'garlic', 'roots'], ['ginger', 'ginger', 'roots'],
  ['cucumber', 'cucumber', 'fresh'], ['peas', 'frozen peas', 'frozen'], ['bread', 'bread', 'bread'], ['yoghurt', 'yoghurt', 'dairy'],
];
const NOT_FOOD = /\b(total|subtotal|delivery|fee|gst|change|cash|visa|order|discount|rounding)\b/i;

// Reads lines shaped like "Broccoli 300g  2  $5.00". Anything it cannot place is
// returned as unrecognised, so a person decides; nothing is guessed silently.
export function parseReceipt(text) {
  const items = [];
  const unrecognised = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = line.match(/^(.+?)\s{2,}(\d+)\s{2,}\$?(\d+(?:\.\d{2})?)$/);
    if (!m || NOT_FOOD.test(m[1])) continue;
    const label = m[1].trim();
    const lower = label.toLowerCase();
    const hit = KNOWN.find(([word]) => lower.includes(word));
    const entry = { label: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(), qty: Number(m[2]), price: Number(m[3]) };
    if (hit) items.push({ ...entry, key: hit[1], category: hit[2] });
    else unrecognised.push(entry);
  }
  return { items, unrecognised };
}

export function addToPantry(pantry, items, today) {
  const next = pantry.filter((p) => !items.some((i) => i.key === p.key));
  // The kitchen's own word for the thing, not the shop's product name.
  for (const i of items) next.push({ key: i.key, label: i.key.charAt(0).toUpperCase() + i.key.slice(1), category: i.category, bought: today });
  return next;
}
