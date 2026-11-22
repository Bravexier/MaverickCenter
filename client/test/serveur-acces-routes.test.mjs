// Classement des routes du service pour l'accès au site de dev (client/serveur/acces-routes.mjs, api.mjs ; docs/serveur.md, « Accès au site de dev » ; R275,
// question 2, option b) : chaque route d'api.mjs est classée (ouverte, lecture avec clé, écriture avec mot de passe) — une route nouvelle non classée fait
// échouer ce test —, la lecture reste libre pour les pages, aucune route ouverte ne montre une fiche de joueur, un compte ou un groupe, et sans réglage
// tout se comporte comme avant. Le service HTTP réel pose le cookie de session et ne note rien de secret.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ENTETE_CLE, COOKIE, creerAcces, reglageApres } from '../serveur/acces.mjs';
import { CLASSES, PORTEES, ROUTES_CLASSEES, classer, cheminSansFin } from '../serveur/acces-routes.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MOT = 'un mot de passe d’essai';
const JSON_ = { 'content-type': 'application/json' };
const UUID = '00000000-0000-4000-8000-000000000000';
const SOURCE_API = readFileSync(new URL('../serveur/api.mjs', import.meta.url), 'utf8');
const ENTETE_API = SOURCE_API.split('\n').filter((l) => l.startsWith('//')).join('\n');

/** Les routes de l'en-tête d'api.mjs (méthode, adresse d'exemple), plus les adresses de /api/v1/ que sa ligne multiple range sous « … ». */
function routesDeLEntete() {
  const exemple = (c) => c.replace(/\/lots\/<id>/, `/lots/${UUID}`).replace('<n>', '1').replace('<id>', 'essai').replace('<nom>', 'personnage');
  const lues = [...ENTETE_API.matchAll(/^\/\/\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/\S*?\/)(?=[\s,]|$)/gm)].map(([, m, c]) => [m, exemple(c)]);
  const v1 = ['/api/v1/openapi.json', '/api/v1/metiers/', '/api/v1/metiers/essai/', '/api/v1/metiers/essai/enfant/', '/api/v1/metiers/essai/enfant/x/'];
  return [...lues, ...v1.map((c) => ['GET', c]), ...['POST', 'PATCH', 'PUT', 'DELETE'].flatMap((m) => v1.slice(1).map((c) => [m, c]))];
}

test('chaque route de l’en-tête d’api.mjs est classée ; une route nouvelle non classée fait échouer ce test (fermée par défaut : mot de passe)', () => {
  const routes = routesDeLEntete();
  assert.ok(routes.length >= 50, `${routes.length} routes lues`);
  for (const [m, c] of routes) {
    const r = classer(m, c);
    assert.ok(r.connue, `${m} ${c} : non classée (serveur/acces-routes.mjs)`);
    assert.ok(CLASSES.includes(r.classe), `${m} ${c}`);
  }
  // ce que la table ne nomme pas est fermé, jamais ouvert
  for (const [m, c] of [['GET', '/api/nouvelle-route/'], ['POST', '/api/etat/'], ['GET', '/api/edition/inconnue/'], ['GET', '/api/debug/tables/a/b/'], ['PUT', '/api/etat/'], ['HEAD', '/api/etat/']]) {
    const r = classer(m, c);
    assert.deepEqual([r.classe, r.connue], ['ecriture', false], `${m} ${c}`);
  }
});

test('chaque ressource et chaque action que traiter aiguille est dans la table (même si l’en-tête ne la liste pas)', () => {
  const ressources = new Set([...SOURCE_API.matchAll(/ressource (?:===|!==) '([a-z0-9-]+)'/g)].map((m) => m[1]));
  assert.ok(ressources.size >= 10, [...ressources].join());
  for (const nom of ressources) assert.ok(ROUTES_CLASSEES.some((r) => r.motif.source.startsWith(`^\\/api\\/${nom}`)), `/api/${nom}/ : aucune route classée`);
  // les actions de l'édition, de la mise à jour et de Debug, lues dans le code de leur aiguillage
  const liste = (debut) => [...SOURCE_API.slice(SOURCE_API.indexOf(debut)).match(/\[([^\]]+)\]/)[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  const actions = {
    '/api/edition/': [...liste("['en-attente'"), 'extrait', 'lots'], // `extrait` et `lots` sont aiguillés avant la liste (traiterExtrait, traiterLots)
    '/api/mise-a-jour/': liste("[undefined, 'brouillon'"),
    '/api/debug/': [...SOURCE_API.slice(SOURCE_API.indexOf('function traiterDebug'), SOURCE_API.indexOf('\nfunction ', SOURCE_API.indexOf('function traiterDebug') + 10)).matchAll(/action === '([a-z]+)'/g)].map((m) => m[1]),
  };
  for (const [prefixe, noms] of Object.entries(actions)) {
    assert.ok(noms.length >= 5, `${prefixe} : ${noms.join()}`);
    for (const a of new Set(noms)) assert.ok(['GET', 'POST'].some((m) => classer(m, `${prefixe}${a}/`).connue), `${prefixe}${a}/ : non classée`);
  }
});

test('le classement : lecture libre pour les pages, lecture avec clé pour le journal, la page Debug (fiches, comptes et groupes compris) et /api/v1/, toute écriture avec le mot de passe (R275)', () => {
  const attendu = {
    ouverte: [
      ['GET', '/api/etat/'], ['GET', '/api/maintenance/'], ['GET', '/api/tipeee/'], ['POST', '/api/classeur/'], ['POST', '/api/metriques/page/'],
      ['GET', '/api/personnages/'], ['GET', '/api/personnages/essai/'], ['GET', '/api/personnages/essai/portrait/'],
      ['GET', '/api/edition/en-attente/'], ['GET', '/api/edition/listes/'], ['GET', '/api/edition/pages/'], ['GET', '/api/edition/mots-cles/'],
      ['GET', '/api/edition/chronologie/'], ['GET', '/api/edition/plan/'],
      ['POST', '/api/edition/lignes/'], ['POST', '/api/edition/race/'], ['POST', '/api/edition/classe/'], ['POST', '/api/edition/bestiaire/'],
      ['POST', '/api/edition/portrait/'], ['POST', '/api/edition/evenement/'],
      ['GET', '/api/mise-a-jour/'], ['GET', '/api/mise-a-jour/lancement/'],
      ['GET', `/api/mise-a-jour/lots/${UUID}/`], ['GET', '/api/acces/'], ['POST', '/api/acces/'], ['DELETE', '/api/acces/'], ['GET', '/api/acces/verifier/'],
    ],
    lecture: [
      ['GET', '/api/edition/journal/'], ['GET', '/api/edition/extrait/'], ['GET', '/api/edition/extrait/meta/'], ['GET', '/api/mise-a-jour/conflits/'],
      ['GET', '/api/debug/journal/'], ['GET', '/api/debug/metriques/'], ['GET', '/api/debug/metriques/requetes/'], ['GET', '/api/debug/metriques/export/'],
      ['GET', '/api/debug/systeme/'], ['GET', '/api/debug/base/'], ['GET', '/api/debug/structure/'], ['GET', '/api/debug/atelier/'], ['GET', '/api/debug/tables/'], ['GET', '/api/debug/tables/personnage/'],
      ['GET', '/api/debug/tables/utilisateur/'], ['GET', '/api/debug/tables/groupe/'],
      ['GET', '/api/v1/'], ['GET', '/api/v1/openapi.json'], ['GET', '/api/v1/metiers/'], ['GET', '/api/v1/metiers/essai/'],
      ['GET', '/api/edition/lots/'], ['GET', `/api/edition/lots/${UUID}/`], ['GET', '/api/edition/lots/ancrage/'],
      ['GET', `/api/edition/lots/${UUID}/annulation/`], // l'aperçu de l'annulation d'un lot : calculé sur une copie, rien n'est écrit
    ],
    // lots de changements : une session dépose, refait l'essai et dépose « tout recalculer » avec la clé de lecture (elle n'écrit que `lot_de_changements`, jamais le contenu)
    proposition: [['POST', '/api/edition/lots/'], ['POST', `/api/edition/lots/${UUID}/essai/`], ['POST', '/api/edition/lots/recalcul/'], ['POST', '/api/edition/lots/ancrage/']],
    ecriture: [
      ['POST', '/api/edition/'], ['POST', '/api/maintenance/lever/'],
      ['POST', '/api/edition/atelier/'], // « le bouton » de l'atelier : l'extrait refait tout de suite (le mot de passe seul)
      ['POST', `/api/edition/lots/${UUID}/appliquer/`], ['POST', `/api/edition/lots/${UUID}/refuser/`], ['POST', `/api/edition/lots/${UUID}/annuler/`],
      ['POST', '/api/mise-a-jour/brouillon/'], ['POST', '/api/mise-a-jour/majeure/'], ['POST', '/api/mise-a-jour/lancer/'], ['POST', '/api/mise-a-jour/liberer/'],
      ['POST', '/api/mise-a-jour/conflits/'], ['POST', '/api/mise-a-jour/copier/'], // « Copier vers le dépôt » (lot 8, base source)
      ['POST', '/api/personnages/'], ['PUT', '/api/personnages/essai/'], ['DELETE', '/api/personnages/essai/'],
      ['POST', '/api/v1/metiers/'], ['PATCH', '/api/v1/metiers/essai/'], ['DELETE', '/api/v1/metiers/essai/'],
    ],
  };
  for (const [classe, routes] of Object.entries(attendu)) {
    for (const [m, c] of routes) {
      assert.equal(classer(m, c).classe, classe, `${m} ${c}`);
      assert.equal(classer(m, c.replace(/\/$/, '')).classe, classe, `${m} ${c} (sans « / » finale)`);
      assert.equal(classer(m, `${c}?q=1`).classe, classe, `${m} ${c}?q=1`);
    }
  }
  assert.equal(cheminSansFin('/api/etat/?a=/b/'), '/api/etat');
});

test('toute méthode d’écriture d’une route connue est « ecriture », sauf la liste des POST qui ne font que lire (les pages en ont besoin sans connexion)', () => {
  const PROPOSITIONS = new Set(['/api/edition/lots', `/api/edition/lots/${UUID}/essai`, '/api/edition/lots/recalcul', '/api/edition/lots/ancrage']); // elles n'écrivent que la proposition et son essai
  const POST_QUI_LISENT = new Set(['/api/classeur', '/api/metriques/page', '/api/acces',
    '/api/edition/lignes', '/api/edition/race', '/api/edition/classe', '/api/edition/bestiaire', '/api/edition/portrait', '/api/edition/evenement']);
  for (const [m, c] of routesDeLEntete().filter(([m]) => m !== 'GET')) {
    const attendu = POST_QUI_LISENT.has(cheminSansFin(c)) || (m === 'DELETE' && cheminSansFin(c) === '/api/acces') ? 'ouverte' : PROPOSITIONS.has(cheminSansFin(c)) ? 'proposition' : 'ecriture';
    assert.equal(classer(m, c).classe, attendu, `${m} ${c}`);
  }
});

test('aucune route ouverte ne passe par la lecture d’une table : Debug, /api/v1/, journal, lots en conflit demandent la clé ou le mot de passe', () => {
  for (const r of ROUTES_CLASSEES.filter((x) => x.classe === 'ouverte')) {
    for (const interdit of ['/api/debug/', '/api/v1', '/api/edition/journal', '/api/edition/extrait', '/api/mise-a-jour/conflits']) {
      assert.ok(!r.motif.test(interdit) && !r.motif.test(`${interdit}/x`), `${r.motif} ouvre ${interdit}`);
    }
  }
});

test('portée « tout » (option c) : la même table, toute route ouverte non indispensable passe en lecture ; restent ouvertes la connexion et le lot figé que GitHub télécharge', () => {
  assert.deepEqual([...PORTEES], ['ecriture', 'tout']);
  const ouvertes = ROUTES_CLASSEES.filter((r) => r.classe === 'ouverte');
  assert.ok(ouvertes.some((r) => !r.essentielle) && ouvertes.some((r) => r.essentielle));
  assert.equal(classer('GET', '/api/etat/', 'tout').classe, 'lecture');
  assert.equal(classer('GET', '/api/personnages/', 'tout').classe, 'lecture');
  assert.equal(classer('POST', '/api/edition/lignes/', 'tout').classe, 'lecture');
  assert.equal(classer('POST', '/api/classeur/', 'tout').classe, 'lecture');
  assert.equal(classer('GET', `/api/mise-a-jour/lots/${UUID}/`, 'tout').classe, 'ouverte');
  for (const c of ['/api/acces/', '/api/acces/verifier/']) assert.equal(classer('GET', c, 'tout').classe, 'ouverte');
  assert.equal(classer('POST', '/api/acces/', 'tout').classe, 'ouverte');
  assert.equal(classer('POST', '/api/edition/', 'tout').classe, 'ecriture');
  assert.equal(classer('GET', '/api/v1/', 'tout').classe, 'lecture');
  // une route que la table ne connaît pas reste fermée
  assert.equal(classer('GET', '/api/inconnue/', 'tout').classe, 'ecriture');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// traiter : la porte
// ---------------------------------------------------------------------------------------------------------------------------------------------

const racine = dossierTemporaire('acces-routes');
function monde(portee = null, extra = {}) {
  const fichier = fichierTemporaire('acces.json', 'acces-routes');
  const { reglage, cle } = reglageApres({ motDePasse: MOT, portee });
  writeFileSync(fichier, JSON.stringify(reglage));
  const journal = [];
  const acces = creerAcces({ fichier, journal: (m) => journal.push(m) });
  const service = { edition: true, base: () => null, etat: () => ({ service: 'essai' }), journal: (m) => journal.push(m), dossier: racine, acces, ...extra };
  const appel = (methode, chemin, { entetes = {}, corps } = {}) => {
    try {
      return traiter({ methode, chemin, entetes: { ...JSON_, ...entetes }, corps: corps === undefined ? '{}' : JSON.stringify(corps) }, service);
    } catch (e) {
      return { statut: 'exception', erreur: e };
    }
  };
  const session = acces.connecter(MOT, {});
  return { acces, service, appel, cle, journal, cookie: { cookie: `${COOKIE}=${session.jeton}` }, avecCle: { [ENTETE_CLE]: cle } };
}

test('la porte : pour chaque route de l’en-tête, sans rien / avec la clé / avec le mot de passe, 401 exactement quand la classe le demande', async () => {
  const m = monde();
  const routes = routesDeLEntete().filter(([, c]) => !c.startsWith('/api/acces/')); // la connexion se juge plus bas
  for (const [methode, chemin] of routes) {
    const { classe } = classer(methode, chemin);
    const qui = { rien: {}, cle: m.avecCle, mot_de_passe: m.cookie };
    // la clé de lecture passe pour `lecture` et `proposition` (déposer un lot : R275) ; l'écriture demande le mot de passe seul
    const attendu = { rien: classe !== 'ouverte', cle: classe === 'ecriture', mot_de_passe: false };
    for (const [nom, entetes] of Object.entries(qui)) {
      const r = m.appel(methode, chemin, { entetes });
      assert.equal(r.statut === 401, attendu[nom], `${methode} ${chemin} avec « ${nom} » : ${r.statut}`);
      if (r.statut === 401) assert.deepEqual(r.corps.acces, classe === 'lecture' || classe === 'proposition' ? 'cle' : 'mot_de_passe', `${methode} ${chemin}`);
    }
  }
  // une route inconnue : 401 « mot de passe » (jamais un 404 qui montrerait ce qui existe)
  assert.equal(m.appel('GET', '/api/nouvelle-route/').statut, 401);
  assert.equal(m.appel('GET', '/api/nouvelle-route/', { entetes: m.avecCle }).statut, 401);
  assert.equal(m.appel('GET', '/api/nouvelle-route/', { entetes: m.cookie }).statut, 404);
});

test('sans réglage, tout reste ouvert comme avant ; en production (pas d’édition) un réglage éventuel n’est jamais lu ; Simulation et mise à jour restent atteignables', async () => {
  const sans = { edition: true, base: () => null, etat: () => ({ service: 'essai' }), dossier: racine };
  const libre = (service, methode, chemin) => traiter({ methode, chemin, entetes: JSON_, corps: '{}' }, service);
  for (const [m, c] of routesDeLEntete()) assert.notEqual(libre(sans, m, c).statut, 401, `${m} ${c} sans acces`);
  // un contrôle d'accès dont le fichier n'existe pas : même chose
  const vide = { ...sans, acces: creerAcces({ fichier: join(racine, 'absent.json') }) };
  for (const [m, c] of routesDeLEntete()) assert.notEqual(libre(vide, m, c).statut, 401, `${m} ${c} sans fichier`);
  // production : la porte n'existe pas (les 403 d'avant sont inchangés)
  const m = monde();
  const prod = { ...m.service, edition: false };
  assert.equal(libre(prod, 'POST', '/api/edition/').statut, 403);
  assert.equal(libre(prod, 'GET', '/api/v1/').statut, 403);
  assert.deepEqual(libre(prod, 'GET', '/api/acces/').corps, { protege: false, portee: null, connecte: false, droit: 'ecriture', expire_le: null });
  assert.equal(libre(prod, 'POST', '/api/acces/').statut, 409);
});

test('le lot figé reste ouvert avec le réglage (GitHub n’a pas de clé), sous les deux portées ; l’adresse sans lot ou d’un autre lot est refusée comme avant', async () => {
  for (const portee of [null, 'tout']) {
    const m = monde(portee);
    const r = m.appel('GET', `/api/mise-a-jour/lots/${UUID}/`);
    assert.equal(r.statut, 410, `portée ${portee} : pas de lot servi, mais la porte est passée`);
    // ni une adresse qui n'est pas celle d'un lot, ni la liste des lots (qui n'existe pas) ne sont ouvertes : fermées, 404 seulement pour qui a le mot de passe
    for (const c of ['/api/mise-a-jour/lots/pas-un-lot/', '/api/mise-a-jour/lots/']) {
      assert.equal(m.appel('GET', c).statut, 401, c);
      assert.equal(m.appel('GET', c, { entetes: m.cookie }).statut, 404, c);
    }
  }
});

test('GET /api/acces/ : où en est le visiteur ; POST ouvre la session (cookie), DELETE la ferme ; 401, 415, 403, 429 comme les écritures', async () => {
  const m = monde();
  const etat = (entetes) => m.appel('GET', '/api/acces/', { entetes }).corps;
  assert.deepEqual(etat({}), { protege: true, portee: 'ecriture', connecte: false, droit: 'aucun', expire_le: null });
  assert.deepEqual(etat(m.avecCle), { protege: true, portee: 'ecriture', connecte: false, droit: 'lecture', expire_le: null });
  const connecte = etat(m.cookie);
  assert.deepEqual([connecte.connecte, connecte.droit], [true, 'ecriture']);
  assert.match(connecte.expire_le, /^\d{4}-\d\d-\d\dT/);

  // la connexion
  const faux = m.appel('POST', '/api/acces/', { corps: { mot_de_passe: 'pas le bon' } });
  assert.equal(faux.statut, 401);
  assert.deepEqual(faux.corps, { erreur: 'Mot de passe incorrect.', acces: 'mot_de_passe' });
  assert.ok(!JSON.stringify(faux).includes('pas le bon'));
  assert.equal(m.appel('POST', '/api/acces/', { corps: {} }).statut, 400);
  assert.equal(m.appel('POST', '/api/acces/', { corps: { mot_de_passe: 42 } }).statut, 400);
  assert.equal(m.appel('POST', '/api/acces/', { entetes: { 'content-type': 'text/plain' }, corps: { mot_de_passe: MOT } }).statut, 415);
  assert.equal(m.appel('POST', '/api/acces/', { entetes: { 'sec-fetch-site': 'cross-site' }, corps: { mot_de_passe: MOT } }).statut, 403, 'un autre site ne se connecte pas à la place du visiteur');
  const ok = m.appel('POST', '/api/acces/', { entetes: { 'x-forwarded-host': 'dev.exemple.invalid', 'x-forwarded-proto': 'http' }, corps: { mot_de_passe: MOT } });
  assert.equal(ok.statut, 200);
  assert.deepEqual([ok.corps.connecte, ok.corps.droit, ok.corps.portee], [true, 'ecriture', 'ecriture']);
  const [cookie] = [].concat(ok.entetes['Set-Cookie']);
  assert.match(cookie, new RegExp(`^${COOKIE}=v1\\.\\d+\\.[0-9a-f]{64}; Path=/api/; HttpOnly; SameSite=Strict; Secure$`));
  // ce cookie ouvre une écriture
  const jeton = /=([^;]+)/.exec(cookie)[1];
  assert.notEqual(m.appel('POST', '/api/edition/', { entetes: { cookie: `${COOKIE}=${jeton}` } }).statut, 401);

  // se déconnecter : les deux chemins sont retirés
  const sortie = m.appel('DELETE', '/api/acces/', { entetes: m.cookie });
  assert.equal(sortie.statut, 200);
  assert.equal(sortie.entetes['Set-Cookie'].length, 2);
  assert.ok(sortie.entetes['Set-Cookie'].every((c) => c.includes('Max-Age=0')));
  assert.equal(m.appel('DELETE', '/api/acces/', { entetes: { 'sec-fetch-site': 'cross-site' } }).statut, 403);
  assert.equal(m.appel('PUT', '/api/acces/', { entetes: m.cookie }).statut, 405);
  assert.equal(m.appel('GET', '/api/acces/autre/', { entetes: m.cookie }).statut, 404);
});

test('la limite des essais répond 429 avec le temps à attendre ; un mot de passe de plus de 200 caractères est refusé sans être haché', async () => {
  const m = monde();
  for (let i = 0; i < 5; i += 1) assert.equal(m.appel('POST', '/api/acces/', { corps: { mot_de_passe: 'faux faux faux' } }).statut, 401);
  const r = m.appel('POST', '/api/acces/', { corps: { mot_de_passe: MOT } });
  assert.equal(r.statut, 429);
  assert.ok(r.corps.attente_s > 0);
  assert.equal(r.entetes['Retry-After'], String(r.corps.attente_s));
  assert.equal(r.corps.acces, 'mot_de_passe');
  assert.equal(m.appel('POST', '/api/acces/', { corps: { mot_de_passe: 'x'.repeat(201) } }).statut, 400);
});

test('GET /api/acces/verifier/ : 204 avec la clé ou le mot de passe, 401 sans rien (le forward_auth de Caddy, portée « tout »)', async () => {
  const m = monde('tout');
  assert.equal(m.appel('GET', '/api/acces/verifier/').statut, 401);
  assert.equal(m.appel('GET', '/api/acces/verifier/', { entetes: m.avecCle }).statut, 204);
  assert.equal(m.appel('GET', '/api/acces/verifier/', { entetes: m.cookie }).statut, 204);
  assert.equal(m.appel('GET', '/api/acces/verifier/', { entetes: { [ENTETE_CLE]: 'mvk_faux' } }).statut, 401);
  assert.equal(m.appel('POST', '/api/acces/verifier/', { entetes: m.cookie }).statut, 405);
  // portée « tout » : une route d'ordinaire ouverte demande la clé ; le cookie est posé sur toutes les pages
  assert.equal(m.appel('GET', '/api/etat/').statut, 401);
  assert.equal(m.appel('GET', '/api/etat/', { entetes: m.avecCle }).statut, 200);
  const ok = m.appel('POST', '/api/acces/', { corps: { mot_de_passe: MOT } });
  assert.match([].concat(ok.entetes['Set-Cookie'])[0], /Path=\/; HttpOnly; SameSite=Lax/);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Aucune fiche de joueur, aucun compte, aucun groupe sur une route ouverte (base du service : le schéma, quelques lignes d'essai)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Le schéma de data/schema.sql, vide, comme règles d'un service d'essai ; la base vivante qui en vient, avec un prétiré et la fiche d'un joueur. */
function baseAvecUnJoueur() {
  const dossier = dossierTemporaire('acces-base');
  const regles = join(dossier, 'maverick.db');
  const schema = new DatabaseSync(regles);
  schema.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  schema.close();
  const { chemin } = preparerBaseVivante({ regles, dossier: join(dossier, 'db') });
  const db = ouvrirBaseVivante(chemin);
  // des lignes d'essai (clés étrangères coupées le temps de les poser : seule la lecture des routes est éprouvée)
  db.exec('PRAGMA foreign_keys = OFF');
  const t = '2026-01-01T00:00:00Z';
  const fiche = (id, nature, proprio, visibilite, nom) => db.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, nom, mode_classe, xp, alignement_loyal, alignement_chaotique,
    alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le) VALUES (?, ?, ?, ?, ?, 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?)`)
    .run(id, nature, proprio, visibilite, nom, t, t);
  db.prepare("INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES ('u-secret', 'Compte secret', ?)").run(t);
  fiche('pretire-essai', 'pretire', null, 'tous', 'Prétiré d’essai');
  fiche('joueur-secret', 'joueur', 'u-secret', 'privee', 'Fiche secrète d’une joueuse');
  db.prepare("INSERT INTO famille (id, libelle, ordre) VALUES ('classes', 'classes', 1) ON CONFLICT DO NOTHING").run();
  db.prepare("INSERT INTO categorie_classe (id, libelle, ordre, origine, source_ref) VALUES ('cat-essai', 'Catégorie d’essai', 1, 'classes', 'essai')").run();
  db.prepare(`INSERT INTO classe (id, nom, nom_cle, categorie_id, ordre, sante_depart, chakra_depart, barriere_depart, origine, source_ref)
    VALUES ('classe-essai', 'Classe d’essai', 'classe-essai', 'cat-essai', 1, 1, 1, 1, 'classes', 'essai')`).run();
  db.prepare("INSERT INTO specialite (id, classe_id, rang, nom, nom_cle, origine, source_ref) VALUES ('classe-essai#specialite:spe-essai', 'classe-essai', 1, 'Spécialité d’essai', 'spe-essai', 'classes', 'essai')").run();
  for (const id of ['pretire-essai', 'joueur-secret']) db.prepare("INSERT INTO personnage_classe (personnage_id, rang, classe_id, specialite_id) VALUES (?, 1, 'classe-essai', 'classe-essai#specialite:spe-essai')").run(id);
  return { db, dossier, regles };
}

test('une fiche de joueur, un compte ou un groupe ne sortent d’aucune route ouverte : prétirés seulement, fiches adaptées et libellés de fiches réservés à la lecture', async () => {
  const { db } = baseAvecUnJoueur();
  const secrets = ['joueur-secret', 'Fiche secrète d’une joueuse', 'Compte secret', 'u-secret'];
  const m = monde(null, {
    base: () => db,
    etat: () => ({ service: 'essai', base: { disponible: true, retraits: { le: '2026-01-01', fiches: [{ fiche: 'Fiche secrète d’une joueuse', retraits: [] }] }, pretires: 1 } }),
  });
  const sansRien = (methode, chemin, corps) => m.appel(methode, chemin, { corps });
  const texte = (r) => JSON.stringify(r.corps ?? '') + String(r.brut ?? '');

  const liste = sansRien('GET', '/api/personnages/');
  assert.equal(liste.statut, 200);
  assert.deepEqual(liste.corps.personnages.map((p) => p.id), ['pretire-essai'], 'le prétiré seulement');
  assert.equal(sansRien('GET', '/api/personnages/pretire-essai/').statut, 200);
  assert.equal(sansRien('GET', '/api/personnages/joueur-secret/').statut, 404);
  assert.equal(sansRien('GET', '/api/personnages/joueur-secret/portrait/').statut, 404);

  // chaque route ouverte, sans rien : aucun secret dans la réponse
  const ouvertes = [['GET', '/api/etat/'], ['GET', '/api/personnages/'], ['GET', '/api/personnages/joueur-secret/'], ['GET', '/api/edition/en-attente/'], ['GET', '/api/edition/listes/'],
    ['GET', '/api/edition/pages/'], ['GET', '/api/edition/mots-cles/'], ['GET', '/api/edition/chronologie/'], ['GET', '/api/edition/plan/'],
    ['POST', '/api/edition/classe/', { classe: 'classe-essai' }], ['POST', '/api/edition/lignes/', { lignes: [{ table: 'classe', cle: { id: 'classe-essai' } }] }]];
  for (const [methode, chemin, corps] of ouvertes) {
    const r = sansRien(methode, chemin, corps);
    assert.notEqual(r.statut, 'exception', `${methode} ${chemin} : ${r.erreur?.message}`);
    assert.notEqual(r.statut, 401, `${methode} ${chemin} est ouverte`);
    for (const s of secrets) assert.ok(!texte(r).includes(s), `${methode} ${chemin} montre « ${s} »`);
  }
  assert.equal(sansRien('GET', '/api/etat/').corps.base.retraits, null);
  assert.deepEqual(sansRien('POST', '/api/edition/classe/', { classe: 'classe-essai' }).corps.fiches, {}, 'les libellés de fiches ne sortent pas sans la lecture');

  // la page Debug (fiches, comptes, groupes) : fermée sans la clé, ouverte avec
  for (const table of ['personnage', 'utilisateur', 'groupe']) {
    assert.equal(sansRien('GET', `/api/debug/tables/${table}/`).statut, 401, table);
    const avec = m.appel('GET', `/api/debug/tables/${table}/`, { entetes: m.avecCle });
    assert.equal(avec.statut, 200, table);
  }
  assert.ok(texte(m.appel('GET', '/api/debug/tables/personnage/', { entetes: m.avecCle })).includes('Fiche secrète d’une joueuse'));

  // avec la clé de lecture : l'état entier et les libellés, pour la confirmation d'une suppression
  assert.equal(m.appel('GET', '/api/etat/', { entetes: m.avecCle }).corps.base.retraits.fiches.length, 1);
  const classe = m.appel('POST', '/api/edition/classe/', { entetes: m.avecCle, corps: { classe: 'classe-essai' } }).corps;
  assert.ok(Object.values(classe.fiches).flat().length >= 1, JSON.stringify(classe.fiches));
  // la liste des fiches de joueur ne passe pas non plus par le journal : un prétiré écrit demande le mot de passe
  assert.equal(sansRien('POST', '/api/personnages/', { nom: 'Pirate' }).statut, 401);
  assert.equal(m.appel('PUT', '/api/personnages/pretire-essai/', { entetes: m.avecCle, corps: {} }).statut, 401);
  assert.equal(m.appel('DELETE', '/api/personnages/pretire-essai/', { entetes: m.avecCle, corps: {} }).statut, 401);
});

test('base indisponible : le 503 d’une route ouverte ne porte pas la liste des fiches adaptées sans la lecture (état masqué partout), avec la clé il la porte', () => {
  const m = monde(null, { etat: () => ({ service: 'essai', base: { disponible: false, retraits: { fiches: [{ fiche: 'Fiche secrète d’une joueuse', retraits: [] }] } } }) });
  const ouvertes = [['GET', '/api/personnages/'], ['GET', '/api/personnages/x%2F..%2F..%2Fdebug/'], ['GET', '/api/edition/listes/'], ['GET', '/api/edition/en-attente/'],
    ['GET', '/api/mise-a-jour/'], ['GET', '/api/mise-a-jour/lancement/'], ['POST', '/api/edition/classe/'], ['GET', '/api/etat/']];
  for (const [methode, chemin] of ouvertes) {
    const sans = m.appel(methode, chemin);
    assert.notEqual(sans.statut, 401, `${methode} ${chemin} est ouverte`);
    assert.ok(!JSON.stringify(sans.corps ?? '').includes('Fiche secrète'), `${methode} ${chemin} : ${JSON.stringify(sans.corps)}`);
    if (sans.statut === 503) assert.equal(sans.corps.etat.base.retraits, null, `${methode} ${chemin}`);
  }
  const avec = m.appel('GET', '/api/personnages/', { entetes: m.avecCle });
  assert.equal(avec.statut, 503);
  assert.equal(avec.corps.etat.base.retraits.fiches.length, 1);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le service HTTP réel
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('service réel : sans réglage rien ne change ; le fichier posé protège sans redémarrage ; le cookie fait le tour ; rien de secret au journal', async () => {
  const { dossier, regles } = baseAvecUnJoueur();
  const fichier = fichierTemporaire('acces.json', 'acces-service');
  const lignes = [];
  const s = await demarrerService({ regles, dossier: join(dossier, 'service-db'), port: 0, intervalle: 0, edition: true, acces: fichier, metriques: false, journal: (l) => lignes.push(l) });
  try {
    const appel = (methode, chemin, { entetes = {}, corps } = {}) => fetch(`${s.url}${chemin}`, {
      method: methode, headers: { ...(corps === undefined ? {} : JSON_), ...entetes }, ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });
    // sans réglage : comme avant
    assert.equal((await appel('GET', '/api/v1/')).status, 200);
    assert.equal((await appel('POST', '/api/edition/', { corps: {} })).status, 400, 'le lot vide est refusé par l’édition, pas par la porte');
    assert.deepEqual(await (await appel('GET', '/api/acces/')).json(), { protege: false, portee: null, connecte: false, droit: 'ecriture', expire_le: null });

    // le fichier posé : protégé tout de suite
    const { reglage, cle } = reglageApres({ motDePasse: MOT });
    writeFileSync(fichier, JSON.stringify(reglage));
    const ferme = await appel('POST', '/api/edition/', { corps: {} });
    assert.equal(ferme.status, 401);
    assert.deepEqual(await ferme.json(), { erreur: 'Accès refusé : le mot de passe est nécessaire.', acces: 'mot_de_passe' });
    const lecture = await appel('GET', '/api/v1/');
    assert.equal(lecture.status, 401);
    assert.equal((await lecture.json()).acces, 'cle');
    assert.equal((await appel('GET', '/api/etat/')).status, 200, 'la lecture des pages reste libre');
    assert.equal((await appel('GET', '/api/v1/', { entetes: { [ENTETE_CLE]: cle } })).status, 200);
    assert.equal((await appel('POST', '/api/edition/', { entetes: { [ENTETE_CLE]: cle }, corps: {} })).status, 401);
    // le second nom X-Maverick-Key (formulaire sûr des sessions), quelle que soit sa casse sur le réseau : lecture oui, écriture non
    assert.equal((await appel('GET', '/api/v1/', { entetes: { 'X-Maverick-Key': cle } })).status, 200);
    assert.equal((await appel('POST', '/api/edition/', { entetes: { 'X-Maverick-Key': cle }, corps: {} })).status, 401);
    assert.equal((await appel('GET', '/api/v1/', { entetes: { 'X-Api-Key': cle } })).status, 401, 'un autre nom d’en-tête n’ouvre rien');
    // Authorization n'arrive jamais au service (Caddy puis nginx l'écrasent) : il ne sert à rien d'y mettre la clé
    assert.equal((await appel('GET', '/api/v1/', { entetes: { authorization: `Bearer ${cle}` } })).status, 401);

    // la connexion : cookie HttpOnly, rejoué par le navigateur
    const connexion = await appel('POST', '/api/acces/', { corps: { mot_de_passe: MOT } });
    assert.equal(connexion.status, 200);
    const posé = connexion.headers.getSetCookie();
    assert.equal(posé.length, 1);
    assert.match(posé[0], /; Path=\/api\/; HttpOnly; SameSite=Strict/);
    const cookie = posé[0].split(';')[0];
    assert.equal((await appel('POST', '/api/edition/', { entetes: { cookie }, corps: {} })).status, 400, 'la porte est passée');
    assert.equal((await appel('GET', '/api/v1/', { entetes: { cookie } })).status, 200);

    // le mot de passe change : la session ouverte tombe sans redémarrage
    writeFileSync(fichier, JSON.stringify(reglageApres({ ancien: reglage, motDePasse: 'un nouveau mot de passe' }).reglage));
    assert.equal((await appel('POST', '/api/edition/', { entetes: { cookie }, corps: {} })).status, 401);

    // rien de secret nulle part au journal, ni dans l'état
    const tout = lignes.join('\n');
    assert.match(tout, /accès : session ouverte/);
    for (const secret of [MOT, cle, cookie.split('=')[1], reglage.secret_de_session, reglage.mot_de_passe.empreinte, 'un nouveau mot de passe']) assert.ok(!tout.includes(secret), `« ${secret.slice(0, 10)}… » au journal`);
    assert.ok(!JSON.stringify(s).includes(MOT));
  } finally {
    await s.arreter();
  }
});
