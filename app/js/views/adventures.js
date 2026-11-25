// Adventures: quests the family works through together, and places it has been.
// What the family adds is real family data, so it stays on this device only, encrypted.

import { state, set, commit, member, nameOf, saveAdventures } from '../store.js';
import { esc, icon, avatar, toast } from '../ui.js';
import { dayOf, fmtTime, fmtDayDate, DAYS } from '../engine/time.js';
import { progress, average, favourite, nextStop } from '../engine/adventures.js';
import { bestWindow } from '../engine/freetime.js';
import { isUnlocked } from '../names.js';

let rating = null; // The stop being marked as visited: { quest, stop }

const others = (v) => state.members.filter((m) => m.adult && m.id !== v).map((m) => m.id);
const save = () => { saveAdventures(); };

// Put a quest stop into the week. It is a proposal: the other parent is asked.
export function planStop(questId, stopId, day, from) {
  const quest = state.adventures.quests.find((q) => q.id === questId);
  const stop = quest.stops.find((s) => s.id === stopId);
  const v = state.viewer;
  const start = Math.max(from, from >= 17 * 60 ? 18 * 60 : from);
  const c = {
    id: `quest-${stopId}`, title: `Quest: ${stop.place}`, type: 'social', day, start, end: start + 90, people: state.members.map((m) => m.id), owner: v, driver: v, car: 'car1', legs: 'both',
    needs: [], fixed: false, soft: false, hardensAt: null, place: stop.area, activity: null, backup: [], ack: 'none', questStop: stopId, pending: { by: v, asks: others(v) },
  };
  commit(`Planned a quest stop: ${stop.place}, ${DAYS[day]} ${fmtTime(start)}`, () => { state.commitments.push(c); });
  toast(`Pencilled in for ${DAYS[day]} ${fmtTime(start)}. ${others(v).map(nameOf).join(' and ')} is asked.`);
}

function stopRow(q, s) {
  if (rating && rating.quest === q.id && rating.stop === s.id) {
    return `<div class="item stack" style="background:var(--bg)">
      <b>${esc(s.place)}, ${esc(s.area)}</b>
      <div class="cols even">${state.members.map((m) => `<label class="field">${esc(nameOf(m.id))}<select id="rate-${m.id}"><option value="">Did not go</option>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n} out of 5</option>`).join('')}</select></label>`).join('')}</div>
      <label class="field">One line to remember it by<input id="rate-note" type="text" maxlength="100" placeholder="What was it like?"></label>
      <div class="cluster"><button class="btn primary small" data-act="saveVisit">Save the visit</button><button class="btn small quiet" data-act="cancelVisit">Cancel</button></div>
    </div>`;
  }
  if (!s.done) {
    const planned = state.commitments.find((c) => c.questStop === s.id && c.status !== 'cancelled');
    return `<div class="item"><div class="between">
      <span><b>${esc(s.place)}</b> <span class="meta">${esc(s.area)}</span>${planned ? ` <span class="badge accent">${DAYS[planned.day]} ${fmtTime(planned.start)}</span>` : ''}</span>
      <span class="cluster"><button class="btn small" data-act="visit" data-id="${q.id}" data-v="${s.id}">We went</button>${s.own ? `<button class="btn small quiet" data-act="dropStop" data-id="${q.id}" data-v="${s.id}" aria-label="Remove ${esc(s.place)}">${icon('x')}</button>` : ''}</span>
    </div></div>`;
  }
  const avg = average(s);
  return `<div class="item stack tight">
    <div class="between"><span>${icon('check')} <b>${esc(s.place)}</b> <span class="meta">${esc(s.area)}, ${fmtDayDate(s.day)}</span></span>${avg != null ? `<span class="mono" aria-label="Average ${avg.toFixed(1)} out of 5"><b>${avg.toFixed(1)}</b> / 5</span>` : ''}</div>
    <div class="cluster">${Object.entries(s.ratings || {}).map(([id, n]) => `<span class="chip">${avatar(id, 'sm')}${n}</span>`).join('')}</div>
    ${s.note ? `<p class="meta">${esc(s.note)}</p>` : ''}
  </div>`;
}

function questCard(q) {
  const p = progress(q);
  const fav = favourite(q);
  return `<section class="card flush" aria-label="${esc(q.title)}">
    <div class="item stack tight">
      <div class="between"><h2 class="h2">${icon(q.icon || 'compass')} ${esc(q.title)}</h2><span class="mono">${p.done} of ${p.total}</span></div>
      ${q.blurb ? `<p class="meta">${esc(q.blurb)}</p>` : ''}
      <div class="track-bar" role="img" aria-label="${p.done} of ${p.total} stops done"><span style="width:${p.total ? (p.done / p.total) * 100 : 0}%"></span></div>
      ${fav ? `<p>${icon('star')} Running favourite: <b>${esc(fav.place)}</b>, ${esc(fav.area)}, at ${average(fav).toFixed(1)}.</p>` : ''}
    </div>
    ${q.stops.map((s) => stopRow(q, s)).join('')}
    <div class="item"><form class="cluster" data-quest="${q.id}"><label class="sr" for="stop-place-${q.id}">A place to add</label><input class="input" id="stop-place-${q.id}" style="flex:2;min-width:140px" type="text" maxlength="60" placeholder="Add a stop"><label class="sr" for="stop-area-${q.id}">Where it is</label><input class="input" id="stop-area-${q.id}" style="flex:1;min-width:100px" type="text" maxlength="40" placeholder="Area"><button class="btn" type="button" data-act="addStop" data-id="${q.id}">${icon('plus')}Add</button></form></div>
  </section>`;
}

export default {
  render() {
    const adv = state.adventures;
    const v = state.viewer;
    const day = dayOf(state.now);
    const next = nextStop(adv);
    const planned = next && state.commitments.some((c) => c.questStop === next.stop.id && c.status !== 'cancelled');
    const window = next && !planned ? bestWindow(state.commitments, state.members.map((m) => m.id), [5, 6].filter((d) => d >= day)) : null;
    const years = [...new Set(adv.places.map((p) => p.year))].sort((a, b) => b - a);
    let notice;
    if (adv.sample) notice = `<div class="banner">${icon('info')}<div><b>These are samples.</b> Every stall, date and rating here is invented, to show how it works. Clear them to start your own; anything added while the samples are showing is not kept.<div style="margin-top:8px"><button class="btn small" data-act="clearSamples">Clear the samples and start ours</button></div></div></div>`;
    else if (isUnlocked()) notice = `<div class="banner">${icon('lock')}<div><b>Yours, and on this device only.</b> What you add is encrypted and kept in this browser. It is not on the published site, and the other phones cannot see it until the server exists.</div></div>`;
    else notice = `<div class="banner amber">${icon('warning')}<div><b>Sign in to keep what you add.</b> This device is locked, so anything added now is forgotten when the page closes.</div></div>`;
    return `
      <header class="head">
        <h1 class="h1">Adventures</h1>
        <p class="lede">Things to work through together, and where you have been. The portal watches for a time when everyone is free and offers the next stop.</p>
      </header>
      ${notice}
      ${next && window ? `<div class="banner">${icon('compass')}<div><b>${DAYS[window.day]} from ${fmtTime(window.from)} is free for everyone.</b> Next on "${esc(next.quest.title)}": ${esc(next.stop.place)}, ${esc(next.stop.area)}.
        ${member(v).adult ? `<div style="margin-top:8px"><button class="btn small primary" data-act="plan" data-id="${next.quest.id}|${next.stop.id}" data-v="${window.day}|${window.from}">Plan it</button></div>` : ''}</div></div>` : ''}
      <div class="cols even">${adv.quests.map(questCard).join('')}</div>
      <section class="card stack" aria-label="Start a quest">
        <h2 class="h2">Start a new quest</h2>
        <form class="cluster"><label class="sr" for="quest-title">Name of the quest</label><input class="input" id="quest-title" style="flex:1;min-width:200px" type="text" maxlength="60" placeholder="For example: every hawker centre in the east"><button class="btn" type="button" data-act="addQuest">${icon('plus')}Start it</button></form>
      </section>
      <section class="card flush" aria-label="Places we have been">
        <div class="item"><h2 class="h2">${icon('airplane-tilt')} Places we have been</h2></div>
        ${years.map((y) => `<div class="item stack tight"><h3 class="h3 mono">${y}</h3>${adv.places.filter((p) => p.year === y).map((p) => `<div class="between"><span><b>${esc(p.where)}</b>${p.line ? ` <span class="meta">${esc(p.line)}</span>` : ''}</span>${p.own ? `<button class="btn small quiet" data-act="dropPlace" data-id="${p.id}" aria-label="Remove ${esc(p.where)}">${icon('x')}</button>` : ''}</div>`).join('')}</div>`).join('') || `<div class="item"><p class="meta">Nowhere yet. Add the first below.</p></div>`}
        <div class="item"><form class="cluster"><label class="sr" for="place-year">Year</label><input class="input" id="place-year" style="width:92px" type="number" min="1990" max="2100" value="2026"><label class="sr" for="place-where">Where</label><input class="input" id="place-where" style="flex:1;min-width:120px" type="text" maxlength="60" placeholder="Where"><label class="sr" for="place-line">One line</label><input class="input" id="place-line" style="flex:2;min-width:140px" type="text" maxlength="100" placeholder="One line to remember it by"><button class="btn" type="button" data-act="addPlace">${icon('plus')}Add</button></form></div>
      </section>`;
  },
  unmount() { rating = null; },
  actions: {
    clearSamples: () => {
      commit('Cleared the sample adventures', () => { state.adventures = { sample: false, quests: state.adventures.quests.map((q) => ({ id: q.id, icon: q.icon, title: q.title, blurb: q.blurb, stops: [] })), places: [] }; });
      save();
      toast(isUnlocked() ? 'Cleared. What you add now is kept on this device.' : 'Cleared. Sign in to keep what you add.');
    },
    plan: (d) => { const [q, s] = d.id.split('|'); const [day, from] = d.v.split('|').map(Number); planStop(q, s, day, from); },
    visit: (d) => { rating = { quest: d.id, stop: d.v }; set({}); },
    cancelVisit: () => { rating = null; set({}); },
    saveVisit: () => {
      const q = state.adventures.quests.find((x) => x.id === rating.quest);
      const s = q.stops.find((x) => x.id === rating.stop);
      const ratings = {};
      for (const m of state.members) { const val = document.getElementById(`rate-${m.id}`).value; if (val) ratings[m.id] = Number(val); }
      if (!Object.keys(ratings).length) { toast('Say who went by giving at least one rating.'); return; }
      const note = document.getElementById('rate-note').value.trim();
      rating = null;
      commit(`Quest stop visited: ${s.place}`, () => { Object.assign(s, { done: true, day: dayOf(state.now), went: Object.keys(ratings), ratings, note }); });
      save();
    },
    addStop: (d) => {
      const place = document.getElementById(`stop-place-${d.id}`).value.trim();
      const area = document.getElementById(`stop-area-${d.id}`).value.trim();
      if (!place) { document.getElementById(`stop-place-${d.id}`).focus(); return; }
      commit(`Added a quest stop: ${place}`, () => { state.adventures.quests.find((q) => q.id === d.id).stops.push({ id: `s${Date.now()}`, place, area: area || 'Somewhere', done: false, own: true }); });
      save();
    },
    dropStop: (d) => { commit('Removed a quest stop', () => { const q = state.adventures.quests.find((x) => x.id === d.id); q.stops = q.stops.filter((s) => s.id !== d.v); }); save(); },
    addQuest: () => {
      const input = document.getElementById('quest-title');
      const title = input.value.trim();
      if (!title) { input.focus(); return; }
      commit(`Started a quest: ${title}`, () => { state.adventures.quests.push({ id: `q${Date.now()}`, icon: 'compass', title, blurb: '', stops: [], own: true }); });
      save();
    },
    addPlace: () => {
      const where = document.getElementById('place-where').value.trim();
      if (!where) { document.getElementById('place-where').focus(); return; }
      const year = Number(document.getElementById('place-year').value) || 2026;
      const line = document.getElementById('place-line').value.trim();
      commit(`Added a place: ${where}`, () => { state.adventures.places.push({ id: `pl${Date.now()}`, year, where, line, own: true }); });
      save();
    },
    dropPlace: (d) => { commit('Removed a place', () => { state.adventures.places = state.adventures.places.filter((p) => p.id !== d.id); }); save(); },
  },
};
