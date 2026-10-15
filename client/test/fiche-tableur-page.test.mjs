// Ce que la page /fiche/ (src/scripts/fiche.mjs) fait d'un classeur, hors du DOM : l'onglet lu (« Personnage » d'abord, sinon le premier onglet qui suit
// l'un des deux modèles : feuilleDeLaFiche, nommé dans le message), le portrait d'une fiche importée (portraitDeLImport : la mise à jour d'un prétiré par
// un classeur sans image garde son portrait), les messages de l'import (messageDImport) et de l'export (messageDExport : ce que le classeur n'a pas pu
// garder) ; puis le script de la page, lu comme un texte, s'en sert (format du fichier passé à l'import, message de lecture retiré avant le dialogue
// « import-cible »). Demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et exportée à tout moment depuis un Excel
// ou Google Sheet ».
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { LONGUEUR_MAX_D_UNE_CASE } from '../src/lib/fiche-tableur-cases.mjs';
import { avertissementDesNotes, cellulesDeLaFiche, messageDExport } from '../src/lib/fiche-tableur-export.mjs';
import {
  ERREUR_DISPOSITION, feuilleDeGrille, feuilleDeLaFiche, ficheDuClasseur, messageDImport, portraitDeLImport,
} from '../src/lib/fiche-tableur-import.mjs';
import { lireClasseur } from '../src/lib/tableur-lecture.mjs';
import { ecrireZip } from '../src/lib/zip.mjs';

const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(ouvrirBase({ sansExemples: false })))); // tel que la page le reçoit
const LUCIEN = JSON.parse(readFileSync(new URL('./fixtures/fiche-auto-lucien.json', import.meta.url), 'utf8')).values;

// ------------------------------------------------------------------ un classeur de plusieurs onglets

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const echapper = (t) => String(t).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const lettres = (n) => (n > 26 ? lettres(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26));

/** Un .xlsx d'onglets nommés, chacun { nom, grille: values[ligne - 1][colonne - 1] } (textes en ligne, comme les écrit openpyxl). */
function xlsxDOnglets(onglets) {
  const parties = [
    ['xl/workbook.xml', `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>`
      + onglets.map((o, i) => `<sheet name="${echapper(o.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + onglets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>'],
  ];
  onglets.forEach((o, i) => {
    const lignes = (o.grille ?? []).map((ligne, l) => {
      const cases = (ligne ?? []).map((v, c) => (v === '' || v === null || v === undefined ? ''
        : `<c r="${lettres(c + 1)}${l + 1}" t="inlineStr"><is><t xml:space="preserve">${echapper(v)}</t></is></c>`)).join('');
      return cases ? `<row r="${l + 1}">${cases}</row>` : '';
    }).join('');
    parties.push([`xl/worksheets/sheet${i + 1}.xml`, `<worksheet xmlns="${NS_MAIN}"><sheetData>${lignes}</sheetData></worksheet>`]);
  });
  return ecrireZip(parties);
}

test('feuilleDeLaFiche : l’onglet qui suit l’un des deux modèles, « Personnage » d’abord ; renommé ou déplacé, il est retrouvé à son contenu', async () => {
  const BDD = [['Classe', 'Race'], ['Barde', 'Mort-vivant']];
  // la fiche auto de Lucien dans un onglet renommé, après deux autres (« BDD », « Race » : ceux de la fiche auto)
  const classeur = await lireClasseur(await xlsxDOnglets([{ nom: 'BDD', grille: BDD }, { nom: 'Race', grille: [['Elfe']] }, { nom: 'Fiche de Lucien', grille: LUCIEN }]));
  const feuille = feuilleDeLaFiche(classeur);
  assert.equal(feuille.nom, 'Fiche de Lucien');
  // la même fiche que lue directement dans la grille : l'onglet entier est repris
  const lu = ficheDuClasseur(regles, feuille, { format: classeur.format });
  const direct = ficheDuClasseur(regles, feuilleDeGrille(LUCIEN), { format: 'xlsx' });
  assert.equal(lu.disposition, 'auto');
  assert.deepEqual(lu.fiche, direct.fiche);
  assert.deepEqual([lu.nonRepris, lu.remarques], [direct.nonRepris, direct.remarques]);
  // l'onglet « Personnage » d'abord, même s'il n'est pas le premier et qu'un autre convient aussi
  const deux = await lireClasseur(await xlsxDOnglets([{ nom: 'Copie', grille: LUCIEN }, { nom: 'BDD', grille: BDD }, { nom: 'Personnage', grille: LUCIEN }]));
  assert.equal(feuilleDeLaFiche(deux).nom, 'Personnage');
  // « Personnage » qui ne suit aucun modèle : l'onglet suivant qui en suit un
  const autre = await lireClasseur(await xlsxDOnglets([{ nom: 'Personnage', grille: BDD }, { nom: 'Lucien', grille: LUCIEN }]));
  assert.equal(feuilleDeLaFiche(autre).nom, 'Lucien');
  // aucun onglet ne convient : le message de la disposition inconnue
  const etranger = await lireClasseur(await xlsxDOnglets([{ nom: 'Personnage', grille: BDD }, { nom: 'Notes', grille: [['Rien']] }]));
  assert.throws(() => feuilleDeLaFiche(etranger), { message: ERREUR_DISPOSITION });
  // un .csv : sa feuille unique, nommée d'après le fichier
  const csv = LUCIEN.map((l) => (l ?? []).map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
  const tableau = await lireClasseur(new TextEncoder().encode(csv), { nom: 'Lucien.csv' });
  assert.equal(feuilleDeLaFiche(tableau).nom, 'Lucien');
});

test('messageDImport : le modèle lu, l’onglet quand ce n’est pas « Personnage » (jamais pour un .csv), ce qui s’ajoute aux notes', () => {
  assert.equal(messageDImport({ disposition: 'ordinateur', format: 'xlsx', onglet: 'Personnage' }), 'Classeur importé (modèle ordinateur).');
  assert.equal(messageDImport({ disposition: 'ordinateur', format: 'ods', onglet: 'PERSONNAGE ' }), 'Classeur importé (modèle ordinateur).', 'comparé par cle()');
  assert.equal(messageDImport({ disposition: 'auto', format: 'xlsx', onglet: 'Fiche de Lucien', remarques: 3 }),
    'Classeur importé (modèle auto, onglet « Fiche de Lucien ») : 3 remarques ajoutées aux notes.');
  assert.equal(messageDImport({ disposition: 'auto', format: 'csv', onglet: 'Lucien', nonRepris: 1 }),
    'Classeur importé (modèle auto) : 1 information sans équivalent ajoutée aux notes.', 'un .csv n’a pas d’onglet (sa feuille porte le nom du fichier)');
  assert.equal(messageDImport({ disposition: 'auto', format: 'xlsx', onglet: 'Personnage', nonRepris: 1, remarques: 1 }),
    'Classeur importé (modèle auto) : 1 information sans équivalent et 1 remarque ajoutées aux notes.');
  assert.equal(messageDImport({ disposition: 'ordinateur', format: 'xlsx', onglet: 'Copie', nonRepris: 2, remarques: 0 }),
    'Classeur importé (modèle ordinateur, onglet « Copie ») : 2 informations sans équivalent ajoutées aux notes.');
});

test('portraitDeLImport : la mise à jour d’un prétiré par un classeur sans image garde son portrait ; un nouveau prétiré n’en a pas', () => {
  const IMAGE = { de: 'A1', a: 'E5', octets: Uint8Array.of(0xff, 0xd8, 0xff), type: 'image/jpeg' };
  const PORTRAIT = 'data:image/webp;base64,AAAA';
  // classeur sans image (fiche auto, .csv, export sans portrait)
  assert.equal(portraitDeLImport({ image: null, portraitGarde: false }, { portrait: PORTRAIT, cible: 'mettre-a-jour' }), 'garder');
  assert.equal(portraitDeLImport({ image: null, portraitGarde: false }, { portrait: PORTRAIT, cible: 'creer' }), 'aucun');
  assert.equal(portraitDeLImport({ image: null, portraitGarde: false }, { portrait: null, cible: 'mettre-a-jour' }), 'aucun');
  // le classeur porte l'empreinte du portrait de la fiche ouverte : l'image d'origine et son cadrage, dans les deux cas
  assert.equal(portraitDeLImport({ image: IMAGE, portraitGarde: true }, { portrait: PORTRAIT, cible: 'mettre-a-jour' }), 'garder');
  assert.equal(portraitDeLImport({ image: IMAGE, portraitGarde: true }, { portrait: PORTRAIT, cible: 'creer' }), 'garder');
  // une autre image : elle devient le portrait
  assert.equal(portraitDeLImport({ image: IMAGE, portraitGarde: false }, { portrait: PORTRAIT, cible: 'mettre-a-jour' }), 'image');
  assert.equal(portraitDeLImport({ image: IMAGE, portraitGarde: false }, { portrait: null, cible: 'creer' }), 'image');
  // une image que la page ne sait pas lire : redemandée sans elle
  assert.equal(portraitDeLImport({ image: null, portraitGarde: false }, { portrait: PORTRAIT, cible: 'mettre-a-jour' }), 'garder');
});

test('messageDExport : « Classeur exporté. », puis ce que le classeur n’a pas pu garder (cellulesDeLaFiche), sur le ton « attente »', () => {
  assert.deepEqual(messageDExport([]), { texte: 'Classeur exporté.', ton: 'ok' });
  const courte = cellulesDeLaFiche(regles, { ...ficheVide('Essai'), notes: 'Une note.' }, { date: '15/10/2026' });
  assert.deepEqual(courte.avertissements, []);
  assert.deepEqual(messageDExport(courte.avertissements), { texte: 'Classeur exporté.', ton: 'ok' });
  // des notes plus longues qu'une case de tableur : raccourcies, et le message le dit
  const longue = cellulesDeLaFiche(regles, { ...ficheVide('Essai'), notes: 'Journal de campagne. '.repeat(Math.ceil(LONGUEUR_MAX_D_UNE_CASE / 20)) }, { date: '15/10/2026' });
  assert.equal(longue.avertissements.length, 1);
  assert.ok(longue.avertissements[0].startsWith(avertissementDesNotes(1).split(' : ')[0]), longue.avertissements[0]);
  const { texte, ton } = messageDExport(longue.avertissements);
  assert.equal(ton, 'attente');
  assert.equal(texte, `Classeur exporté. ${longue.avertissements[0]}`);
});

// ------------------------------------------------------------------ le script de la page s'en sert (lu comme un texte : il touche au DOM)

const SCRIPT = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
/** Le corps d'une fonction du script (de sa déclaration à la suivante). */
function corps(nom) {
  const debut = SCRIPT.search(new RegExp(`\\n(?:async )?function ${nom}\\(`));
  assert.ok(debut >= 0, `function ${nom}`);
  const fin = SCRIPT.slice(debut + 1).search(/\n(?:async )?function |\n\/\*\*|\n\/\/ -{10}/);
  return SCRIPT.slice(debut, fin < 0 ? undefined : debut + 1 + fin);
}

test('src/scripts/fiche.mjs : onglet retrouvé, format passé à l’import, message de lecture retiré avant le dialogue, portrait et messages des modules', () => {
  const importer = corps('importerClasseur');
  assert.match(importer, /feuilleDeLaFiche\(classeur\)/, 'l’onglet qui suit un modèle, « Personnage » d’abord');
  assert.doesNotMatch(SCRIPT, /\.feuille\(\s*['"]Personnage['"]\s*\)/, 'plus de classeur.feuille(\'Personnage\') (le premier onglet par défaut)');
  assert.match(importer, /ficheDuClasseur\(regles, feuille, \{[^}]*\bformat: classeur\.format\b/, 'le format du fichier (un .csv n’a pas les couleurs des maîtrises)');
  // « Lecture du classeur… » est retiré avant que le dialogue « import-cible » n'attende la réponse (D3)
  const lecture = importer.indexOf("message('Lecture du classeur…', 'attente')");
  const efface = importer.indexOf("message('', '')", lecture);
  const dialogue = importer.indexOf('await cibleDeLImport()');
  assert.ok(lecture >= 0 && efface > lecture && dialogue > efface, 'message effacé entre la lecture et le dialogue');
  assert.match(importer, /portraitDeLImport\(lu, ouverte\)/);
  assert.match(importer, /portraitDeLImport\(\{ \.\.\.lu, image: null \}, ouverte\)/, 'une image illisible : le portrait sans elle');
  assert.match(importer, /messageDImport\(\{[^}]*onglet: feuille\.nom/);
  assert.match(corps('exporterTableur'), /messageDExport\(avertissements\)/, 'les avertissements de l’export dans le message');
});
