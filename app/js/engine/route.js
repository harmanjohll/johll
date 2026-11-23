// Notification routing. The sender states intent; each receiver's contract decides delivery.
// Every delivery carries its reason, so nobody has to guess why they were told.

import { DAY, dayOf, minuteOf, fmtTime } from './time.js';

export const TIER_RANK = { ambient: 0, digest: 1, nudge: 2, interrupt: 3 };
export const TIER_LABEL = { ambient: 'Board only', digest: 'Digest', nudge: 'Nudge', interrupt: 'Interrupt' };
const lowerOf = (a, b) => (TIER_RANK[a] <= TIER_RANK[b] ? a : b);

export function inQuiet(contract, minute) {
  const [start, end] = contract.quiet;
  return start > end ? minute >= start || minute < end : minute >= start && minute < end;
}

export function quietEnd(contract, t) {
  const [start, end] = contract.quiet;
  const day = dayOf(t);
  const minute = minuteOf(t);
  if (start > end && minute >= start) return (day + 1) * DAY + end;
  return day * DAY + end;
}

export function nextDigest(contract, t) {
  const day = dayOf(t);
  const minute = minuteOf(t);
  const today = contract.digestTimes.find((d) => d >= minute);
  if (today != null) return day * DAY + today;
  return (day + 1) * DAY + contract.digestTimes[0];
}

function followTier(contract, about) {
  let best = null;
  for (const f of contract.follows) {
    const hit = f.target.startsWith('activity:') ? about.activity === f.target.slice(9) : (about.people || []).includes(f.target);
    if (hit && (best == null || TIER_RANK[f.tier] > TIER_RANK[best])) best = f.tier;
  }
  return best;
}

function followedName(contract, about, members) {
  for (const f of contract.follows) {
    if (f.target.startsWith('activity:')) {
      if (about.activity === f.target.slice(9)) return about.activityName || f.target.slice(9);
    } else if ((about.people || []).includes(f.target)) {
      return members.find((m) => m.id === f.target)?.name || f.target;
    }
  }
  return '';
}

// event: { id, key, at, intent, about: { people, activity }, to: [{ id, reason, tier }],
//          text, needsAnswer, needsAck, followable }
export function route(event, members, contracts, sent = new Set()) {
  const deliveries = [];
  const suppressed = [];
  const about = event.about || {};
  const direct = new Map((event.to || []).map((r) => [r.id, r]));
  const textFor = (id) => (typeof event.text === 'function' ? event.text(id) : event.text);

  const consider = (member, tier, reason, isDirect) => {
    const contract = contracts[member.id];
    const key = `${member.id}|${event.key || event.id}`;
    if (sent.has(key)) {
      suppressed.push({ to: member.id, eventId: event.id, at: event.at, reason: 'Already told once; the update changes what is shown, with no new alert' });
      return;
    }
    sent.add(key);
    const reasons = [reason];
    if (isDirect && contract.lower && tier === 'nudge' && !event.needsAnswer && !event.needsAck) {
      tier = lowerOf(tier, contract.lower);
      reasons.push('Your rule: one digest a day unless an answer is needed');
    }
    const base = { to: member.id, eventId: event.id, tier, text: textFor(member.id), needsAnswer: Boolean(event.needsAnswer && isDirect), needsAck: Boolean(event.needsAck && isDirect) };
    if (!member.device) {
      deliveries.push({ ...base, channel: 'board', at: event.at, reason: [...reasons, 'No phone, so it shows on the board'].join('. ') });
      return;
    }
    if (tier === 'ambient') {
      deliveries.push({ ...base, channel: 'board', at: event.at, reason: reasons.join('. ') });
    } else if (tier === 'digest') {
      deliveries.push({ ...base, channel: 'digest', at: nextDigest(contract, event.at), reason: reasons.join('. ') });
    } else if (tier === 'nudge') {
      if (inQuiet(contract, minuteOf(event.at))) {
        const at = quietEnd(contract, event.at);
        deliveries.push({ ...base, channel: 'digest', at, deferred: true, reason: [...reasons, `Held until ${fmtTime(minuteOf(at))}: quiet hours`].join('. ') });
      } else {
        deliveries.push({ ...base, channel: 'push', at: event.at, reason: reasons.join('. ') });
      }
    } else {
      deliveries.push({ ...base, channel: 'ring', at: event.at, reason: [...reasons, 'Interrupts ignore quiet hours'].join('. ') });
    }
  };

  const exclude = new Set(event.exclude || []);
  for (const member of members) {
    if (exclude.has(member.id)) continue;
    const d = direct.get(member.id);
    if (d) {
      consider(member, d.tier || event.intent, d.reason, true);
    } else if (event.followable !== false) {
      const ft = followTier(contracts[member.id], about);
      if (ft) {
        // A follower never receives more than a nudge, and never more than the sender intended.
        const tier = lowerOf(lowerOf(event.intent, ft), 'nudge');
        consider(member, tier, `You follow ${followedName(contracts[member.id], about, members)}`, false);
      }
    }
  }
  return { deliveries, suppressed };
}
