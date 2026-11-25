import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sample from '../app/js/data/sample.js';
import { hm, abs, fmtDayDate } from '../app/js/engine/time.js';
import { buildCalendar, eventsFor, stamp, fold } from '../app/js/engine/ics.js';
import { checkScam, SCAM_EXAMPLES } from '../app/js/engine/scam.js';
import { startCheckin, arrive, isOverdue, overdueFor, activeBy, startWatch, watchState, dueWatches, GRACE_MIN } from '../app/js/engine/checkin.js';
import { ACTIONS, LEVELS, NEEDED, clamp, nextLevel, decide, ceiling, whyLocked } from '../app/js/engine/policy.js';
import { freeWindows, bestWindow } from '../app/js/engine/freetime.js';

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
