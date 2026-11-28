// L'aide test/aide-base-d-import.mjs : la base des règles remise dans son état d'import (demande du propriétaire : les tests ne figent plus les textes
// que le site de dev modifie). Sur une copie dont l'historique est écrit ici : chaque opération défaite (modifier, insérer, supprimer, plusieurs lots
// sur une même cellule), une cellule réécrite depuis par une migration gardée, des lots gardés (l'état d'après une migration) ; puis, sur la base
// construite (quels que soient ses textes), l'accord avec historiqueSite#valeurDImport et le cache par processus.
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport, cheminDImport, defaireLeSite, lotsAvant, reglesDImport, remettreDepuisLImport, texteDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { registreDeMigration } from './aide-registres-sortis.mjs';

/** Les natures de trace que defaireLeSite défait ; les autres (source, migration, code) font partie de l'import (R275). */
const DEFAITES = ['saisie', 'decision'];
/** Les lots de l'historique de `db` (identifiant → nature). */
const lotsDe = (db) => new Map(db.prepare('SELECT DISTINCT lot_id, nature FROM historique_modification').all().map((r) => [r.lot_id, r.nature]));

/**
 * Une copie de la base construite, ramenée à son état d'import, ouverte en écriture. Son historique ne garde que des traces qui font partie de l'import
 * (R275 : un lot de nature source, migration ou code, déposé sur le site de dev, y reste) ; `db.lotsDeLaBase` les nomme, pour que chaque test ne juge que
 * les siens.
 */
function copieDImport(t) {
  const chemin = fichierTemporaire('import.db', 'aide-import-', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const db = new DatabaseSync(chemin);
  t.after(() => db.isOpen && db.close());
  defaireLeSite(db);
  db.lotsDeLaBase = lotsDe(db);
  return db;
}
/** Les lots de l'historique que le test a lui-même écrits. */
const lotsDuTest = (db) => [...lotsDe(db)].filter(([lot]) => !db.lotsDeLaBase.has(lot));

/** Une trace seule dans historique_modification (lot, rang, instant), sans rien appliquer : l'entrée d'un lot ancien, que la base n'a plus la forme d'écrire. */
function tracer(db, { lot, rang, faitLe, table, cle, operation, avant = null, apres = null, nature = 'saisie', decision = null }) {
  db.prepare('INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres, nature, decision) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)')
    .run(lot, rang, faitLe, 'Essai', table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres), nature, decision);
}

/** Une opération du site : appliquée à la table, puis notée dans historique_modification (tracer). */
function noter(db, entree) {
  const { table, cle, operation, apres = null } = entree;
  const ou = Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ');
  if (operation === 'modifier') db.prepare(`UPDATE "${table}" SET ${Object.keys(apres).map((c) => `"${c}" = ?`).join(', ')} WHERE ${ou}`).run(...Object.values(apres), ...Object.values(cle));
  if (operation === 'inserer') db.prepare(`INSERT INTO "${table}" (${Object.keys(apres).map((c) => `"${c}"`).join(', ')}) VALUES (${Object.keys(apres).map(() => '?').join(', ')})`).run(...Object.values(apres));
  if (operation === 'supprimer') db.prepare(`DELETE FROM "${table}" WHERE ${ou}`).run(...Object.values(cle));
  tracer(db, entree);
}

/**
 * Des mots-clés à repère qui ont une définition (depuis la migration 0136, la définition d'un mot-clé sans page ni sort se lit sur son repère) :
 * [{ id, description }], `n` au plus, dans l'ordre de leur id.
 */
const reperesDecrits = (db, n) => db.prepare('SELECT mot_cle_id AS id, definition AS description FROM repere WHERE definition IS NOT NULL ORDER BY mot_cle_id LIMIT ?')
  .all(n).map((r) => ({ ...r }));
/** La trace d'une définition modifiée sur le repère du mot-clé `m` (entrée du journal depuis la migration 0136). */
const definitionModifiee = (m, avant, apres) => ({ table: 'repere', cle: { mot_cle_id: m.id }, operation: 'modifier', avant: { definition: avant }, apres: { definition: apres } });
const definitionDe = (db, m) => ligne(db, 'SELECT definition FROM repere WHERE mot_cle_id = ?', m.id)?.definition;
/** Un mot-clé d'essai créé par le site (id entier, migration 0113 ; 9001 et suivants : test/aide-mots-cles.mjs#idDEssai) : sa ligne, puis son repère. */
const motCleCree = (id, nom) => [
  { table: 'mot_cle', cle: { id }, operation: 'inserer', apres: { id, cle: normalize(nom) } },
  { table: 'repere', cle: { mot_cle_id: id }, operation: 'inserer', apres: { mot_cle_id: id, nom } },
];

const ligne = (db, sql, ...p) => {
  const l = db.prepare(sql).get(...p);
  return l ? { ...l } : undefined;
};

test('defaireLeSite : chaque opération est défaite, de la dernière à la première ; une cellule qu’une migration a réécrite depuis est gardée', (t) => {
  const db = copieDImport(t);
  assert.deepEqual([...db.lotsDeLaBase.values()].filter((n) => DEFAITES.includes(n)), [], 'la copie part de l’état d’import : aucune trace défaisable');
  const [a, b] = reperesDecrits(db, 2);
  const alias = ligne(db, 'SELECT * FROM alias ORDER BY page_id, ordre LIMIT 1');
  const LOT1 = '2026-11-01T10:00:00.000Z-essai-1';
  const LOT2 = '2026-11-02T10:00:00.000Z-essai-2';
  // lot 1 : deux définitions réécrites, un mot-clé créé (sa ligne, son repère) ; lot 2 : la première réécrite encore, un autre nom de page supprimé
  noter(db, { lot: LOT1, rang: 1, faitLe: '2026-11-01T10:00:00Z', ...definitionModifiee(a, a.description, 'Plif.') });
  noter(db, { lot: LOT1, rang: 2, faitLe: '2026-11-01T10:00:00Z', ...definitionModifiee(b, b.description, 'Plouf.') });
  motCleCree(9001, 'Essai import').forEach((e, i) => noter(db, { lot: LOT1, rang: 3 + i, faitLe: '2026-11-01T10:00:00Z', ...e }));
  noter(db, { lot: LOT2, rang: 1, faitLe: '2026-11-02T10:00:00Z', ...definitionModifiee(a, 'Plif.', 'Plif plof.') });
  noter(db, { lot: LOT2, rang: 2, faitLe: '2026-11-02T10:00:00Z', table: 'alias', cle: { page_id: alias.page_id, ordre: alias.ordre }, operation: 'supprimer', avant: alias });
  // une migration passée depuis réécrit la seconde définition : sa valeur d'import n'existe plus, la migration a le dernier mot
  db.prepare('UPDATE repere SET definition = ? WHERE mot_cle_id = ?').run('Texte de la migration.', b.id);

  assert.deepEqual(defaireLeSite(db), []);
  assert.equal(definitionDe(db, a), a.description, 'deux lots défaits : la valeur d’import');
  assert.equal(definitionDe(db, b), 'Texte de la migration.', 'réécrite par une migration : gardée');
  assert.equal(ligne(db, 'SELECT id FROM mot_cle WHERE id = 9001'), undefined, 'la ligne insérée par le site est retirée');
  assert.equal(ligne(db, 'SELECT nom FROM repere WHERE mot_cle_id = 9001'), undefined, 'son repère aussi');
  assert.deepEqual(ligne(db, 'SELECT * FROM alias WHERE page_id = ? AND ordre = ?', alias.page_id, alias.ordre), alias, 'la ligne supprimée est remise');
  assert.deepEqual(lotsDuTest(db), [], 'les lots défaits quittent l’historique');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('defaireLeSite : une cellule dont une migration n’a remplacé, après le site, que des fragments de son registre `textes` est défaite, le remplacement repris', (t) => {
  const db = copieDImport(t);
  // une entrée réelle d'un registre `textes` (0122 : la balise reciblée) ; la cellule d'essai est la sienne, prise dans l'état courant de la copie
  // (registre de la 0122, ou ce qu'en garde test/fixtures/registres-sortis.json une fois la migration mixte sortie : ses balises reciblées)
  const [r] = registreDeMigration('0122-retrait-la-montee-de-niveau').textes;
  const ou = Object.keys(r.cle).map((k) => `"${k}" = ?`).join(' AND ');
  const lire = () => db.prepare(`SELECT "${r.col}" AS v FROM "${r.table}" WHERE ${ou}`).get(...Object.values(r.cle))?.v;
  assert.equal(typeof lire(), 'string', `${r.table} ${JSON.stringify(r.cle)} : présente`);
  const IMPORT = `Avant ${r.avant} ; la phrase d’import.`;
  const SITE1 = `Avant ${r.avant} ; la phrase du site.`;
  const SITE2 = `Plus tard ${r.avant} ; la phrase du site.`;
  db.prepare(`UPDATE "${r.table}" SET "${r.col}" = ? WHERE ${ou}`).run(IMPORT, ...Object.values(r.cle));
  noter(db, { lot: '2026-11-01T10:00:00.000Z-essai-r1', rang: 1, faitLe: '2026-11-01T10:00:00Z', table: r.table, cle: r.cle, operation: 'modifier', avant: { [r.col]: IMPORT }, apres: { [r.col]: SITE1 } });
  noter(db, { lot: '2026-11-02T10:00:00.000Z-essai-r2', rang: 1, faitLe: '2026-11-02T10:00:00Z', table: r.table, cle: r.cle, operation: 'modifier', avant: { [r.col]: SITE1 }, apres: { [r.col]: SITE2 } });
  // la migration passée depuis : son remplacement, sur la valeur que le site a laissée
  db.prepare(`UPDATE "${r.table}" SET "${r.col}" = ? WHERE ${ou}`).run(SITE2.split(r.avant).join(r.apres), ...Object.values(r.cle));
  assert.deepEqual(defaireLeSite(db), []);
  assert.equal(lire(), IMPORT.split(r.avant).join(r.apres), 'les deux lots défaits, le remplacement de la migration gardé');

  // une réécriture hors du registre (ou un fragment absent de l'« avant ») : la migration a le dernier mot, la cellule est gardée
  const SANS = 'Une phrase sans le fragment.';
  db.prepare(`UPDATE "${r.table}" SET "${r.col}" = ? WHERE ${ou}`).run(SANS, ...Object.values(r.cle));
  noter(db, { lot: '2026-11-03T10:00:00.000Z-essai-r3', rang: 1, faitLe: '2026-11-03T10:00:00Z', table: r.table, cle: r.cle, operation: 'modifier', avant: { [r.col]: SANS }, apres: { [r.col]: SITE2 } });
  db.prepare(`UPDATE "${r.table}" SET "${r.col}" = ? WHERE ${ou}`).run(SITE2.split(r.avant).join(r.apres), ...Object.values(r.cle));
  assert.deepEqual(defaireLeSite(db), []);
  assert.equal(lire(), SITE2.split(r.avant).join(r.apres), 'le fragment n’est pas dans l’« avant » : gardée');
});

test('defaireLeSite : seules les traces de nature saisie et decision sont défaites ; source, migration et code font partie de l’import (R275)', (t) => {
  const db = copieDImport(t);
  const [a, b, c] = reperesDecrits(db, 3);
  const trace = (rang, nature, decision, m, apres) => noter(db, { lot: `2026-11-0${rang}T10:00:00.000Z-nature-${rang}`, rang: 1, faitLe: `2026-11-0${rang}T10:00:00Z`,
    ...definitionModifiee(m, m.description, apres), nature, decision });
  trace(1, 'saisie', null, a, 'Saisie.');
  trace(2, 'decision', 'R275', b, 'Décision.');
  trace(3, 'source', null, c, 'Source.');
  // ni la migration ni le code ne sont défaits : la ligne qu'ils ont insérée reste
  motCleCree(9003, 'Essai migration').forEach((e, i) => noter(db, { lot: '2026-11-04T10:00:00.000Z-nature-4', rang: 1 + i, faitLe: '2026-11-04T10:00:00Z', nature: 'migration', ...e }));
  motCleCree(9004, 'Essai code').forEach((e, i) => noter(db, { lot: '2026-11-05T10:00:00.000Z-nature-5', rang: 1 + i, faitLe: '2026-11-05T10:00:00Z', nature: 'code', ...e }));
  assert.deepEqual(defaireLeSite(db), []);
  const description = (m) => definitionDe(db, m);
  assert.equal(description(a), a.description, 'saisie défaite');
  assert.equal(description(b), b.description, 'décision défaite');
  assert.equal(description(c), 'Source.', 'une source fait partie de l’import');
  assert.ok(ligne(db, 'SELECT id FROM mot_cle WHERE id = 9003'), 'la ligne d’une migration reste');
  assert.ok(ligne(db, 'SELECT id FROM mot_cle WHERE id = 9004'), 'la ligne du code reste');
  assert.deepEqual(lotsDuTest(db).sort(([x], [y]) => x.localeCompare(y)).map(([, n]) => n), ['source', 'migration', 'code'], 'seuls les lots défaits quittent l’historique');
  assert.ok(historiqueSite(db).vide, 'historiqueSite ne voit plus rien à défaire');
});

test('defaireLeSite et historiqueSite s’accordent : une saisie suivie d’une trace code sur la même cellule n’est pas défaite (la cellule garde la valeur du code)', (t) => {
  const db = copieDImport(t);
  const [a] = reperesDecrits(db, 1);
  noter(db, { lot: '2026-11-01T10:00:00.000Z-accord-1', rang: 1, faitLe: '2026-11-01T10:00:00Z', ...definitionModifiee(a, a.description, 'Saisie.') });
  noter(db, { lot: '2026-11-02T10:00:00.000Z-accord-2', rang: 1, faitLe: '2026-11-02T10:00:00Z', ...definitionModifiee(a, 'Saisie.', 'Code.'), nature: 'code' });
  assert.equal(historiqueSite(db).valeurDImport('repere', { mot_cle_id: a.id }, 'definition'), 'Code.');
  assert.deepEqual(defaireLeSite(db), []);
  assert.equal(definitionDe(db, a), 'Code.', 'les deux aides rendent la valeur du code');
});

test('defaireLeSite { garder } : l’état d’après une migration — les lots gardés restent, avec leur historique ; les suivants sont défaits', (t) => {
  const db = copieDImport(t);
  const [a] = reperesDecrits(db, 1);
  const GARDE = '2026-11-01T10:00:00.000Z-garde';
  const APRES = '2026-11-03T10:00:00.000Z-apres';
  noter(db, { lot: GARDE, rang: 1, faitLe: '2026-11-01T10:00:00Z', ...definitionModifiee(a, a.description, 'Écrit par une décision.') });
  noter(db, { lot: APRES, rang: 1, faitLe: '2026-11-03T10:00:00Z', ...definitionModifiee(a, 'Écrit par une décision.', 'Plif.') });
  motCleCree(9002, 'Essai après').forEach((e, i) => noter(db, { lot: APRES, rang: 2 + i, faitLe: '2026-11-03T10:00:00Z', ...e }));
  assert.deepEqual(defaireLeSite(db, { garder: new Set([GARDE]) }), []);
  assert.equal(definitionDe(db, a), 'Écrit par une décision.');
  assert.equal(ligne(db, 'SELECT id FROM mot_cle WHERE id = 9002'), undefined);
  assert.deepEqual(lotsDuTest(db).map(([lot]) => lot), [GARDE]);
});

test('defaireLeSite, migration 0136 : un lot ancien de mot_cle (libelle, url, description, couleur, icone) se défait sur l’élément — une suppression défaite remet le repère avec les valeurs de l’« avant », une définition modifiée revient sur le repère ou la page', (t) => {
  const db = copieDImport(t);
  // une suppression ancienne d'un mot-clé sans page ni sort : l'entrée porte les colonnes d'avant la 0136 (elle ne s'applique plus : tracer seul)
  const ID = 9005;
  assert.equal(ligne(db, 'SELECT id FROM mot_cle WHERE id = ?', ID), undefined, `${ID} : libre dans la copie`);
  const SUPPRIME = { id: ID, libelle: 'Essai supprimé', cle: 'essai-supprime', url: '/classes/', description: 'Une définition d’essai.', couleur: '#a1b2c3', icone: 'monnaie:ro', verrou: 0 };
  tracer(db, { lot: '2026-11-01T10:00:00.000Z-element-1', rang: 1, faitLe: '2026-11-01T10:00:00Z', table: 'mot_cle', cle: { id: ID }, operation: 'supprimer', avant: SUPPRIME });
  // une définition et un nom modifiés par un lot ancien sur un mot-clé à repère, puis une définition sur un mot-clé de page : la base porte la valeur
  // du lot sur l'élément (la migration 0136 l'y a déplacée)
  const [r, q] = reperesDecrits(db, 2);
  const nom = ligne(db, 'SELECT nom FROM repere WHERE mot_cle_id = ?', r.id).nom;
  db.prepare('UPDATE repere SET definition = ?, nom = ? WHERE mot_cle_id = ?').run('Plif.', 'Essai renommé', r.id);
  tracer(db, { lot: '2026-11-02T10:00:00.000Z-element-2', rang: 1, faitLe: '2026-11-02T10:00:00Z', table: 'mot_cle', cle: { id: r.id }, operation: 'modifier',
    avant: { libelle: nom, description: r.description }, apres: { libelle: 'Essai renommé', description: 'Plif.' } });
  // le second est ancré depuis sur une page (l'import n'en ancre aucun : les ancres viennent du site) : son repère s'efface, sa définition est sur la page
  const p = { ...ligne(db, 'SELECT id FROM page WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1'), mot_cle_id: q.id };
  db.prepare('DELETE FROM repere WHERE mot_cle_id = ?').run(q.id);
  db.prepare('UPDATE page SET mot_cle_id = ?, definition = ? WHERE id = ?').run(q.id, 'Plaf.', p.id);
  tracer(db, { lot: '2026-11-03T10:00:00.000Z-element-3', rang: 1, faitLe: '2026-11-03T10:00:00Z', table: 'mot_cle', cle: { id: q.id }, operation: 'modifier',
    avant: { description: q.description }, apres: { description: 'Plaf.' } });

  assert.deepEqual(defaireLeSite(db), []);
  const remis = lireUnMotCle(db, ID);
  assert.deepEqual({ ...remis, element: { ...remis.element } }, {
    id: ID, cle: SUPPRIME.cle, verrou: 0, monnaie_id: null, libelle: SUPPRIME.libelle, url: SUPPRIME.url, description: SUPPRIME.description,
    couleur: SUPPRIME.couleur, icone: SUPPRIME.icone, element: { table: 'repere', id: ID },
  }, 'la suppression défaite : la ligne du mot-clé et son repère, avec les valeurs de l’« avant »');
  assert.deepEqual(ligne(db, 'SELECT nom, definition FROM repere WHERE mot_cle_id = ?', r.id), { nom, definition: r.description }, 'sur le repère : le nom et la définition d’import');
  assert.equal(ligne(db, 'SELECT definition FROM page WHERE id = ?', p.id).definition, q.description, 'sur la page : la définition d’import');
  assert.equal(ligne(db, 'SELECT 1 AS n FROM repere WHERE mot_cle_id = ?', p.mot_cle_id), undefined, 'un mot-clé de page n’a pas de repère');
  assert.deepEqual(lotsDuTest(db), [], 'les lots défaits quittent l’historique');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('base d’import de la base construite : historique vide, rien d’écarté ; chaque cellule modifiée par le site y a sa valeur d’import (historiqueSite)', () => {
  const imp = baseDImport();
  assert.deepEqual(imp.ecarts, []);
  assert.ok(historiqueSite(imp).vide);
  assert.equal(baseDImport(), imp, 'une copie par processus');
  assert.equal(reglesDImport(), reglesDImport(), 'des règles lues une fois');
  assert.ok(reglesDImport().classes.length > 0 && cheminDImport().endsWith('.db'));
  // l'accord avec valeurDImport : toute cellule que le site a modifiée et qu'aucune migration n'a réécrite entre deux de ses lots, ni depuis (chaque
  // « avant » est l'« après » du lot précédent, la valeur actuelle celle du dernier)
  const courante = new DatabaseSync(cheminBase({ sansExemples: false }), { readOnly: true });
  try {
    const h = historiqueSite(courante);
    const memes = (x, y) => String(x ?? null) === String(y ?? null);
    let comparees = 0;
    for (const e of h.entrees.filter((x) => x.operation === 'modifier')) {
      const ops = h.operations(e.table, e.cle);
      if (ops.some((o) => o.operation !== 'modifier')) continue;
      const actuelle = ligne(courante, `SELECT * FROM "${e.table}" WHERE ${Object.keys(e.cle).map((k) => `"${k}" = ?`).join(' AND ')}`, ...Object.values(e.cle));
      for (const c of Object.keys(e.apres)) {
        const chaine = ops.filter((o) => c in o.apres);
        // une colonne logique d'un lot ancien de mot_cle (libelle, description…) n'est plus une colonne depuis la migration 0136 : elle se défait sur
        // l'élément du mot-clé (cas « sur l'élément », plus bas)
        if (chaine.at(-1) !== e || !actuelle || !(c in actuelle) || !memes(actuelle[c], e.apres[c]) || chaine.some((o, i) => i > 0 && !memes(o.avant[c], chaine[i - 1].apres[c]))) continue;
        assert.equal(texteDImport(e.table, e.cle, c), h.valeurDImport(e.table, e.cle, c), `${e.table} ${e.texte} ${c}`);
        comparees += 1;
      }
    }
    if (!h.vide) assert.ok(comparees > 0, 'des cellules comparées');
  } finally {
    courante.close();
  }
  // l'état d'après la migration 0093 : les lots de sa liste restent (leur historique aussi), tout autre lot est défait
  const garder = lotsAvant('0093');
  const apres = baseDImport({ garder });
  assert.notEqual(apres, imp);
  // hors des lots gardés, seules restent les traces qui font partie de l'import (R275 : source, migration, code)
  for (const [lot, nature] of lotsDe(apres)) assert.ok(garder.has(lot) || !DEFAITES.includes(nature), `${lot} (${nature})`);
  assert.ok(chargerReglesDeFiche(apres).classes.length > 0);
});

test('texteDImport, migration 0136 : une colonne logique d’un mot-clé (libelle, url, description, couleur, icone) se lit sur son élément ; une autre colonne absente reste une erreur', () => {
  const imp = baseDImport();
  // un mot-clé de chaque sorte d'élément que la base d'import connaît : sa page, son sort, son repère
  const ids = [
    ligne(imp, 'SELECT mot_cle_id AS id FROM page WHERE mot_cle_id IS NOT NULL ORDER BY mot_cle_id LIMIT 1'),
    ligne(imp, 'SELECT mot_cle_id AS id FROM sort WHERE mot_cle_id IS NOT NULL ORDER BY mot_cle_id LIMIT 1'),
    ligne(imp, 'SELECT mot_cle_id AS id FROM repere ORDER BY mot_cle_id LIMIT 1'),
  ].filter(Boolean).map((l) => l.id);
  assert.ok(ids.length, 'des mots-clés à lire');
  for (const id of ids) {
    const m = lireUnMotCle(imp, id);
    for (const c of ['libelle', 'url', 'description', 'couleur', 'icone']) assert.equal(texteDImport('mot_cle', { id }, c), m[c], `mot_cle ${id} ${c}`);
    assert.equal(texteDImport('mot_cle', { id }, 'cle'), m.cle, 'une colonne en place se lit dans la table');
  }
  const absent = ligne(imp, 'SELECT max(id) + 1 AS id FROM mot_cle').id;
  assert.equal(texteDImport('mot_cle', { id: absent }, 'libelle'), undefined, 'un mot-clé absent de l’import');
  assert.throws(() => texteDImport('mot_cle', { id: ids[0] }, 'inconnue'), /colonne absente/);
  assert.throws(() => texteDImport('page', { id: 'x' }, 'libelle'), /colonne absente/, 'seul un mot-clé a des colonnes logiques');
});

test('remettreDepuisLImport : une ligne supprimée revient telle qu’à l’import, avec ce qu’elle cite et ce qui la compose ; présente, rien ne change', (t) => {
  // une copie de l'import dont on retire un métier, sa page et ses bonus (comme le site de dev, qui les supprime ensemble)
  const chemin = fichierTemporaire('maverick.db', 'remettre-depuis-l-import', { t });
  copyFileSync(cheminDImport(), chemin);
  const db = new DatabaseSync(chemin);
  t.after(() => db.close());
  const dImport = baseDImport();
  const id = dImport.prepare('SELECT m.id FROM metier m WHERE EXISTS (SELECT 1 FROM metier_bonus b WHERE b.metier_id = m.id) ORDER BY m.id LIMIT 1').get().id;
  const etat = (base) => [
    base.prepare('SELECT * FROM metier WHERE id = ?').get(id), base.prepare('SELECT id, titre, corps_md FROM page WHERE id = ?').get(id),
    base.prepare('SELECT * FROM metier_bonus WHERE metier_id = ? ORDER BY rang, option').all(id),
  ].map((x) => JSON.stringify(x));
  const avant = etat(dImport);
  db.exec('PRAGMA foreign_keys = OFF');
  for (const sql of ['DELETE FROM metier_bonus WHERE metier_id = ?', 'DELETE FROM metier WHERE id = ?', 'DELETE FROM page WHERE id = ?']) db.prepare(sql).run(id);
  db.exec('PRAGMA foreign_keys = ON');
  assert.notDeepEqual(etat(db), avant);
  const remises = remettreDepuisLImport(db, 'metier', { id });
  assert.ok(remises >= 3, `${remises} lignes remises : la page, le métier, ses bonus`);
  assert.deepEqual(etat(db), avant);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], 'aucune référence rompue');
  assert.equal(remettreDepuisLImport(db, 'metier', { id }), 0, 'déjà là : rien');
  assert.throws(() => remettreDepuisLImport(db, 'metier', { id: 'metiers/absent-de-l-import' }), /absente de la base d'import/);
  assert.throws(() => remettreDepuisLImport(db, 'metier', { colonne_inconnue: 'x' }), /clé inconnue/);
});
