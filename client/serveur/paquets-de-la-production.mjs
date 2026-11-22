// Le dossier partagé `paquets/` entre le site de dev et la production (lot 11 « Bascule 2 », PR 5a ; docs/chantier-base-de-dev.md, §9 garde-fous 17 et 20 ; docs/serveur.md,
// « Bascule 2 : préparation », « PR 5a »). Sur le modèle de `maintenance/` (serveur/maintenance.mjs) : un dossier de l'hôte monté dans les deux services (MAVERICK_PAQUETS,
// deploy/installateur/docker-compose.yml), celui de la production pour le site de dev. Éteint par défaut : rien n'y est écrit sans le marqueur db/bascule-2 (serveur/base-source.mjs).
//
// Deux sens, qui ne se mêlent pas :
//   - le site de dev DÉPOSE le paquet de la mise à jour (`<X.Y>-<lot>.db`, une copie du fichier de db/mise-a-jour/) quand il le fige, et le dernier paquet LIVRÉ après le report d'une
//     livraison (de quoi rejouer un correctif urgent) ; les trois plus récents sont gardés ;
//   - la production (root, deploy/installateur/activer.sh) LIT ce dossier sans jamais lui faire confiance : un fichier de ce dossier est de la matière donnée par le site de dev (un
//     service que n'importe quel visiteur du site de dev atteint). Elle n'en croit que l'empreinte que le kit annonce (kit.json#paquet.empreinte, venue de GitHub) : root ne fait que
//     des `stat` (fichier régulier, pas un lien, taille plafonnée), et c'est un conteneur sans privilège qui copie le fichier et calcule l'empreinte. Ici, seulement l'écriture du
//     dépôt, et la LECTURE du rapport que root y laisse (`activation.json`, validé champ par champ comme `servi` de l'atelier : liste blanche, jamais un champ inconnu).
// Node seulement (node:…), sans dépendance.
import { closeSync, constants, copyFileSync, existsSync, fstatSync, lstatSync, openSync, readSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Le rapport de l'activation, que root écrit à côté des paquets. */
export const FICHIER_ACTIVATION = 'activation.json';
export const FORMAT_ACTIVATION = 'maverick-activation/1';
/** Un rapport plus gros est refusé sans être lu (root en écrit moins de 2 Kio). */
export const PLAFOND_DU_RAPPORT = 16384;
/** Un paquet de plus d'octets n'est pas déposé : le plafond de l'atelier (un extrait pèse ~31 Mo). */
export const PLAFOND_DU_PAQUET = 536_870_912;
/** Combien de paquets déposés sont gardés (les plus récents). */
export const PAQUETS_DEPOSES_GARDES = 3;
/** L'activation d'avant 2 heures, encore « en cours », est périmée (root n'a pas fini : il a été interrompu). */
export const DUREE_MAX_EN_COURS_MS = 2 * 3_600_000;

const NOM_DU_PAQUET = /^(\d+\.\d+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.db$/;
const VERSION = /^\d+\.\d+$/;
const LOT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Les états du rapport. `refusee` : rien n'a changé ; `retour_automatique` : la bascule a échoué et le site précédent est remis ; `retour_incomplet` : il faut intervenir. */
export const ETATS_DE_L_ACTIVATION = Object.freeze(['en_cours', 'passee', 'refusee', 'retour_automatique', 'retour_incomplet']);
/** Les raisons qu'un rapport peut porter (activer.sh n'écrit que ces mots ; un test le vérifie). Les cinq premières sont celles de serveur/activation.mjs. */
export const RAISONS_DE_L_ACTIVATION = Object.freeze([
  'kit_sans_paquet', 'empreinte', 'structure', 'note_manquante', 'version_en_arriere',
  'paquet_absent', 'paquet_irregulier', 'paquet_trop_gros', 'correctif_sans_paquet', 'contenu', 'fiches', 'controles',
  'memoire', 'disque', 'verrou', 'fabrication', 'bascule', 'sante', 'interrompue',
]);
export const MODES_DE_L_ACTIVATION = Object.freeze(['paquet', 'correctif']);

/** Le nom du paquet déposé pour la version `X.Y` et le lot (null si l'un des deux n'a pas la forme attendue). */
export const nomDuPaquetDepose = (version, lot) => (VERSION.test(String(version)) && LOT.test(String(lot)) ? `${version}-${lot}.db` : null);

const dossierOrdinaire = (chemin) => {
  try {
    const s = lstatSync(chemin);
    return s.isDirectory() && !s.isSymbolicLink();
  } catch {
    return false;
  }
};

/** Les numéros d'une version « X.Y » : le plus récent d'abord. */
const plusRecent = (a, b) => {
  const [x, y] = [a.version.split('.').map(Number), b.version.split('.').map(Number)];
  for (let i = 0; i < 2; i += 1) if (x[i] !== y[i]) return y[i] - x[i];
  return a.nom < b.nom ? 1 : -1;
};

/** Les paquets déposés dans `dossier` (nom, version, lot), du plus récent au plus ancien. Jamais un lien : un lien posé là n'est pas un paquet. */
export function paquetsDeposes(dossier) {
  if (!dossierOrdinaire(dossier)) return [];
  return readdirSync(dossier).map((nom) => ({ nom, m: NOM_DU_PAQUET.exec(nom) })).filter((x) => x.m).map((x) => ({ nom: x.nom, version: x.m[1], lot: x.m[2] })).sort(plusRecent);
}

/**
 * Dépose le paquet `source` dans le dossier partagé `dossier` sous `<version>-<lot>.db` : une copie écrite à côté puis renommée (la production ne voit jamais un fichier à moitié
 * écrit), sans écraser un fichier qui y est déjà avec la même taille, les plus anciens au-delà de PAQUETS_DEPOSES_GARDES retirés. Ne lève jamais : rend { depose, nom, raison }.
 * `raison` quand rien n'est déposé : `dossier_absent` (le dossier partagé n'existe pas : il est créé par root, jamais par le service), `source_illisible`, `trop_gros`, `nom_invalide`,
 * `deja` (déjà là), `echec`.
 * @param {{ dossier: string | null, source: string, version: string, lot: string, journal?: (m: string) => void }} o
 */
export function deposerLePaquet({ dossier, source, version, lot, journal = () => {} }) {
  const nom = nomDuPaquetDepose(version, lot);
  if (!dossier) return { depose: false, nom, raison: 'dossier_absent' };
  if (!nom) return { depose: false, nom, raison: 'nom_invalide' };
  if (!dossierOrdinaire(dossier)) {
    journal(`mise à jour : le dossier partagé des paquets (${dossier}) n’existe pas : le paquet n’est pas déposé pour la production (le créer : « sudo bash <instance>/bascule.sh poser-bascule-2 »)`);
    return { depose: false, nom, raison: 'dossier_absent' };
  }
  try {
    const s = lstatSync(source);
    if (!s.isFile() || s.isSymbolicLink()) return { depose: false, nom, raison: 'source_illisible' };
    if (s.size <= 0 || s.size > PLAFOND_DU_PAQUET) return { depose: false, nom, raison: 'trop_gros' };
    const cible = join(dossier, nom);
    try {
      const deja = lstatSync(cible);
      if (deja.isFile() && !deja.isSymbolicLink() && deja.size === s.size) return { depose: false, nom, raison: 'deja' };
    } catch {
      // pas encore déposé
    }
    const provisoire = join(dossier, `.${nom}.${process.pid}.provisoire`);
    try {
      copyFileSync(source, provisoire, constants.COPYFILE_EXCL);
      renameSync(provisoire, cible);
    } catch (e) {
      rmSync(provisoire, { force: true });
      throw e;
    }
    journal(`mise à jour : le paquet ${nom} est déposé pour la production (${s.size} octets)`);
    // les plus anciens : le déposé du jour est toujours gardé
    for (const ancien of paquetsDeposes(dossier).slice(PAQUETS_DEPOSES_GARDES)) {
      if (ancien.nom !== nom) rmSync(join(dossier, ancien.nom), { force: true });
    }
    return { depose: true, nom, raison: null };
  } catch (e) {
    journal(`ERREUR mise à jour : le paquet ${nom} n’a pas pu être déposé pour la production : ${e?.code ?? e?.message ?? e}`);
    return { depose: false, nom, raison: 'echec' };
  }
}

/**
 * Dépose le dernier paquet livré (le plus récent de `db/archives/paquets-livres/`, garde-fou 19) s'il n'est pas déjà dans le dossier partagé : c'est le paquet que le correctif urgent
 * recontrôle en place. Ne lève jamais ; rend le résultat de deposerLePaquet, ou null quand aucun paquet n'est gardé.
 * @param {{ dossier: string | null, livres: string, journal?: (m: string) => void }} o `livres` : db/archives/paquets-livres/
 */
export function deposerLeDernierPaquetLivre({ dossier, livres, journal = () => {} }) {
  if (!dossier || !existsSync(livres)) return null;
  try {
    const dernier = readdirSync(livres).map((nom) => ({ nom, m: NOM_DU_PAQUET.exec(nom) })).filter((x) => x.m).map((x) => ({ nom: x.nom, version: x.m[1], lot: x.m[2] })).sort(plusRecent)[0];
    if (!dernier) return null;
    return deposerLePaquet({ dossier, source: join(livres, dernier.nom), version: dernier.version, lot: dernier.lot, journal });
  } catch (e) {
    journal(`ERREUR mise à jour : le dernier paquet livré n’a pas pu être déposé pour la production : ${e?.message ?? e}`);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le rapport de l'activation, lu par le site de dev (la page Mise à jour, GET /api/mise-a-jour/ : `activation_production`)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const instantValide = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v) && !Number.isNaN(Date.parse(v));
const entier = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : null);
/** Un texte que root a écrit : des caractères imprimables seulement, `n` au plus (jamais un caractère de commande ni un guillemet de retour). */
const texte = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');

/**
 * Valide un rapport (objet déjà décodé) et n'en garde que les champs connus ; null s'il n'est pas du bon format. `instant` : pour dire qu'un « en cours » est périmé.
 * Rend { etat, le, version, depuis, lot, mode, raisons, pages, duree_s, gel_leve, phrase, geste, perime }.
 */
export function validerLActivation(rapport, { instant = new Date() } = {}) {
  if (!rapport || typeof rapport !== 'object' || Array.isArray(rapport) || rapport.format !== FORMAT_ACTIVATION) return null;
  if (!ETATS_DE_L_ACTIVATION.includes(rapport.etat) || !instantValide(rapport.le)) return null;
  const raisons = Array.isArray(rapport.raisons) ? [...new Set(rapport.raisons.filter((r) => RAISONS_DE_L_ACTIVATION.includes(r)))] : [];
  return {
    etat: rapport.etat,
    le: rapport.le,
    version: VERSION.test(String(rapport.version ?? '')) ? rapport.version : null,
    depuis: VERSION.test(String(rapport.depuis ?? '')) ? rapport.depuis : null,
    lot: LOT.test(String(rapport.lot ?? '')) ? rapport.lot : null,
    mode: MODES_DE_L_ACTIVATION.includes(rapport.mode) ? rapport.mode : 'paquet',
    raisons,
    pages: entier(rapport.pages),
    duree_s: entier(rapport.duree_s),
    gel_leve: rapport.gel_leve === true,
    phrase: texte(rapport.phrase, 400),
    geste: texte(rapport.geste, 240) || null,
    perime: rapport.etat === 'en_cours' && new Date(instant).getTime() - Date.parse(rapport.le) > DUREE_MAX_EN_COURS_MS,
  };
}

/**
 * Le dernier rapport d'activation de la production, lu dans le dossier partagé ; null (absent, trop gros, pas un fichier ordinaire, illisible, mal formé). Le fichier est ouvert
 * sans suivre de lien (`O_NOFOLLOW`), la taille est lue sur le descripteur : un lien ou un fichier géant posé là ne se lit pas.
 */
export function lireLActivation(dossier, { instant = new Date() } = {}) {
  if (!dossier) return null;
  let fd = null;
  try {
    if (constants.O_NOFOLLOW === undefined && lstatSync(join(dossier, FICHIER_ACTIVATION)).isSymbolicLink()) return null; // Windows n'a pas O_NOFOLLOW
    fd = openSync(join(dossier, FICHIER_ACTIVATION), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const s = fstatSync(fd);
    if (!s.isFile() || s.size <= 0 || s.size > PLAFOND_DU_RAPPORT) return null;
    const tampon = Buffer.alloc(s.size);
    let lus = 0;
    while (lus < s.size) {
      const n = readSync(fd, tampon, lus, s.size - lus, null);
      if (n === 0) break;
      lus += n;
    }
    return validerLActivation(JSON.parse(tampon.subarray(0, lus).toString('utf8')), { instant });
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}
