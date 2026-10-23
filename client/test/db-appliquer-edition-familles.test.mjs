// Rapatriement (npm run db:appliquer-edition, scripts/db-appliquer-edition.mjs) d'une famille d'armes créée sur le site de dev puis renommée, avec une
// arme créée dedans (décision R159) : rejoué sur une copie de data/rows, le journal y écrit la famille (identifiant figé, nom de lecture celui de sa
// création : migration 0077), l'arme, la section du corps de la page des armes sous le dernier bandeau, et les sources de maîtrise d'arme telles que
// le lecteur les lit (la famille dans les maîtrises au choix de sa catégorie) ; une seconde fois, rien ne change. Les noms d'essai sont absents de la base.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { ligneDArme, PAGE_DES_ARMES, titreDeSectionDeFamille } from '../src/lib/corps-armes.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { sourcesJustes } from './aide-maitrise-arme.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'maverick-rapatriement-familles-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const rows = join(tmp, 'data', 'rows');
cpSync(join(RACINE, 'data', 'rows'), rows, { recursive: true });
const lire = (dossier) => Object.fromEntries(readdirSync(dossier).map((f) => [f, readFileSync(join(dossier, f), 'utf8')]));

// sur le site de dev : une famille créée avec une arme (même lot, « @0 »), puis renommée et son dé changé
const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(tmp, 'db') }).chemin);
const NOM = `Fléaux d’essai ${process.pid}`;
const RENOMMEE = `Chaînes d’essai ${process.pid}`;
const cree = enregistrer(vivante, { page: `${PAGE_DES_ARMES}/`, operations: [
  { op: 'creer', entite: 'arme_famille', valeurs: { nom: NOM, de_brut: 'D8', categorie: 'contact', cout_libelle: 'Coût en plus/moins' } },
  { op: 'creer', entite: 'arme', valeurs: { famille_id: '@0', nom: 'Fléau d’essai', competence_brut: 'Arme Lourde', type_id: 'masse', effet: 'Dégâts frappe, +2 dégâts', depart_possible: '1' } },
] }, { instant: '2026-10-23T10:00:00Z', id: 'essai-familles-1' });
const ID = cree.crees[0].id;
const ARME = cree.crees[1].id;
enregistrer(vivante, { page: `${PAGE_DES_ARMES}/`, operations: [{ op: 'modifier', table: 'arme_famille', cle: { id: ID }, valeurs: { nom: RENOMMEE, de_brut: 'D10' } }] },
  { instant: '2026-10-23T10:05:00Z', id: 'essai-familles-2' });
const journal = journalExporte(vivante);
const corpsVivant = vivante.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_ARMES).corps_md;
const optionsVivantes = vivante.prepare('SELECT source_id, rang FROM maitrise_arme_part_famille WHERE arme_famille_id = ? ORDER BY 1, 2').all(ID).map((o) => ({ ...o }));
vivante.close();

const construire = (dossier) => {
  const sortie = join(tmp, `verif-${Math.random().toString(36).slice(2)}.db`);
  const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', sortie, '--rows', dossier], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return new DatabaseSync(sortie);
};

test('R159 : une famille créée puis renommée, avec son arme, rapatriée dans data/rows — identifiant figé, nom de lecture de création, section, sources du lecteur', () => {
  const r = appliquerJournal(journal, { rows });
  assert.equal(r.ecrit, true);
  assert.deepEqual(r.conflits, []);
  const db = construire(rows);
  const f = { ...db.prepare('SELECT * FROM arme_famille WHERE id = ?').get(ID) };
  assert.deepEqual([f.nom, f.de_brut, f.libelle_brut, f.nom_lecture, f.categorie, f.maitrisable], [RENOMMEE, 'D10', `${RENOMMEE} - D10`, NOM, 'contact', 1]);
  assert.equal(db.prepare('SELECT famille_id FROM arme WHERE id = ?').get(ARME).famille_id, ID);
  const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_ARMES).corps_md;
  assert.equal(corps, corpsVivant, 'le corps de la page est celui du site de dev');
  const lignes = corps.split('\n');
  assert.equal(lignes.filter((l) => /^## /.test(l)).at(-1), titreDeSectionDeFamille(f), 'la section de la famille, sous son dernier bandeau, à la fin');
  assert.ok(corps.endsWith(`${ligneDArme(db.prepare('SELECT * FROM arme WHERE id = ?').get(ARME))}\n`), 'son arme dans son tableau');
  assert.ok(lignes.some((l) => l.startsWith(`- Sous « ${RENOMMEE} - D10 » : `)), 'dans la liste des armes de départ');
  assert.deepEqual(db.prepare('SELECT source_id, rang FROM maitrise_arme_part_famille WHERE arme_famille_id = ? ORDER BY 1, 2').all(ID).map((o) => ({ ...o })), optionsVivantes);
  assert.ok(optionsVivantes.length > 0, 'elle entre dans les maîtrises au choix de sa catégorie');
  sourcesJustes(db, 'les sources rapatriées sont celles du lecteur');
  // l'historique du site : la famille est créée sur le site, son nom de lecture est celui de sa création (test/db-arme-famille-nom-lecture.test.mjs)
  const historique = historiqueSite(db);
  assert.ok(historique.creee('arme_famille', { id: ID }));
  assert.equal(historique.operations('arme_famille', { id: ID })[0].apres.nom_lecture, NOM);
  assert.ok(!historique.modifiee('arme_famille', { id: ID }, 'nom_lecture') || historique.creee('arme_famille', { id: ID }));
  db.close();
});

test('R159 : une seconde fois, data/rows ne change plus', () => {
  const une = lire(rows);
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  assert.equal(r.bilan.appliquees, 0);
  assert.deepEqual(lire(rows), une);
});
