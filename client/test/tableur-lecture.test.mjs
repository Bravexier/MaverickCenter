// Lecture d'un classeur en grille (lib/tableur-lecture.mjs) : la fiche de personnage en tableur. Le modèle de la fiche réassemblé puis relu ;
// un .xlsx, un .ods et des CSV fabriqués à la main (aucun binaire dans le dépôt), qui imitent ce qu'écrivent Excel, LibreOffice et Google
// Sheets (chaînes partagées riches, cases à cocher, préfixes inhabituels, répétitions, fusions, images ancrées, fonds) ; les refus.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { casesDesDes, dispositionDe, MAITRISES, ORDINATEUR } from '../src/lib/fiche-tableur-cases.mjs';
import { lireClasseur, MAX_CASES, MAX_REPETITION, MAX_TEXTE_LU, ZONE_DES_FONDS } from '../src/lib/tableur-lecture.mjs';
import { recollerLeTexte } from '../src/lib/tableur-mesure.mjs';
import { ecrireZip } from '../src/lib/zip.mjs';

const MODELE = fileURLToPath(new URL('../src/modeles/fiche-personnage/', import.meta.url));
const enc = new TextEncoder();

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 1, 2, 3]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 9, 8, 7]);
const INCONNU = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);

/** Archive des parties données ({ chemin: texte | octets }), dans l'ordre. */
const archive = (parties) => ecrireZip(Object.entries(parties));
/** Cases d'une feuille en objet simple { A1: [valeur, texte, remplissage] }, pour comparer d'un coup. */
const grille = (feuille) => Object.fromEntries([...feuille.cellules].map(([a, c]) => [a, [c.valeur, c.texte, c.remplissage]]));
const sansOctets = (images) => images.map(({ octets, ...reste }) => reste);

// ---------- le modèle de la fiche ----------
async function modeleXlsx() {
  const parties = readdirSync(MODELE, { recursive: true })
    .map((chemin) => String(chemin).replaceAll('\\', '/'))
    .filter((chemin) => statSync(join(MODELE, chemin)).isFile())
    .sort();
  const ordre = ['[Content_Types].xml', ...parties.filter((p) => p !== '[Content_Types].xml')];
  return ecrireZip(ordre.map((p) => [p, new Uint8Array(readFileSync(join(MODELE, p)))]));
}

test('le modèle de la fiche (client/src/modeles/fiche-personnage) assemblé puis relu : libellés, fonds, logo ancré de A1 à E5', async () => {
  const classeur = await lireClasseur(await modeleXlsx(), { nom: 'modele.xlsx' });
  assert.equal(classeur.format, 'xlsx');
  assert.deepEqual(classeur.feuilles, ['Personnage']);
  const f = classeur.feuille('Personnage');
  assert.equal(f.nom, 'Personnage');
  assert.equal(classeur.feuille(), f, 'feuille lue une fois puis gardée');
  const texte = (a) => f.cellules.get(a)?.texte ?? '';
  assert.equal(texte('F1'), 'NOM');
  assert.equal(texte('B21'), 'COMPÉTENCES');
  assert.equal(texte('AA21'), 'AP Base');
  assert.equal(dispositionDe(texte), ORDINATEUR, 'les libellés fixes désignent le modèle ordinateur');
  assert.deepEqual(f.cellules.get('AA1'), { valeur: "Maîtrise d'armes", texte: "Maîtrise d'armes", remplissage: 'B2B2B2' });
  assert.equal(texte('B18'), 'Force', 'texte riche (« F » en gras + « orce ») réuni');
  assert.equal(texte('BA2'), 'Immunité \n(dégâts subits =0)', 'saut de ligne d’une chaîne partagée');
  // zones de saisie vides et sans fond : absentes ; une case couverte par une fusion (AB1 dans AA1:AY1) : absente
  for (const a of ['I1', 'S1', ORDINATEUR.note, 'AB1']) assert.equal(f.cellules.has(a), false, a);
  // cases des dés de maîtrise : sans fond dans le modèle (un fond = un dé atteint à l'import)
  for (const m of MAITRISES) for (const a of casesDesDes(m)) assert.equal(f.cellules.get(a)?.remplissage ?? null, null, a);
  assert.equal(f.images.length, 1);
  const [logo] = f.images;
  assert.deepEqual(sansOctets([logo]), [{ de: 'A1', a: 'E5', type: 'image/png', nom: 'Logo', description: 'logo' }], 'le logo marqué comme l’export le marque');
  assert.deepEqual(logo.octets, new Uint8Array(readFileSync(join(MODELE, 'xl/media/image1.png'))));
});

// ---------- un .xlsx fait à la main ----------
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function partiesXlsx() {
  return {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="xml" ContentType="application/xml"/><Default Extension="emf" ContentType="image/x-emf"/>'
      + '<Override PartName="/xl/media/AUTRE.BIN" ContentType="image/x-inconnu"/></Types>',
    // le classeur n'est pas à l'adresse habituelle : seules les relations y mènent
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="r1" Type="${REL}/officeDocument" Target="xl/classeur.xml"/></Relationships>`,
    'xl/classeur.xml': `<x:workbook xmlns:x="${NS_MAIN}" xmlns:rel="${NS_REL}"><x:sheets>`
      + '<x:sheet name="Résumé" sheetId="1" rel:id="rId1"/><x:sheet name="Graphique" sheetId="3" rel:id="rId9"/>'
      + '<x:sheet name="Personnage" sheetId="2" rel:id="rId2"/></x:sheets></x:workbook>',
    'xl/_rels/classeur.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${REL}/worksheet" Target="feuilles/f1.xml"/>`
      + `<Relationship Id="rId2" Type="${REL}/worksheet" Target="/xl/feuilles/f2.xml"/>`
      + `<Relationship Id="rId9" Type="${REL}/chartsheet" Target="chartsheets/c1.xml"/>`
      + `<Relationship Id="rId3" Type="${REL}/sharedStrings" Target="chaines.xml"/>`
      + `<Relationship Id="rId4" Type="${REL}/styles" Target="styles.xml"/>`
      + `<Relationship Id="rId5" Type="${REL}/theme" Target="theme/theme1.xml"/></Relationships>`,
    'xl/chaines.xml': `<sst xmlns="${NS_MAIN}" count="6" uniqueCount="6">`
      + '<si><t>NOM</t></si>'
      + '<si><r><rPr><b/></rPr><t>F</t></r><r><t xml:space="preserve">orce </t></r><rPh sb="0" eb="1"><t>フォース</t></rPh><phoneticPr fontId="1"/></si>'
      + '<si><t>ligne 1_x000D_\nligne 2</t></si>'
      + '<si><t>_x005F_x0041_ et _x0041_</t></si>'
      + '<si><t/></si>'
      + '<si><t xml:space="preserve">  espaces  </t></si></sst>',
    'xl/styles.xml': `<styleSheet xmlns="${NS_MAIN}">`
      + '<numFmts count="2"><numFmt numFmtId="170" formatCode="0&quot; %&quot;"/><numFmt numFmtId="171" formatCode="0.0%"/></numFmts>'
      + '<fills count="9">'
      + '<fill><patternFill patternType="none"/></fill>'
      + '<fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid"><fgColor rgb="FFB2B2B2"/><bgColor indexed="64"/></patternFill></fill>'
      + '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>'
      + '<fill><patternFill patternType="solid"><fgColor theme="0" tint="-0.1499984740745262"/></patternFill></fill>'
      + '<fill><patternFill patternType="solid"><fgColor indexed="22"/></patternFill></fill>'
      + '<fill><patternFill patternType="solid"><fgColor theme="9"/></patternFill></fill>'
      + '<fill><gradientFill degree="90"><stop position="0"><color rgb="FF000000"/></stop></gradientFill></fill>'
      + '<fill><patternFill patternType="solid"><fgColor theme="42"/></patternFill></fill>'
      + '</fills><cellXfs count="12">'
      + '<xf fillId="0"/><xf fillId="2"/><xf fillId="3"/><xf fillId="4"/><xf fillId="5"/><xf fillId="1"/>'
      + '<xf fillId="0" numFmtId="9"/><xf numFmtId="171"/><xf numFmtId="170"/><xf fillId="6"/><xf fillId="7"/><xf fillId="8"/>'
      + '</cellXfs></styleSheet>',
    'xl/theme/theme1.xml': '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements><a:clrScheme name="C">'
      + '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
      + '<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>'
      + ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'].map((c, i) => `<a:accent${i + 1}><a:srgbClr val="${c}"/></a:accent${i + 1}>`).join('')
      + '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme></a:themeElements></a:theme>',
    'xl/feuilles/f1.xml': `<worksheet xmlns="${NS_MAIN}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>résumé</t></is></c></row></sheetData></worksheet>`,
    'xl/feuilles/f2.xml': `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheetData>`
      + '<row r="1"><c r="A1" t="s"><v>0</v></c><c t="s"><v>1</v></c>'
      + '<c r="D1" t="inlineStr"><is><t>en ligne</t></is></c>'
      + '<c t="inlineStr" s="1"><is><r><t xml:space="preserve">riche </t></r><r><t>en ligne</t></r><rPh><t>x</t></rPh></is></c></row>'
      // ligne sans r (= 2), cases sans r (A2, B2…)
      + '<row><c t="b"><v>1</v></c><c t="b"><v>0</v></c><c t="str"><f>A1&amp;"!"</f><v>NOM!</v></c>'
      + '<c t="e"><f>1/0</f><v>#DIV/0!</v></c><c><f>SUM(A1:A3)</f></c><c t="s"><v>2</v></c><c t="s"><v>3</v></c><c t="s"><v>4</v></c>'
      + '<c t="s"><v>5</v></c></row>'
      + '<row r="5"><c r="A5"><v>42</v></c><c r="B5" t="n"><v>-1.5E2</v></c><c r="C5" s="6"><v>0.18</v></c><c r="D5" s="7"><v>0.1234</v></c>'
      + '<c r="E5" s="8"><v>5</v></c><c r="F5"><v>0.30000000000000004</v></c><c r="G5" t="d"><v>2026-10-15T00:00:00</v></c>'
      + '<c r="H5" t="str"><v>a_x000D_b</v></c></row>'
      + '<row r="7"><c r="A7" s="1"/><c r="B7" s="2"/><c r="C7" s="3"/><c r="D7" s="4"/><c r="E7" s="5"/><c r="F7" s="9"/><c r="G7" s="10"/>'
      + '<c r="H7" s="11"/><c r="I7"/><c r="J7" s="1"><v>7</v></c></row>'
      // une fusion K9:L10 : la case du haut à gauche seule (la valeur cachée de L9 et le fond de K10 n'en font pas partie)
      + '<row r="9"><c r="K9" s="1" t="inlineStr"><is><t>fusion</t></is></c><c r="L9" s="1"><v>99</v></c></row>'
      + '<row r="10"><c r="K10" s="1"/></row>'
      + '</sheetData><mergeCells count="1"><mergeCell ref="K9:L10"/></mergeCells><drawing r:id="rId1"/></worksheet>',
    'xl/feuilles/_rels/f2.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${REL}/drawing" Target="../dessins/d1.xml"/></Relationships>`,
    'xl/dessins/d1.xml': '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" '
      + `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_REL}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">`
      + '<xdr:oneCellAnchor><xdr:from><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>9</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="1" cy="1"/>'
      + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Portrait" descr="portrait:abc"/><xdr:cNvPicPr/></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip r:embed="rId7"/></xdr:blipFill><xdr:spPr/></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>'
      + '<xdr:absoluteAnchor><xdr:pos x="0" y="0"/><xdr:ext cx="1" cy="1"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="3" name="Flottante"/></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip r:embed="rId7"/></xdr:blipFill></xdr:pic></xdr:absoluteAnchor>'
      + '<mc:AlternateContent><mc:Choice Requires="a14"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from>'
      + '<xdr:to><xdr:col>4</xdr:col><xdr:row>4</xdr:row></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="4" name="Logo" descr="" title="logo"/></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip r:embed="rId8"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor></mc:Choice>'
      + '<mc:Fallback><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:to><xdr:col>4</xdr:col><xdr:row>4</xdr:row></xdr:to>'
      + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="5" name="Doublon"/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId8"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor>'
      + '</mc:Fallback></mc:AlternateContent>'
      + '<xdr:twoCellAnchor><xdr:from><xdr:col>5</xdr:col><xdr:row>5</xdr:row></xdr:from><xdr:to><xdr:col>6</xdr:col><xdr:row>6</xdr:row></xdr:to>'
      + '<xdr:sp><xdr:nvSpPr><xdr:cNvPr id="6" name="Forme"/></xdr:nvSpPr></xdr:sp></xdr:twoCellAnchor>'
      + '<xdr:oneCellAnchor><xdr:from><xdr:col>27</xdr:col><xdr:row>99</xdr:row></xdr:from><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="7" name="Inconnue"/></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip r:embed="rId10"/></xdr:blipFill></xdr:pic></xdr:oneCellAnchor>'
      + '<xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:row>1</xdr:row></xdr:from><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="8" name="Liée"/></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip r:link="rId11"/></xdr:blipFill></xdr:pic></xdr:oneCellAnchor></xdr:wsDr>',
    'xl/dessins/_rels/d1.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId7" Type="${REL}/image" Target="../media/portrait.jpeg"/>`
      + `<Relationship Id="rId8" Type="${REL}/image" Target="../Media/Autre.bin"/>`
      + `<Relationship Id="rId10" Type="${REL}/image" Target="../media/dessin%201.emf"/>`
      + `<Relationship Id="rId11" Type="${REL}/image" Target="https://exemple.org/x.png" TargetMode="External"/></Relationships>`,
    'xl/media/portrait.jpeg': JPEG,
    'xl/media/AUTRE.BIN': PNG, // autre casse que la cible : OPC ne distingue pas la casse ; type tiré des octets malgré le type déclaré
    'xl/media/dessin 1.emf': INCONNU, // cible encodée (%20) ; octets inconnus : le type déclaré
  };
}

test('xlsx fait à la main : relations, feuilles, chaînes partagées riches, types de case, r absents, _xHHHH_, nombres et pourcentages', async () => {
  const classeur = await lireClasseur(await archive(partiesXlsx()), { nom: 'perso.xlsx' });
  assert.equal(classeur.format, 'xlsx');
  assert.deepEqual(classeur.feuilles, ['Résumé', 'Personnage'], 'la feuille de graphique n’est pas une feuille de cases');
  assert.equal(classeur.feuille().nom, 'Résumé', 'sans nom : la première');
  assert.equal(classeur.feuille('inconnue').nom, 'Résumé', 'nom inconnu : la première');
  assert.equal(classeur.feuille('RESUME').nom, 'Résumé', 'comparée par cle()');
  const f = classeur.feuille('Personnage');
  assert.equal(f, classeur.feuille('personnage'));
  assert.deepEqual(grille(f), {
    A1: ['NOM', 'NOM', null],
    B1: ['Force ', 'Force ', null], // les <t> des <r>, jamais ceux de <rPh>
    D1: ['en ligne', 'en ligne', null],
    E1: ['riche en ligne', 'riche en ligne', 'B2B2B2'],
    A2: [true, 'TRUE', null],
    B2: [false, 'FALSE', null],
    C2: ['NOM!', 'NOM!', null], // résultat texte d'une formule ; la formule n'est jamais lue
    D2: ['#DIV/0!', '#DIV/0!', null],
    // E2 : formule sans résultat = vide ; H2 : chaîne vide
    F2: ['ligne 1\nligne 2', 'ligne 1\nligne 2', null], // _x000D_ puis saut de ligne → un saut de ligne
    G2: ['_x0041_ et A', '_x0041_ et A', null], // _x005F_ protège un « _ » ; décodé en une passe
    I2: ['  espaces  ', '  espaces  ', null],
    A5: [42, '42', null],
    B5: [-150, '-150', null],
    C5: [0.18, '18 %', null],
    D5: [0.1234, '12.3 %', null],
    E5: [5, '5', null], // « % » entre guillemets : pas un pourcentage
    F5: [0.30000000000000004, '0.3', null],
    G5: ['2026-10-15T00:00:00', '2026-10-15T00:00:00', null],
    H5: ['a\nb', 'a\nb', null],
    A7: ['', '', 'B2B2B2'], // vide mais remplie
    // B7 : fond blanc ; E7 : motif gray125 ; G7 : dégradé ; I7 : sans style → absentes
    C7: ['', '', 'D9D9D9'], // couleur 0 du thème (lt1, blanc) assombrie de 15 %
    D7: ['', '', 'C0C0C0'], // palette indexée d'Excel
    F7: ['', '', '70AD47'], // couleur 9 du thème : accent6
    H7: ['', '', 'THEME'], // couleur de thème introuvable : remplie quand même
    J7: [7, '7', 'B2B2B2'],
    K9: ['fusion', 'fusion', 'B2B2B2'],
  });
  assert.deepEqual(sansOctets(f.images), [
    { de: 'C10', a: null, type: 'image/jpeg', nom: 'Portrait', description: 'portrait:abc' },
    { de: 'A1', a: 'E5', type: 'image/png', nom: 'Logo', description: 'logo' },
    { de: 'AB100', a: null, type: 'image/x-emf', nom: 'Inconnue', description: '' },
  ]);
  assert.deepEqual(f.images[0].octets, JPEG);
  assert.deepEqual(f.images[1].octets, PNG);
  assert.deepEqual(grille(classeur.feuille('Résumé')), { A1: ['résumé', 'résumé', null] });
  assert.deepEqual(classeur.feuille('Résumé').images, []);
});

test('xlsx : partie manquante ou XML abîmé — erreur claire à la lecture de la feuille', async () => {
  const sansFeuille = partiesXlsx();
  delete sansFeuille['xl/feuilles/f2.xml'];
  const c1 = await lireClasseur(await archive(sansFeuille));
  assert.deepEqual(c1.feuilles, ['Résumé', 'Personnage']);
  assert.throws(() => c1.feuille('Personnage'), { message: 'Le classeur est incomplet : « xl/feuilles/f2.xml » manque.' });
  const abime = { ...partiesXlsx(), 'xl/feuilles/f2.xml': `<worksheet xmlns="${NS_MAIN}"><sheetData><row></sheetData></worksheet>` };
  const c2 = await lireClasseur(await archive(abime));
  assert.throws(() => c2.feuille('Personnage'), /^Error: xl\/feuilles\/f2\.xml : XML illisible : .*\(ligne 1\)\.$/);
  // le classeur à l'adresse habituelle, sans _rels/.rels : trouvé quand même
  const habituel = {
    'xl/workbook.xml': `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="Personnage" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS_MAIN}"><sheetData><row r="3"><c r="B3"><v>1</v></c></row></sheetData></worksheet>`,
  };
  const c3 = await lireClasseur(await archive(habituel));
  assert.deepEqual(grille(c3.feuille('Personnage')), { B3: [1, '1', null] });
});

// ---------- un .ods fait à la main ----------
// Préfixes inhabituels (o:, t:, p:…), un préfixe « table » qui désigne un AUTRE espace de noms (piège), un espace de noms par défaut.
const ESPACES = 'xmlns:o="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:t="urn:oasis:names:tc:opendocument:xmlns:table:1.0" '
  + 'xmlns:p="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:s="urn:oasis:names:tc:opendocument:xmlns:style:1.0" '
  + 'xmlns:f="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:d="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" '
  + 'xmlns:l="http://www.w3.org/1999/xlink" xmlns:g="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:table="urn:exemple:piege"';

function contenuOds(lignes, { colonnes = '<t:table-column t:number-columns-repeated="1024"/>', autres = '' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><o:document-content ${ESPACES} o:version="1.2"><o:automatic-styles>`
    + '<s:style s:name="fond" s:family="table-cell"><s:table-cell-properties f:background-color="#b2b2b2"/></s:style>'
    + '<s:style s:name="fond" s:family="table-column"><s:table-column-properties f:background-color="#ff0000"/></s:style>'
    + '<s:style s:name="blanc" s:family="table-cell"><s:table-cell-properties f:background-color="#FFFFFF"/></s:style>'
    + '<s:style s:name="transp" s:family="table-cell" s:parent-style-name="Commun"><s:table-cell-properties f:background-color="transparent"/></s:style>'
    + '<s:style s:name="herite" s:family="table-cell" s:parent-style-name="Commun"/>'
    + '<s:style s:name="colonne" s:family="table-cell"><s:table-cell-properties f:background-color="#0f0"/></s:style>'
    + `</o:automatic-styles><o:body><o:spreadsheet>${autres}<t:table t:name="Personnage">${colonnes}${lignes}</t:table></o:spreadsheet></o:body></o:document-content>`;
}
// le style commun est dans styles.xml, avec d'autres préfixes encore
const STYLES_ODS = '<bureau:document-styles xmlns:bureau="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
  + 'xmlns:st="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:xf="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">'
  + '<bureau:styles><st:default-style st:family="table-cell"><st:table-cell-properties xf:background-color="transparent"/></st:default-style>'
  + '<st:style st:name="Commun" st:family="table-cell"><st:table-cell-properties xf:background-color="#ffcc00"/></st:style></bureau:styles>'
  + '</bureau:document-styles>';

const LIGNES_ODS = '<t:table-header-rows><t:table-row>'
  // A1 : fusion A1:E5 qui porte l'image (draw:frame avec un <text:p/> vide dans draw:image : pas du texte de la case)
  + '<t:table-cell t:number-columns-spanned="5" t:number-rows-spanned="5" t:style-name="fond">'
  + '<d:frame d:name="Images 2" t:end-cell-address="Personnage.E5" g:width="2.6cm"><d:image l:href="Pictures/logo.png"><p:p/></d:image>'
  + '<g:title>Titre</g:title><g:desc>logo</g:desc></d:frame></t:table-cell>'
  + '<t:covered-table-cell t:number-columns-repeated="4" t:style-name="fond"/>'
  + '<t:table-cell o:value-type="string" t:style-name="fond"><p:p>NOM</p:p></t:table-cell></t:table-row></t:table-header-rows>'
  + '<t:table-row-group><t:table-rows><t:table-row t:number-rows-repeated="2">'
  + '<t:covered-table-cell t:number-columns-repeated="5"><p:p>caché</p:p></t:covered-table-cell>'
  + '<t:table-cell o:value-type="float" o:value="1.5" t:number-columns-repeated="2"><p:p>1,5</p:p></t:table-cell>'
  + '<t:table-cell/>'
  + '<t:table-cell o:value-type="boolean" o:boolean-value="true"><p:p>VRAI</p:p></t:table-cell>'
  + '</t:table-row></t:table-rows></t:table-row-group>'
  + '<t:table-row><t:covered-table-cell t:number-columns-repeated="5"/>'
  + '<t:table-cell o:value-type="string"><p:p>  début<p:s p:c="3"/>fin  </p:p><p:p>deux<p:line-break/>trois<p:tab/>quatre</p:p>'
  + '<p:p><p:span>en <p:a l:href="https://exemple.org">lien</p:a></p:span>  et\n   espaces</p:p>'
  + '<o:annotation><p:p>commentaire</p:p></o:annotation></t:table-cell>'
  + '<t:table-cell o:value-type="string" o:string-value="valeur cachée"><p:p>affiché</p:p></t:table-cell>'
  + '<t:table-cell o:value-type="percentage" o:value="0.18"><p:p>18 %</p:p></t:table-cell>'
  + '<t:table-cell o:value-type="currency" o:value="12" o:currency="EUR"/>'
  + '<t:table-cell t:formula="of:=TRUE()" o:value-type="float" o:value="1"><p:p>TRUE</p:p></t:table-cell>'
  + '<t:table-cell o:value-type="date" o:date-value="2026-10-15"><p:p>15/10/2026</p:p>'
  + '<d:g><d:frame d:name="Portrait"><d:image l:href="https://exemple.org/x.png"/><d:image l:href="./Pictures/p.jpg"><p:p>non</p:p></d:image>'
  + '<g:title>portrait:xyz</g:title></d:frame></d:g></t:table-cell>'
  + '<t:table-cell o:value-type="string" xmlns="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><p>défaut</p></t:table-cell>'
  + '<t:table-cell><p:p>sans type</p:p></t:table-cell>'
  + '<table:table-cell><p:p>piège</p:p></table:table-cell>'
  + '<t:table-cell t:style-name="blanc"/><t:table-cell t:style-name="herite"/><t:table-cell t:style-name="transp"/>'
  + '<t:table-cell t:style-name="fond" t:number-columns-repeated="2"/></t:table-row>'
  + '<t:table-row><t:covered-table-cell t:number-columns-repeated="5"/><t:table-cell t:number-columns-repeated="10"/>'
  + '<t:table-cell t:number-columns-repeated="1009"/></t:table-row>'
  + '<t:table-row t:number-rows-repeated="1048570"><t:table-cell t:number-columns-repeated="1024"/></t:table-row>';

test('ods fait à la main : préfixes résolus par les xmlns, répétitions, fusions, types, texte des paragraphes, fonds, image ancrée', async () => {
  const contenu = contenuOds(LIGNES_ODS, {
    // colonne G : style par défaut « colonne » (vert) pour ses cases sans style
    colonnes: '<t:table-columns><t:table-column t:number-columns-repeated="6"/><t:table-column t:default-cell-style-name="colonne"/>'
      + '<t:table-column t:number-columns-repeated="1017"/></t:table-columns>',
    autres: '<t:table t:name="Autre"><t:table-row><t:table-cell o:value-type="string"><p:p>autre</p:p></t:table-cell></t:table-row></t:table>',
  });
  const ods = await archive({
    mimetype: 'application/vnd.oasis.opendocument.spreadsheet',
    'content.xml': contenu,
    'styles.xml': STYLES_ODS,
    'Pictures/logo.png': PNG,
    'Pictures/p.jpg': JPEG,
  });
  const classeur = await lireClasseur(ods, { nom: 'fiche.ods' });
  assert.equal(classeur.format, 'ods');
  assert.deepEqual(classeur.feuilles, ['Autre', 'Personnage']);
  assert.deepEqual(grille(classeur.feuille()), { A1: ['autre', 'autre', null] });
  const f = classeur.feuille('Personnage');
  assert.deepEqual(grille(f), {
    A1: ['', '', 'B2B2B2'], // l'image n'est pas du texte ; couvertes : B1…E5 absentes (même avec un texte caché)
    F1: ['NOM', 'NOM', 'B2B2B2'],
    F2: [1.5, '1,5', null], G2: [1.5, '1,5', '00FF00'], F3: [1.5, '1,5', null], G3: [1.5, '1,5', '00FF00'], // ligne et case répétées
    I2: [true, 'VRAI', null], I3: [true, 'VRAI', null],
    // blancs littéraux gardés tels quels, comme LibreOffice les relit (espace de tête, suites d'espaces, saut de ligne et retrait)
    F4: ['  début   fin  \ndeux\ntrois\tquatre\nen lien  et\n   espaces', '  début   fin  \ndeux\ntrois\tquatre\nen lien  et\n   espaces', null],
    G4: ['valeur cachée', 'valeur cachée', '00FF00'],
    H4: [0.18, '18 %', null],
    I4: [12, '12', null],
    J4: [1, 'TRUE', null], // case à cocher convertie par LibreOffice : un nombre et son texte
    K4: ['2026-10-15', '15/10/2026', null],
    L4: ['défaut', 'défaut', null],
    M4: ['sans type', 'sans type', null],
    // la cellule du piège n'est pas une cellule : N4 est la suivante (blanche → absente)
    O4: ['', '', 'FFCC00'], // parent dans styles.xml
    // P4 : transparent ; Q4, R4 : vides remplies
    Q4: ['', '', 'B2B2B2'], R4: ['', '', 'B2B2B2'],
    G5: ['', '', '00FF00'], // vide, sans style : celui de la colonne
    // 1 048 570 lignes vides répétées : rien, même la colonne verte (décor des bords)
  });
  assert.deepEqual(sansOctets(f.images), [
    { de: 'A1', a: 'E5', type: 'image/png', nom: 'Images 2', description: 'logo' },
    { de: 'K4', a: null, type: 'image/jpeg', nom: 'Portrait', description: 'portrait:xyz' },
  ]);
  assert.deepEqual(f.images[0].octets, PNG);
  assert.deepEqual(f.images[1].octets, JPEG);
});

test('ods : sans mimetype (content.xml seul) ; valeur répétée plus de MAX_REPETITION fois refusée ; autre document OpenDocument refusé', async () => {
  const simple = contenuOds('<t:table-row><t:table-cell o:value-type="float" o:value="3"><p:p>3</p:p></t:table-cell></t:table-row>');
  const c = await lireClasseur(await archive({ 'content.xml': simple }));
  assert.equal(c.format, 'ods');
  assert.deepEqual(grille(c.feuille('Personnage')), { A1: [3, '3', null] });

  const repetee = (lignes, colonnes) => contenuOds(`<t:table-row t:number-rows-repeated="${lignes}">`
    + `<t:table-cell o:value-type="string" t:number-columns-repeated="${colonnes}"><p:p>x</p:p></t:table-cell></t:table-row>`);
  const permise = await lireClasseur(await archive({ 'content.xml': repetee(10, MAX_REPETITION / 10) }));
  assert.equal(permise.feuille().cellules.size, MAX_REPETITION);
  const bombe = await lireClasseur(await archive({ 'content.xml': repetee(1_000_000, 1024) }));
  assert.throws(() => bombe.feuille(), /répète une même case 1024000000 fois/);

  const texte = await archive({
    mimetype: 'application/vnd.oasis.opendocument.text',
    'content.xml': '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"><office:body><office:text/></office:body></office:document-content>',
  });
  await assert.rejects(lireClasseur(texte), { message: 'Ce fichier n’est pas un classeur .xlsx ou .ods.' });
});

// ---------- CSV ----------
const csv = (texte, nom) => lireClasseur(enc.encode(texte), { nom });

test('CSV : séparateur « ; » (Excel en français), BOM, guillemets, « "" », sauts de ligne entre guillemets, lignes vides', async () => {
  const c = await csv('﻿NOM;Aldric;"a;b"\r\n;"deux\r\nlignes";"dit ""oui"""\r\n\r\nBois ×2, Fer ×1;42;\r\n', 'Ma fiche - Personnage.csv');
  assert.equal(c.format, 'csv');
  assert.deepEqual(c.feuilles, ['Ma fiche - Personnage']);
  const f = c.feuille('Personnage');
  assert.equal(f.nom, 'Ma fiche - Personnage');
  assert.deepEqual(grille(f), {
    A1: ['NOM', 'NOM', null], B1: ['Aldric', 'Aldric', null], C1: ['a;b', 'a;b', null],
    B2: ['deux\nlignes', 'deux\nlignes', null], C2: ['dit "oui"', 'dit "oui"', null],
    A4: ['Bois ×2, Fer ×1', 'Bois ×2, Fer ×1', null], B4: ['42', '42', null], // un CSV n'a pas de type : du texte
  });
  assert.deepEqual(f.images, []);
});

test('CSV : séparateur « , » (Google Sheets) et tabulation ; Windows-1252 ; UTF-16 avec BOM ; nom de feuille par défaut', async () => {
  const virgule = await csv('NOM,Aldric,\n"x; y","1,5",3\n;,;,;\n');
  assert.deepEqual(grille(virgule.feuille()), {
    A1: ['NOM', 'NOM', null], B1: ['Aldric', 'Aldric', null], A2: ['x; y', 'x; y', null], B2: ['1,5', '1,5', null], C2: ['3', '3', null],
    A3: [';', ';', null], B3: [';', ';', null], C3: [';', ';', null],
  });
  assert.deepEqual(virgule.feuilles, ['Feuille 1']);
  const tab = await csv('a\tb;c\n"c\td"\te\r');
  assert.deepEqual(grille(tab.feuille()), { A1: ['a', 'a', null], B1: ['b;c', 'b;c', null], A2: ['c\td', 'c\td', null], B2: ['e', 'e', null] });
  // Windows-1252 : « Épée;Arc » (É = C9, é = E9) et « € » (80)
  const ansi = await lireClasseur(Uint8Array.from([0xc9, 0x70, 0xe9, 0x65, 0x3b, 0x41, 0x72, 0x63, 0x0d, 0x0a, 0x80, 0x3b, 0x32, 0x0d, 0x0a]));
  assert.deepEqual(grille(ansi.feuille()), { A1: ['Épée', 'Épée', null], B1: ['Arc', 'Arc', null], A2: ['€', '€', null], B2: ['2', '2', null] });
  // « Texte Unicode » d'Excel : UTF-16 LE avec BOM, tabulations
  const texte = 'NOM\tAldric\r\nRACE\tHumain\r\n';
  const utf16 = new Uint8Array(2 + texte.length * 2);
  utf16.set([0xff, 0xfe]);
  for (let i = 0; i < texte.length; i++) utf16.set([texte.charCodeAt(i) & 0xff, texte.charCodeAt(i) >> 8], 2 + i * 2);
  assert.deepEqual(grille((await lireClasseur(utf16)).feuille()), {
    A1: ['NOM', 'NOM', null], B1: ['Aldric', 'Aldric', null], A2: ['RACE', 'RACE', null], B2: ['Humain', 'Humain', null],
  });
});

// ---------- refus ----------
test('refus : fichier vide, binaire quelconque, ancien .xls, ZIP sans classeur, .docx, ZIP abîmé', async () => {
  await assert.rejects(lireClasseur(new Uint8Array(0)), { message: 'Ce fichier est vide.' });
  await assert.rejects(lireClasseur('NOM;Aldric'), { message: 'Aucun fichier à lire.' });
  await assert.rejects(lireClasseur(PNG), { message: 'Ce fichier n’est ni un classeur .xlsx ou .ods, ni un tableau .csv.' });
  await assert.rejects(lireClasseur(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])), /\(\.xls\).*enregistrez-le au format \.xlsx/);
  const pasUnClasseur = { message: 'Ce fichier n’est pas un classeur .xlsx ou .ods.' };
  await assert.rejects(lireClasseur(await archive({ 'lisez-moi.txt': 'bonjour' })), pasUnClasseur);
  const docx = await archive({
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
  });
  await assert.rejects(lireClasseur(docx), pasUnClasseur);
  const xlsxVide = await archive({
    'xl/workbook.xml': `<workbook xmlns="${NS_MAIN}"><sheets/></workbook>`,
  });
  await assert.rejects(lireClasseur(xlsxVide), { message: 'Ce classeur n’a aucune feuille de calcul.' });
  const tronque = (await archive({ 'xl/workbook.xml': '<workbook/>' })).slice(0, 40);
  await assert.rejects(lireClasseur(tronque), /^Error: Fichier ZIP illisible : /);
  // un ArrayBuffer est accepté comme un Uint8Array
  assert.equal((await lireClasseur(new Uint8Array(enc.encode('a;b\n')).buffer)).format, 'csv');
});

// ---------- .ods écrit par LibreOffice : blancs littéraux ----------
const ESPACES_LO = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" '
  + 'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"';
const caseLo = (paragraphes) => `<table:table-cell office:value-type="string" calcext:value-type="string">${paragraphes}</table:table-cell>`;
const odsLo = (lignes) => archive({
  mimetype: 'application/vnd.oasis.opendocument.spreadsheet',
  'content.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content ${ESPACES_LO} office:version="1.3"><office:body><office:spreadsheet>`
    + `<table:table table:name="Personnage">${lignes.map((l) => `<table:table-row>${l}</table:table-row>`).join('')}</table:table>`
    + '</office:spreadsheet></office:body></office:document-content>',
});

test('ods de LibreOffice (24.2) : espaces d’une case de plusieurs paragraphes écrits tels quels, relus tels quels ; une suite « ⏎  ⏎ » se recolle', async () => {
  // ce qu'écrit LibreOffice en convertissant l'export du site : text:s dans une case d'un paragraphe, espaces littéraux dans une case de plusieurs
  const c = await lireClasseur(await odsLo([
    caseLo('<text:p>Bob <text:s/>Le <text:s/>Grand</text:p>'),
    caseLo('<text:p>  indentée de deux</text:p><text:p>mots  séparés  par  deux</text:p><text:p/><text:p/><text:p>fin</text:p>'),
    caseLo('<text:p>Forge de ses …</text:p>'),
    caseLo('<text:p>Notes</text:p><text:p>Suite de la case A3 : mains une lame ⏎  ⏎ Puis la trempe ⏎  ⏎  ⏎ dans le sang</text:p>'),
    caseLo('<text:p> </text:p>') + caseLo('<text:p>a\tb</text:p>') + caseLo('<text:p>x<text:s text:c="3"/>y<text:tab/>z<text:line-break/>w</text:p>'),
  ]), { nom: 'lo.ods' });
  const texte = (a) => c.feuille().cellules.get(a)?.texte;
  assert.equal(texte('A1'), 'Bob  Le  Grand');
  assert.equal(texte('A2'), '  indentée de deux\nmots  séparés  par  deux\n\n\nfin', 'espace de tête et espaces doubles gardés');
  assert.equal(texte('A5'), ' ');
  assert.equal(texte('B5'), 'a\tb');
  assert.equal(texte('C5'), 'x   y\tz\nw');
  const suite = texte('A4').split('\n')[1].replace(/^Suite de la case A3 : /, '');
  assert.equal(recollerLeTexte(texte('A3'), suite), 'Forge de ses mains une lame\n\nPuis la trempe\n\n\ndans le sang');
});

// ---------- trouver(test) ----------
/** Un .xlsx de feuilles nommées, chacune { nom, cases: { A1: texte } } ou { nom, absente: true } (partie manquante). */
function xlsxDeFeuilles(feuilles) {
  const parties = {
    'xl/workbook.xml': `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>`
      + feuilles.map((f, i) => `<sheet name="${f.nom}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>',
  };
  feuilles.forEach((f, i) => {
    if (f.absente) return;
    const cases = Object.entries(f.cases ?? {}).map(([a, t]) => `<row r="${a.slice(1)}"><c r="${a}" t="inlineStr"><is><t>${t}</t></is></c></row>`).join('');
    parties[`xl/worksheets/sheet${i + 1}.xml`] = `<worksheet xmlns="${NS_MAIN}"><sheetData>${cases}</sheetData></worksheet>`;
  });
  return archive(parties);
}

test('trouver(test) : « Personnage » (comparée par cle()) d’abord, puis les autres dans l’ordre ; null si aucune ; une feuille illisible passée', async () => {
  const essayees = [];
  const fiche = (f) => {
    essayees.push(f.nom);
    return f.cellules.get('F1')?.texte === 'NOM';
  };
  // onglet renommé et déplacé : retrouvé à son contenu
  const renomme = await lireClasseur(await xlsxDeFeuilles([{ nom: 'BDD' }, { nom: 'Race', cases: { A1: 'Elfe' } }, { nom: 'Fiche de Lucien', cases: { F1: 'NOM' } }]));
  const trouvee = renomme.trouver(fiche);
  assert.equal(trouvee.nom, 'Fiche de Lucien');
  assert.deepEqual(essayees, ['BDD', 'Race', 'Fiche de Lucien']);
  assert.equal(renomme.feuille('Fiche de Lucien'), trouvee, 'même feuille, lue une fois');
  // « PERSONNAGE » en troisième, essayée la première même si une autre convient aussi
  essayees.length = 0;
  const deux = await lireClasseur(await xlsxDeFeuilles([{ nom: 'Notes', cases: { F1: 'NOM' } }, { nom: 'Race' }, { nom: 'PERSONNAGE', cases: { F1: 'NOM' } }]));
  assert.equal(deux.trouver(fiche).nom, 'PERSONNAGE');
  assert.deepEqual(essayees, ['PERSONNAGE']);
  essayees.length = 0;
  const preferee = await lireClasseur(await xlsxDeFeuilles([{ nom: 'Notes', cases: { F1: 'NOM' } }, { nom: 'Personnage' }]));
  assert.equal(preferee.trouver(fiche).nom, 'Notes', '« Personnage » ne convient pas : la suivante');
  assert.deepEqual(essayees, ['Personnage', 'Notes']);
  // aucune : null
  assert.equal(renomme.trouver(() => false), null);
  // une feuille illisible est passée ; si aucune ne convient, son erreur est levée
  const abimee = await lireClasseur(await xlsxDeFeuilles([{ nom: 'Personnage', absente: true }, { nom: 'Copie', cases: { F1: 'NOM' } }]));
  assert.equal(abimee.trouver(fiche).nom, 'Copie');
  assert.throws(() => abimee.trouver(() => false), { message: 'Le classeur est incomplet : « xl/worksheets/sheet1.xml » manque.' });
  // un CSV : sa feuille unique
  const tableau = await lireClasseur(enc.encode('a;NOM\n'), { nom: 'x.csv' });
  assert.equal(tableau.trouver((f) => f.cellules.get('B1')?.texte === 'NOM').nom, 'x');
  assert.equal(tableau.trouver(() => false), null);
});

// ---------- bornes : longueur d'une case, fonds répétés, nombre de cases ----------
test('une case lue garde au plus MAX_TEXTE_LU caractères, marquée `tronquee` (xlsx, ods, CSV) ; un .ods n’assemble pas au-delà', async () => {
  assert.equal(MAX_TEXTE_LU, 40_000);
  const long = 'é'.repeat(MAX_TEXTE_LU + 10_000);
  const paire = `${'a'.repeat(MAX_TEXTE_LU - 1)}😀b`; // une paire de substitution à cheval sur la limite : pas coupée en deux
  const xlsx = await lireClasseur(await xlsxDeFeuilles([{ nom: 'Personnage', cases: { A1: long, A2: paire, A3: 'court' } }]));
  const f = xlsx.feuille();
  assert.deepEqual(f.cellules.get('A1'), { valeur: long.slice(0, MAX_TEXTE_LU), texte: long.slice(0, MAX_TEXTE_LU), remplissage: null, tronquee: true });
  assert.equal(f.cellules.get('A2').texte, 'a'.repeat(MAX_TEXTE_LU - 1));
  assert.equal(f.cellules.get('A2').tronquee, true);
  assert.deepEqual(f.cellules.get('A3'), { valeur: 'court', texte: 'court', remplissage: null }, 'une case courte n’a pas la marque');

  const csv = await lireClasseur(enc.encode(`x;${'z'.repeat(MAX_TEXTE_LU + 1)}\n`));
  assert.equal(csv.feuille().cellules.get('B1').texte.length, MAX_TEXTE_LU);
  assert.equal(csv.feuille().cellules.get('B1').tronquee, true);
  assert.equal(csv.feuille().cellules.get('A1').tronquee, undefined);

  // .ods : 20 000 text:s de 10 000 espaces (deux cents millions de caractères annoncés en 600 Kio), répétés sur 10 cases
  const bombe = `<text:p>${'<text:s text:c="10000"/>'.repeat(10_000)}</text:p>`.repeat(2);
  const debut = Date.now();
  const ods = await lireClasseur(await odsLo([caseLo(`<text:p>titre</text:p>${bombe}`).replace('<table:table-cell ', '<table:table-cell table:number-columns-repeated="10" ')]));
  const cases = ods.feuille().cellules;
  assert.ok(Date.now() - debut < 2000, `${Date.now() - debut} ms`);
  assert.equal(cases.size, 10);
  for (const c of cases.values()) {
    assert.equal(c.texte.length, MAX_TEXTE_LU);
    assert.ok(c.texte.startsWith('titre\n   '));
    assert.equal(c.tronquee, true);
  }
});

test('ods aux fonds répétés : dépliés dans ZONE_DES_FONDS (A1:CZ200) seulement, en moins d’une seconde ; au-delà de MAX_CASES valeurs, refusé', async () => {
  assert.deepEqual({ ...ZONE_DES_FONDS }, { colonnes: 104, lignes: 200 });
  // 40 lignes répétées 1000 fois, chacune une case remplie répétée sur 1000 colonnes (un fichier de moins d'un Kio ; 24 s avant la borne)
  const ligne = '<t:table-row t:number-rows-repeated="1000"><t:table-cell t:style-name="fond" t:number-columns-repeated="1000"/></t:table-row>';
  const fichier = await archive({ 'content.xml': contenuOds(ligne.repeat(40)) });
  assert.ok(fichier.length < 2000, `${fichier.length} octets`);
  const debut = Date.now();
  const f = (await lireClasseur(fichier)).feuille('Personnage');
  assert.ok(Date.now() - debut < 1000, `${Date.now() - debut} ms`);
  assert.equal(f.cellules.size, ZONE_DES_FONDS.colonnes * ZONE_DES_FONDS.lignes);
  assert.deepEqual(f.cellules.get('A1'), { valeur: '', texte: '', remplissage: 'B2B2B2' });
  assert.ok(f.cellules.has('CZ200'));
  for (const a of ['DA1', 'A201', 'DA201']) assert.equal(f.cellules.has(a), false, a);
  // hors de la zone : une valeur reste lue (avec son fond), une case seulement remplie non
  const hors = await lireClasseur(await archive({
    'content.xml': contenuOds('<t:table-row t:number-rows-repeated="300"><t:table-cell t:number-columns-repeated="200"/></t:table-row>'
      + '<t:table-row><t:table-cell t:number-columns-repeated="150"/><t:table-cell o:value-type="string"><p:p>loin</p:p></t:table-cell>'
      + '<t:table-cell t:style-name="fond"/><t:table-cell o:value-type="string" t:style-name="fond"><p:p>remplie</p:p></t:table-cell></t:table-row>'),
  }));
  assert.deepEqual(grille(hors.feuille('Personnage')), { EU301: ['loin', 'loin', null], EW301: ['remplie', 'remplie', 'B2B2B2'] });

  // au-delà de MAX_CASES valeurs (501 lignes de 1000 valeurs) : refusé, sans attendre
  const valeurs = '<t:table-row><t:table-cell o:value-type="string" t:number-columns-repeated="1000"><p:p>x</p:p></t:table-cell></t:table-row>';
  const trop = await lireClasseur(await archive({ 'content.xml': contenuOds(valeurs.repeat(MAX_CASES / 1000 + 1)) }));
  assert.throws(() => trop.feuille('Personnage'), { message: `La feuille « Personnage » a trop de cases remplies (plus de ${MAX_CASES}) : fichier refusé.` });
});

// ---------- dates et pourcentages d'un .xlsx ----------
/** Un .xlsx d'une feuille aux nombres `cases` ({ A1: [valeur, style] }), styles : les codes de format de cellXfs (numFmtId intégré ou code). */
function xlsxDeNombres(cases, formats, { date1904 = false } = {}) {
  const numFmts = formats.map((f, i) => (typeof f === 'string' ? `<numFmt numFmtId="${200 + i}" formatCode="${f.replaceAll('"', '&quot;')}"/>` : '')).join('');
  const xfs = formats.map((f, i) => `<xf numFmtId="${typeof f === 'string' ? 200 + i : f}"/>`).join('');
  return archive({
    'xl/workbook.xml': `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">${date1904 ? '<workbookPr date1904="1"/>' : ''}`
      + '<sheets><sheet name="Personnage" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<styleSheet xmlns="${NS_MAIN}"><numFmts>${numFmts}</numFmts><cellXfs><xf numFmtId="0"/>${xfs}</cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS_MAIN}"><sheetData>`
      + Object.entries(cases).map(([a, [v, s]]) => `<row r="${a.slice(1)}"><c r="${a}" s="${s}"><v>${v}</v></c></row>`).join('') + '</sheetData></worksheet>',
  });
}

test('xlsx : un nombre au format de date donne JJ/MM/AAAA (et l’heure si le format en a une), au format pourcentage « 18 % » ; la valeur reste le nombre', async () => {
  const formats = [14, 22, 20, 46, 'dd/mm/yyyy', '[$-40C]d mmmm yyyy;@', '0.00 "d"', '[Red]0;[Blue]\\-0', 'hh:mm:ss', 'yyyy-mm-dd hh:mm', 'mmm',
    '#,##0.00\\ [$€-40C]', '0.0%', 9, 45, 21, 18, '0 \\d', '_-* #,##0 _m_-'];
  const s = (f) => formats.indexOf(f) + 1;
  const cases = {
    A1: [45363, s(14)], A2: [45363.75, s(22)], A3: [0.5, s(20)], A4: [1.5, s(46)], A5: [60, s('dd/mm/yyyy')], A6: [59, s('dd/mm/yyyy')],
    A7: [61, s('dd/mm/yyyy')], A8: [1, s('dd/mm/yyyy')], A9: [0, s(14)], A10: [-1, s(14)], A11: [45363, s('[$-40C]d mmmm yyyy;@')],
    A12: [3, s('0.00 "d"')], A13: [5, s('[Red]0;[Blue]\\-0')], A14: [0.25 + 5 / 86400, s('hh:mm:ss')], A15: [45363.5, s('yyyy-mm-dd hh:mm')],
    A16: [45363, s('mmm')], A17: [12.5, s('#,##0.00\\ [$€-40C]')], A18: [0.183, s('0.0%')], A19: [1, s(9)], A20: [90 / 86400, s(45)],
    A21: [3_000_000, s(14)], A22: [45363.99999999, s(21)], A23: [0.75, s(18)], A24: [7, s('0 \\d')], A25: [8, s('_-* #,##0 _m_-')],
  };
  const f = (await lireClasseur(await xlsxDeNombres(cases, formats))).feuille();
  const lu = Object.fromEntries([...f.cellules].map(([a, c]) => [a, c.texte]));
  assert.deepEqual(lu, {
    A1: '12/03/2024', A2: '12/03/2024 18:00', A3: '12:00', A4: '36:00:00', A5: '29/02/1900', A6: '28/02/1900', A7: '01/03/1900', A8: '01/01/1900',
    A9: '00/01/1900', A10: '-1', A11: '12/03/2024', A12: '3', A13: '5', A14: '06:00:05', A15: '12/03/2024 12:00', A16: '12/03/2024', A17: '12.5',
    A18: '18.3 %', A19: '100 %', A20: '00:01:30', A21: '3000000', A22: '00:00:00', A23: '18:00', A24: '7', A25: '8',
  });
  for (const [a, [v]] of Object.entries(cases)) assert.equal(f.cellules.get(a).valeur, v, a);
  // calendrier de 1904 (workbookPr@date1904)
  const mac = (await lireClasseur(await xlsxDeNombres({ A1: [0, 1], A2: [45363, 1] }, [14], { date1904: true }))).feuille();
  assert.deepEqual([mac.cellules.get('A1').texte, mac.cellules.get('A2').texte], ['01/01/1904', '13/03/2028']);
});
