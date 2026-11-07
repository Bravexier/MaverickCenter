// `npm run mutation -- <variante> [options] [fichiers de test…]` (dans client/) : le contrôle par mutation (docs/serveur.md, « Contrôle par
// mutation » ; demande du propriétaire : une modification faite sur le site de dev ne fait jamais échouer la suite). Dans une copie jetable de
// l'arbre courant (fichiers suivis et nouveaux, modifications non commitées comprises ; jamais le dépôt lui-même) :
//   1. un clone git partagé du dépôt (HEAD, branche et origin/* du dépôt : aide-mise-a-jour.mjs et mise-a-jour-regles.mjs lisent `git show HEAD:…`,
//      db-reference.mjs `origin/master`), dont l'arbre de travail reçoit l'arbre courant (non commité, comme dans le dépôt) ; node_modules : un lien ;
//   2. un journal muté produit PAR LE SERVICE D'ÉDITION (scripts/mutation-variantes.mjs : validations, refus et dérivations comme sur le site) ;
//   3. le journal rapatrié dans data/rows de la copie (db-appliquer-edition), puis base et pages refaites (db:build, db:export-pages), db:check
//      (un échec est noté au bilan), et le site construit si un test du site construit (*-html) est lancé ;
//   4. les tests (toute la suite par défaut, ou les fichiers donnés), un rapporteur qui relève les échecs ;
//   5. un bilan : <dossier>/bilan.json (mutations faites et refusées, rapatriement, tests en échec), résumé à l'écran ; journaux de chaque étape dans
//      <dossier>/journaux/. La copie est effacée à la fin (sauf --garder) ; le dossier, avec le bilan et les journaux, reste.
//
// Variantes (scripts/mutation-variantes.mjs) : temoin (aucune modification), textes, noms, valeurs, adresses, suppressions.
// Options :
//   --dossier <d>      dossier de travail (défaut : un dossier neuf « maverick-mutation-* » sous le dossier temporaire du système)
//   --garder           garder la copie (<dossier>/depot) pour y relancer un test à la main
//   --build | --sans-build   construire le site (défaut : seulement si un test *-html est lancé)
//   --sans-tests       s'arrêter après la base, les pages et le build
//   --journal <f>      rapatrier ce journal au lieu d'en produire un (rejouer un passage)
//   --entites a,b      (suppressions) seulement ces entités de lib/edition-modele.mjs#ENTITES
//   --une-sur n        (suppressions) une ligne sur n de chaque entité (la première, puis toutes les n) au lieu de toutes : les tables ne sont pas vidées
//   --exclure t,t.col  (textes, noms, valeurs, adresses) tables ou colonnes laissées intactes ; pour une page, son id
// Code de sortie : 0 si les tests passent, 1 sinon (ou si une étape échoue). Pas dans la CI : un contrôle à la main, en fin de lot qui touche des
// tests sur la base réelle (skill tests-conventions).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VARIANTES } from './mutation-variantes.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** Les options de la ligne de commande. */
export function lireLesOptions(argv) {
  const o = { variante: null, dossier: null, garder: false, build: null, tests: true, journal: null, entites: null, uneSur: null, exclure: null, fichiers: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const suivant = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} : valeur attendue`);
      return argv[++i];
    };
    if (a === '--dossier') o.dossier = resolve(suivant());
    else if (a === '--garder') o.garder = true;
    else if (a === '--build') o.build = true;
    else if (a === '--sans-build') o.build = false;
    else if (a === '--sans-tests') o.tests = false;
    else if (a === '--journal') o.journal = resolve(suivant());
    else if (a === '--entites') o.entites = suivant();
    else if (a === '--une-sur') o.uneSur = suivant();
    else if (a === '--exclure') o.exclure = suivant();
    else if (a === '--') continue;
    else if (a.startsWith('--')) throw new Error(`option inconnue : ${a}`);
    else if (!o.variante) o.variante = a;
    else o.fichiers.push(a);
  }
  if (!VARIANTES.includes(o.variante)) throw new Error(`usage : npm run mutation -- <${VARIANTES.join('|')}> [options] [fichiers de test…] (en-tête de scripts/mutation.mjs)`);
  return o;
}

/** Un fichier de test donné sur la ligne de commande, relatif à client/ : `x`, `x.test.mjs`, `test/x.test.mjs` → `test/x.test.mjs`. */
export function fichierDeTest(nom) {
  let f = nom.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^client\//, '');
  if (!f.startsWith('test/')) f = `test/${f}`;
  if (!f.endsWith('.mjs')) f = `${f}.test.mjs`;
  return f;
}

/** Faut-il construire le site ? Oui si demandé, ou si un test du site construit (*-html) est lancé (toute la suite comprise). */
export const avecBuild = (o) => o.build ?? (o.tests && (!o.fichiers.length || o.fichiers.some((f) => /-html\.test\.mjs$/.test(fichierDeTest(f)))));

function etape(contexte, nom, commande, args, { cwd, accepter = [0] } = {}) {
  const debut = Date.now();
  process.stdout.write(`… ${nom}\n`);
  const r = spawnSync(commande, args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0' } });
  const journal = join(contexte.journaux, `${nom}.log`);
  writeFileSync(journal, `$ ${commande} ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`);
  const e = { etape: nom, code: r.status, duree_s: Math.round((Date.now() - debut) / 100) / 10, journal };
  contexte.bilan.etapes.push(e);
  if (!accepter.includes(r.status)) {
    throw new Error(`${nom} : code ${r.status ?? r.error?.message} (voir ${journal})\n${String((r.stderr || r.stdout) ?? '').split('\n').slice(-15).join('\n')}`);
  }
  return r;
}

/** La copie : clone git partagé (HEAD et branches du dépôt), arbre courant recopié par-dessus, node_modules en lien. */
function copier(contexte) {
  const { depot } = contexte;
  const git = (args, cwd = RACINE) => etape(contexte, `git-${args[0]}`, 'git', args, { cwd });
  const fichiers = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).stdout.split('\0').filter(Boolean);
  etape(contexte, 'git-clone', 'git', ['clone', '--quiet', '--shared', '--no-checkout', RACINE, depot]);
  // les branches distantes du dépôt (origin/master : la production, que lit la base de référence), pas ses branches locales
  etape(contexte, 'git-fetch', 'git', ['fetch', '--quiet', '--no-tags', RACINE, '+refs/remotes/origin/*:refs/remotes/origin/*'], { cwd: depot });
  etape(contexte, 'git-reset', 'git', ['reset', '--quiet'], { cwd: depot }); // l'index suit HEAD ; l'arbre de travail reçoit l'arbre courant
  let n = 0;
  for (const f of fichiers) {
    const source = join(RACINE, f);
    if (!existsSync(source)) continue; // supprimé dans l'arbre courant, pas encore dans l'index
    mkdirSync(dirname(join(depot, f)), { recursive: true });
    cpSync(source, join(depot, f), { verbatimSymlinks: true });
    n += 1;
  }
  symlinkSync(join(CLIENT, 'node_modules'), join(depot, 'client', 'node_modules'));
  appendFileSync(join(depot, '.git', 'info', 'exclude'), '\n/client/node_modules\n');
  contexte.bilan.copie = { fichiers: n };
}

function lancer(o) {
  const dossier = o.dossier ?? mkdtempSync(join(tmpdir(), 'maverick-mutation-'));
  mkdirSync(dossier, { recursive: true });
  const depot = join(dossier, 'depot');
  if (existsSync(depot)) throw new Error(`${depot} existe déjà : un autre dossier de travail, ou effacez-le`);
  const journaux = join(dossier, 'journaux');
  mkdirSync(journaux, { recursive: true });
  const client = join(depot, 'client');
  const bilan = { variante: o.variante, dossier, depot: o.garder ? depot : null, debut: new Date().toISOString(), etapes: [], mutations: null, tests: null };
  const contexte = { depot, journaux, bilan };
  const ecrire = () => writeFileSync(join(dossier, 'bilan.json'), `${JSON.stringify(bilan, null, 1)}\n`);
  try {
    copier(contexte);
    const journal = o.journal ?? join(dossier, 'journal.json');
    if (!o.journal) {
      const args = ['--no-warnings', 'scripts/mutation-variantes.mjs', o.variante, '--journal', journal, '--bilan', join(dossier, 'mutations.json'), '--base', join(dossier, 'mutation.db')];
      if (o.entites) args.push('--entites', o.entites);
      if (o.uneSur) args.push('--une-sur', o.uneSur);
      if (o.exclure) args.push('--exclure', o.exclure);
      etape(contexte, 'mutation', process.execPath, args, { cwd: client });
      const { exemplesDeRefus, ...mutations } = JSON.parse(readFileSync(join(dossier, 'mutations.json'), 'utf8'));
      bilan.mutations = mutations;
      rmSync(join(dossier, 'mutation.db'), { force: true });
    }
    const app = etape(contexte, 'appliquer', process.execPath, ['--no-warnings', 'scripts/db-appliquer-edition.mjs', journal], { cwd: client });
    bilan.rapatriement = app.stdout.trim().split('\n').slice(-6).join('\n');
    etape(contexte, 'db-build', process.execPath, ['--no-warnings', 'scripts/db-build.mjs'], { cwd: client });
    etape(contexte, 'db-derive', process.execPath, ['--no-warnings', 'scripts/db-derive.mjs'], { cwd: client });
    // les contrôles de la base après le rapatriement (comme après un vrai rapatriement) : un échec est un résultat, noté au bilan
    bilan.dbCheck = etape(contexte, 'db-check', process.execPath, ['--no-warnings', 'scripts/db-check.mjs'], { cwd: client, accepter: [0, 1] }).status;
    etape(contexte, 'export-pages', process.execPath, ['--no-warnings', 'scripts/db-export-pages.mjs'], { cwd: client });
    if (avecBuild(o)) etape(contexte, 'build', 'npm', ['run', 'build'], { cwd: client });
    if (o.tests) {
      const fichiers = o.fichiers.length ? o.fichiers.map(fichierDeTest) : ['test/*.test.mjs'];
      const echecs = join(dossier, 'tests.json');
      etape(contexte, 'tests', process.execPath, [
        '--test', '--test-reporter=spec', `--test-reporter-destination=${join(journaux, 'tests-detail.log')}`,
        '--test-reporter=./scripts/mutation-rapporteur.mjs', `--test-reporter-destination=${echecs}`, ...fichiers,
      ], { cwd: client, accepter: [0, 1] });
      bilan.tests = JSON.parse(readFileSync(echecs, 'utf8'));
    }
    bilan.fin = new Date().toISOString();
    return bilan;
  } catch (e) {
    bilan.erreur = e.message;
    return bilan;
  } finally {
    ecrire();
    if (!o.garder) rmSync(depot, { recursive: true, force: true });
  }
}

/** Le résumé du bilan, pour l'écran. */
export function resume(bilan) {
  const l = [`Contrôle par mutation « ${bilan.variante} » — ${bilan.dossier}`];
  const m = bilan.mutations;
  if (m) {
    const t = Object.values(m.parTable ?? {});
    const somme = (k) => t.reduce((s, x) => s + (x[k] ?? 0), 0);
    l.push(`Mutations : ${m.lots} lots ; ${somme('faites')} faites, ${somme('refusees')} refusées par le service${somme('horsDeLEntite') ? `, ${somme('horsDeLEntite')} hors de l'entité (404)` : ''}${m.passes ? ` ; passes ${m.passes.map((p) => p.faites).join(' + ')}` : ''}`);
    for (const [cle, x] of Object.entries(m.parTable ?? {}).filter(([, x]) => x.refusees).slice(0, 40)) l.push(`  ${cle} : ${x.faites} faites, ${x.refusees} refusées`);
  }
  if (bilan.rapatriement) l.push(`Rapatriement : ${bilan.rapatriement.split('\n').pop()}`);
  if (bilan.dbCheck !== undefined) l.push(`db:check : ${bilan.dbCheck === 0 ? 'passe' : `en échec (${join(bilan.dossier, 'journaux', 'db-check.log')})`}`);
  const t = bilan.tests;
  if (t) {
    l.push(`Tests : ${t.total}, ${t.reussis} réussis, ${t.echoues} en échec, ${t.sautes} sautés`);
    for (const e of t.echecs) l.push(`  ✗ ${e.fichier}:${e.ligne} ${e.nom}\n      ${e.message.slice(0, 240)}`);
  }
  if (bilan.erreur) l.push(`Arrêt : ${bilan.erreur}`);
  l.push(`Bilan : ${join(bilan.dossier, 'bilan.json')}${bilan.depot ? ` ; copie gardée : ${bilan.depot}` : ''}`);
  return l.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let o;
  try {
    o = lireLesOptions(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  let bilan;
  try {
    bilan = lancer(o);
  } catch (e) {
    console.error(e.message); // avant la copie (dossier déjà employé) : rien n'est effacé
    process.exit(2);
  }
  console.log(resume(bilan));
  process.exit(bilan.erreur || bilan.tests?.echoues ? 1 : 0);
}
