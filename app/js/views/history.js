// History: every change, who made it, and a way back.

import { state, restore, nameOf } from '../store.js';
import { esc, icon, avatar, toast } from '../ui.js';

export default {
  render() {
    return `
      <header class="head">
        <h1 class="h1">History</h1>
        <p class="lede">Every change to shared plans is recorded with who made it. Any point can be restored, and the restore is itself recorded.</p>
      </header>
      <section class="card flush" aria-label="Changes">
        ${state.history.map((h) => `<div class="item"><div class="between">
          <div><b>${esc(h.what)}</b><div class="meta"><span class="who">${avatar(h.who, 'sm')}${esc(nameOf(h.who))}</span>, <span class="mono">${esc(h.when)}</span></div></div>
          <button class="btn small" data-act="restore" data-id="${h.id}">${icon('arrow-u-up-left')}Undo to before this</button></div></div>`).join('')
  || `<div class="empty" style="border:0">No changes yet. Tick something off on Today, or move the dentist in Ripple, and it will appear here.</div>`}
      </section>
      <p class="rule"><b>Borrowed from version control.</b> "Who moved the pickup?" has an answer, and a mistake is one tap from undone. This prototype keeps history only while the tab is open.</p>`;
  },
  actions: {
    restore: (d) => { restore(d.id); toast('Restored.'); },
  },
};
