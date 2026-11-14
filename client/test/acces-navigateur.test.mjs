// L'accès au site de dev dans le navigateur (src/scripts/acces.mjs ; R275 option b, « Un mot de passe pour modifier et pour lancer une mise à jour ; la
// lecture reste ouverte. »), exécuté dans un faux navigateur : sur un 401 qui porte `acces`, UNE fenêtre demande le mot de passe, le poste
// (POST /api/acces/), puis rejoue l'appel refusé ; des appels refusés en même temps partagent la même fenêtre ; un appel envoyé avant la connexion se
// rejoue sans redemander ; une session expirée redemande ; 401 et 429 se disent ; annuler rend le 401 d'origine (et les relèves en lecture ne rouvrent
// pas la fenêtre pendant 60 s) ; la connexion, la balise des pages et la relève de la maintenance ne passent jamais par la demande ; un lien de
// téléchargement du service passe par fetch. Le script n'importe rien (version portable : skill site-version-portable).
//   node --test test/acces-navigateur.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { attendre, cliquer, el, fauxDocument } from './aide-faux-dom.mjs';

let numero = 0;
const SOURCE = new URL('../src/scripts/acces.mjs', import.meta.url);

/**
 * Une page et son service factice. `service(adresse, methode, corps, n)` rend [statut, corps, entêtes?] ; `n` compte les appels déjà faits à cette
 * adresse avec cette méthode. `connecte` : la visite a déjà une session (sessionStorage). Rend le journal des appels (`appels`).
 */
async function ouvrir({ service, connecte = false, accueil = '/regles/' } = {}) {
  const appels = [];
  const telechargements = [];
  const compteurs = new Map();
  const pied = el('footer', { class: 'site-footer' }, el('span', {}, 'Projet'), el('span', { class: 'site-footer__version' }, 'v1'));
  const document = fauxDocument(el('main', {}), pied);
  document.head.append(el('meta', { name: 'maverick-api', content: '/api/' }));
  const creer = document.createElement;
  document.createElement = (tag) => {
    const e = creer(tag);
    if (tag === 'a') e.click = () => telechargements.push({ download: e.getAttribute('download'), href: e.href });
    return e;
  };
  const stockage = new Map(connecte ? [['maverick-acces', '1']] : []);
  const horloge = { maintenant: 1_000_000 };
  const dateNow = Date.now;
  Date.now = () => horloge.maintenant;
  // la libération de l'adresse du fichier (10 s dans le navigateur) ne retient pas le test
  const minuterie = globalThis.setTimeout;
  globalThis.setTimeout = (f, d, ...a) => minuterie(f, d >= 10000 ? 0 : d, ...a);
  Object.assign(globalThis, {
    document,
    location: { href: `http://site${accueil}` },
    sessionStorage: { getItem: (k) => stockage.get(k) ?? null, setItem: (k, v) => stockage.set(k, String(v)), removeItem: (k) => stockage.delete(k) },
    alert: () => {},
    fetch: async (entree, init) => {
      const adresse = new URL(typeof entree === 'string' ? entree : entree.url, `http://site${accueil}`);
      const methode = (init?.method ?? 'GET').toUpperCase();
      const cle = `${methode} ${adresse.pathname}`;
      const n = compteurs.get(cle) ?? 0;
      compteurs.set(cle, n + 1);
      const corps = init?.body ? JSON.parse(init.body) : undefined;
      appels.push({ methode, chemin: adresse.pathname, origine: adresse.origin, corps });
      const [statut, contenu, entetes] = service(adresse.pathname, methode, corps, n);
      return new Response(contenu === undefined ? null : typeof contenu === 'string' ? contenu : JSON.stringify(contenu), {
        status: statut,
        headers: { 'Content-Type': 'application/json', ...entetes },
      });
    },
  });
  await import(`${SOURCE.href}?page=${(numero += 1)}`);
  await attendre();
  const fenetre = () => document.querySelector('dialog');
  return {
    document,
    appels,
    telechargements,
    stockage,
    horloge,
    fenetre,
    pied,
    fin: () => { Date.now = dateNow; globalThis.setTimeout = minuterie; },
    /** Saisit `mot` dans la fenêtre ouverte et l'envoie ; rend la fenêtre. */
    async saisir(mot) {
      const f = fenetre();
      f.querySelector('input').value = mot;
      const envoi = new Event('submit', { cancelable: true });
      f.querySelector('form').dispatchEvent(envoi);
      await attendre();
      await attendre();
      return f;
    },
  };
}

const REFUS_ECRITURE = [401, { erreur: 'Mot de passe requis.', acces: 'mot_de_passe' }];
const OK_ACCES = [200, { protege: true, portee: 'ecriture', connecte: true, droit: 'ecriture', expire_le: 1 }];

/** Un service où `/api/edition/` refuse tant que le mot de passe n'a pas été posté, puis accepte. */
function serviceProtege(motDePasse = 'secret-de-dev') {
  const etat = { connecte: false, essais: 0 };
  const service = (chemin, methode, corps) => {
    if (chemin === '/api/acces/' && methode === 'POST') {
      etat.essais += 1;
      if (corps.mot_de_passe !== motDePasse) return [401, { erreur: 'Mot de passe incorrect.' }];
      etat.connecte = true;
      return OK_ACCES;
    }
    if (chemin === '/api/acces/' && methode === 'DELETE') { etat.connecte = false; return [200, { protege: true, connecte: false, droit: 'aucun' }]; }
    if (chemin === '/api/acces/') return etat.connecte ? OK_ACCES : [200, { protege: true, connecte: false, droit: 'aucun' }];
    if (chemin.startsWith('/api/')) return etat.connecte ? [200, { ok: true, chemin }] : REFUS_ECRITURE;
    return [200, {}];
  };
  return { etat, service };
}

test('un 401 qui porte `acces` ouvre une fenêtre accessible, poste le mot de passe, puis rejoue l’appel refusé (même méthode, même corps)', async () => {
  const { service, etat } = serviceProtege();
  const p = await ouvrir({ service });
  try {
    const attente = fetch('/api/edition/', { method: 'POST', body: JSON.stringify({ lot: 1 }) });
    await attendre();
    const f = p.fenetre();
    assert.ok(f, 'la fenêtre est ouverte');
    assert.equal(f.ouvert, true, 'fenêtre modale');
    const champ = f.querySelector('input');
    assert.equal(champ.getAttribute('type'), 'password');
    assert.equal(champ.getAttribute('autocomplete'), 'current-password');
    assert.ok(champ.required);
    assert.ok(f.querySelector('label')?.contains(champ), 'le champ a son libellé');
    assert.equal(f.querySelector('[role="alert"]').hidden, true, 'pas d’erreur au départ');
    assert.equal(f.getAttribute('aria-labelledby'), f.querySelector('h2').id);
    await p.saisir('secret-de-dev');
    const reponse = await attente;
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), { ok: true, chemin: '/api/edition/' });
    assert.equal(p.fenetre(), null, 'la fenêtre est retirée');
    // refus, connexion (corps = le mot de passe), rejeu identique
    assert.deepEqual(p.appels.map((a) => `${a.methode} ${a.chemin}`), ['POST /api/edition/', 'POST /api/acces/', 'POST /api/edition/']);
    assert.deepEqual(p.appels[2].corps, { lot: 1 });
    assert.equal(etat.essais, 1, 'une seule saisie');
    // la mention discrète du pied de page, avant la version ; l'état de la visite est gardé
    const mention = p.pied.querySelector('.acces-etat');
    assert.ok(mention, 'mention « connecté »');
    assert.equal(mention.nextElementSibling.className, 'site-footer__version');
    assert.equal(p.stockage.get('maverick-acces'), '1');
    // la suite de la visite : plus aucune demande
    const suite = await fetch('/api/edition/', { method: 'PUT', body: '{}' });
    assert.equal(suite.status, 200);
    assert.equal(p.fenetre(), null);
  } finally { p.fin(); }
});

test('sans refus (aucun mot de passe posé) : rien n’est demandé ni ajouté à l’écran, et l’appel n’est fait qu’une fois', async () => {
  const p = await ouvrir({ service: () => [200, { protege: false, droit: 'ecriture' }] });
  try {
    const r = await fetch('/api/edition/', { method: 'POST', body: '{}' });
    assert.equal(r.status, 200);
    assert.equal(p.fenetre(), null);
    assert.equal(p.pied.querySelector('.acces-etat'), null);
    assert.equal(p.appels.length, 1);
    // aucune requête de plus au chargement de la page
    assert.equal(p.appels.filter((a) => a.chemin === '/api/acces/').length, 0);
  } finally { p.fin(); }
});

test('des appels refusés en même temps attendent la même fenêtre : une saisie, une connexion, chacun rejoué', async () => {
  const { service, etat } = serviceProtege();
  const p = await ouvrir({ service });
  try {
    const trois = [fetch('/api/edition/', { method: 'POST', body: '{"a":1}' }), fetch('/api/mise-a-jour/brouillon/', { method: 'POST', body: '{"b":2}' }), fetch('/api/mise-a-jour/conflits/')];
    await attendre();
    assert.equal(p.document.querySelectorAll('dialog').length, 1, 'une seule fenêtre');
    await p.saisir('secret-de-dev');
    const reponses = await Promise.all(trois);
    assert.deepEqual(reponses.map((r) => r.status), [200, 200, 200]);
    assert.equal(etat.essais, 1);
    assert.equal(p.appels.filter((a) => a.chemin === '/api/acces/').length, 1);
    // chaque appel a été rejoué, avec son corps
    assert.deepEqual(p.appels.filter((a) => a.chemin === '/api/mise-a-jour/brouillon/').map((a) => a.corps), [{ b: 2 }, { b: 2 }]);
    assert.equal(p.document.querySelectorAll('.acces-etat').length, 1);
  } finally { p.fin(); }
});

test('un appel envoyé avant la connexion et refusé après elle est rejoué sans redemander', async () => {
  let ouvertes = 0;
  const { service, etat } = serviceProtege();
  let liberer;
  const tard = new Promise((r) => { liberer = r; });
  const p = await ouvrir({
    service: (chemin, methode, corps, n) => {
      if (chemin === '/api/lent/' && n === 0) return [401, { erreur: 'Mot de passe requis.', acces: 'mot_de_passe' }];
      return service(chemin, methode, corps, n);
    },
  });
  try {
    const brut = globalThis.fetch;
    // l'appel lent : sa réponse (refus) n'arrive qu'après la connexion d'un autre appel
    globalThis.fetch = async (entree, init) => {
      if (String(entree) === '/api/lent/') { const r = brut(entree, init); await tard; return r; }
      return brut(entree, init);
    };
    const lent = fetch('/api/lent/');
    const premier = fetch('/api/edition/', { method: 'POST', body: '{}' });
    await attendre();
    await p.saisir('secret-de-dev');
    await premier;
    ouvertes = p.document.querySelectorAll('dialog').length;
    liberer();
    const r = await lent;
    assert.equal(r.status, 200, 'rejoué');
    assert.equal(ouvertes, 0);
    assert.equal(p.document.querySelectorAll('dialog').length, 0, 'aucune seconde fenêtre');
    assert.equal(etat.essais, 1);
  } finally { p.fin(); }
});

test('un mot de passe faux (401) ou trop d’essais (429) se disent dans la fenêtre, qui reste ouverte ; le bon mot de passe ferme', async () => {
  const { service } = serviceProtege();
  let essais = 0;
  const p = await ouvrir({
    service: (chemin, methode, corps, n) => {
      if (chemin === '/api/acces/' && methode === 'POST') {
        essais += 1;
        if (essais === 2) return [429, { erreur: 'Trop d’essais.', attente_s: 120 }, { 'Retry-After': '120' }];
      }
      return service(chemin, methode, corps, n);
    },
  });
  try {
    const attente = fetch('/api/edition/', { method: 'DELETE' });
    await attendre();
    let f = await p.saisir('faux');
    const erreur = f.querySelector('[role="alert"]');
    assert.equal(erreur.hidden, false);
    assert.match(erreur.textContent, /incorrect/i);
    assert.equal(p.fenetre(), f, 'toujours ouverte');
    assert.equal(f.querySelector('input').value, '', 'le champ est vidé');
    f = await p.saisir('encore');
    assert.match(f.querySelector('[role="alert"]').textContent, /Trop d’essais.*2 min/);
    assert.equal(f.querySelector('[type="submit"]').disabled, false);
    await p.saisir('secret-de-dev');
    assert.equal((await attente).status, 200);
    assert.equal(p.fenetre(), null);
  } finally { p.fin(); }
});

test('annuler (bouton, Échap) rend à l’appelant son 401 d’origine ; une lecture refusée dans la minute ne rouvre pas la fenêtre, une écriture si', async () => {
  const { service } = serviceProtege();
  const p = await ouvrir({ service });
  try {
    const premier = fetch('/api/edition/', { method: 'POST', body: '{}' });
    await attendre();
    p.fenetre().querySelector('.acces-annuler').dispatchEvent(new Event('click'));
    const r = await premier;
    assert.equal(r.status, 401);
    assert.equal((await r.json()).acces, 'mot_de_passe', 'la réponse refusée est intacte, lisible par la page');
    assert.equal(p.fenetre(), null);
    assert.equal(p.pied.querySelector('.acces-etat'), null);
    // la relève d'une page (lecture) : pas de nouvelle fenêtre dans les 60 s
    const lecture = await fetch('/api/debug/tables/');
    assert.equal(lecture.status, 401);
    assert.equal(p.fenetre(), null);
    // une écriture refaite à la main : la fenêtre revient ; Échap (évènement « cancel ») l'annule aussi
    const ecriture = fetch('/api/mise-a-jour/lancer/', { method: 'POST', body: '{}' });
    await attendre();
    assert.ok(p.fenetre(), 'rouverte');
    p.fenetre().dispatchEvent(new Event('cancel'));
    assert.equal((await ecriture).status, 401);
    assert.equal(p.fenetre(), null);
    // la minute passée, une lecture refusée redemande
    p.horloge.maintenant += 61_000;
    const apres = fetch('/api/debug/tables/');
    await attendre();
    assert.ok(p.fenetre(), 'redemandée après 60 s');
    await p.saisir('secret-de-dev');
    assert.equal((await apres).status, 200);
  } finally { p.fin(); }
});

test('une session qui expire redemande, en le disant ; « Se déconnecter » ferme la session et retire la mention', async () => {
  const { service, etat } = serviceProtege();
  const p = await ouvrir({ service });
  try {
    const un = fetch('/api/edition/', { method: 'POST', body: '{}' });
    await attendre();
    await p.saisir('secret-de-dev');
    await un;
    assert.doesNotMatch(p.fenetre()?.textContent ?? '', /expiré/);
    etat.connecte = false; // les 12 h du service sont passées
    const deux = fetch('/api/edition/', { method: 'POST', body: '{}' });
    await attendre();
    assert.match(p.fenetre().textContent, /session a expiré/);
    await p.saisir('secret-de-dev');
    assert.equal((await deux).status, 200);
    assert.equal(etat.essais, 2);
    // se déconnecter
    cliquer(p.pied.querySelector('.acces-etat'));
    await attendre();
    assert.equal(p.appels.at(-1).methode, 'DELETE');
    assert.equal(p.appels.at(-1).chemin, '/api/acces/');
    assert.equal(p.pied.querySelector('.acces-etat'), null);
    assert.equal(p.stockage.has('maverick-acces'), false);
  } finally { p.fin(); }
});

test('jamais de demande pour la connexion, la balise des pages, la relève de la maintenance, ni pour ce qui n’est pas le service', async () => {
  const p = await ouvrir({ service: () => REFUS_ECRITURE });
  try {
    for (const [adresse, init] of [
      ['/api/acces/', undefined],
      ['/api/metriques/page/', { method: 'POST', body: '{}' }],
      ['/api/maintenance/', undefined],
      ['/couleurs-du-site.json', undefined],
      ['http://autre.example/api/personnages/', { method: 'POST', body: '{}' }],
    ]) {
      const r = await fetch(adresse, init);
      assert.equal(r.status, 401, adresse);
      assert.equal(p.fenetre(), null, `${adresse} : pas de fenêtre`);
    }
    // la levée de la maintenance est une écriture : elle demande
    const lever = fetch('/api/maintenance/lever/', { method: 'POST', body: '{}' });
    await attendre();
    assert.ok(p.fenetre(), 'lever la maintenance demande le mot de passe');
    p.fenetre().querySelector('.acces-annuler').dispatchEvent(new Event('click'));
    await lever;
  } finally { p.fin(); }
});

test('un 401 sans `acces` (autre refus) est rendu tel quel, sans fenêtre', async () => {
  const p = await ouvrir({ service: () => [401, { erreur: 'Jeton invalide.' }] });
  try {
    const r = await fetch('/api/personnages/', { method: 'POST', body: '{}' });
    assert.equal(r.status, 401);
    assert.equal(p.fenetre(), null);
    assert.equal(p.appels.length, 1);
  } finally { p.fin(); }
});

test('une lecture protégée (acces: cle) demande aussi le mot de passe, jamais la clé', async () => {
  const { service } = serviceProtege();
  const p = await ouvrir({
    service: (chemin, methode, corps, n) => (chemin === '/api/mise-a-jour/conflits/' && n === 0 ? [401, { erreur: 'Clé requise.', acces: 'cle' }] : service(chemin, methode, corps, n)),
  });
  try {
    const attente = fetch('/api/mise-a-jour/conflits/');
    await attendre();
    const f = p.fenetre();
    assert.match(f.textContent, /Mot de passe/);
    assert.doesNotMatch(f.textContent, /clé/i);
    await p.saisir('secret-de-dev');
    assert.equal((await attente).status, 200);
  } finally { p.fin(); }
});

test('la mention « connecté » revient sur la page suivante si le service confirme la session, sinon l’état de la visite est effacé', async () => {
  const { service, etat } = serviceProtege();
  etat.connecte = true;
  const oui = await ouvrir({ service, connecte: true });
  try {
    await attendre();
    assert.ok(oui.pied.querySelector('.acces-etat'), 'session confirmée');
    assert.equal(oui.appels.filter((a) => a.chemin === '/api/acces/').length, 1, 'une seule vérification');
  } finally { oui.fin(); }
  etat.connecte = false;
  const non = await ouvrir({ service, connecte: true });
  try {
    await attendre();
    assert.equal(non.pied.querySelector('.acces-etat'), null);
    assert.equal(non.stockage.has('maverick-acces'), false);
  } finally { non.fin(); }
});

test('un lien de téléchargement du service passe par fetch (avec la demande du mot de passe) puis est enregistré sous le nom du service', async () => {
  const { service, etat } = serviceProtege();
  const p = await ouvrir({
    service: (chemin, methode, corps, n) => (chemin === '/api/edition/journal/' && etat.connecte
      ? [200, '{"format":"maverick-edition/1"}', { 'Content-Disposition': 'attachment; filename="journal-edition-2026-11-14.json"' }]
      : service(chemin, methode, corps, n)),
  });
  try {
    const lien = el('a', { download: '', href: '/api/edition/journal/' });
    p.document.body.append(lien);
    const clic = cliquer(lien, p.document);
    assert.equal(clic.defaultPrevented, true, 'la navigation native est évitée');
    await attendre();
    assert.ok(p.fenetre(), 'le refus demande le mot de passe');
    await p.saisir('secret-de-dev');
    await attendre();
    await attendre();
    assert.equal(p.telechargements.length, 1);
    assert.equal(p.telechargements[0].download, 'journal-edition-2026-11-14.json');
    assert.match(p.telechargements[0].href, /^blob:/);
    // un lien ordinaire (hors du service) garde son cours
    const autre = el('a', { download: '', href: '/donnees/maverick.db' });
    p.document.body.append(autre);
    assert.equal(cliquer(autre, p.document).defaultPrevented, false);
    // mot de passe annulé : rien n'est enregistré
    etat.connecte = false;
    p.horloge.maintenant += 61_000;
    cliquer(lien, p.document);
    await attendre();
    p.fenetre().querySelector('.acces-annuler').dispatchEvent(new Event('click'));
    await attendre();
    await attendre();
    assert.equal(p.telechargements.length, 1, 'rien de plus enregistré');
  } finally { p.fin(); }
});

test('sans mot de passe posé (ou en production), un lien de téléchargement suit son cours natif : rien au chargement, une seule question au premier clic', async () => {
  const p = await ouvrir({ service: (chemin) => (chemin === '/api/acces/' ? [200, { protege: false, portee: null, connecte: false, droit: 'ecriture', expire_le: null }] : [200, {}]) });
  try {
    assert.equal(p.appels.length, 0, 'aucune requête ajoutée au chargement');
    const lien = el('a', { download: '', href: '/api/edition/journal/' });
    let natifs = 0;
    lien.click = () => { natifs += 1; cliquer(lien, p.document); };
    p.document.body.append(lien);
    cliquer(lien, p.document);
    await attendre();
    await attendre();
    assert.equal(natifs, 1, 'le lien suit son cours natif');
    assert.deepEqual(p.appels.map((a) => `${a.methode} ${a.chemin}`), ['GET /api/acces/'], 'ni téléchargement par fetch, ni fenêtre');
    assert.equal(p.fenetre(), null);
    assert.equal(p.telechargements.length, 0);
    // le serveur est connu comme non protégé : les clics suivants ne changent rien, sans nouvelle question
    assert.equal(cliquer(lien, p.document).defaultPrevented, false);
    assert.equal(p.appels.length, 1);
  } finally { p.fin(); }
});

test('un serveur déjà connu comme protégé (un refus vu) : le téléchargement passe par fetch sans question de plus', async () => {
  const { service, etat } = serviceProtege();
  const p = await ouvrir({ service });
  try {
    const ecriture = fetch('/api/edition/', { method: 'POST', body: '{}' });
    await attendre();
    await p.saisir('secret-de-dev');
    await ecriture;
    assert.equal(etat.connecte, true);
    const avant = p.appels.filter((a) => a.methode === 'GET' && a.chemin === '/api/acces/').length;
    const lien = el('a', { download: '', href: '/api/edition/journal/' });
    p.document.body.append(lien);
    assert.equal(cliquer(lien, p.document).defaultPrevented, true);
    await attendre();
    await attendre();
    assert.equal(p.telechargements.length, 1);
    assert.equal(p.appels.filter((a) => a.methode === 'GET' && a.chemin === '/api/acces/').length, avant, 'pas de question de plus');
  } finally { p.fin(); }
});

test('nomDuFichier : le nom de Content-Disposition (UTF-8 d’abord), sinon le repli ; messageDAttente : secondes ou minutes', async () => {
  const p = await ouvrir({ service: () => [200, {}] });
  try {
    const { nomDuFichier, messageDAttente } = await import(`${SOURCE.href}?page=${(numero += 1)}`);
    assert.equal(nomDuFichier('attachment; filename="a.json"', 'x'), 'a.json');
    assert.equal(nomDuFichier('attachment; filename="a.json"; filename*=UTF-8\'\'%C3%A9t%C3%A9.json', 'x'), 'été.json');
    assert.equal(nomDuFichier(null, 'repli.json'), 'repli.json');
    assert.match(messageDAttente(30), /30 s/);
    assert.match(messageDAttente(120), /2 min/);
    assert.match(messageDAttente(undefined), /un instant/);
  } finally { p.fin(); }
});

test('le script n’importe aucun module (version portable) et le layout ne le charge pas dans la version portable', () => {
  const code = readFileSync(SOURCE, 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
  assert.ok(!/(^|[;}\n])\s*import[\s{*"']|\bimport\(/.test(code), 'aucun import');
  const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  assert.match(base, /\{!portable && <Acces \/>\}/);
  const composant = readFileSync(new URL('../src/components/Acces.astro', import.meta.url), 'utf8');
  assert.match(composant, /import '\.\.\/scripts\/acces\.mjs';/);
});
