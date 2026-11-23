// Mirror: the honest picture of load, time and unfinished work. Neutral, factual, no scores.

import { state, set, nameOf } from '../store.js';
import { esc, icon, avatar, who, hue } from '../ui.js';
import { drivingLoad } from '../engine/load.js';

const MOODS = [['good', '#3f9b6b', 'Good'], ['mixed', '#d39a2c', 'Mixed'], ['hard', '#c2493f', 'Hard']];

function hill(projects) {
  const W = 360; const H = 150; const base = 118;
  const y = (t) => base - Math.sin(t * Math.PI) * 78;
  const path = Array.from({ length: 41 }, (_, i) => { const t = i / 40; return `${i ? 'L' : 'M'}${(20 + t * (W - 40)).toFixed(1)} ${y(t).toFixed(1)}`; }).join(' ');
  return `<svg class="hill" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hill chart. ${projects.map((p) => `${p.title}: ${p.pos < 0.5 ? 'still being figured out' : 'being done'}`).join('. ')}." style="max-width:560px">
    <path d="${path}"/><line x1="${W / 2}" y1="34" x2="${W / 2}" y2="${base}" stroke="var(--line)" stroke-dasharray="3 4"/>
    <text x="${W * 0.25}" y="${H - 8}" text-anchor="middle">Figuring it out</text><text x="${W * 0.75}" y="${H - 8}" text-anchor="middle">Getting it done</text>
    ${projects.map((p, i) => { const x = 20 + p.pos * (W - 40); return `<circle cx="${x}" cy="${y(p.pos)}" r="9" fill="var(--p-${state.members.find((m) => m.id === p.owner).hue})" stroke="var(--surface)" stroke-width="2"/><text x="${x}" y="${y(p.pos) + 4}" text-anchor="middle" style="fill:var(--surface);font-size:10px">${i + 1}</text>`; }).join('')}
  </svg>`;
}

export default {
  render() {
    const load = drivingLoad(state.commitments, state.members);
    const drivers = state.members.filter((m) => m.drives);
    const total = drivers.reduce((n, m) => n + load[m.id].legs, 0);
    const top = [...drivers].sort((a, b) => load[b.id].legs - load[a.id].legs)[0];
    const owners = state.members.filter((m) => load[m.id].owned).sort((a, b) => load[b.id].owned - load[a.id].owned);
    const carried = state.triage.filter((t) => t.status === 'new' && t.carried).length;
    const openTasks = state.tasks.filter((t) => !t.done).length;
    const v = state.viewer;
    return `
      <header class="head">
        <h1 class="h1">Mirror</h1>
        <p class="lede">What the week looks like, stated plainly. No scores, no streaks, no league table. It is for the Sunday conversation, not for judging anyone.</p>
      </header>
      <div class="cols even">
        <section class="card stack" aria-label="Driving">
          <h2 class="h2">Driving</h2>
          <p>${esc(top.name)} drives ${load[top.id].legs} of the week's ${total} runs for other people.${load[top.id].over ? ` ${esc(top.name)}'s own limit is ${top.maxLegs}.` : ''}</p>
          ${drivers.map((m) => `<div class="between" style="flex-wrap:nowrap"><span class="who" style="min-width:84px">${avatar(m.id, 'sm')}${esc(m.name)}</span><span style="flex:1;min-width:0"><span class="bar" style="${hue(m.id)};width:${Math.min(100, load[m.id].legs * 7)}%"></span></span><span class="mono">${load[m.id].legs}</span></div>`).join('')}
        </section>
        <section class="card stack" aria-label="Who holds what">
          <h2 class="h2">Who holds the remembering</h2>
          <p>Owning something means noticing it, planning it and seeing it done. This week ${esc(owners[0].name)} owns ${load[owners[0].id].owned} commitments${owners[1] ? `, and ${esc(owners[1].name)} owns ${load[owners[1].id].owned}` : ''}.</p>
          ${owners.map((m) => `<div class="between" style="flex-wrap:nowrap"><span class="who" style="min-width:84px">${avatar(m.id, 'sm')}${esc(m.name)}</span><span style="flex:1;min-width:0"><span class="bar" style="${hue(m.id)};width:${Math.min(100, load[m.id].owned * 7)}%"></span></span><span class="mono">${load[m.id].owned}</span></div>`).join('')}
        </section>
      </div>
      <div class="cols even">
        <section class="card stack" aria-label="Time together">
          <h2 class="h2">Time together</h2>
          <div class="cluster" style="gap:28px">
            <div class="stat"><span class="n">5</span><span class="meta">family dinners planned</span></div>
            <div class="stat"><span class="n">1</span><span class="meta">dinner with someone away</span></div>
            <div class="stat"><span class="n">2</span><span class="meta">one to one times planned</span></div>
          </div>
          <p>Wei and Maya have had no time planned for just the two of them in three weeks. Priya and Kai: Saturday's match counts if Priya goes.</p>
          <p class="meta">Stated, not scored. Nobody is reminded of this unless they ask for it.</p>
        </section>
        <section class="card stack" aria-label="Unfinished">
          <h2 class="h2">Unfinished</h2>
          <div class="cluster" style="gap:28px">
            <div class="stat"><span class="n">${openTasks}</span><span class="meta">open follow ups</span></div>
            <div class="stat"><span class="n">${carried}</span><span class="meta">carried over from last week</span></div>
          </div>
          <p>Anything moved three times asks for a decision: do it, hand it over, or drop it out loud.</p>
        </section>
      </div>
      <section class="card stack" aria-label="Bigger projects">
        <h2 class="h2">Bigger projects</h2>
        ${hill(state.projects)}
        ${state.projects.map((p, i) => `<div class="stack tight"><div class="between"><span><b>${i + 1}. ${esc(p.title)}</b></span>${who(p.owner)}</div>
          <p class="meta">Sized at: ${esc(p.appetite)}. Spent so far: ${esc(p.spent)}.${p.stuckDays >= 7 ? ` Has not moved for ${p.stuckDays} days.` : ''}</p>
          ${p.unknown && p.stuckDays >= 7 ? `<div class="banner amber">${icon('mountains')}<div>Still unknown: ${esc(p.unknown)}. A fifteen minute talk at Sunday's sync may unblock it.</div></div>` : ''}</div>`).join('<hr class="sep">')}
        <p class="rule"><b>Borrowed from Basecamp.</b> Uphill is still figuring it out; downhill is getting it done. Each project is given a size before it starts, so it can be stopped on purpose.</p>
      </section>
      <section class="card stack" aria-label="How today felt">
        <h2 class="h2">How was today, ${esc(nameOf(v))}?</h2>
        <div class="moods" role="group" aria-label="How today felt">${MOODS.map(([id, col, label]) => `<button class="chip" style="min-height:40px;padding:0 14px" data-act="mood" data-v="${id}" aria-pressed="${state.mood[v] === id}"><span class="bar" style="--c:${col};width:10px;height:10px;border-radius:50%"></span>${label}</button>`).join('')}</div>
        <p class="meta">${state.mood[v] ? `Noted as ${MOODS.find((x) => x[0] === state.mood[v])[2].toLowerCase()}. ` : ''}Private to you. A hard day is never shown to anyone; it only offers you a quiet word with a person you choose.</p>
      </section>`;
  },
  actions: {
    mood: (d) => set({ mood: { ...state.mood, [state.viewer]: state.mood[state.viewer] === d.v ? undefined : d.v } }),
  },
};
