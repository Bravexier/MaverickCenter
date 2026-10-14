import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { NAV, activeGroup, groupIsCurrent, legacyWikiRedirect, navPaths, nouvelleAdresse } from '../src/lib/nav.mjs';
import { TYPE_KEYS } from '../src/lib/types.mjs';

const content = new URL('../src/content/wiki/', import.meta.url);

test('le menu a les rubriques et les entrées voulues par le propriétaire, dans l’ordre', () => {
  const plan = NAV.map((g) => `${g.label} : ${g.items.map((i) => (i.path ? i.label : `${i.label} (bientôt)`)).join(', ')}`);
  assert.deepEqual(plan, [
    'Règles : Guide, Races, Magies, Classes, Métiers',
    'Ressources : Armes, Armures, Accessoires, Objets à la ceinture (bientôt), Livres & Parchemins, Pièces élémentaires',
    'Personnages : Fiche de personnage, Listes, Groupes (bientôt), Chroniques (bientôt)',
    'Codex : Chronologie, Carte & lieux (bientôt), Mythologie, Bestiaire, Factions',
    'Outils : Statistiques (bientôt), Mise à jour, Boîte à idée (bientôt), Galeries, Recherche, Archives',
  ]);
  assert.deepEqual(NAV.find((g) => g.key === 'personnages').items.filter((i) => i.path).map((i) => i.path), ['fiche/', 'personnages/'], 'la fiche, puis la liste des personnages');
});

test('chaque lien du menu pointe vers une page qui existe', () => {
  const pages = new URL('../src/pages/', import.meta.url);
  for (const path of navPaths()) {
    const m = path.match(/^([^/]+)\/(?:([^/]+)\/)?$/);
    if (m && TYPE_KEYS.includes(m[1])) {
      if (m[2]) assert.ok(existsSync(new URL(`${m[1]}/${m[2]}.md`, content)), `page absente : ${path}`);
    } else {
      const nom = path.replace(/\/$/, '');
      assert.ok(existsSync(new URL(`${nom}.astro`, pages)) || existsSync(new URL(`${nom}/index.astro`, pages)), `page absente : ${path}`);
    }
  }
});

test('la rubrique courante est repérée, avec ou sans préfixe de déploiement', () => {
  const rubrique = (cle) => NAV.find((g) => g.key === cle);
  assert.equal(groupIsCurrent(rubrique('regles'), '/races/elfe/'), true);
  assert.equal(groupIsCurrent(rubrique('personnages'), '/MaverickCenter/fiche/', '/MaverickCenter/'), true);
  assert.equal(groupIsCurrent(rubrique('personnages'), '/personnages/'), true);
  assert.equal(groupIsCurrent(rubrique('regles'), '/fiche/'), false, 'la fiche a quitté les Règles');
  assert.equal(groupIsCurrent(rubrique('ressources'), '/ressources/armures/'), true);
  assert.equal(groupIsCurrent(rubrique('ressources'), '/races/'), false);
  assert.equal(groupIsCurrent(rubrique('outils'), '/archives/'), true);
  assert.equal(groupIsCurrent(rubrique('outils'), '/pages/'), true, 'index du wiki, hors menu');
});

test('la 2e ligne suit la rubrique de la page, même hors menu ; la première par défaut', () => {
  assert.equal(activeGroup('/ressources/alchimie/').key, 'ressources', 'une ressource hors menu ouvre les Ressources');
  assert.equal(activeGroup('/ressources/bouclier/').key, 'ressources');
  assert.equal(activeGroup('/bestiaire/zombi/').key, 'codex');
  assert.equal(activeGroup('/bestiaire/monstres/loup-garou/loup-garou-superieur/').key, 'codex', 'la page d’un monstre ouvre le Codex');
  assert.equal(activeGroup('/lore/').key, 'codex');
  assert.equal(activeGroup('/chronologie/grande-croisade/').key, 'codex', 'un événement de la chronologie ouvre le Codex');
  assert.equal(activeGroup('/capacites/clerc-zelote/').key, 'regles', 'un don de classe va avec les classes');
  assert.equal(activeGroup('/recherche/').key, 'outils');
  assert.equal(activeGroup('/tags/feu/').key, 'outils');
  assert.equal(activeGroup('/donnees/').key, 'outils');
  assert.equal(activeGroup('/').key, 'regles');
});

test('les pages ne sont plus sous /wiki/ : une ancienne adresse mène à la nouvelle (page 404)', () => {
  assert.equal(legacyWikiRedirect('/wiki/races/nain/'), '/races/nain/');
  assert.equal(legacyWikiRedirect('/wiki/magies/'), '/magies/');
  assert.equal(legacyWikiRedirect('/wiki/'), '/pages/', 'l’index du wiki');
  assert.equal(legacyWikiRedirect('/wiki'), '/pages/');
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
  assert.equal(nouvelleAdresse('/tags/feu/'), null, 'la page d’un mot-clé existe toujours');
  assert.equal(nouvelleAdresse('/races/inconnue/'), null);
  assert.equal(nouvelleAdresse('/autre/generateur/', '/MaverickCenter/'), null);
});
