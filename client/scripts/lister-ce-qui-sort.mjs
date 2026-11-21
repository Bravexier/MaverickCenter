#!/usr/bin/env node
/**
 * Lot 12 : la liste de ce qui sort du dépôt (R296), une ligne par fichier : `<catégorie><TAB><chemin><TAB><octets>`. Lecture seule, rien n'est écrit.
 * Les catégories et les règles sont celles de l'inventaire (`inventaire-sortie-du-contenu-lib.mjs#listerCeQuiSort`) : rows, migrations_donnees, sources_raw,
 * et migrations_mixtes seulement avec `--avec-mixtes` (DDL et données mêlés : question ouverte au propriétaire, jamais retirées sans cette option).
 *
 *   node scripts/lister-ce-qui-sort.mjs [--racine <dossier>] [--ref <commit>] [--avec-mixtes]
 *
 * - `--ref` : lit le commit (jamais l'arbre de travail) ; sans lui, les fichiers suivis de l'arbre de `--racine` (défaut : ce dépôt).
 * Lu par `deploy/archivage-du-contenu/archiver.sh`, qui ne sait pas classer une migration.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerCeQuiSort } from './inventaire-sortie-du-contenu-lib.mjs';

const argv = process.argv.slice(2);
const o = { racine: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), ref: null, avecMixtes: false };
try {
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === '--avec-mixtes') o.avecMixtes = true;
    else if (a === '--racine' || a === '--ref') {
      const v = argv[++k];
      if (!v || v.startsWith('--')) throw new Error(`${a} attend une valeur`);
      if (a === '--racine') o.racine = resolve(v);
      else o.ref = v;
    } else throw new Error(`option inconnue : ${a}`);
  }
  const liste = listerCeQuiSort({ racine: o.racine, ref: o.ref });
  const ids = ['rows', 'migrations_donnees', ...(o.avecMixtes ? ['migrations_mixtes'] : []), 'sources_raw'];
  for (const id of ids) for (const f of liste[id]) console.log(`${id}\t${f.chemin}\t${f.octets}`);
} catch (e) {
  console.error(`lister-ce-qui-sort : ${e.message}`);
  process.exit(2);
}
