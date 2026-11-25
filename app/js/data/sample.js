// The sample household and one invented school week.
// People are known here only by codes: H, K, A1, A2. Names never appear in this repo
// in plain text; text that mentions a person uses a token such as {A2}, which is
// replaced when it is shown (see app/js/names.js).
// Every time, venue and event below is invented.

import { hm } from '../engine/time.js';

export const TIERS = ['ambient', 'digest', 'nudge', 'interrupt'];

export function createMembers() {
  return [
    { id: 'H', name: 'H', role: 'parent', label: 'Parent', adult: true, drives: true, device: true, maxLegs: 8, hue: 'H' },
    { id: 'K', name: 'K', role: 'parent', label: 'Parent', adult: true, drives: true, device: true, maxLegs: 8, hue: 'K' },
    { id: 'A1', name: 'A1', role: 'child', label: '14', adult: false, drives: false, device: true, maxLegs: 0, hue: 'A1' },
    // A2 is 8 with limited phone access: nothing is pushed to her; her items go to the board.
    { id: 'A2', name: 'A2', role: 'child', label: '8', adult: false, drives: false, device: false, maxLegs: 0, hue: 'A2' },
  ];
}

export function createCars() {
  return [{ id: 'car1', name: 'The car', drivers: ['H', 'K'] }];
}

// Each person's notification contract. The receiver decides delivery.
export function createContracts() {
  return {
    H: { quiet: [hm(22, 30), hm(6, 30)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [{ target: 'A2', tier: 'digest' }, { target: 'activity:football', tier: 'digest' }] },
    K: { quiet: [hm(22), hm(6)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [{ target: 'A2', tier: 'nudge' }, { target: 'A1', tier: 'digest' }] },
    A1: { quiet: [hm(21, 30), hm(6, 30)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [] },
    A2: { quiet: [hm(20), hm(6, 30)], digestTimes: [hm(7), hm(15), hm(19)], lower: null, follows: [] },
  };
}

export function createActivities() {
  return [
    { id: 'football', name: 'Football', who: 'A1', owner: 'H', provider: 'Eastside Juniors FC', contact: 'Coach Farid', term: 'Season 2, ends 12 December', fee: 'Paid', kit: ['Boots', 'Shin guards', 'Water bottle'], makeups: null, renewal: { due: 'Fri 4 Dec', note: 'Season 3 registration' }, told: 'Coach WhatsApp group' },
    { id: 'basketball', name: 'Basketball', who: 'A1', owner: 'H', provider: 'School team', contact: 'Mr Lim', term: 'Semester 2, ends 20 November', fee: 'None', kit: ['Indoor shoes', 'Jersey'], makeups: null, renewal: { due: 'Mon 30 Nov', note: 'Holiday training camp, optional' }, told: 'School app' },
    { id: 'violin', name: 'Violin, Grade 5', who: 'A1', owner: 'H', provider: 'Strings Studio', contact: 'Ms Ong', term: 'Term 4, ends 17 December', fee: 'Due Tue 1 Dec', kit: ['Violin', 'Grade 5 pieces', 'Shoulder rest'], makeups: { left: 1, of: 2, expires: 'Thu 17 Dec' }, renewal: { due: 'Tue 1 Dec', note: 'Term 1 fees, two weeks before term' }, told: 'Email' },
    { id: 'gym', name: 'Gymnastics', who: 'A2', owner: 'K', provider: 'Tumble Club', contact: 'Coach Mei', term: 'Block of 10, lesson 7 of 10', fee: 'Paid', kit: ['Leotard', 'Water bottle'], makeups: { left: 2, of: 3, expires: 'Sun 13 Dec' }, renewal: { due: 'Fri 11 Dec', note: 'Next block of 10' }, told: 'App' },
    { id: 'netball', name: 'Netball', who: 'A2', owner: 'K', provider: 'Junior Netball Academy', contact: 'Coach Sara', term: 'Term 4, ends 11 December', fee: 'Paid', kit: ['Bib', 'Trainers', 'Water bottle'], makeups: { left: 3, of: 3, expires: 'Fri 11 Dec' }, renewal: { due: 'Fri 27 Nov', note: 'Withdrawal notice is four weeks' }, told: 'Parents WhatsApp group' },
    { id: 'piano', name: 'Piano, Grade 2', who: 'A2', owner: 'K', provider: 'Keys Music Studio', contact: 'Ms Tan', term: 'Term 4, ends 18 December', fee: 'Paid', kit: ['Grade 2 books', 'Theory workbook'], makeups: { left: 0, of: 2, expires: 'Fri 18 Dec' }, renewal: { due: 'Thu 3 Dec', note: 'Term 1 place held until then' }, told: 'Email' },
  ];
}

let seq = 0;
function c(partial) {
  seq += 1;
  return {
    id: partial.id || `c${seq}`,
    type: 'activity',
    people: [],
    owner: null,
    driver: null,
    car: null,
    legs: null,
    needs: [],
    fixed: true,
    soft: false,
    hardensAt: null,
    place: '',
    activity: null,
    backup: [],
    ack: 'none',
    ...partial,
  };
}

// Who collects A2 from school, and who cooks, Monday to Friday.
export const COLLECTS = ['K', 'H', 'K', 'H', 'K'];
export const COOKS = ['H', 'K', 'H', 'K', 'K'];
const other = (id) => (id === 'H' ? 'K' : 'H');

export function createCommitments() {
  seq = 0;
  const list = [];

  for (let day = 0; day < 5; day += 1) {
    list.push(c({ id: `school-A1-${day}`, title: 'School', type: 'school', day, start: hm(7, 30), end: hm(14), people: ['A1'], owner: 'A1', place: 'Secondary school' }));
    list.push(c({ id: `school-A2-${day}`, title: 'School', type: 'school', day, start: hm(7, 30), end: hm(13, 30), people: ['A2'], owner: 'A2', place: 'Primary school' }));
    list.push(c({ id: `pickup-${day}`, title: 'Collect {A2} from school', type: 'pickup', day, start: hm(13, 30), end: hm(13, 50), people: ['A2', COLLECTS[day]], owner: COLLECTS[day], backup: [other(COLLECTS[day])], place: 'School gate B', ack: 'pending' }));
    list.push(c({ id: `dinner-${day}`, title: 'Family dinner', type: 'meal', day, start: hm(19), end: hm(19, 45), people: day === 4 ? ['K', 'A1', 'A2'] : ['H', 'K', 'A1', 'A2'], owner: COOKS[day], soft: true, fixed: false, hardensAt: hm(16), place: 'Home' }));
  }

  // Monday
  list.push(c({ id: 'piano-0', title: '{A2}, piano', day: 0, start: hm(16), end: hm(16, 45), people: ['A2'], owner: 'K', driver: 'K', car: 'car1', legs: 'both', activity: 'piano', place: 'Keys Music Studio', needs: [{ kind: 'kit', label: 'Grade 2 books', done: true }] }));
  list.push(c({ id: 'football-0', title: '{A1}, football training', day: 0, start: hm(16, 30), end: hm(18, 30), people: ['A1'], owner: 'A1', activity: 'football', place: 'Bedok Stadium', needs: [{ kind: 'kit', label: 'Boots and shin guards', done: false }] }));
  list.push(c({ id: 'work-H-0', title: '{H}, late meeting', type: 'work', day: 0, start: hm(17), end: hm(18, 15), people: ['H'], owner: 'H', place: 'Work' }));

  // Tuesday
  list.push(c({ id: 'gym-1', title: '{A2}, gymnastics', day: 1, start: hm(16), end: hm(17), people: ['A2'], owner: 'K', driver: 'K', car: 'car1', legs: 'both', activity: 'gym', place: 'Tumble Club', needs: [{ kind: 'kit', label: 'Leotard and water bottle', done: false }] }));
  list.push(c({ id: 'lab-1', title: '{A1}, Science Lab session', type: 'study', day: 1, start: hm(20), end: hm(20, 25), people: ['A1'], owner: 'A1', place: 'Home', fixed: false }));

  // Wednesday
  list.push(c({ id: 'dentist', title: '{A2}, dentist', type: 'medical', day: 2, start: hm(15), end: hm(16), people: ['A2'], owner: 'K', driver: 'K', car: 'car1', legs: 'both', place: 'Smile Dental', needs: [{ kind: 'form', label: 'Dental card', done: false }], fixed: false }));
  list.push(c({ id: 'basketball-2', title: '{A1}, basketball', day: 2, start: hm(16), end: hm(17, 30), people: ['A1'], owner: 'A1', activity: 'basketball', place: 'School hall', needs: [{ kind: 'kit', label: 'Indoor shoes', done: false }] }));

  // Thursday
  list.push(c({ id: 'work-K-3', title: '{K}, afternoon meeting', type: 'work', day: 3, start: hm(14), end: hm(15, 15), people: ['K'], owner: 'K', place: 'Online' }));
  list.push(c({ id: 'violin-3', title: '{A1}, violin', day: 3, start: hm(17), end: hm(18), people: ['A1'], owner: 'H', driver: 'H', car: 'car1', legs: 'both', activity: 'violin', place: 'Strings Studio', needs: [{ kind: 'kit', label: 'Violin and Grade 5 pieces', done: false }] }));

  // Friday
  list.push(c({ id: 'work-H-4', title: '{H}, work dinner', type: 'work', day: 4, start: hm(18, 30), end: hm(21), people: ['H'], owner: 'H', place: 'Town' }));
  list.push(c({ id: 'netball-4', title: '{A2}, netball', day: 4, start: hm(15), end: hm(16), people: ['A2'], owner: 'K', driver: 'K', car: 'car1', legs: 'both', activity: 'netball', place: 'Kallang courts', needs: [{ kind: 'kit', label: 'Bib and trainers', done: false }] }));

  // Saturday
  list.push(c({ id: 'match-5', title: '{A1}, league match', day: 5, start: hm(9), end: hm(11), people: ['A1'], owner: 'H', driver: 'H', car: 'car1', legs: 'both', activity: 'football', place: 'Bedok Stadium', needs: [{ kind: 'kit', label: 'Home kit', done: false }] }));
  list.push(c({ id: 'groceries-5', title: 'Weekly groceries', type: 'errand', day: 5, start: hm(12), end: hm(13, 15), people: ['K'], owner: 'K', driver: 'K', car: 'car1', legs: 'both', place: 'FairPrice', fixed: false }));
  list.push(c({ id: 'playdate-5', title: '{A2}, playdate', type: 'social', day: 5, start: hm(15), end: hm(17), people: ['A2'], owner: 'K', driver: 'K', car: 'car1', legs: 'both', place: "A friend's home", needs: [{ kind: 'form', label: 'Reply to the invitation', done: false }] }));

  // Sunday
  list.push(c({ id: 'lunch-6', title: 'Sunday lunch out', type: 'meal', day: 6, start: hm(12), end: hm(14), people: ['H', 'K', 'A1', 'A2'], owner: 'H', place: 'East Coast' }));
  list.push(c({ id: 'sync-6', title: 'Family sync', type: 'meal', day: 6, start: hm(17), end: hm(17, 15), people: ['H', 'K', 'A1', 'A2'], owner: 'K', place: 'Home', soft: true, fixed: false, hardensAt: hm(12) }));

  return list;
}

export const PLAYBOOKS = {
  medical: {
    label: 'Medical appointment',
    tasks: (commitment, ctx) => {
      const out = [{ title: `Confirm the new time with ${commitment.place.split(',')[0]}`, owner: commitment.owner }];
      if (ctx.duringSchool) out.push({ title: 'Send a note to the school office', owner: commitment.owner });
      return out;
    },
  },
  activity: { label: 'Class or training', tasks: () => [] },
  social: { label: 'Social', tasks: () => [] },
};

export function createTriage() {
  return [
    { id: 't1', source: 'email', from: 'Strings Studio', received: 'Mon 8:12am', title: 'Term 1 timetable and fees', body: 'Violin moves to Wednesdays, 5pm to 6pm, from 6 January. Fees are due two weeks before term.', suggestion: { kind: 'commitment', text: '{A1}, violin Wed 5pm from 6 Jan' }, requester: 'H', status: 'new' },
    { id: 't2', source: 'image', from: 'Parents Gateway (screenshot from {K})', received: 'Mon 9:40am', title: 'Consent form: Primary 2 learning journey', body: 'Learning journey to the Science Centre on Tue 1 December. Consent needed by Thu 26 November. One parent replies; the answer is final.', suggestion: { kind: 'task', text: 'Reply to the consent form by Thu' }, requester: 'K', status: 'new' },
    { id: 't3', source: 'voice', from: '{A1} (voice note, 0:14)', received: 'Mon 12:05pm', title: 'Need $40 for the team jersey', body: 'Coach says the new away jersey is forty dollars, cash, by Thursday training.', suggestion: { kind: 'task', text: 'Give {A1} $40 by Thu' }, requester: 'A1', status: 'new' },
    { id: 't4', source: 'typed', from: '{K}', received: 'Sun 6:30pm', title: 'Kitchen tap is dripping', body: 'The mixer tap drips when closed. Getting worse this week.', suggestion: { kind: 'task', text: 'Call the plumber' }, requester: 'K', status: 'new', carried: 1 },
    { id: 't5', source: 'email', from: 'Tumble Club', received: 'Sat 4:02pm', title: 'Gym closed on Tue 1 December', body: 'The hall is closed for a competition. A makeup credit has been added to your account. Credits expire on 13 December.', suggestion: { kind: 'note', text: 'Makeup credit: book before 13 Dec' }, requester: 'K', status: 'new' },
  ];
}

export function createRota() {
  return {
    duties: [
      { id: 'd1', title: 'Triage captain', order: ['K', 'H', 'A1'], current: 0, note: 'Clears the queue each evening' },
      { id: 'd2', title: 'Set and clear the table', order: ['A2', 'A1'], current: 0, note: 'Swaps each week' },
      { id: 'd3', title: 'Saturday breakfast', order: ['H', 'A1', 'K'], current: 0, note: 'Whoever is on makes it for everyone' },
    ],
    overrides: [
      { id: 'o1', title: 'Collect {A2} from school', from: 'K', to: 'H', when: 'Fri 27 Nov only', reason: '{K} has an appointment at 1pm' },
    ],
  };
}

export function createProjects() {
  return [
    { id: 'p1', title: 'Secondary 3 subject choices for {A1}', owner: 'H', appetite: 'Two weekends', spent: 'One weekend', pos: 0.32, stuckDays: 9, unknown: 'Whether triple science fits with football and violin' },
    { id: 'p2', title: 'December trip', owner: 'K', appetite: 'Three evenings', spent: 'Two evenings', pos: 0.71, stuckDays: 0, unknown: null },
    { id: 'p3', title: 'Replace the aircon in the study', owner: 'H', appetite: 'One Saturday', spent: 'Not started', pos: 0.12, stuckDays: 14, unknown: 'Which contractor; two quotes still missing' },
  ];
}

export function createHousekeeping() {
  return {
    groceries: [
      { item: 'Greek yoghurt', by: 'A2' }, { item: 'Boot laces, black', by: 'A1' }, { item: 'Wrapping paper', by: 'K' },
    ],
    maintenance: [
      { title: 'Aircon servicing', owner: 'H', last: '14 weeks ago', every: 'About every 12 weeks', level: 'red' },
      { title: 'Water filter cartridge', owner: 'K', last: '5 months ago', every: 'About every 6 months', level: 'amber' },
      { title: 'Car servicing', owner: 'H', last: '4 months ago', every: 'Every 6 months', level: 'calm' },
    ],
  };
}

// Dinner: dishes, the week's plan, requests, and what is likely in the house.
// "bought" is a day number in the sample week; Monday is 0, so -3 is last Friday.
export function createDinner() {
  return {
    dishes: [
      { id: 'chicken-rice', name: 'Chicken rice', words: ['chicken rice'], needs: ['chicken', 'rice', 'cucumber', 'ginger', 'garlic'] },
      { id: 'bolognese', name: 'Pasta bolognese', words: ['bolognese', 'pasta', 'spaghetti'], needs: ['pasta', 'minced beef', 'tinned tomatoes', 'onion', 'garlic'] },
      { id: 'fried-rice', name: 'Egg fried rice', words: ['fried rice'], needs: ['rice', 'eggs', 'spring onion', 'frozen peas'] },
      { id: 'salmon', name: 'Baked salmon with greens', words: ['salmon', 'fish'], needs: ['salmon', 'broccoli', 'lemon', 'rice'] },
      { id: 'tofu', name: 'Tofu and vegetable stir fry', words: ['tofu', 'stir fry'], needs: ['tofu', 'broccoli', 'carrot', 'garlic', 'rice'] },
      { id: 'noodle-soup', name: 'Chicken noodle soup', words: ['noodle soup', 'noodles', 'soup'], needs: ['chicken', 'noodles', 'carrot', 'spring onion'] },
    ],
    plan: [
      { day: 0, cook: COOKS[0], dish: 'bolognese' },
      { day: 1, cook: COOKS[1], dish: 'chicken-rice' },
      { day: 2, cook: COOKS[2], dish: 'fried-rice' },
      { day: 3, cook: COOKS[3], dish: 'salmon' },
      { day: 4, cook: COOKS[4], dish: null },
    ],
    requests: [
      { id: 'r1', by: 'A2', day: 4, dish: 'noodle-soup', status: 'asked', reason: '' },
    ],
    pantry: [
      { key: 'rice', label: 'Jasmine rice', category: 'dry', bought: -20 },
      { key: 'pasta', label: 'Spaghetti', category: 'dry', bought: -30 },
      { key: 'tinned tomatoes', label: 'Tinned tomatoes', category: 'tinned', bought: -40 },
      { key: 'garlic', label: 'Garlic', category: 'roots', bought: -9 },
      { key: 'onion', label: 'Onions', category: 'roots', bought: -13 },
      { key: 'eggs', label: 'Eggs', category: 'eggs', bought: -9 },
      { key: 'frozen peas', label: 'Frozen peas', category: 'frozen', bought: -25 },
      { key: 'minced beef', label: 'Minced beef', category: 'frozen', bought: -2 },
      { key: 'chicken', label: 'Chicken thighs', category: 'fresh', bought: -2 },
      { key: 'cucumber', label: 'Cucumber', category: 'fresh', bought: -2 },
      { key: 'ginger', label: 'Ginger', category: 'roots', bought: -16 },
      { key: 'carrot', label: 'Carrots', category: 'roots', bought: -9 },
      { key: 'spring onion', label: 'Spring onions', category: 'fresh', bought: -9 },
      { key: 'milk', label: 'Milk', category: 'dairy', bought: -6 },
      { key: 'broccoli', label: 'Broccoli', category: 'fresh', bought: -9 },
    ],
    receipts: [
      {
        id: 'rc1', source: 'email', from: 'FairPrice online order', when: 'Delivered Mon 10:15am', read: false,
        text: 'FairPrice Online\nOrder delivered\nPasar Salmon Fillet 400g  1  $13.90\nBroccoli 300g  2  $5.00\nLemon 3s  1  $2.35\nMeiji Fresh Milk 2L  1  $6.45\nSilken Tofu 300g  2  $2.40\nSpring Onion 100g  1  $1.20\nDelivery fee  $3.99\nTotal  $35.29',
      },
      {
        id: 'rc2', source: 'image', from: 'Paper receipt (photo)', when: 'Sun 5:40pm', read: false,
        text: 'WET MARKET STALL 12\nEGGS TRAY 30  1  $7.50\nNOODLES FRESH 500G  1  $2.00\nCARROT 500G  1  $1.50\nTOTAL  $11.00',
      },
    ],
  };
}

// What happened in the four weeks before the sample week, as the portal would have logged it.
// Used only to notice repeats and offer to make them routines. All invented.
export function createLog() {
  const rows = [];
  const add = (key, title, who, owner, weekday, start, weeks) => { for (const w of weeks) rows.push({ key, title, who, owner, weekday, start, weeksAgo: w }); };
  add('football', '{A1}, football training', 'A1', 'H', 0, hm(16, 30), [1, 2, 3, 4]);
  add('piano', '{A2}, piano', 'A2', 'K', 0, hm(16), [1, 2, 3, 4]);
  add('gym', '{A2}, gymnastics', 'A2', 'K', 1, hm(16), [1, 2, 3]);
  add('violin', '{A1}, violin', 'A1', 'H', 3, hm(17), [1, 2, 3, 4]);
  add('netball', '{A2}, netball', 'A2', 'K', 4, hm(15), [1, 3]);
  add('basketball', '{A1}, basketball', 'A1', 'H', 2, hm(16), [1, 2]);
  return rows;
}

// Things the portal has been told. Sample entries, shown on the "What I know" screen.
export function createPrefs() {
  return [
    { id: 'pf1', about: 'K', text: 'No bookings before 9am on Saturdays', source: 'Told by {K}, 2 November' },
    { id: 'pf2', about: 'A1', text: 'Travels to football and basketball alone, by bus', source: 'Told by {H}, 9 November' },
    { id: 'pf3', about: 'A2', text: 'Is always collected from school by a parent', source: 'Told by {K}, 2 November' },
    { id: 'pf4', about: 'H', text: 'Drives at most 8 runs a week for other people', source: 'Set by {H} in the week view' },
  ];
}

// Dated things to renew or look after. Dates only: no document or card numbers are ever held.
// inDays counts from Monday of the sample week; needBy is when action is really needed, if sooner.
export function createExpiries() {
  return [
    { id: 'x1', kind: 'payment', title: 'Road tax', owner: 'H', inDays: 12, note: 'It can be renewed online' },
    { id: 'x2', kind: 'device', title: 'Phone backup', owner: 'K', inDays: -9, note: 'The last backup was 40 days ago' },
    { id: 'x3', kind: 'device', title: 'Kitchen tablet software update', owner: 'H', inDays: 3, note: 'Updates close security holes' },
    { id: 'x4', kind: 'payment', title: 'Streaming subscription renews', owner: 'K', inDays: 26, note: 'Decide whether to keep it' },
    { id: 'x5', kind: 'document', title: 'A passport', owner: 'K', inDays: 99, needBy: 10, note: 'Many countries ask for six months left, and the trip is in December' },
    { id: 'x6', kind: 'document', title: 'Home insurance', owner: 'H', inDays: 64, note: 'Compare before it renews by itself' },
  ];
}

// Each person's own choices about what the portal connects to.
// "wanted" records a preference for connections that wait for the server.
export function createConnections() {
  const base = () => ({ ics: { on: true, detail: 'full' }, whatsapp: { on: true }, feed: { wanted: false, detail: 'full' }, send: { wanted: false }, push: { wanted: false }, gcal: { wanted: false, direction: 'both', detail: 'full' } });
  const H = base(); H.feed.wanted = true; H.push.wanted = true; H.gcal.wanted = true; H.send.wanted = true;
  const K = base(); K.push.wanted = true; K.send.wanted = true; K.feed.wanted = true; K.feed.detail = 'busy';
  const A1 = base(); A1.push.wanted = true; A1.whatsapp.on = false;
  const A2 = base(); A2.ics.on = false; A2.whatsapp.on = false;
  return { H, K, A1, A2 };
}

// How far each automation is trusted. See app/js/engine/policy.js for the rules.
export function createAutomations() {
  return [
    { id: 'au1', action: 'remind', title: 'Remind the owner 30 minutes before a pickup', level: 'tell', accepted: 12 },
    { id: 'au2', action: 'escalate', title: 'Ask the other parent when a pickup is still unconfirmed', level: 'tell', accepted: 9 },
    { id: 'au3', action: 'list', title: "Add what tonight's dish is missing to the grocery list", level: 'ask', accepted: 5 },
    { id: 'au4', action: 'routine', title: 'Offer to make a repeat a routine', level: 'suggest', accepted: 1 },
    { id: 'au5', action: 'message', title: 'Draft the family group message when a plan changes', level: 'suggest', accepted: 6 },
    { id: 'au6', action: 'move', title: 'Hold dinner when someone is running late', level: 'suggest', accepted: 2 },
  ];
}

// Adventures: quests to work through together, and places the family has been.
// Every stop, date, rating and note below is invented and marked as a sample.
// What the family adds is kept on the device only, encrypted; it is never in this repo.
export function createAdventures() {
  const all = ['H', 'K', 'A1', 'A2'];
  return {
    sample: true,
    quests: [
      {
        id: 'q1', icon: 'bowl-food', title: 'Bak chor mee across the island', blurb: 'One bowl at a time. Everyone rates it out of five.',
        stops: [
          { id: 's1', place: 'Stall one (sample)', area: 'Bedok', done: true, day: -23, went: all, ratings: { H: 4, K: 3, A1: 5, A2: 4 }, note: 'Springy noodles; the queue was twenty minutes' },
          { id: 's2', place: 'Stall two (sample)', area: 'Tiong Bahru', done: true, day: -16, went: all, ratings: { H: 5, K: 4, A1: 4, A2: 4 }, note: 'More vinegar; soup on the side' },
          { id: 's3', place: 'Stall three (sample)', area: 'Hougang', done: true, day: -9, went: ['H', 'A1'], ratings: { H: 3, A1: 4 }, note: 'After the match; too much chilli for some' },
          { id: 's4', place: 'Stall four (sample)', area: 'Toa Payoh', done: false },
          { id: 's5', place: 'Stall five (sample)', area: 'Jurong East', done: false },
          { id: 's6', place: 'Stall six (sample)', area: 'Chinatown', done: false },
          { id: 's7', place: 'Stall seven (sample)', area: 'Ang Mo Kio', done: false },
          { id: 's8', place: 'Stall eight (sample)', area: 'Katong', done: false },
        ],
      },
      {
        id: 'q2', icon: 'compass', title: 'Walks worth the drive', blurb: 'Outdoor mornings, rated by how good the walk was.',
        stops: [
          { id: 'w1', place: 'A reservoir loop (sample)', area: 'Central', done: true, day: -30, went: all, ratings: { H: 4, K: 5, A1: 3, A2: 4 }, note: 'Monkeys on the boardwalk; start before eight' },
          { id: 'w2', place: 'A coastal boardwalk (sample)', area: 'North east', done: false },
          { id: 'w3', place: 'An island by bumboat (sample)', area: 'East', done: false },
          { id: 'w4', place: 'A wetland reserve (sample)', area: 'North west', done: false },
        ],
      },
    ],
    places: [
      { id: 'pl1', year: 2025, where: 'A long weekend by the sea (sample)', line: 'First trip with the snorkels' },
      { id: 'pl2', year: 2025, where: 'A city break (sample)', line: 'Three museums and one very long walk' },
      { id: 'pl3', year: 2024, where: 'A holiday in the hills (sample)', line: 'Cold enough for jackets' },
    ],
  };
}
