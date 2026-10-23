// API REST /api/v1/ (client/serveur/ressources.mjs, openapi.mjs ; registre src/lib/ressources.mjs ; docs/serveur.md, « API REST ») : fermée hors du site
// de dev (décision du propriétaire du 2026-10-15 : 403 partout, lectures comprises), catalogue et description OpenAPI conformes au registre, listes
// (pagination, recherche, tri, filtres, condition), détail (ETag, 304, extensions, enfants, dérivées), sous-ressources, écritures par le service
// d'édition (journal, If-Match, 201 + Location, suppression avec les retraits des fiches : R42), jamais une image entière ni une table des fiches ou
// du journal ; puis /api/debug/journal/ et le serveur HTTP réel (chaîne de requête, journal des requêtes, identifiants encodés).
// Base vivante neuve dans un dossier temporaire ; les essais d'écriture portent sur des éléments créés ici (noms absents de la base) et lisent l'état
// avant d'écrire.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { creerJournalDuService } from '../serveur/journal-du-service.mjs';
import { FERMEE_EN_PRODUCTION, LIMITE_MAX, TABLES_JAMAIS_SERVIES, TRADUCTIONS } from '../serveur/ressources.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { ficheVide, TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { capacitesDe, MODULES, RESSOURCES, segmentDeCle, tablesDe } from '../src/lib/ressources.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { operationsDe, requeteDe } from './aide-openapi.mjs';

/** Images écrites par Chromium (test/portrait.test.mjs) : WebP, JPEG et PNG de 3 × 2 pixels. */
const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));

const racine = dossierTemporaire('api-v1');
const REGLES = cheminBase({ sansExemples: false });
const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const journal = [];
const service = { base: () => db, etat: () => ({ service: 'essai', version: '0.0.0-essai' }), journal: (l, o) => journal.push({ l, o }), edition: true };
const JSON_ = { 'content-type': 'application/json' };
const appel = (methode, chemin_, corps, entetes = {}, s = service) =>
  traiter({ methode, chemin: chemin_, entetes: { ...JSON_, ...entetes }, corps: corps === undefined ? undefined : typeof corps === 'string' ? corps : JSON.stringify(corps) }, s);
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps)?.slice(0, 800));
  return r.corps;
};
const ligne = (sql, ...p) => { const l = db.prepare(sql).get(...p); return l ? { ...l } : null; };
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const seg = (...valeurs) => valeurs.map((v) => encodeURIComponent(String(v))).join(',');
/** Un nom que la table n'a pas encore (ni l'id de page `<type>/<slug>`). */
const nomLibre = (nom, table, type = null) => {
  let n = nom;
  for (let i = 2; ligne(`SELECT 1 FROM "${table}" WHERE nom = ?`, n) || (type && ligne('SELECT 1 FROM page WHERE id = ?', `${type}/${normalize(n)}`)); i += 1) n = `${nom} ${i}`;
  return n;
};

test('fermée hors du site de dev (décision du propriétaire, 2026-10-15) : 403 sur TOUT /api/v1/, lectures, catalogue et description comprises, avant 404 et 405', () => {
  const ferme = { ...service, edition: false };
  for (const [m, c] of [
    ['GET', '/api/v1/'], ['GET', '/api/v1'], ['GET', '/api/v1/openapi.json'], ['GET', '/api/v1/metiers/'], ['GET', '/api/v1/metiers/metiers%2Fforgeron/'],
    ['GET', '/api/v1/races/races%2Fhumain/dons/'], ['GET', '/api/v1/inconnue/'], ['GET', '/api/v1/metiers/x/y/z/w/v/'], ['POST', '/api/v1/metiers/'],
    ['PATCH', '/api/v1/metiers/metiers%2Fforgeron/'], ['DELETE', '/api/v1/metiers/metiers%2Fforgeron/'], ['PUT', '/api/v1/caracteristiques/force/'],
  ]) {
    const r = appel(m, c, m === 'GET' ? undefined : {}, {}, ferme);
    assert.equal(r.statut, 403, `${m} ${c}`);
    assert.equal(r.corps.erreur, FERMEE_EN_PRODUCTION);
  }
  // le reste du service ne change pas : l'état, les prétirés
  assert.equal(appel('GET', '/api/etat/', undefined, {}, ferme).statut, 200);
  assert.equal(appel('GET', '/api/personnages/', undefined, {}, ferme).statut, 200);
});

test('catalogue : chaque ressource du registre, ses capacités, ses colonnes (modifiables d’après TABLES), ses champs de création, ses enfants et son nombre de lignes', () => {
  const c = ok(appel('GET', '/api/v1/'));
  assert.equal(c.version, '0.0.0-essai');
  assert.equal(c.documentation, '/api/v1/openapi.json');
  assert.deepEqual(c.modules.map((m) => m.cle), MODULES.map((m) => m.cle));
  assert.deepEqual(c.ressources.map((r) => r.cle), RESSOURCES.map((r) => r.cle), 'toutes les ressources du registre sont servies');
  for (const r of c.ressources) {
    const registre = RESSOURCES.find((x) => x.cle === r.cle);
    assert.deepEqual(r.capacites, capacitesDe(registre), r.cle);
    assert.equal(r.adresse, `/api/v1/${r.cle}/`);
    const colonnes = lignes(`PRAGMA table_info("${r.table}")`).map((x) => x.name);
    assert.deepEqual(r.colonnes.map((x) => x.nom), colonnes, `${r.cle} : colonnes`);
    // modifiable : une colonne de TABLES (sauf figée pour toutes les lignes : colonnesFigees), ou un champ du PATCH traduit en opération du lot
    const parOperation = registre.operations?.PATCH ? TRADUCTIONS[registre.operations.PATCH].PATCH.champs : null;
    for (const x of r.colonnes) {
      const attendu = parOperation ? Boolean(parOperation[x.nom]) : Boolean(r.capacites.modifier && TABLES[r.table]?.colonnes[x.nom] && typeof registre.colonnesFigees?.[x.nom] !== 'string');
      assert.equal(x.modifiable, attendu, `${r.cle}.${x.nom} : modifiable`);
    }
    const condition = Object.entries(registre.condition ?? {});
    const toutes = lignes(`SELECT * FROM "${r.table}"`).filter((l) => condition.every(([col, v]) => (Array.isArray(v) ? v.includes(l[col]) : !v.sauf.includes(l[col]))));
    assert.equal(r.lignes, toutes.length, `${r.cle} : nombre de lignes`);
    if (r.capacites.creer && registre.ecriture?.creer) assert.deepEqual(r.creation.champs.map((x) => x.nom), Object.keys(ENTITES[registre.ecriture.creer].champs), r.cle);
    else if (r.capacites.creer) assert.deepEqual(r.creation.champs.map((x) => x.nom), Object.keys(TRADUCTIONS[registre.operations.POST].POST.champs), r.cle);
    else assert.equal(r.creation, null, r.cle);
    assert.deepEqual(r.enfants.map((e) => e.cle), (registre.enfants ?? []).map((e) => e.cle), r.cle);
    for (const e of r.enfants) assert.deepEqual(e.capacites, capacitesDe(registre.enfants.find((x) => x.cle === e.cle)), `${r.cle}/${e.cle}`);
  }
  // un champ de création dont la valeur vient d'une liste du service : ses valeurs, lues dans la base vivante
  const classes = c.ressources.find((r) => r.cle === 'classes');
  assert.deepEqual(classes.creation.champs.find((x) => x.nom === 'categorie_id').valeurs.map((v) => v.valeur),
    lignes('SELECT id FROM categorie_classe ORDER BY ordre').map((x) => x.id));
  // le parent d'un enfant vient de l'adresse
  const blocs = c.ressources.find((r) => r.cle === 'evenements').enfants.find((e) => e.cle === 'descriptions');
  assert.equal(blocs.creation.champs.find((x) => x.nom === 'evenement_id').par_l_adresse, true);
  // le libellé d'une création (ENTITES.nouveau) : au féminin pour une race et une classe, dans le catalogue comme dans les refus
  assert.equal(c.ressources.find((r) => r.cle === 'races').creation.libelle, 'Nouvelle race');
  assert.equal(classes.creation.libelle, 'Nouvelle classe');
  assert.ok(!c.ressources.some((r) => /^Nouveau (race|classe)\b/.test(r.creation?.libelle ?? '')));
  assert.match(appel('POST', '/api/v1/races/', {}).corps.erreur, /^Nouvelle race : « Nom » obligatoire/);
  // ce que le service exige hors d'un cas, et la limite des spécialités (R43), sont au catalogue
  assert.equal(classes.creation.champs.find((x) => x.nom === 'nom').exige, 'sauf pour une classe raciale (race_id), qui prend le nom de sa race');
  assert.match(c.ressources.find((r) => r.cle === 'dons-de-classe').creation.champs.find((x) => x.nom === 'niveau').exige, /option d’un choix/);
  assert.deepEqual(Object.keys(c.ressources.find((r) => r.cle === 'specialites').creation.limite), ['champ', 'table', 'nombre', 'regle', 'disponible']);
});

test('jamais une table des fiches, des comptes, des groupes ni du journal : aucune route /api/v1/ ne les sert', () => {
  for (const t of [...TABLES_FICHES, 'modification', 'modification_lot', 'note_version_brouillon']) assert.ok(TABLES_JAMAIS_SERVIES.has(t), t);
  for (const r of RESSOURCES) assert.ok(!tablesDe(r).some((t) => TABLES_JAMAIS_SERVIES.has(t)), r.cle);
  for (const c of ['personnages', 'personnage', 'utilisateurs', 'utilisateur', 'groupes', 'groupe', 'modifications', 'modification', 'journal', 'brouillon']) {
    assert.equal(appel('GET', `/api/v1/${c}/`).statut, 404, c);
  }
  // la section 15 se lit : notes de version et historique
  ok(appel('GET', '/api/v1/notes-de-version/'));
  ok(appel('GET', '/api/v1/historique/?limite=1'));
});

test('description OpenAPI 3.1 : chaque ressource a ses chemins, chaque méthode déclarée correspond à ses capacités, chaque opération a ses réponses et un operationId unique ; les routes du service y sont aussi', () => {
  const spec = ok(appel('GET', '/api/v1/openapi.json'));
  assert.equal(spec.openapi, '3.1.0');
  assert.equal(spec.servers[0].url, '/api');
  assert.equal(spec.info.version, '0.0.0-essai');
  assert.deepEqual(spec.tags.map((t) => t.name), [...MODULES.map((m) => m.libelle), 'Service']);
  const resoudre = (o) => {
    if (!o?.$ref) return o;
    const cible = o.$ref.slice(2).split('/').reduce((x, k) => x?.[k], spec);
    assert.ok(cible, `$ref ${o.$ref}`);
    return resoudre(cible);
  };
  const ids = new Set();
  const noms = new Set(spec.tags.map((t) => t.name));
  for (const [chemin_, item] of Object.entries(spec.paths)) {
    assert.ok(chemin_.endsWith('/') || chemin_ === '/v1/openapi.json', `${chemin_} : « / » finale`);
    const declares = (item.parameters ?? []).map(resoudre).filter((p) => p.in === 'path').map((p) => p.name);
    for (const [methode, op] of Object.entries(item).filter(([m]) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))) {
      assert.ok(op.operationId && !ids.has(op.operationId), `${methode} ${chemin_} : operationId ${op.operationId}`);
      ids.add(op.operationId);
      assert.ok(op.summary, `${op.operationId} : summary`);
      assert.ok(noms.has(op.tags?.[0]), `${op.operationId} : tag ${op.tags?.[0]}`);
      assert.ok(op.responses && Object.keys(op.responses).length, `${op.operationId} : responses`);
      for (const rep of Object.values(op.responses)) assert.ok(resoudre(rep).description, `${op.operationId} : description d'une réponse`);
      const parametres = [...declares, ...(op.parameters ?? []).map(resoudre).filter((p) => p.in === 'path').map((p) => p.name)];
      for (const [, nom] of chemin_.matchAll(/\{([^}]+)\}/g)) assert.ok(parametres.includes(nom), `${op.operationId} : {${nom}} déclaré`);
      for (const p of op.parameters ?? []) assert.ok(['path', 'query', 'header'].includes(resoudre(p).in), `${op.operationId} : paramètre`);
      if (op.requestBody) assert.ok(resoudre(op.requestBody).content['application/json'], `${op.operationId} : corps JSON`);
    }
  }
  const methodes = (c) => Object.keys(spec.paths[c] ?? {}).filter((m) => m !== 'parameters').sort();
  for (const r of RESSOURCES) {
    const c = capacitesDe(r);
    assert.deepEqual(methodes(`/v1/${r.cle}/`), ['get', ...(c.creer ? ['post'] : [])].sort(), r.cle);
    assert.deepEqual(methodes(`/v1/${r.cle}/{cle}/`), ['get', ...(c.modifier ? ['patch'] : []), ...(c.supprimer ? ['delete'] : [])].sort(), `${r.cle}/{cle}`);
    for (const e of r.enfants ?? []) {
      const ce = capacitesDe(e);
      assert.deepEqual(methodes(`/v1/${r.cle}/{cle}/${e.cle}/`), ['get', ...(ce.creer ? ['post'] : [])].sort(), `${r.cle}/${e.cle}`);
      assert.deepEqual(methodes(`/v1/${r.cle}/{cle}/${e.cle}/{cleEnfant}/`), ['get', ...(ce.modifier ? ['patch'] : []), ...(ce.supprimer ? ['delete'] : [])].sort(), `${r.cle}/${e.cle}/{cleEnfant}`);
    }
  }
  for (const c of ['/etat/', '/maintenance/', '/maintenance/lever/', '/personnages/', '/personnages/{id}/', '/personnages/{id}/portrait/', '/edition/', '/edition/en-attente/',
    '/edition/journal/', '/mise-a-jour/', '/mise-a-jour/lots/{lot}/', '/mise-a-jour/conflits/', '/debug/journal/', '/metriques/page/', '/classeur/', '/tipeee/', '/v1/',
    '/v1/openapi.json']) {
    assert.ok(spec.paths[c], c);
    assert.equal(spec.paths[c][Object.keys(spec.paths[c]).find((m) => m !== 'parameters')].tags[0], 'Service', c);
  }
  // les lots en conflit : la lecture (GET) et la résolution (POST) ; le texte de Tipeee en lecture seule
  assert.deepEqual(methodes('/mise-a-jour/conflits/'), ['get', 'post']);
  assert.deepEqual(methodes('/tipeee/'), ['get']);
  // l'exemple d'une clé est une ligne qui existe (valeurs brutes jointes par « , »), posé sur le GET et le PATCH seulement ; l'exemple d'une
  // modification ne change rien
  const p = spec.paths['/v1/metiers/{cle}/'];
  const exemple = p.get.parameters.map(resoudre).find((x) => x.name === 'cle').example;
  assert.equal(p.patch.parameters.map(resoudre).find((x) => x.name === 'cle').example, exemple);
  assert.ok(ligne('SELECT 1 FROM metier WHERE id = ?', exemple), exemple);
  const patch = p.patch.requestBody.content['application/json'].example;
  const [colonne] = Object.keys(patch);
  assert.equal(patch[colonne], ligne('SELECT * FROM metier WHERE id = ?', exemple)[colonne]);
  // l'exemple d'une création : ses champs obligatoires
  const creer = spec.paths['/v1/metiers/'].post.requestBody.content['application/json'];
  assert.deepEqual(creer.schema.required, ['nom']);
  assert.ok(creer.example.nom);
});

test('description : chaque route que liste l’en-tête de serveur/api.mjs (méthode et adresse) y est décrite, avec cette méthode', () => {
  const spec = ok(appel('GET', '/api/v1/openapi.json'));
  const forme = (c) => c.replace(/<[^>]+>|\{[^}]+\}/g, '{}');
  const decrits = new Map(Object.entries(spec.paths).map(([c, item]) => [forme(c), new Set(Object.keys(item).filter((m) => m !== 'parameters'))]));
  const entete = readFileSync(new URL('../serveur/api.mjs', import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n');
  const routes = [...entete.matchAll(/^\/\/\s+(GET|POST|PUT|PATCH|DELETE)\s+\/api(\/\S*?\/)(?=[\s,]|$)/gm)].map(([, m, c]) => [m.toLowerCase(), forme(c)]);
  assert.ok(routes.length >= 40, `${routes.length} routes lues dans l’en-tête`);
  for (const [m, c] of routes) assert.ok(decrits.get(c)?.has(m), `${m.toUpperCase()} /api${c} : absente de la description OpenAPI`);
});

test('les exemples de la description servent tels quels (un client qui les enverrait sans rien changer : test/aide-openapi.mjs) : chaque lecture répond 200, chaque modification d’exemple ne change rien', () => {
  const spec = ok(appel('GET', '/api/v1/openapi.json'));
  /** La table d'une opération : celle de l'enfant (« /v1/<res>/{cle}/<enfant>/… »), sinon celle de la ressource. */
  const tableDe = (chemin_) => {
    const [, cle, , enfant] = chemin_.split('/').slice(1);
    const r = RESSOURCES.find((x) => x.cle === cle);
    return enfant ? r.enfants.find((e) => e.cle === enfant).table : r.table;
  };
  let lectures = 0;
  for (const op of operationsDe(spec).filter((o) => /^\/v1\/[a-z]/.test(o.chemin) && o.chemin !== '/v1/openapi.json' && ['GET', 'PATCH'].includes(o.methode))) {
    const valeurs = { path: Object.fromEntries(op.parametres.filter((p) => p.dans === 'path').map((p) => [p.nom, p.exemple])) };
    const r = requeteDe(op, { valeurs, corps: op.corps?.exemple ?? '' });
    if (r.erreurs.length) {
      // seule une table encore vide n'a pas de ligne d'exemple (les catégories de la chronologie, créées sur le site de dev)
      assert.equal(ligne(`SELECT count(*) AS n FROM "${tableDe(op.chemin)}"`).n, 0, `${op.id} : ${r.erreurs.join(' ')}`);
      continue;
    }
    const u = new URL(r.url, 'http://service');
    const entetes = Object.fromEntries(Object.entries(r.entetes).map(([k, v]) => [k.toLowerCase(), v]));
    const reponse = traiter({ methode: r.methode, chemin: u.pathname, recherche: u.search, entetes, corps: r.corps ?? undefined }, service);
    assert.equal(reponse.statut, 200, `${op.id} ${r.url} : ${JSON.stringify(reponse.corps).slice(0, 300)}`);
    if (op.methode === 'PATCH') assert.equal(reponse.corps.lot, null, `${op.id} : l’exemple ne change rien`);
    else lectures += 1;
  }
  assert.ok(lectures > RESSOURCES.length * 2, `${lectures} lectures`);
});

test('description : aucun DELETE n’a pour exemple la clé d’une ligne réelle ; une création qu’aucune suppression ne défait n’a pas de corps d’exemple ; chaque écriture sans retour le dit (x-sans-retour)', () => {
  const spec = ok(appel('GET', '/api/v1/openapi.json'));
  const operations = operationsDe(spec);
  const suppressions = operations.filter((o) => o.methode === 'DELETE' && o.chemin.startsWith('/v1/'));
  assert.ok(suppressions.length > 10, `${suppressions.length} suppressions`);
  for (const op of suppressions) {
    for (const p of op.parametres.filter((x) => x.dans === 'path')) assert.equal(p.exemple, '', `${op.id} : {${p.nom}} sans exemple`);
    // envoyée telle quelle (ses exemples), elle ne peut pas partir : une clé manque
    assert.ok(requeteDe(op, { valeurs: { path: {} } }).erreurs.some((e) => /manquant/.test(e)), op.id);
    // une suppression d'entité ne se défait pas : la description le dit ; une ligne retirée par une opération du lot se repose (POST)
    const parOperation = /opération « [a-z_]+ » du lot/.test(op.description);
    assert.equal(Boolean(op.sansRetour), !parOperation, `${op.id} : x-sans-retour`);
    if (!parOperation) assert.match(op.sansRetour, /^Suppression définitive : rien ne la défait/, op.id);
  }
  // les lectures et modifications gardent leur exemple réel (le test suivant les rejoue)
  assert.ok(operations.find((o) => o.id === 'lire_metiers').parametres.find((p) => p.nom === 'cle').exemple);
  assert.ok(operations.find((o) => o.id === 'modifier_metiers').parametres.find((p) => p.nom === 'cle').exemple);
  // une création sans suppression : pas de corps prêt à l'envoi, et la description le dit
  const catalogue = ok(appel('GET', '/api/v1/'));
  const sansSuppression = catalogue.ressources.filter((r) => r.capacites.creer && !r.capacites.supprimer).map((r) => `creer_${r.cle.replace(/-/g, '_')}`);
  assert.ok(['creer_races', 'creer_classes', 'creer_peuples'].every((id) => sansSuppression.includes(id)), sansSuppression.join(', '));
  for (const id of sansSuppression) {
    const op = operations.find((o) => o.id === id);
    assert.equal(op.corps.exemple, '', `${id} : pas de corps d’exemple`);
    assert.match(op.sansRetour, /Création définitive/, id);
    assert.equal(requeteDe(op, { corps: op.corps.exemple }).erreurs.join(' '), 'Corps de la requête manquant.', `${id} : rien ne part tel quel`);
  }
  // une création qui se défait garde son exemple
  assert.ok(JSON.parse(operations.find((o) => o.id === 'creer_metiers').corps.exemple).nom);
  assert.equal(operations.find((o) => o.id === 'creer_metiers').sansRetour, null);
  // un filtre de liste répété (l'une OU l'autre) ou vide (colonne vide), comme la description l'annonce : le service le sert
  const lister = operations.find((o) => o.id === 'lister_metiers');
  const filtre = lister.parametres.find((p) => p.nom === 'test_carac_1_id');
  assert.deepEqual([filtre.repetable, filtre.videPermis], [true, true]);
  const servir = (r) => { const u = new URL(r.url, 'http://service'); return ok(traiter({ methode: 'GET', chemin: u.pathname, recherche: u.search, entetes: {} }, service)); };
  const deux = servir(requeteDe(lister, { valeurs: { query: { limite: '500', test_carac_1_id: 'force\nvolonte' } } }));
  assert.equal(deux.total, ligne("SELECT count(*) AS n FROM metier WHERE test_carac_1_id IN ('force', 'volonte')").n);
  const vides = servir(requeteDe(lister, { valeurs: { query: { limite: '500' } }, vides: ['test_carac_1_id'] }));
  assert.equal(vides.total, ligne("SELECT count(*) AS n FROM metier WHERE test_carac_1_id IS NULL OR test_carac_1_id = ''").n);
});

test('les exemples de création de la description réussissent tels quels (201), puis leur suppression ; les spécialités prennent une classe qui a encore de la place (R43)', () => {
  // sans classe à moins de deux spécialités, l'exemple n'en nomme pas et la description le dit
  const sansPlace = lignes('SELECT c.id FROM classe c WHERE (SELECT count(*) FROM specialite s WHERE s.classe_id = c.id) < 2');
  if (!sansPlace.length) {
    const op = operationsDe(ok(appel('GET', '/api/v1/openapi.json'))).find((o) => o.id === 'creer_specialites');
    assert.equal(op.corps.exemple, '', 'pas de corps d’exemple : il serait refusé (409)');
    assert.match(op.corps.description, /au plus 2 par « classe_id » \(décision R43\) : aucune ligne de classe n’en a moins/);
    assert.match(op.corps.description, /pas de corps d’exemple : « classe_id » n’a aucune valeur possible pour l’instant/);
  }
  // une classe (sans exemple : elle ne se supprime pas) qui a de la place pour des spécialités
  const classe = ok(appel('POST', '/api/v1/classes/', { categorie_id: 'classe-physique-corps-a-corps', nom: nomLibre('Classe des exemples', 'classe', 'classes') }), 201);
  const spec = ok(appel('GET', '/api/v1/openapi.json'));
  const creations = operationsDe(spec).filter((o) => o.methode === 'POST' && /^\/v1\/[a-z]/.test(o.chemin) && o.corps?.exemple);
  assert.ok(creations.length >= 15, `${creations.length} créations avec exemple`);
  const faites = [];
  for (const op of creations) {
    const valeurs = { path: Object.fromEntries(op.parametres.filter((x) => x.dans === 'path').map((x) => [x.nom, x.exemple])) };
    const r = requeteDe(op, { valeurs, corps: op.corps.exemple });
    assert.deepEqual(r.erreurs, [], op.id);
    const u = new URL(r.url, 'http://service');
    const entetes = Object.fromEntries(Object.entries(r.entetes).map(([k, v]) => [k.toLowerCase(), v]));
    const reponse = traiter({ methode: 'POST', chemin: u.pathname, recherche: u.search, entetes, corps: r.corps }, service);
    assert.equal(reponse.statut, 201, `${op.id} ${r.corps} : ${JSON.stringify(reponse.corps).slice(0, 400)}`);
    faites.push([op.id, reponse.entetes.Location]);
  }
  assert.ok(faites.some(([id]) => id === 'creer_specialites'), 'la spécialité d’exemple');
  assert.equal(JSON.parse(creations.find((o) => o.id === 'creer_specialites').corps.exemple).classe_id, classe.element.id, 'la classe qui a de la place');
  assert.ok(faites.some(([id]) => id === 'creer_dons_de_classe'), 'le don d’exemple (son niveau)');
  // chaque création d'exemple se défait (sinon elle n'aurait pas d'exemple), dans l'ordre inverse
  for (const [id, adresse] of faites.reverse()) {
    const r = appel('DELETE', adresse);
    assert.ok([200, 404].includes(r.statut), `${id} ${adresse} : ${JSON.stringify(r.corps).slice(0, 300)}`);
  }
});

test('liste : pagination, recherche sans accents, tri (« - » : décroissant, la clé départage), filtres exacts, colonne inconnue refusée', () => {
  const tout = ok(appel('GET', `/api/v1/metiers/?limite=${LIMITE_MAX}`));
  assert.equal(tout.total, ligne('SELECT count(*) AS n FROM metier').n);
  assert.equal(tout.limite, LIMITE_MAX);
  const page = ok(appel('GET', '/api/v1/metiers/?limite=2&decalage=1'));
  assert.deepEqual([page.total, page.limite, page.decalage], [tout.total, 2, 1]);
  assert.deepEqual(page.elements.map((e) => e.cle), tout.elements.slice(1, 3).map((e) => e.cle));
  // chaque élément : sa clé (segment de l'adresse), son adresse, les colonnes de la liste
  const premier = tout.elements[0];
  assert.equal(premier.cle, seg(premier.id));
  assert.equal(premier.adresse, `/api/v1/metiers/${seg(premier.id)}/`);
  assert.deepEqual(Object.keys(premier), ['cle', 'adresse', ...RESSOURCES.find((r) => r.cle === 'metiers').liste]);
  // tri par défaut (le nom), puis décroissant
  const nomsTries = tout.elements.map((e) => e.nom);
  assert.deepEqual(nomsTries, [...nomsTries].sort(new Intl.Collator('fr', { numeric: true, sensitivity: 'variant' }).compare));
  const decroissant = ok(appel('GET', `/api/v1/metiers/?tri=-nom&limite=${LIMITE_MAX}`));
  assert.deepEqual(decroissant.elements.map((e) => e.nom), [...nomsTries].reverse());
  assert.equal(decroissant.tri, '-nom,id');
  // recherche : sans accents ni majuscules, sur les colonnes de recherche
  const cible = tout.elements.find((e) => /[éèêà]/i.test(e.nom)) ?? premier;
  const mot = cible.nom.split(/\s+/)[0].normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  const trouves = ok(appel('GET', `/api/v1/metiers/?q=${encodeURIComponent(mot)}`));
  assert.ok(trouves.elements.some((e) => e.id === cible.id), mot);
  assert.ok(trouves.elements.every((e) => normalize(e.nom).includes(normalize(mot))));
  // filtres : égalité, répétés (l'une OU l'autre), vide (colonne vide), sur une colonne entière
  const force = ok(appel('GET', '/api/v1/metiers/?test_carac_1_id=force&limite=500'));
  assert.deepEqual(force.elements.map((e) => e.id).sort(), lignes("SELECT id FROM metier WHERE test_carac_1_id = 'force'").map((x) => x.id).sort());
  const deux = ok(appel('GET', '/api/v1/metiers/?test_carac_1_id=force&test_carac_1_id=volonte&limite=500'));
  assert.equal(deux.total, ligne("SELECT count(*) AS n FROM metier WHERE test_carac_1_id IN ('force', 'volonte')").n);
  const sansArtisanat = ok(appel('GET', '/api/v1/metiers/?test_carac_1_id=&limite=500'));
  assert.equal(sansArtisanat.total, ligne("SELECT count(*) AS n FROM metier WHERE test_carac_1_id IS NULL OR test_carac_1_id = ''").n);
  assert.equal(ok(appel('GET', '/api/v1/metiers/?peut_fabriquer=1&limite=1')).total, ligne('SELECT count(*) AS n FROM metier WHERE peut_fabriquer = 1').n);
  // refus : colonne inconnue (jamais dans le SQL), limite hors bornes, nombre attendu, tri inconnu
  for (const q of ['inconnue=1', 'nom%22%20OR%201=1--=x', 'limite=0', `limite=${LIMITE_MAX + 1}`, 'limite=dix', 'decalage=-1', 'peut_fabriquer=oui', 'tri=nom,pas_une_colonne']) {
    const r = appel('GET', `/api/v1/metiers/?${q}`);
    assert.equal(r.statut, 400, q);
    assert.ok(r.corps.erreur, q);
  }
});

test('condition d’une table partagée : une liste ne montre que ses lignes, un élément hors de la condition est introuvable (404)', () => {
  const monstres = lignes("SELECT id FROM arme WHERE famille_id = 'arme-de-monstres'");
  const armes = ok(appel('GET', `/api/v1/armes/?limite=${LIMITE_MAX}`));
  assert.equal(armes.total, ligne("SELECT count(*) AS n FROM arme WHERE famille_id IS NULL OR famille_id <> 'arme-de-monstres'").n);
  assert.ok(!armes.elements.some((e) => monstres.some((m) => m.id === e.id)));
  // le filtre ne fait pas sortir de la condition
  assert.equal(ok(appel('GET', '/api/v1/armes/?famille_id=arme-de-monstres')).total, 0);
  if (monstres.length) {
    assert.equal(appel('GET', `/api/v1/armes/${seg(monstres[0].id)}/`).statut, 404);
    assert.equal(ok(appel('GET', `/api/v1/armes-de-monstres/${seg(monstres[0].id)}/`)).element.id, monstres[0].id);
  }
  // les pages du guide ne sont pas dans « pages »
  const guide = ligne("SELECT id FROM page WHERE type = 'guide' LIMIT 1");
  assert.equal(appel('GET', `/api/v1/pages/${seg(guide.id)}/`).statut, 404);
  assert.equal(ok(appel('GET', `/api/v1/pages-du-guide/${seg(guide.id)}/`)).element.id, guide.id);
});

test('dérivée restreinte (décision R167, migration 0081) : une amélioration d’arme montre les deux lignes TOTAL de son tableau (coût matériel, coût élémentaire) ; les types d’armes élémentaires et leurs compétences au choix, en lecture seule', () => {
  const amelioration = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'arme' ORDER BY niveau LIMIT 1");
  const d = ok(appel('GET', `/api/v1/ameliorations-d-arme/${seg(amelioration.id)}/`));
  assert.deepEqual(d.element, amelioration);
  assert.ok(d.element.cout_elementaire_brut, 'le coût élémentaire sur la même ligne');
  assert.deepEqual(d.derivees.amelioration_total.map((t) => t.cible), ['arme', 'arme_elementaire']);
  assert.deepEqual(d.derivees.amelioration_total.map((t) => t.total_brut), ['arme', 'arme_elementaire'].map((c) => ligne('SELECT total_brut FROM amelioration_total WHERE cible = ?', c).total_brut));
  // une amélioration d'armure élémentaire ne montre que la sienne ; plus aucune d'arme élémentaire dans « autres-ameliorations »
  const autres = ok(appel('GET', '/api/v1/autres-ameliorations/?limite=100'));
  assert.ok(autres.total > 0 && autres.elements.every((x) => x.cible === 'armure_elementaire'));
  const armure = ok(appel('GET', `/api/v1/autres-ameliorations/${seg(autres.elements[0].id)}/`));
  assert.deepEqual(armure.derivees.amelioration_total.map((t) => t.cible), ['armure_elementaire']);
  // les types d'armes élémentaires et leurs compétences (sous-ressource), en lecture seule
  const types = ok(appel('GET', '/api/v1/types-d-armes-elementaires/?limite=100'));
  assert.equal(types.total, ligne('SELECT count(*) AS n FROM arme_elementaire_type').n);
  const arc = ok(appel('GET', `/api/v1/types-d-armes-elementaires/${seg('arc')}/`));
  assert.deepEqual(arc.enfants.competences.map((c) => c.competence_id).sort(), lignes("SELECT competence_id FROM arme_elementaire_type_competence WHERE type_id = 'arc'").map((c) => c.competence_id).sort());
  assert.equal(appel('PATCH', `/api/v1/types-d-armes-elementaires/${seg('arc')}/`, { mention: 'essai' }, { 'if-match': `"${arc.version}"` }).statut, 405);
  // ses types de dégâts physiques (R167, sous-ressource) ; la Bombe, au choix
  const bombe = ok(appel('GET', `/api/v1/types-d-armes-elementaires/${seg('bombe')}/`));
  assert.equal(bombe.element.type_degats_au_choix, 1);
  assert.deepEqual(bombe.enfants['types-de-degats'].map((d) => d.type_degats).sort(), lignes("SELECT type_degats FROM arme_elementaire_type_degats WHERE type_id = 'bombe'").map((d) => d.type_degats).sort());
});

test('détail : toutes les colonnes, extensions, enfants et dérivées ; ETag et 304 ; 404 sur une clé inconnue ou illisible', () => {
  const metier = ligne('SELECT * FROM metier WHERE id IN (SELECT metier_id FROM metier_bonus) ORDER BY id LIMIT 1');
  const r = appel('GET', `/api/v1/metiers/${seg(metier.id)}/`);
  const d = ok(r);
  assert.deepEqual(d.element, metier);
  assert.equal(d.cle, seg(metier.id));
  assert.equal(r.entetes.ETag, `"${d.version}"`);
  assert.match(d.version, /^[0-9a-f]{16}$/);
  assert.deepEqual(d.derivees.metier_bonus.map((b) => b.rang), lignes('SELECT rang FROM metier_bonus WHERE metier_id = ? ORDER BY rang, option', metier.id).map((b) => b.rang));
  // 304 : même version (forme faible, liste) ; une autre version : 200
  const nonModifie = appel('GET', `/api/v1/metiers/${seg(metier.id)}/`, undefined, { 'if-none-match': `"autre", W/"${d.version}"` });
  assert.deepEqual([nonModifie.statut, nonModifie.corps, nonModifie.entetes.ETag], [304, null, `"${d.version}"`]);
  assert.equal(appel('GET', `/api/v1/metiers/${seg(metier.id)}/`, undefined, { 'if-none-match': '"autre"' }).statut, 200);
  // extensions : la race et son onglet ; enfants : ses dons raciaux (chacun avec sa clé et son adresse)
  const race = ligne('SELECT * FROM race WHERE id IN (SELECT race_id FROM race_don) ORDER BY ordre LIMIT 1');
  const dr = ok(appel('GET', `/api/v1/races/${seg(race.id)}/`));
  assert.deepEqual(dr.extensions.race_onglet, ligne('SELECT * FROM race_onglet WHERE race_id = ?', race.id));
  const dons = lignes('SELECT * FROM race_don WHERE race_id = ? ORDER BY rang', race.id);
  assert.deepEqual(dr.enfants.dons.map((x) => x.id), dons.map((x) => x.id));
  assert.equal(dr.enfants.dons[0].adresse, `/api/v1/races/${seg(race.id)}/dons/${seg(dons[0].id)}/`);
  // clés composées et entières : une case du tableau des dons (ligne, colonne)
  const caseDuTableau = ligne('SELECT * FROM race_don_tableau_cellule ORDER BY race_id, ligne, colonne LIMIT 1');
  if (caseDuTableau) {
    const dc = ok(appel('GET', `/api/v1/races/${seg(caseDuTableau.race_id)}/cases-du-tableau-de-dons/${caseDuTableau.ligne},${caseDuTableau.colonne}/`));
    assert.deepEqual(dc.element, caseDuTableau);
    assert.equal(dc.cle, `${caseDuTableau.ligne},${caseDuTableau.colonne}`);
  }
  const relation = ligne('SELECT * FROM relation_peuple LIMIT 1');
  assert.deepEqual(ok(appel('GET', `/api/v1/relations-entre-peuples/${seg(relation.ligne_peuple_id, relation.colonne_peuple_id)}/`)).element, relation);
  // une colonne de la table nommée `cle` : `colonne_cle` dans une liste, son nom dans le détail
  const alias = ok(appel('GET', '/api/v1/alias-des-pages/?limite=1')).elements[0];
  assert.ok('colonne_cle' in alias && alias.cle === seg(alias.page_id, alias.ordre));
  assert.equal(ok(appel('GET', alias.adresse)).element.cle, alias.colonne_cle);
  // introuvables
  for (const c of ['/api/v1/metiers/metiers%2Fpas-un-metier/', '/api/v1/metiers/%E0%A4%A/', '/api/v1/relations-entre-peuples/seulement-un/',
    `/api/v1/races/${seg(race.id)}/cases-du-tableau-de-dons/a,b/`, '/api/v1/inconnue/', `/api/v1/races/${seg(race.id)}/inconnue/`]) {
    assert.equal(appel('GET', c).statut, 404, c);
  }
});

test('ETag : l’empreinte de toute la représentation — un enfant modifié change la version du parent (plus de 304), et un DELETE avec l’ancienne version est refusé (409)', () => {
  const e = ok(appel('POST', '/api/v1/evenements/', { epoque: 'inconnue', titre: `Événement de l’ETag ${Date.now()}`, description: 'Bloc un.' }), 201);
  const deux = ok(appel('POST', `${e.adresse}descriptions/`, { texte: 'Bloc deux.' }), 201);
  const lu = appel('GET', e.adresse);
  const v = ok(lu).version;
  assert.equal(lu.entetes.ETag, `"${v}"`);
  assert.equal(appel('GET', e.adresse, undefined, { 'if-none-match': `"${v}"` }).statut, 304, 'rien n’a changé');
  // le bloc réécrit ne touche pas la ligne `evenement`
  const avant = ligne('SELECT * FROM evenement WHERE id = ?', e.element.id);
  ok(appel('PATCH', deux.adresse, { texte: 'Bloc deux, réécrit.' }));
  assert.deepEqual(ligne('SELECT * FROM evenement WHERE id = ?', e.element.id), avant);
  const relu = appel('GET', e.adresse, undefined, { 'if-none-match': `"${v}"` });
  assert.equal(relu.statut, 200, 'pas de 304 : la liste des blocs a changé');
  assert.notEqual(relu.corps.version, v);
  assert.equal(relu.entetes.ETag, `"${relu.corps.version}"`);
  assert.deepEqual(relu.corps.enfants.descriptions.map((b) => b.texte), ['Bloc un.', 'Bloc deux, réécrit.']);
  // un DELETE avec la version lue avant : 409, rien n'est supprimé ; avec la version à jour : supprimé
  const refuse = appel('DELETE', e.adresse, undefined, { 'if-match': `"${v}"` });
  assert.equal(refuse.statut, 409);
  assert.equal(refuse.corps.version, relu.corps.version);
  assert.equal(ligne('SELECT count(*) AS n FROM evenement_extrait WHERE evenement_id = ?', e.element.id).n, 2);
  ok(appel('DELETE', e.adresse, undefined, { 'if-match': relu.entetes.ETag }));
  assert.equal(ligne('SELECT count(*) AS n FROM evenement_extrait WHERE evenement_id = ?', e.element.id).n, 0);
});

test('sous-ressources : liste paginée sous un parent, une ligne ; une ligne d’un autre parent est introuvable', () => {
  const [a, b] = lignes('SELECT race_id FROM race_don GROUP BY race_id ORDER BY race_id LIMIT 2').map((x) => x.race_id);
  const liste = ok(appel('GET', `/api/v1/races/${seg(a)}/dons/?limite=1`));
  assert.deepEqual([liste.ressource, liste.enfant, liste.parent.cle, liste.total], ['races', 'dons', seg(a), ligne('SELECT count(*) AS n FROM race_don WHERE race_id = ?', a).n]);
  const don = liste.elements[0];
  const d = ok(appel('GET', don.adresse));
  assert.deepEqual([d.ressource, d.enfant, d.parent.adresse, d.element.race_id], ['races', 'dons', `/api/v1/races/${seg(a)}/`, a]);
  assert.equal(appel('GET', `/api/v1/races/${seg(b)}/dons/${don.cle}/`).statut, 404, 'sous un autre parent');
  assert.equal(appel('GET', '/api/v1/races/races%2Fpas-une-race/dons/').statut, 404, 'parent inconnu');
  assert.equal(ok(appel('GET', `/api/v1/races/${seg(a)}/dons/?forme=pas-une-forme`)).total, 0);
});

test('405 et Allow exacts : lecture seule, pas de création, pas de suppression, PUT', () => {
  const lecture = appel('POST', '/api/v1/caracteristiques/', {});
  assert.deepEqual([lecture.statut, lecture.entetes.Allow], [405, 'GET']);
  assert.match(lecture.corps.erreur, /pas de création par l’API/);
  const patch = appel('PATCH', '/api/v1/caracteristiques/force/', { nom: 'x' });
  assert.deepEqual([patch.statut, patch.entetes.Allow], [405, 'GET']);
  assert.match(patch.corps.erreur, /pas de modification par l’API/);
  const pages = appel('PATCH', '/api/v1/pages/x/', {});
  assert.match(pages.corps.erreur, /en lecture seule/);
  const race = appel('DELETE', '/api/v1/races/races%2Fhumain/');
  assert.deepEqual([race.statut, race.entetes.Allow], [405, 'GET, PATCH']);
  assert.match(race.corps.erreur, /pas de suppression par l’API/);
  const put = appel('PUT', '/api/v1/metiers/metiers%2Fforgeron/', {});
  assert.deepEqual([put.statut, put.entetes.Allow], [405, 'GET, PATCH, DELETE']);
  assert.match(put.corps.erreur, /PUT n’existe pas/);
  assert.deepEqual([appel('POST', '/api/v1/').statut, appel('POST', '/api/v1/').entetes.Allow], [405, 'GET']);
  assert.equal(appel('DELETE', '/api/v1/openapi.json').statut, 405);
  assert.equal(appel('POST', '/api/v1/races/races%2Fhumain/acces-aux-classes/', {}).entetes.Allow, 'GET');
});

test('écritures : gardes du service (JSON, autre site), corps attendu ; POST → 201 + Location relisible ; PATCH avec If-Match juste puis périmé (409) ; DELETE', () => {
  // gardes
  assert.equal(traiter({ methode: 'POST', chemin: '/api/v1/metiers/', entetes: {}, corps: '{}' }, service).statut, 415);
  assert.equal(appel('POST', '/api/v1/metiers/', {}, { 'sec-fetch-site': 'cross-site' }).statut, 403);
  assert.equal(appel('POST', '/api/v1/metiers/', '{pas du json').statut, 400);
  assert.equal(appel('POST', '/api/v1/metiers/').statut, 400, 'corps attendu');
  assert.equal(appel('POST', '/api/v1/metiers/', [1]).statut, 400, 'un objet');
  assert.match(appel('POST', '/api/v1/metiers/', { description: 'sans nom' }).corps.erreur, /obligatoire/);
  assert.equal(appel('POST', '/api/v1/metiers/', { nom: 'x', inconnu: 1 }).statut, 400);

  // création
  const nom = nomLibre('Métier de l’API v1', 'metier', 'metiers');
  const cree = appel('POST', '/api/v1/metiers/', { nom, bonus_brut: '+1 INI' });
  const d = ok(cree, 201);
  assert.equal(cree.entetes.Location, d.adresse);
  assert.equal(cree.entetes.ETag, `"${d.version}"`);
  assert.equal(d.element.nom, nom);
  assert.ok(d.lot);
  assert.deepEqual(d.fiches, []);
  const relu = ok(appel('GET', cree.entetes.Location));
  assert.equal(relu.element.id, d.element.id);
  assert.ok(relu.derivees.metier_bonus.length, 'le bonus découpé par le service');

  // modification : If-Match juste, puis l'ancienne version (409 avec l'élément à jour), puis sans If-Match
  const lu = appel('GET', relu.adresse);
  const modifie = appel('PATCH', relu.adresse, { description: 'Décrit par l’API.' }, { 'if-match': lu.entetes.ETag });
  const dm = ok(modifie);
  assert.equal(dm.element.description, 'Décrit par l’API.');
  assert.notEqual(dm.version, relu.version);
  assert.equal(modifie.entetes.ETag, `"${dm.version}"`);
  const perime = appel('PATCH', relu.adresse, { description: 'Trop tard.' }, { 'if-match': lu.entetes.ETag });
  assert.equal(perime.statut, 409);
  assert.deepEqual([perime.corps.element.description, perime.corps.version], ['Décrit par l’API.', dm.version]);
  assert.equal(ligne('SELECT description FROM metier WHERE id = ?', d.element.id).description, 'Décrit par l’API.', 'rien écrit');
  assert.equal(ok(appel('PATCH', relu.adresse, { description: 'Sans version.' })).element.description, 'Sans version.');
  // rien ne change : pas de lot ; une colonne hors de TABLES, inconnue, ou une valeur refusée
  assert.equal(ok(appel('PATCH', relu.adresse, { description: 'Sans version.' })).lot, null);
  assert.match(appel('PATCH', relu.adresse, { source_ref: 'x' }).corps.erreur, /ne se modifie pas/);
  assert.equal(appel('PATCH', relu.adresse, { pas_une_colonne: 'x' }).statut, 400);
  assert.equal(appel('PATCH', relu.adresse, {}).statut, 400);
  assert.match(appel('PATCH', relu.adresse, { nom: '' }).corps.erreur, /obligatoire/);

  // suppression : If-Match périmé refusé, puis supprimé (sans corps), puis introuvable
  assert.equal(appel('DELETE', relu.adresse, undefined, { 'if-match': lu.entetes.ETag }).statut, 409);
  const supprime = ok(appel('DELETE', relu.adresse));
  assert.deepEqual([supprime.supprime, supprime.adresse, supprime.fiches], [relu.cle, relu.adresse, []]);
  assert.ok(supprime.lot);
  assert.equal(appel('GET', relu.adresse).statut, 404);
  assert.equal(appel('DELETE', relu.adresse).statut, 404);
});

test('écritures : extensions (PATCH sous le nom de leur table ; une extension absente n’est pas créée), sous-ressources (le parent vient de l’adresse), clé de la ligne créée', () => {
  // un matériau créé (sans fiche d'arme) : son type est dans l'extension « materiau »
  const nom = nomLibre('Matériau de l’API v1', 'ressource');
  const m = ok(appel('POST', '/api/v1/materiaux/', { nom, type: 'Léger' }), 201);
  assert.equal(m.extensions.materiau.type, 'Léger');
  assert.equal(m.extensions.materiau_arme, null);
  const dm = ok(appel('PATCH', m.adresse, { description: 'Un matériau d’essai.', materiau: { type: 'Lourd' } }));
  assert.deepEqual([dm.element.description, dm.extensions.materiau.type], ['Un matériau d’essai.', 'Lourd']);
  const sansFiche = appel('PATCH', m.adresse, { materiau_arme: { effet_brut: 'x' } });
  assert.equal(sansFiche.statut, 404);
  assert.match(sansFiche.corps.erreur, /n’en crée pas/);
  assert.equal(ligne('SELECT 1 FROM materiau_arme WHERE ressource_id = ?', dm.element.id), null);
  assert.equal(appel('PATCH', m.adresse, { materiau: { pas_une_colonne: 1 } }).statut, 400);
  ok(appel('DELETE', m.adresse));

  // un événement et ses blocs de description : le bloc créé prend son rang (« <id>#<rang> » rendu par le service)
  const titre = `Événement de l’API v1 ${Date.now()}`;
  const e = ok(appel('POST', '/api/v1/evenements/', { epoque: 'inconnue', titre, description: 'Premier bloc.' }), 201);
  assert.equal(e.enfants.descriptions.length, 1);
  const blocs = `${e.adresse}descriptions/`;
  assert.equal(appel('POST', blocs, { evenement_id: 'autre', texte: 'x' }).statut, 400, 'le parent vient de l’adresse');
  const bloc = appel('POST', blocs, { texte: 'Second bloc.' });
  const db2 = ok(bloc, 201);
  assert.equal(bloc.entetes.Location, `${blocs}${db2.element.rang}/`);
  assert.deepEqual([db2.element.evenement_id, db2.element.texte, db2.parent.adresse], [e.element.id, 'Second bloc.', e.adresse]);
  assert.equal(ok(appel('PATCH', bloc.entetes.Location, { texte: 'Second bloc, revu.' })).element.texte, 'Second bloc, revu.');
  ok(appel('DELETE', bloc.entetes.Location));
  // le dernier bloc ne se supprime pas (409 du service), l'événement oui
  assert.equal(appel('DELETE', `${blocs}${e.enfants.descriptions[0].rang}/`).statut, 409);
  ok(appel('DELETE', e.adresse));
});

test('opérations du lot (registre `operations`, `actions`) : chaque traduction sert la table où le registre la pose ; chaque opération du lot est joignable', () => {
  for (const r of RESSOURCES) {
    for (const o of [r, ...(r.enfants ?? [])]) {
      for (const [m, op] of Object.entries(o.operations ?? {})) {
        assert.ok(TRADUCTIONS[op]?.[m], `${r.cle}/${o.cle} : ${m} → ${op} sans traduction`);
        assert.equal(TRADUCTIONS[op][m].table, o.table, `${r.cle}/${o.cle} : ${m} → ${op}`);
      }
    }
    for (const a of r.actions ?? []) assert.equal(TRADUCTIONS[a.op]?.ACTION?.table, r.table, `${r.cle}/${a.cle}`);
  }
  // le catalogue les dit : champs de création, de modification, action
  const c = ok(appel('GET', '/api/v1/'));
  const relations = c.ressources.find((r) => r.cle === 'relations-entre-peuples');
  assert.deepEqual(relations.capacites, { lire: true, creer: true, modifier: true, supprimer: true });
  assert.deepEqual([relations.creation.operation, relations.modification.operation, relations.suppression.operation], ['relations', 'relations', 'relations']);
  assert.deepEqual(relations.colonnes.filter((x) => x.modifiable).map((x) => x.nom), ['echelle_id']);
  assert.ok(relations.colonnes.find((x) => x.nom === 'echelle_id').champ.valeurs.some((v) => v.valeur === 'neutre'));
  assert.deepEqual(c.ressources.find((r) => r.cle === 'mots-cles').actions.map((a) => [a.cle, a.operation, a.champs.map((x) => x.nom).join()]), [['fusion', 'fusionner_mots_cles', 'dans']]);
});

test('opérations du lot : une race créée par l’API reçoit ses magies innées par la matrice (acces-aux-magies) ; une race que l’onglet limite, par sa liste', () => {
  const race = ok(appel('POST', '/api/v1/races/', { nom: nomLibre('Race de l’API v1', 'race', 'races'), nature: 'pure' }), 201);
  // comme le dit la description de « races » : son peuple du même nom et sa case « Même peuple »
  const peuple = ligne('SELECT * FROM peuple WHERE race_id = ?', race.element.id);
  assert.equal(peuple?.nom, race.element.nom);
  assert.equal(ligne('SELECT echelle_id FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id = ?', peuple.id, peuple.id)?.echelle_id, 'meme-peuple');
  const magie = ligne('SELECT id FROM magie ORDER BY ordre LIMIT 1').id;
  const caseDeLaMatrice = `${race.adresse}acces-aux-magies/${seg(magie)}/`;
  assert.equal(ok(appel('GET', caseDeLaMatrice)).element.accessible, 0);
  const p = ok(appel('PATCH', caseDeLaMatrice, { accessible: 1 }));
  assert.ok(p.lot);
  assert.equal(p.element.accessible, 1);
  assert.equal(ligne('SELECT accessible FROM race_magie WHERE race_id = ? AND magie_id = ?', race.element.id, magie).accessible, 1);
  assert.equal(ok(appel('PATCH', caseDeLaMatrice, { accessible: 1 })).lot, null, 'rien ne change : pas de lot');
  assert.equal(appel('PATCH', caseDeLaMatrice, { accessible: 2 }).statut, 400);
  assert.equal(appel('PATCH', caseDeLaMatrice, { valeur_brut: '1' }).statut, 400, 'seul « accessible »');
  // la liste de l'onglet ne s'ouvre pas pour elle : la matrice fait foi (R8)
  const refus = appel('POST', `${race.adresse}magies-innees-de-l-onglet/`, { magie_id: magie });
  assert.equal(refus.statut, 409);
  assert.match(refus.corps.erreur, /acces-aux-magies/);
  ok(appel('PATCH', caseDeLaMatrice, { accessible: 0 }));
  assert.equal(ligne('SELECT accessible FROM race_magie WHERE race_id = ? AND magie_id = ?', race.element.id, magie).accessible, 0);

  // une race dont l'onglet limite ses magies innées (R11) : une magie s'ajoute à la liste puis s'en retire ; la matrice refuse
  const raceOnglet = ligne('SELECT race_id FROM race_magie_onglet GROUP BY race_id ORDER BY race_id LIMIT 1').race_id;
  const avant = lignes('SELECT magie_id FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', raceOnglet).map((x) => x.magie_id);
  const autre = ligne(`SELECT id FROM magie WHERE id NOT IN (${avant.map(() => '?').join(',')}) ORDER BY ordre LIMIT 1`, ...avant).id;
  const liste = `/api/v1/races/${seg(raceOnglet)}/magies-innees-de-l-onglet/`;
  const ajout = appel('POST', liste, { magie_id: autre });
  ok(ajout, 201);
  assert.equal(ajout.entetes.Location, `${liste}${seg(autre)}/`);
  assert.deepEqual(lignes('SELECT magie_id FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', raceOnglet).map((x) => x.magie_id), [...avant, autre]);
  assert.equal(appel('POST', liste, { magie_id: autre }).statut, 409, 'déjà dans la liste');
  assert.equal(appel('PATCH', `/api/v1/races/${seg(raceOnglet)}/acces-aux-magies/${seg(autre)}/`, { accessible: 1 }).statut, 409, 'l’onglet limite : la matrice refuse');
  ok(appel('DELETE', ajout.entetes.Location));
  assert.deepEqual(lignes('SELECT magie_id FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', raceOnglet).map((x) => x.magie_id), avant);
  // ni modification d'une ligne de la liste : la raison dit comment elle s'écrit
  const patch = appel('PATCH', `${liste}${seg(avant[0])}/`, { rang: 9 });
  assert.equal(patch.statut, 405);
  assert.match(patch.corps.erreur, /POST par l’opération « magies_innees » du lot/);
});

test('opérations du lot : une case de la matrice des relations change de niveau, se retire et se repose ; la case « Même peuple » ne change pas', () => {
  const r = ligne('SELECT * FROM relation_peuple WHERE ligne_peuple_id <> colonne_peuple_id ORDER BY ligne_peuple_id, colonne_peuple_id LIMIT 1');
  const adresse = `/api/v1/relations-entre-peuples/${seg(r.ligne_peuple_id, r.colonne_peuple_id)}/`;
  const autre = ligne('SELECT id FROM echelle_relation WHERE id <> ? ORDER BY ordre LIMIT 1', r.echelle_id).id;
  const lu = appel('GET', adresse);
  const p = ok(appel('PATCH', adresse, { echelle_id: autre }, { 'if-match': lu.entetes.ETag }));
  assert.deepEqual([p.element.echelle_id, Boolean(p.lot)], [autre, true]);
  assert.equal(appel('PATCH', adresse, { echelle_id: r.echelle_id }, { 'if-match': lu.entetes.ETag }).statut, 409, 'If-Match périmé');
  assert.equal(appel('PATCH', adresse, { echelle_id: 'pas-un-niveau' }).statut, 400);
  assert.equal(appel('PATCH', adresse, { origine: 'x' }).statut, 400);
  const d = ok(appel('DELETE', adresse));
  assert.equal(d.supprime, seg(r.ligne_peuple_id, r.colonne_peuple_id));
  assert.equal(ligne('SELECT 1 FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id = ?', r.ligne_peuple_id, r.colonne_peuple_id), null);
  const cree = appel('POST', '/api/v1/relations-entre-peuples/', { ligne_peuple_id: r.ligne_peuple_id, colonne_peuple_id: r.colonne_peuple_id, echelle_id: r.echelle_id });
  ok(cree, 201);
  assert.equal(cree.entetes.Location, adresse);
  assert.equal(ligne('SELECT echelle_id FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id = ?', r.ligne_peuple_id, r.colonne_peuple_id).echelle_id, r.echelle_id);
  assert.equal(appel('POST', '/api/v1/relations-entre-peuples/', { ligne_peuple_id: r.ligne_peuple_id, colonne_peuple_id: r.colonne_peuple_id, echelle_id: r.echelle_id }).statut, 409);
  const diagonale = `/api/v1/relations-entre-peuples/${seg(r.ligne_peuple_id, r.ligne_peuple_id)}/`;
  if (ligne('SELECT 1 FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id = ?', r.ligne_peuple_id, r.ligne_peuple_id)) {
    assert.equal(appel('PATCH', diagonale, { echelle_id: autre }).statut, 400);
    assert.equal(appel('DELETE', diagonale).statut, 400);
  }
});

test('opérations du lot : une valeur propre d’une capacité de monstre (R69) se modifie, revient à la valeur commune (retirée), se repose ; les catégories d’un événement se posent et se retirent', () => {
  const v = ligne('SELECT * FROM monstre_capacite_valeur ORDER BY monstre_id, rang, numero LIMIT 1');
  const valeurs = `/api/v1/monstres/${seg(v.monstre_id)}/valeurs-de-capacites/`;
  const adresse = `${valeurs}${v.rang},${v.numero}/`;
  assert.equal(ok(appel('PATCH', adresse, { valeur: v.valeur + 1 })).element.valeur, v.valeur + 1);
  const commune = appel('PATCH', adresse, { valeur: null });
  assert.deepEqual([commune.statut, commune.corps.element, Boolean(commune.corps.lot)], [200, null, true], 'null : la carte suit de nouveau la valeur commune');
  assert.equal(ligne('SELECT 1 FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ? AND numero = ?', v.monstre_id, v.rang, v.numero), null);
  assert.equal(appel('GET', adresse).statut, 404);
  const repose = appel('POST', valeurs, { rang: v.rang, numero: v.numero, valeur: v.valeur });
  ok(repose, 201);
  assert.equal(repose.entetes.Location, adresse);
  assert.equal(appel('POST', valeurs, { rang: v.rang, numero: v.numero, valeur: v.valeur }).statut, 409);
  assert.equal(appel('POST', valeurs, { rang: v.rang, numero: 99, valeur: 1 }).statut, 400, 'pas d’emplacement 99');
  ok(appel('DELETE', adresse));
  ok(appel('POST', valeurs, { rang: v.rang, numero: v.numero, valeur: v.valeur }), 201);
  assert.equal(ligne('SELECT valeur FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ? AND numero = ?', v.monstre_id, v.rang, v.numero).valeur, v.valeur);

  const e = ok(appel('POST', '/api/v1/evenements/', { epoque: 'inconnue', titre: `Événement catégorisé ${Date.now()}`, description: 'Bloc.' }), 201);
  const cat = ok(appel('POST', '/api/v1/categories-de-chronologie/', { libelle: `Catégorie de l’API ${Date.now()}` }), 201);
  const pose = appel('POST', `${e.adresse}categories/`, { categorie_id: cat.element.id });
  ok(pose, 201);
  assert.equal(pose.entetes.Location, `${e.adresse}categories/${seg(cat.element.id)}/`);
  assert.deepEqual(ok(appel('GET', e.adresse)).enfants.categories.map((x) => x.categorie_id), [cat.element.id]);
  assert.equal(appel('POST', `${e.adresse}categories/`, { categorie_id: cat.element.id }).statut, 409);
  assert.equal(appel('POST', `${e.adresse}categories/`, { categorie_id: 'pas-une-categorie' }).statut, 400);
  ok(appel('DELETE', pose.entetes.Location));
  assert.deepEqual(ok(appel('GET', e.adresse)).enfants.categories, []);
  ok(appel('DELETE', e.adresse));
  ok(appel('DELETE', cat.adresse));
});

test('action « fusion » d’un mot-clé : le renommage vers l’écriture d’un autre dit l’action (409), qui verse ses pages dans l’autre et le retire', () => {
  const a = ok(appel('POST', '/api/v1/mots-cles/', { libelle: `Mot-clé A de l’API ${Date.now()}` }), 201);
  const b = ok(appel('POST', '/api/v1/mots-cles/', { libelle: `Mot-clé B de l’API ${Date.now()}` }), 201);
  const refus = appel('PATCH', a.adresse, { libelle: b.element.libelle });
  assert.equal(refus.statut, 409);
  assert.deepEqual(refus.corps.action, { methode: 'POST', adresse: `${a.adresse}fusion/`, corps: { dans: b.element.id } });
  assert.deepEqual([appel('GET', refus.corps.action.adresse).statut, appel('GET', refus.corps.action.adresse).entetes.Allow], [405, 'POST']);
  assert.equal(appel('POST', `${a.adresse}fusion/x/`, {}).statut, 404);
  assert.equal(appel('POST', refus.corps.action.adresse, { dans: b.element.id, autre: 1 }).statut, 400);
  assert.equal(appel('POST', refus.corps.action.adresse, {}).statut, 400, '« dans » manquant');
  const f = ok(appel('POST', refus.corps.action.adresse, refus.corps.action.corps));
  assert.deepEqual([f.action, f.element.cle, f.element.existe, Boolean(f.lot)], ['fusion', a.cle, false, true]);
  assert.equal(appel('GET', a.adresse).statut, 404);
  assert.equal(appel('POST', refus.corps.action.adresse, refus.corps.action.corps).statut, 404, 'le mot-clé fusionné n’existe plus');
  ok(appel('DELETE', b.adresse));
});

test('colonnes figées (registre `colonnesFigees`, `champsFiges`) : ce que la page Composants ne montre pas, ou que le service refuse toujours, n’est ni annoncé modifiable ni accepté', () => {
  const c = ok(appel('GET', '/api/v1/'));
  const colonne = (r, nom) => c.ressources.find((x) => x.cle === r).colonnes.find((x) => x.nom === nom);
  assert.equal(colonne('gemmes', 'prix_brut').modifiable, false, 'le prix d’une gemme est dans son extension');
  assert.equal(colonne('gemmes', 'description').modifiable, true);
  assert.deepEqual(['prix_brut', 'description'].map((n) => colonne('ingredients-d-alchimie', n).modifiable), [false, false]);
  assert.deepEqual(colonne('objets', 'description').figee, { raison: 'un produit non monétaire n’a pas de description sur la page Composants (seul le matériel en a une)', si: { genre: ['produit'] } });
  const spec = ok(appel('GET', '/api/v1/openapi.json'));
  assert.ok(!('prix_brut' in spec.paths['/v1/gemmes/{cle}/'].patch.requestBody.content['application/json'].schema.properties));
  assert.match(spec.paths['/v1/objets/{cle}/'].patch.requestBody.content['application/json'].schema.properties.description.description, /refusé si genre = produit/);

  const gemme = ok(appel('GET', '/api/v1/gemmes/?limite=1')).elements[0];
  const refusGemme = appel('PATCH', gemme.adresse, { prix_brut: '3 RO' });
  assert.equal(refusGemme.statut, 400);
  assert.match(refusGemme.corps.erreur, /extension gemme/);
  const ingredient = ok(appel('GET', '/api/v1/ingredients-d-alchimie/?limite=1')).elements[0];
  const avant = ligne('SELECT prix_brut, description FROM ressource WHERE id = ?', ingredient.id);
  for (const corps of [{ prix_brut: '3 RO' }, { description: 'Invisible' }]) assert.equal(appel('PATCH', ingredient.adresse, corps).statut, 400, JSON.stringify(corps));
  assert.deepEqual(ligne('SELECT prix_brut, description FROM ressource WHERE id = ?', ingredient.id), avant, 'rien d’écrit');
  // un produit : pas de description ; le matériel, si
  const produit = ligne("SELECT id, description FROM ressource WHERE genre = 'produit' ORDER BY id LIMIT 1");
  assert.equal(appel('PATCH', `/api/v1/objets/${seg(produit.id)}/`, { description: 'Invisible' }).statut, 400);
  const materiel = ligne("SELECT id, description FROM ressource WHERE genre = 'materiel' ORDER BY id LIMIT 1");
  assert.equal(ok(appel('PATCH', `/api/v1/objets/${seg(materiel.id)}/`, { description: 'Un matériel décrit.' })).element.description, 'Un matériel décrit.');
  ok(appel('PATCH', `/api/v1/objets/${seg(materiel.id)}/`, { description: materiel.description }));
  const nom = nomLibre('Produit de l’API v1', 'ressource');
  const refusProduit = appel('POST', '/api/v1/objets/', { tableau: 'produit:ANIMAUX', nom, prix_brut: '1 RO', description: 'Invisible' });
  assert.equal(refusProduit.statut, 400);
  assert.match(refusProduit.corps.erreur, /^« description » ne se donne pas ici : un produit non monétaire/);
  const cree = ok(appel('POST', '/api/v1/objets/', { tableau: 'produit:ANIMAUX', nom, prix_brut: '1 RO' }), 201);
  ok(appel('DELETE', cree.adresse));
});

test('écritures : tout passe par le journal de l’édition (en attente, journal exporté) et par le journal du service, catégorie edition', () => {
  const nom = nomLibre('Métier journalisé', 'metier', 'metiers');
  const cree = ok(appel('POST', '/api/v1/metiers/', { nom }), 201);
  const avant = journal.length;
  const p = ok(appel('PATCH', cree.adresse, { avantage_brut: 'Un avantage d’essai.' }));
  const attente = ok(appel('GET', '/api/edition/en-attente/')).lignes;
  assert.ok(attente.some((l) => l.table === 'metier' && l.cle.id === cree.element.id && l.ligne?.avantage_brut === 'Un avantage d’essai.'));
  const lots = ok(appel('GET', '/api/edition/journal/')).lots;
  const lot = lots.find((l) => l.id === p.lot);
  assert.equal(lot.page_id, 'api/v1/metiers');
  const notes = journal.slice(avant);
  assert.deepEqual(notes.map((n) => n.o), [{ categorie: 'edition' }]);
  assert.match(notes[0].l, new RegExp(`^api v1 : PATCH ${cree.adresse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} → lot ${p.lot}`));
  ok(appel('DELETE', cree.adresse));
});

test('R42 : supprimer par l’API un métier et un don qu’un prétiré utilise les retire de la fiche (note datée) et le dit dans `fiches` ; le journal du service n’a que leur nombre', () => {
  const metier = ok(appel('POST', '/api/v1/metiers/', { nom: nomLibre('Métier retiré par l’API', 'metier', 'metiers') }), 201);
  const classe = ok(appel('POST', '/api/v1/classes/', { categorie_id: 'classe-physique-corps-a-corps', nom: nomLibre('Classe de l’API v1', 'classe', 'classes') }), 201);
  const spec = ok(appel('POST', '/api/v1/specialites/', { classe_id: classe.element.id, nom: 'VOIE DE L’API', don_nom: 'Voie de l’API', don_type: 'Passif' }), 201);
  const don = ok(appel('POST', '/api/v1/dons-de-classe/', { classe_id: classe.element.id, specialite_id: spec.element.id, niveau: '15', nom: 'Don retiré par l’API', type: 'Passif' }), 201);
  ok(appel('POST', '/api/v1/dons-de-classe/', { classe_id: classe.element.id, specialite_id: spec.element.id, avec: don.element.id, nom: 'Don voisin de l’API', type: 'Passif' }), 201);
  const nomFiche = `Témoin de l’API v1 ${Date.now()}`;
  const fiche = ok(appel('POST', '/api/personnages/', {
    ...ficheVide(nomFiche), metier_id: metier.element.id,
    classes: [{ rang: 1, classe_id: classe.element.id, specialite_id: spec.element.id }], capacites: [{ capacite_id: don.element.id }],
  }), 201).personnage;

  const avant = journal.length;
  const r1 = ok(appel('DELETE', metier.adresse));
  assert.deepEqual(r1.fiches.map((f) => f.fiche), [nomFiche]);
  assert.match(r1.fiches[0].retraits.join(' '), /métier/);
  const r2 = ok(appel('DELETE', don.adresse));
  assert.deepEqual(r2.fiches.map((f) => f.fiche), [nomFiche]);
  const relue = ok(appel('GET', `/api/personnages/${fiche.id}/`)).personnage;
  assert.equal(relue.metier_id, null);
  assert.ok(!relue.capacites.some((c) => c.capacite_id === don.element.id));
  assert.equal((relue.notes.match(/Retrait \(règles modifiées\)/g) ?? []).length, 2, relue.notes);
  // le journal du service : un compte, jamais le nom de la fiche
  const notes = journal.slice(avant).map((n) => n.l);
  assert.equal(notes.length, 2);
  for (const n of notes) {
    assert.match(n, /1 fiche\(s\) de personnage adaptée\(s\)$/);
    assert.ok(!n.includes(nomFiche));
  }
});

test('jamais une image entière : un portrait écrit par l’API n’est rendu que résumé (empreinte), ni dans le détail, ni dans la réponse, ni dans une liste', () => {
  const monstre = ok(appel('GET', '/api/v1/monstres/?limite=1')).elements[0];
  const avant = ligne('SELECT portrait, portrait_x, portrait_y, portrait_zoom FROM monstre WHERE id = ?', monstre.id);
  const p = ok(appel('PATCH', monstre.adresse, { portrait: IMAGES.webp, portrait_x: 0.5 }));
  assert.equal(p.element.portrait.image, true);
  assert.match(p.element.portrait.empreinte, /^[0-9a-f]+$/);
  const base64 = IMAGES.webp.slice(IMAGES.webp.indexOf(',') + 1, IMAGES.webp.indexOf(',') + 41);
  for (const r of [p, ok(appel('GET', monstre.adresse)), ok(appel('GET', `/api/v1/monstres/?id=${encodeURIComponent(monstre.id)}`)),
    ok(appel('GET', `/api/v1/especes-de-monstres/${seg(ligne('SELECT espece_id FROM monstre WHERE id = ?', monstre.id).espece_id)}/`))]) {
    assert.ok(!JSON.stringify(r).includes(base64), 'une image entière dans la réponse');
  }
  assert.equal(ligne('SELECT portrait FROM monstre WHERE id = ?', monstre.id).portrait, IMAGES.webp, 'l’image entière est dans la base');
  // remise en l'état (l'empreinte comparée par If-Match)
  ok(appel('PATCH', monstre.adresse, { portrait: avant.portrait, portrait_x: avant.portrait_x }, { 'if-match': `"${p.version}"` }));
});

test('GET /api/debug/journal/ : site de dev seulement, filtres de journal-du-service.mjs#lire, une seule adresse', () => {
  const memoire = creerJournalDuService({ sortie: null });
  memoire.ecrire('base des règles changée');
  memoire.ecrire('GET /api/v1/metiers/ 200 3 ms', { categorie: 'http' });
  memoire.ecrire('ERREUR base vivante : essai');
  const s = { ...service, journalDuService: memoire };
  assert.equal(appel('GET', '/api/debug/journal/', undefined, {}, { ...s, edition: false }).statut, 403);
  assert.equal(appel('GET', '/api/debug/autre/', undefined, {}, s).statut, 404);
  assert.equal(appel('GET', '/api/debug/journal/x/', undefined, {}, s).statut, 404);
  assert.equal(appel('POST', '/api/debug/journal/', {}, {}, s).statut, 405);
  assert.equal(appel('GET', '/api/debug/journal/', undefined, {}, service).statut, 503, 'sans journal en mémoire');
  const tout = ok(appel('GET', '/api/debug/journal/', undefined, {}, s));
  assert.deepEqual([tout.entrees.length, tout.dernier, tout.perdues], [3, 3, 0]);
  assert.deepEqual(ok(appel('GET', '/api/debug/journal/?categorie=http', undefined, {}, s)).entrees.map((e) => e.n), [2]);
  assert.deepEqual(ok(appel('GET', '/api/debug/journal/?niveau=erreur&niveau=info', undefined, {}, s)).entrees.map((e) => e.n), [1, 2, 3]);
  assert.deepEqual(ok(appel('GET', '/api/debug/journal/?depuis=2', undefined, {}, s)).entrees.map((e) => e.n), [3]);
  assert.deepEqual(ok(traiter({ methode: 'GET', chemin: '/api/debug/journal/', recherche: '?q=VIVANTE', entetes: {} }, s)).entrees.map((e) => e.n), [3]);
});

test('serveur HTTP : la chaîne de requête arrive, chaque requête /api/ est notée (catégorie http) et relisible par /api/debug/journal/, sans les relèves ; un identifiant avec « / » et « # » encodé est relu', async () => {
  const dossier = join(racine, 'instance-http');
  const regles = join(racine, 'regles-http.db');
  copyFileSync(REGLES, regles);
  const lignesNotees = [];
  const s = await demarrerService({ regles, dossier, port: 0, intervalle: 0, edition: true, journal: (l) => lignesNotees.push(l) });
  try {
    const metier = ligne('SELECT id, nom FROM metier ORDER BY id LIMIT 1');
    const mot = normalize(metier.nom).split('-')[0];
    let r = await fetch(`${s.url}/api/v1/metiers/?q=${mot}&limite=1`);
    assert.equal(r.status, 200);
    const liste = await r.json();
    assert.equal(liste.limite, 1, 'la chaîne de requête est arrivée');
    assert.ok(liste.total >= 1);
    // un sort : « magies/<magie>#sort:<nom> », encodé (%2F, %23, %3A) dans l'adresse
    const sort = ligne("SELECT id, nom FROM sort WHERE id LIKE '%#%' ORDER BY id LIMIT 1");
    r = await fetch(`${s.url}/api/v1/sorts/${encodeURIComponent(sort.id)}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('etag'), /^"[0-9a-f]{16}"$/);
    const d = await r.json();
    assert.deepEqual([d.element.id, d.cle, d.adresse], [sort.id, encodeURIComponent(sort.id), `/api/v1/sorts/${encodeURIComponent(sort.id)}/`]);
    r = await fetch(`${s.url}${d.adresse}`, { headers: { 'If-None-Match': `"${d.version}"` } });
    assert.equal(r.status, 304);
    // le journal : chaque requête /api/ (méthode, adresse et sa requête, statut, durée), pas les relèves du journal
    for (let i = 0; i < 2; i += 1) assert.equal((await fetch(`${s.url}/api/debug/journal/?categorie=http`)).status, 200);
    const j = await (await fetch(`${s.url}/api/debug/journal/?categorie=http`)).json();
    const messages = j.entrees.map((e) => e.message);
    assert.ok(messages.some((m) => new RegExp(`^GET /api/v1/metiers/\\?q=${mot}&limite=1 200 \\d+ ms$`).test(m)), messages.join('\n'));
    assert.ok(messages.some((m) => m.startsWith(`GET /api/v1/sorts/${encodeURIComponent(sort.id)}/ 304 `)), messages.join('\n'));
    assert.ok(!messages.some((m) => m.includes('/api/debug/journal')), 'les relèves du journal ne sont pas notées');
    assert.ok(j.entrees.every((e) => e.categorie === 'http'));
    assert.ok(lignesNotees.some((l) => l.startsWith('GET /api/v1/metiers/?q=')), 'l’écouteur reçoit aussi la ligne');
    // une écriture par HTTP : notée en http et en edition
    const nom = nomLibre('Métier HTTP de l’API v1', 'metier', 'metiers');
    r = await fetch(`${s.url}/api/v1/metiers/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom }) });
    assert.equal(r.status, 201);
    const adresse = r.headers.get('location');
    assert.equal((await (await fetch(`${s.url}${adresse}`)).json()).element.nom, nom);
    r = await fetch(`${s.url}${adresse}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    assert.equal(r.status, 200);
    const edition = (await (await fetch(`${s.url}/api/debug/journal/?categorie=edition`)).json()).entrees.map((e) => e.message);
    assert.ok(edition.some((m) => m.startsWith(`api v1 : POST /api/v1/metiers/ → lot `)), edition.join('\n'));
    assert.ok(edition.some((m) => m.startsWith(`api v1 : DELETE ${adresse} → lot `)), edition.join('\n'));
  } finally {
    await s.arreter();
  }
});

test('serveur HTTP en production (sans édition) : /api/v1/ et /api/debug/journal/ répondent 403 ; ni mémoire du journal ni une ligne par requête réussie ou refusée', async () => {
  const dossier = join(racine, 'instance-prod');
  const regles = join(racine, 'regles-prod.db');
  copyFileSync(REGLES, regles);
  const notees = [];
  const s = await demarrerService({ regles, dossier, port: 0, intervalle: 0, edition: false, journal: (l) => notees.push(l) });
  try {
    assert.equal(s.journalDuService, null, 'pas de mémoire : la page Debug ne peut pas la lire en production');
    const auDemarrage = notees.length;
    assert.ok(notees.some((l) => l.startsWith('service des personnages ')), 'les événements du service restent notés');
    for (const c of ['/api/v1/', '/api/v1/openapi.json', '/api/v1/metiers/?q=a', '/api/debug/journal/']) assert.equal((await fetch(`${s.url}${c}`)).status, 403, c);
    const r = await fetch(`${s.url}/api/v1/metiers/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"nom":"x"}' });
    assert.equal(r.status, 403);
    assert.equal(ligne("SELECT 1 FROM metier WHERE nom = 'x'"), null);
    assert.equal((await fetch(`${s.url}/api/etat/`)).status, 200);
    for (let i = 0; i < 3; i += 1) assert.equal((await fetch(`${s.url}/api/personnages/`)).status, 200);
    assert.equal((await fetch(`${s.url}/api/personnages/inconnu/`)).status, 404);
    assert.deepEqual(notees.slice(auDemarrage), [], 'aucune ligne par requête (docker logs sans rotation)');
  } finally {
    await s.arreter();
  }
});

test('segment de clé : chaque valeur encodée, jointes par « , »', () => {
  assert.equal(segmentDeCle({ id: 'magies/magie-du-feu#sort:boule-de-feu' }, ['id']), 'magies%2Fmagie-du-feu%23sort%3Aboule-de-feu');
  assert.equal(segmentDeCle({ a: 'x,y', b: 2 }, ['a', 'b']), 'x%2Cy,2');
});

test('DELETE d’un métier ou d’une arme qui a des écarts entre sources : ses traces (note_cellule, ecart_source) partent avec lui, dans le journal', () => {
  const orphelines = () => lignes(`SELECT entite_table, entite_id FROM ecart_source e WHERE (entite_table = 'metier' AND NOT EXISTS (SELECT 1 FROM metier WHERE id = e.entite_id))
    OR (entite_table = 'arme' AND NOT EXISTS (SELECT 1 FROM arme WHERE id = e.entite_id))
    UNION ALL SELECT entite_table, entite_id FROM note_cellule n WHERE (entite_table = 'metier' AND NOT EXISTS (SELECT 1 FROM metier WHERE id = n.entite_id))
    OR (entite_table = 'arme' AND NOT EXISTS (SELECT 1 FROM arme WHERE id = n.entite_id))`);
  assert.deepEqual(orphelines(), []);
  const metier = ligne("SELECT entite_id AS id FROM ecart_source WHERE entite_table = 'metier' ORDER BY entite_id LIMIT 1");
  const arme = ligne("SELECT entite_id AS id FROM ecart_source WHERE entite_table = 'arme' ORDER BY entite_id LIMIT 1");
  assert.ok(metier && arme, 'la base a des écarts sur un métier et sur une arme');
  for (const [res, id] of [['metiers', metier.id], ['armes', arme.id]]) {
    const r = ok(appel('DELETE', `/api/v1/${res}/${seg(id)}/`, {}));
    assert.ok(r, `${res} supprimé`);
  }
  assert.deepEqual(orphelines(), [], 'aucune trace orpheline');
  const notees = lignes("SELECT DISTINCT table_nom FROM modification WHERE table_nom IN ('ecart_source', 'note_cellule') AND operation = 'supprimer'").map((l) => l.table_nom);
  assert.ok(notees.includes('ecart_source'), 'les retraits de traces sont dans le journal (ils voyagent jusqu’à data/rows)');
});

test('R159 : /api/v1/familles-d-armes/ — une famille se crée (catégorie fixée) et se renomme par le service d’édition ; ARME DE MONSTRES est figée (R45), un nom pris refusé (409)', () => {
  const nom = nomLibre(`Fléaux d’API ${process.pid}`, 'arme_famille');
  const cree = ok(appel('POST', '/api/v1/familles-d-armes/', { nom, de_brut: 'D8', categorie: 'contact', cout_libelle: 'Coût' }), 201);
  const id = cree.element?.id ?? cree.id;
  assert.ok(id, JSON.stringify(cree).slice(0, 300));
  assert.deepEqual(['nom', 'nom_lecture', 'categorie', 'maitrisable'].map((c) => ligne('SELECT * FROM arme_famille WHERE id = ?', id)[c]), [nom, nom, 'contact', 1]);
  ok(appel('PATCH', `/api/v1/familles-d-armes/${seg(id)}/`, { nom: `${nom} renommée`, de_brut: 'D10' }));
  assert.deepEqual(['nom', 'nom_lecture', 'libelle_brut'].map((c) => ligne('SELECT * FROM arme_famille WHERE id = ?', id)[c]), [`${nom} renommée`, nom, `${nom} renommée - D10`]);
  assert.equal(appel('PATCH', `/api/v1/familles-d-armes/${seg(id)}/`, { categorie: 'distance' }).statut, 400, 'la catégorie ne change pas');
  assert.equal(appel('PATCH', `/api/v1/familles-d-armes/${seg(id)}/`, { nom: 'Dague' }).statut, 409);
  const monstres = appel('PATCH', '/api/v1/familles-d-armes/arme-de-monstres/', { nom: 'X' });
  assert.ok([400, 409].includes(monstres.statut), JSON.stringify(monstres.corps));
  assert.equal(ligne("SELECT nom FROM arme_famille WHERE id = 'arme-de-monstres'").nom, 'ARME DE MONSTRES');
  assert.equal(appel('DELETE', `/api/v1/familles-d-armes/${seg(id)}/`, {}).statut, 405, 'aucune famille ne se supprime');
});
