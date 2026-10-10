// Base vivante du service (client/serveur/base-vivante.mjs, docs/serveur.md) : copie de la base des règles publiée par le site, où le service
// écrit les fiches (section 13 de data/schema.sql). Quand les règles changent, elle est refaite et ses lignes reprises ; si une seule ne passe
// pas, rien ne change et l'erreur dit pourquoi. Tout se passe dans des dossiers temporaires, à partir de la base construite depuis data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import {
  ARCHIVES_GARDEES, DOSSIER_ARCHIVES, ErreurBaseVivante, FICHIER_BASE, FICHIER_ETAT, TABLES_EDITION, TABLES_FICHES, TABLES_VIVANTES, clesRompues, empreinteFichier, lireEtat,
  preparerBaseVivante,
} from '../serveur/base-vivante.mjs';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-vivante-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const REGLES = cheminBase({ sansExemples: false });
const INSTANT = '2026-10-10T12:00:00Z';

let compteur = 0;
const nouveau = (prefixe) => join(racine, `${prefixe}-${(compteur += 1)}`);
/** Copie des règles modifiée par `sql` (clés étrangères non contrôlées : seules celles de la section 13 comptent ici) : une « nouvelle livraison ». */
function regles(sql = '') {
  const f = `${nouveau('regles')}.db`;
  copyFileSync(REGLES, f);
  if (sql) {
    const db = new DatabaseSync(f, { enableForeignKeyConstraints: false });
    db.exec(sql);
    db.close();
  }
  return f;
}
const lecture = (f) => new DatabaseSync(f, { readOnly: true });
function valeur(f, sql, ...params) {
  const db = lecture(f);
  try {
    return db.prepare(sql).get(...params);
  } finally {
    db.close();
  }
}
const UN_METIER = valeur(REGLES, 'SELECT id FROM metier ORDER BY id LIMIT 1').id;
const UN_SORT_DE_FEU = valeur(REGLES, "SELECT id FROM sort WHERE magie_id = 'magies/magie-du-feu' ORDER BY id LIMIT 1").id;

/** Un utilisateur MJ, un prétiré complet (classe, caractéristique, sort, sac), la fiche d'un joueur inscrite dans un groupe. */
function remplir(chemin) {
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  const inserer = (t, l) => db.prepare(`INSERT INTO ${t} (${Object.keys(l).join(', ')}) VALUES (${Object.keys(l).map(() => '?').join(', ')})`).run(...Object.values(l));
  const fiche = { visibilite: 'tous', statut: 'brouillon', race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu',
    mode_classe: 'mono', xp: 250, alignement_loyal: 1, alignement_chaotique: 0, alignement_bon: 2, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 12, bourse_rf: 3,
    ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT };
  inserer('utilisateur', { id: 'u1', discord_id: '123456789', nom_affichage: 'Alice', cree_le: INSTANT });
  inserer('utilisateur_role', { utilisateur_id: 'u1', role: 'mj' });
  inserer('personnage', { ...fiche, id: 'p1', nature: 'pretire', nom: 'Aldric', surnom: 'le Brave', metier_id: UN_METIER });
  inserer('personnage', { ...fiche, id: 'p2', nature: 'joueur', proprietaire_id: 'u1', visibilite: 'privee', nom: 'Brune' });
  inserer('personnage_classe', { personnage_id: 'p1', rang: 1, classe_id: 'classes/guerrier' });
  inserer('personnage_caracteristique', { personnage_id: 'p1', caracteristique_id: 'force', base: 4, croix: 1 });
  inserer('personnage_sort', { personnage_id: 'p1', sort_id: UN_SORT_DE_FEU, rang: 1, niveau_maitrise: 0 });
  inserer('personnage_inventaire', { personnage_id: 'p1', rang: 1, nom: 'Corde', quantite: 2 });
  inserer('groupe', { id: 'g1', nom: 'La campagne', nature: 'campagne', cree_le: INSTANT });
  inserer('groupe_membre', { groupe_id: 'g1', utilisateur_id: 'u1', role: 'joueur', personnage_id: 'p2', rejoint_le: INSTANT });
  db.close();
}
/** Toutes les lignes de la section 13, triées : ce qui doit survivre à un changement de règles. */
function lignesVivantes(chemin) {
  const db = lecture(chemin);
  try {
    return Object.fromEntries(TABLES_VIVANTES.map((t) => [t, db.prepare(`SELECT * FROM "${t}"`).all().map((r) => JSON.stringify(r)).sort()]));
  } finally {
    db.close();
  }
}
const sansArchives = (dossier) => readdirSync(dossier).filter((f) => f !== DOSSIER_ARCHIVES).sort();

test('TABLES_VIVANTES : exactement les tables des sections 13 (fiches) puis 14 (journal des modifications) de data/schema.sql, chacune après les tables qu’elle cite', () => {
  const schema = readFileSync(join(trouverRacine(), 'data', 'schema.sql'), 'utf8');
  const debut13 = schema.indexOf('-- 13. PERSONNAGES');
  const debut14 = schema.indexOf('-- 14. ÉDITION');
  assert.ok(debut13 > 0 && debut14 > debut13, 'sections 13 et 14 trouvées');
  const tables = (texte) => [...texte.matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(tables(schema.slice(debut13, debut14)), [...TABLES_FICHES]);
  assert.deepEqual(tables(schema.slice(debut14)), [...TABLES_EDITION]);
  assert.deepEqual([...TABLES_VIVANTES], [...TABLES_FICHES, ...TABLES_EDITION]);
  const db = lecture(REGLES);
  for (const [i, t] of TABLES_VIVANTES.entries()) {
    for (const f of db.prepare(`PRAGMA foreign_key_list("${t}")`).all()) {
      if (TABLES_VIVANTES.includes(f.table)) assert.ok(TABLES_VIVANTES.indexOf(f.table) < i, `${t} cite ${f.table}, qui doit venir avant`);
    }
  }
  db.close();
});

test('première préparation : copie des règles, empreinte et schéma notés, section 13 vide ; rien à refaire ensuite', () => {
  const dossier = nouveau('db');
  const r = preparerBaseVivante({ regles: REGLES, dossier });
  assert.equal(r.refaite, true);
  assert.equal(r.archive, null);
  assert.equal(r.chemin, join(dossier, FICHIER_BASE));
  assert.equal(r.empreinte, empreinteFichier(REGLES));
  assert.equal(r.schema, valeur(REGLES, 'PRAGMA user_version').user_version);
  assert.deepEqual(lireEtat(dossier), { regles: r.empreinte, schema: r.schema, refaite_le: lireEtat(dossier).refaite_le });
  assert.match(lireEtat(dossier).refaite_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(valeur(r.chemin, 'SELECT count(*) AS n FROM race').n, valeur(REGLES, 'SELECT count(*) AS n FROM race').n);
  for (const t of TABLES_VIVANTES) assert.equal(valeur(r.chemin, `SELECT count(*) AS n FROM "${t}"`).n, 0, t);
  assert.deepEqual(sansArchives(dossier), [FICHIER_BASE, FICHIER_ETAT], 'aucun fichier provisoire laissé');

  const inode = statSync(r.chemin).ino;
  const encore = preparerBaseVivante({ regles: REGLES, dossier });
  assert.equal(encore.refaite, false);
  assert.equal(statSync(r.chemin).ino, inode, 'base en place gardée telle quelle');
});

test('nouvelles règles : la base est refaite, toutes les lignes de la section 13 reprises, l’ancienne base archivée', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const avant = lignesVivantes(chemin);
  assert.equal(avant.personnage.length, 2);

  const livraison = regles("UPDATE race SET nom = 'Humain (nouvelles règles)' WHERE id = 'races/humain'");
  const r = preparerBaseVivante({ regles: livraison, dossier, instant: new Date('2026-10-11T08:30:00Z') });
  assert.equal(r.refaite, true);
  assert.equal(r.empreinte, empreinteFichier(livraison));
  assert.deepEqual(lignesVivantes(chemin), avant, 'fiches, utilisateurs, rôles, groupes et inscriptions repris à l’identique');
  assert.equal(valeur(chemin, "SELECT nom FROM race WHERE id = 'races/humain'").nom, 'Humain (nouvelles règles)', 'règles de la nouvelle livraison');
  assert.equal(r.archive, join(dossier, DOSSIER_ARCHIVES, 'vivante-2026-10-11T08-30-00-000Z.db'));
  assert.deepEqual(lignesVivantes(r.archive), avant, 'l’archive est la base d’avant');
  assert.equal(valeur(r.archive, "SELECT nom FROM race WHERE id = 'races/humain'").nom, 'Humain');
  assert.equal(lireEtat(dossier).regles, r.empreinte);
  assert.deepEqual(sansArchives(dossier), [FICHIER_BASE, FICHIER_ETAT]);
  const db = lecture(chemin);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], 'aucune référence rompue');
  db.close();
});

test('une fiche qui cite une règle disparue : rien ne change, l’erreur nomme la colonne, la valeur et la table visée', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const avant = lignesVivantes(chemin);
  const inode = statSync(chemin).ino;
  const etat = readFileSync(join(dossier, FICHIER_ETAT), 'utf8');

  const sansMetier = regles(`DELETE FROM metier WHERE id = '${UN_METIER}'`);
  assert.throws(() => preparerBaseVivante({ regles: sansMetier, dossier }), (e) => {
    assert.ok(e instanceof ErreurBaseVivante, e.message);
    assert.match(e.message, /gardée telle quelle/);
    assert.deepEqual(e.problemes, [`personnage.metier_id = « ${UN_METIER} » absent de metier (1 ligne(s))`]);
    return true;
  });
  assert.equal(statSync(chemin).ino, inode);
  assert.deepEqual(lignesVivantes(chemin), avant);
  assert.equal(readFileSync(join(dossier, FICHIER_ETAT), 'utf8'), etat);
  assert.deepEqual(sansArchives(dossier), [FICHIER_BASE, FICHIER_ETAT], 'copie provisoire supprimée');
  assert.ok(!existsSync(join(dossier, DOSSIER_ARCHIVES)), 'rien archivé');

  // Clé composée (spécialité, classe) : la spécialité choisie a disparu.
  const db = new DatabaseSync(chemin);
  const specialite = db.prepare("SELECT id FROM specialite WHERE classe_id = 'classes/guerrier' ORDER BY rang LIMIT 1").get().id;
  db.prepare("UPDATE personnage_classe SET specialite_id = ? WHERE personnage_id = 'p1'").run(specialite);
  db.close();
  const sansSpecialite = regles(`DELETE FROM specialite WHERE id = '${specialite}'`);
  assert.throws(() => preparerBaseVivante({ regles: sansSpecialite, dossier }), (e) => {
    assert.deepEqual(e.problemes, [`personnage_classe.specialite_id+classe_id = « ${specialite} / classes/guerrier » absent de specialite (1 ligne(s))`]);
    return true;
  });
});

test('schéma changé : une colonne remplie qui disparaît est refusée ; une colonne ajoutée ou une colonne vide retirée passent', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const avant = lignesVivantes(chemin);

  assert.throws(() => preparerBaseVivante({ regles: regles('ALTER TABLE personnage DROP COLUMN surnom'), dossier }), (e) => {
    assert.deepEqual(e.problemes, ['personnage : surnom rempli(e)s mais absente(s) des nouvelles règles']);
    return true;
  });
  assert.deepEqual(lignesVivantes(chemin), avant);

  assert.throws(() => preparerBaseVivante({ regles: regles("ALTER TABLE groupe ADD COLUMN lieu TEXT NOT NULL DEFAULT 'x' CHECK (lieu <> 'x')"), dossier }), (e) => {
    assert.match(e.problemes[0], /^groupe : CHECK constraint failed/);
    return true;
  });

  const r = preparerBaseVivante({ regles: regles('ALTER TABLE personnage DROP COLUMN lieu_origine; ALTER TABLE personnage ADD COLUMN titre TEXT'), dossier });
  assert.equal(r.refaite, true);
  const db = lecture(chemin);
  assert.deepEqual(db.prepare('SELECT id, titre, surnom FROM personnage ORDER BY id').all().map((l) => ({ ...l })),
    [{ id: 'p1', titre: null, surnom: 'le Brave' }, { id: 'p2', titre: null, surnom: null }]);
  db.close();
});

test('archives : seulement quand la base avait des lignes, les dernières gardées ; règles contenant des fiches ou absentes refusées', () => {
  const dossier = nouveau('db');
  preparerBaseVivante({ regles: REGLES, dossier });
  assert.equal(preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain 1' WHERE id = 'races/humain'"), dossier }).archive, null, 'base vide : rien à archiver');
  remplir(join(dossier, FICHIER_BASE));
  for (let i = 0; i < ARCHIVES_GARDEES + 2; i += 1) {
    const r = preparerBaseVivante({ regles: regles(`UPDATE race SET nom = 'Humain ${i + 2}' WHERE id = 'races/humain'`), dossier, instant: new Date(Date.UTC(2026, 9, 12, 0, 0, i)) });
    assert.ok(r.archive);
  }
  const archives = readdirSync(join(dossier, DOSSIER_ARCHIVES)).sort();
  assert.equal(archives.length, ARCHIVES_GARDEES);
  assert.equal(archives.at(-1), 'vivante-2026-10-12T00-00-06-000Z.db');
  assert.equal(archives[0], 'vivante-2026-10-12T00-00-02-000Z.db', 'les plus anciennes sont supprimées');

  assert.throws(() => preparerBaseVivante({ regles: regles(`INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES ('x', 'X', '${INSTANT}')`), dossier }),
    /base des règles inattendue : table utilisateur non vide/);
  assert.throws(() => preparerBaseVivante({ regles: join(racine, 'absente.db'), dossier }), /base des règles introuvable/);
  assert.equal(lignesVivantes(join(dossier, FICHIER_BASE)).personnage.length, 2);
});

test('clesRompues : restreinte à une fiche, colonnes NULL ignorées', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  remplir(chemin);
  const db = new DatabaseSync(chemin);
  db.exec("PRAGMA foreign_keys = OFF; UPDATE personnage SET dieu_choisi_id = 'dieux/inconnu', ethnie_id = NULL WHERE id = 'p2'");
  assert.deepEqual(clesRompues(db, 'personnage'), [{ table: 'personnage', colonnes: ['dieu_choisi_id'], parent: 'dieu', valeur: 'dieux/inconnu', lignes: 1 }]);
  assert.deepEqual(clesRompues(db, 'personnage', { ou: 't.id = ?', valeurs: ['p1'] }), []);
  db.close();
});
