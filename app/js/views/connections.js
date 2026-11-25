// Connections: what the portal links to, chosen by each person for themselves.
// Each card says plainly whether it works today or waits for the server.

import { state, set, commit, member, nameOf } from '../store.js';
import { esc, icon, avatar, toast, download, say, worksBadge } from '../ui.js';
import { buildCalendar, eventsFor } from '../engine/ics.js';
import { dayOf, minuteOf } from '../engine/time.js';

const CATALOGUE = [
  { id: 'ics', works: 'today', icon: 'calendar-blank', name: 'Add to my calendar', direction: 'From the portal to your calendar', blurb: 'Your week as a calendar file. Open it and your calendar app offers to add the events. It works with Apple, Google and Outlook calendars.', detail: true },
  { id: 'whatsapp', works: 'today', icon: 'whatsapp-logo', name: 'Share to WhatsApp', direction: 'From the portal to WhatsApp, sent by you', blurb: 'When a plan changes, the portal writes the family message and you post it with one tap. It never posts by itself.' },
  { id: 'push', works: 'server', icon: 'bell', name: 'Notifications', direction: 'From the portal to your phone', blurb: 'Reminders that reach you when the portal is closed.', note: 'On an iPhone the portal must first be added to the Home Screen.' },
  { id: 'feed', works: 'server', icon: 'repeat', name: 'Calendar feed', direction: 'From the portal to your calendar, kept up to date', blurb: 'Subscribe once, and portal events keep appearing in your own calendar with no more downloads.', note: 'An iPhone refreshes about every 15 minutes. Google Calendar can take up to a day.', detail: true },
  { id: 'send', works: 'server', icon: 'share-network', name: 'Send to the portal', direction: 'From your phone to the portal', blurb: 'Share a screenshot, a message or an email to the portal, by the share sheet or by voice, or forward it to an address of your own.', note: 'On an iPhone this uses a shortcut you install once.' },
  { id: 'gcal', works: 'server', icon: 'arrows-left-right', name: 'Google Calendar, both ways', direction: 'Both ways', blurb: 'A change made in either place appears in the other.', note: 'The most setup of all, and each person signs in to Google once.', detail: true },
];
const NOT_POSSIBLE = [
  'A bot inside your existing WhatsApp groups. WhatsApp does not allow it.',
  'Writing straight into Apple Reminders from a web app. Apple offers no way in.',
  'Reading Parents Gateway, HealthHub, Singpass or your bank. None offers access to a family app; forwarding their emails is the way in.',
  'Knowing where a phone is in the background. A web app cannot, and this portal would not.',
];

let showing = null;

const isChildNoPhone = (m) => m.role === 'child' && !m.device;
// You manage your own. A parent manages a young child's. Nobody else's can be changed.
function canManage(viewer, target) {
  if (viewer.id === target.id) return !isChildNoPhone(viewer);
  return viewer.adult && isChildNoPhone(target);
}
const visibleTo = (viewer) => state.members.filter((m) => m.id === viewer.id || (viewer.adult && m.role === 'child'));

function card(c, target, manage) {
  const mine = state.connections[target.id][c.id];
  const on = c.works === 'today' ? mine.on : mine.wanted;
  const label = c.works === 'today' ? (on ? 'On' : 'Off') : (on ? 'Wanted' : 'Not wanted');
  return `<section class="card stack" aria-label="${esc(c.name)}">
    <div class="between"><h2 class="h2">${icon(c.icon)} ${esc(c.name)}</h2>${worksBadge(c.works)}</div>
    <p>${esc(c.blurb)}</p>
    <dl class="kv">
      <dt>Direction</dt><dd>${esc(c.direction)}</dd>
      ${c.detail ? `<dt>Shares</dt><dd>${mine.detail === 'busy' ? 'Only that you are busy' : 'Full details'}</dd>` : ''}
      ${c.note ? `<dt>Worth knowing</dt><dd>${esc(c.note)}</dd>` : ''}
      <dt>Last sync</dt><dd>${c.works === 'today' ? (c.id === 'ics' ? (mine.last ? esc(mine.last) : 'Not downloaded yet') : 'Each time you tap share') : 'Not connected: there is no server yet'}</dd>
    </dl>
    ${manage ? `<div class="cluster">
        <button class="chip" data-act="toggle" data-id="${c.id}" aria-pressed="${on}">${icon(on ? 'check' : 'x')}${label}</button>
        ${c.detail && on ? `<span class="seg" role="group" aria-label="What is shared"><button data-act="detail" data-id="${c.id}" data-v="full" aria-pressed="${mine.detail !== 'busy'}">Full details</button><button data-act="detail" data-id="${c.id}" data-v="busy" aria-pressed="${mine.detail === 'busy'}">Busy only</button></span>` : ''}
        ${c.id === 'ics' && on ? `<button class="btn primary" data-act="downloadWeek">${icon('download-simple')}Download ${target.id === state.viewer ? 'my' : `${esc(nameOf(target.id))}'s`} week</button>` : ''}
      </div>
      ${c.detail && on ? `<p class="meta">Busy only is for a work calendar: colleagues see that you are taken, not why.</p>` : ''}
      ${c.works === 'server' ? `<p class="meta">${on ? 'Noted. It will be set up for you when the server exists.' : 'Say you want it, and it will be set up for you when the server exists.'}</p>` : ''}`
    : `<p class="meta">${icon(on ? 'check' : 'x')} ${label}.</p>`}
  </section>`;
}

export default {
  render() {
    const viewer = member(state.viewer);
    const people = visibleTo(viewer);
    if (!showing || !people.some((m) => m.id === showing)) showing = viewer.id;
    const target = member(showing);
    const manage = canManage(viewer, target);
    const today = CATALOGUE.filter((c) => c.works === 'today');
    const later = CATALOGUE.filter((c) => c.works === 'server');
    let who = '';
    if (!manage && target.id === viewer.id) who = 'A parent looks after your connections. You can see them here.';
    else if (!manage) who = `${nameOf(target.id)} manages these. You can see that they exist, and you cannot change them.`;
    else if (target.id !== viewer.id) who = `You manage these for ${nameOf(target.id)}.`;
    return `
      <header class="head">
        <h1 class="h1">Connections</h1>
        <p class="lede">What the portal links to. Each person chooses their own, and can pause or remove any of them.</p>
      </header>
      ${people.length > 1 ? `<div class="cluster" role="group" aria-label="Whose connections">${people.map((m) => `<button class="chip" data-act="show" data-id="${m.id}" aria-pressed="${m.id === showing}">${avatar(m.id, 'sm')}${m.id === viewer.id ? 'Mine' : esc(nameOf(m.id))}</button>`).join('')}</div>` : ''}
      ${who ? `<div class="banner">${icon('info')}<div>${esc(who)}</div></div>` : ''}
      <div class="cols even">${today.map((c) => card(c, target, manage)).join('')}</div>
      <h2 class="h2">Waiting for the server</h2>
      <p class="meta">These need a small server, which does not exist yet. The designs are here so you can judge them and say which you want.</p>
      <div class="cols even">${later.map((c) => card(c, target, manage)).join('')}</div>
      <section class="card stack" aria-label="Not possible">
        <h2 class="h2">What no build can reach</h2>
        <p class="meta">So that nobody waits for them.</p>
        <ul class="plain">${NOT_POSSIBLE.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>`;
  },
  actions: {
    show: (d) => { showing = d.id; set({}); },
    toggle: (d) => {
      const c = CATALOGUE.find((x) => x.id === d.id);
      const mine = state.connections[showing][d.id];
      const key = c.works === 'today' ? 'on' : 'wanted';
      commit(`${c.name}: ${mine[key] ? 'turned off' : 'turned on'} for {${showing}}`, () => { mine[key] = !mine[key]; });
    },
    detail: (d) => { const c = CATALOGUE.find((x) => x.id === d.id); commit(`${c.name}: now shares ${d.v === 'busy' ? 'busy only' : 'full details'} for {${showing}}`, () => { state.connections[showing][d.id].detail = d.v; }); },
    downloadWeek: () => downloadWeek(showing),
  },
};

// Used here, on My day and by the ask box.
export function downloadWeek(target = state.viewer, only = null) {
  const mine = state.connections[target].ics;
  const events = eventsFor(only ? state.commitments.filter((c) => c.id === only) : state.commitments, target, (t) => say(t));
  if (!events.length) { toast('Nothing to add.'); return; }
  const file = buildCalendar(events, { name: only ? 'Johll' : 'Johll, my week', detail: mine.detail, now: { day: dayOf(state.now), minute: minuteOf(state.now) } });
  download(only ? 'johll-event.ics' : 'johll-week.ics', file);
  if (!only) { mine.last = 'Downloaded just now'; }
  toast(only ? 'Open the file to add it to your calendar.' : `${events.length} events. Open the file to add them to your calendar.`);
}
