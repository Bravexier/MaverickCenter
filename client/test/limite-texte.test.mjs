// Les limites d'usage écrites dans les textes des actions de la fiche (décision R173 ; lib/limite-texte.mjs) : la lecture rejouée sur toute la base —
// effets d'accessoire activables, capacités des armes élémentaires, effets de l'armure élémentaire, don de base des races —, le genre de chaque
// période (combat, à la main, rappel, texte), et ce que les règles de la fiche (lib/fiche-regles.mjs) en exportent.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { genreDeLaPeriode, GENRES_DE_LIMITE, limiteEcrite, seBriseEcrit, typeDActionEcrit } from '../src/lib/limite-texte.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';

const db = ouvrirBase({ sansExemples: false });
const q = (sql) => db.prepare(sql).all().map((l) => ({ ...l }));
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db)));
/** Un texte qui parle d'une limite d'usage : la lecture doit en rendre une, ou le texte est dans la liste de ceux que R173 laisse en texte. */
const PARLE_D_UNE_LIMITE = /(?:\d+|une(?: seule)?) fois ?(?:\/|par )|recharge|par combat|\/combat|24 ?h/i;

test('décision R173 : le genre de chaque période (combat, à la main, rappel, texte), y compris celles des dons de classe', () => {
  assert.deepEqual(GENRES_DE_LIMITE, ['combat', 'manuel', 'rappel', 'texte']);
  for (const p of ['combat', 'Combat']) assert.equal(genreDeLaPeriode(p), 'combat', p);
  for (const p of ['jour', '24h', '24 h', 'semaine', 'mois', 'nuit', 'session', 'partie']) assert.equal(genreDeLaPeriode(p), 'manuel', p);
  for (const p of ['tour', '2 tours', 'mode hyper', 'personnage', 'Personnage', 'allié', 'ennemi', 'dialogue']) assert.equal(genreDeLaPeriode(p), 'rappel', p);
  for (const p of ['Case', 'munitions/Combat', '']) assert.equal(genreDeLaPeriode(p), 'texte', p);
  // toutes les périodes des dons de classe (capacite.limite_periode) ont un genre lu, aucune n'est « texte »
  const periodes = q('SELECT DISTINCT limite_periode AS p FROM capacite WHERE limite_periode IS NOT NULL').map((r) => r.p);
  assert.deepEqual(periodes.filter((p) => genreDeLaPeriode(p) === 'texte'), []);
  // les six précisions illisibles (« X tour/combat », « 3 tours de recharge », « 2 CK/Case », « 10 munitions/Combat », « Coût 10 chakra ») n'ont pas de limite
  const illisibles = q("SELECT type_brut FROM capacite WHERE type IN ('action', 'actif', 'reaction') AND type_brut LIKE '%(%' AND limite_nombre IS NULL").map((r) => texteSansBalises(r.type_brut));
  assert.equal(illisibles.length, 6);
  for (const t of illisibles) assert.equal(limiteEcrite(t), null, t);
});

test('décision R173 : les formes écrites de la limite', () => {
  assert.deepEqual(limiteEcrite('Rend Invisible pendant un tour (1 fois par combat)'), { nombre: 1, periode: 'combat', genre: 'combat' });
  assert.deepEqual(limiteEcrite('Permet une fois par combat de permettre à une invocation de relancer un jet raté'), { nombre: 1, periode: 'combat', genre: 'combat' });
  assert.deepEqual(limiteEcrite('Permet de relancer un jet de tir raté (une seule fois par combat)'), { nombre: 1, periode: 'combat', genre: 'combat' });
  assert.deepEqual(limiteEcrite('… (2 fois/combat)'), { nombre: 2, periode: 'combat', genre: 'combat' });
  assert.deepEqual(limiteEcrite('… (X = Maîtrise d\'arme) (2 fois par combat)'), { nombre: 2, periode: 'combat', genre: 'combat' });
  assert.deepEqual(limiteEcrite('Permet de transférer 20% de sa santé max à un allié. (1 fois/24h)'), { nombre: 1, periode: '24h', genre: 'manuel' });
  assert.deepEqual(limiteEcrite('(ne peut être changé) (1 fois/jour)'), { nombre: 1, periode: 'jour', genre: 'manuel' });
  assert.deepEqual(limiteEcrite('(Action) Permet de respirer sous l\'eau pendant 1 heure (1 semaine de recharge)'), { nombre: 1, periode: 'semaine', genre: 'manuel' });
  assert.deepEqual(limiteEcrite('Permet de relancer un jet de butin (se recharge toutes les 24h)'), { nombre: 1, periode: '24h', genre: 'manuel' });
  assert.deepEqual(limiteEcrite('(Réaction) … (récupération d\'un cran de solidité) 1 fois par semaine'), { nombre: 1, periode: 'semaine', genre: 'manuel' });
  assert.deepEqual(limiteEcrite('Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).'), { nombre: 3, periode: 'jour', genre: 'manuel' });
  assert.deepEqual(limiteEcrite('… pour un coût réduit de moitié (Réaction - 1 fois/tour)'), { nombre: 1, periode: 'tour', genre: 'rappel' });
  assert.deepEqual(limiteEcrite('(1 fois/2 tours)'), { nombre: 1, periode: '2 tours', genre: 'rappel' });
  assert.deepEqual(limiteEcrite('1 fois par Mode Hyper'), { nombre: 1, periode: 'mode hyper', genre: 'rappel' });
  for (const t of ['(Action) Rend le lanceur Insensible pendant 3 tours.', 'Munition infinie avec cette arme.', '3 tours de recharge', '', null]) assert.equal(limiteEcrite(t), null, String(t));
  assert.equal(seBriseEcrit('Permet de relancer un jet, peu importe lequel, l’objet se brise après'), true);
  assert.equal(seBriseEcrit('Inverse une malédiction, l\'objet est brisé après'), true);
  assert.equal(seBriseEcrit('Permet de s\'auto-stabiliser et se remettre à un 1 santé (choix possible). L\'objet est brisé.'), true);
  assert.equal(seBriseEcrit('Rend Invisible pendant un tour (1 fois par combat)'), false);
  assert.equal(typeDActionEcrit('(Action) Crée un sol gelé'), 'action');
  assert.equal(typeDActionEcrit('(Réaction) Permet de faire revenir l\'armure'), 'reaction');
  assert.equal(typeDActionEcrit('Si un ennemi arrive au CAC du porteur, invoque le sort (Réaction - 1 fois/tour)'), 'reaction');
  assert.equal(typeDActionEcrit('Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé)'), 'action');
  // réponse du propriétaire à Q79 (« Deviennent des actions ») : « (actif) » marque aussi une action
  assert.equal(typeDActionEcrit('(Choix possible) (actif) Invoque la météo "Orage"'), 'actif');
  assert.equal(typeDActionEcrit('Permet de relancer une esquive/parade si ce jet est raté (1 fois par combat)'), null);
});

test('décision R173, rejouée sur toute la base : chaque texte d’action qui parle d’une limite en a une lue (ou se brise), et les règles l’exportent', () => {
  // les effets d'accessoire activables (accessoire_effet.usage, R54)
  for (const e of q('SELECT id, libelle FROM accessoire_effet WHERE usage IS NOT NULL')) {
    const t = texteSansBalises(e.libelle);
    const lue = limiteEcrite(t);
    assert.ok(lue || seBriseEcrit(t) || !PARLE_D_UNE_LIMITE.test(t), `${e.id} : « ${t} »`);
    assert.ok(!lue || lue.genre !== 'texte', e.id);
    const exporte = regles.accessoires.find((a) => a.id === e.id);
    assert.deepEqual(exporte.limite ?? null, lue, e.id);
    assert.equal(Boolean(exporte.se_brise), seBriseEcrit(t), e.id);
  }
  assert.equal(regles.accessoires.filter((a) => a.se_brise).length, q('SELECT id, libelle FROM accessoire_effet WHERE usage IS NOT NULL').filter((e) => seBriseEcrit(e.libelle)).length);
  assert.ok(regles.accessoires.every((a) => a.usage || (!a.limite && !a.se_brise)), 'seuls les effets activables ont une limite exportée');
  // les capacités « actif » et « action » des armes élémentaires
  for (const e of q("SELECT id, capacite_texte FROM arme_elementaire WHERE capacite_mode IN ('actif', 'action')")) {
    const t = texteSansBalises(e.capacite_texte ?? '');
    const lue = limiteEcrite(t);
    assert.ok(lue || !PARLE_D_UNE_LIMITE.test(t), `${e.id} : « ${t} »`);
    assert.deepEqual(regles.armes_elementaires.find((a) => a.id === e.id).capacite_limite ?? null, lue, e.id);
  }
  // les effets « (Action) », « (Réaction) » et « (actif) » de l'armure élémentaire, et ceux qui écrivent une limite (Q79 : « Deviennent des actions »),
  // leur rang et leur limite ; aucun autre effet ne parle d'une limite
  const effets = q('SELECT armure_elementaire_id AS id, rang, texte FROM armure_elementaire_effet ORDER BY armure_elementaire_id, rang');
  const actions = effets.filter((e) => typeDActionEcrit(texteSansBalises(e.texte)) || limiteEcrite(texteSansBalises(e.texte)));
  for (const e of effets.filter((x) => !actions.includes(x))) assert.ok(!PARLE_D_UNE_LIMITE.test(texteSansBalises(e.texte)), `${e.id} ${e.rang}`);
  assert.ok(actions.length > 0);
  for (const e of actions) {
    const t = texteSansBalises(e.texte);
    const exporte = regles.armures_elementaires.find((a) => a.id === e.id).actions.find((x) => x.rang === e.rang);
    assert.deepEqual({ type: exporte.type, limite: exporte.limite }, { type: typeDActionEcrit(t), limite: limiteEcrite(t) }, `${e.id} ${e.rang}`);
    assert.equal(regles.armures_elementaires.find((a) => a.id === e.id).effets[exporte.index], t);
  }
  assert.equal(regles.armures_elementaires.flatMap((a) => a.actions ?? []).length, actions.length);
  // le don de base de chaque race (R13 : l'onglet de la race) : une action dont la limite se lit dans le texte, jamais par son nom
  for (const r of q('SELECT race_id, don_base FROM race_onglet')) {
    const t = texteSansBalises(r.don_base ?? '');
    const race = regles.races.find((x) => x.id === r.race_id);
    if (!typeDActionEcrit(t)) {
      assert.equal(race.don_base_action, undefined, r.race_id);
      continue;
    }
    assert.deepEqual(race.don_base_action, { type: typeDActionEcrit(t), limite: limiteEcrite(t) }, r.race_id);
    assert.ok(!PARLE_D_UNE_LIMITE.test(t) || race.don_base_action.limite, r.race_id);
  }
});

test('décision R173 : la limite de chaque don de classe est celle de son type, avec son genre', () => {
  const capacites = new Map(q('SELECT id, limite_nombre, limite_periode FROM capacite').map((c) => [c.id, c]));
  for (const d of regles.classes.flatMap((c) => c.dons)) {
    const c = capacites.get(d.id);
    const attendu = c.limite_nombre !== null && c.limite_periode ? { nombre: c.limite_nombre, periode: c.limite_periode, genre: genreDeLaPeriode(c.limite_periode) } : null;
    assert.deepEqual(d.limite ?? null, attendu, d.id);
  }
  const noyau = regles.classes.flatMap((c) => c.dons).find((d) => d.id === 'capacites/flagelleur-noyau-dur');
  assert.deepEqual([noyau.type, noyau.limite], ['passif', { nombre: 1, periode: 'combat', genre: 'combat' }]);
});
