// Calendar files. Builds a standard iCalendar file that any calendar app can open,
// entirely in the browser. This is the one connection that works with no server.

import { WEEK_START_UTC, SGT_OFFSET_MIN } from './time.js';

const pad = (n) => String(n).padStart(2, '0');

// Times are written in UTC, which every calendar app converts correctly.
export function stamp(day, minute) {
  const d = new Date(WEEK_START_UTC + day * 86400000 + (minute - SGT_OFFSET_MIN) * 60000);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

const escText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// The format allows at most 75 bytes on a line; longer lines continue on the next, after a space.
export function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    const limit = out.length ? 74 : 75;
    if (bytes + size > limit) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += size;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// events: [{ id, day, start, end, title, place, notes }]
// detail 'busy' shares only that the time is taken: no title, place or notes.
export function buildCalendar(events, { name = 'Johll', detail = 'full', now = { day: 0, minute: 0 } } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Johll//Family Portal//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escText(name)}`, 'X-WR-TIMEZONE:Asia/Singapore'];
  for (const e of events) {
    // In busy mode even the identifier must say nothing about what the event is.
    const uid = detail === 'busy' ? `busy-${e.day}-${e.start}-${e.end}` : e.id;
    lines.push('BEGIN:VEVENT', `UID:${uid}@johll`, `DTSTAMP:${stamp(now.day, now.minute)}`, `DTSTART:${stamp(e.day, e.start)}`, `DTEND:${stamp(e.day, e.end)}`);
    if (detail === 'busy') {
      lines.push('SUMMARY:Busy', 'TRANSP:OPAQUE');
    } else {
      lines.push(`SUMMARY:${escText(e.title)}`);
      if (e.place) lines.push(`LOCATION:${escText(e.place)}`);
      if (e.notes) lines.push(`DESCRIPTION:${escText(e.notes)}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// One person's week as calendar events. `say` turns person tokens into that person's names.
export function eventsFor(commitments, v, say = (x) => x) {
  return commitments
    .filter((c) => c.status !== 'cancelled' && !['school', 'rest'].includes(c.type) && (c.people.includes(v) || c.owner === v || c.driver === v))
    .sort((a, b) => a.day - b.day || a.start - b.start)
    .map((c) => {
      const notes = [];
      if (c.driver) notes.push(c.driver === v ? 'You drive.' : say(`{${c.driver}} drives.`));
      if (c.owner && c.owner !== v) notes.push(say(`Owner: {${c.owner}}.`));
      const bring = c.needs.filter((n) => !n.done).map((n) => n.label);
      if (bring.length) notes.push(`Still needed: ${bring.join(', ')}.`);
      return { id: c.id, day: c.day, start: c.start, end: c.end, title: say(c.title), place: c.place, notes: notes.join(' ') };
    });
}
