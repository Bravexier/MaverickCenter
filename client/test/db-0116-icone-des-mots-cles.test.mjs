// Migration data/migrations/0116-icone-des-mots-cles.sql (lot « mots-clés : ID entier, clé, catégories, synonymes ») : la colonne mot_cle.icone,
// une référence « <famille>:<id> » d'une icône du site (sur le modèle de mot_cle.couleur), NULL sans icône ; les trois mots-clés d'une monnaie
// reçoivent l'icône de leur monnaie (« monnaie:<id> », lib/monnaies.mjs#MONNAIES_DU_JEU).
// L'icône est modifiable sur le site de dev, source de ce qu'il modifie : ce que la migration a posé se lit à l'import
// (lib/historique-site.mjs#lignesDImport) ; l'état courant ne porte que la forme et la famille connue. Le CHECK se vérifie sur une base neuve en
// mémoire (data/schema.sql), jamais sur la base.
//   node --test test/db-0116-icone-des-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { MONNAIES_DU_JEU } from '../src/lib/monnaies.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const IDS_DES_MONNAIES = new Set(Object.values(MONNAIES_DU_JEU).map((m) => m.id));

test('structure : mot_cle.icone, texte nullable, ajoutée en dernier', () => {
  const colonnes = db.prepare('PRAGMA table_info(mot_cle)').all();
  const icone = colonnes.at(-1);
  assert.deepEqual([icone.name, icone.type, icone.notnull, icone.dflt_value], ['icone', 'TEXT', 0, null]);
});

test('contrainte (base neuve) : « famille:id » en minuscules, ou NULL ; le reste refusé', () => {
  const essai = new DatabaseSync(':memory:');
  essai.exec(SCHEMA);
  const poser = (icone) => essai.prepare("INSERT INTO mot_cle (id, libelle, cle, icone) VALUES (1, 'Essai', 'essai', ?)").run(icone);
  for (const icone of ['monnaie:rf', 'monnaie:pp', 'famille:id-compose', 'famille:x2', null]) {
    poser(icone);
    essai.exec('DELETE FROM mot_cle WHERE id = 1');
  }
  for (const icone of ['', 'monnaie', 'monnaie:', ':rf', 'Monnaie:rf', 'monnaie:RF', 'mon-naie:rf', 'monnaie:r f', 'monnaie:rf:x', 'monnaie:rf-', 'monnaie:r--f', '#a1b2c3']) {
    assert.throws(() => poser(icone), /CHECK/, JSON.stringify(icone));
  }
  essai.close();
});

test('import : chaque mot-clé d’une monnaie a l’icône de sa monnaie, et lui seul en a une', () => {
  const motsCles = historiqueSite(db).lignesDImport('mot_cle');
  const deMonnaie = motsCles.filter((m) => m.monnaie_id !== null);
  assert.ok(deMonnaie.length > 0);
  for (const m of deMonnaie) assert.equal(m.icone, `monnaie:${m.monnaie_id}`, `mot-clé ${m.id}`);
  assert.deepEqual(motsCles.filter((m) => m.monnaie_id === null && m.icone !== null).map((m) => m.id), []);
});

test('état courant : une icône est NULL ou « monnaie:<id> » d’une monnaie du site (la seule famille aujourd’hui)', () => {
  // la famille « monnaie » : les dessins des monnaies (lib/monnaies.mjs#MONNAIES_DU_JEU, classe piece--<id>) ; une famille nouvelle s'ajoute ici
  const fautes = db.prepare('SELECT id, icone FROM mot_cle WHERE icone IS NOT NULL').all()
    .filter(({ icone }) => !(icone.startsWith('monnaie:') && IDS_DES_MONNAIES.has(icone.slice('monnaie:'.length))))
    .map((m) => `${m.id} : ${m.icone}`);
  assert.deepEqual(fautes, []);
});
