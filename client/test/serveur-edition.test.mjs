// Édition des règles depuis le site de dev (client/serveur/edition.mjs, routes /api/edition/ de api.mjs ; docs/serveur.md, « Édition ») : fermée ailleurs,
// un lot passe d'un bloc ou pas du tout, tout ce qui dépend d'un champ est recalculé (lignes de détail, page du wiki), chaque ligne touchée est notée au
// journal. Ici les métiers ; les autres domaines ont leur fichier serveur-edition-<domaine>.test.mjs.
// La base vivante part des règles de data/rows, où le site de dev a pu créer, modifier ou supprimer des métiers : les essais portent sur des métiers
// créés par le test (noms absents de la base) ou lus dans la base, jamais sur une valeur écrite en dur.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { messageSqlite } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { decouperBonus } from '../src/lib/metier-champs.mjs';
import { normalize } from '../src/lib/text.mjs';
import { attributEd, lireAttributEd, valeurDuChamp } from '../src/lib/edition-modele.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const journal = [];
const service = { base: () => db, etat: () => ({ service: 'essai' }), journal: (l) => journal.push(l), edition: true };
const JSON_ = { 'content-type': 'application/json' };
const appel = (methode, chemin_, corps, s = service) =>
  traiter({ methode, chemin: chemin_, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);
const enregistrer = (operations, page = 'metiers/') => appel('POST', '/api/edition/', { page, operations });
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p);
const competences = lignes('SELECT nom FROM competence').map((c) => c.nom);
/** Un nom de métier que la base n'a pas encore : `nom`, ou `nom 2`, `nom 3`… */
const nomLibre = (nom) => {
  const pris = (n) => ligne('SELECT 1 FROM metier WHERE nom = ? OR id = ? UNION ALL SELECT 1 FROM page WHERE id = ?', n, `metiers/${normalize(n)}`, `metiers/${normalize(n)}`);
  let n = nom;
  for (let i = 2; pris(n); i += 1) n = `${nom} ${i}`;
  return n;
};
/** Crée un métier d'essai (nom libre) et rend son id. */
const creerMetier = (valeurs) => {
  const r = enregistrer([{ op: 'creer', entite: 'metier', valeurs: { ...valeurs, nom: nomLibre(valeurs.nom) } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps.crees[0].id;
};
// deux métiers de la base : l'Acrobate et le Forgeron tant qu'ils existent, sinon les premiers dans l'ordre des identifiants
const [METIER_A, METIER_B] = lignes("SELECT id, nom FROM metier ORDER BY id = 'metiers/acrobate' DESC, id = 'metiers/forgeron' DESC, id LIMIT 2");

test('fermée hors du site de dev : 403 sur toutes les routes, et /api/etat/ le dit', () => {
  const ferme = { ...service, edition: false };
  for (const [m, c] of [['GET', '/api/edition/en-attente/'], ['POST', '/api/edition/'], ['GET', '/api/edition/journal/']]) {
    assert.equal(appel(m, c, m === 'POST' ? { operations: [] } : undefined, ferme).statut, 403, c);
  }
  assert.equal(appel('GET', '/api/edition/inconnue/').statut, 404);
  assert.equal(appel('GET', '/api/edition/').statut, 405);
});

test('modèle : valeurs normalisées, champ obligatoire, attribut data-ed lu et relu', () => {
  assert.equal(valeurDuChamp({ type: 'ligne', libelle: 'Nom' }, '  Deux\r\nlignes  '), 'Deux lignes');
  assert.equal(valeurDuChamp({ type: 'texte', libelle: 'T' }, 'a\r\n\r\nb '), 'a\n\nb');
  assert.equal(valeurDuChamp({ type: 'ligne', libelle: 'A', vide: 'Rien' }, ''), 'Rien');
  assert.equal(valeurDuChamp({ type: 'texte', libelle: 'R' }, '   '), null);
  assert.throws(() => valeurDuChamp({ type: 'ligne', libelle: 'Nom', requis: true }, ''), /obligatoire/);
  assert.equal(valeurDuChamp({ type: 'entier', libelle: 'N' }, '+4'), 4);
  assert.throws(() => valeurDuChamp({ type: 'entier', libelle: 'N' }, '4,5'), /entier/);
  assert.throws(() => valeurDuChamp({ type: 'entier', libelle: 'N', min: 0 }, -1), /au moins 0/);
  const a = attributEd('metier', { id: 'metiers/forgeron' }, 'bonus_brut');
  assert.deepEqual(lireAttributEd(a), { table: 'metier', cle: { id: 'metiers/forgeron' }, colonne: 'bonus_brut', champ: lireAttributEd(a).champ });
  assert.equal(lireAttributEd(attributEd('metier', { id: 'x' }, 'source_ref')), null, 'colonne hors du modèle');
  assert.equal(messageSqlite(new Error('UNIQUE constraint failed: metier.nom')), 'valeur déjà utilisée ailleurs (metier.nom)');
});

test('modifier le bonus d’un métier : metier_bonus et la ligne « Bonus » de sa page suivent, le journal note chaque ligne', () => {
  const id = creerMetier({ nom: 'Essai du bonus', description: 'Un métier d’essai.', bonus_brut: '+3% Parade OU Esquive' });
  const r = enregistrer([{ op: 'modifier', table: 'metier', cle: { id }, valeurs: { bonus_brut: '+4% Arme lourde, +2% Vigueur' },
    avant: { bonus_brut: '+3% Parade OU Esquive' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.ok(r.corps.lot);
  const bonus = lignes('SELECT rang, option, texte, valeur, cible FROM metier_bonus WHERE metier_id = ? ORDER BY rang, option', id);
  assert.deepEqual(bonus.map((b) => [b.rang, b.option, b.texte, b.valeur, b.cible]), [[1, 1, '+4% Arme lourde', 4, 'Arme lourde'], [2, 1, '+2% Vigueur', 2, 'Vigueur']]);
  assert.match(ligne('SELECT corps_md FROM page WHERE id = ?', id).corps_md, /^\*\*Bonus :\*\* \+4% Arme lourde, \+2% Vigueur$/m);
  const tables = new Set(r.corps.lignes.map((l) => l.table));
  assert.deepEqual([...tables].sort(), ['metier', 'metier_bonus', 'page']);
  assert.equal(r.corps.lignes.find((l) => l.table === 'metier').ligne.bonus_brut, '+4% Arme lourde, +2% Vigueur');
  assert.ok(r.corps.lignes.some((l) => l.table === 'metier_bonus' && l.ligne === null), 'l’option « Esquive » supprimée');
  const enAttente = appel('GET', '/api/edition/en-attente/').corps.lignes;
  assert.ok(enAttente.some((l) => l.table === 'metier' && l.cle.id === id));
  assert.match(journal.at(-1), /^édition : lot .+ depuis metiers\//);
});

test('modifier l’artisanat : colonnes typées et familles de recettes recalculées ; le nom suit dans la page (titre, clé)', () => {
  const id = creerMetier({ nom: 'Essai de l’artisanat', description: 'Un métier d’essai.', bonus_brut: '+1 INI' });
  const nom = nomLibre('Chef des rois');
  const r = enregistrer([{ op: 'modifier', table: 'metier', cle: { id },
    valeurs: { nom, artisanat_brut: 'Peut fabriquer les fioles et les huiles [FORCE + AGILITÉ]' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const m = ligne('SELECT * FROM metier WHERE id = ?', id);
  assert.equal(m.nom_cle, normalize(nom));
  assert.deepEqual([m.peut_fabriquer, m.artisanat_texte, m.test_brut, m.test_carac_1_id, m.test_carac_2_id], [1, 'Peut fabriquer les fioles et les huiles', 'FORCE + AGILITÉ', 'force', 'agilite']);
  assert.deepEqual(lignes('SELECT famille FROM metier_recette_famille WHERE metier_id = ? ORDER BY famille', id).map((f) => f.famille), ['fiole', 'huile']);
  const p = ligne('SELECT titre, titre_cle, corps_md FROM page WHERE id = ?', id);
  assert.deepEqual([p.titre, p.titre_cle], [nom, normalize(nom)]);
  assert.match(p.corps_md, /^\*\*Artisanat possible :\*\* Peut fabriquer les fioles et les huiles \\\[FORCE \+ AGILITÉ\\\]$/m);
});

test('refus : lot entier annulé ; colonne hors du modèle, valeur obligatoire, nom déjà pris, modifié entre-temps', () => {
  const avant = ligne('SELECT count(*) AS n FROM modification').n;
  const cle = { id: METIER_A.id };
  const description = ligne('SELECT description FROM metier WHERE id = ?', cle.id).description;
  const cas = [
    [[{ op: 'modifier', table: 'metier', cle, valeurs: { source_ref: 'x' } }], 400, /source_ref/],
    [[{ op: 'modifier', table: 'metier', cle, valeurs: { nom: ' ' } }], 400, /obligatoire/],
    [[{ op: 'modifier', table: 'metier', cle, valeurs: { description: 'Nouvelle' } },
      { op: 'modifier', table: 'metier', cle, valeurs: { nom: METIER_B.nom } }], 422, /déjà utilisée/],
    [[{ op: 'modifier', table: 'metier', cle, valeurs: { description: 'X' }, avant: { description: 'pas ça' } }], 409, /entre-temps/],
    [[{ op: 'modifier', table: 'arme', cle: { id: 'x' }, valeurs: { nom: 'X' } }], 400, /pas modifiable/],
    [[{ op: 'modifier', table: 'race', cle: { id: 'races/humain' }, valeurs: { nom: 'X' } }], 400, /ne se modifie pas/],
    [[{ op: 'inconnue' }], 400, /opération inconnue/],
    [[], 400, /Aucune/],
  ];
  for (const [ops, statut, motif] of cas) {
    const r = enregistrer(ops);
    assert.equal(r.statut, statut, JSON.stringify(r.corps));
    assert.match(r.corps.erreur, motif);
  }
  assert.equal(ligne('SELECT description FROM metier WHERE id = ?', cle.id).description, description, 'rien d’écrit');
  assert.equal(ligne('SELECT count(*) AS n FROM modification').n, avant, 'rien au journal');
  const conflit = enregistrer([{ op: 'modifier', table: 'metier', cle, valeurs: { description: 'X' }, avant: { description: 'pas ça' } }]);
  assert.equal(conflit.corps.ligne.description, description, 'la ligne à jour est rendue');
});

test('créer un métier : page (titre, résumé, corps, mot-clé), ligne metier, bonus découpés, entité rattachée ; puis le supprimer', () => {
  const nom = nomLibre('Souffleur de verre');
  const slug = normalize(nom);
  const id = `metiers/${slug}`;
  const r = enregistrer([{ op: 'creer', entite: 'metier', valeurs: { nom, description: 'Il souffle le verre. Avec patience.', bonus_brut: '+3% Calme, +2% Fermeté', artisanat_brut: '', equipement_brut: 'Canne' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(r.corps.crees, [{ entite: 'metier', id }]);
  const m = ligne('SELECT * FROM metier WHERE id = ?', id);
  assert.equal(m.artisanat_brut, 'Rien');
  assert.equal(m.peut_fabriquer, 0);
  assert.equal(m.source_ref.replace(/\d{4}-\d\d-\d\d/, 'AAAA-MM-JJ'), `Site de dev › édition du AAAA-MM-JJ › ${nom} › champs de la page`);
  const p = ligne('SELECT * FROM page WHERE id = ?', id);
  assert.deepEqual([p.type, p.slug, p.titre, p.resume, p.statut, p.origine], ['metiers', slug, nom, 'Il souffle le verre.', 'draft', 'docs']);
  assert.match(p.corps_md, /^\*\*Description du métier :\*\* Il souffle le verre\. Avec patience\.\n\n\*\*Bonus :\*\* \+3% Calme, \+2% Fermeté\n/);
  assert.deepEqual(lignes('SELECT texte FROM metier_bonus WHERE metier_id = ? ORDER BY rang', id).map((b) => b.texte), decouperBonus('+3% Calme, +2% Fermeté', competences).map((b) => b.texte));
  assert.equal(ligne('SELECT libelle FROM page_tag WHERE page_id = ?', id).libelle, 'métier');
  assert.equal(ligne("SELECT principale FROM page_entite WHERE entite_table = 'metier' AND entite_id = ?", id).principale, 1);
  assert.ok(appel('GET', '/api/edition/en-attente/').corps.lignes.some((l) => l.table === 'metier' && l.creee && l.cle.id === id));

  assert.equal(enregistrer([{ op: 'creer', entite: 'metier', valeurs: { nom } }]).statut, 409, 'même nom : même page');
  assert.equal(enregistrer([{ op: 'creer', entite: 'metier', valeurs: { nom: 'X', remarque: 'pas demandée' } }]).statut, 400);

  const s = enregistrer([{ op: 'supprimer', entite: 'metier', cle: { id } }]);
  assert.equal(s.statut, 200, JSON.stringify(s.corps));
  for (const t of ['metier', 'page']) assert.equal(ligne(`SELECT count(*) AS n FROM ${t} WHERE id = ?`, id).n, 0, t);
  for (const t of ['metier_bonus', 'metier_recette_famille']) assert.equal(ligne(`SELECT count(*) AS n FROM ${t} WHERE metier_id = ?`, id).n, 0, t);
  assert.equal(ligne('SELECT count(*) AS n FROM page_tag WHERE page_id = ?', id).n, 0);
});

test('supprimer un métier cité par une fiche : refusé, rien ne change', () => {
  db.prepare(`INSERT INTO personnage (id, nature, visibilite, statut, nom, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon, alignement_mauvais,
    bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le, metier_id) VALUES ('p-ed', 'pretire', 'tous', 'brouillon', 'Essai', 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0,
    '2026-10-10T12:00:00Z', '2026-10-10T12:00:00Z', ?)`).run(METIER_B.id);
  const r = enregistrer([{ op: 'supprimer', entite: 'metier', cle: { id: METIER_B.id } }]);
  assert.equal(r.statut, 409);
  assert.match(r.corps.erreur, /1 fiche/);
  assert.equal(ligne('SELECT count(*) AS n FROM metier WHERE id = ?', METIER_B.id).n, 1);
});

test('lignes lues pour le mode modification, listes, journal à rapatrier', () => {
  const r = appel('POST', '/api/edition/lignes/', { lignes: [{ table: 'metier', cle: { id: METIER_B.id } }, { table: 'metier', cle: { id: 'metiers/absent' } }] });
  assert.equal(r.statut, 200);
  assert.equal(r.corps.lignes[0].ligne.nom, METIER_B.nom);
  assert.equal(r.corps.lignes[1].ligne, null);
  assert.equal(appel('POST', '/api/edition/lignes/', { lignes: [{ table: 'personnage', cle: { id: 'p-ed' } }] }).statut, 400, 'hors du modèle');
  assert.ok(appel('GET', '/api/edition/listes/').corps.competences.includes('Esquive'));
  const j = appel('GET', '/api/edition/journal/');
  assert.equal(j.statut, 200);
  assert.match(j.entetes['Content-Disposition'], /^attachment; filename="journal-edition-\d{4}-\d\d-\d\d\.json"$/);
  assert.equal(j.corps.format, 'maverick-edition/1');
  assert.ok(j.corps.lots.length >= 3);
});
