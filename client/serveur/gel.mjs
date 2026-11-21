// Le gel des écritures (garde-fou 16 de la bascule 2, lot 11 ; docs/serveur.md, « Bascule 2 : préparation », « Gel des écritures » ; plan :
// docs/chantier-base-de-dev.md, section 9, point 16). Un fichier `gel.json` dans le dossier de la base (db/), posé par root (deploy/installateur/gel.sh) sur
// l'instance voulue, gèle les écritures de /api/ : le même code sert les deux instances. ÉTEINT par défaut : sans fichier, rien ne change.
//
// Présent et non échu : toute requête d'écriture de /api/ répond 503 (api.mjs#traiter) avec jusqu'à quand, pourquoi et le geste qui lève le gel ; les lectures
// restent ouvertes. Il survit à une relance (c'est un fichier) et se lève seul : à l'échéance il est ignoré et noté une fois au journal (le fichier reste, il ne
// sert plus). Le fichier est relu quand sa signature (inode, taille, date de modification) change : un `stat` par appel, jamais une lecture inutile.
// Prudence : un fichier illisible ou mal formé tient le gel, mais au plus 2 h après sa date de modification ; une échéance trop lointaine est ramenée à 4 h
// après la date de modification (le script de root pose 240 minutes au plus) : un gel ne se tient jamais indéfiniment.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cheminSansFin } from './acces-routes.mjs';
import { instant } from './instant.mjs';

/** Le fichier de gel, dans le dossier de la base vivante. */
export const FICHIER_GEL = 'gel.json';
/** Le format que pose gel.sh. */
export const FORMAT_DU_GEL = 'maverick-gel/1';
/** Un gel illisible ou mal formé est tenu au plus ce temps après la date de modification du fichier. */
export const PLAFOND_ILLISIBLE_MS = 2 * 3600_000;
/** Une échéance plus lointaine que cela après la date de modification du fichier est ramenée là (gel.sh : 240 minutes au plus). */
export const PLAFOND_MAX_MS = 4 * 3600_000;
const TAILLE_MAX = 8 * 1024;
const MOTIF_MAX = 300;
const GESTE_MAX = 200;
const RETRY_AFTER_MAX_S = 300;

/**
 * Les écritures de /api/ que le gel laisse passer, chacune avec sa raison. Tout le reste de ce qui n'est pas une lecture est gelé (une route inconnue aussi :
 * fermée par défaut) : fiches, /api/v1/, édition, lots de changements, mise à jour (lancer, copier, libérer, brouillon, majeure, conflits).
 * @type {ReadonlyArray<{ methodes: string[], motif: RegExp, raison: string }>}
 */
export const ROUTES_EXEMPTEES = Object.freeze([
  { methodes: ['POST', 'DELETE'], motif: /^\/api\/acces$/, raison: 'ouvre et ferme une session (cookie) : n’écrit aucun contenu ni aucune fiche ; sans elle, le propriétaire ne pourrait pas se connecter pour voir le gel' },
  { methodes: ['POST'], motif: /^\/api\/classeur$/, raison: 'lit une feuille Google et renvoie ses octets : n’écrit rien dans la base' },
  { methodes: ['POST'], motif: /^\/api\/metriques\/page$/, raison: 'balise des pages vues : écrit dans la base des métriques, jamais dans la base vivante' },
  { methodes: ['POST'], motif: /^\/api\/edition\/(lignes|race|classe|bestiaire|portrait|evenement)$/, raison: 'lectures faites en POST (corps de liste) : le service d’édition ne les écrit pas' },
  { methodes: ['POST'], motif: /^\/api\/maintenance\/lever$/, raison: 'retire l’annonce de maintenance partagée : n’écrit aucun contenu, et une maintenance ne doit pas rester tenue par un gel' },
]);

const LECTURES = ['GET', 'HEAD', 'OPTIONS'];

/** Vrai quand la requête est une écriture que le gel arrête (pas une lecture, pas une route exemptée). */
export function ecritureGelee(methode, adresse) {
  const m = String(methode ?? '').toUpperCase();
  if (LECTURES.includes(m)) return false;
  const chemin = cheminSansFin(adresse);
  return !ROUTES_EXEMPTEES.some((e) => e.methodes.includes(m) && e.motif.test(chemin));
}

const dateValide = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && Number.isFinite(Date.parse(v));
const texte = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Le geste qui lève le gel quand le fichier ne le dit pas (illisible) : le dossier d'instance d'après le nom de l'instance. */
export const gesteParDefaut = (instance) => `sudo sh /srv/maverick-center${instance === 'dev' ? '-test' : ''}/gel.sh lever`;

/**
 * Lit le fichier de gel de `dossier` à l'instant `maintenantMs` (sans cache ; pour les tests et creerGel).
 * @returns {{ etat: 'absent' } | { etat: 'actif' | 'echu', gel: { pose_le: string|null, jusqu_a: string, motif: string, geste: string|null, illisible: boolean, plafonne: boolean }, fin_ms: number }}
 */
export function lireLeGel(dossier, { maintenantMs = Date.now() } = {}) {
  const chemin = join(dossier, FICHIER_GEL);
  let stat;
  try {
    stat = statSync(chemin);
  } catch {
    return { etat: 'absent' };
  }
  const illisible = (raison) => {
    const fin = stat.mtimeMs + PLAFOND_ILLISIBLE_MS;
    return { etat: maintenantMs < fin ? 'actif' : 'echu', fin_ms: fin, gel: { pose_le: null, jusqu_a: instant(new Date(fin)), motif: raison, geste: null, illisible: true, plafonne: true } };
  };
  if (!stat.isFile()) return illisible('le fichier de gel n’est pas un fichier');
  if (stat.size > TAILLE_MAX) return illisible('le fichier de gel est trop gros');
  let v;
  try {
    v = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch {
    return illisible('le fichier de gel est illisible');
  }
  if (!v || typeof v !== 'object' || Array.isArray(v) || !dateValide(v.jusqu_a)) return illisible('le fichier de gel est mal formé (échéance absente ou invalide)');
  const demande = Date.parse(v.jusqu_a);
  const plafond = stat.mtimeMs + PLAFOND_MAX_MS;
  const fin = Math.min(demande, plafond);
  return {
    etat: maintenantMs < fin ? 'actif' : 'echu',
    fin_ms: fin,
    gel: {
      pose_le: dateValide(v.pose_le) ? v.pose_le : null,
      jusqu_a: instant(new Date(fin)),
      motif: texte(v.motif, MOTIF_MAX) || 'écritures gelées',
      geste: texte(v.geste, GESTE_MAX) || null,
      illisible: false,
      plafonne: demande > plafond,
    },
  };
}

/** Le texte du refus (503) : jusqu'à quand, pourquoi, le geste qui lève le gel. */
export function messageDuGel(gel, { maintenantMs = Date.now(), instance = 'dev', sansGeste = false } = {}) {
  const geste = gel.geste ?? gesteParDefaut(instance);
  const levee = (debut) => (sansGeste ? '' : ` ${debut} : ${geste}`);
  const minutes = Math.max(1, Math.ceil((Date.parse(gel.jusqu_a) - maintenantMs) / 60_000));
  const duree = minutes >= 120 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
  if (gel.illisible) {
    return `Les écritures sont gelées par prudence (${gel.motif}) : le gel se lève seul au plus tard à ${gel.jusqu_a}, soit 2 h après la date de modification du fichier (encore ${duree}).${levee('Pour le lever tout de suite')}`;
  }
  return `Les écritures sont gelées jusqu’à ${gel.jusqu_a} (encore ${duree}) : ${gel.motif}.${levee('Pour lever le gel tout de suite')}`;
}

/**
 * Le gel d'une instance : `etat()` rend le gel en vigueur (ou null), `verifier()` fait la même lecture pour que l'échéance et la pose soient notées au
 * journal sans attendre une requête (appelé par la minuterie du service). Chaque changement est noté une fois : posé, échu, levé.
 * @param {{ dossier: string, instance?: string, journal?: (m: string, o?: object) => void, evenement?: Function, horloge?: () => number }} o
 */
export function creerGel({ dossier, instance = 'dev', journal = () => {}, evenement = () => {}, horloge = Date.now }) {
  let signature = null; // inode:taille:mtime du fichier lu
  let lu = { etat: 'absent' };
  let note = null; // ce qui a déjà été dit au journal : 'actif:<signature>', 'echu:<signature>', null (rien / levé)
  const noter = (cle, message, action) => {
    if (note === cle) return;
    note = cle;
    journal(message, { categorie: 'gel' });
    evenement('gel', { detail: { action } });
  };

  function etat() {
    const maintenantMs = horloge();
    let s = null;
    try {
      const st = statSync(join(dossier, FICHIER_GEL));
      s = `${st.ino}:${st.size}:${st.mtimeMs}`;
    } catch {
      s = null;
    }
    if (s === null) {
      if (note?.startsWith('actif:')) noter(null, 'gel : le fichier de gel a été retiré, écritures rouvertes', 'leve');
      note = null;
      signature = null;
      lu = { etat: 'absent' };
      return null;
    }
    // le fichier est relu quand sa signature change ; l'échéance, elle, se compare à l'horloge à chaque appel
    if (s !== signature) {
      signature = s;
      lu = lireLeGel(dossier, { maintenantMs });
    }
    if (lu.etat === 'absent') return null;
    const actif = maintenantMs < lu.fin_ms;
    if (!actif) {
      noter(`echu:${s}`, `gel : échu (jusqu’à ${lu.gel.jusqu_a}), écritures rouvertes ; le fichier ${FICHIER_GEL} n’est plus lu comme un gel`, 'echu');
      return null;
    }
    noter(`actif:${s}`, `gel : écritures gelées jusqu’à ${lu.gel.jusqu_a} (${lu.gel.motif})${lu.gel.plafonne && !lu.gel.illisible ? ' ; échéance ramenée au plafond de 4 h' : ''}`, 'pose');
    return lu.gel;
  }

  /** La réponse 503 d'une écriture gelée, ou null. */
  function refus(methode, adresse, { sansGeste = false } = {}) {
    if (!ecritureGelee(methode, adresse)) return null;
    const gel = etat();
    if (!gel) return null;
    const maintenantMs = horloge();
    const restant = Math.max(1, Math.ceil((Date.parse(gel.jusqu_a) - maintenantMs) / 1000));
    // `sansGeste` : ni la production ni un visiteur sans droit de lecture ne reçoivent le chemin de l'hôte (échéance et motif restent dits)
    return { statut: 503, corps: { erreur: messageDuGel(gel, { maintenantMs, instance, sansGeste }), gel: sansGeste ? { ...gel, geste: null } : gel }, entetes: { 'Retry-After': String(Math.min(restant, RETRY_AFTER_MAX_S)) }, gel: true };
  }

  return { etat, verifier: () => { etat(); }, refus };
}
