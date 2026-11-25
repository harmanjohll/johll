// Check ins and watches: waiting for something to happen, and speaking up only if it does not.
// A check in is started by the person travelling. Nobody is tracked and there is no map:
// the person they chose is told only if the arrival runs overdue.

import { abs, dayOf, minuteOf, fmtTime } from './time.js';

export const GRACE_MIN = 10;

export function startCheckin({ by, to, label, now, due }) {
  return { id: `ci${now}-${by}`, by, to, label, started: now, due, status: 'active', arrivedAt: null };
}

export const isOverdue = (c, now) => c.status === 'active' && now > c.due + GRACE_MIN;
export const arrive = (c, now) => ({ ...c, status: 'arrived', arrivedAt: now });
export const cancel = (c) => ({ ...c, status: 'cancelled' });

// What the chosen person should be told about. Only ever overdue ones, and only theirs.
export const overdueFor = (checkins, viewer, now) => (checkins || []).filter((c) => c.to === viewer && isOverdue(c, now));
export const activeBy = (checkins, viewer) => (checkins || []).filter((c) => c.by === viewer && c.status === 'active');

export function describeCheckin(c, now) {
  if (c.status === 'arrived') return `Arrived at ${fmtTime(minuteOf(c.arrivedAt))}`;
  if (c.status === 'cancelled') return 'Cancelled';
  if (isOverdue(c, now)) return `Overdue: expected by ${fmtTime(minuteOf(c.due))}`;
  return `Expected by ${fmtTime(minuteOf(c.due))}`;
}

// A watch is a reminder that cancels itself: "tell me at 1:15 if nobody has confirmed".
// It is 'waiting' until its time, 'cancelled' the moment the thing is confirmed,
// and 'due' only if the time arrives and the thing is still open.
export function startWatch({ by, cid, at, now }) {
  return { id: `w${now}-${cid}`, by, cid, at, dismissed: false };
}

export function watchState(w, commitments, now) {
  const c = commitments.find((x) => x.id === w.cid);
  if (!c || c.ack !== 'pending' || c.status === 'cancelled') return 'cancelled';
  if (w.dismissed) return 'dismissed';
  return now >= w.at ? 'due' : 'waiting';
}

export const dueWatches = (watches, commitments, viewer, now) => (watches || []).filter((w) => w.by === viewer && watchState(w, commitments, now) === 'due');

export { abs, dayOf };
