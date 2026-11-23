// Week: people by day, with load levelled and red days visible at a glance.

import { state, set, nameOf, commitment } from '../store.js';
import { esc, icon, avatar, hue, plural } from '../ui.js';
import { fmtTime, DAYS, DAYS_SHORT, WEEK_START_DATE, dayOf, abs } from '../engine/time.js';
import { findClashes } from '../engine/clash.js';
import { drivingLoad, dayPressure, describePressure } from '../engine/load.js';
import { applyPatches } from '../engine/ripple.js';

const LEVEL = { calm: ['calm', 'Calm'], busy: ['amber', 'Busy'], red: ['red', 'Clash'] };

function current() {
  const w = state.whatIf;
  return w ? applyPatches(state.commitments, [{ cid: w.cid, patch: w.patch }]) : state.commitments;
}

export default {
  render() {
    const list = current();
    const today = dayOf(state.now);
    const clashes = findClashes(list, state.now);
    const pressure = dayPressure(list, state.members, state.cars, state.now);
    const load = drivingLoad(list, state.members);
    const hot = new Set(clashes.filter((k) => k.severity === 'hard').flatMap((k) => [`${k.a}|${k.who}`, `${k.b}|${k.who}`]));
    const hotCar = new Set(clashes.filter((k) => k.kind === 'car' && k.severity === 'hard').flatMap((k) => [k.a, k.b]));
    const w = state.whatIf;
    const sel = state.weekSel && list.find((c) => c.id === state.weekSel);
    const over = state.members.filter((m) => load[m.id].over);
    const totalRuns = Object.values(load).reduce((n, r) => n + r.legs, 0);

    const head = `<div class="w-name w-head"><span class="meta">Who</span></div>${pressure.map((p) => `<div class="w-head ${p.level === 'calm' ? '' : p.level}">
        <div class="between"><span class="w-day">${DAYS_SHORT[p.day]} <span class="meta mono">${WEEK_START_DATE + p.day}</span></span><span class="badge ${LEVEL[p.level][0]}">${LEVEL[p.level][1]}</span></div>
        <span class="meta">${esc(describePressure(p))}</span></div>`).join('')}`;

    const shared = (c) => c.people.length >= 5;
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const everyone = `<div class="w-name"><span class="who">${icon('users-three')}Everyone</span><span class="meta">Shared time</span></div><div class="w-all">${Array.from({ length: 7 }, (_, day) => `<div>${list.filter((c) => c.day === day && shared(c) && c.status !== 'cancelled').map((c) => {
      const squeezed = clashes.some((k) => k.a === c.id || k.b === c.id);
      return `<button class="blk ${squeezed ? 'clash' : ''} ${state.weekSel === c.id ? 'sel' : ''}" style="--c:var(--accent)" data-act="sel" data-id="${c.id}" data-v="all" aria-label="${esc(`${c.title}, ${DAYS[day]} ${fmtTime(c.start)}${c.soft ? ', flexible' : ''}`)}"><b>${esc(c.title)}</b><span class="mono">${fmtTime(c.start)}</span>${c.soft ? ` <span class="meta">${state.now >= abs(c.day, c.hardensAt) ? 'firm' : 'flexible'}</span>` : ''}</button>`;
    }).join('')}</div>`).join('')}</div>`;

    const rows = state.members.map((m) => {
      const cells = Array.from({ length: 7 }, (_, day) => {
        const mine = list.filter((c) => c.day === day && c.status !== 'cancelled' && (c.people.includes(m.id) || (c.driver === m.id)) && c.type !== 'school' && !shared(c)).sort((a, b) => a.start - b.start);
        const school = list.find((c) => c.day === day && c.type === 'school' && c.people.includes(m.id));
        const blocks = mine.map((c) => {
          const run = c.driver === m.id && !c.people.includes(m.id);
          const clash = hot.has(`${c.id}|${m.id}`) || (run && hotCar.has(c.id));
          const ghost = w && w.cid === c.id;
          return `<button class="blk ${run ? 'run' : ''} ${clash ? 'clash' : ''} ${ghost ? 'ghost' : ''} ${state.weekSel === c.id ? 'sel' : ''}" style="${hue(run ? m.id : (c.people.includes(m.id) ? m.id : c.owner))}" draggable="${c.type !== 'rest'}" data-act="sel" data-id="${c.id}" data-v="${m.id}" aria-label="${esc(`${c.title}, ${DAYS[day]} ${fmtTime(c.start)}${run ? ', driving' : ''}${clash ? ', clashes' : ''}`)}">
            <b>${run ? `${icon('steering-wheel')} ` : ''}${esc(run ? `Drives ${c.people.map(nameOf).join(', ')}` : cap(c.title.replace(`${m.name}, `, '')))}</b><span class="mono">${fmtTime(c.start)}</span>${clash ? ` ${icon('warning', 'Clash')}` : ''}</button>`;
        }).join('');
        return `<div class="w-cell ${day === today ? 'today' : ''}" data-day="${day}">${school ? `<div class="meta" style="font-size:11px;margin-bottom:4px">School to ${fmtTime(school.end)}</div>` : ''}${blocks}</div>`;
      }).join('');
      const l = load[m.id];
      return `<div class="w-name"><span class="who">${avatar(m.id, 'sm')}${esc(m.name)}</span>
        ${m.drives ? `<span class="meta">${l.legs} of ${m.maxLegs} runs</span>${l.over ? `<span class="badge amber">${icon('warning')} Over</span>` : ''}` : `<span class="meta">${esc(m.label)}</span>`}</div>${cells}`;
    }).join('');

    return `
      <header class="head">
        <h1 class="h1">The week ahead</h1>
        <p class="lede">${pressure.some((p) => p.level === 'red') ? `${pressure.filter((p) => p.level === 'red').map((p) => DAYS[p.day]).join(' and ')} has a clash.` : 'No clashes this week.'} ${totalRuns} driving runs for other people, ${plural(pressure.reduce((n, p) => n + p.noCover.length, 0), 'run')} with nobody free to cover.</p>
      </header>
      ${w ? `<div class="banner amber" role="status">${icon('eye')}<div><b>What if:</b> ${esc(commitment(w.cid).title)} on ${DAYS[w.patch.day ?? commitment(w.cid).day]}${w.patch.start != null ? ` at ${fmtTime(w.patch.start)}` : ''}. Not saved; nobody has been told.
        <div class="cluster" style="margin-top:8px"><button class="btn small primary" data-act="toRipple">${icon('graph')}Propose it in Ripple</button><button class="btn small" data-act="clearIf">Discard</button></div></div></div>` : ''}
      ${over.length ? `<div class="banner amber">${icon('warning')}<div><b>${over.map((m) => esc(m.name)).join(' and ')} ${over.length === 1 ? 'is' : 'are'} over the driving limit ${over.length === 1 ? 'they' : 'they each'} set.</b> The Sunday plan does not lock until a run is handed over. <a href="#/rota">Find cover</a></div></div>` : ''}
      <div class="week-wrap" tabindex="0" role="region" aria-label="Week grid, scrolls sideways"><div class="week" id="week-grid">${head}${everyone}${rows}</div></div>
      ${sel ? `<section class="card stack" aria-label="Selected commitment">
        <div class="between"><h2 class="h2">${esc(sel.title)}</h2><span class="mono">${DAYS_SHORT[sel.day]} ${fmtTime(sel.start)} to ${fmtTime(sel.end)}</span></div>
        <div class="field">What if it moved to
          <div class="seg" role="group" aria-label="Try another day">${DAYS_SHORT.map((n, i) => `<button data-act="tryDay" data-v="${i}" aria-pressed="${i === sel.day}">${n}</button>`).join('')}</div>
        </div>
        <div class="cluster"><button class="btn small" data-act="toRipple">${icon('graph')}Open in Ripple</button><button class="btn small quiet" data-act="unsel">Close</button></div>
        <p class="meta">On a laptop you can also drag a block to another day.</p>
      </section>` : `<p class="meta">Tap a block to try moving it. Dashed blocks are driving runs. Nothing is saved until it is proposed and confirmed.</p>`}
      <section class="card stack" aria-label="Driving load">
        <h2 class="h2">Who is carrying the driving</h2>
        ${state.members.filter((m) => m.drives).map((m) => `<div class="between" style="flex-wrap:nowrap"><span class="who" style="min-width:84px">${avatar(m.id, 'sm')}${esc(m.name)}</span><span style="flex:1;min-width:0"><span class="bar" style="${hue(m.id)};width:${Math.min(100, load[m.id].legs * 7)}%"></span></span><span class="mono" style="white-space:nowrap">${load[m.id].legs} of ${m.maxLegs}</span></div>`).join('')}
        <p class="rule"><b>Borrowed from shift scheduling.</b> Each driver sets a weekly limit. Going over is allowed, but it is always shown.</p>
      </section>`;
  },
  mount(root) {
    const grid = root.querySelector('#week-grid');
    if (!grid) return;
    grid.addEventListener('dragstart', (e) => { const b = e.target.closest('.blk'); if (b) e.dataTransfer.setData('text/plain', b.dataset.id); });
    grid.addEventListener('dragover', (e) => { const cell = e.target.closest('.w-cell'); if (cell) { e.preventDefault(); cell.classList.add('drop'); } });
    grid.addEventListener('dragleave', (e) => { const cell = e.target.closest('.w-cell'); if (cell) cell.classList.remove('drop'); });
    grid.addEventListener('drop', (e) => {
      const cell = e.target.closest('.w-cell');
      const id = e.dataTransfer.getData('text/plain');
      if (!cell || !id) return;
      e.preventDefault();
      const c = commitment(id);
      const day = Number(cell.dataset.day);
      if (c && day !== c.day) set({ whatIf: { cid: id, patch: { day } }, weekSel: id });
    });
  },
  actions: {
    sel: (d) => set({ weekSel: state.weekSel === d.id ? null : d.id }),
    unsel: () => set({ weekSel: null }),
    tryDay: (d) => {
      const c = commitment(state.weekSel);
      const day = Number(d.v);
      set({ whatIf: day === c.day ? null : { cid: c.id, patch: { day } } });
    },
    clearIf: () => set({ whatIf: null }),
    toRipple: () => {
      const w = state.whatIf;
      const cid = w ? w.cid : state.weekSel;
      set({ draft: { cid, patch: w ? { ...w.patch } : {}, choices: {} }, whatIf: null });
      location.hash = '#/ripple';
    },
  },
};

