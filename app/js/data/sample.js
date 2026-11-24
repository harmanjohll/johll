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
      { title: 'Passports', owner: 'K', last: 'One expires in March', every: 'Renew before the December trip', level: 'amber' },
    ],
  };
}

// Dinner: dishes, the week's plan, requests, and what is likely in the house.
// "bought" is a day number in the sample week; Monday is 0, so -3 is last Friday.
export function createDinner() {
  return {
    dishes: [
      { id: 'chicken-rice', name: 'Chicken rice', needs: ['chicken', 'rice', 'cucumber', 'ginger', 'garlic'] },
      { id: 'bolognese', name: 'Pasta bolognese', needs: ['pasta', 'minced beef', 'tinned tomatoes', 'onion', 'garlic'] },
      { id: 'fried-rice', name: 'Egg fried rice', needs: ['rice', 'eggs', 'spring onion', 'frozen peas'] },
      { id: 'salmon', name: 'Baked salmon with greens', needs: ['salmon', 'broccoli', 'lemon', 'rice'] },
      { id: 'tofu', name: 'Tofu and vegetable stir fry', needs: ['tofu', 'broccoli', 'carrot', 'garlic', 'rice'] },
      { id: 'noodle-soup', name: 'Chicken noodle soup', needs: ['chicken', 'noodles', 'carrot', 'spring onion'] },
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
      { key: 'onion', label: 'Onions', category: 'roots', bought: -9 },
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
