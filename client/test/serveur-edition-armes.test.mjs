// Édition de la page « Armes » depuis le site de dev (serveur/edition-armes.mjs ; demande du propriétaire : « tout peut être éditable à l'instar des autres
// pages ») : une cellule modifiée refait ce que la base en tire (colonnes typées, types de dégâts, minimums de caractéristique, bonus d'un matériau, coût et
// effet d'une amélioration, ligne TOTAL) et la ligne du corps Markdown de la page ; le rejeu du journal (livraison) refait le même corps. Les tests lisent
// l'état avant d'écrire : les essais du site de dev peuvent avoir modifié ces lignes.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { analyserEffetDArme, totalDesAmeliorations } from '../src/lib/arme-champs.mjs';
import { ligneDAmelioration, ligneDArme, ligneDeMateriau, ligneDuTotal, PAGE_DES_ARMES, PAGES_DES_MATERIAUX } from '../src/lib/corps-armes.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { attributEd, lireAttributEd, TABLES } from '../src/lib/edition-modele.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-armes-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
const db = vivante();
const service = { base: () => db, etat: () => ({}), edition: true };
const enregistrer = (operations) =>
  traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: `${PAGE_DES_ARMES}/`, operations }) }, service);
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const corps = (base = db, id = PAGE_DES_ARMES) => base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
const appel = (methode, chemin, corps_) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps_ && JSON.stringify(corps_) }, service);
/** Un nom qu'aucune arme de la famille ne porte encore (les essais du site peuvent en avoir créé). */
const nomLibre = (famille, nom) => {
  let n = nom;
  for (let i = 2; ligne('SELECT 1 FROM arme WHERE famille_id = ? AND nom = ?', famille, n); i += 1) n = `${nom} ${i}`;
  return n;
};
/** Une arme de la page (pas une arme de monstre), choisie par son identifiant (jamais modifié) : son nom a pu l'être sur le site de dev. */
const armeDeLaPage = () => ligne("SELECT a.* FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 1 AND a.effet IS NOT NULL ORDER BY a.id LIMIT 1");

test('le modèle : arme, matériau et amélioration d’arme se modifient ; les attributs data-ed des cellules se relisent', () => {
  for (const t of ['arme', 'materiau_arme', 'amelioration_equipement']) assert.ok(TABLES[t], t);
  assert.deepEqual(lireAttributEd(attributEd('arme', { id: 'x' }, 'effet'))?.table, 'arme');
  assert.equal(lireAttributEd(attributEd('arme', { id: 'x' }, 'bonus_degats')), null, 'une colonne tirée ne se saisit pas');
});

test('arme : l’effet modifié refait les colonnes typées, les types de dégâts, les minimums et sa ligne du corps', () => {
  const avant = armeDeLaPage();
  assert.ok(avant, 'une arme de la page');
  const effet = 'Dégâts taille/estoc, 3 de Force minimum, portée 1-2, +4 dégâts, -1 cran de solidité, Facture Majin, tranche le vent';
  const r = enregistrer([{ op: 'modifier', table: 'arme', cle: { id: avant.id }, valeurs: { effet }, avant: { effet: avant.effet } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM arme WHERE id = ?', avant.id);
  assert.deepEqual([apres.bonus_degats, apres.portee_min, apres.portee_max, apres.solidite_fixee, apres.solidite_delta, apres.provenance_mot, apres.provenance],
    [4, 1, 2, null, -1, 'Facture', 'Majin']);
  assert.deepEqual(lignes('SELECT type_degats FROM arme_degats WHERE arme_id = ? ORDER BY type_degats', avant.id).map((l) => l.type_degats), ['estoc', 'taille']);
  assert.deepEqual(lignes('SELECT caracteristique_id, minimum FROM arme_prerequis WHERE arme_id = ?', avant.id), [{ caracteristique_id: 'force', minimum: 3 }]);
  assert.equal(analyserEffetDArme(effet).autres, '3 de Force minimum, tranche le vent');
  assert.ok(corps().split('\n').includes(ligneDArme(apres)), 'la ligne du corps suit');
  assert.ok(!corps().split('\n').includes(ligneDArme(avant)));
});

test('arme : nom, mains, type, catégorie et case de départ ; la cellule Nom et la liste des armes de départ suivent', () => {
  const avant = lignes("SELECT a.* FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 1 AND a.depart_possible = 0 AND a.de_source = 'type' ORDER BY a.id LIMIT 1")[0];
  const type = ligne("SELECT * FROM arme_type WHERE id <> ? AND de IS NOT NULL AND de <> ? ORDER BY id LIMIT 1", avant.type_id, avant.de);
  const nom = `${avant.nom} essai ${process.pid}`;
  const r = enregistrer([{ op: 'modifier', table: 'arme', cle: { id: avant.id }, valeurs: { nom, mains: 'deux', type_id: type.id, competence_brut: 'Arc / Arme Légère', depart_possible: '1' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM arme WHERE id = ?', avant.id);
  assert.equal(apres.nom_brut, `${nom}\n(deux mains)`);
  assert.equal(apres.categorie_brut, `${type.nom}\nArc / Arme Légère`);
  assert.equal(apres.de, type.de, 'le dé suit le type quand l’effet n’en écrit pas');
  assert.equal(apres.depart_possible, 1);
  assert.ok(corps().split('\n').some((l) => l.startsWith('- Sous « ') && l.includes(`${nom} (deux mains)`)), 'dans la liste des armes de départ');
  // une catégorie hors de la liste, un type inconnu : refusés
  assert.equal(enregistrer([{ op: 'modifier', table: 'arme', cle: { id: avant.id }, valeurs: { competence_brut: 'Arme Moyenne' } }]).statut, 400);
  assert.equal(enregistrer([{ op: 'modifier', table: 'arme', cle: { id: avant.id }, valeurs: { type_id: 'lance-pierre' } }]).statut, 400);
});

test('les armes de monstres ne se modifient pas ici (décision R45)', () => {
  const monstre = ligne("SELECT a.* FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 0 LIMIT 1");
  if (!monstre) return;
  const r = enregistrer([{ op: 'modifier', table: 'arme', cle: { id: monstre.id }, valeurs: { description: 'essai' } }]);
  assert.equal(r.statut, 400, JSON.stringify(r.corps));
});

test('matériau : prix et effets refont bonus, cran, effet secondaire et prix en RF ; sa ligne du corps suit', () => {
  const avant = ligne("SELECT * FROM materiau_arme WHERE ressource_id LIKE '%:titane'");
  const nom = ligne('SELECT nom FROM ressource WHERE id = ?', avant.ressource_id).nom;
  const r = enregistrer([{ op: 'modifier', table: 'materiau_arme', cle: { ressource_id: avant.ressource_id }, valeurs: { prix_brut: '250 RO', effet_brut: "Dégâts +11 pour l'arme\n+2 cran de solidité\nBrille dans le noir" } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM materiau_arme WHERE ressource_id = ?', avant.ressource_id);
  assert.deepEqual([apres.bonus_degats, apres.cran_solidite, apres.effet_secondaire, apres.prix_rf], [11, 2, 'Brille dans le noir', 25000]);
  assert.ok(corps().split('\n').includes(ligneDeMateriau(nom, apres)));
});

test('amélioration d’arme : coût et effet refont RO, matériaux, bonus et crans, et la ligne TOTAL ; une autre cible est refusée', () => {
  const avant = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'arme' AND niveau = 3");
  const r = enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: avant.id }, valeurs: { cout_brut: '1 Matériel + 120 RO', effet_brut: '+7 dégâts, +1 cran de solidité' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM amelioration_equipement WHERE id = ?', avant.id);
  assert.deepEqual([apres.cout_ro, apres.cout_materiaux, apres.bonus_degats, apres.bonus_cran], [120, 1, 7, 1]);
  const total = totalDesAmeliorations(lignes("SELECT * FROM amelioration_equipement WHERE cible = 'arme'"));
  assert.equal(ligne("SELECT total_brut FROM amelioration_total WHERE cible = 'arme'").total_brut, total);
  assert.ok(corps().split('\n').includes(ligneDAmelioration(apres)));
  assert.ok(corps().split('\n').includes(ligneDuTotal(total)));
  const armure = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'armure' LIMIT 1");
  assert.equal(enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: armure.id }, valeurs: { cout_brut: '1 RO' } }]).statut, 400);
});

test('matériau renommé (même ressource que les armures et les boucliers) : le nom suit partout, pages des armures et des boucliers comprises', () => {
  const avant = ligne("SELECT r.* FROM ressource r JOIN materiau_arme m ON m.ressource_id = r.id WHERE r.id LIKE '%:fer-noir'");
  const nom = `${avant.nom} essai ${process.pid}`;
  const pages = Object.fromEntries(PAGES_DES_MATERIAUX.map((id) => [id, corps(db, id)]));
  const r = enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: avant.id }, valeurs: { nom } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne('SELECT nom_cle FROM ressource WHERE id = ?', avant.id).nom_cle.startsWith('fer-noir-essai'), true, 'clé du nom recalculée');
  const m = ligne('SELECT * FROM materiau_arme WHERE ressource_id = ?', avant.id);
  assert.ok(corps().split('\n').includes(ligneDeMateriau(nom, m)), 'ligne du tableau des matériaux');
  for (const id of PAGES_DES_MATERIAUX) {
    assert.ok(corps(db, id).includes(`| ${nom} |`), `${id} : le nouveau nom dans ses tableaux`);
    assert.ok(!corps(db, id).split('\n').some((l) => l.split('|').some((c) => c.trim().toLowerCase() === avant.nom.toLowerCase())), `${id} : plus de case « ${avant.nom} »`);
    assert.ok(corps(db, id).includes('Armure Peau/Fer Noir') || !pages[id].includes('Armure Peau/Fer Noir'), `${id} : les noms d'armures restent`);
  }
  // une ressource qui n'est pas un composant (page « Composants ») ne se renomme pas
  const autre = ligne("SELECT id FROM ressource WHERE genre = 'potion' LIMIT 1"); // un consommable : pas un composant
  assert.equal(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: autre.id }, valeurs: { nom: 'X' } }]).statut, 400);
});

test('arme créée : id tiré du nom, à la fin de sa famille ; colonnes, détails, page et corps ; refus d’une famille de monstres ou d’un nom pris', () => {
  const famille = 'dagues';
  const nom = nomLibre(famille, 'Dague d’essai');
  const r = enregistrer([{ op: 'creer', entite: 'arme', valeurs: {
    famille_id: famille, nom, mains: 'une', competence_brut: 'Arme Légère', type_id: 'dague', cout_brut: '12 Ro',
    effet: 'Dégâts estoc, 2 de Agilité minimum, +3 dégâts, Origine Elfe, siffle', description: 'Une dague d’essai.', depart_possible: '1',
  } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const id = r.corps.crees[0].id;
  assert.match(id, /^ressources\/armes#arme:dagues:dague-dessai/);
  const a = ligne('SELECT * FROM arme WHERE id = ?', id);
  assert.equal(a.ordre, ligne('SELECT max(ordre) AS m FROM arme WHERE famille_id = ?', famille).m);
  assert.deepEqual([a.nom_brut, a.categorie_brut, a.cout_ro, a.de, a.de_source, a.bonus_degats, a.provenance, a.depart_possible],
    [`${nom}\n(une main)`, 'Dague\nArme Légère', 12, 'D6', 'type', 3, 'Elfe', 1]);
  assert.deepEqual(lignes('SELECT type_degats FROM arme_degats WHERE arme_id = ?', id).map((l) => l.type_degats), ['estoc']);
  assert.ok(ligne("SELECT 1 FROM page_entite WHERE entite_table = 'arme' AND entite_id = ? AND page_id = ?", id, PAGE_DES_ARMES));
  const l = corps().split('\n');
  const titre = l.findIndex((x) => x.startsWith('## DAGUES'));
  const suivante = l.findIndex((x, k) => k > titre && x.startsWith('## '));
  const tableau = l.slice(titre, suivante).filter((x) => x.startsWith('|'));
  assert.equal(tableau.at(-1), ligneDArme(a), 'à la fin du tableau de sa famille');
  assert.ok(l.some((x) => x.startsWith('- Sous « DAGUES') && x.includes(`${nom} (une main)`)), 'dans la liste des armes de départ');
  // refus
  const creer = (valeurs) => enregistrer([{ op: 'creer', entite: 'arme', valeurs: { competence_brut: 'Arme Légère', type_id: 'dague', depart_possible: '0', ...valeurs } }]);
  assert.equal(creer({ famille_id: 'arme-de-monstres', nom: 'Interdite' }).statut, 400);
  assert.equal(creer({ famille_id: famille, nom }).statut, 409, 'nom déjà pris dans la famille');
});

test('arme supprimée : retirée des fiches qui l’ont, avec une note datée (décision R52, comme R42) ; détails, page et ligne du corps partent', () => {
  const famille = 'epees';
  const nom = nomLibre(famille, 'Épée à supprimer');
  const id = enregistrer([{ op: 'creer', entite: 'arme', valeurs: { famille_id: famille, nom, competence_brut: 'Arme Lourde', type_id: 'epee', effet: 'Dégâts taille, +1 dégâts', depart_possible: '0' } }]).corps.crees[0].id;
  const fer = ligne("SELECT ressource_id AS id FROM materiau_arme WHERE ressource_id LIKE '%:fer'").id;
  const cree = appel('POST', '/api/personnages/', { ...ficheVide(`Témoin ${process.pid}`), notes: 'Notes du joueur.', armes: [{ rang: 1, arme_id: id, materiau_id: fer }] });
  assert.equal(cree.statut, 201, JSON.stringify(cree.corps));
  const fiche = cree.corps.personnage.id;
  const arme = ligne('SELECT * FROM arme WHERE id = ?', id);
  const r = enregistrer([{ op: 'supprimer', entite: 'arme', cle: { id } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne('SELECT 1 FROM arme WHERE id = ?', id), undefined);
  for (const t of ['arme_degats', 'arme_prerequis']) assert.equal(ligne(`SELECT count(*) AS n FROM ${t} WHERE arme_id = ?`, id).n, 0, t);
  assert.equal(ligne("SELECT 1 FROM page_entite WHERE entite_table = 'arme' AND entite_id = ?", id), undefined);
  assert.ok(!corps().split('\n').includes(ligneDArme(arme)), 'sa ligne du corps est partie');
  assert.equal(ligne('SELECT count(*) AS n FROM personnage_arme WHERE personnage_id = ?', fiche).n, 0, 'l’arme a quitté la fiche');
  const notes = ligne('SELECT notes FROM personnage WHERE id = ?', fiche).notes;
  assert.ok(notes.startsWith('Notes du joueur.\n'), 'le texte du joueur reste');
  assert.match(notes, new RegExp(`l’arme « ${nom} » \\(ÉPÉES, arme 1\\) n’existe plus dans les règles`));
  assert.ok(r.corps.fiches.some((f) => f.fiche === `Témoin ${process.pid}`), 'la fiche est annoncée');
  // une arme de monstre ne se supprime pas ici
  const monstre = ligne("SELECT a.id FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 0 LIMIT 1");
  if (monstre) assert.equal(enregistrer([{ op: 'supprimer', entite: 'arme', cle: { id: monstre.id } }]).statut, 400);
});

test('rejeu du journal (livraison) : les mêmes lignes et le même corps de page sur des règles neuves', () => {
  const journal = journalExporte(db);
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const sortie = {};
  rejouerLeJournal(neuve, sortie);
  neuve.exec('COMMIT');
  assert.deepEqual(sortie.illisibles, []);
  assert.ok(sortie.pages.includes(PAGE_DES_ARMES), 'la page des armes est refaite');
  assert.equal(corps(neuve), corps(db));
  for (const id of PAGES_DES_MATERIAUX) assert.equal(corps(neuve, id), corps(db, id), id);
  for (const t of ['arme', 'arme_degats', 'arme_prerequis', 'materiau_arme', 'amelioration_equipement', 'amelioration_total', 'ressource', 'page_entite']) {
    assert.deepEqual(neuve.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), t);
  }
  neuve.close();
});
