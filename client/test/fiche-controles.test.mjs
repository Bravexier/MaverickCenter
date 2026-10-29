// Libellés des contrôles de la fiche (lib/fiche-controles.mjs) : chaque règle de la vue v_personnage_controle (data/schema.sql, section 13) a son
// libellé en français, et aucun libellé ne vise une règle disparue de la vue.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { controlesParGravite, GRAVITES_DES_CONTROLES, graviteDuControle, LIBELLES_DES_CONTROLES, libelleDuControle } from '../src/lib/fiche-controles.mjs';

const schema = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const debut = schema.indexOf('CREATE VIEW v_personnage_controle AS');
const suite = schema.indexOf('\nCREATE ', debut + 1);
const vue = schema.slice(debut, suite < 0 ? undefined : suite);

test('chaque règle de v_personnage_controle a son libellé, et seulement elles', () => {
  const regles = [...new Set([...vue.matchAll(/SELECT\s+[\w.]+,\s*'([a-z0-9_]+)'/g)].map((m) => m[1]))].sort();
  assert.ok(regles.length >= 30, `${regles.length} règles lues dans la vue`);
  assert.deepEqual(Object.keys(LIBELLES_DES_CONTROLES).sort(), regles);
  assert.equal(libelleDuControle('caracteristiques_total'), 'Total des caractéristiques différent de celui du niveau');
  assert.equal(libelleDuControle('regle_future'), 'regle_future', 'une règle ajoutée à la vue reste visible');
});

test('décision R170 : le plafond de maîtrise (maitrise_plafond) est un avertissement, toute autre règle une erreur ; l’onglet « Contrôle » les compte à part', () => {
  assert.deepEqual(GRAVITES_DES_CONTROLES, { maitrise_plafond: 'avertissement' }, 'une seule règle n’est pas une erreur');
  for (const regle of Object.keys(LIBELLES_DES_CONTROLES)) {
    assert.equal(graviteDuControle(regle), regle === 'maitrise_plafond' ? 'avertissement' : 'erreur', regle);
  }
  assert.equal(graviteDuControle('maitrise_meme_famille'), 'erreur', 'la limite écrite d’un don (R150) reste une erreur');
  assert.equal(graviteDuControle('regle_future'), 'erreur', 'une règle inconnue reste une erreur');
  // les erreurs d'abord, puis les avertissements ; leurs nombres
  const controles = [
    { regle: 'maitrise_plafond', detail: 'epees = 5 / 4' }, { regle: 'sorts_nm_total', detail: '3 / 2' }, { regle: 'maitrise_meme_famille', detail: 'x' },
  ];
  const g = controlesParGravite(controles);
  assert.deepEqual([g.erreurs, g.avertissements], [2, 1]);
  assert.deepEqual(g.lignes.map((c) => [c.regle, c.gravite]), [['sorts_nm_total', 'erreur'], ['maitrise_meme_famille', 'erreur'], ['maitrise_plafond', 'avertissement']]);
  assert.deepEqual(g.lignes[2].detail, 'epees = 5 / 4', 'le détail est gardé');
  assert.deepEqual(controlesParGravite([{ regle: 'maitrise_plafond', detail: null }]).erreurs, 0, 'un avertissement seul : aucune erreur');
  assert.deepEqual(controlesParGravite(null), { erreurs: 0, avertissements: 0, lignes: [] }, 'fiche pas encore contrôlée');
  // la page compte les erreurs dans le compteur rouge de l'onglet, les avertissements à part (src/scripts/fiche.mjs, lue comme un texte)
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const corps = script.slice(script.indexOf('function construireControles()'), script.indexOf('// ------------------------------------------------------------------ rafraîchissement'));
  assert.match(corps, /const g = controlesParGravite\(controles\);/);
  assert.match(corps, /compte\.toggleAttribute\('data-avertissement', controles !== null && !g\.erreurs && g\.avertissements > 0\);/);
  assert.match(corps, /dataset: c\.gravite === 'avertissement' \? \{ gravite: 'avertissement' \} : \{\}/);
  const css = readFileSync(new URL('../src/styles/fiche/fiche.css', import.meta.url), 'utf8');
  assert.match(css, /\.onglet__compte\[data-avertissement\] \{ background: var\(--warn-bg\); color: var\(--warn-text\); \}/);
  assert.match(css, /\.fiche-table--maitrises tr\[data-etat='avertissement'\] > \* \{ background: var\(--warn-bg\); \}/);
  assert.doesNotMatch(css, /tr\[data-etat='trop'\]|\.maitrise-alerte\[data-ton='trop'\]/, 'plus de rouge d’erreur pour le plafond');
});
