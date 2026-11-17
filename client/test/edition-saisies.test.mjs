// La barre d'outils des saisies (src/scripts/edition/saisies.mjs) : en mode modification, une barre au-dessus du crayon sur toute page où il apparaît
// (demande du propriétaire du 2026-11-13 : « Partout où il y a le crayon »), qui agit sur la saisie de texte où est le curseur ; ses outils écrivent
// la balise d'un mot-clé comme l'éditeur en place (texte-en-place.mjs : baliseAuCurseur, baliseDuMotCle, texteDeLaBalise).
//   node --test test/edition-saisies.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attributEd, CHAMPS_DE_TEXTE, TABLES } from '../src/lib/edition-modele.mjs';
import { el, fauxDocument } from './aide-faux-dom.mjs';

globalThis.document ??= fauxDocument();
const { baliseAuCurseur, baliseDuMotCle, texteDeLaBalise } = await import('../src/scripts/edition/texte-en-place.mjs');
const { saisieDeTexte, saisies } = await import('../src/scripts/edition/saisies.mjs');

/** La première colonne de TABLES d'un type qui convient : [table, colonne]. */
function colonneDuType(convient) {
  for (const [table, t] of Object.entries(TABLES)) for (const [colonne, champ] of Object.entries(t.colonnes)) if (convient(champ.type)) return [table, colonne];
  return null;
}
/** Une saisie de l'éditeur (editeur.mjs#controleDe) dans son champ data-ed. */
const saisieDans = (table, colonne, tag = 'textarea') => {
  const s = el(tag, { class: 'ed-saisie' });
  el('span', { 'data-ed': attributEd(table, { id: 1 }, colonne) }, s);
  return s;
};

test('la balise autour du curseur ou du texte choisi', () => {
  const t = 'Voir {{non-mort|les morts}} et {{mordhau}}.';
  const b = t.indexOf('{{non-mort');
  const fin = t.indexOf('}}') + 2;
  assert.equal(baliseAuCurseur(t, b + 3)?.debut, b);
  assert.equal(baliseAuCurseur(t, b + 3)?.fin, fin);
  // juste avant « {{ » ou juste après « }} » : à côté, pas dedans
  assert.equal(baliseAuCurseur(t, b), null);
  assert.equal(baliseAuCurseur(t, fin), null);
  // la balise entière choisie : elle ; un choix qui en déborde : aucune
  assert.equal(baliseAuCurseur(t, b, fin)?.debut, b);
  assert.equal(baliseAuCurseur(t, 0, fin), null);
  assert.equal(baliseAuCurseur('sans balise', 3), null);
});

test('la balise écrite pour un mot-clé : par sa clé, le texte choisi gardé s’il n’est pas son libellé', () => {
  const m = { cle: 'non-mort', libelle: 'Non-mort' };
  assert.equal(baliseDuMotCle(m, null), '{{non-mort}}');
  assert.equal(baliseDuMotCle(m, m.libelle), '{{non-mort}}');
  assert.equal(baliseDuMotCle(m, 'les morts'), '{{non-mort|les morts}}');
  assert.equal(texteDeLaBalise('  les {morts}\n  revenus '), 'les morts revenus');
  assert.equal(texteDeLaBalise('{}\n'), null);
});

test('la barre agit sur la saisie d’un champ de texte (CHAMPS_DE_TEXTE), et sait si c’est un texte mis en forme', () => {
  const markdown = colonneDuType((t) => t === 'markdown');
  const court = colonneDuType((t) => CHAMPS_DE_TEXTE.includes(t) && t !== 'markdown');
  const autre = colonneDuType((t) => !CHAMPS_DE_TEXTE.includes(t));
  assert.ok(markdown && court && autre);
  assert.equal(saisieDeTexte(saisieDans(...markdown))?.genre, 'markdown');
  assert.equal(saisieDeTexte(saisieDans(...court, 'input'))?.genre, 'texte');
  // un nombre, un choix, une couleur : rien
  assert.equal(saisieDeTexte(saisieDans(...autre)), null);
  // une saisie propre à une extension (hors champ data-ed), désactivée, ou rien : rien
  assert.equal(saisieDeTexte(el('input', { class: 'ed-saisie' })), null);
  const desactivee = saisieDans(...markdown);
  desactivee.disabled = true;
  assert.equal(saisieDeTexte(desactivee), null);
  assert.equal(saisieDeTexte(null), null);
  assert.equal(saisieDeTexte(el('span', { 'data-ed': attributEd(markdown[0], { id: 1 }, markdown[1]) })), null);
});

test('la barre des saisies est de toute page où est le crayon', () => {
  assert.equal(saisies.actif(fauxDocument()), true);
  assert.equal(typeof saisies.debut, 'function');
  assert.equal(typeof saisies.fin, 'function');
});
