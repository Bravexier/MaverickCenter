// Rejeu du journal et lignes « fantômes » (serveur/edition-journal.mjs#rejouer) : une ligne que le journal en attente crée puis supprime n'est pas
// insérée, et une référence vers elle n'est pas rompue tant que la ligne existerait ; rien n'en est noté, et à la fin d'une passe un fantôme dont une
// suppression est en conflit, ou qu'une référence cite encore, est rejoué comme une ligne ordinaire. Les scénarios viennent de la revue adverse de la
// branche (lots du site de dev dans l'ordre où l'interface les envoie, livraison qui change un bloc que l'un d'eux touchait) : le résultat ne laisse
// aucune clé étrangère rompue, une création dont la suppression est en conflit existe entière, et il ne dépend pas d'une reconstruction intermédiaire.
// Les tests lisent l'état avant d'écrire et prennent des noms absents de la base (le site de dev peut l'avoir modifiée).
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { normalize } from '../src/lib/text.mjs';

const ROWS = fileURLToPath(new URL('../../data/rows', import.meta.url));
const racine = mkdtempSync(join(tmpdir(), 'maverick-rejeu-fantomes-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
const ouvertes = [];
after(() => ouvertes.forEach((b) => b.isOpen && b.close()));

/** Une base vivante neuve (règles modifiées d'abord par `regles(db)`, comme une livraison) qui reçoit le journal de `source` tel quel, puis le rejoue. */
function rebatir(source, regles = null) {
  const neuve = vivante();
  ouvertes.push(neuve);
  if (regles) {
    neuve.exec('PRAGMA foreign_keys = OFF');
    regles(neuve);
    neuve.exec('PRAGMA foreign_keys = ON');
  }
  for (const l of source.prepare('SELECT * FROM modification_lot').all()) {
    neuve.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of source.prepare('SELECT * FROM modification').all()) {
    neuve.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.etat, m.detail, m.apercu);
  }
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  return { base: neuve, bilan };
}
const serviceDe = (base, page = 'chronologie/') => (operations) => {
  const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page, operations }) }, { base: () => base, etat: () => ({}), edition: true });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
const libre = (base, table, colonne, texte) => {
  let t = texte;
  for (let i = 2; base.prepare(`SELECT 1 FROM ${table} WHERE ${colonne} = ?`).get(colonne.endsWith('_cle') ? normalize(t) : t); i += 1) t = `${texte} ${i}`;
  return t;
};
const rompues = (base) => base.prepare('PRAGMA foreign_key_check').all().map((x) => `${x.table}->${x.parent}`);
const existe = (base, sql, ...p) => Boolean(base.prepare(sql).get(...p));
/** Des blocs de description sans date surlignée (leur texte se réécrit librement). */
const blocs = (base, n) => base.prepare('SELECT evenement_id, rang FROM evenement_extrait WHERE date_brut IS NULL ORDER BY evenement_id, rang LIMIT ?').all(n).map((b) => ({ ...b }));
/** Une livraison qui corrige le texte de ce bloc : le lot du site de dev qui le réécrivait part en conflit. */
const corrigerLeBloc = (bloc) => (db) => db.prepare('UPDATE evenement_extrait SET texte = texte || ? WHERE evenement_id = ? AND rang = ?').run(' (corrigé)', bloc.evenement_id, bloc.rang);
const creerUnMetier = (base, lot, texte) => {
  const nom = libre(base, 'metier', 'nom', texte);
  const id = lot([{ op: 'creer', entite: 'metier', valeurs: { nom } }]).crees[0].id;
  return { nom, id, page: base.prepare("SELECT id FROM page WHERE type = 'metiers' AND titre = ?").get(nom).id };
};

test('un lien posé vers un métier créé (L2), retiré par un autre lot (L3) qui part en conflit, puis le métier supprimé (L4) : le métier reste, le lien aussi, rien de rompu — avec ou sans reconstruction intermédiaire', () => {
  const base = vivante();
  ouvertes.push(base);
  const lot = serviceDe(base);
  const m = creerUnMetier(base, lot, 'Métier fantôme lien');
  const [bloc] = blocs(base, 1);
  lot([{ op: 'modifier', table: 'evenement_extrait', cle: bloc, valeurs: { page_id: m.page } }]);
  lot([{ op: 'modifier', table: 'evenement_extrait', cle: bloc, valeurs: { texte: 'Texte réécrit sur le site.', page_id: '' } }]);
  lot([{ op: 'supprimer', entite: 'metier', cle: { id: m.id } }]);
  const lien = (b) => b.prepare('SELECT page_id FROM evenement_extrait WHERE evenement_id = ? AND rang = ?').get(bloc.evenement_id, bloc.rang).page_id;
  const direct = rebatir(base, corrigerLeBloc(bloc));
  const intermediaire = rebatir(base);
  assert.equal(existe(intermediaire.base, 'SELECT 1 FROM metier WHERE id = ?', m.id), false, 'règles sans rapport : le métier est supprimé');
  const ensuite = rebatir(intermediaire.base, corrigerLeBloc(bloc));
  for (const [titre, r] of [['directement', direct], ['après une reconstruction intermédiaire', ensuite]]) {
    assert.deepEqual(rompues(r.base), [], titre);
    assert.equal(existe(r.base, 'SELECT 1 FROM page WHERE id = ?', m.page), true, `${titre} : la suppression (après le retrait du lien en conflit) part en conflit`);
    assert.equal(existe(r.base, 'SELECT 1 FROM metier WHERE id = ?', m.id), true, titre);
    assert.equal(lien(r.base), m.page, `${titre} : le lien de L2 tient`);
  }
});

test('une ligne créée, supprimée puis recréée (la source du jour « Site de dev › édition du … ») : sa recréation en conflit ne laisse aucune référence vers elle', () => {
  const base = vivante();
  ouvertes.push(base);
  const lot = serviceDe(base);
  const a = creerUnMetier(base, lot, 'Métier fantôme A');
  lot([{ op: 'supprimer', entite: 'metier', cle: { id: a.id } }]);
  const [bloc] = blocs(base, 1);
  const nomB = libre(base, 'metier', 'nom', 'Métier fantôme B');
  lot([{ op: 'creer', entite: 'metier', valeurs: { nom: nomB } }, { op: 'modifier', table: 'evenement_extrait', cle: bloc, valeurs: { texte: 'Réécrit.' } }]);
  const c = creerUnMetier(base, lot, 'Métier fantôme C');
  const source = base.prepare('SELECT source_id FROM page_source WHERE page_id = ?').get(c.page).source_id;
  const r = rebatir(base, corrigerLeBloc(bloc));
  assert.deepEqual(rompues(r.base), []);
  assert.equal(existe(r.base, 'SELECT 1 FROM metier WHERE nom = ?', nomB), false, 'B part avec son lot en conflit');
  // C citait la source sans la créer (elle existait) : sans elle, son lot est en conflit plutôt que de garder une référence rompue
  assert.equal(existe(r.base, 'SELECT 1 FROM metier WHERE id = ?', c.id), existe(r.base, 'SELECT 1 FROM source WHERE id = ?', source));
});

test('une création dont la suppression part en conflit existe entière (page, métier, sources, mots-clés), et le lien qui la citait tient', () => {
  const base = vivante();
  ouvertes.push(base);
  const lot = serviceDe(base);
  const m = creerUnMetier(base, lot, 'Métier fantôme entier');
  // ce que la création a écrit, ligne par ligne
  const lignes = (b) => ({
    page: b.prepare('SELECT count(*) AS n FROM page WHERE id = ?').get(m.page).n,
    metier: b.prepare('SELECT count(*) AS n FROM metier WHERE id = ?').get(m.id).n,
    page_source: b.prepare('SELECT count(*) AS n FROM page_source WHERE page_id = ?').get(m.page).n,
    page_tag: b.prepare('SELECT count(*) AS n FROM page_tag WHERE page_id = ?').get(m.page).n,
    page_entite: b.prepare('SELECT count(*) AS n FROM page_entite WHERE page_id = ?').get(m.page).n,
  });
  const creee = lignes(base);
  const [lie, autre] = blocs(base, 2);
  lot([{ op: 'modifier', table: 'evenement_extrait', cle: lie, valeurs: { page_id: m.page } }]);
  lot([{ op: 'modifier', table: 'evenement_extrait', cle: autre, valeurs: { texte: 'Réécrit.' } }, { op: 'supprimer', entite: 'metier', cle: { id: m.id } }]);
  const r = rebatir(base, corrigerLeBloc(autre));
  assert.deepEqual(rompues(r.base), []);
  assert.equal(lignes(base).metier, 0, 'supprimé sur le site de dev');
  assert.deepEqual(lignes(r.base), creee);
  assert.ok(creee.page && creee.metier && creee.page_source, JSON.stringify(creee));
  assert.equal(r.base.prepare('SELECT page_id FROM evenement_extrait WHERE evenement_id = ? AND rang = ?').get(lie.evenement_id, lie.rang).page_id, m.page);
});

test('sans citation : un événement créé puis supprimé dans un lot en conflit est là, à chaque reconstruction, et le rapatriement l’écrit', () => {
  const base = vivante();
  ouvertes.push(base);
  const lot = serviceDe(base);
  const e = lot([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: libre(base, 'evenement', 'titre', 'Événement fantôme'), description: 'Texte.' } }]).crees[0].id;
  const [bloc] = blocs(base, 1);
  lot([{ op: 'modifier', table: 'evenement_extrait', cle: bloc, valeurs: { texte: 'Réécrit.' } }, { op: 'supprimer', entite: 'evenement', cle: { id: e } }]);
  const premiere = rebatir(base, corrigerLeBloc(bloc));
  assert.equal(existe(premiere.base, 'SELECT 1 FROM evenement WHERE id = ?', e), true, '1re reconstruction');
  const seconde = rebatir(premiere.base, corrigerLeBloc(bloc));
  assert.equal(existe(seconde.base, 'SELECT 1 FROM evenement WHERE id = ?', e), true, '2e reconstruction');
  const rows = join(mkdtempSync(join(racine, 'rows-')), 'rows');
  cpSync(ROWS, rows, { recursive: true });
  const res = appliquerJournal(journalExporte(seconde.base), { rows });
  assert.equal(res.ecrit, true, JSON.stringify(res.conflits));
  assert.ok(readFileSync(join(rows, 'evenement.sql'), 'utf8').includes(`'${e}'`), 'data/rows a l’événement, comme la base vivante');
});

test('fusions en chaîne (S dans N créé, puis N dans M) que les règles neuves privent de M : même résultat avec ou sans reconstruction intermédiaire, rien de rompu', () => {
  const base = vivante();
  ouvertes.push(base);
  const lot = serviceDe(base, 'recherche/');
  const proteges = [...MOTS_CLES_PROTEGES.keys()];
  const choisir = (sauf) => base.prepare(`SELECT m.id FROM mot_cle m WHERE m.libelle_cle NOT IN (${proteges.map(() => '?').join(', ')}) AND m.id NOT IN (${sauf.map(() => '?').join(', ')})
    AND (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) BETWEEN 1 AND 3
    AND NOT EXISTS (SELECT 1 FROM page_tag a JOIN page_tag b ON a.page_id = b.page_id WHERE a.tag_id = m.id AND b.tag_id IN (${sauf.map(() => '?').join(', ')}))
    ORDER BY m.id LIMIT 1`).get(...proteges, ...sauf, ...sauf).id;
  const n = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libre(base, 'mot_cle', 'libelle_cle', 'Essai fantôme N') } }]).crees[0].id;
  const s = choisir([n]);
  const m = choisir([n, s]);
  const pagesDeS = base.prepare('SELECT page_id, ordre FROM page_tag WHERE tag_id = ?').all(s).map((x) => ({ ...x }));
  lot([{ op: 'fusionner_mots_cles', mot_cle: s, dans: n }]);
  lot([{ op: 'fusionner_mots_cles', mot_cle: n, dans: m }]);
  const sansM = (db) => {
    db.prepare('DELETE FROM page_tag WHERE tag_id = ?').run(m);
    db.prepare('DELETE FROM mot_cle WHERE id = ?').run(m);
  };
  const etat = (r) => ({
    n: existe(r.base, 'SELECT 1 FROM mot_cle WHERE id = ?', n),
    pages: pagesDeS.map((p) => r.base.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?').get(p.page_id, p.ordre)?.tag_id ?? null),
    rompues: rompues(r.base),
  });
  const direct = etat(rebatir(base, sansM));
  const ensuite = etat(rebatir(rebatir(base).base, sansM));
  assert.deepEqual(direct.rompues, []);
  assert.deepEqual(ensuite, direct);
  assert.deepEqual(direct, { n: true, pages: pagesDeS.map(() => n), rompues: [] }, 'la fusion dans M (absent) part en conflit : N et ses pages restent');
});

test('lot d’avant la migration 0043 en conflit : le mot-clé qu’il faisait créer n’existe pas, et les lots qui s’en servent (renommage, fusion) partent avec lui — pareil à chaque reconstruction, rapatriement sans conflit', () => {
  const base = vivante();
  ouvertes.push(base);
  const page = base.prepare("SELECT id FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1 OFFSET 5").get().id;
  const ordre = base.prepare('SELECT max(ordre) AS m FROM page_tag WHERE page_id = ?').get(page).m + 1;
  const libelle = libre(base, 'mot_cle', 'libelle_cle', 'Voie fantôme');
  const v = normalize(libelle);
  base.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES ('2026-10-01T09:00:00.000Z-v', '2026-10-01T09:00:00Z', NULL, 'x', 'avant 0043')").run();
  base.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES ('2026-10-01T09:00:00.000Z-v', 1, 'page_tag', ?, 'inserer', NULL, ?, 'en_attente')")
    .run(JSON.stringify({ page_id: page, ordre }), JSON.stringify({ page_id: page, ordre, tag_id: v, libelle }));
  const autre = base.prepare('SELECT id FROM mot_cle WHERE id NOT IN (SELECT tag_id FROM page_tag WHERE page_id = ?) ORDER BY id LIMIT 1').get(page).id;
  // les règles neuves posent un autre mot-clé sur la page à cet ordre : le lot d'avant 0043 y trouve une autre ligne
  const reglesChangees = (db) => db.prepare('INSERT INTO page_tag (page_id, ordre, tag_id) VALUES (?, ?, ?)').run(page, ordre, autre);
  const etats = (b) => b.prepare('SELECT m.lot_id, m.table_nom, m.operation, m.etat FROM modification m ORDER BY m.lot_id, m.rang').all().map((x) => `${x.table_nom}:${x.operation}=${x.etat}`);

  const p1 = rebatir(base);
  assert.equal(existe(p1.base, 'SELECT 1 FROM mot_cle WHERE id = ?', v), true, 'le rejeu crée le mot-clé du lot d’avant 0043');
  // A : le site de dev renomme ce mot-clé
  const a = rebatir(p1.base);
  serviceDe(a.base, 'recherche/')([{ op: 'modifier', table: 'mot_cle', cle: { id: v }, valeurs: { libelle: `${libelle} renommée` }, avant: { libelle } }]);
  const a2 = rebatir(a.base, reglesChangees);
  assert.equal(existe(a2.base, 'SELECT 1 FROM mot_cle WHERE id = ?', v), false);
  assert.deepEqual(etats(a2.base), ['page_tag:inserer=conflit', 'mot_cle:modifier=conflit']);
  assert.deepEqual(rompues(a2.base), []);
  const rows = join(mkdtempSync(join(racine, 'rows-')), 'rows');
  cpSync(ROWS, rows, { recursive: true });
  const res = appliquerJournal(journalExporte(a2.base), { rows });
  assert.deepEqual(res.conflits, []);
  // B : le site de dev fusionne un mot-clé S dans ce mot-clé
  const proteges = [...MOTS_CLES_PROTEGES.keys()];
  const s = p1.base.prepare(`SELECT m.id FROM mot_cle m WHERE m.libelle_cle NOT IN (${proteges.map(() => '?').join(', ')}) AND (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) BETWEEN 1 AND 3
    AND NOT EXISTS (SELECT 1 FROM page_tag t WHERE t.tag_id = m.id AND t.page_id = ?) ORDER BY m.id LIMIT 1`).get(...proteges, page).id;
  serviceDe(p1.base, 'recherche/')([{ op: 'fusionner_mots_cles', mot_cle: s, dans: v }]);
  const b2 = rebatir(p1.base, reglesChangees);
  const b3 = rebatir(b2.base, reglesChangees);
  for (const [titre, r] of [['2e reconstruction', b2], ['3e reconstruction', b3]]) {
    assert.equal(existe(r.base, 'SELECT 1 FROM mot_cle WHERE id = ?', v), false, titre);
    assert.equal(existe(r.base, 'SELECT 1 FROM mot_cle WHERE id = ?', s), true, `${titre} : la fusion part en conflit, S reste`);
    assert.deepEqual(rompues(r.base), [], titre);
  }
  assert.deepEqual(etats(b3.base), etats(b2.base));
});
