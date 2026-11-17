// La base source (lot 8 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/serveur.md, « Base source (lot 8) » ; plan :
// docs/chantier-base-de-dev.md, garde-fous 5 et 6). Le marqueur est un FICHIER, `source`, dans le dossier de la base vivante (jamais un réglage) : rien ne le
// pose hors de deploy/installateur/bascule.sh, que le propriétaire lance le jour de la bascule. Avec lui :
//   - la base vivante n'est JAMAIS refaite depuis les règles (ni au démarrage, ni quand le fichier des règles change) : ni rejeu du journal, ni archive de
//     reconstruction, ni essai dans l'ombre ; absente, le service ne démarre pas (elle se restaure depuis une sauvegarde, jamais depuis le dépôt) ;
//   - au démarrage, avant d'accepter une écriture, les migrations livrées de numéro > user_version sont essayées sur une copie (essayerSurUneCopie), puis
//     appliquées sur place (appliquerSurPlace, sauvegarde d'abord) ; la structure obtenue est comparée au schema.sql livré. Un refus laisse la base intacte.
// Sans le marqueur, rien de ce module ne sert : le service fait comme avant (serveur/base-vivante.mjs#preparerBaseVivante).
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ARCHIVES_GARDEES, DOSSIER_ARCHIVES, FICHIER_BASE, ecrireEtat, lireEtat, ouvrirBaseVivante } from './base-vivante.mjs';
import { DOSSIER_DES_ESSAIS } from './essai-de-structure.mjs';
import { instant as ecrireInstant } from './instant.mjs';
import { ErreurStructure, appliquerSurPlace, ecartsAvecLeSchema, essayerSurUneCopie, lireLesMigrations, migrationsAAppliquer } from './structure-sur-place.mjs';

/** Le marqueur de la base source, dans le dossier de la base vivante. */
export const FICHIER_SOURCE = 'source';
/** Les sauvegardes d'avant une application sur place (`structure-<instant>-v<version>.db`), rangées avec les archives ; les plus anciennes au-delà de ce nombre sont retirées. */
export const SAUVEGARDES_GARDEES = ARCHIVES_GARDEES;

/** Vrai quand la base vivante de `dossier` est la source (le fichier `source` existe, quel que soit son contenu). */
export const estUneBaseSource = (dossier) => existsSync(join(dossier, FICHIER_SOURCE));

/** Un refus de la base source : `etape` (`absente`, `non_livrees`, `essai`, `application`, `schema`), `details` (lignes de détail, jamais un texte de contenu). */
export class ErreurBaseSource extends Error {
  constructor(message, { etape, details = [], refus = null } = {}) {
    super(message);
    this.name = 'ErreurBaseSource';
    this.etape = etape;
    this.details = details;
    this.refus = refus;
  }
}

/** Le message d'une base source absente (garde-fou 6) : elle se restaure, elle ne se refait pas. */
export const messageBaseAbsente = (chemin) => `base source absente : ${chemin}, la restaurer depuis une sauvegarde, jamais depuis le dépôt`;

/** Retire les sauvegardes d'avant une application sur place au-delà des SAUVEGARDES_GARDEES plus récentes (l'ordre des noms est l'ordre chronologique). */
function purgerLesSauvegardes(dossier) {
  if (!existsSync(dossier)) return;
  const toutes = readdirSync(dossier).filter((f) => /^structure-.+\.db$/.test(f)).sort();
  for (const f of toutes.slice(0, -SAUVEGARDES_GARDEES)) rmSync(join(dossier, f), { force: true });
}

/** La version (user_version) d'une base, lue en lecture seule. */
function versionDuFichier(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return db.prepare('PRAGMA user_version').get().user_version;
  } finally {
    db.close();
  }
}

/**
 * Prépare la base source de `dossier` avant que le service l'ouvre : rien n'est jamais refait depuis les règles. Lève une ErreurBaseSource (la base reste
 * telle qu'elle était : le ROLLBACK d'appliquerSurPlace) quand la base manque, quand les migrations ou le schema.sql ne sont pas livrés, quand l'essai sur une
 * copie refuse les migrations, quand leur application échoue, ou quand la structure obtenue n'est pas celle du schema.sql livré. Écrit vivante.json
 * (`version`, `source: true`, et `sur_place` : la dernière application, gardée tant qu'aucune autre n'a lieu).
 * @param {{ dossier: string, version?: string | null, migrations?: string | null, schema?: string | null, instant?: Date }} o `migrations` et `schema` :
 *   chemins (undefined : ceux de la livraison, _serveur/data/) ; `version` : celle du service
 * @returns {{ chemin: string, avant: number, apres: number, appliquees: { numero: number, fichier: string }[], sauvegarde: string | null, essai_ms: number | null, duree_ms: number }}
 */
export function preparerBaseSource({ dossier, version = null, migrations, schema, instant = new Date() }) {
  const t0 = performance.now();
  const chemin = join(dossier, FICHIER_BASE);
  if (!existsSync(chemin)) throw new ErreurBaseSource(messageBaseAbsente(chemin), { etape: 'absente' });
  const livre = lireLesMigrations({ migrations, schema });
  if (!livre || livre.schema === null) {
    throw new ErreurBaseSource(`base source : ${livre ? 'le schema.sql attendu' : 'les migrations'} ne sont pas livrés avec le service, sa structure ne peut pas être vérifiée`, { etape: 'non_livrees' });
  }
  const avant = versionDuFichier(chemin);
  const aFaire = migrationsAAppliquer(livre.migrations, avant);
  let resultat = { avant, apres: avant, appliquees: [], sauvegarde: null, essai_ms: null };
  if (aFaire.length) {
    // 1. l'essai sur une copie de la vraie base (ouverte en lecture seule ; les copies sont toujours effacées)
    const essai = essayerSurUneCopie({ source: chemin, dossier: join(dossier, DOSSIER_DES_ESSAIS), migrations: livre.dossier, schema, instant: ecrireInstant(instant), version });
    if (essai.verdict !== 'accepte') {
      const raison = essai.refus?.raison ?? essai.raison ?? essai.verdict;
      throw new ErreurBaseSource(`base source : l’essai des migrations sur une copie est « ${essai.verdict} » (${raison}) ; rien n’est appliqué`, { etape: 'essai', refus: essai.refus ?? null, details: essai.refus?.details ?? [] });
    }
    // 2. l'application sur place, sauvegarde d'abord, d'un seul bloc
    const db = ouvrirBaseVivante(chemin);
    try {
      const r = appliquerSurPlace(db, { migrations: livre.migrations, schema: livre.schema, sauvegarde: { dossier: join(dossier, DOSSIER_ARCHIVES) }, instant, version });
      resultat = { avant: r.avant, apres: r.apres, appliquees: r.appliquees.map(({ numero, fichier }) => ({ numero, fichier })), sauvegarde: r.sauvegarde, essai_ms: essai.duree_ms ?? null };
    } catch (e) {
      // une boucle de redémarrages (Docker relance un service refusé) ne remplit pas le disque de sauvegardes : les 5 plus récentes seulement
      purgerLesSauvegardes(join(dossier, DOSSIER_ARCHIVES));
      if (!(e instanceof ErreurStructure)) throw e;
      throw new ErreurBaseSource(`base source : les migrations n’ont pas pu être appliquées sur place (${e.message}) ; la base est laissée telle qu’elle était`, { etape: 'application', refus: e.enJson(), details: e.details ?? [] });
    } finally {
      db.close();
    }
    purgerLesSauvegardes(join(dossier, DOSSIER_ARCHIVES));
  }
  // 3. la structure, migrée ou non, est celle du schema.sql livré
  const lecture = new DatabaseSync(chemin, { readOnly: true });
  let ecarts;
  try {
    ecarts = ecartsAvecLeSchema(lecture, livre.schema);
  } catch (e) {
    throw new ErreurBaseSource(`base source : ${e.message}`, { etape: 'schema' });
  } finally {
    lecture.close();
  }
  if (ecarts.length) {
    throw new ErreurBaseSource(`base source : sa structure n’est pas celle du schema.sql livré (${ecarts.length} écart(s)) ; le service ne l’ouvre pas`, { etape: 'schema', details: ecarts.slice(0, 20) });
  }
  const duree = Math.round(performance.now() - t0);
  const etat = lireEtat(dossier) ?? {};
  const surPlace = resultat.appliquees.length
    ? { le: ecrireInstant(instant), avant: resultat.avant, apres: resultat.apres, migrations: resultat.appliquees, sauvegarde: resultat.sauvegarde ? basename(resultat.sauvegarde) : null, essai_ms: resultat.essai_ms, duree_ms: duree }
    : (etat.sur_place ?? null);
  ecrireEtat(dossier, { ...etat, ...(version ? { version } : {}), schema: resultat.apres, source: true, ...(surPlace ? { sur_place: surPlace } : {}) });
  return { chemin, ...resultat, duree_ms: duree };
}

/** Ce que disent `/api/etat` et la page Debug de la base source : { source, sur_place } (`sur_place` : la dernière application sur place, null sinon). */
export function etatDeLaBaseSource(dossier) {
  const etat = lireEtat(dossier);
  return { source: estUneBaseSource(dossier), sur_place: etat?.sur_place ?? null };
}
