// Page « Mise à jour » côté service (site de dev seulement, comme l'édition : MAVERICK_EDITION=1 ; docs/serveur.md, « Mise à jour ») :
//   - la liste en préparation : les modifications des règles entre la base de PRODUCTION (référence : la base de master, livrée avec le site dans
//     site/donnees/reference.db) et la base de DEV (base vivante : règles de dev + modifications du site), calculée par lib/notes-de-version.mjs ;
//   - le brouillon de la note de version (champ libre des admins et case « Version majeure », table note_version_brouillon) ;
//   - « Effectuer la mise à jour » : le service FIGE un lot (journal des modifications en attente + champ libre), le range dans db/mise-a-jour/
//     avec son empreinte, puis déclenche le workflow GitHub .github/workflows/mise-a-jour.yml (workflow_dispatch : lot, empreinte, adresse du lot),
//     qui télécharge le lot, l'applique à data/rows, écrit la note de version, ouvre et fusionne la PR vers dev puis livre dev → master.
//     Le jeton du serveur ne sert QU'À déclencher et suivre ce workflow (permission Actions) ; tout le reste se fait côté GitHub.
// L'état du lancement est gardé dans db/mise-a-jour/etat.json : le service redémarre pendant le processus (nouvelle version livrée sur dev).
// Node seulement (node:…), sans dépendance.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { bilan, comparerBases, TABLES_LUES, versionDeLivraison } from '../src/lib/notes-de-version.mjs';
import { signature } from './base-vivante.mjs';
import { ErreurHttp, sha256 } from './partage.mjs';
import { journalExporte } from './edition-journal.mjs';

const DOSSIER_LOTS = 'mise-a-jour';
const FICHIER_LANCEMENT = 'etat.json';
/** Le mot à taper pour confirmer le lancement (la page le demande). */
export const CONFIRMATION = 'METTRE A JOUR';
/** Le workflow déclenché, sur la branche dev (sa branche par défaut : un workflow_dispatch n'existe que s'il y est). */
export const WORKFLOW = 'mise-a-jour.yml';
/** Suivi du run GitHub : pas plus souvent que ça (limite de l'API). */
export const INTERVALLE_SUIVI = 20_000;
/**
 * Au-delà, aucun run ne peut plus tourner (timeout-minutes: 120 du workflow, plus l'attente d'un runner) : un lancement resté « lancé » ou « en
 * cours » sans nouvelles (run introuvable, suivi en panne) peut alors être annulé, sinon ses boutons resteraient verrouillés pour toujours.
 */
export const DUREE_MAX_RUN = 3 * 3_600_000;

export class ErreurNotes extends ErreurHttp {}

/** Les tables de `noms` qui existent dans la base, lues entières : { tables: { nom: lignes[] } }. */
export function lireTables(db, noms = TABLES_LUES) {
  const existantes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name));
  const tables = {};
  for (const t of noms) if (existantes.has(t)) tables[t] = db.prepare(`SELECT * FROM "${t}"`).all().map((r) => ({ ...r }));
  return { tables };
}

/** La base de référence (production) et sa version : { disponible, chemin, version, commit } (reference.json à côté de la base). */
export function lireReference(chemin) {
  if (!chemin || !existsSync(chemin)) return { disponible: false, chemin: chemin ?? null, version: null, commit: null };
  let info = {};
  try {
    info = JSON.parse(readFileSync(chemin.replace(/\.db$/, '.json'), 'utf8'));
  } catch {
    // version inconnue : la liste reste calculable
  }
  return { disponible: true, chemin, version: info.version ?? null, commit: info.commit ?? null };
}

const cacheReference = new Map(); // chemin -> { cle, tables } : la référence ne change qu'avec une nouvelle version du site
function tablesDeReference(chemin) {
  const cle = signature(chemin);
  const deja = cacheReference.get(chemin);
  if (deja && deja.cle === cle) return deja.tables;
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    const tables = lireTables(db);
    cacheReference.set(chemin, { cle, tables });
    return tables;
  } finally {
    db.close();
  }
}

/** Le brouillon de la note (champ libre et case « Version majeure ») : { texte, modifie_le, lot, majeure }. */
function lireBrouillon(db) {
  const b = db.prepare('SELECT texte, modifie_le, lot, majeure FROM note_version_brouillon WHERE id = 1').get();
  return { texte: b?.texte ?? null, modifie_le: b?.modifie_le ?? null, lot: b?.lot ?? null, majeure: b?.majeure === 1 };
}

/** Enregistre le champ libre ; `avant` (le texte lu par la page) : refus 409 si quelqu'un l'a changé entre-temps. */
export function enregistrerBrouillon(db, { texte, avant }, { instant }) {
  if (texte !== null && typeof texte !== 'string') throw new ErreurNotes(400, 'Texte attendu.');
  if (typeof texte === 'string' && texte.length > 100_000) throw new ErreurNotes(400, 'Texte trop long (100 000 caractères au plus).');
  const actuel = lireBrouillon(db);
  if (actuel.lot) throw new ErreurNotes(409, 'Une mise à jour est en cours avec ce texte : il ne se modifie plus jusqu’à la prochaine version du site.');
  if (avant !== undefined && (avant ?? null) !== (actuel.texte ?? null)) {
    throw new ErreurNotes(409, 'Le texte a été modifié entre-temps par quelqu’un d’autre. Rechargez la page.', { brouillon: actuel });
  }
  const propre = typeof texte === 'string' ? texte.replace(/\r\n?/g, '\n').replace(/\s+$/, '') || null : null;
  db.prepare(`INSERT INTO note_version_brouillon (id, texte, modifie_le, lot) VALUES (1, ?, ?, NULL)
              ON CONFLICT (id) DO UPDATE SET texte = excluded.texte, modifie_le = excluded.modifie_le`).run(propre, instant);
  return lireBrouillon(db);
}

/**
 * La case « Version majeure » de la note en préparation (demande du propriétaire du 2026-10-22) : cochée, la prochaine mise à jour est la X+1.0, et
 * sa PR de livraison dev → master porte [V: X+1]. Elle ne déclenche rien (seul « Effectuer la mise à jour » livre) ; elle part avec le lot, comme
 * le champ libre, ne se change plus tant qu'il est figé, et se décoche quand la livraison de ce lot vide le brouillon (1 : cochée, NULL : décochée).
 */
export function enregistrerMajeure(db, { majeure } = {}) {
  if (typeof majeure !== 'boolean') throw new ErreurNotes(400, 'Valeur attendue pour « majeure » : true ou false.');
  if (lireBrouillon(db).lot) {
    throw new ErreurNotes(409, 'Une mise à jour est en cours : la version qu’elle livre ne se change plus jusqu’à la prochaine version du site.');
  }
  db.prepare(`INSERT INTO note_version_brouillon (id, texte, modifie_le, lot, majeure) VALUES (1, NULL, NULL, NULL, ?)
              ON CONFLICT (id) DO UPDATE SET majeure = excluded.majeure`).run(majeure ? 1 : null);
  return lireBrouillon(db);
}

/**
 * La note en préparation : référence (production), versions (la cible selon la case « Version majeure », et les deux possibles), lignes calculées
 * et leur bilan, brouillon.
 * @param {import('node:sqlite').DatabaseSync} db base vivante
 */
export function noteEnPreparation(db, { reference, versionDev }) {
  const ref = lireReference(reference);
  const brouillon = lireBrouillon(db);
  const versionMineure = versionDeLivraison(versionDev, ref.version);
  const versionMajeure = versionDeLivraison(versionDev, ref.version, { majeure: true });
  // modifications du site en attente : ce que le lot emporterait
  const enAttente = db.prepare("SELECT count(*) AS n FROM modification WHERE etat = 'en_attente'").get().n;
  const commun = {
    reference: ref, version_dev: versionDev, version_cible: brouillon.majeure ? versionMajeure : versionMineure, version_mineure: versionMineure,
    version_majeure: versionMajeure, en_attente: enAttente, brouillon,
  };
  if (!ref.disponible) return { ...commun, lignes: null, bilan: null };
  const lignes = comparerBases(tablesDeReference(ref.chemin), lireTables(db));
  return { ...commun, lignes, bilan: bilan(lignes) };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lancement de la mise à jour (lot figé + workflow GitHub)
// ---------------------------------------------------------------------------------------------------------------------------------------------
//
// États du lancement (db/mise-a-jour/etat.json) :
//   envoi        lot figé, déclenchement du workflow en cours           lance / en_cours   run déclenché / en cours sur GitHub
//   fusionne     le lot est dans dev (étape « Fusion dans dev » réussie, ou sa note est arrivée dans les règles), livraison master pas finie
//   termine      livré sur master (run réussi, ou la référence — master — porte la version de sa note)
//   echec        run en échec AVANT d'entrer dans dev : rien n'a été fusionné, le lancement peut être annulé
//   echec_livraison  run en échec APRÈS la fusion dans dev : le lot est dans dev, pas sur master ; on le reprend (Re-run sur GitHub, il reprend à
//                la livraison) ou on fusionne la PR de livraison à la main — une nouvelle mise à jour attend (le workflow la refuse : code 7)
//   erreur       déclenchement refusé par GitHub          manuel   aucun jeton : workflow à lancer à la main avec les valeurs de la page
//   annule       annulé par la page : son lot n'est plus servi (le workflow ne peut plus le télécharger)
//   simulation_reussie / simulation_echouee   fin d'une simulation : rien n'a été poussé, le lot n'est plus servi, le texte est libéré

const dossierLots = (dossier) => join(dossier, DOSSIER_LOTS);
const ID_LOT = /^[0-9a-f-]{36}$/;
/** Le nom des étapes du job « livrer » du workflow (le service les lit pour savoir si le lot est entré dans dev). */
export const JOB_LIVRER = 'livrer';
export const ETAPE_FUSION_DEV = 'Fusion dans dev';
/** États où un run peut encore changer quelque chose : le service le suit (une relance « Re-run » d'un échec est vue aussi). */
export const SUIVIS = ['lance', 'en_cours', 'fusionne', 'echec', 'echec_livraison'];
/** États qui empêchent un nouveau lancement (le lot occupe la place ou attend sa livraison). */
const OCCUPANTS = ['envoi', 'lance', 'en_cours', 'fusionne', 'echec_livraison'];
/** États dont le lot n'est plus servi au workflow. */
const LOT_RETIRE = ['annule', 'simulation_reussie', 'simulation_echouee'];
/** Délai minimal entre deux lancements, et au plus tant de lancements par 24 h (le bouton n'a pas d'authentification avant la 1.0). */
const DELAI_ENTRE_LANCEMENTS = 2 * 60_000;
export const LANCEMENTS_PAR_JOUR = 8;
/** Appels à GitHub : jamais sans délai (un réseau pendu ne doit pas bloquer le suivi). */
const DELAI_GITHUB = 30_000;

const versionNumerique = (v) => String(v ?? '').split('.').slice(0, 2).map((n) => Number.parseInt(n, 10) || 0);
/** La version `a` (X.Y ou X.Y.Z) est-elle au moins `b` (X.Y) ? */
export const auMoins = (a, b) => {
  const [x1, y1] = versionNumerique(a);
  const [x2, y2] = versionNumerique(b);
  return x1 > x2 || (x1 === x2 && y1 >= y2);
};

/** L'état du dernier lancement ({ lot, empreinte, lance_le, etat, run, erreur, … }), null s'il n'y en a jamais eu. */
export function lireLancement(dossier) {
  try {
    return JSON.parse(readFileSync(join(dossierLots(dossier), FICHIER_LANCEMENT), 'utf8'));
  } catch {
    return null;
  }
}

function ecrireLancement(dossier, etat) {
  mkdirSync(dossierLots(dossier), { recursive: true });
  const chemin = join(dossierLots(dossier), FICHIER_LANCEMENT);
  writeFileSync(`${chemin}.tmp`, `${JSON.stringify(etat, null, 2)}\n`);
  renameSync(`${chemin}.tmp`, chemin);
  return etat;
}

/**
 * Met à jour l'état du lancement SEULEMENT s'il porte toujours le lot `lot` et l'un des états `si` : un suivi en arrière-plan ou un déclenchement
 * qui revient après une annulation (ou après qu'un autre lot a pris la place) ne réécrit jamais un état plus récent. Rend l'état actuel.
 */
function modifierLancement(dossier, lot, si, changement) {
  const actuel = lireLancement(dossier);
  if (!actuel || actuel.lot !== lot || (si && !si.includes(actuel.etat))) return actuel;
  return ecrireLancement(dossier, { ...actuel, ...changement(actuel) });
}

/** Un run peut encore tourner pour ce lancement (le suivre, empêcher un autre lancement). */
export const enCours = (l) => Boolean(l) && ['envoi', 'lance', 'en_cours', 'fusionne'].includes(l.etat);

/** Le lancement est-il resté sans nouvelles plus longtemps qu'un run ne peut durer ? */
export const sansNouvelles = (l, instant) => Boolean(l?.lance_le) && Date.parse(instant) - Date.parse(l.lance_le) > DUREE_MAX_RUN;

/** Le lancement occupe-t-il encore la place (un nouveau lancement serait refusé) ? Au-delà de DUREE_MAX_RUN, plus rien ne bloque. */
export const occupe = (l, instant) => Boolean(l) && OCCUPANTS.includes(l.etat) && (l.etat === 'envoi' || !sansNouvelles(l, instant));

/** Le lancement peut-il être annulé depuis la page ? (même règle pour le service et la page : champ `liberable` des réponses) */
export function estLiberable(l, instant) {
  if (!l) return false;
  if (['envoi', 'manuel', 'erreur', 'echec'].includes(l.etat)) return true;
  // plus longtemps qu'un run ne peut durer : « lancé » / « en cours » sans nouvelles (plus aucun run ne tourne) ; ou un lot dans dev / livré dont la
  // version n'arrive pas sur ce site (ex. serveur de test resté sur la branche site après la 0.2.0) : le texte se libère
  return ['lance', 'en_cours', 'fusionne', 'echec_livraison', 'termine'].includes(l.etat) && sansNouvelles(l, instant);
}

const fichierLot = (dossier, id, suffixe = '') => join(dossierLots(dossier), `${id}${suffixe}.json`);

/** Retire le lot du service (il n'est plus téléchargeable) : renommé, gardé pour l'enquête. */
function retirerLot(dossier, id, suffixe) {
  try {
    renameSync(fichierLot(dossier, id), fichierLot(dossier, id, suffixe));
  } catch {
    // déjà retiré
  }
}

/**
 * Le lot figé d'id donné, tel qu'enregistré (pour que son empreinte se vérifie), SEULEMENT s'il est celui du lancement actuel et toujours en jeu :
 * un lot annulé, remplacé ou de simulation finie n'est plus servi (un « Re-run » ou un lancement à la main ne peut pas le livrer). null sinon.
 */
export function lireLot(dossier, id) {
  if (!ID_LOT.test(String(id))) return null;
  const l = lireLancement(dossier);
  if (!l || l.lot !== id || LOT_RETIRE.includes(l.etat)) return null;
  try {
    return readFileSync(fichierLot(dossier, id), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Fige le lot de la mise à jour : journal en attente (sans l'aperçu HTML des pages du guide, inutile à data/rows), champ libre, versions, s'il
 * s'agit d'une simulation (couvert par l'empreinte : le workflow refuse un lot lancé dans l'autre mode) et la case « Version majeure » du brouillon
 * (`majeure`, couverte aussi : le workflow en tire la version de la note et le [V: X+1] de la PR de livraison) ; le range dans
 * db/mise-a-jour/<id>.json, marque le brouillon (il ne se modifie plus) et note l'état « envoi » (ou « manuel »). Rend l'état du lancement.
 * `versionCible` : celle de noteEnPreparation (elle suit la case). `aLivrer` : nombre de lignes de la note calculée (null si inconnu) — une vraie
 * mise à jour sans rien à livrer est refusée.
 */
export function figerLot(db, dossier, { versionDev, versionCible, instant, confirmation, adresse, etat = 'envoi', simulation = false, aLivrer = null,
  limites = { delai: DELAI_ENTRE_LANCEMENTS, parJour: LANCEMENTS_PAR_JOUR } }) {
  if (confirmation !== CONFIRMATION) throw new ErreurNotes(400, `Confirmation attendue : tapez « ${CONFIRMATION} ».`);
  const precedent = lireLancement(dossier);
  if (occupe(precedent, instant)) {
    const message = precedent.etat === 'echec_livraison'
      ? 'La mise à jour précédente est dans dev mais pas livrée sur master : relancez son run sur GitHub (« Re-run all jobs » : il reprend à la livraison) ou fusionnez sa PR de livraison, avant une nouvelle mise à jour.'
      : precedent.etat === 'fusionne' ? 'La mise à jour précédente est en cours de livraison sur master : attendez qu’elle se termine.' : 'Une mise à jour est déjà en cours.';
    throw new ErreurNotes(409, message, { lancement: precedent });
  }
  // un lot déjà figé (lancé à la main, ou livré mais pas encore arrivé sur ce site) : le relancer apporterait deux fois les mêmes modifications
  if (lireBrouillon(db).lot) {
    throw new ErreurNotes(409, 'Un lot est déjà figé : annulez ce lancement, ou attendez que la version livrée arrive sur ce site.', { lancement: precedent });
  }
  // fréquence (pas d'authentification avant la 1.0 : les minutes GitHub Actions et les livraisons ne s'enchaînent pas sans limite)
  const maintenant = Date.parse(instant);
  const recents = [...(precedent?.lancements_recents ?? []), ...(precedent?.lance_le ? [precedent.lance_le] : [])]
    .filter((t, i, tous) => tous.indexOf(t) === i && maintenant - Date.parse(t) < 24 * 3_600_000).sort();
  if (precedent?.lance_le && maintenant - Date.parse(precedent.lance_le) < limites.delai) {
    throw new ErreurNotes(429, `Un lancement vient d’avoir lieu : attendez ${Math.ceil((limites.delai - (maintenant - Date.parse(precedent.lance_le))) / 1000)} s.`);
  }
  if (recents.length >= limites.parJour) {
    throw new ErreurNotes(429, `Déjà ${recents.length} lancements en 24 h (au plus ${limites.parJour}) : réessayez plus tard.`);
  }
  const enAttente = db.prepare("SELECT count(*) AS n FROM modification WHERE etat = 'en_attente'").get().n;
  if (!simulation && aLivrer === 0 && enAttente === 0 && !lireBrouillon(db).texte) {
    throw new ErreurNotes(400, 'Rien à livrer : aucune différence avec la production, aucune modification en attente, pas de texte.');
  }
  if (!adresse || !/^https?:\/\/[^/\s]+$/.test(adresse)) throw new ErreurNotes(500, 'Adresse publique du site de dev inconnue (MAVERICK_ADRESSE_PUBLIQUE).');
  const id = randomUUID();
  const journal = journalExporte(db);
  for (const lot of journal.lots) for (const m of lot.modifications) delete m.apercu;
  const brouillon = lireBrouillon(db);
  const lot = {
    format: 'maverick-mise-a-jour/1', id, cree_le: instant, version_dev: versionDev, version_cible: versionCible, simulation: Boolean(simulation),
    majeure: brouillon.majeure, texte: brouillon.texte, journal,
  };
  const texte = `${JSON.stringify(lot)}\n`;
  mkdirSync(dossierLots(dossier), { recursive: true });
  writeFileSync(fichierLot(dossier, id), texte);
  db.prepare(`INSERT INTO note_version_brouillon (id, texte, modifie_le, lot) VALUES (1, NULL, NULL, ?)
              ON CONFLICT (id) DO UPDATE SET lot = excluded.lot`).run(id);
  return ecrireLancement(dossier, {
    lot: id, empreinte: sha256(texte), lance_le: instant, version_cible: versionCible, majeure: brouillon.majeure,
    modifications: journal.lots.reduce((n, l) => n + l.modifications.length, 0), adresse: `${adresse}/api/mise-a-jour/lots/${id}/`,
    etat, simulation: Boolean(simulation), run: null, erreur: null, suivi_le: null, lancements_recents: recents,
  });
}

/**
 * Annule le lancement du lot `lot` (celui que la page affiche : un onglet périmé n'annule pas le lancement suivant) quand il est annulable
 * (estLiberable) : le brouillon redevient modifiable et le lot n'est plus servi au workflow. `annulerRun` (facultatif) : annule aussi le run sur
 * GitHub s'il en a un. Rend l'état du lancement.
 */
export function libererLot(db, dossier, { instant, lot, annulerRun = null }) {
  const l = lireLancement(dossier);
  if (!l) return null;
  if (lot !== undefined && lot !== l.lot) {
    throw new ErreurNotes(409, 'Ce lancement n’est plus le dernier : rechargez la page.', { lancement: l });
  }
  if (!estLiberable(l, instant)) {
    const message = l.etat === 'echec_livraison'
      ? 'Ce lot est déjà dans dev : il ne s’annule plus. Relancez son run sur GitHub (« Re-run all jobs » : il reprend à la livraison) ou fusionnez sa PR de livraison.'
      : l.etat === 'termine' ? 'Cette mise à jour a été livrée : le texte redeviendra modifiable quand la nouvelle version arrivera sur ce site.'
        : enCours(l) ? 'La mise à jour est en cours sur GitHub : attendez qu’elle se termine.' : 'Rien à annuler.';
    throw new ErreurNotes(409, message, { lancement: l });
  }
  if (['fusionne', 'echec_livraison', 'termine'].includes(l.etat)) {
    // le lot est dans dev (ou livré) : il n'est pas annulé (un « Re-run » doit pouvoir le reprendre) ; son texte, déjà dans sa note, est retiré du
    // brouillon pour ne pas repartir dans la note suivante
    db.prepare('DELETE FROM note_version_brouillon WHERE id = 1 AND lot = ?').run(l.lot);
    return ecrireLancement(dossier, { ...l, libere_le: instant });
  }
  db.prepare('UPDATE note_version_brouillon SET lot = NULL WHERE id = 1 AND lot = ?').run(l.lot);
  retirerLot(dossier, l.lot, '.annule');
  if (l.run?.id && annulerRun) annulerRun(l.run.id).catch(() => {});
  return ecrireLancement(dossier, { ...l, etat: 'annule', libere_le: instant });
}

/**
 * « Lever la maintenance » (page de maintenance du site de dev ; serveur/maintenance.mjs) : le lancement du lot `lot` ne met plus les sites en
 * maintenance, sans rien changer d'autre (le run continue, la livraison aussi). `lot` : celui que la page affiche (un onglet périmé : 409).
 */
export function leverMaintenance(dossier, { lot, instant }) {
  const l = lireLancement(dossier);
  if (!l?.lot || lot !== l.lot) throw new ErreurNotes(409, 'Ce lancement n’est plus le dernier : rechargez la page.', { lancement: l });
  if (l.maintenance_levee_le) return l;
  return modifierLancement(dossier, l.lot, null, () => ({ maintenance_levee_le: instant }));
}

/**
 * Ce que les règles du site (la base vivante, refaite à chaque version) et la référence (master) disent du lancement : sa note est-elle arrivée
 * (le lot est dans dev), et livrée sur master (la référence porte la version de sa note) ? Termine aussi les simulations. Rend l'état.
 * `reference` : lireReference(…) (sa version : celle de master quand ce site a été construit).
 */
export function actualiserLancement(db, dossier, { reference = null } = {}) {
  const l = lireLancement(dossier);
  if (!l?.lot) return l;
  if (l.simulation) {
    if (l.etat === 'termine') return terminerSimulation(db, dossier, l, 'simulation_reussie');
    if (l.etat === 'echec') return terminerSimulation(db, dossier, l, 'simulation_echouee');
    return l;
  }
  const aNote = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'note_version'").get();
  const note = aNote ? db.prepare('SELECT version, texte FROM note_version WHERE lot = ? AND exemple = 0').get(l.lot) : null;
  if (!note) return l;
  // la note est dans les règles : le lot est dans dev. Un lancement annulé dont le lot y est entré quand même : le texte du brouillon, déjà publié
  // dans cette note, ne doit pas repartir dans la suivante (vidé s'il est resté tel quel, la case « Version majeure » avec lui, partie avec le
  // lot). Seulement à ce passage (« annule » → « fusionne ») : ensuite, le brouillon est celui de la mise à jour suivante (une case cochée sans
  // texte après la livraison d'une note sans texte ne doit pas s'effacer).
  if (l.etat === 'annule') db.prepare('DELETE FROM note_version_brouillon WHERE id = 1 AND lot IS NULL AND coalesce(texte, \'\') = coalesce(?, \'\')').run(note.texte);
  const livree = reference?.version && auMoins(reference.version, note.version);
  if (livree && l.etat !== 'termine') return ecrireLancement(dossier, { ...l, etat: 'termine', version_livree: note.version });
  if (['lance', 'en_cours', 'manuel', 'erreur', 'annule', 'envoi'].includes(l.etat)) return ecrireLancement(dossier, { ...l, etat: 'fusionne', version_livree: note.version });
  if (l.etat === 'echec') return ecrireLancement(dossier, { ...l, etat: 'echec_livraison', version_livree: note.version });
  return l;
}

/** Une simulation de mise à jour terminée : son lot libère le brouillon (s'il le tient encore), n'est plus servi, et l'état dit l'issue. */
function terminerSimulation(db, dossier, l, etat) {
  db.prepare('UPDATE note_version_brouillon SET lot = NULL WHERE id = 1 AND lot = ?').run(l.lot);
  retirerLot(dossier, l.lot, '.simulation');
  return ecrireLancement(dossier, { ...l, etat });
}

/**
 * Le lien avec GitHub : déclenche le workflow et suit son run. `jeton` : lu à chaque appel (fichier monté dans le conteneur) ; `fetch` injectable
 * pour les tests. Rien de bloquant : les appels se font en arrière-plan et écrivent l'état dans db/mise-a-jour/etat.json, toujours par
 * modifierLancement (un état plus récent n'est jamais écrasé).
 */
export function creerGithub({ dossier, depot, lireJeton, fetch: f = globalThis.fetch, journal = () => {} }) {
  const api = (chemin, options = {}) => {
    const jeton = lireJeton();
    if (!jeton) throw new ErreurNotes(503, 'Aucun jeton GitHub sur ce serveur (MAVERICK_GITHUB_JETON_FICHIER) : lancez le workflow à la main (voir la page).');
    return f(`https://api.github.com/repos/${depot}${chemin}`, {
      signal: AbortSignal.timeout(DELAI_GITHUB),
      ...options,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${jeton}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'maverick-center', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  };
  const annulerRun = async (id) => [202, 204].includes((await api(`/actions/runs/${id}/cancel`, { method: 'POST' })).status);
  /** L'étape « Fusion dans dev » du job « livrer » de ce run est-elle réussie (le lot est dans dev) ? */
  const fusionDansDev = async (id) => {
    const r = await api(`/actions/runs/${id}/jobs?filter=latest&per_page=50`);
    if (r.status !== 200) return false;
    const job = ((await r.json()).jobs ?? []).find((j) => j.name === JOB_LIVRER);
    return Boolean(job?.steps?.some((e) => e.name === ETAPE_FUSION_DEV && e.conclusion === 'success'));
  };
  let dernierSuivi = 0;
  return {
    configure: () => Boolean(lireJeton()),
    annulerRun,
    /** Déclenche le workflow pour le lancement en état « envoi ». */
    async declencher() {
      const l = lireLancement(dossier);
      if (!l || l.etat !== 'envoi') return l;
      try {
        const r = await api(`/actions/workflows/${WORKFLOW}/dispatches`, {
          method: 'POST',
          // les entrées d'un workflow_dispatch sont des chaînes ; « essai » est l'entrée booléenne du workflow : la simulation de mise à jour,
          // qui applique et contrôle le lot sans rien pousser (le lot porte aussi `simulation` : le workflow refuse un désaccord)
          body: JSON.stringify({ ref: 'dev', inputs: { lot: l.lot, empreinte: l.empreinte, adresse: l.adresse, essai: l.simulation ? 'true' : 'false' }, return_run_details: true }),
        });
        if (r.status !== 200 && r.status !== 204) throw new Error(`GitHub a répondu ${r.status} : ${(await r.text()).slice(0, 300)}`);
        const details = r.status === 200 ? await r.json() : {};
        const run = details.workflow_run_id ? { id: details.workflow_run_id, url: details.html_url ?? null, statut: 'queued', conclusion: null } : null;
        const actuel = lireLancement(dossier);
        if (actuel?.lot !== l.lot || actuel.etat !== 'envoi') {
          // annulé pendant l'envoi, ou un autre lot a pris la place : le run parti quand même est annulé sur GitHub (son lot n'est plus servi de
          // toute façon : il échouerait au téléchargement), et l'état actuel n'est jamais écrasé
          let annule = false;
          if (run) {
            try {
              annule = await annulerRun(run.id);
            } catch {
              // réseau : le run échouera au téléchargement du lot
            }
          }
          journal(`mise à jour : lot ${l.lot} annulé pendant l'envoi ; run ${run?.id ?? '(identifiant inconnu)'} ${annule ? 'annulé sur GitHub' : 'non annulé (son lot n’est plus servi : il échouera)'}`);
          return modifierLancement(dossier, l.lot, ['annule'], () => ({ run, erreur: annule || !run ? null : 'Annulé pendant l’envoi ; le run n’a pas pu être annulé sur GitHub, mais son lot n’est plus servi : il échouera.' }));
        }
        journal(`mise à jour${l.simulation ? ' (simulation)' : ''} : workflow déclenché pour le lot ${l.lot}`);
        return modifierLancement(dossier, l.lot, ['envoi'], () => ({ etat: 'lance', run }));
      } catch (e) {
        journal(`ERREUR mise à jour : déclenchement du workflow : ${e.message}`);
        return modifierLancement(dossier, l.lot, ['envoi'], () => ({ etat: 'erreur', erreur: e.message }));
      }
    },
    /** Relit l'état du run (au plus une fois par INTERVALLE_SUIVI) ; une relance (« Re-run ») d'un échec est suivie aussi. */
    async suivre({ maintenant = Date.now() } = {}) {
      const l = lireLancement(dossier);
      if (!l || !SUIVIS.includes(l.etat) || maintenant - dernierSuivi < INTERVALLE_SUIVI) return l;
      dernierSuivi = maintenant;
      const suiviLe = new Date(maintenant).toISOString();
      try {
        let run;
        if (l.run?.id) {
          const r = await api(`/actions/runs/${l.run.id}`);
          if (r.status !== 200) throw new Error(`GitHub a répondu ${r.status}`);
          run = await r.json();
        } else {
          // identifiant non rendu au déclenchement : le run est retrouvé par son nom, qui porte le lot (run-name du workflow)
          const r = await api(`/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&branch=dev&per_page=30`);
          if (r.status !== 200) throw new Error(`GitHub a répondu ${r.status}`);
          run = ((await r.json()).workflow_runs ?? []).find((x) => String(x.display_title ?? x.name ?? '').includes(l.lot));
          if (!run) return modifierLancement(dossier, l.lot, SUIVIS, () => ({ suivi_le: suiviLe }));
        }
        const fini = run.status === 'completed';
        const reussi = fini && run.conclusion === 'success';
        // une vraie mise à jour qui tourne encore ou qui a échoué : son lot est-il déjà dans dev ?
        const dansDev = !l.simulation && !reussi && (l.etat === 'fusionne' || l.etat === 'echec_livraison' || await fusionDansDev(run.id));
        const etat = reussi ? 'termine' : fini ? (dansDev ? 'echec_livraison' : 'echec') : (dansDev ? 'fusionne' : 'en_cours');
        return modifierLancement(dossier, l.lot, SUIVIS, () => ({
          suivi_le: suiviLe, erreur: null, etat,
          run: { ...(l.run ?? {}), id: l.run?.id ?? run.id, statut: run.status, conclusion: run.conclusion ?? null, url: run.html_url ?? l.run?.url ?? null, tentative: run.run_attempt ?? null },
        }));
      } catch (e) {
        return modifierLancement(dossier, l.lot, SUIVIS, () => ({ suivi_le: suiviLe, erreur: `suivi : ${e.message}` }));
      }
    },
  };
}
