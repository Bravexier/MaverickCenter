// Portrait d'une fiche ou d'une carte de monstre (lib/portrait.mjs ; demande du propriétaire : « il sera possible d'enregistrer le portrait de la même
// manière que dans la feuille de personnage », migration 0033) : format accepté, bornes du cadrage (la même règle que le dialogue de recadrage),
// style CSS qui montre le carré cadré sans script, dimensions lues dans l'en-tête des images que la page écrit, empreinte et nom de fichier.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { chargerMonstres } from '../src/lib/bestiaire-db.mjs';
import { htmlDeCarteMonstre, htmlDuPortrait } from '../src/lib/bestiaire-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  bornerCadrage, CADRAGE_PAR_DEFAUT, cadrageDe, carreDuCadrage, dimensionsDesOctets, dimensionsDuPortrait, empreinte, estUnPortrait, extensionDuPortrait,
  fichierDuPortrait, kiloOctetsDuPortrait, LONGUEUR_MAX_PORTRAIT, octetsDuPortrait, PORTRAIT_MAX, resumeDuPortrait, styleDuCadrage,
} from '../src/lib/portrait.mjs';
import { cheminsDesPortraits, reponseDuPortrait, TYPES_DE_PORTRAIT } from '../src/lib/portraits-publies.mjs';

const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));

test('format : une data URL WebP, JPEG ou PNG en base64, sous la limite de la base', () => {
  for (const cle of ['webp', 'jpeg', 'png', 'webpAlpha', 'webpSansPerte']) assert.ok(estUnPortrait(IMAGES[cle]), cle);
  assert.ok(LONGUEUR_MAX_PORTRAIT < PORTRAIT_MAX, 'la page réduit sous la limite de la base');
  for (const refus of [null, '', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PHA+', 'data:image/png,abc', 'data:image/png;base64,ab c',
    'javascript:alert(1)', `data:image/png;base64,${'A'.repeat(PORTRAIT_MAX)}`, 'data:image/png;base64,AAAAA', `${IMAGES.png}A`, 'data:image/png;base64,AA=A']) {
    assert.equal(estUnPortrait(refus), false, String(refus).slice(0, 40));
  }
  // un base64 incomplet ne se décode pas : null, jamais une exception (le service et le build le lisent)
  assert.equal(octetsDuPortrait('data:image/png;base64,AAAAA'), null);
  assert.equal(dimensionsDuPortrait(`data:image/png;base64,${'A'.repeat(100_001)}`), null);
  assert.deepEqual(['webp', 'jpeg', 'png'].map((k) => extensionDuPortrait(IMAGES[k])), ['webp', 'jpg', 'png']);
});

test('dimensions lues dans l’en-tête des images écrites par Chromium (WebP VP8X, JPEG, PNG)', () => {
  assert.deepEqual(dimensionsDuPortrait(IMAGES.webp), { largeur: 3, hauteur: 2 });
  assert.deepEqual(dimensionsDuPortrait(IMAGES.jpeg), { largeur: 3, hauteur: 2 });
  assert.deepEqual(dimensionsDuPortrait(IMAGES.png), { largeur: 3, hauteur: 2 });
  assert.deepEqual(dimensionsDuPortrait(IMAGES.webpAlpha), { largeur: 2, hauteur: 5 });
  assert.deepEqual(dimensionsDuPortrait(IMAGES.webpSansPerte), { largeur: 2, hauteur: 5 });
  assert.equal(dimensionsDuPortrait('pas une image'), null);
  assert.equal(dimensionsDuPortrait('data:image/png;base64,AAAA'), null, 'trop court');
});

test('dimensions : WebP simple avec ou sans perte (VP8, VP8L), JPEG progressif, en-tête illisible', () => {
  const riff = (morceau, corps) => Uint8Array.from([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...`WEBP${morceau}`].map((c) => c.charCodeAt(0)), [0, 0, 0, 0], corps));
  // VP8 : marque de trame (3 octets), code de début 9d 01 2a, largeur et hauteur sur 14 bits
  assert.deepEqual(dimensionsDesOctets(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 640 & 0xff, 640 >> 8, 480 & 0xff, 480 >> 8])), { largeur: 640, hauteur: 480 });
  // VP8L : signature 0x2f, puis largeur - 1 et hauteur - 1 sur 14 bits chacune (ici 3 × 2), et de quoi atteindre 30 octets
  assert.deepEqual(dimensionsDesOctets(riff('VP8L', [0x2f, 0x02, 0x40, 0x00, 0x00, 0, 0, 0, 0, 0])), { largeur: 3, hauteur: 2 });
  assert.equal(dimensionsDesOctets(riff('VP8 ', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), null, 'code de début absent');
  // JPEG : un segment APP0 puis SOF2 (progressif) : hauteur puis largeur
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc2, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x00, 0xc8, 3, ...new Array(20).fill(0)]);
  assert.deepEqual(dimensionsDesOctets(jpeg), { largeur: 200, hauteur: 300 });
  assert.equal(dimensionsDesOctets(Uint8Array.from([0xff, 0xd8, 0x00, ...new Array(40).fill(0)])), null, 'segment sans marque');
  assert.deepEqual([...octetsDuPortrait(IMAGES.png, 8)].slice(0, 8), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'seuls les premiers octets sont décodés');
});

test('cadrage : centré sans zoom par défaut ; zoom de 1 à 4 ; le carré reste dans l’image', () => {
  assert.deepEqual(cadrageDe({}), CADRAGE_PAR_DEFAUT);
  assert.deepEqual(cadrageDe({ x: 0.2, y: null, zoom: 2 }), { x: 0.2, y: 0.5, zoom: 2 });
  const d = { largeur: 300, hauteur: 200 };
  // sans zoom, le carré a la hauteur de l'image : il ne bouge qu'en largeur, de 1/3 à 2/3
  assert.deepEqual(bornerCadrage({ x: 0, y: 0, zoom: 1 }, d), { x: 0.3333, y: 0.5, zoom: 1 });
  assert.deepEqual(bornerCadrage({ x: 1, y: 1, zoom: 9 }, d), { x: 0.9167, y: 0.875, zoom: 4 });
  assert.deepEqual(bornerCadrage({ x: 0.5, y: 0.5, zoom: 0 }, d), { x: 0.5, y: 0.5, zoom: 1 }, 'un zoom absent ou nul vaut 1');
  for (const c of [{ x: 0, y: 0, zoom: 1 }, { x: 1, y: 0.3, zoom: 2.5 }, { x: 0.4, y: 1, zoom: 4 }]) {
    const { gauche, haut, cote } = carreDuCadrage(bornerCadrage(c, d), d);
    assert.ok(gauche >= -0.05 && haut >= -0.05 && gauche + cote <= 300.05 && haut + cote <= 200.05, JSON.stringify(c));
  }
});

test('cadrage : les mêmes bornes que le dialogue de recadrage (src/scripts/portrait.mjs, à n’importe quelle taille de cadre)', () => {
  // le dialogue : échelle s = (côté du cadre / petit côté) × zoom, demi-largeur visible = côté du cadre / (2 × largeur × s)
  const dialogue = ({ x, y, zoom }, { largeur, hauteur }, vue) => {
    const s = (vue / Math.min(largeur, hauteur)) * zoom;
    const demiX = vue / (2 * largeur * s);
    const demiY = vue / (2 * hauteur * s);
    return { x: Math.min(1 - demiX, Math.max(demiX, x)), y: Math.min(1 - demiY, Math.max(demiY, y)) };
  };
  for (const [largeur, hauteur] of [[3, 2], [600, 1000], [1280, 469], [777, 777]]) {
    for (const zoom of [1, 1.37, 2, 3.9]) {
      for (const [x, y] of [[0, 0], [0.5, 0.5], [1, 0.2], [0.03, 0.97]]) {
        const attendu = dialogue({ x, y, zoom }, { largeur, hauteur }, 384);
        const b = bornerCadrage({ x, y, zoom }, { largeur, hauteur });
        assert.ok(Math.abs(b.x - attendu.x) < 1e-4 && Math.abs(b.y - attendu.y) < 1e-4, `${largeur}×${hauteur} zoom ${zoom} (${x}, ${y})`);
      }
    }
  }
});

test('style du cadrage : le carré cadré remplit le cadre, sans script ; sans dimensions, l’image couvre le cadre', () => {
  const d = { largeur: 3, hauteur: 2 };
  assert.equal(styleDuCadrage(CADRAGE_PAR_DEFAUT, d), 'width:150%;height:100%;left:-25%;top:0%');
  // le pixel de droite (x = 5/6), deux fois plus près : un carré de 1 pixel
  assert.equal(styleDuCadrage({ x: 5 / 6, y: 0.75, zoom: 2 }, d), 'width:300%;height:200%;left:-200%;top:-100%');
  assert.equal(styleDuCadrage(CADRAGE_PAR_DEFAUT, null), 'width:100%;height:100%;left:0;top:0;object-fit:cover');
  // le coin haut gauche du carré est au coin du cadre, et son côté en est la largeur
  const c = { x: 0.61, y: 0.4, zoom: 1.8 };
  const { gauche, haut, cote } = carreDuCadrage(c, { largeur: 1000, hauteur: 700 });
  const style = Object.fromEntries(styleDuCadrage(c, { largeur: 1000, hauteur: 700 }).split(';').map((p) => p.split(':')).map(([k, v]) => [k, parseFloat(v)]));
  assert.ok(Math.abs((style.left / 100) * cote + gauche) < 0.01 && Math.abs((style.top / 100) * cote + haut) < 0.01);
  assert.ok(Math.abs((style.width / 100) * cote - 1000) < 0.01);
});

test('empreinte, nom de fichier et résumé : stables, différents d’une image à l’autre, sans recopier l’image', () => {
  assert.match(empreinte(IMAGES.webp), /^[0-9a-f]{16}$/);
  assert.equal(empreinte(IMAGES.webp), empreinte(String(IMAGES.webp)));
  assert.notEqual(empreinte(IMAGES.webp), empreinte(IMAGES.webpAlpha));
  assert.equal(fichierDuPortrait(IMAGES.webp), `${empreinte(IMAGES.webp)}.webp`);
  assert.equal(fichierDuPortrait(IMAGES.jpeg), `${empreinte(IMAGES.jpeg)}.jpg`);
  assert.equal(fichierDuPortrait(IMAGES.png), `${empreinte(IMAGES.png)}.png`);
  assert.equal(fichierDuPortrait('data:text/plain;base64,QQ=='), null);
  assert.equal(kiloOctetsDuPortrait(`data:image/png;base64,${'A'.repeat(4096)}`), 3);
  assert.equal(resumeDuPortrait(IMAGES.webp), `image ${empreinte(IMAGES.webp).slice(0, 8)} (1 Ko)`);
  assert.equal(resumeDuPortrait(null), null);
});

test('carte avec un portrait (lib/bestiaire-rendu.mjs) : l’image publiée, cadrée sans script, et l’empreinte de ce qu’elle montre ; sans adresse, le logo', () => {
  const l = chargerMonstres(ouvrirBase()).lignes.find((x) => x.carte);
  const html = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const portrait = { donnees: IMAGES.webp, x: 5 / 6, y: 0.75, zoom: 2 };
  const carte = htmlDeCarteMonstre({ ...l, portrait }, { logo: '/logo.webp', adresseDuPortrait: (d) => `/bestiaire/portraits/${fichierDuPortrait(d)}` });
  const figure = carte.match(/<figure class="bcarte__portrait"[^>]*>.*?<\/figure>/)[0];
  assert.ok(figure.includes(`data-portrait="${empreinte(IMAGES.webp)}:${5 / 6}:0.75:2"`), figure);
  assert.ok(figure.includes(`<img src="/bestiaire/portraits/${empreinte(IMAGES.webp)}.webp" alt="Portrait : ${html(l.nom)}" style="width:300%;height:200%;left:-200%;top:-100%"`), figure);
  assert.ok(!figure.includes('data-vide') && !figure.includes('figcaption'));
  // le service rend la carte sans adresse : le logo, et la page charge l'image (src/scripts/edition/bestiaire.mjs)
  assert.match(htmlDeCarteMonstre({ ...l, portrait }, { logo: '/logo.webp' }), /<figure class="bcarte__portrait" data-portrait="" data-vide data-ed-portrait="[^"]+" data-logo="\/logo\.webp"><div class="bcarte__cadre"><img src="\/logo\.webp" alt=""/);
  // une image dont l'adresse est une data URL (mode modification) reste échappée dans l'attribut
  assert.match(htmlDuPortrait({ table: 'monstre', cle: { id: 'x"y' }, nom: '<b>', portrait }, { logo: '/l.webp', adresse: (d) => d }), /data-ed-portrait="\[&quot;monstre&quot;,\{&quot;id&quot;:&quot;x\\&quot;y&quot;\}\]".*alt="Portrait : &lt;b&gt;"/);
});

test('fichiers publiés au build (lib/portraits-publies.mjs) : un par image et par format, les octets de l’image ; une image illisible n’en a pas', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE monstre (id TEXT, portrait TEXT); CREATE TABLE monstre_espece (id TEXT, portrait TEXT);');
  const inserer = (table, id, portrait) => db.prepare(`INSERT INTO ${table} VALUES (?, ?)`).run(id, portrait);
  inserer('monstre', 'a', IMAGES.webp);
  inserer('monstre', 'b', IMAGES.webp);
  inserer('monstre', 'c', IMAGES.png);
  inserer('monstre', 'd', null);
  inserer('monstre_espece', 'e', IMAGES.webpAlpha);
  inserer('monstre_espece', 'f', 'data:image/png;base64,AAAAA');
  const webp = cheminsDesPortraits(db, 'webp');
  assert.deepEqual(webp.map((c) => c.params.empreinte).sort(), [empreinte(IMAGES.webp), empreinte(IMAGES.webpAlpha)].sort(), 'une image écrite deux fois : un fichier');
  assert.deepEqual(cheminsDesPortraits(db, 'png').map((c) => c.params.empreinte), [empreinte(IMAGES.png)], 'l’image illisible n’a pas de fichier');
  assert.deepEqual(cheminsDesPortraits(db, 'jpg'), []);
  const c = webp.find((x) => x.params.empreinte === empreinte(IMAGES.webp));
  assert.deepEqual([...c.props.octets], [...octetsDuPortrait(IMAGES.webp)]);
  const reponse = reponseDuPortrait(c.props);
  assert.equal(reponse.headers.get('content-type'), TYPES_DE_PORTRAIT.webp);
  assert.deepEqual(dimensionsDesOctets(new Uint8Array(await reponse.arrayBuffer())), { largeur: 3, hauteur: 2 });
});
