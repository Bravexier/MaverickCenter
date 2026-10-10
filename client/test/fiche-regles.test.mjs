// Règles de la page /fiche/ (lib/fiche-regles.mjs, publiées en /fiche/regles.json) : tout vient de la base, avec les couleurs et l'ordre des autres
// pages ; les dons à choix sont les groupes de v_capacite_exclusive (comme la page de chaque classe), les classes et spécialités magiques celles des
// décisions R6 et R7 (corrections de la fiche auto, docs/fiche-auto.md, point 4).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLASS_COLORS } from '../src/lib/class-groups.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { ORDRE_DES_RACES, RACE_COLORS } from '../src/lib/race-kinds.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = chargerReglesDeFiche(db);
const compte = (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;

test('tout est sérialisable et chaque liste a toutes les lignes de sa table', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(regles)), regles);
  const tables = { races: 'race', ethnies: 'ethnie', magies: 'magie', dieux: 'dieu', metiers: 'metier', classes: 'classe', sorts: 'sort', niveaux: 'niveau_global',
    caracteristiques: 'caracteristique', competences: 'competence', armes: 'arme', familles_armes: 'arme_famille', armures: 'armure', boucliers: 'bouclier_classe',
    accessoires: 'accessoire_effet', ressources: 'ressource', ameliorations: 'amelioration_equipement', armes_elementaires: 'arme_elementaire',
    armures_elementaires: 'armure_elementaire', materiaux_armes: 'materiau_arme', materiaux_bouclier: 'materiau_bouclier' };
  for (const [cle, table] of Object.entries(tables)) assert.equal(regles[cle].length, compte(table), cle);
  assert.equal(regles.emplacements_armure.length, compte('armure_emplacement') - 1, 'le bouclier a sa propre ligne sur la fiche');
  assert.equal(regles.am_classe_magique, 4);
  assert.equal(regles.constantes['caracteristique.bonus_magie_innee'], 1);
});

test('races : l’ordre et les couleurs de /races/, valeurs de l’onglet de la race (R13), bornes des six caractéristiques', () => {
  assert.deepEqual(regles.races.map((r) => r.id), ORDRE_DES_RACES);
  for (const r of regles.races) {
    assert.equal(r.couleur, RACE_COLORS[r.nature], r.id);
    assert.equal(Object.keys(r.bornes).length, 6, r.id);
    const onglet = db.prepare('SELECT sante_depart, chakra_depart FROM race_onglet WHERE race_id = ?').get(r.id);
    assert.deepEqual([r.sante, r.chakra], [onglet.sante_depart, onglet.chakra_depart], r.id);
    for (const c of r.classes) assert.ok(regles.classes.some((x) => x.id === c), `${r.id} : ${c}`);
    for (const m of r.magies) assert.ok(regles.magies.some((x) => x.id === m), `${r.id} : ${m}`);
  }
  assert.equal(regles.races.find((r) => r.id === 'races/drassahthac').nature, 'hybride', 'décision R14');
  assert.equal(regles.races.find((r) => r.id === 'races/orios').nature, 'hybride');
  assert.equal(regles.races.find((r) => r.id === 'races/humain').nature, 'pure');
});

test('classes : couleurs de /classes/ ; magiques = catégorie Magique et Archimage (R6) ; spécialités magiques = 13 classes raciales et le Flagelleur (R7) ; Archimage du Potentiel Illimité (R23)', () => {
  assert.ok(regles.classes.every((c) => Object.values(CLASS_COLORS).includes(c.couleur)));
  assert.equal(regles.classes.find((c) => c.id === 'classes/parleur').couleur, CLASS_COLORS.speciales, 'Parleur sous « Spéciales »');
  assert.deepEqual(regles.classes.find((c) => c.id === 'classes/parleur').groupe, { key: 'speciales', label: 'Spéciales', ordre: 4 });
  assert.deepEqual([...new Set([...regles.classes].sort((a, b) => a.groupe.ordre - b.groupe.ordre).map((c) => c.groupe.label))], ['Physiques Mêlée', 'Physiques Distance', 'Magiques', 'Raciales', 'Spéciales']);
  assert.deepEqual([...new Set(regles.classes.map((c) => c.groupe.key))].sort(), Object.keys(CLASS_COLORS).sort(), 'les cinq colonnes de /classes/');
  for (const c of regles.classes) assert.equal(c.couleur, CLASS_COLORS[c.groupe.key], c.id);
  assert.deepEqual(regles.classes.filter((c) => c.magique).map((c) => c.nom).sort(),
    ['Archimage', 'Barde', 'Clerc', 'Maclier', 'Mage', 'Mage Bleu', 'Mage Rouge', 'Mage Vert', 'Ocultomancien']);
  const specialites = regles.classes.flatMap((c) => c.specialites.filter((s) => s.magique).map(() => c));
  assert.equal(specialites.length, 14);
  assert.deepEqual(specialites.filter((c) => c.couleur !== CLASS_COLORS.raciales).map((c) => c.id), ['classes/flagelleur']);
  // Classe réservée à une magie innée, qui l'impose (classe.magie_innee_id, décision R23) : l'Archimage et le Potentiel Illimité, seulement
  assert.deepEqual(regles.classes.filter((c) => c.magie_innee_id !== null).map((c) => [c.id, c.magie_innee_id]), [['classes/archimage', 'magies/potentiel-illimite']]);
});

test('dons à choix : chaque don « choix » qui a une alternative est dans un seul groupe de sa classe, avec toutes ses alternatives', () => {
  const alternatives = new Map();
  for (const r of db.prepare('SELECT capacite_id, autre_id FROM v_capacite_exclusive').all()) {
    if (!alternatives.has(r.capacite_id)) alternatives.set(r.capacite_id, new Set());
    alternatives.get(r.capacite_id).add(r.autre_id);
  }
  const vus = new Map();
  for (const c of regles.classes) {
    for (const g of c.choix) {
      assert.ok(g.options.length >= 2);
      const ids = new Set(g.options.map((o) => o.id));
      for (const o of g.options) {
        assert.ok(!vus.has(o.id), `${o.id} dans deux groupes`);
        vus.set(o.id, c.id);
        const ligne = db.prepare('SELECT classe_id, specialite_id, nature FROM capacite WHERE id = ?').get(o.id);
        assert.deepEqual([ligne.classe_id, ligne.specialite_id, ligne.nature], [c.id, g.specialite_id, 'choix'], o.id);
        for (const a of alternatives.get(o.id) ?? []) assert.ok(ids.has(a), `${o.id} : alternative ${a} hors du groupe`);
      }
    }
  }
  const choixAvecAlternative = db.prepare("SELECT count(*) AS n FROM capacite c WHERE nature = 'choix' AND EXISTS (SELECT 1 FROM v_capacite_exclusive x WHERE x.capacite_id = c.id)").get().n;
  assert.equal(vus.size, choixAvecAlternative);
});

test('magies : couleur des pages de magie, mono-magie (R15) et ses exceptions (R20), caractéristique au choix du Potentiel Illimité', () => {
  const pi = regles.magies.find((m) => m.id === 'magies/potentiel-illimite');
  assert.equal(pi.mono_magie, true);
  assert.equal(pi.caracteristique_id, null);
  assert.match(pi.caracteristique_brut, /AU CHOIX/);
  assert.equal(pi.couleur, '#ff9900');
  assert.deepEqual(regles.magies.find((m) => m.id === 'magies/magie-de-la-corruption').ethnies_secondaires.sort(),
    ['races/elfe-noir#ethnie:elfe-noir-charbon', 'races/felfe#ethnie:felfe-noir']);
  assert.ok(regles.magies.every((m) => /^#[0-9a-f]{6}$/i.test(m.couleur) && m.dieux.length >= 1), 'chaque magie a son dieu inné');
});
