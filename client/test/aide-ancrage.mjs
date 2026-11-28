// Une petite base d'essai pour le calcul de l'ancrage (lib/mots-cles-ancrage.mjs, décision R309) : la structure de data/schema.sql, en mémoire, sans
// aucune ligne de contenu ; chaque test y pose ses pages, sorts et mots-clés, aux noms inventés. Les clés étrangères et les CHECK sont coupés : une ligne
// d'essai ne porte que ce que le calcul lit, les autres colonnes obligatoires prennent une valeur de remplissage.
// `appliquerEnSql` simule l'application d'un lot, en SQL, sur cette base : le vrai rejeu par le service est testé avec l'action (tâche 6 du chantier).
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { CATEGORIES_NOUVELLES } from '../src/lib/mots-cles-ancrage.mjs';
import { clesDesMotsCles } from '../src/lib/mots-cles-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';

const SCHEMA = fileURLToPath(new URL('../../data/schema.sql', import.meta.url));
const CODES_DES_TYPES = ['attaque', 'entrave', 'soin', 'amplification', 'placement', 'invocation', 'construction', 'protection', 'meteo', 'aleatoire'];
const CATEGORIES_EN_PLACE = ['Règles', 'Magie', 'Race', 'Combat', 'Fiche de personnage', 'Classe', 'Équipement', 'Événement', 'Métier', 'Bestiaire', 'Faction', 'Sort', 'Don', 'Dégâts', 'Alignement'];

/** Le premier id des mots-clés d'essai, loin des ids que citent TYPE_UNIQUE et REPRISES. */
const PREMIER_ID = 9001;

let remplissage = 0;

/** Insère une ligne : les colonnes obligatoires que `valeurs` ne donne pas prennent une valeur de remplissage, chaque fois différente (index UNIQUE). */
function inserer(db, table, valeurs) {
  const ligne = { ...valeurs };
  for (const c of db.prepare(`PRAGMA table_info("${table}")`).all()) {
    if (c.notnull && c.dflt_value === null && !(c.name in ligne)) ligne[c.name] = /INT/i.test(c.type) ? (remplissage += 1) : `essai-${(remplissage += 1)}`;
  }
  const colonnes = Object.keys(ligne);
  db.prepare(`INSERT INTO "${table}" (${colonnes.map((c) => `"${c}"`).join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...colonnes.map((c) => ligne[c]));
}

/** Une base d'essai vide : la structure, les dix codes de `type_sort` et des catégories (sans les quatre nouvelles). */
export function baseDAncrage() {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  db.exec(readFileSync(SCHEMA, 'utf8'));
  db.exec('PRAGMA ignore_check_constraints = ON');
  for (const id of CODES_DES_TYPES) db.prepare('INSERT INTO type_sort (id) VALUES (?)').run(id);
  CATEGORIES_EN_PLACE.forEach((libelle) => poserCategorie(db, libelle));
  return db;
}

/** L'id de la catégorie `libelle`, ou undefined. */
export const idDeCategorie = (db, libelle) => db.prepare('SELECT id FROM categorie_mot_cle WHERE libelle = ?').get(libelle)?.id;

function poserCategorie(db, libelle) {
  const id = db.prepare('SELECT coalesce(max(id), 0) + 1 AS n FROM categorie_mot_cle').get().n;
  db.prepare('INSERT INTO categorie_mot_cle (id, libelle, libelle_cle) VALUES (?, ?, ?)').run(id, libelle, normalize(libelle));
  return id;
}

/** Crée les quatre catégories de l'ancrage (sans elles, le plan ne rend que le lot 1). */
export const poserLesCategoriesNouvelles = (db) => CATEGORIES_NOUVELLES.forEach((libelle) => poserCategorie(db, libelle));

/** Un mot-clé : `categories` par libellé ; `id` : le suivant à partir de 9001 s'il n'est pas donné. Rend son id. */
export function poserMotCle(db, { id, libelle, url = null, categories = [], synonymes = [] }) {
  const numero = id ?? Math.max(PREMIER_ID - 1, db.prepare('SELECT coalesce(max(id), 0) AS n FROM mot_cle').get().n) + 1;
  db.prepare('INSERT INTO mot_cle (id, libelle, cle, url) VALUES (?, ?, ?, ?)').run(numero, libelle, `essai-${numero}`, url);
  for (const c of categories) db.prepare('INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (?, ?)').run(numero, idDeCategorie(db, c));
  synonymes.forEach((s, i) => inserer(db, 'mot_cle_synonyme', { id: numero * 100 + i, mot_cle_id: numero, libelle: s, libelle_cle: normalize(s), ordre: i + 1 }));
  return numero;
}

/** Une page (son type : ce qui précède le « / » de son id). */
export function poserPage(db, id, titre, { resume = null } = {}) {
  inserer(db, 'page', { id, type: id.split('/')[0], titre, resume, statut: 'draft' });
  return id;
}

/**
 * Une page que le service d'édition relit et réécrit (un renommage, R316) : son slug tiré de l'id, la clé de son titre et un corps, que poserPage laisse au
 * remplissage. Rend son id.
 */
export function poserPageLisible(db, id, titre, { corps = 'Texte.\n', resume = null } = {}) {
  poserPage(db, id, titre, { resume });
  db.prepare('UPDATE page SET slug = ?, titre_cle = ?, corps_md = ? WHERE id = ?').run(id.slice(id.indexOf('/') + 1), normalize(titre), corps, id);
  return id;
}

/** Le mot-clé ancré d'une page ou d'un sort : le nom et l'adresse de l'élément (sans segment renommé), ses catégories ; `verrou` : verrouillé. Rend son id. */
export function ancrerUnMotCle(db, table, id, { categories = [], verrou = false } = {}) {
  const nom = db.prepare(`SELECT ${table === 'page' ? 'titre' : 'nom'} AS nom FROM "${table}" WHERE id = ?`).get(id).nom;
  const motCle = poserMotCle(db, { libelle: nom, url: table === 'page' ? adresseDeLaPage(id, null) : adresseDuSort(id, null), categories });
  db.prepare(`UPDATE "${table}" SET mot_cle_id = ? WHERE id = ?`).run(motCle, id);
  if (verrou) db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(motCle);
  return motCle;
}

/** Une entité typée et sa page (même id) : `table` (metier, race, classe, capacite), ses colonnes en plus du nom ; `titre`, celui de la page. */
function poserElement(db, table, id, nom, { titre = nom, ...colonnes } = {}) {
  poserPageLisible(db, id, titre);
  inserer(db, table, { id, nom, ...colonnes });
  inserer(db, 'page_entite', { entite_table: table, entite_id: id, page_id: id, principale: 1 });
  return id;
}

/** Un métier et sa page : une ligne du tableau de /metiers/ (son adresse est une ancre). */
export const poserMetier = (db, id, nom) => poserElement(db, 'metier', id, nom, {
  nom_cle: normalize(nom), description: '', bonus_brut: '', artisanat_brut: '', equipement_brut: '', origine: 'docs_typees',
});

/** Une race et sa page. */
export const poserRace = (db, id, nom) => poserElement(db, 'race', id, nom);

/** Une classe et sa page : `titre`, celui de la page (son nom par défaut ; un autre : un titre retouché à la main) ; `categorie` (classe-champs.mjs#CATEGORIE_RACIALE : une classe raciale). */
export const poserClasse = (db, id, nom, { titre = nom, categorie = 'essai' } = {}) => poserElement(db, 'classe', id, nom, { titre, nom_cle: normalize(nom), categorie_id: categorie });

/** Un don de la classe `classe` et sa fiche « Nom (Classe) », de niveau `niveau` et de rang `rang`, seul sur sa ligne. */
export function poserCapacite(db, id, { classe, nom, niveau = 1, rang = 1 }) {
  const titre = `${nom} (${db.prepare('SELECT nom FROM classe WHERE id = ?').get(classe).nom})`;
  return poserElement(db, 'capacite', id, nom, { titre, classe_id: classe, niveau, rang, nature: 'classe', nom_cle: normalize(nom), type: 'passif', type_brut: 'Passif', origine: 'classes' });
}

/** Un onglet des Règles (son id est un nom réservé : /regles/<onglet>/). */
export function poserOnglet(db, id, titre) {
  inserer(db, 'regles_onglet', { id, titre });
  return id;
}

/** Une magie (sans page : le calcul lit son nom). */
export function poserMagie(db, id, nom, { mot_cle_id = null } = {}) {
  inserer(db, 'magie', { id, nom, mot_cle_id });
  return id;
}

/** Un sort de la magie `magieId`, de types `types` (codes de `type_sort`, écrits en libellé avec une majuscule). Rend son id. */
export function poserSort(db, magieId, nom, { effets = null, types = ['attaque'] } = {}) {
  const id = `${magieId}#sort:${normalize(nom)}`;
  inserer(db, 'sort', { id, magie_id: magieId, nom, nom_cle: normalize(nom), effets });
  types.forEach((type, i) => inserer(db, 'sort_type', { sort_id: id, rang: i + 1, type, libelle: type[0].toUpperCase() + type.slice(1), origine: 'magies', source_ref: 'essai' }));
  return id;
}

/** Sur un contenu ancré, une page créée sur le site reçoit son mot-clé (R309) : le retire de cette copie, pour un test qui parle d'une page sans mot-clé. Sans effet sur une base sans ancre. */
export function retirerLeMotCleDeLaPage(db, pageId) {
  const motCle = db.prepare('SELECT mot_cle_id AS id FROM page WHERE id = ?').get(pageId)?.id ?? null;
  if (motCle === null) return;
  db.prepare('UPDATE page SET mot_cle_id = NULL WHERE id = ?').run(pageId);
  db.prepare('DELETE FROM mot_cle_categorie WHERE mot_cle_id = ?').run(motCle);
  db.prepare('DELETE FROM mot_cle WHERE id = ?').run(motCle);
}

/** Les opérations de la famille `famille` du plan (vide si le lot est absent). */
export const operationsDe = (plan, famille) => plan.lots.find((l) => l.famille === famille)?.operations ?? [];

const donnees = (valeurs, numeros) => Object.fromEntries(Object.entries(valeurs ?? {}).map(([c, v]) => [c, v && typeof v === 'object' ? numeros.get(v.$numero) : v]));

function ecrire(db, table, cle, valeurs) {
  const colonnes = Object.keys(valeurs);
  const cles = Object.keys(cle);
  db.prepare(`UPDATE "${table}" SET ${colonnes.map((c) => `"${c}" = ?`).join(', ')} WHERE ${cles.map((c) => `"${c}" = ?`).join(' AND ')}`)
    .run(...colonnes.map((c) => valeurs[c]), ...cles.map((c) => cle[c]));
}

/**
 * Recalcule la clé de chaque mot-clé, comme le service en fin de lot (en deux passes : `mot_cle.cle` est unique). Dans une transaction quand l'appelant n'en a pas
 * ouvert : sur une base en fichier, une écriture par mot-clé validée une à une coûtait plusieurs secondes par fichier de test (B5 de la relecture R309).
 */
export function recalculerLesCles(db) {
  const motsCles = motsClesDeLaBase(db);
  const cles = clesDesMotsCles(motsCles, new Map(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle])));
  let ouvrir = true;
  try {
    db.exec('BEGIN');
  } catch (e) {
    if (!/within a transaction/.test(e.message)) throw e;
    ouvrir = false; // l'appelant tient déjà une transaction
  }
  try {
    const ecrire = db.prepare('UPDATE mot_cle SET cle = ? WHERE id = ?');
    for (const m of motsCles) ecrire.run(`provisoire-${m.id}`, m.id);
    for (const m of motsCles) ecrire.run(cles.get(m.id), m.id);
    if (ouvrir) db.exec('COMMIT');
  } catch (e) {
    if (ouvrir) db.exec('ROLLBACK');
    throw e;
  }
}

/**
 * Simule l'application d'un lot du plan, en SQL : numéros suivants, création, type et ancre, modifications, page de notion (la page, son mot-clé pour ancre,
 * l'adresse du mot-clé devenue la sienne), puis les clés recalculées.
 */
export function appliquerEnSql(db, lot) {
  const numeros = new Map();
  const suivant = (table) => db.prepare(`SELECT coalesce(max(id), 0) + 1 AS n FROM "${table}"`).get().n;
  for (const o of lot.operations) {
    if (o.table === 'page' && o.ancrage?.notion === true) {
      poserPage(db, o.apres.id, o.apres.titre);
      ecrire(db, 'page', { id: o.apres.id }, { mot_cle_id: o.apres.mot_cle_id });
      ecrire(db, 'mot_cle', { id: o.apres.mot_cle_id }, { url: adresseDeLaPage(o.apres.id, null) });
    } else if (o.operation === 'inserer' && o.table === 'categorie_mot_cle') {
      numeros.set(o.cle.id.$numero, poserCategorie(db, o.apres.libelle));
    } else if (o.operation === 'inserer' && o.table === 'mot_cle') {
      const id = Math.max(suivant('mot_cle'), PREMIER_ID);
      numeros.set(o.cle.id.$numero, id);
      db.prepare('INSERT INTO mot_cle (id, libelle, cle, url) VALUES (?, ?, ?, ?)').run(id, o.apres.libelle, `provisoire-${id}`, o.apres.url ?? null);
      db.prepare('INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (?, ?)').run(id, o.ancrage.type);
      ecrire(db, o.ancrage.table, { id: o.ancrage.id }, { mot_cle_id: id });
    } else if (o.operation === 'inserer') {
      const { mot_cle_id, categorie_id } = donnees(o.apres, numeros);
      db.prepare('INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (?, ?)').run(mot_cle_id, categorie_id);
    } else if (o.operation === 'supprimer') {
      db.prepare('DELETE FROM mot_cle_categorie WHERE mot_cle_id = ? AND categorie_id = ?').run(o.cle.mot_cle_id, o.cle.categorie_id);
    } else {
      ecrire(db, o.table, o.cle, o.apres);
    }
  }
  recalculerLesCles(db);
}
