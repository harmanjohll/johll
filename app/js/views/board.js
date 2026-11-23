// Board: the ambient kitchen display. It answers "what is happening" with no notification.

import { state, set, nameOf } from '../store.js';
import { esc, icon, avatar, toast, plural } from '../ui.js';
import { dayOf, minuteOf, fmtTime, fmtDate, abs } from '../engine/time.js';

function level(c, nowMin) {
  if (c.end < nowMin) return 'done';
  const undone = c.needs.some((n) => !n.done) || c.ack === 'pending';
  const mins = c.start - nowMin;
  if (undone && mins <= 20) return 'red';
  if (undone && mins <= 75) return 'amber';
  return '';
}

export default {
  render() {
    const day = dayOf(state.now);
    const nowMin = minuteOf(state.now);
    const todays = state.commitments.filter((c) => c.day === day && c.status !== 'cancelled' && !['school', 'rest', 'work'].includes(c.type)).sort((a, b) => a.start - b.start);
    const count = (fn) => todays.filter(fn).length;
    const strip = [[count((c) => c.type === 'pickup'), 'pickup'], [count((c) => c.activity), 'class', 'classes'], [count((c) => c.type === 'medical'), 'clinic visit'], [count((c) => c.driver && !c.people.includes(c.driver)), 'driving run']].filter((x) => x[0]);
    const where = state.members.map((m) => {
      const cur = state.commitments.find((c) => c.day === day && c.people.includes(m.id) && c.start <= nowMin && nowMin < c.end && c.status !== 'cancelled');
      return `<span class="chip">${avatar(m.id, 'sm')}${esc(m.name)}: ${esc(cur ? (cur.type === 'school' ? 'school' : cur.place || cur.title) : 'home')}</span>`;
    }).join('');
    const flags = state.flags || [];
    return `
      <header class="head">
        <div class="between"><h1 class="h1">Board</h1><button class="btn" data-act="full">${icon('arrows-out')}Full screen</button></div>
        <p class="lede">For a tablet in the kitchen. Tickets change colour as they approach with something still undone. Nobody is notified; a glance is enough.</p>
      </header>
      <section class="board" id="board" aria-label="Kitchen board">
        <div class="between">
          <div><div class="board-clock">${fmtTime(nowMin)}</div><div class="board-date">${fmtDate(day)}</div></div>
          <div class="cluster" role="group" aria-label="Move the sample clock">
            <button class="btn small" data-act="clock" data-v="-30">${icon('caret-left')}30 min</button>
            <button class="btn small" data-act="clock" data-v="30">30 min${icon('caret-right')}</button>
            <button class="btn small danger" data-act="flag">${icon('hand-waving')}I am stuck</button>
          </div>
        </div>
        <div class="allday">${strip.map(([n, one, many]) => `<span><b>${n}</b>${n === 1 ? one : many || `${one}s`}</span>`).join('') || '<span>A clear day</span>'}</div>
        <div class="tickets">
          ${flags.map((f, i) => `<div class="ticket red"><div class="t">${fmtTime(f.at)}</div><div class="n">${esc(nameOf(f.by))} needs a hand</div><div class="meta">Raised on the board. Anyone can take it.</div><div><button class="btn small" data-act="unflag" data-v="${i}">Sorted</button></div></div>`).join('')}
          ${todays.map((c) => {
    const lv = level(c, nowMin);
    const undone = c.needs.filter((n) => !n.done).map((n) => n.label);
    return `<div class="ticket ${lv}">
              <div class="between"><span class="t">${fmtTime(c.start)}</span><span class="cluster">${c.people.slice(0, 4).map((p) => avatar(p, 'sm')).join('')}</span></div>
              <div class="n">${esc(c.title)}</div>
              <div class="meta">${c.driver ? `${esc(nameOf(c.driver))} drives. ` : ''}${c.ack === 'pending' && lv !== 'done' ? `${esc(nameOf(c.owner))} has not confirmed. ` : ''}${undone.length && lv !== 'done' ? `Still to do: ${esc(undone.join(', '))}.` : ''}${lv === 'done' ? 'Done.' : ''}</div>
            </div>`;
  }).join('')}
        </div>
        <div class="cluster" aria-label="Who is where">${where}</div>
      </section>
      <p class="rule"><b>Borrowed from restaurant kitchens.</b> A ticket turns amber about an hour out and red inside twenty minutes, but only while something on it is still undone. ${plural(todays.filter((c) => level(c, nowMin) === 'red').length, 'ticket')} red right now.</p>`;
  },
  actions: {
    clock: (d) => { const day = dayOf(state.now); set({ now: Math.max(abs(day, 360), Math.min(abs(day, 1320), state.now + Number(d.v))) }); },
    full: () => { const el = document.getElementById('board'); if (el.requestFullscreen) el.requestFullscreen().catch(() => toast('Full screen is not available here.')); else toast('Full screen is not available here.'); },
    flag: () => { set({ flags: [...(state.flags || []), { by: state.viewer, at: minuteOf(state.now) }] }); toast('Raised. It shows on the board until someone sorts it.'); },
    unflag: (d) => set({ flags: (state.flags || []).filter((_, i) => i !== Number(d.v)) }),
  },
};
