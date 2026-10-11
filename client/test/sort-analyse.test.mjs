// Analyse des cases d'un sort (lib/sort-analyse.mjs) : ce que l'édition du site de dev recalcule quand une case change doit redonner, sur les
// 322 sorts de la base, exactement les colonnes typées, les types, les modes et les bonus de niveau de maîtrise en place.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { analyserCout, analyserPortee, analyserType, analyserZone, bonusDeMaitrise, COLONNES_NM } from '../src/lib/sort-analyse.mjs';
import { ORDRE_CHAMPS_NM, texteDeBonus } from '../src/lib/sort-maitrise.mjs';

const db = ouvrirBase({ sansExemples: false });
const sorts = db.prepare('SELECT * FROM sort ORDER BY id').all();
const parSort = (sql) => {
  const m = new Map();
  for (const l of db.prepare(sql).all()) {
    if (!m.has(l.sort_id)) m.set(l.sort_id, []);
    const { sort_id: _s, ...reste } = l;
    m.get(l.sort_id).push(reste);
  }
  return m;
};
const types = parSort('SELECT sort_id, type, libelle FROM sort_type ORDER BY sort_id, rang');
const modes = parSort('SELECT sort_id, mode, libelle, fois FROM sort_mode ORDER BY sort_id, rang');
const bonus = parSort('SELECT sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm FROM sort_bonus_maitrise ORDER BY sort_id, champ, rang');

test('322 sorts relus', () => assert.equal(sorts.length, 322));

test('type : types, mode, IC, imparable, inesquivable redonnent sort, sort_type et sort_mode', () => {
  for (const s of sorts) {
    const a = analyserType(s.type_brut);
    assert.deepEqual(a.inconnus, [], s.id);
    assert.deepEqual(a.types, types.get(s.id) ?? [], `${s.id} : types`);
    assert.deepEqual(a.modes, modes.get(s.id) ?? [], `${s.id} : modes`);
    assert.deepEqual([a.mode_brut, a.ic_direct, a.ic_nm_min, a.imparable, a.inesquivable], [s.mode_brut, s.ic_direct, s.ic_nm_min, s.imparable, s.inesquivable], `${s.id} : colonnes`);
  }
});

test('coût, portée, zone : colonnes typées en place', () => {
  for (const s of sorts) {
    assert.deepEqual(analyserCout(s.cout_brut), { cout_chakra: s.cout_chakra, cout_ressource: s.cout_ressource, cout_ressource_valeur: s.cout_ressource_valeur }, `${s.id} : ${s.cout_brut}`);
    assert.deepEqual(analyserPortee(s.portee_brut), { portee_nature: s.portee_nature, portee_valeur: s.portee_valeur }, `${s.id} : ${s.portee_brut}`);
    assert.deepEqual(analyserZone(s.zone_brut), { zone_forme: s.zone_forme, zone_taille: s.zone_taille }, `${s.id} : ${s.zone_brut}`);
  }
});

test('bonus de NM des cases courtes (type, coût, portée, zone, D/S/B) : sort_bonus_maitrise exactement, contexte compris', () => {
  for (const s of sorts) {
    for (const champ of ['type', 'cout', 'portee', 'zone', 'dsb']) {
      const attendus = (bonus.get(s.id) ?? []).filter((b) => b.champ === champ);
      assert.deepEqual(bonusDeMaitrise(champ, s[COLONNES_NM[champ]]), attendus, `${s.id} : ${champ}`);
    }
  }
});

test('bonus de NM des effets et de la remarque : mêmes expressions (nature, texte, incrément, pas, palier) ; contexte = un passage de la case qui contient l’expression', () => {
  const sans = ({ contexte: _c, ...reste }) => reste;
  for (const s of sorts) {
    for (const champ of ['effets', 'remarque']) {
      const attendus = (bonus.get(s.id) ?? []).filter((b) => b.champ === champ);
      const trouves = bonusDeMaitrise(champ, s[COLONNES_NM[champ]]);
      assert.deepEqual(trouves.map(sans), attendus.map(sans), `${s.id} : ${champ}`);
      for (const b of trouves) {
        assert.ok(b.contexte.includes(b.texte_brut), `${s.id} : le contexte contient l’expression (CHECK de la table)`);
        assert.ok(s[COLONNES_NM[champ]].includes(b.contexte), `${s.id} : le contexte est un passage de la case`);
      }
    }
  }
});

test('une case modifiée : nouvelles expressions reconnues ; la colonne « Bonus Maîtrise » suit', () => {
  assert.deepEqual(bonusDeMaitrise('cout', '30 (-3/NM)').map((b) => [b.nature, b.texte_brut, b.increment_entier, b.pas_nm]), [['par_nm', '-3/NM', -3, 1]]);
  assert.deepEqual(bonusDeMaitrise('effets', 'Brûle la cible. 3NM = Brûle aussi ses voisins.').map((b) => [b.nature, b.texte_brut, b.seuil_nm, b.contexte]),
    [['palier', '3NM = Brûle aussi ses voisins', 3, '3NM = Brûle aussi ses voisins']]);
  assert.deepEqual(bonusDeMaitrise('effets', 'Dure 2 tours (+1/NM).').map((b) => b.contexte), ['Dure 2 tours (+1/NM)']);
  assert.deepEqual(bonusDeMaitrise('dsb', '2d6 dégâts'), []);
  const lignes = bonusDeMaitrise('cout', '30 (-3/NM)').map((b) => ({ champ: b.champ, rang: b.rang, nature: b.nature, texteBrut: b.texte_brut, contexte: b.contexte }));
  assert.equal(texteDeBonus(lignes), 'Coût : -3/NM');
  assert.deepEqual(ORDRE_CHAMPS_NM, Object.keys(COLONNES_NM));
});
