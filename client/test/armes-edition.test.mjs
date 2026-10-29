// L'extension de l'éditeur pour l'onglet Armes (src/scripts/edition/armes.mjs), exécutée dans un faux navigateur (test/aide-faux-dom.mjs) avec un faux
// éditeur, sur les deux menus à onglets de l'onglet (demande du propriétaire, 2026-10-23 : components/armes/ArmesPage.astro) : une arme ajoutée puis
// retirée (surcouche) refait le compte du tableau de sa famille et celui de son onglet (`[data-armes-onglet-compte]`) ; une arme créée (« + Ajouter une
// arme ») s'ajoute à la fin du tableau de sa famille, qui reçoit « onglets:ouvrir » (components/Onglets.astro l'écoute sur le document ; le faux
// navigateur ne fait pas remonter les évènements : il s'écoute ici sur la famille). Les lignes sont celles de la base (lib/armes-rendu.mjs#htmlDeLigneDArme).
// Familles d'armes (décision R159 : « la possibilité de changer le nom et leur dés, ou même de créer un nouvel onglet donc un nouveau tableau si
// besoin ») : « + Nouvelle famille » sous la barre de chaque menu, la catégorie de ce menu, l'onglet et le tableau vide tirés des modèles de la page
// (`<template data-armes-modele>` : ceux de la page construite quand dist/ existe, sinon des modèles réduits aux jetons), insérés à chaud, ouverts,
// la barre rebranchée ; un refus du service tel quel ; la surcouche dessine une famille créée avant ses armes ; `fin()` retire les boutons.
//   node --test test/armes-edition.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { contexteDesArmes, chargerArmes } from '../src/lib/armes-db.mjs';
import { htmlDeLigneDArme, htmlDeLigneDArmeElementaire, MODELE_DE_FAMILLE } from '../src/lib/armes-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cleDeLigne } from '../src/lib/edition-modele.mjs';
import { cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const db = ouvrirBase();
const contexte = contexteDesArmes(db);
const { familles, solidite_elementaire: solidite } = chargerArmes(db);
// une famille de deux armes au moins : la première est sur la page, la seconde est « créée »
const famille = familles.find((f) => f.armes.length >= 2);
const [presente, nouvelle] = famille.armes;
let numero = 0;

// les modèles d'une famille créée : ceux de la page construite (components/armes/ArmesPage.astro), sinon réduits aux jetons de MODELE_DE_FAMILLE
const construite = fileURLToPath(new URL('../dist/ressources/armes/index.html', import.meta.url));
const MODELES_CONSTRUITS = existsSync(construite)
  ? Object.fromEntries([...readFileSync(construite, 'utf8').matchAll(/<template data-armes-modele="(onglet|famille)">([\s\S]*?)<\/template>/g)].map((m) => [m[1], m[2]]))
  : null;
const { id: ID, nom: NOM, de_brut: DE, cout_libelle: COUT } = MODELE_DE_FAMILLE;
const MODELES_REDUITS = {
  onglet: `<a class="onglet" id="onglet-famille-${ID}" href="#famille-${ID}"><span class="onglet__nom">${NOM}</span><span class="onglet__de armes-onglets__de">${DE}</span><span class="onglet__detail" data-armes-onglet-compte>0 arme</span></a>`,
  famille: `<section class="tableau armes-famille" id="famille-${ID}" data-note><h4 class="armes-famille__titre"><span class="armes-famille__nom" data-ed="[&quot;arme_famille&quot;,{&quot;id&quot;:&quot;${ID}&quot;},&quot;nom&quot;]">${NOM}</span><span class="armes-famille__compte">0 arme</span></h4><table><thead><tr><th><span>${COUT}</span></th></tr></thead><tbody></tbody></table></section>`,
};

/**
 * La page : le menu de la famille (son onglet, son tableau avec une arme, puis, avec `elementaires`, ses deux premières armes élémentaires : R167), les
 * outils, les modèles d'une famille créée (`modeles`) ; rend la famille, son onglet, sa barre, son menu et l'extension.
 */
async function charger({ modeles = MODELES_REDUITS, elementaires = false } = {}) {
  const tbody = el('tbody', {});
  tbody.insertAdjacentHTML('beforeend', htmlDeLigneDArme(presente, contexte));
  if (elementaires) {
    for (const ae of famille.armes_elementaires.slice(0, 2)) tbody.insertAdjacentHTML('beforeend', htmlDeLigneDArmeElementaire(ae, { type: famille.type_elementaire, solidite }, contexte));
  }
  const panneau = el('section', { class: 'tableau armes-famille is-active', id: `famille-${famille.id}` },
    el('h4', { class: 'armes-famille__titre' }, el('span', { class: 'armes-famille__compte' }, '1 arme')), el('table', {}, tbody));
  const onglet = el('a', { class: 'onglet is-active', id: `onglet-famille-${famille.id}`, href: `#famille-${famille.id}` },
    el('span', { class: 'onglet__detail', 'data-armes-onglet-compte': '' }, '1 arme'));
  const barre = el('nav', { class: 'armes-onglets', 'data-onglets': '' }, onglet);
  const bloc = el('section', { class: 'armes-bloc', 'data-armes-bloc': famille.categorie }, el('h3', { class: 'armes-bloc__titre' }, 'Armes du menu'), barre, panneau);
  const modele = (nom) => {
    const t = el('template', { 'data-armes-modele': nom });
    t.innerHTML = modeles[nom];
    return t;
  };
  const racine = el('div', { class: 'armes', 'data-armes': '' },
    el('div', { class: 'armes-vue' }, el('div', { class: 'armes-tableaux' }, bloc)), modele('onglet'), modele('famille'));
  const document = fauxDocument(racine);
  Object.assign(globalThis, { document, Element, CSS: { escape: (t) => String(t).replace(/["\\]/g, '\\$&') } });
  const evenements = [];
  document.addEventListener('armes:rafraichir', () => evenements.push('armes:rafraichir'));
  barre.addEventListener('onglets:brancher', () => evenements.push('onglets:brancher'));
  const ouvertures = [];
  panneau.addEventListener('onglets:ouvrir', () => ouvertures.push(panneau.id));
  const { armes: extension } = await import(`../src/scripts/edition/armes.mjs?page=${(numero += 1)}`);
  const comptes = () => [panneau.querySelector('.armes-famille__compte').textContent, onglet.querySelector('[data-armes-onglet-compte]').textContent];
  return { panneau, onglet, barre, bloc, extension, ouvertures, comptes, racine, evenements, document };
}

/**
 * Un faux éditeur : ses listes, et la création renvoyée par le service (`ligne` : la ligne créée, de la table `table`) ; `refus` : l'erreur que le
 * service lève à la place ; les appels reçus (`appels`), les champs montés (`montes`).
 */
function fauxEditeur(ligne, { table = 'arme', refus = null, enEdition = false } = {}) {
  const ed = {
    listes: { ...contexte, famillesDArmes: familles.map((f) => ({ valeur: f.id, libelle: f.nom, categorie: f.categorie })) },
    page: 'ressources/armes', enEdition, lignes: new Map(), annonces: [], appels: [], montes: [],
    formulaire: (f) => { ed.dernierFormulaire = f; },
    appel: async (...args) => {
      ed.appels.push(args);
      if (refus) throw refus;
      return { lignes: [{ table, cle: { id: ligne.id }, ligne }] };
    },
    annoncer: (t) => ed.annonces.push(t),
    monterChamps: (portee) => ed.montes.push(portee),
  };
  return ed;
}

/** Une famille telle que le service la renvoie à sa création (la ligne arme_famille). */
const familleCreee = (valeurs = {}) => ({
  id: 'frondes-de-test', nom: 'Frondes d’essai', de_brut: 'D6', cout_libelle: 'Coût en plus/moins (unité)', categorie: famille.categorie, note_brut: null,
  libelle_brut: 'Frondes d’essai - D6', nom_lecture: 'Frondes d’essai', maitrisable: 1, ordre: 99, ...valeurs,
});

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

/** Crée une famille par le bouton « + Nouvelle famille » du menu, avec ces saisies ; rend le formulaire ouvert. */
async function creerUneFamille(p, ed, saisies) {
  p.extension.debut(ed);
  const bouton = p.bloc.querySelector('.armes-nouvelle-famille');
  assert.ok(bouton, 'le bouton « + Nouvelle famille »');
  cliquer(bouton);
  const formulaire = ed.dernierFormulaire;
  await formulaire.valider(saisies);
  return formulaire;
}

for (const [genre, modeles] of [['modèles réduits', MODELES_REDUITS], ['modèles de la page construite', MODELES_CONSTRUITS]]) {
  test(`R159 : « + Nouvelle famille » (${genre}) — la catégorie du menu, l’onglet et le tableau vide insérés à chaud et ouverts, la barre rebranchée`, modeles ? {} : { skip: 'site non construit (npm run build)' }, async () => {
    const p = await charger({ modeles });
    const creee = familleCreee();
    const ed = fauxEditeur(creee, { table: 'arme_famille', enEdition: true });
    p.extension.debut(ed);
    const bouton = p.bloc.querySelector('.armes-nouvelle-famille');
    assert.equal(bouton.previousElementSibling, p.barre, 'juste après la barre, hors de la liste d’onglets');
    assert.equal(p.barre.querySelector('.armes-nouvelle-famille'), null);
    assert.equal(bouton.textContent, '+ Nouvelle famille');
    cliquer(bouton);
    const formulaire = ed.dernierFormulaire;
    assert.equal(formulaire.titre, 'Nouvelle famille : Armes du menu');
    // nom, dé, en-tête de coût (au choix parmi les trois de la base) ; jamais la catégorie, celle du menu
    assert.deepEqual(formulaire.champs.map((c) => c.nom), ['nom', 'de_brut', 'cout_libelle']);
    assert.deepEqual(formulaire.champs.find((c) => c.nom === 'cout_libelle').choix.map((c) => c.valeur), ['Coût', 'Coût en plus/moins', 'Coût en plus/moins (unité)']);
    await formulaire.valider({ nom: creee.nom, de_brut: 'd6', cout_libelle: creee.cout_libelle });
    const [methode, chemin, corps] = ed.appels.at(-1);
    assert.deepEqual([methode, chemin], ['POST', 'edition/']);
    assert.deepEqual(corps.operations, [{ op: 'creer', entite: 'arme_famille', valeurs: { nom: creee.nom, de_brut: 'd6', cout_libelle: creee.cout_libelle, categorie: famille.categorie } }]);
    // l'onglet à la fin de la barre, le tableau après le dernier du menu, vides
    const onglet = p.barre.children.at(-1);
    assert.equal(onglet.id, `onglet-famille-${creee.id}`);
    assert.equal(onglet.getAttribute('href'), `#famille-${creee.id}`);
    assert.equal(onglet.querySelector('.onglet__nom').textContent, creee.nom);
    assert.equal(onglet.querySelector('.armes-onglets__de').textContent, 'D6');
    assert.equal(onglet.querySelector('[data-armes-onglet-compte]').textContent, '0 arme');
    const tableau = p.bloc.children.at(-1);
    assert.equal(tableau.id, `famille-${creee.id}`);
    assert.equal(tableau.previousElementSibling, p.panneau);
    assert.equal(tableau.querySelector('.armes-famille__nom').textContent, creee.nom);
    assert.ok(tableau.querySelector('.armes-famille__nom').dataset.ed.includes(`"id":"${creee.id}"`), 'son nom : un champ de la famille créée');
    assert.equal(tableau.querySelectorAll('tbody tr').length, 0);
    assert.equal(tableau.dataset.unite, '1', 'coût à l’unité');
    assert.ok(tableau.textContent.includes(creee.cout_libelle), 'l’en-tête de coût');
    assert.ok(![...p.bloc.querySelectorAll('[id]')].some((x) => x.id.includes('__')), 'aucun jeton dans le menu');
    // la barre rebranchée, l'onglet ouvert (tous les niveaux), les champs montés, la liste des familles, le filtre redemandé
    assert.ok(p.evenements.includes('onglets:brancher'));
    assert.deepEqual(ed.montes, [tableau]);
    assert.equal(ed.lignes.get(cleDeLigne('arme_famille', { id: creee.id })), creee);
    assert.deepEqual(ed.listes.famillesDArmes.at(-1), { valeur: creee.id, libelle: creee.nom, categorie: famille.categorie });
    assert.equal(p.evenements.at(-1), 'armes:rafraichir');
    assert.equal(ed.annonces.at(-1), `Famille créée : ${creee.nom}.`);
    // une arme se crée ensuite dans la famille
    p.extension.surcouche(ed, [{ table: 'arme', cle: { id: nouvelle.id }, ligne: { ...nouvelle, famille_id: creee.id } }]);
    assert.equal(tableau.querySelectorAll('tbody tr.arme').length, 1);
    assert.equal(onglet.querySelector('[data-armes-onglet-compte]').textContent, '1 arme');
  });
}

test('R159 : l’onglet de la famille créée s’ouvre (« onglets:ouvrir » sur son tableau, tous les niveaux)', async () => {
  const p = await charger();
  const creee = familleCreee();
  const ed = fauxEditeur(creee, { table: 'arme_famille' });
  // le faux navigateur ne fait pas remonter les évènements : chaque envoi est noté, le temps de la création
  const envoyes = [];
  const envoyer = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function noter(e) {
    envoyes.push([e.type, this.id ?? '', e.detail?.dans ?? null]);
    return envoyer.call(this, e);
  };
  try {
    await creerUneFamille(p, ed, { nom: creee.nom, de_brut: 'D6', cout_libelle: creee.cout_libelle });
  } finally {
    EventTarget.prototype.dispatchEvent = envoyer;
  }
  assert.deepEqual(envoyes.filter(([type]) => type === 'onglets:ouvrir'), [['onglets:ouvrir', `famille-${creee.id}`, null]]);
  assert.ok(envoyes.findIndex(([type]) => type === 'onglets:brancher') < envoyes.findIndex(([type]) => type === 'onglets:ouvrir'), 'la barre rebranchée avant');
});

test('R159 : un refus du service (400, 409) s’affiche tel quel dans le formulaire, rien n’est inséré', async () => {
  const p = await charger();
  const message = 'Le nom « Épées » est déjà celui de la famille « ÉPÉES » : les maîtrises qui la nomment deviendraient ambiguës.';
  const ed = fauxEditeur(familleCreee(), { table: 'arme_famille', refus: new Error(message) });
  await assert.rejects(creerUneFamille(p, ed, { nom: 'Épées', de_brut: 'D6', cout_libelle: 'Coût' }), { message });
  assert.equal(p.barre.children.length, 1, 'aucun onglet ajouté');
  assert.equal(p.bloc.querySelectorAll(':scope > .armes-famille').length, 1);
  assert.equal(ed.listes.famillesDArmes.length, familles.length);
});

test('R159 : la surcouche dessine une famille créée avant ses armes ; une famille modifiée suit (dé de l’onglet, coût à l’unité, nom dans la liste)', async () => {
  const p = await charger();
  const creee = familleCreee({ cout_libelle: 'Coût' });
  const ed = fauxEditeur(creee);
  const arme = { ...nouvelle, famille_id: creee.id };
  // l'arme d'abord dans les lignes en attente : la famille est dessinée avant elle
  p.extension.surcouche(ed, [
    { table: 'arme', cle: { id: arme.id }, ligne: arme },
    { table: 'arme_famille', cle: { id: creee.id }, creee: true, ligne: creee },
    { table: 'arme_famille', cle: { id: famille.id }, creee: false, ligne: { ...famille, nom: 'Renommée' } },
  ]);
  const tableau = p.document.getElementById(`famille-${creee.id}`);
  assert.ok(tableau, 'la famille créée');
  assert.equal(tableau.querySelectorAll('tbody tr.arme').length, 1, 'son arme dedans');
  assert.equal(tableau.dataset.unite, undefined);
  assert.equal(p.bloc.querySelectorAll(':scope > .armes-famille').length, 2, 'une famille modifiée n’est pas redessinée');
  assert.deepEqual(p.ouvertures, [], 'la surcouche n’ouvre pas d’onglet');
  // une famille enregistrée (appliquerLigne → ligne) : la pastille de son dé, son coût à l'unité, son nom dans la liste du formulaire « Nouvelle arme »
  p.extension.ligne(ed, 'arme_famille', { id: creee.id }, { ...creee, nom: 'Frondes renommées', cout_libelle: 'Coût en plus/moins (unité)', de_brut: '' });
  assert.equal(tableau.dataset.unite, '1');
  assert.equal(p.document.getElementById(`onglet-famille-${creee.id}`).querySelector('.armes-onglets__de').hidden, true);
  assert.equal(ed.listes.famillesDArmes.find((f) => f.valeur === creee.id).libelle, 'Frondes renommées');
  assert.equal(p.evenements.at(-1), 'armes:rafraichir');
  // une seconde surcouche ne la redessine pas
  p.extension.surcouche(ed, [{ table: 'arme_famille', cle: { id: creee.id }, creee: true, ligne: creee }]);
  assert.equal(p.bloc.querySelectorAll(':scope > .armes-famille').length, 2);
  assert.equal(p.barre.children.length, 2);
});

test('fin() retire les boutons « + Nouvelle famille » et « + Ajouter une arme »', async () => {
  const p = await charger();
  const ed = fauxEditeur(nouvelle);
  p.extension.debut(ed);
  assert.equal(p.racine.querySelectorAll('.armes-nouvelle-famille').length, 1);
  p.extension.fin(ed);
  assert.equal(p.racine.querySelectorAll('.armes-nouvelle-famille').length, 0);
  assert.equal(p.racine.querySelectorAll('.ed-outils-armes').length, 0);
});

test('R167 : les armes élémentaires en lecture — ni bouton Supprimer ni champ ; une arme créée prend place avant elles, à la fin des armes du catalogue', async () => {
  const p = await charger({ elementaires: true });
  const ed = fauxEditeur(nouvelle);
  p.extension.debut(ed);
  const elementaires = p.panneau.querySelectorAll('tbody tr.arme--elementaire');
  assert.equal(elementaires.length, 2);
  assert.ok(elementaires.every((tr) => !tr.querySelector('.ed-supprimer')), 'aucun bouton Supprimer');
  assert.ok(elementaires.every((tr) => !tr.querySelector('[data-ed]')), 'aucun champ');
  assert.ok(p.panneau.querySelector(`tr.arme[data-arme="${presente.id}"] .ed-supprimer`), 'une arme du catalogue garde son bouton');
  cliquer(p.racine.querySelectorAll('.ed-outils-armes button').find((b) => b.textContent === '+ Ajouter une arme'));
  await ed.dernierFormulaire.valider({});
  assert.deepEqual(p.panneau.querySelectorAll('tbody tr.arme').map((tr) => tr.dataset.arme),
    [presente.id, nouvelle.id, ...famille.armes_elementaires.slice(0, 2).map((ae) => ae.id)], 'avant les armes élémentaires');
  // la ligne des effets de l'arme créée la suit, avant la première arme élémentaire
  const nouvelleLigne = p.panneau.querySelector(`tr.arme[data-arme="${nouvelle.id}"]`);
  assert.ok(nouvelleLigne.nextElementSibling.classList.contains('arme-suite'));
  assert.ok(nouvelleLigne.nextElementSibling.nextElementSibling.classList.contains('arme--elementaire'));
  assert.deepEqual(p.comptes(), ['4 armes', '4 armes'], 'toutes les lignes du tableau, élémentaires comprises');
  p.extension.fin(ed);
});
