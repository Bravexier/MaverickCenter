// Les sous-entrées du menu latéral du site (lib/menu-sous-entrees.mjs ; R321, lot 2 du menu) : les pages de chaque onglet des Règles et les races, imbriquées dans
// « leur » entrée, par étapes ; les anciens menus de page (components/guide/MenuLateral.astro, components/race/MenuDesRaces.astro) n'existent plus.
// Le plan est lu dans l'état d'import de la base (test/aide-base-d-import.mjs : le site de dev le range, le renomme) ; les invariants se lisent sur lui, jamais un libellé.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { editionDuMenuLateral, entreesDuMenuLateral, installerLePlan, ongletsDesRegles } from '../src/lib/livres.mjs';
import { resoudreLesEntrees } from '../src/lib/menu-db.mjs';
import { htmlDesEntrees } from '../src/lib/menu-rendu.mjs';
import { poserLesAncres, poserLesSousEntrees, sousEntreesDesClasses, sousEntreesDesPages, sousEntreesDesRaces, sousEntreesDuSite } from '../src/lib/menu-sous-entrees.mjs';
import { NAV, entreesAPlat } from '../src/lib/nav.mjs';
import { chargerPlanDesRegles } from '../src/lib/plan-des-regles-db.mjs';
import { GROUPES_DE_RACES, menusModifiablesDeLaPage } from '../src/lib/ordre-des-menus.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { sousEntreesDeLaListe } from './aide-menu-html.mjs';

const db = baseDImport();
installerLePlan(chargerPlanDesRegles(db));
const pagesDuGuide = db.prepare("SELECT id, titre, resume, statut FROM page WHERE type = 'guide' ORDER BY id").all()
  .map((p) => ({ id: p.id, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
// des races d'essai (noms inventés) : une pure, une hybride (la seule que le code reconnaît sans classe raciale : R14), une autre pure
const races = [
  { id: 'races/humain', data: { title: 'Pure d’essai', mots_cles: [] } },
  { id: 'races/drassahthac', data: { title: 'Hybride d’essai', mots_cles: [] } },
  { id: 'races/elfe-noir', data: { title: 'Autre pure d’essai', mots_cles: [] } },
];
const rangs = new Map([['races/elfe-noir', 1], ['races/humain', 2], ['races/drassahthac', 1]]);
const ordreDesRaces = (a, b) => (rangs.get(a.id) ?? 99) - (rangs.get(b.id) ?? 99);

test('R321 (2) : les sous-entrées d’un onglet, une par entrée du plan (page, lien, « bientôt »), dans l’ordre, avec l’id et le rang de leur ligne (R321 (3))', () => {
  for (const onglet of ongletsDesRegles()) {
    const pages = entreesDuMenuLateral(onglet, pagesDuGuide);
    const edition = editionDuMenuLateral(onglet, pagesDuGuide);
    const sous = sousEntreesDesPages(pages, edition);
    assert.equal(sous.length, pages.length, onglet.id);
    sous.forEach((s, i) => {
      const p = pages[i];
      if (p.id) assert.deepEqual([s.href, s.libelle, s.bientot], [cheminDePage(p.id), p.data.title, false], `${onglet.id} : page ${p.id}`);
      else if (p.adresse) assert.deepEqual([s.href, s.libelle, s.bientot], [p.adresse, p.libelle, false], `${onglet.id} : lien`);
      else assert.deepEqual([s.href, s.libelle, s.bientot], [null, p.bientot, true], `${onglet.id} : « bientôt »`);
      assert.deepEqual([s.edition.id, s.edition.rang], [edition.entrees[i].id, edition.entrees[i].rang], `${onglet.id} : la ligne de l’entrée ${i}`);
      assert.deepEqual([s.motCle, s.enfants], [null, []]);
    });
  }
  // sans ligne (un plan d'essai, la 404) : aucun attribut d'édition ; une entrée « bientôt » et un lien à la main
  const seules = sousEntreesDesPages([{ bientot: 'À venir' }, { libelle: 'Un lien', adresse: 'regles/x/' }]);
  assert.deepEqual(seules.map((s) => ['edition' in s, s.href, s.bientot]), [[false, null, true], [false, 'regles/x/', false]]);
});

test('R321 (5) : les sous-entrées des races, une seule liste (les pures puis les hybrides), l’id, le rang dans la liste et le groupe de chaque race pour le mode modification', () => {
  const { parSource } = sousEntreesDuSite({ entries: [...pagesDuGuide, ...races], ordreDesRaces, rangDe: (id) => rangs.get(id) ?? null });
  const { menu, enfants } = parSource.races;
  assert.equal(menu, 'races');
  assert.deepEqual(enfants.map((e) => e.edition.id), ['races/elfe-noir', 'races/humain', 'races/drassahthac'], 'les pures dans l’ordre de la liste, puis les hybrides');
  assert.deepEqual(enfants.map((e) => e.edition.groupe), ['pures', 'pures', 'hybrides']);
  assert.ok(enfants.every((e) => GROUPES_DE_RACES.includes(e.edition.groupe)));
  assert.deepEqual(enfants.map((e) => e.edition.rang), [1, 2, 1], 'le rang de la liste, race.rang_liste');
  assert.deepEqual(enfants.map((e) => e.href), enfants.map((e) => cheminDePage(e.edition.id)));
  assert.deepEqual(enfants.map((e) => e.libelle), ['Autre pure d’essai', 'Pure d’essai', 'Hybride d’essai'], 'le titre de la page');
  assert.deepEqual(sousEntreesDesRaces([], () => null), []);
  assert.equal(sousEntreesDesRaces([{ key: 'pures', entries: [races[0]] }]).at(0).edition.rang, null, 'sans rang : null');
});

test('R321 : sousEntreesDuSite tire de la base un menu par onglet du plan (`onglet:<id>`), sans rien inventer', () => {
  const { parOnglet } = sousEntreesDuSite({ entries: pagesDuGuide, ordreDesRaces, rangDe: () => null });
  assert.deepEqual(Object.keys(parOnglet), ongletsDesRegles().map((o) => o.id));
  for (const onglet of ongletsDesRegles()) {
    assert.equal(parOnglet[onglet.id].menu, `onglet:${onglet.id}`);
    assert.equal(parOnglet[onglet.id].enfants.length, entreesDuMenuLateral(onglet, pagesDuGuide).length, onglet.id);
  }
  // une page absente est sautée de la liste ET de son édition : elles restent alignées
  const sansUne = pagesDuGuide.filter((p) => p.id !== ongletsDesRegles()[0].ouverture);
  const reduit = sousEntreesDuSite({ entries: sansUne, ordreDesRaces, rangDe: () => null }).parOnglet[ongletsDesRegles()[0].id].enfants;
  assert.equal(reduit.length, parOnglet[ongletsDesRegles()[0].id].enfants.length - 1);
  assert.ok(!reduit.some((e) => e.edition.id === `page:${ongletsDesRegles()[0].ouverture}`));
});

test('R321 (1), (2) : poserLesSousEntrees pose les sous-entrées sur l’entrée d’un onglet et sur celle qui désigne `sous`, laisse Introduction et les entrées simples, ne change pas les entrées reçues', () => {
  const entrees = resoudreLesEntrees([
    { cle: 'intro', label: 'Introduction', enfants: [{ label: 'Premier', path: 'premier/' }] },
    { label: 'Onglet', onglet: 'o1', path: 'regles/o1/' },
    { label: 'Onglet vide', onglet: 'o2', path: 'regles/o2/' },
    { label: 'Races', path: 'races/', sous: 'races' },
    { label: 'Simple', path: 'simple/' },
  ], { onglets: [{ id: 'o1', titre: 'Premier onglet' }, { id: 'o2', titre: 'Second onglet' }] });
  const enfants = [{ href: 'regles/a/', libelle: 'A', bientot: false, motCle: null, enfants: [] }];
  const posees = poserLesSousEntrees(entrees, { parOnglet: { o1: { menu: 'onglet:o1', enfants }, o2: { menu: 'onglet:o2', enfants: [] } }, parSource: { races: { menu: 'races', enfants } } });
  assert.deepEqual(posees.map((e) => [e.libelle, e.enfants.length, e.sousMenu ?? null]), [['Introduction', 1, null], ['Premier onglet', 1, 'onglet:o1'], ['Second onglet', 0, null], ['Races', 1, 'races'], ['Simple', 0, null]]);
  assert.equal(posees[0].enfants[0].libelle, 'Premier', 'Introduction : ses enfants écrits, intacts');
  assert.deepEqual(entrees.map((e) => e.enfants.length), [1, 0, 0, 0, 0], 'les entrées reçues ne changent pas');
  // rendu : un chevron par entrée qui porte des sous-entrées avec une adresse, Introduction à part
  const html = htmlDesEntrees(posees, { rubrique: 'jeu', adresse: (r) => `/${r}`, base: '/', ici: '/regles/a/', entree: undefined });
  assert.equal(html.match(/menu-site__replier--chevron/g).length, 2);
  assert.equal(html.match(/<ul class="menu-site__sous-liste" data-ed-menu="[^"]+">/g).length, 2);
});

test('R321 : le menu du site posé sur les entrées du plan de nav.mjs : un chevron par onglet des Règles et par « Les races », la page courante ouvre son groupe, les listes sont modifiables', () => {
  const ongletsDuMenu = entreesAPlat(NAV.flatMap((g) => g.items)).filter((e) => e.onglet);
  assert.deepEqual(ongletsDuMenu.map((e) => e.onglet).sort(), ongletsDesRegles().map((o) => o.id).sort(), 'chaque onglet du plan a son entrée dans le menu, et chaque entrée un onglet du plan');
  const sous = entreesAPlat(NAV.flatMap((g) => g.items)).filter((e) => e.sous).map((e) => e.sous);
  assert.deepEqual(sous.sort(), ['classes', 'magies', 'races'], 'les entrées qui portent des sous-entrées tirées de la base, hors onglets');
  const source = sousEntreesDuSite({ entries: [...pagesDuGuide, ...races], ordreDesRaces, rangDe: () => null, magies: [{ id: 'magies/essai', nom: 'Magie d’essai', classe: 'couleur-magie-essai' }],
    groupesDeClasses: [{ key: 'melee', label: 'Mêlée d’essai', classe: 'couleur-classe-melee', sections: [{ key: 'melee', label: null, entries: [{ id: 'classes/essai-a', data: { title: 'Classe d’essai' } }] }] }] });
  const onglets = ongletsDesRegles().map((o) => ({ id: o.id, titre: o.titre }));
  const rubrique = (g) => poserLesSousEntrees(resoudreLesEntrees(g.items, { onglets }), source);
  const ici = cheminDePage(ongletsDesRegles()[1].ouverture);
  const html = NAV.map((g) => htmlDesEntrees(rubrique(g), { rubrique: g.key, adresse: (r) => `/${r}`, base: '/', ici: `/${ici}`, entree: ongletsDesRegles()[1].chemin })).join('');
  const groupes = [...html.matchAll(/<li class="menu-site__groupe" data-cle="([^"]+)"( data-contient-la-page)?( data-ferme-au-depart)?>/g)];
  const avecLien = groupes.filter((m) => m[3] && !m[1].startsWith('jeu/classes-')); // sans les catégories de classes, sous-groupes sans lien (étape 4)
  assert.equal(avecLien.length, ongletsDesRegles().length + 4, 'un groupe replié au départ par onglet, et Introduction (R321 (6)), « Les races », « Les magies », « Les classes »');
  assert.deepEqual(avecLien.filter((m) => m[2]).map((m) => m[1].split('/')[1]), [ongletsDesRegles()[1].id], 'seul l’onglet de la page courante est ouvert d’office');
  assert.equal(html.match(/data-ed-menu="onglet:[a-z0-9-]+"/g).length, ongletsDesRegles().length);
  assert.equal(html.match(/data-ed-menu="races"/g).length, 1);
  assert.equal(html.match(/menu-site__point/g).length, 2, 'une magie et une catégorie de classes : un point de la couleur de leur classe, sans menu modifiable');
  assert.equal(html.match(/aria-current="page"/g).length, 1, 'la page courante n’est marquée qu’une fois');
  // les races : le groupe d'une race est dans son attribut, jamais un titre de liste
  assert.equal([...html.matchAll(/data-ed-groupe="([a-z]+)"/g)].map((m) => m[1]).filter((g) => !GROUPES_DE_RACES.includes(g)).length, 0);
});

test('R321 (6) : le mode modification n’offre que le menu de la page affichée (celui de son onglet des Règles, celui des races) : sur une page de magie, de classe ou autre, aucun menu modifiable', () => {
  const source = sousEntreesDuSite({ entries: [...pagesDuGuide, ...races], ordreDesRaces, rangDe: () => null, magies: [{ id: 'magies/essai', nom: 'Magie d’essai', classe: 'couleur-magie-essai' }],
    groupesDeClasses: [{ key: 'melee', label: 'Mêlée d’essai', classe: 'couleur-classe-melee', sections: [{ key: 'melee', label: null, entries: [{ id: 'classes/essai-a', data: { title: 'Classe d’essai' } }] }] }] });
  const onglets = ongletsDesRegles().map((o) => ({ id: o.id, titre: o.titre }));
  const menusDe = (ici, entree) => {
    const html = NAV.map((g) => htmlDesEntrees(poserLesSousEntrees(resoudreLesEntrees(g.items, { onglets }), source), { rubrique: g.key, adresse: (r) => `/${r}`, base: '/', ici, entree })).join('');
    const listes = sousEntreesDeLaListe(html);
    return { toutes: listes.map((l) => l.menu), modifiables: menusModifiablesDeLaPage(listes).map((l) => l.menu) };
  };
  const [premier, second] = ongletsDesRegles();
  // une page des Règles : le menu de son onglet seul, même si le menu du site porte toutes les listes
  const regle = menusDe(`/${cheminDePage(second.ouverture)}`, second.chemin);
  assert.equal(regle.toutes.length, ongletsDesRegles().length + 1, 'le menu du site porte chaque liste, sur toutes les pages (le plan vivant les redessine)');
  assert.deepEqual(regle.modifiables, [`onglet:${second.id}`]);
  // la page de l'onglet lui-même (son lien, hors de la liste) : son menu
  assert.deepEqual(menusDe(`/${premier.chemin}`, undefined).modifiables, [`onglet:${premier.id}`]);
  // une page d'un onglet qui n'est pas une entrée du menu, marquée par l'onglet du plan (`entree`) : le menu de cet onglet
  assert.deepEqual(menusDe('/regles/hors-menu/', premier.chemin).modifiables, [`onglet:${premier.id}`]);
  // une race, et la liste des races : le menu des races
  assert.deepEqual(menusDe(`/${cheminDePage('races/humain')}`, undefined).modifiables, ['races']);
  assert.deepEqual(menusDe('/races/', undefined).modifiables, ['races']);
  // une magie, une classe, l'accueil, une page quelconque : aucun menu modifiable
  for (const ici of ['/magies/essai/', '/classes/essai-a/', '/magies/', '/classes/', '/', '/glossaire/']) assert.deepEqual(menusDe(ici, undefined).modifiables, [], ici);
});

test('R321 (6) : menusModifiablesDeLaPage ne garde que les listes d’un menu connu dont l’entrée contient la page', () => {
  const listes = [
    { menu: 'onglet:combats', contientLaPage: true }, { menu: 'onglet:exploration', contientLaPage: false }, { menu: 'races', contientLaPage: true },
    { menu: 'magies', contientLaPage: true }, { menu: 'onglet:mal formé', contientLaPage: true }, { menu: null, contientLaPage: true }, { menu: 'races' }, null,
  ];
  assert.deepEqual(menusModifiablesDeLaPage(listes).map((l) => l.menu), ['onglet:combats', 'races']);
  assert.deepEqual(menusModifiablesDeLaPage(undefined), []);
});

test('R321 (3) : l’ancien menu de page disparaît tout à fait : plus de composant, de feuille ni de classe `lateral-menu` ; le menu du site garde son script sans import', () => {
  const src = new URL('../src/', import.meta.url).pathname;
  for (const f of ['components/guide/MenuLateral.astro', 'components/race/MenuDesRaces.astro', 'styles/guide/menu-lateral.css']) assert.ok(!existsSync(join(src, f)), `${f} est retiré`);
  const fichiers = (dossier) => readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
  const anciens = /lateral-menu|data-lateral-repli|lateral-page|class="lateral"|MenuLateral\.astro|MenuDesRaces/;
  const restes = fichiers(src).filter((f) => /\.(astro|mjs|ts|css)$/.test(f)).filter((f) => anciens.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*|<!--)/.test(l)).join('\n')));
  assert.deepEqual(restes.map((f) => f.slice(src.length)), [], 'aucun code ne pose ni ne lit l’ancien menu de page (les commentaires seuls restent permis)');
  // la page ne le pose plus : le gabarit du guide, l'Artisanat et la page de race
  for (const f of ['components/guide/PageDuPlan.astro', 'pages/regles/artisanat.astro', 'pages/[type]/[slug].astro']) assert.doesNotMatch(readFileSync(join(src, f), 'utf8'), /<MenuLateral|<MenuDesRaces/, f);
  // Base.astro pose les sous-entrées sur chaque page ; MenuDuSite ne fait plus démarrer le menu réduit pour les onglets ni les races, mais garde les autres (R321 (4) : la chronologie)
  assert.match(readFileSync(join(src, 'layouts/Base.astro'), 'utf8'), /avecLesSousEntrees\(entreesVisibles\(menuDuSite\(g\.items\)/);
  const script = readFileSync(join(src, 'components/MenuDuSite.astro'), 'utf8').match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
  const propre = script.match(/var MENU_PROPRE = '([^']+)'/)[1];
  assert.ok(!propre.split(',').map((x) => x.trim()).includes('main > .lateral'));
  for (const reste of ['main > .chrono', 'main .armes-menu']) assert.ok(propre.includes(reste), reste);
  for (const parti of ['.magie-cadre', '.classe-cadre']) assert.ok(!propre.includes(parti), `étapes 3 et 4 : ${parti} n’a plus de menu propre`);
  assert.doesNotMatch(script, /\bimport\b/, 'le script du menu du site est en ligne, sans import');
});

// Étape 3 (magies) et étape 4 (classes) du lot 2 du menu (R321)
test('R321 (étape 4) : les classes, un sous-groupe repliable par catégorie (sans lien, point de sa couleur), ses classes dessous ; ouvert d’office quand la classe courante y est', () => {
  const groupes = [
    { key: 'melee', label: 'Mêlée d’essai', classe: 'couleur-classe-melee', sections: [{ key: 'melee', label: null, entries: [{ id: 'classes/essai-a', data: { title: 'Classe A d’essai' } }, { id: 'classes/essai-b', data: { title: 'Classe B d’essai' } }] }] },
    { key: 'speciales', label: 'Spéciales d’essai', classe: 'couleur-classe-speciales', sections: [
      { key: 'speciales', label: null, entries: [{ id: 'classes/essai-c', data: { title: 'Classe C d’essai' } }] }, { key: 'non-classees', label: 'Non classées', entries: [{ id: 'classes/essai-d', data: { title: 'Classe D d’essai' } }] }] },
  ];
  const sous = sousEntreesDesClasses(groupes);
  assert.deepEqual(sous.map((g) => [g.libelle, g.href, g.repliee, g.classe, g.enfants.length]), [['Mêlée d’essai', null, true, 'couleur-classe-melee', 2], ['Spéciales d’essai', null, true, 'couleur-classe-speciales', 2]]);
  assert.deepEqual(sous[1].enfants.map((e) => e.href), ['classes/essai-c/', 'classes/essai-d/'], 'les sections à plat');
  assert.deepEqual(sousEntreesDesClasses([]), []);
  const entrees = poserLesSousEntrees(resoudreLesEntrees([{ label: 'Les classes', path: 'classes/', sous: 'classes', cle: 'classes' }]), { parSource: { classes: { menu: null, enfants: sous } } });
  const rendre = (ici) => htmlDesEntrees(entrees, { rubrique: 'jeu', adresse: (r) => `/${r}`, base: '/', ici, entree: undefined });
  const html = rendre('/classes/essai-d/');
  // « Les classes » : lien et chevron ; une catégorie : un bouton nommé par son libellé (aucun lien), son point, repliée au départ ; celle de la page courante ouverte d'office
  assert.match(html, /<li class="menu-site__groupe" data-cle="jeu\/classes" data-contient-la-page data-ferme-au-depart><div class="menu-site__ligne"><a class="menu-site__lien" href="\/classes\/">/);
  assert.match(html, /<li class="menu-site__groupe" data-cle="jeu\/classes-melee" data-ferme-au-depart data-accordeon="classes"><button type="button" class="menu-site__replier" aria-expanded="true" aria-controls="menu-du-site-jeu-classes-melee" data-menu-replier="jeu\/classes-melee"><span class="menu-site__etiquette"><span class="menu-site__point couleur-classe-melee" aria-hidden="true"><\/span><span>Mêlée d’essai<\/span><\/span>/);
  assert.match(html, /<li class="menu-site__groupe" data-cle="jeu\/classes-speciales" data-contient-la-page data-ferme-au-depart data-accordeon="classes">/);
  assert.equal(html.match(/data-contient-la-page/g).length, 2, 'Les classes et la catégorie de la classe courante, pas l’autre');
  // R321 (6) : les catégories (et elles seules) sont un accordéon, marqué au build : une seule ouverte à la fois (script de MenuDuSite.astro)
  assert.ok(sous.every((g) => g.accordeon === 'classes'), 'chaque catégorie porte son accordéon');
  assert.equal(html.match(/data-accordeon="classes"/g).length, sous.length, 'une marque par catégorie');
  assert.doesNotMatch(html, /data-cle="jeu\/classes" [^>]*data-accordeon|data-cle="jeu\/classe-[^"]*" [^>]*data-accordeon/, 'ni « Les classes » ni une classe');
  assert.match(html, /<a class="menu-site__lien" href="\/classes\/essai-d\/" aria-current="page">Classe D d’essai<\/a>/);
  assert.ok(!html.includes('data-ed-menu'), 'aucun menu modifiable');
  assert.doesNotMatch(rendre('/'), /data-contient-la-page/);
  // R321 (6) : forme compacte (un point et le nom, ni nombre de classes dans le libellé ni dans le bouton) ; chaque classe porte `page` et `cle` pour recevoir ses ancres
  assert.ok(sous.every((g) => !/\d/.test(g.libelle)), 'les catégories de classes sans leur nombre');
  assert.doesNotMatch(html, /\(\d+\)|<small>/, 'aucun compte dans le menu');
  assert.deepEqual(sous[0].enfants.map((e) => [e.page, e.cle]), [['classes/essai-a', 'classe-essai-a'], ['classes/essai-b', 'classe-essai-b']]);
  const cles = [...html.matchAll(/data-cle="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(cles).size, cles.length, 'chaque groupe a sa clé (pas de collision avec une catégorie)');
});

test('R321 (6) : les ancres d’une classe se posent sous la classe affichée seulement, sous sa catégorie ouverte d’office ; la classe devient un groupe (lien + chevron) ouvert', () => {
  const groupes = [{ key: 'melee', label: 'Mêlée d’essai', classe: 'couleur-classe-melee', sections: [{ key: 'melee', label: null, entries: [{ id: 'classes/essai-a', data: { title: 'Classe A' } }, { id: 'classes/essai-b', data: { title: 'Classe B' } }] }] }];
  const sous = sousEntreesDesClasses(groupes);
  const ancres = [{ ancre: '#presentation', libelle: 'Présentation' }, { ancre: '#dons', libelle: 'Dons' }, { ancre: '#specialite-lame', libelle: 'Lame <b>' }];
  const entrees = poserLesSousEntrees(resoudreLesEntrees([{ label: 'Les classes', path: 'classes/', sous: 'classes', cle: 'classes' }]), { parSource: { classes: { menu: null, enfants: sous } } });
  const rendre = (ici, posees) => htmlDesEntrees(posees, { rubrique: 'jeu', adresse: (r) => `/${r}`, base: '/', ici, entree: undefined });
  const html = rendre('/classes/essai-b/', poserLesAncres(entrees, 'classes/essai-b', ancres));
  assert.match(html, /<li class="menu-site__groupe" data-cle="jeu\/classe-essai-b" data-contient-la-page data-ferme-au-depart><div class="menu-site__ligne"><a class="menu-site__lien" href="\/classes\/essai-b\/" aria-current="page">Classe B<\/a><button type="button" class="menu-site__replier menu-site__replier--chevron"/);
  assert.equal(html.match(/menu-site__lien--ancre/g).length, 3, 'les ancres de la classe affichée, d’elle seule');
  assert.match(html, /<li><a class="menu-site__lien menu-site__lien--ancre" href="#specialite-lame">Lame &lt;b&gt;<\/a><\/li>/, 'libellé échappé');
  assert.match(html, /data-cle="jeu\/classes-melee" data-contient-la-page data-ferme-au-depart data-accordeon="classes">/, 'sa catégorie est ouverte d’office');
  assert.doesNotMatch(html, /data-cle="jeu\/classe-essai-a"/, 'l’autre classe reste une entrée simple');
  assert.ok(!html.includes('data-ed-menu'), 'aucun menu modifiable, donc aucune poignée (R321 (6))');
  // une classe sans ancre (une seule section) reste une entrée simple ; ailleurs, aucune ancre
  assert.doesNotMatch(rendre('/classes/essai-b/', poserLesAncres(entrees, 'classes/essai-b', [])), /menu-site__lien--ancre|data-cle="jeu\/classe-essai-b"/);
  assert.doesNotMatch(rendre('/classes/essai-a/', entrees), /menu-site__lien--ancre/);
});

test('R321 (6) : une ancre garde ses `enfants` (les spécialités, sous-ancres de « Dons ») ; rendues dépliées sous elle, jamais un groupe repliable', () => {
  const groupes = [{ key: 'melee', label: 'Mêlée d’essai', classe: 'couleur-classe-melee', sections: [{ key: 'melee', label: null, entries: [{ id: 'classes/essai-a', data: { title: 'Classe A' } }] }] }];
  const entrees = poserLesSousEntrees(resoudreLesEntrees([{ label: 'Les classes', path: 'classes/', sous: 'classes', cle: 'classes' }]), { parSource: { classes: { menu: null, enfants: sousEntreesDesClasses(groupes) } } });
  const ancres = [{ ancre: '#presentation', libelle: 'Présentation' }, { ancre: '#dons', libelle: 'Dons', enfants: [{ ancre: '#specialite-lame', libelle: 'Lame <b>' }, { ancre: '#specialite-arc', libelle: 'Arc' }] }];
  const posees = poserLesAncres(entrees, 'classes/essai-a', ancres);
  const classe = posees[0].enfants[0].enfants[0];
  assert.deepEqual(classe.enfants.map((a) => [a.ancre, a.enfants.map((s) => s.ancre)]), [['#presentation', []], ['#dons', ['#specialite-lame', '#specialite-arc']]], 'les sous-ancres suivent leur ancre');
  assert.ok(classe.enfants.every((a) => a.href === null && a.bientot === false && a.motCle === null), 'chaque ancre : sans adresse de page');
  const html = htmlDesEntrees(posees, { rubrique: 'jeu', adresse: (r) => `/${r}`, base: '/', ici: '/classes/essai-a/', entree: undefined });
  assert.match(html, /<li><a class="menu-site__lien menu-site__lien--ancre" href="#dons">Dons<\/a><ul class="menu-site__sous-liste menu-site__sous-ancres"><li><a class="menu-site__lien menu-site__lien--ancre" href="#specialite-lame">Lame &lt;b&gt;<\/a><\/li><li><a class="menu-site__lien menu-site__lien--ancre" href="#specialite-arc">Arc<\/a><\/li><\/ul><\/li>/);
  assert.equal(html.match(/menu-site__lien--ancre/g).length, 4, 'les quatre ancres, aucune comptée deux fois');
  assert.doesNotMatch(html, /data-cle="jeu\/(?:classes-|classe-)?[a-z-]*dons|data-menu-replier="[^"]*dons/, 'une ancre à sous-ancres n’est pas un groupe repliable');
});

test('R321 (étapes 3 à 5) : le code ne garde plus de menu propre de magie ni de classe ; la famille `classe` de la palette est émise par le menu du site', () => {
  const src = new URL('../src/', import.meta.url).pathname;
  for (const f of ['styles/classe/menu.css']) assert.ok(!existsSync(join(src, f)), `${f} est retiré`);
  const classePage = readFileSync(join(src, 'components/classes/ClassePage.astro'), 'utf8');
  assert.doesNotMatch(classePage, /classes-menu|classes-ouvrir|classes-voile|classe-cadre|groupes=/, 'la page de classe n’a plus de menu ni de tiroir à elle');
  assert.doesNotMatch(readFileSync(join(src, 'components/magie/MagiePage.astro'), 'utf8'), /magies-panneau|magie-nav|magies-repli/, 'la page de magie non plus');
  const menu = readFileSync(join(src, 'components/MenuDuSite.astro'), 'utf8');
  assert.match(menu, /<nav [^>]*data-menu-site[^>]*>[\s\S]*<style is:inline set:html=\{cssDuMenu\(\)\}><\/style>\s*<\/nav>/, 'la feuille du menu (FAMILLES_DU_MENU) : dans le menu, son propre <style>');
  assert.doesNotMatch(menu.slice(0, menu.indexOf('<nav ')), /<style/, 'aucun <style> avant le menu');
  assert.match(readFileSync(join(src, 'pages/[type]/[slug].astro'), 'utf8'), /<Base [^>]*ancres=\{ancres\}>/, 'les sections d’une magie : des ancres du menu');
  // le mode modification ouvre le menu par un événement sur `document`, sans module commun (skill site-version-portable)
  const menus = readFileSync(join(src, 'scripts/edition/menus.mjs'), 'utf8');
  assert.match(menus, /new CustomEvent\('menu-du-site:edition', \{ detail: \{ actif: true \} \}\)/);
  assert.match(menus, /new CustomEvent\('menu-du-site:edition', \{ detail: \{ actif: false \} \}\)/);
});
