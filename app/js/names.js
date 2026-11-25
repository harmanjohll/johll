// Names. The repo knows people only as H, K, A1 and A2. Real names and pet names are
// held in an encrypted file and unlocked on a device with the family's code.
//
// Limit, stated plainly: the encrypted file is public and the code is four digits,
// so this is a diary lock. It keeps names away from casual visitors and search engines.
// It would not stop someone determined to try every code. It guards names only.

const DB = 'johll';
const STORE = 'keys';
const KEY_ID = 'names';
const LOCAL = 'johll.names.local';
const subtle = () => globalThis.crypto && globalThis.crypto.subtle;

let names = null; // Decrypted names, held in memory only.
let key = null;

const b64 = {
  to: (buf) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); },
  from: (str) => Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0)),
};

export const cryptoAvailable = () => Boolean(subtle());
export const isUnlocked = () => names != null;

export async function deriveKey(code, salt, rounds) {
  const material = await subtle().importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptWith(k, value) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = await subtle().encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(value)));
  return { iv: b64.to(iv), data: b64.to(data) };
}

export async function decryptWith(k, box) {
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: b64.from(box.iv) }, k, b64.from(box.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

// Used once, outside the repo, to make the encrypted file.
export async function seal(code, value, rounds = 600000) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(code, salt, rounds);
  return { v: 1, kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM', rounds, salt: b64.to(salt), ...(await encryptWith(k, value)) };
}

// Returns the names, or throws if the code is wrong.
export async function open(code, sealed) {
  const k = await deriveKey(code, b64.from(sealed.salt), sealed.rounds);
  return { key: k, value: await decryptWith(k, sealed) };
}

// The browser's own key store. The key is saved as not extractable: the page can
// use it on this device, but cannot read it out or send it anywhere.
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function fetchSealed() {
  const res = await fetch(new URL('./data/names.enc.json', import.meta.url));
  if (!res.ok) throw new Error('Names file missing');
  return res.json();
}

async function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL);
    if (raw && key) names = mergeNames(names, await decryptWith(key, JSON.parse(raw)));
  } catch (e) { /* Local edits that cannot be read are ignored, never fatal. */ }
}

function mergeNames(base, edits) {
  const out = JSON.parse(JSON.stringify(base));
  for (const [id, p] of Object.entries(edits.people || {})) {
    if (!out.people[id]) continue;
    Object.assign(out.people[id], { formal: p.formal || out.people[id].formal, family: p.family || out.people[id].family });
    Object.assign(out.people[id].by, p.by || {});
  }
  return out;
}

// On page load: if this device was unlocked before, unlock again without asking.
export async function resume() {
  if (!cryptoAvailable() || typeof indexedDB === 'undefined') return false;
  try {
    const saved = await idb('readonly', (s) => s.get(KEY_ID));
    if (!saved) return false;
    names = await decryptWith(saved, await fetchSealed());
    key = saved;
    await loadLocal();
    return true;
  } catch (e) { names = null; key = null; return false; }
}

export async function unlock(code) {
  const sealed = await fetchSealed();
  const opened = await open(code, sealed); // Throws on a wrong code.
  names = opened.value;
  key = opened.key;
  try { await idb('readwrite', (s) => s.put(key, KEY_ID)); } catch (e) { /* Still unlocked for this visit. */ }
  await loadLocal();
  return true;
}

export async function lock() {
  names = null;
  key = null;
  try { await idb('readwrite', (s) => s.delete(KEY_ID)); } catch (e) { /* Nothing to remove. */ }
  try { localStorage.removeItem(LOCAL); } catch (e) { /* Nothing to remove. */ }
}

// Changes made on this device are saved here only, encrypted with the same key.
export async function saveEdits(next) {
  names = next;
  if (key) localStorage.setItem(LOCAL, JSON.stringify(await encryptWith(key, next)));
}

// Other family data kept on this device only (for example adventures the family adds).
// It is encrypted with the same key, so it can be read only while the device is unlocked.
const deviceKey = (name) => `johll.device.${name}`;
export async function saveDevice(name, value) {
  if (!key) return false;
  try { localStorage.setItem(deviceKey(name), JSON.stringify(await encryptWith(key, value))); return true; } catch (e) { return false; }
}
export async function loadDevice(name) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(deviceKey(name));
    return raw ? await decryptWith(key, JSON.parse(raw)) : null;
  } catch (e) { return null; }
}
export function clearDevice(name) {
  try { localStorage.removeItem(deviceKey(name)); } catch (e) { /* Nothing to remove. */ }
}

export const currentNames = () => names;

// For tests and for callers that hold names another way.
export function setNamesForTest(value) { names = value; }

// The one place a name is chosen.
//   personal: the viewer's own name for that person
//   family:   the shared family name (the board, the family group message)
//   formal:   the given name, for anything addressed outside the family
export function nameFor(id, { viewer = null, context = 'personal' } = {}) {
  const p = names && names.people[id];
  if (!p) return id;
  if (context === 'formal') return p.formal;
  if (context === 'family' || !viewer) return p.family;
  if (viewer === id) return p.formal;
  return (p.by && p.by[viewer]) || p.family;
}

// Every name a person might be called, for reading typed text.
export function aliasesOf(id) {
  const p = names && names.people[id];
  if (!p) return [id];
  return [...new Set([id, p.formal, p.family, ...Object.values(p.by || {})])].filter(Boolean);
}

// Replace tokens such as {A2} in a sentence with the right name for whoever reads it.
export function tx(text, opts = {}) {
  return String(text ?? '').replace(/\{(H|K|A1|A2)\}/g, (_, id) => nameFor(id, opts));
}
