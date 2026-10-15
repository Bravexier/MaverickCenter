// Le script de /ressources/objets-a-la-ceinture/ (src/scripts/ceinture.mjs), exécuté dans un faux navigateur : la recherche filtre les lignes de tous les
// tableaux (une potion se trouve aussi par le titre et le résumé de sa page), cache un groupe de potions sans ligne trouvée, un tableau vide et le groupe
// « Potions » quand tous ses tableaux le sont ; les comptes suivent (une ligne de bâtons compte pour ses bâtons) ; un <tbody> des règles n'est jamais
// filtré ; « Tout replier » / « Tout déplier » ; une recherche remise par le navigateur est appliquée au chargement.
//   node --test test/ceinture-script.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cliquer, el, fauxDocument } from './aide-faux-dom.mjs';

let numero = 0;
const ligne = (id, recherche, extra = {}) => el('tr', { class: 'ceint-ligne', id, 'data-recherche': recherche, ...extra });
const tableau = (id, ...corps) => el('details', { id, 'data-ceinture-tableau': '' }, el('summary', {}, el('span', { 'data-compte': '' })),
  el('table', {}, ...corps));

/** La page, réduite à ce que le script lit ; `valeur` : la recherche déjà dans le champ au chargement (retour arrière). */
async function charger(valeur = '') {
  const champ = el('input', { 'data-ceinture-recherche': '' });
  champ.value = valeur;
  // un tableau Markdown des règles (son <tbody> sans data-ceinture-corps) dans le tableau des bâtons
  const regles = el('table', {}, el('tbody', {}, el('tr', { class: 'ceint-ligne', 'data-recherche': 'regle' })));
  const potions = el('section', { 'data-ceinture-groupe': '', id: 'groupe-potions' },
    tableau('objets-fiole',
      el('tbody', { 'data-ceinture-corps': '', 'data-recherche': 'fiole rouge potions de soin' },
        ligne('petite-rouge', 'petite fiole rouge novice recupere 2d8 + 5 sante'), ligne('ultime-rouge', 'ultime fiole rouge maitre recupere 100% de sante')),
      el('tbody', { 'data-ceinture-corps': '', 'data-recherche': 'fiole bleue chakra' },
        ligne('petite-bleue', 'petite fiole bleue novice recupere 2d8 + 5 chakra'))),
    tableau('objets-remede',
      el('tbody', { 'data-ceinture-corps': '', 'data-recherche': 'remede gel' }, ligne('remede-gel', 'remede de gel mineur apprenti reduit d\'un cran le gel'))));
  const contenants = tableau('objets-contenant', el('tbody', { 'data-ceinture-corps': '' }, ligne('carquois', 'petit carquois (5) etui en cuir')));
  const batons = tableau('objets-baton', regles,
    el('tbody', { 'data-ceinture-corps': '' }, ligne('baton-feu', 'feu rubis khejri degats sort +3', { 'data-nombre': '3' }),
      ligne('baton-glace', 'glace turquoise sapin ampli am', { 'data-nombre': '3' })));
  const compte = el('span', { 'data-ceinture-compte': '' });
  const rien = el('p', { 'data-ceinture-rien': '', hidden: '' });
  const ouvrir = el('button', { 'data-ceinture-tout': 'ouvrir' });
  const fermer = el('button', { 'data-ceinture-tout': 'fermer' });
  const document = fauxDocument(el('div', { 'data-ceinture': '' }, champ, compte, ouvrir, fermer, el('div', {}, potions, contenants, batons), rien));
  globalThis.document = document;
  await import(`../src/scripts/ceinture.mjs?page=${(numero += 1)}`);
  const $ = (id) => document.getElementById(id);
  const chercher = (texte) => {
    champ.value = texte;
    champ.dispatchEvent(new Event('input'));
  };
  const compteDe = (id) => $(id).querySelector('[data-compte]').textContent;
  const visibles = () => document.querySelectorAll('tr.ceint-ligne').filter((tr) => !tr.classList.contains('est-filtree')).map((tr) => tr.id);
  return { $, chercher, compte, rien, compteDe, visibles, ouvrir, fermer, regles, potions };
}

test('une recherche garde les lignes qui ont tous ses mots, sans accents ; une potion se trouve par le titre de sa page', async () => {
  const p = await charger();
  p.chercher('Récupère  SANTÉ');
  assert.deepEqual(p.visibles().filter((id) => id !== ''), ['petite-rouge', 'ultime-rouge']);
  p.chercher('rouge soin');
  assert.deepEqual(p.visibles().filter((id) => id !== ''), ['petite-rouge', 'ultime-rouge'], 'le titre et le résumé du groupe comptent');
  assert.equal(p.compteDe('objets-fiole'), '2');
  assert.equal(p.compte.textContent, '2 objets');
});

test('un groupe, un tableau et le titre « Potions » sans ligne trouvée se cachent ; les bâtons comptent pour leurs bâtons', async () => {
  const p = await charger();
  p.chercher('feu');
  assert.equal(p.$('objets-fiole').hidden, true);
  assert.equal(p.$('objets-remede').hidden, true);
  assert.equal(p.potions.hidden, true, 'le titre « Potions » part avec ses tableaux');
  assert.equal(p.$('objets-contenant').hidden, true);
  assert.equal(p.$('objets-baton').hidden, false);
  assert.equal(p.compteDe('objets-baton'), '3', 'la ligne du feu : ses trois bâtons');
  assert.equal(p.compte.textContent, '3 objets');
  p.chercher('carquois');
  assert.equal(p.potions.hidden, true);
  assert.equal(p.compte.textContent, '1 objet', 'au singulier');
  p.chercher('gel');
  assert.equal(p.potions.hidden, false, 'un tableau du groupe a une ligne : le groupe revient');
  assert.equal(p.$('objets-fiole').hidden, true);
  const groupes = p.$('objets-fiole').querySelectorAll('[data-ceinture-corps]');
  assert.ok(groupes.every((g) => g.hidden), 'les groupes de potions sans ligne trouvée se cachent');
});

test('rien trouvé : le message ; le <tbody> des règles n’est jamais filtré ; effacer la recherche rend tout', async () => {
  const p = await charger();
  p.chercher('introuvable');
  assert.equal(p.rien.hidden, false);
  assert.equal(p.compte.textContent, '0 objet');
  assert.equal(p.regles.querySelector('tbody').hidden, false);
  assert.equal(p.regles.querySelector('tr.ceint-ligne').classList.contains('est-filtree'), false);
  p.chercher('');
  assert.equal(p.rien.hidden, true);
  assert.equal(p.potions.hidden, false);
  assert.equal(p.compte.textContent, '11 objets', '4 potions, 1 carquois, 2 × 3 bâtons (le tableau des règles ne compte pas)');
});

test('tout replier, tout déplier ; une recherche remise par le navigateur s’applique au chargement', async () => {
  const p = await charger();
  cliquer(p.fermer);
  assert.ok(['objets-fiole', 'objets-remede', 'objets-contenant', 'objets-baton'].every((id) => p.$(id).open === false));
  cliquer(p.ouvrir);
  assert.ok(['objets-fiole', 'objets-remede', 'objets-contenant', 'objets-baton'].every((id) => p.$(id).open === true));
  const q = await charger('glace');
  assert.equal(q.compte.textContent, '3 objets');
  assert.equal(q.potions.hidden, true);
});
