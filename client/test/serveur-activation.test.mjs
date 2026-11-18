// Garde-fou 17 du chantier de la base de dev (lot 11, PR 1 ; serveur/activation.mjs, module pur, aucun appelant encore) : la production n'active un kit qu'avec son
// paquet. Un refus par raison (`kit_sans_paquet`, `empreinte`, `structure`, `note_manquante`, `version_en_arriere`), chacun avec ses chiffres et le geste qui le lève ;
// le cas qui passe ; le module ne touche aucun fichier. Les versions de ces tests sont inventées (aucune ne dépend du contenu du site de dev).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PLAFOND_DES_NOTES_NOMMEES, RAISONS_D_ACTIVATION, comparerLesVersions, controlerLActivation } from '../serveur/activation.mjs';

const SHA = 'a'.repeat(64);
const AUTRE_SHA = 'b'.repeat(64);
/** Une activation qui passe : le paquet 0.9 d'un kit de structure 140, sur une production à la 0.8 qui a les notes 0.7 et 0.8. */
const entrees = (surcharge = {}) => ({
  kit: { version: '0.6.0', structure: 140, paquet: { version: '0.9', sha256: SHA } },
  paquet: { sha256: SHA, schema: 140, version: '0.9', notes: ['0.7', '0.8', '0.9'] },
  production: { notes: ['0.7', '0.8'], version: '0.8' },
  ...surcharge,
});
const raisons = (r) => r.refus.map((x) => x.raison);

test('le cas qui passe : kit, paquet et production d\'accord', () => {
  assert.deepEqual(controlerLActivation(entrees()), { ok: true, refus: [] });
  // la version de la production se lit aussi de ses notes ; une production vide (première activation) passe
  assert.equal(controlerLActivation(entrees({ production: { notes: ['0.7', '0.8'] } })).ok, true);
  assert.equal(controlerLActivation(entrees({ production: { notes: [] } })).ok, true);
});

test('kit_sans_paquet : le kit annonce un paquet absent (ou n\'en annonce aucun), rien d\'autre n\'est jugé', () => {
  const r = controlerLActivation(entrees({ paquet: null }));
  assert.equal(r.ok, false);
  assert.deepEqual(raisons(r), ['kit_sans_paquet']);
  assert.match(r.refus[0].message, /V0\.6\.0/);
  assert.ok(r.refus[0].message.includes(SHA.slice(0, 12)), 'l\'empreinte annoncée est dite');
  assert.match(r.refus[0].message, /Pour lever ce refus/);
  const sansAnnonce = controlerLActivation(entrees({ paquet: null, kit: { version: '0.6.0', structure: 140, paquet: null } }));
  assert.deepEqual(raisons(sansAnnonce), ['kit_sans_paquet']);
});

test('empreinte : le sha256 des octets reçus n\'est pas celui que le kit annonce', () => {
  const r = controlerLActivation(entrees({ paquet: { ...entrees().paquet, sha256: AUTRE_SHA } }));
  assert.deepEqual(raisons(r), ['empreinte']);
  assert.ok(r.refus[0].message.includes(AUTRE_SHA.slice(0, 12)) && r.refus[0].message.includes(SHA.slice(0, 12)), 'les deux empreintes sont dites');
  assert.match(r.refus[0].message, /Pour lever ce refus/);
  // un kit qui n'annonce pas d'empreinte ne peut pas être vérifié : refusé aussi
  const sansEmpreinte = controlerLActivation(entrees({ kit: { version: '0.6.0', structure: 140, paquet: { version: '0.9' } } }));
  assert.deepEqual(raisons(sansEmpreinte), ['empreinte']);
});

test('structure : le schéma du paquet n\'est pas la structure du kit', () => {
  const r = controlerLActivation(entrees({ paquet: { ...entrees().paquet, schema: 139 } }));
  assert.deepEqual(raisons(r), ['structure']);
  assert.match(r.refus[0].message, /139/);
  assert.match(r.refus[0].message, /140/);
  assert.match(r.refus[0].message, /Pour lever ce refus/);
});

test('note_manquante : une note de version que la production a déjà est absente du paquet (comparées par version, V0.10 après V0.9)', () => {
  const r = controlerLActivation(entrees({ paquet: { ...entrees().paquet, notes: ['0.8', '0.9'] } }));
  assert.deepEqual(raisons(r), ['note_manquante']);
  assert.match(r.refus[0].message, /1 note/);
  assert.match(r.refus[0].message, /V0\.7\b/);
  assert.match(r.refus[0].message, /Pour lever ce refus/);
  // « 0.10 » n'est pas « 0.1 » : la comparaison est sur les chaînes exactes des versions, pas sur un préfixe
  const dixieme = controlerLActivation(entrees({ production: { notes: ['0.1', '0.10'], version: '0.10' }, paquet: { ...entrees().paquet, version: '0.11', notes: ['0.10', '0.11'] } }));
  assert.deepEqual(raisons(dixieme), ['note_manquante']);
  assert.match(dixieme.refus[0].message, /V0\.1\b/);
  assert.doesNotMatch(dixieme.refus[0].message, /V0\.10\b/);
  // beaucoup de notes manquantes : le nombre est exact, les versions nommées sont plafonnées
  const beaucoup = Array.from({ length: PLAFOND_DES_NOTES_NOMMEES + 5 }, (_, i) => `0.${i + 1}`);
  const t = controlerLActivation(entrees({ production: { notes: beaucoup, version: '0.30' }, paquet: { ...entrees().paquet, version: '0.31', notes: ['0.31'] } }));
  assert.deepEqual(raisons(t), ['note_manquante']);
  assert.match(t.refus[0].message, new RegExp(`${beaucoup.length} note`));
  assert.match(t.refus[0].message, /et 5 autre/);
});

test('version_en_arriere : le paquet n\'est pas plus haut que la production (égale ou plus ancien), ou sans version lisible', () => {
  const egale = controlerLActivation(entrees({ production: { notes: ['0.7', '0.8', '0.9'], version: '0.9' } }));
  assert.deepEqual(raisons(egale), ['version_en_arriere']);
  assert.match(egale.refus[0].message, /V0\.9\b/);
  assert.match(egale.refus[0].message, /Pour lever ce refus/);
  const arriere = controlerLActivation(entrees({ production: { notes: ['0.7', '0.8'], version: '0.10' }, paquet: { ...entrees().paquet, notes: ['0.7', '0.8', '0.9'] } }));
  assert.deepEqual(raisons(arriere), ['version_en_arriere'], 'V0.10 est plus haute que V0.9');
  assert.match(arriere.refus[0].message, /V0\.9\b/);
  assert.match(arriere.refus[0].message, /V0\.10\b/);
  const sansVersion = controlerLActivation(entrees({ paquet: { ...entrees().paquet, version: null } }));
  assert.deepEqual(raisons(sansVersion), ['version_en_arriere']);
});

test('plusieurs refus à la fois sont tous rendus ; chaque raison est connue ; chaque message dit le geste', () => {
  const r = controlerLActivation(entrees({
    kit: { version: '0.6.0', structure: 141, paquet: { version: '0.9', sha256: SHA } },
    paquet: { sha256: AUTRE_SHA, schema: 140, version: '0.8', notes: ['0.8'] },
  }));
  assert.deepEqual(raisons(r), ['empreinte', 'structure', 'note_manquante', 'version_en_arriere']);
  for (const x of r.refus) {
    assert.ok(RAISONS_D_ACTIVATION.includes(x.raison));
    assert.match(x.message, /Pour lever ce refus/);
  }
  assert.deepEqual([...RAISONS_D_ACTIVATION].sort(), ['empreinte', 'kit_sans_paquet', 'note_manquante', 'structure', 'version_en_arriere']);
});

test('comparerLesVersions compare les nombres, pas les chaînes ; le module ne lit aucun fichier', () => {
  assert.equal(comparerLesVersions('0.10', '0.9'), 1);
  assert.equal(comparerLesVersions('V0.9', '0.9'), 0);
  assert.equal(comparerLesVersions('1.0', '0.99'), 1);
  assert.equal(comparerLesVersions('0.9', 'x'), null);
  const source = readFileSync(new URL('../serveur/activation.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b/m, 'aucun import : ni node:fs ni autre module');
});
