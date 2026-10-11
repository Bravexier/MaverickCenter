// Décision R42, point 3 (« Si par contre le don / sort / métier est juste modifié, il reste dans les fiches concernées (juste automatiquement mis à
// jour) ») sur le site de dev : une fiche ne garde que des identifiants, qui ne changent jamais (migration 0006). Renommer le métier, la spécialité, le
// don et le sort qu'un prétiré utilise ne touche pas la fiche (ni ligne, ni note, ni version : une fiche ouverte ailleurs s'enregistre sans 409) ; le
// nouveau nom se lit dans les règles, sous le même identifiant. Base vivante neuve ; données d'essai sous des noms absents de la base.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { donsValables, lignesDeSorts } from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-fiches-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {} };
const appel = (methode, chemin_, corps) => traiter({ methode, chemin: chemin_, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
const enregistrer = (operations, page = 'essai') => {
  const r = appel('POST', '/api/edition/', { page, operations });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
/** Un nom que la table n'a pas encore (ni l'id de page `<type>/<slug>`). */
const nomLibre = (nom, table, type = null) => {
  let n = nom;
  for (let i = 2; ligne(`SELECT 1 FROM "${table}" WHERE nom = ?`, n) || (type && ligne('SELECT 1 FROM page WHERE id = ?', `${type}/${normalize(n)}`)); i += 1) n = `${nom} ${i}`;
  return n;
};

test('R42 — renommer le métier, la spécialité, le don et le sort d’un prétiré : la fiche garde ses identifiants, sa version, ses notes ; le nouveau nom se lit dans les règles', () => {
  // données d'essai : un métier, une classe avec sa spécialité et une paire de dons au choix (créés ici) ; une magie et l'un de ses sorts de NPM 1 (lus)
  const metier = enregistrer([{ op: 'creer', entite: 'metier', valeurs: { nom: nomLibre('Métier à renommer', 'metier', 'metiers') } }]).crees[0].id;
  const classe = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-physique-corps-a-corps', nom: nomLibre('Classe à renommer', 'classe', 'classes') } }]).crees[0].id;
  const spec = enregistrer([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: classe, nom: 'VOIE À RENOMMER', don_nom: 'Voie à renommer', don_type: 'Passif' } }]).crees[0].id;
  const [don, autre] = enregistrer([
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, specialite_id: spec, niveau: '15', nom: 'Don à renommer', type: 'Passif' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, specialite_id: spec, avec: '@0', nom: 'Don voisin', type: 'Passif' } },
  ]).crees.map((c) => c.id);
  const sort = ligne(`SELECT id, magie_id FROM sort WHERE niveau = 1 AND magie_id <> 'magies/potentiel-illimite'
    ORDER BY magie_id = 'magies/magie-du-feu' DESC, id LIMIT 1`);

  const cree = appel('POST', '/api/personnages/', {
    ...ficheVide('Témoin des renommages'), notes: 'Notes du joueur.', metier_id: metier, magie_innee_id: sort.magie_id,
    classes: [{ rang: 1, classe_id: classe, specialite_id: spec }], capacites: [{ capacite_id: don }],
    sorts: [{ sort_id: sort.id, rang: 1, niveau_maitrise: 0, nm_livre: 0, nm_cadeau: 0 }],
  });
  assert.equal(cree.statut, 201, JSON.stringify(cree.corps));
  const id = cree.corps.personnage.id;
  const avant = appel('GET', `/api/personnages/${id}/`).corps;

  const noms = {
    metier: nomLibre('Métier renommé', 'metier', 'metiers'), specialite: 'VOIE RENOMMÉE', capacite: nomLibre('Don renommé', 'capacite'), sort: nomLibre('Sort renommé', 'sort'),
  };
  const lot = enregistrer([
    { op: 'modifier', table: 'metier', cle: { id: metier }, valeurs: { nom: noms.metier } },
    { op: 'modifier', table: 'specialite', cle: { id: spec }, valeurs: { nom: noms.specialite } },
    { op: 'modifier', table: 'capacite', cle: { id: don }, valeurs: { nom: noms.capacite } },
    { op: 'modifier', table: 'sort', cle: { id: sort.id }, valeurs: { nom: noms.sort } },
  ]);
  assert.deepEqual(lot.fiches, [], 'une modification ne retire rien');
  assert.equal(ligne('SELECT nom FROM sort WHERE id = ?', sort.id).nom, noms.sort);

  // la fiche : mêmes identifiants, même version, mêmes notes, mêmes contrôles
  const apres = appel('GET', `/api/personnages/${id}/`).corps;
  assert.deepEqual(apres, avant);
  assert.equal(apres.personnage.notes, 'Notes du joueur.');
  // une fiche ouverte avant le renommage s'enregistre sans conflit de version
  const put = appel('PUT', `/api/personnages/${id}/`, { ...avant.personnage, surnom: 'Toujours là' });
  assert.equal(put.statut, 200, JSON.stringify(put.corps));

  // la recherche des personnages lit les noms dans les règles
  const resume = appel('GET', '/api/personnages/').corps.personnages.find((p) => p.id === id);
  assert.equal(resume.metier, noms.metier);
  assert.equal(resume.classes[0].specialite, noms.specialite);

  // les règles de la page /fiche/ (relues dans la base vivante) : les nouveaux noms sous les mêmes identifiants
  const regles = chargerReglesDeFiche(db);
  assert.equal(regles.metiers.find((m) => m.id === metier).nom, noms.metier);
  assert.equal(regles.sorts.find((s) => s.id === sort.id).nom, noms.sort);
  const c = regles.classes.find((x) => x.id === classe);
  assert.equal(c.specialites.find((s) => s.id === spec).nom, noms.specialite);
  assert.deepEqual(c.choix.flatMap((g) => g.options).filter((o) => [don, autre].includes(o.id)).map((o) => [o.id, o.nom]), [[don, noms.capacite], [autre, 'Don voisin']]);

  // le moteur de la fiche : le don reste valable, le sort se lit sous son nouveau nom, toujours dans les règles
  const fiche = put.corps.personnage;
  assert.deepEqual(donsValables(regles, fiche), [{ capacite_id: don }]);
  const [premiere] = lignesDeSorts(regles, fiche);
  assert.equal(premiere.sort.nom, noms.sort);
  assert.equal(premiere.horsDesRegles, false);
});
