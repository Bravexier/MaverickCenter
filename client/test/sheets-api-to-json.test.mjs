// tools/sheets/sheets_api_to_json.py : conversion de la réponse du connecteur Google Sheets en JSON uniforme.
// Les notes de cellule (« note ») ne doivent jamais se perdre en silence : sans elles, les extracteurs ne peuvent pas
// les retrouver (le contrôle de couverture compare les pages au dump, pas au classeur). Exemple réel : les trois dons
// du Médusain portent « Jet de vigueur pour esquiver l'altération d'état ».
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const script = fileURLToPath(new URL('../../tools/sheets/sheets_api_to_json.py', import.meta.url));
const python = spawnSync('python3', ['-I', '-c', 'pass']);
const NOTE = "Jet de vigueur pour esquiver l'altération d'état";

function convert(response) {
  const dir = dossierTemporaire('sheets-api');
  writeFileSync(join(dir, 'in.json'), JSON.stringify(response));
  const run = spawnSync('python3', ['-I', script, join(dir, 'in.json'), join(dir, 'out.json')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8'));
}

const reponse = {
  sheets: [{
    properties: { title: 'Médusain' },
    merges: [{ startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 7 }],
    data: [{
      rowData: [
        { values: [{ formattedValue: 'Titre', hyperlink: 'https://exemple.test/' }, {}, { formattedValue: '' }] },
        {},
        { values: [{}, { formattedValue: '16' }, { formattedValue: 'Don', note: NOTE }] },
        { values: [{}, {}, { note: 'Note sur une cellule vide' }] },
      ],
    }],
  }],
};

test('une note de cellule est écrite dans le dump, avec la valeur affichée de sa cellule', { skip: python.status !== 0 && 'python3 absent' }, () => {
  const [sheet] = convert(reponse).sheets;
  const cell = sheet.cells.find((c) => c.r === 3 && c.c === 3);
  assert.deepEqual(cell, { r: 3, c: 3, v: 'Don', note: NOTE });
});

test('une note sur une cellule vide n’est pas perdue (v vide), les autres cellules vides restent omises', { skip: python.status !== 0 && 'python3 absent' }, () => {
  const [sheet] = convert(reponse).sheets;
  assert.deepEqual(sheet.cells.find((c) => c.r === 4 && c.c === 3), { r: 4, c: 3, v: '', note: 'Note sur une cellule vide' });
  assert.deepEqual(sheet.cells.map((c) => [c.r, c.c]), [[1, 1], [3, 2], [3, 3], [4, 3]]);
});

test('sans note, la clé « note » est absente ; l’hyperlien et la valeur affichée sont conservés', { skip: python.status !== 0 && 'python3 absent' }, () => {
  const [sheet] = convert(reponse).sheets;
  assert.deepEqual(sheet.cells.find((c) => c.r === 1 && c.c === 1), { r: 1, c: 1, v: 'Titre', link: 'https://exemple.test/' });
  assert.deepEqual(sheet.cells.find((c) => c.r === 3 && c.c === 2), { r: 3, c: 2, v: '16' });
  assert.deepEqual(sheet.merged, ['A1:G2']);
});
