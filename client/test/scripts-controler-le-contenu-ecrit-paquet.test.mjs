// Le contrôle du contenu écrit et l'identité du lot (lot 11, PR 4 ; docs/flux-git.md, « Contenu écrit à la main (lot 8) » et « Ce que GitHub publie avec la bascule 2 ») :
// sous l'interrupteur tools/flux-git/bascule-2.json (lu dans origin/dev), data/paquet.json (l'identité du dernier lot, sans contenu) ne change que dans un commit du
// workflow de mise à jour (« Lot : » ou « Copie : »), jamais à la main ni dans un correctif urgent. Éteint, rien de ceci n'existe : le contrôle est celui d'avant.
//   node --test test/scripts-controler-le-contenu-ecrit-paquet.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { controlerLeContenu, FICHIER_D_IDENTITE, INTERRUPTEUR, INTERRUPTEUR_BASCULE_2, raisonHorsWorkflow, refusDeLIdentite } from '../scripts/controler-le-contenu-ecrit-lib.mjs';
import { BOT, FICHIER_D_IDENTITE as FICHIER_DU_WORKFLOW } from '../scripts/mise-a-jour-github.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/controler-le-contenu-ecrit.mjs', import.meta.url));
const LOT = '3f8fad5b-d9cb-469f-a165-70867728950e';
const BRANCHE_DU_WORKFLOW = 'feature/mise-a-jour-regles-20261115-1200';
const PAQUET = 'data/paquet.json';
const duBot = (fichiers, message = `Mise à jour des règles V0.5 (site de dev, lot 3f8fad5b)\n\nLot : ${LOT}\n`) => ({
  sha: 'a'.repeat(40), auteur: BOT.nom, courriel: BOT.courriel, commiteur: BOT.nom, courrielCommiteur: BOT.courriel, message, fichiers,
});
const aLaMain = (fichiers) => ({ ...duBot(fichiers), sha: 'b'.repeat(40), auteur: 'Quelqu’un', courriel: 'q@example.com', commiteur: 'Quelqu’un', courrielCommiteur: 'q@example.com' });

test('le nom du fichier est celui que le workflow écrit, et l’interrupteur celui de bascule-2.json', () => {
  assert.equal(FICHIER_D_IDENTITE, PAQUET);
  assert.equal(FICHIER_D_IDENTITE, FICHIER_DU_WORKFLOW);
  assert.equal(INTERRUPTEUR_BASCULE_2, 'tools/flux-git/bascule-2.json');
  assert.notEqual(INTERRUPTEUR_BASCULE_2, INTERRUPTEUR, 'deux interrupteurs distincts');
});

test('éteint (bascule 2), le contrôle est celui d’avant : data/paquet.json n’est pas vu, et dans un commit du workflow il reste un fichier hors de data/rows/', () => {
  // aucune règle de l'identité : même allumé pour la bascule 1, une PR à la main qui change data/paquet.json passe (rien n'écrit ce fichier avant la bascule 2)
  const r = controlerLeContenu({ actif: true, cible: 'dev', source: 'feature/x', fichiers: [PAQUET], commits: [] });
  assert.deepEqual(r, { actif: true, refus: [] });
  assert.deepEqual(controlerLeContenu({ actif: true, cible: 'master', source: 'hotfix/x', fichiers: [PAQUET] }).refus, []);
  assert.match(raisonHorsWorkflow(duBot(['data/rows/metier.sql', PAQUET]), BRANCHE_DU_WORKFLOW), /data\/paquet\.json/, 'sans l’option, un fichier hors de data/rows/ est refusé');
  const refus = controlerLeContenu({ actif: true, cible: 'dev', source: BRANCHE_DU_WORKFLOW, fichiers: ['data/rows/metier.sql', PAQUET], commits: [duBot(['data/rows/metier.sql', PAQUET])] }).refus;
  assert.deepEqual(refus.map((x) => x.regle), ['ecrit-a-la-main']);
  assert.ok(!('bascule2' in controlerLeContenu({ actif: false, cible: 'dev', source: 'feature/x' })), 'la sortie éteinte est inchangée');
});

test('allumé : le commit du workflow peut porter data/rows/ ET data/paquet.json, ou l’identité seule ; rien d’autre', () => {
  const pr = (commits, fichiers) => controlerLeContenu({ actif: true, bascule2: true, cible: 'dev', source: BRANCHE_DU_WORKFLOW, fichiers, commits }).refus;
  assert.deepEqual(pr([duBot(['data/rows/metier.sql', PAQUET])], ['data/rows/metier.sql', PAQUET]), []);
  assert.deepEqual(pr([duBot([PAQUET])], [PAQUET]), [], 'aucune ligne ne change : l’identité seule');
  assert.deepEqual(pr([duBot(['data/rows/metier.sql', PAQUET], `Copie du contenu du site de dev vers le dépôt\n\nCopie : ${LOT}\n`)], ['data/rows/metier.sql', PAQUET]), [], '« Copie : » est admis comme « Lot : »');
  const autre = pr([duBot(['data/rows/metier.sql', PAQUET, 'client/src/lib/x.mjs'])], ['data/rows/metier.sql', PAQUET, 'client/src/lib/x.mjs']);
  assert.ok(autre.length && autre.every((x) => ['ecrit-a-la-main', 'paquet-a-la-main'].includes(x.regle)), 'un autre fichier dans le commit du workflow : refusé');
});

test('allumé : data/paquet.json à la main est refusé (sans commit du workflow, autre auteur, autre branche, message sans « Lot : »)', () => {
  const pr = (source, commits, fichiers = [PAQUET]) => controlerLeContenu({ actif: true, bascule2: true, cible: 'dev', source, fichiers, commits }).refus;
  assert.deepEqual(pr('feature/x', [aLaMain([PAQUET])]).map((x) => x.regle), ['paquet-a-la-main']);
  assert.match(pr('feature/x', [aLaMain([PAQUET])])[0].message, /Effectuer la mise à jour/);
  assert.deepEqual(pr('feature/x', [duBot([PAQUET])]).map((x) => x.regle), ['paquet-a-la-main'], 'la bonne identité sur une autre branche : refusé');
  assert.deepEqual(pr(BRANCHE_DU_WORKFLOW, [duBot([PAQUET], 'sans ligne de lot')]).map((x) => x.regle), ['paquet-a-la-main']);
  assert.deepEqual(pr(BRANCHE_DU_WORKFLOW, []).map((x) => x.regle), ['paquet-a-la-main'], 'aucun commit ne le porte : contrôle impossible, refusé');
  // un commit à la main mêlé à un commit du workflow : le premier est refusé
  assert.deepEqual(pr(BRANCHE_DU_WORKFLOW, [duBot([PAQUET]), aLaMain([PAQUET])]).map((x) => x.regle), ['paquet-a-la-main']);
  // la bascule 2 seule suffit (la bascule 1 éteinte) ; ses règles ne dépendent pas de la première
  assert.deepEqual(controlerLeContenu({ actif: false, bascule2: true, cible: 'dev', source: 'feature/x', fichiers: [PAQUET], commits: [aLaMain([PAQUET])] }).refus.map((x) => x.regle), ['paquet-a-la-main']);
  // ce qui ne touche pas l'identité n'est pas concerné
  assert.deepEqual(refusDeLIdentite({ cible: 'dev', source: 'feature/x', fichiers: ['client/src/lib/x.mjs'], commits: [] }), []);
  assert.deepEqual(refusDeLIdentite({ cible: 'master', source: 'dev', fichiers: [PAQUET], commits: [] }), [], 'la livraison dev → master n’est pas concernée');
});

test('allumé : data/rows/ à la main reste refusé comme avant, même quand un commit du workflow porte l’identité', () => {
  const refus = controlerLeContenu({
    actif: true, bascule2: true, cible: 'dev', source: BRANCHE_DU_WORKFLOW, fichiers: ['data/rows/metier.sql', PAQUET],
    commits: [duBot(['data/rows/metier.sql', PAQUET]), aLaMain(['data/rows/metier.sql'])],
  }).refus;
  assert.deepEqual(refus.map((x) => x.regle), ['ecrit-a-la-main']);
});

test('allumé : un correctif urgent ne porte pas data/paquet.json (en plus de ni contenu ni structure) ; éteint, il ne le voit pas', () => {
  const hotfix = (extra) => controlerLeContenu({ actif: true, cible: 'master', source: 'hotfix/correctif', fichiers: ['client/src/lib/x.mjs', PAQUET], ...extra });
  assert.deepEqual(hotfix({}).refus, [], 'éteint (bascule 2) : comme avant');
  const r = hotfix({ bascule2: true }).refus;
  assert.deepEqual(r.map((x) => x.regle), ['correctif-urgent']);
  assert.match(r[0].message, /data\/paquet\.json/);
  // avec la bascule 1 éteinte aussi
  assert.deepEqual(controlerLeContenu({ actif: false, bascule2: true, cible: 'master', source: 'hotfix/correctif', fichiers: [PAQUET] }).refus.map((x) => x.regle), ['correctif-urgent']);
  // contenu et identité ensemble : les deux refus, sans doublon de règle pour data/rows
  const deux = controlerLeContenu({ actif: true, bascule2: true, cible: 'master', source: 'hotfix/correctif', fichiers: ['data/rows/metier.sql', PAQUET] }).refus;
  assert.equal(deux.length, 2);
  // la livraison dev → master (identité comprise) n'est jamais refusée
  assert.deepEqual(controlerLeContenu({ actif: true, bascule2: true, cible: 'master', source: 'dev', fichiers: [PAQUET, 'data/rows/metier.sql'] }).refus, []);
});

const avecGit = spawnSync('git', ['--version']).status === 0;
test('dans un dépôt : l’interrupteur de la bascule 2 se lit sur origin/dev ; éteint, l’identité à la main passe ; allumé, elle est refusée sauf par le workflow ; hotfix refusée', { skip: !avecGit && 'git indisponible' }, (t) => {
  const d = dossierTemporaire('controle-contenu-paquet', { t });
  const g = (args) => {
    const r = spawnSync('git', ['-C', d, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });
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
  ecrire(INTERRUPTEUR, '{ "actif": true }\n');
  ecrire(INTERRUPTEUR_BASCULE_2, '{ "actif": false }\n');
  ecrire('data/rows/metier.sql', "INSERT INTO metier VALUES ('a');\n");
  g(['add', '-A']);
  g(['commit', '--quiet', '-m', 'départ']);
  g(['update-ref', 'refs/remotes/origin/dev', 'HEAD']);
  g(['update-ref', 'refs/remotes/origin/master', 'HEAD']);

  // éteint : une PR à la main qui écrit data/paquet.json passe (le contrôle est celui d'avant)
  g(['checkout', '--quiet', '-b', 'feature/identite-a-la-main']);
  ecrire(PAQUET, '{}\n');
  g(['add', '-A']);
  g(['commit', '--quiet', '-m', 'identité à la main']);
  let r = lancer('dev', 'feature/identite-a-la-main');
  assert.equal(r.status, 0, r.stderr);

  // la PR du jour J allume la bascule 2 sur dev
  g(['checkout', '--quiet', 'dev']);
  ecrire(INTERRUPTEUR_BASCULE_2, '{ "actif": true }\n');
  g(['commit', '--quiet', '-am', 'bascule 2 : allumée']);
  g(['update-ref', 'refs/remotes/origin/dev', 'HEAD']);
  g(['checkout', '--quiet', 'feature/identite-a-la-main']);
  r = lancer('dev', 'feature/identite-a-la-main');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /REFUS \[paquet-a-la-main\]/);
  // une PR qui éteint l'interrupteur dans sa branche ne s'en exempte pas
  ecrire(INTERRUPTEUR_BASCULE_2, '{ "actif": false, "a_lire": "éteint par la PR" }\n');
  g(['commit', '--quiet', '-am', 'éteint dans la PR']);
  assert.equal(lancer('dev', 'feature/identite-a-la-main').status, 1);

  // le commit du workflow : les lignes et l'identité ; puis l'identité seule
  g(['checkout', '--quiet', 'dev']);
  g(['checkout', '--quiet', '-b', BRANCHE_DU_WORKFLOW]);
  const commitDuBot = (message) => g(['-c', `user.name=${BOT.nom}`, '-c', `user.email=${BOT.courriel}`, 'commit', '--quiet', '-m', message]);
  ecrire('data/rows/metier.sql', "INSERT INTO metier VALUES ('a'), ('c');\n");
  ecrire(PAQUET, '{ "lot": 1 }\n');
  g(['add', '-A']);
  commitDuBot(`Mise à jour des règles V0.5 (site de dev, lot 3f8fad5b)\n\nLot : ${LOT}`);
  r = lancer('dev', BRANCHE_DU_WORKFLOW);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /rien à refuser/);
  g(['checkout', '--quiet', 'dev']);
  g(['checkout', '--quiet', '-b', `${BRANCHE_DU_WORKFLOW}-2`]);
  ecrire(PAQUET, '{ "lot": 2 }\n');
  g(['add', '-A']);
  commitDuBot(`Mise à jour des règles V0.6 (site de dev, lot 3f8fad5b)\n\nLot : ${LOT}`);
  r = lancer('dev', `${BRANCHE_DU_WORKFLOW}-2`);
  assert.equal(r.status, 0, r.stderr);
  // le même commit hors de la branche du workflow : refusé
  r = lancer('dev', 'feature/imite');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REFUS \[paquet-a-la-main\]/);

  // un correctif urgent qui change l'identité : refusé
  g(['checkout', '--quiet', 'dev']);
  g(['checkout', '--quiet', '-b', 'hotfix/correctif']);
  ecrire(PAQUET, '{ "lot": 3 }\n');
  g(['add', '-A']);
  g(['commit', '--quiet', '-m', 'hotfix avec identité']);
  r = lancer('master', 'hotfix/correctif');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REFUS \[correctif-urgent\].*data\/paquet\.json/);
});
