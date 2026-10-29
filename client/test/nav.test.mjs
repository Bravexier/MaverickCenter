import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  NAV, activeGroup, adresseComplete, adresseDeRenvoi, adresseEclatee, cheminVersUnePageEclatee, entreesDuMenu, groupIsCurrent, legacyWikiRedirect, navPaths,
  nouvelleAdresse,
} from '../src/lib/nav.mjs';
import { RENVOIS_DES_PAGES_ECLATEES } from '../src/lib/equipement.mjs';
import { PARAMETRE_MOT_CLE } from '../src/lib/recherche-mots-cles.mjs';
import { TYPE_KEYS } from '../src/lib/types.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const content = new URL('../src/content/wiki/', import.meta.url);

test('le menu a les rubriques et les entrées voulues par le propriétaire, dans l’ordre (2026-10-29 : sept rubriques, rien de caché)', () => {
  const plan = NAV.map((g) => `${g.label} : ${g.items.map((i) => (i.path ? i.label : `${i.label} (bientôt)`) + (i.devSeulement ? ' (site de dev)' : '')).join(', ')}`);
  assert.deepEqual(plan, [
    // « Le menu "Découvrir" sera renommé "Règles", le sous-menu "Bienvenue" sera renommé "Découvrir" » ; « Les bases » et « Règles avancées » y vont
    'Règles : Découvrir, L’univers, Créer son personnage, Rejoindre une partie, Les bases, Règles avancées',
    // « renommer le menu "Règles" en "Personnage" » ; « Famillier devrai être dans Personnage » (sic, réponse du 2026-10-29)
    'Personnage : Races, Magies, Classes, Métiers, Familiers',
    // « Entre le nouvellement créé "Personnage" et "Espace Joueur" il faudra un nouveau menu : "Equipement" » : cinq pages séparées, libellés « Comme
    // les onglets (pluriel) », puis Artisanat et Livres & Parchemins ; plus d'entrée Pièces élémentaires ; « Le reste dans equipement (sous
    // menu-autres pour commencer) » (réponse du 2026-10-29) : Autres, en dernier
    'Équipement : Armes, Armures, Boucliers, Ceinture, Accessoires, Artisanat, Livres & Parchemins, Autres',
    'Espace joueur : Fiche de personnage, Personnages, Groupes d’aventures (bientôt), Table de jeu (bientôt), Chroniques (bientôt)',
    'Espace MJ : Guide du MJ, Fiches de PNJ et scénarios (bientôt), Groupes de jeu (bientôt)',
    'Codex : Chronologie, Carte & lieux (bientôt), Mythologie, Bestiaire, Factions',
    'Outils : Statistiques (bientôt), Mise à jour, Boîte à idée (bientôt), Galeries, Recherche, Archives, Debug (site de dev)',
  ]);
  assert.deepEqual(NAV.map((g) => g.key), ['regles', 'personnage', 'equipement', 'joueur', 'mj', 'codex', 'outils']);
  assert.deepEqual(NAV.find((g) => g.key === 'joueur').items.filter((i) => i.path).map((i) => i.path), ['fiche/', 'personnages/'], 'la fiche, puis la liste des personnages');
  assert.deepEqual(NAV.find((g) => g.key === 'regles').items.map((i) => i.path), [
    'decouvrir/', 'decouvrir/l-univers/', 'decouvrir/creer-son-personnage/', 'decouvrir/rejoindre-une-partie/', 'regles/', 'regles/avancees/',
  ]);
  assert.deepEqual(NAV.find((g) => g.key === 'personnage').items.map((i) => i.path), ['races/', 'magies/', 'classes/', 'metiers/', 'ressources/familiers/']);
  assert.deepEqual(NAV.find((g) => g.key === 'equipement').items.map((i) => i.path), [
    'ressources/armes/', 'ressources/armures/', 'ressources/bouclier/', 'ressources/objets-a-la-ceinture/', 'ressources/accessoires/',
    'regles/artisanat/', 'ressources/livre-parchemin/', 'ressources/',
  ], 'les adresses d’avant la page « Équipement » (identifiants figés), puis la liste des pages de ressources (Autres)');
  assert.ok(!navPaths().some((p) => p.includes('#') || p.startsWith('ressources/equipement')), 'plus d’entrée vers l’ancienne page « Équipement » ni ses onglets');
  assert.ok(!navPaths().includes('ressources/pieces-elementaires/'), 'plus d’entrée Pièces élémentaires (2026-10-29)');
  assert.ok(!navPaths().includes('guide/') && !navPaths().includes('ressources/composants/'), 'plus d’entrée Guide ; Composants est sous Artisanat');
  assert.ok(NAV.every((g) => g.items.every((i) => Object.keys(i).every((k) => ['label', 'path', 'devSeulement'].includes(k)))), 'aucun drapeau de visibilité : rien n’est caché');
  // l'entrée Familiers porte le titre de sa page dans la base
  const familiers = NAV.find((g) => g.key === 'personnage').items.find((i) => i.path === 'ressources/familiers/');
  assert.equal(familiers?.label, ouvrirBase().prepare('SELECT titre FROM page WHERE id = ?').get('ressources/familiers')?.titre, 'Familiers : le titre de sa page');
});

test('chaque lien du menu pointe vers une page qui existe', () => {
  const pages = new URL('../src/pages/', import.meta.url);
  // les adresses des pages du guide (lib/livres.mjs, par cheminDePage) : /decouvrir/…, /regles/…, /mj/…
  const duGuide = new Set(readdirSync(new URL('guide/', content)).filter((f) => f.endsWith('.md')).map((f) => cheminDePage(`guide/${f.slice(0, -3)}`)));
  for (const path of navPaths().map((p) => p.split('#')[0])) {
    const m = path.match(/^([^/]+)\/(?:([^/]+)\/)?$/);
    if (duGuide.has(path)) continue;
    if (m && TYPE_KEYS.includes(m[1])) {
      // une page du wiki, ou une page du site sous la rubrique (/ressources/armes/ : src/pages/ressources/armes.astro)
      if (m[2]) assert.ok(existsSync(new URL(`${m[1]}/${m[2]}.md`, content)) || existsSync(new URL(`${m[1]}/${m[2]}.astro`, pages)), `page absente : ${path}`);
    } else {
      const nom = path.replace(/\/$/, '');
      assert.ok(existsSync(new URL(`${nom}.astro`, pages)) || existsSync(new URL(`${nom}/index.astro`, pages)), `page absente : ${path}`);
    }
  }
});

test('la rubrique courante est repérée, avec ou sans préfixe de déploiement', () => {
  const rubrique = (cle) => NAV.find((g) => g.key === cle);
  assert.equal(groupIsCurrent(rubrique('personnage'), '/races/elfe/'), true);
  assert.equal(groupIsCurrent(rubrique('joueur'), '/MaverickCenter/fiche/', '/MaverickCenter/'), true);
  assert.equal(groupIsCurrent(rubrique('joueur'), '/personnages/'), true);
  assert.equal(groupIsCurrent(rubrique('personnage'), '/fiche/'), false, 'la fiche est dans l’Espace joueur');
  assert.equal(groupIsCurrent(rubrique('equipement'), '/ressources/armes/'), true, 'une page de l’équipement');
  assert.equal(groupIsCurrent(rubrique('equipement'), '/ressources/objets-a-la-ceinture/'), true, 'la Ceinture');
  assert.equal(groupIsCurrent(rubrique('equipement'), '/ressources/composants/'), true, 'Composants, sous Artisanat');
  assert.equal(groupIsCurrent(rubrique('personnage'), '/ressources/familiers/'), true, 'Familiers, au Personnage');
  assert.equal(groupIsCurrent(rubrique('equipement'), '/ressources/familiers/'), false, 'une seule rubrique courante');
  assert.equal(groupIsCurrent(rubrique('regles'), '/races/'), false);
  // le plus long début l'emporte : /regles/artisanat/ est à l'Équipement, pas aux Règles de /regles/ (une seule rubrique courante)
  assert.equal(groupIsCurrent(rubrique('equipement'), '/regles/artisanat/'), true);
  assert.equal(groupIsCurrent(rubrique('regles'), '/regles/artisanat/'), false);
  assert.equal(groupIsCurrent(rubrique('regles'), '/regles/la-magie/'), true, 'une page des Bases');
  assert.equal(groupIsCurrent(rubrique('outils'), '/archives/'), true);
  assert.equal(groupIsCurrent(rubrique('outils'), '/pages/'), true, 'index du wiki, hors menu');
  assert.equal(groupIsCurrent(rubrique('mj'), '/MaverickCenter/mj/un-maitre-du-jeu/', '/MaverickCenter/'), true);
});

test('la 2e ligne suit la rubrique de la page, même hors menu ; la première (Règles) par défaut', () => {
  assert.equal(activeGroup('/ressources/alchimie/').key, 'equipement', 'une ressource hors menu ouvre l’Équipement');
  assert.equal(activeGroup('/ressources/maladie/').key, 'equipement', 'hors menu, en attendant d’être rangée');
  assert.equal(activeGroup('/ressources/').key, 'equipement', 'la liste des pages de ressources : Autres');
  // « Famillier devrai être dans Personnage » : son entrée, plus longue que `ressources/` de l'Équipement, l'emporte
  assert.equal(activeGroup('/ressources/familiers/').key, 'personnage', 'Familiers ouvre le Personnage, pas l’Équipement');
  assert.equal(activeGroup('/MaverickCenter/ressources/familiers/', '/MaverickCenter/').key, 'personnage');
  assert.equal(activeGroup('/ressources/bouclier/').key, 'equipement');
  assert.equal(activeGroup('/ressources/pieces-elementaires/').key, 'equipement', 'hors menu depuis le 2026-10-29');
  assert.equal(activeGroup('/MaverickCenter/ressources/accessoires/', '/MaverickCenter/').key, 'equipement');
  assert.equal(activeGroup('/regles/avancees/meteo/').key, 'regles');
  assert.equal(activeGroup('/regles/artisanat/').key, 'equipement', 'Artisanat, à l’Équipement malgré /regles/');
  assert.equal(activeGroup('/decouvrir/l-univers/').key, 'regles');
  assert.equal(activeGroup('/decouvrir/rejoindre-une-partie/').key, 'regles');
  assert.equal(activeGroup('/regles/').key, 'regles', 'le sommaire des Bases');
  assert.equal(activeGroup('/mj/').key, 'mj');
  assert.equal(activeGroup('/mj/guide-pour-mj-maverick/').key, 'mj');
  assert.equal(activeGroup('/fiche/').key, 'joueur');
  assert.equal(activeGroup('/bestiaire/zombi/').key, 'codex');
  assert.equal(activeGroup('/bestiaire/monstres/loup-garou/loup-garou-superieur/').key, 'codex', 'la page d’un monstre ouvre le Codex');
  assert.equal(activeGroup('/lore/').key, 'codex');
  assert.equal(activeGroup('/chronologie/grande-croisade/').key, 'codex', 'un événement de la chronologie ouvre le Codex');
  assert.equal(activeGroup('/capacites/clerc-zelote/').key, 'personnage', 'un don de classe va avec les classes');
  assert.equal(activeGroup('/races/elfe/').key, 'personnage');
  assert.equal(activeGroup('/recherche/').key, 'outils');
  assert.equal(activeGroup('/donnees/').key, 'outils');
  assert.equal(activeGroup('/').key, 'regles');
  assert.equal(activeGroup('/MaverickCenter/', '/MaverickCenter/').key, 'regles');
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

test('la page Debug n’est au menu que sur le site de dev (demande du propriétaire : « visible uniquement sur le serveur dev »)', () => {
  const outils = NAV.find((g) => g.key === 'outils');
  assert.deepEqual(NAV.flatMap((g) => g.items.filter((i) => i.devSeulement).map((i) => `${g.key} ${i.label} ${i.path}`)), ['outils Debug debug/'],
    'la seule entrée du site de dev seulement');
  assert.deepEqual(entreesDuMenu(outils).map((i) => i.label), ['Statistiques', 'Mise à jour', 'Boîte à idée', 'Galeries', 'Recherche', 'Archives', 'Debug']);
  assert.deepEqual(entreesDuMenu(outils, { dev: false }).map((i) => i.label), ['Statistiques', 'Mise à jour', 'Boîte à idée', 'Galeries', 'Recherche', 'Archives'],
    'production et version portable : sans Debug');
  for (const g of NAV.filter((x) => x.key !== 'outils')) assert.deepEqual(entreesDuMenu(g, { dev: false }), g.items, g.key);
  assert.equal(activeGroup('/debug/').key, 'outils');
  // le menu (layouts/Base.astro) n'affiche que entreesDuMenu, sans les entrées du site de dev en production (SITE_MODE=prod) ni dans la version portable
  const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  assert.match(base, /const dev = !site\.prod && !portable;/);
  assert.match(base, /entreesDuMenu\(group, \{ dev \}\)\.map\(\(item\) =>/);
  assert.doesNotMatch(base, /group\.items\.map\(/, 'jamais toutes les entrées');
});
