// L'installateur « kit seul » de PRODUCTION (lot 11, PR 5b ; deploy/installateur/fabriquer.mjs --mode prod --kit . --kit-seul, kit-seul.sh (sections « -prod ») et activation-pose.sh dans
// installateur.sh ; docs/serveur.md, « Bascule 2 : préparation », « PR 5b »). Allumé (`actif` de tools/flux-git/bascule-2.json), GitHub livre à la production une archive SANS pages ni service :
// seulement le kit, que l'installateur pose dans <production>/activation/kit/ avant de lancer activer.sh (qui fabrique les pages et le service depuis le paquet). Il REFUSE, avant toute écriture, une
// instance sans activation-par-paquet (sinon la production resterait sur l'ancien site sans rien activer), hors root, ou qui n'est pas une production installée. Sans --kit-seul, l'installateur de
// production a le même comportement qu'avant (deploy-kit.test.mjs, « production = modèle »). Le vrai script, un faux dépôt pour le kit, des commandes système factices (id, useradd, chown, bash).
//   node --test test/deploy-kit-seul-prod.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip') && have('find')) && 'tar, gzip ou find indisponible';
const racine = dossierTemporaire('deploy-kit-seul-prod');
const FABRIQUER = fileURLToPath(new URL('../../deploy/installateur/fabriquer.mjs', import.meta.url));
let n = 0;

const ecrire = (chemin, contenu) => { mkdirSync(dirname(chemin), { recursive: true }); writeFileSync(chemin, contenu); };
/** Un faux dépôt, juste de quoi faire un kit. */
function fauxDepot() {
  const d = join(racine, `depot-${(n += 1)}`);
  for (const [rel, contenu] of Object.entries({
    '.nvmrc': '22\n',
    'client/package.json': JSON.stringify({ name: 'maverick-client', version: '1.0.0' }),
    'client/astro.config.mjs': 'export default {};',
    'client/scripts/fabriquer-depuis-contenu.mjs': '// script',
    'client/scripts/poser-un-site.mjs': '// script de pose',
    'client/node_modules/astro/bin/astro.mjs': '// astro',
    'client/node_modules/astro/package.json': JSON.stringify({ name: 'astro', version: '1.0.0' }),
    'data/schema.sql': 'PRAGMA user_version = 1;',
    'data/derive.sql': '-- derive',
    'data/migrations/0001-a.sql': '-- m',
    'sources/sources.json': '{}',
    'sources/copies-drive.json': '{}',
    'sources/tipeee/bienvenue.json': '{}',
  })) ecrire(join(d, rel), contenu);
  return d;
}
const lister = (dossier, relatif = '') => readdirSync(join(dossier, relatif), { withFileTypes: true }).flatMap((e) => {
  const rel = relatif ? `${relatif}/${e.name}` : e.name;
  return e.isDirectory() ? lister(dossier, rel) : [rel];
}).sort();
const contenuDe = (fichier) => {
  const octets = readFileSync(fichier);
  return octets.subarray(0, octets.indexOf('\n__ARCHIVE__\n') + 1).toString('utf8');
};
const archiveDe = (fichier, dossier) => {
  const octets = readFileSync(fichier);
  mkdirSync(dossier, { recursive: true });
  const archive = join(dossier, 'archive.tar.gz');
  writeFileSync(archive, octets.subarray(octets.indexOf('\n__ARCHIVE__\n') + '\n__ARCHIVE__\n'.length));
  const r = spawnSync('tar', ['-xzf', archive, '-C', dossier], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return dossier;
};
const echappe = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Le « kit seul » de production (une étiquette VX.Y, ou VX.Y-hotfix.N). */
function kitSeul({ tag = 'v0.2', version = '0.2.0', depot = fauxDepot() } = {}) {
  return fabriquer({ mode: 'prod', tag, version, sha: 'local', sortie: join(racine, 'sortie'), kit: depot, kitSeul: true });
}
/** La production installée « comme avant » : un installateur complet de production, sans activation-par-paquet (il ne change rien). */
function productionInstallee() {
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(join(site, 'index.html'), '<h1>ancien site</h1>');
  ecrire(join(site, '_serveur', 'version.json'), '{"version":"0.1.0"}');
  ecrire(join(site, 'donnees', 'maverick.db'), 'base publiée');
  const complet = fabriquer({ mode: 'prod', tag: 'v0.1', version: '0.1.0', sha: 'local', site, sortie: join(racine, 'sortie-complet') });
  const dossier = join(racine, `prod-${(n += 1)}`);
  mkdirSync(dossier);
  assert.equal(lancer(complet.fichier, dossier, faux(join(racine, `appels-${(n += 1)}`))).code, 0);
  return dossier;
}
/**
 * Des commandes système factices : `id` (root ou non ; maverick-site absent tant que `useradd` ne l'a pas « créé »), `useradd`, `chown`, et `bash` : l'installateur lance `bash activer.sh` ;
 * le faux note ses arguments, dit une dernière ligne (`derniere`, sinon « == PASSEE » ou « == REFUSEE » selon le code) et sort avec le code donné (le vrai activer.sh a ses propres tests : deploy-activer).
 */
function faux(journal, { root = true, activer = 0, derniere } = {}) {
  const bin = join(racine, `bin-${(n += 1)}`);
  mkdirSync(bin);
  const ajouter = (nom, corps) => { writeFileSync(join(bin, nom), `#!/bin/sh\n${corps}\n`); chmodSync(join(bin, nom), 0o755); };
  ajouter('id', `case "$1" in -u) echo ${root ? 0 : 1000} ;; maverick-site) [ -e "${journal}.cree" ] && echo 'uid=998(maverick-site)' || exit 1 ;; *) echo 'uid=0(root)' ;; esac`);
  ajouter('useradd', `echo "useradd $*" >> "${journal}"; : > "${journal}.cree"`);
  ajouter('adduser', `echo "adduser $*" >> "${journal}"; : > "${journal}.cree"`);
  ajouter('chown', `echo "chown $*" >> "${journal}"`);
  // la dernière ligne d'activer.sh : « == PASSEE » (code 0), « == REFUSEE » (1), ou celle qu'on donne (RETOUR AUTOMATIQUE INCOMPLET, IMPOSSIBLE…)
  const dernier = derniere ?? (activer === 0 ? 'activation : == PASSEE : la production est à la V0.2 (faux)' : 'activation : == REFUSEE : refus du faux activer.sh');
  ajouter('bash', `echo "bash $*" >> "${journal}"\necho "activation : (faux activer.sh)"\necho "${dernier}"\nexit ${activer}`);
  return bin;
}
function lancer(fichier, dossier, bin, args = []) {
  const r = spawnSync('sh', [fichier, '--dossier', dossier, ...args], { cwd: racine, encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}` } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}
const appels = (journal) => (existsSync(journal) ? readFileSync(journal, 'utf8').split('\n').filter(Boolean) : []);
/** Ce que la production a sur disque, hors installation.log et tout ce que l'installateur pose à chaque fois (pour dire « rien n'a été modifié »). */
const etat = (dossier) => lister(dossier).filter((f) => f !== 'installation.log');
const verrouRendu = (dossier) => assert.equal(existsSync(join(dossier, '.installation.lock')), false, 'le verrou est rendu');

test('fabriquer --mode prod --kit-seul : une archive sans page ni service, avec le kit, activer.sh et ses outils ; KIT_SEUL=1 ; la ligne de commande aussi', { skip }, () => {
  const i = kitSeul();
  assert.equal(i.KIT_SEUL, '1');
  assert.equal(i.PAGES, '0');
  assert.equal(i.MODE, 'prod');
  assert.equal(i.kit.format, 'maverick-kit/1');
  const script = contenuDe(i.fichier);
  assert.match(script, /^KIT_SEUL=1$/m);
  assert.doesNotMatch(script, /@@|^# >>> /m, 'aucun repère ni marque de section');
  assert.match(script, /activation_par_paquet\(\)/, 'le fragment de l’activation (PR 5a)');
  assert.doesNotMatch(script, /atelier\/servir|poser_le_kit\(\)/, 'rien du kit seul de test');
  const contenu = archiveDe(i.fichier, join(racine, `contenu-${(n += 1)}`));
  const fichiers = lister(contenu);
  assert.ok(fichiers.includes('atelier-kit/kit.json') && fichiers.includes('atelier-kit/atelier-kit.tar.gz'), 'le kit');
  assert.deepEqual(readdirSync(join(contenu, 'site')), [], 'site/ est vide : ni page, ni donnees/, ni _serveur/ (activer.sh fabrique le service avec le kit)');
  assert.ok(!fichiers.some((f) => f.endsWith('index.html')));
  assert.ok(['activer.sh', 'activation-conteneur.sh', 'gel.sh', 'docker-compose.yml', 'nginx.conf', 'mise-a-jour.sh'].every((f) => fichiers.includes(f)));
  assert.ok(!fichiers.some((f) => f.startsWith('atelier-scripts/') || ['bascule.sh', 'repetition-prod.sh', 'repetition-bascule-2.sh'].includes(f)), 'rien de l’atelier du site de dev en production');
  assert.equal(JSON.parse(readFileSync(join(contenu, 'atelier-kit/kit.json'), 'utf8')).version, '0.2.0');
  assert.equal(spawnSync('sh', [i.fichier, '--verifier'], { encoding: 'utf8' }).status, 0, 'l’archive intègre se vérifie');
  // la ligne de commande : --kit-seul avec --kit, en production
  const cli = (...args) => spawnSync('node', [FABRIQUER, '--mode', 'prod', '--tag', 'v0.2', '--version', '0.2.0', '--sha', 'local', '--sortie', join(racine, 'sortie-cli'), ...args], { encoding: 'utf8' });
  const depot = fauxDepot();
  assert.equal(cli('--kit', depot, '--kit-seul').status, 0);
  assert.equal(cli('--kit-seul', '--kit', depot).status, 0);
  assert.equal(cli('--kit-seul').status, 1, 'sans --kit');
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(join(site, 'index.html'), 'x');
  const sans = cli('--site', site, '--kit', depot);
  assert.equal(sans.status, 1);
  assert.match(sans.stderr, /--kit est réservé au mode test/, 'sans --kit-seul, la production n’emporte toujours aucun kit');
});

test('REFUS sans activation-par-paquet : avant toute écriture, le geste exact (le fichier, ou remettre actif à false) ; un lien à sa place aussi ; rien n’est modifié, le verrou est rendu', { skip }, () => {
  const dossier = productionInstallee();
  const journal = join(racine, `appels-${(n += 1)}`);
  const avant = etat(dossier);
  const versionAvant = readFileSync(join(dossier, 'VERSION'), 'utf8');
  const i = kitSeul();
  let r = lancer(i.fichier, dossier, faux(journal));
  assert.equal(r.code, 3, r.out, 'code 3 : le refus que mise-a-jour.sh ne retente pas tant que l’interrupteur manque');
  assert.match(r.out, /installateur « kit seul » de production refusé/);
  assert.match(r.out, new RegExp(`sudo touch ${echappe(dossier)}/activation-par-paquet`), 'le geste qui autorise');
  assert.match(r.out, /remettre « actif » à false dans tools\/flux-git\/bascule-2\.json/, 'le geste qui revient à la livraison complète');
  assert.match(r.out, new RegExp(`sudo touch ${echappe(dossier)}/GELER`), 'et celui qui suspend le minuteur en attendant');
  assert.deepEqual(etat(dossier), avant, 'rien n’a été modifié : ni kit, ni site, ni outils');
  assert.equal(readFileSync(join(dossier, 'VERSION'), 'utf8'), versionAvant);
  assert.equal(readFileSync(join(dossier, 'site/index.html'), 'utf8'), '<h1>ancien site</h1>');
  assert.equal(appels(journal).length, 0, 'ni useradd, ni chown, ni activer.sh');
  verrouRendu(dossier);
  // un lien à la place du fichier n'est pas l'interrupteur
  ecrire(join(racine, 'ailleurs'), '');
  spawnSync('ln', ['-s', join(racine, 'ailleurs'), join(dossier, 'activation-par-paquet')]);
  r = lancer(i.fichier, dossier, faux(journal));
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /activation-par-paquet n'existe pas/);
  assert.deepEqual(etat(dossier), [...avant, 'activation-par-paquet'].sort());
});

test('REFUS hors root, ou sur une instance qui n’est pas une production installée : avant toute écriture, avec le geste', { skip }, () => {
  const dossier = productionInstallee();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const avant = etat(dossier);
  const journal = join(racine, `appels-${(n += 1)}`);
  const i = kitSeul();
  let r = lancer(i.fichier, dossier, faux(journal, { root: false }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /refusé : il s'installe en root .*sudo sh .* --dossier /);
  assert.deepEqual(etat(dossier), avant);
  // un dossier vide (rien d'installé) : activer.sh n'aurait aucun site à remplacer
  const vide = join(racine, `vide-${(n += 1)}`);
  mkdirSync(vide);
  writeFileSync(join(vide, 'activation-par-paquet'), '');
  r = lancer(i.fichier, vide, faux(journal));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /n'est pas une production installée .*Installez d'abord l'installateur complet de production/);
  assert.deepEqual(etat(vide).filter((f) => f !== 'activation-par-paquet'), [], 'rien n’a été posé dans un dossier vide');
  // une instance de test n'est pas une production : le refus d'avant (mode) reste le premier
  const test = join(racine, `test-${(n += 1)}`);
  ecrire(join(test, 'VERSION'), 'tag=v0.1.0\nversion=0.1.0\nmode=test\n');
  writeFileSync(join(test, 'activation-par-paquet'), '');
  r = lancer(i.fichier, test, faux(journal));
  assert.equal(r.code, 1);
  assert.match(r.out, /est une instance « test » : un installateur « prod » refuse de l'écraser/);
  assert.equal(appels(journal).length, 0);
});

test('avec activation-par-paquet et root : seul le kit est posé (activation/kit/, à root), site/ et site/_serveur/ ne sont pas touchés, VERSION suit, puis activer.sh est lancé sans option', { skip }, () => {
  const dossier = productionInstallee();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const siteAvant = lister(join(dossier, 'site')).map((f) => [f, readFileSync(join(dossier, 'site', f), 'utf8')]);
  const journal = join(racine, `appels-${(n += 1)}`);
  const i = kitSeul({ tag: 'v0.2', version: '0.2.0' });
  const r = lancer(i.fichier, dossier, faux(journal));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Installateur « kit seul » de production : le kit seulement/);
  assert.match(r.out, /Kit de l'activation posé dans .*activation\/kit/);
  assert.match(r.out, /le kit est posé, activer\.sh est lancé\./);
  // ni pages ni service touchés
  assert.deepEqual(lister(join(dossier, 'site')).map((f) => [f, readFileSync(join(dossier, 'site', f), 'utf8')]), siteAvant, 'site/ et site/_serveur/ sont intacts, octet pour octet');
  // le kit, tel que activer.sh le lit
  const kit = join(dossier, 'activation', 'kit');
  assert.equal(JSON.parse(readFileSync(join(kit, 'kit.json'), 'utf8')).version, '0.2.0');
  for (const f of ['client/package.json', 'client/scripts/poser-un-site.mjs', 'client/scripts/fabriquer-depuis-contenu.mjs', 'data/schema.sql']) assert.ok(existsSync(join(kit, f)), f);
  assert.deepEqual(readdirSync(join(dossier, 'activation')).sort(), ['kit'], 'ni provisoire ni ancien kit');
  assert.equal(existsSync(join(dossier, 'atelier')), false, 'rien de l’atelier : le kit est celui de l’activation');
  // la marque de l'installation et les outils de l'activation
  assert.match(readFileSync(join(dossier, 'VERSION'), 'utf8'), /^tag=v0\.2$/m);
  assert.match(readFileSync(join(dossier, 'VERSION'), 'utf8'), /^mode=prod$/m);
  for (const f of ['activer.sh', 'activation-conteneur.sh', 'gel.sh']) assert.ok(existsSync(join(dossier, f)), f);
  // maverick-site et activer.sh : l'activation de la PR 5a, inchangée
  const lignes = appels(journal);
  assert.ok(lignes.some((a) => a.startsWith('useradd ') && a.endsWith('maverick-site')));
  assert.deepEqual(lignes.filter((a) => a.startsWith('bash ')), [`bash ${dossier}/activer.sh --prod ${dossier}`], 'activer.sh, sans --correctif : un paquet neuf');
  assert.doesNotMatch(r.out, /ATTENTION/);
  assert.match(r.out, /Activation par paquet : passée\./);
  verrouRendu(dossier);
});

test('un correctif urgent (VX.Y-hotfix.N) ou une régénération (-rebuild.N) lance activer.sh --correctif : la même version n’est pas un refus ; la reprise le dit', { skip }, () => {
  for (const [tag, motif] of [['v0.2-hotfix.1', 'hotfix'], ['v0.2-rebuild.1', 'rebuild']]) {
    const dossier = productionInstallee();
    writeFileSync(join(dossier, 'activation-par-paquet'), '');
    const journal = join(racine, `appels-${(n += 1)}`);
    const r = lancer(kitSeul({ tag }).fichier, dossier, faux(journal, { activer: 1 }));
    assert.equal(r.code, 4, `${motif} : ${r.out}`);
    assert.deepEqual(appels(journal).filter((a) => a.startsWith('bash ')), [`bash ${dossier}/activer.sh --prod ${dossier} --correctif`], motif);
    assert.match(r.out, /activer\.sh est lancé \(--correctif\)/);
    assert.match(r.out, new RegExp(`Pour rejouer : sudo bash ${echappe(dossier)}/activer\\.sh --reprendre --correctif`), motif);
    assert.match(r.out, new RegExp(`ERREUR : ${echappe(tag)} est installé .*Geste : sudo bash ${echappe(dossier)}/activer\\.sh --reprendre --correctif `), `${motif} : le geste de la ligne ERREUR garde --correctif`);
  }
});

test('GitHub a livré, la production a refusé : le kit est posé mais VERSION garde l’étiquette d’AVANT (la production n’est pas « à jour »), la marque est posée, une seule ligne ERREUR dit le geste, code 4', { skip }, () => {
  const dossier = productionInstallee();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const journal = join(racine, `appels-${(n += 1)}`);
  const versionAvant = readFileSync(join(dossier, 'VERSION'), 'utf8');
  const r = lancer(kitSeul().fichier, dossier, faux(journal, { activer: 1 }));
  assert.equal(r.code, 4, r.out);
  assert.match(r.out, /ATTENTION activation par paquet : code 1 .*la production garde son site et sa base/);
  assert.match(r.out, new RegExp(`Pour rejouer : sudo bash ${echappe(dossier)}/activer\\.sh --reprendre$`, 'm'), 'la reprise exacte, sans option pour un paquet neuf');
  assert.doesNotMatch(r.out, /--reprendre --correctif/);
  const journalInstallation = readFileSync(join(dossier, 'installation.log'), 'utf8');
  assert.match(journalInstallation, /\(faux activer\.sh\)/, 'la sortie d’activer.sh est dans le journal de l’installation');
  // VERSION : l'étiquette d'avant ; la nouvelle attend dans activation/version-en-attente
  assert.equal(readFileSync(join(dossier, 'VERSION'), 'utf8'), versionAvant, 'VERSION n’a pas bougé : la production se dit toujours à l’ancienne étiquette');
  assert.match(readFileSync(join(dossier, 'activation/version-en-attente'), 'utf8'), /^tag=v0\.2$/m);
  assert.match(readFileSync(join(dossier, 'activation/version-en-attente'), 'utf8'), /^mode=prod$/m);
  // la marque, avec la dernière ligne d'activer.sh ; une seule ligne ERREUR, qui dit le geste
  assert.equal(readFileSync(join(dossier, '.activation-refusee-v0.2'), 'utf8'), 'activation : == REFUSEE : refus du faux activer.sh\n');
  const erreurs = r.out.split('\n').filter((l) => l.includes('ERREUR'));
  assert.equal(erreurs.length, 1, r.out);
  assert.match(erreurs[0], new RegExp(`ERREUR : v0\\.2 est installé \\(kit posé\\) mais son activation n'a pas passé \\(activation : == REFUSEE .*sa VERSION d'avant \\(v0\\.1\\).*sudo sh ${echappe(dossier)}/mise-a-jour\\.sh --force.*Geste : sudo bash ${echappe(dossier)}/activer\\.sh --reprendre \\(s'il passe, activer\\.sh écrit VERSION`));
  assert.equal(journalInstallation.split('\n').filter((l) => l.includes('ERREUR')).length, 1, 'une seule ligne ERREUR dans installation.log aussi');
  assert.doesNotMatch(r.out, /Installé : v0\.2/, 'pas de « Installé » : la production n’est pas passée à la V0.2');
  assert.ok(existsSync(join(dossier, 'activation/kit/kit.json')), 'le kit reste posé : --reprendre le relit');
  assert.equal(readFileSync(join(dossier, 'site/index.html'), 'utf8'), '<h1>ancien site</h1>', 'la production garde son site');
  verrouRendu(dossier);
});

test('RETOUR AUTOMATIQUE INCOMPLET, IMPOSSIBLE ou activer.sh sorti en 0 sans « == PASSEE » : même traitement (VERSION d’avant, marque, code 4) ; seul « == PASSEE » avec le code 0 passe', { skip }, () => {
  for (const [activer, derniere] of [
    [1, 'activation : == RETOUR AUTOMATIQUE INCOMPLET : le service ne répond pas. Voir les ATTENTION ci-dessus.'],
    [1, 'activation : == RETOUR AUTOMATIQUE : le contrôle de santé a échoué.'],
    [2, 'activation : == IMPOSSIBLE : le kit est incomplet.'],
    [0, 'activation : (rien qui dise PASSEE)'],
    [1, 'activation : == PASSEE : (mais un code de sortie en échec)'],
  ]) {
    const dossier = productionInstallee();
    writeFileSync(join(dossier, 'activation-par-paquet'), '');
    const versionAvant = readFileSync(join(dossier, 'VERSION'), 'utf8');
    const r = lancer(kitSeul().fichier, dossier, faux(join(racine, `appels-${(n += 1)}`), { activer, derniere }));
    assert.equal(r.code, 4, `${derniere} : ${r.out}`);
    assert.equal(readFileSync(join(dossier, 'VERSION'), 'utf8'), versionAvant, derniere);
    assert.equal(readFileSync(join(dossier, '.activation-refusee-v0.2'), 'utf8'), `${derniere.includes('==') ? derniere : `activation : activer.sh est sorti en code ${activer} sans ligne « == »`}\n`, derniere);
    assert.equal(r.out.split('\n').filter((l) => l.includes('ERREUR')).length, 1, derniere);
  }
});

test('une activation PASSÉE écrit VERSION (la nouvelle étiquette), efface la marque d’un refus d’avant et la mise en attente ; la livraison suivante, refusée, ne laisse que SA marque', { skip }, () => {
  const dossier = productionInstallee();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const journal = join(racine, `appels-${(n += 1)}`);
  assert.equal(lancer(kitSeul({ tag: 'v0.2', version: '0.2.0' }).fichier, dossier, faux(journal, { activer: 1 })).code, 4);
  assert.ok(existsSync(join(dossier, '.activation-refusee-v0.2')));
  // la même étiquette rejouée (mise-a-jour.sh --force) et passée
  const r = lancer(kitSeul({ tag: 'v0.2', version: '0.2.0' }).fichier, dossier, faux(journal));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Installé : v0\.2/);
  assert.match(readFileSync(join(dossier, 'VERSION'), 'utf8'), /^tag=v0\.2$/m);
  assert.match(readFileSync(join(dossier, 'VERSION'), 'utf8'), /^version=0\.2\.0$/m);
  assert.equal(readdirSync(dossier).filter((f) => f.startsWith('.activation-refusee-')).length, 0, 'les marques sont effacées');
  assert.deepEqual(readdirSync(join(dossier, 'activation')).sort(), ['kit'], 'plus de mise en attente');
  assert.equal(r.out.split('\n').filter((l) => l.includes('ERREUR')).length, 0);
  // la livraison suivante : refusée, VERSION reste à v0.2, seule la marque de v0.3 existe
  const refuse = lancer(kitSeul({ tag: 'v0.3', version: '0.3.0' }).fichier, dossier, faux(journal, { activer: 1 }));
  assert.equal(refuse.code, 4, refuse.out);
  assert.match(readFileSync(join(dossier, 'VERSION'), 'utf8'), /^tag=v0\.2$/m);
  assert.deepEqual(readdirSync(dossier).filter((f) => f.startsWith('.activation-refusee-')), ['.activation-refusee-v0.3']);
});

test('une seconde livraison remplace le kit par renommage : un seul kit gardé, les restes d’une installation interrompue sont jetés ou remis', { skip }, () => {
  const dossier = productionInstallee();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const journal = join(racine, `appels-${(n += 1)}`);
  assert.equal(lancer(kitSeul({ tag: 'v0.2', version: '0.2.0' }).fichier, dossier, faux(journal)).code, 0);
  ecrire(join(dossier, 'activation/kit/ancien-fichier.txt'), 'du kit précédent');
  ecrire(join(dossier, 'activation/.kit-provisoire.999/reste.txt'), 'un provisoire');
  ecrire(join(dossier, 'activation/.kit-ancien.999/reste.txt'), 'un ancien périmé (kit/ est là)');
  const r = lancer(kitSeul({ tag: 'v0.3', version: '0.3.0' }).fichier, dossier, faux(journal));
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(readFileSync(join(dossier, 'activation/kit/kit.json'), 'utf8')).version, '0.3.0');
  assert.equal(existsSync(join(dossier, 'activation/kit/ancien-fichier.txt')), false, 'un seul kit : le précédent est remplacé');
  assert.deepEqual(readdirSync(join(dossier, 'activation')).sort(), ['kit']);
  // interruption entre les deux renommages : l'ancien, seul resté, est remis en place avant la nouvelle pose, puis remplacé comme un kit ordinaire
  spawnSync('mv', [join(dossier, 'activation/kit'), join(dossier, 'activation/.kit-ancien.7')]);
  const r2 = lancer(kitSeul({ tag: 'v0.4', version: '0.4.0' }).fichier, dossier, faux(journal));
  assert.equal(r2.code, 0, r2.out);
  assert.match(r2.out, /un kit resté de côté par une installation interrompue est remis en place/);
  assert.equal(JSON.parse(readFileSync(join(dossier, 'activation/kit/kit.json'), 'utf8')).version, '0.4.0');
  assert.deepEqual(readdirSync(join(dossier, 'activation')).sort(), ['kit']);
});

test('un installateur de production COMPLET (sans --kit-seul) reste celui d’avant, même avec l’interrupteur : aucune trace du kit seul, le site est remplacé ; sans kit, activer.sh n’est pas lancé et le dit avec le geste', { skip }, () => {
  const dossier = productionInstallee();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const avant = etat(dossier);
  // une archive de production complète n'a pas KIT_SEUL : les sections ne servent pas, l'installation est celle d'avant (le site est remplacé)
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(join(site, 'index.html'), '<h1>site complet</h1>');
  ecrire(join(site, '_serveur', 'version.json'), '{"version":"0.2.0"}');
  const complet = fabriquer({ mode: 'prod', tag: 'v0.2', version: '0.2.0', sha: 'local', site, sortie: join(racine, 'sortie-complet') });
  assert.doesNotMatch(contenuDe(complet.fichier), /KIT_SEUL|refusé : il s'installe en root/, 'aucune trace du kit seul dans l’installateur de production ordinaire');
  const journal = join(racine, `appels-${(n += 1)}`);
  const r = lancer(complet.fichier, dossier, faux(journal));
  assert.equal(r.code, 0, r.out);
  assert.equal(readFileSync(join(dossier, 'site/index.html'), 'utf8'), '<h1>site complet</h1>', 'le site est remplacé en entier comme avant');
  assert.ok(!existsSync(join(dossier, 'activation/kit')), 'pas de kit');
  assert.match(readFileSync(join(dossier, 'VERSION'), 'utf8'), /^tag=v0\.2$/m, 'un installateur complet écrit VERSION comme avant');
  assert.ok(!existsSync(join(dossier, 'activation/version-en-attente')) && !existsSync(join(dossier, '.activation-refusee-v0.2')), 'ni mise en attente ni marque');
  assert.match(r.out, /pas de kit dans .*activation\/kit : activer\.sh n'est pas lancé/, 'avec l’interrupteur mais sans kit : activer.sh n’est pas lancé, et le dit avec le geste');
  assert.deepEqual(appels(journal).filter((a) => a.startsWith('bash ')), []);
  assert.notDeepEqual(etat(dossier), avant);
});

test('un kit PÉRIMÉ (celui d’une livraison précédente) n’est jamais lancé : ATTENTION et les deux gestes ; le kit de cette livraison l’est', { skip }, () => {
  const dossier = productionInstallee();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const journal = join(racine, `appels-${(n += 1)}`);
  // un kit seul v0.2 pose son kit ; un installateur complet v0.3 (retour arrière : actif remis à false, l'interrupteur resté) le trouve, d'une autre version
  assert.equal(lancer(kitSeul({ tag: 'v0.2', version: '0.2.0' }).fichier, dossier, faux(journal)).code, 0);
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(join(site, 'index.html'), '<h1>site complet 0.3</h1>');
  ecrire(join(site, '_serveur', 'version.json'), '{"version":"0.3.0"}');
  const complet = fabriquer({ mode: 'prod', tag: 'v0.3', version: '0.3.0', sha: 'local', site, sortie: join(racine, 'sortie-complet') });
  const journal2 = join(racine, `appels-${(n += 1)}`);
  const r = lancer(complet.fichier, dossier, faux(journal2));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ATTENTION kit périmé : .*activation\/kit est celui de la V0\.2\.0, cette installation est la V0\.3\.0 : activer\.sh n'est pas lancé/);
  assert.match(r.out, new RegExp(`sudo rm -rf ${echappe(dossier)}/activation/kit .*sudo rm ${echappe(dossier)}/activation-par-paquet`));
  assert.deepEqual(appels(journal2).filter((a) => a.startsWith('bash ')), [], 'activer.sh n’est pas lancé avec un kit d’une autre version');
  assert.ok(existsSync(join(dossier, 'activation/kit/kit.json')), 'le kit n’est pas effacé : le geste est au propriétaire');
});

test('installation.log est borné : au-delà de 200 Ko, les 500 dernières lignes ; un refus répété du minuteur ne le fait pas grossir sans fin', { skip }, () => {
  const dossier = productionInstallee();
  const journal = join(racine, `appels-${(n += 1)}`);
  writeFileSync(join(dossier, 'installation.log'), `${'ligne ancienne d’un refus répété\n'.repeat(12000)}`);
  const avant = readFileSync(join(dossier, 'installation.log'), 'utf8');
  assert.ok(avant.length > 200000);
  const r = lancer(kitSeul().fichier, dossier, faux(journal)); // refusé (pas d'interrupteur) : il écrit quand même son journal
  assert.equal(r.code, 3, r.out);
  const apres = readFileSync(join(dossier, 'installation.log'), 'utf8');
  assert.ok(apres.length < 100000, `borné (${apres.length} octets)`);
  assert.ok(apres.split('\n').length <= 520);
  assert.match(apres, /refusé/, 'la ligne du refus est gardée');
  assert.equal(existsSync(join(dossier, 'installation.log.tmp')), false);
});
