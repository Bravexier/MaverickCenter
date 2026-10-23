// Écriture d'un classeur .xlsx d'après un modèle : la fiche de personnage en tableur (demande du propriétaire, 2026-10-15 : « La fiche de
// personnage doit pouvoir être importée et exportée à tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle. Le portrait
// peut remplacer l'icône du logo en haut à gauche. Inutile de mettre les formules dans le fichier généré, seul le résultat. »). Module de format,
// qui ne sait rien du jeu : lib/fiche-tableur-export.mjs dit quoi écrire où. Réservé à src/scripts/fiche.mjs (et aux modules du tableur, aux
// tests) : un module importé par deux scripts de page casse la version portable (skill site-version-portable) ; n'importe que lib/zip.mjs,
// lib/xml-mini.mjs et lib/fiche-tableur-cases.mjs.
//
//   ecrireXlsx(modele, { cellules, remplis, alignements, image, descriptionImage, titre, date }) → Promise<Uint8Array> (le .xlsx rempli)
//   zonesDuClasseur(modele) → Promise<Map<adresse, zone>> (taille de chaque case, ce que lib/tableur-mesure.mjs mesure)
//
// On part du modèle (/fiche/modele.xlsx, lib/fiche-modele.mjs) et on ne touche que ce qu'il faut : les parties non modifiées gardent leurs
// octets ; la première feuille du classeur est celle qu'on remplit. Décisions (essais relus par openpyxl et LibreOffice, voir aussi
// lib/tableur-lecture.mjs, qui relit ce fichier) :
//   - parties retrouvées par les relations (_rels/.rels → classeur → feuille, chaînes partagées, styles ; feuille → dessin → image), jamais
//     par un chemin supposé ; noms locaux comparés (préfixes « x: »…) ;
//   - `cellules` : { A1: texte | nombre | booléen | null } ; la valeur va dans la case nommée (la case du haut à gauche d'une fusion) et
//     remplace ce qu'elle contenait, son style gardé. null, undefined ou '' = case vidée. Texte → chaîne partagée ajoutée à sharedStrings.xml
//     (une seule fois pour un même texte, count / uniqueCount tenus à jour), `<t xml:space="preserve">`, sauts de ligne gardés (\r\n et \r
//     → \n), un « _xHHHH_ » écrit tel quel protégé en « _x005F_xHHHH_ » (sinon Excel et les lecteurs le décoderaient), au-delà de 32 767
//     caractères (la limite d'Excel) tronqué et fini par « … ». Nombre fini → <v> ; un nombre non fini (NaN, Infinity) vide la case plutôt
//     que d'écrire une valeur fausse. Booléen → t="b" (une case à cocher).
//   - une case ou une ligne absente de la feuille est insérée à son rang (Excel « répare » un fichier aux cases dans le désordre), avec le
//     style qu'elle affichait (celui de la ligne si customFormat, sinon celui de la colonne) ; la `dimension` et les `spans` de la ligne
//     s'élargissent si besoin. `r` est posé sur toutes les lignes et cases qui ne l'avaient pas.
//   - `remplis` : { A1: 'RRGGBB' } = fond plein de la case : un <fill> solide par couleur ajouté à la fin de <fills> (les deux premiers,
//     réservés par Excel, restent en place), l'<xf> de la case recopié avec ce fillId et applyFill="true" ajouté à la fin de <cellXfs>, une
//     seule copie par couple style × couleur ; count à jour.
//   - `alignements` : { A1: { retour?: booléen, reduire?: booléen, vertical?: 'top' | 'center' | 'bottom', echelle?: nombre } } = retour à la
//     ligne (wrapText), réduction au besoin (shrinkToFit : le texte rapetisse pour tenir sur une ligne ; les deux s'excluent, poser l'un retire
//     l'autre), alignement vertical de la case et `echelle` (de 0 exclu à 1) : la police de la case écrite à cette fraction de sa taille (arrondie
//     au demi-point inférieur, 1 point au moins : une copie de la <font> ajoutée à la fin de <fonts>, une par police × échelle, count à jour ;
//     applyFont="true") — ce que lib/tableur-mesure.mjs#ajusterLeTexte demande pour une case coupée. L'<xf> recopié de même
//     (applyAlignment="true", <alignment> en tête), une copie par style × alignement. Après les fonds : une case peut avoir les deux.
//   - `image` : { octets, type: 'image/png' | 'image/jpeg' } remplace l'image ancrée en A1 (même ancre, donc même place et même taille) ;
//     les octets doivent être du type annoncé. Même dossier et même nom que l'ancienne, extension du type (image1.png → image1.jpeg) : cible
//     de la relation du dessin et Override de [Content_Types].xml mis à jour, l'ancienne partie retirée si plus rien ne la cite.
//     `descriptionImage` → cNvPr@descr et cNvPr@name = « Portrait » (une image donnée) ou « Logo » (celle du modèle reste).
//   - toute formule (<f>) est retirée de toutes les feuilles, son dernier résultat (<v>) gardé (« seul le résultat »), et calcChain.xml avec
//     elle (Excel refuse une chaîne de calcul qui cite une case sans formule).
//   - `titre` → dc:title de docProps/core.xml ; `date` (Date ou texte ISO) → dcterms:modified et heure des entrées du ZIP (sinon celles du
//     modèle, et le 1980-01-01 du ZIP : même entrée, mêmes octets).
// Erreurs : Error « Classeur impossible à écrire : … » (adresse ou couleur mal formée, image d'un autre type, modèle incomplet).

import { decouperAdresse, lettresDeColonne } from './fiche-tableur-cases.mjs';
import { analyserXml, enfantNomme, enfantsNommes, nomLocal, serialiserXml, texteDe } from './xml-mini.mjs';
import { ecrireZip, lireZip } from './zip.mjs';

/** Longueur maximale d'un texte de case (Excel) ; au-delà, le texte est tronqué et finit par « … ». */
export const MAX_TEXTE = 32_767;
const MAX_COLONNE = 16_384; // XFD
const MAX_LIGNE = 1_048_576;

/** Types d'image acceptés : extension de la partie et signature des octets. */
const IMAGES = Object.freeze({
  'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], nom: 'PNG' },
  'image/jpeg': { extension: 'jpeg', signature: [0xff, 0xd8, 0xff], nom: 'JPEG' },
});

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_DC = 'http://purl.org/dc/elements/1.1/';
const NS_DCTERMS = 'http://purl.org/dc/terms/';
const NS_XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const TYPE_CHAINES = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml';
const REL_CHAINES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings';

const impossible = (raison) => new Error(`Classeur impossible à écrire : ${raison}`);
const DECODEUR = new TextDecoder('utf-8');

// ---------- outils ----------
const prefixeDe = (nom) => nom.slice(0, nom.indexOf(':') + 1);
const element = (nom, attrs = {}, enfants = []) => ({ nom, attrs, enfants });
const attributLocal = (el, local) => {
  for (const [nom, valeur] of Object.entries(el?.attrs ?? {})) if (nomLocal(nom) === local) return valeur;
  return undefined;
};
const vrai = (v) => v === '1' || v === 'true';

/** Dossier d'une partie (« xl/worksheets/sheet1.xml » → « xl/worksheets/ »), partie de ses relations (« xl/worksheets/_rels/sheet1.xml.rels »). */
const dossierDe = (chemin) => chemin.slice(0, chemin.lastIndexOf('/') + 1);
const relsDe = (chemin) => `${dossierDe(chemin)}_rels/${chemin.slice(chemin.lastIndexOf('/') + 1)}.rels`;

/** Cible d'une relation, résolue depuis le dossier de la partie qui la déclare (cible absolue « /xl/… » comprise). */
function resoudre(dossier, cible) {
  let brut = String(cible ?? '');
  try {
    brut = decodeURIComponent(brut);
  } catch {
    // cible non encodée qui contient un « % » : prise telle quelle
  }
  const segments = [];
  for (const s of (brut.startsWith('/') ? brut.slice(1) : dossier + brut).split('/')) {
    if (s === '..') segments.pop();
    else if (s !== '.' && s !== '') segments.push(s);
  }
  return segments.join('/');
}

/** Retrouve une partie sans tenir compte de la casse (OPC ne la distingue pas). */
function partieExistante(parties, chemin) {
  if (parties.has(chemin)) return chemin;
  const bas = chemin.toLowerCase();
  for (const nom of parties.keys()) if (nom.toLowerCase() === bas) return nom;
  return null;
}

/** Les parties XML : lues une fois ; seules celles qu'on a changées (`changer`) sont réécrites, les autres gardent leurs octets. */
function atelier(parties) {
  const arbres = new Map();
  const changees = new Set();
  const lire = (chemin) => {
    if (!arbres.has(chemin)) {
      const octets = parties.get(chemin);
      if (!octets) throw impossible(`le modèle est incomplet (« ${chemin} » manque).`);
      arbres.set(chemin, analyserXml(DECODEUR.decode(octets)));
    }
    return arbres.get(chemin);
  };
  return {
    lire,
    /** L'arbre de la partie, qui sera réécrite. */
    changer(chemin) {
      changees.add(chemin);
      return lire(chemin);
    },
    /** Une partie créée. */
    creer(chemin, arbre) {
      arbres.set(chemin, arbre);
      changees.add(chemin);
    },
    oublier(chemin) {
      arbres.delete(chemin);
      changees.delete(chemin);
    },
    *reecrites() {
      for (const chemin of changees) yield [chemin, arbres.get(chemin)];
    },
  };
}

/** Relations d'une partie : [{ el, id, type, cible (résolue), externe }] ; [] sans fichier de relations. */
function relationsDe(xml, parties, chemin) {
  const rels = relsDe(chemin);
  if (!parties.has(rels)) return [];
  return enfantsNommes(xml.lire(rels), 'Relationship').map((el) => ({
    el,
    id: el.attrs.Id,
    type: String(el.attrs.Type ?? ''),
    cible: resoudre(dossierDe(chemin), el.attrs.Target),
    externe: el.attrs.TargetMode === 'External',
  }));
}
const relationDeType = (relations, fin) => relations.find((r) => !r.externe && r.type.endsWith(fin)) ?? null;

// ---------- adresses ----------
function adresseValable(adresse) {
  const a = decouperAdresse(adresse);
  if (!a || a.ligne < 1 || a.ligne > MAX_LIGNE || a.colonne < 1 || a.colonne > MAX_COLONNE) throw impossible(`adresse de case invalide « ${adresse} ».`);
  return a;
}

/** « A1:BZ75 » → bornes ; null si illisible. */
function bornesDe(ref) {
  const [debut, fin = debut] = String(ref ?? '').split(':');
  const a = decouperAdresse(debut);
  const b = decouperAdresse(fin);
  return a && b ? { c1: a.colonne, l1: a.ligne, c2: b.colonne, l2: b.ligne } : null;
}

// ---------- la feuille ----------
/**
 * Prépare la feuille : `r` posé partout, index des lignes. Rend les outils pour retrouver (ou créer à son rang) une case.
 */
function feuilleDe(racine) {
  const p = prefixeDe(racine.nom);
  const sheetData = enfantNomme(racine, 'sheetData');
  if (!sheetData) throw impossible('la feuille n’a pas de <sheetData>.');
  const colonnesStylees = enfantsNommes(enfantNomme(racine, 'cols'), 'col')
    .map((c) => ({ min: Number(c.attrs.min), max: Number(c.attrs.max), style: c.attrs.style }))
    .filter((c) => c.style !== undefined);

  // r posé sur toutes les lignes et cases (implicite : la suivante de la précédente)
  const lignes = new Map();
  let n = 0;
  for (const row of enfantsNommes(sheetData, 'row')) {
    n = row.attrs.r !== undefined ? Number(row.attrs.r) : n + 1;
    if (row.attrs.r === undefined) row.attrs = { r: String(n), ...row.attrs };
    lignes.set(n, row);
    let c = 0;
    for (const cell of enfantsNommes(row, 'c')) {
      const a = cell.attrs.r !== undefined ? decouperAdresse(cell.attrs.r) : null;
      c = a ? a.colonne : c + 1;
      if (!a) cell.attrs = { ...cell.attrs, r: `${lettresDeColonne(c)}${n}` };
    }
  }

  let bornes = bornesDe(attributLocal(enfantNomme(racine, 'dimension'), 'ref'));
  const etendre = (colonne, ligne) => {
    const dimension = enfantNomme(racine, 'dimension');
    if (!dimension) return;
    if (!bornes) bornes = { c1: colonne, l1: ligne, c2: colonne, l2: ligne };
    bornes = { c1: Math.min(bornes.c1, colonne), l1: Math.min(bornes.l1, ligne), c2: Math.max(bornes.c2, colonne), l2: Math.max(bornes.l2, ligne) };
    const debut = `${lettresDeColonne(bornes.c1)}${bornes.l1}`;
    const fin = `${lettresDeColonne(bornes.c2)}${bornes.l2}`;
    dimension.attrs.ref = debut === fin ? debut : `${debut}:${fin}`;
  };

  /** Style qu'affiche une case absente : celui de la ligne (customFormat), sinon celui de la colonne, sinon 0. */
  const styleAffiche = (row, colonne) => {
    if (row && vrai(row.attrs.customFormat) && row.attrs.s !== undefined) return row.attrs.s;
    return colonnesStylees.find((c) => c.min <= colonne && colonne <= c.max)?.style ?? '0';
  };

  /** La ligne n, créée à son rang si besoin. */
  const ligneDe = (ligne) => {
    let row = lignes.get(ligne);
    if (row) return row;
    row = element(`${p}row`, { r: String(ligne) });
    const i = sheetData.enfants.findIndex((e) => typeof e === 'object' && nomLocal(e.nom) === 'row' && Number(e.attrs.r) > ligne);
    if (i < 0) sheetData.enfants.push(row);
    else sheetData.enfants.splice(i, 0, row);
    lignes.set(ligne, row);
    return row;
  };


  /** La case (élément <c>) ; absente, créée à son rang (ligne comprise) si `creer`, sinon null. */
  const caseDe = (adresse, { creer = true } = {}) => {
    const { colonne, ligne } = adresseValable(adresse);
    const existait = lignes.has(ligne);
    if (!existait && !creer) return null;
    const row = ligneDe(ligne);
    let rang = row.enfants.length;
    for (let i = 0; i < row.enfants.length; i++) {
      const e = row.enfants[i];
      if (typeof e !== 'object') continue;
      if (nomLocal(e.nom) !== 'c') {
        rang = i; // extLst : après les cases
        break;
      }
      const col = decouperAdresse(e.attrs.r)?.colonne ?? 0;
      if (col === colonne) return e;
      if (col > colonne) {
        rang = i;
        break;
      }
    }
    if (!creer) return null;
    const s = styleAffiche(existait ? row : null, colonne);
    const r = `${lettresDeColonne(colonne)}${ligne}`;
    const cell = element(`${p}c`, s !== '0' ? { r, s } : { r });
    row.enfants.splice(rang, 0, cell);
    // spans : l'étendue des cases de la ligne (une indication pour Excel), élargie
    if (row.attrs.spans !== undefined) {
      const bornesSpans = String(row.attrs.spans).split(/[\s:]+/).map(Number).filter((x) => Number.isFinite(x) && x > 0);
      if (bornesSpans.length) row.attrs.spans = `${Math.min(colonne, ...bornesSpans)}:${Math.max(colonne, ...bornesSpans)}`;
    }
    etendre(colonne, ligne);
    return cell;
  };

  return { caseDe };
}

/** Retire toutes les formules d'une feuille (le résultat <v> reste) ; rend leur nombre. */
function retirerLesFormules(racine) {
  let n = 0;
  for (const row of enfantsNommes(enfantNomme(racine, 'sheetData'), 'row')) {
    for (const cell of enfantsNommes(row, 'c')) {
      const avant = cell.enfants.length;
      cell.enfants = cell.enfants.filter((e) => typeof e !== 'object' || nomLocal(e.nom) !== 'f');
      if (cell.enfants.length !== avant) {
        n++;
        delete cell.attrs.cm; // métadonnée d'une formule (tableau dynamique)
      }
    }
  }
  return n;
}

// ---------- textes ----------
const RE_INTERDITS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Texte tel que la case l'affichera : fins de ligne \n, caractères interdits en XML retirés, au plus MAX_TEXTE caractères (« … » à la fin). */
export function texteDeCase(texte) {
  const t = String(texte).replace(/\r\n?/g, '\n').replace(RE_INTERDITS, '');
  if (t.length <= MAX_TEXTE) return t;
  let coupe = MAX_TEXTE - 1;
  const code = t.charCodeAt(coupe - 1);
  if (code >= 0xd800 && code <= 0xdbff) coupe--; // ne pas couper une paire de substitution
  return `${t.slice(0, coupe)}…`;
}

/** Protège un « _xHHHH_ » écrit tel quel (codage OOXML d'un caractère) : « _x005F_ » est le « _ » codé. */
const protegerOoxml = (t) => t.replace(/_x([0-9A-Fa-f]{4})_/g, '_x005F_x$1_');

/** Chaînes partagées : index d'un texte (ajouté au besoin, une seule fois), compte des références. */
function chainesDe(racine) {
  const p = prefixeDe(racine.nom);
  const index = new Map();
  const existantes = enfantsNommes(racine, 'si');
  let total = existantes.length;
  existantes.forEach((si, i) => {
    const enfants = enfantsNommes(si);
    if (enfants.length === 1 && nomLocal(enfants[0].nom) === 't') {
      const t = texteDe(enfants[0]);
      if (!index.has(t)) index.set(t, i);
    }
  });
  let references = 0;
  return {
    indexDe(texte) {
      const brut = protegerOoxml(texte);
      if (!index.has(brut)) {
        racine.enfants.push(element(`${p}si`, {}, [element(`${p}t`, { 'xml:space': 'preserve' }, [brut])]));
        index.set(brut, total++);
      }
      return index.get(brut);
    },
    compter(d) {
      references += d;
    },
    finir() {
      if (racine.attrs.count !== undefined) racine.attrs.count = String(Math.max(0, Number(racine.attrs.count) + references));
      racine.attrs.uniqueCount = String(total);
    },
  };
}

// ---------- styles ----------
const COULEUR = /^[0-9A-Fa-f]{6}$/;
const VERTICAUX = new Set(['top', 'center', 'bottom']);

function stylesDe(racine) {
  const p = prefixeDe(racine.nom);
  const fills = enfantNomme(racine, 'fills');
  const cellXfs = enfantNomme(racine, 'cellXfs');
  if (!fills || !cellXfs) throw impossible('styles.xml n’a pas de <fills> ou de <cellXfs>.');
  const fillParCouleur = new Map();
  const xfParCouple = new Map();
  const fontParEchelle = new Map();
  /** Index d'une copie de la police `fontId` à `echelle` de sa taille (au demi-point inférieur, 1 point au moins), créée à la première demande. */
  const fontDe = (fontId, echelle) => {
    const cle = `${fontId}|${echelle}`;
    if (!fontParEchelle.has(cle)) {
      const fonts = enfantNomme(racine, 'fonts');
      const liste = enfantsNommes(fonts, 'font');
      const origine = liste[fontId] ?? liste[0];
      if (!origine) throw impossible('styles.xml n’a pas de <fonts>.');
      const copie = structuredClone(origine);
      const sz = enfantNomme(copie, 'sz');
      const taille = Number(sz?.attrs.val ?? 11);
      const reduite = String(Math.max(1, Math.floor((Number.isFinite(taille) && taille > 0 ? taille : 11) * echelle * 2) / 2));
      if (sz) sz.attrs.val = reduite;
      else copie.enfants.push(element(`${p}sz`, { val: reduite }));
      fonts.enfants.push(copie);
      fonts.attrs.count = String(liste.length + 1);
      fontParEchelle.set(cle, liste.length);
    }
    return fontParEchelle.get(cle);
  };
  const fillDe = (couleur) => {
    if (!fillParCouleur.has(couleur)) {
      fills.enfants.push(element(`${p}fill`, {}, [element(`${p}patternFill`, { patternType: 'solid' }, [
        element(`${p}fgColor`, { rgb: `FF${couleur}` }),
        element(`${p}bgColor`, { indexed: '64' }),
      ])]));
      const n = enfantsNommes(fills, 'fill').length;
      fills.attrs.count = String(n);
      fillParCouleur.set(couleur, n - 1);
    }
    return fillParCouleur.get(couleur);
  };
  return {
    /** Index du style `s` avec cet alignement, et sa police à `echelle` de sa taille (copie créée à la première demande). */
    aligner(s, { retour, reduire, vertical, echelle }) {
      const cle = `${s}|${retour ?? ''}|${reduire ?? ''}|${vertical ?? ''}|${echelle ?? ''}`;
      if (!xfParCouple.has(cle)) {
        const xfs = enfantsNommes(cellXfs, 'xf');
        const origine = xfs[Number(s)];
        if (!origine) throw impossible(`le style ${s} n’existe pas dans styles.xml.`);
        const copie = structuredClone(origine);
        let alignement = enfantNomme(copie, 'alignment');
        if (!alignement) {
          alignement = element(`${p}alignment`);
          copie.enfants.unshift(alignement);
        }
        if (retour !== undefined) {
          alignement.attrs.wrapText = retour ? 'true' : 'false';
          if (retour && alignement.attrs.shrinkToFit !== undefined) alignement.attrs.shrinkToFit = 'false';
        }
        if (reduire !== undefined) {
          alignement.attrs.shrinkToFit = reduire ? 'true' : 'false';
          if (reduire) alignement.attrs.wrapText = 'false';
        }
        if (vertical !== undefined) alignement.attrs.vertical = vertical;
        if (echelle !== undefined && echelle < 1) {
          copie.attrs.fontId = String(fontDe(Number(origine.attrs.fontId ?? 0), echelle));
          copie.attrs.applyFont = 'true';
        }
        copie.attrs.applyAlignment = 'true';
        cellXfs.enfants.push(copie);
        cellXfs.attrs.count = String(xfs.length + 1);
        xfParCouple.set(cle, xfs.length);
      }
      return xfParCouple.get(cle);
    },
    /** Index du style `s` avec le fond `couleur` (copie créée à la première demande). */
    remplir(s, couleur) {
      const cle = `${s}|${couleur}`;
      if (!xfParCouple.has(cle)) {
        const xfs = enfantsNommes(cellXfs, 'xf');
        const origine = xfs[Number(s)];
        if (!origine) throw impossible(`le style ${s} n’existe pas dans styles.xml.`);
        const copie = structuredClone(origine);
        copie.attrs.fillId = String(fillDe(couleur));
        copie.attrs.applyFill = 'true';
        cellXfs.enfants.push(copie);
        cellXfs.attrs.count = String(xfs.length + 1);
        xfParCouple.set(cle, xfs.length);
      }
      return xfParCouple.get(cle);
    },
  };
}

// ---------- valeurs ----------
const ENFANTS_DE_VALEUR = new Set(['f', 'v', 'is']);
const estVide = (valeur) => valeur === null || valeur === undefined || valeur === ''
  || (typeof valeur === 'number' && !Number.isFinite(valeur)) || (typeof valeur === 'string' && texteDeCase(valeur) === '');

/** Écrit `valeur` dans la case (son style gardé) ; `chaines` : les chaînes partagées (null s'il n'y a aucun texte à écrire). */
function ecrireValeur(cell, valeur, chaines) {
  const p = prefixeDe(cell.nom);
  if (cell.attrs.t === 's') chaines?.compter(-1);
  const autres = cell.enfants.filter((e) => typeof e === 'object' && !ENFANTS_DE_VALEUR.has(nomLocal(e.nom)));
  delete cell.attrs.t;
  delete cell.attrs.vm; // métadonnées de l'ancienne valeur
  delete cell.attrs.cm;
  let v = null;
  if (estVide(valeur)) v = null;
  else if (typeof valeur === 'number') v = String(Object.is(valeur, -0) ? 0 : valeur);
  else if (typeof valeur === 'boolean') {
    cell.attrs.t = 'b';
    v = valeur ? '1' : '0';
  } else if (typeof valeur === 'string') {
    cell.attrs.t = 's';
    v = String(chaines.indexDe(texteDeCase(valeur)));
    chaines.compter(1);
  } else throw impossible(`valeur de case ni texte ni nombre (« ${cell.attrs.r} »).`);
  cell.enfants = v === null ? autres : [element(`${p}v`, {}, [v]), ...autres];
}

// ---------- image ----------
/** L'image (<pic>) de l'ancre dont le coin de départ est la case A1 (twoCellAnchor ou oneCellAnchor), ou null. */
function imageEnA1(dessin) {
  for (const ancre of enfantsNommes(dessin)) {
    if (!['twoCellAnchor', 'oneCellAnchor'].includes(nomLocal(ancre.nom))) continue;
    const de = enfantNomme(ancre, 'from');
    const pic = enfantNomme(ancre, 'pic');
    if (pic && texteDe(enfantNomme(de, 'col')).trim() === '0' && texteDe(enfantNomme(de, 'row')).trim() === '0') return pic;
  }
  return null;
}

/** Les octets de l'image, vérifiés : du type annoncé (signature), PNG ou JPEG. */
function verifierImage(image) {
  const forme = IMAGES[image?.type];
  if (!forme) throw impossible(`image de type « ${image?.type} » : PNG ou JPEG seulement.`);
  const octets = image.octets instanceof ArrayBuffer ? new Uint8Array(image.octets) : image.octets;
  if (!(octets instanceof Uint8Array) || octets.length < forme.signature.length || forme.signature.some((o, i) => octets[i] !== o)) {
    throw impossible(`l’image n’est pas un ${forme.nom}.`);
  }
  return { forme, octets };
}

/** Partie de la nouvelle image : même dossier et même nom que l'ancienne avec l'extension du type, sinon imageN si ce nom est pris. */
function cheminLibre(parties, ancien, extension) {
  const dossier = dossierDe(ancien);
  const voulu = `${dossier}${ancien.slice(dossier.length).replace(/\.[^.]*$/, '')}.${extension}`;
  if (voulu.toLowerCase() === ancien.toLowerCase() || !partieExistante(parties, voulu)) return voulu;
  for (let n = 1; ; n++) {
    const autre = `${dossier}image${n}.${extension}`;
    if (!partieExistante(parties, autre)) return autre;
  }
}

/** Nombre de relations du paquet qui citent la partie `chemin`. */
function citations(xml, parties, chemin) {
  let n = 0;
  for (const rels of parties.keys()) {
    const m = /^(.*?)_rels\/[^/]*\.rels$/.exec(rels);
    if (!m) continue;
    for (const el of enfantsNommes(xml.lire(rels), 'Relationship')) {
      if (el.attrs.TargetMode !== 'External' && resoudre(m[1], el.attrs.Target).toLowerCase() === chemin.toLowerCase()) n++;
    }
  }
  return n;
}

// ---------- [Content_Types].xml ----------
const TYPES = '[Content_Types].xml';
const overrideDe = (racine, chemin) =>
  enfantsNommes(racine, 'Override').find((o) => String(o.attrs.PartName).toLowerCase() === `/${chemin}`.toLowerCase()) ?? null;

/** Retire l'Override d'une partie retirée. */
function retirerLeType(xml, chemin) {
  const racine = xml.lire(TYPES);
  const o = overrideDe(racine, chemin);
  if (o) xml.changer(TYPES).enfants = racine.enfants.filter((e) => e !== o);
}

/** Pose l'Override de `chemin` ; `remplace` : la partie retirée dont l'Override est repris à sa place. */
function poserLeType(xml, chemin, type, remplace = null) {
  const racine = xml.changer(TYPES);
  const o = overrideDe(racine, chemin) ?? (remplace && overrideDe(racine, remplace));
  if (o) {
    o.attrs.PartName = `/${chemin}`;
    o.attrs.ContentType = type;
  } else racine.enfants.push(element(`${prefixeDe(racine.nom)}Override`, { PartName: `/${chemin}`, ContentType: type }));
}

// ---------- propriétés du document ----------
function dateDe(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(String(date));
  if (Number.isNaN(d.getTime())) throw impossible(`date invalide « ${date} ».`);
  return d;
}

/** Préfixe déclaré pour l'espace de noms `ns` sur la racine (déclaré au besoin sous `voulu`). */
function prefixePour(racine, ns, voulu) {
  const trouve = Object.entries(racine.attrs).find(([nom, valeur]) => nom.startsWith('xmlns:') && valeur === ns);
  if (trouve) return trouve[0].slice(6);
  racine.attrs[`xmlns:${voulu}`] = ns;
  return voulu;
}

/** L'élément `local` de l'espace de noms `ns` sous la racine de docProps/core.xml, créé au besoin. */
function proprieteDe(racine, ns, voulu, local, attrs = {}) {
  const existant = enfantsNommes(racine, local).find((e) => {
    const p = e.nom.includes(':') ? e.nom.slice(0, e.nom.indexOf(':')) : '';
    return (p ? racine.attrs[`xmlns:${p}`] : racine.attrs.xmlns) === ns;
  });
  if (existant) return existant;
  const el = element(`${prefixePour(racine, ns, voulu)}:${local}`, attrs);
  racine.enfants.push(el);
  return el;
}

// ---------- écriture du classeur ----------
/**
 * Écrit un .xlsx d'après le modèle (voir l'en-tête). Error « Classeur impossible à écrire : … » sur une entrée invalide ou un modèle incomplet.
 * @param {Uint8Array | ArrayBuffer} modele le .xlsx du modèle
 * @param {{ cellules?: Record<string, string | number | boolean | null>, remplis?: Record<string, string>,
 *   alignements?: Record<string, { retour?: boolean, reduire?: boolean, vertical?: 'top' | 'center' | 'bottom', echelle?: number }>,
 *   image?: { octets: Uint8Array, type: 'image/png' | 'image/jpeg' } | null, descriptionImage?: string, titre?: string,
 *   date?: Date | string | null }} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function ecrireXlsx(modele, { cellules = {}, remplis = {}, alignements = {}, image = null, descriptionImage = '', titre = '', date = null } = {}) {
  const quand = date === null || date === undefined || date === '' ? null : dateDe(date);
  const aRemplir = Object.entries(remplis ?? {}).filter(([, couleur]) => couleur !== null && couleur !== undefined && couleur !== '');
  for (const [adresse, couleur] of aRemplir) {
    if (!COULEUR.test(String(couleur))) throw impossible(`couleur invalide « ${couleur} » pour ${adresse} (RRGGBB attendu).`);
  }
  const aAligner = Object.entries(alignements ?? {})
    .filter(([, a]) => a && (a.retour !== undefined || a.reduire !== undefined || a.vertical !== undefined || a.echelle !== undefined));
  for (const [adresse, a] of aAligner) {
    const booleen = (v) => v === undefined || typeof v === 'boolean';
    const echelle = a.echelle === undefined || (typeof a.echelle === 'number' && a.echelle > 0 && a.echelle <= 1);
    if (!booleen(a.retour) || !booleen(a.reduire) || (a.retour && a.reduire) || (a.vertical !== undefined && !VERTICAUX.has(a.vertical)) || !echelle) {
      throw impossible(`alignement invalide ${JSON.stringify(a)} pour ${adresse} (retour, reduire : booléens qui s’excluent ; vertical : top, center ou bottom ; `
        + 'echelle : nombre de 0 exclu à 1).');
    }
  }
  const aEcrire = Object.entries(cellules ?? {});
  const imageVerifiee = image ? verifierImage(image) : null;

  const parties = await lireZip(modele);
  const xml = atelier(parties);
  if (!parties.has(TYPES)) throw impossible(`le modèle est incomplet (« ${TYPES} » manque).`);

  // classeur, feuilles (la première est celle qu'on remplit)
  const relsPaquet = relationsDe(xml, parties, '');
  const classeur = partieExistante(parties, relationDeType(relsPaquet, '/officeDocument')?.cible ?? 'xl/workbook.xml');
  if (!classeur) throw impossible('le modèle n’est pas un classeur .xlsx (xl/workbook.xml introuvable).');
  const relsClasseur = relationsDe(xml, parties, classeur);
  const feuilles = enfantsNommes(enfantNomme(xml.lire(classeur), 'sheets'), 'sheet')
    .map((s) => relsClasseur.find((r) => r.id === attributLocal(s, 'id') && !r.externe)?.cible)
    .map((c) => c && partieExistante(parties, c))
    .filter(Boolean);
  if (!feuilles.length) throw impossible('le modèle n’a pas de feuille.');
  const [premiere] = feuilles;

  // toutes les formules retirées (« seul le résultat »), et la chaîne de calcul qui les citait
  for (const chemin of feuilles) {
    if (/<(?:[\w.-]+:)?f[\s/>]/.test(DECODEUR.decode(parties.get(chemin))) && retirerLesFormules(xml.lire(chemin)) > 0) xml.changer(chemin);
  }
  const calcul = relationDeType(relsClasseur, '/calcChain');
  if (calcul) {
    const rels = xml.changer(relsDe(classeur));
    rels.enfants = rels.enfants.filter((e) => e !== calcul.el);
    const chemin = partieExistante(parties, calcul.cible);
    if (chemin) {
      parties.delete(chemin);
      xml.oublier(chemin);
      retirerLeType(xml, chemin);
    }
  }

  const feuille = feuilleDe(xml.changer(premiere));

  // les fonds et les alignements d'abord (le style de la case), puis les valeurs
  if (aRemplir.length || aAligner.length) {
    const relStyles = relationDeType(relsClasseur, '/styles');
    const chemin = relStyles && partieExistante(parties, relStyles.cible);
    if (!chemin) throw impossible('le modèle n’a pas de styles.xml.');
    const styles = stylesDe(xml.changer(chemin));
    for (const [adresse, couleur] of aRemplir) {
      const cell = feuille.caseDe(adresse);
      cell.attrs.s = String(styles.remplir(cell.attrs.s ?? '0', String(couleur).toUpperCase()));
    }
    for (const [adresse, a] of aAligner) {
      const cell = feuille.caseDe(adresse);
      cell.attrs.s = String(styles.aligner(cell.attrs.s ?? '0', a));
    }
  }

  if (aEcrire.length) {
    let chaines = null;
    const relChaines = relationDeType(relsClasseur, '/sharedStrings');
    let cheminChaines = relChaines && partieExistante(parties, relChaines.cible);
    if (!cheminChaines && aEcrire.some(([, v]) => typeof v === 'string' && !estVide(v))) {
      // pas de chaînes partagées dans le modèle : la partie est créée (et citée par le classeur)
      cheminChaines = relChaines?.cible ?? `${dossierDe(classeur)}sharedStrings.xml`;
      if (!relChaines) {
        const rels = xml.changer(relsDe(classeur));
        const pris = new Set(enfantsNommes(rels, 'Relationship').map((r) => r.attrs.Id));
        let n = 1;
        while (pris.has(`rId${n}`)) n++;
        const cible = cheminChaines.slice(dossierDe(classeur).length);
        rels.enfants.push(element(`${prefixeDe(rels.nom)}Relationship`, { Id: `rId${n}`, Type: REL_CHAINES, Target: cible }));
      }
      parties.set(cheminChaines, new Uint8Array(0));
      xml.creer(cheminChaines, element('sst', { xmlns: NS_MAIN, count: '0', uniqueCount: '0' }));
      poserLeType(xml, cheminChaines, TYPE_CHAINES);
    }
    if (cheminChaines) chaines = chainesDe(xml.changer(cheminChaines));
    for (const [adresse, valeur] of aEcrire) {
      const cell = feuille.caseDe(adresse, { creer: !estVide(valeur) });
      if (cell) ecrireValeur(cell, valeur, chaines);
    }
    chaines?.finir();
  }

  // l'image ancrée en A1 : nommée (Portrait ou Logo), décrite, remplacée si une image est donnée
  const dessin = (() => {
    const id = attributLocal(enfantNomme(xml.lire(premiere), 'drawing'), 'id');
    const rel = id ? relationsDe(xml, parties, premiere).find((r) => r.id === id && !r.externe) : null;
    return rel ? partieExistante(parties, rel.cible) : null;
  })();
  const pic = dessin ? imageEnA1(xml.lire(dessin)) : null;
  if (imageVerifiee && !pic) throw impossible('le modèle n’a pas d’image ancrée en A1.');
  if (pic) {
    xml.changer(dessin);
    const cNvPr = enfantNomme(enfantNomme(pic, 'nvPicPr'), 'cNvPr');
    if (cNvPr) {
      cNvPr.attrs.name = image ? 'Portrait' : 'Logo';
      cNvPr.attrs.descr = String(descriptionImage ?? '');
    }
  }
  if (imageVerifiee) {
    const { forme, octets } = imageVerifiee;
    const id = attributLocal(enfantNomme(enfantNomme(pic, 'blipFill'), 'blip'), 'embed');
    const rel = id ? relationsDe(xml, parties, dessin).find((r) => r.id === id && !r.externe) : null;
    const ancien = rel && partieExistante(parties, rel.cible);
    if (!ancien) throw impossible('l’image en A1 du modèle n’a pas de fichier.');
    const nouveau = cheminLibre(parties, ancien, forme.extension);
    if (nouveau.toLowerCase() === ancien.toLowerCase()) {
      parties.set(ancien, octets);
      poserLeType(xml, ancien, image.type);
    } else {
      const seule = citations(xml, parties, ancien) <= 1; // l'ancienne n'est citée que par ce dessin : elle part
      xml.changer(relsDe(dessin));
      rel.el.attrs.Target = String(rel.el.attrs.Target).replace(/[^/]*$/, nouveau.slice(dossierDe(nouveau).length));
      // la nouvelle image prend la place de l'ancienne dans l'archive
      const suite = [...parties].flatMap(([nom, contenu]) => (nom === ancien ? [[nouveau, octets], ...(seule ? [] : [[nom, contenu]])] : [[nom, contenu]]));
      parties.clear();
      for (const [nom, contenu] of suite) parties.set(nom, contenu);
      poserLeType(xml, nouveau, image.type, seule ? ancien : null);
    }
  }

  // propriétés du document
  const relCore = relationDeType(relsPaquet, '/core-properties');
  const cheminCore = relCore && partieExistante(parties, relCore.cible);
  if ((titre || quand) && cheminCore) {
    const core = xml.changer(cheminCore);
    if (titre) proprieteDe(core, NS_DC, 'dc', 'title').enfants = [String(titre)];
    if (quand) {
      const xsi = prefixePour(core, NS_XSI, 'xsi');
      const modifie = proprieteDe(core, NS_DCTERMS, 'dcterms', 'modified', { [`${xsi}:type`]: 'dcterms:W3CDTF' });
      modifie.enfants = [quand.toISOString().replace(/\.\d{3}Z$/, 'Z')];
    }
  }

  for (const [chemin, arbre] of xml.reecrites()) if (parties.has(chemin)) parties.set(chemin, serialiserXml(arbre));
  return ecrireZip(parties, quand ? { date: quand } : {});
}

// ---------- zones des cases ----------
/** Largeur d'une colonne en points, d'après sa largeur en caractères (la règle d'Excel : chiffre de 7 pixels de Calibri 11, à 96 points par pouce). */
export const pointsDeLaColonne = (largeur) => Math.trunc(((256 * largeur + Math.trunc(128 / 7)) / 256) * 7) * 0.75;

/**
 * Les zones de la première feuille d'un classeur : Map<adresse (une case seule, ou le haut à gauche d'une fusion), { colonnes, lignes, largeur, hauteur
 * (en points : la fusion entière), police (son nom), taille (son corps), gras, retour (wrapText), reduire (shrinkToFit), vertical }> pour chaque case écrite
 * dans la feuille (les cases couvertes par une fusion n'en ont pas). Ce que lib/tableur-mesure.mjs mesure pour dire si un texte tient dans sa case.
 */
export async function zonesDuClasseur(modele) {
  const parties = await lireZip(modele);
  const xml = atelier(parties);
  const relsPaquet = relationsDe(xml, parties, '');
  const classeur = partieExistante(parties, relationDeType(relsPaquet, '/officeDocument')?.cible ?? 'xl/workbook.xml');
  if (!classeur) throw impossible('le modèle n’est pas un classeur .xlsx (xl/workbook.xml introuvable).');
  const relsClasseur = relationsDe(xml, parties, classeur);
  const premiere = enfantsNommes(enfantNomme(xml.lire(classeur), 'sheets'), 'sheet')
    .map((s) => relsClasseur.find((r) => r.id === attributLocal(s, 'id') && !r.externe)?.cible)
    .map((c) => c && partieExistante(parties, c))
    .find(Boolean);
  if (!premiere) throw impossible('le modèle n’a pas de feuille.');
  const relStyles = relationDeType(relsClasseur, '/styles');
  const cheminStyles = relStyles && partieExistante(parties, relStyles.cible);
  const styles = cheminStyles ? xml.lire(cheminStyles) : null;
  const polices = enfantsNommes(enfantNomme(styles, 'fonts'), 'font').map((f) => ({
    nom: attributLocal(enfantNomme(f, 'name'), 'val') ?? 'Calibri',
    taille: Number(attributLocal(enfantNomme(f, 'sz'), 'val') ?? 11),
    gras: enfantNomme(f, 'b') !== null && !['0', 'false'].includes(attributLocal(enfantNomme(f, 'b'), 'val') ?? 'true'),
  }));
  const formats = enfantsNommes(enfantNomme(styles, 'cellXfs'), 'xf').map((x) => {
    const a = enfantNomme(x, 'alignment');
    return { police: polices[Number(x.attrs.fontId ?? 0)] ?? { nom: 'Calibri', taille: 11, gras: false }, retour: vrai(a?.attrs.wrapText), reduire: vrai(a?.attrs.shrinkToFit), vertical: a?.attrs.vertical ?? 'bottom' };
  });

  const feuille = xml.lire(premiere);
  const format = enfantNomme(feuille, 'sheetFormatPr');
  const largeurParDefaut = Number(format?.attrs.defaultColWidth ?? Number(format?.attrs.baseColWidth ?? 8) + 0.71);
  const hauteurParDefaut = Number(format?.attrs.defaultRowHeight ?? 15);
  const colonnes = enfantsNommes(enfantNomme(feuille, 'cols'), 'col').map((c) => ({ min: Number(c.attrs.min), max: Number(c.attrs.max), largeur: Number(c.attrs.width) }));
  const largeurDe = (colonne) => pointsDeLaColonne(colonnes.find((c) => c.min <= colonne && colonne <= c.max && Number.isFinite(c.largeur))?.largeur ?? largeurParDefaut);
  const hauteurs = new Map();
  const cases = [];
  let n = 0;
  for (const row of enfantsNommes(enfantNomme(feuille, 'sheetData'), 'row')) {
    n = row.attrs.r !== undefined ? Number(row.attrs.r) : n + 1;
    if (row.attrs.ht !== undefined) hauteurs.set(n, Number(row.attrs.ht));
    let c = 0;
    for (const cell of enfantsNommes(row, 'c')) {
      c = cell.attrs.r !== undefined ? decouperAdresse(cell.attrs.r)?.colonne ?? c + 1 : c + 1;
      cases.push({ colonne: c, ligne: n, s: Number(cell.attrs.s ?? 0) });
    }
  }
  const hauteurDe = (ligne) => hauteurs.get(ligne) ?? hauteurParDefaut;
  const fusions = new Map();
  const couvertes = new Set();
  for (const m of enfantsNommes(enfantNomme(feuille, 'mergeCells'), 'mergeCell')) {
    const b = bornesDe(m.attrs.ref);
    if (!b) continue;
    fusions.set(`${lettresDeColonne(b.c1)}${b.l1}`, b);
    for (let l = b.l1; l <= b.l2; l++) for (let k = b.c1; k <= b.c2; k++) if (l !== b.l1 || k !== b.c1) couvertes.add(`${lettresDeColonne(k)}${l}`);
  }
  const zones = new Map();
  for (const { colonne, ligne, s } of cases) {
    const adresse = `${lettresDeColonne(colonne)}${ligne}`;
    if (couvertes.has(adresse)) continue;
    const b = fusions.get(adresse) ?? { c1: colonne, l1: ligne, c2: colonne, l2: ligne };
    const f = formats[s] ?? formats[0] ?? { police: { nom: 'Calibri', taille: 11, gras: false }, retour: false, reduire: false, vertical: 'bottom' };
    let largeur = 0;
    for (let k = b.c1; k <= b.c2; k++) largeur += largeurDe(k);
    let hauteur = 0;
    for (let l = b.l1; l <= b.l2; l++) hauteur += hauteurDe(l);
    zones.set(adresse, {
      colonnes: b.c2 - b.c1 + 1, lignes: b.l2 - b.l1 + 1, largeur, hauteur, police: f.police.nom, taille: f.police.taille, gras: f.police.gras, retour: f.retour, reduire: f.reduire,
      vertical: f.vertical,
    });
  }
  return zones;
}
