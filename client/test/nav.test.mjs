import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { NAV, activeGroup, adresseComplete, groupIsCurrent, legacyWikiRedirect, navPaths, nouvelleAdresse } from '../src/lib/nav.mjs';
import { PARAMETRE_MOT_CLE } from '../src/lib/recherche-mots-cles.mjs';
import { TYPE_KEYS } from '../src/lib/types.mjs';

const content = new URL('../src/content/wiki/', import.meta.url);

test('le menu a les rubriques et les entrées voulues par le propriétaire, dans l’ordre', () => {
  const plan = NAV.map((g) => `${g.label} : ${g.items.map((i) => (i.path ? i.label : `${i.label} (bientôt)`)).join(', ')}`);
  assert.deepEqual(plan, [
    'Règles : Guide, Races, Magies, Classes, Métiers',
    'Ressources : Armes, Armures, Accessoires, Composants, Objets à la ceinture (bientôt), Livres & Parchemins, Pièces élémentaires',
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
      // une page du wiki, ou une page du site sous la rubrique (/ressources/composants/ : src/pages/ressources/composants.astro)
      if (m[2]) assert.ok(existsSync(new URL(`${m[1]}/${m[2]}.md`, content)) || existsSync(new URL(`${m[1]}/${m[2]}.astro`, pages)), `page absente : ${path}`);
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
  assert.equal(activeGroup('/donnees/').key, 'outils');
  assert.equal(activeGroup('/').key, 'regles');
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
