import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ADRESSE_DU_SITE_DE_DEV, MENU_DU_PROFIL, NAV, NIVEAUX_DU_MENU, activeGroup, adresseComplete, adresseDeRenvoi, adresseEclatee, cheminVersUnePageEclatee, entreesAPlat,
  entreesVisibles, groupIsCurrent, legacyWikiRedirect, navPaths, nouvelleAdresse, rubriqueCourante,
} from '../src/lib/nav.mjs';
import { ADRESSE_DU_SITE_DE_DEV as ADRESSE_DE_L_EXTRAIT } from '../scripts/db-extrait.mjs';
import { RENVOIS_DES_PAGES_ECLATEES } from '../src/lib/equipement.mjs';
import { PARAMETRE_MOT_CLE } from '../src/lib/recherche-mots-cles.mjs';
import { TYPE_KEYS } from '../src/lib/types.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const content = new URL('../src/content/wiki/', import.meta.url);
const rubrique = (cle) => NAV.find((g) => g.key === cle);
const chemins = (g) => entreesAPlat(g.items).map((i) => i.path ?? null);

test('R319 (1) : cinq rubriques, dans l’ordre voulu par le propriétaire, leurs entrées, leurs sous-pages et leurs entrées « bientôt »', () => {
  assert.deepEqual(NAV.map((g) => [g.key, g.label]), [['jeu', 'Le Jeu'], ['regles', 'Règles'], ['ressources', 'Ressources'], ['monde', 'Le monde'], ['taverne', 'Taverne']]);
  const plan = (g) => g.items.map((i) => (i.enfants ? `${i.label} [${i.enfants.map((e) => e.label).join(', ')}]` : i.path || i.onglet || i.motCle ? i.label : `${i.label} (bientôt)`));
  assert.deepEqual(plan(rubrique('jeu')), ['Introduction [Découvrir, L’univers]', 'Les races', 'Les magies', 'Les classes', 'Les métiers', 'Les familiers', 'La fiche de personnage', 'Personnages prétirés']);
  assert.deepEqual(plan(rubrique('regles')).slice(3), ['Guide du MJ', 'Mise à jour', 'Statistiques (bientôt)'], 'après les trois onglets des Règles');
  assert.deepEqual(plan(rubrique('ressources')), ['Armes', 'Armures', 'Boucliers', 'Accessoires', 'Ceinture', 'Livres & Parchemins', 'Artisanat', 'Composants', 'Autres']);
  assert.deepEqual(plan(rubrique('monde')), ['Chronologie', 'Lieux (bientôt)', 'Mythologie', 'Bestiaire', 'Factions']);
  assert.deepEqual(plan(rubrique('taverne')), ['Parties (bientôt)', 'Planning (bientôt)', 'Galerie', 'Suggestions (bientôt)', 'Archives', 'Debug']);
  assert.deepEqual(chemins(rubrique('jeu')), [null, 'decouvrir/', 'decouvrir/l-univers/', 'races/', 'magies/', 'classes/', 'metiers/', 'ressources/familiers/', 'regles/fiche-de-personnage/', 'personnages/']);
  assert.deepEqual(chemins(rubrique('ressources')), [
    'ressources/armes/', 'ressources/armures/', 'ressources/bouclier/', 'ressources/accessoires/', 'ressources/objets-a-la-ceinture/', 'ressources/livre-parchemin/',
    'regles/artisanat/', 'ressources/composants/', 'ressources/',
  ], 'les adresses d’avant (identifiants figés) ; Autres, la liste des pages de ressources, en dernier');
  assert.deepEqual(chemins(rubrique('monde')), ['chronologie/', null, 'lore/les-divinites/', 'bestiaire/', 'lore/temples-cultes-guildes/']);
  assert.deepEqual(chemins(rubrique('taverne')), [null, null, 'galeries/', null, 'archives/', 'debug/']);
  assert.ok(chemins(rubrique('regles')).includes('mj/') && chemins(rubrique('regles')).includes('mise-a-jour/'));
  // Introduction n'est pas une page : pas de lien à elle, ses sous-pages seulement ; navPaths les compte, et les `autres` gardent les pages hors menu
  const introduction = rubrique('jeu').items[0];
  assert.ok(!introduction.path && !introduction.motCle && !introduction.onglet && introduction.cle, 'une entrée qui se déplie, nommée par `cle` (l’état replié)');
  assert.ok(navPaths().includes('decouvrir/l-univers/') && !navPaths().some((p) => p.includes('#')));
  assert.deepEqual(rubrique('ressources').autres, ['ressources/']);
  assert.deepEqual(rubrique('regles').autres, ['regles/']);
  assert.ok(!navPaths().includes('fiche/'), 'R319 (6) : pas d’entrée pour le générateur de fiche ; on y arrive par Personnages prétirés et par l’onglet des Règles');
  assert.ok(!NAV.flatMap((g) => g.autres ?? []).includes('tags/'), 'plus de pages /tags/ dans le menu');
});

test('R319 (3) : les niveaux sont portés par les données ; entreesVisibles retire `devSeulement` ([Dev]), `prodSeulement` ([Prod]) et, pour la version portable, tout `niveau` ; le niveau du compte, lui, s’applique dans le navigateur', () => {
  const champs = ['label', 'path', 'motCle', 'libelleArbo', 'onglet', 'enfants', 'cle', 'niveau', 'devSeulement', 'prodSeulement'];
  for (const e of NAV.flatMap((g) => entreesAPlat(g.items))) {
    assert.ok(Object.keys(e).every((k) => champs.includes(k)), `${e.label} : un champ que lib/menu-db.mjs ne connaît pas`);
    assert.ok(e.niveau === undefined || NIVEAUX_DU_MENU.includes(e.niveau), `${e.label} : niveau ${e.niveau}`);
  }
  assert.deepEqual(NIVEAUX_DU_MENU, ['joueur', 'mj', 'createur']);
  // les niveaux voulus ([J] [MJ] de R319 (1)) : un par entrée, ou celui de la rubrique
  assert.deepEqual(NAV.filter((g) => g.niveau).map((g) => [g.key, g.niveau]), [['ressources', 'joueur'], ['monde', 'joueur'], ['taverne', 'joueur']], 'les rubriques [J] ; Le Jeu et Règles sans niveau');
  const parNiveau = (g) => g.items.filter((i) => i.niveau).map((i) => `${i.label} ${i.niveau}`);
  assert.deepEqual(parNiveau(rubrique('regles')), ['Guide du MJ mj', 'Mise à jour joueur', 'Statistiques joueur']);
  assert.deepEqual(parNiveau(rubrique('monde')), ['Bestiaire mj']);
  // sans `sansNiveau`, le niveau n'est pas filtré au build (le navigateur le montre ou le cache) : toutes les entrées, sauf celles du site de dev seulement hors du site de dev
  for (const g of NAV) {
    assert.deepEqual(entreesVisibles(g.items), g.items, `${g.key} : sur le site de dev, tout`);
    assert.deepEqual(entreesVisibles(g.items, { dev: false }), g.items.filter((i) => !i.devSeulement), `${g.key} : seul devSeulement est retiré`);
    // la version portable (sans service) : le menu d'un Observateur, sans aucune entrée à niveau
    assert.deepEqual(entreesVisibles(g.items, { dev: false, sansNiveau: true }), g.items.filter((i) => !i.devSeulement && !i.niveau), `${g.key} : sans les entrées à niveau`);
  }
  assert.ok(NAV.every((g) => g.items.every((i) => !i.prodSeulement)), 'prodSeulement : porté (le menu du profil), pas appliqué');
  // jusque dans les sous-pages
  const arbre = [{ label: 'A', enfants: [{ label: 'a1' }, { label: 'a2', devSeulement: true }] }, { label: 'B', devSeulement: true, niveau: 'createur' }];
  assert.deepEqual(entreesVisibles(arbre, { dev: false }), [{ label: 'A', enfants: [{ label: 'a1' }] }]);
  assert.deepEqual(entreesVisibles(arbre), arbre);
  assert.deepEqual(entreesVisibles([{ label: 'A', enfants: [{ label: 'a1' }, { label: 'a2', niveau: 'mj' }] }, { label: 'B', niveau: 'joueur' }], { sansNiveau: true }), [{ label: 'A', enfants: [{ label: 'a1' }] }], 'jusque dans les sous-pages');
  assert.deepEqual(entreesAPlat(arbre).map((e) => e.label), ['A', 'a1', 'a2', 'B']);
  // prodSeulement : filtré seulement quand `prod` est faux (le menu du profil : « Site de dev » n'est que de la production) ; les rubriques ne le passent pas
  const profil = [{ label: 'Prod', prodSeulement: true }, { label: 'Niveau', niveau: 'mj' }, { label: 'Dev', devSeulement: true }];
  assert.deepEqual(entreesVisibles(profil, { prod: false }).map((e) => e.label), ['Niveau', 'Dev']);
  assert.deepEqual(entreesVisibles(profil, { dev: false, prod: true }).map((e) => e.label), ['Prod', 'Niveau']);
  assert.deepEqual(entreesVisibles(profil).map((e) => e.label), ['Prod', 'Niveau', 'Dev'], 'sans option : tout (les rubriques)');
  assert.deepEqual(NAV.flatMap((g) => entreesAPlat(g.items).filter((i) => i.devSeulement).map((i) => `${g.key} ${i.label} ${i.path}`)), ['taverne Debug debug/'], 'la seule entrée du site de dev seulement');
  // le menu (layouts/Base.astro) n'affiche que entreesVisibles, sans les entrées du site de dev en production (SITE_MODE=prod) ni dans la version portable, qui n'a pas non plus
  // les rubriques ni les entrées à niveau (le menu d'un Observateur : pas de service pour lire le niveau)
  const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  assert.match(base, /const dev = !site\.prod && !portable;/);
  assert.match(base, /entreesVisibles\(menuDuSite\(g\.items\), \{ dev, sansNiveau: portable \}\)/);
  assert.match(base, /NAV\.filter\(\(g\) => !\(portable && g\.niveau\)\)/, 'la version portable retire les rubriques à niveau');
  assert.match(base, /data-niveau-menu=\{group\.niveau\} hidden=\{group\.niveau \? true : undefined\}/, 'le bouton d’une rubrique à niveau : data-niveau-menu et hidden');
  const code = base.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /prodSeulement/, 'prodSeulement ne se lit pas dans l’en-tête : le menu du profil (components/MenuDuProfil.astro) le passe à entreesVisibles');
  // la rubrique montrée au départ n'est jamais une rubrique à niveau (le menu d'un Observateur)
  assert.match(code, /const montree = courante && !courante\.niveau \? courante : rubriquesDUnObservateur\[0\];/);
});

test('R319 (4) : les entrées à mot-clé citent un mot-clé qui existe ; les huit entrées au nom de l’arborescence ; les onglets des Règles sont ceux de la table', () => {
  const db = ouvrirBase();
  const toutes = NAV.flatMap((g) => entreesAPlat(g.items));
  for (const e of toutes.filter((x) => x.motCle !== undefined)) {
    assert.ok(Number.isInteger(e.motCle), `${e.label} : l’id entier figé du mot-clé`);
    assert.ok(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(e.motCle), `${e.label} : le mot-clé ${e.motCle}`);
  }
  assert.equal(new Set(toutes.filter((x) => x.motCle !== undefined).map((x) => x.motCle)).size, toutes.filter((x) => x.motCle !== undefined).length, 'un mot-clé par entrée');
  // « Nom de l'arborescence » : huit entrées gardent leur nom (Découvrir, Les races, Les classes, Les métiers, Boucliers, Livres & Parchemins, Mythologie, Factions)
  // et, depuis la réponse du propriétaire (« Nom de l'arborescence » pour « Les magies » et « La fiche de personnage »), dix entrées au total
  assert.deepEqual(toutes.filter((x) => x.libelleArbo).map((x) => x.motCle ?? x.onglet), [44, 298, 223, 66, 240, 'fiche-de-personnage', 49, 198, 185, 349]);
  assert.ok(toutes.filter((x) => x.libelleArbo).every((x) => x.motCle !== undefined || x.onglet !== undefined), 'libelleArbo ne vaut que pour une entrée à mot-clé ou à onglet');
  // les onglets (R184, R319 (5)) : l'entrée de chacun est lue dans la table (titre modifiable), son chemin regles/<id>/ ; ils se partagent entre Le Jeu et les Règles, dans l'ordre de la table
  const onglets = db.prepare('SELECT id FROM regles_onglet ORDER BY ordre, id').all().map((o) => o.id);
  const entrees = toutes.filter((x) => x.onglet);
  assert.deepEqual(entrees.map((x) => x.path), entrees.map((x) => `regles/${x.onglet}/`));
  assert.deepEqual(entrees.map((x) => x.onglet).sort(), [...onglets].sort(), 'un onglet par entrée, aucun oublié ni inventé');
  assert.deepEqual(rubrique('jeu').items.filter((i) => i.onglet).map((i) => i.onglet), ['fiche-de-personnage']);
  assert.deepEqual(rubrique('regles').items.filter((i) => i.onglet).map((i) => i.onglet), onglets.filter((o) => o !== 'fiche-de-personnage'), 'dans l’ordre de la table');
  // le chemin de Découvrir est celui de lib/livres.mjs ; les adresses d'un mot-clé sont lues dans la base à l'affichage (lib/menu-db.mjs), le chemin écrit n'est que le repli
  assert.equal(entreesAPlat(rubrique('jeu').items).find((e) => e.label === 'Découvrir').path, 'decouvrir/');
});

test('chaque lien du menu et du menu du profil pointe vers une page qui existe', () => {
  const pages = new URL('../src/pages/', import.meta.url);
  // les adresses des pages du guide (lib/livres.mjs, par cheminDePage) : /decouvrir/…, /regles/…, /mj/…
  const duGuide = new Set(readdirSync(new URL('guide/', content)).filter((f) => f.endsWith('.md')).map((f) => cheminDePage(`guide/${f.slice(0, -3)}`)));
  // les onglets des Règles (/regles/<onglet>/, servis par pages/regles/[...page].astro d'après la table regles_onglet)
  const onglets = new Set(ouvrirBase().prepare('SELECT id FROM regles_onglet').all().map((o) => `regles/${o.id}/`));
  assert.ok(existsSync(new URL('regles/[...page].astro', pages)));
  const duProfil = entreesAPlat(MENU_DU_PROFIL.flat()).map((e) => e.path).filter(Boolean);
  assert.deepEqual(duProfil, ['profil/', 'personnages/#mes-personnages', 'regles/glossaire/', 'recherche/']);
  for (const path of [...navPaths(), ...duProfil].map((p) => p.split('#')[0])) {
    const m = path.match(/^([^/]+)\/(?:([^/]+)\/)?$/);
    if (duGuide.has(path) || onglets.has(path)) continue;
    if (m && TYPE_KEYS.includes(m[1])) {
      // une page du wiki, ou une page du site sous la rubrique (/ressources/armes/ : src/pages/ressources/armes.astro)
      if (m[2]) assert.ok(existsSync(new URL(`${m[1]}/${m[2]}.md`, content)) || existsSync(new URL(`${m[1]}/${m[2]}.astro`, pages)), `page absente : ${path}`);
    } else {
      const nom = path.replace(/\/$/, '');
      assert.ok(existsSync(new URL(`${nom}.astro`, pages)) || existsSync(new URL(`${nom}/index.astro`, pages)), `page absente : ${path}`);
    }
  }
});

test('la rubrique courante est repérée, avec ou sans préfixe de déploiement ; une seule ; l’entrée du plan et les pages du profil comptent', () => {
  const courante = (chemin, o = {}) => rubriqueCourante(chemin, o.base ?? '/', NAV, o.entree)?.key ?? null;
  assert.equal(groupIsCurrent(rubrique('jeu'), '/races/elfe/'), true);
  assert.equal(groupIsCurrent(rubrique('jeu'), '/MaverickCenter/personnages/', '/MaverickCenter/'), true, 'Personnages prétirés');
  assert.equal(groupIsCurrent(rubrique('jeu'), '/fiche/'), true, 'le générateur n’a pas d’entrée (R319 (6)) mais sa page est du Jeu');
  assert.equal(groupIsCurrent(rubrique('jeu'), '/capacites/clerc-zelote/'), true, 'un don de classe va avec les classes');
  assert.equal(groupIsCurrent(rubrique('ressources'), '/ressources/armes/'), true);
  assert.equal(groupIsCurrent(rubrique('ressources'), '/ressources/composants/'), true, 'Composants');
  assert.equal(groupIsCurrent(rubrique('ressources'), '/ressources/alchimie/'), true, 'une ressource hors menu');
  assert.equal(courante('/ressources/'), 'ressources', 'Autres');
  assert.equal(courante('/ressources/familiers/'), 'jeu', 'Les familiers : son adresse, plus longue que ressources/, ouvre Le Jeu');
  assert.equal(courante('/MaverickCenter/ressources/familiers/', { base: '/MaverickCenter/' }), 'jeu');
  assert.equal(groupIsCurrent(rubrique('ressources'), '/ressources/familiers/'), false, 'une seule rubrique courante');
  assert.equal(courante('/regles/artisanat/'), 'ressources', 'R319 : l’Artisanat est une entrée des Ressources');
  assert.equal(courante('/regles/artisanat/', { entree: 'regles/exploration/' }), 'ressources', 'la page elle-même est une entrée : elle l’emporte sur l’onglet du plan');
  assert.equal(courante('/regles/meteo/'), 'regles', 'une page d’un onglet (adresse à plat)');
  assert.equal(courante('/regles/'), 'regles');
  assert.equal(courante('/regles/combats/'), 'regles', 'un onglet');
  // l'adresse d'une page d'un onglet ne dit pas l'onglet : l'entrée du plan (`entree` de Base.astro) décide, ici l'onglet Fiche de personnage, du Jeu
  assert.equal(courante('/regles/creer-son-personnage/'), 'regles');
  assert.equal(courante('/regles/creer-son-personnage/', { entree: 'regles/fiche-de-personnage/' }), 'jeu');
  assert.equal(courante('/regles/la-magie/', { entree: 'regles/mecaniques-generales/' }), 'regles');
  assert.equal(courante('/decouvrir/l-univers/'), 'jeu', 'une sous-page d’Introduction');
  assert.equal(courante('/mj/guide-pour-mj-maverick/'), 'regles', 'le Guide du MJ est dans les Règles');
  assert.equal(courante('/mise-a-jour/'), 'regles');
  assert.equal(courante('/bestiaire/zombi/'), 'monde');
  assert.equal(courante('/bestiaire/monstres/loup-garou/loup-garou-superieur/'), 'monde', 'la page d’un monstre');
  assert.equal(courante('/lore/'), 'monde');
  assert.equal(courante('/chronologie/grande-croisade/'), 'monde', 'un événement de la chronologie');
  assert.equal(courante('/archives/'), 'taverne');
  assert.equal(courante('/pages/'), 'taverne', 'index du wiki, hors menu');
  assert.equal(courante('/donnees/'), 'taverne');
  assert.equal(courante('/debug/'), 'taverne');
  // les pages du menu du profil et l'accueil ne sont d'aucune rubrique : le menu montré est celui de la première
  for (const chemin of ['/', '/recherche/', '/regles/glossaire/', '/profil/', '/404/']) assert.equal(courante(chemin), null, chemin);
  assert.equal(courante('/regles/une-page-du-glossaire/', { entree: 'regles/glossaire/' }), null, 'une page du glossaire est atteinte par le profil');
  assert.equal(activeGroup('/').key, 'jeu', 'le menu latéral montré par défaut : Le Jeu');
  assert.equal(activeGroup('/recherche/').key, 'jeu');
  assert.equal(activeGroup('/MaverickCenter/', '/MaverickCenter/').key, 'jeu');
  assert.equal(activeGroup('/ressources/alchimie/').key, 'ressources');
  assert.equal(activeGroup('/regles/creer-son-personnage/', '/', NAV, 'regles/fiche-de-personnage/').key, 'jeu');
});

test('R319 (1) : le menu du profil, ses niveaux portés (J, MJ, C, production seulement, tout compte connecté) et l’adresse du site de dev lue du code', () => {
  const blocs = MENU_DU_PROFIL.map((b) => b.map((e) => e.label));
  assert.deepEqual(blocs, [['Mon profil'], ['Mes personnages', 'Mes groupes', 'Mes scénarios'], ['Glossaire', 'Recherche'], ['Site de dev', 'Voir le site en tant que…'], ['Se déconnecter']]);
  const e = (libelle) => entreesAPlat(MENU_DU_PROFIL.flat()).find((x) => x.label === libelle);
  assert.deepEqual([e('Mes personnages').niveau, e('Mes groupes').niveau, e('Mes scénarios').niveau, e('Voir le site en tant que…').niveau], ['joueur', 'joueur', 'mj', 'createur']);
  assert.deepEqual([e('Site de dev').prodSeulement, e('Site de dev').niveau], [true, 'mj']);
  assert.ok(e('Mon profil').connecte && e('Se déconnecter').connecte, 'tout compte connecté, quel que soit son niveau');
  assert.equal(e('Se déconnecter').action, 'deconnexion', 'rendu par le compte');
  assert.equal(e('Voir le site en tant que…').action, 'voir-en-tant-que', 'un choix de niveau, rendu par lib/menu-rendu.mjs, montré au niveau réel Créateur');
  for (const x of entreesAPlat(MENU_DU_PROFIL.flat())) assert.ok(x.niveau === undefined || NIVEAUX_DU_MENU.includes(x.niveau), x.label);
  // « Mes personnages » : la section de /personnages/ (R318, étape E8), son niveau appliqué par le navigateur (lot 4) ; les autres : pas de page encore, « bientôt » ; Glossaire et Recherche : des pages (pas d'une rubrique)
  assert.equal(e('Mes personnages').path, 'personnages/#mes-personnages');
  assert.deepEqual(['Mes groupes', 'Mes scénarios', 'Voir le site en tant que…'].filter((l) => e(l).path), []);
  assert.deepEqual([e('Glossaire').path, e('Recherche').path, e('Mon profil').path], ['regles/glossaire/', 'recherche/', 'profil/']);
  // l'adresse du site de dev : celle que le code connaît déjà (scripts/db-extrait.mjs), nav.mjs n'important rien
  assert.equal(e('Site de dev').externe, ADRESSE_DU_SITE_DE_DEV);
  assert.equal(ADRESSE_DU_SITE_DE_DEV, `${ADRESSE_DE_L_EXTRAIT}/`);
  assert.ok(!navPaths().some((p) => ['profil/', 'recherche/', 'regles/glossaire/'].includes(p)), 'le menu du profil n’est pas une rubrique');
  assert.equal(rubriqueCourante('/personnages/')?.key, 'jeu', 'la page /personnages/ reste du Jeu (Personnages prétirés) : l’entrée du profil porte une ancre');
});

test('les pages ne sont plus sous /wiki/ : une ancienne adresse mène à la nouvelle (page 404)', () => {
  assert.equal(legacyWikiRedirect('/wiki/races/nain/'), '/races/nain/');
  assert.equal(legacyWikiRedirect('/wiki/magies/'), '/magies/');
  assert.equal(legacyWikiRedirect('/wiki/'), '/pages/', 'l’index du wiki');
  assert.equal(legacyWikiRedirect('/wiki'), '/pages/');
  // jamais hors du site : « /wiki//autre.site/ » ne devient pas « //autre.site/ » (adresse d'un autre site)
  assert.equal(legacyWikiRedirect('/wiki//evil.example/'), '/evil.example/');
  assert.equal(legacyWikiRedirect('/wiki///evil.example/x/', '/MaverickCenter/'), null, 'hors du sous-chemin : rien');
  assert.equal(legacyWikiRedirect('/MaverickCenter/wiki//evil.example/', '/MaverickCenter/'), '/MaverickCenter/evil.example/');
  for (const chemin of ['/wiki//evil.example/', '/wiki////evil.example', '/tags//evil.example/', '/tags/%2F%2Fevil.example/']) {
    const cible = nouvelleAdresse(chemin);
    if (cible) assert.equal(new URL(adresseComplete(cible, '?q=1', '#h'), 'https://maverick-jdr.com/x/').origin, 'https://maverick-jdr.com', chemin);
  }
  assert.equal(legacyWikiRedirect('/MaverickCenter/wiki/races/nain/', '/MaverickCenter/'), '/MaverickCenter/races/nain/');
  assert.equal(legacyWikiRedirect('/MaverickCenter/wiki/', '/MaverickCenter'), '/MaverickCenter/pages/');
  assert.equal(legacyWikiRedirect('/races/inconnue/'), null, 'une vraie page absente reste introuvable');
  assert.equal(legacyWikiRedirect('/wikipedia/'), null);
  assert.equal(legacyWikiRedirect('/autre/wiki/races/', '/MaverickCenter/'), null, 'hors du préfixe de déploiement');
});

test('/generateur/ est devenu /fiche/ : l’ancienne adresse mène à la nouvelle (page 404), les adresses du wiki aussi', () => {
  assert.equal(nouvelleAdresse('/generateur/'), '/fiche/');
  assert.equal(nouvelleAdresse('/generateur'), '/fiche/');
  assert.equal(nouvelleAdresse('/MaverickCenter/generateur/', '/MaverickCenter/'), '/MaverickCenter/fiche/');
  assert.equal(nouvelleAdresse('/wiki/races/nain/'), '/races/nain/');
  assert.equal(nouvelleAdresse('/generateurs/'), null);
  assert.equal(nouvelleAdresse('/tags/'), '/recherche/', 'la liste des mots-clés est dans la recherche');
  assert.equal(nouvelleAdresse('/races/inconnue/'), null);
  assert.equal(nouvelleAdresse('/autre/generateur/', '/MaverickCenter/'), null);
});

test('« Bâton magique » est le sous-onglet Bâtons magiques de la page Ceinture : l’ancienne adresse y mène, la requête avant l’ancre, jamais deux « # » ; Armes, Armures, Bouclier, Accessoires ont retrouvé leur adresse (2026-10-29)', () => {
  assert.equal(nouvelleAdresse('/ressources/baton-magique/'), '/ressources/objets-a-la-ceinture/#batons-magiques');
  for (const c of ['armes', 'armures', 'bouclier', 'accessoires', 'objets-a-la-ceinture']) assert.equal(nouvelleAdresse(`/ressources/${c}/`), null, `${c} : une vraie page`);
  assert.equal(nouvelleAdresse('/guide/statistiques-resistance-faiblesse/'), '/magies/', 'page retirée par la migration 0049 (R86)');
  assert.equal(nouvelleAdresse('/guide/statistiques-resistance-faiblesse/', '/', { 'guide/statistiques-resistance-faiblesse/': 'regles/x/' }), '/magies/', 'PAGES_RENOMMEES l’emporte sur les renvois');
  assert.equal(nouvelleAdresse('/guide/les-postures/', '/', { 'guide/les-postures/': 'regles/les-postures/' }), '/regles/les-postures/', 'les renvois du build (page 404)');
  assert.equal(nouvelleAdresse('/MaverickCenter/guide/', '/MaverickCenter/', { 'guide/': 'decouvrir/' }), '/MaverickCenter/decouvrir/');
  assert.equal(nouvelleAdresse('/guide/x/', '/', { toString: 'regles/' }), null, 'seules les clés propres des renvois');
  assert.equal(nouvelleAdresse('/wiki/ressources/baton-magique/'), '/ressources/objets-a-la-ceinture/#batons-magiques', 'une ancienne adresse du wiki : un seul saut');
  assert.equal(nouvelleAdresse('/wiki/generateur/'), '/fiche/');
  assert.equal(nouvelleAdresse('/MaverickCenter/ressources/baton-magique', '/MaverickCenter/'), '/MaverickCenter/ressources/objets-a-la-ceinture/#batons-magiques');
  assert.equal(adresseComplete('/ressources/objets-a-la-ceinture/#batons-magiques', '?x=1', ''), '/ressources/objets-a-la-ceinture/?x=1#batons-magiques');
  assert.equal(adresseComplete('/ressources/objets-a-la-ceinture/#batons-magiques', '', '#baton-magie-du-feu'), '/ressources/objets-a-la-ceinture/#baton-magie-du-feu', 'l’ancre d’origine l’emporte');
  assert.equal(adresseComplete('/recherche/?mot-cle=feu', '?q=1', '#h'), '/recherche/?mot-cle=feu&q=1#h');
});

test('pages éclatées (2026-10-29) : l’ancienne page « Équipement » mène à la page de son ancre, sinon de sa requête, sinon Armes ; « Pièces élémentaires » à sa section de Armes ou Armures', () => {
  const E = RENVOIS_DES_PAGES_ECLATEES;
  const renvoi = (chemin, o = {}) => adresseDeRenvoi(chemin, { eclatees: E, ...o });
  // l'ancien onglet : la page, sans ancre ; un élément d'un onglet : sa page, l'ancre gardée
  assert.equal(renvoi('/ressources/equipement/'), '/ressources/armes/', 'l’onglet ouvert au départ');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#boucliers' }), '/ressources/bouclier/');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#onglet-ceinture' }), '/ressources/objets-a-la-ceinture/');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#famille-bombes' }), '/ressources/armes/#famille-bombes');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#arme-elementaire-arc-sang' }), '/ressources/armes/#arme-elementaire-arc-sang');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#ameliorations-arme' }), '/ressources/armes/#ameliorations-arme');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#ameliorations-armure-elementaire' }), '/ressources/armures/#ameliorations-armure-elementaire', 'le plus long début');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#ameliorations-bouclier' }), '/ressources/bouclier/#ameliorations-bouclier');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#batons-magiques' }), '/ressources/objets-a-la-ceinture/#batons-magiques');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#ceinture-consommables' }), '/ressources/objets-a-la-ceinture/#ceinture-consommables');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#objets-huile' }), '/ressources/objets-a-la-ceinture/#objets-huile');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#effets-competence' }), '/ressources/accessoires/#effets-competence');
  // la requête gardée, avant l'ancre ; sans ancre reconnue, son premier paramètre dit la page
  assert.equal(renvoi('/ressources/equipement/', { search: '?arme=arme-epees-espadon', hash: '#armes' }), '/ressources/armes/?arme=arme-epees-espadon');
  assert.equal(renvoi('/ressources/equipement/', { search: '?forme=ecu', hash: '#bouclier-ecu-fer' }), '/ressources/bouclier/?forme=ecu#bouclier-ecu-fer');
  assert.equal(renvoi('/ressources/equipement/', { search: '?forme=ecu&matiere=fer' }), '/ressources/bouclier/?forme=ecu&matiere=fer');
  assert.equal(renvoi('/ressources/equipement/', { search: '?materiau1=fer&materiau2=cuir' }), '/ressources/armures/?materiau1=fer&materiau2=cuir');
  assert.equal(renvoi('/ressources/equipement/', { search: '?emplacement=collier&maudit=1' }), '/ressources/accessoires/?emplacement=collier&maudit=1');
  assert.equal(renvoi('/ressources/equipement/', { hash: '#inconnue' }), '/ressources/armes/#inconnue', 'une ancre inconnue : Armes, l’ancre gardée');
  assert.equal(renvoi('/ressources/equipement', { hash: '#armures' }), '/ressources/armures/', 'sans « / » final');
  assert.equal(renvoi('/MaverickCenter/ressources/equipement/', { base: '/MaverickCenter/', hash: '#accessoires' }), '/MaverickCenter/ressources/accessoires/');
  assert.equal(renvoi('/wiki/ressources/equipement/', { hash: '#armures' }), '/ressources/armures/', 'une ancienne adresse du wiki : un seul saut');
  // « Pièces élémentaires » : ses anciennes ancres (ses titres, encodés dans l'adresse) mènent à leur place ; le reste, à sa section de la page Armes
  assert.equal(renvoi('/ressources/pieces-elementaires/'), '/ressources/armes/#pieces-elementaires');
  assert.equal(renvoi('/ressources/pieces-elementaires/', { hash: '#%C3%A9p%C3%A9e' }), '/ressources/armes/#famille-epees');
  assert.equal(renvoi('/ressources/pieces-elementaires/', { hash: '#bombe' }), '/ressources/armes/#famille-bombes');
  assert.equal(renvoi('/ressources/pieces-elementaires/', { hash: '#armure' }), '/ressources/armures/#ameliorations-armure-elementaire');
  assert.equal(renvoi('/ressources/pieces-elementaires/', { hash: '#armure-l%C3%A9g%C3%A8re' }), '/ressources/armures/#pieces-elementaires');
  assert.equal(renvoi('/ressources/pieces-elementaires/', { hash: '#inconnue' }), '/ressources/armes/#pieces-elementaires', 'une ancre qui n’existe plus');
  // les autres renvois passent toujours (nouvelleAdresse, adresseComplete), jamais hors du site
  assert.equal(renvoi('/ressources/baton-magique/', { hash: '#baton-magie-du-feu' }), '/ressources/objets-a-la-ceinture/#baton-magie-du-feu');
  assert.equal(renvoi('/generateur/', { search: '?id=3' }), '/fiche/?id=3');
  assert.equal(renvoi('/races/inconnue/'), null);
  assert.equal(adresseEclatee('ressources/armes/', E), null, 'une vraie page n’est pas éclatée');
  assert.equal(adresseEclatee('ressources/equipement/', {}), null, 'sans renvois');
  for (const [chemin, o] of [['/ressources/equipement/', { hash: '#//evil.example' }], ['/ressources/equipement/', { search: '?arme=//evil.example' }]]) {
    assert.equal(new URL(renvoi(chemin, o), 'https://maverick-jdr.com/x/').origin, 'https://maverick-jdr.com', `${chemin} ${JSON.stringify(o)}`);
  }
  // un lien Markdown écrit vers elles (le guide : lib/guide-rendu.ts), sans page 404 (version portable)
  assert.equal(cheminVersUnePageEclatee('ressources/equipement/#armes', E), 'ressources/armes/');
  assert.equal(cheminVersUnePageEclatee('ressources/equipement/', E), 'ressources/armes/');
  assert.equal(cheminVersUnePageEclatee('ressources/equipement/#batons-magiques', E), 'ressources/objets-a-la-ceinture/#batons-magiques');
  assert.equal(cheminVersUnePageEclatee('ressources/equipement/?forme=ecu#boucliers', E), 'ressources/bouclier/?forme=ecu');
  assert.equal(cheminVersUnePageEclatee('ressources/equipement/?arme=x#famille-epees', E), 'ressources/armes/?arme=x#famille-epees', 'la requête avant l’ancre');
  assert.equal(cheminVersUnePageEclatee('ressources/composants/#materiaux', E), 'ressources/composants/#materiaux', 'une autre page : telle quelle');
});

test('/tags/<clé>/ n’existe plus : la page 404 mène aux éléments du mot-clé dans la recherche (son id = l’ancienne clé), la requête fusionnée', () => {
  assert.equal(PARAMETRE_MOT_CLE, 'mot-cle', 'le paramètre que lit la page Recherche (nav.mjs ne l’importe pas : la page 404 n’emporte que lui)');
  assert.equal(nouvelleAdresse('/tags/feu/'), '/recherche/?mot-cle=feu');
  assert.equal(nouvelleAdresse('/tags/magie-du-feu'), '/recherche/?mot-cle=magie-du-feu');
  assert.equal(nouvelleAdresse('/MaverickCenter/tags/feu/', '/MaverickCenter/'), '/MaverickCenter/recherche/?mot-cle=feu');
  assert.equal(nouvelleAdresse('/tags/feu/autre/'), null);
  assert.ok(!NAV.flatMap((g) => g.autres ?? []).includes('tags/'), 'plus de pages /tags/ dans le menu');
  // la page 404 ajoute la requête et l'ancre d'origine : jamais deux « ? »
  assert.equal(adresseComplete('/recherche/?mot-cle=feu', '', ''), '/recherche/?mot-cle=feu');
  assert.equal(adresseComplete('/recherche/?mot-cle=feu', '?q=elfe', '#x'), '/recherche/?mot-cle=feu&q=elfe#x');
  assert.equal(adresseComplete('/recherche/?mot-cle=feu', '?mot-cle=glace'), '/recherche/?mot-cle=feu', 'le mot-clé de l’adresse l’emporte');
  assert.equal(adresseComplete('/fiche/', '?id=12', '#notes'), '/fiche/?id=12#notes');
  assert.equal(adresseComplete('/races/nain/', '', ''), '/races/nain/');
});
