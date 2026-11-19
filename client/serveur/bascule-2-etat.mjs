// L'état de la bascule 2 en lecture seule, pour la page Mise à jour du site de dev (`bascule_2` dans GET /api/mise-a-jour/ ; docs/api.md) : où en sont les cinq
// interrupteurs, chacun `true`, `false` ou `null` (inconnu, avec sa raison), jamais deviné.
//   - `gel_des_fusions` et `actif` : tools/flux-git/bascule-2.json sur la branche dev de GitHub. Le service n'a pas le dépôt : il le lit par l'API de GitHub (client de
//     serveur/notes-de-version.mjs), EN ARRIÈRE-PLAN ; la réponse de la page ne l'attend jamais (valeur en cache avec sa date, sinon « pas encore lu »).
//   - `db_bascule_2`, `atelier_servir` : lus sur place (marqueur, servir.json de l'atelier). `activation_par_paquet` : le fichier de la production, que le site de dev ne voit
//     pas ; seul un rapport d'activation en témoigne (activer.sh refuse sans lui avant d'écrire quoi que ce soit).
// Rien d'un secret ni d'un chemin du serveur n'y passe : des états, des dates et des mots d'une liste fermée.

import { statSync } from 'node:fs';

/** Le fichier des interrupteurs de GitHub, relatif à la racine du dépôt (tools/flux-git/bascule-2-interrupteur.mjs#INTERRUPTEUR) et la branche où il est lu. */
export const CHEMIN_DES_INTERRUPTEURS = 'tools/flux-git/bascule-2.json';
export const BRANCHE_DES_INTERRUPTEURS = 'dev';
/** Les deux clés du fichier lues ici. */
export const CLES_DE_GITHUB = Object.freeze(['gel_des_fusions', 'actif']);
/** Combien de temps une lecture réussie vaut, et le délai avant de réessayer après un échec. */
export const VALIDITE_MS = 300_000;
export const DELAI_APRES_ECHEC_MS = 60_000;

/** Le chemin est-il un dossier (sans lever) ? Le dossier des paquets est toujours donné au service en déploiement (monté sur /dev/null tant que `poser-bascule-2` n'est pas fait). */
export function estUnDossier(chemin) {
  try {
    return Boolean(chemin) && statSync(chemin).isDirectory();
  } catch {
    return false;
  }
}

/** Les raisons d'un état inconnu (liste fermée) et leur phrase courte. */
export const PHRASES_DES_RAISONS = Object.freeze({
  pas_encore_lu: 'pas encore lu (GitHub est interrogé en arrière-plan)',
  github_absent: 'pas de lien avec GitHub sur ce serveur',
  sans_jeton: 'aucun jeton GitHub sur ce serveur',
  jeton_refuse: 'jeton GitHub refusé',
  droit_manquant: 'le jeton n’a pas le droit de lire le dépôt',
  fichier_introuvable: 'fichier introuvable sur dev (ou dépôt non lisible avec ce jeton)',
  github_injoignable: 'GitHub ne répond pas',
  fichier_illisible: 'fichier des interrupteurs illisible',
  valeur_illisible: 'valeur illisible (true ou false attendu)',
  pas_d_atelier: 'l’atelier n’existe que sur le site de dev',
  atelier_non_installe: 'atelier non installé : ses rapports ne sont pas montés',
  rapport_illisible: 'rapport de l’interrupteur illisible',
  pas_de_dossier_des_paquets: 'dossier partagé des paquets non monté',
  aucune_activation: 'aucune activation tentée sur la production',
});

const inconnu = (raison, plus = {}) => ({ etat: null, raison, phrase: PHRASES_DES_RAISONS[raison] ?? null, ...plus });
const connu = (etat, plus = {}) => ({ etat, raison: null, phrase: null, ...plus });

/**
 * Lit les deux clés du fichier des interrupteurs (le texte, ou null s'il est absent : éteint). Même règle que les deux lecteurs de la CI
 * (tools/flux-git/bascule-2-interrupteur.mjs pour `actif`, client/scripts/gel-des-fusions-lib.mjs pour `gel_des_fusions`), que le service ne peut pas importer (hors de client/,
 * ou importeurs de la CI) : clé absente = éteinte ; `true` ou `false` = tel quel ; autre chose = `null` (la CI échouerait : on ne devine pas). Le test `serveur-bascule-2-etat`
 * compare cette règle aux deux lecteurs. Lève une Error (`genre: 'illisible'`) sur un texte qui n'est pas un objet JSON.
 * @returns {{ gel_des_fusions: boolean|null, actif: boolean|null }}
 */
export function lireLesInterrupteurs(texte) {
  if (texte === null || texte === undefined) return { gel_des_fusions: false, actif: false };
  let v;
  try {
    v = JSON.parse(texte);
  } catch {
    throw Object.assign(new Error('JSON illisible'), { genre: 'illisible' });
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Object.assign(new Error('objet JSON attendu'), { genre: 'illisible' });
  const lire = (cle) => (v[cle] === undefined ? false : typeof v[cle] === 'boolean' ? v[cle] : null);
  return { gel_des_fusions: lire('gel_des_fusions'), actif: lire('actif') };
}

const RAISON_PAR_GENRE = Object.freeze({ jeton: 'sans_jeton', refuse: 'jeton_refuse', droit: 'droit_manquant', introuvable: 'fichier_introuvable', illisible: 'fichier_illisible' });

/**
 * La lecture en cache des interrupteurs de GitHub. `lire()` ne bloque jamais : elle rend ce qu'elle sait et, si la valeur est périmée, lance la relecture en arrière-plan.
 * @param {{ github: { configure?: () => boolean, lireUnFichier?: (chemin: string, o: { ref: string }) => Promise<string> } | null, instant?: () => number }} o
 */
export function creerLesInterrupteursDeGithub({ github, instant = Date.now, validite = VALIDITE_MS, apresEchec = DELAI_APRES_ECHEC_MS }) {
  let cache = null; // { valeurs, lu_le } d'une lecture réussie, ou { raison } d'un échec
  let dernierEssai = null;
  let enCours = null;

  const perime = (maintenant) => dernierEssai === null || maintenant - dernierEssai >= (cache?.valeurs ? validite : apresEchec);
  const relire = () => {
    enCours = (async () => {
      try {
        const valeurs = lireLesInterrupteurs(await github.lireUnFichier(CHEMIN_DES_INTERRUPTEURS, { ref: BRANCHE_DES_INTERRUPTEURS }));
        cache = { valeurs, lu_le: new Date(instant()).toISOString() };
      } catch (e) {
        cache = { raison: RAISON_PAR_GENRE[e?.genre] ?? 'github_injoignable' };
      } finally {
        dernierEssai = instant();
        enCours = null;
      }
    })();
    return enCours;
  };

  return {
    /** { gel_des_fusions, actif } : chacun { etat, raison, phrase, lu_le }. */
    lire() {
      const sans = (raison) => Object.fromEntries(CLES_DE_GITHUB.map((c) => [c, inconnu(raison, { lu_le: null })]));
      if (!github || typeof github.lireUnFichier !== 'function') return sans('github_absent');
      if (!github.configure?.()) return sans('sans_jeton');
      if (!enCours && perime(instant())) relire().catch(() => {});
      if (!cache) return sans('pas_encore_lu');
      if (!cache.valeurs) return sans(cache.raison);
      return Object.fromEntries(CLES_DE_GITHUB.map((c) => {
        const v = cache.valeurs[c];
        return [c, v === null ? inconnu('valeur_illisible', { lu_le: cache.lu_le }) : connu(v, { lu_le: cache.lu_le })];
      }));
    },
    /** Attend la relecture en cours (les tests ; la page ne l'attend jamais). */
    attendre: async () => { await enCours; },
  };
}

/**
 * Le rapport `bascule_2` : cinq interrupteurs et le dernier résultat d'activation.
 * @param {object} o
 * @param {boolean} o.marqueur `db/bascule-2` (service.bascule2)
 * @param {{ pose: boolean|null, depuis: string|null, raison?: string } | null} o.servir l'état de l'interrupteur de l'atelier (serveur/atelier.mjs#servir), null sans atelier
 * @param {{ gel_des_fusions: object, actif: object }} o.github la lecture en cache (`creerLesInterrupteursDeGithub().lire()`)
 * @param {{ le: string } | null} o.activation le dernier rapport de l'activation (paquets-de-la-production.mjs#lireLActivation), lu une fois par l'appelant
 * @param {boolean} o.dossierDesPaquets le dossier partagé des paquets est monté (un vrai dossier : `estUnDossier(service.paquets)`)
 */
export function etatDeLaBascule2({ marqueur, servir, github, activation, dossierDesPaquets }) {
  return {
    interrupteurs: {
      gel_des_fusions: github.gel_des_fusions,
      actif: github.actif,
      db_bascule_2: connu(Boolean(marqueur)),
      atelier_servir: !servir
        ? inconnu('atelier_non_installe', { depuis: null })
        : servir.pose === null ? inconnu(servir.raison ?? 'atelier_non_installe', { depuis: null }) : connu(servir.pose, { depuis: servir.depuis ?? null }),
      // activer.sh refuse (code 2, aucun rapport) sans <production>/activation-par-paquet : un rapport dit que l'interrupteur existait à son heure. Jamais « éteint » : sans rapport, on ne sait pas.
      activation_par_paquet: activation ? connu(true, { vu_le: activation.le }) : inconnu(dossierDesPaquets ? 'aucune_activation' : 'pas_de_dossier_des_paquets', { vu_le: null }),
    },
    activation: activation ?? null,
  };
}
