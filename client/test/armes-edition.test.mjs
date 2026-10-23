// L'extension de l'éditeur pour l'onglet Armes (src/scripts/edition/armes.mjs), exécutée dans un faux navigateur (test/aide-faux-dom.mjs) avec un faux
// éditeur, sur les deux menus à onglets de l'onglet (demande du propriétaire, 2026-10-23 : components/armes/ArmesPage.astro) : une arme ajoutée puis
// retirée (surcouche) refait le compte du tableau de sa famille et celui de son onglet (`[data-armes-onglet-compte]`) ; une arme créée (« + Ajouter une
// arme ») s'ajoute à la fin du tableau de sa famille, qui reçoit « onglets:ouvrir » (components/Onglets.astro l'écoute sur le document ; le faux
// navigateur ne fait pas remonter les évènements : il s'écoute ici sur la famille). Les lignes sont celles de la base (lib/armes-rendu.mjs#htmlDeLigneDArme).
//   node --test test/armes-edition.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contexteDesArmes, chargerArmes } from '../src/lib/armes-db.mjs';
import { htmlDeLigneDArme } from '../src/lib/armes-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const db = ouvrirBase();
const contexte = contexteDesArmes(db);
const { familles } = chargerArmes(db);
// une famille de deux armes au moins : la première est sur la page, la seconde est « créée »
const famille = familles.find((f) => f.armes.length >= 2);
const [presente, nouvelle] = famille.armes;
let numero = 0;

/** La page : le menu de la famille (son onglet, son tableau avec une arme), les outils ; rend la famille, son onglet et l'extension. */
async function charger() {
  const tbody = el('tbody', {});
  tbody.insertAdjacentHTML('beforeend', htmlDeLigneDArme(presente, contexte));
  const panneau = el('section', { class: 'tableau armes-famille is-active', id: `famille-${famille.id}` },
    el('h4', { class: 'armes-famille__titre' }, el('span', { class: 'armes-famille__compte' }, '1 arme')), el('table', {}, tbody));
  const onglet = el('a', { class: 'onglet is-active', id: `onglet-famille-${famille.id}`, href: `#famille-${famille.id}` },
    el('span', { class: 'onglet__detail', 'data-armes-onglet-compte': '' }, '1 arme'));
  const racine = el('div', { class: 'armes', 'data-armes': '' },
    el('div', { class: 'armes-vue' }, el('div', { class: 'armes-tableaux' },
      el('section', { class: 'armes-bloc', 'data-armes-bloc': famille.categorie }, el('nav', { class: 'armes-onglets', 'data-onglets': '' }, onglet), panneau))));
  Object.assign(globalThis, { document: fauxDocument(racine), Element, CSS: { escape: (t) => String(t).replace(/["\\]/g, '\\$&') } });
  const ouvertures = [];
  panneau.addEventListener('onglets:ouvrir', () => ouvertures.push(panneau.id));
  const { armes: extension } = await import(`../src/scripts/edition/armes.mjs?page=${(numero += 1)}`);
  const comptes = () => [panneau.querySelector('.armes-famille__compte').textContent, onglet.querySelector('[data-armes-onglet-compte]').textContent];
  return { panneau, onglet, extension, ouvertures, comptes, racine };
}

/** Un faux éditeur : ses listes, et la création renvoyée par le service (`ligne` : l'arme créée). */
function fauxEditeur(ligne) {
  const ed = {
    listes: contexte, page: 'ressources/armes', enEdition: false, lignes: new Map(), annonces: [],
    formulaire: (f) => { ed.dernierFormulaire = f; },
    appel: async () => ({ lignes: [{ table: 'arme', cle: { id: ligne.id }, ligne }] }),
    annoncer: (t) => ed.annonces.push(t),
  };
  return ed;
}

test('une arme ajoutée puis retirée (surcouche) : le compte du tableau et celui de son onglet suivent', async () => {
  const p = await charger();
  const ed = fauxEditeur(nouvelle);
  p.extension.surcouche(ed, [{ table: 'arme', cle: { id: nouvelle.id }, ligne: nouvelle }]);
  assert.equal(p.panneau.querySelectorAll('tbody tr.arme').length, 2);
  assert.deepEqual(p.comptes(), ['2 armes', '2 armes']);
  p.extension.surcouche(ed, [{ table: 'arme', cle: { id: presente.id }, ligne: null }]);
  assert.equal(p.panneau.querySelectorAll('tbody tr.arme').length, 1);
  assert.deepEqual(p.comptes(), ['1 arme', '1 arme']);
  // la surcouche n'ouvre pas d'onglet (lignes en attente au chargement)
  assert.deepEqual(p.ouvertures, []);
});

test('une arme créée (« + Ajouter une arme ») : à la fin du tableau de sa famille, l’onglet de sa famille s’ouvre, les comptes suivent', async () => {
  const p = await charger();
  const ed = fauxEditeur(nouvelle);
  p.extension.debut(ed);
  const bouton = p.racine.querySelectorAll('.ed-outils-armes button').find((b) => b.textContent === '+ Ajouter une arme');
  assert.ok(bouton, 'le bouton « + Ajouter une arme »');
  cliquer(bouton);
  assert.equal(ed.dernierFormulaire?.titre, 'Nouvelle arme');
  await ed.dernierFormulaire.valider({});
  const lignes = p.panneau.querySelectorAll('tbody tr.arme');
  assert.equal(lignes.at(-1).dataset.arme, nouvelle.id, 'à la fin du tableau de sa famille');
  assert.deepEqual(p.ouvertures, [p.panneau.id], '« onglets:ouvrir » pour sa famille');
  assert.deepEqual(p.comptes(), ['2 armes', '2 armes']);
  assert.equal(ed.annonces.at(-1), `Arme créée : ${nouvelle.nom}.`);
});
