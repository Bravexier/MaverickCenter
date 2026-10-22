// Ce que l'effet d'un accessoire change sur la fiche (lib/accessoire-champs.mjs, table accessoire_effet_cible et accessoire_effet.usage, migration 0037,
// décision R54) : le découpage, rejoué sur toute la base, redonne les lignes de la base (un changement du découpage demande une migration).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CIBLES, lecteurDEffets, usageDeLEffet } from '../src/lib/accessoire-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase({ sansExemples: false });
const q = (sql) => db.prepare(sql).all().map((l) => ({ ...l }));
const lire = lecteurDEffets([
  ...q('SELECT id, nom FROM magie').map((m) => ({ type: 'magie', ...m })),
  ...q('SELECT id, nom FROM etat').map((e) => ({ type: 'etat', ...e })),
  ...q(`SELECT DISTINCT cible_type AS type, COALESCE(cible_magie_id, cible_etat_id) AS id, cible_brut AS nom FROM magie_resistance
        UNION SELECT DISTINCT cible_type, COALESCE(cible_magie_id, cible_etat_id), cible_brut FROM ethnie_resistance`),
]);
const effets = q('SELECT * FROM accessoire_effet ORDER BY id');

test('le découpage de chaque effet redonne ses lignes de accessoire_effet_cible et son usage', () => {
  const lignes = q('SELECT effet_id, rang, cible, cible_id, valeur, choix FROM accessoire_effet_cible ORDER BY effet_id, rang');
  const attendu = effets.flatMap((e) => lire(e).bonus.map((b) => ({ effet_id: e.id, ...b })));
  assert.deepEqual(lignes, attendu);
  for (const e of effets) assert.equal(e.usage, lire(e).usage, e.id);
  assert.deepEqual([...new Set(lignes.map((l) => l.cible))].filter((c) => !CIBLES.includes(c)), []);
});

test('décision R54 : caractéristique +1, compétence au choix de la valeur tirée ; malédiction et lignes vides sans effet', () => {
  const de = (id) => lire(effets.find((e) => e.id === `ressources/accessoires#effet:${id}`)).bonus;
  assert.deepEqual(de('caracteristique:force'), [{ rang: 1, cible: 'caracteristique', cible_id: 'force', valeur: 1, choix: 0 }]);
  assert.deepEqual(de('competence:agilite:3'), [{ rang: 1, cible: 'competence', cible_id: 'agilite', valeur: null, choix: 1 }]);
  assert.deepEqual(de('attributs:7'), [{ rang: 1, cible: 'initiative', cible_id: null, valeur: 5, choix: 0 }]);
  assert.deepEqual(de('attaque:15').map((b) => [b.cible, b.valeur, b.choix]), [['degats_famille', 5, 1]]);
  // « Un point de maîtrise d'arme » : sa famille se choisit dans la fiche (décision R151, migration 0072)
  assert.deepEqual(de('attaque:7'), [{ rang: 1, cible: 'maitrise_arme', cible_id: null, valeur: 1, choix: 1 }]);
  assert.deepEqual(de('defense:14').map((b) => [b.cible, b.valeur]), [['armure_ap', 5]]);
  assert.deepEqual(de('defense:1').map((b) => b.cible_id), ['magies/magie-du-sang', q("SELECT id FROM etat WHERE nom = 'Saignement'")[0].id]);
  assert.deepEqual(de('attaque:10'), []);
  assert.deepEqual(de('attaque:4'), []);
  // chaque « Résistance … » a toutes ses cibles
  for (const e of effets.filter((x) => /^Résistance /.test(x.libelle ?? ''))) assert.equal(lire(e).bonus.length, e.libelle.split(' et ').length, e.id);
});

test('usage : « (Action) » et les usages comptés', () => {
  assert.equal(usageDeLEffet('(Action) Permet de respirer sous l’eau pendant 1 heure (1 semaine de recharge)'), 'action');
  assert.equal(usageDeLEffet('Rend Invisible pendant un tour (1 fois par combat)'), 'limite');
  assert.equal(usageDeLEffet('Permet de relancer un jet, peu importe lequel, l’objet se brise après'), 'limite');
  assert.equal(usageDeLEffet('Dégâts physiques +2'), null);
  assert.deepEqual(q("SELECT usage, COUNT(*) AS n FROM accessoire_effet WHERE usage IS NOT NULL GROUP BY usage ORDER BY usage"), [{ usage: 'action', n: 3 }, { usage: 'limite', n: 11 }]);
});

test('une résistance à une cible inconnue est refusée, jamais devinée', () => {
  assert.throws(() => lire({ propriete_id: 'defense', libelle: 'Résistance Chocolat et Feu', malediction: 0 }), /inconnue « Chocolat »/);
});
