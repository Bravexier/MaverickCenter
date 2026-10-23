// Écarts de skills (scripts/skills-ecarts.mjs, outil de tech-skills) : relevé des éléments d'un skill (accents graves, décisions R…, fichiers,
// tests, blocs de code), recherche dans les skills actuels et docs/ (sans decisions-regles.md), exceptions justifiées ; puis le script sur un
// dépôt Git jetable (découpage d'un skill, skill supprimé, skill absent à la réf d'avant).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ecarts, extraireElements, lireIgnorer, trouve, typeDe } from '../scripts/skills-ecarts-lib.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/skills-ecarts.mjs', import.meta.url));

const SKILL = `---
name: zone-x
paths: ["client/src/lib/x-db.mjs", "client/test/x*.test.mjs"]
---
# X
- Lecture : \`lib/x-db.mjs\` (\`lireX\`, \`edition-rendu.mjs#RENDUS\`) ; test : \`test/x-db.test.mjs\`.
- Décisions R41 et R4 ; voir docs/serveur.md, « Édition ».
- La colonne \`note_brut\` reste.

\`\`\`bash
npm run db:build
\`\`\`
`;

describe('logique pure', () => {
  test('relevé : accents graves, décisions, fichiers (frontmatter compris), tests, lignes de code', () => {
    const e = extraireElements(SKILL);
    assert.deepEqual(Object.fromEntries(e), {
      'lib/x-db.mjs': 'fichier',
      lireX: 'identifiant',
      'edition-rendu.mjs#RENDUS': 'fichier',
      'test/x-db.test.mjs': 'test',
      note_brut: 'identifiant',
      'npm run db:build': 'ligne-de-code',
      R41: 'decision',
      R4: 'decision',
      'client/src/lib/x-db.mjs': 'fichier',
      'client/test/x*.test.mjs': 'test',
      'docs/serveur.md': 'fichier',
    });
    assert.equal(typeDe('R12'), 'decision');
    assert.equal(typeDe('R12a'), 'identifiant');
  });

  test('recherche : une décision par son numéro entier', () => {
    assert.ok(trouve('R4', 'decision', 'voir R4.'));
    assert.ok(!trouve('R4', 'decision', 'voir R41 et R42'));
    assert.ok(trouve('lireX', 'identifiant', 'la fonction lireX'));
  });

  test('exceptions : « élément  # raison », raison obligatoire', () => {
    const m = lireIgnorer('# commentaire\n\nR4  # décision retirée par le propriétaire\ncli.mjs#appliquer # ancre renommée\n');
    assert.deepEqual([...m], [['R4', 'décision retirée par le propriétaire'], ['cli.mjs#appliquer', 'ancre renommée']]);
    assert.throws(() => lireIgnorer('R4\n'), /ligne 1.*raison est obligatoire/);
    assert.throws(() => lireIgnorer('R4  #   \n'), /raison est obligatoire/);
    const couleur = lireIgnorer('#ff0000  # un commentaire, pas une exception\n`#ff0000`  # couleur retirée de la palette (exemple)\n`a b`  # avec une espace\n');
    assert.deepEqual([...couleur], [['#ff0000', 'couleur retirée de la palette (exemple)'], ['a b', 'avec une espace']]);
    assert.throws(() => lireIgnorer('`#ff0000`\n'), /raison est obligatoire/);
    assert.throws(() => lireIgnorer('`#ff0000`  #  \n'), /raison est obligatoire/);
    assert.throws(() => lireIgnorer('`#ff0000  # raison\n'), /raison est obligatoire/, 'accent grave non fermé');
  });

  test('écarts : manquants classés par type, exceptions utilisées ou inutiles', () => {
    const corpus = 'lib/x-db.mjs lireX edition-rendu.mjs#RENDUS test/x-db.test.mjs note_brut npm run db:build R41 client/src/lib/x-db.mjs docs/serveur.md';
    const r = ecarts({ avant: [{ skill: 'zone-x', texte: SKILL }], corpus, ignores: new Map([['R4', 'retirée'], ['rien', 'inutile']]) });
    assert.equal(r.releves, 11);
    assert.deepEqual(r.manquants.map((m) => [m.type, m.element]), [['test', 'client/test/x*.test.mjs']]);
    assert.deepEqual(r.ignores, [{ element: 'R4', raison: 'retirée' }]);
    assert.deepEqual(r.inutiles, ['rien']);
  });
});

describe('le script sur un dépôt jetable', () => {
  test('découpage, --avec, --docs sans decisions-regles.md, --ignorer, skill supprimé, skill absent avant', (t) => {
    const dossier = dossierTemporaire('skills-ecarts', { t });
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', HOME: dossier, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.org' };
    const git = (...args) => { const r = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: dossier, env, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
    const ecrire = (c, texte) => { mkdirSync(dirname(join(dossier, c)), { recursive: true }); writeFileSync(join(dossier, c), texte); };
    const lancer = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dossier, env: { ...env, INIT_CWD: dossier }, encoding: 'utf8' });

    git('init', '--quiet', '-b', 'dev');
    ecrire('.claude/skills/zone-x/SKILL.md', SKILL);
    ecrire('docs/decisions-regles.md', 'R4 R41 tout');
    git('add', '-A'); git('commit', '--quiet', '-m', 'avant');

    assert.equal(lancer('HEAD', 'zone-x').status, 0, 'rien n\'a changé : 0 manquant');

    // Découpage : zone-x perd sa fin, zone-x-edition en reçoit une partie, docs/serveur.md une autre.
    ecrire('.claude/skills/zone-x/SKILL.md', '---\nname: zone-x\npaths: ["client/src/lib/x-db.mjs", "client/test/x*.test.mjs"]\n---\n- `lib/x-db.mjs` (`lireX`) ; `test/x-db.test.mjs`. docs/serveur.md\n');
    ecrire('.claude/skills/zone-x-edition/SKILL.md', '- `edition-rendu.mjs#RENDUS`, R41.\n');
    ecrire('docs/serveur.md', 'La colonne note_brut ; npm run db:build\n');
    const seul = lancer('HEAD', 'zone-x');
    assert.equal(seul.status, 1);
    assert.match(seul.stdout, /Manquants — décisions \(2\) :\n {2}R4\n {2}R41\n/);
    assert.match(seul.stdout, /Manquants — fichiers \(1\) :\n {2}edition-rendu\.mjs#RENDUS\n/);
    const tout = lancer('HEAD', 'zone-x', '--avec', 'zone-x-edition', '--docs');
    assert.equal(tout.status, 1, 'R4 reste manquant : decisions-regles.md n\'est pas lu');
    assert.match(tout.stdout, /manquants : 1\./);
    assert.match(tout.stdout, /sans decisions-regles\.md/);
    ecrire('exceptions.txt', 'R4  # retirée du skill : elle ne concerne plus la zone (exemple)\n');
    const ignore = lancer('HEAD', 'zone-x', '--avec', 'zone-x-edition', '--docs', '--ignorer', 'exceptions.txt');
    assert.equal(ignore.status, 0, ignore.stdout);
    assert.match(ignore.stdout, /ignorés \(--ignorer\) : 1/);

    // zone-x supprimé après le découpage : permis.
    rmSync(join(dossier, '.claude/skills/zone-x'), { recursive: true });
    assert.equal(lancer('HEAD', 'zone-x', '--avec', 'zone-x-edition').status, 1);

    const absent = lancer('HEAD', 'zone-x-edition');
    assert.equal(absent.status, 2);
    assert.match(absent.stderr, /le skill zone-x-edition n'existe pas à HEAD/);
    ecrire('mauvais.txt', 'R4\n');
    assert.equal(lancer('HEAD', 'zone-x', '--avec', 'zone-x-edition', '--ignorer', 'mauvais.txt').status, 2);
    assert.equal(lancer('inexistante', 'zone-x').status, 2);
    assert.match(lancer('--aide').stdout, /SAUF docs\/decisions-regles\.md/);
    assert.match(lancer('--aide').stdout, /`#ff0000`  # raison/);
  });
});
