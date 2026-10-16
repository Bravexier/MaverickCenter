// Couleurs des lignes de l'onglet « Ceinture » (lib/ceinture-couleurs.mjs ; demande du propriétaire du 2026-10-16 : « récupérer les couleurs utilisées
// dans les tableaux du GoogleSheet pour les lignes présentes ») : une entrée par potion de la base (la couleur de son palier dans le Doc « Alchimie »,
// ou null quand le Doc ne la colore pas), une par magie des bâtons (la case de la magie dans l'onglet « Bâton magique ») ; le rendu d'une ligne
// colorée (le texte que la source pose, sinon le plus lisible), et d'une ligne sans couleur. Les potions ne se modifient pas encore sur le site de dev :
// la base est celle de l'import (une potion créée plus tard n'aurait pas d'entrée, et sa ligne resterait neutre).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { COULEURS_DES_BATONS, COULEURS_DES_POTIONS, couleurDePotion, couleurDesBatons } from '../src/lib/ceinture-couleurs.mjs';
import { couleursDeLaLigne, htmlDeLigneDePotion } from '../src/lib/ceinture-rendu.mjs';
import { couleursDesBatons, htmlDeLigneDeBatons } from '../src/lib/batons-rendu.mjs';
import { chargerBatons } from '../src/lib/batons-db.mjs';
import { couleurDeMagie, texteSurCouleur } from '../src/lib/sort-format.mjs';

const db = ouvrirBase();
const HEX = /^#[0-9a-f]{6}$/;
const valide = (c) => c === null || (HEX.test(c.fond) && (c.texte === undefined || HEX.test(c.texte)) && Object.keys(c).every((k) => ['fond', 'texte'].includes(k)));

test('une couleur (ou null) par potion de la base, et rien d’autre', () => {
  const potions = db.prepare('SELECT ressource_id FROM potion').all().map((p) => p.ressource_id).sort();
  assert.deepEqual(Object.keys(COULEURS_DES_POTIONS).sort(), potions);
  for (const [id, c] of Object.entries(COULEURS_DES_POTIONS)) assert.ok(valide(c), `${id} : ${JSON.stringify(c)}`);
  // le Doc colore tous les paliers, sauf ceux du Remède enragé et de l'Huile rage
  const sans = Object.entries(COULEURS_DES_POTIONS).filter(([, c]) => c === null).map(([id]) => id.slice(0, id.indexOf('#')));
  assert.deepEqual([...new Set(sans)].sort(), ['ressources/huile-rage', 'ressources/remede-enrage']);
  assert.equal(couleurDePotion('ressources/fiole-rouge#potion:petite-fiole-rouge').fond, '#f4cccc', 'la petite fiole rouge, dans le Doc');
  assert.equal(couleurDePotion('ressources/inconnue#potion:x'), null);
});

test('une couleur par magie des bâtons ; la ligne d’une magie absente de l’onglet garde la couleur de la magie sur le site', () => {
  const magies = db.prepare('SELECT DISTINCT magie_id FROM baton_magique').all().map((b) => b.magie_id).sort();
  assert.deepEqual(Object.keys(COULEURS_DES_BATONS).sort(), magies);
  for (const [id, c] of Object.entries(COULEURS_DES_BATONS)) assert.ok(c && valide(c), id);
  assert.deepEqual(couleurDesBatons('magies/magie-de-la-corruption'), { fond: '#000000', texte: '#ffffff' });
  assert.equal(couleurDesBatons('magies/potentiel-illimite'), null, 'pas de bâton du Potentiel Illimité');
  assert.deepEqual(couleursDesBatons({ id: 'magies/inconnue', nom: 'Feu' }), { fond: couleurDeMagie('Feu'), texte: texteSurCouleur(couleurDeMagie('Feu')) });
  const batons = chargerBatons(db);
  const m = batons.magies.find((x) => x.magie.id === 'magies/magie-du-sang');
  assert.ok(htmlDeLigneDeBatons(m, batons.niveaux, '/ressources/composants/').startsWith('<tr class="baton" id="baton-magie-du-sang" data-niveau="1" style="--mag: #980000; --mag-texte: #ffffff">'),
    'Sang : la case de la magie (#980000), le texte le plus lisible (le classeur n’en pose pas)');
});

test('rendu : le texte que la source pose, sinon le plus lisible sur le fond ; une ligne sans couleur reste neutre', () => {
  assert.deepEqual(couleursDeLaLigne({ fond: '#a61c00', texte: '#ffffff' }), { fond: '#a61c00', texte: '#ffffff' });
  assert.deepEqual(couleursDeLaLigne({ fond: '#f4cccc' }), { fond: '#f4cccc', texte: texteSurCouleur('#f4cccc') });
  assert.equal(couleursDeLaLigne(null), null);
  const p = { id: 'ressources/fiole-rouge#potion:petite-fiole-rouge', nom: 'Petite fiole rouge', niveau: 'Novice', prix_brut: '2 Ro', effet: 'Récupère 2d8 + 5 santé' };
  assert.ok(htmlDeLigneDePotion({ ...p, couleur: { fond: '#f4cccc' } }).startsWith(
    `<tr class="ceint-ligne ceint-ligne--couleur" id="objet-potion-petite-fiole-rouge" style="--ceint-fond: #f4cccc; --ceint-texte: ${texteSurCouleur('#f4cccc')}">`));
  assert.ok(htmlDeLigneDePotion({ ...p, couleur: null }).startsWith('<tr class="ceint-ligne" id="objet-potion-petite-fiole-rouge">'));
});
