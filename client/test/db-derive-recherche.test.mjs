// La recherche plein texte de la base (table page_fts, remplie par scripts/db-derive.mjs#textePlein) indexe le texte tel qu'il s'affiche : depuis la
// migration 0098, un lien est une balise du glossaire, souvent sans texte (« {{orios}} », « {{lequipement}} »), et le mot affiché est le libellé du
// mot-clé (« Orios », « L’équipement ») ; chaque balise est donc remplacée par son texte affiché (le texte écrit, sinon le libellé ; « Libellé :
// définition » pour le mode complet : lib/mots-cles-balises.mjs#texteSansBalises), dans le corps, le titre et le résumé. L'id d'un mot-clé n'est pas
// indexé. Base construite depuis data/rows dans un dossier temporaire, une page d'essai réécrite avant db-derive.
//   node --test test/db-derive-recherche.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const lancer = (script, args) => {
  const x = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', script), ...args], { encoding: 'utf8', cwd: RACINE });
  assert.equal(x.status, 0, `${script} : ${x.stderr || x.stdout}`.slice(0, 2000));
};

test('page_fts : une page qui cite {{orios}} est trouvée par « Orios » ; une balise s’indexe par son texte affiché, jamais par l’id du mot-clé', (t) => {
  const base = join(dossierTemporaire('derive-recherche', { t }), 'regles.db');
  lancer('db-build.mjs', ['--out', base]);
  const db = new DatabaseSync(base);
  assert.equal(db.prepare("SELECT libelle FROM mot_cle WHERE id = 'orios'").get()?.libelle, 'Orios', 'le mot-clé de la race (migration 0098)');
  // un mot-clé d'essai dont l'id ne partage aucun mot avec son libellé, et un autre en mode complet (sa définition s'affiche)
  const insMotCle = db.prepare('INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES (?, ?, ?, ?)');
  insMotCle.run('qxwv-lien', 'Zorglubienne écarlate', normalize('Zorglubienne écarlate'), null);
  insMotCle.run('qxwv-complet', 'Essai complet', normalize('Essai complet'), 'Définition qui cite la Brumolithe.');
  const page = db.prepare("SELECT id FROM page WHERE statut <> 'example' ORDER BY id LIMIT 1").get().id;
  db.prepare('UPDATE page SET titre = ?, titre_cle = ?, resume = ?, corps_md = ? WHERE id = ?').run(
    'Page d’essai', normalize('Page d’essai'), 'Résumé qui cite {{qxwv-lien|la Fulgurance}}.',
    'Rencontre avec {{orios}}, puis {{qxwv-lien}} et {{qxwv-complet:}}. En code : `{{qxwvcode}}`.', page);
  db.close();
  lancer('db-derive.mjs', [base]);

  const lue = new DatabaseSync(base, { readOnly: true });
  const trouvees = (requete) => lue.prepare('SELECT page_id FROM page_fts WHERE page_fts MATCH ?').all(requete).map((r) => r.page_id);
  assert.ok(trouvees('texte:Orios').includes(page), '« Orios » trouve la page qui cite {{orios}}');
  assert.ok(trouvees('texte:zorglubienne').includes(page), 'le libellé d’une balise sans texte');
  assert.deepEqual(trouvees('qxwv'), [], 'l’id d’un mot-clé n’est pas indexé (hors code)');
  assert.ok(trouvees('texte:brumolithe').includes(page), 'le mode complet : « Libellé : définition »');
  assert.ok(trouvees('resume:fulgurance').includes(page), 'le résumé : le texte écrit de la balise');
  assert.ok(trouvees('texte:qxwvcode').includes(page), 'une balise dans un code reste écrite, comme à l’affichage');
  const { texte } = lue.prepare('SELECT texte FROM page_fts WHERE page_id = ?').get(page);
  assert.equal(texte, 'Rencontre avec Orios, puis Zorglubienne écarlate et Essai complet : Définition qui cite la Brumolithe.. En code : {{qxwvcode}} .');
  lue.close();
});
