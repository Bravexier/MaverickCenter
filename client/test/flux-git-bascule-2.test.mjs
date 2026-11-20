// Ce que GitHub publie, selon l'interrupteur de la bascule 2 (lot 11, PR 4 et PR 5b ; tools/flux-git/bascule-2.mjs, .github/workflows/livraison.yml ;
// docs/flux-git.md, « Ce que GitHub publie avec la bascule 2 »). Éteint : la livraison est celle d'avant, en production comme en test ; allumé : les deux installateurs sont un « kit seul » (aucune
// page, le job « Site » est sauté).
//   node --test test/flux-git-bascule-2.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { BRANCHE_DE_L_INTERRUPTEUR, INTERRUPTEUR, decisionDeLaLivraison, interrupteurDans, lireLInterrupteur } from '../../tools/flux-git/bascule-2.mjs';
import { INTERRUPTEUR as INTERRUPTEUR_DU_GEL, lireLInterrupteur as lireLInterrupteurDuGel } from '../scripts/gel-des-fusions-lib.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const MODULE = join(RACINE, 'tools', 'flux-git', 'bascule-2.mjs');
const yml = readFileSync(join(RACINE, '.github', 'workflows', 'livraison.yml'), 'utf8');
const wf = YAML.parse(yml);

test('l’interrupteur du dépôt est éteint ; même fichier que le gel des fusions, mais une clé à lui : `actif` et `gel_des_fusions` sont indépendantes (jour J, étape 8 : gel allumé, `actif` encore éteint)', () => {
  assert.equal(INTERRUPTEUR, INTERRUPTEUR_DU_GEL);
  assert.equal(BRANCHE_DE_L_INTERRUPTEUR, 'origin/dev');
  assert.equal(lireLInterrupteur(readFileSync(join(RACINE, INTERRUPTEUR), 'utf8')), false, 'éteint tant que le propriétaire n’a pas choisi le jour J');
  const fichier = JSON.parse(readFileSync(join(RACINE, INTERRUPTEUR), 'utf8'));
  assert.deepEqual([fichier.actif, fichier.gel_des_fusions], [false, true]);
  assert.equal(typeof fichier.a_lire, 'string');
  assert.equal(lireLInterrupteurDuGel(readFileSync(join(RACINE, INTERRUPTEUR), 'utf8')), true, 'gel des fusions allumé le jour J (étape 8)');
  for (const [texte, actif, gel] of [[null, false, false], ['{"actif": true}', true, false], ['{"gel_des_fusions": true}', false, true], ['{"actif": true, "gel_des_fusions": true}', true, true]]) {
    assert.deepEqual([lireLInterrupteur(texte), lireLInterrupteurDuGel(texte)], [actif, gel], String(texte));
  }
  assert.equal(lireLInterrupteur('{}'), false, 'clé absente : éteint');
  for (const texte of ['pas du json', '{"actif": "oui"}', '[]']) assert.throws(() => lireLInterrupteur(texte), /bascule-2\.json/, texte);
});

test('éteint : la livraison est celle d’avant (site construit, job Site, kit complet) en production comme en test ; allumé : les deux installateurs sont un kit seul', () => {
  const ETEINT = { kit_seul: false, construire_le_site: true };
  const ALLUME = { kit_seul: true, construire_le_site: false };
  for (const mode of ['test', 'prod']) {
    assert.deepEqual(decisionDeLaLivraison({ mode, actif: false }), ETEINT, `${mode} éteint`);
    assert.deepEqual(decisionDeLaLivraison({ mode, actif: true }), ALLUME, `${mode} allumé : la production reçoit son kit seul comme le test (PR 5b)`);
    assert.deepEqual(decisionDeLaLivraison({ mode, actif: undefined }), ETEINT, `${mode} : une valeur absente est éteinte`);
    assert.deepEqual(decisionDeLaLivraison({ mode, actif: 'true' }), ETEINT, `${mode} : seul le booléen allume`);
  }
  assert.throws(() => decisionDeLaLivraison({ mode: 'autre', actif: true }), /mode/);
});

test('la ligne de commande : lire l’interrupteur sur une référence git (jamais la branche livrée), decider ; une lecture qui échoue éteint avec un avertissement', (t) => {
  const d = dossierTemporaire('flux-git-bascule-2', { t });
  const g = (args) => {
    const r = spawnSync('git', ['-C', d, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  const lancer = (...args) => spawnSync(process.execPath, [MODULE, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' } });
  g(['init', '--quiet', '-b', 'dev']);
  g(['config', 'user.name', 'test']);
  g(['config', 'user.email', 'test@example.com']);
  g(['config', 'commit.gpgsign', 'false']);
  mkdirSync(join(d, 'tools', 'flux-git'), { recursive: true });
  writeFileSync(join(d, INTERRUPTEUR), '{ "actif": true }\n');
  g(['add', '-A']);
  g(['commit', '--quiet', '-m', 'allumé']);
  g(['update-ref', 'refs/remotes/origin/dev', 'HEAD']);
  assert.deepEqual(interrupteurDans(d), { actif: true, avertissement: null });
  assert.equal(lancer('lire', '--racine', d).stdout, 'actif=true\n');
  // la branche livrée peut dire autre chose : seule la référence compte
  writeFileSync(join(d, INTERRUPTEUR), '{ "actif": false }\n');
  g(['commit', '--quiet', '-am', 'éteint dans la branche livrée']);
  assert.equal(lancer('lire', '--racine', d).stdout, 'actif=true\n');
  assert.equal(lancer('lire', '--racine', d, '--ref', 'HEAD').stdout, 'actif=false\n');
  // référence introuvable, fichier illisible : « false », code 0, avertissement (la publication ne se bloque pas)
  let r = lancer('lire', '--racine', d, '--ref', 'origin/absente');
  assert.deepEqual([r.status, r.stdout], [0, 'actif=false\n']);
  assert.match(r.stderr, /::warning::origin\/absente introuvable/);
  writeFileSync(join(d, INTERRUPTEUR), 'pas du json');
  g(['commit', '--quiet', '-am', 'illisible']);
  r = lancer('lire', '--racine', d, '--ref', 'HEAD');
  assert.deepEqual([r.status, r.stdout], [0, 'actif=false\n']);
  assert.match(r.stderr, /::warning::.*illisible/);
  // decider
  assert.equal(lancer('decider', '--mode', 'test', '--actif', 'true').stdout, 'kit_seul=true\nconstruire_le_site=false\n');
  assert.equal(lancer('decider', '--mode', 'test', '--actif', 'false').stdout, 'kit_seul=false\nconstruire_le_site=true\n');
  assert.equal(lancer('decider', '--mode', 'test', '--actif', '').stdout, 'kit_seul=false\nconstruire_le_site=true\n', 'sortie vide du job version : éteint');
  // la production : éteint, la sortie d'avant (octet pour octet) ; allumé, un kit seul comme le test
  assert.equal(lancer('decider', '--mode', 'prod', '--actif', 'false').stdout, 'kit_seul=false\nconstruire_le_site=true\n');
  assert.equal(lancer('decider', '--mode', 'prod', '--actif', '').stdout, 'kit_seul=false\nconstruire_le_site=true\n');
  assert.equal(lancer('decider', '--mode', 'prod', '--actif', 'true').stdout, 'kit_seul=true\nconstruire_le_site=false\n');
  assert.equal(lancer('decider', '--mode', 'prod', '--actif', 'oui').status, 2);
  assert.equal(lancer('decider', '--mode', 'x', '--actif', 'true').status, 2);
});

test('livraison.yml : l’interrupteur se lit dans origin/dev sans bloquer la version ; le job Site est sauté allumé ; le kit seul n’est demandé que sur décision du module, test et production', () => {
  const { version, site, installateur } = wf.jobs;
  const lecture = version.steps.find((s) => s.id === 'bascule');
  assert.ok(lecture, 'le job version lit l’interrupteur');
  assert.equal(lecture['continue-on-error'], true, 'une lecture qui échoue ne bloque pas la version ni la publication');
  assert.match(lecture.run, /node tools\/flux-git\/bascule-2\.mjs lire --ref origin\/dev/);
  assert.equal(version.steps.at(-1), lecture, 'après le bot : la version est déjà faite');
  assert.match(version.outputs.bascule_2, /steps\.bascule\.outputs\.actif/);
  // le job Site (branche NAS) : sauté allumé, inchangé sinon
  assert.match(site.if, /needs\.version\.outputs\.site != ''/);
  assert.match(site.if, /needs\.version\.outputs\.bascule_2 != 'true'/);
  // l'installateur : décision, construction du site seulement si elle le dit, kit seul seulement si elle le dit
  const decision = installateur.steps.find((s) => s.id === 'decision');
  assert.match(decision.run, /bascule-2\.mjs decider --mode "\$MODE" --actif "\$BASCULE_2"/);
  assert.match(decision.run, /if \[ -f tools\/flux-git\/bascule-2\.mjs \]/, 'un commit d’avant la bascule 2 (hotfix de master) n’a pas le module : livraison d’avant');
  assert.match(decision.run, /kit_seul=false\\nconstruire_le_site=true/);
  assert.equal(installateur.env.BASCULE_2, '${{ needs.version.outputs.bascule_2 }}');
  const construire = installateur.steps.find((s) => /Construire le site/.test(s.name ?? ''));
  assert.equal(construire.if, "steps.decision.outputs.construire_le_site == 'true'");
  assert.ok(installateur.steps.indexOf(decision) < installateur.steps.indexOf(construire));
  const fabrication = installateur.steps.find((s) => s.id === 'fabrication');
  assert.equal(fabrication.env.KIT_SEUL, '${{ steps.decision.outputs.kit_seul }}');
  assert.match(fabrication.run, /if \[ "\$MODE" = test \] \|\| \[ "\$KIT_SEUL" = true \]; then kit="--kit \."; fi/, 'le kit complet reste réservé au test, comme avant ; la production n’en porte que dans sa forme « kit seul »');
  assert.match(fabrication.run, /if \[ "\$KIT_SEUL" = true \]; then kit="\$kit --kit-seul"; site=""; fi/);
  // la note de la livraison de production dit ce qu'est un kit seul et le geste qui l'autorise
  const publication = installateur.steps.find((s) => /Publier la livraison/.test(s.name ?? ''));
  assert.equal(publication.env.KIT_SEUL, '${{ steps.decision.outputs.kit_seul }}');
  assert.match(publication.run, /if \[ "\$KIT_SEUL" = true \]; then[\s\S]*activation-par-paquet/);
  assert.match(fabrication.run, /site="--site client\/dist"/);
  assert.match(fabrication.run, /fabriquer\.mjs --mode "\$MODE" \$site --tag "\$TAG" .* \$kit\)/);
});
