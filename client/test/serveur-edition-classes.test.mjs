// Édition des classes depuis le site de dev (client/serveur/edition.mjs) : don de départ, présentation, maîtrises et inventaire (tables de détail
// recalculées : lib/classe-champs.mjs), spécialités et dons (leur fiche suit) ; création d'une classe dans une catégorie, et d'une classe raciale pour
// une race hybride qui n'en a pas (demande du propriétaire).
// La base vivante part des règles de data/rows, où le site de dev a pu créer ou renommer : les données d'essai ont des noms absents de la base, et
// l'état attendu (ordre, races hybrides sans classe raciale) est lu avant d'écrire.
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
import { normalize } from '../src/lib/text.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-classes-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin_, corps) => traiter({ methode, chemin: chemin_, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
const enregistrer = (operations) => appel('POST', '/api/edition/', { page: 'classes/x', operations });
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p);
/** Un nom que la base n'a pas encore pour une entité (`table`, pages `<type>/<slug>`) : `nom`, ou `nom 2`, `nom 3`… */
const nomLibre = (nom, table, type) => {
  const pris = (n) => ligne(`SELECT 1 FROM "${table}" WHERE nom = ? OR id = ? UNION ALL SELECT 1 FROM page WHERE id = ?`, n, `${type}/${normalize(n)}`, `${type}/${normalize(n)}`)
    ?? (table === 'race' ? ligne('SELECT 1 FROM peuple WHERE nom = ? OR nom_cle = ?', n, normalize(n)) : null);
  let n = nom;
  for (let i = 2; pris(n); i += 1) n = `${nom} ${i}`;
  return n;
};

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
  // la spécialité du don « Anti-corps » de l'Anansi (CEMIES à l'import), quel que soit son nom aujourd'hui
  const s = ligne("SELECT s.id, s.nom FROM specialite s JOIN capacite k ON k.specialite_id = s.id WHERE k.id = 'capacites/anansi-anti-corps'");
  const nouveau = s.nom === 'CEMIES' ? 'CÉMIES' : `${s.nom} BIS`;
  const r = enregistrer([{ op: 'modifier', table: 'specialite', cle: { id: s.id }, valeurs: { nom: nouveau } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne('SELECT nom_cle FROM specialite WHERE id = ?', s.id).nom_cle, normalize(nouveau));
  assert.equal(JSON.parse(ligne("SELECT donnees FROM page WHERE id = 'capacites/anansi-anti-corps'").donnees).specialite, nouveau);
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
  assert.equal(page.corps_md, 'Immunisé aux poisons.  \nEt aux fioles.\n', 'le rendu de l’importeur : retour à la ligne forcé (lib/corps-classes.mjs#corpsDeDon)');
  assert.equal(JSON.parse(page.donnees).type_capacite, 'Actif (2 fois/combat)');
});

test('créer une classe dans une catégorie : page (mot-clé de la catégorie : rangée dans sa colonne), colonne de la matrice de la fiche', () => {
  const nom = nomLibre('Sorcier des marais', 'classe', 'classes');
  const id = `classes/${normalize(nom)}`;
  const ordre = ligne('SELECT max(ordre) AS m FROM classe').m + 1;
  const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-magique', nom, sante_depart: '6' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const c = ligne('SELECT * FROM classe WHERE id = ?', id);
  assert.deepEqual([c.categorie_id, c.sante_depart, c.ordre], ['classe-magique', 6, ordre], 'à la suite des classes de la base');
  const tags = lignes('SELECT libelle FROM page_tag WHERE page_id = ? ORDER BY ordre', id).map((t) => t.libelle);
  assert.deepEqual(tags, ['classe', 'magique']);
  const groupe = groupClasses([{ id, data: { title: nom, tags } }])[0];
  assert.equal(groupe.key, 'magiques');
  assert.equal(ligne('SELECT count(*) AS n FROM race_classe WHERE classe_id = ? AND accessible = 0', id).n, ligne('SELECT count(*) AS n FROM race').n);
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
  // à l'import : le Drassah'thac seul (R14) ; le site a pu créer d'autres races hybrides, encore sans classe raciale
  const avant = racesHybridesSansClasse(db).map((r) => r.id);
  assert.ok(avant.includes('races/drassahthac'), 'le Drassah’thac (R14)');
  const lycan = nomLibre('Lycan', 'race', 'races');
  const gnome = nomLibre('Gnome', 'race', 'races');
  const [idLycan, idGnome] = [lycan, gnome].map((n) => `races/${normalize(n)}`);
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: lycan, nature: 'hybride' } }]).statut, 200);
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: gnome, nature: 'pure' } }]).statut, 200);
  const listes = appel('GET', '/api/edition/listes/').corps;
  assert.deepEqual(listes.racesSansClasse.map((r) => r.valeur).sort(), [...avant, idLycan].sort());
  assert.ok(listes.categories.some((c) => c.valeur === 'classe-hybride-animal'));
  for (const race of [idGnome, 'races/orios', 'races/humain']) {
    const refus = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-hybride-animal', race_id: race } }]);
    assert.equal(refus.statut, 400, race);
    assert.match(refus.corps.erreur, /race hybride qui n’a pas encore de classe raciale/);
  }
  const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-hybride-animal', race_id: idLycan, nom: 'ignoré' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const idClasse = `classes/${normalize(lycan)}`;
  assert.deepEqual(r.corps.crees, [{ entite: 'classe', id: idClasse }]);
  assert.equal(ligne('SELECT nom FROM classe WHERE id = ?', idClasse).nom, lycan);
  assert.deepEqual(lignes('SELECT race_id FROM race_classe WHERE classe_id = ? AND accessible = 1', idClasse).map((l) => l.race_id), [idLycan]);
  assert.deepEqual(chargerRaces(db).races.get(idLycan).classeRaciale, { id: idClasse, nom: lycan }, 'la page de la race la cite');
  assert.deepEqual(racesHybridesSansClasse(db).map((r) => r.id).sort(), [...avant].sort());
});
