// Le service tient l'index de recherche des pages (`page_fts` ; serveur/index-des-pages.mjs) : la ligne qu'il écrit est celle de la fabrication
// (scripts/db-derive.mjs, même calcul : lib/index-des-pages.mjs) ; il ajoute la ligne d'une page qui n'en a pas, retire celle d'une page partie ou en double,
// ne touche pas un index juste, ne casse rien sur une base sans index ; à son ouverture, le service répare la base qu'une version d'avant a laissée en écart et
// le note dans son journal. Base construite depuis data/rows (ou le contenu fourni : test/aide-base-de-depart.mjs) dans un dossier temporaire.
//   node --test test/serveur-index-des-pages.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { tenirLIndexDesPages } from '../serveur/index-des-pages.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { baseDeDepart } from './aide-base-de-depart.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const racine = dossierTemporaire('index-des-pages');
let n = 0;
/** La base de départ, NON dérivée (index vide), une fois : à copier, jamais à écrire. */
let depart = null;
const baseNonDerivee = () => (depart ??= baseDeDepart(join(racine, 'depart.db')));
const copie = (nom) => {
  const chemin = join(racine, `${nom}-${(n += 1)}.db`);
  copyFileSync(baseNonDerivee(), chemin);
  return chemin;
};
const lignes = (db) => db.prepare('SELECT page_id, titre, alias, tag, resume, texte FROM page_fts ORDER BY page_id, rowid').all().map((r) => ({ ...r }));
const pages = (db) => db.prepare('SELECT id FROM page ORDER BY id').all().map((r) => r.id);

test('la ligne du service est celle de la fabrication, page par page (titre, alias, étiquettes, résumé, texte sans balises ni marques)', () => {
  const chemin = copie('derivee');
  const db = new DatabaseSync(chemin);
  // une page d'essai qui porte tout ce que le calcul transforme : balises (sans texte, avec texte, mode complet, dans un code), groupe d'onglets, ancre figée,
  // couleur d'intertitre, [[lien]], un alias et une étiquette
  // (l'adresse se lit sur l'élément du mot-clé, migration 0136)
  const motCle = motsClesDeLaBase(db, { elements: false }).find((m) => m.url !== null);
  const page = db.prepare("SELECT id FROM page WHERE statut <> 'example' ORDER BY id LIMIT 1").get().id;
  db.prepare('UPDATE page SET resume = ?, corps_md = ? WHERE id = ?').run(`Résumé qui cite {{${motCle.cle}|la Fulgurance}}.`,
    `Avec {{${motCle.cle}}} et {{${motCle.cle}:}}, en code \`{{qxwvcode}}\`, et [[Ailleurs|là-bas]].\n\n::: onglets\n\n### {couleur:rouge} Premier {#premier}\nTexte.\n\n:::\n`, page);
  db.prepare('INSERT INTO alias (page_id, ordre, texte, cle) VALUES (?, 90, ?, ?)').run(page, 'Écriture d’essai', 'ecriture-dessai');
  db.prepare('INSERT OR IGNORE INTO page_tag (page_id, ordre, tag_id) VALUES (?, 90, ?)').run(page, motCle.id);
  db.close();
  const x = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-derive.mjs'), chemin], { encoding: 'utf8', cwd: RACINE });
  assert.equal(x.status, 0, `db-derive : ${x.stderr || x.stdout}`.slice(0, 2000));

  const base = new DatabaseSync(chemin);
  try {
    const fabrication = lignes(base);
    assert.deepEqual(fabrication.map((l) => l.page_id), pages(base), 'la fabrication : une ligne par page');
    const essai = fabrication.find((l) => l.page_id === page);
    assert.ok(essai.alias.includes('Écriture d’essai') && essai.tag.length > 0 && !essai.texte.includes(':::'), JSON.stringify(essai));
    assert.ok(fabrication.some((l) => l.alias) && fabrication.some((l) => l.tag), 'des pages avec alias et étiquettes');
    // tout l'index perdu, plus une ligne d'une page qui n'existe pas : le service refait chaque ligne, retire l'orpheline
    base.exec("DELETE FROM page_fts; INSERT INTO page_fts (page_id, titre, alias, tag, resume, texte) VALUES ('page/inexistante', 'x', '', '', '', 'x')");
    assert.deepEqual(tenirLIndexDesPages(base), { ajoutees: fabrication.length, retirees: 1 });
    assert.deepEqual(lignes(base), fabrication, 'les lignes du service sont celles de db-derive');
  } finally {
    base.close();
  }
});

test('une ligne en double ou en trop part, une page sans ligne la reçoit ; un index juste n’est pas touché ; une base sans index ne casse rien', () => {
  const db = new DatabaseSync(copie('ecarts'));
  try {
    assert.deepEqual(tenirLIndexDesPages(db), { ajoutees: pages(db).length, retirees: 0 }, 'l’index vide de la base non dérivée est rempli');
    const juste = lignes(db);
    // un index juste : rien n'est écrit (les deux comptes suffisent)
    const changes = db.prepare('SELECT total_changes() AS n').get().n;
    assert.deepEqual(tenirLIndexDesPages(db), { ajoutees: 0, retirees: 0 });
    assert.equal(db.prepare('SELECT total_changes() AS n').get().n, changes, 'rien d’écrit');
    // une page sans ligne et une ligne de trop, au même compte : l'écart est vu quand même
    const [a, b] = pages(db);
    db.prepare('DELETE FROM page_fts WHERE page_id = ?').run(a);
    db.prepare("INSERT INTO page_fts (page_id, titre, alias, tag, resume, texte) SELECT page_id, titre, alias, tag, resume, texte FROM page_fts WHERE page_id = ?").run(b);
    assert.deepEqual(tenirLIndexDesPages(db), { ajoutees: 1, retirees: 1 });
    assert.deepEqual(lignes(db), juste);
    // dans une transaction ouverte par l'appelant : écrit dedans, et l'annulation emporte tout
    db.exec('BEGIN');
    db.prepare('DELETE FROM page_fts WHERE page_id = ?').run(a);
    assert.deepEqual(tenirLIndexDesPages(db), { ajoutees: 1, retirees: 0 });
    assert.ok(db.isTransaction, 'la transaction de l’appelant reste ouverte');
    db.exec('ROLLBACK');
    assert.deepEqual(lignes(db), juste);
  } finally {
    db.close();
  }
  const reduite = new DatabaseSync(':memory:');
  reduite.exec('CREATE TABLE page (id TEXT PRIMARY KEY)');
  assert.deepEqual(tenirLIndexDesPages(reduite), { ajoutees: 0, retirees: 0, absente: true });
  reduite.close();
});

test('à l’ouverture, le service répare l’index (ligne manquante, ligne orpheline) et le note ; un index juste n’est pas touché', async () => {
  const regles = copie('regles');
  const dossier = join(racine, `service-${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const demarrer = async (journal) => demarrerService({
    regles, dossier, port: 0, intervalle: 0, edition: true, metriques: false, tipeee: false, atelier: false, attestation: false,
    essaiDeStructure: { intervalle: 0 }, journal: (m) => journal.push(String(m)),
  });
  const vivante = join(dossier, 'vivante.db');
  const reparee = (journal) => journal.filter((l) => /index de recherche des pages/.test(l));

  // les règles ne sont pas dérivées : la base vivante faite depuis elles n'a aucune ligne, le service les donne
  let journal = [];
  let service = await demarrer(journal);
  await service.arreter();
  let db = new DatabaseSync(vivante);
  assert.deepEqual(lignes(db).map((l) => l.page_id), pages(db));
  assert.equal(reparee(journal).length, 1, journal.join('\n'));
  assert.doesNotMatch(reparee(journal)[0], /ERREUR/);
  const juste = lignes(db);
  // une ligne perdue, une ligne d'une page qui n'existe plus (comme une version d'avant les laissait)
  db.prepare('DELETE FROM page_fts WHERE page_id = ?').run(juste[0].page_id);
  db.exec("INSERT INTO page_fts (page_id, titre, alias, tag, resume, texte) VALUES ('page/partie', 'x', '', '', '', 'x')");
  db.close();

  journal = [];
  service = await demarrer(journal);
  await service.arreter();
  db = new DatabaseSync(vivante, { readOnly: true });
  assert.deepEqual(lignes(db), juste, 'réparée');
  db.close();
  assert.deepEqual(reparee(journal).map((l) => l.match(/(\d+) ligne\(s\) ajoutée\(s\), (\d+) retirée\(s\)/)?.slice(1)), [['1', '1']], journal.join('\n'));

  // juste : rien n'est noté
  journal = [];
  service = await demarrer(journal);
  await service.arreter();
  assert.deepEqual(reparee(journal), []);
});
