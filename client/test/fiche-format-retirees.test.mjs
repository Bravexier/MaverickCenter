// Tables que les règles ont retirées de la section 13 (lib/fiche-format.mjs : TABLES_RETIREES, PARTIES_RETIREES) : la progression niveau par niveau
// (personnage_progression, migration 0045) devient deux totaux, gains_sante et gains_chakra (décision R73). Une fiche qui porte encore sa clé (page
// restée ouverte, fichier exporté avant) est convertie sans rien perdre (sansPartiesRetirees : service et page /fiche/) ; la base vivante fait la même
// somme en SQL (serveur/base-vivante.mjs, test/serveur-base-vivante.test.mjs). Une progression non vide envoyée avec les deux totaux ne se concilie pas
// avec eux (progressionAvecGains) : le service la refuse (test/serveur-api.test.mjs). De même l'armure par emplacement (personnage_armure, migration
// 0055) devient une seule armure complète (décision R95 : armureDesArmures), chaque autre pièce notée, datée, dans la fiche (lignesDesPiecesRetirees) ;
// envoyée avec les nouvelles clés de l'armure, elle est refusée par le service (armuresAvecArmure). Enfin les matériaux du bouclier
// (personnage_bouclier_materiau, migration 0060) deviennent sa matière (décision R96 : matiereDuBouclier), et les accessoires perdent Ceinture, Autre, nom
// et effet hors table (décision R97 : accessoiresGardes), chaque perte notée, datée. Les NM du MJ notés sort par sort (personnage_sort.nm_cadeau,
// migration 0066) deviennent ceux de la fiche (décision R118 : nmDuMjDesSorts). Les dés par famille (personnage_maitrise_arme, migration 0076) et l'arme
// choisie d'un choix d'acquis (R119) sont notés en une ligne datée, aucun choix posé (décision R153 : maitrisesDAvant) ; avec les choix de maîtrise,
// refusés par le service (maitrisesAvecChoix).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { cheminBase } from '../src/lib/donnees.mjs';
import {
  accessoiresGardes, ARMURE_ENTIERE, armureDesArmures, armuresAvecArmure, bouclierAvecMatiere, COLONNES_DE_L_ARMURE, COLONNES_RETIREES, EMPLACEMENTS_D_ARMURE,
  matiereDuBouclier, nmDuMjAvecCadeaux, nmDuMjDesSorts, PARTIES_DE_FICHE, PARTIES_RETIREES, TABLES_FICHES, TABLES_RETIREES, ficheVide, gainsDeLaProgression,
  lignesDesPiecesRetirees, progressionAvecGains, retraitsDuBouclier, sansPartiesRetirees, desEnNotation, maitrisesDAvant, maitrisesAvecChoix, ligneDeRetrait,
  ordreDesRetraits, PREFIXE_DES_MAITRISES_D_AVANT, armeDAvant, armeDAvant0081, armesDAvant,
} from '../src/lib/fiche-format.mjs';
import { notationDesDes } from '../src/lib/fiche-moteur.mjs';

test('tables retirées : progression (migration 0045), armures (0055), matériaux du bouclier (0060), maîtrises d’armes (0076), ni table des fiches ni partie ; PARTIES_RETIREES en est l’inverse', () => {
  assert.deepEqual(TABLES_RETIREES, {
    personnage_progression: 'progression', personnage_armure: 'armures', personnage_bouclier_materiau: 'bouclier_materiaux', personnage_maitrise_arme: 'maitrises_armes',
  });
  assert.deepEqual(PARTIES_RETIREES, {
    progression: 'personnage_progression', armures: 'personnage_armure', bouclier_materiaux: 'personnage_bouclier_materiau', maitrises_armes: 'personnage_maitrise_arme',
  });
  assert.equal(PARTIES_DE_FICHE.maitrise_choix, 'personnage_maitrise_choix', 'R148 : une famille par point à choisir');
  assert.deepEqual(COLONNES_RETIREES.personnage_acquis_choix, ['arme_famille_id'], 'R152');
  assert.deepEqual(COLONNES_RETIREES.personnage_accessoire, ['nom', 'texte'], 'décision R97');
  for (const [table, cle] of Object.entries(TABLES_RETIREES)) {
    assert.ok(!TABLES_FICHES.includes(table), table);
    assert.ok(!(cle in PARTIES_DE_FICHE), cle);
  }
  assert.deepEqual([ficheVide().gains_sante, ficheVide().gains_chakra], [0, 0], 'une fiche neuve : 0 et 0, jamais vide (colonnes obligatoires)');
});

test('gainsDeLaProgression (R73) : les points de chaque niveau, plus le dé sur la santé, le chakra ou les deux ; un résultat absent compte 0', () => {
  assert.deepEqual(gainsDeLaProgression([
    { niveau: 2, points_sante: 10, points_chakra: 5, de_choix: null, de_resultat: null },
    { niveau: 3, points_sante: 15, points_chakra: 0 },
    { niveau: 5, points_sante: 0, points_chakra: 15, de_choix: 'sante', de_resultat: 6 },
    { niveau: 10, points_sante: 5, points_chakra: 10, de_choix: 'chakra', de_resultat: 8 },
    { niveau: 15, points_sante: 7, points_chakra: 8, de_choix: 'les_deux', de_resultat: 4 },
    { niveau: 20, points_sante: 0, points_chakra: 15, de_choix: 'les_deux', de_resultat: null },
  ]), { gains_sante: 10 + 15 + 6 + 5 + 7 + 4, gains_chakra: 5 + 15 + 10 + 8 + 8 + 4 + 15 });
  for (const vide of [[], null, undefined, 'pas une liste']) assert.deepEqual(gainsDeLaProgression(vide), { gains_sante: 0, gains_chakra: 0 }, String(vide));
});

test('sansPartiesRetirees : une `progression` sans gains devient les deux totaux ; avec eux, ils sont gardés et elle est jetée ; sans clé retirée, la fiche telle quelle ; jamais modifiée en place', () => {
  const sans = { nom: 'Aldric', gains_sante: 4, gains_chakra: 0, classes: [] };
  assert.equal(sansPartiesRetirees(sans), sans, 'le même objet');
  const progression = [{ niveau: 2, points_sante: 10, points_chakra: 5 }, { niveau: 5, points_sante: 0, points_chakra: 15, de_choix: 'les_deux', de_resultat: 3 }];
  const ancienne = { nom: 'Brune', progression, classes: [] };
  assert.deepEqual(sansPartiesRetirees(ancienne), { nom: 'Brune', classes: [], gains_sante: 13, gains_chakra: 23 });
  assert.deepEqual(ancienne, { nom: 'Brune', progression, classes: [] }, 'l’objet reçu n’est pas touché');
  assert.deepEqual(sansPartiesRetirees({ nom: 'Cyrielle', progression, gains_sante: 1, gains_chakra: 2 }), { nom: 'Cyrielle', gains_sante: 1, gains_chakra: 2 });
  assert.deepEqual(sansPartiesRetirees({ nom: 'Dorian', progression: [] }), { nom: 'Dorian', gains_sante: 0, gains_chakra: 0 });
  for (const autre of [null, undefined, 'texte', [1, 2]]) assert.equal(sansPartiesRetirees(autre), autre);
});

test('progressionAvecGains : une `progression` non vide ET un des deux totaux (page d’avant 0045 qui a repris les totaux d’une réponse) ; une progression vide, ou sans totaux, n’en est pas une', () => {
  const progression = [{ niveau: 3, points_sante: 15, points_chakra: 0, de_choix: null, de_resultat: null }];
  assert.equal(progressionAvecGains({ nom: 'Aldric', progression, gains_sante: 10, gains_chakra: 5 }), true);
  assert.equal(progressionAvecGains({ nom: 'Aldric', progression, gains_sante: 10 }), true, 'un seul des deux totaux suffit');
  assert.equal(progressionAvecGains({ nom: 'Aldric', progression, gains_chakra: 0 }), true, 'même à 0 : la page l’a reçu du service');
  assert.equal(progressionAvecGains({ nom: 'Aldric', progression }), false, 'sans totaux : la conversion (sansPartiesRetirees)');
  assert.equal(progressionAvecGains({ nom: 'Aldric', progression: [], gains_sante: 10, gains_chakra: 5 }), false, 'une progression vide : un reste, jetée sans rien dire');
  assert.equal(progressionAvecGains({ ...ficheVide('Aldric') }), false, 'la page à jour n’envoie jamais de progression');
  for (const autre of [null, undefined, 'texte', [1, 2], { progression: 'pas une liste', gains_sante: 1 }]) assert.equal(progressionAvecGains(autre), false, JSON.stringify(autre));
});

test('EMPLACEMENTS_D_ARMURE : les emplacements de la base dans l’ordre du tableau FABRICATION, sans le bouclier ; l’armure complète d’abord (R95)', () => {
  const db = new DatabaseSync(cheminBase(), { readOnly: true });
  try {
    assert.deepEqual(EMPLACEMENTS_D_ARMURE, db.prepare("SELECT id FROM armure_emplacement WHERE id <> 'bouclier' ORDER BY ordre").all().map((e) => e.id));
    assert.equal(ARMURE_ENTIERE, 'armure-complete');
    const colonnes = db.prepare('PRAGMA table_info(personnage)').all().map((c) => c.name);
    for (const c of Object.keys(COLONNES_DE_L_ARMURE)) assert.ok(colonnes.includes(c), c);
  } finally {
    db.close();
  }
});

test('armureDesArmures (R95) : la ligne du premier emplacement, l’armure complète d’abord ; les autres pièces qui ne portent pas la même armure sont rendues ; une pièce qui devient l’armure complète aussi', () => {
  const lignes = [
    { emplacement_id: 'torse', armure_id: 'B', amelioration_id: null, armure_elementaire_id: null, amelioration_elementaire_id: null },
    { emplacement_id: 'armure-complete', armure_id: 'A', amelioration_id: 'am2', armure_elementaire_id: 'el', amelioration_elementaire_id: null },
    { emplacement_id: 'casque', armure_id: 'A', amelioration_id: 'am2', armure_elementaire_id: 'el', amelioration_elementaire_id: null },
    { emplacement_id: 'jambe-droit', armure_id: 'A', amelioration_id: null, armure_elementaire_id: 'el', amelioration_elementaire_id: null },
  ];
  const r = armureDesArmures(lignes);
  assert.deepEqual(r.colonnes, { armure_id: 'A', armure_amelioration_id: 'am2', armure_elementaire_id: 'el', armure_amelioration_elementaire_id: null });
  assert.deepEqual(r.retirees.map((l) => l.emplacement_id), ['torse', 'jambe-droit'], 'une autre armure, ou la même sans son amélioration');
  assert.equal(r.transformee, null, 'l’armure complète était portée');
  // sans armure complète : la première pièce dans l'ordre du tableau (casque avant torse), qui devient l'armure complète (une ligne dans les notes)
  const pieces = armureDesArmures([{ emplacement_id: 'torse', armure_id: 'B' }, { emplacement_id: 'casque', armure_id: 'C' }]);
  assert.deepEqual([pieces.colonnes.armure_id, pieces.transformee?.emplacement_id, pieces.retirees.map((l) => l.emplacement_id)], ['C', 'casque', ['torse']]);
  // la même armure sur les six parties : c'était l'armure complète, rien ne change
  const six = EMPLACEMENTS_D_ARMURE.slice(1).map((e) => ({ emplacement_id: e, armure_id: 'A', amelioration_id: 'am1' }));
  assert.deepEqual([armureDesArmures(six).transformee, armureDesArmures(six).retirees], [null, []]);
  assert.equal(armureDesArmures(six.slice(1)).transformee.emplacement_id, 'torse', 'cinq parties seulement : une pièce');
  for (const vide of [[], null, undefined, [{ emplacement_id: 'torse', armure_id: '' }]]) {
    assert.deepEqual(armureDesArmures(vide), {
      colonnes: { armure_id: null, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null }, retirees: [], transformee: null,
    });
  }
});

test('sansPartiesRetirees (R95) : une liste `armures` donne l’armure de la fiche et une ligne de retrait datée par pièce non gardée ; avec les nouvelles clés, elle est jetée', () => {
  const fiche = { nom: 'Aldric', notes: 'Mes notes', armures: [
    { emplacement_id: 'armure-complete', armure_id: 'A', amelioration_id: 'am2' }, { emplacement_id: 'casque', armure_id: 'B' },
  ] };
  const noms = { armure: (id) => ({ A: 'Armure Cuir/Peau', B: 'Armure de Peau complète' })[id] ?? null, emplacement: (id) => ({ casque: 'Casque' })[id] ?? null };
  const r = sansPartiesRetirees(fiche, { instant: '2026-10-16T18:00:00Z', noms });
  assert.equal('armures' in r, false);
  assert.deepEqual([r.armure_id, r.armure_amelioration_id, r.armure_elementaire_id], ['A', 'am2', null]);
  assert.equal(r.notes, 'Mes notes\n[16/10/2026] Retrait (règles modifiées) : la pièce d’armure « Armure de Peau complète » (Casque) n’est plus portée : une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.');
  assert.equal(fiche.notes, 'Mes notes', 'jamais modifiée en place');
  assert.deepEqual(lignesDesPiecesRetirees({ retirees: [{ emplacement_id: 'torse', armure_id: 'x' }] }, '2026-10-16T18:00:00Z'),
    ['[16/10/2026] Retrait (règles modifiées) : la pièce d’armure « x » (torse) n’est plus portée : une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.'], 'sans noms : les identifiants');
  // une pièce de la même armure, sans l'amélioration de l'armure complète : la fiche garde l'armure, la note dit ce qui se perd
  const meme = sansPartiesRetirees({ armures: [{ emplacement_id: 'armure-complete', armure_id: 'A', amelioration_id: 'am2' }, { emplacement_id: 'casque', armure_id: 'A' }] },
    { instant: '2026-10-16T18:00:00Z', noms });
  assert.equal(meme.notes, '[16/10/2026] Retrait (règles modifiées) : la pièce d’armure « Armure Cuir/Peau » (Casque) reste l’armure de la fiche, sans l’amélioration ni l’élément propres à cette pièce : une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.');
  // une pièce seule (un casque) : elle devient l'armure complète, et la fiche le dit
  const casque = sansPartiesRetirees({ nom: 'Brune', armures: [{ emplacement_id: 'casque', armure_id: 'B' }] }, { instant: '2026-10-16T18:00:00Z', noms });
  assert.deepEqual([casque.armure_id, casque.notes], ['B',
    '[16/10/2026] Retrait (règles modifiées) : la pièce d’armure « Armure de Peau complète » (Casque) est devenue l’armure complète de la fiche : une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.']);
  // les nouvelles clés déjà là (page d'avant qui a repris une réponse du service) : elles sont gardées, la liste est jetée
  const reprise = sansPartiesRetirees({ armure_id: 'C', armure_parties: [], armures: [] }, { instant: '2026-10-16T18:00:00Z' });
  assert.deepEqual(reprise, { armure_id: 'C', armure_parties: [] });
});

test('armuresAvecArmure : une liste `armures` non vide ET une des nouvelles clés de l’armure ; une liste vide, ou sans nouvelle clé, n’en est pas une', () => {
  assert.equal(armuresAvecArmure({ armures: [{ emplacement_id: 'torse', armure_id: 'A' }], armure_id: null }), true);
  assert.equal(armuresAvecArmure({ armures: [{ emplacement_id: 'torse', armure_id: 'A' }], armure_parties: [] }), true);
  assert.equal(armuresAvecArmure({ armures: [], armure_id: 'A' }), false);
  assert.equal(armuresAvecArmure({ armures: [{ emplacement_id: 'torse', armure_id: 'A' }] }), false);
  for (const x of [null, undefined, [], 'fiche']) assert.equal(armuresAvecArmure(x), false);
  assert.equal('armure_parties' in ficheVide(), true);
  assert.equal('armures' in ficheVide(), false);
});

const INSTANT = '2026-10-17T10:00:00Z';
const nomsDEssai = { ressource: (id) => ({ fer: 'Fer', bois: 'Bois', cuir: 'Cuir' })[id] ?? null, accessoire: (id) => `Effet ${id}` };

test('matiereDuBouclier (R96) : le matériau du premier rang ; les autres rendus dans l’ordre des rangs, une ligne de retrait chacun', () => {
  const conversion = matiereDuBouclier([{ rang: 3, materiau_id: 'cuir', quantite: 1 }, { rang: 1, materiau_id: 'fer', quantite: 2 }, { rang: 2, materiau_id: 'bois', quantite: 1 }]);
  assert.equal(conversion.materiau_id, 'fer');
  assert.deepEqual(conversion.retires.map((l) => l.materiau_id), ['bois', 'cuir']);
  assert.deepEqual(retraitsDuBouclier(conversion, nomsDEssai).map((d) => [d.nature, d.nom, d.quantite, d.matiere]), [
    ['materiau_bouclier', 'Bois', 1, 'Fer'], ['materiau_bouclier', 'Cuir', 1, 'Fer'],
  ]);
  for (const vide of [[], null, undefined, [{ rang: 1, materiau_id: '' }]]) assert.deepEqual(matiereDuBouclier(vide), { materiau_id: null, retires: [] });
});

test('accessoiresGardes (R97) : Ceinture, Autre et effet hors table seul écartés ; nom et effet hors table d’un accessoire gardé retirés ; chaque perte décrite', () => {
  const { lignes, retraits } = accessoiresGardes([
    { emplacement: 'chef', nom: null, accessoire_effet_id: 'e1', valeur: null, texte: null, maudit: 0 },
    { emplacement: 'collier', nom: 'Collier du vent', accessoire_effet_id: 'e2', valeur: null, texte: null, maudit: 1 },
    { emplacement: 'bague-1', nom: null, accessoire_effet_id: null, valeur: null, texte: 'Brille la nuit', maudit: 0 },
    { emplacement: 'ceinture', nom: null, accessoire_effet_id: 'e3', valeur: null, texte: null, maudit: 0 },
    { emplacement: 'autre', nom: 'Gant', accessoire_effet_id: 'e4', valeur: null, texte: 'Chaud', maudit: 0 },
  ], nomsDEssai);
  assert.deepEqual(lignes, [
    { emplacement: 'chef', accessoire_effet_id: 'e1', valeur: null, maudit: 0 },
    { emplacement: 'collier', accessoire_effet_id: 'e2', valeur: null, maudit: 1 },
  ]);
  assert.deepEqual(retraits.map((d) => [d.emplacement, d.nom, d.effet, d.texte, d.ecarte]), [
    ['Collier', 'Collier du vent', 'Effet e2', null, false],
    ['Bague 1', null, null, 'Brille la nuit', true],
    ['Ceinture', null, 'Effet e3', null, true],
    ['Autre', 'Gant', 'Effet e4', 'Chaud', true],
  ]);
});

test('sansPartiesRetirees (R96, R97) : `bouclier_materiaux` donne la matière, les accessoires d’avant sont convertis ; une ligne datée par perte ; avec les nouvelles clés du bouclier, la liste est jetée', () => {
  const recue = {
    nom: 'Erwan', notes: 'Mes notes',
    bouclier_materiaux: [{ rang: 1, materiau_id: 'fer', quantite: 2 }, { rang: 2, materiau_id: 'bois', quantite: 1 }],
    accessoires: [{ emplacement: 'ceinture', nom: null, accessoire_effet_id: 'e3', valeur: null, texte: null, maudit: 0 }, { emplacement: 'chef', accessoire_effet_id: 'e1', valeur: null, maudit: 0 }],
  };
  const f = sansPartiesRetirees(recue, { instant: INSTANT, noms: nomsDEssai });
  assert.equal(f.bouclier_materiau_id, 'fer');
  assert.ok(!('bouclier_materiaux' in f));
  assert.deepEqual(f.accessoires, [{ emplacement: 'chef', accessoire_effet_id: 'e1', valeur: null, maudit: 0 }]);
  assert.deepEqual(f.notes.split('\n'), [
    'Mes notes',
    '[17/10/2026] Retrait (règles modifiées) : le matériau de bouclier « Bois » (×1) n’est plus dans le bouclier : un bouclier n’a plus qu’une forme et une matière (« Fer », son premier matériau). Adaptez la fiche.',
    '[17/10/2026] Retrait (règles modifiées) : l’accessoire de l’emplacement Ceinture (effet « Effet e3 ») n’est plus porté : la fiche n’a plus d’emplacement Ceinture ni Autre, et un accessoire a toujours un effet de la table des accessoires. Adaptez la fiche.',
  ]);
  assert.equal(recue.bouclier_materiaux.length, 2, 'l’objet reçu n’est pas touché');
  // déjà au nouveau format : le même objet
  const nouvelle = { nom: 'Fanny', bouclier_materiau_id: 'fer', accessoires: [{ emplacement: 'chef', accessoire_effet_id: 'e1', valeur: null, maudit: 0 }] };
  assert.equal(sansPartiesRetirees(nouvelle), nouvelle);
  // avec les nouvelles clés du bouclier, l'ancienne liste est jetée (le service la refuse avant : bouclierAvecMatiere)
  assert.deepEqual(sansPartiesRetirees({ nom: 'Gaël', bouclier_materiau_id: 'bois', bouclier_materiaux: [{ rang: 1, materiau_id: 'fer', quantite: 1 }] }), { nom: 'Gaël', bouclier_materiau_id: 'bois' });
});

test('bouclierAvecMatiere : une liste `bouclier_materiaux` non vide ET une des nouvelles clés du bouclier', () => {
  const materiaux = [{ rang: 1, materiau_id: 'fer', quantite: 1 }];
  assert.equal(bouclierAvecMatiere({ bouclier_materiaux: materiaux, bouclier_materiau_id: null }), true);
  assert.equal(bouclierAvecMatiere({ bouclier_materiaux: materiaux, bouclier_solidite: 2 }), true);
  assert.equal(bouclierAvecMatiere({ bouclier_materiaux: materiaux }), false, 'sans nouvelle clé : la conversion');
  assert.equal(bouclierAvecMatiere({ bouclier_materiaux: [], bouclier_materiau_id: 'fer' }), false, 'une liste vide : un reste');
  for (const autre of [null, undefined, 'texte', [1]]) assert.equal(bouclierAvecMatiere(autre), false);
});

test('NM du MJ (décision R118, migration 0066) : `nm_cadeau` d’un sort est une colonne retirée ; une fiche d’avant donne leur somme à `nm_mj`, le NM de chaque sort gardé ; avec `nm_mj`, il est gardé', () => {
  assert.deepEqual(COLONNES_RETIREES.personnage_sort, ['nm_cadeau']);
  assert.equal(ficheVide().nm_mj, 0);
  const sorts = [{ sort_id: 'a', rang: 1, niveau_maitrise: 3, nm_livre: 1, nm_cadeau: 1 }, { sort_id: 'b', rang: 2, niveau_maitrise: 2, nm_livre: 0, nm_cadeau: 2 },
    { sort_id: 'c', rang: 3, niveau_maitrise: 1, nm_livre: 0, nm_cadeau: 0 }];
  assert.equal(nmDuMjDesSorts(sorts), 3);
  assert.equal(nmDuMjDesSorts(null), 0);
  const avant = { nom: 'Aldric', sorts };
  const convertie = sansPartiesRetirees(avant);
  assert.deepEqual(convertie, { nom: 'Aldric', nm_mj: 3, sorts: sorts.map(({ nm_cadeau: _c, ...x }) => x) });
  assert.equal(avant.sorts[0].nm_cadeau, 1, 'jamais modifiée en place');
  // une page d'avant qui a repris les NM du MJ d'une réponse, sans en noter sur un sort : ses NM du MJ gardés
  assert.deepEqual(sansPartiesRetirees({ nm_mj: 2, sorts: [{ ...sorts[2] }] }), { nm_mj: 2, sorts: [sorts[2]].map(({ nm_cadeau: _c, ...x }) => x) });
  assert.equal(nmDuMjAvecCadeaux({ nm_mj: 2, sorts: [{ ...sorts[2] }] }), false);
  assert.equal(nmDuMjAvecCadeaux({ nm_mj: 2, sorts }), true, 'des NM du MJ sur un sort ET ceux de la fiche : le service refuse (409)');
  assert.equal(nmDuMjAvecCadeaux({ sorts }), false, 'sans `nm_mj` : convertie');
  const sans = { nm_mj: 1, sorts: [{ sort_id: 'a', rang: 1, niveau_maitrise: 1, nm_livre: 0 }] };
  assert.equal(sansPartiesRetirees(sans), sans, 'rien à convertir : la même fiche');
});

// Décision R153 : les noms, dés et ordre des familles et le don de la base des règles, comme le service (serveur/fiches.mjs, serveur/base-vivante.mjs).
function nomsDeLaBase() {
  const db = new DatabaseSync(cheminBase({ sansExemples: false }), { readOnly: true });
  const familles = new Map(db.prepare('SELECT id, nom, de_brut AS de, ordre FROM arme_famille').all().map((f) => [f.id, { nom: f.nom, de: f.de, ordre: f.ordre }]));
  const dons = new Map(db.prepare('SELECT k.id, k.nom, c.nom AS classe FROM capacite k LEFT JOIN classe c ON c.id = k.classe_id').all().map((k) => [k.id, { nom: k.nom, classe: k.classe }]));
  db.close();
  return { famille: (id) => familles.get(id) ?? null, don: (id) => dons.get(id) ?? null };
}

test('desEnNotation : la notation des dés de la page (fiche-moteur#notationDesDes), sur chaque dé de famille de la base', () => {
  const noms = nomsDeLaBase();
  for (const id of ['epees', 'pugilat', 'arc', 'arme-de-monstres']) {
    for (const n of [1, 2, 5]) assert.equal(desEnNotation(noms.famille(id).de, n), notationDesDes(noms.famille(id).de, n), `${id} ${n}`);
  }
  assert.equal(desEnNotation('D6/D8/D10', 3), '3D6/3D8/3D10');
  assert.equal(desEnNotation(null, 1), '1 dé');
});

test('maitrisesDAvant (R153) : les anciens dés dans l’ordre des familles et l’arme choisie de R119 ; une partie absente omise ; rien sans dés ni arme', () => {
  const noms = nomsDeLaBase();
  const d = maitrisesDAvant(
    [{ arme_famille_id: 'arc', des: 2 }, { arme_famille_id: 'epees', des: 3 }],
    [{ source: 'capacites/tueur-fletrisseur', rang: 1, competence_id: 'arme-legere', arme_famille_id: 'epees' }, { source: 'x', rang: 1, competence_id: 'arc' }],
    noms,
  );
  assert.equal(ligneDeRetrait(d, '2026-10-22T09:00:00Z'),
    'Maîtrises d\'armes avant la refonte (2026-10-22) : ÉPÉES 3D10, ARC 2D8 ; arme choisie : Flétrisseur (Tueur) ÉPÉES', 'le texte du cahier de la refonte');
  assert.ok(ligneDeRetrait(d, '2026-10-22T09:00:00Z').startsWith(PREFIXE_DES_MAITRISES_D_AVANT));
  assert.equal(ligneDeRetrait(maitrisesDAvant([{ arme_famille_id: 'pugilat', des: 2 }], [], noms), '2026-10-22T09:00:00Z'),
    'Maîtrises d\'armes avant la refonte (2026-10-22) : PUGILAT 2D6/2D8/2D10', 'sans arme choisie');
  assert.equal(ligneDeRetrait(maitrisesDAvant([], [{ source: 'capacites/tueur-fletrisseur', arme_famille_id: 'arbalete' }], noms), '2026-10-22T09:00:00Z'),
    'Maîtrises d\'armes avant la refonte (2026-10-22) : arme choisie : Flétrisseur (Tueur) ARBALÈTE', 'sans dés');
  assert.equal(maitrisesDAvant([], [{ source: 's', competence_id: 'arc', arme_famille_id: null }], noms), null, 'ni dés ni arme : pas de ligne');
  assert.equal(maitrisesDAvant(undefined, undefined), null);
  // sans les noms (page qui ne les donne pas) : l'id tient lieu de nom
  assert.equal(ligneDeRetrait(maitrisesDAvant([{ arme_famille_id: 'epees', des: 2 }], []), '2026-10-22T09:00:00Z'), 'Maîtrises d\'armes avant la refonte (2026-10-22) : epees 2 dés');
  // la dernière ligne d'une fiche, après les retraits de R42
  assert.ok(ordreDesRetraits(d, { nature: 'acquis', id: 'arc', nom: 'Arc' }) > 0);
});

test('sansPartiesRetirees (R153, R152) : une fiche d’avant (JSON exporté, page restée ouverte) perd `maitrises_armes` et l’arme choisie, notés en une ligne ; la compétence du choix reste ; avec `maitrise_choix`, jetés sans note', () => {
  const noms = nomsDeLaBase();
  const recue = {
    nom: 'Aldric', notes: 'Mes notes', maitrises_armes: [{ arme_famille_id: 'epees', des: 3 }, { arme_famille_id: 'arc', des: 2 }],
    acquis_choix: [{ source: 'capacites/tueur-fletrisseur', rang: 1, competence_id: 'arme-legere', valeur: null, arme_famille_id: 'epees' }],
  };
  const gele = JSON.stringify(recue);
  const convertie = sansPartiesRetirees(recue, { instant: '2026-10-22T09:00:00Z', noms });
  assert.equal(JSON.stringify(recue), gele, 'jamais modifiée en place');
  assert.ok(!('maitrises_armes' in convertie));
  assert.ok(!('maitrise_choix' in convertie), 'aucun choix posé');
  assert.deepEqual(convertie.acquis_choix, [{ source: 'capacites/tueur-fletrisseur', rang: 1, competence_id: 'arme-legere', valeur: null }]);
  assert.equal(convertie.notes, 'Mes notes\nMaîtrises d\'armes avant la refonte (2026-10-22) : ÉPÉES 3D10, ARC 2D8 ; arme choisie : Flétrisseur (Tueur) ÉPÉES');
  // une liste vide d'une page d'avant : rien à noter
  assert.deepEqual(sansPartiesRetirees({ nom: 'X', maitrises_armes: [] }, { instant: '2026-10-22T09:00:00Z', noms }), { nom: 'X' });
  // les notes enregistrées quand l'envoi n'a pas les siennes
  assert.equal(sansPartiesRetirees({ maitrises_armes: [{ arme_famille_id: 'arc', des: 2 }] }, { instant: '2026-10-22T09:00:00Z', noms, notes: 'Avant' }).notes,
    'Avant\nMaîtrises d\'armes avant la refonte (2026-10-22) : ARC 2D8');
  // avec les choix de maîtrise (page d'avant qui a repris une réponse) : jetés sans note (le service refuse avant : maitrisesAvecChoix)
  const avecChoix = sansPartiesRetirees({ ...recue, maitrise_choix: [] }, { instant: '2026-10-22T09:00:00Z', noms });
  assert.equal(avecChoix.notes, 'Mes notes');
  assert.ok(!('maitrises_armes' in avecChoix) && !('arme_famille_id' in avecChoix.acquis_choix[0]));
});

test('maitrisesAvecChoix : des maîtrises d’avant (dés ou arme choisie) ET `maitrise_choix` ; une liste vide, ou sans `maitrise_choix`, n’en est pas une', () => {
  assert.equal(maitrisesAvecChoix({ maitrises_armes: [{ arme_famille_id: 'arc', des: 2 }], maitrise_choix: [] }), true);
  assert.equal(maitrisesAvecChoix({ acquis_choix: [{ source: 's', rang: 1, competence_id: 'arc', arme_famille_id: 'arc' }], maitrise_choix: [] }), true);
  assert.equal(maitrisesAvecChoix({ maitrises_armes: [], acquis_choix: [{ source: 's', rang: 1, competence_id: 'arc', arme_famille_id: null }], maitrise_choix: [] }), false);
  assert.equal(maitrisesAvecChoix({ maitrises_armes: [{ arme_famille_id: 'arc', des: 2 }] }), false);
  assert.equal(maitrisesAvecChoix(null), false);
});

// Décision R167 (migration 0081) : une arme d'avant (un élément posé sur une arme du catalogue, l'amélioration de l'élément) prend la forme d'aujourd'hui.
// Les noms, les familles, les types et les niveaux sont ceux de la base (comme serveur/fiches.mjs et serveur/base-vivante.mjs les donnent).
const R167 = (() => {
  const db = new DatabaseSync(cheminBase({ sansExemples: false }), { readOnly: true });
  const un = (sql) => { const q = db.prepare(sql); return (x) => { const l = q.get(x); return l ? { ...l } : null; }; };
  const noms = {
    arme: un('SELECT a.nom, f.nom AS famille, f.type_elementaire_id FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE a.id = ?'),
    armeElementaire: un('SELECT nom, type_id FROM arme_elementaire WHERE id = ?'),
    ressource: (x) => un('SELECT nom FROM ressource WHERE id = ?')(x)?.nom ?? null,
    niveau: (x) => un('SELECT niveau FROM amelioration_equipement WHERE id = ?')(x)?.niveau ?? null,
    ameliorationDArme: un("SELECT id, bonus_cran FROM amelioration_equipement WHERE cible = 'arme' AND niveau = ?"),
    soliditeElementaire: db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").get().valeur,
  };
  const cran = (n) => db.prepare("SELECT bonus_cran FROM amelioration_equipement WHERE cible = 'arme' AND niveau = ?").get(n).bonus_cran ?? 0;
  return { noms, cran, nom: (t, id) => db.prepare(`SELECT nom FROM ${t} WHERE id = ?`).get(id).nom };
})();
const ARC = 'ressources/armes#arme:arc:arc';
const EPEE = 'ressources/armes#arme:epees:epee-longue';
const BANNIERE = 'ressources/armes#arme:baton-de-combat:banniere-de-combat';
const ARC_DE_SANG = 'ressources/pieces-elementaires#arme-elementaire:arc:sang';
const TITANE = 'ressources/armures#materiau:titane';
const elementDAvant = (n) => `ressources/pieces-elementaires#amelioration:arme-elementaire:${n}`;
const ameliorationDArme = (n) => `ressources/armes#amelioration:arme:${n}`;

test('armeDAvant (R167) : un élément du type de l’arme la transforme en arme élémentaire, au niveau de l’ancienne amélioration de l’élément, la durabilité bornée au nouveau maximum ; l’arme, son matériau et son amélioration notés', () => {
  const ligne = { rang: 1, arme_id: ARC, materiau_id: TITANE, amelioration_id: ameliorationDArme(3), arme_elementaire_id: ARC_DE_SANG, amelioration_elementaire_id: elementDAvant(5),
    effet_en_plus: 'Gravé', durabilite: 3 };
  assert.ok(armeDAvant0081(ligne));
  const c = armeDAvant(ligne, R167.noms);
  // « la ligne devient arme_id NULL, materiau_id NULL, arme_elementaire_id gardé, amelioration_id = ressources/armes#amelioration:arme:N »
  assert.deepEqual(c.ligne, { rang: 1, arme_id: null, materiau_id: null, amelioration_id: ameliorationDArme(5), arme_elementaire_id: ARC_DE_SANG, effet_en_plus: 'Gravé', durabilite: 3,
    type_degats_choisi: null });
  assert.deepEqual(c.retrait, { nature: 'arme_elementaire', cas: 'devenue', id: ARC, nom: R167.nom('arme', ARC), famille: 'ARC', rang: 1, element: R167.nom('arme_elementaire', ARC_DE_SANG),
    niveau_element: 5, niveau_garde: true, materiau: R167.nom('ressource', TITANE), amelioration: 3 });
  // la durabilité bornée à 4 + crans de la nouvelle ligne (R167 : « Solidité : 4 crans + les crans de la ligne d'amélioration choisie ») ; à ce maximum ou
  // au-delà, NULL (« NULL = à son maximum », R74)
  const max = R167.noms.soliditeElementaire + R167.cran(5);
  assert.equal(max, 5, '4 crans + 1 au +5 (exemple de R167 : « 5 au +5 »)');
  for (const [avant, apres] of [[max - 1, max - 1], [max, null], [max + 3, null], [0, 0], [null, null]]) {
    assert.equal(armeDAvant({ ...ligne, durabilite: avant }, R167.noms).ligne.durabilite, apres, `durabilité ${avant}`);
  }
  // sans amélioration de l'élément : aucun niveau ; le maximum, 4
  const sans = armeDAvant({ ...ligne, amelioration_elementaire_id: null, durabilite: 6 }, R167.noms);
  assert.deepEqual([sans.ligne.amelioration_id, sans.ligne.durabilite, sans.retrait.niveau_element], [null, null, null]);
  assert.equal(armeDAvant({ ...ligne, amelioration_elementaire_id: null, durabilite: 3 }, R167.noms).ligne.durabilite, 3);
  // les types mixtes suivent la famille sous laquelle l'arme est listée (R167 : « Bannière de combat sous Bâton de combat → Bâton de X »)
  const baton = armeDAvant({ rang: 2, arme_id: BANNIERE, arme_elementaire_id: 'ressources/pieces-elementaires#arme-elementaire:baton-de-combat:sang' }, R167.noms);
  assert.equal(baton.retrait.cas, 'devenue');
  assert.equal(baton.ligne.arme_id, null);
  // la ligne de retrait, datée
  assert.equal(ligneDeRetrait(c.retrait, '2026-10-23T09:00:00Z'), `[23/10/2026] Retrait (règles modifiées) : l’arme « ${R167.nom('arme', ARC)} » (ARC, arme 1, matériau « ${R167.nom('ressource', TITANE)} », amélioration +3) est devenue l’arme élémentaire « ${R167.nom('arme_elementaire', ARC_DE_SANG)} », avec l’amélioration +5 de son élément : une pièce élémentaire transforme l’arme, qui perd toutes ses caractéristiques d’avant. Adaptez la fiche.`);
});

test('armeDAvant (R167) : un élément d’un autre type est retiré avec son amélioration, l’arme garde matériau, amélioration et durabilité ; une amélioration d’élément sans élément est retirée ; chaque perte notée', () => {
  const ligne = { rang: 1, arme_id: EPEE, materiau_id: TITANE, amelioration_id: ameliorationDArme(3), arme_elementaire_id: ARC_DE_SANG, amelioration_elementaire_id: elementDAvant(2), durabilite: 1 };
  const autre = armeDAvant(ligne, R167.noms);
  assert.deepEqual(autre.ligne, { rang: 1, arme_id: EPEE, materiau_id: TITANE, amelioration_id: ameliorationDArme(3), arme_elementaire_id: null, durabilite: 1, type_degats_choisi: null });
  assert.deepEqual(autre.retrait, { nature: 'arme_elementaire', cas: 'autre_type', id: EPEE, nom: R167.nom('arme', EPEE), famille: 'ÉPÉES', rang: 1,
    element: R167.nom('arme_elementaire', ARC_DE_SANG), niveau_element: 2 });
  // l'amélioration de l'élément sans élément
  const seule = armeDAvant({ rang: 2, arme_id: EPEE, materiau_id: null, amelioration_id: null, arme_elementaire_id: null, amelioration_elementaire_id: elementDAvant(4) }, R167.noms);
  assert.deepEqual(seule.ligne, { rang: 2, arme_id: EPEE, materiau_id: null, amelioration_id: null, arme_elementaire_id: null });
  assert.deepEqual(seule.retrait, { nature: 'arme_elementaire', cas: 'amelioration_seule', id: EPEE, nom: R167.nom('arme', EPEE), famille: 'ÉPÉES', rang: 2, niveau_element: 4 });
  // la clé vide d'une page d'avant : rien ne se perd, rien n'est noté
  assert.deepEqual(armeDAvant({ rang: 1, arme_id: EPEE, amelioration_elementaire_id: null }, R167.noms), { ligne: { rang: 1, arme_id: EPEE }, retrait: null });
  // une arme d'aujourd'hui n'est pas d'avant
  assert.equal(armeDAvant0081({ rang: 1, arme_id: null, arme_elementaire_id: ARC_DE_SANG, amelioration_id: ameliorationDArme(2) }), false);
  assert.equal(armeDAvant0081({ rang: 1, arme_id: EPEE, materiau_id: TITANE }), false);
  // sans les noms (type inconnu) : rien n'est deviné, l'élément part comme d'un autre type, noté sous les identifiants ; le niveau lu dans l'identifiant
  const inconnue = armeDAvant({ rang: 1, arme_id: ARC, arme_elementaire_id: ARC_DE_SANG, amelioration_elementaire_id: elementDAvant(3) });
  assert.deepEqual(inconnue.retrait, { nature: 'arme_elementaire', cas: 'autre_type', id: ARC, nom: null, famille: null, rang: 1, element: ARC_DE_SANG, niveau_element: 3 });
  assert.equal(inconnue.ligne.arme_id, ARC);
});

test('sansPartiesRetirees (R167) : les armes d’avant d’une fiche reçue (JSON exporté, page restée ouverte) prennent la forme d’aujourd’hui, une ligne datée par perte à la fin des notes ; sans arme d’avant, la fiche telle quelle', () => {
  const fiche = {
    nom: 'Essai', notes: 'Mes notes',
    armes: [
      { rang: 1, arme_id: ARC, materiau_id: TITANE, amelioration_id: null, arme_elementaire_id: ARC_DE_SANG, amelioration_elementaire_id: elementDAvant(2), effet_en_plus: null, durabilite: null },
      { rang: 2, arme_id: EPEE, materiau_id: null, amelioration_id: ameliorationDArme(1), arme_elementaire_id: null, amelioration_elementaire_id: elementDAvant(1), effet_en_plus: null, durabilite: 2 },
    ],
  };
  const lue = sansPartiesRetirees(fiche, { instant: '2026-10-23T09:00:00Z', noms: R167.noms });
  assert.deepEqual(lue.armes, [
    { rang: 1, arme_id: null, materiau_id: null, amelioration_id: ameliorationDArme(2), arme_elementaire_id: ARC_DE_SANG, effet_en_plus: null, durabilite: null, type_degats_choisi: null },
    { rang: 2, arme_id: EPEE, materiau_id: null, amelioration_id: ameliorationDArme(1), arme_elementaire_id: null, effet_en_plus: null, durabilite: 2 },
  ]);
  const lignes = lue.notes.split('\n');
  assert.equal(lignes[0], 'Mes notes');
  assert.equal(lignes.length, 3);
  assert.ok(lignes[1].startsWith('[23/10/2026] Retrait (règles modifiées) : l’arme « ') && lignes[1].includes('est devenue l’arme élémentaire'));
  assert.ok(lignes[2].startsWith('[23/10/2026] Retrait (règles modifiées) : l’amélioration de l’élément +1 de l’arme « '));
  assert.equal(fiche.armes[0].arme_id, ARC, 'jamais modifiée en place');
  // armesDAvant : rien à convertir, null ; une fiche d'aujourd'hui, le même objet
  assert.equal(armesDAvant(lue.armes, R167.noms), null);
  const aJour = { nom: 'Aujourd’hui', armes: lue.armes };
  assert.equal(sansPartiesRetirees(aJour, { instant: '2026-10-23T09:00:00Z', noms: R167.noms }), aJour);
  // la colonne retirée
  assert.deepEqual(COLONNES_RETIREES.personnage_arme, ['amelioration_elementaire_id']);
});
