// The day simulator. Each scenario is a short script of signals; the same routing,
// escalation and ripple code that the portal will run decides who hears what.
// People appear as tokens such as {A2}; each phone shows its owner's name for them.

import { abs, hm, fmtTime, minuteOf } from './time.js';
import { route } from './route.js';
import { escalationTimeline } from './escalate.js';
import { propose } from './ripple.js';

export const SCENARIOS = [
  { id: 'pickup', title: 'A pickup nobody confirms', day: 0, from: hm(12, 45), to: hm(15, 15), blurb: '{K} is due to collect {A2} at 1:30pm and does not confirm. Watch silence escalate to the other parent, and stop the moment someone takes it.', rule: 'Silence escalates' },
  { id: 'dentist', title: 'The dentist moves', day: 2, from: hm(9), to: hm(20, 15), blurb: "The clinic calls {K}: {A2}'s appointment must move to Thursday 5pm. That needs the car at the same time as violin. One change, and each person hears only what touches them.", rule: 'Changes are proposals' },
  { id: 'late', title: 'Running late', day: 3, from: hm(17, 45), to: hm(19, 45), blurb: '{H} is driving {A1} home from violin and traffic builds. The estimate keeps changing; the people waiting are told once.', rule: 'Notify on change, once' },
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
  const c = h.commitments.find((x) => x.id === `pickup-${day}`);
  const child = c.people.find((p) => p !== c.owner);
  const chain = [c.owner, ...c.backup];
  const tag = (id) => `{${id}}`;
  const start = abs(day, hm(13, 10));
  const windowMin = 8;
  const acks = Object.fromEntries(Object.entries(input.acks || {}).map(([id, minute]) => [id, abs(day, minute)]));
  const line = escalationTimeline({ chain, start, windowMin, acks });
  const events = [];
  const marks = [{ at: abs(day, hm(13)), label: 'Reminder' }];
  events.push({ id: 'remind', at: abs(day, hm(13)), intent: 'nudge', followable: false, about: { people: [child] }, to: [{ id: c.owner, reason: 'You own this pickup' }], text: `Collect ${tag(child)} at 1:30pm, school gate B.` });
  line.steps.forEach((s, i) => {
    marks.push({ at: s.at, label: i === 0 ? 'Asks for confirmation' : `Escalates to ${tag(s.to)}` });
    events.push({
      id: `ask-${i}`, at: s.at, intent: 'interrupt', needsAck: true, followable: false, about: { people: [child] },
      to: [{ id: s.to, reason: i === 0 ? 'You own this pickup, and it is 20 minutes away' : `${tag(chain[i - 1])} has not confirmed, and you are next` }],
      text: i === 0 ? `${tag(child)}, 1:30pm at gate B. Tap to confirm you have it.` : `${tag(chain[0])} has not confirmed the 1:30pm pickup for ${tag(child)}. Can you take it?`,
    });
  });
  if (line.ackedBy) {
    const who = line.ackedBy;
    marks.push({ at: line.ackedAt, label: `${tag(who)} takes it` });
    const asked = line.steps.map((s) => s.to).filter((id) => id !== who);
    events.push({
      id: 'taken', at: line.ackedAt, intent: 'nudge', about: { people: [child] }, exclude: [who],
      to: [...asked.map((id) => ({ id, reason: 'You were asked, so you are told it is covered' })), { id: child, reason: 'It is your pickup', tier: 'ambient' }],
      text: (id) => (id === child ? `${tag(who)} is collecting you at 1:30pm.` : `${tag(who)} is collecting ${tag(child)}. Nothing more needed from you.`),
    });
  } else if (line.exhausted) {
    marks.push({ at: line.endsAt, label: 'Nobody has it' });
    events.push({ id: 'unowned', at: line.endsAt, intent: 'interrupt', needsAck: true, followable: false, about: { people: [child] }, to: chain.map((id) => ({ id, reason: 'Nobody has confirmed, and school ends in minutes' })), text: `Nobody has confirmed the pickup for ${tag(child)}, who finishes at 1:30pm. If neither of you can go, call the school office.` });
  }
  const out = collect(events, h.members, h.contracts);
  return { ...out, marks, line, canAck: line.ackedBy ? [] : [...new Set([...line.steps.map((s) => s.to), ...(line.exhausted ? chain : [])])] };
}

function dentistScenario(h, input) {
  const day = 2;
  const tag = (id) => `{${id}}`;
  const asked = abs(day, hm(9, 20));
  const proposal = propose({ ...h, now: abs(day, hm(9, 15)) }, { cid: 'dentist', by: 'K', patch: { day: 3, start: hm(17), end: hm(18) }, choices: { 'violin-3': 'H' } });
  const cover = proposal.groups.find((g) => g.chosen);
  const expires = abs(day, hm(20));
  const events = [];
  const marks = [{ at: abs(day, hm(9, 15)), label: 'Clinic calls {K}' }, { at: asked, label: '{K} proposes the move' }];
  if (cover) {
    events.push({
      id: 'ask-cover', at: asked, intent: 'nudge', needsAnswer: true, followable: false, about: { people: ['A1'] },
      to: [{ id: cover.chosen.id, reason: 'The change only works if you agree, so you are asked first' }],
      text: `${tag('K')} needs the car on Thursday at 5pm for the dentist. Could you take ${tag('A1')} to violin by taxi, leaving 4:35pm, and back at 6pm?`,
    });
  }
  const answer = input.answer; // { accept: boolean, minute }
  if (answer && answer.accept) {
    const at = abs(day, answer.minute);
    marks.push({ at, label: `${tag(cover.chosen.id)} accepts` });
    events.push({
      id: 'changed', at, intent: 'nudge', about: { people: ['A2', 'A1'] },
      to: [
        { id: 'K', reason: 'You proposed it' },
        { id: 'A1', reason: 'How you get to violin on Thursday changes' },
        { id: 'A2', reason: 'It is your appointment', tier: 'ambient' },
        { id: 'H', reason: 'You agreed to go by taxi', tier: 'ambient' },
      ],
      text: (id) => ({
        K: `Done. The dentist for ${tag('A2')} is Thursday 5pm, and you have the car. ${tag('H')} takes ${tag('A1')} to violin by taxi. Two follow ups are on your list.`,
        A1: `Thursday violin: you go by taxi with ${tag('H')}, not in the car. Leave at 4:35pm.`,
        A2: `Dentist is now Thursday at 5pm, with ${tag('K')}.`,
        H: `Thursday: ${tag('A1')} to violin by taxi, leave 4:35pm. Home about 6:25pm.`,
      }[id]),
    });
  } else if (answer && !answer.accept) {
    const at = abs(day, answer.minute);
    marks.push({ at, label: `${tag(cover.chosen.id)} declines` });
    events.push({ id: 'declined', at, intent: 'nudge', followable: false, about: { people: ['A2'] }, to: [{ id: 'K', reason: 'You proposed it' }], text: `${tag('H')} cannot do Thursday by taxi. Nothing has changed: the dentist is still Wednesday 3pm.` });
  } else {
    marks.push({ at: expires, label: 'Proposal expires' });
    events.push({ id: 'expired', at: expires, intent: 'nudge', followable: false, about: { people: ['A2'] }, to: [{ id: 'K', reason: 'You proposed it' }], text: 'No answer by 8pm, so the proposal has lapsed. Nothing has changed: the dentist is still Wednesday 3pm.' });
  }
  const out = collect(events, h.members, h.contracts);
  return { ...out, marks, proposal, canAnswer: answer ? [] : cover ? [cover.chosen.id] : [] };
}

function lateScenario(h, input) {
  const day = 3;
  const tag = (id) => `{${id}}`;
  const lesson = h.commitments.find((c) => c.id === 'violin-3');
  const dinner = h.commitments.find((c) => c.id === `dinner-${day}`);
  const waiting = lesson.people[0];
  const driver = lesson.driver;
  const threshold = 15;
  const estimates = [{ minute: hm(17, 48), late: 10 }, { minute: hm(17, 52), late: 20 }, { minute: hm(18, 4), late: 25 }, { minute: hm(18, 15), late: 25 }, { minute: hm(18, 30), late: 30 }];
  const events = [];
  const marks = [];
  const homeBy = (late) => lesson.end + 25 + late;
  for (const e of estimates) {
    const at = abs(day, e.minute);
    marks.push({ at, label: `Estimate: ${e.late} min late${e.late < threshold ? ', under the 15 minute threshold' : ''}` });
    if (e.late < threshold) continue;
    events.push({
      id: `late-${e.minute}`, key: 'late-violin-3', at, intent: 'nudge', followable: false, about: { people: [waiting] },
      to: [{ id: waiting, reason: 'You are the one waiting' }, { id: dinner.owner, reason: 'Dinner at 7pm is affected, and you are cooking' }],
      text: (id) => (id === waiting
        ? `${tag(driver)} is running about ${e.late} min late. New pickup about ${fmtTime(lesson.end + e.late)}.`
        : `${tag(driver)} and ${tag(waiting)} will be home about ${fmtTime(homeBy(e.late))}. Dinner at 7pm will be tight.`),
    });
  }
  if (input.holdDinner) {
    const at = abs(day, input.holdDinner);
    marks.push({ at, label: `${tag(dinner.owner)} holds dinner to 7:30pm` });
    events.push({ id: 'dinner-held', at, intent: 'ambient', about: { people: [] }, followable: false, to: dinner.people.filter((id) => id !== dinner.owner).map((id) => ({ id, reason: 'You are at dinner; a small change, so it goes to the board only' })), text: 'Dinner is at 7:30pm tonight.' });
  }
  const out = collect(events, h.members, h.contracts);
  return { ...out, marks, canHold: !input.holdDinner, cook: dinner.owner };
}

export function runScenario(id, household, input = {}) {
  if (id === 'pickup') return pickupScenario(household, input);
  if (id === 'dentist') return dentistScenario(household, input);
  return lateScenario(household, input);
}

export { minuteOf };
