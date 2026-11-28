// Les écritures du service sur le mot-clé après le retrait de ses colonnes (migration 0136 ; chantier 4 des mots-clés, docs/chantier-retrait-des-colonnes.md,
// §1, §2, §5, §6, §9 ; contrats C0 à C8 de la PR B) : le mot-clé n'est plus qu'un identifiant, son nom, son adresse, sa définition, sa couleur et son icône
// se lisent et s'écrivent sur son élément (sa page, sinon son sort, sinon son repère).
//   - créer : un mot-clé nu naît avec un repère ; celui d'une notion écrit sa définition sur sa page, sans repère ;
//   - renommer une page : le nom suit sans copie, la clé est recalculée, un nom que la règle ne sait pas distinguer n'est pas refusé (la clé reste) ;
//   - Glossaire : un mot-clé à repère se modifie (le journal note la ligne du repère) ; un mot-clé ancré reste fermé aux routes, un lot écrit sa
//     définition sur sa page, et rien sur un sort (409) ;
//   - fusion : le repère de l'absorbé part avec lui, la cible à repère reçoit ce qu'elle n'a pas ;
//   - page de notion d'un mot-clé à repère : elle reprend sa définition, sa couleur et son icône, le repère part ;
//   - un mot-clé qui survit à sa page (R289) reçoit un repère à son nom, avec sa définition, sans adresse ;
//   - rejeu : une ligne de mot_cle d'avant la migration est lue sur l'élément (adaptateur) ;
//   - contrôles du contenu : tout mot-clé a une page, un sort ou un repère, jamais un repère en double ;
//   - annulation (B3-4, B4-6) : un repère retiré se remet avant que la page parte ; la page ou le sort retiré rend un repère à son mot-clé, jamais un second ;
//   - ancrer_nouveau sans nom donné : le nom se lit sur l'élément.
// Aucune valeur du site n'est figée : les pages et les mots-clés se prennent par requête, les noms écrits sont ceux du test.
//   node --test test/serveur-edition-mots-cles-elements.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { ancienneEcritureDesColonnesDuMotCle, appliquerUnLot, enregistrer, ErreurEdition, supprimerPage } from '../serveur/edition.mjs';
import { ouvrirLot } from '../serveur/edition-journal.mjs';
import { refusDuRepere } from '../serveur/edition-mots-cles.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { lotHorsRoute } from './aide-mot-cle-nu.mjs';

const racine = dossierTemporaire('edition-mots-cles-elements');
let n = 0;
const SANS_ELEMENT = `SELECT k.id FROM mot_cle k WHERE NOT EXISTS (SELECT 1 FROM page WHERE mot_cle_id = k.id) AND NOT EXISTS (SELECT 1 FROM sort WHERE mot_cle_id = k.id)
  AND NOT EXISTS (SELECT 1 FROM repere WHERE mot_cle_id = k.id)`;
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin);
  // la copie du contenu peut porter un mot-clé sans élément (contrat C0 non tenu, signalé) : il est retiré de la base d'essai, il bloquerait la règle des clés
  for (const { id } of db.prepare(SANS_ELEMENT).all()) {
    db.prepare('DELETE FROM mot_cle_categorie WHERE mot_cle_id = ?').run(id);
    db.prepare('DELETE FROM mot_cle WHERE id = ?').run(id);
  }
  const un = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : undefined;
  };
  return { db, un };
}
/** Ancre en SQL un mot-clé neuf (sans repère) à l'élément `id` de `table` (page ou sort), dans la catégorie `categorie` : son id. */
function ancrer(m, table, id, categorie = m.un('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT 1').id) {
  const k = m.un('SELECT max(id) + 1 AS n FROM mot_cle').n;
  m.db.prepare('INSERT INTO mot_cle (id, cle) VALUES (?, ?)').run(k, `essai-ancre-${k}`);
  m.db.prepare('INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (?, ?)').run(k, categorie);
  m.db.prepare(`UPDATE "${table}" SET mot_cle_id = ? WHERE id = ?`).run(k, id);
  return k;
}
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
/** Par une route du site (`voie: 'route'`) : { statut, corps }. */
function parLaRoute(db, operations, page = 'regles/glossaire/') {
  try {
    return { statut: 200, corps: enregistrer(db, { page, operations }, { voie: 'route' }) };
  } catch (e) {
    if (e instanceof ErreurEdition) return { statut: e.statut, corps: { erreur: e.message, ...(e.details ?? {}) } };
    throw e;
  }
}
/** Par un lot de changements (`voie: 'lot'`) : chaque opération par le service, puis la fin du lot (le nom suivi, les clés). { statut, corps }. */
function parUnLot(db, operations) {
  try {
    const r = appliquerUnLot(db, {
      titre: `Lot d’essai ${(n += 1)}`, nature: 'code',
      travail: (h) => {
        for (const op of operations) h.executer(op);
        h.suivreLesElements();
      },
    });
    return { statut: 200, corps: r };
  } catch (e) {
    if (e instanceof ErreurEdition) return { statut: e.statut, corps: { erreur: e.message, ...(e.details ?? {}) } };
    throw e;
  }
}
const colonnesDuMotCle = (db) => db.prepare("SELECT name FROM pragma_table_info('mot_cle') ORDER BY cid").all().map((c) => c.name);
const dernierMotCle = (db) => db.prepare('SELECT max(id) AS id FROM mot_cle').get().id;
const tablesDuDernierLot = (db) => db.prepare('SELECT DISTINCT table_nom AS t FROM modification WHERE lot_id = (SELECT id FROM modification_lot ORDER BY rowid DESC LIMIT 1)').all().map((l) => l.t);
/** Une page du guide sans mot-clé, prise par requête, ancrée par le test : { id, titre, mot_cle_id }. */
function pageAncree(m) {
  const p = m.un("SELECT id, titre FROM page WHERE type = 'guide' AND statut <> 'example' AND mot_cle_id IS NULL ORDER BY id LIMIT 1");
  return { ...p, mot_cle_id: ancrer(m, 'page', p.id) };
}
/** Un sort sans mot-clé, ancré par le test : l'id de son mot-clé. */
const sortAncre = (m) => ancrer(m, 'sort', m.un('SELECT id FROM sort WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1').id);

test('la base est à la structure 136 : le mot-clé n’a plus que son id, sa clé, son verrou et sa monnaie', () => {
  const { db } = nouvelle();
  assert.deepEqual(colonnesDuMotCle(db), ['id', 'cle', 'verrou', 'monnaie_id']);
});

test('créer : un mot-clé nu naît avec un repère à son nom ; une notion écrit sa définition sur sa page, sans repère', () => {
  const m = nouvelle();
  ok(lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Essai nu élément', description: 'Définition d’essai.', couleur: '#123456' } }], 'regles/glossaire/'));
  const id = dernierMotCle(m.db);
  const r = m.un('SELECT * FROM repere WHERE mot_cle_id = ?', id);
  assert.deepEqual({ nom: r.nom, adresse: r.adresse, definition: r.definition, couleur: r.couleur }, { nom: 'Essai nu élément', adresse: null, definition: 'Définition d’essai.', couleur: '#123456' });
  const lu = lireUnMotCle(m.db, id);
  assert.equal(lu.libelle, 'Essai nu élément');
  assert.equal(lu.cle, 'essai-nu-element');
  assert.deepEqual(lu.element, { table: 'repere', id });

  ok(parLaRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Essai de notion élément', description: 'Sa définition.' } }]));
  const notion = dernierMotCle(m.db);
  const page = m.un('SELECT id, titre, definition FROM page WHERE mot_cle_id = ?', notion);
  assert.equal(page.titre, 'Essai de notion élément');
  assert.equal(page.definition, 'Sa définition.');
  assert.equal(m.un('SELECT 1 AS x FROM repere WHERE mot_cle_id = ?', notion), undefined, 'pas de repère pour un mot-clé de page');
  assert.equal(lireUnMotCle(m.db, notion).description, 'Sa définition.');
});

test('renommer une page : le nom du mot-clé suit sans copie, la clé est recalculée ; un nom que la règle ne distingue pas n’est pas refusé', () => {
  const m = nouvelle();
  const p = pageAncree(m);
  const avant = lireUnMotCle(m.db, p.mot_cle_id);
  ok(parUnLot(m.db, [{ op: 'modifier', table: 'page', cle: { id: p.id }, valeurs: { titre: 'Titre renommé pour essai' } }]));
  const apres = lireUnMotCle(m.db, p.mot_cle_id);
  assert.equal(apres.libelle, 'Titre renommé pour essai');
  assert.equal(apres.cle, 'titre-renomme-pour-essai');
  assert.notEqual(apres.cle, avant.cle);
  const copies = m.db.prepare("SELECT 1 FROM modification WHERE table_nom = 'repere' AND cle = ?").all(JSON.stringify({ mot_cle_id: p.mot_cle_id }));
  assert.deepEqual(copies, [], 'son nom n’est copié sur aucun repère');
  assert.equal(m.un('SELECT 1 AS x FROM repere WHERE mot_cle_id = ?', p.mot_cle_id), undefined);

  // une seconde page prend le nom d'un mot-clé à repère de même catégorie : la règle ne sait pas les distinguer ; le renommage passe, la clé de son mot-clé reste
  const r = m.un(`SELECT r.mot_cle_id AS id, r.nom, (SELECT min(categorie_id) FROM mot_cle_categorie WHERE mot_cle_id = r.mot_cle_id) AS categorie FROM repere r
    WHERE EXISTS (SELECT 1 FROM mot_cle_categorie WHERE mot_cle_id = r.mot_cle_id) AND NOT EXISTS (SELECT 1 FROM page WHERE lower(titre) = lower(r.nom)) ORDER BY r.mot_cle_id LIMIT 1`);
  const libre = m.un("SELECT id FROM page WHERE type = 'guide' AND statut <> 'example' AND mot_cle_id IS NULL ORDER BY id LIMIT 1").id;
  const q = { id: libre, mot_cle_id: ancrer(m, 'page', libre, r.categorie) };
  ok(parUnLot(m.db, [{ op: 'modifier', table: 'page', cle: { id: q.id }, valeurs: { titre: 'Autre titre pour essai' } }]));
  const cleAvant = lireUnMotCle(m.db, q.mot_cle_id).cle;
  const cleDuRepere = lireUnMotCle(m.db, r.id).cle;
  ok(parUnLot(m.db, [{ op: 'modifier', table: 'page', cle: { id: q.id }, valeurs: { titre: r.nom } }]));
  const homonyme = lireUnMotCle(m.db, q.mot_cle_id);
  assert.equal(homonyme.libelle, r.nom);
  assert.equal(lireUnMotCle(m.db, r.id).cle, cleDuRepere);
  assert.equal(homonyme.cle, cleAvant, 'à trancher : la clé garde sa valeur');
  const controle = controlerLeContenu(m.db);
  const fautes = controle.emplacements.filter((e) => ['cle_du_mot_cle', 'homonymes'].includes(e.regle));
  assert.deepEqual(fautes, [], 'un nom à trancher n’est pas une erreur du contenu');
  assert.ok(controle.bilan.mots_cles_a_trancher >= 1);
});

test('Glossaire : un mot-clé à repère se modifie dans son repère ; un mot-clé ancré reste fermé aux routes ; un lot écrit sa définition sur sa page', () => {
  const m = nouvelle();
  ok(lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Repère d’essai' } }], 'regles/glossaire/'));
  const id = dernierMotCle(m.db);
  ok(parLaRoute(m.db, [{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle: 'Repère renommé pour essai', description: 'Écrite au Glossaire.', icone: null } }]));
  assert.ok(tablesDuDernierLot(m.db).includes('repere'), 'le journal note la ligne du repère');
  assert.ok(!tablesDuDernierLot(m.db).some((t) => t === 'page'));
  const r = m.un('SELECT nom, definition FROM repere WHERE mot_cle_id = ?', id);
  assert.deepEqual({ ...r }, { nom: 'Repère renommé pour essai', definition: 'Écrite au Glossaire.' });
  assert.equal(lireUnMotCle(m.db, id).cle, 'repere-renomme-pour-essai');

  const p = pageAncree(m);
  const refus = parLaRoute(m.db, [{ op: 'modifier', table: 'mot_cle', cle: { id: p.mot_cle_id }, valeurs: { description: 'Refusée.' } }]);
  assert.equal(refus.statut, 409, JSON.stringify(refus.corps));
  assert.equal(parUnLot(m.db, [{ op: 'modifier', table: 'mot_cle', cle: { id: p.mot_cle_id }, valeurs: { libelle: 'Autre nom' } }]).statut, 409, 'son nom vient de sa page');
  ok(parUnLot(m.db, [{ op: 'modifier', table: 'mot_cle', cle: { id: p.mot_cle_id }, valeurs: { description: 'Définition par un lot.' } }]));
  assert.equal(m.un('SELECT definition FROM page WHERE id = ?', p.id).definition, 'Définition par un lot.');
  assert.equal(lireUnMotCle(m.db, p.mot_cle_id).description, 'Définition par un lot.');
  // une route n'écrit pas la définition d'une page
  assert.equal(parLaRoute(m.db, [{ op: 'modifier', table: 'page', cle: { id: p.id }, valeurs: { definition: 'Par la route.' } }], p.id).statut, 409);

  const s = sortAncre(m);
  assert.equal(parUnLot(m.db, [{ op: 'modifier', table: 'mot_cle', cle: { id: s }, valeurs: { couleur: '#abcdef' } }]).statut, 409, 'un sort n’a pas de couleur');
});

test('fusion : le repère de l’absorbé part avec lui, la cible à repère prend la couleur qu’elle n’a pas', () => {
  const m = nouvelle();
  ok(lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Source d’essai', couleur: '#112233' } }], 'regles/glossaire/'));
  const source = dernierMotCle(m.db);
  ok(lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Cible d’essai' } }], 'regles/glossaire/'));
  const cible = dernierMotCle(m.db);
  ok(parLaRoute(m.db, [{ op: 'fusionner_mots_cles', mot_cle: source, dans: cible }]));
  assert.equal(m.un('SELECT 1 AS x FROM repere WHERE mot_cle_id = ?', source), undefined);
  assert.equal(m.un('SELECT 1 AS x FROM mot_cle WHERE id = ?', source), undefined);
  assert.equal(m.un('SELECT couleur FROM repere WHERE mot_cle_id = ?', cible).couleur, '#112233');
});

test('page de notion d’un mot-clé à repère : la page reprend sa définition, sa couleur et son icône, le repère part', () => {
  const m = nouvelle();
  ok(lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Notion à repère d’essai', description: 'Définie au repère.', couleur: '#445566' } }], 'regles/glossaire/'));
  const id = dernierMotCle(m.db);
  ok(parUnLot(m.db, [{ op: 'creer_page_de_notion', mot_cle_id: id }]));
  const page = m.un('SELECT id, titre, definition, couleur FROM page WHERE mot_cle_id = ?', id);
  assert.deepEqual({ titre: page.titre, definition: page.definition, couleur: page.couleur }, { titre: 'Notion à repère d’essai', definition: 'Définie au repère.', couleur: '#445566' });
  assert.equal(m.un('SELECT 1 AS x FROM repere WHERE mot_cle_id = ?', id), undefined);
  const lu = lireUnMotCle(m.db, id);
  assert.deepEqual(lu.element, { table: 'page', id: page.id });
  assert.equal(lu.description, 'Définie au repère.');
});

test('un mot-clé qui survit à sa page (R289) reçoit un repère à son nom, avec sa définition, sans adresse', () => {
  const m = nouvelle();
  ok(parLaRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Survivant d’essai', description: 'Il reste.' } }]));
  const id = dernierMotCle(m.db);
  const page = m.un('SELECT id FROM page WHERE mot_cle_id = ?', id).id;
  // une magie le tient (une référence de la base : R289)
  const magie = m.un('SELECT id FROM magie WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1') ?? m.un('SELECT id FROM magie ORDER BY id LIMIT 1');
  m.db.prepare('UPDATE magie SET mot_cle_id = ? WHERE id = ?').run(id, magie.id);
  m.db.exec('BEGIN');
  const w = ouvrirLot(m.db, { id: 'essai-survivant', instant: '2026-11-28T00:00:00Z' });
  supprimerPage({ db: m.db, w, instant: '2026-11-28T00:00:00Z', voie: 'lot' }, page);
  m.db.exec('COMMIT');
  const r = m.un('SELECT nom, adresse, definition FROM repere WHERE mot_cle_id = ?', id);
  assert.deepEqual({ ...r }, { nom: 'Survivant d’essai', adresse: null, definition: 'Il reste.' });
  assert.equal(lireUnMotCle(m.db, id).libelle, 'Survivant d’essai');
});

test('rejeu : une ligne de mot_cle d’avant la migration se lit sur l’élément du mot-clé', () => {
  const m = nouvelle();
  const p = pageAncree(m);
  const s = sortAncre(m);
  const adapte = ancienneEcritureDesColonnesDuMotCle(m.db);
  const r = m.un('SELECT mot_cle_id AS id FROM repere ORDER BY mot_cle_id LIMIT 1');
  const ligne = (operation, id, avant, apres, rang = 1) => ({
    lot_id: 'ancien', rang, table_nom: 'mot_cle', cle: JSON.stringify({ id }), operation, avant: avant && JSON.stringify(avant), apres: apres && JSON.stringify(apres),
  });
  // une insertion : les colonnes retirées partent, le repère se crée avant elle
  const insertion = adapte(ligne('inserer', 999001, null, { id: 999001, cle: 'ancien-essai', libelle: 'Ancien essai', url: '/races/', description: 'Ancienne.', couleur: null, icone: null, verrou: 0 }));
  assert.deepEqual(JSON.parse(insertion.apres), { id: 999001, cle: 'ancien-essai', verrou: 0 });
  assert.deepEqual(insertion.aCreer, [{ table: 'repere', valeurs: { mot_cle_id: 999001, nom: 'Ancien essai', adresse: '/races/', definition: 'Ancienne.', couleur: null, icone: null } }]);
  // le nom d'un mot-clé de page : une copie, sans effet ; sa définition : sur la page
  assert.equal(adapte(ligne('modifier', p.mot_cle_id, { libelle: 'A' }, { libelle: 'B' })).sansEffet, true);
  const definition = adapte(ligne('modifier', p.mot_cle_id, { libelle: 'A', description: null }, { libelle: 'B', description: 'D' }));
  assert.equal(definition.table_nom, 'page');
  assert.deepEqual(JSON.parse(definition.cle), { id: p.id });
  assert.deepEqual(JSON.parse(definition.apres), { definition: 'D' });
  // un mot-clé à repère : la modification vise son repère
  if (r) {
    const auRepere = adapte(ligne('modifier', r.id, { libelle: 'X', url: null }, { libelle: 'Y', url: '/races/' }));
    assert.equal(auRepere.table_nom, 'repere');
    assert.deepEqual(JSON.parse(auRepere.cle), { mot_cle_id: r.id });
    assert.deepEqual(JSON.parse(auRepere.apres), { nom: 'Y', adresse: '/races/' });
    // une page qui le reçoit plus loin dans le journal : la modification suivante vise la page
    const libre = m.un('SELECT id FROM page WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1');
    adapte({ lot_id: 'ancien', rang: 2, table_nom: 'page', cle: JSON.stringify({ id: libre.id }), operation: 'modifier', avant: JSON.stringify({ mot_cle_id: null }), apres: JSON.stringify({ mot_cle_id: r.id }) });
    assert.equal(adapte(ligne('modifier', r.id, { couleur: null }, { couleur: '#000000' }, 3)).table_nom, 'page');
  }
  // un mot-clé de sort : une couleur n'a pas d'équivalent
  assert.ok(adapte(ligne('modifier', s, { couleur: null }, { couleur: '#000000' })).conflit);
  // une suppression : `avant` réduit, le nom gardé à part
  const suppression = adapte(ligne('supprimer', 999001, { id: 999001, cle: 'ancien-essai', libelle: 'Ancien essai', verrou: 0 }, null));
  assert.deepEqual(JSON.parse(suppression.avant), { id: 999001, cle: 'ancien-essai', verrou: 0 });
  assert.equal(suppression.motCleRetire.libelle, 'Ancien essai');
  // une ligne d'aujourd'hui passe telle quelle
  const neuve = ligne('modifier', p.mot_cle_id, { cle: 'a' }, { cle: 'b' });
  assert.equal(adapte(neuve), neuve);
});

test('contrôles du contenu : tout mot-clé a une page, un sort ou un repère, et un repère ne double ni une page ni un sort', () => {
  const m = nouvelle();
  const regles = (c) => c.emplacements.filter((e) => ['mot_cle_sans_element', 'repere_en_double'].includes(e.regle));
  assert.deepEqual(regles(controlerLeContenu(m.db)), []);
  m.db.exec('PRAGMA foreign_keys = OFF');
  m.db.prepare('INSERT INTO mot_cle (id, cle) VALUES (?, ?)').run(999002, 'sans-element-d-essai');
  const p = pageAncree(m);
  m.db.prepare('INSERT INTO repere (mot_cle_id, nom) VALUES (?, ?)').run(p.mot_cle_id, 'Copie d’essai');
  const trouves = regles(controlerLeContenu(m.db)).map((e) => `${e.regle}:${e.id}`).sort();
  assert.deepEqual(trouves, [`mot_cle_sans_element:999002`, `repere_en_double:${p.mot_cle_id}`].sort());
});

test('annulation : un repère retiré se remet même si la page est encore là (l’état final se juge) ; un mot-clé absent reste refusé', () => {
  const m = nouvelle();
  const p = pageAncree(m);
  assert.match(refusDuRepere(m.db, 'repere', { mot_cle_id: p.mot_cle_id }) ?? '', /page/, 'un lot ne pose pas de repère sur un mot-clé de page');
  assert.equal(refusDuRepere(m.db, 'repere', { mot_cle_id: p.mot_cle_id }, { restaurer: true }), null, 'l’annulation le remet, la page part ensuite');
  assert.match(refusDuRepere(m.db, 'repere', { mot_cle_id: 999003 }, { restaurer: true }) ?? '', /n’existe pas/);
});

test('annulation : la page de notion retirée rend un repère à son mot-clé (titre, définition, couleur, icône, sans adresse), jamais un second', () => {
  const m = nouvelle();
  const annuleLaPage = (page) => {
    m.db.exec('BEGIN');
    const w = ouvrirLot(m.db, { id: `essai-annulation-${(n += 1)}`, instant: '2026-11-28T00:00:00Z' });
    supprimerPage({ db: m.db, w, instant: '2026-11-28T00:00:00Z', voie: 'lot', annulation: true, gel: false }, page);
    m.db.exec('COMMIT');
  };
  ok(parLaRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Notion annulée d’essai', description: 'Sa définition.' } }]));
  const id = dernierMotCle(m.db);
  const page = m.un('SELECT id FROM page WHERE mot_cle_id = ?', id).id;
  m.db.prepare('UPDATE page SET couleur = ? WHERE id = ?').run('#224466', page);
  annuleLaPage(page);
  const r = m.un('SELECT nom, adresse, definition, couleur, icone FROM repere WHERE mot_cle_id = ?', id);
  assert.deepEqual({ ...r }, { nom: 'Notion annulée d’essai', adresse: null, definition: 'Sa définition.', couleur: '#224466', icone: null });
  assert.deepEqual(lireUnMotCle(m.db, id).element, { table: 'repere', id });

  // le lot a déjà remis le repère (il passe avant la page dans l'annulation) : il reste seul et tel quel
  ok(parLaRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Notion remise d’essai', description: 'Sur la page.' } }]));
  const autre = dernierMotCle(m.db);
  const sienne = m.un('SELECT id FROM page WHERE mot_cle_id = ?', autre).id;
  m.db.prepare('INSERT INTO repere (mot_cle_id, nom, definition) VALUES (?, ?, ?)').run(autre, 'Repère remis d’essai', 'Remise.');
  annuleLaPage(sienne);
  const restes = m.db.prepare('SELECT nom, definition FROM repere WHERE mot_cle_id = ?').all(autre).map((l) => ({ ...l }));
  assert.deepEqual(restes, [{ nom: 'Repère remis d’essai', definition: 'Remise.' }]);
});

test('annulation : un sort retiré rend un repère à son nom à son mot-clé', () => {
  const m = nouvelle();
  // un sort neuf, copie d'un sort de la base sous un nom d'essai : aucune ligne ne le cite, il se retire seul
  const colonnes = m.db.prepare("SELECT name FROM pragma_table_info('sort')").all().map((c) => c.name);
  const modele = m.un('SELECT * FROM sort ORDER BY id LIMIT 1');
  const ordre = m.un('SELECT max(ordre) + 1 AS o FROM sort WHERE magie_id = ?', modele.magie_id).o;
  const sort = { ...modele, id: 'sort-annule-d-essai', nom: 'Sort annulé d’essai', ordre, mot_cle_id: null };
  m.db.prepare(`INSERT INTO sort (${colonnes.map((c) => `"${c}"`).join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...colonnes.map((c) => sort[c] ?? null));
  const id = ancrer(m, 'sort', sort.id);
  const r = appliquerUnLot(m.db, {
    titre: `Annulation d’essai ${(n += 1)}`, nature: 'code', annulation: true,
    travail: (h) => h.executer({ op: 'ecrire_supprimer', table: 'sort', cle: { id: sort.id } }, { gel: false }),
  });
  assert.ok(r.lot);
  assert.equal(m.un('SELECT 1 AS x FROM sort WHERE id = ?', sort.id), undefined);
  assert.deepEqual({ ...m.un('SELECT nom, adresse, definition FROM repere WHERE mot_cle_id = ?', id) }, { nom: sort.nom, adresse: null, definition: null });
});

test('ancrer_nouveau sans nom donné : le nom du mot-clé se lit sur l’élément, sans repère', () => {
  const m = nouvelle();
  const page = m.un("SELECT id FROM page WHERE type = 'lore' AND statut <> 'example' AND mot_cle_id IS NULL ORDER BY id LIMIT 1")
    ?? m.un("SELECT id FROM page WHERE statut <> 'example' AND mot_cle_id IS NULL ORDER BY id LIMIT 1");
  m.db.prepare('UPDATE page SET titre = ? WHERE id = ?').run('Titre d’ancrage d’essai', page.id);
  const categorie = m.un('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT 1').id;
  ok(parUnLot(m.db, [{ op: 'ancrer_nouveau', table: 'page', id: page.id, type: categorie }]));
  const id = m.un('SELECT mot_cle_id AS id FROM page WHERE id = ?', page.id).id;
  const lu = lireUnMotCle(m.db, id);
  assert.equal(lu.libelle, 'Titre d’ancrage d’essai');
  assert.deepEqual(lu.element, { table: 'page', id: page.id });
  assert.equal(m.un('SELECT 1 AS x FROM repere WHERE mot_cle_id = ?', id), undefined);
});
