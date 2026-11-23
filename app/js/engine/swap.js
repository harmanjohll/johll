// Who could take over a driving run, and what it would do to their week.
// A swap is always a proposal: nothing changes until the other person accepts.

import { legsOf, busyIntervals, isFree } from './clash.js';

export function eligibleDrivers(commitments, members, cars, cid) {
  const c = commitments.find((x) => x.id === cid);
  if (!c || !c.driver) return [];
  const legs = legsOf(c);
  const { people, cars: carBusy } = busyIntervals(commitments);
  const counts = {};
  const byId = new Map(commitments.map((x) => [x.id, x]));
  for (const x of commitments) {
    if (x.status === 'cancelled') continue;
    for (const leg of legsOf(x)) {
      if (byId.get(leg.cid).people.includes(leg.driver)) continue;
      counts[leg.driver] = (counts[leg.driver] || 0) + 1;
    }
  }
  const out = [];
  for (const m of members) {
    if (!m.drives || m.id === c.driver || c.people.includes(m.id)) continue;
    const free = legs.every((leg) => isFree(people, m.id, leg, c.id));
    const usable = cars.filter((car) => car.drivers.includes(m.id));
    const car = usable.find((k) => legs.every((leg) => isFree(carBusy, k.id, leg, c.id)));
    const legsAfter = (counts[m.id] || 0) + legs.length;
    let reason = 'Free, with a car';
    let ok = true;
    if (!free) { ok = false; reason = 'Busy at that time'; }
    else if (!car) { ok = false; reason = usable.length ? `${usable[0].name} is in use` : 'No car'; }
    const overload = ok && legsAfter > m.maxLegs;
    if (overload) reason = `Would be run ${legsAfter} this week; the limit is ${m.maxLegs}`;
    out.push({ id: m.id, car: car ? car.id : null, ok, overload, legsNow: counts[m.id] || 0, legsAfter, reason });
  }
  // Best first: available, not overloaded, lightest week.
  return out.sort((a, b) => Number(b.ok) - Number(a.ok) || Number(a.overload) - Number(b.overload) || a.legsAfter - b.legsAfter);
}
