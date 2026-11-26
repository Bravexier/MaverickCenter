// Aucun octet NUL littéral dans le code du service (client/serveur/*.mjs) : JavaScript l'accepte, mais grep, rg et l'outil Grep traitent alors tout le fichier
// comme binaire et passent à côté de ses lignes (ronde 1 de la tâche 13 : l'échappement NUL de edition-journal.mjs était devenu un octet). Il s'écrit à six caractères.
//   node --test test/serveur-sans-octet-nul.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dossier = fileURLToPath(new URL('../serveur/', import.meta.url));

test('aucun fichier .mjs de client/serveur/ ne contient d’octet NUL', () => {
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.mjs'));
  assert.ok(fichiers.length > 10, 'les fichiers du service sont lus');
  const fautifs = fichiers.filter((f) => readFileSync(join(dossier, f)).includes(0));
  assert.deepEqual(fautifs, [], 'écrire l’échappement à six caractères, jamais l’octet');
});
