#!/usr/bin/env node
// Essai mécanique des tests (lot 10 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md ; résultat : docs/essai-mecanique-des-tests.md).
// Question : que lisent les tests dans le contenu du dépôt ? On change en un seul endroit la source qu'ils lisent (MAVERICK_CONTENU, lib/contenu-fourni.mjs) et on mesure ce qui casse.
// Aucun test, aucun module du site ni aucune donnée n'est modifié : le script fabrique des fichiers de contenu, lance chaque fichier de test à part sur chacun, et trie.
//   A   le vrai contenu (extrait de la base construite depuis data/rows) : tout doit passer, cela vérifie le branchement ;
//   B   un contenu différent, obtenu mécaniquement : le vrai dont les noms et les textes libres sont remplacés par des valeurs factices (identifiants, clés de jointure,
//       formules, valeurs brutes, liens entre lignes et structure inchangés ; les clés `*_cle` sont recalculées avec normalize()) ;
//   C   le vrai contenu du SITE DE DEV (l'extrait téléchargé, `npm run db:extrait`), SANS le dépôt : dans une copie jetable de l'arbre (git worktree détaché
//       sous <sortie>/copies/C, modifications en cours recopiées, node_modules par lien) dont data/rows/*.sql est retiré, content/wiki fabriqué depuis
//       l'extrait. Un échec : un test qui lit encore le contenu du dépôt, ou qui casse sur le vrai contenu du site ;
//   V1…V4  des variantes de l'extrait, chacune une modification que le propriétaire peut faire sur le site de dev (scripts/essai-variantes.mjs : V1 icônes
//       sur des mots-clés de genres variés, V2 un sort renommé par le service, V3 des lignes ajoutées, V4 des lignes retirées), chacune dans sa copie jetable comme C.
//       Un fichier qui passe C et casse sur Vn fige une valeur modifiable.
//   V5  une magie renommée (écriture directe, avec sa trace) : HORS des voies du site aujourd'hui (magie.nom n'est pas modifiable :
//       test/serveur-edition-nom-de-magie.test.mjs) ; passe informative (PASSES_INFORMATIVES), rangée à part, elle ne bloque rien.
//   D   ce que lance la CI (job client de ci.yml : `npm test` sous MAVERICK_CONTENU = l'extrait, data/rows PRÉSENT dans l'arbre) pour les seuls fichiers de
//       LIT_LE_DEPOT_PAR_NATURE : leur échec sur C (data/rows absent) est attendu, le leur sur D ne l'est jamais — c'est le vrai « rouge » de la CI (le run
//       44320300043 de dev l'a montré : six fichiers rouges que C rangeait à part sans les voir). Un échec de D rend l'essai rouge (`passes.D.rouges`).
//   S   le dépôt SANS ce qui en sortira au lot 12 (R296 ; passe de fin de lot) : l'extrait pour contenu, dans une copie jetable d'où sont retirés data/rows, les
//       migrations de données (et leurs registres .json) et sources/raw (les catégories de scripts/inventaire-sortie-du-contenu-lib.mjs ; --avec-mixtes retire aussi
//       les migrations qui mêlent DDL et données). Tous les fichiers de test, sans rubrique « par nature » : tout échec est ROUGE. C'est le critère de fin du lot 12 :
//       il s'exécute quand S est verte (docs/chantier-base-de-dev.md, « Le jour J du lot 12 »). S est ALLUMÉE (environnementDeLaPasse) : la suite et les contrôles
//       tournent sous MAVERICK_CONTENU_SORTI=1 (src/lib/sortie-du-contenu.mjs : les tests qui sortent avec le contenu ne sont plus déclarés) et sous
//       MAVERICK_SOURCES_RAW = un dossier hors de la copie, rempli par `git archive HEAD sources/raw` (l'archive restaurée du jour J ; tools/sources/dossier-des-exports.mjs),
//       retiré à la fin de la passe ; de même MAVERICK_MIGRATIONS_ARCHIVEES (`git archive HEAD data/migrations`, lue par tools/sources/rapprocher.mjs). Avec --controles : les contrôles de la CI, sans db:build (il lit
//       data/rows) et avec db:check sur le contenu fourni, eux aussi rouges au moindre échec.
//   Le tri de C range à part les fichiers qui lisent le dépôt par nature (LIT_LE_DEPOT_PAR_NATURE : l'ancien circuit, les tables des fiches vides dans
//   data/rows, les outils Python), attendus jusqu'au lot 12 ; le reste des échecs de C est inattendu.
// Rien n'est jamais commité depuis une copie jetable ; toute la sortie reste sous var/ (ignoré par git).
//
// Usage, depuis client/ :
//   node scripts/essai-mecanique-tests.mjs                          tout : fabrique les contenus, lance toutes les passes (C et V seulement si l'extrait existe), trie
//   node scripts/essai-mecanique-tests.mjs --fabriquer              seulement les contenus : A et B, et les variantes V1 à V5 si l'extrait existe
//   node scripts/essai-mecanique-tests.mjs --passe A|B|C|D|S|V1|V2|V3|V4|V5 [--fichiers a.test.mjs,b.test.mjs]   (D : par défaut les fichiers de LIT_LE_DEPOT_PAR_NATURE)
//   node scripts/essai-mecanique-tests.mjs --passe S [--avec-mixtes] [--controles]   (S n'est jamais dans « tout » : elle se lance à part, après l'extrait ; la suite, puis les contrôles)
//   node scripts/essai-mecanique-tests.mjs --passe C|S|V1…V5 --controles  les contrôles du job preparer (scripts/mise-a-jour-github.mjs#CONTROLES, donc le
//       job client de ci.yml) dans la copie jetable de la passe, sous MAVERICK_CONTENU = son contenu : build, chaque test du site construit à part (un
//       test sauté ou vide est rouge), build de test et bandeau, installateur, build de production et ses deux tests, artefact ; `npm test` reste à la
//       passe elle-même ; db:build et db:check (CONTROLES_PAR_NATURE) sont notés à part et ne rendent pas la passe rouge
//   node scripts/essai-mecanique-tests.mjs --trier [--ecrire-docs]   refait le tri depuis les journaux déjà écrits (--ecrire-docs : docs/essai-mecanique-des-tests.json, passes A et B)
//   node scripts/essai-mecanique-tests.mjs --nettoyer               retire les copies jetables (git worktree remove)
// Options : --extrait <fichier> (défaut var/extrait/maverick-dev.db : `npm run db:extrait`), --parallele N (défaut : nombre de cœurs), --delai SECONDES
// (défaut 600, par fichier), --sortie <dossier> (défaut var/essai-mecanique).
// Sorties : <sortie>/journaux/<passe>/<fichier>.log (complets, à chercher par Grep), <sortie>/passe-<passe>.json, <sortie>/controles-<passe>.json,
// <sortie>/variantes.json (ce que chaque variante a changé), <sortie>/tri.json et <sortie>/tri.md (le tri par passe).
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { VARIABLE_CONTENU_SORTI } from '../src/lib/sortie-du-contenu.mjs';
import { cheminsQuiSortent, listerCeQuiSort } from './inventaire-sortie-du-contenu-lib.mjs';

const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const racine = resolve(client, '..');
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : defaut;
};
const drapeau = (nom) => process.argv.includes(nom);
const sortie = resolve(arg('--sortie', join(client, '..', 'var', 'essai-mecanique')));
const PARALLELE = Number(arg('--parallele', Math.max(1, cpus().length)));
const DELAI = Number(arg('--delai', 600)) * 1000;
const EXTRAIT = resolve(arg('--extrait', join(racine, 'var', 'extrait', 'maverick-dev.db')));
export const PASSES_DU_SITE = ['C', 'V1', 'V2', 'V3', 'V4', 'V5'];
/** Les variantes hors des voies du site : leurs échecs sont rangés à part (« informative »), jamais comptés comme une valeur figée. */
export const PASSES_INFORMATIVES = Object.freeze(['V5']);
/** La passe « sans le contenu » du lot 12 : l'extrait pour contenu, dans une copie d'où sortent les lignes, les migrations de données et les exports des sources. */
export const PASSE_SANS_LE_CONTENU = 'S';
/** La passe de la CI : l'extrait du site de dev ET data/rows dans l'arbre (ce que voit `npm test` du job client de ci.yml), pour les fichiers classés « par nature ». */
export const PASSE_DE_LA_CI = 'D';
const FICHIER = {
  A: join(sortie, 'contenu-vrai.db'),
  B: join(sortie, 'contenu-factice.db'),
  C: EXTRAIT,
  [PASSE_DE_LA_CI]: EXTRAIT,
  [PASSE_SANS_LE_CONTENU]: EXTRAIT,
  ...Object.fromEntries(PASSES_DU_SITE.slice(1).map((v) => [v, join(sortie, `variante-${v}.db`)])),
};
const dansUneCopie = (passe) => PASSES_DU_SITE.includes(passe) || passe === PASSE_DE_LA_CI || passe === PASSE_SANS_LE_CONTENU;
const passeConnue = (passe) => Object.hasOwn(FICHIER, passe);

// ───────────────────────── fabrication des contenus A et B ─────────────────────────
// Colonnes remplacées : les noms (libellés d'une ligne) et les textes libres. Tout le reste (identifiants, *_brut, formules, types, JSON `donnees`, adresses) reste tel quel.
const COLONNES_NOM = new Set(['nom', 'titre', 'libelle', 'intitule']);
const COLONNES_TEXTE = new Set([
  'description', 'texte', 'corps_md', 'resume', 'effet', 'presentation', 'divers', 'note', 'descriptif', 'histoire', 'avantages', 'inconvenients',
  'description_generale', 'explication', 'chose_a_savoir', 'remarque', 'texte_general', 'effet_passif', 'effet_actif', 'precisions', 'complement', 'definition',
  'description_physique', 'bandeau', 'banniere', 'ouverture',
]);
// Tables laissées telles quelles : leur « texte » est une clé (alias) ou une donnée technique.
const TABLES_GARDEES = new Set(['alias', 'source', 'mot_cle_synonyme', 'modification', 'modification_lot', 'historique_modification', 'migration_recue']);

const numero = (ligne, cle) => cle.map((_, i) => ligne[`k${i}`]).join('-');

export async function fabriquerLesContenus() {
  mkdirSync(sortie, { recursive: true });
  const { cheminBase } = await import('../src/lib/donnees.mjs');
  const { fabriquerExtrait } = await import('../serveur/extrait.mjs');
  const { normalize } = await import('../src/lib/text.mjs');
  fabriquerExtrait({ source: cheminBase({ sansExemples: false }), destination: FICHIER.A, version: '0.0.0-essai' });
  // La vue `extrait_meta` (8 fichiers cassaient sur elle au premier essai) est retirée de la copie de travail par le branchement lui-même
  // (lib/contenu-fourni.mjs#preparerLaCopie) : les contenus la gardent, comme un vrai extrait.
  copyFileSync(FICHIER.A, FICHIER.B);
  const db = new DatabaseSync(FICHIER.B);
  const rapport = { tables: 0, colonnes: 0, lignes: 0, refusees: [] };
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%'").all().map((t) => t.name)
      .filter((t) => !TABLES_GARDEES.has(t) && !/_(fts|config|data|idx|docsize|content)$/.test(t) && !/_fts_/.test(t));
    for (const table of tables) {
      const colonnes = db.prepare(`PRAGMA table_info("${table}")`).all();
      const noms = colonnes.filter((c) => /TEXT/i.test(c.type) && COLONNES_NOM.has(c.name)).map((c) => c.name);
      const textes = colonnes.filter((c) => /TEXT/i.test(c.type) && COLONNES_TEXTE.has(c.name)).map((c) => c.name);
      if (!noms.length && !textes.length) continue;
      const nomDeCle = (n) => colonnes.find((c) => c.name === (n === 'nom' ? 'nom_cle' : n === 'titre' ? 'titre_cle' : n === 'libelle' ? 'libelle_cle' : ''))?.name;
      // tables WITHOUT ROWID : la ligne se désigne par sa clé primaire
      let cle = ['rowid'];
      try {
        db.prepare(`SELECT rowid FROM "${table}" LIMIT 0`).all();
      } catch {
        cle = colonnes.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
      }
      const ou = cle.map((c) => `"${c}" = ?`).join(' AND ').replace('"rowid"', 'rowid');
      const lignes = db.prepare(`SELECT ${cle.map((c, i) => `${c === 'rowid' ? 'rowid' : `"${c}"`} AS k${i}`).join(', ')}, ${[...noms, ...textes].map((c) => `"${c}"`).join(', ')} FROM "${table}"`).all();
      db.exec('BEGIN');
      try {
        for (const ligne of lignes) {
          const sets = [];
          const valeurs = [];
          for (const c of noms) {
            if (ligne[c] === null || ligne[c] === '') continue;
            const v = `Nom factice ${table} ${numero(ligne, cle)}`;
            sets.push(`"${c}" = ?`);
            valeurs.push(v);
            const colCle = nomDeCle(c);
            if (colCle) {
              sets.push(`"${colCle}" = ?`);
              valeurs.push(normalize(v));
            }
          }
          for (const c of textes) {
            if (ligne[c] === null || ligne[c] === '') continue;
            sets.push(`"${c}" = ?`);
            valeurs.push(`Texte factice ${table}.${c} ${numero(ligne, cle)}.`);
          }
          if (!sets.length) continue;
          db.prepare(`UPDATE "${table}" SET ${sets.join(', ')} WHERE ${ou}`).run(...valeurs, ...cle.map((_, i) => ligne[`k${i}`]));
          rapport.lignes += 1;
        }
        db.exec('COMMIT');
        rapport.tables += 1;
        rapport.colonnes += noms.length + textes.length;
      } catch (e) {
        db.exec('ROLLBACK');
        rapport.refusees.push(`${table} : ${String(e.message).split('\n')[0]}`);
      }
    }
  } finally {
    db.close();
  }
  writeFileSync(join(sortie, 'fabrication.json'), JSON.stringify(rapport, null, 2));
  return rapport;
}

// ───────────────────────── variantes de l'extrait du site de dev (V1 à V5) ─────────────────────────
function exigerLExtrait() {
  if (!existsSync(EXTRAIT)) throw new Error(`extrait du site de dev introuvable : ${EXTRAIT} (npm run db:extrait, ou --extrait <fichier>)`);
}

/** Fabrique <sortie>/variante-Vn.db depuis l'extrait (jamais modifié) et note ce que chacune a changé dans <sortie>/variantes.json. */
export async function fabriquerLesVariantes() {
  exigerLExtrait();
  mkdirSync(sortie, { recursive: true });
  const { VARIANTES } = await import('./essai-variantes.mjs');
  const rapports = {};
  for (const [nom, variante] of Object.entries(VARIANTES)) {
    copyFileSync(EXTRAIT, FICHIER[nom]);
    const db = new DatabaseSync(FICHIER[nom]);
    try {
      rapports[nom] = variante(db);
      const violations = db.prepare('PRAGMA foreign_key_check').all().length;
      if (violations) throw new Error(`variante ${nom} : ${violations} clé(s) étrangère(s) rompue(s)`);
    } finally {
      db.close();
    }
  }
  writeFileSync(join(sortie, 'variantes.json'), JSON.stringify(rapports, null, 1));
  return Object.fromEntries(Object.entries(rapports).map(([n, r]) => [n, { faites: r.faites.length, refusees: r.refusees.length }]));
}

// ───────────────────────── copies jetables de l'arbre (passes C et V) ─────────────────────────
const git = (args, cwd = racine) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} : ${r.stderr.trim()}`);
  return r.stdout;
};
const copieDe = (passe) => join(sortie, 'copies', passe);

/** Le dossier (hors de toute copie) qui reçoit l'archive des exports en passe S. */
const DOSSIER_DES_EXPORTS_DE_S = () => join(sortie, `exports-${PASSE_SANS_LE_CONTENU}`);

/**
 * Simule l'archive restaurée du jour J : extrait `sources/raw` de `ref` (git archive) sous `destination` (vidé d'abord) et rend le dossier des exports
 * (`<destination>/sources/raw`), à poser dans MAVERICK_SOURCES_RAW. Ne touche jamais l'arbre de travail de `racine`.
 */
export function archiverLesExports({ racine: depot, destination, ref = 'HEAD' }) {
  return archiverUnDossier({ racine: depot, destination, ref, chemin: 'sources/raw' });
}

/** Le dossier (hors de toute copie) qui reçoit l'archive des migrations en passe S. */
const DOSSIER_DES_MIGRATIONS_DE_S = () => join(sortie, `migrations-${PASSE_SANS_LE_CONTENU}`);

/**
 * Simule l'archive restaurée des migrations de données (jour J) : extrait de `ref` (git archive) les SEULES migrations qui sortent (`listerCeQuiSort`, catégorie des
 * migrations de données ; avec `avecMixtes`, les mixtes aussi, comme la copie de S) sous `destination` (vidé d'abord) et rend le dossier
 * (`<destination>/data/migrations`), à poser dans MAVERICK_MIGRATIONS_ARCHIVEES. Le rapprochement le lit AVEC data/migrations de la copie (ce qui y reste) :
 * c'est l'état du jour J. Ne touche jamais l'arbre de travail de `racine`.
 */
export function archiverLesMigrations({ racine: depot, destination, ref = 'HEAD', avecMixtes = false }) {
  const liste = listerCeQuiSort({ racine: depot, ref });
  const chemins = [...liste.migrations_donnees, ...(avecMixtes ? liste.migrations_mixtes : [])].map((f) => f.chemin).sort();
  return archiverUnDossier({ racine: depot, destination, ref, chemin: 'data/migrations', chemins });
}

function archiverUnDossier({ racine: depot, destination, ref, chemin, chemins = [chemin] }) {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  const archive = spawnSync('git', ['archive', '--format=tar', ref, ...chemins], { cwd: depot, maxBuffer: 1024 * 1024 * 1024 });
  if (archive.status !== 0) throw new Error(`git archive ${ref} ${chemin} (${chemins.length} chemin(s)) : ${String(archive.stderr).trim()}`);
  const extrait = spawnSync('tar', ['-x', '-C', destination], { input: archive.stdout });
  if (extrait.status !== 0) throw new Error(`tar -x : ${String(extrait.stderr).trim()}`);
  return join(destination, ...chemin.split('/'));
}

let exportsDeS = null;
/** Les exports de la passe S, archivés une fois par processus (null pour les autres passes). */
function exportsDeLaPasse(passe) {
  if (passe !== PASSE_SANS_LE_CONTENU) return null;
  if (!exportsDeS) {
    exportsDeS = archiverLesExports({ racine, destination: DOSSIER_DES_EXPORTS_DE_S() });
    process.once('exit', retirerLesExportsArchives); // nettoyé à la fin du processus, réussie ou non
  }
  return exportsDeS;
}

let migrationsDeS = null;
/** Les migrations de la passe S, archivées une fois par processus (null pour les autres passes). */
function migrationsDeLaPasse(passe) {
  if (passe !== PASSE_SANS_LE_CONTENU) return null;
  if (!migrationsDeS) {
    migrationsDeS = archiverLesMigrations({ racine, destination: DOSSIER_DES_MIGRATIONS_DE_S(), avecMixtes: drapeau('--avec-mixtes') });
    process.once('exit', retirerLesMigrationsArchivees);
  }
  return migrationsDeS;
}

/** Retire le dossier des migrations archivées de la passe S. */
export function retirerLesMigrationsArchivees() {
  rmSync(DOSSIER_DES_MIGRATIONS_DE_S(), { recursive: true, force: true });
  migrationsDeS = null;
}

/** Retire le dossier des exports archivés de la passe S (la simulation de l'archive restaurée n'a pas à rester). */
export function retirerLesExportsArchives() {
  rmSync(DOSSIER_DES_EXPORTS_DE_S(), { recursive: true, force: true });
  exportsDeS = null;
}

/**
 * L'environnement d'une passe : le contenu (MAVERICK_CONTENU) ; en S seulement, ALLUMÉE : MAVERICK_CONTENU_SORTI=1 et, avec `exports`, MAVERICK_SOURCES_RAW = ce dossier, avec `migrations`, MAVERICK_MIGRATIONS_ARCHIVEES = ce dossier.
 * Les autres passes retirent les deux variables de l'environnement reçu (aucune ne doit voir ce qui ne vaut qu'une fois le contenu sorti).
 */
export function environnementDeLaPasse(passe, { exports = null, migrations = null, base = process.env } = {}) {
  const env = { ...base, MAVERICK_CONTENU: FICHIER[passe] };
  delete env.NODE_TEST_CONTEXT;
  delete env[VARIABLE_CONTENU_SORTI];
  delete env.MAVERICK_SOURCES_RAW;
  delete env.MAVERICK_MIGRATIONS_ARCHIVEES;
  if (passe === PASSE_SANS_LE_CONTENU) {
    env[VARIABLE_CONTENU_SORTI] = '1';
    if (exports) env.MAVERICK_SOURCES_RAW = exports;
    if (migrations) env.MAVERICK_MIGRATIONS_ARCHIVEES = migrations;
  }
  return env;
}
const horsDesLignes = (f) => !f.startsWith('data/rows/');

/**
 * Retire d'une copie de l'arbre ce qui sortira du dépôt au lot 12 : les fichiers des catégories de l'inventaire (`listerCeQuiSort` de `racine`, l'arbre d'origine :
 * data/rows, migrations de données et leurs registres, sources/raw ; les migrations mixtes seulement avec `avecMixtes`), puis les dossiers que cela vide.
 * Ne touche jamais `racine`. Rend { retires, absents, octets } (`absents` : listés par l'inventaire mais pas dans la copie).
 */
export function retirerLeContenuDeLaCopie({ racine, copie, avecMixtes = false }) {
  if (resolve(racine) === resolve(copie)) throw new Error('retirerLeContenuDeLaCopie : la copie est l\'arbre d\'origine, on ne retire rien dedans');
  const liste = listerCeQuiSort({ racine });
  const octets = new Map([...Object.values(liste).flat()].map((f) => [f.chemin, f.octets]));
  const bilan = { retires: 0, absents: 0, octets: 0 };
  const dossiers = new Set();
  for (const chemin of cheminsQuiSortent(liste, { avecMixtes })) {
    const cible = join(copie, chemin);
    if (!existsSync(cible)) { bilan.absents += 1; continue; }
    rmSync(cible, { force: true });
    bilan.retires += 1;
    bilan.octets += octets.get(chemin) ?? 0;
    for (let d = dirname(chemin); d && d !== '.'; d = dirname(d)) dossiers.add(d);
  }
  // les dossiers vidés par le retrait, du plus profond au plus haut (data/rows, sources/raw et ses sous-dossiers ; data/migrations reste : la structure y est)
  for (const d of [...dossiers].sort((a, b) => b.length - a.length)) {
    const dossier = join(copie, d);
    try { if (existsSync(dossier) && readdirSync(dossier).length === 0) rmSync(dossier, { recursive: true }); } catch { /* non vide : il reste */ }
  }
  return bilan;
}

/**
 * La copie jetable de la passe : un git worktree détaché sur HEAD (refait s'il manque), où sont recopiées les modifications en cours de l'arbre (fichiers suivis
 * modifiés ou retirés, fichiers nouveaux non ignorés), data/rows/*.sql retiré, client/node_modules par lien, content/wiki fabriqué depuis le contenu de la passe.
 * Rien n'y est jamais commité. Rend le dossier client/ de la copie.
 */
export function preparerLaCopieJetable(passe, { avecMixtes = drapeau('--avec-mixtes') } = {}) {
  const copie = copieDe(passe);
  if (!existsSync(join(copie, '.git'))) {
    rmSync(copie, { recursive: true, force: true });
    mkdirSync(dirname(copie), { recursive: true });
    git(['worktree', 'add', '--detach', '--quiet', copie, 'HEAD']);
  } else {
    // garde-fou : on ne nettoie que la copie elle-même (son propre arbre de travail), jamais le dépôt
    if (realpathSync(git(['rev-parse', '--show-toplevel'], copie).trim()) !== realpathSync(copie)) throw new Error(`${copie} n'est pas une copie jetable (git worktree)`);
    git(['checkout', '--quiet', '--detach', '--force', git(['rev-parse', 'HEAD']).trim()], copie);
    git(['clean', '-fdq', '-e', 'node_modules'], copie);
  }
  const listes = (args) => git(args).split('\0').filter(Boolean).filter(horsDesLignes);
  for (const f of [...listes(['diff', '--name-only', '-z', 'HEAD']), ...listes(['ls-files', '--others', '--exclude-standard', '-z'])]) {
    const depuis = join(racine, f);
    const vers = join(copie, f);
    if (existsSync(depuis)) {
      mkdirSync(dirname(vers), { recursive: true });
      copyFileSync(depuis, vers);
    } else rmSync(vers, { force: true });
  }
  const lignes = join(copie, 'data', 'rows');
  if (passe === PASSE_SANS_LE_CONTENU) {
    const bilan = retirerLeContenuDeLaCopie({ racine, copie, avecMixtes });
    console.log(`copie ${passe} : ${bilan.retires} fichiers retirés (${bilan.octets} octets)${avecMixtes ? ', migrations mixtes comprises' : ''}${bilan.absents ? `, ${bilan.absents} listés mais absents de la copie` : ''}`);
  } else if (passe !== PASSE_DE_LA_CI) for (const f of existsSync(lignes) ? readdirSync(lignes) : []) if (f.endsWith('.sql')) rmSync(join(lignes, f)); // D : data/rows reste, comme dans la CI
  const modules = join(copie, 'client', 'node_modules');
  if (!existsSync(modules)) {
    try { lstatSync(modules); rmSync(modules, { force: true }); } catch { /* absent */ }
    symlinkSync(join(client, 'node_modules'), modules, 'dir');
  }
  const pages = spawnSync(process.execPath, ['--no-warnings', 'scripts/db-export-pages.mjs'], {
    cwd: join(copie, 'client'), encoding: 'utf8', env: environnementDeLaPasse(passe, { exports: exportsDeLaPasse(passe), migrations: migrationsDeLaPasse(passe) }),
  });
  if (pages.status !== 0) throw new Error(`copie ${passe} : db-export-pages a échoué : ${pages.stderr || pages.stdout}`);
  return join(copie, 'client');
}

export function nettoyerLesCopies() {
  for (const passe of [...PASSES_DU_SITE, PASSE_DE_LA_CI, PASSE_SANS_LE_CONTENU]) {
    if (existsSync(copieDe(passe))) git(['worktree', 'remove', '--force', copieDe(passe)]);
  }
  retirerLesExportsArchives();
  retirerLesMigrationsArchivees();
  git(['worktree', 'prune']);
}

/**
 * Les contrôles du dépôt PAR NATURE : ils reconstruisent la base depuis data/rows, absent d'une copie jetable. Lancés et notés, rangés à part : ils ne
 * rendent jamais la passe rouge (jusqu'au lot 12, comme LIT_LE_DEPOT_PAR_NATURE).
 */
export const CONTROLES_PAR_NATURE = Object.freeze({
  'npm run db:build': 'reconstruit la base depuis data/rows, absent de la copie',
  'npm run db:check': 'vérifie la base reconstruite depuis data/rows',
});
/** Le seul contrôle « par nature » que la passe S ne lance pas : il reconstruit la base depuis data/rows. */
export const CONTROLE_RETIRE_EN_S = 'npm run db:build';
/** Les contrôles laissés à la passe elle-même : `npm test`, que la passe lance fichier par fichier (`--passe <P>` sans `--controles`). */
export const CONTROLES_DE_LA_PASSE = Object.freeze(['npm test']);
const LISTE_DE_TESTS = /^node --test((?: test\/[\w.-]+\.test\.mjs)+)$/;

/**
 * Les contrôles d'une passe, dans l'ordre de `controles` (scripts/mise-a-jour-github.mjs#CONTROLES : le job preparer, donc exactement le job client de
 * ci.yml) : sans ceux de la passe (`npm test`) ; une liste de tests du site construit (`node --test test/a test/b…`) éclatée en un contrôle par fichier,
 * pour un résultat par test (et ses tests sautés comptés) ; les contrôles du dépôt par nature marqués. Pure.
 * @returns {{ commande: string, origine: string, test?: string, par_nature?: string }[]}
 */
export function controlesDeLaPasse(controles, { sansLeContenu = false } = {}) {
  const liste = [];
  for (const origine of controles) {
    if (CONTROLES_DE_LA_PASSE.includes(origine)) continue;
    // passe S : plus rien « par nature ». db:build lit data/rows, qui n'est plus là : la CI du lot 12 ne le lance plus (non lancé : le tri des contrôles de S le dit) ; db:check suit le
    // contenu fourni (db-check.mjs#choisirLaBase) et reste un contrôle comme les autres : son échec est rouge.
    if (sansLeContenu && origine === CONTROLE_RETIRE_EN_S) continue;
    const tests = LISTE_DE_TESTS.exec(origine);
    if (tests) for (const t of tests[1].trim().split(' ')) liste.push({ commande: `node --test ${t}`, origine, test: t.slice('test/'.length) });
    else liste.push({ commande: origine, origine, ...(!sansLeContenu && Object.hasOwn(CONTROLES_PAR_NATURE, origine) ? { par_nature: CONTROLES_PAR_NATURE[origine] } : {}) });
  }
  return liste;
}

/** Les compteurs d'une sortie de node --test (TAP) : { pass, fail, skipped } (null quand la sortie n'en a pas). */
export function compteursDuTest(sortieTexte) {
  const lire = (nom) => {
    const m = new RegExp(`^# ${nom} (\\d+)$`, 'm').exec(sortieTexte);
    return m ? Number(m[1]) : null;
  };
  return { pass: lire('pass'), fail: lire('fail'), skipped: lire('skipped') };
}

/**
 * Lance les contrôles de la passe (controlesDeLaPasse(CONTROLES)) dans sa copie jetable, sous MAVERICK_CONTENU = le contenu de la passe, chacun même si
 * le précédent échoue : le build, les tests du site construit (un par fichier), le build de test et le contrôle du bandeau, l'installateur, le build de
 * production et ses deux tests, l'artefact. Écrit <sortie>/controles-<passe>.json ; rend les résultats.
 */
export async function controles(passeNom) {
  const { CONTROLES } = await import('./mise-a-jour-github.mjs');
  const cwd = preparerLaCopieJetable(passeNom);
  const dossier = join(sortie, 'journaux', passeNom);
  mkdirSync(dossier, { recursive: true });
  const runner = join(sortie, 'runner', passeNom);
  const liste = controlesDeLaPasse(CONTROLES, { sansLeContenu: passeNom === PASSE_SANS_LE_CONTENU });
  const resultats = [];
  for (const [i, c] of liste.entries()) {
    rmSync(runner, { recursive: true, force: true });
    mkdirSync(runner, { recursive: true });
    const t0 = Date.now();
    const env = { ...environnementDeLaPasse(passeNom, { exports: exportsDeLaPasse(passeNom), migrations: migrationsDeLaPasse(passeNom) }), RUNNER_TEMP: runner };
    const r = spawnSync('sh', ['-c', c.commande], { cwd, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const texte = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const journal = `controle-${String(i + 1).padStart(2, '0')}${c.test ? `-${c.test}` : ''}.log`;
    writeFileSync(join(dossier, journal), `$ ${c.commande}\n${texte}`);
    resultats.push({ ...c, code: r.status, ms: Date.now() - t0, journal, ...(c.test ? { compteurs: compteursDuTest(texte) } : {}) });
    console.log(`contrôle ${passeNom} ${i + 1}/${liste.length} : ${r.status === 0 ? 'ok' : `échec (${r.status})`}${c.par_nature ? ' (par nature)' : ''} — ${c.commande.slice(0, 80)}`);
  }
  writeFileSync(join(sortie, `controles-${passeNom}.json`), JSON.stringify(resultats, null, 1));
  return resultats;
}

/**
 * Le verdict des contrôles d'une passe (pure) : un contrôle par nature ne compte jamais ; un test du site construit est rouge s'il échoue, s'il ne
 * passe aucun test ou s'il en saute (le site n'a pas été construit : il ne prouverait rien). Rend { rouges, par_nature, md }.
 */
export function trierLesControlesDUnePasse(passeNom, resultats) {
  const etat = (c) => {
    if (c.par_nature) return c.code === 0 ? 'ok' : 'par nature';
    if (c.code !== 0) return `échec (${c.code})`;
    if (c.test && (!c.compteurs?.pass || c.compteurs?.skipped)) return `sauté ou vide (${c.compteurs?.skipped ?? '?'} sautés, ${c.compteurs?.pass ?? 0} passés)`;
    return 'ok';
  };
  const lignes = resultats.map((c) => ({ ...c, etat: etat(c) }));
  const rouges = lignes.filter((c) => c.etat !== 'ok' && c.etat !== 'par nature').map((c) => c.test ?? c.commande);
  const parNature = lignes.filter((c) => c.par_nature).map((c) => ({ commande: c.commande, code: c.code, raison: c.par_nature }));
  const cellule = (t) => String(t ?? '').replace(/\|/g, '\\|');
  const md = [`## Contrôles du job preparer, passe ${passeNom}`, '',
    ...(passeNom === PASSE_SANS_LE_CONTENU ? [`\`${CONTROLE_RETIRE_EN_S}\` n'est pas lancé en S (il reconstruit la base depuis data/rows, retiré avec le contenu : la CI du lot 12 ne le lance plus) ; \`npm run db:check\` l'est, sur le contenu fourni, et son échec est rouge.`, ''] : []), `${lignes.length - parNature.length - rouges.length}/${lignes.length - parNature.length} au vert`
    + `${rouges.length ? ` ; rouges : ${rouges.join(', ')}` : ''} ; ${parNature.length} contrôle(s) du dépôt par nature, à part.`, '',
  '| Contrôle | Test du site | Résultat | Durée | Journal |', '| --- | --- | --- | --- | --- |',
  ...lignes.map((c) => `| \`${cellule(c.commande.slice(0, 90))}\` | ${c.test ?? ''} | ${c.etat}${c.par_nature ? ` — ${cellule(c.par_nature)}` : ''} | ${Math.round((c.ms ?? 0) / 1000)} s | journaux/${passeNom}/${c.journal} |`), ''];
  return { rouges, par_nature: parNature, md };
}

// ───────────────────────── passes ─────────────────────────
const fichiersDeTest = () => readdirSync(join(client, 'test')).filter((f) => f.endsWith('.test.mjs')).sort();

function lancerUn(fichier, passe, cwd = client) {
  return new Promise((fin) => {
    const t0 = Date.now();
    const env = environnementDeLaPasse(passe, { exports: exportsDeLaPasse(passe), migrations: migrationsDeLaPasse(passe) });
    const p = spawn(process.execPath, ['--no-warnings', '--test', join('test', fichier)], { cwd, env });
    let sortieTexte = '';
    const garder = (b) => { if (sortieTexte.length < 4_000_000) sortieTexte += b; };
    p.stdout.on('data', garder);
    p.stderr.on('data', garder);
    let delaiAtteint = false;
    const minuteur = setTimeout(() => { delaiAtteint = true; p.kill('SIGKILL'); }, DELAI);
    p.on('close', (code) => {
      clearTimeout(minuteur);
      const dossier = join(sortie, 'journaux', passe);
      mkdirSync(dossier, { recursive: true });
      writeFileSync(join(dossier, `${fichier}.log`), sortieTexte);
      fin({ fichier, passe, code: delaiAtteint ? 'delai' : code, ms: Date.now() - t0 });
    });
  });
}

async function passe(nom, fichiers) {
  if (!passeConnue(nom)) throw new Error(`passe inconnue : ${nom} (A, B, ${PASSES_DU_SITE.join(', ')}, ${PASSE_DE_LA_CI}, ${PASSE_SANS_LE_CONTENU})`);
  if (!existsSync(FICHIER[nom])) throw new Error(`contenu de la passe ${nom} absent : ${FICHIER[nom]} (--fabriquer, ou npm run db:extrait pour C)`);
  const cwd = dansUneCopie(nom) ? preparerLaCopieJetable(nom) : client;
  const resultats = [];
  let suivant = 0;
  const ouvrier = async () => {
    while (suivant < fichiers.length) {
      const f = fichiers[suivant++];
      const r = await lancerUn(f, nom, cwd);
      resultats.push(r);
      if (resultats.length % 25 === 0) console.log(`passe ${nom} : ${resultats.length}/${fichiers.length}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLELE }, ouvrier));
  const chemin = join(sortie, `passe-${nom}.json`);
  const avant = existsSync(chemin) && drapeau('--fichiers') ? JSON.parse(readFileSync(chemin, 'utf8')) : [];
  const parNom = new Map([...avant, ...resultats].map((r) => [r.fichier, r]));
  writeFileSync(chemin, JSON.stringify([...parNom.values()].sort((a, b) => a.fichier.localeCompare(b.fichier)), null, 1));
  return resultats;
}

// ───────────────────────── tri ─────────────────────────
// Ce que le fichier lit, par ses importations (transitives, dans client/test et client/src) : on cherche des marques de lecture du contenu.
const MARQUES_CONTENU = [/lib\/donnees\.mjs/, /\bcheminBase\b/, /aide-base-d-import/, /aide-contenu-fourni/, /\bouvrirBase\b/, /fiche-regles/];
const MARQUES_DEPOT = [/content\/wiki/, /data\/rows/, /['"`]rows['"`]/, /db-build/, /tools\/db/, /maverick\.py/, /python3?['"`]/, /MAVERICK_ROOT/, /data\/migrations/];

function fermetureDesImports(fichier) {
  const vus = new Set();
  const pile = [resolve(client, 'test', fichier)];
  while (pile.length) {
    const f = pile.pop();
    if (vus.has(f) || !existsSync(f)) continue;
    vus.add(f);
    const source = readFileSync(f, 'utf8');
    for (const m of source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+\.m?js)['"]/g)) pile.push(resolve(dirname(f), m[1]));
  }
  return vus;
}

function marques(fichier) {
  const cache = marques.cache ?? (marques.cache = new Map());
  const contenu = [];
  const depot = [];
  for (const f of fermetureDesImports(fichier)) {
    if (!cache.has(f)) cache.set(f, readFileSync(f, 'utf8'));
    const s = cache.get(f);
    const nom = f.replace(`${client}/`, '');
    if (MARQUES_CONTENU.some((r) => r.test(s)) && !/src\/lib\/(donnees|contenu-fourni)\.mjs$/.test(nom)) contenu.push(nom);
    // lib/donnees.mjs et contenu-fourni.mjs citent data/rows et db-build mais obéissent à la variable : ils ne comptent pas comme lecture directe
    const lus = /src\/lib\/(donnees|contenu-fourni)\.mjs$/.test(nom) ? [] : MARQUES_DEPOT.filter((r) => r.test(s)).map((r) => r.source.replace(/\\\//g, '/'));
    if (lus.length) depot.push({ module: nom, lit: lus });
  }
  return { lit_contenu: contenu.length > 0, lit_depot_direct: depot.length > 0, lit: [...new Set(depot.flatMap((d) => d.lit))], par: contenu.slice(0, 3) };
}

// La cause d'un échec : la première erreur du journal, ramenée à une forme sans valeurs, puis rangée par famille (règles ordonnées).
const FAMILLES = [
  ['delai', 'Délai dépassé', (s, e) => e.code === 'delai'],
  ['corps-markdown', 'Le test (ou le service) lit la structure du corps Markdown d\'une page : sections, puces, balises', (s) => /section introuvable|corps illisible|pas de section|section « /i.test(s)],
  ['regle-lue-dans-un-texte', 'Une règle lue dans un texte (puces d\'effets, notes, relecture des règles) : le texte factice n\'en porte plus', (s) => /aucun effet|puces|une note attendue|à l[’']import|C\d+ guide|choisissez|texte de r/i.test(s)],
  ['fiche-moteur', 'Fiche de personnage et moteur : le test échoue sans message (la fiche lit des noms et des textes)', (s, e, f) => /^(fiche|personnages|r\d+)/.test(f) && /test failed/.test(s)],
  ['nom-ou-texte-compare', 'Une valeur attendue est un nom ou un texte du contenu, comparé tel quel', (s) => /Nom factice|Texte factice/.test(s)],
  ['ligne-absente', 'Une ligne cherchée par son nom ou son titre n\'est pas trouvée', (s) => /Cannot read properties|introuvable|absent|undefined/i.test(s)],
  ['valeur-attendue', 'Une valeur, une liste ou un comptage attendus ont changé', (s) => /strictly (deep-)?equal|deepEqual|expected|attendu/i.test(s)],
  ['exception-attendue', 'Une erreur attendue ne se produit plus', (s) => /Missing expected exception/.test(s)],
];

function signature(texte) {
  const lignes = texte.split('\n');
  const i = lignes.findIndex((l) => /^\s*error:/.test(l));
  const bloc = (i >= 0 ? lignes.slice(i, i + 14) : lignes.slice(-14)).join('\n');
  return { bloc: bloc.slice(0, 1500), premiere: bloc.replace(/\s+/g, ' ').slice(0, 200) };
}

function lireLeJournal(passeNom, fichier) {
  const chemin = join(sortie, 'journaux', passeNom, `${fichier}.log`);
  return existsSync(chemin) ? readFileSync(chemin, 'utf8') : '';
}

/** Le tri du premier essai (passes A et B) : { bilan, lignes, familles, md }. */
function trierAB(A, B) {
  const lignes = [];
  for (const fichier of fichiersDeTest()) {
    const a = A.get(fichier);
    const b = B.get(fichier);
    if (!a && !b) continue; // fichier arrivé depuis la mesure : non mesuré
    const m = marques(fichier);
    const reussi = (r) => r && r.code === 0;
    let categorie;
    if (!reussi(a)) categorie = 'casse-sur-le-vrai';
    else if (!reussi(b)) categorie = 'casse-sur-le-factice';
    else categorie = m.lit_contenu || m.lit_depot_direct ? 'passe-sur-les-deux' : 'ne-lit-pas-le-contenu';
    const ligne = { fichier, categorie, lit_contenu: m.lit_contenu, lit_depot_direct: m.lit_depot_direct, lit: m.lit, ms: (a?.ms ?? 0) + (b?.ms ?? 0) };
    if (categorie === 'casse-sur-le-factice' || categorie === 'casse-sur-le-vrai') {
      const passeNom = categorie === 'casse-sur-le-vrai' ? 'A' : 'B';
      const r = categorie === 'casse-sur-le-vrai' ? a : b;
      const s = signature(lireLeJournal(passeNom, fichier));
      const famille = FAMILLES.find(([, , test]) => test(s.bloc, r, fichier));
      ligne.famille = categorie === 'casse-sur-le-vrai' ? 'branchement' : (famille?.[0] ?? 'autre');
      ligne.cause = s.premiere;
    }
    lignes.push(ligne);
  }
  const compte = (cle, valeur) => lignes.filter((l) => l[cle] === valeur).length;
  const comptes = {};
  for (const l of lignes) comptes[l.categorie] = (comptes[l.categorie] ?? 0) + 1;
  const familles = {};
  for (const l of lignes.filter((x) => x.famille)) (familles[`${l.categorie}/${l.famille}`] ??= []).push(l.fichier);
  const bilan = {
    total: lignes.length,
    comptes,
    passe_mais_lit_le_depot_en_direct: lignes.filter((l) => l.categorie === 'passe-sur-les-deux' && l.lit_depot_direct).length,
    ne_lit_pas_mais_lit_le_depot_en_direct: lignes.filter((l) => l.lit_depot_direct && !l.lit_contenu).length,
    familles: Object.fromEntries(Object.entries(familles).map(([k, v]) => [k, v.length])),
    importe_donnees: compte('lit_contenu', true),
  };
  const md = [
    '## Passes A et B (vrai contenu reconstruit depuis data/rows, contenu factice)', '',
    '| Catégorie | Fichiers |', '| --- | ---: |', ...Object.entries(comptes).map(([k, v]) => `| ${k} | ${v} |`), `| **total** | ${lignes.length} |`, '',
    '| Famille de cause (sur le contenu factice) | Fichiers |', '| --- | ---: |', ...Object.entries(bilan.familles).map(([k, v]) => `| ${k} | ${v} |`), '',
  ];
  if (drapeau('--ecrire-docs')) {
    // la version rangée dans le dépôt : un fichier de test par ligne (catégorie, famille), sans les journaux
    const compact = { bilan, fichiers: lignes.map(({ fichier, categorie, famille, lit_contenu, lit_depot_direct, lit }) => ({ fichier, categorie, ...(famille ? { famille } : {}), lit_contenu, lit_depot_direct, ...(lit?.length ? { lit } : {}) })) };
    writeFileSync(join(client, '..', 'docs', 'essai-mecanique-des-tests.json'), JSON.stringify(compact, null, 0).replace(/\{"fichier"/g, '\n{"fichier"') + '\n');
  }
  return { bilan, lignes, familles, md };
}

/**
 * Les fichiers de test qui lisent le dépôt PAR NATURE (lot 10, passe C du 2026-11-18 ; docs/essai-mecanique-des-tests.md, « Passe C et variantes ») :
 * leur échec sur C est attendu jusqu'au lot 12 (data/rows quitte le dépôt, l'ancien circuit est retiré), et le tri les range à part des échecs inattendus.
 * Familles : F3 les outils de l'ancien circuit, qui écrivent ou relisent data/rows ; F4 les invariants « table des fiches vide dans data/rows » ;
 * F5 les outils Python qui lisent data/rows. `tests` : les tests du fichier concernés (les autres passent C). Un nom absent de client/test/ fait échouer
 * test/essai-mecanique.test.mjs. Lot 12 (PR 2) : F4 est vide (l'invariant se vérifie sur le contenu qui fait foi : test/aide-base-de-depart.mjs#lignesDuContenu),
 * `races-onglet` (races_onglet.py --verifier --base), `db-pages-du-site` (sync dans une base de travail, puis un lot source), `codex` (codex.py --verifier --base) et `races-magies-innees-liste` (rapatriement dans une copie des lignes de départ), `mise-a-jour-paquet` et `mise-a-jour-regles` (copies des lignes de départ : `copieDesRowsDeDepart`, `rowsDeDepart`) et `contenu-fourni` (test 2 dans une racine jetable) en sont sortis.
 */
export const LIT_LE_DEPOT_PAR_NATURE = Object.freeze({
  'db-donnees.test.mjs': { famille: 'F3', raison: 'db:build et db:derive depuis data/rows, Python qui reconstruit data/rows, db:sync-pages (les 5 tests déclarés dans sortie-du-contenu.mjs#RETIRES_AVEC_LE_CONTENU ; db:check, db:export-pages et db:pages-check lisent le contenu fourni)', tests: '1, 5, 6, 8 et 9' },
  'pages-d-exemple.test.mjs': { famille: 'F3', raison: 'voulu : le fichier des pages d’exemple est comparé à data/rows, dont il est tiré (test déclaré dans sortie-du-contenu.mjs#RETIRES_AVEC_LE_CONTENU)', tests: '1' },
});

const DESCRIPTION_DES_PASSES = {
  C: 'vrai contenu du site de dev, sans data/rows',
  V1: 'icônes sur des mots-clés de genres variés',
  V2: 'un sort renommé par le service',
  V3: 'des lignes ajoutées',
  V4: 'des lignes retirées',
  V5: 'une magie renommée, hors des voies du site',
};

/**
 * Le tri des passes du site de dev : C (un échec = le test lit encore le dépôt, ou casse sur le vrai contenu du site), puis chaque variante, comptée
 * seulement sur les fichiers qui passent C (un échec = le test fige une valeur que le site de dev peut changer). Pure : prend les résultats par passe.
 * Sur C, un fichier de `parNature` (LIT_LE_DEPOT_PAR_NATURE) qui casse est rangé à part (`par_nature`), hors des échecs inattendus (`cassent`) ; un
 * fichier de la liste qui passe est signalé (`classes_qui_passent` : à retirer de la liste).
 * @param {Record<string, Map<string, { code: number|string, ms?: number }>>} resultats
 * @param {(passe: string, fichier: string) => string} [lireJournal]
 * @param {Record<string, { famille: string, raison: string, tests?: string }>} [parNature]
 */
export function trierLesPassesDuSite(resultats, lireJournal = () => '', parNature = LIT_LE_DEPOT_PAR_NATURE) {
  const reussi = (r) => r && r.code === 0;
  const C = resultats.C ?? new Map();
  const passes = {};
  const fichiers = new Map();
  const noter = (fichier, passeNom, r) => {
    const ligne = fichiers.get(fichier) ?? fichiers.set(fichier, { fichier }).get(fichier);
    ligne[passeNom] = r.code === 0 ? 'passe' : 'casse';
    if (r.code !== 0) (ligne.causes ??= {})[passeNom] = signature(lireJournal(passeNom, fichier)).premiere.trim();
  };
  if (resultats.C) {
    const casse = [...C.values()].filter((r) => !reussi(r)).map((r) => r.fichier).sort();
    for (const r of C.values()) noter(r.fichier, 'C', r);
    const classe = (f) => Object.hasOwn(parNature, f);
    passes.C = {
      mesures: C.size, passent: C.size - casse.length, cassent: casse.filter((f) => !classe(f)), par_nature: casse.filter(classe),
      classes_qui_passent: [...C.values()].filter((r) => reussi(r) && classe(r.fichier)).map((r) => r.fichier).sort(),
    };
  }
  for (const v of PASSES_DU_SITE.slice(1)) {
    const V = resultats[v];
    if (!V) continue;
    const casse = [];
    let sansC = 0;
    for (const r of V.values()) {
      noter(r.fichier, v, r);
      if (reussi(r)) continue;
      if (C.size && !reussi(C.get(r.fichier))) { sansC += 1; continue; } // déjà compté par C : la variante n'y ajoute rien
      casse.push(r.fichier);
    }
    passes[v] = PASSES_INFORMATIVES.includes(v)
      ? { mesures: V.size, informative: true, cassent: casse.sort(), deja_casses_par_C: sansC }
      : { mesures: V.size, figent_une_valeur: casse.sort(), deja_casses_par_C: sansC };
  }
  const md = [];
  for (const [nom, p] of Object.entries(passes)) {
    const liste = nom === 'C' || p.informative ? p.cassent : p.figent_une_valeur;
    const cellule = (t) => String(t ?? '').replace(/\|/g, '\\|');
    md.push(`## Passe ${nom} (${DESCRIPTION_DES_PASSES[nom]})`, '',
      nom === 'C' ? `${p.passent}/${p.mesures} fichiers passent ; ${liste.length} cassent sans être attendus (lisent encore le dépôt, ou cassent sur le vrai contenu du site) ; `
        + `${p.par_nature.length} lisent le dépôt par nature.`
        : p.informative ? `Hors des voies du site aujourd'hui : informative, ne bloque rien. ${p.mesures} fichiers mesurés ; ${liste.length} cassent alors qu'ils passent C.`
          : `${p.mesures} fichiers mesurés ; ${liste.length} cassent alors qu'ils passent C (figent une valeur modifiable)${p.deja_casses_par_C ? ` ; ${p.deja_casses_par_C} cassent déjà sur C` : ''}.`, '');
    if (liste.length) md.push('| Fichier | Cause (premier message) |', '| --- | --- |', ...liste.map((f) => `| ${f} | ${cellule(fichiers.get(f).causes?.[nom])} |`), '');
    if (nom === 'C' && p.par_nature.length) {
      md.push('### Lit le dépôt par nature, jusqu’au lot 12', '', '| Fichier | Famille | Raison | Tests |', '| --- | --- | --- | --- |',
        ...p.par_nature.map((f) => `| ${f} | ${parNature[f].famille} | ${cellule(parNature[f].raison)} | ${cellule(parNature[f].tests)} |`), '');
    }
    if (nom === 'C' && p.classes_qui_passent.length) md.push(`Classés « par nature » mais qui passent C (à retirer de la liste) : ${p.classes_qui_passent.join(', ')}.`, '');
  }
  return { passes, fichiers: [...fichiers.values()].sort((a, b) => a.fichier.localeCompare(b.fichier)), md };
}

/**
 * La passe D (la CI) : un fichier de `parNature` qui casse sous l'extrait avec data/rows dans l'arbre est ROUGE, comme dans `npm test` de ci.yml (sur C, le même
 * fichier casse par nature faute de data/rows : attendu, et sans rapport). Pure : prend le résultat de la passe (fichier -> { code }).
 * @param {Map<string, { fichier: string, code: number|string }>|null} D
 * @param {(passe: string, fichier: string) => string} [lireJournal]
 * @param {Record<string, unknown>} [parNature]
 */
export function trierLaPasseDeLaCI(D, lireJournal = () => '', parNature = LIT_LE_DEPOT_PAR_NATURE) {
  if (!D) return null;
  const mesures = [...D.values()].filter((r) => Object.hasOwn(parNature, r.fichier));
  const rouges = mesures.filter((r) => r.code !== 0).map((r) => r.fichier).sort();
  const md = ['## Passe D (la CI : l\'extrait du site de dev, data/rows dans l\'arbre)', '',
    `${mesures.length - rouges.length}/${mesures.length} fichiers classés « par nature » passent ; ${rouges.length} rouge(s) (cassent comme dans la CI).`, ''];
  if (rouges.length) md.push('| Fichier | Cause (premier message) |', '| --- | --- |', ...rouges.map((f) => `| ${f} | ${String(signature(lireJournal(PASSE_DE_LA_CI, f)).premiere.trim()).replace(/\|/g, '\\|')} |`), '');
  return { passes: { mesures: mesures.length, passent: mesures.length - rouges.length, rouges }, md };
}

/**
 * La passe S (le dépôt sans le contenu qui sort au lot 12) : AUCUNE rubrique « par nature », aucune liste d'exceptions. Tout fichier qui casse est rouge, avec
 * sa cause (le premier message de son journal) ; la passe est verte quand `rouges` est vide : le critère de fin du lot 12. Pure : prend le résultat de la passe.
 * @param {Map<string, { fichier: string, code: number|string }>|null} S
 * @param {(passe: string, fichier: string) => string} [lireJournal]
 */
export function trierLaPasseSansLeContenu(S, lireJournal = () => '') {
  if (!S) return null;
  const mesures = [...S.values()];
  const rouges = mesures.filter((r) => r.code !== 0).map((r) => ({
    fichier: r.fichier, cause: r.code === 'delai' ? 'délai dépassé' : String(signature(lireJournal(PASSE_SANS_LE_CONTENU, r.fichier)).premiere.trim()),
  })).sort((a, b) => a.fichier.localeCompare(b.fichier));
  const md = ['## Passe S (le dépôt sans le contenu : ni data/rows, ni migrations de données, ni sources/raw ; l\'extrait du site de dev pour contenu)', '',
    `${mesures.length - rouges.length}/${mesures.length} fichiers passent ; ${rouges.length} rouge(s). ${rouges.length ? 'Le lot 12 ne s\'exécute pas tant que la passe n\'est pas verte.' : 'Verte : le critère de fin du lot 12 est rempli pour la suite.'}`, ''];
  if (rouges.length) md.push('| Fichier | Cause (premier message) |', '| --- | --- |', ...rouges.map((r) => `| ${r.fichier} | ${r.cause.replace(/\|/g, '\\|')} |`), '');
  return { passes: { mesures: mesures.length, passent: mesures.length - rouges.length, rouges }, md };
}

/** Les contrôles du job preparer passés par --controles, par passe : un résultat par contrôle et par test du site construit. */
function trierLesControles() {
  const md = [];
  const parPasse = {};
  for (const p of [...PASSES_DU_SITE, PASSE_SANS_LE_CONTENU]) {
    const chemin = join(sortie, `controles-${p}.json`);
    if (!existsSync(chemin)) continue;
    const t = trierLesControlesDUnePasse(p, JSON.parse(readFileSync(chemin, 'utf8')));
    parPasse[p] = { rouges: t.rouges, par_nature: t.par_nature };
    md.push(...t.md);
  }
  return { parPasse, md };
}

/** Refait le tri depuis les résultats écrits (<sortie>/passe-*.json) : écrit <sortie>/tri.json et <sortie>/tri.md, rend le bilan. */
export function trier() {
  const lire = (n) => {
    const chemin = join(sortie, `passe-${n}.json`);
    return existsSync(chemin) ? new Map(JSON.parse(readFileSync(chemin, 'utf8')).map((r) => [r.fichier, r])) : null;
  };
  const ab = lire('A') && lire('B') ? trierAB(lire('A'), lire('B')) : null;
  const resultats = Object.fromEntries(PASSES_DU_SITE.map((p) => [p, lire(p)]).filter(([, m]) => m));
  const site = trierLesPassesDuSite(resultats, lireLeJournal);
  const ci = trierLaPasseDeLaCI(lire(PASSE_DE_LA_CI), lireLeJournal);
  if (ci) { site.passes[PASSE_DE_LA_CI] = ci.passes; site.md.push(...ci.md); }
  const sansContenu = trierLaPasseSansLeContenu(lire(PASSE_SANS_LE_CONTENU), lireLeJournal);
  if (sansContenu) { site.passes[PASSE_SANS_LE_CONTENU] = sansContenu.passes; site.md.push(...sansContenu.md); }
  const ctrl = trierLesControles();
  const bilan = { ...(ab ? { AB: ab.bilan } : {}), ...site.passes, ...(Object.keys(ctrl.parPasse).length ? { controles: ctrl.parPasse } : {}) };
  writeFileSync(join(sortie, 'tri.json'), JSON.stringify({ bilan, ...(ab ? { fichiers: ab.lignes, familles: ab.familles } : {}), passes_du_site: site.fichiers }, null, 1));
  writeFileSync(join(sortie, 'tri.md'), [`# Essai mécanique des tests — tri (${new Date().toISOString()})`, '', ...(ab?.md ?? []), ...site.md, ...ctrl.md].join('\n'));
  return { ...(ab ? { AB: ab.bilan } : {}), ...Object.fromEntries(Object.entries(site.passes).map(([k, v]) => [k, k === PASSE_DE_LA_CI || k === PASSE_SANS_LE_CONTENU ? { mesures: v.mesures, rouges: v.rouges.length } : k === 'C' ? { mesures: v.mesures, cassent: v.cassent.length, par_nature: v.par_nature.length } : v.informative ? { mesures: v.mesures, informative: true, cassent: v.cassent.length } : { mesures: v.mesures, figent_une_valeur: v.figent_une_valeur.length }])) };
}

// ───────────────────────── commande ─────────────────────────
const resume = (n, r) => `passe ${n} : ${r.filter((x) => x.code === 0).length}/${r.length} fichiers sans échec`;
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const choisis = arg('--fichiers', null)?.split(',');
  const fichiers = choisis ?? fichiersDeTest();
  if (drapeau('--trier')) {
    console.log(JSON.stringify(trier(), null, 1));
  } else if (drapeau('--nettoyer')) {
    nettoyerLesCopies();
  } else if (drapeau('--fabriquer')) {
    console.log(JSON.stringify(await fabriquerLesContenus(), null, 1));
    if (existsSync(EXTRAIT)) console.log(JSON.stringify(await fabriquerLesVariantes(), null, 1));
  } else if (arg('--passe', null) && drapeau('--controles')) {
    if (![...PASSES_DU_SITE, PASSE_SANS_LE_CONTENU].includes(arg('--passe'))) throw new Error(`--controles : passe C, S ou V1 à V5 (pas ${arg('--passe')})`);
    const r = await controles(arg('--passe'));
    const t = trierLesControlesDUnePasse(arg('--passe'), r);
    console.log(`contrôles ${arg('--passe')} : ${t.rouges.length ? `rouges : ${t.rouges.join(', ')}` : 'au vert'} ; ${t.par_nature.length} par nature (à part)`);
  } else if (arg('--passe', null)) {
    const nom = arg('--passe');
    console.log(resume(nom, await passe(nom, nom === PASSE_DE_LA_CI && !choisis ? Object.keys(LIT_LE_DEPOT_PAR_NATURE) : fichiers)));
  } else {
    console.log(JSON.stringify(await fabriquerLesContenus(), null, 1));
    const avecLeSite = existsSync(EXTRAIT);
    if (avecLeSite) console.log(JSON.stringify(await fabriquerLesVariantes(), null, 1));
    else console.log(`passes C et V1 à V5 sautées : extrait du site de dev absent (${EXTRAIT}, npm run db:extrait)`);
    for (const n of ['A', 'B', ...(avecLeSite ? PASSES_DU_SITE : [])]) console.log(resume(n, await passe(n, fichiers)));
    if (avecLeSite) console.log(resume(PASSE_DE_LA_CI, await passe(PASSE_DE_LA_CI, Object.keys(LIT_LE_DEPOT_PAR_NATURE))));
    console.log(JSON.stringify(trier(), null, 1));
  }
}
