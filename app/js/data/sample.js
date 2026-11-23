// A fictional household and one school week. Every name here is invented.
// Nothing in this file describes a real family.

import { hm } from '../engine/time.js';

export const TIERS = ['ambient', 'digest', 'nudge', 'interrupt'];

export function createMembers() {
  return [
    { id: 'wei', name: 'Wei', role: 'parent', label: 'Dad', adult: true, drives: true, device: true, maxLegs: 8, hue: 'wei' },
    { id: 'priya', name: 'Priya', role: 'parent', label: 'Mum', adult: true, drives: true, device: true, maxLegs: 8, hue: 'priya' },
    { id: 'kai', name: 'Kai', role: 'child', label: '14', adult: false, drives: false, device: true, maxLegs: 0, hue: 'kai' },
    { id: 'maya', name: 'Maya', role: 'child', label: '11', adult: false, drives: false, device: true, maxLegs: 0, hue: 'maya' },
    { id: 'leo', name: 'Leo', role: 'child', label: '7', adult: false, drives: false, device: false, maxLegs: 0, hue: 'leo' },
    { id: 'rosa', name: 'Rosa', role: 'helper', label: 'Helper', adult: true, drives: false, device: true, maxLegs: 0, hue: 'rosa' },
    { id: 'nani', name: 'Nani', role: 'grandparent', label: 'Grandmother', adult: true, drives: true, device: true, maxLegs: 4, hue: 'nani' },
  ];
}

export function createCars() {
  return [
    { id: 'car1', name: 'Family car', drivers: ['wei', 'priya'] },
    { id: 'car2', name: "Nani's car", drivers: ['nani'] },
  ];
}

// Each person's notification contract. The receiver decides delivery.
export function createContracts() {
  return {
    wei: { quiet: [hm(22, 30), hm(6, 30)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [{ target: 'leo', tier: 'digest' }, { target: 'activity:football', tier: 'digest' }] },
    priya: { quiet: [hm(22), hm(6)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [{ target: 'leo', tier: 'nudge' }, { target: 'maya', tier: 'digest' }] },
    kai: { quiet: [hm(21, 30), hm(6, 30)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [] },
    maya: { quiet: [hm(20, 30), hm(6, 30)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [] },
    leo: { quiet: [hm(20), hm(6, 30)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [] },
    rosa: { quiet: [hm(21), hm(6)], digestTimes: [hm(7), hm(15), hm(20)], lower: null, follows: [{ target: 'leo', tier: 'nudge' }] },
    // Nani prefers one digest in the evening. Only requests that need her answer reach her sooner.
    nani: { quiet: [hm(21), hm(7)], digestTimes: [hm(19)], lower: 'digest', follows: [{ target: 'leo', tier: 'digest' }, { target: 'maya', tier: 'digest' }, { target: 'kai', tier: 'digest' }] },
  };
}

export function createActivities() {
  return [
    { id: 'football', name: 'Football, Eastside Juniors', who: 'kai', owner: 'wei', provider: 'Eastside Juniors FC', contact: 'Coach Farid', term: 'Season 2, ends 12 December', fee: 'Paid', kit: ['Boots', 'Shin guards', 'Water bottle'], makeups: null, renewal: { due: 'Fri 4 Dec', note: 'Season 3 registration' }, told: 'Coach WhatsApp group' },
    { id: 'piano', name: 'Piano, Grade 4', who: 'maya', owner: 'priya', provider: 'Kembangan Music Studio', contact: 'Ms Tan', term: 'Term 4, ends 18 December', fee: 'Due Tue 1 Dec', kit: ['Grade 4 books', 'Theory workbook'], makeups: { left: 1, of: 2, expires: 'Fri 18 Dec' }, renewal: { due: 'Tue 1 Dec', note: 'Term 1 fees, two weeks before term' }, told: 'Email' },
    { id: 'swim', name: 'Swimming, Stage 3', who: 'leo', owner: 'nani', provider: 'Bedok Swim School', contact: 'Coach Lin', term: 'Block of 10, lesson 7 of 10', fee: 'Paid', kit: ['Swim bag', 'Goggles', 'Towel'], makeups: { left: 2, of: 3, expires: 'Sun 13 Dec' }, renewal: { due: 'Fri 11 Dec', note: 'Next block of 10' }, told: 'App' },
    { id: 'maths', name: 'Maths tuition', who: 'maya', owner: 'priya', provider: 'Number Sense Centre', contact: 'Mr Goh', term: 'Term 4, ends 11 December', fee: 'Paid', kit: ['Worksheets file'], makeups: { left: 3, of: 3, expires: 'Fri 11 Dec' }, renewal: { due: 'Fri 27 Nov', note: 'Withdrawal notice is four weeks' }, told: 'Email' },
    { id: 'art', name: 'Art class', who: 'maya', owner: 'priya', provider: 'Little Easel', contact: 'Ms Devi', term: 'Term 4, ends 17 December', fee: 'Paid', kit: ['Apron', 'Sketchbook'], makeups: { left: 0, of: 2, expires: 'Thu 17 Dec' }, renewal: { due: 'Thu 3 Dec', note: 'Term 1 place held until then' }, told: 'Parents WhatsApp group' },
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

export function createCommitments() {
  seq = 0;
  const list = [];

  // School, Monday to Friday.
  for (let day = 0; day < 5; day += 1) {
    list.push(c({ id: `school-kai-${day}`, title: 'School', type: 'school', day, start: hm(7, 30), end: hm(14), people: ['kai'], owner: 'kai', place: 'Secondary school' }));
    list.push(c({ id: `school-maya-${day}`, title: 'School', type: 'school', day, start: hm(7, 30), end: hm(13, 30), people: ['maya'], owner: 'maya', place: 'Primary school' }));
    list.push(c({ id: `school-leo-${day}`, title: 'School', type: 'school', day, start: hm(7, 30), end: hm(13, 30), people: ['leo'], owner: 'leo', place: 'Primary school' }));
    list.push(c({ id: `pickup-leo-${day}`, title: 'Collect Leo from school', type: 'pickup', day, start: hm(13, 30), end: hm(13, 50), people: ['leo', 'rosa'], owner: 'rosa', backup: ['priya', 'wei'], place: 'School gate B', ack: 'pending' }));
    list.push(c({ id: `dinner-${day}`, title: 'Family dinner', type: 'meal', day, start: hm(19), end: hm(19, 45), people: (day === 4 ? ['priya', 'kai', 'maya', 'leo', 'nani'] : ['wei', 'priya', 'kai', 'maya', 'leo', 'nani']), owner: 'rosa', soft: true, fixed: false, hardensAt: hm(16), place: 'Home' }));
  }

  // Monday
  list.push(c({ id: 'piano-0', title: 'Maya, piano', day: 0, start: hm(16), end: hm(17), people: ['maya'], owner: 'priya', driver: 'priya', car: 'car1', legs: 'both', activity: 'piano', place: 'Kembangan Music Studio', needs: [{ kind: 'kit', label: 'Grade 4 books', done: true }] }));
  list.push(c({ id: 'football-0', title: 'Kai, football training', day: 0, start: hm(16, 30), end: hm(18, 30), people: ['kai'], owner: 'kai', activity: 'football', place: 'Bedok Stadium', needs: [{ kind: 'kit', label: 'Boots and shin guards', done: false }] }));
  list.push(c({ id: 'work-wei-0', title: 'Wei, client meeting', type: 'work', day: 0, start: hm(17), end: hm(18, 30), people: ['wei'], owner: 'wei', place: 'Office' }));

  // Tuesday
  list.push(c({ id: 'maths-1', title: 'Maya, maths tuition', day: 1, start: hm(15, 30), end: hm(17), people: ['maya'], owner: 'priya', driver: 'priya', car: 'car1', legs: 'both', activity: 'maths', place: 'Number Sense Centre', needs: [{ kind: 'kit', label: 'Worksheets file', done: false }] }));
  list.push(c({ id: 'swim-1', title: 'Leo, swimming', day: 1, start: hm(17), end: hm(18), people: ['leo'], owner: 'nani', driver: 'nani', car: 'car2', legs: 'both', activity: 'swim', place: 'Bedok Swim School', needs: [{ kind: 'kit', label: 'Swim bag', done: false }] }));
  list.push(c({ id: 'lab-1', title: 'Kai, Science Lab session', type: 'study', day: 1, start: hm(20), end: hm(20, 25), people: ['kai'], owner: 'kai', place: 'Home', fixed: false }));

  // Wednesday
  list.push(c({ id: 'clinic-nani', title: 'Nani, polyclinic review', type: 'medical', day: 2, start: hm(10), end: hm(11), people: ['nani'], owner: 'nani', driver: 'nani', car: 'car2', legs: 'both', place: 'Bedok Polyclinic', needs: [{ kind: 'form', label: 'Appointment card', done: true }] }));
  list.push(c({ id: 'dentist', title: 'Leo, dentist', type: 'medical', day: 2, start: hm(15), end: hm(16), people: ['leo'], owner: 'priya', driver: 'priya', car: 'car1', legs: 'both', place: 'Smile Dental, Siglap', needs: [{ kind: 'form', label: 'Dental card', done: false }], fixed: false }));
  list.push(c({ id: 'football-2', title: 'Kai, football training', day: 2, start: hm(16, 30), end: hm(18, 30), people: ['kai'], owner: 'kai', activity: 'football', place: 'Bedok Stadium', needs: [{ kind: 'kit', label: 'Boots and shin guards', done: false }] }));

  // Thursday
  list.push(c({ id: 'work-priya-3', title: 'Priya, school board meeting', type: 'work', day: 3, start: hm(14), end: hm(15, 15), people: ['priya'], owner: 'priya', place: 'Online' }));
  list.push(c({ id: 'art-3', title: 'Maya, art class', day: 3, start: hm(16), end: hm(17, 30), people: ['maya'], owner: 'priya', driver: 'priya', car: 'car1', legs: 'both', activity: 'art', place: 'Little Easel', needs: [{ kind: 'kit', label: 'Apron and sketchbook', done: false }] }));
  list.push(c({ id: 'match-3', title: 'Kai, away match', day: 3, start: hm(16, 30), end: hm(18, 30), people: ['kai'], owner: 'wei', driver: 'wei', car: 'car1', legs: 'both', activity: 'football', place: 'Jurong East Stadium', needs: [{ kind: 'kit', label: 'Away kit', done: false }, { kind: 'form', label: 'Consent form on Parents Gateway', done: false }] }));

  // Friday
  list.push(c({ id: 'work-wei-4', title: 'Wei, day trip to Kuala Lumpur', type: 'work', day: 4, start: hm(6), end: hm(22), people: ['wei'], owner: 'wei', place: 'Kuala Lumpur' }));
  list.push(c({ id: 'maths-4', title: 'Maya, maths tuition', day: 4, start: hm(15, 30), end: hm(17), people: ['maya'], owner: 'priya', driver: 'priya', car: 'car1', legs: 'both', activity: 'maths', place: 'Number Sense Centre' }));
  list.push(c({ id: 'swim-4', title: 'Leo, swimming', day: 4, start: hm(17), end: hm(18), people: ['leo'], owner: 'nani', driver: 'nani', car: 'car2', legs: 'both', activity: 'swim', place: 'Bedok Swim School', needs: [{ kind: 'kit', label: 'Swim bag', done: false }] }));

  // Saturday
  list.push(c({ id: 'match-5', title: 'Kai, league match', day: 5, start: hm(9), end: hm(11), people: ['kai'], owner: 'wei', driver: 'wei', car: 'car1', legs: 'both', activity: 'football', place: 'Bedok Stadium', needs: [{ kind: 'kit', label: 'Home kit', done: false }] }));
  list.push(c({ id: 'party-5', title: "Leo, Arjun's birthday party", type: 'social', day: 5, start: hm(15), end: hm(17), people: ['leo'], owner: 'priya', driver: 'priya', car: 'car1', legs: 'both', place: 'East Coast Park, Area C', needs: [{ kind: 'gift', label: 'Buy and wrap a gift', done: false }] }));
  list.push(c({ id: 'groceries-5', title: 'Weekly groceries', type: 'errand', day: 5, start: hm(12), end: hm(13, 15), people: ['rosa', 'priya'], owner: 'rosa', driver: 'priya', car: 'car1', legs: 'both', place: 'FairPrice, Bedok Mall', fixed: false }));

  // Sunday
  list.push(c({ id: 'rest-rosa', title: 'Rosa, rest day', type: 'rest', day: 6, start: hm(0), end: hm(23, 59), people: ['rosa'], owner: 'rosa', place: '' }));
  list.push(c({ id: 'lunch-6', title: "Lunch at Nani's", type: 'meal', day: 6, start: hm(12), end: hm(14), people: ['wei', 'priya', 'kai', 'maya', 'leo', 'nani'], owner: 'nani', place: "Nani's flat" }));
  list.push(c({ id: 'sync-6', title: 'Family sync', type: 'meal', day: 6, start: hm(17), end: hm(17, 15), people: ['wei', 'priya', 'kai', 'maya', 'leo'], owner: 'priya', place: 'Home', soft: true, fixed: false, hardensAt: hm(12) }));

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
    { id: 't1', source: 'email', from: 'Number Sense Centre', received: 'Mon 8:12am', title: 'Term 1 timetable and fees', body: 'Maths tuition moves to Wednesdays, 4pm to 5:30pm, from 6 January. Fees are due two weeks before term.', suggestion: { kind: 'commitment', text: 'Maya, maths tuition Wed 4pm from 6 Jan' }, requester: 'priya', status: 'new' },
    { id: 't2', source: 'image', from: 'Parents Gateway (screenshot from Rosa)', received: 'Mon 9:40am', title: 'Consent form: Primary 2 learning journey', body: 'Learning journey to the Science Centre on Tue 1 December. Consent needed by Thu 26 November. One parent replies; the answer is final.', suggestion: { kind: 'task', text: 'Reply to consent form by Thu' }, requester: 'rosa', status: 'new' },
    { id: 't3', source: 'voice', from: 'Kai (voice note, 0:14)', received: 'Mon 12:05pm', title: 'Need $40 for the team jersey', body: 'Coach says the new away jersey is forty dollars, cash, by Thursday training.', suggestion: { kind: 'task', text: 'Give Kai $40 by Thu' }, requester: 'kai', status: 'new' },
    { id: 't4', source: 'typed', from: 'Rosa', received: 'Sun 6:30pm', title: 'Kitchen tap is dripping', body: 'The mixer tap drips when closed. Getting worse this week.', suggestion: { kind: 'task', text: 'Call the plumber' }, requester: 'rosa', status: 'new', carried: 1 },
    { id: 't5', source: 'email', from: 'Bedok Swim School', received: 'Sat 4:02pm', title: 'Pool closed on Fri 4 December', body: 'The pool is closed for maintenance. A makeup credit has been added to your account. Credits expire on 13 December.', suggestion: { kind: 'note', text: 'Makeup credit: book before 13 Dec' }, requester: 'nani', status: 'new' },
  ];
}

export function createRota() {
  return {
    captain: { order: ['priya', 'wei', 'rosa', 'kai'], current: 0 },
    duties: [
      { id: 'd1', title: 'Triage captain', order: ['priya', 'wei', 'rosa', 'kai'], current: 0, note: 'Clears the queue each evening' },
      { id: 'd2', title: 'Bins and recycling', order: ['kai', 'maya'], current: 0, note: 'Tue and Fri evenings' },
      { id: 'd3', title: 'Saturday breakfast', order: ['wei', 'kai', 'priya'], current: 2, note: 'Rosa starts late on Saturdays' },
    ],
    overrides: [
      { id: 'o1', title: 'Collect Leo from school', from: 'rosa', to: 'nani', when: 'Fri 27 Nov only', reason: 'Rosa has a clinic appointment at 1pm' },
    ],
  };
}

export function createProjects() {
  return [
    { id: 'p1', title: 'Secondary 3 subject choices for Kai', owner: 'wei', appetite: 'Two weekends', spent: 'One weekend', pos: 0.32, stuckDays: 9, unknown: 'Whether triple science fits with football' },
    { id: 'p2', title: 'December trip to Penang', owner: 'priya', appetite: 'Three evenings', spent: 'Two evenings', pos: 0.71, stuckDays: 0, unknown: null },
    { id: 'p3', title: 'Replace the aircon in the study', owner: 'wei', appetite: 'One Saturday', spent: 'Not started', pos: 0.12, stuckDays: 14, unknown: 'Which contractor; two quotes still missing' },
  ];
}

export function createHousekeeping() {
  return {
    groceries: [
      { item: 'Rice, 5 kg', by: 'rosa' }, { item: 'Eggs, tray of 30', by: 'rosa' }, { item: 'Greek yoghurt', by: 'maya' },
      { item: 'Boot laces, black', by: 'kai' }, { item: 'Wrapping paper', by: 'priya' },
    ],
    maintenance: [
      { title: 'Aircon servicing', owner: 'wei', last: '14 weeks ago', every: 'About every 12 weeks', level: 'red' },
      { title: 'Water filter cartridge', owner: 'rosa', last: '5 months ago', every: 'About every 6 months', level: 'amber' },
      { title: 'Car servicing, family car', owner: 'wei', last: '4 months ago', every: 'Every 6 months', level: 'calm' },
      { title: "Kai's passport", owner: 'priya', last: 'Expires 2 March 2027', every: 'Renew before the December trip', level: 'amber' },
    ],
  };
}
