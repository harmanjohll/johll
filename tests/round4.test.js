import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sample from '../app/js/data/sample.js';
import { hm, abs, fmtDayDate } from '../app/js/engine/time.js';
import { buildCalendar, eventsFor, stamp, fold } from '../app/js/engine/ics.js';
import { checkScam, SCAM_EXAMPLES } from '../app/js/engine/scam.js';
import { startCheckin, arrive, isOverdue, overdueFor, activeBy, startWatch, watchState, dueWatches, GRACE_MIN } from '../app/js/engine/checkin.js';
import { ACTIONS, LEVELS, NEEDED, clamp, nextLevel, decide, ceiling, whyLocked } from '../app/js/engine/policy.js';
import { freeWindows, bestWindow } from '../app/js/engine/freetime.js';
import { brief } from '../app/js/engine/brief.js';
import { ask } from '../app/js/engine/ask.js';
import { nextStop, favourite, progress, average } from '../app/js/engine/adventures.js';

const commitments = () => sample.createCommitments();

test('dates: day numbers map to real dates beyond the sample week', () => {
  assert.equal(fmtDayDate(0), 'Mon 23 Nov');
  assert.equal(fmtDayDate(12), 'Sat 5 Dec');
  assert.equal(fmtDayDate(99), 'Tue 2 Mar 2027');
});

test('calendar file: Singapore times are written correctly in UTC', () => {
  assert.equal(stamp(0, hm(16)), '20261123T080000Z', '4pm in Singapore is 8am UTC');
  assert.equal(stamp(0, hm(6)), '20261122T220000Z', 'early morning falls on the previous UTC day');
  assert.equal(stamp(4, hm(21)), '20261127T130000Z');
});

test('calendar file: a valid file any calendar app can open', () => {
  const events = eventsFor(commitments(), 'K', (s) => s.replace(/\{A2\}/g, 'Annie').replace(/\{(\w+)\}/g, '$1'));
  const file = buildCalendar(events, { name: "K's week", now: { day: 0, minute: hm(12, 40) } });
  const lines = file.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines.at(-2), 'END:VCALENDAR');
  assert.equal(lines.at(-1), '', 'the file ends with a line break');
  assert.ok(!/[^\r]\n/.test(file), 'every line ends with a carriage return and line feed');
  assert.equal((file.match(/BEGIN:VEVENT/g) || []).length, events.length);
  assert.equal((file.match(/END:VEVENT/g) || []).length, events.length);
  for (const key of ['UID:', 'DTSTAMP:', 'DTSTART:', 'DTEND:', 'SUMMARY:']) assert.equal((file.match(new RegExp(`^${key}`, 'gm')) || []).length, events.length, `${key} once per event`);
  assert.ok(file.includes('DTSTART:20261123T080000Z\r\nDTEND:20261123T084500Z\r\nSUMMARY:Annie\\, piano'), 'piano is Monday 4pm to 4:45pm, and the comma is escaped');
  assert.ok(lines.every((l) => new TextEncoder().encode(l).length <= 75), 'no line is longer than 75 bytes');
  assert.ok(!/^SUMMARY:School$/m.test(file), 'school hours are left out');
});

test('calendar file: only your own commitments, and "busy" hides the details', () => {
  const mine = eventsFor(commitments(), 'A1');
  assert.ok(mine.every((e) => !e.title.includes('piano')), "A1's file does not carry A2's piano");
  assert.ok(mine.some((e) => e.id === 'violin-3' && /\{H\} drives/.test(e.notes)));
  assert.equal(mine.find((e) => e.id === 'violin-3').title, 'Violin', 'your own items drop your name');
  assert.equal(eventsFor(commitments(), 'H').find((e) => e.id === 'violin-3').title, '{A1}, violin', "someone else's keep theirs");
  const busy = buildCalendar(mine, { detail: 'busy' });
  assert.ok(!/violin|football|basketball|Strings Studio|LOCATION|DESCRIPTION/i.test(busy), 'nothing in a busy file says what the event is, not even its identifier');
  assert.equal((busy.match(/SUMMARY:Busy/g) || []).length, mine.length);
});

test('calendar file: long lines fold and continue with a space', () => {
  const folded = fold(`DESCRIPTION:${'x'.repeat(200)}`);
  const parts = folded.split('\r\n');
  assert.ok(parts.length >= 3);
  assert.ok(parts.slice(1).every((p) => p.startsWith(' ')));
  assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(''), `DESCRIPTION:${'x'.repeat(200)}`);
});

test('scam check: the common scam shapes are flagged, with a reason and a next step', () => {
  const [newNumber, bank, code, ordinary] = SCAM_EXAMPLES.map((e) => checkScam(e.text));
  assert.equal(newNumber.verdict, 'likely');
  assert.ok(newNumber.signs.some((s) => /new number/.test(s)));
  assert.equal(bank.verdict, 'likely');
  assert.ok(bank.signs.some((s) => /do not send links/.test(s)));
  assert.equal(code.verdict, 'likely', 'nobody honest asks for a one time code');
  assert.equal(ordinary.verdict, 'clear');
  for (const r of [newNumber, bank, code]) assert.ok(r.steps.some((s) => /1799/.test(s)), 'the helpline is given');
  assert.equal(checkScam('Part time job, earn $300 a day, message t.me/easyjobs').verdict, 'likely');
  assert.equal(checkScam('Please install this app and share your screen so I can fix your account').verdict, 'likely');
});

test('scam check: ordinary family messages are not flagged', () => {
  for (const text of [
    'Can you pay the piano fees today?',
    'What is the wifi password?',
    'Please transfer $20 to the coach for the jersey',
    "You won't believe how well the match went",
    'Come home right now, dinner is ready',
    'Meet me at the food court after violin',
    'I will work from home tomorrow',
    '',
  ]) assert.equal(checkScam(text).verdict, 'clear', text);
  assert.equal(checkScam('Urgent: transfer $50 for the school trip today').verdict, 'caution', 'money with pressure earns a pause, not an alarm');
  assert.ok(checkScam('hello').steps.some((s) => /only knows common patterns/.test(s)), 'a clear result still says what the check cannot see');
});

test('check in: the chosen person is told only if it runs overdue, and only them', () => {
  const now = abs(0, hm(18, 30));
  const c = startCheckin({ by: 'A1', to: 'K', label: 'Football to home', now, due: abs(0, hm(19)) });
  assert.deepEqual(activeBy([c], 'A1'), [c]);
  assert.equal(isOverdue(c, abs(0, hm(19))), false, 'on time is not overdue');
  assert.equal(isOverdue(c, abs(0, hm(19)) + GRACE_MIN), false, 'there is a short grace period');
  const late = abs(0, hm(19)) + GRACE_MIN + 1;
  assert.equal(isOverdue(c, late), true);
  assert.deepEqual(overdueFor([c], 'K', late), [c]);
  assert.deepEqual(overdueFor([c], 'H', late), [], 'the other parent is not told');
  assert.deepEqual(overdueFor([c], 'A1', late), []);
  assert.deepEqual(overdueFor([arrive(c, late)], 'K', late + 5), [], 'arriving ends it');
  assert.equal(c.status, 'active', 'arrive returns a new record and leaves the old one alone');
});

test('watch: a reminder that cancels itself when the thing is confirmed', () => {
  const list = commitments();
  const now = abs(0, hm(12, 40));
  const w = startWatch({ by: 'H', cid: 'pickup-0', at: abs(0, hm(13, 15)), now });
  assert.equal(watchState(w, list, now), 'waiting');
  assert.equal(watchState(w, list, abs(0, hm(13, 15))), 'due');
  assert.deepEqual(dueWatches([w], list, 'H', abs(0, hm(13, 20))), [w]);
  assert.deepEqual(dueWatches([w], list, 'K', abs(0, hm(13, 20))), [], 'only the person who asked');
  list.find((c) => c.id === 'pickup-0').ack = 'acked';
  assert.equal(watchState(w, list, abs(0, hm(13, 20))), 'cancelled', 'confirmed, so nothing is said');
  assert.deepEqual(dueWatches([w], list, 'H', abs(0, hm(13, 20))), []);
});

test('rules table: anything outward can never go above "ask"', () => {
  for (const [id, a] of Object.entries(ACTIONS)) {
    if (!a.outward) continue;
    assert.equal(ceiling(id), 'ask', id);
    assert.equal(clamp(id, 'tell'), 'ask', `${id} is pulled back to ask`);
    assert.equal(nextLevel(id, 'ask', 999), null, `${id} cannot be raised however often it is accepted`);
    assert.notEqual(decide(id, 'tell'), 'act', `${id} never acts alone`);
  }
});

test('rules table: trust is earned one step at a time', () => {
  assert.equal(nextLevel('list', 'ask', NEEDED - 1), null);
  assert.equal(nextLevel('list', 'ask', NEEDED), 'tell');
  assert.equal(nextLevel('list', 'suggest', NEEDED), 'ask', 'one step, never two');
  assert.equal(nextLevel('routine', 'ask', 50), null, 'a person always decides a routine');
  assert.match(whyLocked('move', 'ask', 50), /always needs a tap/);
  assert.match(whyLocked('list', 'ask', 2), /Accepted 2 of 5/);
  assert.deepEqual([decide('list', 'suggest'), decide('list', 'ask'), decide('list', 'tell')], ['offer', 'confirm', 'act']);
  assert.deepEqual(LEVELS, ['suggest', 'ask', 'tell']);
});

test('free time: windows when everyone is free, and the best one for an outing', () => {
  const list = commitments();
  const all = ['H', 'K', 'A1', 'A2'];
  assert.deepEqual(freeWindows(list, all, 5), [{ day: 5, from: hm(17, 25), to: hm(21) }], 'Saturday is full until the playdate run ends');
  assert.deepEqual(freeWindows(list, ['A1'], 5), [{ day: 5, from: hm(11), to: hm(21) }]);
  assert.equal(freeWindows(list, all, 6).length, 3, 'Sunday has three gaps around lunch and the family sync');
  const best = bestWindow(list, all, [5, 6]);
  assert.deepEqual([best.day, best.from, best.to], [5, hm(17, 30), hm(21)], 'Saturday evening, rounded to the half hour, covers dinner');
  assert.equal(bestWindow(list, all, [0], { min: 180 }), null, 'a school day has no long shared window');
});

const world = (now = abs(0, hm(12, 40))) => ({
  members: sample.createMembers(), cars: sample.createCars(), contracts: sample.createContracts(), commitments: sample.createCommitments(),
  triage: sample.createTriage(), rota: sample.createRota(), dinner: sample.createDinner(), house: sample.createHousekeeping(),
  tasks: [], swaps: {}, log: [], routines: [], routinesDeclined: [], later: [], handoffRead: true,
  expiries: sample.createExpiries(), adventures: sample.createAdventures(), checkins: [], watches: [], now,
});
const kinds = (w, v) => brief(w, v).cards.map((c) => c.kind);

test('adventures: progress, the running favourite and the next stop', () => {
  const adv = sample.createAdventures();
  const quest = adv.quests[0];
  assert.deepEqual(progress(quest), { done: 3, total: 8 });
  assert.equal(average(quest.stops[0]), 4);
  assert.equal(favourite(quest).id, 's2', 'the best average so far');
  assert.equal(nextStop(adv).stop.id, 's4');
  assert.ok(adv.sample && quest.stops.every((x) => /\(sample\)/.test(x.place)), 'every published stop is marked as a sample');
});

test('home: dated things reach their owner, and only when they are close', () => {
  const h = brief(world(), 'H').cards.filter((c) => c.kind === 'expiry').map((c) => c.title);
  assert.deepEqual([...h].sort(), ['Kitchen tablet software update: due Thu 26 Nov', 'Road tax: due Sat 5 Dec'], "both of H's near items show");
  assert.ok(!h.some((t) => /insurance/i.test(t)), 'something 64 days away stays quiet');
  const k = brief(world(), 'K').cards.filter((c) => c.kind === 'expiry');
  assert.ok(k.some((c) => c.title === 'Phone backup is overdue'));
  const passport = k.find((c) => /passport/.test(c.title));
  assert.equal(passport.title, 'A passport expires on Tue 2 Mar 2027');
  assert.match(passport.why, /six months left/, 'it is raised early because of the trip, with the reason');
  assert.ok(!k.some((c) => /Streaming/.test(c.title)));
  assert.ok(!kinds(world(), 'A1').includes('expiry'));
});

test('home: an outing is offered to the parents when everyone is free, and never twice', () => {
  const w = world();
  const card = brief(w, 'H').cards.at(-1);
  assert.equal(card.kind, 'adventure', 'it is always the lowest priority');
  assert.match(card.title, /Saturday from 5:30pm is free for everyone\. Next on the quest: Stall four \(sample\), Toa Payoh/);
  assert.ok(kinds(w, 'K').includes('adventure'));
  assert.ok(!kinds(w, 'A1').includes('adventure'), 'children are not asked to plan it');
  w.commitments.push({ ...w.commitments.find((c) => c.id === 'lunch-6'), id: 'quest-s4', questStop: 's4', day: 5, start: hm(18), end: hm(19, 30) });
  assert.ok(!kinds(w, 'H').includes('adventure'), 'once planned, it is not offered again');
});

test('home: an overdue check in reaches only the person chosen', () => {
  const w = world(abs(0, hm(19, 20)));
  w.checkins = [startCheckin({ by: 'A1', to: 'K', label: 'Football to home', now: abs(0, hm(18, 30)), due: abs(0, hm(19)) })];
  const k = brief(w, 'K').cards[0];
  assert.equal(k.kind, 'checkin');
  assert.match(k.title, /\{A1\} has not checked in: football to home, expected by 7pm/);
  assert.match(k.why, /Nobody is being tracked/);
  assert.ok(!kinds(w, 'H').includes('checkin'), 'the other parent is not told');
  const mine = brief(w, 'A1').cards.find((c) => c.kind === 'checkin');
  assert.match(mine.why, /\{K\} has been told/, 'the person travelling sees that it has gone out');
  const early = world(abs(0, hm(18, 40)));
  early.checkins = w.checkins;
  assert.ok(!kinds(early, 'K').includes('checkin'), 'before the time, the chosen person hears nothing');
  assert.match(brief(early, 'A1').cards.find((c) => c.kind === 'checkin').why, /only if you are overdue/);
});

test('home: a watch stays silent unless the thing is still open at its time', () => {
  const w = world(abs(0, hm(13, 16)));
  w.watches = [startWatch({ by: 'A1', cid: 'pickup-0', at: abs(0, hm(13, 15)), now: abs(0, hm(12, 40)) })];
  const card = brief(w, 'A1').cards.find((c) => c.kind === 'watch');
  assert.match(card.why, /You asked to be told at 1:15pm/);
  assert.deepEqual(card.actions.map((a) => a.label), ['Dismiss'], 'a child is not offered the pickup itself');
  w.watches = [startWatch({ by: 'H', cid: 'pickup-0', at: abs(0, hm(13, 15)), now: abs(0, hm(12, 40)) })];
  const h = brief(w, 'H').cards;
  assert.equal(h.filter((c) => c.id === 'ack-pickup-0').length, 1, 'one card, not two, for the same pickup');
  assert.match(h[0].why, /You asked to be told at 1:15pm/);
  w.commitments.find((c) => c.id === 'pickup-0').ack = 'acked';
  assert.ok(!brief(w, 'H').cards.some((c) => /pickup-0/.test(c.id)), 'confirmed, so nothing is shown');
});

test('ask: watches, the scam check, the calendar file, arriving and the next stop', () => {
  const say = (text, v = 'H', w = world()) => ask(text, w, v);
  const watch = say('remind me at 1:15pm if nobody has confirmed the pickup');
  assert.deepEqual(watch.do, { type: 'watch', cid: 'pickup-0', at: abs(0, hm(13, 15)) });
  assert.match(watch.text, /If someone confirms first, you will hear nothing/);
  assert.match(say('remind me at 11am if nobody has confirmed').text, /already passed/);
  const scam = say('Is this a scam: Hi Mum this is my new number, please transfer $500 now, urgent');
  assert.equal(scam.kind, 'answer');
  assert.match(scam.text, /looks like a scam/);
  assert.ok(scam.bullets.some((b) => /1799/.test(b)));
  assert.match(scam.note, /not an AI/);
  assert.deepEqual(say('is this a scam?').do, { type: 'go', route: 'safety' });
  assert.deepEqual(say('add my week to my calendar').do, { type: 'ics' });
  assert.equal(say('I am home').kind, 'answer', 'with no check in running, it says so');
  const w = world();
  w.checkins = [startCheckin({ by: 'A1', to: 'K', label: 'Football to home', now: w.now, due: abs(0, hm(19)) })];
  assert.equal(say('I am home', 'A1', w).do.type, 'arrive');
  assert.match(say('what is the next stop on the quest').text, /Stall four \(sample\), Toa Payoh\. Saturday from 5:30pm is free for everyone/);
  assert.deepEqual(say('open safety').do, { type: 'go', route: 'safety' });
});
