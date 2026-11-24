// Names: who calls whom what, kept on this device only.

import { state, emit } from '../store.js';
import { esc, icon, avatar, toast } from '../ui.js';
import * as names from '../names.js';

export default {
  render() {
    if (!names.isUnlocked()) {
      return `
        <header class="head"><h1 class="h1">Names</h1>
          <p class="lede">This device is locked, so people appear as H, K, A1 and A2. Sign in with the family code to see names.</p></header>
        <div><button class="btn primary" data-act="lockSheet">${icon('lock-open')}Sign in</button></div>
        <section class="card stack"><h2 class="h2">How names are kept</h2>
          <p>The published portal knows the family only by codes. Names and pet names sit in an encrypted file. The code unlocks them on a device, and they stay unlocked there until that device is locked again.</p>
          <p class="meta">This is a diary lock, not a safe: it keeps names from casual visitors and search engines. It guards names only; every time and place in this prototype is invented.</p></section>`;
    }
    const data = names.currentNames();
    const ids = state.members.map((m) => m.id);
    return `
      <header class="head"><h1 class="h1">Names</h1>
        <p class="lede">The name shown depends on who is looking and where it appears. Changes here stay on this device.</p></header>
      <section class="card stack" aria-label="Three registers">
        <h2 class="h2">Three registers</h2>
        <dl class="kv">
          <dt>Personal</dt><dd>What you call someone. Used in your own notifications and screens.</dd>
          <dt>Family</dt><dd>What the whole family uses. The kitchen board and the WhatsApp group draft.</dd>
          <dt>Formal</dt><dd>The given name. Anything sent outside the family: a school, a coach, a clinic.</dd>
        </dl>
      </section>
      ${ids.map((id) => {
    const p = data.people[id];
    return `<section class="card stack" aria-label="Names for ${esc(p.formal)}">
          <div class="between"><h2 class="h2">${avatar(id)} ${esc(p.formal)}</h2><span class="meta">Code ${id}</span></div>
          <div class="cols even">
            <label class="field">Formal<input type="text" maxlength="30" value="${esc(p.formal)}" data-on="edit" data-id="${id}" data-v="formal"></label>
            <label class="field">Family<input type="text" maxlength="30" value="${esc(p.family)}" data-on="edit" data-id="${id}" data-v="family"></label>
          </div>
          <div class="cols even">
            ${ids.filter((x) => x !== id).map((viewer) => `<label class="field">What ${esc(data.people[viewer].formal)} calls ${esc(p.formal)}<input type="text" maxlength="30" value="${esc((p.by && p.by[viewer]) || '')}" placeholder="${esc(p.family)}" data-on="edit" data-id="${id}" data-v="by:${viewer}"></label>`).join('')}
          </div>
        </section>`;
  }).join('')}
      <div class="cluster"><button class="btn" data-act="lockNow">${icon('lock')}Lock this device</button></div>
      <p class="rule">Edits are encrypted with the same key and saved in this browser. Locking the device removes them.</p>`;
  },
  inputs: {
    edit: async (value, d, el, type) => {
      if (type !== 'change') return;
      const next = JSON.parse(JSON.stringify(names.currentNames()));
      const p = next.people[d.id];
      const v = value.trim();
      if (d.v.startsWith('by:')) { p.by = p.by || {}; if (v) p.by[d.v.slice(3)] = v; else delete p.by[d.v.slice(3)]; }
      else if (v) p[d.v] = v;
      await names.saveEdits(next);
      emit();
      toast('Saved on this device.');
    },
  },
};
