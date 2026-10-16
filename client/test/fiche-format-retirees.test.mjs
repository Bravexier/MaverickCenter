// Tables que les règles ont retirées de la section 13 (lib/fiche-format.mjs : TABLES_RETIREES, PARTIES_RETIREES) : la progression niveau par niveau
// (personnage_progression, migration 0045) devient deux totaux, gains_sante et gains_chakra (décision R73). Une fiche qui porte encore sa clé (page
// restée ouverte, fichier exporté avant) est convertie sans rien perdre (sansPartiesRetirees : service et page /fiche/) ; la base vivante fait la même
// somme en SQL (serveur/base-vivante.mjs, test/serveur-base-vivante.test.mjs). Une progression non vide envoyée avec les deux totaux ne se concilie pas
// avec eux (progressionAvecGains) : le service la refuse (test/serveur-api.test.mjs). De même l'armure par emplacement (personnage_armure, migration
// 0055) devient une seule armure complète (décision R95 : armureDesArmures), chaque autre pièce notée, datée, dans la fiche (lignesDesPiecesRetirees) ;
// envoyée avec les nouvelles clés de l'armure, elle est refusée par le service (armuresAvecArmure).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { cheminBase } from '../src/lib/donnees.mjs';
import {
  ARMURE_ENTIERE, armureDesArmures, armuresAvecArmure, COLONNES_DE_L_ARMURE, EMPLACEMENTS_D_ARMURE, PARTIES_DE_FICHE, PARTIES_RETIREES, TABLES_FICHES,
  TABLES_RETIREES, ficheVide, gainsDeLaProgression, lignesDesPiecesRetirees, progressionAvecGains, sansPartiesRetirees,
} from '../src/lib/fiche-format.mjs';

test('tables retirées : progression (migration 0045), armures (0055), ni table des fiches ni partie ; PARTIES_RETIREES en est l’inverse', () => {
  assert.deepEqual(TABLES_RETIREES, { personnage_progression: 'progression', personnage_armure: 'armures' });
  assert.deepEqual(PARTIES_RETIREES, { progression: 'personnage_progression', armures: 'personnage_armure' });
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
