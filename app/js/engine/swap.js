// Who could take over a driving run, and what it would do to their week.
// A swap is always a proposal: nothing changes until the other person accepts.

import { legsOf, busyIntervals, isFree } from './clash.js';

// options.includeSelf adds the current driver keeping the run by taxi, for when only the car is the problem.
export function eligibleDrivers(commitments, members, cars, cid, options = {}) {
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
    const self = m.id === c.driver;
    if (!m.drives || c.people.includes(m.id) || (self && !options.includeSelf)) continue;
    const free = legs.every((leg) => isFree(people, m.id, leg, c.id));
    const usable = cars.filter((car) => car.drivers.includes(m.id));
    const car = usable.find((k) => legs.every((leg) => isFree(carBusy, k.id, leg, c.id)));
    const legsAfter = (counts[m.id] || 0) + (self ? 0 : legs.length);
    let reason = 'Free, with the car';
    let ok = true;
    let taxi = false;
    if (!free) { ok = false; reason = 'Busy at that time'; }
    else if (!car) { taxi = true; reason = self ? 'Keeps the run and goes by taxi, since the car is needed elsewhere' : 'Free, but the car is in use, so by taxi'; }
    if (self && car) continue; // Nothing to offer: the current driver already has the car.
    const overload = ok && !self && legsAfter > m.maxLegs;
    if (overload) reason = `Would be run ${legsAfter} this week; the limit is ${m.maxLegs}`;
    out.push({ id: m.id, car: car ? car.id : null, ok, taxi, self, overload, legsNow: counts[m.id] || 0, legsAfter, reason });
  }
  // Best first: available, with the car, not overloaded, lightest week.
  return out.sort((a, b) => Number(b.ok) - Number(a.ok) || Number(a.taxi) - Number(b.taxi) || Number(a.overload) - Number(b.overload) || a.legsAfter - b.legsAfter);
}
