// Fiches de personnages dans la base (section 13 de data/schema.sql, migration 0011-personnages) : les tables gardent les CHOIX du joueur, les
// vues v_personnage_niveau (décision R2) et v_personnage_controle (règles de la base) en tirent niveaux et erreurs ; fiches de joueur et prétirés,
// groupes de jeu et visibilité (demande du propriétaire) : v_personnage_visible, v_groupe_controle. Les tests écrivent dans une COPIE de la base
// construite : data/rows garde ces tables vides.
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';

const racine = trouverRacine();
const copie = join(mkdtempSync(join(tmpdir(), 'maverick-personnages-')), 'maverick.db');
copyFileSync(cheminBase({ sansExemples: false }), copie);
const db = new DatabaseSync(copie);
db.exec('PRAGMA foreign_keys = ON');

const TABLES = [
  'utilisateur', 'utilisateur_role', 'personnage', 'personnage_partage', 'personnage_classe', 'personnage_caracteristique', 'personnage_competence',
  'personnage_progression', 'personnage_capacite', 'personnage_sort', 'personnage_maitrise_arme', 'personnage_arme', 'personnage_armure',
  'personnage_bouclier_materiau', 'personnage_accessoire', 'personnage_inventaire', 'groupe', 'groupe_membre',
];
const INSTANT = '2026-10-09T12:00:00Z';
const controle = (id) => db.prepare('SELECT regle, detail FROM v_personnage_controle WHERE personnage_id = ? ORDER BY regle, detail').all(id).map((r) => ({ ...r }));
const regles = (id) => [...new Set(controle(id).map((r) => r.regle))].sort();
const niveau = (id) => ({ ...db.prepare('SELECT niveau_global, niveau_classe_1, niveau_classe_2 FROM v_personnage_niveau WHERE personnage_id = ?').get(id) });

function inserer(table, ligne) {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}

// Lignes de la base construite, avant les fiches de ce test (data/rows les garde vides).
const LIGNES_AU_DEPART = Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n]));

// Utilisateurs : quatre joueurs, une MJ (rôle 'mj') et un administrateur ; « eve » est un compte local de secours (sans Discord).
const UTILISATEURS = { alice: [], bob: [], dan: [], eve: [], claire: ['mj'], root: ['admin'] };
for (const [i, [id, roles]] of Object.entries(UTILISATEURS).entries()) {
  inserer('utilisateur', { id, discord_id: id === 'eve' ? null : `10000000000000000${i}`, nom_affichage: id, cree_le: INSTANT });
  for (const role of roles) inserer('utilisateur_role', { utilisateur_id: id, role });
}
const voit = (utilisateur, personnage) => db.prepare('SELECT motif FROM v_personnage_visible WHERE utilisateur_id = ? AND personnage_id = ? ORDER BY motif').all(utilisateur, personnage).map((r) => r.motif);
const spectateurs = (personnage) => [...new Set(db.prepare('SELECT utilisateur_id FROM v_personnage_visible WHERE personnage_id = ?').all(personnage).map((r) => r.utilisateur_id))].sort();

/** Personnage de niveau 1 conforme : Humain central, Guerrier, Feu inné ; 14 points de caractéristiques, 100 points de compétences (5 × 20). */
function personnageValide(id, surcharge = {}) {
  inserer('personnage', {
    id, nature: 'joueur', proprietaire_id: 'alice', visibilite: 'privee',
    statut: 'valide', nom: `Fiche ${id}`, race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central',
    magie_innee_id: 'magies/magie-du-feu', mode_classe: 'mono', xp: 0,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
    bourse_pp: 0, bourse_ro: 12, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT, ...surcharge,
  });
  inserer('personnage_classe', { personnage_id: id, rang: 1, classe_id: 'classes/guerrier' });
  const bases = { force: 4, volonte: 2, intelligence: 2, perception: 2, social: 2, agilite: 2 };
  for (const [c, base] of Object.entries(bases)) inserer('personnage_caracteristique', { personnage_id: id, caracteristique_id: c, base, croix: 0 });
  for (const c of ['arc', 'arme-lourde', 'athletisme', 'parade', 'stabilite']) inserer('personnage_competence', { personnage_id: id, competence_id: c, naturel: 20, acquis: 0 });
}

test('les 18 tables des fiches et des groupes existent et data/rows les garde vides (les fiches réelles vivent dans la base du serveur)', () => {
  for (const t of TABLES) {
    assert.equal(LIGNES_AU_DEPART[t], 0, t);
    const lignes = readFileSync(join(racine, 'data', 'rows', `${t}.sql`), 'utf8').trim().split('\n');
    assert.equal(lignes.length, 1, `${t} : en-tête seul`);
    assert.ok(db.prepare('SELECT 1 FROM pragma_table_info(?) WHERE name = ?').get(t, 'remarque') === undefined, `${t} : pas de colonne remarque (réservée aux entités des classeurs)`);
  }
});

test('niveau global et niveaux de classe (décision R2) : mono-classe 2 niveaux de classe par niveau, plafonnés à 20, l’excédent en classe 2', () => {
  const cas = [
    { xp: 0, mode: 'mono', attendu: { niveau_global: 1, niveau_classe_1: 2, niveau_classe_2: 0 } },
    { xp: 199, mode: 'mono', attendu: { niveau_global: 1, niveau_classe_1: 2, niveau_classe_2: 0 } },
    { xp: 200, mode: 'mono', attendu: { niveau_global: 2, niveau_classe_1: 4, niveau_classe_2: 0 } },
    { xp: 11450, mode: 'mono', attendu: { niveau_global: 10, niveau_classe_1: 20, niveau_classe_2: 0 } },
    { xp: 17050, mode: 'mono', attendu: { niveau_global: 11, niveau_classe_1: 20, niveau_classe_2: 2 } },
    { xp: 460250, mode: 'mono', attendu: { niveau_global: 20, niveau_classe_1: 20, niveau_classe_2: 20 } },
    { xp: 17050, mode: 'bi', attendu: { niveau_global: 11, niveau_classe_1: 11, niveau_classe_2: 11 } },
    { xp: 9999999, mode: 'bi', attendu: { niveau_global: 20, niveau_classe_1: 20, niveau_classe_2: 20 } },
  ];
  for (const [i, c] of cas.entries()) {
    const id = `niveau-${i}`;
    inserer('personnage', {
      id, nature: 'joueur', proprietaire_id: 'alice', visibilite: 'privee',
      statut: 'brouillon', nom: id, mode_classe: c.mode, xp: c.xp, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
      bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT,
    });
    assert.deepEqual(niveau(id), c.attendu, `${c.xp} XP, ${c.mode}`);
  }
});

test('une fiche conforme de niveau 1 n’a aucune ligne de contrôle', () => {
  personnageValide('conforme');
  assert.deepEqual(controle('conforme'), []);
});

test('race, ethnie, magies : classe et magie innée hors matrice, ethnie d’une autre race ou d’une autre magie, magies incompatibles, mono-magie', () => {
  personnageValide('race-1', { ethnie_id: 'races/orios#ethnie:orios-de-sang' });
  assert.deepEqual(regles('race-1'), ['ethnie_hors_race', 'ethnie_magie']);

  personnageValide('race-2', { magie_acquise_id: 'magies/magie-de-larcane', magie_innee_id: 'magies/magie-de-la-corruption' });
  assert.deepEqual(regles('race-2'), ['magies_incompatibles', 'mono_magie']);

  // Corruption : mono-magie sauf Elfe Noir Charbon (décision R15) ; l'incompatibilité avec l'Arcane reste
  personnageValide('race-3', {
    race_id: 'races/elfe-noir', ethnie_id: 'races/elfe-noir#ethnie:elfe-noir-charbon',
    magie_innee_id: 'magies/magie-de-la-corruption', magie_acquise_id: 'magies/magie-du-feu',
  });
  assert.ok(!regles('race-3').includes('mono_magie'), regles('race-3').join());
  db.prepare("UPDATE personnage SET ethnie_id = 'races/elfe-noir#ethnie:elfe-noir-sale' WHERE id = 'race-3'").run();
  assert.ok(regles('race-3').includes('mono_magie'), 'Elfe Noir Salé : erreur de la fiche (R15)');

  // Le Nain : l'onglet de la race prime sur la matrice (R11)
  const nainHorsOnglet = db.prepare(`SELECT rm.magie_id FROM race_magie rm WHERE rm.race_id = 'races/nain' AND rm.accessible = 1
    AND rm.magie_id NOT IN (SELECT magie_id FROM race_magie_onglet WHERE race_id = 'races/nain')`).get();
  if (nainHorsOnglet) {
    personnageValide('race-4', { race_id: 'races/nain', ethnie_id: db.prepare("SELECT id FROM ethnie WHERE race_id = 'races/nain' LIMIT 1").get().id, magie_innee_id: nainHorsOnglet.magie_id });
    assert.ok(regles('race-4').includes('magie_innee_inaccessible'));
  }

  personnageValide('race-5', { magie_innee_id: 'magies/potentiel-illimite' });
  assert.deepEqual(regles('race-5'), ['caracteristique_magie'], 'Potentiel Illimité : le point de caractéristique est à choisir');
  db.prepare("UPDATE personnage SET caracteristique_magie_id = 'force' WHERE id = 'race-5'").run();
  assert.deepEqual(regles('race-5'), []);

  const classeInterdite = db.prepare("SELECT classe_id FROM race_classe WHERE race_id = 'races/humain' AND accessible = 0 LIMIT 1").get();
  personnageValide('race-6');
  db.prepare('UPDATE personnage_classe SET classe_id = ? WHERE personnage_id = ?').run(classeInterdite.classe_id, 'race-6');
  assert.deepEqual(regles('race-6'), ['classe_inaccessible']);
});

test('caractéristiques et compétences : bornes, totaux exacts (décision R3), plafonds du naturel et de l’acquis', () => {
  personnageValide('carac-1');
  db.prepare("UPDATE personnage_caracteristique SET base = 3 WHERE personnage_id = 'carac-1' AND caracteristique_id = 'force'").run();
  assert.deepEqual(controle('carac-1'), [{ regle: 'caracteristiques_total', detail: '13 / 14' }]);

  personnageValide('carac-2', { race_id: 'races/elfe-argente', ethnie_id: db.prepare("SELECT id FROM ethnie WHERE race_id = 'races/elfe-argente' LIMIT 1").get().id });
  assert.ok(regles('carac-2').includes('caracteristique_hors_bornes'), 'Elfe argenté : Force < 3');

  personnageValide('comp-1');
  db.prepare("UPDATE personnage_competence SET naturel = 25 WHERE personnage_id = 'comp-1' AND competence_id = 'arc'").run();
  db.prepare("UPDATE personnage_competence SET acquis = 11 WHERE personnage_id = 'comp-1' AND competence_id = 'parade'").run();   // Force 4 : au plus 20
  db.prepare("UPDATE personnage_competence SET acquis = 11 WHERE personnage_id = 'comp-1' AND competence_id = 'stabilite'").run();
  inserer('personnage_competence', { personnage_id: 'comp-1', competence_id: 'calme', naturel: 0, acquis: 11 });   // Volonté 2 : au plus 10
  assert.deepEqual(controle('comp-1'), [
    { regle: 'competence_acquis_max', detail: 'calme = 11' },
    { regle: 'competence_naturel_max', detail: 'arc = 25' },
    { regle: 'competences_total', detail: '105 / 100' },
  ]);
});

test('progression : un gain par niveau, 15 points d’attributs exactement, le dé aux niveaux 5, 10, 15 et 20 seulement', () => {
  personnageValide('prog', { xp: 1650 });   // niveau 5
  db.prepare("DELETE FROM personnage_competence WHERE personnage_id = 'prog'").run();
  for (const [c, n] of [['arc', 30], ['arme-lourde', 30], ['athletisme', 30], ['parade', 30], ['stabilite', 30], ['calme', 30], ['concentration', 20]]) {
    inserer('personnage_competence', { personnage_id: 'prog', competence_id: c, naturel: n, acquis: 0 });   // 100 + 20 + 20 + 20 + 40 = 200
  }
  db.prepare("UPDATE personnage_caracteristique SET base = 3 WHERE personnage_id = 'prog' AND caracteristique_id = 'volonte'").run();   // total 15 au niveau 5
  for (const n of [2, 3, 4]) inserer('personnage_progression', { personnage_id: 'prog', niveau: n, points_sante: 10, points_chakra: 5 });
  assert.deepEqual(controle('prog'), [{ regle: 'progression_manquante', detail: '5' }]);
  inserer('personnage_progression', { personnage_id: 'prog', niveau: 5, points_sante: 15, points_chakra: 0 });
  assert.deepEqual(controle('prog'), [{ regle: 'progression_de', detail: '5' }]);
  db.prepare("UPDATE personnage_progression SET de_choix = 'sante', de_resultat = 6 WHERE personnage_id = 'prog' AND niveau = 5").run();
  db.prepare("UPDATE personnage_progression SET points_chakra = 6 WHERE personnage_id = 'prog' AND niveau = 2").run();
  inserer('personnage_progression', { personnage_id: 'prog', niveau: 6, points_sante: 15, points_chakra: 0 });
  assert.deepEqual(controle('prog'), [
    { regle: 'progression_niveau_non_atteint', detail: '6' },
    { regle: 'progression_points', detail: '2 : 16 / 15' },
  ]);
});

test('classes, spécialités et dons : 2e classe selon R2, spécialité au niveau de classe 10, dons de la classe et jamais deux options exclusives', () => {
  personnageValide('classe-1', { xp: 17050 });   // niveau 11 en mono-classe : classe 2 au niveau 2
  assert.ok(regles('classe-1').includes('classe_2_manquante'));

  personnageValide('classe-2');
  inserer('personnage_classe', { personnage_id: 'classe-2', rang: 2, classe_id: 'classes/archer' });
  db.prepare("UPDATE personnage_classe SET specialite_id = 'classes/guerrier#specialite:epeiste' WHERE personnage_id = 'classe-2' AND rang = 1").run();
  inserer('personnage_capacite', { personnage_id: 'classe-2', capacite_id: 'capacites/guerrier-affute' });
  inserer('personnage_capacite', { personnage_id: 'classe-2', capacite_id: 'capacites/guerrier-expert-mordhau' });
  inserer('personnage_capacite', { personnage_id: 'classe-2', capacite_id: 'capacites/guerrier-bien-equipe' });   // spécialité Maître d'arme
  assert.deepEqual(regles('classe-2'), ['capacite_hors_classe', 'capacites_exclusives', 'classe_2_en_trop', 'specialite_trop_tot']);

  assert.throws(() => db.prepare("UPDATE personnage_classe SET specialite_id = 'classes/archer#specialite:x' WHERE personnage_id = 'classe-2' AND rang = 1").run(), /FOREIGN KEY/);
  const autre = db.prepare("SELECT id FROM specialite WHERE classe_id = 'classes/archer' LIMIT 1").get().id;
  assert.throws(() => db.prepare('UPDATE personnage_classe SET specialite_id = ? WHERE personnage_id = ? AND rang = 1').run(autre, 'classe-2'), /FOREIGN KEY/, 'une spécialité d’une autre classe');
});

test('sorts : de la magie du personnage, NM au plus niveau global − 1 et au plus les NM gagnés', () => {
  personnageValide('sorts', { xp: 550 });   // niveau 3 : 2 NM gagnés, NM max 2
  db.prepare("UPDATE personnage_competence SET naturel = 20 WHERE personnage_id = 'sorts'").run();
  for (const c of ['calme', 'concentration']) inserer('personnage_competence', { personnage_id: 'sorts', competence_id: c, naturel: 20, acquis: 0 });   // 100 + 20 + 20
  for (const n of [2, 3]) inserer('personnage_progression', { personnage_id: 'sorts', niveau: n, points_sante: 15, points_chakra: 0 });
  inserer('personnage_sort', { personnage_id: 'sorts', sort_id: 'magies/magie-du-feu#sort:boule-de-feu', rang: 1, niveau_maitrise: 2 });
  assert.deepEqual(controle('sorts'), []);
  inserer('personnage_sort', { personnage_id: 'sorts', sort_id: 'magies/magie-du-feu#sort:cauterisation', rang: 2, niveau_maitrise: 3 });
  const glace = db.prepare("SELECT id FROM sort WHERE magie_id = 'magies/magie-de-la-glace' AND niveau = 1 LIMIT 1").get().id;
  inserer('personnage_sort', { personnage_id: 'sorts', sort_id: glace, rang: 3, niveau_maitrise: 0 });
  assert.deepEqual(regles('sorts'), ['sort_hors_magie', 'sort_nm_max', 'sorts_nm_total']);
});

test('équipement : matériaux du bouclier au plus sa classe, améliorations du bon genre, valeur d’accessoire dans la fourchette', () => {
  personnageValide('equipement', { bouclier_classe_id: 'targe' });
  const classe = db.prepare("SELECT classe FROM bouclier_classe WHERE id = 'targe'").get().classe;
  const [m1, m2] = db.prepare('SELECT ressource_id FROM materiau_bouclier ORDER BY ordre LIMIT 2').all().map((r) => r.ressource_id);
  inserer('personnage_bouclier_materiau', { personnage_id: 'equipement', rang: 1, materiau_id: m1, quantite: classe });
  assert.deepEqual(controle('equipement'), []);
  inserer('personnage_bouclier_materiau', { personnage_id: 'equipement', rang: 2, materiau_id: m2, quantite: 1 });
  assert.deepEqual(controle('equipement'), [{ regle: 'bouclier_quantite', detail: `${classe + 1} / ${classe}` }]);
  db.prepare("DELETE FROM personnage_bouclier_materiau WHERE personnage_id = 'equipement' AND rang = 2").run();

  const arme = db.prepare('SELECT id FROM arme LIMIT 1').get().id;
  const amelioArmure = db.prepare("SELECT id FROM amelioration_equipement WHERE cible = 'armure' LIMIT 1").get().id;
  inserer('personnage_arme', { personnage_id: 'equipement', rang: 1, arme_id: arme, amelioration_id: amelioArmure });
  const effet = db.prepare('SELECT id, bonus_min, bonus_max FROM accessoire_effet WHERE bonus_min IS NOT NULL LIMIT 1').get();
  inserer('personnage_accessoire', { personnage_id: 'equipement', emplacement: 'collier', accessoire_effet_id: effet.id, valeur: effet.bonus_max + 1, maudit: 0 });
  assert.deepEqual(regles('equipement'), ['accessoire_valeur', 'amelioration_cible']);
});

test('contraintes : magie acquise ≠ magie innée, fiche validée avec race et magie, valeurs bornées, suppression en cascade', () => {
  assert.throws(() => personnageValide('ko-1', { magie_acquise_id: 'magies/magie-du-feu' }), /CHECK/);
  assert.throws(() => personnageValide('ko-2', { race_id: null, ethnie_id: null }), /CHECK/);
  assert.throws(() => personnageValide('ko-3', { modifie_le: '2026-10-08T12:00:00Z' }), /CHECK/, 'modifié avant d’être créé');
  assert.throws(() => personnageValide('ko-4', { cree_le: '9 octobre 2026', modifie_le: '9 octobre 2026' }), /CHECK/);
  personnageValide('cascade');
  assert.throws(() => inserer('personnage_maitrise_arme', { personnage_id: 'cascade', arme_famille_id: 'epees', des: 6 }), /CHECK/);
  inserer('personnage_maitrise_arme', { personnage_id: 'cascade', arme_famille_id: 'epees', des: 2 });
  inserer('personnage_inventaire', { personnage_id: 'cascade', rang: 1, nom: 'Corde (5m)', quantite: 1 });
  db.prepare("DELETE FROM personnage WHERE id = 'cascade'").run();
  for (const t of TABLES.filter((t) => t.startsWith('personnage_'))) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${t} WHERE personnage_id = 'cascade'`).get().n, 0, t);
  }
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});

test('la vue repère les fiches « valide » fautives de ce fichier, jamais la fiche conforme', () => {
  const fautives = db.prepare("SELECT DISTINCT c.personnage_id FROM v_personnage_controle c JOIN personnage p ON p.id = c.personnage_id WHERE p.statut = 'valide'").all().map((r) => r.personnage_id);
  assert.ok(fautives.length > 0 && !fautives.includes('conforme'));
});

test('sorts : le Potentiel Illimité pioche dans toutes les magies ; NPM au plus la puissance magique du niveau, la 5 au niveau 16 sans magie acquise (décision R16)', () => {
  const brouillon = (id, xp, surcharge = {}) => inserer('personnage', {
    id, nature: 'joueur', proprietaire_id: 'alice', visibilite: 'privee', statut: 'brouillon', nom: id, race_id: 'races/humain',
    ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', mode_classe: 'mono', xp,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT, ...surcharge,
  });
  const npm5 = db.prepare("SELECT id FROM sort WHERE magie_id = 'magies/magie-du-feu' AND niveau = 5 ORDER BY id LIMIT 1").get().id;
  const npm = (n) => db.prepare("SELECT id FROM sort WHERE magie_id = 'magies/magie-de-la-glace' AND niveau = ? ORDER BY id LIMIT 1").get(n).id;
  const cas = [
    { id: 'npm-16', xp: 95450, sort: npm5, attendu: false },                                                   // niveau 16, mono-magie
    { id: 'npm-15', xp: 69850, sort: npm5, attendu: true },                                                    // niveau 15 : puissance 4
    { id: 'npm-16-bi', xp: 95450, sort: npm5, attendu: true, surcharge: { magie_acquise_id: 'magies/magie-de-leau' } },   // « non disponible avec une magie acquise »
    { id: 'npm-4', xp: 950, sort: npm(2), attendu: false, surcharge: { magie_innee_id: 'magies/magie-de-la-glace' } },
    { id: 'npm-3', xp: 550, sort: npm(2), attendu: true, surcharge: { magie_innee_id: 'magies/magie-de-la-glace' } },
  ];
  for (const c of cas) {
    brouillon(c.id, c.xp, c.surcharge);
    inserer('personnage_sort', { personnage_id: c.id, sort_id: c.sort, rang: 1, niveau_maitrise: 0 });
    assert.equal(regles(c.id).includes('sort_puissance'), c.attendu, c.id);
  }
  brouillon('potentiel', 0, { magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'force' });
  inserer('personnage_sort', { personnage_id: 'potentiel', sort_id: 'magies/magie-du-feu#sort:boule-de-feu', rang: 1, niveau_maitrise: 0 });
  assert.ok(!regles('potentiel').includes('sort_hors_magie'), 'le Potentiel Illimité pioche ses sorts dans toutes les magies');
});

test('décision R20 : l’Elfe Noir Charbon et le Felfe Noir peuvent acquérir la Corruption (pas les autres), les incompatibilités restent', () => {
  personnageValide('r20-felfe-noir', { race_id: 'races/felfe', ethnie_id: 'races/felfe#ethnie:felfe-noir', magie_acquise_id: 'magies/magie-de-la-corruption' });
  assert.ok(!regles('r20-felfe-noir').some((r) => r === 'mono_magie' || r === 'magies_incompatibles'), regles('r20-felfe-noir').join());
  personnageValide('r20-charbon', {
    race_id: 'races/elfe-noir', ethnie_id: 'races/elfe-noir#ethnie:elfe-noir-charbon', magie_acquise_id: 'magies/magie-de-la-corruption',
  });
  assert.ok(!regles('r20-charbon').includes('mono_magie'), regles('r20-charbon').join());
  personnageValide('r20-felfe-argente', { race_id: 'races/felfe', ethnie_id: 'races/felfe#ethnie:felfe-argente', magie_acquise_id: 'magies/magie-de-la-corruption' });
  assert.ok(regles('r20-felfe-argente').includes('mono_magie'), 'une autre ethnie ne combine pas la Corruption');
  personnageValide('r20-arcane', {
    race_id: 'races/elfe-noir', ethnie_id: 'races/elfe-noir#ethnie:elfe-noir-charbon',
    magie_innee_id: 'magies/magie-de-larcane', magie_acquise_id: 'magies/magie-de-la-corruption',
  });
  assert.ok(regles('r20-arcane').includes('magies_incompatibles'), 'Arcane et Corruption restent incompatibles');
});

test('décision R19 : jusqu’à deux croix par caractéristique, la règle du guide et les malus de la fiche', () => {
  personnageValide('croix');
  db.prepare("UPDATE personnage_caracteristique SET croix = 2 WHERE personnage_id = 'croix' AND caracteristique_id = 'force'").run();
  assert.deepEqual(controle('croix'), [], 'une croix est un état, pas une erreur de fiche');
  assert.throws(() => db.prepare("UPDATE personnage_caracteristique SET croix = 3 WHERE personnage_id = 'croix' AND caracteristique_id = 'force'").run(), /CHECK/);
  const malus = Object.fromEntries(db.prepare("SELECT id, valeur FROM regle_constante WHERE id LIKE 'competence.croix_%'").all().map((r) => [r.id, r.valeur]));
  assert.deepEqual(malus, { 'competence.croix_1_malus': -20, 'competence.croix_2_malus': -1000 });
  const page = db.prepare("SELECT corps_md FROM page WHERE id = 'guide/fiche-caracteristiques'").get().corps_md;
  assert.match(page, /1 croix, malus de 20% pour tout test en rapport avec cette caractéristique\./);
  assert.match(page, /2 croix, impossibilité d'utiliser les compétences liées à cette caractéristique\./);
});

test('fiche de joueur ou prétiré : le prétiré n’est à personne et tout le monde le voit ; la fiche d’un joueur a son propriétaire', () => {
  const fiche = (id, surcharge) => inserer('personnage', {
    id, statut: 'brouillon', nom: id, mode_classe: 'mono', xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
    bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT, ...surcharge,
  });
  fiche('pretire-1', { nature: 'pretire', proprietaire_id: null, visibilite: 'tous' });
  assert.deepEqual(spectateurs('pretire-1'), Object.keys(UTILISATEURS).sort(), 'visible par tous');
  assert.throws(() => fiche('ko-pretire-1', { nature: 'pretire', proprietaire_id: 'alice', visibilite: 'tous' }), /CHECK/, 'un prétiré n’est à personne');
  assert.throws(() => fiche('ko-pretire-2', { nature: 'pretire', proprietaire_id: null, visibilite: 'privee' }), /CHECK/, 'un prétiré est visible par tous');
  assert.throws(() => fiche('ko-joueur', { nature: 'joueur', proprietaire_id: null, visibilite: 'privee' }), /CHECK/, 'une fiche de joueur a son propriétaire');
  assert.throws(() => fiche('ko-visibilite', { nature: 'joueur', proprietaire_id: 'alice', visibilite: 'groupe' }), /CHECK/);
});

test('visibilité d’une fiche de joueur : lui seul et les administrateurs, puis tous les MJ, des utilisateurs désignés, tout le monde', () => {
  personnageValide('vis');
  assert.deepEqual(spectateurs('vis'), ['alice', 'root']);
  assert.deepEqual(voit('alice', 'vis'), ['proprietaire']);
  assert.deepEqual(voit('root', 'vis'), ['admin']);
  db.prepare("UPDATE personnage SET visibilite = 'mj' WHERE id = 'vis'").run();
  assert.deepEqual(spectateurs('vis'), ['alice', 'claire', 'root']);
  assert.deepEqual(voit('claire', 'vis'), ['mj']);
  inserer('personnage_partage', { personnage_id: 'vis', utilisateur_id: 'bob' });
  inserer('personnage_partage', { personnage_id: 'vis', utilisateur_id: 'eve' });
  assert.deepEqual(spectateurs('vis'), ['alice', 'bob', 'claire', 'eve', 'root']);
  assert.deepEqual(voit('bob', 'vis'), ['partage']);
  assert.throws(() => inserer('personnage_partage', { personnage_id: 'vis', utilisateur_id: 'bob' }), /UNIQUE|PRIMARY/);
  db.prepare("UPDATE personnage SET visibilite = 'tous' WHERE id = 'vis'").run();
  assert.deepEqual(spectateurs('vis'), Object.keys(UTILISATEURS).sort());
  assert.deepEqual(voit('dan', 'vis'), ['tous']);
});

test('groupes de jeu : une fiche inscrite par membre et par groupe, visible des seuls membres de ce groupe ; en inscrire une autre désinscrit la première', () => {
  personnageValide('alice-a');
  personnageValide('alice-b');
  personnageValide('bob-a', { proprietaire_id: 'bob' });
  inserer('groupe', { id: 'campagne', nom: 'La campagne', nature: 'campagne', cree_le: INSTANT });
  inserer('groupe', { id: 'os', nom: 'Un one-shot', nature: 'one_shot', cree_le: INSTANT });
  assert.throws(() => inserer('groupe', { id: 'ko', nom: 'ko', nature: 'tournoi', cree_le: INSTANT }), /CHECK/);
  for (const [utilisateur_id, role, personnage_id] of [['claire', 'mj', null], ['alice', 'joueur', 'alice-a'], ['bob', 'joueur', null]]) {
    inserer('groupe_membre', { groupe_id: 'campagne', utilisateur_id, role, personnage_id, rejoint_le: INSTANT });
  }
  assert.deepEqual(spectateurs('alice-a'), ['alice', 'bob', 'claire', 'root'], 'inscrite : visible des membres du groupe');
  assert.deepEqual(voit('bob', 'alice-a'), ['groupe']);
  assert.equal(db.prepare("SELECT groupe_id FROM v_personnage_visible WHERE personnage_id = 'alice-a' AND utilisateur_id = 'bob'").get().groupe_id, 'campagne');
  assert.deepEqual(spectateurs('alice-b'), ['alice', 'root'], 'ses autres fiches restent cachées');
  assert.throws(() => inserer('groupe_membre', { groupe_id: 'campagne', utilisateur_id: 'alice', role: 'joueur', personnage_id: 'alice-b', rejoint_le: INSTANT }), /UNIQUE|PRIMARY/, 'une seule fiche par groupe');

  db.prepare("UPDATE groupe_membre SET personnage_id = 'alice-b' WHERE groupe_id = 'campagne' AND utilisateur_id = 'alice'").run();
  assert.deepEqual(spectateurs('alice-a'), ['alice', 'root'], 'la fiche remplacée est désinscrite');
  assert.deepEqual(spectateurs('alice-b'), ['alice', 'bob', 'claire', 'root']);

  // Un autre groupe : la fiche qu'on y inscrit n'est visible que de ses membres
  inserer('groupe_membre', { groupe_id: 'os', utilisateur_id: 'dan', role: 'mj', personnage_id: null, rejoint_le: INSTANT });
  inserer('groupe_membre', { groupe_id: 'os', utilisateur_id: 'alice', role: 'joueur', personnage_id: 'alice-a', rejoint_le: INSTANT });
  assert.deepEqual(spectateurs('alice-a'), ['alice', 'dan', 'root']);
  assert.deepEqual(spectateurs('alice-b'), ['alice', 'bob', 'claire', 'root'], 'dan ne voit pas la fiche de la campagne');

  // On inscrit sa propre fiche ou un prétiré
  assert.deepEqual(db.prepare('SELECT * FROM v_groupe_controle').all(), []);
  db.prepare("UPDATE groupe_membre SET personnage_id = 'alice-a' WHERE groupe_id = 'campagne' AND utilisateur_id = 'bob'").run();
  assert.deepEqual(db.prepare('SELECT groupe_id, utilisateur_id, regle, detail FROM v_groupe_controle').all().map((r) => ({ ...r })),
    [{ groupe_id: 'campagne', utilisateur_id: 'bob', regle: 'fiche_d_un_autre', detail: 'alice-a' }]);
  db.prepare("UPDATE groupe_membre SET personnage_id = 'pretire-1' WHERE groupe_id = 'campagne' AND utilisateur_id = 'bob'").run();
  assert.deepEqual(db.prepare('SELECT * FROM v_groupe_controle').all(), []);

  // Une fiche supprimée est désinscrite ; un groupe supprimé emporte ses membres
  db.prepare("DELETE FROM personnage WHERE id = 'alice-b'").run();
  assert.equal(db.prepare("SELECT personnage_id FROM groupe_membre WHERE groupe_id = 'campagne' AND utilisateur_id = 'alice'").get().personnage_id, null);
  db.prepare("DELETE FROM groupe WHERE id = 'os'").run();
  assert.equal(db.prepare("SELECT count(*) AS n FROM groupe_membre WHERE groupe_id = 'os'").get().n, 0);
  assert.deepEqual(spectateurs('alice-a'), ['alice', 'root']);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
