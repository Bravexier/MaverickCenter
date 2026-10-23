// Lignes des deux tableaux de /bestiaire/ (lib/bestiaire-db.mjs) : monstres du « Bestiaire 2.0 » et, à part, créatures invoquées (demande du propriétaire).
// Les monstres se modifient sur le site de dev : ces tests contrôlent la cohérence des lignes avec la base, pas les valeurs de l'import
// (test/bestiaire-extraction.test.mjs les compare au doc).
import { normalize } from '../src/lib/text.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORIES, chargerBestiaire, libelleDuBloc, optionsDeFacette, tableauDuButin } from '../src/lib/bestiaire-db.mjs';
import { echellesEcrites, GABARIT_DE_CARTE, RUBRIQUES, SENS_DEFENSE } from '../src/lib/monstre-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const db = ouvrirBase({ sansExemples: false });
const { monstres, invocations } = chargerBestiaire(db);
const n = (sql) => db.prepare(sql).get().n;

test('monstres : une ligne par carte, et une par espèce sans carte ; ancres uniques', () => {
  assert.equal(monstres.cartes, n('SELECT count(*) AS n FROM monstre'));
  // un groupe d'espèces compte pour une (les 22 Ottar, décision R64)
  assert.equal(monstres.especes, n('SELECT count(DISTINCT coalesce(groupe_id, id)) AS n FROM monstre_espece'));
  assert.equal(monstres.lignes.length, monstres.cartes + n('SELECT count(*) AS n FROM monstre_espece e WHERE NOT EXISTS (SELECT 1 FROM monstre m WHERE m.espece_id = e.id)'));
  const ancres = [...monstres.lignes, ...invocations.lignes].map((l) => l.ancre);
  assert.equal(new Set(ancres).size, ancres.length);
  for (const a of ancres) assert.match(a, /^(monstre|invoquee)-[a-z0-9-]+$/);
  // l'ancre d'une carte est son nom ; un nom écrit dans deux espèces (« Golem de corail III ») : la seconde prend « -2 »
  const vus = new Map();
  for (const l of monstres.lignes.filter((x) => x.carte)) {
    const cle = normalize(l.nom);
    vus.set(cle, (vus.get(cle) ?? 0) + 1);
    assert.equal(l.ancre, vus.get(cle) === 1 ? `monstre-${cle}` : `monstre-${cle}-${vus.get(cle)}`, l.id);
  }
  // l'ordre du doc : espèce par espèce, carte par carte
  const ordre = db.prepare('SELECT m.id FROM monstre m JOIN monstre_espece e ON e.id = m.espece_id ORDER BY e.ordre, m.rang').all().map((r) => r.id);
  assert.deepEqual(monstres.lignes.filter((l) => l.carte).map((l) => l.id), ordre);
});

test('monstres : tri et filtres sur les colonnes du tableau seulement (espèce, nom, type, catégorie, EP, lieux), valeurs de la base, rien de calculé', () => {
  // la colonne Espèce : le nom du groupe d'une espèce qui en a un (« Ottar », décision R64), sinon le sien
  const parId = new Map(db.prepare('SELECT m.*, coalesce(g.nom, e.nom) AS espece_nom FROM monstre m JOIN monstre_espece e ON e.id = m.espece_id LEFT JOIN monstre_groupe g ON g.id = e.groupe_id').all().map((m) => [m.id, m]));
  for (const l of monstres.lignes.filter((x) => x.carte)) {
    const m = parId.get(l.id);
    assert.deepEqual(Object.keys(l.tri), ['espece', 'nom', 'type', 'categorie', 'ep', 'lieu'], l.id);
    assert.deepEqual(Object.keys(l.facettes), ['espece', 'type', 'categorie', 'ep', 'lieu'], l.id);
    assert.deepEqual([l.tri.espece, l.tri.nom, l.tri.type, l.tri.categorie, l.tri.ep], [m.espece_nom, m.nom, m.type_brut, ['ennemi_simple', 'mini_boss', 'boss'].indexOf(m.categorie), m.ep_min], l.id);
    assert.deepEqual(l.facettes.categorie, [m.categorie]);
    assert.deepEqual(l.facettes.espece, [normalize(m.espece_nom)]);
    // le filtre EP suit l'échelle écrite : une plage « 1-10 » donne ses dix échelles, une liste « 3, 5, 7 » seulement les siennes (ni 4 ni 6)
    // (une écriture sans échelle lisible : la plage de ses bornes, ou aucune ; le service l'accepte, le texte fait foi)
    const ecrites = echellesEcrites(m.echelle_brut);
    const plage = m.ep_min === null ? [] : Array.from({ length: m.ep_max - m.ep_min + 1 }, (_, k) => m.ep_min + k);
    assert.deepEqual(l.facettes.ep, (ecrites.length ? ecrites : plage).map(String), l.id);
  }
  // l'import du doc : les cartes « 3, 5, 7 »
  const listes = historiqueSite(db).lignesDImport('monstre').filter((c) => /,/.test(c.echelle_brut));
  assert.ok(listes.length > 0, 'des cartes « 3, 5, 7 » à l’import');
  for (const c of listes) assert.deepEqual(echellesEcrites(c.echelle_brut), [3, 5, 7], c.id);
  // une espèce sans carte : ni type ni catégorie (triée après les autres sur ces colonnes)
  for (const l of monstres.lignes.filter((x) => !x.carte)) assert.deepEqual(Object.keys(l.facettes), ['espece', 'ep', 'lieu'], l.id);
});

test('groupe d’espèces (décision R64) : le nom du groupe dans la colonne Espèce, son filtre et son tri ; chaque espèce garde sa description, ses blocs ; à l’import, « Ottar » et ses 22 espèces', () => {
  // l'état courant (le nom et la description du groupe se modifient sur le site de dev) : des invariants
  const groupes = new Map(db.prepare('SELECT * FROM monstre_groupe').all().map((g) => [g.id, g]));
  const especes = new Map(db.prepare('SELECT id, description, groupe_id FROM monstre_espece').all().map((e) => [e.id, e]));
  for (const l of monstres.lignes) {
    const e = especes.get(l.espece.id);
    const g = groupes.get(e.groupe_id);
    assert.deepEqual(l.espece.groupe && { ...l.espece.groupe }, g ? { id: g.id, nom: g.nom, description: g.description } : null, l.id);
    assert.equal(l.tri.espece, g?.nom ?? l.espece.nom, `${l.id} : tri`);
    assert.deepEqual(l.facettes.espece, [normalize(g?.nom ?? l.espece.nom)], `${l.id} : filtre`);
    assert.equal(l.espece.description, e.description, `${l.id} : sa description à elle`);
  }
  // un groupe compte pour une espèce ; une espèce nommée comme lui reste une autre (clés distinctes)
  assert.equal(monstres.especes, new Set([...especes.values()].map((e) => (e.groupe_id ? `groupe:${e.groupe_id}` : `espece:${e.id}`))).size);
  // l'import (historique du site) : le groupe « Ottar », titre « Ottar (explication) » du doc, et ses 22 espèces, du Presque-Ottar à l'Ottar Tour
  const historique = historiqueSite(db);
  const [g] = historique.lignesDImport('monstre_groupe');
  assert.deepEqual([g.id, g.nom], ['monstres/ottar', 'Ottar']);
  assert.match(g.description, /^Les Ottars ont été des êtres humanoïdes de tout horizon/);
  const membres = historique.lignesDImport('monstre_espece').filter((e) => e.groupe_id === g.id).sort((a, b) => a.ordre - b.ordre);
  assert.equal(membres.length, 22);
  assert.deepEqual([membres[0].id, membres[21].id], ['monstres/presque-ottar', 'monstres/ottar-tour']);
  assert.equal(historique.lignesDImport('monstre_espece_bloc').filter((b) => b.espece_id === 'monstres/presque-ottar').length, 15);
  // décision R65 : la description de la créature elle-même, sur sa carte (le doc n'en écrit aucune à l'import)
  const parId = new Map(db.prepare('SELECT id, description FROM monstre').all().map((m) => [m.id, m.description]));
  for (const l of monstres.lignes.filter((x) => x.carte)) assert.equal(l.carte.description, parId.get(l.id), l.id);
  assert.deepEqual(historique.lignesDImport('monstre').filter((m) => m.description !== null).map((m) => m.id), []);
});

test('filtres des monstres : chaque option compte les lignes qui portent sa valeur ; libellé = l’écriture la plus fréquente', () => {
  // « Inutile de filtrer par les colonnes non affichées » (demande du propriétaire) : un filtre par colonne, dans leur ordre, sauf le nom (la recherche)
  assert.deepEqual(monstres.facettes.map((f) => f.cle), ['espece', 'type', 'categorie', 'ep', 'lieu']);
  // l'espèce : une option par nom d'espèce (« Golem de corail », écrit deux fois dans le doc, n'en fait qu'une)
  assert.deepEqual(
    monstres.facettes.find((f) => f.cle === 'espece').options.map((o) => o.valeur).sort(),
    [...new Set(db.prepare('SELECT coalesce(g.nom, e.nom) AS nom FROM monstre_espece e LEFT JOIN monstre_groupe g ON g.id = e.groupe_id').all().map((r) => normalize(r.nom)))].sort(),
  );
  for (const f of monstres.facettes) {
    assert.ok(f.options.length > 0, f.cle);
    for (const o of f.options) assert.equal(o.nombre, monstres.lignes.filter((l) => (l.facettes[f.cle] ?? []).includes(o.valeur)).length, `${f.cle} ${o.valeur}`);
  }
  const options = (cle) => monstres.facettes.find((f) => f.cle === cle).options;
  assert.deepEqual(options('categorie').map((o) => o.libelle), Object.values(CATEGORIES));
  const echelles = [...new Set(monstres.lignes.flatMap((l) => l.facettes.ep))].sort((a, b) => a - b);
  assert.deepEqual(options('ep').map((o) => o.valeur), echelles, 'les échelles dans l’ordre');
  // un type écrit de plusieurs façons (« Non-mort », « Non-Mort ») : une seule option, l'écriture la plus fréquente, toutes ses lignes
  const types = db.prepare('SELECT type_brut AS t, count(*) AS n FROM monstre WHERE type_brut IS NOT NULL GROUP BY type_brut').all();
  for (const o of options('type')) {
    const ecritures = types.filter((x) => normalize(x.t) === o.valeur).sort((a, b) => b.n - a.n || a.t.localeCompare(b.t, 'fr'));
    assert.equal(o.libelle, ecritures[0].t, o.valeur);
    assert.equal(o.nombre, ecritures.reduce((k, x) => k + x.n, 0), o.valeur);
  }
  assert.ok(options('type').length < types.length, 'des écritures réunies');
});

test('optionsDeFacette : effectifs, libellés et ordre voulu', () => {
  const lignes = [{ facettes: { t: ['a', 'b'] } }, { facettes: { t: ['a'] } }, { facettes: {} }];
  const ecritures = new Map([['a', new Map([['A', 1], ['à', 3]])], ['b', new Map([['B', 1]])]]);
  assert.deepEqual(optionsDeFacette(lignes, 't', ecritures), [{ valeur: 'a', libelle: 'à', nombre: 2 }, { valeur: 'b', libelle: 'B', nombre: 1 }]);
  assert.deepEqual(optionsDeFacette(lignes, 't', ecritures, ['b']).map((o) => o.valeur), ['b', 'a']);
});

test('butin d’une espèce : une ligne par tranche, une colonne par catégorie, cellule vide = null', () => {
  const t = tableauDuButin([
    { rang: 1, score_brut: '3-15', categorie: 'boss', texte: 'X' },
    { rang: 1, score_brut: '3-15', categorie: 'ennemi_simple', texte: 'Y' },
    { rang: 2, score_brut: '16-60', categorie: 'mini_boss', texte: 'Z' },
  ]);
  assert.deepEqual(t, [
    { rang: 1, score: '3-15', ennemi_simple: 'Y', mini_boss: null, boss: 'X' },
    { rang: 2, score: '16-60', ennemi_simple: null, mini_boss: 'Z', boss: null },
  ]);
  // le butin d'une ligne : celui de son espèce dans la base, tranche par tranche
  for (const l of monstres.lignes) {
    const lignes = db.prepare('SELECT * FROM monstre_butin WHERE espece_id = ? ORDER BY rang').all(l.espece.id);
    assert.deepEqual(l.espece.butin, tableauDuButin(lignes), l.id);
  }
  assert.ok(monstres.lignes.some((l) => l.espece.butin.length));
});

test('créatures invoquées : à part, une carte par créature, dans l’ordre du classeur ; un filtre sur la seule colonne filtrable affichée (magie)', () => {
  assert.equal(invocations.lignes.length, n('SELECT count(*) AS n FROM creature'));
  assert.deepEqual(invocations.invocations.map((i) => i.nom), db.prepare('SELECT nom FROM invocation ORDER BY ordre').all().map((r) => r.nom));
  assert.deepEqual(invocations.facettes.map((f) => f.cle), ['magie']);
  const lignesDesTableaux = invocations.tableaux.flatMap((t) => t.lignes);
  // le nombre d'une valeur compte des créatures (les cases de ses lignes), comme le compte de la page, pas des combinaisons
  for (const f of invocations.facettes) {
    for (const o of f.options) {
      const n = lignesDesTableaux.filter((l) => l.facettes[f.cle].includes(o.valeur)).reduce((k, l) => k + l.cases.length, 0);
      assert.equal(o.nombre, n, `${f.cle} ${o.valeur}`);
    }
  }
  assert.ok(lignesDesTableaux.some((l) => l.cases.length === 2 && l.facettes.magie.length), 'des lignes de deux créatures sont comptées');
  const magma = invocations.lignes.find((l) => l.ancre === 'invoquee-golem-de-magma');
  assert.deepEqual(magma.magiesDuBloc, ['Terre', 'Feu']);
  assert.equal(magma.sante, '20/NPM');
  assert.equal(magma.invocation.sortNom, db.prepare("SELECT s.nom FROM invocation i JOIN sort s ON s.id = i.sort_id WHERE i.id = 'bestiaire/appel-aux-golems'").get().nom);
  const peur = (l) => l.defensesEcrites.some((d) => normalize(d.libelle) === 'immunite-peur');
  assert.ok(!peur(magma), 'les golems ne sont pas des non-morts');
  const zombi = invocations.lignes.find((l) => l.ancre === 'invoquee-zombi');
  assert.ok(peur(zombi), 'capacité commune « Non-Mort »');
  assert.deepEqual(zombi.defensesParMagie.map((d) => d.magie), ['Nécromancie']);
});

test('créatures invoquées : trois tableaux (demande du propriétaire), une ligne par bloc du classeur — combinaison et ses deux créatures côte à côte, le mono d’abord ; NPM d’une marionnette et sa créature', () => {
  // un tableau par invocation, dans l'ordre du classeur ; une ligne par bloc de la marge, dans son ordre ; chaque créature dans une case, une seule fois
  assert.deepEqual(invocations.tableaux.map((t) => t.invocation.id), db.prepare('SELECT id FROM invocation ORDER BY ordre').all().map((r) => r.id));
  const blocs = db.prepare('SELECT b.id, b.invocation_id, b.marge_brut, b.npm, (SELECT count(*) FROM invocation_bloc_magie m WHERE m.bloc_id = b.id) AS magies FROM invocation_bloc b ORDER BY b.invocation_id, b.rang').all();
  for (const t of invocations.tableaux) {
    const siens = blocs.filter((b) => b.invocation_id === t.invocation.id);
    assert.deepEqual(t.lignes.map((l) => l.id), siens.map((b) => b.id), `${t.invocation.id} : ses blocs, dans l'ordre`);
    // le libellé d'une ligne : la combinaison telle qu'écrite, ou le NPM d'une marionnette (décision R53)
    assert.deepEqual(t.lignes.map((l) => l.libelle), siens.map((b) => (b.npm === null ? b.marge_brut : `NPM ${b.npm}`)));
    assert.equal(t.creatures, n(`SELECT count(*) AS n FROM creature WHERE invocation_id = '${t.invocation.id}'`));
    for (const l of t.lignes) {
      const rangs = db.prepare('SELECT id FROM creature WHERE bloc_id = ? ORDER BY rang').all(l.id).map((r) => r.id);
      assert.deepEqual(l.cases.map((c) => c.id), rangs, `${l.id} : carte de gauche, puis de droite`);
      // le mono : une seule magie dans la marge (« Terre + Terre » en a deux, la même) ; la marge d'une marionnette ne nomme pas de magie
      assert.equal(l.mono, siens.find((b) => b.id === l.id).magies === 1, l.id);
      // les magies de la combinaison, dans l'ordre de la marge
      assert.deepEqual(l.magies, db.prepare('SELECT m.nom FROM invocation_bloc_magie bm JOIN magie m ON m.id = bm.magie_id WHERE bm.bloc_id = ? ORDER BY bm.rang').all(l.id).map((r) => r.nom), l.id);
    }
    // golems, non-morts : deux créatures par combinaison, le mono en premier ; marionnettes : une par NPM, du plus petit au plus grand
    if (t.duo) {
      assert.ok(t.lignes.every((l) => l.cases.length === 2), `${t.invocation.id} : deux cases côte à côte`);
      assert.ok(t.lignes[0].mono && t.lignes.slice(1).every((l) => !l.mono), `${t.invocation.id} : le mono d'abord, et lui seul`);
    } else {
      assert.ok(t.lignes.every((l) => l.cases.length === 1 && l.npm !== null && l.magies.length === 0), `${t.invocation.id} : une ligne par NPM`);
      assert.ok(t.lignes.every((l, k) => k === 0 || l.npm > t.lignes[k - 1].npm), `${t.invocation.id} : NPM croissants`);
    }
  }
  assert.deepEqual(invocations.tableaux.map((t) => t.duo), [true, true, false], 'golems et non-morts sur le même modèle, marionnettes à part');
  const ids = invocations.tableaux.flatMap((t) => t.lignes.flatMap((l) => l.cases.map((c) => c.id)));
  assert.deepEqual([...ids].sort(), invocations.lignes.map((l) => l.id).sort(), 'chaque créature une fois');
  // l'ordre des lignes (data-ordre) suit les trois tableaux
  assert.deepEqual(invocations.tableaux.flatMap((t) => t.lignes.map((l) => l.ordre)), blocs.map((_, k) => k));
});


test('décision R53 : les créatures invoquées n’ont pas d’échelle de puissance ; le « EPN » de l’onglet Marionette est leur NPM, jamais affiché « EP »', () => {
  // le libellé d'un bloc : la marge telle qu'écrite, ou « NPM N » quand le bloc a un NPM
  assert.equal(libelleDuBloc({ marge_brut: 'Terre + Sang', npm: null }), 'Terre + Sang');
  assert.equal(libelleDuBloc({ marge_brut: 'EP3', npm: 3 }), 'NPM 3');
  // dans la base : un NPM pour chaque bloc des marionnettes, aucun pour les combinaisons de magies (qui ont, elles, leurs magies de marge)
  const blocs = db.prepare('SELECT b.id, b.npm, (SELECT count(*) FROM invocation_bloc_magie m WHERE m.bloc_id = b.id) AS magies FROM invocation_bloc b').all();
  assert.ok(blocs.some((b) => b.npm !== null));
  for (const b of blocs) assert.equal(b.npm === null, b.magies > 0, `${b.id} : un NPM ou des magies de marge`);
  // ce que montrent le bestiaire (tableaux, cartes) et les pages des créatures : jamais « EP » pour une créature invoquée
  const ep = /\bEP\b/;
  for (const l of invocations.lignes) assert.doesNotMatch(l.bloc, ep, l.id);
  for (const l of invocations.tableaux.flatMap((t) => t.lignes)) assert.doesNotMatch(l.libelle, ep, l.id);
  const pages = db.prepare("SELECT id, corps_md FROM page WHERE source_ref LIKE 'Google Sheet « Invocation »%'").all();
  assert.ok(pages.length > 60);
  for (const p of pages) assert.doesNotMatch(p.corps_md, ep, p.id);
  // la page d'une marionnette dit son NPM, celui de son bloc ; la page de l'invocation les liste
  for (const l of invocations.lignes.filter((x) => x.bloc.startsWith('NPM '))) {
    const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(l.id)?.corps_md;
    assert.ok(corps?.includes(`**Libellé du bloc** : ${l.bloc}\n`), `${l.id} : ${l.bloc} dans sa page`);
  }
});

test('décision R148 (migration 0073) : les cartes écrivent les multiplicateurs de la base — grande résistance ÷3, grande vulnérabilité x3, sensibilité x4 ; plus de « Double résistance »', () => {
  // « Oui là aussi c'est x3 et pas 4... » ; « Pareil remplace double résistance par Grande résistance » ; « Oui x4 aussi » (2026-10-22)
  const titres = (rubrique) => db.prepare('SELECT monstre_id, titre FROM monstre_rubrique WHERE rubrique = ?').all(rubrique);
  const grandesResistances = titres('grande_resistance');
  assert.ok(grandesResistances.length > 0, 'des grandes résistances');
  for (const r of grandesResistances) assert.doesNotMatch(r.titre, /÷\s*4/, `${r.monstre_id} : « ${r.titre} »`);
  for (const r of titres('grande_vulnerabilite')) assert.doesNotMatch(r.titre, /x\s*4/i, `${r.monstre_id} : « ${r.titre} »`);
  // « Double(s) Résistance(s) » est devenue « Grande(s) Résistance(s) » : rubrique et cibles typées (le sens d'une cible est sa rubrique)
  assert.equal(n("SELECT count(*) AS n FROM monstre_rubrique WHERE rubrique = 'double_resistance'"), 0, 'aucune rubrique « Double résistance »');
  assert.equal(n("SELECT count(*) AS n FROM monstre_defense WHERE sens = 'double_resistance'"), 0, 'aucune cible « Double résistance »');
  assert.equal(n("SELECT count(*) AS n FROM monstre_rubrique WHERE titre LIKE 'Double(s)%'"), 0, 'aucun titre « Double(s) … »');
  // la sensibilité x8 (compétences des golems de verre I à III) est x4
  for (const r of db.prepare("SELECT monstre_id, rubrique, coalesce(titre, '') || char(10) || texte AS t FROM monstre_rubrique").all()) {
    assert.doesNotMatch(r.t, /Dégâts\s*x\s*8/i, `${r.monstre_id} (${r.rubrique}) : x8`);
  }
});

test('décision R148 : les titres par défaut d’une rubrique (carte créée sur le site de dev) écrivent les multiplicateurs de la base ; aucun titre de « Double résistance »', () => {
  // le multiplicateur écrit à la fin d'un titre ou d'un effet : « ÷3 », « x3 », « = 0 » -> « ÷3 », « x3 », « =0 »
  const multiplicateur = (texte) => texte.match(/(÷|x|=)\s*(\d+)\s*$/i)?.slice(1, 3).join('').toLowerCase() ?? null;
  const paliers = db.prepare('SELECT id, effet_brut FROM resistance_palier').all();
  const communs = paliers.filter((p) => p.id in RUBRIQUES);
  assert.deepEqual(communs.map((p) => p.id).sort(), ['grande_resistance', 'grande_vulnerabilite', 'immunite', 'resistance', 'vulnerabilite']);
  for (const p of communs) assert.equal(multiplicateur(RUBRIQUES[p.id]), multiplicateur(p.effet_brut), `${p.id} : « ${RUBRIQUES[p.id]} » / « ${p.effet_brut} »`);
  // « Oui là aussi c'est x3 et pas 4... » (2026-10-22)
  assert.equal(RUBRIQUES.grande_resistance, 'Grande(s) Résistance(s) Dégâts ÷3');
  assert.equal(RUBRIQUES.grande_vulnerabilite, 'Grande(s) Vulnérabilité(s) Dégâts x3');
  for (const titre of Object.values(RUBRIQUES)) assert.doesNotMatch(titre, /÷\s*4|x\s*[48]\b/i, titre);
  // « Pareil remplace double résistance par Grande résistance » : plus de titre à proposer, ni dans le gabarit d'une carte créée ; le sens reste lu
  // comme le CHECK du schéma l'admet (le rejeu d'un journal d'avant 0073 le traduit : test/serveur-edition-rejeu-resistances.test.mjs)
  assert.ok(!('double_resistance' in RUBRIQUES), 'pas de titre « Double(s) Résistance(s) »');
  assert.ok(!GABARIT_DE_CARTE.includes('double_resistance'));
  assert.ok(SENS_DEFENSE.includes('double_resistance'), 'SENS_DEFENSE suit le CHECK de monstre_defense.sens');
  const check = db.prepare("SELECT sql FROM sqlite_schema WHERE name = 'monstre_defense'").get().sql;
  for (const sens of SENS_DEFENSE) assert.ok(check.includes(`'${sens}'`), `${sens} dans le CHECK`);
});
