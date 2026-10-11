// Contexte d'un bonus de NM écrit dans les effets ou la remarque d'un sort (sort_bonus_maitrise.contexte, lib/sort-analyse.mjs#bonusDeMaitrise),
// que l'édition du site de dev refait quand la case change. Un groupe entre parenthèses qui fait une phrase à lui seul se lit comme l'import l'a lu :
// sans ses parenthèses s'il dit lui-même ce qu'il fait (« 3NM = … »), sinon avec la phrase qui le précède (« Pichenette » : « Réduit de 5 l'initiative…
// pour le prochain tour. (+2/NM) », et non « (+2/NM) » seul, que la colonne « Bonus Maîtrise » montrait). Les autres contextes de l'import sont des
// morceaux de phrase choisis au cas par cas (« pour 3 tours (+1/NM) » dans « Invoque la météo … pour 3 tours (+1/NM) ») : la phrase entière les
// remplace quand la case est modifiée, sans rien deviner.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { bonusDeMaitrise, COLONNES_NM } from '../src/lib/sort-analyse.mjs';
import { texteDeBonus } from '../src/lib/sort-maitrise.mjs';

const db = ouvrirBase({ sansExemples: false });

test('groupe entre parenthèses seul dans sa phrase : contexte de l’import (sans parenthèses s’il dit ce qu’il fait, sinon avec la phrase d’avant)', () => {
  const contexte = (texte) => bonusDeMaitrise('effets', texte).map((b) => b.contexte);
  assert.deepEqual(contexte('Réduit de 5 l\'initiative de l’adversaire pour le prochain tour. (+2/NM)'), ['Réduit de 5 l\'initiative de l’adversaire pour le prochain tour. (+2/NM)']);
  assert.deepEqual(contexte('Régénère des PV pendant 3 tours. (3NM permet de le faire sur 2 alliés)'), ['Régénère des PV pendant 3 tours. (3NM permet de le faire sur 2 alliés)']);
  assert.deepEqual(contexte('Inflige des dégâts de zone de Foudre. (3NM = Si jet de vigueur raté = Inflige paralysie 1).'), ['3NM = Si jet de vigueur raté = Inflige paralysie 1']);
  assert.deepEqual(contexte('Inflige des dégâts de zone de Glace. (Si jet de vigueur raté = Inflige gel 1/3NM)'), ['Si jet de vigueur raté = Inflige gel 1/3NM']);
  assert.deepEqual(contexte('(+2/NM)'), ['(+2/NM)'], 'rien avant : le groupe');
  assert.deepEqual(contexte('Première ligne.\n(+2/NM)'), ['(+2/NM)'], 'la phrase d’avant est sur une autre ligne : le groupe');
  assert.deepEqual(contexte('Dure 2 tours (+1/NM).'), ['Dure 2 tours (+1/NM)'], 'groupe dans une phrase : la phrase');
  const lignes = bonusDeMaitrise('effets', 'Réduit de 5 l\'initiative de l’adversaire pour le prochain tour. (+2/NM)')
    .map((b) => ({ champ: b.champ, rang: b.rang, nature: b.nature, texteBrut: b.texte_brut, contexte: b.contexte }));
  assert.equal(texteDeBonus(lignes), 'Effets : Réduit de 5 l\'initiative de l’adversaire pour le prochain tour. (+2/NM)');
});

test('rejoué sur les sorts de la base : chaque groupe seul dans sa phrase redonne exactement le contexte de sort_bonus_maitrise', () => {
  const phrasesDe = (texte) => texte.split('\n').flatMap((l) => l.split(/(?<=\.)\s+/)).map((p) => p.trim().replace(/\.$/, ''));
  let vus = 0;
  for (const s of db.prepare('SELECT * FROM sort ORDER BY id').all()) {
    for (const champ of ['effets', 'remarque']) {
      const texte = s[COLONNES_NM[champ]];
      if (!texte) continue;
      const trouves = bonusDeMaitrise(champ, texte);
      for (const b of db.prepare('SELECT rang, texte_brut, contexte FROM sort_bonus_maitrise WHERE sort_id = ? AND champ = ? ORDER BY rang').all(s.id, champ)) {
        const seul = phrasesDe(texte).some((p) => /^\([^()]*\)$/.test(p) && p.includes(b.texte_brut));
        if (!seul) continue;
        vus += 1;
        assert.equal(trouves.find((t) => t.rang === b.rang)?.contexte, b.contexte, `${s.id} : ${champ} ${b.rang}`);
      }
    }
  }
  assert.ok(vus >= 10, `${vus} groupes seuls dans leur phrase`);
});
