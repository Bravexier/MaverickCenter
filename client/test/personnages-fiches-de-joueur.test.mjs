// R318 (étape E8) : les fiches de joueur rangées à un compte, côté page /personnages/ (lib/personnages-liste.mjs, scripts/personnages.mjs). « Visible par »
// (Tous / MJ, option accessible que pour les MJ / Privé), « Ranger au compte » du Créateur, sections « Mes personnages », prétirés et fiches des autres joueurs.
// Le service est testé à part (test/serveur-fiches-de-joueur.test.mjs) ; ici, la logique pure de la page : aucun libellé de menu n'est lu depuis une base, et
// les messages ne sont épinglés que par leur fonctionnement (distincts, non vides, dire que rien n'a changé), jamais par leur prose.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LIBELLES_DES_NIVEAUX } from '../src/lib/compte.mjs';
import {
  LIBELLES_DE_NIVEAU, VISIBILITES, comptesRangeables, filtrer, messageDEchec, niveauDeLaSession, optionsDeVisibilite, peutRanger, peutRegler, sectionsDeLaListe, trier,
} from '../src/lib/personnages-liste.mjs';

const moi = (niveau, surcharge = {}) => ({ connexion_disponible: true, connecte: true, utilisateur: { nom: 'X', niveau }, ...surcharge });
const pretire = (id, surcharge = {}) => ({ id, nom: id, nature: 'pretire', proprietaire: null, visibilite: 'tous', a_moi: false, niveau_global: 1, xp: 0, classes: [], ...surcharge });
const joueur = (id, surcharge = {}) => ({ id, nom: id, nature: 'joueur', proprietaire: { id: 'u-autre', nom_affichage: 'Autre' }, visibilite: 'tous', a_moi: false, niveau_global: 1, xp: 0, classes: [], ...surcharge });
const valeurs = (options) => options.map((o) => o.valeur);

test('R318 : le niveau de la session vient de GET /api/moi/, null sans session lisible', () => {
  for (const niveau of ['observateur', 'joueur', 'mj', 'createur']) assert.equal(niveauDeLaSession(moi(niveau)), niveau);
  assert.equal(niveauDeLaSession(null), null, 'le service ne répond pas');
  assert.equal(niveauDeLaSession(moi('joueur', { connecte: false })), null, 'déconnecté');
  assert.equal(niveauDeLaSession({ connexion_disponible: true, connecte: false, non_membre: true }), null, 'non-membre');
  assert.equal(niveauDeLaSession(moi('roi')), null, 'niveau inconnu');
  assert.equal(niveauDeLaSession(moi(undefined)), null);
});

test('R318 (2) : les trois visibilités et leurs libellés exacts, dans l’ordre du propriétaire', () => {
  assert.deepEqual(VISIBILITES.map((v) => v.valeur), ['tous', 'mj', 'privee']);
  assert.deepEqual(VISIBILITES.map((v) => v.libelle), ['Tous (Joueurs et +)', 'MJ (MJ et Créateur)', 'Privé (Utilisateur et Créateur)']);
});

test('R318 : le menu « Visible par » n’est réglé que sur une fiche de joueur, par son propriétaire ou un Créateur', () => {
  const aMoi = joueur('a', { a_moi: true });
  const autre = joueur('b');
  assert.equal(peutRegler(aMoi, 'joueur'), true);
  assert.equal(peutRegler(aMoi, 'observateur'), true, 'le propriétaire règle sa fiche, quel que soit son niveau (le service refuse seulement « MJ » en dessous)');
  assert.equal(peutRegler(autre, 'joueur'), false, 'la fiche d’un autre joueur');
  assert.equal(peutRegler(autre, 'mj'), false, 'un MJ voit la fiche d’un autre sans la régler');
  assert.equal(peutRegler(autre, 'createur'), true);
  assert.equal(peutRegler(pretire('p'), 'createur'), false, 'un prétiré n’a pas de « Visible par » (le service répond 400)');
  assert.equal(peutRegler(pretire('p', { a_moi: true }), 'createur'), false);
  assert.equal(peutRegler(aMoi, null), true, 'a_moi ne vient que d’une session : le service décide');
  assert.equal(peutRegler(autre, null), false);
  assert.equal(peutRegler(undefined, 'createur'), false);
});

test('R318 (2) : « MJ » n’est proposé qu’à une session de niveau MJ ou Créateur, sauf sur une fiche déjà en « mj »', () => {
  const tous = joueur('a', { a_moi: true, visibilite: 'tous' });
  assert.deepEqual(valeurs(optionsDeVisibilite(tous, 'joueur')), ['tous', 'privee']);
  assert.deepEqual(valeurs(optionsDeVisibilite(tous, 'observateur')), ['tous', 'privee']);
  assert.deepEqual(valeurs(optionsDeVisibilite(tous, null)), ['tous', 'privee']);
  for (const niveau of ['mj', 'createur']) assert.deepEqual(valeurs(optionsDeVisibilite(tous, niveau)), ['tous', 'mj', 'privee'], niveau);
  // déjà en « mj » : le menu le dit, mais un joueur ne peut pas le rechoisir
  const enMj = joueur('a', { a_moi: true, visibilite: 'mj' });
  const pourJoueur = optionsDeVisibilite(enMj, 'joueur');
  assert.deepEqual(valeurs(pourJoueur), ['tous', 'mj', 'privee']);
  assert.equal(pourJoueur.find((o) => o.valeur === 'mj').selectionnee, true);
  assert.equal(pourJoueur.find((o) => o.valeur === 'mj').choisissable, false);
  assert.ok(pourJoueur.filter((o) => o.valeur !== 'mj').every((o) => o.choisissable));
  assert.equal(optionsDeVisibilite(enMj, 'mj').find((o) => o.valeur === 'mj').choisissable, true);
});

test('R318 : une seule option est sélectionnée, celle de la visibilité en place', () => {
  for (const visibilite of ['tous', 'mj', 'privee']) {
    const options = optionsDeVisibilite(joueur('a', { visibilite }), 'createur');
    assert.deepEqual(options.filter((o) => o.selectionnee).map((o) => o.valeur), [visibilite]);
  }
});

test('R318 (4) : « Ranger au compte » est réservé à une session de niveau Créateur', () => {
  assert.equal(peutRanger('createur'), true);
  for (const niveau of ['mj', 'joueur', 'observateur', null, undefined]) assert.equal(peutRanger(niveau), false, String(niveau));
});

test('R318 : les comptes où ranger une fiche, sans son propriétaire actuel, triés par nom', () => {
  const comptes = [
    { id: 'u3', nom_affichage: 'zoé', niveau: 'joueur' },
    { id: 'u1', nom_affichage: 'Alice', niveau: 'createur' },
    { id: 'u2', nom_affichage: 'Émile', niveau: 'mj' },
    { id: 'u4', nom_affichage: 'alice', niveau: 'observateur' },
  ];
  assert.deepEqual(comptesRangeables(comptes, pretire('p')).map((c) => c.id), ['u1', 'u4', 'u2', 'u3'], 'sans casse ni accent d’ordre, puis par identifiant');
  assert.deepEqual(comptesRangeables(comptes, joueur('a', { proprietaire: { id: 'u1', nom_affichage: 'Alice' } })).map((c) => c.id), ['u4', 'u2', 'u3'], 'le propriétaire actuel n’y est pas');
  const [alice, alice2] = comptesRangeables(comptes, pretire('p'));
  assert.notEqual(alice.libelle, alice2.libelle, 'deux comptes de même nom se distinguent par leur niveau');
  assert.ok(alice.libelle.includes(LIBELLES_DE_NIVEAU.createur));
  assert.deepEqual(comptesRangeables(null, pretire('p')), []);
  assert.deepEqual(comptesRangeables([null, { nom_affichage: 'sans id' }], pretire('p')), []);
});

test('R318 : trois sections, l’ordre du tri gardé dans chacune', () => {
  const liste = [
    joueur('d', { nom: 'D', niveau_global: 4, xp: 400 }), pretire('c', { nom: 'C', xp: 300 }), joueur('a', { nom: 'A', a_moi: true, xp: 100 }),
    pretire('b', { nom: 'B', xp: 200 }), joueur('e', { nom: 'E', a_moi: true, xp: 500 }),
  ];
  const triee = trier(filtrer(liste, {}), 'nom', 'asc');
  const s = sectionsDeLaListe(triee);
  assert.deepEqual(s.mes.map((x) => x.id), ['a', 'e']);
  assert.deepEqual(s.pretires.map((x) => x.id), ['b', 'c']);
  assert.deepEqual(s.autres.map((x) => x.id), ['d']);
  assert.equal(s.mes.length + s.pretires.length + s.autres.length, liste.length, 'chaque fiche dans une seule section');
  // tri par niveau (XP), sens inverse : l'ordre de la liste triée se retrouve dans chaque section
  const parXp = sectionsDeLaListe(trier(liste, 'niveau', 'desc'));
  assert.deepEqual(parXp.mes.map((x) => x.id), ['e', 'a']);
  assert.deepEqual(parXp.pretires.map((x) => x.id), ['c', 'b']);
});

test('R318 : une fiche à moi est toujours dans « Mes personnages » ; sans nature (service d’avant), une fiche est un prétiré', () => {
  const s = sectionsDeLaListe([joueur('a', { a_moi: true }), { id: 'vieux', nom: 'vieux' }, pretire('p')]);
  assert.deepEqual(s.mes.map((x) => x.id), ['a']);
  assert.deepEqual(s.pretires.map((x) => x.id), ['vieux', 'p']);
  assert.deepEqual(s.autres, []);
  assert.deepEqual(sectionsDeLaListe([]), { mes: [], pretires: [], autres: [] });
});

test('R318 : un échec de réglage dit que rien n’a changé, et distingue la porte du site de dev d’un droit manquant', () => {
  for (const action of ['visibilite', 'proprietaire']) {
    const messages = new Set();
    for (const [statut, corps] of [[null, null], [401, null], [403, { acces: 'niveau' }], [403, { erreur: 'refusé' }], [404, null], [400, { erreur: 'compte inconnu' }], [500, null], [undefined, undefined]]) {
      const m = messageDEchec(action, statut, corps);
      assert.equal(typeof m, 'string');
      assert.ok(m.length > 10, `${action} ${statut}`);
      messages.add(m);
    }
    assert.equal(messages.size, 7, `${action} : des messages distincts selon la cause (le service muet vaut statut absent)`);
  }
  assert.notEqual(messageDEchec('visibilite', 403, null), messageDEchec('proprietaire', 403, null), 'selon l’action');
  assert.ok(messageDEchec('proprietaire', 400, { erreur: 'compte inconnu' }).includes('compte inconnu'), 'le motif du service est repris');
  assert.ok(messageDEchec('visibilite', 403, { acces: 'niveau', niveau_requis: 'createur' }).includes(LIBELLES_DES_NIVEAUX.createur), 'la porte du site de dev dit le niveau requis qu’elle renvoie');
  assert.ok(!Object.values(LIBELLES_DES_NIVEAUX).some((n) => messageDEchec('visibilite', 403, { acces: 'niveau' }).includes(n)), 'sans niveau_requis, aucun niveau n’est nommé');
  assert.ok(!messageDEchec('visibilite', 400, { erreur: 42 }).includes('42'), 'un motif qui n’est pas un texte est ignoré');
});

test('R318 : les libellés de niveau recopiés sont ceux de lib/compte.mjs', () => {
  assert.deepEqual({ ...LIBELLES_DE_NIVEAU }, { ...LIBELLES_DES_NIVEAUX });
});

test('R318 : le script de page n’importe que lib/personnages-liste.mjs (jamais lib/compte.mjs ni un module d’une autre page)', () => {
  const source = readFileSync(new URL('../src/scripts/personnages.mjs', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['../lib/personnages-liste.mjs']);
  const compte = readFileSync(new URL('../src/scripts/compte.mjs', import.meta.url), 'utf8');
  assert.ok(![...compte.matchAll(/from '([^']+)'/g)].some((m) => m[1].includes('personnages-liste')), 'scripts/compte.mjs n’importe pas le module de la liste');
  // le menu et les réglages passent par les routes du service (R318), jamais par un autre chemin
  for (const route of ['visibilite/', 'proprietaire/', 'utilisateurs/']) assert.ok(source.includes(route), route);
});

test('R318 : un seul GET /api/moi/ par page (skill zone-menu) : personnages.mjs n’en fait aucun et lit la réponse que scripts/compte.mjs publie', () => {
  const source = readFileSync(new URL('../src/scripts/personnages.mjs', import.meta.url), 'utf8');
  const compte = readFileSync(new URL('../src/scripts/compte.mjs', import.meta.url), 'utf8');
  const code = (texte) => texte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n'); // sans commentaires
  // aucune requête vers moi/ (le service est interrogé par `${racine.dataset.api}…`, jamais en dur) ; les fetch à adresse écrite sont ceux de la liste et des comptes (les réglages passent par `chemin`)
  assert.ok(!/moi\//.test(code(source)), 'aucune adresse moi/ dans le code de personnages.mjs');
  const appels = [...code(source).matchAll(/fetch\(`\$\{racine\.dataset\.api\}([^`$]+)/g)].map((m) => m[1]);
  assert.ok(appels.length >= 2 && appels.every((a) => /^(personnages|utilisateurs)\//.test(a)), appels.join(' '));
  // la lecture : la propriété si l'événement a déjà eu lieu, sinon l'événement
  assert.ok(code(source).includes('window.maverickMoi') && code(source).includes("'maverick:moi'"));
  // la publication : compte.mjs, qui fait la seule demande
  assert.ok(code(compte).includes('maverickMoi') && code(compte).includes("'maverick:moi'") && code(compte).includes('dispatchEvent'));
  assert.equal([...code(compte).matchAll(/\bfetch\(`\$\{api\}moi\//g)].length, 1, 'une seule demande à moi/ dans compte.mjs');
});

test('R318 : le module de la liste reste sans navigateur ni Astro (skill site-version-portable)', () => {
  const source = readFileSync(new URL('../src/lib/personnages-liste.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(document|window|location|localStorage|fetch)\b\s*[.(]|from 'astro|import\.meta\.env/);
});
