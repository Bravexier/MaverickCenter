// La page « Mise à jour » (lib/conflits-rendu.mjs#htmlDuLot) pour un lot dont les règles en conflit suivent leur don (issue `suit_le_don`,
// serveur/edition-conflits.mjs#suiventLeDon : une règle en données d'un don que le lot supprime aussi n'a pas de choix à elle) : sans conflit à trancher,
// la page ne dit pas « 0 conflit : choisissez pour chacun » mais qu'il n'y a aucun choix à faire, montre les modifications du lot dépliées, et chaque
// règle qui suit son don le nomme. Rendu pur (aucune base) : les libellés sont ceux que le test donne.
//   node --test test/conflits-suit-le-don.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlDuLot, ISSUES_SAINES, issueDeLaSaine } from '../src/lib/conflits-rendu.mjs';

const DON = 'Don de classe « Essai »';
const suit = { rang: 2, table: 'capacite_variable', cle: { capacite_id: 'capacites/essai' }, operation: 'modifier', issue: 'suit_le_don', libelle: 'Règle « Essai »', don: DON };
const supprime = { rang: 1, table: 'capacite', cle: { id: 'capacites/essai' }, operation: 'supprimer', issue: 'reappliquee', libelle: DON };
const lot = (conflits) => ({ lot: 'lot-essai', fait_le: '2026-11-01T10:00:00Z', resume: 'Essai', empreinte: 'e', saines: [supprime, suit], conflits });
const conflit = { id: '1:nom', rang: 1, table: 'capacite', cle: { id: 'x' }, operation: 'modifier', libelle: 'Don « X »', genre: 'champ', colonne: 'nom', colonne_libelle: 'Nom',
  version_1: { genre: 'valeur', valeur: 'A' }, version_2: { genre: 'valeur', valeur: 'B' }, choix_possibles: [1, 2] };
const texte = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('un lot sans conflit à trancher (ses règles suivent leur don) : aucun « 0 conflit », aucun choix demandé, ses modifications dépliées', () => {
  const html = htmlDuLot(lot([]));
  assert.doesNotMatch(texte(html), /\b0 conflit/);
  assert.doesNotMatch(texte(html), /choisissez pour chacun/);
  assert.match(texte(html), /Aucun choix à faire : chaque règle en conflit suit son don/);
  assert.match(html, /<details class="nv-conflit-lot__saines" open>/);
  assert.match(html, /<button type="submit"[^>]*>Résoudre ce lot<\/button>/, 'le lot se résout toujours (corps sans choix)');
  assert.ok(texte(html).includes(`suit son don (${DON})`), 'la règle nomme son don');
});

test('un lot avec des conflits : la consigne de toujours, modifications repliées', () => {
  const html = htmlDuLot(lot([conflit]));
  assert.match(texte(html), /1 conflit : choisissez pour chacun/);
  assert.match(html, /<details class="nv-conflit-lot__saines">/);
});

test('issueDeLaSaine : le libellé de l’issue, le don nommé quand le service le donne', () => {
  assert.equal(issueDeLaSaine({ issue: 'reappliquee' }), ISSUES_SAINES.reappliquee);
  assert.equal(issueDeLaSaine({ issue: 'suit_le_don' }), ISSUES_SAINES.suit_le_don);
  assert.match(issueDeLaSaine(suit), /^suit son don \(Don de classe « Essai »\) : retirée avec lui, gardée s’il reste$/);
  assert.equal(issueDeLaSaine({ issue: 'inconnue' }), 'inconnue', 'une issue sans libellé se montre telle quelle');
});
