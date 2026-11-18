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
//       sur des mots-clés de genres variés, V2 une magie renommée, V3 des lignes ajoutées, V4 des lignes retirées), chacune dans sa copie jetable comme C.
//       Un fichier qui passe C et casse sur Vn fige une valeur modifiable.
// Rien n'est jamais commité depuis une copie jetable ; toute la sortie reste sous var/ (ignoré par git).
//
// Usage, depuis client/ :
//   node scripts/essai-mecanique-tests.mjs                          tout : fabrique les contenus, lance toutes les passes (C et V seulement si l'extrait existe), trie
//   node scripts/essai-mecanique-tests.mjs --fabriquer              seulement les contenus : A et B, et les variantes V1 à V4 si l'extrait existe
//   node scripts/essai-mecanique-tests.mjs --passe A|B|C|V1|V2|V3|V4 [--fichiers a.test.mjs,b.test.mjs]
//   node scripts/essai-mecanique-tests.mjs --passe C|V1… --controles   les contrôles du job preparer (scripts/mise-a-jour-github.mjs#CONTROLES : db:build,
//                                                                      db:check, npm test, build, tests du site construit…) dans la copie jetable de la passe
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
export const PASSES_DU_SITE = ['C', 'V1', 'V2', 'V3', 'V4'];
const FICHIER = {
  A: join(sortie, 'contenu-vrai.db'),
  B: join(sortie, 'contenu-factice.db'),
  C: EXTRAIT,
  ...Object.fromEntries(PASSES_DU_SITE.slice(1).map((v) => [v, join(sortie, `variante-${v}.db`)])),
};
const dansUneCopie = (passe) => PASSES_DU_SITE.includes(passe);
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

// ───────────────────────── variantes de l'extrait du site de dev (V1 à V4) ─────────────────────────
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
const horsDesLignes = (f) => !f.startsWith('data/rows/');

/**
 * La copie jetable de la passe : un git worktree détaché sur HEAD (refait s'il manque), où sont recopiées les modifications en cours de l'arbre (fichiers suivis
 * modifiés ou retirés, fichiers nouveaux non ignorés), data/rows/*.sql retiré, client/node_modules par lien, content/wiki fabriqué depuis le contenu de la passe.
 * Rien n'y est jamais commité. Rend le dossier client/ de la copie.
 */
export function preparerLaCopieJetable(passe) {
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
  for (const f of existsSync(lignes) ? readdirSync(lignes) : []) if (f.endsWith('.sql')) rmSync(join(lignes, f));
  const modules = join(copie, 'client', 'node_modules');
  if (!existsSync(modules)) {
    try { lstatSync(modules); rmSync(modules, { force: true }); } catch { /* absent */ }
    symlinkSync(join(client, 'node_modules'), modules, 'dir');
  }
  const pages = spawnSync(process.execPath, ['--no-warnings', 'scripts/db-export-pages.mjs'], {
    cwd: join(copie, 'client'), encoding: 'utf8', env: { ...process.env, MAVERICK_CONTENU: FICHIER[passe] },
  });
  if (pages.status !== 0) throw new Error(`copie ${passe} : db-export-pages a échoué : ${pages.stderr || pages.stdout}`);
  return join(copie, 'client');
}

export function nettoyerLesCopies() {
  for (const passe of PASSES_DU_SITE) {
    if (existsSync(copieDe(passe))) git(['worktree', 'remove', '--force', copieDe(passe)]);
  }
  git(['worktree', 'prune']);
}

/** Lance les contrôles du job preparer (CONTROLES de scripts/mise-a-jour-github.mjs) dans la copie jetable de la passe, chacun même si le précédent échoue. */
export async function controles(passeNom) {
  const { CONTROLES } = await import('./mise-a-jour-github.mjs');
  const cwd = preparerLaCopieJetable(passeNom);
  const dossier = join(sortie, 'journaux', passeNom);
  mkdirSync(dossier, { recursive: true });
  const runner = join(sortie, 'runner', passeNom);
  const resultats = [];
  for (const [i, commande] of CONTROLES.entries()) {
    rmSync(runner, { recursive: true, force: true });
    mkdirSync(runner, { recursive: true });
    const t0 = Date.now();
    const env = { ...process.env, MAVERICK_CONTENU: FICHIER[passeNom], RUNNER_TEMP: runner };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync('sh', ['-c', commande], { cwd, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const journal = `controle-${String(i + 1).padStart(2, '0')}.log`;
    writeFileSync(join(dossier, journal), `$ ${commande}\n${r.stdout ?? ''}${r.stderr ?? ''}`);
    resultats.push({ commande, code: r.status, ms: Date.now() - t0, journal });
    console.log(`contrôle ${passeNom} ${i + 1}/${CONTROLES.length} : ${r.status === 0 ? 'ok' : `échec (${r.status})`} — ${commande.slice(0, 80)}`);
  }
  writeFileSync(join(sortie, `controles-${passeNom}.json`), JSON.stringify(resultats, null, 1));
  return resultats;
}

// ───────────────────────── passes ─────────────────────────
const fichiersDeTest = () => readdirSync(join(client, 'test')).filter((f) => f.endsWith('.test.mjs')).sort();

function lancerUn(fichier, passe, cwd = client) {
  return new Promise((fin) => {
    const t0 = Date.now();
    const env = { ...process.env, MAVERICK_CONTENU: FICHIER[passe] };
    delete env.NODE_TEST_CONTEXT;
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
  if (!passeConnue(nom)) throw new Error(`passe inconnue : ${nom} (A, B, ${PASSES_DU_SITE.join(', ')})`);
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

const DESCRIPTION_DES_PASSES = {
  C: 'vrai contenu du site de dev, sans data/rows',
  V1: 'icônes sur des mots-clés de genres variés',
  V2: 'une magie renommée',
  V3: 'des lignes ajoutées',
  V4: 'des lignes retirées',
};

/**
 * Le tri des passes du site de dev : C (un échec = le test lit encore le dépôt, ou casse sur le vrai contenu du site), puis chaque variante, comptée
 * seulement sur les fichiers qui passent C (un échec = le test fige une valeur que le site de dev peut changer). Pure : prend les résultats par passe.
 * @param {Record<string, Map<string, { code: number|string, ms?: number }>>} resultats
 * @param {(passe: string, fichier: string) => string} [lireJournal]
 */
export function trierLesPassesDuSite(resultats, lireJournal = () => '') {
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
    passes.C = { mesures: C.size, passent: C.size - casse.length, cassent: casse };
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
    passes[v] = { mesures: V.size, figent_une_valeur: casse.sort(), deja_casses_par_C: sansC };
  }
  const md = [];
  for (const [nom, p] of Object.entries(passes)) {
    const liste = nom === 'C' ? p.cassent : p.figent_une_valeur;
    md.push(`## Passe ${nom} (${DESCRIPTION_DES_PASSES[nom]})`, '',
      nom === 'C' ? `${p.passent}/${p.mesures} fichiers passent ; ${liste.length} cassent (lisent encore le dépôt, ou cassent sur le vrai contenu du site).`
        : `${p.mesures} fichiers mesurés ; ${liste.length} cassent alors qu'ils passent C (figent une valeur modifiable)${p.deja_casses_par_C ? ` ; ${p.deja_casses_par_C} cassent déjà sur C` : ''}.`, '');
    if (liste.length) md.push('| Fichier | Cause (premier message) |', '| --- | --- |', ...liste.map((f) => `| ${f} | ${(fichiers.get(f).causes?.[nom] ?? '').replace(/\|/g, '\\|')} |`), '');
  }
  return { passes, fichiers: [...fichiers.values()].sort((a, b) => a.fichier.localeCompare(b.fichier)), md };
}

/** Les contrôles du job preparer passés par --controles, par passe. */
function trierLesControles() {
  const md = [];
  const parPasse = {};
  for (const p of PASSES_DU_SITE) {
    const chemin = join(sortie, `controles-${p}.json`);
    if (!existsSync(chemin)) continue;
    const r = JSON.parse(readFileSync(chemin, 'utf8'));
    parPasse[p] = r.map(({ commande, code, journal }) => ({ commande, code, journal }));
    md.push(`## Contrôles du job preparer, passe ${p}`, '', '| Contrôle | Résultat | Journal |', '| --- | --- | --- |',
      ...r.map((c) => `| \`${c.commande.slice(0, 90).replace(/\|/g, '\\|')}\` | ${c.code === 0 ? 'ok' : `échec (${c.code})`} | journaux/${p}/${c.journal} |`), '');
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
  const ctrl = trierLesControles();
  const bilan = { ...(ab ? { AB: ab.bilan } : {}), ...site.passes, ...(Object.keys(ctrl.parPasse).length ? { controles: ctrl.parPasse } : {}) };
  writeFileSync(join(sortie, 'tri.json'), JSON.stringify({ bilan, ...(ab ? { fichiers: ab.lignes, familles: ab.familles } : {}), passes_du_site: site.fichiers }, null, 1));
  writeFileSync(join(sortie, 'tri.md'), [`# Essai mécanique des tests — tri (${new Date().toISOString()})`, '', ...(ab?.md ?? []), ...site.md, ...ctrl.md].join('\n'));
  return { ...(ab ? { AB: ab.bilan } : {}), ...Object.fromEntries(Object.entries(site.passes).map(([k, v]) => [k, k === 'C' ? { mesures: v.mesures, cassent: v.cassent.length } : { mesures: v.mesures, figent_une_valeur: v.figent_une_valeur.length }])) };
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
    if (!dansUneCopie(arg('--passe'))) throw new Error(`--controles : passe C ou V1 à V4 (pas ${arg('--passe')})`);
    const r = await controles(arg('--passe'));
    console.log(`contrôles ${arg('--passe')} : ${r.filter((x) => x.code === 0).length}/${r.length} sans échec`);
  } else if (arg('--passe', null)) {
    console.log(resume(arg('--passe'), await passe(arg('--passe'), fichiers)));
  } else {
    console.log(JSON.stringify(await fabriquerLesContenus(), null, 1));
    const avecLeSite = existsSync(EXTRAIT);
    if (avecLeSite) console.log(JSON.stringify(await fabriquerLesVariantes(), null, 1));
    else console.log(`passes C et V1 à V4 sautées : extrait du site de dev absent (${EXTRAIT}, npm run db:extrait)`);
    for (const n of ['A', 'B', ...(avecLeSite ? PASSES_DU_SITE : [])]) console.log(resume(n, await passe(n, fichiers)));
    console.log(JSON.stringify(trier(), null, 1));
  }
}
