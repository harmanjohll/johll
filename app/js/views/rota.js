// Rota and swaps: who holds which duty, dated covers, and swaps as proposals.

import { state, set, commit, nameOf, commitment } from '../store.js';
import { esc, icon, avatar, who, toast } from '../ui.js';
import { fmtTime, DAYS_SHORT } from '../engine/time.js';
import { eligibleDrivers } from '../engine/swap.js';
import { drivingLoad } from '../engine/load.js';

let finding = null;

export default {
  render() {
    const runs = state.commitments.filter((c) => c.driver && !c.people.includes(c.driver) && c.status !== 'cancelled').sort((a, b) => a.day - b.day || a.start - b.start);
    const load = drivingLoad(state.commitments, state.members);
    return `
      <header class="head">
        <h1 class="h1">Rota and swaps</h1>
        <p class="lede">Every duty has one named owner at a time. Covers are dated overrides, and a swap changes nothing until the other person accepts.</p>
      </header>
      <div class="cols even">
        <section class="card stack" aria-label="Duties">
          <h2 class="h2">Duties in rotation</h2>
          ${state.rota.duties.map((d) => `<div class="stack tight">
            <div class="between"><b>${esc(d.title)}</b><button class="btn small" data-act="rotate" data-id="${d.id}">${icon('skip-forward')}Hand to next</button></div>
            <div class="order">${d.order.map((id, i) => `<span class="${i === d.current ? 'turn' : ''}">${avatar(id)}</span>${i < d.order.length - 1 ? icon('caret-right') : ''}`).join('')}<span class="meta" style="margin-left:6px">Now: ${esc(nameOf(d.order[d.current]))}. ${esc(d.note)}.</span></div>
          </div>`).join('<hr class="sep">')}
        </section>
        <section class="card stack" aria-label="Covers">
          <h2 class="h2">Covers this week</h2>
          ${state.rota.overrides.map((o) => `<div class="stack tight">
            <div class="between"><b>${esc(o.title)}</b><span class="mono">${esc(o.when)}</span></div>
            <div class="cluster">${who(o.from)}${icon('arrow-right')}${who(o.to)}</div>
            <p class="meta">${esc(o.reason)}. Both are told when the cover starts and when it ends.</p>
            <div><button class="btn small quiet" data-act="dropCover" data-id="${o.id}">Remove cover</button></div>
          </div>`).join('<hr class="sep">') || '<p class="meta">No covers. The base rota applies.</p>'}
          <p class="rule"><b>Borrowed from on call rotas.</b> A cover sits on top of the rota for a set time, then falls away. The rota itself is never edited for a one off.</p>
        </section>
      </div>
      <section class="card flush" aria-label="Driving runs">
        <div class="item"><h2 class="h2">Driving runs</h2><p class="meta">Ask someone to take a run. Only adults who are free and have a car are offered, and you see what it does to their week first.</p></div>
        ${runs.map((c) => {
    const swap = state.swaps[c.id];
    const options = finding === c.id ? eligibleDrivers(state.commitments, state.members, state.cars, c.id) : [];
    return `<div class="item">
            <div class="between">
              <div><b>${esc(c.title)}</b><div class="meta"><span class="mono">${DAYS_SHORT[c.day]} ${fmtTime(c.start)}</span>, ${esc(nameOf(c.driver))} drives${load[c.driver].over ? ', and is over the limit this week' : ''}</div></div>
              ${swap && swap.status === 'asked' ? '' : `<button class="btn small" data-act="find" data-id="${c.id}" aria-expanded="${finding === c.id}">${finding === c.id ? 'Close' : 'Find cover'}</button>`}
            </div>
            ${swap && swap.status === 'asked' ? `<div class="banner">${icon('hourglass')}<div>Asked ${esc(nameOf(swap.to))}. Nothing has changed; ${esc(nameOf(c.driver))} still drives. The request lapses the evening before.
              <div class="cluster" style="margin-top:8px"><button class="btn small primary" data-act="swapYes" data-id="${c.id}">Answer as ${esc(nameOf(swap.to))}: accept</button><button class="btn small" data-act="swapNo" data-id="${c.id}">Decline</button></div></div></div>` : ''}
            ${swap && swap.status === 'declined' ? `<p class="meta">${esc(nameOf(swap.to))} declined. ${esc(nameOf(c.driver))} still drives.</p>` : ''}
            ${finding === c.id ? `<div class="stack tight">${options.map((o) => `<div class="between" style="padding:8px 12px;border:1px solid var(--line);border-radius:var(--r-control);${o.ok ? '' : 'opacity:.6'}">
              <span>${who(o.id)} <span class="meta">${esc(o.reason)}</span></span>
              <span class="cluster">${o.overload ? `<span class="badge amber">${icon('warning')} Over limit</span>` : ''}${o.ok ? `<button class="btn small primary" data-act="ask" data-id="${c.id}" data-v="${o.id}">Ask</button>` : ''}</span></div>`).join('') || '<p class="meta">Nobody else drives.</p>'}
              ${options.some((o) => o.ok) ? '' : '<p class="meta">Nobody is free with a car. This run has no cover, which the week view also shows.</p>'}</div>` : ''}
          </div>`;
  }).join('')}
      </section>`;
  },
  actions: {
    rotate: (d) => {
      const duty = state.rota.duties.find((x) => x.id === d.id);
      const next = (duty.current + 1) % duty.order.length;
      commit(`${duty.title}: handed from ${nameOf(duty.order[duty.current])} to ${nameOf(duty.order[next])}`, () => { duty.current = next; });
    },
    dropCover: (d) => { const o = state.rota.overrides.find((x) => x.id === d.id); commit(`Removed cover: ${o.title}, ${o.when}`, () => { state.rota.overrides = state.rota.overrides.filter((x) => x.id !== d.id); }); },
    find: (d) => { finding = finding === d.id ? null : d.id; set({}); },
    ask: (d) => {
      const c = commitment(d.id);
      finding = null;
      commit(`Asked ${nameOf(d.v)} to drive: ${c.title}`, () => { state.swaps[d.id] = { to: d.v, status: 'asked' }; });
      toast(`Asked ${nameOf(d.v)}. Nothing changes until there is an answer.`);
    },
    swapYes: (d) => {
      const c = commitment(d.id);
      const swap = state.swaps[d.id];
      const opt = eligibleDrivers(state.commitments, state.members, state.cars, d.id).find((o) => o.id === swap.to);
      commit(`${nameOf(swap.to)} now drives: ${c.title} (was ${nameOf(c.driver)})`, () => { c.driver = swap.to; c.car = opt ? opt.car : c.car; state.swaps[d.id] = { ...swap, status: 'accepted' }; });
      toast('Swap accepted. Both drivers have been told.');
    },
    swapNo: (d) => { const swap = state.swaps[d.id]; commit(`${nameOf(swap.to)} declined to drive: ${commitment(d.id).title}`, () => { state.swaps[d.id] = { ...swap, status: 'declined' }; }); },
  },
};
