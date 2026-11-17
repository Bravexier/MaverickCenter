// Le contrôle du contenu écrit dans le dépôt (lot 8, garde-fou 12 ; docs/flux-git.md, « Contenu écrit à la main (lot 8) ») : scripts/controler-le-contenu-ecrit-lib.mjs
// (règles pures) et scripts/controler-le-contenu-ecrit.mjs (lecture du dépôt, job controle-du-contenu-ecrit de ci.yml). Éteint tant que l'interrupteur
// tools/flux-git/bascule-1.json ne vaut pas « actif: true » sur origin/dev ; allumé : data/rows/ seulement par le workflow de mise à jour, aucune migration de
// données, ni contenu ni structure dans un correctif urgent. Les cas git tournent dans un petit dépôt temporaire (sautés sans git).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { controlerLeContenu, fichiersDeLaStructure, INTERRUPTEUR, lireLInterrupteur, raisonHorsWorkflow, tablesDeLaStructure } from '../scripts/controler-le-contenu-ecrit-lib.mjs';
import { BOT } from '../scripts/mise-a-jour-github.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../scripts/controler-le-contenu-ecrit.mjs', import.meta.url));
const LOT = '3f8fad5b-d9cb-469f-a165-70867728950e';
const BRANCHE_DU_WORKFLOW = 'feature/mise-a-jour-regles-20261115-1200';
const duBot = (fichiers = ['data/rows/metier.sql'], message = `Mise à jour des règles V0.5 (site de dev, lot 3f8fad5b)\n\nLot : ${LOT}\n`) => ({
  sha: 'a'.repeat(40), auteur: BOT.nom, courriel: BOT.courriel, commiteur: BOT.nom, courrielCommiteur: BOT.courriel, message, fichiers,
});
const aLaMain = (fichiers = ['data/rows/metier.sql']) => ({ ...duBot(fichiers), sha: 'b'.repeat(40), auteur: 'Quelqu’un', courriel: 'q@example.com', commiteur: 'Quelqu’un', courrielCommiteur: 'q@example.com' });

test('l’interrupteur du dépôt est allumé (bascule 1 faite), et se lit strictement', () => {
  assert.equal(lireLInterrupteur(readFileSync(join(RACINE, INTERRUPTEUR), 'utf8')), true, 'allumé par la PR du jour J');
  assert.equal(lireLInterrupteur(null), false, 'fichier absent : éteint');
  assert.equal(lireLInterrupteur('{"actif": true}'), true);
  assert.throws(() => lireLInterrupteur('{"actif": "oui"}'), /actif/);
  assert.throws(() => lireLInterrupteur('pas du json'), /illisible/);
});

test('éteint, rien n’est refusé, quoi que porte la PR', () => {
  const r = controlerLeContenu({ actif: false, cible: 'dev', source: 'feature/x', fichiers: ['data/rows/metier.sql', 'data/schema.sql'], commits: [aLaMain()], migrations: new Map([['0200-x.sql', "UPDATE metier SET nom = 'X';"]]) });
  assert.deepEqual(r, { actif: false, refus: [] });
  assert.deepEqual(controlerLeContenu({ actif: false, cible: 'master', source: 'hotfix/x', fichiers: ['data/rows/metier.sql'] }).refus, []);
});

test('allumé, vers dev : data/rows/ seulement par le commit du workflow de mise à jour (« Lot : » ou « Copie : »)', () => {
  const vers = (source, commits) => controlerLeContenu({ actif: true, cible: 'dev', source, fichiers: ['data/rows/metier.sql'], commits }).refus;
  assert.deepEqual(vers(BRANCHE_DU_WORKFLOW, [duBot()]), []);
  assert.deepEqual(vers(BRANCHE_DU_WORKFLOW, [duBot(undefined, `Copie du contenu du site de dev vers le dépôt (lot 3f8fad5b)\n\nCopie : ${LOT}\n`)]), []);
  assert.equal(vers('feature/a-la-main', [aLaMain()])[0].regle, 'ecrit-a-la-main');
  assert.match(raisonHorsWorkflow(duBot(), 'feature/a-la-main'), /branche du workflow/);
  assert.match(raisonHorsWorkflow(aLaMain(), BRANCHE_DU_WORKFLOW), /github-actions\[bot\]/);
  assert.match(raisonHorsWorkflow(duBot(undefined, 'Mise à jour sans lot'), BRANCHE_DU_WORKFLOW), /Lot : <uuid>/);
  assert.match(raisonHorsWorkflow(duBot(['data/rows/metier.sql', 'client/src/lib/x.mjs']), BRANCHE_DU_WORKFLOW), /change aussi client\/src\/lib\/x\.mjs/);
  // un commit du bot à côté d'un commit à la main : le second seul est refusé
  const deux = vers(BRANCHE_DU_WORKFLOW, [duBot(), aLaMain()]);
  assert.equal(deux.length, 1);
  assert.match(deux[0].message, /^commit bbbbbbb/);
  // sans data/rows/ dans la PR, aucun commit n'est jugé
  assert.deepEqual(controlerLeContenu({ actif: true, cible: 'dev', source: 'feature/x', fichiers: ['client/src/lib/x.mjs'], commits: [aLaMain()] }).refus, []);
});

test('allumé, vers dev : une migration de données est refusée, une migration de structure passe', () => {
  const migrations = new Map([
    ['0200-structure.sql', 'ALTER TABLE metier ADD COLUMN rang INTEGER;'],
    ['0201-donnees.sql', "UPDATE metier SET bonus_brut = 'Nouveau texte' WHERE id = 'x';"],
  ]);
  const r = controlerLeContenu({ actif: true, cible: 'dev', source: 'feature/x', fichiers: ['data/migrations/0200-structure.sql', 'data/migrations/0201-donnees.sql'], migrations }).refus;
  assert.deepEqual(r.map((x) => [x.regle, x.message.split(' ')[0]]), [['donnees', '0201-donnees.sql']]);
});

test('allumé, vers dev : une migration de structure admet l’export refait des seules tables qu’elle nomme ; toute autre table reste refusée', () => {
  const structure = new Map([['0200-metier-rang.sql', 'CREATE TABLE metier__0200 (id TEXT PRIMARY KEY, rang INTEGER); INSERT INTO metier__0200 (id) SELECT id FROM metier; DROP TABLE metier; ALTER TABLE metier__0200 RENAME TO metier; ALTER TABLE race ADD COLUMN rang INTEGER;']]);
  assert.deepEqual([...tablesDeLaStructure(structure)].sort(), ['metier', 'metier__0200', 'race']);
  assert.deepEqual([...tablesDeLaStructure(new Map([['0201-x.sql', "UPDATE metier SET bonus_brut = 'x';"]]))], [], 'une migration de données ne nomme rien');
  const pr = (fichiersDuCommit) => controlerLeContenu({
    actif: true, cible: 'dev', source: 'feature/rang-des-metiers', fichiers: ['data/migrations/0200-metier-rang.sql', 'data/schema.sql', ...fichiersDuCommit],
    commits: [aLaMain(['data/migrations/0200-metier-rang.sql', 'data/schema.sql', ...fichiersDuCommit])], migrations: structure,
  }).refus;
  assert.deepEqual(pr(['data/rows/metier.sql', 'data/rows/race.sql']), [], 'l’export des tables de la migration passe');
  const refus = pr(['data/rows/metier.sql', 'data/rows/sort.sql']);
  assert.deepEqual(refus.map((x) => x.regle), ['ecrit-a-la-main']);
  assert.match(refus[0].message, /fichiers hors de ce que refont les migrations de structure de la PR .* : sort$|: sort\.? /);
  // sans migration de structure, aucun export n'est admis
  assert.equal(controlerLeContenu({ actif: true, cible: 'dev', source: 'feature/x', fichiers: ['data/rows/metier.sql'], commits: [aLaMain()] }).refus.length, 1);
});

// Une migration de structure refait aussi data/rows/VERSION (schema_version) ; un renommage, de plus, les tables qui gardent des noms (journal, historique, lots, plafond).
const prDeStructure = (migration, fichiersDuCommit) => controlerLeContenu({
  actif: true, cible: 'dev', source: 'feature/structure', fichiers: ['data/migrations/0200-x.sql', 'data/schema.sql', ...fichiersDuCommit],
  commits: [aLaMain(['data/migrations/0200-x.sql', 'data/schema.sql', ...fichiersDuCommit])], migrations: new Map([['0200-x.sql', migration]]),
}).refus;
const AJOUT = 'ALTER TABLE metier ADD COLUMN rang INTEGER;';
const RENOMMAGE = "ALTER TABLE metier RENAME COLUMN rang TO rang_brut; UPDATE modification SET champ = 'rang_brut' WHERE champ = 'rang'; UPDATE historique_modification SET champ = 'rang_brut' WHERE champ = 'rang'; UPDATE lot_de_changements SET corps = replace(corps, 'rang', 'rang_brut'); UPDATE numero_donne SET champ = 'rang_brut' WHERE champ = 'rang';";
const QUATRE_TABLES = ['modification', 'historique_modification', 'lot_de_changements', 'numero_donne'].map((t) => `data/rows/${t}.sql`);

test('allumé, vers dev : ALTER TABLE … ADD COLUMN admet data/rows/<t>.sql et VERSION', () => {
  assert.deepEqual(prDeStructure(AJOUT, ['data/rows/metier.sql', 'data/rows/VERSION']), []);
  assert.deepEqual(prDeStructure(AJOUT, ['data/rows/VERSION']), [], 'VERSION seule, avec la migration');
});

test('allumé, vers dev : VERSION sans migration de structure est refusée (aucune migration, ou migration de données)', () => {
  assert.equal(controlerLeContenu({ actif: true, cible: 'dev', source: 'feature/x', fichiers: ['data/rows/VERSION'], commits: [aLaMain(['data/rows/VERSION'])] }).refus.length, 1);
  const donnees = controlerLeContenu({
    actif: true, cible: 'dev', source: 'feature/x', fichiers: ['data/migrations/0201-d.sql', 'data/rows/VERSION'],
    commits: [aLaMain(['data/migrations/0201-d.sql', 'data/rows/VERSION'])], migrations: new Map([['0201-d.sql', "UPDATE metier SET bonus_brut = 'x';"]]),
  }).refus;
  assert.deepEqual(donnees.map((x) => x.regle).sort(), ['donnees', 'ecrit-a-la-main']);
  assert.ok(donnees.find((x) => x.regle === 'ecrit-a-la-main').message.includes(': VERSION'), 'le nom du fichier refusé est dit');
  assert.deepEqual([...fichiersDeLaStructure(new Map([['0201-d.sql', "UPDATE metier SET bonus_brut = 'x';"]]))], []);
});

test('allumé, vers dev : un renommage admet journal, historique, lots déposés et plafond des numéros ; sans renommage ils sont refusés', () => {
  assert.deepEqual(prDeStructure(RENOMMAGE, ['data/rows/metier.sql', 'data/rows/VERSION', ...QUATRE_TABLES]), []);
  assert.deepEqual(prDeStructure(RENOMMAGE, ['data/rows/historique_modification.sql']), [], 'historique_modification.sql seul');
  for (const f of QUATRE_TABLES) {
    const refus = prDeStructure(AJOUT, ['data/rows/metier.sql', 'data/rows/VERSION', f]);
    assert.deepEqual(refus.map((x) => x.regle), ['ecrit-a-la-main'], f);
    assert.ok(refus[0].message.includes(f.replace(/^data\/rows\//, '').replace(/\.sql$/, '')), 'le nom du fichier refusé est dit');
  }
  assert.deepEqual([...fichiersDeLaStructure(new Map([['0200-x.sql', AJOUT]]))].sort(), ['data/rows/VERSION', 'data/rows/metier.sql']);
});

test('allumé, correctif urgent vers master : ni data/rows/, ni data/migrations/, ni data/schema.sql ; la livraison dev → master n’est pas concernée', () => {
  for (const f of ['data/rows/metier.sql', 'data/migrations/0200-x.sql', 'data/schema.sql']) {
    const r = controlerLeContenu({ actif: true, cible: 'master', source: 'hotfix/correctif', fichiers: ['client/src/lib/x.mjs', f] }).refus;
    assert.deepEqual(r.map((x) => x.regle), ['correctif-urgent'], f);
  }
  assert.deepEqual(controlerLeContenu({ actif: true, cible: 'master', source: 'hotfix/correctif', fichiers: ['client/src/lib/x.mjs', 'data/README.md'] }).refus, []);
  assert.deepEqual(controlerLeContenu({ actif: true, cible: 'master', source: 'dev', fichiers: ['data/rows/metier.sql', 'data/schema.sql'] }).refus, []);
});

const avecGit = spawnSync('git', ['--version']).status === 0;
test('dans un dépôt : vert éteint ; allumé sur origin/dev, la PR à la main est refusée, celle du workflow passe ; la PR ne peut pas s’éteindre elle-même', { skip: !avecGit && 'git indisponible' }, (t) => {
  const d = dossierTemporaire('controle-contenu', { t });
  const g = (args, env = {}) => {
    const r = spawnSync('git', ['-C', d, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', ...env } });
    assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
    return r.stdout.trim();
  };
  const ecrire = (f, texte) => {
    mkdirSync(join(d, f, '..'), { recursive: true });
    writeFileSync(join(d, f), texte);
  };
  const lancer = (cible, source) => spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--racine', d, '--cible', cible, '--source', source, '--sha', 'HEAD'], { encoding: 'utf8' });
  g(['init', '--quiet', '-b', 'dev']);
  g(['config', 'user.name', 'test']);
  g(['config', 'user.email', 'test@example.com']);
  g(['config', 'commit.gpgsign', 'false']);
  ecrire(INTERRUPTEUR, '{ "actif": false }\n');
  ecrire('data/rows/metier.sql', "INSERT INTO metier VALUES ('a');\n");
  g(['add', '-A']);
  g(['commit', '--quiet', '-m', 'départ']);
  g(['update-ref', 'refs/remotes/origin/dev', 'HEAD']);

  // éteint : une PR qui écrit data/rows/ à la main passe (et l'on dit que le contrôle est éteint)
  g(['checkout', '--quiet', '-b', 'feature/a-la-main']);
  ecrire('data/rows/metier.sql', "INSERT INTO metier VALUES ('a'), ('b');\n");
  g(['commit', '--quiet', '-am', 'contenu à la main']);
  let r = lancer('dev', 'feature/a-la-main');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Contrôle éteint/);

  // la PR du jour J allume l'interrupteur sur dev
  g(['checkout', '--quiet', 'dev']);
  ecrire(INTERRUPTEUR, '{ "actif": true }\n');
  g(['commit', '--quiet', '-am', 'bascule 1 : contrôle allumé']);
  g(['update-ref', 'refs/remotes/origin/dev', 'HEAD']);
  g(['checkout', '--quiet', 'feature/a-la-main']);
  r = lancer('dev', 'feature/a-la-main');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /REFUS \[ecrit-a-la-main\]/);
  // une PR qui éteint l'interrupteur dans sa propre branche ne s'en exempte pas : il se lit sur origin/dev
  ecrire(INTERRUPTEUR, '{ "actif": false, "a_lire": "éteint par la PR" }\n');
  g(['commit', '--quiet', '-am', 'éteint dans la PR']);
  assert.equal(lancer('dev', 'feature/a-la-main').status, 1);

  // le commit du workflow (branche, identité, ligne « Lot : ») : vert
  g(['checkout', '--quiet', 'dev']);
  g(['checkout', '--quiet', '-b', BRANCHE_DU_WORKFLOW]);
  ecrire('data/rows/metier.sql', "INSERT INTO metier VALUES ('a'), ('c');\n");
  g(['add', '-A']);
  g(['-c', `user.name=${BOT.nom}`, '-c', `user.email=${BOT.courriel}`, 'commit', '--quiet', '-m', `Mise à jour des règles V0.5 (site de dev, lot 3f8fad5b)\n\nLot : ${LOT}`]);
  r = lancer('dev', BRANCHE_DU_WORKFLOW);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /rien à refuser/);

  // une migration de données : refusée
  g(['checkout', '--quiet', 'dev']);
  g(['checkout', '--quiet', '-b', 'feature/migration']);
  ecrire('data/migrations/0200-donnees.sql', "UPDATE metier SET nom = 'Autre';\n");
  g(['add', '-A']);
  g(['commit', '--quiet', '-m', 'migration de données']);
  r = lancer('dev', 'feature/migration');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REFUS \[donnees\] : 0200-donnees\.sql/);
});
