// Ce qu'une case de tableur peut montrer d'un texte, et la coupure d'un texte trop long (demande du propriétaire, 2026-10-15 : « Évidemment toutes les
// infos ne rentrent peut-être pas dans ces fiches-là. Toute info supplémentaire peut être notée dans les « Notes » »). La fiche exportée
// (lib/fiche-tableur-export.mjs) ne laisse pas un texte déborder de sa case, où il serait rogné à l'écran comme à l'impression : elle en garde le début,
// fini par « … » ; seule la part du texte que l'import relit (`lu` : des données du personnage, pas un texte de règles que le site refait) a une suite,
// reportée dans la case NOTE, que l'import (lib/fiche-tableur-import.mjs) recolle au début.
// Module de format, qui ne sait rien du jeu ; sans dépendance. Réservé à src/scripts/fiche.mjs (et aux modules du tableur, aux tests) : un module
// importé par deux scripts de page casse la version portable (skill site-version-portable).
// Décisions :
//   - la zone d'une case (lib/tableur-ecriture.mjs#zonesDuClasseur) : sa largeur et sa hauteur en points (la fusion entière), le nom, la taille et la
//     graisse de sa police, le retour à la ligne, la réduction au besoin (shrinkToFit : le tableur rapetisse le texte, qui tient donc toujours) ;
//   - la largeur d'un texte : les chasses de la police de la case (Calibri, celle du modèle, ou Arial : celles de Carlito et de Liberation Sans, qui
//     leur sont métriquement identiques, en centièmes de cadratin), une lettre accentuée comme sa lettre de base, un caractère inconnu large (un
//     cadratin) : on se trompe du côté de la coupure ;
//   - les lignes : coupure aux espaces comme le tableur (un mot trop long pour une ligne se coupe), interligne de la police, une marge de 2 points en
//     largeur et 1 point en hauteur ; sans retour à la ligne, une seule ligne et pas de saut de ligne ;
//   - la coupure : à un saut de ligne ou à une espace suivie d'un caractère visible, le début fini par « … » (« <début> … ») ; faute de
//     blanc, au milieu d'un mot (« <début>… ») ; la suite s'écrit sur une ligne, ses sauts de ligne en « ⏎ » ; début et suite recollés redonnent le
//     texte exact (sauf des blancs en fin de texte). Un texte qui contient déjà « ⏎ » ne se coupe pas ;
//   - la suite ne porte que la part relue du texte (ses `lu` premiers caractères, tout par défaut) qui n'est pas montrée : coupé au-delà, un texte
//     n'a pas de suite (ce qu'il ne montre pas, le site le refait) ; recollée, la suite redonne cette part, sans le reste ;
//   - avant de couper (ajusterLeTexte) : une case de plusieurs rangées prend le retour à la ligne ; une case d'une rangée, la réduction au besoin
//     (shrinkToFit, comme les noms et types de dons du modèle) tant que le texte garde ECHELLE_MIN de sa taille. Une case d'une rangée qu'il faut
//     couper prend d'abord la réduction minimale : sa police est écrite à ECHELLE_MIN de sa taille (alignement `echelle`, lib/tableur-ecriture.mjs),
//     puis le début est coupé à cette taille ; sinon un début court (coupé au premier saut de ligne) resterait à sa taille entière à côté des cases
//     réduites de la même colonne (constat du 2026-10-15). Google Sheets ne réduit pas au besoin : il rogne ce qui dépasse, mais suit la police
//     écrite ;
//   - une suite relue tolère les espaces autour de « ⏎ » (un tableur qui replie les blancs d'une case) : « ⏎ », avec au plus une espace de
//     chaque côté, redonne un saut de ligne.

/**
 * Chasses des polices du modèle, de « » (U+0020) à « ~ » (U+007E), en centièmes de cadratin, romain puis gras, relevées sur les polices
 * métriquement identiques que LibreOffice emploie (Carlito pour Calibri, Liberation Sans pour Arial) ; quelques signes hors ASCII que la fiche
 * écrit ; l'interligne (ascendante + descendante), en corps.
 */
const POLICES = Object.freeze({
  calibri: {
    romain: '2333405051716822303050502531253951515151515151515151272750505046895854536249466362253252428565665267544649645789524947313931505029485342535031475323244523805353535335393353457143454031463150',
    gras: '2333445051737023313150502631274351515151515151515151282850505046906156536349466463273355428766685369564750655991555248324332505030495442545032475425264825815454545436403554477546474034483450',
    autres: { '’': 0.25, '‘': 0.25, '«': 0.51, '»': 0.51, '—': 0.91, '–': 0.5, '…': 0.69, '×': 0.5, '·': 0.25, 'œ': 0.85, 'Œ': 1.03, 'æ': 0.8, 'Æ': 0.9, '€': 0.51, '−': 0.5, 'ß': 0.53, '→': 0.91, '\u00a0': 0.23, '\u202f': 0.23 },
    interligne: 1.222,
  },
  arial: {
    romain: '2828355656896719333339582833282856565656565656565656282858585856996767727267617872285067568372786778726761726794676761282828475633565650565628565622225022835656565633502856507250505033263358',
    gras: '2833475656897224333339582833282856565656565656565656333358585861987272727267617872285672618372786778726761726794676761332833585633566156615633616128285628896161616139563361567856565039283958',
    autres: { '’': 0.28, '‘': 0.28, '«': 0.56, '»': 0.56, '—': 1, '–': 0.56, '…': 1, '×': 0.58, '·': 0.33, 'œ': 0.94, 'Œ': 1, 'æ': 0.89, 'Æ': 1, '€': 0.56, '−': 0.58, 'ß': 0.61, '→': 1, '\u00a0': 0.28, '\u202f': 0.28 },
    interligne: 1.15,
  },
});
// chaque table : 95 chasses de deux chiffres (« @ » d'Arial, 1,015 cadratin, compté 0,99)
const TABLES = Object.fromEntries(Object.entries(POLICES).map(([nom, p]) => [nom, {
  ...p,
  romain: Array.from({ length: p.romain.length / 2 }, (_, i) => Number(p.romain.slice(2 * i, 2 * i + 2)) / 100),
  gras: Array.from({ length: p.gras.length / 2 }, (_, i) => Number(p.gras.slice(2 * i, 2 * i + 2)) / 100),
}]));
/** La famille d'une police (son nom dans le classeur) : Arial et ses équivalents, sinon Calibri (la police du modèle). */
const familleDe = (police) => (/arial|liberation sans|helvetica|arimo/i.test(String(police ?? '')) ? 'arial' : 'calibri');
/** Un caractère inconnu (étoiles, coches : absents de ces polices, pris dans une autre ; la flèche « → », qu'elles ont, est dans leur table). */
const CHASSE_INCONNUE = 1;

/** Marges intérieures d'une case, en points (largeur, hauteur). */
const MARGE_LARGEUR = 2;
const MARGE_HAUTEUR = 1;

/** Fin du début d'un texte coupé à un blanc, et au milieu d'un mot. */
export const FIN_COUPEE = ' …';
export const FIN_COUPEE_DANS_UN_MOT = '…';
/** Saut de ligne dans la suite d'un texte (écrite sur une ligne). */
export const SAUT_DANS_LA_SUITE = '⏎';

/** La chasse d'un caractère, en cadratins. */
function chasse(c, gras, famille) {
  const code = c.codePointAt(0);
  const table = gras ? TABLES[famille].gras : TABLES[famille].romain;
  if (code >= 32 && code <= 126) return table[code - 32];
  if (TABLES[famille].autres[c] !== undefined) return TABLES[famille].autres[c];
  const base = c.normalize('NFD')[0];
  const b = base.codePointAt(0);
  if (base !== c && b >= 32 && b <= 126) return table[b - 32];
  return CHASSE_INCONNUE;
}

/** La largeur d'un texte d'une ligne, en points, dans une police de `taille` points (romain ou gras ; `police` : son nom, Calibri par défaut). */
export function largeurDuTexte(texte, taille, gras = false, police = 'Calibri') {
  const famille = familleDe(police);
  let em = 0;
  for (const c of String(texte ?? '')) em += chasse(c, gras, famille);
  return em * taille;
}

/** Les lignes qu'occupe un texte coupé aux espaces dans une largeur de `largeur` points (un paragraphe vide compte pour une ligne). */
export function lignesDuTexte(texte, largeur, taille, gras = false, police = 'Calibri') {
  if (!(largeur > 0)) return Infinity;
  const espace = largeurDuTexte(' ', taille, gras, police);
  let lignes = 0;
  for (const paragraphe of String(texte ?? '').split('\n')) {
    let ligne = 0;
    let n = 1;
    for (const mot of paragraphe.split(' ')) {
      let l = largeurDuTexte(mot, taille, gras, police);
      if (ligne > 0 && ligne + espace + l <= largeur) {
        ligne += espace + l;
        continue;
      }
      if (ligne > 0) n += 1;
      // un mot plus large que la ligne se coupe où il faut
      while (l > largeur) {
        n += 1;
        l -= largeur;
      }
      ligne = l;
    }
    lignes += n;
  }
  return lignes;
}

/** Une case d'une rangée rapetisse son texte jusqu'à cette échelle (8 points → 4,8) ; au-delà, il se coupe. */
export const ECHELLE_MIN = 0.6;

/** La largeur et le nombre de lignes utiles d'une zone. */
const utile = (zone) => ({
  largeur: Math.max(0, zone.largeur - MARGE_LARGEUR),
  lignes: zone.retour ? Math.max(1, Math.floor((zone.hauteur - MARGE_HAUTEUR) / (TABLES[familleDe(zone.police)].interligne * zone.taille))) : 1,
});

/**
 * Le texte tient-il dans la zone ? `zone` : { largeur, hauteur (points), police, taille, gras, retour, reduire } (lib/tableur-ecriture.mjs#zonesDuClasseur).
 * Réduite au besoin, une case montre tout ; sans retour à la ligne, une ligne sans saut de ligne.
 */
export function tientDans(texte, zone) {
  const t = String(texte ?? '');
  if (zone.reduire) return true;
  const u = utile(zone);
  if (!zone.retour) return !t.includes('\n') && largeurDuTexte(t, zone.taille, zone.gras, zone.police) <= u.largeur;
  return lignesDuTexte(t, u.largeur, zone.taille, zone.gras, zone.police) <= u.lignes;
}

const BLANC = /[ \n]/;

/**
 * Un texte trop long pour sa zone, coupé : { debut, suite } — `debut` tient dans la zone et finit par FIN_COUPEE (coupé à un blanc) ou
 * FIN_COUPEE_DANS_UN_MOT ; `suite` est le reste de la part relue (`lu` : ses premiers caractères, tout le texte par défaut), sur une ligne
 * (encoderLaSuite), ou null quand la coupure tombe au-delà. null si le texte tient, s'il contient SAUT_DANS_LA_SUITE, ou si même « … » seul ne tient pas.
 */
export function couperLeTexte(texte, zone, { lu = null } = {}) {
  const t = String(texte ?? '');
  if (tientDans(t, zone) || t.includes(SAUT_DANS_LA_SUITE)) return null;
  const fin = lu === null ? t.length : Math.max(0, Math.min(t.length, lu));
  const suiteDe = (k) => (k < fin ? encoderLaSuite(t.slice(k, fin)) || null : null);
  // à un saut de ligne, ou à une espace suivie d'un caractère visible (la suite, relue sans ses blancs de bord, se recolle exactement)
  const blancs = [];
  for (let k = 1; k < t.length; k += 1) {
    if (t[k] === '\n' || (t[k] === ' ' && k + 1 < t.length && !BLANC.test(t[k + 1]))) blancs.push(k);
  }
  const auBlanc = dernierQuiTient(blancs, (k) => t.slice(0, k) + FIN_COUPEE, zone);
  if (auBlanc !== null) return { debut: t.slice(0, auBlanc) + FIN_COUPEE, suite: suiteDe(auBlanc) };
  // un premier mot trop long : coupé dans le mot (entre deux caractères visibles, paires de substitution gardées)
  const positions = [];
  const caracteres = [...t];
  for (let i = 1, k = caracteres[0].length; i < caracteres.length; k += caracteres[i].length, i += 1) {
    if (!BLANC.test(caracteres[i]) && !BLANC.test(caracteres[i - 1])) positions.push(k);
  }
  const dansUnMot = dernierQuiTient(positions, (k) => t.slice(0, k) + FIN_COUPEE_DANS_UN_MOT, zone);
  if (dansUnMot === null) return null;
  return { debut: t.slice(0, dansUnMot) + FIN_COUPEE_DANS_UN_MOT, suite: suiteDe(dansUnMot) };
}

/** La dernière position (croissantes) dont le début tient dans la zone ; null si aucune. Recherche dichotomique : un début plus long n'en prend pas moins de place. */
function dernierQuiTient(positions, debut, zone) {
  let bas = 0;
  let haut = positions.length - 1;
  let trouve = null;
  while (bas <= haut) {
    const milieu = (bas + haut) >> 1;
    if (tientDans(debut(positions[milieu]), zone)) {
      trouve = positions[milieu];
      bas = milieu + 1;
    } else haut = milieu - 1;
  }
  return trouve;
}

/** La suite d'un texte sur une ligne : chaque saut de ligne en « ⏎ » entouré d'une espace (les blancs voisins gardés), l'espace de la coupure retirée. */
export function encoderLaSuite(suite) {
  return String(suite ?? '').replace(/\n/g, ` ${SAUT_DANS_LA_SUITE} `).trim();
}

/**
 * Les sauts de ligne d'une suite lue (encoderLaSuite) : chaque « ⏎ » et au plus une espace de chaque côté. Tolérant : « a ⏎ ⏎ b » (les deux espaces
 * entre deux sauts repliées en une par le tableur) redonne la ligne vide, comme « a ⏎  ⏎ b ».
 */
const decoderLaSuite = (suite) => suite.replace(new RegExp(` ?${SAUT_DANS_LA_SUITE} ?`, 'g'), '\n');

/** Le début d'un texte coupé (couperLeTexte), sans sa fin « … » ; null pour un texte qui ne finit pas ainsi. */
export function sansLaCoupure(texte) {
  const t = String(texte ?? '');
  if (t.endsWith(FIN_COUPEE)) return t.slice(0, -FIN_COUPEE.length);
  if (t.endsWith(FIN_COUPEE_DANS_UN_MOT)) return t.slice(0, -FIN_COUPEE_DANS_UN_MOT.length);
  return null;
}

/**
 * Le texte entier d'une case coupée : son début (qui finit par FIN_COUPEE ou FIN_COUPEE_DANS_UN_MOT) et la suite lue dans la note ; null si le début
 * ne finit pas ainsi (la case a été réécrite : la suite ne s'y recolle pas).
 */
export function recollerLeTexte(debut, suite) {
  const d = String(debut ?? '');
  const s = String(suite ?? '').trim();
  const lue = decoderLaSuite(s);
  if (d.endsWith(FIN_COUPEE)) return d.slice(0, -FIN_COUPEE.length) + (s.startsWith(SAUT_DANS_LA_SUITE) ? '' : ' ') + lue;
  if (d.endsWith(FIN_COUPEE_DANS_UN_MOT)) return d.slice(0, -FIN_COUPEE_DANS_UN_MOT.length) + lue;
  return null;
}

/**
 * Ce que la fiche écrit dans une case pour un texte : { texte, alignement, suite } — le texte s'il tient ; sinon, dans une case de plusieurs rangées, le
 * retour à la ligne (alignement { retour: true }) puis, s'il ne suffit pas, le début coupé (couperLeTexte) et sa `suite` ; dans une case d'une rangée,
 * la réduction au besoin (alignement { retour: false, reduire: true }) si le texte, sur une ligne, garde ECHELLE_MIN de sa taille, sinon la police à
 * ECHELLE_MIN de sa taille et le début coupé à cette taille (alignement { retour: false, reduire: true, echelle: ECHELLE_MIN }, même si ce début
 * tiendrait à la taille entière). `lu` : la part du texte que l'import relit (couperLeTexte). `suite` : null quand rien de relu n'est coupé.
 */
export function ajusterLeTexte(texte, zone, { lu = null } = {}) {
  const t = String(texte ?? '');
  if (tientDans(t, zone)) return { texte: t, alignement: null, suite: null };
  if (zone.lignes > 1) {
    const alignement = zone.retour ? null : { retour: true };
    const z = zone.retour ? zone : { ...zone, retour: true };
    const coupe = tientDans(t, z) ? null : couperLeTexte(t, z, { lu });
    return coupe ? { texte: coupe.debut, alignement, suite: coupe.suite } : { texte: t, alignement, suite: null };
  }
  const reduire = { retour: false, reduire: true };
  const reduite = { ...zone, largeur: zone.largeur / ECHELLE_MIN, retour: false, reduire: false };
  if (tientDans(t, reduite)) return { texte: t, alignement: reduire, suite: null };
  const coupe = couperLeTexte(t, reduite, { lu });
  if (!coupe) return { texte: t, alignement: null, suite: null };
  return { texte: coupe.debut, alignement: { ...reduire, echelle: ECHELLE_MIN }, suite: coupe.suite };
}
