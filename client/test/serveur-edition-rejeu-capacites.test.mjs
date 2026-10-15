// Rejeu d'un journal du site de dev noté avant la migration 0044 (capacités de monstre communes, décision R66) : une capacité y était une ligne de
// monstre_capacite avec son nom et son texte, tirée du texte de la rubrique « Capacité(s) ». Ces modifications n'ont pas d'équivalent sûr
// (serveur/edition-bestiaire.mjs#ancienneEcritureDesCapacites) : leur lot passe en conflit, avec un message qui dit quoi refaire, et rien n'en est écrit —
// ni dans les règles, ni dans l'historique que la mise à jour en tire. Une autre rubrique d'une carte, notée de même, se rejoue toujours.
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
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  return { base: neuve, bilan };
}
const enregistrer = (base, operations) => {
  const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'bestiaire/', operations }) },
    { base: () => base, etat: () => ({}), edition: true });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
/** Une capacité de la v43 : la ligne d'aujourd'hui sans sa capacité commune ni sa liste de sorts, avec un nom et un texte. */
const enV43 = ({ capacite_commune_id: _c, sorts: _s, ...reste }) => ({ ...reste, nom: 'Ancien nom', texte: 'Ancien texte de la capacité.' });
const noterUnLot = (base, id) => {
  base.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, '2026-10-14T08:00:00Z', NULL, 'bestiaire/', 'avant 0044')").run(id);
  return (rang, table, cle, operation, avant, apres) => base.prepare(`INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')`).run(id, rang, table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres));
};
const conflits = (base) => base.prepare("SELECT DISTINCT detail FROM modification WHERE etat = 'conflit'").all().map((r) => r.detail);
const SANS_EQUIVALENT = /noté avant la migration 0044 .*capacités communes \(décision R66\) ; à refaire sur le site de dev/;

test('une carte supprimée avant 0044 (ses capacités notées avec nom et texte) : conflit explicite, la carte et ses capacités restent', () => {
  const source = vivante();
  // une carte qui a des valeurs propres (R69) : ce que la v43 ne notait pas
  const { monstre_id: id } = source.prepare('SELECT monstre_id FROM monstre_capacite_valeur ORDER BY monstre_id LIMIT 1').get();
  const places = source.prepare('SELECT count(*) AS n FROM monstre_capacite WHERE monstre_id = ?').get(id).n;
  enregistrer(source, [{ op: 'supprimer', entite: 'monstre', cle: { id } }]);
  // le même lot, comme la v43 l'écrivait : pas de valeurs propres, des capacités avec nom et texte, la rubrique « Capacité(s) » avec son texte
  source.exec("DELETE FROM modification WHERE table_nom = 'monstre_capacite_valeur'");
  for (const m of source.prepare("SELECT lot_id, rang, avant FROM modification WHERE table_nom = 'monstre_capacite'").all()) {
    source.prepare('UPDATE modification SET avant = ? WHERE lot_id = ? AND rang = ?').run(JSON.stringify(enV43(JSON.parse(m.avant))), m.lot_id, m.rang);
  }
  const rubrique = source.prepare("SELECT lot_id, rang, avant FROM modification WHERE table_nom = 'monstre_rubrique' AND json_extract(avant, '$.rubrique') = 'capacites'").get();
  source.prepare('UPDATE modification SET avant = ? WHERE lot_id = ? AND rang = ?')
    .run(JSON.stringify({ ...JSON.parse(rubrique.avant), texte: 'Ancien nom : Ancien texte de la capacité.' }), rubrique.lot_id, rubrique.rang);

  const { base, bilan } = rebatir(source);
  assert.equal(bilan.appliquees, 0);
  assert.ok(bilan.conflits > 0);
  const [detail, ...autres] = conflits(base);
  assert.equal(autres.length, 0, 'un seul lot, un seul conflit');
  assert.match(detail, SANS_EQUIVALENT);
  assert.match(detail, /la supprimer de nouveau/);
  // rien n'est rejoué : la carte, ses capacités et ses valeurs restent (et rien n'irait à l'historique d'une mise à jour, qui saute les lots en conflit)
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre WHERE id = ?').get(id).n, 1);
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre_capacite WHERE monstre_id = ?').get(id).n, places);
  assert.ok(base.prepare('SELECT count(*) AS n FROM monstre_capacite_valeur WHERE monstre_id = ?').get(id).n > 0);
  assert.deepEqual(base.prepare('PRAGMA foreign_key_check').all(), []);
});

test('capacités réécrites ou retirées par le texte de la rubrique avant 0044 (dont une rubrique vidée) : conflit explicite, rien ne change', () => {
  const source = vivante();
  const p = source.prepare('SELECT * FROM monstre_capacite ORDER BY monstre_id, rang LIMIT 1').get();
  const r = source.prepare("SELECT * FROM monstre_rubrique WHERE monstre_id = ? AND rubrique = 'capacites'").get(p.monstre_id);
  const reecrite = noterUnLot(source, '2026-10-14T08:00:00.000Z-reecrite');
  reecrite(1, 'monstre_rubrique', { monstre_id: r.monstre_id, rang: r.rang }, 'modifier', { texte: 'Vol : vole.' }, { texte: 'Vol : vole très haut.' });
  reecrite(2, 'monstre_capacite', { monstre_id: p.monstre_id, rang: p.rang }, 'modifier', { texte: 'vole.' }, { texte: 'vole très haut.' });
  // toutes les capacités d'une autre carte retirées (rubrique vidée) : la v43 notait leurs suppressions, rang par rang
  const { monstre_id: autre } = source.prepare('SELECT monstre_id FROM monstre_capacite WHERE monstre_id <> ? ORDER BY monstre_id DESC LIMIT 1').get(p.monstre_id);
  const r2 = source.prepare("SELECT * FROM monstre_rubrique WHERE monstre_id = ? AND rubrique = 'capacites'").get(autre);
  const videe = noterUnLot(source, '2026-10-14T09:00:00.000Z-videe');
  videe(1, 'monstre_rubrique', { monstre_id: autre, rang: r2.rang }, 'modifier', { texte: 'Ancien nom : Ancien texte.' }, { texte: '' });
  source.prepare('SELECT * FROM monstre_capacite WHERE monstre_id = ? ORDER BY rang').all(autre)
    .forEach((x, i) => videe(i + 2, 'monstre_capacite', { monstre_id: autre, rang: x.rang }, 'supprimer', enV43(x), null));
  const avant = source.prepare('SELECT count(*) AS n FROM monstre_capacite WHERE monstre_id = ?').get(autre).n;

  const { base, bilan } = rebatir(source);
  assert.equal(bilan.appliquees, 0);
  const details = conflits(base);
  assert.equal(details.length, 2, 'les deux lots');
  for (const d of details) assert.match(d, SANS_EQUIVALENT);
  assert.equal(base.prepare('SELECT capacite_commune_id FROM monstre_capacite WHERE monstre_id = ? AND rang = ?').get(p.monstre_id, p.rang).capacite_commune_id, p.capacite_commune_id);
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre_capacite WHERE monstre_id = ?').get(autre).n, avant);
  assert.equal(base.prepare('SELECT texte FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(autre, r2.rang).texte, '');
});

test('une carte créée par le journal, puis ses capacités écrites avant 0044 (rubrique modifiée sans redire `rubrique`) : la carte est rejouée, le lot des capacités passe en conflit explicite', () => {
  const source = vivante();
  const { id: espece } = source.prepare('SELECT id FROM monstre_espece ORDER BY ordre LIMIT 1').get();
  let nom = 'Carte du rejeu d’avant 0044';
  for (let i = 2; source.prepare('SELECT 1 FROM monstre WHERE nom = ?').get(nom); i += 1) nom = `Carte du rejeu d’avant 0044 ${i}`;
  const id = enregistrer(source, [{ op: 'creer', entite: 'monstre', valeurs: { espece_id: espece, nom, echelle_brut: 'EP1', categorie: 'ennemi_simple' } }]).crees[0].id;
  const { rang } = source.prepare("SELECT rang FROM monstre_rubrique WHERE monstre_id = ? AND rubrique = 'capacites'").get(id);
  // la v43 notait la rubrique (texte seulement : la ligne n'est pas dans les règles quand l'adaptateur la lit), puis la capacité tirée de son texte
  const lot = noterUnLot(source, '2026-10-14T23:00:00.000Z-capacites-de-la-carte-creee');
  lot(1, 'monstre_rubrique', { monstre_id: id, rang }, 'modifier', { texte: '' }, { texte: 'Vol. Vole.' });
  lot(2, 'monstre_capacite', { monstre_id: id, rang: 1 }, 'inserer', null, { monstre_id: id, rang: 1, prefixe: null, ep_min: null, nom: 'Vol', texte: 'Vole.', origine: 'monstres', source_ref: 'Site de dev' });
  const { base } = rebatir(source);
  const details = conflits(base);
  assert.equal(details.length, 1, JSON.stringify(details));
  assert.match(details[0], SANS_EQUIVALENT);
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre WHERE id = ?').get(id).n, 1, 'la création, lot à part, est rejouée');
  assert.equal(base.prepare('SELECT texte FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(id, rang).texte, '');
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre_capacite WHERE monstre_id = ?').get(id).n, 0);
});

test('une autre rubrique d’une carte notée avant 0044 (la tactique de l’Os du blizzard, en attente sur le site de dev) se rejoue toujours', () => {
  const source = vivante();
  const r = source.prepare("SELECT * FROM monstre_rubrique WHERE rubrique NOT IN ('capacites', 'attributs') AND texte <> '' ORDER BY monstre_id, rang LIMIT 1").get();
  const lot = noterUnLot(source, '2026-10-14T08:00:00.000Z-autre-rubrique');
  lot(1, 'monstre_rubrique', { monstre_id: r.monstre_id, rang: r.rang }, 'modifier', { texte: r.texte }, { texte: `${r.texte} (essai)` });
  const { base, bilan } = rebatir(source);
  assert.equal(bilan.conflits, 0, JSON.stringify(conflits(base)));
  assert.equal(base.prepare('SELECT texte FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(r.monstre_id, r.rang).texte, `${r.texte} (essai)`);
});
