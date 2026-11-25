import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sample from '../app/js/data/sample.js';
import { hm, abs } from '../app/js/engine/time.js';
import { findClashes, legsOf } from '../app/js/engine/clash.js';
import { drivingLoad, dayPressure } from '../app/js/engine/load.js';
import { eligibleDrivers } from '../app/js/engine/swap.js';
import { route, nextDigest, inQuiet } from '../app/js/engine/route.js';
import { escalationTimeline } from '../app/js/engine/escalate.js';
import { propose, applyPatches, openSlots } from '../app/js/engine/ripple.js';
import { parseCapture } from '../app/js/engine/parse.js';
import { runScenario } from '../app/js/engine/simulate.js';
import { confidence, levelOf, checkDish, parseReceipt, addToPantry } from '../app/js/engine/pantry.js';

const household = () => ({
  commitments: sample.createCommitments(),
  members: sample.createMembers(),
  cars: sample.createCars(),
  contracts: sample.createContracts(),
  playbooks: sample.PLAYBOOKS,
});
const THU_5PM = { day: 3, start: hm(17), end: hm(18) };

test('the sample week starts with no clashes', () => {
  assert.deepEqual(findClashes(household().commitments), []);
});

test('a commitment with a driver has a drop leg and a pick leg', () => {
  const c = household().commitments.find((x) => x.id === 'piano-0');
  const legs = legsOf(c);
  assert.equal(legs.length, 2);
  assert.equal(legs[0].from, abs(0, hm(15, 35)));
  assert.equal(legs[1].to, abs(0, hm(17, 10)));
});

test('moving the dentist to Thursday 5pm needs the one car in two places', () => {
  const h = household();
  const clashes = findClashes(applyPatches(h.commitments, [{ cid: 'dentist', patch: THU_5PM }]));
  assert.ok(clashes.length > 0);
  assert.ok(clashes.every((k) => k.kind === 'car' && k.who === 'car1'), 'both parents are free; only the car is short');
  assert.ok(clashes.every((k) => [k.a, k.b].includes('violin-3')));
});

test('a soft block is a soft clash until it hardens', () => {
  const h = household();
  const after = applyPatches(h.commitments, [{ cid: 'football-0', patch: { end: hm(19, 30) } }]);
  assert.equal(findClashes(after, abs(0, hm(9))).find((k) => k.who === 'A1').severity, 'soft');
  assert.equal(findClashes(after, abs(0, hm(16, 30))).find((k) => k.who === 'A1').severity, 'hard');
});

test('with one car, the ripple offers a taxi and blocks until cover is chosen', () => {
  const h = household();
  const open = propose(h, { cid: 'dentist', by: 'K', patch: THU_5PM });
  assert.equal(open.blocked, true);
  const group = open.groups.find((g) => g.commitment.id === 'violin-3');
  assert.equal(group.kind, 'driver');
  const self = group.options.find((o) => o.id === 'H');
  const swap = group.options.find((o) => o.id === 'K');
  assert.deepEqual([self.ok, self.taxi, self.self], [true, true, true], 'the current driver can keep the run by taxi');
  assert.equal(swap.ok, false, 'the other parent is driving to the dentist');
  const chosen = propose(h, { cid: 'dentist', by: 'K', patch: THU_5PM, choices: { 'violin-3': 'H' } });
  assert.equal(chosen.blocked, false);
  assert.deepEqual(findClashes(chosen.afterAll), []);
  assert.equal(chosen.afterAll.find((c) => c.id === 'violin-3').car, null, 'a taxi run uses no car');
  assert.ok(chosen.affected.some((a) => a.id === 'H' && a.needsAnswer));
  assert.ok(chosen.tasks.some((t) => t.title.startsWith('Confirm the new time')));
});

test('one owner: a change proposed by someone else needs the owner to agree', () => {
  const h = household();
  const byOwner = propose(h, { cid: 'dentist', by: 'K', patch: { day: 2, start: hm(16, 30), end: hm(17, 30) } });
  const byOther = propose(h, { cid: 'dentist', by: 'H', patch: { day: 2, start: hm(16, 30), end: hm(17, 30) } });
  assert.equal(byOwner.affected.find((a) => a.id === 'K').needsAnswer, false);
  assert.equal(byOther.affected.find((a) => a.id === 'K').needsAnswer, true);
});

test('a proposal never changes the household it was computed from', () => {
  const h = household();
  const snapshot = JSON.stringify(h.commitments);
  propose(h, { cid: 'dentist', by: 'K', patch: THU_5PM, choices: { 'violin-3': 'H' } });
  assert.equal(JSON.stringify(h.commitments), snapshot);
});

test('engine text names people by token, never by name', () => {
  const p = propose(household(), { cid: 'dentist', by: 'K', patch: THU_5PM, choices: { 'violin-3': 'H' } });
  assert.match(p.groupDraft, /\{A2\}'s dentist moves from Wed 3pm to Thu 5pm/);
  assert.match(p.groupDraft, /\{H\} goes by taxi/);
});

test('a medical appointment in school hours creates a note to the school, not a clash', () => {
  const p = propose(household(), { cid: 'dentist', by: 'K', patch: { day: 2, start: hm(10), end: hm(11) } });
  assert.equal(p.schoolNote, true);
  assert.ok(p.tasks.some((t) => t.title.includes('school office')));
  assert.ok(!p.groups.some((g) => g.commitment.type === 'school'));
});

test('open slots exclude times that would clash', () => {
  const slots = openSlots(household(), 'dentist', 3);
  assert.ok(!slots.includes(hm(17)), 'the car is at violin');
  assert.ok(!slots.includes(hm(15)), 'K is in a meeting until 3:15pm');
  assert.ok(openSlots(household(), 'dentist', 2).includes(hm(16, 30)), 'later on Wednesday is free');
});

test('cover: the other parent with the car, or by taxi when the car is out', () => {
  const h = household();
  const free = eligibleDrivers(h.commitments, h.members, h.cars, 'violin-3');
  assert.deepEqual(free.map((o) => [o.id, o.ok, o.taxi]), [['K', true, false]]);
  const after = applyPatches(h.commitments, [{ cid: 'dentist', patch: { day: 0, start: hm(16), end: hm(17) }, }, { cid: 'dentist', patch: { day: 0, start: hm(16), end: hm(17), driver: 'H' } }]);
  const taxi = eligibleDrivers(after, h.members, h.cars, 'piano-0').find((o) => o.id === 'H');
  assert.equal(taxi.ok, false, 'H is now driving to the dentist at that time');
});

test('driving load counts runs for other people and flags the overloaded', () => {
  const h = household();
  const load = drivingLoad(h.commitments, h.members);
  assert.equal(load.K.legs, 10, 'the grocery trip K makes alone is not counted');
  assert.equal(load.K.over, true);
  assert.equal(load.H.legs, 4);
  assert.equal(load.H.over, false);
});

test('a day with a hard clash is red', () => {
  const h = household();
  const after = applyPatches(h.commitments, [{ cid: 'dentist', patch: THU_5PM }]);
  assert.equal(dayPressure(after, h.members, h.cars)[3].level, 'red');
  assert.notEqual(dayPressure(h.commitments, h.members, h.cars)[3].level, 'red');
});

test('quiet hours wrap past midnight and digests roll to the next day', () => {
  const c = sample.createContracts().H;
  assert.equal(inQuiet(c, hm(23)), true);
  assert.equal(inQuiet(c, hm(6)), true);
  assert.equal(inQuiet(c, hm(12)), false);
  assert.equal(nextDigest(c, abs(0, hm(21))), abs(1, hm(7)));
});

test('routing: the receiver decides delivery', () => {
  const h = household();
  h.contracts.H.lower = 'digest';
  const event = { id: 'e1', at: abs(0, hm(10)), intent: 'nudge', about: { people: ['A2'] }, to: [{ id: 'H', reason: 'Driver' }, { id: 'A2', reason: 'Attending' }], text: 'x' };
  const by = Object.fromEntries(route(event, h.members, h.contracts).deliveries.map((d) => [d.to, d]));
  assert.equal(by.H.channel, 'digest', 'a digest only rule lowers a nudge');
  assert.equal(by.H.at, abs(0, hm(15)));
  assert.equal(by.A2.channel, 'board', 'limited phone means the board');
  assert.equal(by.K.channel, 'push', 'K follows A2 at nudge');
  assert.match(by.K.reason, /You follow \{A2\}/);
  assert.equal(by.A1, undefined, 'A1 is not affected and follows nobody');
});

test('routing: a nudge in quiet hours is held, an interrupt is not, and nothing is sent twice', () => {
  const h = household();
  const sent = new Set();
  const night = abs(0, hm(23));
  const nudge = route({ id: 'n', key: 'k', at: night, intent: 'nudge', followable: false, to: [{ id: 'H', reason: 'r' }], text: 'x' }, h.members, h.contracts, sent);
  assert.equal(nudge.deliveries[0].channel, 'digest');
  assert.equal(nudge.deliveries[0].at, abs(1, hm(6, 30)));
  const again = route({ id: 'n2', key: 'k', at: night + 5, intent: 'nudge', followable: false, to: [{ id: 'H', reason: 'r' }], text: 'x' }, h.members, h.contracts, sent);
  assert.equal(again.deliveries.length, 0);
  assert.equal(again.suppressed.length, 1);
  const ring = route({ id: 'i', at: night, intent: 'interrupt', followable: false, to: [{ id: 'H', reason: 'r' }], text: 'x' }, h.members, h.contracts);
  assert.equal(ring.deliveries[0].channel, 'ring');
});

test('escalation walks the chain and stops at the first acknowledgement', () => {
  const none = escalationTimeline({ chain: ['a', 'b', 'c'], start: 100, windowMin: 8 });
  assert.deepEqual(none.steps.map((s) => [s.to, s.at]), [['a', 100], ['b', 108], ['c', 116]]);
  assert.equal(none.exhausted, true);
  const acked = escalationTimeline({ chain: ['a', 'b', 'c'], start: 100, windowMin: 8, acks: { b: 110 } });
  assert.deepEqual(acked.steps.map((s) => s.to), ['a', 'b']);
  assert.equal(acked.ackedBy, 'b');
  const same = escalationTimeline({ chain: ['a', 'b'], start: 100, windowMin: 8, acks: { b: 108 } });
  assert.deepEqual(same.steps.map((s) => s.to), ['a', 'b'], 'an answer in the same minute as the ring comes after it');
});

test('capture: plain language becomes a structured proposal, by code or by any alias', () => {
  const members = sample.createMembers();
  const a = parseCapture('Netball Fri 3pm A2', members);
  assert.deepEqual([a.day, a.start, a.end, a.people, a.type, a.title], [4, hm(15), hm(16), ['A2'], 'activity', '{A2}, netball']);
  const named = members.map((m) => (m.id === 'A2' ? { ...m, aliases: ['Poppet', 'Pop'] } : m));
  const b = parseCapture('Dentist for Poppet tomorrow 4.30-5.15pm', named, 0);
  assert.deepEqual([b.day, b.start, b.end, b.type, b.title, b.people], [1, hm(16, 30), hm(17, 15), 'medical', '{A2}, dentist', ['A2']]);
  assert.equal(parseCapture('call the plumber', members).confident, false);
});

test('scenario: an unconfirmed pickup escalates to the other parent, then rings both', () => {
  const h = household();
  const silent = runScenario('pickup', h, {});
  assert.deepEqual(silent.deliveries.filter((d) => d.channel === 'ring').map((d) => d.to), ['K', 'H', 'H', 'K']);
  assert.match(silent.deliveries.at(-1).text, /call the school office/);
  const taken = runScenario('pickup', h, { acks: { H: hm(13, 20) } });
  assert.ok(taken.deliveries.some((d) => d.to === 'K' && d.text.includes('{H} is collecting {A2}')));
  assert.ok(!taken.deliveries.some((d) => d.to === 'H' && d.text.includes('is collecting')), 'the person who took it is not told that they took it');
  assert.ok(taken.deliveries.some((d) => d.to === 'A2' && d.channel === 'board'));
  assert.ok(!taken.deliveries.some((d) => d.to === 'A1'), 'A1 is not involved');
});

test('scenario: the dentist move asks first, then tells each person their part', () => {
  const h = household();
  const pending = runScenario('dentist', h, {});
  assert.deepEqual([...new Set(pending.deliveries.map((d) => d.to))].sort(), ['H', 'K']);
  assert.ok(pending.deliveries.find((d) => d.to === 'K').text.includes('Nothing has changed'));
  const yes = runScenario('dentist', h, { answer: { accept: true, minute: hm(9, 40) } });
  assert.equal(yes.deliveries.find((d) => d.to === 'A1' && d.source === 'changed').channel, 'push');
  assert.equal(yes.deliveries.find((d) => d.to === 'A2').channel, 'board');
  const no = runScenario('dentist', h, { answer: { accept: false, minute: hm(9, 40) } });
  assert.ok(!no.deliveries.some((d) => d.to === 'A1'), 'a declined proposal reaches nobody else');
});

test('scenario: running late tells the people waiting once, however often the estimate moves', () => {
  const r = runScenario('late', household(), {});
  assert.deepEqual(r.deliveries.map((d) => d.to).sort(), ['A1', 'K']);
  assert.equal(r.suppressed.length, 6);
  assert.ok(!r.deliveries.some((d) => d.to === 'A2'));
});

test('pantry: confidence fades with shelf life, and "we are out" wins', () => {
  const milk = { key: 'milk', category: 'dairy', bought: 0 };
  assert.equal(confidence(milk, 0), 1);
  assert.equal(levelOf(milk, 2), 'likely');
  assert.equal(levelOf(milk, 6), 'maybe');
  assert.equal(levelOf(milk, 9), 'unlikely');
  assert.equal(levelOf({ key: 'rice', category: 'dry', bought: -60 }, 0), 'likely');
  assert.equal(levelOf({ ...milk, out: true }, 0), 'unlikely');
});

test('pantry: a dish is checked against what is likely in the house', () => {
  const d = sample.createDinner();
  const salmon = checkDish(d.dishes.find((x) => x.id === 'salmon'), d.pantry, 0);
  assert.deepEqual(salmon.missing.sort(), ['broccoli', 'lemon', 'salmon'], 'broccoli bought nine days ago is probably gone');
  assert.equal(salmon.ready, false);
  const bolognese = checkDish(d.dishes.find((x) => x.id === 'bolognese'), d.pantry, 0);
  assert.deepEqual(bolognese.unsure, ['onion'], 'onions bought thirteen days ago are worth a look');
  assert.deepEqual(bolognese.missing, []);
});

test('pantry: a receipt is read into items, and reading it makes the dish possible', () => {
  const d = sample.createDinner();
  const read = parseReceipt(d.receipts[0].text);
  assert.deepEqual(read.items.map((i) => i.key), ['salmon', 'broccoli', 'lemon', 'milk', 'tofu', 'spring onion']);
  assert.equal(read.items[1].qty, 2);
  assert.ok(!read.items.some((i) => /delivery|total/i.test(i.label)), 'fees and totals are not food');
  const pantry = addToPantry(d.pantry, read.items, 0);
  assert.equal(checkDish(d.dishes.find((x) => x.id === 'salmon'), pantry, 0).ready, true);
  assert.equal(parseReceipt('MYSTERY ITEM  1  $4.00').unrecognised.length, 1, 'unknown lines are surfaced, not guessed');
});
