// Small rendering helpers shared by every screen.

import { member, nameOf } from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const icon = (name, label = '') => `<i class="ph ph-${name}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}></i>`;
export const hue = (id) => `--c:var(--p-${member(id)?.hue || id})`;

export function avatar(id, size = '') {
  const m = member(id);
  if (!m) return '';
  return `<span class="avatar ${size}" style="${hue(id)}" title="${esc(m.name)}">${esc(m.name[0])}</span>`;
}

export const who = (id, extra = '') => `<span class="who">${avatar(id, 'sm')}${esc(nameOf(id))}${extra}</span>`;

export const NEED_ICON = { kit: 'backpack', form: 'clipboard-text', payment: 'money', gift: 'gift', driver: 'steering-wheel' };
export const SOURCE_ICON = { email: 'envelope-simple', image: 'image', voice: 'microphone', typed: 'note-pencil' };
export const CHANNEL = {
  ring: { label: 'Rings', icon: 'phone-call' },
  push: { label: 'Notification', icon: 'bell' },
  digest: { label: 'In the digest', icon: 'tray' },
  board: { label: 'On the board', icon: 'monitor' },
};

let toastTimer = null;
export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  // A single short sentence reads better without its full stop.
  el.textContent = /^[^.]+\.$/.test(message) ? message.slice(0, -1) : message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
