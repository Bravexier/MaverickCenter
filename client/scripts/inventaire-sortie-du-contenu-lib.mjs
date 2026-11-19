/**
 * Inventaire de ce qui sortira du dépôt au lot 12 (R296 : lignes des tables, anciennes migrations de données, exports des sources, anciennes
 * publications) et de ce qui le lit encore. Rien ne sort ici : on mesure. Sans dépendance : `git ls-files`, `node:fs`, le classement des
 * migrations de `controler-les-migrations-lib.mjs`.
 *
 * Pur autant que possible : `mesurer` lit l'arbre suivi par git d'une racine, le reste prend des valeurs. Le script est
 * `scripts/inventaire-sortie-du-contenu.mjs` ; le document est `docs/lot-12-inventaire.md`, écrit par le script seul (en-tête, puis la section entre les deux marqueurs).
 */
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyserUneMigration } from './controler-les-migrations-lib.mjs';

export const MARQUEUR_DEBUT = '<!-- inventaire-lot-12:debut -->';
export const MARQUEUR_FIN = '<!-- inventaire-lot-12:fin -->';
/** Une ligne qui change d'une mesure à l'autre (date, commit, publications) : `--verifier` l'ignore. */
export const SUFFIXE_VOLATIL = ' <!--v-->';
export const DEPOT_GITHUB = 'Bravexier/MaverickCenter';

/** Les fichiers de l'inventaire lui-même : ils citent les chemins pour les chercher, ils ne les lisent pas. */
export const FICHIERS_EXCLUS = Object.freeze([
  'client/scripts/inventaire-sortie-du-contenu.mjs',
  'client/scripts/inventaire-sortie-du-contenu-lib.mjs',
  'client/test/inventaire-sortie-du-contenu.test.mjs',
]);

const EXTENSIONS_BINAIRES = /\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|otf|zip|gz|tgz|tar|pdf|mp3|mp4|db|sqlite)$/i;
const TAILLE_MAX_LUE = 3 * 1024 * 1024;

/** Les catégories qui sortent de l'arbre. `compte` : entre dans les chiffres de tête. */
export const CATEGORIES = Object.freeze([
  { id: 'rows', titre: 'Lignes des tables', chemins: ['data/rows/'] },
  { id: 'migrations_donnees', titre: 'Anciennes migrations de données (.sql et leur registre .json)', chemins: ['data/migrations/ (celles sans DDL)'] },
  { id: 'sources_raw', titre: 'Exports des sources Google', chemins: ['sources/raw/'] },
]);
export const IDS_QUI_SORTENT = CATEGORIES.map((c) => c.id);

/** Les familles de lecteurs, dans l'ordre d'affichage. */
export const FAMILLES = Object.freeze([
  { id: 'src', titre: 'Code du site (`client/src`)', prefixes: ['client/src/'] },
  { id: 'serveur', titre: 'Service (`client/serveur`)', prefixes: ['client/serveur/'] },
  { id: 'scripts', titre: 'Scripts (`client/scripts`)', prefixes: ['client/scripts/'] },
  { id: 'tools', titre: 'Outils (`tools/`)', prefixes: ['tools/'] },
  { id: 'tests', titre: 'Tests (`client/test`)', prefixes: ['client/test/'] },
  { id: 'ci', titre: 'CI (`.github`)', prefixes: ['.github/'] },
  { id: 'deploy', titre: 'Hébergement (`deploy`)', prefixes: ['deploy/'] },
  { id: 'docs', titre: 'Documentation (`docs`)', prefixes: ['docs/'] },
  { id: 'consignes', titre: 'Consignes (`.claude`, `CLAUDE.md`)', prefixes: ['.claude/', 'CLAUDE.md'] },
  { id: 'autres', titre: 'Autres (`data/`, `api/`, configuration…)', prefixes: [] },
]);

export function familleDe(chemin) {
  for (const f of FAMILLES) if (f.prefixes.some((p) => chemin.startsWith(p))) return f.id;
  return 'autres';
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le classement des fichiers suivis
// ---------------------------------------------------------------------------------------------------------------------------------------------
const FICHIER_DE_MIGRATION = /^data\/migrations\/(\d{4}-[a-z0-9.-]+)\.(sql|json)$/;

/**
 * Classe les migrations par nature, comme le contrôle des migrations (`analyserUneMigration` : sans DDL = « données »). Un registre `.json`
 * suit la nature de sa migration `.sql` (même nom) ; sans migration `.sql` du même nom, il est classé « donnees » (registre orphelin).
 * @param {Map<string, string>} textes chemin → texte des `.sql` de data/migrations/
 * @param {string[]} chemins tous les fichiers de data/migrations/ (.sql et .json)
 * @returns {Map<string, { nature: 'donnees'|'structure', registre: boolean, avecDonnees: boolean }>} chemin → classement
 */
export function classerLesMigrations(textes, chemins) {
  const parNom = new Map();
  for (const [chemin, texte] of textes) {
    const nom = FICHIER_DE_MIGRATION.exec(chemin)?.[1];
    if (!nom) continue;
    const a = analyserUneMigration(texte);
    parNom.set(nom, { nature: a.nature, avecDonnees: a.nature === 'structure' && a.dml.length > 0 });
  }
  const classes = new Map();
  for (const chemin of chemins) {
    const m = FICHIER_DE_MIGRATION.exec(chemin);
    if (!m) continue;
    const [, nom, ext] = m;
    const de = parNom.get(nom);
    if (ext === 'sql') classes.set(chemin, { nature: de?.nature ?? 'structure', registre: false, avecDonnees: de?.avecDonnees ?? false });
    else classes.set(chemin, { nature: de?.nature ?? 'donnees', registre: true, avecDonnees: de?.avecDonnees ?? false });
  }
  return classes;
}

/**
 * Range chaque fichier suivi dans une catégorie qui sort, ou dans « reste ».
 * @param {{ chemin: string, octets: number }[]} fichiers
 * @param {Map<string, { nature: string }>} migrations résultat de `classerLesMigrations`
 */
export function classerLesFichiers(fichiers, migrations) {
  const categories = Object.fromEntries(IDS_QUI_SORTENT.map((id) => [id, []]));
  const restes = { migrations_structure: [], migrations_mixtes: [], sources_manifeste: [], sources_tipeee: [], sources_discord: [], sources_autres: [] };
  for (const f of fichiers) {
    const p = f.chemin;
    if (p.startsWith('data/rows/')) categories.rows.push(f);
    else if (p.startsWith('data/migrations/')) {
      const c = migrations.get(p);
      if (c?.nature === 'donnees') categories.migrations_donnees.push(f);
      else if (c?.avecDonnees) restes.migrations_mixtes.push(f);
      else if (c) restes.migrations_structure.push(f);
    } else if (p.startsWith('sources/raw/')) categories.sources_raw.push(f);
    else if (p === 'sources/sources.json') restes.sources_manifeste.push(f);
    else if (p.startsWith('sources/tipeee/')) restes.sources_tipeee.push(f);
    else if (p.startsWith('sources/discord/')) restes.sources_discord.push(f);
    else if (p.startsWith('sources/')) restes.sources_autres.push(f);
  }
  return { categories, restes };
}

export const sommer = (liste) => ({ fichiers: liste.length, octets: liste.reduce((s, f) => s + f.octets, 0) });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les lecteurs : motifs
// ---------------------------------------------------------------------------------------------------------------------------------------------
const Q = '[\'"`]';
/** Un chemin construit : `join(RACINE, 'data', 'rows')`, `join(tmp, 'rows')`, `resolve(x, 'raw')`. */
const construit = (segment) => new RegExp(`\\b(?:join|resolve)\\([^)\\n]*${Q}${segment}${Q}`);
/** `'data', 'rows'` (deux segments côte à côte, dans un `join`, un tableau ou un `os.path.join`). */
const deuxSegments = (a, b) => new RegExp(`${Q}${a}${Q}\\s*,\\s*${Q}${b}${Q}`);
/** `data/rows` ou `data\/rows` (dans un littéral d'expression régulière). */
const chemin = (a, b) => new RegExp(`${a}\\\\?/${b}\\b`);

/**
 * Les motifs. `categorie` : la catégorie lue. `genre` : chemin (écrit en clair), construit (segments), option, nom (nom d'une migration de données),
 * indirect (commande ou module qui lit à sa place). `compte: false` : référence notée mais hors des chiffres de tête (ce qui reste dans le dépôt,
 * ou une lecture indirecte). La liste des noms de migrations de données s'ajoute à l'exécution (`motifsDesNoms`).
 */
export const MOTIFS = Object.freeze([
  { id: 'rows-chemin', categorie: 'rows', genre: 'chemin', compte: true, re: chemin('data', 'rows') },
  { id: 'rows-segments', categorie: 'rows', genre: 'construit', compte: true, re: deuxSegments('data', 'rows') },
  { id: 'rows-join', categorie: 'rows', genre: 'construit', compte: true, re: construit('rows') },
  { id: 'rows-option', categorie: 'rows', genre: 'option', compte: true, re: /(?:^|\s)--rows\b/ },
  {
    id: 'rows-indirect', categorie: 'rows', genre: 'indirect', compte: false,
    re: /\bdb[:-](?:build|export-pages|sync-pages|appliquer-edition|pages-check)\b|\bpages_md\b|\bmigrer\.py\b/,
  },
  { id: 'sources-raw-chemin', categorie: 'sources_raw', genre: 'chemin', compte: true, re: chemin('sources', 'raw') },
  { id: 'sources-raw-segments', categorie: 'sources_raw', genre: 'construit', compte: true, re: deuxSegments('sources', 'raw') },
  { id: 'sources-raw-join', categorie: 'sources_raw', genre: 'construit', compte: true, re: construit('raw') },
  { id: 'sources-classeurs', categorie: 'sources_raw', genre: 'construit', compte: true, re: new RegExp(`\\bclasseurs/[A-Za-z0-9._-]+\\.json|${Q}classeurs${Q}`) },
  { id: 'sources-bestiaire-txt', categorie: 'sources_raw', genre: 'chemin', compte: true, re: /bestiaire-2-0\.txt/ },
  {
    id: 'migrations-dossier', categorie: 'migrations_dossier', genre: 'chemin', compte: false,
    re: new RegExp(`${chemin('data', 'migrations').source}|${deuxSegments('data', 'migrations').source}|${construit('migrations').source}`),
  },
  { id: 'sources-manifeste', categorie: 'sources_manifeste', genre: 'chemin', compte: false, re: /sources\/sources\.json/ },
  { id: 'sources-tipeee', categorie: 'sources_tipeee', genre: 'chemin', compte: false, re: chemin('sources', 'tipeee') },
  { id: 'sources-discord', categorie: 'sources_discord', genre: 'chemin', compte: false, re: chemin('sources', 'discord') },
  {
    id: 'publications-releases', categorie: 'publications', genre: 'chemin', compte: false,
    re: /\/releases\b|\bgh\s+release\b|\bprerelease\b/,
  },
]);

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Le motif « nom d'une migration » : `0113-mots-cles` cité tel quel (avec ou sans extension), sans être le début d'un nom plus long.
 * `donnees` : les migrations sans DDL (comptées) ; `mixtes` : celles qui ont du DDL et des instructions de données (notées, non comptées).
 */
export function motifDesNoms(migrations, type = 'donnees') {
  const noms = new Set();
  for (const [chemin, c] of migrations) {
    if (type === 'donnees' ? c.nature !== 'donnees' : !(c.nature === 'structure' && c.avecDonnees)) continue;
    const nom = FICHIER_DE_MIGRATION.exec(chemin)?.[1];
    if (nom) noms.add(nom);
  }
  if (!noms.size) return null;
  const alternatives = [...noms].sort((a, b) => b.length - a.length).map(echapper).join('|');
  return {
    id: type === 'donnees' ? 'migrations-nom' : 'migrations-nom-mixte',
    categorie: type === 'donnees' ? 'migrations_donnees' : 'migrations_mixtes',
    genre: 'nom', compte: type === 'donnees',
    re: new RegExp(`(?<![A-Za-z0-9_-])(?:${alternatives})(?![A-Za-z0-9_-])`),
  };
}

/** Les motifs « faux positifs connus » : des cas où un motif attrape autre chose qu'une lecture. Affichés dans la sortie. */
export const FAUX_POSITIFS_CONNUS = Object.freeze([
  '`rows-join` attrape aussi `join(tmp, \'rows\')` : une copie de travail nommée `rows` (tests, mise à jour), pas `data/rows` lui-même.',
  '`rows-chemin` attrape les commentaires, la documentation et les expressions régulières qui nomment `data/rows` sans le lire (le contrôle du contenu écrit à la main, par exemple).',
  '`sources-raw-join` attrape `join(x, \'raw\')` de toute origine ; `sources-classeurs` attrape `\'classeurs\'` entre guillemets (autre mot, autre dossier possible).',
  '`migrations-nom` ne voit qu\'un nom cité en toutes lettres (`0113-mots-cles`) : une migration citée par son seul numéro, ou un nom reconstruit, lui échappe.',
  '`migrations-dossier` : le dossier `data/migrations/` reste (les migrations de structure) ; ses lecteurs ne sont pas comptés.',
  '`publications-releases` attrape tout `/releases` (les nouvelles publications restent) : ses lecteurs ne sont pas comptés.',
]);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le balayage de l'arbre
// ---------------------------------------------------------------------------------------------------------------------------------------------
/** Les lignes d'un texte, hors celles du bloc entre les deux marqueurs (la section produite par l'inventaire se cite elle-même). */
export function lignesAScruter(texte) {
  const lignes = texte.split('\n');
  const masque = new Set();
  let dedans = false;
  lignes.forEach((l, k) => {
    if (l.includes(MARQUEUR_DEBUT)) dedans = true;
    if (dedans) masque.add(k);
    if (l.includes(MARQUEUR_FIN)) dedans = false;
  });
  return { lignes, masque };
}

/**
 * Cherche les motifs dans un texte.
 * @returns {{ ligne: number, motif: string, extrait: string }[]} une entrée par (ligne, motif), `ligne` à partir de 1
 */
export function chercherLesMotifs(texte, motifs) {
  const { lignes, masque } = lignesAScruter(texte);
  const trouves = [];
  lignes.forEach((l, k) => {
    if (masque.has(k) || l.length > 20000) return;
    for (const m of motifs) {
      if (m.re.test(l)) trouves.push({ ligne: k + 1, motif: m.id, extrait: l.trim().slice(0, 110) });
    }
  });
  return trouves;
}

/**
 * Les fichiers d'un commit (jamais l'arbre de travail) : `git ls-tree`, les fichiers ordinaires seulement (les liens et les sous-modules n'ont pas de contenu à ranger).
 * @returns {{ chemin: string, octets: number }[]} triés par chemin
 */
export function listerLesFichiersDuCommit(racine, ref) {
  verifierLeDepot(racine);
  const sortie = execFileSync('git', ['-C', racine, 'ls-tree', '-r', '-z', '-l', '--full-tree', ref], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return sortie.split('\0').filter(Boolean).flatMap((ligne) => {
    const m = /^(\d+) blob [0-9a-f]+\s+(\d+)\t(.+)$/s.exec(ligne);
    return m && m[1] !== '120000' ? [{ chemin: m[3], octets: Number(m[2]) }] : [];
  }).sort((a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0));
}

/**
 * Ce qui sortira du dépôt, par catégorie, avec les mêmes règles que la mesure (`classerLesMigrations`, `classerLesFichiers`) : `rows`, `migrations_donnees`,
 * `sources_raw`, et à part `migrations_mixtes` (DDL et données mêlés : une question ouverte au propriétaire, jamais comptée avec les données). Lu dans le
 * commit `ref` quand il est donné (l'archivage : jamais l'arbre de travail), sinon dans les fichiers suivis de l'arbre de `racine` (la passe S de l'essai
 * mécanique, qui travaille sur une copie jetable).
 * @returns {{ rows: object[], migrations_donnees: object[], migrations_mixtes: object[], sources_raw: object[] }}
 */
export function listerCeQuiSort({ racine, ref = null }) {
  const fichiers = ref ? listerLesFichiersDuCommit(racine, ref) : listerLesFichiersSuivis(racine);
  const textes = new Map();
  const chemins = [];
  for (const f of fichiers) {
    if (!f.chemin.startsWith('data/migrations/')) continue;
    chemins.push(f.chemin);
    if (!f.chemin.endsWith('.sql')) continue;
    textes.set(f.chemin, ref
      ? execFileSync('git', ['-C', racine, 'cat-file', 'blob', `${ref}:${f.chemin}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      : readFileSync(join(racine, f.chemin), 'utf8'));
  }
  const { categories, restes } = classerLesFichiers(fichiers, classerLesMigrations(textes, chemins));
  return { rows: categories.rows, migrations_donnees: categories.migrations_donnees, migrations_mixtes: restes.migrations_mixtes, sources_raw: categories.sources_raw };
}

/** Les chemins qui sortent (triés) : les catégories de `listerCeQuiSort`, les migrations mixtes seulement avec `avecMixtes` (`--avec-mixtes`). */
export function cheminsQuiSortent(liste, { avecMixtes = false } = {}) {
  const ids = [...IDS_QUI_SORTENT, ...(avecMixtes ? ['migrations_mixtes'] : [])];
  return ids.flatMap((id) => liste[id].map((f) => f.chemin)).sort();
}

/** Lève une erreur claire quand `racine` n'est pas un dépôt git. */
export function verifierLeDepot(racine) {
  try {
    execFileSync('git', ['-C', racine, 'rev-parse', '--is-inside-work-tree'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Error(`${racine} n'est pas un dépôt git (ou n'existe pas)`);
  }
}

export function listerLesFichiersSuivis(racine) {
  verifierLeDepot(racine);
  const sortie = execFileSync('git', ['-C', racine, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return sortie.split('\0').filter(Boolean).sort().flatMap((chemin) => {
    try {
      const s = lstatSync(join(racine, chemin));
      return s.isFile() ? [{ chemin, octets: s.size }] : [];
    } catch {
      return []; // suivi mais absent de l'arbre de travail
    }
  });
}

export function commitDeLaMesure(racine) {
  try {
    const sha = execFileSync('git', ['-C', racine, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    return sha;
  } catch {
    return null;
  }
}

/** Les lecteurs : pour chaque fichier suivi qui n'est pas une catégorie à retirer ni un binaire, les lignes qui citent un motif. */
export function trouverLesLecteurs(racine, fichiers, motifs, exclus = FICHIERS_EXCLUS) {
  const lecteurs = [];
  const aSaute = new Set(exclus);
  for (const f of fichiers) {
    const p = f.chemin;
    if (aSaute.has(p) || p.startsWith('data/rows/') || p.startsWith('data/migrations/') || p.startsWith('sources/raw/')) continue;
    if (EXTENSIONS_BINAIRES.test(p) || f.octets > TAILLE_MAX_LUE) continue;
    let texte;
    try {
      texte = readFileSync(join(racine, p), 'utf8');
    } catch {
      continue;
    }
    if (texte.includes('\0')) continue;
    for (const t of chercherLesMotifs(texte, motifs)) lecteurs.push({ fichier: p, famille: familleDe(p), ...t });
  }
  return lecteurs;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les publications
// ---------------------------------------------------------------------------------------------------------------------------------------------
/** Le texte de `gh api … --paginate` (tableaux collés bout à bout) ou de `--slurp` (tableau de tableaux) : la liste des publications. */
export function lirePublications(texte) {
  const t = texte.trim();
  if (!t) return [];
  const aplatir = (v) => (Array.isArray(v) ? v.flatMap(aplatir) : v && typeof v === 'object' ? [v] : []);
  try {
    return aplatir(JSON.parse(t));
  } catch {
    // tableaux collés : `[...][...]`
    const morceaux = [];
    let profondeur = 0;
    let debut = -1;
    let chaine = false;
    let echappe = false;
    for (let k = 0; k < t.length; k++) {
      const c = t[k];
      if (chaine) {
        if (echappe) echappe = false;
        else if (c === '\\') echappe = true;
        else if (c === '"') chaine = false;
        continue;
      }
      if (c === '"') chaine = true;
      else if (c === '[' || c === '{') {
        if (profondeur === 0) debut = k;
        profondeur++;
      } else if (c === ']' || c === '}') {
        profondeur--;
        if (profondeur === 0 && debut >= 0) morceaux.push(JSON.parse(t.slice(debut, k + 1)));
      }
    }
    return aplatir(morceaux);
  }
}

export function resumerLesPublications(publications) {
  const assets = publications.flatMap((p) => (Array.isArray(p.assets) ? p.assets : []));
  const dates = publications.map((p) => p.published_at ?? p.created_at).filter(Boolean).sort();
  return {
    mesuree: true,
    publications: publications.length,
    pre_publications: publications.filter((p) => p.prerelease).length,
    brouillons: publications.filter((p) => p.draft).length,
    assets: assets.length,
    octets: assets.reduce((s, a) => s + (Number(a.size) || 0), 0),
    plus_ancienne: dates[0] ?? null,
    plus_recente: dates.at(-1) ?? null,
  };
}

/** Lecture seule (GET) par `gh api`. Renvoie le résumé, ou `{ mesuree: false, raison }`. */
export function mesurerLesPublicationsParGh(depot = DEPOT_GITHUB) {
  try {
    const sortie = execFileSync('gh', ['api', '--method', 'GET', `repos/${depot}/releases`, '--paginate', '--slurp'], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return resumerLesPublications(lirePublications(sortie));
  } catch (e) {
    return { mesuree: false, raison: `gh api indisponible (${String(e.code ?? e.message).slice(0, 60)})` };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La mesure
// ---------------------------------------------------------------------------------------------------------------------------------------------
/**
 * @param {{ racine: string, publications?: object, maintenant?: Date, declaresParNature?: string[] }} options
 */
export function mesurer({ racine, publications = { mesuree: false, raison: 'non mesuré' }, maintenant = new Date(), declaresParNature = [] }) {
  const fichiers = listerLesFichiersSuivis(racine);
  const textesDesMigrations = new Map();
  const cheminsDesMigrations = [];
  for (const f of fichiers) {
    if (!f.chemin.startsWith('data/migrations/')) continue;
    cheminsDesMigrations.push(f.chemin);
    if (f.chemin.endsWith('.sql')) textesDesMigrations.set(f.chemin, readFileSync(join(racine, f.chemin), 'utf8'));
  }
  const migrations = classerLesMigrations(textesDesMigrations, cheminsDesMigrations);
  const { categories, restes } = classerLesFichiers(fichiers, migrations);

  const motifs = [...MOTIFS];
  for (const type of ['donnees', 'mixtes']) {
    const nom = motifDesNoms(migrations, type);
    if (nom) motifs.push(nom);
  }
  const references = trouverLesLecteurs(racine, fichiers, motifs);

  const parMotif = new Map(motifs.map((m) => [m.id, m]));
  const dansLeCompte = references.filter((r) => parMotif.get(r.motif).compte && IDS_QUI_SORTENT.includes(parMotif.get(r.motif).categorie));
  const fichiersLecteurs = [...new Set(dansLeCompte.map((r) => r.fichier))].sort();

  // Par catégorie lue puis par famille.
  const lecteursParCategorie = {};
  const cle = (m) => (m.genre === 'indirect' ? `${m.categorie}_indirect` : m.categorie);
  for (const m of motifs) lecteursParCategorie[cle(m)] ??= new Map();
  for (const r of references) {
    const carte = lecteursParCategorie[cle(parMotif.get(r.motif))];
    if (!carte.has(r.fichier)) carte.set(r.fichier, { famille: r.famille, motifs: new Set() });
    carte.get(r.fichier).motifs.add(r.motif);
  }
  const lecteurs = {};
  for (const [cat, carte] of Object.entries(lecteursParCategorie)) {
    lecteurs[cat] = Object.fromEntries(FAMILLES.map((f) => [f.id, []]));
    for (const [fichier, v] of [...carte].sort((a, b) => a[0].localeCompare(b[0]))) lecteurs[cat][v.famille].push({ fichier, motifs: [...v.motifs].sort() });
  }

  const sortent = IDS_QUI_SORTENT.map((id) => ({ id, titre: CATEGORIES.find((c) => c.id === id).titre, ...sommer(categories[id]) }));
  const classement = [...migrations].map(([chemin, c]) => ({ chemin, ...c }));
  const natures = {
    sql_donnees: classement.filter((c) => !c.registre && c.nature === 'donnees').length,
    json_donnees: classement.filter((c) => c.registre && c.nature === 'donnees').length,
    sql_structure: classement.filter((c) => !c.registre && c.nature === 'structure').length,
    json_structure: classement.filter((c) => c.registre && c.nature === 'structure').length,
    structure_avec_donnees: classement.filter((c) => !c.registre && c.avecDonnees).length,
  };

  const lecteursDeclares = new Set(declaresParNature);
  const testsLecteurs = fichiersLecteurs.filter((f) => f.startsWith('client/test/')).map((f) => f.replace('client/test/', ''));
  const total = sommer(IDS_QUI_SORTENT.flatMap((id) => categories[id]));

  return {
    mesure: { date: maintenant.toISOString().slice(0, 10), commit: commitDeLaMesure(racine), fichiers_suivis: fichiers.length },
    chiffres_de_tete: {
      octets_qui_sortent: total.octets,
      fichiers_qui_sortent: total.fichiers,
      fichiers_suivis_qui_les_lisent: fichiersLecteurs.length,
      dont_hors_docs_et_consignes: fichiersLecteurs.filter((f) => !['docs', 'consignes'].includes(familleDe(f))).length,
    },
    categories: sortent,
    migrations: { ...natures, structure_pure_qui_reste: sommer(restes.migrations_structure), mixtes_si_elles_sortaient: sommer(restes.migrations_mixtes) },
    restes: Object.fromEntries(Object.entries(restes).map(([k, v]) => [k, { ...sommer(v), chemins: v.map((f) => f.chemin).slice(0, 5) }])),
    publications,
    lecteurs_par_famille: FAMILLES.map((f) => {
      const parCategorie = (cat) => lecteurs[cat]?.[f.id] ?? [];
      const compte = [...new Set(IDS_QUI_SORTENT.flatMap((cat) => parCategorie(cat).map((x) => x.fichier)))].sort();
      return {
        famille: f.id, titre: f.titre, fichiers: compte.length,
        rows: parCategorie('rows').length,
        migrations_donnees: parCategorie('migrations_donnees').length,
        sources_raw: parCategorie('sources_raw').length,
        exemples: compte.slice(0, 3),
      };
    }),
    references_qui_restent: Object.fromEntries(
      ['migrations_dossier', 'migrations_mixtes', 'sources_manifeste', 'sources_tipeee', 'sources_discord', 'publications'].map((cat) => [
        cat, FAMILLES.reduce((s, f) => s + (lecteurs[cat]?.[f.id]?.length ?? 0), 0),
      ]),
    ),
    lectures_indirectes_de_rows: [...lecteursParCategorie.rows_indirect.keys()].filter((fichier) => !lecteursParCategorie.rows.has(fichier)).length,
    tests_lecteurs: {
      fichiers_de_test: testsLecteurs.filter((f) => f.endsWith('.test.mjs')).length,
      aides: testsLecteurs.filter((f) => !f.endsWith('.test.mjs')).length,
      declares_par_nature: testsLecteurs.filter((f) => lecteursDeclares.has(f)).length,
      non_declares: testsLecteurs.filter((f) => f.endsWith('.test.mjs') && !lecteursDeclares.has(f)).length,
      declares_sans_motif: [...lecteursDeclares].filter((f) => !testsLecteurs.includes(f)).sort(),
    },
    faux_positifs_connus: [...FAUX_POSITIFS_CONNUS],
    lecteurs_detail: Object.fromEntries(Object.entries(lecteurs).map(([cat, parFamille]) => [cat, parFamille])),
    references: references.map((r) => ({ fichier: r.fichier, ligne: r.ligne, famille: r.famille, motif: r.motif, compte: parMotif.get(r.motif).compte, extrait: r.extrait })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le document
// ---------------------------------------------------------------------------------------------------------------------------------------------
const groupes = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export function formaterOctets(n) {
  const mo = (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace('.', ',');
  const go = (n / 1e9).toFixed(1).replace('.', ',');
  return n >= 1e9 ? `${groupes(n)} octets (${go} Go)` : `${groupes(n)} octets (${mo} Mo)`;
}
const bref = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1).replace('.', ',')} Go` : `${(n / 1e6).toFixed(1).replace('.', ',')} Mo`);
const c = (t) => `\`${t}\``;

export const COMMANDE = 'cd client && node scripts/inventaire-sortie-du-contenu.mjs --ecrire-docs';

/** La section du document, marqueurs compris. */
export function rendreLaSection(m) {
  const t = m.chiffres_de_tete;
  const l = [];
  l.push(MARQUEUR_DEBUT);
  l.push('#### Lot 12 — inventaire de ce qui sort (mesuré)');
  l.push('');
  l.push(`Produit par ${c(COMMANDE)} (\`--verifier\` : dit si cette section est périmée, code 0 ; \`--strict\` : code 1 ; la sortie complète, avec fichier:ligne de chaque lecteur, est dans \`var/inventaire-sortie/\`). Rien ne sort encore : on mesure.`);
  l.push('');
  l.push(`Mesure du ${m.mesure.date}, commit ${c(m.mesure.commit ?? 'inconnu')}, ${m.mesure.fichiers_suivis} fichiers suivis.${SUFFIXE_VOLATIL}`);
  l.push('');
  l.push('**Chiffres de tête**');
  l.push('');
  l.push(`- **${formaterOctets(t.octets_qui_sortent)}** sortent de l'arbre (lignes, anciennes migrations de données, exports des sources).`);
  l.push(`- **${groupes(t.fichiers_qui_sortent)} fichiers** sortent.`);
  l.push(`- **${t.fichiers_suivis_qui_les_lisent} fichiers suivis** les lisent encore (dont ${t.dont_hors_docs_et_consignes} hors documentation et consignes).`);
  const mx = m.migrations.mixtes_si_elles_sortaient;
  l.push(`- Si les migrations qui mêlent DDL et données sortaient aussi (voir plus bas) : **+${formaterOctets(mx.octets)}**, **+${groupes(mx.fichiers)} fichiers**.`);
  l.push('');
  l.push('| Catégorie | Chemins | Fichiers | Octets |');
  l.push('| --- | --- | ---: | ---: |');
  for (const cat of m.categories) {
    const def = CATEGORIES.find((x) => x.id === cat.id);
    l.push(`| ${cat.titre} | ${def.chemins.map(c).join(', ')} | ${groupes(cat.fichiers)} | ${groupes(cat.octets)} |`);
  }
  l.push(`| **Total** | | **${groupes(t.fichiers_qui_sortent)}** | **${groupes(t.octets_qui_sortent)}** |`);
  const p = m.publications;
  if (p?.mesuree) {
    l.push(`| Anciennes publications (GitHub Releases, hors de l'arbre) | ${p.publications} publications dont ${p.pre_publications} pré-publications | ${p.assets} assets | ${groupes(p.octets)} (${bref(p.octets)}) |${SUFFIXE_VOLATIL}`);
  } else {
    l.push(`| Anciennes publications (GitHub Releases, hors de l'arbre) | non mesuré (${p?.raison ?? 'non mesuré'}) | | |${SUFFIXE_VOLATIL}`);
  }
  l.push('');
  const g = m.migrations;
  const r0 = m.references_qui_restent;
  l.push(`Migrations de données : ${g.sql_donnees} \`.sql\` sans DDL (nature « données » de \`controler-les-migrations-lib.mjs#analyserUneMigration\`) et ${g.json_donnees} registres \`.json\` de ces migrations. Restent : ${g.sql_structure} migrations de structure, dont **${g.structure_avec_donnees} mêlent DDL et instructions de données** (${m.migrations.mixtes_si_elles_sortaient.fichiers} fichiers avec leurs registres, ${bref(m.migrations.mixtes_si_elles_sortaient.octets)}, non comptés ci-dessus : \`analyserUneMigration\` les classe « structure » dès qu'il y a un DDL ; ${r0.migrations_mixtes} fichiers les citent par leur nom), et ${g.json_structure} registres de migration de structure. Restent aussi \`sources/sources.json\` (manifeste), \`sources/tipeee/\` (instantané livré avec le site) et \`sources/discord/\` (vide).`);
  l.push('');
  l.push('**Qui les lit encore** (fichiers suivis, hors les catégories qui sortent ; un fichier compte une fois par colonne ; motifs et faux positifs : `client/scripts/inventaire-sortie-du-contenu-lib.mjs#MOTIFS`)');
  l.push('');
  l.push('| Famille | Fichiers | `data/rows` | Migrations de données (par nom) | `sources/raw` | Exemples |');
  l.push('| --- | ---: | ---: | ---: | ---: | --- |');
  for (const f of m.lecteurs_par_famille) {
    if (!f.fichiers) continue;
    l.push(`| ${f.titre} | ${f.fichiers} | ${f.rows} | ${f.migrations_donnees} | ${f.sources_raw} | ${f.exemples.map(c).join(', ')}${f.fichiers > f.exemples.length ? ', …' : ''} |`);
  }
  l.push(`| **Total** | **${t.fichiers_suivis_qui_les_lisent}** | | | | |`);
  l.push('');
  const r = m.references_qui_restent;
  const tl = m.tests_lecteurs;
  l.push(`Dans \`client/test/\` : ${tl.fichiers_de_test} fichiers de test et ${tl.aides} aides, dont ${tl.declares_par_nature} fichiers déjà déclarés « lit le dépôt par nature » (\`essai-mecanique-tests.mjs#LIT_LE_DEPOT_PAR_NATURE\`). Les ${tl.non_declares} autres fichiers de test citent un de ces chemins sans être déclarés dans \`LIT_LE_DEPOT_PAR_NATURE\` : à trier un à un au lot 12.`);
  l.push('');
  l.push(`Références notées mais non comptées : ${r.migrations_dossier} fichiers citent le dossier \`data/migrations/\` (il reste, pour la structure), ${r.sources_manifeste} le manifeste \`sources/sources.json\` (reste), ${r.sources_tipeee} \`sources/tipeee/\` (reste), ${r.sources_discord} \`sources/discord/\`, ${r.publications} les publications GitHub (les nouvelles restent) ; ${m.lectures_indirectes_de_rows} fichiers n'atteignent \`data/rows\` que par une commande ou un module (\`db:build\`, \`db:sync-pages\`, \`pages_md\`…).`);
  l.push('');
  l.push('Cette section se périme à chaque copie de `data/rows` et à chaque changement des fichiers qui citent ces chemins ; `--verifier` informe, `--strict` n\'est branché nulle part : le lot 12 la régénère à la demande, aucune autre PR n\'a à le faire.');
  l.push('');
  l.push('Faux positifs connus :');
  for (const f of m.faux_positifs_connus) l.push(`- ${f}`);
  l.push(MARQUEUR_FIN);
  return l.join('\n');
}

/** L'en-tête du document de l'inventaire (rien n'y cite un chemin du contenu : il est lu comme le reste du dépôt). */
export const EN_TETE_DU_DOCUMENT = `# Lot 12 — inventaire de ce qui sort du dépôt

> Mesure datée, régénérée à la demande par le lot 12 ; aucune autre PR n'a à la régénérer. Fichier écrit par \`scripts/inventaire-sortie-du-contenu.mjs\` seul : ne pas l'éditer à la main.
> Le plan du chantier est dans \`docs/chantier-base-de-dev.md\`.
`;

/** Le document entier : l'en-tête, puis la section entre ses marqueurs. */
export const rendreLeDocument = (mesure) => `${EN_TETE_DU_DOCUMENT}\n${rendreLaSection(mesure)}\n`;

/** Remplace le bloc entre les marqueurs. Lève une erreur si les marqueurs manquent ou sont dans le désordre. */
export function remplacerLaSection(document, section) {
  const debut = document.indexOf(MARQUEUR_DEBUT);
  const fin = document.indexOf(MARQUEUR_FIN);
  if (debut < 0 || fin < 0 || fin < debut) throw new Error(`marqueurs absents ou dans le désordre (${MARQUEUR_DEBUT} … ${MARQUEUR_FIN})`);
  return document.slice(0, debut) + section + document.slice(fin + MARQUEUR_FIN.length);
}

export function extraireLaSection(document) {
  const debut = document.indexOf(MARQUEUR_DEBUT);
  const fin = document.indexOf(MARQUEUR_FIN);
  if (debut < 0 || fin < 0 || fin < debut) return null;
  return document.slice(debut, fin + MARQUEUR_FIN.length);
}

/** La section sans ses lignes volatiles (date, commit, publications). */
export const sansLeVolatil = (section) => section.split('\n').filter((x) => !x.endsWith(SUFFIXE_VOLATIL)).join('\n');

/** @returns {boolean} la section du document dit la même chose que la mesure (à la date, au commit et aux publications près) */
export function sectionAJour(document, mesure) {
  const actuelle = extraireLaSection(document);
  return actuelle !== null && sansLeVolatil(actuelle) === sansLeVolatil(rendreLaSection(mesure));
}

/** Les fichiers de test déclarés `LIT_LE_DEPOT_PAR_NATURE` (lus dans le texte de l'essai mécanique ; vide si le fichier manque). */
export function fichiersDeclaresParNature(texte) {
  const debut = texte.indexOf('LIT_LE_DEPOT_PAR_NATURE = Object.freeze({');
  if (debut < 0) return [];
  const fin = texte.indexOf('\n});', debut);
  const bloc = texte.slice(debut, fin < 0 ? undefined : fin);
  return [...bloc.matchAll(/^\s*'([^']+\.test\.mjs)'\s*:/gm)].map((x) => x[1]);
}
