// Shell: navigation, routing, the viewer switch, and the command palette.

import { state, subscribe, set, emit, commit, member, nameOf, household } from './store.js';
import { esc, icon, avatar, toast, hue } from './ui.js';
import { fmtTime, fmtAbs, DAYS, hm, abs } from './engine/time.js';
import { parseCapture } from './engine/parse.js';
import { findClashes } from './engine/clash.js';
import { SCENARIOS } from './engine/simulate.js';
import today from './views/today.js';
import simulator from './views/simulator.js';
import ripple from './views/ripple.js';
import week from './views/week.js';
import triage from './views/triage.js';
import rota from './views/rota.js';
import board from './views/board.js';
import notifications from './views/notifications.js';
import seasons from './views/seasons.js';
import mirror from './views/mirror.js';
import history from './views/history.js';
import dinner from './views/dinner.js';
import namesView from './views/names.js';
import * as names from './names.js';

const ROUTES = [
  { id: 'today', label: 'Today', icon: 'house', view: today, group: 'Now', tab: true },
  { id: 'board', label: 'Board', icon: 'monitor', view: board, group: 'Now' },
  { id: 'simulator', label: 'Day simulator', short: 'Simulator', icon: 'play-circle', view: simulator, group: 'Now', tab: true },
  { id: 'week', label: 'Week', icon: 'calendar-blank', view: week, group: 'Plan', tab: true },
  { id: 'ripple', label: 'Ripple', icon: 'graph', view: ripple, group: 'Plan' },
  { id: 'rota', label: 'Rota and swaps', icon: 'arrows-left-right', view: rota, group: 'Plan' },
  { id: 'dinner', label: 'Dinner', icon: 'fork-knife', view: dinner, group: 'Plan', tab: true },
  { id: 'seasons', label: 'Seasons', icon: 'books', view: seasons, group: 'Plan' },
  { id: 'triage', label: 'Triage', icon: 'tray', view: triage, group: 'Inbox' },
  { id: 'notifications', label: 'My notifications', icon: 'bell', view: notifications, group: 'Inbox' },
  { id: 'mirror', label: 'Mirror', icon: 'chart-bar', view: mirror, group: 'Look back' },
  { id: 'history', label: 'History', icon: 'clock-counter-clockwise', view: history, group: 'Look back' },
  { id: 'names', label: 'Names', icon: 'identification-badge', view: namesView, group: 'This device' },
];

const app = document.getElementById('app');
let current = null;
let overlay = null;

const routeId = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'today');
export const go = (id) => { location.hash = `#/${id}`; };

function shell() {
  const groups = [...new Set(ROUTES.map((r) => r.group))];
  app.innerHTML = `
    <nav class="side" aria-label="Sections">
      <a class="brand" href="#/today">Johll</a>
      ${groups.map((g) => `<div class="group">${g}</div>${ROUTES.filter((r) => r.group === g).map((r) => `<a class="nav" href="#/${r.id}" data-nav="${r.id}">${icon(r.icon)}${r.label}</a>`).join('')}`).join('')}
      <div class="foot">A prototype. Every time, place and event here is invented.</div>
    </nav>
    <div>
      <header class="topbar">
        <a class="brand" href="#/today">Johll</a>
        <span class="sample">Sample data</span>
        <span class="spacer"></span>
        <button class="btn icon quiet" data-act="palette" aria-label="Capture or search" title="Capture or search (press /)">${icon('plus')}</button>
        <button class="btn icon quiet" data-act="lockSheet" id="lock-btn" aria-label="Sign in"></button>
        <button class="btn icon quiet" data-act="theme" aria-label="Switch light and dark" title="Switch light and dark">${icon('circle-half')}</button>
        <button class="viewer" data-act="viewerSheet" aria-haspopup="dialog" id="viewer-btn"></button>
      </header>
      <main id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Main">
      ${ROUTES.filter((r) => r.tab).map((r) => `<a href="#/${r.id}" data-nav="${r.id}">${icon(r.icon)}<span>${r.short || r.label}</span></a>`).join('')}
      <a href="#more" data-act="moreSheet" data-nav="more">${icon('dots-three-outline')}<span>More</span></a>
    </nav>`;
}

function paint() {
  const id = routeId();
  const route = ROUTES.find((r) => r.id === id) || ROUTES[0];
  const view = document.getElementById('view');
  const active = document.activeElement;
  const fk = active && active.dataset && active.dataset.act ? `${active.dataset.act}|${active.dataset.id || ''}|${active.dataset.v || ''}` : null;
  if (current && current !== route.view && current.unmount) current.unmount();
  const changed = current !== route.view;
  current = route.view;
  view.innerHTML = `<div class="page">${route.view.render(state)}</div>`;
  if (route.view.mount) route.view.mount(view, changed);
  document.title = `${route.label}, Johll`;
  for (const a of document.querySelectorAll('[data-nav]')) {
    const on = a.dataset.nav === route.id || (a.dataset.nav === 'more' && !route.tab);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const v = member(state.viewer);
  document.getElementById('viewer-btn').innerHTML = `${avatar(v.id)}<span class="who">${esc(nameOf(v.id))}</span><span class="sr">Viewing as ${esc(nameOf(v.id))}. Change person</span>`;
  const lockBtn = document.getElementById('lock-btn');
  lockBtn.innerHTML = icon(names.isUnlocked() ? 'lock-open' : 'lock');
  lockBtn.setAttribute('aria-label', names.isUnlocked() ? 'Names are unlocked on this device' : 'Sign in to show names');
  lockBtn.title = lockBtn.getAttribute('aria-label');
  if (changed) { window.scrollTo(0, 0); }
  else if (fk) {
    const [act, fid, fv] = fk.split('|');
    const again = [...view.querySelectorAll(`[data-act="${act}"]`)].find((el) => (el.dataset.id || '') === fid && (el.dataset.v || '') === fv);
    if (again) again.focus({ preventScroll: true });
  }
}

// Overlays: palette, viewer sheet, more sheet.
function closeOverlay() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.removeEventListener('keydown', overlayKeys, true);
}
function openOverlay(html, onMount) {
  closeOverlay();
  overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
  document.body.appendChild(overlay);
  document.addEventListener('keydown', overlayKeys, true);
  if (onMount) onMount(overlay);
}
function overlayKeys(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
}

function viewerSheet() {
  openOverlay(`<div class="sheet" role="dialog" aria-label="View as">
    <div class="meta" style="padding:8px 12px">View the portal as</div>
    ${state.members.map((m) => `<button data-act="setViewer" data-id="${m.id}" ${m.id === state.viewer ? 'aria-current="true"' : ''}>${avatar(m.id)}<span><b>${esc(nameOf(m.id))}</b> <span class="meta">${esc(m.label)}${m.device ? '' : ', limited phone'}</span></span></button>`).join('')}
  </div>`, (el) => el.querySelector('[aria-current="true"]')?.focus());
}

function moreSheet() {
  openOverlay(`<div class="sheet" role="dialog" aria-label="More sections">
    ${ROUTES.filter((r) => !r.tab).map((r) => `<a href="#/${r.id}" data-act="closeOverlay">${icon(r.icon)}${r.label}</a>`).join('')}
  </div>`, (el) => el.querySelector('a')?.focus());
}

function commands() {
  return [
    ...ROUTES.map((r) => ({ label: `Go to ${r.label}`, icon: r.icon, run: () => go(r.id) })),
    ...SCENARIOS.map((s) => ({ label: `Play: ${s.title}`, icon: 'play', run: () => { set({ sim: { id: s.id, t: abs(s.day, s.from), input: {}, playing: false } }); go('simulator'); } })),
    { label: 'Move the dentist to Thursday 5pm', icon: 'graph', run: () => { set({ draft: { cid: 'dentist', patch: { day: 3, start: hm(17), end: hm(18) }, choices: {} } }); go('ripple'); } },
    ...state.members.map((m) => ({ label: `View as ${nameOf(m.id)}`, icon: 'user', run: () => set({ viewer: m.id }) })),
    { label: names.isUnlocked() ? 'Lock this device' : 'Sign in to show names', icon: names.isUnlocked() ? 'lock' : 'lock-open', run: lockSheet },
    { label: 'Switch light and dark', icon: 'circle-half', run: toggleTheme },
    { label: 'Open the board full screen', icon: 'arrows-out', run: () => go('board') },
  ];
}

function palette() {
  let sel = 0;
  let list = [];
  let parsed = null;
  const day = Math.floor(state.now / 1440);
  openOverlay(`<div class="palette" role="dialog" aria-label="Capture or search">
    <input type="text" placeholder="Try: Netball Fri 3pm ${esc(nameOf('A2'))}" aria-label="Type something to capture, or a command" autocomplete="off" spellcheck="false">
    <div class="parsed" hidden></div>
    <div class="results" role="listbox"></div>
    <div class="hint">Type what happened in plain words and it becomes a proposal to confirm. Or type a command. <kbd>Enter</kbd> to choose, <kbd>Esc</kbd> to close.</div>
  </div>`, (el) => {
    const input = el.querySelector('input');
    const results = el.querySelector('.results');
    const box = el.querySelector('.parsed');
    const draw = () => {
      const q = input.value.trim();
      parsed = q.length > 3 ? parseCapture(q, state.members.map((m) => ({ ...m, aliases: names.aliasesOf(m.id) })), day) : null;
      const useful = parsed && (parsed.day != null || parsed.start != null);
      const cmds = commands().filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()));
      list = [];
      if (useful) list.push({ label: parsed.confident ? 'Add this to the week' : 'Send to triage to finish later', icon: parsed.confident ? 'check' : 'tray', run: () => addCapture(parsed, q) });
      else if (q.length > 3 && !cmds.length) list.push({ label: 'Send to triage', icon: 'tray', run: () => addCapture(parsed, q) });
      list.push(...cmds.slice(0, 8));
      sel = Math.min(sel, Math.max(0, list.length - 1));
      box.hidden = !useful;
      if (useful) {
        const people = (parsed.people.length ? parsed.people : [state.viewer]);
        const probe = parsed.confident ? findClashes([...state.commitments, probeCommitment(parsed)], state.now).filter((k) => k.a === 'probe' || k.b === 'probe') : [];
        box.innerHTML = `<div class="between"><b>${esc(parsed.title)}</b><span class="badge accent">${esc(parsed.type)}</span></div>
          <div class="cluster">
            <span class="chip">${icon('calendar-blank')}${parsed.day != null ? DAYS[parsed.day] : 'No day yet'}</span>
            <span class="chip mono">${parsed.start != null ? `${fmtTime(parsed.start)} to ${fmtTime(parsed.end)}` : 'No time yet'}</span>
            ${people.map((p) => `<span class="chip">${avatar(p, 'sm')}${esc(nameOf(p))}</span>`).join('')}
          </div>
          ${parsed.notes.length ? `<div class="meta">${parsed.notes.map(esc).join('. ')}.</div>` : ''}
          ${probe.length ? `<div class="badge red">${icon('warning')} Clashes with something already booked</div>` : parsed.confident ? `<div class="meta">${icon('check')} No clash found.</div>` : ''}`;
      }
      results.innerHTML = list.map((c, i) => `<button class="res" role="option" aria-selected="${i === sel}" data-i="${i}">${icon(c.icon)}<span>${esc(c.label)}</span></button>`).join('') || '<div class="hint">Nothing matches.</div>';
    };
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(list.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter' && list[sel]) { e.preventDefault(); const run = list[sel].run; closeOverlay(); run(); }
    });
    results.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { const run = list[Number(b.dataset.i)].run; closeOverlay(); run(); } });
    draw();
    input.focus();
  });
}

function probeCommitment(p, id = 'probe') {
  const people = p.people.length ? p.people : [state.viewer];
  return { id, title: p.title, type: p.type, day: p.day, start: p.start, end: p.end, people, owner: state.viewer, driver: null, car: null, legs: null, needs: [], fixed: false, soft: false, hardensAt: null, place: '', activity: null, backup: [], ack: 'none' };
}

function addCapture(parsed, raw) {
  if (parsed && parsed.confident) {
    const c = probeCommitment(parsed, `cap${Date.now()}`);
    commit(`Added from capture: ${c.title}, ${DAYS[c.day]} ${fmtTime(c.start)}`, () => { state.commitments.push(c); });
    const clash = findClashes(state.commitments, state.now).some((k) => k.a === c.id || k.b === c.id);
    toast(clash ? 'Added. It clashes; open the week to resolve it.' : 'Added to the week.');
    set({ weekSel: c.id });
    go('week');
  } else {
    commit(`Captured to triage: ${raw}`, () => {
      state.triage.unshift({ id: `t${Date.now()}`, source: 'typed', from: nameOf(state.viewer), received: fmtAbs(state.now), title: raw, body: 'Typed into quick capture. It needs a day, a time or an owner.', suggestion: { kind: 'task', text: raw }, requester: state.viewer, status: 'new' });
    });
    toast('Sent to triage.');
    go('triage');
  }
}

// Sign in: the family's code unlocks names on this device and keeps them unlocked.
let failures = 0;
function lockSheet() {
  if (names.isUnlocked()) {
    openOverlay(`<div class="sheet" role="dialog" aria-label="Names on this device">
      <div class="meta" style="padding:8px 12px">Names are unlocked on this device and stay unlocked until you lock it.</div>
      <a href="#/names" data-act="closeOverlay">${icon('identification-badge')}Who calls whom what</a>
      <button data-act="lockNow">${icon('lock')}Lock this device</button>
    </div>`, (el) => el.querySelector('a')?.focus());
    return;
  }
  if (!names.cryptoAvailable()) { toast('Sign in needs a secure page (https).'); return; }
  openOverlay(`<form class="pin" role="dialog" aria-label="Sign in">
    <h2 class="h2">Sign in</h2>
    <p class="meta">Enter the family code to show names on this device. Until then the portal shows H, K, A1 and A2.</p>
    <label class="sr" for="pin-input">Family code, four digits</label>
    <input id="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-describedby="pin-err">
    <div class="err" id="pin-err" role="alert"></div>
    <button class="btn primary" type="submit">Unlock</button>
  </form>`, (el) => {
    const form = el.querySelector('form');
    const input = el.querySelector('input');
    const err = el.querySelector('.err');
    const button = el.querySelector('button');
    input.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (input.value.length !== 4 || button.disabled) return;
      button.disabled = true;
      button.textContent = 'Checking';
      try {
        await names.unlock(input.value);
        failures = 0;
        closeOverlay();
        emit();
        toast('Unlocked on this device.');
      } catch (ex) {
        failures += 1;
        const wait = Math.min(30, failures * 2);
        err.textContent = `That code does not match. Try again in ${wait} seconds.`;
        input.value = '';
        setTimeout(() => { if (!overlay) return; button.disabled = false; button.textContent = 'Unlock'; err.textContent = ''; input.focus(); }, wait * 1000);
      }
    });
  });
}

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
}

const globalActions = {
  palette,
  theme: toggleTheme,
  viewerSheet,
  moreSheet: (d, el, e) => { e.preventDefault(); moreSheet(); },
  closeOverlay,
  setViewer: (d) => { closeOverlay(); set({ viewer: d.id }); toast(`Viewing as ${nameOf(d.id)}.`); },
  lockSheet,
  lockNow: async () => { await names.lock(); closeOverlay(); emit(); toast('Locked. This device shows codes again.'); },
  go: (d) => go(d.id),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = (current && current.actions && current.actions[el.dataset.act]) || globalActions[el.dataset.act];
  if (fn) fn(el.dataset, el, e);
});
for (const type of ['input', 'change']) {
  document.addEventListener(type, (e) => {
    const el = e.target.closest('[data-on]');
    if (!el || !current || !current.inputs) return;
    const fn = current.inputs[el.dataset.on];
    if (fn) fn(el.type === 'checkbox' ? el.checked : el.value, el.dataset, el, type);
  });
}
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); palette(); }
});

shell();
subscribe(paint);
// If this device was unlocked before, show names again without asking.
names.resume().then((ok) => { if (ok) paint(); });
window.addEventListener('hashchange', () => { closeOverlay(); paint(); });
paint();
