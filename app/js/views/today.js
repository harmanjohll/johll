// Today: one person's day, with owners, needs and acknowledgements.

import { state, commit, set, member, nameOf } from '../store.js';
import { esc, icon, avatar, who, NEED_ICON, toast, plural } from '../ui.js';
import { dayOf, minuteOf, fmtTime, fmtDate, abs } from '../engine/time.js';
import { downloadWeek } from './connections.js';

// Your own items do not need your name in front: "{H}, late meeting" becomes "Late meeting".
const mine = (title, v) => (title.startsWith(`{${v}}, `) ? title.slice(v.length + 4).replace(/^./, (ch) => ch.toUpperCase()) : title);
const involves = (c, id) => c.people.includes(id) || c.owner === id || c.driver === id;

function row(c, v, nowMin) {
  const past = c.end < nowMin;
  const live = c.start <= nowMin && nowMin <= c.end;
  const role = c.driver === v && !c.people.includes(v) ? 'You drive' : c.owner === v && !c.people.includes(v) ? 'You own this' : '';
  const needs = c.needs.map((n, i) => `<button class="chip ${n.done ? 'done' : 'amber'}" data-act="need" data-id="${c.id}" data-v="${i}" aria-pressed="${n.done}">${icon(n.done ? 'check' : NEED_ICON[n.kind] || 'list-checks')}${esc(n.label)}</button>`).join('');
  let ack = '';
  if (c.ack === 'pending') {
    ack = c.owner === v
      ? `<button class="btn small primary" data-act="ack" data-id="${c.id}">${icon('check')}I have it</button>`
      : `<span class="chip ${c.start - nowMin <= 30 && !past ? 'amber' : ''}">${icon('hourglass')}${esc(nameOf(c.owner))} has not confirmed yet</span>`;
  } else if (c.ack === 'acked') {
    ack = `<span class="chip accent">${icon('check')}${esc(nameOf(c.ackBy || c.owner))} has it</span>`;
  }
  return `<div class="tl-row ${past ? 'past' : ''} ${live ? 'now' : ''}">
    <div class="tl-time"><b>${fmtTime(c.start)}</b>${fmtTime(c.end)}</div>
    <div class="tl-body">
      <div class="between"><div><div class="tl-title">${esc(mine(c.title, v))}</div><div class="meta">${esc(c.place)}${role ? `${c.place ? ', ' : ''}${role.toLowerCase()}` : ''}</div></div>
        ${c.type === 'school' || c.type === 'rest' ? '' : `<span class="cluster"><button class="btn small quiet icon" data-act="ics" data-id="${c.id}" aria-label="Add ${esc(c.title)} to my calendar" title="Add to my calendar">${icon('download-simple')}</button><button class="btn small quiet" data-act="change" data-id="${c.id}" aria-label="Change ${esc(c.title)}">${icon('graph')}Change</button></span>`}</div>
      <div class="cluster">
        ${c.owner && c.type !== 'school' ? `<span class="chip">${avatar(c.owner, 'sm')}Owner: ${esc(nameOf(c.owner))}</span>` : ''}
        ${c.driver ? `<span class="chip">${icon('steering-wheel')}${esc(nameOf(c.driver))} drives</span>` : ''}
        ${c.soft ? `<span class="chip">${icon('hourglass')}${nowMin >= c.hardensAt ? 'Now firm' : `Flexible until ${fmtTime(c.hardensAt)}`}</span>` : ''}
        ${needs}${ack}
      </div>
    </div>
  </div>`;
}

export default {
  render() {
    const v = state.viewer;
    const m = member(v);
    const day = dayOf(state.now);
    const nowMin = minuteOf(state.now);
    const mine = state.commitments.filter((c) => c.day === day && c.status !== 'cancelled' && involves(c, v)).sort((a, b) => a.start - b.start);
    const dayRows = mine.filter((c) => c.start < 17 * 60);
    const evening = mine.filter((c) => c.start >= 17 * 60);
    const tasks = state.tasks.filter((t) => t.owner === v && !t.done);
    const toConfirm = mine.filter((c) => c.ack === 'pending' && c.owner === v && c.end >= nowMin);
    const openNeeds = mine.filter((c) => c.owner === v || c.people.includes(v)).flatMap((c) => c.needs.filter((n) => !n.done).map((n) => ({ c, n })));
    const captain = state.rota.duties[0].order[state.rota.duties[0].current] === v;
    const fresh = state.triage.filter((t) => t.status === 'new').length;
    const attention = toConfirm.length + tasks.length + (captain && fresh ? 1 : 0);
    const showHandoff = v === 'H' || v === 'K';

    return `
      <header class="head">
        <div class="between">
          <h1 class="h1">${fmtDate(day)}</h1>
          <div class="cluster" role="group" aria-label="Move the sample clock">
            <button class="btn small icon" data-act="clock" data-v="-30" aria-label="Back 30 minutes">${icon('caret-left')}</button>
            <span class="mono" style="font-weight:600;min-width:7ch;text-align:center">${fmtTime(nowMin)}</span>
            <button class="btn small icon" data-act="clock" data-v="30" aria-label="Forward 30 minutes">${icon('caret-right')}</button>
          </div>
        </div>
        <p class="lede">${esc(nameOf(v))}, ${attention ? `${plural(attention, 'thing')} ${attention === 1 ? 'needs' : 'need'} you.` : 'nothing is waiting on you.'} ${mine.filter((c) => c.type !== 'school' && c.end >= nowMin).length ? `${plural(mine.filter((c) => c.type !== 'school' && c.end >= nowMin).length, 'commitment')} still ahead today.` : 'The rest of today is clear.'}</p>
      </header>

      <div class="cols two">
        <section class="stack" aria-label="Today's commitments">
          <div class="card flush"><div class="tl">${dayRows.map((c) => row(c, v, nowMin)).join('') || '<div class="empty" style="border:0">Nothing before 5pm.</div>'}</div></div>
          <h2 class="h2">This evening</h2>
          <div class="card flush"><div class="tl">${evening.map((c) => row(c, v, nowMin)).join('') || '<div class="empty" style="border:0">A free evening.</div>'}</div></div>
        </section>

        <aside class="stack">
          <p class="meta">What needs you is on <a href="#/home">Home</a>.</p>

          ${showHandoff ? `<section class="card stack handoff" aria-label="Handoff">
            <div class="between"><h2 class="h2">Handoff at 6pm</h2><span class="cluster">${who('K')}${icon('arrow-right')}${who('H')}</span></div>
            <dl>
              <dt>Happening</dt><dd>${esc('{A2} is home from piano at 5:10pm. {A1} is back from training about 7pm. {H} cooks; dinner at 7pm.')}</dd>
              <dt>Pending</dt><dd>${esc("The reading log for {A2} is not signed. {A1}'s boots are still wet.")}</dd>
              <dt>Watch for</dt><dd>${esc('{A2} has piano theory to finish before bed.')}</dd>
              <dt>If it goes wrong</dt><dd>${esc('{K} is at a class until 8:30pm and reachable by phone after 7:30pm.')}</dd>
            </dl>
            ${state.handoffRead
    ? `<p class="meta">${icon('check')} Read back by ${esc(nameOf(state.handoffRead.by))} at ${fmtTime(state.handoffRead.at)}. ${esc('{K}')} has been told.</p>`
    : (v === 'H' ? `<button class="btn primary" data-act="readback">${icon('check')}Read back: reading log, piano theory</button>` : `<p class="meta">Waiting for ${esc('{H}')} to read it back.</p>`)}
            <p class="rule"><b>Rule 5.</b> Handoffs follow a structure and end in a read back.</p>
          </section>` : ''}
        </aside>
      </div>`;
  },
  actions: {
    need: (d) => {
      const c = state.commitments.find((x) => x.id === d.id);
      const n = c.needs[Number(d.v)];
      commit(`${n.done ? 'Reopened' : 'Done'}: ${n.label} for ${c.title}`, () => { n.done = !n.done; });
    },
    ack: (d) => {
      const c = state.commitments.find((x) => x.id === d.id);
      commit(`${nameOf(state.viewer)} confirmed: ${c.title}`, () => { c.ack = 'acked'; c.ackBy = state.viewer; });
      toast('Confirmed. Nobody else will be asked.');
    },
    ics: (d) => downloadWeek(state.viewer, d.id),
    change: (d) => { set({ draft: { cid: d.id, patch: {}, choices: {} } }); location.hash = '#/ripple'; },
    readback: () => set({ handoffRead: { by: state.viewer, at: minuteOf(state.now) } }),
    clock: (d) => {
      const day = dayOf(state.now);
      const next = Math.max(abs(day, 6 * 60), Math.min(abs(day, 22 * 60), state.now + Number(d.v)));
      set({ now: next });
    },
  },
  inputs: {
    tick: (checked, d) => {
      const t = state.tasks.find((x) => x.id === d.id);
      commit(`Done: ${t.title}`, () => { t.done = true; });
    },
  },
};
