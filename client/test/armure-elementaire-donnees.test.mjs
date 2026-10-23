// Décision R165 (pièce élémentaire posée sur une armure) : ce que les données fournissent, sans rien calculer à la place du moteur de la fiche ni de la
// page des armures. Les règles de la fiche (lib/fiche-regles.mjs → /fiche/regles.json) : la « Maîtrise Armures » de chaque classe, les armures
// élémentaires (ordre, effets écrits), le coût des améliorations, la solidité d'une pièce élémentaire, le type des armures de base, et les textes où le
// moteur lit le poids portable (dons de classe, don du Nain, avantages de la Lamia, explication du Potentiel Illimité). Les données de l'onglet Armures
// (lib/armures-db.mjs#chargerArmures, `elementaires`, `ameliorations.armure_elementaire`). Contrôlés contre les tables (l'état courant), les textes cités
// par la décision contre leur valeur d'import (lib/historique-site.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerArmures } from '../src/lib/armures-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { POIDS_DES_ARMURES, valeurDuPoids } from '../src/lib/fiche-format.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = chargerReglesDeFiche(db);
const armures = chargerArmures(db);
const historique = historiqueSite(db);
const tous = (sql, ...p) => db.prepare(sql).all(...p).map((r) => ({ ...r }));
const PI = 'magies/potentiel-illimite';
/** L'ordre attendu des armures élémentaires : par magie (armure_elementaire.ordre, les colonnes de l'onglet), puis par poids. */
const parMagiePuisPoids = (a, b) => a.ordre - b.ordre || valeurDuPoids(a.categorie) - valeurDuPoids(b.categorie);

test('R165 : regles.json donne la « Maîtrise Armures » de chaque classe (lignes d’armure telles qu’écrites, valeur du poids maximum) ; aucune ligne = []', () => {
  const lignes = tous("SELECT classe_id, rang, brut, poids_min, poids_max FROM classe_maitrise_armure WHERE objet = 'armure' ORDER BY classe_id, rang");
  for (const c of regles.classes) {
    assert.deepEqual(c.maitrise_armures, lignes.filter((l) => l.classe_id === c.id)
      .map((l) => ({ rang: l.rang, brut: l.brut, poids_min: l.poids_min, poids_max: l.poids_max, valeur_max: valeurDuPoids(l.poids_max) })), c.id);
    for (const m of c.maitrise_armures) assert.ok(Number.isInteger(m.valeur_max), `${c.id} : ${m.poids_max} a une valeur`);
  }
  // R165 (6) : « 0 pour Mage, Mage Vert, Ocultomancien, Flagelleur et Archimage, dont la case ne nomme aucune armure »
  for (const id of ['classes/mage', 'classes/mage-vert', 'classes/ocultomancien', 'classes/flagelleur', 'classes/archimage']) {
    assert.deepEqual(regles.classes.find((c) => c.id === id).maitrise_armures, [], id);
  }
});

test('R165 : regles.json donne les armures élémentaires (ordre des colonnes puis identifiant, poids, AP/AM, effets écrits), les améliorations avec leur coût, la solidité d’une pièce élémentaire, le type des armures', () => {
  const effets = tous('SELECT armure_elementaire_id, texte FROM armure_elementaire_effet ORDER BY armure_elementaire_id, rang');
  const attendues = tous('SELECT id, nom, categorie, magie_id, ap, am, ordre FROM armure_elementaire ORDER BY ordre, id')
    .map((a) => ({ ...a, nom: texteSansBalises(a.nom), effets: effets.filter((e) => e.armure_elementaire_id === a.id).map((e) => texteSansBalises(e.texte)) }));
  // `sorts` (R102) et `resistances` (R166 : test/fiche-resistances-armure-elementaire.test.mjs) sont lus de ces effets
  assert.deepEqual(regles.armures_elementaires.map(({ sorts: _s, resistances: _r, ...a }) => a), attendues);
  assert.equal(regles.armures_elementaires.length, 56, '4 poids × 14 magies (Q99:EE138)');
  assert.ok(!regles.armures_elementaires.some((a) => a.magie_id === PI), 'aucune pour le Potentiel Illimité');
  // la teinte de chaque magie (le fond d'une armure élémentaire dans la liste) : sa classe de la palette
  for (const a of regles.armures_elementaires) assert.match(regles.magies.find((m) => m.id === a.magie_id).classe, /^couleur-magie-/);
  const amelios = tous('SELECT * FROM amelioration_equipement ORDER BY cible, niveau');
  assert.deepEqual(regles.ameliorations, amelios.map((a) => ({
    id: a.id, cible: a.cible, niveau: a.niveau, effet: texteSansBalises(a.effet_brut), bonus_degats: a.bonus_degats, bonus_ap: a.bonus_ap, bonus_am: a.bonus_am, bonus_cran: a.bonus_cran,
    cout: texteSansBalises(a.cout_brut), cout_gemmes: a.cout_gemmes, cout_gemmes_qualite: a.cout_gemmes_qualite, cout_pieces_elementaires: a.cout_pieces_elementaires,
  })));
  assert.deepEqual(regles.ameliorations.filter((a) => a.cible === 'armure_elementaire').map((a) => a.niveau), [1, 2, 3, 4, 5], 'tableau « Armure » de l’onglet : +1 à +5');
  assert.equal(regles.constantes['piece_elementaire.solidite_base'],
    db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").get().valeur);
  assert.equal(regles.constantes['piece_elementaire.solidite_base'], 4, '« Chaque pièce élémentaire possède 4 crans de solidité/durabilité » (R165 (3))');
  const types = new Map(tous('SELECT id, type FROM armure').map((a) => [a.id, a.type]));
  for (const a of regles.armures) assert.equal(a.type, types.get(a.id), a.id);
  assert.deepEqual(new Set(regles.armures.map((a) => a.type)), new Set(['Vêtement', 'Léger', 'Intermédiaire', 'Lourd', 'Familier']));
});

test('R165 : regles.json donne les textes où le moteur lit le poids portable : dons de classe, don du Nain, avantages de la race (Lamia), explication de la magie (Potentiel Illimité)', () => {
  // les dons de classe, leur effet tel qu'écrit, sans les balises du glossaire (« Maîtrise les armures intermédiaires », Templier « Maîtrise les 3 armures »)
  const effets = new Map(tous('SELECT id, effet FROM capacite').map((k) => [k.id, k.effet]));
  for (const c of regles.classes) for (const d of c.dons) assert.equal(d.effet, texteSansBalises(effets.get(d.id)), d.id);
  // le don des trois ethnies du Nain (race_don) : « Peut porter une catégorie supérieure d'armure selon les classes […] »
  const nain = regles.races.find((r) => r.id === 'races/nain');
  for (const slug of ['londolor-est', 'londolor-ouest', 'londolor-centre-ligne-de-partage']) {
    const id = `races/nain#don:${slug}`;
    const don = nain.dons.find((d) => d.id === id);
    assert.equal(don.texte, texteSansBalises(db.prepare('SELECT texte FROM race_don WHERE id = ?').get(id).texte), id);
    assert.match(historique.valeurDImport('race_don', { id }, 'texte', don.texte), /Peut porter une catégorie supérieure d'armure selon les classes \[aucun => léger, léger => intermédiaire, intermédiaire => lourde\]/, id);
  }
  // les avantages de l'onglet de chaque race (race_onglet.avantages) ; celui de la Lamia, cité par R165
  const avantages = new Map(tous('SELECT race_id, avantages FROM race_onglet').map((r) => [r.race_id, r.avantages]));
  for (const r of regles.races) assert.equal(r.avantages, avantages.get(r.id) ? texteSansBalises(avantages.get(r.id)) : null, r.id);
  assert.match(historique.valeurDImport('race_onglet', { race_id: 'races/lamia' }, 'avantages', avantages.get('races/lamia')), /peut porter une armure légère même si la classe l'interdit/);
  // l'explication de chaque magie (magie.explication) ; celle du Potentiel Illimité (Magie Maverick V8), citée par R165
  const explications = new Map(tous('SELECT id, explication FROM magie').map((m) => [m.id, m.explication]));
  for (const m of regles.magies) assert.equal(m.explication, explications.get(m.id) ? texteSansBalises(explications.get(m.id)) : null, m.id);
  assert.match(historique.valeurDImport('magie', { id: PI }, 'explication', explications.get(PI)), /Impossible de porter des armures lourdes ou boucliers lourds même si la classe vous le permet\./);
});

test('R165 : l’onglet Armures reçoit les 56 armures élémentaires (par magie dans l’ordre des colonnes, puis par poids), les 14 magies et leur gemme, le tableau d’amélioration élémentaire et la solidité, sans prix', () => {
  const e = armures.elementaires;
  assert.deepEqual(e.poids, [...POIDS_DES_ARMURES]);
  const effets = tous('SELECT armure_elementaire_id, texte FROM armure_elementaire_effet ORDER BY armure_elementaire_id, rang');
  assert.deepEqual(e.armures, tous('SELECT id, nom, categorie, magie_id, ap, am, effets_brut, ordre FROM armure_elementaire').sort(parMagiePuisPoids)
    .map((a) => ({ ...a, effets: effets.filter((x) => x.armure_elementaire_id === a.id).map((x) => x.texte) })));
  assert.ok(e.armures.every((a) => !('prix' in a) && !('prix_brut' in a)), 'aucun prix (« inestimable », A3)');
  // les magies : celles des armures élémentaires, dans l'ordre des colonnes de l'onglet (Sang, Arcane… Ombre), jamais le Potentiel Illimité
  assert.deepEqual(e.magies.map((m) => m.id), [...new Set(e.armures.map((a) => a.magie_id))]);
  assert.equal(e.magies.length, 14);
  assert.ok(!e.magies.some((m) => m.id === PI));
  assert.deepEqual(e.magies.map((m) => m.nom), ['Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre']);
  const gemmes = new Map(tous('SELECT g.magie_id, g.ressource_id AS id, r.nom FROM gemme g JOIN ressource r ON r.id = g.ressource_id').map((g) => [g.magie_id, { id: g.id, nom: g.nom }]));
  for (const m of e.magies) assert.deepEqual(m.gemme, gemmes.get(m.id) ?? null, m.id);
  assert.equal(e.magies.find((m) => m.id === 'magies/magie-du-feu').gemme.nom, 'Rubis', '« Rubis pour le Feu » (R165 (2))');
  assert.deepEqual(armures.ameliorations.armure_elementaire, tous("SELECT * FROM amelioration_equipement WHERE cible = 'armure_elementaire' ORDER BY niveau"));
  assert.equal(armures.totaux.armure_elementaire, db.prepare("SELECT total_brut FROM amelioration_total WHERE cible = 'armure_elementaire'").get()?.total_brut ?? null);
  assert.equal(e.solidite_base, regles.constantes['piece_elementaire.solidite_base']);
});
