import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sample from '../app/js/data/sample.js';
import { hm, abs } from '../app/js/engine/time.js';
import { brief, childDay } from '../app/js/engine/brief.js';
import { ask, examples } from '../app/js/engine/ask.js';
import { detectRoutines, openOffers } from '../app/js/engine/routines.js';

const world = (now = abs(0, hm(12, 40))) => ({
  members: sample.createMembers(), cars: sample.createCars(), contracts: sample.createContracts(), commitments: sample.createCommitments(),
  triage: sample.createTriage(), rota: sample.createRota(), dinner: sample.createDinner(), house: sample.createHousekeeping(),
  tasks: [{ id: 't1', title: 'Renew the football season registration', owner: 'H', due: 'Fri', done: false }],
  swaps: {}, log: sample.createLog(), routines: [], routinesDeclined: [], later: [], handoffRead: false, now,
});

test('routines: only unbroken recent repeats are offered', () => {
  const found = detectRoutines(sample.createLog());
  assert.deepEqual(found.map((r) => r.key).sort(), ['football', 'gym', 'piano', 'violin']);
  assert.ok(!found.some((r) => r.key === 'netball'), 'a gap two weeks ago breaks the run');
  assert.ok(!found.some((r) => r.key === 'basketball'), 'two weeks is not yet a pattern');
  assert.equal(openOffers(sample.createLog(), [{ id: 'football-0' }], ['piano-0']).length, 2);
});

test('brief: the owner of a pickup that is close sees it first, with a reason', () => {
  const b = brief(world(), 'K');
  assert.equal(b.cards[0].kind, 'confirm');
  assert.match(b.cards[0].title, /Collect \{A2\} from school at 1:30pm/);
  assert.match(b.cards[0].why, /starts in 50 min/);
  assert.match(b.lead, /Tap to confirm/);
  assert.ok(b.cards.every((c) => c.why && c.actions.length >= 1 && c.actions.length <= 2), 'every card is one decision with a reason');
});

test('brief: the other parent is only drawn in when it is close and still unconfirmed', () => {
  assert.ok(!brief(world(), 'H').cards.some((c) => c.kind === 'confirm'), 'at 12:40 it is not yet H\'s problem');
  const late = brief(world(abs(0, hm(13, 15))), 'H');
  assert.equal(late.cards[0].kind, 'confirm');
  assert.match(late.cards[0].title, /\{K\} has not confirmed/);
  const w = world(abs(0, hm(13, 15)));
  w.commitments.find((c) => c.id === 'pickup-0').ack = 'acked';
  assert.ok(!brief(w, 'H').cards.some((c) => c.kind === 'confirm'), 'once confirmed, the card is gone for everyone');
});

test('brief: each person gets their own cards', () => {
  const h = brief(world(), 'H');
  assert.ok(h.cards.some((c) => c.kind === 'task'));
  assert.ok(h.cards.some((c) => c.kind === 'load' && /\{K\} is driving 10 runs/.test(c.title)), 'H is told K is over the limit');
  assert.ok(h.cards.some((c) => c.kind === 'routine' && /football/.test(c.title)));
  const k = brief(world(), 'K');
  assert.ok(k.cards.some((c) => c.kind === 'triage'), 'K is captain this week');
  assert.ok(k.cards.some((c) => c.kind === 'request' && /noodle soup/.test(c.title)), 'K cooks on Friday and has a request');
  assert.ok(!k.cards.some((c) => c.kind === 'load'), 'nobody is told about their own overload as a chore');
  const a1 = brief(world(), 'A1');
  assert.deepEqual(a1.cards.map((c) => c.kind), ['need']);
  assert.match(a1.cards[0].title, /Boots/);
});

test('brief: a clash you are part of rises to the top, and "later" hides a card', () => {
  const w = world();
  Object.assign(w.commitments.find((c) => c.id === 'dentist'), { day: 3, start: hm(17), end: hm(18) });
  const b = brief(w, 'H');
  assert.ok(b.cards.findIndex((c) => c.kind === 'clash') <= 1);
  assert.match(b.cards.find((c) => c.kind === 'clash').why, /car is needed in two places/);
  const w2 = world();
  w2.later = ['task-t1'];
  assert.ok(!brief(w2, 'H').cards.some((c) => c.kind === 'task'));
});

test('brief: next up and the calm lead', () => {
  const b = brief(world(), 'A1');
  assert.deepEqual(b.next.map((n) => n.title), ['Football training', 'Family dinner']);
  assert.match(b.next[1].note, /\{H\} cooks: pasta bolognese/);
  assert.match(b.lead, /Next: football training at 4:30pm/);
});

test('child day: a few plain lines, nothing to manage', () => {
  const lines = childDay(world(), 'A2');
  assert.deepEqual(lines.map((l) => l.text), ['School until 1:30pm', '{K} collects you at 1:30pm', 'Piano at 4pm. {K} takes you', 'Family dinner at 7pm. {H} cooks pasta bolognese']);
});

const say = (text, v = 'H', w = world()) => ask(text, w, v);

test('ask: questions are answered from the live week', () => {
  assert.match(say('Who collects A2 today?').text, /\{K\} collects \{A2\} today at 1:30pm, school gate B\. Not confirmed yet/);
  assert.match(say('who is picking up tomorrow').text, /You collect \{A2\} tomorrow/, 'it speaks to you as you');
  assert.match(say('who collects me today', 'A2').text, /\{K\} collects you today/);
  assert.match(say("What's for dinner?").text, /Pasta bolognese today at 7pm\. You cook/);
  assert.match(say('what is for dinner', 'A1').text, /\{H\} cooks/);
  assert.match(say('who cooks on Thursday').text, /\{K\} cooks on Thursday: baked salmon/);
  assert.match(say('who is home for dinner on Friday').text, /Away: \{H\} \(work dinner\)/);
  assert.match(say('who is home for dinner tonight').text, /Everyone is home/);
  assert.match(say('when is violin').text, /\{A1\}'s violin is on Thursday at 5pm, Strings Studio\. You drive/);
  assert.match(say('where is A1').text, /\{A1\} is at school until 2pm/);
  assert.match(say('do we have eggs').text, /Eggs: Probably yes\. Bought 9 days ago/);
  assert.match(say('do we have milk').text, /Milk: Maybe/);
  const day = say('what is on Thursday');
  assert.ok(day.bullets.some((b) => /5pm: \{A1\}, violin \(you drive\)/.test(b)));
  assert.equal(say('who is driving on Saturday').bullets.length, 2);
  assert.match(say('what needs me').text, /things need you/);
});

test('ask: commands become actions, and plans change only through a proposal', () => {
  assert.deepEqual(say('Add eggs to the list').do, { type: 'addGrocery', item: 'eggs' });
  assert.deepEqual(say('we need more washing powder').do, { type: 'addGrocery', item: 'washing powder' });
  assert.deepEqual(say("we're out of milk").do, { type: 'markOut', key: 'milk', alsoList: true });
  assert.deepEqual(say('I have it', 'K').do, { type: 'ack', cid: 'pickup-0' });
  assert.equal(say('I have it', 'A1').kind, 'answer');
  assert.deepEqual(say('move the dentist to Thursday 5pm').do, { type: 'openRipple', cid: 'dentist', patch: { day: 3, start: hm(17) } });
  assert.deepEqual(say('Can we have chicken rice on Friday?', 'A1').do, { type: 'askDish', day: 4, dish: 'chicken-rice' });
  assert.equal(say('can we have salmon on thursday', 'K').do.type, 'setDish', 'the cook does not need to ask themselves');
  assert.deepEqual(say('open the week').do, { type: 'go', route: 'week' });
});

test('ask: a plain statement is read as a proposal to confirm', () => {
  const r = say('Netball Fri 3pm A2');
  assert.equal(r.kind, 'proposal');
  assert.deepEqual([r.parsed.day, r.parsed.start, r.parsed.people], [4, hm(15), ['A2']]);
});

test('ask: it says so when it does not understand', () => {
  const r = say('should we get a dog');
  assert.equal(r.kind, 'unknown');
  assert.match(r.text, /cannot answer that yet/);
  assert.ok(r.bullets.length >= 3, 'it lists what it can do');
});

test('ask: examples suit the person', () => {
  assert.match(examples(world(), 'H')[0], /Who collects \{A2\} today/);
  assert.equal(examples(world(), 'A1').length, 3);
  for (const v of ['H', 'A1']) for (const e of examples(world(), v)) assert.notEqual(ask(e.replace(/\{(\w+)\}/g, '$1'), world(), v).kind, 'unknown', `the example "${e}" must work`);
});
