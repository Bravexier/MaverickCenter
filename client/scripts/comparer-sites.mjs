// `npm run comparer-sites -- <dossier-a> <dossier-b> [--json <fichier>] [--exemples <n>]` (dans client/) : compare deux sites fabriqués fichier par fichier
// (empreinte sha256) — lot 9 du chantier de la base de dev ; la logique est dans serveur/comparaison-de-sites.mjs, docs/serveur.md « Fabriquer le site depuis
// un fichier de contenu ». Affiche un bilan court ; --json écrit le rapport complet (plafonné par catégorie). Code de sortie : 0 si les sites sont
// équivalents (aucun fichier différent ni absent d'un côté ; les variations de fabrication ne comptent pas), 1 sinon, 2 si l'usage est mauvais ou un dossier manque.
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { comparerSites } from '../serveur/comparaison-de-sites.mjs';

const args = process.argv.slice(2);
const avecValeur = new Set(['--json', '--exemples']);
const positionnels = [];
for (let i = 0; i < args.length; i += 1) {
  if (avecValeur.has(args[i])) i += 1;
  else if (args[i].startsWith('--')) { console.error(`Option inconnue : ${args[i]}`); process.exit(2); }
  else positionnels.push(args[i]);
}
const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
if (positionnels.length !== 2) {
  console.error('Usage : npm run comparer-sites -- <dossier-a> <dossier-b> [--json <fichier>] [--exemples <n>]');
  process.exit(2);
}
const [a, b] = positionnels.map((p) => resolve(p));
for (const dossier of [a, b]) {
  if (!existsSync(dossier) || !statSync(dossier).isDirectory()) { console.error(`${dossier} : dossier introuvable`); process.exit(2); }
}
const exemples = option('--exemples') === undefined ? undefined : Number(option('--exemples'));
if (exemples !== undefined && !(Number.isInteger(exemples) && exemples >= 0)) { console.error('--exemples : un entier positif ou nul'); process.exit(2); }

const rapport = comparerSites(a, b, { exemples });
if (option('--json')) {
  const cible = resolve(option('--json'));
  mkdirSync(dirname(cible), { recursive: true });
  const provisoire = `${cible}.${process.pid}.tmp`;
  writeFileSync(provisoire, `${JSON.stringify(rapport, null, 2)}\n`);
  renameSync(provisoire, cible);
}
const { identiques, differents, seulement_a: seulA, seulement_b: seulB, variables } = rapport;
console.log(`A : ${rapport.a.fichiers} fichiers, B : ${rapport.b.fichiers} fichiers`);
console.log(`identiques ${identiques} · différents ${differents.nombre} · seulement dans A ${seulA.nombre} · seulement dans B ${seulB.nombre} · variations de fabrication ${variables.nombre}`);
for (const [titre, categorie] of [['différents', differents], ['seulement dans A', seulA], ['seulement dans B', seulB], ['variations de fabrication', variables]]) {
  if (!categorie.nombre) continue;
  console.log(`${titre} (${categorie.exemples.length} sur ${categorie.nombre}) :`);
  for (const e of categorie.exemples.slice(0, 5)) console.log(`  ${e.fichier}${e.cause ? `  [${e.cause}]` : ''}`);
}
process.exit(rapport.equivalents ? 0 : 1);
