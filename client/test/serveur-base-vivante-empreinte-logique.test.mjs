// Quand la base vivante est refaite (serveur/base-vivante.mjs#preparerBaseVivante ; lot 5 du chantier de la base de dev, PR B) : non plus quand le fichier
// des règles change d'octets, mais quand ce qu'il apporte change — son empreinte LOGIQUE (serveur/empreintes.mjs#empreinteLogique : schéma, `user_version`,
// lignes de toutes les tables hors fiches et journal, calculées comprises) ou la version de la logique de reconstruction (VERSION_DE_LA_RECONSTRUCTION).
// Dans le doute, elle est refaite. L'archive d'avant une reconstruction porte la version du service qui faisait tourner la base.
//   node --test test/serveur-base-vivante-empreinte-logique.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, test } from 'node:test';
import {
  ARCHIVES_GARDEES, DOSSIER_ARCHIVES, FICHIER_BASE, FICHIER_ETAT, TABLES_VIVANTES, VERSION_DE_LA_RECONSTRUCTION, empreinteFichier, lireEtat, ouvrirBaseVivante, preparerBaseVivante,
} from '../serveur/base-vivante.mjs';
import { empreinteLogique, empreintesDuContenu } from '../serveur/empreintes.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { SENTINELLES, poserDesFiches } from './aide-fiches-sentinelles.mjs';
import { sqlDUnCompte } from './aide-compte-d-essai.mjs';

const REGLES = cheminBase({ sansExemples: false });
let dossierDuCas;
beforeEach((t) => { dossierDuCas = dossierTemporaire('empreinte-logique', { t }); });
let compteur = 0;
const nouveau = (prefixe) => join(dossierDuCas, `${prefixe}-${(compteur += 1)}`);

/** Une copie des règles, modifiée par `sql` (clés étrangères non contrôlées). */
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

/** Les mêmes règles écrites autrement (VACUUM INTO : pages réécrites, mêmes lignes, mêmes définitions) : des octets différents, le même contenu. */
function autresOctets(source) {
  const f = `${nouveau('octets')}.db`;
  const db = new DatabaseSync(source, { readOnly: true });
  db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
  db.close();
  assert.notEqual(empreinteFichier(f), empreinteFichier(source), 'le fichier a bien d’autres octets');
  return f;
}

/** Une base vivante d'une première livraison, avec ses fiches. Rend { dossier, chemin, poses, regles }. */
function base({ version = '1.0.0' } = {}) {
  const dossier = nouveau('db');
  const livraison = regles();
  const { chemin } = preparerBaseVivante({ regles: livraison, dossier, version });
  const db = ouvrirBaseVivante(chemin);
  const poses = poserDesFiches(db);
  db.close();
  return { dossier, chemin, poses, regles: livraison };
}

const noms = (chemin) => {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return db.prepare('SELECT nom FROM personnage ORDER BY id').all().map((p) => p.nom).sort();
  } finally {
    db.close();
  }
};
const FICHES = [SENTINELLES.joueur, SENTINELLES.pretire].sort();

test('même contenu, fichier aux octets différents : la base n’est pas refaite, les fiches intactes, l’état tient les nouveaux octets', () => {
  const { dossier, chemin, regles: avant } = base();
  const inode = statSync(chemin).ino;
  const refaite = lireEtat(dossier).refaite_le;
  const autre = autresOctets(avant);
  const evenements = [];
  const r = preparerBaseVivante({ regles: autre, dossier, version: '1.0.0', evenement: (type, o) => evenements.push([type, o]) });
  assert.deepEqual([r.refaite, r.identique, r.archive], [false, true, null]);
  assert.equal(statSync(chemin).ino, inode, 'la base en place est gardée telle quelle');
  assert.deepEqual(noms(chemin), FICHES);
  assert.equal(r.empreinte, empreinteFichier(autre));
  assert.equal(lireEtat(dossier).regles, empreinteFichier(autre), 'le fichier a changé : l’état le dit, la prochaine comparaison est rapide');
  assert.equal(lireEtat(dossier).refaite_le, refaite, 'pas de reconstruction notée');
  assert.ok(!existsSync(join(dossier, DOSSIER_ARCHIVES)));
  assert.deepEqual(readdirSync(dossier).sort(), [FICHIER_BASE, FICHIER_ETAT]);
  assert.equal(evenements.filter(([t]) => t === 'empreinte_logique').length, 1);
  assert.equal(evenements.find(([t]) => t === 'empreinte_logique')[1].detail.identique, true);
  assert.ok(!evenements.some(([t]) => t === 'rejeu' || t === 'archive_base_vivante'));
  // le fichier inchangé ne demande aucun calcul : la comparaison rapide sur ses octets suffit
  const encore = [];
  const suite = preparerBaseVivante({ regles: autre, dossier, version: '1.0.0', evenement: (type) => encore.push(type) });
  assert.equal(suite.refaite, false);
  assert.deepEqual(encore, []);
});

test('ce que les règles apportent change : contenu, schéma, table calculée, plein texte — la base est refaite, les fiches reprises, l’ancienne archivée', () => {
  const changements = {
    contenu: "UPDATE race SET nom = 'Humain (autre)' WHERE id = 'races/humain'",
    'schéma d’une table de règles': 'ALTER TABLE race ADD COLUMN essai_logique TEXT',
    'schéma d’une table de fiches': 'ALTER TABLE personnage ADD COLUMN essai_logique TEXT',
    'table calculée (lien)': "UPDATE lien SET ancre = ancre || ' (périmé)' WHERE rowid = (SELECT min(rowid) FROM lien)",
    'plein texte (page_fts)': "UPDATE page_fts SET titre = titre || ' x' WHERE rowid = (SELECT min(rowid) FROM page_fts)",
    'version du schéma': 'PRAGMA user_version = 99999',
    'notes de version': 'DELETE FROM note_version_ligne WHERE rowid = (SELECT min(rowid) FROM note_version_ligne)',
  };
  for (const [quoi, sql] of Object.entries(changements)) {
    const { dossier, chemin } = base();
    const livraison = regles(sql);
    const r = preparerBaseVivante({ regles: livraison, dossier, version: '1.1.0', instant: new Date('2026-11-01T10:00:00Z') });
    assert.equal(r.refaite, true, quoi);
    assert.ok(r.archive, `${quoi} : les fiches étaient là, l’ancienne base est archivée`);
    assert.deepEqual(noms(chemin), FICHES, `${quoi} : fiches reprises`);
    assert.notEqual(lireEtat(dossier).logique, undefined);
    assert.equal(lireEtat(dossier).regles, empreinteFichier(livraison));
  }
});

test('l’empreinte logique ne dépend ni des octets ni de l’ordre ; les lignes des fiches et du journal n’y comptent pas, leur schéma si', () => {
  const a = new DatabaseSync(REGLES, { readOnly: true });
  const b = new DatabaseSync(autresOctets(REGLES), { readOnly: true });
  try {
    const ea = empreinteLogique(a, { exclues: TABLES_VIVANTES });
    assert.equal(ea.empreinte, empreinteLogique(b, { exclues: TABLES_VIVANTES }).empreinte);
    assert.ok(ea.tables > 150);
    const sansExclusion = empreinteLogique(a);
    assert.equal(sansExclusion.empreinte === ea.empreinte, false, 'les tables exclues comptent quand on ne les exclut pas (le nombre de tables lues le montre)');
    assert.ok(sansExclusion.tables > ea.tables);
  } finally {
    a.close();
    b.close();
  }
});

test('la constante de reconstruction : augmentée, la base est refaite même si le fichier des règles est le même', () => {
  const { dossier, chemin, regles: livraison } = base();
  const etat = lireEtat(dossier);
  assert.equal(etat.reconstruction, VERSION_DE_LA_RECONSTRUCTION);
  // la base a été faite par une logique plus ancienne (la constante a depuis augmenté)
  writeFileSync(join(dossier, FICHIER_ETAT), `${JSON.stringify({ ...etat, reconstruction: VERSION_DE_LA_RECONSTRUCTION - 1 })}\n`);
  const r = preparerBaseVivante({ regles: livraison, dossier, version: '1.0.0', instant: new Date('2026-11-02T10:00:00Z') });
  assert.equal(r.refaite, true);
  assert.ok(r.archive);
  assert.deepEqual(noms(chemin), FICHES);
  assert.equal(lireEtat(dossier).reconstruction, VERSION_DE_LA_RECONSTRUCTION);
  // et un fichier aux autres octets, même contenu, mais une logique plus ancienne : refaite aussi
  writeFileSync(join(dossier, FICHIER_ETAT), `${JSON.stringify({ ...lireEtat(dossier), reconstruction: VERSION_DE_LA_RECONSTRUCTION - 1 })}\n`);
  assert.equal(preparerBaseVivante({ regles: autresOctets(livraison), dossier, version: '1.0.0', instant: new Date('2026-11-02T11:00:00Z') }).refaite, true);
});

test('un état d’avant (vivante.json sans empreinte logique ni version de reconstruction) : l’ancienne règle sur le fichier, puis les deux sont écrits', () => {
  const { dossier, chemin, regles: livraison } = base();
  const { regles, schema, refaite_le: refaiteLe } = lireEtat(dossier);
  const ancien = () => writeFileSync(join(dossier, FICHIER_ETAT), `${JSON.stringify({ regles, schema, refaite_le: refaiteLe })}\n`);
  // fichier inchangé : rien n'est refait, rien n'est calculé
  ancien();
  const evenements = [];
  assert.equal(preparerBaseVivante({ regles: livraison, dossier, evenement: (t) => evenements.push(t) }).refaite, false);
  assert.deepEqual(evenements, []);
  assert.equal(lireEtat(dossier).logique, undefined);
  // fichier aux autres octets (même contenu) : sans empreinte gardée, on ne peut pas dire qu'il est identique — refaite, comme avant
  ancien();
  const autre = autresOctets(livraison);
  const r = preparerBaseVivante({ regles: autre, dossier, version: '1.0.1', instant: new Date('2026-11-03T10:00:00Z') });
  assert.equal(r.refaite, true);
  assert.deepEqual(noms(chemin), FICHES);
  const apres = lireEtat(dossier);
  assert.match(apres.logique, /^[0-9a-f]{64}$/);
  assert.equal(apres.reconstruction, VERSION_DE_LA_RECONSTRUCTION);
  assert.equal(apres.regles, empreinteFichier(autre));
  // et la livraison suivante, au même contenu, ne refait plus rien
  assert.equal(preparerBaseVivante({ regles: autresOctets(autre), dossier, version: '1.0.1' }).identique, true);
});

test('le calcul de l’empreinte logique échoue : la base est refaite', () => {
  const { dossier, chemin, regles: livraison } = base();
  const autre = autresOctets(livraison);
  const r = preparerBaseVivante({ regles: autre, dossier, version: '1.0.0', instant: new Date('2026-11-04T10:00:00Z'), calculerLogique: () => { throw new Error('calcul impossible'); } });
  assert.equal(r.refaite, true);
  assert.ok(r.archive);
  assert.deepEqual(noms(chemin), FICHES);
  assert.equal(lireEtat(dossier).logique, undefined, 'rien n’est inventé : pas d’empreinte gardée');
  // la suivante, le calcul revenu et aucune empreinte gardée : refaite encore une fois, puis gardée
  assert.equal(preparerBaseVivante({ regles: autresOctets(autre), dossier, version: '1.0.0', instant: new Date('2026-11-04T11:00:00Z') }).refaite, true);
  assert.ok(lireEtat(dossier).logique);
});

test('l’archive d’avant une reconstruction porte la version qui faisait tourner la base ; l’horodatage reste en tête', () => {
  const { dossier, regles: livraison } = base({ version: '1.0.0' });
  // une nouvelle version du service, mêmes règles : rien n'est refait, la version tenue est mise à jour
  assert.equal(preparerBaseVivante({ regles: livraison, dossier, version: '1.1.0' }).refaite, false);
  assert.equal(lireEtat(dossier).version, '1.1.0');
  const r = preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain 2' WHERE id = 'races/humain'"), dossier, version: '1.2.0', instant: new Date('2026-11-05T08:30:00Z') });
  assert.equal(r.archive, join(dossier, DOSSIER_ARCHIVES, 'vivante-2026-11-05T08-30-00-000Z-v1.1.0.db'));
  assert.equal(lireEtat(dossier).version, '1.2.0');
  // une version inconnue, ou qui ne ferait pas un nom de fichier
  const r2 = preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain 3' WHERE id = 'races/humain'"), dossier, instant: new Date('2026-11-05T09:00:00Z') });
  assert.equal(r2.archive, join(dossier, DOSSIER_ARCHIVES, 'vivante-2026-11-05T09-00-00-000Z-v1.2.0.db'));
  assert.equal(lireEtat(dossier).version, 'inconnue');
  const r3 = preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain 4' WHERE id = 'races/humain'"), dossier, version: '../../x y', instant: new Date('2026-11-05T10:00:00Z') });
  assert.equal(r3.archive, join(dossier, DOSSIER_ARCHIVES, 'vivante-2026-11-05T10-00-00-000Z-inconnue.db'));
  const r4 = preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain 5' WHERE id = 'races/humain'"), dossier, version: '2.0.0', instant: new Date('2026-11-05T11:00:00Z') });
  assert.equal(r4.archive, join(dossier, DOSSIER_ARCHIVES, 'vivante-2026-11-05T11-00-00-000Z-v.._.._x_y.db'));
  assert.ok(existsSync(r4.archive));
});

test('purge : les anciennes archives (sans version) et les nouvelles se comptent ensemble, les plus anciennes d’abord', () => {
  const { dossier } = base();
  const archives = join(dossier, DOSSIER_ARCHIVES);
  mkdirSync(archives, { recursive: true });
  const anciennes = ['2026-10-01T00-00-00-000Z', '2026-10-02T00-00-00-000Z', '2026-10-03T00-00-00-000Z'].map((h) => `vivante-${h}.db`);
  for (const f of anciennes) writeFileSync(join(archives, f), 'ancienne archive');
  writeFileSync(join(archives, 'autre-chose.txt'), 'pas une archive : jamais purgé');
  for (let i = 0; i < ARCHIVES_GARDEES; i += 1) {
    const r = preparerBaseVivante({ regles: regles(`UPDATE race SET nom = 'Humain ${i}' WHERE id = 'races/humain'`), dossier, version: `3.${i}.0`, instant: new Date(Date.UTC(2026, 10, 6, 0, 0, i)) });
    assert.ok(r.archive);
  }
  const restantes = readdirSync(archives).filter((f) => /^vivante-.+\.db$/.test(f)).sort();
  assert.equal(restantes.length, ARCHIVES_GARDEES);
  for (const f of anciennes) assert.ok(!restantes.includes(f), `${f} : plus ancienne que les archives de novembre, purgée`);
  assert.ok(restantes.every((f) => /^vivante-2026-11-06T00-00-0\d-000Z-v.+\.db$/.test(f)));
  assert.ok(existsSync(join(archives, 'autre-chose.txt')));
  // mêlées : une archive de l'ancien nom plus récente que les nouvelles prend sa place dans l'ordre
  writeFileSync(join(archives, 'vivante-2026-11-07T00-00-00-000Z.db'), 'ancienne archive plus récente');
  preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain fin' WHERE id = 'races/humain'"), dossier, version: '4.0.0', instant: new Date('2026-11-08T00:00:00Z') });
  const fin = readdirSync(archives).filter((f) => /^vivante-.+\.db$/.test(f)).sort();
  assert.equal(fin.length, ARCHIVES_GARDEES);
  assert.ok(fin.includes('vivante-2026-11-07T00-00-00-000Z.db'));
  assert.ok(fin.includes('vivante-2026-11-08T00-00-00-000Z-v3.4.0.db'));
  assert.ok(readFileSync(join(archives, 'vivante-2026-11-07T00-00-00-000Z.db'), 'utf8').startsWith('ancienne'));
});

test('l’historique, un index, une vue ou un déclencheur changés : la base est refaite (ils comptent dans ce que les règles apportent)', () => {
  const changements = {
    'historique des modifications': "INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES ('lot-essai', 1, '2026-11-01T00:00:00Z', 'Un lot', NULL, 'metier', '{\"id\":\"x\"}', 'inserer', NULL, '{\"nom\":\"x\"}')",
    'un index': 'CREATE INDEX essai_logique_idx ON race (nom)',
    'une vue': 'CREATE VIEW essai_logique_vue AS SELECT id FROM race',
    'un déclencheur': 'CREATE TRIGGER essai_logique_declencheur AFTER UPDATE ON race BEGIN SELECT 1; END',
  };
  for (const [quoi, sql] of Object.entries(changements)) {
    const { dossier, chemin } = base();
    const r = preparerBaseVivante({ regles: regles(sql), dossier, version: '1.1.0', instant: new Date('2026-11-09T10:00:00Z') });
    assert.equal(r.refaite, true, quoi);
    assert.equal(r.identique, undefined, quoi);
    assert.deepEqual(noms(chemin), FICHES, `${quoi} : fiches reprises`);
  }
});

test('l’empreinte logique ne dépend pas de l’ordre des lignes : une table réécrite à l’envers, même contenu, la base est gardée', () => {
  const { dossier, chemin, regles: avant } = base();
  const renversee = regles(`CREATE TABLE essai_ordre AS SELECT * FROM race ORDER BY rowid DESC; DELETE FROM race; INSERT INTO race SELECT * FROM essai_ordre; DROP TABLE essai_ordre;`);
  const premier = (f) => valeur(f, 'SELECT id FROM race ORDER BY rowid LIMIT 1').id;
  assert.notEqual(premier(renversee), premier(avant), 'l’ordre physique des lignes a bien changé');
  const r = preparerBaseVivante({ regles: renversee, dossier, version: '1.0.0' });
  assert.deepEqual([r.refaite, r.identique], [false, true]);
  assert.deepEqual(noms(chemin), FICHES);
});

function valeur(f, sql) {
  const db = new DatabaseSync(f, { readOnly: true });
  try {
    return db.prepare(sql).get();
  } finally {
    db.close();
  }
}

test('un fichier des règles qui porte un compte ou une fiche, avec la même empreinte logique, est une erreur : la base n’est pas gardée en silence', () => {
  for (const sql of [
    sqlDUnCompte('x', 'X', '2026-10-10T00:00:00Z'),
    "INSERT INTO groupe (id, nom, nature, cree_le) VALUES ('g', 'G', 'campagne', '2026-10-10T00:00:00Z')",
  ]) {
    const { dossier, chemin, regles: livraison } = base();
    const avant = lireEtat(dossier);
    const inode = statSync(chemin).ino;
    // mêmes lignes de règles, autres octets, plus une ligne qui n'a rien à faire là
    const fautif = autresOctets(livraison);
    const db = new DatabaseSync(fautif);
    db.exec(sql);
    db.close();
    assert.throws(() => preparerBaseVivante({ regles: fautif, dossier, version: '1.0.0' }), /base des règles inattendue : table (utilisateur|groupe) non vide/);
    assert.deepEqual(lireEtat(dossier), avant, 'rien n’est écrit');
    assert.equal(statSync(chemin).ino, inode);
    assert.deepEqual(noms(chemin), FICHES);
    assert.deepEqual(readdirSync(dossier).sort(), [FICHIER_BASE, FICHIER_ETAT], 'aucune copie laissée');
  }
});

test('un état qui ne peut pas s’écrire (disque plein) n’empêche pas de garder la base : une note, la préparation réussit', () => {
  const { dossier, regles: livraison } = base({ version: '1.0.0' });
  const avant = lireEtat(dossier);
  // le fichier provisoire de vivante.json est un dossier : toute écriture y échoue (EISDIR), même pour root
  mkdirSync(join(dossier, `.${FICHIER_ETAT}.${process.pid}`));
  const notes = [];
  const identique = preparerBaseVivante({ regles: autresOctets(livraison), dossier, version: '1.0.0', journal: (m) => notes.push(m) });
  assert.deepEqual([identique.refaite, identique.identique], [false, true]);
  assert.ok(notes.some((n) => /état n'a pas pu être écrit/.test(n)), notes.join(' | '));
  assert.deepEqual(lireEtat(dossier), avant, 'l’ancien état reste');
  // la comparaison rapide : une nouvelle version du service, mêmes octets — même échec, même note, même réussite
  notes.length = 0;
  const rapide = preparerBaseVivante({ regles: livraison, dossier, version: '1.2.0', journal: (m) => notes.push(m) });
  assert.equal(rapide.refaite, false);
  assert.equal(notes.length, 1);
});

test('base du site de dev : un lot du journal, des octets différents — la base gardée est celle qu’une reconstruction forcée donne', () => {
  const { dossier, chemin, regles: livraison } = base();
  const db = ouvrirBaseVivante(chemin);
  enregistrer(db, { page: 'metiers/', operations: [{ op: 'creer', entite: 'metier', valeurs: { nom: 'Essai du site de dev', description: 'Un métier d’essai.', bonus_brut: '+1 INI' } }] });
  db.close();
  const autre = autresOctets(livraison);
  const jumelle = join(dossierDuCas, 'jumelle');
  cpSync(dossier, jumelle, { recursive: true });
  // gardée
  const gardee = preparerBaseVivante({ regles: autre, dossier, version: '1.0.0' });
  assert.equal(gardee.identique, true);
  // refaite de force (une logique de reconstruction plus ancienne), sur les mêmes règles
  writeFileSync(join(jumelle, FICHIER_ETAT), `${JSON.stringify({ ...lireEtat(jumelle), reconstruction: VERSION_DE_LA_RECONSTRUCTION - 1 })}\n`);
  const forcee = preparerBaseVivante({ regles: autre, dossier: jumelle, version: '1.0.0', instant: new Date('2026-11-10T10:00:00Z') });
  assert.equal(forcee.refaite, true);
  const lire = (d) => {
    const base2 = new DatabaseSync(join(d, FICHIER_BASE), { readOnly: true });
    try {
      return {
        contenu: empreintesDuContenu(base2),
        journal: base2.prepare('SELECT lot_id, rang, table_nom, cle, operation, etat FROM modification ORDER BY lot_id, rang').all().map((l) => ({ ...l })),
        lots: base2.prepare('SELECT id, resume, resolu_le FROM modification_lot ORDER BY id').all().map((l) => ({ ...l })),
        fiches: base2.prepare('SELECT nom FROM personnage ORDER BY id').all().map((p) => p.nom),
      };
    } finally {
      base2.close();
    }
  };
  const [a, b] = [lire(dossier), lire(jumelle)];
  assert.ok(a.journal.length >= 1 && a.journal.every((l) => l.etat === 'en_attente'));
  assert.deepEqual(a, b, 'contenu, journal, lots et fiches : les mêmes');
  assert.deepEqual(a.fiches.sort(), FICHES);
});
