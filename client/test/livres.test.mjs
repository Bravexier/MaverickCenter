// Le plan des pages du guide (lib/livres.mjs ; demandes du propriétaire, 2026-10-16 puis 2026-10-18 : « éclater le guide », puis « refaire toutes les
// anciennes pages du guide. Retirer le mécanisme de swipe, et les flèches suivant / précédent et la pagination ») : plus de livre ; Découvrir (une page
// par entrée du menu), les onglets des Règles (R184, R185 : plan de la base, installé dans lib/livres.mjs ; un menu latéral par onglet), le Guide du MJ
// en sommaire ; les adresses de chaque page `guide/…` de la base (à plat sous /regles/, plus aucune sous /guide/) ; les pages fusionnées dans une autre,
// supprimées, retirées ; les renvois figés des anciennes adresses par la page 404 ; le menu qui s'accorde au plan.
//   node --test test/livres.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import GithubSlugger from 'github-slugger';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import {
  ACCUEIL_DU_GUIDE, ADRESSES_DU_PLAN_PRECEDENT, adresseDeLaPageAbsorbee, adresseDeLaPageRetiree, ANCRES_DES_PAGES_ABSORBEES, ARTISANAT, adresseDuGuide, CHEMIN_DES_REGLES,
  DECOUVRIR, entreesDuMenuLateral, estDansDecouvrir, estDesOnglets, estDuGuideDuMj, filDAriane, GUIDE_DU_MJ, installerLePlan, LIENS_ET_RENCONTRE, menuLateralDe,
  nomsReserves, NOMS_RESERVES, ongletDe, ongletDuLien, ongletsDesRegles, PAGES_ABSORBEES, PAGES_DE_LA_CREATION, PAGES_ECLATEES_DU_GUIDE, PAGES_RETIREES,
  PAGES_SUPPRIMEES, PAR_OU_COMMENCER, PARTIES, pagesDeLaRubrique, partieDeLaPage, placeDansLeGuide, planInstalle, RUBRIQUES_SOUS_LA_PAGE, verifierLePlan,
} from '../src/lib/livres.mjs';
import * as Guide from '../src/lib/guide.mjs';
import { COULEURS_DES_PARTIES } from '../src/lib/parties-couleurs.mjs';
import { cheminDePage, estServieASonId, renvoisDuGuide } from '../src/lib/metiers.mjs';
import { adresseComplete, adresseDeRenvoi, adresseEclatee, cheminVersUnePageEclatee, NAV, activeGroup, nouvelleAdresse } from '../src/lib/nav.mjs';
import { RENVOIS_DES_PAGES_ECLATEES } from '../src/lib/equipement.mjs';
import { chargerPlanDesRegles } from '../src/lib/plan-des-regles-db.mjs';
import { TYPE_KEYS, TYPES } from '../src/lib/types.mjs';
import * as Livres from '../src/lib/livres.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

// Le site de dev réécrit les pages du guide (titre, texte, intertitres), les crée, les supprime, et range le menu latéral de chaque onglet (onglet et
// place de chaque entrée, regles_onglet_entree) : le plan et les renvois figés s'épinglent sur l'état d'import de la base (test/aide-base-d-import.mjs) ;
// le test « aujourd’hui » contrôle la base courante par invariants (le plan s'installe et tient, chaque renvoi figé mène à une page servie ou à la 404).
const db = baseDImport();
/** Les pages du guide d'une base, comme loadWiki les donne aux routes ({ id, data: { title, summary, status } }). */
const pagesDe = (base) => base.prepare("SELECT id, titre, resume, statut FROM page WHERE type = 'guide' ORDER BY id").all()
  .map((p) => ({ id: p.id, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
const pagesDuGuide = pagesDe(db);
const ids = pagesDuGuide.map((p) => p.id);
const historique = historiqueSite(db); // ce que le site de dev a changé depuis l'import (lib/historique-site.mjs) : rien, dans la base d'import ; le test « aujourd’hui » lit la base courante
const PLAN = chargerPlanDesRegles(db);
const installer = () => installerLePlan(PLAN);
installer();
const FIXTURE = 'guide/utiliser-ce-wiki';
const corpsDe = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id)?.corps_md;
/** Les ids des intertitres d'un corps Markdown (github-slugger, comme le rendu ; un rendu par morceau de texte entre deux blocs, comme PageDuGuide). */
const intertitres = (corps) => corps.split(/^<!--\s*guide:[a-z-]+\s*-->[ \t]*$/m).flatMap((morceau) => {
  const slugger = new GithubSlugger();
  return [...morceau.matchAll(/^#{2,6} (.+)$/gm)].map((m) => slugger.slug(m[1].trim()));
});
/** Vrai si l'adresse « regles/<slug>/#ancre » (relative à la racine) mène à une page de la base qui a cet intertitre (ou à la page, sans ancre). */
const meneAUnIntertitre = (adresse) => {
  const [chemin, ancre] = adresse.split('#');
  const id = ids.find((i) => cheminDePage(i) === chemin);
  if (!id) return false;
  return !ancre || intertitres(corpsDe(id)).includes(ancre);
};

test('le plan écrit : Découvrir (Bienvenue, L’univers), la création du personnage dans la couleur « creer », aucune couleur écrite', () => {
  assert.deepEqual([DECOUVRIR.id, DECOUVRIR.titre, DECOUVRIR.chemin, DECOUVRIR.accueil], ['decouvrir', 'Découvrir', 'decouvrir/', 'guide/bienvenue']);
  assert.deepEqual(DECOUVRIR.groupes.map((g) => [g.id, g.partie, g.pages]), [['decouvrir', 'decouvrir', ['guide/bienvenue', 'guide/l-univers']]]);
  assert.deepEqual(pagesDeLaRubrique(DECOUVRIR).map((p) => [p.id, p.ordre]), [['guide/bienvenue', 0], ['guide/l-univers', 1]], 'lu par scripts/mise-a-jour-simulation.mjs');
  // R184 : « Créer son personnage » quitte Découvrir, introduction de l'onglet Fiche de personnage ; elle et les six étapes (redevenues des pages) gardent
  // la couleur de la partie « creer » (défaut confirmé par le propriétaire), les autres pages des onglets l'accent du site
  assert.deepEqual(PAGES_DE_LA_CREATION, {
    partie: 'creer', pages: ['guide/creer-son-personnage', 'guide/choisir-sa-race', 'guide/choisir-ses-magies', 'guide/choisir-sa-classe',
      'guide/caracteristiques-et-competences', 'guide/premiers-sorts', 'guide/finaliser-son-personnage'],
  });
  for (const id of PAGES_DE_LA_CREATION.pages) assert.equal(partieDeLaPage(id), 'creer', id);
  assert.equal(partieDeLaPage('guide/l-univers'), 'decouvrir');
  for (const id of ['guide/les-degats', 'guide/meteo', 'guide/fiche-attributs', 'guide/un-maitre-du-jeu', FIXTURE]) assert.equal(partieDeLaPage(id), null, id);
  assert.ok(!ids.includes('guide/rejoindre-une-partie') && !ids.includes('guide/lexique'), 'ni « Rejoindre une partie » ni le Lexique');
  assert.deepEqual(GUIDE_DU_MJ.pages, ['guide/un-maitre-du-jeu', 'guide/guide-pour-mj-maverick', 'guide/campagne-ou-scenario-one-shot']);
  // les anciennes parties : leurs ids et leurs titres ; leurs couleurs sont dans leur module (test/palette-css.test.mjs) ; le plan, que reçoit le
  // navigateur, n'en a aucune
  assert.deepEqual(PARTIES.map((p) => [p.id, p.titre]), [['decouvrir', 'Découvrir'], ['creer', 'Créer son personnage'], ['jouer', 'Jouer'], ['progresser', 'Progresser'],
    ['plus-loin', 'Pour aller plus loin']]);
  assert.deepEqual(Object.keys(COULEURS_DES_PARTIES), PARTIES.map((p) => p.id));
  assert.doesNotMatch(readFileSync(new URL('../src/lib/livres.mjs', import.meta.url), 'utf8'), /#[0-9a-f]{3,6}\b/i, 'aucune couleur écrite dans le plan');
  assert.ok(!('PARTIES' in Guide) && !('couleurDeLaPage' in Livres));
  assert.equal(ACCUEIL_DU_GUIDE, 'decouvrir/');
  // plus de rubriques écrites « Les bases » ni « Règles avancées » (R184)
  for (const nom of ['LES_BASES', 'REGLES_AVANCEES', 'RUBRIQUES_DU_GUIDE', 'estDesBases', 'estDesReglesAvancees', 'pagesDesBases', 'pagesDesReglesAvancees',
    'estDansDecouvrirOuLesBases', 'rubriqueDe']) assert.equal(nom in Livres, false, nom);
});

test('R184 : le plan des onglets vient de la base, installé ; sans lui, une fonction qui en a besoin le dit', () => {
  assert.equal(planInstalle(), true);
  assert.deepEqual(ongletsDesRegles().map((o) => [o.id, o.titre, o.chemin, o.ouverture, o.rang]), [
    ['fiche-de-personnage', 'Fiche de personnage', 'regles/fiche-de-personnage/', 'guide/creer-son-personnage', 1],
    ['mecaniques-generales', 'Mécaniques générales', 'regles/mecaniques-generales/', 'guide/reussir-une-action', 2],
    ['combats', 'Les combats', 'regles/combats/', 'guide/le-tour-de-jeu', 3],
    ['exploration', 'Exploration', 'regles/exploration/', 'guide/la-montee-de-niveau', 4],
  ]);
  assert.ok(ongletsDesRegles().every((o) => Object.isFrozen(o) && Object.isFrozen(o.entrees)));
  // l'Artisanat : une entrée lien d'Exploration (R184 (11)), juste après « Exercer un métier » ; aucune entrée « bientôt » aujourd'hui
  const exploration = ongletsDesRegles().find((o) => o.id === 'exploration');
  const i = exploration.entrees.findIndex((e) => e.adresse === ARTISANAT.chemin);
  assert.deepEqual(exploration.entrees[i], { id: 'lien:regles/artisanat', rang: exploration.entrees[i].rang, libelle: 'Artisanat', adresse: 'regles/artisanat/' });
  assert.equal(exploration.entrees[i - 1].page, 'guide/exercer-un-metier');
  assert.equal(ongletDuLien(ARTISANAT.chemin), exploration);
  assert.equal(ongletDuLien('regles/inconnue/'), null);
  assert.ok(ongletsDesRegles().every((o) => o.entrees.every((e) => !e.bientot)), 'aucune entrée « bientôt » (R184, bilan)');
  // sans plan installé : une erreur qui dit quoi faire, jamais un plan vide en silence
  const module = new URL('../src/lib/livres.mjs', import.meta.url);
  return import(`${module.href}?sans-plan`).then((sans) => {
    assert.equal(sans.planInstalle(), false);
    for (const f of [() => sans.ongletsDesRegles(), () => sans.ongletDe('guide/meteo'), () => sans.filDAriane('guide/meteo'), () => sans.placeDansLeGuide('guide/meteo'),
      () => sans.menuLateralDe('guide/meteo', pagesDuGuide), () => sans.verifierLePlan(pagesDuGuide)]) {
      assert.throws(f, /le plan des onglets des Règles n’est pas installé — installerLePlan\(chargerPlanDesRegles\(db\)\)/);
    }
    // ce qui ne dépend pas du plan marche sans lui (la chaîne de l'édition du navigateur ne le reçoit pas)
    assert.equal(sans.adresseDuGuide('guide/meteo'), 'regles/meteo/');
    assert.equal(sans.partieDeLaPage('guide/premiers-sorts'), 'creer');
  });
});

test('installerLePlan contrôle la forme du plan : onglet vide ou nommé deux fois, entrée illisible, page dans deux entrées, ouverture hors de l’onglet', () => {
  const onglet = (id, entrees, ouverture = entrees.find((e) => e.page)?.page) => ({ id, titre: `Onglet ${id}`, ouverture, entrees });
  try {
    assert.throws(() => installerLePlan('non'), /une liste d’onglets est attendue/);
    assert.throws(() => installerLePlan([onglet('a', [])]), /l’onglet « Onglet a » est vide/);
    assert.throws(() => installerLePlan([onglet('A b', [{ page: 'guide/x' }])]), /id d’onglet invalide « A b »/);
    assert.throws(() => installerLePlan([onglet('a', [{ page: 'guide/x' }]), onglet('a', [{ page: 'guide/y' }])]), /l’onglet a est nommé deux fois/);
    assert.throws(() => installerLePlan([onglet('a', [{ page: 'guide/x', bientot: 'X' }])]), /entrée illisible dans « Onglet a »/);
    assert.throws(() => installerLePlan([onglet('a', [{ adresse: 'regles/x/' }], 'guide/x')]), /entrée illisible/);
    assert.throws(() => installerLePlan([onglet('a', [{ page: 'guide/x' }]), onglet('b', [{ page: 'guide/x' }], 'guide/x')]), /guide\/x est dans deux entrées/);
    assert.throws(() => installerLePlan([onglet('a', [{ page: 'guide/x' }], 'guide/y')]), /guide\/y, ouverte à \/regles\/a\/, n’est pas une page de « Onglet a »/);
    const plan = installerLePlan([onglet('a', [{ page: 'guide/x' }, { bientot: 'Les donjons' }, { libelle: 'Artisanat', adresse: 'regles/artisanat/' }])]);
    assert.deepEqual(plan[0].entrees, [{ page: 'guide/x' }, { bientot: 'Les donjons' }, { libelle: 'Artisanat', adresse: 'regles/artisanat/' }]);
    // l'id et le rang de la ligne, quand le plan les donne (la base), restent : le menu latéral les pose pour le mode modification ; rien d'autre
    const lu = installerLePlan([onglet('a', [{ id: 'page:guide/x', rang: 3, page: 'guide/x', autre: 1 }, { id: 'bientot:d', rang: 4, bientot: 'D' }, { id: '', rang: 'x', libelle: 'A', adresse: 'regles/a/' }])]);
    assert.deepEqual(lu[0].entrees, [{ id: 'page:guide/x', rang: 3, page: 'guide/x' }, { id: 'bientot:d', rang: 4, bientot: 'D' }, { libelle: 'A', adresse: 'regles/a/' }]);
  } finally {
    installer();
  }
});

test('les pages fusionnées dans une autre : Le jeu de rôle dans Bienvenue, Résistance/Faiblesse Magie et Les situations avancées (R184, R185) ; plus dans la base', () => {
  assert.deepEqual(PAGES_ABSORBEES, {
    'guide/le-jeu-de-role': 'guide/bienvenue',
    'guide/resistance-faiblesse-magie': 'guide/resistances-et-faiblesses',
    'guide/situations-avancees': 'guide/prise-en-tenaille-et-zone-d-influence',
  });
  for (const [ancienne, nouvelle] of Object.entries(PAGES_ABSORBEES)) {
    assert.ok(!ids.includes(ancienne), `${ancienne} : retirée de la base`);
    assert.ok(ids.includes(nouvelle) && (estDansDecouvrir(nouvelle) || estDesOnglets(nouvelle)), `${nouvelle} : rangée`);
  }
  // les six étapes de la création (fusionnées du 2026-10-18 à R184) sont redevenues des pages, sous leur id : plus absorbées
  for (const id of PAGES_DE_LA_CREATION.pages.slice(1)) assert.ok(ids.includes(id) && !Object.hasOwn(PAGES_ABSORBEES, id), id);
  // une page fusionnée mène à l'intertitre où se lit son contenu, s'il est nommé (github-slugger, comme le rendu Markdown), sinon à la page entière
  assert.deepEqual(ANCRES_DES_PAGES_ABSORBEES, { 'guide/le-jeu-de-role': 'le-jeu-de-rôle-comment-ça-marche-' });
  for (const [ancienne, ancre] of Object.entries(ANCRES_DES_PAGES_ABSORBEES)) {
    assert.ok(intertitres(corpsDe(PAGES_ABSORBEES[ancienne])).includes(ancre), `${ancienne} : #${ancre} absent`);
  }
  assert.equal(adresseDeLaPageAbsorbee('guide/le-jeu-de-role', cheminDePage), 'decouvrir/#le-jeu-de-rôle-comment-ça-marche-');
  assert.equal(adresseDeLaPageAbsorbee('guide/resistance-faiblesse-magie', cheminDePage), 'regles/resistances-et-faiblesses/');
  assert.equal(adresseDeLaPageAbsorbee('guide/situations-avancees', cheminDePage), 'regles/prise-en-tenaille-et-zone-d-influence/');
});

/** Vrai si l'adresse `adresse` (relative à la racine, ancre et requête comprises) a `slug` pour un de ses segments (« regles/les-postures/ » n'a pas « postures »). */
const aPourSegment = (adresse, slug) => adresse.split(/[/?#]/).includes(slug);

test('R184 (9) : les pages supprimées ne sont ni dans la base, ni dans le plan, ni dans aucun renvoi (page 404, R185 (6))', () => {
  // R184 (9) ; puis, le 2026-11-06, les trois pages retirées par la migration 0094, la « Liste des effets mode hyper » (R187 (1), migration 0095) et
  // « Altérations d'états et Mode Hyper » (migration 0096) (tests « 0094 », « R187 » et « 0096 » plus bas)
  assert.deepEqual(PAGES_SUPPRIMEES, ['guide/les-documents-des-regles', 'guide/en-resume-deroulement-d-un-tour', 'guide/aide-memoire', 'guide/mode-hyper-magie',
    'guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super', 'guide/liste-des-effets-mode-hyper',
    'guide/alterations-d-etats-et-mode-hyper']);
  const renvois = renvoisDuGuide(ids);
  const eclatees = { ...RENVOIS_DES_PAGES_ECLATEES, ...PAGES_ECLATEES_DU_GUIDE };
  for (const id of PAGES_SUPPRIMEES) {
    const slug = id.slice('guide/'.length);
    assert.ok(!ids.includes(id), `${id} : plus dans la base`);
    assert.equal(ongletDe(id), null);
    assert.equal(placeDansLeGuide(id).rubrique, null, `${id} : rangée nulle part (notes de version : « Pages retirées », lib/notes-de-version.mjs)`);
    for (const adresse of [`/guide/${slug}/`, `/regles/${slug}/`, `/regles/avancees/${slug}/`, `/decouvrir/${slug}/`]) {
      assert.equal(adresseDeRenvoi(adresse, { renvois, eclatees }), null, `${adresse} : la page 404, sans renvoi`);
    }
    // un segment d'adresse, pas une sous-chaîne : « postures » est dans « les-postures », qui garde ses adresses (2026-11-06)
    assert.ok(Object.keys(renvois).every((k) => !aPourSegment(k, slug)) && Object.values(renvois).every((v) => !aPourSegment(v, slug)), `${id} : aucun renvoi`);
    assert.ok(!Object.hasOwn(PAGES_ABSORBEES, id) && !Object.hasOwn(PAGES_RETIREES, id));
  }
  assert.ok(!Guide.BLOCS.includes('documents') && !('pagesDeReference' in Guide), 'plus de bloc « documents » (sa page est supprimée)');
});

test('chaque page `guide/…` de la base a une adresse à elle, jamais sous /guide/ ; à plat sous /regles/ pour les onglets ; une seule place dans le plan (sauf la fixture)', () => {
  assert.ok(ids.length >= 67, `${ids.length} pages du guide`);
  const chemins = ids.map(cheminDePage);
  assert.equal(new Set(chemins).size, chemins.length, 'deux pages à la même adresse');
  for (const [i, id] of ids.entries()) {
    assert.doesNotMatch(chemins[i], /^guide\//, id);
    assert.match(chemins[i], /^(?:decouvrir\/(?:[a-z0-9-]+\/)?|regles\/[a-z0-9-]+\/|mj\/[a-z0-9-]+\/)$/, id);
    assert.equal(estServieASonId(id), false, `${id} : la route des pages du wiki ne la sert pas`);
    const places = [estDansDecouvrir(id), estDuGuideDuMj(id), estDesOnglets(id)].filter(Boolean).length;
    assert.equal(places, id === FIXTURE ? 0 : 1, `${id} : une place et une seule`);
    if (estDesOnglets(id)) assert.equal(chemins[i], `regles/${id.slice('guide/'.length)}/`, `${id} : adresse à plat`);
  }
  assert.equal(cheminDePage('guide/bienvenue'), 'decouvrir/', 'Bienvenue à l’adresse de Découvrir');
  assert.equal(cheminDePage('guide/l-univers'), 'decouvrir/l-univers/');
  assert.equal(cheminDePage('guide/creer-son-personnage'), 'regles/creer-son-personnage/', 'l’introduction de l’onglet Fiche de personnage');
  for (const id of GUIDE_DU_MJ.pages) assert.equal(cheminDePage(id), `mj/${id.slice('guide/'.length)}/`);
  // la fixture (status: example) : une adresse de repli, sans entrée de menu (aucun onglet « Autre », R185 P7)
  assert.equal(cheminDePage(FIXTURE), 'regles/utiliser-ce-wiki/');
  assert.equal(adresseDuGuide('guide/une-page-ajoutee-plus-tard'), 'regles/une-page-ajoutee-plus-tard/', 'une page nouvelle a toujours une adresse');
  assert.equal(CHEMIN_DES_REGLES, 'regles/');
  assert.equal(cheminDePage('races/elfe'), 'races/elfe/', 'les autres pages ne changent pas');
});

test('les adresses du plan n’entrent en conflit ni avec un type de page, ni avec une page Astro, ni avec un onglet, ni entre elles', () => {
  for (const r of ['decouvrir', 'regles', 'mj']) assert.ok(!TYPE_KEYS.includes(r), `${r} est un type de page`);
  assert.deepEqual(NOMS_RESERVES, ['artisanat', 'avancees']);
  assert.deepEqual(nomsReserves(), ['artisanat', 'avancees', 'fiche-de-personnage', 'mecaniques-generales', 'combats', 'exploration']);
  const slugs = ids.filter((id) => cheminDePage(id).startsWith('regles/')).map((id) => id.slice('guide/'.length));
  for (const nom of nomsReserves()) assert.ok(!slugs.includes(nom), `${nom} : une page prendrait l’adresse réservée /regles/${nom}/`);
  // les pages Astro écrites à côté des pages du plan : les routes, l'Artisanat, /regles/ (plus de Règles avancées) ; rien d'autre sous ces chemins
  const pages = new URL('../src/pages/', import.meta.url);
  assert.deepEqual(readdirSync(new URL('decouvrir/', pages)).sort(), ['[...page].astro'], 'plus de page Liens (supprimée le 2026-10-22)');
  assert.deepEqual(readdirSync(new URL('regles/', pages)).sort(), ['[...page].astro', 'artisanat.astro', 'index.astro'], 'plus de route /regles/avancees/ (R184)');
  assert.deepEqual(readdirSync(new URL('mj/', pages)).sort(), ['[...page].astro', 'index.astro']);
  assert.ok(!existsSync(new URL('guide/', pages)), 'pas de route /guide/');
  assert.equal(ARTISANAT.chemin, 'regles/artisanat/');
});

test('le plan est contrôlé au build : une page absente, d’exemple, nommée deux fois, rangée nulle part, absorbée, retirée ou supprimée revenue arrête tout', () => {
  assert.equal(verifierLePlan(pagesDuGuide), pagesDuGuide);
  const sans = (id) => pagesDuGuide.filter((p) => p.id !== id);
  const avec = (id, status = 'draft') => [...pagesDuGuide, { id, data: { title: id, status } }];
  assert.throws(() => verifierLePlan(sans('guide/creer-son-personnage')), /guide\/creer-son-personnage \(« Fiche de personnage »\) n'existe pas/);
  assert.throws(() => verifierLePlan(sans('guide/meteo')), /guide\/meteo \(« Mécaniques générales »\) n'existe pas/);
  assert.throws(() => verifierLePlan(sans('guide/l-univers')), /guide\/l-univers \(« Découvrir »\) n'existe pas/);
  const exemple = pagesDuGuide.map((p) => (p.id === 'guide/un-maitre-du-jeu' ? { ...p, data: { ...p.data, status: 'example' } } : p));
  assert.throws(() => verifierLePlan(exemple), /guide\/un-maitre-du-jeu \(Guide du MJ\) est une page d'exemple/);
  // pas d'onglet « Autre » (R185, P7) : une page du guide que le plan ne range pas arrête le build, nommée
  assert.throws(() => verifierLePlan(avec('guide/une-page-nouvelle')), /plan du guide : guide\/une-page-nouvelle n'est rangée nulle part .*regles_onglet_entree/);
  assert.doesNotThrow(() => verifierLePlan(avec('guide/une-page-d-exemple', 'example')), 'une page d’exemple non rangée : l’adresse de repli, sans entrée');
  assert.throws(() => verifierLePlan(avec('guide/situations-avancees')), /guide\/situations-avancees est absorbée par guide\/prise-en-tenaille-et-zone-d-influence/);
  assert.throws(() => verifierLePlan(avec('guide/lexique')), /guide\/lexique est retirée \(ses adresses mènent à \/recherche\/\) et ne doit plus être dans la base/);
  assert.throws(() => verifierLePlan(avec('guide/aide-memoire')), /guide\/aide-memoire, supprimée \(R184\), est revenue sans place dans le plan/);
  // HIDE_EXAMPLES=1 : sans les pages d'exemple, le plan tient toujours (aucune n'y est nommée)
  assert.doesNotThrow(() => verifierLePlan(pagesDuGuide.filter((p) => p.data.status !== 'example')));
  // un plan faux : une page dans un onglet et dans Découvrir, un nom réservé, une entrée lien sous /guide/
  const essai = (onglets, attendu) => {
    try {
      installerLePlan(onglets);
      assert.throws(() => verifierLePlan([...pagesDuGuide, { id: 'guide/artisanat', data: { title: 'x', status: 'draft' } }, { id: 'guide/combats', data: { title: 'x', status: 'draft' } }]), attendu);
    } finally {
      installer();
    }
  };
  const avecEntree = (entree, ou = 'combats') => PLAN.map((o) => (o.id === ou ? { ...o, entrees: [...o.entrees, entree] } : o));
  essai(avecEntree({ page: 'guide/l-univers' }), /guide\/l-univers est nommée deux fois \(« Découvrir », « Les combats »\)/);
  essai(avecEntree({ page: 'guide/artisanat' }), /guide\/artisanat prend un nom réservé/);
  essai(avecEntree({ page: 'guide/combats' }, 'exploration'), /guide\/combats prend un nom réservé/);
  essai(avecEntree({ libelle: 'Vieux', adresse: 'guide/vieux/' }), /l'entrée « Vieux » de « Les combats » mène sous \/guide\//);
});

test('le menu latéral d’un onglet : ses entrées dans l’ordre du plan (pages, lien, « bientôt »), une page absente sautée ; aucun pour Découvrir, le Guide du MJ, la fixture', () => {
  const combats = menuLateralDe('guide/les-degats', pagesDuGuide);
  assert.equal(combats.rubrique, ongletDe('guide/les-degats'));
  assert.deepEqual([combats.rubrique.titre, combats.rubrique.chemin], ['Les combats', 'regles/combats/']);
  assert.deepEqual(combats.pages.map((p) => p.id), PLAN.find((o) => o.id === 'combats').entrees.map((e) => e.page));
  assert.ok(combats.pages.every((p) => p.data.title), 'chaque entrée a son titre (celui de la base)');
  // Exploration : l'Artisanat, entrée lien, à sa place
  const exploration = menuLateralDe('guide/les-pieges', pagesDuGuide).pages;
  assert.deepEqual(exploration.map((e) => e.id ?? e.libelle), PLAN.find((o) => o.id === 'exploration').entrees.map((e) => e.page ?? e.libelle));
  assert.ok(exploration.some((e) => e.adresse === 'regles/artisanat/'));
  assert.deepEqual(entreesDuMenuLateral(ongletDe('guide/meteo'), pagesDuGuide.filter((p) => p.id !== 'guide/meteo')).map((p) => p.id).includes('guide/meteo'), false,
    'une page absente est sautée');
  // une entrée « bientôt » (aucune aujourd'hui) passe telle quelle : le menu la grise, sans lien (components/guide/MenuLateral.astro)
  try {
    installerLePlan(PLAN.map((o) => (o.id === 'exploration' ? { ...o, entrees: [...o.entrees, { bientot: 'Les donjons' }] } : o)));
    assert.deepEqual(menuLateralDe('guide/les-pieges', pagesDuGuide).pages.at(-1), { bientot: 'Les donjons' });
  } finally {
    installer();
  }
  for (const id of ['guide/bienvenue', 'guide/l-univers', 'guide/un-maitre-du-jeu', FIXTURE, 'races/elfe']) assert.equal(menuLateralDe(id, pagesDuGuide), null, id);
});

// Lot de l'édition des menus (« changer l'ordre des menu latéraux (par un glisser déposer) ») : le menu latéral pose l'id et le rang de chaque ligne de
// regles_onglet_entree (data-ed-entree, data-ed-rang), une par entrée affichée, dans l'ordre ; l'onglet en data-ed-menu (scripts/edition/menus.mjs)
test('le menu latéral d’un onglet porte, pour le mode modification, l’id et le rang de chaque ligne de regles_onglet_entree, entrée par entrée', () => {
  for (const onglet of ongletsDesRegles()) {
    const { pages, edition } = menuLateralDe(onglet.ouverture, pagesDuGuide);
    assert.equal(edition.menu, `onglet:${onglet.id}`);
    assert.equal(edition.entrees.length, pages.length, onglet.id);
    const lignes = db.prepare('SELECT id, rang, page_id, libelle FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang, id').all(onglet.id);
    assert.deepEqual(edition.entrees, lignes.map((l) => ({ id: l.id, rang: l.rang })), onglet.id);
    pages.forEach((p, i) => assert.equal(edition.entrees[i].id, p.id ? `page:${p.id}` : lignes[i].id, `${onglet.id} : entrée ${i}`));
  }
  // une page absente est sautée des deux côtés : les deux listes restent alignées
  const sansMeteo = pagesDuGuide.filter((p) => p.id !== 'guide/meteo');
  const onglet = ongletDe('guide/meteo');
  const { menu, entrees } = Livres.editionDuMenuLateral(onglet, sansMeteo);
  assert.equal(menu, `onglet:${onglet.id}`);
  assert.equal(entrees.length, entreesDuMenuLateral(onglet, sansMeteo).length);
  assert.ok(!entrees.some((e) => e.id === 'page:guide/meteo'));
});

// R185 (6) (« Page 404 ») : une page des Règles supprimée sur le site de dev (rien ne la protège parce qu'un renvoi figé la vise : lib/pages-protegees.mjs)
// laisse son ancienne adresse à la 404 ; le plan strict ne s'arrête pas pour elle.
test('R185 (6) : une cible de renvoi figé absente n’arrête pas le build ; la page 404 et les liens écrits la sautent', () => {
  // des pages que visent les renvois figés, et que rien ne protège (ni création du personnage, ni ouverture, ni absorption)
  const cible = 'guide/l-embuscade'; // une section de « Les situations avancées » (PAGES_ECLATEES_DU_GUIDE)
  const precedente = 'guide/meteo'; // /regles/avancees/meteo/ (ADRESSES_DU_PLAN_PRECEDENT)
  assert.equal(Livres.pageDuGuideALAdresse(adresseDuGuide(cible)), cible);
  assert.equal(Livres.pageDuGuideALAdresse('regles/prise-en-tenaille-et-zone-d-influence/#la-prise-en-tenaille'), 'guide/prise-en-tenaille-et-zone-d-influence');
  assert.equal(Livres.pageDuGuideALAdresse('decouvrir/'), 'guide/bienvenue');
  assert.equal(Livres.pageDuGuideALAdresse('mj/un-maitre-du-jeu/?a=1'), 'guide/un-maitre-du-jeu');
  assert.equal(Livres.pageDuGuideALAdresse('ressources/armes/'), null);
  // toutes les pages là : les objets de PAGES_ECLATEES_DU_GUIDE, inchangés
  assert.deepEqual(Livres.pagesEclateesDuGuide((id) => ids.includes(id)), PAGES_ECLATEES_DU_GUIDE);
  assert.equal(Livres.pagesEclateesDuGuide((id) => ids.includes(id))['decouvrir/creer-son-personnage/'], PAGES_ECLATEES_DU_GUIDE['decouvrir/creer-son-personnage/']);
  // un plan où les deux cibles manquent (pages supprimées : ni dans la base, ni dans le plan)
  const restants = ids.filter((id) => id !== cible && id !== precedente);
  const pages = pagesDuGuide.filter((p) => restants.includes(p.id));
  try {
    installerLePlan(PLAN.map((o) => ({ ...o, entrees: o.entrees.filter((e) => e.page !== cible && e.page !== precedente) })));
    assert.equal(verifierLePlan(pages), pages, 'le plan strict tient : une cible de renvoi absente n’est pas une page manquante');
    // la page 404 : plus de renvoi vers elle, son ancienne adresse reste introuvable
    const renvois = renvoisDuGuide(restants);
    assert.equal(Object.hasOwn(renvois, 'regles/avancees/meteo/'), false);
    const eclatees = { ...RENVOIS_DES_PAGES_ECLATEES, ...Livres.pagesEclateesDuGuide((id) => restants.includes(id)) };
    const vers = (adresse, hash = '') => adresseDeRenvoi(adresse, { base: '/', renvois, eclatees, hash });
    assert.equal(vers('/regles/avancees/meteo/'), null, 'la 404');
    // une ancienne ancre dont la page manque : la page qui garde le reste (`defaut`), l'ancre gardée ; les autres ancres inchangées
    assert.equal(vers('/guide/situations-avancees/', '#lembuscade'), '/regles/prise-en-tenaille-et-zone-d-influence/#lembuscade');
    assert.equal(vers('/guide/situations-avancees/', '#les-attaques-discrètes'), '/regles/les-attaques-discretes/');
    assert.ok(!Object.values(eclatees['guide/situations-avancees/'].anciennesAncres).includes(adresseDuGuide(cible)));
    // une page éclatée dont la page `defaut` manque : retirée entière (son adresse donne la 404)
    const sansDefaut = Livres.pagesEclateesDuGuide((id) => id !== 'guide/creer-son-personnage');
    assert.equal(Object.hasOwn(sansDefaut, 'decouvrir/creer-son-personnage/'), false);
    assert.ok(Object.hasOwn(sansDefaut, 'guide/situations-avancees/'));
    // un lien écrit vers l'ancienne adresse : tel qu'écrit (la 404), jamais vers la page supprimée
    const options = { cheminDe: cheminDePage, existe: (id) => restants.includes(id), accueil: ACCUEIL_DU_GUIDE };
    assert.equal(Guide.adresseDesAnciensLiens('regles/avancees/meteo/', options), 'regles/avancees/meteo/');
    assert.equal(Guide.adresseDesAnciensLiens('guide/meteo/#pluie', options), 'guide/meteo/#pluie');
  } finally {
    installer();
  }
  // lib/guide-rendu.ts et la page 404 lisent la liste filtrée, jamais PAGES_ECLATEES_DU_GUIDE telle quelle
  const rendu = readFileSync(new URL('../src/lib/guide-rendu.ts', import.meta.url), 'utf8');
  assert.match(rendu, /\.\.\.pagesEclateesDuGuide\(\(page: string\) => pages\.has\(page\)\)/);
  assert.doesNotMatch(rendu, /\.\.\.PAGES_ECLATEES_DU_GUIDE/);
});

test('plus de livre : ni précédent ni suivant ; le fil d’Ariane mène à l’onglet de la page, à Découvrir ou au Guide du MJ', () => {
  for (const nom of ['LIVRES', 'livreDe', 'pagesDuLivre', 'voisinsDansLeLivre', 'suiteDuLivre', 'estDansUnLivre']) assert.equal(nom in Livres, false, nom);
  assert.deepEqual(filDAriane('guide/bienvenue'), [{ titre: 'Découvrir', chemin: 'decouvrir/' }]);
  assert.deepEqual(filDAriane('guide/l-univers'), [{ titre: 'Découvrir', chemin: 'decouvrir/' }]);
  assert.deepEqual(filDAriane('guide/creer-son-personnage'), [{ titre: 'Fiche de personnage', chemin: 'regles/fiche-de-personnage/' }]);
  assert.deepEqual(filDAriane('guide/premiers-sorts'), [{ titre: 'Fiche de personnage', chemin: 'regles/fiche-de-personnage/' }]);
  assert.deepEqual(filDAriane('guide/meteo'), [{ titre: 'Mécaniques générales', chemin: 'regles/mecaniques-generales/' }]);
  assert.deepEqual(filDAriane('guide/l-embuscade'), [{ titre: 'Les combats', chemin: 'regles/combats/' }]);
  assert.deepEqual(filDAriane('guide/les-pieges'), [{ titre: 'Exploration', chemin: 'regles/exploration/' }]);
  assert.deepEqual(filDAriane('guide/campagne-ou-scenario-one-shot'), [{ titre: 'Guide du MJ', chemin: 'mj/' }]);
  assert.deepEqual(filDAriane(FIXTURE), [], 'la fixture : « Accueil » seul');
});

test('placeDansLeGuide : la rubrique et l’ordre d’une page (notes de version, panneau de la ceinture) ; rang Découvrir 0, onglets 1 à 4, Guide du MJ 5', () => {
  assert.deepEqual(placeDansLeGuide('guide/bienvenue'), { rubrique: 'Découvrir', rang: 0, ordre: 0 });
  assert.deepEqual(placeDansLeGuide('guide/l-univers'), { rubrique: 'Découvrir', rang: 0, ordre: 1 });
  assert.deepEqual(placeDansLeGuide('guide/fiche-personnage'), { rubrique: 'Fiche de personnage', rang: 1, ordre: 0 });
  assert.deepEqual(placeDansLeGuide('guide/reussir-une-action'), { rubrique: 'Mécaniques générales', rang: 2, ordre: 0 });
  assert.deepEqual(placeDansLeGuide('guide/le-tour-de-jeu'), { rubrique: 'Les combats', rang: 3, ordre: 0 });
  assert.deepEqual(placeDansLeGuide('guide/s-entrainer-et-exercer-un-metier'), { rubrique: 'Exploration', rang: 4, ordre: 1 });
  // l'Artisanat compte dans l'ordre du menu : les-pieges vient après lui
  assert.equal(placeDansLeGuide('guide/les-pieges').ordre, PLAN.find((o) => o.id === 'exploration').entrees.findIndex((e) => e.page === 'guide/les-pieges'));
  assert.deepEqual(placeDansLeGuide('guide/un-maitre-du-jeu'), { rubrique: 'Guide du MJ', rang: 5, ordre: null });
  assert.deepEqual(placeDansLeGuide('guide/aide-memoire'), { rubrique: null, rang: null, ordre: null }, 'une page supprimée : nulle part');
  assert.deepEqual(placeDansLeGuide(FIXTURE), { rubrique: null, rang: null, ordre: null });
});

test('les pages nommées par le plan : « Par où commencer ? », L’univers et ses rubriques, l’Artisanat, les liens et l’encart de la rencontre', () => {
  // R184 ; défaut confirmé par le propriétaire (R185 (4)) : la troisième carte mène à l'introduction de l'onglet Fiche de personnage
  assert.deepEqual(PAR_OU_COMMENCER, ['guide/bienvenue', 'guide/l-univers', 'guide/creer-son-personnage']);
  assert.deepEqual(PAR_OU_COMMENCER.map(cheminDePage), ['decouvrir/', 'decouvrir/l-univers/', 'regles/creer-son-personnage/']);
  assert.deepEqual(PAR_OU_COMMENCER.map(partieDeLaPage), ['decouvrir', 'decouvrir', 'creer']);
  assert.deepEqual(RUBRIQUES_SOUS_LA_PAGE, { 'guide/l-univers': ['races', 'magies', 'classes'] });
  assert.deepEqual(RUBRIQUES_SOUS_LA_PAGE['guide/l-univers'].map((k) => TYPES[k].label), ['Races', 'Magies', 'Classes']);
  assert.deepEqual(ARTISANAT.pages, ['ressources/composants', 'ressources/alchimie', 'ressources/alchimie-primitive', 'ressources/alchimie-liste-ingredients', 'metiers/regles-des-metiers']);
  const existe = db.prepare('SELECT 1 FROM page WHERE id = ?');
  for (const id of ARTISANAT.pages.slice(1)) assert.ok(existe.get(id), `${id} : page absente`);
  // sur l'accueil (demande du propriétaire du 2026-10-23 : « Ces 3 blocs auraient plus leur place dans l'onglet d'acceuil. »)
  assert.equal(LIENS_ET_RENCONTRE.page, 'accueil');
  assert.equal(existe.get(LIENS_ET_RENCONTRE.page), undefined, 'pas une page du wiki');
  assert.equal(LIENS_ET_RENCONTRE.titre, 'Accueil');
  const accueil = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  assert.ok(accueil.includes(`<Base title="${LIENS_ET_RENCONTRE.titre}" edition={LIENS_ET_RENCONTRE.page}>`), 'le titre de l’accueil, et son mode modification');
  assert.deepEqual(LIENS_ET_RENCONTRE.liens.map((l) => [l.id, l.libelle, l.url]), [
    ['discord', 'Serveur Discord « L’univers de Maverick »', 'https://discord.gg/GMGBnjzfMk'],
    ['tipeee', 'Maverick JDR sur Tipeee', 'https://fr.tipeee.com/maverickjdr'],
  ]);
  const [discord, tipeee] = LIENS_ET_RENCONTRE.liens;
  assert.ok(typeof discord.presentation === 'string' && discord.presentation.length > 50);
  assert.equal(tipeee.presentation, undefined);
  assert.equal(tipeee.tipeee, true);
  assert.deepEqual(LIENS_ET_RENCONTRE.rencontre, {
    id: 'prochaine-rencontre', titre: 'Notre prochaine rencontre IRL', annonce: 'prochaine-rencontre-irl', vide: 'Aucune rencontre annoncée pour le moment.',
  });
  assert.ok(db.prepare('SELECT 1 FROM annonce WHERE id = ?').get(LIENS_ET_RENCONTRE.rencontre.annonce), 'l’annonce de l’encart est dans la base (migration 0068)');
});

test('le menu s’accorde au plan : Règles (Découvrir, L’univers, puis les onglets), Espace MJ (Guide du MJ) ; chaque page ouvre sa rubrique', () => {
  const rubrique = (cle) => NAV.find((g) => g.key === cle);
  assert.deepEqual(rubrique('regles').items.slice(0, 2).map((i) => i.path), DECOUVRIR.groupes[0].pages.map(cheminDePage));
  assert.deepEqual(rubrique('regles').items.slice(2).map((i) => [i.label, i.path]), ongletsDesRegles().map((o) => [o.titre, o.chemin]));
  assert.ok(!NAV.some((g) => g.items.some((i) => i.path === ARTISANAT.chemin)), 'l’Artisanat n’est plus au menu du site (menu latéral d’Exploration)');
  assert.ok(rubrique('mj').items.some((i) => i.label === GUIDE_DU_MJ.titre && i.path === GUIDE_DU_MJ.chemin));
  assert.equal(activeGroup('/').key, 'regles', 'l’accueil ouvre les Règles');
  for (const id of ids) assert.equal(activeGroup(`/${cheminDePage(id)}`).key, estDuGuideDuMj(id) ? 'mj' : 'regles', id);
  for (const o of ongletsDesRegles()) assert.equal(activeGroup(`/${o.chemin}`).key, 'regles', o.chemin);
  assert.equal(activeGroup(`/${ARTISANAT.chemin}`).key, 'regles', 'l’Artisanat ouvre les Règles (R184)');
});

test('une page retirée dont le contenu se lit ailleurs (PAGES_RETIREES) : un lien écrit vers une de ses anciennes adresses mène à sa destination, requête et ancre gardées', () => {
  assert.equal(adresseDeLaPageRetiree('regles/lexique/'), 'recherche/');
  assert.equal(adresseDeLaPageRetiree('regles/lexique'), 'recherche/', 'sans barre de fin');
  assert.equal(adresseDeLaPageRetiree('guide/lexique/#acquis'), 'recherche/#acquis', 'l’ancre écrite gardée');
  assert.equal(adresseDeLaPageRetiree('regles/lexique/?q=AM#x'), 'recherche/?q=AM#x', 'la requête avant l’ancre');
  assert.equal(adresseDeLaPageRetiree('regles/lexique/', { existe: (id) => id === 'guide/lexique' }), null, 'revenue dans la base : plus de renvoi');
  for (const autre of ['regles/', 'regles/meteo/', 'regles/lexiques/', 'lexique/', 'recherche/', '']) assert.equal(adresseDeLaPageRetiree(autre), null, autre);
  const options = { cheminDe: cheminDePage, existe: (id) => ids.includes(id), accueil: ACCUEIL_DU_GUIDE };
  assert.equal(Guide.adresseDesAnciensLiens('guide/lexique/', options), 'recherche/');
  assert.equal(Guide.adresseDesAnciensLiens('regles/lexique/#acquis', options), 'recherche/#acquis');
  assert.equal(Guide.adresseDesAnciensLiens('regles/meteo/', options), 'regles/meteo/', 'une page du plan : telle qu’écrite');
  const renvois = renvoisDuGuide(ids);
  for (const { vers, adresses } of Object.values(PAGES_RETIREES)) {
    for (const adresse of adresses) assert.equal(renvois[adresse], Guide.adresseDesAnciensLiens(adresse, options), `${adresse} : la page 404 et le lien écrit, même destination`);
    assert.ok(!ids.some((id) => adresses.includes(cheminDePage(id))) && vers === 'recherche/', 'aucune page du plan à une adresse retirée');
  }
});

/** La page 404 : l'adresse où elle renvoie `adresse` (requête et ancre comprises), avec les renvois et les pages éclatées que le build lui donne. */
const renvoi = (adresse, { search = '', hash = '', base = '/' } = {}) => adresseDeRenvoi(adresse, {
  base, renvois: renvoisDuGuide(ids), eclatees: { ...RENVOIS_DES_PAGES_ECLATEES, ...PAGES_ECLATEES_DU_GUIDE }, search, hash,
});

// Migration 0094, demande du propriétaire du 2026-11-06 : « Il y a 4 pages à supprimer car inutile ou doublon. * Postures * Les boss et leurs postures
// * Le mode hyper * Mode super » (« Le mode hyper » reste, a-t-il précisé). Convention R185 (6) (« Page 404 ») : PAGES_SUPPRIMEES, sans renvoi.
test('0094 (2026-11-06) : « Postures », « Les boss et leurs postures » et « Le Mode Super » supprimées sans renvoi ; « Le Mode Hyper » reste', () => {
  const supprimees = ['guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super'];
  for (const id of supprimees) {
    assert.ok(PAGES_SUPPRIMEES.includes(id), `${id} : dans PAGES_SUPPRIMEES (son id reste réservé, serveur/edition-plan.mjs#idPris)`);
    assert.ok(!ids.includes(id), `${id} : plus dans la base`);
    const slug = id.slice('guide/'.length);
    for (const adresse of [`/regles/${slug}/`, `/guide/${slug}/`, `/regles/avancees/${slug}/`]) assert.equal(renvoi(adresse), null, `${adresse} : la page 404`);
  }
  // « Le Mode Hyper » et « Les postures » restent (la « Liste des effets mode hyper », supprimée ensuite : test « R187 » ci-dessous)
  for (const id of ['guide/le-mode-hyper', 'guide/les-postures']) {
    assert.ok(ids.includes(id) && !PAGES_SUPPRIMEES.includes(id), `${id} : gardée`);
  }
  // « Postures » sort des anciennes Règles avancées (comme « Mode Hyper (Magie) ») : /regles/avancees/postures/ ne mène plus nulle part
  assert.equal(Object.hasOwn(ADRESSES_DU_PLAN_PRECEDENT, 'regles/avancees/postures/'), false);
  // l'ancienne section « Les boss et leurs postures » de « Les situations avancées » mène à « ## Les boss » de la page des postures, qui porte son texte
  const situations = PAGES_ECLATEES_DU_GUIDE['guide/situations-avancees/'];
  assert.equal(situations.anciennesAncres['les-boss-et-leurs-postures'], 'regles/les-postures/#les-boss');
  assert.ok(meneAUnIntertitre('regles/les-postures/#les-boss'), '« ## Les boss » dans guide/les-postures');
  assert.equal(renvoi('/guide/situations-avancees/', { hash: '#les-boss-et-leurs-postures' }), '/regles/les-postures/#les-boss');
  // les postures gardent leur id sous le préfixe de la page supprimée (identifiants figés) : des entités, pas une page
  assert.equal(db.prepare("SELECT count(*) AS n FROM posture WHERE id LIKE 'guide/postures#posture:%'").get().n, 6);
});

// Décision R187 (1) (demande du propriétaire du 2026-11-06 : « Supprime la liste. ») : la « Liste des effets mode hyper » est supprimée (migration 0095),
// son adresse mène à la page 404 (R185 (6)) ; « Le mode hyper », qui porte maintenant le tableau des effets (bloc mode-hyper, R187 (2)), reste.
test('R187 (1) : la « Liste des effets mode hyper » supprimée sans renvoi ; « Le Mode Hyper » reste et porte le bloc du Mode Hyper', () => {
  const id = 'guide/liste-des-effets-mode-hyper';
  assert.ok(PAGES_SUPPRIMEES.includes(id), 'dans PAGES_SUPPRIMEES (son id reste réservé, serveur/edition-plan.mjs#idPris)');
  assert.ok(!ids.includes(id), 'plus dans la base');
  for (const adresse of ['/regles/liste-des-effets-mode-hyper/', '/guide/liste-des-effets-mode-hyper/', '/regles/avancees/liste-des-effets-mode-hyper/']) {
    assert.equal(renvoi(adresse), null, `${adresse} : la page 404`);
  }
  // elle sort des anciennes Règles avancées, comme « Postures » : /regles/avancees/liste-des-effets-mode-hyper/ ne mène plus nulle part
  assert.equal(Object.hasOwn(ADRESSES_DU_PLAN_PRECEDENT, 'regles/avancees/liste-des-effets-mode-hyper/'), false);
  const options = { cheminDe: cheminDePage, existe: (page) => ids.includes(page), accueil: ACCUEIL_DU_GUIDE };
  assert.equal(Guide.adresseDesAnciensLiens('regles/avancees/liste-des-effets-mode-hyper/', options), 'regles/avancees/liste-des-effets-mode-hyper/',
    'un lien écrit : tel qu’écrit (la 404)');
  assert.ok(ids.includes('guide/le-mode-hyper') && !PAGES_SUPPRIMEES.includes('guide/le-mode-hyper'));
  assert.ok(Guide.BLOCS.includes('mode-hyper'), 'le bloc des deux tableaux (lib/guide.mjs#BLOCS)');
  assert.ok(Guide.morceauxDuChapitre(db.prepare("SELECT corps_md FROM page WHERE id = 'guide/le-mode-hyper'").get().corps_md).some((m) => m.bloc === 'mode-hyper'));
});

// Migration 0096, demande du propriétaire du 2026-11-06 : « L'onglet suivant est à retirer https://dev.maverick-jdr.com/regles/alterations-d-etats-et-mode-hyper/ ».
// Convention R185 (6) (« Page 404 ») : PAGES_SUPPRIMEES, sans renvoi ; les pages dont elle était le doublon restent.
test('0096 (2026-11-06) : « Altérations d’états et Mode Hyper » supprimée sans renvoi ; les pages des altérations et du Mode Hyper restent', () => {
  const id = 'guide/alterations-d-etats-et-mode-hyper';
  assert.ok(PAGES_SUPPRIMEES.includes(id), 'dans PAGES_SUPPRIMEES (son id reste réservé, serveur/edition-plan.mjs#idPris)');
  assert.ok(!ids.includes(id), 'plus dans la base');
  for (const adresse of ['/regles/alterations-d-etats-et-mode-hyper/', '/guide/alterations-d-etats-et-mode-hyper/',
    '/regles/avancees/alterations-d-etats-et-mode-hyper/']) {
    assert.equal(renvoi(adresse), null, `${adresse} : la page 404`);
  }
  // elle sort des anciennes Règles avancées, comme « Postures » et la Liste : /regles/avancees/alterations-d-etats-et-mode-hyper/ ne mène plus nulle part
  assert.equal(Object.hasOwn(ADRESSES_DU_PLAN_PRECEDENT, 'regles/avancees/alterations-d-etats-et-mode-hyper/'), false);
  const options = { cheminDe: cheminDePage, existe: (page) => ids.includes(page), accueil: ACCUEIL_DU_GUIDE };
  assert.equal(Guide.adresseDesAnciensLiens('regles/avancees/alterations-d-etats-et-mode-hyper/', options),
    'regles/avancees/alterations-d-etats-et-mode-hyper/', 'un lien écrit : tel qu’écrit (la 404)');
  for (const gardee of ['guide/alterations-d-etats', 'guide/liste-des-alterations-d-etat', 'guide/le-mode-hyper']) {
    assert.ok(ids.includes(gardee) && !PAGES_SUPPRIMEES.includes(gardee), `${gardee} : gardée`);
  }
});

test('R184, R185 : les anciennes adresses figées mènent à la nouvelle adresse de chaque page (page 404, liens écrits), requête et ancre gardées', () => {
  // /decouvrir/creer-son-personnage/ : l'introduction ; chacune de ses anciennes ancres d'étape (et de leurs sous-intertitres) à la page de l'étape
  assert.equal(renvoi('/decouvrir/creer-son-personnage/'), '/regles/creer-son-personnage/');
  assert.equal(renvoi('/decouvrir/creer-son-personnage/', { hash: '#quatre-personnages-pour-exemple' }), '/regles/creer-son-personnage/#quatre-personnages-pour-exemple');
  assert.equal(renvoi('/decouvrir/creer-son-personnage/', { hash: '#étape-5--choisir-ses-premiers-sorts', search: '?a=1' }), '/regles/premiers-sorts/?a=1');
  assert.equal(renvoi('/decouvrir/creer-son-personnage/', { hash: '#%C3%A9tape-1--imaginer-son-personnage-et-choisir-sa-race' }), '/regles/choisir-sa-race/', 'ancre encodée');
  assert.equal(renvoi('/decouvrir/creer-son-personnage/', { hash: '#une-ou-deux-classes--le-biclassage' }), '/regles/choisir-sa-classe/#une-ou-deux-classes--le-biclassage');
  assert.equal(renvoi('/MaverickCenter/decouvrir/creer-son-personnage/', { base: '/MaverickCenter/', hash: '#les-dons' }), '/MaverickCenter/regles/finaliser-son-personnage/#les-dons');
  const creer = PAGES_ECLATEES_DU_GUIDE['decouvrir/creer-son-personnage/'];
  assert.equal(creer.defaut, 'regles/creer-son-personnage/');
  // les anciennes ancres, relevées au commit 92a123d (un intertitre `##` par étape, ses `###`) : chacune mène à une page qui a l'intertitre visé
  const anciennes = Object.keys(creer.anciennesAncres);
  assert.equal(anciennes.length, 22);
  assert.equal(anciennes.filter((a) => a.startsWith('étape-')).length, 6);
  for (const [ancre, cible] of Object.entries(creer.anciennesAncres)) assert.ok(meneAUnIntertitre(cible), `#${ancre} → ${cible} : intertitre absent`);
  // les six étapes : /decouvrir/<étape>/ (2026-10-16 au 2026-10-18) et /guide/<étape>/ (avant) mènent à leur page, plus à « Créer son personnage »
  for (const id of PAGES_DE_LA_CREATION.pages.slice(1)) {
    const slug = id.slice('guide/'.length);
    for (const adresse of [`/decouvrir/${slug}/`, `/guide/${slug}/`]) assert.equal(renvoi(adresse, { hash: '#x' }), `/regles/${slug}/#x`, adresse);
  }
  // les Règles avancées : /regles/avancees/ mène au Mode Hyper, chaque ancienne page à sa nouvelle adresse (liste figée)
  assert.equal(renvoi('/regles/avancees/'), '/regles/le-mode-hyper/');
  const avancees = Object.entries(ADRESSES_DU_PLAN_PRECEDENT).filter(([a]) => a.startsWith('regles/avancees/') && a !== 'regles/avancees/');
  // moins « Postures » (migration 0094), la « Liste des effets mode hyper » (R187, migration 0095) et « Altérations d'états et Mode Hyper » (migration
  // 0096), supprimées le 2026-11-06
  assert.equal(avancees.length, 31, 'les 37 pages des Règles avancées au commit 92a123d, moins les 6 supprimées (« Les situations avancées » : éclatée, à part)');
  for (const [adresse, id] of avancees) {
    // une page supprimée sur le site de dev (« Formule des dégâts », le 2026-11-06) : son ancienne adresse mène à la page 404, sans renvoi vers une
    // autre page (réponse du propriétaire : « Page 404 » ; R185 (6))
    if (historique.supprimee('page', { id })) {
      assert.ok(!ids.includes(id), `${id} : supprimée par le site, absente de la base`);
      assert.equal(renvoi(`/${adresse}`, { search: '?q=1', hash: '#a' }), null, `${adresse} : la 404`);
      assert.equal(renvoi(`/${cheminDePage(id)}`), null, `${cheminDePage(id)} : sa dernière adresse aussi`);
      continue;
    }
    const attendue = Object.hasOwn(PAGES_ABSORBEES, id) ? adresseDeLaPageAbsorbee(id, cheminDePage) : cheminDePage(id);
    assert.equal(renvoi(`/${adresse}`, { search: '?q=1', hash: '#a' }), `/${attendue}?q=1#a`, adresse);
    assert.ok(ids.includes(id) || Object.hasOwn(PAGES_ABSORBEES, id), `${id} : une page de la base, ou absorbée`);
  }
  assert.equal(renvoi('/regles/avancees/meteo/'), '/regles/meteo/');
  assert.equal(renvoi('/regles/avancees/fiche-attributs/'), '/regles/fiche-attributs/');
  // les pages absorbées : Résistance/Faiblesse Magie, Les situations avancées (chaque ancienne section à sa page ; le reste à la page de la tenaille, P11)
  for (const adresse of ['/regles/avancees/resistance-faiblesse-magie/', '/guide/resistance-faiblesse-magie/']) assert.equal(renvoi(adresse), '/regles/resistances-et-faiblesses/', adresse);
  for (const adresse of ['/regles/avancees/situations-avancees/', '/guide/situations-avancees/']) {
    assert.equal(renvoi(adresse), '/regles/prise-en-tenaille-et-zone-d-influence/', adresse);
    assert.equal(renvoi(adresse, { hash: '#lembuscade' }), '/regles/l-embuscade/');
    assert.equal(renvoi(adresse, { hash: '#la-prise-en-tenaille' }), '/regles/prise-en-tenaille-et-zone-d-influence/#la-prise-en-tenaille');
    assert.equal(renvoi(adresse, { hash: '#rater-ses-sortil%C3%A8ges' }), '/regles/rater-ses-sortileges/');
  }
  const situations = PAGES_ECLATEES_DU_GUIDE['regles/avancees/situations-avancees/'];
  assert.equal(PAGES_ECLATEES_DU_GUIDE['guide/situations-avancees/'], situations);
  assert.equal(Object.keys(situations.anciennesAncres).length, 8, 'les huit sections');
  for (const [ancre, cible] of Object.entries(situations.anciennesAncres)) assert.ok(meneAUnIntertitre(cible), `#${ancre} → ${cible} : absente`);
  // le jeu de rôle (fusionné dans Bienvenue) ; la page du MJ, dernière de Découvrir avant le 2026-10-18
  assert.equal(renvoi('/decouvrir/le-jeu-de-role/'), '/decouvrir/#le-jeu-de-rôle-comment-ça-marche-');
  assert.equal(renvoi('/guide/le-jeu-de-role/', { search: '?a=1', hash: '#lire-les-des' }), '/decouvrir/?a=1#lire-les-des', 'l’ancre de l’ancienne adresse l’emporte');
  assert.equal(renvoi('/decouvrir/campagne-ou-scenario-one-shot/'), '/mj/campagne-ou-scenario-one-shot/');
  // les liens Markdown écrits vers une ancienne adresse mènent au même endroit que la page 404 (lib/guide-rendu.ts : pages éclatées d'abord)
  const options = { cheminDe: cheminDePage, existe: (id) => ids.includes(id), accueil: ACCUEIL_DU_GUIDE };
  const eclatees = { ...RENVOIS_DES_PAGES_ECLATEES, ...PAGES_ECLATEES_DU_GUIDE };
  const lienEcrit = (chemin) => {
    const eclatee = cheminVersUnePageEclatee(chemin, eclatees);
    return eclatee !== chemin ? eclatee : Guide.adresseDesAnciensLiens(chemin, options);
  };
  assert.equal(lienEcrit('regles/avancees/meteo/'), 'regles/meteo/');
  assert.equal(lienEcrit('regles/avancees/meteo/#la-pluie'), 'regles/meteo/#la-pluie');
  assert.equal(lienEcrit('regles/avancees/'), 'regles/le-mode-hyper/');
  assert.equal(lienEcrit('decouvrir/premiers-sorts/'), 'regles/premiers-sorts/');
  assert.equal(lienEcrit('decouvrir/creer-son-personnage/#étape-2--choisir-ses-magies'), 'regles/choisir-ses-magies/');
  // sa page supprimée le 2026-11-06 (migration 0094) : la section « Les boss » de la page des postures
  assert.equal(lienEcrit('guide/situations-avancees/#les-boss-et-leurs-postures'), 'regles/les-postures/#les-boss');
  assert.equal(lienEcrit('regles/avancees/resistance-faiblesse-magie/'), 'regles/resistances-et-faiblesses/');
  assert.equal(lienEcrit('decouvrir/le-jeu-de-role/'), 'decouvrir/#le-jeu-de-rôle-comment-ça-marche-');
  assert.equal(lienEcrit('regles/avancees/mode-hyper-magie/'), 'regles/avancees/mode-hyper-magie/', 'une page supprimée : telle qu’écrite (la 404)');
  assert.equal(lienEcrit('regles/avancees/postures/'), 'regles/avancees/postures/', 'une page supprimée (0094) : telle qu’écrite (la 404)');
  assert.equal(adresseEclatee('regles/creer-son-personnage/', eclatees), null, 'la nouvelle adresse n’est pas éclatée');
});

test('aujourd’hui (la base courante : pages, titres, intertitres et menus modifiés, créés ou supprimés sur le site de dev) : le plan s’installe et tient ; chaque page a une place ; chaque renvoi figé mène à une page servie, ou à la 404', () => {
  const courante = ouvrirBase({ sansExemples: false });
  const pages = pagesDe(courante);
  const presentes = new Set(pages.map((p) => p.id));
  const supprimees = historiqueSite(courante);
  try {
    installerLePlan(chargerPlanDesRegles(courante));
    assert.equal(verifierLePlan(pages), pages, 'le plan de la base courante tient');
    for (const { id } of pages) {
      const places = [estDansDecouvrir(id), estDuGuideDuMj(id), estDesOnglets(id)].filter(Boolean).length;
      assert.equal(places, id === FIXTURE ? 0 : 1, `${id} : une place et une seule`);
    }
    // le menu latéral de chaque onglet : une entrée par ligne de regles_onglet_entree dont la page est là, dans l'ordre des rangs (à égalité, l'id)
    for (const onglet of ongletsDesRegles()) {
      const { pages: entrees, edition } = menuLateralDe(onglet.ouverture, pages);
      const lignes = courante.prepare('SELECT id, rang, page_id FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang, id').all(onglet.id)
        .filter((l) => !l.page_id || presentes.has(l.page_id));
      assert.deepEqual(edition.entrees, lignes.map((l) => ({ id: l.id, rang: l.rang })), onglet.id);
      assert.deepEqual(entrees.map((e) => e.id ?? null), lignes.map((l) => l.page_id ?? null), onglet.id);
    }
    // les renvois figés (page 404 et liens écrits), là où la page visée est servie : sa page, quel que soit le texte qu'elle porte aujourd'hui ;
    // une page supprimée sur le site : la 404 (R185 (6)). L'intertitre visé se contrôle sur l'état d'import (tests ci-dessus).
    const renvois = renvoisDuGuide([...presentes]);
    const eclatees = { ...RENVOIS_DES_PAGES_ECLATEES, ...Livres.pagesEclateesDuGuide((id) => presentes.has(id)) };
    const vers = (adresse, hash = '') => adresseDeRenvoi(adresse, { base: '/', renvois, eclatees, hash });
    const servie = (adresse) => {
      const id = Livres.pageDuGuideALAdresse(adresse.replace(/^\//, ''));
      return id === null || presentes.has(id);
    };
    for (const [ancienne, r] of Object.entries(PAGES_ECLATEES_DU_GUIDE)) {
      const page = vers(`/${ancienne}`);
      assert.ok(page === null ? !presentes.has(Livres.pageDuGuideALAdresse(r.defaut)) : servie(page), `/${ancienne} → ${page}`);
      for (const ancre of Object.keys(r.anciennesAncres)) {
        const cible = vers(`/${ancienne}`, `#${ancre}`);
        assert.ok(cible === null || servie(cible), `/${ancienne}#${ancre} → ${cible}`);
      }
    }
    for (const [adresse, id] of Object.entries(ADRESSES_DU_PLAN_PRECEDENT)) {
      const cible = vers(`/${adresse}`);
      if (presentes.has(id)) assert.equal(cible, `/${Object.hasOwn(PAGES_ABSORBEES, id) ? adresseDeLaPageAbsorbee(id, cheminDePage) : cheminDePage(id)}`, adresse);
      else if (supprimees.supprimee('page', { id })) assert.equal(cible, null, `${adresse} : la 404`);
      else assert.ok(cible === null || servie(cible), `${adresse} → ${cible}`);
    }
    for (const [ancienne, nouvelle] of Object.entries(PAGES_ABSORBEES)) {
      const cible = vers(`/${ancienne}/`); // /guide/<slug>/
      assert.ok(presentes.has(nouvelle) ? cible?.startsWith(`/${cheminDePage(nouvelle)}`) : cible === null || servie(cible), `${ancienne} → ${cible}`);
    }
  } finally {
    installer();
  }
});

test('les anciennes adresses du guide d’avant (/guide/<slug>/, Liens, Rejoindre une partie, Lexique) : inchangées', () => {
  const renvois = renvoisDuGuide(ids);
  assert.equal(renvois['guide/'], 'decouvrir/');
  assert.deepEqual(Object.values(renvois).filter((c) => c.startsWith('guide/')), [], 'aucune cible sous guide/');
  for (const id of ids) {
    const nouvelle = `/${cheminDePage(id)}`;
    assert.equal(nouvelleAdresse(`/${id}/`, '/', renvois), nouvelle, id);
    assert.equal(nouvelleAdresse(`/${id}`, '/', renvois), nouvelle, `${id} sans barre de fin`);
    assert.equal(nouvelleAdresse(`/MaverickCenter/${id}/`, '/MaverickCenter/', renvois), `/MaverickCenter${nouvelle}`, `${id} sous un sous-chemin`);
    assert.equal(nouvelleAdresse(`/wiki/${id}/`, '/', renvois), nouvelle, `${id} : depuis /wiki/, un seul saut`);
  }
  // un renvoi ne masque jamais une adresse servie (ni une page, ni un onglet, ni /regles/)
  for (const id of ids) assert.equal(Object.hasOwn(renvois, cheminDePage(id)), false, `${cheminDePage(id)} : servie, pas renvoyée`);
  for (const chemin of ['regles/', ...ongletsDesRegles().map((o) => o.chemin), ARTISANAT.chemin]) assert.equal(Object.hasOwn(renvois, chemin), false, chemin);
  for (const adresse of ['/decouvrir/liens/', '/decouvrir/liens', '/guide/liens/', '/decouvrir/rejoindre-une-partie/', '/guide/rejoindre-une-partie/']) {
    assert.equal(nouvelleAdresse(adresse, '/', renvois), null, `${adresse} : plus de renvoi`);
  }
  assert.ok(Object.keys(renvois).every((k) => !k.includes('liens') && !k.includes('rejoindre-une-partie')));
  assert.deepEqual(PAGES_RETIREES, { 'guide/lexique': { vers: 'recherche/', adresses: ['guide/lexique/', 'regles/lexique/'] } });
  for (const adresse of ['/regles/lexique/', '/regles/lexique', '/guide/lexique/', '/wiki/guide/lexique/']) assert.equal(nouvelleAdresse(adresse, '/', renvois), '/recherche/', adresse);
  assert.equal(adresseComplete(nouvelleAdresse('/regles/lexique/', '/', renvois), '?q=AM', '#acquis'), '/recherche/?q=AM#acquis');
  assert.equal(Object.hasOwn(renvoisDuGuide([...ids, 'guide/lexique']), 'regles/lexique/'), false, 'une page retirée revenue : servie, pas renvoyée');
  assert.equal(nouvelleAdresse('/guide/', '/', renvois), '/decouvrir/');
  assert.equal(nouvelleAdresse('/guide/statistiques-resistance-faiblesse/', '/', renvois), '/magies/', 'une page retirée garde son renvoi (PAGES_RENOMMEES)');
  assert.equal(nouvelleAdresse('/guide/inconnue/', '/', renvois), null, 'une page qui n’a jamais existé reste introuvable');
  assert.equal(nouvelleAdresse('/guide/les-postures/', '/'), null, 'sans les renvois du build : rien (nav.mjs ne connaît pas le plan)');
  assert.equal(nouvelleAdresse('/guide//evil.example/', '/', renvois), null, 'jamais hors du site');
});

test('nav.mjs et livres.mjs n’importent rien (le script de la page 404 importe nav.mjs ; livres.mjs entre dans la chaîne de l’édition) ; la page 404 reçoit les renvois et les pages éclatées', () => {
  for (const f of ['../src/lib/nav.mjs', '../src/lib/livres.mjs']) {
    const source = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /^\s*(?:import|export\s+[^;]*\sfrom)\s/m, f);
  }
  const page404 = readFileSync(new URL('../src/pages/404.astro', import.meta.url), 'utf8');
  assert.match(page404, /data-renvois=\{JSON\.stringify\(renvois\)\}/);
  assert.match(page404, /const eclatees = \{ \.\.\.RENVOIS_DES_PAGES_ECLATEES, \.\.\.pagesEclateesDuGuide\(\(id: string\) => charges\.has\(id\)\) \};/);
  assert.match(page404, /data-eclatees=\{JSON\.stringify\(eclatees\)\}/);
  assert.match(page404, /adresseDeRenvoi\(location\.pathname, \{\s*base, renvois: lire\(introuvable\.dataset\.renvois\), eclatees: lire\(introuvable\.dataset\.eclatees\)/);
  assert.deepEqual([...page404.slice(page404.indexOf('<script>')).matchAll(/^\s*import .* from '([^']+)';$/gm)].map((m) => m[1]), ['../lib/nav.mjs']);
  // le build installe le plan de la base là où les pages se chargent (lib/wiki.ts), avant toute route
  assert.match(readFileSync(new URL('../src/lib/wiki.ts', import.meta.url), 'utf8'), /^installerLePlan\(chargerPlanDesRegles\(ouvrirBase\(\)\)\);$/m);
});
