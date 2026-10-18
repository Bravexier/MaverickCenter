// Le plan des pages du guide (lib/livres.mjs ; demandes du propriétaire, 2026-10-16 puis 2026-10-18 : « éclater le guide », puis « refaire toutes les
// anciennes pages du guide. Retirer le mécanisme de swipe, et les flèches suivant / précédent et la pagination ») : plus de livre ; Découvrir (une page
// par entrée du menu), Les bases, les Règles avancées et le Guide du MJ en sommaires ; les adresses de chaque page `guide/…` de la base, plus aucune sous
// /guide/ ; les pages fusionnées dans une autre ; les renvois des anciennes adresses par la page 404 ; le menu en six rubriques qui s'accorde au plan.
//   node --test test/livres.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import GithubSlugger from 'github-slugger';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  ACCUEIL_DU_GUIDE, ADRESSES_DU_PLAN_PRECEDENT, adresseDeLaPageAbsorbee, ANCRES_DES_PAGES_ABSORBEES, ARTISANAT, adresseDuGuide, couleurDeLaPage, DECOUVRIR, estDansDecouvrirOuLesBases, estDuGuideDuMj,
  filDAriane, groupeDeLaPage, groupesDesBases, groupesDesReglesAvancees, GUIDE_DU_MJ, LES_BASES, LIENS, NOMS_RESERVES, PAGES_ABSORBEES, PAR_OU_COMMENCER,
  PARTIES, pagesDeLaRubrique, placeDansLeGuide, REGLES_AVANCEES, rubriqueDe, RUBRIQUES_DU_GUIDE, RUBRIQUES_SOUS_LA_PAGE, verifierLePlan,
} from '../src/lib/livres.mjs';
import { PARTIES as PARTIES_DU_GUIDE } from '../src/lib/guide.mjs';
import { cheminDePage, estServieASonId, renvoisDuGuide } from '../src/lib/metiers.mjs';
import { adresseComplete, NAV, activeGroup, nouvelleAdresse } from '../src/lib/nav.mjs';
import { TYPE_KEYS, TYPES } from '../src/lib/types.mjs';
import * as Livres from '../src/lib/livres.mjs';

const db = ouvrirBase({ sansExemples: false });
// les pages du guide de la base, comme loadWiki les donne aux routes ({ id, data: { title, summary, status } })
const pagesDuGuide = db.prepare("SELECT id, titre, resume, statut FROM page WHERE type = 'guide' ORDER BY id").all()
  .map((p) => ({ id: p.id, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
const ids = pagesDuGuide.map((p) => p.id);
const groupes = (rubrique) => rubrique.groupes.map((g) => [g.id, g.titre, g.couleur, g.pages]);
const couleur = (id) => PARTIES.find((p) => p.id === id).couleur;

test('le plan : Découvrir, une page par entrée du menu (2 + 1 + 1), et Les bases (8 + 2 + 2), chaque groupe dans la couleur de son ancienne partie', () => {
  assert.deepEqual(RUBRIQUES_DU_GUIDE.map((r) => [r.id, r.titre, r.chemin, r.accueil]), [
    ['decouvrir', 'Découvrir', 'decouvrir/', 'guide/bienvenue'], ['bases', 'Les bases', 'regles/', null],
  ]);
  assert.deepEqual(groupes(DECOUVRIR), [
    ['decouvrir', 'Découvrir', couleur('decouvrir'), ['guide/bienvenue', 'guide/l-univers']],
    ['creer', 'Créer son personnage', couleur('creer'), ['guide/creer-son-personnage']],
    ['rejoindre', 'Rejoindre une partie', couleur('jouer'), ['guide/rejoindre-une-partie']],
  ]);
  assert.deepEqual(groupes(LES_BASES), [
    ['jouer', 'Jouer', couleur('jouer'), [
      'guide/reussir-une-action', 'guide/le-tour-de-jeu', 'guide/attaquer-et-se-defendre', 'guide/l-equipement', 'guide/les-degats', 'guide/les-postures',
      'guide/la-magie-en-jeu', 'guide/blessures-et-etats',
    ]],
    ['progresser', 'Progresser', couleur('progresser'), ['guide/la-montee-de-niveau', 'guide/s-entrainer-et-exercer-un-metier']],
    ['plus-loin', 'Pour aller plus loin', couleur('plus-loin'), ['guide/aide-memoire', 'guide/lexique']],
  ]);
  assert.deepEqual(pagesDeLaRubrique(LES_BASES).map((p) => p.ordre), Array.from({ length: 12 }, (_, i) => i), 'une place 0…M − 1 dans chaque rubrique');
  assert.deepEqual(GUIDE_DU_MJ.pages, ['guide/un-maitre-du-jeu', 'guide/guide-pour-mj-maverick', 'guide/campagne-ou-scenario-one-shot'],
    '« « Campagne » ou « Scénario one shot » ? » passe dans le Guide du MJ');
  // les couleurs des anciennes parties, toujours celles des quatre zones de la fiche (guide.mjs les réexporte)
  assert.deepEqual(PARTIES.map((p) => [p.id, p.couleur]), [['decouvrir', '#2a6f97'], ['creer', '#2e7d4f'], ['jouer', '#b03030'], ['progresser', '#6a4a9c'], ['plus-loin', '#5a6470']]);
  assert.equal(PARTIES_DU_GUIDE, PARTIES);
  assert.equal(ACCUEIL_DU_GUIDE, 'decouvrir/');
  assert.equal(couleurDeLaPage('guide/creer-son-personnage'), couleur('creer'));
  assert.equal(couleurDeLaPage('guide/les-degats'), couleur('jouer'));
  assert.equal(couleurDeLaPage('guide/meteo'), null, 'une page de référence : l’accent du site');
});

test('les pages fusionnées (2026-10-18) : Le jeu de rôle dans Bienvenue, les six étapes dans Créer son personnage ; plus dans la base, ni dans le plan', () => {
  assert.deepEqual(PAGES_ABSORBEES, {
    'guide/le-jeu-de-role': 'guide/bienvenue',
    'guide/choisir-sa-race': 'guide/creer-son-personnage',
    'guide/choisir-ses-magies': 'guide/creer-son-personnage',
    'guide/choisir-sa-classe': 'guide/creer-son-personnage',
    'guide/caracteristiques-et-competences': 'guide/creer-son-personnage',
    'guide/premiers-sorts': 'guide/creer-son-personnage',
    'guide/finaliser-son-personnage': 'guide/creer-son-personnage',
  });
  for (const [ancienne, nouvelle] of Object.entries(PAGES_ABSORBEES)) {
    assert.ok(!ids.includes(ancienne), `${ancienne} : retirée de la base`);
    assert.ok(ids.includes(nouvelle) && estDansDecouvrirOuLesBases(nouvelle), `${nouvelle} : dans Découvrir`);
  }
  assert.ok(ids.includes('guide/rejoindre-une-partie'), 'la nouvelle page « Rejoindre une partie »');
  // chacune mène à l'endroit de la page qui l'absorbe où se lit son contenu : l'id d'un intertitre de cette page (github-slugger, comme le rendu Markdown)
  assert.deepEqual(Object.keys(ANCRES_DES_PAGES_ABSORBEES), Object.keys(PAGES_ABSORBEES));
  for (const [ancienne, nouvelle] of Object.entries(PAGES_ABSORBEES)) {
    const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(nouvelle).corps_md;
    const slugger = new GithubSlugger();
    const intertitres = [...corps.matchAll(/^#{2,6} (.+)$/gm)].map((m) => slugger.slug(m[1].trim()));
    assert.ok(intertitres.includes(ANCRES_DES_PAGES_ABSORBEES[ancienne]), `${ancienne} : #${ANCRES_DES_PAGES_ABSORBEES[ancienne]} absent de ${nouvelle} (${intertitres.join(', ')})`);
    assert.equal(adresseDeLaPageAbsorbee(ancienne, cheminDePage), `${cheminDePage(nouvelle)}#${ANCRES_DES_PAGES_ABSORBEES[ancienne]}`);
  }
  assert.ok(ids.includes('guide/campagne-ou-scenario-one-shot'), 'la page du MJ reste, dans le Guide du MJ');
});

test('chaque page `guide/…` de la base a une adresse à elle, jamais sous /guide/, et une seule place dans le plan', () => {
  assert.ok(ids.length >= 55, `${ids.length} pages du guide`);
  const chemins = ids.map(cheminDePage);
  assert.equal(new Set(chemins).size, chemins.length, 'deux pages à la même adresse');
  for (const [i, id] of ids.entries()) {
    assert.doesNotMatch(chemins[i], /^guide\//, id);
    assert.match(chemins[i], /^(?:decouvrir|regles|mj)\/(?:[a-z0-9-]+\/)*$/, id);
    assert.notEqual(chemins[i], LES_BASES.chemin, `${id} : /regles/ est le sommaire des Bases`);
    assert.equal(estServieASonId(id), false, `${id} : la route des pages du wiki ne la sert pas`);
    const places = [estDansDecouvrirOuLesBases(id), estDuGuideDuMj(id), Boolean(groupeDeLaPage(id))].filter(Boolean).length;
    assert.equal(places, 1, `${id} : une place et une seule`);
  }
  assert.equal(cheminDePage('guide/bienvenue'), 'decouvrir/', 'Bienvenue à l’adresse de Découvrir');
  for (const { id } of pagesDeLaRubrique(DECOUVRIR).slice(1)) assert.equal(cheminDePage(id), `decouvrir/${id.slice('guide/'.length)}/`);
  for (const { id } of pagesDeLaRubrique(LES_BASES)) assert.equal(cheminDePage(id), `regles/${id.slice('guide/'.length)}/`);
  for (const id of GUIDE_DU_MJ.pages) assert.equal(cheminDePage(id), `mj/${id.slice('guide/'.length)}/`);
  assert.equal(cheminDePage('guide/rejoindre-une-partie'), 'decouvrir/rejoindre-une-partie/');
  assert.equal(cheminDePage('guide/reussir-une-action'), 'regles/reussir-une-action/');
  assert.equal(cheminDePage('guide/meteo'), 'regles/avancees/meteo/');
  assert.equal(adresseDuGuide('guide/une-page-ajoutee-plus-tard'), 'regles/avancees/une-page-ajoutee-plus-tard/', 'une page nouvelle a toujours une adresse');
  assert.equal(cheminDePage('races/elfe'), 'races/elfe/', 'les autres pages ne changent pas');
});

test('les adresses du plan n’entrent en conflit ni avec un type de page, ni avec une page Astro, ni entre elles', () => {
  for (const r of ['decouvrir', 'regles', 'mj']) assert.ok(!TYPE_KEYS.includes(r), `${r} est un type de page`);
  const slugs = RUBRIQUES_DU_GUIDE.flatMap((r) => pagesDeLaRubrique(r).map((p) => p.id.slice('guide/'.length)));
  for (const nom of NOMS_RESERVES) assert.ok(!slugs.includes(nom), nom);
  // les pages Astro écrites à côté des pages du plan : exactement les noms réservés et les sommaires (et rien d'autre sous ces chemins)
  const pages = new URL('../src/pages/', import.meta.url);
  assert.deepEqual(readdirSync(new URL('decouvrir/', pages)).sort(), ['[...page].astro', 'liens.astro']);
  assert.deepEqual(readdirSync(new URL('regles/', pages)).sort(), ['[...page].astro', 'artisanat.astro', 'avancees', 'index.astro']);
  assert.deepEqual(readdirSync(new URL('regles/avancees/', pages)).sort(), ['index.astro']);
  assert.deepEqual(readdirSync(new URL('mj/', pages)).sort(), ['[...page].astro', 'index.astro']);
  assert.ok(!existsSync(new URL('guide/', pages)), 'pas de route /guide/');
  assert.deepEqual([LIENS.chemin, ARTISANAT.chemin, REGLES_AVANCEES.chemin, LES_BASES.chemin], ['decouvrir/liens/', 'regles/artisanat/', 'regles/avancees/', 'regles/']);
});

test('le plan est contrôlé au build : une page absente, une page d’exemple, une page nommée deux fois ou une page absorbée encore là arrête tout', () => {
  assert.equal(verifierLePlan(pagesDuGuide), pagesDuGuide);
  const sans = (id) => pagesDuGuide.filter((p) => p.id !== id);
  assert.throws(() => verifierLePlan(sans('guide/lexique')), /guide\/lexique \(« Les bases »\) n'existe pas/);
  assert.throws(() => verifierLePlan(sans('guide/rejoindre-une-partie')), /guide\/rejoindre-une-partie \(« Découvrir »\) n'existe pas/);
  assert.throws(() => verifierLePlan(sans('guide/meteo')), /guide\/meteo \(groupe « Exploration et voyage »\) n'existe pas/);
  const exemple = pagesDuGuide.map((p) => (p.id === 'guide/un-maitre-du-jeu' ? { ...p, data: { ...p.data, status: 'example' } } : p));
  assert.throws(() => verifierLePlan(exemple), /guide\/un-maitre-du-jeu \(Guide du MJ\) est une page d'exemple/);
  const revenue = [...pagesDuGuide, { id: 'guide/premiers-sorts', data: { title: 'Étape 5 : ses premiers sorts', status: 'draft' } }];
  assert.throws(() => verifierLePlan(revenue), /guide\/premiers-sorts est absorbée par guide\/creer-son-personnage/);
  // HIDE_EXAMPLES=1 : sans les pages d'exemple, le plan tient toujours (aucune n'y est nommée)
  assert.doesNotThrow(() => verifierLePlan(pagesDuGuide.filter((p) => p.data.status !== 'example')));
  // aucune page nommée deux fois, aucun groupe vide
  const nommees = [...RUBRIQUES_DU_GUIDE.flatMap((r) => r.groupes.flatMap((g) => g.pages)), ...GUIDE_DU_MJ.pages, ...REGLES_AVANCEES.groupes.flatMap((g) => g.pages ?? [])];
  assert.equal(new Set(nommees).size, nommees.length);
  assert.ok(RUBRIQUES_DU_GUIDE.every((r) => r.groupes.every((g) => g.pages.length > 0)));
});

test('le sommaire des Bases : ses trois groupes, dans l’ordre du plan, chacun sa couleur', () => {
  const g = groupesDesBases(pagesDuGuide);
  assert.deepEqual(g.map((x) => [x.id, x.titre, x.couleur, x.pages.map((p) => p.id)]), groupes(LES_BASES));
  assert.deepEqual(groupesDesBases(pagesDuGuide.filter((p) => !p.id.startsWith('guide/l'))).map((x) => x.id), ['jouer', 'progresser', 'plus-loin'], 'une page absente est sautée');
});

test('les Règles avancées : tous les groupes dans l’ordre, exactement les pages hors de Découvrir, des Bases et du Guide du MJ', () => {
  const groupes = groupesDesReglesAvancees(pagesDuGuide);
  assert.deepEqual(groupes.map((g) => g.titre), [
    'Magie et Mode Hyper', 'Combat et actions', 'Altérations d’état', 'Alignement', 'Exploration et voyage', 'La fiche de personnage, case par case', 'Autres pages de référence',
  ]);
  const dans = groupes.flatMap((g) => g.pages.map((p) => p.id));
  const attendues = ids.filter((id) => !estDansDecouvrirOuLesBases(id) && !estDuGuideDuMj(id));
  assert.deepEqual([...dans].sort(), [...attendues].sort());
  assert.equal(new Set(dans).size, dans.length, 'une page dans un seul groupe');
  for (const g of groupes) for (const p of g.pages) assert.equal(groupeDeLaPage(p.id).id, g.id, `${p.id} : groupeDeLaPage`);
  // pièges, portes, météo, « Donjon pas bon » : « dans les règles avancées, pour tout le monde » (2026-10-18)
  assert.deepEqual(groupes.find((g) => g.id === 'exploration-et-voyage').pages.map((p) => p.id),
    ['guide/distance-et-voyage', 'guide/meteo', 'guide/les-pieges', 'guide/les-portes', 'guide/donjon-pas-bon']);
  assert.equal(groupes[0].pages[0].id, 'guide/le-mode-hyper', 'le Mode Hyper en tête de « Magie et Mode Hyper »');
  const fiche = groupes.find((g) => g.id === 'fiche-de-personnage').pages;
  assert.ok(fiche.length > 5 && fiche.every((p) => p.id.startsWith('guide/fiche-')), 'les pages « Fiche de personnage : … »');
  assert.deepEqual(fiche.map((p) => p.data.title), [...fiche.map((p) => p.data.title)].sort((a, b) => a.localeCompare(b, 'fr')), 'ordre des titres');
  // les documents des règles : leur bloc liste les pages par document, avec leurs liens, ce que /archives/ ne fait pas : une page de référence
  assert.equal(groupeDeLaPage('guide/les-documents-des-regles').id, 'autres');
  assert.equal(cheminDePage('guide/les-documents-des-regles'), 'regles/avancees/les-documents-des-regles/');
  assert.equal(dans.includes('guide/campagne-ou-scenario-one-shot'), false, 'la page du MJ n’est pas une page des Règles avancées');
  // une page d'exemple (utiliser-ce-wiki) tombe dans « Autres » tant qu'elle est chargée ; sans elle (HIDE_EXAMPLES=1), elle n'y est pas
  const sansExemples = groupesDesReglesAvancees(pagesDuGuide.filter((p) => p.data.status !== 'example')).flatMap((g) => g.pages);
  assert.ok(sansExemples.every((p) => p.data.status !== 'example'));
});

test('plus de livre : ni précédent ni suivant ; la place d’une page, son fil d’Ariane vers sa rubrique ou son sommaire', () => {
  for (const nom of ['LIVRES', 'livreDe', 'pagesDuLivre', 'voisinsDansLeLivre', 'suiteDuLivre', 'estDansUnLivre']) assert.equal(nom in Livres, false, nom);
  const place = rubriqueDe('guide/les-degats');
  assert.deepEqual([place.rubrique.titre, place.groupe.titre, place.ordre], ['Les bases', 'Jouer', 4]);
  assert.equal(rubriqueDe('guide/meteo'), null);
  assert.deepEqual(filDAriane('guide/bienvenue'), [{ titre: 'Découvrir', chemin: 'decouvrir/' }]);
  assert.deepEqual(filDAriane('guide/creer-son-personnage'), [{ titre: 'Découvrir', chemin: 'decouvrir/' }]);
  assert.deepEqual(filDAriane('guide/la-montee-de-niveau'), [{ titre: 'Les bases', chemin: 'regles/' }, { titre: 'Progresser', chemin: 'regles/#progresser' }]);
  assert.deepEqual(filDAriane('guide/meteo'), [{ titre: 'Règles avancées', chemin: 'regles/avancees/' }, { titre: 'Exploration et voyage', chemin: 'regles/avancees/#exploration-et-voyage' }]);
  assert.deepEqual(filDAriane('guide/campagne-ou-scenario-one-shot'), [{ titre: 'Guide du MJ', chemin: 'mj/' }]);
});

test('placeDansLeGuide : la rubrique et l’ordre d’une page (notes de version, panneau de la ceinture)', () => {
  assert.deepEqual(placeDansLeGuide('guide/bienvenue'), { rubrique: 'Découvrir', rang: 0, ordre: 0 });
  assert.deepEqual(placeDansLeGuide('guide/rejoindre-une-partie'), { rubrique: 'Découvrir', rang: 0, ordre: 3 });
  assert.deepEqual(placeDansLeGuide('guide/s-entrainer-et-exercer-un-metier'), { rubrique: 'Les bases', rang: 1, ordre: 9 });
  assert.deepEqual(placeDansLeGuide('guide/meteo'), { rubrique: 'Règles avancées', rang: 2, ordre: null });
  assert.deepEqual(placeDansLeGuide('guide/un-maitre-du-jeu'), { rubrique: 'Guide du MJ', rang: 3, ordre: null });
});

test('les pages nommées par le plan : « Par où commencer ? », L’univers et ses rubriques, l’Artisanat, les liens et l’encart de la rencontre', () => {
  assert.deepEqual(PAR_OU_COMMENCER, ['guide/bienvenue', 'guide/l-univers', 'guide/creer-son-personnage', 'guide/rejoindre-une-partie']);
  assert.deepEqual(PAR_OU_COMMENCER, pagesDeLaRubrique(DECOUVRIR).map((p) => p.id), 'les quatre pages de Découvrir');
  assert.deepEqual(RUBRIQUES_SOUS_LA_PAGE, { 'guide/l-univers': ['races', 'magies', 'classes'] });
  assert.deepEqual(RUBRIQUES_SOUS_LA_PAGE['guide/l-univers'].map((k) => TYPES[k].label), ['Races', 'Magies', 'Classes']);
  assert.deepEqual(ARTISANAT.pages, ['ressources/composants', 'ressources/alchimie', 'ressources/alchimie-primitive', 'ressources/alchimie-liste-ingredients', 'metiers/regles-des-metiers']);
  const existe = db.prepare('SELECT 1 FROM page WHERE id = ?');
  for (const id of ARTISANAT.pages.slice(1)) assert.ok(existe.get(id), `${id} : page absente`);
  assert.deepEqual(LIENS.liens.map((l) => [l.id, l.libelle, l.url]), [
    ['discord', 'Serveur Discord « L’univers de Maverick »', 'https://discord.gg/GMGBnjzfMk'],
    ['tipeee', 'Maverick JDR sur Tipeee', 'https://fr.tipeee.com/maverickjdr'],
  ]);
  // les présentations : une constante par lien, écrite à l'intégration de la refonte des pages (vide : rien ne s'affiche)
  for (const l of LIENS.liens) assert.equal(typeof l.presentation, 'string', l.id);
  assert.deepEqual(LIENS.rencontre, {
    id: 'prochaine-rencontre', titre: 'Notre prochaine rencontre IRL', annonce: 'prochaine-rencontre-irl', vide: 'Aucune rencontre annoncée pour le moment.',
  });
  assert.ok(db.prepare('SELECT 1 FROM annonce WHERE id = ?').get(LIENS.rencontre.annonce), 'l’annonce de l’encart est dans la base (migration 0068)');
});

test('le menu s’accorde au plan : Découvrir (une entrée par page), Règles (Les bases, Artisanat, Règles avancées), Espace MJ (Guide du MJ)', () => {
  const rubrique = (cle) => NAV.find((g) => g.key === cle);
  assert.deepEqual(rubrique('decouvrir').items.map((i) => i.path), [...PAR_OU_COMMENCER.map(cheminDePage), LIENS.chemin]);
  assert.deepEqual(rubrique('decouvrir').items.map((i) => i.label), ['Bienvenue', 'L’univers', 'Créer son personnage', 'Rejoindre une partie', 'Liens']);
  const regles = rubrique('regles').items.map((i) => i.path);
  for (const chemin of [LES_BASES.chemin, ARTISANAT.chemin, REGLES_AVANCEES.chemin]) assert.ok(regles.includes(chemin), chemin);
  assert.deepEqual([rubrique('regles').items[0].label, rubrique('regles').items[0].path], [LES_BASES.titre, LES_BASES.chemin]);
  assert.ok(rubrique('mj').items.some((i) => i.label === GUIDE_DU_MJ.titre && i.path === GUIDE_DU_MJ.chemin));
  assert.equal(activeGroup('/').key, 'decouvrir', 'l’accueil ouvre Découvrir');
  for (const id of ids) {
    const attendue = estDuGuideDuMj(id) ? 'mj' : rubriqueDe(id)?.rubrique === DECOUVRIR ? 'decouvrir' : 'regles';
    assert.equal(activeGroup(`/${cheminDePage(id)}`).key, attendue, id);
  }
});

test('les anciennes adresses mènent à la nouvelle adresse de chaque page (page 404), requête et ancre gardées', () => {
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
  // une page fusionnée : son adresse d'avant l'éclatement (/guide/<slug>/) ET celle du plan précédent (/decouvrir/<slug>/) mènent à la page qui l'absorbe,
  // à l'ancre où se lit son contenu ; l'ancre de l'ancienne adresse l'emporte
  for (const [ancienne, nouvelle] of Object.entries(PAGES_ABSORBEES)) {
    const slug = ancienne.slice('guide/'.length);
    for (const adresse of [`/guide/${slug}/`, `/decouvrir/${slug}/`]) {
      assert.equal(nouvelleAdresse(adresse, '/', renvois), `/${cheminDePage(nouvelle)}#${ANCRES_DES_PAGES_ABSORBEES[ancienne]}`, adresse);
      assert.equal(adresseComplete(nouvelleAdresse(adresse, '/', renvois), '', ''), `/${cheminDePage(nouvelle)}#${ANCRES_DES_PAGES_ABSORBEES[ancienne]}`, `${adresse} : sans ancre`);
    }
  }
  assert.equal(adresseComplete(nouvelleAdresse('/decouvrir/premiers-sorts/', '/', renvois), '?a=1', ''), '/decouvrir/creer-son-personnage/?a=1#étape-5--choisir-ses-premiers-sorts');
  assert.equal(adresseComplete(nouvelleAdresse('/decouvrir/le-jeu-de-role/', '/', renvois), '?a=1', '#lire-les-des'), '/decouvrir/?a=1#lire-les-des');
  const cible = nouvelleAdresse('/guide/choisir-sa-classe/', '/', renvois);
  assert.equal(adresseComplete(cible, '?a=1', '#une-ou-deux-classes--le-biclassage'), '/decouvrir/creer-son-personnage/?a=1#une-ou-deux-classes--le-biclassage');
  // une page déplacée depuis le plan précédent : la page du MJ, qui était la dernière de Découvrir
  assert.deepEqual(ADRESSES_DU_PLAN_PRECEDENT, { 'decouvrir/campagne-ou-scenario-one-shot/': 'guide/campagne-ou-scenario-one-shot' });
  assert.equal(nouvelleAdresse('/decouvrir/campagne-ou-scenario-one-shot/', '/', renvois), '/mj/campagne-ou-scenario-one-shot/');
  // un renvoi ne masque jamais une adresse servie
  for (const id of ids) assert.equal(Object.hasOwn(renvois, cheminDePage(id)), false, `${cheminDePage(id)} : servie, pas renvoyée`);
  assert.equal(Object.hasOwn(renvois, LES_BASES.chemin), false, '/regles/ : le sommaire des Bases');
  assert.equal(nouvelleAdresse('/guide/', '/', renvois), '/decouvrir/');
  assert.equal(nouvelleAdresse('/guide', '/', renvois), '/decouvrir/');
  assert.equal(nouvelleAdresse('/guide/statistiques-resistance-faiblesse/', '/', renvois), '/magies/', 'une page retirée garde son renvoi (PAGES_RENOMMEES)');
  assert.equal(nouvelleAdresse('/guide/inconnue/', '/', renvois), null, 'une page qui n’a jamais existé reste introuvable');
  assert.equal(nouvelleAdresse('/guide/les-postures/', '/'), null, 'sans les renvois du build : rien (nav.mjs ne connaît pas le plan)');
  assert.equal(adresseComplete(nouvelleAdresse('/guide/', '/', renvois), '', '#bienvenue'), '/decouvrir/#bienvenue');
  // un renvoi ne mène jamais hors du site
  assert.equal(nouvelleAdresse('/guide//evil.example/', '/', renvois), null);
});

test('nav.mjs et livres.mjs n’importent rien (le script de la page 404 importe nav.mjs ; livres.mjs entre dans la chaîne de l’édition)', () => {
  for (const f of ['../src/lib/nav.mjs', '../src/lib/livres.mjs']) {
    const source = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /^\s*(?:import|export\s+[^;]*\sfrom)\s/m, f);
  }
  // la page 404 écrit les renvois au build et les passe à nouvelleAdresse
  const page404 = readFileSync(new URL('../src/pages/404.astro', import.meta.url), 'utf8');
  assert.match(page404, /data-renvois=\{JSON\.stringify\(renvois\)\}/);
  assert.match(page404, /nouvelleAdresse\(location\.pathname, base, renvois\)/);
  assert.deepEqual([...page404.slice(page404.indexOf('<script>')).matchAll(/^\s*import .* from '([^']+)';$/gm)].map((m) => m[1]), ['../lib/nav.mjs']);
});
