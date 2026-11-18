// `npm run db:extrait [-- --url <adresse>] [--dossier <dossier>]` (dans client/) : télécharge l'extrait du contenu du site de dev
// (docs/serveur.md, « Extrait du contenu » ; lot 5 du chantier de la base de dev, R274, R275 (3)) pour que les sessions de Claude lisent le vrai
// contenu du site — les modifications faites sur le site comprises — sans fiche, sans compte, sans journal.
//   - adresse : --url, sinon MAVERICK_EXTRAIT_URL, sinon https://dev.maverick-jdr.com ;
//   - clé de lecture (facultative : sans mot de passe posé sur le site de dev, elle est inutile) : la seule variable MAVERICK_EXTRAIT_CLE, jamais une option de la ligne de commande (la clé se retrouverait dans l'historique et la conversation) ; elle part dans
//     l'en-tête X-Maverick-Cle (le service ne voit jamais Authorization : Caddy le remplace, nginx le vide ; serveur/acces.mjs) ;
//   - délai de chaque demande, corps compris : MAVERICK_EXTRAIT_DELAI (secondes ; 300 par défaut) ; dépassé, une erreur qui le dit (la CI se replie) ;
//   - dossier : --dossier, sinon var/extrait/ (ignoré par git) ; y sont écrits maverick-dev.db (SQLite) et maverick-dev.json (le méta : date, version du site,
//     empreinte de chaque table).
// L'empreinte du fichier, puis celle de chaque table de contenu (serveur/empreintes.mjs : le calcul du service), sont vérifiées avant que le fichier ne
// prenne sa place (écriture atomique) ; un extrait déjà là et identique n'est pas retéléchargé. Elle affiche la date de l'extrait : chaque analyse la cite.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { empreintesDuContenu } from '../serveur/empreintes.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
export const ADRESSE_DU_SITE_DE_DEV = 'https://dev.maverick-jdr.com';
export const DOSSIER_PAR_DEFAUT = join(RACINE, 'var', 'extrait');
export const FICHIER = 'maverick-dev.db';
export const FICHIER_META = 'maverick-dev.json';

export class ErreurExtrait extends Error {}

const sha256 = (donnees) => createHash('sha256').update(donnees).digest('hex');

/** L'en-tête d'une clé de lecture du site de dev (serveur/acces.mjs#ENTETE_CLE) ; aucun sans clé. */
export function enteteDeLaCle(cle) {
  const valeur = String(cle ?? '').trim();
  return valeur ? { 'X-Maverick-Cle': valeur } : {};
}

/** Délai d'une demande au site de dev, corps compris (variable MAVERICK_EXTRAIT_DELAI, en secondes) : 300 s par défaut, de quoi lire 30 Mo sur un lien lent. */
export const DELAI_PAR_DEFAUT_S = 300;

/** Le délai en millisecondes : MAVERICK_EXTRAIT_DELAI (secondes, entier > 0), sinon DELAI_PAR_DEFAUT_S. Une valeur illisible est une erreur. */
export function delaiDeLaDemande(env = process.env) {
  const brut = String(env.MAVERICK_EXTRAIT_DELAI ?? '').trim();
  if (!brut) return DELAI_PAR_DEFAUT_S * 1000;
  if (!/^[1-9]\d*$/.test(brut)) throw new ErreurExtrait(`MAVERICK_EXTRAIT_DELAI : « ${brut} » n’est pas un nombre de secondes.`);
  return Number(brut) * 1000;
}

const estUnDelai = (e) => e?.name === 'TimeoutError' || e?.cause?.name === 'TimeoutError';

async function demander(fetch, adresse, entetes, delai) {
  let reponse;
  try {
    reponse = await fetch(adresse, { headers: entetes, redirect: 'follow', signal: AbortSignal.timeout(delai) });
  } catch (e) {
    if (estUnDelai(e)) throw new ErreurExtrait(`${adresse} : délai de ${delai / 1000} s dépassé (MAVERICK_EXTRAIT_DELAI).`);
    throw new ErreurExtrait(`${adresse} : ${e.cause?.message ?? e.message}`);
  }
  if (reponse.status === 401) throw new ErreurExtrait(`${adresse} : accès refusé (401) — une clé de lecture est demandée (variable MAVERICK_EXTRAIT_CLE).`);
  if (reponse.status === 403) throw new ErreurExtrait(`${adresse} : refusé (403) — l’extrait n’existe que sur le site de dev, et la clé de lecture doit être valable.`);
  if (reponse.status !== 200 && reponse.status !== 304) throw new ErreurExtrait(`${adresse} : réponse ${reponse.status}`);
  return reponse;
}

/** Les empreintes du fichier téléchargé, comparées à son méta : liste des écarts (vide : tout concorde). */
export function ecartsAvecLeMeta(chemin, meta) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    const lues = empreintesDuContenu(db);
    const ecarts = [];
    if (lues.global !== meta.empreinte) ecarts.push('empreinte globale');
    for (const t of new Set([...Object.keys(lues.tables), ...Object.keys(meta.tables ?? {})])) {
      if (lues.tables[t]?.empreinte !== meta.tables?.[t]?.empreinte) ecarts.push(t);
    }
    return ecarts;
  } finally {
    db.close();
  }
}

/**
 * Télécharge l'extrait dans `dossier`. Rend { meta, chemin, telecharge } : `telecharge` faux quand l'extrait déjà là est celui du site.
 * @param {{ url?: string, cle?: string|null, dossier?: string, fetch?: typeof fetch, delai?: number }} [o] `delai` : en millisecondes, par demande, corps compris
 */
export async function telechargerExtrait({ url = ADRESSE_DU_SITE_DE_DEV, cle = null, dossier = DOSSIER_PAR_DEFAUT, fetch = globalThis.fetch, delai = delaiDeLaDemande() } = {}) {
  const base = String(url).replace(/\/+$/, '');
  const entetes = { Accept: 'application/json', ...enteteDeLaCle(cle) };
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, FICHIER);
  const cheminMeta = join(dossier, FICHIER_META);
  // le corps se lit sous le même délai que la demande (le signal la suit jusqu'au bout) : un délai dépassé pendant la lecture dit la même chose
  const lireCorps = async (adresse, lire) => {
    try {
      return await lire();
    } catch (e) {
      if (estUnDelai(e)) throw new ErreurExtrait(`${adresse} : délai de ${delai / 1000} s dépassé pendant la lecture (MAVERICK_EXTRAIT_DELAI).`);
      throw e;
    }
  };
  const lireMeta = async () => {
    const adresse = `${base}/api/edition/extrait/meta/`;
    const reponse = await demander(fetch, adresse, entetes, delai);
    return lireCorps(adresse, () => reponse.json());
  };
  let meta = await lireMeta();
  // déjà là, et identique : rien à télécharger (l'empreinte du fichier est celle que le site annonce)
  try {
    if (existsSync(chemin) && JSON.parse(readFileSync(cheminMeta, 'utf8')).fichier?.sha256 === meta.fichier.sha256 && sha256(readFileSync(chemin)) === meta.fichier.sha256) {
      return { meta, chemin, telecharge: false };
    }
  } catch {
    // pas de méta local lisible : on télécharge
  }
  const provisoire = join(dossier, `.${FICHIER}.${process.pid}`);
  try {
    for (let essai = 0; ; essai += 1) {
      const reponse = await demander(fetch, `${base}/api/edition/extrait/`, { ...entetes, Accept: 'application/vnd.sqlite3' }, delai);
      const octets = Buffer.from(await lireCorps(`${base}/api/edition/extrait/`, () => reponse.arrayBuffer()));
      const empreinte = sha256(octets);
      if (empreinte === meta.fichier.sha256) {
        writeFileSync(provisoire, octets);
        break;
      }
      // le contenu du site a changé entre les deux demandes : on relit le méta (une fois)
      if (essai >= 1) throw new ErreurExtrait('L’extrait a changé pendant le téléchargement : relancer la commande.');
      meta = await lireMeta();
      if (empreinte === meta.fichier.sha256) {
        writeFileSync(provisoire, octets);
        break;
      }
    }
    const ecarts = ecartsAvecLeMeta(provisoire, meta);
    if (ecarts.length) throw new ErreurExtrait(`Extrait refusé : l’empreinte ne correspond pas à son méta (${ecarts.slice(0, 5).join(', ')}).`);
    renameSync(provisoire, chemin);
    const metaProvisoire = join(dossier, `.${FICHIER_META}.${process.pid}`);
    writeFileSync(metaProvisoire, `${JSON.stringify(meta, null, 2)}\n`);
    renameSync(metaProvisoire, cheminMeta);
  } finally {
    rmSync(provisoire, { force: true });
  }
  return { meta, chemin, telecharge: true };
}

/** Une option --cle donnée en ligne de commande est refusée : la clé de lecture ne passe que par la variable d'environnement. Rend le message, ou null. */
export function refusDeLaCleEnArgument(args) {
  return args.some((a) => a === '--cle' || a.startsWith('--cle=')) ? 'L’option --cle n’existe plus : la clé de lecture se donne par la variable d’environnement MAVERICK_EXTRAIT_CLE (jamais dans la ligne de commande).' : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const refus = refusDeLaCleEnArgument(args);
  if (refus) {
    console.error(refus);
    process.exit(1);
  }
  const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
  try {
    const { meta, chemin, telecharge } = await telechargerExtrait({
      url: option('--url') ?? process.env.MAVERICK_EXTRAIT_URL ?? ADRESSE_DU_SITE_DE_DEV,
      cle: process.env.MAVERICK_EXTRAIT_CLE ?? null,
      dossier: option('--dossier') ? resolve(option('--dossier')) : DOSSIER_PAR_DEFAUT,
    });
    console.log(`Extrait du ${meta.fabrique_le} (site ${meta.version_du_site ?? 'de version inconnue'}, schéma ${meta.schema}) : ${chemin}`);
    console.log(`${telecharge ? 'Téléchargé' : 'Déjà à jour'} : ${(meta.fichier.octets / 1048576).toFixed(1)} Mo, ${Object.keys(meta.tables).length} tables de contenu, ${meta.modifications_versees} modification(s) en attente versée(s) dans l’historique.`);
    console.log('À citer dans chaque analyse : la date de l’extrait ci-dessus. Aucune fiche, aucun compte, aucun journal n’y figure.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
