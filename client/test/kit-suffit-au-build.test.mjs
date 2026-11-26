// Le kit de l'atelier suffit au build (lot 12, PR 6 ; deploy/installateur/kit.mjs#A_EMPORTER ; docs/serveur.md, « Atelier du site de dev »). Tout fichier que lit le build du site
// doit être dans le kit, sinon la fabrication sur le serveur casse alors que la CI, qui a tout le dépôt, reste verte (incident de la PR #414 : `sources/copies-drive.json`, lu par
// la page Archives, n'était pas emporté : « ENOENT … /travail/kit/sources/copies-drive.json »).
// Voie : la fabrication RÉELLE, pas une trace des lectures. Le kit est fait par `fabriquerLeKit` (lecture seule du dépôt : ses règles d'emport, d'exclusion et d'élagage), décompressé
// dans un dossier jetable HORS du dépôt (ni `MAVERICK_ROOT`, ni `trouverRacine`, ni `node_modules` ne mènent au vrai dépôt), puis `scripts/fabriquer-depuis-contenu.mjs` y est lancé
// comme `atelier/conteneur.sh` le lance (HIDE_EXAMPLES=1, SITE_MODE=test), sur un contenu fourni (MAVERICK_CONTENU si posé, sinon l'extrait d'essai), mis d'abord à la structure du code (une migration de la PR s'y applique). Un fichier absent est nommé.
// Deuxième garde (passe S de l'essai mécanique, R296) : le même build dans un kit privé de tout ce qui sortira du dépôt le jour J (`scripts/inventaire-sortie-du-contenu-lib.mjs#listerCeQuiSort`,
// sans les migrations mixtes, dont le sort est une question ouverte) réussit, et le site fabriqué n'en diffère que par les migrations livrées au service (`_serveur/data/migrations/`) et
// l'empreinte de `_serveur/version.json` : aucune page ne lit ce qui sort. (Avec les mixtes, `fiche/regles.json` perd les `noms_d_avant` de 24 sorts : le registre de la 0117 les porte.)
// Deux builds complets (environ une minute en tout) : un seul passage par fichier. Nécessite Linux (comme le kit), tar et gzip ; sinon le test est ignoré (convention deploy-*).
//   node --test test/kit-suffit-au-build.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { A_EMPORTER, ARCHIVE_DU_KIT, fabriquerLeKit } from '../../deploy/installateur/kit.mjs';
import { preparerLeContenu } from '../scripts/db-preparer-contenu.mjs';
import { cheminsQuiSortent, listerCeQuiSort } from '../scripts/inventaire-sortie-du-contenu-lib.mjs';
import { comparerSites } from '../serveur/comparaison-de-sites.mjs';
import { VARIABLE_DU_CONTENU } from '../src/lib/contenu-fourni.mjs';
import { extraitDEssai } from './aide-contenu-fourni.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const DEPOT = fileURLToPath(new URL('../..', import.meta.url));
const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = (process.platform !== 'linux' && 'le kit se fabrique sous Linux') || (!(have('tar') && have('gzip') && have('cp')) && 'tar, gzip ou cp indisponible');
/** Ce que le service livré porte de `data/migrations` : la seule différence admise entre le site du kit complet et celui du kit privé de ce qui sort. */
const MIGRATIONS_LIVREES = '_serveur/data/migrations/';
const FICHIER_D_EMPREINTE = '_serveur/version.json';

/** Les fichiers qu'une erreur ENOENT du build nomme (chemins absolus, tels qu'écrits par Node : « ENOENT: no such file or directory, open '/…' »). */
export function fichiersAbsentsDe(sortie) {
  const trouves = new Set();
  for (const m of String(sortie).matchAll(/ENOENT[^\n']*'([^'\n]+)'/g)) trouves.add(m[1]);
  return [...trouves];
}

/** Le message d'échec : le fichier lu par le build et absent du kit (chemin relatif à la racine du kit), ou à défaut la fin de la sortie. */
export function messageDeLEchec(sortie, racine, quoi = 'le kit') {
  const absents = fichiersAbsentsDe(sortie)
    .map((chemin) => relative(racine, chemin).split('\\').join('/'))
    .filter((rel) => rel && !rel.startsWith('..') && !isAbsolute(rel));
  if (absents.length) {
    return `le build lit ${absents.map((a) => `« ${a} »`).join(', ')}, que ${quoi} n'emporte pas : l'ajouter à A_EMPORTER (deploy/installateur/kit.mjs) et à INDISPENSABLES\n${String(sortie).slice(-1500)}`;
  }
  return `la fabrication depuis ${quoi} a échoué sans fichier absent nommé :\n${String(sortie).slice(-3000)}`;
}

test('messageDeLEchec nomme le fichier du kit que le build n’a pas trouvé', () => {
  const sortie = "Fabrication en échec (étape build) : build a échoué (code 1) : fin de stderr : Error: ENOENT: no such file or directory, open '/travail/kit/sources/copies-drive.json'\n    at lireJson";
  assert.deepEqual(fichiersAbsentsDe(sortie), ['/travail/kit/sources/copies-drive.json']);
  assert.match(messageDeLEchec(sortie, '/travail/kit'), /« sources\/copies-drive\.json »/);
  // un fichier hors du kit n'est pas pris pour un fichier du kit
  assert.doesNotMatch(messageDeLEchec("ENOENT: no such file or directory, open '/etc/hosts-absent'", '/travail/kit'), /« /);
});

const memo = (fabrique) => { let resultat; return () => (resultat ??= (() => { try { return { valeur: fabrique() }; } catch (erreur) { return { erreur }; } })()); };
const lire = (resultat) => { if (resultat.erreur) throw resultat.erreur; return resultat.valeur; };

/**
 * La racine d'où se fait le kit : le dépôt, sauf quand `client/node_modules` y est un lien (les copies de l'essai mécanique, scripts/essai-mecanique-tests.mjs) : un kit ne porte aucun lien qui
 * sorte de lui (kit.mjs#controlerLeKit). Une copie de ce que le kit emporte, `node_modules` réel, tient alors lieu de dépôt.
 */
function racineDuKit(travail) {
  const modules = join(DEPOT, 'client', 'node_modules');
  if (!lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink()) return DEPOT;
  const miroir = join(travail, 'depot');
  for (const rel of A_EMPORTER) {
    mkdirSync(join(miroir, ...rel.split('/').slice(0, -1)), { recursive: true });
    const cp = spawnSync('cp', ['-a', join(DEPOT, rel), join(miroir, rel)], { encoding: 'utf8' });
    assert.equal(cp.status, 0, cp.stderr);
  }
  rmSync(join(miroir, 'client', 'node_modules'), { force: true });
  const reel = spawnSync('cp', ['-a', realpathSync(modules), join(miroir, 'client', 'node_modules')], { encoding: 'utf8' });
  assert.equal(reel.status, 0, reel.stderr);
  return miroir;
}

/** Le dossier jetable du fichier (hors du dépôt, supprimé à la sortie du processus) et le kit pristine décompressé, copié une fois pour la variante « S ». */
const monde = memo(() => {
  const travail = dossierTemporaire('kit-suffit-au-build');
  assert.ok(relative(DEPOT, travail).startsWith('..'), `le dossier jetable ${travail} est dans le dépôt`);
  const sortieKit = join(travail, 'sortie');
  // fabriquerLeKit pose son dossier de travail dans os.tmpdir() et le supprime lui-même en sortant
  fabriquerLeKit({ racine: racineDuKit(travail), destination: sortieKit, version: '0.0.0-essai', sha: '0'.repeat(40) });
  const kit = join(travail, 'complet', 'kit');
  mkdirSync(kit, { recursive: true });
  const tar = spawnSync('tar', ['-xzf', join(sortieKit, ARCHIVE_DU_KIT), '-C', kit], { encoding: 'utf8' });
  assert.equal(tar.status, 0, tar.stderr);
  // la variante S : une copie du kit AVANT tout build (le build écrit dans le kit : src/content/wiki, .astro, node_modules/.vite), privée de ce qui sortira du dépôt
  const kitS = join(travail, 'sans-le-contenu', 'kit');
  mkdirSync(join(travail, 'sans-le-contenu'), { recursive: true });
  const cp = spawnSync('cp', ['-a', kit, kitS], { encoding: 'utf8' });
  assert.equal(cp.status, 0, cp.stderr);
  const retires = cheminsQuiSortent(listerCeQuiSort({ racine: DEPOT }), { avecMixtes: false });
  for (const chemin of retires) rmSync(join(kitS, ...chemin.split('/')), { force: true });
  const fourni = String(process.env[VARIABLE_DU_CONTENU] ?? '').trim() || extraitDEssai();
  const contenu = join(travail, 'contenu.db');
  copyFileSync(fourni, contenu);
  // Le contenu fourni est mis à la structure du code, comme partout ailleurs (lib/donnees.mjs#ouvrirBase) : un extrait du site de dev reste à la structure d'avant une migration que la PR apporte,
  // et le contrôle de la fabrication (serveur/fichier-de-contenu.mjs) exige celle du code livré. Sans exemples : le build de ce test est HIDE_EXAMPLES=1. Le fichier fourni n'est pas touché (c'est la copie).
  preparerLeContenu(contenu, { racine: DEPOT, exemples: false });
  return { travail, kit, kitS, contenu, retires };
});

/** Fabrique le site depuis `kit`, comme atelier/conteneur.sh (dans client/ du kit ; lancer.sh : HIDE_EXAMPLES=1, SITE_MODE=test, SITE_BASE=/), sans rien de ce que l'environnement du test sait du dépôt. */
function fabriquerDepuis(kit, travail, contenu, nom) {
  const environnement = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !/^(?:MAVERICK_|SITE_)/.test(cle) && cle !== 'OUT_DIR' && cle !== 'HIDE_EXAMPLES'));
  Object.assign(environnement, { HIDE_EXAMPLES: '1', SITE_MODE: 'test', SITE_BASE: '/', ...variablesTemporaires(travail) });
  const sortie = join(travail, `site-${nom}`);
  const r = spawnSync(process.execPath, ['--no-warnings', 'scripts/fabriquer-depuis-contenu.mjs', '--contenu', contenu, '--sortie', sortie, '--mesure', join(travail, `fabrication-${nom}.json`)], {
    cwd: join(kit, 'client'), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: environnement,
  });
  const texte = `${r.stdout ?? ''}\n${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`;
  return { status: r.status, texte, sortie, mesure: join(travail, `fabrication-${nom}.json`) };
}

const siteComplet = memo(() => {
  const m = lire(monde());
  return { ...fabriquerDepuis(m.kit, m.travail, m.contenu, 'complet'), kit: m.kit };
});

test('le kit emporte tout ce que lit le build : le site se fabrique depuis le seul contenu du kit, hors du dépôt', { skip, timeout: 900_000 }, () => {
  const r = lire(siteComplet());
  assert.equal(r.status, 0, messageDeLEchec(r.texte, r.kit));
  assert.equal(existsSync(join(r.sortie, 'index.html')), true, 'le site fabriqué n\'a pas de page d\'accueil');
  assert.equal(existsSync(join(r.sortie, 'archives', 'index.html')), true, 'la page Archives (qui lit sources/copies-drive.json) n\'est pas fabriquée');
  assert.equal(JSON.parse(readFileSync(r.mesure, 'utf8')).statut, 'ok');
});

test('passe S : privé de tout ce qui sort du dépôt (migrations de données, exports, lignes), le kit fabrique le même site, aux migrations livrées au service près', { skip, timeout: 900_000 }, () => {
  const complet = lire(siteComplet());
  assert.equal(complet.status, 0, messageDeLEchec(complet.texte, complet.kit));
  const m = lire(monde());
  const s = fabriquerDepuis(m.kitS, m.travail, m.contenu, 'sans-le-contenu');
  assert.equal(s.status, 0, `${messageDeLEchec(s.texte, m.kitS, 'le kit privé de ce qui sort (passe S)')}\n(retirés : ${m.retires.length} fichiers)`);
  const rapport = comparerSites(complet.sortie, s.sortie, { exemples: 100000 });
  // `_serveur/version.json` porte l'empreinte des fichiers livrés au service, migrations comprises : elle change avec elles
  assert.deepEqual(rapport.differents.exemples.map((e) => e.fichier).filter((f) => f !== FICHIER_D_EMPREINTE), [], 'un fichier du site change quand ce qui sort du dépôt est absent : le build le lit');
  assert.deepEqual(rapport.seulement_b.exemples.map((e) => e.fichier), []);
  // les seuls fichiers qui manquent au site sans ce qui sort sont les migrations (et registres joints) que le service livre : chacune est une des retirées, jamais une page
  const manquants = rapport.seulement_a.exemples.map((e) => e.fichier);
  const inattendus = manquants.filter((f) => !f.startsWith(MIGRATIONS_LIVREES) || !m.retires.includes(f.slice('_serveur/'.length)));
  assert.deepEqual(inattendus, [], `le build n'écrit plus ces fichiers sans ce qui sort : seules les migrations livrées au service (${MIGRATIONS_LIVREES}) peuvent manquer`);
});
