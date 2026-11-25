// Safety: features that help the family look after itself.
// Nothing here tracks anyone, reads anyone's messages, or holds a password or a document number.

import { state, set, commit, member, nameOf } from '../store.js';
import { esc, icon, avatar, who, toast, worksBadge } from '../ui.js';
import { abs, dayOf, minuteOf, fmtTime, fmtDayDate } from '../engine/time.js';
import { checkScam, SCAM_EXAMPLES, HELPLINE } from '../engine/scam.js';
import { startCheckin, arrive, cancel, isOverdue, activeBy, describeCheckin } from '../engine/checkin.js';

// The pasted message and its verdict live only here, in memory, and are cleared on leaving.
let pasted = '';
let verdict = null;

const VERDICT_STYLE = { likely: 'red', caution: 'amber', clear: '' };
const VERDICT_ICON = { likely: 'shield-warning', caution: 'warning', clear: 'shield-check' };

const PLANS = [
  { id: 'scam', title: 'You think you have been scammed', steps: ['Stop. Do not send anything more, and do not stay on the call.', 'Call your bank on the number on the back of your card. Ask them to freeze your accounts: every bank has a kill switch.', `Call the ScamShield helpline on ${HELPLINE}.`, 'Make a police report.', 'Keep the messages and take screenshots. Do not delete the chat.'] },
  { id: 'phone', title: 'A phone is lost or stolen', steps: ['From another device, use Find My (Apple) or Find My Device (Google) to locate it, lock it, or erase it.', 'Call your mobile provider to suspend the SIM, so codes sent by text cannot be read.', 'Change the password of the email account on that phone first, then banking.', 'Tell the family, so nobody trusts a message from that number.', 'On this portal, names stay locked behind the family code on any device that is not unlocked.'] },
  { id: 'hacked', title: 'An account has been taken over', steps: ['From a device you trust, change the password.', 'Turn on two step sign in, and sign out every other session.', 'Check the recovery email and phone number: an intruder often changes them.', 'Warn the family that messages from the account may not be you.', 'Check bank and card activity for anything you do not recognise.'] },
  { id: 'child', title: 'A child is lost in a public place', steps: ['One adult stays where the child was last seen. Another searches.', 'Tell the staff at once. Most venues have a procedure and can watch the exits.', 'If the child is not found within a few minutes, call 999.', 'Agree this beforehand: stay where you are, and ask a member of staff or a parent with children for help.'] },
  { id: 'harass', title: 'Someone is being harassed online', steps: ['Do not reply.', 'Save the evidence: screenshots with the date and the account name.', 'Block the account and report it on the platform.', 'Tell a parent or another adult you trust. Nobody is in trouble for being targeted.', 'If it is serious or it continues, make a police report. In Singapore the Online Safety Commission helps victims of online harm.'] },
];

function scamSection() {
  return `<section class="card stack" aria-label="Scam check">
    <div class="between"><h2 class="h2">${icon('shield-check')} Is this a scam?</h2>${worksBadge('today')}</div>
    <p class="meta">Paste a message that worries you. This is a rule check for the common signs, not an AI. It keeps nothing, and it should never be your only defence.</p>
    <label class="sr" for="scam-text">The message to check</label>
    <textarea id="scam-text" class="input" rows="4" maxlength="2000" placeholder="Paste the message here" data-on="scamInput">${esc(pasted)}</textarea>
    <div class="cluster">
      <button class="btn primary" data-act="scamCheck">Check it</button>
      ${pasted || verdict ? `<button class="btn quiet" data-act="scamClear">Clear</button>` : ''}
    </div>
    <div class="cluster" aria-label="Try an example"><span class="meta">Try an example:</span>${SCAM_EXAMPLES.map((e, i) => `<button class="chip" data-act="scamExample" data-id="${i}">${esc(e.label)}</button>`).join('')}</div>
    ${verdict ? `<div class="banner ${VERDICT_STYLE[verdict.verdict]}" role="status">${icon(VERDICT_ICON[verdict.verdict])}<div class="stack tight">
        <b>${esc(verdict.headline)}</b>
        ${verdict.signs.length ? `<div><span class="meta">What it noticed</span><ul class="plain">${verdict.signs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        <div><span class="meta">What to do</span><ol class="plain">${verdict.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
      </div></div>` : ''}
  </section>`;
}

function safeWordSection(v) {
  const viewer = member(v);
  const done = state.members.filter((m) => state.safeword[m.id]).length;
  return `<section class="card stack" aria-label="Family safe word">
    <div class="between"><h2 class="h2">${icon('key')} A family safe word</h2>${worksBadge('today')}</div>
    <p>A voice on the phone can now be copied. Agree one word, in person, that only the four of you know. If a caller who sounds like family asks for money or says they are in trouble, ask for the word. Then hang up and call back on the number you already have.</p>
    <p class="meta">The word is never typed here. The portal only records who knows it.</p>
    ${state.members.map((m) => {
    const can = m.id === v || (viewer.adult && m.role === 'child' && !m.device);
    return `<div class="between"><span class="who">${avatar(m.id, 'sm')}${esc(nameOf(m.id))}</span>${can
      ? `<button class="chip" data-act="safeword" data-id="${m.id}" aria-pressed="${state.safeword[m.id]}">${icon(state.safeword[m.id] ? 'check' : 'x')}${state.safeword[m.id] ? 'Knows the word' : 'Not yet'}</button>`
      : `<span class="badge ${state.safeword[m.id] ? 'accent' : 'calm'}">${state.safeword[m.id] ? 'Knows the word' : 'Not yet'}</span>`}</div>`;
  }).join('')}
    <p class="meta">${done === state.members.length ? 'Everyone knows it. Say it aloud again every few months so nobody forgets.' : `${done} of ${state.members.length} so far.`}</p>
  </section>`;
}

function checkinSection(v) {
  const viewer = member(v);
  const day = dayOf(state.now);
  const nowMin = minuteOf(state.now);
  const mine = activeBy(state.checkins, v);
  const watching = state.checkins.filter((c) => c.to === v && c.status === 'active');
  const adults = state.members.filter((m) => m.adult && m.id !== v);
  const from = state.commitments.filter((c) => c.day === day && c.status !== 'cancelled' && c.people.includes(v) && c.type !== 'meal' && c.end >= nowMin).sort((a, b) => a.start - b.start);
  const first = Math.ceil((nowMin + 15) / 15) * 15;
  const times = [];
  for (let t = first; t <= 22 * 60 && times.length < 28; t += 15) times.push(t);
  const preferred = from[0] ? Math.min(22 * 60, Math.ceil((from[0].end + 40) / 15) * 15) : first + 30;
  const label = (c) => (c.type === 'school' ? 'Home from school' : `Home from ${c.title.replace(/^\{\w+\},\s*/, '')}`);
  return `<section class="card stack" aria-label="Arrival check in">
    <div class="between"><h2 class="h2">${icon('timer')} Arrival check in</h2><span class="badge calm">${icon('hourglass')} Alerts when closed wait for the server</span></div>
    <p>Start a check in when you set off. The person you choose is told only if you are overdue. There is no map and nobody is followed.</p>
    ${mine.map((c) => `<div class="banner ${isOverdue(c, state.now) ? 'red' : ''}">${icon('timer')}<div><b>${esc(c.label)}</b>. ${esc(describeCheckin(c, state.now))}. ${esc(isOverdue(c, state.now) ? `{${c.to}} has been told.` : `{${c.to}} is told only if you are overdue.`)}
      <div class="cluster" style="margin-top:8px"><button class="btn small primary" data-act="ciArrive" data-id="${c.id}">I have arrived</button><button class="btn small" data-act="ciCancel" data-id="${c.id}">Cancel it</button></div></div></div>`).join('')}
    ${watching.map((c) => `<div class="banner ${isOverdue(c, state.now) ? 'red' : ''}">${avatar(c.by, 'sm')}<div>${esc(`{${c.by}} chose you: ${c.label.charAt(0).toLowerCase()}${c.label.slice(1)}.`)} ${esc(describeCheckin(c, state.now))}.${isOverdue(c, state.now) ? ` <button class="btn small" data-act="ciHeard" data-id="${c.id}" style="margin-left:8px">I have heard from them</button>` : ' You will hear only if it runs over.'}</div></div>`).join('')}
    ${viewer.role === 'child' && !viewer.device ? `<p class="meta">A parent starts a check in with you.</p>` : mine.length ? '' : `
      <div class="cols even">
        <label class="field">The trip<select id="ci-label">${from.map((c) => `<option>${esc(label(c))}</option>`).join('')}<option>Home from somewhere else</option></select></label>
        <label class="field">Expected by<select id="ci-due">${times.map((t) => `<option value="${t}" ${t === preferred ? 'selected' : ''}>${fmtTime(t)}</option>`).join('')}</select></label>
      </div>
      <label class="field">Who is told if you are overdue<select id="ci-to">${adults.map((m) => `<option value="${m.id}">${esc(nameOf(m.id))}</option>`).join('')}</select><span class="help">You choose, and they see that you chose them.</span></label>
      <div><button class="btn primary" data-act="ciStart">Start the check in</button></div>`}
    <p class="meta">Sample clock, to see it run over:</p>
    <div class="cluster" role="group" aria-label="Move the sample clock" style="flex-wrap:nowrap">
      <button class="btn small icon quiet" data-act="clock" data-v="-30" aria-label="Back 30 minutes">${icon('caret-left')}</button><span class="mono" style="font-weight:600">${fmtTime(nowMin)}</span><button class="btn small icon quiet" data-act="clock" data-v="30" aria-label="Forward 30 minutes">${icon('caret-right')}</button></div>
  </section>`;
}

function expirySection(v) {
  const viewer = member(v);
  const day = dayOf(state.now);
  const list = state.expiries.filter((x) => !x.done).sort((a, b) => Math.min(a.inDays, a.needBy ?? a.inDays) - Math.min(b.inDays, b.needBy ?? b.inDays));
  const level = (x) => (x.inDays < day ? 'red' : Math.min(x.inDays, x.needBy ?? x.inDays) - day <= 14 ? 'amber' : 'calm');
  const text = (x) => (x.inDays < day ? 'Overdue' : x.inDays - day <= 14 ? `In ${x.inDays - day} days` : fmtDayDate(x.inDays));
  return `<section class="card stack" aria-label="Expiry and upkeep">
    <div class="between"><h2 class="h2">${icon('hourglass')} Expiry and upkeep</h2>${worksBadge('today')}</div>
    <p class="meta">Dates only. No passport, card or policy numbers are ever held. These are sample entries.</p>
    ${list.map((x) => `<div class="between">
      <div><b>${esc(x.title)}</b><div class="meta">${x.kind === 'document' ? 'Expires' : 'Due'} ${fmtDayDate(x.inDays)}. ${esc(x.note)}.</div></div>
      <span class="cluster"><span class="badge ${level(x)}">${text(x)}</span>${avatar(x.owner, 'sm')}${x.owner === v || viewer.adult ? `<button class="btn small quiet" data-act="expiryDone" data-id="${x.id}">Done</button>` : ''}</span>
    </div>`).join('<hr class="sep">') || '<p class="meta">Nothing coming due.</p>'}
  </section>`;
}

function plansSection() {
  return `<section class="card stack" aria-label="What to do">
    <div class="between"><h2 class="h2">${icon('list-checks')} What to do if</h2>${worksBadge('today')}</div>
    <p class="meta">Short plans to read before you need them. General guidance, not professional advice. In an emergency call 999 for the police, or 995 for an ambulance or the fire service.</p>
    ${PLANS.map((p) => `<details class="plan"><summary>${esc(p.title)}</summary><ol class="plain">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>`).join('')}
  </section>`;
}

export default {
  render() {
    const v = state.viewer;
    return `
      <header class="head">
        <h1 class="h1">Safety</h1>
        <p class="lede">Ways the portal helps the family look after itself. It does not track anyone, read anyone's messages, or hold passwords or document numbers.</p>
      </header>
      <div class="cols even">
        <div class="stack">${scamSection()}${safeWordSection(v)}</div>
        <div class="stack">${checkinSection(v)}${expirySection(v)}</div>
      </div>
      ${plansSection()}
      <p class="rule"><b>Left out on purpose.</b> Medical details and emergency contacts wait until the portal has a proper sign in. A four digit code on a public page is not enough to guard them.</p>`;
  },
  unmount() { pasted = ''; verdict = null; },
  actions: {
    scamCheck: () => { pasted = document.getElementById('scam-text').value; verdict = pasted.trim() ? checkScam(pasted) : null; set({}); },
    scamClear: () => { pasted = ''; verdict = null; set({}); },
    scamExample: (d) => { pasted = SCAM_EXAMPLES[Number(d.id)].text; verdict = checkScam(pasted); set({}); },
    safeword: (d) => commit(`Safe word: {${d.id}} ${state.safeword[d.id] ? 'no longer marked as knowing it' : 'knows it'}`, () => { state.safeword[d.id] = !state.safeword[d.id]; }),
    ciStart: () => {
      const day = dayOf(state.now);
      const label = document.getElementById('ci-label').value;
      const due = abs(day, Number(document.getElementById('ci-due').value));
      const to = document.getElementById('ci-to').value;
      commit(`${nameOf(state.viewer)} started a check in`, () => { state.checkins.push(startCheckin({ by: state.viewer, to, label, now: state.now, due })); });
      toast(`Started. ${nameOf(to)} is told only if you are overdue.`);
    },
    ciArrive: (d) => { commit(`${nameOf(state.viewer)} arrived`, () => { state.checkins = state.checkins.map((c) => (c.id === d.id ? arrive(c, state.now) : c)); }); toast('Arrived. Nobody was troubled.'); },
    ciCancel: (d) => commit('Cancelled a check in', () => { state.checkins = state.checkins.map((c) => (c.id === d.id ? cancel(c) : c)); }),
    ciHeard: (d) => commit('Heard from them; the check in is closed', () => { state.checkins = state.checkins.map((c) => (c.id === d.id ? arrive(c, state.now) : c)); }),
    expiryDone: (d) => { const x = state.expiries.find((e) => e.id === d.id); commit(`Done: ${x.title}`, () => { x.done = true; }); },
    clock: (d) => { const day = dayOf(state.now); set({ now: Math.max(abs(day, 360), Math.min(abs(day, 1320), state.now + Number(d.v))) }); },
  },
  inputs: {
    scamInput: (value) => { pasted = value; },
  },
};

export { who };
