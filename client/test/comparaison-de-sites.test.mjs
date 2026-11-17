// La comparaison de deux sites fabriqués (serveur/comparaison-de-sites.mjs, scripts/comparer-sites.mjs ; lot 9 du chantier de la base de dev) : identiques,
// différents, seulement d'un côté, et ce que la fabrication fait varier d'elle-même (une base SQLite de même contenu sous une autre forme, la base de
// référence de la production), listes plafonnées, rapport JSON, codes de sortie. Deux arborescences fabriquées dans un dossier temporaire.
//   node --test test/comparaison-de-sites.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EXEMPLES_PAR_DEFAUT, FORMAT_COMPARAISON, comparerSites, empreintesDeLaBase, listerLesFichiers, parcourir, tailleDuDossier } from '../serveur/comparaison-de-sites.mjs';
import { TABLES_DE_CONTENU, TABLES_PROPRES_AU_SITE } from '../src/lib/tables-de-la-base.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/comparer-sites.mjs', import.meta.url));
const TABLE = TABLES_DE_CONTENU[0];
const PROPRE = TABLES_PROPRES_AU_SITE[0];
const PUBLIEE = 'donnees/maverick.db';

/** Écrit des fichiers { chemin relatif: contenu } sous `dossier`. */
function poser(dossier, fichiers) {
  for (const [rel, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(dossier, rel)), { recursive: true });
    writeFileSync(join(dossier, rel), contenu);
  }
  return dossier;
}

/** Une petite base SQLite dont une table de contenu porte `lignes` ; `autreForme` : une vue et un VACUUM en plus (autres octets, mêmes lignes). */
function baseDEssai(chemin, lignes, { autreForme = false, propres = [] } = {}) {
  mkdirSync(dirname(chemin), { recursive: true });
  const db = new DatabaseSync(chemin);
  db.exec(`CREATE TABLE "${TABLE}" (id INTEGER PRIMARY KEY, valeur TEXT)`);
  for (const [id, valeur] of lignes) db.prepare(`INSERT INTO "${TABLE}" (id, valeur) VALUES (?, ?)`).run(id, valeur);
  // une table propre au site (fiches, comptes, journal), vide ou portant `propres`
  db.exec(`CREATE TABLE "${PROPRE}" (id INTEGER PRIMARY KEY, valeur TEXT)`);
  for (const [id, valeur] of propres) db.prepare(`INSERT INTO "${PROPRE}" (id, valeur) VALUES (?, ?)`).run(id, valeur);
  if (autreForme) {
    db.exec("CREATE TABLE tampon (a TEXT); INSERT INTO tampon VALUES (hex(randomblob(20000))); DELETE FROM tampon; CREATE VIEW extrait_meta AS SELECT 'x' AS format");
    db.exec('VACUUM');
  }
  db.close();
  return chemin;
}

const deux = (t) => [dossierTemporaire('comparaison-a', { t }), dossierTemporaire('comparaison-b', { t })];

test('deux sites identiques : tout est identique, les sites sont équivalents, le rapport porte son format', (t) => {
  const [a, b] = deux(t);
  const site = { 'index.html': '<html>accueil</html>', '_astro/app.AbCd1234.js': 'console.log(1)', 'regles/magies/index.html': 'x' };
  poser(a, site);
  poser(b, site);
  const r = comparerSites(a, b);
  assert.equal(r.format, FORMAT_COMPARAISON);
  assert.equal(r.identiques, 3);
  for (const c of ['differents', 'seulement_a', 'seulement_b', 'variables']) assert.equal(r[c].nombre, 0, c);
  assert.equal(r.equivalents, true);
  assert.deepEqual([r.a.fichiers, r.b.fichiers], [3, 3]);
  assert.equal(r.a.octets, r.b.octets);
});

test('différents, seulement dans A, seulement dans B : chacun compté, nommé, avec ses octets ; les sites ne sont plus équivalents', (t) => {
  const [a, b] = deux(t);
  poser(a, { 'meme.html': 'pareil', 'change.html': 'version A', 'ancien/page.html': 'a', 'solo-a.txt': 'seul' });
  poser(b, { 'meme.html': 'pareil', 'change.html': 'version B plus longue', 'nouveau/page.html': 'b' });
  const r = comparerSites(a, b);
  assert.equal(r.identiques, 1);
  assert.deepEqual(r.differents.exemples, [{ fichier: 'change.html', octets_a: 9, octets_b: 21 }]);
  assert.deepEqual(r.seulement_a.exemples.map((e) => e.fichier).sort(), ['ancien/page.html', 'solo-a.txt']);
  assert.deepEqual(r.seulement_b.exemples, [{ fichier: 'nouveau/page.html', octets: 1 }]);
  assert.deepEqual([r.differents.nombre, r.seulement_a.nombre, r.seulement_b.nombre], [1, 2, 1]);
  assert.equal(r.equivalents, false);
  assert.equal(r.variables.nombre, 0);
});

test('les listes sont plafonnées, les nombres restent exacts', (t) => {
  const [a, b] = deux(t);
  for (let i = 0; i < 7; i += 1) {
    poser(a, { [`p${i}.html`]: `a${i}` });
    poser(b, { [`p${i}.html`]: `b${i}`, [`b-seul-${i}.html`]: 'x' });
  }
  const r = comparerSites(a, b, { exemples: 3 });
  assert.equal(r.differents.nombre, 7);
  assert.equal(r.differents.exemples.length, 3);
  assert.equal(r.seulement_b.nombre, 7);
  assert.equal(r.seulement_b.exemples.length, 3);
  assert.ok(EXEMPLES_PAR_DEFAUT >= 1);
  assert.equal(comparerSites(a, b).differents.exemples.length, 7, 'le plafond par défaut couvre 7 exemples');
});

test('la base publiée de même contenu sous une autre forme est une variation de fabrication, pas une différence ; un contenu différent reste une différence', (t) => {
  const [a, b] = deux(t);
  const lignes = [[1, 'un'], [2, 'deux']];
  baseDEssai(join(a, PUBLIEE), lignes);
  baseDEssai(join(b, PUBLIEE), lignes, { autreForme: true });
  assert.notEqual(listerLesFichiers(a).get(PUBLIEE).sha256, listerLesFichiers(b).get(PUBLIEE).sha256, 'les octets diffèrent');
  assert.equal(empreintesDeLaBase(join(a, PUBLIEE)).contenu, empreintesDeLaBase(join(b, PUBLIEE)).contenu);
  const r = comparerSites(a, b);
  assert.equal(r.differents.nombre, 0);
  assert.equal(r.variables.nombre, 1);
  assert.equal(r.equivalents, true);
  assert.deepEqual(r.variables.exemples.map((e) => e.fichier), [PUBLIEE]);
  assert.equal(Object.values(r.variables.par_cause)[0], 1);

  const [c, d] = deux(t);
  baseDEssai(join(c, PUBLIEE), lignes);
  baseDEssai(join(d, PUBLIEE), [[1, 'un'], [2, 'DEUX']], { autreForme: true });
  const autre = comparerSites(c, d);
  assert.deepEqual(autre.differents.exemples.map((e) => e.fichier), [PUBLIEE], 'une ligne changée n’est jamais une variation');
  assert.equal(autre.equivalents, false);
});

test('une base publiée qui porte des lignes propres au site (fiches, comptes) d’un seul côté reste une différence ; les mêmes lignes des deux côtés, ou aucune, non', (t) => {
  const lignes = [[1, 'un']];
  const [a, b] = deux(t);
  baseDEssai(join(a, PUBLIEE), lignes);
  baseDEssai(join(b, PUBLIEE), lignes, { autreForme: true, propres: [[1, 'compte']] });
  const r = comparerSites(a, b);
  assert.deepEqual(r.differents.exemples.map((e) => e.fichier), [PUBLIEE]);
  assert.equal(r.variables.nombre, 0);
  assert.equal(r.equivalents, false);

  const [c, d] = deux(t);
  baseDEssai(join(c, PUBLIEE), lignes, { propres: [[1, 'compte']] });
  baseDEssai(join(d, PUBLIEE), lignes, { autreForme: true, propres: [[1, 'compte']] });
  assert.equal(comparerSites(c, d).variables.nombre, 1, 'mêmes lignes propres au site des deux côtés');
});

test('la règle ne vaut que pour la base publiée : tout autre fichier .db, ou un fichier qui n’est pas une base, qui diffère reste une différence', (t) => {
  const [a, b] = deux(t);
  baseDEssai(join(a, 'donnees', 'autre.db'), [[1, 'un']]);
  baseDEssai(join(b, 'donnees', 'autre.db'), [[1, 'un']], { autreForme: true });
  poser(a, { [PUBLIEE]: 'un texte' });
  poser(b, { [PUBLIEE]: 'un autre texte' });
  assert.equal(empreintesDeLaBase(join(a, PUBLIEE)), null);
  const r = comparerSites(a, b);
  assert.deepEqual(r.differents.exemples.map((e) => e.fichier).sort(), ['donnees/autre.db', PUBLIEE]);
  assert.equal(r.variables.nombre, 0);
});

test('la base de référence de la production, que seul un côté fabrique (lue dans git), est une variation attendue ; le reste absent d’un côté ne l’est pas', (t) => {
  const [a, b] = deux(t);
  poser(a, { 'index.html': 'x', 'donnees/reference.db': 'ref', 'donnees/reference.json': '{}', 'donnees/autre.db': 'y' });
  poser(b, { 'index.html': 'x' });
  const r = comparerSites(a, b);
  assert.equal(r.variables.nombre, 2);
  assert.deepEqual(r.seulement_a.exemples.map((e) => e.fichier), ['donnees/autre.db']);
  assert.equal(r.equivalents, false);
  const sansAutre = comparerSites(poser(dossierTemporaire('comparaison-c', { t }), { 'index.html': 'x', 'donnees/reference.db': 'ref' }), b);
  assert.equal(sansAutre.equivalents, true);
});

test('un lien symbolique n’est pas suivi ; la taille d’un dossier compte ses fichiers ordinaires', (t) => {
  const [a] = deux(t);
  poser(a, { 'a.txt': '123', 'sous/b.txt': '45' });
  symlinkSync(join(a, 'a.txt'), join(a, 'lien.txt'));
  assert.deepEqual(parcourir(a).map((f) => f.rel), ['a.txt', 'sous/b.txt']);
  assert.deepEqual(tailleDuDossier(a), { fichiers: 2, octets: 5 });
});

test('le script : bilan, rapport JSON complet, code 0 si les sites sont équivalents, 1 sinon, 2 si l’usage est faux', (t) => {
  const [a, b] = deux(t);
  const sortie = dossierTemporaire('comparaison-json', { t });
  poser(a, { 'index.html': 'x', 'p.html': '1' });
  poser(b, { 'index.html': 'x', 'p.html': '2' });
  const json = join(sortie, 'sous', 'rapport.json');
  const r = spawnSync(process.execPath, ['--no-warnings', SCRIPT, a, b, '--json', json, '--exemples', '1'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /différents 1/);
  const rapport = JSON.parse(readFileSync(json, 'utf8'));
  assert.equal(rapport.format, FORMAT_COMPARAISON);
  assert.equal(rapport.differents.nombre, 1);
  assert.deepEqual(rapport, comparerSites(a, b, { exemples: 1 }));

  poser(b, { 'p.html': '1' });
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT, a, b], { encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT, a], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT, a, join(sortie, 'absent')], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT, a, b, '--exemples', 'x'], { encoding: 'utf8' }).status, 2);
});
