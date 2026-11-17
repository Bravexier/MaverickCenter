// Le script du sous-onglet « Bâtons magiques » de la page Ceinture, /ressources/objets-a-la-ceinture/ (src/scripts/batons.mjs), exécuté dans un faux
// navigateur : le curseur d'une ligne pose son niveau sur la ligne (`data-niveau`, que le CSS lit pour n'afficher que la qualité, l'effet et le prix de ce niveau), le chiffre à côté
// et le texte lu par un lecteur d'écran suivent ; les autres lignes ne bougent pas ; un niveau remis par le navigateur (retour arrière) est appliqué au
// chargement.
//   node --test test/batons-script.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { el, fauxDocument } from './aide-faux-dom.mjs';

let numero = 0;

/** Une ligne réduite à ce que le script lit : son curseur (à `valeur`) et le chiffre du niveau. */
function ligne(id, valeur = '1') {
  const curseur = el('input', { type: 'range', min: '1', max: '3', 'data-baton-curseur': '', 'aria-valuetext': 'Niveau 1' });
  curseur.value = valeur;
  const chiffre = el('output', { 'data-baton-niveau': '' });
  chiffre.textContent = '1';
  return { tr: el('tr', { class: 'baton', id, 'data-niveau': '1' }, el('td', {}, el('span', {}, curseur, chiffre))), curseur, chiffre };
}

async function charger(...lignes) {
  const document = fauxDocument(el('section', { 'data-batons': '' }, el('table', {}, el('tbody', {}, ...lignes.map((l) => l.tr)))));
  globalThis.document = document;
  await import(`../src/scripts/batons.mjs?page=${(numero += 1)}`);
}

const glisser = (l, valeur) => {
  l.curseur.value = valeur;
  l.curseur.dispatchEvent(new Event('input'));
};

test('le curseur d’une ligne pose son niveau sur la ligne ; le chiffre et le texte du lecteur d’écran suivent ; les autres lignes ne bougent pas', async () => {
  const feu = ligne('baton-magie-du-feu');
  const eau = ligne('baton-magie-de-leau');
  await charger(feu, eau);
  glisser(feu, '3');
  assert.equal(feu.tr.dataset.niveau, '3');
  assert.equal(feu.chiffre.textContent, '3');
  assert.equal(feu.curseur.getAttribute('aria-valuetext'), 'Niveau 3');
  assert.equal(eau.tr.dataset.niveau, '1', 'chaque ligne a son niveau');
  glisser(feu, '2');
  assert.equal(feu.tr.dataset.niveau, '2');
  assert.equal(feu.chiffre.textContent, '2');
});

test('un niveau remis par le navigateur dans un curseur (retour arrière) est appliqué au chargement', async () => {
  const vent = ligne('baton-magie-du-vent', '2');
  await charger(vent);
  assert.equal(vent.tr.dataset.niveau, '2');
  assert.equal(vent.chiffre.textContent, '2');
  assert.equal(vent.curseur.getAttribute('aria-valuetext'), 'Niveau 2');
});

test('sans onglet des bâtons, le script ne fait rien', async () => {
  globalThis.document = fauxDocument(el('div', {}));
  await import(`../src/scripts/batons.mjs?page=${(numero += 1)}`);
});
