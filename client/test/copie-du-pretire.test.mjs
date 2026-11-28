// R320 : « Copier le prétiré », côté page. La règle du bouton (Joueur, MJ et Créateur ; sur un prétiré seulement), sa copie sur la fiche (deux scripts de page
// n'importent jamais le même module : skill site-version-portable), l'adresse de la copie, les refus, et les points d'accroche des deux pages. Le service est
// testé à part (test/serveur-copie-du-pretire.test.mjs). Aucun texte de page n'est lu ici : les messages ne sont épinglés que par leur fonctionnement
// (distincts, non vides, dire que rien n'est copié).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import * as liste from '../src/lib/personnages-liste.mjs';
import * as fiche from '../src/lib/fiche-copie.mjs';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const sansCommentaires = (texte) => texte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const NIVEAUX = ['observateur', 'joueur', 'mj', 'createur', null, undefined, 'roi'];
const NATURES = ['pretire', 'joueur', undefined, null, 'autre'];
const moi = (niveau, surcharge = {}) => ({ connexion_disponible: true, connecte: true, utilisateur: { nom: 'X', niveau }, ...surcharge });

test('R320 (2) : le bouton est proposé à Joueur, MJ et Créateur, jamais à un Observateur, à un visiteur ni sans niveau', () => {
  const p = { id: 'p', nature: 'pretire' };
  for (const niveau of ['joueur', 'mj', 'createur']) assert.equal(liste.peutCopier(niveau, p), true, niveau);
  for (const niveau of ['observateur', null, undefined, 'roi', '']) assert.equal(liste.peutCopier(niveau, p), false, String(niveau));
  assert.deepEqual([...liste.NIVEAUX_QUI_COPIENT], ['joueur', 'mj', 'createur']);
});

test('R320 (1) : on ne copie qu’un prétiré, jamais une fiche de joueur (le service répond 400), ni une fiche absente ou sans nature', () => {
  for (const niveau of ['joueur', 'mj', 'createur']) {
    assert.equal(liste.peutCopier(niveau, { id: 'j', nature: 'joueur', a_moi: true }), false, `à soi, ${niveau}`);
    assert.equal(liste.peutCopier(niveau, { id: 'j', nature: 'joueur', a_moi: false }), false, `d’un autre, ${niveau}`);
    assert.equal(liste.peutCopier(niveau, {}), false);
    assert.equal(liste.peutCopier(niveau, null), false);
    assert.equal(liste.peutCopier(niveau, undefined), false);
  }
});

test('R320 : la fiche et la liste ont la même règle, le même niveau de session, la même adresse de copie (deux modules, un accord)', () => {
  assert.deepEqual([...fiche.NIVEAUX_QUI_COPIENT], [...liste.NIVEAUX_QUI_COPIENT]);
  for (const niveau of NIVEAUX) {
    for (const nature of NATURES) assert.equal(fiche.peutCopier(niveau, { nature }), liste.peutCopier(niveau, { nature }), `${niveau} / ${nature}`);
    assert.equal(fiche.peutCopier(niveau, null), false);
  }
  const reponses = [null, undefined, {}, moi('observateur'), moi('joueur'), moi('mj'), moi('createur'), moi('roi'), moi('joueur', { connecte: false }), { connecte: false, non_membre: true }];
  for (const r of reponses) assert.equal(fiche.niveauDeLaSession(r), liste.niveauDeLaSession(r), JSON.stringify(r));
  for (const copie of [null, {}, { id: '' }, { id: 7 }, { id: 'a b/c' }, { id: 'copie-1' }]) {
    assert.equal(fiche.adresseDeLaCopie('/fiche/', copie), liste.adresseDeLaCopie('/fiche/', copie), JSON.stringify(copie));
  }
});

test('R320 : après la copie, on va à /fiche/?id=<copie> (la fiche lit ?id=) ; sans identifiant dans la réponse, nulle part', () => {
  assert.equal(liste.adresseDeLaCopie('/base/fiche/', { id: 'abc' }), '/base/fiche/?id=abc');
  assert.equal(liste.adresseDeLaCopie('/base/fiche/', { id: 'a b&c' }), '/base/fiche/?id=a%20b%26c', 'identifiant encodé');
  for (const copie of [null, undefined, {}, { id: '' }, { id: 5 }]) assert.equal(liste.adresseDeLaCopie('/fiche/', copie), null);
  assert.match(lire('../src/scripts/fiche.mjs'), /new URLSearchParams\(location\.search\)\.get\('id'\)/, 'la fiche lit ?id=');
});

test('R320 : un refus de copie dit que rien n’est copié, et distingue le service muet, la session, la porte du site de dev, le droit, la fiche absente, le refus', () => {
  const cas = [null, 401, 403, 404, 400, 500].map((statut) => [statut, null]).concat([[403, { acces: 'niveau' }], [400, { erreur: 'Seul un prétiré se copie.' }]]);
  for (const [nom, message] of [['liste', (s, c) => liste.messageDEchec('copie', s, c)], ['fiche', (s, c) => fiche.messageDeCopie(s, c)]]) {
    const messages = cas.map(([statut, corps]) => message(statut, corps));
    for (const m of messages) assert.ok(typeof m === 'string' && m.length > 0, nom);
    assert.equal(new Set(messages.slice(0, 6)).size, 6, `${nom} : un message par cas`);
    assert.notEqual(messages[6], messages[2], `${nom} : la porte du site de dev n’est pas un droit manquant`);
    assert.ok(messages[7].includes('Seul un prétiré se copie.'), `${nom} : la raison du service est dite`);
  }
  // la copie n'a pas le message d'un réglage de visibilité ou de rangement
  assert.notEqual(liste.messageDEchec('copie', 403), liste.messageDEchec('visibilite', 403));
  assert.notEqual(liste.messageDEchec('copie', 403), liste.messageDEchec('proprietaire', 403));
});

test('R320 : la porte du site de dev nomme le niveau que la réponse demande (niveau_requis), sans niveau si elle n’en dit pas ; les deux modules s’accordent', () => {
  const niveaux = { observateur: 'Observateur', joueur: 'Joueur', mj: 'MJ', createur: 'Créateur' };
  const corpsDeLaPorte = [{ acces: 'niveau' }, { acces: 'niveau', niveau_requis: 'roi' }, { acces: 'niveau', niveau_requis: 5 }, ...Object.keys(niveaux).map((niveau_requis) => ({ acces: 'niveau', niveau_requis }))];
  for (const corps of corpsDeLaPorte) {
    const m = liste.messageDEchec('copie', 403, corps);
    assert.equal(fiche.messageDeCopie(403, corps), m, JSON.stringify(corps));
    assert.equal(liste.phraseDeLaPorte(corps), fiche.phraseDeLaPorte(corps));
    const nommes = Object.values(niveaux).filter((n) => m.includes(n));
    assert.deepEqual(nommes, niveaux[corps.niveau_requis] ? [niveaux[corps.niveau_requis]] : [], JSON.stringify(corps));
  }
  assert.ok(!/seul le niveau Créateur/.test(liste.messageDEchec('copie', 403, { acces: 'niveau', niveau_requis: 'mj' })), 'la porte peut demander un autre niveau que Créateur');
});

test('R320 : sur /personnages/, le bouton est un réglage de ligne (sous le lien), grisé pendant l’appel, par la route copie du service', () => {
  const source = lire('../src/scripts/personnages.mjs');
  const code = sansCommentaires(source);
  assert.match(code, /function boutonCopier\(p\)/);
  // dans les réglages de la ligne, jamais dans le lien : `reglages(p)` l'ajoute au bloc `.perso-reglages`, `ligne(p)` n'y touche pas
  assert.match(code, /if \(peutCopier\(niveau, p\)\) bloc\.append\(boutonCopier\(p\)\)/);
  const ligne = code.slice(code.indexOf('function ligne(p)'), code.indexOf('const message = '));
  assert.ok(!ligne.includes('boutonCopier') && !ligne.includes('peutCopier'), 'la ligne (le lien) ne porte pas le bouton');
  const copier = code.slice(code.indexOf('function boutonCopier(p)'), code.indexOf('function reglages(p)'));
  assert.match(copier, /bouton\.disabled = true/, 'grisé pendant l’appel');
  assert.match(copier, /copie\/`, \{\}, 'POST'/, 'POST /api/personnages/<id>/copie/, corps {}');
  assert.match(copier, /adresseDeLaCopie\(racine\.dataset\.fiche/);
  assert.match(copier, /messageDEchec\('copie'/, 'un refus est dit');
  assert.match(code, /method: methode/, 'l’écriture partagée prend le verbe');
  assert.match(code, /'Content-Type': 'application\/json'/);
  // le niveau est celui de la session : aucune requête moi/ de plus (zone-menu)
  assert.ok(!/moi\//.test(code));
});

test('R320 : sur /fiche/, le bouton n’est montré que pour un prétiré enregistré et un compte Joueur, MJ ou Créateur ; il est grisé pendant l’appel', () => {
  const page = lire('../src/pages/fiche/index.astro');
  assert.match(page, /<button type="button" id="fiche-copier" hidden>/, 'caché au départ');
  const code = sansCommentaires(lire('../src/scripts/fiche.mjs'));
  assert.match(code, /import \{ adresseDeLaCopie, messageDeCopie, niveauDeLaSession, peutCopier \} from '\.\.\/lib\/fiche-copie\.mjs'/);
  assert.match(code, /boutonCopier\.hidden = !peutCopier\(niveauDeSession, id === null \? null : fiche\)/);
  assert.match(code, /boutonCopier\.disabled = copieEnCours \|\| modifie/, 'grisé pendant l’appel, et tant que la fiche à l’écran n’est pas enregistrée');
  const copier = code.slice(code.indexOf('async function copier()'), code.indexOf('function lireLeNiveau()'));
  assert.match(copier, /personnages\/\$\{encodeURIComponent\(id\)\}\/copie\/`, \{ method: 'POST'/);
  assert.match(copier, /body: '\{\}'/);
  assert.match(copier, /adresseDeLaCopie\(racine\.dataset\.fiche/);
  assert.match(copier, /messageDeCopie\(/);
  assert.ok(!/fetch\([^)]*moi\//.test(code), 'le niveau vient de la réponse que compte.mjs publie, sans requête');
  assert.ok(code.includes('window.maverickMoi') && code.includes("'maverick:moi'"));
});

test('R320 : version portable : le bouton exige un compte, et le compte n’y est pas ; chaque module reste propre à sa page', () => {
  // Base.astro ne pose ni Compte ni sa réponse dans la version portable : le niveau n'arrive jamais, le bouton reste caché
  assert.match(lire('../src/layouts/Base.astro'), /\{!portable && !maintenance && <Compte /);
  // deux scripts de page n'importent jamais le même module : la copie de la règle de la fiche n'est importée que par fiche.mjs, celle de la liste que par personnages.mjs
  const scripts = readdirSync(new URL('../src/scripts/', import.meta.url)).filter((f) => f.endsWith('.mjs'));
  const importeurs = (module) => scripts.filter((f) => new RegExp(`^import [^;]*from '[^']*lib/${module}\\.mjs'`, 'm').test(lire(`../src/scripts/${f}`)));
  assert.deepEqual(importeurs('fiche-copie'), ['fiche.mjs']);
  assert.deepEqual(importeurs('personnages-liste'), ['personnages.mjs']);
  // des modules purs : importés par le navigateur
  for (const module of ['fiche-copie', 'personnages-liste']) {
    assert.doesNotMatch(sansCommentaires(lire(`../src/lib/${module}.mjs`)), /\b(document|window|location|localStorage|fetch)\b\s*[.(]|from 'astro|import\.meta\.env/, module);
  }
  // fiche-copie.mjs n'importe rien (ni personnages-liste.mjs, qui ferait un module partagé)
  assert.deepEqual([...lire('../src/lib/fiche-copie.mjs').matchAll(/^import .*$/gm)], []);
});
