// Migration data/migrations/0116-icone-des-mots-cles.sql (lot « mots-clés : ID entier, clé, catégories, synonymes ») : la colonne mot_cle.icone,
// une référence « <famille>:<id> » d'une icône du site (sur le modèle de mot_cle.couleur), NULL sans icône ; les trois mots-clés d'une monnaie
// reçoivent l'icône de leur monnaie (« monnaie:<id> », lib/monnaies.mjs#MONNAIES_DU_JEU).
// L'icône est modifiable sur le site de dev, source de ce qu'il modifie : ce que la migration a posé se lit à l'import
// (test/aide-base-d-import.mjs#baseDImport) ; l'état courant ne porte que la forme et la famille connue. Le CHECK se vérifie sur une base neuve en
// mémoire (data/schema.sql), jamais sur la base.
//   node --test test/db-0116-icone-des-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { fauteDeLIcone, ICONES } from '../src/lib/icones.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { testRetireAvecLesMixtes } from './aide-sortie-du-contenu.mjs';

// Les tests qui éprouvent la migration mixte elle-même sortent avec elle (src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LES_MIXTES).
const testDeLaMixte = testRetireAvecLesMixtes(import.meta.url);

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const migration = () => readFileSync(new URL('../../data/migrations/0116-icone-des-mots-cles.sql', import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });

// Depuis la migration 0136 (retrait des colonnes de mot_cle), l'icône se lit sur l'élément du mot-clé : la colonne `icone` de son repère ou de sa page,
// même forme et même CHECK que l'ancienne mot_cle.icone.
test('structure : l’icône, texte nullable, n’est plus une colonne de mot_cle depuis la 0136 : celle du repère et de la page', () => {
  assert.ok(!db.prepare('PRAGMA table_info(mot_cle)').all().some((c) => c.name === 'icone'), 'mot_cle.icone retirée (0136)');
  for (const table of ['repere', 'page']) {
    const icone = db.prepare(`PRAGMA table_info(${table})`).all().find((c) => c.name === 'icone');
    assert.deepEqual([icone?.name, icone?.type, icone?.notnull, icone?.dflt_value], ['icone', 'TEXT', 0, null], table);
  }
});

test('contrainte (base neuve, sur le repère) : « famille:id » en minuscules, ou NULL ; le reste refusé', () => {
  const essai = new DatabaseSync(':memory:');
  essai.exec(SCHEMA);
  essai.exec("INSERT INTO mot_cle (id, cle) VALUES (1, 'essai')");
  const poser = (icone) => essai.prepare("INSERT INTO repere (mot_cle_id, nom, icone) VALUES (1, 'Essai', ?)").run(icone);
  const retirer = () => essai.exec('DELETE FROM repere WHERE mot_cle_id = 1');
  for (const icone of ['monnaie:rf', 'monnaie:pp', 'famille:id-compose', 'famille:x2', null]) {
    poser(icone);
    retirer();
  }
  for (const icone of ['', 'monnaie', 'monnaie:', ':rf', 'Monnaie:rf', 'monnaie:RF', 'mon-naie:rf', 'monnaie:r f', 'monnaie:rf:x', 'monnaie:rf-', 'monnaie:r--f', '#a1b2c3']) {
    assert.throws(() => poser(icone), /CHECK/, JSON.stringify(icone));
  }
  // chaque icône de la liste du site (lib/icones.mjs#ICONES : monnaies, dégâts, magies) passe le CHECK : le service et db:check l'acceptent, la
  // base doit pouvoir l'écrire (« magie:espace-temps », « magie:potentiel-illimite » : un id composé)
  for (const { valeur } of ICONES) {
    assert.doesNotThrow(() => poser(valeur), valeur);
    retirer();
  }
  essai.close();
});

// Le site de dev peut poser une icône sur tout mot-clé (essai mécanique, variante V1) : sa saisie laisse sa trace, que l'état d'import défait ; la
// migration elle-même n'en pose qu'aux mots-clés d'une monnaie. L'icône se lit sur l'élément (vue v_mot_cle, migration 0136).
test('import : chaque mot-clé d’une monnaie a l’icône de sa monnaie, et lui seul en a une', () => {
  const motsCles = baseDImport().prepare('SELECT id, monnaie_id, icone FROM v_mot_cle ORDER BY id').all();
  const deMonnaie = motsCles.filter((m) => m.monnaie_id !== null);
  assert.ok(deMonnaie.length > 0);
  for (const m of deMonnaie) assert.equal(m.icone, `monnaie:${m.monnaie_id}`, `mot-clé ${m.id}`);
  assert.deepEqual(motsCles.filter((m) => m.monnaie_id === null && m.icone !== null).map((m) => m.id), []);
});

testDeLaMixte('migration : sa seule écriture de données pose l’icône de la monnaie sur les mots-clés d’une monnaie', () => {
  // commentaires de ligne entière seulement : le CHECK de la colonne contient « -- »
  const instructions = migration().replace(/^\s*--.*$/gm, '').split(';').map((i) => i.replace(/\s+/g, ' ').trim()).filter((i) => /^UPDATE\b/i.test(i));
  assert.deepEqual(instructions, ["UPDATE mot_cle SET icone = 'monnaie:' || monnaie_id WHERE monnaie_id IS NOT NULL"]);
});

test('état courant : une icône est NULL ou une icône de la liste du site (lib/icones.mjs#ICONES : monnaies, dégâts, magies ; la règle de db:check)', () => {
  const fautes = db.prepare('SELECT id, icone FROM v_mot_cle WHERE icone IS NOT NULL').all()
    .filter(({ icone }) => fauteDeLIcone(icone) !== null)
    .map((m) => `${m.id} : ${m.icone}`);
  assert.deepEqual(fautes, []);
});
