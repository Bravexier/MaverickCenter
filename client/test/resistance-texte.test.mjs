// Résistances écrites dans les dons (lib/resistance-texte.mjs), lues pour le tableau « Résistance / Faiblesse » de la fiche : entrées synthétiques qui
// imitent l'onglet des races et les dons de classe, puis toute la base ; et, sur les textes de l'import, l'accord avec les résistances des ethnies de la
// fiche auto V15.2.2 (ethnie_resistance, onglet « Bonus Race »).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { lecteurDeResistances } from '../src/lib/resistance-texte.mjs';

const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
const etat = (slug) => `guide/liste-des-alterations-d-etat#etat:${slug}`;
const lire = lecteurDeResistances([
  ...db.prepare('SELECT id, nom FROM magie').all().map((m) => ({ type: 'magie', id: m.id, nom: m.nom })),
  ...db.prepare('SELECT id, nom FROM etat').all().map((e) => ({ type: 'etat', id: e.id, nom: e.nom })),
  ...db.prepare(`SELECT DISTINCT cible_type AS type, COALESCE(cible_magie_id, cible_etat_id) AS id, cible_brut AS nom FROM magie_resistance
                 UNION SELECT DISTINCT cible_type, COALESCE(cible_magie_id, cible_etat_id), cible_brut FROM ethnie_resistance`).all(),
]);
const rien = { effets: [], choix: false };

test('crans écrits : la magie innée et son altération, l’altération seule, des cibles nommées, une colonne « +1 cran de résistance »', () => {
  const inneeEtAlteration = { effets: [{ type: 'magie_innee', id: null, crans: 1 }, { type: 'etat_magie_innee', id: null, crans: 1 }], choix: false };
  assert.deepEqual(lire("- Distinction, Observation et Magie = 5% en acquis\n- 1 cran de résistance en plus à la magie innée et son altération d'état."), inneeEtAlteration);
  assert.deepEqual(lire("Augmente d'un cran la résistance à la magie innée et à son altération d'état."), inneeEtAlteration);
  assert.deepEqual(lire("Augmente d'un cran la résistance aux altérations d'état lié à la magie innée."), { effets: [{ type: 'etat_magie_innee', id: null, crans: 1 }], choix: false });
  assert.deepEqual(lire('- +1 santé, +1 chakra\n- 1 cran de résistance au gel et à la brûlure.'),
    { effets: [{ type: 'etat', id: etat('gel'), crans: 1 }, { type: 'etat', id: etat('brulure'), crans: 1 }], choix: false });
  assert.deepEqual(lire('- Résistance à la magie du Sang\n- Vulnérabilité à la magie de la Nécromancie'),
    { effets: [{ type: 'magie', id: 'magies/magie-du-sang', crans: 1 }, { type: 'magie', id: 'magies/magie-de-la-necromancie', crans: -1 }], choix: false });
  assert.deepEqual(lire('Brûlure', { colonne: '+1 cran de résistance' }), { effets: [{ type: 'etat', id: etat('brulure'), crans: 1 }], choix: false });
  assert.deepEqual(lire('Pétrification', { colonne: '+1 cran de résistance' }), { effets: [{ type: 'etat', id: etat('petrifie'), crans: 1 }], choix: false },
    'l’écriture rapprochée par l’importeur');
  assert.deepEqual(lire('Feu', { colonne: 'Magie innée' }), rien, 'une autre colonne se lit comme un texte');
});

test('immunités écrites : seules les cibles connues (« la maladie » n’est ni une magie ni une altération)', () => {
  assert.deepEqual(lire('Immunisé contre le poison et la maladie. Son acquis max en Social est augmenté de +20.'),
    { effets: [{ type: 'etat', id: etat('poison'), immunite: true }], choix: false });
  assert.deepEqual(lire('Totalement immunisé à l\'altération d\'état "Couardise"'), { effets: [{ type: 'etat', id: etat('couardise'), immunite: true }], choix: false });
  assert.deepEqual(lire('Immunisé aux poisons et à toutes les fioles "offensive"'), { effets: [{ type: 'etat', id: etat('poison'), immunite: true }], choix: false });
  assert.deepEqual(lire('Totalement immunisé à l’aveuglement.'), { effets: [{ type: 'etat', id: etat('aveuglement'), immunite: true }], choix: false });
});

test('pas compté : au choix ou aléatoire (signalé), passager, visant un autre, partiel ; ni ce qui ne parle pas de résistance', () => {
  for (const choix of [
    "- 1 cran de résistance sur une magie aléatoire (sauf arcane et corruption) et son altération d'état.",
    "Augmente de 1 cran la résistance à une magie au choix, à l'exception de l'arcane et de la corruption.",
    'Réduit de 1 cran une vulnérabilité magique possédée en raison de la magie innée.',
  ]) assert.deepEqual(lire(choix), { effets: [], choix: true }, choix);
  assert.deepEqual(lire('Au choix parmi les autres', { colonne: '+1 cran de résistance' }), { effets: [], choix: true });
  for (const autre of [
    "Permet de se téléporter dans un feu magique, permet d'être immunisé à la brûlure le temps de la téléportation (1 tour)",
    'Insensible à la douleur, Immunisé aux Peurs pendant 2 tours. Tombe dans le coma une fois terminé.',
    "Le piège va baisser d'un cran la résistance à la magie innée* du lanceur pendant 2 tours.",
    "Diminue d'un cran la résistance aux altérations d'état lié à la magie innée au cible.",
    'Inflige 1 cran de faiblesse à une magie au choix sur un adversaire au corps à corps pendant 3 tours',
    'Les sorts d’attaque de la magie innée ignorent 1 cran de résistance de la cible, si elle en possède.',
    'Immunise un allié de toutes les altérations d’état pendant 3 tours.',
    'Augmente les AM de base de 5 et immunise à 95% au contrôle mental.',
    "permet de sacrifier 25% de réussite pour pouvoir ignorer d'un cran la résistance à l'estoc d'une armure.",
    "La prochaine attaque va faire perdre un cran de solidité à l'arme de cible",
    'Si une attaque de CAC est encaissée, un tentacule inflige Poison 1 pendant 1 tour.',
    null,
  ]) assert.deepEqual(lire(autre), rien, String(autre));
});

/** Textes des dons tels qu'ils sont, avec la colonne d'une cellule de tableau. */
function textesDesDons() {
  return [
    ...db.prepare('SELECT id, texte FROM race_don').all().map((d) => ({ id: d.id, texte: d.texte })),
    ...db.prepare(`SELECT c.race_id || ' L' || c.ligne || ' C' || c.colonne AS id, c.valeur AS texte, k.libelle AS colonne FROM race_don_tableau_cellule c
                   JOIN race_don_tableau_colonne k ON k.race_id = c.race_id AND k.rang = c.colonne`).all(),
    ...db.prepare('SELECT id, effet AS texte FROM capacite').all(),
  ];
}

test('toute la base : un don qui parle de cran de résistance ou d’immunité donne quelque chose, laisse un choix, ou ne vaut qu’un temps ou pour un autre', () => {
  const plier = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const noms = db.prepare('SELECT nom FROM magie UNION SELECT nom FROM etat').all().map((r) => plier(r.nom));
  let comptes = 0;
  let auChoix = 0;
  for (const d of textesDesDons()) {
    const lecture = lire(d.texte, d.colonne === undefined ? {} : { colonne: d.colonne });
    for (const e of lecture.effets) {
      assert.ok(['magie', 'etat', 'magie_innee', 'etat_magie_innee'].includes(e.type), d.id);
      assert.ok(e.immunite === true || (Number.isInteger(e.crans) && e.crans !== 0), `${d.id} : ${JSON.stringify(e)}`);
      assert.equal(e.id === null, e.type.endsWith('innee'), d.id);
    }
    comptes += lecture.effets.length ? 1 : 0;
    auChoix += lecture.choix ? 1 : 0;
    const t = plier(d.texte);
    const parle = /\bcrans? de (?:resistance|vulnerabilite)|\bimmunise|^- (?:resistance|vulnerabilite) a la magie/m.test(t) || /cran de resistance/.test(plier(d.colonne));
    // non lu : passager, pour un autre, partiel… ou une immunité qui ne nomme ni magie ni altération (« immunise aux attaques discrètes »)
    if (parle && !lecture.effets.length && !lecture.choix && !/pendant|le temps|cible|allie|adversaire|lanceur|piege|\d+\s*%/.test(t)) {
      assert.ok(/immunise/.test(t) && !noms.some((n) => new RegExp(`(?:^|[^a-z])${n}s?(?![a-z])`).test(t)), `${d.id} : « ${d.texte} » n’est pas lu`);
    }
  }
  assert.ok(comptes > 0 && auChoix > 0);
});

test('import : chaque ethnie a, d’après son onglet, les crans que la fiche auto lui donne (ethnie_resistance), plus l’altération de sa magie quand l’onglet l’écrit', () => {
  const ethnies = db.prepare('SELECT id, race_id, magie_id FROM ethnie').all();
  const deLaFiche = new Map();
  for (const r of db.prepare('SELECT ethnie_id, cible_type, COALESCE(cible_magie_id, cible_etat_id) AS cible, valeur FROM ethnie_resistance').all()) {
    if (!deLaFiche.has(r.ethnie_id)) deLaFiche.set(r.ethnie_id, []);
    deLaFiche.get(r.ethnie_id).push(`${r.cible_type}:${r.cible}:${r.valeur}`);
  }
  const etatDeMagie = new Map(db.prepare('SELECT magie_id, etat_id FROM etat_magie').all().map((r) => [r.magie_id, r.etat_id]));
  const dons = historique.lignesDImport('race_don');
  const lignes = historique.lignesDImport('race_don_tableau_ligne');
  const cellules = historique.lignesDImport('race_don_tableau_cellule');
  const colonnes = historique.lignesDImport('race_don_tableau_colonne');
  let avecChoix = 0;
  for (const e of ethnies) {
    const lectures = [
      ...dons.filter((d) => d.ethnie_id === e.id).map((d) => lire(d.texte)),
      ...lignes.filter((l) => l.ethnie_id === e.id).flatMap((l) => cellules.filter((c) => c.race_id === l.race_id && c.ligne === l.rang)
        .map((c) => lire(c.valeur, { colonne: colonnes.find((k) => k.race_id === c.race_id && k.rang === c.colonne)?.libelle }))),
    ];
    const lues = lectures.flatMap((l) => l.effets).map((x) => {
      const type = x.type === 'magie_innee' ? 'magie' : x.type === 'etat_magie_innee' ? 'etat' : x.type;
      const cible = x.type === 'magie_innee' ? e.magie_id : x.type === 'etat_magie_innee' ? etatDeMagie.get(e.magie_id) : x.id;
      return { type, cible, valeur: x.crans, alteration: x.type === 'etat_magie_innee' };
    });
    if (lectures.some((l) => l.choix)) avecChoix += 1;
    const attendu = (deLaFiche.get(e.id) ?? []).sort();
    assert.deepEqual(lues.filter((x) => !x.alteration).map((x) => `${x.type}:${x.cible}:${x.valeur}`).sort(), attendu, e.id);
    // « … et son altération d'état » : la fiche donne le cran à la magie seule (l'altération suit sa magie dans le tableau de la fiche)
    for (const x of lues.filter((y) => y.alteration)) assert.ok(attendu.includes(`magie:${e.magie_id}:${x.valeur}`), `${e.id} : l’altération de sa magie`);
  }
  assert.equal(avecChoix, 2, 'Drakos Orange (« Au choix parmi les autres ») et Anansi d’Arcane (« sur une magie aléatoire »)');
});
