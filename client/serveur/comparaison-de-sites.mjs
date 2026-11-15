// Comparaison de deux sites fabriqués, fichier par fichier (lot 9 du chantier de la base de dev ; docs/serveur.md, « Fabriquer le site depuis un fichier de
// contenu ») : le site témoin fabriqué depuis l'extrait du contenu (scripts/fabriquer-depuis-contenu.mjs) contre le site que GitHub a livré. Module pur
// (node:fs, node:crypto, serveur/empreintes.mjs), sans rien d'écrit : `scripts/comparer-sites.mjs` en est la ligne de commande, la page Debug en lira le JSON.
//
// Rapport (FORMAT_COMPARAISON) : pour chaque fichier, son chemin relatif (« / ») et l'empreinte sha256 de ses octets ; quatre catégories de base — identiques,
// différents, seulement dans A, seulement dans B — plus une catégorie à part, `variables`, pour ce que la fabrication fait varier d'elle-même sans que le
// contenu change. Un fichier n'y entre que si une règle l'explique ET que ce qu'il contient est identique de l'autre côté : une règle ne cache jamais une
// vraie différence. Les listes sont plafonnées (`exemples`), les nombres sont exacts. `equivalents` : ni fichier différent ni fichier absent d'un côté.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CLASSES_DE_TABLES } from '../src/lib/tables-de-la-base.mjs';
import { empreinteDeLaTable, empreintesDuContenu, tablesDeLaBase } from './empreintes.mjs';

export const FORMAT_COMPARAISON = 'maverick-comparaison/1';
export const EXEMPLES_PAR_DEFAUT = 20;

const sha256 = (octets) => createHash('sha256').update(octets).digest('hex');

/** Les fichiers ordinaires d'un dossier, récursivement : { rel (« / »), octets, chemin }, triés par chemin relatif. Un lien symbolique ou un fichier spécial n'est pas suivi. */
export function parcourir(dossier) {
  const sortie = [];
  const aller = (relatif) => {
    for (const entree of readdirSync(join(dossier, relatif), { withFileTypes: true })) {
      const rel = relatif ? `${relatif}/${entree.name}` : entree.name;
      const chemin = join(dossier, rel);
      if (entree.isDirectory()) aller(rel);
      else if (entree.isFile()) sortie.push({ rel, octets: lstatSync(chemin).size, chemin });
    }
  };
  aller('');
  return sortie.sort((x, y) => (x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0));
}

/** Le nombre de fichiers et d'octets d'un dossier (sans lire les fichiers). */
export function tailleDuDossier(dossier) {
  const fichiers = parcourir(dossier);
  return { fichiers: fichiers.length, octets: fichiers.reduce((somme, f) => somme + f.octets, 0) };
}

/** Map chemin relatif -> { octets, sha256, chemin }. */
export function listerLesFichiers(dossier) {
  return new Map(parcourir(dossier).map((f) => [f.rel, { octets: f.octets, sha256: sha256(readFileSync(f.chemin)), chemin: f.chemin }]));
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Ce que la fabrication fait varier d'elle-même
// ---------------------------------------------------------------------------------------------------------------------------------------------
// Établi en fabriquant deux fois le même extrait (docs/serveur.md) : les deux sites sont identiques octet pour octet ; ni les noms
// d'assets à empreinte (ils suivent le contenu), ni aucune date n'y varient. Ne varient que deux choses, quand on compare un site fabriqué depuis un extrait au
// site que GitHub a livré depuis data/rows :
//   - le fichier de la base publiée (donnees/maverick.db, ce fichier seul) : mêmes lignes, mais une autre forme de fichier (la vue extrait_meta de l'extrait, sa date, la
//     disposition des pages) — on compare alors ce qu'il contient (lignes de contenu et tables calculées), jamais ses octets ;
//   - la base de référence de la production (donnees/reference.db et .json), lue dans git (master) : un kit sans git n'en fabrique pas.
// Rien d'autre n'entre ici sans une mesure : une règle ne cache jamais une vraie différence.

/** Les tables calculées que le site publie avec sa base : leur contenu compte aussi (liens, recherche plein texte). */
const TABLES_PUBLIEES = Object.freeze(['lien', 'lien_candidat', 'page_fts', 'entite_fts']);

/**
 * Les empreintes d'une base SQLite : { contenu (empreinte globale), calculees: { table: empreinte }, propres: { table: { lignes, empreinte } } }, ou null si elle ne se lit pas.
 * `propres` : les tables propres au site (fiches, comptes, journal) et celles que le classement ne connaît pas.
 */
export function empreintesDeLaBase(chemin) {
  let db;
  try {
    db = new DatabaseSync(chemin, { readOnly: true });
    const presentes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name));
    const calculees = {};
    for (const t of TABLES_PUBLIEES) if (presentes.has(t)) calculees[t] = empreinteDeLaTable(db, t).empreinte;
    const propres = {};
    for (const { nom, classe } of tablesDeLaBase(db)) {
      if (classe === CLASSES_DE_TABLES.CONTENU || classe === CLASSES_DE_TABLES.CALCULEE) continue;
      propres[nom] = empreinteDeLaTable(db, nom);
    }
    return { contenu: empreintesDuContenu(db).global, calculees, propres };
  } catch {
    return null;
  } finally {
    try { db?.close(); } catch { /* déjà fermée */ }
  }
}

/** Les tables propres au site de deux bases : les mêmes lignes, ou aucune ligne des deux côtés (l'extrait en garde les tables, vides). */
function memesTablesPropres(x, y) {
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].every((t) => (x[t]?.lignes ?? 0) === 0 && (y[t]?.lignes ?? 0) === 0 || x[t]?.empreinte === y[t]?.empreinte);
}

/**
 * Les règles sur deux fichiers présents des deux côtés et différents : la cause d'une variation, ou null. Une seule règle : la base publiée `donnees/maverick.db`,
 * quand ses lignes de contenu, ses tables calculées et ses tables propres au site (identiques ou vides des deux côtés) sont les mêmes.
 */
export const BASE_PUBLIEE = 'donnees/maverick.db';
const CAUSE_SQLITE = 'base publiée : mêmes lignes de contenu, mêmes tables calculées, aucune donnée propre au site d’un seul côté, autre forme de fichier (vue extrait_meta, disposition des pages)';
function causeDeVariation(rel, a, b) {
  if (rel !== BASE_PUBLIEE) return null;
  const x = empreintesDeLaBase(a.chemin);
  const y = empreintesDeLaBase(b.chemin);
  return x && y && x.contenu === y.contenu && JSON.stringify(x.calculees) === JSON.stringify(y.calculees) && memesTablesPropres(x.propres, y.propres) ? CAUSE_SQLITE : null;
}

/** Les règles sur un fichier qu'un seul côté porte : la cause d'une absence attendue, ou null. */
const REFERENCE = /^donnees\/reference\.(?:db|json)$/;
const CAUSE_REFERENCE = 'base de référence de la production (construite depuis master dans git : un kit sans git n’en fabrique pas)';
const causeDAbsence = (rel) => (REFERENCE.test(rel) ? CAUSE_REFERENCE : null);

/**
 * Compare deux dossiers de sites fabriqués. Rapport : voir l'en-tête du module.
 * @param {string} a @param {string} b @param {{ exemples?: number }} [options] `exemples` : le plafond de chaque liste
 */
export function comparerSites(a, b, { exemples = EXEMPLES_PAR_DEFAUT } = {}) {
  const fichiersA = listerLesFichiers(a);
  const fichiersB = listerLesFichiers(b);
  const rapport = {
    format: FORMAT_COMPARAISON,
    a: { fichiers: fichiersA.size, octets: [...fichiersA.values()].reduce((s, f) => s + f.octets, 0) },
    b: { fichiers: fichiersB.size, octets: [...fichiersB.values()].reduce((s, f) => s + f.octets, 0) },
    identiques: 0,
    differents: { nombre: 0, exemples: [] },
    seulement_a: { nombre: 0, exemples: [] },
    seulement_b: { nombre: 0, exemples: [] },
    variables: { nombre: 0, par_cause: {}, exemples: [] },
    equivalents: false,
  };
  const noter = (categorie, element) => {
    categorie.nombre += 1;
    if (categorie.exemples.length < exemples) categorie.exemples.push(element);
  };
  const variable = (fichier, cause) => {
    rapport.variables.par_cause[cause] = (rapport.variables.par_cause[cause] ?? 0) + 1;
    noter(rapport.variables, { fichier, cause });
  };
  const absent = (categorie, rel, f) => {
    const cause = causeDAbsence(rel);
    if (cause) variable(rel, cause);
    else noter(categorie, { fichier: rel, octets: f.octets });
  };

  for (const [rel, fa] of fichiersA) {
    const fb = fichiersB.get(rel);
    if (!fb) { absent(rapport.seulement_a, rel, fa); continue; }
    if (fa.sha256 === fb.sha256) { rapport.identiques += 1; continue; }
    const cause = causeDeVariation(rel, fa, fb);
    if (cause) variable(rel, cause);
    else noter(rapport.differents, { fichier: rel, octets_a: fa.octets, octets_b: fb.octets });
  }
  for (const [rel, fb] of fichiersB) if (!fichiersA.has(rel)) absent(rapport.seulement_b, rel, fb);
  rapport.equivalents = rapport.differents.nombre === 0 && rapport.seulement_a.nombre === 0 && rapport.seulement_b.nombre === 0;
  return rapport;
}
