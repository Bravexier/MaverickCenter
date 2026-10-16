// Base vivante du service (client/serveur/base-vivante.mjs, docs/serveur.md) : copie de la base des règles publiée par le site, où le service
// écrit les fiches (section 13 de data/schema.sql). Quand les règles changent, elle est refaite et ses lignes reprises ; un don, une spécialité, un
// sort ou un métier disparu est retiré des fiches avec une note datée (décision R42) ; une colonne que les règles ont retirée exprès (COLONNES_RETIREES :
// le statut des fiches, migration 0038) se perd ; une table que les règles ont retirée (TABLES_RETIREES : les gains de niveau par niveau, migration
// 0045) est convertie (CONVERSIONS), jamais perdue sans le dire ; si une autre ligne ne passe pas (race, classe, magie…, colonne, contrainte), rien ne
// change et l'erreur dit pourquoi. Tout se passe dans des dossiers temporaires, à partir de la base construite depuis data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import {
  ARCHIVES_GARDEES, DOSSIER_ARCHIVES, ErreurBaseVivante, FICHIER_BASE, FICHIER_ETAT, TABLES_EDITION, TABLES_FICHES, TABLES_VIVANTES, clesRompues, empreinteFichier, lireEtat,
  ouvrirBaseVivante, preparerBaseVivante,
} from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { lireFiche, listerFiches } from '../serveur/fiches.mjs';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';
import { COLONNES_RETIREES, TABLES_RETIREES, gainsDeLaProgression } from '../src/lib/fiche-format.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-vivante-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const REGLES = cheminBase({ sansExemples: false });
const INSTANT = '2026-10-10T12:00:00Z';

let compteur = 0;
const nouveau = (prefixe) => join(racine, `${prefixe}-${(compteur += 1)}`);
/** Copie des règles modifiée par `sql` (clés étrangères non contrôlées : seules celles de la section 13 comptent ici) : une « nouvelle livraison ». */
function regles(sql = '') {
  const f = `${nouveau('regles')}.db`;
  copyFileSync(REGLES, f);
  if (sql) {
    const db = new DatabaseSync(f, { enableForeignKeyConstraints: false });
    db.exec(sql);
    db.close();
  }
  return f;
}
const lecture = (f) => new DatabaseSync(f, { readOnly: true });
function valeur(f, sql, ...params) {
  const db = lecture(f);
  try {
    return db.prepare(sql).get(...params);
  } finally {
    db.close();
  }
}
const UN_METIER = valeur(REGLES, 'SELECT id FROM metier ORDER BY id LIMIT 1').id;
const UN_SORT_DE_FEU = valeur(REGLES, "SELECT id FROM sort WHERE magie_id = 'magies/magie-du-feu' ORDER BY id LIMIT 1").id;

/** Un utilisateur MJ, un prétiré complet (classe, caractéristique, sort, sac), la fiche d'un joueur inscrite dans un groupe. */
function remplir(chemin) {
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  const inserer = (t, l) => db.prepare(`INSERT INTO ${t} (${Object.keys(l).join(', ')}) VALUES (${Object.keys(l).map(() => '?').join(', ')})`).run(...Object.values(l));
  const fiche = { visibilite: 'tous', race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu',
    mode_classe: 'mono', xp: 250, alignement_loyal: 1, alignement_chaotique: 0, alignement_bon: 2, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 12, bourse_rf: 3,
    ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT };
  inserer('utilisateur', { id: 'u1', discord_id: '123456789', nom_affichage: 'Alice', cree_le: INSTANT });
  inserer('utilisateur_role', { utilisateur_id: 'u1', role: 'mj' });
  inserer('personnage', { ...fiche, id: 'p1', nature: 'pretire', nom: 'Aldric', surnom: 'le Brave', metier_id: UN_METIER });
  inserer('personnage', { ...fiche, id: 'p2', nature: 'joueur', proprietaire_id: 'u1', visibilite: 'privee', nom: 'Brune' });
  inserer('personnage_classe', { personnage_id: 'p1', rang: 1, classe_id: 'classes/guerrier' });
  inserer('personnage_caracteristique', { personnage_id: 'p1', caracteristique_id: 'force', base: 4, croix: 1 });
  inserer('personnage_sort', { personnage_id: 'p1', sort_id: UN_SORT_DE_FEU, rang: 1, niveau_maitrise: 0 });
  inserer('personnage_inventaire', { personnage_id: 'p1', rang: 1, nom: 'Corde', quantite: 2 });
  inserer('groupe', { id: 'g1', nom: 'La campagne', nature: 'campagne', cree_le: INSTANT });
  inserer('groupe_membre', { groupe_id: 'g1', utilisateur_id: 'u1', role: 'joueur', personnage_id: 'p2', rejoint_le: INSTANT });
  db.close();
}
/** Toutes les lignes de la section 13, triées : ce qui doit survivre à un changement de règles. */
function lignesVivantes(chemin) {
  const db = lecture(chemin);
  try {
    return Object.fromEntries(TABLES_VIVANTES.map((t) => [t, db.prepare(`SELECT * FROM "${t}"`).all().map((r) => JSON.stringify(r)).sort()]));
  } finally {
    db.close();
  }
}
const sansArchives = (dossier) => readdirSync(dossier).filter((f) => f !== DOSSIER_ARCHIVES).sort();

test('TABLES_VIVANTES : exactement les tables des sections 13 (fiches) puis 14 (journal des modifications) de data/schema.sql, chacune après les tables qu’elle cite', () => {
  const schema = readFileSync(join(trouverRacine(), 'data', 'schema.sql'), 'utf8');
  const debut13 = schema.indexOf('-- 13. PERSONNAGES');
  const debut14 = schema.indexOf('-- 14. ÉDITION');
  const debut15 = schema.indexOf('-- 15. NOTES DE VERSION');
  assert.ok(debut13 > 0 && debut14 > debut13 && debut15 > debut14, 'sections 13, 14 et 15 trouvées');
  const tables = (texte) => [...texte.matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(tables(schema.slice(debut13, debut14)), [...TABLES_FICHES]);
  assert.deepEqual(tables(schema.slice(debut14, debut15)), [...TABLES_EDITION]);
  assert.deepEqual([...TABLES_VIVANTES], [...TABLES_FICHES, ...TABLES_EDITION]);
  const db = lecture(REGLES);
  for (const [i, t] of TABLES_VIVANTES.entries()) {
    for (const f of db.prepare(`PRAGMA foreign_key_list("${t}")`).all()) {
      if (TABLES_VIVANTES.includes(f.table)) assert.ok(TABLES_VIVANTES.indexOf(f.table) < i, `${t} cite ${f.table}, qui doit venir avant`);
    }
  }
  db.close();
});

test('première préparation : copie des règles, empreinte et schéma notés, section 13 vide ; rien à refaire ensuite', () => {
  const dossier = nouveau('db');
  const r = preparerBaseVivante({ regles: REGLES, dossier });
  assert.equal(r.refaite, true);
  assert.equal(r.archive, null);
  assert.equal(r.chemin, join(dossier, FICHIER_BASE));
  assert.equal(r.empreinte, empreinteFichier(REGLES));
  assert.equal(r.schema, valeur(REGLES, 'PRAGMA user_version').user_version);
  assert.deepEqual(lireEtat(dossier), { regles: r.empreinte, schema: r.schema, refaite_le: lireEtat(dossier).refaite_le });
  assert.match(lireEtat(dossier).refaite_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(valeur(r.chemin, 'SELECT count(*) AS n FROM race').n, valeur(REGLES, 'SELECT count(*) AS n FROM race').n);
  for (const t of TABLES_VIVANTES) assert.equal(valeur(r.chemin, `SELECT count(*) AS n FROM "${t}"`).n, 0, t);
  assert.deepEqual(sansArchives(dossier), [FICHIER_BASE, FICHIER_ETAT], 'aucun fichier provisoire laissé');

  const inode = statSync(r.chemin).ino;
  const encore = preparerBaseVivante({ regles: REGLES, dossier });
  assert.equal(encore.refaite, false);
  assert.equal(statSync(r.chemin).ino, inode, 'base en place gardée telle quelle');
});

test('nouvelles règles : la base est refaite, toutes les lignes de la section 13 reprises, l’ancienne base archivée', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const avant = lignesVivantes(chemin);
  assert.equal(avant.personnage.length, 2);

  const livraison = regles("UPDATE race SET nom = 'Humain (nouvelles règles)' WHERE id = 'races/humain'");
  const r = preparerBaseVivante({ regles: livraison, dossier, instant: new Date('2026-10-11T08:30:00Z') });
  assert.equal(r.refaite, true);
  assert.equal(r.empreinte, empreinteFichier(livraison));
  assert.deepEqual(lignesVivantes(chemin), avant, 'fiches, utilisateurs, rôles, groupes et inscriptions repris à l’identique');
  assert.equal(valeur(chemin, "SELECT nom FROM race WHERE id = 'races/humain'").nom, 'Humain (nouvelles règles)', 'règles de la nouvelle livraison');
  assert.equal(r.archive, join(dossier, DOSSIER_ARCHIVES, 'vivante-2026-10-11T08-30-00-000Z.db'));
  assert.deepEqual(lignesVivantes(r.archive), avant, 'l’archive est la base d’avant');
  assert.equal(valeur(r.archive, "SELECT nom FROM race WHERE id = 'races/humain'").nom, 'Humain');
  assert.equal(lireEtat(dossier).regles, r.empreinte);
  assert.deepEqual(sansArchives(dossier), [FICHIER_BASE, FICHIER_ETAT]);
  const db = lecture(chemin);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], 'aucune référence rompue');
  db.close();
});

test('une page qui a des [[liens]] supprimée sur le site, puis la base refaite sur des règles changées ailleurs : aucun conflit (ON DELETE CASCADE rejoués)', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  // un métier qui a un lien sortant (« Alchimiste » à l'import), un autre qu'un lien vise (« Mineur ») : lus dans les règles
  const sortant = valeur(REGLES, "SELECT l.page_id AS id FROM lien l JOIN metier m ON m.id = l.page_id ORDER BY l.page_id LIMIT 1")?.id;
  const vise = valeur(REGLES, "SELECT l.cible_page_id AS id FROM lien l JOIN metier m ON m.id = l.cible_page_id WHERE l.cible_page_id <> ? ORDER BY 1 LIMIT 1", sortant ?? '')?.id;
  assert.ok(sortant && vise, 'des métiers liés dans les règles');
  const vivante = ouvrirBaseVivante(chemin);
  enregistrer(vivante, { page: 'metiers/', operations: [sortant, vise].map((id) => ({ op: 'supprimer', entite: 'metier', cle: { id } })) });
  assert.equal(vivante.prepare('SELECT count(*) AS n FROM lien WHERE page_id IN (?, ?) OR cible_page_id IN (?, ?)').get(sortant, vise, sortant, vise).n, 0, 'cascade de SQLite');
  vivante.close();
  const r = preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain (livraison)' WHERE id = 'races/humain'"), dossier });
  assert.equal(r.refaite, true);
  assert.equal(r.rejeu.conflits, 0, JSON.stringify(r.rejeu));
  assert.ok(r.rejeu.appliquees > 0);
  assert.equal(valeur(chemin, 'SELECT count(*) AS n FROM metier WHERE id IN (?, ?)', sortant, vise).n, 0, 'les métiers restent supprimés');
  assert.equal(valeur(chemin, 'SELECT count(*) AS n FROM lien WHERE page_id IN (?, ?) OR cible_page_id IN (?, ?)', sortant, vise, sortant, vise).n, 0);
  const db = lecture(chemin);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});

/** Un prétiré écrit directement dans la base vivante (comme le service), qui a la classe `classe` (spécialité `specialite`) et les dons `capacites`. */
function pretire(db, id, { classe, specialite = null, capacites = [] }) {
  const inserer = (t, l) => db.prepare(`INSERT INTO ${t} (${Object.keys(l).join(', ')}) VALUES (${Object.keys(l).map(() => '?').join(', ')})`).run(...Object.values(l));
  inserer('personnage', { id, nature: 'pretire', nom: `Prétiré ${id}`, visibilite: 'tous', mode_classe: 'mono', xp: 0, alignement_loyal: 0,
    alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT });
  inserer('personnage_classe', { personnage_id: id, rang: 1, classe_id: classe, specialite_id: specialite });
  for (const c of capacites) inserer('personnage_capacite', { personnage_id: id, capacite_id: c });
}

test('rejeu : un lot sans rapport AVANT la création d’un don qu’un prétiré choisit n’est pas mis en conflit par la fiche (clés des fiches contrôlées après le rejeu)', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  const vivante = ouvrirBaseVivante(chemin);
  // lot 1 : l'effet d'un don hors spécialité d'une autre classe que le Guerrier (lu dans l'état courant)
  const don = vivante.prepare("SELECT id, effet FROM capacite WHERE classe_id <> 'classes/guerrier' AND nature = 'classe' ORDER BY id LIMIT 1").get();
  const effet = `${don.effet ?? ''} (essai du rejeu)`.trim();
  enregistrer(vivante, { page: 'classes/x', operations: [{ op: 'modifier', table: 'capacite', cle: { id: don.id }, valeurs: { effet } }] });
  // lot 2 : deux dons au choix du Guerrier ; un prétiré prend le premier
  const r = enregistrer(vivante, { page: 'classes/guerrier', operations: [
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', niveau: 5, nom: 'Essai rejeu un', type: 'Passif' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', avec: '@0', nom: 'Essai rejeu deux', type: 'Passif' } },
  ] });
  const [un] = r.crees.map((c) => c.id);
  pretire(vivante, 'p-rejeu', { classe: 'classes/guerrier', capacites: [un] });
  vivante.close();

  const res = preparerBaseVivante({ regles: regles(`UPDATE metier SET remarque = 'livraison sans rapport' WHERE id = '${UN_METIER}'`), dossier });
  assert.equal(res.refaite, true);
  assert.equal(res.rejeu.conflits, 0, JSON.stringify(res.rejeu));
  assert.equal(valeur(chemin, 'SELECT effet FROM capacite WHERE id = ?', don.id).effet, effet, 'la modification du lot 1 est gardée');
  assert.equal(valeur(chemin, 'SELECT count(*) AS n FROM personnage_capacite WHERE personnage_id = ? AND capacite_id = ?', 'p-rejeu', un).n, 1, 'la fiche est reprise');
  // R42 : le retrait vient APRÈS le rejeu complet (le lot 2 crée le don que la fiche cite) : rien n'est retiré, aucune note
  assert.deepEqual(res.fiches, []);
  assert.deepEqual({ ...valeur(chemin, 'SELECT notes, modifie_le FROM personnage WHERE id = ?', 'p-rejeu') }, { notes: null, modifie_le: INSTANT });
  const db = lecture(chemin);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});

test('rejeu : une spécialité remplacée (supprimée, puis une autre créée) et un prétiré qui prend la nouvelle : la base est refaite', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  const vivante = ouvrirBaseVivante(chemin);
  // une spécialité du Guerrier qui a son don de spécialité (lue dans l'état courant : la dernière par rang)
  const ancienne = vivante.prepare(`SELECT s.id FROM specialite s WHERE s.classe_id = 'classes/guerrier'
    AND EXISTS (SELECT 1 FROM capacite k WHERE k.specialite_id = s.id AND k.nature = 'specialite') ORDER BY s.rang DESC LIMIT 1`).get();
  assert.ok(ancienne, 'le Guerrier a une spécialité avec son don de spécialité');
  enregistrer(vivante, { page: 'classes/guerrier', operations: [{ op: 'supprimer', entite: 'specialite', cle: { id: ancienne.id } }] });
  const r = enregistrer(vivante, { page: 'classes/guerrier', operations: [
    { op: 'creer', entite: 'specialite', valeurs: { classe_id: 'classes/guerrier', nom: 'Essai remplaçante', don_nom: 'Essai remplaçante', don_type: 'Passif' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', specialite_id: '@0', niveau: 15, nom: 'Essai remplaçante un', type: 'Passif' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', specialite_id: '@0', avec: '@1', nom: 'Essai remplaçante deux', type: 'Actif' } },
  ] });
  const [specialite, un] = r.crees.map((c) => c.id);
  pretire(vivante, 'p-remplace', { classe: 'classes/guerrier', specialite, capacites: [un] });
  vivante.close();

  const res = preparerBaseVivante({ regles: regles(`UPDATE metier SET remarque = 'livraison sans rapport' WHERE id = '${UN_METIER}'`), dossier });
  assert.equal(res.refaite, true);
  assert.equal(res.rejeu.conflits, 0, JSON.stringify(res.rejeu));
  assert.equal(valeur(chemin, 'SELECT count(*) AS n FROM specialite WHERE id = ?', ancienne.id).n, 0, 'l’ancienne spécialité reste supprimée');
  assert.equal(valeur(chemin, 'SELECT specialite_id FROM personnage_classe WHERE personnage_id = ?', 'p-remplace').specialite_id, specialite);
  assert.equal(valeur(chemin, 'SELECT count(*) AS n FROM personnage_capacite WHERE personnage_id = ? AND capacite_id = ?', 'p-remplace', un).n, 1);
  assert.deepEqual(res.fiches, [], 'R42 : rien de retiré (la spécialité et le don sont créés par un lot rejoué avant le retrait)');
  assert.deepEqual({ ...valeur(chemin, 'SELECT notes, modifie_le FROM personnage WHERE id = ?', 'p-remplace') }, { notes: null, modifie_le: INSTANT });
  const db = lecture(chemin);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});

/** Un prétiré (p1, de remplir) qui a la première spécialité du Guerrier et un don à choix de cette spécialité, lus dans la base ; et ses notes. */
function avecSpecialite(chemin, notes = null) {
  const db = new DatabaseSync(chemin);
  try {
    const spec = db.prepare("SELECT id, nom FROM specialite WHERE classe_id = 'classes/guerrier' ORDER BY rang LIMIT 1").get();
    const don = db.prepare("SELECT id, nom FROM capacite WHERE specialite_id = ? AND nature = 'choix' ORDER BY ligne, rang LIMIT 1").get(spec.id);
    assert.ok(spec && don, 'le Guerrier a une spécialité avec un don à choix');
    db.prepare("UPDATE personnage_classe SET specialite_id = ? WHERE personnage_id = 'p1'").run(spec.id);
    db.prepare("INSERT INTO personnage_capacite (personnage_id, capacite_id) VALUES ('p1', ?)").run(don.id);
    db.prepare("UPDATE personnage SET notes = ? WHERE id = 'p1'").run(notes);
    return { spec: { ...spec }, don: { ...don } };
  } finally {
    db.close();
  }
}
const versionDe = (chemin, id) => {
  const db = lecture(chemin);
  try {
    return lireFiche(db, id).version;
  } finally {
    db.close();
  }
};
const SUITE = ' n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.';

test('R42 — une fiche qui cite un métier, un sort, une spécialité ou un don disparu : la base est refaite, l’élément retiré, une note datée', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const { spec, don } = avecSpecialite(chemin, 'Note du joueur.');
  const ecrire = new DatabaseSync(chemin);
  ecrire.prepare("UPDATE personnage SET metier_id = ? WHERE id = 'p2'").run(UN_METIER);
  ecrire.close();
  const avant = lignesVivantes(chemin);
  const versionAvant = versionDe(chemin, 'p1');
  // les noms des éléments retirés, lus dans les règles d'avant
  const metier = valeur(REGLES, 'SELECT nom FROM metier WHERE id = ?', UN_METIER).nom;
  const sort = valeur(REGLES, 'SELECT s.nom, s.niveau, m.nom AS magie FROM sort s JOIN magie m ON m.id = s.magie_id WHERE s.id = ?', UN_SORT_DE_FEU);
  const guerrier = valeur(REGLES, "SELECT nom FROM classe WHERE id = 'classes/guerrier'").nom;

  const livraison = regles(`DELETE FROM metier WHERE id = '${UN_METIER}'; DELETE FROM sort WHERE id = '${UN_SORT_DE_FEU}';
    DELETE FROM capacite WHERE specialite_id = '${spec.id}'; DELETE FROM specialite WHERE id = '${spec.id}'`);
  const r = preparerBaseVivante({ regles: livraison, dossier, instant: new Date('2026-10-11T08:30:00Z') });
  assert.equal(r.refaite, true);
  const retraits = {
    metier: `le métier « ${metier} »`,
    specialite: `la spécialité « ${spec.nom} » (classe ${guerrier}, avec le don choisi « ${don.nom} »)`,
    sort: `le sort « ${sort.nom} » (magie ${sort.magie}, NPM ${sort.niveau})`,
  };
  const ligneDe = (d) => `[11/10/2026] Retrait (règles modifiées) : ${d}${SUITE}`;
  assert.deepEqual(r.fiches, [
    { fiche: 'Aldric', retraits: [retraits.metier, retraits.specialite, retraits.sort] },
    { fiche: 'fiche de joueur n° 1', retraits: [retraits.metier] },
  ]);
  // les fiches : l'élément retiré, la ligne de classe gardée, une ligne de note par élément à la suite du texte du joueur
  const db = lecture(chemin);
  try {
    assert.deepEqual(db.prepare("SELECT id, metier_id, notes, modifie_le FROM personnage ORDER BY id").all().map((l) => ({ ...l })), [
      { id: 'p1', metier_id: null, notes: ['Note du joueur.', ...[retraits.metier, retraits.specialite, retraits.sort].map(ligneDe)].join('\n'), modifie_le: '2026-10-11T08:30:00Z' },
      { id: 'p2', metier_id: null, notes: ligneDe(retraits.metier), modifie_le: '2026-10-11T08:30:00Z' },
    ]);
    assert.deepEqual(db.prepare("SELECT rang, classe_id, specialite_id FROM personnage_classe WHERE personnage_id = 'p1'").all().map((l) => ({ ...l })),
      [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }]);
    assert.equal(db.prepare('SELECT count(*) AS n FROM personnage_capacite').get().n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM personnage_sort WHERE personnage_id = 'p1'").get().n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM personnage_inventaire WHERE personnage_id = 'p1'").get().n, 1, 'le reste de la fiche est repris');
    // les fiches ne citent plus rien d'absent (les règles de la livraison d'essai, elles, ont été coupées sans leurs lignes de détail)
    for (const t of TABLES_FICHES) assert.deepEqual(db.prepare(`PRAGMA foreign_key_check("${t}")`).all(), [], t);
  } finally {
    db.close();
  }
  assert.notEqual(versionDe(chemin, 'p1'), versionAvant, 'la version de la fiche change (une fiche ouverte ailleurs reçoit 409)');
  // la liste, dans vivante.json (/api/etat) ; le nom d'une fiche de joueur ne sort pas
  assert.deepEqual(lireEtat(dossier).retraits, { le: '2026-10-11T08:30:00Z', fiches: r.fiches });
  assert.ok(!JSON.stringify(r).includes('Brune'));
  assert.ok(!readFileSync(join(dossier, FICHIER_ETAT), 'utf8').includes('Brune'));
  // l'archive garde la base d'avant les retraits
  assert.deepEqual(lignesVivantes(r.archive), avant);

  // une livraison sans rapport : rien de plus retiré, pas de double note, la dernière liste gardée
  const notes = valeur(chemin, "SELECT notes FROM personnage WHERE id = 'p1'").notes;
  const r2 = preparerBaseVivante({ regles: regles(`DELETE FROM metier WHERE id = '${UN_METIER}'; UPDATE race SET nom = 'Humain 2' WHERE id = 'races/humain'`), dossier,
    instant: new Date('2026-10-12T08:30:00Z') });
  assert.equal(r2.refaite, true);
  assert.deepEqual(r2.fiches, []);
  assert.equal(valeur(chemin, "SELECT notes FROM personnage WHERE id = 'p1'").notes, notes);
  assert.deepEqual(lireEtat(dossier).retraits, { le: '2026-10-11T08:30:00Z', fiches: r.fiches });
  assert.equal(lireEtat(dossier).refaite_le, '2026-10-12T08:30:00Z');
});

test('une fiche qui cite une classe disparue : rien ne change (même pas le retrait d’un métier disparu), l’erreur nomme la colonne, la valeur et la table visée', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const avant = lignesVivantes(chemin);
  const inode = statSync(chemin).ino;
  const etat = readFileSync(join(dossier, FICHIER_ETAT), 'utf8');

  const livraison = regles(`DELETE FROM metier WHERE id = '${UN_METIER}'; DELETE FROM classe WHERE id = 'classes/guerrier'`);
  assert.throws(() => preparerBaseVivante({ regles: livraison, dossier }), (e) => {
    assert.ok(e instanceof ErreurBaseVivante, e.message);
    assert.match(e.message, /gardée telle quelle/);
    assert.deepEqual(e.problemes, ['personnage_classe.classe_id = « classes/guerrier » absent de classe (1 ligne(s))'], 'le métier, lui, aurait été retiré');
    return true;
  });
  assert.equal(statSync(chemin).ino, inode);
  assert.deepEqual(lignesVivantes(chemin), avant, 'p1 garde son métier, sans note');
  assert.equal(readFileSync(join(dossier, FICHIER_ETAT), 'utf8'), etat);
  assert.deepEqual(sansArchives(dossier), [FICHIER_BASE, FICHIER_ETAT], 'copie provisoire supprimée');
  assert.ok(!existsSync(join(dossier, DOSSIER_ARCHIVES)), 'rien archivé');
});

test('hors R42 — un sort d’une magie disparue (prétiré au Potentiel Illimité) ou un don d’une classe disparue (fiche sans la classe) : rien ne change, rien n’est retiré, l’erreur nomme la référence', () => {
  // un don d'une autre classe que le Guerrier (lu dans la base) ; sa classe disparaîtra avec ses spécialités et ses dons
  const don = valeur(REGLES, "SELECT id, classe_id FROM capacite WHERE classe_id <> 'classes/guerrier' AND nature = 'classe' ORDER BY id LIMIT 1");
  const cas = [
    {
      // le Potentiel Illimité pioche ses sorts dans toutes les magies : la fiche est conforme ; la magie du Feu disparaît avec ses sorts
      fiche: (db) => {
        db.prepare("UPDATE personnage SET magie_innee_id = 'magies/potentiel-illimite' WHERE id = 'p-hors'").run();
        db.prepare("INSERT INTO personnage_sort (personnage_id, sort_id, rang, niveau_maitrise) VALUES ('p-hors', ?, 1, 0)").run(UN_SORT_DE_FEU);
      },
      livraison: "DELETE FROM sort WHERE magie_id = 'magies/magie-du-feu'; DELETE FROM magie WHERE id = 'magies/magie-du-feu'",
      probleme: `personnage_sort.sort_id = « ${UN_SORT_DE_FEU} » absent de sort (1 ligne(s))`,
    },
    {
      // une fiche inachevée qui a le don sans avoir sa classe
      fiche: (db) => db.prepare("INSERT INTO personnage_capacite (personnage_id, capacite_id) VALUES ('p-hors', ?)").run(don.id),
      livraison: `DELETE FROM capacite WHERE classe_id = '${don.classe_id}'; DELETE FROM specialite WHERE classe_id = '${don.classe_id}';
        DELETE FROM classe WHERE id = '${don.classe_id}'`,
      probleme: `personnage_capacite.capacite_id = « ${don.id} » absent de capacite (1 ligne(s))`,
    },
  ];
  for (const c of cas) {
    const dossier = nouveau('db');
    const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
    const db = new DatabaseSync(chemin);
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare(`INSERT INTO personnage (id, nature, nom, visibilite, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon,
      alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, notes, cree_le, modifie_le) VALUES ('p-hors', 'pretire', 'Témoin hors R42', 'tous',
      'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Note du joueur.', ?, ?)`).run(INSTANT, INSTANT);
    c.fiche(db);
    db.close();
    const avant = lignesVivantes(chemin);
    const inode = statSync(chemin).ino;
    const etat = readFileSync(join(dossier, FICHIER_ETAT), 'utf8');
    assert.throws(() => preparerBaseVivante({ regles: regles(c.livraison), dossier, instant: new Date('2026-10-11T08:30:00Z') }), (e) => {
      assert.ok(e instanceof ErreurBaseVivante, e.message);
      assert.deepEqual(e.problemes, [c.probleme]);
      return true;
    });
    assert.equal(statSync(chemin).ino, inode, 'la base en place est gardée');
    assert.deepEqual(lignesVivantes(chemin), avant, 'rien de retiré, aucune note');
    assert.equal(valeur(chemin, "SELECT notes FROM personnage WHERE id = 'p-hors'").notes, 'Note du joueur.');
    assert.equal(readFileSync(join(dossier, FICHIER_ETAT), 'utf8'), etat, 'pas de liste de retraits');
  }
});

test('R42 — un métier, un sort, un don ou une spécialité renommé : la fiche n’est pas touchée (ni note, ni version) et se lit sous le nouveau nom', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const { spec, don } = avecSpecialite(chemin);
  const avant = lignesVivantes(chemin);
  const versionAvant = versionDe(chemin, 'p1');
  const libre = (table, nom) => {
    let n = nom;
    for (let i = 2; valeur(REGLES, `SELECT 1 AS x FROM "${table}" WHERE nom = ?`, n); i += 1) n = `${nom} ${i}`;
    return n;
  };
  const noms = { metier: libre('metier', 'Métier renommé R42'), sort: libre('sort', 'Sort renommé R42'), capacite: libre('capacite', 'Don renommé R42'),
    specialite: libre('specialite', 'SPÉCIALITÉ RENOMMÉE R42') };
  const sql = [
    ['metier', UN_METIER], ['sort', UN_SORT_DE_FEU], ['capacite', don.id], ['specialite', spec.id],
  ].map(([t, id]) => `UPDATE ${t} SET nom = '${noms[t].replaceAll("'", "''")}' WHERE id = '${id.replaceAll("'", "''")}';`).join('\n');
  const r = preparerBaseVivante({ regles: regles(sql), dossier, instant: new Date('2026-10-11T08:30:00Z') });
  assert.equal(r.refaite, true);
  assert.deepEqual(r.fiches, []);
  assert.deepEqual(lignesVivantes(chemin), avant, 'notes et modifie_le compris');
  assert.equal(versionDe(chemin, 'p1'), versionAvant);
  const lu = lecture(chemin);
  try {
    const aldric = listerFiches(lu).find((f) => f.id === 'p1');
    assert.equal(aldric.metier, noms.metier);
    assert.equal(aldric.classes[0].specialite, noms.specialite);
  } finally {
    lu.close();
  }
  assert.equal('retraits' in lireEtat(dossier), false);
});

test('R42 — une livraison qui renomme la classe, la spécialité et la magie et supprime un don, une spécialité et un sort : la note cite les nouveaux noms', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const { spec, don } = avecSpecialite(chemin); // p1 : la première spécialité du Guerrier et un de ses dons à choix
  const autre = valeur(REGLES, "SELECT id, nom FROM specialite WHERE classe_id = 'classes/guerrier' AND id <> ? ORDER BY rang LIMIT 1", spec.id);
  assert.ok(autre, 'le Guerrier a une seconde spécialité');
  const vivante = new DatabaseSync(chemin);
  pretire(vivante, 'p-renomme', { classe: 'classes/guerrier', specialite: autre.id });
  vivante.close();
  const niveau = valeur(REGLES, 'SELECT niveau FROM capacite WHERE id = ?', don.id).niveau;
  const sort = valeur(REGLES, 'SELECT nom, niveau FROM sort WHERE id = ?', UN_SORT_DE_FEU);
  const q = (t) => `'${t.replaceAll("'", "''")}'`;
  const noms = { classe: 'Guerrier renommé R42', specialite: 'SPÉCIALITÉ RENOMMÉE R42', magie: 'Feu renommé R42' };
  const livraison = regles(`UPDATE classe SET nom = ${q(noms.classe)} WHERE id = 'classes/guerrier';
    UPDATE specialite SET nom = ${q(noms.specialite)} WHERE id = ${q(spec.id)};
    UPDATE magie SET nom = ${q(noms.magie)} WHERE id = 'magies/magie-du-feu';
    DELETE FROM capacite WHERE id = ${q(don.id)};
    DELETE FROM capacite WHERE specialite_id = ${q(autre.id)}; DELETE FROM specialite WHERE id = ${q(autre.id)};
    DELETE FROM sort WHERE id = ${q(UN_SORT_DE_FEU)}`);
  const r = preparerBaseVivante({ regles: livraison, dossier, instant: new Date('2026-10-11T08:30:00Z') });
  assert.equal(r.refaite, true);
  // le nom de la classe, de la spécialité d'un don et de la magie d'un sort : celui des nouvelles règles ; le nom de l'élément retiré : celui d'avant
  assert.deepEqual(r.fiches, [
    { fiche: 'Aldric', retraits: [
      `le don « ${don.nom} » (classe ${noms.classe}, spécialité ${noms.specialite}, niveau ${niveau})`,
      `le sort « ${sort.nom} » (magie ${noms.magie}, NPM ${sort.niveau})`,
    ] },
    { fiche: 'Prétiré p-renomme', retraits: [`la spécialité « ${autre.nom} » (classe ${noms.classe})`] },
  ]);
  assert.equal(valeur(chemin, "SELECT specialite_id FROM personnage_classe WHERE personnage_id = 'p1'").specialite_id, spec.id, 'la spécialité renommée reste');
});

test('R42 — un don retiré d’un prétiré sur le site de dev, puis la base refaite par une livraison sans rapport : la note reste seule (pas de double note)', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  const vivante = ouvrirBaseVivante(chemin);
  const r = enregistrer(vivante, { page: 'classes/guerrier', operations: [
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', niveau: 5, nom: 'Essai note unique un', type: 'Passif' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', avec: '@0', nom: 'Essai note unique deux', type: 'Passif' } },
  ] });
  const [un] = r.crees.map((c) => c.id);
  pretire(vivante, 'p-note', { classe: 'classes/guerrier', capacites: [un] });
  const s = enregistrer(vivante, { page: 'classes/guerrier', operations: [{ op: 'supprimer', entite: 'capacite', cle: { id: un } }] });
  assert.deepEqual(s.fiches.map((f) => f.fiche), ['Prétiré p-note']);
  const notes = vivante.prepare("SELECT notes FROM personnage WHERE id = 'p-note'").get().notes;
  assert.equal(notes.split('\n').length, 1);
  vivante.close();

  const res = preparerBaseVivante({ regles: regles(`UPDATE metier SET remarque = 'livraison sans rapport' WHERE id = '${UN_METIER}'`), dossier });
  assert.equal(res.refaite, true);
  assert.equal(res.rejeu.conflits, 0, JSON.stringify(res.rejeu));
  assert.deepEqual(res.fiches, []);
  assert.equal(valeur(chemin, "SELECT notes FROM personnage WHERE id = 'p-note'").notes, notes);
  assert.equal(valeur(chemin, "SELECT count(*) AS n FROM personnage_capacite WHERE personnage_id = 'p-note'").n, 0);
});

test('schéma changé : une colonne remplie qui disparaît (hors COLONNES_RETIREES) est refusée ; une colonne ajoutée ou une colonne vide retirée passent', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const avant = lignesVivantes(chemin);
  assert.ok(!(COLONNES_RETIREES.personnage ?? []).includes('surnom'), 'surnom n’est pas une colonne retirée exprès : sa disparition doit bloquer');

  assert.throws(() => preparerBaseVivante({ regles: regles('ALTER TABLE personnage DROP COLUMN surnom'), dossier }), (e) => {
    assert.deepEqual(e.problemes, ['personnage : surnom rempli(e)s mais absente(s) des nouvelles règles']);
    return true;
  });
  assert.deepEqual(lignesVivantes(chemin), avant);

  assert.throws(() => preparerBaseVivante({ regles: regles("ALTER TABLE groupe ADD COLUMN lieu TEXT NOT NULL DEFAULT 'x' CHECK (lieu <> 'x')"), dossier }), (e) => {
    assert.match(e.problemes[0], /^groupe : CHECK constraint failed/);
    return true;
  });

  const r = preparerBaseVivante({ regles: regles('ALTER TABLE personnage DROP COLUMN lieu_origine; ALTER TABLE personnage ADD COLUMN titre TEXT'), dossier });
  assert.equal(r.refaite, true);
  const db = lecture(chemin);
  assert.deepEqual(db.prepare('SELECT id, titre, surnom FROM personnage ORDER BY id').all().map((l) => ({ ...l })),
    [{ id: 'p1', titre: null, surnom: 'le Brave' }, { id: 'p2', titre: null, surnom: null }]);
  db.close();
});

test('migration 0038 : une base vivante d’avant, dont les fiches ont encore leur statut rempli, est reprise sans blocage, la colonne perdue ; une autre colonne remplie disparue bloque toujours', () => {
  assert.deepEqual(COLONNES_RETIREES, { personnage: ['statut'] });
  const aStatut = (f, t) => valeur(f, `SELECT count(*) AS n FROM pragma_table_info('${t}') WHERE name = 'statut'`).n === 1;
  assert.equal(aStatut(REGLES, 'personnage'), false, 'les règles d’aujourd’hui n’ont plus de statut');
  // les règles d'avant 0038 : la colonne et ses contraintes (data/schema.sql d'alors ; une valeur par défaut, qu'ALTER TABLE exige pour NOT NULL) ;
  // pour l'essai, une colonne du même nom dans une autre table, qui n'est pas retirée exprès
  const anciennes = regles(`ALTER TABLE personnage ADD COLUMN statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'valide', 'archive'))
      CHECK (statut = 'brouillon' OR (race_id IS NOT NULL AND magie_innee_id IS NOT NULL));
    ALTER TABLE groupe ADD COLUMN statut TEXT`);
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: anciennes, dossier });
  remplir(chemin);
  const ecrire = new DatabaseSync(chemin);
  // p1, prétiré « archivé » (que l'ancienne liste cachait), p2 « validé » ; le groupe a son statut d'essai
  ecrire.exec("UPDATE personnage SET statut = 'archive' WHERE id = 'p1'; UPDATE personnage SET statut = 'valide' WHERE id = 'p2'; UPDATE groupe SET statut = 'ouvert'");
  ecrire.close();
  const avant = lignesVivantes(chemin);

  // une colonne remplie qui disparaît bloque toujours, dans la même table (surnom) comme ailleurs (groupe.statut) ; personnage.statut n'est pas relevé
  assert.throws(() => preparerBaseVivante({ regles: regles('ALTER TABLE personnage DROP COLUMN surnom'), dossier }), (e) => {
    assert.ok(e instanceof ErreurBaseVivante, e.message);
    assert.deepEqual(e.problemes, [
      'personnage : surnom rempli(e)s mais absente(s) des nouvelles règles',
      'groupe : statut rempli(e)s mais absente(s) des nouvelles règles',
    ]);
    return true;
  });
  assert.deepEqual(lignesVivantes(chemin), avant, 'la base en place est gardée telle quelle');
  assert.ok(!existsSync(join(dossier, DOSSIER_ARCHIVES)), 'rien archivé');

  // le groupe n'a plus de statut d'essai : les règles d'aujourd'hui reprennent tout, le statut des fiches est perdu sans bloquer
  const vider = new DatabaseSync(chemin);
  vider.exec('UPDATE groupe SET statut = NULL');
  vider.close();
  const sansStatut = Object.fromEntries(Object.entries(lignesVivantes(chemin)).map(([t, lignes]) => [t, lignes.map((l) => {
    const { statut, ...reste } = JSON.parse(l);
    return JSON.stringify(reste);
  }).sort()]));
  const r = preparerBaseVivante({ regles: REGLES, dossier, instant: new Date('2026-10-14T08:30:00Z') });
  assert.equal(r.refaite, true);
  assert.deepEqual(r.fiches, [], 'rien de retiré des fiches (R42), aucune note');
  assert.equal(r.rejeu.conflits, 0, JSON.stringify(r.rejeu));
  assert.deepEqual(lignesVivantes(chemin), sansStatut, 'fiches, utilisateurs, groupes et inscriptions repris, sans le statut');
  assert.equal(aStatut(chemin, 'personnage'), false, 'la colonne est perdue');
  assert.equal(aStatut(chemin, 'groupe'), false);
  // l'archive garde la base d'avant, statuts compris
  assert.deepEqual(valeur(r.archive, "SELECT group_concat(id || '=' || statut, ' ') AS s FROM (SELECT id, statut FROM personnage ORDER BY id)").s, 'p1=archive p2=valide');
  const db = lecture(chemin);
  try {
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    // le prétiré « archivé » se liste et se lit comme les autres, sans statut
    const liste = listerFiches(db);
    assert.deepEqual(liste.map((f) => f.id), ['p1']);
    assert.equal('statut' in liste[0], false);
    const aldric = lireFiche(db, 'p1');
    assert.equal(aldric.nom, 'Aldric');
    assert.equal('statut' in aldric, false);
  } finally {
    db.close();
  }
});

// Les règles d'avant la migration 0045 (data/schema.sql d'alors) : la table personnage_progression, sans les gains en deux totaux, l'entraînement ni la
// durabilité des armes (la vue qui les lit d'abord : SQLite refuse de retirer une colonne qu'une vue cite).
const AVANT_0045 = `DROP VIEW v_personnage_controle;
  ALTER TABLE personnage DROP COLUMN gains_sante;
  ALTER TABLE personnage DROP COLUMN gains_chakra;
  ALTER TABLE personnage DROP COLUMN entrainement;
  ALTER TABLE personnage_arme DROP COLUMN durabilite;
  CREATE TABLE personnage_progression (
    personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
    niveau         INTEGER NOT NULL REFERENCES niveau_global(niveau) CHECK (niveau >= 2),
    points_sante   INTEGER NOT NULL CHECK (points_sante >= 0),
    points_chakra  INTEGER NOT NULL CHECK (points_chakra >= 0),
    de_choix       TEXT    CHECK (de_choix IN ('sante', 'chakra', 'les_deux')),
    de_resultat    INTEGER CHECK (de_resultat >= 1),
    PRIMARY KEY (personnage_id, niveau),
    CHECK ((de_choix IS NULL) = (de_resultat IS NULL))
  ) STRICT, WITHOUT ROWID;`;
const COLONNES_0045 = { personnage: ['gains_sante', 'gains_chakra', 'entrainement'], personnage_arme: ['durabilite'] };
/** Les lignes de la section 13 sans les colonnes de la migration 0045 : ce qu'une base d'avant doit retrouver à l'identique. */
const sans0045 = (lignes) => Object.fromEntries(Object.entries(lignes).map(([t, l]) => [t, l.map((x) => {
  const ligne = JSON.parse(x);
  for (const c of COLONNES_0045[t] ?? []) delete ligne[c];
  return JSON.stringify(ligne);
}).sort()]));
const gainsDe = (f) => {
  const db = lecture(f);
  try {
    return Object.fromEntries(db.prepare('SELECT id, gains_sante, gains_chakra FROM personnage ORDER BY id').all().map((p) => [p.id, [p.gains_sante, p.gains_chakra]]));
  } finally {
    db.close();
  }
};
const aLaTable = (f, t) => valeur(f, "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?", t).n === 1;

test('migration 0045 : une base vivante d’avant, avec ses gains niveau par niveau, est reprise ; chaque fiche reçoit leur somme (R73), rien d’autre ne change', () => {
  assert.equal(TABLES_RETIREES.personnage_progression, 'progression');
  assert.equal(aLaTable(REGLES, 'personnage_progression'), false, 'les règles d’aujourd’hui n’ont plus la table');
  const anciennes = regles(AVANT_0045);
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: anciennes, dossier });
  remplir(chemin);
  const ecrire = new DatabaseSync(chemin);
  ecrire.exec('PRAGMA foreign_keys = ON');
  const gain = ecrire.prepare('INSERT INTO personnage_progression (personnage_id, niveau, points_sante, points_chakra, de_choix, de_resultat) VALUES (?, ?, ?, ?, ?, ?)');
  // p1 : niveaux 2, 3, 4 (10 santé, 5 chakra) et 5 (15 santé, dé « les deux » 3) ; p2 : niveau 2 (15 santé) et 5 (15 chakra, dé chakra 7)
  for (const n of [2, 3, 4]) gain.run('p1', n, 10, 5, null, null);
  gain.run('p1', 5, 15, 0, 'les_deux', 3);
  gain.run('p2', 2, 15, 0, null, null);
  gain.run('p2', 5, 0, 15, 'chakra', 7);
  const progression = ecrire.prepare('SELECT * FROM personnage_progression ORDER BY personnage_id, niveau').all().map((l) => ({ ...l }));
  ecrire.close();
  const avant = lignesVivantes(chemin);

  // des règles qui ont encore la table (service et règles qui ne vont pas ensemble) : rien ne se perd sans le dire, la base reste en place
  assert.throws(() => preparerBaseVivante({ regles: regles(`${AVANT_0045} UPDATE race SET nom = 'Humain (bis)' WHERE id = 'races/humain';`), dossier }), (e) => {
    assert.ok(e instanceof ErreurBaseVivante, e.message);
    assert.deepEqual(e.problemes, [
      'personnage_progression : table retirée par les nouvelles règles (TABLES_RETIREES), mais encore dans la base des règles : ses lignes ne seraient pas reprises',
    ]);
    return true;
  });
  assert.deepEqual(lignesVivantes(chemin), avant, 'la base en place est gardée telle quelle');

  const r = preparerBaseVivante({ regles: REGLES, dossier, instant: new Date('2026-10-15T08:30:00Z') });
  assert.equal(r.refaite, true);
  assert.deepEqual(r.fiches, [], 'rien de retiré des fiches (R42), aucune note');
  assert.equal(r.rejeu.conflits, 0, JSON.stringify(r.rejeu));
  // 10 × 3 + 15 + 3 = 48 et 5 × 3 + 3 = 18 (« 1d4 pour les deux » compte sur chacun) ; 15 et 15 + 7 = 22
  assert.deepEqual(gainsDe(chemin), { p1: [48, 18], p2: [15, 22] });
  // la même somme en JavaScript (une page restée ouverte, un fichier d'avant : sansPartiesRetirees)
  for (const id of ['p1', 'p2']) {
    const g = gainsDeLaProgression(progression.filter((l) => l.personnage_id === id));
    assert.deepEqual([g.gains_sante, g.gains_chakra], gainsDe(chemin)[id], id);
  }
  assert.equal(aLaTable(chemin, 'personnage_progression'), false, 'la table n’est plus dans la base vivante');
  assert.deepEqual(sans0045(lignesVivantes(chemin)), avant, 'le reste de la section 13 repris à l’identique');
  assert.equal(valeur(r.archive, 'SELECT count(*) AS n FROM personnage_progression').n, 6, 'l’archive garde les gains niveau par niveau');
  const db = lecture(chemin);
  try {
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    const aldric = lireFiche(db, 'p1');
    assert.equal('progression' in aldric, false);
    assert.deepEqual([aldric.gains_sante, aldric.gains_chakra, aldric.entrainement], [48, 18, null]);
  } finally {
    db.close();
  }

  // une reconstruction suivante (d'autres règles) garde les totaux : il n'y a plus rien à convertir
  const suivante = preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain (suite)' WHERE id = 'races/humain'"), dossier });
  assert.equal(suivante.refaite, true);
  assert.deepEqual(gainsDe(chemin), { p1: [48, 18], p2: [15, 22] });
});

test('migration 0045 : une base vivante d’avant sans gain de niveau saisi : ses fiches reçoivent 0 et 0', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: regles(AVANT_0045), dossier });
  remplir(chemin);
  assert.equal(valeur(chemin, 'SELECT count(*) AS n FROM personnage_progression').n, 0);
  const avant = lignesVivantes(chemin);
  const r = preparerBaseVivante({ regles: REGLES, dossier });
  assert.equal(r.refaite, true);
  assert.deepEqual(gainsDe(chemin), { p1: [0, 0], p2: [0, 0] });
  assert.deepEqual(sans0045(lignesVivantes(chemin)), avant);
});

// Les règles d'avant la migration 0055 (data/schema.sql d'alors) : une armure par emplacement (personnage_armure). Les colonnes de l'armure de
// personnage et la table de la solidité des parties restent (vides : le service d'aujourd'hui les exige) ; la copie reprend ces colonnes à NULL et la
// conversion les remplit, comme depuis une base d'avant.
const AVANT_0055 = `CREATE TABLE personnage_armure (
    personnage_id                TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
    emplacement_id               TEXT    NOT NULL REFERENCES armure_emplacement(id),
    armure_id                    TEXT    NOT NULL REFERENCES armure(id),
    amelioration_id              TEXT    REFERENCES amelioration_equipement(id),
    armure_elementaire_id        TEXT    REFERENCES armure_elementaire(id),
    amelioration_elementaire_id  TEXT    REFERENCES amelioration_equipement(id),
    PRIMARY KEY (personnage_id, emplacement_id)
  ) STRICT, WITHOUT ROWID;`;

test('migration 0055 : une base vivante d’avant, une armure par emplacement, est reprise ; la fiche garde la première, une pièce devenue l’armure complète et chaque autre pièce sont notées, datées (R95)', () => {
  assert.equal(TABLES_RETIREES.personnage_armure, 'armures');
  assert.equal(aLaTable(REGLES, 'personnage_armure'), false, 'les règles d’aujourd’hui n’ont plus la table');
  const lire = new DatabaseSync(REGLES, { readOnly: true });
  const [a, b] = lire.prepare("SELECT id, nom FROM armure WHERE sorte = 'combinaison' ORDER BY ordre LIMIT 2").all().map((x) => ({ ...x }));
  const amelioration = lire.prepare("SELECT id FROM amelioration_equipement WHERE cible = 'armure' AND niveau = 2").get().id;
  const casque = lire.prepare("SELECT nom FROM armure_emplacement WHERE id = 'casque'").get().nom;
  const torse = lire.prepare("SELECT nom FROM armure_emplacement WHERE id = 'torse'").get().nom;
  lire.close();
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: regles(AVANT_0055), dossier });
  remplir(chemin);
  const ecrire = new DatabaseSync(chemin);
  ecrire.exec('PRAGMA foreign_keys = ON');
  const piece = ecrire.prepare('INSERT INTO personnage_armure (personnage_id, emplacement_id, armure_id, amelioration_id) VALUES (?, ?, ?, ?)');
  // p1 : l'armure complète A améliorée +2, un casque B (autre armure) et un torse A +2 (la même : rien à noter) ; p2 : un torse B seul
  piece.run('p1', 'armure-complete', a.id, amelioration);
  piece.run('p1', 'casque', b.id, null);
  piece.run('p1', 'torse', a.id, amelioration);
  piece.run('p2', 'torse', b.id, null);
  ecrire.close();

  const r = preparerBaseVivante({ regles: REGLES, dossier, instant: new Date('2026-10-16T18:00:00Z') });
  assert.equal(r.refaite, true);
  assert.equal(aLaTable(chemin, 'personnage_armure'), false, 'la table n’est plus dans la base vivante');
  const db = lecture(chemin);
  try {
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    const p1 = lireFiche(db, 'p1');
    // p2 est la fiche d'un joueur : lireFiche ne lit que les prétirés
    const p2 = { ...db.prepare("SELECT * FROM personnage WHERE id = 'p2'").get() };
    assert.deepEqual([p1.armure_id, p1.armure_amelioration_id, p1.armure_elementaire_id, p1.armure_amelioration_elementaire_id], [a.id, amelioration, null, null]);
    assert.deepEqual([p2.armure_id, p2.armure_amelioration_id], [b.id, null], 'sans armure complète : la première pièce');
    assert.equal('armures' in p1, false);
    assert.deepEqual(p1.armure_parties, [], 'toutes les parties à leur maximum');
    assert.equal(p1.notes, `[16/10/2026] Retrait (règles modifiées) : la pièce d’armure « ${b.nom} » (${casque}) n’est plus portée : une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.`);
    assert.equal(p1.modifie_le, '2026-10-16T18:00:00Z', 'une fiche notée est marquée modifiée');
    assert.equal(p2.notes, `[16/10/2026] Retrait (règles modifiées) : la pièce d’armure « ${b.nom} » (${torse}) est devenue l’armure complète de la fiche : une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.`,
      'une pièce seule devient l’armure complète : la fiche le dit');
    assert.equal(p2.modifie_le, '2026-10-16T18:00:00Z');
  } finally {
    db.close();
  }
  assert.equal(valeur(r.archive, 'SELECT count(*) AS n FROM personnage_armure').n, 4, 'l’archive garde les pièces');
  // les fiches converties sont listées comme celles de la décision R42 (vivante.json, /api/etat) ; le nom d'une fiche de joueur ne sort pas
  assert.deepEqual(r.fiches.map((f) => f.retraits), [[`la pièce d’armure « ${b.nom} » (${casque})`], [`la pièce d’armure « ${b.nom} » (${torse})`]]);
  assert.match(r.fiches[1].fiche, /^fiche de joueur n° \d+$/);
  assert.deepEqual(lireEtat(dossier).retraits, { le: '2026-10-16T18:00:00Z', fiches: r.fiches });
  // une reconstruction suivante ne convertit plus rien : l'armure et la note restent telles quelles
  const suivante = preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain (suite)' WHERE id = 'races/humain'"), dossier });
  assert.equal(suivante.refaite, true);
  assert.equal(valeur(chemin, "SELECT armure_id FROM personnage WHERE id = 'p1'").armure_id, a.id);
  assert.equal(valeur(chemin, "SELECT count(*) AS n FROM personnage WHERE notes LIKE '%pièce d’armure%'").n, 2, 'p1 et p2, une fois chacune');
  assert.equal(valeur(chemin, "SELECT notes FROM personnage WHERE id = 'p2'").notes.split('\n').length, 1, 'rien ajouté à la reconstruction suivante');
});

test('archives : seulement quand la base avait des lignes, les dernières gardées ; règles contenant des fiches ou absentes refusées', () => {
  const dossier = nouveau('db');
  preparerBaseVivante({ regles: REGLES, dossier });
  assert.equal(preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain 1' WHERE id = 'races/humain'"), dossier }).archive, null, 'base vide : rien à archiver');
  remplir(join(dossier, FICHIER_BASE));
  for (let i = 0; i < ARCHIVES_GARDEES + 2; i += 1) {
    const r = preparerBaseVivante({ regles: regles(`UPDATE race SET nom = 'Humain ${i + 2}' WHERE id = 'races/humain'`), dossier, instant: new Date(Date.UTC(2026, 9, 12, 0, 0, i)) });
    assert.ok(r.archive);
  }
  const archives = readdirSync(join(dossier, DOSSIER_ARCHIVES)).sort();
  assert.equal(archives.length, ARCHIVES_GARDEES);
  assert.equal(archives.at(-1), 'vivante-2026-10-12T00-00-06-000Z.db');
  assert.equal(archives[0], 'vivante-2026-10-12T00-00-02-000Z.db', 'les plus anciennes sont supprimées');

  assert.throws(() => preparerBaseVivante({ regles: regles(`INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES ('x', 'X', '${INSTANT}')`), dossier }),
    /base des règles inattendue : table utilisateur non vide/);
  assert.throws(() => preparerBaseVivante({ regles: join(racine, 'absente.db'), dossier }), /base des règles introuvable/);
  assert.equal(lignesVivantes(join(dossier, FICHIER_BASE)).personnage.length, 2);
});

test('clesRompues : restreinte à une fiche, colonnes NULL ignorées', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const db = new DatabaseSync(chemin);
  db.exec("PRAGMA foreign_keys = OFF; UPDATE personnage SET dieu_choisi_id = 'dieux/inconnu', ethnie_id = NULL WHERE id = 'p2'");
  assert.deepEqual(clesRompues(db, 'personnage'), [{ table: 'personnage', colonnes: ['dieu_choisi_id'], parent: 'dieu', valeur: 'dieux/inconnu', lignes: 1 }]);
  assert.deepEqual(clesRompues(db, 'personnage', { ou: 't.id = ?', valeurs: ['p1'] }), []);
  db.close();
});
