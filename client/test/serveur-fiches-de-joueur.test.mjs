// Les fiches de joueur dans le service (client/serveur/fiches.mjs, api.mjs, utilisateurs.mjs ; décision R318, étape E8 ; docs/serveur.md, « Fiches de joueur ») :
// le service lit et écrit une fiche de joueur selon son propriétaire et sa visibilité (v_personnage_visible, d'après `utilisateur.niveau`), le Créateur la range à un
// compte, le menu « Visible par » (tous, mj, privée) ; et le prétiré reste ouvert à tout visiteur, sans session (R307). Les sessions sont des cookies signés d'essai
// (test/aide-acces-d-essai.mjs), les comptes de la table `utilisateur` (test/aide-compte-d-essai.mjs) : aucun appel réseau.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { appelantDe, enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { poserLAcces } from './aide-acces-d-essai.mjs';
import { poserUnCompte } from './aide-compte-d-essai.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const JSON_ = { 'content-type': 'application/json' };
const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));
const ADRESSE = '/api/personnages/';

/**
 * Un service d'essai : la base vivante (le schéma de data/schema.sql, sans règle), six comptes, un prétiré et cinq fiches de joueur, et de quoi appeler `traiter` en
 * tant que chacun. `edition` : le site de dev (une porte, des clés) ; sinon la production (aucune porte, R307).
 */
function monde(t, { edition = false } = {}) {
  const dossier = dossierTemporaire('fiches-de-joueur', { t });
  const regles = join(dossier, 'maverick.db');
  const schema = new DatabaseSync(regles);
  schema.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  schema.close();
  const { chemin } = preparerBaseVivante({ regles, dossier: join(dossier, 'db') });
  const db = ouvrirBaseVivante(chemin);
  const a = poserLAcces({ prefixe: 'fiches-de-joueur', edition });
  const comptes = [['u-createur', 'Créatrice', 'createur'], ['u-mj', 'Maître', 'mj'], ['u-a', 'Alice', 'joueur'], ['u-b', 'Bob', 'joueur'], ['u-c', 'Carole', 'joueur'], ['u-obs', 'Visiteuse', 'observateur']];
  for (const [id, nom, niveau] of comptes) poserUnCompte(db, id, nom, undefined, { niveau });
  const journal = [];
  const service = { edition, base: () => db, etat: () => ({ service: 'essai' }), journal: (l) => journal.push(l), dossier, acces: a.acces, connexion: a.connexion };
  const session = (niveau, u) => ({ cookie: a.session(niveau, { u }).cookie });
  const qui = {
    rien: {}, cle: a.avecCle, obs: session('observateur', 'u-obs'), a: session('joueur', 'u-a'), b: session('joueur', 'u-b'), c: session('joueur', 'u-c'),
    mj: session('mj', 'u-mj'), createur: session('createur', 'u-createur'),
  };
  const appel = (methode, chemin_, { de = 'rien', corps, entetes = {} } = {}) => traiter({
    methode, chemin: chemin_, entetes: { ...JSON_, ...qui[de], ...entetes }, corps: corps === undefined ? undefined : JSON.stringify(corps),
  }, service);
  // une fiche : un prétiré enregistré par le service, puis donné à un compte avec sa visibilité (la forme que R318 permet)
  const fiche = (nom, proprietaire = null, visibilite = 'tous') => {
    const id = enregistrerFiche(db, { nom }).personnage.id;
    if (proprietaire) db.prepare("UPDATE personnage SET nature = 'joueur', proprietaire_id = ?, visibilite = ? WHERE id = ?").run(proprietaire, visibilite, id);
    return id;
  };
  const f = {
    pretire: fiche('Le prétiré'),
    at: fiche('Alice tous', 'u-a', 'tous'), ap: fiche('Alice privée', 'u-a', 'privee'), am: fiche('Alice mj', 'u-a', 'mj'),
    bt: fiche('Bob tous', 'u-b', 'tous'), bp: fiche('Bob privée', 'u-b', 'privee'),
  };
  const createur = appelantDe({ u: 'u-createur', n: 'createur' });
  const version = (id) => lireFiche(db, id, createur).version;
  const ligne = (id) => ({ ...db.prepare('SELECT nature, proprietaire_id, visibilite, nom FROM personnage WHERE id = ?').get(id) });
  const liste = (de) => appel('GET', ADRESSE, { de }).corps.personnages.map((p) => p.id).sort();
  return { db, a, appel, f, qui, journal, version, ligne, liste, dossier };
}
const tri = (...ids) => ids.sort();

test('R318 : la liste montre les prétirés, plus ce que v_personnage_visible ouvre au niveau du compte de la session (tous : Joueur et +, mj : MJ et Créateur, privée : le propriétaire et le Créateur) ; sans session, les prétirés seuls', (t) => {
  const m = monde(t);
  const { pretire, at, ap, am, bt, bp } = m.f;
  assert.deepEqual(m.liste('rien'), tri(pretire), 'sans session : le prétiré seulement (R307)');
  assert.deepEqual(m.liste('obs'), tri(pretire), 'l’Observateur ne voit aucune fiche de joueur, même « tous » (la vue ne lui donne rien)');
  assert.deepEqual(m.liste('c'), tri(pretire, at, bt), 'un Joueur sans fiche : les fiches « tous »');
  assert.deepEqual(m.liste('a'), tri(pretire, at, ap, am, bt), 'le propriétaire voit les siennes, quelle que soit leur visibilité, et les « tous » des autres');
  assert.deepEqual(m.liste('b'), tri(pretire, at, bt, bp));
  assert.deepEqual(m.liste('mj'), tri(pretire, at, am, bt), 'un MJ : « tous » et « mj », jamais une fiche privée d’un autre');
  assert.deepEqual(m.liste('createur'), tri(pretire, at, ap, am, bt, bp), 'un Créateur voit tout');

  // chaque élément dit sa nature, son propriétaire, sa visibilité et si la fiche est à l'appelant
  const liste = m.appel('GET', ADRESSE, { de: 'a' }).corps.personnages;
  const de = (id) => liste.find((p) => p.id === id);
  assert.deepEqual([de(pretire).nature, de(pretire).proprietaire, de(pretire).visibilite, de(pretire).a_moi], ['pretire', null, 'tous', false]);
  assert.deepEqual([de(ap).nature, de(ap).proprietaire, de(ap).visibilite, de(ap).a_moi], ['joueur', { id: 'u-a', nom_affichage: 'Alice' }, 'privee', true]);
  assert.deepEqual([de(bt).nature, de(bt).proprietaire, de(bt).visibilite, de(bt).a_moi], ['joueur', { id: 'u-b', nom_affichage: 'Bob' }, 'tous', false]);
  // le reste du résumé est celui des prétirés (identité, classes, niveau, anomalies)
  for (const p of liste) for (const cle of ['nom', 'portrait', 'classes', 'niveau_global', 'anomalies', 'cree_le', 'modifie_le']) assert.ok(cle in p, `${p.id} : ${cle}`);
});

test('R307 : sans session le prétiré se lit et s’écrit comme avant (production, aucune porte) ; la clé de lecture du site de dev ne donne que les prétirés, jamais une fiche de joueur', (t) => {
  const m = monde(t);
  const { pretire, at } = m.f;
  assert.equal(m.appel('GET', `${ADRESSE}${pretire}/`).statut, 200);
  const creation = m.appel('POST', ADRESSE, { corps: { nom: 'Nouveau' } });
  assert.equal(creation.statut, 201);
  const id = creation.corps.personnage.id;
  assert.deepEqual([creation.corps.proprietaire, creation.corps.a_moi, creation.corps.peut_ecrire], [null, false, true]);
  assert.equal(m.appel('PUT', `${ADRESSE}${id}/`, { corps: { version: creation.corps.personnage.version, nom: 'Renommé' } }).statut, 200);
  assert.equal(m.ligne(id).nom, 'Renommé');
  assert.equal(m.appel('DELETE', `${ADRESSE}${id}/`, { corps: { version: m.version(id) } }).statut, 200);
  // une fiche de joueur, même « tous », n'existe pas sans session
  assert.equal(m.appel('GET', `${ADRESSE}${at}/`).statut, 404);

  // le site de dev : la clé de lecture n'est pas une session
  const dev = monde(t, { edition: true });
  assert.deepEqual(dev.liste('cle'), tri(dev.f.pretire));
  assert.equal(dev.appel('GET', `${ADRESSE}${dev.f.at}/`, { de: 'cle' }).statut, 404);
  assert.equal(dev.appel('GET', `${ADRESSE}${dev.f.pretire}/`, { de: 'cle' }).statut, 200);
});

test('R318 : une fiche de joueur non vue répond 404 comme une fiche inconnue (fiche et portrait), sans dire qu’elle existe ; vue, elle porte son propriétaire, « à moi » et « je peux l’écrire »', (t) => {
  const m = monde(t);
  const { ap, at } = m.f;
  m.db.prepare('UPDATE personnage SET portrait = ? WHERE id = ?').run(IMAGES.webp, ap);
  const inconnue = m.appel('GET', `${ADRESSE}fiche-inconnue/`, { de: 'b' });
  assert.equal(inconnue.statut, 404);
  for (const de of ['rien', 'obs', 'b', 'mj']) {
    const r = m.appel('GET', `${ADRESSE}${ap}/`, { de });
    assert.deepEqual([r.statut, r.corps], [404, inconnue.corps], `fiche privée vue de « ${de} »`);
    assert.equal(m.appel('GET', `${ADRESSE}${ap}/portrait/`, { de }).statut, 404, `portrait vu de « ${de} »`);
  }
  for (const de of ['a', 'createur']) {
    assert.equal(m.appel('GET', `${ADRESSE}${ap}/`, { de }).statut, 200, de);
    const portrait = m.appel('GET', `${ADRESSE}${ap}/portrait/`, { de });
    assert.equal(portrait.statut, 200, de);
    assert.ok(portrait.brut.length > 0);
  }
  // une fiche « tous » : vue d'un Joueur et d'un MJ, écrite de son seul propriétaire et d'un Créateur
  const droits = (de) => { const c = m.appel('GET', `${ADRESSE}${at}/`, { de }).corps; return [c.proprietaire, c.a_moi, c.peut_ecrire]; };
  assert.deepEqual(droits('a'), [{ id: 'u-a', nom_affichage: 'Alice' }, true, true]);
  assert.deepEqual(droits('b'), [{ id: 'u-a', nom_affichage: 'Alice' }, false, false]);
  assert.deepEqual(droits('mj'), [{ id: 'u-a', nom_affichage: 'Alice' }, false, false]);
  assert.deepEqual(droits('createur'), [{ id: 'u-a', nom_affichage: 'Alice' }, false, true]);
  assert.equal(m.appel('GET', `${ADRESSE}${at}/`, { de: 'rien' }).statut, 404);
});

test('R318 : écrire une fiche de joueur (PUT, DELETE) demande son propriétaire ou un Créateur — 403 si elle se voit sans être à soi, 404 si elle n’est pas vue — ; un PUT ne change ni nature, ni propriétaire, ni visibilité', (t) => {
  const m = monde(t);
  const { at, ap, bt } = m.f;
  const modifier = (de, id, extra = {}) => m.appel('PUT', `${ADRESSE}${id}/`, { de, corps: { version: m.version(id), nom: `Par ${de}`, ...extra } });

  // le propriétaire : sa fiche change, mais jamais ce que le service fixe, même envoyé dans le corps
  const r = modifier('a', at, { nature: 'pretire', proprietaire_id: null, visibilite: 'privee' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(m.ligne(at), { nature: 'joueur', proprietaire_id: 'u-a', visibilite: 'tous', nom: 'Par a' });
  assert.deepEqual([r.corps.a_moi, r.corps.peut_ecrire, r.corps.proprietaire], [true, true, { id: 'u-a', nom_affichage: 'Alice' }]);
  assert.deepEqual(m.appel('GET', `${ADRESSE}${at}/`, { de: 'a' }).corps, r.corps, 'relue à l’identique');

  // une fiche vue sans être à soi : 403, rien n'est écrit ; une fiche non vue : 404
  for (const de of ['b', 'mj']) {
    assert.equal(modifier(de, at).statut, 403, `${de} sur une fiche « tous »`);
    assert.equal(m.appel('DELETE', `${ADRESSE}${at}/`, { de, corps: { version: m.version(at) } }).statut, 403, `${de} supprime une fiche « tous »`);
  }
  for (const de of ['rien', 'obs', 'b', 'mj']) {
    assert.equal(modifier(de, ap).statut, 404, `${de} sur une fiche privée`);
    assert.equal(m.appel('DELETE', `${ADRESSE}${ap}/`, { de, corps: { version: m.version(ap) } }).statut, 404, `${de} supprime une fiche privée`);
  }
  for (const de of ['rien', 'obs', 'c']) assert.notEqual(modifier(de, bt).statut, 200, de);
  assert.equal(m.ligne(at).nom, 'Par a');
  assert.equal(m.ligne(ap).nom, 'Alice privée');

  // un Créateur écrit toutes les fiches, y compris une fiche privée d'un joueur
  assert.equal(modifier('createur', ap).statut, 200);
  assert.deepEqual(m.ligne(ap), { nature: 'joueur', proprietaire_id: 'u-a', visibilite: 'privee', nom: 'Par createur' });

  // suppression : la version lue est exigée (409), puis la fiche et ses lignes partent
  assert.equal(m.appel('DELETE', `${ADRESSE}${at}/`, { de: 'a', corps: { version: 'ancienne' } }).statut, 409);
  assert.equal(m.appel('DELETE', `${ADRESSE}${at}/`, { de: 'a', corps: { version: m.version(at) } }).statut, 200);
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM personnage WHERE id = ?').get(at).n, 0);
  assert.equal(m.appel('DELETE', `${ADRESSE}${bt}/`, { de: 'createur', corps: { version: m.version(bt) } }).statut, 200);
  // le journal dit la nature, jamais le nom du joueur
  assert.ok(m.journal.some((l) => l.includes(`de la fiche de joueur ${at}`)), m.journal.join('\n'));
  assert.ok(!m.journal.some((l) => /Alice|Bob/.test(l)));
});

test('R318 : POST crée toujours un prétiré (à personne, visible de tous), même d’une session et avec une nature, un propriétaire ou une visibilité dans le corps', (t) => {
  const m = monde(t);
  for (const de of ['a', 'createur']) {
    const r = m.appel('POST', ADRESSE, { de, corps: { nom: `Neuf ${de}`, nature: 'joueur', proprietaire_id: 'u-a', visibilite: 'privee' } });
    assert.equal(r.statut, 201, JSON.stringify(r.corps));
    assert.deepEqual(m.ligne(r.corps.personnage.id), { nature: 'pretire', proprietaire_id: null, visibilite: 'tous', nom: `Neuf ${de}` }, de);
    assert.deepEqual([r.corps.proprietaire, r.corps.a_moi], [null, false]);
  }
});

test('R318 : le Créateur range une fiche à un compte (PUT …/proprietaire/) : elle devient une fiche de joueur, sa visibilité ne change pas ; compte inconnu 400, fiche inconnue 404 ; tout autre appelant 403', (t) => {
  const m = monde(t);
  const { pretire, ap } = m.f;
  const ranger = (de, id, corps) => m.appel('PUT', `${ADRESSE}${id}/proprietaire/`, { de, corps });

  // sans session de niveau Créateur : 403, y compris le propriétaire et un MJ, et rien ne change
  for (const de of ['rien', 'obs', 'a', 'mj']) {
    assert.equal(ranger(de, pretire, { utilisateur_id: 'u-a' }).statut, 403, de);
    assert.equal(m.ligne(pretire).nature, 'pretire', de);
  }
  // le prétiré, ouvert à tous, passe à un compte : visible de tous les Joueurs (« tous » est gardé), plus de l'Observateur ni du visiteur
  const r = ranger('createur', pretire, { utilisateur_id: 'u-a' });
  assert.deepEqual([r.statut, r.corps], [200, { id: pretire, nature: 'joueur', proprietaire: { id: 'u-a', nom_affichage: 'Alice' }, visibilite: 'tous' }]);
  assert.deepEqual(m.ligne(pretire), { nature: 'joueur', proprietaire_id: 'u-a', visibilite: 'tous', nom: 'Le prétiré' });
  assert.ok(m.liste('a').includes(pretire) && m.liste('b').includes(pretire) && m.liste('mj').includes(pretire));
  assert.ok(!m.liste('rien').includes(pretire) && !m.liste('obs').includes(pretire), 'plus un prétiré : ni le visiteur ni l’Observateur ne le voient');
  assert.equal(m.appel('GET', `${ADRESSE}${pretire}/`, { de: 'a' }).corps.a_moi, true);
  // la fiche d'un autre joueur, privée : elle change de main sans devenir visible
  assert.equal(ranger('createur', ap, { utilisateur_id: 'u-b' }).statut, 200);
  assert.deepEqual(m.ligne(ap), { nature: 'joueur', proprietaire_id: 'u-b', visibilite: 'privee', nom: 'Alice privée' });
  assert.ok(!m.liste('a').includes(ap) && m.liste('b').includes(ap));

  // refus : compte inconnu, corps sans compte, fiche inconnue ; rien n'est écrit
  const avant = m.ligne(m.f.bp);
  for (const corps of [{ utilisateur_id: 'u-inconnu' }, {}, { utilisateur_id: 12 }, { utilisateur_id: '' }]) assert.equal(ranger('createur', m.f.bp, corps).statut, 400, JSON.stringify(corps));
  assert.deepEqual(m.ligne(m.f.bp), avant);
  assert.equal(ranger('createur', 'fiche-inconnue', { utilisateur_id: 'u-a' }).statut, 404);
  assert.equal(m.appel('PUT', `${ADRESSE}${pretire}/proprietaire/`, { de: 'createur', corps: { utilisateur_id: 'u-a' }, entetes: { 'content-type': 'text/plain' } }).statut, 415);
  assert.equal(m.appel('GET', `${ADRESSE}${pretire}/proprietaire/`, { de: 'createur' }).statut, 405);
  assert.ok(m.journal.some((l) => l.includes(`fiche ${pretire} rangée au compte u-a`)));
  assert.ok(!m.journal.some((l) => /Alice|Bob/.test(l)));
});

test('R318 : « Visible par » — le propriétaire ou un Créateur règle tous, mj, privée ; « MJ » n’est accessible qu’aux MJ (niveau MJ ou Créateur) ; refus d’une valeur inconnue et d’un prétiré', (t) => {
  const m = monde(t);
  const { pretire, at, ap, am, bt } = m.f;
  const regler = (de, id, visibilite) => m.appel('PUT', `${ADRESSE}${id}/visibilite/`, { de, corps: { visibilite } });

  // le propriétaire (un Joueur) : privée puis tous ; la vue suit
  assert.deepEqual(regler('a', at, 'privee').corps, { id: at, visibilite: 'privee' });
  assert.ok(!m.liste('b').includes(at) && !m.liste('mj').includes(at) && m.liste('createur').includes(at));
  assert.equal(regler('a', at, 'tous').statut, 200);
  assert.ok(m.liste('b').includes(at));
  // l'option « MJ » n'est accessible que pour les MJ : un Joueur propriétaire ne la choisit pas, la fiche garde sa visibilité
  const refus = regler('a', at, 'mj');
  assert.equal(refus.statut, 403, JSON.stringify(refus.corps));
  assert.equal(m.ligne(at).visibilite, 'tous');
  // une fiche déjà « mj » (le compte a perdu son niveau de MJ) se rouvre à tous ou se ferme sans l'option
  assert.equal(regler('a', am, 'privee').statut, 200);
  assert.equal(regler('a', am, 'mj').statut, 403, 'et ne se remet pas à « mj » d’un Joueur');
  // un MJ propriétaire, un Créateur : « MJ » accepté, visible des MJ et Créateurs seulement
  const mjFiche = m.f.pretire;
  assert.equal(m.appel('PUT', `${ADRESSE}${mjFiche}/proprietaire/`, { de: 'createur', corps: { utilisateur_id: 'u-mj' } }).statut, 200);
  assert.equal(regler('mj', mjFiche, 'mj').statut, 200);
  assert.deepEqual([m.liste('mj').includes(mjFiche), m.liste('createur').includes(mjFiche), m.liste('a').includes(mjFiche), m.liste('rien').includes(mjFiche)], [true, true, false, false]);
  assert.equal(regler('createur', bt, 'mj').statut, 200, 'un Créateur règle la fiche d’un joueur, « MJ » compris');
  assert.equal(m.ligne(bt).visibilite, 'mj');
  assert.equal(regler('createur', ap, 'privee').statut, 200);

  // ni le propriétaire d'une autre fiche, ni un MJ, ni un visiteur : 403 si la fiche se voit, 404 sinon
  assert.equal(regler('b', at, 'privee').statut, 403);
  assert.equal(regler('mj', at, 'privee').statut, 403);
  for (const de of ['rien', 'obs', 'b', 'mj']) assert.equal(regler(de, ap, 'tous').statut, 404, de);
  assert.equal(m.ligne(at).visibilite, 'tous');
  assert.equal(m.ligne(ap).visibilite, 'privee');

  // une valeur inconnue ou absente : 400 ; un prétiré n'a pas de menu : 400 (toujours « tous ») ; fiche inconnue : 404
  const encore = m.f.bp;
  for (const visibilite of ['public', 'admin', '', undefined, 3, 'Tous']) assert.equal(regler('createur', encore, visibilite).statut, 400, String(visibilite));
  assert.equal(m.appel('PUT', `${ADRESSE}${encore}/visibilite/`, { de: 'createur', corps: {} }).statut, 400);
  assert.equal(m.ligne(encore).visibilite, 'privee');
  const prod = monde(t);
  assert.equal(prod.appel('PUT', `${ADRESSE}${prod.f.pretire}/visibilite/`, { de: 'createur', corps: { visibilite: 'privee' } }).statut, 400);
  assert.equal(prod.ligne(prod.f.pretire).visibilite, 'tous');
  assert.equal(regler('createur', 'fiche-inconnue', 'tous').statut, 404);
  assert.equal(m.appel('GET', `${ADRESSE}${at}/visibilite/`, { de: 'a' }).statut, 405);
  assert.equal(m.appel('PUT', `${ADRESSE}${pretire}/autre/`, { de: 'createur', corps: {} }).statut, 404);
});

test('R318 : GET /api/utilisateurs/ liste les comptes (id, nom_affichage, niveau) pour le menu de transfert, à une session de niveau Créateur seulement — 403 sinon, la clé de lecture comprise', (t) => {
  const m = monde(t);
  for (const de of ['rien', 'obs', 'a', 'mj']) {
    const r = m.appel('GET', '/api/utilisateurs/', { de });
    assert.equal(r.statut, 403, de);
    assert.ok(!('acces' in r.corps), 'un refus du service, pas de la porte');
  }
  const r = m.appel('GET', '/api/utilisateurs/', { de: 'createur' });
  assert.equal(r.statut, 200);
  assert.deepEqual(r.corps.utilisateurs.map((u) => u.id).sort(), ['u-a', 'u-b', 'u-c', 'u-createur', 'u-mj', 'u-obs']);
  for (const u of r.corps.utilisateurs) assert.deepEqual(Object.keys(u).sort(), ['id', 'niveau', 'nom_affichage'], 'ni identifiant Discord, ni image, ni date');
  assert.deepEqual(r.corps.utilisateurs.find((u) => u.id === 'u-b'), { id: 'u-b', nom_affichage: 'Bob', niveau: 'joueur' });
  assert.ok(!JSON.stringify(r.corps).includes('discord'), 'rien de Discord');
  assert.equal(m.appel('POST', '/api/utilisateurs/', { de: 'createur', corps: {} }).statut, 405);
  assert.equal(m.appel('GET', '/api/utilisateurs/x/', { de: 'createur' }).statut, 404);
});

test('R318 : sur le site de dev, la porte reste celle d’avant (lecture : MJ ou clé ; écriture : Créateur) et les routes nouvelles sont classées ; la clé de lecture n’est jamais une session de Créateur', (t) => {
  const m = monde(t, { edition: true });
  const { pretire, at } = m.f;
  // la liste des comptes : la porte laisse passer la lecture (MJ, clé) et le service exige le Créateur
  for (const de of ['cle', 'mj']) {
    const r = m.appel('GET', '/api/utilisateurs/', { de });
    assert.deepEqual([r.statut, 'acces' in r.corps], [403, false], de);
  }
  assert.deepEqual(['obs', 'a', 'rien'].map((de) => m.appel('GET', '/api/utilisateurs/', { de }).corps.acces), ['niveau', 'niveau', 'connexion']);
  assert.equal(m.appel('GET', '/api/utilisateurs/', { de: 'createur' }).statut, 200);
  // le transfert et la visibilité sont des écritures : un Créateur à la porte
  for (const de of ['cle', 'mj', 'a']) {
    assert.equal(m.appel('PUT', `${ADRESSE}${pretire}/proprietaire/`, { de, corps: { utilisateur_id: 'u-a' } }).corps.acces, de === 'cle' ? 'cle' : 'niveau', de);
    assert.equal(m.appel('PUT', `${ADRESSE}${at}/visibilite/`, { de, corps: { visibilite: 'privee' } }).corps.acces, de === 'cle' ? 'cle' : 'niveau', de);
  }
  assert.equal(m.ligne(pretire).nature, 'pretire');
  assert.equal(m.appel('PUT', `${ADRESSE}${pretire}/proprietaire/`, { de: 'createur', corps: { utilisateur_id: 'u-a' } }).statut, 200);
  // lire : un MJ voit ce que la vue lui ouvre, la clé les prétirés seuls
  assert.ok(m.liste('mj').includes(at) && m.liste('mj').includes(pretire));
  assert.deepEqual(m.liste('cle'), []);
});
