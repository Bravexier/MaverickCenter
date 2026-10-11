// Altérations d'état repérées dans le texte d'un sort (lib/sort-etats.mjs : la règle de l'importeur documentée dans data/schema.sql, table sort_etat),
// que l'édition du site de dev refait quand une case change : rejouée sur les 322 sorts, elle redonne les lignes de sort_etat. Deux sorts seulement
// diffèrent, par des espaces insécables que la migration 0003 a mises dans leur texte sans les reporter dans l'extrait ou la forme trouvée (les
// « deux écarts déjà présents » de test/orthographe-magies.test.mjs) : là, les lignes sont égales aux espaces insécables près.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { CHAMPS_DES_ETATS, etatsDuSort, etatsDuTexte, formesDesEtats, phrasesDe } from '../src/lib/sort-etats.mjs';

const db = ouvrirBase({ sansExemples: false });
const sorts = db.prepare('SELECT * FROM sort ORDER BY id').all();
const formes = formesDesEtats(db.prepare('SELECT id, nom FROM etat').all());
const enBase = new Map();
for (const l of db.prepare('SELECT sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait FROM sort_etat ORDER BY sort_id, etat_id, relation, rang').all()) {
  const { sort_id: id, ...reste } = l;
  if (!enBase.has(id)) enBase.set(id, []);
  enBase.get(id).push({ ...reste });
}
const trier = (lignes) => [...lignes].sort((a, b) => `${a.etat_id}|${a.relation}|${a.rang}`.localeCompare(`${b.etat_id}|${b.relation}|${b.rang}`));
const sansInsecables = (lignes) => lignes.map((l) => ({ ...l, forme_trouvee: l.forme_trouvee.replace(/[  ]/g, ' ').trim(), extrait: l.extrait.replace(/[  ]/g, ' ') }));
const ECARTS_CONNUS = new Set(['magies/magie-de-lombre#sort:rayon-negatif', 'magies/magie-du-vide#sort:bisou-du-vide']);

test('rejouée sur les 322 sorts : les lignes de sort_etat exactement (état, relation, rang, stade, case, forme trouvée, extrait)', () => {
  assert.equal(sorts.length, 322);
  const differents = [];
  let n = 0;
  for (const s of sorts) {
    const trouvees = trier(etatsDuSort(s, formes));
    const attendues = enBase.get(s.id) ?? [];
    n += trouvees.length;
    if (JSON.stringify(trouvees) === JSON.stringify(attendues)) continue;
    differents.push(s.id);
    assert.ok(ECARTS_CONNUS.has(s.id), `${s.id} : ${JSON.stringify(trouvees)} ≠ ${JSON.stringify(attendues)}`);
    assert.deepEqual(sansInsecables(trouvees), sansInsecables(attendues), `${s.id} : égales aux espaces insécables près`);
  }
  assert.ok(differents.length <= ECARTS_CONNUS.size, differents.join(', '));
  assert.equal(n, db.prepare('SELECT count(*) AS n FROM sort_etat').get().n);
  assert.deepEqual(Object.keys(CHAMPS_DES_ETATS), ['type', 'cout', 'zone', 'dsb', 'effets'], 'cases du CHECK de sort_etat.champ');
});

test('tournures : inflige (stade, « stade N », « niveau N », article, guillemets), prend, soigne une liste ; une mention libre n’est pas retenue', () => {
  const lire = (texte) => etatsDuTexte(texte, formes).map((e) => [e.etat_id.split(':')[1], e.relation, e.stade, e.forme_trouvee]);
  assert.deepEqual(lire('Si jet de vigueur raté = Inflige gel 2.'), [['gel', 'inflige', 2, 'gel']]);
  assert.deepEqual(lire('Inflige Aveuglement stade 1.'), [['aveuglement', 'inflige', 1, 'Aveuglement']]);
  assert.deepEqual(lire('Si jet de vigueur raté = Inflige surdité niveau 3.'), [['surdite', 'inflige', 3, 'surdité']]);
  assert.deepEqual(lire('Inflige un saignement particulier pendant 4 tours.'), [['saignement', 'inflige', null, 'saignement']]);
  assert.deepEqual(lire('Fermeté raté = État « Peur 2 »'), [['peur', 'inflige', 2, 'Peur']]);
  assert.deepEqual(lire('Rend la cible « Enragé »'), [['enrage', 'inflige', null, 'Enragé']]);
  assert.deepEqual(lire('Si jet de fermeté raté = Inflige confus.'), [['confusion', 'inflige', null, 'confus']]);
  assert.deepEqual(lire('Inflige Empoisonné stade 2 à toutes les cibles'), [['poison', 'inflige', 2, 'Empoisonné']]);
  assert.deepEqual(lire('(3 NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1)'), [['aveuglement', 'prend', 1, 'aveuglé']]);
  assert.deepEqual(lire('force le jet de fermeté pour ne pas prendre surcharge magique 1.'), [['surcharge-magique', 'prend', 1, 'surcharge magique']]);
  assert.deepEqual(lire('Permet de soigner un état de gel, confusion et saignement.'), [['gel', 'soigne', null, 'gel'], ['confusion', 'soigne', null, 'confusion'], ['saignement', 'soigne', null, 'saignement']]);
  assert.deepEqual(lire('Permet de soigner "Poison 1", "Brûlure 1", "Paralysie 1".'), [['poison', 'soigne', 1, 'Poison'], ['brulure', 'soigne', 1, 'Brûlure'], ['paralysie', 'soigne', 1, 'Paralysie']]);
  for (const libre of ['Coma.', 'Bloque les mains, propage le lien de gel.', 'Peur 3 pour la cible pendant 3 tours.', 'Inflige 20 dégâts fixes à ceux qui souffrent d’une brûlure.',
    'Si jet de vigueur raté = aveuglement 2.', 'Permet de soigner totalement les altérations d’état.', 'Confère l’état « Corps de Maverium ».', 'Aspire 25% des PV infligés.']) {
    assert.deepEqual(lire(libre), [], libre);
  }
});

test('extrait : la phrase de la tournure (retours à la ligne, point suivi d’une espace)', () => {
  assert.deepEqual(phrasesDe('Un vrai lance-flamme. , 10% de chance d’infliger brûlure 1.\nSuite'), ['Un vrai lance-flamme.', ', 10% de chance d’infliger brûlure 1.', 'Suite']);
  assert.deepEqual(etatsDuTexte('Une simple attaque. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre gel 1.', formes).map((e) => e.extrait),
    ['3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre gel 1.']);
  const rangs = etatsDuSort({ dsb_brut: 'Inflige poison stade 1', effets: 'Inflige poison 2. Inflige brûlure 1.' }, formes).map((e) => [e.etat_id.split(':')[1], e.champ, e.rang]);
  assert.deepEqual(rangs, [['poison', 'dsb', 1], ['poison', 'effets', 2], ['brulure', 'effets', 1]]);
});
