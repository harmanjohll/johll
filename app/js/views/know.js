// What I know: every routine and preference the portal holds, visible to everyone,
// each with where it came from and a way to remove it.

import { state, commit, nameOf } from '../store.js';
import { esc, icon, avatar, toast } from '../ui.js';
import { openOffers, describeRoutine } from '../engine/routines.js';
import { DAYS, fmtTime, minuteOf } from '../engine/time.js';
import { ACTIONS, LEVELS, LEVEL_LABEL, NEVER, nextLevel, whyLocked, ceiling } from '../engine/policy.js';
import { watchState } from '../engine/checkin.js';

const rank = (l) => LEVELS.indexOf(l);
const WATCH_TEXT = { waiting: 'Waiting', due: 'It told you', cancelled: 'Cancelled itself: it was confirmed', dismissed: 'Dismissed' };

function automationRow(a) {
  const up = nextLevel(a.action, a.level, a.accepted);
  return `<div class="item stack tight">
    <div><b>${esc(a.title)}</b><div class="meta">${esc(ACTIONS[a.action].label)}</div></div>
    <div class="seg" role="group" aria-label="How far it is trusted">${LEVELS.map((l) => {
    const allowed = rank(l) <= rank(a.level) || l === up;
    return `<button data-act="level" data-id="${a.id}" data-v="${l}" aria-pressed="${l === a.level}" ${allowed ? '' : 'disabled'}>${LEVEL_LABEL[l]}</button>`;
  }).join('')}</div>
    <p class="meta">${up ? `${icon('check')} Earned: it has been accepted ${a.accepted} times, so it may now step up to "${LEVEL_LABEL[up].toLowerCase()}" if you choose.` : esc(whyLocked(a.action, a.level, a.accepted))}</p>
  </div>`;
}

export default {
  render() {
    const offers = openOffers(state.log, state.routines, state.routinesDeclined);
    const v = state.viewer;
    const mineFirst = [...state.prefs].sort((a, b) => Number(b.about === v) - Number(a.about === v));
    return `
      <header class="head">
        <h1 class="h1">What I know</h1>
        <p class="lede">Everything the portal has learned or been told about the family. Anyone can read it, and anyone can remove what is about them. Nothing is held that is not listed here.</p>
      </header>
      <section class="card flush" aria-label="Routines">
        <div class="item"><h2 class="h2">Routines</h2><p class="meta">Things that repeat, which the portal plans around.</p></div>
        ${state.routines.map((r) => `<div class="item"><div class="between"><div><b>${esc(describeRoutine(r))}</b><div class="meta">${esc(r.source)}</div></div><button class="btn small quiet" data-act="dropRoutine" data-id="${r.id}">Remove</button></div></div>`).join('') || `<div class="item"><p class="meta">None yet. When something repeats for three weeks, the portal asks whether to make it a routine.</p></div>`}
      </section>
      ${offers.length ? `<section class="card flush" aria-label="Noticed">
        <div class="item"><h2 class="h2">Noticed, not yet a routine</h2><p class="meta">The portal counts repeats. It never decides; it asks the person who owns the activity.</p></div>
        ${offers.map((r) => `<div class="item"><div class="between"><div><b>${esc(describeRoutine(r))}</b><div class="meta">${r.count} weeks running. ${esc(`{${r.owner}}`)} is asked.</div></div>
          <span class="cluster"><button class="btn small primary" data-act="yes" data-id="${r.id}">Make it a routine</button><button class="btn small" data-act="no" data-id="${r.id}">No</button></span></div></div>`).join('')}
      </section>` : ''}
      <section class="card flush" aria-label="Preferences">
        <div class="item"><h2 class="h2">Preferences</h2><p class="meta">Things the portal was told. These are sample entries.</p></div>
        ${mineFirst.map((p) => `<div class="item"><div class="between"><div><span class="who">${avatar(p.about, 'sm')}${esc(nameOf(p.about))}</span><div><b>${esc(p.text)}</b></div><div class="meta">${esc(p.source)}</div></div><button class="btn small quiet" data-act="dropPref" data-id="${p.id}">Remove</button></div></div>`).join('') || `<div class="item"><p class="meta">Nothing held.</p></div>`}
        <div class="item"><form class="cluster" id="pref-form"><label class="sr" for="pref-text">Tell the portal something to remember</label><input class="input" id="pref-text" style="flex:1;min-width:180px" type="text" maxlength="100" placeholder="Something to remember about you"><button class="btn" type="button" data-act="addPref">${icon('plus')}Remember this</button></form></div>
      </section>
      <section class="card flush" aria-label="Automations">
        <div class="item"><h2 class="h2">What it may do, and how far</h2><p class="meta">Each automation starts by suggesting. It can earn the next step only by being accepted, and you can pull it back at any time.</p></div>
        ${state.automations.map(automationRow).join('')}
      </section>
      <section class="card stack" aria-label="The rules">
        <h2 class="h2">The rules it cannot change</h2>
        <p class="meta">These are fixed in code. No setting, and no AI, can move them.</p>
        <div class="cols even">
          <div class="stack tight"><h3 class="h3">May act alone, once trusted</h3><ul class="plain">${Object.values(ACTIONS).filter((x) => x.max === 'tell').map((x) => `<li>${esc(x.label)}</li>`).join('')}</ul></div>
          <div class="stack tight"><h3 class="h3">Always needs a tap</h3><ul class="plain">${Object.values(ACTIONS).filter((x) => x.max === 'ask').map((x) => `<li>${esc(x.label)}</li>`).join('')}</ul></div>
        </div>
        <div class="stack tight"><h3 class="h3">Never</h3><ul class="plain">${NEVER.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </section>
      ${state.watches.filter((w) => w.by === v).length ? `<section class="card flush" aria-label="Watching for you">
        <div class="item"><h2 class="h2">Watching for you</h2><p class="meta">Reminders that speak only if the thing is still open. Ask for one on Home: "remind me at 1:15pm if nobody has confirmed".</p></div>
        ${state.watches.filter((w) => w.by === v).map((w) => { const c = state.commitments.find((x) => x.id === w.cid); const st = watchState(w, state.commitments, state.now); return `<div class="item"><div class="between"><span><b>${esc(c ? c.title : 'Something')}</b> <span class="meta">at ${fmtTime(minuteOf(w.at))}</span></span><span class="badge ${st === 'waiting' ? 'accent' : 'calm'}">${WATCH_TEXT[st]}</span></div></div>`; }).join('')}
      </section>` : ''}
      <p class="rule"><b>How it learns for now.</b> By counting what repeats, and by being told. Nothing here is guessed by an AI, and nothing is inferred about a person without showing it on this page.</p>`;
  },
  actions: {
    yes: (d) => { const r = openOffers(state.log, state.routines, state.routinesDeclined).find((x) => x.id === d.id); commit(`Routine: ${r.key}, every ${DAYS[r.weekday]}`, () => { state.routines.push({ ...r, source: `Noticed over ${r.count} weeks, confirmed by {${state.viewer}}` }); }); },
    no: (d) => commit('Declined a routine offer', () => { state.routinesDeclined.push(d.id); }),
    dropRoutine: (d) => commit('Removed a routine', () => { state.routines = state.routines.filter((r) => r.id !== d.id); state.routinesDeclined.push(d.id); }),
    dropPref: (d) => { commit('Removed something the portal knew', () => { state.prefs = state.prefs.filter((p) => p.id !== d.id); }); toast('Removed. It is no longer held.'); },
    level: (d) => {
      const a = state.automations.find((x) => x.id === d.id);
      if (d.v === a.level) return;
      const allowed = LEVELS.indexOf(d.v) <= LEVELS.indexOf(a.level) || d.v === nextLevel(a.action, a.level, a.accepted);
      if (!allowed || LEVELS.indexOf(d.v) > LEVELS.indexOf(ceiling(a.action))) return;
      const raised = LEVELS.indexOf(d.v) > LEVELS.indexOf(a.level);
      commit(`${a.title}: now "${LEVEL_LABEL[d.v].toLowerCase()}"`, () => { a.level = d.v; if (raised) a.accepted = 0; });
      toast(raised ? 'Stepped up. It starts earning the next step from zero.' : 'Pulled back.');
    },
    addPref: () => {
      const input = document.getElementById('pref-text');
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      commit('Told the portal something to remember', () => { state.prefs.unshift({ id: `pf${Date.now()}`, about: state.viewer, text, source: `Told by {${state.viewer}}, today` }); });
    },
  },
};
