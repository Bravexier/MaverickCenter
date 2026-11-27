// Classement des routes du service pour l'accès au site de dev (client/serveur/acces-routes.mjs, api.mjs ; docs/serveur.md, « Accès au site de dev » ; R275, R291, R310) :
// chaque route d'api.mjs est classée (ouverte, lecture, proposition, écriture) — une route nouvelle non classée fait échouer ce test —, le site de dev est FERMÉ (seules la
// connexion, l'état du service, la maintenance et le lot figé sont ouverts), aucune route ouverte ne montre une fiche de joueur, un compte ou un groupe, et sans porte (tests,
// production) tout se comporte comme avant. Le service HTTP réel garde les clés et les sessions.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ENTETE_CLE, creerAcces } from '../serveur/acces.mjs';
import { CLASSES, ROUTES_CLASSEES, classer, cheminSansFin } from '../serveur/acces-routes.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { COOKIE_SESSION, creerJetonDeSession, reglageApres as reglageDiscord } from '../serveur/discord.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { poserLAcces, reglageDiscordDEssai, cookieDeSession } from './aide-acces-d-essai.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { poserUnCompte } from './aide-compte-d-essai.mjs';

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

test('chaque route de l’en-tête d’api.mjs est classée ; une route nouvelle non classée fait échouer ce test (fermée par défaut : session Créateur)', () => {
  const routes = routesDeLEntete();
  assert.ok(routes.length >= 50, `${routes.length} routes lues`);
  for (const [m, c] of routes) {
    const r = classer(m, c);
    assert.ok(r.connue, `${m} ${c} : non classée (serveur/acces-routes.mjs)`);
    assert.ok(CLASSES.includes(r.classe), `${m} ${c}`);
  }
  // les routes de la connexion par Discord (R310) sont dans l'en-tête, donc classées
  for (const c of ['/api/connexion/discord/', '/api/connexion/discord/retour/', '/api/moi/', '/api/deconnexion/']) assert.ok(routes.some(([, x]) => x === c), `${c} absente de l’en-tête d’api.mjs`);
  // ce que la table ne nomme pas est fermé, jamais ouvert
  for (const [m, c] of [['GET', '/api/nouvelle-route/'], ['POST', '/api/etat/'], ['GET', '/api/edition/inconnue/'], ['GET', '/api/debug/tables/a/b/'], ['PUT', '/api/etat/'], ['HEAD', '/api/etat/'],
    ['POST', '/api/acces/'], ['DELETE', '/api/acces/'], ['GET', '/api/connexion/'], ['POST', '/api/moi/'], ['GET', '/api/deconnexion/'], ['GET', '/api/connexion/discord/autre/']]) {
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

test('le classement : seul le nécessaire est ouvert, la lecture (session MJ ou clé) pour le reste des pages, du journal, de Debug (fiches, comptes et groupes compris) et de /api/v1/, toute écriture à un Créateur (R275, R310)', () => {
  const attendu = {
    ouverte: [
      ['GET', '/api/etat/'], ['GET', '/api/maintenance/'], ['GET', `/api/mise-a-jour/lots/${UUID}/`],
      ['GET', '/api/acces/'], ['GET', '/api/acces/verifier/'], ['GET', '/api/moi/'], ['GET', '/api/connexion/discord/'], ['GET', '/api/connexion/discord/retour/'], ['POST', '/api/deconnexion/'],
    ],
    lecture: [
      ['GET', '/api/tipeee/'], ['POST', '/api/classeur/'], ['POST', '/api/metriques/page/'],
      ['GET', '/api/personnages/'], ['GET', '/api/personnages/essai/'], ['GET', '/api/personnages/essai/portrait/'],
      ['GET', '/api/edition/en-attente/'], ['GET', '/api/edition/listes/'], ['GET', '/api/edition/pages/'], ['GET', '/api/edition/mots-cles/'],
      ['GET', '/api/edition/chronologie/'], ['GET', '/api/edition/plan/'],
      ['POST', '/api/edition/lignes/'], ['POST', '/api/edition/race/'], ['POST', '/api/edition/classe/'], ['POST', '/api/edition/bestiaire/'],
      ['POST', '/api/edition/portrait/'], ['POST', '/api/edition/evenement/'],
      ['GET', '/api/mise-a-jour/'], ['GET', '/api/mise-a-jour/lancement/'],
      ['GET', '/api/edition/journal/'], ['GET', '/api/edition/extrait/'], ['GET', '/api/edition/extrait/meta/'], ['GET', '/api/mise-a-jour/conflits/'],
      ['GET', '/api/debug/journal/'], ['GET', '/api/debug/metriques/'], ['GET', '/api/debug/metriques/requetes/'], ['GET', '/api/debug/metriques/export/'],
      ['GET', '/api/debug/systeme/'], ['GET', '/api/debug/base/'], ['GET', '/api/debug/structure/'], ['GET', '/api/debug/atelier/'], ['GET', '/api/debug/tables/'], ['GET', '/api/debug/tables/personnage/'],
      ['GET', '/api/debug/tables/utilisateur/'], ['GET', '/api/debug/tables/groupe/'],
      ['GET', '/api/v1/'], ['GET', '/api/v1/openapi.json'], ['GET', '/api/v1/metiers/'], ['GET', '/api/v1/metiers/essai/'],
      ['GET', '/api/edition/lots/'], ['GET', `/api/edition/lots/${UUID}/`], ['GET', '/api/edition/lots/ancrage/'],
      ['GET', `/api/edition/lots/${UUID}/annulation/`], // l'aperçu de l'annulation d'un lot : calculé sur une copie, rien n'est écrit
    ],
    // lots de changements : la clé de lecture dépose, refait l'essai et dépose « tout recalculer » (elle n'écrit que `lot_de_changements`, jamais le contenu)
    proposition: [['POST', '/api/edition/lots/'], ['POST', `/api/edition/lots/${UUID}/essai/`], ['POST', '/api/edition/lots/recalcul/'], ['POST', '/api/edition/lots/ancrage/']],
    ecriture: [
      ['POST', '/api/edition/'], ['POST', '/api/maintenance/lever/'],
      ['POST', '/api/edition/atelier/'], // « le bouton » de l'atelier : l'extrait refait tout de suite (un Créateur seul)
      ['POST', `/api/edition/lots/${UUID}/appliquer/`], ['POST', `/api/edition/lots/${UUID}/refuser/`], ['POST', `/api/edition/lots/${UUID}/annuler/`],
      ['GET', `/api/edition/lots/${UUID}/lignes/1/annulation/`], ['POST', `/api/edition/lots/${UUID}/lignes/1/annuler/`],
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

test('toute méthode d’écriture d’une route connue est « ecriture », sauf les propositions, les POST qui ne font que lire (les pages en ont besoin, avec la lecture) et la déconnexion', () => {
  const PROPOSITIONS = new Set(['/api/edition/lots', `/api/edition/lots/${UUID}/essai`, '/api/edition/lots/recalcul', '/api/edition/lots/ancrage']); // elles n'écrivent que la proposition et son essai
  const POST_QUI_LISENT = new Set(['/api/classeur', '/api/metriques/page',
    '/api/edition/lignes', '/api/edition/race', '/api/edition/classe', '/api/edition/bestiaire', '/api/edition/portrait', '/api/edition/evenement']);
  for (const [m, c] of routesDeLEntete().filter(([m]) => m !== 'GET')) {
    const chemin = cheminSansFin(c);
    const attendu = chemin === '/api/deconnexion' ? 'ouverte' : POST_QUI_LISENT.has(chemin) ? 'lecture' : PROPOSITIONS.has(chemin) ? 'proposition' : 'ecriture';
    assert.equal(classer(m, c).classe, attendu, `${m} ${c}`);
  }
});

test('R310 (3) : le site de dev est fermé — seules sont ouvertes la connexion, le profil, l’état du service (les contrôles de santé de l’installation le lisent), la relève de la maintenance et le lot figé que GitHub télécharge', () => {
  const ouvertes = routesDeLEntete().filter(([m, c]) => classer(m, c).classe === 'ouverte').map(([m, c]) => `${m} ${c}`).sort();
  assert.deepEqual(ouvertes, [
    'GET /api/acces/', 'GET /api/acces/verifier/', 'GET /api/connexion/discord/', 'GET /api/connexion/discord/retour/', 'GET /api/etat/', 'GET /api/maintenance/',
    `GET /api/mise-a-jour/lots/${UUID}/`, 'GET /api/moi/', 'POST /api/deconnexion/',
  ].sort());
  // chaque route ouverte de la table est de cette liste (rien d'autre n'est ouvert, même hors de l'en-tête)
  assert.equal(ROUTES_CLASSEES.filter((r) => r.classe === 'ouverte').length, 9);
  // une adresse qui n'est pas celle d'un lot figé n'est pas ouverte
  for (const c of ['/api/mise-a-jour/lots/', '/api/mise-a-jour/lots/pas-un-lot/', `/api/mise-a-jour/lots/${UUID}/x/`]) assert.notEqual(classer('GET', c).classe, 'ouverte', c);
});

test('aucune route ouverte ne passe par la lecture d’une table : Debug, /api/v1/, journal, lots en conflit demandent une session MJ ou la clé', () => {
  for (const r of ROUTES_CLASSEES.filter((x) => x.classe === 'ouverte')) {
    for (const interdit of ['/api/debug/', '/api/v1', '/api/edition/journal', '/api/edition/extrait', '/api/mise-a-jour/conflits', '/api/personnages']) {
      assert.ok(!r.motif.test(interdit) && !r.motif.test(`${interdit}/x`), `${r.motif} ouvre ${interdit}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// traiter : la porte
// ---------------------------------------------------------------------------------------------------------------------------------------------

const racine = dossierTemporaire('acces-routes');
function monde({ depot = false, ...extra } = {}) {
  const a = poserLAcces({ prefixe: 'acces-routes', depot });
  const journal = [];
  const service = { edition: true, base: () => null, etat: () => ({ service: 'essai' }), journal: (m) => journal.push(m), dossier: racine, acces: a.acces, connexion: a.connexion, ...extra };
  const appel = (methode, chemin, { entetes = {}, corps } = {}) => {
    try {
      return traiter({ methode, chemin, entetes: { ...JSON_, ...entetes }, corps: corps === undefined ? '{}' : JSON.stringify(corps) }, service);
    } catch (e) {
      return { statut: 'exception', erreur: e };
    }
  };
  return { ...a, service, appel, journal };
}
/** La porte a-t-elle refusé cette réponse ? (le 401 ou le 403 de serveur/acces.mjs, qui portent `acces` ; un 403 d'une route elle-même n'en porte pas) */
const refuse = (r) => [401, 403].includes(r.statut) && ['connexion', 'niveau', 'cle', 'cle_de_depot'].includes(r.corps?.acces);

test('la porte : pour chaque route de l’en-tête, sans rien / clé de lecture / Observateur / Joueur / MJ / Créateur, un refus exactement quand la classe le demande, avec le bon code', async () => {
  const m = monde();
  for (const [methode, chemin] of routesDeLEntete().filter(([, c]) => c !== '/api/acces/verifier/')) { // sa réponse dit l'accès (401 ou 403 d'une route ouverte) : jugée plus bas
    const { classe } = classer(methode, chemin);
    const qui = { rien: {}, cle: m.avecCle, observateur: m.session('observateur'), joueur: m.session('joueur'), mj: m.mj, createur: m.createur };
    const passe = {
      rien: classe === 'ouverte', cle: classe !== 'ecriture', observateur: classe === 'ouverte', joueur: classe === 'ouverte', mj: classe === 'ouverte' || classe === 'lecture', createur: true,
    };
    for (const [nom, entetes] of Object.entries(qui)) {
      const r = m.appel(methode, chemin, { entetes });
      assert.notEqual(r.statut, 'exception', `${methode} ${chemin} (${nom}) : ${r.erreur?.stack}`);
      assert.equal(refuse(r), !passe[nom], `${methode} ${chemin} avec « ${nom} » (${classe}) : ${r.statut} ${JSON.stringify(r.corps)}`);
      if (!refuse(r)) continue;
      const code = r.corps.acces;
      if (nom === 'rien') assert.deepEqual([r.statut, code], [401, 'connexion'], `${methode} ${chemin}`);
      else if (nom === 'cle') assert.deepEqual([r.statut, code], [403, 'cle'], `${methode} ${chemin}`);
      else assert.deepEqual([r.statut, code, r.corps.niveau], [403, 'niveau', nom], `${methode} ${chemin}`);
    }
  }
  // une route inconnue : 401 « connexion » (jamais un 404 qui montrerait ce qui existe), 403 pour une clé ou un MJ, 404 seulement pour un Créateur
  assert.deepEqual(m.appel('GET', '/api/nouvelle-route/').statut, 401);
  assert.equal(m.appel('GET', '/api/nouvelle-route/', { entetes: m.avecCle }).statut, 403);
  assert.equal(m.appel('GET', '/api/nouvelle-route/', { entetes: m.mj }).statut, 403);
  assert.equal(m.appel('GET', '/api/nouvelle-route/', { entetes: m.createur }).statut, 404);
});

test('R291 : la clé de dépôt posée, la porte la demande pour déposer (401 sans rien, 403 avec la clé de lecture ou une session MJ) ; une session Créateur dépose', async () => {
  const m = monde({ depot: true });
  for (const chemin of ['/api/edition/lots/', `/api/edition/lots/${UUID}/essai/`, '/api/edition/lots/recalcul/', '/api/edition/lots/ancrage/']) {
    assert.deepEqual([m.appel('POST', chemin).statut, m.appel('POST', chemin).corps.acces], [401, 'cle_de_depot'], chemin);
    assert.deepEqual([m.appel('POST', chemin, { entetes: m.avecCle }).statut, m.appel('POST', chemin, { entetes: m.avecCle }).corps.acces], [403, 'cle_de_depot'], chemin);
    assert.deepEqual([m.appel('POST', chemin, { entetes: m.mj }).statut, m.appel('POST', chemin, { entetes: m.mj }).corps.acces], [403, 'niveau'], chemin);
    assert.equal(refuse(m.appel('POST', chemin, { entetes: m.avecDepot() })), false, chemin);
    assert.equal(refuse(m.appel('POST', chemin, { entetes: m.createur })), false, chemin);
  }
  // la clé de dépôt n'ouvre pas le reste des écritures
  assert.deepEqual([m.appel('POST', '/api/edition/', { entetes: m.avecDepot() }).statut, m.appel('POST', '/api/edition/', { entetes: m.avecDepot() }).corps.acces], [403, 'cle']);
});

test('sans porte, tout reste ouvert comme avant ; en production (pas d’édition) la porte n’existe pas, même avec des clés et une connexion posées ; la connexion et le profil y répondent', async () => {
  const sans = { edition: true, base: () => null, etat: () => ({ service: 'essai' }), dossier: racine };
  const libre = (service, methode, chemin, entetes = JSON_) => traiter({ methode, chemin, entetes, corps: '{}' }, service);
  for (const [m, c] of routesDeLEntete()) assert.ok(!refuse(libre(sans, m, c)), `${m} ${c} sans porte`);
  // un fichier de clés absent n'ouvre rien quand la porte est posée (elle ferme par défaut)
  const vide = { ...sans, acces: creerAcces({ fichier: join(racine, 'absent.json') }) };
  assert.equal(libre(vide, 'GET', '/api/v1/').statut, 401);
  assert.equal(libre(vide, 'GET', '/api/etat/').statut, 200);
  // production : la porte n'existe pas (les 403 d'avant sont inchangés)
  const m = monde();
  const prod = { ...m.service, edition: false };
  assert.equal(libre(prod, 'POST', '/api/edition/').statut, 403);
  assert.equal(libre(prod, 'GET', '/api/v1/').statut, 403);
  assert.equal(libre(prod, 'GET', '/api/personnages/').statut, 503, 'pas de base d’essai : la route est atteinte, aucune porte ne la ferme');
  assert.deepEqual(libre(prod, 'GET', '/api/acces/').corps, { protege: false, connecte: false, niveau: null, droit: 'ecriture', expire_le: null });
  assert.equal(libre(prod, 'GET', '/api/moi/').statut, 200);
  assert.equal(libre(prod, 'GET', '/api/connexion/discord/').statut, 302);
  // la session de la production est lue par la connexion (aucune porte ne s'en sert)
  const connecte = libre(prod, 'GET', '/api/acces/', { ...JSON_, ...m.mj });
  assert.deepEqual([connecte.corps.protege, connecte.corps.connecte, connecte.corps.niveau], [false, true, 'mj']);
  // POST et DELETE /api/acces/ n'existent plus (le mot de passe est retiré)
  for (const methode of ['POST', 'DELETE']) assert.equal(libre(prod, methode, '/api/acces/').statut, 405);
});

test('le lot figé reste ouvert sans clé ni session (GitHub n’en a pas) ; une adresse qui n’est pas celle d’un lot est fermée comme le reste', async () => {
  const m = monde();
  const r = m.appel('GET', `/api/mise-a-jour/lots/${UUID}/`);
  assert.equal(r.statut, 410, 'pas de lot servi, mais la porte est passée');
  // ni une adresse qui n'est pas celle d'un lot, ni la liste des lots (qui n'existe pas) ne sont ouvertes : fermées, 404 seulement pour un Créateur
  for (const c of ['/api/mise-a-jour/lots/pas-un-lot/', '/api/mise-a-jour/lots/']) {
    assert.equal(m.appel('GET', c).statut, 401, c);
    assert.equal(m.appel('GET', c, { entetes: m.createur }).statut, 404, c);
  }
});

test('GET /api/acces/ : où en est le visiteur (session, niveau, droit) ; verifier : 204 avec la clé ou une session MJ au moins, 401 sans rien, 403 avec un niveau trop bas (le forward_auth de Caddy)', async () => {
  const m = monde({ depot: true });
  const etat = (entetes) => m.appel('GET', '/api/acces/', { entetes }).corps;
  assert.deepEqual(etat({}), { protege: true, connecte: false, niveau: null, droit: 'aucun', expire_le: null });
  assert.deepEqual(etat(m.avecCle), { protege: true, connecte: false, niveau: null, droit: 'lecture', expire_le: null });
  assert.equal(etat(m.avecDepot()).droit, 'depot');
  const c = etat(m.createur);
  assert.deepEqual([c.connecte, c.niveau, c.droit], [true, 'createur', 'ecriture']);
  assert.match(c.expire_le, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual([etat(m.mj).niveau, etat(m.mj).droit], ['mj', 'lecture']);
  assert.deepEqual([etat(m.session('joueur')).niveau, etat(m.session('joueur')).droit, etat(m.session('joueur')).connecte], ['joueur', 'aucun', true]);
  assert.equal(m.appel('GET', '/api/acces/autre/', { entetes: m.createur }).statut, 404);
  for (const methode of ['POST', 'PUT', 'DELETE']) assert.equal(m.appel(methode, '/api/acces/', { entetes: m.createur }).statut, 405, methode);

  const verifier = (entetes) => m.appel('GET', '/api/acces/verifier/', { entetes });
  assert.deepEqual([verifier({}).statut, verifier({}).corps.acces], [401, 'connexion']);
  for (const [nom, entetes] of [['la clé de lecture', m.avecCle], ['la clé de dépôt', m.avecDepot()], ['un MJ', m.mj], ['un Créateur', m.createur]]) assert.equal(verifier(entetes).statut, 204, nom);
  for (const niveau of ['joueur', 'observateur']) {
    const r = verifier(m.session(niveau));
    assert.deepEqual([r.statut, r.corps.acces, r.corps.niveau], [403, 'niveau', niveau]);
  }
  assert.equal(verifier({ [ENTETE_CLE]: 'mvk_faux' }).statut, 401);
  assert.equal(verifier({ cookie: `${COOKIE_SESSION}=v1.faux.faux` }).statut, 401);
  const expiree = m.session('createur', { exp: Math.floor(Date.now() / 1000) - 1 });
  assert.equal(verifier(expiree).statut, 401, 'une session expirée vaut aucune session');
  assert.equal(m.appel('POST', '/api/acces/verifier/', { entetes: m.createur }).statut, 405);
  // le niveau est celui du cookie, signé : un cookie d'un autre secret ou falsifié ne donne rien
  const autre = reglageDiscord({ ancien: m.reglage, nouvelleSession: true });
  assert.equal(verifier({ cookie: cookieDeSession(autre, 'createur') }).statut, 401);
  assert.equal(verifier({ cookie: `${COOKIE_SESSION}=${creerJetonDeSession('0'.repeat(64), { u: 'x', n: 'createur', exp: 2_000_000_000 })}` }).statut, 401);
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
  poserUnCompte(db, 'u-secret', 'Compte secret', t);
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

test('une fiche de joueur, un compte ou un groupe ne sortent d’aucune route ouverte : l’état masque les fiches adaptées sans la lecture ; les tables de Debug demandent une session MJ ou la clé', async () => {
  const { db } = baseAvecUnJoueur();
  const secrets = ['joueur-secret', 'Fiche secrète d’une joueuse', 'Compte secret', 'u-secret'];
  const m = monde({
    base: () => db,
    etat: () => ({ service: 'essai', base: { disponible: true, retraits: { le: '2026-01-01', fiches: [{ fiche: 'Fiche secrète d’une joueuse', retraits: [] }] }, pretires: 1 } }),
  });
  const sansRien = (methode, chemin, corps) => m.appel(methode, chemin, { corps });
  const texte = (r) => JSON.stringify(r.corps ?? '') + String(r.brut ?? '');

  // chaque route ouverte, sans rien : aucun secret dans la réponse
  for (const [methode, chemin] of [['GET', '/api/etat/'], ['GET', '/api/maintenance/'], ['GET', '/api/acces/'], ['GET', '/api/moi/'], ['GET', '/api/mise-a-jour/lots/pas-un-lot/']]) {
    const r = sansRien(methode, chemin);
    assert.notEqual(r.statut, 'exception', `${methode} ${chemin} : ${r.erreur?.message}`);
    for (const s of secrets) assert.ok(!texte(r).includes(s), `${methode} ${chemin} montre « ${s} »`);
  }
  assert.equal(sansRien('GET', '/api/etat/').corps.base.retraits, null, 'les fiches adaptées ne sortent pas sans la lecture');
  // tout le reste est fermé sans rien : prétirés, fiches, ce que les pages lisent, Debug
  for (const [methode, chemin] of [['GET', '/api/personnages/'], ['GET', '/api/personnages/joueur-secret/'], ['GET', '/api/personnages/joueur-secret/portrait/'], ['GET', '/api/edition/listes/'],
    ['POST', '/api/edition/classe/'], ['POST', '/api/edition/lignes/']]) assert.equal(sansRien(methode, chemin, {}).statut, 401, `${methode} ${chemin}`);
  // un Joueur ou un Observateur connecté n'a pas plus : 403, et l'état reste masqué
  for (const niveau of ['joueur', 'observateur']) {
    assert.equal(m.appel('GET', '/api/personnages/', { entetes: m.session(niveau) }).statut, 403, niveau);
    assert.equal(m.appel('GET', '/api/debug/tables/utilisateur/', { entetes: m.session(niveau) }).statut, 403, niveau);
    assert.equal(m.appel('GET', '/api/etat/', { entetes: m.session(niveau) }).corps.base.retraits, null, niveau);
  }

  // la page Debug (fiches, comptes, groupes) : fermée sans la clé ni session MJ, ouverte avec
  for (const table of ['personnage', 'utilisateur', 'groupe']) {
    assert.equal(sansRien('GET', `/api/debug/tables/${table}/`).statut, 401, table);
    for (const entetes of [m.avecCle, m.mj, m.createur]) assert.equal(m.appel('GET', `/api/debug/tables/${table}/`, { entetes }).statut, 200, table);
  }
  assert.ok(texte(m.appel('GET', '/api/debug/tables/personnage/', { entetes: m.mj })).includes('Fiche secrète d’une joueuse'));
  // le compte d'essai y est lu avec ses colonnes de R310, jamais une colonne de jeton ou d'e-mail
  const comptes = m.appel('GET', '/api/debug/tables/utilisateur/', { entetes: m.mj }).corps;
  assert.ok(comptes.colonnes.some((c) => (c.nom ?? c) === 'niveau'));
  assert.ok(!JSON.stringify(comptes.colonnes).match(/jeton|token|email|mot_de_passe/i));

  // avec la lecture : l'état entier et les libellés, pour la confirmation d'une suppression
  for (const entetes of [m.avecCle, m.mj]) {
    assert.equal(m.appel('GET', '/api/etat/', { entetes }).corps.base.retraits.fiches.length, 1);
    const classe = m.appel('POST', '/api/edition/classe/', { entetes, corps: { classe: 'classe-essai' } }).corps;
    assert.ok(Object.values(classe.fiches).flat().length >= 1, JSON.stringify(classe.fiches));
  }
  // les prétirés ne s'écrivent qu'avec une session Créateur : ni la clé de lecture ni un MJ
  assert.equal(sansRien('POST', '/api/personnages/', { nom: 'Pirate' }).statut, 401);
  for (const entetes of [m.avecCle, m.mj]) {
    assert.equal(m.appel('POST', '/api/personnages/', { entetes, corps: { nom: 'Pirate' } }).statut, 403);
    assert.equal(m.appel('PUT', '/api/personnages/pretire-essai/', { entetes, corps: {} }).statut, 403);
    assert.equal(m.appel('DELETE', '/api/personnages/pretire-essai/', { entetes, corps: {} }).statut, 403);
  }
  // les prétirés se lisent avec la lecture : la liste ne contient que le prétiré
  const liste = m.appel('GET', '/api/personnages/', { entetes: m.mj });
  assert.deepEqual(liste.corps.personnages.map((p) => p.id), ['pretire-essai'], 'le prétiré seulement');
  assert.equal(m.appel('GET', '/api/personnages/joueur-secret/', { entetes: m.mj }).statut, 404);
});

test('base indisponible : le 503 d’une route ne porte pas la liste des fiches adaptées sans la lecture (état masqué partout), avec la clé il la porte', () => {
  const m = monde({ etat: () => ({ service: 'essai', base: { disponible: false, retraits: { fiches: [{ fiche: 'Fiche secrète d’une joueuse', retraits: [] }] } } }) });
  const sans = m.appel('GET', '/api/etat/');
  assert.equal(sans.statut, 200);
  assert.ok(!JSON.stringify(sans.corps).includes('Fiche secrète'));
  assert.equal(sans.corps.base.retraits, null);
  for (const entetes of [m.avecCle, m.mj]) {
    const avec = m.appel('GET', '/api/personnages/', { entetes });
    assert.equal(avec.statut, 503);
    assert.equal(avec.corps.etat.base.retraits.fiches.length, 1);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le service HTTP réel
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('service réel : fermé même sans fichier ; les clés et les sessions se lisent sans redémarrage ; le niveau du cookie fait la porte ; rien de secret au journal', async () => {
  const { dossier, regles } = baseAvecUnJoueur();
  const fichierDesCles = fichierTemporaire('acces.json', 'acces-service');
  const fichierDiscord = fichierTemporaire('discord.json', 'acces-service');
  const lignes = [];
  const s = await demarrerService({ regles, dossier: join(dossier, 'service-db'), port: 0, intervalle: 0, edition: true, acces: fichierDesCles, connexion: fichierDiscord, metriques: false, journal: (l) => lignes.push(l) });
  try {
    const appel = (methode, chemin, { entetes = {}, corps } = {}) => fetch(`${s.url}${chemin}`, {
      method: methode, headers: { ...(corps === undefined ? {} : JSON_), ...entetes }, ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });
    // aucun fichier : le site de dev est FERMÉ (R310), et la connexion est indisponible
    const ferme = await appel('GET', '/api/v1/');
    assert.equal(ferme.status, 401);
    assert.deepEqual(await ferme.json(), { erreur: 'Accès refusé : connectez-vous (le site de dev demande une connexion Discord de niveau MJ au moins).', acces: 'connexion' });
    assert.equal((await appel('POST', '/api/edition/', { corps: {} })).status, 401);
    assert.equal((await appel('GET', '/api/personnages/')).status, 401);
    assert.equal((await appel('GET', '/api/etat/')).status, 200, 'l’état reste lisible (les contrôles de santé de l’installation)');
    assert.deepEqual(await (await appel('GET', '/api/moi/')).json(), { connexion_disponible: false, connecte: false, utilisateur: null });
    const debut = await fetch(`${s.url}/api/connexion/discord/`, { redirect: 'manual' });
    assert.equal(debut.status, 302);
    assert.equal(debut.headers.get('location'), '/connexion/?erreur=indisponible', 'connexion non réglée : la page de connexion le dit');
    assert.deepEqual(await (await appel('GET', '/api/acces/')).json(), { protege: true, connecte: false, niveau: null, droit: 'aucun', expire_le: null });

    // les clés : posées, elles ouvrent sans redémarrage
    const { reglageApres } = await import('../serveur/acces.mjs');
    const { reglage, cle } = reglageApres({ refaireLaCle: true });
    writeFileSync(fichierDesCles, JSON.stringify(reglage));
    assert.equal((await appel('GET', '/api/v1/', { entetes: { [ENTETE_CLE]: cle } })).status, 200);
    assert.equal((await appel('POST', '/api/edition/', { entetes: { [ENTETE_CLE]: cle }, corps: {} })).status, 403, 'la clé ne décide pas');
    // le second nom X-Maverick-Key (formulaire sûr des sessions), quelle que soit sa casse sur le réseau : lecture oui, écriture non
    assert.equal((await appel('GET', '/api/v1/', { entetes: { 'X-Maverick-Key': cle } })).status, 200);
    assert.equal((await appel('POST', '/api/edition/', { entetes: { 'X-Maverick-Key': cle }, corps: {} })).status, 403);
    assert.equal((await appel('GET', '/api/v1/', { entetes: { 'X-Api-Key': cle } })).status, 401, 'un autre nom d’en-tête n’ouvre rien');
    // Authorization n'arrive jamais au service (Caddy puis nginx l'écrasent) : il ne sert à rien d'y mettre la clé
    assert.equal((await appel('GET', '/api/v1/', { entetes: { authorization: `Bearer ${cle}` } })).status, 401);

    // la connexion posée : les sessions comptent aussitôt, selon leur niveau
    const reglageD = reglageDiscordDEssai();
    writeFileSync(fichierDiscord, JSON.stringify(reglageD));
    assert.equal((await (await appel('GET', '/api/moi/')).json()).connexion_disponible, true);
    const cookie = (niveau) => ({ cookie: cookieDeSession(reglageD, niveau) });
    assert.equal((await appel('GET', '/api/v1/', { entetes: cookie('mj') })).status, 200);
    assert.equal((await appel('POST', '/api/edition/', { entetes: cookie('mj'), corps: {} })).status, 403);
    assert.equal((await appel('GET', '/api/v1/', { entetes: cookie('joueur') })).status, 403);
    assert.equal((await appel('POST', '/api/edition/', { entetes: cookie('createur'), corps: {} })).status, 400, 'la porte est passée : le lot vide est refusé par l’édition');
    assert.equal((await appel('GET', '/api/v1/', { entetes: cookie('createur') })).status, 200);

    // --nouvelle-session : toutes les sessions tombent sans redémarrage, les clés restent
    writeFileSync(fichierDiscord, JSON.stringify(reglageDiscord({ ancien: reglageD, nouvelleSession: true })));
    assert.equal((await appel('POST', '/api/edition/', { entetes: cookie('createur'), corps: {} })).status, 401);
    assert.equal((await appel('GET', '/api/v1/', { entetes: { [ENTETE_CLE]: cle } })).status, 200);

    // rien de secret nulle part au journal, ni dans l'état
    const tout = lignes.join('\n');
    assert.match(tout, /connexion : réglage Discord relu/);
    for (const secret of [cle, reglageD.secret_de_session, reglageD.client_secret, cookie('createur').cookie.split('=')[1]]) assert.ok(!tout.includes(secret), `« ${secret.slice(0, 10)}… » au journal`);
    assert.ok(!JSON.stringify(s).includes(reglageD.client_secret));
  } finally {
    await s.arreter();
  }
});
