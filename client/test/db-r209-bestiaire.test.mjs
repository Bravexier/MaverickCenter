// Décision R209 du propriétaire (2026-11-07), points (3) Momies, (4) Hallebarde amochée et (5) « points d'armure / résistance magique », appliqués à la
// base par la migration data/migrations/0106-r209-bestiaire (registre .json). Lecture seule de la base construite.
//   - Les rubriques et les noms des cartes se modifient sur le site de dev, source de ce qu'il modifie : ce que la 0106 a écrit se lit dans l'état de
//     la migration (baseDImport({ garder: lotsAvant('0106') }), skill tests-conventions) ; l'état courant ne garde que des invariants (les valeurs
//     typées et monstre_defense dérivent des rubriques, lib/monstre-champs.mjs#valeursDeLaCarte, que le service refait).
//   - La lecture de la défense (lib/monstre-champs.mjs#defense) : la forme nouvelle et l'ancienne se lisent de même (R209 (5)).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { defense, LIGNE_DE_DEFENSE_ANCIENNE, ligneDeDefenseRenommee, valeursDeLaCarte } from '../src/lib/monstre-champs.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';

const db = ouvrirBase({ sansExemples: false });
const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0106-r209-bestiaire.json', import.meta.url), 'utf8'));
const apresLa0106 = () => baseDImport({ garder: lotsAvant('0106') });
const ANCIENS_NOMS = /points? d[’']armure|résistance magique/;
const MOMIES = ['monstres/momie#carte:momie', 'monstres/momie#carte:momie-royale', 'monstres/momie#carte:momie-surveillante'];
const HALLEBARDE = 'monstres/hallebarde-amochee#carte:cuirasse-abime';

const rubriquesDe = (base, id) => base.prepare('SELECT rang, rubrique, texte FROM monstre_rubrique WHERE monstre_id = ? ORDER BY rang').all(id);
const defensesDe = (base, id) =>
  base.prepare('SELECT sens, rang, cible, cible_cle FROM monstre_defense WHERE monstre_id = ? ORDER BY sens, rang').all(id).map((d) => ({ ...d }));

test('R209 (5) : defense lit « armure physique / armure magique », « AP / AM » et l’ancienne écriture de même ; sans nombre, aucune valeur', () => {
  const lu = (t) => Object.values(defense(t));
  assert.deepEqual(lu('3 armure physique / 0 armure magique (Peau)'), [3, 0]);
  assert.deepEqual(lu("3 points d'armure / 0 résistance magique (Peau)"), [3, 0]);
  assert.deepEqual(lu('3 points d’armure / 0 résistance magique'), [3, 0]);
  assert.deepEqual(lu('4 AP / 4 AM (Peau)'), [4, 4]);
  for (const t of ['? armure physique / ? armure magique (Peau)', '0 armure physique / ∞ armure magique (Peau)', 'EP 1 : 5 armure physique / 5 armure magique (Peau)\nEP 2 : 7 armure physique / 7 armure magique (Peau)', 'Voir capacité Fondu']) {
    assert.deepEqual(lu(t), [null, null], t);
  }
});

test('R209 (5) : le motif porte sur la ligne de défense entière ; une « résistance magique » dans une phrase ne change pas', () => {
  assert.equal(ligneDeDefenseRenommee("EP 3 : 10 points d'armure / 10 résistance magique (Armure)"), 'EP 3 : 10 armure physique / 10 armure magique (Armure)');
  assert.equal(ligneDeDefenseRenommee("? points d'armure / ? résistance magique (Peau)"), '? armure physique / ? armure magique (Peau)');
  assert.equal(ligneDeDefenseRenommee("2 points d'armure / 0 résistance magique"), '2 armure physique / 0 armure magique');
  const phrase = 'ses sorts semblent ignorer au moins en partie la résistance magique.';
  assert.equal(ligneDeDefenseRenommee(phrase), phrase);
});

test('R209 (5) : dans l’état de la 0106, plus aucune ligne de défense n’écrit les anciens noms ; les autres rubriques ne sont pas touchées', () => {
  const base = apresLa0106();
  const defenses = base.prepare("SELECT monstre_id, texte FROM monstre_rubrique WHERE rubrique = 'defense'").all();
  assert.deepEqual(defenses.filter((r) => ANCIENS_NOMS.test(r.texte)).map((r) => r.monstre_id), []);
  // le registre : 93 rubriques de défense, chacune réécrite ligne par ligne par le motif de la migration
  const corrections = registre.corrections.filter((c) => c.decision === 'R209 (5)');
  assert.equal(corrections.length, 93);
  for (const c of corrections) {
    assert.equal(c.table, 'monstre_rubrique');
    assert.ok(c.avant.split('\n').some((l) => LIGNE_DE_DEFENSE_ANCIENNE.test(l)), JSON.stringify(c.cle));
    assert.equal(c.apres, c.avant.split('\n').map(ligneDeDefenseRenommee).join('\n'), JSON.stringify(c.cle));
    assert.doesNotMatch(c.apres, ANCIENS_NOMS, JSON.stringify(c.cle));
    assert.equal(base.prepare('SELECT rubrique FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(c.cle.monstre_id, c.cle.rang).rubrique, 'defense');
  }
  // aucune rubrique d'une autre sorte ne porte une ligne de défense à l'ancienne (les « résistance magique » des tactiques restent des phrases)
  const autres = base.prepare("SELECT texte FROM monstre_rubrique WHERE rubrique <> 'defense'").all();
  assert.ok(!autres.some((r) => r.texte.split('\n').some((l) => LIGNE_DE_DEFENSE_ANCIENNE.test(l))));
});

test('R209 (5) : dans l’état de la 0106, les cartes réécrites ont leur AP et leur AM (87), sauf les 6 sans nombre', () => {
  const base = apresLa0106();
  const ids = registre.corrections.filter((c) => c.decision === 'R209 (5)').map((c) => c.cle.monstre_id);
  const sans = new Set(registre.sans_nombre.map((s) => s.monstre_id));
  assert.equal(sans.size, 6);
  let typees = 0;
  for (const id of ids) {
    const m = base.prepare('SELECT armure_physique, armure_magique FROM monstre WHERE id = ?').get(id);
    if (sans.has(id)) assert.deepEqual([m.armure_physique, m.armure_magique], [null, null], id);
    else {
      typees += 1;
      assert.ok(Number.isInteger(m.armure_physique) && Number.isInteger(m.armure_magique), id);
    }
  }
  assert.equal(typees, 87);
  assert.equal(registre.derivees.monstre.length, 87);
});

test('R209 (3) : dans l’état de la 0106, les Momies ne sont plus immunisées contre « Enragé », qui reste leur vulnérabilité', () => {
  const base = apresLa0106();
  for (const id of MOMIES) {
    const immunite = rubriquesDe(base, id).filter((r) => r.rubrique === 'immunite');
    assert.deepEqual(immunite.map((r) => r.texte), ['Poison, Maladie, Peur, Fatigue'], id);
    const d = defensesDe(base, id);
    assert.ok(!d.some((x) => x.sens === 'immunite' && x.cible_cle === 'enrage'), id);
    assert.ok(d.some((x) => x.sens === 'vulnerabilite' && x.cible_cle === 'enrage'), id);
  }
  // les autres cartes qui écrivent cette immunité ne changent pas
  assert.ok(base.prepare("SELECT count(*) AS n FROM monstre_rubrique WHERE rubrique = 'immunite' AND texte = 'Poison, Maladie, Enragé, Peur, Fatigue'").get().n > 0);
});

test('R209 (4) : dans l’état de la 0106, la carte de la Hallebarde amochée porte le nom de son espèce ; son identifiant ne change pas', () => {
  const base = apresLa0106();
  const m = base.prepare('SELECT * FROM monstre WHERE id = ?').get(HALLEBARDE);
  const espece = base.prepare('SELECT nom FROM monstre_espece WHERE id = ?').get(m.espece_id);
  assert.deepEqual([m.nom, m.nom_brut, m.nom_cle], [espece.nom, espece.nom.toLocaleUpperCase('fr'), normalize(espece.nom)]);
  // la vraie Cuirasse abîmée garde son nom
  assert.equal(base.prepare("SELECT nom_brut FROM monstre WHERE id = 'monstres/cuirasse-abimee#carte:cuirasse-abime'").get().nom_brut, 'CUIRASSE ABÎMÉ');
});

test('aujourd’hui : l’AP, l’AM et les cibles des défenses de chaque carte sont celles que ses rubriques donnent (valeursDeLaCarte)', () => {
  const cartes = db.prepare('SELECT id, armure_physique, armure_magique FROM monstre ORDER BY id').all();
  assert.ok(cartes.length > 0);
  for (const m of cartes) {
    const v = valeursDeLaCarte(rubriquesDe(db, m.id));
    assert.deepEqual([m.armure_physique, m.armure_magique], [v.armure_physique, v.armure_magique], m.id);
    const attendues = v.defenses.map(({ sens, rang, cible, cible_cle }) => ({ sens, rang, cible, cible_cle }));
    const tri = (l) => [...l].sort((a, b) => `${a.sens}:${a.rang}`.localeCompare(`${b.sens}:${b.rang}`));
    assert.deepEqual(tri(defensesDe(db, m.id)), tri(attendues), m.id);
  }
});
