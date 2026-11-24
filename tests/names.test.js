import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seal, open, nameFor, tx, aliasesOf, setNamesForTest } from '../app/js/names.js';

// Invented names and an invented code. The family's real names and code are never in this repo.
const SAMPLE = { people: {
  H: { formal: 'Henry', family: 'Dad', by: { K: 'Dear', A1: 'Dad', A2: 'Daddy' } },
  K: { formal: 'Kate', family: 'Mum', by: { H: 'Darling', A1: 'Mum', A2: 'Mummy' } },
  A1: { formal: 'Adam', family: 'Adam', by: { H: 'Champ', K: 'Champ' } },
  A2: { formal: 'Annabel', family: 'Annie', by: { H: 'Poppet', K: 'Sweetpea', A1: 'Annie' } },
} };

test('locked: people are shown by code', () => {
  setNamesForTest(null);
  assert.equal(nameFor('A2', { viewer: 'H' }), 'A2');
  assert.equal(tx('{K} is collecting {A2}.', { viewer: 'H' }), 'K is collecting A2.');
  assert.deepEqual(aliasesOf('A2'), ['A2']);
});

test('unlocked: the name depends on who is looking', () => {
  setNamesForTest(SAMPLE);
  assert.equal(nameFor('K', { viewer: 'H' }), 'Darling');
  assert.equal(nameFor('H', { viewer: 'K' }), 'Dear');
  assert.equal(nameFor('H', { viewer: 'A2' }), 'Daddy');
  assert.equal(nameFor('A2', { viewer: 'H' }), 'Poppet');
  assert.equal(nameFor('A2', { viewer: 'K' }), 'Sweetpea');
  assert.equal(nameFor('A1', { viewer: 'A2' }), 'Adam', 'falls back to the family name');
  assert.equal(nameFor('H', { viewer: 'H' }), 'Henry', 'you see your own given name');
});

test('unlocked: the name depends on context', () => {
  setNamesForTest(SAMPLE);
  assert.equal(nameFor('A2', { viewer: 'H', context: 'formal' }), 'Annabel', 'a note to a school never uses a pet name');
  assert.equal(nameFor('A2', { viewer: 'H', context: 'family' }), 'Annie', 'the board and the group message use the shared name');
  assert.equal(tx('{K} is collecting {A2}.', { viewer: 'H' }), 'Darling is collecting Poppet.');
  assert.equal(tx('{K} is collecting {A2}.', { viewer: 'A1' }), 'Mum is collecting Annie.');
  assert.equal(tx('{K} is collecting {A2}.', { context: 'family' }), 'Mum is collecting Annie.');
  assert.ok(aliasesOf('A2').includes('Poppet') && aliasesOf('A2').includes('Annabel'));
  setNamesForTest(null);
});

test('sealing: the right code opens it and a wrong code is refused', async () => {
  const sealed = await seal('1234', SAMPLE, 1000);
  assert.ok(!JSON.stringify(sealed).includes('Annabel'), 'nothing readable in the sealed file');
  const opened = await open('1234', sealed);
  assert.deepEqual(opened.value, SAMPLE);
  await assert.rejects(() => open('1235', sealed));
});

test('the committed names file is sealed and holds no readable names', () => {
  const raw = readFileSync(new URL('../app/js/data/names.enc.json', import.meta.url), 'utf8');
  const sealed = JSON.parse(raw);
  assert.deepEqual(Object.keys(sealed).sort(), ['cipher', 'data', 'iv', 'kdf', 'rounds', 'salt', 'v']);
  assert.ok(sealed.rounds >= 600000);
  assert.ok(!/[a-z]{4,} [a-z]{3,}/i.test(sealed.data), 'looks like ciphertext, not prose');
});
