// My notifications: each person's contract. The receiver decides delivery.

import { state, commit, member, nameOf } from '../store.js';
import { esc, icon, avatar, CHANNEL } from '../ui.js';
import { fmtTime, hm, abs, minuteOf, dayOf } from '../engine/time.js';
import { route } from '../engine/route.js';

const DIGESTS = [hm(7), hm(12), hm(15), hm(19), hm(20)];
const toClock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromClock = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

function preview(v) {
  const day = dayOf(state.now);
  const cases = [
    ['A change to something of yours, at 10am', { at: abs(day, hm(10)), intent: 'nudge', to: [{ id: v, reason: 'Yours' }] }],
    ['The same change at 11pm', { at: abs(day, hm(23)), intent: 'nudge', to: [{ id: v, reason: 'Yours' }] }],
    ['A pickup you own that nobody has confirmed, at 11pm', { at: abs(day, hm(23)), intent: 'interrupt', needsAck: true, to: [{ id: v, reason: 'Yours' }] }],
    ['Something about Leo that you are not part of, at 2pm', { at: abs(day, hm(14)), intent: 'nudge', about: { people: ['leo'] }, to: [] }],
  ];
  return cases.map(([label, e], i) => {
    const d = route({ id: `p${i}`, text: '', about: {}, ...e }, state.members, state.contracts).deliveries.find((x) => x.to === v);
    const ch = d && CHANNEL[d.channel];
    return `<div class="between"><span>${label}</span><span class="badge ${d && (d.channel === 'push' || d.channel === 'ring') ? 'accent' : 'calm'}">${d ? `${icon(ch.icon)} ${ch.label}${d.channel === 'digest' ? `, ${fmtTime(minuteOf(d.at))}` : ''}` : 'Not told'}</span></div>`;
  }).join('');
}

export default {
  render() {
    const v = state.viewer;
    const m = member(v);
    const c = state.contracts[v];
    const targets = [...state.members.filter((x) => x.id !== v).map((x) => ({ key: x.id, label: x.name, av: avatar(x.id, 'sm') })), ...state.activities.map((a) => ({ key: `activity:${a.id}`, label: a.name, av: icon('books') }))];
    const tierOf = (key) => c.follows.find((f) => f.target === key)?.tier || 'none';
    return `
      <header class="head">
        <h1 class="h1">My notifications</h1>
        <p class="lede">${esc(m.name)}'s rules. Whoever sends something says how urgent it is; these rules decide how, and whether, it reaches ${m.device ? 'this phone' : 'the board'}.</p>
      </header>
      ${m.device ? '' : `<div class="banner">${icon('monitor')}<div>${esc(m.name)} has no phone, so everything shows on the kitchen board. An adult sets what appears there.</div></div>`}
      <div class="cols even">
        <div class="stack">
          <section class="card stack" aria-label="The four tiers">
            <h2 class="h2">The four tiers</h2>
            <dl class="kv">
              <dt>Board only</dt><dd>Shows on the kitchen board. No notification, ever.</dd>
              <dt>Digest</dt><dd>Gathered and sent at your digest times.</dd>
              <dt>Nudge</dt><dd>One notification. Held during your quiet hours.</dd>
              <dt>Interrupt</dt><dd>Rings until acknowledged, then moves to the next named person. Ignores quiet hours. Used only for things with an owner and a deadline.</dd>
            </dl>
          </section>
          <section class="card stack" aria-label="Quiet hours and digests">
            <h2 class="h2">Quiet hours and digests</h2>
            <div class="cols even">
              <label class="field">Quiet from<input type="time" value="${toClock(c.quiet[0])}" data-on="quiet" data-v="0"></label>
              <label class="field">Until<input type="time" value="${toClock(c.quiet[1])}" data-on="quiet" data-v="1"></label>
            </div>
            <div class="field">Digest times
              <div class="cluster" role="group" aria-label="Digest times">${DIGESTS.map((t) => `<button class="chip mono" data-act="digest" data-v="${t}" aria-pressed="${c.digestTimes.includes(t)}">${fmtTime(t)}</button>`).join('')}</div>
              <span class="help">About three a day works best; more than that starts to feel like nagging.</span>
            </div>
            <label class="between" style="cursor:pointer"><span><b>Only the digest</b><span class="meta" style="display:block">Nudges wait for the digest unless they need my answer.</span></span><input type="checkbox" data-on="lower" ${c.lower === 'digest' ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)"></label>
          </section>
        </div>
        <div class="stack">
          <section class="card stack" aria-label="Following">
            <h2 class="h2">Following</h2>
            <p class="meta">You always hear about what you own, attend or drive. Following adds people and activities you are not part of.</p>
            ${targets.map((t) => `<label class="between"><span class="who">${t.av}${esc(t.label)}</span>
              <select class="input" style="width:auto;min-height:34px;padding:4px 8px" data-on="follow" data-id="${t.key}" aria-label="Follow ${esc(t.label)}">
                ${[['none', 'Not following'], ['ambient', 'Board only'], ['digest', 'Digest'], ['nudge', 'Nudge']].map(([val, lab]) => `<option value="${val}" ${tierOf(t.key) === val ? 'selected' : ''}>${lab}</option>`).join('')}
              </select></label>`).join('')}
          </section>
          <section class="card stack" aria-label="What these rules do">
            <h2 class="h2">What these rules do</h2>
            <div class="stack tight">${preview(v)}</div>
            <p class="rule">Try them in the <a href="#/simulator">day simulator</a>: it reads these rules live.</p>
          </section>
        </div>
      </div>`;
  },
  actions: {
    digest: (d) => {
      const c = state.contracts[state.viewer];
      const t = Number(d.v);
      const next = c.digestTimes.includes(t) ? c.digestTimes.filter((x) => x !== t) : [...c.digestTimes, t].sort((a, b) => a - b);
      if (!next.length) return;
      commit(`${nameOf(state.viewer)} changed digest times`, () => { c.digestTimes = next; });
    },
  },
  inputs: {
    quiet: (value, d, el, type) => { if (type !== 'change' || !value) return; const c = state.contracts[state.viewer]; commit(`${nameOf(state.viewer)} changed quiet hours`, () => { c.quiet[Number(d.v)] = fromClock(value); }); },
    lower: (checked) => { const c = state.contracts[state.viewer]; commit(`${nameOf(state.viewer)} ${checked ? 'chose digest only' : 'allowed nudges again'}`, () => { c.lower = checked ? 'digest' : null; }); },
    follow: (value, d, el, type) => {
      if (type !== 'change') return;
      const c = state.contracts[state.viewer];
      commit(`${nameOf(state.viewer)} changed who they follow`, () => {
        c.follows = c.follows.filter((f) => f.target !== d.id);
        if (value !== 'none') c.follows.push({ target: d.id, tier: value });
      });
    },
  },
};
