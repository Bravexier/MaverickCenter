// Page « Mise à jour » : la machine d'états du lancement et le journal après une livraison (serveur/notes-de-version.mjs, base-vivante.mjs ;
// docs/serveur.md, « Mise à jour »). Chaque test reprend un défaut confirmé par la relecture adverse de la chaîne (scénario concret) :
//   - un lot annulé, remplacé ou de simulation finie n'est plus servi : un « Re-run » ou un lancement à la main ne peut pas le livrer ;
//   - « termine » ne vient que d'un run réussi ou de la référence (master) ; un lot entré dans dev est « fusionne », puis « echec_livraison » si la
//     livraison échoue — jamais « termine » par la seule arrivée de sa note, jamais annulable ;
//   - un suivi en arrière-plan n'écrase jamais une annulation ni l'état d'un autre lot ; une annulation dit quel lot elle vise ;
//   - le lot dit s'il est une simulation ; les lancements ont une fréquence limitée ; une vraie mise à jour sans rien à livrer est refusée ;
//   - après une livraison, le journal déjà livré est « intégré » (aller-retour A → B → A, saisies successives, création puis suppression) : rien
//     ne reste en attente ni en conflit, aucune valeur annulée ne revient.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { integrerLivrees, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import {
  actualiserLancement, CONFIRMATION, creerGithub, DUREE_MAX_RUN, ETAPE_FUSION_DEV, estLiberable, figerLot, INTERVALLE_SUIVI, JOB_LIVRER,
  LANCEMENTS_PAR_JOUR, libererLot, lireLancement, lireLot, occupe,
} from '../serveur/notes-de-version.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { versionLibre } from './aide-mise-a-jour.mjs';

const racine = dossierTemporaire('etats');
const regles = cheminBase({ sansExemples: false });
let n = 0;
/** Une base vivante neuve et son dossier. */
function nouvelle() {
  n += 1;
  const dossier = join(racine, `db-${n}`);
  const { chemin } = preparerBaseVivante({ regles, dossier });
  return { dossier, db: ouvrirBaseVivante(chemin) };
}
const JSON_ = { 'content-type': 'application/json' };
const SANS_LIMITE = { delai: 0, parJour: Infinity };
const ADRESSE = 'https://dev.exemple.org';
const instantDe = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const T0 = Date.parse('2026-10-11T10:00:00Z');
const figer = (db, dossier, options = {}) => figerLot(db, dossier, {
  versionDev: '0.1.76', versionCible: '0.2', instant: instantDe(T0), confirmation: CONFIRMATION, adresse: ADRESSE, limites: SANS_LIMITE, ...options,
});
/**
 * La note de version d'un lot arrivée dans les règles (ce que fait la nouvelle version du site : scripts/mise-a-jour-regles.mjs), à une version que
 * data/rows ne porte pas déjà (pendant une mise à jour, il en porte une en attente de livraison) et au-delà de la référence (0.1.25) : non livrée.
 */
const noteArrivee = (db, lot, texte = null) => {
  const version = versionLibre(db);
  db.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, '2026-10-11', '0.1', ?, ?, 0)").run(version, texte, lot);
  return version;
};
/** Pose l'état du lancement comme le ferait le suivi (pour amener un lancement dans un état donné). */
const ecrireEtat = (dossier, changement) => {
  const l = lireLancement(dossier);
  writeFileSync(join(dossier, 'mise-a-jour', 'etat.json'), `${JSON.stringify({ ...l, ...changement }, null, 2)}\n`);
};

test('un lot annulé, remplacé ou de simulation finie n’est plus servi (410) : un Re-run ou un lancement à la main ne peut pas le livrer', () => {
  const { db, dossier } = nouvelle();
  const service = { base: () => db, etat: () => ({ version: '0.1.76' }), edition: true, dossier, reference: null, adresse: ADRESSE, github: null, limites: SANS_LIMITE };
  const lancer = (corps = {}) => traiter({ methode: 'POST', chemin: '/api/mise-a-jour/lancer/', entetes: JSON_, corps: JSON.stringify({ confirmation: CONFIRMATION, ...corps }) }, service);
  const lot = (id) => traiter({ methode: 'GET', chemin: `/api/mise-a-jour/lots/${id}/`, entetes: {} }, service);
  const a = lancer().corps.lancement;
  assert.equal(a.etat, 'manuel');
  assert.equal(lot(a.lot).statut, 200, 'le lot en jeu est servi');
  assert.equal(JSON.parse(lot(a.lot).brut).simulation, false, 'le lot dit s’il est une simulation (couvert par l’empreinte)');
  libererLot(db, dossier, { instant: instantDe(T0 + 1000), lot: a.lot });
  assert.equal(lot(a.lot).statut, 410, 'annulé : plus servi');
  assert.ok(readdirSync(join(dossier, 'mise-a-jour')).includes(`${a.lot}.annule.json`), 'gardé pour l’enquête, sous un autre nom');
  const b = lancer({ simulation: true }).corps.lancement;
  assert.equal(JSON.parse(lot(b.lot).brut).simulation, true);
  ecrireEtat(dossier, { etat: 'termine' }); // run de simulation réussi
  assert.equal(actualiserLancement(db, dossier).etat, 'simulation_reussie');
  assert.equal(lot(b.lot).statut, 410, 'simulation finie : plus servi');
  const c = lancer().corps.lancement;
  assert.equal(lot(a.lot).statut, 410, 'un ancien lot n’est jamais servi');
  assert.equal(lot(c.lot).statut, 200);
  assert.equal(lot('pas-un-id').statut, 404);
  db.close();
});

test('« termine » seulement sur un run réussi ou la référence ; dans dev = « fusionne » ; échec après dev = « echec_livraison » (ni annulable, ni écrasé)', async () => {
  const { db, dossier } = nouvelle();
  const l = figer(db, dossier);
  let run = { id: 5, status: 'in_progress', conclusion: null, html_url: 'u', run_attempt: 1 };
  let fusion = 'in_progress';
  const fauxFetch = async (url) => {
    if (url.endsWith('/dispatches')) return new Response(JSON.stringify({ workflow_run_id: 5, html_url: 'u' }), { status: 200 });
    if (url.endsWith('/actions/runs/5')) return new Response(JSON.stringify(run), { status: 200 });
    if (url.includes('/actions/runs/5/jobs')) {
      return new Response(JSON.stringify({ jobs: [{ name: 'preparer', steps: [] }, { name: JOB_LIVRER, steps: [{ name: ETAPE_FUSION_DEV, status: fusion === 'success' ? 'completed' : 'in_progress', conclusion: fusion === 'success' ? 'success' : null }] }] }), { status: 200 });
    }
    return new Response('?', { status: 404 });
  };
  const github = creerGithub({ dossier, depot: 'x/y', lireJeton: () => 'j', fetch: fauxFetch });
  await github.declencher();
  let t = T0;
  const suivre = () => github.suivre({ maintenant: (t += INTERVALLE_SUIVI) });
  assert.equal((await suivre()).etat, 'en_cours');
  fusion = 'success'; // l'étape « Fusion dans dev » du job « livrer » a réussi : le lot est dans dev
  assert.equal((await suivre()).etat, 'fusionne');
  assert.equal(estLiberable(lireLancement(dossier), instantDe(T0 + 60_000)), false, 'dans dev : ne s’annule plus');
  assert.throws(() => figer(db, dossier, { instant: instantDe(T0 + 60_000) }), /en cours de livraison/);
  // la note arrive dans les règles (le site de dev a reçu la version de dev) : l'état ne passe PAS à « termine »
  noteArrivee(db, l.lot, 'Texte A');
  assert.equal(actualiserLancement(db, dossier, { reference: { version: '0.1.25' } }).etat, 'fusionne');
  // la livraison dev → master échoue
  run = { ...run, status: 'completed', conclusion: 'failure' };
  assert.equal((await suivre()).etat, 'echec_livraison');
  assert.equal(actualiserLancement(db, dossier, { reference: { version: '0.1.25' } }).etat, 'echec_livraison', 'l’arrivée de la note ne masque jamais l’échec');
  assert.throws(() => libererLot(db, dossier, { instant: instantDe(T0 + 60_000), lot: l.lot }), /déjà dans dev/);
  assert.throws(() => figer(db, dossier, { instant: instantDe(T0 + 60_000) }), /pas livrée sur master/);
  assert.equal(lireLot(dossier, l.lot) !== null, true, 'toujours servi : un Re-run doit pouvoir le reprendre');
  // le propriétaire relance le run (Re-run) : suivi, puis réussi
  run = { ...run, status: 'in_progress', conclusion: null, run_attempt: 2 };
  assert.equal((await suivre()).etat, 'fusionne');
  run = { ...run, status: 'completed', conclusion: 'success' };
  const fin = await suivre();
  assert.deepEqual([fin.etat, fin.run.tentative], ['termine', 2]);
  assert.equal(occupe(fin, instantDe(T0 + 60_000)), false);
  db.close();
});

test('un run qui échoue AVANT dev : « echec », annulable ; la note arrivée ensuite le change en « echec_livraison », jamais en « termine »', async () => {
  const { db, dossier } = nouvelle();
  const l = figer(db, dossier);
  const fauxFetch = async (url) => {
    if (url.endsWith('/dispatches')) return new Response(JSON.stringify({ workflow_run_id: 6 }), { status: 200 });
    if (url.endsWith('/actions/runs/6')) return new Response(JSON.stringify({ status: 'completed', conclusion: 'failure' }), { status: 200 });
    if (url.includes('/actions/runs/6/jobs')) return new Response(JSON.stringify({ jobs: [{ name: JOB_LIVRER, steps: [{ name: ETAPE_FUSION_DEV, conclusion: 'skipped' }] }] }), { status: 200 });
    return new Response('?', { status: 404 });
  };
  const github = creerGithub({ dossier, depot: 'x/y', lireJeton: () => 'j', fetch: fauxFetch });
  await github.declencher();
  assert.equal((await github.suivre({ maintenant: T0 + INTERVALLE_SUIVI })).etat, 'echec');
  assert.equal(estLiberable(lireLancement(dossier), instantDe(T0)), true);
  noteArrivee(db, l.lot);
  assert.equal(actualiserLancement(db, dossier, { reference: { version: '0.1.25' } }).etat, 'echec_livraison');
  db.close();
});

test('un suivi en vol n’écrase ni une annulation ni l’état d’un autre lot ; une annulation vise son lot (onglet périmé : 409)', async () => {
  const { db, dossier } = nouvelle();
  const a = figer(db, dossier, { etat: 'envoi' });
  ecrireEtat(dossier, { etat: 'echec', run: { id: 7 } }); // échec avant dev : annulable, et suivi (une relance serait vue)
  let repondre;
  const fauxFetch = (url) => {
    if (url.endsWith('/actions/runs/7')) return new Promise((ok) => { repondre = () => ok(new Response(JSON.stringify({ status: 'in_progress' }), { status: 200 })); });
    if (url.includes('/jobs')) return Promise.resolve(new Response(JSON.stringify({ jobs: [] }), { status: 200 }));
    return Promise.resolve(new Response('?', { status: 404 }));
  };
  const github = creerGithub({ dossier, depot: 'x/y', lireJeton: () => 'j', fetch: fauxFetch });
  const enVol = github.suivre({ maintenant: T0 + INTERVALLE_SUIVI });
  for (let i = 0; i < 50 && !repondre; i++) await new Promise((ok) => setTimeout(ok, 5));
  assert.throws(() => libererLot(db, dossier, { instant: instantDe(T0), lot: '00000000-0000-0000-0000-000000000000' }), /plus le dernier/);
  assert.equal(libererLot(db, dossier, { instant: instantDe(T0), lot: a.lot }).etat, 'annule');
  repondre();
  await enVol;
  assert.equal(lireLancement(dossier).etat, 'annule', 'le suivi revenu après l’annulation ne réécrit rien');
  db.close();
});

test('fréquence des lancements : délai minimal et plafond sur 24 h ; une vraie mise à jour sans rien à livrer est refusée', () => {
  const { db, dossier } = nouvelle();
  const defaut = (ms, extra = {}) => figerLot(db, dossier, { versionDev: '0.1.76', versionCible: '0.2', instant: instantDe(ms), confirmation: CONFIRMATION, adresse: ADRESSE, simulation: true, ...extra });
  let t = T0;
  const lancerEtLiberer = () => {
    const l = defaut(t);
    libererLot(db, dossier, { instant: instantDe(t), lot: l.lot });
    return l;
  };
  lancerEtLiberer();
  assert.throws(() => defaut(t + 30_000), (e) => e.statut === 429, 'trop tôt');
  for (let i = 1; i < LANCEMENTS_PAR_JOUR; i++) {
    t += 3 * 60_000;
    lancerEtLiberer();
  }
  t += 3 * 60_000;
  assert.throws(() => defaut(t), (e) => e.statut === 429 && /24 h/.test(e.message), 'plafond');
  t = T0 + 25 * 3_600_000;
  assert.doesNotThrow(() => lancerEtLiberer(), 'le lendemain');
  // rien à livrer : aucune différence avec la production, rien en attente, pas de texte → la vraie mise à jour est refusée, la simulation non
  t += 3 * 60_000;
  assert.throws(() => defaut(t, { simulation: false, aLivrer: 0 }), (e) => e.statut === 400 && /Rien à livrer/.test(e.message));
  assert.doesNotThrow(() => defaut(t, { simulation: true, aLivrer: 0 }));
  db.close();
});

test('lot dans dev ou livré dont la version n’arrive pas sur ce site : au-delà de 3 h, le texte se libère (sans annuler le lot)', () => {
  const { db, dossier } = nouvelle();
  db.prepare("INSERT INTO note_version_brouillon (id, texte, modifie_le, lot) VALUES (1, 'Texte', NULL, NULL)").run();
  const l = figer(db, dossier);
  ecrireEtat(dossier, { etat: 'termine' });
  assert.equal(estLiberable(lireLancement(dossier), instantDe(T0 + 60_000)), false);
  const tard = instantDe(T0 + DUREE_MAX_RUN + 60_000);
  assert.equal(estLiberable(lireLancement(dossier), tard), true);
  const r = libererLot(db, dossier, { instant: tard, lot: l.lot });
  assert.equal(r.etat, 'termine', 'toujours livré');
  assert.equal(db.prepare('SELECT count(*) AS n FROM note_version_brouillon').get().n, 0, 'texte (déjà dans la note) retiré du brouillon');
  assert.notEqual(lireLot(dossier, l.lot), null, 'le lot reste servi (un Re-run le reprendrait)');
  db.close();
});

test('lancement annulé dont le lot entre quand même dans dev : « fusionne », et son texte resté tel quel quitte le brouillon', () => {
  const { db, dossier } = nouvelle();
  db.prepare("INSERT INTO note_version_brouillon (id, texte, modifie_le, lot) VALUES (1, 'Texte A', NULL, NULL)").run();
  const l = figer(db, dossier);
  libererLot(db, dossier, { instant: instantDe(T0), lot: l.lot });
  assert.equal(db.prepare('SELECT texte FROM note_version_brouillon').get().texte, 'Texte A');
  noteArrivee(db, l.lot, 'Texte A');
  assert.equal(actualiserLancement(db, dossier, { reference: { version: '0.1.25' } }).etat, 'fusionne');
  assert.equal(db.prepare('SELECT count(*) AS n FROM note_version_brouillon').get().n, 0, 'le texte déjà publié ne repart pas dans la note suivante');
  db.close();
});

test('case « Version majeure » cochée pour la mise à jour suivante, après la livraison d’une note sans texte : elle reste cochée à chaque visite', () => {
  const { db, dossier } = nouvelle();
  const l = figer(db, dossier); // brouillon sans texte : la note livrée n'en aura pas
  noteArrivee(db, l.lot, null);
  db.exec('DELETE FROM note_version_brouillon'); // la base vivante refaite par la nouvelle version (viderBrouillonLivre)
  assert.equal(actualiserLancement(db, dossier, { reference: { version: '0.1.25' } }).etat, 'fusionne');
  // la mise à jour suivante se prépare : case cochée, sans texte
  db.prepare('INSERT INTO note_version_brouillon (id, majeure) VALUES (1, 1)').run();
  for (let i = 0; i < 2; i += 1) actualiserLancement(db, dossier, { reference: { version: '0.1.25' } }); // chaque visite de la page
  assert.deepEqual({ ...db.prepare('SELECT texte, lot, majeure FROM note_version_brouillon').get() }, { texte: null, lot: null, majeure: 1 });
  db.close();
});

test('après une livraison, le journal livré est intégré : aller-retour, saisies successives, création puis suppression — rien en attente ni en conflit', () => {
  // la base vivante du site de dev : des modifications par l'API
  const dossier = join(racine, 'db-livraison');
  const { chemin } = preparerBaseVivante({ regles, dossier });
  const db = ouvrirBaseVivante(chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const enregistrer = (operations) => {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: JSON_, corps: JSON.stringify({ page: 'metiers/', operations }) }, service);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    return r.corps;
  };
  const bonus = (id) => db.prepare('SELECT bonus_brut FROM metier WHERE id = ?').get(id).bonus_brut;
  const forgeron = bonus('metiers/forgeron');
  const acrobate = bonus('metiers/acrobate');
  enregistrer([{ op: 'modifier', table: 'metier', cle: { id: 'metiers/forgeron' }, valeurs: { bonus_brut: '+9% Essai' } }]); // A → B
  enregistrer([{ op: 'modifier', table: 'metier', cle: { id: 'metiers/forgeron' }, valeurs: { bonus_brut: forgeron } }]); // B → A
  enregistrer([{ op: 'modifier', table: 'metier', cle: { id: 'metiers/acrobate' }, valeurs: { bonus_brut: '+1% Un' } }]); // X → Y
  enregistrer([{ op: 'modifier', table: 'metier', cle: { id: 'metiers/acrobate' }, valeurs: { bonus_brut: '+2% Deux' } }]); // Y → Z
  const cree = enregistrer([{ op: 'creer', entite: 'metier', valeurs: { nom: 'Métier jetable', description: 'à jeter' } }]);
  const id = cree.lignes.find((x) => x.table === 'metier').cle.id;
  enregistrer([{ op: 'supprimer', entite: 'metier', cle: { id } }]); // créé puis supprimé
  const journal = journalExporte(db);
  const attendues = journal.lots.reduce((s, l) => s + l.modifications.length, 0);
  db.close();
  // la livraison : les nouvelles règles portent les valeurs finales et le journal livré (historique_modification)
  const nouvelles = join(racine, 'regles-livrees.db');
  copyFileSync(regles, nouvelles);
  const r = new DatabaseSync(nouvelles);
  r.prepare("UPDATE metier SET bonus_brut = '+2% Deux' WHERE id = 'metiers/acrobate'").run();
  // une version que ces règles (tirées de data/rows) ne portent pas encore
  const livree = versionLibre(r);
  r.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, '2026-10-11', NULL, NULL, 'lot-livraison', 0)").run(livree);
  const historique = r.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const l of journal.lots) {
    for (const m of l.modifications) {
      historique.run(l.id, m.rang, l.fait_le, l.resume, livree, m.table, JSON.stringify(m.cle), m.operation,
        m.avant === null ? null : JSON.stringify(m.avant), m.apres === null ? null : JSON.stringify(m.apres));
    }
  }
  r.close();
  // la base vivante est refaite pour ces règles : le journal livré est intégré, rien n'est rejoué
  const refaite = preparerBaseVivante({ regles: nouvelles, dossier });
  assert.equal(refaite.refaite, true);
  const b = ouvrirBaseVivante(refaite.chemin);
  const etats = Object.fromEntries(b.prepare('SELECT etat, count(*) AS n FROM modification GROUP BY etat').all().map((e) => [e.etat, e.n]));
  assert.deepEqual(etats, { integree: attendues }, 'ni en attente, ni en conflit');
  assert.equal(b.prepare('SELECT bonus_brut FROM metier WHERE id = ?').get('metiers/forgeron').bonus_brut, forgeron, 'la valeur annulée (B) ne revient pas');
  assert.equal(b.prepare('SELECT bonus_brut FROM metier WHERE id = ?').get('metiers/acrobate').bonus_brut, '+2% Deux');
  assert.equal(b.prepare('SELECT count(*) AS n FROM metier WHERE id = ?').get(id).n, 0);
  assert.equal(integrerLivrees(b), 0, 'idempotent');
  b.close();
  assert.ok(acrobate !== '+2% Deux');
  assert.ok(existsSync(refaite.chemin));
});
