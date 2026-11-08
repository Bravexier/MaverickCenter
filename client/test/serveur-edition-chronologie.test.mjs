// Édition de la chronologie et du vocabulaire des mots-clés depuis le site de dev (serveur/edition-chronologie.mjs, migration 0043 ; demandes du
// propriétaire : modifier, créer avec une date et supprimer un événement ; « Date, Titre, Description, Lien » ; plusieurs catégories par événement, « créer,
// modifier et supprimer une catégorie. Une catégorie supprimée la retire de l'entrée » ; sur /recherche/, ajouter, renommer et supprimer un mot-clé ; depuis
// la décision R196, « Le mot clé n'est supprimable que si cette liste est vide » : plus de cascade, un refus 409 avec la liste). Les tests lisent l'état avant d'écrire et prennent des noms absents
// de la base : les essais du site de dev peuvent l'avoir modifiée. Depuis la migration 0056 (glossaire), le vocabulaire importé n'est presque plus posé
// sur les pages : les règles des tests ont leurs mots-clés d'essai (test/aide-mots-cles.mjs).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { appliquerMiseAJour } from '../scripts/mise-a-jour-regles.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { FUSIONS_DE_MIGRATION, registreDes0113, rejouerLeJournal, tableDesLiensDeLa0098 } from '../serveur/edition.mjs';
import { examinerLeLot, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { SANS_CATEGORIE } from '../src/lib/chronologie.mjs';
import { chargerChronologie } from '../src/lib/chronologie-db.mjs';
import { attributEd, ENTITES, lireAttributEd, TABLES } from '../src/lib/edition-modele.mjs';
import { mentionsDe } from '../src/lib/mentions-des-mots-cles.mjs';
import { estProtege, MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { IDS_DES_MOTS_CLES_PROTEGES as ID } from '../src/lib/mots-cles-proteges.mjs';
import { lirePages } from '../src/lib/pages-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { copieSansNoteEnAttente, versionALaRevision } from './aide-mise-a-jour.mjs';
import { ajouterLesMotsClesDEssai, DEFINITION_D_ESSAI, ETIQUETTE_D_ESSAI, idDEssai, reglesAvecDesMotsClesDEssai } from './aide-mots-cles.mjs';
import { formesNonCanoniques, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const racine = dossierTemporaire('edition-chronologie');
let compteur = 0;
// les règles des tests : celles de data/rows et des mots-clés d'essai posés sur des pages (avec ou sans les pages d'exemple, comme le site de dev)
const regles = new Map();
const reglesDe = (sansExemples) => {
  if (!regles.has(sansExemples)) regles.set(sansExemples, reglesAvecDesMotsClesDEssai(join(racine, `regles-${sansExemples ? 'site' : 'tout'}`), { sansExemples }));
  return regles.get(sansExemples);
};
const vivante = ({ sansExemples = false } = {}) =>
  ouvrirBaseVivante(preparerBaseVivante({ regles: reglesDe(sansExemples).base, dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
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
  for (let i = 2; ligne('SELECT 1 FROM mot_cle WHERE cle = ?', normalize(t)); i += 1) t = `${base} ${i}`;
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
  assert.equal(lireAttributEd(attributEd('mot_cle', { id: 1 }, 'cle')), null);
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
  assert.ok(Number.isInteger(id), 'un id entier (migration 0113)');
  assert.equal(ligne('SELECT cle FROM mot_cle WHERE id = ?', id).cle, normalize(libelle), 'sa clé : le slug de son libellé');
  assert.equal(enregistrer([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libelle.toUpperCase() } }]).statut, 409, 'même écriture, sans catégorie qui les distingue (R232 (9))');
  // renommer un mot-clé posé sur des pages : l'id reste, les pages montrent la nouvelle écriture
  // un mot-clé non verrouillé (décisions R218, R219 : un verrouillé ne se renomme pas, test/serveur-edition-verrou.test.mjs)
  const surPages = ligne(`SELECT m.* FROM mot_cle m WHERE (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) >= 2 AND m.verrou = 0 AND m.id NOT IN (${[...MOTS_CLES_PROTEGES.keys()].map(() => '?').join(', ')}) ORDER BY m.id LIMIT 1`, ...MOTS_CLES_PROTEGES.keys());
  const pages = lignes('SELECT page_id FROM page_tag WHERE tag_id = ? ORDER BY page_id', surPages.id).map((p) => p.page_id);
  const nouveau = motLibre(`${surPages.libelle} (renommé)`);
  ok(enregistrer([{ op: 'modifier', table: 'mot_cle', cle: { id: surPages.id }, valeurs: { libelle: nouveau }, avant: { libelle: surPages.libelle } }]));
  assert.deepEqual({ ...ligne('SELECT libelle, cle FROM mot_cle WHERE id = ?', surPages.id) }, { libelle: nouveau, cle: normalize(nouveau) });
  assert.deepEqual(lignes('SELECT page_id FROM page_tag WHERE tag_id = ? ORDER BY page_id', surPages.id).map((p) => p.page_id), pages, 'les pages gardent le mot-clé');
  const exportees = lirePages(db).filter((p) => pages.includes(p.id));
  assert.ok(exportees.every((p) => p.tags.includes(nouveau)), 'le frontmatter des pages montre la nouvelle écriture');
  // vers l'écriture d'un autre, sans catégorie qui les distingue : refusé (R232 (9)), la fusion est proposée
  const prise = enregistrer([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle: nouveau.toLowerCase() } }]);
  assert.equal(prise.statut, 409);
  assert.deepEqual(prise.corps.fusion, { mot_cle: id, dans: surPages.id });
  // fusion : une page qui avait les deux perd seulement l'ancien
  const paire = ligne(`SELECT a.page_id, a.tag_id AS A, b.tag_id AS B FROM page_tag a JOIN page_tag b ON b.page_id = a.page_id AND b.tag_id <> a.tag_id
    JOIN mot_cle ma ON ma.id = a.tag_id JOIN mot_cle mb ON mb.id = b.tag_id
    WHERE ma.verrou = 0 AND ma.id NOT IN (${[...MOTS_CLES_PROTEGES.keys()].map(() => '?').join(', ')}) AND mb.id NOT IN (${[...MOTS_CLES_PROTEGES.keys()].map(() => '?').join(', ')})
      AND a.tag_id <> ? AND b.tag_id <> ? ORDER BY a.page_id, a.tag_id LIMIT 1`, ...MOTS_CLES_PROTEGES.keys(), ...MOTS_CLES_PROTEGES.keys(), surPages.id, surPages.id);
  const pagesDeA = lignes('SELECT page_id FROM page_tag WHERE tag_id = ?', paire.A).map((p) => p.page_id);
  ok(enregistrer([{ op: 'fusionner_mots_cles', mot_cle: paire.A, dans: paire.B }]));
  assert.equal(ligne('SELECT 1 FROM mot_cle WHERE id = ?', paire.A), undefined);
  for (const p of pagesDeA) assert.ok(ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?', p, paire.B), p);
  assert.equal(ligne('SELECT count(*) AS n FROM page_tag WHERE page_id = ? AND tag_id = ?', paire.page_id, paire.B).n, 1, 'pas de doublon');
  // suppression (décision R196 : « Le mot clé n'est supprimable que si cette liste est vide ») : un mot-clé que des pages portent est refusé, avec
  // la liste des endroits ; rien n'est écrit
  const r = enregistrer([{ op: 'supprimer', entite: 'mot_cle', cle: { id: surPages.id } }]);
  assert.equal(r.statut, 409, JSON.stringify(r.corps));
  assert.match(r.corps.erreur, /est mentionné à .* \(décision R196\)/);
  assert.deepEqual([...new Set(r.corps.mentions.filter((m) => m.comment === 'etiquette').map((m) => m.page.id))].sort(), pages, 'chaque page qui le porte');
  assert.equal(ligne('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?', surPages.id).n, pages.length);
  // un mot-clé mentionné nulle part (celui créé plus haut) : supprimé ; son id ne resert pas
  ok(enregistrer([{ op: 'supprimer', entite: 'mot_cle', cle: { id } }]));
  assert.equal(ligne('SELECT 1 FROM mot_cle WHERE id = ?', id), undefined);
  assert.ok(creerMotCle(libelle) > id, 'l’id suivant, jamais réutilisé');
});

test('R196 : une page d’exemple qui porte le mot-clé ou le cite par une balise bloque sa suppression (409, la liste) ; la liste vidée, il se supprime', () => {
  // une base à lui : les tests du vocabulaire fusionnent et suppriment des mots-clés d'essai dans `db`
  const base = vivante();
  const servi = { base: () => base, etat: () => ({}), edition: true };
  const supprimer = (id) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
    corps: JSON.stringify({ page: 'regles/glossaire/', operations: [{ op: 'supprimer', entite: 'mot_cle', cle: { id } }] }) }, servi);
  const tags = (id) => base.prepare('SELECT page_id FROM page_tag WHERE tag_id = ? ORDER BY page_id').all(id).map((p) => p.page_id);
  // « Essai démo » n'est porté que par des pages d'exemple (test/aide-mots-cles.mjs) : elles comptent (« Le mot clé n'est supprimable que si cette
  // liste est vide »)
  const demo = idDEssai(normalize('Essai démo'));
  const pagesDeDemo = tags(demo);
  assert.ok(pagesDeDemo.length && pagesDeDemo.every((p) => base.prepare('SELECT statut FROM page WHERE id = ?').get(p).statut === 'example'), pagesDeDemo.join());
  const porte = supprimer(demo);
  assert.equal(porte.statut, 409, JSON.stringify(porte.corps));
  assert.deepEqual(porte.corps.mentions.map((m) => [m.comment, m.page.id, m.exemple]).sort((x, y) => x[1].localeCompare(y[1])), pagesDeDemo.map((p) => ['etiquette', p, true]));
  assert.deepEqual(tags(demo), pagesDeDemo, 'rien d’écrit');
  // un mot-clé que seule une balise d'une page d'exemple cite (le test pose le texte dans sa copie)
  const cleR196 = normalize('Essai R196 exemple');
  const id = base.prepare('SELECT max(id) + 1 AS n FROM mot_cle').get().n;
  base.prepare('INSERT INTO mot_cle (id, libelle, cle, description) VALUES (?, ?, ?, ?)').run(id, 'Essai R196 exemple', cleR196, DEFINITION_D_ESSAI);
  const exemple = base.prepare("SELECT id, corps_md FROM page WHERE statut = 'example' AND corps_md IS NOT NULL ORDER BY id LIMIT 1").get();
  base.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`${exemple.corps_md}\n\nVoir {{${cleR196}}}.\n`, exemple.id);
  const cite = supprimer(id);
  assert.equal(cite.statut, 409, JSON.stringify(cite.corps));
  assert.match(cite.corps.erreur, /R196/);
  assert.deepEqual(cite.corps.mentions.map((m) => [m.table, m.cle, m.colonne, m.comment, m.page.id, m.exemple]), [['page', { id: exemple.id }, 'corps_md', 'balise', exemple.id, true]]);
  assert.ok(base.prepare('SELECT corps_md FROM page WHERE id = ?').get(exemple.id).corps_md.includes(`{{${cleR196}}}`), 'plus de cascade : la balise reste');
  // la balise retirée, la liste est vide : la suppression passe
  base.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(exemple.corps_md, exemple.id);
  assert.equal(supprimer(id).statut, 200);
  assert.equal(base.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(id), undefined);
  base.close();
});

test('R211 : un mot-clé que vise le rejeu des migrations 0090 (cible d’une fusion) ou 0098 (registre des liens) se supprime dès que rien ne le mentionne', () => {
  // décision R211 (« Les rendre supprimables ») : plus de garde propre aux adaptateurs du rejeu ; restent le verrou (R218, R219 : les mots-clés du
  // registre de la 0098 ont une adresse, ils sont verrouillés), les étiquettes de sort et le refus d'un mot-clé mentionné (R196 (1)). Une base à lui :
  // le verrou s'y lève à la main (un admin le pourra : R218 (4)), ce que le journal de `db`, rejoué plus loin, ne dirait pas
  const base = vivante();
  const servi = { base: () => base, etat: () => ({}), edition: true };
  const supprimer = (id) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
    corps: JSON.stringify({ page: 'regles/glossaire/', operations: [{ op: 'supprimer', entite: 'mot_cle', cle: { id } }] }) }, servi);
  const lire = (id) => base.prepare('SELECT id, libelle, verrou FROM mot_cle WHERE id = ?').get(id);
  const supprimable = (m) => m && !base.prepare('SELECT 1 FROM sort_mot_cle WHERE mot_cle_id = ?').get(m.id);
  const fusion = FUSIONS_DE_MIGRATION.find((f) => f.migration === '0090');
  // les ids texte de ces registres, d'avant la migration 0113 : leur id entier par la correspondance de la migration
  const vises = [fusion.cible, ...[...tableDesLiensDeLa0098().parCle.values()].map((m) => m.id)].map((x) => registreDes0113().get(x)).map(lire).filter(supprimable);
  const libre = vises.find((m) => !mentionsDe(base, m.id).length);
  assert.ok(libre, 'un mot-clé du registre de la 0098 que rien ne mentionne');
  if (libre.verrou === 1) {
    // verrouillé : refusé par le verrou seul ; levé, il se supprime comme les autres
    const r = supprimer(libre.id);
    assert.equal(r.statut, 409, JSON.stringify(r.corps));
    assert.match(r.corps.erreur, /verrouillé.*R218, R219/);
    base.prepare('UPDATE mot_cle SET verrou = 0 WHERE id = ?').run(libre.id);
  }
  ok(supprimer(libre.id));
  assert.equal(lire(libre.id), undefined, libre.id);
  // un mot-clé visé encore mentionné : refusé par R196 seulement, avec la liste
  const mentionne = vises.find((m) => m.verrou === 0 && mentionsDe(base, m.id).length);
  if (mentionne) {
    const r = supprimer(mentionne.id);
    assert.equal(r.statut, 409, JSON.stringify(r.corps));
    assert.ok(r.corps.mentions?.length, `${mentionne.id} : la liste des mentions`);
    assert.doesNotMatch(r.corps.erreur, /rejeu/, mentionne.id);
  }
  base.close();
});

test('mots-clés dont le site se sert : verrouillés (R219 (2)), ni modifiés, ni supprimés, ni fusionnés dans un autre ; un autre se fusionne dans eux (R219 (4))', () => {
  const magique = ligne(`SELECT * FROM mot_cle WHERE id = ${ID.magique}`);
  const codex = ligne(`SELECT * FROM mot_cle WHERE id = ${ID.codex}`);
  assert.deepEqual([magique.verrou, codex.verrou], [1, 1], 'le verrou remplace leur protection (migration 0110)');
  const libre = creerMotCle(motLibre('Essai protégé'));
  for (const operation of [
    { op: 'supprimer', entite: 'mot_cle', cle: { id: codex.id } },
    { op: 'fusionner_mots_cles', mot_cle: codex.id, dans: libre },
    { op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs: { libelle: motLibre('Magie de classe') }, avant: { libelle: magique.libelle } },
    { op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs: { libelle: magique.libelle.toUpperCase() } },
  ]) {
    const r = enregistrer([operation]);
    assert.equal(r.statut, 409, JSON.stringify(r.corps));
    assert.match(r.corps.erreur, /est verrouillé.*\(décisions R218, R219\)/, JSON.stringify(operation));
  }
  assert.deepEqual({ ...ligne(`SELECT * FROM mot_cle WHERE id = ${ID.magique}`) }, { ...magique }, 'rien d’écrit');
  // un mot-clé libre se fusionne dans un mot-clé dont le site se sert (R219 (4)) : sa cible garde ses champs
  ok(enregistrer([{ op: 'fusionner_mots_cles', mot_cle: libre, dans: magique.id }]));
  assert.equal(ligne('SELECT 1 FROM mot_cle WHERE id = ?', libre), undefined);
  assert.deepEqual({ ...ligne(`SELECT * FROM mot_cle WHERE id = ${ID.magique}`) }, { ...magique });
  // l'écriture d'un mot-clé dont le site se sert que la base n'a pas encore (« race hybride », créé avec la première race hybride) : un mot-clé créé
  // sous cette écriture prend un autre id, n'est pas verrouillé (R219 (5)) et se supprime
  // « race hybride » n'a pas d'id (lib/mots-cles-proteges.mjs) : il se reconnaît par sa clé tant qu'il n'existe pas (réponse du leader-technique) ; un
  // mot-clé créé sous cette écriture est donc reconnu comme lui, mais n'est pas verrouillé (R219 (5)) et se supprime
  const absent = Object.entries(ID).find(([, id]) => id === null)?.[0];
  if (absent && !ligne('SELECT 1 FROM mot_cle WHERE cle = ?', absent)) {
    const cree = creerMotCle(absent.replace(/-/g, ' '));
    assert.equal(MOTS_CLES_PROTEGES.has(cree), false, String(cree));
    assert.equal(estProtege(ligne('SELECT id, cle FROM mot_cle WHERE id = ?', cree)), true, 'reconnu par sa clé');
    assert.equal(ligne('SELECT verrou FROM mot_cle WHERE id = ?', cree).verrou, 0);
    ok(enregistrer([{ op: 'supprimer', entite: 'mot_cle', cle: { id: cree } }]), 'il se supprime');
  }
  // GET /api/edition/mots-cles/ : le vocabulaire, ce qui porte chaque mot-clé, et son verrou
  const v = appel('GET', '/api/edition/mots-cles/');
  ok(v);
  const m = v.corps.motsCles.find((x) => x.id === magique.id);
  assert.equal(m.pages, ligne('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?', magique.id).n);
  assert.equal(m.verrou, 1);
  assert.equal('protege' in m, false, 'le verrou remplace la protection');
});

test('mots-clés qui étiquettent un sort (sort_mot_cle, migration 0067, décision R114) : ni supprimés, ni fusionnés (dans un sens ou l’autre), 409 avec une raison lisible ; « Sort grenade » est protégé ; renommer et définir restent possibles', () => {
  const etiquette = ligne('SELECT * FROM mot_cle WHERE id = ?', ETIQUETTE_D_ESSAI.id);
  assert.ok(etiquette, 'le mot-clé d’essai est dans les règles des tests');
  assert.equal(MOTS_CLES_PROTEGES.has(etiquette.id), false, 'il n’est pas protégé : seul son rôle d’étiquette le garde');
  const etiquettes = () => lignes('SELECT sort_id FROM sort_mot_cle WHERE mot_cle_id = ? ORDER BY sort_id', etiquette.id).map((l) => l.sort_id);
  assert.deepEqual(etiquettes(), [...ETIQUETTE_D_ESSAI.sorts].sort());
  const libre = creerMotCle(motLibre('Essai sans étiquette'));
  const vocabulaireAvant = lignes('SELECT * FROM mot_cle ORDER BY id');
  // les sorts nommés comme la base les nomme (le site de dev peut les renommer), dans l'ordre de leur clé de nom
  const sorts = lignes(`SELECT nom FROM sort WHERE id IN (${ETIQUETTE_D_ESSAI.sorts.map(() => '?').join(', ')}) ORDER BY nom_cle, id`, ...ETIQUETTE_D_ESSAI.sorts).map((x) => `« ${x.nom} »`).join(', ');
  for (const [quoi, operation, action] of [
    ['suppression', { op: 'supprimer', entite: 'mot_cle', cle: { id: etiquette.id } }, 'supprime'],
    ['fusion du mot-clé dans un autre', { op: 'fusionner_mots_cles', mot_cle: etiquette.id, dans: libre }, 'fusionne'],
    ['fusion d’un autre dans le mot-clé', { op: 'fusionner_mots_cles', mot_cle: libre, dans: etiquette.id }, 'fusionne'],
  ]) {
    const r = enregistrer([operation]);
    assert.equal(r.statut, 409, `${quoi} : ${JSON.stringify(r.corps)}`);
    assert.equal(r.corps.erreur, `operations[0] : Le mot-clé « ${etiquette.libelle} » ne se ${action} pas depuis le site : il étiquette 2 sorts (${sorts}), une règle posée par décision du propriétaire.`, quoi);
    assert.deepEqual(lignes('SELECT * FROM mot_cle ORDER BY id'), vocabulaireAvant, `${quoi} : rien n’est écrit`);
    assert.deepEqual(etiquettes(), [...ETIQUETTE_D_ESSAI.sorts].sort(), `${quoi} : les étiquettes restent`);
  }
  // le libellé et la définition se modifient (les sorts citent l'id) ; « Sort grenade », lui, est verrouillé (R219 (2) : la fiche le lit, R114) : ni
  // supprimé ni fusionné dans un autre (le verrou), ni cible d'une fusion (il étiquette des sorts), ni renommé
  const nouveau = motLibre(`${etiquette.libelle} renommée`);
  ok(enregistrer([{ op: 'modifier', table: 'mot_cle', cle: { id: etiquette.id }, valeurs: { libelle: nouveau, description: 'Autre définition.' }, avant: { libelle: etiquette.libelle } }]));
  assert.deepEqual(etiquettes(), [...ETIQUETTE_D_ESSAI.sorts].sort(), 'renommé : ses étiquettes restent');
  const grenade = ligne(`SELECT * FROM mot_cle WHERE id = ${ID['sort-grenade']}`);
  assert.equal(ligne(`SELECT count(*) AS n FROM sort_mot_cle WHERE mot_cle_id = ${ID['sort-grenade']}`).n, 14, 'les 14 sorts « Grenade… » (R114)');
  assert.equal(grenade.verrou, 1);
  for (const [operation, motif] of [
    [{ op: 'supprimer', entite: 'mot_cle', cle: { id: grenade.id } }, /est verrouillé.*\(décisions R218, R219\)/],
    [{ op: 'fusionner_mots_cles', mot_cle: grenade.id, dans: libre }, /est verrouillé : il ne se fusionne pas dans un autre/],
    [{ op: 'fusionner_mots_cles', mot_cle: libre, dans: grenade.id }, / ne se fusionne pas depuis le site : il étiquette 14 sorts/],
    [{ op: 'modifier', table: 'mot_cle', cle: { id: grenade.id }, valeurs: { libelle: motLibre('Sort explosif') }, avant: { libelle: grenade.libelle } }, /est verrouillé/],
  ]) {
    const r = enregistrer([operation]);
    assert.equal(r.statut, 409, JSON.stringify(r.corps));
    assert.ok(r.corps.erreur.startsWith(`operations[0] : Le mot-clé « ${grenade.libelle} » `), r.corps.erreur);
    assert.match(r.corps.erreur, motif);
  }
  assert.deepEqual({ ...ligne(`SELECT * FROM mot_cle WHERE id = ${ID['sort-grenade']}`) }, { ...grenade });
  assert.equal(ligne(`SELECT count(*) AS n FROM sort_mot_cle WHERE mot_cle_id = ${ID['sort-grenade']}`).n, 14);
  // une base vivante d'avant la migration 0067 (le service y retombe si sa reconstruction échoue) : sans la table des étiquettes, supprimer ou fusionner
  // un mot-clé passe (aucun n'y étiquette de sort), jamais un 500
  const avant0067 = vivante();
  try {
    avant0067.exec('DROP TABLE sort_mot_cle');
    const sur = (operations) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
      corps: JSON.stringify({ page: 'chronologie/', operations }) }, { base: () => avant0067, etat: () => ({}), edition: true });
    const autre = sur([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Essai repli 0067' } }]);
    ok(autre);
    ok(sur([{ op: 'fusionner_mots_cles', mot_cle: autre.corps.crees[0].id, dans: ETIQUETTE_D_ESSAI.id }]));
    ok(sur([{ op: 'supprimer', entite: 'mot_cle', cle: { id: ETIQUETTE_D_ESSAI.id } }]));
    assert.equal(avant0067.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(ETIQUETTE_D_ESSAI.id), undefined);
  } finally {
    avant0067.close();
  }
});

test('R164 : « Sort fer » (migration 0079) est verrouillé (R219 (2)) : ni supprimé, ni fusionné (dans un sens ou l’autre), ni modifié, 409 avec sa raison', () => {
  const fer = ligne(`SELECT * FROM mot_cle WHERE id = ${ID['sort-fer']}`);
  assert.ok(fer, 'le mot-clé de la migration 0079');
  assert.match(MOTS_CLES_PROTEGES.get(fer.id), /^étiquette les sorts fer, que la fiche de personnage reconnaît par lui \(décision R164/);
  const etiquetes = () => ligne(`SELECT count(*) AS n FROM sort_mot_cle WHERE mot_cle_id = ${ID['sort-fer']}`).n;
  assert.equal(etiquetes(), 13, 'les 13 sorts « Fer… » (R164)');
  const libre = creerMotCle(motLibre('Essai sans sort fer'));
  const vocabulaireAvant = lignes('SELECT * FROM mot_cle ORDER BY id');
  for (const [operation, motif] of [
    [{ op: 'supprimer', entite: 'mot_cle', cle: { id: fer.id } }, /est verrouillé.*\(décisions R218, R219\)/],
    [{ op: 'fusionner_mots_cles', mot_cle: fer.id, dans: libre }, /est verrouillé : il ne se fusionne pas dans un autre/],
    // la cible verrouillée reçoit une fusion (R219 (4)), mais une étiquette de sort, jamais (R164)
    [{ op: 'fusionner_mots_cles', mot_cle: libre, dans: fer.id }, / ne se fusionne pas depuis le site : il étiquette 13 sorts/],
    [{ op: 'modifier', table: 'mot_cle', cle: { id: fer.id }, valeurs: { description: 'Autre définition.' } }, /est verrouillé/],
    [{ op: 'modifier', table: 'mot_cle', cle: { id: fer.id }, valeurs: { libelle: motLibre('Sort de fer') }, avant: { libelle: fer.libelle } }, /est verrouillé/],
  ]) {
    const r = enregistrer([operation]);
    assert.equal(r.statut, 409, JSON.stringify(r.corps));
    assert.ok(r.corps.erreur.startsWith(`operations[0] : Le mot-clé « ${fer.libelle} » `), r.corps.erreur);
    assert.match(r.corps.erreur, motif);
    assert.deepEqual(lignes('SELECT * FROM mot_cle ORDER BY id'), vocabulaireAvant, `${JSON.stringify(operation)} : rien n’est écrit`);
    assert.equal(etiquetes(), 13, 'les étiquettes restent');
  }
  // GET /api/edition/mots-cles/ : son verrou
  const v = appel('GET', '/api/edition/mots-cles/');
  ok(v);
  assert.equal(v.corps.motsCles.find((x) => x.id === fer.id).verrou, 1);
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

test('spécialité créée puis renommée (migration 0056) : la fiche de son don ne porte que « capacité de classe », aucun mot-clé n’est créé ni retiré', () => {
  const nomClasse = (() => {
    let n = 'Classe des mots-clés';
    for (let i = 2; ligne('SELECT 1 FROM classe WHERE nom = ?', n); i += 1) n = `Classe des mots-clés ${i}`;
    return n;
  })();
  const classe = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-magique', nom: nomClasse } }]).corps.crees[0].id;
  const vocabulaireAvant = lignes('SELECT id FROM mot_cle ORDER BY id').map((m) => m.id);
  const avant = motLibre('Voie première');
  const r = enregistrer([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: classe, nom: avant, don_nom: `${avant} (don)`, don_type: 'Passif' } }]);
  ok(r);
  const specialite = r.corps.crees.find((c) => c.entite === 'specialite').id;
  const don = ligne('SELECT id FROM capacite WHERE specialite_id = ?', specialite).id;
  const motsClesDuDon = () => lignes('SELECT tag_id FROM page_tag WHERE page_id = ? ORDER BY ordre', don).map((m) => m.tag_id);
  assert.deepEqual(motsClesDuDon(), [ID['capacite-de-classe']], 'ni la classe ni la spécialité');
  // les mots-clés protégés se reconnaissent à leur id : leur libellé peut changer (« Classe », R183 ; décision R195)
  assert.deepEqual(lignes('SELECT tag_id FROM page_tag WHERE page_id = ?', classe).map((m) => m.tag_id).sort(), [ID.classe, ID.magique].sort(), 'la classe : ses mots-clés protégés');
  const apres = motLibre('Voie seconde');
  ok(enregistrer([{ op: 'modifier', table: 'specialite', cle: { id: specialite }, valeurs: { nom: apres } }]));
  assert.deepEqual(motsClesDuDon(), [ID['capacite-de-classe']]);
  assert.deepEqual(lignes('SELECT id FROM mot_cle ORDER BY id').map((m) => m.id), vocabulaireAvant, 'le vocabulaire ne change pas');
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
  assert.deepEqual(seconde.conflits, [], '2e livraison : rien n’est noté des lignes fantômes, elles sont réévaluées comme à la 1re');
  assert.ok(seconde.base.prepare('SELECT 1 FROM evenement WHERE id = ?').get(evenement));
  for (const b of [base, premiere.base, seconde.base]) b.close();
});

test('rejeu : une ligne créée puis supprimée, que cite une ligne existante, dont la suppression part en conflit — insérée pour de bon, aucune référence rompue', () => {
  const base = vivante();
  const lot = serviceDe(base);
  // N : un mot-clé neuf ; S : un mot-clé existant posé sur des pages, fusionné dans N (ses lignes page_tag, existantes, passent à N)
  let libre = 'Essai fantôme';
  for (let i = 2; base.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(normalize(libre)); i += 1) libre = `Essai fantôme ${i}`;
  const n = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libre } }]).crees[0].id;
  const proteges = [...MOTS_CLES_PROTEGES.keys()];
  const source = base.prepare(`SELECT m.id FROM mot_cle m WHERE m.id NOT IN (${proteges.map(() => '?').join(', ')})
    AND (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) BETWEEN 1 AND 3 ORDER BY m.id LIMIT 1`).get(...proteges).id;
  const lignes = base.prepare('SELECT page_id, ordre FROM page_tag WHERE tag_id = ?').all(source).map((l) => ({ ...l }));
  lot([{ op: 'fusionner_mots_cles', mot_cle: source, dans: n }]);
  // puis N est supprimé (ses lignes page_tag avec lui), dans un lot qui ne passera pas au rejeu : noté comme avant la décision R196 (le service refuse
  // depuis la suppression d'un mot-clé que des pages portent)
  const ancien = { id: `${new Date().toISOString()}-000000-essai-fantome`, n: 0 };
  base.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, NULL, 'regles/glossaire/', 'Mot-clé supprimé (avant R196)')")
    .run(ancien.id, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
  const noter = (table, cle, avant) => base.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, ?, ?, ?, 'supprimer', ?, NULL, 'en_attente')")
    .run(ancien.id, (ancien.n += 1), table, JSON.stringify(cle), JSON.stringify(avant));
  for (const t of base.prepare('SELECT * FROM page_tag WHERE tag_id = ? ORDER BY page_id, ordre').all(n)) noter('page_tag', { page_id: t.page_id, ordre: t.ordre }, { ...t });
  noter('mot_cle', { id: n }, { ...base.prepare('SELECT * FROM mot_cle WHERE id = ?').get(n) });
  const dernier = { lot_id: ancien.id, rang: ancien.n };
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

test('lot d’avant la migration 0043 : le mot-clé (dont le site se sert) que le rejeu crée garde son id d’une reconstruction à l’autre ; un mot-clé libre n’est plus créé (0056)', () => {
  const base = vivante();
  const page = base.prepare("SELECT id FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1 OFFSET 3").get().id;
  const ordre = base.prepare('SELECT max(ordre) AS m FROM page_tag WHERE page_id = ?').get(page).m + 1;
  // « race hybride » : un mot-clé dont le site se sert, que les règles n'ont pas encore ; « Voie oubliée » : un mot-clé libre, que la migration 0056 ne garde pas
  const libelle = 'race hybride';
  const id = normalize(libelle);
  assert.equal(base.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(id), undefined, 'absent des règles');
  let libre = 'Voie oubliée';
  for (let i = 2; base.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(normalize(libre)); i += 1) libre = `Voie oubliée ${i}`;
  base.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES ('2026-10-01T09:00:00.000Z-v', '2026-10-01T09:00:00Z', NULL, 'x', 'avant 0043')").run();
  const noter = base.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')");
  noter.run('2026-10-01T09:00:00.000Z-v', 1, 'page_tag', JSON.stringify({ page_id: page, ordre }), 'inserer', null, JSON.stringify({ page_id: page, ordre, tag_id: id, libelle }));
  noter.run('2026-10-01T09:00:00.000Z-v', 2, 'page_tag', JSON.stringify({ page_id: page, ordre: ordre + 1 }), 'inserer', null,
    JSON.stringify({ page_id: page, ordre: ordre + 1, tag_id: normalize(libre), libelle: libre }));
  // puis, avant 0056, le mot-clé libre renommé sur /recherche/
  base.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES ('2026-10-02T09:00:00.000Z-w', '2026-10-02T09:00:00Z', NULL, 'recherche/', 'avant 0056')").run();
  noter.run('2026-10-02T09:00:00.000Z-w', 1, 'mot_cle', JSON.stringify({ id: normalize(libre) }), 'modifier', JSON.stringify({ libelle: libre, libelle_cle: normalize(libre) }),
    JSON.stringify({ libelle: `${libre} (renommée)`, libelle_cle: normalize(`${libre} (renommée)`) }));
  const premiere = rebatir(base);
  assert.deepEqual(premiere.conflits, []);
  // créé à l'id entier suivant (migration 0113 : ancienneEcritureDesIds), sa clé celle de son écriture
  const cree = premiere.base.prepare('SELECT id FROM mot_cle WHERE cle = ?').get(id)?.id;
  assert.ok(Number.isInteger(cree), 'le mot-clé dont le site se sert est créé');
  assert.equal(premiere.base.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?').get(page, ordre)?.tag_id, cree);
  assert.equal(premiere.base.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(normalize(libre)), undefined, 'le mot-clé libre ne l’est pas (0056)');
  assert.equal(premiere.base.prepare('SELECT 1 FROM page_tag WHERE page_id = ? AND ordre = ?').get(page, ordre + 1), undefined, 'son étiquette non plus');
  const etats = premiere.base.prepare("SELECT etat FROM modification WHERE lot_id IN ('2026-10-01T09:00:00.000Z-v', '2026-10-02T09:00:00.000Z-w') ORDER BY lot_id, rang").all().map((m) => m.etat);
  assert.deepEqual(etats, ['en_attente', 'integree', 'integree'], 'intégrées sans effet, sans mettre leur lot en conflit');
  // 2e reconstruction : le même id, un seul mot-clé
  const seconde = rebatir(premiere.base);
  assert.deepEqual(seconde.conflits, []);
  assert.deepEqual(seconde.base.prepare('SELECT id FROM mot_cle WHERE cle LIKE ?').all(`${id}%`).map((m) => m.id), [cree]);
  for (const b of [base, premiere.base, seconde.base]) b.close();
});

test('lots notés avant la migration 0043 (page_tag avec `libelle`, mot-clé neuf dont le site se sert) : rejoués sans conflit, le mot-clé retrouvé ou créé ; un lot en conflit ne le laisse pas', () => {
  const base = vivante();
  const page = base.prepare("SELECT id FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1").get().id;
  const ordre = base.prepare('SELECT max(ordre) AS m FROM page_tag WHERE page_id = ?').get(page).m + 1;
  // une autre page (un mot-clé n'est qu'une fois par page)
  const existant = base.prepare("SELECT t.page_id, t.ordre, t.tag_id, m.libelle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id JOIN page p ON p.id = t.page_id WHERE t.page_id <> ? AND p.type = 'lore' AND m.cle <> 'codex' ORDER BY t.page_id, t.ordre LIMIT 1").get(page);
  // un mot-clé dont le site se sert, que les règles n'ont pas encore (un mot-clé libre n'est plus créé depuis 0056 : test précédent)
  const nouveau = 'race hybride';
  assert.equal(base.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(normalize(nouveau)), undefined);
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
  // créé à l'id entier suivant (migration 0113 : ancienneEcritureDesIds), sa clé celle de son écriture
  const cree = base.prepare('SELECT id, libelle, cle FROM mot_cle WHERE cle = ?').get(normalize(nouveau));
  assert.ok(Number.isInteger(cree?.id));
  assert.deepEqual({ libelle: cree.libelle, cle: cree.cle }, { libelle: nouveau, cle: normalize(nouveau) });
  assert.equal(base.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?').get(page, ordre).tag_id, cree.id);
  assert.equal(base.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?').get(existant.page_id, existant.ordre).tag_id, cree.id);
  assert.equal(base.prepare("SELECT 1 FROM mot_cle WHERE cle = 'orphelin-d-essai'").get(), undefined);
  assert.ok(sortie.tablesCompletees.includes('mot_cle'), 'la mise à jour des règles a le droit d’écrire mot_cle');
  assert.deepEqual(base.prepare('PRAGMA foreign_key_check').all(), []);
  // le journal stocké garde sa forme (un autre rejeu, celui de la mise à jour sur data/rows, en a besoin)
  assert.match(base.prepare("SELECT apres FROM modification WHERE lot_id = '2026-10-01T10:00:00.000Z-a'").get().apres, /"libelle"/);
  base.close();
});

test('lots notés avant la migration 0056 (D4) : un don créé par l’ancien code, avec l’étiquette de sa classe et le mot-clé qu’il créait — le don survit à la reconstruction', () => {
  const base = vivante();
  const classe = base.prepare("SELECT id FROM classe WHERE categorie_id = 'classe-magique' ORDER BY id LIMIT 1").get().id;
  let nom = 'Don d’avant le glossaire';
  for (let i = 2; base.prepare('SELECT 1 FROM capacite WHERE classe_id = ? AND nom = ?').get(classe, nom); i += 1) nom = `Don d’avant le glossaire ${i}`;
  const don = serviceDe(base)([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau: '1', nom, type: 'Passif' } }]).crees[0].id;
  // l'ancien code (avant 0056) : la fiche du don portait aussi l'étiquette de sa classe (un mot-clé que la migration a retiré) et celle d'une
  // spécialité, mot-clé qu'il créait (sans définition : la colonne n'existait pas) ; puis l'étiquette a été déplacée, le mot-clé renommé
  const lot = base.prepare("SELECT lot_id AS id, max(rang) AS rang FROM modification WHERE table_nom = 'page' AND json_extract(cle, '$.id') = ? AND operation = 'inserer'").get(don);
  const ordre = base.prepare('SELECT max(ordre) AS m FROM page_tag WHERE page_id = ?').get(don).m;
  let libre = 'Spécialité d’avant le glossaire';
  for (let i = 2; base.prepare('SELECT 1 FROM mot_cle WHERE cle = ? OR id = ?').get(normalize(libre), normalize(libre)); i += 1) libre = `Spécialité d’avant le glossaire ${i}`;
  const retire = 'etiquette-de-classe-retiree-d-essai';
  assert.equal(base.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(retire), undefined);
  const dernier = base.prepare('SELECT max(rang) AS m FROM modification WHERE lot_id = ?').get(lot.id).m;
  const noter = base.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')");
  const motCle = { id: normalize(libre), libelle: libre, libelle_cle: normalize(libre) };
  noter.run(lot.id, dernier + 1, 'mot_cle', JSON.stringify({ id: motCle.id }), 'inserer', null, JSON.stringify(motCle));
  noter.run(lot.id, dernier + 2, 'page_tag', JSON.stringify({ page_id: don, ordre: ordre + 1 }), 'inserer', null, JSON.stringify({ page_id: don, ordre: ordre + 1, tag_id: retire }));
  noter.run(lot.id, dernier + 3, 'page_tag', JSON.stringify({ page_id: don, ordre: ordre + 2 }), 'inserer', null, JSON.stringify({ page_id: don, ordre: ordre + 2, tag_id: motCle.id }));
  base.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES ('2099-01-01T00:00:00.000Z-d4', '2099-01-01T00:00:00Z', NULL, 'recherche/', 'avant 0056')").run();
  noter.run('2099-01-01T00:00:00.000Z-d4', 1, 'page_tag', JSON.stringify({ page_id: don, ordre: ordre + 2 }), 'modifier', JSON.stringify({ tag_id: motCle.id }), JSON.stringify({ tag_id: retire }));
  noter.run('2099-01-01T00:00:00.000Z-d4', 2, 'mot_cle', JSON.stringify({ id: motCle.id }), 'modifier', JSON.stringify({ libelle: libre, libelle_cle: motCle.libelle_cle }),
    JSON.stringify({ libelle: `${libre} (renommée)`, libelle_cle: normalize(`${libre} (renommée)`) }));
  const neuve = rebatir(base);
  assert.deepEqual(neuve.conflits, [], 'aucun lot en conflit');
  assert.ok(neuve.base.prepare('SELECT 1 FROM capacite WHERE id = ?').get(don), 'le don survit');
  assert.ok(neuve.base.prepare('SELECT 1 FROM page WHERE id = ?').get(don), 'sa fiche aussi');
  const tags = neuve.base.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? ORDER BY ordre').all(don).map((t) => t.tag_id);
  assert.deepEqual(tags, [ID['capacite-de-classe']], 'les étiquettes d’avant 0056 n’ont pas d’effet');
  assert.equal(neuve.base.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(motCle.id), undefined, 'le mot-clé sans définition n’est pas créé');
  const sautees = neuve.base.prepare("SELECT etat FROM modification WHERE (lot_id = ? AND rang > ?) OR lot_id = '2099-01-01T00:00:00.000Z-d4' ORDER BY lot_id, rang").all(lot.id, dernier).map((m) => m.etat);
  assert.deepEqual(sautees, ['integree', 'integree', 'integree', 'integree', 'integree'], 'intégrées sans effet');
  assert.deepEqual(neuve.base.prepare('PRAGMA foreign_key_check').all(), []);
  for (const b of [base, neuve.base]) b.close();
});

test('rejeu (D3, R196) : un mot-clé fusionné sur le site de dev est reciblé dans les textes qu’il n’avait pas (pages d’exemple, textes reçus depuis), un code gardé ; un mot-clé supprimé que ces textes mentionnent met son lot en conflit', () => {
  // le site de dev est construit sans les pages d'exemple ; ses lots : « démo » supprimé (il ne porte que des pages d'exemple : le service l'accepte),
  // « aide » fusionné dans « guide »
  const site = vivante({ sansExemples: true });
  const id = (cle) => site.prepare('SELECT id, libelle, cle FROM mot_cle WHERE cle = ?').get(cle);
  const demo = id('essai-demo');
  const aide = id('essai-aide');
  const guide = id('essai-guide');
  const lot = serviceDe(site);
  lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: demo.id } }]);
  lot([{ op: 'fusionner_mots_cles', mot_cle: aide.id, dans: guide.id }]);
  // les règles d'arrivée (pages d'exemple comprises) ont des textes qui les citent, que le site de dev n'avait pas
  const cible = vivante();
  const exemple = 'races/exemple-race';
  assert.ok(cible.prepare('SELECT 1 FROM page WHERE id = ?').get(exemple), 'une page d’exemple dans les règles');
  cible.prepare('UPDATE page SET corps_md = corps_md || ?, resume = ? WHERE id = ?')
    .run(`\nVoir {{${demo.cle}:}}, {{${aide.cle}}} et {{${aide.cle}|l’aide}} ; \`{{${demo.cle}}}\` reste écrit.\n`, `Résumé {{${aide.cle}|aide}} et {{${demo.cle}|démo}}`, exemple);
  const arme = cible.prepare("SELECT id, effet FROM arme WHERE effet IS NOT NULL AND effet NOT LIKE '%{{%' ORDER BY id LIMIT 1").get();
  cible.prepare('UPDATE arme SET effet = ? WHERE id = ?').run(`${arme.effet}, {{${demo.cle}|Démo}}`, arme.id);
  for (const l of site.prepare('SELECT * FROM modification_lot').all()) {
    cible.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of site.prepare('SELECT * FROM modification').all()) {
    cible.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.etat, m.detail, m.apercu);
  }
  site.close();
  cible.exec('PRAGMA foreign_keys = OFF');
  cible.exec('BEGIN');
  const sortie = {};
  const bilan = rejouerLeJournal(cible, sortie);
  cible.exec('COMMIT');
  cible.exec('PRAGMA foreign_keys = ON');
  // la suppression de « démo » : en conflit (décision R196 : les textes reçus depuis le mentionnent ; les pages d'exemple, elles, n'arrêtent pas le
  // rejeu), rien n'en est écrit
  const conflits = cible.prepare("SELECT table_nom, cle, detail FROM modification WHERE etat = 'conflit'").all();
  assert.ok(conflits.length > 0 && conflits.every((c) => /encore mentionné .*R196/.test(c.detail)), JSON.stringify(conflits));
  assert.ok(conflits.some((c) => c.table_nom === 'mot_cle' && JSON.parse(c.cle).id === demo.id));
  assert.equal(bilan.conflits, conflits.length);
  assert.ok(cible.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(demo.id), '« démo » reste');
  const page = cible.prepare('SELECT corps_md, resume FROM page WHERE id = ?').get(exemple);
  // « aide » cite « guide », « démo » reste cité, le code reste écrit
  assert.ok(page.corps_md.endsWith(`\nVoir {{${demo.cle}:}}, {{${guide.cle}}} et {{${guide.cle}|l’aide}} ; \`{{${demo.cle}}}\` reste écrit.\n`), page.corps_md.slice(-200));
  assert.equal(page.resume, `Résumé {{${guide.cle}|aide}} et {{${demo.cle}|démo}}`, 'un texte de case : reciblé (son texte gardé)');
  assert.equal(cible.prepare('SELECT effet FROM arme WHERE id = ?').get(arme.id).effet, `${arme.effet}, {{${demo.cle}|Démo}}`, 'un texte que le site de dev n’avait pas');
  assert.ok(sortie.tablesCompletees.includes('page'), `tables écrites au-delà du journal : ${sortie.tablesCompletees}`);
  // plus aucune balise orpheline
  const vocabulaire = vocabulaireDesMotsCles(cible.prepare('SELECT id, libelle, cle FROM mot_cle').all());
  for (const t of [page.corps_md, page.resume, cible.prepare('SELECT effet FROM arme WHERE id = ?').get(arme.id).effet]) {
    assert.deepEqual(formesNonCanoniques(t, vocabulaire, { markdown: t === page.corps_md }), [], t.slice(-120));
  }
  cible.close();
});

/** `cible` (des règles, comme une livraison) reçoit le journal de `source` tel quel, puis le rejoue : { sortie, conflits }. */
function rejouerSur(cible, source) {
  for (const l of source.prepare('SELECT * FROM modification_lot').all()) {
    cible.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of source.prepare('SELECT * FROM modification').all()) {
    cible.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.etat, m.detail, m.apercu);
  }
  cible.exec('PRAGMA foreign_keys = OFF');
  cible.exec('BEGIN');
  const sortie = {};
  rejouerLeJournal(cible, sortie);
  cible.exec('COMMIT');
  cible.exec('PRAGMA foreign_keys = ON');
  return { sortie, conflits: cible.prepare("SELECT table_nom, cle, detail FROM modification WHERE etat = 'conflit'").all().map((c) => ({ ...c })) };
}

test('rejeu (D3) : un texte réécrit hors journal (balises d’un mot-clé fusionné), puis modifié sur le site de dev — le lot suivant passe à la livraison', () => {
  // 1. le site de dev fusionne « aide » dans « guide » (une suppression ne réécrit plus rien depuis la décision R196 : test suivant)
  const site = vivante();
  const id = (cle) => site.prepare('SELECT id FROM mot_cle WHERE cle = ?').get(cle).id;
  const [aide, guide] = ['essai-aide', 'essai-guide'].map(id);
  // les balises citent la clé (migration 0113)
  const [cleAide, cleGuide] = ['essai-aide', 'essai-guide'];
  serviceDe(site)([{ op: 'fusionner_mots_cles', mot_cle: aide, dans: guide }]);
  // 2. les règles livrées ensuite ont des textes qui les citent (reçus depuis : le service ne les a pas réécrits), un bloc de panneau de règles et l'effet
  // d'un don (sa fiche et la page de sa classe sont refaites depuis les tables)
  const bloc = site.prepare("SELECT panneau_id, rang, texte FROM panneau_regles_bloc WHERE instr(texte, '{{') = 0 ORDER BY panneau_id, rang LIMIT 1").get();
  const don = site.prepare("SELECT id, effet FROM capacite WHERE effet IS NOT NULL AND instr(effet, '{{') = 0 ORDER BY id LIMIT 1").get();
  const recus = (db) => {
    db.prepare('UPDATE panneau_regles_bloc SET texte = ? WHERE panneau_id = ? AND rang = ?')
      .run(`${bloc.texte}\n\nVoir {{${cleAide}|l’aide}}.`, bloc.panneau_id, bloc.rang);
    db.prepare('UPDATE capacite SET effet = ? WHERE id = ?').run(`${don.effet} {{${cleAide}|Aide}}`, don.id);
  };
  const vivanteRefaite = vivante();
  recus(vivanteRefaite);
  const refaite = rejouerSur(vivanteRefaite, site);
  site.close();
  assert.deepEqual(refaite.conflits, []);
  const lu = vivanteRefaite.prepare('SELECT texte FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?').get(bloc.panneau_id, bloc.rang).texte;
  assert.equal(lu, `${bloc.texte}\n\nVoir {{${cleGuide}|l’aide}}.`, 'reciblé : au moment où le lot est rejoué');
  const effetLu = vivanteRefaite.prepare('SELECT effet FROM capacite WHERE id = ?').get(don.id).effet;
  assert.equal(effetLu, `${don.effet} {{${cleGuide}|Aide}}`);
  assert.ok(!vivanteRefaite.prepare('SELECT corps_md FROM page WHERE id = ?').get(don.id).corps_md.includes(`{{${cleAide}`), 'la fiche du don refaite depuis sa table');
  assert.ok(['panneau_regles_bloc', 'capacite'].every((t) => refaite.sortie.tablesCompletees.includes(t)), `tables écrites au-delà du journal : ${refaite.sortie.tablesCompletees}`);
  // 3. sur la base vivante refaite, la personne modifie ces deux textes (le service note avant = ce qu'il lit, réécrit)
  serviceDe(vivanteRefaite)([
    { op: 'modifier', table: 'panneau_regles_bloc', cle: { panneau_id: bloc.panneau_id, rang: bloc.rang }, valeurs: { texte: `${lu} Précision du site.` }, avant: { texte: lu } },
    { op: 'modifier', table: 'capacite', cle: { id: don.id }, valeurs: { effet: `${effetLu} Précision du site.` }, avant: { effet: effetLu } },
  ]);
  // 4. la livraison : le journal du site de dev rejoué sur les mêmes règles — le lot de la personne trouve les textes tels qu'elle les a lus
  const livraison = vivante();
  recus(livraison);
  const r = rejouerSur(livraison, vivanteRefaite);
  vivanteRefaite.close();
  assert.deepEqual(r.conflits, [], 'aucun lot en conflit');
  assert.equal(livraison.prepare('SELECT texte FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?').get(bloc.panneau_id, bloc.rang).texte, `${lu} Précision du site.`);
  assert.equal(livraison.prepare('SELECT effet FROM capacite WHERE id = ?').get(don.id).effet, `${effetLu} Précision du site.`);
  assert.deepEqual(livraison.prepare('PRAGMA foreign_key_check').all(), []);
  livraison.close();
});

test('R196, rejeu : la suppression d’un mot-clé que les règles livrées mentionnent depuis met son lot en conflit, rien n’en est écrit, choix 2 seul à la résolution ; sans mention, elle passe', () => {
  // deux mots-clés des règles mentionnés nulle part : le site de dev les supprime ; les règles livrées ensuite citent le premier dans un bloc de panneau
  const site = vivante();
  const livraison = vivante();
  const [cite, seul] = ['Essai R196 cité', 'Essai R196 seul'].map((libelle) => {
    // le même id entier dans les deux bases (elles partent des mêmes règles)
    const id = Math.max(...[site, livraison].map((db) => db.prepare('SELECT max(id) AS n FROM mot_cle').get().n)) + 1;
    for (const db of [site, livraison]) db.prepare('INSERT INTO mot_cle (id, libelle, cle, description) VALUES (?, ?, ?, ?)').run(id, libelle, normalize(libelle), 'Mot-clé d’essai (R196).');
    return id;
  });
  const cleCite = normalize('Essai R196 cité');
  for (const id of [cite, seul]) serviceDe(site)([{ op: 'supprimer', entite: 'mot_cle', cle: { id } }]);
  const bloc = livraison.prepare("SELECT panneau_id, rang, texte FROM panneau_regles_bloc WHERE instr(texte, '{{') = 0 ORDER BY panneau_id, rang LIMIT 1").get();
  livraison.prepare('UPDATE panneau_regles_bloc SET texte = ? WHERE panneau_id = ? AND rang = ?').run(`${bloc.texte} Voir {{${cleCite}}}.`, bloc.panneau_id, bloc.rang);
  const r = rejouerSur(livraison, site);
  site.close();
  const enConflit = r.conflits.filter((c) => c.table_nom === 'mot_cle');
  assert.deepEqual(enConflit.map((c) => JSON.parse(c.cle).id), [cite], JSON.stringify(r.conflits));
  assert.match(enConflit[0].detail, /encore mentionné .*R196/);
  assert.ok(livraison.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(cite), 'le mot-clé cité reste');
  assert.equal(livraison.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(seul), undefined, 'l’autre est supprimé');
  // la page « Mise à jour » : cette suppression n'a que le choix 2 (sinon la résoudre referait la cascade), avec sa raison ; résolue, le mot-clé et sa
  // balise restent
  const lotId = livraison.prepare("SELECT DISTINCT lot_id FROM modification WHERE etat = 'conflit' AND table_nom = 'mot_cle'").get().lot_id;
  const diag = examinerLeLot(livraison, lotId);
  const conflit = diag.conflits.find((c) => c.table === 'mot_cle');
  assert.deepEqual([conflit.operation, conflit.cle, conflit.choix_possibles], ['supprimer', { id: cite }, [2]], JSON.stringify(diag.conflits));
  assert.match(conflit.raison, /encore mentionné .*R196/);
  assert.ok(!diag.saines.some((x) => x.table === 'mot_cle'), 'pas une modification saine');
  assert.throws(() => resoudreLeConflit(livraison, { lot: lotId, empreinte: diag.empreinte, choix: { [conflit.id]: { choix: 1 } } }), (e) => e.statut === 400);
  resoudreLeConflit(livraison, { lot: lotId, empreinte: diag.empreinte, choix: { [conflit.id]: { choix: 2 } } });
  assert.ok(livraison.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(cite), 'résolu au choix 2 : le mot-clé reste');
  assert.ok(livraison.prepare('SELECT texte FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?').get(bloc.panneau_id, bloc.rang).texte.includes(`{{${cleCite}}}`), 'sa balise aussi');
  livraison.close();
});

test('rapatriement et mise à jour sur data/rows : les pages d’exemple (absentes du site de dev) perdent un mot-clé supprimé ou fusionné, rien ne bloque (R196 : elles n’arrêtent pas le rejeu)', { skip: sansPython }, () => {
  // le site de dev est construit sans les pages d'exemple (HIDE_EXAMPLES=1) ; data/rows les garde, avec leurs mots-clés
  const site = vivante({ sansExemples: true });
  const servi = { base: () => site, etat: () => ({}), edition: true };
  const lot = (operations) => {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'recherche/', operations }) }, servi);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
  };
  const id = (cle) => site.prepare('SELECT id FROM mot_cle WHERE cle = ?').get(cle)?.id;
  // mots-clés d'essai (test/aide-mots-cles.mjs) : « démo » seulement sur des exemples (0 page au site de dev) ; « personnage » : une vraie page et deux
  // exemples ; « magie » : renommé ; « aide » : fusionné
  const demo = id('essai-demo');
  const personnage = id('essai-personnage');
  const magie = id('essai-magie');
  const aide = id('essai-aide');
  assert.ok(demo && personnage && magie && aide, 'mots-clés d’exemple présents dans le vocabulaire');
  assert.equal(site.prepare('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?').get(demo).n, 0, '« démo » : aucune page au site de dev');
  const cible = site.prepare('SELECT id FROM mot_cle WHERE cle = ?').get('essai-guide').id;
  lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: demo } }]);
  // « personnage » est porté par une vraie page : le service refuse sa suppression (décision R196)
  const refus = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'recherche/', operations: [{ op: 'supprimer', entite: 'mot_cle', cle: { id: personnage } }] }) }, servi);
  assert.equal(refus.statut, 409, JSON.stringify(refus.corps));
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
    for (const m of [demo, aide]) assert.equal(base.prepare('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?').get(m).n, 0, m);
    assert.ok(base.prepare('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?').get(personnage).n > 0, '« personnage » reste');
    assert.equal(base.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(magie).libelle, renomme);
    assert.ok(base.prepare("SELECT 1 FROM page_tag WHERE page_id = 'magies/exemple-magie' AND tag_id = ?").get(magie), 'l’exemple garde « magie » renommé');
    assert.deepEqual(base.prepare('PRAGMA foreign_key_check').all(), []);
  };
  // db:appliquer-edition
  const rows = join(racine, 'rapatriement', 'rows');
  cpSync(reglesDe(false).rows, rows, { recursive: true });
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  assert.equal(r.ecrit, true);
  const appliquee = construire(rows, 'rapatriement');
  verifier(appliquee);
  appliquee.close();
  // « Effectuer la mise à jour » : page_tag.sql change au-delà du journal (exemples) sans être refusé (code 4)
  const rowsMaj = copieSansNoteEnAttente(join(racine, 'mise-a-jour', 'rows'), { versionProduction: versionALaRevision('HEAD') }).rows;
  ajouterLesMotsClesDEssai(rowsMaj);
  const maj = appliquerMiseAJour({ format: 'maverick-mise-a-jour/1', id: '22222222-3333-4444-5555-666666666666', cree_le: '2026-10-14T08:00:00Z', version_dev: '0.2.39', version_cible: '0.3', texte: null, journal },
    { rows: rowsMaj, reference: 'HEAD', date: '2026-10-14', versionDev: '0.2.39' });
  assert.ok(maj.fichiers.includes('page_tag.sql') && maj.fichiers.includes('mot_cle.sql'), maj.fichiers.join(', '));
  const majee = construire(rowsMaj, 'mise-a-jour');
  verifier(majee);
  majee.close();
});
