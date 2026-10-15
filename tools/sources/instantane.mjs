// Instantané d'un classeur, tel qu'il est gardé dans sources/raw/classeurs/ (docs/sources.md, « Rapprochement d'un classeur ») : le dump uniforme de
// tools/sheets/xlsx_to_json.py (ou sheets_api_to_json.py), réécrit sous une forme stable et lisible dans un diff git — onglets dans l'ordre du classeur,
// cellules triées par ligne puis colonne, une cellule par ligne de texte. Le contenu n'est pas modifié (ni corrigé, ni interprété).
//
//   node --no-warnings tools/sources/instantane.mjs <dump.json> <sortie.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Le texte de l'instantané d'un dump (même contenu, forme stable). */
export function texteDInstantane(dump) {
  const ordre = ['r', 'c', 'v', 'f', 'note', 'threads'];
  const cellule = (x) => JSON.stringify(Object.fromEntries([...ordre.filter((k) => k in x), ...Object.keys(x).filter((k) => !ordre.includes(k)).sort()].map((k) => [k, x[k]])));
  const onglets = dump.sheets.map((s) => {
    const { cells, ...reste } = s;
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
  if (JSON.stringify(JSON.parse(texte)) !== JSON.stringify({ ...dump, sheets: dump.sheets.map((s) => ({ ...s, cells: [...s.cells].sort((a, b) => a.r - b.r || a.c - b.c) })) })) {
    // L'ordre des clés d'une cellule peut changer ; on compare cellule par cellule.
    const a = JSON.parse(texte);
    for (const [i, s] of dump.sheets.entries()) if (s.cells.length !== a.sheets[i].cells.length) { console.error(`onglet ${s.name} : cellules perdues`); process.exit(1); }
  }
  writeFileSync(resolve(sortie), texte);
  console.log(`${dump.sheets.length} onglet(s), ${dump.sheets.reduce((n, s) => n + s.cells.length, 0)} cellule(s) -> ${sortie}`);
}
