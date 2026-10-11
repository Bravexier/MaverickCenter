// Page « Mise à jour » côté service (serveur/notes-de-version.mjs, routes /api/mise-a-jour/ de api.mjs ; docs/serveur.md, « Mise à jour ») :
// fermée hors du site de dev, la liste production → dev calculée contre la base de référence, le champ libre (409 si changé entre-temps ou figé),
// le lancement (mot de confirmation, lot figé avec son empreinte, servi tel quel au workflow, déclenchement et suivi du run GitHub par un faux
// GitHub), l'annulation, et le lancement terminé quand sa note arrive dans les règles.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante, viderBrouillonLivre } from '../serveur/base-vivante.mjs';
import { demarrerService } from '../serveur/service.mjs';
import {
  actualiserLancement, CONFIRMATION, creerGithub, INTERVALLE_SUIVI, lireLancement, lireLot, WORKFLOW,
} from '../serveur/notes-de-version.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-notes-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const regles = cheminBase({ sansExemples: false });
const dossier = join(racine, 'db');
const { chemin } = preparerBaseVivante({ regles, dossier });
const db = ouvrirBaseVivante(chemin);
after(() => db.close());

// la « production » : les mêmes règles, un sort plus cher et un métier en moins (la dev les a donc baissé et ajouté)
const reference = join(racine, 'reference.db');
copyFileSync(regles, reference);
{
  const ref = new DatabaseSync(reference);
  const sort = ref.prepare("SELECT id, cout_brut FROM sort WHERE cout_brut GLOB '[0-9]' ORDER BY id LIMIT 1").get();
  ref.prepare('UPDATE sort SET cout_brut = ?, cout_chakra = ? WHERE id = ?').run(String(Number(sort.cout_brut) + 2), Number(sort.cout_brut) + 2, sort.id);
  ref.exec("PRAGMA foreign_keys = OFF; DELETE FROM metier_bonus WHERE metier_id = 'metiers/forgeron'; DELETE FROM metier_recette_famille WHERE metier_id = 'metiers/forgeron'; DELETE FROM metier WHERE id = 'metiers/forgeron'");
  ref.close();
  writeFileSync(join(racine, 'reference.json'), `${JSON.stringify({ version: '0.1.0', commit: 'abc', ref: 'origin/master' })}\n`);
}

const journal = [];
const service = {
  base: () => db, etat: () => ({ service: 'essai', version: '0.1.76' }), journal: (l) => journal.push(l), edition: true,
  dossier, reference, depot: 'Bravexier/MaverickCenter', adresse: 'https://dev.exemple.org', github: null,
};
const JSON_ = { 'content-type': 'application/json' };
const appel = (methode, chemin_, corps, s = service, entetes = JSON_) =>
  traiter({ methode, chemin: chemin_, entetes, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);

test('fermée hors du site de dev : 403 partout, lot compris ; adresses inconnues 404, méthodes 405', () => {
  const ferme = { ...service, edition: false };
  for (const [m, c] of [['GET', '/api/mise-a-jour/'], ['POST', '/api/mise-a-jour/brouillon/'], ['POST', '/api/mise-a-jour/lancer/'],
    ['GET', '/api/mise-a-jour/lots/00000000-0000-0000-0000-000000000000/']]) {
    assert.equal(appel(m, c, m === 'POST' ? {} : undefined, ferme).statut, 403, c);
  }
  assert.equal(appel('GET', '/api/mise-a-jour/inconnue/').statut, 404);
  assert.equal(appel('GET', '/api/mise-a-jour/lots/').statut, 404);
  assert.equal(appel('GET', '/api/mise-a-jour/lots/pas-un-id/').statut, 404);
  assert.equal(appel('POST', '/api/mise-a-jour/').statut, 405);
  assert.equal(appel('GET', '/api/mise-a-jour/lancer/').statut, 405);
  assert.equal(appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'x' }, service, { 'content-type': 'text/plain' }).statut, 415);
  assert.equal(appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'x' }, service, { ...JSON_, 'sec-fetch-site': 'cross-site' }).statut, 403);
});

test('la note en préparation : production (référence) → dev, version cible, bilan ; sans référence, pas de liste', () => {
  const r = appel('GET', '/api/mise-a-jour/');
  assert.equal(r.statut, 200, JSON.stringify(r.corps).slice(0, 300));
  const n = r.corps;
  assert.equal(n.version_dev, '0.1.76');
  assert.equal(n.version_cible, '0.2');
  assert.deepEqual([n.reference.disponible, n.reference.version], [true, '0.1.0']);
  assert.equal(n.confirmation, CONFIRMATION);
  assert.deepEqual(n.github, { configure: false, depot: 'Bravexier/MaverickCenter' });
  assert.equal(n.lancement, null);
  assert.equal(n.en_attente, 0, 'aucune modification du site en attente');
  const cout = n.lignes.find((l) => l.domaine === 'sorts' && l.champ === 'Coût');
  assert.ok(cout, 'le coût baissé');
  assert.equal(cout.sens, 'amelioration');
  assert.equal(Number(cout.avant), Number(cout.apres) + 2);
  assert.ok(n.lignes.some((l) => l.domaine === 'metiers' && l.entite === 'Forgeron' && l.nature === 'ajoute'));
  assert.equal(n.bilan.total, n.lignes.length);
  const sans = appel('GET', '/api/mise-a-jour/', undefined, { ...service, reference: join(racine, 'absente.db') }).corps;
  assert.equal(sans.lignes, null);
  assert.equal(sans.reference.disponible, false);
  assert.equal(sans.version_cible, '0.2', 'master inconnu : X.Y+1 de la version de dev');
});

test('champ libre : enregistré, refusé (409) si quelqu’un l’a changé entre-temps', () => {
  let r = appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'Première version\r\n\r\n', avant: null });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(r.corps.brouillon.texte, 'Première version');
  assert.match(r.corps.brouillon.modifie_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  r = appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'Autre', avant: null });
  assert.equal(r.statut, 409);
  assert.equal(r.corps.brouillon.texte, 'Première version');
  r = appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'Les sorts de feu coûtent moins cher.', avant: 'Première version' });
  assert.equal(r.statut, 200);
  assert.equal(appel('POST', '/api/mise-a-jour/brouillon/', { texte: 42 }).statut, 400);
  assert.equal(appel('GET', '/api/mise-a-jour/').corps.brouillon.texte, 'Les sorts de feu coûtent moins cher.');
});

test('lancer : mot de confirmation exigé ; sans jeton, le lot est figé et la page dit de lancer à la main', () => {
  // une modification en attente, pour que le lot porte un journal
  const e = appel('POST', '/api/edition/', { page: 'metiers/', operations: [{ op: 'modifier', table: 'metier', cle: { id: 'metiers/forgeron' },
    valeurs: { bonus_brut: '+4% Arme lourde' } }] });
  assert.equal(e.statut, 200, JSON.stringify(e.corps));
  assert.equal(appel('POST', '/api/mise-a-jour/lancer/', { confirmation: 'oui' }).statut, 400);
  assert.equal(lireLancement(dossier), null, 'rien de figé');
  const r = appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION });
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  const l = r.corps.lancement;
  assert.equal(l.etat, 'manuel');
  assert.equal(lireLancement(dossier).etat, 'manuel', 'état gardé dans db/mise-a-jour/etat.json');
  assert.equal(l.version_cible, '0.2');
  assert.ok(l.modifications >= 1);
  assert.equal(l.adresse, `https://dev.exemple.org/api/mise-a-jour/lots/${l.lot}/`);
  // le lot, servi tel quel : son empreinte se vérifie, le journal n'a pas d'aperçu HTML, le champ libre y est
  const servi = appel('GET', `/api/mise-a-jour/lots/${l.lot}/`);
  assert.equal(servi.statut, 200);
  assert.equal(typeof servi.brut, 'string');
  assert.equal(createHash('sha256').update(servi.brut).digest('hex'), l.empreinte);
  const lot = JSON.parse(servi.brut);
  assert.equal(lot.format, 'maverick-mise-a-jour/1');
  assert.equal(lot.texte, 'Les sorts de feu coûtent moins cher.');
  assert.equal(lot.version_cible, '0.2');
  assert.ok(lot.journal.lots.length >= 1);
  assert.ok(lot.journal.lots.every((x) => x.modifications.every((m) => !('apercu' in m))));
  assert.equal(lireLot(dossier, '../etat'), null, 'un id hors format ne lit aucun fichier');
  // figé : le texte ne se modifie plus, un second lancement est refusé
  assert.equal(appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'x', avant: 'Les sorts de feu coûtent moins cher.' }).statut, 409);
  assert.equal(appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }).statut, 409);
  assert.match(journal.at(-1), /^mise à jour : lot .+ figé/);
  // annulé : le texte redevient modifiable
  const a = appel('POST', '/api/mise-a-jour/liberer/', {});
  assert.equal(a.statut, 200);
  assert.equal(a.corps.lancement.etat, 'annule');
  assert.equal(appel('GET', '/api/mise-a-jour/').corps.brouillon.lot, null);
});

test('adresse publique : celle du service, sinon l’hôte de la requête (https hors poste local), sinon refus', () => {
  const sansAdresse = { ...service, adresse: null };
  const r = appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }, sansAdresse, { ...JSON_, host: 'dev.maverick-jdr.com' });
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  assert.match(r.corps.lancement.adresse, /^https:\/\/dev\.maverick-jdr\.com\/api\/mise-a-jour\/lots\/[0-9a-f-]{36}\/$/);
  appel('POST', '/api/mise-a-jour/liberer/', {});
  assert.equal(appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }, sansAdresse, { ...JSON_, host: 'a b' }).statut, 500);
  assert.equal(appel('GET', '/api/mise-a-jour/').corps.brouillon.lot, null, 'refusé : rien de figé');
});

test('GitHub : déclenchement du workflow sur dev, suivi du run, échec, refus d’annuler pendant le run', async () => {
  const appels = [];
  let run = { status: 'in_progress', conclusion: null, html_url: 'https://github.com/x/runs/7' };
  const fauxFetch = async (url, options = {}) => {
    appels.push({ url, methode: options.method ?? 'GET', corps: options.body ? JSON.parse(options.body) : null, auth: options.headers.Authorization });
    if (url.endsWith('/dispatches')) return new Response(JSON.stringify({ workflow_run_id: 7, html_url: 'https://github.com/x/runs/7' }), { status: 200 });
    if (url.endsWith('/actions/runs/7')) return new Response(JSON.stringify(run), { status: 200 });
    return new Response('?', { status: 404 });
  };
  let jeton = null;
  const github = creerGithub({ dossier, depot: 'Bravexier/MaverickCenter', lireJeton: () => jeton, fetch: fauxFetch });
  const s = { ...service, github };
  assert.equal(appel('GET', '/api/mise-a-jour/', undefined, s).corps.github.configure, false);
  jeton = 'jeton-actions';
  const r = appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }, s);
  assert.equal(r.statut, 202);
  assert.equal(r.corps.lancement.etat, 'envoi');
  assert.equal(r.corps.github.configure, true);
  // le déclenchement part en arrière-plan : on attend qu'il ait écrit l'état
  for (let i = 0; i < 50 && lireLancement(dossier).etat === 'envoi'; i++) await new Promise((ok) => setTimeout(ok, 10));
  const lance = lireLancement(dossier);
  assert.equal(lance.etat, 'lance');
  assert.deepEqual(lance.run, { id: 7, url: 'https://github.com/x/runs/7', statut: 'queued', conclusion: null });
  const d = appels[0];
  assert.equal(d.url, `https://api.github.com/repos/Bravexier/MaverickCenter/actions/workflows/${WORKFLOW}/dispatches`);
  assert.equal(d.methode, 'POST');
  assert.equal(d.auth, 'Bearer jeton-actions');
  assert.deepEqual(d.corps, { ref: 'dev', inputs: { lot: lance.lot, empreinte: lance.empreinte, adresse: lance.adresse, essai: 'false' }, return_run_details: true });
  assert.equal(appel('POST', '/api/mise-a-jour/liberer/', {}, s).statut, 409, 'pas d’annulation pendant le run');
  // suivi : en cours, puis échec (au plus une interrogation par INTERVALLE_SUIVI)
  const t0 = 1_000_000_000_000;
  assert.equal((await github.suivre({ maintenant: t0 })).etat, 'en_cours');
  run = { status: 'completed', conclusion: 'failure', html_url: run.html_url };
  assert.equal((await github.suivre({ maintenant: t0 + 1000 })).etat, 'en_cours', 'trop tôt : pas d’appel');
  assert.equal((await github.suivre({ maintenant: t0 + INTERVALLE_SUIVI })).etat, 'echec');
  assert.equal(appels.filter((a) => a.url.endsWith('/runs/7')).length, 2);
  // échec : l'annulation rend le texte modifiable
  assert.equal(appel('POST', '/api/mise-a-jour/liberer/', {}, s).corps.lancement.etat, 'annule');
  // GitHub refuse le déclenchement : état « erreur », message gardé
  const refus = creerGithub({ dossier, depot: 'x/y', lireJeton: () => 'j', fetch: async () => new Response('Bad credentials', { status: 401 }) });
  appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }, { ...service, github: refus });
  for (let i = 0; i < 50 && lireLancement(dossier).etat === 'envoi'; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(lireLancement(dossier).etat, 'erreur');
  assert.match(lireLancement(dossier).erreur, /401 : Bad credentials/);
});

test('annulé pendant l’envoi à GitHub : le run parti quand même est annulé, l’état reste « annulé », le texte reste libre', async () => {
  appel('POST', '/api/mise-a-jour/liberer/', {});
  let repondre;
  const appels = [];
  const fauxFetch = (url, options = {}) => {
    appels.push({ url, methode: options.method ?? 'GET' });
    if (url.endsWith('/dispatches')) return new Promise((ok) => { repondre = () => ok(new Response(JSON.stringify({ workflow_run_id: 11, html_url: 'u' }), { status: 200 })); });
    if (url.endsWith('/actions/runs/11/cancel')) return Promise.resolve(new Response('', { status: 202 }));
    return Promise.resolve(new Response('?', { status: 404 }));
  };
  const github = creerGithub({ dossier, depot: 'Bravexier/MaverickCenter', lireJeton: () => 'j', fetch: fauxFetch, journal: () => {} });
  const s = { ...service, github };
  assert.equal(appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }, s).corps.lancement.etat, 'envoi');
  for (let i = 0; i < 50 && !repondre; i++) await new Promise((ok) => setTimeout(ok, 5));
  assert.equal(appel('POST', '/api/mise-a-jour/liberer/', {}, s).corps.lancement.etat, 'annule', 'annulable tant qu’il est en envoi');
  repondre();
  for (let i = 0; i < 50 && !appels.some((a) => a.url.endsWith('/cancel')); i++) await new Promise((ok) => setTimeout(ok, 10));
  await new Promise((ok) => setTimeout(ok, 20));
  const l = lireLancement(dossier);
  assert.equal(l.etat, 'annule', 'jamais réécrit en « lancé »');
  assert.equal(l.run.id, 11);
  assert.equal(l.erreur, null);
  assert.deepEqual(appels.filter((a) => a.url.endsWith('/cancel')).map((a) => a.methode), ['POST']);
  assert.equal(appel('GET', '/api/mise-a-jour/', undefined, s).corps.brouillon.lot, null);
});

test('simulation de mise à jour : le workflow reçoit essai=true ; finie (réussie ou non), le lot est libéré, rien n’est livré', async () => {
  const precedent = lireLancement(dossier);
  appel('POST', '/api/mise-a-jour/liberer/', {}); // l'état laissé par le test précédent (erreur) : le texte redevient modifiable
  const appels = [];
  let run = { status: 'in_progress', conclusion: null, html_url: 'https://github.com/x/runs/9' };
  const fauxFetch = async (url, options = {}) => {
    appels.push({ url, corps: options.body ? JSON.parse(options.body) : null });
    if (url.endsWith('/dispatches')) return new Response(JSON.stringify({ workflow_run_id: 9, html_url: run.html_url }), { status: 200 });
    if (url.endsWith('/actions/runs/9')) return new Response(JSON.stringify(run), { status: 200 });
    return new Response('?', { status: 404 });
  };
  const github = creerGithub({ dossier, depot: 'Bravexier/MaverickCenter', lireJeton: () => 'j', fetch: fauxFetch });
  const s = { ...service, github };
  assert.equal(appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION, simulation: 'oui' }).corps.lancement.simulation, false,
    'seul true demande une simulation');
  appel('POST', '/api/mise-a-jour/liberer/', {});
  // une vraie mise à jour : essai=false (son run échoue tout de suite pour libérer la place)
  run = { ...run, status: 'completed', conclusion: 'failure' };
  appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }, s);
  for (let i = 0; i < 50 && lireLancement(dossier).etat === 'envoi'; i++) await new Promise((ok) => setTimeout(ok, 10));
  await github.suivre({ maintenant: 1_000_000_000_000 });
  assert.equal(lireLancement(dossier).etat, 'echec');
  appel('POST', '/api/mise-a-jour/liberer/', {}, s);
  run = { status: 'in_progress', conclusion: null, html_url: run.html_url };
  const r = appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION, simulation: true }, s);
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  assert.equal(r.corps.lancement.simulation, true);
  for (let i = 0; i < 50 && lireLancement(dossier).etat === 'envoi'; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(appels.filter((a) => a.url.endsWith('/dispatches')).at(-1).corps.inputs.essai, 'true');
  assert.equal(appels.filter((a) => a.url.endsWith('/dispatches')).at(-2).corps.inputs.essai, 'false', 'une vraie mise à jour : essai=false');
  assert.ok(appel('GET', '/api/mise-a-jour/', undefined, s).corps.brouillon.lot, 'pendant la simulation, le texte est figé');
  assert.equal(appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }, s).statut, 409, 'pas de second lancement pendant la simulation');
  // fin réussie : le lot est libéré, l'état dit « simulation réussie »
  run = { ...run, status: 'completed', conclusion: 'success' };
  await github.suivre({ maintenant: 2_000_000_000_000 });
  assert.equal(lireLancement(dossier).etat, 'termine');
  const n = appel('GET', '/api/mise-a-jour/', undefined, s).corps;
  assert.equal(n.lancement.etat, 'simulation_reussie');
  assert.equal(n.brouillon.lot, null, 'le texte redevient modifiable');
  // une seconde simulation qui échoue : libérée aussi
  appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION, simulation: true }, s);
  for (let i = 0; i < 50 && lireLancement(dossier).etat === 'envoi'; i++) await new Promise((ok) => setTimeout(ok, 10));
  run = { ...run, status: 'completed', conclusion: 'failure' };
  await github.suivre({ maintenant: 3_000_000_000_000 });
  const m = appel('GET', '/api/mise-a-jour/lancement/', undefined, s).corps;
  assert.equal(m.lancement.etat, 'simulation_echouee');
  assert.equal(appel('GET', '/api/mise-a-jour/', undefined, s).corps.brouillon.lot, null);
  // une simulation réussie ne bloque pas une vraie mise à jour (qui, elle, reste verrouillée jusqu'à sa livraison)
  const vraie = appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION }, { ...service, github: null });
  assert.equal(vraie.statut, 202);
  assert.equal(vraie.corps.lancement.simulation, false);
  // remet l'état d'erreur attendu par le test suivant (un lancement figé dont la note arrivera dans les règles)
  writeFileSync(join(dossier, 'mise-a-jour', 'etat.json'), `${JSON.stringify({ ...lireLancement(dossier), etat: 'erreur', erreur: precedent?.erreur ?? 'x' }, null, 2)}\n`);
});

test('la note livrée arrive dans les règles : lancement terminé, brouillon vidé (base vivante refaite)', () => {
  const l = lireLancement(dossier);
  assert.equal(l.etat, 'erreur');
  assert.ok(appel('GET', '/api/mise-a-jour/').corps.brouillon.lot, 'lot encore figé');
  // ce que fait la nouvelle version du site : la note de version porte le lot (scripts/mise-a-jour-regles.mjs)
  db.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('0.2', '2026-10-11', '0.1', NULL, ?, 0)").run(l.lot);
  const actuel = actualiserLancement(db, dossier);
  assert.deepEqual([actuel.etat, actuel.version_livree], ['termine', '0.2']);
  assert.equal(appel('POST', '/api/mise-a-jour/liberer/', {}).statut, 409, 'livré : rien à annuler');
  viderBrouillonLivre(db);
  const n = appel('GET', '/api/mise-a-jour/').corps;
  assert.equal(n.brouillon.lot, null);
  assert.equal(n.brouillon.texte, null);
  assert.equal(n.lancement.etat, 'termine');
  // un brouillon dont le lot n'est pas livré reste
  appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'Suite' });
  viderBrouillonLivre(db);
  assert.equal(appel('GET', '/api/mise-a-jour/').corps.brouillon.texte, 'Suite');
});

test('par le service HTTP : adresse publique et jeton passés au démarrage, lot servi tel quel', async () => {
  const dossier2 = join(racine, 'db-http');
  const jeton = join(racine, 'jeton');
  writeFileSync(jeton, '');
  const s = await demarrerService({ regles, dossier: dossier2, port: 0, intervalle: 0, edition: true, reference, adresse: 'https://dev.exemple.org/',
    jetonFichier: jeton, versionParDefaut: '0.1.76', journal: () => {}, relancer: () => {} });
  try {
    const n = await (await fetch(`${s.url}/api/mise-a-jour/`)).json();
    assert.equal(n.version_cible, '0.2');
    assert.equal(n.github.configure, false, 'fichier du jeton vide');
    const r = await fetch(`${s.url}/api/mise-a-jour/lancer/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: CONFIRMATION }) });
    const l = (await r.json()).lancement;
    assert.equal(r.status, 202);
    assert.equal(l.adresse, `https://dev.exemple.org/api/mise-a-jour/lots/${l.lot}/`);
    const lot = await fetch(`${s.url}/api/mise-a-jour/lots/${l.lot}/`);
    assert.equal(lot.status, 200);
    assert.match(lot.headers.get('content-type'), /^application\/json/);
    assert.equal(createHash('sha256').update(Buffer.from(await lot.arrayBuffer())).digest('hex'), l.empreinte, 'octet pour octet');
  } finally {
    await s.arreter();
  }
});
