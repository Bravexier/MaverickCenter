// Page « Mise à jour » côté service (site de dev seulement, comme l'édition : MAVERICK_EDITION=1 ; docs/serveur.md, « Mise à jour ») :
//   - la liste en préparation : les modifications des règles entre la base de PRODUCTION (référence : la base de master, livrée avec le site dans
//     site/donnees/reference.db) et la base de DEV (base vivante : règles de dev + modifications du site), calculée par lib/notes-de-version.mjs ;
//   - le brouillon de la note de version (champ libre des admins, table note_version_brouillon) ;
//   - « Effectuer la mise à jour » : le service FIGE un lot (journal des modifications en attente + champ libre), le range dans db/mise-a-jour/
//     avec son empreinte, puis déclenche le workflow GitHub .github/workflows/mise-a-jour.yml (workflow_dispatch : lot, empreinte, adresse du lot),
//     qui télécharge le lot, l'applique à data/rows, écrit la note de version, ouvre et fusionne la PR vers dev puis livre dev → master.
//     Le jeton du serveur ne sert QU'À déclencher et suivre ce workflow (permission Actions) ; tout le reste se fait côté GitHub.
// L'état du lancement est gardé dans db/mise-a-jour/etat.json : le service redémarre pendant le processus (nouvelle version livrée sur dev).
// Node seulement (node:…), sans dépendance.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { bilan, comparerBases, TABLES_LUES, versionDeLivraison } from '../src/lib/notes-de-version.mjs';
import { signature } from './base-vivante.mjs';
import { journalExporte } from './edition-journal.mjs';

export const DOSSIER_LOTS = 'mise-a-jour';
export const FICHIER_LANCEMENT = 'etat.json';
/** Le mot à taper pour confirmer le lancement (la page le demande). */
export const CONFIRMATION = 'METTRE A JOUR';
/** Le workflow déclenché, sur la branche dev (sa branche par défaut : un workflow_dispatch n'existe que s'il y est). */
export const WORKFLOW = 'mise-a-jour.yml';
/** Suivi du run GitHub : pas plus souvent que ça (limite de l'API). */
export const INTERVALLE_SUIVI = 20_000;

export class ErreurNotes extends Error {
  constructor(statut, message, details = {}) {
    super(message);
    this.statut = statut;
    this.details = details;
  }
}

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

/** Le brouillon de la note (champ libre) : { texte, modifie_le, lot }. */
export function lireBrouillon(db) {
  const b = db.prepare('SELECT texte, modifie_le, lot FROM note_version_brouillon WHERE id = 1').get();
  return { texte: b?.texte ?? null, modifie_le: b?.modifie_le ?? null, lot: b?.lot ?? null };
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
 * La note en préparation : référence (production), versions, lignes calculées et leur bilan, brouillon.
 * @param {import('node:sqlite').DatabaseSync} db base vivante
 */
export function noteEnPreparation(db, { reference, versionDev }) {
  const ref = lireReference(reference);
  const versionCible = versionDeLivraison(versionDev, ref.version);
  const brouillon = lireBrouillon(db);
  // modifications du site en attente : ce que le lot emporterait
  const enAttente = db.prepare("SELECT count(*) AS n FROM modification WHERE etat = 'en_attente'").get().n;
  const commun = { reference: ref, version_dev: versionDev, version_cible: versionCible, en_attente: enAttente, brouillon };
  if (!ref.disponible) return { ...commun, lignes: null, bilan: null };
  const lignes = comparerBases(tablesDeReference(ref.chemin), lireTables(db));
  return { ...commun, lignes, bilan: bilan(lignes) };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lancement de la mise à jour (lot figé + workflow GitHub)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const dossierLots = (dossier) => join(dossier, DOSSIER_LOTS);
const ID_LOT = /^[0-9a-f-]{36}$/;

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

/** Un lancement occupe la place tant que son run n'est pas fini (ou n'a pas échoué au départ). */
export const enCours = (l) => Boolean(l) && ['envoi', 'lance', 'en_cours'].includes(l.etat);

/** Le lot figé d'id donné (texte JSON tel qu'enregistré, pour que son empreinte se vérifie), null s'il n'existe pas. */
export function lireLot(dossier, id) {
  if (!ID_LOT.test(String(id))) return null;
  try {
    return readFileSync(join(dossierLots(dossier), `${id}.json`), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Fige le lot de la mise à jour : journal en attente (sans l'aperçu HTML des pages du guide, inutile à data/rows), champ libre, versions ; le range
 * dans db/mise-a-jour/<id>.json, marque le brouillon (il ne se modifie plus) et note l'état « envoi ». Rend l'état du lancement.
 */
export function figerLot(db, dossier, { versionDev, versionCible, instant, confirmation, adresse, etat = 'envoi', simulation = false }) {
  if (confirmation !== CONFIRMATION) throw new ErreurNotes(400, `Confirmation attendue : tapez « ${CONFIRMATION} ».`);
  const precedent = lireLancement(dossier);
  if (enCours(precedent)) throw new ErreurNotes(409, 'Une mise à jour est déjà en cours.', { lancement: precedent });
  // un lot déjà figé (lancé à la main, ou livré mais pas encore arrivé sur ce site) : le relancer apporterait deux fois les mêmes modifications
  if (lireBrouillon(db).lot) {
    throw new ErreurNotes(409, 'Un lot est déjà figé : annulez ce lancement, ou attendez que la version livrée arrive sur ce site.', { lancement: precedent });
  }
  if (!adresse || !/^https?:\/\/[^/\s]+$/.test(adresse)) throw new ErreurNotes(500, 'Adresse publique du site de dev inconnue (MAVERICK_ADRESSE_PUBLIQUE).');
  const id = randomUUID();
  const journal = journalExporte(db);
  for (const lot of journal.lots) for (const m of lot.modifications) delete m.apercu;
  const brouillon = lireBrouillon(db);
  const lot = { format: 'maverick-mise-a-jour/1', id, cree_le: instant, version_dev: versionDev, version_cible: versionCible, texte: brouillon.texte, journal };
  const texte = `${JSON.stringify(lot)}\n`;
  mkdirSync(dossierLots(dossier), { recursive: true });
  writeFileSync(join(dossierLots(dossier), `${id}.json`), texte);
  db.prepare(`INSERT INTO note_version_brouillon (id, texte, modifie_le, lot) VALUES (1, NULL, NULL, ?)
              ON CONFLICT (id) DO UPDATE SET lot = excluded.lot`).run(id);
  return ecrireLancement(dossier, {
    lot: id, empreinte: createHash('sha256').update(texte).digest('hex'), lance_le: instant, version_cible: versionCible,
    modifications: journal.lots.reduce((n, l) => n + l.modifications.length, 0), adresse: `${adresse}/api/mise-a-jour/lots/${id}/`,
    etat, simulation: Boolean(simulation), run: null, erreur: null, suivi_le: null,
  });
}

/** Annule un lancement qui n'a pas pu partir (ou qui a échoué) : le brouillon redevient modifiable. */
export function libererLot(db, dossier, { instant }) {
  const l = lireLancement(dossier);
  if (enCours(l) && l.etat !== 'envoi') throw new ErreurNotes(409, 'La mise à jour est en cours sur GitHub : attendez qu’elle se termine.', { lancement: l });
  if (l?.etat === 'termine' && !l.simulation) throw new ErreurNotes(409, 'Cette mise à jour a été livrée : le texte redeviendra modifiable quand la nouvelle version arrivera sur ce site.', { lancement: l });
  db.prepare('UPDATE note_version_brouillon SET lot = NULL WHERE id = 1').run();
  if (l) ecrireLancement(dossier, { ...l, etat: 'annule', libere_le: instant });
  return lireLancement(dossier);
}

/**
 * Le lancement dont la note de version est arrivée dans les règles (nouvelle version du site : base vivante refaite, note_version.lot = son lot)
 * est terminé, même si son run n'a pas pu être suivi (lancé à la main, jeton absent, service relancé). Rend l'état du lancement.
 */
export function actualiserLancement(db, dossier) {
  const l = lireLancement(dossier);
  if (!l?.lot || l.etat === 'termine' || l.etat === 'annule') {
    // simulation de mise à jour finie (réussie ou non) : rien n'a été poussé, le lot est libéré et le texte redevient modifiable
    if (l?.simulation && l.etat === 'termine') return terminerSimulation(db, dossier, l, 'simulation_reussie');
    return l;
  }
  if (l.simulation) return l.etat === 'echec' ? terminerSimulation(db, dossier, l, 'simulation_echouee') : l;
  const livree = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'note_version'").get()
    && db.prepare('SELECT version FROM note_version WHERE lot = ?').get(l.lot);
  return livree ? ecrireLancement(dossier, { ...l, etat: 'termine', version_livree: livree.version }) : l;
}

/** Une simulation de mise à jour terminée : son lot libère le brouillon (s'il le tient encore) et l'état dit l'issue. */
function terminerSimulation(db, dossier, l, etat) {
  db.prepare('UPDATE note_version_brouillon SET lot = NULL WHERE id = 1 AND lot = ?').run(l.lot);
  return ecrireLancement(dossier, { ...l, etat });
}

/**
 * Le lien avec GitHub : déclenche le workflow et suit son run. `jeton` : lu à chaque appel (fichier monté dans le conteneur) ; `fetch` injectable
 * pour les tests. Rien de bloquant : les appels se font en arrière-plan et écrivent l'état dans db/mise-a-jour/etat.json.
 */
export function creerGithub({ dossier, depot, lireJeton, fetch: f = globalThis.fetch, journal = () => {} }) {
  const api = (chemin, options = {}) => {
    const jeton = lireJeton();
    if (!jeton) throw new ErreurNotes(503, 'Aucun jeton GitHub sur ce serveur (MAVERICK_GITHUB_JETON_FICHIER) : lancez le workflow à la main (voir la page).');
    return f(`https://api.github.com/repos/${depot}${chemin}`, {
      ...options,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${jeton}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'maverick-center', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  };
  let dernierSuivi = 0;
  return {
    configure: () => Boolean(lireJeton()),
    /** Déclenche le workflow pour le lancement en état « envoi ». */
    async declencher() {
      const l = lireLancement(dossier);
      if (!l || l.etat !== 'envoi') return l;
      try {
        const r = await api(`/actions/workflows/${WORKFLOW}/dispatches`, {
          method: 'POST',
          // les entrées d'un workflow_dispatch sont des chaînes ; « essai » est l'entrée booléenne du workflow : la simulation de mise à jour,
          // qui applique et contrôle le lot sans rien pousser
          body: JSON.stringify({ ref: 'dev', inputs: { lot: l.lot, empreinte: l.empreinte, adresse: l.adresse, essai: l.simulation ? 'true' : 'false' }, return_run_details: true }),
        });
        if (r.status !== 200 && r.status !== 204) throw new Error(`GitHub a répondu ${r.status} : ${(await r.text()).slice(0, 300)}`);
        const details = r.status === 200 ? await r.json() : {};
        const run = details.workflow_run_id ? { id: details.workflow_run_id, url: details.html_url ?? null, statut: 'queued', conclusion: null } : null;
        const actuel = lireLancement(dossier);
        if (actuel?.lot !== l.lot) return actuel; // un autre lot a pris la place entre-temps : on n'écrase jamais son état
        if (actuel.etat !== 'envoi') {
          // annulé pendant l'envoi (« Annuler ce lancement ») : le run est parti quand même ; on l'annule sur GitHub
          let annule = false;
          if (run) {
            try {
              annule = [202, 204].includes((await api(`/actions/runs/${run.id}/cancel`, { method: 'POST' })).status);
            } catch {
              // réseau : le run tournera ; l'état le dit
            }
          }
          journal(`mise à jour : lot ${l.lot} annulé pendant l'envoi ; run ${run?.id ?? '?'} ${annule ? 'annulé sur GitHub' : 'NON annulé (à annuler à la main)'}`);
          return ecrireLancement(dossier, { ...actuel, run, erreur: annule ? null : 'Annulé pendant l’envoi, mais le run n’a pas pu être annulé sur GitHub : annulez-le à la main.' });
        }
        journal(`mise à jour${l.simulation ? ' (simulation)' : ''} : workflow déclenché pour le lot ${l.lot}`);
        return ecrireLancement(dossier, { ...actuel, etat: 'lance', run });
      } catch (e) {
        journal(`ERREUR mise à jour : déclenchement du workflow : ${e.message}`);
        const actuel = lireLancement(dossier);
        if (actuel?.lot !== l.lot || actuel.etat !== 'envoi') return actuel;
        return ecrireLancement(dossier, { ...actuel, etat: 'erreur', erreur: e.message });
      }
    },
    /** Relit l'état du run (au plus une fois par INTERVALLE_SUIVI). */
    async suivre({ maintenant = Date.now() } = {}) {
      const l = lireLancement(dossier);
      if (!l || !['lance', 'en_cours'].includes(l.etat) || !l.run?.id || maintenant - dernierSuivi < INTERVALLE_SUIVI) return l;
      dernierSuivi = maintenant;
      try {
        const r = await api(`/actions/runs/${l.run.id}`);
        if (r.status !== 200) throw new Error(`GitHub a répondu ${r.status}`);
        const run = await r.json();
        const fini = run.status === 'completed';
        return ecrireLancement(dossier, {
          ...l, suivi_le: new Date(maintenant).toISOString(), run: { ...l.run, statut: run.status, conclusion: run.conclusion ?? null, url: run.html_url ?? l.run.url },
          etat: fini ? (run.conclusion === 'success' ? 'termine' : 'echec') : 'en_cours',
        });
      } catch (e) {
        return ecrireLancement(dossier, { ...l, suivi_le: new Date(maintenant).toISOString(), erreur: `suivi : ${e.message}` });
      }
    },
  };
}
