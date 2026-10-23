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
  // « Punis-moi ... » (Flagelleur, décision R163) : chaque altération de la liste de résistances de la magie innée, plus seulement la sienne
  assert.deepEqual(lire("Augmente d'un cran la résistance aux altérations d'état lié à la magie innée."), { effets: [{ type: 'etats_resistes_magie_innee', id: null, crans: 1 }], choix: false });
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

test('décision R137 : une magie au choix (Ocultomancien « Résilience ») ou tirée (Anansi d’Arcane, avec son altération d’état), sauf l’Arcane et la Corruption : un choix de la fiche', () => {
  const sauf = ['magies/magie-de-larcane', 'magies/magie-de-la-corruption'];
  assert.deepEqual(lire("- 1 cran de résistance sur une magie aléatoire (sauf arcane et corruption) et son altération d'état."),
    { effets: [], choix: false, magies_au_choix: [{ crans: 1, sauf, alteration: true, aleatoire: true }] });
  assert.deepEqual(lire('Augmente de 1 cran la résistance à une magie au choix, à l’exception de l’arcane et de la corruption.'),
    { effets: [], choix: false, magies_au_choix: [{ crans: 1, sauf, alteration: false, aleatoire: false }] });
  // sans exception écrite, rien n'est exclu ; sur un autre (« un adversaire ») : rien
  assert.deepEqual(lire('Augmente de 2 crans la résistance à une magie au choix.'), { effets: [], choix: false, magies_au_choix: [{ crans: 2, sauf: [], alteration: false, aleatoire: false }] });
  assert.deepEqual(lire('Inflige 1 cran de faiblesse à une magie au choix sur un adversaire au corps à corps pendant 3 tours'), rien);
});

test('décision R163 : « Punis-moi ... » (les altérations auxquelles la magie innée résiste), « ... plus fort ! » (les faiblesses aux altérations de la magie innée annulées) et la remarque du D14 du Potentiel Illimité', () => {
  const D14 = 'Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire';
  // les deux textes et leur remarque, tels que l'import les a écrits (le site de dev modifie les dons)
  const dImport = new Map(historique.lignesDImport('capacite').map((c) => [c.id, c]));
  assert.deepEqual(['capacites/flagelleur-puni-moi', 'capacites/flagelleur-plus-fort'].map((id) => [dImport.get(id).effet, dImport.get(id).remarque]), [
    ["Augmente d'un cran la résistance aux altérations d'état lié à la magie innée.", D14],
    ["Annule les faiblesses aux altérations d'état liées à la magie innée.", D14],
  ]);
  const PI = 'magies/potentiel-illimite';
  assert.deepEqual(lire("Augmente d'un cran la résistance aux altérations d'état lié à la magie innée.", { remarque: D14 }),
    { effets: [{ type: 'etats_resistes_magie_innee', id: null, crans: 1 }], choix: false, si_magie_innee: PI, de: 'D14' });
  assert.deepEqual(lire("Annule les faiblesses aux altérations d'état liées à la magie innée.", { remarque: D14 }),
    { effets: [{ type: 'faiblesses_etats_magie_innee', id: null, annule: true }], choix: false, si_magie_innee: PI, de: 'D14' });
  assert.deepEqual(lire("Annule les faiblesses aux altérations d'état liées à la magie innée."), { effets: [{ type: 'faiblesses_etats_magie_innee', id: null, annule: true }], choix: false });
  // la remarque seule ne donne aucun effet ; une remarque qui ne nomme pas une magie connue, rien
  assert.deepEqual(lire('Prend 50% de dégâts en moins des altérations d\'états.', { remarque: D14 }), { effets: [], choix: false, si_magie_innee: PI, de: 'D14' });
  assert.deepEqual(lire('', { remarque: 'Dans le cas du truc, lancer un D14 pour déterminer une résistance magique aléatoire' }), rien);
  // « Punition ! » (Sadique) vise la cible : toujours rien ; le Clerc et les ethnies hybrides (au singulier) : inchangés plus haut
  assert.deepEqual(lire("Diminue d'un cran la résistance aux altérations d'état lié à la magie innée au cible. (S'il est neutre ou plus bas, ça aggrave l'altération d'état)"), rien);
  assert.deepEqual(lire("Annule les faiblesses aux altérations d'état liées à la magie innée de la cible."), rien);
});

test('pas compté : au choix ou aléatoire (signalé), passager, visant un autre, partiel ; ni ce qui ne parle pas de résistance', () => {
  for (const choix of [
    'Réduit de 1 cran une vulnérabilité magique possédée en raison de la magie innée.',
  ]) assert.deepEqual(lire(choix), { effets: [], choix: true }, choix);
  // « Au choix parmi les autres » (Drakos orange) : un choix parmi les autres lignes de la colonne, +1 cran (décision R124 : lib/fiche-regles.mjs en tire les options)
  assert.deepEqual(lire('Au choix parmi les autres', { colonne: '+1 cran de résistance' }), { effets: [], choix: true, autres: 1 });
  assert.deepEqual(lire('Au choix', { colonne: '+1 cran de résistance' }), { effets: [], choix: true }, 'un autre choix : signalé');
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
    ...db.prepare('SELECT id, effet AS texte, remarque FROM capacite').all(),
  ];
}

test('toute la base : un don qui parle de cran de résistance ou d’immunité donne quelque chose, laisse un choix, ou ne vaut qu’un temps ou pour un autre', () => {
  const plier = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const noms = db.prepare('SELECT nom FROM magie UNION SELECT nom FROM etat').all().map((r) => plier(r.nom));
  let comptes = 0;
  let auChoix = 0;
  const magiesAuChoix = [];
  const siMagieInnee = [];
  for (const d of textesDesDons()) {
    const lecture = lire(d.texte, d.colonne === undefined ? { remarque: d.remarque } : { colonne: d.colonne });
    for (const e of lecture.effets) {
      assert.ok(['magie', 'etat', 'magie_innee', 'etat_magie_innee', 'etats_resistes_magie_innee', 'faiblesses_etats_magie_innee'].includes(e.type), d.id);
      // « ... plus fort ! » (décision R163) : une annulation, sans crans
      assert.ok(e.immunite === true || (e.annule === true && e.type === 'faiblesses_etats_magie_innee') || (Number.isInteger(e.crans) && e.crans !== 0), `${d.id} : ${JSON.stringify(e)}`);
      assert.equal(e.id === null, e.type.endsWith('innee'), d.id);
    }
    if (lecture.si_magie_innee) {
      siMagieInnee.push(d.id);
      assert.ok(lecture.effets.some((e) => e.id === null), `${d.id} : la remarque du D14 sur un don qui vise la magie innée`);
    }
    comptes += lecture.effets.length ? 1 : 0;
    auChoix += lecture.choix ? 1 : 0;
    if (lecture.magies_au_choix) magiesAuChoix.push(d.id);
    const t = plier(d.texte);
    const parle = /\bcrans? de (?:resistance|vulnerabilite)|\bimmunise|^- (?:resistance|vulnerabilite) a la magie/m.test(t) || /cran de resistance/.test(plier(d.colonne));
    // non lu : passager, pour un autre, partiel… ou une immunité qui ne nomme ni magie ni altération (« immunise aux attaques discrètes »)
    if (parle && !lecture.effets.length && !lecture.choix && !lecture.magies_au_choix && !/pendant|le temps|cible|allie|adversaire|lanceur|piege|\d+\s*%/.test(t)) {
      assert.ok(/immunise/.test(t) && !noms.some((n) => new RegExp(`(?:^|[^a-z])${n}s?(?![a-z])`).test(t)), `${d.id} : « ${d.texte} » n’est pas lu`);
    }
  }
  assert.ok(comptes > 0 && auChoix > 0);
  // une magie au choix ou tirée (décision R137) : les deux dons de la décision, aucun autre
  assert.deepEqual(magiesAuChoix.sort(), ['capacites/ocultomancien-resilience', 'races/anansi#don:arcane-en-innee']);
  // la remarque du D14 (décision R163) : les dons dont la remarque la porte, aujourd'hui « Punis-moi ... » et « ... plus fort ! »
  assert.deepEqual(siMagieInnee.sort(), db.prepare("SELECT id FROM capacite WHERE remarque LIKE '%lancer un D14 pour déterminer une résistance magique aléatoire%' ORDER BY id").all().map((r) => r.id));
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
    if (lectures.some((l) => l.choix || l.magies_au_choix)) avecChoix += 1;
    const attendu = (deLaFiche.get(e.id) ?? []).sort();
    assert.deepEqual(lues.filter((x) => !x.alteration).map((x) => `${x.type}:${x.cible}:${x.valeur}`).sort(), attendu, e.id);
    // « … et son altération d'état » : la fiche donne le cran à la magie seule (l'altération suit sa magie dans le tableau de la fiche)
    for (const x of lues.filter((y) => y.alteration)) assert.ok(attendu.includes(`magie:${e.magie_id}:${x.valeur}`), `${e.id} : l’altération de sa magie`);
  }
  assert.equal(avecChoix, 2, 'Drakos Orange (« Au choix parmi les autres ») et Anansi d’Arcane (« sur une magie aléatoire », décision R137)');
});
