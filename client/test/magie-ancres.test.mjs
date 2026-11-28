// Les ancres propres à une page de magie (lib/magie-ancres.mjs ; R321 (2), étape 3 du lot 2 du menu) : les sections de la page, sous l'entrée de la magie affichée dans le
// menu latéral du site, sur sa page seulement. Des magies d'essai (noms inventés) : aucun libellé de la base n'est figé ici.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ancresDeLaMagie } from '../src/lib/magie-ancres.mjs';
import { poserLesAncres, sousEntreesDesMagies } from '../src/lib/menu-sous-entrees.mjs';
import { htmlDesEntrees } from '../src/lib/menu-rendu.mjs';
import { ancreDeSpecialisation } from '../src/lib/sort-format.mjs';

const sort = (niveau, id, specialisationId = null) => ({ id, npm: niveau, niveau, specialisationId });
/** Une magie d'essai : les champs que lit ancresDeLaMagie. */
const magie = (o = {}) => ({
  id: 'magies/essai', description: [], descriptionPhysique: [], banniere: '', etats: [], modeHyper: [], sorts: [], specialisations: [], ...o,
});
const entry = { id: 'magies/essai', data: { nom_court: 'Essai' } };
const sans = (m, entries = []) => ancresDeLaMagie({ entry, entries, magie: m, magies: { magies: new Map([[m.id, m]]) } });

test('une page à une seule section n’a aucune ancre (comme l’ancienne barre) ; Résistances est toujours là', () => {
  assert.deepEqual(sans(magie()), []);
});

test('les sections présentes, dans l’ordre de la page : présentation, altération, résistances, mode hyper, sorts', () => {
  const ancres = sans(magie({ description: [{}], etats: [{}], modeHyper: [{}] }));
  assert.deepEqual(ancres.map((a) => a.ancre), ['#presentation', '#alteration', '#affinites', '#mode-hyper']);
  assert.ok(ancres.every((a) => typeof a.libelle === 'string' && a.libelle.length > 0));
  // une bannière seule fait la présentation
  assert.deepEqual(sans(magie({ banniere: 'x' })).map((a) => a.ancre), ['#presentation', '#affinites']);
});

test('les sorts : une ancre « Sorts », un NPM par niveau commun, une entrée par spécialisation (ancre de son identifiant figé)', () => {
  const specs = [{ id: 'magies/essai#specialisation:alpha', nom: 'Alpha d’essai', description: '', remarque: '' }, { id: 'magies/essai#specialisation:beta', nom: 'Bêta d’essai', description: '', remarque: '' }];
  const sorts = [sort(1, 'sort:a'), sort(2, 'sort:b'), sort(3, 'sort:c', specs[0].id), sort(3, 'sort:d', specs[1].id)];
  const ancres = sans(magie({ sorts, specialisations: specs }));
  const href = ancres.map((a) => a.ancre);
  assert.ok(href.includes('#sorts') && href.includes('#npm-1') && href.includes('#npm-2'));
  for (const s of specs) assert.ok(href.includes(`#specialisation-${ancreDeSpecialisation(s.id)}`), s.id);
  assert.deepEqual(ancres.filter((a) => a.ancre.startsWith('#specialisation-')).map((a) => a.libelle), specs.map((s) => s.nom), 'le nom de la spécialisation tel qu’écrit');
  assert.ok(href.indexOf('#sorts') < href.indexOf('#npm-1') && href.indexOf('#npm-2') < href.indexOf('#specialisation-' + ancreDeSpecialisation(specs[0].id)));
});

test('R321 (2) : les ancres se posent sous l’entrée de la magie courante, et nulle part ailleurs ; l’entrée est ouverte d’office', () => {
  const magies = sousEntreesDesMagies([{ id: 'magies/essai', nom: 'Essai', classe: 'couleur-magie-essai' }, { id: 'magies/autre', nom: 'Autre', classe: 'couleur-magie-autre' }]);
  assert.deepEqual(magies.map((m) => [m.href, m.page, m.libelle, m.classe]), [['magies/essai/', 'magies/essai', 'Essai', 'couleur-magie-essai'], ['magies/autre/', 'magies/autre', 'Autre', 'couleur-magie-autre']]);
  const parent = { href: 'magies/', libelle: 'Les magies', bientot: false, motCle: null, sous: 'magies', cle: 'magies', enfants: magies };
  const ancres = [{ ancre: '#presentation', libelle: 'Présentation' }, { ancre: '#sorts', libelle: 'Sorts' }];
  const poser = (page, a = ancres) => poserLesAncres([parent], page, a);
  assert.equal(poser(null).at(0), parent, 'sans page : rien');
  assert.equal(poser('magies/essai', []).at(0), parent, 'sans ancre : rien');
  const [avec] = poser('magies/essai');
  assert.deepEqual(avec.enfants.map((e) => e.enfants.length), [2, 0], 'sur la magie courante seulement');
  assert.deepEqual(parent.enfants.map((e) => e.enfants.length), [0, 0], 'les entrées reçues ne changent pas');
  const contexte = { rubrique: 'jeu', adresse: (r) => `/${r}`, base: '/', ici: '/magies/essai/', entree: undefined };
  const html = htmlDesEntrees([avec], contexte);
  // l'ancre : un lien vers `#…` tel quel (jamais préfixé), jamais marqué courant ; la magie courante : lien, point de sa couleur, chevron, ouverte d'office
  assert.match(html, /<li><a class="menu-site__lien menu-site__lien--ancre" href="#presentation">Présentation<\/a><\/li>/);
  assert.match(html, /<li class="menu-site__groupe" data-cle="jeu\/magies-essai" data-contient-la-page data-ferme-au-depart><div class="menu-site__ligne"><a class="menu-site__lien menu-site__lien--point couleur-magie-essai" href="\/magies\/essai\/" aria-current="page"><span class="menu-site__point" aria-hidden="true"><\/span><span>Essai<\/span><\/a><button/);
  assert.match(html, /<li><a class="menu-site__lien menu-site__lien--point couleur-magie-autre" href="\/magies\/autre\/"><span class="menu-site__point"/, 'une autre magie : sans ancres, sans chevron');
  assert.equal(html.match(/menu-site__replier--chevron/g).length, 2, 'Les magies et la magie courante');
  // une autre page : aucune ancre dans le menu
  assert.doesNotMatch(htmlDesEntrees(poser(null), contexte), /menu-site__lien--ancre/);
});
