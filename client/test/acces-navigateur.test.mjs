// L'accès au site de dev dans le navigateur (src/scripts/acces.mjs ; R310 : la connexion par Discord remplace le mot de passe de R275), exécuté dans un faux
// navigateur : sur un 401 `acces: 'connexion'`, un avis PROPOSE de se connecter (lien vers /connexion/?retour=<la page>, jamais d'envoi automatique) ; sur
// un 403 `acces: 'niveau'`, il dit que le niveau ne suffit pas (niveau requis) ; la réponse d'origine est toujours rendue, rien n'est rejoué ; pas de boucle
// (rien sur la page de connexion), un seul avis à la fois, une lecture refusée dans les 60 s qui suivent sa fermeture ne le rouvre pas ; la connexion, le
// profil, la balise des pages et la relève de la maintenance ne passent jamais par lui ; un lien de téléchargement du service passe par fetch. Plus de
// fenêtre de mot de passe ni de mention « Connecté » au pied de page. Le script n'importe rien (version portable : skill site-version-portable).
//   node --test test/acces-navigateur.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LIBELLES_DES_NIVEAUX } from '../src/lib/compte.mjs';
import { attendre, cliquer, el, fauxDocument } from './aide-faux-dom.mjs';

let numero = 0;
const SOURCE = new URL('../src/scripts/acces.mjs', import.meta.url);

/**
 * Une page et son service factice. `service(adresse, methode, corps, n)` rend [statut, corps, entêtes?] ; `n` compte les appels déjà faits à cette
 * adresse avec cette méthode. `page` : l'adresse de la page (chemin et recherche). Rend le journal des appels (`appels`).
 */
async function ouvrir({ service, page = '/regles/' } = {}) {
  const appels = [];
  const telechargements = [];
  const compteurs = new Map();
  const document = fauxDocument(el('main', {}));
  document.head.append(el('meta', { name: 'maverick-api', content: '/api/' }), el('meta', { name: 'maverick-connexion', content: '/connexion/' }));
  const creer = document.createElement;
  document.createElement = (tag) => {
    const e = creer(tag);
    if (tag === 'a') e.click = () => telechargements.push({ download: e.getAttribute('download'), href: e.href });
    return e;
  };
  const horloge = { maintenant: 1_000_000 };
  const dateNow = Date.now;
  Date.now = () => horloge.maintenant;
  // la libération de l'adresse du fichier (10 s dans le navigateur) ne retient pas le test
  const minuterie = globalThis.setTimeout;
  globalThis.setTimeout = (f, d, ...a) => minuterie(f, d >= 10000 ? 0 : d, ...a);
  Object.assign(globalThis, {
    document,
    location: { href: `http://site${page}` },
    alert: () => {},
    fetch: async (entree, init) => {
      const adresse = new URL(typeof entree === 'string' ? entree : entree.url, `http://site${page}`);
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
  const avis = () => document.querySelector('.acces-avis');
  return {
    document,
    appels,
    telechargements,
    horloge,
    avis,
    texte: () => avis()?.querySelector('.acces-avis__texte').textContent,
    lien: () => { const l = avis()?.querySelector('.acces-avis__lien'); return l && !l.hidden ? l : null; },
    fermer: () => cliquer(avis().querySelector('.acces-avis__fermer')),
    fin: () => { Date.now = dateNow; globalThis.setTimeout = minuterie; },
  };
}

const SANS_SESSION = [401, { erreur: 'Connexion requise.', acces: 'connexion' }];
const NIVEAU_TROP_BAS = [403, { erreur: 'Niveau insuffisant.', acces: 'niveau', niveau: 'joueur', niveau_requis: 'createur' }];

test('un 401 `acces: connexion` propose de se connecter (lien vers /connexion/ avec la page en `retour`) ; la réponse d’origine est rendue, rien n’est rejoué', async () => {
  const p = await ouvrir({ service: () => SANS_SESSION, page: '/regles/combats/?a=1' });
  try {
    const r = await fetch('/api/edition/', { method: 'POST', body: JSON.stringify({ lot: 1 }) });
    assert.equal(r.status, 401);
    assert.deepEqual(await r.json(), SANS_SESSION[1]);
    assert.equal(p.appels.length, 1, 'un seul appel : aucune relance');
    const avis = p.avis();
    assert.ok(avis, 'un avis');
    assert.equal(avis.getAttribute('role'), 'alert');
    assert.equal(p.document.querySelector('dialog'), null, 'plus de fenêtre de mot de passe');
    assert.equal(p.document.querySelector('input'), null, 'aucun champ');
    const lien = p.lien();
    assert.ok(lien, 'le lien de connexion');
    assert.equal(lien.getAttribute('href'), `/connexion/?retour=${encodeURIComponent('/regles/combats/?a=1')}`);
    assert.ok(p.texte().trim());
  } finally { p.fin(); }
});

test('un 403 `acces: niveau` dit que le niveau ne suffit pas : le niveau actuel et le niveau requis, sans lien de connexion', async () => {
  const p = await ouvrir({ service: () => NIVEAU_TROP_BAS });
  try {
    const r = await fetch('/api/mise-a-jour/lancer/', { method: 'POST', body: '{}' });
    assert.equal(r.status, 403);
    assert.ok(p.avis());
    assert.ok(p.texte().includes(LIBELLES_DES_NIVEAUX.joueur), 'le niveau actuel');
    assert.ok(p.texte().includes(LIBELLES_DES_NIVEAUX.createur), 'le niveau requis');
    assert.equal(p.lien(), null, 'se connecter de nouveau n’y change rien');
  } finally { p.fin(); }
});

test('la table des libellés de niveau est celle de lib/compte.mjs (le script recopie, il n’importe rien)', async () => {
  for (const [niveau, libelle] of Object.entries(LIBELLES_DES_NIVEAUX)) {
    const p = await ouvrir({ service: () => [403, { acces: 'niveau', niveau, niveau_requis: niveau }] });
    try {
      await fetch('/api/edition/', { method: 'POST', body: '{}' });
      assert.ok(p.texte().includes(libelle), niveau);
    } finally { p.fin(); }
  }
});

test('sur la page de connexion : aucun avis (on y est : pas de boucle)', async () => {
  const p = await ouvrir({ service: () => SANS_SESSION, page: '/connexion/?erreur=niveau' });
  try {
    const r = await fetch('/api/edition/', { method: 'POST', body: '{}' });
    assert.equal(r.status, 401);
    assert.equal(p.avis(), null);
  } finally { p.fin(); }
});

test('`retour` : un chemin du site seulement ; une adresse qui n’en est pas un n’est pas passée', async () => {
  const p = await ouvrir({ service: () => SANS_SESSION, page: '//exemple.org/x' });
  try {
    await fetch('/api/edition/', { method: 'POST', body: '{}' });
    assert.equal(p.lien().getAttribute('href'), '/connexion/', 'sans retour');
  } finally { p.fin(); }
});

test('un seul avis à la fois : des refus en rafale le mettent à jour, ne l’empilent pas', async () => {
  const p = await ouvrir({ service: (chemin) => (chemin === '/api/a/' ? SANS_SESSION : NIVEAU_TROP_BAS) });
  try {
    await Promise.all([fetch('/api/a/'), fetch('/api/a/'), fetch('/api/a/')]);
    assert.equal(p.document.querySelectorAll('.acces-avis').length, 1);
    assert.ok(p.lien());
    await fetch('/api/b/', { method: 'POST', body: '{}' });
    assert.equal(p.document.querySelectorAll('.acces-avis').length, 1);
    assert.equal(p.lien(), null, 'le dernier refus (niveau) remplace le texte');
  } finally { p.fin(); }
});

test('fermé, l’avis ne revient pas pour une lecture refusée dans les 60 s (relèves) ; une écriture, ou 60 s plus tard, le rouvre', async () => {
  const p = await ouvrir({ service: () => SANS_SESSION });
  try {
    await fetch('/api/debug/systeme/');
    p.fermer();
    assert.equal(p.avis(), null, 'fermé');
    for (let i = 0; i < 3; i += 1) await fetch('/api/debug/systeme/');
    assert.equal(p.avis(), null, 'les relèves ne le rouvrent pas');
    p.horloge.maintenant += 61_000;
    await fetch('/api/debug/systeme/');
    assert.ok(p.avis(), '60 s plus tard');
    p.fermer();
    await fetch('/api/edition/', { method: 'POST', body: '{}' });
    assert.ok(p.avis(), 'une écriture, faite à la main, le rouvre aussitôt');
  } finally { p.fin(); }
});

test('jamais d’avis pour la connexion, le profil, la balise des pages, la relève de la maintenance, ni pour ce qui n’est pas le service', async () => {
  const p = await ouvrir({ service: () => SANS_SESSION });
  try {
    for (const [adresse, init] of [
      ['/api/acces/', undefined],
      ['/api/moi/', undefined],
      ['/api/connexion/discord/', undefined],
      ['/api/deconnexion/', { method: 'POST', body: '{}' }],
      ['/api/metriques/page/', { method: 'POST', body: '{}' }],
      ['/api/maintenance/', undefined],
      ['/couleurs-du-site.json', undefined],
      ['http://autre.example/api/personnages/', { method: 'POST', body: '{}' }],
    ]) {
      const r = await fetch(adresse, init);
      assert.equal(r.status, 401, adresse);
      assert.equal(p.avis(), null, `${adresse} : pas d’avis`);
    }
    // la levée de la maintenance est une écriture : elle en pose un
    await fetch('/api/maintenance/lever/', { method: 'POST', body: '{}' });
    assert.ok(p.avis(), 'lever la maintenance : un avis');
  } finally { p.fin(); }
});

test('un refus sans `acces`, ou d’une clé (réservée aux programmes), est rendu tel quel : rien à l’écran', async () => {
  for (const refus of [[401, { erreur: 'Jeton invalide.' }], [403, { erreur: 'Clé insuffisante.', acces: 'cle' }], [401, { erreur: 'Clé de dépôt.', acces: 'cle_de_depot' }], [403, 'pas du JSON'], [404, { acces: 'connexion' }]]) {
    const p = await ouvrir({ service: () => refus });
    try {
      const r = await fetch('/api/personnages/', { method: 'POST', body: '{}' });
      assert.equal(r.status, refus[0]);
      assert.equal(p.avis(), null, JSON.stringify(refus));
      assert.equal(p.appels.length, 1);
    } finally { p.fin(); }
  }
});

test('une réponse acceptée ne change rien : pas d’avis, un seul appel', async () => {
  const p = await ouvrir({ service: () => [200, { ok: true }] });
  try {
    const r = await fetch('/api/edition/', { method: 'POST', body: '{}' });
    assert.equal(r.status, 200);
    assert.equal(p.avis(), null);
    assert.equal(p.appels.length, 1);
  } finally { p.fin(); }
});

test('un lien de téléchargement du service passe par fetch, puis est enregistré sous le nom du service ; refusé, rien n’est enregistré et l’avis le dit', async () => {
  let ouvert = false;
  const p = await ouvrir({
    service: (chemin) => {
      if (chemin === '/api/acces/') return [200, { protege: true, connecte: true, niveau: 'createur', droit: 'ecriture', expire_le: 1 }];
      if (chemin === '/api/edition/journal/') {
        return ouvert
          ? [200, '{"format":"maverick-edition/1"}', { 'Content-Disposition': 'attachment; filename="journal-edition-2026-11-14.json"' }]
          : SANS_SESSION;
      }
      return [200, {}];
    },
  });
  try {
    const lien = el('a', { download: '', href: '/api/edition/journal/' });
    p.document.body.append(lien);
    assert.equal(cliquer(lien, p.document).defaultPrevented, true, 'la navigation native est évitée');
    await attendre();
    await attendre();
    assert.equal(p.telechargements.length, 0, 'refusé : rien d’enregistré');
    assert.ok(p.lien(), 'l’avis propose de se connecter');
    p.fermer();
    ouvert = true;
    cliquer(lien, p.document);
    await attendre();
    await attendre();
    await attendre();
    assert.equal(p.telechargements.length, 1);
    assert.equal(p.telechargements[0].download, 'journal-edition-2026-11-14.json');
    assert.match(p.telechargements[0].href, /^blob:/);
    // un lien ordinaire (hors du service) garde son cours
    const autre = el('a', { download: '', href: '/donnees/maverick.db' });
    p.document.body.append(autre);
    assert.equal(cliquer(autre, p.document).defaultPrevented, false);
  } finally { p.fin(); }
});

test('sans porte (production), un lien de téléchargement suit son cours natif : rien au chargement, une seule question au premier clic', async () => {
  const p = await ouvrir({ service: (chemin) => (chemin === '/api/acces/' ? [200, { protege: false, connecte: false, niveau: 'observateur', droit: 'ecriture', expire_le: null }] : [200, {}]) });
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
    assert.deepEqual(p.appels.map((a) => `${a.methode} ${a.chemin}`), ['GET /api/acces/'], 'ni téléchargement par fetch, ni avis');
    assert.equal(p.avis(), null);
    assert.equal(p.telechargements.length, 0);
    // le serveur est connu comme non protégé : les clics suivants ne changent rien, sans nouvelle question
    assert.equal(cliquer(lien, p.document).defaultPrevented, false);
    assert.equal(p.appels.length, 1);
  } finally { p.fin(); }
});

test('un serveur déjà connu comme fermé (un refus vu) : le téléchargement passe par fetch sans question de plus', async () => {
  const p = await ouvrir({ service: (chemin) => (chemin === '/api/edition/journal/' ? [200, '{}'] : chemin === '/api/edition/' ? SANS_SESSION : [200, {}]) });
  try {
    await fetch('/api/edition/', { method: 'POST', body: '{}' });
    const lien = el('a', { download: '', href: '/api/edition/journal/' });
    p.document.body.append(lien);
    assert.equal(cliquer(lien, p.document).defaultPrevented, true);
    await attendre();
    await attendre();
    await attendre();
    assert.equal(p.telechargements.length, 1);
    assert.equal(p.appels.filter((a) => a.chemin === '/api/acces/').length, 0, 'pas de question de plus');
  } finally { p.fin(); }
});

test('nomDuFichier : le nom de Content-Disposition (UTF-8 d’abord), sinon le repli', async () => {
  const p = await ouvrir({ service: () => [200, {}] });
  try {
    const { nomDuFichier } = await import(`${SOURCE.href}?page=${(numero += 1)}`);
    assert.equal(nomDuFichier('attachment; filename="a.json"', 'x'), 'a.json');
    assert.equal(nomDuFichier('attachment; filename="a.json"; filename*=UTF-8\'\'%C3%A9t%C3%A9.json', 'x'), 'été.json');
    assert.equal(nomDuFichier(null, 'repli.json'), 'repli.json');
  } finally { p.fin(); }
});

test('le script n’importe aucun module (version portable), n’a plus de mot de passe ni de mention au pied de page ; le layout ne le charge pas dans la version portable', () => {
  const code = readFileSync(SOURCE, 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
  assert.ok(!/(^|[;}\n])\s*import[\s{*"']|\bimport\(/.test(code), 'aucun import');
  assert.ok(!/sessionStorage|type="password"|'password'|mot_de_passe|acces-etat|acces-dialogue|method: 'DELETE'/.test(code), 'plus de mot de passe ni de mention « connecté »');
  const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  assert.match(base, /\{!portable && <Acces \/>\}/);
  const composant = readFileSync(new URL('../src/components/Acces.astro', import.meta.url), 'utf8');
  assert.match(composant, /import '\.\.\/scripts\/acces\.mjs';/);
  assert.match(composant, /name="maverick-connexion"/);
  const css = readFileSync(new URL('../src/styles/global/acces.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /acces-dialogue|acces-etat/);
});
