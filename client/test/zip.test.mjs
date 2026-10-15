// Archives ZIP sans dépendance (lib/zip.mjs) : le .xlsx et le .ods de la fiche de personnage en tableur. Aller-retour, sortie déterministe,
// lecture de ce qu'écrivent les autres (data descriptors de LibreOffice, extra local différent, noms non déclarés UTF-8), refus de ce qui n'est
// pas sûr (ZIP64, chiffrement, méthode inconnue, nom qui remonte, CRC faux, bombe), et le modèle de la fiche réassemblé puis relu.
// Les archives « d'ailleurs » sont fabriquées à la main ici (aucun binaire dans le dépôt), avec node:zlib.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 as crc32DeZlib } from 'node:zlib';
import { crc32, ecrireZip, lireZip, MAX_ENTREE, MAX_TOTAL } from '../src/lib/zip.mjs';

const enc = new TextEncoder();
const dec = new TextDecoder();
const MODELE = fileURLToPath(new URL('../src/modeles/fiche-personnage/', import.meta.url));

const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const octets = (x) => (typeof x === 'string' ? enc.encode(x) : Uint8Array.from(x));
const concat = (...parts) => {
  const sortie = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of parts) {
    sortie.set(p, i);
    i += p.length;
  }
  return sortie;
};
/** Octets pseudo-aléatoires reproductibles (incompressibles). */
const hasard = (n, graine = 7) => {
  const o = new Uint8Array(n);
  let x = graine;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    o[i] = x >>> 24;
  }
  return o;
};

/**
 * Archive fabriquée à la main, champ par champ (indépendante du module). Par entrée : nom (texte ou octets), donnees, methode (8 par défaut),
 * drapeaux, descripteur (bit 3 : tailles et CRC locaux à 0, data descriptor après les données), extraLocal, et pour mentir dans le répertoire
 * central : crc, tailleU, tailleC, comprimes. Options : avant (octets placés avant l'archive), commentaire, nombre, localisateurZip64.
 */
function fabriquer(entrees, { avant = [], commentaire = '', nombre, localisateurZip64 = false } = {}) {
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  for (const e of entrees) {
    const nom = [...octets(e.nom)];
    const donnees = octets(e.donnees ?? '');
    const methode = e.methode ?? 8;
    const comprimes = e.comprimes ?? (methode === 8 ? new Uint8Array(deflateRawSync(donnees)) : donnees);
    const crc = e.crc ?? crc32DeZlib(donnees);
    const drapeaux = (e.drapeaux ?? 0) | (e.descripteur ? 0x8 : 0);
    const tailleU = e.tailleU ?? donnees.length;
    const tailleC = e.tailleC ?? comprimes.length;
    const extra = [...(e.extraLocal ?? [])];
    const tete = octets([...u32(0x04034b50), ...u16(20), ...u16(drapeaux), ...u16(methode), ...u16(0), ...u16(0x21),
      ...(e.descripteur ? [...u32(0), ...u32(0), ...u32(0)] : [...u32(crc), ...u32(tailleC), ...u32(tailleU)]),
      ...u16(nom.length), ...u16(extra.length), ...nom, ...extra]);
    const suite = octets(e.descripteur ? [...u32(0x08074b50), ...u32(crc), ...u32(comprimes.length), ...u32(donnees.length)] : []);
    locaux.push(tete, comprimes, suite);
    centraux.push(octets([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(drapeaux), ...u16(methode), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(tailleC), ...u32(tailleU), ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(decalage), ...nom]));
    decalage += tete.length + comprimes.length + suite.length;
  }
  const central = concat(...centraux);
  const n = nombre ?? entrees.length;
  const com = [...enc.encode(commentaire)];
  const localisateur = localisateurZip64 ? octets([...u32(0x07064b50), ...u32(0), ...u32(0), ...u32(0), ...u32(1)]) : new Uint8Array(0);
  const fin = octets([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(n), ...u16(n), ...u32(central.length), ...u32(decalage), ...u16(com.length), ...com]);
  return concat(octets(avant), ...locaux, central, localisateur, fin);
}

/** Le répertoire central d'une archive, lu ici sans le module : { nom, drapeaux, methode, heure, jour, local }. */
function repertoire(zip) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fin = zip.length - 22;
  assert.equal(v.getUint32(fin, true), 0x06054b50);
  const sortie = [];
  let p = v.getUint32(fin + 16, true);
  for (let i = 0; i < v.getUint16(fin + 10, true); i++) {
    const lNom = v.getUint16(p + 28, true);
    sortie.push({
      nom: dec.decode(zip.subarray(p + 46, p + 46 + lNom)),
      drapeaux: v.getUint16(p + 8, true),
      methode: v.getUint16(p + 10, true),
      heure: v.getUint16(p + 12, true),
      jour: v.getUint16(p + 14, true),
      local: v.getUint32(p + 42, true),
    });
    p += 46 + lNom + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return sortie;
}

const egal = (relu, attendu) => {
  assert.deepEqual([...relu.keys()], [...attendu.keys()]);
  for (const [nom, contenu] of attendu) assert.deepEqual(relu.get(nom), typeof contenu === 'string' ? enc.encode(contenu) : contenu, nom);
};
const illisible = (motif) => (e) => e instanceof Error && e.message.startsWith('Fichier ZIP illisible : ') && motif.test(e.message);

test('crc32 : valeurs de référence', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
  assert.equal(crc32(enc.encode('The quick brown fox jumps over the lazy dog')), 0x414fa339);
  const o = hasard(100_000);
  assert.equal(crc32(o), crc32DeZlib(o));
});

test('aller-retour : textes et octets, nom UTF-8, fichier vide, ordre gardé ; « mimetype » stocké en premier, sans extra', async () => {
  const xml = `<?xml version="1.0"?>\n<feuille>${'<ligne a="1">Œuvre — été</ligne>'.repeat(500)}</feuille>`;
  const entrees = new Map([
    ['mimetype', 'application/vnd.oasis.opendocument.spreadsheet'],
    ['content.xml', xml],
    ['Pictures/portrait é.bin', hasard(5000)],
    ['vide.txt', ''],
    ['Données/名前 — ü.txt', enc.encode('texte\n')],
  ]);
  const zip = await ecrireZip(entrees);
  egal(await lireZip(zip), entrees);

  // .ods : « mimetype » d'abord, méthode 0, sans extra, son contenu à l'octet 38
  assert.equal(dec.decode(zip.subarray(30, 38)), 'mimetype');
  assert.equal(dec.decode(zip.subarray(38, 38 + 46)), 'application/vnd.oasis.opendocument.spreadsheet');
  const v = new DataView(zip.buffer, zip.byteOffset);
  assert.equal(v.getUint16(8, true), 0);
  assert.equal(v.getUint16(28, true), 0);
  assert.equal(v.getUint16(6, true) & 0x8, 0, 'jamais de data descriptor');

  const rep = repertoire(zip);
  assert.deepEqual(rep.map((e) => [e.nom, e.methode]), [
    ['mimetype', 0], // stocké d'office
    ['content.xml', 8], // compressé : il gagne
    ['Pictures/portrait é.bin', 0], // incompressible : stocké
    ['vide.txt', 0],
    ['Données/名前 — ü.txt', 0], // 6 octets : deflate n'y gagne rien
  ]);
  assert.deepEqual(rep.map((e) => Boolean(e.drapeaux & 0x800)), [false, false, true, false, true], 'bit 11 seulement pour un nom non ASCII');
  assert.ok(zip.length < xml.length, 'le XML est compressé');
});

test('aller-retour : `stocker` choisit les entrées non compressées ; ArrayBuffer et Buffer acceptés', async () => {
  const texte = 'a'.repeat(10_000);
  const zip = await ecrireZip([['a.xml', texte], ['b.xml', texte]], { stocker: (nom) => nom === 'b.xml' });
  assert.deepEqual(repertoire(zip).map((e) => e.methode), [8, 0]);
  const attendu = new Map([['a.xml', texte], ['b.xml', texte]]);
  egal(await lireZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.length)), attendu);
  egal(await lireZip(Buffer.from(zip)), attendu);
  const relu = await lireZip(Buffer.from(zip));
  assert.equal(Object.getPrototypeOf(relu.get('b.xml')), Uint8Array.prototype, 'une copie, pas une vue sur le fichier');
});

test('sortie déterministe : même date, mêmes octets ; heure DOS en UTC, 1980-01-01 par défaut', async () => {
  const entrees = [['[Content_Types].xml', '<Types/>'], ['xl/a.xml', '<a>' + 'x'.repeat(300) + '</a>'], ['b.bin', hasard(64)]];
  assert.deepEqual(await ecrireZip(entrees), await ecrireZip(entrees));
  const date = new Date(Date.UTC(2026, 9, 15, 13, 45, 31));
  const a = await ecrireZip(entrees, { date });
  assert.deepEqual(a, await ecrireZip(entrees, { date: new Date(date) }));
  assert.notDeepEqual(a, await ecrireZip(entrees));
  for (const e of repertoire(a)) {
    assert.equal(e.jour, ((2026 - 1980) << 9) | (10 << 5) | 15);
    assert.equal(e.heure, (13 << 11) | (45 << 5) | 15);
  }
  for (const e of repertoire(await ecrireZip(entrees))) assert.deepEqual([e.jour, e.heure], [(1 << 5) | 1, 0]);
  for (const e of repertoire(await ecrireZip(entrees, { date: new Date(Date.UTC(1970, 0, 1)) }))) assert.deepEqual([e.jour, e.heure], [(1 << 5) | 1, 0]);
  await assert.rejects(ecrireZip(entrees, { date: new Date('pas une date') }), /Fichier ZIP impossible à écrire : date invalide/);
});

test('écriture : nom qui remonte, nom absolu, entrée en double, contenu d’un autre type refusés', async () => {
  await assert.rejects(ecrireZip([['../x', 'a']]), /impossible à écrire : nom d’entrée refusé/);
  await assert.rejects(ecrireZip([['/x', 'a']]), /nom d’entrée refusé/);
  await assert.rejects(ecrireZip([['', 'a']]), /nom d’entrée refusé/);
  await assert.rejects(ecrireZip([['x', 'a'], ['x', 'b']]), /entrée en double/);
  await assert.rejects(ecrireZip([['x', 42]]), /ni texte ni octets/);
});

test('data descriptors (bit 3, tailles locales à 0, comme LibreOffice) et extra local différent : le répertoire central fait foi', async () => {
  const xml = '<sst>' + '<si><t>Force</t></si>'.repeat(200) + '</sst>';
  const image = hasard(3000, 3);
  const zip = fabriquer([
    { nom: 'xl/sharedStrings.xml', donnees: xml, descripteur: true },
    { nom: 'xl/media/image1.png', donnees: image, methode: 0, descripteur: true },
    { nom: 'docProps/app.xml', donnees: '<Properties/>', extraLocal: [0x55, 0x54, 5, 0, 1, 0x80, 0x5f, 0x2b, 0x68] }, // horodatage étendu
  ]);
  const v = new DataView(zip.buffer);
  assert.deepEqual([v.getUint16(6, true) & 8, v.getUint32(14, true), v.getUint32(18, true), v.getUint32(22, true)], [8, 0, 0, 0], 'en-tête local à 0');
  egal(await lireZip(zip), new Map([['xl/sharedStrings.xml', xml], ['xl/media/image1.png', image], ['docProps/app.xml', '<Properties/>']]));
});

test('entrées de dossier ignorées ; commentaire d’archive et octets placés avant l’archive admis', async () => {
  const zip = fabriquer([{ nom: 'Configurations2/', methode: 0 }, { nom: 'Configurations2/a.xml', donnees: '<a/>' }], { commentaire: 'commentaire PK' });
  egal(await lireZip(zip), new Map([['Configurations2/a.xml', '<a/>']]));
  egal(await lireZip(await ecrireZip([['d/', ''], ['d/b.txt', 'b']])), new Map([['d/b.txt', 'b']]));
  // archive auto-extractible : des octets devant, les décalages écrits restent relatifs au début de l'archive
  egal(await lireZip(concat(octets('MZ' + ' '.repeat(98)), await ecrireZip([['a.txt', 'aaaa'.repeat(50)]]))), new Map([['a.txt', 'aaaa'.repeat(50)]]));
  egal(await lireZip(fabriquer([{ nom: 'a.txt', donnees: 'x' }], { avant: [1, 2, 3] })), new Map([['a.txt', 'x']]));
});

test('noms : UTF-8 non déclaré, puis latin1 ; « a..b » est un nom ordinaire', async () => {
  egal(await lireZip(fabriquer([{ nom: 'été.txt', donnees: 'e' }])), new Map([['été.txt', 'e']]));
  egal(await lireZip(fabriquer([{ nom: [0x63, 0x61, 0x66, 0xe9, 0x2e, 0x74, 0x78, 0x74], donnees: 'c' }])), new Map([['café.txt', 'c']]));
  egal(await lireZip(fabriquer([{ nom: 'a..b.txt', donnees: 'c' }])), new Map([['a..b.txt', 'c']]));
  await assert.rejects(lireZip(fabriquer([{ nom: [0x63, 0xe9, 0x2e], donnees: 'c', drapeaux: 0x800 }])), illisible(/déclaré en UTF-8 mais mal codé/));
});

test('refus : nom absolu ou qui remonte, entrée en double', async () => {
  for (const nom of ['../evil.txt', '/etc/passwd', 'xl/../../evil.txt', 'xl\\..\\evil.txt', '\\evil.txt', '../']) {
    await assert.rejects(lireZip(fabriquer([{ nom, donnees: 'x' }])), illisible(/nom d’entrée refusé/), nom);
  }
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'x' }, { nom: 'a', donnees: 'y' }])), illisible(/entrée en double : « a »/));
});

test('refus : ZIP64, chiffrement, méthode inconnue', async () => {
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'x', tailleU: 0xffffffff }])), illisible(/ZIP64/));
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'x', tailleC: 0xffffffff }])), illisible(/ZIP64/));
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'x' }], { nombre: 0xffff })), illisible(/ZIP64/));
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'x' }], { localisateurZip64: true })), illisible(/ZIP64/));
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'x', drapeaux: 0x1 }])), illisible(/entrée chiffrée/));
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'x', drapeaux: 0x40 }])), illisible(/entrée chiffrée/));
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'xyz', methode: 12, comprimes: enc.encode('xyz') }])), illisible(/méthode de compression 12/));
  await assert.rejects(lireZip(fabriquer([{ nom: 'a', donnees: 'xyz', methode: 99, comprimes: enc.encode('xyz') }])), illisible(/méthode de compression 99/));
});

test('refus : fin du répertoire central absente (pas une archive, archive tronquée)', async () => {
  await assert.rejects(lireZip(enc.encode('Nom;Race\nLucien;Humain\n')), illisible(/fin du répertoire central introuvable/));
  await assert.rejects(lireZip(new Uint8Array(3)), illisible(/trop court/));
  const zip = await ecrireZip([['a.txt', 'abc']]);
  await assert.rejects(lireZip(zip.subarray(0, zip.length - 1)), illisible(/fin du répertoire central introuvable/));
  await assert.rejects(lireZip(concat(zip, octets([0]))), illisible(/fin du répertoire central introuvable/), 'octets après la fin : refusés');
  await assert.rejects(lireZip('PK'), illisible(/aucun octet/));
});

test('refus : CRC faux, taille incohérente, données abîmées', async () => {
  await assert.rejects(lireZip(fabriquer([{ nom: 'a.txt', donnees: 'bonjour', crc: 1234 }])), illisible(/CRC faux \(« a\.txt »\)/));
  // un octet changé dans les données d'une entrée stockée
  const zip = await ecrireZip([['b.bin', hasard(100)]]);
  const abime = zip.slice();
  abime[30 + 'b.bin'.length + 10] ^= 0xff;
  await assert.rejects(lireZip(abime), illisible(/CRC faux \(« b\.bin »\)/));
  await assert.rejects(lireZip(fabriquer([{ nom: 's', donnees: 'abc', methode: 0, tailleU: 4 }])), illisible(/taille incohérente/));
  await assert.rejects(lireZip(fabriquer([{ nom: 'c', donnees: 'abc'.repeat(100), tailleU: 400 }])), illisible(/taille réelle inattendue/));
  const tronque = new Uint8Array(deflateRawSync(enc.encode('abc'.repeat(1000)))).subarray(0, 10);
  await assert.rejects(lireZip(fabriquer([{ nom: 'd.xml', donnees: 'abc'.repeat(1000), comprimes: tronque }])), illisible(/données compressées abîmées \(« d\.xml »\)/));
});

test('bombe : taille annoncée au-delà des limites, décompression au-delà de la taille annoncée', async () => {
  const zeros = new Uint8Array(2 ** 20);
  const zip = await ecrireZip([['zeros.bin', zeros], ['b.bin', zeros.subarray(0, 600)]]);
  assert.ok(zip.length < 3000, 'un Mio de zéros tient en quelques Kio');
  await assert.rejects(lireZip(zip, { maxEntree: 1000 }),
    { message: 'Le classeur dépasse la taille permise : « zeros.bin » ferait 1 Mio une fois décompressé (au plus 1000 octets par partie).' });
  await assert.rejects(lireZip(zip, { maxTotal: 2 ** 19 }),
    { message: 'Le classeur dépasse la taille permise : il ferait 1 Mio une fois décompressé (au plus 0,5 Mio).' });
  await assert.rejects(lireZip(zip, { maxTotal: 2 ** 20 + 500 }), /il ferait 1 Mio une fois décompressé/, 'la somme, pas une entrée');
  assert.equal((await lireZip(zip, { maxEntree: 2 ** 20, maxTotal: 2 ** 20 + 600 })).size, 2);
  // le répertoire central ment : 100 octets annoncés, un Mio réel ; la décompression s'arrête
  await assert.rejects(lireZip(fabriquer([{ nom: 'bombe.xml', donnees: zeros, tailleU: 100 }])), illisible(/« bombe\.xml » se décompresse au-delà de sa taille annoncée \(100 octets\)/));
});

test('limites par défaut (16 Mio par entrée, 64 Mio en tout) : la somme des tailles annoncées refusée AVANT toute décompression', async () => {
  assert.equal(MAX_ENTREE, 16 * 2 ** 20);
  assert.equal(MAX_TOTAL, 64 * 2 ** 20);
  const { DecompressionStream: D } = globalThis;
  let decompressions = 0;
  globalThis.DecompressionStream = class extends D {
    constructor(...a) {
      super(...a);
      decompressions += 1;
    }
  };
  try {
    // une entrée annoncée à 16 Mio + 1 (le répertoire ment : rien n'est décompressé pour le voir)
    const grosse = fabriquer([{ nom: 'a.xml', donnees: 'a' }, { nom: 'gros.xml', donnees: 'b', tailleU: MAX_ENTREE + 1 }]);
    await assert.rejects(lireZip(grosse),
      { message: 'Le classeur dépasse la taille permise : « gros.xml » ferait 16 Mio une fois décompressé (au plus 16 Mio par partie).' });
    // cinq entrées de 15 Mio annoncées : chacune permise, 75 Mio en tout ; la première aurait trahi son mensonge à la décompression
    const cinq = fabriquer(Array.from({ length: 5 }, (_, i) => ({ nom: `gros${i}.bin`, donnees: 'x'.repeat(100), tailleU: 15 * 2 ** 20 })));
    await assert.rejects(lireZip(cinq), { message: 'Le classeur dépasse la taille permise : il ferait 75 Mio une fois décompressé (au plus 64 Mio).' });
    // une entrée invalide après une bombe menteuse : le répertoire entier est relu d'abord, la bombe n'est pas décompressée
    const puisNomRefuse = fabriquer([{ nom: 'bombe.xml', donnees: new Uint8Array(2 ** 20), tailleU: 100 }, { nom: '../x', donnees: 'x' }]);
    await assert.rejects(lireZip(puisNomRefuse), illisible(/nom d’entrée refusé : « \.\.\/x »/));
    assert.equal(decompressions, 0, 'aucune décompression avant le refus');
    // juste sous les limites : lu (le mensonge se voit alors à la décompression)
    await assert.rejects(lireZip(fabriquer([{ nom: 'b.xml', donnees: 'b', tailleU: MAX_ENTREE }])), illisible(/taille réelle inattendue/));
    assert.equal(decompressions, 1);
  } finally {
    globalThis.DecompressionStream = D;
  }
});

test('sans DecompressionStream : message clair (une entrée stockée se lit encore) ; sans CompressionStream : écriture sans compression', async () => {
  const compresse = await ecrireZip([['a.xml', 'a'.repeat(1000)]]);
  const stocke = await ecrireZip([['a.xml', 'a'.repeat(1000)]], { stocker: () => true });
  const { DecompressionStream: D, CompressionStream: C } = globalThis;
  try {
    globalThis.DecompressionStream = undefined;
    await assert.rejects(lireZip(compresse), illisible(/DecompressionStream « deflate-raw » absent/));
    egal(await lireZip(stocke), new Map([['a.xml', 'a'.repeat(1000)]]));
    globalThis.DecompressionStream = D;
    globalThis.CompressionStream = undefined;
    const sans = await ecrireZip([['a.xml', 'a'.repeat(1000)]]);
    assert.deepEqual(repertoire(sans).map((e) => e.methode), [0]);
    egal(await lireZip(sans), new Map([['a.xml', 'a'.repeat(1000)]]));
  } finally {
    globalThis.DecompressionStream = D;
    globalThis.CompressionStream = C;
  }
});

test('le modèle de la fiche (client/src/modeles/fiche-personnage) : réassemblé, relu à l’identique, sortie stable', async () => {
  const parties = readdirSync(MODELE, { recursive: true })
    .map((chemin) => String(chemin).replaceAll('\\', '/'))
    .filter((chemin) => statSync(join(MODELE, chemin)).isFile())
    .sort();
  assert.ok(parties.includes('[Content_Types].xml') && parties.includes('_rels/.rels') && parties.includes('xl/worksheets/sheet1.xml'));
  const ordre = ['[Content_Types].xml', ...parties.filter((p) => p !== '[Content_Types].xml')];
  const entrees = new Map(ordre.map((p) => [p, new Uint8Array(readFileSync(join(MODELE, p)))]));
  const date = new Date(Date.UTC(2026, 9, 15));
  const zip = await ecrireZip(entrees, { date });
  assert.deepEqual(zip, await ecrireZip(entrees, { date }));
  const relu = await lireZip(zip);
  egal(relu, entrees);
  assert.equal([...relu.keys()][0], '[Content_Types].xml');
  const total = [...entrees.values()].reduce((s, o) => s + o.length, 0);
  assert.ok(zip.length < total / 2, `compressé : ${zip.length} octets pour ${total}`);
  assert.match(dec.decode(relu.get('xl/workbook.xml')), /<sheet [^>]*name="Personnage"/);
});
