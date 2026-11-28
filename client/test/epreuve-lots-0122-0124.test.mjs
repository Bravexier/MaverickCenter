// L'épreuve d'entrée des lots de changements (lot 6 du chantier de la base de dev, R274, R275, garde-fou 11 ; docs/serveur.md, « Lots de changements (épreuve) » ;
// serveur/epreuve-des-lots.mjs, scripts/epreuve-des-lots.mjs) : les migrations de données 0122 à 0124 refaites sous forme de lots (test/fixtures/lots-0122-0124/,
// fabriqués une fois depuis l'historique git : le test ne lit pas git), sur une copie, par le SERVICE ; la base obtenue est comparée, table de contenu par table
// de contenu, à celle que le SQL des migrations donne. Le test dit ce qui passe aujourd'hui par un lot (a), ce qui est refusé (b : table hors édition, lot 8 ;
// entité que le service ne crée pas ni ne supprime) et ce que le service refuse même une fois les tables ouvertes (c : ses propres règles). La partie (b) ne
// s'applique que par l'option de test `ouvertHorsEdition` (aucune route ne la donne). Puis chaque lot est annulé sur une copie.
// Aucune valeur de règle n'est figée : les lots viennent des migrations ; ce que le test épingle est le PARTAGE (il ne grossit pas en silence), les verrous de
// décision ouverts et le résultat de l'épreuve.
//   node --test test/epreuve-lots-0122-0124.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { deposer } from '../serveur/edition-lots.mjs';
import { COUVERT_PAR_L_ENTITE, RAISONS, lireLesLots, partagerLeLot, refaireLEpreuve } from '../serveur/epreuve-des-lots.mjs';
import { ErreurEdition } from '../serveur/edition.mjs';
import { LOT_OUVERT_AUX_TABLES_HORS_EDITION, controlerLeLot, donnerLesNumeros } from '../src/lib/lot-de-changements.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { testRetireAvecLesMixtes } from './aide-sortie-du-contenu.mjs';
import { mixtesSorties } from '../src/lib/sortie-du-contenu.mjs';

const ICI = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = join(ICI, 'fixtures', 'lots-0122-0124');
const MIGRATIONS = join(ICI, '..', '..', 'data', 'migrations');
const NUMEROS = ['0122', '0123', '0124'];
const sqlDe = (n) => readFileSync(join(MIGRATIONS, readdirSync(MIGRATIONS).find((f) => f.startsWith(`${n}-`) && f.endsWith('.sql'))), 'utf8');

const migrations = lireLesLots(FIXTURES, NUMEROS);
const racine = dossierTemporaire('epreuve-lots');
let bilan;
// les tests qui lisent le bilan comparent chaque lot au SQL des migrations 0122 à 0124 rejoué : ils sortent avec ces migrations mixtes
// (src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LES_MIXTES), et le bilan n'est alors plus calculé
const testDuSql = testRetireAvecLesMixtes(import.meta.url);
before(async () => {
  if (mixtesSorties()) return;
  const { chemin } = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, 'vivante') });
  bilan = await refaireLEpreuve({ chemin, dossier: join(racine, 'copies'), migrations, sqlDe });
});
const de = (n) => bilan.migrations.find((m) => m.migration === n);
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

test('les lots sont de vrais lots maverick-lot/1 : valides une fois les tables hors édition ouvertes, refusés au dépôt tant qu’elles sont éteintes', () => {
  assert.equal(LOT_OUVERT_AUX_TABLES_HORS_EDITION, false, 'le lot reste éteint pour les tables hors édition jusqu’au lot 8 : l’épreuve ne l’ouvre pas');
  const base = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, 'format') }).chemin);
  try {
    const structure = (t) => {
      const lignes = base.prepare(`PRAGMA table_info("${t}")`).all();
      return lignes.length ? { colonnes: lignes.map((c) => c.name), types: Object.fromEntries(lignes.map((c) => [c.name, c.type.toUpperCase()])), cle: lignes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name) } : null;
    };
    for (const m of migrations) {
      assert.equal(m.lot.format, 'maverick-lot/1');
      assert.deepEqual(controlerLeLot(m.lot, { structure, ouvertHorsEdition: true }), { valide: true, erreurs: [] }, `lot ${m.numero}`);
      const eteint = controlerLeLot(m.lot, { structure });
      const horsEdition = m.lot.operations.filter((_, i) => eteint.erreurs.some((e) => e.rang === i + 1));
      assert.equal(eteint.valide, partagerLeLot(m.lot).refusees.every((r) => r.raison !== RAISONS.HORS_EDITION), `lot ${m.numero} : le dépôt refuse exactement les opérations sur une table hors édition`);
      assert.equal(horsEdition.length, partagerLeLot(m.lot).refusees.filter((r) => r.raison === RAISONS.HORS_EDITION).length);
    }
    // la nature : jamais « saisie » ; une décision porte son numéro (0124 : R272, que sa migration cite)
    assert.deepEqual(migrations.map((m) => [m.numero, m.lot.nature, m.lot.decision ?? null]), [['0122', 'migration', null], ['0123', 'migration', null], ['0124', 'decision', 'R272']]);
  } finally {
    base.close();
  }
});

test('déposer un lot de l’épreuve sans l’option de test : refusé (400), rien n’est enregistré (aucune route n’ouvre les tables hors édition)', async () => {
  const base = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, 'depot') }).chemin);
  try {
    const avant = base.prepare('SELECT count(*) AS n FROM lot_de_changements').get().n;
    for (const m of migrations) {
      if (!partagerLeLot(m.lot).refusees.some((r) => r.raison === RAISONS.HORS_EDITION)) continue;
      await assert.rejects(async () => deposer(() => base, m.lot, { enArrierePlan: false }), (e) => e instanceof ErreurEdition && e.statut === 400, `lot ${m.numero}`);
    }
    assert.equal(base.prepare('SELECT count(*) AS n FROM lot_de_changements').get().n, avant);
  } finally {
    base.close();
  }
});

testDuSql('le partage : ce qui passe aujourd’hui (a), ce qui est refusé (b, par table et par raison), et ce que le service refuse même ouvert (c) — la liste (b) ne grossit pas en silence', () => {
  const b = (m) => {
    const sortie = {};
    for (const r of partagerLeLot(m.lot).refusees) (sortie[r.op.table] ??= {})[r.raison] = (sortie[r.op.table][r.raison] ?? 0) + 1;
    return sortie;
  };
  // (b), la liste épinglée : des tables que le service d’édition ne sait pas écrire (lot 8). Quand le lot 8 ouvre une table, sa ligne sort d’ici.
  const hors = { hors_edition: 1 };
  // `regles_onglet` en est sortie : son titre est ouvert à l'édition (R319 (5), lib/edition-modele.mjs#TABLES), la table est connue du service ; la ligne de la
  // 0122 qui change sa page d'ouverture passe par la voie générique du journal, comme avant sur le site de dev (base source)
  assert.deepEqual(b(migrations[0]), { regle_constante: hors, mot_cle_ancienne_cle: hors });
  assert.deepEqual(b(migrations[1]), { mot_cle_categorie: { hors_edition: 9 } });
  assert.deepEqual(b(migrations[2]), { regle_constante: hors, mot_cle_ancienne_cle: hors });
  // la raison « entité que le service ne crée pas / ne supprime pas » n’y figure plus : un mot-clé se crée par le service (traduire), une page se supprime par lui
  for (const m of migrations) assert.ok(partagerLeLot(m.lot).refusees.every((r) => r.raison === RAISONS.HORS_EDITION), `lot ${m.numero}`);
  // (c) : refusé par le service lui-même, tables ouvertes ou non
  assert.deepEqual(de('0122').repartition.c.map((c) => [c.table, c.operation, c.cle]), [['page', 'supprimer', { id: 'guide/la-montee-de-niveau' }]]);
  assert.match(de('0122').repartition.c[0].message, /ne se supprime pas/);
  assert.deepEqual(de('0123').repartition.c, []);
  assert.deepEqual(de('0124').repartition.c, []);
  // sans les opérations (b), le service refuse AUSSI la suppression de la page dans la partie (a) seule : elle est citée par une ligne de « Constante de règle »
  // (0122 : et page d'ouverture d'un onglet ; 0124 : `guide/fiche-accessoires-et-ceinture`)
  assert.deepEqual(de('0122').partie_a.ecartees.map((e) => [e.table, e.cle.id]), [['page', 'guide/la-montee-de-niveau']]);
  assert.deepEqual(de('0123').partie_a.ecartees, []);
  assert.deepEqual(de('0124').partie_a.ecartees.map((e) => [e.table, e.cle.id]), [['page', 'guide/fiche-accessoires-et-ceinture']]);
  for (const n of ['0122', '0124']) assert.match(de(n).partie_a.ecartees[0].message, /citée par/);
  // (a) + (b) + (c) = toutes les opérations du lot
  for (const m of migrations) {
    const r = de(m.numero).repartition;
    assert.equal(total(r.a) + total(Object.fromEntries(Object.entries(r.b).map(([t, x]) => [t, total(x)]))) + r.c.length, m.lot.operations.length, `lot ${m.numero}`);
    assert.ok(total(r.a) > 0, `lot ${m.numero} : une part passe déjà par un lot`);
  }
});

test('le complément : les lignes que le service retire lui-même avec une entité sont celles que son suppresseur emporte, et rien d’autre', () => {
  for (const m of migrations) {
    for (const c of m.complement.couvertes) {
      assert.equal(c.operation, 'supprimer');
      const entites = Object.entries(COUVERT_PAR_L_ENTITE).filter(([, filles]) => filles.some(([t]) => t === c.table) || c.table === 'source');
      assert.ok(entites.length, `${m.numero} : ${c.table} n’est retirée par aucune entité`);
    }
    for (const [jeton, numero] of Object.entries(m.complement.numeros)) assert.equal(jeton, `${jeton.replace(/_\d+$/, '')}_${numero}`, 'le jeton porte le numéro que la migration donnait');
  }
});

testDuSql('même base : après chaque lot, le service a écrit ce que la migration écrit, table de contenu par table de contenu (modulo les numéros donnés et ce que le service refuse, (c))', () => {
  for (const m of bilan.migrations) {
    assert.deepEqual(m.comparaison.non_expliquees, [], `migration ${m.migration} : une table diffère de la base migrée sans que (c) l’explique`);
    assert.ok(m.comparaison.tables >= 100, `migration ${m.migration} : les tables de contenu se comparent toutes`);
    assert.equal(m.comparaison.egales, m.comparaison.tables - m.comparaison.expliquees_par_les_refus.length, `migration ${m.migration} : toutes les autres tables sont identiques`);
    assert.equal(m.lot_ouvert.essai.problemes_nouveaux.length, 0, 'aucun problème né du lot aux contrôles du contenu');
  }
  // l'écart du (c) de la 0122 est la page refusée et ce que le service emporte avec elle ; le reste de la base est identique
  // (la page, ses 5 lignes de page_source, son entrée de menu, la source qu'elle seule citait ; l'écart reste le même après la 0123 et la 0124, qui ne le touchent pas)
  const attendu = [{ table: 'page', lignes: 1 }, { table: 'page_source', lignes: 5 }, { table: 'regles_onglet_entree', lignes: 1 }, { table: 'source', lignes: 1 }];
  for (const n of ['0122', '0123', '0124']) assert.deepEqual([...de(n).comparaison.expliquees_par_les_refus].sort((a, b) => a.table.localeCompare(b.table)), attendu, `migration ${n}`);
  assert.equal(de('0123').refusees_une_fois_ouvert.length + de('0124').refusees_une_fois_ouvert.length, 0, 'la 0123 et la 0124 sont refaites en entier');
});

testDuSql('les numéros : les neuf mots-clés de la 0123 prennent les neuf numéros suivants du service (jamais ceux de la migration d’office), consécutifs ; la base est la même modulo ces numéros', () => {
  const n = de('0123').numeros;
  assert.equal(n.length, 9);
  assert.deepEqual(n.map((x) => x.jeton), Object.keys(migrations[1].complement.numeros));
  n.slice(1).forEach((x, i) => assert.equal(x.service, n[i].service + 1, 'consécutifs'));
  assert.ok(n.every((x) => x.table === 'mot_cle'));
  // les numéros du service ne sont pas ceux de la migration d'office (ils dépendent du plus haut numéro connu de la base) : « même base » est jugé modulo ces numéros
  // (test « même base » : mot_cle et mot_cle_categorie sont égales une fois les numéros ramenés à ceux de la migration)
  assert.ok(n.every((x) => Number.isInteger(x.service) && Number.isInteger(x.migration)));
  assert.equal(de('0122').numeros.length + de('0124').numeros.length, 0);
});

testDuSql('les verrous des décisions : le lot ne s’applique qu’avec l’accord donné au clic ; les numéros ouverts sont ceux que l’essai demandait', () => {
  // R218 : le verrou des mots-clés (supprimer, créer verrouillé, adresse) ; R219 : le gel des mots-clés qui mènent à une page
  assert.deepEqual(de('0122').verrous_ouverts, ['R218', 'R219']);
  assert.deepEqual(de('0123').verrous_ouverts, ['R218']);
  assert.deepEqual(de('0124').verrous_ouverts, ['R218', 'R219']);
  for (const m of bilan.migrations) assert.deepEqual(m.verrous_ouverts, m.lot_ouvert.essai.verrous);
});

testDuSql('annuler (garde-fou 11) : la 0122 s’annule et la base d’avant revient ; la 0123 et la 0124 sont REFUSÉES par le service (ancre figée, adresse disparue), le lot reste appliqué', () => {
  const a = de('0122').annulation;
  assert.equal(a.annulee, true);
  assert.deepEqual(a.base_d_avant.differentes, [], 'la base d’avant la 0122 revient, table par table');
  assert.equal(a.gardees, 0);
  assert.ok(a.remises >= de('0122').lot_ouvert.operations, 'chaque ligne du lot appliqué est remise');
  // le service refuse de remettre ce qu'il ne saurait pas écrire aujourd'hui : une ancre figée ne se retire pas, une adresse qui n'existe plus ne se pose pas
  assert.equal(de('0123').annulation.annulee, false);
  assert.match(de('0123').annulation.refus, /ancres? figée/);
  assert.equal(de('0124').annulation.annulee, false);
  assert.match(de('0124').annulation.refus, /adresse d.aucune page/);
});

test('un numéro n’est jamais redonné : donnerLesNumeros reprend le numéro d’une clé composée au lieu d’en donner un autre (la ligne de liaison d’un mot-clé du même lot)', () => {
  const lot = migrations[1].lot;
  const { numeros, lot: resolu } = donnerLesNumeros(lot, () => 1000);
  assert.equal(numeros.length, 9, 'un numéro par mot-clé, aucun pour ses lignes de liaison');
  const liaisons = resolu.operations.filter((o) => o.table === 'mot_cle_categorie');
  assert.deepEqual(liaisons.map((o) => o.cle.mot_cle_id), numeros.map((x) => x.numero));
  assert.deepEqual(liaisons.map((o) => o.apres.mot_cle_id), numeros.map((x) => x.numero));
});
