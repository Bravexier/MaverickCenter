// Le lien et la couleur d'un mot-clé du glossaire (migration 0098 ; réponses du propriétaire du 2026-11-06, transmises par le leader-technique :
// `mot_cle` gagne « couleur » et « url », NULL par défaut, « URL interne seulement » ; les [[…]] et les liens Markdown internes deviennent des balises ;
// « le mot clé reprenne la couleur de la page d'avant »). Une balise dont le mot-clé a une adresse mène à cette adresse ; sa couleur est une classe.
//   - L'adresse (`url`) : interne, relative à la racine du site, SANS le préfixe de déploiement (« /races/humain/ », « /metiers/#metier-mineur ») ;
//     ni « //hôte », ni espace, ni caractère hors ASCII imprimable, ni « \ » (le CHECK de data/schema.sql) ; son chemin (sans ancre ni requête) est une
//     adresse du site (lib/adresses-db.mjs#adressesDuSite : une page qui n'est pas d'exemple, une rubrique, une route fixe). L'ancre et la requête ne
//     sont pas vérifiées.
//   - La couleur (`couleur`) : une référence « <famille>:<id> » d'une couleur de la palette (lib/palette-css.mjs#FAMILLES_DE_LA_PALETTE, id = celui de sa
//     classe, lib/palette-css.mjs#idDeCouleur) ou « #rrggbb » (minuscules). La classe du mot-clé : celle de la palette pour une référence
//     (« couleur-classe-melee »), « couleur-mot-cle-<id> » pour une couleur écrite (sa règle : lib/palette-css.mjs#cssDesMotsCles). Qu'une référence
//     nomme une couleur de la palette se lit dans la palette (lib/palette-css.mjs#fauteDeLaCouleur) : ce module ne la lit pas.
//   - La page d'un mot-clé (motCleDeLaPage, réponse Q5 du propriétaire) : parmi les mots-clés COLORÉS dont l'adresse mène au chemin de la page, ancre
//     ignorée, le premier par ordre alphabétique du libellé.
// Sans aucune dépendance (ni la palette, ni les balises) : importable par un script de page (skill ui-couleurs : un script de page n'importe jamais
// lib/palette-css.mjs), par le service, les scripts db-* et les tests.

/**
 * Le registre de la migration 0098 (relatif à la racine du dépôt) : la table de conversion des liens d'un lot d'avant la migration
 * (serveur/edition.mjs#ancienneEcritureDesLiens, lib/liens-en-mots-cles.mjs#tableDeConversion), livré avec le service (serveur/livraison.mjs#FICHIERS_JOINTS).
 */
export const REGISTRE_DES_LIENS = 'data/migrations/0098-liens-en-mots-cles.json';

/** Le préfixe de la classe d'un mot-clé à couleur écrite (« #rrggbb ») : « couleur-mot-cle-<id> ». */
export const PREFIXE_DE_CLASSE = 'couleur-mot-cle-';

/**
 * Les liens Markdown internes que la migration 0098 a gardés (une ancre de l'accueil, que rien ne remplace : « /#lien-discord » reste un lien) : ni
 * db:check ni le service ne les refusent.
 */
export const LIENS_GARDES = Object.freeze(['/#lien-discord']);

/** Une couleur écrite : « #rrggbb », minuscules. */
export const COULEUR_ECRITE = /^#[0-9a-f]{6}$/;
/** Une référence de la palette : « <famille>:<id> » (famille en lettres minuscules ; id en minuscules, chiffres et tirets simples, ni au bord). */
export const REFERENCE_DE_COULEUR = /^([a-z]+):([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Une adresse découpée : { chemin, requete, ancre } (« /magies/?x=1#relations » → { chemin: '/magies/', requete: 'x=1', ancre: 'relations' }). */
export function decouperLAdresse(adresse) {
  const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(String(adresse ?? ''));
  return { chemin: m[1], requete: (m[2] ?? '').slice(1), ancre: (m[3] ?? '').slice(1) };
}

/**
 * Le chemin d'une adresse, sans requête ni ancre, relatif à la racine du site : le préfixe de déploiement `base` retiré s'il y est (« /MaverickCenter/ »),
 * « / » au début, et « / » à la fin d'un chemin dont le dernier segment n'est pas un fichier (« /races/elfe » → « /races/elfe/ » ; le site écrit ses
 * adresses avec la barre finale). '' pour une adresse qui n'est pas interne (vide, « //hôte », « https:… »).
 */
export function cheminDeLAdresse(adresse, { base = '/' } = {}) {
  let { chemin } = decouperLAdresse(adresse);
  if (/^[a-z][a-z0-9+.-]*:/i.test(chemin) || chemin.startsWith('//')) return '';
  const prefixe = `/${String(base ?? '/').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  if (prefixe !== '/' && (chemin === prefixe.slice(0, -1) || chemin.startsWith(prefixe))) chemin = chemin.slice(prefixe.length - 1) || '/';
  if (!chemin.startsWith('/')) chemin = `/${chemin}`;
  const dernier = chemin.slice(chemin.lastIndexOf('/') + 1);
  if (dernier && !dernier.includes('.')) chemin += '/';
  return chemin;
}

/** L'adresse sans sa requête (l'ancre gardée) : ce que deux adresses comparent pour mener au même endroit. */
const sansRequete = (adresse) => {
  const { chemin, ancre } = decouperLAdresse(adresse);
  return ancre ? `${chemin}#${ancre}` : chemin;
};

/**
 * La faute de forme d'une adresse (la règle du CHECK de mot_cle.url), ou null : interne (« / » au début, pas « // »), ASCII imprimable sans espace,
 * sans « \ ».
 */
export function fauteDeFormeDeLUrl(url) {
  if (typeof url !== 'string' || !url) return 'une adresse est attendue';
  if (!url.startsWith('/') || url.startsWith('//')) return 'l’adresse doit être interne au site et commencer par « / » (« /races/elfe/ »), sans le préfixe de déploiement';
  if (/[^!-~]/.test(url)) return 'l’adresse ne s’écrit qu’en caractères ASCII imprimables, sans espace';
  if (url.includes('\\')) return 'l’adresse ne contient pas de « \\ »';
  return null;
}

/**
 * La faute d'une adresse de mot-clé, ou null : sa forme (fauteDeFormeDeLUrl), puis son chemin (sans ancre ni requête) parmi `adresses` (les chemins du
 * site, lib/adresses-db.mjs#adressesDuSite : un Set ou une liste). L'ancre et la requête ne sont pas vérifiées.
 */
export function fauteDeLUrl(url, adresses) {
  const forme = fauteDeFormeDeLUrl(url);
  if (forme) return forme;
  const connues = adresses instanceof Set ? adresses : new Set(adresses ?? []);
  const chemin = cheminDeLAdresse(url);
  if (chemin !== decouperLAdresse(url).chemin) return `l’adresse s’écrit avec la barre finale du site (« ${chemin} »)`;
  if (!connues.has(chemin)) return `« ${chemin} » n’est l’adresse d’aucune page du site`;
  return null;
}

/**
 * La couleur d'un mot-clé lue : { ecrite: '#rrggbb' } ou { famille, id } (une référence de la palette), null sans couleur ou pour une écriture qui
 * n'est ni l'une ni l'autre. Ne dit pas si la palette connaît la référence (lib/palette-css.mjs#fauteDeLaCouleur).
 */
export function lireLaCouleur(couleur) {
  if (typeof couleur !== 'string') return null;
  if (COULEUR_ECRITE.test(couleur)) return { ecrite: couleur };
  const m = REFERENCE_DE_COULEUR.exec(couleur);
  return m ? { famille: m[1], id: m[2] } : null;
}

/**
 * La classe d'un mot-clé coloré ({ id, couleur }) : « couleur-<famille>-<id> » pour une référence de la palette, « couleur-mot-cle-<id> » pour une
 * couleur écrite ; null sans couleur (ou mal écrite). Un calcul de texte, sans la palette : qu'une référence existe se contrôle à l'écriture
 * (db:check, service).
 */
export function classeDuMotCle(m) {
  const lue = lireLaCouleur(m?.couleur);
  if (!lue) return null;
  return lue.ecrite ? `${PREFIXE_DE_CLASSE}${m.id}` : `couleur-${lue.famille}-${lue.id}`;
}

/** Les mots-clés d'un vocabulaire : une liste, ou un vocabulaire prêt (lib/mots-cles-balises.mjs#vocabulaireDesMotsCles : `liste`). */
const motsClesDe = (vocabulaire) => (Array.isArray(vocabulaire) ? vocabulaire : vocabulaire?.liste ?? [...(vocabulaire ?? [])]);

/** L'ordre alphabétique des libellés (comme lib/mots-cles.mjs#parLibelle, sans l'importer), l'id départage. */
const parLibelle = (a, b) => String(a.libelle).localeCompare(String(b.libelle), 'fr', { sensitivity: 'base' }) || String(a.id).localeCompare(String(b.id));

/**
 * Le mot-clé d'une page (réponse Q5 du propriétaire) : parmi les mots-clés COLORÉS (`couleur` non vide) dont l'adresse mène au chemin `chemin` (ancres
 * et requêtes ignorées des deux côtés ; `base` : le préfixe de déploiement à retirer de `chemin`), le premier par ordre alphabétique du libellé ; null
 * s'il n'y en a aucun. `vocabulaire` : [{ id, libelle, couleur, url }] (GET /api/edition/mots-cles/, lib/mots-cles-db.mjs#motsClesDeLaBase).
 */
export function motCleDeLaPage(vocabulaire, chemin, { base = '/' } = {}) {
  const voulu = cheminDeLAdresse(chemin, { base });
  if (!voulu) return null;
  const candidats = motsClesDe(vocabulaire).filter((m) => m?.couleur && typeof m.url === 'string' && cheminDeLAdresse(m.url) === voulu);
  return candidats.sort(parLibelle)[0] ?? null;
}

/**
 * Les mots-clés qui mènent à l'adresse `adresse` (un lien saisi, converti en balise par le service) : ceux dont l'adresse est la même (requête
 * ignorée, ancre comprise) ; à défaut, ceux dont l'adresse, sans ancre ni requête, est le chemin de `adresse` (« /magies/#relations » → le mot-clé de
 * « /magies/ »). `motsCles` : [{ id, libelle, url }].
 */
export function motsClesDeLAdresse(motsCles, adresse) {
  const avecUrl = motsClesDe(motsCles).filter((m) => typeof m?.url === 'string' && m.url);
  const voulue = sansRequete(adresse);
  const memes = avecUrl.filter((m) => sansRequete(m.url) === voulue);
  if (memes.length) return memes;
  const chemin = cheminDeLAdresse(adresse);
  return avecUrl.filter((m) => { const d = decouperLAdresse(m.url); return !d.ancre && !d.requete && cheminDeLAdresse(m.url) === chemin; });
}

/** Vrai si un lien Markdown interne vers `adresse` est l'un de ceux que la migration a gardés (LIENS_GARDES). */
export const lienGarde = (adresse) => LIENS_GARDES.includes(String(adresse ?? ''));
