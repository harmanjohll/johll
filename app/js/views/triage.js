// Triage: one intake queue. Every item is accepted, declined with a reason, or snoozed.

import { state, set, commit, nameOf } from '../store.js';
import { esc, icon, avatar, who, SOURCE_ICON, toast, plural } from '../ui.js';

const DUE = ['Today', 'Tomorrow', 'Thursday', 'Friday', 'This weekend'];
const UNTIL = ['Thursday morning', 'The school emails again', "Sunday's family sync"];
let open = null; // { id, mode }

function form(t) {
  if (!open || open.id !== t.id) return '';
  if (open.mode === 'accept') {
    return `<div class="stack" style="background:var(--bg);padding:12px;border-radius:var(--r-control)">
      <div class="cols even">
        <label class="field">Owner<select id="tri-owner">${state.members.filter((m) => m.adult || m.id === 'A1').map((m) => `<option value="${m.id}" ${m.id === state.viewer ? 'selected' : ''}>${esc(nameOf(m.id))}</option>`).join('')}</select><span class="help">The owner holds the remembering, not only the doing.</span></label>
        <label class="field">By<select id="tri-due">${DUE.map((x) => `<option>${x}</option>`).join('')}</select></label>
      </div>
      <div class="cluster"><button class="btn primary small" data-act="doAccept" data-id="${t.id}">Accept</button><button class="btn small quiet" data-act="cancel">Cancel</button></div></div>`;
  }
  if (open.mode === 'decline') {
    return `<div class="stack" style="background:var(--bg);padding:12px;border-radius:var(--r-control)">
      <label class="field">Reason, shown to ${esc(nameOf(t.requester))}<input id="tri-reason" type="text" placeholder="For example: not this term" maxlength="120"><span class="help">A decline without a reason is not allowed.</span></label>
      <div class="cluster"><button class="btn small danger" data-act="doDecline" data-id="${t.id}">Decline</button><button class="btn small quiet" data-act="cancel">Cancel</button></div></div>`;
  }
  return `<div class="stack" style="background:var(--bg);padding:12px;border-radius:var(--r-control)">
    <label class="field">Bring it back when<select id="tri-until">${UNTIL.map((x) => `<option>${x}</option>`).join('')}</select></label>
    <div class="cluster"><button class="btn small primary" data-act="doSnooze" data-id="${t.id}">Snooze</button><button class="btn small quiet" data-act="cancel">Cancel</button></div></div>`;
}

function outcome(t) {
  if (t.status === 'accepted') return `<span class="badge accent">${icon('check')} Accepted</span> ${who(t.owner)} <span class="meta">by ${esc(t.due)}</span>`;
  if (t.status === 'declined') return `<span class="badge calm">Declined</span> <span class="meta">${esc(nameOf(t.requester))} sees: "${esc(t.reason)}"</span>`;
  return `<span class="badge calm">${icon('hourglass')} Snoozed</span> <span class="meta">until ${esc(t.until.charAt(0).toLowerCase() + t.until.slice(1))}</span>`;
}

export default {
  render() {
    const duty = state.rota.duties[0];
    const captain = duty.order[duty.current];
    const next = duty.order[(duty.current + 1) % duty.order.length];
    const fresh = state.triage.filter((t) => t.status === 'new');
    const done = state.triage.filter((t) => t.status !== 'new');
    const carried = fresh.filter((t) => t.carried).length;
    return `
      <header class="head">
        <h1 class="h1">Triage</h1>
        <p class="lede">Everything that arrives lands here first: forwarded emails, screenshots, voice notes, requests. ${fresh.length ? `${plural(fresh.length, 'item')} waiting${carried ? `, ${carried} carried over from last week` : ''}.` : 'The queue is clear.'}</p>
      </header>
      <div class="banner">${icon('flag')}<div>This week's captain is ${who(captain)}. Next week: ${esc(nameOf(next))}. The captain makes sure nothing stays unowned for more than a day. <button class="chip" data-act="capture" style="margin-left:4px">${icon('plus')}Capture something</button></div></div>
      <section class="card flush" aria-label="Waiting">
        ${fresh.map((t) => `<article class="item">
          <div class="between"><div class="src">${icon(SOURCE_ICON[t.source])}<span>${esc(t.from)}</span><span class="mono">${esc(t.received)}</span></div>${t.carried ? `<span class="badge amber">Carried over once</span>` : ''}</div>
          <h2 class="h3">${esc(t.title)}</h2>
          <p class="quote">${esc(t.body)}</p>
          <p class="meta">${icon('lightning')} Suggested ${esc(t.suggestion.kind)}: ${esc(t.suggestion.text)}. Requested by ${esc(nameOf(t.requester))}.</p>
          ${form(t) || `<div class="cluster">
            <button class="btn small primary" data-act="open" data-id="${t.id}" data-v="accept">Accept</button>
            <button class="btn small" data-act="open" data-id="${t.id}" data-v="decline">Decline</button>
            <button class="btn small" data-act="open" data-id="${t.id}" data-v="snooze">Snooze</button></div>`}
        </article>`).join('') || `<div class="empty" style="border:0">Nothing waiting. Capture something with the plus button, or press <kbd>/</kbd>.</div>`}
      </section>
      ${done.length ? `<h2 class="h2">Dealt with</h2><section class="card flush" aria-label="Dealt with">${done.map((t) => `<article class="item done"><div class="between"><b>${esc(t.title)}</b><span class="cluster">${outcome(t)}</span></div></article>`).join('')}</section>` : ''}
      <p class="rule"><b>Borrowed from Linear.</b> A shared intake with a rotating captain. Requests cannot quietly disappear: they are owned, refused with a reason, or parked until a named moment.</p>`;
  },
  actions: {
    open: (d) => { open = { id: d.id, mode: d.v }; set({}); },
    cancel: () => { open = null; set({}); },
    capture: () => document.querySelector('[data-act="palette"]').click(),
    doAccept: (d) => {
      const t = state.triage.find((x) => x.id === d.id);
      const owner = document.getElementById('tri-owner').value;
      const due = document.getElementById('tri-due').value;
      open = null;
      commit(`Triage: accepted "${t.title}", owner ${nameOf(owner)}`, () => {
        Object.assign(t, { status: 'accepted', owner, due });
        state.tasks.push({ id: `task${Date.now()}`, title: t.suggestion.text, owner, due, done: false });
      });
      toast(`${nameOf(owner)} owns it. ${nameOf(t.requester)} has been told.`);
    },
    doDecline: (d) => {
      const t = state.triage.find((x) => x.id === d.id);
      const input = document.getElementById('tri-reason');
      const reason = input.value.trim();
      if (!reason) { input.focus(); input.setAttribute('aria-invalid', 'true'); toast('Add a reason first.'); return; }
      open = null;
      commit(`Triage: declined "${t.title}"`, () => { Object.assign(t, { status: 'declined', reason }); });
    },
    doSnooze: (d) => {
      const t = state.triage.find((x) => x.id === d.id);
      const until = document.getElementById('tri-until').value;
      open = null;
      commit(`Triage: snoozed "${t.title}"`, () => { Object.assign(t, { status: 'snoozed', until }); });
    },
  },
};

export { avatar };
