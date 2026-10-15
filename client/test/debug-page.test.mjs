// Page Debug (pages/debug.astro, site de dev seulement ; demande du propriétaire) : fonctions pures du testeur de l'API (lib/debug-api.mjs) et des
// journaux du serveur (lib/debug-journaux.mjs), contrat avec le journal du service (serveur/journal-du-service.mjs), et la page elle-même : une
// phrase sans script en production, aucun module partagé avec un autre script de page, absente de la version portable.
//   node --test test/debug-page.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import {
  AFFICHAGE_MAX, SANS_TAG, cleDEtag, commandeCurl, corpsDe, corpsLisible, echapper, entetesUtiles, estDuTexte, estEcriture, familleDuStatut,
  groupesDOperations, htmlDeLaReponse, htmlDesGroupes, htmlDuFormulaire, ifMatchDe, operationCorrespond, operationsDe, parametresDe, racineDeLApi,
  requeteDe, resoudre, segmentDeChemin, valeursDuChemin,
} from '../src/lib/debug-api.mjs';
import {
  AFFICHEES_MAX, GARDEES_MAX, NIVEAUX, RELEVE_MS, TRIS_DU_JOURNAL, TRI_DU_JOURNAL_PAR_DEFAUT, adresseDuJournal, categoriesDes, dureeDe, etatVide,
  filtrerEntrees, fusionner, heureDe, htmlDesLignes, planDAffichage, resumeDuJournal,
} from '../src/lib/debug-journaux.mjs';
import { COLONNES_DES_ROUTES, INSTANCES, PERIODES, TRIS } from '../src/lib/debug-metriques.mjs';
import { NIVEAUX as NIVEAUX_DU_SERVICE, creerJournalDuService } from '../serveur/journal-du-service.mjs';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

/** Une description OpenAPI 3.1 comme celle du service (serveur/openapi.mjs) : $ref, tags, exemples, If-Match, opération sans tag. */
const SPEC = {
  openapi: '3.1.0',
  info: { title: 'Maverick Center', version: '1' },
  servers: [{ url: '/api' }],
  tags: [{ name: 'Métiers', description: 'Les métiers du jeu' }, { name: 'Service' }, { name: 'Vide' }],
  components: {
    parameters: {
      cle: { name: 'cle', in: 'path', required: true, description: 'Identifiant figé', schema: { type: 'string', example: 'forgeron' } },
      ifMatch: { name: 'If-Match', in: 'header', required: true, description: 'Version de la ligne lue (ETag)', schema: { type: 'string' } },
    },
    examples: { corps: { value: { description: 'Nouveau texte' } } },
  },
  paths: {
    '/v1/metiers/': {
      get: {
        operationId: 'listerMetiers',
        summary: 'Lister les métiers',
        tags: ['Métiers'],
        parameters: [
          { name: 'q', in: 'query', description: 'Texte cherché', schema: { type: 'string' }, example: 'forge' },
          { name: 'tri', in: 'query', schema: { type: ['string', 'null'], enum: ['nom', '-nom'] } },
          { name: 'limite', in: 'query', required: true, schema: { type: 'integer', default: 50 } },
          // un filtre de colonne comme ceux du service (serveur/openapi.mjs#filtresDe) : répétable, vide permis
          { name: 'famille', in: 'query', description: 'Filtre', style: 'form', explode: true, allowEmptyValue: true, schema: { type: 'array', items: { type: 'string' } } },
        ],
      },
      post: {
        operationId: 'creerMetier',
        summary: 'Créer un métier',
        tags: ['Métiers'],
        requestBody: { required: true, content: { 'application/json': { example: { nom: 'Forgeron <test>' } } } },
      },
    },
    '/v1/metiers/{cle}/': {
      parameters: [{ $ref: '#/components/parameters/cle' }],
      get: { operationId: 'lireMetier', summary: 'Lire un métier', tags: ['Métiers'] },
      patch: {
        operationId: 'modifierMetier',
        summary: 'Modifier un métier',
        tags: ['Métiers'],
        parameters: [{ $ref: '#/components/parameters/ifMatch' }],
        requestBody: { content: { 'application/json': { examples: { a: { $ref: '#/components/examples/corps' } } } } },
      },
      delete: { operationId: 'supprimerMetier', summary: 'Supprimer un métier', tags: ['Métiers'], deprecated: true },
    },
    '/etat/': { get: { operationId: 'etat', summary: 'État du service', tags: ['Service'] } },
    '/x/{a}/{b}/': { head: { summary: 'Sans tag' } },
  },
};

test('operationsDe : chemins puis méthodes dans l’ordre, $ref suivis, paramètres du chemin hérités, If-Match à part, corps et exemples', () => {
  const ops = operationsDe(SPEC);
  assert.deepEqual(ops.map((o) => `${o.methode} ${o.chemin} ${o.id}`), [
    'GET /v1/metiers/ listerMetiers',
    'POST /v1/metiers/ creerMetier',
    'GET /v1/metiers/{cle}/ lireMetier',
    'PATCH /v1/metiers/{cle}/ modifierMetier',
    'DELETE /v1/metiers/{cle}/ supprimerMetier',
    'GET /etat/ etat',
    'HEAD /x/{a}/{b}/ HEAD /x/{a}/{b}/',
  ]);
  const [lister, creer, lireUn, modifier, supprimer, etat, sansTag] = ops;
  const simple = { repetable: false, videPermis: false };
  assert.deepEqual(lister.parametres, [
    { nom: 'q', dans: 'query', requis: false, description: 'Texte cherché', exemple: 'forge', type: 'string', valeurs: null, ...simple },
    { nom: 'tri', dans: 'query', requis: false, description: '', exemple: '', type: 'string', valeurs: ['nom', '-nom'], ...simple },
    { nom: 'limite', dans: 'query', requis: true, description: '', exemple: '50', type: 'integer', valeurs: null, ...simple },
    { nom: 'famille', dans: 'query', requis: false, description: 'Filtre', exemple: '', type: 'string', valeurs: null, repetable: true, videPermis: true },
  ], 'type 3.1 en tableau : le premier qui n’est pas null ; défaut du schéma en exemple ; un filtre de type array : répétable, son type est celui de ses valeurs');
  assert.deepEqual(lireUn.parametres, [{ nom: 'cle', dans: 'path', requis: true, description: 'Identifiant figé', exemple: 'forgeron', type: 'string', valeurs: null, ...simple }]);
  assert.deepEqual(modifier.parametres.map((p) => p.nom), ['cle'], 'If-Match n’est pas un paramètre : il a son champ');
  assert.deepEqual(modifier.ifMatch, { requis: true, description: 'Version de la ligne lue (ETag)' });
  assert.equal(supprimer.ifMatch, null, 'DELETE sans If-Match déclaré : pas de champ (le service ne le lirait pas)');
  assert.equal(lireUn.ifMatch, null);
  assert.equal(creer.ifMatch, null);
  assert.deepEqual(creer.corps, { requis: true, type: 'application/json', description: '', exemple: '{\n  "nom": "Forgeron <test>"\n}' });
  assert.equal(modifier.corps.exemple, '{\n  "description": "Nouveau texte"\n}', 'examples nommés, par $ref');
  assert.equal(lister.corps, null);
  assert.deepEqual([lister, creer, lireUn, modifier, supprimer, etat, sansTag].map((o) => o.ecriture), [false, true, false, true, true, false, false]);
  assert.equal(supprimer.depreciee, true);
  assert.deepEqual(sansTag.parametres.map((p) => [p.nom, p.dans, p.requis]), [['a', 'path', true], ['b', 'path', true]], 'paramètres du gabarit non déclarés');
  assert.deepEqual(sansTag.tags, []);
  // fonctions de base
  assert.deepEqual(resoudre(SPEC, { $ref: '#/components/parameters/cle' }).name, 'cle');
  assert.deepEqual(resoudre(SPEC, { $ref: '#/rien/du/tout' }), {});
  assert.deepEqual(resoudre(SPEC, { $ref: 'https://ailleurs/x.json' }), {}, 'seuls les $ref locaux');
  assert.equal(parametresDe(SPEC, {}, {}, '/a/{b}/')[0].nom, 'b');
  assert.equal(ifMatchDe(SPEC, {}, {}), null, 'non déclaré : pas de champ, quelle que soit la méthode');
  assert.deepEqual(ifMatchDe(SPEC, {}, { parameters: [{ $ref: '#/components/parameters/ifMatch' }] }), { requis: true, description: 'Version de la ligne lue (ETag)' });
  assert.equal(corpsDe(SPEC, { requestBody: { content: { 'application/json': { example: '{"a":1}' } } } }).exemple, '{\n  "a": 1\n}', 'exemple en texte JSON');
  assert.deepEqual(['GET', 'HEAD', 'OPTIONS', 'get'].map(estEcriture), [false, false, false, false]);
  assert.deepEqual(['POST', 'PUT', 'PATCH', 'DELETE'].map(estEcriture), [true, true, true, true]);
  assert.deepEqual(operationsDe({}), []);
});

test('groupes par tag (ordre de spec.tags, puis les autres, sans tag : « Autres ») ; filtre texte sans accents ni majuscules', () => {
  const ops = operationsDe(SPEC);
  const groupes = groupesDOperations(SPEC, ops);
  assert.deepEqual(groupes.map((g) => [g.tag, g.description, g.operations.length]), [
    ['Métiers', 'Les métiers du jeu', 5],
    ['Service', '', 1],
    [SANS_TAG, '', 1],
  ], 'pas de groupe vide (« Vide »)');
  const filtre = (texte) => ops.filter((o) => operationCorrespond(o, texte)).map((o) => o.id);
  assert.equal(filtre('').length, ops.length);
  assert.deepEqual(filtre('METIERS patch'), ['modifierMetier'], 'chaque mot, dans la méthode, le chemin, le résumé, l’id ou les tags');
  assert.deepEqual(filtre('état'), ['etat']);
  assert.deepEqual(filtre('etat'), ['etat'], 'sans accents');
  assert.deepEqual(filtre('supprimermetier'), ['supprimerMetier'], 'par l’operationId');
  assert.deepEqual(filtre('introuvable'), []);
});

test('requeteDe : adresse (base de la page + servers[0].url), paramètres encodés, en-têtes, corps JSON, erreurs avant tout envoi', () => {
  const ops = operationsDe(SPEC);
  const op = (id) => ops.find((o) => o.id === id);
  assert.equal(racineDeLApi('/', SPEC), '/api');
  assert.equal(racineDeLApi('/MaverickCenter/', SPEC), '/MaverickCenter/api', 'déploiement sous un sous-chemin');
  assert.equal(racineDeLApi('/', {}), '/api', 'sans servers : /api');
  assert.equal(racineDeLApi('/MaverickCenter/', { servers: [{ url: 'https://dev.maverick-jdr.com/api/' }] }), 'https://dev.maverick-jdr.com/api', 'adresse absolue telle quelle');

  const liste = requeteDe(op('listerMetiers'), { racine: '/api', valeurs: { query: { q: ' forge ', tri: '', limite: '20' } } });
  assert.deepEqual(liste, { methode: 'GET', url: '/api/v1/metiers/?q=forge&limite=20', entetes: { Accept: 'application/json' }, corps: null, erreurs: [] });
  assert.deepEqual(requeteDe(op('listerMetiers'), { racine: '/api' }).erreurs, ['Paramètre « limite » manquant.']);
  // un filtre répété (une valeur par ligne : l'une OU l'autre) et un filtre vide (colonne vide), comme le service les lit
  const filtres = requeteDe(op('listerMetiers'), { racine: '/api', valeurs: { query: { limite: '5', famille: 'epee\n  \nhache ' } }, vides: ['famille'] });
  assert.equal(filtres.url, '/api/v1/metiers/?limite=5&famille=epee&famille=hache&famille=');
  assert.equal(requeteDe(op('listerMetiers'), { racine: '/api', valeurs: { query: { limite: '5' } }, vides: ['famille'] }).url, '/api/v1/metiers/?limite=5&famille=', 'seulement vide');
  assert.equal(requeteDe(op('listerMetiers'), { racine: '/api', valeurs: { query: { limite: '5', famille: ['a', ' b '] } } }).url, '/api/v1/metiers/?limite=5&famille=a&famille=b', 'un tableau');
  assert.equal(requeteDe(op('listerMetiers'), { racine: '/api', valeurs: { query: { limite: '5', q: '' } }, vides: ['q'] }).url, '/api/v1/metiers/?limite=5', 'vide non permis : rien');
  assert.match(commandeCurl(filtres, 'https://dev.example'), /'https:\/\/dev\.example\/api\/v1\/metiers\/\?limite=5&famille=epee&famille=hache&famille='/, 'la commande curl aussi');

  const modif = requeteDe(op('modifierMetier'), { racine: '/MaverickCenter/api', valeurs: { path: { cle: 'a b,c/d' } }, corps: '{"description":"x"}', ifMatch: ' "v1" ' });
  assert.deepEqual(modif, {
    methode: 'PATCH',
    url: '/MaverickCenter/api/v1/metiers/a%20b,c%2Fd/',
    entetes: { Accept: 'application/json', 'If-Match': '"v1"', 'Content-Type': 'application/json' },
    corps: '{"description":"x"}',
    erreurs: [],
  }, 'la virgule d’une clé composée reste (lib/ressources.mjs#segmentDeCle), le reste est encodé');
  assert.equal(segmentDeChemin('3,2'), '3,2');
  assert.deepEqual(requeteDe(op('modifierMetier'), { racine: '/api', corps: '{ illisible' }).erreurs, [
    'Paramètre de chemin « cle » manquant.',
    'En-tête « If-Match » manquant.',
    requeteDe(op('modifierMetier'), { racine: '/api', corps: '{ illisible' }).erreurs[2],
  ]);
  assert.match(requeteDe(op('modifierMetier'), { racine: '/api', corps: '{ illisible' }).erreurs[2], /^Corps JSON illisible : /);
  assert.deepEqual(requeteDe(op('creerMetier'), { racine: '/api' }).erreurs, ['Corps de la requête manquant.']);
  // une écriture porte toujours Content-Type: application/json (la garde du service l'exige), même sans corps
  const suppr = requeteDe(op('supprimerMetier'), { racine: '/api', valeurs: { path: { cle: 'forgeron' } } });
  assert.deepEqual(suppr, { methode: 'DELETE', url: '/api/v1/metiers/forgeron/', entetes: { Accept: 'application/json', 'Content-Type': 'application/json' }, corps: null, erreurs: [] });
  assert.equal(requeteDe(op('lireMetier'), { racine: '/api', valeurs: { path: { cle: 'x' } }, corps: '{"ignoré":1}' }).corps, null, 'un GET n’a pas de corps');
  assert.equal(cleDEtag('/api/v1/metiers/x/?champs=nom#haut'), '/api/v1/metiers/x/', 'l’ETag est gardé par adresse, sans requête');
});

test('valeursDuChemin : l’adresse rendue par une création (Location) redonne les champs de chemin d’une opération (pour préremplir sa suppression)', () => {
  const ops = operationsDe(SPEC);
  const supprimer = ops.find((o) => o.id === 'supprimerMetier');
  assert.deepEqual(valeursDuChemin(supprimer, '/api/v1/metiers/metiers%2Facrobate/', '/api'), { cle: 'metiers/acrobate' });
  assert.deepEqual(valeursDuChemin(supprimer, '/MaverickCenter/api/v1/metiers/a%20b,2/?x=1', '/MaverickCenter/api'), { cle: 'a b,2' }, 'clé composée, sous-chemin');
  assert.equal(valeursDuChemin(supprimer, '/api/v1/metiers/', '/api'), null, 'la liste n’est pas un élément');
  assert.equal(valeursDuChemin(supprimer, '/api/v1/armes/x/', '/api'), null, 'une autre ressource');
  assert.equal(valeursDuChemin(supprimer, '/api/v1/metiers/x/y/', '/api'), null, 'une sous-ressource');
  assert.equal(valeursDuChemin(supprimer, '/autre/v1/metiers/x/', '/api'), null, 'une autre racine');
  assert.equal(valeursDuChemin(ops.find((o) => o.id === 'etat'), '/api/etat/', '/api'), null, 'pas de paramètre de chemin');
  assert.deepEqual(valeursDuChemin({ chemin: '/v1/evenements/{cle}/descriptions/{cleEnfant}/' }, '/api/v1/evenements/e%231/descriptions/2/'), { cle: 'e#1', cleEnfant: '2' });
  assert.equal(valeursDuChemin(supprimer, '/api/v1/metiers/%E0%A4%A/', '/api'), null, 'mal encodée');
  // aller-retour avec requeteDe : la même adresse
  const valeurs = valeursDuChemin(supprimer, '/api/v1/metiers/metiers%2Facrobate/', '/api');
  assert.equal(requeteDe(supprimer, { racine: '/api', valeurs: { path: valeurs } }).url, '/api/v1/metiers/metiers%2Facrobate/');
});

test('commande curl équivalente : adresse absolue, guillemets du shell, corps sur une ligne', () => {
  const requete = { methode: 'PATCH', url: '/api/v1/metiers/x/', entetes: { Accept: 'application/json', 'If-Match': '"v1"', 'Content-Type': 'application/json' }, corps: '{\n  "nom": "L\'or"\n}' };
  assert.equal(commandeCurl(requete, 'https://dev.maverick-jdr.com'),
    `curl -i -X PATCH 'https://dev.maverick-jdr.com/api/v1/metiers/x/' -H 'Accept: application/json' -H 'If-Match: "v1"' -H 'Content-Type: application/json' --data-raw '{"nom":"L'\\''or"}'`);
  assert.equal(commandeCurl({ methode: 'GET', url: '/api/etat/', entetes: { Accept: 'application/json' } }, 'http://localhost:4321'),
    `curl -i 'http://localhost:4321/api/etat/' -H 'Accept: application/json'`);
  assert.equal(commandeCurl({ methode: 'HEAD', url: '/api/etat/' }), `curl --head '/api/etat/'`, 'sans origine : l’adresse telle quelle');
  assert.equal(commandeCurl({ methode: 'POST', url: '/api/x/', entetes: {}, corps: 'pas du json' }), `curl -i -X POST '/api/x/' --data-raw 'pas du json'`);
});

test('réponse : en-têtes utiles, corps JSON indenté et coupé au-delà d’AFFICHAGE_MAX, familles de statut', () => {
  const entetes = new Headers({ ETag: '"abc"', 'Content-Type': 'application/json; charset=utf-8', Location: '/api/v1/metiers/x/', 'X-Autre': '1' });
  assert.deepEqual(entetesUtiles(entetes), [['ETag', '"abc"'], ['Location', '/api/v1/metiers/x/'], ['Content-Type', 'application/json; charset=utf-8']]);
  assert.deepEqual(entetesUtiles(new Headers({ Allow: 'GET, PATCH' })), [['Allow', 'GET, PATCH']]);
  assert.deepEqual(corpsLisible('{"a":[1]}', 'application/json'), { texte: '{\n  "a": [\n    1\n  ]\n}', json: true, coupe: 0 });
  assert.deepEqual(corpsLisible('[1,2]', ''), { texte: '[\n  1,\n  2\n]', json: true, coupe: 0 }, 'du JSON sans type');
  assert.deepEqual(corpsLisible('{"a":', 'application/json'), { texte: '{"a":', json: false, coupe: 0 }, 'illisible : tel quel');
  const long = corpsLisible('x'.repeat(AFFICHAGE_MAX + 5), 'text/plain');
  assert.equal(long.texte.length, AFFICHAGE_MAX);
  assert.equal(long.coupe, AFFICHAGE_MAX + 5);
  assert.deepEqual(['application/json', 'text/plain; charset=utf-8', 'application/xml', '', undefined].map(estDuTexte), [true, true, true, true, true]);
  assert.deepEqual(['image/webp', 'application/octet-stream'].map(estDuTexte), [false, false]);
  assert.deepEqual([200, 201, 204, 304, 400, 403, 409, 412, 500, 503, 0].map(familleDuStatut),
    ['succes', 'succes', 'succes', 'renvoi', 'refus', 'refus', 'refus', 'refus', 'erreur', 'erreur', 'erreur']);
  const html = htmlDeLaReponse({ entetes: [['ETag', '"v<1>"']], corps: corpsLisible('{"nom":"<b>"}', 'application/json') }, "curl -i '/api/x/'");
  assert.match(html, /<dt>ETag<\/dt><dd><code>&quot;v&lt;1&gt;&quot;<\/code><\/dd>/);
  assert.match(html, /<pre class="debug-reponse__corps" tabindex="0"><code>\{\n {2}&quot;nom&quot;: &quot;&lt;b&gt;&quot;\n\}<\/code><\/pre>/);
  assert.match(html, /<code data-curl>curl -i &#39;\/api\/x\/&#39;<\/code>/);
  assert.match(html, /<button type="button" data-copier>Copier<\/button>/);
  assert.match(htmlDeLaReponse({ octets: { type: 'image/webp', taille: 12 } }, 'curl'), /Contenu non textuel \(image\/webp, 12 octets\)/);
  assert.match(htmlDeLaReponse({}, 'curl'), /Réponse sans corps\./);
  assert.match(htmlDeLaReponse({ erreur: 'Failed <fetch>' }, 'curl'), /<p class="debug-reponse__erreur">Failed &lt;fetch&gt;<\/p>/);
});

test('formulaire d’une opération : un champ étiqueté par paramètre, If-Match, corps prérempli, case de garde des écritures, annonce en aria-live', () => {
  const ops = operationsDe(SPEC);
  const op = (id) => ops.find((o) => o.id === id);
  const ids = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const [i, o] of ops.entries()) {
    const html = htmlDuFormulaire(o, `debug-op${i}`);
    // chaque label vise un champ qui existe, chaque id est unique et commence par le préfixe
    const tous = ids(html);
    assert.equal(new Set(tous).size, tous.length, o.id);
    assert.ok(tous.every((id) => id.startsWith(`debug-op${i}-`)), o.id);
    for (const [, cible] of html.matchAll(/<label for="([^"]+)"/g)) assert.ok(tous.includes(cible), `${o.id} : label sans champ ${cible}`);
    assert.equal(/data-confirmer/.test(html), o.ecriture, `${o.id} : la case de garde, pour une écriture seulement`);
    assert.equal(/data-corps/.test(html), o.ecriture, `${o.id} : un corps pour une écriture seulement`);
    assert.match(html, /<p class="debug-reponse__annonce" data-annonce role="status" aria-live="polite"><\/p>/);
    assert.doesNotMatch(html, /\stitle=/, 'jamais d’infobulle native (Infobulles.astro)');
  }
  const lister = htmlDuFormulaire(op('listerMetiers'), 'p');
  assert.match(lister, /<textarea id="p-p3" data-param-dans="query" data-param-nom="famille" aria-describedby="p-p3-aide" data-param-repetable rows="1" spellcheck="false" autocapitalize="off"><\/textarea>/);
  assert.match(lister, /Une valeur par ligne : l’une OU l’autre\./);
  assert.match(lister, /<label class="debug-champ__vide"><input type="checkbox" data-param-vide="famille"> Envoyer aussi vide/);
  assert.match(lister, /<span class="debug-champ__ou">requête · string \(répétable\)<\/span>/);
  assert.match(lister, /<input type="text" id="p-p0" data-param-dans="query" data-param-nom="q" aria-describedby="p-p0-aide" value="" placeholder="forge"/, 'facultatif : l’exemple en indication');
  assert.match(lister, /<select id="p-p1" data-param-dans="query" data-param-nom="tri"><option value=""><\/option><option>nom<\/option><option>-nom<\/option><\/select>/);
  assert.match(lister, /id="p-p2" data-param-dans="query" data-param-nom="limite" required value="50"/, 'requis : prérempli');
  const modifier = htmlDuFormulaire(op('modifierMetier'), 'm');
  assert.match(modifier, /id="m-p0" data-param-dans="path" data-param-nom="cle" required aria-describedby="m-p0-aide" value="forgeron"/);
  assert.match(modifier, /<input type="text" id="m-if-match" data-if-match /);
  assert.match(modifier, /Rempli avec l’ETag du dernier GET de la même adresse\./);
  assert.match(modifier, /<textarea id="m-corps" data-corps rows="4" spellcheck="false" autocapitalize="off">\{\n {2}&quot;description&quot;: &quot;Nouveau texte&quot;\n\}<\/textarea>/);
  assert.match(htmlDuFormulaire(op('creerMetier'), 'c'), /&quot;nom&quot;: &quot;Forgeron &lt;test&gt;&quot;/, 'exemple échappé');
  assert.match(htmlDuFormulaire(op('supprimerMetier'), 's'), /Opération dépréciée\./);
  // une suppression n'est jamais préremplie avec l'exemple de la description (la clé d'une ligne réelle) : il reste en indication
  const supprimer = htmlDuFormulaire(op('supprimerMetier'), 's');
  assert.match(supprimer, /id="s-p0" data-param-dans="path" data-param-nom="cle" required aria-describedby="s-p0-aide" value="" placeholder="forgeron"/);
  assert.doesNotMatch(supprimer, /data-if-match/, 'If-Match non déclaré : pas de champ');
  assert.deepEqual(requeteDe(op('supprimerMetier'), { racine: '/api' }).erreurs, ['Paramètre de chemin « cle » manquant.'], 'rien ne part sans clé tapée');
  // une écriture sans retour le dit à côté de la case
  const sansRetour = { ...op('creerMetier'), sansRetour: 'Création définitive : <rien> ne la défait.' };
  const html = htmlDuFormulaire(sansRetour, 'd');
  assert.match(html, /<p class="debug-form__sans-retour" id="d-sans-retour">Création définitive : &lt;rien&gt; ne la défait\.<\/p>/);
  assert.match(html, /<input type="checkbox" data-confirmer aria-describedby="d-sans-retour"> Je sais que cette requête modifie la base du site de dev, sans retour possible\./);
  assert.equal(operationsDe({ paths: { '/x/': { post: { 'x-sans-retour': ' Définitif. ' } } } })[0].sansRetour, 'Définitif.');
  assert.equal(op('creerMetier').sansRetour, null);
  assert.match(htmlDuFormulaire(op('creerMetier'), 'c'), /Je sais que cette requête modifie la base du site de dev\./);
});

test('liste des opérations : un details fermé par groupe et par opération, rang dans data-op, pastille par méthode, texte échappé', () => {
  const ops = operationsDe(SPEC);
  const html = htmlDesGroupes(groupesDOperations(SPEC, ops), ops);
  assert.equal((html.match(/<details class="debug-groupe" data-groupe="\d+">/g) ?? []).length, 3);
  assert.doesNotMatch(html, /<details[^>]*\sopen/, 'tout est fermé');
  assert.deepEqual([...html.matchAll(/data-op="(\d+)"/g)].map((m) => Number(m[1])), ops.map((_, i) => i), 'chaque opération, une fois, à son rang');
  assert.match(html, /<span class="debug-methode debug-methode--patch">PATCH<\/span> <code class="debug-op__chemin">\/v1\/metiers\/\{cle\}\/<\/code> <span class="debug-op__resume">Modifier un métier<\/span>/);
  assert.match(html, /<span class="debug-groupe__nom">Métiers<\/span> <span class="debug-groupe__compte" data-groupe-compte>5<\/span> <span class="debug-groupe__description">Les métiers du jeu<\/span>/);
  assert.match(html, /<div class="debug-op__corps" data-op-corps><\/div>/, 'formulaire construit à l’ouverture');
  assert.doesNotMatch(html, /\stitle=/);
  assert.match(htmlDesGroupes([{ tag: '<x>', description: '', operations: [] }], []), /&lt;x&gt;/);
  assert.equal(echapper(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

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
  assert.match(page, /<details class="debug-testeur" data-debug-testeur hidden>\s*<summary>\s*<span class="debug-testeur__titre">Tester l’API<\/span>/, 'le testeur dans un menu déroulant fermé');
  assert.ok(page.indexOf('data-debug-testeur') < page.indexOf('data-debug-journaux'), 'les journaux en dessous');
  // demande du 2026-10-15 : « Performances » puis « Système », deux menus déroulants ouverts, entre le testeur et les journaux
  assert.match(page, /<details class="debug-bloc debug-perfs" data-debug-perfs open hidden>\s*<summary>\s*<h2 class="debug-bloc__titre" id="debug-perfs-titre">Performances<\/h2>/);
  assert.match(page, /<details class="debug-bloc debug-systeme" data-debug-systeme open hidden>\s*<summary>\s*<h2 class="debug-bloc__titre" id="debug-systeme-titre">Système<\/h2>/);
  const ordre = ['data-debug-testeur', 'data-debug-perfs', 'data-debug-systeme', 'data-debug-journaux'].map((m) => page.indexOf(m));
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'testeur, performances, système, journaux');
  for (const m of ['data-perfs-instance', 'data-perfs-periode', 'data-perfs-tri', 'data-perfs-routes', 'data-perfs-serie', 'data-perfs-pages',
    'data-perfs-navigateurs', 'data-perfs-origines', 'data-requetes-liste', 'data-requetes-min', 'data-systeme-processus', 'data-systeme-disque',
    'data-systeme-fichiers', 'data-systeme-volume', 'data-systeme-echantillons', 'data-systeme-evenements', 'data-systeme-alertes']) {
    assert.ok(page.includes(m), m);
  }
  assert.match(page, /<a class="debug-bouton" data-perfs-export="csv" href=\{url\(`api\/debug\/metriques\/export\/\?instance=dev&periode=\$\{PERIODE_PAR_DEFAUT\}&format=csv`\)\} download>Exporter \(CSV\)<\/a>/);
  // les listes de la page viennent du module (instances, périodes, tris), les en-têtes du tableau des routes aussi
  assert.match(page, /INSTANCES\.map\(/);
  assert.match(page, /PERIODES\.map\(/);
  assert.match(page, /TRIS\.map\(/);
  assert.match(page, /COLONNES_DES_ROUTES\.map\(/);
  assert.deepEqual(INSTANCES.map((i) => i.cle), ['dev', 'prod'], 'deux jeux de données séparés (décision du 2026-10-15)');
  assert.deepEqual(PERIODES.map((p) => p.cle), ['1h', '24h', '7j', '30j', '365j', 'tout']);
  assert.deepEqual(TRIS.slice(0, 9).map((t) => t.cle), ['n', 'moyenne', 'mediane', 'p95', 'p99', 'max', 'total', 'erreurs', 'sql'], 'les tris du service d’abord');
  assert.equal(COLONNES_DES_ROUTES.length, TRIS.length, 'chaque colonne se trie');
  assert.match(page, /data-api=\{url\('api\/'\)\} data-base=\{url\(\)\}/);
  assert.doesNotMatch(page, /<(?!Base\b)[A-Za-z][^>]*\stitle=/, 'jamais d’infobulle native (le title de <Base> est celui de la page)');
  // chaque champ des filtres des journaux a son étiquette
  for (const [, id] of page.matchAll(/<(?:input|select)[^>]*\sid="([^"]+)"/g)) assert.match(page, new RegExp(`<label for="${id}">`), id);
  // la version portable ne l'emporte pas (pas de service)
  assert.match(lire('../../tools/build-artifact.mjs'), /if \(rel\.startsWith\('debug\/'\)\) continue;/);
});

test('le script de la page n’importe que lib/debug-api.mjs, lib/debug-journaux.mjs et lib/debug-metriques.mjs, qu’aucun autre script de page n’importe', () => {
  const imports = (url) => [...readFileSync(url, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  const scripts = new URL('../src/scripts/', import.meta.url);
  assert.deepEqual(imports(new URL('debug.mjs', scripts)), ['../lib/debug-api.mjs', '../lib/debug-journaux.mjs', '../lib/debug-metriques.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/debug-journaux.mjs', import.meta.url)), ['./debug-api.mjs', './debug-metriques.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/debug-metriques.mjs', import.meta.url)), ['./debug-api.mjs'], 'pas de boucle avec debug-journaux');
  assert.deepEqual(imports(new URL('../src/lib/debug-api.mjs', import.meta.url)), [], 'sans dépendance');
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'debug.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /\/debug-(api|journaux|metriques)\.mjs$/.test(m)), [], nom);
  }
  const script = lire('../src/scripts/debug.mjs');
  assert.doesNotMatch(script, /\.title\b|getAttribute\('title'\)|setAttribute\('title'/, 'aucune infobulle native');
  assert.match(script, /`\$\{api\}etat\/`/, 'l’état du service d’abord');
  assert.match(script, /etat\.edition !== true/, 'hors du site de dev : la page s’arrête');
  assert.match(script, /`\$\{api\}v1\/openapi\.json`/);
  // performances et système : relevés toutes les 30 s au plus, ni onglet caché ni bloc replié ; une réponse périmée (choix changé) ignorée
  assert.match(script, /setInterval\(\(\) => relever\(\), RELEVE_METRIQUES_MS\)/);
  assert.match(script, /if \(document\.hidden\) return;/);
  assert.match(script, /if \(perfs\.open && /);
  assert.match(script, /if \(systeme\.open && /);
  assert.match(script, /if \(numero !== demandes\.metriques\) return;/);
  assert.match(script, /statut === 403/, 'un service qui refuse (pas le site de dev) : la page s’arrête de demander');
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

test('site construit : /debug/ selon le mode — testeur fermé, journaux et script hors production ; une phrase et rien au menu en production', construit, () => {
  const html = readFileSync(new URL('debug/index.html', dist), 'utf8');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const outils = html.match(/<ul class="site-nav__items" data-group="outils"[^>]*>([\s\S]*?)<\/ul>/)[1];
  const auMenu = /<a href="\/debug\/"[^>]*>Debug<\/a>/.test(outils);
  if (main.includes('class="debug-reservee"')) {
    // build de production (SITE_MODE=prod ; la CI en fait un : ci.yml) : ni entrée de menu, ni testeur, ni son script — dans toute la page, pas
    // seulement dans <main> : un composant qui poserait le script hors de la condition `actif` l'y ferait charger. Astro construit le script même
    // quand la page ne le pose pas (dist/_astro/) : on le reconnaît à ce qu'il lit (la description de l'API, le journal), et aucune page ne doit le
    // charger.
    assert.match(main, /<p class="debug-reservee">Cette page est réservée au serveur de dev\.<\/p>/);
    assert.doesNotMatch(html, /data-debug\b|data-journaux|data-testeur/);
    assert.equal(auMenu, false, 'pas au menu en production');
    const accueil = readFileSync(new URL('index.html', dist), 'utf8');
    assert.doesNotMatch(accueil, /href="\/debug\/"/, 'ni au menu de l’accueil');
    const duDebug = readdirSync(new URL('_astro/', dist)).filter((n) => n.endsWith('.js'))
      .filter((n) => { const code = readFileSync(new URL(`_astro/${n}`, dist), 'utf8'); return ['v1/openapi.json', 'debug/journal/', 'debug/metriques/', 'debug/systeme/'].some((a) => code.includes(a)); });
    for (const page of [html, accueil]) {
      const charges = [...page.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1].split('/').at(-1));
      assert.deepEqual(charges.filter((n) => duDebug.includes(n)), [], 'le script du testeur ou des journaux chargé en production');
    }
    return;
  }
  assert.equal(auMenu, true, 'au menu Outils du site de dev');
  assert.match(main, /<div class="debug" data-debug data-api="\/api\/" data-base="\/">/);
  assert.match(main, /<details class="debug-testeur" data-debug-testeur hidden>/, 'le testeur, fermé (et caché tant que le service n’a pas répondu)');
  assert.ok(main.indexOf('data-debug-testeur') < main.indexOf('data-debug-journaux'));
  assert.match(main, /<details class="debug-bloc debug-perfs" data-debug-perfs open hidden>/, 'Performances, ouvert (caché tant que le service n’a pas répondu)');
  assert.match(main, /<details class="debug-bloc debug-systeme" data-debug-systeme open hidden>/);
  const ordre = ['data-debug-testeur', 'data-debug-perfs', 'data-debug-systeme', 'data-debug-journaux'].map((m) => main.indexOf(m));
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre);
  assert.match(main, /<option value="dev" selected>Site de dev<\/option><option value="prod">Production<\/option>/, 'deux instances, jamais mélangées');
  assert.match(main, /<th scope="col" aria-sort="descending"><button type="button" class="debug-tri" data-tri-colonne="moyenne">Moyenne<\/button><\/th>/, 'trié par moyenne décroissante');
  assert.match(main, /href="\/api\/debug\/metriques\/export\/\?instance=dev&amp;periode=24h&amp;format=csv" download>Exporter \(CSV\)<\/a>/);
  assert.match(main, /<script type="module"/, 'le script de la page');
  // le script construit est bien celui qui lit la description et le journal (le contrôle de production le cherche par ces adresses)
  const construits = readdirSync(new URL('_astro/', dist)).filter((n) => n.endsWith('.js')).map((n) => readFileSync(new URL(`_astro/${n}`, dist), 'utf8'));
  assert.ok(construits.some((code) => code.includes('v1/openapi.json') && code.includes('debug/journal/') && code.includes('debug/metriques/') && code.includes('debug/systeme/')),
    'le script de la page Debug dans dist/_astro/');
  assert.doesNotMatch(main, /<(?:a|button|span|div|input|select|td|th)\b[^>]*\stitle=/, 'jamais d’infobulle native');
});
