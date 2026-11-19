// Le script qui pose le site fabriqué par l'atelier à la place du site servi (scripts/poser-un-site.mjs ; lot 11 « Bascule 2 », PR 3b ; docs/serveur.md, « Bascule 2 : préparation »).
// Le vrai script, sur de vrais dossiers : copie atomique, fichiers identiques non réécrits, retrait de ce que la source n'a pas, `_serveur/` jamais touché, refus des liens, des FIFO et
// des fichiers irréguliers, garde-fous (index.html, pages au moins 90 % du site servi), résumé JSON, codes de sortie.
//   node --test test/poser-un-site.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CODES, poserUnSite, RefusDePose } from '../scripts/poser-un-site.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/poser-un-site.mjs', import.meta.url));
const racine = dossierTemporaire('poser-un-site');
let n = 0;
const ecrire = (chemin, contenu) => { mkdirSync(dirname(chemin), { recursive: true }); writeFileSync(chemin, contenu); };
/** Un monde : le site servi (avec son `_serveur/`) et le site fabriqué, chacun { chemin: contenu }. */
function monde({ servi = {}, fabrique = {} } = {}) {
  const dossier = join(racine, `m${(n += 1)}`);
  const cible = join(dossier, 'site');
  const source = join(dossier, 'sortie', 'site');
  mkdirSync(cible, { recursive: true });
  mkdirSync(source, { recursive: true });
  ecrire(join(cible, '_serveur', 'serveur', 'index.mjs'), 'code du service');
  ecrire(join(cible, '_serveur', 'version.json'), '{"v":1}');
  for (const [rel, contenu] of Object.entries(servi)) ecrire(join(cible, rel), contenu);
  for (const [rel, contenu] of Object.entries(fabrique)) ecrire(join(source, rel), contenu);
  return { dossier, cible, source, resume: join(dossier, 'pose.json') };
}
/** Tous les fichiers d'un dossier (relatifs), liens compris, sans les suivre. */
function lister(dossier, rel = '') {
  const sortie = [];
  for (const e of readdirSync(join(dossier, rel), { withFileTypes: true })) {
    const enfant = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) sortie.push(...lister(dossier, enfant)); else sortie.push(enfant);
  }
  return sortie.sort();
}
const lancer = (m, plus = []) => {
  const r = spawnSync(process.execPath, [SCRIPT, '--source', m.source, '--cible', m.cible, '--resume', m.resume, ...plus], { encoding: 'utf8' });
  return { code: r.status, err: r.stderr, resume: existsSync(m.resume) ? JSON.parse(readFileSync(m.resume, 'utf8')) : null };
};

test('pose : un fichier neuf, un fichier changé, un identique (non réécrit), un retiré ; `_serveur/` intact ; aucun fichier provisoire ne reste', () => {
  const m = monde({
    servi: { 'index.html': '<h1>ancien</h1>', 'a.html': 'a', 'a/b.html': 'b', 'vieux.js': 'x', 'vieux/dossier/f.txt': 'f', '_astro/meme.js': 'meme' },
    fabrique: { 'index.html': '<h1>neuf</h1>', 'a.html': 'a', 'a/b.html': 'b', 'nouveau/p.html': 'p', '_astro/meme.js': 'meme', '_astro/neuf.css': 'css' },
  });
  const meme = join(m.cible, '_astro', 'meme.js');
  const inodeAvant = statSync(meme).ino;
  const r = lancer(m);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.resume.format, 'maverick-pose/1');
  assert.equal(r.resume.pose, true);
  assert.equal(r.resume.refus, null);
  // posés : index.html (changé), nouveau/p.html, _astro/neuf.css ; inchangés : a.html, a/b.html, _astro/meme.js ; retirés : vieux.js, vieux/dossier/f.txt
  assert.deepEqual([r.resume.posees, r.resume.inchangees, r.resume.retirees], [3, 3, 2]);
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), '<h1>neuf</h1>');
  assert.equal(statSync(meme).ino, inodeAvant, 'un fichier identique n’est pas réécrit');
  assert.deepEqual(lister(m.cible), ['_astro/meme.js', '_astro/neuf.css', '_serveur/serveur/index.mjs', '_serveur/version.json', 'a.html', 'a/b.html', 'index.html', 'nouveau/p.html']);
  assert.equal(existsSync(join(m.cible, 'vieux')), false, 'le dossier retiré avec ses fichiers');
  assert.equal(readFileSync(join(m.cible, '_serveur', 'serveur', 'index.mjs'), 'utf8'), 'code du service');
  assert.equal(statSync(join(m.cible, 'index.html')).mode & 0o777, 0o644);
  assert.equal(r.resume.pages_fabriquees, 4);
});

test('`_serveur/` n’est jamais touché, même quand la source ne le porte pas, et il n’est pas compté parmi les pages servies', () => {
  const m = monde({ servi: { 'index.html': 'i' }, fabrique: { 'index.html': 'i2' } });
  ecrire(join(m.cible, '_serveur', 'donnees', 'page.html'), 'une page du code du service');
  const avant = readFileSync(join(m.cible, '_serveur', 'version.json'), 'utf8');
  const r = lancer(m);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.resume.pages_servies, 1, 'seules les pages du site servi comptent');
  assert.equal(readFileSync(join(m.cible, '_serveur', 'version.json'), 'utf8'), avant);
  assert.equal(existsSync(join(m.cible, '_serveur', 'donnees', 'page.html')), true);
});

test('une source qui porte `_serveur` est refusée (84) : rien n’est posé', () => {
  const m = monde({ servi: { 'index.html': 'ancien' }, fabrique: { 'index.html': 'neuf', '_serveur/serveur/index.mjs': 'code piégé' } });
  const r = lancer(m);
  assert.equal(r.code, CODES.serveur_dans_la_source);
  assert.equal(r.resume.pose, false);
  assert.equal(r.resume.refus, 'serveur_dans_la_source');
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), 'ancien');
  assert.equal(readFileSync(join(m.cible, '_serveur', 'serveur', 'index.mjs'), 'utf8'), 'code du service');
});

test('un lien dans la source est refusé (83) : rien n’est posé, ni lu à travers le lien', () => {
  const m = monde({ servi: { 'index.html': 'ancien' }, fabrique: { 'index.html': 'neuf', 'p.html': 'p' } });
  const dehors = join(m.dossier, 'dehors');
  ecrire(join(dehors, 'secret.txt'), 'ne doit jamais sortir');
  symlinkSync(dehors, join(m.source, 'lien-vers-un-dossier'));
  symlinkSync(join(dehors, 'secret.txt'), join(m.source, 'lien.html'));
  const r = lancer(m);
  assert.equal(r.code, CODES.fichier_irregulier);
  assert.equal(r.resume.refus, 'fichier_irregulier');
  assert.equal(r.resume.irreguliers, 2);
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), 'ancien');
  assert.equal(existsSync(join(m.cible, 'p.html')), false);
  assert.equal(existsSync(join(m.cible, 'lien.html')), false);
  assert.equal(JSON.stringify(r.resume).includes('secret'), false, 'le résumé ne porte ni nom ni contenu du fichier visé');
});

test('une source qui est elle-même un lien est refusée', () => {
  const m = monde({ servi: { 'index.html': 'ancien' } });
  const reel = join(m.dossier, 'reel');
  ecrire(join(reel, 'index.html'), 'neuf');
  rmSync(m.source, { recursive: true });
  symlinkSync(reel, m.source);
  assert.throws(() => poserUnSite({ source: m.source, cible: m.cible }), (e) => e instanceof RefusDePose && e.refus === 'source_illisible');
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), 'ancien');
});

test('une FIFO dans la source est refusée (83) sans bloquer', { skip: spawnSync('mkfifo', ['--version'], { stdio: 'ignore' }).error ? 'mkfifo indisponible' : false }, () => {
  const m = monde({ servi: { 'index.html': 'ancien' }, fabrique: { 'index.html': 'neuf' } });
  const fifo = spawnSync('mkfifo', [join(m.source, 'tuyau.html')]);
  assert.equal(fifo.status, 0);
  const r = lancer(m);
  assert.equal(r.code, CODES.fichier_irregulier);
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), 'ancien');
});

test('index.html absent (81) : refus', () => {
  const m = monde({ servi: { 'index.html': 'ancien' }, fabrique: { 'autre.html': 'x' } });
  const r = lancer(m);
  assert.equal(r.code, CODES.index_absent);
  assert.equal(r.resume.refus, 'index_absent');
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), 'ancien');
});

test('site_trop_petit (82) : moins de 90 % des pages du site servi ; les deux nombres et le minimum sont au résumé ; un seuil plus bas laisse passer', () => {
  const servi = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`p${i}.html`, `p${i}`]));
  servi['index.html'] = 'i';
  const m = monde({ servi, fabrique: { 'index.html': 'neuf', ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}.html`, `n${i}`])) } });
  const r = lancer(m);
  assert.equal(r.code, CODES.site_trop_petit);
  assert.equal(r.resume.refus, 'site_trop_petit');
  assert.equal(r.resume.pages_fabriquees, 11);
  assert.equal(r.resume.pages_servies, 21);
  assert.equal(r.resume.minimum_de_pages, 19, '90 % de 21, arrondi au-dessus');
  assert.equal(r.resume.posees, 0);
  assert.equal(readFileSync(join(m.cible, 'p0.html'), 'utf8'), 'p0', 'rien n’a été posé ni retiré');
  assert.equal(existsSync(join(m.cible, 'p15.html')), true);
  // exactement au seuil : passe
  const juste = monde({ servi, fabrique: { 'index.html': 'neuf', ...Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`p${i}.html`, `n${i}`])) } });
  assert.equal(lancer(juste).code, 0, '19 pages sur 21 : le minimum');
  // un seuil choisi par le propriétaire
  const bas = lancer(monde({ servi, fabrique: { 'index.html': 'neuf' } }), ['--minimum-pct', '0']);
  assert.equal(bas.code, 0);
  assert.equal(bas.resume.retirees, 20);
});

test('sans page servie (première pose), le seuil ne bloque pas', () => {
  const m = monde({ servi: {}, fabrique: { 'index.html': 'neuf' } });
  assert.equal(lancer(m).code, 0);
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), 'neuf');
});

test('un lien, un fichier ou un dossier de la cible à la place d’un fichier de la source est remplacé sans jamais suivre le lien', () => {
  const m = monde({ servi: { 'index.html': 'i' }, fabrique: { 'index.html': 'i', 'a.html': 'neuf-a', 'd/e.html': 'neuf-e', 'dossier-devenu-fichier.html': 'f' } });
  const dehors = join(m.dossier, 'dehors');
  ecrire(join(dehors, 'garde.txt'), 'intact');
  symlinkSync(join(dehors, 'garde.txt'), join(m.cible, 'a.html'));
  symlinkSync(dehors, join(m.cible, 'd'));
  ecrire(join(m.cible, 'dossier-devenu-fichier.html', 'dedans.txt'), 'x');
  symlinkSync(dehors, join(m.cible, 'lien-orphelin'));
  const r = lancer(m);
  assert.equal(r.code, 0, r.err);
  assert.equal(readFileSync(join(dehors, 'garde.txt'), 'utf8'), 'intact', 'le fichier visé par un lien n’a pas été écrit');
  assert.equal(lstatSync(join(m.cible, 'a.html')).isFile(), true);
  assert.equal(readFileSync(join(m.cible, 'a.html'), 'utf8'), 'neuf-a');
  assert.equal(readFileSync(join(m.cible, 'd', 'e.html'), 'utf8'), 'neuf-e');
  assert.deepEqual(readdirSync(dehors), ['garde.txt'], 'rien n’a été écrit dans le dossier visé par un lien');
  assert.equal(readFileSync(join(m.cible, 'dossier-devenu-fichier.html'), 'utf8'), 'f');
  assert.equal(existsSync(join(m.cible, 'lien-orphelin')), false);
  assert.equal(readdirSync(dehors).length, 1);
});

test('les provisoires oubliés d’une pose interrompue sont retirés sans compter parmi les fichiers retirés', () => {
  const m = monde({ servi: { 'index.html': 'i', '.pose-1-1.tmp': 'reste d’une pose interrompue' }, fabrique: { 'index.html': 'neuf', '_astro/x.js': 'js' } });
  const res = poserUnSite({ source: m.source, cible: m.cible });
  assert.equal(res.posees, 2);
  assert.equal(res.retirees, 0, 'un provisoire ne compte pas parmi les fichiers retirés');
  assert.equal(existsSync(join(m.cible, '.pose-1-1.tmp')), false);
  assert.equal(lister(m.cible).some((f) => /\.pose-.*\.tmp$/.test(f)), false);
});

test('usage : un argument inconnu ou manquant sort en 2, sans rien écrire', () => {
  const m = monde({ servi: { 'index.html': 'ancien' }, fabrique: { 'index.html': 'neuf' } });
  const r = spawnSync(process.execPath, [SCRIPT, '--source', m.source], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  const autre = spawnSync(process.execPath, [SCRIPT, '--source', m.source, '--cible', m.cible, '--resume', m.resume, '--minimum-pct', '150'], { encoding: 'utf8' });
  assert.equal(autre.status, 2);
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), 'ancien');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// `--serveur` : la pose du service lui-même (l'activation en production, lot 11, PR 5a)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Deux dossiers `_serveur` : le service posé (cible) et le nouveau (source), chacun { chemin: contenu }. */
function mondeDuService({ servi = {}, neuf = {} } = {}) {
  const dossier = join(racine, `s${(n += 1)}`);
  const cible = join(dossier, 'site', '_serveur');
  const source = join(dossier, 'fabrique', '_serveur');
  mkdirSync(cible, { recursive: true });
  mkdirSync(source, { recursive: true });
  for (const [rel, contenu] of Object.entries(servi)) ecrire(join(cible, rel), contenu);
  for (const [rel, contenu] of Object.entries(neuf)) ecrire(join(source, rel), contenu);
  return { dossier, cible, source, resume: join(dossier, 'pose.json') };
}
const SERVICE_NEUF = { 'serveur/index.mjs': 'neuf', 'serveur/api.mjs': 'api neuve', 'src/lib/a.mjs': 'a', 'version.json': '{"version":"2"}' };

test('--serveur : le service neuf remplace l’ancien (fichiers changés, neufs, retirés), sans minimum de pages ; aucun provisoire ne reste', () => {
  const m = mondeDuService({
    servi: { 'serveur/index.mjs': 'ancien', 'serveur/vieux.mjs': 'x', 'src/lib/a.mjs': 'a', 'version.json': '{"version":"1"}' },
    neuf: SERVICE_NEUF,
  });
  const r = lancer(m, ['--serveur']);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.resume.pose, true);
  assert.deepEqual([r.resume.posees, r.resume.inchangees, r.resume.retirees], [3, 1, 1]);
  assert.deepEqual(lister(m.cible), lister(m.source));
  assert.equal(readFileSync(join(m.cible, 'serveur', 'index.mjs'), 'utf8'), 'neuf');
  assert.equal(lister(m.cible).some((f) => /\.pose-.*\.tmp$/.test(f)), false);
});

test('--serveur : version.json, que le service surveille pour se relancer, est posé EN DERNIER (même quand un nom de fichier le suit dans l’ordre alphabétique)', () => {
  const m = mondeDuService({ servi: { 'serveur/index.mjs': 'ancien', 'version.json': '{"version":"1"}' }, neuf: { ...SERVICE_NEUF, 'zz/dernier.mjs': 'z', 'zz/zz/autre.mjs': 'z' } });
  const r = lancer(m, ['--serveur']);
  assert.equal(r.code, 0, r.err);
  const date = (rel) => statSync(join(m.cible, rel), { bigint: true }).mtimeNs;
  for (const rel of lister(m.cible).filter((f) => f !== 'version.json')) assert.ok(date('version.json') >= date(rel), `version.json est posé après ${rel}`);
});

test('--serveur : un service sans serveur/index.mjs ou sans version.json est refusé (87), rien n’est posé', () => {
  for (const neuf of [{ 'version.json': '{}' }, { 'serveur/index.mjs': 'x' }]) {
    const m = mondeDuService({ servi: { 'serveur/index.mjs': 'ancien', 'version.json': '{"version":"1"}' }, neuf });
    const r = lancer(m, ['--serveur']);
    assert.equal(r.code, CODES.serveur_incomplet);
    assert.equal(r.resume.refus, 'serveur_incomplet');
    assert.equal(readFileSync(join(m.cible, 'serveur', 'index.mjs'), 'utf8'), 'ancien');
    assert.equal(readFileSync(join(m.cible, 'version.json'), 'utf8'), '{"version":"1"}');
  }
});

test('--serveur : un lien dans le nouveau service est refusé (83), et sans --serveur un `_serveur` dans la source reste refusé (84)', () => {
  const m = mondeDuService({ servi: { 'version.json': '{"version":"1"}' }, neuf: SERVICE_NEUF });
  symlinkSync('/etc/passwd', join(m.source, 'lien.mjs'));
  const r = lancer(m, ['--serveur']);
  assert.equal(r.code, CODES.fichier_irregulier);
  assert.equal(readFileSync(join(m.cible, 'version.json'), 'utf8'), '{"version":"1"}');
  // la pose des pages n'a pas changé : un `_serveur` dans la source est refusé, et le `_serveur` de la cible n'est pas touché
  const p = monde({ servi: { 'index.html': 'a' }, fabrique: { 'index.html': 'b', '_serveur/x.mjs': 'x' } });
  assert.equal(lancer(p).code, CODES.serveur_dans_la_source);
});

test('--sans-le-serveur-de-la-source : le `_serveur` de la source (site fabriqué par le kit, site précédent) est ignoré, jamais posé ni compté ; celui de la cible n’est pas touché ; sans l’option, il reste refusé (84)', () => {
  const m = monde({ servi: { 'index.html': 'ancien', 'a.html': 'a' }, fabrique: { 'index.html': 'neuf', 'a.html': 'a', '_serveur/serveur/index.mjs': 'service du kit', '_serveur/version.json': '{"v":2}' } });
  assert.equal(lancer(m).code, CODES.serveur_dans_la_source);
  const r = lancer(m, ['--sans-le-serveur-de-la-source']);
  assert.equal(r.code, 0, r.err);
  assert.equal(readFileSync(join(m.cible, 'index.html'), 'utf8'), 'neuf');
  assert.equal(readFileSync(join(m.cible, '_serveur', 'version.json'), 'utf8'), '{"v":1}', 'le service posé n’est pas touché par la pose des pages');
  assert.equal(r.resume.pages_fabriquees, 2);
  // les deux options ne se mêlent pas
  assert.equal(lancer(m, ['--serveur', '--sans-le-serveur-de-la-source']).code, 2);
});
