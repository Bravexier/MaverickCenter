// Maîtrises d'armes écrites dans les textes de la base (lib/maitrise-arme.mjs) : le dé du Pugilat selon la Force et les points de maîtrise que donnent
// les dons, pour le quota de maîtrise de la fiche (décision R32). Entrées synthétiques qui imitent le classeur, puis toute la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { desSelonLaForce, pointsDeMaitriseDArme } from '../src/lib/maitrise-arme.mjs';

const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);

test('dé selon la Force : les paliers écrits dans la note, dans l’ordre ; null sans palier', () => {
  assert.deepEqual(desSelonLaForce('D6 1-2 Force, D8 3-4 Force, D10 5 Force'), [
    { de: 'D6', min: 1, max: 2 }, { de: 'D8', min: 3, max: 4 }, { de: 'D10', min: 5, max: 5 },
  ]);
  assert.equal(desSelonLaForce('Un matériau permet d’en faire 10 sauf pour la fronde qui elle est unique'), null);
  assert.equal(desSelonLaForce(null), null);
  // la note du Pugilat telle que l'import l'a écrite (Ressources et Craft › Armes › HW1)
  assert.deepEqual(desSelonLaForce(historique.valeurDImport('arme_famille', { id: 'pugilat' }, 'note_brut')), desSelonLaForce('D6 1-2 Force, D8 3-4 Force, D10 5 Force'));
});

test('dé selon la Force dans la base : chaque palier est un dé de la famille, les paliers se suivent depuis 1 sans se chevaucher', () => {
  const familles = db.prepare('SELECT id, de_brut, note_brut FROM arme_famille').all().filter((f) => desSelonLaForce(f.note_brut));
  assert.ok(familles.some((f) => f.id === 'pugilat'), 'le Pugilat');
  for (const f of familles) {
    const paliers = desSelonLaForce(f.note_brut);
    assert.deepEqual(paliers.map((p) => p.de), f.de_brut.split('/').map((d) => d.trim().toUpperCase()), `${f.id} : les dés de la famille`);
    paliers.forEach((p, i) => {
      assert.ok(p.min <= p.max, `${f.id} : ${p.de}`);
      assert.equal(p.min, i === 0 ? 1 : paliers[i - 1].max + 1, `${f.id} : ${p.de} suit le palier d’avant`);
    });
  }
});

test('points de maîtrise d’un don : chaque « N point(s) de maîtrise » et « N maîtrise(s) » avec son signe ; ni une limite, ni un NM de sort', () => {
  assert.equal(pointsDeMaitriseDArme('+7% Magie, 7% Concentration, +2 points de maîtrise à répartir, considérer comme classe magique.'), 2);
  assert.equal(pointsDeMaitriseDArme('+2 dégâts, +1 maîtrise Dague, +6% arme légère, +5% Esquive.'), 1);
  assert.equal(pointsDeMaitriseDArme('+2 points de maîtrise Arme de jet, +1 point de maîtrise Arme contact au choix, +8% Arme Lourdes'), 3);
  assert.equal(pointsDeMaitriseDArme('2 points de maitrise à répartir, +10% Arme Lourde, +5% Fermeté.'), 2, 'écrit sans accent');
  assert.equal(pointsDeMaitriseDArme("+5% Arme lourde OU légère. 2 points de maîtrise à l'épée, 1 point de maîtrise à la dague, -1 point de maîtrise de l'autre arme choisie"), 2,
    'l’Épéiste : 2 + 1 − 1');
  assert.equal(pointsDeMaitriseDArme("+5 points de maîtrise d'arme à répartir (Pas plus de 2 points de maîtrise répartis dans la même catégorie), Maîtrise les armures lourdes."), 5,
    'la limite n’est pas un gain');
  assert.equal(pointsDeMaitriseDArme('Gagne 4 niveaux de maîtrise (NM).'), 0, 'des NM de sort');
  assert.equal(pointsDeMaitriseDArme('Le sort influé aura toujours au minimum un Niveau de Maîtrise.'), 0);
  assert.equal(pointsDeMaitriseDArme("Permet d'additionner les dés de maîtrise de l'arme de jet avec les dés de maîtrise de l'arme cac"), 0);
  assert.equal(pointsDeMaitriseDArme('Maîtrise les armures intermédiaires.'), 0);
  assert.equal(pointsDeMaitriseDArme(null), 0);
});

test('points de maîtrise sur toute la base : un don qui écrit « N point(s) de maîtrise » en donne, jamais moins de 0 ; les autres n’en donnent pas', () => {
  const plier = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const dons = db.prepare('SELECT id, nature, effet FROM capacite').all();
  let avec = 0;
  for (const d of dons) {
    const points = pointsDeMaitriseDArme(d.effet);
    const ecrit = /\d+\s+(?:points?\s+de\s+)?maitrises?\b/.test(plier(d.effet));
    if (ecrit) avec += 1;
    assert.equal(points > 0, ecrit, `${d.id} : ${points}`);
  }
  assert.ok(avec > 0);
});
