// Analyseur et écrivain XML minimal, sans dépendance : les parties XML du .xlsx et du .ods de la fiche de personnage en tableur (demande du
// propriétaire, 2026-10-15). DOMParser n'existe pas dans Node 22 et src/lib doit rester testable sous Node : d'où cet analyseur.
// Module de format, sans rapport avec le jeu ; réservé à src/scripts/fiche.mjs (et aux modules du tableur, aux tests) : un module importé par deux
// scripts de page casse la version portable (CLAUDE.md, « Pièges connus »).
//
// Un élément est `{ nom, attrs, enfants }` : nom avec son préfixe tel qu'écrit (« x:c », « table:table-cell »), attributs dans l'ordre du
// document, enfants = éléments et textes (deux textes ne se suivent jamais : ils sont réunis). Les espaces ne sont jamais retirés (xml:space) :
// c'est au lecteur de ne prendre que le texte qui l'intéresse.
// Décisions (relevées sur les fichiers d'Excel, de LibreOffice et de Google Sheets, voir lib/tableur-lecture.mjs) :
//   - déclaration, commentaires et instructions de traitement ignorés ; CDATA rendu en texte ; `<!DOCTYPE` refusé (jamais dans OOXML ni ODF,
//     et porte des entités qui s'emboîtent : « milliard de rires ») ;
//   - les 5 entités prédéfinies, `&#N;` et `&#xH;` décodées en une passe (« &amp;lt; » donne « &lt; ») ; toute autre entité, un « & » isolé ou
//     une référence de caractère hors d'Unicode est une erreur ;
//   - fins de ligne `\r\n` et `\r` → `\n` avant tout (un `&#13;` reste un retour chariot) ; dans un attribut, tabulation et saut de ligne
//     LITTÉRAUX deviennent une espace avant le décodage (un `&#10;` reste un saut de ligne) ; `>` permis dans une valeur ; guillemets simples
//     ou doubles ;
//   - écriture : texte et attributs échappés de sorte que la relecture redonne le même arbre (un retour chariot s'écrit `&#13;`, même dans un
//     texte), caractères interdits en XML 1.0 retirés.

const PREDEFINIES = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" });
const RE_REFERENCE = /&(?:#([0-9]+)|#x([0-9a-fA-F]+)|([A-Za-z_:][\w.:-]*))?(;?)/g;
const RE_NOM = /[^\s<>/="'&]+/y;
const RE_NOM_ENTIER = /^[^\s<>/="'&!?]+$/;
const MAX_PROFONDEUR = 1000;
const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const ligneDe = (xml, position) => {
  let n = 1;
  for (let i = xml.indexOf('\n'); i >= 0 && i < position; i = xml.indexOf('\n', i + 1)) n++;
  return n;
};

/** Décode les références d'un texte ou d'une valeur d'attribut, en une passe. */
function decoder(brut, erreur, position) {
  if (!brut.includes('&')) return brut;
  return brut.replace(RE_REFERENCE, (m, decimal, hexa, nom, pointVirgule) => {
    if (!pointVirgule || (decimal === undefined && hexa === undefined && nom === undefined)) {
      throw erreur(`« & » qui n’ouvre aucune entité (« ${m}… » : écrire « &amp; »)`, position);
    }
    if (nom !== undefined) {
      if (Object.hasOwn(PREDEFINIES, nom)) return PREDEFINIES[nom];
      throw erreur(`entité inconnue « ${m} »`, position);
    }
    const code = decimal !== undefined ? parseInt(decimal, 10) : parseInt(hexa, 16);
    if (!(code >= 1 && code <= 0x10ffff) || (code >= 0xd800 && code <= 0xdfff)) throw erreur(`référence de caractère invalide « ${m} »`, position);
    return String.fromCodePoint(code);
  });
}

/** Pose un attribut, y compris un nom comme « __proto__ » qu'une simple affectation perdrait. */
function poser(attrs, nom, valeur) {
  if (nom === '__proto__') Object.defineProperty(attrs, nom, { value: valeur, enumerable: true, writable: true, configurable: true });
  else attrs[nom] = valeur;
}

/**
 * Analyse un document XML et rend son élément racine `{ nom, attrs, enfants }` (voir l'en-tête). Error « XML illisible : … (ligne N). » sur un
 * document mal formé ou refusé.
 * @param {string} texte
 */
export function analyserXml(texte) {
  let xml = String(texte ?? '');
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1); // BOM
  if (xml.includes('\r')) xml = xml.replace(/\r\n?/g, '\n');
  const n = xml.length;
  const erreur = (raison, position) => new Error(`XML illisible : ${raison} (ligne ${ligneDe(xml, position)}).`);
  const pile = [];
  let racine = null;

  const ajouter = (t) => {
    if (t === '') return;
    const enfants = pile[pile.length - 1].enfants;
    const dernier = enfants.length - 1;
    if (dernier >= 0 && typeof enfants[dernier] === 'string') enfants[dernier] += t;
    else enfants.push(t);
  };
  const sauterEspaces = (p) => {
    while (p < n) {
      const c = xml.charCodeAt(p);
      if (c !== 0x20 && c !== 0x09 && c !== 0x0a) break;
      p++;
    }
    return p;
  };
  const fermer = (debut, marque, quoi) => {
    const f = xml.indexOf(marque, debut);
    if (f < 0) throw erreur(`${quoi} non fermé`, debut);
    return f;
  };

  let i = 0;
  while (i < n) {
    const lt = xml.indexOf('<', i);
    const finTexte = lt < 0 ? n : lt;
    if (finTexte > i) {
      const brut = xml.slice(i, finTexte);
      if (pile.length) ajouter(decoder(brut, erreur, i));
      else if (/[^ \t\n]/.test(brut)) throw erreur('texte hors de l’élément racine', i);
    }
    if (lt < 0) break;

    if (xml.startsWith('<!--', lt)) {
      i = fermer(lt + 4, '-->', 'commentaire') + 3;
    } else if (xml.startsWith('<?', lt)) {
      i = fermer(lt + 2, '?>', 'instruction de traitement') + 2;
    } else if (xml.startsWith('<![CDATA[', lt)) {
      const f = fermer(lt + 9, ']]>', 'CDATA');
      if (!pile.length) throw erreur('CDATA hors de l’élément racine', lt);
      ajouter(xml.slice(lt + 9, f));
      i = f + 3;
    } else if (xml.startsWith('<!', lt)) {
      if (xml.startsWith('<!DOCTYPE', lt)) throw erreur('DOCTYPE refusé (entités déclarées non prises en charge)', lt);
      throw erreur(`déclaration « ${xml.slice(lt, lt + 10)}… » refusée`, lt);
    } else if (xml[lt + 1] === '/') {
      RE_NOM.lastIndex = lt + 2;
      const m = RE_NOM.exec(xml);
      if (!m) throw erreur('balise fermante sans nom', lt);
      const q = sauterEspaces(RE_NOM.lastIndex);
      if (xml[q] !== '>') throw erreur(`balise fermante </${m[0]}> mal formée`, lt);
      const ouvert = pile.pop();
      if (!ouvert) throw erreur(`balise fermante </${m[0]}> sans ouverture`, lt);
      if (ouvert.nom !== m[0]) throw erreur(`</${m[0]}> ferme <${ouvert.nom}>`, lt);
      i = q + 1;
    } else {
      RE_NOM.lastIndex = lt + 1;
      const m = RE_NOM.exec(xml);
      if (!m) throw erreur('balise sans nom', lt);
      const element = { nom: m[0], attrs: {}, enfants: [] };
      let p = RE_NOM.lastIndex;
      let autoFermee = false;
      for (;;) {
        const q = sauterEspaces(p);
        if (q >= n) throw erreur(`balise <${element.nom}> non fermée`, lt);
        if (xml[q] === '>') {
          p = q + 1;
          break;
        }
        if (xml[q] === '/') {
          if (xml[q + 1] !== '>') throw erreur(`« / » inattendu dans <${element.nom}>`, q);
          autoFermee = true;
          p = q + 2;
          break;
        }
        if (q === p) throw erreur(`caractère inattendu « ${xml[q]} » dans <${element.nom}>`, q);
        RE_NOM.lastIndex = q;
        const a = RE_NOM.exec(xml);
        if (!a) throw erreur(`attribut mal formé dans <${element.nom}>`, q);
        let r = sauterEspaces(RE_NOM.lastIndex);
        if (xml[r] !== '=') throw erreur(`« = » attendu après l’attribut ${a[0]}`, r);
        r = sauterEspaces(r + 1);
        const guillemet = xml[r];
        if (guillemet !== '"' && guillemet !== "'") throw erreur(`valeur de l’attribut ${a[0]} sans guillemets`, r);
        const f = xml.indexOf(guillemet, r + 1);
        if (f < 0) throw erreur(`valeur de l’attribut ${a[0]} non fermée`, r);
        if (Object.hasOwn(element.attrs, a[0])) throw erreur(`attribut ${a[0]} en double dans <${element.nom}>`, q);
        poser(element.attrs, a[0], decoder(xml.slice(r + 1, f).replace(/[\t\n]/g, ' '), erreur, r));
        p = f + 1;
      }
      if (pile.length) pile[pile.length - 1].enfants.push(element);
      else if (racine) throw erreur(`second élément racine <${element.nom}>`, lt);
      else racine = element;
      if (!autoFermee) {
        if (pile.length >= MAX_PROFONDEUR) throw erreur('éléments imbriqués trop profondément', lt);
        pile.push(element);
      }
      i = p;
    }
  }
  if (pile.length) throw erreur(`balise <${pile[pile.length - 1].nom}> non fermée`, n);
  if (!racine) throw erreur('aucun élément', n);
  return racine;
}

// ---------- écriture ----------
// Interdits en XML 1.0 : U+0000-U+0008, U+000B, U+000C, U+000E-U+001F, U+FFFE, U+FFFF et les moitiés de paire de substitution isolées.
const RE_INTERDITS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const DANS_UN_TEXTE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\r': '&#13;' };
const DANS_UN_ATTRIBUT = { '&': '&amp;', '<': '&lt;', '"': '&quot;', '\n': '&#10;', '\r': '&#13;', '\t': '&#9;' };
const echapperTexte = (t) => t.replace(RE_INTERDITS, '').replace(/[&<>\r]/g, (c) => DANS_UN_TEXTE[c]);
const echapperAttribut = (t) => t.replace(RE_INTERDITS, '').replace(/[&<"\n\r\t]/g, (c) => DANS_UN_ATTRIBUT[c]);

function ecrire(element, morceaux) {
  if (!element || typeof element !== 'object' || typeof element.nom !== 'string' || !RE_NOM_ENTIER.test(element.nom)) {
    throw new Error(`XML impossible à écrire : élément au nom invalide (« ${element?.nom ?? element} »).`);
  }
  let tete = `<${element.nom}`;
  for (const [nom, valeur] of Object.entries(element.attrs ?? {})) {
    if (valeur === null || valeur === undefined) continue; // attribut retiré
    if (!RE_NOM_ENTIER.test(nom)) throw new Error(`XML impossible à écrire : attribut au nom invalide (« ${nom} » dans <${element.nom}>).`);
    tete += ` ${nom}="${echapperAttribut(String(valeur))}"`;
  }
  const enfants = (element.enfants ?? []).filter((e) => e !== '');
  if (!enfants.length) {
    morceaux.push(`${tete}/>`);
    return;
  }
  morceaux.push(`${tete}>`);
  for (const e of enfants) {
    if (typeof e === 'string' || typeof e === 'number') morceaux.push(echapperTexte(String(e)));
    else ecrire(e, morceaux);
  }
  morceaux.push(`</${element.nom}>`);
}

/**
 * Écrit un élément (et ses descendants) en XML ; relu par analyserXml, le texte redonne le même arbre (aux caractères interdits près, retirés).
 * Un attribut null ou undefined n'est pas écrit ; un enfant nombre est écrit en texte.
 * @param {{ nom: string, attrs?: object, enfants?: Array<object | string | number> }} element
 * @param {{ declaration?: boolean }} [options] `declaration` : commencer par `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` et un saut de ligne
 */
export function serialiserXml(element, { declaration = true } = {}) {
  const morceaux = declaration ? [DECLARATION] : [];
  ecrire(element, morceaux);
  return morceaux.join('');
}

// ---------- outils de lecture ----------
/** Nom sans préfixe : « x:c » → « c », « r:id » → « id », « c » → « c ». */
export function nomLocal(nom) {
  const s = String(nom ?? '');
  return s.slice(s.indexOf(':') + 1);
}

const estElement = (e) => e !== null && typeof e === 'object';

/** Enfants directs de `el` (éléments) de nom local `local`, tous si `local` est omis. */
export function enfantsNommes(el, local) {
  const r = [];
  for (const e of el?.enfants ?? []) if (estElement(e) && (local === undefined || nomLocal(e.nom) === local)) r.push(e);
  return r;
}

/** Premier enfant direct de `el` de nom local `local`, ou null. */
export function enfantNomme(el, local) {
  for (const e of el?.enfants ?? []) if (estElement(e) && nomLocal(e.nom) === local) return e;
  return null;
}

/** Textes de `el` et de tous ses descendants, bout à bout dans l'ordre du document ('' pour null). */
export function texteDe(el) {
  if (typeof el === 'string') return el;
  if (!estElement(el)) return '';
  let s = '';
  for (const e of el.enfants ?? []) s += texteDe(e);
  return s;
}
