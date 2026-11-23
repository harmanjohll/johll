// Ripple: change one commitment and see everything it touches, as a proposal to confirm.

import { state, set, commit, household, nameOf, commitment, member } from '../store.js';
import { esc, icon, avatar, who, toast, CHANNEL, plural } from '../ui.js';
import { fmtTime, DAYS, DAYS_SHORT, minuteOf, dayOf } from '../engine/time.js';
import { propose, openSlots } from '../engine/ripple.js';
import { route } from '../engine/route.js';

const DEFAULT = { cid: 'dentist', patch: {}, choices: {} };
const draft = () => state.draft || DEFAULT;
const movable = () => state.commitments.filter((c) => !['school', 'rest'].includes(c.type) && c.status !== 'cancelled');

function graph(p) {
  const W = 360;
  const core = { x: W / 2, y: 34 };
  const people = p.affected.slice(0, 5);
  const things = [...p.groups.map((g) => ({ label: g.commitment.title, sub: g.summary, hot: !g.chosen && g.clashes.some((k) => k.severity === 'hard'), soft: g.kind === 'soft' })),
    ...p.carsTouched.map((id) => ({ label: state.cars.find((c) => c.id === id).name, sub: 'Shared car', hot: p.remaining.some((k) => k.kind === 'car' && k.who === id) }))];
  const px = (i, n) => (n === 1 ? W / 2 : 36 + (i * (W - 72)) / (n - 1));
  const peopleY = 128;
  const thingY = 226;
  const wrap = (s, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  let out = '';
  people.forEach((a, i) => {
    const x = px(i, people.length);
    out += `<path class="edge ${a.needsAnswer ? 'ask' : ''}" d="M${core.x} ${core.y + 20} C ${core.x} ${peopleY - 50}, ${x} ${peopleY - 60}, ${x} ${peopleY - 18}"/>`;
  });
  things.forEach((t, i) => {
    const x = things.length === 1 ? W / 2 : 70 + (i * (W - 140)) / (things.length - 1);
    out += `<path class="edge ${t.hot ? 'hot' : ''}" d="M${core.x} ${core.y + 20} C ${core.x + (x < core.x ? -150 : 150)} ${peopleY}, ${x} ${thingY - 70}, ${x} ${thingY - 20}"/>`;
  });
  out += `<rect class="node core" x="${core.x - 110}" y="${core.y - 20}" width="220" height="40" rx="10"/><text x="${core.x}" y="${core.y - 1}" text-anchor="middle">${esc(wrap(p.before.title, 30))}</text><text class="sub" x="${core.x}" y="${core.y + 13}" text-anchor="middle">${DAYS_SHORT[p.before.day]} ${fmtTime(p.before.start)} to ${DAYS_SHORT[p.after.day]} ${fmtTime(p.after.start)}</text>`;
  people.forEach((a, i) => {
    const x = px(i, people.length);
    const m = member(a.id);
    out += `<circle cx="${x}" cy="${peopleY}" r="17" fill="var(--surface)" stroke="var(--p-${m.hue})" stroke-width="2"/><text x="${x}" y="${peopleY + 4}" text-anchor="middle" style="fill:var(--p-${m.hue})">${esc(m.name[0])}</text><text x="${x}" y="${peopleY + 33}" text-anchor="middle">${esc(m.name)}</text><text class="sub" x="${x}" y="${peopleY + 46}" text-anchor="middle">${a.needsAnswer ? 'is asked' : a.why[0] === 'Attending' ? 'attending' : a.why[0] === 'Owns this' ? 'owns this' : a.why[0] === 'Driving' ? 'drives' : 'affected'}</text>`;
  });
  things.forEach((t, i) => {
    const x = things.length === 1 ? W / 2 : 70 + (i * (W - 140)) / (things.length - 1);
    out += `<rect class="node ${t.hot ? 'hot' : ''}" x="${x - 66}" y="${thingY - 20}" width="132" height="40" rx="10"/><text x="${x}" y="${thingY - 2}" text-anchor="middle">${esc(wrap(t.label, 19))}</text><text class="sub" x="${x}" y="${thingY + 12}" text-anchor="middle">${t.hot ? 'clashes' : t.soft ? 'squeezed' : 'touched'}</text>`;
  });
  const desc = `${p.before.title} touches ${people.map((a) => nameOf(a.id)).join(', ')}${things.length ? `, and ${things.map((t) => t.label).join(', ')}` : ''}.`;
  return `<svg class="graph" viewBox="0 0 ${W} ${things.length ? 262 : 190}" role="img" aria-label="${esc(desc)}" style="max-width:560px;margin:0 auto">${out}</svg>`;
}

function toldList(p) {
  const by = state.viewer;
  const event = {
    id: 'preview', at: state.now, intent: 'nudge', about: { people: p.after.people, activity: p.after.activity },
    to: p.affected.filter((a) => a.id !== by).map((a) => ({ id: a.id, reason: a.why.join(', ') })), text: '',
  };
  const { deliveries } = route(event, state.members, state.contracts);
  const asked = new Set(p.affected.filter((a) => a.needsAnswer).map((a) => a.id));
  return state.members.filter((m) => m.id !== by).map((m) => {
    const d = deliveries.find((x) => x.to === m.id);
    if (asked.has(m.id)) return `<div class="told">${avatar(m.id, 'sm')}<span><b>${esc(m.name)}</b> <span class="meta">is asked first; nothing changes until there is an answer</span></span><span class="badge accent">${icon('bell')} Asked</span></div>`;
    if (!d) return `<div class="told">${avatar(m.id, 'sm')}<span><b>${esc(m.name)}</b> <span class="meta">not affected</span></span><span class="badge calm">Not told</span></div>`;
    const ch = CHANNEL[d.channel];
    return `<div class="told">${avatar(m.id, 'sm')}<span><b>${esc(m.name)}</b> <span class="meta">${esc(d.reason)}</span></span><span class="badge ${d.channel === 'push' ? 'accent' : 'calm'}">${icon(ch.icon)} ${ch.label}${d.channel === 'digest' ? `, ${fmtTime(minuteOf(d.at))}` : ''}</span></div>`;
  }).join('');
}

export default {
  render() {
    const d = draft();
    const c = commitment(d.cid) || commitment('dentist');
    const target = { day: d.patch.day ?? c.day, start: d.patch.start ?? c.start };
    const length = c.end - c.start;
    const changed = target.day !== c.day || target.start !== c.start;
    const h = household();
    const p = changed ? propose(h, { cid: c.id, by: state.viewer, patch: { day: target.day, start: target.start, end: target.start + length }, choices: d.choices }) : null;
    const slots = openSlots(h, c.id, target.day);
    const needsAnswer = p ? p.affected.filter((a) => a.needsAnswer && a.id !== state.viewer) : [];

    const picker = `
      <section class="card stack" aria-label="The change">
        <label class="field">Commitment
          <select data-on="pick">${movable().sort((a, b) => a.day - b.day || a.start - b.start).map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${DAYS_SHORT[x.day]} ${fmtTime(x.start)}, ${esc(x.title)}</option>`).join('')}</select>
        </label>
        <div class="field">Move to
          <div class="seg" role="group" aria-label="Day">${DAYS_SHORT.map((n, i) => `<button data-act="day" data-v="${i}" aria-pressed="${i === target.day}">${n}</button>`).join('')}</div>
        </div>
        <label class="field">Start time
          <select data-on="time">${Array.from({ length: 27 }, (_, i) => 7 * 60 + i * 30).map((t) => `<option value="${t}" ${t === target.start ? 'selected' : ''}>${fmtTime(t)}${slots.includes(t) ? '' : ', clashes'}</option>`).join('')}${(target.start - 420) % 30 ? `<option value="${target.start}" selected>${fmtTime(target.start)}</option>` : ''}</select>
          <span class="help">Open on ${DAYS[target.day]} with no clash: ${slots.length ? `<span class="slots" style="display:inline-flex;vertical-align:middle">${slots.filter((t) => t >= 14 * 60).slice(0, 6).map((t) => `<button class="chip mono" data-act="slot" data-v="${t}" aria-pressed="${t === target.start}">${fmtTime(t)}</button>`).join('') || 'mornings only'}</span>` : 'none'}</span>
        </label>
        ${changed ? '' : `<div class="banner">${icon('graph')}<div>Pick a new day or time to see what the change touches. <button class="btn small" data-act="preset" style="margin-top:8px">Try: dentist to Thursday 4pm</button></div></div>`}
      </section>`;

    if (!p) {
      return `<header class="head"><h1 class="h1">Ripple</h1><p class="lede">Change one thing and see everything it touches before anyone is told. A change is a proposal until it is confirmed.</p></header>${picker}`;
    }

    const groups = p.groups.map((g) => {
      const o = g.commitment;
      if (g.kind === 'driver') {
        return `<fieldset class="stack" style="border:0;padding:0;margin:0">
          <legend class="h3" style="padding:0;margin-bottom:8px">${esc(o.title)}, ${DAYS_SHORT[o.day]} ${fmtTime(o.start)}: ${esc(g.summary)}</legend>
          ${g.options.map((opt) => `<label class="opt ${opt.ok ? '' : 'off'}">
            <input type="radio" name="cover-${o.id}" data-on="cover" data-id="${o.id}" value="${opt.id}" ${opt.ok ? '' : 'disabled'} ${d.choices[o.id] === opt.id ? 'checked' : ''}>
            <span><span class="who">${avatar(opt.id, 'sm')}${esc(nameOf(opt.id))} drives instead</span>
              <span class="meta" style="display:block">${esc(opt.reason)}.</span>
              ${opt.overload ? `<span class="badge amber" style="margin-top:4px">${icon('warning')} Over the limit they set</span>` : ''}</span>
          </label>`).join('')}
          ${g.options.some((x) => x.ok) ? '' : `<p class="meta">Nobody can cover this run. Try another time.</p>`}
        </fieldset>`;
      }
      if (g.kind === 'soft') return `<div class="banner amber">${icon('hourglass')}<div><b>${esc(o.title)}</b> is squeezed. It is still flexible, so this does not block the change.</div></div>`;
      return `<div class="banner red">${icon('warning')}<div><b>${esc(o.title)}</b>: ${esc(g.summary)}. Choose another time, or accept that it will be missed.</div></div>`;
    }).join('');

    const status = p.blocked
      ? `<div class="banner red" role="status">${icon('warning')}<div>This cannot go ahead yet: ${plural(p.remaining.filter((k) => k.severity === 'hard').length, 'clash', 'clashes')} left. Choose cover above, or pick an open time.</div></div>`
      : d.sent
        ? `<div class="banner" role="status">${icon('hourglass')}<div><b>Waiting for ${needsAnswer.map((a) => esc(nameOf(a.id))).join(' and ')}.</b> Nothing has changed. The proposal lapses at 8pm with no change.
            <div class="cluster" style="margin-top:8px"><button class="btn small primary" data-act="answer" data-v="yes">Answer as ${esc(nameOf(needsAnswer[0].id))}: accept</button><button class="btn small" data-act="answer" data-v="no">Decline</button></div></div></div>`
        : `<div class="banner" role="status">${icon('check')}<div>No clashes left. ${needsAnswer.length ? `${needsAnswer.map((a) => esc(nameOf(a.id))).join(' and ')} must agree before anything changes.` : 'You can confirm this change.'}</div></div>`;

    return `
      <header class="head"><h1 class="h1">Ripple</h1><p class="lede">Change one thing and see everything it touches before anyone is told. A change is a proposal until it is confirmed.</p></header>
      <div class="cols two">
        <div class="stack">
          ${picker}
          <section class="card stack" aria-label="What it touches"><h2 class="h2">What it touches</h2>${graph(p)}</section>
          ${p.groups.length ? `<section class="card stack" aria-label="Clashes and cover"><h2 class="h2">Clashes and cover</h2>${groups}</section>` : ''}
        </div>
        <div class="stack">
          <section class="card stack" aria-label="The proposal">
            <div class="between"><h2 class="h2">The proposal</h2><span class="who">${avatar(state.viewer, 'sm')}by ${esc(nameOf(state.viewer))}</span></div>
            <div class="diff">${p.diff.map((r) => `<div class="diff-row"><span class="f">${esc(r.field)}</span><span class="del">${esc(r.from)}</span><span class="add">${esc(r.to)}</span></div>`).join('')}</div>
            ${p.schoolNote ? `<p class="meta">${icon('books')} This is during school hours, so a note to the school is added.</p>` : ''}
            ${status}
            <div class="cluster">
              ${d.sent ? '' : `<button class="btn primary" data-act="send" ${p.blocked ? 'disabled' : ''}>${needsAnswer.length ? 'Send proposal' : 'Confirm change'}</button>`}
              <button class="btn" data-act="discard">Discard</button>
            </div>
          </section>
          <section class="card stack" aria-label="Who is told"><h2 class="h2">Who is told, and how</h2><div class="stack tight">${toldList(p)}</div><p class="rule"><b>Rule 7.</b> Notify on change, once. Each person's own rules decide the channel.</p></section>
          ${p.tasks.length ? `<section class="card stack" aria-label="Follow ups"><h2 class="h2">Follow ups it creates</h2>${p.tasks.map((t) => `<div class="between"><span>${esc(t.title)}</span>${who(t.owner)}</div>`).join('')}</section>` : ''}
          <section class="card stack" aria-label="Message for the family group">
            <h2 class="h2">For the family WhatsApp group</h2>
            <div class="draft" id="group-draft">${esc(p.groupDraft)}</div>
            <div class="cluster"><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(p.groupDraft)}">${icon('whatsapp-logo')}Share to WhatsApp</a><button class="btn quiet" data-act="copy">${icon('copy')}Copy</button></div>
            <p class="meta">A person posts this with one tap. The portal never posts into the group by itself.</p>
          </section>
        </div>
      </div>`;
  },
  actions: {
    day: (d) => { const cur = draft(); set({ draft: { ...cur, sent: false, choices: {}, patch: { ...cur.patch, day: Number(d.v) } } }); },
    slot: (d) => { const cur = draft(); set({ draft: { ...cur, sent: false, choices: {}, patch: { ...cur.patch, start: Number(d.v) } } }); },
    preset: () => set({ draft: { cid: 'dentist', patch: { day: 3, start: 16 * 60 }, choices: {} } }),
    discard: () => { set({ draft: null }); toast('Discarded. Nothing changed.'); },
    copy: () => { const text = document.getElementById('group-draft').textContent; navigator.clipboard?.writeText(text).then(() => toast('Copied.'), () => toast('Copy is not available here.')); },
    send: () => {
      const d = draft();
      const c = commitment(d.cid);
      const p = propose(household(), { cid: c.id, by: state.viewer, patch: { day: d.patch.day ?? c.day, start: d.patch.start ?? c.start, end: (d.patch.start ?? c.start) + (c.end - c.start) }, choices: d.choices });
      if (p.blocked) return;
      if (p.affected.some((a) => a.needsAnswer && a.id !== state.viewer)) { set({ draft: { ...d, sent: true } }); toast('Proposal sent. Nothing changes until it is accepted.'); return; }
      apply(p);
    },
    answer: (d) => {
      const cur = draft();
      const c = commitment(cur.cid);
      if (d.v === 'no') { set({ draft: null }); toast('Declined. Nothing changed.'); return; }
      const p = propose(household(), { cid: c.id, by: state.viewer, patch: { day: cur.patch.day ?? c.day, start: cur.patch.start ?? c.start, end: (cur.patch.start ?? c.start) + (c.end - c.start) }, choices: cur.choices });
      apply(p);
    },
  },
  inputs: {
    pick: (value) => set({ draft: { cid: value, patch: {}, choices: {} } }),
    time: (value) => { const cur = draft(); set({ draft: { ...cur, sent: false, choices: {}, patch: { ...cur.patch, start: Number(value) } } }); },
    cover: (value, d) => { const cur = draft(); set({ draft: { ...cur, sent: false, choices: { ...cur.choices, [d.id]: value } } }); },
  },
};

function apply(p) {
  commit(p.changeLine, () => {
    state.commitments = p.afterAll.map((c) => ({ ...c }));
    for (const t of p.tasks.filter((x) => !x.carried)) state.tasks.push({ id: `task${Date.now()}${state.tasks.length}`, title: t.title, owner: t.owner, due: DAYS_SHORT[Math.max(dayOf(state.now), p.after.day - 1)], done: false });
    state.draft = null;
  });
  toast('Changed. Everyone affected has been told once.');
}
