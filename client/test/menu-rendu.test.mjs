// Le HTML des entrées du menu latéral (lib/menu-rendu.mjs, R319 (2) et (4)) : entrée à sous-pages, « bientôt », lien externe, lien de mot-clé, lien simple ; page courante et
// onglet du plan. Les entrées sont résolues comme au build (lib/menu-db.mjs#resoudreLesEntrees) d'après un vocabulaire d'essai.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resoudreLesEntrees } from '../src/lib/menu-db.mjs';
import { contientLaPage, courantDe, htmlDesEntrees, htmlDuMenuDuProfil } from '../src/lib/menu-rendu.mjs';
import { niveauxProposes } from '../src/lib/compte.mjs';
import { MENU_DU_PROFIL, entreesVisibles } from '../src/lib/nav.mjs';
import { entreesDeLaListe } from './aide-menu-html.mjs';

const motsCles = [
  { id: 9001, libelle: 'Royaume', cle: 'royaume', url: '/royaume/', couleur: null, icone: null, description: 'Le pays.' },
  { id: 9002, libelle: 'Sans définition', cle: 'sans-definition', url: '/sans/', couleur: null, icone: null },
  { id: 9003, libelle: 'Sans adresse', cle: 'sans-adresse', url: null, couleur: null, icone: null },
];
const onglets = [{ id: 'combat', titre: 'Combat d’essai' }];
const entrees = resoudreLesEntrees([
  { cle: 'intro', label: 'Introduction', enfants: [{ label: 'Premier', path: 'premier/' }, { label: 'Second', motCle: 9002, libelleArbo: true, path: 'second/' }] },
  { label: 'Le royaume', motCle: 9001, libelleArbo: true, path: 'royaume/' },
  { label: 'Combat', onglet: 'combat', path: 'regles/combat/' },
  { label: 'Pas encore' },
  { label: 'Simple <b>', path: 'simple/' },
  { label: 'Dehors', externe: 'https://exemple.test/?a=1&b=2' },
  { label: 'Mot-clé sans adresse', motCle: 9003 },
], { motsCles, onglets });
const rendre = (contexte = {}) => htmlDesEntrees(entrees, { rubrique: 'jeu', adresse: (r) => `/base/${r}`, base: '/base/', ici: undefined, entree: undefined, ...contexte });

test('une entrée à sous-pages : un bouton qui déplie (aria-expanded, aria-controls), ses sous-pages dans un bloc, sans lien à elle', () => {
  const html = rendre();
  assert.match(html, /^<li class="menu-site__groupe" data-cle="jeu\/intro"><button type="button" class="menu-site__replier" aria-expanded="true" aria-controls="menu-du-site-jeu-intro" data-menu-replier="jeu\/intro"><span>Introduction<\/span><span class="menu-site__chevron" aria-hidden="true"><\/span><\/button>/);
  assert.match(html, /<div class="menu-site__sous" id="menu-du-site-jeu-intro"><ul class="menu-site__sous-liste"><li>/);
  assert.equal(html.match(/id="menu-du-site-jeu-intro"/g).length, 1, 'le bloc nommé par son bouton');
  const liens = entreesDeLaListe(html);
  assert.deepEqual(liens.slice(0, 2).map((e) => e.href), ['/base/premier/', '/base/sans/'], 'les sous-pages, adresses préfixées de la base du site (la seconde : celle de son mot-clé, non son chemin écrit)');
  assert.ok(!html.includes('href="/base/intro/"'), 'l’entrée à sous-pages n’est pas un lien');
});

test('R319 (4) : une entrée à mot-clé est le lien d’un mot-clé d’un texte (classe, data-mot-cle, bulle), à l’adresse du mot-clé, avec le libellé de l’arborescence quand elle le garde', () => {
  const html = rendre();
  assert.match(html, /<li><a data-placement="cote" class="mot-cle" href="\/base\/royaume\/" data-mot-cle="royaume" data-bulle="mot-cle-royaume" aria-describedby="mot-cle-royaume" data-balise="\{\{royaume\|Le royaume\}\}">Le royaume<\/a><\/li>/);
  // sans définition : le lien du mot-clé, sans bulle ; l'infobulle s'ouvre sur le côté (dessous, elle couvrirait l'entrée suivante)
  assert.match(html, /<a data-placement="cote" class="mot-cle" href="\/base\/sans\/" data-mot-cle="sans-definition" data-balise="\{\{sans-definition\|Second\}\}">Second<\/a>/);
  assert.ok(!html.includes('data-bulle="mot-cle-sans-definition"'));
});

test('l’onglet d’une entrée : son libellé est le titre de la table, son adresse regles/<id>/ ; « bientôt » sans lien ; un lien simple échappé ; un lien externe', () => {
  const html = rendre();
  assert.match(html, /<li><a class="menu-site__lien" href="\/base\/regles\/combat\/">Combat d’essai<\/a><\/li>/);
  assert.ok(html.includes('<li><span class="nav-soon">Pas encore <small>(bientôt)</small></span></li>'));
  assert.ok(html.includes('<a class="menu-site__lien" href="/base/simple/">Simple &lt;b&gt;</a>'), 'le libellé est échappé');
  assert.ok(html.includes('<a class="menu-site__lien" href="https://exemple.test/?a=1&amp;b=2" rel="noopener">Dehors</a>'), 'une adresse hors du site, telle quelle (échappée)');
  // un mot-clé sans adresse ni chemin : « bientôt », comme le menu d'avant (le libellé est celui du mot-clé : pas de libelleArbo)
  assert.ok(html.includes('<span class="nav-soon">Sans adresse <small>(bientôt)</small></span>'));
});

test('la page courante : aria-current="page" sur son entrée, aria-current="true" sur l’onglet du plan qui y mène, la sous-page courante ouvre son groupe', () => {
  const ici = '/base/regles/combat/';
  const courants = (contexte) => entreesDeLaListe(rendre(contexte)).filter((e) => e.courant).map((e) => [e.href, e.courant]);
  assert.deepEqual(courants({ ici }), [['/base/regles/combat/', 'page']]);
  assert.deepEqual(courants({ ici: '/base/une-page-de-l-onglet/', entree: 'regles/combat/' }), [['/base/regles/combat/', 'true']], 'l’onglet du plan, jamais déduit de l’adresse');
  assert.deepEqual(courants({ ici: '/base/royaume/' }), [['/base/royaume/', 'page']], 'sur un lien de mot-clé aussi, la classe et la bulle gardées');
  assert.match(rendre({ ici: '/base/royaume/' }), /<a aria-current="page" data-placement="cote" class="mot-cle" href="\/base\/royaume\/"/);
  assert.deepEqual(courants({ ici: '/base/sans/' }), [['/base/sans/', 'page']]);
  assert.match(rendre({ ici: '/base/sans/' }), /<li class="menu-site__groupe" data-cle="jeu\/intro" data-contient-la-page>/, 'le groupe d’une sous-page courante : ouvert d’office');
  assert.doesNotMatch(rendre({ ici: '/base/royaume/' }), /data-contient-la-page/);
  assert.deepEqual(courants({}), [], 'sans page courante, rien n’est marqué');
  // un « bientôt » n'est jamais courant
  assert.equal(courantDe({ href: null }, { ici: '/base/', adresse: (r) => r }), null);
  // R320 (4) : une entrée qui mène à une section (« personnages/#pretires ») est la page courante, son ancre ne compte pas
  const ancree = { href: 'personnages/#pretires' };
  const adresse = (r) => `/base/${r}`;
  assert.equal(courantDe(ancree, { ici: '/base/personnages/', adresse }), 'page');
  assert.equal(courantDe(ancree, { ici: '/base/autre/', adresse }), null);
  assert.equal(courantDe({ href: 'personnages/' }, { ici: '/base/personnages/', adresse }), 'page', 'sans ancre : inchangé');
  assert.equal(contientLaPage(entrees[0], { ici: '/base/premier/', adresse: (r) => `/base/${r}` }), true);
  assert.equal(contientLaPage(entrees[1], { ici: '/base/premier/', adresse: (r) => `/base/${r}` }), false);
});

test('R319 (3) : une entrée à niveau porte data-niveau-menu et hidden (le menu d’un Observateur), de toute forme : lien, mot-clé, « bientôt », externe, groupe ; une entrée sans niveau, rien', () => {
  const resolues = resoudreLesEntrees([
    { label: 'Simple', path: 'simple/', niveau: 'joueur' },
    { label: 'Royaume', motCle: 9001, libelleArbo: true, path: 'royaume/', niveau: 'mj' },
    { label: 'Bientôt', niveau: 'joueur' },
    { label: 'Dehors', externe: 'https://exemple.test/', niveau: 'createur' },
    { cle: 'g', label: 'Groupe', niveau: 'mj', enfants: [{ label: 'Libre', path: 'libre/' }, { label: 'Fille', path: 'fille/', niveau: 'joueur' }] },
    { label: 'Libre', path: 'ouvert/' },
  ], { motsCles });
  const html = htmlDesEntrees(resolues, { rubrique: 'x', adresse: (r) => `/${r}`, base: '/', ici: '/', entree: undefined });
  assert.ok(html.includes('<li data-niveau-menu="joueur" hidden><a class="menu-site__lien" href="/simple/">Simple</a></li>'));
  assert.match(html, /<li data-niveau-menu="mj" hidden><a data-placement="cote" class="mot-cle" href="\/royaume\/"/);
  assert.ok(html.includes('<li data-niveau-menu="joueur" hidden><span class="nav-soon">Bientôt <small>(bientôt)</small></span></li>'));
  assert.ok(html.includes('<li data-niveau-menu="createur" hidden><a class="menu-site__lien" href="https://exemple.test/" rel="noopener">Dehors</a></li>'));
  assert.match(html, /<li class="menu-site__groupe" data-cle="x\/g" data-niveau-menu="mj" hidden><button/);
  assert.ok(html.includes('<ul class="menu-site__sous-liste"><li><a class="menu-site__lien" href="/libre/">Libre</a></li><li data-niveau-menu="joueur" hidden><a class="menu-site__lien" href="/fille/">Fille</a></li></ul>'), 'jusque dans les sous-pages');
  assert.ok(html.endsWith('<li><a class="menu-site__lien" href="/ouvert/">Libre</a></li>'), 'sans niveau : ni data-niveau-menu ni hidden');
  // le niveau est lu par scripts/compte.mjs : le tableau d'un observateur, jamais un attribut `hidden` sans `data-niveau-menu`
  assert.ok(![...html.matchAll(/<li( [^>]*)?>/g)].some((m) => /\bhidden\b/.test(m[1] ?? '') && !/data-niveau-menu/.test(m[1])));
  // les liens se lisent malgré `hidden` (aide-menu-html : tests *-html)
  assert.deepEqual(entreesDeLaListe(html).map((e) => e.libelle).slice(0, 2), ['Simple', 'Royaume']);
});

test('R319 (3) + R321 (1) : le niveau d’un groupe à lien et chevron est porté par son `<li>` (les sous-entrées en héritent, cachées avec lui) ; une sous-entrée modifiable à niveau garde ses deux jeux d’attributs ; `accordeon` et le niveau se cumulent', () => {
  const resolues = resoudreLesEntrees([
    { cle: 'g', label: 'Groupe', path: 'groupe/', niveau: 'mj', enfants: [{ label: 'Fille', path: 'groupe/fille/', niveau: 'joueur', edition: { id: 'e1', rang: 2, groupe: 'a' } }] },
    { cle: 'c', label: 'Catégorie', accordeon: 'classes', niveau: 'joueur', enfants: [{ label: 'Fille', path: 'c/fille/' }] },
  ], { motsCles });
  const html = htmlDesEntrees(resolues, { rubrique: 'x', adresse: (r) => `/${r}`, base: '/', ici: '/', entree: undefined });
  assert.match(html, /<li class="menu-site__groupe" data-cle="x\/g" data-ferme-au-depart data-niveau-menu="mj" hidden><div class="menu-site__ligne"><a /);
  assert.match(html, /<li data-niveau-menu="joueur" hidden data-ed-entree="e1" data-ed-rang="2" data-ed-groupe="a"><a /);
  assert.match(html, /<li class="menu-site__groupe" data-cle="x\/c" data-accordeon="classes" data-niveau-menu="joueur" hidden><button/);
});

test('les entrées du site de dev seulement sont retirées avant le rendu ([Dev] ; ni le niveau ni la production ne retirent une entrée au build : le niveau s’applique dans le navigateur)', () => {
  const resolues = resoudreLesEntrees([
    { label: 'Debug', path: 'debug/', devSeulement: true },
    { label: 'Guide', path: 'mj/', niveau: 'mj' },
    { label: 'Site', path: 'x/', prodSeulement: true },
    { cle: 'g', label: 'Groupe', enfants: [{ label: 'Dev', path: 'd/', devSeulement: true }, { label: 'Autre', path: 'a/' }] },
  ]);
  const liens = (e) => entreesDeLaListe(htmlDesEntrees(e, { rubrique: 'taverne', adresse: (r) => `/${r}`, base: '/', ici: '/', entree: undefined })).map((x) => x.href);
  assert.deepEqual(liens(entreesVisibles(resolues)), ['/debug/', '/mj/', '/x/', '/d/', '/a/']);
  assert.deepEqual(liens(entreesVisibles(resolues, { dev: false })), ['/mj/', '/x/', '/a/'], 'seul devSeulement est retiré, sous-pages comprises');
});

test('R319 (1) : le menu du profil, en blocs ; seules les entrées du public sont montrées au départ, chaque entrée porte sa catégorie ; l’externe, la déconnexion et « bientôt » sont des cas à part', () => {
  const blocs = (o = {}) => MENU_DU_PROFIL.map((b) => entreesVisibles(resoudreLesEntrees(b), o));
  const rendu = (o = {}, contexte = {}) => htmlDuMenuDuProfil(blocs(o), { adresse: (r) => `/base/${r}`, ici: '/base/recherche/', ...contexte });
  const html = rendu({ dev: true, prod: true });
  assert.equal(html.match(/<div class="site-compte__bloc"/g).length, MENU_DU_PROFIL.length, 'un bloc par bloc de MENU_DU_PROFIL');
  const entrees = [...html.matchAll(/<li data-categorie="([a-z]+)"(?: data-niveau-menu="[a-z]+")?(?: data-niveau-reel)?( hidden)?>/g)].map((m) => `${m[1]}${m[2] ? ' caché' : ''}`);
  assert.deepEqual(entrees, ['connecte caché', 'connecte caché', 'connecte caché', 'connecte caché', 'public', 'public', 'connecte caché', 'connecte caché', 'connecte caché']);
  // chaque entrée à niveau porte `data-niveau-menu` (lu par scripts/compte.mjs avec sa catégorie) ; « Voir le site en tant que… » se lit au niveau réel
  assert.deepEqual([...html.matchAll(/<li data-categorie="[a-z]+" data-niveau-menu="([a-z]+)"( data-niveau-reel)? hidden>/g)].map((m) => `${m[1]}${m[2] ? ' réel' : ''}`), MENU_DU_PROFIL.flat().filter((e) => e.niveau).map((e) => `${e.niveau}${e.action === 'voir-en-tant-que' ? ' réel' : ''}`));
  // les blocs sans entrée du public sont cachés au départ
  assert.deepEqual([...html.matchAll(/<div class="site-compte__bloc"( hidden)?>/g)].map((m) => !m[1]), MENU_DU_PROFIL.map((b) => b.some((e) => !e.niveau && !e.connecte && !e.action && !e.prodSeulement && !e.externe)));
  assert.ok(html.includes('<a class="site-compte__entree" href="/base/recherche/" aria-current="page">'), 'la page courante');
  assert.ok(html.includes('<a class="site-compte__entree" href="/base/regles/glossaire/">'));
  assert.ok(html.includes('<button type="button" class="site-compte__entree" data-deconnexion>'), 'Se déconnecter : un bouton, jamais « bientôt »');
  assert.match(html, /<a class="site-compte__entree" href="https:\/\/[^"]+" rel="noopener">/, 'Site de dev : une adresse hors du site, jamais « bientôt »');
  assert.equal([...html.matchAll(/<span class="nav-soon">/g)].length, 2, 'Mes groupes, Mes scénarios : « bientôt » (Mes personnages est un lien : la section de /personnages/ ; « Voir le site en tant que… » est un choix)');
  // « Voir le site en tant que… » (Créateur) : un <select> des niveaux qu'un Créateur peut voir, jamais « bientôt »
  const choix = html.match(/<label class="site-compte__choix">([^<]+)<select class="site-compte__niveau" data-voir-en-tant-que>(.*?)<\/select><\/label>/);
  assert.ok(choix, 'le choix de niveau');
  assert.equal(choix[1], MENU_DU_PROFIL.flat().find((e) => e.action === 'voir-en-tant-que').label);
  assert.deepEqual([...choix[2].matchAll(/<option value="([a-z]+)">/g)].map((m) => m[1]), niveauxProposes('createur'));
  assert.ok(html.includes('href="/base/personnages/#mes-personnages"'), 'Mes personnages : un lien');
  // Site de dev : seulement de la production ; ni le niveau ni autre chose n'en retire
  assert.ok(!rendu({ dev: true, prod: false }).includes('rel="noopener"'), 'sur le site de dev : pas de lien vers lui-même');
  assert.ok(rendu({ dev: false, prod: true }).includes('rel="noopener"'));
  // la version portable : le public seulement, sans bloc vide ; aucun lien vers une page absente (profil, déconnexion)
  const portable = rendu({ dev: false, prod: false }, { publicSeulement: true });
  assert.deepEqual([...portable.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/base/regles/glossaire/', '/base/recherche/']);
  assert.equal(portable.match(/<div class="site-compte__bloc"/g).length, 1);
  assert.ok(!portable.includes('hidden') && !portable.includes('data-deconnexion'));
  assert.ok(!portable.includes('data-niveau-menu') && !portable.includes('<select'), 'la version portable, sans service : le menu d’un Observateur, aucune entrée à niveau');
});

// R321 (1) et (2) : une entrée qui a sa page ET des sous-entrées garde son lien ; un chevron, bouton seul, déplie et replie ; repliée au départ sauf si la page courante y est.
const sousEntrees = [
  { motCle: null, enfants: [], href: 'regles/combat/une-page/', bientot: false, libelle: 'Une page <b>', edition: { id: 'page:guide/une-page', rang: 3 } },
  { motCle: null, enfants: [], href: null, bientot: true, libelle: 'Pas encore', edition: { id: 'bientot:x', rang: 4 } },
  { motCle: null, enfants: [], href: 'regles/artisanat/', bientot: false, libelle: 'Un lien', edition: { id: 'regles_onglet_entree:7', rang: 5, groupe: 'pures' } },
  { motCle: null, enfants: [], href: 'regles/combat/sans-edition/', bientot: false, libelle: 'Sans ligne' },
];
const avecSous = (avec = {}) => resoudreLesEntrees([
  { cle: 'intro', label: 'Introduction', enfants: [{ label: 'Premier', path: 'premier/' }] },
  { label: 'Combat', onglet: 'combat', path: 'regles/combat/', ...avec },
  { label: 'Le royaume', motCle: 9001, libelleArbo: true, path: 'royaume/', ...avec },
], { motsCles, onglets }).map((e, i) => (i === 0 ? e : { ...e, enfants: sousEntrees, sousMenu: 'onglet:combat' }));
const rendreAvecSous = (contexte = {}) => htmlDesEntrees(avecSous(), { rubrique: 'regles', adresse: (r) => `/base/${r}`, base: '/base/', ici: undefined, entree: undefined, ...contexte });

test('R321 (1) : une entrée à adresse et à sous-entrées garde son lien (de mot-clé : couleur, bulle) et un chevron seul, bouton nommé, avec aria-expanded et aria-controls', () => {
  const html = rendreAvecSous();
  // le lien d'un onglet : comme une entrée simple, hors du bouton
  assert.match(html, /<li class="menu-site__groupe" data-cle="regles\/combat" data-ferme-au-depart><div class="menu-site__ligne"><a class="menu-site__lien" href="\/base\/regles\/combat\/">Combat d’essai<\/a><button type="button" class="menu-site__replier menu-site__replier--chevron" aria-expanded="true" aria-controls="menu-du-site-regles-combat" data-menu-replier="regles\/combat" aria-label="[^"]+"><span class="menu-site__chevron" aria-hidden="true"><\/span><\/button><\/div><div class="menu-site__sous" id="menu-du-site-regles-combat">/);
  // le lien d'un mot-clé : le même que dans une entrée simple (classe, bulle, infobulle sur le côté), puis le bouton
  assert.match(html, /<div class="menu-site__ligne"><a data-placement="cote" class="mot-cle" href="\/base\/royaume\/" data-mot-cle="royaume" data-bulle="mot-cle-royaume"[^>]*>Le royaume<\/a><button type="button" class="menu-site__replier menu-site__replier--chevron"/);
  // le bouton ne porte pas le libellé (aucun texte visible) et son nom dit ce qu'il déplie
  const boutons = [...html.matchAll(/<button type="button" class="menu-site__replier menu-site__replier--chevron"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(boutons.length, 2);
  for (const [, nom, contenu] of boutons) assert.ok(nom.length > 0 && !/<\/?(?!span\b)[a-z]/i.test(contenu) && !/[A-Za-zÀ-ÿ]/.test(contenu.replace(/<[^>]*>/g, '')), 'un nom, aucun texte dans le bouton');
  assert.match(boutons[0][1], /Combat d’essai/, 'le nom du bouton nomme l’entrée');
  // un identifiant par groupe, nommé par son bouton ; Introduction (sans adresse) garde sa forme : le bouton porte son libellé, ouverte au départ
  assert.match(html, /<li class="menu-site__groupe" data-cle="regles\/intro"><button type="button" class="menu-site__replier" aria-expanded="true"/);
  assert.equal(html.match(/data-ferme-au-depart/g).length, 2, 'seules les entrées à lien sont repliées au départ');
  for (const id of ['menu-du-site-regles-combat', 'menu-du-site-regles-royaume']) assert.equal(html.match(new RegExp(`id="${id}"`, 'g')).length, 1, id);
});

test('R321 (2) : les sous-entrées d’une entrée sont repliées au départ, ouvertes d’office quand la page courante y est (sous-entrée ou entrée elle-même), l’ancre et aria-current sont gardés', () => {
  assert.doesNotMatch(rendreAvecSous(), /data-contient-la-page/, 'une page hors du menu : tout est replié (hors Introduction, que le script laisse ouverte)');
  const dedans = rendreAvecSous({ ici: '/base/regles/combat/une-page/' });
  assert.match(dedans, /<li class="menu-site__groupe" data-cle="regles\/combat" data-contient-la-page data-ferme-au-depart>/);
  assert.equal(dedans.match(/data-contient-la-page/g).length, 2, 'les deux entrées portent les mêmes sous-entrées : les deux contiennent la page');
  assert.match(dedans, /<a class="menu-site__lien" href="\/base\/regles\/combat\/une-page\/" aria-current="page">Une page &lt;b&gt;<\/a>/, 'la sous-entrée courante : aria-current="page", libellé échappé');
  // l'entrée elle-même courante : son lien est marqué, son groupe ouvert d'office
  const elle = rendreAvecSous({ ici: '/base/regles/combat/' });
  assert.match(elle, /<a class="menu-site__lien" href="\/base\/regles\/combat\/" aria-current="page">/);
  assert.match(elle, /data-cle="regles\/combat" data-contient-la-page/);
  // l'onglet du plan d'une page hors du menu : le lien est « true », le groupe ouvert
  const onglet = rendreAvecSous({ ici: '/base/une-autre/', entree: 'regles/combat/' });
  assert.match(onglet, /<a class="menu-site__lien" href="\/base\/regles\/combat\/" aria-current="true">/);
  assert.match(onglet, /data-cle="regles\/combat" data-contient-la-page/);
  assert.equal(contientLaPage(avecSous()[1], { ici: '/base/regles/combat/une-page/', adresse: (r) => `/base/${r}` }), true);
});

test('R321 (2) : la page d’ouverture d’un onglet, affichée à l’adresse de l’onglet (`affichee`), marque sa sous-entrée aria-current="page", comme sur sa propre adresse', () => {
  // /regles/combat/ montre « Une page » (à regles/combat/une-page/) : son entrée est la page courante, l'onglet aussi (c'est l'adresse), ouverts d'office ; sans `affichee`, aucune sous-entrée
  const ouverture = rendreAvecSous({ ici: '/base/regles/combat/', affichee: 'regles/combat/une-page/' });
  assert.match(ouverture, /<a class="menu-site__lien" href="\/base\/regles\/combat\/une-page\/" aria-current="page">Une page &lt;b&gt;<\/a>/, 'la sous-entrée de la page affichée');
  assert.match(ouverture, /<a class="menu-site__lien" href="\/base\/regles\/combat\/" aria-current="page">/, 'l’onglet, à son adresse');
  assert.equal(courantDe({ href: 'regles/combat/une-page/' }, { ici: '/base/regles/combat/', affichee: 'regles/combat/une-page/', adresse: (r) => `/base/${r}` }), 'page');
  assert.equal(courantDe({ href: 'regles/combat/une-page/' }, { ici: '/base/regles/combat/', adresse: (r) => `/base/${r}` }), null, 'sans `affichee` : l’adresse seule');
  assert.equal(courantDe({ href: 'regles/combat/autre/' }, { ici: '/base/regles/combat/', affichee: 'regles/combat/une-page/', adresse: (r) => `/base/${r}` }), null, 'une autre page de l’onglet : pas courante');
  assert.equal(courantDe({ href: null }, { affichee: null, adresse: (r) => r }), null, 'une entrée sans adresse : jamais');
  assert.match(ouverture, /data-cle="regles\/combat" data-contient-la-page/);
});

test('R321 (6) : une entrée sans lien qui demande `repliee` (Introduction) est repliée au départ comme les autres, ouverte d’office quand la page courante est dans ses sous-pages ; sans `repliee`, elle reste ouverte', () => {
  const intro = (repliee) => resoudreLesEntrees([{ cle: 'introduction', label: 'Introduction', ...(repliee ? { repliee: true } : {}), enfants: [{ label: 'Premier', path: 'premier/' }, { label: 'Second', path: 'second/' }] }], { motsCles, onglets });
  const rendreIntro = (repliee, ici) => htmlDesEntrees(intro(repliee), { rubrique: 'jeu', adresse: (r) => `/base/${r}`, base: '/base/', ici, entree: undefined });
  assert.match(rendreIntro(true), /^<li class="menu-site__groupe" data-cle="jeu\/introduction" data-ferme-au-depart><button type="button" class="menu-site__replier" aria-expanded="true"/, 'repliée au départ, toujours un bouton qui porte son libellé');
  assert.doesNotMatch(rendreIntro(true), /data-contient-la-page/, 'une autre page : aucune ouverture d’office');
  assert.match(rendreIntro(true, '/base/second/'), /^<li class="menu-site__groupe" data-cle="jeu\/introduction" data-contient-la-page data-ferme-au-depart>/, 'sur une de ses sous-pages : ouverte d’office (le script ouvre ce qui contient la page)');
  assert.doesNotMatch(rendreIntro(false), /data-ferme-au-depart/, 'sans `repliee`, le rendu ne replie pas');
});

test('R321 (3) : la liste d’une entrée porte son menu modifiable (data-ed-menu), chaque sous-entrée l’id, le rang et le groupe de sa ligne ; une entrée « bientôt » les porte aussi ; sans ligne, aucun attribut', () => {
  const html = rendreAvecSous();
  assert.equal(html.match(/<ul class="menu-site__sous-liste" data-ed-menu="onglet:combat">/g).length, 2);
  assert.match(html, /<li data-ed-entree="page:guide\/une-page" data-ed-rang="3"><a class="menu-site__lien" href="\/base\/regles\/combat\/une-page\/">/);
  assert.match(html, /<li data-ed-entree="bientot:x" data-ed-rang="4"><span class="nav-soon">Pas encore <small>\(bientôt\)<\/small><\/span><\/li>/, 'sans lien, grisée');
  assert.match(html, /<li data-ed-entree="regles_onglet_entree:7" data-ed-rang="5" data-ed-groupe="pures"><a class="menu-site__lien" href="\/base\/regles\/artisanat\/">Un lien<\/a><\/li>/);
  assert.match(html, /<li><a class="menu-site__lien" href="\/base\/regles\/combat\/sans-edition\/">Sans ligne<\/a><\/li>/);
  // Introduction n'est pas un menu modifiable
  assert.doesNotMatch(html.slice(0, html.indexOf('data-cle="regles/combat"')), /data-ed-/);
});
