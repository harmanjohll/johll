// Adventures: small helpers for quests the family works through together.

export function progress(quest) {
  const done = quest.stops.filter((s) => s.done).length;
  return { done, total: quest.stops.length };
}

export function average(stop) {
  const values = Object.values(stop.ratings || {});
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// The running favourite: the best average so far. Ties go to the stop more people rated.
export function favourite(quest) {
  const rated = quest.stops.filter((s) => s.done && average(s) != null);
  if (!rated.length) return null;
  return rated.sort((a, b) => average(b) - average(a) || Object.keys(b.ratings).length - Object.keys(a.ratings).length)[0];
}

// The next stop to try: the first one not yet done, in the first quest that has one.
export function nextStop(adventures) {
  for (const quest of adventures?.quests || []) {
    const stop = quest.stops.find((s) => !s.done);
    if (stop) return { quest, stop };
  }
  return null;
}
