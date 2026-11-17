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

/** Le premier id entier des mots-clés d'essai (migration 0113 : un id entier ; loin après ceux de data/rows, que le site de dev ne rejoint pas). */
export const PREMIER_ID_D_ESSAI = 9001;

/**
 * Les mots-clés d'essai (clé → { id, cle, libelle, pages } ; `id` : l'entier, à partir de PREMIER_ID_D_ESSAI ; `cle` : normalize du libellé, sans
 * homonyme) : sur des pages du Codex (vraies pages, au site de dev comme dans data/rows) et sur des pages d'exemple (absentes du site de dev construit
 * sans exemples). C et D partagent une page ; « démo » n'est que sur des exemples ; « personnage », « magie » et « aide » sur une vraie page et des
 * exemples.
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
].map(([libelle, pages], i) => [normalize(libelle), { id: PREMIER_ID_D_ESSAI + i, cle: normalize(libelle), libelle, pages }]));

/**
 * Un mot-clé d'essai qui étiquette des sorts (sort_mot_cle, migration 0067 : décision R114), sans être un mot-clé dont le site se sert : il ne se supprime ni
 * ne se fusionne (serveur/edition-chronologie.mjs#verifierSansSort). Posé sur deux sorts, sur aucune page (les tests du vocabulaire choisissent leurs
 * mots-clés parmi ceux des pages).
 */
export const ETIQUETTE_D_ESSAI = Object.freeze({
  id: PREMIER_ID_D_ESSAI + Object.keys(MOTS_CLES_D_ESSAI).length, cle: normalize('Essai étiquette de sort'), libelle: 'Essai étiquette de sort', pages: [],
  sorts: ['magies/magie-du-feu#sort:boule-de-feu', 'magies/magie-du-feu#sort:cauterisation'],
});
const TOUS_LES_MOTS_CLES_D_ESSAI = { ...MOTS_CLES_D_ESSAI, [ETIQUETTE_D_ESSAI.cle]: ETIQUETTE_D_ESSAI };

/** L'id entier du mot-clé d'essai de clé `cle` (MOTS_CLES_D_ESSAI, ETIQUETTE_D_ESSAI). */
export const idDEssai = (cle) => TOUS_LES_MOTS_CLES_D_ESSAI[cle]?.id;

const sql = (v) => `'${String(v).replace(/'/g, "''")}'`;

/**
 * Ajoute les mots-clés d'essai aux fichiers mot_cle.sql et page_tag.sql de `rows` (une copie de data/rows), et les étiquettes de l'étiquette d'essai à
 * sort_mot_cle.sql, triés comme l'exporteur.
 */
export function ajouterLesMotsClesDEssai(rows) {
  // une instruction par élément : une valeur peut tenir sur plusieurs lignes (une définition écrite sur le site de dev avec un retour à la ligne,
  // que l'export garde telle quelle) ; une ligne continue l'instruction tant que ses apostrophes ne sont pas appariées
  const lire = (table) => {
    const instructions = [];
    let enCours = null;
    for (const ligne of readFileSync(join(rows, `${table}.sql`), 'utf8').split('\n')) {
      enCours = enCours === null ? ligne : `${enCours}\n${ligne}`;
      if ((enCours.match(/'/g) ?? []).length % 2 === 0) {
        instructions.push(enCours);
        enCours = null;
      }
    }
    if (enCours !== null) instructions.push(enCours);
    return instructions;
  };
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
  for (const { id, cle, libelle } of Object.values(TOUS_LES_MOTS_CLES_D_ESSAI)) {
    motsCles.push(`INSERT INTO mot_cle (id, libelle, cle, description) VALUES (${id}, ${sql(libelle)}, ${sql(cle)}, ${sql(DEFINITION_D_ESSAI)});`);
  }
  ecrire('mot_cle', motsCles, (l) => [Number(/VALUES \((\d+),/.exec(l)[1])]);
  const tags = lire('page_tag');
  const ordres = new Map();
  for (const l of tags) {
    const m = /VALUES \('((?:[^']|'')*)', (\d+),/.exec(l);
    if (m) ordres.set(m[1], Math.max(ordres.get(m[1]) ?? -1, Number(m[2])));
  }
  for (const { id, pages } of Object.values(TOUS_LES_MOTS_CLES_D_ESSAI)) {
    for (const page of pages) {
      const ordre = (ordres.get(page) ?? -1) + 1;
      ordres.set(page, ordre);
      tags.push(`INSERT INTO page_tag (page_id, ordre, tag_id) VALUES (${sql(page)}, ${ordre}, ${id});`);
    }
  }
  ecrire('page_tag', tags, (l) => {
    const m = /VALUES \('((?:[^']|'')*)', (\d+),/.exec(l);
    return [m[1], Number(m[2])];
  });
  const etiquettes = lire('sort_mot_cle');
  for (const sort of ETIQUETTE_D_ESSAI.sorts) etiquettes.push(`INSERT INTO sort_mot_cle (sort_id, mot_cle_id) VALUES (${sql(sort)}, ${ETIQUETTE_D_ESSAI.id});`);
  ecrire('sort_mot_cle', etiquettes, (l) => {
    const m = /VALUES \('((?:[^']|'')*)', (\d+)\)/.exec(l);
    return m ? [m[1], Number(m[2])] : [];
  });
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

/** Le registre figé de la migration 0113 (ancien id texte → id entier, lib/mots-cles-cles.mjs#REGISTRE_DES_IDS_DE_MOTS_CLES), lu une fois. */
let registre0113 = null;
/**
 * L'id entier, figé, du mot-clé dont l'ancien id texte était `ancienId` (« solidite », « recharge-longue » : registre de la migration 0113) ; undefined
 * pour un id que le registre n'a pas. Un test cherche un mot-clé par cet id (figé), jamais par son libellé ni par sa clé, que le site de dev change
 * (décision R232 (2) ; skill tests-conventions).
 */
export function idDuMotCleNomme(ancienId) {
  registre0113 ??= new Map(JSON.parse(readFileSync(join(RACINE, 'data', 'migrations', '0113-mots-cles-id-entier.json'), 'utf8')).motsCles.map((m) => [m.ancienId, m.id]));
  return registre0113.get(ancienId);
}

/**
 * `texte`, écrit avant la migration 0113 (ses balises citent l'ancien id texte d'un mot-clé), tel que la base `db` l'écrit : chaque ref qui est un
 * ancien id du registre de la 0113 devient la clé courante de son mot-clé dans `db` (les migrations 0113 à 0115 ont réécrit ces balises : R232 (3),
 * R233 (5)) ; celle d'un mot-clé fondu depuis, la clé du mot-clé qui l'a reçu (`mot_cle_ancienne_cle`). Le texte affiché ne change pas ; une ref que
 * le registre ignore reste telle quelle. Pont entre l'état d'une migration d'avant la 0113 (registres, fragments) et la base d'aujourd'hui.
 */
export function avecLesClesDe(db, texte) {
  return texte.replace(/\{\{([^{}|\\\n]+?)(\}\}|:\}\}|\\?\|)/g, (tout, ref, fin) => {
    const id = idDuMotCleNomme(ref.trim());
    if (id === undefined) return tout;
    const cle = db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(id)?.cle
      ?? db.prepare('SELECT m.cle FROM mot_cle_ancienne_cle a JOIN mot_cle m ON m.id = a.mot_cle_id WHERE a.cle = ?').get(ref.trim())?.cle;
    return cle ? `{{${cle}${fin}` : tout;
  });
}
