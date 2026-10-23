// Règles de la sélection des tests (npm run test:cible, scripts/tests-cibles.mjs ; politique : skill choisir-les-tests). Données seules : la logique
// est dans scripts/tests-cibles-lib.mjs, épinglée par test/tests-cibles.test.mjs. On affine la politique ICI, sans toucher au code.
//
// Ce que la sélection voit d'elle-même, avant ces règles (pour chaque fichier modifié, chemin relatif à la racine du dépôt) :
//   1. Le graphe : les imports ESM relatifs (statiques, `export … from`, `import('…')` à chaîne littérale ; pour un gabarit `…${x}`, la partie fixe
//      avant `?` ou `${`), et les fichiers ouverts par `new URL(<chemin>, import.meta.url)` (un dossier, `../dist/`, vaut pour tout ce qu'il contient),
//      depuis les tests `client/test/*.test.mjs`, de proche en proche, partout dans le dépôt (`src/`, `scripts/`, `serveur/`, `test/aide-*.mjs`,
//      `tools/`…). Un test qui atteint le fichier modifié est choisi. Les join de X, « data », « rows » d'un module atteint valent pour le dossier
//      `data/rows` (ou `client/data/rows`) : un fichier modifié sous ce chemin choisit le test.
//   2. Les citations : un test (ou une aide `test/aide-*.mjs` qu'il importe) dont le texte cite le chemin du fichier modifié (depuis la racine, ou
//      depuis `client/`) ; pour un fichier qui n'est pas du JavaScript, son seul nom suffit (`ci.yml`, `structure.md`), sauf les noms trop communs
//      (NOMS_COMMUNS) ; pour un module JavaScript, son nom entre guillemets suffit (`'db-build.mjs'` : un script lancé par spawn).
//   3. Les règles ci-dessous, pour ce que l'analyse ne voit pas.
//   4. FABRIQUES : ignorés. Un fichier qu'aucun des trois ne couvre fait lancer la suite entière, raison affichée ; un fichier couvert qu'aucun test
//      n'atteint est signalé « sans test » (ce n'est pas une erreur). Un module JavaScript sous ZONES_DU_GRAPHE est couvert par le graphe.
//
// Choix pour les fichiers qui ne sont pas du JavaScript :
//   - `.astro` : aucun test ne peut importer une page ou un composant (seul le build les lit) ; elle est donc choisie par ses citations, et la règle
//     `rendu` ajoute les tests du site construit (`lisentDist`). Un module de `src/lib` qu'une page importe est suivi par le graphe des tests qui
//     l'importent ; s'il change, c'est une SOURCES_DU_RENDU (indication du build ci-dessous) ;
//   - `.css` : même règle `rendu` ; `.md`, `.sql`, `.json`, `.py`, `.yml`, `.sh` : leurs citations, puis les règles de leur dossier.
//   - Un test qui lit `dist/` se saute sans build : quand il est choisi et qu'une SOURCES_DU_RENDU a changé, la sélection dit « lancer `npm run build`
//     avant ».
//
// Format d'une règle : { nom, fichiers: [globs depuis la racine du dépôt], raison, puis ce qu'elle choisit (les champs s'additionnent) } :
//   suiteEntiere: true              — la suite entière ;
//   tests: ['test/x.test.mjs']       — ces tests (chemins depuis client/) ; un test absent est ignoré sans erreur (tests à venir) ;
//   contenant: ['texte', /regex/]   — les tests dont le texte (ou celui de leurs aides) contient ce texte ou vérifie cette expression ;
//   important: ['client/src/lib/x'] — les tests qui importent ce module, même de loin ;
//   lisentDist: true                — les tests du site construit (ceux qui ouvrent `client/dist/`) ;
//   aucun champ                     — le fichier est couvert (pas de suite entière) sans choisir de test de plus que l'analyse.
// Globs : `**` (tout, sous-dossiers compris), `*` (dans un seul dossier), `?`, `{a,b}`.
//
// Boucle d'affinage : la CI lance toujours la suite entière. Quand elle attrape un échec que la sélection n'avait pas choisi, ajouter ici la règle
// qui l'aurait choisi, et son cas dans test/tests-cibles.test.mjs. Exemple — un changement de tools/sheets/ casse test/google-sheets.test.mjs :
//   { nom: 'sheets', fichiers: ['tools/sheets/**'], tests: ['test/google-sheets.test.mjs'], raison: 'les importeurs du classeur' },

/** Fichiers fabriqués ou locaux : jamais une cause de test. */
export const FABRIQUES = [
  'client/src/content/wiki/**',
  'var/**',
  'client/var/**',
  'client/dist/**',
  'dist/**',
  'client/node_modules/**',
  'node_modules/**',
  '**/__pycache__/**',
  '**/*.pyc',
  'client/.astro/**',
];

/** Où un module JavaScript est couvert par le graphe (même sans test qui l'atteint : il est alors « sans test »). */
export const ZONES_DU_GRAPHE = ['client/src/**', 'client/scripts/**', 'client/serveur/**', 'client/test/**', 'tools/**'];

/** Extensions lues comme des modules (imports suivis). */
export const EXTENSIONS_DE_MODULE = ['.mjs', '.js', '.cjs', '.ts', '.mts'];

/** Noms trop communs pour qu'un test qui les cite soit lié à CE fichier : seul leur chemin compte. */
export const NOMS_COMMUNS = ['SKILL.md', 'README.md', 'index.md', 'index.html', 'index.astro', 'index.mjs', 'index.ts', 'package.json', 'sources.json', 'style.css', 'global.css'];

/** Ce qui change le site construit : un test choisi qui lit `dist/` demande alors `npm run build` avant. */
export const SOURCES_DU_RENDU = ['client/src/**', 'client/public/**', 'client/astro.config.mjs', 'data/**'];

/** Ce que lit un test qui ouvre la base (texte) — partagé par la règle `base`. */
const LIT_LA_BASE = ['data/rows', "'data', 'rows'", 'schema.sql', 'derive.sql', 'migrations', 'maverick.db'];

/** Modules par lesquels un test lit la base sans la citer. */
const OUVRENT_LA_BASE = [
  'client/src/lib/donnees.mjs',
  'client/scripts/db-build.mjs',
  'client/scripts/db-derive.mjs',
  'client/scripts/db-lib.mjs',
  'client/scripts/db-export-pages.mjs',
  'client/scripts/db-appliquer-edition.mjs',
  'client/scripts/mise-a-jour-regles.mjs',
  'client/scripts/mise-a-jour-simulation.mjs',
  'client/serveur/service.mjs',
];

export const REGLES = [
  {
    nom: 'outillage',
    fichiers: ['client/package.json', 'client/package-lock.json', 'package.json', 'package-lock.json', 'client/astro.config.mjs', '.nvmrc', 'client/tsconfig.json'],
    suiteEntiere: true,
    raison: 'dépendances, configuration du build ou version de Node : tout le site peut changer',
  },
  {
    nom: 'selection-des-tests',
    fichiers: ['client/scripts/tests-cibles*.mjs'],
    tests: ['test/tests-cibles.test.mjs'],
    raison: 'la sélection elle-même',
  },
  {
    nom: 'base',
    fichiers: ['data/rows/**', 'data/schema.sql', 'data/migrations/**', 'data/derive.sql'],
    contenant: LIT_LA_BASE,
    important: OUVRENT_LA_BASE,
    raison: 'les tests qui lisent la base (data/rows, schéma, migrations, base construite)',
  },
  {
    nom: 'donnees-autres',
    fichiers: ['data/**'],
    raison: 'les autres fichiers de data/ : leurs seules citations',
  },
  {
    nom: 'instructions',
    fichiers: ['CLAUDE.md', '.claude/**', 'docs/equipe.md'],
    tests: ['test/instructions-claude.test.mjs'],
    raison: 'les instructions de Claude (agents, skills) : leur test (A2), plus les tests qui les citent',
  },
  {
    nom: 'decisions',
    fichiers: ['docs/decisions-regles.md', 'docs/decisions-index.md'],
    tests: ['test/decisions-index.test.mjs'],
    raison: "le registre des décisions et son index (A3), plus les tests qui le citent",
  },
  {
    nom: 'docs',
    fichiers: ['docs/**', '*.md'],
    raison: 'la documentation : les tests qui la citent',
  },
  {
    nom: 'flux-git-et-hebergement',
    fichiers: ['.github/**', 'deploy/**', 'tools/flux-git/**'],
    tests: ['test/flux-git.test.mjs', 'test/deploy-vps.test.mjs', 'test/flux-git-etat.test.mjs'],
    raison: 'CI, hébergement et bot du flux Git',
  },
  {
    nom: 'tests',
    fichiers: ['client/test/**'],
    tests: ['test/dossiers-temporaires.test.mjs'],
    raison: 'le garde-fou des dossiers temporaires relit tous les fichiers de client/test/',
  },
  {
    nom: 'rendu',
    fichiers: ['client/src/**/*.astro', 'client/src/styles/**', 'client/public/**'],
    lisentDist: true,
    raison: "une page, un composant ou un style : seuls les tests du site construit le voient (npm run build avant)",
  },
  {
    nom: 'outils-et-sources',
    fichiers: ['tools/**', 'sources/**', 'api/**', 'client/src/**', 'client/scripts/**', 'client/serveur/**'],
    raison: 'outils, exports des sources, ancien service et reste du site : leurs seules citations et le graphe',
  },
  {
    nom: 'git',
    fichiers: ['.gitignore', '.gitattributes', '**/.gitignore', '**/.gitattributes'],
    raison: 'fichiers ignorés ou fins de ligne : leurs seules citations',
  },
];
