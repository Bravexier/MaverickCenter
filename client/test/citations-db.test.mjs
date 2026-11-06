// Les citations d'une page dans la base (lib/citations-db.mjs ; lot de l'édition des menus et des pages, réponse du propriétaire « Refus si citée, puis
// 404 ») : un lien du wiki `[[…]]` résolu comme le site (titre, slug, alias, identifiant ; un lien ambigu compte), un lien écrit vers /regles/<slug>/ ou
// guide/<slug>, la légende d'un bloc de la chronologie ; jamais la page elle-même, jamais une colonne de clé ; une citation depuis une page d'exemple
// est marquée (elle ne bloque pas). Sur une base synthétique (le schéma), puis contre la table `lien` que db:derive tire des mêmes textes.
//   node --test test/citations-db.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { citationsBloquantes, citationsDe, citationsDesPages } from '../src/lib/citations-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

/** Une base au schéma de data/schema.sql (clés étrangères non contrôlées : seules les lignes utiles à l'essai). */
function baseDEssai() {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  db.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  const page = db.prepare("INSERT INTO page (id, type, slug, titre, titre_cle, resume, corps_md, statut, origine) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'docs')");
  const p = (id, titre, corps, { statut = 'draft', resume = null } = {}) => {
    const [type, slug] = id.split('/');
    page.run(id, type, slug, titre, slug, resume, corps, statut);
  };
  p('guide/la-cible', 'La cible', 'Elle se cite elle-même : [[La cible]], /regles/la-cible/.');
  p('guide/par-le-titre', 'Par le titre', 'Voir [[la Cible|cette page]].');
  p('guide/par-l-alias', 'Par l’alias', 'Voir [[Autre nom]].');
  p('guide/par-l-id', 'Par l’id', 'Voir [[guide/la-cible]].');
  p('guide/par-l-adresse', 'Par l’adresse', 'Voir [la cible](/regles/la-cible/#une-ancre) et [l’ancienne](/regles/avancees/la-cible/).');
  p('guide/dans-un-code', 'Dans un code', 'Pas un lien : `[[La cible]]`, ni /regles/la-cible-bis/ (un autre slug).');
  p('guide/par-le-resume', 'Par le résumé', 'Rien ici.', { resume: 'Un résumé qui renvoie à [[La cible]].' });
  p('lore/exemple', 'Exemple', 'Voir [[La cible]].', { statut: 'example' });
  // deux pages du même titre : un lien ambigu vers « Doublon » cite les deux
  p('guide/doublon', 'Doublon', 'a');
  p('races/doublon', 'Doublon', 'b');
  p('guide/ambigu', 'Ambigu', 'Voir [[Doublon]].');
  db.prepare("INSERT INTO alias (page_id, ordre, texte, cle) VALUES ('guide/la-cible', 0, 'Autre nom', 'autre-nom')").run();
  // un autre texte de la base (la définition d'un mot-clé) et une colonne de clé qui porte l'identifiant (jamais lue comme un texte)
  db.prepare("INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES ('essai', 'Essai', 'essai', 'Voir guide/la-cible.')").run();
  db.prepare("INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race', 'guide/la-cible', 'guide/la-cible', 0, 'docs')").run();
  // la légende d'un bloc de la chronologie
  db.prepare("INSERT INTO evenement (id, rang, titre, titre_cle, epoque, origine, source_ref) VALUES ('fondation', 1, 'La fondation', 'la-fondation', 'debut', 'chronologie', 'essai')").run();
  db.prepare("INSERT INTO evenement_extrait (evenement_id, rang, page_id, texte, origine, source_ref) VALUES ('fondation', 1, 'guide/la-cible', 'Un passage.', 'chronologie', 'essai')").run();
  return db;
}

test('citationsDe : lien du wiki (titre, alias, identifiant, résumé), adresse écrite, chronologie, autre table ; ni la page elle-même, ni un code, ni une clé', () => {
  const db = baseDEssai();
  const citations = citationsDe(db, 'guide/la-cible');
  const vues = citations.map((c) => `${c.table} ${JSON.stringify(c.cle)} ${c.colonne} ${c.comment}${c.exemple ? ' (exemple)' : ''}`);
  assert.deepEqual(vues.sort(), [
    'evenement_extrait {"evenement_id":"fondation","rang":1} page_id chronologie',
    'mot_cle {"id":"essai"} description adresse',
    'page {"id":"guide/par-l-adresse"} corps_md adresse',
    'page {"id":"guide/par-l-alias"} corps_md lien',
    'page {"id":"guide/par-l-id"} corps_md lien',
    'page {"id":"guide/par-le-resume"} resume lien',
    'page {"id":"guide/par-le-titre"} corps_md lien',
    'page {"id":"lore/exemple"} corps_md lien (exemple)',
  ].sort());
  // une adresse écrite deux fois dans le même texte : une seule citation
  assert.equal(citations.filter((c) => c.cle.id === 'guide/par-l-adresse').length, 1);
  // les noms pour la page : le titre de la page qui cite, la chronologie par son événement, une autre table par son nom
  assert.equal(citations.find((c) => c.cle.id === 'guide/par-le-titre').libelle, 'Par le titre');
  assert.deepEqual(citations.find((c) => c.cle.id === 'guide/par-le-titre').page, { id: 'guide/par-le-titre', titre: 'Par le titre' });
  assert.equal(citations.find((c) => c.table === 'evenement_extrait').libelle, 'Chronologie › La fondation');
  assert.equal(citations.find((c) => c.table === 'mot_cle').libelle, 'Mot-clé essai');
  // la page d'exemple en dernier, et elle seule ne bloque pas
  assert.equal(citations.at(-1).exemple, true);
  assert.equal(citationsBloquantes(citations).length, citations.length - 1);
  db.close();
});

test('citationsDesPages : un lien ambigu cite chacune de ses candidates ; une page que rien ne cite : liste vide ; une seule lecture pour plusieurs pages', () => {
  const db = baseDEssai();
  const m = citationsDesPages(db, ['guide/doublon', 'races/doublon', 'guide/ambigu', 'guide/la-cible']);
  assert.deepEqual(m.get('guide/doublon').map((c) => c.cle.id), ['guide/ambigu']);
  assert.deepEqual(m.get('races/doublon').map((c) => c.cle.id), ['guide/ambigu']);
  assert.deepEqual(m.get('guide/ambigu'), []);
  assert.deepEqual(m.get('guide/la-cible'), citationsDe(db, 'guide/la-cible'));
  assert.deepEqual([...citationsDesPages(db, []).keys()], []);
  db.close();
});

test('base du dépôt : les liens [[…]] lus dans les textes des pages sont ceux que db:derive a résolus (table lien, candidats des liens ambigus)', () => {
  const db = ouvrirBase({ sansExemples: false });
  const ids = db.prepare("SELECT page_id FROM regles_onglet_entree WHERE page_id IS NOT NULL ORDER BY page_id").all().map((r) => r.page_id);
  assert.ok(ids.length > 40, 'les pages des onglets des Règles');
  const toutes = citationsDesPages(db, ids);
  for (const id of ids) {
    const lues = new Set(toutes.get(id).filter((c) => c.table === 'page' && c.comment === 'lien' && c.colonne === 'corps_md').map((c) => c.cle.id));
    const derivees = new Set(db.prepare(`
      SELECT page_id FROM lien WHERE cible_page_id = ? AND etat = 'resolu' AND page_id <> ?
      UNION SELECT page_id FROM lien_candidat WHERE candidat_page_id = ? AND page_id <> ?`).all(id, id, id, id).map((r) => r.page_id));
    assert.deepEqual([...lues].sort(), [...derivees].sort(), id);
  }
});
