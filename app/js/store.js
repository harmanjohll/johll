// In memory state for the prototype. Nothing is saved beyond this tab.

import * as sample from './data/sample.js';
import { abs, hm, fmtAbs } from './engine/time.js';
import { nameFor, saveDevice, loadDevice, isUnlocked } from './names.js';

const listeners = new Set();

export const state = {
  members: sample.createMembers(),
  cars: sample.createCars(),
  contracts: sample.createContracts(),
  activities: sample.createActivities(),
  commitments: sample.createCommitments(),
  playbooks: sample.PLAYBOOKS,
  triage: sample.createTriage(),
  rota: sample.createRota(),
  projects: sample.createProjects(),
  house: sample.createHousekeeping(),
  dinner: sample.createDinner(),
  log: sample.createLog(),
  prefs: sample.createPrefs(),
  routines: [],
  routinesDeclined: [],
  later: [],
  thread: [],
  homeAll: false,
  expiries: sample.createExpiries(),
  connections: sample.createConnections(),
  automations: sample.createAutomations(),
  adventures: sample.createAdventures(),
  checkins: [],
  watches: [],
  told: [],
  safeword: { H: false, K: false, A1: false, A2: false },
  tasks: [
    { id: 'task1', title: 'Renew the football season registration', owner: 'H', due: 'Fri', done: false },
    { id: 'task2', title: 'Reply to the playdate invitation', owner: 'K', due: 'Thu', done: false },
  ],
  now: abs(0, hm(12, 40)),
  viewer: 'H',
  history: [],
  draft: null,
  whatIf: null,
  sim: { id: 'pickup', t: abs(0, hm(12, 45)), input: {}, playing: false },
  swaps: {},
  handoffRead: false,
  mood: {},
  weekSel: null,
  seasons: {},
};

export const member = (id) => state.members.find((m) => m.id === id);
// The name of a person as the current viewer knows them.
export const nameOf = (id) => nameFor(id, { viewer: state.viewer });
export const commitment = (id) => state.commitments.find((c) => c.id === id);
export const household = (overrides = {}) => ({ commitments: state.commitments, members: state.members, cars: state.cars, contracts: state.contracts, playbooks: state.playbooks, now: state.now, ...overrides });

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() { for (const fn of listeners) fn(); }

const KEEP = ['commitments', 'tasks', 'triage', 'contracts', 'rota', 'swaps', 'seasons', 'house', 'dinner', 'routines', 'routinesDeclined', 'prefs', 'expiries', 'connections', 'automations', 'adventures', 'checkins', 'watches', 'safeword'];
const snapshot = () => JSON.stringify(Object.fromEntries(KEEP.map((k) => [k, state[k]])));

// Every change to shared state goes through here, so it is logged and can be undone.
export function commit(what, mutate, who = state.viewer) {
  const before = snapshot();
  mutate();
  state.history.unshift({ id: `h${Date.now()}${state.history.length}`, at: state.now, when: fmtAbs(state.now), who, what, before });
  emit();
}

export function restore(id) {
  const entry = state.history.find((h) => h.id === id);
  if (!entry) return;
  commit(`Restored the household to just before: ${entry.what}`, () => {
    Object.assign(state, JSON.parse(entry.before));
  });
}

export function set(patch) { Object.assign(state, patch); emit(); }

// Adventures the family adds are real family data, so they never go into the published
// site. They are kept on this device only, encrypted with the key that unlocks the names.
export async function saveAdventures() {
  if (state.adventures.sample || !isUnlocked()) return false;
  return saveDevice('adventures', state.adventures);
}

// Called when the device unlocks or locks: show the family's own, or fall back to the samples.
export async function syncDeviceData() {
  const own = isUnlocked() ? await loadDevice('adventures') : null;
  state.adventures = own || sample.createAdventures();
}
