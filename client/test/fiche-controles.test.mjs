// Libellés des contrôles de la fiche (lib/fiche-controles.mjs) : chaque règle de la vue v_personnage_controle (data/schema.sql, section 13) a son
// libellé en français, et aucun libellé ne vise une règle disparue de la vue.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LIBELLES_DES_CONTROLES, libelleDuControle } from '../src/lib/fiche-controles.mjs';

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
