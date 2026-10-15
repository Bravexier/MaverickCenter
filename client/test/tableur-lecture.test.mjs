// Lecture d'un classeur en grille (lib/tableur-lecture.mjs) : la fiche de personnage en tableur. Le modèle de la fiche réassemblé puis relu ;
// un .xlsx, un .ods et des CSV fabriqués à la main (aucun binaire dans le dépôt), qui imitent ce qu'écrivent Excel, LibreOffice et Google
// Sheets (chaînes partagées riches, cases à cocher, préfixes inhabituels, répétitions, fusions, images ancrées, fonds) ; les refus.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { casesDesDes, dispositionDe, MAITRISES, ORDINATEUR } from '../src/lib/fiche-tableur-cases.mjs';
import { lireClasseur, MAX_REPETITION } from '../src/lib/tableur-lecture.mjs';
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
  assert.deepEqual(sansOctets([logo]), [{ de: 'A1', a: 'E5', type: 'image/png', nom: 'Images 2', description: '' }]);
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
    C5: [0.18, '18%', null],
    D5: [0.1234, '12.3%', null],
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
    F4: ['début   fin \ndeux\ntrois\tquatre\nen lien et espaces', 'début   fin \ndeux\ntrois\tquatre\nen lien et espaces', null],
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
