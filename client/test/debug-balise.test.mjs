// Balise des pages (layouts/Base.astro ; demande du propriétaire du 2026-10-15, métriques de la page Debug ; décision : « Active-le aussi en prod dans
// un premier temps ») : le script en ligne, exécuté dans un faux navigateur — une seule mesure par page (TTFB, DOMContentLoaded, chargement, LCP),
// par navigator.sendBeacon (texte JSON), 5 s après le chargement ou plus tôt si l'on quitte la page ; le chemin CONSTRUIT de la page (jamais
// l'adresse de la barre ni ses paramètres) ; présente dans tous les builds sauf la version portable, la page de maintenance et SITE_METRIQUES_PAGES=0.
//   node --test test/debug-balise.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
const BALISE = /<script is:inline data-metriques-page=\{url\('api\/metriques\/page\/'\)\} data-metriques-chemin=\{pageMesuree\}>([\s\S]*?)<\/script>/;

/**
 * Exécute le script de la balise dans un faux navigateur. `o` : { etat ('loading' | 'complete'), navigation (l'entrée PerformanceNavigationTiming,
 * ou null), lcp (les entrées LCP, ou null : pas de PerformanceObserver), sendBeacon (false : absent) }. Rend { envois, evenements, minuteries, lancer }.
 */
function executer(o = {}) {
  const code = base.match(BALISE)[1];
  const vu = { envois: [], evenements: {}, documentEvenements: {}, minuteries: [] };
  const navigation = o.navigation === undefined
    ? { responseStart: 85.123, domContentLoadedEventEnd: 420.5, loadEventEnd: 980.257 }
    : o.navigation;
  const contexte = {
    document: {
      currentScript: { getAttribute: (n) => ({ 'data-metriques-page': '/api/metriques/page/', 'data-metriques-chemin': o.chemin ?? '/races/elfe/' })[n] },
      readyState: o.etat ?? 'loading',
      visibilityState: 'visible',
      addEventListener: (type, f) => { (vu.documentEvenements[type] ??= []).push(f); },
    },
    location: { pathname: '/races/elfe/', search: '?id=secret', hash: '#x' },
    navigator: o.sendBeacon === false ? {} : { sendBeacon: (adresse, corps) => { vu.envois.push([adresse, corps]); return true; } },
    performance: { getEntriesByType: (type) => (type === 'navigation' && navigation ? [navigation] : []) },
    addEventListener: (type, f) => { (vu.evenements[type] ??= []).push(f); },
    setTimeout: (f, ms) => { vu.minuteries.push([f, ms]); return vu.minuteries.length; },
    clearTimeout: (n) => { if (vu.minuteries[n - 1]) vu.minuteries[n - 1][0] = () => {}; },
    Math, JSON, isFinite,
  };
  if (o.lcp !== null) {
    contexte.PerformanceObserver = class {
      constructor(rappel) { this.rappel = rappel; }
      observe(options) {
        // un objet d'un autre royaume (vm) : comparé par son texte ; une erreur ici serait avalée par le try du script, d'où vu.options
        vu.options = JSON.stringify(options);
        vu.observe = () => this.rappel({ getEntries: () => o.lcp ?? [{ startTime: 640.4 }, { renderTime: 1203.456, startTime: 1100 }] });
      }
    };
  }
  contexte.window = contexte;
  vm.runInNewContext(code, contexte);
  const lancer = (type, cible = vu.evenements) => (cible[type] ?? []).forEach((f) => f());
  return { ...vu, lancer };
}

test('Base.astro : la balise est un script en ligne (aucun import), sauf version portable, page de maintenance et SITE_METRIQUES_PAGES=0', () => {
  assert.match(base, BALISE);
  assert.match(base, /const balise = !portable && !maintenance && process\.env\.SITE_METRIQUES_PAGES !== '0';/);
  assert.match(base, /\{\s*\/\*[\s\S]*?\*\/\s*balise && \(\s*<script is:inline data-metriques-page/, 'posée sous la condition `balise`');
  assert.match(base, /const pageMesuree = Astro\.url\.pathname;/, 'le chemin construit de la page');
  const code = base.match(BALISE)[1];
  assert.doesNotMatch(code, /\bimport\b|\bfetch\(/, 'aucun module, aucune autre requête');
  assert.doesNotMatch(code, /location\.(search|href|hash)|document\.cookie|userAgent/, 'ni paramètres, ni adresse complète, ni cookie, ni User-Agent');
  assert.equal((base.match(/data-metriques-page/g) ?? []).length, 2, 'une seule balise (et son attribut lu par le script)');
});

test('une seule mesure par page, 5 s après le chargement : TTFB, DOMContentLoaded, chargement, dernier LCP (précision 0,01 ms), en texte JSON', () => {
  const vu = executer();
  assert.equal(vu.options, '{"type":"largest-contentful-paint","buffered":true}', 'le LCP, entrées passées comprises');
  assert.deepEqual(vu.envois, [], 'rien avant le chargement');
  vu.observe();
  vu.lancer('load');
  assert.equal(vu.minuteries.length, 1);
  assert.equal(vu.minuteries[0][1], 5000);
  vu.minuteries[0][0]();
  assert.equal(vu.envois.length, 1);
  const [adresse, corps] = vu.envois[0];
  assert.equal(adresse, '/api/metriques/page/');
  assert.equal(typeof corps, 'string', 'une chaîne : sendBeacon l’envoie en text/plain;charset=UTF-8');
  assert.deepEqual(JSON.parse(corps), { page: '/races/elfe/', ttfb_ms: 85.12, dom_ms: 420.5, charge_ms: 980.26, lcp_ms: 1203.46 });
  // quitter la page ensuite n'envoie rien de plus
  vu.lancer('pagehide');
  vu.lancer('visibilitychange', vu.documentEvenements);
  assert.equal(vu.envois.length, 1, 'une seule fois par page');
});

test('quitter la page avant les 5 s envoie tout de suite (une fois) ; avant le chargement, sans les temps qui manquent', () => {
  const tot = executer();
  tot.lancer('load');
  tot.lancer('pagehide');
  assert.equal(tot.envois.length, 1);
  tot.minuteries[0][0]();
  assert.equal(tot.envois.length, 1, 'la minuterie annulée ne renvoie rien');
  // l'onglet caché avant la fin du chargement : ni chargement ni LCP (omis, jamais 0)
  const avant = executer({ navigation: { responseStart: 120, domContentLoadedEventEnd: 0, loadEventEnd: 0 }, lcp: [] });
  avant.observe();
  avant.lancer('visibilitychange', avant.documentEvenements); // visibilityState encore « visible » : rien
  assert.equal(avant.envois.length, 0);
  avant.lancer('pagehide');
  assert.deepEqual(JSON.parse(avant.envois[0][1]), { page: '/races/elfe/', ttfb_ms: 120 });
});

test('temps bornés (0 à 120 000 ms), chemin coupé à 200 caractères ; sans sendBeacon, sans entrée de navigation ou sans PerformanceObserver : rien ne casse', () => {
  const borne = executer({ navigation: { responseStart: -3, domContentLoadedEventEnd: Infinity, loadEventEnd: 500000 }, chemin: `/${'a'.repeat(300)}/` });
  borne.observe();
  borne.lancer('pagehide');
  const corps = JSON.parse(borne.envois[0][1]);
  assert.deepEqual(corps, { page: `/${'a'.repeat(199)}`, charge_ms: 120000, lcp_ms: 1203.46 });
  assert.deepEqual(executer({ sendBeacon: false }).evenements, {}, 'sans sendBeacon : le script s’arrête aussitôt');
  const sansNavigation = executer({ navigation: null });
  sansNavigation.lancer('pagehide');
  assert.deepEqual(sansNavigation.envois, []);
  const sansObservateur = executer({ lcp: null, etat: 'complete' });
  assert.equal(sansObservateur.minuteries.length, 1, 'déjà chargée : la minuterie part tout de suite');
  sansObservateur.minuteries[0][0]();
  assert.deepEqual(JSON.parse(sansObservateur.envois[0][1]), { page: '/races/elfe/', ttfb_ms: 85.12, dom_ms: 420.5, charge_ms: 980.26 });
});
