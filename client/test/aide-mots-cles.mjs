// Mots-clés d'essai posés sur des pages, pour les tests du vocabulaire (fusion, suppression, rejeu, rapatriement) : depuis la migration 0056 (les mots-clés
// deviennent un glossaire), le vocabulaire importé ne garde presque plus de mot-clé sur les pages, et le site de dev ne pose sur une page créée que les
// mots-clés dont il se sert. Ces tests ont donc leurs propres mots-clés, ajoutés à une copie de data/rows (lignes de mot_cle et de page_tag écrites comme
// l'exporteur, triées par clé), dont on construit les règles (db-build, db-derive) : la base vivante, les reconstructions et le rapatriement partent des
// mêmes lignes. Chaque mot-clé d'essai a une définition (valable que la colonne soit NOT NULL DEFAULT '' ou nullable, CHECK length > 0).
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/lib/text.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROWS = join(RACINE, 'data', 'rows');
export const DEFINITION_D_ESSAI = 'Mot-clé d’essai des tests (test/aide-mots-cles.mjs).';

/**
 * Les mots-clés d'essai (id → { libelle, pages }) : sur des pages du Codex (vraies pages, au site de dev comme dans data/rows) et sur des pages d'exemple
 * (absentes du site de dev construit sans exemples). C et D partagent une page ; « démo » n'est que sur des exemples ; « personnage », « magie » et « aide »
 * sur une vraie page et des exemples.
 */
export const MOTS_CLES_D_ESSAI = Object.fromEntries([
  ['Essai glossaire A', ['lore/400', 'lore/academie-de-larcane', 'lore/anna']],
  ['Essai glossaire C', ['lore/balogne']],
  ['Essai glossaire D', ['lore/balogne', 'lore/bardiche-du-bourreau-dechire']],
  ['Essai démo', ['bestiaire/exemple-creature', 'classes/exemple-classe']],
  ['Essai personnage', ['lore/aurora', 'races/exemple-race', 'classes/exemple-classe']],
  ['Essai magie', ['magies/exemple-magie', 'lore/aurora']],
  ['Essai aide', ['races/exemple-race', 'lore/anna']],
  ['Essai guide', ['lore/barrage-argente']],
].map(([libelle, pages]) => [normalize(libelle), { libelle, pages }]));

/**
 * Un mot-clé d'essai qui étiquette des sorts (sort_mot_cle, migration 0067 : décision R114), sans être un mot-clé dont le site se sert : il ne se supprime ni
 * ne se fusionne (serveur/edition-chronologie.mjs#verifierSansSort). Posé sur deux sorts, sur aucune page (les tests du vocabulaire choisissent leurs
 * mots-clés parmi ceux des pages).
 */
export const ETIQUETTE_D_ESSAI = Object.freeze({
  id: normalize('Essai étiquette de sort'), libelle: 'Essai étiquette de sort', pages: [],
  sorts: ['magies/magie-du-feu#sort:boule-de-feu', 'magies/magie-du-feu#sort:cauterisation'],
});
const TOUS_LES_MOTS_CLES_D_ESSAI = { ...MOTS_CLES_D_ESSAI, [ETIQUETTE_D_ESSAI.id]: { libelle: ETIQUETTE_D_ESSAI.libelle, pages: ETIQUETTE_D_ESSAI.pages } };

const sql = (v) => `'${String(v).replace(/'/g, "''")}'`;

/**
 * Ajoute les mots-clés d'essai aux fichiers mot_cle.sql et page_tag.sql de `rows` (une copie de data/rows), et les étiquettes de l'étiquette d'essai à
 * sort_mot_cle.sql, triés comme l'exporteur.
 */
export function ajouterLesMotsClesDEssai(rows) {
  const lire = (table) => readFileSync(join(rows, `${table}.sql`), 'utf8').split('\n');
  const ecrire = (table, lignes, cle) => {
    const [tete, ...corps] = lignes.filter(Boolean);
    corps.sort((a, b) => {
      const x = cle(a);
      const y = cle(b);
      for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
      return 0;
    });
    writeFileSync(join(rows, `${table}.sql`), `${[tete, ...corps].join('\n')}\n`);
  };
  const motsCles = lire('mot_cle');
  for (const [id, { libelle }] of Object.entries(TOUS_LES_MOTS_CLES_D_ESSAI)) {
    motsCles.push(`INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES (${sql(id)}, ${sql(libelle)}, ${sql(id)}, ${sql(DEFINITION_D_ESSAI)});`);
  }
  ecrire('mot_cle', motsCles, (l) => [/VALUES \('((?:[^']|'')*)'/.exec(l)[1]]);
  const tags = lire('page_tag');
  const ordres = new Map();
  for (const l of tags) {
    const m = /VALUES \('((?:[^']|'')*)', (\d+),/.exec(l);
    if (m) ordres.set(m[1], Math.max(ordres.get(m[1]) ?? -1, Number(m[2])));
  }
  for (const [id, { pages }] of Object.entries(TOUS_LES_MOTS_CLES_D_ESSAI)) {
    for (const page of pages) {
      const ordre = (ordres.get(page) ?? -1) + 1;
      ordres.set(page, ordre);
      tags.push(`INSERT INTO page_tag (page_id, ordre, tag_id) VALUES (${sql(page)}, ${ordre}, ${sql(id)});`);
    }
  }
  ecrire('page_tag', tags, (l) => {
    const m = /VALUES \('((?:[^']|'')*)', (\d+),/.exec(l);
    return [m[1], Number(m[2])];
  });
  const etiquettes = lire('sort_mot_cle');
  for (const sort of ETIQUETTE_D_ESSAI.sorts) etiquettes.push(`INSERT INTO sort_mot_cle (sort_id, mot_cle_id) VALUES (${sql(sort)}, ${sql(ETIQUETTE_D_ESSAI.id)});`);
  ecrire('sort_mot_cle', etiquettes, (l) => [...(/VALUES \('((?:[^']|'')*)', '((?:[^']|'')*)'\)/.exec(l) ?? []).slice(1, 3)]);
}

/**
 * Des règles (base construite, comme cheminBase de lib/donnees.mjs) tirées d'une copie de data/rows qui a les mots-clés d'essai : { rows, base }.
 * `sansExemples` : sans les pages d'exemple (le site de dev).
 */
export function reglesAvecDesMotsClesDEssai(dossier, { sansExemples = false } = {}) {
  mkdirSync(dossier, { recursive: true });
  const rows = join(dossier, 'rows');
  cpSync(ROWS, rows, { recursive: true });
  ajouterLesMotsClesDEssai(rows);
  const base = join(dossier, 'regles.db');
  for (const [script, args] of [['db-build.mjs', ['--out', base, '--rows', rows]], ['db-derive.mjs', [base, ...(sansExemples ? ['--sans-exemples'] : [])]]]) {
    const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', script), ...args], { encoding: 'utf8', cwd: RACINE });
    if (r.status !== 0) throw new Error(`${script} a échoué : ${r.stderr || r.stdout}`);
  }
  return { rows, base };
}
