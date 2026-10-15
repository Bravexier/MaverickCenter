// « Importer (en ligne) » de la fiche (demande du propriétaire, 2026-10-15 : « Demande l'url d'un Google Sheet » ; précision choisie : « Feuille
// partagée par lien ») : le service télécharge la feuille au format .xlsx (serveur/classeur.mjs, POST /api/classeur/ de serveur/api.mjs), avec un
// faux Google (fetch injecté : le réseau de la session ne joint pas docs.google.com) — adresse d'export construite, redirections permises et
// refusées, feuille non partagée (page de connexion, 401/403, HTML), taille, délai, débit, simultanéité, annulation, et jamais l'adresse ni
// l'identifiant de la feuille au journal ou aux métriques ; la route (garde des écritures, réponse binaire, promesse) ; puis le vrai serveur HTTP.
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import {
  ANNULE, ErreurClasseur, GOOGLE_INJOIGNABLE, GOOGLE_LENT, GOOGLE_LIMITE, INTROUVABLE, LIEN_ATTENDU, NOM_PAR_DEFAUT, NON_PARTAGEE, OCTETS_MAX, PAR_MINUTE,
  REDIRECTIONS_MAX, SIMULTANES, TROP_A_LA_FOIS, TROP_GROSSE, TROP_PAR_MINUTE, creerClasseurEnLigne,
} from '../serveur/classeur.mjs';
import { categorieDuMessage } from '../serveur/journal-du-service.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import { TYPE_XLSX } from '../src/lib/google-sheets.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-classeur-'));
after(() => rmSync(racine, { recursive: true, force: true }));

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd';
const LIEN = `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing#gid=0`;
const EXPORT = `https://docs.google.com/spreadsheets/d/${ID}/export?format=xlsx`;
const FICHIER = 'https://doc-0s-4c-sheets.googleusercontent.com/export/abc/def/1700000000000/xyz/123?format=xlsx&id=x';
const XLSX = Buffer.from(await modeleXlsx());
const DISPOSITION = 'attachment; filename="Fiche de Kael.xlsx"; filename*=UTF-8\'\'Fiche%20de%20Ka%C3%ABl.xlsx';

/** Un faux Google : chaque appel de fetch prend l'étape suivante (la dernière se répète) ; `appels` garde l'adresse et les options. */
function fauxGoogle(...etapes) {
  const appels = [];
  const f = (adresse, options) => {
    appels.push({ adresse: String(adresse), options });
    return etapes[Math.min(appels.length - 1, etapes.length - 1)](adresse, options);
  };
  f.appels = appels;
  return f;
}
const redirection = (location, statut = 307) => async () => new Response(null, { status: statut, headers: location === null ? {} : { location } });
const classeur = (octets = XLSX, entetes = {}) => async () => new Response(octets, { status: 200, headers: { 'content-type': TYPE_XLSX, 'content-disposition': DISPOSITION, ...entetes } });
const statut = (n, corps = 'non', type = 'text/html; charset=utf-8') => async () => new Response(corps, { status: n, headers: { 'content-type': type } });

/** Un téléchargeur avec ses comptes rendus (évènements des métriques, journal). */
function telechargeur(fetch, o = {}) {
  const evenements = [];
  const journal = [];
  const c = creerClasseurEnLigne({ fetch, evenement: (type, e) => evenements.push({ type, ...e }), journal: (l) => journal.push(l), ...o });
  return { c, evenements, journal };
}
/** Le statut et le message d'un refus. */
async function refus(promesse) {
  try {
    await promesse;
  } catch (e) {
    assert.ok(e instanceof ErreurClasseur, `ErreurClasseur attendue : ${e?.stack ?? e}`);
    return [e.statut, e.message];
  }
  assert.fail('refus attendu');
}
/** Rien de l'adresse ni de l'identifiant de la feuille dans ce qui est noté. */
function sansLaFeuille(...notes) {
  const texte = JSON.stringify(notes);
  assert.ok(!texte.includes(ID) && !texte.includes('googleusercontent') && !texte.includes('docs.google.com'), texte);
}

test('bornes : 16 Mio, 5 redirections, 2 à la fois, 30 par minute', () => {
  assert.deepEqual([OCTETS_MAX, REDIRECTIONS_MAX, SIMULTANES, PAR_MINUTE], [16 * 1024 * 1024, 5, 2, 30]);
});

test('une feuille partagée par lien : l’adresse d’export construite (jamais l’adresse reçue), une redirection vers googleusercontent.com suivie, les octets et le nom', async () => {
  const fetch = fauxGoogle(redirection(FICHIER), classeur());
  const { c, evenements, journal } = telechargeur(fetch);
  const r = await c.telecharger(LIEN);
  assert.deepEqual(r.octets, XLSX);
  assert.equal(r.nom, 'Fiche de Kaël.xlsx');
  assert.deepEqual(fetch.appels.map((a) => a.adresse), [EXPORT, FICHIER]);
  for (const a of fetch.appels) assert.equal(a.options.redirect, 'manual', 'chaque redirection vérifiée par le service');
  assert.deepEqual(evenements.map((e) => [e.type, e.detail]), [['classeur', { statut: 200, octets: XLSX.length, redirections: 1 }]]);
  assert.equal(journal.length, 1);
  assert.equal(categorieDuMessage(journal[0]), 'fiches', 'rangé avec les fiches (page Debug)');
  sansLaFeuille(evenements, journal);
  // une redirection relative (même hôte) ; un 302 ou 303 aussi ; sans nom chez Google : NOM_PAR_DEFAUT
  const relative = fauxGoogle(redirection(`/spreadsheets/d/${ID}/export?format=xlsx&gid=0`, 302), classeur(XLSX, { 'content-disposition': '' }));
  const r2 = await telechargeur(relative).c.telecharger(`https://docs.google.com/spreadsheets/u/1/d/${ID}/`);
  assert.equal(relative.appels[1].adresse, `https://docs.google.com/spreadsheets/d/${ID}/export?format=xlsx&gid=0`);
  assert.equal(r2.nom, NOM_PAR_DEFAUT);
});

test('feuille non partagée par lien : la page de connexion de Google, un 401 ou 403, une page HTML → 403 avec le geste à faire', async () => {
  for (const etapes of [
    [redirection('https://accounts.google.com/ServiceLogin?continue=https://docs.google.com/x')],
    [redirection(FICHIER), redirection('https://accounts.google.com/v3/signin/identifier?x=1', 302)],
    [statut(401)], [statut(403)],
    [classeur(Buffer.from('<!DOCTYPE html><html><body>Connexion</body></html>'), { 'content-type': 'text/html; charset=utf-8' })],
    [classeur(Buffer.from('<!DOCTYPE html><html><body>Accès refusé</body></html>'), { 'content-type': 'application/octet-stream' })],
    [classeur(Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0]))],
    [classeur(Buffer.from('PK'))],
  ]) {
    const fetch = fauxGoogle(...etapes);
    const { c, evenements, journal } = telechargeur(fetch);
    assert.deepEqual(await refus(c.telecharger(LIEN)), [403, NON_PARTAGEE]);
    assert.equal(evenements[0].detail.statut, 403);
    assert.equal(categorieDuMessage(journal[0]), 'fiches');
    sansLaFeuille(evenements, journal);
  }
  assert.match(NON_PARTAGEE, /Tous les utilisateurs disposant du lien/);
});

test('redirections refusées : un autre hôte (evilgoogleusercontent.com, googleusercontent.com.evil.com…), http, sans adresse ; plus de 5 → 502, jamais suivies', async () => {
  for (const location of ['https://evilgoogleusercontent.com/x', 'https://googleusercontent.com.evil.com/x', 'http://doc-0s.googleusercontent.com/x',
    'https://www.google.com/sorry/index?continue=x', 'https://user:mdp@doc.googleusercontent.com/x', 'javascript:alert(1)', null]) {
    const fetch = fauxGoogle(redirection(location), classeur());
    const [code] = await refus(telechargeur(fetch).c.telecharger(LIEN));
    assert.equal(code, 502, String(location));
    assert.equal(fetch.appels.length, 1, `${location} : pas suivie`);
  }
  // REDIRECTIONS_MAX permises, une de plus refusée
  const cinq = fauxGoogle(...Array.from({ length: REDIRECTIONS_MAX }, () => redirection(FICHIER)), classeur());
  assert.deepEqual((await telechargeur(cinq).c.telecharger(LIEN)).octets, XLSX);
  const six = fauxGoogle(redirection(FICHIER));
  const { c, evenements } = telechargeur(six);
  assert.deepEqual(await refus(c.telecharger(LIEN)), [502, 'Trop de redirections de Google.']);
  assert.equal(six.appels.length, REDIRECTIONS_MAX + 1);
  assert.equal(evenements[0].detail.redirections, REDIRECTIONS_MAX + 1);
});

test('lien invalide → 400 sans rien demander à Google ; feuille introuvable 404 ; Google en panne 502, limité 429, injoignable 502', async () => {
  const rien = fauxGoogle(classeur());
  const { c, evenements } = telechargeur(rien);
  for (const lien of ['https://evil.com/spreadsheets/d/x', `http://docs.google.com/spreadsheets/d/${ID}/edit`, '', null, 42, { url: LIEN }]) {
    assert.deepEqual(await refus(c.telecharger(lien)), [400, LIEN_ATTENDU], String(lien));
  }
  assert.equal(rien.appels.length, 0);
  assert.equal(evenements.length, 0, 'un lien refusé n’est ni compté ni noté');
  assert.deepEqual(await refus(telechargeur(fauxGoogle(statut(404))).c.telecharger(LIEN)), [404, INTROUVABLE]);
  assert.deepEqual(await refus(telechargeur(fauxGoogle(statut(500))).c.telecharger(LIEN)), [502, 'Google n’a pas rendu la feuille (HTTP 500).']);
  assert.deepEqual(await refus(telechargeur(fauxGoogle(statut(429))).c.telecharger(LIEN)), [429, GOOGLE_LIMITE]);
  assert.deepEqual(await refus(telechargeur(fauxGoogle(async () => { throw new TypeError('fetch failed'); })).c.telecharger(LIEN)), [502, GOOGLE_INJOIGNABLE]);
});

test('taille : annoncée au-delà de la borne (corps jamais lu), ou lue par morceaux et arrêtée au-delà → 413', async () => {
  let tires = 0;
  let abandonne = false;
  const annonce = fauxGoogle(async () => new Response(new ReadableStream({
    pull(c) {
      tires += 1;
      c.enqueue(new Uint8Array(1024));
    },
    cancel() { abandonne = true; },
  }, { highWaterMark: 0 }), { status: 200, headers: { 'content-type': TYPE_XLSX, 'content-length': String(OCTETS_MAX + 1) } }));
  assert.deepEqual(await refus(telechargeur(annonce).c.telecharger(LIEN)), [413, TROP_GROSSE]);
  assert.deepEqual([tires, abandonne], [0, true], 'corps abandonné sans lecture');
  // sans taille annoncée : la lecture s'arrête au premier morceau de trop, et le flux est abandonné
  let morceaux = 0;
  let annule = false;
  const flux = fauxGoogle(async () => new Response(new ReadableStream({
    pull(c) {
      morceaux += 1;
      c.enqueue(morceaux === 1 ? Uint8Array.of(0x50, 0x4b, 0x03, 0x04, ...new Uint8Array(396)) : new Uint8Array(400));
    },
    cancel() { annule = true; },
  }), { status: 200, headers: { 'content-type': TYPE_XLSX } }));
  const { c, evenements } = telechargeur(flux, { octetsMax: 1000 });
  assert.deepEqual(await refus(c.telecharger(LIEN)), [413, TROP_GROSSE]);
  assert.ok(morceaux <= 4, `${morceaux} morceaux lus`);
  assert.equal(annule, true, 'flux abandonné');
  assert.equal(evenements[0].detail.statut, 413);
  // exactement la borne : accepté
  const juste = Buffer.concat([XLSX.subarray(0, 4), Buffer.alloc(996)]);
  assert.equal((await telechargeur(fauxGoogle(classeur(juste)), { octetsMax: 1000 }).c.telecharger(LIEN)).octets.length, 1000);
});

test('délai : Google qui ne répond pas, ou qui s’arrête au milieu du fichier → 504 (même si son fetch ignore le signal)', async () => {
  const muet = fauxGoogle(() => new Promise(() => {}));
  const t0 = performance.now();
  assert.deepEqual(await refus(telechargeur(muet, { delai: 60 }).c.telecharger(LIEN)), [504, GOOGLE_LENT]);
  assert.ok(performance.now() - t0 < 2000);
  const lent = fauxGoogle(async () => new Response(new ReadableStream({
    start(c) { c.enqueue(Uint8Array.of(0x50, 0x4b, 0x03, 0x04)); },
    pull() { return new Promise(() => {}); },
  }), { status: 200, headers: { 'content-type': TYPE_XLSX } }));
  assert.deepEqual(await refus(telechargeur(lent, { delai: 60 }).c.telecharger(LIEN)), [504, GOOGLE_LENT]);
  // le signal passé à fetch est celui du délai
  assert.ok(muet.appels[0].options.signal instanceof AbortSignal);
  assert.equal(muet.appels[0].options.signal.aborted, true);
});

test('simultanéité (2 à la fois) et débit (30 par minute) pour tout le service → 429 ; le visiteur qui part annule (499) et libère sa place', async () => {
  const attentes = [];
  const fetch = fauxGoogle(() => new Promise((ok) => attentes.push(ok)));
  let maintenant = 1_000_000;
  const { c } = telechargeur(fetch, { horloge: () => maintenant });
  const un = c.telecharger(LIEN);
  const deux = c.telecharger(LIEN);
  assert.deepEqual(await refus(c.telecharger(LIEN)), [429, TROP_A_LA_FOIS]);
  await new Promise((ok) => setImmediate(ok));
  for (const ok of attentes.splice(0)) ok(new Response(XLSX, { status: 200 }));
  assert.deepEqual([(await un).octets, (await deux).octets], [XLSX, XLSX]);
  // débit : PAR_MINUTE téléchargements commencés dans la minute (les deux d'avant compris), puis 429 jusqu'à ce qu'une minute passe
  const vite = telechargeur(fauxGoogle(classeur()), { horloge: () => maintenant }).c;
  for (let i = 0; i < PAR_MINUTE; i++) await vite.telecharger(LIEN);
  assert.deepEqual(await refus(vite.telecharger(LIEN)), [429, TROP_PAR_MINUTE]);
  maintenant += 59_999;
  assert.deepEqual(await refus(vite.telecharger(LIEN)), [429, TROP_PAR_MINUTE]);
  maintenant += 1;
  assert.deepEqual((await vite.telecharger(LIEN)).octets, XLSX);
  // annulation : le signal du visiteur arrête le téléchargement (même un fetch qui l'ignorerait), la place se libère
  const pendus = fauxGoogle(() => new Promise(() => {}));
  const { c: c2, evenements } = telechargeur(pendus, { horloge: () => maintenant });
  const visiteur = new AbortController();
  const premier = c2.telecharger(LIEN, { signal: visiteur.signal });
  const second = c2.telecharger(LIEN, { signal: AbortSignal.timeout(30) });
  visiteur.abort(new Error('parti'));
  assert.deepEqual(await refus(premier), [499, ANNULE]);
  assert.deepEqual(await refus(second), [499, ANNULE]);
  assert.equal(pendus.appels[0].options.signal.aborted, true, 'fetch reçoit l’annulation');
  assert.deepEqual(evenements.map((e) => e.detail.statut), [499, 499]);
  const apres = telechargeur(fauxGoogle(classeur()), { horloge: () => maintenant }).c;
  assert.deepEqual((await apres.telecharger(LIEN)).octets, XLSX);
});

// ------------------------------------------------------------------ la route (serveur/api.mjs)

const JSON_ = { 'content-type': 'application/json' };
const appel = (methode, chemin, corps, { entetes = JSON_, classeur: cl, signal } = {}) => traiter(
  { methode, chemin, entetes, corps: corps === undefined ? undefined : typeof corps === 'string' ? corps : JSON.stringify(corps), signal },
  { base: () => null, etat: () => ({}), classeur: cl },
);

test('POST /api/classeur/ : garde des écritures (405, 415, 403, 400, 404), 503 sans téléchargeur ; sans la base ; une promesse → les octets, leur type et leur nom', async () => {
  const fetch = fauxGoogle(redirection(FICHIER), classeur());
  const { c } = telechargeur(fetch);
  const get = appel('GET', '/api/classeur/', undefined, { classeur: c });
  assert.deepEqual([get.statut, get.entetes.Allow], [405, 'POST']);
  assert.equal(appel('POST', '/api/classeur/', { url: LIEN }, { entetes: { 'content-type': 'text/plain' }, classeur: c }).statut, 415);
  assert.equal(appel('POST', '/api/classeur/', { url: LIEN }, { entetes: { ...JSON_, 'sec-fetch-site': 'cross-site' }, classeur: c }).statut, 403);
  assert.equal(appel('POST', '/api/classeur/', '{', { classeur: c }).statut, 400);
  assert.equal(appel('POST', '/api/classeur/x/', { url: LIEN }, { classeur: c }).statut, 404);
  assert.equal(appel('POST', '/api/classeur/x/y/', { url: LIEN }, { classeur: c }).statut, 404);
  assert.equal(appel('POST', '/api/classeur/', { url: LIEN }).statut, 503);
  assert.equal(fetch.appels.length, 0);
  // la réponse : une promesse (la seule route asynchrone), sans la base (base() rend null)
  const promesse = appel('POST', '/api/classeur', { url: LIEN }, { entetes: { ...JSON_, 'sec-fetch-site': 'same-origin' }, classeur: c });
  assert.equal(typeof promesse.then, 'function');
  const r = await promesse;
  assert.equal(r.statut, 200);
  assert.deepEqual(r.brut, XLSX);
  assert.equal(r.entetes['Content-Type'], TYPE_XLSX);
  assert.equal(r.entetes['Content-Disposition'], 'attachment; filename="Fiche de Ka_l.xlsx"; filename*=UTF-8\'\'Fiche%20de%20Ka%C3%ABl.xlsx');
  // un refus de Google : la réponse d'erreur, en JSON
  const non = await appel('POST', '/api/classeur/', { url: LIEN }, { classeur: telechargeur(fauxGoogle(redirection('https://accounts.google.com/x'))).c });
  assert.deepEqual([non.statut, non.corps], [403, { erreur: NON_PARTAGEE }]);
  const faux = await appel('POST', '/api/classeur/', { url: 'https://evil.com/' }, { classeur: c });
  assert.deepEqual([faux.statut, faux.corps], [400, { erreur: LIEN_ATTENDU }]);
  const sansUrl = await appel('POST', '/api/classeur/', {}, { classeur: c });
  assert.equal(sansUrl.statut, 400);
  // une autre erreur remonte (le service en fait un 500)
  const casse = { telecharger: async () => { throw new Error('bogue'); } };
  await assert.rejects(appel('POST', '/api/classeur/', { url: LIEN }, { classeur: casse }), /bogue/);
  // un nom de feuille qui contient des caractères de l'en-tête : encodés
  const drole = await appel('POST', '/api/classeur/', { url: LIEN }, {
    classeur: { telecharger: async () => ({ octets: XLSX, nom: 'a"b\\c\'(d)*é.xlsx' }) },
  });
  assert.equal(drole.entetes['Content-Disposition'], 'attachment; filename="a_b_c\'(d)*_.xlsx"; filename*=UTF-8\'\'a%22b%5Cc%27%28d%29%2A%C3%A9.xlsx');
});

// ------------------------------------------------------------------ le vrai serveur HTTP

test('serveur HTTP : la réponse binaire (Content-Type, Content-Length), la route « /api/classeur/ » des métriques ; un visiteur qui part annule sans erreur ; rien de la feuille au journal', async () => {
  const pendus = [];
  let mode = 'normal';
  const fetch = fauxGoogle(async (adresse, options) => {
    if (mode === 'pendu') {
      return new Promise((ok, ko) => {
        pendus.push(options.signal);
        options.signal.addEventListener('abort', () => ko(options.signal.reason));
      });
    }
    return adresse.includes('googleusercontent') ? classeur()() : redirection(FICHIER)();
  });
  const lignes = [];
  const s = await demarrerService({
    regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db'), port: 0, intervalle: 0, edition: true, fetch,
    journal: (message, options) => lignes.push({ message, options }), metriques: { dossier: join(racine, 'metriques'), instance: 'dev' }, relancer: () => {},
  });
  try {
    const r = await globalThis.fetch(`${s.url}/api/classeur/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ url: LIEN }) });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), TYPE_XLSX);
    assert.equal(Number(r.headers.get('content-length')), XLSX.length);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-disposition'), /filename\*=UTF-8''Fiche%20de%20Ka%C3%ABl\.xlsx/);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), XLSX);
    const refuse = await globalThis.fetch(`${s.url}/api/classeur/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://evil.com/' }) });
    assert.deepEqual([refuse.status, await refuse.json()], [400, { erreur: LIEN_ATTENDU }]);
    // le visiteur part pendant que le service attend Google : le téléchargement est annulé, rien ne casse, la requête suivante passe
    mode = 'pendu';
    await new Promise((ok) => {
      const req = request(`${s.url}/api/classeur/`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      req.on('error', () => ok());
      req.end(JSON.stringify({ url: LIEN }));
      const attendre = setInterval(() => {
        if (pendus.length) {
          clearInterval(attendre);
          req.destroy();
          ok();
        }
      }, 5);
    });
    for (let i = 0; i < 100 && !pendus[0]?.aborted; i++) await new Promise((ok) => setTimeout(ok, 10));
    assert.equal(pendus[0]?.aborted, true, 'téléchargement annulé quand le visiteur part');
    mode = 'normal';
    for (let i = 0; i < 100 && !s.metriques.requetes({ route_exacte: '/api/classeur/', statut: '499' }).requetes.length; i++) await new Promise((ok) => setTimeout(ok, 10));
    const r2 = await globalThis.fetch(`${s.url}/api/classeur/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: LIEN }) });
    assert.equal(r2.status, 200);
    await r2.arrayBuffer();
    // métriques : la route normalisée, sans identifiant ; le 499 du visiteur parti
    const vues = s.metriques.requetes({ route_exacte: '/api/classeur/' }).requetes;
    assert.deepEqual(vues.map((x) => x.statut).sort(), [200, 200, 400, 499]);
    for (const v of vues) assert.equal(v.adresse, '/api/classeur/');
    assert.ok(!lignes.some((l) => /^ERREUR/.test(l.message)), lignes.filter((l) => /^ERREUR/.test(l.message)).map((l) => l.message).join('\n'));
    assert.ok(lignes.some((l) => l.options?.categorie === 'http' && l.options.champs.route === '/api/classeur/' && l.options.champs.statut === 200));
    sansLaFeuille(lignes.map((l) => l.message), vues);
  } finally {
    await s.arreter();
  }
});
