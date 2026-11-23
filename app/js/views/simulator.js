// The day simulator: play a scenario and watch what reaches each person, and why.

import { state, set, emit, household, nameOf } from '../store.js';
import { esc, icon, avatar, hue, CHANNEL, plural } from '../ui.js';
import { abs, minuteOf, fmtTime, DAYS } from '../engine/time.js';
import { SCENARIOS, runScenario } from '../engine/simulate.js';

let timer = null;
const scenario = () => SCENARIOS.find((s) => s.id === state.sim.id);
const run = () => runScenario(state.sim.id, household(), state.sim.input);

function contractLine(m) {
  if (!m.device) return 'No phone. Items show on the kitchen board.';
  const c = state.contracts[m.id];
  const quiet = `Quiet ${fmtTime(c.quiet[0])} to ${fmtTime(c.quiet[1])}`;
  const digest = c.lower === 'digest' ? `One digest at ${c.digestTimes.map(fmtTime).join(', ')}` : `Digests ${c.digestTimes.map(fmtTime).join(', ')}`;
  return `${quiet}. ${digest}.`;
}

function noteHtml(d, r, t) {
  const ch = CHANNEL[d.channel];
  const s = state.sim;
  let actions = '';
  if (d.needsAck && r.canAck && r.canAck.includes(d.to)) actions = `<button class="btn small primary" data-act="simAck" data-id="${d.to}">${icon('check')}I have it</button>`;
  if (d.needsAnswer && r.canAnswer && r.canAnswer.includes(d.to)) actions = `<span class="cluster"><button class="btn small primary" data-act="simAnswer" data-v="yes">Accept</button><button class="btn small" data-act="simAnswer" data-v="no">Decline</button></span>`;
  if (s.id === 'late' && d.to === 'rosa' && r.canHold) actions = `<button class="btn small primary" data-act="simHold">Hold dinner to 7:30pm</button>`;
  return `<div class="note ch-${d.channel}">
    <div class="note-top"><span>${icon(ch.icon)} ${ch.label}</span><span class="mono">${fmtTime(minuteOf(d.at))}</span></div>
    <div>${esc(d.text)}</div>
    <div class="why">Why: ${esc(d.reason)}.</div>
    ${actions}
  </div>`;
}

function stage() {
  const r = run();
  const t = state.sim.t;
  const shown = r.deliveries.filter((d) => d.at <= t);
  const phones = state.members.map((m) => {
    const mine = shown.filter((d) => d.to === m.id).reverse();
    const reached = mine.some((d) => d.channel === 'ring' || d.channel === 'push');
    const later = r.deliveries.some((d) => d.to === m.id && d.at > t);
    return `<article class="phone ${reached ? 'lit' : ''} ${m.device ? '' : 'nophone'}" style="${hue(m.id)}" aria-label="${esc(m.name)}">
      <div class="phone-head">${avatar(m.id)}<div><div class="name">${esc(m.name)} <span class="meta">${esc(m.label)}</span></div><div class="contract">${esc(contractLine(m))}</div></div></div>
      ${mine.map((d) => noteHtml(d, r, t)).join('') || `<div class="silent">${later ? 'Nothing yet.' : 'Nothing. Not affected, so not told.'}</div>`}
    </article>`;
  }).join('');
  const withPhones = state.members.filter((m) => m.device);
  const reachedCount = withPhones.filter((m) => shown.some((d) => d.to === m.id && (d.channel === 'ring' || d.channel === 'push'))).length;
  const quietCount = r.suppressed.filter((x) => x.at <= t).length;
  return `<p class="meta" aria-live="polite">${reachedCount} of ${withPhones.length} phones interrupted so far. ${quietCount ? `${plural(quietCount, 'update')} changed what is shown without a new alert.` : ''}</p>
    <div class="phones">${phones}</div>`;
}

function stop() { clearInterval(timer); timer = null; state.sim.playing = false; }

function sync(root) {
  const s = scenario();
  const minute = minuteOf(state.sim.t);
  root.querySelector('#sim-clock').textContent = fmtTime(minute);
  root.querySelector('#sim-stage').innerHTML = stage();
  const range = root.querySelector('#sim-range');
  if (document.activeElement !== range) range.value = String(minute);
  range.setAttribute('aria-valuetext', fmtTime(minute));
  for (const m of root.querySelectorAll('.mark')) m.classList.toggle('hit', Number(m.dataset.at) <= state.sim.t);
  const btn = root.querySelector('[data-act="simPlay"]');
  btn.innerHTML = state.sim.playing ? `${icon('pause')}Pause` : `${icon('play')}${minute >= s.to ? 'Play again' : 'Play'}`;
}

export default {
  render() {
    const s = scenario();
    const r = run();
    const span = s.to - s.from;
    return `
      <header class="head">
        <h1 class="h1">Day simulator</h1>
        <p class="lede">Play a moment from the family's week and watch what reaches each person, on which channel, and why. The same rules will run the real portal.</p>
      </header>
      <div class="scenarios" role="group" aria-label="Scenario">
        ${SCENARIOS.map((x) => `<button class="scenario" data-act="simPick" data-id="${x.id}" aria-pressed="${x.id === s.id}"><b>${esc(x.title)}</b><span class="meta">${DAYS[x.day]}. ${esc(x.rule)}.</span></button>`).join('')}
      </div>
      <section class="card scrub" aria-label="Timeline">
        <p>${esc(s.blurb)}</p>
        <div class="scrub-top">
          <span class="clock" id="sim-clock">${fmtTime(minuteOf(state.sim.t))}</span>
          <button class="btn primary" data-act="simPlay">${icon('play')}Play</button>
          <button class="btn" data-act="simReset">${icon('arrow-counter-clockwise')}Start over</button>
          ${s.id === 'dentist' ? `<a class="btn quiet" href="#/ripple" data-act="simToRipple">${icon('graph')}See this change in Ripple</a>` : ''}
        </div>
        <div class="track">
          ${r.marks.map((m) => `<span class="mark" data-at="${m.at}" style="left:calc(11px + (100% - 22px) * ${((minuteOf(m.at) - s.from) / span).toFixed(4)})"></span>`).join('')}
          <input id="sim-range" type="range" min="${s.from}" max="${s.to}" step="1" value="${minuteOf(state.sim.t)}" data-on="simScrub" aria-label="Time of day">
        </div>
        <div class="marks-list">${r.marks.map((m) => `<button class="chip" data-act="simJump" data-v="${m.at}"><span class="mono">${fmtTime(minuteOf(m.at))}</span> ${esc(m.label)}</button>`).join('')}</div>
      </section>
      <section id="sim-stage" class="stack" aria-label="What each person receives">${stage()}</section>
      <p class="rule">Change anyone's rules in <a href="#/notifications">My notifications</a> and replay: the deliveries change with them.</p>`;
  },
  mount(root) { sync(root); },
  unmount() { stop(); },
  actions: {
    simPick: (d) => { stop(); const s = SCENARIOS.find((x) => x.id === d.id); set({ sim: { id: s.id, t: abs(s.day, s.from), input: {}, playing: false } }); },
    simReset: () => { stop(); const s = scenario(); set({ sim: { id: s.id, t: abs(s.day, s.from), input: {}, playing: false } }); },
    simJump: (d) => { stop(); state.sim.t = Number(d.v); sync(document.getElementById('view')); },
    simPlay: () => {
      const s = scenario();
      const root = document.getElementById('view');
      if (state.sim.playing) { stop(); sync(root); return; }
      if (minuteOf(state.sim.t) >= s.to) state.sim.t = abs(s.day, s.from);
      state.sim.playing = true;
      const step = Math.max(1, Math.round((s.to - s.from) / 240));
      timer = setInterval(() => {
        state.sim.t = Math.min(abs(s.day, s.to), state.sim.t + step);
        if (minuteOf(state.sim.t) >= s.to) stop();
        sync(root);
      }, 90);
      sync(root);
    },
    simAck: (d) => { stop(); state.sim.input = { ...state.sim.input, acks: { ...(state.sim.input.acks || {}), [d.id]: minuteOf(state.sim.t) } }; emit(); },
    simAnswer: (d) => { stop(); state.sim.input = { ...state.sim.input, answer: { accept: d.v === 'yes', minute: minuteOf(state.sim.t) } }; emit(); },
    simHold: () => { stop(); state.sim.input = { ...state.sim.input, holdDinner: minuteOf(state.sim.t) }; emit(); },
    simToRipple: () => { set({ draft: { cid: 'dentist', patch: { day: 3, start: 16 * 60, end: 17 * 60 }, choices: { 'art-3': 'nani' } } }); },
  },
  inputs: {
    simScrub: (value) => { stop(); const s = scenario(); state.sim.t = abs(s.day, Number(value)); sync(document.getElementById('view')); },
  },
};

export { nameOf };
