// Écriture d'un .xlsx d'après le modèle (lib/tableur-ecriture.mjs) : valeurs, fonds, image en A1, formules retirées. Le classeur écrit est relu
// ici par un petit lecteur (lib/zip.mjs + lib/xml-mini.mjs), indépendant de lib/tableur-lecture.mjs ; aucun classeur binaire dans le dépôt :
// le modèle est assemblé depuis client/src/modeles/fiche-personnage (lib/fiche-modele.mjs), les autres classeurs sont fabriqués ici.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import { decouperAdresse } from '../src/lib/fiche-tableur-cases.mjs';
import { ecrireXlsx, MAX_TEXTE, texteDeCase } from '../src/lib/tableur-ecriture.mjs';
import { analyserXml, enfantNomme, enfantsNommes, nomLocal, serialiserXml, texteDe } from '../src/lib/xml-mini.mjs';
import { crc32, ecrireZip, lireZip } from '../src/lib/zip.mjs';

const MODELE = await modeleXlsx();
const FEUILLE = 'xl/worksheets/sheet1.xml';
const DECODEUR = new TextDecoder();

// ---------- petit lecteur local ----------
const decoderOoxml = (t) => t.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

/** Relit un classeur : parties, arbres XML, cases de la première feuille (Map 'A1' → { s, t, v, f, texte }) et ordre des lignes / cases. */
async function relire(octets, feuille = FEUILLE) {
  const parties = await lireZip(octets);
  const xml = (chemin) => analyserXml(DECODEUR.decode(parties.get(chemin)));
  const chaines = parties.has('xl/sharedStrings.xml')
    ? enfantsNommes(xml('xl/sharedStrings.xml'), 'si').map((si) => decoderOoxml(
      [...enfantsNommes(si, 't'), ...enfantsNommes(si, 'r').flatMap((r) => enfantsNommes(r, 't'))].map(texteDe).join('')))
    : [];
  const racine = xml(feuille);
  const cases = new Map();
  const lignes = [];
  for (const row of enfantsNommes(enfantNomme(racine, 'sheetData'), 'row')) {
    const ligne = { r: Number(row.attrs.r), spans: row.attrs.spans, cases: [] };
    lignes.push(ligne);
    for (const c of enfantsNommes(row, 'c')) {
      const v = enfantNomme(c, 'v');
      const valeur = v ? texteDe(v) : null;
      const texte = c.attrs.t === 's' ? chaines[Number(valeur)] : valeur;
      cases.set(c.attrs.r, { s: c.attrs.s ?? '0', t: c.attrs.t, v: valeur, f: enfantNomme(c, 'f'), texte });
      ligne.cases.push(c.attrs.r);
    }
  }
  return { parties, xml, chaines, racine, cases, lignes };
}

const colonne = (r) => decouperAdresse(r).colonne;
function ordreVerifie(lignes) {
  for (let i = 1; i < lignes.length; i++) assert.ok(lignes[i].r > lignes[i - 1].r, `ligne ${lignes[i].r} après ${lignes[i - 1].r}`);
  for (const l of lignes) {
    l.cases.forEach((r, i) => {
      assert.equal(decouperAdresse(r).ligne, l.r, `${r} dans la ligne ${l.r}`);
      if (i) assert.ok(colonne(r) > colonne(l.cases[i - 1]), `${r} après ${l.cases[i - 1]}`);
    });
  }
}
const formules = (texte) => (texte.match(/<(?:[\w.-]+:)?f[\s/>]/g) ?? []).length;
const sstDe = (classeur) => classeur.xml('xl/sharedStrings.xml');
const nombreDeCasesTexte = (classeur) => [...classeur.cases.values()].filter((c) => c.t === 's').length;

// ---------- images de test ----------
/** Un PNG 1 × 1 valide (couleur donnée). */
function png(r = 10, g = 120, b = 200) {
  const morceau = (type, donnees) => {
    const tete = new Uint8Array(8);
    new DataView(tete.buffer).setUint32(0, donnees.length);
    tete.set(new TextEncoder().encode(type), 4);
    const corps = new Uint8Array([...tete.subarray(4), ...donnees]);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, crc32(corps));
    return [...tete.subarray(0, 4), ...corps, ...crc];
  };
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, 1);
  v.setUint32(4, 1);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...morceau('IHDR', ihdr),
    ...morceau('IDAT', deflateSync(new Uint8Array([0, r, g, b]))), ...morceau('IEND', new Uint8Array(0))]);
}
/** Un JPEG 2 × 2 valide (Pillow, qualité 50). */
const JPEG = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDHooorhPqD/9k=', 'base64'));

/** Le dessin du classeur : ancre en A1, cNvPr, cible de l'image, Override des médias. */
function dessinDe(classeur) {
  const dessin = classeur.xml('xl/drawings/drawing1.xml');
  const ancre = enfantsNommes(dessin).find((a) => nomLocal(a.nom) === 'twoCellAnchor');
  const pic = enfantNomme(ancre, 'pic');
  const cNvPr = enfantNomme(enfantNomme(pic, 'nvPicPr'), 'cNvPr');
  const rels = enfantsNommes(classeur.xml('xl/drawings/_rels/drawing1.xml.rels'), 'Relationship');
  const types = classeur.xml('[Content_Types].xml');
  const overrides = Object.fromEntries(enfantsNommes(types, 'Override').map((o) => [o.attrs.PartName, o.attrs.ContentType]));
  return { ancre: serialiserXml(enfantNomme(ancre, 'from'), { declaration: false }) + serialiserXml(enfantNomme(ancre, 'to'), { declaration: false }),
    cNvPr: cNvPr.attrs, cibles: rels.map((r) => r.attrs.Target), overrides };
}

// ---------- le modèle ----------
const modele = await relire(MODELE);

test('le modèle relu : une case par adresse, dans l’ordre, chaînes partagées comptées, aucune formule', () => {
  ordreVerifie(modele.lignes);
  assert.equal(Number(sstDe(modele).attrs.count), nombreDeCasesTexte(modele));
  assert.equal(Number(sstDe(modele).attrs.uniqueCount), modele.chaines.length);
  assert.equal(modele.cases.get('F1').texte, 'NOM');
  assert.equal(formules(DECODEUR.decode(modele.parties.get(FEUILLE))), 0);
});

test('valeurs : textes (sauts de ligne, & < > guillemets), nombres, vidage, chaînes partagées ajoutées une fois', async () => {
  const nom = 'Aldric l’Éclaireur & <Fils> "dit" \'le Gris\'\nseconde ligne';
  const sortie = await relire(await ecrireXlsx(MODELE, {
    cellules: {
      I1: nom, S3: nom, // même texte : une seule chaîne ajoutée
      S1: 42, I3: -3.5, W8: 0, L6: 1e21,
      F1: null, P1: '', // libellés du modèle vidés, leur style gardé
      AA1: 'NOM', // texte déjà dans le modèle : sa chaîne est reprise
      I2: '  espaces gardés  ',
      S2: Number.NaN, // nombre non fini : case vide plutôt qu'une valeur fausse
      I4: true,
    },
  }));
  const c = (a) => sortie.cases.get(a);
  assert.equal(c('I1').texte, nom);
  assert.equal(c('S3').texte, nom);
  assert.equal(c('I1').v, c('S3').v);
  assert.equal(c('I1').s, modele.cases.get('I1').s, 'style gardé');
  assert.deepEqual([c('S1').v, c('S1').t], ['42', undefined]);
  assert.equal(Number(c('I3').v), -3.5);
  assert.equal(c('W8').v, '0');
  assert.equal(Number(c('L6').v), 1e21);
  for (const a of ['F1', 'P1', 'S2']) {
    assert.equal(c(a).v, null, a);
    assert.equal(c(a).t, undefined, a);
    assert.equal(c(a).s, modele.cases.get(a).s, `${a} : style gardé`);
  }
  assert.equal(c('AA1').texte, 'NOM');
  assert.equal(c('AA1').v, modele.cases.get('F1').v, 'chaîne « NOM » reprise');
  assert.equal(c('I2').texte, '  espaces gardés  ');
  assert.deepEqual([c('I4').t, c('I4').v], ['b', '1']);

  // deux chaînes nouvelles (le nom, les espaces) ; count = cases à texte, uniqueCount = chaînes
  assert.equal(sortie.chaines.length, modele.chaines.length + 2);
  assert.equal(Number(sstDe(sortie).attrs.uniqueCount), sortie.chaines.length);
  assert.equal(Number(sstDe(sortie).attrs.count), nombreDeCasesTexte(sortie));
  // le texte d'une chaîne nouvelle garde ses espaces et ses sauts de ligne
  const ajout = enfantsNommes(sstDe(sortie), 'si').at(-2);
  assert.equal(enfantNomme(ajout, 't').attrs['xml:space'], 'preserve');
  assert.match(DECODEUR.decode(sortie.parties.get('xl/sharedStrings.xml')), /Aldric l’Éclaireur &amp; &lt;Fils&gt; "dit" 'le Gris'\nseconde ligne/);
  // les autres cases n'ont pas bougé
  for (const [a, avant] of modele.cases) {
    if (!['I1', 'S3', 'S1', 'I3', 'W8', 'L6', 'F1', 'P1', 'AA1', 'I2', 'S2', 'I4'].includes(a)) assert.deepEqual(sortie.cases.get(a), avant, a);
  }
  ordreVerifie(sortie.lignes);
  assert.equal(sortie.lignes.length, modele.lignes.length);
});

test('textes : tronqués au-delà de 32 767 caractères, « _xHHHH_ » protégé, caractères interdits retirés, fins de ligne \\n', async () => {
  const long = 'é'.repeat(MAX_TEXTE + 100);
  const paire = `${'a'.repeat(MAX_TEXTE - 2)}😀😀`; // 32 769 unités : la coupe tombe dans la première paire de substitution
  const sortie = await relire(await ecrireXlsx(MODELE, {
    cellules: { I1: long, S1: paire, I3: 'code _x0041_ écrit tel quel', S3: 'a\u0001b\u000bc\r\nd\re' },
  }));
  const i1 = sortie.cases.get('I1').texte;
  assert.equal(i1.length, MAX_TEXTE);
  assert.ok(i1.endsWith('é…'));
  const s1 = sortie.cases.get('S1').texte;
  assert.equal(s1, `${'a'.repeat(MAX_TEXTE - 2)}…`, 'paire de substitution jamais coupée');
  assert.equal(sortie.cases.get('I3').texte, 'code _x0041_ écrit tel quel');
  assert.match(DECODEUR.decode(sortie.parties.get('xl/sharedStrings.xml')), /code _x005F_x0041_ écrit/);
  assert.equal(sortie.cases.get('S3').texte, 'abc\nd\ne');
  assert.equal(texteDeCase('x'.repeat(MAX_TEXTE)), 'x'.repeat(MAX_TEXTE), 'exactement la limite : rien de coupé');
});

test('fonds : un fill par couleur, une copie de style par couple style × couleur, le reste du style recopié', async () => {
  const avant = modele.xml('xl/styles.xml');
  const xfsAvant = enfantsNommes(enfantNomme(avant, 'cellXfs'), 'xf');
  const fillsAvant = enfantsNommes(enfantNomme(avant, 'fills'), 'fill');
  const remplis = { AI2: '808080', AJ2: '808080', AK2: '808080', AL2: '3366cc', I1: '808080', CA90: '808080' };
  const sortie = await relire(await ecrireXlsx(MODELE, { remplis, cellules: { AI2: '2d' } }));
  const styles = sortie.xml('xl/styles.xml');
  const fills = enfantsNommes(enfantNomme(styles, 'fills'), 'fill');
  const xfs = enfantsNommes(enfantNomme(styles, 'cellXfs'), 'xf');
  assert.equal(fills.length, fillsAvant.length + 2, 'deux couleurs');
  assert.equal(Number(enfantNomme(styles, 'fills').attrs.count), fills.length);
  assert.equal(Number(enfantNomme(styles, 'cellXfs').attrs.count), xfs.length);
  // couples : 13 × 808080 (AI2), 14 × 808080 (AJ2, AK2), 14 × 3366CC (AL2), 3 × 808080 (I1), style de colonne × 808080 (CA90, inséré)
  const couples = new Set(Object.entries(remplis).map(([a, couleur]) => `${modele.cases.get(a)?.s ?? '1'}|${couleur.toUpperCase()}`));
  assert.equal(xfs.length, xfsAvant.length + couples.size);
  assert.equal(sortie.cases.get('AJ2').s, sortie.cases.get('AK2').s, 'même style, même couleur : même copie');
  for (const [a, couleur] of Object.entries(remplis)) {
    const s = Number(sortie.cases.get(a).s);
    assert.ok(s >= xfsAvant.length, `${a} : style copié`);
    const copie = xfs[s];
    const origine = xfsAvant[Number(modele.cases.get(a)?.s ?? '1')];
    assert.equal(copie.attrs.applyFill, 'true');
    const fill = fills[Number(copie.attrs.fillId)];
    const motif = enfantNomme(fill, 'patternFill');
    assert.equal(motif.attrs.patternType, 'solid');
    assert.equal(enfantNomme(motif, 'fgColor').attrs.rgb, `FF${couleur.toUpperCase()}`);
    // tout le reste du style est celui de la case
    const sans = (xf) => serialiserXml({ ...xf, attrs: { ...xf.attrs, fillId: null, applyFill: null } }, { declaration: false });
    assert.equal(sans(copie), sans(origine), a);
  }
  assert.equal(sortie.cases.get('AI2').texte, '2d');
  // fills 0 et 1 (réservés par Excel) en place, les anciens styles intacts
  assert.deepEqual(fills.slice(0, fillsAvant.length), fillsAvant);
  assert.deepEqual(xfs.slice(0, xfsAvant.length), xfsAvant);
  ordreVerifie(sortie.lignes);
});

test('alignements : retour à la ligne, réduction au besoin (qui s’excluent), alignement vertical ; une copie par style × alignement, après le fond', async () => {
  const xfsAvant = enfantsNommes(enfantNomme(modele.xml('xl/styles.xml'), 'cellXfs'), 'xf');
  const alignements = { I4: { retour: true }, L45: { retour: true }, AE55: { retour: false, reduire: true }, BA54: { vertical: 'top' }, AL2: { retour: true } };
  const sortie = await relire(await ecrireXlsx(MODELE, { alignements, remplis: { AL2: '3366CC' }, cellules: { L45: 'Un long texte' } }));
  const xfs = enfantsNommes(enfantNomme(sortie.xml('xl/styles.xml'), 'cellXfs'), 'xf');
  assert.equal(Number(enfantNomme(sortie.xml('xl/styles.xml'), 'cellXfs').attrs.count), xfs.length);
  const xfDe = (classeur, a) => (classeur === modele ? xfsAvant : xfs)[Number(classeur.cases.get(a).s)];
  const attrs = (xf) => ({ ...enfantNomme(xf, 'alignment').attrs });
  assert.deepEqual(attrs(xfDe(sortie, 'I4')), { ...attrs(xfDe(modele, 'I4')), wrapText: 'true' });
  assert.deepEqual(attrs(xfDe(sortie, 'AE55')), { ...attrs(xfDe(modele, 'AE55')), wrapText: 'false', shrinkToFit: 'true' });
  assert.deepEqual(attrs(xfDe(sortie, 'BA54')), { ...attrs(xfDe(modele, 'BA54')), vertical: 'top' });
  // le fond d'abord, puis l'alignement : la case a les deux
  assert.equal(enfantNomme(enfantNomme(enfantsNommes(enfantNomme(sortie.xml('xl/styles.xml'), 'fills'), 'fill')[Number(xfDe(sortie, 'AL2').attrs.fillId)], 'patternFill'), 'fgColor').attrs.rgb, 'FF3366CC');
  assert.equal(attrs(xfDe(sortie, 'AL2')).wrapText, 'true');
  // seul l'alignement change ; L47 (même style que L45 dans le modèle) garde le sien ; la valeur est écrite
  for (const a of Object.keys(alignements)) {
    const sans = (xf) => serialiserXml({ ...xf, attrs: { ...xf.attrs, applyAlignment: null, fillId: null, applyFill: null }, enfants: xf.enfants.filter((e) => typeof e !== 'object' || nomLocal(e.nom) !== 'alignment') }, { declaration: false });
    assert.equal(sans(xfDe(sortie, a)), sans(xfDe(modele, a)), a);
    assert.equal(xfDe(sortie, a).attrs.applyAlignment, 'true', a);
  }
  assert.equal(sortie.cases.get('L47').s, modele.cases.get('L47').s);
  assert.equal(sortie.cases.get('L45').texte, 'Un long texte');
  assert.deepEqual(xfs.slice(0, xfsAvant.length), xfsAvant, 'les anciens styles intacts');
  // refusés : retour et réduction ensemble, un alignement vertical inconnu, un retour qui n'est pas un booléen
  await assert.rejects(ecrireXlsx(MODELE, { alignements: { A1: { retour: true, reduire: true } } }), /alignement invalide/);
  await assert.rejects(ecrireXlsx(MODELE, { alignements: { A1: { vertical: 'milieu' } } }), /alignement invalide/);
  await assert.rejects(ecrireXlsx(MODELE, { alignements: { A1: { retour: 'oui' } } }), /alignement invalide/);
});

test('cases et lignes absentes insérées à leur rang (modèle), dimension élargie', async () => {
  const sortie = await relire(await ecrireXlsx(MODELE, { cellules: { CA1: 'à droite', B80: 7, A78: 'avant', I1: 'Nom', CA80: '' } }));
  ordreVerifie(sortie.lignes);
  assert.deepEqual(sortie.lignes.map((l) => l.r).slice(-2), [78, 80]);
  assert.deepEqual(sortie.lignes.at(-1).cases, ['B80'], 'une case vide n’est pas créée');
  assert.equal(sortie.lignes[0].cases.at(-1), 'CA1');
  assert.equal(sortie.cases.get('CA1').texte, 'à droite');
  assert.equal(sortie.cases.get('CA1').s, '1', 'style de la colonne (<col style="1">)');
  assert.equal(sortie.cases.get('B80').v, '7');
  assert.equal(enfantNomme(sortie.racine, 'dimension').attrs.ref, 'A1:CA80');
});

// ---------- un classeur fabriqué : lignes et cases implicites, formules, calcChain, sans chaînes partagées ----------
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const fabrique = (feuille) => ecrireZip([
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>'],
  ['_rels/.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="/xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml', `<workbook ${NS}><sheets><sheet name="Fiche" sheetId="1" r:id="rId1"/><sheet name="Autre" sheetId="2" r:id="rId2"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/>`
    + `<Relationship Id="rId3" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rId4" Type="${REL}/calcChain" Target="calcChain.xml"/></Relationships>`],
  ['xl/styles.xml', `<styleSheet ${NS}><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>`
    + '<cellXfs count="3"><xf fillId="0"/><xf fillId="0" fontId="0"><alignment wrapText="1"/></xf><xf fillId="0" applyFill="0"/></cellXfs></styleSheet>'],
  ['xl/calcChain.xml', `<calcChain ${NS}><c r="C2" i="1"/></calcChain>`],
  ['xl/worksheets/sheet1.xml', feuille],
  ['xl/worksheets/sheet2.xml', `<worksheet ${NS}><sheetData><row r="1"><c r="A1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>`],
]);

test('classeur fabriqué : rangs implicites, insertion au milieu, styles de ligne et de colonne, chaînes partagées créées, formules et calcChain retirées', async () => {
  const feuille = `<x:worksheet ${NS.replace('xmlns=', 'xmlns:x=')}><x:dimension ref="B2:D5"/><x:cols><x:col min="3" max="4" style="1"/></x:cols><x:sheetData>`
    + '<x:row r="2" spans="2:4"><x:c r="B2"><x:v>1</x:v></x:c><x:c><x:f>B2*2</x:f><x:v>2</x:v></x:c><x:c r="E2" s="2"/><x:extLst/></x:row>'
    + '<x:row r="5" s="2" customFormat="1"><x:c r="D5" t="str"><x:f>"a"&amp;"b"</x:f><x:v>ab</x:v></x:c></x:row>'
    + '<x:row><x:c><x:v>3</x:v></x:c></x:row>' // ligne 6, case A6 implicites
    + '</x:sheetData></x:worksheet>';
  const ecrit = await ecrireXlsx(await fabrique(feuille), {
    cellules: { A2: 'gauche', D2: 'milieu', F2: 'après', B3: 'ligne insérée', A5: 'début', E5: 5, A1: 'tout en haut', B9: 'à la fin', C2: 4 },
    remplis: { D2: 'FF0000', A5: 'FF0000' },
  });
  const sortie = await relire(ecrit);
  ordreVerifie(sortie.lignes);
  assert.deepEqual(sortie.lignes.map((l) => [l.r, l.cases]), [
    [1, ['A1']], [2, ['A2', 'B2', 'C2', 'D2', 'E2', 'F2']], [3, ['B3']], [5, ['A5', 'D5', 'E5']], [6, ['A6']], [9, ['B9']]]);
  const brut = DECODEUR.decode(sortie.parties.get(FEUILLE));
  assert.ok(brut.indexOf('r="F2"') < brut.indexOf('<x:extLst/>'), 'les cases avant extLst');
  assert.equal(sortie.lignes[1].spans, '1:6');
  assert.equal(enfantNomme(sortie.racine, 'dimension').attrs.ref, 'A1:F9');
  assert.equal(sortie.cases.get('C2').v, '4', 'la case à formule implicite reçoit sa valeur');
  assert.equal(sortie.cases.get('D2').texte, 'milieu');
  assert.equal(sortie.cases.get('A6').v, '3');
  // style d'une case insérée : celui de la ligne (customFormat), sinon de la colonne, sinon aucun
  assert.equal(sortie.cases.get('E5').s, '2');
  assert.equal(sortie.cases.get('A2').s, '0');
  assert.equal(sortie.cases.get('B3').s, '0');
  const styles = sortie.xml('xl/styles.xml');
  const xfs = enfantsNommes(enfantNomme(styles, 'cellXfs'), 'xf');
  assert.equal(xfs[Number(sortie.cases.get('D2').s)].attrs.fillId, '2', 'D2 (style de colonne 1) remplie');
  assert.deepEqual(enfantsNommes(xfs[Number(sortie.cases.get('D2').s)]).map((e) => e.nom), ['alignment'], 'copie du style 1');
  assert.equal(xfs[Number(sortie.cases.get('A5').s)].attrs.applyFill, 'true', 'A5 (style de ligne 2) remplie, applyFill remplacé');
  assert.equal(enfantNomme(styles, 'fills').attrs.count, '3');
  assert.equal(enfantNomme(styles, 'cellXfs').attrs.count, '5');
  // chaînes partagées créées : partie, relation, type
  assert.equal(sortie.cases.get('A1').texte, 'tout en haut');
  assert.equal(Number(sstDe(sortie).attrs.count), nombreDeCasesTexte(sortie));
  assert.equal(Number(sstDe(sortie).attrs.uniqueCount), sortie.chaines.length);
  const relations = enfantsNommes(sortie.xml('xl/_rels/workbook.xml.rels'), 'Relationship');
  assert.ok(relations.some((r) => r.attrs.Target === 'sharedStrings.xml' && r.attrs.Type.endsWith('/sharedStrings')));
  assert.equal(new Set(relations.map((r) => r.attrs.Id)).size, relations.length, 'identifiants de relation uniques');
  assert.ok(enfantsNommes(sortie.xml('[Content_Types].xml'), 'Override').some((o) => o.attrs.PartName === '/xl/sharedStrings.xml'));
  // aucune formule, dans aucune feuille ; leurs résultats gardés ; plus de calcChain
  for (const chemin of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.equal(formules(DECODEUR.decode(sortie.parties.get(chemin))), 0, chemin);
  assert.deepEqual([sortie.cases.get('D5').t, sortie.cases.get('D5').v], ['str', 'ab']);
  assert.equal((await relire(ecrit, 'xl/worksheets/sheet2.xml')).cases.get('A1').v, '2');
  assert.ok(!sortie.parties.has('xl/calcChain.xml'));
  assert.ok(!DECODEUR.decode(sortie.parties.get('xl/_rels/workbook.xml.rels')).includes('calcChain'));
  assert.ok(!DECODEUR.decode(sortie.parties.get('[Content_Types].xml')).includes('calcChain'));
});

test('image : un JPEG puis un PNG remplacent le logo en A1 (même ancre), types et relations à jour, nom et description', async () => {
  const avant = dessinDe(modele);
  assert.deepEqual(avant.cibles, ['../media/image1.png']);
  const ordreModele = [...modele.parties.keys()];

  // JPEG
  const avecJpeg = await ecrireXlsx(MODELE, { image: { octets: JPEG, type: 'image/jpeg' }, descriptionImage: 'portrait:abc123' });
  const j = await relire(avecJpeg);
  const dj = dessinDe(j);
  assert.equal(dj.ancre, avant.ancre, 'même ancre A1 → E5');
  assert.deepEqual(dj.cibles, ['../media/image1.jpeg']);
  assert.deepEqual(j.parties.get('xl/media/image1.jpeg'), JPEG);
  assert.ok(!j.parties.has('xl/media/image1.png'), 'l’ancien logo retiré');
  assert.equal(dj.overrides['/xl/media/image1.jpeg'], 'image/jpeg');
  assert.equal(dj.overrides['/xl/media/image1.png'], undefined);
  assert.deepEqual([dj.cNvPr.name, dj.cNvPr.descr], ['Portrait', 'portrait:abc123']);
  assert.deepEqual([...j.parties.keys()], ordreModele.map((n) => (n === 'xl/media/image1.png' ? 'xl/media/image1.jpeg' : n)), 'même place dans l’archive');
  for (const [chemin, type] of Object.entries(dj.overrides)) assert.ok(j.parties.has(chemin.slice(1)), `${chemin} (${type}) existe`);

  // puis PNG, sur le classeur au JPEG
  const image = png();
  const p = await relire(await ecrireXlsx(avecJpeg, { image: { octets: image, type: 'image/png' }, descriptionImage: 'portrait:def' }));
  const dp = dessinDe(p);
  assert.deepEqual(dp.cibles, ['../media/image1.png']);
  assert.deepEqual(p.parties.get('xl/media/image1.png'), image);
  assert.ok(!p.parties.has('xl/media/image1.jpeg'));
  assert.equal(dp.overrides['/xl/media/image1.png'], 'image/png');
  assert.equal(dp.overrides['/xl/media/image1.jpeg'], undefined);
  assert.deepEqual([dp.cNvPr.name, dp.cNvPr.descr], ['Portrait', 'portrait:def']);
  assert.equal(dp.ancre, avant.ancre);

  // PNG directement dans le modèle : même partie, octets remplacés
  const direct = await relire(await ecrireXlsx(MODELE, { image: { octets: image, type: 'image/png' } }));
  assert.deepEqual(direct.parties.get('xl/media/image1.png'), image);
  assert.deepEqual([...direct.parties.keys()], ordreModele);

  // sans image : le logo du modèle reste, nommé « Logo »
  const logo = await relire(await ecrireXlsx(MODELE, { descriptionImage: 'logo' }));
  assert.deepEqual(logo.parties.get('xl/media/image1.png'), modele.parties.get('xl/media/image1.png'));
  assert.deepEqual([dessinDe(logo).cNvPr.name, dessinDe(logo).cNvPr.descr], ['Logo', 'logo']);
  assert.deepEqual(dessinDe(logo).cibles, avant.cibles);
});

test('image refusée : type non pris en charge, octets d’un autre type', async () => {
  await assert.rejects(ecrireXlsx(MODELE, { image: { octets: png(), type: 'image/gif' } }), /Classeur impossible à écrire : image de type « image\/gif »/);
  await assert.rejects(ecrireXlsx(MODELE, { image: { octets: png(), type: 'image/jpeg' } }), /l’image n’est pas un JPEG/);
  await assert.rejects(ecrireXlsx(MODELE, { image: { octets: JPEG, type: 'image/png' } }), /l’image n’est pas un PNG/);
});

test('entrées refusées : adresse ou couleur mal formée, valeur d’un autre type', async () => {
  for (const adresse of ['A0', 'a1', 'XFE1', 'A1048577', 'A1:B2', '1A']) {
    await assert.rejects(ecrireXlsx(MODELE, { cellules: { [adresse]: 'x' } }), /adresse de case invalide/, adresse);
  }
  for (const couleur of ['red', '#FF0000', 'FF00000', 'FF00']) {
    await assert.rejects(ecrireXlsx(MODELE, { remplis: { A1: couleur } }), /couleur invalide/, couleur);
  }
  await assert.rejects(ecrireXlsx(MODELE, { cellules: { A1: { texte: 'x' } } }), /ni texte ni nombre/);
});

test('propriétés du document, parties inchangées gardées à l’octet près, sortie déterministe', async () => {
  const options = { cellules: { I1: 'Lucien', S1: 3 }, remplis: { AI2: '808080' }, titre: 'Lucien - Fiche Maverick V15.2.2', date: '2026-10-15T08:30:12.345Z' };
  const a = await ecrireXlsx(MODELE, options);
  const b = await ecrireXlsx(MODELE, options);
  assert.deepEqual(a, b);
  const sortie = await relire(a);
  const core = sortie.xml('docProps/core.xml');
  assert.equal(texteDe(enfantsNommes(core, 'title')[0]), 'Lucien - Fiche Maverick V15.2.2');
  const modifie = enfantsNommes(core, 'modified')[0];
  assert.equal(texteDe(modifie), '2026-10-15T08:30:12Z');
  assert.equal(modifie.attrs['xsi:type'], 'dcterms:W3CDTF');
  for (const chemin of ['xl/theme/theme1.xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', '_rels/.rels', '[Content_Types].xml', 'xl/media/image1.png']) {
    assert.deepEqual(sortie.parties.get(chemin), modele.parties.get(chemin), chemin);
  }
  // sans date ni titre : propriétés du modèle
  const simple = await relire(await ecrireXlsx(MODELE, {}));
  assert.deepEqual(simple.parties.get('docProps/core.xml'), modele.parties.get('docProps/core.xml'));
  assert.deepEqual(simple.parties.get('xl/styles.xml'), modele.parties.get('xl/styles.xml'));
  assert.deepEqual(simple.parties.get('xl/sharedStrings.xml'), modele.parties.get('xl/sharedStrings.xml'));
  // toutes les parties XML écrites se relisent
  for (const [chemin, octets] of sortie.parties) if (/\.(xml|rels)$/.test(chemin)) analyserXml(DECODEUR.decode(octets));
});
