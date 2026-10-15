// Performances et système sur la page Debug (demande du propriétaire du 2026-10-15 : « isoler les informations de temps de réponse […] voir quels
// sont les appels les plus lents en moyenne […] extraire absolument tout ce qui est possible d'extraire dans un but de suivi, maintenance et
// évolutions » ; pages/debug.astro, src/scripts/debug.mjs) : fonctions pures sur les réponses du service (serveur/metriques.mjs), site de dev seulement :
//   GET <base>api/debug/metriques/?instance=dev|prod&periode=…&tri=…  → { instance, instances, periode, depuis, jusqua, global: STATS,
//       routes: [{ route, methode, ...STATS }], serie: [{ debut, n, moyenne_ms, p95_ms, erreurs }], pages: [{ page, n, ttfb_ms, dom_ms, charge_ms,
//       lcp_ms }], navigateurs: [{ famille, appareil, n }], origines: [{ page, route, n }] }
//       STATS = { n, erreurs_4xx, erreurs_5xx, part_304 (0 à 1), moyenne_ms, mediane_ms, p95_ms, p99_ms, min_ms, max_ms, ecart_type_ms, total_ms,
//       octets_entree, octets_sortie (cumulés sur la période), sql_requetes_moyen, sql_ms_moyen (par appel) }
//       une mesure de page : { moyenne, p95 } (ou `ttfb_ms` = la moyenne et `ttfb_p95_ms` : mesureDePage lit les deux écritures)
//   GET <base>api/debug/metriques/requetes/?limite=&route=&min_ms=  → { requetes: [{ instant, methode, route, adresse, statut, duree_ms,
//       phases: { corps_ms, traitement_ms, envoi_ms }, octets_entree, octets_sortie, sql: { n, ms, plus_lente: { sql, ms } }, page, navigateur,
//       appareil, simultanees }] } (la mémoire du site de dev)
//   GET <base>api/debug/systeme/?instance=…  → { instance, maintenant, processus, disque, fichiers, echantillons, evenements, volume, alertes }
//   GET <base>api/debug/metriques/export/?instance=&periode=&format=csv|json  (lien « Exporter »)
// Deux jeux de données séparés (décision du propriétaire du 2026-10-15) : la page montre l'instance choisie, dev OU production, jamais un mélange.
// Les courbes sont du SVG en ligne, sans bibliothèque et sans <title> (une infobulle native : jamais, Infobulles.astro) : un aria-label les décrit.
// Les coordonnées s'écrivent avec un point ; les nombres affichés à la française (virgule, espace fine insécable des milliers).
// Sans dépendance hors du testeur de la même page (lib/debug-api.mjs) ; importé par le seul script de la page Debug (et par lib/debug-journaux.mjs).
import { echapper } from './debug-api.mjs';

/** Intervalle de la relève des métriques et du système, en millisecondes (pas plus souvent : demande du coordinateur). */
export const RELEVE_METRIQUES_MS = 30000;

/** Les instances, dans l'ordre du choix ; `dev` quand le service a l'édition, `prod` sinon (serveur/metriques.mjs). */
export const INSTANCES = [
  { cle: 'dev', libelle: 'Site de dev' },
  { cle: 'prod', libelle: 'Production' },
];

/** Les périodes que le service sait agréger. */
export const PERIODES = [
  { cle: '1h', libelle: 'Dernière heure' },
  { cle: '24h', libelle: 'Dernières 24 heures' },
  { cle: '7j', libelle: '7 derniers jours' },
  { cle: '30j', libelle: '30 derniers jours' },
  { cle: '365j', libelle: '365 derniers jours' },
  { cle: 'tout', libelle: 'Tout' },
];
export const PERIODE_PAR_DEFAUT = '24h';

/**
 * Les colonnes du tableau des routes, dans l'ordre, chacune triable (en-tête bouton) : `serveur` = clé de tri que le service accepte (?tri=),
 * `texte` = triée dans l'ordre alphabétique (sinon du plus grand au plus petit par défaut).
 */
export const COLONNES_DES_ROUTES = [
  { cle: 'route', libelle: 'Route', texte: true },
  { cle: 'methode', libelle: 'Méthode', texte: true },
  { cle: 'n', libelle: 'Appels', serveur: true },
  { cle: 'moyenne', libelle: 'Moyenne', serveur: true },
  { cle: 'mediane', libelle: 'Médiane', serveur: true },
  { cle: 'p95', libelle: 'p95', serveur: true },
  { cle: 'p99', libelle: 'p99', serveur: true },
  { cle: 'max', libelle: 'Max', serveur: true },
  { cle: 'total', libelle: 'Temps cumulé', serveur: true },
  { cle: 'erreurs', libelle: 'Erreurs 4xx / 5xx', serveur: true },
  { cle: 'part_304', libelle: '304' },
  { cle: 'octets', libelle: 'Octets envoyés / reçus' },
  { cle: 'sql', libelle: 'SQL par appel', serveur: true },
];

/** Les choix de la liste « Trier par » : les clés que le service accepte d'abord, puis les autres colonnes. */
export const TRIS = [...COLONNES_DES_ROUTES.filter((c) => c.serveur), ...COLONNES_DES_ROUTES.filter((c) => !c.serveur)]
  .map(({ cle, libelle }) => ({ cle, libelle }));
export const TRI_PAR_DEFAUT = 'moyenne';

/** Une durée moyenne lente, très lente (ms) : la ligne et la cellule en sont marquées (data-lenteur). */
export const SEUILS_DE_LENTEUR_MS = { lent: 100, tresLent: 500 };
/** LCP lent, très lent (ms) : les seuils des « Core Web Vitals » (2,5 s et 4 s). */
export const SEUILS_LCP_MS = { lent: 2500, tresLent: 4000 };
/** Les routes les plus lentes en moyenne, mises en évidence (marque « parmi les plus lentes »). */
export const PLUS_LENTES = 3;
/** Disque bas : moins de 10 % libres ou moins de 2 Gio (les seuils des alertes du service) ; attention sous 20 %. */
export const SEUILS_DISQUE = { partAlerte: 0.1, octetsAlerte: 2 * 1024 ** 3, partAttention: 0.2 };
/** Requêtes récentes demandées à chaque relève. */
export const REQUETES_LIMITE = 100;

const ESPACE_FINE = ' ';
const INSECABLE = ' ';

const fini = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

/** Un nombre à la française : virgule décimale, espace fine insécable des milliers ; « — » s'il n'y en a pas. */
export function nombre(v, decimales = 0) {
  if (!fini(v)) return '—';
  const n = Number(v);
  const ecrit = Math.abs(n).toFixed(decimales);
  const [entier, fraction] = ecrit.split('.');
  const signe = n < 0 && Number(ecrit) !== 0 ? '-' : '';
  return `${signe}${entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE)}${fraction ? `,${fraction}` : ''}`;
}

/** Un nombre à la française sans les zéros inutiles de sa partie décimale (« 20 », « 4,5 », « 0,42 »). */
export const nombreCourt = (v, decimales = 0) => nombre(v, decimales).replace(/,(\d*?)0+$/, (_, reste) => (reste ? `,${reste}` : ''));

/** Une durée en millisecondes : « 0,42 ms », « 42,5 ms », « 20 ms », « 425 ms », « 4,25 s », « 2 min 05 s », « 1 h 05 min ». */
export function formaterDuree(ms) {
  if (!fini(ms)) return '—';
  const v = Number(ms);
  if (v < 10) return `${nombreCourt(v, 2)}${INSECABLE}ms`;
  if (v < 100) return `${nombreCourt(v, 1)}${INSECABLE}ms`;
  if (v < 1000) return `${nombre(v, 0)}${INSECABLE}ms`;
  if (v < 60000) return `${nombreCourt(v / 1000, v < 10000 ? 2 : 1)}${INSECABLE}s`;
  return formaterDureeLongue(v / 1000);
}

/** Une durée en secondes, à l'échelle d'une vie de processus : « 42 s », « 12 min 05 s », « 4 h 12 min », « 3 j 4 h ». */
export function formaterDureeLongue(secondes) {
  if (!fini(secondes)) return '—';
  const s = Math.max(0, Math.floor(Number(secondes)));
  const deux = (n) => String(n).padStart(2, '0');
  if (s < 60) return `${s}${INSECABLE}s`;
  if (s < 3600) return `${Math.floor(s / 60)}${INSECABLE}min ${deux(s % 60)}${INSECABLE}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}${INSECABLE}h ${deux(Math.floor((s % 3600) / 60))}${INSECABLE}min`;
  return `${Math.floor(s / 86400)}${INSECABLE}j ${Math.floor((s % 86400) / 3600)}${INSECABLE}h`;
}

const UNITES = ['Kio', 'Mio', 'Gio', 'Tio'];

/** Une taille en octets (unités binaires) : « 512 o », « 1,5 Kio », « 12,3 Mio », « 205 Gio ». */
export function formaterOctets(octets) {
  if (!fini(octets)) return '—';
  const o = Number(octets);
  if (Math.abs(o) < 1024) return `${nombre(o, 0)}${INSECABLE}o`;
  let v = o;
  let rang = -1;
  while (Math.abs(v) >= 1024 && rang < UNITES.length - 1) {
    v /= 1024;
    rang += 1;
  }
  return `${nombreCourt(v, Math.abs(v) < 100 ? 1 : 0)}${INSECABLE}${UNITES[rang]}`;
}

/** Une part (0 à 1) en pourcentage : « 0,5 % », « 12 % ». */
export function formaterPart(part) {
  if (!fini(part)) return '—';
  const p = Number(part) * 100;
  return `${nombreCourt(p, Math.abs(p) < 10 ? 1 : 0)}${INSECABLE}%`;
}

const deux = (n) => String(n).padStart(2, '0');

/** Un instant à l'heure locale : « 14:05:09 », précédé du jour (« 14/10 14:05:09 ») si ce n'est pas celui de `maintenant`. */
export function instantLisible(instant, maintenant = new Date()) {
  const d = new Date(instant);
  if (instant === null || instant === undefined || instant === '' || Number.isNaN(d.getTime())) return String(instant ?? '');
  const heure = `${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`;
  const memeJour = d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth() && d.getDate() === maintenant.getDate();
  return memeJour ? heure : `${deux(d.getDate())}/${deux(d.getMonth() + 1)} ${heure}`;
}

/** L'étiquette d'un instant sur l'axe d'une courbe, selon son pas : « 14:05 » (moins d'une heure), « 14/10 14 h » (moins d'un jour), « 14/10 ». */
export function etiquetteDeTemps(t, pasMs) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  if (pasMs < 3600000) return `${deux(d.getHours())}:${deux(d.getMinutes())}`;
  if (pasMs < 86400000) return `${deux(d.getDate())}/${deux(d.getMonth() + 1)} ${d.getHours()}${INSECABLE}h`;
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}`;
}

/** Une adresse et ses paramètres (les vides sont omis). */
function avecParametres(adresse, parametres) {
  const morceaux = Object.entries(parametres)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !Number.isFinite(v)))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return `${adresse}${morceaux.length ? `?${morceaux.join('&')}` : ''}`;
}

const CLES_DE_TRI_DU_SERVICE = new Set(COLONNES_DES_ROUTES.filter((c) => c.serveur).map((c) => c.cle));

/** L'adresse des métriques : `api` = « <base>api/ » ; un tri que le service ne connaît pas n'est pas transmis (la page trie elle-même). */
export function adresseDesMetriques(api, { instance = 'dev', periode = PERIODE_PAR_DEFAUT, tri = TRI_PAR_DEFAUT } = {}) {
  return avecParametres(`${api}debug/metriques/`, { instance, periode, tri: CLES_DE_TRI_DU_SERVICE.has(tri) ? tri : undefined });
}

/** L'adresse des requêtes récentes (mémoire du site de dev) ; min_ms : seulement les plus lentes que ce seuil. */
export function adresseDesRequetes(api, { limite = REQUETES_LIMITE, route = '', minMs = 0 } = {}) {
  return avecParametres(`${api}debug/metriques/requetes/`, { limite, route, min_ms: Number(minMs) > 0 ? Number(minMs) : undefined });
}

/** L'adresse du système d'une instance. */
export function adresseDuSysteme(api, instance = 'dev') {
  return avecParametres(`${api}debug/systeme/`, { instance });
}

/** L'adresse de l'export des agrégats horaires (lien « Exporter » : le service répond en pièce jointe). */
export function adresseDeLExport(api, { instance = 'dev', periode = PERIODE_PAR_DEFAUT, format = 'csv' } = {}) {
  return avecParametres(`${api}debug/metriques/export/`, { instance, periode, format });
}

/** Le seuil saisi dans un champ « plus lent que … ms » : un nombre positif, sinon 0 (aucun seuil). */
export function seuilSaisi(texte) {
  const n = Number(String(texte ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Routes

/** La valeur d'une route pour une colonne (tri) : un texte pour route et méthode, un nombre (ou null s'il manque) sinon. */
export function valeurDeTri(route, cle) {
  const nb = (v) => (fini(v) ? Number(v) : null);
  switch (cle) {
    case 'route': return String(route?.route ?? '');
    case 'methode': return String(route?.methode ?? '');
    case 'n': return nb(route?.n);
    case 'moyenne': return nb(route?.moyenne_ms);
    case 'mediane': return nb(route?.mediane_ms);
    case 'p95': return nb(route?.p95_ms);
    case 'p99': return nb(route?.p99_ms);
    case 'max': return nb(route?.max_ms);
    case 'total': return nb(route?.total_ms) ?? (fini(route?.moyenne_ms) && fini(route?.n) ? Number(route.moyenne_ms) * Number(route.n) : null);
    case 'erreurs': {
      const quatre = nb(route?.erreurs_4xx);
      const cinq = nb(route?.erreurs_5xx);
      // les 5xx d'abord (une erreur du service pèse plus qu'un refus) : 5xx × 10^9 + 4xx
      return quatre === null && cinq === null ? null : (cinq ?? 0) * 1e9 + (quatre ?? 0);
    }
    case 'part_304': return nb(route?.part_304);
    case 'octets': return nb(route?.octets_sortie);
    case 'sql': return nb(route?.sql_ms_moyen);
    default: return null;
  }
}

/** Le sens d'un tri neuf sur cette colonne : alphabétique pour le texte, du plus grand au plus petit pour un nombre. */
export const sensParDefaut = (cle) => (COLONNES_DES_ROUTES.find((c) => c.cle === cle)?.texte ? 'asc' : 'desc');

/** La clé d'une route (méthode et gabarit). */
export const cleDeRoute = (r) => `${r?.methode ?? ''} ${r?.route ?? ''}`;

/**
 * Les routes triées (une copie) par la colonne `cle`, dans le sens `sens` ; une valeur manquante va toujours à la fin ; à égalité, la plus appelée,
 * puis la route dans l'ordre alphabétique.
 */
export function trierRoutes(routes, { cle = TRI_PAR_DEFAUT, sens = sensParDefaut(cle) } = {}) {
  const signe = sens === 'asc' ? 1 : -1;
  const texte = COLONNES_DES_ROUTES.find((c) => c.cle === cle)?.texte;
  return (Array.isArray(routes) ? routes : []).filter((r) => r && typeof r === 'object').map((r, i) => ({ r, i })).sort((a, b) => {
    const va = valeurDeTri(a.r, cle);
    const vb = valeurDeTri(b.r, cle);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else {
      const c = texte ? String(va).localeCompare(String(vb), 'fr') : va - vb;
      if (c) return signe * c;
    }
    return (Number(b.r.n) || 0) - (Number(a.r.n) || 0) || cleDeRoute(a.r).localeCompare(cleDeRoute(b.r), 'fr') || a.i - b.i;
  }).map(({ r }) => r);
}

/** Les clés (cleDeRoute) des `combien` routes les plus lentes en moyenne (appelées au moins une fois). */
export function plusLentes(routes, combien = PLUS_LENTES) {
  return new Set(trierRoutes((Array.isArray(routes) ? routes : []).filter((r) => Number(r?.n) > 0 && fini(r?.moyenne_ms)), { cle: 'moyenne', sens: 'desc' })
    .slice(0, combien).map(cleDeRoute));
}

/** La lenteur d'une durée : 'tres-lent', 'lent' ou '' (SEUILS_DE_LENTEUR_MS ; un autre jeu de seuils pour le LCP). */
export function lenteur(ms, seuils = SEUILS_DE_LENTEUR_MS) {
  if (!fini(ms)) return '';
  const v = Number(ms);
  if (v >= seuils.tresLent) return 'tres-lent';
  if (v >= seuils.lent) return 'lent';
  return '';
}

const attributLenteur = (ms, seuils) => {
  const l = lenteur(ms, seuils);
  return l ? ` data-lenteur="${l}"` : '';
};

/** La pastille d'une méthode HTTP (couleurs du testeur). */
export function pastilleDeMethode(methode) {
  const m = String(methode ?? '').toUpperCase();
  const classe = /^[A-Z]+$/.test(m) ? ` debug-methode--${m.toLowerCase()}` : '';
  return `<span class="debug-methode${classe}">${echapper(m || '?')}</span>`;
}

/** La famille d'un statut, pour sa couleur : succes, renvoi, refus (4xx), erreur (5xx). */
const familleDe = (statut) => {
  const s = Number(statut);
  if (s >= 500) return 'erreur';
  if (s >= 400) return 'refus';
  if (s >= 300) return 'renvoi';
  return 'succes';
};

/** L'attribut aria-sort d'un en-tête de colonne pour le tri en cours. */
export const ariaSort = (tri, cle) => (tri?.cle === cle ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none');

/**
 * Les lignes du tableau des routes, dans l'ordre donné : une route lente (moyenne ≥ 100 ms) ou très lente (≥ 500 ms) porte data-lenteur, les
 * PLUS_LENTES plus lentes en moyenne portent data-plus-lente et une marque lisible (pas seulement une couleur).
 */
export function htmlDesRoutes(routes, { lentes = plusLentes(routes) } = {}) {
  return (Array.isArray(routes) ? routes : []).filter((r) => r && typeof r === 'object').map((r) => {
    const parmi = lentes.has(cleDeRoute(r));
    const quatre = Number(r.erreurs_4xx) || 0;
    const cinq = Number(r.erreurs_5xx) || 0;
    return `<tr class="debug-route"${attributLenteur(r.moyenne_ms)}${parmi ? ' data-plus-lente' : ''}>`
      + `<th scope="row" class="debug-route__route"><code>${echapper(r.route)}</code>${parmi ? ' <span class="debug-marque">parmi les plus lentes</span>' : ''}</th>`
      + `<td>${pastilleDeMethode(r.methode)}</td>`
      + `<td class="debug-nombre">${nombre(r.n)}</td>`
      + `<td class="debug-nombre"${attributLenteur(r.moyenne_ms)}>${formaterDuree(r.moyenne_ms)}</td>`
      + `<td class="debug-nombre"${attributLenteur(r.mediane_ms)}>${formaterDuree(r.mediane_ms)}</td>`
      + `<td class="debug-nombre"${attributLenteur(r.p95_ms)}>${formaterDuree(r.p95_ms)}</td>`
      + `<td class="debug-nombre"${attributLenteur(r.p99_ms)}>${formaterDuree(r.p99_ms)}</td>`
      + `<td class="debug-nombre"${attributLenteur(r.max_ms)}>${formaterDuree(r.max_ms)}</td>`
      + `<td class="debug-nombre">${formaterDuree(valeurDeTri(r, 'total'))}</td>`
      + `<td class="debug-nombre"><span${quatre ? ' class="debug-err4"' : ''}>${nombre(quatre)}</span> / <span${cinq ? ' class="debug-err5"' : ''}>${nombre(cinq)}</span></td>`
      + `<td class="debug-nombre">${formaterPart(r.part_304)}</td>`
      + `<td class="debug-nombre">${formaterOctets(r.octets_sortie)} / ${formaterOctets(r.octets_entree)}</td>`
      + `<td class="debug-nombre">${nombreCourt(r.sql_requetes_moyen, 1)}${INSECABLE}req. · ${formaterDuree(r.sql_ms_moyen)}</td></tr>`;
  }).join('');
}

/** Les chiffres d'ensemble (STATS de la période) : une liste de définitions. */
export function htmlDesChiffres(global) {
  if (!global || typeof global !== 'object') return '';
  const lignes = [
    ['Appels', nombre(global.n)],
    ['Moyenne', formaterDuree(global.moyenne_ms), global.moyenne_ms],
    ['Médiane', formaterDuree(global.mediane_ms), global.mediane_ms],
    ['p95', formaterDuree(global.p95_ms), global.p95_ms],
    ['p99', formaterDuree(global.p99_ms), global.p99_ms],
    ['Min / max', `${formaterDuree(global.min_ms)} / ${formaterDuree(global.max_ms)}`],
    ['Écart type', formaterDuree(global.ecart_type_ms)],
    ['Temps cumulé', formaterDuree(global.total_ms)],
    ['Erreurs 4xx / 5xx', `${nombre(global.erreurs_4xx ?? 0)} / ${nombre(global.erreurs_5xx ?? 0)}`],
    ['Réponses 304', formaterPart(global.part_304)],
    ['Octets reçus / envoyés', `${formaterOctets(global.octets_entree)} / ${formaterOctets(global.octets_sortie)}`],
    ['SQL par appel', `${nombreCourt(global.sql_requetes_moyen, 1)}${INSECABLE}req. · ${formaterDuree(global.sql_ms_moyen)}`],
  ];
  return lignes.map(([dt, dd, ms]) => `<div${ms === undefined ? '' : attributLenteur(ms)}><dt>${dt}</dt><dd>${dd}</dd></div>`).join('');
}

/** La phrase du titre « Performances » : instance, période et quelques chiffres. */
export function resumeDesMetriques(reponse) {
  if (!reponse || typeof reponse !== 'object') return '';
  const instance = INSTANCES.find((i) => i.cle === reponse.instance)?.libelle ?? reponse.instance ?? '';
  const periode = PERIODES.find((p) => p.cle === reponse.periode)?.libelle ?? reponse.periode ?? '';
  const g = reponse.global ?? {};
  const appels = Number(g.n) || 0;
  const morceaux = [instance, periode, `${nombre(appels)} appel${appels > 1 ? 's' : ''}`];
  if (appels) morceaux.push(`moyenne ${formaterDuree(g.moyenne_ms)}`, `p95 ${formaterDuree(g.p95_ms)}`);
  const erreurs = (Number(g.erreurs_5xx) || 0);
  if (erreurs) morceaux.push(`${nombre(erreurs)} erreur${erreurs > 1 ? 's' : ''} 5xx`);
  return morceaux.filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Pages vues, navigateurs, origines

/** Les temps d'une page vue que mesure la balise des pages (layouts/Base.astro), dans l'ordre des colonnes. */
export const MESURES_DE_PAGE = [
  { cle: 'ttfb', libelle: 'Premier octet' },
  { cle: 'dom', libelle: 'DOMContentLoaded' },
  { cle: 'charge', libelle: 'Chargement complet' },
  { cle: 'lcp', libelle: 'LCP' },
];

/**
 * Une mesure d'une page vue (ttfb, dom, charge, lcp) : { moyenne, p95 } (null s'il manque). Écritures lues : `<cle>_ms: { moyenne, p95 }` (ou
 * moyenne_ms, p95_ms), `<cle>_ms` nombre (la moyenne) avec `<cle>_p95_ms`, ou `<cle>: { moyenne_ms, p95_ms }`.
 */
export function mesureDePage(page, cle) {
  const nb = (v) => (fini(v) ? Number(v) : null);
  const brut = page?.[`${cle}_ms`] ?? page?.[cle];
  if (brut && typeof brut === 'object') {
    return { moyenne: nb(brut.moyenne ?? brut.moyenne_ms), p95: nb(brut.p95 ?? brut.p95_ms) };
  }
  return { moyenne: nb(brut), p95: nb(page?.[`${cle}_p95_ms`] ?? page?.[`${cle}_p95`]) };
}

/** Les lignes du tableau des pages vues (temps mesurés par le navigateur), les plus vues d'abord ; le LCP lent est marqué. */
export function htmlDesPages(pages) {
  const liste = (Array.isArray(pages) ? pages : []).filter((p) => p && typeof p === 'object')
    .sort((a, b) => (Number(b.n) || 0) - (Number(a.n) || 0) || String(a.page).localeCompare(String(b.page), 'fr'));
  return liste.map((p) => `<tr><th scope="row"><code>${echapper(p.page)}</code></th><td class="debug-nombre">${nombre(p.n)}</td>${MESURES_DE_PAGE.map(({ cle }) => {
    const m = mesureDePage(p, cle);
    const seuils = cle === 'lcp' ? SEUILS_LCP_MS : null;
    return `<td class="debug-nombre"${seuils ? attributLenteur(m.p95 ?? m.moyenne, seuils) : ''}>${formaterDuree(m.moyenne)} / ${formaterDuree(m.p95)}</td>`;
  }).join('')}</tr>`).join('');
}

const APPAREILS = { ordinateur: 'Ordinateur', telephone: 'Téléphone', tablette: 'Tablette', robot: 'Robot', inconnu: 'Inconnu' };

/** Le libellé d'un appareil (ordinateur, telephone, tablette, robot). */
export const libelleDAppareil = (appareil) => APPAREILS[appareil] ?? String(appareil ?? '');

/** Une barre de part (0 à 1) : sa largeur dit la part, le texte la répète (pas seulement une forme). */
function barre(part) {
  const p = Math.round(Math.min(1, Math.max(0, Number(part) || 0)) * 1000) / 10;
  return `<span class="debug-part"><span class="debug-part__barre" style="width: ${p}%"></span></span> ${formaterPart(p / 100)}`;
}

/** Les lignes du tableau des navigateurs et appareils, les plus nombreux d'abord, avec leur part. */
export function htmlDesNavigateurs(navigateurs) {
  const liste = (Array.isArray(navigateurs) ? navigateurs : []).filter((x) => x && typeof x === 'object')
    .sort((a, b) => (Number(b.n) || 0) - (Number(a.n) || 0));
  const total = liste.reduce((s, x) => s + (Number(x.n) || 0), 0);
  return liste.map((x) => `<tr><th scope="row">${echapper(x.famille || 'Inconnu')}</th><td>${echapper(libelleDAppareil(x.appareil))}</td>`
    + `<td class="debug-nombre">${nombre(x.n)}</td><td class="debug-part-cellule">${barre(total ? (Number(x.n) || 0) / total : 0)}</td></tr>`).join('');
}

/** Les lignes du tableau des origines (quelle page appelle quelle route), les plus nombreuses d'abord, `max` au plus. */
export function htmlDesOrigines(origines, max = 100) {
  return (Array.isArray(origines) ? origines : []).filter((x) => x && typeof x === 'object')
    .sort((a, b) => (Number(b.n) || 0) - (Number(a.n) || 0)).slice(0, max)
    .map((x) => `<tr><th scope="row"><code>${echapper(x.page || '(aucune)')}</code></th><td><code>${echapper(x.route)}</code></td>`
      + `<td class="debug-nombre">${nombre(x.n)}</td></tr>`).join('');
}

/** Les options de la liste des routes des requêtes récentes : « Toutes », puis les gabarits connus (sans doublon), la choisie gardée. */
export function optionsDesRoutes(routes, choisie = '') {
  const gabarits = new Set((Array.isArray(routes) ? routes : []).map((r) => r?.route).filter(Boolean));
  if (choisie) gabarits.add(choisie);
  return `<option value=""${choisie ? '' : ' selected'}>Toutes</option>${[...gabarits].sort((a, b) => a.localeCompare(b, 'fr'))
    .map((g) => `<option value="${echapper(g)}"${g === choisie ? ' selected' : ''}>${echapper(g)}</option>`).join('')}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Requêtes récentes

const PHASES = [
  { cle: 'corps_ms', libelle: 'Lecture du corps' },
  { cle: 'traitement_ms', libelle: 'Traitement' },
  { cle: 'envoi_ms', libelle: 'Envoi' },
];

/** Les phases d'une requête : une barre empilée (largeur = part de la durée totale) et leur détail en texte. */
export function htmlDesPhases(phases, total) {
  const valeurs = PHASES.map((p) => ({ ...p, ms: fini(phases?.[p.cle]) ? Number(phases[p.cle]) : null }));
  const somme = fini(total) && Number(total) > 0 ? Number(total) : valeurs.reduce((s, v) => s + (v.ms ?? 0), 0);
  const texte = valeurs.map((v) => `${v.libelle} ${formaterDuree(v.ms)}`).join(', ');
  const segments = somme > 0 ? valeurs.map((v, rang) => {
    if (!(v.ms > 0)) return '';
    const largeur = Math.round(Math.min(1, v.ms / somme) * 1000) / 10;
    return `<span class="debug-phases__segment debug-phases__segment--${rang}" style="width: ${largeur}%"></span>`;
  }).join('') : '';
  return `<div class="debug-phases" role="img" aria-label="${echapper(`Phases : ${texte}`)}">${segments}</div>`
    + `<ul class="debug-phases__legende">${valeurs.map((v, i) => `<li><span class="debug-phases__marque debug-phases__segment--${i}" aria-hidden="true"></span>${v.libelle} : ${formaterDuree(v.ms)}</li>`).join('')}</ul>`;
}

/** Les requêtes récentes, la plus récente d'abord : une ligne repliable chacune (détail des phases et du SQL au clic). */
export function htmlDesRequetes(requetes, maintenant = new Date()) {
  const liste = (Array.isArray(requetes) ? requetes : []).filter((r) => r && typeof r === 'object')
    .sort((a, b) => (Date.parse(b.instant) || 0) - (Date.parse(a.instant) || 0));
  return liste.map((r) => {
    const sql = r.sql && typeof r.sql === 'object' ? r.sql : {};
    const lente = sql.plus_lente && typeof sql.plus_lente === 'object' && sql.plus_lente.sql ? sql.plus_lente : null;
    const details = [
      ['Adresse', `<code>${echapper(r.adresse ?? r.route)}</code>`],
      ['Octets reçus / envoyés', `${formaterOctets(r.octets_entree)} / ${formaterOctets(r.octets_sortie)}`],
      ['SQL', `${nombre(sql.n ?? 0)} requête${Number(sql.n) > 1 ? 's' : ''} · ${formaterDuree(sql.ms ?? 0)}`],
      ...(lente ? [['Requête SQL la plus lente', `<code>${echapper(lente.sql)}</code> · ${formaterDuree(lente.ms)}`]] : []),
      ['Page d’origine', r.page ? `<code>${echapper(r.page)}</code>` : '—'],
      ['Navigateur', `${echapper(r.navigateur || 'Inconnu')} · ${echapper(libelleDAppareil(r.appareil) || 'Inconnu')}`],
      ['Requêtes simultanées', nombre(r.simultanees)],
    ];
    return `<li><details class="debug-requete"${attributLenteur(r.duree_ms)}><summary>`
      + `<time datetime="${echapper(r.instant)}">${echapper(instantLisible(r.instant, maintenant))}</time>`
      + `${pastilleDeMethode(r.methode)}<code class="debug-requete__route">${echapper(r.route)}</code>`
      + `<span class="debug-statut debug-statut--${familleDe(r.statut)}">${echapper(r.statut)}</span>`
      + `<span class="debug-requete__duree">${formaterDuree(r.duree_ms)}</span></summary>`
      + `<div class="debug-requete__detail">${htmlDesPhases(r.phases, r.duree_ms)}`
      + `<dl class="debug-definitions">${details.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join('')}</dl></div></details></li>`;
  }).join('');
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Courbes (SVG en ligne)

/** Le plafond « rond » d'une échelle : 1, 2 ou 5 × 10^k, au moins la valeur ; 1 pour une valeur nulle. */
export function plafondRond(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  const puissance = 10 ** Math.floor(Math.log10(n));
  const f = n / puissance;
  const rond = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return rond * puissance;
}

const c = (v) => String(Math.round(v * 10) / 10);

/**
 * Une courbe en SVG en ligne : `points` (les objets de la série), `series` [{ cle, libelle, forme: 'barres'|'ligne', format }] — chacune sur sa
 * propre échelle (de 0 au plafond rond de son maximum), la première graduée à gauche, la deuxième à droite ; en abscisse le temps (`x`, par défaut
 * `debut` ou `instant`) si chaque point en a un, sinon le rang. Un trou de plus d'un pas et demi coupe une ligne. Aucune donnée : une phrase.
 * Rend un <div class="debug-courbe"> : le SVG (role="img", aria-label = `etiquette` et l'étendue de chaque série ; jamais de <title>, qui serait une
 * infobulle native) et sa légende.
 */
export function courbe(points, { series = [], x = (p) => p.debut ?? p.instant, largeur = 640, hauteur = 180, etiquette = 'Courbe' } = {}) {
  const liste = (Array.isArray(points) ? points : []).filter((p) => p && typeof p === 'object');
  if (!liste.length || !series.length) return '<p class="debug-vide">Aucune donnée sur la période.</p>';
  const temps = liste.map((p) => Date.parse(x(p)));
  const parTemps = temps.every(Number.isFinite);
  const ordre = liste.map((p, i) => ({ p, t: parTemps ? temps[i] : i })).sort((a, b) => a.t - b.t);
  const ecarts = ordre.slice(1).map((o, i) => o.t - ordre[i].t).filter((d) => d > 0);
  const pas = ecarts.length ? Math.min(...ecarts) : (parTemps ? 60000 : 1);
  const t0 = ordre[0].t;
  const t1 = ordre.at(-1).t + pas;
  const M = { haut: 12, bas: 22, gauche: 58, droite: 58 };
  const w = largeur - M.gauche - M.droite;
  const h = hauteur - M.haut - M.bas;
  const bas = M.haut + h;
  const X = (t) => M.gauche + ((t - t0) / (t1 - t0)) * w;
  const largeurDuPas = (pas / (t1 - t0)) * w;
  const morceaux = [
    `<line class="debug-courbe__grille" x1="${M.gauche}" y1="${M.haut}" x2="${largeur - M.droite}" y2="${M.haut}"/>`,
    `<line class="debug-courbe__grille" x1="${M.gauche}" y1="${c(M.haut + h / 2)}" x2="${largeur - M.droite}" y2="${c(M.haut + h / 2)}"/>`,
    `<line class="debug-courbe__axe" x1="${M.gauche}" y1="${bas}" x2="${largeur - M.droite}" y2="${bas}"/>`,
  ];
  const resumes = [];
  series.forEach((s, rang) => {
    const format = typeof s.format === 'function' ? s.format : (v) => nombre(v);
    const valeurs = ordre.map((o) => (fini(o.p[s.cle]) ? Number(o.p[s.cle]) : null));
    const finies = valeurs.filter((v) => v !== null);
    const maxReel = finies.length ? Math.max(...finies) : 0;
    const plafond = plafondRond(maxReel);
    const Y = (v) => M.haut + h - (Math.max(0, v) / plafond) * h;
    const classe = `debug-courbe__serie debug-courbe__serie--${rang}`;
    if (s.forme === 'barres') {
      const rects = ordre.map((o, i) => (valeurs[i] > 0
        ? `<rect x="${c(X(o.t) + largeurDuPas * 0.1)}" y="${c(Y(valeurs[i]))}" width="${c(Math.max(0.5, largeurDuPas * 0.8))}" height="${c(bas - Y(valeurs[i]))}"/>`
        : '')).join('');
      morceaux.push(`<g class="${classe} debug-courbe__barres">${rects}</g>`);
    } else {
      // une ligne par suite de points sans trou (pas manquant ou valeur absente)
      const traits = [];
      let courant = [];
      ordre.forEach((o, i) => {
        const precedent = ordre[i - 1];
        if (valeurs[i] === null || (precedent && o.t - precedent.t > pas * 1.5)) {
          if (courant.length) traits.push(courant);
          courant = [];
        }
        if (valeurs[i] !== null) courant.push([X(o.t + pas / 2), Y(valeurs[i])]);
      });
      if (courant.length) traits.push(courant);
      const dessin = traits.map((t) => (t.length === 1
        ? `<circle cx="${c(t[0][0])}" cy="${c(t[0][1])}" r="2.5"/>`
        : `<polyline points="${t.map(([px, py]) => `${c(px)},${c(py)}`).join(' ')}"/>`)).join('');
      morceaux.push(`<g class="${classe} debug-courbe__ligne">${dessin}</g>`);
    }
    if (rang < 2) {
      const gauche = rang === 0;
      const ax = gauche ? M.gauche - 6 : largeur - M.droite + 6;
      const ancre = gauche ? 'end' : 'start';
      morceaux.push(`<text class="${classe} debug-courbe__graduation" x="${ax}" y="${M.haut + 4}" text-anchor="${ancre}">${echapper(format(plafond))}</text>`,
        `<text class="${classe} debug-courbe__graduation" x="${ax}" y="${bas}" text-anchor="${ancre}">${echapper(format(0))}</text>`);
    }
    resumes.push(`${s.libelle} : jusqu’à ${format(maxReel)}`);
  });
  const etiquetteDe = (t) => (parTemps ? etiquetteDeTemps(t, pas) : String(t + 1));
  morceaux.push(`<text class="debug-courbe__temps" x="${M.gauche}" y="${hauteur - 5}" text-anchor="start">${echapper(etiquetteDe(t0))}</text>`,
    `<text class="debug-courbe__temps" x="${largeur - M.droite}" y="${hauteur - 5}" text-anchor="end">${echapper(etiquetteDe(ordre.at(-1).t))}</text>`);
  const etendue = parTemps ? ` Du ${etiquetteDe(t0)} au ${etiquetteDe(ordre.at(-1).t)}, ${ordre.length} point${ordre.length > 1 ? 's' : ''}.` : '';
  const label = `${etiquette}. ${resumes.join(' ; ')}.${etendue}`;
  const svg = `<svg class="debug-courbe__svg" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${echapper(label)}" focusable="false">${morceaux.join('')}</svg>`;
  const legende = `<ul class="debug-legende">${series.map((s, rang) => `<li><span class="debug-legende__marque debug-legende__marque--${s.forme === 'barres' ? 'barres' : 'ligne'} debug-courbe__serie--${rang}" aria-hidden="true"></span>${echapper(s.libelle)}</li>`).join('')}</ul>`;
  return `<div class="debug-courbe">${svg}${legende}</div>`;
}

/** La courbe de la série des métriques : appels (barres) et p95 (ligne). */
export const courbeDeLaSerie = (serie) => courbe(serie, {
  series: [
    { cle: 'n', libelle: 'Appels', forme: 'barres', format: (v) => nombre(v) },
    { cle: 'p95_ms', libelle: 'Temps de réponse p95', forme: 'ligne', format: formaterDuree },
  ],
  etiquette: 'Appels et temps de réponse p95 sur la période',
});

/** La courbe des échantillons du système : mémoire RSS et délai p99 de la boucle d'événements. */
export const courbeDuSysteme = (echantillons) => courbe(echantillons, {
  series: [
    { cle: 'rss', libelle: 'Mémoire (RSS)', forme: 'ligne', format: formaterOctets },
    { cle: 'boucle_p99_ms', libelle: 'Boucle d’événements p99', forme: 'ligne', format: formaterDuree },
  ],
  x: (p) => p.instant,
  etiquette: 'Mémoire et délai de la boucle d’événements',
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Système

/**
 * Une jauge (role="meter") : `part` de 0 à 1, `libelle` (son nom accessible), `texte` (la valeur dite), `niveau` ('', 'attention', 'alerte').
 * La largeur du remplissage est la part ; le texte est aussi écrit à côté par l'appelant (pas seulement une forme).
 */
export function jauge({ part, libelle, texte, niveau = '' }) {
  const p = Math.round(Math.min(1, Math.max(0, Number(part) || 0)) * 1000) / 10;
  return `<div class="debug-jauge${niveau ? ` debug-jauge--${niveau}` : ''}" role="meter" aria-label="${echapper(libelle)}" aria-valuemin="0" `
    + `aria-valuemax="100" aria-valuenow="${p}" aria-valuetext="${echapper(texte ?? formaterPart(p / 100))}"><span class="debug-jauge__plein" style="width: ${p}%"></span></div>`;
}

/** Le niveau du disque : 'alerte' (moins de 10 % ou de 2 Gio libres), 'attention' (moins de 20 %), sinon ''. */
export function niveauDuDisque(disque) {
  if (!disque || !fini(disque.libre)) return '';
  const total = Number(disque.total);
  const part = fini(disque.part_libre) ? Number(disque.part_libre) : total > 0 ? Number(disque.libre) / total : null;
  if (Number(disque.libre) < SEUILS_DISQUE.octetsAlerte || (part !== null && part < SEUILS_DISQUE.partAlerte)) return 'alerte';
  if (part !== null && part < SEUILS_DISQUE.partAttention) return 'attention';
  return '';
}

/** Le disque du dossier de la base : jauge de l'espace utilisé, libre et total, et une alerte écrite s'il est bas. */
export function htmlDuDisque(disque) {
  if (!disque || typeof disque !== 'object' || !fini(disque.total)) return '<p class="debug-vide">Espace disque inconnu.</p>';
  const total = Number(disque.total);
  const libre = Number(disque.libre) || 0;
  const utilise = fini(disque.utilise) ? Number(disque.utilise) : total - libre;
  const partLibre = fini(disque.part_libre) ? Number(disque.part_libre) : total > 0 ? libre / total : 0;
  const niveau = niveauDuDisque(disque);
  const texte = `${formaterOctets(utilise)} utilisés sur ${formaterOctets(total)}, ${formaterOctets(libre)} libres (${formaterPart(partLibre)})`;
  const alerte = niveau === 'alerte'
    ? `<p class="debug-alerte debug-alerte--erreur" role="alert">Disque presque plein : ${formaterOctets(libre)} libres (${formaterPart(partLibre)}).</p>`
    : niveau === 'attention' ? `<p class="debug-alerte debug-alerte--avertissement">Moins de 20 % du disque libre.</p>` : '';
  return `${alerte}${jauge({ part: total > 0 ? utilise / total : 0, libelle: 'Disque utilisé', texte, niveau })}`
    + `<p class="debug-jauge__texte">${texte}</p>${disque.dossier ? `<p class="debug-petit">Dossier : <code>${echapper(disque.dossier)}</code></p>` : ''}`;
}

/** Les alertes du service (disque, base des métriques, archives, boucle, mémoire…) : une liste, ou rien. */
export function htmlDesAlertes(alertes) {
  const liste = (Array.isArray(alertes) ? alertes : []).filter((a) => a && a.message);
  if (!liste.length) return '';
  return `<ul class="debug-alertes" role="list">${liste.map((a) => {
    const niveau = ['erreur', 'avertissement', 'info'].includes(a.niveau) ? a.niveau : 'avertissement';
    return `<li class="debug-alerte debug-alerte--${niveau}"><strong>${niveau === 'erreur' ? 'Alerte' : niveau === 'info' ? 'Information' : 'Attention'} :</strong> ${echapper(a.message)}</li>`;
  }).join('')}</ul>`;
}

/** Le processus du service : version, Node, mémoire, CPU, boucle d'événements, charge. */
export function htmlDuProcessus(p, maintenant = new Date()) {
  if (!p || typeof p !== 'object') return '<p class="debug-vide">Processus inconnu.</p>';
  const charge = Array.isArray(p.charge) ? p.charge.map((v) => nombre(v, 2)).join(' / ') : '—';
  const depuis = p.depuis ? `${instantLisible(p.depuis, maintenant)} (${formaterDureeLongue(p.duree_s)})` : formaterDureeLongue(p.duree_s);
  const lignes = [
    ['Version', `${echapper(p.version ?? '—')}${p.code ? ` · code <code>${echapper(p.code)}</code>` : ''}`],
    ['Node', echapper(p.node ?? '—')],
    ['PID', nombre(p.pid)],
    ['Démarré', echapper(depuis)],
    ['Mémoire (RSS)', formaterOctets(p.rss)],
    ['Tas utilisé / total', `${formaterOctets(p.tas_utilise)} / ${formaterOctets(p.tas_total)}`],
    ['Mémoire externe', formaterOctets(p.externe)],
    ['CPU utilisateur / système', `${nombreCourt(p.cpu_utilisateur_pct, 1)}${INSECABLE}% / ${nombreCourt(p.cpu_systeme_pct, 1)}${INSECABLE}%`],
    ['Boucle d’événements p50 / p99 / max', `${formaterDuree(p.boucle_p50_ms)} / ${formaterDuree(p.boucle_p99_ms)} / ${formaterDuree(p.boucle_max_ms)}`],
    ['Charge moyenne (1, 5, 15 min)', charge],
  ];
  return `<dl class="debug-definitions">${lignes.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join('')}</dl>`;
}

/** Les fichiers suivis (base vivante, archives, lots, métriques) et leur taille, les plus gros d'abord, avec le total. */
export function htmlDesFichiers(fichiers) {
  const liste = (Array.isArray(fichiers) ? fichiers : []).filter((f) => f && typeof f === 'object')
    .sort((a, b) => (Number(b.octets) || 0) - (Number(a.octets) || 0));
  if (!liste.length) return '';
  const total = liste.reduce((s, f) => s + (Number(f.octets) || 0), 0);
  return `${liste.map((f) => `<tr><th scope="row">${echapper(f.nom)}</th><td><code>${echapper(f.chemin ?? '')}</code></td>`
    + `<td class="debug-nombre">${formaterOctets(f.octets)}</td></tr>`).join('')}<tr class="debug-total"><th scope="row">Total</th><td></td><td class="debug-nombre">${formaterOctets(total)}</td></tr>`;
}

/** Le libellé d'une clé de rétention (« agregats_horaires_jours » → « Agregats horaires »). */
const libelleDeCle = (cle) => {
  const t = String(cle).replace(/_(jours|j)$/, '').replace(/_/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

/** Le volume des métriques : taille, croissance par jour, projection à un an au rythme actuel, rétention, requêtes brutes. */
export function htmlDuVolume(volume) {
  if (!volume || typeof volume !== 'object') return '<p class="debug-vide">Volume inconnu.</p>';
  const croissance = fini(volume.croissance_octets_par_jour) ? Number(volume.croissance_octets_par_jour) : null;
  const taille = fini(volume.metriques_octets) ? Number(volume.metriques_octets) : null;
  const retention = volume.retention && typeof volume.retention === 'object' ? Object.entries(volume.retention) : [];
  const lignes = [
    ['Base des métriques', formaterOctets(taille)],
    ['Croissance', croissance === null ? '—' : `${formaterOctets(croissance)} par jour`],
    ['Dans un an au rythme actuel', taille === null || croissance === null ? '—' : `≈ ${formaterOctets(taille + croissance * 365)}`],
    ['Requêtes brutes persistées', volume.brutes ? 'oui (30 jours)' : 'non (mémoire du site de dev seulement)'],
    ...retention.map(([k, v]) => [`Rétention : ${echapper(libelleDeCle(k))}`, fini(v) ? `${nombre(v)}${INSECABLE}jours` : echapper(v)]),
  ];
  return `<dl class="debug-definitions">${lignes.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join('')}</dl>`;
}

/** Le détail d'un évènement en texte : tel quel, ou « clé : valeur » séparés par « · » pour un objet. */
export function texteDuDetail(detail) {
  if (detail === null || detail === undefined) return '';
  if (typeof detail !== 'object') return String(detail);
  return Object.entries(detail).map(([k, v]) => `${k} : ${v && typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
}

/** Les évènements du service (démarrage, reconstruction, rejeu, lot, mise à jour, GitHub, erreurs 5xx…), le plus récent d'abord, `max` au plus. */
export function htmlDesEvenements(evenements, maintenant = new Date(), max = 200) {
  return (Array.isArray(evenements) ? evenements : []).filter((e) => e && typeof e === 'object')
    .sort((a, b) => (Date.parse(b.instant) || 0) - (Date.parse(a.instant) || 0)).slice(0, max)
    .map((e) => `<tr${attributLenteur(e.duree_ms, { lent: 1000, tresLent: 10000 })}><td class="debug-heure"><time datetime="${echapper(e.instant)}">${echapper(instantLisible(e.instant, maintenant))}</time></td>`
      + `<td>${echapper(e.type)}</td><td class="debug-nombre">${formaterDuree(e.duree_ms)}</td><td class="debug-detail">${echapper(texteDuDetail(e.detail))}</td></tr>`).join('');
}

/** La phrase du titre « Système » : instance, disque libre, alertes. */
export function resumeDuSysteme(systeme) {
  if (!systeme || typeof systeme !== 'object') return '';
  const instance = INSTANCES.find((i) => i.cle === systeme.instance)?.libelle ?? systeme.instance ?? '';
  const d = systeme.disque;
  const morceaux = [instance];
  if (d && fini(d.libre)) morceaux.push(`disque libre ${formaterOctets(d.libre)}${fini(d.part_libre) ? ` (${formaterPart(d.part_libre)})` : ''}`);
  const alertes = (Array.isArray(systeme.alertes) ? systeme.alertes : []).filter((a) => a && a.message).length;
  if (alertes) morceaux.push(`${alertes} alerte${alertes > 1 ? 's' : ''}`);
  return morceaux.filter(Boolean).join(' · ');
}
