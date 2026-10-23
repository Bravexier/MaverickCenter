// Logique de la sélection des tests (npm run test:cible ; politique : skill choisir-les-tests ; règles : scripts/tests-cibles-regles.mjs). Pure : le
// système de fichiers et Git arrivent par des fonctions passées en paramètre (`lire`, `existe`, `git`), ce qui permet à test/tests-cibles.test.mjs de
// la rejouer sur un dépôt en mémoire ou jetable. Tous les chemins sont relatifs à la racine du dépôt, en `/` ; un test se nomme depuis client/
// (`test/x.test.mjs`, ce que prend `node --test` lancé dans client/).
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

// ---------------------------------------------------------------------------------------------------------------------------------- globs

const cacheDesGlobs = new Map();

/** L'expression d'un glob : `**` (tout, `/` compris ; `**\/` aussi zéro dossier), `*` (sans `/`), `?`, `{a,b}`. */
export function globVersRegex(glob) {
  if (cacheDesGlobs.has(glob)) return cacheDesGlobs.get(glob);
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') re += '(?:';
    else if (c === '}') re += ')';
    else if (c === ',' && glob.lastIndexOf('{', i) > glob.lastIndexOf('}', i)) re += '|';
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  const regex = new RegExp(`^${re}$`);
  cacheDesGlobs.set(glob, regex);
  return regex;
}

/** Vrai si `chemin` vérifie l'un des `globs`. */
export const correspond = (chemin, globs) => globs.some((g) => globVersRegex(g).test(chemin));

// ------------------------------------------------------------------------------------------------------------------------- chemins

/** `client/test/x.test.mjs` → `test/x.test.mjs` (le nom donné à node --test depuis client/) ; inverse : `depuisClient`. */
export const nomDeTest = (chemin) => (chemin.startsWith('client/') ? chemin.slice('client/'.length) : chemin);
export const depuisClient = (nom) => (nom.startsWith('client/') ? nom : `client/${nom.replace(/^\.\//, '')}`);

const estTest = (chemin) => /^client\/test\/[^/]+\.test\.mjs$/.test(chemin);
const estDuDossierDesTests = (chemin) => chemin.startsWith('client/test/');
const extension = (chemin) => posix.extname(chemin);
const RACINES = new Set(['', '.', 'client']);

/** Les noms d'un fichier modifié sous lesquels un test peut le citer : depuis la racine, et depuis client/ pour un fichier du site. */
const formesDuChemin = (chemin) => (chemin.startsWith('client/') ? [chemin, chemin.slice('client/'.length)] : [chemin]);

// ------------------------------------------------------------------------------------------------------------------- références

const RE_FROM = /\bfrom\s*(['"])([^'"\n]+)\1/g;
const RE_IMPORT_NU = /\bimport\s*(['"])([^'"\n]+)\1/g;
const RE_IMPORT_DYNAMIQUE = /\bimport\s*\(\s*(['"`])([^'"`\n]+?)(?:\1|\$\{)/g;
const RE_URL = /\bnew\s+URL\(\s*(['"`])([^'"`\n]+?)(?:\1|\$\{)[^)]*?,\s*import\.meta\.url\s*\)/g;
const RE_JOIN = /\b(?:join|resolve)\(\s*[\w$.]+\s*((?:,\s*(['"])[^'"\n$]+\2\s*)+)\)/g;
const RE_SEGMENT = /(['"])([^'"\n]+)\1/g;
const RE_JETON = /[\w.@/-]+/g;
const RE_GUILLEMETS = /(['"`])([^'"`\n]{1,200})\1/g;

/**
 * Ce qu'un module cite : `imports` (spécificateurs relatifs des imports statiques, `export … from`, `import('…')` ; pour un gabarit, la partie fixe),
 * `urls` (`new URL('…', import.meta.url)`), `joints` (join de X, « a », « b » → `a/b`). Une requête (`?raw`, `?page=`) ou une ancre est retirée.
 */
export function extraireReferences(texte) {
  const nettoyer = (s) => s.replace(/[?#].*$/, '');
  const relatif = (s) => s.startsWith('./') || s.startsWith('../');
  const imports = new Set();
  for (const re of [RE_FROM, RE_IMPORT_NU, RE_IMPORT_DYNAMIQUE]) {
    for (const m of texte.matchAll(re)) {
      const s = nettoyer(m[2]);
      if (relatif(s) && s !== './' && s !== '../') imports.add(s);
    }
  }
  const urls = new Set();
  for (const m of texte.matchAll(RE_URL)) {
    const s = nettoyer(m[2]);
    if (s && !/^[a-z][a-z0-9+.-]*:/i.test(s)) urls.add(s);
  }
  const joints = new Set();
  for (const m of texte.matchAll(RE_JOIN)) {
    const segments = [...m[1].matchAll(RE_SEGMENT)].map((s) => s[2]);
    const chemin = posix.normalize(segments.join('/')).replace(/\/$/, '');
    if (chemin && !chemin.startsWith('.') && !chemin.startsWith('/')) joints.add(chemin);
  }
  return { imports: [...imports], urls: [...urls], joints: [...joints] };
}

/** Les jetons « de chemin » d'un texte (`../scripts/db-build.mjs`, `docs/serveur.md`), point final retiré, et ses chaînes entre guillemets. */
function citationsDe(texte) {
  const jetons = new Set();
  for (const m of texte.matchAll(RE_JETON)) {
    const j = m[0].replace(/\.+$/, '');
    if (j.includes('.') || j.includes('/')) jetons.add(j);
  }
  const guillemets = new Set([...texte.matchAll(RE_GUILLEMETS)].map((m) => m[2]));
  return { jetons, guillemets };
}

// ---------------------------------------------------------------------------------------------------------------------------- graphe

/**
 * Le graphe des tests : depuis chaque test (`tests`, chemins depuis la racine), les modules atteints de proche en proche. `lire(chemin)` rend le
 * texte d'un fichier (ou null), `existe(chemin)` dit si un fichier existe. `regles` : le module de règles (EXTENSIONS_DE_MODULE).
 */
export function construireGraphe({ tests, lire, existe, regles }) {
  const extensions = regles.EXTENSIONS_DE_MODULE;
  const estModule = (c) => extensions.includes(extension(c));
  const noeuds = new Map();
  const resoudre = (depuis, spec, { import: estImport }) => {
    let chemin = posix.normalize(posix.join(posix.dirname(depuis), spec));
    if (chemin.startsWith('../') || chemin === '..') return null;
    // La racine ou client/ ouverte par new URL n'est qu'un point de départ (pour un join) : pas une lecture de tout le dépôt.
    if (RACINES.has(chemin.replace(/\/$/, ''))) return null;
    if (spec.endsWith('/')) return `${chemin.replace(/\/$/, '')}/`;
    if (!estImport || existe(chemin)) return chemin;
    for (const suffixe of [...extensions, ...extensions.map((e) => `/index${e}`)]) if (existe(chemin + suffixe)) return chemin + suffixe;
    return chemin;
  };
  const file = [...tests];
  while (file.length) {
    const chemin = file.pop();
    if (noeuds.has(chemin)) continue;
    const texte = lire(chemin) ?? '';
    const refs = extraireReferences(texte);
    const noeud = { chemin, imports: new Set(), lus: new Set(), joints: new Set(refs.joints), citations: null, texte: null };
    for (const spec of refs.imports) {
      const cible = resoudre(chemin, spec, { import: true });
      if (cible && !cible.endsWith('/')) noeud.imports.add(cible);
    }
    for (const spec of refs.urls) {
      const cible = resoudre(chemin, spec, { import: false });
      if (!cible) continue;
      if (!cible.endsWith('/') && estModule(cible) && existe(cible)) noeud.imports.add(cible);
      else noeud.lus.add(cible);
    }
    if (estDuDossierDesTests(chemin)) { noeud.texte = texte; noeud.citations = citationsDe(texte); }
    noeuds.set(chemin, noeud);
    for (const cible of noeud.imports) if (!noeuds.has(cible) && estModule(cible) && existe(cible)) file.push(cible);
  }
  const importeurs = new Map();
  for (const n of noeuds.values()) {
    for (const cible of n.imports) {
      if (!importeurs.has(cible)) importeurs.set(cible, new Set());
      importeurs.get(cible).add(n.chemin);
    }
  }
  // Fermeture de chaque test (lui compris).
  const fermetures = new Map();
  for (const t of tests) {
    const vus = new Set([t]);
    const pile = [t];
    while (pile.length) {
      for (const c of noeuds.get(pile.pop())?.imports ?? []) if (!vus.has(c)) { vus.add(c); if (noeuds.has(c)) pile.push(c); }
    }
    fermetures.set(t, vus);
  }
  return { tests: [...tests].sort(), noeuds, importeurs, fermetures, estModule };
}

/** Vrai si le test (ou un module qu'il atteint) ouvre le site construit `client/dist/`. */
export function litDist(graphe, test) {
  for (const c of graphe.fermetures.get(test) ?? []) {
    const n = graphe.noeuds.get(c);
    if (!n) continue;
    for (const l of n.lus) if (l === 'client/dist/' || l.startsWith('client/dist/') || l === 'client/dist') return true;
    if (n.texte && /(?:\.\.\/)+dist\b|\bjoin\([^)]*['"]dist['"]/.test(n.texte)) return true;
  }
  return false;
}

/** Le texte d'un test et de ses aides (modules de client/test/ qu'il atteint). */
function texteDesAides(graphe, test) {
  let texte = '';
  for (const c of graphe.fermetures.get(test) ?? []) if (graphe.noeuds.get(c)?.texte) texte += `${graphe.noeuds.get(c).texte}\n`;
  return texte;
}

// --------------------------------------------------------------------------------------------------------------------------- sélection

/**
 * Les modules qui touchent directement `fichier` : ceux qui l'importent ou l'ouvrent (dossier compris), le joignent (join de X, « data », « rows »), ou,
 * pour un module de client/test/, le citent. Rend [{ module, comment }].
 */
function contactsDirects(graphe, fichier, regles) {
  const formes = formesDuChemin(fichier);
  const nom = posix.basename(fichier);
  const nomCommun = regles.NOMS_COMMUNS.includes(nom);
  const estJs = graphe.estModule(fichier) || extension(fichier) === '.astro';
  const contacts = [];
  for (const n of graphe.noeuds.values()) {
    if (n.chemin === fichier) { contacts.push({ module: n.chemin, comment: 'est ce fichier' }); continue; }
    if (n.imports.has(fichier)) { contacts.push({ module: n.chemin, comment: `importe ${fichier}` }); continue; }
    const lu = [...n.lus].find((l) => l === fichier || (l.endsWith('/') && fichier.startsWith(l)));
    if (lu) { contacts.push({ module: n.chemin, comment: `ouvre ${lu} (new URL)` }); continue; }
    // Un seul segment (join de X, « client » ou « scripts ») n'est qu'un point de départ : il ne vaut que pour un nom de fichier exact (join de la
    // racine et « CLAUDE.md ») ; à partir de deux segments, le chemin vaut aussi pour ce qu'il contient (join de X, « data », « rows »).
    // Les exemples de ce fichier s'écrivent ainsi, sans la syntaxe : il est lui-même lu par la sélection.
    const joint = [...n.joints].find((j) => formes.some((f) => f === j || (j.includes('/') && f.startsWith(`${j}/`))));
    if (joint) { contacts.push({ module: n.chemin, comment: `joint « ${joint} » (join)` }); continue; }
    if (!n.citations) continue;
    let cite = null;
    for (const j of n.citations.jetons) {
      if (!j.endsWith(nom)) continue;
      if (formes.some((f) => j === f || j.endsWith(`/${f}`))) { cite = `cite ${j}`; break; }
      if (!estJs && !nomCommun && (j === nom || j.endsWith(`/${nom}`))) { cite = `cite le nom ${j}`; break; }
    }
    if (!cite && estJs && !nomCommun && n.citations.guillemets.has(nom)) cite = `cite '${nom}'`;
    if (cite) contacts.push({ module: n.chemin, comment: cite });
  }
  return contacts;
}

/** Les tests qui atteignent `module`, chacun avec le chemin d'imports qui y mène (test → … → module). */
function testsAtteignant(graphe, module) {
  const precedent = new Map([[module, null]]);
  const file = [module];
  const trouves = [];
  while (file.length) {
    const c = file.shift();
    if (estTest(c)) {
      const chaine = [];
      for (let x = c; x; x = precedent.get(x)) chaine.push(x);
      trouves.push({ test: c, chaine });
    }
    for (const imp of graphe.importeurs.get(c) ?? []) if (!precedent.has(imp)) { precedent.set(imp, c); file.push(imp); }
  }
  return trouves;
}

const filtre = (motif) => (typeof motif === 'string' ? (t) => t.includes(motif) : (t) => motif.test(t));

/**
 * La sélection pour `fichiers` (modifiés, depuis la racine). Rend :
 * - `tests` : Map(test depuis client/ → [raisons]) ; une raison : { fichier, par: 'graphe'|'citation'|'regle', detail } ;
 * - `tout` : [{ fichier, raison }] — non vide : lancer la suite entière ;
 * - `sansTest` : fichiers couverts qu'aucun test n'atteint ; `ignores` : fichiers fabriqués ;
 * - `rendu` : fichiers modifiés qui changent le site construit ; `lisentDist` : tests choisis qui lisent dist/.
 */
export function selectionner({ fichiers, graphe, regles }) {
  const tests = new Map();
  const tout = [];
  const sansTest = [];
  const ignores = [];
  const ajouter = (test, raison) => {
    const nom = nomDeTest(test);
    if (!tests.has(nom)) tests.set(nom, []);
    tests.get(nom).push(raison);
  };
  const cacheContenant = new Map();
  const cacheTextes = new Map();
  const texteDe = (t) => { if (!cacheTextes.has(t)) cacheTextes.set(t, texteDesAides(graphe, t)); return cacheTextes.get(t); };
  const cacheDist = new Map();
  const distDe = (t) => { if (!cacheDist.has(t)) cacheDist.set(t, litDist(graphe, t)); return cacheDist.get(t); };
  const existeTest = new Set(graphe.tests);

  for (const fichier of [...new Set(fichiers)].sort()) {
    if (correspond(fichier, regles.FABRIQUES)) { ignores.push(fichier); continue; }
    let choisis = 0;
    // 1 et 2 : graphe et citations.
    for (const { module, comment } of contactsDirects(graphe, fichier, regles)) {
      const par = comment.startsWith('cite') ? 'citation' : 'graphe';
      for (const { test, chaine } of testsAtteignant(graphe, module)) {
        const via = chaine.length > 1 ? ` (via ${chaine.slice(1).map(nomDeTest).join(' → ')})` : '';
        ajouter(test, { fichier, par, detail: `${chaine.length > 1 ? nomDeTest(module) : 'le test'} ${comment}${via}` });
        choisis += 1;
      }
    }
    // 3 : règles.
    const appliquees = regles.REGLES.filter((r) => correspond(fichier, r.fichiers));
    for (const r of appliquees) {
      const detail = `règle « ${r.nom} » : ${r.raison}`;
      if (r.suiteEntiere) tout.push({ fichier, raison: detail });
      for (const nom of r.tests ?? []) {
        const t = depuisClient(nom);
        if (existeTest.has(t)) { ajouter(t, { fichier, par: 'regle', detail }); choisis += 1; }
      }
      for (const motif of r.contenant ?? []) {
        const cle = String(motif);
        if (!cacheContenant.has(cle)) { const f = filtre(motif); cacheContenant.set(cle, graphe.tests.filter((t) => f(texteDe(t)))); }
        for (const t of cacheContenant.get(cle)) { ajouter(t, { fichier, par: 'regle', detail: `${detail} (contient ${cle})` }); choisis += 1; }
      }
      for (const m of r.important ?? []) {
        for (const t of graphe.tests) if (graphe.fermetures.get(t)?.has(m)) { ajouter(t, { fichier, par: 'regle', detail: `${detail} (importe ${m})` }); choisis += 1; }
      }
      if (r.lisentDist) for (const t of graphe.tests) if (distDe(t)) { ajouter(t, { fichier, par: 'regle', detail: `${detail} (lit dist/)` }); choisis += 1; }
    }
    const couvert = appliquees.length > 0 || choisis > 0 || (graphe.estModule(fichier) && correspond(fichier, regles.ZONES_DU_GRAPHE));
    if (!couvert) tout.push({ fichier, raison: 'aucune règle ne couvre ce fichier (ajouter une règle dans scripts/tests-cibles-regles.mjs)' });
    else if (choisis === 0 && !appliquees.some((r) => r.suiteEntiere)) sansTest.push(fichier);
  }
  const rendu = fichiers.filter((f) => !correspond(f, regles.FABRIQUES) && correspond(f, regles.SOURCES_DU_RENDU));
  const lisentDist = [...tests.keys()].filter((t) => distDe(depuisClient(t))).sort();
  return { tests: new Map([...tests].sort(([a], [b]) => a.localeCompare(b))), tout, sansTest, ignores, rendu, lisentDist };
}

/** Les lignes de « --pourquoi <test> » : chaque raison, une par ligne. `test` : `x`, `x.test.mjs`, `test/x.test.mjs` ou `client/test/x.test.mjs`. */
export function pourquoi(resultat, test) {
  let nom = nomDeTest(test.replace(/^\.\//, ''));
  if (!nom.startsWith('test/')) nom = `test/${nom}`;
  if (!nom.endsWith('.test.mjs')) nom = `${nom}.test.mjs`;
  if (resultat.tout.length) return [`${nom} : la suite entière est lancée — ${resultat.tout.map((t) => `${t.fichier} (${t.raison})`).join(' ; ')}`];
  const raisons = resultat.tests.get(nom);
  if (!raisons) return [`${nom} n'est pas choisi par ces fichiers.`];
  return [`${nom} est choisi :`, ...raisons.map((r) => `  - ${r.fichier} — ${r.par} : ${r.detail}`)];
}

// ------------------------------------------------------------------------------------------------------------------------------- Git

/** La base d'une branche : `origin/master` pour une `hotfix/…`, sinon `origin/dev` (docs/flux-git.md). */
export const baseDeLaBranche = (branche) => (branche?.startsWith('hotfix/') ? 'origin/master' : 'origin/dev');

const lignes = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);

function gitOuErreur(git, args) {
  const r = git(args);
  if (r.code !== 0) throw new Error(`git ${args.join(' ')} : ${(r.stderr || r.stdout || '').trim() || `code ${r.code}`}`);
  return r.stdout;
}

/** Les fichiers de l'arbre de travail modifiés, indexés ou non suivis (`git status --porcelain -z`, les deux noms d'un renommage). */
export function fichiersDeLArbre(git) {
  // --no-optional-locks : status ne réécrit pas .git/index (ces scripts ne font que lire).
  const sortie = gitOuErreur(git, ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const morceaux = sortie.split('\0');
  const fichiers = [];
  for (let i = 0; i < morceaux.length; i += 1) {
    const m = morceaux[i];
    if (m.length < 4) continue;
    fichiers.push(m.slice(3));
    if (m[0] === 'R' || m[0] === 'C') { fichiers.push(morceaux[i + 1]); i += 1; }
  }
  return fichiers;
}

/** Les fichiers changés par la branche : `git diff --name-only <base>...HEAD` ∪ l'arbre de travail. */
export function fichiersDuLot(git, base) {
  return [...new Set([...lignes(gitOuErreur(git, ['diff', '--name-only', `${base}...HEAD`])), ...fichiersDeLArbre(git)])].sort();
}

/**
 * Le recouvrement d'un rebase (pur, partagé avec tools/flux-git/etat-branche.mjs) : les fichiers que la base a changés (`arrivees`) et que le lot
 * touche aussi (`lot`), plus ceux dont un conflit a été résolu à la main (`resolus`). Rend { fichiers, communs, resolus }, triés.
 */
export function recouvrement({ arrivees, lot, resolus = [] }) {
  const duLot = new Set(lot);
  const communs = [...new Set(arrivees)].filter((f) => duLot.has(f)).sort();
  return { fichiers: [...new Set([...communs, ...resolus])].sort(), communs, resolus: [...new Set(resolus)].sort() };
}

const lireOuNull = (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } };

/**
 * Le rebase en pause (conflit, `edit`…), ou null : { dossier, branche } — `branche` lue dans head-name (HEAD est alors détachée). `existe` et
 * `lire` (par défaut le disque) testent et lisent un chemin absolu.
 */
export function rebaseEnPause({ git, existe = existsSync, lire = lireOuNull }) {
  const gitDir = (git(['rev-parse', '--absolute-git-dir']).stdout ?? '').trim();
  if (!gitDir) return null;
  for (const d of ['rebase-merge', 'rebase-apply']) {
    const dossier = join(gitDir, d);
    if (!existe(dossier)) continue;
    const nom = lire(join(dossier, 'head-name'))?.trim() ?? null;
    return { dossier, branche: nom && nom !== 'detached HEAD' ? nom.replace(/^refs\/heads\//, '') : null };
  }
  return null;
}

/** La branche courante : celle de HEAD, ou, pendant un rebase en pause, celle qu'il rejoue (null si HEAD est vraiment détachée). */
export function brancheCourante({ git, existe, lire }) {
  const r = git(['symbolic-ref', '--short', '-q', 'HEAD']);
  if (r.code === 0 && r.stdout.trim()) return r.stdout.trim();
  return rebaseEnPause({ git, existe, lire })?.branche ?? null;
}

/**
 * Après un rebase : `arrivees` = ce que la base a changé depuis l'ancien point de départ (`git merge-base <avant> <base>` → `<base>`, `avant` =
 * ORIG_HEAD par défaut, la pointe d'avant le rebase), `lot` = ce que change la branche, et leur recouvrement. Refusé pendant un rebase en pause.
 */
export function apresRebase({ git, base, avant = 'ORIG_HEAD', resolus = [], existe, lire }) {
  // En pause, la branche n'est rejouée qu'en partie : le lot (base...HEAD) serait incomplet, et le recouvrement avec lui.
  if (rebaseEnPause({ git, existe, lire })) {
    throw new Error('rebase en pause : le finir d\'abord (résoudre, git add, git rebase --continue), puis relancer --apres-rebase');
  }
  if (git(['rev-parse', '--verify', '--quiet', `${avant}^{commit}`]).code !== 0) {
    throw new Error(`${avant} introuvable : --apres-rebase se lance juste après le rebase (ou --avant <ancienne pointe>)`);
  }
  const ancien = gitOuErreur(git, ['merge-base', avant, base]).trim();
  const arrivees = lignes(gitOuErreur(git, ['diff', '--name-only', ancien, base]));
  const lot = fichiersDuLot(git, base);
  // ORIG_HEAD est réécrit par d'autres commandes (reset, merge…) : il n'est sûr que juste après le rebase (dernière entrée du reflog).
  const dernier = avant === 'ORIG_HEAD' ? (git(['reflog', '-1', '--format=%gs', 'HEAD']).stdout ?? '').trim() : '';
  const avertissement = avant === 'ORIG_HEAD' && !dernier.startsWith('rebase')
    ? `la dernière opération sur HEAD n'est pas un rebase (« ${dernier} ») : ORIG_HEAD peut dater ; préciser --avant <pointe d'avant le rebase>`
    : null;
  return { ancien, arrivees, lot, avertissement, ...recouvrement({ arrivees, lot, resolus }) };
}

/** Motif d'un marqueur de conflit laissé dans un fichier (début ou fin de bloc). */
export const MOTIF_MARQUEUR = '^(<<<<<<<|>>>>>>>)( |$)';

/** Les lignes `fichier:ligne:texte` qui portent un marqueur de conflit, parmi `fichiers` (ceux qui existent). */
export function marqueursDeConflit(git, fichiers) {
  if (!fichiers.length) return [];
  const r = git(['grep', '-nE', MOTIF_MARQUEUR, '--', ...fichiers]);
  if (r.code === 1) return [];
  if (r.code !== 0) throw new Error(`git grep : ${(r.stderr || '').trim()}`);
  return lignes(r.stdout);
}

/** Les espaces fautifs (`git diff --check <base> -- fichiers`) : la sortie, vide si tout va bien. */
export function espacesFautifs(git, base, fichiers) {
  if (!fichiers.length) return '';
  const r = git(['diff', '--check', base, '--', ...fichiers]);
  return r.code === 0 ? '' : (r.stdout || r.stderr || '').trim();
}
