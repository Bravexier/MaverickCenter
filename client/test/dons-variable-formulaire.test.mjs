// La « Magie liée » d'un don « Variable » dans les formulaires de l'éditeur (décision R181 ; réponses du propriétaire « Demander la magie » à la
// création, « Demander ou retirer », R192 au changement de type : « Passer à « Variable » demande la magie (innée ou acquise) ; quitter « Variable » retire
// le lien à la magie. ») : lib/dons-edition.mjs#champDeLaMagieDuDon (affichée, exigée, envoyée) et #avecLaMagieDuDon (l'opération « modifier » du don),
// lus par src/scripts/edition/classes.mjs ; le service décide (test/serveur-edition-don-variable.test.mjs).
//   node --test test/dons-variable-formulaire.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyserTypeDeDon } from '../src/lib/classe-champs.mjs';
import { avecLaMagieDuDon, champDeLaMagieDuDon, TYPES_DE_DON_SAISIE } from '../src/lib/dons-edition.mjs';
import { CHAMPS_HORS_COLONNES, ENTITES, MAGIES_D_UN_DON_VARIABLE } from '../src/lib/edition-modele.mjs';

const [INNEE, ACQUISE] = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur);
const estVariable = (type) => analyserTypeDeDon(type).type === 'variable';

test('R181 : seul le type « Variable » (choisi ou saisi avec sa précision) montre la magie', () => {
  assert.deepEqual(TYPES_DE_DON_SAISIE.filter((t) => estVariable(t.valeur)).map((t) => t.valeur), ['Variable']);
  assert.ok(estVariable('Variable (1 fois/combat)'), 'la précision ne change pas le type');
  for (const t of TYPES_DE_DON_SAISIE.filter((x) => !estVariable(x.valeur))) {
    assert.deepEqual(champDeLaMagieDuDon({ variable: false, magie: INNEE }), { visible: false, requis: false, envoyer: null, erreur: null }, t.valeur);
  }
});

test('R181, création (« Demander la magie ») : exigée pour un don « Variable », envoyée telle que choisie', () => {
  const sans = champDeLaMagieDuDon({ variable: true, magie: '' });
  assert.equal(sans.visible, true);
  assert.equal(sans.requis, true);
  assert.equal(sans.envoyer, null);
  assert.match(sans.erreur, /R181/);
  for (const m of [INNEE, ACQUISE]) assert.deepEqual(champDeLaMagieDuDon({ variable: true, magie: m }), { visible: true, requis: true, envoyer: m, erreur: null });
  // un type changé après le choix (« Variable » puis « Passif ») : la magie n'est plus envoyée
  assert.equal(champDeLaMagieDuDon({ variable: false, magie: ACQUISE }).envoyer, null);
});

test('R181, changement de type (« Demander ou retirer », R192) : exigée quand le don y passe, rien à envoyer quand il le quitte', () => {
  // passer à « Variable » sans magie : refusé avant l'envoi (le service rendrait 400)
  assert.match(champDeLaMagieDuDon({ variable: true, etaitVariable: false, magie: '' }).erreur, /R181/);
  assert.equal(champDeLaMagieDuDon({ variable: true, etaitVariable: false, magie: INNEE }).envoyer, INNEE);
  // quitter « Variable » : le champ part, rien n'est envoyé (le service retire la ligne capacite_variable)
  assert.deepEqual(champDeLaMagieDuDon({ variable: false, etaitVariable: true, magie: INNEE, actuelle: INNEE }), { visible: false, requis: false, envoyer: null, erreur: null });
  // un don déjà « Variable » : sa magie se garde sans choix, se change par un autre choix ; le même choix n'envoie rien
  assert.deepEqual(champDeLaMagieDuDon({ variable: true, etaitVariable: true, magie: '' }), { visible: true, requis: false, envoyer: null, erreur: null });
  assert.equal(champDeLaMagieDuDon({ variable: true, etaitVariable: true, magie: ACQUISE, actuelle: INNEE }).envoyer, ACQUISE);
  assert.equal(champDeLaMagieDuDon({ variable: true, etaitVariable: true, magie: INNEE, actuelle: INNEE }).envoyer, null);
  // magie actuelle inconnue (l'état de la classe ne la donne pas) : un choix part
  assert.equal(champDeLaMagieDuDon({ variable: true, etaitVariable: true, magie: INNEE, actuelle: null }).envoyer, INNEE);
});

test('avecLaMagieDuDon : la magie rejoint l’opération « modifier » du don (type_brut), ou en fait une à elle seule', () => {
  const id = 'capacites/essai';
  const type = { op: 'modifier', table: 'capacite', cle: { id }, valeurs: { type_brut: 'Variable' }, avant: { type_brut: 'Passif' } };
  const autre = { op: 'modifier', table: 'capacite', cle: { id: 'capacites/autre' }, valeurs: { nom: 'x' } };
  assert.deepEqual(avecLaMagieDuDon([type, autre], id, INNEE), [{ ...type, valeurs: { type_brut: 'Variable', magie: INNEE } }, autre]);
  assert.deepEqual(avecLaMagieDuDon([autre], id, ACQUISE), [autre, { op: 'modifier', table: 'capacite', cle: { id }, valeurs: { magie: ACQUISE } }]);
  assert.deepEqual(avecLaMagieDuDon([type], id, null), [type], 'rien à envoyer : les opérations telles quelles');
  assert.deepEqual(type.valeurs, { type_brut: 'Variable' }, 'l’opération reçue n’est pas modifiée');
});

test('le modèle : la même « Magie liée » (innée ou acquise) à la création d’un don, d’une spécialité et à la modification, jamais obligatoire d’office', () => {
  const champs = [ENTITES.capacite.champs.magie, ENTITES.specialite.champs.don_magie, CHAMPS_HORS_COLONNES.capacite.magie];
  for (const c of champs) {
    assert.equal(c.type, 'choix');
    assert.deepEqual(c.choix, MAGIES_D_UN_DON_VARIABLE);
    assert.ok(!c.requis, 'exigée selon le type seulement (champDeLaMagieDuDon)');
  }
  assert.deepEqual(MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur), ['innee', 'acquise'], 'CHECK de capacite_variable.magie');
  // les noms de champs que lit src/scripts/edition/classes.mjs (CHAMPS_DU_DON_VARIABLE)
  assert.ok('type' in ENTITES.capacite.champs && 'don_type' in ENTITES.specialite.champs);
});
