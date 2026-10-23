// Décision R160 du propriétaire (2026-10-23, docs/decisions-regles.md) : « Il n'existe aucune gemme ni aucune piece élémentaire du PI » ; « Il ne sera
// pas possible de rajouter de gemmes du PI directement » ; étendue au bois (« Oui, aucun bois du PI »). Les deux garde-fous côté service :
//   - « Le site de dev ne le propose pas » : les listes `magiesSansGemme` et `magiesSansBois` de GET /api/edition/listes/ (formulaires « Nouvelle gemme »,
//     « Nouveau bois ») et les valeurs du champ `magie_id` de l'API v1 n'ont jamais le Potentiel Illimité ; il reste dans la liste `magies` générale ;
//     aucune autre voie n'écrit la magie d'une gemme, d'un bois, d'un bâton magique ou d'une pièce élémentaire ;
//   - « La base refuse » : le service refuse avant d'écrire (422, message R160), par /api/edition/ comme par /api/v1/, et traduit l'erreur de la base
//     (contrainte `<table>_sans_potentiel_illimite`, migration 0078) par le même message ; les autres CHECK gardent le message générique.
// La seule liste : lib/edition-modele.mjs#MAGIES_SANS_OBJET_PAR_MAGIE, OBJETS_PAR_MAGIE (comparées au schéma ci-dessous). Les écritures se font dans
// une base vivante d'essai (copie), jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { messageSqlite } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import {
  contrainteR160, ENTITES, MAGIES_SANS_OBJET_PAR_MAGIE, OBJETS_PAR_MAGIE, REFUS_R160, TABLES,
} from '../src/lib/edition-modele.mjs';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';
import { RESSOURCES, tablesDe } from '../src/lib/ressources.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { operationsDe } from './aide-openapi.mjs';

const PI = POTENTIEL_ILLIMITE;
const racine = dossierTemporaire('edition-r160');
const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') }).chemin);
after(() => db.close());
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin, corps) =>
  traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
const enregistrer = (operations) => appel('POST', '/api/edition/', { page: 'ressources/composants/', operations });
const compter = (table) => db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
const schema = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');

test('R160 : la liste des magies sans objet par magie est celle des contraintes de la base (data/schema.sql et base vivante), sans copie', () => {
  assert.deepEqual([...MAGIES_SANS_OBJET_PAR_MAGIE], [PI]);
  assert.ok(db.prepare('SELECT 1 FROM magie WHERE id = ?').get(PI), 'le Potentiel Illimité est une magie de la base');
  for (const table of OBJETS_PAR_MAGIE) {
    for (const magie of MAGIES_SANS_OBJET_PAR_MAGIE) {
      const clause = `CONSTRAINT ${contrainteR160(table)} CHECK (magie_id <> '${magie}')`;
      assert.ok(schema.includes(clause), `data/schema.sql : ${clause}`);
      assert.ok(db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table).sql.includes(clause), `base vivante : ${table}`);
    }
  }
  // et aucune autre table : une contrainte R160 ajoutée au schéma l'est aussi à OBJETS_PAR_MAGIE (son refus serait sinon le message générique)
  const tablesDuSchema = [...schema.matchAll(/CONSTRAINT (\w+)_sans_potentiel_illimite CHECK/g)].map((m) => m[1]).sort();
  assert.deepEqual(tablesDuSchema, [...OBJETS_PAR_MAGIE].sort());
});

test('R160 : le formulaire ne propose pas le Potentiel Illimité (magiesSansGemme, magiesSansBois) ; il reste dans la liste « magies »', () => {
  const r = appel('GET', '/api/edition/listes/');
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const listes = r.corps;
  assert.ok(listes.magies.some((m) => m.id === PI), 'la liste « magies » générale garde le Potentiel Illimité');
  // les champs « magie » des formulaires de création d'une gemme et d'un bois lisent ces deux listes, et elles seules
  assert.equal(ENTITES.gemme.champs.magie_id.liste, 'magiesSansGemme');
  assert.equal(ENTITES.bois.champs.magie_id.liste, 'magiesSansBois');
  for (const [liste, table] of [['magiesSansGemme', 'gemme'], ['magiesSansBois', 'bois']]) {
    const valeurs = listes[liste].map((m) => m.valeur);
    for (const magie of MAGIES_SANS_OBJET_PAR_MAGIE) assert.ok(!valeurs.includes(magie), `${liste} : ${magie}`);
    // et les autres magies sans cet objet y sont toutes, dans l'ordre des magies
    const attendues = db.prepare(`SELECT m.id FROM magie m WHERE NOT EXISTS (SELECT 1 FROM "${table}" o WHERE o.magie_id = m.id) ORDER BY m.ordre`).all()
      .map((m) => m.id).filter((id) => !MAGIES_SANS_OBJET_PAR_MAGIE.includes(id));
    assert.deepEqual(valeurs, attendues, liste);
  }
});

test('R160 : aucune autre voie du site de dev n’écrit la magie d’une gemme, d’un bois, d’un bâton magique ou d’une pièce élémentaire', () => {
  for (const table of OBJETS_PAR_MAGIE) {
    assert.equal(TABLES[table]?.colonnes?.magie_id, undefined, `${table}.magie_id ne se modifie pas`);
    const entites = Object.entries(ENTITES).filter(([, e]) => e.table === table);
    // seules la gemme et le bois se créent, par les deux listes ci-dessus ; ni bâton ni pièce élémentaire ne se créent
    assert.deepEqual(entites.map(([nom]) => nom), ['gemme', 'bois'].includes(table) ? [table] : [], table);
    for (const [, e] of entites) assert.ok(['magiesSansGemme', 'magiesSansBois'].includes(e.champs.magie_id.liste), table);
  }
  // une modification de magie_id par /api/edition/ : refusée (colonne hors du modèle), rien d'écrit
  const gemme = db.prepare('SELECT ressource_id FROM gemme ORDER BY ressource_id LIMIT 1').get();
  const r = enregistrer([{ op: 'modifier', table: 'gemme', cle: { ressource_id: gemme.ressource_id }, valeurs: { magie_id: PI } }]);
  assert.equal(r.statut, 400, JSON.stringify(r.corps));
  assert.equal(db.prepare('SELECT count(*) AS n FROM gemme WHERE magie_id = ?').get(PI).n, 0);
});

test('R160 : le service refuse une gemme ou un bois du Potentiel Illimité (422, message R160), rien n’est écrit', () => {
  const avant = { ressource: compter('ressource'), gemme: compter('gemme'), bois: compter('bois') };
  for (const [entite, valeurs] of [
    ['gemme', { magie_id: PI, nom: `Gemme du PI ${process.pid}`, prix_commune_brut: '20 RO' }],
    ['bois', { magie_id: PI, nom: `Bois du PI ${process.pid}`, prix_brut: '10 RO' }],
  ]) {
    const r = enregistrer([{ op: 'creer', entite, valeurs }]);
    assert.equal(r.statut, 422, `${entite} : ${JSON.stringify(r.corps)}`);
    assert.equal(r.corps.erreur, `operations[0] : ${REFUS_R160}`, entite);
  }
  assert.deepEqual({ ressource: compter('ressource'), gemme: compter('gemme'), bois: compter('bois') }, avant);
});

test('R160 : /api/v1/ aussi — POST gemmes et bois du Potentiel Illimité en 422 ; bâtons et pièces élémentaires en lecture seule (405)', () => {
  for (const [adresse, corps] of [
    ['/api/v1/gemmes/', { magie_id: PI, nom: `Gemme du PI v1 ${process.pid}` }],
    ['/api/v1/bois/', { magie_id: PI, nom: `Bois du PI v1 ${process.pid}` }],
  ]) {
    const r = appel('POST', adresse, corps);
    assert.equal(r.statut, 422, `${adresse} : ${JSON.stringify(r.corps)}`);
    assert.equal(r.corps.erreur, REFUS_R160, adresse);
  }
  // les ressources des trois autres tables : ni création ni modification (le service d'édition ne les écrit pas)
  const autres = RESSOURCES.filter((r) => tablesDe(r).some((t) => ['baton_magique', 'arme_elementaire', 'armure_elementaire'].includes(t)));
  assert.deepEqual(autres.map((r) => r.cle).sort(), ['armes-elementaires', 'armures-elementaires', 'batons-magiques']);
  for (const r of autres) {
    assert.equal(appel('POST', `/api/v1/${r.cle}/`, { magie_id: PI }).statut, 405, `POST ${r.cle}`);
    const element = appel('GET', `/api/v1/${r.cle}/?limite=1`).corps.elements[0];
    assert.equal(appel('PATCH', element.adresse, { magie_id: PI }).statut, 405, `PATCH ${r.cle}`);
  }
  for (const table of OBJETS_PAR_MAGIE) assert.equal(db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE magie_id = ?`).get(PI).n, 0, table);
});

test('R160 : la description OpenAPI ne propose jamais le Potentiel Illimité pour créer une gemme ou un bois (valeurs, exemple)', () => {
  const spec = appel('GET', '/api/v1/openapi.json').corps;
  const operations = operationsDe(spec);
  const catalogue = appel('GET', '/api/v1/').corps;
  for (const cle of ['gemmes', 'bois']) {
    const champ = catalogue.ressources.find((r) => r.cle === cle).creation.champs.find((c) => c.nom === 'magie_id');
    assert.ok(!(champ.valeurs ?? []).some((v) => v.valeur === PI), `${cle} : valeurs du champ magie_id`);
    const op = operations.find((o) => o.id === `creer_${cle}`);
    const schemaMagie = spec.paths[`/v1/${cle}/`].post.requestBody.content['application/json'].schema.properties.magie_id;
    assert.ok(!(schemaMagie.enum ?? []).includes(PI), `${cle} : enum`);
    if (op.corps.exemple) {
      // un exemple : une magie qui n'a pas encore cet objet, jamais le Potentiel Illimité (le test des exemples de serveur-api-v1 l'envoie tel quel)
      const magie = JSON.parse(op.corps.exemple).magie_id;
      assert.notEqual(magie, PI, cle);
      assert.ok(champ.valeurs.some((v) => v.valeur === magie), cle);
    } else {
      // aucune magie libre (chacune a sa gemme et son bois, le Potentiel Illimité n'en a jamais) : pas d'exemple, et la description dit pourquoi
      assert.deepEqual(champ.valeurs ?? [], [], cle);
      assert.match(op.corps.description, /pas de corps d’exemple : « magie_id » n’a aucune valeur possible pour l’instant/, cle);
    }
  }
});

test('R160 : l’erreur de la base (dernier rempart) est traduite par le message R160 ; les autres CHECK gardent le message générique', () => {
  const cles = { gemme: 'ressource_id', bois: 'ressource_id', baton_magique: 'id', arme_elementaire: 'id', armure_elementaire: 'id' };
  assert.deepEqual(Object.keys(cles).sort(), [...OBJETS_PAR_MAGIE].sort());
  db.exec('SAVEPOINT r160');
  try {
    for (const table of OBJETS_PAR_MAGIE) {
      const cle = db.prepare(`SELECT "${cles[table]}" AS v FROM "${table}" ORDER BY 1 LIMIT 1`).get().v;
      let erreur = null;
      try {
        db.prepare(`UPDATE "${table}" SET magie_id = ? WHERE "${cles[table]}" = ?`).run(PI, cle);
      } catch (e) {
        erreur = e;
      }
      assert.ok(erreur, `${table} : la base refuse`);
      assert.equal(erreur.message, `CHECK constraint failed: ${contrainteR160(table)}`, table);
      assert.equal(messageSqlite(erreur), REFUS_R160, table);
    }
    // une autre contrainte CHECK : le message générique, inchangé
    let autre = null;
    try {
      db.prepare('UPDATE gemme SET prix_commune_rf = -1 WHERE ressource_id = (SELECT min(ressource_id) FROM gemme)').run();
    } catch (e) {
      autre = e;
    }
    assert.ok(autre);
    assert.match(messageSqlite(autre), /^valeur refusée par une règle de la base \(/);
    assert.notEqual(messageSqlite(autre), REFUS_R160);
    assert.equal(messageSqlite(new Error('CHECK constraint failed: autre_sans_potentiel_illimite')), 'valeur refusée par une règle de la base (autre_sans_potentiel_illimite)');
    // un message déjà traduit se relit tel quel (edition-conflits.mjs#messageLisible relit les messages notés)
    assert.equal(messageSqlite(REFUS_R160), REFUS_R160);
  } finally {
    db.exec('ROLLBACK TO r160');
    db.exec('RELEASE r160');
  }
});
