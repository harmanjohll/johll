// Seasons and home: classes as terms, plus maintenance that goes by need.

import { state, commit, nameOf } from '../store.js';
import { esc, icon, avatar, who, toast } from '../ui.js';

export default {
  render() {
    const decisions = state.seasons;
    return `
      <header class="head">
        <h1 class="h1">Seasons and home</h1>
        <p class="lede">A class is a season: a term, fees, kit, makeup credits and a renewal decision, each with an owner. Home upkeep goes by need, the way a kitchen judges what is running low.</p>
      </header>
      <div class="cols even">
        ${state.activities.map((a) => {
    const d = decisions[a.id];
    return `<section class="card stack" aria-label="${esc(a.name)}">
          <div class="between"><h2 class="h2">${esc(a.name)}</h2>${who(a.who)}</div>
          <dl class="kv">
            <dt>Provider</dt><dd>${esc(a.provider)}, ${esc(a.contact)}</dd>
            <dt>Term</dt><dd>${esc(a.term)}</dd>
            <dt>Fees</dt><dd>${a.fee === 'Paid' ? 'Paid' : `<span class="badge amber">${esc(a.fee)}</span>`}</dd>
            <dt>Kit</dt><dd>${a.kit.map(esc).join(', ')}</dd>
            <dt>Makeups</dt><dd>${a.makeups ? (a.makeups.left ? `<span class="badge ${a.makeups.left ? 'amber' : 'calm'}">${a.makeups.left} of ${a.makeups.of} left</span> <span class="meta">lost after ${esc(a.makeups.expires)}</span>` : `None left of ${a.makeups.of}`) : 'Not offered'}</dd>
            <dt>Changes arrive by</dt><dd>${esc(a.told)}</dd>
            <dt>Owner</dt><dd>${who(a.owner)}</dd>
          </dl>
          <div class="banner ${d ? '' : 'amber'}">${icon(d ? 'check' : 'hourglass')}<div><b>${d === 'renew' ? 'Renewing.' : d === 'stop' ? 'Stopping after this term.' : `Decide by ${esc(a.renewal.due)}.`}</b> ${esc(a.renewal.note)}.
            ${d ? `<div><button class="btn small quiet" data-act="decide" data-id="${a.id}" data-v="">Reopen the decision</button></div>` : `<div class="cluster" style="margin-top:8px"><button class="btn small primary" data-act="decide" data-id="${a.id}" data-v="renew">Renew</button><button class="btn small" data-act="decide" data-id="${a.id}" data-v="stop">Stop after this term</button></div>`}</div></div>
        </section>`;
  }).join('')}
      </div>
      <div class="cols even">
        <section class="card stack" aria-label="Upkeep">
          <h2 class="h2">Upkeep, by need</h2>
          ${state.house.maintenance.map((x) => `<div class="between"><div><b>${esc(x.title)}</b><div class="meta">${esc(x.last)}. ${esc(x.every)}.</div></div><span class="cluster"><span class="badge ${x.level === 'calm' ? 'calm' : x.level}">${x.level === 'red' ? 'Overdue' : x.level === 'amber' ? 'Getting due' : 'Fine'}</span>${avatar(x.owner, 'sm')}</span></div>`).join('<hr class="sep">')}
        </section>
        <section class="card stack" aria-label="Groceries">
          <h2 class="h2">Groceries</h2>
          <p class="meta">Anyone adds. The weekly shop is Saturday at noon. <a href="#/dinner">Dinner</a> adds what a dish is missing.</p>
          ${state.house.groceries.map((g) => `<div class="between"><span>${esc(g.item)}</span><span class="meta">${esc(nameOf(g.by))}</span></div>`).join('')}
          <form class="cluster" data-form="grocery"><label class="sr" for="g-item">Add an item</label><input class="input" id="g-item" style="flex:1;min-width:140px" type="text" placeholder="Add an item" maxlength="60"><button class="btn" data-act="addItem" type="button">${icon('plus')}Add</button></form>
        </section>
      </div>`;
  },
  actions: {
    decide: (d) => {
      const a = state.activities.find((x) => x.id === d.id);
      commit(d.v ? `${a.name}: ${d.v === 'renew' ? 'renewing' : 'stopping after this term'}` : `${a.name}: decision reopened`, () => { if (d.v) state.seasons[d.id] = d.v; else delete state.seasons[d.id]; });
    },
    addItem: () => {
      const input = document.getElementById('g-item');
      const item = input.value.trim();
      if (!item) { input.focus(); return; }
      commit(`Groceries: added ${item}`, () => { state.house.groceries.push({ item, by: state.viewer }); });
      toast('Added to the list.');
    },
  },
};
