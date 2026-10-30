// Page Debug (pages/debug.astro, site de dev seulement ; demande du propriétaire) : fonctions pures des journaux du serveur (lib/debug-journaux.mjs),
// contrat avec le journal du service (serveur/journal-du-service.mjs), et la page elle-même — quatre menus déroulants fermés dans l'ordre Système,
// Performances, Journaux du serveur, DB (demande du propriétaire du 2026-10-15), chacun ne demandant rien au service tant qu'il est fermé ; une
// phrase sans script en production, aucun module partagé avec un autre script de page, absente de la version portable.
//   node --test test/debug-page.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import {
  AFFICHEES_MAX, GARDEES_MAX, NIVEAUX, RELEVE_MS, TRIS_DU_JOURNAL, TRI_DU_JOURNAL_PAR_DEFAUT, adresseDuJournal, categoriesDes, dureeDe, etatVide,
  filtrerEntrees, fusionner, heureDe, htmlDesLignes, planDAffichage, resumeDuJournal,
} from '../src/lib/debug-journaux.mjs';
import {
  COLONNES_DES_ROUTES, INSTANCES, PERIODES, PERIODE_PAR_DEFAUT, RELEVE_METRIQUES_MS, TRIS, TRI_PAR_DEFAUT, adresseDesMetriques, adresseDesRequetes,
  adresseDuSysteme, echapper, suivreLOuverture,
} from '../src/lib/debug-metriques.mjs';
import { NIVEAUX as NIVEAUX_DU_SERVICE, creerJournalDuService } from '../serveur/journal-du-service.mjs';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

test('journaux : relève (?depuis=), fusion des réponses du VRAI journal du service, redémarrage, plafond des entrées gardées', () => {
  assert.equal(RELEVE_MS, 2000, 'toutes les 2 s (demande)');
  assert.equal(adresseDuJournal('/api/'), '/api/debug/journal/');
  assert.equal(adresseDuJournal('/MaverickCenter/api/', 12), '/MaverickCenter/api/debug/journal/?depuis=12');
  assert.deepEqual(NIVEAUX.map((n) => n.cle), NIVEAUX_DU_SERVICE, 'les cases de la page = les niveaux du service');

  let t = Date.UTC(2026, 9, 15, 12, 0, 0);
  const journal = creerJournalDuService({ sortie: null, horloge: () => new Date((t += 1000)) });
  journal.ecrire('service des personnages 0.3.0 : http://127.0.0.1:8787/api/');
  journal.ecrire('GET /api/v1/metiers/ 200 12 ms', { categorie: 'http' });
  let { etat, ajoutees, redemarre } = fusionner(etatVide(), journal.lire());
  assert.deepEqual([etat.entrees.map((e) => e.n), etat.dernier, ajoutees, redemarre], [[1, 2], 2, 2, false]);
  journal.ecrire('ERREUR base vivante : verrou');
  ({ etat, ajoutees } = fusionner(etat, journal.lire({ depuis: etat.dernier })));
  assert.deepEqual([etat.entrees.map((e) => e.n), etat.dernier, ajoutees], [[1, 2, 3], 3, 1]);
  ({ etat, ajoutees } = fusionner(etat, journal.lire()));
  assert.deepEqual([etat.entrees.map((e) => e.n), ajoutees], [[1, 2, 3], 0], 'une entrée déjà vue n’est pas reprise');
  // effacer l'affichage : la page oublie ses entrées, pas son curseur
  etat = { ...etat, entrees: [] };
  journal.ecrire('maintenance : annonce retirée');
  ({ etat } = fusionner(etat, journal.lire({ depuis: etat.dernier })));
  assert.deepEqual(etat.entrees.map((e) => e.message), ['maintenance : annonce retirée']);
  // le service a redémarré : sa numérotation repart de 1, la page vide son état et relit tout
  const neuf = creerJournalDuService({ sortie: null });
  neuf.ecrire('service des personnages 0.3.1 : http://127.0.0.1:8787/api/');
  ({ etat, redemarre } = fusionner(etat, neuf.lire({ depuis: etat.dernier })));
  assert.equal(redemarre, true);
  assert.deepEqual(etat, etatVide());
  // réponse illisible : rien ne change
  assert.equal(fusionner(etat, null).etat, etat);
  assert.equal(fusionner(etat, { dernier: 'x' }).ajoutees, 0);
  // perdues et capacité suivent le service ; GARDEES_MAX entrées au plus
  const petit = creerJournalDuService({ sortie: null, capacite: 3 });
  for (let i = 0; i < 5; i++) petit.ecrire(`message ${i}`);
  ({ etat } = fusionner(etatVide(), petit.lire()));
  assert.deepEqual([etat.perdues, etat.capacite], [2, 3]);
  const beaucoup = { entrees: Array.from({ length: GARDEES_MAX + 10 }, (_, i) => ({ n: i + 1, instant: '', niveau: 'info', categorie: 'http', message: `m${i}` })), dernier: GARDEES_MAX + 10 };
  ({ etat } = fusionner(etatVide(), beaucoup));
  assert.equal(etat.entrees.length, GARDEES_MAX);
  assert.equal(etat.entrees[0].n, 11, 'les plus récentes');
});

test('journaux : un redémarrage du service se voit à son identité, même quand le nouveau journal a déjà autant de lignes que la page en avait vu, ou plus', () => {
  // la page a lu 50 lignes de l'ancien service, puis l'onglet est caché (ou la relève en pause) pendant qu'un nouveau service en écrit 60
  const ancien = creerJournalDuService({ sortie: null });
  for (let i = 0; i < 50; i++) ancien.ecrire(`GET /api/v1/metiers/ 200 ${i} ms`, { categorie: 'http' });
  let { etat } = fusionner(etatVide(), ancien.lire());
  assert.equal(etat.dernier, 50);
  const neuf = creerJournalDuService({ sortie: null });
  neuf.ecrire('service des personnages 0.3.1 : http://127.0.0.1:8787/api/');
  neuf.ecrire('ERREUR base vivante : verrou');
  for (let i = 0; i < 58; i++) neuf.ecrire(`GET /api/personnages/ 200 ${i} ms`, { categorie: 'http' });
  const suite = fusionner(etat, neuf.lire({ depuis: etat.dernier }));
  assert.deepEqual([suite.redemarre, suite.ajoutees], [true, 0], 'les lignes 51 à 60 du nouveau service ne se collent pas à celles de l’ancien');
  assert.deepEqual(suite.etat, etatVide());
  // la page relit tout : le démarrage et l'erreur du nouveau service sont là
  ({ etat } = fusionner(suite.etat, neuf.lire({ depuis: 0 })));
  assert.equal(etat.entrees.length, 60);
  assert.deepEqual(filtrerEntrees(etat.entrees, { niveaux: ['erreur'] }).lignes.map((e) => e.message), ['ERREUR base vivante : verrou']);
  assert.ok(etat.entrees.some((e) => e.message.startsWith('service des personnages 0.3.1')));
  // autant de lignes exactement : aussi un redémarrage
  const pareil = creerJournalDuService({ sortie: null });
  for (let i = 0; i < 60; i++) pareil.ecrire(`ligne ${i}`);
  assert.equal(fusionner(etat, pareil.lire({ depuis: etat.dernier })).redemarre, true);
  // le même processus : rien ne change
  neuf.ecrire('base des règles changée');
  const meme = fusionner(etat, neuf.lire({ depuis: etat.dernier }));
  assert.deepEqual([meme.redemarre, meme.ajoutees, meme.etat.entrees.length], [false, 1, 61]);
  // une réponse sans identité (service d'avant) : la numérotation seule décide, comme avant
  assert.equal(fusionner(etat, { entrees: [], dernier: 70 }).redemarre, false);
});

test('journaux : filtres de la page (niveaux, catégorie, texte), la plus récente en haut, 1000 lignes au plus ; rendu et résumé', () => {
  const journal = creerJournalDuService({ sortie: null, horloge: () => new Date(2026, 9, 15, 14, 5, 9) });
  journal.ecrire('service des personnages 0.3.0 : http://127.0.0.1:8787/api/');
  journal.ecrire('GET /api/v1/metiers/ 200 12 ms', { categorie: 'http' });
  journal.ecrire('PATCH /api/v1/metiers/forgeron/ 412 3 ms', { categorie: 'http' });
  journal.ecrire('ERREUR base vivante : verrou');
  journal.ecrire('édition : lot 4 (1 ligne(s)) depuis metiers');
  const { entrees } = journal.lire();
  const n = (filtres) => filtrerEntrees(entrees, filtres).lignes.map((e) => e.n);
  assert.deepEqual(n(), [5, 4, 3, 2, 1], 'la plus récente en haut');
  assert.deepEqual(n({ niveaux: ['erreur', 'avertissement'] }), [4, 3]);
  assert.deepEqual(n({ niveaux: [] }), [], 'aucune case : rien');
  assert.deepEqual(n({ categorie: 'http' }), [3, 2]);
  assert.deepEqual(n({ texte: 'EDITION metiers' }), [5], 'chaque mot, sans accents ni majuscules');
  assert.deepEqual(n({ texte: 'http' }), [3, 2, 1], 'dans le message ou la catégorie');
  assert.deepEqual(categoriesDes(entrees), ['base', 'edition', 'http', 'service']);
  assert.deepEqual(categoriesDes([], 'http'), ['http'], 'la catégorie choisie reste dans la liste');
  const nombreuses = Array.from({ length: AFFICHEES_MAX + 7 }, (_, i) => ({ n: i + 1, instant: '', niveau: 'info', categorie: 'http', message: '' }));
  const coupe = filtrerEntrees(nombreuses);
  assert.deepEqual([coupe.lignes.length, coupe.total, coupe.lignes[0].n, coupe.lignes.at(-1).n], [AFFICHEES_MAX, AFFICHEES_MAX + 7, AFFICHEES_MAX + 7, 8]);

  const maintenant = new Date(2026, 9, 15, 18, 0, 0);
  assert.equal(heureDe(new Date(2026, 9, 15, 14, 5, 9).toISOString(), maintenant), '14:05:09');
  assert.equal(heureDe(new Date(2026, 9, 14, 23, 59, 1).toISOString(), maintenant), '14/10 23:59:01', 'un autre jour : la date');
  assert.equal(heureDe('pas une date', maintenant), 'pas une date');
  const html = htmlDesLignes([{ n: 7, instant: '2026-10-15T12:00:00Z', niveau: 'erreur', categorie: 'base', message: 'ERREUR <b> & co\n  at x' }], maintenant);
  assert.match(html, /^<tr class="debug-ligne debug-ligne--erreur" data-n="7"><td class="debug-ligne__heure"><time datetime="2026-10-15T12:00:00Z">[^<]+<\/time><\/td>/);
  assert.match(html, /<td class="debug-ligne__niveau"><span class="debug-niveau debug-niveau--erreur">erreur<\/span><\/td><td class="debug-ligne__categorie">base<\/td><td class="debug-ligne__duree"><\/td><td class="debug-ligne__message">ERREUR &lt;b&gt; &amp; co\n {2}at x<\/td><\/tr>$/, 'sans durée isolée : une case vide');
  assert.match(htmlDesLignes([{ n: 1, instant: '', niveau: '"><script>', categorie: '', message: '' }]), /debug-ligne--info.*&quot;&gt;&lt;script&gt;/, 'niveau inconnu : classe info, texte échappé');
  assert.equal(echapper(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;', 'contenu et valeur d’attribut');
  assert.equal(echapper(null), '');
  assert.equal(resumeDuJournal({ affichees: 1, total: 1, gardees: 1 }), '1 ligne affichée ; 1 entrée reçue depuis l’ouverture ou le dernier effacement.');
  assert.equal(resumeDuJournal({ affichees: 1000, total: 1500, gardees: 1800, perdues: 3, enPause: true }),
    '1000 lignes affichées (les 1000 plus récentes sur 1500) ; 1800 entrées reçues depuis l’ouverture ou le dernier effacement ; 3 entrées plus anciennes ne sont plus dans la mémoire du service. Relève en pause.');
});

test('journaux : durée isolée des entrées http (demande du 2026-10-15) — colonne Durée triable, « plus lent que … ms » envoyé au service (?min_ms=) et appliqué dans la page', () => {
  assert.deepEqual(TRIS_DU_JOURNAL, ['instant', 'duree']);
  assert.deepEqual(TRI_DU_JOURNAL_PAR_DEFAUT, { cle: 'instant', sens: 'desc' });
  assert.equal(adresseDuJournal('/api/', 0, { minMs: 250 }), '/api/debug/journal/?min_ms=250');
  assert.equal(adresseDuJournal('/api/', 12, { minMs: 12.5 }), '/api/debug/journal/?depuis=12&min_ms=12.5');
  assert.equal(adresseDuJournal('/api/', 12, { minMs: 0 }), '/api/debug/journal/?depuis=12', 'sans seuil : rien de plus');
  // les champs isolés d'une entrée http (contrat du journal : duree_ms, methode, route, statut, octets_sortie), gardés par la fusion
  const http = (n, duree_ms, extra = {}) => ({ n, instant: '2026-10-15T12:00:00Z', niveau: 'info', categorie: 'http', message: `GET /api/x/ 200 ${duree_ms} ms`,
    duree_ms, methode: 'GET', route: '/api/x/', statut: 200, octets_sortie: 120, ...extra });
  const entrees = [
    http(1, 12.34), { n: 2, instant: '2026-10-15T12:00:01Z', niveau: 'info', categorie: 'service', message: 'base des règles changée' },
    http(3, 640), http(4, 150.5), http(5, 0.42), http(6, 150.5),
  ];
  const { etat } = fusionner(etatVide(), { processus: 'p', dernier: 6, entrees });
  assert.equal(etat.entrees[0].duree_ms, 12.34, 'la fusion garde les champs isolés');
  assert.equal(dureeDe(etat.entrees[1]), null);
  assert.equal(dureeDe({ duree_ms: '12' }), null, 'seulement un nombre');
  const n = (filtres) => filtrerEntrees(etat.entrees, filtres).lignes.map((e) => e.n);
  assert.deepEqual(n(), [6, 5, 4, 3, 2, 1], 'par défaut : la plus récente en haut');
  assert.deepEqual(n({ tri: { cle: 'instant', sens: 'asc' } }), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(n({ tri: { cle: 'duree', sens: 'desc' } }), [3, 6, 4, 1, 5, 2], 'la plus lente en haut ; à égalité la plus récente ; sans durée à la fin');
  assert.deepEqual(n({ tri: { cle: 'duree', sens: 'asc' } }), [5, 1, 6, 4, 3, 2], 'la plus rapide en haut ; sans durée toujours à la fin');
  assert.deepEqual(n({ minMs: 150 }), [6, 4, 3], 'plus lent que 150 ms (inclus) ; une entrée sans durée n’en est pas');
  assert.deepEqual(n({ minMs: 150, tri: { cle: 'duree' } }), [3, 6, 4]);
  assert.deepEqual(filtrerEntrees(etat.entrees, { minMs: 150 }).total, 3);
  // la case Durée : formatée, marquée lente (≥ 100 ms) ou très lente (≥ 500 ms)
  const html = htmlDesLignes([http(3, 640), http(4, 150.5), http(1, 12.34), http(5, 0.42)]);
  assert.match(html, /<td class="debug-ligne__duree" data-lenteur="tres-lent">640\u00a0ms<\/td>/);
  assert.match(html, /<td class="debug-ligne__duree" data-lenteur="lent">151\u00a0ms<\/td>/);
  assert.match(html, /<td class="debug-ligne__duree">12,3\u00a0ms<\/td>/);
  assert.match(html, /<td class="debug-ligne__duree">0,42\u00a0ms<\/td>/);
  // la page : un champ « plus lent que » étiqueté, des en-têtes Heure et Durée qui trient (aria-sort), le seuil envoyé au service
  const page = lire('../src/pages/debug.astro');
  assert.match(page, /<label for="debug-journaux-min-ms">Plus lent que \(ms\)<\/label>\s*<input type="number" id="debug-journaux-min-ms" data-journaux-min-ms/);
  assert.match(page, /<th scope="col" aria-sort="descending"><button type="button" class="debug-tri" data-journaux-tri="instant">Heure<\/button><\/th>/);
  assert.match(page, /<th scope="col" aria-sort="none"><button type="button" class="debug-tri" data-journaux-tri="duree">Durée<\/button><\/th>/);
  const script = lire('../src/scripts/debug.mjs');
  assert.match(script, /adresseDuJournal\(api, etat\.dernier, \{ minMs: seuilDeLaDemande \}\)/, 'le seuil part au service');
  assert.match(script, /filtrerEntrees\(etat\.entrees, \{ niveaux: niveaux\(\), categorie: choisie, texte: texte\.value, minMs: seuil, tri \}\)/, 'et s’applique dans la page');
  assert.match(script, /if \(seuilDeLaDemande !== seuil\)/, 'une réponse demandée avec un autre seuil ne se mêle pas aux nouvelles');
});

test('journaux : affichage incrémental — les nouvelles lignes s’ajoutent en haut sans refaire les autres (la ligne lue et une sélection restent) ; sinon tout se refait', () => {
  assert.deepEqual(planDAffichage([5, 4, 3], [7, 6, 5, 4, 3]), { ajout: 2, retrait: 0 });
  assert.deepEqual(planDAffichage([5, 4, 3], [5, 4, 3]), { ajout: 0, retrait: 0 }, 'rien de nouveau');
  assert.deepEqual(planDAffichage([5, 4, 3], [7, 6, 5, 4]), { ajout: 2, retrait: 1 }, 'au plafond : la plus ancienne sort en bas');
  assert.equal(planDAffichage([], [2, 1]), null, 'tableau vide : tout s’écrit');
  assert.equal(planDAffichage([5, 4, 3], [5, 3]), null, 'filtre changé');
  assert.equal(planDAffichage([5, 4, 3], [9, 8]), null, 'plus rien de l’ancien affichage');
  assert.equal(planDAffichage([5, 4, 3], [6, 4, 3]), null);
  // avec les vraies fonctions de la page : une relève qui apporte des entrées
  const journal = creerJournalDuService({ sortie: null });
  for (let i = 0; i < 5; i++) journal.ecrire(`GET /api/x/ 200 ${i} ms`, { categorie: 'http' });
  let { etat } = fusionner(etatVide(), journal.lire());
  const avant = filtrerEntrees(etat.entrees).lignes.map((e) => e.n);
  journal.ecrire('ERREUR base vivante : verrou');
  ({ etat } = fusionner(etat, journal.lire({ depuis: etat.dernier })));
  assert.deepEqual(planDAffichage(avant, filtrerEntrees(etat.entrees).lignes.map((e) => e.n)), { ajout: 1, retrait: 0 });
  // le script s'en sert, et ne réécrit plus tout le tableau à chaque relève
  const script = lire('../src/scripts/debug.mjs');
  assert.match(script, /planDAffichage\(/);
  assert.match(script, /insertAdjacentHTML\('afterbegin'/);
  assert.match(script, /selectionchange/, 'une sélection dans le tableau diffère l’affichage');
  assert.match(lire('../src/styles/debug/debug.css'), /\.debug-journaux__cadre \{[^}]*overflow-anchor: none;/, 'la page recale elle-même la ligne lue');
});

test('bouton Pause des journaux : un bouton bascule au libellé fixe (aria-pressed seul change), jamais « Reprendre » annoncé enfoncé', () => {
  const script = lire('../src/scripts/debug.mjs');
  const gestionnaire = script.slice(script.indexOf("pause.addEventListener('click'"), script.indexOf('effacer.addEventListener'));
  assert.match(gestionnaire, /pause\.setAttribute\('aria-pressed', String\(enPause\)\)/);
  assert.doesNotMatch(gestionnaire, /textContent/, 'le libellé ne change pas');
  assert.doesNotMatch(script, /Reprendre/);
  assert.match(lire('../src/pages/debug.astro'), /<button type="button" data-journaux-pause aria-pressed="false">Pause<\/button>/);
});

test('la page : une phrase sans script en production et dans la version portable ; ailleurs, le script de src/scripts/ et la CSS insérée', () => {
  const page = lire('../src/pages/debug.astro');
  assert.match(page, /const site = modeDuSite\(process\.env, packageInfo\.version\);/);
  assert.match(page, /const actif = !site\.prod && !portable;/);
  assert.match(page, /<p class="debug-reservee">Cette page est réservée au serveur de dev\.<\/p>/);
  assert.match(page, /\{actif && <script>import '\.\.\/scripts\/debug\.mjs';<\/script>\}/, 'le script, seulement hors production et hors version portable');
  assert.equal((page.match(/<script/g) ?? []).length, 1, 'un seul script');
  assert.match(page, /import debugCss from '\.\.\/styles\/debug\/debug\.css\?raw';/);
  assert.match(page, /<style is:inline set:html=\{debugCss\}><\/style>/);
  assert.match(page, /data-api=\{url\('api\/'\)\}>/);
  assert.doesNotMatch(page, /<(?!Base\b)[A-Za-z][^>]*\stitle=/, 'jamais d’infobulle native (le title de <Base> est celui de la page)');
  // chaque champ a son étiquette
  for (const [, id] of page.matchAll(/<(?:input|select)[^>]*\sid="([^"]+)"/g)) assert.match(page, new RegExp(`<label for="${id}">`), id);
  // la version portable ne l'emporte pas (pas de service)
  assert.match(lire('../../tools/build-artifact.mjs'), /if \(rel\.startsWith\('debug\/'\)\) continue;/);
});

test('la page : quatre menus déroulants FERMÉS, dans l’ordre Système, Performances, Journaux du serveur, DB, et rien d’autre (demande du 2026-10-15)', () => {
  const page = lire('../src/pages/debug.astro');
  // « Il faudra mettre les journaux du serveur dans un menu déroulant fermé de base. Performance et système aussi sont fermés par défaut »
  assert.match(page, /<details class="debug-bloc debug-systeme" data-debug-systeme hidden>\s*<summary>\s*<h2 class="debug-bloc__titre" id="debug-systeme-titre">Système<\/h2>/);
  assert.match(page, /<details class="debug-bloc debug-perfs" data-debug-perfs hidden>\s*<summary>\s*<h2 class="debug-bloc__titre" id="debug-perfs-titre">Performances<\/h2>/);
  assert.match(page, /<details class="debug-bloc debug-journaux" data-debug-journaux hidden>\s*<summary>\s*<h2 class="debug-bloc__titre" id="debug-journaux-titre">Journaux du serveur<\/h2>/);
  assert.doesNotMatch(page, /<details\b[^>]*\sopen\b/, 'aucun menu ouvert au chargement');
  // « L'ordre des menus est : 1) Système 2) Performance 3) Journaux 4) DB (ton futur schéma) »
  const ordre = ['data-debug-systeme', 'data-debug-perfs', 'data-debug-journaux', '<SchemaDeLaBase />'].map((m) => page.indexOf(m));
  assert.ok(ordre.every((i) => i >= 0));
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'Système, Performances, Journaux, DB');
  // « Tester l'API sera donc supprimé » : ni le testeur, ni son module, ni ses styles
  const gabarit = page.slice(page.indexOf('---\n\n<Base'));
  assert.doesNotMatch(gabarit, /testeur|Tester l’API|openapi/i);
  assert.ok(!existsSync(new URL('../src/lib/debug-api.mjs', import.meta.url)), 'lib/debug-api.mjs supprimé');
  assert.doesNotMatch(lire('../src/styles/debug/debug.css'), /debug-testeur|debug-op\b|debug-form|debug-curl|debug-reponse|debug-groupe/);
  // ni ce qui, côté service, ne parlait que de lui (la description OpenAPI reste, pour des outils externes : x-sans-retour le dit au client)
  assert.doesNotMatch(lire('../serveur/openapi.mjs'), /la page Debug le dit|à côté de la case/);
  // rien hors des menus : dans la zone du site de dev, après la ligne d'état (et son <noscript>), chaque élément de premier niveau est un menu
  const zone = page.slice(page.indexOf('<div class="debug" data-debug'), page.indexOf(') : ('));
  const corps = zone.slice(zone.indexOf('</noscript>') + '</noscript>'.length);
  const premierNiveau = [...corps.matchAll(/^ {8}<([A-Za-z]+)\b[^>]*>/gm)].map((m) => m[0].trim());
  assert.deepEqual(premierNiveau.map((b) => b.match(/^<([A-Za-z]+)/)[1]), ['details', 'details', 'details', 'SchemaDeLaBase']);
  // « Inclus-la directement dans Système » : la jauge de l'espace disque, intacte, DANS le menu Système (son propre titre de section)
  const systeme = page.slice(page.indexOf('data-debug-systeme'), page.indexOf('data-debug-perfs'));
  assert.match(systeme, /<section class="debug-espace" data-debug-espace aria-labelledby="debug-espace-titre">\s*<h3 id="debug-espace-titre">Espace disque du serveur<\/h3>/);
  assert.match(systeme, /<div class="debug-espace__contenu" data-espace-jauge><\/div>/);
  assert.equal((page.match(/data-debug-espace/g) ?? []).length, 1);
  for (const m of ['data-systeme-instance', 'data-systeme-processus', 'data-systeme-disque', 'data-systeme-fichiers', 'data-systeme-volume',
    'data-systeme-echantillons', 'data-systeme-evenements', 'data-systeme-alertes', 'data-systeme-annonce', 'data-espace-jauge']) {
    assert.ok(systeme.includes(m), `Système : ${m}`);
  }
  // l'instance se choisit en tête de Système comme de Performances (les deux listes se suivent : scripts/debug.mjs)
  assert.match(systeme, /<label for="debug-systeme-instance">Instance \(système et performances\)<\/label>\s*<select id="debug-systeme-instance" data-systeme-instance>\s*\{INSTANCES\.map\(/);
  const perfs = page.slice(page.indexOf('data-debug-perfs'), page.indexOf('data-debug-journaux'));
  for (const m of ['data-perfs-instance', 'data-perfs-periode', 'data-perfs-tri', 'data-perfs-routes', 'data-perfs-serie', 'data-perfs-pages',
    'data-perfs-navigateurs', 'data-perfs-origines', 'data-requetes-liste', 'data-requetes-min']) {
    assert.ok(perfs.includes(m), `Performances : ${m}`);
  }
  assert.match(perfs, /<a class="debug-bouton" data-perfs-export="csv" href=\{url\(`api\/debug\/metriques\/export\/\?instance=dev&periode=\$\{PERIODE_PAR_DEFAUT\}&format=csv`\)\} download>Exporter \(CSV\)<\/a>/);
  const journaux = page.slice(page.indexOf('data-debug-journaux'), page.indexOf('<SchemaDeLaBase />'));
  for (const m of ['data-journaux-filtres', 'data-journaux-categorie', 'data-journaux-texte', 'data-journaux-min-ms', 'data-journaux-pause',
    'data-journaux-effacer', 'data-journaux-lignes', 'data-journaux-vide']) {
    assert.ok(journaux.includes(m), `Journaux : ${m}`);
  }
  // les listes de la page viennent du module (instances, périodes, tris), les en-têtes du tableau des routes aussi
  assert.match(page, /PERIODES\.map\(/);
  assert.match(page, /TRIS\.map\(/);
  assert.match(page, /COLONNES_DES_ROUTES\.map\(/);
  assert.deepEqual(INSTANCES.map((i) => i.cle), ['dev', 'prod'], 'deux jeux de données séparés (décision du 2026-10-15)');
  assert.deepEqual(PERIODES.map((p) => p.cle), ['1h', '24h', '7j', '30j', '365j', 'tout']);
  assert.deepEqual(TRIS.slice(0, 9).map((t) => t.cle), ['n', 'moyenne', 'mediane', 'p95', 'p99', 'max', 'total', 'erreurs', 'sql'], 'les tris du service d’abord');
  assert.equal(COLONNES_DES_ROUTES.length, TRIS.length, 'chaque colonne se trie');
});

test('suivreLOuverture : un menu fermé ne demande rien ; ouvert, une relève aussitôt puis à chaque intervalle ; refermé, plus rien', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const menu = new EventTarget();
  menu.open = false;
  const releves = [];
  suivreLOuverture(menu, RELEVE_METRIQUES_MS, (force) => releves.push(force));
  const basculer = (open) => {
    menu.open = open;
    menu.dispatchEvent(new Event('toggle'));
  };
  t.mock.timers.tick(RELEVE_METRIQUES_MS * 3);
  assert.deepEqual(releves, [], 'fermé au chargement : aucune relève, aucune minuterie');
  basculer(true);
  assert.deepEqual(releves, [true], 'à l’ouverture : aussitôt, forcée');
  t.mock.timers.tick(RELEVE_METRIQUES_MS);
  t.mock.timers.tick(RELEVE_METRIQUES_MS);
  assert.deepEqual(releves, [true, false, false], 'puis à chaque intervalle tant qu’il est ouvert');
  basculer(false);
  t.mock.timers.tick(RELEVE_METRIQUES_MS * 5);
  assert.deepEqual(releves, [true, false, false], 'refermé : la minuterie s’arrête');
  basculer(true);
  t.mock.timers.tick(RELEVE_METRIQUES_MS);
  assert.deepEqual(releves, [true, false, false, true, false], 'rouvert : aussitôt, puis une seule minuterie');
  // un `toggle` venu d'un détail déplié dedans (une requête récente) ne compte pas
  const autre = new EventTarget();
  const avant = releves.length;
  menu.dispatchEvent(Object.defineProperty(new Event('toggle'), 'target', { value: autre }));
  assert.equal(releves.length, avant);
  // un menu déjà ouvert quand on le suit : aussitôt
  const ouvert = new EventTarget();
  ouvert.open = true;
  const r2 = [];
  suivreLOuverture(ouvert, 2000, (force) => r2.push(force));
  assert.deepEqual(r2, [true]);
});

test('le script de la page n’importe que lib/debug-journaux.mjs et lib/debug-metriques.mjs, qu’aucun autre script de page n’importe ; un menu fermé ne demande rien', () => {
  const imports = (url) => [...readFileSync(url, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  const scripts = new URL('../src/scripts/', import.meta.url);
  assert.deepEqual(imports(new URL('debug.mjs', scripts)), ['../lib/debug-journaux.mjs', '../lib/debug-metriques.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/debug-journaux.mjs', import.meta.url)), ['./debug-metriques.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/debug-metriques.mjs', import.meta.url)), [], 'sans dépendance (pas de boucle avec debug-journaux)');
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'debug.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /\/debug-(journaux|metriques)\.mjs$/.test(m)), [], nom);
  }
  const script = lire('../src/scripts/debug.mjs');
  assert.doesNotMatch(script, /\.title\b|getAttribute\('title'\)|setAttribute\('title'/, 'aucune infobulle native');
  assert.match(script, /`\$\{api\}etat\/`/, 'l’état du service d’abord');
  assert.match(script, /etat\.edition !== true/, 'hors du site de dev : la page s’arrête');
  assert.doesNotMatch(script, /openapi|testeur|Tester l/i, 'plus de testeur');
  // chaque menu : chargé à son ouverture, relevé tant qu'il est ouvert (30 s, 30 s, 2 s), arrêté à sa fermeture — aucune minuterie hors de suivreLOuverture
  assert.match(script, /suivreLOuverture\(systeme, RELEVE_METRIQUES_MS, releverLeSysteme\);/);
  assert.match(script, /suivreLOuverture\(perfs, RELEVE_METRIQUES_MS, releverLesPerfs\);/);
  assert.match(script, /suivreLOuverture\(section, RELEVE_MS, \(\) => \{/);
  assert.doesNotMatch(script, /setInterval\(/, 'aucune relève qui tourne menu fermé');
  // chaque lecture vérifie que son menu est ouvert (un choix ou un délai qui arriverait menu fermé ne demande rien)
  assert.match(script, /if \(document\.hidden \|\| !perfs\.open\) return;/);
  assert.match(script, /if \(document\.hidden \|\| !systeme\.open\) return;/);
  assert.match(script, /if \(fermes\.metriques \|\| !perfs\.open\) return;/);
  assert.match(script, /if \(fermes\.requetes \|\| !perfs\.open\) return;/);
  assert.match(script, /if \(fermes\.systeme \|\| !systeme\.open\) return;/);
  assert.match(script, /if \(enCours \|\| arret \|\| !section\.open\) return;/);
  // la jauge de l'espace disque : de la réponse du système, dans son menu
  assert.match(script, /const espaceJauge = champ\(systeme, 'espace-jauge'\);/);
  assert.match(script, /espaceJauge\.innerHTML = htmlDeLEspaceDisque\(corps\.disque, /);
  // une instance pour les deux menus : les deux listes se suivent
  assert.match(script, /const instances = \[champ\(systeme, 'systeme-instance'\), champ\(perfs, 'perfs-instance'\)\];/);
  assert.match(script, /for \(const autre of instances\) if \(autre !== liste\) autre\.value = liste\.value;/);
  assert.match(script, /if \(numero !== demandes\.metriques\) return;/);
  assert.match(script, /statut === 403/, 'un service qui refuse (pas le site de dev) : la page s’arrête de demander');
});

/** Un faux élément pour faire tourner scripts/debug.mjs hors d'un navigateur : chaque sélecteur donne toujours le même enfant, rien n'est rendu. */
class FauxElement extends EventTarget {
  constructor() {
    super();
    Object.assign(this, { open: false, hidden: true, innerHTML: '', textContent: '', value: '', dataset: {}, children: [], options: [], selectedOptions: [], rows: [], scrollTop: 0 });
    this.classList = { toggle() {}, add() {}, remove() {}, contains: () => false };
    this.enfants = new Map();
  }

  querySelector(selecteur) {
    if (!this.enfants.has(selecteur)) this.enfants.set(selecteur, new FauxElement());
    return this.enfants.get(selecteur);
  }

  querySelectorAll() { return []; }
  closest() { return new FauxElement(); }
  setAttribute() {}
  getAttribute() { return null; }
  toggleAttribute() {}
  removeAttribute() {}
  insertAdjacentHTML() {}
  getBoundingClientRect() { return { top: 0, bottom: 0 }; }
  contains() { return false; }
  get lastElementChild() { return null; }
}

test('le vrai script dans un faux document : menus fermés, AUCUNE requête (choix, boutons, onglet compris) ; ouvert, aussitôt puis relevé ; refermé, arrêté ; l’instance choisie en tête de Système vaut pour Performances sans l’ouvrir', async () => {
  // « Performance et système aussi sont fermés par défaut » : la liste « Instance » en tête de Système (adaptation : sans elle, changer l'instance
  // de Système demanderait d'ouvrir Performances, donc de lancer ses relèves) et celle de Performances se suivent, et seul un menu ouvert demande.
  const racine = new FauxElement();
  racine.dataset.api = '/api/';
  const [systeme, perfs, journaux] = ['systeme', 'perfs', 'journaux'].map((nom) => racine.querySelector(`[data-debug-${nom}]`));
  const liste = { systeme: systeme.querySelector('[data-systeme-instance]'), perfs: perfs.querySelector('[data-perfs-instance]') };
  liste.systeme.value = INSTANCES[0].cle;
  liste.perfs.value = INSTANCES[0].cle;
  perfs.querySelector('[data-perfs-periode]').value = PERIODE_PAR_DEFAUT;
  const doc = new EventTarget();
  Object.assign(doc, { hidden: false, querySelector: (s) => (s === '[data-debug]' ? racine : null), getSelection: () => null });
  const appels = [];
  const minuteries = new Map();
  let numero = 0;
  const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, json: async () => corps });
  const avant = { document: globalThis.document, fetch: globalThis.fetch, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  Object.assign(globalThis, {
    document: doc,
    fetch: async (adresse) => {
      appels.push(String(adresse));
      return String(adresse) === '/api/etat/' ? reponse(200, { edition: true, version: '0.0.0' }) : reponse(404, { erreur: 'rien pour l’essai' });
    },
    setInterval: (f, ms) => (minuteries.set(++numero, ms), numero),
    clearInterval: (id) => minuteries.delete(id),
  });
  const attendre = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
  /** Les requêtes parties pendant `geste` (attendues : tout ce qui suit les promesses du script). */
  const pendant = async (geste) => {
    appels.length = 0;
    geste();
    await attendre();
    return [...appels];
  };
  const basculer = (menu, ouvert) => () => {
    menu.open = ouvert;
    menu.dispatchEvent(new Event('toggle'));
  };
  const choisir = (champ, valeur) => () => {
    champ.value = valeur;
    champ.dispatchEvent(new Event('change'));
  };
  try {
    assert.deepEqual(await pendant(() => import(new URL('../src/scripts/debug.mjs?faux-document', import.meta.url))), ['/api/etat/'], 'au chargement : l’état du service, rien d’autre');
    assert.equal(minuteries.size, 0, 'aucune minuterie, menus fermés');
    assert.deepEqual([systeme.hidden, perfs.hidden, journaux.hidden], [false, false, false], 'les menus se montrent (fermés)');
    // menus fermés : ni un choix, ni un bouton, ni l'onglet qui redevient visible ne demandent quoi que ce soit
    assert.deepEqual(await pendant(() => {
      choisir(liste.systeme, 'prod')();
      choisir(perfs.querySelector('[data-perfs-periode]'), '7j')();
      perfs.querySelector('[data-perfs-actualiser]').dispatchEvent(new Event('click'));
      doc.dispatchEvent(new Event('visibilitychange'));
      for (let i = 0; i < 2; i++) journaux.querySelector('[data-journaux-pause]').dispatchEvent(new Event('click'));
    }), [], 'menus fermés : aucune requête');
    assert.equal(liste.perfs.value, 'prod', 'l’instance choisie dans Système passe à Performances');
    // Système ouvert : aussitôt, l'instance choisie, sans rien demander pour Performances (resté fermé) ; puis toutes les 30 s
    assert.deepEqual(await pendant(basculer(systeme, true)), [adresseDuSysteme('/api/', 'prod')]);
    assert.deepEqual([...minuteries.values()], [RELEVE_METRIQUES_MS]);
    assert.deepEqual(await pendant(choisir(liste.systeme, 'dev')), [adresseDuSysteme('/api/', 'dev')], 'changer l’instance de Système ne lance pas Performances');
    assert.equal(liste.perfs.value, 'dev');
    assert.deepEqual(await pendant(basculer(systeme, false)), []);
    assert.equal(minuteries.size, 0, 'refermé : sa minuterie s’arrête');
    // Performances ouvert : ses deux lectures, l'instance et la période choisies menu fermé ; un choix d'instance n'y relève pas Système fermé
    const metriques = adresseDesMetriques('/api/', { instance: 'dev', periode: '7j', tri: TRI_PAR_DEFAUT });
    assert.deepEqual(await pendant(basculer(perfs, true)), [metriques, adresseDesRequetes('/api/')]);
    assert.deepEqual([...minuteries.values()], [RELEVE_METRIQUES_MS]);
    assert.deepEqual(await pendant(choisir(liste.perfs, 'prod')), [adresseDesMetriques('/api/', { instance: 'prod', periode: '7j', tri: TRI_PAR_DEFAUT })],
      'la production : ses métriques, ni requêtes une à une ni Système (fermé)');
    assert.equal(liste.systeme.value, 'prod', 'et l’instance choisie dans Performances passe à Système');
    await pendant(basculer(perfs, false));
    assert.equal(minuteries.size, 0);
    // Journaux ouvert : aussitôt, puis toutes les 2 s ; refermé, plus rien
    assert.deepEqual(await pendant(basculer(journaux, true)), [adresseDuJournal('/api/')]);
    assert.deepEqual([...minuteries.values()], [RELEVE_MS]);
    await pendant(basculer(journaux, false));
    assert.equal(minuteries.size, 0);
    assert.deepEqual(await pendant(() => doc.dispatchEvent(new Event('visibilitychange'))), [], 'tout refermé : plus rien');
  } finally {
    for (const [nom, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete globalThis[nom];
      else globalThis[nom] = valeur;
    }
  }
});

test('la CI construit aussi le site de production et y relance ce contrôle (sinon sa branche « production » ne tournerait jamais)', () => {
  const { jobs } = YAML.parse(lire('../../.github/workflows/ci.yml'));
  for (const nom of ['client', 'simulation-de-mise-a-jour']) {
    const commandes = jobs[nom].steps.filter((s) => s.run).map((s) => s.run.trim());
    const prod = commandes.findIndex((c) => /^HIDE_EXAMPLES=1 SITE_MODE=prod SITE_TAG=\S+ npm run build$/.test(c));
    assert.ok(prod >= 0, `${nom} : un build SITE_MODE=prod`);
    assert.match(commandes[prod + 1] ?? '', /^node --test .*test\/debug-page\.test\.mjs/, `${nom} : debug-page juste après ce build`);
    assert.match(commandes[prod + 1], /test\/site-html\.test\.mjs/, `${nom} : site-html aussi`);
  }
});

// ---- site construit (CI après le build ; sauté sans dist/) ---------------------------------------------------------------------------------
const dist = new URL('../dist/', import.meta.url);
const construit = existsSync(new URL('index.html', dist)) ? {} : { skip: 'site non construit (npm run build)' };

test('site construit : /debug/ selon le mode — quatre menus fermés (Système, Performances, Journaux, DB) et leurs scripts hors production ; une phrase et rien au menu en production', construit, () => {
  const html = readFileSync(new URL('debug/index.html', dist), 'utf8');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const outils = html.match(/<ul class="site-nav__items" data-group="outils"[^>]*>([\s\S]*?)<\/ul>/)[1];
  const auMenu = /<a href="\/debug\/"[^>]*>Debug<\/a>/.test(outils);
  if (main.includes('class="debug-reservee"')) {
    // build de production (SITE_MODE=prod ; la CI en fait un : ci.yml) : ni entrée de menu, ni menus, ni leurs scripts — dans toute la page, pas
    // seulement dans <main> : un composant qui poserait le script hors de la condition `actif` l'y ferait charger. Astro construit le script même
    // quand la page ne le pose pas (dist/_astro/) : on le reconnaît à ce qu'il lit (le journal, les métriques, le système, les tables, la version
    // de la base), et aucune page ne doit le charger.
    assert.match(main, /<p class="debug-reservee">Cette page est réservée au serveur de dev\.<\/p>/);
    assert.doesNotMatch(html, /data-debug\b|data-journaux|data-debug-systeme|data-debug-perfs/);
    // ni le menu « DB », ni la structure de la base (JSON), ni sa fenêtre
    assert.doesNotMatch(html, /data-debug-schema|data-schema-cadre|data-schema-dialogue|schema-contenu/);
    assert.equal(auMenu, false, 'pas au menu en production');
    const accueil = readFileSync(new URL('index.html', dist), 'utf8');
    assert.doesNotMatch(accueil, /href="\/debug\/"/, 'ni au menu de l’accueil');
    const duDebug = readdirSync(new URL('_astro/', dist)).filter((n) => n.endsWith('.js'))
      .filter((n) => { const code = readFileSync(new URL(`_astro/${n}`, dist), 'utf8'); return ['debug/journal/', 'debug/metriques/', 'debug/systeme/', 'debug/tables/', 'debug/base/'].some((a) => code.includes(a)); });
    for (const page of [html, accueil]) {
      const charges = [...page.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1].split('/').at(-1));
      assert.deepEqual(charges.filter((n) => duDebug.includes(n)), [], 'un script de la page Debug chargé en production');
    }
    return;
  }
  assert.equal(auMenu, true, 'au menu Outils du site de dev');
  assert.match(main, /<div class="debug" data-debug data-api="\/api\/">/);
  // quatre menus déroulants fermés, dans l'ordre ; Système, Performances et Journaux cachés tant que le service n'a pas répondu, DB visible
  assert.match(main, /<details class="debug-bloc debug-systeme" data-debug-systeme hidden>/);
  assert.match(main, /<details class="debug-bloc debug-perfs" data-debug-perfs hidden>/);
  assert.match(main, /<details class="debug-bloc debug-journaux" data-debug-journaux hidden>/);
  assert.match(main, /<details class="debug-bloc debug-schema" data-schema-cadre data-api="\/api\/">/, 'DB, fermé (ni open ni hidden)');
  assert.doesNotMatch(main, /<details\b[^>]*\sopen\b/, 'aucun menu ouvert au chargement');
  const ordre = ['data-debug-systeme', 'data-debug-perfs', 'data-debug-journaux', 'data-schema-cadre'].map((m) => main.indexOf(m));
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'Système, Performances, Journaux, DB');
  assert.equal((main.match(/<details class="debug-bloc /g) ?? []).length, 4, 'quatre menus, rien d’autre');
  assert.doesNotMatch(main, /data-debug-testeur|data-testeur|Tester l’API/, 'plus de testeur');
  assert.match(main, /<h2 class="debug-bloc__titre" id="debug-schema-titre">DB<\/h2>\s*<span class="debug-bloc__resume">Schéma de la base : \d+ tables, \d+ vues, \d+ clés étrangères<\/span>/);
  // la jauge de l'espace disque, dans Système
  const systeme = main.slice(main.indexOf('data-debug-systeme'), main.indexOf('data-debug-perfs'));
  assert.match(systeme, /<section class="debug-espace" data-debug-espace aria-labelledby="debug-espace-titre">/);
  assert.match(systeme, /<select id="debug-systeme-instance" data-systeme-instance><option value="dev" selected>Site de dev<\/option><option value="prod">Production<\/option><\/select>/);
  // DB : la structure du build en JSON, relue telle quelle ; sa fenêtre et son script
  const json = main.match(/<script type="application\/json" data-debug-schema>([^<]*)<\/script>/);
  assert.ok(json, 'la structure du schéma, en JSON');
  const structure = JSON.parse(json[1]);
  assert.equal(structure.tables.filter((t) => t.genre !== 'vue').length, 204);
  assert.equal(structure.tables.filter((t) => t.genre === 'vue').length, 38);
  assert.ok(structure.tables.find((t) => t.nom === 'sort').lignes > 0, 'nombre de lignes du build');
  assert.match(main, /<dialog class="schema-contenu" data-schema-dialogue aria-labelledby="schema-contenu-titre">/);
  assert.match(main, /<div class="schema-carte" data-schema-carte data-detail="loin" role="application" aria-roledescription="schéma de la base"/);
  assert.match(main, /<option value="dev" selected>Site de dev<\/option><option value="prod">Production<\/option>/, 'deux instances, jamais mélangées');
  assert.match(main, /<th scope="col" aria-sort="descending"><button type="button" class="debug-tri" data-tri-colonne="moyenne">Moyenne<\/button><\/th>/, 'trié par moyenne décroissante');
  assert.match(main, /href="\/api\/debug\/metriques\/export\/\?instance=dev&amp;periode=24h&amp;format=csv" download>Exporter \(CSV\)<\/a>/);
  assert.match(main, /<script type="module"/, 'le script de la page');
  // les scripts construits : celui des trois premiers menus (qui lit le journal, les métriques et le système) et celui de DB
  const construits = readdirSync(new URL('_astro/', dist)).filter((n) => n.endsWith('.js')).map((n) => readFileSync(new URL(`_astro/${n}`, dist), 'utf8'));
  assert.ok(construits.some((code) => code.includes('debug/journal/') && code.includes('debug/metriques/') && code.includes('debug/systeme/')),
    'le script de la page Debug dans dist/_astro/');
  assert.ok(!construits.some((code) => code.includes('v1/openapi.json')), 'plus de testeur (rien ne lit la description OpenAPI)');
  assert.ok(construits.some((code) => code.includes('debug/tables/') && code.includes('debug/base/') && code.includes('data-schema-monde')),
    'le script du schéma dans dist/_astro/ (contenu des tables, et relève de la version de la base pour les suivre)');
  assert.equal((main.match(/<script type="module"/g) ?? []).length, 2, 'les deux scripts de la page (menus et schéma), aucun module partagé');
  assert.doesNotMatch(main, /<(?:a|button|span|div|input|select|td|th)\b[^>]*\stitle=/, 'jamais d’infobulle native');
});
