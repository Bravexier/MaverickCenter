// Édition de la chronologie et du vocabulaire des mots-clés depuis le site de dev (serveur/edition-chronologie.mjs, migration 0043 ; demandes du
// propriétaire : modifier, créer avec une date et supprimer un événement ; « Date, Titre, Description, Lien » ; plusieurs catégories par événement, « créer,
// modifier et supprimer une catégorie. Une catégorie supprimée la retire de l'entrée » ; sur /recherche/, ajouter, renommer et supprimer un mot-clé, « une
// suppression d'un mot clé le supprimera de tous les endroits qui le référencent »). Les tests lisent l'état avant d'écrire et prennent des noms absents
// de la base : les essais du site de dev peuvent l'avoir modifiée.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { appliquerMiseAJour } from '../scripts/mise-a-jour-regles.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { SANS_CATEGORIE } from '../src/lib/chronologie.mjs';
import { chargerChronologie } from '../src/lib/chronologie-db.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { attributEd, ENTITES, lireAttributEd, TABLES } from '../src/lib/edition-modele.mjs';
import { MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { lirePages } from '../src/lib/pages-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { copieSansNoteEnAttente, versionALaRevision } from './aide-mise-a-jour.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROWS = join(RACINE, 'data', 'rows');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-chronologie-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const vivante = ({ sansExemples = false } = {}) =>
  ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
const db = vivante();
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
const enregistrer = (operations) => appel('POST', '/api/edition/', { page: 'chronologie/', operations });
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const ok = (r) => assert.equal(r.statut, 200, JSON.stringify(r.corps));
/** Un titre qu'aucun événement ne porte encore. */
const titreLibre = (base) => {
  let t = base;
  for (let i = 2; ligne('SELECT 1 FROM evenement WHERE titre_cle = ?', normalize(t)) || ligne('SELECT 1 FROM evenement WHERE id = ?', normalize(t)); i += 1) t = `${base} ${i}`;
  return t;
};
/** Un libellé de mot-clé que le vocabulaire n'a pas. */
const motLibre = (base) => {
  let t = base;
  for (let i = 2; ligne('SELECT 1 FROM mot_cle WHERE libelle_cle = ?', normalize(t)); i += 1) t = `${base} ${i}`;
  return t;
};
/** Un nom de catégorie que la chronologie n'a pas. */
const categorieLibre = (base) => {
  let t = base;
  for (let i = 2; ligne('SELECT 1 FROM categorie_chronologie WHERE libelle_cle = ?', normalize(t)); i += 1) t = `${base} ${i}`;
  return t;
};
const categoriesDe = (id) => lignes('SELECT categorie_id FROM evenement_categorie WHERE evenement_id = ? ORDER BY categorie_id', id).map((c) => c.categorie_id);
const creerCategorie = (libelle) => {
  const r = enregistrer([{ op: 'creer', entite: 'categorie_chronologie', valeurs: { libelle } }]);
  ok(r);
  return r.corps.crees[0].id;
};
const creerMotCle = (libelle) => {
  const r = enregistrer([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle } }]);
  ok(r);
  return r.corps.crees[0].id;
};
/** Une page du wiki (ni exemple) pour le lien d'un bloc. */
const pageDuCodex = () => ligne("SELECT id, titre FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1");

test('le modèle : un événement, un bloc de description, une catégorie et un mot-clé se modifient, se créent et se suppriment ; leurs data-ed se relisent', () => {
  for (const t of ['evenement', 'evenement_extrait', 'categorie_chronologie', 'mot_cle']) {
    assert.ok(TABLES[t], t);
    assert.ok(ENTITES[t]?.suppression, `${t} : suppression`);
  }
  assert.deepEqual(Object.keys(ENTITES.evenement.champs).sort(), ['annee', 'annee_fin', 'categories', 'description', 'epoque', 'lien', 'titre'], 'date, titre, description, lien, catégories');
  assert.equal(lireAttributEd(attributEd('evenement', { id: 'x' }, 'titre'))?.colonne, 'titre');
  assert.equal(lireAttributEd(attributEd('evenement', { id: 'x' }, 'rang')), null, 'le rang ne se saisit pas');
  assert.equal(lireAttributEd(attributEd('evenement_extrait', { evenement_id: 'x', rang: 1 }, 'date_brut')), null, 'la date surlignée se recalcule');
  assert.equal(lireAttributEd(attributEd('mot_cle', { id: 'x' }, 'libelle_cle')), null);
});

test('créer un événement : date, titre, description, lien, catégories ; id tiré du titre, à sa place dans la frise ; refus', () => {
  const titre = titreLibre('Événement d’essai');
  const page = pageDuCodex();
  const categories = [creerCategorie(categorieLibre('Essai guerre')), creerCategorie(categorieLibre('Essai fondation'))];
  const r = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'datee', annee: '231', titre, description: '**Une** description d’essai.', lien: page.id, categories } }]);
  ok(r);
  const id = r.corps.crees[0].id;
  assert.equal(id, normalize(titre));
  const e = ligne('SELECT * FROM evenement WHERE id = ?', id);
  assert.deepEqual([e.titre, e.titre_cle, e.epoque, e.annee, e.annee_fin, e.portee, e.lieu, e.origine], [titre, normalize(titre), 'datee', 231, null, null, null, 'chronologie']);
  assert.match(e.source_ref, /^Site de dev › édition du \d{4}-\d\d-\d\d › /);
  assert.equal(e.rang, ligne('SELECT max(rang) AS m FROM evenement').m, 'rang : le plus grand (après les événements de sa date)');
  assert.deepEqual(lignes('SELECT rang, page_id, section, texte, date_brut FROM evenement_extrait WHERE evenement_id = ?', id),
    [{ rang: 1, page_id: page.id, section: null, texte: '**Une** description d’essai.', date_brut: null }]);
  assert.deepEqual(categoriesDe(id), [...categories].sort());
  // dans la frise : après le dernier événement de l'an 231 ou d'avant, avant le premier d'après
  const frise = chargerChronologie(db);
  const i = frise.findIndex((x) => x.id === id);
  assert.ok(frise.slice(0, i).every((x) => x.epoque === 'debut' || (x.epoque === 'datee' && x.annee <= 231)));
  assert.ok(frise.slice(i + 1).every((x) => x.epoque !== 'debut' && !(x.epoque === 'datee' && x.annee < 231)));
  assert.equal(frise[i].extraits[0].page_titre, page.titre);
  assert.deepEqual(frise[i].categories.map((c) => c.id).sort(), [...categories].sort());
  // ce que la page demande en mode modification
  const lu = appel('POST', '/api/edition/evenement/', { evenement: id });
  ok(lu);
  assert.deepEqual(lu.corps.categories.map((c) => c.id).sort(), [...categories].sort());
  assert.equal(lu.corps.blocs[0].page_titre, page.titre);
  assert.equal(appel('POST', '/api/edition/evenement/', { evenement: 'aucun-evenement-de-ce-nom' }).statut, 404);
  // le même titre : un autre id
  const bis = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre, description: 'Encore.' } }]);
  ok(bis);
  assert.equal(bis.corps.crees[0].id, `${id}-2`);
  assert.equal(ligne('SELECT page_id FROM evenement_extrait WHERE evenement_id = ?', `${id}-2`).page_id, null, 'sans lien');
  // refus
  const refus = (valeurs) => enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'datee', annee: '5', titre: titreLibre('Refusé'), description: 'Texte.', ...valeurs } }]);
  assert.equal(refus({ annee: '' }).statut, 400, 'daté sans année');
  assert.equal(refus({ epoque: 'debut' }).statut, 400, 'une année hors des événements datés');
  assert.equal(refus({ annee_fin: '2' }).statut, 400, 'fin avant le début');
  assert.equal(refus({ description: '' }).statut, 400, 'description obligatoire');
  assert.equal(refus({ titre: '!!' }).statut, 400, 'titre sans lettre');
  assert.equal(refus({ lien: 'races/exemple-race' }).statut, 400, 'page d’exemple');
  assert.equal(refus({ lien: 'lore/aucune-page-de-ce-nom' }).statut, 400, 'page inconnue');
  assert.equal(refus({ categories: ['aucune-categorie-de-ce-nom'] }).statut, 400, 'catégorie inconnue');
  assert.equal(refus({ description: 'Voir <script>alert(1)</script>' }).statut, 400, 'HTML brut');
  assert.equal(refus({ description: '[clic](javascript:alert(1))' }).statut, 400, 'lien non sûr');
});

test('modifier un événement : titre (sa clé suit), date (passer hors des années efface l’année), Impact et lieu ; refus', () => {
  const id = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'datee', annee: '12', annee_fin: '20', titre: titreLibre('À modifier'), description: 'Texte.' } }]).corps.crees[0].id;
  const modifier = (valeurs, avant) => enregistrer([{ op: 'modifier', table: 'evenement', cle: { id }, valeurs, ...(avant ? { avant } : {}) }]);
  const titre = titreLibre('Modifié');
  ok(modifier({ titre }));
  assert.equal(ligne('SELECT titre_cle FROM evenement WHERE id = ?', id).titre_cle, normalize(titre));
  assert.equal(ligne('SELECT id FROM evenement WHERE id = ?', id).id, id, 'l’id (l’adresse) ne change pas');
  ok(modifier({ epoque: 'inconnue' }));
  assert.deepEqual({ ...ligne('SELECT epoque, annee, annee_fin FROM evenement WHERE id = ?', id) }, { epoque: 'inconnue', annee: null, annee_fin: null });
  assert.equal(modifier({ annee: '40' }).statut, 400, 'une année pour un événement daté seulement');
  assert.equal(modifier({ epoque: 'datee' }).statut, 400, 'daté sans année');
  ok(modifier({ epoque: 'datee', annee: '-40', annee_fin: '-20' }));
  assert.equal(modifier({ annee_fin: '-50' }).statut, 400, 'fin avant le début');
  assert.equal(modifier({ lieu: 'Erisia' }).statut, 400, 'un lieu sans Impact');
  ok(modifier({ portee: 'mineur', lieu: 'Erisia' }));
  assert.equal(modifier({ portee: '' }).statut, 400, 'retirer l’Impact garde un lieu : refusé');
  ok(modifier({ portee: '', lieu: '' }));
  assert.equal(modifier({ titre: 'autre' }, { titre: 'ce n’était pas lui' }).statut, 409, 'modifié entre-temps');
});

test('blocs de description : le texte (date surlignée suivie), le lien (la section part avec l’ancienne page) ; ajouter, retirer, pas le dernier', () => {
  // un extrait importé dont la date est écrite échappée (« \-112 ») : l'éditeur en place la réécrit « -112 »
  const bloc = ligne('SELECT * FROM evenement_extrait WHERE instr(date_brut, char(92)) > 0 ORDER BY evenement_id, rang LIMIT 1');
  assert.ok(bloc, 'un extrait à date échappée');
  const cle = { evenement_id: bloc.evenement_id, rang: bloc.rang };
  const modifier = (valeurs) => enregistrer([{ op: 'modifier', table: 'evenement_extrait', cle, valeurs }]);
  const sans = bloc.texte.replace(/\\([!-/:-@[-`{-~])/g, '$1');
  ok(modifier({ texte: `${sans}\n\nUne phrase ajoutée.` }));
  assert.equal(ligne('SELECT date_brut FROM evenement_extrait WHERE evenement_id = ? AND rang = ?', bloc.evenement_id, bloc.rang).date_brut,
    bloc.date_brut.replace(/\\([!-/:-@[-`{-~])/g, '$1'), 'la date suit sa nouvelle écriture');
  ok(modifier({ texte: 'Plus de date ici.' }));
  assert.equal(ligne('SELECT date_brut FROM evenement_extrait WHERE evenement_id = ? AND rang = ?', bloc.evenement_id, bloc.rang).date_brut, null);
  assert.equal(modifier({ texte: 'Du <b>HTML</b>' }).statut, 400);
  assert.equal(modifier({ texte: '' }).statut, 400);
  // le lien
  const autre = ligne("SELECT id FROM page WHERE type = 'races' AND statut <> 'example' ORDER BY id LIMIT 1").id;
  ok(modifier({ page_id: autre }));
  assert.deepEqual({ ...ligne('SELECT page_id, section FROM evenement_extrait WHERE evenement_id = ? AND rang = ?', bloc.evenement_id, bloc.rang) }, { page_id: autre, section: null });
  ok(modifier({ page_id: '' }));
  assert.equal(ligne('SELECT page_id FROM evenement_extrait WHERE evenement_id = ? AND rang = ?', bloc.evenement_id, bloc.rang).page_id, null);
  assert.equal(modifier({ page_id: 'classes/exemple-classe' }).statut, 400, 'page d’exemple');
  // ajouter un bloc, le retirer ; le dernier reste
  const id = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'aujourdhui', titre: titreLibre('Deux blocs'), description: 'Premier.' } }]).corps.crees[0].id;
  ok(enregistrer([{ op: 'creer', entite: 'evenement_extrait', valeurs: { evenement_id: id, texte: 'Second.', lien: pageDuCodex().id } }]));
  assert.deepEqual(lignes('SELECT rang, texte FROM evenement_extrait WHERE evenement_id = ? ORDER BY rang', id), [{ rang: 1, texte: 'Premier.' }, { rang: 2, texte: 'Second.' }]);
  ok(enregistrer([{ op: 'supprimer', entite: 'evenement_extrait', cle: { evenement_id: id, rang: 1 } }]));
  const seul = enregistrer([{ op: 'supprimer', entite: 'evenement_extrait', cle: { evenement_id: id, rang: 2 } }]);
  assert.equal(seul.statut, 409, 'la seule description d’un événement');
  assert.match(seul.corps.erreur ?? JSON.stringify(seul.corps), /seule description/);
});

test('catégories d’un événement (opération `categories`) : poser, retirer (« Sans catégorie »), conflit', () => {
  const id = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: titreLibre('Essai catégories'), description: 'Texte.' } }]).corps.crees[0].id;
  const [a, b] = [creerCategorie(categorieLibre('Essai rang A')), creerCategorie(categorieLibre('Essai rang B'))];
  assert.deepEqual(categoriesDe(id), [], 'créé sans catégorie');
  ok(enregistrer([{ op: 'categories', evenement: id, categories: [a, b] }]));
  assert.deepEqual(categoriesDe(id), [a, b].sort());
  ok(enregistrer([{ op: 'categories', evenement: id, categories: [b], avant: [a, b] }]));
  assert.deepEqual(categoriesDe(id), [b]);
  assert.equal(enregistrer([{ op: 'categories', evenement: id, categories: [], avant: [a, b] }]).statut, 409, 'lues avant un autre changement');
  ok(enregistrer([{ op: 'categories', evenement: id, categories: [] }]));
  assert.deepEqual(categoriesDe(id), [], 'sans catégorie : « Sans catégorie (à trier) »');
  assert.equal(enregistrer([{ op: 'categories', evenement: id, categories: ['aucune-categorie-de-ce-nom'] }]).statut, 400);
  assert.equal(enregistrer([{ op: 'categories', evenement: id, categories: 'a' }]).statut, 400);
  assert.equal(enregistrer([{ op: 'categories', evenement: 'aucun-evenement', categories: [] }]).statut, 404);
});

test('catégories : créer, renommer (l’id reste), refus d’une écriture prise ou réservée, supprimer (retirée de ses événements) ; l’id ne resert pas', () => {
  const nom = categorieLibre('Essai catégorie');
  const id = creerCategorie(nom);
  assert.equal(id, normalize(nom));
  assert.deepEqual({ ...ligne('SELECT libelle, libelle_cle FROM categorie_chronologie WHERE id = ?', id) }, { libelle: nom, libelle_cle: normalize(nom) });
  assert.equal(enregistrer([{ op: 'creer', entite: 'categorie_chronologie', valeurs: { libelle: nom.toUpperCase() } }]).statut, 409, 'même écriture');
  assert.equal(enregistrer([{ op: 'creer', entite: 'categorie_chronologie', valeurs: { libelle: 'Sans catégorie' } }]).statut, 400, `« ${SANS_CATEGORIE} » est le choix du filtre`);
  assert.equal(enregistrer([{ op: 'creer', entite: 'categorie_chronologie', valeurs: { libelle: 'Sans catégorie (à trier)' } }]).statut, 400, 'ni son libellé');
  assert.equal(enregistrer([{ op: 'creer', entite: 'categorie_chronologie', valeurs: { libelle: '!!' } }]).statut, 400, 'sans lettre');
  // deux événements la portent
  const e1 = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: titreLibre('Porteur 1'), description: 'Texte.', categories: [id] } }]).corps.crees[0].id;
  const e2 = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: titreLibre('Porteur 2'), description: 'Texte.', categories: [id] } }]).corps.crees[0].id;
  // renommer : l'id (et l'adresse /chronologie/?filtre=<id>) reste, les événements la gardent
  const renomme = categorieLibre(`${nom} (renommée)`);
  ok(enregistrer([{ op: 'modifier', table: 'categorie_chronologie', cle: { id }, valeurs: { libelle: renomme }, avant: { libelle: nom } }]));
  assert.deepEqual({ ...ligne('SELECT libelle, libelle_cle FROM categorie_chronologie WHERE id = ?', id) }, { libelle: renomme, libelle_cle: normalize(renomme) });
  assert.deepEqual([categoriesDe(e1), categoriesDe(e2)], [[id], [id]]);
  const autre = creerCategorie(categorieLibre('Essai autre'));
  assert.equal(enregistrer([{ op: 'modifier', table: 'categorie_chronologie', cle: { id: autre }, valeurs: { libelle: renomme.toLowerCase() } }]).statut, 409, 'écriture prise');
  ok(enregistrer([{ op: 'modifier', table: 'categorie_chronologie', cle: { id }, valeurs: { libelle: renomme.toUpperCase() } }]), 'sa propre écriture, autre casse');
  // GET /api/edition/chronologie/ : les catégories et leur nombre d'événements
  const vue = appel('GET', '/api/edition/chronologie/');
  ok(vue);
  assert.equal(vue.corps.categories.find((c) => c.id === id).evenements, 2);
  assert.deepEqual(vue.corps.evenements.find((e) => e.id === e1).categories, [{ id, libelle: renomme.toUpperCase() }]);
  // supprimer : retirée de ses deux événements, qui restent
  const r = enregistrer([{ op: 'supprimer', entite: 'categorie_chronologie', cle: { id } }]);
  ok(r);
  assert.deepEqual([categoriesDe(e1), categoriesDe(e2)], [[], []]);
  assert.ok(ligne('SELECT 1 FROM evenement WHERE id = ?', e1) && ligne('SELECT 1 FROM evenement WHERE id = ?', e2));
  assert.equal(ligne('SELECT 1 FROM categorie_chronologie WHERE id = ?', id), undefined);
  assert.equal(enregistrer([{ op: 'supprimer', entite: 'categorie_chronologie', cle: { id } }]).statut, 404);
  // un lot : supprimer une catégorie puis en créer une du même nom (gestion des catégories : suppressions d'abord) ; l'id ne resert pas
  const n2 = categorieLibre('Essai recréée');
  const c2 = creerCategorie(n2);
  const lot = enregistrer([{ op: 'supprimer', entite: 'categorie_chronologie', cle: { id: c2 } }, { op: 'creer', entite: 'categorie_chronologie', valeurs: { libelle: n2 } }]);
  ok(lot);
  assert.equal(lot.corps.crees.at(-1).id, `${c2}-2`);
});

test('supprimer un événement : ses blocs et ses catégories partent avec lui ; son id ne resservira pas', () => {
  const titre = titreLibre('Éphémère');
  const id = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'datee', annee: '3', titre, description: 'Texte.', categories: [creerCategorie(categorieLibre('Essai éphémère'))] } }]).corps.crees[0].id;
  ok(enregistrer([{ op: 'supprimer', entite: 'evenement', cle: { id } }]));
  for (const t of ['evenement_categorie', 'evenement_extrait']) assert.equal(ligne(`SELECT count(*) AS n FROM ${t} WHERE evenement_id = ?`, id).n, 0, t);
  assert.equal(ligne('SELECT 1 FROM evenement WHERE id = ?', id), undefined);
  const recree = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'datee', annee: '3', titre, description: 'Texte.' } }]);
  ok(recree);
  assert.equal(recree.corps.crees[0].id, `${id}-2`, 'un id de l’historique ou du journal ne resert pas');
  assert.equal(enregistrer([{ op: 'supprimer', entite: 'evenement', cle: { id } }]).statut, 404);
});

test('vocabulaire : créer, renommer (l’écriture change partout), refus d’une écriture prise, fusion, suppression de toutes les pages', () => {
  // créer
  const libelle = motLibre('Essai vocabulaire');
  const id = creerMotCle(libelle);
  assert.equal(id, normalize(libelle));
  assert.equal(enregistrer([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libelle.toUpperCase() } }]).statut, 409, 'même écriture');
  // renommer un mot-clé posé sur des pages : l'id reste, les pages montrent la nouvelle écriture
  const surPages = ligne(`SELECT m.* FROM mot_cle m WHERE (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) >= 2 AND m.libelle_cle NOT IN (${[...MOTS_CLES_PROTEGES.keys()].map(() => '?').join(', ')}) ORDER BY m.id LIMIT 1`, ...MOTS_CLES_PROTEGES.keys());
  const pages = lignes('SELECT page_id FROM page_tag WHERE tag_id = ? ORDER BY page_id', surPages.id).map((p) => p.page_id);
  const nouveau = motLibre(`${surPages.libelle} (renommé)`);
  ok(enregistrer([{ op: 'modifier', table: 'mot_cle', cle: { id: surPages.id }, valeurs: { libelle: nouveau }, avant: { libelle: surPages.libelle } }]));
  assert.deepEqual({ ...ligne('SELECT libelle, libelle_cle FROM mot_cle WHERE id = ?', surPages.id) }, { libelle: nouveau, libelle_cle: normalize(nouveau) });
  assert.deepEqual(lignes('SELECT page_id FROM page_tag WHERE tag_id = ? ORDER BY page_id', surPages.id).map((p) => p.page_id), pages, 'les pages gardent le mot-clé');
  const exportees = lirePages(db).filter((p) => pages.includes(p.id));
  assert.ok(exportees.every((p) => p.tags.includes(nouveau)), 'le frontmatter des pages montre la nouvelle écriture');
  // vers l'écriture d'un autre : refusé, la fusion est proposée
  const prise = enregistrer([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle: nouveau.toLowerCase() } }]);
  assert.equal(prise.statut, 409);
  assert.deepEqual(prise.corps.fusion, { mot_cle: id, dans: surPages.id });
  assert.equal(enregistrer([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle: 'Race hybride' } }]).statut, 409, 'écriture d’un mot-clé dont le site se sert');
  // fusion : une page qui avait les deux perd seulement l'ancien
  const paire = ligne(`SELECT a.page_id, a.tag_id AS A, b.tag_id AS B FROM page_tag a JOIN page_tag b ON b.page_id = a.page_id AND b.tag_id <> a.tag_id
    JOIN mot_cle ma ON ma.id = a.tag_id JOIN mot_cle mb ON mb.id = b.tag_id
    WHERE ma.libelle_cle NOT IN (${[...MOTS_CLES_PROTEGES.keys()].map(() => '?').join(', ')}) AND mb.libelle_cle NOT IN (${[...MOTS_CLES_PROTEGES.keys()].map(() => '?').join(', ')})
      AND a.tag_id <> ? AND b.tag_id <> ? ORDER BY a.page_id, a.tag_id LIMIT 1`, ...MOTS_CLES_PROTEGES.keys(), ...MOTS_CLES_PROTEGES.keys(), surPages.id, surPages.id);
  const pagesDeA = lignes('SELECT page_id FROM page_tag WHERE tag_id = ?', paire.A).map((p) => p.page_id);
  ok(enregistrer([{ op: 'fusionner_mots_cles', mot_cle: paire.A, dans: paire.B }]));
  assert.equal(ligne('SELECT 1 FROM mot_cle WHERE id = ?', paire.A), undefined);
  for (const p of pagesDeA) assert.ok(ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?', p, paire.B), p);
  assert.equal(ligne('SELECT count(*) AS n FROM page_tag WHERE page_id = ? AND tag_id = ?', paire.page_id, paire.B).n, 1, 'pas de doublon');
  // suppression : de toutes les pages
  const r = enregistrer([{ op: 'supprimer', entite: 'mot_cle', cle: { id: surPages.id } }]);
  ok(r);
  assert.equal(ligne('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?', surPages.id).n, 0);
  assert.equal(ligne('SELECT 1 FROM mot_cle WHERE id = ?', surPages.id), undefined);
  // l'id d'un mot-clé supprimé ne resert pas
  assert.equal(creerMotCle(surPages.libelle), `${surPages.id}-2`);
});

test('mots-clés dont le site se sert : ni renommés (même en casse), ni supprimés, ni fusionnés (dans un sens ou l’autre), ni créés seuls', () => {
  const magique = ligne("SELECT * FROM mot_cle WHERE libelle_cle = 'magique'");
  const codex = ligne("SELECT * FROM mot_cle WHERE libelle_cle = 'codex'");
  const libre = creerMotCle(motLibre('Essai protégé'));
  const renommer = enregistrer([{ op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs: { libelle: 'Magie de classe' } }]);
  assert.equal(renommer.statut, 409);
  assert.match(renommer.corps.erreur ?? JSON.stringify(renommer.corps), /classes/);
  assert.equal(enregistrer([{ op: 'supprimer', entite: 'mot_cle', cle: { id: codex.id } }]).statut, 409);
  assert.equal(enregistrer([{ op: 'fusionner_mots_cles', mot_cle: libre, dans: magique.id }]).statut, 409);
  assert.equal(enregistrer([{ op: 'fusionner_mots_cles', mot_cle: codex.id, dans: libre }]).statut, 409);
  assert.equal(enregistrer([{ op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs: { libelle: 'Magique' } }]).statut, 409, 'ni même sa casse : les règles lisent son écriture exacte');
  // un mot-clé dont le site se sert ne se crée pas seul (il ne se retirerait plus) : il vient avec ses pages
  const absent = [...MOTS_CLES_PROTEGES.keys()].find((cle) => !ligne('SELECT 1 FROM mot_cle WHERE libelle_cle = ?', cle));
  if (absent) assert.equal(enregistrer([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: absent } }]).statut, 409, absent);
  // GET /api/edition/mots-cles/ : le vocabulaire, ce qui porte chaque mot-clé, et la raison d'une protection
  const v = appel('GET', '/api/edition/mots-cles/');
  ok(v);
  const m = v.corps.motsCles.find((x) => x.id === magique.id);
  assert.equal(m.pages, ligne('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?', magique.id).n);
  assert.match(m.protege, /Magiques/);
  assert.equal(v.corps.motsCles.find((x) => x.id === libre).protege, null);
});

test('une page supprimée par le site (métier) : le bloc de description qui la citait garde son texte et perd son lien', () => {
  const nom = (() => {
    let n = 'Métier lié';
    for (let i = 2; ligne('SELECT 1 FROM metier WHERE nom = ?', n); i += 1) n = `Métier lié ${i}`;
    return n;
  })();
  const metier = enregistrer([{ op: 'creer', entite: 'metier', valeurs: { nom } }]).corps.crees[0].id;
  const id = enregistrer([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'debut', titre: titreLibre('Lié à un métier'), description: 'Texte.', lien: metier } }]).corps.crees[0].id;
  ok(enregistrer([{ op: 'supprimer', entite: 'metier', cle: { id: metier } }]));
  assert.deepEqual({ ...ligne('SELECT page_id, section, texte FROM evenement_extrait WHERE evenement_id = ?', id) }, { page_id: null, section: null, texte: 'Texte.' });
});

test('mot-clé d’une spécialité créée puis renommée : la fiche du don passe au nouveau nom, l’ancien mot-clé (sans page) quitte le vocabulaire', () => {
  const nomClasse = (() => {
    let n = 'Classe des mots-clés';
    for (let i = 2; ligne('SELECT 1 FROM classe WHERE nom = ?', n); i += 1) n = `Classe des mots-clés ${i}`;
    return n;
  })();
  const classe = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-magique', nom: nomClasse } }]).corps.crees[0].id;
  const avant = motLibre('Voie première');
  const r = enregistrer([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: classe, nom: avant, don_nom: `${avant} (don)`, don_type: 'Passif' } }]);
  ok(r);
  const specialite = r.corps.crees.find((c) => c.entite === 'specialite').id;
  const don = ligne('SELECT id FROM capacite WHERE specialite_id = ?', specialite).id;
  const ancien = ligne('SELECT id FROM mot_cle WHERE libelle_cle = ?', normalize(avant)).id;
  assert.ok(ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?', don, ancien), 'la fiche du don porte le mot-clé de sa spécialité');
  const apres = motLibre('Voie seconde');
  ok(enregistrer([{ op: 'modifier', table: 'specialite', cle: { id: specialite }, valeurs: { nom: apres } }]));
  const nouveau = ligne('SELECT * FROM mot_cle WHERE libelle_cle = ?', normalize(apres));
  assert.equal(nouveau.libelle, apres.toLowerCase());
  assert.ok(ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?', don, nouveau.id));
  assert.equal(ligne('SELECT 1 FROM mot_cle WHERE id = ?', ancien), undefined, 'l’ancien nom ne range plus rien');
});

test('rejeu du journal (livraison) : la chronologie et le vocabulaire reviennent à l’identique, sans conflit', () => {
  const journal = journalExporte(db);
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  const conflits = neuve.prepare("SELECT m.table_nom, m.cle, m.operation, m.detail FROM modification m WHERE m.etat = 'conflit' LIMIT 5").all().map((c) => ({ ...c }));
  assert.equal(bilan.conflits, 0, JSON.stringify(conflits));
  for (const t of ['evenement', 'evenement_extrait', 'evenement_categorie', 'categorie_chronologie', 'mot_cle', 'page_tag']) {
    const lire = (base) => base.prepare(`SELECT * FROM "${t}"`).all().map((l) => JSON.stringify(l)).sort();
    assert.deepEqual(lire(neuve), lire(db), t);
  }
  assert.deepEqual(neuve.prepare('PRAGMA foreign_key_check').all(), []);
  neuve.close();
});

test('rejeu : des renommages qui réemploient un nom libéré (Guerre → Guerres, Conflit → Guerre, puis retour) reviennent sans conflit, dans l’ordre', () => {
  const base = vivante();
  const service2 = { base: () => base, etat: () => ({}), edition: true };
  const lot = (operations) => {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'chronologie/', operations }) }, service2);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    return r.corps;
  };
  const nom = (b) => {
    let t = b;
    for (let i = 2; base.prepare('SELECT 1 FROM categorie_chronologie WHERE libelle_cle = ?').get(normalize(t)); i += 1) t = `${b} ${i}`;
    return t;
  };
  const [g, gs, c, b] = [nom('Essai guerre'), nom('Essai guerres'), nom('Essai conflit'), nom('Essai batailles')];
  const guerre = lot([{ op: 'creer', entite: 'categorie_chronologie', valeurs: { libelle: g } }]).crees[0].id;
  const conflit = lot([{ op: 'creer', entite: 'categorie_chronologie', valeurs: { libelle: c } }]).crees[0].id;
  const renommer = (id, avant, apres) => lot([{ op: 'modifier', table: 'categorie_chronologie', cle: { id }, valeurs: { libelle: apres }, avant: { libelle: avant } }]);
  renommer(guerre, g, gs);
  renommer(conflit, c, g);
  renommer(conflit, g, b);
  renommer(guerre, gs, g);
  const attendu = base.prepare('SELECT id, libelle FROM categorie_chronologie WHERE id IN (?, ?) ORDER BY id').all(guerre, conflit).map((l) => ({ ...l }));
  assert.deepEqual(attendu.map((l) => l.libelle).sort(), [b, g].sort());
  // la base vivante refaite (livraison), le journal rejoué
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journalExporte(base));
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  assert.equal(bilan.conflits, 0, JSON.stringify(neuve.prepare("SELECT table_nom, cle, detail FROM modification WHERE etat = 'conflit'").all()));
  assert.deepEqual(neuve.prepare('SELECT id, libelle FROM categorie_chronologie WHERE id IN (?, ?) ORDER BY id').all(guerre, conflit).map((l) => ({ ...l })), attendu);
  neuve.close();
  base.close();
});

/** Une base vivante neuve qui reçoit le journal de `source` TEL QU'IL EST (états compris), comme base-vivante.mjs#transferer à une livraison. */
function rebatir(source) {
  const neuve = vivante();
  for (const l of source.prepare('SELECT * FROM modification_lot').all()) {
    neuve.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of source.prepare('SELECT * FROM modification').all()) {
    neuve.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.etat, m.detail, m.apercu);
  }
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  return { base: neuve, bilan, conflits: neuve.prepare("SELECT table_nom, cle, detail FROM modification WHERE etat = 'conflit'").all().map((c) => ({ ...c })) };
}
const serviceDe = (base) => (operations) => {
  const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'chronologie/', operations }) }, { base: () => base, etat: () => ({}), edition: true });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};

test('rejeu : une ligne créée puis supprimée (métier) citée entre-temps (lien d’une description) — sans conflit à la 1re livraison NI à la 2e', () => {
  const base = vivante();
  const lot = serviceDe(base);
  let nom = 'Métier fantôme';
  for (let i = 2; base.prepare('SELECT 1 FROM metier WHERE nom = ?').get(nom); i += 1) nom = `Métier fantôme ${i}`;
  const metier = lot([{ op: 'creer', entite: 'metier', valeurs: { nom } }]).crees[0].id;
  const page = base.prepare('SELECT id FROM page WHERE id = ?').get(metier)?.id ?? base.prepare("SELECT id FROM page WHERE type = 'metiers' AND titre = ?").get(nom).id;
  const evenement = lot([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: titreLibre('Lié au métier'), description: 'Texte.', lien: page } }]).crees[0].id;
  lot([{ op: 'supprimer', entite: 'metier', cle: { id: metier } }]);
  assert.equal(base.prepare('SELECT page_id FROM evenement_extrait WHERE evenement_id = ?').get(evenement).page_id, null, 'la description a perdu son lien');
  const premiere = rebatir(base);
  assert.deepEqual(premiere.conflits, [], '1re livraison');
  const seconde = rebatir(premiere.base);
  assert.deepEqual(seconde.conflits, [], '2e livraison : les états « intégrés » de la 1re comptent');
  assert.ok(seconde.base.prepare('SELECT 1 FROM evenement WHERE id = ?').get(evenement));
  for (const b of [base, premiere.base, seconde.base]) b.close();
});

test('rejeu : une ligne créée puis supprimée, que cite une ligne existante, dont la suppression part en conflit — insérée pour de bon, aucune référence rompue', () => {
  const base = vivante();
  const lot = serviceDe(base);
  // N : un mot-clé neuf ; S : un mot-clé existant posé sur des pages, fusionné dans N (ses lignes page_tag, existantes, passent à N)
  let libre = 'Essai fantôme';
  for (let i = 2; base.prepare('SELECT 1 FROM mot_cle WHERE libelle_cle = ?').get(normalize(libre)); i += 1) libre = `Essai fantôme ${i}`;
  const n = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libre } }]).crees[0].id;
  const proteges = [...MOTS_CLES_PROTEGES.keys()];
  const source = base.prepare(`SELECT m.id FROM mot_cle m WHERE m.libelle_cle NOT IN (${proteges.map(() => '?').join(', ')})
    AND (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) BETWEEN 1 AND 3 ORDER BY m.id LIMIT 1`).get(...proteges).id;
  const lignes = base.prepare('SELECT page_id, ordre FROM page_tag WHERE tag_id = ?').all(source).map((l) => ({ ...l }));
  lot([{ op: 'fusionner_mots_cles', mot_cle: source, dans: n }]);
  // puis N est supprimé (ses lignes page_tag avec lui), dans un lot qui ne passera pas au rejeu
  lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: n } }]);
  const dernier = base.prepare("SELECT lot_id, max(rang) AS rang FROM modification WHERE table_nom = 'mot_cle' AND operation = 'supprimer' AND json_extract(cle, '$.id') = ?").get(n);
  base.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, ?, 'evenement', ?, 'modifier', ?, ?, 'en_attente')")
    .run(dernier.lot_id, dernier.rang + 1, JSON.stringify({ id: 'aucun-evenement-de-ce-nom' }), JSON.stringify({ titre: 'x' }), JSON.stringify({ titre: 'y' }));
  const { base: neuve, conflits } = rebatir(base);
  assert.ok(conflits.length > 0 && conflits.every((c) => c.detail.includes(dernier.lot_id)), JSON.stringify(conflits));
  assert.ok(neuve.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(n), 'N, dont la suppression a échoué, est là');
  for (const l of lignes) assert.equal(neuve.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?').get(l.page_id, l.ordre)?.tag_id, n, `${l.page_id} porte N`);
  assert.deepEqual(neuve.prepare('PRAGMA foreign_key_check').all(), []);
  neuve.close();
  base.close();
});

test('lot d’avant la migration 0043 : le mot-clé que le rejeu crée garde son id, même renommé ensuite sur le site (pas de « -2 »)', () => {
  const base = vivante();
  const page = base.prepare("SELECT id FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1 OFFSET 3").get().id;
  const ordre = base.prepare('SELECT max(ordre) AS m FROM page_tag WHERE page_id = ?').get(page).m + 1;
  let libelle = 'Voie oubliée';
  for (let i = 2; base.prepare('SELECT 1 FROM mot_cle WHERE libelle_cle = ?').get(normalize(libelle)); i += 1) libelle = `Voie oubliée ${i}`;
  const id = normalize(libelle);
  base.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES ('2026-10-01T09:00:00.000Z-v', '2026-10-01T09:00:00Z', NULL, 'x', 'avant 0043')").run();
  base.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES ('2026-10-01T09:00:00.000Z-v', 1, 'page_tag', ?, 'inserer', NULL, ?, 'en_attente')")
    .run(JSON.stringify({ page_id: page, ordre }), JSON.stringify({ page_id: page, ordre, tag_id: id, libelle }));
  // 1re reconstruction : le mot-clé est créé par le rejeu ; puis renommé sur le site
  const premiere = rebatir(base);
  assert.deepEqual(premiere.conflits, []);
  assert.ok(premiere.base.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(id));
  serviceDe(premiere.base)([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle: `${libelle} (renommée)` }, avant: { libelle } }]);
  // 2e reconstruction : même id, le renommage passe
  const seconde = rebatir(premiere.base);
  assert.deepEqual(seconde.conflits, []);
  assert.equal(seconde.base.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(id)?.libelle, `${libelle} (renommée)`);
  assert.equal(seconde.base.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(`${id}-2`), undefined);
  for (const b of [base, premiere.base, seconde.base]) b.close();
});

test('lots notés avant la migration 0043 (page_tag avec `libelle`, mot-clé neuf) : rejoués sans conflit, le mot-clé retrouvé ou créé ; un lot en conflit ne le laisse pas', () => {
  const base = vivante();
  const page = base.prepare("SELECT id FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1").get().id;
  const ordre = base.prepare('SELECT max(ordre) AS m FROM page_tag WHERE page_id = ?').get(page).m + 1;
  // une autre page (un mot-clé n'est qu'une fois par page)
  const existant = base.prepare("SELECT t.page_id, t.ordre, t.tag_id, m.libelle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id JOIN page p ON p.id = t.page_id WHERE t.page_id <> ? AND p.type = 'lore' AND m.libelle_cle <> 'codex' ORDER BY t.page_id, t.ordre LIMIT 1").get(page);
  let nouveau = 'Voie ancienne';
  for (let i = 2; base.prepare('SELECT 1 FROM mot_cle WHERE libelle_cle = ?').get(normalize(nouveau)); i += 1) nouveau = `Voie ancienne ${i}`;
  const lot = (id, fait_le, modifications) => {
    base.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, NULL, 'x', 'avant 0043')").run(id, fait_le);
    modifications.forEach(([table, cle, operation, avant, apres], i) => base.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')")
      .run(id, i + 1, table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres)));
  };
  // l'ancienne forme : `libelle` dans page_tag, un tag_id qu'aucun mot-clé n'a encore ; puis un renommage de mot-clé à l'ancienne (spécialité renommée)
  lot('2026-10-01T10:00:00.000Z-a', '2026-10-01T10:00:00Z', [
    ['page_tag', { page_id: page, ordre }, 'inserer', null, { page_id: page, ordre, tag_id: normalize(nouveau), libelle: nouveau }],
  ]);
  lot('2026-10-01T10:00:01.000Z-b', '2026-10-01T10:00:01Z', [
    ['page_tag', { page_id: existant.page_id, ordre: existant.ordre }, 'modifier', { tag_id: existant.tag_id, libelle: existant.libelle }, { tag_id: normalize(nouveau), libelle: nouveau }],
  ]);
  // un lot qui crée un mot-clé à l'ancienne mais part en conflit (une ligne qui n'existe pas) : le mot-clé ne reste pas
  lot('2026-10-01T10:00:02.000Z-c', '2026-10-01T10:00:02Z', [
    ['page_tag', { page_id: page, ordre: ordre + 1 }, 'inserer', null, { page_id: page, ordre: ordre + 1, tag_id: 'orphelin-d-essai', libelle: 'Orphelin d’essai' }],
    ['evenement', { id: 'aucun-evenement-de-ce-nom' }, 'modifier', { titre: 'x' }, { titre: 'y' }],
  ]);
  base.exec('PRAGMA foreign_keys = OFF');
  base.exec('BEGIN');
  const sortie = {};
  const bilan = rejouerLeJournal(base, sortie);
  base.exec('COMMIT');
  base.exec('PRAGMA foreign_keys = ON');
  assert.equal(bilan.conflits, 2, 'seul le lot c (ses deux modifications) est en conflit');
  const cree = base.prepare('SELECT * FROM mot_cle WHERE libelle_cle = ?').get(normalize(nouveau));
  assert.deepEqual({ ...cree }, { id: normalize(nouveau), libelle: nouveau, libelle_cle: normalize(nouveau) });
  assert.equal(base.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?').get(page, ordre).tag_id, cree.id);
  assert.equal(base.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?').get(existant.page_id, existant.ordre).tag_id, cree.id);
  assert.equal(base.prepare("SELECT 1 FROM mot_cle WHERE id = 'orphelin-d-essai'").get(), undefined);
  assert.ok(sortie.tablesCompletees.includes('mot_cle'), 'la mise à jour des règles a le droit d’écrire mot_cle');
  assert.deepEqual(base.prepare('PRAGMA foreign_key_check').all(), []);
  // le journal stocké garde sa forme (un autre rejeu, celui de la mise à jour sur data/rows, en a besoin)
  assert.match(base.prepare("SELECT apres FROM modification WHERE lot_id = '2026-10-01T10:00:00.000Z-a'").get().apres, /"libelle"/);
  base.close();
});

test('rapatriement et mise à jour sur data/rows : les pages d’exemple (absentes du site de dev) perdent un mot-clé supprimé ou fusionné, rien ne bloque', { skip: sansPython }, () => {
  // le site de dev est construit sans les pages d'exemple (HIDE_EXAMPLES=1) ; data/rows les garde, avec leurs mots-clés
  const site = vivante({ sansExemples: true });
  const servi = { base: () => site, etat: () => ({}), edition: true };
  const lot = (operations) => {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'recherche/', operations }) }, servi);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
  };
  const id = (cle) => site.prepare('SELECT id FROM mot_cle WHERE libelle_cle = ?').get(cle)?.id;
  // « démo » : seulement sur des exemples (0 page au site de dev) ; « personnage » : une vraie page et deux exemples ; « magie » : renommé ; « aide » : fusionné
  const demo = id('demo');
  const personnage = id('personnage');
  const magie = id('magie');
  const aide = id('aide');
  assert.ok(demo && personnage && magie && aide, 'mots-clés d’exemple présents dans le vocabulaire');
  const cible = site.prepare('SELECT id FROM mot_cle WHERE libelle_cle = ?').get('guide').id;
  lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: demo } }]);
  lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: personnage } }]);
  const renomme = `Magie (essai ${process.pid})`;
  lot([{ op: 'modifier', table: 'mot_cle', cle: { id: magie }, valeurs: { libelle: renomme } }]);
  lot([{ op: 'fusionner_mots_cles', mot_cle: aide, dans: cible }]);
  const journal = journalExporte(site);
  site.close();

  const construire = (rows, nom) => {
    const sortie = join(racine, `${nom}.db`);
    const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', sortie, '--rows', rows], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return new DatabaseSync(sortie, { readOnly: true });
  };
  const verifier = (base) => {
    for (const m of [demo, personnage, aide]) assert.equal(base.prepare('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?').get(m).n, 0, m);
    assert.equal(base.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(magie).libelle, renomme);
    assert.ok(base.prepare("SELECT 1 FROM page_tag WHERE page_id = 'magies/exemple-magie' AND tag_id = ?").get(magie), 'l’exemple garde « magie » renommé');
    assert.deepEqual(base.prepare('PRAGMA foreign_key_check').all(), []);
  };
  // db:appliquer-edition
  const rows = join(racine, 'rapatriement', 'rows');
  cpSync(ROWS, rows, { recursive: true });
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  assert.equal(r.ecrit, true);
  const appliquee = construire(rows, 'rapatriement');
  verifier(appliquee);
  appliquee.close();
  // « Effectuer la mise à jour » : page_tag.sql change au-delà du journal (exemples) sans être refusé (code 4)
  const rowsMaj = copieSansNoteEnAttente(join(racine, 'mise-a-jour', 'rows'), { versionProduction: versionALaRevision('HEAD') }).rows;
  const maj = appliquerMiseAJour({ format: 'maverick-mise-a-jour/1', id: '22222222-3333-4444-5555-666666666666', cree_le: '2026-10-14T08:00:00Z', version_dev: '0.2.39', version_cible: '0.3', texte: null, journal },
    { rows: rowsMaj, reference: 'HEAD', date: '2026-10-14', versionDev: '0.2.39' });
  assert.ok(maj.fichiers.includes('page_tag.sql') && maj.fichiers.includes('mot_cle.sql'), maj.fichiers.join(', '));
  const majee = construire(rowsMaj, 'mise-a-jour');
  verifier(majee);
  majee.close();
});
