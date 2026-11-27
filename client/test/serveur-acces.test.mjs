// La porte du site de dev (client/serveur/acces.mjs ; docs/serveur.md, « Accès au site de dev » ; R275, R291, R310) : le site de dev est FERMÉ (sans session Discord de niveau
// MJ au moins ni clé, rien), le niveau de la porte est celui du cookie, les clés de lecture et de dépôt gardent leur comportement (R275, R291), le fichier des clés est lu sans
// redémarrage, un fichier d'avant R310 (mot de passe, portée) reste lisible sans rien ouvrir ni fermer de plus, et rien de secret n'est au journal.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DROITS, ENTETE_CLE, ENTETES_CLE, commandeAcces, connexionSecurisee, creerAcces, egaux, empreinteDeLaCle, nouvelleCle, nouvelleCleDeDepot, refus, reglageApres,
  validerReglage, valeursDuCookie,
} from '../serveur/acces.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';

const UUID = '00000000-0000-4000-8000-000000000000';
const sha = (x) => createHash('sha256').update(x).digest('hex');
const SESSIONS = { createur: { u: 'u-c', n: 'createur', exp: 2_000_000_000 }, mj: { u: 'u-m', n: 'mj', exp: 2_000_000_000 }, joueur: { u: 'u-j', n: 'joueur', exp: 2_000_000_000 },
  observateur: { u: 'u-o', n: 'observateur', exp: 2_000_000_000 } };
/** Une session par un en-tête fictif : `x-session: <niveau>` (la porte ne sait pas lire un cookie : la connexion le fait, serveur/discord.mjs). */
const session = (entetes) => SESSIONS[entetes['x-session']] ?? null;
/** Les clés posées dans un fichier de la copie, et la porte qui les lit. */
function poser({ depot = false, nom = 'acces.json' } = {}) {
  const fichier = fichierTemporaire(nom, 'acces');
  const premier = reglageApres({ refaireLaCle: true });
  let { reglage } = premier;
  let cleDeDepot = null;
  if (depot) ({ reglage, cleDeDepot } = reglageApres({ ancien: reglage, refaireLaCleDeDepot: true }));
  writeFileSync(fichier, JSON.stringify(reglage));
  const journal = [];
  const acces = creerAcces({ fichier, session, journal: (m) => journal.push(m) });
  return { fichier, reglage, cle: premier.cle, cleDeDepot, acces, journal };
}
const requete = (methode, chemin, entetes = {}) => ({ methode, chemin, entetes });

test('le fichier des clés : seulement des empreintes SHA-256 salées de rien, jamais une valeur en clair ; une clé de lecture et une clé de dépôt distinctes', () => {
  const lecture = reglageApres({ refaireLaCle: true });
  assert.match(lecture.cle, /^mvk_[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(Object.keys(lecture.reglage).sort(), ['cle_de_depot', 'cle_de_lecture', 'pose_le', 'version']);
  assert.equal(lecture.reglage.cle_de_lecture.empreinte, sha(lecture.cle));
  assert.equal(lecture.reglage.cle_de_depot, null);
  assert.ok(!JSON.stringify(lecture.reglage).includes(lecture.cle));
  const depot = reglageApres({ ancien: lecture.reglage, refaireLaCleDeDepot: true });
  assert.match(depot.cleDeDepot, /^mvd_[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(depot.reglage.cle_de_lecture, lecture.reglage.cle_de_lecture, 'poser la clé de dépôt garde la clé de lecture');
  assert.equal(depot.reglage.cle_de_depot.empreinte, sha(depot.cleDeDepot));
  assert.ok(!JSON.stringify(depot.reglage).includes(depot.cleDeDepot));
  assert.equal(depot.cle, null, 'la clé de lecture n’est pas réaffichée');
  // refaire la clé de lecture garde la clé de dépôt ; retirer la clé de dépôt garde la clé de lecture
  const refaite = reglageApres({ ancien: depot.reglage, refaireLaCle: true });
  assert.notDeepEqual(refaite.reglage.cle_de_lecture, depot.reglage.cle_de_lecture);
  assert.deepEqual(refaite.reglage.cle_de_depot, depot.reglage.cle_de_depot);
  const retiree = reglageApres({ ancien: depot.reglage, retirerLaCleDeDepot: true });
  assert.equal(retiree.reglage.cle_de_depot, null);
  assert.deepEqual(retiree.reglage.cle_de_lecture, depot.reglage.cle_de_lecture);
  assert.throws(() => reglageApres({ ancien: lecture.reglage, retirerLaCleDeDepot: true }), /aucune clé de dépôt/);
  assert.throws(() => reglageApres({ ancien: depot.reglage, refaireLaCleDeDepot: true, retirerLaCleDeDepot: true }), /en même temps/);
  // une clé de dépôt posée sans clé de lecture : permis (rien n'oblige à garder les deux)
  assert.deepEqual(reglageApres({ refaireLaCleDeDepot: true }).reglage.cle_de_lecture, null);
  // la validation
  assert.deepEqual(validerReglage(JSON.parse(JSON.stringify(depot.reglage))), depot.reglage);
  for (const [mauvais, motif] of [
    [{ ...depot.reglage, version: 2 }, /version/], [{ ...depot.reglage, cle_de_lecture: { empreinte: 'zz' } }, /clé de lecture/], [{ ...depot.reglage, cle_de_depot: { empreinte: 'zz' } }, /clé de dépôt/],
    [{ ...depot.reglage, cle_de_depot: depot.reglage.cle_de_lecture }, /doit différer/], [null, /illisible/], [[], /illisible/],
  ]) assert.throws(() => validerReglage(mauvais), motif);
  assert.notEqual(nouvelleCle(), nouvelleCle());
  assert.notEqual(nouvelleCleDeDepot(), nouvelleCleDeDepot());
  assert.equal(empreinteDeLaCle('a'), sha('a'));
});

test('R310 : un fichier d’avant (empreinte d’un mot de passe, portée, secret de session) reste lisible : ces champs sont ignorés, les clés marchent, rien ne se ferme', () => {
  const lecture = reglageApres({ refaireLaCle: true });
  const ancien = {
    ...lecture.reglage, portee: 'tout', secret_de_session: 'a'.repeat(64), pose_le: '2026-11-01T00:00:00.000Z',
    mot_de_passe: { algo: 'scrypt', n: 16384, r: 8, p: 1, sel: 'b'.repeat(32), empreinte: 'c'.repeat(64) },
  };
  const lu = validerReglage(ancien);
  assert.deepEqual(Object.keys(lu).sort(), ['cle_de_depot', 'cle_de_lecture', 'pose_le', 'version']);
  assert.equal(lu.pose_le, '2026-11-01T00:00:00.000Z');
  // même un mot de passe mal formé ne ferme rien (il est ignoré)
  assert.equal(validerReglage({ ...ancien, mot_de_passe: 'n’importe quoi', portee: 'inconnue', secret_de_session: 1 }).cle_de_lecture.empreinte, lecture.reglage.cle_de_lecture.empreinte);
  const fichier = fichierTemporaire('acces.json', 'acces-ancien');
  writeFileSync(fichier, JSON.stringify(ancien));
  const acces = creerAcces({ fichier, session });
  assert.equal(acces.droit({ [ENTETE_CLE]: lecture.cle }).droit, 'lecture');
  assert.equal(acces.controler(requete('GET', '/api/v1/', { [ENTETE_CLE]: lecture.cle })), null);
  // la première commande qui réécrit le fichier retire ces champs
  const apres = reglageApres({ ancien, refaireLaCleDeDepot: true }).reglage;
  assert.ok(!('mot_de_passe' in apres) && !('portee' in apres) && !('secret_de_session' in apres));
});

test('R310 (3) : le site de dev est fermé ; sans fichier de clés non plus rien ne s’ouvre ; chaque niveau a ce que sa classe permet', () => {
  const absent = creerAcces({ fichier: fichierTemporaire('absent.json', 'acces-absent'), session });
  const m = poser();
  for (const acces of [absent, m.acces]) {
    // sans rien : seule la classe ouverte passe
    assert.equal(acces.controler(requete('GET', '/api/etat/')), null);
    assert.equal(acces.controler(requete('GET', '/api/moi/')), null);
    assert.equal(acces.controler(requete('GET', `/api/mise-a-jour/lots/${UUID}/`)), null);
    for (const [methode, chemin] of [['GET', '/api/v1/'], ['GET', '/api/personnages/'], ['GET', '/api/edition/pages/'], ['GET', '/api/tipeee/'], ['POST', '/api/edition/lots/'], ['POST', '/api/edition/'],
      ['POST', '/api/mise-a-jour/lancer/'], ['GET', '/api/inconnue/']]) {
      const r = acces.controler(requete(methode, chemin));
      assert.equal(r.statut, 401, `${methode} ${chemin}`);
      assert.equal(r.corps.acces, 'connexion');
    }
    assert.equal(acces.droit({}).droit, 'aucun');
  }
  const classes = [['GET', '/api/v1/', 'lecture'], ['POST', '/api/edition/lots/', 'proposition'], ['POST', '/api/edition/', 'ecriture'], ['GET', '/api/inconnue/', 'ecriture']];
  const passe = (niveau, methode, chemin) => m.acces.controler(requete(methode, chemin, { 'x-session': niveau })) === null;
  for (const [methode, chemin, classe] of classes) {
    assert.equal(passe('createur', methode, chemin), true, `créateur : ${classe}`);
    assert.equal(passe('mj', methode, chemin), classe === 'lecture', `MJ : ${classe}`);
    assert.equal(passe('joueur', methode, chemin), false, `joueur : ${classe}`);
    assert.equal(passe('observateur', methode, chemin), false, `observateur : ${classe}`);
  }
  assert.deepEqual([...DROITS], ['aucun', 'lecture', 'depot', 'ecriture']);
});

test('les refus de la porte : 401 « connexion » sans rien ; 403 « niveau » (avec le niveau et celui qu’il faut) avec une session trop basse ; 403 « cle » avec une clé qui ne suffit pas ; jamais un secret', () => {
  const m = poser();
  const sans = m.acces.controler(requete('POST', '/api/edition/'));
  assert.deepEqual([sans.statut, sans.corps.acces], [401, 'connexion']);
  assert.ok(!('mot_de_passe' in sans.corps) && !JSON.stringify(sans).includes('mot de passe'), 'plus aucune trace du mot de passe');
  const mj = m.acces.controler(requete('POST', '/api/edition/', { 'x-session': 'mj' }));
  assert.deepEqual([mj.statut, mj.corps.acces, mj.corps.niveau, mj.corps.niveau_requis], [403, 'niveau', 'mj', 'createur']);
  const joueur = m.acces.controler(requete('GET', '/api/v1/', { 'x-session': 'joueur' }));
  assert.deepEqual([joueur.statut, joueur.corps.acces, joueur.corps.niveau, joueur.corps.niveau_requis], [403, 'niveau', 'joueur', 'mj']);
  const cle = m.acces.controler(requete('POST', '/api/edition/', { [ENTETE_CLE]: m.cle }));
  assert.deepEqual([cle.statut, cle.corps.acces], [403, 'cle']);
  assert.deepEqual(refus('lecture').corps.acces, 'connexion');
  // une clé fausse vaut aucune clé
  const fausse = m.acces.controler(requete('GET', '/api/v1/', { [ENTETE_CLE]: 'mvk_fausse' }));
  assert.deepEqual([fausse.statut, fausse.corps.acces], [401, 'connexion']);
  // une session de niveau trop bas et une clé suffisante : la clé ouvre (les deux droits se cumulent, le plus haut l'emporte)
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', { 'x-session': 'joueur', [ENTETE_CLE]: m.cle })), null);
  assert.equal(m.acces.droit({ 'x-session': 'joueur', [ENTETE_CLE]: m.cle }).droit, 'lecture');
  assert.equal(m.acces.droit({ 'x-session': 'mj', [ENTETE_CLE]: m.cle }).droit, 'lecture');
});

test('le droit : session Créateur = ecriture, session MJ ou clé de lecture = lecture, clé de dépôt = depot, jamais plus ; le niveau est celui du cookie', () => {
  const m = poser({ depot: true });
  const d = (entetes) => { const { droit, session: s, niveau, cle, expire_s: e } = m.acces.droit(entetes); return { droit, session: s, niveau, cle, expire_s: e }; };
  assert.deepEqual(d({}), { droit: 'aucun', session: false, niveau: null, cle: null, expire_s: null });
  assert.deepEqual(d({ 'x-session': 'createur' }), { droit: 'ecriture', session: true, niveau: 'createur', cle: null, expire_s: 2_000_000_000 });
  assert.deepEqual(d({ 'x-session': 'mj' }), { droit: 'lecture', session: true, niveau: 'mj', cle: null, expire_s: 2_000_000_000 });
  assert.deepEqual(d({ 'x-session': 'joueur' }), { droit: 'aucun', session: true, niveau: 'joueur', cle: null, expire_s: 2_000_000_000 });
  assert.deepEqual(d({ 'x-session': 'observateur' }), { droit: 'aucun', session: true, niveau: 'observateur', cle: null, expire_s: 2_000_000_000 });
  assert.deepEqual(d({ [ENTETE_CLE]: m.cle }), { droit: 'lecture', session: false, niveau: null, cle: 'lecture', expire_s: null });
  assert.deepEqual(d({ [ENTETE_CLE]: m.cleDeDepot }), { droit: 'depot', session: false, niveau: null, cle: 'depot', expire_s: null });
  assert.equal(d({ 'x-session': 'mj', [ENTETE_CLE]: m.cleDeDepot }).droit, 'depot', 'MJ + clé de dépôt : le plus haut');
  assert.equal(d({ 'x-session': 'createur', [ENTETE_CLE]: m.cle }).droit, 'ecriture');
  // les clés passent par X-Maverick-Cle et X-Maverick-Key seulement, jamais par un autre en-tête
  assert.deepEqual([...ENTETES_CLE], ['x-maverick-cle', 'x-maverick-key']);
  assert.equal(d({ 'x-maverick-key': m.cle }).droit, 'lecture');
  for (const nom of ['authorization', 'x-api-key', 'cookie', 'x-maverick', 'x-maverick-cles']) assert.equal(d({ [nom]: m.cle }).droit, 'aucun', nom);
  assert.equal(d({ [ENTETE_CLE]: '' }).droit, 'aucun');
  assert.equal(d({ [ENTETE_CLE]: 42 }).droit, 'aucun');
});

test('R275, R291 : la clé de lecture lit et, tant que la clé de dépôt n’est pas posée, dépose une proposition ; jamais une autre écriture ; la session MJ lit seulement', () => {
  const m = poser();
  const cle = { [ENTETE_CLE]: m.cle };
  for (const chemin of ['/api/v1/', '/api/debug/tables/', '/api/edition/journal/', '/api/edition/extrait/', '/api/mise-a-jour/conflits/', `/api/edition/lots/${UUID}/`]) assert.equal(m.acces.controler(requete('GET', chemin, cle)), null, chemin);
  for (const chemin of ['/api/edition/lots/', `/api/edition/lots/${UUID}/essai/`, '/api/edition/lots/recalcul/']) assert.equal(m.acces.controler(requete('POST', chemin, cle)), null, `${chemin} : une proposition`);
  for (const [methode, chemin] of [['POST', '/api/edition/'], ['POST', `/api/edition/lots/${UUID}/appliquer/`], ['POST', `/api/edition/lots/${UUID}/annuler/`], ['POST', '/api/maintenance/lever/'],
    ['POST', '/api/mise-a-jour/lancer/'], ['PUT', '/api/personnages/x/'], ['PATCH', '/api/v1/metiers/x/'], ['GET', `/api/edition/lots/${UUID}/lignes/1/annulation/`], ['GET', '/api/inconnue/']]) {
    assert.equal(m.acces.controler(requete(methode, chemin, cle)).statut, 403, `${methode} ${chemin}`);
  }
  assert.deepEqual(m.acces.depot(cle), { direct: false, par: null });
  assert.equal(m.acces.depotDirectPose(), false);
  // la session MJ : lit, ne dépose pas (une proposition est une écriture de lot_de_changements), n'écrit pas
  const mj = { 'x-session': 'mj' };
  assert.equal(m.acces.controler(requete('GET', '/api/debug/tables/', mj)), null);
  assert.equal(m.acces.controler(requete('POST', '/api/edition/lots/', mj)).corps.acces, 'niveau');
  assert.equal(m.acces.controler(requete('POST', '/api/edition/', mj)).corps.acces, 'niveau');
  assert.deepEqual(m.acces.depot(mj), { direct: false, par: null });
});

test('R291 : la clé de dépôt posée, seule elle (ou une session Créateur) dépose, et le lot s’applique aussitôt ; la clé de lecture est refusée en 403, et la session MJ aussi ; sans rien : 401', () => {
  const m = poser({ depot: true });
  const lecture = { [ENTETE_CLE]: m.cle };
  const depot = { [ENTETE_CLE]: m.cleDeDepot };
  assert.equal(m.acces.depotDirectPose(), true);
  for (const chemin of ['/api/edition/lots/', `/api/edition/lots/${UUID}/essai/`, '/api/edition/lots/recalcul/', '/api/edition/lots/ancrage/']) {
    assert.equal(m.acces.controler(requete('POST', chemin, depot)), null, `${chemin} avec la clé de dépôt`);
    assert.equal(m.acces.controler(requete('POST', chemin, { 'x-session': 'createur' })), null, `${chemin} avec une session Créateur`);
    const avecLecture = m.acces.controler(requete('POST', chemin, lecture));
    assert.deepEqual([avecLecture.statut, avecLecture.corps.acces], [403, 'cle_de_depot'], `${chemin} : la clé de lecture ne dépose plus`);
    assert.match(avecLecture.corps.erreur, /la clé de dépôt est nécessaire/);
    const sans = m.acces.controler(requete('POST', chemin));
    assert.deepEqual([sans.statut, sans.corps.acces], [401, 'cle_de_depot'], `${chemin} sans rien`);
    assert.deepEqual(m.acces.controler(requete('POST', chemin, { 'x-session': 'mj' })).corps.acces, 'niveau');
  }
  // la clé de dépôt vaut la lecture, jamais le reste des écritures
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', depot)), null);
  for (const [methode, chemin] of [['POST', '/api/edition/'], ['POST', `/api/edition/lots/${UUID}/appliquer/`], ['POST', '/api/mise-a-jour/lancer/'], ['GET', `/api/edition/lots/${UUID}/lignes/1/annulation/`]]) {
    const r = m.acces.controler(requete(methode, chemin, depot));
    assert.deepEqual([r.statut, r.corps.acces], [403, 'cle'], `${methode} ${chemin}`);
  }
  // qui dépose directement, et par quoi
  assert.deepEqual(m.acces.depot(depot), { direct: true, par: 'cle_de_depot' });
  assert.deepEqual(m.acces.depot({ 'x-session': 'createur' }), { direct: true, par: 'createur' });
  assert.deepEqual(m.acces.depot({ 'x-session': 'createur', [ENTETE_CLE]: m.cleDeDepot }), { direct: true, par: 'createur' });
  for (const entetes of [{}, lecture, { 'x-session': 'mj' }, { 'x-session': 'joueur' }, { [ENTETE_CLE]: 'mvd_faux' }]) assert.deepEqual(m.acces.depot(entetes), { direct: false, par: null });
});

test('les clés se lisent sans redémarrage : posées, changées, retirées ; illisibles, aucune clé ne marche, mais le site reste fermé et les sessions continuent', () => {
  const m = poser();
  const cle = { [ENTETE_CLE]: m.cle };
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', cle)), null);
  assert.ok(m.journal.some((l) => /clés relues \(lecture : oui, dépôt : non\)/.test(l)));
  // la clé de dépôt posée après coup est prise en compte
  const depot = reglageApres({ ancien: m.reglage, refaireLaCleDeDepot: true });
  writeFileSync(m.fichier, JSON.stringify(depot.reglage));
  assert.equal(m.acces.depotDirectPose(), true);
  assert.equal(m.acces.controler(requete('POST', '/api/edition/lots/', cle)).statut, 403);
  // une clé de lecture neuve : l'ancienne ne marche plus
  const refaite = reglageApres({ ancien: depot.reglage, refaireLaCle: true });
  writeFileSync(m.fichier, JSON.stringify(refaite.reglage));
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', cle)).statut, 401);
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', { [ENTETE_CLE]: refaite.cle })), null);
  // illisible : aucune clé, le site reste fermé, les sessions de niveau suffisant passent encore
  writeFileSync(m.fichier, '{ cassé');
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', { [ENTETE_CLE]: refaite.cle })).statut, 401);
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', { 'x-session': 'mj' })), null);
  assert.equal(m.acces.controler(requete('GET', '/api/etat/')), null);
  assert.ok(m.journal.some((l) => /clés illisibles/.test(l)));
  // retiré : plus de clé, le site reste fermé
  unlinkSync(m.fichier);
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', { [ENTETE_CLE]: refaite.cle })).statut, 401);
  assert.equal(m.acces.depotDirectPose(), false);
  assert.ok(m.journal.some((l) => /clés retirées/.test(l)));
  // invalide (une empreinte qui n'en est pas une) : de même
  writeFileSync(m.fichier, JSON.stringify({ version: 1, cle_de_lecture: { empreinte: 'xx' } }));
  assert.equal(m.acces.controler(requete('GET', '/api/v1/', { [ENTETE_CLE]: refaite.cle })).statut, 401);
  // rien de secret au journal
  const tout = m.journal.join('\n');
  for (const secret of [m.cle, depot.cleDeDepot, refaite.cle, sha(m.cle), sha(refaite.cle)]) assert.ok(!tout.includes(secret), `« ${secret.slice(0, 10)}… » au journal`);
});

test('sans session injectée (aucune connexion), seules les clés ouvrent', () => {
  const m = poser();
  const seule = creerAcces({ fichier: m.fichier });
  assert.equal(seule.controler(requete('GET', '/api/v1/', { [ENTETE_CLE]: m.cle })), null);
  assert.equal(seule.controler(requete('GET', '/api/v1/', { 'x-session': 'createur' })).statut, 401);
  assert.deepEqual(seule.droit({ 'x-session': 'createur' }), { droit: 'aucun', session: false, niveau: null, cle: null, expire_s: null });
});

test('le cookie : plusieurs valeurs de même nom sont lues ; Secure suit l’hôte (derrière Caddy puis nginx, jamais « https » vu du service)', () => {
  assert.deepEqual(valeursDuCookie('a=1; maverick_session=x; b=2; maverick_session=y', 'maverick_session'), ['x', 'y']);
  assert.deepEqual(valeursDuCookie('', 'maverick_session'), []);
  assert.deepEqual(valeursDuCookie(undefined, 'maverick_session'), []);
  assert.deepEqual(valeursDuCookie('xmaverick_session=1', 'maverick_session'), []);
  assert.equal(connexionSecurisee({ 'x-forwarded-host': 'dev.exemple.invalid', 'x-forwarded-proto': 'http' }), true);
  assert.equal(connexionSecurisee({ host: 'localhost:8787' }), false);
  assert.equal(connexionSecurisee({ host: '192.168.1.20:8081' }), false);
  assert.equal(connexionSecurisee({ host: '127.0.0.1:8787', 'x-forwarded-proto': 'https' }), true);
  assert.equal(egaux('abc', 'abc'), true);
  assert.equal(egaux('abc', 'abd'), false);
  assert.equal(egaux('abc', 'abcd'), false);
});

test('la commande de l’hôte : une clé neuve, la clé de dépôt posée ou retirée ; REGLAGE puis CLE ou CLE_DE_DEPOT ; plus de mot de passe ni de portée', async () => {
  const dossier = dossierTemporaire('acces-commande');
  const fichier = `${dossier}/acces.json`;
  const lancer = async (argv) => {
    const sortie = [];
    const erreurs = [];
    const code = await commandeAcces(argv, { sortie: (l) => sortie.push(l), erreur: (l) => erreurs.push(l), fichier });
    return { code, sortie, erreurs };
  };
  const reglageDe = (r) => JSON.parse(r.sortie[0].replace(/^REGLAGE /, ''));
  const premiere = await lancer(['cle']);
  assert.equal(premiere.code, 0, premiere.erreurs.join());
  assert.match(premiere.sortie[1], /^CLE mvk_/);
  assert.equal(reglageDe(premiere).cle_de_lecture.empreinte, sha(premiere.sortie[1].slice(4)));
  assert.ok(!premiere.sortie[0].includes(premiere.sortie[1].slice(4)), 'la clé n’est jamais dans le réglage');
  writeFileSync(fichier, JSON.stringify(reglageDe(premiere)));
  const depot = await lancer(['cle-de-depot']);
  assert.match(depot.sortie[1], /^CLE_DE_DEPOT mvd_/);
  assert.deepEqual(reglageDe(depot).cle_de_lecture, reglageDe(premiere).cle_de_lecture, 'la clé de lecture est gardée');
  writeFileSync(fichier, JSON.stringify(reglageDe(depot)));
  const sans = await lancer(['sans-cle-de-depot']);
  assert.equal(sans.code, 0);
  assert.equal(sans.sortie.length, 1);
  assert.equal(reglageDe(sans).cle_de_depot, null);
  const refaite = await lancer(['cle']);
  assert.notDeepEqual(reglageDe(refaite).cle_de_lecture, reglageDe(premiere).cle_de_lecture);
  assert.deepEqual(reglageDe(refaite).cle_de_depot, reglageDe(depot).cle_de_depot, 'la clé de dépôt est gardée');
  // plus de mot de passe ni de portée : ces commandes n'existent plus
  for (const argv of [['definir'], ['portee', 'tout'], ['nimporte'], []]) {
    const r = await lancer(argv);
    assert.equal(r.code, 1, argv.join(' '));
    assert.match(r.erreurs[0], /commande inconnue/);
  }
  // sans clé de dépôt posée : rien à retirer
  writeFileSync(fichier, JSON.stringify(reglageDe(sans)));
  assert.match((await lancer(['sans-cle-de-depot'])).erreurs[0], /aucune clé de dépôt/);
  // un fichier illisible se refait par une commande (pas d'enfermement dehors)
  writeFileSync(fichier, '{ cassé');
  const repare = await lancer(['cle']);
  assert.equal(repare.code, 0);
  assert.match(repare.sortie[1], /^CLE mvk_/);
  // un fichier d'avant R310 : la commande le réécrit sans le mot de passe
  const ancien = { ...reglageDe(premiere), portee: 'tout', secret_de_session: 'a'.repeat(64), mot_de_passe: { algo: 'scrypt', n: 1, r: 1, p: 1, sel: 'a'.repeat(32), empreinte: 'b'.repeat(64) } };
  writeFileSync(fichier, JSON.stringify(ancien));
  const nettoye = reglageDe(await lancer(['cle-de-depot']));
  assert.ok(!('mot_de_passe' in nettoye) && !('portee' in nettoye) && !('secret_de_session' in nettoye));
  assert.deepEqual(nettoye.cle_de_lecture, ancien.cle_de_lecture);
  assert.equal(JSON.parse(readFileSync(fichier, 'utf8')).version, 1);
});
