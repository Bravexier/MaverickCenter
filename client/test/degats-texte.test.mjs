// Bonus de dégâts écrits dans les dons passifs (lib/degats-texte.mjs), lus pour la pastille des dégâts des armes de la fiche : entrées synthétiques qui
// imitent les onglets des classes, puis tous les dons passifs de la base (chaque bonus « +N dégâts » d'arme est soit compté avec les armes qu'il vise,
// soit rendu avec sa raison).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bonusDeDegatsEcrit, RAISONS, valeurAuNiveau } from '../src/lib/degats-texte.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

test('comptés : la valeur et les armes visées écrites', () => {
  assert.deepEqual(bonusDeDegatsEcrit('+8 dégâts avec les arcs'), { valeur: 8, portee: { familles: ['arc'] } });
  assert.deepEqual(bonusDeDegatsEcrit('Les épées et dagues infligent +5 dégâts.'), { valeur: 5, portee: { familles: ['epees', 'dagues'] } });
  assert.deepEqual(bonusDeDegatsEcrit('Les arbalètes à une main font +7 dégâts.'), { valeur: 7, portee: { familles: ['arbalete'], mains: 'une' } });
  assert.deepEqual(bonusDeDegatsEcrit('+10 dégâts avec toutes les armes de corps à corps.'), { valeur: 10, portee: { cac: true } });
  assert.deepEqual(bonusDeDegatsEcrit('Les armes font +5 de dégâts.'), { valeur: 5, portee: { toutes: true } });
  assert.deepEqual(bonusDeDegatsEcrit('Les dégâts d\'estoc augmentent de +8.'), { valeur: 8, portee: { types: ['estoc'] } });
  assert.deepEqual(bonusDeDegatsEcrit('Permet d\'infliger 3+x dégâts avec une arme de jet. / x = +2 dégâts/6 niveaux du lanceur.'),
    { base: 3, pas: 2, niveaux: 6, portee: { familles: ['arme-de-jet'] } });
  assert.equal(valeurAuNiveau({ base: 3, pas: 2, niveaux: 6 }, 12), 7);
  assert.equal(valeurAuNiveau({ valeur: 4 }, 12), 4);
});

test('non comptés, avec leur raison ; pas un bonus d’arme : rien', () => {
  assert.deepEqual(bonusDeDegatsEcrit('Donne +5% à la Compétence « Arc » et augmente les dégâts de 3.'), { valeur: 3, raison: 'portee' }, '« Arc » : le nom de la compétence');
  assert.deepEqual(bonusDeDegatsEcrit('Si la cible est à 10 cases ou plus = +4 dégâts'), { valeur: 4, raison: 'situation' });
  assert.deepEqual(bonusDeDegatsEcrit('(Rage) / +3 aux dégâts et récupère 4 santé par tour.'), { valeur: 3, raison: 'situation' });
  assert.deepEqual(bonusDeDegatsEcrit('+8 dégâts, +1 à la vitesse, +4AP et +5% à tous les jets. Doit être dans l\'eau.'), { valeur: 8, raison: 'situation' });
  assert.deepEqual(bonusDeDegatsEcrit('Choisit une arme en particulier et gagne +6 dégâts avec cette arme.'), { valeur: 6, raison: 'au_choix' });
  assert.deepEqual(bonusDeDegatsEcrit('+4 dégâts avec les deux armes.'), { valeur: 4, raison: 'deux_armes' });
  assert.equal(bonusDeDegatsEcrit('+6 aux dégâts des sorts.'), null, 'les sorts');
  assert.equal(bonusDeDegatsEcrit('Les dégâts de Feu, Lumière et Vent augmentent de +10.'), null, 'une magie');
  assert.equal(bonusDeDegatsEcrit('+5% Arme légère, +5% Équilibre'), null, 'pas de dégâts');
  for (const raison of ['situation', 'au_choix', 'deux_armes', 'bouclier', 'portee']) assert.ok(RAISONS[raison], raison);
});

test('tous les dons passifs de la base : chaque lecture a une valeur, et des armes visées ou une raison connue', () => {
  const db = ouvrirBase({ sansExemples: false });
  const dons = db.prepare("SELECT id, effet FROM capacite WHERE type = 'passif'").all();
  const lus = dons.map((d) => [d.id, bonusDeDegatsEcrit(d.effet)]).filter(([, b]) => b);
  assert.ok(lus.length > 30, `${lus.length} dons passifs avec un bonus de dégâts d’arme`);
  for (const [id, b] of lus) {
    assert.ok('valeur' in b ? Number.isInteger(b.valeur) && b.valeur > 0 : b.pas > 0 && b.niveaux > 0, `${id} : valeur`);
    assert.ok(Boolean(b.portee) !== Boolean(b.raison), `${id} : soit les armes visées, soit une raison`);
    if (b.raison) assert.ok(RAISONS[b.raison], `${id} : raison ${b.raison}`);
    if (b.portee?.familles) {
      const familles = new Set(db.prepare('SELECT id FROM arme_famille').all().map((f) => f.id));
      for (const f of b.portee.familles) assert.ok(familles.has(f), `${id} : famille ${f}`);
    }
  }
  const compte = (id) => lus.find(([x]) => x === id)?.[1];
  // quelques lectures de l'import, épinglées
  assert.deepEqual(compte('capacites/archer-tir-parfait'), { valeur: 8, portee: { familles: ['arc'] } });
  assert.deepEqual(compte('capacites/guerrier-hyper-contact'), { valeur: 10, portee: { cac: true } });
  assert.deepEqual(compte('capacites/archer-coup-eloigne'), { valeur: 4, raison: 'situation' });
});
