// Le format d'un lot de changements (client/src/lib/lot-de-changements.mjs ; lot 6 du chantier de la base de dev, R274, R275 ; docs/serveur.md, « Lots de
// changements (format) ») : l'en-tête, les opérations, chaque refus avec le rang de l'opération à corriger, le lot éteint hors de l'édition, la comparaison
// des valeurs attendues à la base actuelle. Le module est pur : la structure des tables est lue ici dans data/schema.sql (base neuve en mémoire).
// Aucun nom ni valeur de règle figés : les tables d'essai se choisissent dans le modèle de l'édition et dans le classement des tables.
//   node --test test/lot-de-changements.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import {
  COLONNES_D_UNE_PAGE_DE_NOTION, COLONNES_VENUES_APRES, ETATS_D_UNE_OPERATION, FORMAT_DU_LOT, LOT_OUVERT_AUX_TABLES_HORS_EDITION, NATURES, NATURES_D_UN_LOT, OPERATIONS, comparerAvecLaBase, controlerLaNature,
  controlerLeLot, lireUnLot, tablesDeLEdition,
} from '../src/lib/lot-de-changements.mjs';
import { TABLES_DERIVEES, TABLES_DES_NOTES, TABLES_DE_REGLES, TABLES_PROPRES_AU_SITE } from '../src/lib/tables-de-la-base.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(SCHEMA);

/** La structure d'une table lue dans la base neuve (PRAGMA table_info) : ce que le service fournira. */
function structure(table) {
  if (!/^[a-z0-9_]+$/.test(table)) return null;
  const lignes = db.prepare(`PRAGMA table_info("${table}")`).all();
  if (!lignes.length) return null;
  return { colonnes: lignes.map((c) => c.name), cle: lignes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name) };
}
const controler = (lot, options = {}) => controlerLeLot(lot, { structure, ...options });

// ---- les tables d'essai, choisies par leur propriété ----
const EDITION = Object.keys(TABLES).find((t) => structure(t)?.cle.length === 1 && structure(t).colonnes.length >= 3);
const [CLE_ED] = structure(EDITION).cle;
const [COL_A, COL_B] = structure(EDITION).colonnes.filter((c) => c !== CLE_ED);
const HORS_EDITION = TABLES_DE_REGLES.find((t) => !tablesDeLEdition().has(t) && structure(t)?.cle.length === 1 && structure(t).colonnes.length >= 3);
const [CLE_HE] = structure(HORS_EDITION).cle;
const [COL_HE] = structure(HORS_EDITION).colonnes.filter((c) => c !== CLE_HE);
const COMPOSEE = TABLES_DE_REGLES.find((t) => structure(t)?.cle.length === 2 && structure(t).colonnes.length >= 3);
const [K1, K2] = structure(COMPOSEE).cle;

const ligneEntiere = (table, cle) => Object.fromEntries(structure(table).colonnes.map((c) => [c, c in cle ? cle[c] : null]));
const modifier = (cle = 1, avant = { [COL_A]: 'a' }, apres = { [COL_A]: 'b' }) => ({ table: EDITION, cle: { [CLE_ED]: cle }, operation: 'modifier', avant, apres });
const inserer = (cle = 2) => ({ table: EDITION, cle: { [CLE_ED]: cle }, operation: 'inserer', apres: { [CLE_ED]: cle, [COL_A]: 'x' } });
const supprimer = (cle = 3) => ({ table: EDITION, cle: { [CLE_ED]: cle }, operation: 'supprimer', avant: ligneEntiere(EDITION, { [CLE_ED]: cle }) });
const lot = (operations, entete = {}) => ({ titre: 'Un lot d’essai', nature: 'migration', operations, ...entete });
/** Un lot dont l'opération 1 est valide et la 2 est `o` : l'erreur attendue porte le rang 2. */
const avecUneErreur = (o, options) => controler(lot([modifier(100), o]), options);
const rangs = (r) => r.erreurs.map((e) => e.rang);
const messages = (r) => r.erreurs.map((e) => e.message).join(' | ');

test('un lot valide : une insertion, une modification, une suppression', () => {
  const r = controler(lot([modifier(), inserer(), supprimer()], { decision: undefined, auteur: 'équipe', format: FORMAT_DU_LOT }));
  assert.deepEqual(r, { valide: true, erreurs: [] });
});

test('un lot relu depuis son fichier (JSON) reste valide ; un texte qui n’est pas du JSON est refusé en le disant', () => {
  const texte = JSON.stringify(lot([modifier(), inserer(), supprimer()], { nature: 'decision', decision: 'R275' }), null, 2);
  assert.equal(controler(lireUnLot(texte)).valide, true);
  assert.throws(() => lireUnLot('{ pas du json'), /lot illisible/);
});

test('les natures : la liste de la base (CHECK de modification_lot et d’historique_modification), un lot n’a pas « saisie »', () => {
  for (const table of ['modification_lot', 'historique_modification']) {
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table).sql;
    const liste = /nature\s+TEXT\s+NOT NULL DEFAULT 'saisie' CHECK \(nature IN \(([^)]*)\)\)/.exec(sql)[1];
    assert.deepEqual([...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]), [...NATURES], table);
  }
  assert.deepEqual([...NATURES_D_UN_LOT], NATURES.filter((n) => n !== 'saisie'));
  assert.deepEqual([...OPERATIONS], ['inserer', 'modifier', 'supprimer']);
});

test('le numéro de décision : le même verdict que le CHECK de la base, pour une trace du journal', () => {
  const essais = ['R1', 'R275', 'R1000', 'R', '275', 'r275', 'R27a', 'R 275', 'R275 ', 'R275(2)', 'RR275', '', 'R0'];
  for (const decision of essais) {
    let accepte = true;
    try {
      db.prepare("INSERT INTO modification_lot (id, fait_le, resume, nature, decision) VALUES (?, '2026-11-14T10:00:00Z', 'essai', 'decision', ?)").run(`lot-${decision}`, decision);
    } catch {
      accepte = false;
    }
    assert.equal(controlerLaNature({ nature: 'decision', decision }, { saisie: true }).length === 0, accepte, JSON.stringify(decision));
  }
  assert.equal(controlerLaNature({ nature: 'decision', decision: null }, { saisie: true }).length > 0, true, 'une décision sans numéro');
  for (const nature of NATURES.filter((n) => n !== 'decision')) {
    assert.deepEqual(controlerLaNature({ nature, decision: null }, { saisie: true }), [], nature);
    assert.equal(controlerLaNature({ nature, decision: 'R275' }, { saisie: true }).length > 0, true, `${nature} avec un numéro`);
  }
  assert.equal(controlerLaNature({ nature: 'saisie' }).length > 0, true, '« saisie » refusée pour un lot');
  assert.equal(controlerLaNature({ nature: 'saisie' }, { saisie: true }).length, 0);
});

test('en-tête : objet, clés inconnues, format, titre, nature, numéro de décision, auteur, liste d’opérations', () => {
  const op = [modifier()];
  const refus = (l) => controler(l);
  assert.deepEqual(rangs(refus(null)), [null]);
  assert.deepEqual(rangs(refus([])), [null]);
  assert.match(messages(refus(lot(op, { faute: 1 }))), /« faute » inconnue/);
  assert.match(messages(refus(lot(op, { format: 'maverick-lot/9' }))), /format/);
  for (const titre of [undefined, '', '   ', 12, 'x'.repeat(201)]) assert.match(messages(refus(lot(op, { titre }))), /titre/, JSON.stringify(titre)?.slice(0, 20));
  assert.match(messages(refus(lot(op, { nature: undefined }))), /nature/);
  assert.match(messages(refus(lot(op, { nature: 'import' }))), /inconnue/);
  assert.match(messages(refus(lot(op, { nature: 'saisie' }))), /saisie/);
  assert.match(messages(refus(lot(op, { nature: 'decision' }))), /numéro/);
  assert.match(messages(refus(lot(op, { nature: 'decision', decision: 'R27x' }))), /numéro/);
  assert.match(messages(refus(lot(op, { nature: 'code', decision: 'R275' }))), /decision/);
  assert.match(messages(refus(lot(op, { auteur: 4 }))), /auteur/);
  for (const operations of [undefined, [], {}, 'x']) assert.match(messages(refus(lot(operations))), /operations/, JSON.stringify(operations));
  for (const nature of NATURES_D_UN_LOT) assert.equal(controler(lot(op, nature === 'decision' ? { nature, decision: 'R1' } : { nature })).valide, true, nature);
});

test('chaque erreur dit le rang de l’opération à corriger ; toutes sont rendues d’un coup', () => {
  const r = controler(lot([modifier(), { ...inserer(), operation: 'rien' }, modifier(5, { [COL_A]: 'a' }, { colonne_absente: 'b' }), supprimer()]));
  assert.deepEqual([...new Set(rangs(r))], [2, 3]);
  for (const e of r.erreurs) assert.match(e.message, new RegExp(`^opération ${e.rang} :`));
});

test('opération : forme, opération connue, table existante', () => {
  assert.deepEqual(rangs(avecUneErreur('texte')), [2]);
  assert.deepEqual(rangs(avecUneErreur({ ...modifier(), faute: 1 })), [2]);
  assert.match(messages(avecUneErreur({ ...modifier(), operation: 'renommer' })), /operation/);
  assert.match(messages(avecUneErreur({ ...modifier(), operation: undefined })), /operation/);
  assert.match(messages(avecUneErreur({ ...modifier(), table: undefined })), /table/);
  assert.match(messages(avecUneErreur({ ...modifier(), table: 'table_qui_n_existe_pas' })), /inexistante/);
  assert.match(messages(avecUneErreur({ ...modifier(), table: 'x; DROP TABLE page' })), /inexistante/);
});

test('table : seulement le contenu ; ni fiches, ni tables calculées, ni notes de version, historique ou journal', () => {
  const sur = (table) => avecUneErreur({ table, cle: { id: 1 }, operation: 'modifier', avant: { a: 'x' }, apres: { a: 'y' } }, { tablesEdition: new Set([table]), ouvertHorsEdition: true });
  for (const table of [TABLES_PROPRES_AU_SITE[0], 'modification', 'modification_lot', TABLES_DERIVEES[0]]) {
    assert.deepEqual(rangs(sur(table)), [2], table);
    assert.match(messages(sur(table)), /seules les tables de contenu/, table);
  }
  for (const table of TABLES_DES_NOTES) {
    assert.deepEqual(rangs(sur(table)), [2], table);
    assert.match(messages(sur(table)), /traces/, table);
  }
});

test('éteint hors de l’édition : une table que le service d’édition ne sait pas écrire est refusée, tant que le lot 8 n’a pas ouvert la constante', () => {
  assert.equal(LOT_OUVERT_AUX_TABLES_HORS_EDITION, false, 'le lot reste éteint jusqu’au lot 8 (R274)');
  const hors = { table: HORS_EDITION, cle: { [CLE_HE]: 1 }, operation: 'modifier', avant: { [COL_HE]: 'a' }, apres: { [COL_HE]: 'b' } };
  const r = avecUneErreur(hors);
  assert.deepEqual(rangs(r), [2]);
  assert.match(messages(r), /lot 8/);
  assert.equal(avecUneErreur(hors, { ouvertHorsEdition: true }).valide, true, 'ouvert : seuls les contrôles de structure restent');
  assert.equal(avecUneErreur(hors, { tablesEdition: new Set([EDITION, HORS_EDITION]) }).valide, true, 'une table connue de l’édition passe');
  // la liste des tables de l'édition est celle du modèle : TABLES et les tables d'ENTITES
  const connues = tablesDeLEdition();
  for (const t of Object.keys(TABLES)) assert.ok(connues.has(t), t);
  for (const e of Object.values(ENTITES)) assert.ok(connues.has(e.table), e.table);
  assert.equal(connues.has(HORS_EDITION), false);
});

test('clé : toute la clé primaire, et elle seule, en valeurs simples non nulles', () => {
  assert.match(messages(avecUneErreur({ ...modifier(), cle: undefined })), /cle/);
  assert.match(messages(avecUneErreur({ ...modifier(), cle: [1] })), /cle/);
  assert.match(messages(avecUneErreur({ ...modifier(), cle: {} })), /incomplète/);
  assert.match(messages(avecUneErreur({ ...modifier(), cle: { [CLE_ED]: 1, [COL_A]: 'x' } })), /pas dans la clé primaire/);
  assert.match(messages(avecUneErreur({ ...modifier(), cle: { [CLE_ED]: null } })), /texte ou un nombre/);
  assert.match(messages(avecUneErreur({ ...modifier(), cle: { [CLE_ED]: { a: 1 } } })), /texte ou un nombre/);
  // une clé composée : les deux colonnes
  const composee = (cle) => avecUneErreur({ table: COMPOSEE, cle, operation: 'inserer', apres: { ...cle } }, { tablesEdition: new Set([EDITION, COMPOSEE]) });
  assert.equal(composee({ [K1]: 1, [K2]: 2 }).valide, true);
  assert.match(messages(composee({ [K1]: 1 })), new RegExp(`manque « ${K2} »`));
  assert.deepEqual([...new Set(rangs(composee({ [K1]: 1 })))], [2]);
});

test('inserer : sans « avant », « apres » porte la clé de l’opération et des colonnes qui existent', () => {
  assert.equal(avecUneErreur(inserer()).valide, true);
  assert.match(messages(avecUneErreur({ ...inserer(), avant: { [COL_A]: 'a' } })), /avant : une insertion/);
  assert.equal(avecUneErreur({ ...inserer(), avant: null }).valide, true, 'null vaut absent (la forme du journal)');
  assert.match(messages(avecUneErreur({ ...inserer(), apres: undefined })), /apres/);
  assert.match(messages(avecUneErreur({ ...inserer(), apres: {} })), /apres/);
  assert.match(messages(avecUneErreur({ ...inserer(), apres: { [CLE_ED]: 2, inconnue: 'x' } })), /inexistante/);
  assert.match(messages(avecUneErreur({ ...inserer(), apres: { [COL_A]: 'x' } })), /doit porter sa clé/);
  assert.match(messages(avecUneErreur({ ...inserer(2), apres: { [CLE_ED]: 3 } })), /ne valent pas la clé/);
  assert.match(messages(avecUneErreur({ ...inserer(), apres: { [CLE_ED]: 2, [COL_A]: { a: 1 } } })), /texte, un nombre ou null/);
  assert.match(messages(avecUneErreur({ ...inserer(), apres: { [CLE_ED]: 2, [COL_A]: true } })), /texte, un nombre ou null/);
});

test('modifier : « avant » et « apres » nomment les mêmes colonnes, qui existent, hors clé, et dont la valeur change', () => {
  assert.equal(avecUneErreur(modifier(1, { [COL_A]: 1, [COL_B]: null }, { [COL_A]: 2, [COL_B]: 'x' })).valide, true);
  assert.match(messages(avecUneErreur({ ...modifier(), avant: undefined })), /avant/);
  assert.match(messages(avecUneErreur({ ...modifier(), apres: undefined })), /apres/);
  assert.match(messages(avecUneErreur(modifier(1, { [COL_A]: 'a' }, { [COL_A]: 'b', [COL_B]: 'c' }))), /avant : la valeur attendue/);
  assert.match(messages(avecUneErreur(modifier(1, { [COL_A]: 'a', [COL_B]: 'c' }, { [COL_A]: 'b' }))), /apres : la valeur écrite/);
  assert.match(messages(avecUneErreur(modifier(1, { inconnue: 'a' }, { inconnue: 'b' }))), /inexistante/);
  assert.match(messages(avecUneErreur(modifier(1, { [CLE_ED]: 1 }, { [CLE_ED]: 2 }))), /clé primaire, qui ne change pas/);
  assert.match(messages(avecUneErreur(modifier(1, { [COL_A]: 'a' }, { [COL_A]: 'a' }))), /rien à modifier/);
  assert.match(messages(avecUneErreur(modifier(1, { [COL_A]: null }, { [COL_A]: undefined }))), /rien à modifier|texte, un nombre ou null/);
  assert.match(messages(avecUneErreur(modifier(1, { [COL_A]: 'a' }, { [COL_A]: ['b'] }))), /texte, un nombre ou null/);
  assert.match(messages(avecUneErreur(modifier(1, { [COL_A]: 'a' }, { [COL_A]: Number.NaN }))), /texte, un nombre ou null/);
});

test('supprimer : « avant » est la ligne entière, à la clé de l’opération, sans « apres »', () => {
  assert.equal(avecUneErreur(supprimer()).valide, true);
  assert.match(messages(avecUneErreur({ ...supprimer(), apres: { [COL_A]: 'x' } })), /apres : une suppression/);
  assert.match(messages(avecUneErreur({ ...supprimer(), avant: undefined })), /avant/);
  assert.match(messages(avecUneErreur({ ...supprimer(), avant: { [CLE_ED]: 3 } })), /en entier/);
  assert.match(messages(avecUneErreur({ ...supprimer(3), avant: ligneEntiere(EDITION, { [CLE_ED]: 4 }) })), /ne valent pas la clé/);
  assert.deepEqual(rangs(avecUneErreur({ ...supprimer(), avant: { [CLE_ED]: 3 } })), [2]);
});

test('supprimer : les colonnes venues après le lot (0136, NULL permise) peuvent manquer à « avant » ; elles valent alors NULL à la comparaison', () => {
  for (const [table, venues] of Object.entries(COLONNES_VENUES_APRES)) {
    const s = structure(table);
    for (const c of venues) assert.ok(s.colonnes.includes(c), `${table}.${c} existe dans le schéma`);
    const id = `essai/${table}`;
    const entiere = ligneEntiere(table, { [s.cle[0]]: id });
    const ancien = Object.fromEntries(Object.entries(entiere).filter(([c]) => !venues.includes(c)));
    const op = { table, cle: { [s.cle[0]]: id }, operation: 'supprimer', avant: ancien };
    assert.deepEqual(controler(lot([op]), { ouvertHorsEdition: true }).erreurs, [], `${table} : un avant écrit avant la 0136 reste valide`);
    // une autre colonne qui manque reste refusée
    const autre = s.colonnes.find((c) => !venues.includes(c) && !s.cle.includes(c));
    const { [autre]: _manque, ...incomplet } = ancien;
    assert.match(messages(controler(lot([{ ...op, avant: incomplet }]), { ouvertHorsEdition: true })), new RegExp(`en entier \\(manque « ${autre} »\\)`));
    // absente, une colonne venue après est attendue NULL : remplie depuis, la ligne a changé (le site prime)
    const lire = (valeurs) => () => ({ ...entiere, ...valeurs });
    assert.equal(comparerAvecLaBase(lot([op]), lire({})).operations[0].etat, 'applicable');
    const remplie = comparerAvecLaBase(lot([op]), lire({ [venues[0]]: 'remplie depuis' })).operations[0];
    assert.equal(remplie.etat, 'changee');
    assert.deepEqual(remplie.ecarts, [{ colonne: venues[0], attendue: null, actuelle: 'remplie depuis' }]);
  }
});

test('ancrage : la page de notion (insertion de `page`, { notion: true }, apres : id, titre, mot_cle_id), refusée ailleurs ; chaque forme garde ses clés', () => {
  const page = (apres = {}, plus = {}) => ({
    table: 'page', cle: { id: 'guide/zephyrion-x' }, operation: 'inserer', apres: { id: 'guide/zephyrion-x', titre: 'Zephyrion X', mot_cle_id: 7, ...apres }, ancrage: { notion: true }, ...plus,
  });
  assert.deepEqual(COLONNES_D_UNE_PAGE_DE_NOTION, ['id', 'titre', 'mot_cle_id']);
  assert.equal(avecUneErreur(page()).valide, true);
  assert.deepEqual(rangs(avecUneErreur(page({ resume: 'Non.' }))), [2]);
  assert.match(messages(avecUneErreur(page({ resume: 'Non.' }))), /ancrage : une page de notion n'écrit que « id », « titre », « mot_cle_id »/);
  assert.match(messages(avecUneErreur(page({ mot_cle_id: null }))), /ancrage : « mot_cle_id »/);
  assert.match(messages(avecUneErreur(page({}, { cle: { id: 'races/zephyrion-x' }, apres: { id: 'races/zephyrion-x', titre: 'Zephyrion X', mot_cle_id: 7 } }))), /ancrage : une page de notion est une page du guide/);
  assert.match(messages(avecUneErreur({ table: 'page', cle: { id: 'guide/zephyrion-x' }, operation: 'modifier', avant: { titre: 'a' }, apres: { titre: 'b' }, ancrage: { notion: true } })), /ancrage : sur une page, seule l'insertion/);
  // les clés de chaque forme : { notion } sur une page, { table, id, type } à la création d'un mot-clé, { aligner } sur sa modification
  assert.match(messages(avecUneErreur(page({}, { ancrage: { notion: true, aligner: true } }))), /ancrage : sur une page, seul \{ "notion": true \}/);
  const motCle = { table: 'mot_cle', cle: { id: { $numero: 'a' } }, operation: 'inserer', apres: { id: { $numero: 'a' }, libelle: 'X' }, ancrage: { notion: true } };
  assert.match(messages(avecUneErreur(motCle)), /ancrage : « notion » inconnu \(attendu : « table », « id », « type »\)/);
  assert.match(messages(avecUneErreur({ ...modifier(), ancrage: { notion: true } })), /ancrage : il ne se pose que sur l'insertion ou la modification d'un mot-clé, ou sur l'insertion d'une page de notion/);
});

test('jamais deux opérations sur la même ligne et colonne : une insertion ou une suppression touche toute la ligne, deux « modifier » de colonnes différentes passent', () => {
  const r = (...operations) => controler(lot(operations));
  assert.equal(r(modifier(1, { [COL_A]: 'a' }, { [COL_A]: 'b' }), modifier(1, { [COL_B]: 'c' }, { [COL_B]: 'd' })).valide, true, 'colonnes différentes');
  assert.equal(r(modifier(1), modifier(2)).valide, true, 'lignes différentes');
  const meme = r(modifier(1), modifier(1, { [COL_A]: 'b' }, { [COL_A]: 'c' }));
  assert.deepEqual(rangs(meme), [2]);
  assert.match(messages(meme), new RegExp(`colonne « ${COL_A} » .*opération 1`));
  for (const [premiere, seconde] of [[inserer(2), modifier(2)], [modifier(3), supprimer(3)], [supprimer(3), supprimer(3)], [inserer(2), inserer(2)], [supprimer(3), inserer(3)]]) {
    const x = r(premiere, seconde);
    assert.deepEqual(rangs(x), [2], `${premiere.operation} puis ${seconde.operation}`);
    assert.match(messages(x), /opération 1/);
  }
  // la même clé dans deux tables n'est pas la même ligne
  const autre = { table: HORS_EDITION, cle: { [CLE_HE]: 1 }, operation: 'modifier', avant: { [COL_HE]: 'a' }, apres: { [COL_HE]: 'b' } };
  const entre = controler(lot([modifier(1), autre]), { ouvertHorsEdition: true });
  assert.equal(entre.valide, true);
});

// ---- la comparaison des valeurs attendues à la base actuelle ----

/** Une « base » de lignes : table → clé JSON → ligne ; lireLigne la lit comme le service lira la sienne. */
function base(lignes) {
  const map = new Map(lignes.map(({ table, ligne }) => [`${table}\u0000${ligne[structure(table).cle[0]]}`, ligne]));
  return (table, cle) => map.get(`${table}\u0000${cle[structure(table).cle[0]]}`) ?? null;
}
const LIGNE = (cle, valeurs = {}) => ({ table: EDITION, ligne: { ...ligneEntiere(EDITION, { [CLE_ED]: cle }), ...valeurs } });

test('comparer : applicable tant que la ligne est dans l’état attendu, « changée entre-temps » sinon, avec la valeur actuelle (le site prime)', () => {
  const l = lot([
    modifier(1, { [COL_A]: 'a', [COL_B]: null }, { [COL_A]: 'b', [COL_B]: 'c' }), // 1 : conforme
    modifier(2, { [COL_A]: 'a' }, { [COL_A]: 'b' }), // 2 : le site a changé la valeur
    modifier(3), // 3 : la ligne a disparu
    inserer(4), // 4 : la ligne n'existe pas : applicable
    inserer(5), // 5 : la ligne existe déjà
    { ...supprimer(6), avant: { ...supprimer(6).avant, [COL_A]: 'a' } }, // 6 : toujours telle qu'attendue
    { ...supprimer(7), avant: { ...supprimer(7).avant, [COL_A]: 'a' } }, // 7 : une colonne a changé
    supprimer(8), // 8 : déjà supprimée
  ]);
  const lire = base([
    LIGNE(1, { [COL_A]: 'a' }), LIGNE(2, { [COL_A]: 'site' }), LIGNE(5), LIGNE(6, { [COL_A]: 'a' }), LIGNE(7, { [COL_A]: 'a', [COL_B]: 'modifiée' }),
  ]);
  const { operations, applicables, changees } = comparerAvecLaBase(l, lire);
  assert.deepEqual(operations.map((o) => [o.rang, o.etat, o.raison]), [
    [1, 'applicable', null], [2, 'changee', 'valeur_changee'], [3, 'changee', 'ligne_absente'], [4, 'applicable', null],
    [5, 'changee', 'ligne_existante'], [6, 'applicable', null], [7, 'changee', 'valeur_changee'], [8, 'changee', 'ligne_absente'],
  ]);
  assert.deepEqual([applicables, changees], [3, 5]);
  assert.deepEqual(operations[1].ecarts, [{ colonne: COL_A, attendue: 'a', actuelle: 'site' }], 'la valeur actuelle est rendue');
  assert.deepEqual(operations[6].ecarts, [{ colonne: COL_B, attendue: null, actuelle: 'modifiée' }]);
  assert.deepEqual(operations[0].ecarts, []);
  assert.equal(operations[1].table, EDITION);
  assert.deepEqual(operations[1].cle, { [CLE_ED]: 2 });
  assert.deepEqual(Object.values(ETATS_D_UNE_OPERATION).sort(), ['applicable', 'changee']);
});

test('comparer : seules les colonnes de « avant » comptent (une autre colonne de la ligne a pu changer) ; null et absent sont la même valeur', () => {
  const l = lot([modifier(1, { [COL_A]: null }, { [COL_A]: 'x' })]);
  const ligne = { ...ligneEntiere(EDITION, { [CLE_ED]: 1 }), [COL_B]: 'autre chose' };
  assert.equal(comparerAvecLaBase(l, base([{ table: EDITION, ligne }])).operations[0].etat, 'applicable');
  const sansColonne = { [CLE_ED]: 1 }; // une ligne lue sans la colonne : vaut null
  assert.equal(comparerAvecLaBase(l, base([{ table: EDITION, ligne: sansColonne }])).operations[0].etat, 'applicable');
});

test('comparer : lit chaque ligne par sa table et sa clé, une fois par opération', () => {
  const appels = [];
  const l = lot([modifier(1), inserer(2), supprimer(3)]);
  comparerAvecLaBase(l, (table, cle) => {
    appels.push([table, cle]);
    return null;
  });
  assert.deepEqual(appels, [[EDITION, { [CLE_ED]: 1 }], [EDITION, { [CLE_ED]: 2 }], [EDITION, { [CLE_ED]: 3 }]]);
});
