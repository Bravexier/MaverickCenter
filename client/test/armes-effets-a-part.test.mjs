// L'effet secondaire des matériaux et des améliorations d'arme sur une ligne à part, page Armes (demande du propriétaire, 2026-11-05 : « Pour gagner de
// la largeur, tu peux mettre l'effet secondaire des matériaux et amélioration sur une ligne à part comme c'est le cas pour les armes elles même ») :
// lib/armes-rendu.mjs#decouperEffetDAmelioration et les rendus `amelioration-effet`, `amelioration-effet-suite`, `materiau-effet-suite`. Le texte des
// effets ne change pas : découpé, il se recolle à l'identique ; le calcul de la fiche (lib/arme-champs.mjs, lib/arme-forge.mjs) ne lit pas ces rendus.
// Le HTML construit : test/armes-html.test.mjs ; le choix d'une ligne par sa ligne à part : test/armes-script.test.mjs.
//   node --test test/armes-effets-a-part.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyserEffetDeMateriau } from '../src/lib/arme-champs.mjs';
import { chargerArmes } from '../src/lib/armes-db.mjs';
import { decouperEffetDAmelioration, RENDUS_DES_ARMES as R } from '../src/lib/armes-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase();
const armes = chargerArmes(db);
/** Le texte d'un HTML de rendu, ses entités rendues. */
const texte = (html) => html.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('une amélioration : le bonus aux dégâts d’abord, le reste ensuite, tel qu’écrit ; sinon tout reste principal', () => {
  assert.deepEqual(decouperEffetDAmelioration('+10 dégâts, +1 cran de solidité'), { principal: '+10 dégâts', separateur: ', ', reste: '+1 cran de solidité' });
  assert.deepEqual(decouperEffetDAmelioration('+20 dégâts, +2 crans de solidité'), { principal: '+20 dégâts', separateur: ', ', reste: '+2 crans de solidité' });
  assert.deepEqual(decouperEffetDAmelioration('+2 dégâts'), { principal: '+2 dégâts', separateur: '', reste: '' }, 'sans virgule');
  assert.deepEqual(decouperEffetDAmelioration('+1 cran de solidité, +2 dégâts'), { principal: '+1 cran de solidité, +2 dégâts', separateur: '', reste: '' }, 'la première clause n’est pas le bonus');
  assert.deepEqual(decouperEffetDAmelioration('−4 dégâts, fragile'), { principal: '−4 dégâts', separateur: ', ', reste: 'fragile' }, 'le signe moins typographique');
  for (const v of ['', null, undefined]) assert.deepEqual(decouperEffetDAmelioration(v), { principal: '', separateur: '', reste: '' });
});

test('toute amélioration de la base : le découpage se recolle au texte ; son champ montre tout le texte, sa ligne à part le reste seul', () => {
  assert.ok(armes.ameliorations.length > 0);
  assert.ok(armes.ameliorations.some((a) => decouperEffetDAmelioration(a.effet_brut).reste), 'des améliorations à effet secondaire');
  assert.ok(armes.ameliorations.some((a) => !decouperEffetDAmelioration(a.effet_brut).reste), 'et sans');
  for (const a of armes.ameliorations) {
    const d = decouperEffetDAmelioration(a.effet_brut);
    assert.equal(`${d.principal}${d.separateur}${d.reste}`, a.effet_brut, a.id);
    assert.equal(texte(R['amelioration-effet'](a.effet_brut, a)), a.effet_brut, `${a.id} : le champ, entier`);
    assert.equal(texte(R['amelioration-effet-suite'](a.effet_brut, a)), d.reste, `${a.id} : la ligne à part`);
    // les valeurs que lit la fiche (data-bonus, data-cran), inchangées
    assert.match(R['amelioration-effet'](a.effet_brut, a), /^<span class="amelioration-effet" data-bonus="[^"]*" data-cran="[^"]*">/);
  }
});

test('tout matériau de la base : sa ligne à part, ses crans et ses autres effets tels qu’écrits ; rien sans eux (le fer)', () => {
  for (const m of armes.materiaux) {
    const a = analyserEffetDeMateriau(m.ligne.effet_brut);
    const suite = R['materiau-effet-suite'](m.ligne.effet_brut, m.ligne);
    const morceaux = [...suite.matchAll(/<span class="materiau-suite__morceau">([\s\S]*?)<\/span>/g)].map((x) => texte(x[1]));
    const attendus = [
      ...(a.cran_solidite ? [`${a.cran_solidite > 0 ? '+' : '−'}${Math.abs(a.cran_solidite)} cran${Math.abs(a.cran_solidite) > 1 ? 's' : ''} de solidité`] : []),
      ...String(a.effet_secondaire ?? '').split('\n').filter(Boolean),
    ];
    assert.deepEqual(morceaux, attendus, m.ligne.ressource_id);
    if (!attendus.length) assert.equal(suite, '', `${m.ligne.ressource_id} : pas de ligne à part`);
  }
  assert.equal(R['materiau-effet-suite']('Rien de particulier'), '');
  assert.equal(R['materiau-effet-suite']('Dégâts +2 pour l’arme'), '', 'le bonus seul reste sur la ligne du matériau');
});
