// Non-régression (relecture de D11) : les tests qui lisent des spécialités et des dons importés ne cassent pas quand le propriétaire en supprime depuis
// le site de dev. La PR de « Effectuer la mise à jour » n'est fusionnée que si npm test est vert (scripts/mise-a-jour-github.mjs, CONTROLES_DE_LA_CI) :
// une suppression légitime ne doit pas bloquer la livraison. Un journal qui supprime une spécialité et un don de chaque forme (ceux que des tests
// prennent en exemple quand ils existent) est rapatrié sur une copie de data/rows (db:appliquer-edition), puis ces fichiers de test tournent sur cette
// copie (MAVERICK_ROOT : la base qu'ils construisent par lib/donnees.mjs vient de ses lignes).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const CLIENT = join(RACINE, 'client');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
/** Les fichiers de test qui prennent en exemple des spécialités et des dons importés, lus dans la base construite depuis data/rows. */
const FICHIERS = ['corps-classes', 'serveur-edition-corps', 'serveur-edition-classes', 'classes-dons', 'potentiel-illimite', 'serveur-edition-rejeu-corps']
  .map((f) => `test/${f}.test.mjs`);

const tmp = dossierTemporaire('suppressions-d11');

test('une spécialité et un don de chaque forme supprimés depuis le site puis rapatriés : les tests qui lisent la base restent verts', { skip: sansPython, timeout: 900_000 }, () => {
  const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(tmp, 'db') }).chemin);
  const un = (sql, ...p) => vivante.prepare(sql).get(...p)?.id ?? null;
  const miroirs = "nom_cle NOT IN (SELECT s.nom_cle FROM specialite s WHERE s.classe_id = capacite.classe_id AND NOT EXISTS (SELECT 1 FROM capacite c WHERE c.specialite_id = s.id AND c.nature = 'specialite'))";
  const sansFiche = 'id NOT IN (SELECT capacite_id FROM personnage_capacite)';
  // chaque forme : l'exemple d'un test s'il existe encore, sinon une autre ligne de la même forme
  const cibles = [
    ['specialite', un(`SELECT s.id FROM specialite s WHERE EXISTS (SELECT 1 FROM capacite k WHERE k.specialite_id = s.id AND k.nature = 'specialite')
      ORDER BY s.id = 'classes/guerrier#specialite:maitre-darme' DESC, s.id LIMIT 1`)],
    ['capacite', un(`SELECT id FROM capacite WHERE nature = 'classe' AND ${sansFiche} ORDER BY id = 'capacites/guerrier-brave' DESC, id LIMIT 1`)],
    ['capacite', un(`SELECT id FROM capacite WHERE nature = 'classe' AND ${sansFiche} ORDER BY id = 'capacites/guerrier-hyper-contact' DESC, id DESC LIMIT 1`)],
    ['capacite', un(`SELECT id FROM capacite WHERE nature = 'choix' AND specialite_id IS NULL AND ${miroirs} AND ${sansFiche}
      ORDER BY id = 'capacites/archimage-creation-vivante' DESC, id LIMIT 1`)],
    ['capacite', un(`SELECT id FROM capacite WHERE nature = 'choix' AND specialite_id IS NOT NULL AND ${sansFiche} ORDER BY id = 'capacites/anansi-anti-corps' DESC, id LIMIT 1`)],
    ['capacite', un(`SELECT id FROM capacite WHERE nature = 'choix' AND specialite_id IS NOT NULL AND ${sansFiche} ORDER BY id = 'capacites/guerrier-affute' DESC, id DESC LIMIT 1`)],
    ['capacite', un(`SELECT id FROM capacite WHERE nature <> 'specialite' AND type_brut = 'pAsSiF' AND ${sansFiche} ORDER BY id = 'capacites/marcass-super-hache' DESC, id LIMIT 1`)],
    ['capacite', un(`SELECT id FROM capacite WHERE nature <> 'specialite' AND remarque IS NOT NULL AND ${miroirs} AND ${sansFiche}
      ORDER BY id = 'capacites/bimane-frappe-fatiguante' DESC, id LIMIT 1`)],
  ];
  let supprimees = 0;
  for (const [entite, id] of cibles) {
    // une ligne déjà partie avec une suppression précédente (un don de la spécialité supprimée) : rien à faire
    if (!id || !un(`SELECT id FROM "${entite}" WHERE id = ?`, id)) continue;
    enregistrer(vivante, { page: 'classes/', operations: [{ op: 'supprimer', entite, cle: { id } }] });
    supprimees += 1;
  }
  assert.ok(supprimees >= 6, `${supprimees} suppression(s)`);
  const journal = journalExporte(vivante);
  vivante.close();

  // une racine de dépôt de travail : data/ (schéma, dérivations, lignes) et les scripts qui construisent la base (client/scripts)
  const racine = join(tmp, 'depot');
  mkdirSync(join(racine, 'client', 'scripts'), { recursive: true });
  mkdirSync(join(racine, 'data'));
  for (const f of ['schema.sql', 'derive.sql']) copyFileSync(join(RACINE, 'data', f), join(racine, 'data', f));
  cpSync(join(RACINE, 'data', 'rows'), join(racine, 'data', 'rows'), { recursive: true });
  for (const f of ['db-build.mjs', 'db-derive.mjs', 'db-lib.mjs']) copyFileSync(join(CLIENT, 'scripts', f), join(racine, 'client', 'scripts', f));
  const application = appliquerJournal(journal, { rows: join(racine, 'data', 'rows') });
  assert.equal(application.ecrit, true, JSON.stringify(application.conflits));

  const env = { ...process.env, MAVERICK_ROOT: racine, MAVERICK_LIB: join(CLIENT, 'src', 'lib') };
  delete env.NODE_TEST_CONTEXT; // un lanceur de tests à part entière, pas un enfant du lanceur en cours
  const r = spawnSync(process.execPath, ['--no-warnings', '--test', '--test-reporter=tap', ...FICHIERS], { cwd: CLIENT, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  const echecs = r.stdout.split('\n').filter((l) => /^not ok /.test(l) || /^\s+(error|location):/.test(l));
  assert.equal(r.status, 0, `${echecs.join('\n')}\n${r.stderr.slice(-2000)}`);
});
