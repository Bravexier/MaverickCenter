// Markdown que le site de dev écrit dans les règles (texte des pages du guide ; corps des pages refaits depuis leurs tables) : ni HTML brut, ni adresse de
// lien à schéma exécutable. Le processeur Markdown du site (@astrojs/markdown-remark) recopie le HTML brut tel quel dans la page construite et garde
// l'adresse d'un lien telle qu'elle est écrite : sans ce contrôle, une page modifiée depuis le site de dev (POST /api/edition/, ouvert à tous avant la
// connexion Discord) livrerait un script en production par « Effectuer la mise à jour ».
// L'éditeur visuel (lib/markdown-edition.mjs) n'en produit pas : il échappe « < » devant une lettre (« \< ») et n'écrit que des <br>, des liens
// automatiques <https://…> et les marqueurs <!-- guide:… --> seuls sur leur ligne (lib/guide.mjs). Un fragment déjà présent avant la modification
// (texte importé, comme `<catégorie>` dans un bout de code du guide) reste permis : seuls les fragments AJOUTÉS sont refusés (fragmentsAjoutes).
// Contrôlé par le service (serveur/edition.mjs) et par scripts/mise-a-jour-regles.mjs (lot reçu, puis corps des pages après le rejeu).
// Pur, sans dépendance : partagé par le service et le workflow de mise à jour.

/** Schémas d'adresse permis dans un lien ou une image ; une adresse sans schéma (relative, #ancre, //hôte) l'est toujours. */
const SCHEMAS_SURS = ['http', 'https', 'mailto'];

const BR = /^<br\s*\/?>$/i;
const LIEN_AUTOMATIQUE = /^<(?:https?|mailto):[^\s<>]*>$/i;
const MARQUEUR_DU_GUIDE = /^<!--\s*guide:[a-z-]+\s*-->$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Le texte hors blocs de code délimités (``` ou ~~~ : leur contenu s'affiche tel quel), lignes du code vidées. */
function horsDuCode(markdown) {
  let fence = null;
  return String(markdown ?? '')
    .split('\n')
    .map((ligne) => {
      const m = FENCE.exec(ligne);
      if (fence) {
        if (m && m[1][0] === fence[0] && m[1].length >= fence.length && ligne.trim() === m[1].trim()) fence = null;
        return '';
      }
      if (m && !(m[1][0] === '`' && ligne.slice(ligne.indexOf(m[1]) + m[1].length).includes('`'))) {
        fence = m[1];
        return '';
      }
      return ligne;
    })
    .join('\n');
}

/** Le caractère en position i est-il échappé (nombre impair de « \ » juste avant) ? */
function echappe(texte, i) {
  let n = 0;
  for (let j = i - 1; j >= 0 && texte[j] === '\\'; j--) n++;
  return n % 2 === 1;
}

/**
 * L'adresse d'un lien ou d'une image peut-elle exécuter quelque chose (javascript:, data:, vbscript:…) ? Une entité dans le schéma (« javascript&colon; »,
 * que Markdown décode) est refusée d'office, comme un caractère de contrôle ou une espace qui le couperait.
 */
export function adresseDangereuse(adresse) {
  const brute = String(adresse ?? '').replace(/\\(.)/g, '$1');
  const schema = brute.split(/[/?#]/)[0];
  if (schema.includes('&')) return true;
  const net = schema.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  const m = /^([a-z][a-z0-9+.-]*):/.exec(net);
  return m ? !SCHEMAS_SURS.includes(m[1]) : false;
}

/** L'adresse d'un lien qui commence en position i (après « ]( » et ses blancs) : <entre chevrons> ou jusqu'au blanc ou à la « ) » qui ferme. */
function adresseEn(texte, i) {
  if (texte[i] === '<') {
    const fin = texte.indexOf('>', i);
    return texte.slice(i + 1, fin < 0 ? undefined : fin);
  }
  let profondeur = 0;
  let j = i;
  for (; j < texte.length; j++) {
    const c = texte[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (/\s/.test(c)) break;
    if (c === '(') profondeur++;
    else if (c === ')') {
      if (profondeur === 0) break;
      profondeur--;
    }
  }
  return texte.slice(i, j);
}

/**
 * Les fragments refusés d'un Markdown, dans l'ordre : balises et commentaires HTML bruts (hors <br>, liens automatiques http(s)/mailto et marqueurs
 * <!-- guide:… --> seuls sur leur ligne) et adresses de lien dangereuses (« lien : <adresse> »). Les blocs de code délimités sont ignorés ; un « < »
 * échappé (« \< ») n'est pas une balise.
 */
export function fragmentsDangereux(markdown) {
  const texte = horsDuCode(markdown);
  const sortie = [];
  for (let i = texte.indexOf('<'); i >= 0; i = texte.indexOf('<', i + 1)) {
    const suivant = texte[i + 1];
    if (!suivant || !/[A-Za-z/!?]/.test(suivant) || echappe(texte, i)) continue;
    if (texte.startsWith('<!--', i)) {
      const fin = texte.indexOf('-->', i + 4);
      const commentaire = texte.slice(i, fin < 0 ? undefined : fin + 3);
      const debutDeLigne = texte.lastIndexOf('\n', i - 1) + 1;
      const finDeLigne = texte.indexOf('\n', i);
      const ligne = texte.slice(debutDeLigne, finDeLigne < 0 ? undefined : finDeLigne).trim();
      if (!(MARQUEUR_DU_GUIDE.test(commentaire) && ligne === commentaire)) sortie.push(commentaire);
      if (fin < 0) break;
      i = fin + 2;
      continue;
    }
    const fin = texte.indexOf('>', i);
    const balise = texte.slice(i, fin < 0 ? undefined : fin + 1);
    if (BR.test(balise)) continue;
    if (LIEN_AUTOMATIQUE.test(balise)) continue;
    sortie.push(balise.length > 200 ? `${balise.slice(0, 200)}…` : balise);
  }
  for (const m of texte.matchAll(/\]\([ \t]*\n?[ \t]*/g)) {
    if (echappe(texte, m.index)) continue;
    const adresse = adresseEn(texte, m.index + m[0].length);
    if (adresseDangereuse(adresse)) sortie.push(`lien : ${adresse}`);
  }
  // définitions de référence : « [nom]: adresse »
  for (const m of texte.matchAll(/^ {0,3}\[(?:[^\]\\\n]|\\.)+\]:[ \t]*\n?[ \t]*(<[^>\n]*>|\S+)/gm)) {
    const adresse = m[1].startsWith('<') ? m[1].slice(1, -1) : m[1];
    if (adresseDangereuse(adresse)) sortie.push(`lien : ${adresse}`);
  }
  return sortie;
}

/** Les fragments refusés de `apres` qui n'étaient pas déjà dans `avant` (autant de fois) : ce qu'une modification AJOUTE. */
export function fragmentsAjoutes(avant, apres) {
  const deja = new Map();
  for (const f of fragmentsDangereux(avant ?? '')) deja.set(f, (deja.get(f) ?? 0) + 1);
  const ajoutes = [];
  for (const f of fragmentsDangereux(apres ?? '')) {
    const n = deja.get(f) ?? 0;
    if (n > 0) deja.set(f, n - 1);
    else ajoutes.push(f);
  }
  return ajoutes;
}

/** Le message d'un refus, en français (fragments cités, au plus trois). */
export function messageDeRefus(fragments) {
  const cites = fragments.slice(0, 3).map((f) => `« ${f} »`).join(', ');
  return `HTML brut ou lien non sûr refusé (${cites}${fragments.length > 3 ? '…' : ''}) : écrire « \\< » pour un chevron, et un lien en http(s) ou mailto`;
}
