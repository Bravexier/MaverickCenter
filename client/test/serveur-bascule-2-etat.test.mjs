// Page Mise à jour, bloc « Activation » (bascule 2) : `bascule_2` dans GET /api/mise-a-jour/ (serveur/bascule-2-etat.mjs ; docs/api.md, « Page Mise à jour : l'état de la
// bascule 2 »). Lecture seule : cinq interrupteurs, chacun `true`, `false` ou `null` (inconnu, avec une raison), jamais deviné ; la réponse n'attend jamais GitHub ; rien d'un
// secret ni d'un chemin du serveur ; `activation_production` reste celui d'avant. Aucune valeur modifiable n'est figée : les fichiers et les réponses de GitHub sont ceux du test.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { lireLInterrupteur as lireActif } from '../../tools/flux-git/bascule-2-interrupteur.mjs';
import { lireLInterrupteur as lireGel } from '../scripts/gel-des-fusions-lib.mjs';
import { traiter } from '../serveur/api.mjs';
import { creerAtelier } from '../serveur/atelier.mjs';
import { CHEMIN_DES_INTERRUPTEURS, creerLesInterrupteursDeGithub, DELAI_APRES_ECHEC_MS, estUnDossier, etatDeLaBascule2, lireLesInterrupteurs, PHRASES_DES_RAISONS, VALIDITE_MS } from '../serveur/bascule-2-etat.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { creerGithub } from '../serveur/notes-de-version.mjs';
import { lireLActivation } from '../serveur/paquets-de-la-production.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('bascule-2-etat');
const INTERRUPTEURS = ['gel_des_fusions', 'actif', 'db_bascule_2', 'atelier_servir', 'activation_par_paquet'];
const ETATS_PERMIS = [true, false, null];

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La règle de lecture des deux clés : la même que celle des lecteurs de la CI
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('lireLesInterrupteurs : même règle que les deux lecteurs de la CI (absent = éteint ; un non-booléen que la CI refuse est inconnu ici), et le fichier du dépôt', () => {
  const textes = [null, undefined, '{}', '{"actif":true}', '{"actif":false,"gel_des_fusions":true}', '{"gel_des_fusions":true}', '{"actif":"oui"}', '{"gel_des_fusions":1}', '{"actif":null}',
    '{"actif":true,"gel_des_fusions":true,"autre":3}', '[]', 'null', '42', 'pas du json', '', readFileSync(new URL('../../tools/flux-git/bascule-2.json', import.meta.url), 'utf8')];
  for (const texte of textes) {
    for (const [cle, lecteur] of [['actif', lireActif], ['gel_des_fusions', lireGel]]) {
      let attendu;
      try { attendu = lecteur(texte); } catch { attendu = 'refuse'; }
      let obtenu;
      try { obtenu = lireLesInterrupteurs(texte)[cle]; } catch { obtenu = 'refuse'; }
      // la CI refuse (lève) : ici, la clé est inconnue (null) ou tout le fichier est illisible (lève) ; jamais un booléen deviné
      assert.equal(attendu === 'refuse' ? (obtenu === null || obtenu === 'refuse') : obtenu === attendu, true, `${cle} dans ${JSON.stringify(texte)?.slice(0, 60)} : la CI dit ${attendu}, ici ${obtenu}`);
    }
  }
  assert.throws(() => lireLesInterrupteurs('pas du json'), (e) => e.genre === 'illisible');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le client GitHub : lecture d'un fichier
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('creerGithub#lireUnFichier : /contents du dépôt à la branche demandée avec le jeton ; 401, 403, 404 et réponses mal formées disent pourquoi ; sans jeton, aucun appel', async () => {
  const appels = [];
  const texte = '{ "actif": false }\n';
  const reponse = (statut, corps) => new Response(JSON.stringify(corps), { status: statut });
  const fichier = { type: 'file', encoding: 'base64', content: `${Buffer.from(texte).toString('base64').replace(/(.{20})/g, '$1\n')}\n` };
  let prochaine = reponse(200, fichier);
  const github = creerGithub({ dossier: dossierTemporaire('bascule-2-etat-github'), depot: 'x/y', lireJeton: () => 'jeton', fetch: async (url, options) => { appels.push({ url, options }); return prochaine; } });
  assert.equal(await github.lireUnFichier('tools/flux-git/bascule-2.json', { ref: 'dev' }), texte, 'le contenu en base64, coupé en lignes, est décodé');
  assert.equal(appels[0].url, 'https://api.github.com/repos/x/y/contents/tools/flux-git/bascule-2.json?ref=dev');
  assert.equal(appels[0].options.headers.Authorization, 'Bearer jeton');
  assert.equal(appels[0].options.method, undefined, 'une lecture');
  for (const [statut, genre] of [[401, 'refuse'], [403, 'droit'], [404, 'introuvable']]) {
    prochaine = reponse(statut, { message: 'non' });
    await assert.rejects(() => github.lireUnFichier('a/b.json'), (e) => e.genre === genre, String(statut));
  }
  prochaine = reponse(502, {});
  await assert.rejects(() => github.lireUnFichier('a/b.json'), (e) => e.genre === undefined && /502/.test(e.message), 'une panne de GitHub n’est ni un refus ni un fichier absent');
  for (const mauvaise of [{ type: 'dir' }, { type: 'file', encoding: 'none', content: 'x' }, { type: 'file', encoding: 'base64' }, []]) {
    prochaine = reponse(200, mauvaise);
    await assert.rejects(() => github.lireUnFichier('a/b.json'), (e) => e.genre === 'illisible');
  }
  const sansJeton = creerGithub({ dossier: dossierTemporaire('bascule-2-etat-sans-jeton'), depot: 'x/y', lireJeton: () => null, fetch: async () => { throw new Error('ne doit pas être appelé'); } });
  await assert.rejects(() => sansJeton.lireUnFichier('a/b.json'), (e) => e.genre === 'jeton');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'interrupteur de l'atelier
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('atelier#servir : posé (depuis), pas posé (rapports montés sans servir.json), inconnu (rapports non montés, rapport illisible ou lien) ; hors du site de dev, inconnu', () => {
  const atelier = (o = {}) => creerAtelier({ dossier: dossierTemporaire('bascule-2-etat-atelier'), edition: true, version: () => '0.1.0', base: () => null, intervalle: 0, ...o });
  assert.deepEqual(atelier({ edition: false }).servir(), { pose: null, depuis: null, raison: 'pas_d_atelier' });
  assert.deepEqual(atelier({ rapports: null }).servir(), { pose: null, depuis: null, raison: 'atelier_non_installe' });
  assert.deepEqual(atelier({ rapports: join(racine, 'rapports-absents') }).servir(), { pose: null, depuis: null, raison: 'atelier_non_installe' });
  const rapports = dossierTemporaire('bascule-2-etat-rapports');
  assert.deepEqual(atelier({ rapports }).servir(), { pose: false, depuis: null }, 'rapports montés, pas de servir.json : l’interrupteur n’est pas posé');
  writeFileSync(join(rapports, 'servir.json'), `${JSON.stringify({ format: 'maverick-atelier-servir/1', depuis: '2026-11-18T08:00:00Z', pages_minimum_pct: 90 })}\n`);
  assert.deepEqual(atelier({ rapports }).servir(), { pose: true, depuis: '2026-11-18T08:00:00Z' }, 'seuls `pose` et `depuis` sortent (pas le seuil des pages)');
  writeFileSync(join(rapports, 'servir.json'), '{ pas du json');
  assert.deepEqual(atelier({ rapports }).servir(), { pose: null, depuis: null, raison: 'rapport_illisible' });
  writeFileSync(join(rapports, 'servir.json'), JSON.stringify({ format: 'autre/1' }));
  assert.equal(atelier({ rapports }).servir().pose, null, 'un autre format n’est pas un interrupteur posé');
  const avecLien = dossierTemporaire('bascule-2-etat-rapports-lien');
  writeFileSync(join(avecLien, 'cible.json'), JSON.stringify({ format: 'maverick-atelier-servir/1', depuis: '2026-11-18T08:00:00Z', pages_minimum_pct: 90 }));
  symlinkSync(join(avecLien, 'cible.json'), join(avecLien, 'servir.json'));
  assert.equal(atelier({ rapports: avecLien }).servir().pose, null, 'un lien n’est jamais suivi');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le cache des interrupteurs de GitHub
// ---------------------------------------------------------------------------------------------------------------------------------------------

const fauxGithub = (reponse, { configure = true } = {}) => {
  const g = { appels: [], configure: () => configure, lireUnFichier: async (chemin, o) => { g.appels.push({ chemin, ...o }); return typeof reponse === 'function' ? reponse() : reponse; } };
  return g;
};
const erreur = (genre) => Object.assign(new Error('x'), genre ? { genre } : {});
const horloge = () => { const h = { ms: Date.parse('2026-11-19T10:00:00Z'), instant: () => h.ms }; return h; };

test('interrupteurs de GitHub : trois états par clé (allumée, éteinte, inconnue), absent = éteint, une clé illisible n’inquiète que sa clé', async () => {
  const lire = async (texte) => {
    const c = creerLesInterrupteursDeGithub({ github: fauxGithub(texte), instant: horloge().instant });
    c.lire();
    await c.attendre();
    return c.lire();
  };
  let l = await lire('{ "actif": true, "gel_des_fusions": false }');
  assert.deepEqual([l.actif.etat, l.gel_des_fusions.etat, l.actif.raison, l.actif.lu_le], [true, false, null, '2026-11-19T10:00:00.000Z']);
  l = await lire('{ "gel_des_fusions": true }');
  assert.deepEqual([l.actif.etat, l.gel_des_fusions.etat], [false, true], 'une clé absente est éteinte, comme pour la CI');
  l = await lire('{ "actif": "oui", "gel_des_fusions": true }');
  assert.deepEqual([l.actif.etat, l.actif.raison, l.gel_des_fusions.etat], [null, 'valeur_illisible', true]);
  l = await lire('pas du json');
  assert.deepEqual([l.actif.etat, l.actif.raison, l.gel_des_fusions.etat, l.gel_des_fusions.raison, l.actif.lu_le], [null, 'fichier_illisible', null, 'fichier_illisible', null]);
  const g = fauxGithub('{}');
  const c = creerLesInterrupteursDeGithub({ github: g, instant: horloge().instant });
  c.lire();
  await c.attendre();
  assert.deepEqual(g.appels, [{ chemin: CHEMIN_DES_INTERRUPTEURS, ref: 'dev' }], 'le fichier des interrupteurs, lu sur dev');
});

test('interrupteurs de GitHub : un échec, un jeton absent ou refusé et l’absence de client donnent null avec la raison, jamais false', async () => {
  for (const [genre, raison] of [['refuse', 'jeton_refuse'], ['droit', 'droit_manquant'], ['introuvable', 'fichier_introuvable'], [undefined, 'github_injoignable']]) {
    const c = creerLesInterrupteursDeGithub({ github: fauxGithub(() => { throw erreur(genre); }), instant: horloge().instant });
    c.lire();
    await c.attendre();
    const l = c.lire();
    for (const cle of ['actif', 'gel_des_fusions']) assert.deepEqual([l[cle].etat, l[cle].raison, l[cle].lu_le], [null, raison, null], `${cle} (${raison})`);
  }
  const sansJeton = fauxGithub('{}', { configure: false });
  const c = creerLesInterrupteursDeGithub({ github: sansJeton, instant: horloge().instant });
  assert.equal(c.lire().actif.raison, 'sans_jeton');
  assert.deepEqual(sansJeton.appels, [], 'sans jeton, GitHub n’est pas interrogé');
  assert.equal(creerLesInterrupteursDeGithub({ github: null }).lire().gel_des_fusions.raison, 'github_absent');
  assert.equal(creerLesInterrupteursDeGithub({ github: { configure: () => true } }).lire().actif.raison, 'github_absent', 'un client sans lecture de fichier');
  for (const raison of Object.keys(PHRASES_DES_RAISONS)) assert.equal(typeof PHRASES_DES_RAISONS[raison], 'string', raison);
});

test('interrupteurs de GitHub : lire() ne bloque jamais ; une seule relecture à la fois ; la valeur périmée se sert pendant qu’elle est relue ; un échec se retente plus tôt', async () => {
  const h = horloge();
  let lever;
  const g = fauxGithub(() => new Promise((resolu) => { lever = resolu; }));
  const c = creerLesInterrupteursDeGithub({ github: g, instant: h.instant });
  const premier = c.lire();
  c.lire();
  c.lire();
  assert.equal(premier.actif.raison, 'pas_encore_lu', 'GitHub n’a pas répondu : la page reçoit « pas encore lu », sans attendre');
  assert.equal(g.appels.length, 1, 'une seule lecture en cours, malgré trois demandes');
  lever('{ "actif": true }');
  await c.attendre();
  assert.equal(c.lire().actif.etat, true);
  assert.equal(g.appels.length, 1, 'valeur encore valable : pas de relecture');
  h.ms += VALIDITE_MS;
  const perimee = c.lire();
  assert.equal(perimee.actif.etat, true, 'la valeur périmée est servie pendant la relecture');
  assert.equal(g.appels.length, 2);
  lever('{ "actif": false }');
  await c.attendre();
  assert.equal(c.lire().actif.etat, false);

  const h2 = horloge();
  let panne = true;
  const g2 = fauxGithub(() => { if (panne) throw erreur(); return '{ "actif": true }'; });
  const c2 = creerLesInterrupteursDeGithub({ github: g2, instant: h2.instant });
  c2.lire();
  await c2.attendre();
  assert.equal(c2.lire().actif.etat, null);
  assert.equal(g2.appels.length, 1);
  assert.ok(DELAI_APRES_ECHEC_MS < VALIDITE_MS, 'un échec se retente avant la fin de la validité d’une lecture réussie');
  panne = false;
  h2.ms += DELAI_APRES_ECHEC_MS;
  c2.lire();
  await c2.attendre();
  assert.equal(c2.lire().actif.etat, true);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le rapport (pur)
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('etatDeLaBascule2 : db/bascule-2 est toujours vrai ou faux ; l’interrupteur de la production n’est jamais « faux » : vu posé par un rapport, sinon inconnu', () => {
  const github = creerLesInterrupteursDeGithub({ github: null }).lire();
  const base = { marqueur: true, servir: { pose: false, depuis: null }, github, activation: null, dossierDesPaquets: true };
  let r = etatDeLaBascule2(base);
  assert.deepEqual(Object.keys(r.interrupteurs), INTERRUPTEURS);
  assert.deepEqual([r.interrupteurs.db_bascule_2.etat, r.interrupteurs.atelier_servir.etat, r.interrupteurs.activation_par_paquet.etat], [true, false, null]);
  assert.equal(r.interrupteurs.activation_par_paquet.raison, 'aucune_activation');
  assert.equal(etatDeLaBascule2({ ...base, marqueur: undefined }).interrupteurs.db_bascule_2.etat, false);
  assert.equal(etatDeLaBascule2({ ...base, dossierDesPaquets: false }).interrupteurs.activation_par_paquet.raison, 'pas_de_dossier_des_paquets');
  assert.equal(etatDeLaBascule2({ ...base, servir: null }).interrupteurs.atelier_servir.raison, 'atelier_non_installe');
  r = etatDeLaBascule2({ ...base, activation: { etat: 'refusee', le: '2026-11-20T10:00:00Z' } });
  assert.deepEqual([r.interrupteurs.activation_par_paquet.etat, r.interrupteurs.activation_par_paquet.vu_le, r.activation.etat], [true, '2026-11-20T10:00:00Z', 'refusee'], 'même un rapport de refus dit que l’interrupteur existait');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La route
// ---------------------------------------------------------------------------------------------------------------------------------------------

const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const appel = (service) => traiter({ methode: 'GET', chemin: '/api/mise-a-jour/', entetes: {} }, service);
const serviceDeDev = (surcharge = {}) => ({ base: () => db, etat: () => ({ version: '0.1.76' }), edition: true, dossier: join(racine, 'db'), reference: null, depot: 'x/y', github: null, source: () => true, bascule2: () => false, ...surcharge });
const RAPPORT = { format: 'maverick-activation/1', etat: 'passee', le: '2026-11-20T10:00:00Z', version: '0.6', depuis: '0.5', raisons: [], phrase: 'ok', geste: null, lot: null, mode: 'paquet', pages: 10, duree_s: 20, gel_leve: true };

test('GET /api/mise-a-jour/ : `bascule_2` sur le site de dev, cinq interrupteurs en true, false ou null (raison dite), même sans le marqueur ni GitHub', async () => {
  const r = await appel(serviceDeDev());
  assert.equal(r.statut, 200, JSON.stringify(r.corps).slice(0, 300));
  const b = r.corps.bascule_2;
  assert.deepEqual(Object.keys(b.interrupteurs), INTERRUPTEURS);
  for (const [nom, i] of Object.entries(b.interrupteurs)) {
    assert.ok(ETATS_PERMIS.includes(i.etat), nom);
    if (i.etat === null) assert.ok(i.raison in PHRASES_DES_RAISONS && typeof i.phrase === 'string', `${nom} : une raison de la liste fermée`);
    else assert.deepEqual([i.raison, i.phrase], [null, null], nom);
  }
  assert.equal(b.interrupteurs.db_bascule_2.etat, false, 'sans le marqueur : éteint');
  assert.equal(b.interrupteurs.gel_des_fusions.raison, 'github_absent');
  assert.equal(b.interrupteurs.atelier_servir.raison, 'atelier_non_installe');
  assert.equal(b.interrupteurs.activation_par_paquet.raison, 'pas_de_dossier_des_paquets');
  assert.equal(b.activation, null);
  // en déploiement, MAVERICK_PAQUETS est toujours donné, mais monté sur /dev/null tant que `poser-bascule-2` n'est pas fait : un chemin qui n'est pas un dossier n'est pas « monté »
  const unFichier = join(racine, 'pas-un-dossier');
  writeFileSync(unFichier, '');
  for (const paquets of [unFichier, join(racine, 'absent'), '']) {
    assert.equal(estUnDossier(paquets), false, paquets);
    assert.equal((await appel(serviceDeDev({ paquets }))).corps.bascule_2.interrupteurs.activation_par_paquet.raison, 'pas_de_dossier_des_paquets', paquets);
  }
  assert.equal(estUnDossier(racine), true);
  assert.equal('activation_production' in r.corps, false, 'sans le marqueur, activation_production n’existe pas (comme avant)');
  assert.equal((await appel(serviceDeDev({ bascule2: () => true }))).corps.bascule_2.interrupteurs.db_bascule_2.etat, true);
});

test('GET /api/mise-a-jour/ : GitHub n’est jamais attendu ; la lecture arrivée, la page la montre avec sa date', async () => {
  let lever;
  const github = { configure: () => true, suivre: async () => null, lireUnFichier: () => new Promise((resolu) => { lever = resolu; }) };
  const service = serviceDeDev({ github, interrupteursGithub: creerLesInterrupteursDeGithub({ github }) });
  const r = await appel(service); // si la réponse attendait GitHub, ce test ne finirait pas
  assert.equal(r.statut, 200);
  assert.deepEqual([r.corps.bascule_2.interrupteurs.actif.etat, r.corps.bascule_2.interrupteurs.actif.raison], [null, 'pas_encore_lu']);
  lever('{ "actif": true, "gel_des_fusions": false }');
  await service.interrupteursGithub.attendre();
  const b = (await appel(service)).corps.bascule_2.interrupteurs;
  assert.deepEqual([b.actif.etat, b.gel_des_fusions.etat], [true, false]);
  assert.match(b.actif.lu_le, /^\d{4}-\d\d-\d\dT/);
});

test('GET /api/mise-a-jour/ : l’atelier et le dernier rapport d’activation ; le rapport sert à `activation_production` (inchangé, seulement avec le marqueur) et à `bascule_2`', async () => {
  const partage = join(dossierTemporaire('bascule-2-etat-paquets'), 'paquets');
  mkdirSync(partage);
  const atelier = { servir: () => ({ pose: true, depuis: '2026-11-18T08:00:00Z' }), lire: () => { throw new Error('l’état complet de l’atelier n’est pas lu'); } };
  let r = await appel(serviceDeDev({ paquets: partage, atelier }));
  assert.deepEqual([r.corps.bascule_2.interrupteurs.atelier_servir.etat, r.corps.bascule_2.interrupteurs.atelier_servir.depuis], [true, '2026-11-18T08:00:00Z']);
  assert.deepEqual([r.corps.bascule_2.interrupteurs.activation_par_paquet.etat, r.corps.bascule_2.interrupteurs.activation_par_paquet.raison], [null, 'aucune_activation'], 'un dossier sans rapport : inconnu, pas « éteint »');
  assert.equal(r.corps.bascule_2.activation, null);
  writeFileSync(join(partage, 'activation.json'), JSON.stringify(RAPPORT));
  const attendu = lireLActivation(partage);
  assert.ok(attendu, 'le rapport du test est valide');
  r = await appel(serviceDeDev({ paquets: partage, bascule2: () => true }));
  assert.deepEqual(r.corps.activation_production, attendu, 'activation_production : le rapport, tel que le lit lireLActivation');
  assert.deepEqual(r.corps.bascule_2.activation, attendu, 'le même rapport dans bascule_2, même avec le marqueur');
  assert.deepEqual([r.corps.bascule_2.interrupteurs.activation_par_paquet.etat, r.corps.bascule_2.interrupteurs.activation_par_paquet.vu_le], [true, attendu.le]);
  r = await appel(serviceDeDev({ paquets: partage, bascule2: () => false }));
  assert.equal('activation_production' in r.corps, false, 'sans le marqueur, le champ d’avant n’existe pas');
  assert.deepEqual(r.corps.bascule_2.activation, attendu, 'mais le rapport est montré, en lecture seule, dans bascule_2');
});

test('GET /api/mise-a-jour/ : ni secret ni chemin du serveur dans `bascule_2` ; en production (sans le service d’édition), la route n’existe pas et `bascule_2` non plus', async () => {
  const partage = join(dossierTemporaire('bascule-2-etat-secret'), 'paquets');
  mkdirSync(partage);
  writeFileSync(join(partage, 'activation.json'), JSON.stringify(RAPPORT));
  const JETON = 'jeton-secret-de-test';
  const github = { configure: () => true, suivre: async () => null, jeton: JETON, lireUnFichier: async () => { throw erreur('droit'); } };
  const service = serviceDeDev({ paquets: partage, github, interrupteursGithub: creerLesInterrupteursDeGithub({ github }), atelier: { servir: () => ({ pose: true, depuis: '2026-11-18T08:00:00Z' }) } });
  await appel(service);
  await service.interrupteursGithub.attendre();
  const texte = JSON.stringify((await appel(service)).corps.bascule_2);
  for (const interdit of [JETON, racine, partage, 'Bearer']) assert.equal(texte.includes(interdit), false, `« ${interdit.slice(0, 20)} » ne sort pas`);
  const production = await appel({ ...serviceDeDev(), edition: false });
  assert.equal(production.statut, 403);
  assert.equal(JSON.stringify(production.corps).includes('bascule_2'), false);
});
