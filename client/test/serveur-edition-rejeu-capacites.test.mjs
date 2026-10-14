// Rejeu d'un journal du site de dev noté avant la migration 0044 (capacités de monstre communes, décision R66) : une capacité y était une ligne de
// monstre_capacite avec son nom et son texte, tirée du texte de la rubrique « Capacité(s) ». serveur/edition-bestiaire.mjs#ancienneEcritureDesCapacites
// lit ces modifications dans la forme des règles : une carte supprimée se rejoue (ses valeurs propres, et une place que 0044 a ajoutée, partent par la
// cascade du schéma) ; une capacité réécrite par le texte de la rubrique n'a pas d'équivalent sûr : son lot passe en conflit, avec un message qui le dit.
// Les lots « d'avant » sont fabriqués depuis ce que le service note aujourd'hui, mis dans la forme de la v43 (comme dans le journal du site de dev).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-rejeu-capacites-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const ouvertes = [];
after(() => ouvertes.forEach((b) => b.isOpen && b.close()));
const vivante = () => {
  const b = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  ouvertes.push(b);
  return b;
};

/** Une base vivante neuve qui reçoit le journal de `source` tel quel, puis le rejoue clés coupées (comme base-vivante.mjs#transferer). */
function rebatir(source) {
  const neuve = vivante();
  for (const l of source.prepare('SELECT * FROM modification_lot').all()) {
    neuve.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of source.prepare('SELECT * FROM modification').all()) {
    neuve.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.etat, m.detail, m.apercu);
  }
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  const sortie = {};
  const bilan = rejouerLeJournal(neuve, sortie);
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  return { base: neuve, bilan, sortie };
}
const enregistrer = (base, operations) => {
  const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'bestiaire/', operations }) },
    { base: () => base, etat: () => ({}), edition: true });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
/** Une capacité de la v43 : la ligne d'aujourd'hui sans sa capacité commune ni sa liste de sorts, avec un nom et un texte. */
const enV43 = ({ capacite_commune_id: _c, sorts: _s, ...reste }) => ({ ...reste, nom: 'Ancien nom', texte: 'Ancien texte de la capacité.' });

test('une carte supprimée avant 0044 se rejoue : ses capacités notées avec nom et texte, ses valeurs propres et une place ajoutée par 0044 partent', () => {
  const source = vivante();
  // une carte qui a des valeurs propres (R69) et plusieurs capacités
  const { monstre_id: id } = source.prepare(`SELECT v.monstre_id FROM monstre_capacite_valeur v
    WHERE (SELECT count(*) FROM monstre_capacite p WHERE p.monstre_id = v.monstre_id) > 1 ORDER BY v.monstre_id LIMIT 1`).get();
  const derniere = source.prepare('SELECT max(rang) AS r FROM monstre_capacite WHERE monstre_id = ?').get(id).r;
  enregistrer(source, [{ op: 'supprimer', entite: 'monstre', cle: { id } }]);
  // le même lot, comme la v43 l'écrivait : pas de valeurs propres, des capacités avec nom et texte, la rubrique « Capacité(s) » avec son texte ; et sans
  // la dernière place de la carte (une place que 0044 a ajoutée : « Tome de la corruption niv.1. »)
  source.exec("DELETE FROM modification WHERE table_nom = 'monstre_capacite_valeur'");
  source.prepare("DELETE FROM modification WHERE table_nom = 'monstre_capacite' AND json_extract(cle, '$.rang') = ?").run(derniere);
  for (const m of source.prepare("SELECT lot_id, rang, avant FROM modification WHERE table_nom = 'monstre_capacite'").all()) {
    source.prepare('UPDATE modification SET avant = ? WHERE lot_id = ? AND rang = ?').run(JSON.stringify(enV43(JSON.parse(m.avant))), m.lot_id, m.rang);
  }
  const rubrique = source.prepare("SELECT lot_id, rang, avant FROM modification WHERE table_nom = 'monstre_rubrique' AND json_extract(avant, '$.rubrique') = 'capacites'").get();
  source.prepare('UPDATE modification SET avant = ? WHERE lot_id = ? AND rang = ?')
    .run(JSON.stringify({ ...JSON.parse(rubrique.avant), texte: 'Ancien nom : Ancien texte de la capacité.' }), rubrique.lot_id, rubrique.rang);

  const { base, bilan, sortie } = rebatir(source);
  assert.equal(bilan.conflits, 0, JSON.stringify(base.prepare("SELECT detail FROM modification WHERE etat = 'conflit' LIMIT 1").get()));
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre WHERE id = ?').get(id).n, 0, 'la carte est supprimée');
  for (const t of ['monstre_capacite', 'monstre_capacite_valeur', 'monstre_rubrique']) {
    assert.equal(base.prepare(`SELECT count(*) AS n FROM ${t} WHERE monstre_id = ?`).get(id).n, 0, t);
  }
  assert.deepEqual(base.prepare('PRAGMA foreign_key_check').all(), []);
  // la cascade écrit au-delà du journal : ces tables sont rapatriées avec le lot (scripts/mise-a-jour-regles.mjs, mise-a-jour-github.mjs#tablesDuLot)
  assert.ok(sortie.tablesCompletees.includes('monstre_capacite') && sortie.tablesCompletees.includes('monstre_capacite_valeur'), JSON.stringify(sortie.tablesCompletees));
});

test('capacités réécrites par le texte de la rubrique avant 0044 : pas d’équivalent sûr, le lot passe en conflit et le message dit quoi refaire', () => {
  const source = vivante();
  const p = source.prepare('SELECT * FROM monstre_capacite ORDER BY monstre_id, rang LIMIT 1').get();
  const r = source.prepare("SELECT * FROM monstre_rubrique WHERE monstre_id = ? AND rubrique = 'capacites'").get(p.monstre_id);
  const lot = '2026-10-14T08:00:00.000Z-avant-0044';
  source.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, '2026-10-14T08:00:00Z', NULL, 'bestiaire/', 'avant 0044')").run(lot);
  const noter = (rang, table, cle, avant, apres) => source.prepare(`INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat)
    VALUES (?, ?, ?, ?, 'modifier', ?, ?, 'en_attente')`).run(lot, rang, table, JSON.stringify(cle), JSON.stringify(avant), JSON.stringify(apres));
  noter(1, 'monstre_rubrique', { monstre_id: r.monstre_id, rang: r.rang }, { texte: 'Vol : vole.' }, { texte: 'Vol : vole très haut.' });
  noter(2, 'monstre_capacite', { monstre_id: p.monstre_id, rang: p.rang }, { texte: 'vole.' }, { texte: 'vole très haut.' });
  const { base, bilan } = rebatir(source);
  assert.equal(bilan.conflits, 2);
  const { detail } = base.prepare("SELECT detail FROM modification WHERE etat = 'conflit' LIMIT 1").get();
  assert.match(detail, /migration 0044/);
  assert.match(detail, /décision R66/);
  // rien n'a changé dans les règles
  assert.equal(base.prepare('SELECT capacite_commune_id FROM monstre_capacite WHERE monstre_id = ? AND rang = ?').get(p.monstre_id, p.rang).capacite_commune_id, p.capacite_commune_id);
});

test('toutes les capacités d’une carte retirées avant 0044 (rubrique vidée) : le lot se rejoue, la rubrique reste vide', () => {
  const source = vivante();
  const { monstre_id: id } = source.prepare('SELECT monstre_id FROM monstre_capacite ORDER BY monstre_id DESC LIMIT 1').get();
  const r = source.prepare("SELECT * FROM monstre_rubrique WHERE monstre_id = ? AND rubrique = 'capacites'").get(id);
  const places = source.prepare('SELECT * FROM monstre_capacite WHERE monstre_id = ? ORDER BY rang').all(id);
  const lot = '2026-10-14T08:00:00.000Z-rubrique-videe';
  source.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, '2026-10-14T08:00:00Z', NULL, 'bestiaire/', 'avant 0044')").run(lot);
  const noter = (rang, table, cle, operation, avant, apres) => source.prepare(`INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')`).run(lot, rang, table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres));
  noter(1, 'monstre_rubrique', { monstre_id: id, rang: r.rang }, 'modifier', { texte: 'Ancien nom : Ancien texte.' }, { texte: '' });
  places.forEach((p, i) => noter(i + 2, 'monstre_capacite', { monstre_id: id, rang: p.rang }, 'supprimer', enV43(p), null));
  const { base, bilan } = rebatir(source);
  assert.equal(bilan.conflits, 0, JSON.stringify(base.prepare("SELECT detail FROM modification WHERE etat = 'conflit' LIMIT 1").get()));
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre_capacite WHERE monstre_id = ?').get(id).n, 0);
  assert.equal(base.prepare('SELECT texte FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(id, r.rang).texte, '');
  assert.deepEqual(base.prepare('PRAGMA foreign_key_check').all(), []);
});
