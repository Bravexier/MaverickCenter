// Fiches de personnages dans la base (section 13 de data/schema.sql, migration 0011-personnages) : les tables gardent les CHOIX du joueur, les
// vues v_personnage_niveau (décision R2) et v_personnage_controle (règles de la base) en tirent niveaux et erreurs ; fiches de joueur et prétirés,
// groupes de jeu et visibilité (demande du propriétaire) : v_personnage_visible, v_groupe_controle. Une fiche n'a plus de statut (migration
// 0038-personnage-sans-statut) : toute fiche, même inachevée, est contrôlée, et une ligne de contrôle signale sans empêcher d'enregistrer. Gains de
// niveau en deux totaux, entraînement et durabilité des armes : migration 0045 (décisions R71, R73, R74). Les tests écrivent dans une COPIE de la base
// construite : data/rows garde ces tables vides.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
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
  'personnage_metier_bonus', 'personnage_capacite', 'personnage_sort', 'personnage_maitrise_arme', 'personnage_arme', 'personnage_armure_partie',
  'personnage_accessoire', 'personnage_inventaire', 'personnage_ceinture', 'groupe', 'groupe_membre',
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
    nom: `Fiche ${id}`, race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central',
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
      nom: id, mode_classe: c.mode, xp: c.xp, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
      bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT,
    });
    assert.deepEqual(niveau(id), c.attendu, `${c.xp} XP, ${c.mode}`);
  }
});

test('une fiche conforme de niveau 1 n’a aucune ligne de contrôle', () => {
  personnageValide('conforme');
  assert.deepEqual(controle('conforme'), []);
});

test('migration 0038 : plus de statut, toute fiche est contrôlée, même inachevée ; caractéristiques, compétences, classes, gains de niveau et bonus de métier manquants signalés', () => {
  assert.equal(db.prepare("SELECT 1 FROM pragma_table_info('personnage') WHERE name = 'statut'").get(), undefined, 'la colonne statut n’existe plus');
  // un métier dont un rang est un choix entre deux compétences (le Coursier à l'import), lu dans la base ; texte de sa première option
  const choix = db.prepare('SELECT metier_id, rang FROM metier_bonus WHERE option = 2 AND competence_id IS NOT NULL ORDER BY metier_id, rang LIMIT 1').get();
  const texte = db.prepare('SELECT texte FROM metier_bonus WHERE metier_id = ? AND rang = ? AND option = 1').get(choix.metier_id, choix.rang).texte;
  // niveau 11 en mono-classe (classe 2 au niveau 2, décision R2), ni classe, ni caractéristiques, ni compétences, ni gains de niveau, ni choix du métier :
  // ce qu'on enregistrait en « brouillon », sans aucun contrôle de complétude
  assert.doesNotThrow(() => inserer('personnage', {
    id: 'inachevee', nature: 'joueur', proprietaire_id: 'alice', visibilite: 'privee', nom: 'inachevee', race_id: 'races/humain',
    ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', metier_id: choix.metier_id, mode_classe: 'mono', xp: 17050,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT,
  }), 'une fiche inachevée s’enregistre');
  assert.equal(niveau('inachevee').niveau_global, 11);
  const details = (regle) => controle('inachevee').filter((c) => c.regle === regle).map((c) => c.detail);
  assert.deepEqual(regles('inachevee'), [
    'caracteristique_manquante', 'classe_1_manquante', 'classe_2_manquante', 'competences_total', 'gains_niveau', 'metier_bonus_manquant',
  ]);
  assert.deepEqual(details('caracteristique_manquante'), db.prepare('SELECT id FROM caracteristique ORDER BY id').all().map((r) => r.id), 'les six');
  assert.deepEqual(details('classe_1_manquante'), [null]);
  assert.deepEqual(details('classe_2_manquante'), ['2']);
  const budget = db.prepare('SELECT points_competences_cumul FROM v_niveau WHERE niveau = 11').get().points_competences_cumul;
  assert.deepEqual(details('competences_total'), [`0 / ${budget}`]);
  assert.ok(details('metier_bonus_manquant').includes(texte), details('metier_bonus_manquant').join());
  // gains de niveau (décision R73) : 15 points par niveau du 2 au 11, plus les dés des niveaux 5 et 10 (1 à 8 chacun), lus dans v_niveau
  const plage = db.prepare(`SELECT points_attributs_cumul + de_attributs_min_cumul AS min, points_attributs_cumul + de_attributs_max_cumul AS max
    FROM v_niveau WHERE niveau = 11`).get();
  assert.deepEqual(details('gains_niveau'), [`0 / ${plage.min} à ${plage.max}`], 'rien de saisi sur le total à saisir');

  // chaque ligne tient à ce qui manque : la classe 1 choisie, la sienne disparaît, les autres restent
  inserer('personnage_classe', { personnage_id: 'inachevee', rang: 1, classe_id: 'classes/guerrier' });
  assert.deepEqual(details('classe_1_manquante'), []);
  assert.deepEqual(regles('inachevee'), ['caracteristique_manquante', 'classe_2_manquante', 'competences_total', 'gains_niveau', 'metier_bonus_manquant']);
});

test('migration 0038 : race et magie innée ne sont plus une contrainte de la table ; une fiche sans l’une ou l’autre s’enregistre et la vue le signale', () => {
  assert.doesNotThrow(() => personnageValide('sans-race', { race_id: null, ethnie_id: null }));
  assert.deepEqual(controle('sans-race'), [{ regle: 'race_manquante', detail: null }]);
  assert.doesNotThrow(() => personnageValide('sans-magie', { magie_innee_id: null }));
  assert.deepEqual(controle('sans-magie'), [{ regle: 'magie_innee_manquante', detail: null }]);
  personnageValide('sans-race-ni-magie', { race_id: null, ethnie_id: null, magie_innee_id: null });
  assert.deepEqual(regles('sans-race-ni-magie'), ['magie_innee_manquante', 'race_manquante']);
  // sans race ou sans magie innée, l'ethnie n'a rien à quoi se comparer : seule la ligne du manque, ni « Ethnie d'une autre race » ni « Ethnie liée
  // à une autre magie innée » (ce que la page /fiche/ laisse quand on retire la magie innée d'une race dont toutes les ethnies portent une magie)
  const ethnieAMagie = db.prepare('SELECT id, race_id FROM ethnie WHERE magie_id IS NOT NULL ORDER BY id LIMIT 1').get();
  personnageValide('ethnie-sans-magie', { race_id: ethnieAMagie.race_id, ethnie_id: ethnieAMagie.id, magie_innee_id: null });
  const ethnieEtManques = (id) => regles(id).filter((r) => r.startsWith('ethnie_') || r === 'race_manquante' || r === 'magie_innee_manquante');
  assert.deepEqual(ethnieEtManques('ethnie-sans-magie'), ['magie_innee_manquante']);
  personnageValide('ethnie-sans-race', { race_id: null });
  assert.deepEqual(ethnieEtManques('ethnie-sans-race'), ['race_manquante'], 'une ethnie posée, sans race');
  // choisies, les lignes disparaissent
  db.prepare("UPDATE personnage SET race_id = 'races/humain', ethnie_id = 'races/humain#ethnie:humain-central' WHERE id = 'sans-race'").run();
  assert.deepEqual(controle('sans-race'), []);
  db.prepare("UPDATE personnage SET magie_innee_id = 'magies/magie-du-feu' WHERE id = 'sans-magie'").run();
  assert.deepEqual(controle('sans-magie'), []);
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
  assert.deepEqual(regles('race-5'), ['caracteristique_magie', 'classe_imposee'], 'Potentiel Illimité : le point de caractéristique est à choisir, l’Archimage imposée (R23)');
  db.prepare("UPDATE personnage SET caracteristique_magie_id = 'force' WHERE id = 'race-5'").run();
  db.prepare("UPDATE personnage_classe SET classe_id = 'classes/archimage' WHERE personnage_id = 'race-5'").run();
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

test('métier (décisions R33, R38) : bonus d’acquis et d’initiative, rang à choix à choisir parmi ses options, acquis plafonné, le plafond prévalant sur le bonus', () => {
  const bonus = (id) => db.prepare('SELECT rang, competence_id, attribut, valeur FROM v_personnage_metier_bonus WHERE personnage_id = ? ORDER BY rang').all(id).map((r) => ({ ...r }));
  // un métier dont un rang est « +N INI » et un autre un choix entre deux compétences (le Coursier à l'import), lu dans la base
  const metier = db.prepare(`SELECT b.metier_id FROM metier_bonus b WHERE b.attribut = 'initiative'
    AND EXISTS (SELECT 1 FROM metier_bonus c WHERE c.metier_id = b.metier_id AND c.option = 2 AND c.competence_id IS NOT NULL) ORDER BY b.metier_id LIMIT 1`).get().metier_id;
  const ini = db.prepare("SELECT rang, valeur FROM metier_bonus WHERE metier_id = ? AND attribut = 'initiative'").get(metier);
  const choix = db.prepare('SELECT rang, competence_id, valeur FROM metier_bonus WHERE metier_id = ? AND option = 2 AND competence_id IS NOT NULL').get(metier);
  personnageValide('metier-1', { metier_id: metier });
  assert.deepEqual(bonus('metier-1').filter((b) => b.attribut), [{ rang: ini.rang, competence_id: null, attribut: 'initiative', valeur: ini.valeur }]);
  assert.ok(!bonus('metier-1').some((b) => b.rang === choix.rang), 'rang à choix : rien tant qu’il n’est pas choisi');
  assert.ok(regles('metier-1').includes('metier_bonus_manquant'), 'le choix manque');
  inserer('personnage_metier_bonus', { personnage_id: 'metier-1', rang: choix.rang, competence_id: choix.competence_id });
  assert.ok(bonus('metier-1').some((b) => b.rang === choix.rang && b.competence_id === choix.competence_id && b.valeur === choix.valeur));
  assert.ok(!regles('metier-1').includes('metier_bonus_manquant'));
  db.prepare("UPDATE personnage_metier_bonus SET competence_id = 'medecine' WHERE personnage_id = 'metier-1'").run();
  assert.deepEqual(controle('metier-1').filter((c) => c.regle.startsWith('metier_')), [{ regle: 'metier_bonus_hors_choix', detail: 'medecine' }], 'une autre compétence');
  db.prepare("UPDATE personnage SET metier_id = NULL WHERE id = 'metier-1'").run();
  assert.deepEqual(regles('metier-1'), ['metier_bonus_hors_choix'], 'sans métier, le choix noté est en trop');
  assert.deepEqual(bonus('metier-1'), []);

  // l'acquis compte le bonus du métier : un métier qui donne +N à une compétence d'Intelligence, avec 2 en Intelligence (plafond 10)
  const savant = db.prepare(`SELECT b.metier_id, b.competence_id, b.valeur FROM metier_bonus b JOIN competence c ON c.id = b.competence_id
    WHERE c.caracteristique_id = 'intelligence' AND (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) = 1
    ORDER BY b.valeur DESC, b.metier_id LIMIT 1`).get();
  personnageValide('metier-2', { metier_id: savant.metier_id });
  inserer('personnage_competence', { personnage_id: 'metier-2', competence_id: savant.competence_id, naturel: 0, acquis: 10 - savant.valeur });
  assert.ok(!regles('metier-2').includes('competence_acquis_max'), 'au plafond : permis');
  db.prepare('UPDATE personnage_competence SET acquis = acquis + 1 WHERE personnage_id = ? AND competence_id = ?').run('metier-2', savant.competence_id);
  assert.deepEqual(controle('metier-2').filter((c) => c.regle === 'competence_acquis_max'), [{ regle: 'competence_acquis_max', detail: `${savant.competence_id} = 11` }]);

  // le plafond prévaut sur le bonus (décision R38) : avec 1 en Intelligence (plafond 5), un bonus plus grand est rogné, sans erreur ; un point saisi en plus en est une
  personnageValide('metier-3', { metier_id: savant.metier_id });
  db.prepare("UPDATE personnage_caracteristique SET base = base + 1 WHERE personnage_id = 'metier-3' AND caracteristique_id = 'force'").run();
  db.prepare("UPDATE personnage_caracteristique SET base = 1 WHERE personnage_id = 'metier-3' AND caracteristique_id = 'intelligence'").run();
  db.prepare("UPDATE metier_bonus SET valeur = 9 WHERE metier_id = ? AND competence_id = ?").run(savant.metier_id, savant.competence_id);
  assert.ok(!regles('metier-3').includes('competence_acquis_max'), regles('metier-3').join());
  inserer('personnage_competence', { personnage_id: 'metier-3', competence_id: savant.competence_id, naturel: 0, acquis: 1 });
  assert.deepEqual(controle('metier-3').filter((c) => c.regle === 'competence_acquis_max'), [{ regle: 'competence_acquis_max', detail: `${savant.competence_id} = 6` }]);
  db.prepare("UPDATE metier_bonus SET valeur = ? WHERE metier_id = ? AND competence_id = ?").run(savant.valeur, savant.metier_id, savant.competence_id);
});

test('décision R41 : l’acquis au plus 5 par point de la caractéristique totale, le +1 de la magie innée compris (fixé par la magie ou choisi)', () => {
  const social = db.prepare("SELECT id FROM competence WHERE caracteristique_id = 'social' ORDER BY ordre LIMIT 1").get().id;
  personnageValide('r41-1');   // Feu inné : +1 Social ; Social 2 + 1 = 3, au plus 15 d'acquis
  inserer('personnage_competence', { personnage_id: 'r41-1', competence_id: social, naturel: 0, acquis: 15 });
  assert.deepEqual(controle('r41-1'), []);
  db.prepare('UPDATE personnage_competence SET acquis = 16 WHERE personnage_id = ? AND competence_id = ?').run('r41-1', social);
  assert.deepEqual(controle('r41-1'), [{ regle: 'competence_acquis_max', detail: `${social} = 16` }]);
  // le Potentiel Illimité laisse le point au choix (caracteristique_magie_id) : Volonté 2 + 1, au plus 15
  personnageValide('r41-2', { magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'volonte' });
  db.prepare("UPDATE personnage_classe SET classe_id = 'classes/archimage' WHERE personnage_id = 'r41-2'").run();
  inserer('personnage_competence', { personnage_id: 'r41-2', competence_id: 'calme', naturel: 0, acquis: 15 });
  inserer('personnage_competence', { personnage_id: 'r41-2', competence_id: social, naturel: 0, acquis: 11 });
  assert.deepEqual(controle('r41-2'), [{ regle: 'competence_acquis_max', detail: `${social} = 11` }], 'Social 2 sans bonus : au plus 10');
});

test('gains de niveau (décision R73) : santé + chakra = 15 points par niveau à partir du 2, plus 1 à 8 par dé atteint (niveaux 5, 10, 15, 20) ; règle gains_niveau', () => {
  const gains = (id) => controle(id).filter((c) => c.regle === 'gains_niveau').map((c) => c.detail);
  const poser = (id, sante, chakra) => db.prepare('UPDATE personnage SET gains_sante = ?, gains_chakra = ? WHERE id = ?').run(sante, chakra, id);
  const xp = (n) => db.prepare('SELECT xp_min FROM niveau_global WHERE niveau = ?').get(n).xp_min;
  // la plage de chaque niveau : points d'attributs cumulés, plus les bornes des dés atteints (v_niveau), celle que la page affiche
  const plages = Object.fromEntries(db.prepare(`SELECT niveau, points_attributs_cumul + de_attributs_min_cumul AS min, points_attributs_cumul + de_attributs_max_cumul AS max
    FROM v_niveau`).all().map((v) => [v.niveau, [v.min, v.max]]));
  assert.deepEqual([1, 2, 4, 5, 10, 11, 20].map((n) => plages[n]), [[0, 0], [15, 15], [45, 45], [61, 68], [137, 151], [152, 166], [289, 317]]);

  // niveau 1 : rien à saisir ; une fiche neuve a 0 et 0
  personnageValide('gains-1');
  assert.deepEqual({ ...db.prepare("SELECT gains_sante, gains_chakra, entrainement FROM personnage WHERE id = 'gains-1'").get() }, { gains_sante: 0, gains_chakra: 0, entrainement: null });
  assert.deepEqual(gains('gains-1'), []);
  poser('gains-1', 3, 0);
  assert.deepEqual(gains('gains-1'), ['3 / 0'], 'des gains au niveau 1 sont signalés');

  // niveau 2 : exactement 15, répartis comme le joueur veut
  personnageValide('gains-2', { xp: xp(2) });
  assert.deepEqual(gains('gains-2'), ['0 / 15']);
  poser('gains-2', 10, 5);
  assert.deepEqual(gains('gains-2'), []);
  poser('gains-2', 0, 15);
  assert.deepEqual(gains('gains-2'), []);
  poser('gains-2', 10, 6);
  assert.deepEqual(gains('gains-2'), ['16 / 15']);

  // niveau 5, fiche conforme par ailleurs : 60 points et un dé, de 61 à 68
  personnageValide('prog', { xp: xp(5) });
  db.prepare("DELETE FROM personnage_competence WHERE personnage_id = 'prog'").run();
  for (const [c, n] of [['arc', 30], ['arme-lourde', 30], ['athletisme', 30], ['parade', 30], ['stabilite', 30], ['calme', 30], ['concentration', 20]]) {
    inserer('personnage_competence', { personnage_id: 'prog', competence_id: c, naturel: n, acquis: 0 });   // 100 + 20 + 20 + 20 + 40 = 200
  }
  db.prepare("UPDATE personnage_caracteristique SET base = 3 WHERE personnage_id = 'prog' AND caracteristique_id = 'volonte'").run();   // total 15 au niveau 5
  assert.deepEqual(controle('prog'), [{ regle: 'gains_niveau', detail: '0 / 61 à 68' }]);
  poser('prog', 40, 20);
  assert.deepEqual(controle('prog'), [{ regle: 'gains_niveau', detail: '60 / 61 à 68' }], 'le dé donne au moins 1');
  for (const [sante, chakra] of [[41, 20], [48, 20], [0, 68], [61, 0]]) {
    poser('prog', sante, chakra);
    assert.deepEqual(controle('prog'), [], `${sante} + ${chakra}`);
  }
  poser('prog', 49, 20);
  assert.deepEqual(controle('prog'), [{ regle: 'gains_niveau', detail: '69 / 61 à 68' }], 'le dé donne au plus 8 (1d8, ou 1d4 sur les deux)');
  // l'XP baissée au niveau 4 : plus de dé, 45 exactement ; rien n'est rogné d'office
  poser('prog', 41, 20);
  db.prepare("UPDATE personnage SET xp = ? WHERE id = 'prog'").run(xp(4));
  assert.deepEqual(gains('prog'), ['61 / 45']);

  // niveaux 11 et 20 : deux et quatre dés
  personnageValide('gains-11', { xp: xp(11) });
  assert.deepEqual(gains('gains-11'), ['0 / 152 à 166']);
  for (const [sante, chakra, attendu] of [[100, 51, ['151 / 152 à 166']], [100, 52, []], [100, 66, []], [100, 67, ['167 / 152 à 166']]]) {
    poser('gains-11', sante, chakra);
    assert.deepEqual(gains('gains-11'), attendu, `${sante} + ${chakra}`);
  }
  personnageValide('gains-20', { xp: xp(20) });
  assert.deepEqual(gains('gains-20'), ['0 / 289 à 317']);
  for (const [sante, chakra, attendu] of [[200, 88, ['288 / 289 à 317']], [200, 89, []], [200, 117, []], [200, 118, ['318 / 289 à 317']]]) {
    poser('gains-20', sante, chakra);
    assert.deepEqual(gains('gains-20'), attendu, `${sante} + ${chakra}`);
  }

  // deux totaux positifs, toujours écrits
  assert.throws(() => poser('gains-1', -1, 0), /CHECK/);
  assert.throws(() => poser('gains-1', 0, -1), /CHECK/);
  assert.throws(() => db.prepare("UPDATE personnage SET gains_sante = NULL WHERE id = 'gains-1'").run(), /NOT NULL/);
});

test('bornes du dé bonus des niveaux (décision R73) : 1 et 8 aux niveaux dont le dé est écrit, rien ailleurs ; cumuls de v_niveau', () => {
  const niveaux = db.prepare('SELECT niveau, de_attributs_bonus, de_attributs_min, de_attributs_max FROM niveau_global ORDER BY niveau').all();
  for (const n of niveaux) {
    assert.deepEqual([n.de_attributs_min, n.de_attributs_max], n.de_attributs_bonus === null ? [null, null] : [1, 8], `niveau ${n.niveau}`);
  }
  assert.deepEqual(niveaux.filter((n) => n.de_attributs_bonus !== null).map((n) => n.niveau), [5, 10, 15, 20]);
  for (const v of db.prepare('SELECT niveau, des_attributs_cumul, de_attributs_min_cumul, de_attributs_max_cumul FROM v_niveau ORDER BY niveau').all()) {
    assert.deepEqual([v.de_attributs_min_cumul, v.de_attributs_max_cumul], [v.des_attributs_cumul, 8 * v.des_attributs_cumul], `niveau ${v.niveau}`);
  }
  assert.throws(() => db.prepare('UPDATE niveau_global SET de_attributs_min = 0 WHERE niveau = 5').run(), /CHECK/);
});

test('migration 0045 : plus de table personnage_progression ; entraînement en texte libre (R71), jamais compté ; durabilité d’une arme (R74) : NULL = à son maximum, 0 = cassée', () => {
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'personnage_progression'").get(), undefined);
  assert.equal(existsSync(join(racine, 'data', 'rows', 'personnage_progression.sql')), false);
  personnageValide('m45');
  db.prepare("UPDATE personnage SET entrainement = ? WHERE id = 'm45'").run('Arc +5 % (entraîneur de Lunastre) ; livre de magie lu : Boule de feu');
  assert.deepEqual(controle('m45'), [], 'le texte de l’entraînement n’est pas compté');
  const arme = db.prepare('SELECT a.id FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 1 ORDER BY a.id LIMIT 1').get().id;
  inserer('personnage_arme', { personnage_id: 'm45', rang: 1, arme_id: arme });
  const durabilite = () => db.prepare("SELECT durabilite FROM personnage_arme WHERE personnage_id = 'm45' AND rang = 1").get().durabilite;
  assert.equal(durabilite(), null, 'à son maximum');
  for (const v of [0, 3]) {
    db.prepare("UPDATE personnage_arme SET durabilite = ? WHERE personnage_id = 'm45' AND rang = 1").run(v);
    assert.equal(durabilite(), v);
  }
  assert.throws(() => db.prepare("UPDATE personnage_arme SET durabilite = -1 WHERE personnage_id = 'm45' AND rang = 1").run(), /CHECK/);
  assert.deepEqual(controle('m45'), [], 'une arme cassée n’est pas une règle enfreinte');
});

test('migration 0052 : un emplacement de ceinture admet 0 (un carquois vide, décision R89), jamais moins ; le sac, au moins 1', () => {
  personnageValide('m51');
  const carquois = db.prepare("SELECT r.id, r.nom FROM v_objet_ceinture v JOIN ressource r ON r.id = v.ressource_id WHERE v.famille = 'contenant' ORDER BY r.id LIMIT 1").get();
  inserer('personnage_ceinture', { personnage_id: 'm51', rang: 1, nom: carquois.nom, quantite: 0, ressource_id: carquois.id });
  assert.equal(db.prepare("SELECT quantite FROM personnage_ceinture WHERE personnage_id = 'm51' AND rang = 1").get().quantite, 0);
  assert.throws(() => db.prepare("UPDATE personnage_ceinture SET quantite = -1 WHERE personnage_id = 'm51' AND rang = 1").run(), /CHECK/);
  assert.throws(() => inserer('personnage_inventaire', { personnage_id: 'm51', rang: 1, nom: carquois.nom, quantite: 0, ressource_id: carquois.id }), /CHECK/);
  assert.deepEqual(controle('m51'), [], 'un carquois vide n’est pas une règle enfreinte');
});

test('classes, spécialités et dons : 2e classe selon R2, spécialité au niveau de classe 10, dons de la classe et jamais deux options exclusives', (t) => {
  personnageValide('classe-1', { xp: 17050 });   // niveau 11 en mono-classe : classe 2 au niveau 2
  assert.ok(regles('classe-1').includes('classe_2_manquante'));

  // deux dons au choix d'une spécialité du Guerrier et un don de l'autre (Affûté, Expert Mordhau, Bien équipé ! à l'import) : lus dans la base, le site
  // de dev pouvant créer ou supprimer des spécialités et des dons (D11)
  const specialites = db.prepare("SELECT id FROM specialite WHERE classe_id = 'classes/guerrier' ORDER BY rang").all().map((s) => s.id);
  const paire = specialites.length === 2 && db.prepare(`SELECT e.capacite_id AS a, e.autre_id AS b FROM v_capacite_exclusive e JOIN capacite k ON k.id = e.capacite_id
    WHERE k.specialite_id = ? AND k.nature = 'choix' ORDER BY k.ligne, k.rang LIMIT 1`).get(specialites[0]);
  const donDeLAutre = specialites.length === 2 && db.prepare("SELECT id FROM capacite WHERE specialite_id = ? AND nature = 'choix' ORDER BY ligne, rang LIMIT 1").get(specialites[1]);
  if (!paire || !donDeLAutre) {
    t.diagnostic('Guerrier remanié sur le site de dev : pas de choix d’au moins deux dons dans ses deux spécialités, contrôle des dons sauté');
    return;
  }
  personnageValide('classe-2');
  inserer('personnage_classe', { personnage_id: 'classe-2', rang: 2, classe_id: 'classes/archer' });
  db.prepare('UPDATE personnage_classe SET specialite_id = ? WHERE personnage_id = ? AND rang = 1').run(specialites[0], 'classe-2');
  inserer('personnage_capacite', { personnage_id: 'classe-2', capacite_id: paire.a });
  inserer('personnage_capacite', { personnage_id: 'classe-2', capacite_id: paire.b });
  inserer('personnage_capacite', { personnage_id: 'classe-2', capacite_id: donDeLAutre.id });   // l'autre spécialité
  assert.deepEqual(regles('classe-2'), ['capacite_hors_classe', 'capacites_exclusives', 'classe_2_en_trop', 'specialite_trop_tot']);

  assert.throws(() => db.prepare("UPDATE personnage_classe SET specialite_id = 'classes/archer#specialite:x' WHERE personnage_id = 'classe-2' AND rang = 1").run(), /FOREIGN KEY/);
  const autre = db.prepare("SELECT id FROM specialite WHERE classe_id = 'classes/archer' LIMIT 1").get().id;
  assert.throws(() => db.prepare('UPDATE personnage_classe SET specialite_id = ? WHERE personnage_id = ? AND rang = 1').run(autre, 'classe-2'), /FOREIGN KEY/, 'une spécialité d’une autre classe');
});

test('sorts : de la magie du personnage ; NM de niveau au plus niveau global − 1 et au plus ceux gagnés, ceux d’un livre ou du MJ en plus, 3 au plus sur un sort (R24, R26)', () => {
  personnageValide('sorts', { xp: 550 });   // niveau 3 : 2 NM gagnés, NM max 2
  db.prepare("UPDATE personnage_competence SET naturel = 20 WHERE personnage_id = 'sorts'").run();
  for (const c of ['calme', 'concentration']) inserer('personnage_competence', { personnage_id: 'sorts', competence_id: c, naturel: 20, acquis: 0 });   // 100 + 20 + 20
  db.prepare("UPDATE personnage SET gains_sante = 30 WHERE id = 'sorts'").run();   // gains des niveaux 2 et 3 (R73)
  inserer('personnage_sort', { personnage_id: 'sorts', sort_id: 'magies/magie-du-feu#sort:boule-de-feu', rang: 1, niveau_maitrise: 2 });
  assert.deepEqual(controle('sorts'), []);
  inserer('personnage_sort', { personnage_id: 'sorts', sort_id: 'magies/magie-du-feu#sort:cauterisation', rang: 2, niveau_maitrise: 2, nm_livre: 1, nm_cadeau: 1 });
  assert.deepEqual(controle('sorts'), [], '4 NM pour 2 gagnés : les 2 en plus viennent d’un livre et du MJ (R24, R26)');
  db.prepare("UPDATE personnage_sort SET nm_livre = 0 WHERE personnage_id = 'sorts' AND rang = 2").run();
  assert.deepEqual(controle('sorts'), [{ regle: 'sorts_nm_total', detail: '3 / 2' }], 'un NM en plus non offert : de niveau, au-delà de ceux gagnés');
  db.prepare("UPDATE personnage_sort SET niveau_maitrise = 4, nm_livre = 1, nm_cadeau = 3 WHERE personnage_id = 'sorts' AND rang = 2").run();
  assert.deepEqual(controle('sorts'), [{ regle: 'sort_nm_plafond', detail: 'magies/magie-du-feu#sort:cauterisation = 4' }], 'jamais plus de 3 NM sur un sort');
  assert.throws(() => db.prepare("UPDATE personnage_sort SET nm_livre = 2 WHERE personnage_id = 'sorts' AND rang = 2").run(), /CHECK/, 'un seul NM de livre par sort');
  assert.throws(() => db.prepare("UPDATE personnage_sort SET niveau_maitrise = 1 WHERE personnage_id = 'sorts' AND rang = 2").run(), /CHECK/, 'les NM offerts font partie du NM du sort');
  db.prepare("DELETE FROM personnage_sort WHERE personnage_id = 'sorts' AND rang = 2").run();
  inserer('personnage_sort', { personnage_id: 'sorts', sort_id: 'magies/magie-du-feu#sort:cauterisation', rang: 2, niveau_maitrise: 3 });
  const glace = db.prepare("SELECT id FROM sort WHERE magie_id = 'magies/magie-de-la-glace' AND niveau = 1 LIMIT 1").get().id;
  inserer('personnage_sort', { personnage_id: 'sorts', sort_id: glace, rang: 3, niveau_maitrise: 0 });
  assert.deepEqual(regles('sorts'), ['sort_hors_magie', 'sort_nm_max', 'sorts_nm_total']);
});

test('équipement : bouclier forme et matière (R96), améliorations du bon genre, valeur d’accessoire dans la fourchette, six emplacements (R97)', () => {
  const [m1] = db.prepare('SELECT ressource_id FROM materiau_bouclier ORDER BY ordre LIMIT 1').all().map((r) => r.ressource_id);
  personnageValide('equipement', { bouclier_classe_id: 'targe' });
  assert.deepEqual(controle('equipement'), [{ regle: 'bouclier_matiere_manquante', detail: 'targe' }], 'une forme sans matière');
  db.prepare("UPDATE personnage SET bouclier_materiau_id = ?, bouclier_solidite = 0 WHERE id = 'equipement'").run(m1);
  assert.deepEqual(controle('equipement'), []);
  // un couple forme + matière que la liste des boucliers n'écrit pas (la base les a tous : db:check)
  db.exec('SAVEPOINT bouclier_retire');
  db.prepare("DELETE FROM bouclier WHERE classe_id = 'targe' AND materiau_id = ?").run(m1);
  assert.deepEqual(controle('equipement'), [{ regle: 'bouclier_inconnu', detail: `targe + ${m1}` }]);
  db.exec('ROLLBACK TO bouclier_retire; RELEASE bouclier_retire');
  assert.deepEqual(controle('equipement'), []);
  db.prepare("UPDATE personnage SET bouclier_classe_id = NULL WHERE id = 'equipement'").run();
  assert.deepEqual(controle('equipement'), [{ regle: 'bouclier_manquant', detail: m1 }], 'une matière sans forme');
  const amelioBouclier = db.prepare("SELECT id FROM amelioration_equipement WHERE cible = 'bouclier' LIMIT 1").get().id;
  const amelioArme = db.prepare("SELECT id FROM amelioration_equipement WHERE cible = 'arme' LIMIT 1").get().id;
  db.prepare("UPDATE personnage SET bouclier_classe_id = 'targe', bouclier_amelioration_id = ? WHERE id = 'equipement'").run(amelioBouclier);
  assert.deepEqual(controle('equipement'), []);
  db.prepare("UPDATE personnage SET bouclier_amelioration_id = ? WHERE id = 'equipement'").run(amelioArme);
  assert.deepEqual(controle('equipement'), [{ regle: 'amelioration_cible', detail: `bouclier : ${amelioArme}` }]);
  assert.throws(() => db.prepare("UPDATE personnage SET bouclier_solidite = -1 WHERE id = 'equipement'").run(), /CHECK/);
  db.prepare("UPDATE personnage SET bouclier_classe_id = NULL, bouclier_materiau_id = NULL, bouclier_amelioration_id = NULL, bouclier_solidite = NULL WHERE id = 'equipement'").run();
  const unEffet = db.prepare('SELECT id FROM accessoire_effet LIMIT 1').get().id;
  for (const emplacement of ['ceinture', 'autre']) {
    assert.throws(() => inserer('personnage_accessoire', { personnage_id: 'equipement', emplacement, accessoire_effet_id: unEffet, maudit: 0 }), /CHECK/, emplacement);
  }
  assert.throws(() => inserer('personnage_accessoire', { personnage_id: 'equipement', emplacement: 'chef', accessoire_effet_id: null, maudit: 0 }), /NOT NULL/, 'un effet de la table');

  const arme = db.prepare('SELECT id FROM arme LIMIT 1').get().id;
  const amelioArmure = db.prepare("SELECT id FROM amelioration_equipement WHERE cible = 'armure' LIMIT 1").get().id;
  inserer('personnage_arme', { personnage_id: 'equipement', rang: 1, arme_id: arme, amelioration_id: amelioArmure });
  const effet = db.prepare('SELECT id, bonus_min, bonus_max FROM accessoire_effet WHERE bonus_min IS NOT NULL LIMIT 1').get();
  inserer('personnage_accessoire', { personnage_id: 'equipement', emplacement: 'collier', accessoire_effet_id: effet.id, valeur: effet.bonus_max + 1, maudit: 0 });
  assert.deepEqual(regles('equipement'), ['accessoire_valeur', 'amelioration_cible']);
});

test('armure (décision R95) : améliorations de l’armure entière du bon genre ; ni amélioration ni élément sans armure ; une partie que l’armure a', () => {
  const grille = db.prepare('SELECT id FROM armure WHERE solidite_uni IS NULL ORDER BY ordre LIMIT 1').get().id;
  const uni = db.prepare('SELECT id FROM armure WHERE solidite_uni = 1 ORDER BY ordre LIMIT 1').get().id;
  const amelioration = (cible) => db.prepare('SELECT id FROM amelioration_equipement WHERE cible = ? ORDER BY niveau LIMIT 1').get(cible).id;
  const element = db.prepare('SELECT id FROM armure_elementaire ORDER BY id LIMIT 1').get().id;
  personnageValide('armure', { armure_id: grille, armure_amelioration_id: amelioration('armure'), armure_elementaire_id: element,
    armure_amelioration_elementaire_id: amelioration('armure_elementaire') });
  inserer('personnage_armure_partie', { personnage_id: 'armure', emplacement_id: 'torse', solidite: 0 });
  assert.deepEqual(controle('armure'), [], 'une armure de la grille, ses améliorations, une partie cassée');
  // l'amélioration d'une arme sur l'armure, celle de l'armure sur l'élément
  const majs = (x) => db.prepare(`UPDATE personnage SET ${Object.keys(x).map((c) => `${c} = ?`).join(', ')} WHERE id = 'armure'`).run(...Object.values(x));
  majs({ armure_amelioration_id: amelioration('arme'), armure_amelioration_elementaire_id: amelioration('armure') });
  assert.deepEqual(controle('armure'), [
    { regle: 'amelioration_cible', detail: `armure : ${amelioration('arme')}` }, { regle: 'amelioration_cible', detail: `élément de l’armure : ${amelioration('armure')}` },
  ]);
  // sans armure : ni amélioration ni élément, aucune partie
  majs({ armure_id: null, armure_amelioration_id: null, armure_amelioration_elementaire_id: null });
  assert.deepEqual(controle('armure'), [{ regle: 'armure_manquante', detail: element }, { regle: 'armure_partie_hors_armure', detail: 'torse' }]);
  // une armure à solidité unifiée n'a que l'armure entière ; une armure de la grille jamais l'armure entière
  majs({ armure_id: uni, armure_elementaire_id: null });
  assert.deepEqual(controle('armure'), [{ regle: 'armure_partie_hors_armure', detail: 'torse' }]);
  db.prepare("UPDATE personnage_armure_partie SET emplacement_id = 'armure-complete' WHERE personnage_id = 'armure'").run();
  assert.deepEqual(controle('armure'), []);
  majs({ armure_id: grille });
  assert.deepEqual(controle('armure'), [{ regle: 'armure_partie_hors_armure', detail: 'armure-complete' }]);
  // la base refuse le bouclier (une autre partie de la fiche) et une solidité négative
  assert.throws(() => inserer('personnage_armure_partie', { personnage_id: 'armure', emplacement_id: 'bouclier', solidite: 0 }), /CHECK/);
  assert.throws(() => inserer('personnage_armure_partie', { personnage_id: 'armure', emplacement_id: 'casque', solidite: -1 }), /CHECK/);
});

test('contraintes : magie acquise ≠ magie innée, valeurs bornées, suppression en cascade', () => {
  assert.throws(() => personnageValide('ko-1', { magie_acquise_id: 'magies/magie-du-feu' }), /CHECK/);
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

test('la vue repère toutes les fiches fautives de ce fichier, les inachevées comprises (plus de brouillon épargné), jamais la fiche conforme', () => {
  const fautives = new Set(db.prepare('SELECT DISTINCT personnage_id FROM v_personnage_controle').all().map((r) => r.personnage_id));
  assert.ok(fautives.size > 0 && !fautives.has('conforme'));
  // les fiches du test des niveaux n'ont ni race, ni magie, ni classe, ni caractéristiques : chacune a ces lignes
  const inachevees = db.prepare("SELECT id FROM personnage WHERE id LIKE 'niveau-%' ORDER BY id").all().map((r) => r.id);
  assert.ok(inachevees.length > 0);
  for (const id of inachevees) {
    for (const regle of ['caracteristique_manquante', 'classe_1_manquante', 'magie_innee_manquante', 'race_manquante']) assert.ok(regles(id).includes(regle), `${id} : ${regle}`);
  }
});

test('sorts : le Potentiel Illimité pioche dans toutes les magies ; NPM au plus la puissance magique du niveau, la 5 au niveau 16 sans magie acquise (décision R16)', () => {
  // fiches inachevées (ni classe, ni caractéristiques, ni compétences) : la vue en signale les manques, seules les règles des sorts sont regardées
  const inachevee = (id, xp, surcharge = {}) => inserer('personnage', {
    id, nature: 'joueur', proprietaire_id: 'alice', visibilite: 'privee', nom: id, race_id: 'races/humain',
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
    inachevee(c.id, c.xp, c.surcharge);
    inserer('personnage_sort', { personnage_id: c.id, sort_id: c.sort, rang: 1, niveau_maitrise: 0 });
    assert.equal(regles(c.id).includes('sort_puissance'), c.attendu, c.id);
  }
  inachevee('potentiel', 0, { magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'force' });
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

test('décision R23 : l’Archimage est réservée au Potentiel Illimité inné, qui l’impose en classe 1 (« Chose à savoir » de l’Archimage)', () => {
  // La règle est une donnée de la classe (migration 0015), tirée du bloc « CHOSE A SAVOIR » de son onglet
  assert.deepEqual(db.prepare('SELECT id, magie_innee_id FROM classe WHERE magie_innee_id IS NOT NULL').all().map((r) => ({ ...r })),
    [{ id: 'classes/archimage', magie_innee_id: 'magies/potentiel-illimite' }]);
  assert.match(db.prepare("SELECT chose_a_savoir FROM classe WHERE id = 'classes/archimage'").get().chose_a_savoir,
    /vous ne pouvez pas la prendre si vous n'êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité/);
  assert.throws(() => db.prepare("UPDATE classe SET magie_innee_id = 'magies/potentiel-illimite' WHERE id = 'classes/mage'").run(), /UNIQUE/,
    'une magie innée impose au plus une classe');

  // Sans le Potentiel Illimité, pas d'Archimage, ni en classe 1 ni en classe 2
  personnageValide('r23-feu');
  db.prepare("UPDATE personnage_classe SET classe_id = 'classes/archimage' WHERE personnage_id = 'r23-feu'").run();
  assert.deepEqual(controle('r23-feu'), [{ regle: 'classe_reservee', detail: 'classes/archimage' }]);
  personnageValide('r23-feu-bi', { mode_classe: 'bi' });
  inserer('personnage_classe', { personnage_id: 'r23-feu-bi', rang: 2, classe_id: 'classes/archimage' });
  assert.deepEqual(controle('r23-feu-bi'), [{ regle: 'classe_reservee', detail: 'classes/archimage' }]);

  // Avec lui, l'Archimage en classe 1 ; la seconde classe reste libre
  const pi = { magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'force' };
  personnageValide('r23-pi', pi);
  assert.deepEqual(controle('r23-pi'), [{ regle: 'classe_imposee', detail: 'classes/archimage' }]);
  db.prepare("UPDATE personnage_classe SET classe_id = 'classes/archimage' WHERE personnage_id = 'r23-pi'").run();
  assert.deepEqual(controle('r23-pi'), []);
  personnageValide('r23-pi-bi', { ...pi, mode_classe: 'bi' });
  inserer('personnage_classe', { personnage_id: 'r23-pi-bi', rang: 2, classe_id: 'classes/archimage' });
  assert.deepEqual(controle('r23-pi-bi'), [{ regle: 'classe_imposee', detail: 'classes/archimage' }], 'Archimage en classe 2 : la classe 1 doit l’être');
  db.prepare("DELETE FROM personnage_classe WHERE personnage_id = 'r23-pi-bi'").run();
  inserer('personnage_classe', { personnage_id: 'r23-pi-bi', rang: 1, classe_id: 'classes/archimage' });
  inserer('personnage_classe', { personnage_id: 'r23-pi-bi', rang: 2, classe_id: 'classes/guerrier' });
  assert.deepEqual(controle('r23-pi-bi'), []);

  // Fiche sans classe : la classe 1 manque (contrôle de toute fiche, migration 0038), mais rien n'est imposé tant qu'aucune classe 1 n'est choisie
  inserer('personnage', {
    id: 'r23-sans-classe', nature: 'pretire', visibilite: 'tous', nom: 'r23', ...pi, mode_classe: 'mono', xp: 0,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT,
  });
  assert.deepEqual(controle('r23-sans-classe').filter((c) => c.regle.startsWith('classe_')), [{ regle: 'classe_1_manquante', detail: null }]);
});

test('décision R25 : le Mage Bleu est fermé au Potentiel Illimité, à tous les rangs (« Chose à savoir » du Mage Bleu)', () => {
  assert.deepEqual(db.prepare('SELECT id, magie_innee_exclue_id FROM classe WHERE magie_innee_exclue_id IS NOT NULL').all().map((r) => ({ ...r })),
    [{ id: 'classes/mage-bleu', magie_innee_exclue_id: 'magies/potentiel-illimite' }]);
  assert.match(db.prepare("SELECT chose_a_savoir FROM classe WHERE id = 'classes/mage-bleu'").get().chose_a_savoir, /Un potentiel illimité ne peut pas avoir cette classe\./);
  const pi = { magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'force', mode_classe: 'bi' };
  personnageValide('r25-pi', pi);
  db.prepare("UPDATE personnage_classe SET classe_id = 'classes/archimage' WHERE personnage_id = 'r25-pi'").run();
  inserer('personnage_classe', { personnage_id: 'r25-pi', rang: 2, classe_id: 'classes/mage-bleu' });
  assert.deepEqual(controle('r25-pi'), [{ regle: 'classe_exclue', detail: 'classes/mage-bleu' }]);
  db.prepare("UPDATE personnage_classe SET classe_id = 'classes/mage' WHERE personnage_id = 'r25-pi' AND rang = 2").run();
  assert.deepEqual(controle('r25-pi'), [], 'toute autre seconde classe');
  personnageValide('r25-feu');
  db.prepare("UPDATE personnage_classe SET classe_id = 'classes/mage-bleu' WHERE personnage_id = 'r25-feu'").run();
  assert.deepEqual(controle('r25-feu'), [], 'sans Potentiel Illimité, le Mage Bleu reste ouvert');
});

test('décision R28 : la Lamia n’a qu’une magie, pas de magie acquise (« Une seule magie autorisé », onglet de la race)', () => {
  assert.deepEqual(db.prepare('SELECT id FROM race WHERE mono_magie = 1').all().map((r) => r.id), ['races/lamia']);
  assert.match(db.prepare("SELECT inconvenients FROM race_onglet WHERE race_id = 'races/lamia'").get().inconvenients, /Une seule magie autorisé/);
  const lamia = { race_id: 'races/lamia', ethnie_id: 'races/lamia#ethnie:lamia' };
  const r28 = (id) => controle(id).filter((c) => c.regle === 'race_mono_magie');
  personnageValide('r28-lamia', { ...lamia, magie_acquise_id: 'magies/magie-de-leau' });
  assert.deepEqual(r28('r28-lamia'), [{ regle: 'race_mono_magie', detail: 'magies/magie-de-leau' }]);
  personnageValide('r28-lamia-seule', lamia);
  assert.deepEqual(r28('r28-lamia-seule'), [], 'sa magie innée seule');
  personnageValide('r28-humain', { magie_acquise_id: 'magies/magie-de-leau' });
  assert.deepEqual(controle('r28-humain'), [], 'les autres races gardent leur magie acquise');
});

test('décision R45 : pas de maîtrise d’arme sur ARME DE MONSTRES (des armes exclusives aux monstres), les autres familles en gardent une', () => {
  assert.deepEqual(db.prepare('SELECT id FROM arme_famille WHERE maitrisable = 0').all().map((r) => r.id), ['arme-de-monstres']);
  assert.match(db.prepare("SELECT libelle_brut FROM arme_famille WHERE id = 'arme-de-monstres'").get().libelle_brut, /^ARME DE MONSTRES/);
  assert.ok(db.prepare("SELECT count(*) AS n FROM arme WHERE famille_id = 'arme-de-monstres'").get().n > 0, 'ses armes restent dans la base');
  personnageValide('r45-monstres');
  inserer('personnage_maitrise_arme', { personnage_id: 'r45-monstres', arme_famille_id: 'arme-de-monstres', des: 2 });
  assert.deepEqual(controle('r45-monstres'), [{ regle: 'maitrise_arme_exclue', detail: 'arme-de-monstres' }]);
  personnageValide('r45-epees');
  for (const f of db.prepare('SELECT id FROM arme_famille WHERE maitrisable = 1').all()) {
    inserer('personnage_maitrise_arme', { personnage_id: 'r45-epees', arme_famille_id: f.id, des: 2 });
  }
  assert.deepEqual(controle('r45-epees'), [], 'une maîtrise sur chacune des autres familles');
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
    id, nom: id, mode_classe: 'mono', xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
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
