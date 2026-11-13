// L'aide test/aide-base-d-import.mjs : la base des règles remise dans son état d'import (demande du propriétaire : les tests ne figent plus les textes
// que le site de dev modifie). Sur une copie dont l'historique est écrit ici : chaque opération défaite (modifier, insérer, supprimer, plusieurs lots
// sur une même cellule), une cellule réécrite depuis par une migration gardée, des lots gardés (l'état d'après une migration) ; puis, sur la base
// construite (quels que soient ses textes), l'accord avec historiqueSite#valeurDImport et le cache par processus.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { baseDImport, cheminDImport, defaireLeSite, lotsAvant, reglesDImport, remettreDepuisLImport, texteDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

/** Une copie de la base construite, ramenée à son état d'import (historique vide), ouverte en écriture. */
function copieDImport(t) {
  const chemin = fichierTemporaire('import.db', 'aide-import-', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const db = new DatabaseSync(chemin);
  t.after(() => db.isOpen && db.close());
  defaireLeSite(db);
  return db;
}

/** Une opération du site : appliquée à la table, puis notée dans historique_modification (lot, rang, instant). */
function noter(db, { lot, rang, faitLe, table, cle, operation, avant = null, apres = null }) {
  const ou = Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ');
  if (operation === 'modifier') db.prepare(`UPDATE "${table}" SET ${Object.keys(apres).map((c) => `"${c}" = ?`).join(', ')} WHERE ${ou}`).run(...Object.values(apres), ...Object.values(cle));
  if (operation === 'inserer') db.prepare(`INSERT INTO "${table}" (${Object.keys(apres).map((c) => `"${c}"`).join(', ')}) VALUES (${Object.keys(apres).map(() => '?').join(', ')})`).run(...Object.values(apres));
  if (operation === 'supprimer') db.prepare(`DELETE FROM "${table}" WHERE ${ou}`).run(...Object.values(cle));
  db.prepare('INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)')
    .run(lot, rang, faitLe, 'Essai', table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres));
}

const ligne = (db, sql, ...p) => {
  const l = db.prepare(sql).get(...p);
  return l ? { ...l } : undefined;
};

test('defaireLeSite : chaque opération est défaite, de la dernière à la première ; une cellule qu’une migration a réécrite depuis est gardée', (t) => {
  const db = copieDImport(t);
  assert.equal(db.prepare('SELECT count(*) AS n FROM historique_modification').get().n, 0, 'la copie part de l’état d’import');
  const [a, b] = db.prepare('SELECT id, description FROM mot_cle WHERE description IS NOT NULL ORDER BY id LIMIT 2').all().map((r) => ({ ...r }));
  const alias = ligne(db, 'SELECT * FROM alias ORDER BY page_id, ordre LIMIT 1');
  const LOT1 = '2026-11-01T10:00:00.000Z-essai-1';
  const LOT2 = '2026-11-02T10:00:00.000Z-essai-2';
  // lot 1 : deux définitions réécrites, un mot-clé créé ; lot 2 : la première réécrite encore, un autre nom de page supprimé
  noter(db, { lot: LOT1, rang: 1, faitLe: '2026-11-01T10:00:00Z', table: 'mot_cle', cle: { id: a.id }, operation: 'modifier', avant: { description: a.description }, apres: { description: 'Plif.' } });
  noter(db, { lot: LOT1, rang: 2, faitLe: '2026-11-01T10:00:00Z', table: 'mot_cle', cle: { id: b.id }, operation: 'modifier', avant: { description: b.description }, apres: { description: 'Plouf.' } });
  // un mot-clé d'essai (id entier, migration 0113 ; 9001 et suivants : test/aide-mots-cles.mjs#idDEssai)
  noter(db, { lot: LOT1, rang: 3, faitLe: '2026-11-01T10:00:00Z', table: 'mot_cle', cle: { id: 9001 }, operation: 'inserer',
    apres: { id: 9001, libelle: 'Essai import', cle: 'essai-import', description: null } });
  noter(db, { lot: LOT2, rang: 1, faitLe: '2026-11-02T10:00:00Z', table: 'mot_cle', cle: { id: a.id }, operation: 'modifier', avant: { description: 'Plif.' }, apres: { description: 'Plif plof.' } });
  noter(db, { lot: LOT2, rang: 2, faitLe: '2026-11-02T10:00:00Z', table: 'alias', cle: { page_id: alias.page_id, ordre: alias.ordre }, operation: 'supprimer', avant: alias });
  // une migration passée depuis réécrit la seconde définition : sa valeur d'import n'existe plus, la migration a le dernier mot
  db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run('Texte de la migration.', b.id);

  assert.deepEqual(defaireLeSite(db), []);
  assert.equal(ligne(db, 'SELECT description FROM mot_cle WHERE id = ?', a.id).description, a.description, 'deux lots défaits : la valeur d’import');
  assert.equal(ligne(db, 'SELECT description FROM mot_cle WHERE id = ?', b.id).description, 'Texte de la migration.', 'réécrite par une migration : gardée');
  assert.equal(ligne(db, 'SELECT id FROM mot_cle WHERE id = 9001'), undefined, 'la ligne insérée par le site est retirée');
  assert.deepEqual(ligne(db, 'SELECT * FROM alias WHERE page_id = ? AND ordre = ?', alias.page_id, alias.ordre), alias, 'la ligne supprimée est remise');
  assert.equal(db.prepare('SELECT count(*) AS n FROM historique_modification').get().n, 0, 'les lots défaits quittent l’historique');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('defaireLeSite : une cellule dont une migration n’a remplacé, après le site, que des fragments de son registre `textes` est défaite, le remplacement repris', (t) => {
  const db = copieDImport(t);
  // une entrée réelle d'un registre `textes` (0122 : la balise reciblée) ; la cellule d'essai est la sienne, prise dans l'état courant de la copie
  const [r] = JSON.parse(readFileSync(new URL('../../data/migrations/0122-retrait-la-montee-de-niveau.json', import.meta.url), 'utf8')).textes;
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

test('defaireLeSite { garder } : l’état d’après une migration — les lots gardés restent, avec leur historique ; les suivants sont défaits', (t) => {
  const db = copieDImport(t);
  const a = ligne(db, 'SELECT id, description FROM mot_cle WHERE description IS NOT NULL ORDER BY id LIMIT 1');
  const GARDE = '2026-11-01T10:00:00.000Z-garde';
  const APRES = '2026-11-03T10:00:00.000Z-apres';
  noter(db, { lot: GARDE, rang: 1, faitLe: '2026-11-01T10:00:00Z', table: 'mot_cle', cle: { id: a.id }, operation: 'modifier', avant: { description: a.description }, apres: { description: 'Écrit par une décision.' } });
  noter(db, { lot: APRES, rang: 1, faitLe: '2026-11-03T10:00:00Z', table: 'mot_cle', cle: { id: a.id }, operation: 'modifier', avant: { description: 'Écrit par une décision.' }, apres: { description: 'Plif.' } });
  noter(db, { lot: APRES, rang: 2, faitLe: '2026-11-03T10:00:00Z', table: 'mot_cle', cle: { id: 9002 }, operation: 'inserer',
    apres: { id: 9002, libelle: 'Essai après', cle: 'essai-apres', description: null } });
  assert.deepEqual(defaireLeSite(db, { garder: new Set([GARDE]) }), []);
  assert.equal(ligne(db, 'SELECT description FROM mot_cle WHERE id = ?', a.id).description, 'Écrit par une décision.');
  assert.equal(ligne(db, 'SELECT id FROM mot_cle WHERE id = 9002'), undefined);
  assert.deepEqual(db.prepare('SELECT DISTINCT lot_id FROM historique_modification').all().map((r) => r.lot_id), [GARDE]);
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
        if (chaine.at(-1) !== e || !actuelle || !memes(actuelle[c], e.apres[c]) || chaine.some((o, i) => i > 0 && !memes(o.avant[c], chaine[i - 1].apres[c]))) continue;
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
  for (const { lot_id: lot } of apres.prepare('SELECT DISTINCT lot_id FROM historique_modification').all()) assert.ok(garder.has(lot), lot);
  assert.ok(chargerReglesDeFiche(apres).classes.length > 0);
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
