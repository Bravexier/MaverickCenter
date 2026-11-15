// L'essai d'une livraison avant son installation (lot 7 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/serveur.md,
// « Changement de structure appliqué sur place », « Essai avant installation »). Avant de remplacer le site, l'installateur (deploy/installateur/installateur.sh)
// dépose une DEMANDE dans le dossier db/essai-de-structure/ de l'instance : le service en place l'essaie sur une COPIE de sa base vivante avec les migrations et
// le schema.sql de la LIVRAISON (pas les siens), puis répond. Un seul programme touche la base : le service, jamais l'installateur à côté de lui.
//
//   db/essai-de-structure/demande-<version>-<pid>/        posée par l'installateur d'un coup (dossier provisoire .depot-<pid>, puis renommé) :
//       demande.json      { format: 'maverick-essai-demande/1', version, tag, deposee_le }
//       migrations/*.sql  les migrations livrées ; schema.sql : le schema.sql de la livraison
//     écrits par le service, chacun d'un coup (fichier provisoire puis renommé : l'installateur ne lit jamais un fichier à moitié écrit) :
//       accuse.json       { format, recu_le, rang } : la demande est vue (l'installateur sait alors qu'un service lui répond et attend plus longtemps)
//       resultat.json     le bilan (structure-sur-place.mjs#essayerSurUneCopie : `format` 'maverick-structure/1', `verdict`, …) plus `demande`, `essaye_le`,
//                         `instance` et `resume` (une phrase) ; écrit en JSON indenté de deux espaces, `verdict` et `resume` au premier niveau (le shell de
//                         l'installateur les lit sans JSON)
//   db/essai-de-structure/dernier.json                    le dernier résultat, gardé (page Debug : GET /api/debug/structure/)
//   db/essai-de-structure/structure-essai-*.db            les copies d'un essai en cours : TOUJOURS effacées (à la fin d'un essai, et à l'ouverture du service)
//
// La charge reste faible, le serveur porte aussi la production : un `readdir` d'un dossier presque toujours absent toutes les 3 s ; un essai à la fois, dans un
// fil à part (essayerEnArrierePlan) ; rien n'est copié sans l'espace libre pour deux copies. Aucune écriture dans la vraie base, ouverte seulement en lecture
// seule pour la copie. Les demandes laissées (un installateur tué) sont retirées au bout d'une heure, à l'ouverture et à chaque passage.
// Le service importe seulement des modules de Node et de serveur/.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { instant as ecrireInstant } from './instant.mjs';
import { FORMAT_DU_BILAN, essayerEnArrierePlan, purgerLesEssaisDeStructure } from './structure-sur-place.mjs';

export const DOSSIER_DES_ESSAIS = 'essai-de-structure';
export const FORMAT_DE_LA_DEMANDE = 'maverick-essai-demande/1';
export const FORMAT_DE_L_ACCUSE = 'maverick-essai-accuse/1';
/** Ce que rend GET /api/debug/structure/ (le dernier résultat y est tel que `resultat.json` l'a écrit). */
export const FORMAT_DE_L_ETAT = 'maverick-essai-etat/1';
export const FICHIERS_DE_LA_DEMANDE = { demande: 'demande.json', accuse: 'accuse.json', resultat: 'resultat.json', migrations: 'migrations', schema: 'schema.sql' };
export const FICHIER_DU_DERNIER = 'dernier.json';
/** Le nom d'une demande, tel que l'installateur le bâtit : « demande-<version>-<pid> ». Un autre nom du dossier n'est jamais lu ni retiré. */
export const NOM_D_UNE_DEMANDE = /^demande-[A-Za-z0-9._-]{1,80}$/;
const DEPOT_PROVISOIRE = /^\.depot-[0-9]+$/;
/** Une demande (ou un dépôt provisoire) que rien n'a touchée depuis ce temps est abandonnée : son installateur est parti. */
export const VIE_D_UNE_DEMANDE_MS = 60 * 60 * 1000;
/** Le passage de la surveillance (service.mjs : le plus petit de cette valeur et de l'intervalle de la surveillance des fichiers). */
export const INTERVALLE_DES_DEMANDES_MS = 3000;
/** L'espace libre exigé : trois fois la taille de la base (deux copies et le journal d'une migration) plus cette marge. */
export const MARGE_D_ESPACE = 64 * 1024 * 1024;

const lireJson = (chemin) => {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'));
  } catch {
    return null;
  }
};

/** Écrit `valeur` en JSON d'un coup : un fichier provisoire, puis renommé. */
function ecrireJson(chemin, valeur) {
  const provisoire = `${chemin}.provisoire-${process.pid}`;
  try {
    writeFileSync(provisoire, `${JSON.stringify(valeur, null, 2)}\n`);
    renameSync(provisoire, chemin);
  } catch (e) {
    rmSync(provisoire, { force: true });
    throw e;
  }
}

/** Une phrase pour le journal et l'installateur : ce que dit le bilan. Jamais un nom de fiche ni une valeur du contenu. */
export function resumeDuBilan(bilan) {
  const une = (texte) => String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  switch (bilan.verdict) {
    case 'accepte': {
      const n = bilan.migrations?.length ?? 0;
      const t = bilan.totaux ?? {};
      return `accepté : ${n} migration(s) (de ${bilan.versions?.avant} à ${bilan.versions?.apres}), ${t.ajoutees ?? 0} ligne(s) ajoutée(s), ${t.retirees ?? 0} retirée(s), ${t.modifiees ?? 0} modifiée(s)`;
    }
    case 'refuse': {
      const r = bilan.refus ?? {};
      return une(`refusé : ${r.migration === null || r.migration === undefined ? 'la livraison' : `migration ${String(r.migration).padStart(4, '0')}`}, étape ${r.etape ?? '?'} : ${r.raison ?? ''}`);
    }
    case 'a_jour':
      return `à jour : aucune migration à appliquer (version ${bilan.versions?.avant})`;
    default:
      return une(`indisponible : ${bilan.raison ?? 'essai impossible'}`);
  }
}

/**
 * Le suivi des demandes d'essai d'une instance.
 * @param {object} o
 * @param {string} o.dossier db/ de l'instance (le dossier de la base vivante)
 * @param {string} o.source la base vivante (copiée, jamais écrite)
 * @param {string} [o.instance] prod ou dev (noté dans le résultat)
 * @param {(message: string, options?: object) => void} [o.journal]
 * @param {(type: string, o?: object) => void} [o.evenement] évènement des métriques
 * @param {typeof essayerEnArrierePlan} [o.essayer] l'essai lui-même (un faux dans les tests)
 * @param {(dossier: string) => number} [o.espaceLibre] octets libres (par défaut statfs)
 * @param {() => string} [o.maintenant]
 */
export function creerEssaiDeStructure({ dossier, source, instance = null, journal = () => {}, evenement = () => {}, essayer = essayerEnArrierePlan,
  espaceLibre = null, maintenant = ecrireInstant }) {
  const racine = join(dossier, DOSSIER_DES_ESSAIS);
  const vues = new Set();
  let suite = Promise.resolve();
  let file = [];
  let enCours = null;
  let ferme = false;

  const libre = (d) => {
    if (espaceLibre) return espaceLibre(d);
    const f = statfsSync(d);
    return Number(f.bavail) * Number(f.bsize);
  };
  const taille = (chemin) => {
    try {
      return statSync(chemin).size;
    } catch {
      return 0;
    }
  };

  /** Ce que l'essai ne peut pas faire sans rien risquer : un bilan « indisponible », sinon null. */
  function empechement() {
    if (!existsSync(source)) return 'la base vivante n’existe pas encore';
    const besoin = 3 * (taille(source) + taille(`${source}-wal`)) + MARGE_D_ESPACE;
    mkdirSync(racine, { recursive: true });
    const dispo = libre(racine);
    if (dispo < besoin) return `espace disque insuffisant pour deux copies de la base (${Math.floor(dispo / 1048576)} Mio libres, ${Math.ceil(besoin / 1048576)} Mio nécessaires)`;
    return null;
  }

  async function traiter(nom) {
    const chemin = join(racine, nom);
    if (ferme || !existsSync(chemin)) return;
    const t0 = performance.now();
    const demande = lireJson(join(chemin, FICHIERS_DE_LA_DEMANDE.demande));
    const version = typeof demande?.version === 'string' ? demande.version.slice(0, 40) : null;
    enCours = { demande: nom, version, depuis: maintenant() };
    let bilan;
    try {
      const raison = demande ? empechement() : 'demande illisible (demande.json absent ou abîmé)';
      bilan = raison
        ? { format: FORMAT_DU_BILAN, verdict: 'indisponible', raison, duree_ms: 0 }
        : await essayer({
          source, dossier: racine, migrations: join(chemin, FICHIERS_DE_LA_DEMANDE.migrations), schema: join(chemin, FICHIERS_DE_LA_DEMANDE.schema),
          version, instant: maintenant(),
        });
    } catch (e) {
      // le fil a pu s'arrêter sans effacer ses copies (copies de la base) : un seul essai tourne à la fois, aucune n'est en cours
      try {
        purgerLesEssaisDeStructure(racine);
      } catch {
        // la purge de l'ouverture du service reprendra
      }
      bilan = { format: FORMAT_DU_BILAN, verdict: 'indisponible', raison: `l’essai n’a pas pu se faire : ${String(e?.message ?? e).slice(0, 200)}`, duree_ms: Math.round(performance.now() - t0) };
    }
    const resultat = { ...bilan, demande: { nom, version, deposee_le: typeof demande?.deposee_le === 'string' ? demande.deposee_le.slice(0, 40) : null },
      essaye_le: maintenant(), instance, resume: resumeDuBilan(bilan) };
    enCours = null;
    try {
      ecrireJson(join(racine, FICHIER_DU_DERNIER), resultat);
    } catch (e) {
      journal(`ERREUR structure : le dernier résultat n’a pas pu être gardé : ${e?.message ?? e}`, { categorie: 'base' });
    }
    // l'installateur peut être parti entre-temps (délai dépassé) : son dossier n'existe plus, ce n'est pas une erreur
    try {
      if (existsSync(chemin)) ecrireJson(join(chemin, FICHIERS_DE_LA_DEMANDE.resultat), resultat);
    } catch {
      // la demande a disparu pendant l'écriture
    }
    const refus = bilan.verdict === 'refuse';
    journal(`${refus ? 'ATTENTION ' : ''}structure : essai de la livraison ${version ?? '?'} sur une copie de la base : ${resultat.resume}`,
      { categorie: 'base', niveau: refus || bilan.verdict === 'indisponible' ? 'avertissement' : 'info' });
    evenement('structure_essai', { duree_ms: performance.now() - t0, detail: { verdict: bilan.verdict, version, migrations: bilan.migrations?.length ?? 0, etape: bilan.refus?.etape ?? null } });
  }

  /**
   * Les demandes et dépôts abandonnés, et (`copies`, à l'ouverture du service seulement : jamais pendant un essai) les copies qu'un arrêt a laissées. Rend
   * leur nombre.
   */
  function purger({ instant = Date.now(), copies = true } = {}) {
    if (!existsSync(racine)) return 0;
    let n = copies ? purgerLesEssaisDeStructure(racine) : 0;
    for (const nom of readdirSync(racine)) {
      if (!NOM_D_UNE_DEMANDE.test(nom) && !DEPOT_PROVISOIRE.test(nom)) continue;
      if (enCours?.demande === nom || file.includes(nom)) continue;
      try {
        if (instant - statSync(join(racine, nom)).mtimeMs <= VIE_D_UNE_DEMANDE_MS) continue;
        rmSync(join(racine, nom), { recursive: true, force: true });
        vues.delete(nom);
        n += 1;
      } catch {
        // retirée entre-temps
      }
    }
    return n;
  }

  /**
   * Un passage : prend les demandes nouvelles (sans `resultat.json`, jamais vues), écrit leur accusé aussitôt, les essaie une à une. Rend la promesse de tout
   * ce qui est en file (la surveillance l'ignore, les tests l'attendent).
   */
  function surveiller() {
    if (ferme) return suite;
    let noms;
    try {
      noms = readdirSync(racine);
    } catch {
      return suite; // dossier absent : aucune demande, aucun coût de plus
    }
    for (const v of vues) if (!noms.includes(v)) vues.delete(v);
    for (const nom of noms.filter((x) => NOM_D_UNE_DEMANDE.test(x)).sort()) {
      if (vues.has(nom)) continue;
      const chemin = join(racine, nom);
      if (existsSync(join(chemin, FICHIERS_DE_LA_DEMANDE.resultat)) || !existsSync(join(chemin, FICHIERS_DE_LA_DEMANDE.demande))) continue;
      vues.add(nom);
      file.push(nom);
      try {
        ecrireJson(join(chemin, FICHIERS_DE_LA_DEMANDE.accuse), { format: FORMAT_DE_L_ACCUSE, recu_le: maintenant(), rang: file.length + (enCours ? 1 : 0) });
      } catch {
        // la demande a disparu ou n'est pas inscriptible : l'essai se fait, la réponse se perd
      }
      suite = suite.then(async () => {
        try {
          await traiter(nom);
        } catch (e) {
          journal(`ERREUR structure : ${e?.message ?? e}`, { categorie: 'base' });
        } finally {
          file = file.filter((x) => x !== nom);
          enCours = null;
        }
      });
    }
    try {
      purger({ copies: false });
    } catch {
      // la purge est facultative
    }
    return suite;
  }

  /** Ce que lit la page Debug : l'essai en cours, le nombre en attente, le dernier résultat (null s'il n'y en a pas). */
  function lire() {
    return { format: FORMAT_DE_L_ETAT, en_cours: enCours, en_attente: file.length - (enCours ? 1 : 0), dernier: lireJson(join(racine, FICHIER_DU_DERNIER)) };
  }

  /** Plus aucune demande n'est prise ; l'essai en cours se termine. */
  const arreter = () => {
    ferme = true;
    return suite;
  };

  return { racine, surveiller, purger, lire, arreter, enCours: () => enCours };
}
