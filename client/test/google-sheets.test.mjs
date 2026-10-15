// La fiche de personnage et Google Sheets (lib/google-sheets.mjs ; demandes du propriétaire, 2026-10-15 : « Exporter » crée une feuille Google Sheets,
// « Importer (en ligne) » lit une feuille partagée par lien) : identifiant client du build, lien d'une feuille, adresse d'export construite,
// redirections permises, nom du classeur, corps de l'envoi à l'API Drive, lien de la feuille créée ; puis le module réservé au script de la fiche
// parmi les scripts de page (la version portable refuse un module partagé entre deux scripts de page).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ADRESSE_D_ENVOI, PORTEE_DRIVE, SCRIPT_GOOGLE, TYPE_FEUILLE_GOOGLE, TYPE_XLSX, adresseDExport, clientGoogle, corpsMultipart, estUnZip, idDeFeuille,
  lienDeFeuille, nomDuClasseur, pageDeConnexion, redirectionPermise,
} from '../src/lib/google-sheets.mjs';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd';

test('constantes : le droit drive.file (les seuls fichiers créés par le site), le script de Google, l’envoi multipart de l’API Drive, la conversion en Google Sheets', () => {
  assert.equal(PORTEE_DRIVE, 'https://www.googleapis.com/auth/drive.file');
  assert.equal(SCRIPT_GOOGLE, 'https://accounts.google.com/gsi/client');
  assert.equal(new URL(ADRESSE_D_ENVOI).hostname, 'www.googleapis.com');
  assert.equal(new URL(ADRESSE_D_ENVOI).searchParams.get('uploadType'), 'multipart');
  assert.deepEqual(new URL(ADRESSE_D_ENVOI).searchParams.get('fields').split(','), ['id', 'name', 'webViewLink']);
  assert.equal(TYPE_FEUILLE_GOOGLE, 'application/vnd.google-apps.spreadsheet');
  assert.equal(TYPE_XLSX, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('clientGoogle : l’identifiant client OAuth de la variable de build SITE_GOOGLE_CLIENT_ID s’il en a la forme ; sinon vide (bouton grisé)', () => {
  const id = '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com';
  assert.equal(clientGoogle({ SITE_GOOGLE_CLIENT_ID: id }), id);
  assert.equal(clientGoogle({ SITE_GOOGLE_CLIENT_ID: `  ${id}\n` }), id, 'espaces autour retirés');
  for (const mauvais of [undefined, null, '', '   ', 'abc', `${id}.evil.com`, `x${id}`, 'https://123-abc.apps.googleusercontent.com', '123-ABC.apps.googleusercontent.com',
    '123-abc.apps.googleusercontent.com" onclick="x', '123-abc.apps.googleusercontent.com extra']) {
    assert.equal(clientGoogle({ SITE_GOOGLE_CLIENT_ID: mauvais }), '', String(mauvais));
  }
  assert.equal(clientGoogle(undefined), '');
  assert.equal(clientGoogle({}), '');
});

test('idDeFeuille : l’identifiant d’un lien https://docs.google.com/spreadsheets/d/<id>… ; null pour tout le reste', () => {
  for (const lien of [
    `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`,
    `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`,
    `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing#gid=123456`,
    `https://docs.google.com/spreadsheets/d/${ID}`,
    `https://docs.google.com/spreadsheets/d/${ID}/`,
    `https://docs.google.com/spreadsheets/u/1/d/${ID}/edit`,
    `  https://docs.google.com/spreadsheets/d/${ID}/edit  `,
    `https://DOCS.GOOGLE.COM/spreadsheets/d/${ID}/htmlview`,
  ]) {
    assert.equal(idDeFeuille(lien), ID, lien);
  }
  for (const lien of [
    `http://docs.google.com/spreadsheets/d/${ID}/edit`,
    `https://docs.google.com.evil.com/spreadsheets/d/${ID}/edit`,
    `https://evil.com/spreadsheets/d/${ID}/edit`,
    `https://evil.com/?https://docs.google.com/spreadsheets/d/${ID}/edit`,
    `https://user:pass@docs.google.com/spreadsheets/d/${ID}/edit`,
    `https://docs.google.com:8443/spreadsheets/d/${ID}/edit`,
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQabcdefghijklmnopqrstuvwxyz0123456789/pubhtml',
    `https://drive.google.com/file/d/${ID}/view`,
    `https://docs.google.com/document/d/${ID}/edit`,
    'https://docs.google.com/spreadsheets/d/court/edit',
    `https://docs.google.com/spreadsheets/d/${ID}%2F..%2F/edit`,
    `https://docs.google.com/spreadsheets/d/${'a'.repeat(101)}/edit`,
    'javascript:alert(1)',
    `docs.google.com/spreadsheets/d/${ID}/edit`,
    `https://docs.google.com/spreadsheets/d/${ID}/edit?${'x'.repeat(3000)}`,
    '', null, undefined, 42, {},
  ]) {
    assert.equal(idDeFeuille(lien), null, String(lien).slice(0, 120));
  }
});

test('adresseDExport : construite d’après l’identifiant seul (jamais l’adresse reçue) ; un identifiant invalide est refusé', () => {
  assert.equal(adresseDExport(ID), `https://docs.google.com/spreadsheets/d/${ID}/export?format=xlsx`);
  assert.throws(() => adresseDExport('../x'), /invalide/);
  assert.throws(() => adresseDExport(null), /invalide/);
});

test('redirectionPermise : https vers docs.google.com ou un hôte de googleusercontent.com (avec son point) ; pageDeConnexion : accounts.google.com', () => {
  for (const a of [
    'https://docs.google.com/spreadsheets/d/x/export?format=xlsx',
    'https://doc-0s-4c-sheets.googleusercontent.com/export/abc/def?format=xlsx',
    'https://a.b.googleusercontent.com/x',
  ]) {
    assert.equal(redirectionPermise(a), true, a);
  }
  for (const a of [
    'https://accounts.google.com/ServiceLogin?continue=x',
    'https://evilgoogleusercontent.com/x',
    'https://googleusercontent.com.evil.com/x',
    'https://googleusercontent.com/x',
    'http://doc-0s-4c-sheets.googleusercontent.com/x',
    'https://user@doc.googleusercontent.com/x',
    'https://doc.googleusercontent.com:444/x',
    'https://www.google.com/sorry/index',
    'ftp://docs.google.com/x',
    '', null, 'pas une adresse',
  ]) {
    assert.equal(redirectionPermise(a), false, String(a));
  }
  assert.equal(pageDeConnexion('https://accounts.google.com/v3/signin/identifier?continue=x'), true);
  assert.equal(pageDeConnexion('https://accounts.google.com.evil.com/'), false);
  assert.equal(pageDeConnexion('http://accounts.google.com/'), false);
  assert.equal(pageDeConnexion('https://docs.google.com/'), false);
});

test('estUnZip : « PK\\x03\\x04 » (un .xlsx), pas une page HTML', () => {
  assert.equal(estUnZip(Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 0)), true);
  assert.equal(estUnZip(Buffer.from('PK\u0003\u0004')), true);
  assert.equal(estUnZip(new TextEncoder().encode('<!DOCTYPE html><html>')), false);
  assert.equal(estUnZip(Uint8Array.of(0x50, 0x4b, 0x05, 0x06)), false, 'archive vide');
  assert.equal(estUnZip(Uint8Array.of(0x50, 0x4b)), false);
  assert.equal(estUnZip(null), false);
});

test('nomDuClasseur : filename* (UTF-8, le nom de la feuille chez Google), sinon filename ; sans chemin ni caractère de contrôle ; null sinon', () => {
  assert.equal(nomDuClasseur('attachment; filename="Kael.xlsx"; filename*=UTF-8\'\'Ka%C3%ABl%20Nox.xlsx'), 'Kaël Nox.xlsx');
  assert.equal(nomDuClasseur("attachment; filename*=utf-8''Fiche%20de%20Lucien.xlsx"), 'Fiche de Lucien.xlsx');
  assert.equal(nomDuClasseur('attachment; filename="Lucien.xlsx"'), 'Lucien.xlsx');
  assert.equal(nomDuClasseur('attachment; filename=Lucien.xlsx'), 'Lucien.xlsx');
  assert.equal(nomDuClasseur('attachment; filename="a \\"b\\".xlsx"'), 'a "b".xlsx');
  assert.equal(nomDuClasseur('attachment; filename="../../etc/passwd"'), 'passwd');
  assert.equal(nomDuClasseur("attachment; filename*=UTF-8''..%2F..%5Cx.xlsx"), 'x.xlsx');
  assert.equal(nomDuClasseur('attachment; filename="a\u0000b\u001f.xlsx"'), 'ab.xlsx');
  assert.equal(nomDuClasseur("attachment; filename*=UTF-8''%E0%A4%A; filename=\"repli.xlsx\""), 'repli.xlsx', 'filename* illisible : le repli');
  for (const rien of [null, undefined, '', 'attachment', 'inline', 'attachment; filename=""', 'attachment; filename="/"']) assert.equal(nomDuClasseur(rien), null, String(rien));
  assert.ok(nomDuClasseur(`attachment; filename="${'a'.repeat(5000)}.xlsx"`).length <= 200, 'borné');
});

test('corpsMultipart : métadonnées JSON (nom, type Google Sheets : la conversion) puis les octets du .xlsx intacts, frontières et fermeture', () => {
  const octets = Uint8Array.from({ length: 256 }, (_, i) => i); // tous les octets, CR et LF compris
  const { type, corps } = corpsMultipart({ nom: 'Kaël « Nox »', octets, frontiere: 'maverick-0f0e2c1a-1111-2222-3333-444455556666' });
  assert.equal(type, 'multipart/related; boundary=maverick-0f0e2c1a-1111-2222-3333-444455556666');
  const latin = Buffer.from(corps).toString('latin1');
  const f = '--maverick-0f0e2c1a-1111-2222-3333-444455556666';
  assert.ok(latin.startsWith(`${f}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`));
  assert.ok(latin.endsWith(`\r\n${f}--\r\n`));
  // les métadonnées : UTF-8
  const debut = Buffer.from(corps).toString('utf8').split('\r\n');
  assert.deepEqual(JSON.parse(debut[3]), { name: 'Kaël « Nox »', mimeType: 'application/vnd.google-apps.spreadsheet' });
  assert.equal(debut[4], f);
  assert.equal(debut[5], `Content-Type: ${TYPE_XLSX}`);
  // les octets, tels quels, entre l'en-tête de la seconde partie et la fermeture
  const entete = Buffer.from(`${f}\r\nContent-Type: ${TYPE_XLSX}\r\n\r\n`);
  const position = Buffer.from(corps).indexOf(entete) + entete.length;
  assert.deepEqual(Buffer.from(corps.subarray(position, position + octets.length)), Buffer.from(octets));
  assert.equal(corps.length, position + octets.length + `\r\n${f}--\r\n`.length);
  // nom vide : « Personnage » ; frontière invalide refusée
  assert.equal(JSON.parse(Buffer.from(corpsMultipart({ nom: '  ', octets, frontiere: 'x' }).corps).toString('utf8').split('\r\n')[3]).name, 'Personnage');
  for (const frontiere of ['', 'a b', 'a\r\nb', 'x'.repeat(71), undefined]) assert.throws(() => corpsMultipart({ nom: 'a', octets, frontiere }), /frontière/, String(frontiere));
});

test('lienDeFeuille : le webViewLink de la feuille créée s’il mène à docs.google.com, sinon l’adresse d’après son id ; jamais un lien d’ailleurs', () => {
  assert.equal(lienDeFeuille({ id: ID, webViewLink: `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=drivesdk` }), `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=drivesdk`);
  assert.equal(lienDeFeuille({ id: ID, webViewLink: 'javascript:alert(1)' }), `https://docs.google.com/spreadsheets/d/${ID}/edit`);
  assert.equal(lienDeFeuille({ id: ID, webViewLink: 'https://evil.com/' }), `https://docs.google.com/spreadsheets/d/${ID}/edit`);
  assert.equal(lienDeFeuille({ id: '../x' }), null);
  assert.equal(lienDeFeuille(null), null);
});

// ------------------------------------------------------------------ réservé au script de la fiche parmi les scripts de page

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const fichiersDe = (dossier, extension) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? fichiersDe(join(dossier, e.name), extension) : e.name.endsWith(extension) ? [join(dossier, e.name)] : []);
const importsDe = (texte, dossier) => [...texte.matchAll(/(?:^|[\s;])import\s*(?:[^'"();]*?\bfrom\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]/g)]
  .map((m) => m[1] ?? m[2]).filter((x) => x.startsWith('.')).map((x) => resolve(dossier, x.replace(/\?.*$/, '')));
function atteints(fichier, vus = new Set()) {
  for (const cible of importsDe(readFileSync(fichier, 'utf8'), dirname(fichier))) {
    const nom = relative(SRC, cible).split('\\').join('/');
    if (vus.has(nom)) continue;
    vus.add(nom);
    if (/\.(mjs|js|ts)$/.test(cible)) atteints(cible, vus);
  }
  return vus;
}

test('lib/google-sheets.mjs : parmi les scripts de page, seul src/scripts/fiche.mjs l’importe ; il n’importe rien (ni lib/text.mjs ni module de Node)', () => {
  // le code, sans ses commentaires (qui parlent du script que la page crée)
  const module = readFileSync(join(SRC, 'lib', 'google-sheets.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(module, /^\s*import\s/m, 'aucun import');
  assert.doesNotMatch(module, /\b(document|window)\./, 'sans DOM');
  assert.ok(atteints(join(SRC, 'scripts', 'fiche.mjs')).has('lib/google-sheets.mjs'));
  for (const f of fichiersDe(join(SRC, 'scripts'), '.mjs').filter((x) => !x.endsWith(join('scripts', 'fiche.mjs')))) {
    assert.ok(!atteints(f).has('lib/google-sheets.mjs'), relative(SRC, f));
  }
  for (const f of [...fichiersDe(join(SRC, 'components'), '.astro'), ...fichiersDe(join(SRC, 'pages'), '.astro'), ...fichiersDe(join(SRC, 'layouts'), '.astro')]) {
    for (const [, corps] of readFileSync(f, 'utf8').matchAll(/<script(?![^>]*is:inline)[^>]*>([\s\S]*?)<\/script>/g)) {
      for (const cible of importsDe(corps, dirname(f)).filter((c) => !c.endsWith(join('scripts', 'fiche.mjs')))) {
        const vus = atteints(cible).add(relative(SRC, cible).split('\\').join('/'));
        assert.ok(!vus.has('lib/google-sheets.mjs'), relative(SRC, f));
      }
    }
  }
  // le script de Google : créé par la page (createElement), jamais une balise <script src> du HTML ni un import (version portable)
  const script = readFileSync(join(SRC, 'scripts', 'fiche.mjs'), 'utf8');
  assert.match(script, /document\.createElement\('script'\)/);
  assert.match(script, /\.src = SCRIPT_GOOGLE;/);
  assert.doesNotMatch(script, /\bimport\(/);
});
