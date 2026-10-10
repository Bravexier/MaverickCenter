// Édition des classes depuis le site de dev (client/serveur/edition.mjs) : don de départ, présentation, maîtrises et inventaire (tables de détail
// recalculées : lib/classe-champs.mjs), spécialités et dons (leur fiche suit) ; création d'une classe dans une catégorie, et d'une classe raciale pour
// une race hybride qui n'en a pas (demande du propriétaire).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { racesHybridesSansClasse } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerRaces } from '../src/lib/races-db.mjs';
import { groupClasses } from '../src/lib/class-groups.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-classes-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin_, corps) => traiter({ methode, chemin: chemin_, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
const enregistrer = (operations) => appel('POST', '/api/edition/', { page: 'classes/x', operations });
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p);

test('classe : don de départ, maîtrises (tables de détail et bouclier_classe_max), inventaire (objets du glossaire)', () => {
  const r = enregistrer([{ op: 'modifier', table: 'classe', cle: { id: 'classes/guerrier' }, valeurs: {
    sante_depart: 12, maitrise_arme: '- 1 maîtrise Hache\n- 1 maîtrise arme au choix', maitrise_armure: '- Légère à Lourde\n- Bouclier classe 1 à 4',
    inventaire_depart: 'P fiole rouge, Bandage (x2) OU torche, Objet inconnu',
  } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(lignes("SELECT forme, arme, categorie FROM classe_maitrise_arme WHERE classe_id = 'classes/guerrier' ORDER BY rang").map((l) => ({ ...l })),
    [{ forme: 'nommee', arme: 'Hache', categorie: null }, { forme: 'au_choix', arme: null, categorie: null }]);
  assert.equal(ligne("SELECT bouclier_classe_max FROM classe WHERE id = 'classes/guerrier'").bouclier_classe_max, 4);
  const inventaire = lignes("SELECT rang, option, texte, objet_depart_id FROM classe_objet_depart WHERE classe_id = 'classes/guerrier' ORDER BY rang, option");
  assert.deepEqual(inventaire.map((l) => [l.rang, l.option, l.objet_depart_id?.split(':').pop() ?? null]), [[1, 1, 'p-fiole-rouge'], [2, 1, 'bandage'], [2, 2, 'torche'], [3, 1, null]]);
  assert.equal(enregistrer([{ op: 'modifier', table: 'classe', cle: { id: 'classes/guerrier' }, valeurs: { sante_depart: -1 } }]).statut, 400);
});

test('spécialité renommée : clé du nom, fiches de ses dons (spécialité citée, mot-clé)', () => {
  const s = ligne("SELECT id, nom FROM specialite WHERE classe_id = 'classes/anansi' AND nom = 'CEMIES'");
  const r = enregistrer([{ op: 'modifier', table: 'specialite', cle: { id: s.id }, valeurs: { nom: 'CÉMIES' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne('SELECT nom_cle FROM specialite WHERE id = ?', s.id).nom_cle, 'cemies');
  assert.equal(JSON.parse(ligne("SELECT donnees FROM page WHERE id = 'capacites/anansi-anti-corps'").donnees).specialite, 'CÉMIES');
});

test('don modifié : type et limite recalculés ; sa fiche suit (titre « Nom (Classe) », résumé, corps, type)', () => {
  const r = enregistrer([{ op: 'modifier', table: 'capacite', cle: { id: 'capacites/anansi-anti-corps' }, valeurs: {
    nom: 'Anticorps puissants', type_brut: 'Actif (2 fois/combat)', effet: 'Immunisé aux poisons.\nEt aux fioles.',
  } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual({ ...ligne("SELECT nom_cle, type, limite_nombre, limite_periode FROM capacite WHERE id = 'capacites/anansi-anti-corps'") },
    { nom_cle: 'anticorps-puissants', type: 'actif', limite_nombre: 2, limite_periode: 'combat' });
  const page = ligne("SELECT titre, resume, corps_md, donnees FROM page WHERE id = 'capacites/anansi-anti-corps'");
  assert.equal(page.titre, 'Anticorps puissants (Anansi)');
  assert.equal(page.resume, 'Immunisé aux poisons.');
  assert.equal(page.corps_md, 'Immunisé aux poisons.\nEt aux fioles.\n');
  assert.equal(JSON.parse(page.donnees).type_capacite, 'Actif (2 fois/combat)');
});

test('créer une classe dans une catégorie : page (mot-clé de la catégorie : rangée dans sa colonne), colonne de la matrice de la fiche', () => {
  const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-magique', nom: 'Sorcier des marais', sante_depart: '6' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const c = ligne("SELECT * FROM classe WHERE id = 'classes/sorcier-des-marais'");
  assert.deepEqual([c.categorie_id, c.sante_depart, c.ordre], ['classe-magique', 6, 40]);
  const tags = lignes("SELECT libelle FROM page_tag WHERE page_id = 'classes/sorcier-des-marais' ORDER BY ordre").map((t) => t.libelle);
  assert.deepEqual(tags, ['classe', 'magique']);
  const groupe = groupClasses([{ id: 'classes/sorcier-des-marais', data: { title: 'Sorcier des marais', tags } }])[0];
  assert.equal(groupe.key, 'magiques');
  assert.equal(ligne("SELECT count(*) AS n FROM race_classe WHERE classe_id = 'classes/sorcier-des-marais' AND accessible = 0").n, ligne('SELECT count(*) AS n FROM race').n);
  for (const [valeurs, motif] of [
    [{ categorie_id: 'inconnue', nom: 'X' }, /catégorie inconnue/],
    [{ categorie_id: 'classe-magique' }, /Nom/],
    [{ categorie_id: 'classe-magique', nom: 'Y', race_id: 'races/humain' }, /Seule une classe raciale/],
  ]) {
    const refus = enregistrer([{ op: 'creer', entite: 'classe', valeurs }]);
    assert.equal(refus.statut, 400, JSON.stringify(valeurs));
    assert.match(refus.corps.erreur, motif);
  }
});

test('classe raciale : seulement pour une race hybride sans classe raciale ; elle prend le nom de la race et lui est seule accessible', () => {
  assert.deepEqual(racesHybridesSansClasse(db).map((r) => r.id), ['races/drassahthac'], 'aujourd’hui : le Drassah’thac (R14)');
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: 'Lycan', nature: 'hybride' } }]).statut, 200);
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: 'Gnome', nature: 'pure' } }]).statut, 200);
  const listes = appel('GET', '/api/edition/listes/').corps;
  assert.deepEqual(listes.racesSansClasse.map((r) => r.valeur), ['races/drassahthac', 'races/lycan']);
  assert.ok(listes.categories.some((c) => c.valeur === 'classe-hybride-animal'));
  for (const race of ['races/gnome', 'races/orios', 'races/humain']) {
    const refus = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-hybride-animal', race_id: race } }]);
    assert.equal(refus.statut, 400, race);
    assert.match(refus.corps.erreur, /race hybride qui n’a pas encore de classe raciale/);
  }
  const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-hybride-animal', race_id: 'races/lycan', nom: 'ignoré' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(r.corps.crees, [{ entite: 'classe', id: 'classes/lycan' }]);
  assert.equal(ligne("SELECT nom FROM classe WHERE id = 'classes/lycan'").nom, 'Lycan');
  assert.deepEqual(lignes("SELECT race_id FROM race_classe WHERE classe_id = 'classes/lycan' AND accessible = 1").map((l) => l.race_id), ['races/lycan']);
  assert.deepEqual(chargerRaces(db).races.get('races/lycan').classeRaciale, { id: 'classes/lycan', nom: 'Lycan' }, 'la page de la race la cite');
  assert.deepEqual(racesHybridesSansClasse(db).map((r) => r.id), ['races/drassahthac']);
});
