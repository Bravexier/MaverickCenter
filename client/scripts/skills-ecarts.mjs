// Écarts de skills : un découpage ou un resserrement de skill ne perd rien (outil de tech-skills ; logique : scripts/skills-ecarts-lib.mjs).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ecarts, LIBELLES, lireIgnorer, TYPES } from './skills-ecarts-lib.mjs';

const AIDE = `node scripts/skills-ecarts.mjs <réf-git-d-avant> <skill> [<skill>…] [--avec <skill>…] [--docs] [--ignorer <fichier>]

Lit chaque .claude/skills/<skill>/SKILL.md tel qu'il était à <réf-git-d-avant> (git show), en relève les éléments — identifiants entre
accents graves, décisions R… (\\bR[0-9]+\\b), noms de fichiers et de tests, lignes des blocs de code — et vérifie que chacun se retrouve
dans l'union des skills ACTUELS : les <skill> donnés (un skill supprimé depuis est permis) et ceux de --avec, chacun avec tous les .md de
son dossier.
  --avec <skill>…      d'autres skills actuels où chercher (ceux qui ont reçu une partie du contenu)
  --docs               chercher aussi dans tout docs/ (tous les .md, sous-dossiers compris), SAUF docs/decisions-regles.md : le registre
                       cite toutes les décisions, il rendrait chaque R… « trouvé »
  --ignorer <fichier>  exceptions justifiées, une par ligne : « élément  # raison » (raison obligatoire) ; un élément qui commence
                       par # (une couleur) s'écrit entre accents graves : « \`#ff0000\`  # raison » ; une ligne qui commence par #
                       hors accents graves est un commentaire
Sortie : les éléments manquants, par type. Code 0 s'il n'en manque aucun, 1 s'il en reste, 2 pour une erreur (réf ou skill absent à la
réf d'avant, ligne d'exception sans raison).`;

function options(argv) {
  const o = { ref: null, skills: [], avec: [], docs: false, ignorer: null, aide: false };
  let liste = 'skills';
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--aide' || a === '--help' || a === '-h') o.aide = true;
    else if (a === '--docs') o.docs = true;
    else if (a === '--avec') liste = 'avec';
    else if (a === '--ignorer') { o.ignorer = argv[++i]; if (!o.ignorer) throw new Error('--ignorer attend un fichier'); }
    else if (a.startsWith('--')) throw new Error(`option inconnue : ${a} (--aide)`);
    else if (!o.ref) o.ref = a;
    else o[liste].push(a);
  }
  return o;
}

const git = (racine, args) => spawnSync('git', args, { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function mdDe(dossier) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { recursive: true }).map(String).filter((f) => f.endsWith('.md')).map((f) => join(dossier, f))
    .filter((f) => statSync(f).isFile()).sort();
}

function principal() {
  const o = options(process.argv.slice(2));
  if (o.aide || !o.ref || !o.skills.length) { console.log(AIDE); return o.aide ? 0 : 2; }
  const r = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  if (r.status !== 0) throw new Error('pas dans un dépôt Git');
  const racine = r.stdout.trim();
  if (git(racine, ['rev-parse', '--verify', '--quiet', `${o.ref}^{commit}`]).status !== 0) throw new Error(`réf inconnue : ${o.ref}`);

  const avant = o.skills.map((skill) => {
    const s = git(racine, ['show', `${o.ref}:.claude/skills/${skill}/SKILL.md`]);
    if (s.status !== 0) throw new Error(`le skill ${skill} n'existe pas à ${o.ref} (.claude/skills/${skill}/SKILL.md absent)`);
    return { skill, texte: s.stdout };
  });
  const sources = [...new Set([...o.skills, ...o.avec])].flatMap((s) => mdDe(join(racine, '.claude', 'skills', s)));
  for (const s of o.avec) if (!existsSync(join(racine, '.claude', 'skills', s))) throw new Error(`--avec ${s} : skill absent de l'arbre de travail`);
  const docs = o.docs ? mdDe(join(racine, 'docs')).filter((f) => relative(racine, f).split('\\').join('/') !== 'docs/decisions-regles.md') : [];
  const corpus = [...sources, ...docs].map((f) => readFileSync(f, 'utf8')).join('\n');
  const ignores = o.ignorer ? lireIgnorer(readFileSync(resolve(process.env.INIT_CWD || process.cwd(), o.ignorer), 'utf8'), o.ignorer) : new Map();

  const res = ecarts({ avant, corpus, ignores });
  const actuels = [...new Set([...o.skills, ...o.avec])].filter((s) => existsSync(join(racine, '.claude', 'skills', s)));
  console.log(`Écarts depuis ${o.ref} : ${o.skills.join(', ')} ; cherchés dans ${actuels.length ? actuels.join(', ') : '(aucun skill actuel)'}`
    + ` (${sources.length} fichier(s))${o.docs ? ` et docs/ (${docs.length} fichier(s), sans decisions-regles.md)` : ''}.`);
  console.log(`Éléments relevés : ${res.releves} ; manquants : ${res.manquants.length}${res.ignores.length ? ` ; ignorés (--ignorer) : ${res.ignores.length}` : ''}.`);
  for (const type of TYPES) {
    const duType = res.manquants.filter((m) => m.type === type);
    if (!duType.length) continue;
    console.log(`Manquants — ${LIBELLES[type]} (${duType.length}) :`);
    for (const m of duType) console.log(`  ${m.element}${o.skills.length > 1 ? `   [${m.skills.join(', ')}]` : ''}`);
  }
  if (res.inutiles.length) console.log(`Exceptions inutiles (jamais manquantes) : ${res.inutiles.join(', ')}`);
  return res.manquants.length ? 1 : 0;
}

try {
  process.exitCode = principal();
} catch (e) {
  console.error(`skills-ecarts : ${e.message}`);
  process.exitCode = 2;
}
