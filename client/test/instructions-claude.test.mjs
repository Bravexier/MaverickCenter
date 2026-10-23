// Instructions de Claude (A2) : agents `.claude/agents/*.md`, skills `.claude/skills/*/SKILL.md`, `CLAUDE.md`, `docs/equipe.md`. Logique pure de
// scripts/instructions-lib.mjs, rejouée sur des textes fabriqués (un cas positif et un négatif par contrôle), puis sur le dépôt. Format et
// budget des skills : skill tenir-un-skill. Les avertissements (skills de 12 à 20 Ko, « lot N » nus, dates) s'écrivent par console.log.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  BUDGET, budget, controlerAgent, controlerClaudeMd, controlerSkill, lireFrontmatter, liste, nomsCites, nonCites, recitDate, renvoisAbsents,
} from '../scripts/instructions-lib.mjs';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

// ------------------------------------------------------------------------------------------------------------------ textes fabriqués

const agent = (champs) => `---\n${champs}\n---\n\n# Corps\n`;
const AGENT_BON = agent('name: tech-x\ndescription: "Un membre : il fait x."\ntools: Read, Grep, mcp__Google_Drive__lire\nmodel: opus\neffort: high\nskills:\n  - format-de-rapport');
const skill = (champs, corps = '# Corps\n') => `---\n${champs}\n---\n\n${corps}`;
const FICHIERS = ['client/src/lib/x-db.mjs', 'client/test/x-db.test.mjs', 'CLAUDE.md'];

describe('logique pure', () => {
  test('frontmatter : YAML strict, une description non entre guillemets avec « : » est refusée', () => {
    assert.deepEqual(lireFrontmatter(skill('name: a\ndescription: "Faire ceci : cela"')).erreurs, []);
    const sansGuillemets = lireFrontmatter(skill('name: a\ndescription: Faire ceci : cela'));
    assert.equal(sansGuillemets.donnees, null);
    assert.match(sansGuillemets.erreurs[0], /YAML invalide/);
    assert.match(lireFrontmatter(skill('name: a\nname: b')).erreurs[0], /YAML invalide/, 'clé en double');
    assert.match(lireFrontmatter('# Pas de frontmatter\n').erreurs[0], /pas de frontmatter/);
    assert.match(lireFrontmatter('---\n- a\n- b\n---\n').erreurs[0], /pas une table/);
    assert.deepEqual(lireFrontmatter('---\r\nname: a\r\n---\r\n').donnees, { name: 'a' }, 'fins de ligne CRLF');
  });

  test('listes : tableau YAML ou chaîne à virgules, sans couper un glob {a,b}', () => {
    assert.deepEqual(liste('Read, Grep,Glob'), ['Read', 'Grep', 'Glob']);
    assert.deepEqual(liste(['a/{b,c}.mjs', ' d ']), ['a/{b,c}.mjs', 'd']);
    assert.deepEqual(liste('a/{b,c}.mjs, d/*'), ['a/{b,c}.mjs', 'd/*']);
    assert.deepEqual(liste(undefined), []);
  });

  test('agent : name, model, effort, outils, skills préchargés', () => {
    const skills = ['format-de-rapport'];
    assert.deepEqual(controlerAgent({ fichier: 'tech-x.md', texte: AGENT_BON, skills }), []);
    assert.deepEqual(controlerAgent({ fichier: 'tech-x.md', texte: agent('name: tech-x\nmodel: inherit\neffort: max'), skills }), [], 'tools et skills facultatifs');
    const mauvais = agent('name: tech-y\ntools: Read, Lire\nmodel: gpt\neffort: extreme\nskills:\n  - zone-absente');
    assert.deepEqual(controlerAgent({ fichier: 'tech-x.md', texte: mauvais, skills }), [
      'name « tech-y » au lieu de « tech-x » (nom du fichier)',
      'model « gpt » hors de opus, sonnet, haiku, fable, inherit',
      'effort « extreme » hors de low, medium, high, xhigh, max',
      'outil inconnu « Lire »',
      'skill préchargé absent « zone-absente »',
    ]);
    assert.match(controlerAgent({ fichier: 'tech-x.md', texte: agent('name: tech-x\ndescription: Un membre : il fait x.'), skills })[0], /YAML invalide/);
  });

  test('skill : name, description (≤ 400 caractères), paths sur des fichiers suivis', () => {
    const bon = skill('name: zone-x\ndescription: "Zone x : à charger avant x."\npaths: ["client/src/lib/x-*.mjs", "client/test/x{-db,-html}.test.mjs"]');
    assert.deepEqual(controlerSkill({ dossier: 'zone-x', texte: bon, fichiers: FICHIERS }), []);
    assert.deepEqual(controlerSkill({ dossier: 'zone-x', texte: skill(`name: zone-x\ndescription: "${'a'.repeat(400)}"`), fichiers: FICHIERS }), []);
    const mauvais = skill(`name: zone-y\ndescription: "${'a'.repeat(401)}"\npaths: ["client/src/lib/x-db.mjs", "client/src/lib/disparu.mjs"]`);
    assert.deepEqual(controlerSkill({ dossier: 'zone-x', texte: mauvais, fichiers: FICHIERS }), [
      'name « zone-y » au lieu de « zone-x » (nom du dossier)',
      'description de 401 caractères (max 400)',
      'paths « client/src/lib/disparu.mjs » ne correspond à aucun fichier suivi',
    ]);
    assert.deepEqual(controlerSkill({ dossier: 'zone-x', texte: skill('name: zone-x'), fichiers: FICHIERS }), ['description absente']);
  });

  test('budget de taille : 12 000 à 20 000 octets à surveiller, au-delà échec', () => {
    assert.deepEqual([BUDGET.surveiller, BUDGET.max], [12_000, 20_000]);
    assert.equal(budget(11_999), 'ok');
    assert.equal(budget(12_000), 'surveiller');
    assert.equal(budget(20_000), 'surveiller');
    assert.equal(budget(20_001), 'trop');
  });

  test('récit daté : « (lot N) » échoue ; « lot N » nu et dates hors citation de décision avertissent', () => {
    assert.deepEqual(recitDate('- La palette suit R41.\n- Couleur de la ceinture.\n'), { echecs: [], avertissements: [] });
    assert.deepEqual(recitDate('- Le rouge (lot 3) et le vert (lot 12).\n'), { echecs: ['L1 : (lot 3)', 'L1 : (lot 12)'], avertissements: [] });
    assert.deepEqual(recitDate('a\n- Ajouté au lot 4 de palette, le 2026-10-22.\n'), { echecs: [], avertissements: ['L2 : lot 4', 'L2 : date 2026-10-22'] });
    assert.deepEqual(recitDate('- R83 (2026-09-14) : les originaux font foi.\n'), { echecs: [], avertissements: [] }, 'date dans une citation de décision');
    assert.deepEqual(recitDate('- Le lotissement 2026, le slot 3.\n'), { echecs: [], avertissements: [] }, 'mots voisins');
  });

  test('renvois : un skill de zone cité entre accents graves existe', () => {
    const skills = ['zone-x', 'ui-tableaux'];
    const texte = 'Voir `zone-x`, `ui-tableaux`, `zone-y`, `sources-z` et `base-w` ; pas `zone-…`, `zone-`, `rezone-x`, `zone-x/SKILL.md`, `tech-front`.';
    assert.deepEqual(renvoisAbsents(texte, skills), ['zone-y', 'sources-z', 'base-w']);
    assert.deepEqual(renvoisAbsents('Voir `zone-x`.', skills), []);
    assert.deepEqual(renvoisAbsents('Le test `site-html` et `site-y`.', skills, ['site-html']), ['site-y'], 'un test cité par son nom court');
  });

  test('citations : chaque nom cité entre accents graves', () => {
    assert.deepEqual(nomsCites('`a-b` `a-b` `c` `d e` `-f` `g-`'), ['a-b', 'c']);
    assert.deepEqual(nonCites('| `tech-front` | x |\n`zone-x`, `zone-xy`', ['tech-front', 'zone-x', 'zone-xy']), []);
    assert.deepEqual(nonCites('`zone-xy` et tech-back sans accents', ['zone-x', 'tech-back']), ['zone-x', 'tech-back']);
  });

  test('CLAUDE.md : au plus 150 lignes', () => {
    assert.deepEqual(controlerClaudeMd(`${'l\n'.repeat(150)}`), []);
    assert.deepEqual(controlerClaudeMd(`${'l\n'.repeat(151)}`), ['151 lignes (max 150)']);
  });
});

// ------------------------------------------------------------------------------------------------------------------------------- dépôt

const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8');
const SKILLS = readdirSync(join(RACINE, '.claude/skills')).filter((d) => existsSync(join(RACINE, '.claude/skills', d, 'SKILL.md'))).sort();
const AGENTS = readdirSync(join(RACINE, '.claude/agents')).filter((f) => f.endsWith('.md')).sort();
const cheminDuSkill = (s) => `.claude/skills/${s}/SKILL.md`;
/** Les tests cités par leur nom court (`site-html`) : pas des renvois à un skill, même sous un préfixe de zone. */
const TESTS = readdirSync(join(RACINE, 'client/test')).filter((f) => f.endsWith('.test.mjs')).map((f) => f.replace(/\.test\.mjs$/, ''));

/**
 * Les fichiers du dépôt, pour les `paths` des skills : les fichiers suivis (`git ls-files`) et aussi les nouveaux pas encore suivis mais non
 * ignorés (`--others --exclude-standard`) — sans eux, un skill ou un fichier créé sur une branche pas encore commitée échouerait. Un fichier
 * suivi mais supprimé de l'arbre ne compte plus. Git est lancé une fois.
 */
function fichiersDuDepot() {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, `git ls-files : ${r.stderr || r.error?.message}`);
  return [...new Set(r.stdout.split('\0').filter(Boolean))].filter((c) => existsSync(join(RACINE, c)));
}

/** Échoue avec la liste des constats `{ fichier: [constats] }` non vides, un par ligne. */
function sansConstat(parFichier, titre) {
  const lignes = Object.entries(parFichier).flatMap(([f, cs]) => cs.map((c) => `  ${f} : ${c}`));
  assert.equal(lignes.length, 0, `${titre} :\n${lignes.join('\n')}`);
}

describe('le dépôt', () => {
  test('agents : frontmatter, name, model, effort, outils, skills préchargés', () => {
    assert.ok(AGENTS.length > 0);
    sansConstat(Object.fromEntries(AGENTS.map((a) => [`.claude/agents/${a}`, controlerAgent({ fichier: a, texte: lire(`.claude/agents/${a}`), skills: SKILLS })])), 'agents');
  });

  test('skills : frontmatter, name, description, paths', () => {
    assert.ok(SKILLS.length > 0);
    const fichiers = fichiersDuDepot();
    sansConstat(Object.fromEntries(SKILLS.map((s) => [cheminDuSkill(s), controlerSkill({ dossier: s, texte: lire(cheminDuSkill(s)), fichiers })])), 'skills');
  });

  test('renvois : les skills de zone cités existent (agents, skills, CLAUDE.md, docs/equipe.md)', () => {
    const textes = [...AGENTS.map((a) => `.claude/agents/${a}`), ...SKILLS.map(cheminDuSkill), 'CLAUDE.md', 'docs/equipe.md'];
    sansConstat(Object.fromEntries(textes.map((p) => [p, renvoisAbsents(lire(p), SKILLS, TESTS).map((n) => `cite le skill absent « ${n} »`)])), 'renvois');
  });

  test('budget de taille des skills : échec au-delà de 20 000 octets, avertissement de 12 000 à 20 000', () => {
    const tailles = SKILLS.map((s) => [cheminDuSkill(s), statSync(join(RACINE, cheminDuSkill(s))).size]).sort((a, b) => b[1] - a[1]);
    const aSurveiller = tailles.filter(([, o]) => budget(o) === 'surveiller');
    if (aSurveiller.length) console.log(`Skills à surveiller (${BUDGET.surveiller} à ${BUDGET.max} octets) :\n${aSurveiller.map(([p, o]) => `  ${p} : ${o} octets`).join('\n')}`);
    sansConstat(Object.fromEntries(tailles.filter(([, o]) => budget(o) === 'trop').map(([p, o]) => [p, [`${o} octets (max ${BUDGET.max})`]])), 'skills trop gros');
  });

  test('pas de récit daté dans les skills : « (lot N) » échoue, « lot N » nu et dates avertissent', () => {
    const parSkill = Object.fromEntries(SKILLS.map((s) => [cheminDuSkill(s), recitDate(lire(cheminDuSkill(s)))]));
    const avertissements = Object.entries(parSkill).flatMap(([p, r]) => r.avertissements.map((a) => `  ${p} ${a}`));
    if (avertissements.length) console.log(`Récit possible à retirer (« lot N », dates hors citation de décision R…) :\n${avertissements.join('\n')}`);
    sansConstat(Object.fromEntries(Object.entries(parSkill).map(([p, r]) => [p, r.echecs])), 'récit daté « (lot N) »');
  });

  test('CLAUDE.md : au plus 150 lignes', () => {
    sansConstat({ 'CLAUDE.md': controlerClaudeMd(lire('CLAUDE.md')) }, 'CLAUDE.md');
  });

  test('docs/equipe.md cite chaque skill et chaque agent entre accents graves', () => {
    const equipe = lire('docs/equipe.md');
    sansConstat({
      'docs/equipe.md': [
        ...nonCites(equipe, SKILLS).map((s) => `ne cite pas le skill « ${s} »`),
        ...nonCites(equipe, AGENTS.map((a) => a.replace(/\.md$/, ''))).map((a) => `ne cite pas l'agent « ${a} »`),
      ],
    }, 'docs/equipe.md');
  });
});
