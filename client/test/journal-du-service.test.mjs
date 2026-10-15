// Le journal du service en mémoire (serveur/journal-du-service.mjs), lu par la page Debug du site de dev : sortie console inchangée, anneau borné,
// niveau et catégorie déduits des lignes que le service écrit déjà, filtres et curseur de la relève.
//   node --test test/journal-du-service.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { instant } from '../serveur/instant.mjs';
import {
  CATEGORIES, MESSAGE_MAX, NIVEAUX, categorieDuMessage, creerJournalDuService, estUneReleve, niveauDuMessage,
} from '../serveur/journal-du-service.mjs';

const MIDI = new Date('2026-10-15T12:34:56.789Z');

function journal(options = {}) {
  const lignes = [];
  let t = MIDI.getTime();
  const j = creerJournalDuService({ sortie: (l) => lignes.push(l), horloge: () => new Date((t += 1000)), ...options });
  return { j, lignes };
}

test('la sortie console reste la ligne horodatée de service.mjs#horodater ; l’entrée garde le même instant (format de serveur/instant.mjs)', () => {
  const lignes = [];
  const j = creerJournalDuService({ sortie: (l) => lignes.push(l), horloge: () => MIDI });
  const e = j.ecrire('base des règles changée');
  assert.deepEqual(lignes, [`${instant(MIDI)} base des règles changée`]);
  assert.equal(e.instant, instant(MIDI), 'ISO 8601 UTC à la seconde');
  assert.deepEqual(e, { n: 1, instant: '2026-10-15T12:34:56Z', niveau: 'info', categorie: 'base', message: 'base des règles changée' });
  // le service écrit aujourd'hui `${maintenant()} ${ligne}` : la même ligne
  assert.match(readFileSync(new URL('../serveur/service.mjs', import.meta.url), 'utf8'), /const horodater = \(ligne\) => `\$\{maintenant\(\)\} \$\{ligne\}`;/);
  // sans sortie : rien d'écrit, l'entrée est gardée
  const muet = creerJournalDuService({ sortie: null });
  assert.equal(muet.ecrire('x').n, 1);
  assert.equal(muet.lire().entrees.length, 1);
});

test('niveau et catégorie déduits des lignes que le service écrit déjà (service.mjs, api.mjs, notes-de-version.mjs)', () => {
  const cas = [
    ['service des personnages 0.3.1 : http://127.0.0.1:8787/api/ (règles x, base y) ; édition des règles OUVERTE (site de dev)', 'service', 'info'],
    ['nouvelle version du service livrée : arrêt pour relance', 'service', 'info'],
    ['base vivante faite pour les règles 0123456789ab (schéma 44) ; l’ancienne est archivée : a.db', 'base', 'info'],
    ['journal des modifications rejoué : 3 réappliquée(s), 1 déjà dans les règles, 0 en conflit', 'base', 'info'],
    ['journal des modifications rejoué : 3 réappliquée(s), 1 déjà dans les règles, 2 en conflit', 'base', 'avertissement'],
    ['fiches adaptées aux nouvelles règles : 2 (a, b) ; une note datée le rappelle dans chacune', 'fiches', 'info'],
    ['ERREUR base vivante : contrainte', 'base', 'erreur'],
    ['ERREUR ouverture de la base vivante : verrou', 'base', 'erreur'],
    ['base vivante absente : recréation', 'base', 'info'],
    ['base vivante remplacée : réouverture', 'base', 'info'],
    ['base des règles changée', 'base', 'info'],
    ['maintenance : annonce publiée (V0.3, envoi)', 'maintenance', 'info'],
    ['maintenance : annonce retirée', 'maintenance', 'info'],
    ['ERREUR maintenance : publication de l’annonce dans /m : EACCES', 'maintenance', 'erreur'],
    ['ERREUR maintenance : suivi du lancement : réseau', 'maintenance', 'erreur'],
    ['maintenance levée depuis la page (lot abc)', 'maintenance', 'info'],
    ['ERREUR GET /api/personnages/x/ : Error: boum\n    at traiter (api.mjs:1:1)', 'http', 'erreur'],
    ['suppression du prétiré elfe-1', 'fiches', 'info'],
    ['création du prétiré elfe-1', 'fiches', 'info'],
    ['modification du prétiré elfe-1', 'fiches', 'info'],
    ['édition : lot 12 (3 ligne(s)) depuis races/elfe ; 1 fiche(s) adaptée(s) (R42)', 'edition', 'info'],
    ['mise à jour : lot abc figé (4 modification(s), V0.3)', 'mise-a-jour', 'info'],
    ['simulation de mise à jour : lot abc figé (4 modification(s), V0.3)', 'mise-a-jour', 'info'],
    ['mise à jour (simulation) : workflow déclenché pour le lot abc', 'mise-a-jour', 'info'],
    ['mise à jour : lot abc annulé pendant l\'envoi ; run 12 annulé sur GitHub', 'mise-a-jour', 'info'],
    ['ERREUR mise à jour : déclenchement du workflow : 401', 'mise-a-jour', 'erreur'],
    ['GET /api/v1/metiers/ 200 12 ms', 'http', 'info'],
    ['PATCH /api/v1/metiers/forgeron/ 412 3 ms', 'http', 'avertissement'],
    ['DELETE /api/v1/dons-de-classe/x/ 500 8 ms', 'http', 'erreur'],
    ['ATTENTION : quelque chose', 'service', 'avertissement'],
    ['un message sans préfixe connu', 'service', 'info'],
  ];
  for (const [message, categorie, niveau] of cas) {
    assert.equal(categorieDuMessage(message), categorie, `catégorie : ${message}`);
    assert.equal(niveauDuMessage(message), niveau, `niveau : ${message}`);
  }
  for (const [, categorie, niveau] of cas) {
    assert.ok(CATEGORIES.includes(categorie));
    assert.ok(NIVEAUX.includes(niveau));
  }
});

test('les appels journal(…) écrits avant la page Debug sont tous rangés : « service » pour le démarrage et la relance seulement', () => {
  // garde-fou : une ligne sans préfixe connu tomberait dans « service » ; un début qui n'est que le préfixe de niveau (« ERREUR ${req.method}… ») est
  // rangé par la suite du message (la requête : « http »)
  const dossier = new URL('../serveur/', import.meta.url);
  const debuts = [];
  for (const nom of ['service.mjs', 'api.mjs', 'notes-de-version.mjs']) {
    const code = readFileSync(new URL(nom, dossier), 'utf8');
    for (const m of code.matchAll(/journal\??\.?\(\s*(?:\w+\s*\?\s*)?[`'"]([^`'"$]*)/g)) {
      if (m[1].replace(/^(ERREUR|ATTENTION|AVERTISSEMENT)\b/, '').trim()) debuts.push([nom, m[1]]);
    }
  }
  assert.ok(debuts.length >= 15, `appels trouvés : ${debuts.length}`);
  for (const [nom, debut] of debuts) {
    const categorie = categorieDuMessage(debut);
    if (/^(service des personnages|nouvelle version du service)/.test(debut)) assert.equal(categorie, 'service', `${nom} : ${debut}`);
    else assert.notEqual(categorie, 'service', `${nom} : « ${debut} » n'est rangé dans aucune catégorie (REGLES_DE_CATEGORIE)`);
  }
});

test('niveau et catégorie donnés par l’appelant l’emportent ; un niveau inconnu est déduit', () => {
  const { j } = journal();
  assert.deepEqual(
    (({ niveau, categorie }) => ({ niveau, categorie }))(j.ecrire('GET /api/v1/metiers/ 200 12 ms', { categorie: 'http' })),
    { niveau: 'info', categorie: 'http' },
  );
  assert.equal(j.ecrire('PATCH /api/v1/x/ 409 2 ms', { categorie: 'http' }).niveau, 'avertissement', 'statut 4xx');
  assert.equal(j.ecrire('rien', { niveau: 'erreur', categorie: 'autre' }).niveau, 'erreur');
  assert.equal(j.ecrire('rien', { niveau: 'grave' }).niveau, 'info', 'niveau inconnu : déduit');
  assert.equal(j.ecrire('ERREUR x', { categorie: '  ' }).categorie, 'service', 'catégorie vide : déduite');
  assert.deepEqual(j.categories(), ['service', 'http', 'autre'], 'celles de CATEGORIES dans leur ordre, puis les autres');
});

test('anneau borné : les plus anciennes sortent, comptées dans `perdues` ; la numérotation continue après `vider`', () => {
  const { j, lignes } = journal({ capacite: 3 });
  for (let i = 1; i <= 5; i++) j.ecrire(`message ${i}`);
  assert.equal(lignes.length, 5, 'la sortie a tout');
  const r = j.lire();
  assert.deepEqual(r.entrees.map((e) => e.n), [3, 4, 5]);
  assert.equal(r.dernier, 5);
  assert.equal(r.capacite, 3);
  assert.equal(r.perdues, 2);
  j.vider();
  const { processus, ...reste } = j.lire();
  assert.deepEqual(reste, { entrees: [], dernier: 5, capacite: 3, perdues: 5 });
  assert.equal(processus, r.processus, 'vider ne change pas l’identité du journal');
  assert.equal(j.ecrire('après').n, 6);
  assert.deepEqual(j.lire({ depuis: 5 }).entrees.map((e) => e.message), ['après']);
});

test('lire : curseur `depuis`, filtres (une valeur, « a,b » ou un tableau), texte sans accents ni majuscules, `limite` = les plus récentes', () => {
  const { j } = journal();
  j.ecrire('service des personnages 1 : http://x/api/');
  j.ecrire('GET /api/v1/metiers/ 200 12 ms', { categorie: 'http' });
  j.ecrire('ERREUR base vivante : verrou');
  j.ecrire('édition : lot 1 (1 ligne(s)) depuis metiers');
  j.ecrire('DELETE /api/v1/metiers/x/ 404 1 ms', { categorie: 'http' });
  const n = (o) => j.lire(o).entrees.map((e) => e.n);
  assert.deepEqual(n(), [1, 2, 3, 4, 5]);
  assert.deepEqual(n({ depuis: 3 }), [4, 5]);
  assert.deepEqual(n({ depuis: '3' }), [4, 5], 'paramètre d’adresse');
  assert.deepEqual(n({ depuis: 'n’importe quoi' }), [1, 2, 3, 4, 5]);
  assert.deepEqual(n({ niveau: 'erreur' }), [3]);
  assert.deepEqual(n({ niveau: 'erreur,avertissement' }), [3, 5]);
  assert.deepEqual(n({ niveau: ['info'] }), [1, 2, 4]);
  assert.deepEqual(n({ niveau: '' }), [1, 2, 3, 4, 5], 'filtre vide : tout');
  assert.deepEqual(n({ categorie: 'http' }), [2, 5]);
  assert.deepEqual(n({ categorie: 'http', niveau: 'avertissement' }), [5]);
  assert.deepEqual(n({ q: 'EDITION' }), [4], 'sans accents ni majuscules');
  assert.deepEqual(n({ q: 'metiers' }), [2, 4, 5]);
  assert.deepEqual(n({ q: 'http' }), [1, 2, 5], 'dans la catégorie aussi');
  assert.deepEqual(n({ limite: 2 }), [4, 5], 'les plus récentes, dans l’ordre');
  assert.deepEqual(n({ limite: '0' }), [1, 2, 3, 4, 5], 'limite nulle : la capacité');
  assert.equal(j.lire({ niveau: 'erreur' }).dernier, 5, 'le curseur suit la dernière écriture, filtres ou non');
  // une entrée rendue est une copie
  j.lire().entrees[0].message = 'changé';
  assert.equal(j.lire().entrees[0].message, 'service des personnages 1 : http://x/api/');
});

test('les relèves réussies du journal, de la version de la base et de la maintenance ne sont notées nulle part ; leurs échecs, si', () => {
  const { j, lignes } = journal();
  assert.equal(estUneReleve('GET /api/debug/journal/?depuis=12 200 1 ms'), true);
  assert.equal(estUneReleve('GET /api/debug/journal/ 200 1 ms'), true);
  assert.equal(estUneReleve('GET /MaverickCenter/api/maintenance/ 304 0 ms'), true);
  assert.equal(estUneReleve('GET /api/debug/journal/ 403 1 ms'), false);
  // la version de la base (menu « DB » de la page Debug, toutes les 2 s) ; pas le contenu d'une table (relu quand elle change)
  assert.equal(estUneReleve('GET /api/debug/base/ 200 0 ms'), true);
  assert.equal(estUneReleve('GET /api/debug/base/ 503 1 ms'), false);
  assert.equal(estUneReleve('GET /api/debug/tables/metier/?limite=100 200 3 ms'), false);
  assert.equal(estUneReleve('GET /api/debug/tables/metier/ 304 1 ms'), false);
  assert.equal(estUneReleve('POST /api/maintenance/lever/ 200 4 ms'), false);
  assert.equal(estUneReleve('GET /api/etat/ 200 1 ms'), false);
  // seul le chemin compte : une chaîne de requête qui finit par l'adresse d'une relève ne cache pas une autre requête (ni en mémoire ni sur la sortie)
  assert.equal(estUneReleve('GET /api/v1/metiers/?q=/api/maintenance/ 200 1 ms'), false);
  assert.equal(estUneReleve('GET /api/v1/openapi.json?/api/debug/journal/ 200 1 ms'), false);
  assert.equal(estUneReleve('GET /api/personnages/abc/?/api/maintenance/ 200 2 ms'), false);
  assert.equal(estUneReleve('GET /api/maintenance/?x=/a 200 1 ms'), true, 'la vraie relève garde sa chaîne de requête');
  assert.equal(j.ecrire('GET /api/debug/journal/?depuis=3 200 1 ms', { categorie: 'http' }), null);
  assert.equal(j.ecrire('GET /api/maintenance/ 200 1 ms', { categorie: 'http' }), null);
  assert.equal(j.ecrire('GET /api/debug/base/ 200 0 ms', { categorie: 'http' }), null);
  assert.equal(j.ecrire('GET /api/debug/journal/ 403 1 ms', { categorie: 'http' }).niveau, 'avertissement');
  assert.equal(j.ecrire('GET /api/v1/metiers/?q=/api/maintenance/ 200 1 ms', { categorie: 'http' }).n, 2, 'notée');
  assert.equal(lignes.length, 2);
  assert.equal(j.lire().dernier, 2, 'pas de numéro pris par les relèves');
});

test('un message très long est coupé en mémoire, pas sur la sortie', () => {
  const { j, lignes } = journal();
  const long = 'x'.repeat(MESSAGE_MAX + 10);
  const e = j.ecrire(long);
  assert.ok(lignes[0].endsWith(long));
  assert.ok(e.message.startsWith('x'.repeat(MESSAGE_MAX)));
  assert.match(e.message, /… \(10 caractères de plus sur la sortie du service\)$/);
  assert.equal(j.ecrire(undefined).message, '', 'rien : un message vide');
});

test('le module n’importe rien (le service le charge tel quel, sans paquet)', () => {
  const code = readFileSync(new URL('../serveur/journal-du-service.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /^\s*import\s/m);
  assert.doesNotMatch(code, /\bimport\(/);
});

test('identité du journal : la même à chaque lecture, une autre pour un autre journal (un redémarrage du service), donnée ou tirée au hasard', () => {
  const a = creerJournalDuService({ sortie: null });
  const b = creerJournalDuService({ sortie: null });
  assert.equal(typeof a.lire().processus, 'string');
  assert.ok(a.lire().processus.length >= 8);
  assert.equal(a.lire().processus, a.lire({ depuis: 3, niveau: 'erreur' }).processus);
  assert.notEqual(a.lire().processus, b.lire().processus);
  assert.equal(creerJournalDuService({ sortie: null, processus: 'essai' }).lire().processus, 'essai');
});
