// The rules table: what the portal may do, and how far it may be trusted to do it.
// This table is code. A language model never decides it and cannot change it.
//
// Three levels of trust, earned one step at a time:
//   suggest : the portal offers; a person does it
//   ask     : the portal prepares it and acts only after a tap
//   tell    : the portal acts, then says what it did
// Anything that leaves the portal or changes a plan can never go above "ask".

export const LEVELS = ['suggest', 'ask', 'tell'];
export const LEVEL_LABEL = { suggest: 'Suggest', ask: 'Ask, then act', tell: 'Act, then tell' };
export const NEEDED = 5; // Accepted suggestions in a row before a step up is offered.

export const ACTIONS = {
  remind: { label: 'Remind a person about their own commitment', outward: false, max: 'tell' },
  escalate: { label: 'Ask the next adult when something is unconfirmed', outward: false, max: 'tell' },
  board: { label: 'Show something on the kitchen board', outward: false, max: 'tell' },
  list: { label: 'Add to the grocery list', outward: false, max: 'tell' },
  routine: { label: 'Turn a repeat into a routine', outward: false, max: 'ask' },
  move: { label: 'Move or cancel a commitment', outward: true, max: 'ask' },
  message: { label: 'Send a message outside the portal', outward: true, max: 'ask' },
  book: { label: 'Book or pay for something', outward: true, max: 'ask' },
};

export const NEVER = [
  'Track where anyone is',
  "Read anyone's messages or browsing",
  'Hold passwords, bank logins or card numbers',
  "Send, pay, book or cancel without a person's tap",
  'Decide something about a child without a parent',
];

const rank = (level) => LEVELS.indexOf(level);

export const ceiling = (action) => ACTIONS[action].max;

// Never above the ceiling, whatever was asked for.
export function clamp(action, level) {
  return rank(level) > rank(ceiling(action)) ? ceiling(action) : level;
}

// The next level, if it has been earned and the ceiling allows it. Otherwise null.
export function nextLevel(action, level, accepted) {
  const next = LEVELS[rank(level) + 1];
  if (!next || rank(next) > rank(ceiling(action))) return null;
  return accepted >= NEEDED ? next : null;
}

export function whyLocked(action, level, accepted) {
  const next = LEVELS[rank(level) + 1];
  if (!next) return 'This is as far as it goes.';
  if (rank(next) > rank(ceiling(action))) return ACTIONS[action].outward ? 'It changes a plan or leaves the portal, so it always needs a tap.' : 'A person always decides this one.';
  return `Accepted ${Math.min(accepted, NEEDED)} of ${NEEDED} times. It can step up after ${NEEDED}.`;
}

// What happens when an automation fires at its current level.
export function decide(action, level) {
  const l = clamp(action, level);
  return { suggest: 'offer', ask: 'confirm', tell: 'act' }[l];
}
