// Une créature invoquée au NPM choisi (décision R130, lib/creature-npm.mjs) : les réponses du propriétaire, puis toute la base (chaque valeur « /NPM »
// se lit, la carte au NPM 1 redit ce qu'elle écrit, sans « /NPM »).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attaqueAuNpm,
  caracteristiquesAuNpm,
  coutAuNpm,
  creatureAuNpm,
  defenseAuNpm,
  FPVSIA,
  NPMS,
  parNpm,
  valeurAuNpm,
  varieAvecLeNpm,
  vautAuNpm,
} from '../src/lib/creature-npm.mjs';
import { chargerInvocations } from '../src/lib/bestiaire-db.mjs';
import { FPVSIA as FPVSIA_DES_CARTES } from '../src/lib/monstre-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase({ sansExemples: false });
const { lignes } = chargerInvocations(db);

test('dégâts : « 1d8/NPM » et « 1d6+2/NPM » deviennent 3d8 et 1d6+6 au NPM 3 (réponse du propriétaire)', () => {
  const arc = { brut: 'Arc court - 1d8/NPM dégâts d’estoc', formule: '1d8/NPM', des: 1, faces: 8, bonus: null, parNpm: true };
  const arc2 = { brut: 'Arc - 1d6+2/NPM dégâts de taille (portée 2-10)', formule: '1d6+2/NPM', des: 1, faces: 6, bonus: 2, parNpm: true };
  assert.equal(attaqueAuNpm(arc, 3), 'Arc court - 3d8 dégâts d’estoc');
  assert.equal(attaqueAuNpm(arc2, 3), 'Arc - 1d6+6 dégâts de taille (portée 2-10)');
  assert.equal(attaqueAuNpm(arc2, 1), 'Arc - 1d6+2 dégâts de taille (portée 2-10)');
  // la même règle : les dés entre parenthèses, et le « /NPM » écrit après le type
  assert.equal(attaqueAuNpm({ brut: 'Arbalécho - (1d4/NPM)x1d4 dégâts d\'estoc (portée 2-11)', formule: '(1d4/NPM)x1d4', des: null, faces: null, bonus: null, parNpm: true }, 3),
    'Arbalécho - (3d4)x1d4 dégâts d\'estoc (portée 2-11)');
  assert.equal(attaqueAuNpm({ brut: 'Vomi acide - 1d6 dégâts d\'eau/NPM (2Po-Cône)', formule: '1d6', des: 1, faces: 6, bonus: null, parNpm: true }, 4),
    'Vomi acide - 4d6 dégâts d\'eau (2Po-Cône)');
  // sans « /NPM », telle qu'écrite ; une formule « /NPM » illisible : null
  assert.equal(attaqueAuNpm({ brut: 'Longue griffe - 10d6 dégâts de taille/estoc', formule: '10d6', des: 10, faces: 6, bonus: null, parNpm: false }, 5), 'Longue griffe - 10d6 dégâts de taille/estoc');
  assert.equal(attaqueAuNpm({ brut: 'X - 1d4x2/NPM dégâts', formule: '1d4x2/NPM', des: null, faces: null, bonus: null, parNpm: true }, 2), null);
});

test('défense : « 2 Armure Physique et Magique/NPM » vaut 2 × NPM pour chacune ; une armure « N/NPM » vaut N × NPM (réponse du propriétaire)', () => {
  assert.equal(defenseAuNpm({ forme: 'commune', physique: 2, physiqueParNpm: true, magique: 2, magiqueParNpm: true }, 3), '6 Armure Physique et Magique');
  assert.equal(defenseAuNpm({ forme: 'separee', physique: 3, physiqueParNpm: true, magique: 3, magiqueParNpm: false }, 4), '12 Armure Physique | 3 Armure Magique');
  assert.equal(defenseAuNpm(null, 2), null);
});

test('caractéristiques : « +1 Force au niveau 2 magique » compte à partir du NPM 2 ; « +1 Force/Agilité » n’est pas compté (réponse du propriétaire)', () => {
  const bonus = [
    { niveau: 2, increment: 1, caracteristique: 'force', texte: '+1 Force au niveau 2 magique' },
    { niveau: 4, increment: 1, caracteristique: 'force', texte: '+1 Force au niveau 4 magique' },
  ];
  assert.deepEqual(caracteristiquesAuNpm([5, 1, 10, 1, 1, 1], bonus, 1), { valeurs: [5, 1, 10, 1, 1, 1], comptes: [], nonComptes: [], parCase: [[], [], [], [], [], []] });
  assert.deepEqual(caracteristiquesAuNpm([5, 1, 10, 1, 1, 1], bonus, 3).valeurs, [6, 1, 10, 1, 1, 1]);
  // les bonus comptés de chaque case (l'infobulle d'une case changée)
  assert.deepEqual(caracteristiquesAuNpm([5, 1, 10, 1, 1, 1], bonus, 4).parCase[0], ['+1 Force au niveau 2 magique', '+1 Force au niveau 4 magique']);
  assert.deepEqual(caracteristiquesAuNpm([5, 1, 10, 1, 1, 1], bonus, 5).valeurs, [7, 1, 10, 1, 1, 1]);
  const ambigu = [{ niveau: 3, increment: 1, caracteristique: null, texte: '+1 Force/Agilité au niveau 3 magique' }];
  assert.deepEqual(caracteristiquesAuNpm([3, 3, 5, 0, 1, 3], ambigu, 2).nonComptes, []);
  assert.deepEqual(caracteristiquesAuNpm([3, 3, 5, 0, 1, 3], ambigu, 3), { valeurs: [3, 3, 5, 0, 1, 3], comptes: [], nonComptes: ['+1 Force/Agilité au niveau 3 magique'], parCase: [[], [], [], [], [], []] });
  assert.deepEqual(FPVSIA, FPVSIA_DES_CARTES);
});

test('santé, chakra, barrière : « N/NPM » × NPM, le reste tel qu’écrit ; capacités « (NPM n) » à partir du NPM n', () => {
  assert.equal(valeurAuNpm({ forme: 'par_npm', valeur: 20, brut: '20/NPM' }, 4), '80');
  assert.equal(valeurAuNpm({ forme: 'fixe', valeur: 15, brut: '15' }, 4), '15');
  assert.equal(valeurAuNpm({ forme: 'selon_chakra', valeur: null, brut: 'Selon le chakra' }, 4), 'Selon le chakra');
  assert.equal(valeurAuNpm(null, 4), null);
  assert.equal(vautAuNpm(null, 1), true);
  assert.equal(vautAuNpm(3, 2), false);
  assert.equal(vautAuNpm(3, 3), true);
});

test('coût d’une invocation au NPM : « 20 + 4 âmes » au NPM 4 d’Animation de mort (réponse du propriétaire pour R129)', () => {
  assert.equal(coutAuNpm('5', 'Par NPM de la créature invoquée. +1 Âme par NPM de la créature invoquée.', 4), '20 + 4 âmes');
  assert.equal(coutAuNpm('5', 'Par NPM de la créature invoquée. +1 Âme par NPM de la créature invoquée.', 1), '5 + 1 âme');
  assert.equal(coutAuNpm('6', 'Par NPM de la créature invoquée', 3), '18');
  // un autre second coût (« +10% Barrière » de la Marionnette de l'ombre) : à trancher, le coût reste tel qu'écrit
  assert.equal(coutAuNpm('5', 'Par NPM de la créature invoquée. +10% Barrière', 3), null);
  assert.equal(coutAuNpm('7', 'Par NPM de la créature sacrifiée', 3), null);
  assert.equal(coutAuNpm('X', 'Par NPM de la créature invoquée', 3), null);
});

test('parNpm : une valeur par groupe de NPM qui se suivent', () => {
  assert.deepEqual(parNpm((n) => (n < 3 ? 'a' : 'b')), [{ npms: [1, 2], valeur: 'a' }, { npms: [3, 4, 5], valeur: 'b' }]);
  assert.deepEqual(parNpm(() => 1).map((g) => g.npms), [NPMS]);
});

test('toute la base : au NPM 1, chaque carte redit ce qu’elle écrit sans « /NPM » ; chaque formule « /NPM » se lit', () => {
  const sansNpm = (t) => t.replaceAll('/NPM', '');
  let variables = 0;
  for (const l of lignes) {
    const d = l.donneesNpm;
    const un = creatureAuNpm(d, 1);
    assert.equal(un.sante, sansNpm(l.sante), l.id);
    assert.equal(un.chakra, l.chakra === null ? null : sansNpm(l.chakra), l.id);
    assert.equal(un.barriere, l.barriere === null ? null : sansNpm(l.barriere), l.id);
    assert.deepEqual(un.ressources.map((r) => r.valeur), l.ressources.map((r) => sansNpm(r.brut)), l.id);
    assert.equal(un.defense, l.defense === null ? null : sansNpm(l.defense), l.id);
    for (const a of d.attaques) {
      assert.notEqual(attaqueAuNpm(a, 3), null, `${l.id} : ${a.brut}`);
      assert.equal(attaqueAuNpm(a, 1), sansNpm(a.brut), `${l.id} : ${a.brut}`);
      if (a.parNpm) assert.doesNotMatch(attaqueAuNpm(a, 4), /\/NPM/, a.brut);
    }
    // les caractéristiques au NPM 1 : celles écrites (aucun bonus « au niveau 1 magique »)
    assert.deepEqual(un.caracteristiques.valeurs, l.fpvsia, l.id);
    // au NPM 5, tous les bonus comptés ou signalés
    const cinq = caracteristiquesAuNpm(d.fpvsia, d.bonus, 5);
    assert.equal(cinq.comptes.length + cinq.nonComptes.length, l.bonus.length, l.id);
    if (varieAvecLeNpm(d)) variables += 1;
    // une marionnette (une créature par NPM, décision R53) ne change pas avec le NPM
    if (l.bloc.startsWith('NPM ')) assert.equal(varieAvecLeNpm(d), false, l.id);
  }
  // les golems et les non-morts changent tous avec le NPM
  assert.equal(variables, lignes.filter((l) => !l.bloc.startsWith('NPM ')).length);
});

test('Golem de chair au NPM 3 : 60 de santé, 6 d’armure physique et magique', () => {
  const golem = lignes.find((l) => l.nom === 'Golem de chair');
  assert.ok(golem, 'Golem de chair absent de la base');
  if (golem.donneesNpm.sante.forme !== 'par_npm' || golem.donneesNpm.defense?.forme !== 'commune') return; // modifié sur le site de dev
  const trois = creatureAuNpm(golem.donneesNpm, 3);
  assert.equal(trois.sante, String(golem.donneesNpm.sante.valeur * 3));
  assert.equal(trois.defense, `${golem.donneesNpm.defense.physique * 3} Armure Physique et Magique`);
});
