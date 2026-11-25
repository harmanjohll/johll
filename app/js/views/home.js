// Home: the one surface. A lead sentence, a short stack of decisions, what is next,
// and a box to tell or ask. Everything else in the portal is something this draws on.

import { state, set, emit, commit, restore, member, nameOf } from '../store.js';
import { esc, icon, avatar, toast, plural } from '../ui.js';
import { dayOf, minuteOf, fmtTime, fmtDate, abs, DAYS } from '../engine/time.js';
import { brief, childDay } from '../engine/brief.js';
import { ask, examples } from '../engine/ask.js';
import { openOffers } from '../engine/routines.js';
import { findClashes } from '../engine/clash.js';
import { aliasesOf } from '../names.js';
import today from './today.js';
import { planStop } from './adventures.js';
import { downloadWeek } from './connections.js';
import { startWatch, arrive } from '../engine/checkin.js';
import { decide } from '../engine/policy.js';
import { checkDish } from '../engine/pantry.js';
import rota from './rota.js';
import dinner from './dinner.js';

const KIND_ICON = { confirm: 'hand-waving', request: 'arrows-left-right', clash: 'warning', need: 'backpack', handoff: 'list-checks', dinner: 'fork-knife', task: 'check', load: 'steering-wheel', triage: 'tray', routine: 'repeat', checkin: 'timer', watch: 'bell', expiry: 'hourglass', adventure: 'compass' };
const SHOWN = 4;
const Speech = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
let listening = null;
let focusAsk = false;

const people = () => state.members.map((m) => ({ ...m, aliases: aliasesOf(m.id) }));
const isChildView = (m) => m.role === 'child' && !m.device;

function say(from, entry) {
  state.thread = [...state.thread, { from, ...entry }].slice(-8);
}

function newCommitment(p) {
  const who = p.people.length ? p.people : [state.viewer];
  return { id: `cap${Date.now()}`, title: p.title, type: p.type, day: p.day, start: p.start, end: p.end, people: who, owner: state.viewer, driver: null, car: null, legs: null, needs: [], fixed: false, soft: false, hardensAt: null, place: '', activity: null, backup: [], ack: 'none' };
}

// Carry out what the ask box understood.
function run(text) {
  const v = state.viewer;
  const r = ask(text, state, v, people());
  say('me', { text });
  const reply = { text: r.text, bullets: r.bullets, note: r.note };
  let after = null;
  let navigate = null;
  let changed = null;
  if (r.kind === 'proposal') reply.proposal = { parsed: r.parsed, status: 'open' };
  if (r.kind === 'unknown') reply.unknown = r.original;
  if (r.kind === 'action') {
    const d = r.do;
    if (d.type === 'addGrocery') changed = [`Groceries: added ${d.item}`, () => { state.house.groceries.push({ item: d.item, by: v }); }];
    else if (d.type === 'markOut') changed = [`Pantry: out of ${d.key}`, () => { state.dinner.pantry.find((p) => p.key === d.key).out = true; if (d.alsoList && !state.house.groceries.some((g) => g.item.toLowerCase() === d.key)) state.house.groceries.push({ item: d.key, by: v }); }];
    else if (d.type === 'ack') changed = [`${nameOf(v)} confirmed a pickup`, () => { const c = state.commitments.find((x) => x.id === d.cid); c.ack = 'acked'; c.ackBy = v; }];
    else if (d.type === 'askDish') changed = [`${nameOf(v)} asked for a dish on ${DAYS[d.day]}`, () => { state.dinner.requests.push({ id: `r${Date.now()}`, by: v, day: d.day, dish: d.dish, status: 'asked', reason: '' }); }];
    else if (d.type === 'setDish') changed = [`Dinner on ${DAYS[d.day]} chosen`, () => { state.dinner.plan.find((p) => p.day === d.day).dish = d.dish; }];
    else if (d.type === 'openRipple') { state.draft = { cid: d.cid, patch: d.patch, choices: {} }; navigate = 'ripple'; }
    else if (d.type === 'go') navigate = d.route;
    else if (d.type === 'watch') changed = ['Set a reminder that cancels itself', () => { state.watches.push(startWatch({ by: v, cid: d.cid, at: d.at, now: state.now })); }];
    else if (d.type === 'arrive') changed = [`${nameOf(v)} arrived`, () => { state.checkins = state.checkins.map((c) => (c.id === d.id ? arrive(c, state.now) : c)); }];
    else if (d.type === 'ics') after = () => downloadWeek(v);
  }
  say('it', reply);
  focusAsk = !navigate;
  if (changed) commit(changed[0], changed[1]); else emit();
  if (navigate) location.hash = `#/${navigate}`;
  if (after) after();
}

const bump = (action) => { const a = state.automations.find((x) => x.action === action); if (a) a.accepted += 1; };

// "Act, then tell": when the family has let an automation act alone, it does the thing
// and leaves a note saying what it did, with an undo. Only the grocery list can reach this level.
function autoRun() {
  const v = state.viewer;
  const au = state.automations.find((a) => a.action === 'list');
  if (!au || decide(au.action, au.level) !== 'act') return;
  const day = dayOf(state.now);
  const tonight = state.dinner.plan.find((p) => p.day === day);
  if (!tonight || tonight.cook !== v || !tonight.dish) return;
  const key = `list-${day}-${tonight.dish}`;
  if ((state.autoSkipped || []).includes(key)) return;
  const dish = state.dinner.dishes.find((d) => d.id === tonight.dish);
  const r = checkDish(dish, state.dinner.pantry, day);
  const have = new Set(state.house.groceries.map((g) => g.item.toLowerCase()));
  const add = [...r.missing, ...r.unsure].filter((n) => !have.has(n));
  if (!add.length) return;
  const id = `told${Date.now()}`;
  state.told = [...state.told, { id, key, to: v, text: `added ${add.join(', ')} to the grocery list for tonight's ${dish.name.toLowerCase()}`, why: 'You let this one act, then tell. You can change that under What I know', historyId: null }];
  commit(`Added automatically: ${add.join(', ')} for ${dish.name.toLowerCase()}`, () => { for (const n of add) state.house.groceries.push({ item: n, by: 'dinner' }); });
  state.told.find((t) => t.id === id).historyId = state.history[0].id;
}

function cardHtml(c) {
  return `<article class="jcard ${c.urgent || c.rank >= 100 ? 'urgent' : ''}" aria-label="${esc(c.title)}">
    <div class="jcard-icon">${icon(KIND_ICON[c.kind] || 'info')}</div>
    <div class="jcard-body">
      <h2 class="jcard-title">${esc(c.title)}</h2>
      ${c.body ? `<p class="meta">${esc(c.body)}</p>` : ''}
      <p class="why">Why: ${esc(c.why)}.</p>
      <div class="cluster">${c.actions.map((a) => `<button class="btn ${a.primary ? 'primary' : ''}" data-act="card" data-id="${esc(a.id)}" data-v="${a.act}${a.v != null ? `:${a.v}` : ''}">${esc(a.label)}</button>`).join('')}</div>
    </div>
  </article>`;
}

function threadHtml() {
  return state.thread.map((t, i) => {
    if (t.from === 'me') return `<div class="bubble me">${esc(t.text)}</div>`;
    let extra = '';
    if (t.proposal) {
      const p = t.proposal.parsed;
      const clash = t.proposal.status === 'open' && findClashes([...state.commitments, { ...newCommitment(p), id: 'probe' }], state.now).some((k) => k.a === 'probe' || k.b === 'probe');
      extra = `<div class="cluster"><span class="chip">${icon('calendar-blank')}${DAYS[p.day]}</span><span class="chip mono">${fmtTime(p.start)} to ${fmtTime(p.end)}</span>${(p.people.length ? p.people : [state.viewer]).map((id) => `<span class="chip">${avatar(id, 'sm')}${esc(nameOf(id))}</span>`).join('')}</div>
        <p><b>${esc(p.title)}</b>${p.notes.length ? ` <span class="meta">${p.notes.map(esc).join('. ')}.</span>` : ''}</p>
        ${clash ? `<p class="badge red">${icon('warning')} It clashes with something already booked</p>` : ''}
        ${t.proposal.status === 'open' ? `<div class="cluster"><button class="btn primary small" data-act="propYes" data-id="${i}">Add to the week</button><button class="btn small" data-act="propNo" data-id="${i}">Cancel</button></div>` : `<p class="meta">${t.proposal.status === 'added' ? `${icon('check')} Added.` : 'Cancelled. Nothing was added.'}</p>`}`;
    }
    if (t.unknown) extra += t.sent ? `<p class="meta">${icon('check')} Left in triage for a person.</p>` : `<div><button class="btn small" data-act="toTriage" data-id="${i}">${icon('tray')}Leave it in triage for a person</button></div>`;
    return `<div class="bubble it">${t.text ? `<p>${esc(t.text)}</p>` : ''}${t.bullets ? `<ul>${t.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${t.note ? `<p class="why">${esc(t.note)}</p>` : ''}${extra}</div>`;
  }).join('');
}

function askHtml(v) {
  return `<section class="ask" aria-label="Tell or ask">
    ${state.thread.length ? `<div class="thread" id="thread" aria-live="polite">${threadHtml()}</div>` : ''}
    <div class="examples" aria-label="Examples">${examples(state, v).map((e) => `<button class="chip" data-act="example" data-id="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    <form id="ask-form" class="askbar" autocomplete="off">
      <label class="sr" for="ask-input">Tell me or ask me</label>
      <input id="ask-input" type="text" placeholder="Tell me or ask me" enterkeyhint="send" maxlength="160">
      ${Speech ? `<button class="btn icon quiet" type="button" data-act="mic" aria-label="${listening ? 'Stop listening' : 'Speak'}" aria-pressed="${Boolean(listening)}">${icon('microphone')}</button>` : ''}
      <button class="btn icon primary" type="submit" aria-label="Send">${icon('paper-plane-right')}</button>
    </form>
  </section>`;
}

function childHome(v) {
  const day = dayOf(state.now);
  const lines = childDay(state, v);
  const mine = state.dinner.requests.filter((r) => r.by === v);
  const coming = state.dinner.plan.filter((p) => p.day >= day && !mine.some((r) => r.day === p.day && r.status !== 'declined'));
  const target = coming.find((p) => !p.dish) || coming.at(-1);
  return `
    <header class="head"><p class="meta">${fmtDate(day)}</p><h1 class="lead">Hello ${esc(nameOf(v))}. Here is your day.</h1></header>
    <section class="kid" aria-label="Your day">
      ${lines.map((l) => `<div class="kid-line ${l.done ? 'done' : ''}"><span class="kid-icon">${icon(l.done ? 'check' : l.icon)}</span><div><p class="kid-text">${esc(l.text)}</p>${l.bring && l.bring.length && !l.done ? `<p class="meta">Bring: ${l.bring.map(esc).join(', ')}</p>` : ''}</div></div>`).join('') || '<div class="empty">Nothing planned today.</div>'}
    </section>
    <section class="card stack" aria-label="Ask for a dinner">
      <h2 class="h2">Would you like to ask for a dinner?</h2>
      ${mine.map((r) => `<p>${icon(r.status === 'accepted' ? 'check' : 'hourglass')} You asked for ${esc(state.dinner.dishes.find((d) => d.id === r.dish).name.toLowerCase())} on ${DAYS[r.day]}. ${r.status === 'accepted' ? 'Yes.' : r.status === 'declined' ? 'Not this time.' : `${esc(nameOf(state.dinner.plan.find((p) => p.day === r.day).cook))} will decide.`}</p>`).join('')}
      ${target ? `<p class="meta">For ${DAYS[target.day]}. ${esc(nameOf(target.cook))} cooks and decides.</p>
        <div class="cluster">${state.dinner.dishes.map((d) => `<button class="btn" data-act="kidAsk" data-id="${d.id}" data-v="${target.day}">${esc(d.name)}</button>`).join('')}</div>` : ''}
    </section>`;
}

export default {
  render() {
    const v = state.viewer;
    const m = member(v);
    if (isChildView(m)) return childHome(v);
    const day = dayOf(state.now);
    const nowMin = minuteOf(state.now);
    const b = brief(state, v);
    const shown = state.homeAll ? b.cards : b.cards.slice(0, SHOWN);
    const hidden = b.cards.length - shown.length;
    return `
      <header class="head">
        <div class="between">
          <p class="meta">${fmtDate(day)}</p>
          <div class="cluster" role="group" aria-label="Move the sample clock">
            <button class="btn small icon quiet" data-act="clock" data-v="-30" aria-label="Back 30 minutes">${icon('caret-left')}</button>
            <span class="mono" style="font-weight:600;min-width:7ch;text-align:center">${fmtTime(nowMin)}</span>
            <button class="btn small icon quiet" data-act="clock" data-v="30" aria-label="Forward 30 minutes">${icon('caret-right')}</button>
          </div>
        </div>
        <h1 class="lead">${esc(b.lead)}</h1>
      </header>
      <div class="home">
        <section class="stack" aria-label="What needs you">
          ${state.told.filter((t) => t.to === v).map((t) => `<article class="jcard told" aria-label="Done for you"><div class="jcard-icon">${icon('robot')}</div><div class="jcard-body"><h2 class="jcard-title">Done for you: ${esc(t.text)}</h2><p class="why">Why: ${esc(t.why)}.</p><div class="cluster"><button class="btn" data-act="card" data-id="${t.id}" data-v="toldOk">Fine</button><button class="btn" data-act="card" data-id="${t.id}" data-v="toldUndo">Undo</button></div></div></article>`).join('')}
          ${shown.map(cardHtml).join('') || `<div class="empty">Nothing needs you. The others are covering what is theirs.</div>`}
          ${hidden > 0 ? `<button class="btn quiet" data-act="showAll">Show ${plural(hidden, 'more', 'more')}</button>` : state.homeAll && b.cards.length > SHOWN ? `<button class="btn quiet" data-act="showAll">Show fewer</button>` : ''}
        </section>
        <div class="home-side">
          <section class="card stack" aria-label="Next up">
            <div class="between"><h2 class="h2">Next up</h2><a href="#/today">See the whole day</a></div>
            ${b.next.map((n) => `<div class="next"><span class="mono">${fmtTime(n.time)}</span><div><b>${esc(n.title)}</b>${n.note ? `<div class="meta">${esc(n.note)}</div>` : ''}</div></div>`).join('') || '<p class="meta">Nothing more today.</p>'}
          </section>
          ${askHtml(v)}
        </div>
      </div>`;
  },
  mount(root) {
    autoRun();
    const form = root.querySelector('#ask-form');
    if (!form) return;
    const input = root.querySelector('#ask-input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (text) run(text);
    });
    const thread = root.querySelector('#thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
    if (focusAsk) { focusAsk = false; input.focus({ preventScroll: true }); }
  },
  focusAsk() { const el = document.getElementById('ask-input'); if (el) el.focus(); },
  actions: {
    card: (d) => {
      const [act, extra] = d.v.split(':');
      if (act === 'ack') return today.actions.ack({ id: d.id });
      if (act === 'need') return today.actions.need({ id: d.id, v: extra });
      if (act === 'swapYes' || act === 'swapNo') return rota.actions[act]({ id: d.id });
      if (act === 'addMissing') bump('list');
      if (act === 'reqYes' || act === 'reqNo' || act === 'addMissing') return dinner.actions[act]({ id: d.id });
      if (act === 'tick') { const t = state.tasks.find((x) => x.id === d.id); return commit(`Done: ${t.title}`, () => { t.done = true; }); }
      if (act === 'later') return set({ later: [...state.later, d.id] });
      if (act === 'ripple') { set({ draft: { cid: d.id, patch: {}, choices: {} } }); location.hash = '#/ripple'; return null; }
      if (act === 'go') { location.hash = `#/${d.id}`; return null; }
      if (act === 'routineYes') {
        bump('routine');
        const r = openOffers(state.log, state.routines, state.routinesDeclined).find((x) => x.id === d.id);
        commit(`Routine: ${r.key}, every ${DAYS[r.weekday]}`, () => { state.routines.push({ ...r, source: `Noticed over ${r.count} weeks, confirmed by {${state.viewer}}` }); });
        return toast('It is a routine now. You can see it under What I know.');
      }
      if (act === 'routineNo') return commit('Declined a routine offer', () => { state.routinesDeclined.push(d.id); });
      if (act === 'checkinArrive' || act === 'checkinHeard') return commit(act === 'checkinArrive' ? `${nameOf(state.viewer)} arrived` : 'Heard from them; the check in is closed', () => { state.checkins = state.checkins.map((c) => (c.id === d.id ? arrive(c, state.now) : c)); });
      if (act === 'watchDismiss') return commit('Dismissed a reminder', () => { state.watches.find((w) => w.id === d.id).dismissed = true; });
      if (act === 'expiryDone') { const x = state.expiries.find((e) => e.id === d.id); return commit(`Done: ${x.title}`, () => { x.done = true; }); }
      if (act === 'advPlan') { const [q, s] = d.id.split('|'); const [day, from] = extra.split('|').map(Number); return planStop(q, s, day, from); }
      if (act === 'planYes') return commit('Agreed to an outing', () => { const c = state.commitments.find((x) => x.id === d.id); c.pending.asks = c.pending.asks.filter((id) => id !== state.viewer); if (!c.pending.asks.length) delete c.pending; });
      if (act === 'planNo') { commit('Declined an outing; it is off the week', () => { state.commitments.find((x) => x.id === d.id).status = 'cancelled'; }); return toast('Taken off the week. Nothing else changed.'); }
      if (act === 'toldOk') return set({ told: state.told.filter((t) => t.id !== d.id) });
      if (act === 'toldUndo') { const t = state.told.find((x) => x.id === d.id); state.autoSkipped = [...(state.autoSkipped || []), t.key]; state.told = state.told.filter((x) => x.id !== d.id); restore(t.historyId); return toast('Undone. It will ask you next time.'); }
      return null;
    },
    showAll: () => set({ homeAll: !state.homeAll }),
    example: (d) => run(d.id.replace(/\{(\w+)\}/g, (_, id) => nameOf(id))),
    mic: () => {
      if (listening) { listening.stop(); return; }
      const input = document.getElementById('ask-input');
      const rec = new Speech();
      rec.lang = 'en-SG';
      rec.interimResults = true;
      rec.onresult = (e) => { input.value = [...e.results].map((r) => r[0].transcript).join(' '); };
      rec.onend = () => { listening = null; const btn = document.querySelector('[data-act="mic"]'); if (btn) btn.setAttribute('aria-pressed', 'false'); input.focus(); };
      rec.onerror = () => toast('I could not hear that. You can type it instead.');
      listening = rec;
      document.querySelector('[data-act="mic"]').setAttribute('aria-pressed', 'true');
      rec.start();
    },
    propYes: (d) => {
      const t = state.thread[Number(d.id)];
      const c = newCommitment(t.proposal.parsed);
      t.proposal.status = 'added';
      commit(`Added: ${c.title}, ${DAYS[c.day]} ${fmtTime(c.start)}`, () => { state.commitments.push(c); });
      const clash = findClashes(state.commitments, state.now).some((k) => k.a === c.id || k.b === c.id);
      toast(clash ? 'Added. It clashes; there is a card for it above.' : 'Added to the week.');
    },
    propNo: (d) => { state.thread[Number(d.id)].proposal.status = 'cancelled'; emit(); },
    toTriage: (d) => {
      const t = state.thread[Number(d.id)];
      t.sent = true;
      commit('Left a message in triage', () => { state.triage.unshift({ id: `t${Date.now()}`, source: 'typed', from: `{${state.viewer}}`, received: 'Just now', title: t.unknown, body: 'Typed on Home. The portal could not handle it, so it needs a person.', suggestion: { kind: 'task', text: t.unknown }, requester: state.viewer, status: 'new' }); });
    },
    kidAsk: (d) => {
      const dish = state.dinner.dishes.find((x) => x.id === d.id);
      commit(`${nameOf(state.viewer)} asked for ${dish.name.toLowerCase()}`, () => { state.dinner.requests.push({ id: `r${Date.now()}`, by: state.viewer, day: Number(d.v), dish: d.id, status: 'asked', reason: '' }); });
      toast('Asked. The cook will decide.');
    },
    clock: (d) => { const day = dayOf(state.now); set({ now: Math.max(abs(day, 360), Math.min(abs(day, 1320), state.now + Number(d.v))) }); },
  },
};
