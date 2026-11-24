// The ripple: what one change touches. A change is always a proposal first.
// Nothing here mutates the household; it returns a description to confirm or decline.

import { abs, fmtTime, DAYS_SHORT, DAYS, overlaps } from './time.js';
import { findClashes, legsOf } from './clash.js';
import { eligibleDrivers } from './swap.js';

export function applyPatches(commitments, patches) {
  const map = new Map(patches.map((p) => [p.cid, p.patch]));
  return commitments.map((c) => (map.has(c.id) ? { ...c, ...map.get(c.id) } : c));
}

// "{A2}, dentist" reads better in a sentence as "{A2}'s dentist".
const inSentence = (title) => title.replace(/^(\{\w+\}), (.+)$/, "$1's $2");
const when = (c) => `${DAYS_SHORT[c.day]} ${fmtTime(c.start)}`;
const whenLong = (c) => `${DAYS[c.day]}, ${fmtTime(c.start)} to ${fmtTime(c.end)}`;

export function diffOf(before, after, nameOf) {
  const rows = [];
  if (before.day !== after.day || before.start !== after.start || before.end !== after.end) rows.push({ field: 'When', from: whenLong(before), to: whenLong(after) });
  if (before.driver !== after.driver) rows.push({ field: 'Driver', from: before.driver ? nameOf(before.driver) : 'None', to: after.driver ? nameOf(after.driver) : 'None' });
  if (before.place !== after.place) rows.push({ field: 'Where', from: before.place, to: after.place });
  if (before.status !== after.status && after.status === 'cancelled') rows.push({ field: 'Status', from: 'Booked', to: 'Cancelled' });
  return rows;
}

// propose(household, { cid, patch, by, choices })
// choices: { [otherCid]: memberId } picks a cover driver for a commitment that now clashes.
export function propose(household, change) {
  const { commitments, members, cars, playbooks = {}, now = null } = household;
  // People are written as tokens such as {A2}; the name is chosen when the text is shown.
  const nameOf = (id) => `{${id}}`;
  const before = commitments.find((c) => c.id === change.cid);
  const choices = change.choices || {};

  const mainPatch = { cid: change.cid, patch: change.patch };
  const afterMain = applyPatches(commitments, [mainPatch]);
  const after = afterMain.find((c) => c.id === change.cid);

  const clashKey = (k) => k.key;
  const oldClashes = findClashes(commitments, now);
  const rawNew = findClashes(afterMain, now).filter((k) => !oldClashes.some((o) => clashKey(o) === clashKey(k)));
  const resolved = oldClashes.filter((k) => !findClashes(afterMain, now).some((n) => clashKey(n) === clashKey(k)));

  const byId = new Map(afterMain.map((c) => [c.id, c]));
  const other = (k) => byId.get(k.a === change.cid ? k.b : k.a);

  // A clash with school is not a block; it becomes a note to the school.
  const schoolClashes = rawNew.filter((k) => other(k)?.type === 'school');
  const newClashes = rawNew.filter((k) => other(k)?.type !== 'school');

  // Group the new clashes by the other commitment, and offer cover for each.
  const groups = new Map();
  for (const k of newClashes) {
    const o = other(k);
    if (!groups.has(o.id)) groups.set(o.id, { commitment: o, clashes: [], options: [] });
    groups.get(o.id).clashes.push(k);
  }
  const extraPatches = [];
  for (const g of groups.values()) {
    const o = g.commitment;
    const driverClash = g.clashes.some((k) => (k.kind === 'person' && k.who === o.driver) || k.kind === 'car');
    g.kind = driverClash && o.driver ? 'driver' : o.soft ? 'soft' : 'person';
    if (g.kind === 'driver') {
      g.options = eligibleDrivers(afterMain, members, cars, o.id, { includeSelf: true });
      const chosen = choices[o.id];
      const pick = g.options.find((x) => x.id === chosen && x.ok);
      if (pick) {
        g.chosen = pick;
        extraPatches.push({ cid: o.id, patch: { driver: pick.id, car: pick.car } });
      }
    }
    g.summary = g.clashes.map((k) => {
      if (k.kind === 'car') return `${cars.find((c) => c.id === k.who)?.name || 'The car'} is needed in two places`;
      return `${nameOf(k.who)} would be in two places`;
    }).filter((v, i, a) => a.indexOf(v) === i).join('; ');
  }

  const allPatches = [mainPatch, ...extraPatches];
  const afterAll = applyPatches(commitments, allPatches);
  const remaining = findClashes(afterAll, now).filter((k) => !oldClashes.some((o) => clashKey(o) === clashKey(k)) && byId.get(k.a === change.cid ? k.b : k.a)?.type !== 'school');
  const hardRemaining = remaining.filter((k) => k.severity === 'hard');

  // Who is touched, and why.
  const affected = new Map();
  const touch = (id, why, needsAnswer = false) => {
    if (!id) return;
    const cur = affected.get(id);
    if (!cur) affected.set(id, { id, why: [why], needsAnswer });
    else { if (!cur.why.includes(why)) cur.why.push(why); cur.needsAnswer = cur.needsAnswer || needsAnswer; }
  };
  for (const p of after.people) touch(p, 'Attending');
  // One owner per commitment: if someone else proposes the change, the owner must agree.
  touch(after.owner, 'Owns this', Boolean(change.by) && change.by !== before.owner);
  if (before.driver) touch(before.driver, 'Driving');
  if (after.driver && after.driver !== before.driver) touch(after.driver, 'Asked to drive', true);
  for (const g of groups.values()) {
    const o = g.commitment;
    for (const p of o.people) touch(p, `${o.title} is affected`);
    touch(o.owner, `Owns ${o.title}`);
    if (g.chosen) touch(g.chosen.id, g.chosen.self ? `Asked to go by taxi for ${o.title}` : `Asked to cover ${o.title}`, true);
  }

  // Follow up tasks from the playbook for this kind of commitment.
  const tasks = [];
  const book = playbooks[after.type];
  if (book) tasks.push(...book.tasks(after, { duringSchool: schoolClashes.length > 0 }));
  for (const need of after.needs.filter((n) => !n.done)) tasks.push({ title: `Still needed: ${need.label}`, owner: after.owner, carried: true });
  for (const g of groups.values()) {
    if (g.kind === 'person') {
      for (const k of g.clashes) tasks.push({ title: `Tell ${g.commitment.place.split(',')[0] || 'the organiser'} that ${nameOf(k.who)} will miss ${g.commitment.title.split(', ').pop()}`, owner: g.commitment.owner });
    }
  }

  // Resources and people touched, for the graph.
  const carsTouched = new Set();
  for (const leg of [...legsOf(before), ...legsOf(after)]) if (leg.car) carsTouched.add(leg.car);
  for (const g of groups.values()) for (const k of g.clashes) if (k.kind === 'car') carsTouched.add(k.who);

  const subject = inSentence(before.title);
  const changeLine = `${subject} moves from ${when(before)} to ${when(after)}`;
  const coverLines = [...groups.values()].filter((g) => g.chosen).map((g) => (g.chosen.self ? `${nameOf(g.chosen.id)} goes by taxi for ${inSentence(g.commitment.title)}` : `${nameOf(g.chosen.id)} covers ${inSentence(g.commitment.title)}${g.chosen.taxi ? ' by taxi' : ''}`));
  const groupDraft = `${changeLine}. ${coverLines.length ? `${coverLines.join('. ')}. ` : ''}Nothing else changes.`;

  return {
    cid: change.cid,
    by: change.by,
    before,
    after,
    patches: allPatches,
    diff: [...diffOf(before, after, nameOf), ...extraPatches.flatMap((p) => {
      const b = commitments.find((c) => c.id === p.cid);
      return diffOf(b, { ...b, ...p.patch }, nameOf).map((r) => ({ ...r, field: `${b.title}: ${r.field.toLowerCase()}` }));
    })],
    groups: [...groups.values()],
    schoolNote: schoolClashes.length > 0,
    resolved,
    remaining,
    blocked: hardRemaining.length > 0,
    affected: [...affected.values()],
    tasks,
    carsTouched: [...carsTouched],
    changeLine,
    groupDraft,
    afterAll,
  };
}

// The slots on a given day where a commitment could move without a new hard clash.
export function openSlots(household, cid, day, { from = 8 * 60, to = 20 * 60, step = 30 } = {}) {
  const c = household.commitments.find((x) => x.id === cid);
  const length = c.end - c.start;
  const out = [];
  for (let start = from; start + length <= to; start += step) {
    const p = propose(household, { cid, patch: { day, start, end: start + length } });
    if (!p.groups.some((g) => g.clashes.some((k) => k.severity === 'hard')) && !p.schoolNote) out.push(start);
  }
  return out;
}

export { overlaps, abs };
