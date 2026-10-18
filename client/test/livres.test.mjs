// Le plan des pages du guide (lib/livres.mjs ; demande du propriétaire, 2026-10-16 puis 2026-10-18 : « éclater le guide ») : deux livres lus dans
// l'ordre (Découvrir, Les bases), les Règles avancées et le Guide du MJ en sommaires ; les adresses de chaque page `guide/…` de la base, plus aucune sous
// /guide/ ; les renvois des anciennes adresses par la page 404 ; le menu en six rubriques qui s'accorde au plan.
//   node --test test/livres.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  ACCUEIL_DU_GUIDE, ARTISANAT, adresseDuGuide, estDansUnLivre, estDuGuideDuMj, groupeDeLaPage, groupesDesReglesAvancees, GUIDE_DU_MJ, LIENS, LIVRES,
  livreDe, NOMS_RESERVES, PAR_OU_COMMENCER, PARTIES, pagesDuLivre, placeDansLeGuide, REGLES_AVANCEES, RUBRIQUES_SOUS_LA_PAGE, suiteDuLivre, verifierLePlan,
  voisinsDansLeLivre,
} from '../src/lib/livres.mjs';
import { PARTIES as PARTIES_DU_GUIDE } from '../src/lib/guide.mjs';
import { cheminDePage, estServieASonId, renvoisDuGuide } from '../src/lib/metiers.mjs';
import { adresseComplete, NAV, activeGroup, nouvelleAdresse } from '../src/lib/nav.mjs';
import { TYPE_KEYS, TYPES } from '../src/lib/types.mjs';

const db = ouvrirBase({ sansExemples: false });
// les pages du guide de la base, comme loadWiki les donne aux routes ({ id, data: { title, summary, status } })
const pagesDuGuide = db.prepare("SELECT id, titre, resume, statut FROM page WHERE type = 'guide' ORDER BY id").all()
  .map((p) => ({ id: p.id, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
const ids = pagesDuGuide.map((p) => p.id);
const titres = (livre) => livre.sections.map((s) => [s.id, s.titre, s.couleur, s.pages.length]);
const couleur = (id) => PARTIES.find((p) => p.id === id).couleur;

test('le plan : Découvrir (3 + 7 + 1 pages) et Les bases (8 + 2 + 2), dans l’ordre de lecture, chaque section dans la couleur de son ancienne partie', () => {
  assert.deepEqual(LIVRES.map((l) => [l.id, l.titre, l.chemin]), [['decouvrir', 'Découvrir', 'decouvrir/'], ['bases', 'Les bases', 'regles/']]);
  assert.deepEqual(titres(LIVRES[0]), [
    ['decouvrir', 'Découvrir', couleur('decouvrir'), 3], ['creer', 'Créer son personnage', couleur('creer'), 7], ['rejoindre', 'Rejoindre une partie', couleur('jouer'), 1],
  ]);
  assert.deepEqual(titres(LIVRES[1]), [
    ['jouer', 'Jouer', couleur('jouer'), 8], ['progresser', 'Progresser', couleur('progresser'), 2], ['plus-loin', 'Pour aller plus loin', couleur('plus-loin'), 2],
  ]);
  assert.deepEqual(pagesDuLivre(LIVRES[0]).map((p) => p.id), [
    'guide/bienvenue', 'guide/le-jeu-de-role', 'guide/l-univers', 'guide/creer-son-personnage', 'guide/choisir-sa-race', 'guide/choisir-ses-magies',
    'guide/choisir-sa-classe', 'guide/caracteristiques-et-competences', 'guide/premiers-sorts', 'guide/finaliser-son-personnage', 'guide/campagne-ou-scenario-one-shot',
  ]);
  assert.deepEqual(pagesDuLivre(LIVRES[1]).map((p) => p.id), [
    'guide/reussir-une-action', 'guide/le-tour-de-jeu', 'guide/attaquer-et-se-defendre', 'guide/l-equipement', 'guide/les-degats', 'guide/les-postures',
    'guide/la-magie-en-jeu', 'guide/blessures-et-etats', 'guide/la-montee-de-niveau', 'guide/s-entrainer-et-exercer-un-metier', 'guide/aide-memoire', 'guide/lexique',
  ]);
  assert.deepEqual(pagesDuLivre(LIVRES[1]).map((p) => p.numero), Array.from({ length: 12 }, (_, i) => i + 1), 'numéros 1…M dans chaque livre');
  // les couleurs des anciennes parties, toujours celles des quatre zones de la fiche (guide.mjs les réexporte)
  assert.deepEqual(PARTIES.map((p) => [p.id, p.couleur]), [['decouvrir', '#2a6f97'], ['creer', '#2e7d4f'], ['jouer', '#b03030'], ['progresser', '#6a4a9c'], ['plus-loin', '#5a6470']]);
  assert.equal(PARTIES_DU_GUIDE, PARTIES);
  assert.equal(ACCUEIL_DU_GUIDE, 'decouvrir/');
});

test('chaque page `guide/…` de la base a une adresse à elle, jamais sous /guide/, et une seule place dans le plan', () => {
  assert.ok(ids.length >= 60, `${ids.length} pages du guide`);
  const chemins = ids.map(cheminDePage);
  assert.equal(new Set(chemins).size, chemins.length, 'deux pages à la même adresse');
  for (const [i, id] of ids.entries()) {
    assert.doesNotMatch(chemins[i], /^guide\//, id);
    assert.match(chemins[i], /^(?:decouvrir|regles|mj)\/(?:[a-z0-9-]+\/)*$/, id);
    assert.equal(estServieASonId(id), false, `${id} : la route des pages du wiki ne la sert pas`);
    const places = [estDansUnLivre(id), estDuGuideDuMj(id), Boolean(groupeDeLaPage(id))].filter(Boolean).length;
    assert.equal(places, 1, `${id} : une place et une seule`);
  }
  for (const livre of LIVRES) {
    const [premiere, ...autres] = pagesDuLivre(livre);
    assert.equal(cheminDePage(premiere.id), livre.chemin, 'la première page à l’adresse du livre');
    for (const p of autres) assert.equal(cheminDePage(p.id), `${livre.chemin}${p.id.slice('guide/'.length)}/`);
  }
  for (const id of GUIDE_DU_MJ.pages) assert.equal(cheminDePage(id), `mj/${id.slice('guide/'.length)}/`);
  assert.equal(cheminDePage('guide/meteo'), 'regles/avancees/meteo/');
  assert.equal(adresseDuGuide('guide/une-page-ajoutee-plus-tard'), 'regles/avancees/une-page-ajoutee-plus-tard/', 'une page nouvelle a toujours une adresse');
  assert.equal(cheminDePage('races/elfe'), 'races/elfe/', 'les autres pages ne changent pas');
});

test('les adresses du plan n’entrent en conflit ni avec un type de page, ni avec une page Astro, ni entre elles', () => {
  for (const r of ['decouvrir', 'regles', 'mj']) assert.ok(!TYPE_KEYS.includes(r), `${r} est un type de page`);
  const slugs = LIVRES.flatMap((l) => pagesDuLivre(l).map((p) => p.id.slice('guide/'.length)));
  for (const nom of NOMS_RESERVES) assert.ok(!slugs.includes(nom), nom);
  // les pages Astro écrites à côté des pages de livre : exactement les noms réservés (et rien d'autre sous ces chemins)
  const pages = new URL('../src/pages/', import.meta.url);
  assert.deepEqual(readdirSync(new URL('decouvrir/', pages)).sort(), ['[...page].astro', 'liens.astro']);
  assert.deepEqual(readdirSync(new URL('regles/', pages)).sort(), ['[...page].astro', 'artisanat.astro', 'avancees']);
  assert.deepEqual(readdirSync(new URL('regles/avancees/', pages)).sort(), ['index.astro']);
  assert.deepEqual(readdirSync(new URL('mj/', pages)).sort(), ['[...page].astro', 'index.astro']);
  assert.ok(!existsSync(new URL('guide/', pages)), 'pas de route /guide/');
  assert.deepEqual([LIENS.chemin, ARTISANAT.chemin, REGLES_AVANCEES.chemin], ['decouvrir/liens/', 'regles/artisanat/', 'regles/avancees/']);
});

test('le plan est contrôlé au build : une page absente, une page d’exemple ou une page nommée deux fois arrête tout', () => {
  assert.equal(verifierLePlan(pagesDuGuide), pagesDuGuide);
  const sans = (id) => pagesDuGuide.filter((p) => p.id !== id);
  assert.throws(() => verifierLePlan(sans('guide/lexique')), /guide\/lexique \(livre « Les bases »\) n'existe pas/);
  assert.throws(() => verifierLePlan(sans('guide/meteo')), /guide\/meteo \(groupe « Exploration et voyage »\) n'existe pas/);
  const exemple = pagesDuGuide.map((p) => (p.id === 'guide/un-maitre-du-jeu' ? { ...p, data: { ...p.data, status: 'example' } } : p));
  assert.throws(() => verifierLePlan(exemple), /guide\/un-maitre-du-jeu \(Guide du MJ\) est une page d'exemple/);
  // HIDE_EXAMPLES=1 : sans les pages d'exemple, le plan tient toujours (aucune n'y est nommée)
  assert.doesNotThrow(() => verifierLePlan(pagesDuGuide.filter((p) => p.data.status !== 'example')));
  // aucune page nommée deux fois, aucune section vide
  const nommees = [...LIVRES.flatMap((l) => l.sections.flatMap((s) => s.pages)), ...GUIDE_DU_MJ.pages, ...REGLES_AVANCEES.groupes.flatMap((g) => g.pages ?? [])];
  assert.equal(new Set(nommees).size, nommees.length);
  assert.ok(LIVRES.every((l) => l.sections.every((s) => s.pages.length > 0)));
});

test('les Règles avancées : tous les groupes dans l’ordre, exactement les pages hors des livres et du Guide du MJ', () => {
  const groupes = groupesDesReglesAvancees(pagesDuGuide);
  assert.deepEqual(groupes.map((g) => g.titre), [
    'Magie et Mode Hyper', 'Combat et actions', 'Altérations d’état', 'Alignement', 'Exploration et voyage', 'La fiche de personnage, case par case', 'Autres pages de référence',
  ]);
  const dans = groupes.flatMap((g) => g.pages.map((p) => p.id));
  const attendues = ids.filter((id) => !estDansUnLivre(id) && !estDuGuideDuMj(id));
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
  // une page d'exemple (utiliser-ce-wiki) tombe dans « Autres » tant qu'elle est chargée ; sans elle (HIDE_EXAMPLES=1), elle n'y est pas
  const sansExemples = groupesDesReglesAvancees(pagesDuGuide.filter((p) => p.data.status !== 'example')).flatMap((g) => g.pages);
  assert.ok(sansExemples.every((p) => p.data.status !== 'example'));
});

test('précédent et suivant : dans le livre seulement, rien avant la première page ni après la dernière (flèches grisées)', () => {
  assert.deepEqual(voisinsDansLeLivre('guide/bienvenue'), { precedent: null, suivant: 'guide/le-jeu-de-role' });
  assert.deepEqual(voisinsDansLeLivre('guide/l-univers'), { precedent: 'guide/le-jeu-de-role', suivant: 'guide/creer-son-personnage' });
  assert.deepEqual(voisinsDansLeLivre('guide/campagne-ou-scenario-one-shot'), { precedent: 'guide/finaliser-son-personnage', suivant: null }, 'Découvrir ne se prolonge pas dans Les bases');
  assert.deepEqual(voisinsDansLeLivre('guide/reussir-une-action'), { precedent: null, suivant: 'guide/le-tour-de-jeu' });
  assert.deepEqual(voisinsDansLeLivre('guide/lexique'), { precedent: 'guide/aide-memoire', suivant: null });
  assert.equal(voisinsDansLeLivre('guide/meteo'), null);
  // le lien du bas de la dernière page mène à la suite du plan : Découvrir → Les bases → Règles avancées
  assert.deepEqual(suiteDuLivre(LIVRES[0]), { titre: 'Les bases', chemin: LIVRES[1].chemin });
  assert.deepEqual(suiteDuLivre(LIVRES[1]), { titre: REGLES_AVANCEES.titre, chemin: 'regles/avancees/' });
  const place = livreDe('guide/les-degats');
  assert.deepEqual([place.livre.titre, place.section.titre, place.numero, place.total], ['Les bases', 'Jouer', 5, 12]);
  assert.equal(livreDe('guide/meteo'), null);
});

test('placeDansLeGuide : la rubrique et l’ordre d’une page (notes de version, aide « Entraînement » de la fiche)', () => {
  assert.deepEqual(placeDansLeGuide('guide/bienvenue'), { rubrique: 'Découvrir', rang: 0, numero: 1 });
  assert.deepEqual(placeDansLeGuide('guide/s-entrainer-et-exercer-un-metier'), { rubrique: 'Les bases', rang: 1, numero: 10 });
  assert.deepEqual(placeDansLeGuide('guide/meteo'), { rubrique: 'Règles avancées', rang: 2, numero: null });
  assert.deepEqual(placeDansLeGuide('guide/un-maitre-du-jeu'), { rubrique: 'Guide du MJ', rang: 3, numero: null });
});

test('les pages nommées par le plan : « Par où commencer ? », L’univers et ses rubriques, l’Artisanat, les liens', () => {
  assert.deepEqual(PAR_OU_COMMENCER, ['guide/bienvenue', 'guide/l-univers', 'guide/creer-son-personnage', 'guide/campagne-ou-scenario-one-shot']);
  for (const id of PAR_OU_COMMENCER) assert.equal(livreDe(id).livre.id, 'decouvrir', id);
  assert.deepEqual(RUBRIQUES_SOUS_LA_PAGE, { 'guide/l-univers': ['races', 'magies', 'classes'] });
  assert.deepEqual(RUBRIQUES_SOUS_LA_PAGE['guide/l-univers'].map((k) => TYPES[k].label), ['Races', 'Magies', 'Classes']);
  assert.deepEqual(ARTISANAT.pages, ['ressources/composants', 'ressources/alchimie', 'ressources/alchimie-primitive', 'ressources/alchimie-liste-ingredients', 'metiers/regles-des-metiers']);
  const existe = db.prepare('SELECT 1 FROM page WHERE id = ?');
  for (const id of ARTISANAT.pages.slice(1)) assert.ok(existe.get(id), `${id} : page absente`);
  assert.deepEqual(LIENS.liens.map((l) => [l.libelle, l.url]), [
    ['Serveur Discord « L’univers de Maverick »', 'https://discord.gg/GMGBnjzfMk'],
    ['Maverick JDR sur Tipeee', 'https://fr.tipeee.com/maverickjdr'],
  ]);
  assert.deepEqual(GUIDE_DU_MJ.pages, ['guide/un-maitre-du-jeu', 'guide/guide-pour-mj-maverick']);
});

test('le menu s’accorde au plan : Découvrir, Règles (Les bases, Artisanat, Règles avancées), Espace MJ (Guide du MJ)', () => {
  const rubrique = (cle) => NAV.find((g) => g.key === cle);
  assert.deepEqual(rubrique('decouvrir').items.map((i) => i.path), [...PAR_OU_COMMENCER.map(cheminDePage), LIENS.chemin]);
  const regles = rubrique('regles').items.map((i) => i.path);
  for (const chemin of [cheminDePage(pagesDuLivre(LIVRES[1])[0].id), ARTISANAT.chemin, REGLES_AVANCEES.chemin]) assert.ok(regles.includes(chemin), chemin);
  assert.equal(rubrique('regles').items[0].label, LIVRES[1].titre);
  assert.ok(rubrique('mj').items.some((i) => i.label === GUIDE_DU_MJ.titre && i.path === GUIDE_DU_MJ.chemin));
  assert.equal(activeGroup('/').key, 'decouvrir', 'l’accueil ouvre Découvrir');
  for (const id of ids) {
    const attendue = estDuGuideDuMj(id) ? 'mj' : livreDe(id)?.livre.id === 'decouvrir' ? 'decouvrir' : 'regles';
    assert.equal(activeGroup(`/${cheminDePage(id)}`).key, attendue, id);
  }
});

test('les anciennes adresses /guide/… mènent à la nouvelle adresse de chaque page (page 404), requête et ancre gardées', () => {
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
  assert.equal(nouvelleAdresse('/guide/', '/', renvois), '/decouvrir/');
  assert.equal(nouvelleAdresse('/guide', '/', renvois), '/decouvrir/');
  assert.equal(nouvelleAdresse('/guide/statistiques-resistance-faiblesse/', '/', renvois), '/magies/', 'une page retirée garde son renvoi (PAGES_RENOMMEES)');
  assert.equal(nouvelleAdresse('/guide/inconnue/', '/', renvois), null, 'une page qui n’a jamais existé reste introuvable');
  assert.equal(nouvelleAdresse('/guide/les-postures/', '/'), null, 'sans les renvois du build : rien (nav.mjs ne connaît pas le plan)');
  const cible = nouvelleAdresse('/guide/choisir-sa-classe/', '/', renvois);
  assert.equal(adresseComplete(cible, '?a=1', '#une-ou-deux-classes--le-biclassage'), '/decouvrir/choisir-sa-classe/?a=1#une-ou-deux-classes--le-biclassage');
  assert.equal(adresseComplete(nouvelleAdresse('/guide/', '/', renvois), '', '#sommaire'), '/decouvrir/#sommaire');
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
