// npm run test:cible — ne lance que les tests des fichiers modifiés (politique : skill choisir-les-tests ; logique : scripts/tests-cibles-lib.mjs ;
// règles à affiner : scripts/tests-cibles-regles.mjs). La CI lance toujours la suite entière : c'est le filet.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as regles from './tests-cibles-regles.mjs';
import {
  apresRebase, baseDeLaBranche, brancheCourante, construireGraphe, espacesFautifs, fichiersDuLot, marqueursDeConflit, pourquoi, selectionner,
} from './tests-cibles-lib.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const RACINE = resolve(CLIENT, '..');

const AIDE = `npm run test:cible [-- options]   (depuis client/)

Lance les seuls tests que touchent les fichiers modifiés : imports ESM (de proche en proche), tests qui citent le fichier, règles de
scripts/tests-cibles-regles.mjs. La CI lance toujours la suite entière : c'est le filet de sécurité. Quand elle attrape un échec que la
sélection avait manqué, ajouter la règle qui l'aurait choisi dans scripts/tests-cibles-regles.mjs (et son cas dans test/tests-cibles.test.mjs).

Fichiers considérés, par défaut : git diff --name-only <base>...HEAD, plus les fichiers modifiés ou non suivis de l'arbre de travail.

Options :
  --base <réf>         base de comparaison (défaut : origin/dev ; origin/master pour une branche hotfix/…)
  --fichiers a b c     ces fichiers au lieu de ceux de Git (avec --apres-rebase : les fichiers dont un conflit a été résolu à la main)
  --liste              affiche la sélection sans rien lancer
  --pourquoi <test>    dit pourquoi ce test est choisi (sans rien lancer)
  --tout               la suite entière
  --apres-rebase       après un rebase : seulement les tests du recouvrement (fichiers que la base a changés ET que le lot touche) ;
                       recouvrement vide : aucun test, seulement les contrôles des marqueurs de conflit et des espaces
  --avant <réf>        avec --apres-rebase : la pointe de la branche avant le rebase (défaut : ORIG_HEAD)
  --aide               cette aide

Lancement : node --no-warnings scripts/db-export-pages.mjs (comme pretest), puis node --test <tests> ; code de sortie de node --test.`;

function lireOptions(argv) {
  const o = { base: null, fichiers: null, liste: false, pourquoi: null, tout: false, apresRebase: false, avant: 'ORIG_HEAD', aide: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const valeur = () => { if (i + 1 >= argv.length) throw new Error(`${a} attend une valeur`); i += 1; return argv[i]; };
    if (a === '--base') o.base = valeur();
    else if (a === '--avant') o.avant = valeur();
    else if (a === '--pourquoi') o.pourquoi = valeur();
    else if (a === '--liste') o.liste = true;
    else if (a === '--tout') o.tout = true;
    else if (a === '--apres-rebase') o.apresRebase = true;
    else if (a === '--aide' || a === '--help' || a === '-h') o.aide = true;
    else if (a === '--fichiers') {
      o.fichiers ??= [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) { i += 1; o.fichiers.push(argv[i]); }
    } else throw new Error(`option inconnue : ${a} (--aide)`);
  }
  return o;
}

const git = (args) => {
  const r = spawnSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error ? String(r.error) : '') };
};

const versLeDepot = (p) => relative(RACINE, p).split(sep).join('/');

/** Un fichier donné à --fichiers, depuis le dossier d'appel (INIT_CWD sous npm) ou depuis la racine, rendu relatif à la racine. */
function cheminDonne(p) {
  const appel = process.env.INIT_CWD || process.cwd();
  if (isAbsolute(p)) return versLeDepot(p);
  for (const base of [appel, RACINE]) if (existsSync(resolve(base, p))) return versLeDepot(resolve(base, p));
  const premier = p.split(/[\\/]/)[0];
  return existsSync(join(RACINE, premier)) ? p.replace(/\\/g, '/') : versLeDepot(resolve(appel, p));
}

function lire(chemin) {
  try { return readFileSync(join(RACINE, chemin), 'utf8'); } catch { return null; }
}
const existe = (chemin) => { try { return statSync(join(RACINE, chemin)).isFile(); } catch { return false; } };

function graphe() {
  const tests = readdirSync(join(CLIENT, 'test')).filter((f) => f.endsWith('.test.mjs')).map((f) => `client/test/${f}`);
  return construireGraphe({ tests, lire, existe, regles });
}

function lancer(tests) {
  const exporter = spawnSync(process.execPath, ['--no-warnings', 'scripts/db-export-pages.mjs'], { cwd: CLIENT, stdio: 'inherit' });
  if (exporter.status !== 0) return exporter.status ?? 1;
  const r = spawnSync(process.execPath, ['--test', ...tests], { cwd: CLIENT, stdio: 'inherit' });
  return r.status ?? 1;
}

function afficherSelection(fichiers, resultat) {
  console.log(`Fichiers considérés (${fichiers.length}) :`);
  for (const f of fichiers) console.log(`  ${f}`);
  if (resultat.ignores.length) console.log(`Fabriqués, ignorés (${resultat.ignores.length}) : ${resultat.ignores.join(', ')}`);
  if (resultat.sansTest.length) console.log(`Sans test (aucun test ne les atteint, ce n'est pas une erreur) : ${resultat.sansTest.join(', ')}`);
  if (resultat.tout.length) {
    console.log('Suite entière :');
    for (const t of resultat.tout) console.log(`  ${t.fichier} — ${t.raison}`);
    return;
  }
  console.log(`Tests choisis (${resultat.tests.size}) :`);
  for (const [t, raisons] of resultat.tests) {
    const fichiersCause = [...new Set(raisons.map((r) => r.fichier))];
    console.log(`  ${t}  ← ${fichiersCause.slice(0, 3).join(', ')}${fichiersCause.length > 3 ? ` (+${fichiersCause.length - 3})` : ''}`);
  }
  if (resultat.lisentDist.length && resultat.rendu.length) {
    const present = existsSync(join(CLIENT, 'dist', 'index.html'));
    console.log(`Indication : ${resultat.lisentDist.length} test(s) choisi(s) lisent le site construit et des sources du rendu ont changé`
      + ` (${resultat.rendu.slice(0, 3).join(', ')}${resultat.rendu.length > 3 ? '…' : ''}) : lancer \`npm run build\` avant`
      + `${present ? ' (dist/ existe mais peut dater)' : ' (sans dist/, ils se sautent)'}.`);
  }
}

function principal() {
  const o = lireOptions(process.argv.slice(2));
  if (o.aide) { console.log(AIDE); return 0; }
  if (o.tout) {
    console.log('Suite entière (--tout).');
    return o.liste ? 0 : lancer(['test/*.test.mjs']);
  }
  const branche = brancheCourante({ git });
  const base = o.base ?? baseDeLaBranche(branche);
  let fichiers;
  let rebase = null;
  const debut = Date.now();
  if (o.apresRebase) {
    rebase = apresRebase({ git, base, avant: o.avant, resolus: (o.fichiers ?? []).map(cheminDonne) });
    console.log(`Après rebase sur ${base} (ancien point de départ ${rebase.ancien.slice(0, 10)}) : la base a changé ${rebase.arrivees.length} fichier(s),`
      + ` le lot en touche ${rebase.lot.length}, recouvrement ${rebase.communs.length}${rebase.resolus.length ? ` + ${rebase.resolus.length} résolu(s) à la main` : ''}.`);
    if (rebase.avertissement) console.log(`Attention : ${rebase.avertissement}.`);
    const presents = rebase.lot.filter(existe);
    const marqueurs = marqueursDeConflit(git, presents);
    const espaces = espacesFautifs(git, base, rebase.fichiers.filter(existe));
    if (marqueurs.length) { console.log('Marqueurs de conflit restés :'); for (const l of marqueurs) console.log(`  ${l}`); }
    if (espaces) console.log(`git diff --check :\n${espaces}`);
    if (marqueurs.length || espaces) return 1;
    console.log(`Aucun marqueur de conflit dans les ${presents.length} fichier(s) du lot ; git diff --check propre sur le recouvrement.`);
    if (!rebase.fichiers.length) { console.log('Recouvrement vide : aucun test à lancer.'); return 0; }
    fichiers = rebase.fichiers;
  } else {
    fichiers = o.fichiers ? [...new Set(o.fichiers.map(cheminDonne))].sort() : fichiersDuLot(git, base);
  }
  if (!fichiers.length) { console.log(`Aucun fichier modifié par rapport à ${base} : aucun test à lancer.`); return 0; }
  const resultat = selectionner({ fichiers, graphe: graphe(), regles });
  const duree = Date.now() - debut;
  if (o.pourquoi) { for (const l of pourquoi(resultat, o.pourquoi)) console.log(l); return 0; }
  afficherSelection(fichiers, resultat);
  console.log(`(sélection calculée en ${duree} ms ; la CI lance la suite entière)`);
  if (o.liste) return 0;
  if (resultat.tout.length) return lancer(['test/*.test.mjs']);
  if (!resultat.tests.size) { console.log('Aucun test à lancer.'); return 0; }
  return lancer([...resultat.tests.keys()]);
}

try {
  process.exitCode = principal();
} catch (e) {
  console.error(`test:cible : ${e.message}`);
  process.exitCode = 2;
}
