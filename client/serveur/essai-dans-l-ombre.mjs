// L'essai dans l'ombre (lot 7 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/serveur.md, « Essai dans l'ombre »).
// À chaque INSTALLATION du site de dev, la base est toujours refaite depuis les règles, puis le journal est rejoué (le circuit ne change pas). Pendant ce temps,
// le service garde deux copies : la base d'AVANT la reconstruction et la base REFAITE. Une fois ouvert, il applique à la première les migrations livrées (la base
// « migrée sur place », `appliquerSurPlace`) et la compare à la seconde, table par table. Le rapport s'affiche sur la page Debug (GET /api/debug/structure/).
// Il prouve, sur les vraies données du site de dev, que migrer la base sur place donne la bonne base : c'est ce que le lot 8 mettra en service.
//
//   db/essai-de-structure/ombre.json                          le dernier rapport (format 'maverick-ombre/1'), écrit d'un coup (fichier provisoire, puis renommé)
//   db/essai-de-structure/structure-essai-*-ombre-avant.db    la base d'avant la reconstruction (VACUUM INTO), migrée EN PLACE par l'essai
//   db/essai-de-structure/structure-essai-*-ombre-apres.db    la base refaite (copie du fichier juste avant qu'il remplace la vraie base)
// Les copies sont TOUJOURS effacées (à la fin de l'essai, même en échec ; à l'ouverture du service : serveur/structure-sur-place.mjs#purgerLesEssaisDeStructure).
// RIEN n'est écrit dans la vraie base : l'essai ne la connaît pas, il ne voit que ses copies. Il tourne dans un fil à part, un essai à la fois avec l'essai d'avant
// installation (la même file), après l'ouverture du service ; un essai qui échoue n'arrête ni le site ni l'installation, il le dit sur la page Debug.
//
// Quand : sur le site de dev seulement, quand `preparerBaseVivante` refait une base qui existait ET que la version du site ou celle de la base a changé — une
// installation, pas une simple relance (`uneInstallation`). Le service importe seulement des modules de Node, de serveur/ et de src/lib/tables-de-la-base.mjs (le classement des tables, pur).
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CLASSES_DE_TABLES, classeDeLaTable } from '../src/lib/tables-de-la-base.mjs';
import { DOSSIER_DES_ESSAIS, MARGE_D_ESPACE } from './essai-de-structure.mjs';
import { instant as ecrireInstant } from './instant.mjs';
import {
  ErreurStructure, appliquerSurPlace, bilanDesTables, comparerLesSchemas, executerEnArrierePlan, lireLesMigrations, migrationsAAppliquer,
} from './structure-sur-place.mjs';

export const FORMAT_DE_L_OMBRE = 'maverick-ombre/1';
export const FICHIER_DE_L_OMBRE = 'ombre.json';
/** Du moins au plus grave : `identique` (aucun écart) ; `attendu` (que du contenu livré par le dépôt, du calculé ou de l'inconnu) ; `ecart` ; `refuse` ; `indisponible`. */
export const VERDICTS_DE_L_OMBRE = Object.freeze(['identique', 'attendu', 'ecart', 'refuse', 'indisponible']);

/** Les catégories d'une table qui diffère entre la base migrée sur place et la base refaite. */
export const CATEGORIES_DE_L_OMBRE = Object.freeze({
  STRUCTURE: 'structure',
  LIVRE_PAR_LE_DEPOT: 'livre_par_le_depot',
  INCONNU: 'inconnu',
  PROPRE_AU_SITE: 'propre_au_site',
  INATTENDU: 'inattendu',
  CALCULEE: 'calculee',
  IGNOREE: 'ignoree',
});
/** La gravité de chaque catégorie : `grave` (le verdict est `ecart`), `attendu` (jusqu'au lot 8 : le contenu arrive par le dépôt), `ignore` (compté, jamais jugé). */
export const GRAVITE_DES_CATEGORIES = Object.freeze({
  structure: 'grave', propre_au_site: 'grave', inattendu: 'grave', livre_par_le_depot: 'attendu', inconnu: 'attendu', calculee: 'ignore', ignoree: 'ignore',
});
/** Les tables que l'essai ne juge pas, et pourquoi (dit dans le rapport). */
export const TABLES_IGNOREES = Object.freeze({
  migration_recue: 'le mode des migrations notées diffère par construction : « reconstruction » pour la base refaite, « sur_place » pour la base migrée',
});

const EFFACER = ['', '-wal', '-shm', '-journal'];
const effacerLesCopies = (...chemins) => { for (const chemin of chemins) if (chemin) for (const suffixe of EFFACER) rmSync(`${chemin}${suffixe}`, { force: true }); };
const versionDeLaBase = (db) => db.prepare('PRAGMA user_version').get().user_version;
const connue = (version) => typeof version === 'string' && version !== '' && version !== 'inconnue';
const une = (texte, n = 300) => String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

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

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le jugement : de quelle catégorie est chaque table qui diffère
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * La catégorie d'une table qui diffère entre la base migrée sur place et la base refaite.
 *   - `structure` : colonnes (ou leur ordre) différentes ;
 *   - une table ignorée (`TABLES_IGNOREES`) : `ignoree` ;
 *   - classe « contenu » (lib/tables-de-la-base.mjs) : `livre_par_le_depot` quand ses règles ont changé entre la version d'avant et la nouvelle (le dépôt la livre : ce
 *     que le lot 8 supprimera) ; `inconnu` faute d'empreintes d'avant ; `inattendu` quand ses règles n'ont PAS changé et que la table diffère quand même ;
 *   - classe « propre au site » (fiches, comptes, groupes, journal) : `propre_au_site`, elle doit être identique ;
 *   - classe « calculée » : `calculee`, jamais jugée ; une table que le classement ne connaît pas : `inattendu`.
 * @param {string} table
 * @param {{ structure?: boolean, reglesAvant?: Record<string, string> | null, reglesApres?: Record<string, string> | null }} o `reglesAvant` et `reglesApres` :
 *   { table de contenu → empreinte } des règles (vivante.json, `tables_regles`)
 * @returns {{ categorie: string, classe: string | null, raison: string | null }}
 */
export function categorieDeLaTable(table, { structure = false, reglesAvant = null, reglesApres = null } = {}) {
  const classe = classeDeLaTable(table);
  if (structure) return { categorie: CATEGORIES_DE_L_OMBRE.STRUCTURE, classe, raison: 'colonnes (ou leur ordre) différentes' };
  if (Object.hasOwn(TABLES_IGNOREES, table)) return { categorie: CATEGORIES_DE_L_OMBRE.IGNOREE, classe, raison: TABLES_IGNOREES[table] };
  if (classe === CLASSES_DE_TABLES.CONTENU) {
    if (!reglesAvant || !reglesApres) {
      return { categorie: CATEGORIES_DE_L_OMBRE.INCONNU, classe, raison: 'les empreintes des règles d’avant ne sont pas gardées (première installation avec cet essai) : on ne sait pas si le dépôt a changé cette table' };
    }
    if (reglesAvant[table] !== reglesApres[table]) return { categorie: CATEGORIES_DE_L_OMBRE.LIVRE_PAR_LE_DEPOT, classe, raison: 'les règles de cette table ont changé dans la livraison (le contenu arrive par le dépôt)' };
    return { categorie: CATEGORIES_DE_L_OMBRE.INATTENDU, classe, raison: 'les règles de cette table n’ont pas changé, et la base migrée diffère pourtant de la base refaite' };
  }
  if (classe === CLASSES_DE_TABLES.PROPRE_AU_SITE) return { categorie: CATEGORIES_DE_L_OMBRE.PROPRE_AU_SITE, classe, raison: 'fiches, comptes, groupes, journal : la migration sur place doit les garder tels quels' };
  if (classe === CLASSES_DE_TABLES.CALCULEE) return { categorie: CATEGORIES_DE_L_OMBRE.CALCULEE, classe, raison: 'table calculée par le build : ignorée' };
  return { categorie: CATEGORIES_DE_L_OMBRE.INATTENDU, classe: null, raison: 'table que le classement (lib/tables-de-la-base.mjs) ne connaît pas' };
}

const ORDRE_DE_GRAVITE = { grave: 0, attendu: 1, ignore: 2 };

/**
 * Les tables qui diffèrent, jugées : `bilan` est celui de `bilanDesTables` (état `migree` attaché, état `main` : la base refaite). `ajoutees` : lignes de la base
 * refaite que la migrée n'a pas ; `retirees` : lignes de la migrée que la refaite n'a pas ; `modifiees` : même clé primaire, autres valeurs.
 */
export function jugerLesTables(bilan, { reglesAvant = null, reglesApres = null } = {}) {
  const entrees = [];
  const ajouter = (table, { structure = false, ajoutees = 0, retirees = 0, modifiees = 0, raison = null } = {}) => {
    const c = categorieDeLaTable(table, { structure, reglesAvant, reglesApres });
    entrees.push({ table, classe: c.classe, categorie: c.categorie, gravite: GRAVITE_DES_CATEGORIES[c.categorie], ajoutees, retirees, modifiees, raison: raison ?? c.raison });
  };
  for (const c of bilan.tables.creees) ajouter(c.table, { structure: true, ajoutees: c.lignes, raison: 'table absente de la base migrée' });
  for (const r of bilan.tables.retirees) ajouter(r.table, { structure: true, retirees: r.lignes, raison: 'table absente de la base refaite' });
  for (const r of bilan.tables.renommees) ajouter(r.vers, { structure: true, raison: `même contenu que « ${r.de} » de la base migrée, sous un autre nom` });
  for (const [table, t] of Object.entries(bilan.tables.modifiees)) {
    ajouter(table, { structure: t.structure_changee || t.colonnes_ajoutees.length > 0 || t.colonnes_retirees.length > 0, ajoutees: t.ajoutees, retirees: t.retirees, modifiees: t.modifiees });
  }
  return entrees.sort((a, b) => ORDRE_DE_GRAVITE[a.gravite] - ORDRE_DE_GRAVITE[b.gravite] || (a.table < b.table ? -1 : a.table > b.table ? 1 : 0));
}

/** Le résumé chiffré d'une comparaison : tables comparées, identiques, différentes, et par catégorie le nombre de tables et de lignes ajoutées, retirées, modifiées. */
export function chiffresDeLOmbre(bilan, entrees) {
  const par_categorie = {};
  for (const e of entrees) {
    const c = par_categorie[e.categorie] ??= { tables: 0, ajoutees: 0, retirees: 0, modifiees: 0 };
    c.tables += 1;
    c.ajoutees += e.ajoutees;
    c.retirees += e.retirees;
    c.modifiees += e.modifiees;
  }
  const t = bilan.tables;
  return {
    tables_comparees: t.inchangees.length + Object.keys(t.modifiees).length + t.creees.length + t.retirees.length + t.renommees.length,
    tables_identiques: t.inchangees.length,
    tables_differentes: entrees.length,
    par_categorie,
  };
}

/** Le verdict : `ecart` (un écart grave, ou un schéma différent), `attendu` (seulement du contenu livré par le dépôt, inconnu ou calculé), sinon `identique` (les tables ignorées ne comptent pas). */
export function verdictDeLOmbre(entrees, ecartsDeStructure) {
  if (ecartsDeStructure.length || entrees.some((e) => e.gravite === 'grave')) return 'ecart';
  if (entrees.some((e) => e.gravite === 'attendu' || e.categorie === CATEGORIES_DE_L_OMBRE.CALCULEE)) return 'attendu';
  return 'identique';
}

/** Une phrase pour le journal et la page Debug : jamais un nom de fiche ni une valeur du contenu. */
export function resumeDeLOmbre(rapport) {
  switch (rapport.verdict) {
    case 'identique':
      return `identique : la base migrée sur place est celle que le circuit actuel refait (${rapport.chiffres?.tables_comparees ?? 0} tables comparées, aucune différence)`;
    case 'attendu': {
      const p = rapport.chiffres?.par_categorie ?? {};
      const morceaux = [['livre_par_le_depot', 'livrée(s) par le dépôt'], ['inconnu', 'à origine inconnue'], ['calculee', 'calculée(s)']]
        .filter(([c]) => p[c]).map(([c, texte]) => `${p[c].tables} ${texte}`);
      return `attendu : seulement du contenu que le dépôt livre (${morceaux.join(', ')}) sur ${rapport.chiffres?.tables_comparees ?? 0} tables comparées`;
    }
    case 'ecart': {
      const grave = (rapport.tables ?? []).filter((t) => t.gravite === 'grave');
      const n = (c) => grave.filter((t) => t.categorie === c).length;
      const morceaux = [`${rapport.structure?.ecarts?.length ?? 0} écart(s) de schéma`, `${n('structure')} table(s) de structure différente`,
        `${n('propre_au_site')} table(s) propre(s) au site différente(s)`, `${n('inattendu')} table(s) inattendue(s)`].filter((m) => !/^0 /.test(m));
      return `écart : la base migrée sur place n’est pas celle que le circuit actuel refait (${morceaux.join(', ')})`;
    }
    case 'refuse': {
      const r = rapport.refus ?? {};
      return une(`refusé : ${r.migration === null || r.migration === undefined ? 'la livraison' : `migration ${String(r.migration).padStart(4, '0')}`}, étape ${r.etape ?? '?'} : ${r.raison ?? ''}`);
    }
    default:
      return une(`indisponible : ${rapport.raison ?? 'essai impossible'}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La comparaison (dans un fil à part)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Compare la base migrée sur place à la base refaite, sur des COPIES : `avant` (la base d'avant la reconstruction) est migrée EN PLACE par `appliquerSurPlace`
 * (migrations et schema.sql livrés, sans sauvegarde), `apres` (la base refaite) n'est ouverte qu'en lecture seule. Les deux copies sont TOUJOURS effacées, même en
 * échec. Synchrone : le service l'appelle dans un fil à part (`creerOmbre`, `executerEnArrierePlan`). Ne rend jamais de nom de fiche ni de valeur du contenu.
 * @param {{ avant: string, apres: string, migrations?: string | null, schema?: string | null, reglesAvant?: Record<string, string> | null,
 *   reglesApres?: Record<string, string> | null, version?: string | null, instant?: string }} o `migrations` et `schema` : chemins (undefined : ceux de la livraison) ;
 *   `version` : celle du site qui s'installe (notée dans `migration_recue`) ; `instant` : ISO
 * @returns {object} le rapport (`format`, `verdict`, `resume`, `versions`, `migrations`, `structure`, `tables`, `chiffres`, `duree_ms`)
 */
export function comparerDansLOmbre({ avant, apres, migrations, schema, reglesAvant = null, reglesApres = null, version = null, instant = ecrireInstant() }) {
  const t0 = performance.now();
  const base = { format: FORMAT_DE_L_OMBRE };
  const fin = (rapport) => ({ ...rapport, resume: resumeDeLOmbre(rapport), duree_ms: Math.round(performance.now() - t0) });
  let migree = null;
  let refaite = null;
  let lecture = null;
  try {
    const livre = lireLesMigrations({ migrations, schema });
    if (!livre) return fin({ ...base, verdict: 'indisponible', raison: 'les migrations ne sont pas livrées avec le service' });
    if (livre.schema === null) return fin({ ...base, verdict: 'indisponible', raison: 'le schema.sql attendu n’est pas livré avec le service' });
    migree = new DatabaseSync(avant);
    migree.exec('PRAGMA foreign_keys = ON');
    const versionAvant = versionDeLaBase(migree);
    const aFaire = migrationsAAppliquer(livre.migrations, versionAvant);
    const essayees = aFaire.map(({ numero, fichier }) => ({ numero, fichier }));
    if (aFaire.length) {
      try {
        appliquerSurPlace(migree, { migrations: livre.migrations, schema: livre.schema, sauvegarde: false, instant: new Date(instant), version });
      } catch (e) {
        if (!(e instanceof ErreurStructure)) throw e;
        return fin({ ...base, verdict: 'refuse', versions: { avant: versionAvant, migree: versionAvant }, migrations: essayees, refus: e.enJson(), retour_arriere: versionDeLaBase(migree) === versionAvant });
      }
    }
    const versionMigree = versionDeLaBase(migree);
    migree.close();
    migree = null;

    // la base refaite est la base principale, la migrée lui est attachée : le bilan dit ce que la refaite a de plus (`ajoutees`) ou de moins (`retirees`) que la migrée
    refaite = new DatabaseSync(apres, { readOnly: true });
    refaite.prepare('ATTACH DATABASE ? AS migree').run(avant);
    lecture = new DatabaseSync(avant, { readOnly: true });
    const versionRefaite = versionDeLaBase(refaite);
    const ecarts = comparerLesSchemas(lecture, refaite).map((e) => une(e, 500)).slice(0, 20);
    if (versionMigree !== versionRefaite) ecarts.unshift(`version de la base : ${versionMigree} pour la base migrée, ${versionRefaite} pour la base refaite`);
    const bilan = bilanDesTables(refaite, { avant: 'migree', apres: 'main' });
    const tables = jugerLesTables(bilan, { reglesAvant, reglesApres });
    return fin({
      ...base,
      verdict: verdictDeLOmbre(tables, ecarts),
      versions: { avant: versionAvant, migree: versionMigree, refaite: versionRefaite },
      migrations: essayees,
      regles_d_avant: reglesAvant && reglesApres ? 'connues' : 'inconnues',
      structure: { identique: ecarts.length === 0, ecarts },
      tables,
      chiffres: chiffresDeLOmbre(bilan, tables),
    });
  } finally {
    for (const db of [lecture, refaite, migree]) {
      try {
        db?.close();
      } catch {
        // déjà fermée
      }
    }
    effacerLesCopies(avant, apres);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le suivi dans le service
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Une installation : la version du site qui fait tourner la base a changé, ou la version de la base (`user_version`). Une simple relance (mêmes versions) n'en est pas une ;
 * une version inconnue (« inconnue » dans vivante.json) ne permet pas de conclure sur elle.
 */
export function uneInstallation({ versionAvant = null, versionApres = null, schemaAvant = null, schemaApres = null } = {}) {
  if (connue(versionAvant) && connue(versionApres) && versionAvant !== versionApres) return true;
  return Number.isInteger(schemaAvant) && Number.isInteger(schemaApres) && schemaAvant !== schemaApres;
}

/**
 * Le suivi de l'essai dans l'ombre d'une instance (site de dev).
 * @param {object} o
 * @param {string} o.dossier db/ de l'instance (le dossier de la base vivante)
 * @param {string} [o.instance] « dev » (noté dans le rapport)
 * @param {(message: string, options?: object) => void} [o.journal]
 * @param {(type: string, o?: object) => void} [o.evenement] évènement des métriques (`structure_ombre`)
 * @param {typeof executerEnArrierePlan} [o.executer] le fil de travail (un faux dans les tests)
 * @param {(dossier: string) => number} [o.espaceLibre] octets libres (par défaut statfs)
 * @param {() => string} [o.maintenant]
 * @param {string | null} [o.migrations] les migrations livrées (undefined : celles de la livraison) ; `schema` : le schema.sql attendu (tests)
 */
export function creerOmbre({ dossier, instance = null, journal = () => {}, evenement = () => {}, executer = executerEnArrierePlan, espaceLibre = null,
  maintenant = ecrireInstant, migrations = undefined, schema = undefined }) {
  const racine = join(dossier, DOSSIER_DES_ESSAIS);
  let enAttente = null; // les copies faites par la reconstruction, avant le lancement
  let enCours = null;
  let suite = Promise.resolve();
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

  /** Efface les copies gardées et oublie l'essai en attente. */
  function annuler() {
    if (enAttente) effacerLesCopies(enAttente.avant, enAttente.apres);
    enAttente = null;
    if (enCours?.etat === 'en_attente') enCours = null;
  }

  /**
   * Appelée par `preparerBaseVivante` juste avant que la base refaite remplace l'ancienne : si c'est une installation, garde les deux copies (la base d'avant : VACUUM INTO,
   * cohérente ; la base refaite : copie du fichier neuf, fermé). Jamais d'exception vers la reconstruction : un échec est un essai « indisponible », dit sur la page Debug.
   * @returns {{ programme: boolean, raison?: string }}
   */
  function preparer({ ancienne, neuve, etat = null, version = null, schema: schemaApres = null, reglesApres = null }) {
    if (ferme) return { programme: false, raison: 'service arrêté' };
    const meta = {
      version: { avant: connue(etat?.version) ? etat.version : null, apres: connue(version) ? version : null },
      schema: { avant: Number.isInteger(etat?.schema) ? etat.schema : null, apres: Number.isInteger(schemaApres) ? schemaApres : null },
      reglesAvant: etat?.tables_regles && typeof etat.tables_regles === 'object' ? etat.tables_regles : null,
      reglesApres: reglesApres ?? null,
    };
    if (!uneInstallation({ versionAvant: etat?.version, versionApres: version, schemaAvant: etat?.schema, schemaApres })) return { programme: false, raison: 'relance' };
    annuler();
    const depuis = maintenant();
    let avant = null;
    let apres = null;
    try {
      mkdirSync(racine, { recursive: true });
      const besoin = 3 * (taille(ancienne) + taille(`${ancienne}-wal`)) + MARGE_D_ESPACE;
      const dispo = libre(racine);
      if (dispo < besoin) {
        enAttente = { ...meta, depuis, indisponible: `espace disque insuffisant pour deux copies de la base (${Math.floor(dispo / 1048576)} Mio libres, ${Math.ceil(besoin / 1048576)} Mio nécessaires)` };
      } else {
        const nom = join(racine, `structure-essai-${process.pid}-${randomUUID()}-ombre`);
        avant = `${nom}-avant.db`;
        apres = `${nom}-apres.db`;
        const lecture = new DatabaseSync(ancienne, { readOnly: true });
        try {
          lecture.prepare('VACUUM INTO ?').run(avant);
        } finally {
          lecture.close();
        }
        copyFileSync(neuve, apres);
        enAttente = { ...meta, depuis, avant, apres };
      }
    } catch (e) {
      effacerLesCopies(avant, apres);
      enAttente = { ...meta, depuis, indisponible: `les copies de la base n’ont pas pu être faites : ${une(e?.message ?? e, 200)}` };
    }
    enCours = { version: meta.version.apres, depuis, etat: 'en_attente' };
    return { programme: true };
  }

  async function executerUn(p) {
    const t0 = performance.now();
    enCours = { version: p.version.apres, depuis: p.depuis, etat: 'en_cours' };
    let rapport;
    try {
      rapport = p.indisponible
        ? { format: FORMAT_DE_L_OMBRE, verdict: 'indisponible', raison: p.indisponible, duree_ms: 0 }
        : await executer('maverickEssaiDansLOmbre', {
          avant: p.avant, apres: p.apres, migrations, schema, reglesAvant: p.reglesAvant, reglesApres: p.reglesApres, version: p.version.apres, instant: maintenant(),
        });
    } catch (e) {
      rapport = { format: FORMAT_DE_L_OMBRE, verdict: 'indisponible', raison: `l’essai n’a pas pu se faire : ${une(e?.message ?? e, 200)}`, duree_ms: Math.round(performance.now() - t0) };
    } finally {
      effacerLesCopies(p.avant, p.apres); // le fil les efface ; s'il est mort avant, c'est ici
    }
    if (!rapport.resume) rapport = { ...rapport, resume: resumeDeLOmbre(rapport) };
    const resultat = { ...rapport, fait_le: maintenant(), instance, version: p.version, schema: p.schema };
    enCours = null;
    try {
      mkdirSync(racine, { recursive: true });
      ecrireJson(join(racine, FICHIER_DE_L_OMBRE), resultat);
    } catch (e) {
      journal(`ERREUR structure : le rapport de l’essai dans l’ombre n’a pas pu être gardé : ${e?.message ?? e}`, { categorie: 'base' });
    }
    const grave = ['ecart', 'refuse', 'indisponible'].includes(rapport.verdict);
    journal(`${grave ? 'ATTENTION ' : ''}structure : essai dans l’ombre de la livraison ${p.version.apres ?? '?'} (la base d’avant migrée sur place, comparée à la base refaite) : ${resultat.resume}`,
      { categorie: 'base', niveau: grave ? 'avertissement' : 'info' });
    const c = rapport.chiffres?.par_categorie ?? {};
    evenement('structure_ombre', {
      duree_ms: performance.now() - t0,
      detail: {
        verdict: rapport.verdict, version: p.version.apres, migrations: rapport.migrations?.length ?? 0, etape: rapport.refus?.etape ?? null,
        tables: rapport.chiffres?.tables_comparees ?? 0, differentes: rapport.chiffres?.tables_differentes ?? 0,
        graves: ['structure', 'propre_au_site', 'inattendu'].reduce((n, k) => n + (c[k]?.tables ?? 0), 0), livrees_par_le_depot: c.livre_par_le_depot?.tables ?? 0,
      },
    });
  }

  /**
   * Lance l'essai gardé par la reconstruction (rien s'il n'y en a pas) ; à appeler quand le service est ouvert. Une promesse, qui ne lève jamais : un essai qui échoue
   * le dit sur la page Debug, il n'arrête rien.
   */
  function demarrer() {
    if (!enAttente || ferme) return suite;
    const p = enAttente;
    enAttente = null;
    suite = suite.then(() => executerUn(p)).catch((e) => {
      enCours = null;
      journal(`ERREUR structure : essai dans l’ombre : ${e?.message ?? e}`, { categorie: 'base' });
    });
    return suite;
  }

  /** Ce que lit la page Debug : l'essai en attente ou en cours, le dernier rapport (null s'il n'y en a pas : relu du disque, il survit à un redémarrage). */
  const lire = () => ({ en_cours: enCours, dernier: lireJson(join(racine, FICHIER_DE_L_OMBRE)) });

  /** Plus aucun essai n'est pris ; celui en cours se termine, ses copies sont effacées. */
  function arreter() {
    ferme = true;
    annuler();
    return suite;
  }

  return { racine, preparer, annuler, demarrer, lire, arreter, enCours: () => enCours, enAttente: () => enAttente !== null };
}
