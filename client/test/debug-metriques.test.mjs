// Performances et système de la page Debug (demande du propriétaire du 2026-10-15 : « isoler les informations de temps de réponse […] voir quels
// sont les appels les plus lents en moyenne ») : fonctions pures de lib/debug-metriques.mjs — adresses, mise en forme des durées, octets et parts,
// tri des routes et mise en évidence des plus lentes, courbes SVG, jauge du disque, rendus des tableaux (texte échappé, jamais d'infobulle native).
//   node --test test/debug-metriques.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COLONNES_DES_ROUTES, INSTANCES, PERIODES, PERIODE_PAR_DEFAUT, PLUS_LENTES, RELEVE_METRIQUES_MS, SEUILS_DE_LENTEUR_MS, SEUILS_LCP_MS, TRIS,
  TRI_PAR_DEFAUT, adresseDeLExport, adresseDesMetriques, adresseDesRequetes, adresseDuSysteme, ariaSort, cleDeRoute, courbe, courbeDeLaSerie,
  courbeDuSysteme, etiquetteDeTemps, formaterDuree, formaterDureeLongue, formaterOctets, formaterPart, htmlDesAlertes, htmlDesChiffres,
  htmlDesEvenements, htmlDesFichiers, htmlDesNavigateurs, htmlDesOrigines, htmlDesPages, htmlDesPhases, htmlDesRequetes, htmlDesRoutes,
  htmlDuDisque, htmlDuProcessus, htmlDuVolume, instantLisible, jauge, lenteur, mesureDePage, niveauDuDisque, nombre, optionsDesRoutes, plafondRond,
  plusLentes, resumeDesMetriques, resumeDuSysteme, seuilSaisi, sensParDefaut, texteDuDetail, trierRoutes, valeurDeTri,
  SEGMENT_FIN, TYPES_DU_DISQUE, formaterOctetsDecimaux, htmlDeLEspaceDisque, pourcentDuDisque, segmentsDuDisque,
  LIBELLES_DE_RETENTION, REQUETES_AUTRE_INSTANCE, dureeDuQuantile, noteDeFenetreHoraire, requetesDeLInstance,
} from '../src/lib/debug-metriques.mjs';
import { readFileSync } from 'node:fs';
import { comptesAvecLHote, REPARTITION, REPARTITION_HOTE, repartitionDu, RETENTION } from '../serveur/metriques.mjs';

const F = '\u202f'; // espace fine insécable (milliers)
const I = '\u00a0'; // espace insécable (avant l'unité)

/** Une route comme celles du service (STATS de serveur/metriques.mjs). */
const route = (methode, gabarit, stats = {}) => ({
  route: gabarit, methode, n: 10, erreurs_4xx: 0, erreurs_5xx: 0, part_304: 0, moyenne_ms: 10, mediane_ms: 9, p95_ms: 20, p99_ms: 30, min_ms: 1,
  max_ms: 40, ecart_type_ms: 5, total_ms: 100, octets_entree: 0, octets_sortie: 2048, sql_requetes_moyen: 1, sql_ms_moyen: 0.5, ...stats,
});

test('constantes : relève toutes les 30 s, deux instances, les périodes et les tris du contrat', () => {
  assert.equal(RELEVE_METRIQUES_MS, 30000, 'pas plus souvent que toutes les 30 s');
  assert.deepEqual(INSTANCES, [{ cle: 'dev', libelle: 'Site de dev' }, { cle: 'prod', libelle: 'Production' }]);
  assert.deepEqual(PERIODES.map((p) => p.cle), ['1h', '24h', '7j', '30j', '365j', 'tout']);
  assert.equal(PERIODE_PAR_DEFAUT, '24h');
  assert.equal(TRI_PAR_DEFAUT, 'moyenne', 'les plus lents en moyenne d’abord');
  assert.deepEqual(COLONNES_DES_ROUTES.filter((c) => c.serveur).map((c) => c.cle).sort(),
    ['erreurs', 'max', 'mediane', 'moyenne', 'n', 'p95', 'p99', 'sql', 'total'], 'les clés que le service accepte (?tri=)');
  assert.deepEqual(new Set(TRIS.map((t) => t.cle)), new Set(COLONNES_DES_ROUTES.map((c) => c.cle)));
});

test('adresses : métriques, requêtes récentes, système, export — paramètres encodés, vides omis, tri inconnu du service non transmis', () => {
  assert.equal(adresseDesMetriques('/api/'), '/api/debug/metriques/?instance=dev&periode=24h&tri=moyenne');
  assert.equal(adresseDesMetriques('/MaverickCenter/api/', { instance: 'prod', periode: '7j', tri: 'p95' }),
    '/MaverickCenter/api/debug/metriques/?instance=prod&periode=7j&tri=p95');
  assert.equal(adresseDesMetriques('/api/', { tri: 'route' }), '/api/debug/metriques/?instance=dev&periode=24h', 'la page trie elle-même');
  assert.equal(adresseDesRequetes('/api/'), '/api/debug/metriques/requetes/?limite=100');
  assert.equal(adresseDesRequetes('/api/', { limite: 20, route: '/api/v1/metiers/{cle}/', minMs: 150 }),
    '/api/debug/metriques/requetes/?limite=20&route_exacte=%2Fapi%2Fv1%2Fmetiers%2F%7Bcle%7D%2F&min_ms=150', 'le gabarit choisi, cherché exactement');
  assert.equal(adresseDesRequetes('/api/', { minMs: 0 }), '/api/debug/metriques/requetes/?limite=100');
  assert.equal(adresseDuSysteme('/api/', 'prod'), '/api/debug/systeme/?instance=prod');
  assert.equal(adresseDeLExport('/api/', { instance: 'prod', periode: '30j', format: 'csv' }), '/api/debug/metriques/export/?instance=prod&periode=30j&format=csv');
  assert.equal(seuilSaisi(' 12,5 '), 12.5);
  assert.equal(seuilSaisi('abc'), 0);
  assert.equal(seuilSaisi('-3'), 0);
  assert.equal(seuilSaisi(''), 0);
});

test('mise en forme : nombres à la française, durées, octets (unités binaires), parts, instants', () => {
  assert.equal(nombre(1234567.891, 2), `1${F}234${F}567,89`);
  assert.equal(nombre(-0.001, 2), '0,00', 'pas de « -0 »');
  assert.equal(nombre(-1500), `-1${F}500`);
  for (const v of [null, undefined, '', 'x', NaN, Infinity]) assert.equal(nombre(v), '—', String(v));
  assert.equal(formaterDuree(0), `0${I}ms`);
  assert.equal(formaterDuree(20), `20${I}ms`, 'sans zéro inutile');
  assert.equal(formaterDuree(4.2), `4,2${I}ms`);
  assert.equal(formaterDuree(3000), `3${I}s`);
  assert.equal(formaterDuree(0.4249), `0,42${I}ms`, 'précision 0,01 ms');
  assert.equal(formaterDuree(4.256), `4,26${I}ms`);
  assert.equal(formaterDuree(42.46), `42,5${I}ms`);
  assert.equal(formaterDuree(425.4), `425${I}ms`);
  assert.equal(formaterDuree(4250), `4,25${I}s`);
  assert.equal(formaterDuree(42500), `42,5${I}s`);
  assert.equal(formaterDuree(125000), `2${I}min 05${I}s`);
  assert.equal(formaterDuree(3900000), `1${I}h 05${I}min`);
  assert.equal(formaterDuree(null), '—');
  assert.equal(formaterDureeLongue(42), `42${I}s`);
  assert.equal(formaterDureeLongue(3 * 86400 + 4 * 3600 + 59), `3${I}j 4${I}h`);
  assert.equal(formaterOctets(512), `512${I}o`);
  assert.equal(formaterOctets(1536), `1,5${I}Kio`);
  assert.equal(formaterOctets(12.34 * 1024 ** 2), `12,3${I}Mio`);
  assert.equal(formaterOctets(205 * 1024 ** 3), `205${I}Gio`);
  assert.equal(formaterOctets(3 * 1024 ** 5), `3${F}072${I}Tio`, 'au-delà du Tio : en Tio');
  assert.equal(formaterPart(0.125), `13${I}%`);
  assert.equal(formaterOctets(10 * 1024 ** 3), `10${I}Gio`, 'sans zéro inutile');
  assert.equal(formaterPart(0.005), `0,5${I}%`);
  assert.equal(formaterPart(0), `0${I}%`);
  assert.equal(formaterPart(undefined), '—');
  const maintenant = new Date(2026, 9, 15, 18, 0, 0);
  assert.equal(instantLisible(new Date(2026, 9, 15, 14, 5, 9).toISOString(), maintenant), '14:05:09');
  assert.equal(instantLisible(new Date(2026, 9, 14, 23, 59, 1).toISOString(), maintenant), '14/10 23:59:01');
  assert.equal(instantLisible('pas une date', maintenant), 'pas une date');
  const t = new Date(2026, 9, 15, 14, 5).getTime();
  assert.equal(etiquetteDeTemps(t, 300000), '14:05', 'pas de 5 min');
  assert.equal(etiquetteDeTemps(t, 3600000), `15/10 14${I}h`, 'pas horaire');
  assert.equal(etiquetteDeTemps(t, 86400000), '15/10', 'pas journalier');
});

test('routes : tri par chaque colonne (texte alphabétique, nombres du plus grand au plus petit), valeurs manquantes à la fin, égalités départagées', () => {
  const routes = [
    route('GET', '/api/v1/metiers/', { n: 50, moyenne_ms: 12, erreurs_4xx: 3 }),
    route('PATCH', '/api/v1/metiers/{cle}/', { n: 4, moyenne_ms: 640, p95_ms: 900, erreurs_5xx: 1 }),
    route('GET', '/api/personnages/{id}/', { n: 9, moyenne_ms: 150, total_ms: undefined, sql_ms_moyen: 3 }),
    route('POST', '/api/edition/', { n: 2, moyenne_ms: null, erreurs_4xx: 9 }),
    route('GET', '/api/etat/', { n: 30, moyenne_ms: 150 }),
  ];
  const cles = (tri) => trierRoutes(routes, tri).map(cleDeRoute);
  assert.deepEqual(cles({ cle: 'moyenne' }), ['PATCH /api/v1/metiers/{cle}/', 'GET /api/etat/', 'GET /api/personnages/{id}/', 'GET /api/v1/metiers/', 'POST /api/edition/'],
    'du plus lent au plus rapide ; à égalité le plus appelé ; sans moyenne à la fin');
  assert.deepEqual(cles({ cle: 'moyenne', sens: 'asc' }).at(-1), 'POST /api/edition/', 'sans valeur : toujours à la fin');
  assert.deepEqual(cles({ cle: 'route' }), ['POST /api/edition/', 'GET /api/etat/', 'GET /api/personnages/{id}/', 'GET /api/v1/metiers/', 'PATCH /api/v1/metiers/{cle}/']);
  assert.deepEqual(cles({ cle: 'erreurs' }).slice(0, 3), ['PATCH /api/v1/metiers/{cle}/', 'POST /api/edition/', 'GET /api/v1/metiers/'], 'les 5xx d’abord, puis les 4xx');
  assert.equal(valeurDeTri(routes[2], 'total'), 1350, 'temps cumulé absent : moyenne × appels');
  assert.equal(valeurDeTri(routes[0], 'octets'), 2048);
  assert.equal(valeurDeTri(routes[2], 'sql'), 3);
  assert.equal(valeurDeTri({}, 'p95'), null);
  assert.equal(sensParDefaut('route'), 'asc');
  assert.equal(sensParDefaut('p99'), 'desc');
  assert.equal(ariaSort({ cle: 'p95', sens: 'desc' }, 'p95'), 'descending');
  assert.equal(ariaSort({ cle: 'p95', sens: 'asc' }, 'p95'), 'ascending');
  assert.equal(ariaSort({ cle: 'p95', sens: 'asc' }, 'max'), 'none');
  assert.deepEqual(trierRoutes(null), []);
  // les plus lentes en moyenne (au moins un appel), mises en évidence
  assert.equal(PLUS_LENTES, 3);
  assert.deepEqual([...plusLentes(routes)], ['PATCH /api/v1/metiers/{cle}/', 'GET /api/etat/', 'GET /api/personnages/{id}/']);
  assert.deepEqual([...plusLentes([route('GET', '/a/', { n: 0, moyenne_ms: 900 })])], [], 'jamais appelée : pas « lente »');
  assert.deepEqual(SEUILS_DE_LENTEUR_MS, { lent: 100, tresLent: 500 });
  assert.equal(lenteur(99.99), '');
  assert.equal(lenteur(100), 'lent');
  assert.equal(lenteur(500), 'tres-lent');
  assert.equal(lenteur(null), '');
  assert.equal(lenteur(3000, SEUILS_LCP_MS), 'lent');
});

test('routes : rendu du tableau — gabarit échappé, pastille de méthode, durées marquées, marque lisible des plus lentes, erreurs 4xx / 5xx', () => {
  const routes = trierRoutes([
    route('PATCH', '/api/v1/metiers/{cle}/', { n: 4, moyenne_ms: 640, erreurs_4xx: 2, erreurs_5xx: 1, part_304: 0.25, octets_sortie: 1536, octets_entree: 300 }),
    route('GET', '/api/<script>/', { n: 1, moyenne_ms: 3.5 }),
  ]);
  const html = htmlDesRoutes(routes, { lentes: plusLentes(routes, 1) });
  const lignes = html.split('</tr>').filter(Boolean);
  assert.equal(lignes.length, 2);
  assert.match(lignes[0], /^<tr class="debug-route" data-lenteur="tres-lent" data-plus-lente><th scope="row" class="debug-route__route"><code>\/api\/v1\/metiers\/\{cle\}\/<\/code> <span class="debug-marque">parmi les plus lentes<\/span><\/th>/);
  assert.match(lignes[0], /<span class="debug-methode debug-methode--patch">PATCH<\/span>/);
  assert.match(lignes[0], /<td class="debug-nombre" data-lenteur="tres-lent">640\u00a0ms<\/td>/);
  assert.match(lignes[0], /<span class="debug-err4">2<\/span> \/ <span class="debug-err5">1<\/span>/);
  assert.match(lignes[0], /<td class="debug-nombre">25\u00a0%<\/td>/);
  assert.match(lignes[0], /<td class="debug-nombre">1,5\u00a0Kio \/ 300\u00a0o<\/td>/, 'envoyés / reçus');
  assert.match(lignes[0], /<td class="debug-nombre">1\u00a0req\. · 0,5\u00a0ms<\/td>$/, 'SQL par appel : requêtes et temps');
  assert.match(lignes[1], /^<tr class="debug-route"><th scope="row" class="debug-route__route"><code>\/api\/&lt;script&gt;\/<\/code><\/th>/, 'échappé, ni lente ni marquée');
  assert.equal(COLONNES_DES_ROUTES.length, (lignes[0].match(/<t[hd]\b/g) ?? []).length, 'une case par colonne');
  assert.equal(htmlDesRoutes([]), '');
  assert.equal(htmlDesRoutes(undefined), '');
  assert.doesNotMatch(html, /\stitle=/, 'jamais d’infobulle native');
  // chiffres d'ensemble et phrase du titre
  const global = route('', '', { n: 1234, moyenne_ms: 120, erreurs_5xx: 2 });
  const chiffres = htmlDesChiffres(global);
  assert.match(chiffres, /<div><dt>Appels<\/dt><dd>1\u202f234<\/dd><\/div>/);
  assert.match(chiffres, /<div data-lenteur="lent"><dt>Moyenne<\/dt><dd>120\u00a0ms<\/dd><\/div>/);
  assert.equal(htmlDesChiffres(null), '');
  assert.equal(resumeDesMetriques({ instance: 'prod', periode: '7j', global }), `Production · 7 derniers jours · 1${F}234 appels · moyenne 120${I}ms · p95 20${I}ms · 2 erreurs 5xx`);
  assert.equal(resumeDesMetriques({ instance: 'dev', periode: '1h', global: { n: 0 } }), 'Site de dev · Dernière heure · 0 appel');
  assert.equal(optionsDesRoutes([route('GET', '/b/'), route('POST', '/b/'), route('GET', '/a/')], '/c/'),
    '<option value="">Toutes</option><option value="/a/">/a/</option><option value="/b/">/b/</option><option value="/c/" selected>/c/</option>', 'sans doublon, la choisie gardée');
});

test('pages vues, navigateurs, origines : mesures des pages (deux écritures lues), parts, tri par nombre, texte échappé', () => {
  assert.deepEqual(mesureDePage({ ttfb_ms: { moyenne: 120, p95: 300 } }, 'ttfb'), { moyenne: 120, p95: 300, auDela: false });
  assert.deepEqual(mesureDePage({ lcp_ms: { moyenne_ms: 1800, p95_ms: 3100 } }, 'lcp'), { moyenne: 1800, p95: 3100, auDela: false });
  assert.deepEqual(mesureDePage({ dom_ms: 400, dom_p95_ms: 900 }, 'dom'), { moyenne: 400, p95: 900, auDela: false });
  assert.deepEqual(mesureDePage({}, 'charge'), { moyenne: null, p95: null, auDela: false });
  assert.deepEqual(mesureDePage({ charge_ms: 9000, charge_p95_ms: 60000, au_dela: ['charge_p95_ms'] }, 'charge'), { moyenne: 9000, p95: 60000, auDela: true });
  assert.match(htmlDesPages([{ page: '/lente/', n: 1, charge_ms: 9000, charge_p95_ms: 60000, au_dela: ['charge_p95_ms'] }]), /9\u00a0s \/ >\u00a01\u00a0min 00\u00a0s/, 'p95 au-delà : « > »');
  const pages = htmlDesPages([
    { page: '/races/', n: 3, ttfb_ms: { moyenne: 50, p95: 80 }, lcp_ms: { moyenne: 1200, p95: 1500 } },
    { page: '/bestiaire/<x>', n: 12, lcp_ms: { moyenne: 3000, p95: 4500 } },
  ]);
  assert.ok(pages.indexOf('/bestiaire/') < pages.indexOf('/races/'), 'les plus vues d’abord');
  assert.match(pages, /<code>\/bestiaire\/&lt;x&gt;<\/code>/);
  assert.match(pages, /<td class="debug-nombre" data-lenteur="tres-lent">3\u00a0s \/ 4,5\u00a0s<\/td>/, 'LCP p95 au-delà de 4 s');
  assert.match(pages, /<td class="debug-nombre">50\u00a0ms \/ 80\u00a0ms<\/td>/);
  assert.equal((pages.match(/<tr>/g) ?? []).length, 2);
  const navigateurs = htmlDesNavigateurs([{ famille: 'Firefox', appareil: 'ordinateur', n: 1 }, { famille: 'Chrome', appareil: 'telephone', n: 3 }]);
  assert.match(navigateurs, /^<tr><th scope="row">Chrome<\/th><td>Téléphone<\/td><td class="debug-nombre">3<\/td><td class="debug-part-cellule"><span class="debug-part"><span class="debug-part__barre" style="width: 75%"><\/span><\/span> 75\u00a0%<\/td><\/tr>/);
  assert.match(navigateurs, /Firefox<\/th><td>Ordinateur<\/td>.*25\u00a0%/);
  assert.equal(htmlDesNavigateurs(null), '');
  const origines = htmlDesOrigines([{ page: '/fiche/', route: '/api/personnages/{id}/', n: 4 }, { page: '', route: '/api/etat/', n: 9 }, ...Array.from({ length: 200 }, (_, i) => ({ page: `/p${i}/`, route: '/r/', n: 1 }))]);
  assert.match(origines, /^<tr><th scope="row"><code>\(aucune\)<\/code><\/th><td><code>\/api\/etat\/<\/code><\/td><td class="debug-nombre">9<\/td><\/tr>/, 'sans page d’origine : « (aucune) »');
  assert.equal((origines.match(/<tr>/g) ?? []).length, 100, '100 au plus');
});

test('requêtes récentes : la plus récente d’abord, une ligne repliable, phases en barre et en texte, SQL le plus lent, statut coloré', () => {
  const maintenant = new Date(2026, 9, 15, 18, 0, 0);
  const html = htmlDesRequetes([
    { instant: new Date(2026, 9, 15, 14, 0, 0).toISOString(), methode: 'GET', route: '/api/etat/', adresse: '/api/etat/', statut: 200, duree_ms: 2 },
    {
      instant: new Date(2026, 9, 15, 14, 5, 9).toISOString(), methode: 'PATCH', route: '/api/v1/metiers/{cle}/', adresse: '/api/v1/metiers/forgeron/',
      statut: 500, duree_ms: 640, phases: { corps_ms: 40, traitement_ms: 560, envoi_ms: 40 }, octets_entree: 300, octets_sortie: 1536,
      sql: { n: 12, ms: 420.5, plus_lente: { sql: 'SELECT * FROM "metier" WHERE id = ?', ms: 300 } }, page: '/metiers/', navigateur: 'Firefox',
      appareil: 'telephone', simultanees: 3,
    },
  ], maintenant);
  const items = html.split('</details></li>').filter(Boolean);
  assert.equal(items.length, 2);
  assert.match(items[0], /^<li><details class="debug-requete" data-lenteur="tres-lent"><summary><time datetime="[^"]+">14:05:09<\/time><span class="debug-methode debug-methode--patch">PATCH<\/span><code class="debug-requete__route">\/api\/v1\/metiers\/\{cle\}\/<\/code><span class="debug-statut debug-statut--erreur">500<\/span><span class="debug-requete__duree">640\u00a0ms<\/span><\/summary>/);
  assert.match(items[0], /<div class="debug-phases" role="img" aria-label="Phases : Lecture du corps 40\u00a0ms, Traitement 560\u00a0ms, Envoi 40\u00a0ms">/);
  assert.match(items[0], /<span class="debug-phases__segment debug-phases__segment--1" style="width: 87.5%"><\/span>/, 'la largeur est la part de la durée');
  assert.match(items[0], /<dt>Requête SQL la plus lente<\/dt><dd><code>SELECT \* FROM &quot;metier&quot; WHERE id = \?<\/code> · 300\u00a0ms<\/dd>/);
  assert.match(items[0], /<dt>Adresse<\/dt><dd><code>\/api\/v1\/metiers\/forgeron\/<\/code><\/dd>/);
  assert.match(items[0], /<dt>Navigateur<\/dt><dd>Firefox · Téléphone<\/dd>/);
  assert.match(items[0], /<dt>Requêtes simultanées<\/dt><dd>3<\/dd>/);
  assert.match(items[1], /<span class="debug-statut debug-statut--succes">200<\/span>/);
  assert.doesNotMatch(items[1], /Requête SQL la plus lente/, 'sans SQL : pas de ligne');
  assert.match(items[1], /<dt>Page d’origine<\/dt><dd>—<\/dd>/);
  assert.equal(htmlDesRequetes(undefined), '');
  // phases sans durée totale : la somme des phases
  assert.match(htmlDesPhases({ corps_ms: 1, traitement_ms: 3 }), /debug-phases__segment--0" style="width: 25%".*debug-phases__segment--1" style="width: 75%"/);
  assert.match(htmlDesPhases(null, 0), /<div class="debug-phases" role="img" aria-label="Phases : Lecture du corps —, Traitement —, Envoi —"><\/div>/);
});

test('courbe SVG en ligne : barres et ligne sur deux échelles, trous coupés, axes, aria-label — jamais de <title> (infobulle native) ; aucune donnée : une phrase', () => {
  assert.equal(plafondRond(0), 1);
  assert.equal(plafondRond(7), 10);
  assert.equal(plafondRond(120), 200);
  assert.equal(plafondRond(0.03), 0.05);
  assert.equal(plafondRond(5000), 5000);
  const debut = Date.UTC(2026, 9, 15, 12, 0, 0);
  const point = (i, n, p95) => ({ debut: new Date(debut + i * 300000).toISOString(), n, moyenne_ms: 10, p95_ms: p95, erreurs: 0 });
  // 5 min par point ; le 3e pas manque (trou) ; un pas sans appel (n = 0, p95 absent)
  const serie = [point(0, 10, 50), point(1, 40, 120), point(3, 20, 80), point(4, 0, null), point(5, 5, 30)];
  const html = courbeDeLaSerie(serie);
  const svg = html.match(/<svg[^>]*>[\s\S]*<\/svg>/)[0];
  assert.match(svg, /^<svg class="debug-courbe__svg" viewBox="0 0 640 180" role="img" aria-label="Appels et temps de réponse p95 sur la période\. Appels : jusqu’à 40 ; Temps de réponse p95 : jusqu’à 120\u00a0ms\. Du \d\d:\d\d au \d\d:\d\d, 5 points\." focusable="false">/);
  assert.doesNotMatch(html, /<title|\stitle=/, 'jamais d’infobulle native');
  assert.equal((svg.match(/<rect /g) ?? []).length, 4, 'une barre par pas qui a des appels');
  assert.equal((svg.match(/<polyline /g) ?? []).length, 1, 'la ligne est coupée au trou et à la valeur absente : un trait (points 0 et 1)…');
  assert.equal((svg.match(/<circle /g) ?? []).length, 2, '… et deux points isolés (3 et 5), chacun un rond');
  assert.match(svg, /<text class="debug-courbe__serie debug-courbe__serie--0 debug-courbe__graduation" x="52" y="16" text-anchor="end">50<\/text>/, 'échelle gauche : plafond rond des appels');
  assert.match(svg, /<text class="debug-courbe__serie debug-courbe__serie--1 debug-courbe__graduation" x="588" y="16" text-anchor="start">200\u00a0ms<\/text>/, 'échelle droite : celle du p95');
  // des coordonnées avec un point (jamais la virgule française) et dans la boîte
  for (const [, x, y] of svg.matchAll(/<rect x="([^"]+)" y="([^"]+)"/g)) {
    assert.ok(/^-?\d+(\.\d)?$/.test(x) && /^-?\d+(\.\d)?$/.test(y), `${x} ${y}`);
    assert.ok(Number(x) >= 58 && Number(x) <= 582 && Number(y) >= 12 && Number(y) <= 158, `${x} ${y}`);
  }
  assert.match(html, /<ul class="debug-legende"><li><span class="debug-legende__marque debug-legende__marque--barres debug-courbe__serie--0" aria-hidden="true"><\/span>Appels<\/li><li><span class="debug-legende__marque debug-legende__marque--ligne debug-courbe__serie--1" aria-hidden="true"><\/span>Temps de réponse p95<\/li><\/ul>/);
  assert.equal(courbeDeLaSerie([]), '<p class="debug-vide">Aucune donnée sur la période.</p>');
  assert.equal(courbeDeLaSerie(undefined), '<p class="debug-vide">Aucune donnée sur la période.</p>');
  // un seul point, sans temps lisible : le rang en abscisse, rien ne casse
  const seul = courbe([{ v: 3, debut: 'x' }], { series: [{ cle: 'v', libelle: 'V', forme: 'ligne' }], etiquette: 'Essai' });
  assert.match(seul, /aria-label="Essai\. V : jusqu’à 3\."/);
  assert.equal((seul.match(/<circle /g) ?? []).length, 1);
  assert.doesNotMatch(seul, /NaN|Infinity|undefined/);
  // les échantillons du système : deux lignes (mémoire, boucle)
  const systeme = courbeDuSysteme([0, 1, 2].map((i) => ({ instant: new Date(debut + i * 60000).toISOString(), rss: 80e6 + i * 1e6, boucle_p99_ms: 12 + i })));
  assert.equal((systeme.match(/<polyline /g) ?? []).length, 2);
  assert.match(systeme, /Mémoire \(RSS\) : jusqu’à 78,2\u00a0Mio ; Boucle d’événements p99 : jusqu’à 14\u00a0ms/);
  assert.doesNotMatch(systeme, /NaN|<title/);
});

test('système : jauge (role="meter"), disque bas signalé par écrit, processus, fichiers, volume et projection, évènements, alertes, résumé', () => {
  const html = jauge({ part: 0.4567, libelle: 'Disque <utilisé>', texte: 'beaucoup' });
  assert.equal(html, '<div class="debug-jauge" role="meter" aria-label="Disque &lt;utilisé&gt;" aria-valuemin="0" aria-valuemax="100" aria-valuenow="45.7" aria-valuetext="beaucoup"><span class="debug-jauge__plein" style="width: 45.7%"></span></div>');
  assert.match(jauge({ part: 7, libelle: 'x' }), /aria-valuenow="100"/, 'bornée');
  assert.match(jauge({ part: -1, libelle: 'x', niveau: 'alerte' }), /^<div class="debug-jauge debug-jauge--alerte".*aria-valuenow="0"/);
  const Gio = 1024 ** 3;
  assert.equal(niveauDuDisque({ libre: 50 * Gio, total: 100 * Gio, part_libre: 0.5 }), '');
  assert.equal(niveauDuDisque({ libre: 15 * Gio, total: 100 * Gio, part_libre: 0.15 }), 'attention');
  assert.equal(niveauDuDisque({ libre: 9 * Gio, total: 100 * Gio, part_libre: 0.09 }), 'alerte', 'moins de 10 %');
  assert.equal(niveauDuDisque({ libre: 1.5 * Gio, total: 10 * Gio }), 'alerte', 'moins de 2 Gio (part calculée : 15 %)');
  assert.equal(niveauDuDisque(null), '');
  const disque = htmlDuDisque({ dossier: '/srv/maverick/db', libre: 1.5 * Gio, total: 10 * Gio, utilise: 8.5 * Gio, part_libre: 0.15 });
  assert.match(disque, /^<p class="debug-alerte debug-alerte--erreur" role="alert">Disque presque plein : 1,5\u00a0Gio libres \(15\u00a0%\)\.<\/p><div class="debug-jauge debug-jauge--alerte" role="meter" aria-label="Disque non disponible \(pris ou réservé\)"[^>]*aria-valuenow="85"/);
  assert.match(disque, /<p class="debug-jauge__texte">8,5\u00a0Gio utilisés sur 10\u00a0Gio, 1,5\u00a0Gio libres \(15\u00a0%\)<\/p>/, 'la valeur écrite, pas seulement la jauge');
  assert.match(disque, /<code>\/srv\/maverick\/db<\/code>/);
  assert.equal(htmlDuDisque(undefined), '<p class="debug-vide">Espace disque inconnu.</p>');
  const processus = htmlDuProcessus({
    version: '0.3.1', code: 'abc123', node: 'v22.22.0', pid: 42, depuis: new Date(2026, 9, 15, 14, 0, 0).toISOString(), duree_s: 7260, rss: 80 * 1024 ** 2,
    tas_utilise: 30 * 1024 ** 2, tas_total: 50 * 1024 ** 2, externe: 2 * 1024 ** 2, cpu_utilisateur_pct: 3.25, cpu_systeme_pct: 0.5,
    boucle_p50_ms: 10.2, boucle_p99_ms: 25, boucle_max_ms: 140, charge: [0.12, 0.3, 0.25],
  }, new Date(2026, 9, 15, 18, 0, 0));
  assert.match(processus, /<dt>Version<\/dt><dd>0\.3\.1 · code <code>abc123<\/code><\/dd>/);
  assert.match(processus, /<dt>Démarré<\/dt><dd>14:00:00 \(2\u00a0h 01\u00a0min\)<\/dd>/);
  assert.match(processus, /<dt>CPU utilisateur \/ système<\/dt><dd>3,3\u00a0% \/ 0,5\u00a0%<\/dd>/);
  assert.match(processus, /<dt>Boucle d’événements p50 \/ p99 \/ max<\/dt><dd>10,2\u00a0ms \/ 25\u00a0ms \/ 140\u00a0ms<\/dd>/);
  assert.match(processus, /<dt>Charge moyenne \(1, 5, 15 min\)<\/dt><dd>0,12 \/ 0,30 \/ 0,25<\/dd>/);
  const fichiers = htmlDesFichiers([{ nom: 'Base vivante', chemin: 'db/vivante.db', octets: 30 * 1024 ** 2 }, { nom: 'Métriques <dev>', chemin: 'metriques/dev.db', octets: 90 * 1024 ** 2 }]);
  assert.ok(fichiers.indexOf('Métriques') < fichiers.indexOf('Base vivante'), 'les plus gros d’abord');
  assert.match(fichiers, /Métriques &lt;dev&gt;/);
  assert.match(fichiers, /<tr class="debug-total"><th scope="row">Total<\/th><td><\/td><td class="debug-nombre">120\u00a0Mio<\/td><\/tr>$/);
  assert.equal(htmlDesFichiers([]), '');
  // la taille dans un an et à rétention pleine sont celles du service (table par table, à leur rétention) : jamais taille + croissance × 365,
  // qui compterait ce que la rétention purge (agrégats de 5 minutes, échantillons par minute) — ici 10 Mio + 365 × 300 Kio ≈ 117 Mio
  const volume = htmlDuVolume({
    metriques_octets: 10 * 1024 ** 2, croissance_octets_par_jour: 50 * 1024, croissance_source: 'estimee', debit_ecriture_octets_par_jour: 300 * 1024,
    projection_un_an_octets: 25 * 1024 ** 2, taille_a_terme_octets: 26 * 1024 ** 2, retention: { agregats_heure: 400, echantillons_minute: 14, inconnue_x: 3 }, brutes: false, pages: true,
  });
  assert.match(volume, /<dt>Croissance en régime<\/dt><dd>50\u00a0Kio par jour \(estimée\)<\/dd>/);
  assert.match(volume, /<dt>Écrit par jour \(avant purge\)<\/dt><dd>300\u00a0Kio par jour<\/dd>/);
  assert.match(volume, /<dt>Dans un an \(rétention appliquée\)<\/dt><dd>≈ 25\u00a0Mio<\/dd>/);
  assert.match(volume, /<dt>À rétention pleine \(400 jours\)<\/dt><dd>≈ 26\u00a0Mio<\/dd>/);
  assert.doesNotMatch(volume, /117|au rythme actuel/, 'jamais la projection linéaire');
  assert.match(volume, /<dt>Rétention : Agrégats par heure<\/dt><dd>400\u00a0jours<\/dd>/, 'libellés accentués');
  assert.match(volume, /<dt>Rétention : Échantillons système par minute<\/dt><dd>14\u00a0jours<\/dd>/);
  assert.match(volume, /<dt>Rétention : inconnue_x<\/dt><dd>3\u00a0jours<\/dd>/, 'une clé inconnue : la clé elle-même');
  assert.match(volume, /<dt>Requêtes brutes persistées<\/dt><dd>non \(mémoire du site de dev seulement\)<\/dd>/);
  assert.match(volume, /<dt>Mesure des pages \(balise\)<\/dt><dd>ouverte<\/dd>/);
  assert.match(htmlDuVolume({ brutes: true }), /oui \(30 jours\)/);
  assert.match(htmlDuVolume({ croissance_octets_par_jour: 1024, croissance_source: 'mesuree', croissance_mesuree_jours: 9.5 }), /1\u00a0Kio par jour \(mesurée sur 9,5\u00a0jours\)/);
  // les réglages d'une autre instance qu'elle n'a pas dits (null) : « — », jamais « non »
  const inconnu = htmlDuVolume({ brutes: null, pages: null });
  assert.match(inconnu, /<dt>Requêtes brutes persistées<\/dt><dd>—<\/dd>/);
  assert.match(inconnu, /<dt>Mesure des pages \(balise\)<\/dt><dd>—<\/dd>/);
  assert.equal(texteDuDetail({ lots: 3, conflits: 0, sous: { a: 1 } }), 'lots : 3 · conflits : 0 · sous : {"a":1}');
  assert.equal(texteDuDetail('texte'), 'texte');
  assert.equal(texteDuDetail(null), '');
  const evenements = htmlDesEvenements([
    { instant: new Date(2026, 9, 15, 14, 0, 0).toISOString(), type: 'demarrage', duree_ms: 850, detail: { version: '0.3.1' } },
    { instant: new Date(2026, 9, 15, 15, 0, 0).toISOString(), type: 'reconstruction', duree_ms: 12500, detail: '<b>' },
  ], new Date(2026, 9, 15, 18, 0, 0));
  assert.ok(evenements.indexOf('reconstruction') < evenements.indexOf('demarrage'), 'le plus récent d’abord');
  assert.match(evenements, /^<tr data-lenteur="tres-lent"><td class="debug-heure"><time datetime="[^"]+">15:00:00<\/time><\/td><td>reconstruction<\/td><td class="debug-nombre">12,5\u00a0s<\/td><td class="debug-detail">&lt;b&gt;<\/td><\/tr>/);
  const alertes = htmlDesAlertes([{ niveau: 'erreur', message: 'Disque < 10 %' }, { niveau: 'bizarre', message: 'Archives qui grossissent' }, { niveau: 'info' }]);
  assert.match(alertes, /^<ul class="debug-alertes" role="list"><li class="debug-alerte debug-alerte--erreur"><strong>Alerte :<\/strong> Disque &lt; 10 %<\/li><li class="debug-alerte debug-alerte--avertissement"><strong>Attention :<\/strong> Archives qui grossissent<\/li><\/ul>$/);
  assert.equal(htmlDesAlertes([]), '');
  assert.equal(resumeDuSysteme({ instance: 'prod', disque: { libre: 1.5 * Gio, part_libre: 0.15 }, alertes: [{ message: 'a' }, { message: 'b' }] }),
    `Production · disque libre 1,5${I}Gio (15${I}%) · 2 alertes`);
  for (const morceau of [disque, processus, fichiers, volume, evenements, alertes]) assert.doesNotMatch(morceau, /\stitle=|<title/);
});

// ---- Espace disque du serveur (demande du propriétaire du 2026-10-15 : « Tout en bas je veux aussi la métrique de la place occupée sur le serveur
// sur la place totale sous forme de jauge, colorée en fonction du type de données (DB, Code, Import images, etc.) ») ----------------------------

const Go = 1e9;
const somme = (liste) => liste.reduce((a, b) => a + b, 0);
/** Arrondi à 1e-9 près (les largeurs sont des centièmes de pour cent). */
const proche = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, `${message ?? ''} ${a} ≠ ${b}`);

test('espace disque : tailles en unités décimales (Go, Mo : celles des hébergeurs), parts écrites sans « 0 % » ni « 100 % » trompeurs', () => {
  assert.equal(formaterOctetsDecimaux(512), `512${I}o`);
  assert.equal(formaterOctetsDecimaux(1500), `1,5${I}ko`);
  assert.equal(formaterOctetsDecimaux(30e6), `30${I}Mo`);
  assert.equal(formaterOctetsDecimaux(23.4 * Go), `23,4${I}Go`);
  assert.equal(formaterOctetsDecimaux(80 * Go), `80${I}Go`, 'sans zéro inutile');
  assert.equal(formaterOctetsDecimaux(150 * Go), `150${I}Go`);
  assert.equal(formaterOctetsDecimaux(999.96e6), `1${I}Go`, 'jamais « 1 000 Mo »');
  assert.equal(formaterOctetsDecimaux(1.2e12), `1,2${I}To`);
  assert.equal(formaterOctetsDecimaux(null), '—');
  assert.equal(pourcentDuDisque(0.2925), `29${I}%`);
  assert.equal(pourcentDuDisque(0.015), `1,5${I}%`);
  assert.equal(pourcentDuDisque(0), `0${I}%`);
  assert.equal(pourcentDuDisque(1), `100${I}%`);
  assert.equal(pourcentDuDisque(1e-8), `<${I}0,1${I}%`, 'un segment minuscule n’est jamais « 0 % »');
  assert.equal(pourcentDuDisque(0.9996), `>${I}99,9${I}%`, 'un disque presque plein n’est jamais « 100 % »');
  assert.equal(pourcentDuDisque(0.955), `95,5${I}%`, 'une décimale au-delà de 90 %');
  assert.equal(pourcentDuDisque(undefined), '—');
});

test('espace disque : les types de la jauge sont ceux du service (serveur/metriques.mjs#REPARTITION, ceux de l’hôte avant « Système et autres »), dans son ordre, chacun avec sa couleur claire et sombre', () => {
  const service = [...REPARTITION.slice(0, -3), ...REPARTITION_HOTE, ...REPARTITION.slice(-3)];
  assert.deepEqual(TYPES_DU_DISQUE.map((t) => t.cle), service.map((r) => r.cle), 'mêmes clés, même ordre');
  assert.deepEqual(TYPES_DU_DISQUE.map((t) => t.libelle), service.map((r) => r.libelle), 'mêmes libellés');
  assert.equal(TYPES_DU_DISQUE.at(-1).cle, 'libre', 'le libre en dernier');
  for (const t of TYPES_DU_DISQUE) assert.ok(t.aide && t.aide.endsWith('.'), `${t.cle} : ce que le type compte`);
  const css = readFileSync(new URL('../src/styles/debug/debug.css', import.meta.url), 'utf8');
  for (const { cle } of TYPES_DU_DISQUE) {
    assert.match(css, new RegExp(`\\.debug-espace__segment--${cle}\\b[^{]*\\{[^}]*--seg: var\\(--dbg-disque-${cle}\\)`), `${cle} : sa couleur`);
    assert.equal((css.match(new RegExp(`--dbg-disque-${cle}: #[0-9a-f]{6}`, 'g')) ?? []).length, 3, `${cle} : clair, sombre (préférence du système) et sombre (thème choisi)`);
  }
  const couleurs = TYPES_DU_DISQUE.map(({ cle }) => css.match(new RegExp(`--dbg-disque-${cle}: (#[0-9a-f]{6})`))[1]);
  assert.equal(new Set(couleurs).size, couleurs.length, 'une couleur par type');
  assert.match(css, /\.debug-espace__segment--fin \{[^}]*min-width: 6px/, 'un segment très fin reste visible');
});

test('espace disque : segments proportionnels (largeurs au centième, somme exactement 100), dans l’ordre, le libre en dernier, d’après la VRAIE répartition du service', () => {
  const total = 80 * Go;
  const libre = 56.6 * Go;
  const { repartition } = repartitionDu({ total, libre, comptes: { base: 1.2 * Go, images: 0.3 * Go, 'site-code': 0.03 * Go, metriques: 0.012 * Go } });
  const j = segmentsDuDisque({ total, libre, repartition });
  assert.equal(j.total, total);
  assert.equal(j.libre, libre);
  assert.equal(j.occupe, total - libre);
  proche(j.part_occupee, 0.2925);
  assert.equal(j.repartie, true);
  assert.deepEqual(j.segments.map((x) => x.cle), REPARTITION.map((r) => r.cle), 'tous les types, même vides (la légende les dit)');
  assert.equal(somme(j.segments.map((x) => x.octets)), total, 'la somme fait la place totale');
  proche(somme(j.segments.map((x) => x.largeur)), 100, 'les largeurs font 100');
  for (const x of j.segments) {
    proche(x.part, x.octets / total, x.cle);
    assert.ok(Math.abs(x.largeur - x.part * 100) <= 0.01 + 1e-9, `${x.cle} : largeur ${x.largeur} pour ${x.part * 100}`);
    assert.equal(Math.round(x.largeur * 100), x.largeur * 100, `${x.cle} : au centième`);
  }
  const base = j.segments.find((x) => x.cle === 'base');
  assert.deepEqual([base.libelle, base.octets, base.largeur, base.fin], ['Base de données', 1.2 * Go, 1.5, false]);
  const metriques = j.segments.find((x) => x.cle === 'metriques');
  assert.equal(metriques.fin, true, '12 Mo sur 80 Go : très fin');
  assert.equal(j.segments.find((x) => x.cle === 'mises-a-jour').fin, false, 'un type vide n’est pas « fin » : il n’est pas dans la barre');
});

test('espace disque : arrondis par les plus forts restes, segments minuscules, total nul ou inconnu, sans répartition, somme qui ne fait pas le total', () => {
  // trois tiers : 33,34 + 33,33 + 33,33 (jamais 99,99)
  const tiers = segmentsDuDisque({ total: 3, libre: 1, repartition: [{ cle: 'base', octets: 1 }, { cle: 'autres', octets: 1 }, { cle: 'libre', octets: 1 }] });
  assert.deepEqual(tiers.segments.map((x) => x.largeur).sort(), [33.33, 33.33, 33.34]);
  proche(somme(tiers.segments.map((x) => x.largeur)), 100);
  // minuscule : 1 ko sur 80 Go — part exacte, largeur 0 (la CSS lui garde 6 px), « fin », jamais « 0 % »
  const minuscule = segmentsDuDisque({ total: 80 * Go, libre: 40 * Go, repartition: [{ cle: 'images', octets: 1000 }, { cle: 'autres', octets: 40 * Go - 1000 }, { cle: 'libre', octets: 40 * Go }] });
  const images = minuscule.segments.find((x) => x.cle === 'images');
  assert.equal(images.fin, true);
  assert.equal(images.largeur, 0);
  proche(images.part, 1000 / (80 * Go));
  assert.ok(images.part < SEGMENT_FIN);
  proche(somme(minuscule.segments.map((x) => x.largeur)), 100);
  // total nul, négatif ou inconnu : pas de jauge
  for (const d of [null, undefined, {}, { total: 0, libre: 0 }, { total: -5 }, { total: 'x' }, { total: 0.2 }]) {
    assert.equal(segmentsDuDisque(d), null, JSON.stringify(d));
    assert.equal(htmlDeLEspaceDisque(d), '<p class="debug-vide">Espace disque inconnu.</p>');
  }
  // sans répartition (pas encore relevée) : l'occupé d'un seul tenant, puis le libre
  const brut = segmentsDuDisque({ total: 100 * Go, libre: 75 * Go, repartition: null });
  assert.equal(brut.repartie, false);
  assert.deepEqual(brut.segments.map((x) => [x.cle, x.octets, x.largeur]), [['occupe', 25 * Go, 25], ['libre', 75 * Go, 75]]);
  // une somme plus petite que le total : le manque va à « Système et autres » ; plus grande : elle devient le total
  const manque = segmentsDuDisque({ total: 100, libre: 50, repartition: [{ cle: 'base', octets: 20 }, { cle: 'libre', octets: 50 }] });
  assert.deepEqual(manque.segments.map((x) => [x.cle, x.octets]), [['base', 20], ['autres', 30], ['libre', 50]]);
  const exces = segmentsDuDisque({ total: 100, libre: 50, repartition: [{ cle: 'base', octets: 100 }, { cle: 'libre', octets: 50 }] });
  assert.equal(exces.total, 150);
  proche(somme(exces.segments.map((x) => x.largeur)), 100);
  // un libre absent de la répartition est pris au disque ; une clé inconnue ou dangereuse reste (« inconnu »), avant « Système et autres »
  const bizarre = segmentsDuDisque({ total: 100, libre: 10, repartition: [{ cle: 'autres', octets: 30 }, { cle: '"><script>', libelle: 'Étrange <b>', octets: 40 }, { cle: 'cache', octets: 20 }] });
  assert.deepEqual(bizarre.segments.map((x) => x.cle), ['inconnu', 'cache', 'autres', 'libre']);
  assert.equal(bizarre.segments.at(-1).octets, 10);
  const html = htmlDeLEspaceDisque({ total: 100, libre: 10, repartition: [{ cle: '"><script>', libelle: 'Étrange <b>', octets: 90 }, { cle: 'libre', octets: 10 }] });
  assert.doesNotMatch(html, /<script|<b>/);
  assert.match(html, /Étrange &lt;b&gt;/);
});

test('espace disque : le rendu — titre « occupés sur », jauge role="img" qui dit tout, infobulle habillée par segment (jamais title), légende complète, libre en clair, alerte, relevé', () => {
  const total = 80 * Go;
  const libre = 56.6 * Go;
  const maintenant = new Date(2026, 9, 15, 18, 0, 0);
  const releve = new Date(2026, 9, 15, 17, 50, 0).toISOString();
  const { repartition } = repartitionDu({ total, libre, comptes: { base: 1.2 * Go, images: 1000, 'site-code': 0.03 * Go } });
  const html = htmlDeLEspaceDisque({ total, libre, dossier: '/srv/maverick/db', part_libre: libre / total, repartition, repartition_le: releve, repartition_partielle: false }, { instance: 'prod', maintenant });
  assert.match(html, new RegExp(`^<p class="debug-espace__titre"><strong>23,4${I}Go occupés sur 80${I}Go \\(29${I}%\\)</strong> · 56,6${I}Go libres</p>`), 'la place occupée sur la place totale');
  assert.match(html, /<p class="debug-petit">Production · disque du dossier <code>\/srv\/maverick\/db<\/code> · répartition relevée à <time datetime="[^"]+">17:50:00<\/time><\/p>/);
  const barre = html.match(/<div class="debug-espace__jauge" role="img" aria-label="([^"]+)">(.*?)<\/div>/);
  assert.ok(barre, 'une jauge');
  assert.match(barre[1], new RegExp(`^Espace disque : 23,4${I}Go occupés sur 80${I}Go \\(29${I}%\\)\\. Base de données : 1,2${I}Go \\(1,5${I}% du disque\\) ; Images importées : 1${I}ko \\(&lt;${I}0,1${I}% du disque\\) ;`));
  const segments = [...barre[2].matchAll(/<span class="debug-espace__segment debug-espace__segment--([a-z-]+)( debug-espace__segment--fin)?" data-cle="\1" style="flex-basis: ([\d.]+)%" data-infobulle="([^"]+)"><\/span>/g)];
  assert.deepEqual(segments.map((m) => m[1]), ['base', 'images', 'site-code', 'autres', 'libre'], 'seuls les types non vides, dans l’ordre, le libre au bout');
  assert.equal(barre[2], segments.map((m) => m[0]).join(''), 'rien d’autre dans la barre');
  assert.deepEqual(segments.filter((m) => m[2]).map((m) => m[1]), ['images', 'site-code'], 'les segments très fins (largeur minimale à l’écran)');
  proche(somme(segments.map((m) => Number(m[3]))), 100);
  assert.match(segments[0][4], new RegExp(`^Base de données : 1,2${I}Go \\(1,5${I}% du disque\\) — La base vivante`), 'infobulle : nom, taille, part, ce qu’il compte');
  // la légende : chaque type (vides compris, atténués), sa marque de couleur, son nom, sa taille et sa part — la couleur n'est jamais seule
  const legende = [...html.matchAll(/<li class="debug-espace__type" data-cle="([a-z-]+)"( data-vide)?><span class="debug-espace__marque debug-espace__segment--\1" aria-hidden="true"><\/span><span class="debug-espace__nom">([^<]+)<\/span><span class="debug-espace__valeur">([^<]+)<\/span>/g)];
  assert.deepEqual(legende.map((m) => m[1]), REPARTITION.map((r) => r.cle));
  assert.deepEqual(legende.filter((m) => m[2]).map((m) => m[1]), ['mises-a-jour', 'metriques', 'site-donnees', 'site-images', 'site-autres', 'reserve']);
  assert.deepEqual(legende.find((m) => m[1] === 'libre').slice(3), ['Libre', `56,6${I}Go · 71${I}%`]);
  assert.deepEqual(legende.find((m) => m[1] === 'images').slice(3), ['Images importées', `1${I}ko · &lt;${I}0,1${I}%`], 'le minuscule reste lisible dans la légende');
  assert.doesNotMatch(html, /\stitle=|<title|role="alert"/, 'jamais d’infobulle native ; l’alerte est annoncée par le bloc Système');
  assert.match(html, /unités décimales \(1 Go = 1 000 000 000 octets/);
  // disque bas : l'alerte écrite et le titre marqué ; relevé partiel et répartition absente : dits en clair
  const bas = htmlDeLEspaceDisque({ total: 100 * Go, libre: 1.5 * Go, repartition: null, repartition_partielle: null });
  assert.match(bas, new RegExp(`^<p class="debug-alerte debug-alerte--erreur">Disque presque plein : 1,5${I}Go libres \\(1,5${I}%\\)\\.</p><p class="debug-espace__titre" data-niveau="alerte">`));
  assert.match(bas, /data-cle="occupe"/);
  assert.match(bas, /La répartition par type n’a pas encore été relevée/);
  const partiel = htmlDeLEspaceDisque({ total: 100, libre: 50, repartition: [{ cle: 'base', octets: 50 }, { cle: 'libre', octets: 50 }], repartition_partielle: true });
  assert.match(partiel, /Relevé partiel : le parcours des fichiers s’est arrêté à sa borne/);
  assert.doesNotMatch(htmlDeLEspaceDisque({ total: 100, libre: 50, repartition: [{ cle: 'libre', octets: 50 }] }), /Relevé partiel/);
});

test('espace disque : avec le relevé de l’hôte (VPS), Docker, journaux et installations ont leur segment avant « Système et autres » et la ligne de contexte le date ; écarté, une phrase le dit', () => {
  const total = 80 * Go;
  const libre = 50 * Go;
  const hote = { utilise: true, comptes: { docker: 2 * Go, journaux: 0.3 * Go, installations: 0 } };
  const { repartition } = repartitionDu({ total, libre, comptes: comptesAvecLHote({ base: 1.2 * Go, 'site-code': 0.1 * Go }, hote) });
  const j = segmentsDuDisque({ total, libre, repartition });
  assert.deepEqual(j.segments.map((x) => x.cle), TYPES_DU_DISQUE.map((t) => t.cle), 'les 13 types, dans l’ordre');
  assert.equal(somme(j.segments.map((x) => x.octets)), total);
  const maintenant = new Date(2026, 9, 15, 18, 0, 0);
  const html = htmlDeLEspaceDisque({ total, libre, repartition, repartition_le: new Date(2026, 9, 15, 17, 55).toISOString(),
    repartition_hote: { releve_le: new Date(2026, 9, 15, 17, 45).toISOString(), utilise: true, raison: null } }, { instance: 'prod', maintenant });
  const barre = html.match(/<div class="debug-espace__jauge"[^>]*>(.*?)<\/div>/)[1];
  assert.deepEqual([...barre.matchAll(/data-cle="([a-z-]+)"/g)].map((m) => m[1]), ['base', 'site-code', 'docker', 'journaux', 'autres', 'libre']);
  assert.match(html, /relevé de l’hôte à <time datetime="[^"]+">17:45:00<\/time>/);
  assert.match(html, /data-cle="installations" data-vide/, 'un type de l’hôte vide reste dans la légende, atténué');
  const ecarte = htmlDeLEspaceDisque({ total, libre, repartition: repartitionDu({ total, libre, comptes: { base: Go } }).repartition,
    repartition_hote: { releve_le: null, utilise: false, raison: 'relevé de l’hôte périmé <vieux>' } }, { instance: 'prod', maintenant });
  assert.match(ecarte, /Relevé de l’hôte écarté \(relevé de l’hôte périmé &lt;vieux&gt;\)/);
  assert.doesNotMatch(ecarte, /data-cle="docker"/, 'sans relevé pris en compte, pas de type de l’hôte');
});

test('espace disque : la réserve de root à part — « occupés » = la place prise de df (Used), la réserve dite dans le titre, sa marque hachurée', () => {
  // le disque de l'essai réel du 2026-10-15 (df -B1 : 270 553 174 016 au total, 13 969 199 104 pris, 27 854 659 584 disponibles)
  const total = 270_553_174_016;
  const libre = 27_854_659_584;
  const reserve = total - 13_969_199_104 - libre;
  const { repartition } = repartitionDu({ total, libre, reserve, comptes: { base: 22_800_000, 'site-code': 100_000_000 } });
  const j = segmentsDuDisque({ total, libre, reserve, repartition });
  assert.equal(j.occupe, 13_969_199_104, 'la place prise de df');
  assert.equal(j.reserve, reserve);
  proche(j.part_occupee, 13_969_199_104 / total);
  assert.equal(j.segments.at(-2).cle, 'reserve');
  const html = htmlDeLEspaceDisque({ total, libre, reserve, repartition });
  assert.match(html, new RegExp(`<strong>14${I}Go occupés sur 271${I}Go \\(5,2${I}%\\)</strong> · 27,9${I}Go libres · 229${I}Go réservés au système</p>`));
  // sans répartition : l'occupé d'un seul tenant, la réserve, le libre
  const brut = segmentsDuDisque({ total: 100, libre: 30, reserve: 5, repartition: null });
  assert.deepEqual(brut.segments.map((x) => [x.cle, x.octets]), [['occupe', 65], ['reserve', 5], ['libre', 30]]);
  const css = readFileSync(new URL('../src/styles/debug/debug.css', import.meta.url), 'utf8');
  assert.match(css, /\.debug-espace__segment--reserve \{[^}]*repeating-linear-gradient\(45deg/, 'hachurée dans l’autre sens que le libre');
});

// ---- Correctifs de la relecture du 2026-10-15 -------------------------------------------------------------------------------------------------

test('quantiles au-delà de la dernière classe : écrits « > 5 s » (le service ne les donne que comme borne basse), dans les chiffres, les routes et le résumé', () => {
  const stats = { n: 100, moyenne_ms: 7080, mediane_ms: 6000, p95_ms: 6000, p99_ms: 6000, au_dela: ['p95_ms', 'p99_ms'] };
  assert.equal(dureeDuQuantile(stats, 'mediane_ms'), `6${I}s`);
  assert.equal(dureeDuQuantile(stats, 'p95_ms'), `>${I}6${I}s`);
  assert.equal(dureeDuQuantile({ p95_ms: null, au_dela: ['p95_ms'] }, 'p95_ms'), '—');
  assert.match(htmlDesChiffres(stats), new RegExp(`<dt>p99</dt><dd>>${I}6${I}s</dd>`));
  assert.match(htmlDesRoutes([route('GET', '/api/x/', stats)]), new RegExp(`>>${I}6${I}s</td>`));
  assert.match(resumeDesMetriques({ instance: 'dev', periode: '1h', global: stats }), new RegExp(`p95 >${I}6${I}s`));
});

test('global sans les relèves automatiques : la page dit combien en sont exclues, et le résumé « hors relèves »', () => {
  const html = htmlDesChiffres({ n: 70, moyenne_ms: 111 }, { n: 2280, routes: ['GET /api/debug/journal/'] });
  assert.match(html, /<dt>Appels<\/dt><dd>70<\/dd><\/div><div><dt>Relèves automatiques \(exclues\)<\/dt><dd>2 280<\/dd>/);
  assert.doesNotMatch(htmlDesChiffres({ n: 3 }, { n: 0 }), /Relèves/);
  assert.match(resumeDesMetriques({ instance: 'dev', periode: '1h', global: { n: 70 }, releves: { n: 2280 } }), /70 appels \(hors relèves\)/);
});

test('période « 1h » : la fenêtre (horaire) des pages vues, navigateurs et origines est dite quand elle dépasse celle des routes', () => {
  const maintenant = new Date(2026, 9, 15, 10, 54, 0);
  const depuis = new Date(2026, 9, 15, 9, 55, 0).toISOString();
  const horaire = new Date(2026, 9, 15, 9, 0, 0).toISOString();
  assert.equal(noteDeFenetreHoraire({ depuis, depuis_horaire: horaire }, maintenant),
    'Pages vues, navigateurs et origines sont comptés par heure : depuis 09:00:00, soit plus que la période des routes (depuis 09:55:00).');
  assert.equal(noteDeFenetreHoraire({ depuis: horaire, depuis_horaire: horaire }, maintenant), '', 'même fenêtre : rien');
  assert.equal(noteDeFenetreHoraire({}, maintenant), '');
});

test('requêtes une à une : seulement pour l’instance du serveur qui répond (le site de dev) ; « Production » choisie, une phrase à la place', () => {
  assert.equal(requetesDeLInstance('dev'), true);
  assert.equal(requetesDeLInstance('prod'), false, 'jamais la mémoire du site de dev sous l’étiquette « Production »');
  assert.equal(requetesDeLInstance('prod', 'prod'), true);
  assert.match(REQUETES_AUTRE_INSTANCE, /site de dev/);
  const script = readFileSync(new URL('../src/scripts/debug.mjs', import.meta.url), 'utf8');
  assert.match(script, /if \(!montrerLesRequetes\(\)\) \{\s*dire\(requetesAnnonce, ''\);\s*return;/, 'aucune relève des requêtes pour une autre instance');
  assert.match(script, /if \(requetesDeLInstance\(i, instanceDuServeur\)\) requetesRoute\.innerHTML = optionsDesRoutes\(routes/, 'la liste « Route » : les routes du serveur qui garde les requêtes');
  const page = readFileSync(new URL('../src/pages/debug.astro', import.meta.url), 'utf8');
  assert.match(page, /<p class="debug-petit" data-requetes-autre hidden><\/p>\s*<div data-requetes-contenu>/);
});

test('courbe : le pas est la médiane des écarts — un échantillon pris à l’arrêt du service, 20 s après un autre, ne réduit pas les courbes à des points', () => {
  const debut = Date.UTC(2026, 9, 15, 0, 0, 0);
  const points = Array.from({ length: 120 }, (_, i) => ({ instant: new Date(debut + i * 60_000).toISOString(), rss: 80e6 + i * 1e4, boucle_p99_ms: 10 + (i % 5) }));
  // l'arrêt : un dernier échantillon 20 s après celui de la minute 60, puis le nouveau processus repart sur sa propre phase
  points.push({ instant: new Date(debut + 60 * 60_000 + 20_000).toISOString(), rss: 81e6, boucle_p99_ms: 11 });
  const html = courbeDuSysteme(points);
  assert.equal((html.match(/<circle /g) ?? []).length, 0, 'aucun point isolé');
  assert.equal((html.match(/<polyline /g) ?? []).length, 2, 'une ligne par série, d’un seul tenant');
  // un pas donné par l'appelant prévaut ; un vrai trou (plus d'un pas et demi) coupe toujours la ligne
  const troue = courbe(points.filter((_, i) => i < 50 || i > 70), { series: [{ cle: 'rss', libelle: 'RSS', forme: 'ligne' }], x: (p) => p.instant, pas: 60_000 });
  assert.equal((troue.match(/<polyline /g) ?? []).length, 2, 'le trou de 20 minutes coupe la ligne');
});

test('disque du bloc Système : la jauge remplit la place NON disponible (prise et réserve de root), comme le texte et l’alerte qui parlent du libre', () => {
  const Gio = 1024 ** 3;
  // 80 Go : 68 utilisés, 4 réservés à root, 8 libres (10 %)
  const html = htmlDuDisque({ total: 80 * Gio, utilise: 68 * Gio, reserve: 4 * Gio, libre: 8 * Gio, part_libre: 0.1 });
  assert.match(html, /role="meter" aria-label="Disque non disponible \(pris ou réservé\)"[^>]*aria-valuenow="90"/);
  assert.match(html, /style="width: 90%"/);
  assert.match(html, new RegExp(`68${I}Gio utilisés et 4${I}Gio réservés au système sur 80${I}Gio, 8${I}Gio libres \\(10${I}%\\)`));
  // le bac à sable du constat : 252 Gio, 13,9 utilisés, 213 réservés, 25,1 libres — la jauge n'est plus presque vide à côté de « presque plein »
  const reserve = htmlDuDisque({ total: 252 * Gio, utilise: 13.9 * Gio, reserve: 213 * Gio, libre: 25.1 * Gio, part_libre: 0.0996 });
  assert.match(reserve, /aria-valuenow="90"/);
  assert.match(reserve, /Disque presque plein/);
});

test('rétention : un libellé accentué pour chaque clé du service (jamais « Agregats », « Evenements »…)', () => {
  for (const cle of Object.keys(RETENTION)) {
    assert.ok(LIBELLES_DE_RETENTION[cle], `libellé de ${cle}`);
    assert.match(htmlDuVolume({ retention: { [cle]: RETENTION[cle] } }), new RegExp(`Rétention : ${LIBELLES_DE_RETENTION[cle].replace(/[()]/g, '\\$&')}<`));
  }
  const html = htmlDuVolume({ retention: RETENTION });
  for (const faute of ['Agregats', 'Evenements', 'Echantillons', 'Repartition', 'Requetes brutes', '5min', '10min']) assert.ok(!html.includes(faute), faute);
});
