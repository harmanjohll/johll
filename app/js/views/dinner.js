// Dinner: who cooks, what is likely in the house, requests, and receipts.

import { state, set, commit, nameOf } from '../store.js';
import { esc, icon, avatar, who, toast, plural, SOURCE_ICON } from '../ui.js';
import { dayOf, fmtTime, DAYS, DAYS_SHORT } from '../engine/time.js';
import { checkDish, levelOf, parseReceipt, addToPantry } from '../engine/pantry.js';

const LEVEL_TEXT = { likely: 'Likely in the house', maybe: 'Maybe; worth a look', unlikely: 'Probably gone' };
let reading = null; // { id, parsed }
const dishOf = (id) => state.dinner.dishes.find((d) => d.id === id);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function checkBlock(dish, today) {
  const r = checkDish(dish, state.dinner.pantry, today);
  const onList = (need) => state.house.groceries.some((g) => g.item.toLowerCase() === need);
  const toAdd = [...r.missing, ...r.unsure].filter((n) => !onList(n));
  return `<div class="stack tight">
    ${r.have.length ? `<p><span class="lvl likely"></span> <b>Likely have:</b> ${r.have.map(esc).join(', ')}</p>` : ''}
    ${r.unsure.length ? `<p><span class="lvl maybe"></span> <b>Not sure:</b> ${r.unsure.map(esc).join(', ')}</p>` : ''}
    ${r.missing.length ? `<p><span class="lvl"></span> <b>Missing:</b> ${r.missing.map(esc).join(', ')}</p>` : ''}
    ${r.ready ? `<p class="meta">${icon('check')} Everything for this is likely in the house.</p>` : toAdd.length ? `<div><button class="btn small" data-act="addMissing" data-id="${dish.id}">${icon('basket')}Add ${plural(toAdd.length, 'item')} to the grocery list</button></div>` : `<p class="meta">${icon('check')} What is missing is already on the grocery list.</p>`}
  </div>`;
}

export default {
  render() {
    const today = dayOf(state.now);
    const v = state.viewer;
    const d = state.dinner;
    const tonight = d.plan.find((p) => p.day === today);
    const block = state.commitments.find((c) => c.id === `dinner-${today}`);
    const dish = tonight && dishOf(tonight.dish);
    const asked = d.requests.filter((r) => r.status === 'asked');
    const groups = { likely: [], maybe: [], unlikely: [] };
    for (const item of d.pantry) groups[item.out ? 'unlikely' : levelOf(item, today)].push(item);

    return `
      <header class="head">
        <h1 class="h1">Dinner</h1>
        <p class="lede">${tonight ? `Tonight ${esc(tonight.cook === v ? 'you cook' : `${nameOf(tonight.cook)} cooks`)}${dish ? `: ${esc(dish.name.toLowerCase())}` : '; nothing is chosen yet'}${block ? `, at ${fmtTime(block.start)}` : ''}.` : 'No dinner is planned at home tonight.'} ${asked.length ? `${plural(asked.length, 'request')} waiting for the cook.` : ''}</p>
      </header>
      <div class="cols two">
        <div class="stack">
          ${tonight ? `<section class="card stack" aria-label="Tonight">
            <div class="between"><h2 class="h2">Tonight${dish ? `: ${esc(dish.name)}` : ''}</h2>${who(tonight.cook, ' cooks')}</div>
            ${dish ? checkBlock(dish, today) : `<p class="meta">No dish chosen. Pick one below, or accept a request.</p>`}
            <label class="field">Change tonight's dish<select data-on="setDish" data-id="${today}"><option value="">Not decided</option>${d.dishes.map((x) => `<option value="${x.id}" ${tonight.dish === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><span class="help">Only the cook decides. Anyone else can ask.</span></label>
          </section>` : ''}
          <section class="card flush" aria-label="This week">
            <div class="item"><h2 class="h2">This week</h2></div>
            ${d.plan.map((p) => {
    const x = dishOf(p.dish);
    const reqs = d.requests.filter((r) => r.day === p.day);
    return `<div class="item">
              <div class="between"><span><b>${DAYS[p.day]}</b> <span class="meta">${x ? esc(x.name) : 'Not decided'}</span></span>${who(p.cook)}</div>
              ${reqs.map((r) => `<div class="banner ${r.status === 'asked' ? 'amber' : ''}">${avatar(r.by, 'sm')}<div>${esc(nameOf(r.by))} asked for <b>${esc(dishOf(r.dish).name.toLowerCase())}</b>. ${r.status === 'accepted' ? 'Accepted.' : r.status === 'declined' ? `Declined: "${esc(r.reason)}"` : `Waiting for ${esc(nameOf(p.cook))}.`}
                ${r.status === 'asked' ? `<div class="cluster" style="margin-top:8px">${p.cook === v ? '' : `<span class="meta">Answer as ${esc(nameOf(p.cook))}:</span>`}<button class="btn small primary" data-act="reqYes" data-id="${r.id}">Accept</button><button class="btn small" data-act="reqNo" data-id="${r.id}">Not this time</button></div>` : ''}</div></div>`).join('')}
            </div>`;
  }).join('')}
          </section>
          <section class="card stack" aria-label="Ask for a dish">
            <h2 class="h2">Ask for something</h2>
            <div class="cols even">
              <label class="field">Dish<select id="req-dish">${d.dishes.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
              <label class="field">Day<select id="req-day">${d.plan.filter((p) => p.day >= today).map((p) => `<option value="${p.day}">${DAYS[p.day]}, ${esc(nameOf(p.cook))} cooks</option>`).join('')}</select></label>
            </div>
            <div><button class="btn primary" data-act="ask">Ask the cook</button></div>
            <p class="rule">A request is a proposal like any other: the cook accepts it or says why not. Nothing is changed for them.</p>
          </section>
        </div>
        <div class="stack">
          <section class="card stack" aria-label="Receipts">
            <h2 class="h2">Receipts</h2>
            <p class="meta">A forwarded order email or a photo of a paper receipt fills the pantry. You confirm what was read before anything is added.</p>
            ${d.receipts.map((r) => `<div class="stack tight">
              <div class="between"><span class="src">${icon(SOURCE_ICON[r.source])}<span>${esc(r.from)}</span></span><span class="meta mono">${esc(r.when)}</span></div>
              ${r.read ? `<p class="meta">${icon('check')} Read and added.</p>` : reading && reading.id === r.id ? `
                <div class="stack tight" style="background:var(--bg);padding:12px;border-radius:var(--r-control)">
                  ${reading.parsed.items.map((i) => `<div class="between"><span>${esc(i.label)} <span class="meta">as ${esc(i.key)}</span></span><span class="mono">${i.qty}</span></div>`).join('')}
                  ${reading.parsed.unrecognised.length ? `<p class="meta">Not recognised, so left out: ${reading.parsed.unrecognised.map((u) => esc(u.label)).join(', ')}.</p>` : ''}
                  <div class="cluster"><button class="btn small primary" data-act="confirmReceipt" data-id="${r.id}">Add ${plural(reading.parsed.items.length, 'item')} to the pantry</button><button class="btn small quiet" data-act="cancelReceipt">Cancel</button></div>
                </div>` : `<div><button class="btn small" data-act="readReceipt" data-id="${r.id}">${icon('receipt')}Read it</button></div>`}
            </div>`).join('<hr class="sep">')}
            <p class="rule">In this prototype the reading is a simple parser over sample text. Reading real emails and photos comes with Phase 3.</p>
          </section>
          <section class="card stack" aria-label="Likely in the house">
            <h2 class="h2">Likely in the house</h2>
            <p class="meta">A receipt says what came in, never what was eaten. So this is a best guess that fades with time, and one tap corrects it.</p>
            ${['likely', 'maybe', 'unlikely'].filter((k) => groups[k].length).map((k) => `<div class="stack tight"><h3 class="h3"><span class="lvl ${k}"></span> ${LEVEL_TEXT[k]}</h3>
              ${groups[k].sort((a, b) => a.label.localeCompare(b.label)).map((item) => `<div class="between"><span>${esc(item.label)} <span class="meta">${item.out ? 'marked as out' : item.bought >= today ? 'bought today' : `bought ${plural(today - item.bought, 'day')} ago`}</span></span>
                ${item.out ? `<button class="btn small quiet" data-act="back" data-id="${item.key}">We have it</button>` : `<button class="btn small quiet" data-act="out" data-id="${item.key}">We are out</button>`}</div>`).join('')}</div>`).join('<hr class="sep">')}
          </section>
          <section class="card stack" aria-label="Grocery list">
            <div class="between"><h2 class="h2">Grocery list</h2><span class="meta">${plural(state.house.groceries.length, 'item')}</span></div>
            ${state.house.groceries.map((g) => `<div class="between"><span>${esc(cap(g.item))}</span><span class="meta">${esc(g.by === 'dinner' ? 'for a dish' : nameOf(g.by))}</span></div>`).join('') || '<p class="meta">Nothing on the list.</p>'}
          </section>
        </div>
      </div>`;
  },
  actions: {
    addMissing: (d) => {
      const dish = dishOf(d.id);
      const r = checkDish(dish, state.dinner.pantry, dayOf(state.now));
      const have = new Set(state.house.groceries.map((g) => g.item.toLowerCase()));
      const add = [...r.missing, ...r.unsure].filter((n) => !have.has(n));
      commit(`Groceries: added ${add.join(', ')} for ${dish.name.toLowerCase()}`, () => { for (const n of add) state.house.groceries.push({ item: n, by: 'dinner' }); });
      toast(`${plural(add.length, 'item')} added to the grocery list.`);
    },
    ask: () => {
      const dish = document.getElementById('req-dish').value;
      const day = Number(document.getElementById('req-day').value);
      const cook = state.dinner.plan.find((p) => p.day === day).cook;
      commit(`${nameOf(state.viewer)} asked for ${dishOf(dish).name.toLowerCase()} on ${DAYS[day]}`, () => { state.dinner.requests.push({ id: `r${Date.now()}`, by: state.viewer, day, dish, status: 'asked', reason: '' }); });
      toast(cook === state.viewer ? 'Noted. You are the cook, so you decide.' : `Asked ${nameOf(cook)}.`);
    },
    reqYes: (d) => {
      const r = state.dinner.requests.find((x) => x.id === d.id);
      commit(`Dinner on ${DAYS[r.day]}: ${dishOf(r.dish).name.toLowerCase()}, asked for by ${nameOf(r.by)}`, () => { r.status = 'accepted'; state.dinner.plan.find((p) => p.day === r.day).dish = r.dish; });
      toast(`${nameOf(r.by)} has been told.`);
    },
    reqNo: (d) => {
      const r = state.dinner.requests.find((x) => x.id === d.id);
      commit(`Dinner request declined: ${dishOf(r.dish).name.toLowerCase()} on ${DAYS[r.day]}`, () => { r.status = 'declined'; r.reason = 'Not this time; ask again next week'; });
    },
    readReceipt: (d) => { const r = state.dinner.receipts.find((x) => x.id === d.id); reading = { id: r.id, parsed: parseReceipt(r.text) }; set({}); },
    cancelReceipt: () => { reading = null; set({}); },
    confirmReceipt: (d) => {
      const r = state.dinner.receipts.find((x) => x.id === d.id);
      const items = reading.parsed.items;
      reading = null;
      commit(`Pantry: added ${items.length} items from ${r.from.toLowerCase()}`, () => { state.dinner.pantry = addToPantry(state.dinner.pantry, items, dayOf(state.now)); r.read = true; });
      toast('Pantry updated.');
    },
    out: (d) => { const item = state.dinner.pantry.find((p) => p.key === d.id); commit(`Pantry: out of ${item.label.toLowerCase()}`, () => { item.out = true; }); },
    back: (d) => { const item = state.dinner.pantry.find((p) => p.key === d.id); commit(`Pantry: have ${item.label.toLowerCase()} after all`, () => { item.out = false; item.bought = dayOf(state.now); }); },
  },
  inputs: {
    setDish: (value, d, el, type) => {
      if (type !== 'change') return;
      const p = state.dinner.plan.find((x) => x.day === Number(d.id));
      commit(`Dinner on ${DAYS[p.day]}: ${value ? dishOf(value).name.toLowerCase() : 'not decided'}`, () => { p.dish = value || null; });
    },
  },
};

export { DAYS_SHORT };
