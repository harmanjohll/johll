// The day simulator. Each scenario is a short script of signals; the same routing,
// escalation and ripple code that the portal will run decides who hears what.

import { abs, hm, fmtTime, minuteOf } from './time.js';
import { route } from './route.js';
import { escalationTimeline } from './escalate.js';
import { propose } from './ripple.js';

export const SCENARIOS = [
  { id: 'pickup', title: 'A pickup nobody confirms', day: 0, from: hm(12, 45), to: hm(19, 15), blurb: 'Rosa is due to collect Leo at 1:30pm and does not confirm. Watch silence escalate to the next named adult, and stop the moment someone takes it.', rule: 'Silence escalates' },
  { id: 'dentist', title: 'The dentist moves', day: 2, from: hm(9), to: hm(20, 15), blurb: "The clinic calls: Leo's appointment must move to Thursday 4pm. One change, and only the people it touches hear about it, each in their own way.", rule: 'Changes are proposals' },
  { id: 'late', title: 'Running late', day: 3, from: hm(17, 45), to: hm(19, 45), blurb: "Wei is driving Kai home from an away match and traffic builds. The estimate changes three times; the people waiting are told once.", rule: 'Notify on change, once' },
];

function collect(events, members, contracts) {
  const sent = new Set();
  const deliveries = [];
  const suppressed = [];
  for (const e of events.sort((a, b) => a.at - b.at)) {
    const r = route(e, members, contracts, sent);
    deliveries.push(...r.deliveries.map((d) => ({ ...d, source: e.id })));
    suppressed.push(...r.suppressed);
  }
  deliveries.sort((a, b) => a.at - b.at);
  return { deliveries, suppressed };
}

function pickupScenario(h, input) {
  const day = 0;
  const c = h.commitments.find((x) => x.id === `pickup-leo-${day}`);
  const chain = [c.owner, ...c.backup];
  const name = (id) => h.members.find((m) => m.id === id).name;
  const start = abs(day, hm(13, 10));
  const windowMin = 8;
  const acks = Object.fromEntries(Object.entries(input.acks || {}).map(([id, minute]) => [id, abs(day, minute)]));
  const line = escalationTimeline({ chain, start, windowMin, acks });
  const events = [];
  const marks = [{ at: abs(day, hm(13)), label: 'Reminder' }];
  events.push({ id: 'remind', at: abs(day, hm(13)), intent: 'nudge', followable: false, about: { people: ['leo'] }, to: [{ id: c.owner, reason: 'You own this pickup' }], text: 'Collect Leo at 1:30pm, school gate B.' });
  line.steps.forEach((s, i) => {
    marks.push({ at: s.at, label: i === 0 ? 'Asks for confirmation' : `Escalates to ${name(s.to)}` });
    events.push({
      id: `ask-${i}`, at: s.at, intent: 'interrupt', needsAck: true, followable: false, about: { people: ['leo'] },
      to: [{ id: s.to, reason: i === 0 ? 'You own this pickup, and it is 20 minutes away' : `${name(chain[i - 1])} has not confirmed, and you are next` }],
      text: i === 0 ? 'Leo, 1:30pm at gate B. Tap to confirm you have it.' : `${name(chain[0])} has not confirmed Leo's 1:30pm pickup. Can you take it?`,
    });
  });
  if (line.ackedBy) {
    const who = line.ackedBy;
    marks.push({ at: line.ackedAt, label: `${name(who)} takes it` });
    const asked = line.steps.map((s) => s.to).filter((id) => id !== who);
    events.push({
      id: 'taken', at: line.ackedAt, intent: 'nudge', about: { people: ['leo'] }, exclude: [who],
      to: [...asked.map((id) => ({ id, reason: 'You were asked, so you are told it is covered' })), { id: 'leo', reason: 'It is your pickup', tier: 'ambient' }],
      text: (id) => (id === 'leo' ? `${name(who)} is collecting you at 1:30pm.` : `${name(who)} is collecting Leo. Nothing more needed from you.`),
    });
  } else if (line.exhausted) {
    marks.push({ at: line.endsAt, label: 'Nobody has it' });
    events.push({ id: 'unowned', at: line.endsAt, intent: 'interrupt', needsAck: true, followable: false, about: { people: ['leo'] }, to: c.backup.map((id) => ({ id, reason: 'Nobody has confirmed, and Leo finishes in minutes' })), text: "Nobody has confirmed Leo's pickup. Leo finishes at 1:30pm." });
  }
  const out = collect(events, h.members, h.contracts);
  return { ...out, marks, line, canAck: line.ackedBy ? [] : [...new Set(line.steps.map((s) => s.to))] };
}

function dentistScenario(h, input) {
  const day = 2;
  const name = (id) => h.members.find((m) => m.id === id).name;
  const asked = abs(day, hm(9, 20));
  const proposal = propose({ ...h, now: abs(day, hm(9, 15)) }, { cid: 'dentist', by: 'priya', patch: { day: 3, start: hm(16), end: hm(17) }, choices: { 'art-3': 'nani' } });
  const cover = proposal.groups.find((g) => g.chosen);
  const expires = abs(day, hm(20));
  const events = [];
  const marks = [{ at: abs(day, hm(9, 15)), label: 'Clinic calls Priya' }, { at: asked, label: 'Priya proposes the move' }];
  if (cover) {
    events.push({
      id: 'ask-cover', at: asked, intent: 'nudge', needsAnswer: true, followable: false, about: { people: ['maya'] },
      to: [{ id: cover.chosen.id, reason: 'The change only works if you agree, so you are asked first' }],
      text: `Could you take Maya to art on Thursday, leaving 3:35pm, and bring her home at 5:30pm? ${cover.chosen.overload ? `It would be your run ${cover.chosen.legsAfter} this week; your limit is ${h.members.find((m) => m.id === cover.chosen.id).maxLegs}.` : ''}`,
    });
  }
  const answer = input.answer; // { accept: boolean, minute }
  if (answer && answer.accept) {
    const at = abs(day, answer.minute);
    marks.push({ at, label: `${name(cover.chosen.id)} accepts` });
    events.push({
      id: 'changed', at, intent: 'nudge', about: { people: ['leo', 'maya'] },
      to: [
        { id: 'priya', reason: 'You proposed it' },
        { id: 'maya', reason: 'Your driver on Thursday changes' },
        { id: 'leo', reason: 'It is your appointment', tier: 'ambient' },
        { id: 'nani', reason: 'You agreed to drive', tier: 'ambient' },
      ],
      text: (id) => ({
        priya: `Done. Leo's dentist is Thursday 4pm. Nani takes Maya to art. Two follow ups are on your list.`,
        maya: 'Thursday art class: Nani is driving you there and back, not Mum.',
        leo: 'Dentist is now Thursday at 4pm, with Mum.',
        nani: 'Thursday: Maya to art, leave 3:35pm. Collect at 5:30pm.',
      }[id] || "Leo's dentist has moved to Thursday 4pm. Wednesday afternoon is now free."),
    });
  } else if (answer && !answer.accept) {
    const at = abs(day, answer.minute);
    marks.push({ at, label: `${name(cover.chosen.id)} declines` });
    events.push({ id: 'declined', at, intent: 'nudge', followable: false, about: { people: ['leo'] }, to: [{ id: 'priya', reason: 'You proposed it' }], text: `Nani cannot drive on Thursday. Nothing has changed: Leo's dentist is still Wednesday 3pm.` });
  } else {
    marks.push({ at: expires, label: 'Proposal expires' });
    events.push({ id: 'expired', at: expires, intent: 'nudge', followable: false, about: { people: ['leo'] }, to: [{ id: 'priya', reason: 'You proposed it' }], text: `No answer by 8pm, so the proposal has lapsed. Nothing has changed: Leo's dentist is still Wednesday 3pm.` });
  }
  const out = collect(events, h.members, h.contracts);
  return { ...out, marks, proposal, canAnswer: answer ? [] : cover ? [cover.chosen.id] : [] };
}

function lateScenario(h, input) {
  const day = 3;
  const match = h.commitments.find((c) => c.id === 'match-3');
  const dinner = h.commitments.find((c) => c.id === `dinner-${day}`);
  const threshold = 15;
  const estimates = [{ minute: hm(18, 5), late: 10 }, { minute: hm(18, 12), late: 20 }, { minute: hm(18, 26), late: 25 }, { minute: hm(18, 40), late: 25 }];
  const events = [];
  const marks = [];
  const homeBy = (late) => match.end + 25 + late;
  for (const e of estimates) {
    const at = abs(day, e.minute);
    marks.push({ at, label: `Estimate: ${e.late} min late${e.late < threshold ? ', below the 15 minute threshold' : ''}` });
    if (e.late < threshold) continue;
    events.push({
      id: `late-${e.minute}`, key: 'late-match-3', at, intent: 'nudge', followable: false, about: { people: ['kai'] },
      to: [{ id: 'kai', reason: 'You are the one waiting' }, { id: dinner.owner, reason: 'Dinner at 7pm is affected, and you own it', }],
      needsAnswer: false,
      text: (id) => (id === 'kai'
        ? `Dad is running about ${e.late} min late. New pickup about ${fmtTime(match.end + e.late)}.`
        : `Wei and Kai will be home about ${fmtTime(homeBy(e.late))}. Dinner at 7pm will be tight.`),
    });
  }
  if (input.holdDinner) {
    const at = abs(day, input.holdDinner);
    marks.push({ at, label: 'Rosa holds dinner to 7:30pm' });
    events.push({ id: 'dinner-held', at, intent: 'ambient', about: { people: [] }, followable: false, to: dinner.people.map((id) => ({ id, reason: 'You are at dinner; a small change, so it goes to the board only' })), text: 'Dinner is at 7:30pm tonight.' });
  }
  const out = collect(events, h.members, h.contracts);
  return { ...out, marks, canHold: !input.holdDinner };
}

export function runScenario(id, household, input = {}) {
  if (id === 'pickup') return pickupScenario(household, input);
  if (id === 'dentist') return dentistScenario(household, input);
  return lateScenario(household, input);
}

export { minuteOf };
