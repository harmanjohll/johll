// The brief: what matters to one person right now, as a lead sentence and a short
// stack of cards. Each card is one decision, with its reason. Code decides the order.

import { abs, dayOf, minuteOf, fmtTime, DAYS, fmtDuration, fmtDayDate } from './time.js';
import { findClashes } from './clash.js';
import { drivingLoad } from './load.js';
import { checkDish } from './pantry.js';
import { openOffers, describeRoutine } from './routines.js';
import { overdueFor, activeBy, isOverdue, dueWatches } from './checkin.js';
import { bestWindow } from './freetime.js';
import { nextStop } from './adventures.js';

const inSentence = (title) => title.replace(/^(\{\w+\}), (.+)$/, "$1's $2");
const strip = (title, v) => (title.startsWith(`{${v}}, `) ? title.slice(v.length + 4).replace(/^./, (ch) => ch.toUpperCase()) : inSentence(title));
const involves = (c, id) => c.people.includes(id) || c.owner === id || c.driver === id;

export function brief(s, v) {
  const day = dayOf(s.now);
  const nowMin = minuteOf(s.now);
  const me = s.members.find((m) => m.id === v);
  const todays = s.commitments.filter((c) => c.day === day && c.status !== 'cancelled');
  const later = new Set(s.later || []);
  const cards = [];
  const add = (card) => { if (!later.has(card.id)) cards.push(card); };

  // 1. Things to confirm: your own, or someone else's that is about to be missed.
  for (const c of todays.filter((x) => x.ack === 'pending' && x.end >= nowMin)) {
    const mins = c.start - nowMin;
    if (c.owner === v) {
      add({ id: `ack-${c.id}`, kind: 'confirm', rank: mins <= 60 ? 100 : 62, title: `${strip(c.title, v)} at ${fmtTime(c.start)}`, body: c.place, why: mins > 0 ? `You own this, and it starts in ${fmtDuration(mins)}` : 'You own this, and it has started', actions: [{ label: 'I have it', act: 'ack', id: c.id, primary: true }] });
    } else if (c.backup.includes(v) && mins <= 20) {
      add({ id: `ack-${c.id}`, kind: 'confirm', rank: 110, urgent: true, title: `{${c.owner}} has not confirmed: ${strip(c.title, v).toLowerCase()} at ${fmtTime(c.start)}`, body: c.place, why: 'You are next after the owner, and it is close', actions: [{ label: 'I will take it', act: 'ack', id: c.id, primary: true }] });
    }
  }

  // 2. Requests waiting for your answer.
  for (const [cid, swap] of Object.entries(s.swaps || {})) {
    if (swap.status !== 'asked' || swap.to !== v) continue;
    const c = s.commitments.find((x) => x.id === cid);
    add({ id: `swap-${cid}`, kind: 'request', rank: 82, title: `Can you drive for ${inSentence(c.title)}, ${DAYS[c.day]} ${fmtTime(c.start)}?`, why: `{${c.driver}} asked you. Nothing changes unless you accept`, actions: [{ label: 'Accept', act: 'swapYes', id: cid, primary: true }, { label: 'Not this time', act: 'swapNo', id: cid }] });
  }
  for (const r of (s.dinner?.requests || []).filter((x) => x.status === 'asked')) {
    const plan = s.dinner.plan.find((p) => p.day === r.day);
    if (!plan || plan.cook !== v || r.by === v) continue;
    const dish = s.dinner.dishes.find((d) => d.id === r.dish);
    add({ id: `req-${r.id}`, kind: 'request', rank: 78, title: `{${r.by}} asks for ${dish.name.toLowerCase()} on ${DAYS[r.day]}`, why: `You cook on ${DAYS[r.day]}, so you decide`, actions: [{ label: 'Accept', act: 'reqYes', id: r.id, primary: true }, { label: 'Not this time', act: 'reqNo', id: r.id }] });
  }

  // An outing someone has pencilled in, which stays only if you agree.
  for (const c of s.commitments.filter((x) => x.pending && x.status !== 'cancelled' && x.pending.asks.includes(v))) {
    add({ id: `plan-${c.id}`, kind: 'request', rank: 70, title: `{${c.pending.by}} suggests ${DAYS[c.day]} at ${fmtTime(c.start)}: ${c.title.replace(/^Quest: /, 'the quest stop at ')}, ${c.place}`, why: 'It is pencilled in, and it stays only if you agree', actions: [{ label: 'Sounds good', act: 'planYes', id: c.id, primary: true }, { label: 'Not this time', act: 'planNo', id: c.id }] });
  }

  // 3. A clash this week that is yours.
  const seen = new Set();
  for (const k of findClashes(s.commitments, s.now).filter((x) => x.severity === 'hard')) {
    const pair = [k.a, k.b].map((id) => s.commitments.find((c) => c.id === id));
    if (!pair.some((c) => involves(c, v)) || seen.has(pair[0].id + pair[1].id)) continue;
    seen.add(pair[0].id + pair[1].id);
    const movable = pair.find((c) => !c.fixed) || pair[0];
    add({ id: `clash-${k.key}`, kind: 'clash', rank: 76, urgent: true, title: `${DAYS[pair[0].day]}: ${inSentence(pair[0].title)} clashes with ${inSentence(pair[1].title)}`, why: k.kind === 'car' ? 'The car is needed in two places' : `{${k.who}} would be in two places`, actions: [{ label: 'See what it touches', act: 'ripple', id: movable.id, primary: true }] });
  }

  // 4. Things still to pack or sign for today.
  for (const c of todays.filter((x) => x.end >= nowMin && (x.owner === v || x.people.includes(v)))) {
    c.needs.forEach((n, i) => {
      if (n.done) return;
      add({ id: `need-${c.id}-${i}`, kind: 'need', rank: 60 - Math.max(0, c.start - nowMin) / 60, title: n.label, why: `For ${strip(c.title, v).toLowerCase()} at ${fmtTime(c.start)}`, actions: [{ label: 'Done', act: 'need', id: c.id, v: i, primary: true }] });
    });
  }

  // 5. A handoff to read back.
  if (v === 'H' && !s.handoffRead && nowMin >= 12 * 60 && nowMin <= 19 * 60) {
    add({ id: 'handoff', kind: 'handoff', rank: 56, title: 'Handoff from {K} at 6pm', why: 'A handoff ends when you read it back', actions: [{ label: 'Read it', act: 'go', id: 'today', primary: true }] });
  }

  // 6. Tonight's dinner, for whoever cooks.
  const tonight = s.dinner?.plan.find((p) => p.day === day);
  if (tonight && tonight.cook === v && nowMin < 19 * 60) {
    const dish = s.dinner.dishes.find((d) => d.id === tonight.dish);
    if (!dish) {
      add({ id: 'dinner-pick', kind: 'dinner', rank: 52, title: 'You cook tonight, and nothing is chosen yet', why: 'Dinner is at 7pm', actions: [{ label: 'Choose a dish', act: 'go', id: 'dinner', primary: true }] });
    } else {
      const r = checkDish(dish, s.dinner.pantry, day);
      const have = new Set((s.house?.groceries || []).map((g) => g.item.toLowerCase()));
      const short = [...r.missing, ...r.unsure].filter((n) => !have.has(n));
      if (short.length) add({ id: 'dinner-short', kind: 'dinner', rank: 52, title: `For tonight's ${dish.name.toLowerCase()}: ${short.join(', ')}`, why: 'You cook tonight, and these are probably not in the house', actions: [{ label: 'Add to the list', act: 'addMissing', id: dish.id, primary: true }] });
    }
  }

  // 7. Follow ups.
  for (const t of (s.tasks || []).filter((x) => x.owner === v && !x.done)) {
    add({ id: `task-${t.id}`, kind: 'task', rank: 40, title: t.title, why: `Yours, by ${t.due}`, actions: [{ label: 'Done', act: 'tick', id: t.id, primary: true }, { label: 'Later', act: 'later', id: `task-${t.id}` }] });
  }

  // 8. The other driver is over their limit.
  if (me.drives) {
    const load = drivingLoad(s.commitments, s.members);
    for (const m of s.members.filter((x) => x.id !== v && x.drives && load[x.id].over)) {
      if (load[v].over) continue;
      add({ id: `load-${m.id}`, kind: 'load', rank: 35, title: `{${m.id}} is driving ${load[m.id].legs} runs this week; you have ${load[v].legs}`, why: `The limit {${m.id}} set is ${m.maxLegs}`, actions: [{ label: 'Offer to take a run', act: 'go', id: 'rota', primary: true }, { label: 'Later', act: 'later', id: `load-${m.id}` }] });
    }
  }

  // 9. Triage, for this week's captain.
  const captainDuty = s.rota?.duties[0];
  const fresh = (s.triage || []).filter((t) => t.status === 'new').length;
  if (captainDuty && captainDuty.order[captainDuty.current] === v && fresh) {
    add({ id: 'triage', kind: 'triage', rank: 30, title: `${fresh} ${fresh === 1 ? 'thing has' : 'things have'} arrived and ${fresh === 1 ? 'needs' : 'need'} an owner`, why: 'You are triage captain this week', actions: [{ label: 'Open triage', act: 'go', id: 'triage', primary: true }] });
  }

  // 10. A repeat it has noticed, offered to whoever owns it.
  for (const r of openOffers(s.log || [], s.routines || [], s.routinesDeclined || []).filter((x) => x.owner === v)) {
    add({ id: `routine-${r.id}`, kind: 'routine', rank: 20, title: `Make this a routine? ${describeRoutine(r)}`, why: `It has happened ${r.count} weeks running`, actions: [{ label: 'Make it a routine', act: 'routineYes', id: r.id, primary: true }, { label: 'No', act: 'routineNo', id: r.id }] });
  }

  // 11. Check ins. The person chosen is told only when one runs overdue; nobody is tracked.
  for (const c of overdueFor(s.checkins, v, s.now)) {
    add({ id: `ci-${c.id}`, kind: 'checkin', rank: 105, urgent: true, title: `{${c.by}} has not checked in: ${c.label.charAt(0).toLowerCase()}${c.label.slice(1)}, expected by ${fmtTime(minuteOf(c.due))}`, why: `{${c.by}} chose you to be told if this ran over. Nobody is being tracked`, actions: [{ label: 'I have heard from them', act: 'checkinHeard', id: c.id, primary: true }] });
  }
  for (const c of activeBy(s.checkins, v)) {
    const over = isOverdue(c, s.now);
    add({ id: `myci-${c.id}`, kind: 'checkin', rank: over ? 104 : 58, urgent: over, title: `Your check in: ${c.label.charAt(0).toLowerCase()}${c.label.slice(1)}, expected by ${fmtTime(minuteOf(c.due))}`, why: over ? `It is past the time, so {${c.to}} has been told` : `{${c.to}} is told only if you are overdue`, actions: [{ label: 'I have arrived', act: 'checkinArrive', id: c.id, primary: true }] });
  }

  // 12. A reminder you asked for, which stayed quiet unless the thing was still open.
  for (const w of dueWatches(s.watches, s.commitments, v, s.now)) {
    const c = s.commitments.find((x) => x.id === w.cid);
    const asked = `You asked to be told at ${fmtTime(minuteOf(w.at))} if this was still open`;
    const existing = cards.find((x) => x.id === `ack-${c.id}`);
    if (existing) { existing.why = `${existing.why}. ${asked}`; existing.rank = Math.max(existing.rank, 101); existing.urgent = true; continue; }
    add({ id: `watch-${w.id}`, kind: 'watch', rank: 96, urgent: true, title: `Still not confirmed: ${strip(c.title, v).toLowerCase()} at ${fmtTime(c.start)}`, why: asked, actions: me.adult ? [{ label: 'I will take it', act: 'ack', id: c.id, primary: true }, { label: 'Dismiss', act: 'watchDismiss', id: w.id }] : [{ label: 'Dismiss', act: 'watchDismiss', id: w.id, primary: true }] });
  }

  // 13. Something dated that is yours and coming due. Dates only; no numbers are held.
  for (const x of (s.expiries || []).filter((e) => e.owner === v && !e.done)) {
    const actBy = Math.min(x.inDays, x.needBy ?? x.inDays);
    if (actBy - day > 14) continue;
    const overdue = x.inDays < day;
    const title = overdue ? `${x.title} is overdue` : x.kind === 'document' ? `${x.title} expires on ${fmtDayDate(x.inDays)}` : `${x.title}: due ${fmtDayDate(x.inDays)}`;
    add({ id: `exp-${x.id}`, kind: 'expiry', rank: overdue ? 44 : 38, title, why: x.note, actions: [{ label: 'Done', act: 'expiryDone', id: x.id, primary: true }, { label: 'Later', act: 'later', id: `exp-${x.id}` }] });
  }

  // 14. An outing, offered when everyone has the same time free. Always the lowest priority.
  if (me.adult) {
    const next = nextStop(s.adventures);
    const planned = next && s.commitments.some((c) => c.questStop === next.stop.id && c.status !== 'cancelled');
    const window = next && !planned ? bestWindow(s.commitments, s.members.map((m) => m.id), [5, 6].filter((d) => d >= day)) : null;
    if (window) {
      add({ id: `adv-${next.stop.id}`, kind: 'adventure', rank: 12, title: `${DAYS[window.day]} from ${fmtTime(window.from)} is free for everyone. Next on the quest: ${next.stop.place}, ${next.stop.area}?`, why: `It is the next stop on "${next.quest.title}", and nobody has anything on`, actions: [{ label: 'Plan it', act: 'advPlan', id: `${next.quest.id}|${next.stop.id}`, v: `${window.day}|${window.from}`, primary: true }, { label: 'Later', act: 'later', id: `adv-${next.stop.id}` }] });
    }
  }

  cards.sort((a, b) => b.rank - a.rank);

  // Next up: the next three things in this person's day.
  const next = todays.filter((c) => c.end >= nowMin && c.type !== 'school' && involves(c, v)).sort((a, b) => a.start - b.start).slice(0, 3)
    .map((c) => ({ id: c.id, time: c.start, title: strip(c.title, v), note: nextNote(c, v, s) }));

  let lead;
  const top = cards[0];
  if (top && top.rank >= 75) lead = top.kind === 'confirm' ? `${top.title}. Tap to confirm.` : `${top.title}.`;
  else if (next.length) lead = `${top ? 'Nothing urgent.' : 'All clear.'} Next: ${next[0].title.charAt(0).toLowerCase()}${next[0].title.slice(1)} at ${fmtTime(next[0].time)}.`;
  else lead = 'Nothing more today.';

  return { lead, cards, next };
}

function nextNote(c, v, s) {
  if (c.type === 'meal' && c.id.startsWith('dinner-')) {
    const plan = s.dinner?.plan.find((p) => p.day === c.day);
    const dish = plan && s.dinner.dishes.find((d) => d.id === plan.dish);
    const cook = plan ? (plan.cook === v ? 'You cook' : `{${plan.cook}} cooks`) : '';
    return [cook, dish ? dish.name.toLowerCase() : ''].filter(Boolean).join(': ');
  }
  if (c.driver && c.driver !== v) return `{${c.driver}} drives`;
  if (c.driver === v && !c.people.includes(v)) return 'You drive';
  return c.place;
}

// A child's day in a few plain lines. Nothing to manage.
export function childDay(s, v) {
  const day = dayOf(s.now);
  const nowMin = minuteOf(s.now);
  const lines = [];
  for (const c of s.commitments.filter((x) => x.day === day && x.status !== 'cancelled' && x.people.includes(v)).sort((a, b) => a.start - b.start)) {
    if (c.type === 'school') { lines.push({ time: c.start, until: c.end, icon: 'books', text: `School until ${fmtTime(c.end)}`, done: c.end < nowMin }); continue; }
    let text;
    let icon = 'calendar-blank';
    if (c.type === 'pickup') { text = `{${c.owner}} collects you at ${fmtTime(c.start)}`; icon = 'hand-waving'; }
    else if (c.type === 'meal') {
      const plan = s.dinner?.plan.find((p) => p.day === day);
      const dish = plan && c.id.startsWith('dinner-') ? s.dinner.dishes.find((d) => d.id === plan.dish) : null;
      text = `${c.title} at ${fmtTime(c.start)}${plan && c.id.startsWith('dinner-') ? `. {${plan.cook}} cooks${dish ? ` ${dish.name.toLowerCase()}` : ''}` : ''}`;
      icon = 'fork-knife';
    } else {
      text = `${strip(c.title, v)} at ${fmtTime(c.start)}${c.driver ? `. {${c.driver}} takes you` : ''}`;
      icon = c.type === 'medical' ? 'first-aid' : 'backpack';
    }
    const bring = c.needs.filter((n) => !n.done).map((n) => n.label);
    lines.push({ time: c.start, until: c.end, icon, text, bring, done: c.end < nowMin });
  }
  return lines;
}

export { abs };
