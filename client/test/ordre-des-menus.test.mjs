// L'ordre des menus latéraux et les pages des Règles en mode modification du site de dev (lib/ordre-des-menus.mjs ; lot de l'édition des menus,
// demandes du propriétaire : « changer l'ordre des menu latéraux (par un glisser déposer) », « ajouter / supprimer une page » ; réponses « Règles +
// Races », « Oui, par une liste », « Titre, onglet, résumé », « Refus si citée, puis 404 »). La logique pure seulement, jamais le script de page dans
// Node (src/scripts/edition/menus.mjs, glisser.mjs).
//   node --test test/ordre-des-menus.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  adresseDeLaNouvellePage, adresseDeLaPageCreee, annonceDeLaPlace, bornesDuGroupe, boutonSupprimer, chercherDansLePlan, deplacer, elementsDuRefus,
  entreeDeLaPage, entreesDuPlanVivant, GROUPES_DE_RACES, htmlDUneEntree, lireMenu, MENU_DES_RACES, operationsDOrdre, ordonnerSelon, pageSupprimeeEnAttente,
  placeAuClavier, placeAuPointeur, raceDuLien, vitesseDeDefilement, voisinsADeplacer,
} from '../src/lib/ordre-des-menus.mjs';
import { GROUPES_DE_RACES as GROUPES_DU_SERVICE } from '../serveur/edition-plan.mjs';
import { normalize } from '../src/lib/text.mjs';

/** Un plan vivant d'essai, de la forme de GET /api/edition/plan/ (serveur/edition-plan.mjs#planVivant). */
const PLAN = {
  onglets: [
    { id: 'combats', titre: 'Les combats', ordre: 3, ouverture: 'guide/le-tour-de-jeu', entrees: [
      { id: 'page:guide/le-tour-de-jeu', sorte: 'page', rang: 1, page_id: 'guide/le-tour-de-jeu', titre: 'Le tour de jeu', libelle: null, adresse: 'regles/le-tour-de-jeu/', protection: [{ raison: 'ouverture', texte: 'x' }], citations: [], supprimable: false },
      { id: 'page:guide/les-degats', sorte: 'page', rang: 2, page_id: 'guide/les-degats', titre: 'Les dégâts & <b>', libelle: null, adresse: 'regles/les-degats/', protection: [], citations: [], supprimable: true },
    ] },
    { id: 'exploration', titre: 'Exploration', ordre: 4, ouverture: 'guide/les-pieges', entrees: [
      { id: 'page:guide/les-pieges', sorte: 'page', rang: 1, page_id: 'guide/les-pieges', titre: 'Les pièges', libelle: null, adresse: 'regles/les-pieges/', protection: [], citations: [], supprimable: false },
      { id: 'lien:regles/artisanat', sorte: 'lien', rang: 2, page_id: null, titre: null, libelle: 'Artisanat', adresse: 'regles/artisanat/', protection: null, citations: null, supprimable: false },
      { id: 'bientot:donjons', sorte: 'bientot', rang: 3, page_id: null, titre: null, libelle: 'Les donjons', adresse: null, protection: null, citations: null, supprimable: false },
    ] },
  ],
  races: { pures: [{ id: 'races/humain', nom: 'Humain', rang_liste: 1 }, { id: 'races/nain', nom: 'Nain', rang_liste: 2 }], hybrides: [{ id: 'races/orios', nom: 'Orios', rang_liste: null }] },
};

test('lireMenu : `onglet:<id>` ou `races` (data-ed-menu, posé par MenuLateral.astro) ; rien d’autre', () => {
  assert.deepEqual(lireMenu('onglet:fiche-de-personnage'), { onglet: 'fiche-de-personnage' });
  assert.deepEqual(lireMenu(MENU_DES_RACES), { races: true });
  for (const v of [undefined, '', 'onglet:', 'onglet:A b', 'regles', 'race']) assert.equal(lireMenu(v), null, String(v));
  // les groupes de races : ceux du service, dans le même ordre (pures puis hybrides)
  assert.deepEqual(GROUPES_DE_RACES, GROUPES_DU_SERVICE);
});

test('deplacer, bornesDuGroupe : une entrée change de place, une race ne sort pas de son groupe', () => {
  assert.deepEqual(deplacer(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(deplacer(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(deplacer(['a', 'b'], 0, 9), ['b', 'a'], 'bornée à la liste');
  const liste = ['a'];
  assert.notEqual(deplacer(liste, 0, 0), liste, 'une copie');
  // un menu d'un seul tenant : tout le menu ; les races : la suite voisine de même groupe
  assert.deepEqual(bornesDuGroupe([undefined, undefined, undefined], 1), [0, 2]);
  const groupes = ['pures', 'pures', 'pures', 'hybrides', 'hybrides'];
  assert.deepEqual(bornesDuGroupe(groupes, 0), [0, 2]);
  assert.deepEqual(bornesDuGroupe(groupes, 2), [0, 2]);
  assert.deepEqual(bornesDuGroupe(groupes, 3), [3, 4]);
});

test('au clavier : ↑ ↓ d’une place, Début et Fin au bout du groupe ; null au bout ou pour une autre touche', () => {
  const bornes = [3, 6];
  assert.equal(placeAuClavier('ArrowUp', 5, bornes), 4);
  assert.equal(placeAuClavier('ArrowDown', 5, bornes), 6);
  assert.equal(placeAuClavier('Home', 5, bornes), 3);
  assert.equal(placeAuClavier('End', 4, bornes), 6);
  assert.equal(placeAuClavier('ArrowUp', 3, bornes), null, 'déjà en tête de son groupe : ne passe pas dans l’autre');
  assert.equal(placeAuClavier('ArrowDown', 6, bornes), null);
  assert.equal(placeAuClavier('End', 6, bornes), null);
  assert.equal(placeAuClavier('Enter', 5, bornes), null);
  assert.equal(annonceDeLaPlace('Les dégâts', 3, 12), '« Les dégâts » : place 3 sur 12.');
});

test('au pointeur : la place d’insertion parmi les autres entrées (leurs milieux) ; défilement automatique près des bords', () => {
  const milieux = [10, 30, 50];
  assert.equal(placeAuPointeur(0, milieux), 0);
  assert.equal(placeAuPointeur(20, milieux), 1);
  assert.equal(placeAuPointeur(45, milieux), 2);
  assert.equal(placeAuPointeur(99, milieux), 3);
  assert.equal(placeAuPointeur(5, []), 0);
  // la zone qui défile va de 100 à 600 : rien au milieu, vers le haut près du haut, vers le bas près du bas, au plus vite au bord
  assert.equal(vitesseDeDefilement(350, 100, 600), 0);
  assert.ok(vitesseDeDefilement(110, 100, 600) < 0);
  assert.ok(vitesseDeDefilement(590, 100, 600) > 0);
  assert.equal(vitesseDeDefilement(100, 100, 600), -18);
  assert.equal(vitesseDeDefilement(700, 100, 600), 18, 'pointeur sorti de la zone : au plus vite');
  assert.ok(Math.abs(vitesseDeDefilement(105, 100, 600)) > Math.abs(vitesseDeDefilement(140, 100, 600)), 'plus vite près du bord');
  assert.equal(vitesseDeDefilement(50, 50, 50), 0, 'une zone sans hauteur');
});

test('operationsDOrdre : une opération `ordonner` par menu changé (toutes ses entrées), par groupe de races changé ; rien sinon', () => {
  const e = (...ids) => ids.map((id) => ({ id }));
  const r = (...paires) => paires.map(([id, groupe]) => ({ id, groupe }));
  assert.deepEqual(operationsDOrdre([{ menu: 'onglet:combats', avant: e('a', 'b', 'c'), apres: e('a', 'b', 'c') }]), []);
  assert.deepEqual(operationsDOrdre([{ menu: 'onglet:combats', avant: e('a', 'b', 'c'), apres: e('c', 'a', 'b') }]), [{ op: 'ordonner', onglet: 'combats', ids: ['c', 'a', 'b'] }]);
  const avant = r(['h', 'pures'], ['n', 'pures'], ['o', 'hybrides'], ['f', 'hybrides']);
  assert.deepEqual(operationsDOrdre([{ menu: 'races', avant, apres: r(['n', 'pures'], ['h', 'pures'], ['o', 'hybrides'], ['f', 'hybrides']) }]),
    [{ op: 'ordonner', races: 'pures', ids: ['n', 'h'] }], 'seul le groupe changé');
  assert.deepEqual(operationsDOrdre([{ menu: 'races', avant, apres: r(['n', 'pures'], ['h', 'pures'], ['f', 'hybrides'], ['o', 'hybrides']) }]),
    [{ op: 'ordonner', races: 'pures', ids: ['n', 'h'] }, { op: 'ordonner', races: 'hybrides', ids: ['f', 'o'] }]);
  assert.deepEqual(operationsDOrdre([{ menu: 'inconnu', avant: e('a', 'b'), apres: e('b', 'a') }]), [], 'un menu illisible');
  // plusieurs menus sur une page : chacun le sien
  assert.equal(operationsDOrdre([
    { menu: 'onglet:combats', avant: e('a', 'b'), apres: e('b', 'a') },
    { menu: 'onglet:exploration', avant: e('x', 'y'), apres: e('x', 'y') },
  ]).length, 1);
});

test('le plan vivant : les entrées d’un menu d’onglet (pages, lien, « bientôt ») et du menu des races (pures puis hybrides), leur HTML celui de MenuLateral.astro', () => {
  assert.deepEqual(entreesDuPlanVivant(PLAN, { onglet: 'exploration' }).map((e) => [e.id, e.rang, e.sorte, e.page, e.texte, e.adresse]), [
    ['page:guide/les-pieges', 1, 'page', 'guide/les-pieges', 'Les pièges', 'regles/les-pieges/'],
    ['lien:regles/artisanat', 2, 'lien', null, 'Artisanat', 'regles/artisanat/'],
    ['bientot:donjons', 3, 'bientot', null, 'Les donjons', null],
  ]);
  assert.deepEqual(entreesDuPlanVivant(PLAN, { races: true }).map((e) => [e.id, e.rang, e.groupe, e.texte, e.adresse]), [
    ['races/humain', 1, 'pures', 'Humain', 'races/humain/'], ['races/nain', 2, 'pures', 'Nain', 'races/nain/'], ['races/orios', null, 'hybrides', 'Orios', 'races/orios/'],
  ]);
  assert.deepEqual(entreesDuPlanVivant(PLAN, { onglet: 'absent' }), []);
  assert.deepEqual(entreesDuPlanVivant(null, { races: true }), []);
  // le HTML : celui du composant (classes, aria-current, « (bientôt) »), texte échappé, et les attributs du mode modification
  const [degats] = entreesDuPlanVivant(PLAN, { onglet: 'combats' }).slice(1);
  assert.equal(htmlDUneEntree(degats, { base: '/MaverickCenter/', courante: true }),
    '<li data-ed-entree="page:guide/les-degats" data-ed-rang="2"><a class="lateral-menu__lien" href="/MaverickCenter/regles/les-degats/" aria-current="page">Les dégâts &amp; &lt;b&gt;</a></li>');
  const [, , donjons] = entreesDuPlanVivant(PLAN, { onglet: 'exploration' });
  assert.equal(htmlDUneEntree(donjons), '<li data-ed-entree="bientot:donjons" data-ed-rang="3"><span class="lateral-menu__bientot nav-soon">Les donjons <small>(bientôt)</small></span></li>');
  const orios = entreesDuPlanVivant(PLAN, { races: true }).at(-1);
  assert.equal(htmlDUneEntree(orios), '<li data-ed-entree="races/orios" data-ed-groupe="hybrides"><a class="lateral-menu__lien" href="/races/orios/">Orios</a></li>', 'sans rang : pas de data-ed-rang');
  // le composant écrit les mêmes classes et le même « (bientôt) »
  const composant = readFileSync(new URL('../src/components/guide/MenuLateral.astro', import.meta.url), 'utf8');
  for (const morceau of ['<a class="lateral-menu__lien" href=', '<span class="lateral-menu__bientot nav-soon">{p.bientot} <small>(bientôt)</small></span>', 'data-ed-menu={edition?.menu}',
    "'data-ed-entree'", "'data-ed-rang'", "'data-ed-groupe'"]) assert.ok(composant.includes(morceau), morceau);
});

test('chercherDansLePlan : l’onglet et l’entrée d’une page (liste « Onglet », « Supprimer », menu d’une page changée d’onglet)', () => {
  const { onglet, entree } = chercherDansLePlan(PLAN, (e) => e.page_id === 'guide/les-degats');
  assert.deepEqual([onglet.id, entree.id, entree.supprimable], ['combats', 'page:guide/les-degats', true]);
  assert.equal(chercherDansLePlan(PLAN, (e) => e.page_id === 'guide/absente'), null);
  assert.equal(chercherDansLePlan(null, () => true), null);
});

// Demande du propriétaire : « Changer le titre avec l'édition devrai aussi changer le nom sur le menu lattéral » : l'entrée d'une page se retrouve par
// l'identifiant de sa ligne (data-ed-entree), que le menu construit et le menu redessiné posent l'un et l'autre
test('entreeDeLaPage : l’entrée de menu d’une page (data-ed-entree) — `page:<id>` pour le guide, l’id pour une race ; celle du plan et du HTML', () => {
  assert.equal(entreeDeLaPage('guide/les-degats'), 'page:guide/les-degats');
  assert.equal(entreeDeLaPage('races/orios'), 'races/orios');
  for (const e of [...entreesDuPlanVivant(PLAN, { onglet: 'combats' }), ...entreesDuPlanVivant(PLAN, { races: true })]) {
    assert.equal(entreeDeLaPage(e.page), e.id, e.id);
    assert.match(htmlDUneEntree(e), new RegExp(`data-ed-entree="${e.id}"`));
  }
});

test('créer une page : l’adresse /regles/<slug>/ tirée du titre comme le service (normalize), figée ; celle d’une page créée d’après son id', () => {
  assert.equal(adresseDeLaNouvellePage('Les Donjons de l’Ouest'), `regles/${normalize('Les Donjons de l’Ouest')}/`);
  assert.equal(adresseDeLaNouvellePage('  Météo  '), 'regles/meteo/');
  assert.equal(adresseDeLaNouvellePage('« ! »'), null, 'aucune lettre ni chiffre');
  assert.equal(adresseDeLaNouvellePage(undefined), null);
  assert.equal(adresseDeLaPageCreee('guide/les-donjons-2'), 'regles/les-donjons-2/');
  for (const id of [undefined, 'races/x', 'guide/', 'guide/A b']) assert.equal(adresseDeLaPageCreee(id), null, String(id));
  // le service tire le slug du même normalize (serveur/edition-plan.mjs)
  assert.match(readFileSync(new URL('../serveur/edition-plan.mjs', import.meta.url), 'utf8'), /const cle = normalize\(valeurs\.titre\);/);
});

test('un refus de suppression (409) : les raisons d’une page protégée, ou chaque page qui la cite une fois (lien vers elle), un texte hors page sans lien', () => {
  assert.deepEqual(elementsDuRefus({ erreur: 'x', page: 'guide/a', raisons: [{ raison: 'ouverture', texte: 'page d’ouverture de l’onglet « Les combats »' }] }),
    [{ texte: 'page d’ouverture de l’onglet « Les combats »', page: null }]);
  const citations = [
    { table: 'page', cle: { id: 'guide/b' }, colonne: 'corps_md', comment: 'lien', page: { id: 'guide/b', titre: 'Page B' }, libelle: 'Page B', exemple: false },
    { table: 'page', cle: { id: 'guide/b' }, colonne: 'titre', comment: 'adresse', page: { id: 'guide/b', titre: 'Page B' }, libelle: 'Page B', exemple: false },
    { table: 'evenement_extrait', cle: { id: 3 }, colonne: 'page_id', comment: 'chronologie', page: null, libelle: 'Chronologie › La Chute', exemple: false },
  ];
  assert.deepEqual(elementsDuRefus({ erreur: 'x', page: 'guide/a', citations }), [{ texte: 'Page B', page: 'guide/b' }, { texte: 'Chronologie › La Chute', page: null }]);
  assert.deepEqual(elementsDuRefus({ erreur: 'Le menu a changé', attendus: ['a'] }), []);
  assert.deepEqual(elementsDuRefus(null), []);
});

// Essai dans Chromium (tech-qualite) : déplacer l'élément glissé lui faisait perdre la capture du pointeur, et le geste s'arrêtait après une place. On
// déplace ses voisins (scripts/edition/glisser.mjs#placer) : le résultat doit être celui de `deplacer`, pour toute place de départ et d'arrivée.
test('voisinsADeplacer : déplacer les voisins (jamais l’élément glissé) donne le même ordre que deplacer, de n’importe quelle place à n’importe quelle autre', () => {
  /** Ce que fait glisser.mjs#placer sur une liste (insertBefore des voisins, dans l'ordre, devant l'élément ou devant son suivant d'origine). */
  const parLesVoisins = (liste, place, cible) => {
    const v = voisinsADeplacer(place, cible);
    if (!v) return [...liste];
    const el = liste[place];
    const voisins = liste.slice(v.debut, v.fin + 1);
    const reste = liste.filter((x) => !voisins.includes(x));
    const i = reste.indexOf(el);
    return v.sens === 'avant' ? [...reste.slice(0, i), ...voisins, ...reste.slice(i)] : [...reste.slice(0, i + 1), ...voisins, ...reste.slice(i + 1)];
  };
  const liste = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (let place = 0; place < liste.length; place += 1) {
    for (let cible = 0; cible < liste.length; cible += 1) assert.deepEqual(parLesVoisins(liste, place, cible), deplacer(liste, place, cible), `${place} → ${cible}`);
  }
  assert.equal(voisinsADeplacer(2, 2), null);
  assert.deepEqual(voisinsADeplacer(1, 4), { sens: 'avant', debut: 2, fin: 4 }, 'il descend de trois places d’un coup : trois voisins passent devant lui');
  assert.deepEqual(voisinsADeplacer(4, 0), { sens: 'apres', debut: 0, fin: 3 });
  // le geste : le pointeur passe trois milieux d'un coup (190 px), l'élément descend de trois places, pas d'une
  assert.equal(placeAuPointeur(190, [20, 60, 100, 140, 220]), 4);
});

// Décision du leader-technique : « Supprimer » ne manque que sur une page protégée ; une page citée le garde (son refus donne les textes qui la citent)
test('boutonSupprimer : absent seulement pour une page protégée ; une page citée (non supprimable) le garde ; jamais pour un lien ou « bientôt »', () => {
  const page = (protection, citations, supprimable) => ({ sorte: 'page', protection, citations, supprimable });
  assert.equal(boutonSupprimer(page([], [], true)), true);
  assert.equal(boutonSupprimer(page([], [{ page: { id: 'guide/x', titre: 'X' }, exemple: false }], false)), true, 'citée : le bouton reste, le refus liste les textes');
  assert.equal(boutonSupprimer(page([{ raison: 'ouverture', texte: 'x' }], [], false)), false, 'protégée');
  assert.equal(boutonSupprimer(page(null, null, false)), false);
  for (const sorte of ['lien', 'bientot']) assert.equal(boutonSupprimer({ sorte, protection: null, citations: null, supprimable: false }), false, sorte);
  assert.equal(boutonSupprimer(undefined), false);
  // le plan d'essai : « Les dégâts » (ni protégée) a le bouton, « Le tour de jeu » (ouverture) non
  const [tour, degats] = PLAN.onglets[0].entrees;
  assert.deepEqual([boutonSupprimer(tour), boutonSupprimer(degats)], [false, true]);
});

test('avant la reconstruction : une page affichée supprimée sur le site de dev (sa ligne en attente sans ligne) ; /races/ dans l’ordre du plan vivant', () => {
  const lignes = [
    { table: 'page', cle: { id: 'guide/a' }, creee: false, ligne: null },
    { table: 'page', cle: { id: 'guide/b' }, creee: false, ligne: { id: 'guide/b', titre: 'B' } },
    { table: 'regles_onglet_entree', cle: { id: 'page:guide/c' }, creee: false, ligne: null },
  ];
  assert.equal(pageSupprimeeEnAttente(lignes, 'guide/a'), true);
  assert.equal(pageSupprimeeEnAttente(lignes, 'guide/b'), false, 'modifiée, pas supprimée');
  assert.equal(pageSupprimeeEnAttente(lignes, 'guide/c'), false, 'seule la ligne `page` compte');
  assert.equal(pageSupprimeeEnAttente(lignes, null), false);
  // les liens des pastilles et du tableau (préfixe de déploiement compris) → l'id de la race
  assert.equal(raceDuLien('/races/elfe-noir/'), 'races/elfe-noir');
  assert.equal(raceDuLien('/MaverickCenter/races/orios/'), 'races/orios');
  assert.equal(raceDuLien('/magies/feu/'), null);
  assert.equal(raceDuLien(null), null);
  // l'ordre du plan ; ce qu'il ne connaît pas (la race d'exemple) après, dans son ordre d'origine
  const elements = ['races/nain', 'races/exemple-race', 'races/humain', null, 'races/orios'].map((id) => ({ id }));
  assert.deepEqual(ordonnerSelon(elements, ['races/orios', 'races/humain', 'races/nain']).map((e) => e.id), ['races/orios', 'races/humain', 'races/nain', 'races/exemple-race', null]);
  assert.deepEqual(ordonnerSelon(['b', 'a'], ['a', 'b'], (x) => x), ['a', 'b']);
});
