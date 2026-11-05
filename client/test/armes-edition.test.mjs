// L'extension de l'éditeur pour la page Armes (src/scripts/edition/armes.mjs), exécutée dans un faux navigateur (test/aide-faux-dom.mjs) avec un faux
// éditeur, sur le menu latéral des familles (une seule liste, mêlée puis distance ; demandes du propriétaire, 2026-11-05 : « un menu lattéral sur la
// gauche », « Liste unique » ; components/armes/ArmesPage.astro) : une arme ajoutée puis retirée (surcouche) refait le compte du tableau de sa famille
// et celui de son entrée du menu (`[data-armes-menu-compte]`) ; une arme créée (« + Ajouter une arme ») s'ajoute à la fin du tableau de sa famille, qui
// s'affiche (évènement « armes:afficher » du script de la page, envoyé sur le document). Les lignes sont celles de la base
// (lib/armes-rendu.mjs#htmlDeLigneDArme).
// Familles d'armes (décision R159 : « la possibilité de changer le nom et leur dés, ou même de créer un nouvel onglet donc un nouveau tableau si
// besoin ») : un seul « + Nouvelle famille », en bas du menu (« Un seul bouton en bas », 2026-11-05), dont le formulaire demande la catégorie (mêlée ou
// distance) ; l'entrée et le tableau vide tirés des modèles de la page (`<template data-armes-modele>` : ceux de la page construite quand dist/ existe,
// sinon des modèles réduits aux jetons), insérés à chaud à la fin des familles de leur catégorie, affichés ; un refus du service tel quel ; la surcouche
// dessine une famille créée avant ses armes ; `fin()` retire les boutons.
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
// une famille de deux armes au moins : la première est sur la page, la seconde est « créée » ; une famille de l'autre catégorie, sur la page aussi
const famille = familles.find((f) => f.armes.length >= 2);
const autre = familles.find((f) => f.categorie !== famille.categorie);
const [presente, nouvelle] = famille.armes;
const RANG = { contact: 0, distance: 1 };
let numero = 0;

// les modèles d'une famille créée : ceux de la page construite (components/armes/ArmesPage.astro), sinon réduits aux jetons de MODELE_DE_FAMILLE
const construite = fileURLToPath(new URL('../dist/ressources/armes/index.html', import.meta.url));
const MODELES_CONSTRUITS = existsSync(construite)
  ? Object.fromEntries([...readFileSync(construite, 'utf8').matchAll(/<template data-armes-modele="(entree|famille)">([\s\S]*?)<\/template>/g)].map((m) => [m[1], m[2]]))
  : null;
const { id: ID, nom: NOM, de_brut: DE, cout_libelle: COUT } = MODELE_DE_FAMILLE;
const MODELES_REDUITS = {
  entree: `<li class="armes-menu__entree"><a class="armes-menu__lien" id="armes-menu-famille-${ID}" href="#famille-${ID}"><span class="armes-menu__nom">${NOM}</span><span class="armes-menu__de">${DE}</span><span class="armes-menu__compte" data-armes-menu-compte>0 arme</span></a></li>`,
  famille: `<section class="tableau armes-famille" id="famille-${ID}" data-note><h3 class="armes-famille__titre"><span class="armes-famille__nom" data-ed="[&quot;arme_famille&quot;,{&quot;id&quot;:&quot;${ID}&quot;},&quot;nom&quot;]">${NOM}</span><span class="armes-famille__compte">0 arme</span></h3><table><thead><tr><th><span>${COUT}</span></th></tr></thead><tbody></tbody></table></section>`,
};

/**
 * La page : le menu, une seule liste (l'entrée de la famille, puis ou avant celle de l'autre catégorie : mêlée puis distance), les tableaux dans le même
 * ordre (celui de la famille avec une arme, puis, avec `elementaires`, ses deux premières armes élémentaires : R167 ; celui de l'autre famille, vide),
 * les modèles d'une famille créée (`modeles`) ; rend la famille, son entrée, la liste, le menu, les tableaux et l'extension.
 */
async function charger({ modeles = MODELES_REDUITS, elementaires = false } = {}) {
  const tbody = el('tbody', {});
  tbody.insertAdjacentHTML('beforeend', htmlDeLigneDArme(presente, contexte));
  if (elementaires) {
    for (const ae of famille.armes_elementaires.slice(0, 2)) tbody.insertAdjacentHTML('beforeend', htmlDeLigneDArmeElementaire(ae, { type: famille.type_elementaire, solidite }, contexte));
  }
  const panneau = el('section', { class: 'tableau armes-famille is-active', id: `famille-${famille.id}` },
    el('h3', { class: 'armes-famille__titre' }, el('span', { class: 'armes-famille__compte' }, '1 arme')), el('table', {}, tbody));
  const panneauAutre = el('section', { class: 'tableau armes-famille', id: `famille-${autre.id}` }, el('table', {}, el('tbody', {})));
  const entreeDe = (f, actif) => el('li', { class: 'armes-menu__entree' },
    el('a', { class: 'armes-menu__lien', id: `armes-menu-famille-${f.id}`, href: `#famille-${f.id}`, ...(actif ? { 'aria-current': 'true' } : {}) },
      el('span', { class: 'armes-menu__compte', 'data-armes-menu-compte': '' }, '1 arme')));
  const entree = entreeDe(famille, true);
  const entreeAutre = entreeDe(autre, false);
  const avant = RANG[famille.categorie] < RANG[autre.categorie];
  const liste = el('ul', { class: 'armes-menu__liste' }, ...(avant ? [entree, entreeAutre] : [entreeAutre, entree]));
  const menu = el('nav', { class: 'armes-menu', 'data-armes-menu': '' }, el('details', { class: 'armes-menu__repli', open: '', 'data-armes-repli': '' }, liste));
  const tableaux = el('div', { class: 'armes-tableaux' }, ...(avant ? [panneau, panneauAutre] : [panneauAutre, panneau]));
  const modele = (nom) => {
    const t = el('template', { 'data-armes-modele': nom });
    t.innerHTML = modeles[nom];
    return t;
  };
  const racine = el('div', { class: 'armes', 'data-armes': '' }, el('div', { class: 'armes-vue' }, menu, tableaux), modele('entree'), modele('famille'));
  const document = fauxDocument(racine);
  Object.assign(globalThis, { document, Element, CSS: { escape: (t) => String(t).replace(/["\\]/g, '\\$&') } });
  const evenements = [];
  document.addEventListener('armes:rafraichir', () => evenements.push('armes:rafraichir'));
  const affichees = [];
  document.addEventListener('armes:afficher', (e) => affichees.push(e.detail?.famille));
  const { armes: extension } = await import(`../src/scripts/edition/armes.mjs?page=${(numero += 1)}`);
  const comptes = () => [panneau.querySelector('.armes-famille__compte').textContent, entree.querySelector('[data-armes-menu-compte]').textContent];
  /** les familles du menu et celles des tableaux, dans l'ordre (les mêmes : les tableaux suivent le menu) */
  const ordre = () => {
    const duMenu = liste.children.map((li) => li.querySelector('.armes-menu__lien').getAttribute('href').replace('#famille-', ''));
    assert.deepEqual(tableaux.children.map((t) => t.id.replace('famille-', '')), duMenu, 'les tableaux dans l’ordre du menu');
    return duMenu;
  };
  return { panneau, entree, liste, menu, tableaux, extension, affichees, comptes, ordre, racine, evenements, document };
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

/** L'ordre attendu du menu : `id` ajoutée à la fin des familles de sa catégorie (mêlée puis distance). */
const avecALaFin = (ids, id, categorie) => {
  const rang = (x) => RANG[x === id ? categorie : familles.find((f) => f.id === x).categorie];
  const i = ids.findIndex((x) => rang(x) > RANG[categorie]);
  return i < 0 ? [...ids, id] : [...ids.slice(0, i), id, ...ids.slice(i)];
};

test('une arme ajoutée puis retirée (surcouche) : le compte du tableau et celui de son entrée du menu suivent', async () => {
  const p = await charger();
  const ed = fauxEditeur(nouvelle);
  p.extension.surcouche(ed, [{ table: 'arme', cle: { id: nouvelle.id }, ligne: nouvelle }]);
  assert.equal(p.panneau.querySelectorAll('tbody tr.arme').length, 2);
  assert.deepEqual(p.comptes(), ['2 armes', '2 armes']);
  p.extension.surcouche(ed, [{ table: 'arme', cle: { id: presente.id }, ligne: null }]);
  assert.equal(p.panneau.querySelectorAll('tbody tr.arme').length, 1);
  assert.deepEqual(p.comptes(), ['1 arme', '1 arme']);
  // la surcouche n'affiche aucune famille (lignes en attente au chargement)
  assert.deepEqual(p.affichees, []);
});

test('une arme créée (« + Ajouter une arme ») : à la fin du tableau de sa famille, qui s’affiche ; les comptes suivent', async () => {
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
  assert.deepEqual(p.affichees, [p.panneau.id], '« armes:afficher » pour sa famille');
  assert.deepEqual(p.comptes(), ['2 armes', '2 armes']);
  assert.equal(ed.annonces.at(-1), `Arme créée : ${nouvelle.nom}.`);
});

/** Crée une famille par le bouton « + Nouvelle famille » du menu, avec ces saisies ; rend le formulaire ouvert. */
async function creerUneFamille(p, ed, saisies) {
  p.extension.debut(ed);
  const bouton = p.menu.querySelector('.armes-nouvelle-famille');
  assert.ok(bouton, 'le bouton « + Nouvelle famille »');
  cliquer(bouton);
  const formulaire = ed.dernierFormulaire;
  await formulaire.valider(saisies);
  return formulaire;
}

for (const [genre, modeles] of [['modèles réduits', MODELES_REDUITS], ['modèles de la page construite', MODELES_CONSTRUITS]]) {
  test(`R159 : un seul « + Nouvelle famille » en bas du menu (${genre}) — la catégorie demandée, l’entrée et le tableau vide insérés à la fin de leur catégorie et affichés`, modeles ? {} : { skip: 'site non construit (npm run build)' }, async () => {
    const p = await charger({ modeles });
    const creee = familleCreee();
    const ed = fauxEditeur(creee, { table: 'arme_famille', enEdition: true });
    const avant = p.ordre();
    p.extension.debut(ed);
    // « Un seul bouton en bas » : après la liste des entrées, hors d'elle, un seul sur la page
    const boutons = p.racine.querySelectorAll('.armes-nouvelle-famille');
    assert.equal(boutons.length, 1, 'un seul bouton');
    const [bouton] = boutons;
    assert.equal(bouton.previousElementSibling, p.liste, 'juste après la liste, en bas du menu');
    assert.equal(p.liste.querySelector('.armes-nouvelle-famille'), null);
    assert.equal(bouton.textContent, '+ Nouvelle famille');
    // un second début ne l'ajoute pas deux fois
    p.extension.debut(ed);
    assert.equal(p.racine.querySelectorAll('.armes-nouvelle-famille').length, 1);
    cliquer(bouton);
    const formulaire = ed.dernierFormulaire;
    assert.equal(formulaire.titre, 'Nouvelle famille d’armes');
    // nom, dé, catégorie (mêlée ou distance : demandée à la création, R159), en-tête de coût (au choix parmi les trois de la base)
    assert.deepEqual(formulaire.champs.map((c) => c.nom), ['nom', 'de_brut', 'categorie', 'cout_libelle']);
    const categorie = formulaire.champs.find((c) => c.nom === 'categorie');
    assert.deepEqual(categorie.choix.map((c) => c.valeur), ['contact', 'distance']);
    assert.equal(categorie.requis, true);
    assert.deepEqual(formulaire.champs.find((c) => c.nom === 'cout_libelle').choix.map((c) => c.valeur), ['Coût', 'Coût en plus/moins', 'Coût en plus/moins (unité)']);
    const saisies = { nom: creee.nom, de_brut: 'd6', categorie: creee.categorie, cout_libelle: creee.cout_libelle };
    await formulaire.valider(saisies);
    const [methode, chemin, corps] = ed.appels.at(-1);
    assert.deepEqual([methode, chemin], ['POST', 'edition/']);
    assert.deepEqual(corps.operations, [{ op: 'creer', entite: 'arme_famille', valeurs: saisies }]);
    // l'entrée et le tableau, vides, à la fin des familles de sa catégorie
    assert.deepEqual(p.ordre(), avecALaFin(avant, creee.id, creee.categorie));
    const entree = p.document.getElementById(`armes-menu-famille-${creee.id}`);
    assert.equal(entree.getAttribute('href'), `#famille-${creee.id}`);
    assert.equal(entree.querySelector('.armes-menu__nom').textContent, creee.nom);
    assert.equal(entree.querySelector('.armes-menu__de').textContent, 'D6');
    assert.equal(entree.querySelector('[data-armes-menu-compte]').textContent, '0 arme');
    const tableau = p.document.getElementById(`famille-${creee.id}`);
    assert.equal(tableau.querySelector('.armes-famille__nom').textContent, creee.nom);
    assert.ok(tableau.querySelector('.armes-famille__nom').dataset.ed.includes(`"id":"${creee.id}"`), 'son nom : un champ de la famille créée');
    assert.equal(tableau.querySelectorAll('tbody tr').length, 0);
    assert.equal(tableau.dataset.unite, '1', 'coût à l’unité');
    assert.ok(tableau.textContent.includes(creee.cout_libelle), 'l’en-tête de coût');
    assert.ok(![...p.racine.querySelectorAll('.armes-vue [id]')].some((x) => x.id.includes('__')), 'aucun jeton dans le menu ni les tableaux');
    // affichée, les champs montés, la liste des familles, le filtre redemandé
    assert.deepEqual(p.affichees, [`famille-${creee.id}`]);
    assert.deepEqual(ed.montes, [tableau]);
    assert.equal(ed.lignes.get(cleDeLigne('arme_famille', { id: creee.id })), creee);
    assert.deepEqual(ed.listes.famillesDArmes.at(-1), { valeur: creee.id, libelle: creee.nom, categorie: creee.categorie });
    assert.equal(p.evenements.at(-1), 'armes:rafraichir');
    assert.equal(ed.annonces.at(-1), `Famille créée : ${creee.nom}.`);
    // une arme se crée ensuite dans la famille
    p.extension.surcouche(ed, [{ table: 'arme', cle: { id: nouvelle.id }, ligne: { ...nouvelle, famille_id: creee.id } }]);
    assert.equal(tableau.querySelectorAll('tbody tr.arme').length, 1);
    assert.equal(entree.querySelector('[data-armes-menu-compte]').textContent, '1 arme');
  });
}

test('R159 : une famille de l’autre catégorie s’insère à la fin des siennes (mêlée puis distance), quelle que soit la famille affichée', async () => {
  for (const categorie of ['contact', 'distance']) {
    const p = await charger();
    const creee = familleCreee({ id: `essai-${categorie}`, nom: `Essai ${categorie}`, categorie });
    const ed = fauxEditeur(creee, { table: 'arme_famille' });
    const avant = p.ordre();
    await creerUneFamille(p, ed, { nom: creee.nom, de_brut: 'D6', categorie, cout_libelle: 'Coût' });
    assert.deepEqual(p.ordre(), avecALaFin(avant, creee.id, categorie), categorie);
    assert.deepEqual(p.affichees, [`famille-${creee.id}`]);
  }
});

test('R159 : un refus du service (400, 409) s’affiche tel quel dans le formulaire, rien n’est inséré', async () => {
  const p = await charger();
  const message = 'Le nom « Épées » est déjà celui de la famille « ÉPÉES » : les maîtrises qui la nomment deviendraient ambiguës.';
  const ed = fauxEditeur(familleCreee(), { table: 'arme_famille', refus: new Error(message) });
  await assert.rejects(creerUneFamille(p, ed, { nom: 'Épées', de_brut: 'D6', categorie: famille.categorie, cout_libelle: 'Coût' }), { message });
  assert.equal(p.liste.children.length, 2, 'aucune entrée ajoutée');
  assert.equal(p.tableaux.children.length, 2);
  assert.equal(ed.listes.famillesDArmes.length, familles.length);
  assert.deepEqual(p.affichees, []);
});

test('R159 : la surcouche dessine une famille créée avant ses armes ; une famille modifiée suit (dé du menu, coût à l’unité, nom dans la liste)', async () => {
  const p = await charger();
  const creee = familleCreee({ cout_libelle: 'Coût' });
  const ed = fauxEditeur(creee);
  const arme = { ...nouvelle, famille_id: creee.id };
  const avant = p.ordre();
  // l'arme d'abord dans les lignes en attente : la famille est dessinée avant elle
  p.extension.surcouche(ed, [
    { table: 'arme', cle: { id: arme.id }, ligne: arme },
    { table: 'arme_famille', cle: { id: creee.id }, creee: true, ligne: creee },
    { table: 'arme_famille', cle: { id: famille.id }, creee: false, ligne: { ...famille, nom: 'Renommée' } },
  ]);
  const tableau = p.document.getElementById(`famille-${creee.id}`);
  assert.ok(tableau, 'la famille créée');
  assert.deepEqual(p.ordre(), avecALaFin(avant, creee.id, creee.categorie), 'à la fin de sa catégorie');
  assert.equal(tableau.querySelectorAll('tbody tr.arme').length, 1, 'son arme dedans');
  assert.equal(tableau.dataset.unite, undefined);
  assert.equal(p.tableaux.children.length, 3, 'une famille modifiée n’est pas redessinée');
  assert.deepEqual(p.affichees, [], 'la surcouche n’affiche aucune famille');
  // une famille enregistrée (appliquerLigne → ligne) : la pastille de son dé, son coût à l'unité, son nom dans la liste du formulaire « Nouvelle arme »
  p.extension.ligne(ed, 'arme_famille', { id: creee.id }, { ...creee, nom: 'Frondes renommées', cout_libelle: 'Coût en plus/moins (unité)', de_brut: '' });
  assert.equal(tableau.dataset.unite, '1');
  assert.equal(p.document.getElementById(`armes-menu-famille-${creee.id}`).querySelector('.armes-menu__de').hidden, true);
  assert.equal(ed.listes.famillesDArmes.find((f) => f.valeur === creee.id).libelle, 'Frondes renommées');
  assert.equal(p.evenements.at(-1), 'armes:rafraichir');
  // une seconde surcouche ne la redessine pas
  p.extension.surcouche(ed, [{ table: 'arme_famille', cle: { id: creee.id }, creee: true, ligne: creee }]);
  assert.equal(p.tableaux.children.length, 3);
  assert.equal(p.liste.children.length, 3);
});

test('debut() n’ouvre pas le menu replié du petit écran ; fin() retire « + Nouvelle famille » et « + Ajouter une arme »', async () => {
  const p = await charger();
  const repli = p.menu.querySelector('[data-armes-repli]');
  repli.open = false;
  const ed = fauxEditeur(nouvelle);
  p.extension.debut(ed);
  assert.equal(repli.open, false, 'son état reste celui de son script');
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
