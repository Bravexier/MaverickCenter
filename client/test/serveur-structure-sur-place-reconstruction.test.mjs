// Les migrations reçues par une base REFAITE (client/serveur/base-vivante.mjs#preparerBaseVivante, serveur/structure-sur-place.mjs#noterLesMigrationsRecues ;
// lot 7 du chantier de la base de dev) : après une reconstruction, chaque migration livrée de numéro <= user_version que la table `migration_recue` ne
// note pas encore y entre en mode « reconstruction » ; une ligne déjà notée (« sur_place » comprise) n'est jamais réécrite ; une ligne dont le numéro dépasse
// la version de la base refaite (retour à une version plus ancienne) est retirée ; `version_du_site` : la version livrée si elle est X.Y.Z, sinon NULL ;
// migrations non livrées : rien n'est noté, sans erreur, et le service le dit dans son journal.
//   node --test test/serveur-structure-sur-place-reconstruction.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, test } from 'node:test';
import { FICHIER_BASE, FICHIER_ETAT, lireEtat, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { lireLesMigrations, noterLesMigrationsRecues } from '../serveur/structure-sur-place.mjs';
import { sha256 } from '../serveur/partage.mjs';
import { poserDesFiches } from './aide-fiches-sentinelles.mjs';
import { baseDesRegles, nouveauChemin, nouveauDossier } from './aide-structure-sur-place.mjs';

const livre = lireLesMigrations({ avecSql: false });
const V = livre.migrations.at(-1).numero;
let dossierDuCas;
beforeEach((t) => { dossierDuCas = nouveauDossier('reconstruction', t); });

/** Une copie des règles, modifiée par `sql` (clés étrangères non contrôlées). */
function regles(sql = '') {
  const f = nouveauChemin('regles');
  copyFileSync(baseDesRegles(), f);
  if (sql) {
    const db = new DatabaseSync(f, { enableForeignKeyConstraints: false });
    db.exec(sql);
    db.close();
  }
  return f;
}
const dossierDeBase = () => nouveauChemin('db', '');

/** Les lignes de `migration_recue` de la base vivante du dossier, par numéro. */
function recues(dossier) {
  const db = new DatabaseSync(join(dossier, FICHIER_BASE), { readOnly: true });
  try {
    return db.prepare('SELECT numero, fichier, empreinte, recue_le, mode, version_du_site FROM migration_recue ORDER BY numero').all().map((r) => ({ ...r }));
  } finally {
    db.close();
  }
}
const ouvrirEnEcriture = (dossier) => ouvrirBaseVivante(join(dossier, FICHIER_BASE));
const jusqua = (version) => livre.migrations.filter((m) => m.numero <= version);
// une migration livrée du milieu de la liste, jamais un numéro figé : les numéros ne se suivent pas (les migrations de données sortent du dépôt avec le
// contenu, jour J du lot 12)
const MANQUANTE = livre.migrations[Math.floor(livre.migrations.length / 2)].numero;

test('première base vivante : une ligne « reconstruction » par migration livrée de numéro <= user_version, avec l’empreinte du fichier, l’instant et la version', () => {
  const dossier = dossierDeBase();
  const messages = [];
  const r = preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3', instant: new Date('2026-11-12T10:20:30.789Z'), journal: (m) => messages.push(m) });
  assert.equal(r.refaite, true);
  assert.equal(r.schema, V);
  assert.deepEqual([r.migrations.table, r.migrations.livrees, r.migrations.notees, r.migrations.retirees, r.migrations.ecarts], [true, true, jusqua(V).length, 0, []]);
  const lignes = recues(dossier);
  assert.deepEqual(lignes, jusqua(V).map((m) => ({ numero: m.numero, fichier: m.fichier, empreinte: m.empreinte, recue_le: '2026-11-12T10:20:30Z', mode: 'reconstruction', version_du_site: '1.2.3' })));
  assert.ok(lignes.length > 100, 'tout l’historique des migrations livrées');
  assert.deepEqual(messages, [], 'rien à dire au journal : tout est noté');
});

test('une version « -dev » ou absente est notée NULL', () => {
  for (const [version, attendue] of [['1.2.3-dev', null], [null, null], ['1.2', null]]) {
    const dossier = dossierDeBase();
    preparerBaseVivante({ regles: regles(), dossier, version });
    assert.ok(recues(dossier).every((l) => l.version_du_site === attendue), String(version));
    assert.ok(recues(dossier).length > 100);
  }
});

test('une reconstruction suivante : les lignes notées ne sont jamais réécrites (« sur_place » comprise), les manquantes entrent, celles d’une version future sortent', () => {
  const dossier = dossierDeBase();
  preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3', instant: new Date('2026-11-12T10:20:30Z') });
  const db = ouvrirEnEcriture(dossier);
  // une migration reçue sur place (autre instant, autre version), une ligne qui manque, une ligne d'une migration que cette base n'a pas reçue
  db.prepare("UPDATE migration_recue SET mode = 'sur_place', recue_le = '2026-01-01T00:00:00Z', version_du_site = '0.9.9' WHERE numero = ?").run(V);
  db.prepare('DELETE FROM migration_recue WHERE numero = ?').run(MANQUANTE);
  db.prepare("INSERT INTO migration_recue (numero, fichier, empreinte, recue_le, mode, version_du_site) VALUES (?, ?, ?, '2026-01-01T00:00:00Z', 'sur_place', NULL)")
    .run(V + 1, `${String(V + 1).padStart(4, '0')}-future.sql`, sha256('future'));
  db.close();
  const avant = recues(dossier);
  assert.equal(avant.length, jusqua(V).length, 'une ligne manque, une ligne de trop');

  const r = preparerBaseVivante({ regles: regles("UPDATE race SET nom = nom || ' (essai)' WHERE id = (SELECT min(id) FROM race)"), dossier, version: '1.3.0-dev', instant: new Date('2026-12-01T08:00:00Z') });

  assert.equal(r.refaite, true);
  assert.deepEqual([r.migrations.notees, r.migrations.retirees], [1, 1]);
  const apres = recues(dossier);
  assert.deepEqual(apres.map((l) => l.numero), jusqua(V).map((m) => m.numero), 'la ligne de la version future est retirée, celle qui manquait est notée');
  for (const l of apres) {
    if (l.numero === MANQUANTE) {
      const { fichier, empreinte } = livre.migrations.find((m) => m.numero === MANQUANTE);
      assert.deepEqual(l, { numero: MANQUANTE, fichier, empreinte, recue_le: '2026-12-01T08:00:00Z', mode: 'reconstruction', version_du_site: null });
    } else assert.deepEqual(l, avant.find((x) => x.numero === l.numero), `${l.numero} : jamais réécrite`);
  }
  assert.equal(apres.find((l) => l.numero === V).mode, 'sur_place');
});

test('retour à une version plus ancienne : les lignes dont le numéro dépasse la version de la base refaite sont retirées, les autres gardées', () => {
  const dossier = dossierDeBase();
  preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3', instant: new Date('2026-11-12T10:20:30Z') });
  const avant = recues(dossier);
  const plusAncienne = V - 5;

  const r = preparerBaseVivante({ regles: regles(`PRAGMA user_version = ${plusAncienne}`), dossier, version: '1.2.4' });

  assert.equal(r.refaite, true);
  assert.equal(r.schema, plusAncienne);
  assert.equal(r.migrations.retirees, jusqua(V).length - jusqua(plusAncienne).length, 'les migrations livrées au-delà de la version refaite');
  assert.deepEqual(recues(dossier), avant.filter((l) => l.numero <= plusAncienne));
});

test('une base d’avant la table (version 128, sans migration_recue) refaite : ses fiches reprises, toutes les migrations notées « reconstruction »', () => {
  const dossier = dossierDeBase();
  preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3' });
  const db = ouvrirEnEcriture(dossier);
  const poses = poserDesFiches(db);
  db.exec('DROP TABLE migration_recue');
  db.close();
  rmSync(join(dossier, FICHIER_ETAT)); // l'état de la base d'avant n'existe plus : elle est refaite depuis les règles

  const r = preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3', instant: new Date('2026-11-12T10:20:30Z') });

  assert.equal(r.refaite, true);
  assert.equal(recues(dossier).length, jusqua(V).length);
  assert.ok(recues(dossier).every((l) => l.mode === 'reconstruction'));
  const base = new DatabaseSync(join(dossier, FICHIER_BASE), { readOnly: true });
  try {
    assert.ok(base.prepare('SELECT 1 FROM personnage WHERE id = ?').get(poses.pretire), 'la fiche est reprise');
  } finally {
    base.close();
  }
});

test('migrations non livrées : rien n’est noté, sans erreur, le journal du service le dit ; les lignes d’une version future sont tout de même retirées', () => {
  for (const migrations of [null, join(dossierDuCas, 'absent')]) {
    const dossier = dossierDeBase();
    const messages = [];
    const r = preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3', migrations, journal: (m) => messages.push(m) });
    assert.equal(r.refaite, true);
    assert.deepEqual([r.migrations.livrees, r.migrations.notees], [false, 0]);
    assert.deepEqual(recues(dossier), []);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /migrations non livrées/);
  }
  // une base qui avait déjà ses lignes : un retour à une version plus ancienne les retire, livrées ou non
  const dossier = dossierDeBase();
  preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3' });
  const r = preparerBaseVivante({ regles: regles(`PRAGMA user_version = ${V - 3}`), dossier, version: '1.2.3', migrations: null });
  assert.equal(r.migrations.retirees, 3);
  assert.deepEqual(recues(dossier).map((l) => l.numero), jusqua(V - 3).map((m) => m.numero));
});

test('un fichier livré dont l’empreinte n’est plus celle de la ligne notée : la ligne reste, l’écart est dit (une migration fusionnée ne se modifie plus)', () => {
  const migrations = nouveauDossier('migrations-factices', null);
  writeFileSync(join(migrations, '0002-premiere.sql'), 'SELECT 1;');
  writeFileSync(join(migrations, '0003-seconde.sql'), 'SELECT 2;');
  writeFileSync(join(migrations, `${String(V + 50).padStart(4, '0')}-future.sql`), 'SELECT 3;');
  writeFileSync(join(migrations, '0003-seconde.json'), '{}');
  const dossier = dossierDeBase();
  preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3', migrations });
  assert.deepEqual(recues(dossier).map((l) => l.numero), [2, 3], 'une migration plus récente que la base n’est pas encore reçue ; un .json n’est pas une migration');
  const avant = recues(dossier);

  writeFileSync(join(migrations, '0003-seconde.sql'), 'SELECT 2 /* modifiée */;');
  const messages = [];
  const r = preparerBaseVivante({ regles: regles("UPDATE race SET nom = nom || ' (autre)' WHERE id = (SELECT min(id) FROM race)"), dossier, version: '1.2.3', migrations, journal: (m) => messages.push(m) });

  assert.deepEqual(r.migrations.ecarts, [3]);
  assert.deepEqual(recues(dossier), avant, 'la ligne notée n’est pas réécrite');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /\b3\b/);
});

test('une note qui échoue n’arrête pas la reconstruction : la base refaite est gardée, l’erreur est au journal et dans le résultat', () => {
  const migrations = nouveauDossier('migrations-doublon', null);
  writeFileSync(join(migrations, '0002-a.sql'), 'SELECT 1;');
  writeFileSync(join(migrations, '0002-b.sql'), 'SELECT 1;');
  const dossier = dossierDeBase();
  const messages = [];
  const r = preparerBaseVivante({ regles: regles(), dossier, version: '1.2.3', migrations, journal: (m) => messages.push(m) });
  assert.equal(r.refaite, true);
  assert.match(r.migrations.erreur, /deux fichiers portent le numéro 0002/);
  assert.equal(r.migrations.notees, 0);
  assert.deepEqual(recues(dossier), []);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /^ERREUR base vivante : la base refaite est gardée, mais ses migrations reçues ne sont pas notées/);
  assert.equal(lireEtat(dossier).schema, V, 'la base refaite est servie, son état écrit');
});

test('une base gardée telle quelle (même contenu) ne touche pas à la table : aucun appel, aucune ligne de plus', () => {
  const dossier = dossierDeBase();
  const f = regles();
  preparerBaseVivante({ regles: f, dossier, version: '1.2.3', instant: new Date('2026-11-12T10:20:30Z') });
  const avant = recues(dossier);
  const r = preparerBaseVivante({ regles: f, dossier, version: '1.2.4', instant: new Date('2026-12-01T00:00:00Z') });
  assert.equal(r.refaite, false);
  assert.equal(r.migrations, undefined);
  assert.deepEqual(recues(dossier), avant);
});

test('noterLesMigrationsRecues : la table absente (base d’avant la 0129) ne fait rien, sans erreur', () => {
  const db = new DatabaseSync(regles());
  try {
    db.exec('DROP TABLE migration_recue');
    assert.deepEqual(noterLesMigrationsRecues(db, {}), { table: false, livrees: false, notees: 0, retirees: 0, ecarts: [] });
  } finally {
    db.close();
  }
});
