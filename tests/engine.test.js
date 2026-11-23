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

const household = () => ({
  commitments: sample.createCommitments(),
  members: sample.createMembers(),
  cars: sample.createCars(),
  contracts: sample.createContracts(),
  playbooks: sample.PLAYBOOKS,
});

test('the sample week starts with no clashes', () => {
  assert.deepEqual(findClashes(household().commitments), []);
});

test('a commitment with a driver has a drop leg and a pick leg', () => {
  const c = household().commitments.find((x) => x.id === 'piano-0');
  const legs = legsOf(c);
  assert.equal(legs.length, 2);
  assert.equal(legs[0].from, abs(0, hm(15, 35)));
  assert.equal(legs[1].to, abs(0, hm(17, 25)));
});

test('moving the dentist to Thursday 4pm double books Priya and the family car', () => {
  const h = household();
  const after = applyPatches(h.commitments, [{ cid: 'dentist', patch: { day: 3, start: hm(16), end: hm(17) } }]);
  const clashes = findClashes(after);
  assert.ok(clashes.some((k) => k.kind === 'person' && k.who === 'priya'));
  assert.ok(clashes.some((k) => k.kind === 'car' && k.who === 'car1'));
  assert.ok(clashes.every((k) => [k.a, k.b].includes('art-3')));
});

test('a soft block is a soft clash until it hardens', () => {
  const h = household();
  const after = applyPatches(h.commitments, [{ cid: 'football-0', patch: { end: hm(19, 30) } }]);
  const early = findClashes(after, abs(0, hm(9)));
  const late = findClashes(after, abs(0, hm(16, 30)));
  assert.equal(early.find((k) => k.who === 'kai').severity, 'soft');
  assert.equal(late.find((k) => k.who === 'kai').severity, 'hard');
});

test('the ripple proposes cover, warns about overload, and blocks until a cover is chosen', () => {
  const h = household();
  const open = propose(h, { cid: 'dentist', by: 'priya', patch: { day: 3, start: hm(16), end: hm(17) } });
  assert.equal(open.blocked, true);
  const group = open.groups.find((g) => g.commitment.id === 'art-3');
  assert.equal(group.kind, 'driver');
  const nani = group.options.find((o) => o.id === 'nani');
  const wei = group.options.find((o) => o.id === 'wei');
  assert.equal(nani.ok, true);
  assert.equal(nani.overload, true);
  assert.equal(wei.ok, false);
  const chosen = propose(h, { cid: 'dentist', by: 'priya', patch: { day: 3, start: hm(16), end: hm(17) }, choices: { 'art-3': 'nani' } });
  assert.equal(chosen.blocked, false);
  assert.equal(chosen.patches.length, 2);
  assert.deepEqual(findClashes(chosen.afterAll), []);
  assert.ok(chosen.affected.some((a) => a.id === 'nani' && a.needsAnswer));
  assert.ok(chosen.tasks.some((t) => t.title.startsWith('Confirm the new time')));
});

test('a proposal never changes the household it was computed from', () => {
  const h = household();
  const snapshot = JSON.stringify(h.commitments);
  propose(h, { cid: 'dentist', by: 'priya', patch: { day: 3, start: hm(16), end: hm(17) }, choices: { 'art-3': 'nani' } });
  assert.equal(JSON.stringify(h.commitments), snapshot);
});

test('a medical appointment in school hours creates a note to the school, not a clash', () => {
  const p = propose(household(), { cid: 'dentist', by: 'priya', patch: { day: 2, start: hm(10), end: hm(11) } });
  assert.equal(p.schoolNote, true);
  assert.ok(p.tasks.some((t) => t.title.includes('school office')));
  assert.ok(!p.groups.some((g) => g.commitment.type === 'school'));
});

test('open slots exclude times that would clash', () => {
  const slots = openSlots(household(), 'dentist', 3);
  assert.ok(!slots.includes(hm(16)));
  assert.ok(slots.includes(hm(14, 30)) === false, 'school pickup and school hours are respected');
});

test('eligible drivers need to be free and to have a car', () => {
  const h = household();
  const list = eligibleDrivers(h.commitments, h.members, h.cars, 'swim-1');
  assert.ok(list.every((e) => !e.ok), 'nobody can cover Tuesday swimming');
  assert.ok(list.some((e) => e.reason.includes('in use')));
});

test('driving load counts runs for other people and flags the overloaded', () => {
  const h = household();
  const load = drivingLoad(h.commitments, h.members);
  assert.equal(load.nani.legs, 4, "Nani's own clinic trip is not counted");
  assert.equal(load.priya.over, true);
  assert.equal(load.wei.over, false);
});

test('a day with a hard clash is red', () => {
  const h = household();
  const after = applyPatches(h.commitments, [{ cid: 'dentist', patch: { day: 3, start: hm(16), end: hm(17) } }]);
  assert.equal(dayPressure(after, h.members, h.cars)[3].level, 'red');
  assert.notEqual(dayPressure(h.commitments, h.members, h.cars)[3].level, 'red');
});

test('quiet hours wrap past midnight and digests roll to the next day', () => {
  const c = sample.createContracts().wei;
  assert.equal(inQuiet(c, hm(23)), true);
  assert.equal(inQuiet(c, hm(6)), true);
  assert.equal(inQuiet(c, hm(12)), false);
  assert.equal(nextDigest(c, abs(0, hm(21))), abs(1, hm(7)));
});

test('routing: the receiver decides delivery', () => {
  const h = household();
  const event = { id: 'e1', at: abs(0, hm(10)), intent: 'nudge', about: { people: ['leo'] }, to: [{ id: 'priya', reason: 'Owner' }, { id: 'nani', reason: 'Driver' }, { id: 'leo', reason: 'Attending' }], text: 'x' };
  const { deliveries } = route(event, h.members, h.contracts);
  const by = Object.fromEntries(deliveries.map((d) => [d.to, d]));
  assert.equal(by.priya.channel, 'push');
  assert.equal(by.nani.channel, 'digest', "Nani's rule lowers a nudge to her evening digest");
  assert.equal(by.nani.at, abs(0, hm(19)));
  assert.equal(by.leo.channel, 'board', 'no phone means the board');
  assert.equal(by.rosa.channel, 'push', 'Rosa follows Leo at nudge');
  assert.equal(by.wei.channel, 'digest', 'Wei follows Leo at digest');
  assert.equal(by.kai, undefined, 'Kai is not affected and follows nobody');
  assert.ok(deliveries.every((d) => d.reason.length > 0), 'every delivery explains itself');
});

test('routing: a nudge in quiet hours is held, an interrupt is not, and nothing is sent twice', () => {
  const h = household();
  const sent = new Set();
  const night = abs(0, hm(23));
  const nudge = route({ id: 'n', key: 'k', at: night, intent: 'nudge', followable: false, to: [{ id: 'wei', reason: 'r' }], text: 'x' }, h.members, h.contracts, sent);
  assert.equal(nudge.deliveries[0].channel, 'digest');
  assert.equal(nudge.deliveries[0].at, abs(1, hm(6, 30)));
  const again = route({ id: 'n2', key: 'k', at: night + 5, intent: 'nudge', followable: false, to: [{ id: 'wei', reason: 'r' }], text: 'x' }, h.members, h.contracts, sent);
  assert.equal(again.deliveries.length, 0);
  assert.equal(again.suppressed.length, 1);
  const ring = route({ id: 'i', at: night, intent: 'interrupt', followable: false, to: [{ id: 'wei', reason: 'r' }], text: 'x' }, h.members, h.contracts);
  assert.equal(ring.deliveries[0].channel, 'ring');
  assert.equal(ring.deliveries[0].at, night);
});

test('escalation walks the chain and stops at the first acknowledgement', () => {
  const none = escalationTimeline({ chain: ['a', 'b', 'c'], start: 100, windowMin: 8 });
  assert.deepEqual(none.steps.map((s) => [s.to, s.at]), [['a', 100], ['b', 108], ['c', 116]]);
  assert.equal(none.exhausted, true);
  const acked = escalationTimeline({ chain: ['a', 'b', 'c'], start: 100, windowMin: 8, acks: { b: 110 } });
  assert.deepEqual(acked.steps.map((s) => s.to), ['a', 'b']);
  assert.equal(acked.ackedBy, 'b');
  const early = escalationTimeline({ chain: ['a', 'b'], start: 100, windowMin: 8, acks: { a: 95 } });
  assert.equal(early.steps.length, 0);
});

test('capture: plain language becomes a structured proposal', () => {
  const members = sample.createMembers();
  const a = parseCapture('Swim Tue 5pm Leo', members);
  assert.deepEqual([a.day, a.start, a.end, a.people, a.type], [1, hm(17), hm(18), ['leo'], 'activity']);
  const b = parseCapture('Dentist for Maya tomorrow 4.30-5.15pm', members, 0);
  assert.deepEqual([b.day, b.start, b.end, b.type, b.title], [1, hm(16, 30), hm(17, 15), 'medical', 'Maya, dentist']);
  const c = parseCapture('Kai and Maya haircut Saturday at 3 for 90 min', members);
  assert.deepEqual([c.day, c.start, c.end, c.people], [5, hm(15), hm(16, 30), ['kai', 'maya']]);
  const d = parseCapture('call the plumber', members);
  assert.equal(d.confident, false);
});

test('scenario: an unconfirmed pickup escalates, and stops when someone takes it', () => {
  const h = household();
  const silent = runScenario('pickup', h, {});
  assert.deepEqual(silent.deliveries.filter((d) => d.channel === 'ring').map((d) => d.to).slice(0, 3), ['rosa', 'priya', 'wei']);
  const taken = runScenario('pickup', h, { acks: { priya: hm(13, 20) } });
  assert.ok(!taken.deliveries.some((d) => d.to === 'wei' && d.channel === 'ring'), 'Wei is never rung');
  assert.ok(taken.deliveries.some((d) => d.to === 'rosa' && d.text.includes('Priya is collecting')));
  assert.ok(taken.deliveries.some((d) => d.to === 'leo' && d.channel === 'board'));
  assert.ok(taken.deliveries.some((d) => d.to === 'nani' && d.channel === 'digest'), 'Nani follows Leo and hears in her digest');
});

test('scenario: the dentist move tells only the people it touches', () => {
  const h = household();
  const pending = runScenario('dentist', h, {});
  assert.deepEqual([...new Set(pending.deliveries.map((d) => d.to))].sort(), ['nani', 'priya']);
  assert.ok(pending.deliveries.find((d) => d.to === 'priya').text.includes('Nothing has changed'));
  const yes = runScenario('dentist', h, { answer: { accept: true, minute: hm(9, 40) } });
  const told = new Set(yes.deliveries.map((d) => d.to));
  assert.ok(!told.has('kai'), 'Kai hears nothing');
  assert.equal(yes.deliveries.find((d) => d.to === 'wei').channel, 'digest');
  assert.equal(yes.deliveries.find((d) => d.to === 'maya').channel, 'push');
  const no = runScenario('dentist', h, { answer: { accept: false, minute: hm(9, 40) } });
  assert.deepEqual([...new Set(no.deliveries.map((d) => d.to))].sort(), ['nani', 'priya']);
});

test('scenario: running late tells the people waiting once, however often the estimate moves', () => {
  const r = runScenario('late', household(), {});
  assert.deepEqual(r.deliveries.map((d) => d.to).sort(), ['kai', 'rosa']);
  assert.equal(r.suppressed.length, 4);
  assert.ok(!r.deliveries.some((d) => ['priya', 'maya', 'nani'].includes(d.to)));
});
