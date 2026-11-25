// Shell: navigation, routing, the viewer switch, and sign in.
// Home is the one surface; every other screen is something Home draws on.

import { state, subscribe, set, emit, member, nameOf, syncDeviceData } from './store.js';
import { esc, icon, avatar, toast } from './ui.js';
import * as names from './names.js';
import home from './views/home.js';
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
import know from './views/know.js';
import adventures from './views/adventures.js';
import safety from './views/safety.js';
import connections from './views/connections.js';

const ROUTES = [
  { id: 'home', label: 'Home', icon: 'house', view: home, group: '', tab: true },
  { id: 'week', label: 'Week', icon: 'calendar-blank', view: week, group: '', tab: true },
  { id: 'dinner', label: 'Dinner', icon: 'fork-knife', view: dinner, group: '', tab: true },
  { id: 'today', label: 'My day', icon: 'sun-horizon', view: today, group: 'Plan' },
  { id: 'ripple', label: 'Change something', icon: 'graph', view: ripple, group: 'Plan' },
  { id: 'rota', label: 'Rota and swaps', icon: 'arrows-left-right', view: rota, group: 'Plan' },
  { id: 'seasons', label: 'Classes and home', icon: 'books', view: seasons, group: 'Plan' },
  { id: 'adventures', label: 'Adventures', icon: 'compass', view: adventures, group: 'Together and safe' },
  { id: 'safety', label: 'Safety', icon: 'shield-check', view: safety, group: 'Together and safe' },
  { id: 'connections', label: 'Connections', icon: 'plugs-connected', view: connections, group: 'Together and safe' },
  { id: 'triage', label: 'Triage', icon: 'tray', view: triage, group: 'Inbox' },
  { id: 'notifications', label: 'My notifications', icon: 'bell', view: notifications, group: 'Inbox' },
  { id: 'simulator', label: 'Day simulator', icon: 'play-circle', view: simulator, group: 'See how it works' },
  { id: 'board', label: 'Kitchen board', icon: 'monitor', view: board, group: 'See how it works' },
  { id: 'mirror', label: 'Mirror', icon: 'chart-bar', view: mirror, group: 'Look back' },
  { id: 'history', label: 'History', icon: 'clock-counter-clockwise', view: history, group: 'Look back' },
  { id: 'know', label: 'What I know', icon: 'brain', view: know, group: 'This device' },
  { id: 'names', label: 'Names', icon: 'identification-badge', view: namesView, group: 'This device' },
];
const HONEST = 'A prototype. It only works while it is open; reminders that arrive on their own come with the server step. Every time, place and event is invented.';

const app = document.getElementById('app');
let current = null;
let overlay = null;

const routeId = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'home');
const go = (id) => { location.hash = `#/${id}`; };
const groups = () => [...new Set(ROUTES.map((r) => r.group))];

function shell() {
  app.innerHTML = `
    <nav class="side" aria-label="Sections">
      <a class="brand" href="#/home">Johll</a>
      ${groups().map((g) => `${g ? `<div class="group">${g}</div>` : ''}${ROUTES.filter((r) => r.group === g).map((r) => `<a class="nav" href="#/${r.id}" data-nav="${r.id}">${icon(r.icon)}${r.label}</a>`).join('')}`).join('')}
      <div class="foot">${HONEST}</div>
    </nav>
    <div>
      <header class="topbar">
        <a class="brand" href="#/home">Johll</a>
        <span class="sample">Sample data</span>
        <span class="spacer"></span>
        <button class="btn icon quiet" data-act="lockSheet" id="lock-btn" aria-label="Sign in"></button>
        <button class="btn icon quiet" data-act="theme" aria-label="Switch light and dark" title="Switch light and dark">${icon('circle-half')}</button>
        <button class="viewer" data-act="viewerSheet" aria-haspopup="dialog" id="viewer-btn"></button>
      </header>
      <main id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Main">
      ${ROUTES.filter((r) => r.tab).map((r) => `<a href="#/${r.id}" data-nav="${r.id}">${icon(r.icon)}<span>${r.label}</span></a>`).join('')}
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
  view.innerHTML = `<div class="page ${route.id === 'home' ? 'page-home' : ''}">${route.view.render(state)}</div>`;
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
  else if (fk && document.activeElement === document.body) {
    const [act, fid, fv] = fk.split('|');
    const again = [...view.querySelectorAll(`[data-act="${act}"]`)].find((el) => (el.dataset.id || '') === fid && (el.dataset.v || '') === fv);
    if (again) again.focus({ preventScroll: true });
  }
}

// Overlays: the viewer sheet, the More sheet, sign in.
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
    <div class="meta" style="padding:8px 12px">Each person has their own Home. View the portal as</div>
    ${state.members.map((m) => `<button data-act="setViewer" data-id="${m.id}" ${m.id === state.viewer ? 'aria-current="true"' : ''}>${avatar(m.id)}<span><b>${esc(nameOf(m.id))}</b> <span class="meta">${esc(m.label)}${m.device ? '' : ', limited phone'}</span></span></button>`).join('')}
  </div>`, (el) => el.querySelector('[aria-current="true"]')?.focus());
}

function moreSheet() {
  openOverlay(`<div class="sheet more" role="dialog" aria-label="More">
    ${groups().filter(Boolean).map((g) => `<div class="group">${g}</div>${ROUTES.filter((r) => r.group === g).map((r) => `<a href="#/${r.id}" data-act="closeOverlay">${icon(r.icon)}${r.label}</a>`).join('')}`).join('')}
    <p class="meta" style="padding:12px">${HONEST}</p>
  </div>`, (el) => el.querySelector('a')?.focus());
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
        await syncDeviceData();
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
  theme: toggleTheme,
  viewerSheet,
  moreSheet: (d, el, e) => { e.preventDefault(); moreSheet(); },
  closeOverlay,
  setViewer: (d) => { closeOverlay(); set({ viewer: d.id, thread: [], homeAll: false }); toast(`Viewing as ${nameOf(d.id)}.`); },
  lockSheet,
  lockNow: async () => { await names.lock(); await syncDeviceData(); closeOverlay(); emit(); toast('Locked. This device shows codes again.'); },
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
// Pressing / anywhere takes you to the ask box.
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (e.key !== '/' || typing || overlay) return;
  e.preventDefault();
  if (routeId() !== 'home') { go('home'); setTimeout(() => home.focusAsk(), 60); } else home.focusAsk();
});

shell();
subscribe(paint);
window.addEventListener('hashchange', () => { closeOverlay(); paint(); });
// If this device was unlocked before, show names again without asking.
names.resume().then(async (ok) => { if (ok) { await syncDeviceData(); paint(); } });
paint();
