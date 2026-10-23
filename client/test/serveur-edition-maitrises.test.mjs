// Les sources de maîtrise d'arme quand le site de dev modifie les règles (décisions R148 à R151, R154 ; migration 0073) : maitrise_arme_part,
// maitrise_arme_part_famille et capacite_nm_gagne restent celles que le lecteur de lib/maitrise-arme.mjs tire de la base (comme
// test/maitrise-arme-sources.test.mjs sur data/rows) après chaque écriture qui change ce qu'il lit — maîtrises d'une classe, effet d'un don, don créé ou
// supprimé (serveur/edition-maitrises.mjs, notées au journal) — et après le rejeu d'un lot noté avant 0073, qui ne les écrivait pas
// (sourcesRefaitesParLeLot, hors journal). La base vivante part des règles de data/rows, où le site de dev a pu modifier ou supprimer : les dons d'essai
// sont créés, les lignes modifiées sont lues avant d'écrire.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { TABLES_DES_SOURCES } from '../serveur/edition-maitrises.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { idDeSourceDeClasse, lireDon, lireLigneDeClasse, nmGagnesDuDon } from '../src/lib/maitrise-arme.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-maitrises-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const ouvertes = [];
after(() => ouvertes.forEach((b) => b.isOpen && b.close()));
const vivante = () => {
  const b = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  ouvertes.push(b);
  return b;
};
const appel = (base, operations, page = 'classes/x') => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
  corps: JSON.stringify({ page, operations }) }, { base: () => base, etat: () => ({}), edition: true });
const enregistrer = (base, operations) => {
  const r = appel(base, operations);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
const q = (base, sql, ...p) => base.prepare(sql).all(...p).map((l) => ({ ...l }));

/** Les tables des sources, et ce que le lecteur rejoué sur toute la base en tire (test/maitrise-arme-sources.test.mjs#relire) : { tables, lecteur }. */
function sources(base) {
  const familles = q(base, 'SELECT id, nom, maitrisable, categorie FROM arme_famille ORDER BY ordre');
  const parts = [];
  const options = [];
  const ajouter = (sourceId, origine, lu) => {
    for (const p of lu?.parts ?? []) {
      parts.push({ source_id: sourceId, rang: p.rang, ...origine, genre: p.genre, points: p.points, arme_famille_id: p.famille, limite_famille: p.limite });
      for (const id of p.options) options.push({ source_id: sourceId, rang: p.rang, arme_famille_id: id });
    }
  };
  for (const l of q(base, 'SELECT * FROM classe_maitrise_arme')) ajouter(idDeSourceDeClasse(l.classe_id, l.rang), { capacite_id: null, classe_id: l.classe_id, classe_rang: l.rang }, lireLigneDeClasse(l, familles));
  const dons = q(base, 'SELECT id, effet FROM capacite');
  for (const d of dons) ajouter(d.id, { capacite_id: d.id, classe_id: null, classe_rang: null }, lireDon(d.effet, familles));
  const ordre = (a, b) => (a.source_id < b.source_id ? -1 : a.source_id > b.source_id ? 1 : a.rang - b.rang || String(a.arme_famille_id).localeCompare(String(b.arme_famille_id)));
  return {
    tables: {
      parts: q(base, 'SELECT * FROM maitrise_arme_part').sort(ordre),
      options: q(base, 'SELECT * FROM maitrise_arme_part_famille').sort(ordre),
      nm: q(base, 'SELECT capacite_id, nm FROM capacite_nm_gagne ORDER BY capacite_id'),
    },
    lecteur: {
      parts: parts.sort(ordre),
      options: options.sort(ordre),
      nm: dons.map((d) => ({ capacite_id: d.id, nm: nmGagnesDuDon(d.effet) })).filter((d) => d.nm > 0).sort((a, b) => (a.capacite_id < b.capacite_id ? -1 : 1)),
    },
  };
}
const sourcesJustes = (base, message) => {
  const { tables, lecteur } = sources(base);
  assert.deepEqual(tables, lecteur, message);
};
const partsDe = (base, sourceId) => q(base, 'SELECT rang, genre, points, arme_famille_id, limite_famille FROM maitrise_arme_part WHERE source_id = ? ORDER BY rang', sourceId);
const optionsDe = (base, sourceId) => q(base, 'SELECT arme_famille_id FROM maitrise_arme_part_famille WHERE source_id = ? ORDER BY arme_famille_id', sourceId).map((o) => o.arme_famille_id);
const maitrisables = (base) => q(base, 'SELECT id FROM arme_famille WHERE maitrisable = 1 ORDER BY id').map((f) => f.id);
/** Le journal du dernier lot : [table, opération] dans l'ordre. */
const dernierLot = (base) => q(base, `SELECT table_nom, operation, cle FROM modification WHERE lot_id = (SELECT id FROM modification_lot ORDER BY fait_le DESC, id DESC LIMIT 1)
  ORDER BY rang`);

/** Un nom de don libre dans la classe (pages capacites/<classe>-<nom> et nom). */
const nomLibre = (base, classeId, nom) => {
  const slug = classeId.slice(classeId.indexOf('/') + 1);
  let n = nom;
  for (let i = 2; base.prepare('SELECT 1 FROM capacite WHERE (classe_id = ? AND nom = ?) OR id = ?').get(classeId, n, `capacites/${slug}-${normalize(n)}`); i += 1) n = `${nom} ${i}`;
  return n;
};
/** Crée un don hors spécialité au niveau 20 de `classeId`, avec cet effet ; rend son id. */
const creerDon = (base, classeId, nom, effet) => enregistrer(base, [{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classeId, niveau: '20', nom: nomLibre(base, classeId, nom), type: 'Passif', effet } }])
  .crees[0].id;
const modifierDon = (base, id, effet) => enregistrer(base, [{ op: 'modifier', table: 'capacite', cle: { id }, valeurs: { effet } }]);

/** Une base vivante neuve qui reçoit le journal de `source` (sans les écritures que `garder` écarte), rejoué clés coupées (comme base-vivante.mjs#transferer). */
function rebatir(source, garder = () => true) {
  const neuve = vivante();
  for (const l of q(source, 'SELECT * FROM modification_lot')) {
    neuve.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  let rang = 0;
  let lot = null;
  for (const m of q(source, 'SELECT * FROM modification ORDER BY lot_id, rang').filter(garder)) {
    rang = m.lot_id === lot ? rang + 1 : 1;
    lot = m.lot_id;
    neuve.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, 'en_attente', null, m.apercu);
  }
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  const sortie = {};
  const bilan = rejouerLeJournal(neuve, sortie);
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  return { base: neuve, bilan, sortie };
}
/** Un journal comme le notait le service avant la migration 0073 : sans les sources de maîtrise d'arme. */
const avant0073 = (m) => !TABLES_DES_SOURCES.includes(m.table_nom);

test('un don dont l’effet passe de « +2 points de maîtrise à répartir » à « +2 points de maîtrise Arcs » change de parts (R150, R151) ; notées au journal', () => {
  const base = vivante();
  const id = creerDon(base, 'classes/archer', 'Essai de maîtrise', '+7% Arc.');
  assert.deepEqual(partsDe(base, id), [], 'un don sans point de maîtrise : aucune part');
  modifierDon(base, id, '+7% Arc, +2 points de maîtrise à répartir.');
  assert.deepEqual(partsDe(base, id), [{ rang: 1, genre: 'choix', points: 2, arme_famille_id: null, limite_famille: null }]);
  assert.deepEqual(optionsDe(base, id), maitrisables(base), 'à répartir : toutes les familles maîtrisables, sans ARME DE MONSTRES (R45, R150)');
  assert.ok(!maitrisables(base).includes('arme-de-monstres'));
  modifierDon(base, id, '+7% Arc, +2 points de maîtrise Arcs.');
  assert.deepEqual(partsDe(base, id), [{ rang: 1, genre: 'imposee', points: 2, arme_famille_id: 'arc', limite_famille: null }]);
  assert.deepEqual(optionsDe(base, id), []);
  // les options parties avant que la part ne change, au journal (rejouées sur data/rows par db:appliquer-edition et la mise à jour)
  const lot = dernierLot(base).filter((m) => TABLES_DES_SOURCES.includes(m.table_nom));
  assert.deepEqual([...new Set(lot.map((m) => `${m.table_nom} ${m.operation}`))], ['maitrise_arme_part_famille supprimer', 'maitrise_arme_part modifier']);
  sourcesJustes(base);
});

test('un don créé, modifié puis supprimé : ses parts et ses NM gagnés (R154) suivent, et il n’en laisse aucune ; le journal les retire avant le don', () => {
  const base = vivante();
  const id = creerDon(base, 'classes/archer', 'Essai de NM', 'Gagne 2 niveaux de maîtrise (NM), +1 point de maîtrise d’arme à distance au choix.');
  assert.deepEqual(partsDe(base, id), [{ rang: 1, genre: 'choix', points: 1, arme_famille_id: null, limite_famille: null }]);
  assert.deepEqual(optionsDe(base, id), q(base, "SELECT id FROM arme_famille WHERE maitrisable = 1 AND categorie = 'distance' ORDER BY id").map((f) => f.id));
  assert.deepEqual(q(base, 'SELECT nm FROM capacite_nm_gagne WHERE capacite_id = ?', id), [{ nm: 2 }]);
  modifierDon(base, id, 'Gagne 3 niveaux de maîtrise (NM).');
  assert.deepEqual(partsDe(base, id), []);
  assert.deepEqual(q(base, 'SELECT nm FROM capacite_nm_gagne WHERE capacite_id = ?', id), [{ nm: 3 }]);
  modifierDon(base, id, '+1 maîtrise Dague, Gagne 1 niveau de maîtrise (NM).');
  sourcesJustes(base);
  enregistrer(base, [{ op: 'supprimer', entite: 'capacite', cle: { id } }]);
  assert.deepEqual(partsDe(base, id), []);
  assert.deepEqual(q(base, 'SELECT * FROM capacite_nm_gagne WHERE capacite_id = ?', id), []);
  const lot = dernierLot(base).map((m) => m.table_nom);
  for (const t of ['maitrise_arme_part', 'capacite_nm_gagne']) assert.ok(lot.indexOf(t) >= 0 && lot.indexOf(t) < lot.indexOf('capacite'), `${t} retirée avant le don`);
  sourcesJustes(base);
});

test('une ligne de maîtrise d’une classe modifiée refait ses parts ; une ligne retirée, les siennes avant elle (R148, R150)', () => {
  const base = vivante();
  const classe = 'classes/guerrier';
  const avant = q(base, 'SELECT maitrise_arme FROM classe WHERE id = ?', classe)[0].maitrise_arme;
  enregistrer(base, [{ op: 'modifier', table: 'classe', cle: { id: classe }, valeurs: {
    maitrise_arme: '- 1 maîtrise Hache\n- 1 maîtrise arme contact au choix (sauf Hache)\n- 2 maîtrises à répartir (1 maximum dans une seule)',
  } }]);
  assert.deepEqual(partsDe(base, idDeSourceDeClasse(classe, 1)), [{ rang: 1, genre: 'imposee', points: 1, arme_famille_id: 'hache', limite_famille: null }]);
  assert.ok(!optionsDe(base, idDeSourceDeClasse(classe, 2)).includes('hache'), 'sans son « sauf » (R138)');
  assert.deepEqual(partsDe(base, idDeSourceDeClasse(classe, 3)), [{ rang: 1, genre: 'choix', points: 2, arme_famille_id: null, limite_famille: 1 }]);
  assert.deepEqual(optionsDe(base, idDeSourceDeClasse(classe, 3)), maitrisables(base));
  sourcesJustes(base);
  enregistrer(base, [{ op: 'modifier', table: 'classe', cle: { id: classe }, valeurs: { maitrise_arme: '- 1 maîtrise Épée\n- 1 maîtrise arme contact au choix (sauf Épée)' } }]);
  assert.deepEqual(partsDe(base, idDeSourceDeClasse(classe, 3)), []);
  const lot = dernierLot(base);
  const rangDe = (table, operation) => lot.findIndex((m) => m.table_nom === table && m.operation === operation);
  assert.ok(rangDe('maitrise_arme_part', 'supprimer') < rangDe('classe_maitrise_arme', 'supprimer'), 'la part retirée avant sa ligne (clé étrangère)');
  sourcesJustes(base);
  enregistrer(base, [{ op: 'modifier', table: 'classe', cle: { id: classe }, valeurs: { maitrise_arme: avant } }]);
  sourcesJustes(base);
});

test('un don qui suit la maîtrise au choix de sa classe (R151) : une classe sans exactement une maîtrise au choix est refusée (409), rien n’est écrit', () => {
  const base = vivante();
  const suit = q(base, "SELECT k.classe_id FROM maitrise_arme_part m JOIN capacite k ON k.id = m.capacite_id WHERE m.genre = 'suit' ORDER BY k.classe_id LIMIT 1")[0];
  assert.ok(suit, 'des dons suivent la maîtrise au choix de leur classe (Mage saphir, Épéiste…)');
  const lignes = q(base, 'SELECT * FROM classe_maitrise_arme WHERE classe_id = ? ORDER BY rang', suit.classe_id);
  const sansChoix = appel(base, [{ op: 'modifier', table: 'classe', cle: { id: suit.classe_id }, valeurs: { maitrise_arme: '- 1 maîtrise Épée' } }]);
  assert.equal(sansChoix.statut, 409, JSON.stringify(sansChoix.corps));
  assert.match(sansChoix.corps.erreur ?? JSON.stringify(sansChoix.corps), /suivent la maîtrise au choix de la classe .* exactement une ligne/);
  const deux = appel(base, [{ op: 'modifier', table: 'classe', cle: { id: suit.classe_id }, valeurs: { maitrise_arme: '- 1 maîtrise au choix\n- 1 maîtrise arme contact au choix' } }]);
  assert.equal(deux.statut, 409);
  assert.deepEqual(q(base, 'SELECT * FROM classe_maitrise_arme WHERE classe_id = ? ORDER BY rang', suit.classe_id), lignes, 'le lot annulé');
  // un don créé qui suit, dans une classe sans maîtrise au choix
  const sansAuChoix = q(base, `SELECT c.id FROM classe c WHERE NOT EXISTS (SELECT 1 FROM classe_maitrise_arme l WHERE l.classe_id = c.id AND l.forme = 'au_choix')
    ORDER BY c.id LIMIT 1`)[0].id;
  const r = appel(base, [{ op: 'creer', entite: 'capacite', valeurs: { classe_id: sansAuChoix, niveau: '20', nom: nomLibre(base, sansAuChoix, 'Essai qui suit'), type: 'Passif',
    effet: "+2 points de maîtrise avec l'arme déterminée avant." } }]);
  assert.equal(r.statut, 409, JSON.stringify(r.corps));
  sourcesJustes(base);
});

test('rejeu : un lot noté depuis 0073 se rejoue sans conflit ; un lot noté avant (sans les parts) laisse des parts justes, refaites hors journal', () => {
  const source = vivante();
  const classe = 'classes/guerrier';
  const id = creerDon(source, 'classes/archer', 'Essai de rejeu', '+2 points de maîtrise à répartir.');
  modifierDon(source, id, '+2 points de maîtrise Arcs, Gagne 2 niveaux de maîtrise (NM).');
  enregistrer(source, [{ op: 'modifier', table: 'classe', cle: { id: classe }, valeurs: { maitrise_arme: '- 1 maîtrise Hache\n- 1 maîtrise arme contact au choix (sauf Hache)\n- 1 maîtrise Arc' } }]);
  enregistrer(source, [{ op: 'modifier', table: 'classe', cle: { id: classe }, valeurs: { maitrise_arme: '- 1 maîtrise Dague\n- 1 maîtrise arme contact au choix (sauf Dague)' } }]);
  const supprime = creerDon(source, 'classes/archer', 'Essai supprimé', '+1 maîtrise Dague.');
  enregistrer(source, [{ op: 'supprimer', entite: 'capacite', cle: { id: supprime } }]);
  sourcesJustes(source);
  const attendu = sources(source).tables;
  assert.ok(q(source, 'SELECT 1 FROM modification WHERE table_nom IN (?, ?, ?)', ...TABLES_DES_SOURCES).length > 0, 'le journal note les parts');

  // tel quel : rien en conflit, rien à refaire hors journal
  const nouveau = rebatir(source);
  assert.equal(nouveau.bilan.conflits, 0, JSON.stringify(q(nouveau.base, "SELECT detail FROM modification WHERE etat = 'conflit'")));
  assert.deepEqual(sources(nouveau.base).tables, attendu);
  sourcesJustes(nouveau.base);
  for (const t of TABLES_DES_SOURCES) assert.ok(!nouveau.sortie.tablesCompletees.includes(t), `${t} : déjà dans le journal`);

  // le même journal noté avant 0073 (classe_maitrise_arme et capacite seulement) : les parts refaites lot par lot, hors journal
  const ancien = rebatir(source, avant0073);
  assert.equal(ancien.bilan.conflits, 0, JSON.stringify(q(ancien.base, "SELECT detail FROM modification WHERE etat = 'conflit'")));
  assert.deepEqual(sources(ancien.base).tables, attendu);
  sourcesJustes(ancien.base);
  assert.deepEqual(TABLES_DES_SOURCES.filter((t) => ancien.sortie.tablesCompletees.includes(t)), TABLES_DES_SOURCES, 'tables écrites au-delà du journal');
  assert.deepEqual(q(ancien.base, 'SELECT 1 FROM modification WHERE table_nom IN (?, ?, ?)', ...TABLES_DES_SOURCES), []);
});
