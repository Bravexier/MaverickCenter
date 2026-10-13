// Explorateur de données : lit la base SQLite (data/schema.sql + data/rows, voir docs/sql/remplissage.md) et prépare, pour le site, la liste des tables et les lignes
// de chacune, avec les liens entre tables (clés étrangères) et vers les pages du wiki (page_entite). Node seulement : utilisé au BUILD par `src/pages/donnees/`.
//
// La base est construite par les scripts `client/scripts/db-build.mjs` puis `db-derive.mjs` (les mêmes que `npm run db:build`) dans un dossier temporaire : le build
// du site n'a besoin d'aucune étape préalable. `HIDE_EXAMPLES=1` retire les pages d'exemple, comme pour le reste du site.
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireSchema } from './schema-doc.mjs';

/** Racine du dépôt (celle qui contient data/schema.sql) : variable MAVERICK_ROOT, sinon on remonte depuis le dossier courant (le build tourne dans client/). */
export function trouverRacine() {
  const candidats = [process.env.MAVERICK_ROOT, process.cwd(), fileURLToPath(new URL('../../../', import.meta.url))].filter(Boolean);
  for (const depart of candidats) {
    for (let d = resolve(depart); ; d = dirname(d)) {
      if (existsSync(join(d, 'data', 'schema.sql')) && existsSync(join(d, 'data', 'rows'))) return d;
      if (dirname(d) === d) break;
    }
  }
  throw new Error('data/schema.sql introuvable : lancer le build depuis client/ (ou définir MAVERICK_ROOT)');
}

const caches = (globalThis.__maverickDonnees ??= { bases: new Map(), nettoyage: false });

/** Ouvre (en lecture seule) la base reconstruite depuis data/rows. Une seule construction par processus et par variante. */
export function ouvrirBase({ sansExemples = process.env.HIDE_EXAMPLES === '1' } = {}) {
  const cle = sansExemples ? 'sans-exemples' : 'complete';
  if (caches.bases.has(cle)) return caches.bases.get(cle).db;
  const racine = trouverRacine();
  const dossier = mkdtempSync(join(tmpdir(), 'maverick-donnees-'));
  const fichier = join(dossier, 'maverick.db');
  const lancer = (script, args) => {
    const r = spawnSync(process.execPath, ['--no-warnings', join(racine, 'client', 'scripts', script), ...args], { encoding: 'utf8', cwd: racine });
    if (r.status !== 0) throw new Error(`${script} a échoué : ${r.stderr || r.stdout}`);
  };
  lancer('db-build.mjs', ['--out', fichier]);
  lancer('db-derive.mjs', [fichier, ...(sansExemples ? ['--sans-exemples'] : [])]);
  const db = new DatabaseSync(fichier, { readOnly: true });
  caches.bases.set(cle, { db, dossier });
  if (!caches.nettoyage) {
    caches.nettoyage = true;
    process.on('exit', () => { for (const { dossier: d } of caches.bases.values()) rmSync(d, { recursive: true, force: true }); });
  }
  return db;
}

/** Chemin du fichier SQLite construit (celui que lit l'explorateur) : publié tel quel sur /donnees/maverick.db pour le déboguer avec un outil externe. */
export function cheminBase(options) {
  ouvrirBase(options);
  const cle = (options?.sansExemples ?? process.env.HIDE_EXAMPLES === '1') ? 'sans-exemples' : 'complete';
  return join(caches.bases.get(cle).dossier, 'maverick.db');
}

/** Ancre HTML d'une ligne : déterministe, sans collision (tout caractère hors [A-Za-z0-9-] est échappé par son code entre « _ », « _ » compris), identique côté lien et côté ligne. */
export function ancre(valeursCle) {
  return 'r-' + valeursCle.map((v) => String(v).replace(/[^A-Za-z0-9-]/g, (c) => `_${c.codePointAt(0).toString(16)}_`)).join('.');
}

/**
 * Colonnes qu'on résume au lieu de les afficher en entier : le texte intégral d'une page est dans le wiki, un portrait (data URL de 700 000 caractères au
 * plus, migration 0033) sur la carte de son monstre.
 */
const RESUMEES = {
  page: { corps_md: 'corps_md_caracteres' },
  monstre: { portrait: 'portrait_caracteres' },
  monstre_espece: { portrait: 'portrait_caracteres' },
};

const premiereFrase = (t) => {
  const m = /^(.{20,220}?[.!?])(\s|$)/.exec(t ?? '');
  return (m ? m[1] : (t ?? '').slice(0, 200)).trim();
};

/** Sections et objets explorables (tables et vues du schéma, hors tables de recherche plein texte), avec leur nombre de lignes. */
export function lister(db = ouvrirBase()) {
  const sections = lireSchema(readFileSync(join(trouverRacine(), 'data', 'schema.sql'), 'utf8'));
  return sections
    .map((s) => ({
      titre: s.titre,
      numero: s.titre.split('.')[0],
      objets: s.objets
        .filter((o) => !o.genre.startsWith('table de recherche'))
        .map((o) => ({
          nom: o.nom,
          genre: o.genre,
          derivee: o.derivee,
          description: premiereFrase(o.description),
          nbLignes: db.prepare(`SELECT count(*) AS n FROM "${o.nom}"`).get().n,
        })),
    }))
    .filter((s) => s.objets.length);
}

function descriptionsDeColonnes(nom) {
  const sections = lireSchema(readFileSync(join(trouverRacine(), 'data', 'schema.sql'), 'utf8'));
  for (const s of sections) for (const o of s.objets) if (o.nom === nom) return { objet: o, notes: o.colonnes };
  return { objet: null, notes: new Map() };
}

/** Pages du wiki rattachées à une entité typée : Map « table:id » -> id de page (la page principale d'abord). */
function pagesParEntite(db) {
  const m = new Map();
  for (const r of db.prepare('SELECT entite_table, entite_id, page_id, principale FROM page_entite ORDER BY principale DESC').all()) {
    const k = `${r.entite_table}:${r.entite_id}`;
    if (!m.has(k)) m.set(k, r.page_id);
  }
  return m;
}

function clePrimaire(db, nom) {
  return db.prepare(`PRAGMA table_info("${nom}")`).all().filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
}

/** Pour une table : colonnes (type, clé, vers quelle table), lignes triées par clé, avec ancre, lien vers la page du wiki et liens des clés étrangères. */
export function preparerTable(db, nom) {
  const { objet, notes } = descriptionsDeColonnes(nom);
  if (!objet) throw new Error(`objet inconnu du schéma : ${nom}`);
  const infos = db.prepare(`PRAGMA table_info("${nom}")`).all();
  const cle = clePrimaire(db, nom);
  const resumees = RESUMEES[nom] ?? {};

  // clés étrangères à une colonne qui visent la clé primaire à une colonne de la table cible : seules celles-là deviennent des liens
  const liens = new Map();
  if (objet.genre === 'table') {
    const groupes = new Map();
    for (const f of db.prepare(`PRAGMA foreign_key_list("${nom}")`).all()) (groupes.get(f.id) ?? groupes.set(f.id, []).get(f.id)).push(f);
    for (const g of groupes.values()) {
      if (g.length !== 1 || g[0].table === 'famille') continue;
      const cibleCle = clePrimaire(db, g[0].table);
      if (cibleCle.length === 1 && (g[0].to ?? cibleCle[0]) === cibleCle[0]) liens.set(g[0].from, g[0].table);
    }
  }

  const colonnes = infos.map((c) => ({
    nom: resumees[c.name] ?? c.name,
    type: c.type || '',
    cle: c.pk > 0,
    vers: liens.get(c.name) ?? null,
    note: notes.get(c.name) ?? '',
  }));
  const selection = infos.map((c) => (resumees[c.name] ? `length("${c.name}") AS "${resumees[c.name]}"` : `"${c.name}"`)).join(', ');
  const tri = cle.length ? ` ORDER BY ${cle.map((c) => `"${c}"`).join(', ')}` : '';
  const pages = pagesParEntite(db);
  const lignes = db.prepare(`SELECT ${selection} FROM "${nom}"${tri}`).all().map((r) => {
    const valeurs = Object.values(r);
    const valeurCle = cle.map((c) => r[c]);
    let page = null;
    if (nom === 'page') page = r.id;
    else if (cle.length === 1) page = pages.get(`${nom}:${valeurCle[0]}`) ?? null;
    return {
      ancre: cle.length ? ancre(valeurCle) : null,
      page,
      cellules: valeurs.map((v, i) => {
        if (v === null) return { nul: true };
        const cible = liens.get(infos[i].name);
        return cible ? { t: String(v), lien: { table: cible, ancre: ancre([v]) } } : { t: String(v) };
      }),
    };
  });
  return {
    nom,
    genre: objet.genre,
    derivee: objet.derivee,
    description: objet.description,
    colonnes,
    lignes,
  };
}
