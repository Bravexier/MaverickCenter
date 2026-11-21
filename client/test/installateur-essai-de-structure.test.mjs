// L'essai de la structure avant l'installation (deploy/installateur/installateur.sh ; lot 7 du chantier de la base de dev, R274, R275 ; docs/serveur.md, « Essai
// avant installation »). L'installateur dépose une demande dans db/essai-de-structure/, attend la réponse du SERVICE (jamais il ne touche la base), la lit,
// l'écrit dans installation.log, retire sa demande, et continue — sauf un refus quand db/source existe : alors rien n'est installé. Le service est ici un faux,
// joué par le test (le vrai : serveur-essai-de-structure.test.mjs). Nécessite sh, tar et gzip ; sinon les tests sont ignorés.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const have = (cmd) => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip')) && 'tar ou gzip indisponible';
const racine = dossierTemporaire('installateur-essai');
const MIGRATIONS = { '0001-premiere.sql': 'CREATE TABLE a (id INTEGER PRIMARY KEY) STRICT;\n', '0002-seconde.sql': 'CREATE TABLE b (id INTEGER PRIMARY KEY) STRICT;\n' };
const SCHEMA = 'PRAGMA user_version = 2;\nCREATE TABLE a (id INTEGER PRIMARY KEY) STRICT;\nCREATE TABLE b (id INTEGER PRIMARY KEY) STRICT;\n';

let n = 0;
/** Un faux site marqué `label`, avec les migrations et le schema.sql livrés dans _serveur/data/. */
function site(label, { migrations = MIGRATIONS, schema = SCHEMA } = {}) {
  const d = join(racine, `site-${(n += 1)}`);
  const fichiers = { 'index.html': `<h1>accueil ${label}</h1>`, 'wiki/p/index.html': `<p>page ${label}</p>`, '_serveur/data/schema.sql': schema };
  for (const [nom, sql] of Object.entries(migrations)) fichiers[`_serveur/data/migrations/${nom}`] = sql;
  for (const [p, c] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(d, p)), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}
const installateur = ({ mode = 'test', label, version, migrations, schema }) => fabriquer({
  mode, site: site(label, { migrations, schema }), tag: mode === 'prod' ? `v${version.replace(/\.\d+$/, '')}` : `v${version}`, version, sha: 'c'.repeat(40), sortie: join(racine, 'sortie'),
}).fichier;
const lancer = (fichier, args = [], env = {}) => new Promise((ok) => {
  const p = spawn('sh', [fichier, ...args], { cwd: racine, env: { PATH: process.env.PATH, ...env } });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => ok({ code, out }));
});
const lire = (...p) => readFileSync(join(...p), 'utf8');
const instance = (nom) => join(racine, nom);
let compteur = 0;

/** Pose une première installation (aucun essai) puis une base vivante et ce que le service y garde : l'instance est « en service ». */
async function enService(nom, { source = false } = {}) {
  const dossier = instance(nom);
  const premiere = await lancer(installateur({ label: 'v1', version: '0.2.1' }), ['--dossier', dossier]);
  assert.equal(premiere.code, 0, premiere.out);
  writeFileSync(join(dossier, 'db', 'vivante.db'), 'la base vivante du service');
  writeFileSync(join(dossier, 'db', 'vivante.db-wal'), 'son journal');
  if (source) writeFileSync(join(dossier, 'db', 'source'), 'marqueur du changement de structure sur place\n');
  return dossier;
}

/** L'état d'une arborescence : chemin → empreinte du contenu ; hors installation.log et ce qui est donné en `sauf`. */
function etat(dossier, sauf = []) {
  const r = {};
  const parcourir = (d) => {
    for (const nom of readdirSync(d).sort()) {
      const chemin = join(d, nom);
      const rel = relative(dossier, chemin);
      if (rel === 'installation.log' || sauf.some((s) => rel === s || rel.startsWith(`${s}/`))) continue;
      if (statSync(chemin).isDirectory()) { r[`${rel}/`] = ''; parcourir(chemin); } else r[rel] = createHash('sha256').update(readFileSync(chemin)).digest('hex');
    }
  };
  parcourir(dossier);
  return r;
}
const ESSAIS = 'db/essai-de-structure';

/**
 * Le faux service : surveille db/essai-de-structure/ comme le vrai, accuse chaque demande, puis (selon `reponse`) écrit son resultat.json dans le format du vrai
 * (JSON indenté de deux espaces, verdict et resume au premier niveau). Il note ce que la demande contenait ET l'état du site à cet instant (l'installateur n'a
 * pas encore touché le site). `reponse` : null = ne répond jamais (même pas un accusé), { accuse: false } = rien du tout, { resultat: false } = accuse seulement.
 */
function fauxService(dossier, reponse) {
  const vus = [];
  const racineEssais = join(dossier, ESSAIS);
  const minuterie = setInterval(() => {
    if (!reponse || !existsSync(racineEssais)) return;
    for (const nom of readdirSync(racineEssais).filter((x) => /^demande-/.test(x))) {
      const demande = join(racineEssais, nom);
      if (!existsSync(join(demande, 'demande.json')) || existsSync(join(demande, 'accuse.json'))) continue;
      // l'installateur peut retirer sa demande entre le test d'existence et la lecture (il la dépose d'un coup, par mv) : ENOENT seul, demande suivante
      let lue;
      try {
        lue = { migrations: Object.fromEntries(readdirSync(join(demande, 'migrations')).map((f) => [f, lire(demande, 'migrations', f)])),
          contenu: JSON.parse(lire(demande, 'demande.json')), schema: lire(demande, 'schema.sql') };
      } catch (e) {
        if (e?.code === 'ENOENT') continue;
        throw e;
      }
      const { migrations } = lue;
      vus.push({ nom, demande: lue.contenu, migrations, schema: lue.schema, siteAlors: existsSync(join(dossier, 'site', 'index.html')) ? lire(dossier, 'site', 'index.html') : null,
        entrees: readdirSync(racineEssais).sort() });
      if (reponse.accuse === false) continue;
      writeFileSync(join(demande, 'accuse.json'), '{"format":"maverick-essai-accuse/1"}\n');
      if (reponse.resultat === false) continue;
      const corps = { format: 'maverick-structure/1', verdict: reponse.verdict, ...(reponse.verdict === 'refuse' ? { refus: { migration: 2, etape: 'cles_etrangeres', raison: 'une clé étrangère rompue' } } : {}),
        demande: { nom }, essaye_le: '2026-11-15T09:00:00Z', instance: 'dev', resume: reponse.resume ?? `${reponse.verdict} d'essai (dit « bien »)` };
      writeFileSync(join(demande, 'resultat.json'), `${JSON.stringify(corps, null, 2)}\n`);
    }
  }, 40);
  return { vus, arreter: () => clearInterval(minuterie) };
}
const reglages = { MAVERICK_ESSAI_ACCUSE_S: '1', MAVERICK_ESSAI_DELAI_S: '30' };

test('réponse acceptée : la demande porte les migrations et le schema.sql LIVRÉS, déposée avant que le site ne change ; verdict au journal, demande retirée, le reste de db/ intact', { skip }, async () => {
  const dossier = await enService('accepte');
  const avantDb = etat(join(dossier, 'db'));
  const service = fauxService(dossier, { verdict: 'accepte', resume: 'accepté : 2 migration(s) (de 0 à 2)' });
  try {
    const r = await lancer(installateur({ label: 'v2', version: '0.2.2' }), ['--dossier', dossier], reglages);
    assert.equal(r.code, 0, r.out);
    assert.equal(service.vus.length, 1, 'une seule demande');
    const vu = service.vus[0];
    assert.deepEqual(vu.migrations, MIGRATIONS);
    assert.equal(vu.schema, SCHEMA);
    assert.equal(vu.demande.version, '0.2.2');
    assert.equal(vu.demande.tag, 'v0.2.2');
    assert.match(vu.demande.deposee_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.match(vu.nom, /^demande-0\.2\.2-\d+$/);
    assert.equal(vu.siteAlors, '<h1>accueil v1</h1>', 'le site n’était pas encore remplacé quand le service a vu la demande');
    assert.ok(!vu.entrees.some((e) => e.startsWith('.depot-')), 'la demande est posée d’un coup (aucun dépôt provisoire visible quand elle apparaît)');
    assert.equal(lire(dossier, 'site/index.html'), '<h1>accueil v2</h1>', 'installé');
    assert.match(lire(dossier, 'installation.log'), /Essai de la structure : accepté par le service \(accepté : 2 migration\(s\) \(de 0 à 2\)\)/);
    assert.deepEqual(readdirSync(join(dossier, ESSAIS)), [], 'sa demande est retirée, rien d’autre n’a été posé');
    assert.deepEqual(etat(join(dossier, 'db'), ['essai-de-structure']), avantDb, 'le reste de db/ est identique');
  } finally {
    service.arreter();
  }
});

test('« a_jour » et « indisponible » : l’installation continue, le verdict est au journal', { skip }, async () => {
  for (const verdict of ['a_jour', 'indisponible']) {
    const dossier = await enService(`verdict-${verdict}`);
    const service = fauxService(dossier, { verdict, resume: `${verdict} dit par le service` });
    try {
      const r = await lancer(installateur({ label: 'v2', version: '0.2.2' }), ['--dossier', dossier], reglages);
      assert.equal(r.code, 0, r.out);
      assert.equal(lire(dossier, 'site/index.html'), '<h1>accueil v2</h1>');
      assert.match(lire(dossier, 'installation.log'), new RegExp(`Essai de la structure : .*${verdict} dit par le service`));
    } finally {
      service.arreter();
    }
  }
});

test('pas de réponse (service arrêté ou sans cet essai) : noté, la demande est retirée, l’installation continue', { skip }, async () => {
  const dossier = await enService('muet');
  const avantDb = etat(join(dossier, 'db'));
  const t0 = Date.now();
  const r = await lancer(installateur({ label: 'v2', version: '0.2.2' }), ['--dossier', dossier], reglages);
  assert.equal(r.code, 0, r.out);
  assert.ok(Date.now() - t0 < 20_000, 'un service muet ne retient l’installation que le délai de l’accusé de réception');
  assert.equal(lire(dossier, 'site/index.html'), '<h1>accueil v2</h1>');
  assert.match(lire(dossier, 'installation.log'), /Essai de la structure : aucune réponse du service en 1 s/);
  assert.deepEqual(readdirSync(join(dossier, ESSAIS)), []);
  assert.deepEqual(etat(join(dossier, 'db'), ['essai-de-structure']), avantDb);
});

test('accusé de réception sans résultat dans le délai : noté, l’installation continue, la demande est retirée', { skip }, async () => {
  const dossier = await enService('lent');
  const service = fauxService(dossier, { resultat: false });
  try {
    const r = await lancer(installateur({ label: 'v2', version: '0.2.2' }), ['--dossier', dossier], { MAVERICK_ESSAI_ACCUSE_S: '1', MAVERICK_ESSAI_DELAI_S: '3' });
    assert.equal(r.code, 0, r.out);
    assert.equal(service.vus.length, 1);
    assert.match(lire(dossier, 'installation.log'), /Essai de la structure : le service n'a pas fini en 3 s/);
    assert.equal(lire(dossier, 'site/index.html'), '<h1>accueil v2</h1>');
    assert.deepEqual(readdirSync(join(dossier, ESSAIS)), []);
  } finally {
    service.arreter();
  }
});

test('refus sans db/source : le refus est au journal, l’installation continue', { skip }, async () => {
  const dossier = await enService('refus-sans-marqueur');
  const service = fauxService(dossier, { verdict: 'refuse', resume: 'refusé : migration 0002, étape cles_etrangeres : une clé étrangère rompue' });
  try {
    const r = await lancer(installateur({ label: 'v2', version: '0.2.2' }), ['--dossier', dossier], reglages);
    assert.equal(r.code, 0, r.out);
    assert.match(lire(dossier, 'installation.log'), /ATTENTION essai de la structure REFUSÉ par le service \(refusé : migration 0002, étape cles_etrangeres : une clé étrangère rompue\) : l'installation continue/);
    assert.equal(lire(dossier, 'site/index.html'), '<h1>accueil v2</h1>');
    assert.match(lire(dossier, 'VERSION'), /^tag=v0\.2\.2$/m);
    assert.deepEqual(readdirSync(join(dossier, ESSAIS)), []);
  } finally {
    service.arreter();
  }
});

test('refus avec db/source : l’installation s’arrête AVANT d’avoir rien installé — tout l’état de l’instance est identique, la demande est retirée', { skip }, async () => {
  const dossier = await enService('refus-avec-marqueur', { source: true });
  const avant = etat(dossier, [ESSAIS]);
  const service = fauxService(dossier, { verdict: 'refuse', resume: 'refusé : migration 0002, étape cles_etrangeres : une clé étrangère rompue' });
  try {
    const r = await lancer(installateur({ label: 'v2', version: '0.2.2' }), ['--dossier', dossier], reglages);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /rien n'a été installé/);
    assert.deepEqual(etat(dossier, [ESSAIS]), avant, 'site/, VERSION, docker-compose.yml, db/ : rien n’a bougé');
    assert.equal(lire(dossier, 'site/index.html'), '<h1>accueil v1</h1>');
    assert.match(lire(dossier, 'VERSION'), /^tag=v0\.2\.1$/m);
    assert.match(lire(dossier, 'installation.log'), /ATTENTION essai de la structure REFUSÉ par le service/);
    assert.deepEqual(readdirSync(join(dossier, ESSAIS)), [], 'la demande est retirée même à l’arrêt');
    assert.ok(!existsSync(join(dossier, '.installation.lock')), 'verrou levé');
    // un essai accepté, avec le marqueur : l'installation se fait
    service.arreter();
    const accepte = fauxService(dossier, { verdict: 'accepte', resume: 'accepté' });
    try {
      const r2 = await lancer(installateur({ label: 'v3', version: '0.2.3' }), ['--dossier', dossier], reglages);
      assert.equal(r2.code, 0, r2.out);
      assert.equal(lire(dossier, 'site/index.html'), '<h1>accueil v3</h1>');
    } finally {
      accepte.arreter();
    }
  } finally {
    service.arreter();
  }
});

test('première installation, base absente, et --copier-base-prod : aucun essai (aucune demande déposée) ; le dossier d’essai ne compte ni pour une base ni pour la copie', { skip }, async () => {
  const parent = instance(`copie-${(compteur += 1)}`);
  mkdirSync(parent, { recursive: true });
  const prod = join(parent, 'maverick-center');
  const test_ = join(parent, 'maverick-center-test');
  const r0 = await lancer(installateur({ mode: 'prod', label: 'prod', version: '0.2.0' }), ['--dossier', prod]);
  assert.equal(r0.code, 0, r0.out);
  mkdirSync(join(prod, 'db', 'essai-de-structure'));
  writeFileSync(join(prod, 'db', 'essai-de-structure', 'dernier.json'), '{"instance":"prod"}\n');
  // une VRAIE base (avec sqlite3, la copie passe par .backup), et la copie d'un essai en cours dans le dossier d'essai de la production : ni l'un ni l'autre ne gêne
  const base = new DatabaseSync(join(prod, 'db', 'vivante.db'));
  base.exec("CREATE TABLE fiche (nom TEXT); INSERT INTO fiche VALUES ('base de la production');");
  base.close();
  writeFileSync(join(prod, 'db', 'essai-de-structure', 'structure-essai-1-00000000-0000-0000-0000-000000000000-avant.db'), 'copie d’essai à moitié écrite');

  // première installation du test : pas de VERSION, pas de base : aucune demande
  const service = fauxService(test_, { verdict: 'accepte' });
  try {
    const r1 = await lancer(installateur({ label: 'v1', version: '0.2.1' }), ['--dossier', test_], reglages);
    assert.equal(r1.code, 0, r1.out);
    assert.equal(service.vus.length, 0);
    assert.doesNotMatch(lire(test_, 'installation.log'), /Essai de la structure/);
    assert.ok(!existsSync(join(test_, ESSAIS)), 'rien n’est créé dans db/');
    // le dossier d'essai seul ne remplit pas db/ : la copie de la production est permise, sans l'essai de la production, et sans demande
    mkdirSync(join(test_, ESSAIS));
    writeFileSync(join(test_, ESSAIS, 'dernier.json'), '{"instance":"dev"}\n');
    const r2 = await lancer(installateur({ label: 'v2', version: '0.2.2' }), ['--dossier', test_, '--copier-base-prod', '--dossier-prod', prod], reglages);
    assert.equal(r2.code, 0, r2.out);
    const copiee = new DatabaseSync(join(test_, 'db', 'vivante.db'), { readOnly: true });
    try {
      assert.deepEqual(copiee.prepare('SELECT nom FROM fiche').all().map((l) => l.nom), ['base de la production']);
    } finally {
      copiee.close();
    }
    assert.equal(lire(test_, ESSAIS, 'dernier.json'), '{"instance":"dev"}\n', 'le dossier d’essai de la production n’est pas copié');
    assert.deepEqual(readdirSync(join(test_, ESSAIS)), ['dernier.json'], 'ni sa copie d’essai');
    assert.equal(service.vus.length, 0, 'aucune demande avec --copier-base-prod');
    assert.doesNotMatch(lire(test_, 'installation.log'), /Essai de la structure/);
    assert.equal(lire(test_, 'site/index.html'), '<h1>accueil v2</h1>');
  } finally {
    service.arreter();
  }
});

test('l’installateur ne retire que sa propre demande dans db/ : un dossier voisin (celui d’une autre installation, un résultat gardé) est laissé', { skip }, async () => {
  const dossier = await enService('voisin');
  mkdirSync(join(dossier, ESSAIS, 'demande-0.1.0-1'), { recursive: true });
  writeFileSync(join(dossier, ESSAIS, 'demande-0.1.0-1', 'resultat.json'), '{}\n');
  writeFileSync(join(dossier, ESSAIS, 'dernier.json'), '{"verdict":"accepte"}\n');
  const service = fauxService(dossier, { verdict: 'accepte' });
  try {
    const r = await lancer(installateur({ label: 'v2', version: '0.2.2' }), ['--dossier', dossier], reglages);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(readdirSync(join(dossier, ESSAIS)).sort(), ['demande-0.1.0-1', 'dernier.json']);
    assert.equal(lire(dossier, ESSAIS, 'dernier.json'), '{"verdict":"accepte"}\n');
  } finally {
    service.arreter();
  }
});

test('le script : un seul essai, avant la synchronisation du site ; db/source et les délais sont lus ; mise-a-jour.sh n’a rien à savoir de l’essai', () => {
  const script = readFileSync(new URL('../../deploy/installateur/installateur.sh', import.meta.url), 'utf8');
  assert.ok(script.indexOf('essayer_la_structure\nfi') > 0 && script.indexOf('essayer_la_structure\nfi') < script.indexOf('rsync -a --delete'), 'l’essai précède la synchronisation du site');
  assert.match(script, /\[ -e "\$DOSSIER\/db\/source" \]/);
  assert.match(script, /MAVERICK_ESSAI_ACCUSE_S:-20/);
  assert.match(script, /MAVERICK_ESSAI_DELAI_S:-120/);
  assert.doesNotMatch(readFileSync(new URL('../../deploy/installateur/mise-a-jour.sh', import.meta.url), 'utf8'), /essai-de-structure|db\/source/);
});
