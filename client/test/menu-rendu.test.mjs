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
