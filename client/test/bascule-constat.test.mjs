// Le constat d'égalité du jour de la bascule 1 (client/scripts/constat-de-bascule.mjs ; lot 8 du chantier de la base de dev, garde-fou 3 ; docs/serveur.md,
// « Base source (lot 8) ») : table de contenu par table de contenu, entre la production (son attestation), la base du site de dev et le dépôt ; hors compte, les
// tables propres au site et calculées, et les pages d'exemple. Il ne sort que des noms de tables et des comptes, jamais un contenu. Bases d'essai minimes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { constater, texteDuConstat } from '../scripts/constat-de-bascule.mjs';
import { empreintesDuContenu } from '../serveur/empreintes.mjs';
import { CONSTAT_DE_BASCULE, FICHIERS_JOINTS, modulesDuServeur } from '../serveur/livraison.mjs';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { marquesDesFiches, poserDesFiches } from './aide-fiches-sentinelles.mjs';
import { baseDesRegles } from './aide-structure-sur-place.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/constat-de-bascule.mjs', import.meta.url));
const SECRET = 'Texte de contenu sentinelle qui ne sort jamais';
const SCHEMA = `
CREATE TABLE famille (id TEXT PRIMARY KEY, libelle TEXT NOT NULL) STRICT;
CREATE TABLE page (id TEXT PRIMARY KEY, statut TEXT NOT NULL, corps_md TEXT NOT NULL) STRICT;
CREATE TABLE alias (page_id TEXT NOT NULL REFERENCES page(id), ordre INTEGER NOT NULL, texte TEXT NOT NULL, PRIMARY KEY (page_id, ordre)) STRICT;
CREATE TABLE personnage (id TEXT PRIMARY KEY, nom TEXT) STRICT;
CREATE TABLE lien (de TEXT, vers TEXT) STRICT;
CREATE TABLE modification (lot_id TEXT, rang INTEGER, etat TEXT) STRICT;
INSERT INTO famille VALUES ('docs', '${SECRET}'), ('magies', 'Magies');
INSERT INTO page VALUES ('guide/a', 'verified', 'A'), ('guide/b', 'draft', 'B');
INSERT INTO alias VALUES ('guide/a', 1, 'alpha');
`;

/** Une base d'essai dans `dossier` : le schéma minime, puis `sql`. */
function base(dossier, nom, sql = '') {
  const chemin = join(dossier, nom);
  const db = new DatabaseSync(chemin);
  db.exec(SCHEMA + sql);
  db.close();
  return chemin;
}
/** L'attestation de la production pour une base (le contenu de sa base vivante), `o` remplace des champs. */
function attestation(chemin, o = {}) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    const e = empreintesDuContenu(db);
    return { format: 'maverick-attestation/1', version: { service: '0.4.98' }, base_vivante: { empreinte: e.global, tables: e.tables }, preparation: { appliquee: true, problemes: 0 }, ...o };
  } finally {
    db.close();
  }
}
const monde = (t) => {
  const d = dossierTemporaire('constat', { t });
  return { d, depot: base(d, 'depot.db'), prod: base(d, 'prod.db') };
};

test('les trois bases au même contenu : EGALITE ; fiches, journal et tables calculées hors compte', (t) => {
  const m = monde(t);
  const dev = base(m.d, 'dev.db', "INSERT INTO personnage VALUES ('p1', 'Fiche'); INSERT INTO lien VALUES ('a', 'b'); INSERT INTO modification VALUES ('l', 1, 'integree');");
  const c = constater({ base: dev, regles: m.depot, attestation: attestation(m.prod), versionProduction: '0.4.98' });
  assert.equal(c.egalite, true, texteDuConstat(c));
  assert.equal(c.tables_comparees, 3, 'famille, page et alias : les seules tables de contenu');
  assert.deepEqual(c.differences, []);
  assert.match(c.empreinte, /^[0-9a-f]{64}$/);
  assert.match(texteDuConstat(c), /^EGALITE 3 table/);
});

test('une page d’exemple de plus sur le site de dev (et la ligne qui la cite) : égalité hors pages d’exemple', (t) => {
  const m = monde(t);
  const dev = base(m.d, 'dev.db', "INSERT INTO page VALUES ('exemples/x', 'example', 'X'); INSERT INTO alias VALUES ('exemples/x', 1, 'x');");
  const c = constater({ base: dev, regles: m.depot, attestation: attestation(m.prod) });
  assert.equal(c.egalite, true, texteDuConstat(c));
  assert.deepEqual(c.hors_exemples, ['alias', 'page']);
  // une page qui n'est pas d'exemple, elle, compte
  const autre = base(m.d, 'dev2.db', "INSERT INTO page VALUES ('guide/c', 'draft', 'C');");
  const c2 = constater({ base: autre, regles: m.depot, attestation: attestation(m.prod) });
  assert.equal(c2.egalite, false);
  assert.deepEqual(c2.differences.map((x) => [x.table, x.raison, x.production, x.dev, x.depot]), [['page', 'le site de dev diffère', 2, 3, 2]]);
});

test('une table qui diffère : nommée avec ses comptes, jamais son contenu ; la sortie du script le dit en code 1', (t) => {
  const m = monde(t);
  const dev = base(m.d, 'dev.db', "UPDATE famille SET libelle = 'Autre' WHERE id = 'magies';");
  const fichier = join(m.d, 'attestation-prod.json');
  writeFileSync(fichier, JSON.stringify(attestation(m.prod)));
  const c = constater({ base: dev, regles: m.depot, attestation: attestation(m.prod) });
  assert.deepEqual(c.differences.map((x) => x.table), ['famille']);
  const r = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--base', dev, '--regles', m.depot, '--attestation', fichier], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stdout, /^DIFFERENCES 1 table\(s\) sur 3/);
  assert.match(r.stdout, /table famille : le site de dev diffère \(production 2 ligne\(s\), site de dev 2 ligne\(s\), dépôt 2 ligne\(s\)\)/);
  assert.ok(!r.stdout.includes(SECRET) && !r.stdout.includes('Autre'), 'aucun contenu dans la sortie');
  // la production qui diffère seule
  const p = constater({ base: m.depot, regles: m.depot, attestation: attestation(dev) });
  assert.deepEqual(p.differences.map((x) => [x.table, x.raison]), [['famille', 'la production diffère']]);
});

test('attestation absente, périmée ou d’une préparation ratée, journal non résolu : pas d’égalité, la raison dite', (t) => {
  const m = monde(t);
  const dev = base(m.d, 'dev.db', "INSERT INTO modification VALUES ('l', 1, 'conflit');");
  const c = constater({ base: dev, regles: m.depot, attestation: attestation(m.prod, { preparation: { appliquee: false } }), versionProduction: '0.4.99' });
  assert.equal(c.egalite, false);
  assert.deepEqual(c.differences, []);
  assert.equal(c.problemes.length, 3, c.problemes.join('\n'));
  assert.ok(c.problemes.some((p) => /attestation périmée : .*0\.4\.98.*0\.4\.99/.test(p)));
  assert.ok(c.problemes.some((p) => /1 modification\(s\) du journal/.test(p)));
  const sans = constater({ base: m.depot, regles: m.depot, attestation: null });
  assert.equal(sans.egalite, false);
  assert.ok(sans.problemes.some((p) => /attestation de la production absente/.test(p)));
  // le script : la version publiée par la production est lue dans son _serveur/version.json ; fichiers manquants : code 2
  const production = join(m.d, 'production');
  mkdirSync(join(production, '_serveur'), { recursive: true });
  writeFileSync(join(production, '_serveur', 'version.json'), JSON.stringify({ version: '0.4.98' }));
  const fichier = join(m.d, 'attestation-prod.json');
  writeFileSync(fichier, JSON.stringify(attestation(m.prod)));
  const ok = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--base', m.depot, '--regles', m.depot, '--attestation', fichier, '--production', production], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /^EGALITE[^\n]*\nEMPREINTE [0-9a-f]{64}\n?$/);
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--base', join(m.d, 'absente.db'), '--regles', m.depot], { encoding: 'utf8' }).status, 2);
});

test('livré avec le service : le script est joint à _serveur/ et n’importe que des modules livrés', () => {
  assert.ok(FICHIERS_JOINTS.some((f) => f.source === CONSTAT_DE_BASCULE && f.cible === CONSTAT_DE_BASCULE));
  const livres = new Set(modulesDuServeur());
  const avecLui = modulesDuServeur(undefined, CONSTAT_DE_BASCULE).filter((m) => m !== CONSTAT_DE_BASCULE);
  assert.deepEqual(avecLui.filter((m) => !livres.has(m)), [], 'chaque module qu’il importe est déjà livré par le service');
});

test('aucune donnée de joueur ne sort : fiches, compte et groupe sentinelles dans la base du site de dev, absents de la sortie (texte et JSON)', (t) => {
  const d = dossierTemporaire('constat-sentinelles', { t });
  const dev = join(d, 'vivante.db');
  copyFileSync(baseDesRegles(), dev);
  const db = ouvrirBaseVivante(dev);
  let poses;
  try {
    poses = poserDesFiches(db);
  } finally {
    db.close();
  }
  const fichier = join(d, 'attestation-prod.json');
  writeFileSync(fichier, JSON.stringify(attestation(baseDesRegles())));
  for (const format of [[], ['--json']]) {
    const r = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--base', dev, '--regles', baseDesRegles(), '--attestation', fichier, ...format], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const marque of marquesDesFiches(poses)) assert.ok(!`${r.stdout}${r.stderr}`.includes(marque), `« ${marque} » absent de la sortie`);
  }
});
