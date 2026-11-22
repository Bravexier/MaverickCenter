// Installateurs autonomes de la 1.0 (deploy/installateur/fabriquer.mjs + installateur.sh) : fabriqués à partir d'un faux site, puis
// exécutés avec sh dans des dossiers temporaires. Production : site remplacé, base et réglages conservés. Test : base = copie de
// celle de la production à l'instant de l'installation. Nécessite sh, tar et gzip ; sinon les tests sont ignorés.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { SEUL_LINUX } from './aide-plateforme.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip')) && 'tar ou gzip indisponible';
const racine = dossierTemporaire('installateur');

let n = 0;
/** Un faux site de `pages` pages (plus l'accueil), marqué `label`. */
function site(label, pages = 5, extra = {}) {
  const d = join(racine, `site-${(n += 1)}`);
  const files = { 'index.html': `<h1>accueil ${label}</h1>`, ...extra };
  for (let i = 0; i < pages; i += 1) files[`wiki/p${i}/index.html`] = `<p>page ${i} ${label}</p>`;
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(d, p)), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}
/** Étiquette par défaut : la forme des livraisons (tools/flux-git/regles.mjs), vX.Y en production, la version complète vX.Y.Z en test. */
function installateur({ mode = 'prod', label = 'v1', tag, version = '0.2.0', pages, extra } = {}) {
  return fabriquer({ mode, site: site(label, pages, extra), tag: tag ?? (mode === 'prod' ? `v${version.replace(/\.\d+$/, '')}` : `v${version}`), version, sha: 'a'.repeat(40), sortie: join(racine, 'sortie') });
}
function lancer(fichier, args = [], env = {}) {
  const r = spawnSync('sh', [fichier, ...args], { cwd: racine, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
}
const dossier = (nom) => join(racine, nom);
const lire = (...p) => readFileSync(join(...p), 'utf8');
const champs = (d) => Object.fromEntries(lire(d, 'VERSION').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)));

test('fabrication : un seul fichier, paramètres remplis, archive contrôlée par --verifier', { skip }, () => {
  const i = installateur({ pages: 7 });
  assert.match(i.fichier, /maverick-center-v0\.2-install\.sh$/);
  assert.equal(i.PAGES, '8');
  const texte = readFileSync(i.fichier, 'latin1');
  const script = texte.slice(0, texte.indexOf('\n__ARCHIVE__\n')); // l'archive compressée peut contenir n'importe quels octets
  assert.ok(!script.includes('@@'), 'aucun paramètre non rempli');
  assert.match(texte, /^TAG='v0\.2'$/m);
  const v = lancer(i.fichier, ['--verifier']);
  assert.equal(v.code, 0, v.out);
  assert.match(v.out, /archive intègre, 8 pages/);

  // Un octet modifié dans l'archive : refus, rien d'installé.
  const octets = readFileSync(i.fichier);
  octets[octets.length - 100] ^= 0xff;
  const abime = join(racine, 'abime.sh');
  writeFileSync(abime, octets);
  const r = lancer(abime, ['--dossier', dossier('jamais')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /archive (corrompue|illisible)/);
  assert.ok(!existsSync(join(dossier('jamais'), 'site')));
});

test('paramètres refusés : étiquette de test en production et inversement, version invalide', { skip: SEUL_LINUX }, () => {
  const s = site('x');
  const base = { site: s, version: '0.2.0', sha: 'b'.repeat(40), sortie: join(racine, 'sortie') };
  assert.throws(() => fabriquer({ ...base, mode: 'prod', tag: 'v0.2.0' }), /étiquette de production/);
  assert.throws(() => fabriquer({ ...base, mode: 'test', tag: 'v0.2.0', sha: '$(id)' }), /--sha invalide/);
  const cli = (args) => spawnSync('node', [new URL('../../deploy/installateur/fabriquer.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8' });
  const ok = ['--mode', 'test', '--site', s, '--tag', 'v0.2.0', '--version', '0.2.0', '--sha', 'local', '--sortie', join(racine, 'sortie')];
  const avecTag = (tag) => ok.map((a) => (a === 'v0.2.0' ? tag : a));
  assert.equal(cli(ok).status, 0);
  assert.match(cli(['--mode', 'prod', ...ok.slice(2)]).stderr, /étiquette de production/);
  assert.match(cli(avecTag('v0.2')).stderr, /étiquette de test/);
  assert.match(cli(avecTag('v0.2-hotfix.1')).stderr, /étiquette de test/);
  assert.match(cli(ok.map((a) => (a === '0.2.0' ? '0.2' : a))).stderr, /--version invalide/);
  assert.match(cli(avecTag('v0.2.0;rm')).stderr, /--tag invalide/);
  // Étiquettes du bot (tools/flux-git/regles.mjs) : production VX.Y (l'étiquette de version de master), test VX.Y.Z (celle de dev).
  assert.equal(cli(['--mode', 'prod', ...avecTag('V0.2').slice(2)]).status, 0);
  assert.equal(cli(['--mode', 'prod', ...avecTag('V0.2-hotfix.1').slice(2)]).status, 0);
  assert.equal(cli(avecTag('V0.2.3')).status, 0);
  assert.equal(cli(avecTag('V0.2.3-rebuild.1')).status, 0);
  assert.equal(cli(avecTag('v0.0.0-test')).status, 0, 'étiquette factice de la CI (ci.yml) : version complète, donc de test');
  assert.match(cli(avecTag('V0.2;rm')).stderr, /--tag invalide/);
});

for (const rsync of ['auto', '0']) {
  test(`production : première installation puis mise à jour (USE_RSYNC=${rsync})`, { skip }, () => {
    const prod = dossier(`prod-${rsync}`);
    const r1 = lancer(installateur({ label: 'v1' }).fichier, ['--dossier', prod], { USE_RSYNC: rsync });
    assert.equal(r1.code, 0, r1.out);
    assert.equal(lire(prod, 'site/index.html'), '<h1>accueil v1</h1>');
    assert.deepEqual({ tag: champs(prod).tag, mode: champs(prod).mode, version: champs(prod).version }, { tag: 'v0.2', mode: 'prod', version: '0.2.0' });
    assert.match(lire(prod, '.env'), /MAVERICK_PORT=8080/);
    assert.match(lire(prod, '.env'), /MAVERICK_CONTENEUR=maverick-center$/m);
    assert.doesNotMatch(lire(prod, '.env'), /MAVERICK_EDITION/, 'jamais d’édition sur le serveur normal');
    assert.ok(existsSync(join(prod, 'db')), 'dossier de la base vivante créé');
    assert.ok(existsSync(join(prod, 'docker-compose.yml')) && existsSync(join(prod, 'nginx.conf')) && existsSync(join(prod, 'mise-a-jour.sh')) && !existsSync(join(prod, 'update-site.sh')));
    assert.match(r1.out, /Première installation/);

    // Ce que l'administrateur et l'usage réel ont posé : jamais touché par une mise à jour.
    writeFileSync(join(prod, 'db', 'vivante.db'), 'données réelles');
    writeFileSync(join(prod, '.htpasswd'), 'invite:xyz\n');
    writeFileSync(join(prod, '.env'), 'MAVERICK_PORT=9000\n');
    writeFileSync(join(prod, 'docker-compose.yml'), 'services: {} # personnalisé\n');

    const r2 = lancer(installateur({ label: 'v2', tag: 'v0.2-hotfix.1', pages: 3, extra: { 'nouvelle/index.html': 'n' } }).fichier, ['--dossier', prod], { USE_RSYNC: rsync });
    assert.equal(r2.code, 0, r2.out);
    assert.equal(lire(prod, 'site/index.html'), '<h1>accueil v2</h1>');
    assert.ok(existsSync(join(prod, 'site/nouvelle/index.html')));
    assert.ok(!existsSync(join(prod, 'site/wiki/p4/index.html')), 'une page retirée disparaît');
    assert.equal(champs(prod).tag, 'v0.2-hotfix.1');
    assert.equal(lire(prod, 'db', 'vivante.db'), 'données réelles');
    assert.equal(lire(prod, '.htpasswd'), 'invite:xyz\n');
    assert.equal(lire(prod, '.env'), 'MAVERICK_PORT=9000\n');
    assert.equal(lire(prod, 'docker-compose.yml'), 'services: {} # personnalisé\n');
    assert.match(lire(prod, 'docker-compose.yml.nouveau'), /MAVERICK_PORT/);
    assert.match(r2.out, /docker-compose\.yml a été modifié sur place/);
    assert.doesNotMatch(r2.out, /Première installation/);
    assert.match(lire(prod, 'installation.log'), /Installé : v0\.2-hotfix\.1/);
    assert.ok(!readdirSync(prod).some((f) => f.startsWith('.installation')), 'ni dossier de travail ni verrou restants');
  });
}

/** Tout ce que contient un dossier, avec le contenu des fichiers : de quoi vérifier que rien n'a bougé. */
function empreinte(d) {
  const sortie = {};
  const parcourir = (rel) => {
    for (const e of readdirSync(join(d, rel), { withFileTypes: true })) {
      const r = join(rel, e.name);
      if (e.isDirectory()) { sortie[`${r}/`] = ''; parcourir(r); } else sortie[r] = readFileSync(join(d, r), 'utf8');
    }
  };
  parcourir('');
  return sortie;
}
/** Un serveur de production avec une vraie base SQLite (table fiche) et une pièce jointe, puis le dossier d'un serveur de test. */
function productionEtTest(nom) {
  const parent = dossier(nom);
  const prod = join(parent, 'maverick-center');
  assert.equal(lancer(installateur({ label: 'prod' }).fichier, ['--dossier', prod]).code, 0);
  const base = new DatabaseSync(join(prod, 'db', 'maverick.db'));
  base.exec("CREATE TABLE fiche (nom TEXT); INSERT INTO fiche VALUES ('Aldric'), ('Brune');");
  base.close();
  mkdirSync(join(prod, 'db', 'pieces'));
  writeFileSync(join(prod, 'db', 'pieces', 'carte.txt'), 'carte');
  return { parent, prod, test_: join(parent, 'maverick-center-test') };
}
/** Ce que le site de dev a saisi : un db/ rempli de fichiers introuvables ailleurs. */
function remplirLaBaseDeDev(test_) {
  mkdirSync(join(test_, 'db', 'archives'), { recursive: true });
  const base = new DatabaseSync(join(test_, 'db', 'vivante.db'));
  base.exec("CREATE TABLE fiche (nom TEXT); INSERT INTO fiche VALUES ('Saisie du site de dev');");
  base.close();
  writeFileSync(join(test_, 'db', 'archives', 'vivante-ancienne.db'), 'archive');
  writeFileSync(join(test_, 'db', '.cache-cache'), 'fichier caché');
}
const noms = (d, fichier = 'maverick.db') => {
  const b = new DatabaseSync(join(d, 'db', fichier));
  try { return b.prepare('SELECT nom FROM fiche ORDER BY nom').all().map((l) => l.nom); } finally { b.close(); }
};

test('test : par défaut, aucune copie de la production ; db/ (rempli ou non, avec ou sans MAVERICK_BASE_TEST=conservee) n\'est jamais touché (R274)', { skip }, () => {
  const { prod, test_ } = productionEtTest('nas-defaut');
  const i = installateur({ mode: 'test', label: 'dev', version: '0.2.3' }).fichier;
  const avantProd = empreinte(join(prod, 'db'));

  // Première installation : db/ n'existe pas, il est créé vide ; le service y crée sa base. Aucune copie, même avec la production voisine.
  const r = lancer(i, ['--dossier', test_]);
  assert.equal(r.code, 0, r.out);
  assert.equal(lire(test_, 'site/index.html'), '<h1>accueil dev</h1>');
  assert.equal(champs(test_).mode, 'test');
  assert.match(lire(test_, '.env'), /MAVERICK_PORT=8081/);
  assert.match(lire(test_, '.env'), /^MAVERICK_EDITION=1$/m, 'édition des règles ouverte sur le serveur de test');
  assert.deepEqual(readdirSync(join(test_, 'db')), [], 'db/ créé, vide : rien n\'est copié');
  assert.doesNotMatch(r.out, /copie de /);

  // Le site de dev saisit des choses ; les installations suivantes, avec ou sans le réglage historique, n'y touchent pas.
  remplirLaBaseDeDev(test_);
  const dossierDb = statSync(join(test_, 'db')).ino;
  const avant = empreinte(join(test_, 'db'));
  const env = lire(test_, '.env');
  for (const [n, conservee] of [[4, false], [5, true], [6, false]]) {
    if (conservee) writeFileSync(join(test_, '.env'), `${env}MAVERICK_BASE_TEST=conservee\n`);
    else writeFileSync(join(test_, '.env'), env);
    const suite = lancer(installateur({ mode: 'test', label: `dev${n}`, version: `0.2.${n}` }).fichier, ['--dossier', test_]);
    assert.equal(suite.code, 0, suite.out);
    assert.equal(lire(test_, 'site/index.html'), `<h1>accueil dev${n}</h1>`, 'le site, lui, est mis à jour');
    assert.deepEqual(empreinte(join(test_, 'db')), avant, `db/ intact (conservee : ${conservee})`);
    assert.equal(statSync(join(test_, 'db')).ino, dossierDb, 'db/ gardé : il est monté dans le conteneur');
    assert.ok(!readdirSync(test_).some((f) => f.startsWith('.db.')), 'aucun dossier provisoire restant');
  }
  assert.deepEqual(noms(test_, 'vivante.db'), ['Saisie du site de dev']);

  // Les options que mise-a-jour.sh passait (--dossier-prod, --sans-base-prod) sont acceptées et ne déclenchent aucune copie.
  for (const options of [['--dossier-prod', prod], ['--sans-base-prod'], ['--dossier-prod', prod, '--sans-base-prod']]) {
    const r2 = lancer(installateur({ mode: 'test', label: 'dev-options', version: '0.2.9' }).fichier, ['--dossier', test_, ...options]);
    assert.equal(r2.code, 0, r2.out);
    assert.deepEqual(empreinte(join(test_, 'db')), avant);
  }
  assert.deepEqual(empreinte(join(prod, 'db')), avantProd, 'la production n\'est ni lue ni modifiée par défaut');
  assert.ok(!existsSync(join(test_, 'db', '.copie-de-la-production')));
});

test('test : aucun « rm » de l\'installateur ne vise db/ (garde sur le script)', () => {
  const script = readFileSync(new URL('../../deploy/installateur/installateur.sh', import.meta.url), 'utf8');
  const lignes = script.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(lignes.filter((l) => /\b(rm|rmdir|unlink)\b|-delete/.test(l) && /(\/db\b|\$\{?DB)/.test(l)), []);
  assert.ok(!lignes.some((l) => /find\s+"\$DOSSIER\/db\/?"[^|]*(-exec\s+rm|-delete)/.test(l)));
});

test('test : --copier-base-prod copie la production à l\'instant de l\'installation, dans un db/ vide seulement', { skip: SEUL_LINUX || skip }, () => {
  const { prod, test_ } = productionEtTest('nas-copie');
  const i = installateur({ mode: 'test', label: 'dev', version: '0.2.3' }).fichier;
  const r = lancer(i, ['--dossier', test_, '--copier-base-prod']); // dossier de la production : le voisin « maverick-center »
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(noms(test_), ['Aldric', 'Brune']);
  assert.equal(lire(test_, 'db', 'pieces', 'carte.txt'), 'carte');
  const trace = lire(test_, 'db', '.copie-de-la-production');
  assert.match(trace, new RegExp(`source=${join(prod, 'db').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(trace, /^version_prod=v0\.2$/m);
  assert.ok(!readdirSync(test_).some((f) => f.startsWith('.db.')), 'aucun dossier provisoire restant');

  // Ce qu'on fait en test ne revient jamais en production.
  const copie = new DatabaseSync(join(test_, 'db', 'maverick.db'));
  copie.exec("INSERT INTO fiche VALUES ('Essai')");
  copie.close();
  assert.deepEqual(noms(prod), ['Aldric', 'Brune']);

  // Deuxième demande de copie, db/ rempli : refus avant toute écriture, base de test et site intacts.
  const apres = empreinte(test_);
  const r2 = lancer(installateur({ mode: 'test', label: 'dev2', version: '0.2.4' }).fichier, ['--dossier', test_, '--copier-base-prod', '--dossier-prod', prod]);
  assert.equal(r2.code, 1);
  assert.match(r2.out, /copie de la production refusée : .* n'est pas vide/);
  const sansLog = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'installation.log'));
  assert.deepEqual(sansLog(empreinte(test_)), sansLog(apres), 'rien n\'a été modifié (site, VERSION, db/ : tout est identique)');
  assert.deepEqual(noms(test_), ['Aldric', 'Brune', 'Essai']);
});

test('test : --copier-base-prod refusée sur un db/ rempli, même s\'il n\'y a pas encore de site ; db/ avec ses seules métriques : copie faite', { skip }, () => {
  const { test_ } = productionEtTest('nas-copie-refus');
  const i = installateur({ mode: 'test', label: 'dev', version: '0.2.3' }).fichier;
  remplirLaBaseDeDev(test_);
  const avant = empreinte(test_);
  const r = lancer(i, ['--dossier', test_, '--copier-base-prod']);
  assert.equal(r.code, 1);
  assert.match(r.out, /copie de la production refusée/);
  const sansLog = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'installation.log'));
  assert.deepEqual(sansLog(empreinte(test_)), sansLog(avant), 'ni site, ni VERSION, ni .env, ni verrou : rien d\'écrit');
  assert.deepEqual(noms(test_, 'vivante.db'), ['Saisie du site de dev']);

  // Un fichier caché suffit à remplir db/ ; seules les métriques ne comptent pas.
  rmSync(join(test_, 'db'), { recursive: true });
  mkdirSync(join(test_, 'db', 'metriques'), { recursive: true });
  writeFileSync(join(test_, 'db', 'metriques', 'dev.db'), 'mesures du site de dev');
  writeFileSync(join(test_, 'db', '.x'), 'x');
  assert.equal(lancer(i, ['--dossier', test_, '--copier-base-prod']).code, 1);
  rmSync(join(test_, 'db', '.x'));
  const metriques = statSync(join(test_, 'db', 'metriques')).ino;
  const ok = lancer(i, ['--dossier', test_, '--copier-base-prod']);
  assert.equal(ok.code, 0, ok.out);
  assert.deepEqual(noms(test_), ['Aldric', 'Brune']);
  assert.equal(lire(test_, 'db', 'metriques', 'dev.db'), 'mesures du site de dev');
  assert.equal(statSync(join(test_, 'db', 'metriques')).ino, metriques);

  // Incompatibilités : production (jamais de copie), --sans-base-prod, production introuvable ou qui n'en est pas une.
  assert.equal(lancer(installateur({ label: 'p' }).fichier, ['--dossier', join(dossier('nas-copie-refus'), 'autre-prod'), '--copier-base-prod']).code, 1);
  let r2 = lancer(i, ['--dossier', join(dossier('nas-copie-refus'), 'sans'), '--copier-base-prod', '--sans-base-prod']);
  assert.equal(r2.code, 1);
  assert.match(r2.out, /s'excluent/);
  r2 = lancer(i, ['--dossier', join(dossier('nas-copie-refus'), 'sans'), '--copier-base-prod', '--dossier-prod', join(dossier('nas-copie-refus'), 'absente')]);
  assert.equal(r2.code, 1);
  assert.match(r2.out, /instance de production introuvable/);
  assert.ok(!existsSync(join(dossier('nas-copie-refus'), 'sans', 'site')));
});

test('test : db/ qui se remplit pendant la copie (le service y écrit) : la copie est refusée au moment de poser, rien n\'est écrasé', { skip }, () => {
  const { test_ } = productionEtTest('nas-copie-course');
  // Un faux sqlite3, lancé par l'installateur pendant la copie : il écrit dans db/ de l'instance de test (comme le service qui crée sa base)
  // puis fait la sauvegarde en copiant le fichier.
  const faux = dossier('faux-sqlite3');
  mkdirSync(faux, { recursive: true });
  writeFileSync(join(faux, 'sqlite3'), '#!/bin/sh\nprintf arrive > "$MAVERICK_DB_ESSAI/vivante.db"\ncp "$1" "${2#.backup }"\n');
  chmodSync(join(faux, 'sqlite3'), 0o755);
  const r = spawnSync('sh', [installateur({ mode: 'test', label: 'dev', version: '0.2.3' }).fichier, '--dossier', test_, '--copier-base-prod'], {
    cwd: racine, encoding: 'utf8', env: { PATH: `${faux}:${process.env.PATH}`, MAVERICK_DB_ESSAI: join(test_, 'db') },
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /n'est plus vide/);
  assert.deepEqual(readdirSync(join(test_, 'db')), ['vivante.db']);
  assert.equal(lire(test_, 'db', 'vivante.db'), 'arrive');
  assert.ok(!readdirSync(test_).some((f) => f.startsWith('.db.') || f.startsWith('.installation')), 'ni copie provisoire ni verrou restants');
  assert.ok(!existsSync(join(test_, 'site')), 'le site n\'est pas posé : l\'installation s\'arrête avant');
});

test('test : une entrée créée dans db/ juste avant sa pose (fichier ou dossier) n\'est jamais écrasée : la copie s\'interrompt', { skip: SEUL_LINUX || skip }, () => {
  // Un faux « ln » (fichier) et un faux « mkdir » (dossier) créent l'entrée visée, comme le service qui écrit entre le contrôle et la pose,
  // puis laissent la vraie commande échouer dessus : la pose ne doit rien remplacer.
  for (const [cas, entree, fausse] of [['fichier', 'maverick.db', 'ln'], ['dossier', 'pieces', 'mkdir']]) {
    const { test_ } = productionEtTest(`nas-copie-pose-${cas}`);
    const faux = dossier(`faux-${fausse}-${cas}`);
    mkdirSync(faux, { recursive: true });
    const creer = cas === 'fichier' ? 'printf arrive > "$d"' : 'mkdir -p "$d" && printf arrive > "$d/arrive.txt"';
    writeFileSync(join(faux, fausse), `#!/bin/sh\nPATH=$PATH_REEL\nfor a; do d=$a; done\ncase "$d" in */db/${entree}) ${creer} ;; esac\nexec ${fausse} "$@"\n`);
    chmodSync(join(faux, fausse), 0o755);
    const r = spawnSync('sh', [installateur({ mode: 'test', label: 'dev', version: '0.2.3' }).fichier, '--dossier', test_, '--copier-base-prod'], {
      cwd: racine, encoding: 'utf8', env: { PATH: `${faux}:${process.env.PATH}`, PATH_REEL: process.env.PATH },
    });
    assert.equal(r.status, 1, `${cas} : ${r.stdout}${r.stderr}`);
    assert.match(r.stdout + r.stderr, /copie de la production interrompue/, cas);
    const arrive = cas === 'fichier' ? join(test_, 'db', entree) : join(test_, 'db', entree, 'arrive.txt');
    assert.equal(readFileSync(arrive, 'utf8'), 'arrive', `${cas} : ce que le service avait créé est intact`);
    if (cas === 'dossier') assert.deepEqual(readdirSync(join(test_, 'db', entree)), ['arrive.txt'], 'rien n\'est mêlé au dossier du service');
    assert.ok(!existsSync(join(test_, 'site')), `${cas} : le site n'est pas posé`);
  }
});

test('test : la pose conserve droits et contenu, fichiers et dossiers', { skip: SEUL_LINUX || skip }, () => {
  const { test_, prod } = productionEtTest('nas-copie-pose-droits');
  chmodSync(join(prod, 'db', 'pieces'), 0o750);
  chmodSync(join(prod, 'db', 'pieces', 'carte.txt'), 0o640);
  const r = lancer(installateur({ mode: 'test', label: 'dev', version: '0.2.3' }).fichier, ['--dossier', test_, '--copier-base-prod']);
  assert.equal(r.code, 0, r.out);
  assert.equal(lire(test_, 'db', 'pieces', 'carte.txt'), 'carte');
  assert.equal(statSync(join(test_, 'db', 'pieces', 'carte.txt')).mode & 0o777, 0o640);
  assert.equal(statSync(join(test_, 'db', 'pieces')).mode & 0o777, 0o750);
  assert.ok(!readdirSync(test_).some((f) => f.startsWith('.db.')), 'la copie provisoire est retirée');
});

test('refus : mauvais mode d\'instance, production introuvable ou confondue avec le test', { skip }, () => {
  const parent = dossier('refus');
  const prod = join(parent, 'maverick-center');
  const test_ = join(parent, 'maverick-center-test');
  const iTest = installateur({ mode: 'test', label: 't' }).fichier;

  let r = lancer(iTest, ['--dossier', test_, '--copier-base-prod']);
  assert.equal(r.code, 1);
  assert.match(r.out, /instance de production introuvable/);
  assert.ok(!existsSync(join(test_, 'site')));

  r = lancer(iTest, ['--dossier', '/', '--sans-base-prod']);
  assert.equal(r.code, 1);
  assert.match(r.out, /racine du système/);

  r = lancer(iTest, ['--dossier', test_, '--sans-base-prod']);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(readdirSync(join(test_, 'db')), [], 'base de test vide : sans demande, rien n\'est copié');

  const iProd = installateur({ label: 'p' }).fichier;
  r = lancer(iProd, ['--dossier', test_]);
  assert.equal(r.code, 1);
  assert.match(r.out, /instance « test » : un installateur « prod » refuse/);
  assert.equal(champs(test_).mode, 'test');

  assert.equal(lancer(iProd, ['--dossier', prod]).code, 0);
  r = lancer(iTest, ['--dossier', prod]);
  assert.equal(r.code, 1);
  assert.match(r.out, /instance « prod »/);
  assert.equal(champs(prod).mode, 'prod');

  // Un dossier qui a déjà un site sans fichier VERSION (installé autrement, par exemple le paquet du NAS) compte comme une production.
  const ancienne = join(parent, 'ancienne');
  mkdirSync(join(ancienne, 'site'), { recursive: true });
  writeFileSync(join(ancienne, 'site', 'index.html'), 'ancien');
  r = lancer(iTest, ['--dossier', ancienne]);
  assert.equal(r.code, 1);
  assert.match(r.out, /instance « prod »/);
  r = lancer(iTest, ['--dossier', join(parent, 'autre-test'), '--dossier-prod', ancienne, '--copier-base-prod']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /pas de base vivante/);
  assert.equal(lancer(iProd, ['--dossier', ancienne]).code, 0, 'un installateur de production peut la reprendre');
});

test('verrou : une installation en cours bloque la suivante ; un verrou périmé est nettoyé', { skip: SEUL_LINUX || skip }, () => {
  const prod = dossier('verrou');
  mkdirSync(join(prod, '.installation.lock'), { recursive: true });
  writeFileSync(join(prod, '.installation.lock', 'pid'), String(process.pid));
  const i = installateur().fichier;
  let r = lancer(i, ['--dossier', prod]);
  assert.equal(r.code, 1);
  assert.match(r.out, /déjà en cours/);
  writeFileSync(join(prod, '.installation.lock', 'pid'), '999999');
  r = lancer(i, ['--dossier', prod]);
  assert.equal(r.code, 0, r.out);
  assert.ok(!existsSync(join(prod, '.installation.lock')));
});

test('test : base de production en cours d\'écriture (WAL non reporté) copiée complète', { skip }, () => {
  const parent = dossier('wal');
  const prod = join(parent, 'maverick-center');
  assert.equal(lancer(installateur({ label: 'prod' }).fichier, ['--dossier', prod]).code, 0);
  const ecrivain = new DatabaseSync(join(prod, 'db', 'maverick.db'));
  ecrivain.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1), (2), (3);");
  assert.ok(existsSync(join(prod, 'db', 'maverick.db-wal')), 'les écritures sont encore dans le journal WAL');
  try {
    const r = lancer(installateur({ mode: 'test', label: 't' }).fichier, ['--dossier', join(parent, 'maverick-center-test'), '--copier-base-prod']);
    assert.equal(r.code, 0, r.out);
  } finally {
    ecrivain.close();
  }
  const copie = new DatabaseSync(join(parent, 'maverick-center-test', 'db', 'maverick.db'));
  assert.equal(copie.prepare('SELECT count(*) AS n FROM t').get().n, 3);
  copie.close();
});

test('test : liens symboliques dans la base du serveur normal refusés ; db/ lui-même peut être un lien ; droits des fichiers conservés', { skip: SEUL_LINUX || skip }, () => {
  const parent = dossier('liens');
  const prod = join(parent, 'maverick-center');
  const iTest = installateur({ mode: 'test', label: 't' }).fichier;
  assert.equal(lancer(installateur({ label: 'p' }).fichier, ['--dossier', prod]).code, 0);

  // Un lien vers un fichier du serveur normal : le test y écrirait. Refus, rien d'installé.
  writeFileSync(join(prod, 'db', 'vraie.db'), 'x');
  symlinkSync(join(prod, 'db', 'vraie.db'), join(prod, 'db', 'lien.db'));
  let r = lancer(iTest, ['--dossier', join(parent, 'maverick-center-test'), '--copier-base-prod']);
  assert.equal(r.code, 1);
  assert.match(r.out, /liens symboliques : copie refusée/);
  assert.ok(!existsSync(join(parent, 'maverick-center-test', 'site')));
  rmSync(join(prod, 'db', 'lien.db'));
  rmSync(join(prod, 'db', 'vraie.db'));

  // db/ du serveur normal rangé ailleurs, derrière un lien : copié quand même, base SQLite comprise, droits conservés.
  const ailleurs = join(parent, 'disque', 'db');
  mkdirSync(ailleurs, { recursive: true });
  const base = new DatabaseSync(join(ailleurs, 'maverick.db'));
  base.exec("CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (42);");
  base.close();
  chmodSync(join(ailleurs, 'maverick.db'), 0o640);
  rmSync(join(prod, 'db'), { recursive: true });
  symlinkSync(ailleurs, join(prod, 'db'));
  r = lancer(iTest, ['--dossier', join(parent, 'maverick-center-test'), '--copier-base-prod']);
  assert.equal(r.code, 0, r.out);
  const copie = new DatabaseSync(join(parent, 'maverick-center-test', 'db', 'maverick.db'));
  assert.equal(copie.prepare('SELECT x FROM t').get().x, 42);
  copie.close();
  assert.equal(statSync(join(parent, 'maverick-center-test', 'db', 'maverick.db')).mode & 0o777, 0o640);
});

test('racine du système refusée, y compris « // » sous bash', { skip }, () => {
  const i = installateur().fichier;
  for (const shell of ['sh', 'bash']) {
    const r = spawnSync(shell, [i, '--dossier', '//'], { cwd: racine, encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(r.status, 1, `${shell} : ${r.stdout}${r.stderr}`);
    assert.match(r.stdout + r.stderr, /racine du système/);
  }
});

test('configuration : une version livrée non modifiée sur place est remplacée ; mise-a-jour.sh est remplacé par renommage', { skip }, () => {
  const prod = dossier('configuration');
  const i = installateur().fichier;
  assert.equal(lancer(i, ['--dossier', prod]).code, 0);
  assert.equal(lire(prod, '.livre', 'nginx.conf'), lire(prod, 'nginx.conf'));
  // Simule une livraison précédente dont nginx.conf était différent, jamais touché sur place.
  writeFileSync(join(prod, 'nginx.conf'), 'ancienne version livrée\n');
  writeFileSync(join(prod, '.livre', 'nginx.conf'), 'ancienne version livrée\n');
  const inode = statSync(join(prod, 'mise-a-jour.sh')).ino;
  const r = lancer(i, ['--dossier', prod]);
  assert.equal(r.code, 0, r.out);
  assert.match(lire(prod, 'nginx.conf'), /server/, 'la nouvelle version est posée');
  assert.ok(!existsSync(join(prod, 'nginx.conf.nouveau')));
  assert.match(r.out, /nginx\.conf mis à jour par cette livraison : relancez « docker compose up -d »/);
  assert.notEqual(statSync(join(prod, 'mise-a-jour.sh')).ino, inode, 'nouveau fichier : un mise-a-jour.sh en cours garde l\'ancien');
});

test('test : les métriques (db/metriques/, sans dossier des métriques réglé) ne sont ni copiées de la production, ni effacées du test, ni prises pour une base', { skip }, () => {
  // docs/serveur.md, « Métriques et volume » : une base de métriques par instance (prod.db, dev.db), jamais mêlées (décision du propriétaire du
  // 2026-10-15). Avec docker-compose.yml, elles sont hors de db/ ; sans dossier réglé, le service les range dans db/metriques/.
  const parent = dossier('metriques');
  const prod = join(parent, 'maverick-center');
  const test_ = join(parent, 'maverick-center-test');
  assert.equal(lancer(installateur({ label: 'prod' }).fichier, ['--dossier', prod]).code, 0);
  const base = new DatabaseSync(join(prod, 'db', 'maverick.db'));
  base.exec("CREATE TABLE fiche (nom TEXT); INSERT INTO fiche VALUES ('Aldric');");
  base.close();
  mkdirSync(join(prod, 'db', 'metriques'));
  const mesures = new DatabaseSync(join(prod, 'db', 'metriques', 'prod.db'));
  mesures.exec('CREATE TABLE heure (n INTEGER); INSERT INTO heure VALUES (7);');
  mesures.close();

  // Test : son db/ ne contient que ses métriques (pas encore de base) : la copie de la production, demandée, est permise.
  mkdirSync(join(test_, 'db', 'metriques'), { recursive: true });
  writeFileSync(join(test_, 'db', 'metriques', 'dev.db'), 'mesures du site de dev');
  writeFileSync(join(test_, '.env'), 'MAVERICK_CONTENEUR=maverick-center-test\nMAVERICK_PORT=127.0.0.1:8081\nMAVERICK_BASE_TEST=conservee\n');
  const metriques = statSync(join(test_, 'db', 'metriques')).ino;
  const r = lancer(installateur({ mode: 'test', label: 'dev', version: '0.2.1' }).fichier, ['--dossier', test_, '--copier-base-prod']);
  assert.equal(r.code, 0, r.out);
  const copie = new DatabaseSync(join(test_, 'db', 'maverick.db'));
  assert.deepEqual(copie.prepare('SELECT nom FROM fiche').all().map((l) => l.nom), ['Aldric']);
  copie.close();
  assert.deepEqual(readdirSync(join(test_, 'db', 'metriques')), ['dev.db'], 'les métriques de la production ne viennent jamais dans le test');
  assert.equal(lire(test_, 'db', 'metriques', 'dev.db'), 'mesures du site de dev', 'celles du test ne sont pas effacées');
  assert.equal(statSync(join(test_, 'db', 'metriques')).ino, metriques, 'dossier gardé (le service peut y avoir sa base ouverte)');
  assert.match(lire(test_, 'db', '.copie-de-la-production'), /^source=/m);

  // Installations suivantes, avec ou sans le réglage historique : ni recopie, ni effacement ; les métriques du test restent.
  writeFileSync(join(test_, '.env'), 'MAVERICK_CONTENEUR=maverick-center-test\nMAVERICK_PORT=127.0.0.1:8081\n');
  const r2 = lancer(installateur({ mode: 'test', label: 'dev2', version: '0.2.2' }).fichier, ['--dossier', test_]);
  assert.equal(r2.code, 0, r2.out);
  assert.deepEqual(readdirSync(join(test_, 'db')).sort(), ['.copie-de-la-production', 'maverick.db', 'metriques']);
  assert.deepEqual(readdirSync(join(test_, 'db', 'metriques')), ['dev.db']);
  const p = new DatabaseSync(join(prod, 'db', 'metriques', 'prod.db'), { readOnly: true });
  assert.equal(p.prepare('SELECT n FROM heure').get().n, 7, 'la production garde les siennes');
  p.close();
});

test('docker-compose.yml de l’instance : métriques montées hors de db/, dossier partagé réglable comme celui de la maintenance', () => {
  const compose = readFileSync(new URL('../../deploy/installateur/docker-compose.yml', import.meta.url), 'utf8');
  assert.match(compose, /^ {6}- \$\{MAVERICK_DOSSIER_METRIQUES:-\.\/metriques\}:\/metriques$/m);
  assert.match(compose, /^ {6}- \.\/db:\/db$/m);
  assert.doesNotMatch(compose, /metriques:-\.\/db/, 'jamais dans db/, que l’installateur de test remplace');
});
