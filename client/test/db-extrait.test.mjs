// `npm run db:extrait` (scripts/db-extrait.mjs ; lot 5 du chantier de la base de dev) : le téléchargement de l'extrait du contenu du site de dev, sa
// vérification (empreinte du fichier, puis de chaque table), son écriture atomique dans un dossier ignoré par git, la clé de lecture facultative.
// Sans réseau : le service de dev tourne en local, dans le test.
//   node --test test/db-extrait.test.mjs
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { demarrerService } from '../serveur/service.mjs';
import { DOSSIER_PAR_DEFAUT, ErreurExtrait, FICHIER, FICHIER_META, enteteDeLaCle, telechargerExtrait } from '../scripts/db-extrait.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { SENTINELLES, marquesDesFiches } from './aide-fiches-sentinelles.mjs';

const REGLES = cheminBase({ sansExemples: false });
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** Un service de dev (édition ouverte) dans un dossier neuf, avec un prétiré sentinelle. */
async function serviceDeDev(t, options = {}) {
  const racine = dossierTemporaire('db-extrait', { t });
  const regles = join(racine, 'regles.db');
  copyFileSync(REGLES, regles);
  const s = await demarrerService({ regles, dossier: join(racine, 'dev'), port: 0, intervalle: 0, edition: true, journal: () => {}, tipeee: false, metriques: false, ...options });
  t.after(() => s.arreter());
  const creee = await fetch(`${s.url}/api/personnages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: SENTINELLES.pretire }) });
  assert.equal(creee.status, 201);
  return { s, racine };
}

test('le dossier par défaut est ignoré par git (var/)', () => {
  assert.equal(DOSSIER_PAR_DEFAUT, join(RACINE, 'var', 'extrait'));
  assert.equal(execFileSync('git', ['check-ignore', '-q', join('var', 'extrait', FICHIER)], { cwd: RACINE, stdio: 'pipe' }).toString(), '', 'git ignore var/extrait/');
});

test('la clé de lecture : « utilisateur:motdepasse » part en Basic, toute autre valeur en Bearer, aucune sans clé', () => {
  assert.deepEqual(enteteDeLaCle(null), {});
  assert.deepEqual(enteteDeLaCle('  '), {});
  assert.deepEqual(enteteDeLaCle('claude:secret'), { Authorization: `Basic ${Buffer.from('claude:secret').toString('base64')}` });
  assert.deepEqual(enteteDeLaCle('jeton-123'), { Authorization: 'Bearer jeton-123' });
});

test('télécharge l’extrait du site de dev, le vérifie et l’écrit avec son méta ; sans fiche ; relancé sans changement, il n’est pas retéléchargé', async (t) => {
  const { s, racine } = await serviceDeDev(t);
  const dossier = join(racine, 'sortie', 'extrait');
  const premier = await telechargerExtrait({ url: s.url, dossier });
  assert.equal(premier.telecharge, true);
  assert.deepEqual(readdirSync(dossier).sort(), [FICHIER, FICHIER_META], 'aucun fichier provisoire');
  const meta = JSON.parse(readFileSync(join(dossier, FICHIER_META), 'utf8'));
  assert.deepEqual(meta, premier.meta);
  assert.match(meta.fabrique_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(meta.fichier.octets, statSync(join(dossier, FICHIER)).size);
  const octets = readFileSync(join(dossier, FICHIER));
  for (const marque of marquesDesFiches({ pretire: SENTINELLES.pretire })) assert.ok(!octets.includes(Buffer.from(marque)), marque);
  const db = new DatabaseSync(join(dossier, FICHIER), { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM personnage').get().n, 0, 'aucune fiche dans le fichier téléchargé');
    assert.ok(db.prepare('SELECT count(*) AS n FROM page').get().n > 0);
    assert.equal(db.prepare('SELECT fabrique_le FROM extrait_meta').get().fabrique_le, meta.fabrique_le);
  } finally {
    db.close();
  }
  // la même demande : l'extrait est celui du site, rien n'est retéléchargé
  let telechargements = 0;
  const compte = (adresse, options) => { if (String(adresse).endsWith('/extrait/')) telechargements += 1; return fetch(adresse, options); };
  const deuxieme = await telechargerExtrait({ url: s.url, dossier, fetch: compte });
  assert.equal(deuxieme.telecharge, false);
  assert.equal(telechargements, 0);
  assert.equal(deuxieme.meta.fabrique_le, meta.fabrique_le);
  // le contenu du site change : un autre extrait, retéléchargé
  const creation = await fetch(`${s.url}/api/edition/`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 'metiers/', operations: [{ op: 'creer', entite: 'metier', valeurs: { nom: 'Essai du téléchargement', description: 'Un métier d’essai.', bonus_brut: '+1 INI' } }] }) });
  assert.equal(creation.status, 200);
  const troisieme = await telechargerExtrait({ url: `${s.url}/`, dossier, fetch: compte });
  assert.equal(troisieme.telecharge, true);
  assert.equal(telechargements, 1);
  assert.notEqual(troisieme.meta.empreinte, meta.empreinte);
  assert.ok(troisieme.meta.modifications_versees >= 1);
  const apres = new DatabaseSync(join(dossier, FICHIER), { readOnly: true });
  try {
    assert.ok(apres.prepare("SELECT 1 FROM historique_modification WHERE table_nom = 'metier' AND version IS NULL").get(), 'la saisie récente est dans l’historique');
  } finally {
    apres.close();
  }
});

test('la clé est envoyée : Basic ou Bearer ; refus du site (401, 403) dits clairement, rien d’écrit', async (t) => {
  const racine = dossierTemporaire('db-extrait-cle', { t });
  const vus = [];
  const faux = createServer((req, res) => {
    vus.push(req.headers.authorization ?? null);
    res.writeHead(vus.length === 1 ? 401 : 403, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  await new Promise((ok) => faux.listen(0, '127.0.0.1', ok));
  t.after(() => faux.close());
  const url = `http://127.0.0.1:${faux.address().port}`;
  await assert.rejects(() => telechargerExtrait({ url, dossier: racine, cle: 'claude:secret' }), (e) => e instanceof ErreurExtrait && /401/.test(e.message) && /clé de lecture/.test(e.message));
  await assert.rejects(() => telechargerExtrait({ url, dossier: racine, cle: 'jeton' }), (e) => /403/.test(e.message));
  assert.deepEqual(vus, [`Basic ${Buffer.from('claude:secret').toString('base64')}`, 'Bearer jeton']);
  assert.deepEqual(readdirSync(racine), [], 'rien d’écrit');
  await assert.rejects(() => telechargerExtrait({ url: 'http://127.0.0.1:1', dossier: racine }), ErreurExtrait);
});

test('un fichier dont l’empreinte ne concorde pas n’est jamais posé : fichier abîmé, table altérée, méta d’un autre contenu', async (t) => {
  const { s, racine } = await serviceDeDev(t);
  const dossier = join(racine, 'sortie');
  // octets abîmés en route
  const abime = async (adresse, options) => {
    const r = await fetch(adresse, options);
    if (!String(adresse).endsWith('/extrait/')) return r;
    const octets = Buffer.from(await r.arrayBuffer());
    octets[octets.length - 10] ^= 0xff;
    return new Response(octets, { status: 200, headers: r.headers });
  };
  await assert.rejects(() => telechargerExtrait({ url: s.url, dossier, fetch: abime }), /changé pendant le téléchargement/);
  assert.equal(existsSync(join(dossier, FICHIER)), false);
  assert.deepEqual(readdirSync(dossier), [], 'ni fichier ni provisoire');
  // un méta qui annonce une autre empreinte de table que celle du fichier (même octets) : refusé après lecture des tables
  const meta = await (await fetch(`${s.url}/api/edition/extrait/meta/`)).json();
  const menteur = async (adresse, options) => {
    const r = await fetch(adresse, options);
    if (!String(adresse).endsWith('/meta/')) return r;
    const faux = { ...meta, tables: { ...meta.tables, metier: { ...meta.tables.metier, empreinte: '0'.repeat(64) } } };
    return new Response(JSON.stringify(faux), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  await assert.rejects(() => telechargerExtrait({ url: s.url, dossier, fetch: menteur }), (e) => e instanceof ErreurExtrait && /empreinte/.test(e.message) && /metier/.test(e.message));
  assert.deepEqual(readdirSync(dossier), []);
});

test('la production refuse : 403 sur l’extrait comme sur le méta', async (t) => {
  const racine = dossierTemporaire('db-extrait-prod', { t });
  const regles = join(racine, 'regles.db');
  copyFileSync(REGLES, regles);
  const s = await demarrerService({ regles, dossier: join(racine, 'prod'), port: 0, intervalle: 0, journal: () => {}, tipeee: false, metriques: false, attestation: false });
  t.after(() => s.arreter());
  for (const chemin of ['/api/edition/extrait/', '/api/edition/extrait/meta/']) assert.equal((await fetch(`${s.url}${chemin}`)).status, 403, chemin);
  await assert.rejects(() => telechargerExtrait({ url: s.url, dossier: join(racine, 'sortie') }), /403/);
});

test('la commande : npm run db:extrait écrit dans le dossier donné et dit la date de l’extrait', async (t) => {
  const { s, racine } = await serviceDeDev(t);
  const dossier = join(racine, 'cmd');
  const sortie = await new Promise((ok, ko) => {
    execFile(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-extrait.mjs'), '--url', s.url, '--dossier', dossier],
      { env: { ...process.env, MAVERICK_EXTRAIT_CLE: '' } }, (e, out, err) => (e ? ko(new Error(err || e.message)) : ok(out)));
  });
  const meta = JSON.parse(readFileSync(join(dossier, FICHIER_META), 'utf8'));
  assert.ok(sortie.includes(meta.fabrique_le), 'la date de l’extrait est affichée');
  assert.match(sortie, /Téléchargé/);
  assert.ok(existsSync(join(dossier, FICHIER)));
});
