// L'atelier du site de dev, côté service (lot 9 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md, PR 3 ;
// docs/serveur.md, « Atelier du site de dev »). Après chaque installation du site de dev, un conteneur Docker sans réseau, lancé par root (deploy/installateur/atelier/),
// fabrique un site témoin depuis l'extrait du contenu et le compare au site livré par GitHub. Le service n'y commande RIEN : il fait seulement deux choses.
//
//   1. Il fabrique l'extrait du contenu de l'atelier et le tient à jour dans le DÉPÔT de l'atelier, <instance>/atelier/depot/, que le geste du propriétaire crée (root) et que son
//      docker-compose.override.yml monte dans le service (MAVERICK_ATELIER_DEPOT=/atelier-depot) : contenu-<version>.db (+ contenu.json), jamais de fiche, de compte ni de journal
//      (serveur/extrait.mjs#fabriquerExtrait, lot 5). Le service ne peut ni renommer ni remplacer ce point de montage : la source que root monte ensuite dans le conteneur reste un
//      chemin fixé par root, hors de db/ (jamais un chemin que le service peut changer en lien). Ce que le service y dépose n'est ouvert que par le conteneur, sans privilège
//      (conteneur.sh, dépôt monté en lecture seule) ; root n'en fait que des `stat` (le service peut y poser une FIFO, un périphérique ou un lien). Le nom du fichier porte la version installée.
//      Une nouvelle version : tout de suite ; un contenu qui change (les saisies du site de dev) : après un délai (`delai`), puis refait au plus une fois par passage.
//      Rien n'est fait tant que l'atelier n'est pas installé (rapports/installe.json, posé par root), et jamais en production.
//   2. Il LIT les rapports que root écrit dans un dossier monté en lecture seule (MAVERICK_ATELIER, posé par le docker-compose.override.yml que le geste du propriétaire écrit ; absent avant) : kit.json (l'installateur), installe.json (le geste
//      du propriétaire), en-cours.json (une fabrication tourne), puis un dossier par fabrication <AAAAMMJJ-HHMMSS>/ : rapport.json (`maverick-atelier/1`, écrit par root),
//      fabrication.json (`maverick-fabrication/1`) et comparaison.json (`maverick-comparaison/1`), produits dans le conteneur et copiés tels quels par root. Root n'en lit
//      aucun ; c'est ICI que chaque fichier est borné en taille et validé champ par champ (une liste blanche : un champ inconnu n'entre pas), jamais interprété autrement.
//
// État rendu (GET /api/debug/atelier/, `maverick-atelier-etat/1`, forme décrite dans src/lib/debug-atelier.mjs) : pas_d_atelier (production, ou dossier des rapports monté
// sans kit), non_installe (dossier des rapports pas monté, ou kit posé et geste du propriétaire pas encore fait), en_attente (installé, rien de mesuré pour la version installée), en_cours, rapport.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { jugerLeServeur, picDuRapport, texteDuResume } from '../src/lib/debug-atelier.mjs';
import { DOSSIER_DES_ESSAIS } from './essai-de-structure.mjs';
import { FICHIER_BASE } from './base-vivante.mjs';
import { cleDeChangement, fabriquerEnArrierePlan } from './extrait.mjs';
import { instant as ecrireInstant } from './instant.mjs';

export const FORMAT_ETAT_DE_L_ATELIER = 'maverick-atelier-etat/1';
export const FORMAT_RAPPORT_DE_L_ATELIER = 'maverick-atelier/1';
export const FORMAT_DU_CONTENU_DE_L_ATELIER = 'maverick-atelier-contenu/1';
/** L'ancien rangement de l'extrait, sous db/ : retiré au premier passage (le dépôt de l'atelier est désormais un dossier de root, hors de db/). */
export const ANCIEN_DOSSIER_DE_L_EXTRAIT = join(DOSSIER_DES_ESSAIS, 'atelier');
export const FICHIER_DU_CONTENU = 'contenu.json';
/** Le nom de l'extrait d'une version : root le cherche par ce nom, rien d'autre (la version est celle de la marque posée par l'installateur). */
export const nomDeLExtrait = (version) => `contenu-${version}.db`;
export const VERSION_VALIDE = /^\d+\.\d+\.\d+$/;
const ID_DU_RAPPORT = /^\d{8}-\d{6}$/;
const PLAFOND_DES_FICHIERS = Object.freeze({ kit: 16384, installe: 8192, enCours: 4096, rapport: 32768, fabrication: 262144, comparaison: 262144 });
export const RAPPORTS_GARDES = 20;
const ISSUES = ['fait', 'refus', 'echec', 'oom', 'delai'];
const MOTIFS = ['memoire_insuffisante', 'marge_insuffisante', 'disque_insuffisant', 'extrait_absent', 'extrait_refuse', 'kit_perime', 'kit_absent', 'image_absente', 'docker_refuse', 'marque_illisible'];
const SOURCES_DE_LA_MEMOIRE = ['cgroup', 'cgroup_echantillonne', 'docker_stats'];

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lecture bornée et validation (une liste blanche : rien d'autre que ce qui est connu, avec ses bornes)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Un fichier JSON régulier (ni lien, ni fichier spécial) d'au plus `max` octets, ou null. */
export function lireUnJsonBorne(chemin, max) {
  try {
    const s = lstatSync(chemin);
    if (!s.isFile() || s.size > max) return null;
    const valeur = JSON.parse(readFileSync(chemin, 'utf8'));
    return valeur && typeof valeur === 'object' && !Array.isArray(valeur) ? valeur : null;
  } catch {
    return null;
  }
}

const entier = (v, max = 1e15) => (Number.isSafeInteger(v) && v >= 0 && v <= max ? v : null);
const nombre = (v, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 100) / 100 : null);
const texte = (v, n = 120) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} .,:;()+@/_'’«»\-–—…=%]/gu, '').trim().slice(0, n) : null);
const motif = (v, motifs) => (typeof v === 'string' && motifs.includes(v) ? v : null);
const date = (v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v) ? v : null);
const version = (v) => (typeof v === 'string' && VERSION_VALIDE.test(v) ? v : null);
const liste = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);

/** kit.json (`maverick-kit/1`, posé par l'installateur) : les champs utiles à la page. */
export function validerLeKit(o) {
  if (!o || o.format !== 'maverick-kit/1') return null;
  return {
    version: version(o.version), node: texte(o.node, 20), image: typeof o.image === 'string' && /^node:[0-9]+(\.[0-9]+){0,2}-(bookworm-slim|alpine)$/.test(o.image) ? o.image : null,
    plateforme: { os: texte(o.plateforme?.os, 20), arch: texte(o.plateforme?.arch, 20), libc: texte(o.plateforme?.libc, 20) },
    fichiers: entier(o.fichiers, 1e7), taille_decompressee_octets: entier(o.taille_decompressee_octets), taille_archive_octets: entier(o.taille_archive_octets),
  };
}

const REGLAGES = ['memoire_max_ko', 'besoin_ko', 'cpus', 'disque_min_ko', 'delai_s'];
const validerLesReglages = (o) => Object.fromEntries(REGLAGES.map((k) => [k, nombre(o?.[k], 1e12)]));

/** installe.json (`maverick-atelier-installe/1`, écrit par le geste du propriétaire). */
export function validerLInstallation(o) {
  if (!o || o.format !== 'maverick-atelier-installe/1') return null;
  return { installe_le: date(o.installe_le), reglages: validerLesReglages(o.reglages) };
}

/** en-cours.json (écrit par root pendant une fabrication). */
export function validerLEnCours(o) {
  if (!o || o.format !== 'maverick-atelier-en-cours/1') return null;
  return { debut: date(o.debut), version_installee: version(o.version_installee) };
}

/** fabrication.json (`maverick-fabrication/1`, produit dans le conteneur par scripts/fabriquer-depuis-contenu.mjs). */
export function validerLaFabrication(o) {
  if (!o || o.format !== 'maverick-fabrication/1') return null;
  const memoire = (m) => ({ pic_ko: entier(m?.pic_ko), cumul_ko: entier(m?.cumul_ko), processus: entier(m?.processus, 1e6) });
  return {
    format: o.format, statut: motif(o.statut, ['ok', 'echec']), mode: motif(o.mode, ['deux-temps', 'en-un-temps']), node: texte(o.node, 20), debut: date(o.debut), duree_ms: nombre(o.duree_ms, 1e10),
    etapes: liste(o.etapes, 8).map((e) => ({ nom: texte(e?.nom, 20), duree_ms: nombre(e?.duree_ms, 1e10), statut: motif(e?.statut, ['ok', 'echec']) })),
    contenu: o.contenu ? {
      octets: entier(o.contenu.octets), version_du_site: texte(o.contenu.version_du_site, 40), schema: entier(o.contenu.schema, 1e6), pages: entier(o.contenu.pages, 1e7),
      empreinte: typeof o.contenu.empreinte === 'string' && /^[0-9a-f]{64}$/.test(o.contenu.empreinte) ? o.contenu.empreinte : null, fabrique_le: date(o.contenu.fabrique_le),
    } : null,
    sortie: o.sortie ? { fichiers: entier(o.sortie.fichiers, 1e8), octets: entier(o.sortie.octets) } : null,
    memoire: o.memoire ? {
      ...memoire(o.memoire),
      par_etape: Object.fromEntries(Object.entries(o.memoire.par_etape ?? {}).slice(0, 8).map(([nom, m]) => [texte(nom, 20) ?? '?', memoire(m)])),
    } : null,
    erreur: o.erreur ? { etape: texte(o.erreur.etape, 20), message: texte(o.erreur.message, 300) } : null,
  };
}

const validerUneCategorie = (c, exemples) => ({
  nombre: entier(c?.nombre, 1e9),
  exemples: liste(c?.exemples, 20).map((e) => ({ fichier: texte(e?.fichier, 200), octets: entier(e?.octets), octets_a: entier(e?.octets_a), octets_b: entier(e?.octets_b), ...(exemples ? { cause: texte(e?.cause, 200) } : {}) })),
});

/** comparaison.json (`maverick-comparaison/1`, produit dans le conteneur par scripts/comparer-sites.mjs). */
export function validerLaComparaison(o) {
  if (!o || o.format !== 'maverick-comparaison/1') return null;
  return {
    format: o.format,
    a: { fichiers: entier(o.a?.fichiers, 1e9), octets: entier(o.a?.octets) },
    b: { fichiers: entier(o.b?.fichiers, 1e9), octets: entier(o.b?.octets) },
    identiques: entier(o.identiques, 1e9),
    differents: validerUneCategorie(o.differents, false),
    seulement_a: validerUneCategorie(o.seulement_a, false),
    seulement_b: validerUneCategorie(o.seulement_b, false),
    variables: {
      ...validerUneCategorie(o.variables, true),
      par_cause: Object.fromEntries(Object.entries(o.variables?.par_cause ?? {}).slice(0, 10).map(([cause, n]) => [texte(cause, 200) ?? '?', entier(n, 1e9)])),
    },
    equivalents: typeof o.equivalents === 'boolean' ? o.equivalents : null,
  };
}

/** rapport.json (`maverick-atelier/1`, écrit par root : des nombres et des mots connus). Rend null s'il n'est pas de ce format ou si son identifiant n'est pas celui de son dossier. */
export function validerLeRapport(o, id) {
  if (!o || o.format !== FORMAT_RAPPORT_DE_L_ATELIER || o.id !== id || !ID_DU_RAPPORT.test(id)) return null;
  const issue = motif(o.issue, ISSUES);
  if (!issue) return null;
  const s = o.serveur ?? {};
  return {
    id, issue, motif: motif(o.motif, MOTIFS), horodatage: date(o.horodatage), version_installee: version(o.version_installee), version_du_kit: version(o.version_du_kit), tag: texte(o.tag, 40),
    serveur: {
      processeurs: entier(s.processeurs, 1e5), memoire_totale_ko: entier(s.memoire_totale_ko), memoire_disponible_ko: entier(s.memoire_disponible_ko),
      disque_total_ko: entier(s.disque_total_ko), disque_libre_ko: entier(s.disque_libre_ko), charge: liste(s.charge, 3).map((n) => nombre(n, 1e6)),
    },
    reglages: validerLesReglages(o.reglages), plafond_ko: entier(o.plafond_ko), marge_ko: Number.isSafeInteger(o.marge_ko) ? o.marge_ko : null, duree_ms: nombre(o.duree_ms, 1e10), code_sortie: Number.isSafeInteger(o.code_sortie) ? o.code_sortie : null,
    memoire: { pic_ko: entier(o.memoire?.pic_ko), source: motif(o.memoire?.source, SOURCES_DE_LA_MEMOIRE) }, cpu_ms: nombre(o.cpu_ms, 1e12),
    place: { kit_ko: entier(o.place?.kit_ko), travail_ko: entier(o.place?.travail_ko), sortie_ko: entier(o.place?.sortie_ko) },
    a_fabrication: o.fabrication === true, a_comparaison: o.comparaison === true,
  };
}

/** Le rapport d'un dossier avec ses deux fichiers du conteneur, chacun lu, borné et validé ; ce que le service a refusé est dit dans `invalides`. */
export function lireUnRapport(dossier, id) {
  const base = validerLeRapport(lireUnJsonBorne(join(dossier, id, 'rapport.json'), PLAFOND_DES_FICHIERS.rapport), id);
  if (!base) return null;
  const invalides = [];
  const joindre = (attendu, fichier, plafond, valider, nom) => {
    if (!attendu) return null;
    const lu = valider(lireUnJsonBorne(join(dossier, id, fichier), plafond));
    if (!lu) invalides.push(`${nom} illisible, trop gros ou d’un autre format`);
    return lu;
  };
  const { a_fabrication: aF, a_comparaison: aC, ...rapport } = base;
  return {
    ...rapport,
    fabrication: joindre(aF, 'fabrication.json', PLAFOND_DES_FICHIERS.fabrication, validerLaFabrication, 'fabrication.json'),
    comparaison: joindre(aC, 'comparaison.json', PLAFOND_DES_FICHIERS.comparaison, validerLaComparaison, 'comparaison.json'),
    invalides,
  };
}

/** Le résumé d'une ligne de l'historique. */
export function resumerUnRapport(r) {
  return {
    id: r.id, horodatage: r.horodatage, version_installee: r.version_installee, issue: r.issue, motif: r.motif, duree_ms: r.duree_ms, pic_ko: picDuRapport(r),
    equivalents: r.comparaison ? r.comparaison.equivalents : null, differents: r.comparaison ? r.comparaison.differents?.nombre ?? null : null,
  };
}

/** Les identifiants des dossiers de rapports de `rapports`, du plus récent au plus ancien (un dossier de la forme AAAAMMJJ-HHMMSS, jamais un lien). */
export function listerLesRapports(rapports, plafond = RAPPORTS_GARDES) {
  try {
    return readdirSync(rapports, { withFileTypes: true }).filter((e) => e.isDirectory() && ID_DU_RAPPORT.test(e.name)).map((e) => e.name).sort().reverse().slice(0, plafond);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le gestionnaire
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * @param {object} o
 * @param {string} o.dossier le dossier de la base vivante (db/)
 * @param {string|null} [o.depot] le dépôt de l'atelier, monté en lecture-écriture (MAVERICK_ATELIER_DEPOT) : l'extrait y est fabriqué ; null : rien n'est fabriqué
 * @param {string|null} [o.rapports] le dossier des rapports de root, monté en lecture seule (MAVERICK_ATELIER) ; null : pas d'atelier
 * @param {boolean} o.edition site de dev seulement : sans lui, rien n'est lu ni fabriqué
 * @param {() => string|null} o.version la version installée
 * @param {() => (import('node:sqlite').DatabaseSync | null)} o.base la base vivante
 * @param {number} [o.delai] ms entre le premier constat d'un contenu changé et l'extrait refait (10 min par défaut)
 * @param {number} [o.intervalle] ms entre deux passages (1 min par défaut ; 0 : aucun passage, les tests appellent `passer`)
 * @param {typeof fabriquerEnArrierePlan} [o.fabriquer] fabrique l'extrait (un faux dans les tests)
 * @param {() => number} [o.horloge]
 */
export function creerAtelier({ dossier, rapports = null, depot = null, edition, version: versionInstallee, base, delai = 600_000, intervalle = 60_000, fabriquer = fabriquerEnArrierePlan, horloge = Date.now,
  journal = () => {}, evenement = () => {}, instant = () => new Date() }) {
  const racine = depot ?? join(dossier, ANCIEN_DOSSIER_DE_L_EXTRAIT); // sans dépôt, jamais écrit : `passer` rend « inactif » avant
  const ancien = join(dossier, ANCIEN_DOSSIER_DE_L_EXTRAIT);
  const source = join(dossier, FICHIER_BASE);
  let vue = null; // le contenu a changé : { cle, le }
  let enCours = null;
  let minuteur = null;
  let dernierIdVu = null;
  let ferme = false;
  const resumes = new Map(); // id -> résumé (un rapport écrit ne change plus)

  const lireInstallation = () => (rapports ? validerLInstallation(lireUnJsonBorne(join(rapports, 'installe.json'), PLAFOND_DES_FICHIERS.installe)) : null);
  const lireLeKit = () => (rapports ? validerLeKit(lireUnJsonBorne(join(rapports, 'kit.json'), PLAFOND_DES_FICHIERS.kit)) : null);
  const lireLeContenu = () => {
    const o = lireUnJsonBorne(join(racine, FICHIER_DU_CONTENU), 8192);
    if (!o || o.format !== FORMAT_DU_CONTENU_DE_L_ATELIER) return null;
    return { cle: texte(o.cle, 80), version: version(o.version), fabrique_le: date(o.fabrique_le), octets: entier(o.octets), duree_ms: nombre(o.duree_ms, 1e10) };
  };

  /** La clé du contenu d'une version : la clé de changement de l'extrait (lot 5) et la version installée. */
  function cleActuelle() {
    const db = base();
    const v = versionInstallee();
    if (!db || !version(v)) return null;
    return { version: v, cle: `${v}:${cleDeChangement(db, dossier)}` };
  }

  async function fabriquerLExtrait({ version: v, cle }) {
    const neuf = join(racine, `.${nomDeLExtrait(v)}.${process.pid}.neuf`);
    try {
      const meta = await fabriquer({ source, destination: neuf, version: v, instant: instant() });
      const cible = join(racine, nomDeLExtrait(v));
      renameSync(neuf, cible);
      const provisoire = join(racine, `.${FICHIER_DU_CONTENU}.${process.pid}`);
      writeFileSync(provisoire, `${JSON.stringify({ format: FORMAT_DU_CONTENU_DE_L_ATELIER, cle, version: v, fabrique_le: meta.fabrique_le, octets: meta.fichier?.octets ?? null, empreinte: meta.empreinte, duree_ms: meta.duree_ms })}\n`);
      renameSync(provisoire, join(racine, FICHIER_DU_CONTENU));
      for (const nom of readdirSync(racine)) if (/^contenu-.+\.db$/.test(nom) && nom !== nomDeLExtrait(v)) rmSync(join(racine, nom), { force: true });
      journal(`atelier : extrait du contenu refait pour la version ${v} (${((meta.fichier?.octets ?? 0) / 1048576).toFixed(1)} Mo, ${meta.duree_ms} ms)`, { categorie: 'service' });
      evenement('atelier_extrait', { duree_ms: meta.duree_ms, detail: { version: v, octets: meta.fichier?.octets ?? null } });
      return meta;
    } catch (e) {
      rmSync(neuf, { force: true });
      journal(`ERREUR atelier : l’extrait du contenu n’a pas pu être fabriqué (${String(e.message).slice(0, 200)})`, { categorie: 'service' });
      evenement('atelier_extrait', { detail: { erreur: String(e.message).slice(0, 200) } });
      return null;
    }
  }

  /** Prend note d'un rapport nouveau : un évènement des métriques et une ligne du journal (un refus, un arrêt par manque de mémoire sont des mesures). */
  function noterLesRapports() {
    const ids = listerLesRapports(rapports, 1);
    if (!ids.length || ids[0] === dernierIdVu) return;
    const premier = dernierIdVu === null;
    dernierIdVu = ids[0];
    if (premier) return; // le rapport d'avant le démarrage du service : déjà noté la fois d'avant
    const r = lireUnRapport(rapports, ids[0]);
    if (!r) return;
    journal(`atelier : ${texteDuResume(resumerUnRapport(r))}`, { categorie: 'service' });
    evenement('atelier_fabrication', {
      duree_ms: r.duree_ms,
      detail: { issue: r.issue, motif: r.motif, version: r.version_installee, pic_ko: picDuRapport(r), plafond_ko: r.plafond_ko, equivalents: r.comparaison?.equivalents ?? null },
    });
  }

  /**
   * Un passage : l'extrait est-il à jour ? Rend `'inactif'` (production, atelier non installé), `'a_jour'`, `'attente'` (le contenu a changé, le délai court), `'fabrique'`,
   * `'echec'` ou `'occupe'`.
   */
  async function passer() {
    if (!edition || ferme) return 'inactif';
    // l'extrait d'avant le dépôt de root, sous db/ : retiré (rien de ce qu'il porte n'est plus lu)
    if (existsSync(ancien)) rmSync(ancien, { recursive: true, force: true });
    if (!rapports || !depot) return 'inactif';
    try {
      noterLesRapports();
    } catch {
      // un dossier de rapports illisible ne gêne pas l'extrait
    }
    if (!lireInstallation() || !lireLeKit()) {
      // atelier retiré (installe.json ou kit.json disparu alors que le dossier des rapports est bien monté) : l'extrait n'a plus d'usage
      if (existsSync(rapports) && existsSync(racine)) for (const nom of readdirSync(racine)) if (/^\.?contenu[-.]/.test(nom)) rmSync(join(racine, nom), { recursive: true, force: true });
      return 'inactif';
    }
    if (enCours) return 'occupe';
    const actuelle = cleActuelle();
    if (!actuelle) return 'inactif';
    const stocke = lireLeContenu();
    const present = existsSync(join(racine, nomDeLExtrait(actuelle.version)));
    if (stocke?.cle === actuelle.cle && present) { vue = null; return 'a_jour'; }
    if (stocke?.version === actuelle.version && present) {
      // la même version, un contenu qui a changé : après le délai
      if (vue?.cle !== actuelle.cle) vue = { cle: actuelle.cle, le: horloge() };
      if (horloge() - vue.le < delai) return 'attente';
    }
    enCours = fabriquerLExtrait(actuelle).finally(() => { enCours = null; });
    const meta = await enCours;
    vue = null;
    return meta ? 'fabrique' : 'echec';
  }

  /** L'état à rendre (`maverick-atelier-etat/1`). */
  function lire() {
    const v = versionInstallee();
    const etat = (nom, message, plus = {}) => ({
      format: FORMAT_ETAT_DE_L_ATELIER, etat: nom, message, version_installee: version(v), kit: null, installe: null, extrait: null, en_cours: null, dernier: null, historique: [], resume: null, ...plus,
    });
    if (!edition) return etat('pas_d_atelier', 'L’atelier n’existe que sur le site de dev.');
    // avant le geste du propriétaire, rien n'est monté (le montage vient de docker-compose.override.yml, écrit par atelier/installer.sh) : le kit, lui, n'est pas visible d'ici
    if (!rapports || !existsSync(rapports)) return etat('non_installe', 'Atelier non installé : le dossier des rapports n’est pas monté dans le service (le geste du propriétaire, « sudo sh /srv/maverick-center-test/atelier/installer.sh », l’ajoute ; le kit n’est pas visible d’ici).');
    const kit = lireLeKit();
    if (!kit) return etat('pas_d_atelier', 'Pas d’atelier : aucun kit n’est posé (installation sans kit, ou place manquante au moment de la pose).');
    const installe = lireInstallation();
    if (!installe) return etat('non_installe', 'Atelier non installé : le kit est posé ; le propriétaire l’active par « sudo sh /srv/maverick-center-test/atelier/installer.sh » (deploy/vps/README.md, « Atelier du site de dev »).', { kit });
    const contenu = depot ? lireLeContenu() : null;
    let aJour = null;
    try {
      const a = cleActuelle();
      aJour = a && contenu ? contenu.cle === a.cle && existsSync(join(racine, nomDeLExtrait(a.version))) : false;
    } catch {
      aJour = null;
    }
    const extrait = contenu ? { version: contenu.version, fabrique_le: contenu.fabrique_le, octets: contenu.octets, duree_ms: contenu.duree_ms, a_jour: aJour } : null;
    const ids = listerLesRapports(rapports);
    const historique = [];
    let dernier = null;
    for (const id of ids) {
      let r = null;
      if (resumes.has(id) && id !== ids[0]) { historique.push(resumes.get(id)); continue; }
      r = lireUnRapport(rapports, id);
      if (!r) continue;
      if (!dernier) dernier = r;
      const resume = resumerUnRapport(r);
      resumes.set(id, resume);
      historique.push(resume);
    }
    if (resumes.size > 200) resumes.clear();
    const enCoursDeRoot = validerLEnCours(lireUnJsonBorne(join(rapports, 'en-cours.json'), PLAFOND_DES_FICHIERS.enCours));
    const plus = { kit, installe, extrait, en_cours: enCoursDeRoot, dernier, historique, resume: dernier ? jugerLeServeur(dernier).phrase : null };
    if (enCoursDeRoot) return etat('en_cours', `Fabrication en cours (version ${enCoursDeRoot.version_installee ?? '?'}, depuis ${enCoursDeRoot.debut ?? '?'}).`, plus);
    if (!dernier) return etat('en_attente', 'En attente de la première fabrication.', plus);
    if (version(v) && dernier.version_installee !== version(v)) return etat('en_attente', `En attente de la fabrication de la version ${v} (la dernière mesurée est celle de la version ${dernier.version_installee ?? '?'}).`, plus);
    return etat('rapport', jugerLeServeur(dernier).phrase, plus);
  }

  function demarrer() {
    if (!edition || !rapports || !depot || intervalle <= 0 || minuteur) return;
    const tourner = () => { passer().catch((e) => journal(`ERREUR atelier : ${String(e.message).slice(0, 200)}`, { categorie: 'service' })); };
    setTimeout(tourner, 5000).unref();
    minuteur = setInterval(tourner, intervalle);
    minuteur.unref();
  }

  async function arreter() {
    ferme = true;
    if (minuteur) clearInterval(minuteur);
    minuteur = null;
    try { await enCours; } catch { /* déjà noté */ }
  }

  return { lire, passer, demarrer, arreter, dossierDeLExtrait: depot };
}

