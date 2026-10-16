// Menu « DB » (le schéma de la base) de la page Debug (demande du propriétaire du 2026-10-15 : « un mappage vectoriel des tables […] zoomer et dézoomer […]
// D'un double clic sur une de ces tables, ça ouvrirait une popup avec le contenu dans un tableau (scrollable) ») : structure du schéma calculée comme au
// build (lib/schema-structure.mjs, sur la VRAIE base), mise en page et rendu purs (lib/debug-schema.mjs), contrat avec le service
// (serveur/debug-tables.mjs), script et composant.
//   node --test test/debug-schema.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { DESCRIPTION_MAX, jsonPourLaPage, structureDeLaBase, structureDuSchema } from '../src/lib/schema-structure.mjs';
import {
  COMPTE_RESERVE, ECART_DES_TRAITS, GEOMETRIE, LISIBLE_A_L_ECRAN, NIVEAUX, PAGE_DE_LIGNES, POLICES, TITRE_LOIN_ECRAN, TITRE_LOIN_MAX, ZOOM_LISIBLE, ZOOM_MAX,
  ZOOM_MIN, actionDeLaMolette, adresseDuContenu, bornerZoom, cadrer, centrerSur, chercherTable, clesASuivre, comptesVivants, deplacer, echapper,
  ecranVersSchema, empiler, englobant, etiquetteDeTable, geometrieDuLien, htmlDesCles, htmlDesEntetes, htmlDesLignes, indiceDuLien, infobulleDeColonne,
  infobulleDeTable, interpoler, libelleDeCle, libelleDesLignes, lignesDuNom, mesurerTable, messageDErreur, mettreEnPage, milieuDeLaColonne, montrer,
  niveauDeDetail, nombre, partieVisible, recouvrent, resumeDuContenu, resumeDuSchema, schemaVersEcran, htmlDuSchema, tableVoisine, tablesCommunes,
  TAILLES_DE_LOIN, tailleDuNomDeLoin, titreCourt, traitsARefaire, triSuivant, valeurEnHtml, zoomAutour,
  MISE_EN_EVIDENCE_MS, RELEVE_DE_LA_BASE_MS, RELEVE_EN_PANNE_MS, adresseDeLaVersion, annonceDuChangement, assemblerLesPages, cleDeLigne, debutDePage,
  etatDeLEchec, heureCourte, libelleDuSuivi, noteDuTriPerdu, pageAccordee, pagesARedemander, planDeMiseAJour, resumeDesChangements, suiteDeLaReleve,
} from '../src/lib/debug-schema.mjs';
import { TABLES_DERIVEES } from '../serveur/debug-tables.mjs';
import { descriptionOpenApi } from '../serveur/openapi.mjs';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const racine = trouverRacine();
const texteSchema = readFileSync(join(racine, 'data', 'schema.sql'), 'utf8');
// comme au build : la base construite depuis data/rows (lib/donnees.mjs#ouvrirBase), et le texte du schéma
const structure = structureDeLaBase();
const plan = mettreEnPage(structure);
const tablesSeules = structure.tables.filter((t) => t.genre !== 'vue');
const proche = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('structure (au build) : 18 sections, 188 tables (dont les 2 dérivées), 35 vues, sans FTS5 ; colonnes, types, clés et descriptions de la base', () => {
  assert.equal(structure.sections.length, 18);
  assert.deepEqual(structure.sections.map((s) => s.numero), ['0', '1', '2', '3', '4', '5', '5 bis', '6', '7', '8', '8 bis', '9', '10', '11', '12', '13', '14', '15']);
  assert.equal(structure.sections.find((s) => s.numero === '3').titre, 'MAGIES ET SORTS (famille « magies »)');
  // chaque titre en entier (l'en-tête d'une section tient sur une ligne : le 15 s'arrêtait à « … faites sur le », lib/schema-doc.mjs)
  assert.deepEqual(Object.fromEntries(structure.sections.map((s) => [s.numero, s.titre])), {
    0: 'FAMILLES D\'IMPORT',
    1: 'PAGES, LIENS, MOTS-CLÉS, SOURCES (couche générique)',
    2: 'RÈGLES DE LA FICHE : caractéristiques, compétences, niveaux, constantes, postures (famille « fiche »)',
    3: 'MAGIES ET SORTS (famille « magies »)',
    4: 'ANNEXES DES MAGIES : états, résistances, météo, modes hyper et super (famille « annexes »)',
    5: 'DIEUX',
    '5 bis': 'CHRONOLOGIE : les événements datés du Codex et des races (famille « chronologie » ; migration 0035, docs/chronologie.md)',
    6: 'CLASSES, SPÉCIALITÉS, CAPACITÉS (famille « classes »)',
    7: 'RACES, ETHNIES, ACCESSIBILITÉS (famille « races »)',
    8: 'BESTIAIRE : invocations et créatures (famille « bestiaire »)',
    '8 bis': 'BESTIAIRE 2.0 : monstres, butin, échelles de puissance (famille « monstres »)',
    9: 'ÉQUIPEMENT, RESSOURCES, CRAFT, MÉTIERS (familles « equipement », « craft », « docs_typees »)',
    10: 'TRANSVERSAL : notes de cellule et écarts entre sources',
    11: 'TABLES DÉRIVÉES (jamais exportées dans data/rows/, recalculées par `npm run db:build`)',
    12: 'VUES (toujours à jour : rien à recalculer)',
    13: 'PERSONNAGES : les vraies fiches (joueurs et prétirés), les groupes de jeu et la visibilité (saisie, jamais importée ; migration 0011)',
    14: 'ÉDITION : le journal des modifications faites depuis le site de dev (saisie, jamais importée ; migration 0017)',
    15: 'NOTES DE VERSION : ce que chaque version a changé dans les règles, et l\'historique des modifications faites sur le site de dev',
  });
  for (const s of structure.sections) assert.doesNotMatch(s.titre, /\s(le|la|les|de|des|du|sur|et|à|au|aux)$/, `${s.numero} : un titre coupé au milieu d’une phrase`);
  assert.equal(tablesSeules.length, 188);
  assert.equal(structure.tables.filter((t) => t.genre === 'vue').length, 35);
  assert.deepEqual(structure.tables.filter((t) => t.genre === 'derivee').map((t) => t.nom).sort(), [...TABLES_DERIVEES].sort(), 'les mêmes dérivées que le service');
  assert.ok(!structure.tables.some((t) => /_fts(_|$)/.test(t.nom)), 'ni tables FTS5 ni leurs tables de shadow');
  assert.equal(new Set(structure.tables.map((t) => t.nom)).size, structure.tables.length);
  // toutes les tables et vues de la base (hors internes et FTS) : celles que le service liste aussi
  const db = ouvrirBase();
  const base = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%fts%'").all().map((r) => r.name).sort();
  assert.deepEqual(structure.tables.map((t) => t.nom).sort(), base);
  for (const t of structure.tables) {
    assert.ok(structure.sections.some((s) => s.numero === t.section), `${t.nom} : section connue`);
    const info = db.prepare(`PRAGMA table_info("${t.nom}")`).all();
    assert.deepEqual(t.colonnes.map((c) => [c.nom, c.type, c.pk, c.nonNul]), info.map((c) => [c.name, c.type, c.pk, c.notnull === 1]), t.nom);
    assert.equal(t.lignes, db.prepare(`SELECT count(*) AS n FROM "${t.nom}"`).get().n, `${t.nom} : lignes au build`);
    assert.ok(t.description.length <= DESCRIPTION_MAX);
  }
  const sort = structure.tables.find((t) => t.nom === 'sort');
  assert.equal(sort.section, '3');
  assert.match(sort.description, /une ligne par sort/);
  assert.deepEqual(sort.colonnes.find((c) => c.nom === 'magie_id').fk, { table: 'magie', colonne: 'id' });
  assert.match(sort.colonnes.find((c) => c.nom === 'id').description, /gelé/, 'commentaire de colonne');
  assert.deepEqual(new Set(structure.tables.flatMap((t) => t.colonnes.map((c) => c.type))), new Set(['TEXT', 'INTEGER', 'REAL', 'BLOB', '']), 'types tels que déclarés');
});

test('structure : chaque clé étrangère de la base (PRAGMA foreign_key_list), une fois, dans l’ordre du schéma ; plusieurs colonnes = une clé', () => {
  const db = ouvrirBase();
  let total = 0;
  for (const t of tablesSeules) {
    const ids = new Set(db.prepare(`PRAGMA foreign_key_list("${t.nom}")`).all().map((f) => f.id));
    assert.equal(t.cles_etrangeres.length, ids.size, t.nom);
    total += ids.size;
    for (const c of t.cles_etrangeres) {
      assert.equal(c.colonnes.length, c.vers.length);
      assert.ok(c.vers.every((v) => typeof v === 'string'), `${t.nom} → ${c.table} : colonnes visées connues`);
      assert.ok(structure.tables.some((x) => x.nom === c.table), `${t.nom} → ${c.table} : cible dans le schéma`);
      for (const [i, col] of c.colonnes.entries()) {
        const fk = t.colonnes.find((x) => x.nom === col).fk;
        assert.ok(fk && fk.table, `${t.nom}.${col} porte sa clé`);
        if (fk.table === c.table) assert.ok(fk.colonne === c.vers[i] || t.cles_etrangeres.some((d) => d.colonnes.includes(col)), `${t.nom}.${col}`);
      }
    }
  }
  assert.equal(total, 399);
  assert.equal(structure.tables.filter((t) => t.genre === 'vue').reduce((n, t) => n + t.cles_etrangeres.length, 0), 0, 'une vue n’a pas de clé étrangère');
  const cellule = structure.tables.find((t) => t.nom === 'race_don_tableau_cellule');
  const multiples = cellule.cles_etrangeres.filter((c) => c.colonnes.length > 1).map((c) => [c.colonnes, c.table, c.vers]);
  assert.deepEqual(multiples, [
    [['race_id', 'ligne'], 'race_don_tableau_ligne', ['race_id', 'rang']],
    [['race_id', 'colonne'], 'race_don_tableau_colonne', ['race_id', 'rang']],
  ], 'une clé à plusieurs colonnes reste UNE clé, dans l’ordre du schéma');
  assert.deepEqual(cellule.colonnes.find((c) => c.nom === 'ligne').fk, { table: 'race_don_tableau_ligne', colonne: 'rang' });
  const note = structure.tables.find((t) => t.nom === 'note_cellule');
  assert.ok(note.cles_etrangeres.some((c) => c.table === 'note_cellule'), 'auto-référence');
  // `fks` : TOUTES les clés qui contiennent la colonne (une colonne dans deux clés, une clé à plusieurs colonnes, l'auto-référence)
  for (const t of tablesSeules) {
    for (const col of t.colonnes) {
      const attendues = t.cles_etrangeres.filter((c) => c.colonnes.includes(col.nom))
        .map((c) => ({ table: c.table, colonne: c.vers[c.colonnes.indexOf(col.nom)], colonnes: c.colonnes, vers: c.vers }));
      assert.deepEqual(col.fks, attendues, `${t.nom}.${col.nom}`);
      assert.deepEqual(col.fk, attendues.length ? { table: attendues[0].table, colonne: attendues[0].colonne } : null, `${t.nom}.${col.nom} : fk = la première`);
    }
  }
  const colonneDe = (table, nom) => structure.tables.find((t) => t.nom === table).colonnes.find((c) => c.nom === nom);
  assert.deepEqual(colonneDe('race_don_tableau_cellule', 'race_id').fks.map((f) => f.table), ['race_don_tableau_ligne', 'race_don_tableau_colonne'], 'deux clés');
  assert.deepEqual(colonneDe('capacite', 'classe_id').fks.map((f) => [f.table, f.colonnes]), [['classe', ['classe_id']], ['specialite', ['specialite_id', 'classe_id']]]);
  assert.deepEqual(colonneDe('note_cellule', 'entite_table').fks, [{ table: 'note_cellule', colonne: 'entite_table', colonnes: ['entite_table', 'entite_id', 'repond_a'], vers: ['entite_table', 'entite_id', 'rang'] }]);
  assert.equal(structure.tables.filter((t) => t.genre === 'vue').flatMap((t) => t.colonnes).filter((c) => c.fks.length).length, 0);
  // `vers` absent du schéma (REFERENCES t) : la clé primaire de la cible
  const memoire = new DatabaseSync(':memory:');
  memoire.exec('CREATE TABLE a (id TEXT PRIMARY KEY); CREATE TABLE b (x TEXT REFERENCES a, y INTEGER);');
  const mini = structureDuSchema(memoire, '-- 1. ESSAI\n-- ====\n-- La table a.\nCREATE TABLE a (\n  id TEXT PRIMARY KEY -- clé\n);\nCREATE TABLE b (\n  x TEXT REFERENCES a,\n  y INTEGER\n);\n');
  assert.deepEqual(mini.tables.find((t) => t.nom === 'b').cles_etrangeres, [{ colonnes: ['x'], table: 'a', vers: ['id'], suppression: 'NO ACTION' }]);
  assert.deepEqual(mini.tables.find((t) => t.nom === 'b').colonnes[0].fk, { table: 'a', colonne: 'id' });
  assert.equal(mini.tables.find((t) => t.nom === 'a').colonnes[0].description, 'clé');
});

test('JSON posé dans la page : rien ne ferme le <script> (« < » échappé), relu à l’identique', () => {
  const piege = { sections: [{ numero: '1', titre: '</script><script>alert(1)</script>' }], tables: [{ nom: 'x', description: '<!-- a -->' }] };
  const json = jsonPourLaPage(piege);
  assert.doesNotMatch(json, /</);
  assert.deepEqual(JSON.parse(json), piege);
  const vrai = jsonPourLaPage(structure);
  assert.doesNotMatch(vrai, /<\/script|<!--/i);
  assert.deepEqual(JSON.parse(vrai), structure);
  assert.ok(vrai.length < 600_000, `taille raisonnable (${vrai.length} caractères)`);
});

test('mise en page : toutes les tables et vues placées, dans le bloc de leur section, AUCUN chevauchement (boîtes, blocs), déterministe', () => {
  assert.equal(plan.boites.length, structure.tables.length);
  assert.deepEqual(plan.boites.map((b) => b.nom), structure.tables.map((t) => t.nom), 'dans l’ordre du schéma');
  for (const b of plan.boites) {
    assert.ok([b.x, b.y, b.largeur, b.hauteur].every(Number.isFinite), b.nom);
    const t = structure.tables.find((x) => x.nom === b.nom);
    assert.deepEqual({ largeur: b.largeur, hauteur: b.hauteur }, mesurerTable(t));
    const bloc = plan.blocs.find((k) => k.numero === t.section && k.vues === (t.genre === 'vue'));
    assert.ok(bloc, `${b.nom} : bloc de sa section`);
    assert.ok(b.x >= bloc.x && b.y >= bloc.y + GEOMETRIE.titre && b.x + b.largeur <= bloc.x + bloc.largeur && b.y + b.hauteur <= bloc.y + bloc.hauteur, `${b.nom} dans son bloc`);
  }
  for (let i = 0; i < plan.boites.length; i++) {
    for (let j = i + 1; j < plan.boites.length; j++) assert.ok(!recouvrent(plan.boites[i], plan.boites[j]), `${plan.boites[i].nom} / ${plan.boites[j].nom}`);
  }
  for (let i = 0; i < plan.blocs.length; i++) {
    for (let j = i + 1; j < plan.blocs.length; j++) assert.ok(!recouvrent(plan.blocs[i], plan.blocs[j]), `${plan.blocs[i].cle} / ${plan.blocs[j].cle}`);
  }
  // un bloc par section qui a des tables, puis un par section qui a des vues (12 et 13), posés après : montrer les vues ne déplace aucune table
  assert.deepEqual(plan.blocs.filter((b) => !b.vues).map((b) => b.numero), structure.sections.map((s) => s.numero).filter((n) => n !== '12'));
  assert.deepEqual(plan.blocs.filter((b) => b.vues).map((b) => b.numero), ['12', '13']);
  assert.ok(plan.blocs.findIndex((b) => b.vues) > plan.blocs.findLastIndex((b) => !b.vues));
  assert.deepEqual(plan.cadreTables, englobant(plan.blocs.filter((b) => !b.vues)));
  assert.deepEqual(plan.cadreTout, englobant(plan.blocs));
  // place raisonnable : les boîtes des tables couvrent au moins le quart de leur cadre ; une carte plus large que haute, sans excès
  const aire = plan.boites.filter((b) => b.genre !== 'vue').reduce((s, b) => s + b.largeur * b.hauteur, 0);
  const densite = aire / (plan.cadreTables.largeur * plan.cadreTables.hauteur);
  assert.ok(densite > 0.25, `densité ${densite.toFixed(3)}`);
  const rapport = plan.cadreTables.largeur / plan.cadreTables.hauteur;
  assert.ok(rapport > 1 && rapport < 2.2, `proportions ${rapport.toFixed(2)}`);
  assert.deepEqual(mettreEnPage(structure), plan, 'même entrée, même carte');
});

test('mise en page : couches des clés étrangères (une table à droite de celles qu’elle cite dans sa section), textes qui tiennent dans leur boîte', () => {
  const boiteDe = new Map(plan.boites.map((b) => [b.nom, b]));
  let aDroite = 0;
  let internes = 0;
  for (const t of tablesSeules) {
    for (const c of t.cles_etrangeres) {
      const cible = structure.tables.find((x) => x.nom === c.table);
      if (c.table === t.nom || cible.section !== t.section) continue;
      internes++;
      if (boiteDe.get(t.nom).x > boiteDe.get(c.table).x) aDroite++;
    }
  }
  assert.ok(aDroite / internes > 0.85, `liens internes de droite à gauche : ${aDroite}/${internes}`);
  // largeurs à chasse fixe : nom de colonne et type tiennent sans être coupés, l'en-tête aussi
  const G = GEOMETRIE;
  for (const t of structure.tables) {
    const { largeur } = mesurerTable(t);
    assert.ok(largeur <= G.largeurMax && largeur >= G.largeurMin);
    const nom = Math.max(...t.colonnes.map((c) => c.nom.length));
    const type = Math.max(...t.colonnes.map((c) => c.type.length));
    assert.ok(G.xNom + nom * G.carNom + G.ecartType + type * G.carPetit + G.droite <= largeur, `${t.nom} : colonnes`);
    assert.ok(2 * G.padX + t.nom.length * G.carEntete + G.ecartCompte + libelleDesLignes(t.lignes).length * G.carPetit <= largeur, `${t.nom} : en-tête`);
    // les nombres de la base vivante (une table des fiches : 0 au build, des milliers sur le site de dev) tiennent sans couper le nom
    for (const n of [t.lignes, 900, 18_000, COMPTE_RESERVE]) {
      assert.ok(2 * G.padX + t.nom.length * G.carEntete + G.ecartCompte + libelleDesLignes(n).length * G.carPetit <= largeur, `${t.nom} : en-tête avec ${n} lignes`);
    }
  }
  assert.deepEqual(lignesDuNom('sort'), ['sort']);
  assert.deepEqual(lignesDuNom('creature_capacite_resistance'), ['creature_capacite_', 'resistance']);
  assert.deepEqual(lignesDuNom('abcdefghijklmnopqrst'), ['abcdefghijklmnopqrst'], 'sans « _ » : une ligne');
  for (const b of plan.boites) assert.ok(TAILLES_DE_LOIN.includes(tailleDuNomDeLoin(b.nom, b.largeur, b.hauteur)), b.nom);
  assert.equal(tailleDuNomDeLoin('sort', 300, 400), 40, 'la plus grande qui tient');
  assert.equal(tailleDuNomDeLoin('un_nom_vraiment_tres_tres_long_x', 150, 60), 14, 'sinon la plus petite');
  assert.ok(new Set(plan.boites.map((b) => tailleDuNomDeLoin(b.nom, b.largeur, b.hauteur))).size <= TAILLES_DE_LOIN.length, 'peu de tailles de police');
});

test('empiler (ligne d’horizon) : dans l’ordre, au plus haut puis au plus à gauche, sans chevauchement ; un rectangle trop large part à gauche', () => {
  const r = [{ largeur: 50, hauteur: 30 }, { largeur: 40, hauteur: 10 }, { largeur: 40, hauteur: 10 }, { largeur: 200, hauteur: 5 }, { largeur: 30, hauteur: 10 }];
  const p = empiler(r, 100);
  assert.deepEqual(p, [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 10 }, { x: 0, y: 30 }, { x: 0, y: 35 }]);
  const poses = r.map((x, i) => ({ ...p[i], ...x }));
  for (let i = 0; i < poses.length; i++) for (let j = i + 1; j < poses.length; j++) assert.ok(!recouvrent(poses[i], poses[j]), `${i}/${j}`);
});

test('liens : un et un seul par clé étrangère du schéma, du bord de la table source (ligne de la colonne) au bord de la table visée, flèche à l’arrivée', () => {
  const attendus = tablesSeules.flatMap((t) => t.cles_etrangeres.map((c, i) => `${t.nom}#${i}`));
  assert.equal(plan.liens.length, 399);
  assert.deepEqual(plan.liens.map((l) => l.id), attendus);
  assert.equal(new Set(plan.liens.map((l) => l.id)).size, plan.liens.length);
  const boiteDe = new Map(plan.boites.map((b) => [b.nom, b]));
  const tableDe = new Map(structure.tables.map((t) => [t.nom, t]));
  for (const l of plan.liens) {
    const t = tableDe.get(l.de);
    const c = t.cles_etrangeres[Number(l.id.split('#')[1])];
    assert.equal(l.vers, c.table);
    assert.deepEqual(l.colonnes, c.colonnes);
    const a = boiteDe.get(l.de);
    const b = boiteDe.get(l.vers);
    assert.ok(proche(l.depart.x, a.x) || proche(l.depart.x, a.x + a.largeur), `${l.id} : départ sur un bord`);
    assert.equal(l.indice, indiceDuLien(t, c));
    assert.equal(l.colonne, c.colonnes[l.indice]);
    assert.ok(proche(l.depart.y, a.y + milieuDeLaColonne(t, l.colonne)), `${l.id} : départ à la ligne de ${l.colonne}`);
    assert.ok(proche(l.arrivee.y, b.y + milieuDeLaColonne(tableDe.get(l.vers), c.vers[l.indice])), `${l.id} : arrivée à la ligne de ${c.vers[l.indice]}`);
    assert.ok(proche(l.arrivee.x, b.x) || proche(l.arrivee.x, b.x + b.largeur), `${l.id} : arrivée sur un bord`);
    assert.ok(l.arrivee.y > b.y && l.arrivee.y < b.y + b.hauteur, `${l.id} : arrivée dans la hauteur de ${l.vers}`);
    assert.match(l.d, /^M[-\d.]+ [-\d.]+C[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+$/, `${l.id} : une courbe`);
    // la flèche entre dans la table visée : le dernier point de contrôle est du côté d'où vient la courbe
    const n = l.d.match(/[-\d.]+/g).map(Number);
    const [cx] = n.slice(4, 6);
    if (proche(l.arrivee.x, b.x)) assert.ok(cx < b.x || l.soi, `${l.id} : arrive par la gauche`);
    else assert.ok(cx > b.x + b.largeur - 0.1, `${l.id} : arrive par la droite`);
  }
  const soi = plan.liens.filter((l) => l.soi);
  assert.deepEqual(soi.map((l) => l.de), ['note_cellule'], 'l’auto-référence du schéma');
  assert.equal(soi[0].cote, 'boucle');
  // une clé à plusieurs colonnes part de la colonne qui la distingue, et arrive à la colonne visée au même rang
  const ligneDe = (table, y) => (y - boiteDe.get(table).y - GEOMETRIE.entete - GEOMETRIE.ligne / 2) / GEOMETRIE.ligne;
  const colonnesDe = (table) => tableDe.get(table).colonnes.map((c) => c.nom);
  const parcours = (l) => [colonnesDe(l.de)[ligneDe(l.de, l.depart.y)], colonnesDe(l.vers)[ligneDe(l.vers, l.arrivee.y)]];
  assert.deepEqual(parcours(soi[0]), ['repond_a', 'rang'], 'note_cellule : repond_a → rang (pas entite_table → entite_table)');
  const cellule = plan.liens.filter((l) => l.de === 'race_don_tableau_cellule' && l.colonnes.length > 1);
  assert.deepEqual(cellule.map(parcours), [['ligne', 'rang'], ['colonne', 'rang']], 'ses deux clés partent de ligne et de colonne, pas toutes deux de race_id');
  assert.deepEqual(parcours(plan.liens.find((l) => l.de === 'capacite' && l.colonnes.length > 1)), ['specialite_id', 'id']);
  assert.deepEqual(parcours(plan.liens.find((l) => l.de === 'personnage_classe' && l.colonnes.length > 1)), ['specialite_id', 'id']);
  // deux liens d'une même table ne partent jamais de la même ligne vers deux tables différentes sans être deux clés d'une même colonne
  for (const t of tablesSeules) {
    const parLigne = new Map();
    for (const l of plan.liens.filter((x) => x.de === t.nom)) (parLigne.get(l.colonne) ?? parLigne.set(l.colonne, []).get(l.colonne)).push(l);
    for (const [col, liste] of parLigne) {
      if (liste.length > 1) assert.ok(liste.every((l) => l.colonnes.length === 1) || new Set(liste.map((l) => l.colonnes.join())).size === liste.length, `${t.nom}.${col}`);
    }
  }
  assert.deepEqual(indiceDuLien({ nom: 'x', cles_etrangeres: [] }, { colonnes: ['a'], table: 'y', vers: ['b'] }), 0);
  assert.deepEqual(tablesCommunes(structure), [{ nom: 'famille', liens: 152 }]);
  assert.equal(plan.liens.filter((l) => l.commun).length, 152, 'les liens vers famille : allégés');
  // les quatre cas de géométrie
  const t = { nom: 'a', colonnes: [{ nom: 'id' }, { nom: 'b_id' }], cles_etrangeres: [] };
  const u = { nom: 'b', colonnes: [{ nom: 'id' }] };
  const lien = { colonnes: ['b_id'], visees: ['id'] };
  const A = { x: 0, y: 0, largeur: 100, hauteur: 80 };
  const ici = (B) => geometrieDuLien(lien, t, A, u, B).cote;
  assert.equal(ici({ x: 300, y: 0, largeur: 100, hauteur: 50 }), 'droite');
  assert.equal(ici({ x: -300, y: 0, largeur: 100, hauteur: 50 }), 'gauche');
  assert.equal(ici({ x: 20, y: 200, largeur: 100, hauteur: 50 }), 'dessus');
  assert.equal(geometrieDuLien({ ...lien, soi: true }, t, A, t, A).cote, 'boucle');
  assert.equal(geometrieDuLien(lien, t, A, u, { x: 300, y: 0, largeur: 100, hauteur: 50 }).arrivee.y, GEOMETRIE.entete + GEOMETRIE.ligne / 2, 'à la ligne de la colonne visée');
  assert.equal(geometrieDuLien({ colonnes: ['b_id'], visees: ['inconnue'] }, t, A, u, { x: 300, y: 0, largeur: 100, hauteur: 50 }).arrivee.y, GEOMETRIE.entete / 2, 'sinon à l’en-tête');
});

test('niveaux de détail : loin, moyen, près selon le zoom (seuils croissants), et « tout voir » donne une vue de loin', () => {
  assert.deepEqual(NIVEAUX.map((n) => n.cle), ['loin', 'moyen', 'pres']);
  for (let i = 1; i < NIVEAUX.length; i++) assert.ok(NIVEAUX[i].jusqua > NIVEAUX[i - 1].jusqua);
  assert.equal(niveauDeDetail(ZOOM_MIN), 'loin');
  assert.equal(niveauDeDetail(0.3), 'loin');
  assert.equal(niveauDeDetail(0.42), 'loin', 'à 0,42 les en-têtes feraient 5,5 px : on reste de loin (noms en grand)');
  assert.equal(niveauDeDetail(0.6), 'loin');
  assert.equal(niveauDeDetail(0.7), 'moyen');
  assert.equal(niveauDeDetail(0.8), 'moyen');
  assert.equal(niveauDeDetail(0.85), 'pres');
  // dès qu'un niveau montre un texte, il se lit à l'écran : en-têtes et colonnes dès « moyen », types dès « pres » ; jamais moins lisible en zoomant
  const seuilMoyen = NIVEAUX[0].jusqua;
  assert.ok(POLICES.entete * seuilMoyen >= 9, `en-têtes ${POLICES.entete * seuilMoyen} px`);
  assert.ok(POLICES.colonne * seuilMoyen >= LISIBLE_A_L_ECRAN, `colonnes ${POLICES.colonne * seuilMoyen} px`);
  assert.ok(POLICES.petit * NIVEAUX[1].jusqua >= LISIBLE_A_L_ECRAN, 'types');
  const plusPetitDeLoin = Math.min(...plan.boites.map((b) => tailleDuNomDeLoin(b.nom, b.largeur, b.hauteur)));
  assert.ok(POLICES.entete <= plusPetitDeLoin * 1.1, 'passer à « moyen » ne rend pas les noms plus petits qu’à « loin » (au seuil)');
  // une table centrée (recherche, clé suivie) se pose au moins au niveau « moyen », même très haute dans un petit cadre
  for (const [nom, l, h] of [['personnage', 1280, 468], ['personnage', 390, 352], ['sort', 956, 352], ['sort', 1280, 800]]) {
    const b = plan.boites.find((x) => x.nom === nom);
    const v = centrerSur(b, { x: 0, y: 0, k: 0.1 }, l, h);
    assert.notEqual(niveauDeDetail(v.k), 'loin', `${nom} dans ${l}×${h} : k ${v.k.toFixed(3)}`);
    assert.ok(schemaVersEcran(v, { x: b.x, y: b.y }).y >= 16 - 1e-6, 'son en-tête dans le cadre');
  }
  // le titre d'un bloc vu de loin : au moins TITRE_LOIN_ECRAN px à l'écran de « Tout voir » (≈ 0,12) au seuil, sa police tenant au-dessus du bloc
  const ecranDuTitre = (k) => Math.min(Math.max(POLICES.titreLoin, TITRE_LOIN_ECRAN / k), TITRE_LOIN_MAX) * k;
  for (const k of [TITRE_LOIN_ECRAN / TITRE_LOIN_MAX, 0.1193, 0.2, 0.4, 0.69]) assert.ok(ecranDuTitre(k) >= TITRE_LOIN_ECRAN - 1e-9, `k ${k}`);
  assert.ok(TITRE_LOIN_MAX * 1.15 <= 66 + GEOMETRIE.ecartBlocs, 'le plus grand titre tient dans le bandeau et l’écart au-dessus du bloc');
  assert.ok(niveauDeDetail(cadrer(plan.cadreTables, 956, 596).k) === 'loin');
  assert.equal(niveauDeDetail(ZOOM_MAX), 'pres');
  assert.equal(niveauDeDetail(ZOOM_LISIBLE), 'pres', 'une table centrée (recherche, clé étrangère) se lit en entier');
  assert.equal(niveauDeDetail(cadrer(plan.cadreTables, 1280, 800).k), 'loin');
  assert.equal(niveauDeDetail(cadrer(plan.cadreTables, 380, 600).k), 'loin', 'téléphone');
});

test('caméra : écran ↔ schéma inverses au zoom, zoom autour du pointeur, bornes, « tout voir », centrage, interpolation', () => {
  const vue = { x: 37, y: -12, k: 0.37 };
  for (const p of [{ x: 0, y: 0 }, { x: 640, y: 380 }, { x: -50, y: 9000 }]) {
    const s = ecranVersSchema(vue, p);
    const e = schemaVersEcran(vue, s);
    assert.ok(proche(e.x, p.x) && proche(e.y, p.y));
  }
  // zoom autour du pointeur : le point du schéma sous le pointeur ne bouge pas
  const pointeur = { x: 300, y: 200 };
  const sous = ecranVersSchema(vue, pointeur);
  for (const f of [1.25, 0.8, 3, 0.01, 100]) {
    const z = zoomAutour(vue, f, pointeur);
    assert.ok(z.k >= ZOOM_MIN && z.k <= ZOOM_MAX, 'bornes');
    const apres = schemaVersEcran(z, sous);
    assert.ok(proche(apres.x, pointeur.x) && proche(apres.y, pointeur.y), `facteur ${f}`);
  }
  assert.equal(bornerZoom(0), ZOOM_MIN);
  // épaisseur des traits : refaite pendant un geste seulement au-delà de l'écart (un grand zoom : par paliers ; un petit : à la fin du geste)
  assert.equal(traitsARefaire(1, 1.5), false);
  assert.equal(traitsARefaire(1, 1 / 1.5), false);
  assert.equal(traitsARefaire(1, ECART_DES_TRAITS * 1.01), true);
  assert.equal(traitsARefaire(1, 1 / (ECART_DES_TRAITS * 1.01)), true);
  assert.equal(traitsARefaire(1, cadrer(plan.cadreTables, 1280, 800).k), true, 'le premier dessin : les traits du zoom d’ensemble tout de suite');
  assert.equal(bornerZoom(1e9), ZOOM_MAX);
  assert.deepEqual(deplacer(vue, 10, -5), { x: 47, y: -17, k: 0.37 });
  // tout voir : tout le cadre des tables à l'écran, centré, marges respectées
  for (const [l, h] of [[1280, 800], [380, 600], [2400, 900]]) {
    const v = cadrer(plan.cadreTables, l, h, 16);
    const a = schemaVersEcran(v, { x: plan.cadreTables.x, y: plan.cadreTables.y });
    const b = schemaVersEcran(v, { x: plan.cadreTables.x + plan.cadreTables.largeur, y: plan.cadreTables.y + plan.cadreTables.hauteur });
    assert.ok(a.x >= 16 - 1e-6 && a.y >= 16 - 1e-6 && b.x <= l - 16 + 1e-6 && b.y <= h - 16 + 1e-6, `${l}×${h}`);
    assert.ok(proche((a.x + b.x) / 2, l / 2) && proche((a.y + b.y) / 2, h / 2), 'centré');
    assert.ok(proche(b.x - a.x, l - 32) || proche(b.y - a.y, h - 32), 'le plus grand possible');
    const visible = partieVisible(v, l, h);
    assert.ok(visible.x <= plan.cadreTables.x && visible.x + visible.largeur >= plan.cadreTables.x + plan.cadreTables.largeur - 1e-6);
  }
  // centrer une table : lisible, au centre ; une table très haute : son haut en haut du cadre
  const sort = plan.boites.find((b) => b.nom === 'sort');
  const c = centrerSur(sort, { x: 0, y: 0, k: 0.2 }, 1280, 800);
  assert.ok(c.k >= Math.min(ZOOM_LISIBLE, (800 - 32) / sort.hauteur) - 1e-9);
  const centreSort = schemaVersEcran(c, { x: sort.x + sort.largeur / 2, y: sort.y });
  assert.ok(proche(centreSort.x, 640));
  assert.ok(centreSort.y >= 16 - 1e-6, 'son en-tête dans le cadre');
  assert.equal(centrerSur(sort, { x: 0, y: 0, k: 2 }, 1280, 800).k, 2, 'un zoom plus fort est gardé');
  // montrer : rien ne bouge si la table est visible, sinon le plus court déplacement
  const famille = plan.boites.find((b) => b.nom === 'famille');
  const dedans = cadrer(plan.cadreTables, 1280, 800);
  assert.deepEqual(montrer(famille, dedans, 1280, 800), dedans);
  const loin = { x: -100000, y: 0, k: 1 };
  const m = montrer(famille, loin, 1280, 800);
  const coin = schemaVersEcran(m, famille);
  assert.ok(coin.x >= 24 - 1e-6 && coin.x + famille.largeur <= 1280 - 24 + 1e-6);
  // interpolation : les deux bouts, et un zoom qui passe par la moyenne géométrique
  const a = { x: 0, y: 0, k: 0.1 };
  const b = { x: -500, y: -300, k: 1 };
  const debut = interpoler(a, b, 0, 1000, 600);
  assert.ok(proche(debut.x, a.x, 1e-9) && proche(debut.y, a.y, 1e-9) && proche(debut.k, a.k, 1e-12));
  const fin = interpoler(a, b, 1, 1000, 600);
  assert.ok(proche(fin.x, b.x) && proche(fin.y, b.y) && proche(fin.k, b.k));
  assert.ok(proche(interpoler(a, b, 0.5, 1000, 600).k, Math.sqrt(0.1)));
});

test('clavier et recherche : table voisine dans chaque direction ; recherche exacte, par début, par morceau, sans accents', () => {
  const boites = plan.boites.filter((b) => b.genre !== 'vue');
  const centre = (b) => ({ x: b.x + b.largeur / 2, y: b.y + b.hauteur / 2 });
  for (const nom of ['sort', 'famille', 'personnage', 'monstre']) {
    const c0 = centre(boites.find((b) => b.nom === nom));
    for (const [touche, test] of [['ArrowRight', (c) => c.x > c0.x], ['ArrowLeft', (c) => c.x < c0.x], ['ArrowDown', (c) => c.y > c0.y], ['ArrowUp', (c) => c.y < c0.y]]) {
      const voisine = tableVoisine(boites, nom, touche);
      if (voisine) assert.ok(test(centre(boites.find((b) => b.nom === voisine))), `${nom} ${touche} → ${voisine}`);
    }
  }
  // jamais « de travers » (l'écart de côté plus grand que l'avancée), et toutes les tables atteintes au clavier depuis la première
  let deplacements = 0;
  let deTravers = 0;
  const voisins = new Map(boites.map((b) => [b.nom, []]));
  for (const b of boites) {
    for (const touche of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
      const v = tableVoisine(boites, b.nom, touche);
      if (!v) continue;
      deplacements++;
      voisins.get(b.nom).push(v);
      const [a, c] = [centre(b), centre(boites.find((x) => x.nom === v))];
      const horizontal = touche === 'ArrowRight' || touche === 'ArrowLeft';
      if (horizontal ? Math.abs(c.y - a.y) > Math.abs(c.x - a.x) : Math.abs(c.x - a.x) > Math.abs(c.y - a.y)) deTravers++;
    }
  }
  assert.ok(deplacements > 600, `${deplacements} déplacements`);
  assert.ok(deTravers / deplacements <= 0.02, `${deTravers} déplacements de travers sur ${deplacements}`);
  const atteintes = new Set([boites[0].nom]);
  for (const file = [boites[0].nom]; file.length;) for (const v of voisins.get(file.shift())) if (!atteintes.has(v)) { atteintes.add(v); file.push(v); }
  assert.equal(atteintes.size, boites.length, 'toutes les tables au clavier');
  assert.notEqual(tableVoisine(boites, 'mot_cle', 'ArrowRight'), 'type_page', 'Flèche droite ne descend pas');
  assert.notEqual(tableVoisine(boites, 'famille', 'ArrowUp'), 'mot_cle', 'Flèche haut ne part pas à droite');
  assert.notEqual(tableVoisine(boites, 'page', 'ArrowDown'), 'alias');
  const plusHaute = [...boites].sort((a, b) => centre(a).y - centre(b).y)[0];
  assert.equal(tableVoisine(boites, plusHaute.nom, 'ArrowUp'), null, 'rien au-dessus de la plus haute');
  assert.equal(tableVoisine(boites, 'famille', 'Tab'), null);
  const carre = [{ nom: 'o', x: 0, y: 0, largeur: 10, hauteur: 10 }, { nom: 'e', x: 100, y: 0, largeur: 10, hauteur: 10 }, { nom: 'se', x: 60, y: 60, largeur: 10, hauteur: 10 }];
  assert.equal(tableVoisine(carre, 'o', 'ArrowRight'), 'e', 'l’écart de côté compte triple');
  assert.equal(tableVoisine(carre, 'o', 'ArrowDown'), 'se');
  const travers = [{ nom: 'o', x: 0, y: 0, largeur: 10, hauteur: 10 }, { nom: 'd', x: 20, y: 200, largeur: 10, hauteur: 10 }];
  assert.equal(tableVoisine(travers, 'o', 'ArrowRight'), null, 'hors du cône et sans chevauchement : on reste sur place');
  const haute = [{ nom: 'o', x: 0, y: 0, largeur: 10, hauteur: 10 }, { nom: 'h', x: 30, y: -10, largeur: 10, hauteur: 400 }];
  assert.equal(tableVoisine(haute, 'o', 'ArrowRight'), 'h', 'une voisine très haute, en face : atteinte');
  const noms = structure.tables.map((t) => t.nom);
  assert.equal(chercherTable(noms, 'sort'), 'sort', 'nom exact');
  assert.equal(chercherTable(noms, 'SORT'), 'sort');
  assert.equal(chercherTable(noms, 'monstre_esp'), 'monstre_espece', 'début, le plus court');
  assert.equal(chercherTable(noms, 'capacite commune'), 'monstre_capacite_commune', 'espace = « _ » ; morceau du nom, le plus court');
  assert.equal(chercherTable(noms, 'commune invocation'), 'invocation_capacite_commune', 'chacun des mots, dans n’importe quel ordre');
  assert.equal(chercherTable(noms, 'événement'), 'evenement', 'sans accents');
  assert.equal(chercherTable(noms, 'zzz'), null);
  assert.equal(chercherTable(noms, '   '), null);
});

test('rendu : une boîte HTML focalisable et étiquetée par table, une ligne par colonne, un chemin SVG par lien ; tout échappé ; jamais d’infobulle native', () => {
  const html = htmlDuSchema(structure, plan);
  assert.equal((html.match(/<div class="schema-table /g) ?? []).length, structure.tables.length);
  assert.equal((html.match(/ data-lien="/g) ?? []).length, 399);
  assert.equal((html.match(/<div class="schema-col[ "]/g) ?? []).length, structure.tables.reduce((n, t) => n + t.colonnes.length, 0));
  assert.equal((html.match(/ tabindex="-1" role="button" aria-haspopup="dialog"/g) ?? []).length, structure.tables.length);
  assert.ok(html.includes('aria-label="table sort, '), 'étiquette');
  assert.ok(html.includes('aria-label="table dérivée lien, '));
  assert.ok(html.includes('<div class="schema-table schema-table--vue" data-table="'), 'les vues, masquées par la CSS');
  assert.ok(html.indexOf('class="schema-blocs"') < html.indexOf('class="schema-liens"') && html.indexOf('class="schema-liens"') < html.indexOf('class="schema-boites"'), 'les liens sous les boîtes');
  assert.match(html, /<svg class="schema-liens" data-schema-liens="" xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+" aria-hidden="true"/);
  assert.match(html, /<marker id="schema-fleche" [^>]*markerUnits="strokeWidth" orient="auto">/, 'une flèche à l’arrivée de chaque lien');
  assert.doesNotMatch(html, /\stitle=|<title/, 'jamais d’infobulle native');
  assert.equal((html.match(/<div\b/g) ?? []).length, (html.match(/<\/div>/g) ?? []).length, 'éléments fermés');
  assert.match(html, /<div class="schema-col schema-col--fk" data-colonne="magie_id" data-vers="magie" data-infobulle="magie_id : TEXT, non nul\n→ magie\.id\n\(clic sur la pastille : aller à la table visée\)/);
  // une colonne qui sert deux clés : les deux tables visées, chaque clé écrite en entier
  const caseDe = (table, colonne) => new RegExp(`data-table="${table}"[\\s\\S]*?(<div class="schema-col[^"]*" data-colonne="${colonne}"[^>]*>)`).exec(html)[1];
  const raceId = caseDe('race_don_tableau_cellule', 'race_id');
  assert.match(raceId, /data-vers="race_don_tableau_ligne race_don_tableau_colonne"/);
  assert.match(raceId, /\(race_id, ligne\) → race_don_tableau_ligne\(race_id, rang\)\n\(race_id, colonne\) → race_don_tableau_colonne\(race_id, rang\)\n\(clic sur la pastille : choisir la table visée\)/);
  assert.match(caseDe('capacite', 'classe_id'), /→ classe\.id\n\(specialite_id, classe_id\) → specialite\(id, classe_id\)/);
  const entite = caseDe('note_cellule', 'entite_table');
  assert.match(entite, /\(entite_table, entite_id, repond_a\) → note_cellule\(entite_table, entite_id, rang\) \(auto-référence\)/);
  assert.doesNotMatch(entite, /→ note_cellule\.entite_table/, 'une colonne qui semblerait se viser elle-même');
  // de loin, le titre court du bloc ; son titre entier en infobulle
  assert.match(html, /<span class="schema-section__titre-loin" aria-hidden="true" data-infobulle="15\. NOTES DE VERSION : ce que chaque version[^"]*site de dev">15\. NOTES DE VERSION<\/span>/);
  assert.equal(titreCourt('MAGIES ET SORTS (famille « magies »)'), 'MAGIES ET SORTS');
  assert.equal(titreCourt('DIEUX'), 'DIEUX');
  assert.match(html, /<span class="schema-col__type">TEXT<\/span><span class="schema-col__nn">NN<\/span><span class="schema-col__fk" aria-hidden="true"><\/span><\/div>/);
  assert.match(html, /data-table="sort" style="left:[\d.]+px;top:[\d.]+px;width:\d+px;height:\d+px"/, 'position et taille de la mise en page');
  assert.equal(plan.cadreTout.x, 0, 'le monde commence en (0, 0) : le SVG des liens le couvre');
  assert.equal(plan.cadreTout.y, 0);
  // échappement : un nom, un type, une description piégés
  const piege = {
    sections: [{ numero: '1', titre: 'A & <b>' }],
    tables: [
      { nom: 'a"<x>', section: '1', description: '<img src=x onerror=alert(1)>', genre: 'table', lignes: 3, cles_etrangeres: [{ colonnes: ["c'"], table: 'a"<x>', vers: ['id'] }],
        colonnes: [{ nom: 'id', type: 'TEXT', pk: 1, nonNul: true, defaut: null, description: '', fk: null }, { nom: "c'", type: '<T>', pk: 0, nonNul: false, defaut: "'x'", description: '"d"', fk: { table: 'a"<x>', colonne: 'id' } }] },
    ],
  };
  const sortie = htmlDuSchema(piege, mettreEnPage(piege));
  assert.doesNotMatch(sortie, /<img|<x>|<b>|<T>|"d"|c'/);
  assert.match(sortie, /data-table="a&quot;&lt;x&gt;"/);
  assert.match(sortie, /&lt;T&gt;/);
  assert.equal(echapper(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('textes : nombres, lignes, étiquettes, infobulles (section et description ; colonne : type, clé, non nul, défaut, cible), résumé du cadre', () => {
  const fine = String.fromCharCode(0x202f);
  assert.equal(nombre(1234567), `1${fine}234${fine}567`);
  // seule la partie entière est groupée : la valeur de la base, jamais faussée (portrait_x = 0.4375 s'affichait « 0.4 375 »)
  assert.equal(nombre(0.4375), '0.4375');
  assert.equal(nombre(0.5123), '0.5123');
  assert.equal(nombre(1234.5678), `1${fine}234.5678`);
  assert.equal(nombre(1.0001), '1.0001');
  assert.equal(nombre(0.1 + 0.2), '0.30000000000000004');
  assert.equal(nombre(-1234.5), `-1${fine}234.5`);
  assert.equal(nombre(1.5e-7), '1.5e-7');
  assert.equal(nombre(1e21), '1e+21');
  assert.equal(nombre(1234567890120000), `1${fine}234${fine}567${fine}890${fine}120${fine}000`);
  assert.equal(nombre(NaN), 'NaN');
  assert.equal(libelleDesLignes(0), '0 ligne');
  assert.equal(libelleDesLignes(1), '1 ligne');
  assert.equal(libelleDesLignes(2), '2 lignes');
  const sort = structure.tables.find((t) => t.nom === 'sort');
  assert.match(etiquetteDeTable(sort), /^table sort, \d+ colonnes, \d[\d ]* lignes$/);
  assert.match(etiquetteDeTable(structure.tables.find((t) => t.genre === 'vue')), /^vue \w+, \d+ colonnes?, /);
  // le nom d'abord : l'en-tête peut le couper quand le nombre de lignes s'allonge
  assert.match(infobulleDeTable(structure, sort), /^sort\nSection 3\. MAGIES ET SORTS \(famille « magies »\)\nSORT : une ligne par sort/);
  assert.match(infobulleDeTable(structure, structure.tables.find((t) => t.nom === 'lien')), /^lien \(table dérivée\)\nSection 11\. /);
  assert.equal(infobulleDeColonne({ nom: 'x', type: '', pk: 2, nonNul: true, defaut: "'a'", description: 'Le x.', fk: { table: 't', colonne: 'id' } }),
    "x : sans type déclaré, clé primaire (2e colonne), non nul, défaut 'a'\n→ t.id\n(clic sur la pastille : aller à la table visée)\nLe x.");
  assert.equal(libelleDeCle({ table: 'magie', colonnes: ['magie_id'], vers: ['id'] }, { depuis: 'magie_id' }), 'magie_id → magie.id');
  assert.equal(libelleDeCle({ table: 'note_cellule', colonnes: ['a', 'b'], vers: ['a', 'c'] }, { table: 'note_cellule' }), '(a, b) → note_cellule(a, c) (auto-référence)');
  // la liste des clés à suivre (L au clavier, pastille d'une colonne qui vise plusieurs tables)
  const cellule = structure.tables.find((t) => t.nom === 'race_don_tableau_cellule');
  assert.deepEqual(clesASuivre(cellule).map((c) => [c.table, c.libelle]), [
    ['famille', 'origine → famille.id'],
    ['race_don_tableau_ligne', '(race_id, ligne) → race_don_tableau_ligne(race_id, rang)'],
    ['race_don_tableau_colonne', '(race_id, colonne) → race_don_tableau_colonne(race_id, rang)'],
  ]);
  assert.deepEqual(clesASuivre(cellule, 'race_id').map((c) => c.table), ['race_don_tableau_ligne', 'race_don_tableau_colonne']);
  assert.equal(htmlDesCles([{ table: 'a"<', libelle: 'x <b>' }]),
    '<li role="none"><button type="button" role="menuitem" tabindex="-1" class="schema-cles__cle" data-cle-vers="a&quot;&lt;">x &lt;b&gt;</button></li>');
  assert.equal(resumeDuSchema(structure), '188 tables, 35 vues, 399 clés étrangères');
});

test('fenêtre du contenu : adresse (nom encodé, pages de 100, tri), en-têtes triables, valeurs telles que le service les rend, messages d’erreur', () => {
  assert.equal(PAGE_DE_LIGNES, 100);
  assert.equal(adresseDuContenu('/api/', 'sort'), '/api/debug/tables/sort/?limite=100&decalage=0');
  assert.equal(adresseDuContenu('/MaverickCenter/api/', 'a b/c', { decalage: 200, tri: 'nom', ordre: 'desc' }), '/MaverickCenter/api/debug/tables/a%20b%2Fc/?limite=100&decalage=200&tri=nom&ordre=desc');
  assert.equal(adresseDuContenu('/api/', 'x', { tri: 'n', ordre: 'n’importe' }), '/api/debug/tables/x/?limite=100&decalage=0&tri=n&ordre=asc');
  assert.deepEqual(triSuivant({ tri: null, ordre: 'asc' }, 'nom'), { tri: 'nom', ordre: 'asc' });
  assert.deepEqual(triSuivant({ tri: 'nom', ordre: 'asc' }, 'nom'), { tri: 'nom', ordre: 'desc' });
  assert.deepEqual(triSuivant({ tri: 'nom', ordre: 'desc' }, 'nom'), { tri: 'nom', ordre: 'asc' });
  assert.deepEqual(triSuivant({ tri: 'nom', ordre: 'desc' }, 'id'), { tri: 'id', ordre: 'asc' });
  const colonnes = [{ nom: 'id', type: 'TEXT', pk: 1 }, { nom: 'n<', type: '', pk: 0 }];
  const entetes = htmlDesEntetes(colonnes, { tri: 'n<', ordre: 'desc' });
  assert.match(entetes, /^<tr><th scope="col" aria-sort="none"><button type="button" class="schema-tri" data-tri-colonne="id"><span class="schema-tri__nom"><span class="schema-tri__pk">PK<\/span> id<\/span><span class="schema-tri__type">TEXT<\/span><\/button><\/th>/);
  assert.match(entetes, /aria-sort="descending"><button type="button" class="schema-tri" data-tri-colonne="n&lt;"><span class="schema-tri__nom">n&lt;<\/span><span class="schema-tri__type">— ▼<\/span>/);
  assert.deepEqual(valeurEnHtml(null), { classe: 'schema-v--nul', html: 'NULL' });
  assert.deepEqual(valeurEnHtml(12345), { classe: 'schema-v--nombre', html: `12${String.fromCharCode(0x202f)}345` });
  assert.deepEqual(valeurEnHtml(1.5), { classe: 'schema-v--nombre', html: '1.5' });
  assert.equal(valeurEnHtml(0.4375).html, '0.4375', 'un réel tel qu’en base (portrait_x recadré)');
  assert.equal(valeurEnHtml(1234.5678).html, `1${String.fromCharCode(0x202f)}234.5678`);
  assert.equal(valeurEnHtml(2.5e-8).html, '2.5e-8');
  assert.equal(valeurEnHtml({ image: true, type: 'image/webp', octets: 2048, empreinte: 'abcdef0123456789' }).html, 'image/webp (2 048 octets, abcdef012345)', 'une image : son type, sa taille, le début de son empreinte');
  assert.equal(valeurEnHtml({ image: true, octets: 3 }).html, 'image (3 octets)');
  assert.deepEqual(valeurEnHtml({ octets: 16 }), { classe: 'schema-v--resume', html: 'BLOB (16 octets)' });
  assert.equal(valeurEnHtml('<b>x</b>').html, '&lt;b&gt;x&lt;/b&gt;');
  assert.equal(valeurEnHtml('').html, '<span class="schema-v__suite">(texte vide)</span>');
  assert.equal(valeurEnHtml(`${'a'.repeat(5)} … (2500 caractères)`).html, `aaaaa<span class="schema-v__suite"> … (2${String.fromCharCode(0x202f)}500 caractères)</span>`);
  const html = htmlDesLignes(colonnes, [{ id: 'a&b', 'n<': null }, { id: 'c' }]);
  assert.equal(html, '<tr><td class="schema-v--texte"><div class="schema-cellule">a&amp;b</div></td><td class="schema-v--nul"><div class="schema-cellule">NULL</div></td></tr>'
    + '<tr><td class="schema-v--texte"><div class="schema-cellule">c</div></td><td class="schema-v--nul"><div class="schema-cellule">NULL</div></td></tr>');
  // nombres de lignes de la base vivante (GET <base>api/debug/tables/, serveur/debug-tables.mjs#listerTables) : seuls ceux qui changent, des tables connues
  const mini = { tables: [{ nom: 'a', lignes: 2 }, { nom: 'b', lignes: 0 }] };
  assert.deepEqual(comptesVivants(mini, { tables: [{ nom: 'a', genre: 'table', lignes: 5 }, { nom: 'b', lignes: 0 }, { nom: 'inconnue', lignes: 1 }, { nom: 'b', lignes: '3' }, null] }), [{ nom: 'a', lignes: 5 }]);
  assert.deepEqual(comptesVivants(mini, null), []);
  assert.deepEqual(comptesVivants(mini, { erreur: 'x' }), []);
  assert.equal(resumeDuContenu(0, 0), 'Aucune ligne.');
  assert.equal(resumeDuContenu(3, 3), '3 lignes.');
  assert.equal(resumeDuContenu(100, 1234), `100 lignes affichées sur 1${String.fromCharCode(0x202f)}234.`);
  assert.match(messageDErreur(0), /^Le service ne répond pas : /);
  assert.match(messageDErreur(502), /^Le service ne répond pas \(502\) : /, 'un relais sans service derrière');
  assert.match(messageDErreur(503), /^Le service ne répond pas \(503\) : /);
  assert.equal(messageDErreur(503, { erreur: 'La base n’est pas disponible pour le moment.' }), 'Le service est indisponible pour le moment (503) : La base n’est pas disponible pour le moment.', 'le 503 du service lui-même (api.mjs#baseOuRefus)');
  assert.equal(messageDErreur(403, { erreur: 'Réservé au site de dev.' }), 'Le service refuse (403) : Réservé au site de dev.', 'le message du service');
  assert.equal(messageDErreur(403), 'Le service refuse (403) : le contenu des tables ne se lit que sur le site de dev.');
  assert.match(messageDErreur(404), /^Table introuvable dans la base vivante du service \(404\)\.$/);
  assert.equal(messageDErreur(400, { erreur: 'tri : « x » n’est pas une colonne de sort.' }), 'Le service a répondu 400 : tri : « x » n’est pas une colonne de sort.');
  assert.match(messageDErreur(500, { erreur: 42 }), /^Le service a répondu 500\.$/);
});

test('suivi en direct : relève de la version (2 s, 10 s en panne, arrêt au 403), pages à redemander (alignées), assemblage des réponses (304, 200, erreurs)', () => {
  assert.equal(RELEVE_DE_LA_BASE_MS, 2000);
  assert.equal(RELEVE_EN_PANNE_MS, 10_000);
  assert.equal(MISE_EN_EVIDENCE_MS, 2000);
  assert.equal(adresseDeLaVersion('/api/'), '/api/debug/base/');
  assert.equal(adresseDeLaVersion('/MaverickCenter/api/'), '/MaverickCenter/api/debug/base/');
  // la relève : une version (texte non vide) → 2 s ; 403 → arrêt définitif ; réseau, 5xx ou toute autre réponse → 10 s
  assert.deepEqual(suiteDeLaReleve(200, { version: 'a.1.2' }), { action: 'version', version: 'a.1.2', delai: RELEVE_DE_LA_BASE_MS });
  assert.deepEqual(suiteDeLaReleve(403, { erreur: 'Réservé au site de dev.' }), { action: 'arret', statut: 403 });
  for (const [statut, corps] of [[0, null], [502, null], [503, { erreur: 'La base n’est pas disponible.' }], [500, {}], [404, { erreur: 'x' }], [200, null], [200, { version: '' }], [200, { version: 3 }]]) {
    assert.deepEqual(suiteDeLaReleve(statut, corps), { action: 'panne', statut, delai: RELEVE_EN_PANNE_MS }, `${statut} ${JSON.stringify(corps)}`);
  }
  assert.equal(suiteDeLaReleve(undefined, null).statut, 0, 'pas de réponse : statut 0');
  // les pages déjà chargées : 0, 100, … jusqu'à la dernière qui contient une ligne affichée ; la première même sans ligne (son total, ses colonnes)
  assert.deepEqual(pagesARedemander(0), [0]);
  assert.deepEqual(pagesARedemander(1), [0]);
  assert.deepEqual(pagesARedemander(100), [0]);
  assert.deepEqual(pagesARedemander(101), [0, 100]);
  assert.deepEqual(pagesARedemander(250), [0, 100, 200]);
  assert.deepEqual(pagesARedemander(300), [0, 100, 200]);
  assert.deepEqual(pagesARedemander(5, 2), [0, 2, 4]);
  // « Charger plus » demande toujours une page alignée (celle qui contient la ligne suivante) : son ETag vaut pour le rafraîchissement
  assert.deepEqual([0, 99, 100, 250, 300].map((n) => debutDePage(n)), [0, 0, 100, 200, 300]);
  assert.equal(debutDePage(-3), 0);
  assert.equal(cleDeLigne({ id: 'a', n: 1, x: null }), '{"id":"a","n":1,"x":null}', 'l’identité d’une ligne : son JSON');
  // une page relue par « Charger plus » vaut pour ce qui est affiché seulement si elle redonne les lignes déjà là (sinon : rafraîchir d'abord)
  const dejaLa = ['a', 'b', 'c'].map((id) => cleDeLigne({ id }));
  assert.equal(pageAccordee(dejaLa, 3, [{ id: 'd' }]), true, 'page qui commence après l’affichage : rien à comparer');
  assert.equal(pageAccordee([], 0, []), true, 'table vide');
  assert.equal(pageAccordee(dejaLa, 2, [{ id: 'c' }, { id: 'd' }]), true, 'la ligne déjà affichée, telle quelle');
  assert.equal(pageAccordee(dejaLa, 2, [{ id: 'C' }, { id: 'd' }]), false, 'une ligne déjà affichée a changé');
  assert.equal(pageAccordee(dejaLa, 2, [{ id: 'x' }, { id: 'c' }]), false, 'une ligne insérée avant la fin de l’affichage');
  assert.equal(pageAccordee(dejaLa, 2, []), false, 'une ligne retirée : la page ne la contient plus');
  assert.equal(pageAccordee(dejaLa, 2, null), false);

  // assemblage, pages de 2 pour l'essai : lignes { id, v }, colonnes id et v
  const colonnes = [{ nom: 'id', type: 'TEXT', pk: 1 }, { nom: 'v', type: 'INTEGER', pk: 0 }];
  const L = (id, v = 0) => ({ id, v });
  const K = (...ids) => ids.map((id) => cleDeLigne(L(id)));
  const page = (decalage, lignes, total, etag = `"e${decalage}-${total}"`) => ({ decalage, statut: 200, corps: { colonnes, lignes, total }, etag });
  const inchangee = (decalage) => ({ decalage, statut: 304, corps: null, etag: '"x"' });
  const avant = { cles: K('a', 'b', 'c'), total: 5, colonnes };
  assert.deepEqual(assemblerLesPages(avant, [inchangee(0), inchangee(2)], 2), { inchange: true }, 'tout en 304 : rien n’a changé (total et colonnes compris : ils sont dans le corps)');
  // une ligne changée dans la seconde page : les lignes de la première, inchangées (null : reprises du tableau)
  const change = assemblerLesPages(avant, [inchangee(0), page(2, [L('c', 9), L('d')], 5)], 2);
  assert.deepEqual(change, { cles: [...K('a', 'b'), cleDeLigne(L('c', 9))], lignes: [null, null, L('c', 9)], total: 5, colonnes, etags: { 2: '"e2-5"' } },
    'les premières min(affichées, total) lignes : 3, pas la 4e de la page');
  // insertion en tête : toujours 3 lignes affichées, la dernière repoussée hors du tableau
  assert.deepEqual(assemblerLesPages(avant, [page(0, [L('z'), L('a')], 6), page(2, [L('b'), L('c')], 6)], 2).cles, K('z', 'a', 'b'));
  // suppression : moins de lignes que le tableau n'en montrait
  const moins = assemblerLesPages({ cles: K('a', 'b', 'c'), total: 3, colonnes }, [page(0, [L('a'), L('c')], 2), page(2, [], 2)], 2);
  assert.deepEqual([moins.cles, moins.total], [K('a', 'c'), 2]);
  // table vide à l'affichage : rien de plus n'est montré (« Charger plus » annonce les autres)
  assert.deepEqual(assemblerLesPages({ cles: [], total: 0, colonnes }, [page(0, [L('a')], 1)], 2), { cles: [], lignes: [], total: 1, colonnes, etags: {} });
  // une page plus courte que prévu (la table a changé entre deux réponses) arrête la liste : jamais de trou ; le plus petit total reçu
  const court = assemblerLesPages({ cles: K('a', 'b', 'c', 'd', 'e'), total: 5, colonnes }, [page(0, [L('a')], 5), page(2, [L('c'), L('d')], 4), inchangee(4)], 2);
  assert.deepEqual([court.cles, court.total], [K('a'), 4]);
  // des colonnes reçues (une colonne ajoutée) : celles de la première page reçue
  const autres = [...colonnes, { nom: 'w', type: '', pk: 0 }];
  assert.deepEqual(assemblerLesPages({ cles: K('a'), total: 1, colonnes }, [{ ...page(0, [{ id: 'a', v: 0, w: null }], 1), corps: { colonnes: autres, lignes: [{ id: 'a', v: 0, w: null }], total: 1 } }], 2).colonnes, autres);
  // erreurs : 404 (table disparue) avant 400 (colonne de tri disparue) avant une panne (réseau, 5xx) avant le reste ; un corps illisible = 'autre'
  const echec = (decalage, statut, corps = null) => ({ decalage, statut, corps, etag: null });
  assert.deepEqual(assemblerLesPages(avant, [echec(0, 0), echec(2, 404, { erreur: 'Table inconnue.' })], 2), { erreur: { genre: 'introuvable', statut: 404, corps: { erreur: 'Table inconnue.' } } });
  assert.equal(assemblerLesPages(avant, [echec(0, 503), echec(2, 400)], 2).erreur.genre, 'tri');
  assert.equal(assemblerLesPages(avant, [inchangee(0), echec(2, 0)], 2).erreur.genre, 'panne');
  assert.equal(assemblerLesPages(avant, [echec(0, 502), inchangee(2)], 2).erreur.genre, 'panne');
  assert.equal(assemblerLesPages(avant, [echec(0, 418), inchangee(2)], 2).erreur.genre, 'autre');
  assert.deepEqual(assemblerLesPages(avant, [echec(0, 200, { pas: 'de lignes' }), inchangee(2)], 2).erreur, { genre: 'autre', statut: 200, corps: { pas: 'de lignes' } });
});

test('suivi en direct : lignes à refaire par leur JSON (multiensemble), le moins de déplacements possible ; rejoué au hasard', () => {
  assert.deepEqual(planDeMiseAJour(['a', 'b', 'c'], ['a', 'b', 'c']), { source: [0, 1, 2], nouvelles: [], retirees: [], immobiles: new Set([0, 1, 2]) }, 'rien de changé : rien ne bouge');
  assert.deepEqual(planDeMiseAJour(['a', 'b', 'c'], ['a', 'B', 'c']), { source: [0, -1, 2], nouvelles: [1], retirees: [1], immobiles: new Set([0, 2]) }, 'une ligne modifiée : refaite seule');
  assert.deepEqual(planDeMiseAJour(['a', 'b', 'c'], ['a', 'x', 'b']), { source: [0, -1, 1], nouvelles: [1], retirees: [2], immobiles: new Set([0, 2]) }, 'insertion : la dernière sort, les autres restent');
  assert.deepEqual(planDeMiseAJour(['a', 'b', 'c', 'd'], ['a', 'c', 'd', 'e']), { source: [0, 2, 3, -1], nouvelles: [3], retirees: [1], immobiles: new Set([0, 1, 2]) }, 'suppression : une ligne entre en bas');
  // deux lignes identiques comptent deux fois (une table sans clé primaire)
  assert.deepEqual(planDeMiseAJour(['a', 'a', 'b'], ['a', 'b']).retirees, [1]);
  assert.deepEqual(planDeMiseAJour(['a', 'b'], ['a', 'a', 'b']), { source: [0, -1, 1], nouvelles: [1], retirees: [], immobiles: new Set([0, 2]) });
  assert.deepEqual(planDeMiseAJour([], ['x', 'y']).nouvelles, [0, 1]);
  assert.deepEqual(planDeMiseAJour(['x', 'y'], []).retirees, [0, 1]);
  // une ligne déplacée (sa valeur de tri a changé) : elle seule bouge
  const deplacee = planDeMiseAJour(['a', 'b', 'c', 'd', 'e'], ['a', 'c', 'd', 'e', 'b']);
  assert.deepEqual([deplacee.nouvelles, deplacee.retirees, [...deplacee.immobiles].sort()], [[], [], [0, 1, 2, 3]]);
  assert.equal(planDeMiseAJour(['a', 'b', 'c'], ['c', 'b', 'a']).immobiles.size, 1, 'à l’envers : une seule reste');
  // au hasard : le plan redonne exactement les lignes voulues, les immobiles gardent leur ordre et sont aussi nombreux que possible
  let graine = 7;
  const hasard = (n) => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
  const plusLongue = (suite) => {
    const meilleure = suite.map(() => 1);
    for (let i = 0; i < suite.length; i++) for (let k = 0; k < i; k++) if (suite[k] < suite[i]) meilleure[i] = Math.max(meilleure[i], meilleure[k] + 1);
    return Math.max(0, ...meilleure);
  };
  for (let essai = 0; essai < 400; essai++) {
    const avant = Array.from({ length: hasard(12) }, () => 'abcdef'[hasard(6)]);
    const apres = Array.from({ length: hasard(12) }, () => 'abcdefg'[hasard(7)]);
    const plan = planDeMiseAJour(avant, apres);
    assert.deepEqual(plan.source.map((s, j) => (s >= 0 ? avant[s] : apres[j])), apres);
    for (const [j, s] of plan.source.entries()) if (s >= 0) assert.equal(avant[s], apres[j]);
    assert.deepEqual(plan.nouvelles, plan.source.flatMap((s, j) => (s < 0 ? [j] : [])));
    const reprises = plan.source.filter((s) => s >= 0);
    assert.equal(new Set(reprises).size, reprises.length, 'une ligne affichée reprise une fois au plus');
    assert.deepEqual([...reprises, ...plan.retirees].sort((x, y) => x - y), avant.map((_, i) => i), 'chaque ligne affichée : reprise ou retirée');
    // autant de reprises que le multiensemble le permet
    const compte = (liste) => liste.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map());
    const [ca, cb] = [compte(avant), compte(apres)];
    assert.equal(reprises.length, [...cb].reduce((n, [c, k]) => n + Math.min(k, ca.get(c) ?? 0), 0));
    const immobiles = [...plan.immobiles].sort((x, y) => x - y);
    for (let i = 1; i < immobiles.length; i++) assert.ok(plan.source[immobiles[i - 1]] < plan.source[immobiles[i]], 'les immobiles dans l’ordre du tableau');
    assert.ok(immobiles.every((j) => plan.source[j] >= 0));
    assert.equal(immobiles.length, plusLongue(reprises), 'le plus d’immobiles possible');
  }
});

test('suivi en direct : la ligne d’état « Suivi en direct — … », le résumé d’un changement, son annonce, l’heure', () => {
  assert.equal(heureCourte(new Date(2026, 9, 15, 9, 5, 7)), '09:05:07');
  assert.equal(heureCourte(new Date(2026, 9, 15, 23, 59, 0).getTime()), '23:59:00');
  assert.equal(libelleDuSuivi(), 'Suivi en direct — en attente du service…');
  assert.equal(libelleDuSuivi({ genre: 'attente' }), 'Suivi en direct — en attente du service…');
  assert.equal(libelleDuSuivi({ genre: 'a-jour' }), 'Suivi en direct — à jour');
  assert.equal(libelleDuSuivi({ genre: 'a-jour', heure: '14:03:22' }), 'Suivi en direct — à jour (lu à 14:03:22)');
  assert.equal(libelleDuSuivi({ genre: 'mis-a-jour', heure: '14:03:22', resume: '2 lignes changées' }), 'Suivi en direct — mis à jour à 14:03:22 : 2 lignes changées');
  assert.equal(libelleDuSuivi({ genre: 'interrompu', statut: 0, delai: RELEVE_EN_PANNE_MS }), 'Suivi en direct — interrompu : service injoignable, nouvel essai dans 10 s');
  assert.equal(libelleDuSuivi({ genre: 'interrompu', statut: 503 }), 'Suivi en direct — interrompu : service injoignable, nouvel essai…');
  assert.equal(libelleDuSuivi({ genre: 'interrompu', statut: 404 }), 'Suivi en direct — interrompu : le service a répondu 404, nouvel essai…');
  assert.equal(libelleDuSuivi({ genre: 'interrompu', raison: 'table introuvable (404)' }), 'Suivi en direct — interrompu : table introuvable (404), nouvel essai…');
  assert.equal(libelleDuSuivi({ genre: 'arrete' }), 'Suivi en direct — arrêté : le service refuse (403)');
  // un changement en une ligne : une ligne modifiée compte une fois (nouvelle ET retirée) ; une ligne retirée sans remplaçante ; le total ; les colonnes
  assert.equal(resumeDesChangements({ nouvelles: 1, retirees: 1, totalAvant: 5, totalApres: 5 }), '1 ligne changée');
  assert.equal(resumeDesChangements({ nouvelles: 2, retirees: 2, totalAvant: 1234, totalApres: 1235 }), `2 lignes changées, 1${String.fromCharCode(0x202f)}235 lignes en tout (+1)`);
  assert.equal(resumeDesChangements({ nouvelles: 0, retirees: 1, totalAvant: 3, totalApres: 2 }), '1 ligne retirée, 2 lignes en tout (−1)');
  assert.equal(resumeDesChangements({ nouvelles: 1, retirees: 3, totalAvant: 9, totalApres: 7 }), '1 ligne changée, 2 retirées, 7 lignes en tout (−2)');
  assert.equal(resumeDesChangements({ nouvelles: 0, retirees: 0, totalAvant: 322, totalApres: 323 }), '323 lignes en tout (+1)', 'une ligne hors de ce qui est affiché');
  assert.equal(resumeDesChangements({ nouvelles: 3, retirees: 3, totalAvant: 3, totalApres: 3, colonnesChangees: true }), 'colonnes changées, 3 lignes changées');
  assert.equal(resumeDesChangements({ nouvelles: 0, retirees: 0, totalAvant: 3, totalApres: 3 }), '', 'rien de changé : rien à dire');
  assert.equal(resumeDesChangements(), '');
  assert.equal(annonceDuChangement('personnage', '1 ligne changée'), 'Contenu de personnage mis à jour : 1 ligne changée.');
  assert.equal(annonceDuChangement('personnage', ''), '', 'une relève sans changement n’annonce rien');
  // une lecture en échec : la ligne d'état dit pourquoi (jamais « en attente du service » quand il a répondu), nouvel essai à la version suivante
  assert.equal(libelleDuSuivi(etatDeLEchec(404)), 'Suivi en direct — interrompu : table introuvable (404), nouvel essai…');
  assert.equal(libelleDuSuivi(etatDeLEchec(0)), 'Suivi en direct — interrompu : service injoignable, nouvel essai…');
  assert.equal(libelleDuSuivi(etatDeLEchec(502)), 'Suivi en direct — interrompu : service injoignable, nouvel essai…');
  assert.equal(libelleDuSuivi(etatDeLEchec(403)), 'Suivi en direct — interrompu : le service refuse (403), nouvel essai…');
  assert.equal(libelleDuSuivi(etatDeLEchec(400)), 'Suivi en direct — interrompu : le service a répondu 400, nouvel essai…');
  assert.equal(libelleDuSuivi(etatDeLEchec(200)), 'Suivi en direct — interrompu : réponse illisible du service, nouvel essai…', 'un corps illisible');
  assert.deepEqual(etatDeLEchec(undefined), { genre: 'interrompu', statut: 0 });
  // une colonne de tri disparue : dite avec le résumé du rechargement (une seule annonce) et visible dans la ligne d'état
  const note = noteDuTriPerdu('v');
  assert.equal(`${note.annonce} ${resumeDuContenu(100, 300)}`, `La colonne de tri « v » n’existe plus : le tableau revient à l’ordre par défaut. 100 lignes affichées sur 300.`);
  assert.equal(libelleDuSuivi({ genre: 'mis-a-jour', heure: '22:49:35', resume: note.resume }),
    'Suivi en direct — mis à jour à 22:49:35 : colonne de tri « v » disparue, retour à l’ordre par défaut');
  assert.match(noteDuTriPerdu('a<b').annonce, /« a<b »/, 'du texte (textContent), jamais du HTML');
});

test('le script : n’importe que lib/debug-schema.mjs (sans dépendance), qu’aucun autre script de page n’importe ; aucun module commun avec debug.mjs', () => {
  const imports = (url) => [...readFileSync(url, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  const scripts = new URL('../src/scripts/', import.meta.url);
  assert.deepEqual(imports(new URL('debug-schema.mjs', scripts)), ['../lib/debug-schema.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/debug-schema.mjs', import.meta.url)), [], 'pur, sans dépendance');
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'debug-schema.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /debug-schema\.mjs$/.test(m)), [], nom);
  }
  const script = lire('../src/scripts/debug-schema.mjs');
  assert.doesNotMatch(script, /\.title\b|getAttribute\('title'\)|setAttribute\('title'/, 'aucune infobulle native');
  assert.doesNotMatch(script, /innerHTML\s*=\s*`/, 'aucun HTML écrit à la main dans le script : les rendus échappés de lib/debug-schema.mjs');
  // dessin à la première ouverture seulement ; une transformation pour le zoom (rendu fait une fois)
  assert.match(script, /cadre\.addEventListener\('toggle', lancer\)/);
  assert.match(script, /if \(lance \|\| !cadre\.open\) return;/);
  assert.equal((script.match(/htmlDuSchema\(/g) ?? []).length, 1);
  assert.match(script, /monde\.style\.transform = `translate\(/, 'le zoom : une transformation CSS du monde, rien n’est redessiné');
  assert.match(script, /monde\.style\.setProperty\('--k', /, 'l’épaisseur des traits suit le zoom à la fin du geste');
  assert.match(script, /if \(traitsARefaire\(kTraits, vue\.k\)\) poserLesTraits\(\);/, 'et par paliers pendant un grand zoom');
  // la molette : décidée AVANT d'être avalée (de passage ou à la borne du zoom, la page défile)
  const molette = /carte\.addEventListener\('wheel', \(e\) => \{([\s\S]*?)\n  \}, \{ passive: false \}\);/.exec(script)[1];
  assert.ok(molette.indexOf('actionDeLaMolette(') >= 0 && molette.indexOf('actionDeLaMolette(') < molette.indexOf('e.preventDefault()'), 'preventDefault seulement pour un zoom');
  assert.match(molette, /if \(action !== 'zoom'\) \{[\s\S]*?return;\n    \}/);
  // activée par un clic (pointerdown), désactivée quand le pointeur la quitte ; un clic sur son fond, qui lui retire le focus, ne la désactive pas
  assert.match(script, /if \(!pointeurDedans && !menuCles\.contains\(e\.relatedTarget\)\) activee = false;/);
  // un clic simple ne suit plus une clé après une attente : seule la PASTILLE la suit, aussitôt ; le double clic ailleurs ouvre le contenu
  assert.doesNotMatch(script, /attenteClic|setTimeout\([^)]*260\)/, 'plus d’attente du clic simple');
  assert.match(script, /const pastille = e\.target\.closest\('\.schema-col__fk'\);/);
  assert.match(script, /addEventListener\('dblclick', \(e\) => \{\n    if \(e\.target\.closest\?\.\('\.schema-col__fk'\)\) return;/);
  // un appui n'arrête pas l'animation (le second clic d'un double clic la figeait à mi-chemin) : seulement un vrai geste
  const appui = /carte\.addEventListener\('pointerdown', \(e\) => \{([\s\S]*?)\n  \}\);/.exec(script)[1];
  assert.ok(appui.indexOf('arreter()') > appui.indexOf('pointeurs.size === 2'), 'arreter() au pincement seulement');
  assert.match(script, /if \(Math\.hypot\(dx, dy\) < 6\) return;\n        arreter\(\);\n        geste\.vue = vue;/, 'et au début d’un glisser');
  // l'infobulle ouverte suit le zoom : chaque rendu émet un « scroll », que components/Infobulles.astro écoute en capture
  assert.match(/function rendre\(\) \{([\s\S]*?)\n  \}/.exec(script)[1], /carte\.dispatchEvent\(new Event\('scroll'\)\);/);
  assert.match(lire('../src/components/Infobulles.astro'), /addEventListener\('scroll', replacer, \{ passive: true, capture: true \}\);/);
  // plein cadre : le reste de la page inerte, Échap écouté sur tout le document
  assert.match(script, /frere\.inert = true;/);
  assert.match(script, /document\.addEventListener\('keydown', quitterAEchap\);/);
  assert.doesNotMatch(script, /vueEl\.addEventListener\('keydown'/, 'plus seulement quand le focus est dans la carte');
  // clavier : L ouvre la liste des clés étrangères ; la liste est hors de la carte (ses flèches ne déplacent pas le focus de table en table)
  assert.match(script, /\(touche === 'l' \|\| touche === 'L'\) && nom\) ouvrirCles\(nom\);/);
  assert.match(script, /menuCles\.innerHTML = htmlDesCles\(cles\);/);
  // cellules coupées de la fenêtre : marquées, focalisables, dépliées au clavier
  assert.match(script, /td\.classList\.add\('est-coupee'\);\n      td\.tabIndex = 0;/);
  assert.match(script, /lignes\.addEventListener\('keydown', \(e\) => \{[\s\S]*?e\.key !== 'Enter' && e\.key !== ' '[\s\S]*?toggle\('est-depliee'\)/);
  // souris, toucher, clavier, fenêtre
  for (const motif of [/addEventListener\('wheel'/, /addEventListener\('dblclick'/, /addEventListener\('pointerdown'/, /'ArrowRight'|startsWith\('Arrow'\)/,
    /touche === '0'/, /`\$\{api\}debug\/tables\/`/, /comptesVivants\(structure, corps\)/, /dialogue\.showModal\(\)/, /dialogue\.close\(\)/, /new IntersectionObserver\(/, /adresseDuContenu\(api,/, /messageDErreur\(/]) {
    assert.match(script, motif);
  }
  // suivi en direct (demande du 2026-10-15 : « j'aimerais que ce tableau se mette à jour si la table change ») : la relève de la version, menu ouvert
  // ET page visible, setTimeout enchaîné (jamais deux à la fois), aussitôt à l'ouverture et au retour au premier plan, arrêtée au 403
  assert.match(script, /const releveActive = \(\) => cadre\.open && document\.visibilityState === 'visible' && !suivi\.arret;/);
  assert.match(script, /suivi\.minuterie = releveActive\(\) \? setTimeout\(relever, delai\) : 0;/);
  assert.doesNotMatch(script, /setInterval\(/, 'une relève attend la précédente');
  assert.match(script, /if \(suivi\.enCours \|\| !releveActive\(\)\) return;/);
  assert.match(script, /fetch\(adresseDeLaVersion\(api\), \{ cache: 'no-store'/);
  assert.match(script, /const suite = suiteDeLaReleve\(statut, corps\);/);
  assert.match(script, /cadre\.addEventListener\('toggle', \(\) => \(cadre\.open \? relever\(\) : planifier\(0\)\)\);/);
  assert.match(script, /document\.addEventListener\('visibilitychange', \(\) => \(releveActive\(\) \? relever\(\) : planifier\(0\)\)\);/);
  // une version nouvelle : les nombres de lignes (la lecture d'avant, devenue une fonction) et le contenu de la fenêtre ouverte
  assert.match(script, /if \(nouvelle \|\| suivi\.enRetard \|\| !comptes\.lus\) \{\n        suivi\.enRetard = false;\n        relireLesComptes\(\);\n        demanderLeRafraichissement\(\);/);
  // chaque page déjà chargée, redemandée avec son ETag ; jamais pendant un chargement, abandonné par une autre table, un autre tri, la fermeture
  assert.match(script, /if \(etag\) entetesHttp\['If-None-Match'\] = etag;/);
  // « Charger plus » : une page qui ne redonne pas les lignes déjà affichées n'ajoute rien et fait rafraîchir d'abord (son ETag ne vaudrait pas)
  assert.match(script, /if \(!pageAccordee\(contenu\.cles, debut, corps\.lignes\)\) \{[\s\S]{0,400}?Object\.assign\(contenu, \{ aRafraichir: true, chargerApres: true \}\);\s*lancerLeRafraichissement\(\);\s*return;/);
  assert.match(script, /pagesARedemander\(avant\.cles\.length\)\.map\(\(d\) => lirePage\(d, contenu\.etags\.get\(d\)\)\)/);
  assert.match(script, /if \(!contenu\.aRafraichir \|\| contenu\.rafraichit \|\| contenu\.enCours \|\| !dialogue\.open \|\| !contenu\.nom\) return;/);
  assert.match(script, /if \(demande !== contenu\.demande\) return; \/\/ une autre table, un autre tri, ou la fenêtre fermée : abandonné/);
  assert.match(script, /contenu\.chargerApres = true; \/\/ un rafraîchissement en cours : la page suivante après lui/);
  assert.match(script, /lancerLeRafraichissement\(\); \/\/ une version nouvelle vue pendant le chargement/);
  // seules les lignes dont le JSON n'était pas affiché sont refaites (les autres <tr> restent : cellules dépliées comprises), et mises en évidence
  assert.match(script, /const plan = planDeMiseAJour\(memesNoms \? avant\.cles : \[\], suite\.cles\);/);
  assert.match(script, /tampon\.innerHTML = htmlDesLignes\(suite\.colonnes, plan\.nouvelles\.map\(/);
  assert.match(script, /if \(!plan\.immobiles\.has\(j\)\) lignes\.insertBefore\(elements\[j\], suivante\);/);
  assert.match(script, /for \(const tr of neuves\) tr\.classList\.add\('est-nouvelle'\);\n      setTimeout\(\(\) => neuves\.forEach\(\(tr\) => tr\.classList\.remove\('est-nouvelle'\)\), MISE_EN_EVIDENCE_MS\);/);
  // rien ne bouge : la première ligne visible gardée (le cadre ne s'ancre pas lui-même : overflow-anchor), les en-têtes seulement si les colonnes changent
  assert.match(script, /if \(ancre\?\.el\.isConnected\) defilement\.scrollTop = ancre\.el\.offsetTop - ancre\.ecart;/);
  assert.match(script, /if \(colonnesChangees\) \{\n      const tri = /);
  assert.equal((script.match(/entetes\.innerHTML = htmlDesEntetes\(/g) ?? []).length, 2, 'à la première page, et quand les colonnes changent');
  // erreurs : 404 (message), 400 sur le tri (ordre par défaut, rechargé), réseau (interrompu, contenu gardé, nouvel essai)
  assert.match(script, /if \(genre === 'tri' && contenu\.tri\) \{/);
  assert.match(script, /Le tableau montre sa dernière lecture\./);
  assert.match(script, /etatDuContenu = etatDeLEchec\(statut\);\n    if \(genre === 'panne'\) \{\n      \/\/ [^\n]*\n      suivi\.enRetard = true;/);
  // la ligne d'état et la zone « live » (les changements seulement)
  assert.match(script, /texteDuSuivi\.textContent = texte;/);
  assert.match(script, /annoncer\(annonceDuChangement\(contenu\.nom, changements\)\);/);

  // relecture du 2026-10-15 (essai Chromium). « Charger plus » n'est jamais désactivé : Chrome retirait le focus clavier du bouton à chaque
  // rafraîchissement (une écriture n'importe où dans la base), et un clic pendant l'un était perdu au lieu d'être rejoué après lui
  assert.doesNotMatch(script, /plus\.disabled/, 'ni pendant un rafraîchissement, ni pendant une lecture de page');
  assert.match(script, /const occuperPlus = \(oui\) => \(oui \? plus\.setAttribute\('aria-disabled', 'true'\) : plus\.removeAttribute\('aria-disabled'\)\);/);
  const rafraichir = /async function rafraichir\(\) \{([\s\S]*?)\n  \}\n/.exec(script)[1];
  assert.doesNotMatch(rafraichir, /occuperPlus|disabled/, 'actif pendant un rafraîchissement : le clic est rejoué (chargerApres)');
  assert.match(script, /if \(document\.activeElement === plus\) defilement\.focus\(\{ preventScroll: true \}\);\n    plus\.hidden = true;/, 'caché : le focus reste dans la fenêtre');
  // un « Charger plus » en échec puis un rafraîchissement sans changement (tout en 304) : la fenêtre repart d'où elle était (bouton, résumé)
  assert.match(rafraichir, /\} else if \(suite\.inchange\) \{\n(?:      \/\/[^\n]*\n)*      erreurEl\.hidden = true;\n      contenu\.fini = contenu\.cles\.length >= contenu\.total;\n      majPied\(\);/);
  assert.match(script, /if \(!affichees\) ecrireLeResume\(''\);/, 'des lignes affichées : leur résumé reste');
  // une table toujours introuvable n'est ni réécrite ni annoncée à chaque écriture dans une autre ; une première page en échec se relit sans
  // « Chargement… » ni alerte réécrite, et la ligne d'état dit pourquoi (plus « en attente du service »)
  assert.match(script, /function montrerLErreur\(texte\) \{\n    if \(!erreurEl\.hidden && erreurEl\.textContent === texte\) return false;/);
  assert.doesNotMatch(script, /erreurEl\.textContent = (?!texte;)/, 'l’alerte ne s’écrit que par montrerLErreur');
  assert.match(script, /if \(introuvable && nouveau\) annoncer\(/);
  assert.match(script, /if \(!contenu\.etags\.size\) \{\n      contenu\.fini = false;\n      charger\(\);\n    \} else rafraichir\(\);/);
  assert.match(script, /etatDuContenu = \{ \.\.\.etatDeLEchec\(statut\), lecture: true \};/);
  // une colonne de tri disparue : la note part avec le rechargement, dite avec son résumé (l'annonce suivante l'effaçait) et dans la ligne d'état
  assert.match(script, /recommencer\(false, noteDuTriPerdu\(colonne\)\);/);
  assert.doesNotMatch(script, /recommencer\(false\);\n\s*annoncer\(/);
  assert.match(script, /annoncer\(note \? `\$\{note\.annonce\} \$\{resume\.textContent\}` : resume\.textContent\);/);
  assert.match(script, /if \(note\) etatBon = \{ genre: 'mis-a-jour', heure: heureCourte\(new Date\(\)\), resume: note\.resume \};/);
  // une relève qui revient menu refermé (ou page cachée) n'a pas de suite : ni nombres de lignes relus, ni rafraîchissement, ni référence changée
  const relever = /async function relever\(\) \{([\s\S]*?)\n  \}\n/.exec(script)[1];
  const garde = relever.indexOf('if (!releveActive()) return;', relever.indexOf('suivi.enCours = false;'));
  assert.ok(garde > relever.indexOf("if (suite.action === 'arret')"), 'après le 403 (arrêt définitif, même menu fermé)');
  assert.ok(garde < relever.indexOf('relireLesComptes();', garde - 1) && garde < relever.indexOf('suivi.reference = suite.version;'), 'avant toute relecture');
  assert.match(relever, /if \(!comptes\.lus && cadre\.open && document\.visibilityState === 'visible'\) relireLesComptes\(\);/);
  // le texte du menu promet que ce qui change s'éclaire : les boîtes dont le nombre de lignes change aussi (pas à la première lecture)
  assert.match(script, /if \('vivants' in sourceDesComptes\.dataset\) eclairerLesBoites\(changees\);\n      sourceDesComptes\.dataset\.vivants = '';/);
  assert.match(script, /el\.classList\.add\('est-changee'\);/);
  // deux fonctions de même nom dans brancher() : la seconde masquerait la première sans erreur (l'éclairage des boîtes l'a été un temps)
  const fonctions = [...script.matchAll(/^  (?:async )?function (\w+)\(/gm)].map((m) => m[1]);
  assert.deepEqual(fonctions.filter((f, i) => fonctions.indexOf(f) !== i), [], 'aucun nom de fonction en double');
});

test('le menu s’appelle « DB » partout où l’on y renvoie : description OpenAPI servie de /debug/tables/, docs/api.md, commentaires (plus aucun renvoi à son ancien titre)', () => {
  // titre visible « DB », sous-ligne « Schéma de la base : … » (demande du 2026-10-15) : un renvoi au cadre sous son ancien titre ne mène plus nulle part
  const ancien = new RegExp(['cadre', '« Schéma de la base »'].join(' '), 'i'); // en deux morceaux : ce fichier ne se trouve pas lui-même
  const spec = descriptionOpenApi({ modules: [], ressources: [], version: 'essai' });
  assert.match(spec.paths['/debug/tables/'].get.description, /\(menu « DB », le schéma de la base, de la page Debug\)/);
  assert.ok(!JSON.stringify(spec).includes('Schéma de la base'), 'la description servie (GET /api/v1/openapi.json) ne cite plus l’ancien titre');
  const api = readFileSync(join(racine, 'docs', 'api.md'), 'utf8');
  const route = api.split('\n').find((l) => l.startsWith('| `GET` | `/api/debug/tables/`'));
  assert.match(route, /\(menu « DB », le schéma de la base, de la page Debug, plus bas\)/);
  assert.match(api, /^4\. \*\*DB\*\*, le schéma de la base/m, 'le nom que lui donne la section « Page Debug », plus bas');
  const trouves = [];
  for (const dossier of ['client/src', 'client/serveur', 'client/test', 'docs', 'tools']) {
    for (const nom of readdirSync(join(racine, dossier), { recursive: true })) {
      if (/\.(mjs|ts|astro|css|md)$/.test(nom) && !nom.includes('node_modules') && ancien.test(readFileSync(join(racine, dossier, nom), 'utf8'))) trouves.push(`${dossier}/${nom}`);
    }
  }
  if (ancien.test(readFileSync(join(racine, 'CLAUDE.md'), 'utf8'))) trouves.push('CLAUDE.md');
  assert.deepEqual(trouves, []);
});

test('le composant : <details> fermé (ni open ni hidden), JSON et script seulement hors production et hors version portable, fenêtre étiquetée', () => {
  const composant = lire('../src/components/debug/SchemaDeLaBase.astro');
  assert.match(composant, /const actif = !site\.prod && process\.env\.INLINE_CSS !== '1';/);
  assert.match(composant, /const structure = actif \? structureDeLaBase\(\) : null;/, 'rien n’est calculé en production');
  assert.match(composant, /^\{\s*structure && \(/m, 'rien n’est rendu en production');
  assert.match(composant, /<details class="debug-bloc debug-schema" data-schema-cadre data-api=\{url\('api\/'\)\}>/, 'fermé par défaut, visible sans attendre le service');
  // demande du propriétaire du 2026-10-15 : le menu s'appelle « DB » (« 4) DB (ton futur schéma) ») ; sa sous-ligne dit que c'est le schéma de la base
  assert.match(composant, /<h2 class="debug-bloc__titre" id="debug-schema-titre">DB<\/h2>\s*<span class="debug-bloc__resume">Schéma de la base : \{resumeDuSchema\(structure\)\}<\/span>/);
  assert.match(composant, /<script is:inline type="application\/json" data-debug-schema set:html=\{jsonPourLaPage\(structure\)\}><\/script>/);
  assert.match(composant, /<script>\s*import '\.\.\/\.\.\/scripts\/debug-schema\.mjs';\s*<\/script>/);
  assert.match(composant, /<dialog class="schema-contenu" data-schema-dialogue aria-labelledby="schema-contenu-titre">/);
  assert.match(composant, /role="application"/);
  // suivi en direct : la ligne d'état dans l'en-tête de la fenêtre (non annoncée), une zone « live » à part ; le résumé n'est plus « live »
  assert.match(composant, /<p class="schema-contenu__resume" data-schema-contenu-resume><\/p>/);
  assert.match(composant, /<p class="schema-contenu__suivi" data-schema-suivi data-etat="attente">\s*<span class="schema-contenu__voyant" aria-hidden="true"><\/span><span data-schema-suivi-texte>Suivi en direct<\/span>/);
  assert.match(composant, /<p class="schema-contenu__annonce" data-schema-contenu-annonce role="status" aria-live="polite"><\/p>/);
  assert.equal((composant.match(/aria-live=/g) ?? []).length, 2, 'l’annonce de la carte et celle de la fenêtre');
  const entete = /<header class="schema-contenu__entete">([\s\S]*?)<\/header>/.exec(composant)[1];
  assert.ok(entete.includes('data-schema-suivi') && !entete.includes('aria-live'), 'la ligne d’état dans l’en-tête, sans être annoncée à chaque relève');
  // les messages, la liste des clés et le conseil de la molette PAR-DESSUS la carte (dans .schema-vue, après la carte) : rien ne la déplace
  const vue = composant.slice(composant.indexOf('<div class="schema-vue" data-schema-vue>'), composant.indexOf('<p class="debug-petit schema-aide"'));
  for (const motif of ['data-schema-annonce', 'data-schema-cles', 'data-schema-conseil']) {
    assert.ok(vue.includes(motif) && vue.indexOf(motif) > vue.indexOf('class="schema-commandes"'), `${motif} dans le cadre, hors de la carte`);
  }
  assert.equal((composant.match(/data-schema-annonce/g) ?? []).length, 1);
  assert.match(composant, /<ul class="schema-cles" data-schema-cles role="menu" aria-label="Clés étrangères" hidden><\/ul>/);
  const aide = /<p class="debug-petit schema-aide" id="schema-aide">([\s\S]*?)<\/p>/.exec(composant)[1].replace(/\s+/g, ' ');
  for (const motif of [/Ctrl \+ molette/, /clic sur la pastille d’une clé étrangère/, /L pour la liste de ses clés étrangères/, /Échap pour quitter le plein cadre/]) assert.match(aide, motif);
  assert.match(composant, /aria-describedby="schema-aide"/);
  assert.match(composant, /import schemaCss from '\.\.\/\.\.\/styles\/debug\/schema\.css\?raw';/);
  assert.doesNotMatch(composant, /\stitle=/, 'jamais d’infobulle native');
  for (const [, id] of composant.matchAll(/<(?:input|select)[^>]*\sid="([^"]+)"/g)) assert.match(composant, new RegExp(`<label for="${id}">`), id);
  const page = lire('../src/pages/debug.astro');
  assert.match(page, /import SchemaDeLaBase from '\.\.\/components\/debug\/SchemaDeLaBase\.astro';/);
  const ordre = ['data-debug-journaux', '<SchemaDeLaBase />', '</div>\n    ) : ('].map((m) => page.indexOf(m));
  assert.ok(ordre[0] >= 0 && ordre[0] < ordre[1] && ordre[1] < ordre[2], 'le dernier menu, après « Journaux du serveur » (« 4) DB »)');
  assert.ok(page.indexOf('<SchemaDeLaBase />') > page.indexOf('actif ? (') && page.indexOf('<SchemaDeLaBase />') < page.indexOf('class="debug-reservee"'), 'dans la branche du site de dev');
  // la CSS : des niveaux de détail, des vues masquées par défaut, la géométrie des boîtes (celle des liens)
  const css = lire('../src/styles/debug/schema.css');
  assert.match(css, /\.schema-carte\[data-detail="loin"\] \.schema-table__colonnes/);
  assert.match(css, /\.schema-carte\[data-detail="moyen"\] \.schema-col__type/);
  assert.match(css, /\.schema-carte:not\(\.avec-vues\) \.schema-table--vue/);
  assert.match(css, new RegExp(`\\.schema-table__entete \\{[^}]*height: ${GEOMETRIE.entete}px;`));
  assert.match(css, new RegExp(`\\.schema-col \\{[^}]*height: ${GEOMETRIE.ligne}px;`));
  assert.match(css, /stroke-width: calc\(1\.1px \/ var\(--k\)\)/);
  // tailles des textes : celles de POLICES (les seuils de NIVEAUX en dépendent)
  assert.match(css, new RegExp(`\\.schema-table__nom \\{[^}]*font-size: ${POLICES.entete}px;`));
  assert.match(css, new RegExp(`\\.schema-col__nom \\{[^}]*font-size: ${POLICES.colonne}px;`));
  assert.match(css, new RegExp(`\\.schema-col__type \\{[^}]*font-size: ${POLICES.petit}px;`));
  assert.match(css, new RegExp(`\\.schema-section__titre \\{[^}]*font-size: ${POLICES.titreSection}px;`));
  assert.match(css, new RegExp(`\\.schema-section__titre-loin \\{[^}]*font-size: clamp\\(${POLICES.titreLoin}px, calc\\(${TITRE_LOIN_ECRAN}px / var\\(--k\\)\\), ${TITRE_LOIN_MAX}px\\);`));
  // le nom d'une table ne se coupe jamais : le nombre de lignes cède
  assert.match(css, /\.schema-table__nom \{ flex: none;/);
  assert.match(css, /\.schema-table__compte \{[^}]*min-width: 0; overflow: hidden; text-overflow: ellipsis;/);
  // l'annonce par-dessus la carte ; une cellule coupée marquée d'un fondu
  assert.match(css, /\.schema-annonce \{\n  position: absolute;/);
  assert.match(css, /td\.est-coupee:not\(\.est-depliee\) \.schema-cellule \{[^}]*mask-image: linear-gradient/);
  // suivi en direct : une ligne nouvelle ou changée éclairée (sans animation sous prefers-reduced-motion) ; bandes par ligne, pas par rang ; le
  // cadre ne s'ancre pas lui-même (le script garde la première ligne visible)
  assert.match(css, /\.schema-contenu__tableau tbody tr\.est-nouvelle td \{ animation: schema-ligne-nouvelle 2s ease-out; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.schema-contenu__tableau tbody tr\.est-nouvelle td \{ animation: none; background: var\(--sch-nouvelle\); \}/);
  assert.match(css, /\.schema-contenu__tableau tbody tr\.est-rayee td \{/);
  assert.doesNotMatch(css, /tr:nth-child\(even\)/, 'une ligne insérée ne repeint pas les suivantes');
  assert.match(css, /\.schema-contenu__defilement \{[^}]*overflow-anchor: none;/);
  assert.match(css, /\.schema-contenu__annonce \{ position: absolute; width: 1px; height: 1px;/);
  assert.ok(css.indexOf('tr.est-nouvelle td {') > css.indexOf('tr.est-rayee td {'), 'l’éclairage passe sur la bande');
  assert.match(css, /\.schema-table\.est-changee \{ animation: schema-ligne-nouvelle 2s ease-out; \}\n@media \(prefers-reduced-motion: reduce\) \{\n  \.schema-table\.est-changee \{ animation: none; background-color: var\(--sch-nouvelle\); \}/);
  assert.match(css, /\.schema-contenu__pied \[aria-disabled="true"\] \{/);
  // le texte du menu : ce qui s'éclaire (une boîte, une ligne de la fenêtre)
  assert.match(composant.replace(/\s+/g, ' '), /une table dont le nombre de lignes change, et dans la fenêtre du contenu une ligne nouvelle ou changée, s’éclairent un instant\./);
  assert.match(css, /prefers-color-scheme: dark/);
});
