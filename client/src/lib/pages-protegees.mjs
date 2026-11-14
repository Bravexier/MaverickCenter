// Les pages des Règles qu'on ne supprime pas (lot de l'édition des menus et des pages, demande du propriétaire : « En mode Edition il faut prévoir aussi
// de pouvoir ajouter / supprimer une page », réponse « Pages protégées » : pas de bouton « Supprimer » sur une page dont le site ou d'autres données ont
// besoin, et le service la refuse en disant pourquoi). La SEULE source de cette protection : le service d'édition la lit avant toute suppression
// (serveur/edition-plan.mjs, et serveur/edition.mjs#supprimerPage pour toute page `guide/…`), la route GET /api/edition/plan/ la donne à la page.
// Une page est protégée quand :
//   - une ligne d'une autre table la cite par une clé étrangère sans cascade (lue par PRAGMA foreign_key_list : page_entite, regle_constante,
//     mode_texte, panneau_regles…) — sauf evenement_extrait.page_id, une citation (lib/citations-db.mjs), et regles_onglet_entree (son entrée de
//     menu, ON DELETE CASCADE, que le service retire lui-même) ;
//   - elle n'est pas de la famille `docs` (page.origine : une page tirée d'un classeur, famille « annexes », que l'import referait) ;
//   - elle ouvre un onglet des Règles (regles_onglet.ouverture_page_id : l'ordre des onglets et leur ouverture sont fixes, réponse « Non, fixe ») ;
//   - le plan du site la nomme (lib/livres.mjs) : la création du personnage (PAGES_DE_LA_CREATION), une carte « Par où commencer ? » de l'accueil
//     (PAR_OU_COMMENCER), une page qui en absorbe une autre (PAGES_ABSORBEES), une page sous laquelle le gabarit pose des rubriques
//     (RUBRIQUES_SOUS_LA_PAGE). La cible d'un renvoi d'une ancienne adresse (ADRESSES_DU_PLAN_PRECEDENT, PAGES_ECLATEES_DU_GUIDE) n'est PAS protégée
//     (choix du leader-technique) : supprimée, son ancienne adresse mène à la 404 comme toute page supprimée (R185, P6) ;
//   - le code la lit (PAGES_LUES_PAR_LE_CODE, ci-dessous ; test/pages-protegees.test.mjs relève tout « 'guide/… » écrit dans client/src/) ;
//   - elle porte un bloc tiré de la base (`<!-- guide:… -->`, lib/guide.mjs#BLOCS).
// Pur, sans dépendance navigateur ni Astro : la base est passée par l'appelant (la base vivante du service, une copie dans les tests).
import { nomDeTable } from './libelles-de-la-base.mjs';
import { PAGES_ABSORBEES, PAGES_DE_LA_CREATION, PAR_OU_COMMENCER, RUBRIQUES_SOUS_LA_PAGE } from './livres.mjs';

/**
 * Les pages du guide dont le code lit le texte, une section ou l'identifiant (page → qui la lit). Une page ajoutée au code s'ajoute ici : le test
 * garde-fou (test/pages-protegees.test.mjs) refuse un « 'guide/<slug>' » écrit dans client/src/ hors de lib/livres.mjs (ses listes sont lues plus
 * haut) qui ne serait pas dans cette liste, sauf une adresse d'avant qui n'est plus une page de la base. Les ids des postures (guide/postures#posture:…,
 * identifiants figés) gardent le préfixe d'une page supprimée le 2026-11-06 (migration 0094, lib/livres.mjs#PAGES_SUPPRIMEES) : ce ne sont plus une page.
 */
export const PAGES_LUES_PAR_LE_CODE = Object.freeze({
  'guide/l-equipement': 'lib/ceinture-db.mjs lit sa section « La ceinture » (onglet Ceinture de l’équipement)',
  'guide/fiche-inventaire-sac-a-dos': 'lib/ceinture-db.mjs lit sa section « Ceinture » (onglet Ceinture de l’équipement ; R272)',
  'guide/s-entrainer-et-exercer-un-metier': 'lib/fiche-regles.mjs y renvoie l’aide du champ « Entraînement » de la fiche (décision R71)',
  'guide/le-mode-hyper': 'les pages des magies et des races y renvoient sous « Capacité Mode Hyper » (décision R187)',
});

/** Les tables dont une clé étrangère vers `page` n'est pas une protection : une citation (lib/citations-db.mjs), l'entrée de menu de la page. */
const CLES_QUI_NE_PROTEGENT_PAS = new Set(['evenement_extrait', 'regles_onglet_entree']);

const cles = new WeakMap(); // db -> [{ table, colonnes }]
/** Les clés étrangères sans cascade vers `page` (PRAGMA foreign_key_list de chaque table ; noms vérifiés : ceux de sqlite_master). */
function clesVersLesPages(db) {
  if (cles.has(db)) return cles.get(db);
  const sortie = [];
  for (const { name: table } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    if (CLES_QUI_NE_PROTEGENT_PAS.has(table) || !/^[a-z0-9_]+$/.test(table)) continue;
    let liens;
    try {
      liens = db.prepare(`PRAGMA foreign_key_list("${table}")`).all();
    } catch {
      continue; // table virtuelle
    }
    const parId = new Map();
    for (const f of liens) {
      if (f.table !== 'page' || ['CASCADE', 'SET NULL'].includes(String(f.on_delete).toUpperCase())) continue;
      if (!parId.has(f.id)) parId.set(f.id, []);
      parId.get(f.id).push(f);
    }
    for (const colonnes of parId.values()) {
      // une clé vers page(id) (toutes le sont : la clé primaire de page est son id)
      if (colonnes.length === 1 && (colonnes[0].to ?? 'id') === 'id') sortie.push({ table, colonne: colonnes[0].from });
    }
  }
  cles.set(db, sortie);
  return sortie;
}

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));

/**
 * Les raisons qui protègent la page `id` d'une suppression : [{ raison, texte, … }] (vide : rien ne la protège ; une page absente : vide aussi).
 * `raison` : 'cle_etrangere' (`table`, `colonne`, `lignes` : le nombre de lignes qui la citent), 'famille' (`origine`), 'ouverture' (`onglet`),
 * 'creation', 'accueil', 'absorbe' (`absorbee` : la page qu'elle a reçue), 'rubriques', 'code', 'bloc' (`bloc`) ; `texte` : la raison en
 * français, pour la page et le refus du service.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} id
 */
export function raisonsDeProtection(db, id) {
  const page = typeof id === 'string' ? db.prepare('SELECT id, titre, origine, corps_md FROM page WHERE id = ?').get(id) : null;
  if (!page) return [];
  const raisons = [];
  for (const { table, colonne } of clesVersLesPages(db)) {
    const n = db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE "${colonne}" = ?`).get(id).n;
    if (n) raisons.push({ raison: 'cle_etrangere', table, colonne, lignes: n, texte: `citée par ${n} ligne${n > 1 ? 's' : ''} de « ${nomDeTable(table) ?? table} »` });
  }
  if (page.origine !== 'docs') {
    raisons.push({ raison: 'famille', origine: page.origine, texte: `tirée d’un classeur (famille « ${page.origine} ») : l’import la referait` });
  }
  if (tableExiste(db, 'regles_onglet')) {
    for (const o of db.prepare('SELECT id, titre FROM regles_onglet WHERE ouverture_page_id = ? ORDER BY ordre, id').all(id)) {
      raisons.push({ raison: 'ouverture', onglet: o.id, texte: `page d’ouverture de l’onglet « ${o.titre} »` });
    }
  }
  if (PAGES_DE_LA_CREATION.pages.includes(id)) raisons.push({ raison: 'creation', texte: 'une des pages de la création du personnage (lib/livres.mjs)' });
  if (PAR_OU_COMMENCER.includes(id)) raisons.push({ raison: 'accueil', texte: 'une carte « Par où commencer ? » de l’accueil y mène' });
  for (const [absorbee, absorbante] of Object.entries(PAGES_ABSORBEES)) {
    if (absorbante === id) raisons.push({ raison: 'absorbe', absorbee, texte: `elle a reçu le contenu de ${absorbee}, dont l’ancienne adresse mène ici` });
  }
  if (Object.hasOwn(RUBRIQUES_SOUS_LA_PAGE, id)) raisons.push({ raison: 'rubriques', texte: 'le site pose sous elle les rubriques qu’elle présente' });
  if (Object.hasOwn(PAGES_LUES_PAR_LE_CODE, id)) raisons.push({ raison: 'code', texte: `le code la lit : ${PAGES_LUES_PAR_LE_CODE[id]}` });
  for (const m of String(page.corps_md ?? '').matchAll(/<!--\s*guide:([a-z0-9-]+)\s*-->/g)) {
    raisons.push({ raison: 'bloc', bloc: m[1], texte: `elle porte le bloc « ${m[1]} », tiré de la base` });
  }
  return raisons;
}
