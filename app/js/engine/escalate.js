// Silence escalates. Every alert that matters has an acknowledgement deadline
// and a named next person. The chain stops the moment anyone takes it.

export function escalationTimeline({ chain, start, windowMin, acks = {}, repeat = 1 }) {
  const steps = [];
  let ackedBy = null;
  let ackedAt = null;
  const firstAck = () => {
    let best = null;
    for (const [id, at] of Object.entries(acks)) {
      if (at == null) continue;
      if (best == null || at < best.at) best = { id, at };
    }
    return best;
  };
  const ack = firstAck();
  const total = chain.length * repeat;
  for (let i = 0; i < total; i += 1) {
    const at = start + i * windowMin;
    if (ack && ack.at <= at) break;
    steps.push({ to: chain[i % chain.length], at, step: i, deadline: at + windowMin });
  }
  if (ack) {
    // An acknowledgement only counts from someone who has been asked, or anyone in the chain.
    ackedBy = ack.id;
    ackedAt = ack.at;
  }
  const exhausted = !ack && steps.length === total;
  return { steps, ackedBy, ackedAt, exhausted, endsAt: start + total * windowMin };
}
