// Générateur d'accessoires (lib/accessoires-generateur.mjs) : couleurs des niveaux (celles de l'onglet), qualité de gemme d'un niveau (règles de la
// page), dés tirés des tables, plages, état dans l'adresse, malédiction (décision R94 : relance depuis l'étape 2, même emplacement ; une seconde
// malédiction détruit l'accessoire).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ancreGardee, apresUneMalediction, apresUnJet, bonusBorne, bonusDeLAdresse, cleDEffet, effetDuBonus, COULEURS_DES_NIVEAUX, dansLaPlage, ecrireEtat, etatDeMalediction, facesDuDe, gemmesAuChoix, gemmesCochees, lancer,
  lireEtat, noteDeMalediction, PARAMETRES, prixDeLAccessoire, qualiteDeGemme, QUALITES_DE_GEMME, styleDeNiveau, tirerUnAccessoire,
} from '../src/lib/accessoires-generateur.mjs';

test('une couleur par niveau 1 à 5, celles du tableau « Monture » de l’onglet', () => {
  assert.deepEqual(COULEURS_DES_NIVEAUX, { 1: '#d9ead3', 2: '#fff2cc', 3: '#fce5cd', 4: '#f4cccc', 5: '#e6b8af' });
  assert.equal(styleDeNiveau(3), '--niv: #fce5cd');
  assert.equal(styleDeNiveau(null), undefined, 'niveau absent (« Niveau ? », ligne vide) : pas de couleur');
});

test('qualité de gemme : classique aux niveaux 1 et 2, raffinée aux niveaux 3 et 4, parfaite au niveau 5', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => qualiteDeGemme(n).id), ['commune', 'commune', 'raffinee', 'raffinee', 'parfaite']);
  assert.equal(qualiteDeGemme('4').libelle, 'raffinée');
  assert.equal(qualiteDeGemme(null), null);
  assert.deepEqual(QUALITES_DE_GEMME.flatMap((q) => q.niveaux), [1, 2, 3, 4, 5]);
});

test('dés : les faces sont le plus grand jet écrit ; un jet reste entre 1 et le nombre de faces', () => {
  assert.equal(facesDuDe([1, 2, 3, 4]), 4);
  assert.equal(facesDuDe([5, 20, 100, 66]), 100);
  assert.equal(lancer(20, () => 0), 1);
  assert.equal(lancer(20, () => 0.999999), 20);
  assert.equal(lancer(6, () => 0.5), 4);
  for (let i = 0; i < 200; i++) {
    const j = lancer(100);
    assert.ok(Number.isInteger(j) && j >= 1 && j <= 100);
  }
});

test('plages : l’élément dont la plage contient le jet', () => {
  const plages = [{ min: 1, max: 5, id: 'a' }, { min: 6, max: 20, id: 'b' }, { min: '21', max: '35', id: 'c' }];
  assert.equal(dansLaPlage(plages, 1).id, 'a');
  assert.equal(dansLaPlage(plages, 6).id, 'b');
  assert.equal(dansLaPlage(plages, 35).id, 'c');
  assert.equal(dansLaPlage(plages, 36), null);
});

test('état dans l’adresse : aller-retour, vides retirés, autres paramètres gardés', () => {
  const s = ecrireEtat('?x=1', { emplacement: 'anneau', propriete: 'competence', effet: 'competence:force:2', acquis: 7, monture: null, maudit: true });
  assert.equal(s, '?x=1&emplacement=anneau&propriete=competence&effet=competence%3Aforce%3A2&acquis=7&maudit=1');
  assert.deepEqual(lireEtat(s), { emplacement: 'anneau', propriete: 'competence', effet: 'competence:force:2', acquis: '7', maudit: '1' });
  assert.equal(ecrireEtat(s, {}), '?x=1');
  assert.equal(ecrireEtat('', { maudit: false }), '');
});

test('état dans l’adresse : « détruit » (R94) après « maudit », aller-retour', () => {
  assert.deepEqual(PARAMETRES.slice(-2), ['maudit', 'detruit']);
  const s = ecrireEtat('', { emplacement: 'anneau', propriete: 'malediction', maudit: true, detruit: true });
  assert.equal(s, '?emplacement=anneau&propriete=malediction&maudit=1&detruit=1');
  assert.deepEqual(lireEtat(s), { emplacement: 'anneau', propriete: 'malediction', maudit: '1', detruit: '1' });
  assert.equal(ecrireEtat(s, { emplacement: 'anneau', maudit: true, detruit: false }), '?emplacement=anneau&maudit=1', 'détruit levé : retiré de l’adresse');
});

test('clé d’un effet : la partie après « #effet: »', () => {
  assert.equal(cleDEffet('ressources/accessoires#effet:competence:force:2'), 'competence:force:2');
  assert.equal(cleDEffet('ressources/accessoires#effet:attaque:5'), 'attaque:5');
});

test('gemmes au choix : deux en tout, les rangs à une gemme imposés (« laisser la possibilité d’en cocher 2 »)', () => {
  assert.deepEqual(gemmesAuChoix([['ambre'], ['grenat']]), { imposees: ['ambre', 'grenat'], auChoix: [], max: 0 });
  assert.deepEqual(gemmesAuChoix([['turquoise', 'perle', 'diamant-rose', 'onix']]), { imposees: [], auChoix: ['turquoise', 'perle', 'diamant-rose', 'onix'], max: 2 });
  assert.deepEqual(gemmesAuChoix([['onix'], ['grenat', 'malachite']]), { imposees: ['onix'], auChoix: ['grenat', 'malachite'], max: 1 });
  assert.deepEqual(gemmesCochees([['turquoise', 'perle', 'diamant-rose', 'onix']], ['perle', 'chocolat', 'perle', 'onix', 'turquoise']), ['perle', 'onix']);
  assert.deepEqual(gemmesCochees([['onix'], ['grenat', 'malachite']], ['onix', 'malachite', 'grenat']), ['malachite']);
  assert.deepEqual(gemmesCochees([['ambre'], ['grenat']], ['ambre']), []);
  const s = ecrireEtat('', { effet: 'caracteristique:intelligence', gemmes: 'perle,onix' });
  assert.equal(lireEtat(s).gemmes, 'perle,onix');
});

test('prix d’un accessoire aux gemmes au choix : quarts (en RF) + monture (en RO)', () => {
  assert.equal(prixDeLAccessoire([5700, 4700], 100), 204);
  assert.equal(prixDeLAccessoire([1000, 800], 5), 23);
  assert.equal(prixDeLAccessoire([], 5), null);
  assert.equal(prixDeLAccessoire([1000, Number.NaN], 5), null);
  assert.equal(prixDeLAccessoire([1000], Number.NaN), null);
});

test('bonus d’acquis : un entier borné aux plages écrites ; une saisie qui n’est pas un nombre donne le plus petit', () => {
  assert.equal(bonusBorne(7, 1, 20), 7);
  assert.equal(bonusBorne('12', 1, 20), 12);
  assert.equal(bonusBorne(0, 1, 20), 1);
  assert.equal(bonusBorne(25, 1, 20), 20);
  assert.equal(bonusBorne('7,6', 1, 20), 8);
  assert.equal(bonusBorne('', 1, 20), 1);
  assert.equal(bonusBorne('abc', 1, 20), 1);
  assert.equal(bonusBorne(-Infinity, 1, 20), 1);
  const niveaux = [{ min: 1, max: 5, niveau: 1 }, { min: 6, max: 10, niveau: 2 }, { min: 11, max: 15, niveau: 3 }, { min: 16, max: 20, niveau: 4 }];
  assert.deepEqual([1, 5, 6, 10, 11, 16, 20].map((b) => dansLaPlage(niveaux, bonusBorne(b, 1, 20)).niveau), [1, 1, 2, 2, 3, 4, 4]);
});

const NIVEAUX = [
  { valeur: 'competence:force:1', niveau: 1, min: 1, max: 5 },
  { valeur: 'competence:force:2', niveau: 2, min: 6, max: 10 },
  { valeur: 'competence:force:3', niveau: 3, min: 11, max: 15 },
  { valeur: 'competence:force:4', niveau: 4, min: 16, max: 20 },
];

test('une ligne des compétences : le bonus d’acquis (curseur, saisie, dé) donne l’effet du niveau dont la plage le contient', () => {
  assert.deepEqual(effetDuBonus(NIVEAUX, 12), { bonus: 12, effet: NIVEAUX[2] });
  assert.deepEqual(effetDuBonus(NIVEAUX, '6'), { bonus: 6, effet: NIVEAUX[1] });
  assert.deepEqual(effetDuBonus(NIVEAUX, 35), { bonus: 20, effet: NIVEAUX[3] }, 'borné au plus grand bonus écrit');
  assert.deepEqual(effetDuBonus(NIVEAUX, -Infinity), { bonus: 1, effet: NIVEAUX[0] }, 'la ligne telle que construite');
  assert.equal(effetDuBonus([], 3), null);
});

test('une ligne des compétences d’après l’adresse : le bonus s’il est dans la plage de l’effet, sinon le plus petit de cette plage', () => {
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', '12'), 12);
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', '18'), 11, 'hors de la plage : l’effet de l’adresse fait foi');
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', null), 11);
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', ''), 11);
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', '12.5'), 11);
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:agilite:3', '12'), null, 'un effet d’une autre ligne');
});

test('l’ancre d’un onglet d’effets n’est pas gardée dans l’adresse ; les autres le sont', () => {
  assert.equal(ancreGardee('#effets-attaque'), '');
  assert.equal(ancreGardee('#acc-monture'), '#acc-monture');
  assert.equal(ancreGardee(''), '');
  // dans la page « Équipement » : l'onglet Accessoires prend sa place (une adresse sans ancre rouvrirait le premier onglet de la page)
  assert.equal(ancreGardee('#effets-attaque', '#accessoires'), '#accessoires');
  assert.equal(ancreGardee('#acc-monture', '#accessoires'), '#acc-monture');
});

// --- Malédiction (décision R94) : « Si à n'importe quel étape "Malédiction" est choisi, on relance tout l'item à partir de l'étape 2 (on garde le même
// emplacement) Dans le 2em roll si on retombe à nouveau sur "Malédiction", l'objet est DETRUIT et tombe en poussière. »

/**
 * Des tables truquées : `proprietes` et `effets` sont les lignes que tirent les étapes 2 et 3, dans l'ordre ; chaque tirage est noté (`tirages`, avec
 * la propriété reçue par l'étape 3).
 */
function tables({ proprietes, effets = [] }) {
  const tirages = [];
  const suite = (liste) => () => liste.shift() ?? null;
  const propriete = suite([...proprietes]);
  const effet = suite([...effets]);
  return {
    tirages,
    tables: {
      emplacement: () => (tirages.push('emplacement'), { id: 'anneau', malediction: false }),
      propriete: () => (tirages.push('propriete'), propriete()),
      effet: (p) => (tirages.push(`effet:${p.id}`), effet()),
    },
  };
}
const P = (id) => ({ id, malediction: id === 'malediction' });
const E = (id) => ({ id, malediction: id.endsWith(':malediction') });

test('R94 : sans malédiction, les étapes 1, 2 et 3 une fois chacune', () => {
  const t = tables({ proprietes: [P('attaque')], effets: [E('attaque:5')] });
  const r = tirerUnAccessoire(t.tables);
  assert.deepEqual(t.tirages, ['emplacement', 'propriete', 'effet:attaque']);
  assert.deepEqual([r.emplacement.id, r.propriete.id, r.effet.id, r.maudit, r.detruit], ['anneau', 'attaque', 'attaque:5', false, false]);
});

test('R94 : une malédiction à l’étape 2 rend maudit et fait relancer depuis l’étape 2, même emplacement (l’étape 1 tirée une fois, l’étape 3 sautée)', () => {
  const t = tables({ proprietes: [P('malediction'), P('defense')], effets: [E('defense:3')] });
  const r = tirerUnAccessoire(t.tables);
  assert.deepEqual(t.tirages, ['emplacement', 'propriete', 'propriete', 'effet:defense']);
  assert.deepEqual([r.emplacement.id, r.propriete.id, r.effet.id, r.maudit, r.detruit], ['anneau', 'defense', 'defense:3', true, false]);
});

test('R94 : une malédiction à l’étape 3 rend maudit et fait relancer depuis l’étape 2, même emplacement', () => {
  const t = tables({ proprietes: [P('attaque'), P('competence')], effets: [E('attaque:malediction'), E('competence:force:2')] });
  const r = tirerUnAccessoire(t.tables);
  assert.deepEqual(t.tirages, ['emplacement', 'propriete', 'effet:attaque', 'propriete', 'effet:competence']);
  assert.deepEqual([r.emplacement.id, r.propriete.id, r.effet.id, r.maudit, r.detruit], ['anneau', 'competence', 'competence:force:2', true, false]);
});

test('R94 : une seconde malédiction (2 → 2, 2 → 3, 3 → 2, 3 → 3) détruit l’accessoire, sans troisième tirage', () => {
  const cas = [
    { nom: '2 → 2', proprietes: [P('malediction'), P('malediction')], effets: [],
      tirages: ['emplacement', 'propriete', 'propriete'], fin: ['malediction', null] },
    { nom: '2 → 3', proprietes: [P('malediction'), P('jet-de-de')], effets: [E('jet-de-de:malediction')],
      tirages: ['emplacement', 'propriete', 'propriete', 'effet:jet-de-de'], fin: ['jet-de-de', 'jet-de-de:malediction'] },
    { nom: '3 → 2', proprietes: [P('autre'), P('malediction')], effets: [E('autre:malediction')],
      tirages: ['emplacement', 'propriete', 'effet:autre', 'propriete'], fin: ['malediction', null] },
    { nom: '3 → 3', proprietes: [P('attributs'), P('attaque')], effets: [E('attributs:malediction'), E('attaque:malediction')],
      tirages: ['emplacement', 'propriete', 'effet:attributs', 'propriete', 'effet:attaque'], fin: ['attaque', 'attaque:malediction'] },
  ];
  for (const c of cas) {
    // de quoi tirer encore : un troisième tour les prendrait
    const t = tables({ proprietes: [...c.proprietes, P('defense')], effets: [...c.effets, E('defense:1')] });
    const r = tirerUnAccessoire(t.tables);
    assert.deepEqual(t.tirages, c.tirages, c.nom);
    assert.deepEqual([r.emplacement.id, r.propriete.id, r.effet?.id ?? null, r.maudit, r.detruit], ['anneau', ...c.fin, true, true], c.nom);
  }
});

test('R94 : une étape qui ne rend aucune ligne arrête le tirage, sans boucler', () => {
  const t = tables({ proprietes: [P('malediction')] });
  const r = tirerUnAccessoire(t.tables);
  assert.deepEqual(t.tirages, ['emplacement', 'propriete', 'propriete']);
  assert.deepEqual([r.propriete, r.effet, r.maudit, r.detruit], [null, null, true, false]);
  const u = tables({ proprietes: [P('attaque')] });
  assert.deepEqual(tirerUnAccessoire(u.tables), { emplacement: { id: 'anneau', malediction: false }, propriete: P('attaque'), effet: null, maudit: false, detruit: false });
  assert.deepEqual(u.tirages, ['emplacement', 'propriete', 'effet:attaque']);
  const sansEmplacement = tirerUnAccessoire({ emplacement: () => null, propriete: () => assert.fail('pas d’étape 2'), effet: () => assert.fail('pas d’étape 3') });
  assert.deepEqual(sansEmplacement, { emplacement: null, propriete: null, effet: null, maudit: false, detruit: false });
});

test('R94 : la transition d’un jet de malédiction — non maudit → maudit ; maudit → détruit ; détruit reste détruit', () => {
  assert.deepEqual(apresUneMalediction({ maudit: false, detruit: false }), { maudit: true, detruit: false });
  assert.deepEqual(apresUneMalediction({}), { maudit: true, detruit: false });
  assert.deepEqual(apresUneMalediction({ maudit: true, detruit: false }), { maudit: true, detruit: true }, 'maudit par une malédiction ou par la case cochée');
  assert.deepEqual(apresUneMalediction({ maudit: true, detruit: true }), { maudit: true, detruit: true });
});

test('R94 : un jet de dé — l’étape 1, ou un accessoire détruit, commence un nouvel accessoire ; sinon les drapeaux restent, puis la transition', () => {
  const sain = { maudit: false, detruit: false };
  const maudit = { maudit: true, detruit: false };
  const detruit = { maudit: true, detruit: true };
  const M = { maudit: true, detruit: false };
  // étape 1 : un autre accessoire, quoi qu'il fût
  for (const avant of [sain, maudit, detruit]) assert.deepEqual(apresUnJet(avant, { etape: 1, malediction: false }), sain);
  for (const etape of [2, 3]) {
    assert.deepEqual(apresUnJet(sain, { etape, malediction: false }), sain);
    assert.deepEqual(apresUnJet(maudit, { etape, malediction: false }), maudit, 'une ligne qui n’est pas une malédiction : reste maudit');
    assert.deepEqual(apresUnJet(sain, { etape, malediction: true }), M);
    assert.deepEqual(apresUnJet(maudit, { etape, malediction: true }), detruit, 'la seconde malédiction');
    // détruit : il ne revient jamais (« sans troisième tirage »)
    assert.deepEqual(apresUnJet(detruit, { etape, malediction: false }), sain);
    assert.deepEqual(apresUnJet(detruit, { etape, malediction: true }), M);
  }
});

test('R94 : « détruit » ne tient que si une malédiction est choisie, et implique « maudit » (adresse lue telle quelle)', () => {
  assert.deepEqual(etatDeMalediction({ maudit: false, detruit: true, malediction: true }), { maudit: true, detruit: true });
  assert.deepEqual(etatDeMalediction({ maudit: true, detruit: true, malediction: false }), { maudit: true, detruit: false }, 'l’accessoire reste maudit');
  assert.deepEqual(etatDeMalediction({ maudit: false, detruit: false, malediction: true }), { maudit: false, detruit: false }, 'rien n’est déduit');
  assert.deepEqual(etatDeMalediction({ maudit: true, detruit: false, malediction: true }), { maudit: true, detruit: false });
  assert.deepEqual(etatDeMalediction(), { maudit: false, detruit: false });
});

test('R94 : la note de l’encart — détruit, relancer depuis l’étape 2 avec le même emplacement, maudit', () => {
  assert.match(noteDeMalediction({ maudit: true, detruit: true, malediction: true }), /détruit et tombe en poussière/);
  const relancer = noteDeMalediction({ maudit: true, malediction: true });
  assert.match(relancer, /depuis l’étape 2/);
  assert.match(relancer, /même emplacement/);
  assert.match(relancer, /seconde malédiction le détruit/);
  assert.ok(!relancer.includes('étape 1'));
  assert.match(noteDeMalediction({ maudit: true }), /^Accessoire maudit : l’effet est le contraire/);
  assert.equal(noteDeMalediction({}), null);
});
