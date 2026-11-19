// Les contrôles d'activation d'un kit par la production (lot 11, PR 5a ; scripts/activation-controles.mjs, serveur/activation.mjs ; docs/serveur.md, « Bascule 2 : préparation », « PR 5a »),
// dans le conteneur sans privilège de deploy/installateur/activer.sh : le paquet (empreinte, structure, version, mode, fichier de contenu), le contenu réel (garde-fou 18), l'activation
// (garde-fou 17), la base de la production refaite avec ses fiches sur une copie. Des comptes seulement : les fiches sentinelles ne sortent jamais. Le shell est éprouvé par deploy-activer.test.mjs.
//   node --test test/activation-controles.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { controlerLActivationDuKit, resultatPourRoot, texteDesControles } from '../scripts/activation-controles.mjs';
import { lireReference } from '../serveur/notes-de-version.mjs';
import { fabriquerPaquet } from '../serveur/paquet.mjs';
import { CIBLE, creerMonde, DEV, ligneOrpheline, metierRetire, PROD, raceAbsente, sansMarque, sha, STRUCTURE } from './aide-repetition-bascule-2.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/activation-controles.mjs', import.meta.url));
const SCHEMA = fileURLToPath(new URL('../../data/schema.sql', import.meta.url));
const INSTANT = new Date('2026-11-20T10:00:00Z');

/** Un monde, et le paquet de la mise à jour (mode `mise-a-jour`) fabriqué comme le fait le bouton, que le kit annonce par son empreinte. */
function monde(t, { changerDev, changerCopie, version = CIBLE, depuis = '9.0', mode = 'mise-a-jour' } = {}) {
  const m = creerMonde(t, changerDev, changerCopie);
  const reference = lireReference({ production: m.production, propre: null });
  const paquet = join(m.travail, 'contenu', 'paquet.db');
  mkdirSync(join(m.travail, 'contenu'), { recursive: true });
  fabriquerPaquet({ source: m.dev, destination: paquet, production: reference.chemin, id: '00000000-0000-4000-8000-000000000001', mode, version, depuis, versionDuSite: DEV, instant: INSTANT });
  const empreinte = sha(paquet);
  m.paquet = paquet;
  m.kit = { version: DEV, structure: STRUCTURE, paquet: { version, empreinte, structure: STRUCTURE } };
  m.controler = (surcharge = {}) => controlerLActivationDuKit({ travail: m.travail, paquet, kit: m.kit, production: m.production, schema: SCHEMA, instant: INSTANT, ...surcharge });
  return m;
}

test('PASSERAIT : le paquet est celui que le kit annonce, de sa structure, plus récent que la production ; la base de la production est refaite avec ses fiches ; aucun nom de fiche', (t) => {
  const m = monde(t, { changerCopie: metierRetire });
  const avant = sha(m.copie);
  const x = m.controler();
  assert.equal(x.verdict, 'passe', JSON.stringify(x.refus));
  assert.deepEqual(x.raisons, []);
  assert.equal(x.depuis, '9.0');
  assert.deepEqual([x.paquet.version, x.paquet.schema, x.paquet.empreinte], [CIBLE, STRUCTURE, m.kit.paquet.empreinte]);
  assert.equal(x.contenu.problemes, 0);
  assert.equal(x.activation.ok, true);
  assert.equal(x.base.verdict, 'passera');
  assert.equal(x.base.base.fiches_apres, 2, 'aucune fiche perdue');
  assert.notEqual(sha(m.copie), avant, 'seule la copie est refaite');
  const texte = texteDesControles(x);
  assert.match(texte, /^contrôles : l’activation PASSERAIT \(kit V9\.1\.4, paquet V9\.2, depuis la V9\.0\)/);
  assert.match(texte, /adaptées \(metier\) : 2 fiche\(s\), 2 élément\(s\)/);
  sansMarque(texte, m.marques);
  sansMarque(JSON.stringify(x), m.marques);
  sansMarque(resultatPourRoot(x), m.marques);
});

test('le résultat que lit root : un mot par ligne, des mots et des nombres seulement (jamais un texte)', (t) => {
  const m = monde(t);
  const ok = resultatPourRoot(m.controler());
  assert.match(ok, /^\{\n {2}"format": "maverick-activation-controles\/1",\n {2}"verdict": "passe",\n {2}"raisons": \[\],\n {2}"version_du_paquet": "9\.2",\n/);
  assert.match(ok, /\n {2}"empreinte_du_paquet": "[0-9a-f]{64}",\n/);
  const refus = resultatPourRoot(m.controler({ kit: { ...m.kit, paquet: { ...m.kit.paquet, empreinte: 'a'.repeat(64) } } }));
  assert.match(refus, /"verdict": "refuse",\n {2}"raisons": \["empreinte"\],/);
  for (const ligne of refus.split('\n')) assert.ok(!/[«»]/.test(ligne) && ligne.length < 160, ligne);
  JSON.parse(refus);
});

test('REFUSEE `empreinte` : le paquet reçu n’est pas celui que le kit annonce (garde-fou 17) ; rien d’autre n’est refait', (t) => {
  const m = monde(t);
  const avant = sha(m.copie);
  const x = m.controler({ kit: { ...m.kit, paquet: { ...m.kit.paquet, empreinte: 'b'.repeat(64) } } });
  assert.equal(x.verdict, 'refuse');
  assert.deepEqual(x.raisons, ['empreinte']);
  assert.equal(x.base, null, 'la base de la production n’est pas refaite quand un refus est déjà dit');
  assert.equal(sha(m.copie), avant);
  assert.match(texteDesControles(x), /Activation refusée \(empreinte\) : le paquet reçu a l’empreinte [0-9a-f]{12}…, le kit v9\.1\.4 annonce bbbbbbbbbbbb…/);
});

test('REFUSEE `kit_sans_paquet` : aucun paquet trouvé (le kit n’en annonce pas, ou il est absent de la production)', (t) => {
  const m = monde(t);
  const x = m.controler({ paquet: null });
  assert.deepEqual(x.raisons, ['kit_sans_paquet']);
  assert.equal(x.paquet, null);
  assert.match(texteDesControles(x), /paquet reçu : aucun/);
  assert.deepEqual(m.controler({ paquet: null, kit: { version: DEV, structure: STRUCTURE, paquet: null } }).raisons, ['kit_sans_paquet']);
});

test('REFUSEE `structure` (le kit d’une autre structure) et `note_manquante` (une note de version que la production a déjà et que le paquet n’a pas) : tout se dit d’un coup', (t) => {
  const m = monde(t, { changerCopie: (db) => db.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('8.8', '2026-01-01', NULL, NULL, NULL, 0)").run() });
  const x = m.controler({ kit: { ...m.kit, structure: STRUCTURE + 1 } });
  assert.deepEqual(x.raisons.sort(), ['note_manquante', 'structure']);
  assert.match(texteDesControles(x), /Activation refusée \(note_manquante\) : .*V8\.8/);
});

test('REFUSEE `version_en_arriere` : un paquet qui n’est pas plus récent que la production', (t) => {
  const m = monde(t, { version: '8.9' });
  const x = m.controler();
  assert.deepEqual(x.raisons, ['version_en_arriere']);
  assert.match(texteDesControles(x), /le paquet est de la V8\.9, la production est déjà à la V9\.0/);
});

test('REFUSEE `paquet_irregulier` : un paquet de simulation (ce n’est pas celui d’une mise à jour), un fichier qui n’est pas une base, une structure autre que celle du kit', (t) => {
  const simulation = monde(t, { mode: 'simulation' });
  assert.deepEqual(simulation.controler().raisons, ['paquet_irregulier']);
  assert.match(texteDesControles(simulation.controler()), /le paquet est de mode « simulation »/);
  const m = monde(t);
  const autre = join(m.travail, 'contenu', 'pas-une-base.db');
  writeFileSync(autre, 'ceci n’est pas du SQLite');
  const x = m.controler({ paquet: autre });
  assert.equal(x.verdict, 'refuse', 'un fichier illisible est un refus, pas un échec des contrôles');
  assert.ok(x.raisons.includes('paquet_irregulier') && x.raisons.includes('empreinte'), JSON.stringify(x.raisons));
  assert.equal(x.base, null);
  assert.match(texteDesControles(x), /le paquet n’est pas un fichier de contenu valide/);
});

test('REFUSEE `contenu` (garde-fou 18) : une ligne orpheline, nommée par table, identifiant et règle, sans texte', (t) => {
  const m = monde(t, { changerDev: ligneOrpheline });
  const x = m.controler();
  assert.ok(x.raisons.includes('contenu'), JSON.stringify(x.raisons));
  assert.deepEqual(x.contenu.nommes.find((p) => p.table === 'ecart_source'), { table: 'ecart_source', id: 'metier:zz-absent', regle: 'entite_adressee' });
  assert.match(texteDesControles(x), /problème du contenu : ecart_source metier:zz-absent \(règle entite_adressee\)/);
  assert.equal(texteDesControles(x).includes('essai'), false, 'le texte de la ligne ne sort pas');
});

test('REFUSEE `fiches` : les fiches de la production ne passent pas dans ce contenu (une race absente n’est pas un retrait de R42) ; la production garderait sa base', (t) => {
  const m = monde(t, { changerCopie: raceAbsente });
  const x = m.controler();
  assert.deepEqual(x.raisons, ['fiches']);
  assert.equal(x.base.verdict, 'refusee');
  const texte = texteDesControles(x);
  assert.match(texte, /base de la production : NON refaite/);
  sansMarque(texte, m.marques);
  sansMarque(resultatPourRoot(x), m.marques);
});

test('correctif urgent : le paquet EN PLACE (la version de la production) passe, avec les mêmes contrôles ; sans --correctif, « la même version » est refusée', (t) => {
  const m = monde(t, { version: '9.0' });
  assert.deepEqual(m.controler().raisons, ['version_en_arriere']);
  const x = m.controler({ correctif: true });
  assert.equal(x.verdict, 'passe', JSON.stringify(x.refus));
  assert.equal(x.correctif, true);
  assert.match(texteDesControles(x), /correctif urgent/);
  // les autres contrôles restent : la structure du kit doit être celle du paquet en place
  assert.deepEqual(m.controler({ correctif: true, kit: { ...m.kit, structure: STRUCTURE + 1 } }).raisons, ['structure']);
  // un paquet plus ancien que la production reste refusé
  const ancien = monde(t, { version: '8.9' });
  assert.deepEqual(ancien.controler({ correctif: true }).raisons, ['version_en_arriere']);
});

test('ligne de commande : code 0 (passe), 1 (refusée), 2 (usage, copie absente) ; le résultat est écrit en entier, sans provisoire', (t) => {
  const m = monde(t);
  const resultat = join(m.travail, 'resultats-controles.json');
  const args = (plus = []) => [SCRIPT, '--travail', m.travail, '--resultat', resultat, '--kit-version', DEV, '--kit-structure', String(STRUCTURE), '--paquet', m.paquet, '--production', m.production,
    '--schema', SCHEMA, '--kit-paquet-version', CIBLE, '--kit-paquet-empreinte', m.kit.paquet.empreinte, '--kit-paquet-structure', String(STRUCTURE), ...plus];
  const lancer = (a) => spawnSync(process.execPath, ['--no-warnings', ...a], { encoding: 'utf8' });
  let r = lancer(args());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(readFileSync(resultat, 'utf8')).verdict, 'passe');
  assert.match(r.stdout, /l’activation PASSERAIT/);
  const m2 = monde(t);
  const resultat2 = join(m2.travail, 'resultats-controles.json');
  r = lancer([SCRIPT, '--travail', m2.travail, '--resultat', resultat2, '--kit-version', DEV, '--kit-structure', String(STRUCTURE), '--paquet', m2.paquet, '--production', m2.production, '--schema', SCHEMA,
    '--kit-paquet-version', CIBLE, '--kit-paquet-empreinte', 'c'.repeat(64)]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(resultat2, 'utf8')).raisons, ['empreinte']);
  assert.equal(lancer([SCRIPT, '--travail', m.travail]).status, 2, 'usage');
  assert.equal(lancer([SCRIPT, '--travail', m.d('vide'), '--resultat', resultat, '--kit-version', DEV, '--kit-structure', '1']).status, 2, 'copie absente');
  assert.equal(lancer([SCRIPT, '--inconnue']).status, 2);
  assert.deepEqual(spawnSync('sh', ['-c', `ls -a "${m.travail}" | grep -c 'tmp$' || true`], { encoding: 'utf8' }).stdout.trim(), '0');
});

test('la version de la production de l’essai est celle du leurre (constante de l’aide), la prochaine livraison la suit', () => {
  assert.equal(PROD, '9.0.0');
  assert.equal(CIBLE, '9.2');
});
