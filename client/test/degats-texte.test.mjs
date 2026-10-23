// Bonus de dégâts écrits dans les dons passifs (lib/degats-texte.mjs), lus pour la pastille des dégâts des armes de la fiche : entrées synthétiques qui
// imitent les onglets des classes, puis tous les dons passifs de la base (chaque bonus « +N dégâts » d'arme est soit compté avec les armes qu'il vise,
// soit rendu avec sa raison ; « Pour chaque cran de solidité perdu » de Vieille Branche : compté sur toutes les armes, par cran perdu, décision R107).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bonusDeDegatsEcrit, degatsDeMagieEcrits, RAISONS, valeurAuNiveau } from '../src/lib/degats-texte.mjs';
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
  // décision R107 (Vieille Branche) : « l'arme en question » = chaque arme portée, la valeur d'un cran perdu (lib/fiche-moteur.mjs#degatsDArme la multiplie)
  assert.deepEqual(bonusDeDegatsEcrit('Pour chaque cran de solidité perdu, l’arme en question fera +4 Dégâts.'),
    { valeur: 4, portee: { toutes: true }, parCranPerdu: true });
});

test('non comptés, avec leur raison ; pas un bonus d’arme : rien', () => {
  assert.deepEqual(bonusDeDegatsEcrit('Donne +5% à la Compétence « Arc » et augmente les dégâts de 3.'), { valeur: 3, raison: 'portee' }, '« Arc » : le nom de la compétence');
  assert.deepEqual(bonusDeDegatsEcrit('Si la cible est à 10 cases ou plus = +4 dégâts'), { valeur: 4, raison: 'situation' });
  assert.deepEqual(bonusDeDegatsEcrit('(Rage) / +3 aux dégâts et récupère 4 santé par tour.'), { valeur: 3, raison: 'situation' });
  assert.deepEqual(bonusDeDegatsEcrit('+8 dégâts, +1 à la vitesse, +4AP et +5% à tous les jets. Doit être dans l\'eau.'), { valeur: 8, raison: 'situation' });
  assert.deepEqual(bonusDeDegatsEcrit('Choisit une arme en particulier et gagne +6 dégâts avec cette arme.'), { valeur: 6, raison: 'au_choix' });
  assert.deepEqual(bonusDeDegatsEcrit('+4 dégâts avec les deux armes.'), { valeur: 4, raison: 'deux_armes' });
  // R107 ne lit que l'écriture de Vieille Branche, le texte entier : une autre phrase « pour chaque cran » reste une situation
  assert.deepEqual(bonusDeDegatsEcrit('Pour chaque cran de solidité perdu, l’arme en question fera +4 Dégâts si la cible est au sol.'), { valeur: 4, raison: 'situation' });
  assert.deepEqual(bonusDeDegatsEcrit('Pour chaque cran de solidité perdu, +4 dégâts avec les épées.'), { valeur: 4, raison: 'situation' });
  assert.equal(bonusDeDegatsEcrit('+6 aux dégâts des sorts.'), null, 'les sorts');
  // décision R167 : ces dégâts de magie comptent sur une arme élémentaire de ces magies (ses types de dégâts), plus « une magie » sans arme
  assert.deepEqual(bonusDeDegatsEcrit('Les dégâts de Feu, Lumière et Vent augmentent de +10.'),
    { valeur: 10, portee: { types: ['magies/magie-du-feu', 'magies/magie-du-vent', 'magies/magie-de-la-lumiere'] } }, 'une magie : ses armes élémentaires');
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
  // décision R107 : Vieille Branche (Mage Vert, Mage jade), un bonus par cran perdu de chaque arme portée ; sa valeur (+4 à l'import) se modifie sur le
  // site de dev, qui est la source des règles : une valeur entière positive, pas le 4 de l'import
  const { valeur, ...vieilleBranche } = compte('capacites/mage-vert-vieille-branche');
  assert.deepEqual(vieilleBranche, { portee: { toutes: true }, parCranPerdu: true });
  assert.ok(Number.isInteger(valeur) && valeur > 0, `valeur ${valeur}`);
});

test('décision R167 : « Les dégâts de X, Y et Z augmentent de +N » (Tissière et les onze dons de son écriture, « Oui, tous ») : les dégâts de magie d’une arme élémentaire ; « Temps » seul, l’Espace/Temps ; une situation, non lue', () => {
  const db = ouvrirBase({ sansExemples: false });
  const dons = db.prepare("SELECT id, nom, effet FROM capacite WHERE type = 'passif'").all();
  const lus = new Map(dons.map((d) => [d.id, degatsDeMagieEcrits(d.effet)]).filter(([, x]) => x));
  // les douze dons de la décision, lus par leur écriture commune (aucune liste dans le lecteur) ; épinglés ici sur le texte de la base
  const M = (...noms) => noms.map((n) => `magies/${n}`);
  const attendus = {
    'capacites/anansi-tissiere': M('magie-de-larcane', 'magie-de-la-necromancie', 'magie-de-lombre'),
    'capacites/orios-au-poil': M('magie-du-sang', 'magie-de-leau', 'magie-de-la-terre'),
    'capacites/fenrir-magicien': M('magie-de-la-glace', 'magie-de-la-foudre', 'magie-de-lombre'),
    'capacites/kitsune-aisance': M('magie-du-feu', 'magie-du-vent', 'magie-de-la-lumiere'),
    'capacites/namazu-hadale': M('magie-du-sang', 'magie-de-leau', 'magie-de-lombre'),
    'capacites/rokh-ciel-pere': M('magie-du-vent', 'magie-de-la-foudre', 'magie-de-la-lumiere'),
    'capacites/olwman-obscure': M('magie-de-lespace-temps', 'magie-du-vent', 'magie-de-lombre'),
    'capacites/minotaure-soif': M('magie-du-sang', 'magie-de-la-terre', 'magie-de-lombre'),
    'capacites/satyre-jouet-denfer': M('magie-du-feu', 'magie-de-la-terre', 'magie-de-la-foudre'),
    'capacites/medusain-abyssal': M('magie-de-leau', 'magie-de-la-foudre', 'magie-de-la-lumiere'),
    'capacites/jackalope-jambiere': M('magie-du-vide', 'magie-de-la-terre', 'magie-de-la-foudre'),
    'capacites/marcass-terre-feu-necro': M('magie-de-la-necromancie', 'magie-du-feu', 'magie-de-la-terre'),
  };
  assert.deepEqual([...lus.keys()].sort(), Object.keys(attendus).sort(), 'exactement les douze dons de cette écriture');
  for (const [id, magies] of Object.entries(attendus)) {
    assert.deepEqual([lus.get(id).valeur, [...lus.get(id).magies].sort()], [10, [...magies].sort()], id);
    assert.deepEqual(bonusDeDegatsEcrit(dons.find((d) => d.id === id).effet), { valeur: 10, portee: { types: lus.get(id).magies } }, id);
  }
  // le texte de la base de Tissière, tel qu'écrit
  assert.equal(dons.find((d) => d.id === 'capacites/anansi-tissiere').effet, 'Les dégâts d\'Arcane,  Nécromancie et Ombre augmentent de +10.');
  // « Temps » écrit seul : l'Espace/Temps (Olwman « Obscure » : « Les dégâts de Vent, Ombre et Temps augmentent de +10. ») ; « Espace/Temps » aussi
  assert.equal(dons.find((d) => d.id === 'capacites/olwman-obscure').effet, 'Les dégâts de Vent, Ombre et Temps augmentent de +10.');
  assert.deepEqual(degatsDeMagieEcrits('Les dégâts d\'Espace/Temps augmentent de +3.'), { valeur: 3, magies: ['magies/magie-de-lespace-temps'] });
  // une situation (Médusain « Fil conducteur ») : non lue, non comptée (R128)
  const fil = dons.find((d) => d.id === 'capacites/medusain-fil-conducteur');
  assert.equal(fil.effet, 'Les dégâts d\'Eau et de Foudre augmentent de 5 quand ils sont faits dans l\'eau.');
  assert.equal(degatsDeMagieEcrits(fil.effet), null);
  assert.equal(bonusDeDegatsEcrit(fil.effet), null);
});
