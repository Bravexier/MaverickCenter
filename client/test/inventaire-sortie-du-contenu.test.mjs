// Lot 12, inventaire de ce qui sort du dépôt (scripts/inventaire-sortie-du-contenu.mjs et sa bibliothèque) : classement des catégories, comptes,
// lecteurs trouvés par motif (chemin écrit en clair ou construit), section du document entre marqueurs, `--verifier`, publications.
// Un petit arbre git jetable, sans rien du dépôt réel : le test ne dépend d'aucune valeur du contenu.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MARQUEUR_DEBUT, MARQUEUR_FIN, chercherLesMotifs, classerLesMigrations, extraireLaSection, familleDe, fichiersDeclaresParNature, lirePublications, mesurer,
  MOTIFS, remplacerLaSection, rendreLaSection, resumerLesPublications, sansLeVolatil, sectionAJour,
} from '../scripts/inventaire-sortie-du-contenu-lib.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'inventaire-sortie-du-contenu.mjs');

const STRUCTURE = 'CREATE TABLE t (id INTEGER PRIMARY KEY) STRICT;\n';
const DONNEES = "UPDATE t SET id = id + 1 WHERE id = 1;\nINSERT INTO t (id) VALUES (7);\n";
const MIXTE = 'CREATE TABLE u (id INTEGER PRIMARY KEY) STRICT;\nINSERT INTO u (id) VALUES (3);\n';

const FICHIERS = {
  'data/rows/une_table.sql': 'INSERT INTO une_table VALUES (1);\n',
  'data/rows/VERSION': '1\n',
  'data/migrations/0001-structure.sql': STRUCTURE,
  'data/migrations/0001-structure.json': '{}\n',
  'data/migrations/0002-donnees.sql': DONNEES,
  'data/migrations/0002-donnees.json': '{"textes": []}\n',
  'data/migrations/0003-mixte.sql': MIXTE,
  'data/migrations/0003-mixte.json': '{}\n',
  'sources/raw/doc.md': '# un export\n',
  'sources/raw/classeurs/feuille.json': '{}\n',
  'sources/sources.json': '{}\n',
  'sources/tipeee/bienvenue.json': '{}\n',
  // Les lecteurs
  'client/src/lib/clair.mjs': "const rows = join(RACINE, 'data', 'rows');\n",
  'client/serveur/en-clair.mjs': '// lit data/rows/une_table.sql\n',
  'client/scripts/copie.mjs': "const copie = join(tmp, 'rows');\n",
  'client/test/par-nom.test.mjs': "import x from '../../data/migrations/0002-donnees.json';\n",
  'client/test/lit-le-dossier.test.mjs': "readdirSync(join(racine, 'data', 'migrations'));\n",
  'tools/db/outil.py': 'RAW = os.path.join(RACINE, "sources", "raw")\n',
  'tools/db/indirect.py': 'lancer db:build puis lire le résultat\n',
  'deploy/lit-les-classeurs.sh': 'cat sources/raw/classeurs/feuille.json\n',
  '.github/workflows/ci.yml': 'run: node scripts/x.mjs data/migrations\n',
  'docs/note.md': 'La mixte 0003-mixte est citée ici, et 0002-donneesXYZ ne l\'est pas.\n',
  'client/src/lib/propre.mjs': 'export const x = 1;\n',
};
const OCTETS = (chemins) => chemins.reduce((s, c) => s + Buffer.byteLength(FICHIERS[c]), 0);

const DOCUMENT = `# Chantier\n\nAvant, data/rows est cité.\n\n${MARQUEUR_DEBUT}\nvieux contenu, data/rows aussi\n${MARQUEUR_FIN}\n\nAprès.\n`;

const git = (dossier, ...args) => execFileSync('git', ['-C', dossier, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
function poser(dossier, fichiers) {
  for (const [chemin, texte] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(dossier, chemin)), { recursive: true });
    writeFileSync(join(dossier, chemin), texte);
  }
  git(dossier, 'add', '-A');
}
const lancer = (...args) => spawnSync(process.execPath, ['--no-warnings', SCRIPT, ...args], { encoding: 'utf8' });

describe('inventaire de ce qui sort du dépôt (lot 12)', () => {
  let racine;
  let mesure;
  before(() => {
    racine = dossierTemporaire('inventaire-sortie');
    git(racine, 'init', '-q');
    poser(racine, { ...FICHIERS, 'docs/chantier.md': DOCUMENT });
    mesure = mesurer({ racine, maintenant: new Date('2026-01-02T03:04:05Z') });
  });

  it('classe les migrations par nature : sans DDL = données, un registre suit sa migration', () => {
    const textes = new Map([
      ['data/migrations/0001-structure.sql', STRUCTURE], ['data/migrations/0002-donnees.sql', DONNEES], ['data/migrations/0003-mixte.sql', MIXTE],
    ]);
    const chemins = [...Object.keys(FICHIERS).filter((c) => c.startsWith('data/migrations/')), 'data/migrations/0009-orphelin.json'];
    const c = classerLesMigrations(textes, chemins);
    assert.equal(c.get('data/migrations/0001-structure.sql').nature, 'structure');
    assert.equal(c.get('data/migrations/0001-structure.json').nature, 'structure');
    assert.equal(c.get('data/migrations/0002-donnees.sql').nature, 'donnees');
    assert.equal(c.get('data/migrations/0002-donnees.json').nature, 'donnees');
    assert.equal(c.get('data/migrations/0003-mixte.sql').nature, 'structure');
    assert.equal(c.get('data/migrations/0003-mixte.sql').avecDonnees, true, 'DDL et données mêlés : notée, jamais comptée avec les données');
    assert.equal(c.get('data/migrations/0003-mixte.json').avecDonnees, true);
    assert.equal(c.get('data/migrations/0009-orphelin.json').nature, 'donnees');
    assert.equal(c.get('data/migrations/0001-structure.sql').registre, false);
    assert.equal(c.get('data/migrations/0001-structure.json').registre, true);
  });

  it('compte les fichiers et les octets de chaque catégorie qui sort', () => {
    const attendu = {
      rows: ['data/rows/une_table.sql', 'data/rows/VERSION'],
      migrations_donnees: ['data/migrations/0002-donnees.sql', 'data/migrations/0002-donnees.json'],
      sources_raw: ['sources/raw/doc.md', 'sources/raw/classeurs/feuille.json'],
    };
    for (const [id, chemins] of Object.entries(attendu)) {
      const cat = mesure.categories.find((x) => x.id === id);
      assert.equal(cat.fichiers, chemins.length, id);
      assert.equal(cat.octets, OCTETS(chemins), id);
    }
    const tous = Object.values(attendu).flat();
    assert.equal(mesure.chiffres_de_tete.fichiers_qui_sortent, tous.length);
    assert.equal(mesure.chiffres_de_tete.octets_qui_sortent, OCTETS(tous));
  });

  it('laisse dans l\'arbre ce qui reste : structure, mixtes, manifeste, instantané', () => {
    assert.equal(mesure.migrations.sql_donnees, 1);
    assert.equal(mesure.migrations.json_donnees, 1);
    assert.equal(mesure.migrations.sql_structure, 2);
    assert.equal(mesure.migrations.structure_avec_donnees, 1);
    assert.equal(mesure.migrations.structure_pure_qui_reste.fichiers, 2);
    assert.equal(mesure.migrations.mixtes_si_elles_sortaient.octets, OCTETS(['data/migrations/0003-mixte.sql', 'data/migrations/0003-mixte.json']));
    assert.equal(mesure.restes.sources_manifeste.fichiers, 1);
    assert.equal(mesure.restes.sources_tipeee.fichiers, 1);
  });

  it('trouve les lecteurs : chemin en clair, chemin construit, nom de migration, famille', () => {
    const lecteurs = (cat, famille) => mesure.lecteurs_detail[cat][famille].map((x) => x.fichier);
    assert.deepEqual(lecteurs('rows', 'src'), ['client/src/lib/clair.mjs']);
    assert.deepEqual(lecteurs('rows', 'serveur'), ['client/serveur/en-clair.mjs']);
    assert.deepEqual(lecteurs('rows', 'scripts'), ['client/scripts/copie.mjs']);
    assert.deepEqual(lecteurs('sources_raw', 'tools'), ['tools/db/outil.py']);
    assert.deepEqual(lecteurs('sources_raw', 'deploy'), ['deploy/lit-les-classeurs.sh']);
    assert.deepEqual(lecteurs('migrations_donnees', 'tests'), ['client/test/par-nom.test.mjs']);
    assert.deepEqual(lecteurs('migrations_mixtes', 'docs'), ['docs/note.md'], 'une mixte citée par son nom : notée à part');
    assert.deepEqual(lecteurs('migrations_dossier', 'ci'), ['.github/workflows/ci.yml']);
    assert.ok(lecteurs('migrations_dossier', 'tests').includes('client/test/lit-le-dossier.test.mjs'));
    assert.equal(mesure.references.some((r) => r.fichier === 'client/src/lib/propre.mjs'), false);
  });

  it('un nom de migration n\'est pas reconnu comme début d\'un nom plus long', () => {
    assert.equal(mesure.lecteurs_detail.migrations_donnees.docs.length, 0, '0002-donneesXYZ n\'est pas 0002-donnees');
  });

  it('les chiffres de tête ne comptent que les lecteurs des catégories qui sortent, chacun une fois', () => {
    const attendus = [
      'client/src/lib/clair.mjs', 'client/serveur/en-clair.mjs', 'client/scripts/copie.mjs', 'client/test/par-nom.test.mjs', 'tools/db/outil.py',
      'deploy/lit-les-classeurs.sh',
    ];
    // Le document du chantier cite `data/rows` hors de son bloc : lecteur de la famille « docs ».
    assert.equal(mesure.chiffres_de_tete.fichiers_suivis_qui_les_lisent, attendus.length + 1);
    assert.equal(mesure.chiffres_de_tete.dont_hors_docs_et_consignes, attendus.length);
    assert.equal(mesure.references_qui_restent.migrations_dossier, 3);
  });

  it('une lecture par commande est notée à part, hors des chiffres de tête', () => {
    assert.equal(mesure.lectures_indirectes_de_rows, 1);
    assert.equal(mesure.references.find((r) => r.fichier === 'tools/db/indirect.py').compte, false);
  });

  it('chaque référence porte fichier, ligne (à partir de 1), motif', () => {
    const r = mesure.references.find((x) => x.fichier === 'client/src/lib/clair.mjs');
    assert.equal(r.ligne, 1);
    assert.equal(r.famille, 'src');
    assert.ok(MOTIFS.some((m) => m.id === r.motif));
    const lignes = chercherLesMotifs('rien\n// data/rows ici\nrien', MOTIFS);
    assert.deepEqual(lignes.map((x) => x.ligne), [2]);
  });

  it('range un fichier dans sa famille', () => {
    assert.equal(familleDe('client/test/x.test.mjs'), 'tests');
    assert.equal(familleDe('CLAUDE.md'), 'consignes');
    assert.equal(familleDe('.claude/skills/x/SKILL.md'), 'consignes');
    assert.equal(familleDe('package.json'), 'autres');
  });

  it('le bloc entre marqueurs n\'est jamais compté parmi les lecteurs, ses lignes gardent leurs numéros', () => {
    const doc = mesure.references.filter((r) => r.fichier === 'docs/chantier.md');
    assert.deepEqual(doc.map((r) => r.ligne), [3], 'seule la ligne hors du bloc');
  });

  it('remplace la section entre les marqueurs et laisse le reste', () => {
    const section = rendreLaSection(mesure);
    const apres = remplacerLaSection(DOCUMENT, section);
    assert.ok(apres.startsWith('# Chantier\n\nAvant, data/rows est cité.\n\n'));
    assert.ok(apres.endsWith('\n\nAprès.\n'));
    assert.equal(extraireLaSection(apres), section);
    assert.ok(!apres.includes('vieux contenu'));
    assert.equal(remplacerLaSection(apres, section), apres, 'idempotent');
    assert.throws(() => remplacerLaSection('sans marqueurs', section), /marqueurs/);
    assert.throws(() => remplacerLaSection(`${MARQUEUR_FIN}\n${MARQUEUR_DEBUT}`, section), /marqueurs/);
  });

  it('la section dit les trois chiffres de tête, la date et le commit', () => {
    const section = rendreLaSection(mesure);
    assert.ok(section.includes('2026-01-02'));
    assert.ok(rendreLaSection({ ...mesure, mesure: { ...mesure.mesure, commit: 'abc1234' } }).includes('commit `abc1234`'));
    assert.ok(section.includes(`${mesure.chiffres_de_tete.fichiers_qui_sortent} fichiers`));
    assert.ok(section.includes(`${mesure.chiffres_de_tete.fichiers_suivis_qui_les_lisent} fichiers suivis`));
    assert.ok(section.includes('octets'));
  });

  it('`--verifier` : à jour sans les lignes volatiles, périmée dès qu\'un chiffre bouge', () => {
    const a = mesure;
    const document = remplacerLaSection(DOCUMENT, rendreLaSection(a));
    assert.equal(sectionAJour(document, a), true);
    const plusTard = { ...a, mesure: { ...a.mesure, date: '2030-05-06', commit: 'abcdef0' }, publications: { mesuree: true, publications: 3, pre_publications: 1, assets: 3, octets: 10 } };
    assert.equal(sectionAJour(document, plusTard), true, 'date, commit et publications ne comptent pas');
    assert.equal(sansLeVolatil(rendreLaSection(a)), sansLeVolatil(rendreLaSection(plusTard)));
    const autre = { ...a, chiffres_de_tete: { ...a.chiffres_de_tete, octets_qui_sortent: a.chiffres_de_tete.octets_qui_sortent + 1 } };
    assert.equal(sectionAJour(document, autre), false);
    assert.equal(sectionAJour('sans section', a), false);
  });

  it('le script écrit la section, puis `--verifier` : 0 ; un lecteur de plus : 1 ; réécrite : 0', (t) => {
    const copie = dossierTemporaire('inventaire-sortie-script', { t });
    git(copie, 'init', '-q');
    poser(copie, { ...FICHIERS, 'docs/chantier.md': DOCUMENT });
    const base = ['--racine', copie, '--doc', 'docs/chantier.md', '--sans-gh'];

    assert.equal(lancer(...base, '--verifier').status, 1, 'marqueurs vides : pas à jour');
    const ecrit = lancer(...base, '--ecrire-docs');
    assert.equal(ecrit.status, 0, ecrit.stderr);
    const texte = readFileSync(join(copie, 'docs/chantier.md'), 'utf8');
    assert.ok(texte.includes('Chiffres de tête'));
    assert.ok(texte.endsWith('\n\nAprès.\n'));
    const json = JSON.parse(readFileSync(join(copie, 'var/inventaire-sortie/inventaire.json'), 'utf8'));
    assert.equal(json.chiffres_de_tete.fichiers_qui_sortent, 6);
    assert.equal(json.publications.mesuree, false);
    assert.equal(lancer(...base, '--verifier').status, 0);

    poser(copie, { 'client/src/lib/nouveau.mjs': "const d = join(base, 'data', 'rows');\n" });
    assert.equal(lancer(...base, '--verifier').status, 1);
    assert.equal(lancer(...base, '--ecrire-docs').status, 0);
    assert.equal(lancer(...base, '--verifier').status, 0);
    assert.equal(lancer(...base, '--verifier', '--ecrire-docs').status, 2, 'options incompatibles');
  });

  it('lit les publications : tableaux collés (`--paginate`), tableau de tableaux (`--slurp`), tableau simple', () => {
    const p1 = [{ prerelease: true, published_at: '2026-01-01T00:00:00Z', assets: [{ size: 10 }, { size: 5 }] }];
    const p2 = [{ prerelease: false, published_at: '2026-02-01T00:00:00Z', assets: [{ size: 100 }] }, { prerelease: true, draft: true, assets: [] }];
    const collees = `${JSON.stringify(p1)}${JSON.stringify(p2)}`;
    for (const texte of [collees, JSON.stringify([p1, p2]), JSON.stringify([...p1, ...p2]), `${JSON.stringify(p1)}\n${JSON.stringify(p2)}\n`]) {
      const r = resumerLesPublications(lirePublications(texte));
      assert.equal(r.publications, 3);
      assert.equal(r.pre_publications, 2);
      assert.equal(r.brouillons, 1);
      assert.equal(r.assets, 3);
      assert.equal(r.octets, 115);
      assert.equal(r.plus_ancienne, '2026-01-01T00:00:00Z');
      assert.equal(r.plus_recente, '2026-02-01T00:00:00Z');
    }
    assert.deepEqual(lirePublications(''), []);
    // Une chaîne qui contient des crochets ne trompe pas le découpage.
    assert.equal(lirePublications('[{"name":"a]b[","assets":[]}][{"name":"c","assets":[]}]').length, 2);
  });

  it('`--publications <fichier>` remplace `gh`', (t) => {
    const copie = dossierTemporaire('inventaire-sortie-publications', { t });
    git(copie, 'init', '-q');
    poser(copie, { ...FICHIERS, 'docs/chantier.md': DOCUMENT });
    const fichier = join(copie, 'releases.json');
    writeFileSync(fichier, JSON.stringify([{ prerelease: true, assets: [{ size: 42 }] }]));
    const r = lancer('--racine', copie, '--doc', 'docs/chantier.md', '--publications', fichier, '--ecrire-docs');
    assert.equal(r.status, 0, r.stderr);
    const json = JSON.parse(readFileSync(join(copie, 'var/inventaire-sortie/inventaire.json'), 'utf8'));
    assert.deepEqual([json.publications.publications, json.publications.pre_publications, json.publications.octets], [1, 1, 42]);
    assert.ok(readFileSync(join(copie, 'docs/chantier.md'), 'utf8').includes('1 publications dont 1 pré-publications'));
  });

  it('refuse un `--json` hors de var/ et une racine qui n\'est pas un dépôt git (code 2, sans pile)', (t) => {
    const copie = dossierTemporaire('inventaire-sortie-refus', { t });
    git(copie, 'init', '-q');
    poser(copie, { ...FICHIERS, 'docs/chantier.md': DOCUMENT });
    const base = ['--racine', copie, '--doc', 'docs/chantier.md', '--sans-gh'];
    for (const dehors of ['../ailleurs.json', join(copie, 'ailleurs.json'), 'docs/x.json', 'var']) {
      const r = lancer(...base, '--json', dehors);
      assert.equal(r.status, 2, dehors);
      assert.match(r.stderr, /var/);
      assert.ok(!r.stderr.includes('    at '), 'pas de pile');
    }
    assert.equal(lancer(...base, '--json', 'var/ailleurs/ici.json').status, 0);
    assert.ok(readFileSync(join(copie, 'var/ailleurs/ici.json'), 'utf8').includes('chiffres_de_tete'));
    const sansGit = dossierTemporaire('inventaire-sortie-sans-git', { t });
    const r = lancer('--racine', sansGit, '--sans-gh');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /dépôt git/);
    assert.ok(!r.stderr.includes('    at '), 'pas de pile');
  });

  it('lit la liste des tests déclarés « lit le dépôt par nature »', () => {
    const texte = "export const LIT_LE_DEPOT_PAR_NATURE = Object.freeze({\n  'a.test.mjs': { famille: 'F3' },\n  'b-c.test.mjs': { famille: 'F4' },\n});\nconst X = { 'z.test.mjs': 1 };\n";
    assert.deepEqual(fichiersDeclaresParNature(texte), ['a.test.mjs', 'b-c.test.mjs']);
    assert.deepEqual(fichiersDeclaresParNature('rien'), []);
  });
});
