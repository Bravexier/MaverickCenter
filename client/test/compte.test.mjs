// Le compte du visiteur dans les pages (R310 : « Dans le menu en haut à droite je veux un lien vers le profil. Si non connecté, le bouton "connexion via Discord". »)
// — lib/compte.mjs (choix du menu connecté / non connecté / indisponible, `retour` filtré comme le service, images de cdn.discordapp.com, messages par code
// d'erreur) et scripts/compte.mjs exécuté dans un faux navigateur avec les vraies balises des pages /profil/ et /connexion/ : UN seul `GET /api/moi/` par page,
// profil rempli, déconnexion, message de `?erreur=`. Pas de texte figé : on vérifie les choix, les liens et que chaque code connu a un message.
//   node --test test/compte.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CODES_D_ERREUR, NIVEAUX, RETOUR_PAR_DEFAUT, retourValide as retourDuService } from '../serveur/discord.mjs';
import {
  LIBELLES_DES_NIVEAUX, MESSAGES_DES_ERREURS, MESSAGE_DU_NON_MEMBRE, adresseDeConnexion, adresseDImage, choixDuMenu, dateFrancaise, etatDuCompte, libelleDuNiveau, messageDErreur,
  profilAAfficher, retourDeLaPage, retourValide,
} from '../src/lib/compte.mjs';
import { attendre, cliquer, el, fauxDocument } from './aide-faux-dom.mjs';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const sansCommentaires = (code) => code.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');

const API = '/api/';
const lieu = (chemin = '/regles/', recherche = '') => ({ api: API, pageProfil: '/profil/', pageConnexion: '/connexion/', chemin, recherche });
const AVATAR = 'https://cdn.discordapp.com/avatars/1/a.png?size=64';
const connecte = (utilisateur = {}) => ({
  connexion_disponible: true, connecte: true,
  utilisateur: { nom: 'Aria', avatar_url: AVATAR, banniere_url: null, niveau: 'joueur', serveur_rejoint_le: '2024-03-05T10:00:00Z', ...utilisateur },
});
const deconnecte = { connexion_disponible: true, connecte: false, utilisateur: null };

// --- lib/compte.mjs ----------------------------------------------------------------------------------------------------------------------------

test('les quatre niveaux ont un libellé, ceux du service ; un niveau inconnu n’en a pas', () => {
  assert.deepEqual(Object.keys(LIBELLES_DES_NIVEAUX), [...NIVEAUX], 'les niveaux du service (serveur/discord.mjs#NIVEAUX), dans l’ordre');
  for (const niveau of NIVEAUX) assert.ok(libelleDuNiveau(niveau), niveau);
  assert.equal(libelleDuNiveau('admin'), null);
  assert.equal(libelleDuNiveau('__proto__'), null);
  assert.equal(libelleDuNiveau(undefined), null);
});

test('`retour` : un chemin du site seulement, le même filtre que le service (R310)', () => {
  const cas = ['/profil/', '/regles/combats/?a=1#b', '/', '//exemple.org/x', 'https://exemple.org/', 'profil/', '', '/a\\b', '/a\nb', '/\u007f', `/${'a'.repeat(500)}`, '/\\/exemple.org', null, undefined, 42, {}];
  for (const retour of cas) {
    assert.equal(retourValide(retour) ?? RETOUR_PAR_DEFAUT, retourDuService(retour), `accord avec le service pour ${JSON.stringify(retour)}`);
  }
  assert.equal(retourValide('//exemple.org/x'), null);
  assert.equal(retourValide('/regles/?a=1'), '/regles/?a=1');
});

test('l’adresse de connexion garde `retour` encodé, seulement s’il est valide', () => {
  assert.equal(adresseDeConnexion('/api/', '/regles/?a=1&b=2'), `/api/connexion/discord/?retour=${encodeURIComponent('/regles/?a=1&b=2')}`);
  assert.equal(adresseDeConnexion('/api/', '//exemple.org/'), '/api/connexion/discord/');
  assert.equal(adresseDeConnexion('/api/', null), '/api/connexion/discord/');
});

test('le retour de la page : la page courante ; sur la page de connexion, son propre `retour` (jamais elle-même)', () => {
  const connexion = '/connexion/';
  assert.equal(retourDeLaPage({ chemin: '/regles/combats/', recherche: '?x=1', pageConnexion: connexion }), '/regles/combats/?x=1');
  assert.equal(retourDeLaPage({ chemin: '/connexion/', recherche: '?retour=%2Fregles%2F', pageConnexion: connexion }), '/regles/');
  assert.equal(retourDeLaPage({ chemin: '/connexion', recherche: '?erreur=niveau&retour=%2Fregles%2F', pageConnexion: connexion }), '/regles/');
  assert.equal(retourDeLaPage({ chemin: '/connexion/', recherche: '?retour=%2F%2Fexemple.org', pageConnexion: connexion }), null, 'retour hors du site');
  assert.equal(retourDeLaPage({ chemin: '/connexion/', recherche: '?retour=%2Fconnexion%2F%3Ferreur%3Drefus', pageConnexion: connexion }), null, 'pas de boucle sur elle-même');
  assert.equal(retourDeLaPage({ chemin: '/connexion/', recherche: '', pageConnexion: connexion }), null);
});

test('une image n’est chargée que depuis https://cdn.discordapp.com (R310 (5))', () => {
  assert.equal(adresseDImage(AVATAR), AVATAR);
  for (const mauvaise of ['http://cdn.discordapp.com/a.png', 'https://exemple.org/a.png', 'https://cdn.discordapp.com.exemple.org/a.png', 'https://u:p@cdn.discordapp.com/a.png', 'javascript:alert(1)', '', null, undefined, 7]) {
    assert.equal(adresseDImage(mauvaise), null, String(mauvaise));
  }
});

test('la date d’arrivée sur le serveur s’écrit en français ; absente ou illisible : rien', () => {
  assert.equal(dateFrancaise('2024-03-05T10:00:00Z'), '5 mars 2024');
  assert.equal(dateFrancaise('2025-01-31T12:00:00Z'), '31 janvier 2025', 'jour, mois en toutes lettres, année');
  assert.equal(dateFrancaise(null), null);
  assert.equal(dateFrancaise('pas une date'), null);
});

test('le profil à afficher : nom, niveau en libellé, images permises, date ; un utilisateur sans nom n’est pas un profil', () => {
  const p = profilAAfficher({ nom: 'Aria', avatar_url: AVATAR, banniere_url: 'https://exemple.org/b.png', niveau: 'createur', serveur_rejoint_le: null });
  assert.equal(p.nom, 'Aria');
  assert.equal(p.niveau, LIBELLES_DES_NIVEAUX.createur);
  assert.equal(p.avatar, AVATAR);
  assert.equal(p.banniere, null, 'une bannière hors de Discord n’est pas chargée');
  assert.equal(p.arrivee, null);
  assert.equal(profilAAfficher({ nom: '  ' }), null);
  assert.equal(profilAAfficher(null), null);
  assert.equal(profilAAfficher('Aria'), null);
});

test('l’état du compte : indisponible (échec ou connexion non réglée), déconnecté, connecté', () => {
  assert.equal(etatDuCompte(null), 'indisponible');
  assert.equal(etatDuCompte({}), 'indisponible');
  assert.equal(etatDuCompte({ connexion_disponible: false, connecte: false, utilisateur: null }), 'indisponible');
  assert.equal(etatDuCompte(deconnecte), 'deconnecte');
  assert.equal(etatDuCompte(connecte()), 'connecte');
  assert.equal(etatDuCompte({ connexion_disponible: true, connecte: true, utilisateur: null }), 'deconnecte', 'connecté sans profil lisible : on propose de se connecter');
});

const nonMembre = { connexion_disponible: true, connecte: false, utilisateur: null, non_membre: true };

test('R313 : un non-membre (`non_membre: true`) est un état à part ; `non_membre` autre que true, ou une connexion non réglée, n’en est pas un ; le menu garde le bouton de connexion', () => {
  assert.equal(etatDuCompte(nonMembre), 'non_membre');
  for (const valeur of [false, 'true', 1, null, undefined]) assert.equal(etatDuCompte({ ...nonMembre, non_membre: valeur }), 'deconnecte', String(valeur));
  assert.equal(etatDuCompte({ ...nonMembre, connexion_disponible: false }), 'indisponible');
  assert.equal(etatDuCompte({ ...connecte(), non_membre: true }), 'connecte', 'un profil lisible l’emporte');
  assert.ok(MESSAGE_DU_NON_MEMBRE.trim());
  assert.equal(choixDuMenu(nonMembre, lieu()).type, 'connexion');
});

test('le menu : le compte (avatar, nom, lien vers le profil), sinon le bouton de connexion avec la page courante, sinon rien (pas de bouton mort)', () => {
  assert.deepEqual(choixDuMenu(connecte(), lieu()), { type: 'compte', nom: 'Aria', avatar: AVATAR, href: '/profil/' });
  assert.deepEqual(choixDuMenu(connecte({ avatar_url: null }), lieu()), { type: 'compte', nom: 'Aria', avatar: null, href: '/profil/' });
  assert.deepEqual(choixDuMenu(deconnecte, lieu('/regles/combats/', '?a=1')), { type: 'connexion', href: `/api/connexion/discord/?retour=${encodeURIComponent('/regles/combats/?a=1')}` });
  assert.deepEqual(choixDuMenu(null, lieu()), { type: 'rien' }, 'la requête a échoué');
  assert.deepEqual(choixDuMenu({ connexion_disponible: false, connecte: false, utilisateur: null }, lieu()), { type: 'rien' }, 'connexion non réglée');
  assert.deepEqual(choixDuMenu(deconnecte, lieu('/connexion/', '?erreur=refus')), { type: 'rien' }, 'la page de connexion porte son propre bouton');
  assert.deepEqual(choixDuMenu(connecte(), lieu('/connexion/')), { type: 'rien' });
});

test('chaque code d’erreur du service, et `niveau` (la porte), a un message ; un autre code n’en a pas', () => {
  for (const code of [...CODES_D_ERREUR, 'niveau']) assert.ok(messageDErreur(code), code);
  assert.deepEqual(Object.keys(MESSAGES_DES_ERREURS).sort(), [...CODES_D_ERREUR, 'niveau'].sort(), 'aucun code en trop');
  for (const autre of ['inconnu', '', null, undefined, '__proto__', 'toString']) assert.equal(messageDErreur(autre), null, String(autre));
});

// --- scripts/compte.mjs dans un faux navigateur ----------------------------------------------------------------------------------------------------

let numero = 0;
const SOURCE = new URL('../src/scripts/compte.mjs', import.meta.url);

/** Les balises (entre <section> et </section>) d'une page .astro, sans ses expressions : les vraies balises que le script remplit. */
function balisesDeLaPage(fichier) {
  const source = lire(fichier);
  const bloc = /<section\b[\s\S]*<\/section>/.exec(source)[0];
  return bloc
    .replace(/\{\/\*[\s\S]*?\*\/\}\s*/g, '')
    .replace(/^\s*\{!site\.test && [^\n]*\n/m, '')
    .replace(/href=\{url\('([^']+)'\)\}/g, 'href="/$1"')
    .replace(/\{introduction\}/g, 'introduction');
}

/**
 * Une page avec sa zone de compte et le service factice `moi` (la réponse de GET /api/moi/ : [statut, corps], ou une exception).
 * `contenu` : les balises de la page (profil, connexion). Rend les appels faits et ce que la page a remplacé.
 */
async function ouvrir({ moi, chemin = '/regles/', recherche = '', contenu = '', zone = true, deconnexion = [200, { connecte: false }] }) {
  const appels = [];
  const document = fauxDocument(el('main', {}));
  if (zone) document.body.append(el('div', { class: 'site-compte', 'data-compte': '', hidden: '', 'data-api': '/api/', 'data-page-profil': '/profil/', 'data-page-connexion': '/connexion/', 'data-accueil': '/' }));
  if (contenu) {
    const page = el('div', {});
    page.innerHTML = contenu;
    document.body.append(page);
  }
  const allers = [];
  Object.assign(globalThis, {
    document,
    location: { pathname: chemin, search: recherche, href: `http://site${chemin}${recherche}`, assign: (adresse) => allers.push(adresse) },
    fetch: async (entree, init) => {
      const adresse = typeof entree === 'string' ? entree : entree.url;
      appels.push({ methode: (init?.method ?? 'GET').toUpperCase(), adresse, corps: init?.body, entetes: init?.headers });
      if (adresse === '/api/moi/') {
        if (moi instanceof Error) throw moi;
        return new Response(JSON.stringify(moi[1]), { status: moi[0], headers: { 'Content-Type': 'application/json' } });
      }
      if (adresse === '/api/deconnexion/') {
        if (deconnexion instanceof Error) throw deconnexion;
        return new Response(JSON.stringify(deconnexion[1]), { status: deconnexion[0], headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    },
  });
  const module = await import(`${SOURCE.href}?page=${(numero += 1)}`);
  await module.pret;
  await attendre();
  return { document, appels, allers, zone: document.querySelector('[data-compte]') };
}

test('menu connecté : avatar rond et nom dans un lien vers le profil ; une seule demande à /api/moi/', async () => {
  const p = await ouvrir({ moi: [200, connecte()] });
  assert.equal(p.zone.hidden, false);
  const lien = p.zone.querySelector('a');
  assert.equal(lien.getAttribute('href'), '/profil/');
  assert.equal(lien.querySelector('img').getAttribute('src'), AVATAR);
  assert.match(lien.textContent, /Aria/);
  assert.deepEqual(p.appels.map((a) => `${a.methode} ${a.adresse}`), ['GET /api/moi/']);
});

test('menu connecté sans avatar lisible : l’initiale, jamais une image hors de Discord', async () => {
  const p = await ouvrir({ moi: [200, connecte({ avatar_url: 'https://exemple.org/a.png' })] });
  assert.equal(p.zone.querySelector('img'), null);
  assert.equal(p.zone.querySelector('.site-compte__avatar').textContent, 'A');
});

test('menu non connecté : le bouton de connexion, avec la page courante en `retour`', async () => {
  const p = await ouvrir({ moi: [200, deconnecte], chemin: '/regles/combats/', recherche: '?a=1' });
  assert.equal(p.zone.hidden, false);
  const lien = p.zone.querySelector('a');
  assert.equal(lien.getAttribute('href'), `/api/connexion/discord/?retour=${encodeURIComponent('/regles/combats/?a=1')}`);
  assert.ok(lien.textContent.trim(), 'un libellé');
});

test('menu : requête en échec, statut d’erreur ou connexion non réglée : rien, zone cachée et vide (pas de bouton mort)', async () => {
  for (const moi of [new Error('réseau'), [500, { erreur: 'x' }], [200, { connexion_disponible: false, connecte: false, utilisateur: null }], [200, 'pas un objet']]) {
    const p = await ouvrir({ moi });
    assert.equal(p.zone.hidden, true, JSON.stringify(moi));
    assert.equal(p.zone.querySelector('a'), null);
    assert.equal(p.appels.length, 1);
  }
});

test('sans zone (version portable, page de maintenance) : aucune demande', async () => {
  const p = await ouvrir({ moi: [200, connecte()], zone: false });
  assert.equal(p.appels.length, 0);
});

test('/profil/ connecté : avatar, bannière, nom, niveau, arrivée ; « Se déconnecter » poste à /api/deconnexion/ puis retourne à l’accueil', async () => {
  const BANNIERE = 'https://cdn.discordapp.com/banners/1/b.png';
  const p = await ouvrir({ moi: [200, connecte({ niveau: 'createur', banniere_url: BANNIERE })], chemin: '/profil/', contenu: balisesDeLaPage('../src/pages/profil.astro') });
  const q = (s) => p.document.querySelector(s);
  assert.equal(q('[data-profil-connecte]').hidden, false);
  assert.equal(q('[data-profil-invite]').hidden, true);
  assert.equal(q('[data-profil-chargement]').hidden, true);
  assert.equal(q('[data-profil-nom]').textContent, 'Aria');
  assert.equal(q('[data-profil-niveau]').textContent, LIBELLES_DES_NIVEAUX.createur);
  assert.equal(q('[data-profil-arrivee]').textContent, '5 mars 2024');
  assert.equal(q('[data-profil-ligne-arrivee]').hidden, false);
  assert.equal(q('[data-profil-avatar]').getAttribute('src'), AVATAR);
  assert.equal(q('[data-profil-avatar]').hidden, false);
  assert.equal(q('[data-profil-banniere]').hidden, false);
  assert.equal(q('[data-profil-banniere] img').getAttribute('src'), BANNIERE);
  assert.equal(p.appels.filter((a) => a.adresse === '/api/moi/').length, 1, 'le menu et la page partagent UNE demande');
  cliquer(q('[data-deconnexion]'));
  await attendre();
  await attendre();
  const envoi = p.appels.find((a) => a.adresse === '/api/deconnexion/');
  assert.equal(envoi.methode, 'POST');
  assert.equal(envoi.corps, '{}');
  assert.equal(envoi.entetes['Content-Type'], 'application/json');
  assert.deepEqual(p.allers, ['/']);
});

test('/profil/ : sans bannière ni date d’arrivée, ces lignes disparaissent ; une déconnexion en échec le dit et reste', async () => {
  const p = await ouvrir({ moi: [200, connecte({ serveur_rejoint_le: null })], chemin: '/profil/', contenu: balisesDeLaPage('../src/pages/profil.astro'), deconnexion: new Error('réseau') });
  const q = (s) => p.document.querySelector(s);
  assert.equal(q('[data-profil-banniere]').hidden, true);
  assert.equal(q('[data-profil-ligne-arrivee]').hidden, true);
  cliquer(q('[data-deconnexion]'));
  await attendre();
  await attendre();
  assert.deepEqual(p.allers, []);
  assert.equal(q('[data-profil-erreur]').hidden, false);
  assert.ok(q('[data-profil-erreur]').textContent.trim());
  assert.equal(q('[data-deconnexion]').disabled, false, 'on peut réessayer');
});

test('/profil/ non connecté : l’invitation et le bouton de connexion qui reviennent au profil ; connexion non réglée : seulement le constat', async () => {
  const non = await ouvrir({ moi: [200, deconnecte], chemin: '/profil/', contenu: balisesDeLaPage('../src/pages/profil.astro') });
  assert.equal(non.document.querySelector('[data-profil-connecte]').hidden, true);
  assert.equal(non.document.querySelector('[data-profil-invite]').hidden, false);
  assert.equal(non.document.querySelector('[data-lien-connexion]').getAttribute('href'), `/api/connexion/discord/?retour=${encodeURIComponent('/profil/')}`);
  const sans = await ouvrir({ moi: [200, { connexion_disponible: false, connecte: false, utilisateur: null }], chemin: '/profil/', contenu: balisesDeLaPage('../src/pages/profil.astro') });
  assert.equal(sans.document.querySelector('[data-profil-invite]').hidden, true);
  assert.equal(sans.document.querySelector('[data-profil-indisponible]').hidden, false);
});

test('/connexion/ : le message de ?erreur=, le bouton qui garde `retour` (chemin du site seulement)', async () => {
  const contenu = balisesDeLaPage('../src/pages/connexion.astro');
  const niveau = await ouvrir({ moi: [200, deconnecte], chemin: '/connexion/', recherche: '?erreur=niveau&retour=%2Fregles%2F', contenu });
  const erreur = niveau.document.querySelector('[data-connexion-erreur]');
  assert.equal(erreur.hidden, false);
  assert.equal(erreur.textContent, MESSAGES_DES_ERREURS.niveau);
  assert.equal(niveau.document.querySelector('[data-lien-connexion]').getAttribute('href'), `/api/connexion/discord/?retour=${encodeURIComponent('/regles/')}`);
  assert.equal(niveau.zone.hidden, true, 'pas de second bouton dans le menu');
  for (const code of CODES_D_ERREUR) {
    const p = await ouvrir({ moi: [200, deconnecte], chemin: '/connexion/', recherche: `?erreur=${code}`, contenu });
    assert.equal(p.document.querySelector('[data-connexion-erreur]').textContent, MESSAGES_DES_ERREURS[code], code);
    assert.equal(p.document.querySelector('[data-lien-connexion]').getAttribute('href'), '/api/connexion/discord/', 'sans retour');
  }
  const inconnu = await ouvrir({ moi: [200, deconnecte], chemin: '/connexion/', recherche: '?erreur=zzz&retour=%2F%2Fexemple.org', contenu });
  assert.equal(inconnu.document.querySelector('[data-connexion-erreur]').hidden, true, 'code inconnu : aucun message');
  assert.equal(inconnu.document.querySelector('[data-lien-connexion]').getAttribute('href'), '/api/connexion/discord/', 'retour hors du site : ignoré');
});

test('/connexion/ : connecté (niveau trop bas), on peut se déconnecter ; connexion non réglée : pas de bouton mort', async () => {
  const contenu = balisesDeLaPage('../src/pages/connexion.astro');
  const connecteTropBas = await ouvrir({ moi: [200, connecte({ niveau: 'observateur' })], chemin: '/connexion/', recherche: '?erreur=niveau', contenu });
  const q = (s) => connecteTropBas.document.querySelector(s);
  assert.equal(q('[data-connexion-connecte]').hidden, false);
  assert.equal(q('[data-connexion-nom]').textContent, 'Aria');
  assert.equal(q('[data-connexion-niveau]').textContent, LIBELLES_DES_NIVEAUX.observateur);
  cliquer(q('[data-deconnexion]'));
  await attendre();
  await attendre();
  assert.deepEqual(connecteTropBas.allers, ['/']);
  const sans = await ouvrir({ moi: [200, { connexion_disponible: false, connecte: false, utilisateur: null }], chemin: '/connexion/', contenu });
  assert.equal(sans.document.querySelector('[data-lien-connexion]').hidden, true);
  assert.equal(sans.document.querySelector('[data-connexion-indisponible]').hidden, false);
  const echec = await ouvrir({ moi: new Error('réseau'), chemin: '/connexion/', contenu });
  assert.equal(echec.document.querySelector('[data-lien-connexion]').hidden, false, 'service muet : le bouton reste (le lien suffit)');
});

test('/profil/ et /connexion/ non-membre : le message (celui de lib/compte.mjs), « Se déconnecter » qui poste puis retourne à l’accueil ; une seule demande', async () => {
  for (const [fichier, chemin, bloc] of [['../src/pages/profil.astro', '/profil/', 'profil'], ['../src/pages/connexion.astro', '/connexion/', 'connexion']]) {
    const p = await ouvrir({ moi: [200, nonMembre], chemin, contenu: balisesDeLaPage(fichier) });
    const zone = p.document.querySelector(`[data-${bloc}-non-membre]`);
    assert.equal(zone.hidden, false, bloc);
    assert.equal(zone.querySelector('[data-message-non-membre]').textContent, MESSAGE_DU_NON_MEMBRE);
    if (bloc === 'profil') {
      assert.equal(p.document.querySelector('[data-profil-connecte]').hidden, true);
      assert.equal(p.document.querySelector('[data-profil-invite]').hidden, true, 'pas d’invitation : il est déjà connecté');
    } else assert.equal(p.document.querySelector('[data-connexion-connecte]').hidden, true);
    assert.equal(p.appels.filter((a) => a.adresse === '/api/moi/').length, 1);
    cliquer(zone.querySelector('[data-deconnexion]'));
    await attendre();
    await attendre();
    assert.equal(p.appels.find((a) => a.adresse === '/api/deconnexion/').methode, 'POST', bloc);
    assert.deepEqual(p.allers, ['/'], bloc);
  }
  const autre = await ouvrir({ moi: [200, deconnecte], chemin: '/profil/', contenu: balisesDeLaPage('../src/pages/profil.astro') });
  assert.equal(autre.document.querySelector('[data-profil-non-membre]').hidden, true, 'caché pour qui n’est pas connecté');
});

// --- Câblage ---------------------------------------------------------------------------------------------------------------------------------

test('un seul script de page importe lib/compte.mjs ; il n’importe que lui ; le composant est absent de la version portable et de la maintenance', () => {
  const scripts = readdirSync(new URL('../src/scripts/', import.meta.url)).filter((f) => f.endsWith('.mjs'));
  const importeurs = scripts.filter((f) => /^import [^;]*lib\/compte\.mjs'/m.test(lire(`../src/scripts/${f}`)));
  assert.deepEqual(importeurs, ['compte.mjs'], 'jamais deux scripts sur le même module (skill site-version-portable)');
  const imports = [...sansCommentaires(lire('../src/scripts/compte.mjs')).matchAll(/^import [^;]*from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../lib/compte.mjs']);
  const lib = sansCommentaires(lire('../src/lib/compte.mjs'));
  assert.ok(!/^import\s/m.test(lib) && !/\b(document|window|location|localStorage)\b/.test(lib), 'module pur : ni import, ni navigateur');
  const base = lire('../src/layouts/Base.astro');
  assert.match(base, /\{!portable && !maintenance && <Compte \/>\}/);
  assert.match(lire('../src/components/Compte.astro'), /import '\.\.\/scripts\/compte\.mjs';/);
  const build = lire('../../tools/build-artifact.mjs');
  assert.match(build, /rel\.startsWith\('profil\/'\)/, 'la version portable n’emporte pas le profil');
  assert.match(build, /rel\.startsWith\('connexion\/'\)/, 'ni la connexion');
});
