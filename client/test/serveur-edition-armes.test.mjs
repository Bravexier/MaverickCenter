// Édition de la page « Armes » depuis le site de dev (serveur/edition-armes.mjs ; demande du propriétaire : « tout peut être éditable à l'instar des autres
// pages ») : une cellule modifiée refait ce que la base en tire (colonnes typées, types de dégâts, minimums de caractéristique, bonus d'un matériau, coût et
// effet d'une amélioration, ligne TOTAL) et la ligne du corps Markdown de la page ; le rejeu du journal (livraison) refait le même corps. Les tests lisent
// l'état avant d'écrire : les essais du site de dev peuvent avoir modifié ces lignes.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { analyserEffetDArme, totalDesAmeliorations } from '../src/lib/arme-champs.mjs';
import { ligneDAmelioration, ligneDArme, ligneDeMateriau, ligneDeRemarque, ligneDuTotal, PAGE_DES_ARMES, PAGES_DES_MATERIAUX } from '../src/lib/corps-armes.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { attributEd, CATEGORIES_DE_FAMILLE, COUTS_DE_FAMILLE, ENTITES, lireAttributEd, TABLES } from '../src/lib/edition-modele.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { desSelonLaForce, famillesAuChoix, famillesDuNom, lireLigneDeClasse } from '../src/lib/maitrise-arme.mjs';
import { titreDeSectionDeFamille } from '../src/lib/corps-armes.mjs';
import { famillesDuLecteur } from '../serveur/edition-maitrises.mjs';
import { sourcesJustes } from './aide-maitrise-arme.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-armes');
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

test('arme : la remarque (décision R91 : sa présence et son contenu) se saisit, se modifie et se vide ; l’entrée du corps suit', () => {
  const avant = ligne("SELECT a.* FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 1 AND a.effet IS NOT NULL ORDER BY a.id DESC LIMIT 1");
  assert.equal(lireAttributEd(attributEd('arme', { id: avant.id }, 'remarque'))?.champ.type, 'texte', 'la remarque se saisit');
  const entree = (remarque) => ligneDeRemarque({ ...avant, remarque });
  const poser = (remarque, ancienne) => {
    const r = enregistrer([{ op: 'modifier', table: 'arme', cle: { id: avant.id }, valeurs: { remarque }, avant: { remarque: ancienne } }]);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
  };
  const texte = `Remarque d’essai ${process.pid}.`;
  poser(texte, avant.remarque);
  assert.equal(ligne('SELECT remarque FROM arme WHERE id = ?', avant.id).remarque, texte);
  assert.equal(corps().split('\n').filter((l) => l === entree(texte)).length, 1, 'une entrée dans le corps');
  poser('', texte);
  assert.equal(ligne('SELECT remarque FROM arme WHERE id = ?', avant.id).remarque, null, 'vidée : pas de remarque (ni d’étoile)');
  assert.ok(!corps().includes(entree(texte)), 'l’entrée du corps part');
  // une remarque sur deux paragraphes, laissée en place : le rejeu du journal (plus bas) refait la même entrée
  poser('Remarque\n\nrécrite.', null);
  assert.ok(corps().split('\n').includes(entree('Remarque\n\nrécrite.')) && entree('Remarque\n\nrécrite.').endsWith(' : Remarque récrite.'));
});

test('les armes de monstres ne se modifient pas ici (décision R45)', () => {
  const monstre = ligne("SELECT a.* FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 0 LIMIT 1");
  if (!monstre) return;
  const r = enregistrer([{ op: 'modifier', table: 'arme', cle: { id: monstre.id }, valeurs: { description: 'essai' } }]);
  assert.equal(r.statut, 400, JSON.stringify(r.corps));
});

test('matériau : ses effets (modifiés depuis la page « Composants », R62) refont bonus, cran et effet secondaire ; son prix se donne à la ressource ; sa ligne du corps suit', () => {
  const avant = ligne("SELECT * FROM materiau_arme WHERE ressource_id LIKE '%:titane'");
  const nom = ligne('SELECT nom FROM ressource WHERE id = ?', avant.ressource_id).nom;
  const r = enregistrer([{ op: 'modifier', table: 'materiau_arme', cle: { ressource_id: avant.ressource_id }, valeurs: { effet_brut: "Dégâts +11 pour l'arme\n+2 cran de solidité\nBrille dans le noir" } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(enregistrer([{ op: 'modifier', table: 'materiau_arme', cle: { ressource_id: avant.ressource_id }, valeurs: { prix_brut: '250 RO' } }]).statut, 400, 'le prix est celui de la ressource');
  // le prix de la ressource (page « Composants ») est recopié dans materiau_arme
  assert.equal(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: avant.ressource_id }, valeurs: { prix_brut: '250 RO' } }]).statut, 200);
  const apres = ligne('SELECT * FROM materiau_arme WHERE ressource_id = ?', avant.ressource_id);
  assert.deepEqual([apres.bonus_degats, apres.cran_solidite, apres.effet_secondaire, apres.prix_brut, apres.prix_rf], [11, 2, 'Brille dans le noir', '250 RO', 25000]);
  assert.ok(corps().split('\n').includes(ligneDeMateriau(nom, apres)));
});

test('amélioration d’arme : coût et effet refont RO, matériaux, bonus et crans, et la ligne TOTAL ; celle d’une pièce élémentaire est refusée', () => {
  const avant = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'arme' AND niveau = 3");
  const r = enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: avant.id }, valeurs: { cout_brut: '1 Matériel + 120 RO', effet_brut: '+7 dégâts, +1 cran de solidité' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM amelioration_equipement WHERE id = ?', avant.id);
  assert.deepEqual([apres.cout_ro, apres.cout_materiaux, apres.bonus_degats, apres.bonus_cran], [120, 1, 7, 1]);
  const total = totalDesAmeliorations(lignes("SELECT * FROM amelioration_equipement WHERE cible = 'arme'"));
  assert.equal(ligne("SELECT total_brut FROM amelioration_total WHERE cible = 'arme'").total_brut, total);
  assert.ok(corps().split('\n').includes(ligneDAmelioration(apres)));
  assert.ok(corps().split('\n').includes(ligneDuTotal(total)));
  // les cases d'une amélioration de bouclier (coût en RO, matériaux, AP, cran : demande du propriétaire, 2026-10-17) ne se saisissent pas pour une arme
  for (const valeurs of [{ cout_ro: '99' }, { bonus_cran: '1' }, { cout_materiaux: '1' }, { bonus_ap: '3' }]) {
    assert.equal(enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: avant.id }, valeurs }]).statut, 400, JSON.stringify(valeurs));
  }
  assert.equal(ligne('SELECT cout_ro FROM amelioration_equipement WHERE id = ?', avant.id).cout_ro, 120);
  // celles d'armure et de bouclier se modifient sur la page des armures (test/serveur-edition-armures.test.mjs) ; celles des pièces élémentaires, nulle part
  const elementaire = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'arme_elementaire' LIMIT 1");
  assert.equal(enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: elementaire.id }, valeurs: { cout_brut: '1 RO' } }]).statut, 400);
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
  const autre = ligne("SELECT id FROM ressource WHERE genre = 'livre' LIMIT 1"); // un livre : pas un composant (une potion se modifie dans l'onglet Ceinture)
  assert.equal(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: autre.id }, valeurs: { nom: 'X' } }]).statut, 400);
});

test('arme créée : id tiré du nom, à la fin de sa famille ; colonnes, détails, page et corps ; refus d’une famille de monstres ou d’un nom pris', () => {
  const famille = 'dagues';
  const nom = nomLibre(famille, 'Dague d’essai');
  const r = enregistrer([{ op: 'creer', entite: 'arme', valeurs: {
    famille_id: famille, nom, mains: 'une', competence_brut: 'Arme Légère', type_id: 'dague', cout_brut: '12 Ro',
    effet: 'Dégâts estoc, 2 de Agilité minimum, +3 dégâts, Origine Elfe, siffle', description: 'Une dague d’essai.', depart_possible: '1',
    remarque: 'Une remarque d’essai.',
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
  assert.equal(a.remarque, 'Une remarque d’essai.');
  assert.ok(l.includes(`**Remarque de l’arme « ${nom} »** : Une remarque d’essai.`), 'sa remarque sous le tableau');
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

// ——— Familles d'armes (décision R159 : « la possibilité de changer le nom et leur dés, ou même de créer un nouvel onglet donc un nouveau tableau si
// besoin ») : nom, dé (forme contrôlée) et en-tête de coût se modifient, une famille se crée (catégorie fixée), aucune ne se supprime ; ARME DE MONSTRES
// reste hors de la page (R45) ; un renommage ne change ni l'identifiant ni le nom de lecture (migration 0077), ni la lecture des maîtrises (R138, R151).
const famille = (id) => ligne('SELECT * FROM arme_famille WHERE id = ?', id);
const titres = () => corps().split('\n').filter((l) => /^## /.test(l));
const tablesDesSources = () => ['maitrise_arme_part', 'maitrise_arme_part_famille', 'capacite_nm_gagne'].map((t) => lignes(`SELECT * FROM ${t}`).map((x) => JSON.stringify(x)).sort());
const creerFamille = (valeurs) => enregistrer([{ op: 'creer', entite: 'arme_famille', valeurs: { categorie: 'distance', de_brut: 'D6', cout_libelle: 'Coût en plus/moins', ...valeurs } }]);
const PID = process.pid;

test('R159 : le modèle d’une famille d’armes — nom, dé, en-tête de coût ; création avec la catégorie, sans suppression ; ni catégorie ni nom de lecture saisis', () => {
  assert.deepEqual(Object.keys(TABLES.arme_famille.colonnes), ['nom', 'de_brut', 'cout_libelle']);
  assert.deepEqual(Object.keys(ENTITES.arme_famille.champs), ['nom', 'de_brut', 'categorie', 'cout_libelle']);
  assert.ok(!ENTITES.arme_famille.suppression, 'une famille ne se supprime pas');
  for (const c of ['categorie', 'nom_lecture', 'maitrisable', 'ordre', 'libelle_brut']) assert.equal(lireAttributEd(attributEd('arme_famille', { id: 'epees' }, c)), null, c);
  // les en-têtes de coût : les trois de l'import (R159, 3), rien d'autre ; les catégories : celles de R127
  const dImport = historiqueSite(db).lignesDImport('arme_famille');
  assert.deepEqual(COUTS_DE_FAMILLE.map((c) => c.valeur).sort(), [...new Set(dImport.map((f) => f.cout_libelle))].sort());
  assert.deepEqual(CATEGORIES_DE_FAMILLE.map((c) => c.valeur).sort(), [...new Set(dImport.map((f) => f.categorie).filter(Boolean))].sort());
});

test('R159 : une famille renommée, au dé et à l’en-tête de coût changés — identifiant figé, bandeau refait (note gardée), nom de lecture inchangé, section, liste des armes de départ, journal', () => {
  const avant = famille('bombes');
  const nom = `GRENADES ${PID}`;
  const sources = tablesDesSources();
  const cout = COUTS_DE_FAMILLE.map((c) => c.valeur).find((c) => c !== avant.cout_libelle);
  const r = enregistrer([{ op: 'modifier', table: 'arme_famille', cle: { id: 'bombes' }, valeurs: { nom, de_brut: ' d6 / d8 ', cout_libelle: cout }, avant: { nom: avant.nom } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = famille('bombes');
  assert.deepEqual([apres.nom, apres.de_brut, apres.cout_libelle, apres.nom_lecture, apres.categorie, apres.maitrisable, apres.ordre, apres.note_brut],
    [nom, 'D6/D8', cout, avant.nom_lecture, avant.categorie, 1, avant.ordre, avant.note_brut]);
  const suite = avant.libelle_brut.slice(`${avant.nom} - ${avant.de_brut}`.length);
  assert.ok(suite.length > 0, 'BOMBES a une note après son dé');
  assert.equal(apres.libelle_brut, `${nom} - D6/D8${suite}`, 'la note du bandeau est gardée');
  assert.ok(titres().includes(titreDeSectionDeFamille(apres)) && !titres().includes(titreDeSectionDeFamille(avant)), 'la section porte le nouveau bandeau');
  const l = corps().split('\n');
  const i = l.indexOf(titreDeSectionDeFamille(apres));
  assert.equal(l.find((x, k) => k > i && x.startsWith('|')), `| Nom | ${cout} | Catégorie | Effet | Description |`);
  if (ligne("SELECT 1 FROM arme WHERE famille_id = 'bombes' AND depart_possible = 1")) {
    assert.ok(l.some((x) => x.startsWith(`- Sous « ${titreDeSectionDeFamille(apres).slice(3)} » : `)), 'la liste des armes de départ cite le nouveau bandeau');
  }
  const note = lignes("SELECT avant, apres FROM modification WHERE table_nom = 'arme_famille' AND json_extract(cle, '$.id') = 'bombes' ORDER BY lot_id DESC, rang DESC")[0];
  assert.equal(JSON.parse(note.apres).nom, nom, 'noté au journal');
  assert.ok(!('nom_lecture' in JSON.parse(note.apres)), 'le nom de lecture ne change jamais');
  assert.deepEqual(tablesDesSources(), sources, 'un renommage ne change aucune source de maîtrise d’arme');
  // le dé seul : le reste ne bouge pas
  assert.equal(enregistrer([{ op: 'modifier', table: 'arme_famille', cle: { id: 'bombes' }, valeurs: { de_brut: 'D10' } }]).statut, 200);
  assert.equal(famille('bombes').libelle_brut, `${nom} - D10${suite}`);
});

test('R159 : le dé d’une famille dont la note donne des dés selon la Force (PUGILAT) ne se change pas (400, limite technique) ; son nom et son en-tête de coût, si', () => {
  const avant = famille('pugilat');
  assert.ok(desSelonLaForce(avant.note_brut), 'PUGILAT : des paliers selon la Force dans sa note');
  for (const de_brut of ['D10', 'D6/D8']) {
    const r = enregistrer([{ op: 'modifier', table: 'arme_famille', cle: { id: 'pugilat' }, valeurs: { de_brut } }]);
    assert.equal(r.statut, 400, JSON.stringify(r.corps));
    assert.match(r.corps.erreur, /le dé de cette famille dépend de la Force \(D6 1-2 Force, D8 3-4 Force, D10 5 Force\) : il ne se change pas sur le site/);
  }
  assert.equal(famille('pugilat').de_brut, avant.de_brut);
  // le même dé (écrit autrement) n'est pas un changement ; le nom et l'en-tête de coût se changent
  const cout = COUTS_DE_FAMILLE.map((c) => c.valeur).find((c) => c !== avant.cout_libelle);
  const r = enregistrer([{ op: 'modifier', table: 'arme_famille', cle: { id: 'pugilat' }, valeurs: { nom: `POINGS ${PID}`, de_brut: avant.de_brut.toLowerCase(), cout_libelle: cout } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = famille('pugilat');
  assert.deepEqual([apres.nom, apres.de_brut, apres.cout_libelle, apres.note_brut], [`POINGS ${PID}`, avant.de_brut, cout, avant.note_brut]);
  assert.equal(apres.libelle_brut, `POINGS ${PID}${avant.libelle_brut.slice(avant.nom.length)}`, 'le bandeau garde le dé et ses paliers');
});

test('R159, R138, R151 : une famille renommée se lit toujours sous son nom d’import — « 1 maîtrise Épée », « (sauf épée) » désignent la même famille', () => {
  const nom = `LAMES ${PID}`;
  const avant = famille('epees');
  const r = enregistrer([{ op: 'modifier', table: 'arme_famille', cle: { id: 'epees' }, valeurs: { nom } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(famille('epees').nom_lecture, avant.nom_lecture);
  const familles = famillesDuLecteur(db);
  assert.deepEqual(famillesDuNom('Épée', familles), ['epees'], 'par le nom de lecture');
  assert.deepEqual(famillesDuNom(nom, familles), ['epees'], 'et par le nouveau nom');
  assert.deepEqual(famillesDuNom('Épée', familles.map(({ nom_lecture: _n, ...f }) => f)), [], 'sans le nom de lecture, le renommage casserait la lecture');
  const guerrier = lignes("SELECT * FROM classe_maitrise_arme WHERE classe_id = 'classes/guerrier' ORDER BY rang");
  const nommee = guerrier.find((x) => x.forme === 'nommee' && x.arme_cle === 'epee');
  if (nommee) assert.deepEqual(lireLigneDeClasse(nommee, familles).parts.map((p) => p.famille), ['epees']);
  const sauf = guerrier.find((x) => x.forme === 'au_choix' && x.sauf_cle === 'epee');
  if (sauf) assert.ok(!famillesAuChoix(sauf, familles).includes('epees'), '(sauf épée) exclut toujours ÉPÉES');
  sourcesJustes(db, 'les sources sont celles du lecteur');
});

test('R159 : refus — ARME DE MONSTRES (R45), nom vide, à virgule ou « : », dé hors de sa forme, en-tête hors des trois, catégorie et nom de lecture non saisis, nom déjà pris', () => {
  const modifier = (id, valeurs) => enregistrer([{ op: 'modifier', table: 'arme_famille', cle: { id }, valeurs }]);
  for (const valeurs of [{ nom: 'X' }, { de_brut: 'D8' }, { cout_libelle: 'Coût' }]) assert.equal(modifier('arme-de-monstres', valeurs).statut, 400, JSON.stringify(valeurs));
  assert.equal(famille('arme-de-monstres').categorie, null, 'jamais de catégorie (R45)');
  for (const nom of ['', '   ', 'A, B', 'A : B', '!!!']) assert.equal(modifier('dagues', { nom }).statut, 400, `« ${nom} »`);
  for (const de_brut of ['', '6', 'D', 'D0', 'D6-D8', 'D6/', '2D6', 'D6 ou D8']) assert.equal(modifier('dagues', { de_brut }).statut, 400, `« ${de_brut} »`);
  assert.equal(modifier('dagues', { cout_libelle: 'Prix' }).statut, 400);
  for (const valeurs of [{ categorie: 'distance' }, { nom_lecture: 'X' }, { maitrisable: 0 }, { libelle_brut: 'X - D6' }]) assert.equal(modifier('dagues', valeurs).statut, 400, JSON.stringify(valeurs));
  // un nom déjà pris (409) : le nom d'une autre famille, au singulier près ; son nom de lecture (ÉPÉES, renommée plus haut) ; un nom de R138
  const pris = (nom) => {
    const r = modifier('dagues', { nom });
    assert.equal(r.statut, 409, `« ${nom} » : ${JSON.stringify(r.corps)}`);
    return r.corps.erreur;
  };
  assert.match(pris('Hache'), /HACHE/);
  assert.match(pris('Arcs'), /ARC/, 'au singulier près');
  assert.match(pris('Marteau'), /MASSE\/MARTEAU/, 'un des noms d’un bandeau à « / »');
  assert.match(pris('Épée'), /nom de lecture/, 'le nom de lecture d’une famille renommée');
  // les noms que R138 rattache à une famille la désignent toujours : refusés pour une autre (« Masse » est aussi un nom de MASSE/MARTEAU)
  for (const nom of ['Hast', 'Bâton', 'Arme jet']) assert.match(pris(nom), /R138/, nom);
  assert.match(pris('Masse'), /MASSE\/MARTEAU/);
  assert.equal(creerFamille({ nom: 'Bâton' }).statut, 409, 'à la création aussi');
  assert.equal(famille('dagues').nom, ligne("SELECT nom FROM arme_famille WHERE id = 'dagues'").nom);
  assert.ok(!lignes("SELECT nom FROM arme_famille WHERE id = 'dagues'")[0].nom.includes(','));
});

test('R159 : un renommage ou une création qui changerait la lecture d’une maîtrise existante est refusé (409, avec la liste)', () => {
  // une ligne nommée lue par le bandeau sans « de » (« Bâton combat » : BÂTON DE COMBAT) ; « BÂTON D COMBAT » la rendrait ambiguë
  const avant = ligne("SELECT maitrise_arme FROM classe WHERE id = 'classes/guerrier'").maitrise_arme;
  const r = enregistrer([{ op: 'modifier', table: 'classe', cle: { id: 'classes/guerrier' }, valeurs: { maitrise_arme: `${avant}\n- 1 maîtrise Bâton combat` } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const sources = tablesDesSources();
  for (const op of [
    { op: 'modifier', table: 'arme_famille', cle: { id: 'hache' }, valeurs: { nom: 'BÂTON D COMBAT' } },
    { op: 'creer', entite: 'arme_famille', valeurs: { nom: 'BÂTON D COMBAT', de_brut: 'D8', categorie: 'contact', cout_libelle: 'Coût' } },
  ]) {
    const refus = enregistrer([op]);
    assert.equal(refus.statut, 409, JSON.stringify(refus.corps));
    assert.match(refus.corps.erreur, /changerait la lecture de maîtrises d’armes existantes/);
    assert.ok(refus.corps.sources.includes('« 1 maîtrise Bâton combat » (Guerrier)'), JSON.stringify(refus.corps.sources));
  }
  assert.equal(famille('hache').nom, ligne("SELECT nom FROM arme_famille WHERE id = 'hache'").nom);
  assert.deepEqual(tablesDesSources(), sources, 'rien n’est écrit');
  assert.equal(enregistrer([{ op: 'modifier', table: 'classe', cle: { id: 'classes/guerrier' }, valeurs: { maitrise_arme: avant } }]).statut, 200);
});

test('R159 : une famille créée — identifiant tiré du nom, dernier rang, maîtrisable, sa catégorie et son nom de lecture ; sa section ; une arme créée dans le même lot (« @0 »)', () => {
  const nom = `Sarbacanes ${PID}`;
  const ordre = ligne('SELECT max(ordre) AS m FROM arme_famille').m;
  const r = enregistrer([
    { op: 'creer', entite: 'arme_famille', valeurs: { nom, de_brut: 'd4', categorie: 'distance', cout_libelle: 'Coût en plus/moins (unité)' } },
    { op: 'creer', entite: 'arme', valeurs: { famille_id: '@0', nom: 'Sarbacane', competence_brut: 'Arme Légère', type_id: 'dague', effet: 'Dégâts estoc', depart_possible: '1' } },
  ]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const id = r.corps.crees[0].id;
  assert.equal(id, `sarbacanes-${PID}`);
  const f = famille(id);
  assert.deepEqual({ ...f, source_ref: f.source_ref.startsWith('Site de dev › édition du ') }, {
    id, libelle_brut: `${nom} - D4`, nom, de_brut: 'D4', note_brut: null, cout_libelle: 'Coût en plus/moins (unité)', ordre: ordre + 1, origine: 'equipement',
    source_ref: true, remarque: null, maitrisable: 1, categorie: 'distance', nom_lecture: nom,
  });
  assert.ok(ligne("SELECT 1 FROM page_entite WHERE entite_table = 'arme_famille' AND entite_id = ? AND page_id = ?", id, PAGE_DES_ARMES));
  assert.equal(titres().at(-1), `## ${nom} - D4`, 'sa section à la fin du corps');
  const arme = ligne('SELECT * FROM arme WHERE id = ?', r.corps.crees[1].id);
  assert.equal(arme.famille_id, id, '« @0 » : la famille créée plus haut dans le lot');
  assert.ok(corps().endsWith(`| --- | --- | --- | --- | --- |\n${ligneDArme(arme)}\n`), 'l’arme dans le tableau de la famille créée');
  assert.ok(corps().split('\n').some((x) => x.startsWith(`- Sous « ${nom} - D4 » : Sarbacane`)), 'dans la liste des armes de départ');
  // elle est proposée au formulaire « Nouvelle arme », avec sa catégorie ; la surcouche de la page la donne comme créée
  const listes = appel('GET', '/api/edition/listes/');
  assert.equal(listes.statut, 200, JSON.stringify(listes.corps));
  assert.deepEqual({ ...listes.corps.famillesDArmes.find((x) => x.valeur === id) }, { valeur: id, libelle: nom, categorie: 'distance' });
  const attente = appel('GET', '/api/edition/en-attente/');
  assert.equal(attente.statut, 200);
  const vue = attente.corps.lignes.find((x) => x.table === 'arme_famille' && x.cle.id === id);
  assert.equal(vue.creee, true);
  assert.equal(vue.ligne.nom, nom);
  // un « @i » qui ne désigne pas une famille créée : refusé
  assert.equal(enregistrer([{ op: 'creer', entite: 'arme', valeurs: { famille_id: '@3', nom: 'X', competence_brut: 'Arme Légère', type_id: 'dague', depart_possible: '0' } }]).statut, 400);
  // renommée ensuite : son nom de lecture reste celui de sa création, la section et l'arme suivent (le rejeu plus bas le refait)
  assert.equal(enregistrer([{ op: 'modifier', table: 'arme_famille', cle: { id }, valeurs: { nom: `Tubes ${PID}`, de_brut: 'D6' } }]).statut, 200);
  assert.deepEqual([famille(id).nom, famille(id).nom_lecture], [`Tubes ${PID}`, nom]);
  assert.equal(titres().at(-1), `## Tubes ${PID} - D6`);
  sourcesJustes(db, 'les sources sont celles du lecteur');
});

test('R159 : une famille créée entre d’office dans les maîtrises de sa catégorie (R119, R127 ; R150, R151), jamais dans un « sauf » ni une ligne nommée ; les sources sont refaites et notées au journal', () => {
  const nom = `Fouets ${PID}`;
  const imposees = lignes("SELECT * FROM maitrise_arme_part WHERE genre <> 'choix' ORDER BY source_id, rang");
  const r = creerFamille({ nom, categorie: 'contact', de_brut: 'D8' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const id = r.corps.crees[0].id;
  const options = (source) => lignes('SELECT arme_famille_id AS f FROM maitrise_arme_part_famille WHERE source_id = ?', source).map((o) => o.f);
  const familles = famillesDuLecteur(db);
  for (const l of lignes("SELECT * FROM classe_maitrise_arme WHERE forme = 'au_choix'")) {
    const source = `${l.classe_id}#maitrise-arme:${l.rang}`;
    assert.equal(options(source).includes(id), famillesAuChoix(l, familles).includes(id), source);
    assert.equal(options(source).includes(id), !l.categorie || l.categorie === 'contact', `${source} : selon sa catégorie (${l.categorie})`);
  }
  // le « sauf épée » du Guerrier exclut toujours ÉPÉES ; la famille créée de contact y entre (R159, 1)
  const guerrier = lignes("SELECT * FROM classe_maitrise_arme WHERE classe_id = 'classes/guerrier' AND forme = 'au_choix'")[0];
  if (guerrier) assert.ok(options(`classes/guerrier#maitrise-arme:${guerrier.rang}`).includes(id) && !options(`classes/guerrier#maitrise-arme:${guerrier.rang}`).includes('epees'));
  // à distance au choix (Mage Vert, Barde : R119) : pas une famille de contact
  for (const classe of ['classes/mage-vert', 'classes/barde']) {
    for (const l of lignes("SELECT * FROM classe_maitrise_arme WHERE classe_id = ? AND categorie = 'distance'", classe)) assert.ok(!options(`${classe}#maitrise-arme:${l.rang}`).includes(id), classe);
  }
  assert.deepEqual(lignes("SELECT * FROM maitrise_arme_part WHERE genre <> 'choix' ORDER BY source_id, rang"), imposees, 'les parts imposées et suivies ne changent pas');
  const notees = lignes("SELECT m.cle FROM modification m WHERE m.lot_id = ? AND m.table_nom = 'maitrise_arme_part_famille'", r.corps.lot).map((m) => JSON.parse(m.cle));
  assert.ok(notees.length > 0 && notees.every((c) => c.arme_famille_id === id), 'les options ajoutées sont notées au journal');
  assert.equal(notees.length, ligne('SELECT count(*) AS n FROM maitrise_arme_part_famille WHERE arme_famille_id = ?', id).n);
  sourcesJustes(db, 'les sources sont celles du lecteur');
});

test('R159 : refus d’une création — catégorie absente ou inconnue, dé, en-tête, nom à virgule ou déjà pris (nom, nom de lecture) ; identifiant déjà employé : suffixe', () => {
  for (const valeurs of [{ nom: `Lassos ${PID}`, categorie: '' }, { nom: `Lassos ${PID}`, categorie: 'jet' }, { nom: `Lassos ${PID}`, de_brut: '1d6' },
    { nom: `Lassos ${PID}`, cout_libelle: 'Prix' }, { nom: `Lassos, ${PID}` }, { nom: `Lassos : ${PID}` }]) {
    assert.equal(creerFamille(valeurs).statut, 400, JSON.stringify(valeurs));
  }
  assert.equal(creerFamille({ nom: 'Dague' }).statut, 409, 'le nom d’une famille');
  assert.equal(creerFamille({ nom: `Sarbacane ${PID}` }).statut, 409, 'le nom de lecture d’une famille renommée (au singulier près)');
  assert.equal(ligne('SELECT count(*) AS n FROM arme_famille WHERE nom LIKE ?', `Lassos%${PID}`).n, 0);
  // un identifiant que l'historique du site a déjà employé (une famille d'un autre lot) n'est jamais repris
  db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres)
    VALUES ('essai-famille-${PID}', 1, '2026-10-23T00:00:00Z', 'essai', NULL, 'arme_famille', ?, 'inserer', NULL, '{}')`).run(JSON.stringify({ id: `lassos-${PID}` }));
  const r = creerFamille({ nom: `Lassos ${PID}` });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(r.corps.crees[0].id, `lassos-${PID}-2`);
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
  // les familles créées et renommées (décision R159), avec les sources de maîtrise d'arme qu'elles refont
  for (const t of ['arme_famille', 'arme', 'arme_degats', 'arme_prerequis', 'materiau_arme', 'amelioration_equipement', 'amelioration_total', 'ressource', 'page_entite',
    'maitrise_arme_part', 'maitrise_arme_part_famille', 'capacite_nm_gagne', 'classe_maitrise_arme']) {
    assert.deepEqual(neuve.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), t);
  }
  neuve.close();
});
