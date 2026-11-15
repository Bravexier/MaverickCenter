#!/usr/bin/env node
// Essai mécanique des tests (lot 10 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md ; résultat : docs/essai-mecanique-des-tests.md).
// Question : que lisent les tests dans le contenu du dépôt ? On change en un seul endroit la source qu'ils lisent (MAVERICK_CONTENU, lib/contenu-fourni.mjs) et on mesure ce qui casse.
// Aucun test, aucun module du site ni aucune donnée n'est modifié : le script fabrique deux fichiers de contenu, lance chaque fichier de test à part sur chacun, et trie.
//   A  le vrai contenu (extrait de la base construite depuis data/rows) : tout doit passer, cela vérifie le branchement ;
//   B  un contenu différent, obtenu mécaniquement : le vrai dont les noms et les textes libres sont remplacés par des valeurs factices (identifiants, clés de jointure,
//      formules, valeurs brutes, liens entre lignes et structure inchangés ; les clés `*_cle` sont recalculées avec normalize()).
//
// Usage, depuis client/ :
//   node scripts/essai-mecanique-tests.mjs                       tout : fabrique A et B, lance les deux passes, écrit le tri
//   node scripts/essai-mecanique-tests.mjs --fabriquer           seulement A et B (var/essai-mecanique/)
//   node scripts/essai-mecanique-tests.mjs --passe A|B [--fichiers a.test.mjs,b.test.mjs]
//   node scripts/essai-mecanique-tests.mjs --trier               refait le tri depuis les journaux déjà écrits
// Options : --parallele N (défaut : nombre de cœurs), --delai SECONDES (défaut 600, par fichier), --sortie <dossier> (défaut var/essai-mecanique).
// Sorties : <sortie>/journaux/{A,B}/<fichier>.log (complets, à chercher par Grep), <sortie>/tri.json ; le résumé lisible est écrit par --trier dans <sortie>/tri.md.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : defaut;
};
const drapeau = (nom) => process.argv.includes(nom);
const sortie = resolve(arg('--sortie', join(client, '..', 'var', 'essai-mecanique')));
const PARALLELE = Number(arg('--parallele', Math.max(1, cpus().length)));
const DELAI = Number(arg('--delai', 600)) * 1000;
const FICHIER = { A: join(sortie, 'contenu-vrai.db'), B: join(sortie, 'contenu-factice.db') };

// ───────────────────────── fabrication des deux contenus ─────────────────────────
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

// ───────────────────────── passes ─────────────────────────
const fichiersDeTest = () => readdirSync(join(client, 'test')).filter((f) => f.endsWith('.test.mjs')).sort();

function lancerUn(fichier, passe) {
  return new Promise((fin) => {
    const t0 = Date.now();
    const env = { ...process.env, MAVERICK_CONTENU: FICHIER[passe] };
    delete env.NODE_TEST_CONTEXT;
    const p = spawn(process.execPath, ['--no-warnings', '--test', join('test', fichier)], { cwd: client, env });
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
  const resultats = [];
  let suivant = 0;
  const ouvrier = async () => {
    while (suivant < fichiers.length) {
      const f = fichiers[suivant++];
      const r = await lancerUn(f, nom);
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
const MARQUES_DEPOT = [/data\/rows/, /['"`]rows['"`]/, /db-build/, /tools\/db/, /maverick\.py/, /python3?['"`]/, /MAVERICK_ROOT/, /data\/migrations/];

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
    if (MARQUES_DEPOT.some((r) => r.test(s))) depot.push(nom);
  }
  return { lit_contenu: contenu.length > 0, lit_depot_direct: depot.length > 0, par: contenu.slice(0, 3) };
}

// La cause d'un échec : la première erreur du journal, ramenée à une forme sans valeurs, puis rangée par famille (règles ordonnées).
const FAMILLES = [
  ['delai', 'Délai dépassé', (s, e) => e.code === 'delai'],
  ['nom-introuvable', 'Une ligne ou une page cherchée par son nom ou son titre est introuvable', (s) => /(introuvable|not found|aucune? (page|ligne|sort|race|classe|magie|monstre)|manque|absent|n'existe pas|undefined)/i.test(s) && /(nom|titre|slug|libell)/i.test(s)],
  ['texte-attendu', 'Un texte, un nom ou une règle écrits dans le test ne sont plus ceux du contenu', (s) => /(Texte factice|Nom factice)/.test(s) || /(expected|attendu).*(['"«][^'"»]{3,}['"»])/i.test(s)],
  ['comptage', 'Un nombre de lignes, de pages ou de liens attendu a changé', (s) => /(length|count|nombre|comptage|\d+ !== \d+|1169|expected: \d+)/i.test(s)],
  ['lien', 'Liens et balises : le contenu factice n\'en porte plus', (s) => /(lien|wikilink|balise|\[\[|href)/i.test(s)],
  ['recherche', 'Recherche plein texte ou fiche de personnage qui lit un texte', (s) => /(fts|recherche|search|fiche)/i.test(s)],
  ['construction', 'Construction du site ou script lancé par le test', (s) => /(build|astro|spawn|exit code|status|db-derive|db-build|python)/i.test(s)],
];

function signature(texte) {
  const lignes = texte.split('\n');
  const i = lignes.findIndex((l) => /^\s*✖|^not ok|failureType|^\s*error:/.test(l));
  const bloc = (i >= 0 ? lignes.slice(i, i + 14) : lignes.slice(-14)).join('\n');
  const premiere = bloc.split('\n').find((l) => /(Error|Assertion|expected|message|introuvable|rejected)/i.test(l)) ?? bloc.split('\n')[0];
  return { bloc: bloc.slice(0, 1500), premiere: premiere.trim().slice(0, 200) };
}

function lireLeJournal(passeNom, fichier) {
  const chemin = join(sortie, 'journaux', passeNom, `${fichier}.log`);
  return existsSync(chemin) ? readFileSync(chemin, 'utf8') : '';
}

export function trier() {
  const lire = (n) => new Map(JSON.parse(readFileSync(join(sortie, `passe-${n}.json`), 'utf8')).map((r) => [r.fichier, r]));
  const A = lire('A');
  const B = lire('B');
  const lignes = [];
  for (const fichier of fichiersDeTest()) {
    const a = A.get(fichier);
    const b = B.get(fichier);
    const m = marques(fichier);
    const reussi = (r) => r && r.code === 0;
    let categorie;
    if (!reussi(a)) categorie = 'casse-sur-le-vrai';
    else if (!reussi(b)) categorie = 'casse-sur-le-factice';
    else categorie = m.lit_contenu || m.lit_depot_direct ? 'passe-sur-les-deux' : 'ne-lit-pas-le-contenu';
    const ligne = { fichier, categorie, lit_contenu: m.lit_contenu, lit_depot_direct: m.lit_depot_direct, ms: (a?.ms ?? 0) + (b?.ms ?? 0) };
    if (categorie === 'casse-sur-le-factice' || categorie === 'casse-sur-le-vrai') {
      const passeNom = categorie === 'casse-sur-le-vrai' ? 'A' : 'B';
      const r = categorie === 'casse-sur-le-vrai' ? a : b;
      const s = signature(lireLeJournal(passeNom, fichier));
      const famille = FAMILLES.find(([, , test]) => test(s.bloc, r));
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
  writeFileSync(join(sortie, 'tri.json'), JSON.stringify({ bilan, fichiers: lignes, familles }, null, 1));
  const md = [
    '| Catégorie | Fichiers |', '| --- | ---: |', ...Object.entries(comptes).map(([k, v]) => `| ${k} | ${v} |`), `| **total** | ${lignes.length} |`, '',
    '| Famille de cause (sur le contenu factice) | Fichiers |', '| --- | ---: |', ...Object.entries(bilan.familles).map(([k, v]) => `| ${k} | ${v} |`), '',
  ].join('\n');
  writeFileSync(join(sortie, 'tri.md'), md);
  return bilan;
}

// ───────────────────────── commande ─────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const choisis = arg('--fichiers', null)?.split(',');
  const fichiers = choisis ?? fichiersDeTest();
  if (drapeau('--trier')) {
    console.log(JSON.stringify(trier(), null, 1));
  } else if (drapeau('--fabriquer')) {
    console.log(JSON.stringify(await fabriquerLesContenus(), null, 1));
  } else if (arg('--passe', null)) {
    const r = await passe(arg('--passe'), fichiers);
    console.log(`passe ${arg('--passe')} : ${r.filter((x) => x.code === 0).length}/${r.length} fichiers sans échec`);
  } else {
    console.log(JSON.stringify(await fabriquerLesContenus(), null, 1));
    for (const n of ['A', 'B']) {
      const r = await passe(n, fichiers);
      console.log(`passe ${n} : ${r.filter((x) => x.code === 0).length}/${r.length} fichiers sans échec`);
    }
    console.log(JSON.stringify(trier(), null, 1));
  }
}
