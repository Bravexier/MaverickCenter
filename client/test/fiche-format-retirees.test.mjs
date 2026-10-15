// Tables que les règles ont retirées de la section 13 (lib/fiche-format.mjs : TABLES_RETIREES, PARTIES_RETIREES) : la progression niveau par niveau
// (personnage_progression, migration 0045) devient deux totaux, gains_sante et gains_chakra (décision R73). Une fiche qui porte encore sa clé (page
// restée ouverte, fichier exporté avant) est convertie sans rien perdre (sansPartiesRetirees : service et page /fiche/) ; la base vivante fait la même
// somme en SQL (serveur/base-vivante.mjs, test/serveur-base-vivante.test.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PARTIES_DE_FICHE, PARTIES_RETIREES, TABLES_FICHES, TABLES_RETIREES, ficheVide, gainsDeLaProgression, sansPartiesRetirees } from '../src/lib/fiche-format.mjs';

test('tables retirées : progression (migration 0045), ni table des fiches ni partie ; PARTIES_RETIREES en est l’inverse', () => {
  assert.deepEqual(TABLES_RETIREES, { personnage_progression: 'progression' });
  assert.deepEqual(PARTIES_RETIREES, { progression: 'personnage_progression' });
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

test('sansPartiesRetirees : une `progression` sans gains devient les deux totaux ; avec eux, ils font foi ; sans clé retirée, la fiche telle quelle ; jamais modifiée en place', () => {
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
