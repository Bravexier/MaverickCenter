// R322 : « nouvelle fiche de joueur », côté page. Le « + » de « Mes personnages » (/personnages/) mène à /fiche/?nouvelle=joueur ; le générateur s'ouvre
// vierge, et le premier « Enregistrer » crée la fiche au compte (POST /api/personnages/?nature=joueur), puis la page bascule sur ?id=<id> (PUT ensuite).
// La règle du « + » est celle de « Copier le prétiré » (R320, Joueur, MJ, Créateur) : le test épingle l'accord des deux modules. Le service est testé à part
// (test/serveur-fiche-neuve-au-compte.test.mjs). Aucun texte de page n'est lu : les messages ne sont épinglés que par leur fonctionnement.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import * as liste from '../src/lib/personnages-liste.mjs';
import * as fiche from '../src/lib/fiche-copie.mjs';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const sansCommentaires = (texte) => texte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const NIVEAUX = ['observateur', 'joueur', 'mj', 'createur', null, undefined, 'roi', ''];

test('R322 : le « + » est proposé à Joueur, MJ et Créateur seulement, jamais à un Observateur, à un visiteur ni tant que le niveau est inconnu', () => {
  for (const niveau of ['joueur', 'mj', 'createur']) assert.equal(liste.peutCreerUneFiche(niveau), true, niveau);
  for (const niveau of ['observateur', null, undefined, 'roi', '']) assert.equal(liste.peutCreerUneFiche(niveau), false, String(niveau));
});

test('R322 : le « + » suit exactement la règle de « Copier le prétiré » (peutCopier, NIVEAUX_QUI_COPIENT), sur la liste comme sur la fiche', () => {
  const unPretire = { nature: 'pretire' };
  for (const niveau of NIVEAUX) {
    assert.equal(liste.peutCreerUneFiche(niveau), liste.peutCopier(niveau, unPretire), `liste : ${String(niveau)}`);
    assert.equal(fiche.peutCreerUneFiche(niveau), fiche.peutCopier(niveau, unPretire), `fiche : ${String(niveau)}`);
    assert.equal(fiche.peutCreerUneFiche(niveau), liste.peutCreerUneFiche(niveau), `accord : ${String(niveau)}`);
  }
  assert.deepEqual([...fiche.NIVEAUX_QUI_COPIENT], [...liste.NIVEAUX_QUI_COPIENT]);
  // la liste ne duplique pas la règle : elle lit la constante de la copie
  assert.match(sansCommentaires(lire('../src/lib/personnages-liste.mjs')), /peutCreerUneFiche = \(niveau\) => NIVEAUX_QUI_COPIENT\.includes\(niveau\)/);
});

test('R322 : le « + » mène à /fiche/?nouvelle=joueur, et la fiche reconnaît cette adresse comme le mode « nouvelle fiche de joueur »', () => {
  const adresse = liste.adresseDeLaNouvelleFiche('/base/fiche/');
  assert.equal(adresse, '/base/fiche/?nouvelle=joueur');
  assert.equal(fiche.nouvelleFicheDemandee(new URL(adresse, 'https://exemple.test').search), 'joueur');
  for (const recherche of ['', '?', '?nouvelle=pretire', '?nouvelle=', '?nouvelle', '?id=abc', '?id=abc&nouvelle=joueur', null, undefined]) {
    assert.equal(fiche.nouvelleFicheDemandee(recherche), null, String(recherche));
  }
  assert.equal(fiche.nouvelleFicheDemandee('?x=1&nouvelle=joueur'), 'joueur');
  assert.equal(fiche.nouvelleFicheDemandee('?id=&nouvelle=joueur'), 'joueur', 'un ?id= vide n’ouvre aucune fiche : le mode reste');
});

test('R322 : le premier « Enregistrer » est un POST ?nature=joueur, les suivants des PUT sur la fiche créée ; sans le mode, la création d’un prétiré est inchangée', () => {
  assert.deepEqual(fiche.requeteDEnregistrement('/api/', null, 'joueur'), { methode: 'POST', adresse: '/api/personnages/?nature=joueur' });
  assert.deepEqual(fiche.requeteDEnregistrement('/api/', null, null), { methode: 'POST', adresse: '/api/personnages/' }, 'prétiré : sans paramètre');
  assert.deepEqual(fiche.requeteDEnregistrement('/api/', null), { methode: 'POST', adresse: '/api/personnages/' });
  // une fois la fiche créée (id connu), le mode ne change plus rien : PUT sur ?id=
  assert.deepEqual(fiche.requeteDEnregistrement('/api/', 'abc', 'joueur'), { methode: 'PUT', adresse: '/api/personnages/abc/' });
  assert.deepEqual(fiche.requeteDEnregistrement('/api/', 'a b/c', null), { methode: 'PUT', adresse: '/api/personnages/a%20b%2Fc/' }, 'identifiant encodé');
});

test('R322 : un refus de création (401, 403) dit que la fiche n’est pas créée et que la saisie reste ; la porte du site de dev nomme le niveau requis ; les autres statuts ne sont pas pris', () => {
  const porte = { acces: 'niveau', niveau_requis: 'createur' };
  const messages = [fiche.messageDeNouvelleFiche(401), fiche.messageDeNouvelleFiche(403, porte), fiche.messageDeNouvelleFiche(403, { erreur: 'Droit manquant.' }), fiche.messageDeNouvelleFiche(403)];
  for (const m of messages) assert.ok(typeof m === 'string' && m.length > 0);
  assert.equal(new Set(messages).size, messages.length, 'un message par cas');
  assert.ok(messages[1].includes(fiche.phraseDeLaPorte(porte)), 'la porte : la phrase partagée avec la copie');
  assert.ok(messages[2].includes('Droit manquant.'), 'la raison du service est dite');
  for (const statut of [200, 201, 400, 404, 409, 413, 500, null, undefined]) assert.equal(fiche.messageDeNouvelleFiche(statut, porte), null, String(statut));
});

test('R322 : à l’ouverture, seul un niveau connu qui ne peut pas créer reçoit l’avis ; un niveau inconnu n’en reçoit pas (le service reste juge)', () => {
  for (const niveau of ['joueur', 'mj', 'createur', null, undefined]) assert.equal(fiche.avisDeNouvelleFiche(niveau), null, String(niveau));
  for (const niveau of ['observateur', 'roi', '']) assert.ok(fiche.avisDeNouvelleFiche(niveau)?.length > 0, niveau);
});

test('R322 : /personnages/ : le « + » est un lien caché au départ, adresse posée par la liste, montré par le niveau, sans requête ; chaque module reste propre à sa page', () => {
  const page = lire('../src/pages/personnages.astro');
  const plus = page.match(/<a class="personnages-nouvelle" id="nouvelle-fiche"[^>]*>/)?.[0];
  assert.ok(plus, 'le lien');
  assert.match(plus, /\shidden(\s|>)/, 'caché au départ : sans niveau connu (version portable : jamais), pas de « + »');
  assert.match(plus, /aria-label="[^"]+"/);
  assert.match(plus, /title="[^"]+"/);
  assert.ok(page.indexOf('id="nouvelle-fiche"') > page.indexOf('id="lignes-mes"') && page.indexOf('id="nouvelle-fiche"') < page.indexOf('id="pretires"'), 'en bas de « Mes personnages »');
  const code = sansCommentaires(lire('../src/scripts/personnages.mjs'));
  assert.match(code, /nouvelle\.href = adresseDeLaNouvelleFiche\(racine\.dataset\.fiche\)/);
  assert.match(code, /nouvelle\.hidden = !peutCreerUneFiche\(niveau\)/);
  assert.ok(!/nouvelle-fiche[^\n]*(fetch|ecrire)\(/.test(code), 'le « + » ne crée rien lui-même : un lien');
  // le niveau est celui que compte.mjs publie ; les deux modules ne sont importés que par leur page (version portable : pas de module partagé)
  const scripts = readdirSync(new URL('../src/scripts/', import.meta.url)).filter((f) => f.endsWith('.mjs'));
  const importeurs = (module) => scripts.filter((f) => new RegExp(`^import [^;]*from '[^']*lib/${module}\\.mjs'`, 'm').test(lire(`../src/scripts/${f}`)));
  assert.deepEqual(importeurs('fiche-copie'), ['fiche.mjs']);
  assert.deepEqual(importeurs('personnages-liste'), ['personnages.mjs']);
  assert.deepEqual([...lire('../src/lib/fiche-copie.mjs').matchAll(/^import .*$/gm)], [], 'fiche-copie.mjs n’importe rien');
  assert.match(lire('../src/layouts/Base.astro'), /\{!portable && !maintenance && <Compte /, 'version portable : pas de compte, donc jamais de niveau, donc pas de « + »');
});

test('R322 : /fiche/ : le mode vient de l’adresse, le premier enregistrement est un POST ?nature=joueur puis ?id= et des PUT ; un refus garde la saisie ; « Nouveau » reste en mode fiche de joueur', () => {
  const code = sansCommentaires(lire('../src/scripts/fiche.mjs'));
  assert.match(code, /nouvelleFiche = nouvelleFicheDemandee\(location\.search\)/);
  const enregistrer = code.slice(code.indexOf('async function enregistrer()'), code.indexOf('async function charger('));
  assert.match(enregistrer, /requeteDEnregistrement\(API, id, nouvelleFiche\)/, 'adresse et verbe : un seul endroit');
  assert.match(enregistrer, /method: methode/);
  assert.ok(!/personnages\/\$\{encodeURIComponent\(id\)\}/.test(enregistrer), 'l’adresse n’est plus bâtie à la main');
  // la bascule : le mode s'éteint dès que l'id est connu, et l'adresse devient ?id=<id>
  assert.match(enregistrer, /appliquer\(donnees\);\s*nouvelleFiche = null;\s*history\.replaceState\(null, '', `\?id=\$\{encodeURIComponent\(id\)\}`\)/);
  // un refus : le message dit, la saisie reste (rien n'appelle appliquer ni ne réinitialise la fiche dans cette branche)
  const branche = enregistrer.slice(enregistrer.indexOf('nouvelleFiche && messageDeNouvelleFiche'), enregistrer.indexOf('else if (donnees.erreur)'));
  assert.match(branche, /message\(messageDeNouvelleFiche\(reponse\.status, donnees\), 'erreur'\)/);
  assert.ok(!/appliquer\(|ficheVide|fiche = /.test(branche), 'la saisie n’est pas perdue');
  assert.match(enregistrer, /enregistrementRefuse = true/, 'Télécharger reste possible après un refus');
  const nouvelle = code.slice(code.indexOf('function nouvelle()'), code.indexOf('// ----', code.indexOf('function nouvelle()')));
  assert.match(nouvelle, /nouvelleFiche = modeDeLaFicheVierge\(nouvelleFiche, fiche\);[^]*fiche = ficheVide\(''\)/, 'le mode est décidé avant que la fiche à l’écran soit remplacée');
  assert.match(nouvelle, /replaceState\(null, '', adresseDeLaFicheVierge\(racine\.dataset\.fiche, nouvelleFiche\)\)/);
  assert.ok(!/nouvelleFiche = null/.test(nouvelle), '« Nouveau » ne retombe jamais d’office sur un prétiré');
  assert.match(code, /import \{[^}]*\bnouvelleFicheDemandee\b[^}]*\} from '\.\.\/lib\/fiche-copie\.mjs'/);
  // le niveau : celui que compte.mjs publie, aucune requête moi/
  assert.ok(!/fetch\([^)]*moi\//.test(code));
});

test('R322 : « Nouveau » garde le mode fiche de joueur (mode en cours, ou fiche à l’écran de nature joueur) et son adresse ; le flux du prétiré est inchangé', () => {
  assert.equal(fiche.modeDeLaFicheVierge('joueur', null), 'joueur', 'avant le premier enregistrement');
  assert.equal(fiche.modeDeLaFicheVierge(null, { nature: 'joueur' }), 'joueur', 'après un enregistrement depuis le « + », ou ?id= d’une fiche de joueur');
  assert.equal(fiche.modeDeLaFicheVierge('joueur', { nature: 'pretire' }), 'joueur');
  for (const [mode, f] of [[null, null], [null, undefined], [null, {}], [null, { nature: 'pretire' }], [undefined, { nature: 'autre' }], ['pretire', null]]) {
    assert.equal(fiche.modeDeLaFicheVierge(mode, f), null, JSON.stringify([mode, f]));
  }
  assert.equal(fiche.adresseDeLaFicheVierge('/base/fiche/', 'joueur'), '/base/fiche/?nouvelle=joueur');
  assert.equal(fiche.adresseDeLaFicheVierge('/base/fiche/', null), '/base/fiche/');
  // l'adresse est relue comme mode, puis le premier enregistrement est le POST ?nature=joueur
  const mode = fiche.nouvelleFicheDemandee(new URL(fiche.adresseDeLaFicheVierge('/fiche/', 'joueur'), 'https://exemple.test').search);
  assert.deepEqual(fiche.requeteDEnregistrement('/api/', null, mode), { methode: 'POST', adresse: '/api/personnages/?nature=joueur' });
  assert.deepEqual(fiche.requeteDEnregistrement('/api/', null, fiche.modeDeLaFicheVierge(null, { nature: 'pretire' })), { methode: 'POST', adresse: '/api/personnages/' });
});

test('R322 : l’import d’un classeur (choix « créer ») se comporte comme « Nouveau » : le mode fiche de joueur est gardé, le message et le choix ne parlent pas d’un prétiré', () => {
  const code = sansCommentaires(lire('../src/scripts/fiche.mjs'));
  const remplacer = code.slice(code.indexOf('function remplacerLaFiche('), code.indexOf('async function importerClasseur('));
  assert.match(remplacer, /if \(cible === 'creer'\) nouvelleFiche = modeDeLaFicheVierge\(nouvelleFiche, fiche\);[^]*fiche = \{/, 'le mode est lu avant que la fiche soit remplacée');
  assert.match(remplacer, /replaceState\(null, '', adresseDeLaFicheVierge\(racine\.dataset\.fiche, nouvelleFiche\)\)/);
  assert.ok(!/replaceState\(null, '', racine\.dataset\.fiche\)/.test(remplacer), 'jamais l’adresse sans le mode');
  assert.match(code, /suiteDeLImport\(cible, nom, nouvelleFiche\)/);
  assert.match(code, /import-cible-creer'\)\.textContent = libelleDuChoixCreer\(modeDeLaFicheVierge\(nouvelleFiche, fiche\)\)/);
  // le message : mettre à jour dit le nom ; créer ne dit « prétiré » qu'hors du mode fiche de joueur
  assert.ok(fiche.suiteDeLImport('mettre-a-jour', 'Zed').includes('Zed'));
  assert.ok(fiche.suiteDeLImport('creer', 'Zed', null).includes('prétiré'));
  assert.ok(!fiche.suiteDeLImport('creer', 'Zed', 'joueur').includes('prétiré'));
  assert.ok(!fiche.libelleDuChoixCreer('joueur').includes('prétiré'));
  assert.ok(fiche.libelleDuChoixCreer(null).includes('prétiré'));
  // l'état suit : après import « créer », en mode joueur le premier enregistrement est le POST ?nature=joueur
  assert.deepEqual(fiche.requeteDEnregistrement('/api/', null, fiche.modeDeLaFicheVierge('joueur', { nature: 'pretire' })), { methode: 'POST', adresse: '/api/personnages/?nature=joueur' });
});
