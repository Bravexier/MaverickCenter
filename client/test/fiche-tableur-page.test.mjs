// Ce que la page /fiche/ (src/scripts/fiche.mjs) fait d'un classeur, hors du DOM : l'onglet lu (« Personnage » d'abord, sinon le premier onglet qui suit
// l'un des deux modèles : feuilleDeLaFiche, nommé dans le message), le portrait d'une fiche importée (portraitDeLImport : la mise à jour d'un prétiré par
// un classeur sans image garde son portrait), les messages de l'import (messageDImport) et de l'export (messageDExport : ce que le classeur n'a pas pu
// garder) ; le nom du fichier (nomDuFichier) et l'état des boutons « Télécharger » et « Exporter » (etatDesExports) ; puis le script de la page, lu
// comme un texte, s'en sert (format du fichier passé à l'import, message de lecture retiré avant le dialogue « import-cible », barre recalculée, export
// Google et import en ligne). Demandes du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et exportée à tout moment
// depuis un Excel ou Google Sheet » ; « [Exporter(Tableur)] => [Télécharger] Le nom du fichier deviens juste nom du personnage. Grisé tant que la
// fiche n'a pas été enregistrée ; [Exporter(Json)] =>[Exporter] Exporte sous le format Google Sheet. ; [Importer] => [Importer(PC)] Demande un fichier
// Xlsx ; [Imprimer] => [Importer(EnLigne)] Demande l'url d'un Google Sheet. »
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { LONGUEUR_MAX_D_UNE_CASE } from '../src/lib/fiche-tableur-cases.mjs';
import {
  INFOBULLES_DES_EXPORTS, avertissementDesNotes, cellulesDeLaFiche, etatDesExports, messageDExport, nomDuFichier,
} from '../src/lib/fiche-tableur-export.mjs';
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
  // le début du message selon le bouton : « Télécharger », « Exporter » (Google Sheets)
  assert.deepEqual(messageDExport([], 'Classeur téléchargé.'), { texte: 'Classeur téléchargé.', ton: 'ok' });
  assert.deepEqual(messageDExport(longue.avertissements, 'Feuille Google créée.'), { texte: `Feuille Google créée. ${longue.avertissements[0]}`, ton: 'attente' });
});

test('nomDuFichier : le nom du personnage seul, chaque suite de caractères interdits remplacée par « - », 120 caractères au plus ; « Personnage » s’il ne reste rien', () => {
  assert.equal(nomDuFichier('Kaël Nox'), 'Kaël Nox');
  assert.equal(nomDuFichier('  Lucien  '), 'Lucien');
  assert.equal(nomDuFichier('Kaël/Nox'), 'Kaël-Nox');
  assert.equal(nomDuFichier('a\\b:c*d?e"f<g>h|i'), 'a-b-c-d-e-f-g-h-i');
  assert.equal(nomDuFichier('a//\\\\::b'), 'a-b', 'une suite : un seul « - »');
  assert.equal(nomDuFichier('a\u0000\u001f\u007fb'), 'a-b');
  assert.equal(nomDuFichier('Dr. Ombre'), 'Dr. Ombre', 'le point reste (le fichier finit par .xlsx)');
  for (const vide of ['', '   ', null, undefined]) assert.equal(nomDuFichier(vide), 'Personnage', String(vide));
  assert.equal(nomDuFichier('x'.repeat(300)).length, 120);
});

test('etatDesExports : Télécharger et Exporter grisés tant que la fiche n’est pas enregistrée telle qu’elle est, sauf service injoignable ; Exporter grisé sans identifiant client', () => {
  const CLIENT = '123-abc.apps.googleusercontent.com';
  const i = INFOBULLES_DES_EXPORTS;
  assert.equal(i.telechargerGrise, 'Enregistrez la fiche pour la télécharger');
  assert.equal(i.exporterSansClient, 'Export vers Google Sheets pas encore configuré');
  const etat = (o) => {
    const e = etatDesExports({ client: CLIENT, ...o });
    return [e.telecharger.actif, e.exporter.actif];
  };
  assert.deepEqual(etat({ id: null, modifie: false }), [false, false], 'fiche neuve');
  assert.deepEqual(etat({ id: null, modifie: true }), [false, false]);
  assert.deepEqual(etat({ id: 'x', modifie: false }), [true, true], 'enregistrée');
  assert.deepEqual(etat({ id: 'x', modifie: true }), [false, false], 'modifiée depuis');
  assert.deepEqual(etat({ id: 'x', modifie: false, occupe: true }), [false, false], 'un export en cours');
  // le service ne répond pas : la fiche ne peut pas être enregistrée, la télécharger évite de la perdre
  assert.deepEqual(etat({ id: null, modifie: true, serviceJoignable: false }), [true, true]);
  assert.deepEqual(etatDesExports({ id: null, modifie: true }).telecharger, { actif: false, infobulle: i.telechargerGrise });
  assert.deepEqual(etatDesExports({ id: 'x' }).telecharger, { actif: true, infobulle: i.telecharger });
  assert.deepEqual(etatDesExports({ id: 'x', client: CLIENT }).exporter, { actif: true, infobulle: i.exporter });
  assert.deepEqual(etatDesExports({ id: null, client: CLIENT }).exporter, { actif: false, infobulle: i.exporterGrise });
  // sans identifiant client (variable de build SITE_GOOGLE_CLIENT_ID vide) : Exporter grisé quoi qu'il arrive
  for (const o of [{ id: 'x' }, { id: null, serviceJoignable: false }, {}]) {
    assert.deepEqual(etatDesExports(o).exporter, { actif: false, infobulle: i.exporterSansClient }, JSON.stringify(o));
  }
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
  assert.match(corps('telechargerClasseur'), /messageDExport\(avertissements, 'Classeur téléchargé\.'\)/, 'les avertissements de l’export dans le message');
});

test('src/scripts/fiche.mjs : la barre (Télécharger, Exporter, Importer (PC), Importer (en ligne)) recalculée ; plus de JSON ni d’impression', () => {
  // l'état des boutons recalculé par rafraichir et à la fin de chaque action (jamais un « disabled = false » qui réactiverait Télécharger)
  assert.match(corps('rafraichir'), /\n {2}etatDesBoutons\(\);/);
  const etat = corps('etatDesBoutons');
  assert.match(etat, /etatDesExports\(\{ id, modifie, serviceJoignable, client: \$\('fiche-exporter'\)\.dataset\.clientGoogle \?\? '', occupe \}\)/);
  assert.match(etat, /\['telecharger', \$\('fiche-telecharger'\)\], \['exporter', \$\('fiche-exporter'\)\]/);
  assert.match(corps('pendant'), /finally \{\s*occupe = false;\s*etatDesBoutons\(\);/);
  assert.match(corps('enregistrer'), /bouton\.disabled = false;\s*etatDesBoutons\(\);/);
  // Télécharger : le classeur, nommé d'après le personnage
  assert.match(corps('classeurDeLaFiche'), /nom: nomDuFichier\(f\.nom\)/);
  assert.match(corps('telechargerClasseur'), /telecharger\(new Blob\(\[octets\], \{ type: TYPE_XLSX \}\), `\$\{nom\}\.xlsx`\)/);
  // Exporter : la fenêtre de connexion de Google ouverte dans le clic (requestAccessToken sans attente avant lui), le même classeur envoyé
  const exporter = corps('exporterVersGoogle');
  const avantLaFenetre = exporter.slice(0, exporter.indexOf('clientDeJetons.requestAccessToken();'));
  assert.ok(avantLaFenetre.length > 0 && !/\bawait\b|\.then\(/.test(avantLaFenetre), 'aucune attente avant requestAccessToken');
  const envoi = corps('envoyerAGoogle');
  assert.match(envoi, /corpsMultipart\(\{ nom, octets, frontiere: `maverick-\$\{crypto\.randomUUID\(\)\}` \}\)/);
  assert.match(envoi, /fetch\(ADRESSE_D_ENVOI, \{ method: 'POST', headers: \{ Authorization: `Bearer \$\{jeton\}`, 'Content-Type': type \}, body: corps \}\)/);
  assert.match(envoi, /messageDExport\(avertissements, 'Feuille Google créée\.'\)/);
  assert.match(envoi, /lienDeFeuille\(donnees\)/);
  assert.match(envoi, /'Ouvrir dans Google Sheets'/);
  assert.match(corps('chargerGoogle'), /initTokenClient\(\{\s*client_id: \$\('fiche-exporter'\)\.dataset\.clientGoogle,\s*scope: PORTEE_DRIVE,/);
  assert.doesNotMatch(SCRIPT, /localStorage|sessionStorage/, 'le jeton de Google reste en mémoire');
  // Importer (en ligne) : le service, puis le même chemin qu'un classeur de l'ordinateur
  const enLigne = corps('importerEnLigne');
  assert.match(enLigne, /fetch\(`\$\{API\}classeur\/`, \{ method: 'POST', headers: \{ 'Content-Type': 'application\/json' \}, body: JSON\.stringify\(\{ url: adresse \}\) \}\)/);
  assert.match(enLigne, /await importerClasseur\(octets, nomDuClasseur\(reponse\.headers\.get\('content-disposition'\)\) \?\? 'Google Sheets\.xlsx'\)/);
  assert.match(corps('preparerImportEnLigne'), /idDeFeuille\(champ\.value\)/);
  // plus d'export ni d'import en JSON, plus d'impression ; les messages disent « téléchargez »
  for (const parti of [/function importerJson/, /function exporter\(/, /window\.print/, /type: 'application\/json' \}\)/, /fiche-imprimer/, /fiche-exporter-tableur/, /[Ee]xportez/]) {
    assert.doesNotMatch(SCRIPT, parti, String(parti));
  }
  assert.match(SCRIPT, /Service indisponible : téléchargez la fiche pour ne rien perdre\./);
});
