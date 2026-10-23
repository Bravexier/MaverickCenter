// Migration data/migrations/0077-arme-famille-nom-lecture.sql (décision R159 du propriétaire, 2026-10-23) : arme_famille.nom_lecture, le nom de
// lecture figé d'une famille d'armes. Le site de dev peut renommer une famille ou en créer une (R159) ; les « sauf » et les lignes nommées
// (« 1 maîtrise Épée », « (sauf épée) » : R138, R151) se lisent par le nom de la famille (lib/maitrise-arme.mjs#famillesDuNom) : nom_lecture garde le
// nom du bandeau à l'import, ou le nom de création d'une famille créée sur le site, et ne change jamais ensuite.
// La colonne, ajoutée par ADD COLUMN, n'a pas de NOT NULL (il exigerait un DEFAULT) : ce test tient l'invariant « jamais NULL ni vide » sur l'état
// courant, et lit le nom d'import dans l'historique du site (lib/historique-site.mjs), jamais une valeur figée ici.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);

test('R159 (migration 0077) : nom_lecture est la dernière colonne d’arme_famille, un texte que le CHECK refuse vide', () => {
  const colonnes = db.prepare("SELECT name, type, \"notnull\" FROM pragma_table_info('arme_famille')").all();
  assert.deepEqual({ ...colonnes.at(-1) }, { name: 'nom_lecture', type: 'TEXT', notnull: 0 });
  // une base vierge, d'après data/schema.sql (jamais var/maverick.db ni data/rows)
  const vierge = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  vierge.exec(lire('data/schema.sql'));
  const inserer = vierge.prepare(`INSERT INTO arme_famille (id, libelle_brut, nom, de_brut, cout_libelle, ordre, origine, source_ref, maitrisable, categorie, nom_lecture)
    VALUES ('essai', 'ESSAI - D8', 'ESSAI', 'D8', 'Coût', 99, 'equipement', 'essai', 1, 'contact', ?)`);
  assert.throws(() => inserer.run(''), /CHECK constraint failed/);
  inserer.run('ESSAI');
  assert.equal(vierge.prepare("SELECT nom_lecture FROM arme_famille WHERE id = 'essai'").get().nom_lecture, 'ESSAI');
  vierge.close();
});

test('R159 : chaque famille a un nom de lecture, le nom de son bandeau à l’import ou son nom de création sur le site, jamais réécrit ensuite', () => {
  const familles = db.prepare('SELECT id, nom, nom_lecture FROM arme_famille ORDER BY ordre').all();
  assert.ok(familles.length >= 12, `familles : ${familles.length}`);
  for (const f of familles) {
    assert.equal(typeof f.nom_lecture, 'string', `${f.id} : un nom de lecture (garde de 0077, pas de NOT NULL par ADD COLUMN)`);
    assert.ok(f.nom_lecture.length > 0, `${f.id} : nom de lecture vide`);
    assert.ok(!historique.modifiee('arme_famille', { id: f.id }, 'nom_lecture') || historique.creee('arme_famille', { id: f.id }),
      `${f.id} : le site ne réécrit jamais un nom de lecture`);
    if (historique.creee('arme_famille', { id: f.id })) {
      const creation = historique.operations('arme_famille', { id: f.id })[0].apres;
      assert.equal(f.nom_lecture, creation.nom, `${f.id} : une famille créée reçoit son nom de création`);
      assert.equal(f.nom_lecture, creation.nom_lecture, `${f.id} : posé à la création, jamais changé`);
    } else {
      assert.equal(f.nom_lecture, historique.valeurDImport('arme_famille', { id: f.id }, 'nom'), `${f.id} : le nom du bandeau à l’import`);
    }
  }
  // l'état d'import : les 12 bandeaux de l'onglet « Armes », chacun lu sous son nom (la migration 0077 a recopié `nom`)
  const dImport = historique.lignesDImport('arme_famille');
  assert.equal(dImport.length, 12);
  for (const f of dImport) assert.equal(f.nom_lecture, f.nom, f.id);
});
