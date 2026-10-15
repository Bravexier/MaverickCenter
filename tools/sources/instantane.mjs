// Instantané d'un classeur, tel qu'il est gardé dans sources/raw/classeurs/ (docs/sources.md, « Rapprochement d'un classeur ») : le dump uniforme de
// tools/sheets/xlsx_to_json.py (ou sheets_api_to_json.py), réécrit sous une forme stable et lisible dans un diff git — onglets dans l'ordre du classeur,
// cellules triées par ligne puis colonne, une cellule par ligne de texte. Le contenu n'est pas modifié (ni corrigé, ni interprété).
//
//   node --no-warnings tools/sources/instantane.mjs <dump.json> <sortie.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Position d'une plage « A1:B2 » pour trier les fusions et les validations (openpyxl les rend dans un ordre qui change d'un export à l'autre).
const position = (plage) => {
  const m = /^([A-Z]+)(\d+)/.exec(String(plage));
  return m ? [Number(m[2]), [...m[1]].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0)] : [0, 0];
};
const avant = (a, b) => { const [pa, pb] = [position(a), position(b)]; return pa[0] - pb[0] || pa[1] - pb[1] || String(a).localeCompare(String(b)); };

/** Le texte de l'instantané d'un dump (même contenu, forme stable : fusions et validations triées par position). */
export function texteDInstantane(dump) {
  const ordre = ['r', 'c', 'v', 'f', 'note', 'threads'];
  const cellule = (x) => JSON.stringify(Object.fromEntries([...ordre.filter((k) => k in x), ...Object.keys(x).filter((k) => !ordre.includes(k)).sort()].map((k) => [k, x[k]])));
  const onglets = dump.sheets.map((s) => {
    const { cells, ...reste } = s;
    if (Array.isArray(reste.merged)) reste.merged = [...reste.merged].sort(avant);
    if (Array.isArray(reste.validations)) reste.validations = [...reste.validations].sort((a, b) => avant(a.range, b.range) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const tete = JSON.stringify(reste).slice(1, -1);
    const lignes = [...cells].sort((a, b) => a.r - b.r || a.c - b.c).map(cellule);
    return `  {${tete}, "cells": [\n${lignes.map((l) => `    ${l}`).join(',\n')}\n  ]}`;
  });
  const { sheets, ...autres } = dump;
  const tete = Object.keys(autres).length ? `${JSON.stringify(autres).slice(1, -1)}, ` : '';
  return `{${tete}"sheets": [\n${onglets.join(',\n')}\n]}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [entree, sortie] = process.argv.slice(2);
  if (!entree || !sortie) { console.error('usage : instantane.mjs <dump.json> <sortie.json>'); process.exit(2); }
  const dump = JSON.parse(readFileSync(resolve(entree), 'utf8'));
  const texte = texteDInstantane(dump);
  // Rien de perdu ni de changé : chaque onglet garde ses cellules (comparées entières, clés triées), ses fusions et ses validations.
  const trie = (x) => (Array.isArray(x) ? x.map(trie) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, trie(x[k])])) : x);
  const empreinte = (s) => JSON.stringify(trie({ ...s, cells: [...s.cells].sort((a, b) => a.r - b.r || a.c - b.c), merged: [...(s.merged ?? [])].sort(), validations: (s.validations ?? []).map((v) => JSON.stringify(trie(v))).sort() }));
  const relu = JSON.parse(texte);
  for (const [i, s] of dump.sheets.entries()) if (empreinte(s) !== empreinte(relu.sheets[i])) { console.error(`onglet ${s.name} : contenu changé par la mise en forme`); process.exit(1); }
  writeFileSync(resolve(sortie), texte);
  console.log(`${dump.sheets.length} onglet(s), ${dump.sheets.reduce((n, s) => n + s.cells.length, 0)} cellule(s) -> ${sortie}`);
}
