// Les types de dégâts des attaques de monstre (migration 0130, décisions R295, R298, R299, R300) par un lot de changements du site de dev :
//   - un lot qui insère les lignes de type_degats absentes (avec leur magie, R298) puis les lignes de monstre_attaque_type est déposé par la route comme sur le site
//     de dev (la base source : `service.source()`, le lot vaut pour les tables hors édition), son essai à blanc (copie de la base) l'annonce applicable sans rien
//     écrire, et son application écrit les lignes, au journal ;
//   - la page lit les types dans l'ordre écrit (lib/bestiaire-db.mjs#chargerMonstres : `attaques[].types` = { type, libelle, magie_id }, `[]` sans type, R300) ;
//   - la carte qui suit son texte (serveur/edition-bestiaire.mjs) : les types d'une attaque ne restent que si chaque libelle est encore écrit dans le texte de
//     l'attaque du même rang, dans l'ordre ; sinon ils partent, au journal ; une attaque retirée et une carte supprimée les emportent (clé étrangère sans cascade).
// La carte d'essai est créée par le test, avec son propre texte : aucune valeur du site de dev n'est lue ni figée ; les types d'essai viennent de type_degats
// (taille, estoc, frappe : ids figés de la 0125), et les onze de R298 absents de la base sont ceux que le lot insère (ids figés par le CHECK de la 0130).
//   node --test test/serveur-edition-lots-types-attaques.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { chargerMonstres } from '../src/lib/bestiaire-db.mjs';
import { htmlDesTypesDeLAttaque } from '../src/lib/valeurs-fermees-rendu.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-lots-types-attaques');
const JSON_ = { 'content-type': 'application/json' };
/** R298 : les onze types ajoutés à la liste, chacun lié à la magie du même nom (ids figés par le CHECK de type_degats). */
const MAGIE_DU_TYPE = {
  foudre: 'magies/magie-de-la-foudre', lumiere: 'magies/magie-de-la-lumiere', arcane: 'magies/magie-de-larcane', sang: 'magies/magie-du-sang',
  terre: 'magies/magie-de-la-terre', ombre: 'magies/magie-de-lombre', corruption: 'magies/magie-de-la-corruption', 'espace-temps': 'magies/magie-de-lespace-temps',
  vide: 'magies/magie-du-vide', vent: 'magies/magie-du-vent', necromancie: 'magies/magie-de-la-necromancie',
};
let n = 0;

function nouvelle() {
  const chemin = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin;
  const db = ouvrirBaseVivante(chemin);
  // `source` : la base du site de dev (db/source) : la route donne `ouvertHorsEdition` au contrôle du lot (serveur/api.mjs#traiterLots)
  const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {}, lots: { enArrierePlan: false }, source: () => true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const un = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : undefined;
  };
  const tous = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
  const enregistrer = (...operations) => appel('POST', '/api/edition/', { page: 'bestiaire/', operations });
  return { db, appel, un, tous, enregistrer };
}
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const nomLibre = (base) => `${base} ${process.pid} ${(n += 1)}`;

/** Une carte d'essai (espèce et carte créées par le service) dont la rubrique des dégâts écrit `lignes`, une attaque par ligne : { id, attaques: [{ rang, nom, texte }] }. */
function carteAvecDesAttaques(m, lignes) {
  const espece = ok(m.enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom: nomLibre('Espèce d’essai'), ep_brut: 'EP1' } })).crees[0].id;
  const id = ok(m.enregistrer({ op: 'creer', entite: 'monstre', valeurs: { espece_id: espece, nom: nomLibre('Carte d’essai'), echelle_brut: '1', categorie: 'ennemi_simple' } })).crees[0].id;
  ecrireLesAttaques(m, id, lignes);
  return { id, attaques: attaquesDe(m, id) };
}
const rubriqueDesDegats = (m, id) => m.un("SELECT rang FROM monstre_rubrique WHERE monstre_id = ? AND rubrique = 'degats'", id).rang;
const ecrireLesAttaques = (m, id, lignes) =>
  ok(m.enregistrer({ op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: id, rang: rubriqueDesDegats(m, id) }, valeurs: { texte: lignes.join('\n') } }));
const attaquesDe = (m, id) => m.tous('SELECT rang, nom, texte FROM monstre_attaque WHERE monstre_id = ? ORDER BY rang', id);
const typesDe = (m, id) => m.tous('SELECT attaque_rang, rang, type, libelle FROM monstre_attaque_type WHERE monstre_id = ? ORDER BY attaque_rang, rang', id);

/**
 * Le lot du site de dev : les lignes de type_degats que la base n'a pas encore (R298 : id lié à sa magie) puis `types` ([attaque_rang, type, libelle] dans l'ordre
 * écrit de chaque attaque), nature « decision » R298.
 */
function lotDesTypes(m, id, types) {
  const presents = new Set(m.tous('SELECT id FROM type_degats').map((t) => t.id));
  const operations = Object.entries(MAGIE_DU_TYPE).filter(([type]) => !presents.has(type)).map(([type, magie]) =>
    ({ table: 'type_degats', cle: { id: type }, operation: 'inserer', apres: { id: type, mot_cle_id: null, magie_id: magie } }));
  const rangs = new Map();
  for (const [attaque, type, libelle] of types) {
    const rang = (rangs.get(attaque) ?? 0) + 1;
    rangs.set(attaque, rang);
    operations.push({ table: 'monstre_attaque_type', cle: { monstre_id: id, attaque_rang: attaque, rang }, operation: 'inserer',
      apres: { monstre_id: id, attaque_rang: attaque, rang, type, libelle } });
  }
  return { format: 'maverick-lot/1', titre: `Types des attaques d’essai ${(n += 1)}`, nature: 'decision', decision: 'R298', auteur: 'essai', operations };
}

/** Dépose le lot par la route, vérifie son essai à blanc, puis l'applique d'un clic. */
async function appliquer(m, lot) {
  const avant = m.un('SELECT count(*) AS lignes, (SELECT count(*) FROM type_degats) AS types FROM monstre_attaque_type');
  const proposition = ok(await m.appel('POST', '/api/edition/lots/', lot), 201);
  assert.equal(proposition.verdict, 'applicable', JSON.stringify(proposition.essai?.operations?.map((o) => o.message ?? o.etat)));
  assert.deepEqual(m.un('SELECT count(*) AS lignes, (SELECT count(*) FROM type_degats) AS types FROM monstre_attaque_type'), avant, 'l’essai à blanc n’écrit rien dans la base');
  const applique = ok(await m.appel('POST', `/api/edition/lots/${proposition.id}/appliquer/`, {}));
  assert.equal(applique.etat, 'applique');
  return applique;
}

test('le lot de types : insère les lignes de type_degats absentes et celles de monstre_attaque_type ; essai à blanc sans écriture, journal, clés intactes (R298, R299)', async () => {
  const m = nouvelle();
  const carte = carteAvecDesAttaques(m, ['Pince - 2d10 dégâts de taille/estoc', 'Éclair - 3d6 dégâts de foudre', 'Morsure - 1d6 dégâts neutres']);
  assert.equal(carte.attaques.length, 3);
  const absents = Object.keys(MAGIE_DU_TYPE).filter((t) => !m.un('SELECT 1 AS x FROM type_degats WHERE id = ?', t));
  const lot = lotDesTypes(m, carte.id, [[1, 'taille', 'taille'], [1, 'estoc', 'estoc'], [2, 'foudre', 'foudre']]);
  assert.equal(lot.operations.length, absents.length + 3);

  const applique = await appliquer(m, lot);
  assert.equal(applique.operations, lot.operations.length);
  for (const type of absents) assert.deepEqual(m.un('SELECT mot_cle_id, magie_id FROM type_degats WHERE id = ?', type), { mot_cle_id: null, magie_id: MAGIE_DU_TYPE[type] }, type);
  assert.deepEqual(typesDe(m, carte.id), [
    { attaque_rang: 1, rang: 1, type: 'taille', libelle: 'taille' }, { attaque_rang: 1, rang: 2, type: 'estoc', libelle: 'estoc' },
    { attaque_rang: 2, rang: 1, type: 'foudre', libelle: 'foudre' },
  ]);
  assert.deepEqual(m.tous("SELECT * FROM pragma_foreign_key_check('monstre_attaque_type')"), []);
  assert.deepEqual(m.tous("SELECT * FROM pragma_foreign_key_check('type_degats')"), []);
  // le journal du lot : une trace par ligne insérée, de la nature et de la décision du lot
  assert.equal(m.un("SELECT count(*) AS n FROM modification WHERE table_nom = 'monstre_attaque_type' AND lot_id = ?", applique.lot_id).n, 3);
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', applique.lot_id), { nature: 'decision', decision: 'R298' });

  // la page lit les types dans l'ordre écrit, avec la magie de type_degats ; `[]` pour une attaque sans type (R300)
  const { lignes, liens } = chargerMonstres(m.db);
  const sienne = lignes.find((l) => l.id === carte.id);
  assert.deepEqual(sienne.carte.attaques.map((a) => a.nom), carte.attaques.map((a) => a.nom));
  assert.deepEqual(sienne.carte.attaques.map((a) => a.types), [
    [{ type: 'taille', libelle: 'taille', magie_id: null }, { type: 'estoc', libelle: 'estoc', magie_id: null }],
    [{ type: 'foudre', libelle: 'foudre', magie_id: MAGIE_DU_TYPE.foudre }],
    [],
  ]);
  assert.match(htmlDesTypesDeLAttaque(sienne.carte.attaques[0].types, liens), / \/ /, 'deux types séparés par « / », comme les créatures invoquées');
  assert.equal(htmlDesTypesDeLAttaque(sienne.carte.attaques[2].types, liens), '');
  assert.ok(Object.hasOwn(liens.degats, 'foudre'), 'le lien du type est celui de sa magie (liens.degats)');
  // chaque attaque de chaque carte porte `types` (forme de chargerInvocations)
  for (const l of lignes.filter((x) => x.carte)) for (const a of l.carte.attaques) assert.ok(Array.isArray(a.types), l.id);

  // un lot qui redit une ligne déjà posée : rien à écrire (le site prime), jamais un doublon
  const encore = ok(await m.appel('POST', '/api/edition/lots/', lotDesTypes(m, carte.id, [[1, 'taille', 'taille']])), 201);
  assert.equal(encore.verdict, 'rien_a_ecrire');
});

test('un type hors de la liste, ou une attaque qui n’existe pas, est à corriger à l’essai à blanc : rien n’entre', async () => {
  const m = nouvelle();
  const carte = carteAvecDesAttaques(m, ['Pince - 2d10 dégâts de taille']);
  for (const [attaque, type] of [[1, 'neutre'], [9, 'taille']]) {
    const lot = lotDesTypes(m, carte.id, [[attaque, type, type]]);
    // un type qui n'est pas dans la liste de la 0130 ne s'insère pas non plus dans type_degats
    if (type === 'neutre') lot.operations.unshift({ table: 'type_degats', cle: { id: type }, operation: 'inserer', apres: { id: type, mot_cle_id: null, magie_id: null } });
    const proposition = ok(await m.appel('POST', '/api/edition/lots/', lot), 201);
    assert.equal(proposition.verdict, 'a_corriger', `${type} : ${JSON.stringify(proposition.essai?.operations?.map((o) => o.message ?? o.etat))}`);
    assert.equal(proposition.etat, 'propose', 'jamais appliqué');
    assert.equal(m.un('SELECT count(*) AS n FROM monstre_attaque_type WHERE monstre_id = ?', carte.id).n, 0, 'rien n’est écrit');
  }
});

test('le texte de la carte change : les types restent si chaque libelle est encore écrit dans le texte de l’attaque, dans l’ordre ; sinon ils partent, au journal (R295)', async () => {
  const m = nouvelle();
  const carte = carteAvecDesAttaques(m, ['Pince - 2d10 dégâts de taille/estoc', 'Éclair - 3d6 dégâts de foudre', 'Queue - 1d6 dégâts de frappe']);
  await appliquer(m, lotDesTypes(m, carte.id, [[1, 'taille', 'taille'], [1, 'estoc', 'estoc'], [2, 'foudre', 'foudre'], [3, 'frappe', 'frappe']]));
  const types = typesDe(m, carte.id);
  assert.equal(types.length, 4);
  const suppressions = () => m.un("SELECT count(*) AS n FROM modification WHERE table_nom = 'monstre_attaque_type' AND operation = 'supprimer'").n;

  // 1. seuls les dés changent : les libelles restent écrits, dans l'ordre : tous les types restent, rien n'est écrit pour eux
  const avant = suppressions();
  const tracesDesTypes = () => m.un("SELECT count(*) AS n FROM modification WHERE table_nom = 'monstre_attaque_type'").n;
  const traces = tracesDesTypes();
  ecrireLesAttaques(m, carte.id, ['Pince - 4d10 + 2 dégâts de taille/estoc', 'Éclair - 3d6 dégâts de foudre', 'Queue - 1d6 dégâts de frappe']);
  assert.deepEqual(typesDe(m, carte.id), types);
  assert.equal(attaquesDe(m, carte.id)[0].texte, '4d10 + 2 dégâts de taille/estoc');
  assert.equal(suppressions(), avant);
  assert.equal(tracesDesTypes(), traces, 'le journal ne note pas les types gardés');

  // 2. l'ordre écrit change (« estoc/taille » pour taille puis estoc) : les types de cette attaque seuls partent
  ecrireLesAttaques(m, carte.id, ['Pince - 4d10 dégâts d’estoc/taille', 'Éclair - 3d6 dégâts de foudre', 'Queue - 1d6 dégâts de frappe']);
  assert.deepEqual(typesDe(m, carte.id).map((t) => t.attaque_rang), [2, 3], 'les types de la première attaque sont retirés');
  assert.equal(suppressions(), avant + 2, 'chaque suppression est au journal');

  // 3. un libelle n'est plus écrit : ses types partent ; une attaque retirée emporte les siens (clé étrangère sans cascade)
  ecrireLesAttaques(m, carte.id, ['Pince - 4d10 dégâts d’estoc/taille', 'Éclair - 3d6 dégâts de feu']);
  assert.deepEqual(typesDe(m, carte.id), []);
  assert.deepEqual(attaquesDe(m, carte.id).map((a) => a.rang), [1, 2]);
  assert.deepEqual(m.tous("SELECT * FROM pragma_foreign_key_check('monstre_attaque_type')"), []);
  assert.equal(suppressions(), avant + 4);
});

test('une attaque retirée du texte emporte ses types ; la suppression de la carte aussi, sans rompre la clé étrangère', async () => {
  const m = nouvelle();
  const carte = carteAvecDesAttaques(m, ['Pince - 2d10 dégâts de taille', 'Éclair - 3d6 dégâts de foudre']);
  await appliquer(m, lotDesTypes(m, carte.id, [[1, 'taille', 'taille'], [2, 'foudre', 'foudre']]));
  assert.equal(typesDe(m, carte.id).length, 2);

  ecrireLesAttaques(m, carte.id, ['Pince - 2d10 dégâts de taille']);
  assert.deepEqual(attaquesDe(m, carte.id).map((a) => a.rang), [1]);
  assert.deepEqual(typesDe(m, carte.id), [{ attaque_rang: 1, rang: 1, type: 'taille', libelle: 'taille' }], 'la seconde attaque est partie avec son type');

  ok(m.enregistrer({ op: 'supprimer', entite: 'monstre', cle: { id: carte.id } }));
  assert.equal(m.un('SELECT count(*) AS n FROM monstre_attaque_type WHERE monstre_id = ?', carte.id).n, 0);
  assert.equal(m.un('SELECT count(*) AS n FROM monstre_attaque WHERE monstre_id = ?', carte.id).n, 0);
  assert.equal(m.un('SELECT 1 AS x FROM monstre WHERE id = ?', carte.id), undefined);
  assert.deepEqual(m.tous('PRAGMA foreign_key_check'), []);
});
