// Armes élémentaires dans la base (décision R167 du propriétaire, migration 0081-r167-armes-elementaires) : le tableau d'amélioration des armes fondu
// (« Niveau | Coût matériel | Coût élémentaire | Effet »), le type élémentaire de chaque famille, les en-têtes de type de l'onglet « Pièces
// élémentaires », leurs types physiques, la solidité de base d'une arme élémentaire, l'étiquette des sorts « Fer », le modèle d'arme unique de personnage_arme
// (et le type physique choisi d'une bombe élémentaire), et les règles arme_elementaire_hors_magie et arme_type_degats_choisi de v_personnage_controle. Les valeurs de l'import se lisent par lib/historique-site.mjs (le site de dev est la source de ce
// qu'il modifie) ; les tests de fiche écrivent dans une COPIE de la base construite (data/rows garde la section 13 vide).
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const h = historiqueSite(db);
const tout = (sql, ...p) => db.prepare(sql).all(...p).map((r) => ({ ...r }));

// L'export brut du classeur « Ressources et Craft » : la valeur d'une cellule (ligne, colonne numérotées depuis 1) d'un onglet.
const classeur = JSON.parse(readFileSync(new URL('../../sources/raw/classeurs/ressources-et-craft.json', import.meta.url), 'utf8'));
const onglet = (nom) => classeur.sheets.find((s) => s.name === nom);
const cellule = (nom, r, c) => onglet(nom).cells.find((x) => x.r === r && x.c === c)?.v;
const colonne = (lettres) => [...lettres].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0);
const parCase = (nom, ref) => { const [, l, r] = /^([A-Z]+)(\d+)$/.exec(ref); return cellule(nom, Number(r), colonne(l)); };

const NIVEAUX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Les deux tableaux de la source : onglet Armes, niveau N en ligne 33 + 2N (coût P, effet T) ; onglet Pièces élémentaires, en ligne 58 + 2N (coût B, effet F)
const armes = (n) => ({ cout: cellule('Armes', 33 + 2 * n, 16), effet: cellule('Armes', 33 + 2 * n, 20) });
const pieces = (n) => ({ cout: cellule('Pièces élémentaires', 58 + 2 * n, 2), effet: cellule('Pièces élémentaires', 58 + 2 * n, 6) });

test('R167 : les deux tableaux d’amélioration des armes ont le même effet niveau par niveau dans la source (preuve de la fusion)', () => {
  for (const n of NIVEAUX) {
    assert.equal(cellule('Armes', 33 + 2 * n, 15), `+${n}`);
    assert.equal(cellule('Pièces élémentaires', 58 + 2 * n, 1), `+${n}`);
    assert.equal(pieces(n).effet, armes(n).effet, `+${n}`);
  }
});

test('R167 : un seul tableau d’amélioration des armes, « Niveau | Coût matériel | Coût élémentaire | Effet », ids de l’onglet Armes gardés', () => {
  assert.deepEqual(tout("SELECT id FROM amelioration_equipement WHERE cible = 'arme_elementaire' OR id LIKE '%#amelioration:arme-elementaire:%'"), []);
  assert.deepEqual(tout("SELECT entite_id FROM page_entite WHERE entite_table = 'amelioration_equipement' AND entite_id LIKE '%arme-elementaire%'"), []);
  const lignes = h.lignesDImport('amelioration_equipement').filter((l) => l.cible === 'arme').sort((a, b) => a.niveau - b.niveau);
  assert.deepEqual(lignes.map((l) => l.id), NIVEAUX.map((n) => `ressources/armes#amelioration:arme:${n}`));
  const QUALITES = { commune: [1, 3], raffinee: [4, 6], parfaite: [7, 9] };
  for (const l of lignes) {
    const n = l.niveau;
    // l'effet (le même dans les deux tableaux) : dégâts +2 à +20, crans : rien au +1…+4, 1 du +5 au +9, 2 au +10 ; ni AP ni AM
    assert.equal(l.bonus_degats, 2 * n, `+${n}`);
    assert.equal(l.bonus_cran, n < 5 ? null : n < 10 ? 1 : 2, `+${n}`);
    assert.equal(l.bonus_ap, null);
    assert.equal(l.bonus_am, null);
    // coût matériel de l'onglet Armes, coût élémentaire de l'onglet Pièces élémentaires, tels qu'écrits ; les deux plages citées
    assert.equal(l.cout_brut, armes(n).cout, `+${n}`);
    assert.equal(l.cout_elementaire_brut, pieces(n).cout, `+${n}`);
    assert.match(l.source_ref, new RegExp(`^Ressources et Craft › Armes › O${33 + 2 * n}:T${33 + 2 * n} ; Ressources et Craft › Pièces élémentaires › A${58 + 2 * n}:F${58 + 2 * n}$`));
    if (n === 10) {
      assert.deepEqual([l.cout_gemmes, l.cout_gemmes_qualite, l.cout_pieces_elementaires], [null, null, 1]);
    } else {
      const [qualite, [debut]] = Object.entries(QUALITES).find(([, [a, b]]) => n >= a && n <= b);
      assert.deepEqual([l.cout_gemmes, l.cout_gemmes_qualite, l.cout_pieces_elementaires], [n - debut + 1, qualite, null], `+${n}`);
    }
  }
  // les armures, boucliers et armures élémentaires n'ont pas de coût élémentaire (CHECK de la table)
  assert.deepEqual(tout("SELECT cible, count(*) AS n FROM amelioration_equipement WHERE cible <> 'arme' AND cout_elementaire_brut IS NOT NULL GROUP BY cible"), []);
  assert.deepEqual(tout('SELECT cible FROM amelioration_equipement GROUP BY cible ORDER BY cible').map((r) => r.cible), ['arme', 'armure', 'armure_elementaire', 'bouclier']);
});

test('R167 : le coût élémentaire est cumulatif, et son total est la ligne TOTAL B80:F80 (amelioration_total « arme_elementaire »)', () => {
  const lignes = tout("SELECT niveau, cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires FROM amelioration_equipement WHERE cible = 'arme' ORDER BY niveau");
  const cumul = (jusqua) => {
    const t = { commune: 0, raffinee: 0, parfaite: 0, piece: 0 };
    for (const l of lignes.filter((x) => x.niveau <= jusqua)) {
      if (l.cout_gemmes) t[l.cout_gemmes_qualite] += l.cout_gemmes;
      t.piece += l.cout_pieces_elementaires ?? 0;
    }
    return t;
  };
  assert.deepEqual(cumul(2), { commune: 3, raffinee: 0, parfaite: 0, piece: 0 });   // R167 : « du 0 au 2 demande 1+2 = 3 gemmes communes »
  assert.deepEqual(cumul(5), { commune: 6, raffinee: 3, parfaite: 0, piece: 0 });
  assert.deepEqual(cumul(10), { commune: 6, raffinee: 6, parfaite: 6, piece: 1 });
  const total = h.valeurDImport('amelioration_total', { cible: 'arme_elementaire' }, 'total_brut');
  assert.equal(total, '6 communes + 6 raffinées + 6 parfaites + 1 pièce élémentaire');
  assert.equal(total, cellule('Pièces élémentaires', 80, 6));
  // les deux lignes TOTAL des armes restent : coût matériel (Armes P55:T55) et coût élémentaire
  assert.deepEqual(tout("SELECT cible, source_ref FROM amelioration_total WHERE cible IN ('arme', 'arme_elementaire') ORDER BY cible"), [
    { cible: 'arme', source_ref: 'Ressources et Craft › Armes › P55:T55' },
    { cible: 'arme_elementaire', source_ref: 'Ressources et Craft › Pièces élémentaires › B80:F80' },
  ]);
});

const FAMILLE_VERS_TYPE = {
  epees: 'epee', dagues: 'dague', 'masse-marteau': 'masse', hache: 'hache', 'lance-arme-dhast': 'arme-dhast', 'baton-de-combat': 'baton-de-combat',
  arc: 'arc', arbalete: 'arbalete', 'arme-de-jet': 'arme-de-jet', pugilat: 'pugilat', bombes: 'bombe',
};

// Les familles de l'import (les bandeaux de l'onglet Armes) : celles que le site de dev n'a pas créées (lib/historique-site.mjs#lignesDImport), lues
// par leur identifiant, figé (un renommage du site, décision R159, n'y change rien). Une famille créée sur le site de dev (R159) n'a aucune arme
// élémentaire (R167 : « Aucune ») : type_elementaire_id NULL, que le site ne modifie pas.
test('R167 : chaque famille maîtrisable de l’import a son type élémentaire et ses 14 armes élémentaires ; ARME DE MONSTRES aucune, une famille créée sur le site non plus', () => {
  const importees = new Set(h.lignesDImport('arme_famille').map((f) => f.id));
  assert.equal(importees.size, 12);
  const familles = tout('SELECT id, maitrisable, type_elementaire_id FROM arme_famille ORDER BY ordre');
  const deLImport = familles.filter((f) => importees.has(f.id));
  assert.deepEqual(Object.fromEntries(deLImport.filter((f) => f.maitrisable).map((f) => [f.id, f.type_elementaire_id])), FAMILLE_VERS_TYPE);
  assert.deepEqual(deLImport.filter((f) => !f.maitrisable).map((f) => [f.id, f.type_elementaire_id]), [['arme-de-monstres', null]]);
  for (const f of familles.filter((x) => !importees.has(x.id))) {
    assert.ok(h.creee('arme_famille', { id: f.id }), `${f.id} : créée sur le site de dev`);
    assert.equal(f.type_elementaire_id, null, `${f.id} : une famille créée sur le site n’a aucune arme élémentaire (R167)`);
  }
  for (const id of importees) assert.ok(!h.modifiee('arme_famille', { id }, 'type_elementaire_id'), `${id} : le site ne réécrit pas son type élémentaire`);
  const magies = tout("SELECT id FROM magie WHERE id <> 'magies/potentiel-illimite' ORDER BY id").map((m) => m.id);
  assert.equal(magies.length, 14);
  for (const [famille, type] of Object.entries(FAMILLE_VERS_TYPE)) {
    const elementaires = tout('SELECT ae.magie_id FROM arme_famille f JOIN arme_elementaire ae ON ae.type_id = f.type_elementaire_id WHERE f.id = ? ORDER BY ae.magie_id', famille);
    assert.deepEqual(elementaires.map((e) => e.magie_id), magies, `${famille} → ${type}`);
  }
  // jamais vers un type mixte (« Arme d'Hast/Bâton », « Masse/Hache » n'ont pas d'arme élémentaire)
  assert.deepEqual(tout("SELECT id FROM arme_famille WHERE type_elementaire_id IN ('arme-dhast-baton', 'masse-hache')"), []);
  assert.deepEqual(tout("SELECT type_id FROM arme_elementaire WHERE type_id IN ('arme-dhast-baton', 'masse-hache')"), []);
});

test('R167 : les en-têtes de type de l’onglet Pièces élémentaires (ignore 4 AP de l’arbalète, un exemplaire de l’arme de jet et de la bombe)', () => {
  const types = tout('SELECT * FROM arme_elementaire_type ORDER BY ordre');
  assert.deepEqual(types.map((t) => t.type_id), ['epee', 'dague', 'masse', 'hache', 'arme-dhast', 'pugilat', 'baton-de-combat', 'arc', 'arbalete', 'arme-de-jet', 'bombe']);
  assert.deepEqual(types.map((t) => t.type_id).sort(), tout('SELECT DISTINCT type_id FROM arme_elementaire ORDER BY type_id').map((r) => r.type_id));
  for (const t of types) {
    // l'en-tête tel qu'écrit dans sa cellule (colonne Q)
    const [, ref] = /^Ressources et Craft › Pièces élémentaires › (Q\d+)$/.exec(t.source_ref);
    assert.equal(t.entete_brut, parCase('Pièces élémentaires', ref), t.type_id);
  }
  assert.deepEqual(types.filter((t) => t.ignore_ap !== null).map((t) => [t.type_id, t.ignore_ap, t.source_ref]),
    [['arbalete', 4, 'Ressources et Craft › Pièces élémentaires › Q64']]);
  assert.match(parCase('Pièces élémentaires', 'Q64'), /ignore 4 AP/);
  assert.deepEqual(types.filter((t) => t.exemplaire_unique).map((t) => t.type_id), ['arme-de-jet', 'bombe']);
  for (const ref of ['Q71', 'Q78']) assert.match(parCase('Pièces élémentaires', ref), /Ces armes sont que en un exemplaire/);
  // la mention que la page des armes affiche : celle de la page « Pièces élémentaires » (orthographe de la migration 0005), mot pour mot
  const corps = h.valeurDImport('page', { id: 'ressources/pieces-elementaires' }, 'corps_md');
  const MENTION = "Ces armes sont qu'en un exemplaire et reviennent toujours dans la main du lanceur (sauf EC)";
  assert.deepEqual(types.filter((t) => t.mention !== null).map((t) => [t.type_id, t.mention]), [['arme-de-jet', MENTION], ['bombe', MENTION]]);
  assert.equal(corps.split(`(${MENTION})`).length - 1, 2);
});

test('R167 : la compétence d’une arme élémentaire, au choix du porteur selon son type (« Mêlée / arme de jets / bombes => Légère / Lourde… »)', () => {
  const parType = {};
  for (const r of tout('SELECT type_id, competence_id FROM arme_elementaire_type_competence ORDER BY type_id, competence_id')) (parType[r.type_id] ??= []).push(r.competence_id);
  const LEGERE_OU_LOURDE = ['arme-legere', 'arme-lourde'];
  assert.deepEqual(parType, {
    arbalete: ['arbalete'], arc: ['arc', 'arme-legere'], 'arme-de-jet': LEGERE_OU_LOURDE, 'arme-dhast': LEGERE_OU_LOURDE, 'baton-de-combat': LEGERE_OU_LOURDE,
    bombe: LEGERE_OU_LOURDE, dague: LEGERE_OU_LOURDE, epee: LEGERE_OU_LOURDE, hache: LEGERE_OU_LOURDE, masse: LEGERE_OU_LOURDE, pugilat: LEGERE_OU_LOURDE,
  });
});

// Le type physique de chaque type élémentaire (R167 : « Les deux. Exactement pour les sorts de "Fer". Estoc + Feu pour un arc de feu par exemple. » ;
// au choix « Le plus fréquent » : « Épée = Taille, Dague = Estoc+Taille, Masse = Frappe, Hache = Taille, Lance = Estoc, Pugilat = Frappe, Arme de jet =
// Estoc » ; Bombe : « Au choix »). Posé par la décision : il n'est pas recalculé depuis arme_degats.
test('R167 : les types physiques des 11 types élémentaires (dague estoc et taille ; bombe, un seul au choix entre trois)', () => {
  const parType = {};
  for (const r of tout('SELECT type_id, type_degats FROM arme_elementaire_type_degats ORDER BY type_id, type_degats')) (parType[r.type_id] ??= []).push(r.type_degats);
  assert.deepEqual(parType, {
    arbalete: ['estoc'], arc: ['estoc'], 'arme-de-jet': ['estoc'], 'arme-dhast': ['estoc'], 'baton-de-combat': ['frappe'], bombe: ['estoc', 'frappe', 'taille'],
    dague: ['estoc', 'taille'], epee: ['taille'], hache: ['taille'], masse: ['frappe'], pugilat: ['frappe'],
  });
  // « les deux s'appliquent » (dague) contre « un seul, au choix du porteur » (bombe)
  assert.deepEqual(tout('SELECT type_id FROM arme_elementaire_type WHERE type_degats_au_choix = 1'), [{ type_id: 'bombe' }]);
  assert.equal(tout('SELECT type_id FROM arme_elementaire_type WHERE type_degats_au_choix = 0').length, 10);
  for (const r of tout('SELECT origine, source_ref FROM arme_elementaire_type_degats')) {
    assert.deepEqual(r, { origine: 'equipement', source_ref: 'Décision R167 du propriétaire (2026-10-23)' });
  }
  // le type de la magie n'est pas ici : il se lit par arme_elementaire.magie_id
  assert.deepEqual(tout("SELECT name FROM pragma_table_info('arme_elementaire_type_degats') ORDER BY cid").map((c) => c.name),
    ['type_id', 'type_degats', 'origine', 'source_ref']);
});

// La solidité d'une arme élémentaire (R167 : « Solidité : 4 crans + les crans de la ligne d'amélioration choisie ») : la constante de toute pièce
// élémentaire, 'piece_elementaire.solidite_base' (migration 0080, décision R165), plus bonus_cran de la ligne du tableau d'amélioration FONDU des armes
// (cible 'arme') ; les crans des armures élémentaires viennent de leur propre tableau (cible 'armure_elementaire') et ne s'en mêlent pas.
test('R167 : une arme élémentaire a la solidité d’une pièce élémentaire (4 crans, cellule A3), plus les crans de sa ligne d’amélioration d’arme', () => {
  const c = db.prepare("SELECT * FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").get();
  assert.equal(c.valeur, 4);
  assert.equal(c.unite, 'crans');
  assert.equal(c.source_ref, 'Ressources et Craft › Pièces élémentaires › A3');
  assert.ok(parCase('Pièces élémentaires', 'A3').includes(c.texte), c.texte);
  const crans = (n) => db.prepare("SELECT COALESCE(bonus_cran, 0) AS c FROM amelioration_equipement WHERE cible = 'arme' AND niveau = ?").get(n).c;
  assert.deepEqual([4, 5, 9, 10].map((n) => c.valeur + crans(n)), [4, 5, 5, 6]);   // rien au +1…+4, 1 au +5…+9, 2 au +10
  // aucune constante propre aux armes élémentaires (celle de la première version de la migration n'existe pas)
  assert.equal(db.prepare("SELECT count(*) AS n FROM constante_equipement WHERE id = 'arme_elementaire.solidite_base'").get().n, 0);
});

const SORTS_FER = [
  ['magies/magie-de-la-corruption#sort:fer-corrompu', 'Fer corrompu', 'magies/magie-de-la-corruption'],
  ['magies/magie-de-la-foudre#sort:fer-foudroyant', 'Fer Foudroyant', 'magies/magie-de-la-foudre'],
  ['magies/magie-de-la-glace#sort:fer-froid', 'Fer froid', 'magies/magie-de-la-glace'],
  ['magies/magie-de-la-lumiere#sort:fer-lumineux', 'Fer Lumineux', 'magies/magie-de-la-lumiere'],
  ['magies/magie-de-la-necromancie#sort:fer-toxique', 'Fer Toxique', 'magies/magie-de-la-necromancie'],
  ['magies/magie-de-la-terre#sort:fer-raffine', 'Fer Raffiné', 'magies/magie-de-la-terre'],
  ['magies/magie-de-leau#sort:fer-humide', 'Fer Humide', 'magies/magie-de-leau'],
  ['magies/magie-de-lespace-temps#sort:fer-temporel', 'Fer Temporel', 'magies/magie-de-lespace-temps'],
  ['magies/magie-de-lombre#sort:fer-obscur', 'Fer Obscur', 'magies/magie-de-lombre'],
  ['magies/magie-du-feu#sort:fer-brulant', 'Fer brûlant', 'magies/magie-du-feu'],
  ['magies/magie-du-sang#sort:fer-sanglant', 'Fer Sanglant', 'magies/magie-du-sang'],
  ['magies/magie-du-vent#sort:fer-eolien', 'Fer éolien', 'magies/magie-du-vent'],
  ['magies/magie-du-vide#sort:fer-vide', 'Fer Vide', 'magies/magie-du-vide'],
];

// Les sorts « Fer » (« Les sorts "fer" sont utilisable sur les armes élémentaire mais il faut évidemment qu'il soit du même élement ») se reconnaissent
// par leur étiquette « Sort fer » (sort_mot_cle 'sort-fer', décision R164, migration 0079), jamais par leur nom.
test('R167 : les 13 sorts « Fer » portent l’étiquette « Sort fer » (un par magie, ni l’Arcane ni le Potentiel Illimité)', () => {
  const marques = tout("SELECT s.id, s.magie_id, s.niveau FROM sort_mot_cle m JOIN sort s ON s.id = m.sort_id WHERE m.mot_cle_id = 'sort-fer' ORDER BY s.id");
  assert.deepEqual(marques.map((s) => [s.id, h.valeurDImport('sort', { id: s.id }, 'nom'), s.magie_id]), SORTS_FER);
  assert.ok(marques.every((s) => s.niveau === 2));
  for (const [id] of SORTS_FER) assert.match(h.valeurDImport('sort', { id }, 'type_brut'), /^Amplification/);
  // à l'import, aucun autre sort ne s'appelle « Fer … »
  const autres = h.lignesDImport('sort').filter((s) => /^Fer /i.test(s.nom) && !SORTS_FER.some(([id]) => id === s.id));
  assert.deepEqual(autres.map((s) => s.id), []);
  assert.deepEqual(marques.filter((s) => ['magies/magie-de-larcane', 'magies/potentiel-illimite'].includes(s.magie_id)), []);
  // pas de marque dans la table sort : l'étiquette suffit
  assert.ok(!tout("SELECT name FROM pragma_table_info('sort')").some((c) => c.name === 'fer'));
});

// Fiches : une copie de la base construite
const copie = fichierTemporaire('maverick.db', 'armes-elementaires');
copyFileSync(cheminBase({ sansExemples: false }), copie);
const fiches = new DatabaseSync(copie);
after(() => fiches.close());
fiches.exec('PRAGMA foreign_keys = ON');
const inserer = (table, ligne) => {
  const cols = Object.keys(ligne);
  fiches.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
};
const INSTANT = '2026-10-23T12:00:00Z';
inserer('utilisateur', { id: 'r167', discord_id: '100000000000000167', nom_affichage: 'r167', cree_le: INSTANT });
const personnage = (id, magies) => inserer('personnage', {
  id, nature: 'joueur', proprietaire_id: 'r167', visibilite: 'privee', nom: `Fiche ${id}`, race_id: 'races/humain',
  ethnie_id: 'races/humain#ethnie:humain-central', mode_classe: 'mono', xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0,
  alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 12, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT, ...magies,
});
const REGLES_DES_ARMES = ['amelioration_cible', 'arme_elementaire_hors_magie', 'arme_type_degats_choisi'];
const controleDesArmes = (id) => fiches.prepare('SELECT regle, detail FROM v_personnage_controle WHERE personnage_id = ? ORDER BY regle, detail').all(id)
  .filter((r) => REGLES_DES_ARMES.includes(r.regle)).map((r) => ({ ...r }));
const un = (sql, ...p) => fiches.prepare(sql).get(...p);
const ARC = un("SELECT id FROM arme WHERE famille_id = 'arc' ORDER BY ordre LIMIT 1").id;
const MATERIAU = un('SELECT ressource_id AS id FROM materiau_arme ORDER BY ordre LIMIT 1').id;
const ARC_DE_FEU = un("SELECT id FROM arme_elementaire WHERE type_id = 'arc' AND magie_id = 'magies/magie-du-feu'").id;
const ARC_DE_SANG = un("SELECT id FROM arme_elementaire WHERE type_id = 'arc' AND magie_id = 'magies/magie-du-sang'").id;
const ARC_DE_GLACE = un("SELECT id FROM arme_elementaire WHERE type_id = 'arc' AND magie_id = 'magies/magie-de-la-glace'").id;
const amelioration = (cible, niveau) => un('SELECT id FROM amelioration_equipement WHERE cible = ? AND niveau = ?', cible, niveau).id;

test('R167 : personnage_arme porte soit une arme du catalogue (avec matériau), soit une arme élémentaire (sans matériau), et un seul niveau', () => {
  personnage('modele', { magie_innee_id: 'magies/magie-du-feu' });
  assert.deepEqual(fiches.prepare('PRAGMA table_info(personnage_arme)').all().map((c) => c.name),
    ['personnage_id', 'rang', 'arme_id', 'materiau_id', 'amelioration_id', 'arme_elementaire_id', 'effet_en_plus', 'durabilite', 'type_degats_choisi']);
  inserer('personnage_arme', { personnage_id: 'modele', rang: 1, arme_id: ARC, materiau_id: MATERIAU, amelioration_id: amelioration('arme', 5) });
  inserer('personnage_arme', { personnage_id: 'modele', rang: 2, arme_elementaire_id: ARC_DE_FEU, amelioration_id: amelioration('arme', 10), durabilite: 6 });
  assert.deepEqual(controleDesArmes('modele'), []);
  fiches.prepare("DELETE FROM personnage_arme WHERE personnage_id = 'modele' AND rang = 2").run();
  // ni les deux, ni aucune ; pas de matériau sur une arme élémentaire
  assert.throws(() => inserer('personnage_arme', { personnage_id: 'modele', rang: 2, arme_id: ARC, arme_elementaire_id: ARC_DE_FEU }), /CHECK/);
  assert.throws(() => inserer('personnage_arme', { personnage_id: 'modele', rang: 2, amelioration_id: amelioration('arme', 1) }), /CHECK/);
  assert.throws(() => inserer('personnage_arme', { personnage_id: 'modele', rang: 2, arme_elementaire_id: ARC_DE_FEU, materiau_id: MATERIAU }), /CHECK/);
  // l'amélioration d'une arme élémentaire est une ligne du tableau fondu (cible 'arme') : une autre cible est signalée
  inserer('personnage_arme', { personnage_id: 'modele', rang: 2, arme_elementaire_id: ARC_DE_FEU, amelioration_id: amelioration('armure', 1) });
  assert.deepEqual(controleDesArmes('modele'), [{ regle: 'amelioration_cible', detail: `2 : ${amelioration('armure', 1)}` }]);
});

test('R167 : une arme élémentaire d’une magie que le personnage n’a ni en innée ni en acquise est signalée (arme_elementaire_hors_magie)', () => {
  personnage('magies', { magie_innee_id: 'magies/magie-du-feu', magie_acquise_id: 'magies/magie-du-sang' });
  inserer('personnage_arme', { personnage_id: 'magies', rang: 1, arme_elementaire_id: ARC_DE_FEU });
  inserer('personnage_arme', { personnage_id: 'magies', rang: 2, arme_elementaire_id: ARC_DE_SANG });
  assert.deepEqual(controleDesArmes('magies'), []);
  fiches.prepare("UPDATE personnage_arme SET arme_elementaire_id = ? WHERE personnage_id = 'magies' AND rang = 2").run(ARC_DE_GLACE);
  assert.deepEqual(controleDesArmes('magies'), [{ regle: 'arme_elementaire_hors_magie', detail: `2 : ${ARC_DE_GLACE}` }]);
  fiches.prepare("UPDATE personnage SET magie_acquise_id = NULL WHERE id = 'magies'").run();
  fiches.prepare("UPDATE personnage_arme SET arme_elementaire_id = ? WHERE personnage_id = 'magies' AND rang = 2").run(ARC_DE_SANG);
  assert.deepEqual(controleDesArmes('magies'), [{ regle: 'arme_elementaire_hors_magie', detail: `2 : ${ARC_DE_SANG}` }]);
  // le Potentiel Illimité n'ouvre aucune arme élémentaire (R167 : « de ses magies (innée et acquise, sans le Potentiel Illimité) »)
  personnage('pi', { magie_innee_id: 'magies/potentiel-illimite', magie_acquise_id: 'magies/magie-du-feu' });
  inserer('personnage_arme', { personnage_id: 'pi', rang: 1, arme_elementaire_id: ARC_DE_FEU });
  inserer('personnage_arme', { personnage_id: 'pi', rang: 2, arme_elementaire_id: ARC_DE_SANG });
  assert.deepEqual(controleDesArmes('pi'), [{ regle: 'arme_elementaire_hors_magie', detail: `2 : ${ARC_DE_SANG}` }]);
  // une arme du catalogue n'est pas concernée
  fiches.prepare("UPDATE personnage_arme SET arme_elementaire_id = NULL, arme_id = ? WHERE personnage_id = 'pi' AND rang = 2").run(ARC);
  assert.deepEqual(controleDesArmes('pi'), []);
});

test('R167 : le type physique choisi d’une bombe élémentaire (« Au choix ») ; ailleurs, signalé (arme_type_degats_choisi) ou refusé (arme du catalogue)', () => {
  const BOMBE_DE_FEU = un("SELECT id FROM arme_elementaire WHERE type_id = 'bombe' AND magie_id = 'magies/magie-du-feu'").id;
  personnage('choix', { magie_innee_id: 'magies/magie-du-feu' });
  // sans choix : rien à signaler (seul le type de la magie compte) ; un des trois types de la bombe : rien non plus
  inserer('personnage_arme', { personnage_id: 'choix', rang: 1, arme_elementaire_id: BOMBE_DE_FEU });
  assert.deepEqual(controleDesArmes('choix'), []);
  for (const t of ['estoc', 'frappe', 'taille']) {
    fiches.prepare("UPDATE personnage_arme SET type_degats_choisi = ? WHERE personnage_id = 'choix' AND rang = 1").run(t);
    assert.deepEqual(controleDesArmes('choix'), [], t);
  }
  assert.throws(() => fiches.prepare("UPDATE personnage_arme SET type_degats_choisi = 'feu' WHERE personnage_id = 'choix' AND rang = 1").run(), /CHECK/);
  // un choix sur une arme élémentaire dont le type ne se choisit pas (l'arc : estoc, qui s'applique toujours) est signalé, pas refusé
  inserer('personnage_arme', { personnage_id: 'choix', rang: 2, arme_elementaire_id: ARC_DE_FEU, type_degats_choisi: 'estoc' });
  assert.deepEqual(controleDesArmes('choix'), [{ regle: 'arme_type_degats_choisi', detail: '2 : estoc' }]);
  // une arme du catalogue n'a pas de type choisi : refusé
  fiches.prepare("DELETE FROM personnage_arme WHERE personnage_id = 'choix' AND rang = 2").run();
  assert.throws(() => inserer('personnage_arme', { personnage_id: 'choix', rang: 2, arme_id: ARC, type_degats_choisi: 'estoc' }), /CHECK/);
});

test('R167 : une famille créée comme le fait le site de dev (R159, sans type élémentaire) n’en a aucun ; ARME DE MONSTRES n’en reçoit pas (CHECK), dans la copie', () => {
  // les colonnes qu'écrit la création d'une famille (serveur/edition-armes.mjs#ARME_FAMILLE.creer) : pas type_elementaire_id
  const ordre = un('SELECT max(ordre) AS m FROM arme_famille').m + 1;
  inserer('arme_famille', {
    id: 'famille-r167', libelle_brut: 'FAMILLE R167 - D8', nom: 'FAMILLE R167', de_brut: 'D8', note_brut: null, cout_libelle: 'Coût', ordre,
    origine: 'equipement', source_ref: 'Site de dev › édition du 2026-10-23 › FAMILLE R167', remarque: null, maitrisable: 1, categorie: 'contact',
    nom_lecture: 'FAMILLE R167',
  });
  assert.equal(un("SELECT type_elementaire_id AS t FROM arme_famille WHERE id = 'famille-r167'").t, null);
  assert.deepEqual(fiches.prepare("SELECT ae.id FROM arme_famille f JOIN arme_elementaire ae ON ae.type_id = f.type_elementaire_id WHERE f.id = 'famille-r167'").all(), []);
  // une famille sans maîtrise (ARME DE MONSTRES, R45) ne reçoit pas de type élémentaire ; un type inconnu non plus
  assert.throws(() => fiches.prepare("UPDATE arme_famille SET type_elementaire_id = 'epee' WHERE maitrisable = 0").run(), /CHECK/);
  assert.throws(() => fiches.prepare("UPDATE arme_famille SET type_elementaire_id = 'masse-hache' WHERE id = 'famille-r167'").run(), /FOREIGN KEY/);
});
