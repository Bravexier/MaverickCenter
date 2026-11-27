// La connexion par Discord (client/serveur/discord.mjs ; décision R310, docs/serveur.md, « Connexion par Discord ») : le niveau d'un membre, le nom, les images, les
// dates, le réglage de l'instance, la session signée, et le flux OAuth entier avec un Discord simulé (jamais le réseau) : membre, non membre, adhésion en
// attente, exclusion temporaire, compte bot, rôles MJ et Créateur, état faux, retour hors du site, échecs de Discord, révocation du jeton.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CODES_D_ERREUR, COOKIE_ETAT, COOKIE_SESSION, INTERVALLE_DE_REVERIFICATION_S, PAUSE_MAX_S, DUREE_SESSION_DEV_S, DUREE_SESSION_PROD_S, NIVEAUX, PORTEES_OAUTH, RETOUR_PAR_DEFAUT, SERVEUR_PAR_DEFAUT,
  adresseDAvatar, adresseDeBanniere, adresseDeRetourValide, avatarParDefaut, commandeDiscord, cookiesDeSession, creerConnexion, creerJetonDeSession, instantDeDiscord,
  lireJetonDeSession, lireSigne, niveauDuMembre, nomAffiche, resumeDuReglage, retourValide, reglageApres, signer, validerReglage,
} from '../serveur/discord.mjs';
import {
  ADRESSE_DE_RETOUR_D_ESSAI, CLIENT_D_ESSAI, ROLE_CREATEUR, ROLE_JOUEUR, ROLE_MJ, SECRET_D_ESSAI, SERVEUR_D_ESSAI, poserLAcces, reglageDiscordDEssai,
} from './aide-acces-d-essai.mjs';
import { IDENTIFIANT_D_ESSAI, JETON_DU_BOT_D_ESSAI, MEMBRE_D_ESSAI, UTILISATEUR_D_ESSAI, discordSimule } from './aide-discord-simule.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MAINTENANT = Date.parse('2026-11-27T12:00:00Z');
const HASH = 'a'.repeat(32);
const HASH2 = 'b1'.repeat(16);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('R310 (2), R311 : le niveau se recalcule du membre — non membre, adhésion en attente, exclusion en cours : observateur ; membre sans rôle correspondant : observateur ; rôles Joueur, MJ, Créateur : le plus haut l’emporte', () => {
  const roles = { [ROLE_JOUEUR]: 'joueur', [ROLE_MJ]: 'mj', [ROLE_CREATEUR]: 'createur' };
  const niveau = (membre, plus = {}) => niveauDuMembre({ membre, roles, maintenant: MAINTENANT, ...plus });
  assert.equal(niveau(null), 'observateur', 'l’appel membre a échoué : non membre');
  assert.equal(niveau(undefined), 'observateur');
  assert.equal(niveau({ roles: [] }), 'observateur', 'R311 : un membre sans rôle correspondant est Observateur');
  assert.equal(niveau({}), 'observateur');
  assert.equal(niveau({ roles: [ROLE_JOUEUR] }), 'joueur', 'un rôle Joueur seul');
  assert.equal(niveau({ roles: [ROLE_JOUEUR, ROLE_MJ] }), 'mj', 'Joueur et MJ : MJ');
  assert.equal(niveau({ roles: [ROLE_MJ, ROLE_JOUEUR] }), 'mj', 'l’ordre des rôles ne compte pas');
  assert.equal(niveau({ roles: [ROLE_MJ, ROLE_CREATEUR] }), 'createur', 'MJ et Créateur : Créateur');
  assert.equal(niveau({ roles: [ROLE_CREATEUR, ROLE_MJ, ROLE_JOUEUR] }), 'createur');
  assert.equal(niveau({ roles: ['1', ROLE_MJ, '2'] }), 'mj');
  assert.equal(niveau({ roles: ['123'] }), 'observateur', 'un rôle inconnu de la correspondance ne donne rien');
  assert.equal(niveau({ roles: ['123', ROLE_JOUEUR] }), 'joueur');
  assert.equal(niveau({ roles: [ROLE_JOUEUR], pending: true }), 'observateur', 'adhésion en attente');
  assert.equal(niveau({ roles: [ROLE_CREATEUR], pending: true }), 'observateur', 'un rôle ne vaut rien tant que l’adhésion est en attente');
  assert.equal(niveau({ roles: [ROLE_JOUEUR], communication_disabled_until: '2026-11-27T12:00:01Z' }), 'observateur', 'exclusion temporaire dans le futur');
  assert.equal(niveau({ roles: [ROLE_MJ], communication_disabled_until: '2026-12-31T00:00:00+00:00' }), 'observateur');
  assert.equal(niveau({ roles: [ROLE_JOUEUR], communication_disabled_until: '2026-11-27T11:59:59Z' }), 'joueur', 'exclusion échue');
  assert.equal(niveau({ roles: [ROLE_JOUEUR], communication_disabled_until: null }), 'joueur');
  assert.equal(niveau({ roles: [ROLE_JOUEUR], communication_disabled_until: 'pas une date' }), 'observateur', 'une date illisible ne donne aucun droit de plus');
  assert.equal(niveau({ roles: [ROLE_MJ] }, { roles: {} }), 'observateur', 'sans correspondance posée, personne n’est joueur : la correspondance vient du réglage, jamais du code');
  assert.equal(niveau({ roles: ['constructor', '__proto__', 'toString'] }, { roles: {} }), 'observateur');
  assert.equal(niveau({ roles: [Number(ROLE_MJ)] }, { roles: { [ROLE_MJ]: 'mj' } }), 'observateur', 'un rôle qui n’est pas un identifiant en texte ne correspond pas par accident');
  assert.equal(niveau({ roles: [ROLE_JOUEUR] }, { roles: { [ROLE_JOUEUR]: 'observateur' } }), 'observateur', 'une valeur de correspondance hors joueur, mj, createur ne donne rien');
  for (const n of ['observateur', 'joueur', 'mj', 'createur']) assert.ok(NIVEAUX.includes(n));
});

test('R310 (5) : le nom affiché est le surnom du serveur, sinon global_name, sinon le nom d’utilisateur', () => {
  const u = { username: 'compte', global_name: 'Global' };
  assert.equal(nomAffiche({ membre: { nick: 'Surnom' }, utilisateur: u }), 'Surnom');
  assert.equal(nomAffiche({ membre: { nick: null }, utilisateur: u }), 'Global');
  assert.equal(nomAffiche({ membre: { nick: '   ' }, utilisateur: u }), 'Global', 'un surnom vide ne compte pas');
  assert.equal(nomAffiche({ membre: null, utilisateur: u }), 'Global');
  assert.equal(nomAffiche({ membre: null, utilisateur: { username: 'compte', global_name: null } }), 'compte');
  assert.equal(nomAffiche({ utilisateur: { username: '  compte ', global_name: '' } }), 'compte');
  assert.throws(() => nomAffiche({ utilisateur: { username: '', global_name: null } }), /aucun nom/);
  assert.equal(nomAffiche({ membre: { nick: 'x'.repeat(300) }, utilisateur: u }).length, 100, 'longueur bornée');
});

test('R310 (5) : avatar et bannière — ceux du serveur s’il y en a, sinon ceux du compte, sinon l’avatar par défaut ; format « Image Formatting » de Discord', () => {
  const id = IDENTIFIANT_D_ESSAI;
  const g = SERVEUR_D_ESSAI;
  const cdn = 'https://cdn.discordapp.com';
  const avatar = (membre, utilisateur = {}) => adresseDAvatar({ membre, utilisateur: { id, ...utilisateur }, serveur: g });
  const banniere = (membre, utilisateur = {}) => adresseDeBanniere({ membre, utilisateur: { id, ...utilisateur }, serveur: g });
  assert.equal(avatar({ avatar: HASH }, { avatar: HASH2 }), `${cdn}/guilds/${g}/users/${id}/avatars/${HASH}.png`);
  assert.equal(avatar({ avatar: null }, { avatar: HASH2 }), `${cdn}/avatars/${id}/${HASH2}.png`);
  assert.equal(avatar(null, { avatar: `a_${HASH2}` }), `${cdn}/avatars/${id}/a_${HASH2}.png`, 'un avatar animé a le préfixe a_');
  assert.equal(avatar(null), `${cdn}/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`, 'par défaut : (id >> 22) % 6');
  assert.equal(avatarParDefaut('80351110224678912'), `${cdn}/embed/avatars/${(80351110224678912n >> 22n) % 6n}.png`);
  assert.equal(banniere({ banner: HASH }, { banner: HASH2 }), `${cdn}/guilds/${g}/users/${id}/banners/${HASH}.png`);
  assert.equal(banniere({ banner: null }, { banner: HASH2 }), `${cdn}/banners/${id}/${HASH2}.png`);
  assert.equal(banniere(null), null);
  // jamais un morceau d'adresse venu de Discord qui n'est pas un hachage
  assert.equal(avatar({ avatar: '../../x' }, { avatar: 'nope' }), `${cdn}/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`);
  assert.equal(banniere({ banner: 'x/y' }, { banner: HASH2.toUpperCase() }), null);
  assert.throws(() => avatar(null, { id: '../x' }), /identifiant/);
  // la contrainte de la base : https://cdn.discordapp.com/ suivi d'au moins un caractère
  for (const a of [avatar({ avatar: HASH }), avatar(null), banniere({ banner: HASH })]) assert.match(a, /^https:\/\/cdn\.discordapp\.com\/.+/);
});

test('les dates de Discord prennent le format de la base (secondes, Z) ; une date illisible est absente', () => {
  assert.equal(instantDeDiscord('2024-03-05T10:20:30.123000+00:00'), '2024-03-05T10:20:30Z');
  assert.equal(instantDeDiscord('2024-03-05T12:20:30+02:00'), '2024-03-05T10:20:30Z');
  assert.equal(instantDeDiscord('n’importe quoi'), null);
  assert.equal(instantDeDiscord(null), null);
  assert.equal(instantDeDiscord(''), null);
});

test('le chemin de retour : un chemin du site seulement, jamais « // », une autre origine ni un caractère de contrôle ; sinon /profil/', () => {
  for (const bon of ['/profil/', '/regles/classes/', '/mise-a-jour/?lot=1', '/a/b?c=d', '/']) assert.equal(retourValide(bon), bon, bon);
  assert.equal(retourValide('/a/b?c=d#ancre'), '/a/b?c=d', 'l’ancre est retirée');
  // un caractère hors latin-1 s'encode : l'en-tête Location reste valide (sinon la réponse échouerait après l'écriture du compte)
  for (const [demande, attendu] of [['/l’arme/', '/l%E2%80%99arme/'], ['/é/œuvre/?q=œ', '/%C3%A9/%C5%93uvre/?q=%C5%93'], ['/日本/', '/%E6%97%A5%E6%9C%AC/']]) {
    const sortie = retourValide(demande);
    assert.equal(sortie, attendu, demande);
    assert.doesNotThrow(() => new Headers({ Location: sortie }));
    assert.match(sortie, /^[\x21-\x7e]+$/, 'ASCII imprimable seulement');
  }
  // la normalisation de l'analyseur d'adresses ne fabrique pas un « // » : /.//hote devient //hote, refusé
  for (const piege of ['/.//exemple.test/vol', '/a/..//exemple.test', '/./\/exemple.test']) assert.equal(retourValide(piege), RETOUR_PAR_DEFAUT, piege);
  for (const mauvais of ['//exemple.test/', 'https://exemple.test/', 'http://exemple.test', '/\\exemple.test', '\\\\exemple.test', 'profil/', '', null, undefined, 42, '/a\nb', '/a\u0000b', '/a\r\nLocation: x',
    `/${'x'.repeat(600)}`, '///exemple.test', '/\t/exemple.test', 'javascript:alert(1)', '/%2F/', '//%09/exemple.test']) {
    const attendu = mauvais === '/%2F/' ? '/%2F/' : RETOUR_PAR_DEFAUT; // un « %2F » reste un chemin du site
    assert.equal(retourValide(mauvais), attendu, JSON.stringify(mauvais));
  }
  assert.equal(RETOUR_PAR_DEFAUT, '/profil/');
});

test('le réglage : adresse de retour en HTTPS sans identifiants ni fragment ; champs vérifiés, inconnus retirés, rôles bornés à mj et createur', () => {
  assert.equal(adresseDeRetourValide('https://dev.exemple.test/api/connexion/discord/retour/'), 'https://dev.exemple.test/api/connexion/discord/retour/');
  for (const mauvaise of ['http://exemple.test/retour/', 'ftp://x/', 'exemple.test/retour', 'https://u:p@exemple.test/', 'https://exemple.test/r/#x', 'https://exemple.test/r/?a=1', '', 'https://']) {
    assert.throws(() => adresseDeRetourValide(mauvaise), /adresse de retour/, mauvaise);
  }
  const bon = reglageDiscordDEssai();
  assert.deepEqual(validerReglage(JSON.parse(JSON.stringify({ ...bon, intrus: 1 }))), bon, 'un champ inconnu est retiré');
  assert.deepEqual(Object.keys(bon).sort(), ['adresse_de_retour', 'client_id', 'client_secret', 'pose_le', 'roles', 'secret_de_session', 'serveur', 'version']);
  const casse = (changement, motif) => assert.throws(() => validerReglage({ ...bon, ...changement }), motif, JSON.stringify(changement).slice(0, 80));
  casse({ version: 2 }, /version/);
  casse({ client_id: 'abc' }, /identifiant de l’application/);
  casse({ client_secret: 'court' }, /secret de l’application/);
  casse({ client_secret: 'un secret avec espaces' }, /secret de l’application/);
  casse({ serveur: 'x' }, /serveur/);
  casse({ adresse_de_retour: 'http://exemple.test/' }, /adresse de retour/);
  casse({ roles: { 123456: 'admin' } }, /niveau de rôle/);
  casse({ roles: { 123456: 'observateur' } }, /niveau de rôle/);
  assert.deepEqual(validerReglage({ ...bon, roles: { 123456: 'joueur' } }).roles, { 123456: 'joueur' }, 'R311 : joueur est une valeur de la correspondance');
  casse({ roles: { pas_un_id: 'mj' } }, /identifiant de rôle/);
  casse({ roles: [] }, /correspondance/);
  casse({ secret_de_session: 'court' }, /secret de session/);
  assert.throws(() => validerReglage(null), /illisible/);
  assert.throws(() => validerReglage([]), /illisible/);
  // « roles » absent : aucune correspondance (tout membre est observateur, R311)
  const { roles, ...sansRoles } = bon;
  assert.deepEqual(validerReglage(sansRoles).roles, {});
  assert.ok(roles);
  // le résumé de --etat ne porte aucun secret
  const resume = JSON.stringify(resumeDuReglage(bon));
  assert.ok(!resume.includes(SECRET_D_ESSAI) && !resume.includes(bon.secret_de_session));
  assert.equal(SERVEUR_PAR_DEFAUT, '374464159254839298', 'le serveur du jeu : sources/sources.json, discord.guildId');
});

test('le réglage d’une commande de l’hôte : poser l’application garde rôles et sessions ; rôle posé ou retiré ; nouvelle session ; rien sans application posée', () => {
  const maintenant = new Date('2026-11-27T10:00:00Z');
  const premier = reglageApres({ definir: { clientId: CLIENT_D_ESSAI, clientSecret: SECRET_D_ESSAI, adresseDeRetour: ADRESSE_DE_RETOUR_D_ESSAI }, maintenant });
  assert.equal(premier.serveur, SERVEUR_PAR_DEFAUT);
  assert.deepEqual(premier.roles, {});
  assert.equal(premier.pose_le, '2026-11-27T10:00:00.000Z');
  assert.match(premier.secret_de_session, /^[0-9a-f]{64}$/);
  const avecRole = reglageApres({ ancien: premier, role: { id: ROLE_MJ, niveau: 'mj' } });
  assert.deepEqual(avecRole.roles, { [ROLE_MJ]: 'mj' });
  assert.equal(avecRole.secret_de_session, premier.secret_de_session, 'poser un rôle ne ferme pas les sessions');
  const change = reglageApres({ ancien: avecRole, role: { id: ROLE_MJ, niveau: 'createur' } });
  assert.deepEqual(change.roles, { [ROLE_MJ]: 'createur' });
  const deux = reglageApres({ ancien: change, role: { id: ROLE_CREATEUR, niveau: 'createur' } });
  assert.equal(Object.keys(deux.roles).length, 2);
  assert.deepEqual(reglageApres({ ancien: deux, sansRole: ROLE_MJ }).roles, { [ROLE_CREATEUR]: 'createur' });
  assert.throws(() => reglageApres({ ancien: deux, sansRole: '999' }), /aucun niveau/);
  assert.throws(() => reglageApres({ ancien: deux, role: { id: 'x', niveau: 'mj' } }), /identifiant de rôle/);
  assert.deepEqual(reglageApres({ ancien: deux, role: { id: ROLE_JOUEUR, niveau: 'joueur' } }).roles[ROLE_JOUEUR], 'joueur');
  const plusieurs = reglageApres({ ancien: premier, role: { ids: ['600000000000000001', '600000000000000002', '600000000000000003'], niveau: 'joueur' } });
  assert.deepEqual(Object.values(plusieurs.roles), ['joueur', 'joueur', 'joueur'], 'plusieurs rôles d’un coup');
  assert.throws(() => reglageApres({ ancien: premier, role: { ids: ['600000000000000001', 'x'], niveau: 'joueur' } }), /identifiant de rôle/);
  assert.throws(() => reglageApres({ ancien: premier, role: { ids: [], niveau: 'joueur' } }), /aucun identifiant/);
  assert.throws(() => reglageApres({ ancien: deux, role: { id: ROLE_MJ, niveau: 'observateur' } }), /niveau inconnu/);
  assert.throws(() => reglageApres({ ancien: deux, role: { id: ROLE_MJ, niveau: 'dieu' } }), /niveau inconnu/);
  // l'application change : rôles, serveur et sessions gardés
  const autre = reglageApres({ ancien: deux, definir: { clientId: '111111111111111111', clientSecret: 'un-autre-secret-valable', adresseDeRetour: 'https://exemple.test/api/connexion/discord/retour/' } });
  assert.deepEqual([autre.client_id, autre.roles, autre.secret_de_session], ['111111111111111111', deux.roles, deux.secret_de_session]);
  // une nouvelle session ferme toutes les sessions ; un autre serveur se pose
  const neuve = reglageApres({ ancien: deux, nouvelleSession: true });
  assert.notEqual(neuve.secret_de_session, deux.secret_de_session);
  assert.deepEqual(neuve.roles, deux.roles);
  assert.equal(reglageApres({ ancien: deux, serveur: '123456789012345678' }).serveur, '123456789012345678');
  assert.throws(() => reglageApres({ ancien: deux, serveur: 'x' }), /serveur/);
  // rien sans application posée
  for (const demande of [{ role: { id: ROLE_MJ, niveau: 'mj' } }, { nouvelleSession: true }, { sansRole: ROLE_MJ }, { serveur: '123456789012345678' }]) {
    assert.throws(() => reglageApres(demande), /aucune application/);
  }
  // une application mal posée est refusée
  assert.throws(() => reglageApres({ definir: { clientId: 'x', clientSecret: SECRET_D_ESSAI, adresseDeRetour: ADRESSE_DE_RETOUR_D_ESSAI } }), /identifiant de l’application/);
  assert.throws(() => reglageApres({ definir: { clientId: CLIENT_D_ESSAI, clientSecret: '', adresseDeRetour: ADRESSE_DE_RETOUR_D_ESSAI } }), /secret/);
  assert.throws(() => reglageApres({ definir: { clientId: CLIENT_D_ESSAI, clientSecret: SECRET_D_ESSAI, adresseDeRetour: 'http://exemple.test/' } }), /adresse de retour/);
});

test('la session : un cookie signé { u, n, exp } qui expire ; falsifié, d’un autre secret, d’un autre usage ou mal formé : refusé', () => {
  const secret = 'a'.repeat(64);
  const exp = 2_000_000_000;
  const jeton = creerJetonDeSession(secret, { u: 'utilisateur-1', n: 'mj', exp });
  assert.match(jeton, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(lireJetonDeSession(secret, jeton, exp - 1), { u: 'utilisateur-1', n: 'mj', exp });
  assert.equal(lireJetonDeSession(secret, jeton, exp), null, 'expirée');
  assert.equal(lireJetonDeSession('b'.repeat(64), jeton, exp - 1), null, 'un autre secret : toutes les sessions tombent');
  assert.equal(lireJetonDeSession('', jeton, exp - 1), null);
  const [v, charge, signature] = jeton.split('.');
  const autre = Buffer.from(JSON.stringify({ u: 'utilisateur-1', n: 'createur', exp })).toString('base64url');
  assert.equal(lireJetonDeSession(secret, `${v}.${autre}.${signature}`, exp - 1), null, 'le niveau d’un cookie ne se change pas');
  assert.equal(lireJetonDeSession(secret, `${v}.${charge}.${signature.slice(0, -1)}A`, exp - 1), null);
  for (const mauvais of ['', 'v1.', 'v1.a.b', 'v2.x.y', null, undefined, 42, `${jeton}.x`, ` ${jeton}`]) assert.equal(lireJetonDeSession(secret, mauvais, exp - 1), null, JSON.stringify(mauvais));
  // les charges invalides, bien signées : refusées
  for (const charge2 of [{ u: '', n: 'mj', exp }, { u: 'x', n: 'dieu', exp }, { u: 'x', n: 'mj', exp: 'bientôt' }, { u: 7, n: 'mj', exp }, { n: 'mj', exp }, [1, 2], 'texte']) {
    assert.equal(lireJetonDeSession(secret, signer(secret, 'session', charge2), exp - 1), null, JSON.stringify(charge2));
  }
  // un jeton d'état OAuth ne vaut jamais session (et inversement)
  const etat = signer(secret, 'etat', { u: 'utilisateur-1', n: 'createur', exp });
  assert.equal(lireJetonDeSession(secret, etat, exp - 1), null);
  assert.equal(lireSigne(secret, 'etat', jeton), null);
  assert.deepEqual(lireSigne(secret, 'etat', etat), { u: 'utilisateur-1', n: 'createur', exp });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le flux, avec un Discord simulé
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une connexion d'essai (réglage posé), son Discord simulé, l'heure (modifiable) et ce qui a été écrit / journalisé. */
function monde({ edition = true, simule = {}, ...options } = {}) {
  const d = discordSimule({ client: { id: CLIENT_D_ESSAI, secret: SECRET_D_ESSAI }, ...simule });
  const horloge = { t: MAINTENANT };
  const a = poserLAcces({ prefixe: 'discord', fetch: d.fetch, horloge: () => horloge.t, edition, ...options });
  const journal = [];
  const connexion = creerConnexion({ fichier: a.fichierDiscord, fetch: d.fetch, horloge: () => horloge.t, edition, journal: (m) => journal.push(m) });
  const ecrits = [];
  const enregistrer = (profil) => {
    ecrits.push(profil);
    return `u-${ecrits.length}`;
  };
  /** R312 : les comptes que la connexion a demandé d'effacer (le non-membre) ; `etatDeLEffacement` dit ce que l'effacement répond. */
  const effaces = [];
  const etatDeLEffacement = { reponse: { id: 'u-ancien', efface: true, bloque: [] }, panne: null };
  const effacer = (discordId) => {
    effaces.push(discordId);
    if (etatDeLEffacement.panne) throw new Error(etatDeLEffacement.panne);
    return etatDeLEffacement.reponse;
  };
  /** commencer puis terminer : { debut, reponse, ecrits } ; `retour` : le chemin demandé ; `changer` : modifie ce qui revient de Discord (état, code, cookie…). */
  async function connecter({ retour, changer = {}, entetes = {} } = {}) {
    const debut = connexion.commencer({ retour, entetes });
    const adresse = debut.location ? new URL(debut.location) : null;
    const cookieEtat = debut.cookies?.[0]?.split(';')[0] ?? '';
    const retourDeDiscord = { code: d.code, etat: adresse?.searchParams.get('state'), erreur: null, entetes: { cookie: cookieEtat, ...entetes }, ...changer };
    const reponse = await connexion.terminer({ ...retourDeDiscord, enregistrer, effacer });
    return { debut, adresse, reponse };
  }
  return { ...a, d, connexion, horloge, journal, ecrits, effaces, etatDeLEffacement, enregistrer, connecter };
}
const cookieDe = (reponse, nom) => reponse.cookies.find((c) => c.startsWith(`${nom}=`));
const jetonDe = (reponse) => cookieDe(reponse, COOKIE_SESSION)?.split(';')[0].split('=')[1];

test('commencer : 302 vers Discord avec les deux autorisations seulement, l’adresse de retour du réglage et un état aléatoire dans un cookie signé court (HttpOnly, SameSite=Lax, Path=/api/connexion/)', () => {
  const m = monde();
  const a = m.connexion.commencer({ retour: '/regles/', entetes: { host: 'dev.exemple.test' } });
  const u = new URL(a.location);
  assert.equal(`${u.origin}${u.pathname}`, 'https://discord.com/oauth2/authorize');
  assert.deepEqual(Object.fromEntries(u.searchParams), {
    client_id: CLIENT_D_ESSAI, response_type: 'code', scope: 'identify guilds.members.read', redirect_uri: ADRESSE_DE_RETOUR_D_ESSAI, state: u.searchParams.get('state'),
  });
  assert.equal(PORTEES_OAUTH, 'identify guilds.members.read', 'R310 (6) : ni e-mail, ni liste de serveurs, ni connexions');
  assert.ok(!u.searchParams.get('scope').split(' ').some((p) => ['email', 'guilds', 'connections', 'guilds.join', 'rpc'].includes(p)));
  assert.match(u.searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(a.cookies.length, 1);
  assert.match(a.cookies[0], new RegExp(`^${COOKIE_ETAT}=v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{43}; Path=/api/connexion/; HttpOnly; SameSite=Lax; Max-Age=600; Secure$`));
  // l'état est tiré au hasard à chaque fois
  const b = m.connexion.commencer({ retour: '/regles/', entetes: {} });
  assert.notEqual(new URL(b.location).searchParams.get('state'), u.searchParams.get('state'));
  // en local sans https : pas de Secure (sinon le navigateur ne rendrait pas le cookie)
  assert.doesNotMatch(m.connexion.commencer({ entetes: { host: 'localhost:8787' } }).cookies[0], /Secure/);
  // aucun appel à Discord pour commencer
  assert.equal(m.d.appels.length, 0);
});

test('sans réglage (ou réglage invalide), la connexion est indisponible : rien n’est demandé à Discord ; le réglage posé ou retiré est pris en compte sans redémarrage', async () => {
  const fichier = fichierTemporaire('discord.json', 'discord-absent');
  const d = discordSimule();
  const journal = [];
  const c = creerConnexion({ fichier, fetch: d.fetch, journal: (m) => journal.push(m) });
  assert.equal(c.disponible(), false);
  assert.deepEqual(c.commencer({}), { erreur: 'indisponible' });
  assert.deepEqual((await c.terminer({ code: 'x', etat: 'y', entetes: {}, enregistrer: () => 'u' })).location, '/connexion/?erreur=indisponible');
  assert.equal(c.session({ cookie: `${COOKIE_SESSION}=v1.a.b` }), null);
  assert.equal(d.appels.length, 0);
  // posé : disponible tout de suite
  writeFileSync(fichier, JSON.stringify(reglageDiscordDEssai()));
  assert.equal(c.disponible(), true);
  assert.ok(journal.some((l) => /réglage Discord relu/.test(l)));
  // invalide : indisponible, la raison au journal
  writeFileSync(fichier, JSON.stringify({ ...reglageDiscordDEssai(), adresse_de_retour: 'http://exemple.test/' }));
  assert.equal(c.disponible(), false);
  assert.ok(journal.some((l) => /réglage Discord invalide/.test(l)));
  writeFileSync(fichier, '{ pas du json');
  assert.equal(c.disponible(), false);
  writeFileSync(fichier, JSON.stringify(reglageDiscordDEssai()));
  assert.equal(c.disponible(), true);
  assert.ok(journal.every((l) => !l.includes(SECRET_D_ESSAI)), 'le secret de l’application n’est jamais au journal');
});

test('R310 : un membre ordinaire devient Joueur ; profil, images et date d’arrivée écrits ; session de 12 h sur le site de dev, 7 jours en production ; jeton révoqué', async () => {
  for (const [edition, duree] of [[true, DUREE_SESSION_DEV_S], [false, DUREE_SESSION_PROD_S]]) {
    const m = monde({ edition, simule: { utilisateur: { ...UTILISATEUR_D_ESSAI, avatar: HASH2, banner: HASH }, membre: { ...MEMBRE_D_ESSAI, nick: 'Surnom du serveur', avatar: HASH, banner: null } } });
    const { reponse } = await m.connecter({ retour: '/regles/classes/' });
    assert.equal(reponse.location, '/regles/classes/', 'on revient où l’on était');
    assert.deepEqual(m.ecrits, [{
      discord_id: IDENTIFIANT_D_ESSAI, nom_affichage: 'Surnom du serveur', niveau: 'joueur',
      avatar_url: `https://cdn.discordapp.com/guilds/${SERVEUR_D_ESSAI}/users/${IDENTIFIANT_D_ESSAI}/avatars/${HASH}.png`,
      banniere_url: `https://cdn.discordapp.com/banners/${IDENTIFIANT_D_ESSAI}/${HASH}.png`,
      serveur_rejoint_le: '2024-03-05T10:20:30Z', instant: '2026-11-27T12:00:00Z',
    }]);
    // la session : cookie signé, niveau et identifiant du site, expiration selon l'instance
    const cookie = cookieDe(reponse, COOKIE_SESSION);
    assert.match(cookie, new RegExp(`^${COOKIE_SESSION}=v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{43}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${duree}; Secure$`));
    assert.deepEqual(m.connexion.session({ cookie: `${COOKIE_SESSION}=${jetonDe(reponse)}` }), { u: 'u-1', n: 'joueur', exp: MAINTENANT / 1000 + duree, v: MAINTENANT / 1000 });
    assert.equal(m.connexion.dureeS, duree);
    // le cookie de l'état est retiré
    assert.match(cookieDe(reponse, COOKIE_ETAT), /^maverick_etat=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=\/api\/connexion\/; HttpOnly/);
    // les appels à Discord : jeton, profil, membre, puis révocation des deux jetons (R310 (5) : aucun jeton gardé)
    assert.deepEqual(m.d.appels.map((a) => `${a.methode} ${a.url.replace('https://discord.com/api/v10', '')}`), [
      'POST /oauth2/token', 'GET /users/@me', `GET /users/@me/guilds/${SERVEUR_D_ESSAI}/member`, 'POST /oauth2/token/revoke', 'POST /oauth2/token/revoke',
    ]);
    assert.deepEqual([...m.d.revoques].sort(), [...m.d.jetons].sort(), 'les deux jetons délivrés sont révoqués');
    const echange = m.d.appels[0];
    assert.equal(echange.corps.redirect_uri, ADRESSE_DE_RETOUR_D_ESSAI);
    assert.equal(echange.corps.code, m.d.code);
    assert.match(echange.entetes.authorization, /^Basic /);
    assert.ok(m.d.appels.every((a) => a.signal), 'chaque appel a son délai d’attente');
    // ni l'e-mail ni rien d'autre n'est demandé : aucune autre adresse jointe
    assert.ok(m.d.appels.every((a) => !/guilds\/?(?!\d)|connections|email/.test(a.url.replace(`/guilds/${SERVEUR_D_ESSAI}/member`, ''))));
  }
});

test('R310 (2) : MJ et Créateur d’après les rôles du réglage (le plus haut l’emporte) ; un rôle d’ailleurs ou une correspondance retirée ne donne rien', async () => {
  const essai = async (roles, reglage) => {
    const m = monde({ simule: { membre: { ...MEMBRE_D_ESSAI, roles } }, ...(reglage ?? {}) });
    const { reponse } = await m.connecter();
    return { niveau: m.ecrits[0].niveau, session: m.connexion.session({ cookie: `${COOKIE_SESSION}=${jetonDe(reponse)}` })?.n };
  };
  assert.deepEqual(await essai([ROLE_MJ]), { niveau: 'mj', session: 'mj' });
  assert.deepEqual(await essai([ROLE_CREATEUR]), { niveau: 'createur', session: 'createur' });
  assert.deepEqual(await essai([ROLE_MJ, ROLE_CREATEUR, '1']), { niveau: 'createur', session: 'createur' });
  assert.deepEqual(await essai([ROLE_JOUEUR]), { niveau: 'joueur', session: 'joueur' });
  assert.deepEqual(await essai([ROLE_JOUEUR, ROLE_MJ]), { niveau: 'mj', session: 'mj' });
  assert.deepEqual(await essai(['777']), { niveau: 'observateur', session: 'observateur' }, 'R311 : membre sans rôle correspondant');
  assert.deepEqual(await essai([]), { niveau: 'observateur', session: 'observateur' });
  assert.deepEqual(await essai([ROLE_CREATEUR], { roles: {} }), { niveau: 'observateur', session: 'observateur' }, 'la correspondance vient du réglage de l’instance, jamais du code');
  assert.deepEqual(await essai([ROLE_CREATEUR], { roles: { 7777777: 'createur' } }), { niveau: 'observateur', session: 'observateur' });
});

test('R310 (2), R312 : adhésion en attente, exclusion temporaire, membre sans rôle : Observateur, le compte reste (écrit, jamais effacé)', async () => {
  for (const [nom, simule, rejoint] of [
    ['adhésion en attente', { membre: { ...MEMBRE_D_ESSAI, pending: true, roles: [ROLE_CREATEUR] } }, '2024-03-05T10:20:30Z'],
    ['exclusion en cours', { membre: { ...MEMBRE_D_ESSAI, communication_disabled_until: '2026-11-28T00:00:00.000000+00:00', roles: [ROLE_MJ] } }, '2024-03-05T10:20:30Z'],
    ['membre sans rôle correspondant', { membre: { ...MEMBRE_D_ESSAI, roles: ['1'] } }, '2024-03-05T10:20:30Z'],
  ]) {
    const m = monde({ simule });
    const { reponse } = await m.connecter();
    assert.equal(reponse.location, RETOUR_PAR_DEFAUT, nom);
    assert.equal(m.ecrits.length, 1, nom);
    assert.deepEqual(m.effaces, [], `${nom} : il reste membre, son compte aussi`);
    assert.equal(m.ecrits[0].niveau, 'observateur', nom);
    assert.equal(m.ecrits[0].serveur_rejoint_le, rejoint, nom);
    assert.deepEqual(m.connexion.session({ cookie: `${COOKIE_SESSION}=${jetonDe(reponse)}` }), { u: 'u-1', n: 'observateur', exp: MAINTENANT / 1000 + DUREE_SESSION_DEV_S, v: MAINTENANT / 1000 }, nom);
    assert.equal(m.ecrits[0].nom_affichage, 'Nom Global', nom);
  }
  // l'exclusion échue ne retire rien
  const m = monde({ simule: { membre: { ...MEMBRE_D_ESSAI, communication_disabled_until: '2026-11-27T11:00:00Z' } } });
  await m.connecter();
  assert.equal(m.ecrits[0].niveau, 'joueur');
});

test('R312 : le compte d’un non-membre (l’appel membre répond 404 ou 403) est effacé s’il existe et jamais créé ; sa session est Observateur, sans compte (`u` null) ; le jeton est révoqué', async () => {
  for (const statutMembre of [404, 403]) {
    const m = monde({ simule: { membre: null, statutMembre } });
    const { reponse } = await m.connecter({ retour: '/regles/' });
    assert.equal(reponse.location, '/regles/', `${statutMembre} : la connexion aboutit`);
    assert.deepEqual(m.ecrits, [], `${statutMembre} : aucun compte créé ni mis à jour`);
    assert.deepEqual(m.effaces, [IDENTIFIANT_D_ESSAI], `${statutMembre} : l’effacement est demandé pour ce compte Discord`);
    assert.deepEqual(m.connexion.session({ cookie: `${COOKIE_SESSION}=${jetonDe(reponse)}` }), { u: null, n: 'observateur', exp: MAINTENANT / 1000 + DUREE_SESSION_DEV_S, v: MAINTENANT / 1000 }, `${statutMembre}`);
    assert.deepEqual([...m.d.revoques].sort(), [...m.d.jetons].sort(), `${statutMembre} : jeton révoqué`);
    const journal = m.journal.join('\n');
    assert.match(journal, /non-membre, compte u-ancien effacé \(R312\)/);
    assert.ok(!journal.includes(IDENTIFIANT_D_ESSAI), 'jamais l’identifiant Discord au journal');
  }
  // aucun compte à effacer : rien à dire, la connexion aboutit quand même
  const sans = monde({ simule: { membre: null } });
  sans.etatDeLEffacement.reponse = { id: null, efface: false, bloque: [] };
  assert.equal((await sans.connecter()).reponse.location, RETOUR_PAR_DEFAUT);
  assert.ok(!sans.journal.some((l) => /effacé/.test(l)));
  // une référence bloquante : rien n'est effacé, une ligne au journal (identifiant du site seulement), la connexion continue en Observateur
  const bloque = monde({ simule: { membre: null } });
  bloque.etatDeLEffacement.reponse = { id: 'u-ancien', efface: false, bloque: ['personnage.proprietaire_id (2)'] };
  const r = await bloque.connecter();
  assert.equal(r.reponse.location, RETOUR_PAR_DEFAUT);
  assert.equal(bloque.connexion.session({ cookie: `${COOKIE_SESSION}=${jetonDe(r.reponse)}` }).n, 'observateur');
  assert.ok(bloque.journal.some((l) => /compte u-ancien NON effacé : référencé par personnage\.proprietaire_id \(2\)/.test(l)), bloque.journal.join('\n'));
  // un effacement en échec ne bloque pas la connexion
  const panne = monde({ simule: { membre: null } });
  panne.etatDeLEffacement.panne = 'base verrouillée';
  assert.equal((await panne.connecter()).reponse.location, RETOUR_PAR_DEFAUT);
  assert.ok(panne.journal.some((l) => /effacement du compte impossible \(base verrouillée\)/.test(l)));
});

test('R312 : une panne de Discord ou un 5xx de l’appel membre arrête la connexion sans rien effacer', async () => {
  for (const statutMembre of [500, 502, 429]) {
    const m = monde({ simule: { membre: null, statutMembre } });
    const { reponse } = await m.connecter();
    assert.equal(reponse.location, '/connexion/?erreur=discord', `${statutMembre}`);
    assert.deepEqual(m.effaces, [], `${statutMembre} : jamais d’effacement sur une panne`);
    assert.deepEqual(m.ecrits, []);
  }
  const reseau = monde({ simule: { statutUtilisateur: 500 } });
  await reseau.connecter();
  assert.deepEqual(reseau.effaces, []);
  const bot = monde({ simule: { utilisateur: { ...UTILISATEUR_D_ESSAI, bot: true }, membre: null } });
  await bot.connecter();
  assert.deepEqual(bot.effaces, [], 'un bot : 403, rien d’effacé ni d’écrit');
});

test('R312 : sans la portée guilds.members.read (scope absent, vide ou sans elle), le 403 de l’appel membre ne prouve rien : connexion arrêtée (erreur=discord), l’appel membre n’est pas fait, rien d’effacé ni d’écrit, jetons révoqués', async () => {
  for (const scope of ['identify', '', null, 'identify guilds', 'guilds.members.read.x']) {
    const m = monde({ simule: { membre: null, statutMembre: 403, scope } });
    const { reponse } = await m.connecter();
    assert.equal(reponse.location, '/connexion/?erreur=discord', JSON.stringify(scope));
    assert.deepEqual(m.effaces, [], JSON.stringify(scope));
    assert.deepEqual(m.ecrits, []);
    assert.equal(cookieDe(reponse, COOKIE_SESSION), undefined);
    assert.equal(m.d.appelsA('/member').length, 0, 'l’appartenance n’est même pas demandée');
    assert.deepEqual([...m.d.revoques].sort(), [...m.d.jetons].sort());
    assert.ok(m.journal.some((l) => /portée guilds\.members\.read n’a pas été accordée/.test(l)));
  }
  // la portée accordée avec d'autres, dans l'ordre que Discord veut : la connexion se poursuit
  const bon = monde({ simule: { membre: null, scope: 'guilds.members.read identify' } });
  assert.equal((await bon.connecter()).reponse.location, RETOUR_PAR_DEFAUT);
  assert.deepEqual(bon.effaces, [IDENTIFIANT_D_ESSAI]);
});

test('R312 : un jeton de session sans compte (`u` null) est valide ; un `u` vide ou qui n’est ni null ni un texte est refusé', () => {
  const secret = 'a'.repeat(64);
  const exp = 2_000_000_000;
  assert.deepEqual(lireJetonDeSession(secret, creerJetonDeSession(secret, { u: null, n: 'observateur', exp }), exp - 1), { u: null, n: 'observateur', exp });
  for (const u of ['', 7, undefined, false, {}]) assert.equal(lireJetonDeSession(secret, signer(secret, 'session', { u, n: 'observateur', exp }), exp - 1), null, JSON.stringify(u));
});

test('R310 (2) : un compte bot ou système est refusé (403) : rien n’est écrit, aucune session, jeton révoqué', async () => {
  for (const marque of [{ bot: true }, { system: true }]) {
    const m = monde({ simule: { utilisateur: { ...UTILISATEUR_D_ESSAI, ...marque } } });
    const { reponse } = await m.connecter();
    assert.equal(reponse.interdit, true);
    assert.equal(reponse.location, undefined);
    assert.deepEqual(m.ecrits, []);
    assert.equal(cookieDe(reponse, COOKIE_SESSION), undefined, 'aucune session');
    assert.equal(m.d.appelsA('/member').length, 0, 'l’appartenance n’est même pas demandée');
    assert.deepEqual([...m.d.revoques].sort(), [...m.d.jetons].sort());
  }
});

test('l’état OAuth : sans cookie, d’un autre cookie, expiré, falsifié, d’un autre secret ou d’une autre valeur que celle de Discord : /connexion/?erreur=etat, et Discord n’est jamais appelé', async () => {
  const m = monde();
  const debut = m.connexion.commencer({ retour: '/regles/' });
  const etat = new URL(debut.location).searchParams.get('state');
  const cookie = debut.cookies[0].split(';')[0];
  const jeton = cookie.split('=')[1];
  const essai = (code, etatRecu, cookieRecu) => m.connexion.terminer({ code, etat: etatRecu, entetes: { cookie: cookieRecu }, enregistrer: m.enregistrer });
  const attendu = { location: '/connexion/?erreur=etat' };
  for (const [nom, args] of [
    ['sans cookie', [m.d.code, etat, '']],
    ['sans état de Discord', [m.d.code, null, cookie]],
    ['état vide', [m.d.code, '', cookie]],
    ['un autre état', [m.d.code, 'autre-etat', cookie]],
    ['cookie falsifié', [m.d.code, etat, `${COOKIE_ETAT}=${jeton.slice(0, -2)}AA`]],
    ['cookie d’un autre nom', [m.d.code, etat, `autre=${jeton}`]],
    ['un jeton de session pris pour un état', [m.d.code, etat, `${COOKIE_ETAT}=${creerJetonDeSession(m.reglage.secret_de_session, { u: 'x', n: 'createur', exp: 2_000_000_000 })}`]],
    ['code absent', [null, etat, cookie]],
    ['code trop long', ['x'.repeat(600), etat, cookie]],
  ]) {
    const r = await essai(...args);
    assert.equal(r.location, attendu.location, nom);
    assert.match(cookieDe(r, COOKIE_ETAT), /Max-Age=0/, `${nom} : le cookie d’état est retiré`);
    assert.equal(cookieDe(r, COOKIE_SESSION), undefined, nom);
  }
  // expiré : plus de dix minutes
  m.horloge.t += 601_000;
  assert.equal((await essai(m.d.code, etat, cookie)).location, '/connexion/?erreur=etat', 'expiré');
  assert.equal(m.d.appels.length, 0, 'aucun appel à Discord pour tous ces refus');
  assert.deepEqual(m.ecrits, []);
  // d'un autre secret (sessions fermées entre-temps) : de même
  const m2 = monde();
  const d2 = m2.connexion.commencer({});
  writeFileSync(m2.fichierDiscord, JSON.stringify(reglageApres({ ancien: m2.reglage, nouvelleSession: true })));
  const r2 = await m2.connexion.terminer({ code: m2.d.code, etat: new URL(d2.location).searchParams.get('state'), entetes: { cookie: d2.cookies[0].split(';')[0] }, enregistrer: m2.enregistrer });
  assert.equal(r2.location, '/connexion/?erreur=etat');
  // le bon état, bien signé et à temps : passe (le contrôle ne refuse pas tout)
  assert.equal((await monde().connecter()).reponse.location, RETOUR_PAR_DEFAUT);
});

test('le retour demandé : un chemin du site seulement ; une autre origine, « // » ou un en-tête injecté ramènent à /profil/', async () => {
  for (const [demande, attendu] of [
    ['/regles/classes/?x=1', '/regles/classes/?x=1'], ['//exemple.test/vol', '/profil/'], ['https://exemple.test/', '/profil/'], ['/\\exemple.test', '/profil/'],
    ['/a\r\nSet-Cookie: x=1', '/profil/'], [undefined, '/profil/'], [null, '/profil/'], ['', '/profil/'],
  ]) {
    const m = monde();
    const { reponse } = await m.connecter({ retour: demande });
    assert.equal(reponse.location, attendu, JSON.stringify(demande));
  }
  // le chemin voyage dans le cookie signé : le visiteur ne peut pas le changer au retour (rien ne le lit de l'adresse de retour)
  const m = monde();
  const debut = m.connexion.commencer({ retour: '/regles/' });
  const r = await m.connexion.terminer({ code: m.d.code, etat: new URL(debut.location).searchParams.get('state'), entetes: { cookie: debut.cookies[0].split(';')[0] }, retour: 'https://exemple.test/', enregistrer: m.enregistrer });
  assert.equal(r.location, '/regles/');
});

test('les échecs : refus de l’utilisateur, code refusé, Discord en panne ou injoignable, appartenance illisible : /connexion/?erreur=<code court>, rien d’écrit, aucune session', async () => {
  assert.deepEqual([...CODES_D_ERREUR].sort(), ['discord', 'etat', 'indisponible', 'refus']);
  const cas = [
    ['l’utilisateur refuse (error=access_denied)', {}, { erreur: 'access_denied' }, 'refus', 0],
    ['code refusé (400)', { code: 'bon-code' }, { code: 'mauvais-code' }, 'refus', 1],
    ['secret de l’application refusé (401)', { client: { id: CLIENT_D_ESSAI, secret: 'un-autre-secret-attendu' } }, {}, 'discord', 1],
    ['Discord en panne à l’échange (500)', { statutJeton: 500 }, {}, 'discord', 1],
    ['profil illisible (500)', { statutUtilisateur: 500 }, {}, 'discord', 4],
    ['appartenance illisible (500) : jamais un niveau déduit d’une panne', { membre: null, statutMembre: 500 }, {}, 'discord', 5],
    ['appartenance : trop d’appels (429)', { membre: null, statutMembre: 429 }, {}, 'discord', 5],
  ];
  for (const [nom, simule, changer, code, appels] of cas) {
    const m = monde({ simule });
    const { reponse } = await m.connecter({ changer });
    assert.equal(reponse.location, `/connexion/?erreur=${code}`, nom);
    assert.deepEqual(m.ecrits, [], nom);
    assert.equal(cookieDe(reponse, COOKIE_SESSION), undefined, nom);
    assert.equal(m.d.appels.length, appels, `${nom} : ${m.d.appels.map((a) => a.url).join(' ')}`);
    assert.deepEqual([...m.d.revoques].sort(), [...m.d.jetons].sort(), `${nom} : tout jeton délivré est révoqué`);
  }
  // réseau coupé : une erreur de Discord, pas une exception
  const coupe = monde();
  const reseau = creerConnexion({ fichier: coupe.fichierDiscord, fetch: async () => { throw new TypeError('fetch failed'); }, journal: () => {} });
  const debut = reseau.commencer({});
  const r = await reseau.terminer({ code: 'x', etat: new URL(debut.location).searchParams.get('state'), entetes: { cookie: debut.cookies[0].split(';')[0] }, enregistrer: () => 'u' });
  assert.equal(r.location, '/connexion/?erreur=discord');
  // le délai d'attente est borné : un Discord qui ne répond pas rend la main
  const lent = creerConnexion({ fichier: coupe.fichierDiscord, delai: 30, journal: () => {}, fetch: (url, init) => new Promise((ok, ko) => {
    const tenir = setInterval(() => {}, 1000); // le minuteur de AbortSignal.timeout ne retient pas le processus : une vraie connexion, elle, le retient
    init.signal.addEventListener('abort', () => { clearInterval(tenir); ko(init.signal.reason); });
  }) });
  const debut2 = lent.commencer({});
  const t0 = Date.now();
  const r2 = await lent.terminer({ code: 'x', etat: new URL(debut2.location).searchParams.get('state'), entetes: { cookie: debut2.cookies[0].split(';')[0] }, enregistrer: () => 'u' });
  assert.equal(r2.location, '/connexion/?erreur=discord');
  assert.ok(Date.now() - t0 < 5000);
});

test('la révocation du jeton ne bloque jamais la connexion (refusée ou impossible) ; une base qui refuse d’écrire : indisponible, sans session', async () => {
  for (const revocation of ['echec', 'reseau']) {
    const m = monde({ simule: { revocation } });
    const { reponse } = await m.connecter();
    assert.equal(reponse.location, RETOUR_PAR_DEFAUT, revocation);
    assert.equal(m.ecrits.length, 1, revocation);
    assert.ok(m.journal.some((l) => /révocation du jeton Discord/.test(l)), revocation);
  }
  const m = monde();
  const debut = m.connexion.commencer({});
  const r = await m.connexion.terminer({ code: m.d.code, etat: new URL(debut.location).searchParams.get('state'), entetes: { cookie: debut.cookies[0].split(';')[0] }, enregistrer: () => { throw new Error('base verrouillée'); } });
  assert.equal(r.location, '/connexion/?erreur=indisponible');
  assert.equal(cookieDe(r, COOKIE_SESSION), undefined);
  assert.equal(m.d.revoques.length, 2, 'le jeton est révoqué quand même');
});

test('une session : valable jusqu’à son expiration seulement ; un secret de session changé (--nouvelle-session) ferme toutes les sessions ; un cookie falsifié ne donne rien', async () => {
  const m = monde();
  const { reponse } = await m.connecter();
  const entetes = { cookie: `autre=1; ${COOKIE_SESSION}=${jetonDe(reponse)}; encore=2` };
  assert.equal(m.connexion.session(entetes).n, 'joueur');
  // un navigateur peut envoyer deux cookies du même nom : le bon est trouvé
  assert.equal(m.connexion.session({ cookie: `${COOKIE_SESSION}=faux; ${COOKIE_SESSION}=${jetonDe(reponse)}` }).n, 'joueur');
  assert.equal(m.connexion.session({ cookie: `${COOKIE_SESSION}=faux` }), null);
  assert.equal(m.connexion.session({}), null);
  m.horloge.t += (DUREE_SESSION_DEV_S - 1) * 1000;
  assert.equal(m.connexion.session(entetes).n, 'joueur', 'encore valable une seconde avant la fin');
  m.horloge.t += 1000;
  assert.equal(m.connexion.session(entetes), null, '12 h plus tard : expirée');
  m.horloge.t = MAINTENANT;
  assert.ok(m.connexion.session(entetes));
  writeFileSync(m.fichierDiscord, JSON.stringify(reglageApres({ ancien: m.reglage, nouvelleSession: true })));
  assert.equal(m.connexion.session(entetes), null, 'toutes les sessions sont fermées');
});

test('rien de secret au journal : ni jeton Discord, ni code, ni secret de l’application, ni secret de session, ni cookie', async () => {
  const m = monde({ simule: { revocation: 'echec' } });
  const { reponse, debut } = await m.connecter({ retour: '/regles/' });
  const cookie = jetonDe(reponse);
  const tout = m.journal.join('\n');
  assert.match(tout, /connexion : joueur \(utilisateur u-1, session de 12 h\)/);
  for (const secret of [SECRET_D_ESSAI, m.reglage.secret_de_session, m.d.code, cookie, ...m.d.jetons, new URL(debut.location).searchParams.get('state'), IDENTIFIANT_D_ESSAI]) {
    assert.ok(!tout.includes(secret), `« ${secret.slice(0, 12)}… » au journal`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La commande de l'hôte (deploy/installateur/discord/discord.sh l'appelle dans le conteneur)
// ---------------------------------------------------------------------------------------------------------------------------------------------

async function commande(argv, { entree = '', fichier } = {}) {
  const sorties = [];
  const erreurs = [];
  const code = await commandeDiscord(argv, {
    entree: (async function* flux() { yield Buffer.from(entree); }()), sortie: (l) => sorties.push(l), erreur: (l) => erreurs.push(l), fichier, maintenant: new Date('2026-11-27T10:00:00Z'),
  });
  const reglage = sorties.map((l) => /^REGLAGE (.*)$/.exec(l)?.[1]).find(Boolean);
  return { code, sorties, erreurs, reglage: reglage ? JSON.parse(reglage) : null };
}

test('la commande de l’hôte : le secret vient de l’entrée standard (jamais d’un argument) ; rôles, serveur et nouvelle session ; rien sans application posée', async () => {
  const fichier = fichierTemporaire('discord.json', 'discord-commande');
  const pose = await commande(['definir', CLIENT_D_ESSAI, ADRESSE_DE_RETOUR_D_ESSAI], { entree: `${SECRET_D_ESSAI}\nignoré\n`, fichier });
  assert.equal(pose.code, 0, pose.erreurs.join());
  assert.equal(pose.reglage.client_secret, SECRET_D_ESSAI, 'la première ligne de l’entrée est le secret');
  assert.deepEqual([pose.reglage.client_id, pose.reglage.serveur, pose.reglage.roles], [CLIENT_D_ESSAI, SERVEUR_PAR_DEFAUT, {}]);
  assert.equal(validerReglage(pose.reglage).adresse_de_retour, ADRESSE_DE_RETOUR_D_ESSAI);
  writeFileSync(fichier, JSON.stringify(pose.reglage));
  // un rôle, puis un autre, puis le retrait du premier
  const role = await commande(['role', ROLE_MJ, 'mj'], { fichier });
  assert.equal(role.code, 0);
  writeFileSync(fichier, JSON.stringify(role.reglage));
  assert.deepEqual(role.reglage.roles, { [ROLE_MJ]: 'mj' });
  assert.equal(role.reglage.secret_de_session, pose.reglage.secret_de_session);
  const sans = await commande(['sans-role', ROLE_MJ], { fichier });
  assert.deepEqual(sans.reglage.roles, {});
  const serveur = await commande(['serveur', '123456789012345678'], { fichier });
  assert.equal(serveur.reglage.serveur, '123456789012345678');
  const session = await commande(['nouvelle-session'], { fichier });
  assert.notEqual(session.reglage.secret_de_session, pose.reglage.secret_de_session);
  // refus : rien n'est rendu, un message dit pourquoi
  for (const [argv, motif, entree] of [
    [['role', 'pas-un-id', 'mj'], /identifiant de rôle/, ''], [['role', ROLE_MJ, 'dieu'], /niveau inconnu/, ''], [['sans-role', '999'], /aucun niveau/, ''],
    [['definir', 'abc', ADRESSE_DE_RETOUR_D_ESSAI], /identifiant de l’application/, `${SECRET_D_ESSAI}\n`], [['definir', CLIENT_D_ESSAI, ADRESSE_DE_RETOUR_D_ESSAI], /secret/, '\n'],
    [['definir', CLIENT_D_ESSAI, 'http://exemple.test/'], /adresse de retour/, `${SECRET_D_ESSAI}\n`], [['inconnue'], /commande inconnue/, ''], [[], /commande inconnue/, ''],
  ]) {
    const r = await commande(argv, { fichier, entree });
    assert.equal(r.code, 1, argv.join(' '));
    assert.equal(r.reglage, null, argv.join(' '));
    assert.match(r.erreurs.join(), motif, argv.join(' '));
  }
  // sans fichier : rien à modifier, hors la pose
  const vide = fichierTemporaire('absent.json', 'discord-commande');
  for (const argv of [['role', ROLE_MJ, 'mj'], ['nouvelle-session'], ['serveur', '1234567']]) assert.match((await commande(argv, { fichier: vide })).erreurs.join(), /aucune application/);
  // un fichier illisible : seules la pose ou la repose le refont
  writeFileSync(fichier, '{ illisible');
  assert.match((await commande(['role', ROLE_MJ, 'mj'], { fichier })).erreurs.join(), /illisible/);
  const repose = await commande(['definir', CLIENT_D_ESSAI, ADRESSE_DE_RETOUR_D_ESSAI], { entree: `${SECRET_D_ESSAI}\n`, fichier });
  assert.equal(repose.code, 0);
  // le fichier de la commande est bien celui que le service lit
  writeFileSync(fichier, JSON.stringify(repose.reglage));
  assert.equal(creerConnexion({ fichier, journal: () => {} }).disponible(), true);
  assert.equal(JSON.parse(readFileSync(fichier, 'utf8')).version, 1);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// R314 : la revérification du niveau pendant la session, par le bot de l'application
// ---------------------------------------------------------------------------------------------------------------------------------------------

const S = MAINTENANT / 1000;
const EXP = S + DUREE_SESSION_DEV_S;

test('R314 : le jeton du bot est facultatif dans le réglage, vérifié, posé et retiré par la commande, jamais montré par le résumé ; poser l’application ou un rôle le garde', async () => {
  const sans = reglageDiscordDEssai();
  assert.ok(!Object.hasOwn(sans, 'jeton_du_bot'), 'sans bot, le fichier reste tel qu’avant');
  assert.equal(resumeDuReglage(sans).bot, false);
  const avec = reglageDiscordDEssai({ jetonDuBot: JETON_DU_BOT_D_ESSAI });
  assert.equal(validerReglage(JSON.parse(JSON.stringify(avec))).jeton_du_bot, JETON_DU_BOT_D_ESSAI);
  const resume = resumeDuReglage(avec);
  assert.equal(resume.bot, true);
  assert.ok(!JSON.stringify(resume).includes(JETON_DU_BOT_D_ESSAI), 'le résumé dit « posé », jamais la valeur');
  for (const mauvais of ['court', 'un jeton avec des espaces dedans', 42, null, 'x'.repeat(201)]) {
    assert.throws(() => validerReglage({ ...sans, jeton_du_bot: mauvais }), (e) => /jeton du bot/.test(e.message) && !e.message.includes(String(mauvais)), String(mauvais).slice(0, 20));
  }
  // la commande de l'hôte : le jeton vient de l'entrée standard, jamais d'un argument ; les autres commandes le gardent ; `sans-bot` le retire
  const fichier = fichierTemporaire('discord.json', 'discord-bot');
  writeFileSync(fichier, JSON.stringify(sans));
  const pose = await commande(['bot'], { entree: `${JETON_DU_BOT_D_ESSAI}\nignoré\n`, fichier });
  assert.equal(pose.code, 0, pose.erreurs.join());
  assert.equal(pose.reglage.jeton_du_bot, JETON_DU_BOT_D_ESSAI);
  writeFileSync(fichier, JSON.stringify(pose.reglage));
  for (const argv of [['role', ROLE_MJ, 'mj'], ['serveur', '123456789012345678'], ['nouvelle-session']]) assert.equal((await commande(argv, { fichier })).reglage.jeton_du_bot, JETON_DU_BOT_D_ESSAI, argv.join(' '));
  const repose = await commande(['definir', CLIENT_D_ESSAI, ADRESSE_DE_RETOUR_D_ESSAI], { entree: `${SECRET_D_ESSAI}\n`, fichier });
  assert.equal(repose.reglage.jeton_du_bot, JETON_DU_BOT_D_ESSAI, 'poser l’application garde le bot');
  const retire = await commande(['sans-bot'], { fichier });
  assert.equal(retire.code, 0);
  assert.ok(!Object.hasOwn(retire.reglage, 'jeton_du_bot'));
  writeFileSync(fichier, JSON.stringify(retire.reglage));
  assert.match((await commande(['sans-bot'], { fichier })).erreurs.join(), /aucun jeton de bot/);
  const trop = await commande(['bot'], { entree: 'court\n', fichier });
  assert.equal(trop.code, 1);
  assert.match(trop.erreurs.join(), /jeton du bot/);
  assert.equal((await commande(['bot'], { entree: '\n', fichier })).code, 1, 'un jeton vide est refusé');
});

test('R314 : la session porte `v`, l’instant de sa dernière vérification ; un ancien cookie sans `v` reste valide ; une valeur invalide est ignorée', () => {
  const secret = 'a'.repeat(64);
  const avecV = creerJetonDeSession(secret, { u: 'u-1', n: 'mj', exp: EXP, v: S });
  assert.deepEqual(lireJetonDeSession(secret, avecV, S), { u: 'u-1', n: 'mj', exp: EXP, v: S });
  const ancien = creerJetonDeSession(secret, { u: 'u-1', n: 'mj', exp: EXP });
  assert.deepEqual(lireJetonDeSession(secret, ancien, S), { u: 'u-1', n: 'mj', exp: EXP });
  assert.deepEqual(lireJetonDeSession(secret, signer(secret, 'session', { u: 'u-1', n: 'mj', exp: EXP, v: 'hier' }), S), { u: 'u-1', n: 'mj', exp: EXP });
});

/** Un monde avec le bot posé ; les rappels de `reverifier` notent ce qu'ils reçoivent. */
function mondeDuBot({ compte = 'u-1', ...options } = {}) {
  const m = monde({ jetonDuBot: JETON_DU_BOT_D_ESSAI, ...options });
  const niveaux = [];
  const effaces = [];
  const reponseAuxEffacements = { id: compte, efface: true, bloque: [] };
  const rappels = { discordIdDe: (u) => (u === compte ? IDENTIFIANT_D_ESSAI : null), mettreAJour: (u, n) => niveaux.push([u, n]), effacer: (id) => { effaces.push(id); return reponseAuxEffacements; } };
  /** La session d'un niveau, vérifiée il y a `age` secondes (null : cookie sans `v`). */
  const cookie = (niveau, { age = null, u = compte, exp = EXP } = {}) => m.session(niveau, { u, exp, ...(age === null ? {} : { v: S - age }) });
  const lire = (jeton) => lireJetonDeSession(m.reglage.secret_de_session, jeton, m.horloge.t / 1000);
  const avancer = (secondes) => { m.horloge.t += secondes * 1000; };
  return { ...m, niveaux, effaces, rappels, cookie, lire, avancer, reverifier: (entetes, r = rappels) => m.connexion.reverifier(entetes, r) };
}
const jetonDuCookie = (c) => c.split(';')[0].split('=')[1];

test('R314 : sans jeton de bot, rien ne change : aucun appel à Discord, quelle que soit l’ancienneté de la session', () => {
  const m = monde();
  assert.equal(m.connexion.reverifier(m.session('joueur', { u: 'u-1', exp: EXP }), { discordIdDe: () => { throw new Error('jamais'); } }), null);
  assert.equal(m.d.appels.length, 0);
});

test('R314 : pas d’appel avant 5 minutes ; une session sans compte (`u` null), la base absente ou gelée (permis) ne coûtent aucun appel ; exactement 5 minutes ou sans `v` : à revérifier', async () => {
  const m = mondeDuBot();
  assert.equal(m.reverifier(m.cookie('joueur', { age: INTERVALLE_DE_REVERIFICATION_S - 1 })), null, 'vérifiée il y a moins de 5 minutes');
  assert.equal(m.reverifier({}), null, 'sans cookie');
  assert.equal(m.reverifier({ cookie: `${COOKIE_SESSION}=v1.faux.faux` }), null, 'cookie falsifié');
  assert.equal(m.reverifier(m.cookie('observateur', { age: 3600, u: null })), null, 'sans compte : l’identifiant Discord n’est plus connu (R312)');
  assert.equal(m.reverifier(m.cookie('joueur', { age: 3600 }), { ...m.rappels, permis: () => false }), null, 'permis faux (gel, pas de base)');
  assert.equal(m.d.appelsDuBot().length, 0);
  assert.equal(typeof m.reverifier(m.cookie('joueur', { age: INTERVALLE_DE_REVERIFICATION_S }))?.then, 'function');
  const b = mondeDuBot();
  assert.equal(typeof b.reverifier(b.cookie('joueur', { age: null }))?.then, 'function', 'un ancien cookie sans `v` est à revérifier');
  await new Promise((ok) => setImmediate(ok));
});

test('R314, R312 : un compte effacé depuis (départ constaté sur un autre appareil) ramène la session de cet appareil à Observateur sans compte, même `exp`, sans appel à Discord ; un identifiant Discord invalide ne change rien', async () => {
  // deux appareils : le départ est constaté sur le premier, le second devient Observateur sans compte à sa revérification
  const m = mondeDuBot();
  m.d.etat.membre = null;
  const appareilA = m.cookie('mj', { age: 900 });
  const appareilB = m.cookie('mj', { age: 900 });
  const a = await m.reverifier(appareilA);
  assert.equal(a.session.u, null);
  assert.equal(m.d.appelsDuBot().length, 1);
  const effacee = { ...m.rappels, discordIdDe: () => null }; // le compte n'existe plus : l'identifiant Discord n'est plus connu
  const b = await m.reverifier(appareilB, effacee);
  // l'appareil B reçoit le résultat récent de A (même expiration) ; sans résultat récent, la session B tombe d'elle-même
  assert.deepEqual(b.session, { u: null, n: 'observateur', exp: EXP, v: S });
  const c = mondeDuBot();
  const r = await c.reverifier(c.cookie('mj', { age: 3600, exp: EXP - 10 }), { ...c.rappels, discordIdDe: () => null });
  assert.deepEqual(r.session, { u: null, n: 'observateur', exp: EXP - 10, v: S });
  assert.deepEqual(c.lire(jetonDuCookie(r.cookies[0])), r.session);
  assert.equal(c.d.appelsDuBot().length, 0, 'aucun appel à Discord');
  assert.match(c.journal.join('\n'), /observateur sans compte \(utilisateur u-1 introuvable/);
  assert.ok(!c.journal.join('\n').includes(IDENTIFIANT_D_ESSAI));
  assert.equal(c.reverifier(c.cookie('observateur', { age: 60, u: null })), null, 'ensuite, plus rien à revérifier');
  // un identifiant Discord présent mais invalide : rien ne change
  const d = mondeDuBot();
  assert.equal(await d.reverifier(d.cookie('joueur', { age: 3600 }), { ...d.rappels, discordIdDe: () => 'pas-un-identifiant' }), null);
  assert.equal(d.d.appelsDuBot().length, 0);
});

test('R314 : le résultat partagé entre deux sessions d’une même personne garde l’expiration de chacune (jamais celle de l’autre) ; une session déjà expirée ne reçoit rien', async () => {
  const m = mondeDuBot();
  m.d.etat.membre = { ...MEMBRE_D_ESSAI, roles: [ROLE_MJ] };
  const longue = m.cookie('joueur', { age: 900, exp: EXP });
  const courte = m.cookie('joueur', { age: 900, exp: EXP - 100 });
  const expiree = m.cookie('joueur', { age: 900, exp: S - 1 });
  const [a, b, c] = await Promise.all([m.reverifier(longue), m.reverifier(courte), m.reverifier(expiree)]);
  assert.equal(m.d.appelsDuBot().length, 1, 'un seul appel');
  assert.equal(a.session.exp, EXP);
  assert.equal(b.session.exp, EXP - 100);
  assert.equal(b.session.n, 'mj');
  assert.deepEqual(m.lire(jetonDuCookie(b.cookies[0])), { u: 'u-1', n: 'mj', exp: EXP - 100, v: S });
  assert.match(b.cookies[0], new RegExp(`Max-Age=${EXP - 100 - S};`));
  assert.equal(c, null, 'session expirée : rien n’est posé');
});

test('R314 : niveau monté puis baissé — l’appel du bot, la ligne écrite, le cookie réémis (même `exp`, `v` à jour), le résultat partagé avec l’ancien cookie, puis 5 minutes plus tard la baisse', async () => {
  const m = mondeDuBot();
  m.d.etat.membre = { ...MEMBRE_D_ESSAI, roles: [ROLE_MJ] };
  const entetes = m.cookie('joueur', { age: 600 });
  const r = await m.reverifier(entetes);
  assert.deepEqual(r.session, { u: 'u-1', n: 'mj', exp: EXP, v: S });
  assert.deepEqual(m.niveaux, [['u-1', 'mj']]);
  const [appel] = m.d.appelsDuBot();
  assert.equal(appel.url, `https://discord.com/api/v10/guilds/${SERVEUR_D_ESSAI}/members/${IDENTIFIANT_D_ESSAI}`);
  assert.equal(appel.methode, 'GET');
  assert.equal(appel.entetes.authorization, `Bot ${JETON_DU_BOT_D_ESSAI}`);
  assert.ok(appel.signal, 'un délai borné');
  // le cookie réémis : même expiration, durée = le reste de la session, HttpOnly, Secure derrière https ; relu, il porte le nouveau niveau
  assert.equal(r.cookies.length, 1);
  assert.match(r.cookies[0], new RegExp(`^${COOKIE_SESSION}=v1\\.[^;]+; Path=/; HttpOnly; SameSite=Lax; Max-Age=${EXP - S}; Secure$`));
  assert.deepEqual(m.lire(jetonDuCookie(r.cookies[0])), { u: 'u-1', n: 'mj', exp: EXP, v: S });
  // l'ancien cookie, encore en route : il reçoit ce résultat, sans nouvel appel ; le nouveau cookie n'est pas à revérifier avant 5 minutes
  assert.deepEqual(m.reverifier(entetes).session, r.session);
  assert.equal(m.reverifier({ cookie: r.cookies[0].split(';')[0] }), null);
  assert.equal(m.d.appelsDuBot().length, 1);
  // 5 minutes plus tard, le rôle est retiré : le niveau baisse, `exp` ne bouge pas
  m.avancer(INTERVALLE_DE_REVERIFICATION_S);
  m.d.etat.membre = { ...MEMBRE_D_ESSAI, roles: [] };
  const baisse = await m.reverifier({ cookie: r.cookies[0].split(';')[0] });
  assert.deepEqual(baisse.session, { u: 'u-1', n: 'observateur', exp: EXP, v: S + INTERVALLE_DE_REVERIFICATION_S });
  assert.deepEqual(m.niveaux, [['u-1', 'mj'], ['u-1', 'observateur']]);
  assert.equal(m.d.appelsDuBot().length, 2);
  // le journal dit les changements de niveau, jamais le jeton du bot, un cookie ni l'identifiant Discord
  const tout = m.journal.join('\n');
  assert.match(tout, /niveau revérifié joueur -> mj \(utilisateur u-1\)/);
  for (const secret of [JETON_DU_BOT_D_ESSAI, IDENTIFIANT_D_ESSAI, m.reglage.secret_de_session, jetonDuCookie(r.cookies[0])]) assert.ok(!tout.includes(secret), `« ${secret.slice(0, 10)}… » au journal`);
});

test('R314 : des requêtes simultanées d’une même personne ne font qu’un appel à Discord, et partagent son résultat', async () => {
  const m = mondeDuBot();
  m.d.etat.membre = { ...MEMBRE_D_ESSAI, roles: [ROLE_CREATEUR] };
  const e = m.cookie('joueur', { age: 900 });
  const resultats = await Promise.all([m.reverifier(e), m.reverifier(e), m.reverifier(e)]);
  assert.equal(m.d.appelsDuBot().length, 1);
  assert.deepEqual(resultats.map((r) => r.session.n), ['createur', 'createur', 'createur']);
  assert.equal(m.niveaux.length, 1, 'le niveau n’est écrit qu’une fois');
});

test('R314 : un départ constaté (404 « Unknown Member », 10007) se traite comme à la connexion — compte effacé (R312), session Observateur sans compte, même expiration ; ensuite plus rien à revérifier', async () => {
  const m = mondeDuBot();
  m.d.etat.membre = null;
  const r = await m.reverifier(m.cookie('mj', { age: 900 }));
  assert.deepEqual(m.effaces, [IDENTIFIANT_D_ESSAI]);
  assert.deepEqual(r.session, { u: null, n: 'observateur', exp: EXP, v: S });
  assert.deepEqual(m.niveaux, [], 'aucun niveau n’est écrit pour un compte effacé');
  assert.equal(m.reverifier({ cookie: r.cookies[0].split(';')[0] }), null, 'la session sans compte n’est plus revérifiée (R312)');
  assert.match(m.journal.join('\n'), /départ du serveur constaté, compte u-1 effacé \(R312\)/);
  // un effacement refusé (référence sans cascade) laisse le compte, le dit au journal, et la session devient quand même Observateur sans compte (comme à la connexion)
  const b = mondeDuBot();
  b.d.etat.membre = null;
  const refuse = await b.reverifier(b.cookie('mj', { age: 900 }), { ...b.rappels, effacer: () => ({ id: 'u-1', efface: false, bloque: ['personnage.proprietaire_id (1)'] }) });
  assert.equal(refuse.session.u, null);
  assert.match(b.journal.join('\n'), /compte u-1 NON effacé : référencé par personnage\.proprietaire_id \(1\)/);
  // un effacement qui lève : noté, la session ne casse pas
  const c = mondeDuBot();
  c.d.etat.membre = null;
  const leve = await c.reverifier(c.cookie('mj', { age: 900 }), { ...c.rappels, effacer: () => { throw new Error('base verrouillée'); } });
  assert.equal(leve.session.u, null);
  assert.match(c.journal.join('\n'), /effacement du compte impossible \(base verrouillée\)/);
});

test('R314 : Discord ou le bot en échec (401, 403/50001, 404 autre que 10007, 429, 5xx, réponse illisible, autre membre, panne réseau) : le niveau est gardé, rien n’est écrit ni effacé, pas de cookie réémis, pas de nouvel appel pendant la pause, une ligne au journal', async () => {
  const cas = [
    ['401 jeton refusé', { statut: 401, corps: { message: '401: Unauthorized', code: 0 } }, 300],
    ['403 Missing Access', { statut: 403, corps: { message: 'Missing Access', code: 50001 } }, 300],
    ['404 Unknown Guild', { statut: 404, corps: { message: 'Unknown Guild', code: 10004 } }, 300],
    ['404 Unknown User', { statut: 404, corps: { message: 'Unknown User', code: 10013 } }, 300],
    ['404 sans code', { statut: 404, corps: { message: '404: Not Found' } }, 300],
    ['429 retry_after du corps', { statut: 429, corps: { message: 'You are being rate limited.', retry_after: 900.5, global: false } }, 901],
    ['429 Retry-After de l’en-tête', { statut: 429, corps: null, entetes: { 'Retry-After': '600' } }, 600],
    ['429 démesuré', { statut: 429, corps: { retry_after: 999999 } }, PAUSE_MAX_S],
    ['429 sans durée', { statut: 429, corps: null }, 300],
    ['500', { statut: 500, corps: { message: 'panne' } }, 300],
    ['503 sans corps', { statut: 503, corps: null }, 300],
    ['200 d’un autre membre', { statut: 200, corps: { roles: [ROLE_MJ], user: { id: '800000000000000099' } } }, 300],
    ['200 illisible', { statut: 200, corps: [] }, 300],
    ['panne réseau', { panne: 'reseau' }, 300],
  ];
  for (const [nom, bot, pause] of cas) {
    const m = mondeDuBot();
    Object.assign(m.d.etat.bot, bot);
    const e = m.cookie('mj', { age: 900 });
    assert.equal(await m.reverifier(e), null, nom);
    assert.deepEqual([m.niveaux, m.effaces], [[], []], nom);
    assert.equal(m.d.appelsDuBot().length, 1, nom);
    // la pause est globale : une autre personne, ou la même, n'appelle pas Discord avant son terme
    assert.equal(m.reverifier(e), null, `${nom} : pas de rafale`);
    assert.equal(m.reverifier(m.cookie('joueur', { age: 900, u: 'u-2' }), { ...m.rappels, discordIdDe: () => IDENTIFIANT_D_ESSAI }), null, `${nom} : une autre personne non plus`);
    m.avancer(pause - 1);
    assert.equal(m.reverifier(e), null, `${nom} : encore en pause`);
    assert.equal(m.d.appelsDuBot().length, 1, nom);
    m.avancer(1);
    Object.assign(m.d.etat.bot, { statut: 200, corps: undefined, entetes: {}, panne: null });
    const reprise = await m.reverifier(e);
    assert.equal(reprise?.session.n, 'joueur', `${nom} : la pause finie, la revérification reprend (le membre n’a que le rôle Joueur)`);
    assert.equal(m.d.appelsDuBot().length, 2, nom);
    // une ligne par épisode, sans jeton ni identifiant Discord ; la reprise est dite
    const tout = m.journal.join('\n');
    assert.equal(m.journal.filter((l) => /revérification du niveau impossible/.test(l)).length, 1, nom);
    assert.match(tout, /revérification du niveau rétablie/, nom);
    // 10004 : ce que Discord répond aussi tant que le bot n'est pas invité (constaté le 2026-11-27) ; la ligne le dit
    if (bot.corps?.code === 10004) assert.match(tout, /serveur inconnu du bot \(404, code 10004 : le bot est-il invité dans le serveur/, nom);
    for (const secret of [JETON_DU_BOT_D_ESSAI, IDENTIFIANT_D_ESSAI]) assert.ok(!tout.includes(secret), `${nom} : « ${secret.slice(0, 10)}… » au journal`);
  }
  // le même échec qui dure : toujours une seule ligne au journal
  const m = mondeDuBot();
  m.d.etat.bot.statut = 500;
  for (let n = 0; n < 4; n += 1) {
    await m.reverifier(m.cookie('mj', { age: 900 }));
    m.avancer(PAUSE_MAX_S);
  }
  assert.equal(m.d.appelsDuBot().length, 4);
  assert.equal(m.journal.filter((l) => /revérification du niveau impossible/.test(l)).length, 1);
});

test('R314 : un bot refusé (401) ne change jamais un niveau ni n’efface un compte, même quand le membre a vraiment quitté le serveur : une panne n’est pas un départ', async () => {
  const m = mondeDuBot();
  m.d.etat.membre = null;
  m.d.etat.bot.jeton = 'un-autre-jeton-que-celui-du-reglage';
  assert.equal(await m.reverifier(m.cookie('createur', { age: 900 })), null);
  assert.deepEqual([m.niveaux, m.effaces], [[], []]);
});

test('R314 : une écriture du niveau qui échoue n’empêche pas la session de suivre la vérification (une ligne au journal)', async () => {
  const m = mondeDuBot();
  m.d.etat.membre = { ...MEMBRE_D_ESSAI, roles: [ROLE_MJ] };
  const r = await m.reverifier(m.cookie('joueur', { age: 900 }), { ...m.rappels, mettreAJour: () => { throw new Error('base verrouillée'); } });
  assert.equal(r.session.n, 'mj');
  assert.match(m.journal.join('\n'), /niveau revérifié non écrit \(utilisateur u-1 : base verrouillée\)/);
});

test('R314 : à la connexion, la session porte `v` (le niveau vient d’être vérifié) : pas de revérification dans les 5 minutes qui suivent', async () => {
  const m = mondeDuBot();
  const { reponse } = await m.connecter({ retour: '/regles/' });
  const jeton = jetonDe(reponse);
  assert.equal(m.lire(jeton).v, S);
  assert.equal(m.reverifier({ cookie: `${COOKIE_SESSION}=${jeton}` }), null);
  assert.equal(m.d.appelsDuBot().length, 0);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// R315 : une connexion commune au site de dev et à la production
// ---------------------------------------------------------------------------------------------------------------------------------------------

const DOMAINE_D_ESSAI = 'exemple.test';
const SECRET_COMMUN = 'c0'.repeat(32);
const RETIRE_DE_L_HOTE = `${COOKIE_SESSION}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax; Secure`;

/** Le site de dev d'essai, la connexion commune posée (le bot, le domaine, le secret partagé) ; `prod()` : la production, même Discord, même heure, ses propres rôles. */
function mondeCommun({ roles, rolesProd = { [ROLE_MJ]: 'joueur' }, ...options } = {}) {
  const m = mondeDuBot({ domaineCommun: DOMAINE_D_ESSAI, secretDeSession: SECRET_COMMUN, ...(roles ? { roles } : {}), ...options });
  const rappels = { ...m.rappels, enregistrer: m.enregistrer };
  /** La session ouverte sur l'autre site (la production), signée avec le secret commun. */
  const venue = (niveau, { u = 'u-prod', exp = S + DUREE_SESSION_PROD_S - 2 * 86400, v = S - 60, d = IDENTIFIANT_D_ESSAI, i = 'prod' } = {}) => ({
    cookie: `${COOKIE_SESSION}=${creerJetonDeSession(SECRET_COMMUN, { u, n: niveau, exp, v, d, i })}`,
  });
  function prod() {
    const fichier = fichierTemporaire('discord.json', 'discord-prod');
    writeFileSync(fichier, JSON.stringify(reglageDiscordDEssai({ roles: rolesProd, jetonDuBot: JETON_DU_BOT_D_ESSAI, domaineCommun: DOMAINE_D_ESSAI, secretDeSession: SECRET_COMMUN })));
    const ecrits = [];
    const connexion = creerConnexion({ fichier, fetch: m.d.fetch, horloge: () => m.horloge.t, edition: false, journal: (l) => m.journal.push(l) });
    const rappelsProd = {
      discordIdDe: (u) => (u === 'u-prod' ? IDENTIFIANT_D_ESSAI : null), mettreAJour: () => {}, effacer: () => ({ id: null, efface: false, bloque: [] }),
      enregistrer: (profil) => { ecrits.push(profil); return 'u-prod'; },
    };
    return { connexion, ecrits, reverifier: (entetes) => connexion.reverifier(entetes, rappelsProd) };
  }
  return { ...m, rappels, venue, prod, convertir: (entetes, r = rappels) => m.connexion.reverifier(entetes, r) };
}

test('R315 : la connexion commune dans le réglage — facultative, un domaine en minuscules, le bot exigé, l’adresse de retour dans le domaine ; posée par la commande avec le secret de session de l’autre site (sur l’entrée, jamais en argument), gardée par les autres commandes, retirée par sans-commune', async () => {
  const sans = reglageDiscordDEssai({ jetonDuBot: JETON_DU_BOT_D_ESSAI });
  assert.ok(!Object.hasOwn(sans, 'domaine_commun'), 'sans connexion commune, le fichier reste tel qu’avant');
  assert.ok(!Object.hasOwn(resumeDuReglage(sans), 'domaine_commun'));
  const avec = validerReglage({ ...sans, domaine_commun: DOMAINE_D_ESSAI });
  assert.equal(avec.domaine_commun, DOMAINE_D_ESSAI);
  assert.equal(resumeDuReglage(avec).domaine_commun, DOMAINE_D_ESSAI);
  assert.ok(!JSON.stringify(resumeDuReglage(avec)).includes(avec.secret_de_session));
  for (const mauvais of ['Exemple.test', '.exemple.test', 'exemple', 'exemple..test', 'exemple.test.', '-exemple.test', 'exemple.test/x', 42, null]) {
    assert.throws(() => validerReglage({ ...sans, domaine_commun: mauvais }), /domaine commun invalide/, String(mauvais));
  }
  assert.throws(() => validerReglage({ ...reglageDiscordDEssai(), domaine_commun: DOMAINE_D_ESSAI }), /demande le bot/, 'chaque site recalcule le niveau : le bot est exigé');
  for (const ailleurs of ['ailleurs.test', 'mple.test']) assert.throws(() => validerReglage({ ...sans, domaine_commun: ailleurs }), /n’est pas dans le domaine commun/, ailleurs);
  // la commande : `commune <domaine>`, le secret de session de l'autre site sur l'entrée standard (première ligne)
  const fichier = fichierTemporaire('discord.json', 'discord-commune');
  writeFileSync(fichier, JSON.stringify(sans));
  const autre = reglageDiscordDEssai({ jetonDuBot: JETON_DU_BOT_D_ESSAI, roles: { [ROLE_MJ]: 'createur' } });
  assert.notEqual(autre.secret_de_session, sans.secret_de_session);
  const pose = await commande(['commune', DOMAINE_D_ESSAI], { entree: `${autre.secret_de_session}\nignoré\n`, fichier });
  assert.equal(pose.code, 0, pose.erreurs.join());
  assert.deepEqual([pose.reglage.domaine_commun, pose.reglage.secret_de_session], [DOMAINE_D_ESSAI, autre.secret_de_session]);
  assert.deepEqual([pose.reglage.roles, pose.reglage.jeton_du_bot, pose.reglage.client_id], [sans.roles, sans.jeton_du_bot, sans.client_id], 'chaque site garde ses rôles (R315 (2)), son bot, son application');
  writeFileSync(fichier, JSON.stringify(pose.reglage));
  for (const argv of [['role', ROLE_MJ, 'createur'], ['serveur', '123456789012345678']]) assert.equal((await commande(argv, { fichier })).reglage.domaine_commun, DOMAINE_D_ESSAI, argv.join(' '));
  assert.match((await commande(['sans-bot'], { fichier })).erreurs.join(), /demande le bot/, 'le bot ne se retire pas sous une connexion commune');
  const secretDeLAutre = `${autre.secret_de_session}\n`;
  for (const [argv, entree, motif] of [
    [['commune', DOMAINE_D_ESSAI], '', /secret de session invalide/], [['commune', DOMAINE_D_ESSAI], 'court\n', /secret de session invalide/],
    [['commune', DOMAINE_D_ESSAI], `${'C0'.repeat(32)}\n`, /secret de session invalide/],
    [['commune', 'ailleurs.test'], secretDeLAutre, /pas dans le domaine commun/], [['commune'], secretDeLAutre, /domaine commun invalide/],
  ]) {
    const r = await commande(argv, { fichier, entree });
    assert.deepEqual([r.code, r.reglage], [1, null], `${argv.join(' ')} ${entree.slice(0, 12)}`);
    assert.match(r.erreurs.join(), motif, argv.join(' '));
    assert.ok(!r.erreurs.join().includes(autre.secret_de_session), 'jamais le secret dans un message');
  }
  const retire = await commande(['sans-commune'], { fichier });
  assert.equal(retire.code, 0, retire.erreurs.join());
  assert.ok(!Object.hasOwn(retire.reglage, 'domaine_commun'));
  writeFileSync(fichier, JSON.stringify(retire.reglage));
  assert.match((await commande(['sans-commune'], { fichier })).erreurs.join(), /aucune connexion commune/);
});

test('R315 : le cookie commun — posé sur le domaine (Domain=) avec le retrait de l’ancien cookie propre à l’hôte ; sans domaine, rien ne change ; le jeton porte `d` et `i` (un `i` inconnu ou un `d` invalide sont ignorés)', () => {
  assert.deepEqual(cookiesDeSession('v1.a.b', { securise: true, dureeS: 60 }), [`${COOKIE_SESSION}=v1.a.b; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure`]);
  assert.deepEqual(cookiesDeSession('v1.a.b', { securise: true, dureeS: 60, domaine: DOMAINE_D_ESSAI }), [
    `${COOKIE_SESSION}=v1.a.b; Path=/; Domain=exemple.test; HttpOnly; SameSite=Lax; Max-Age=60; Secure`, RETIRE_DE_L_HOTE,
  ]);
  const secret = 'a'.repeat(64);
  const complet = { u: 'u-1', n: 'mj', exp: EXP, v: S, d: IDENTIFIANT_D_ESSAI, i: 'prod' };
  assert.deepEqual(lireJetonDeSession(secret, creerJetonDeSession(secret, complet), S), complet);
  assert.deepEqual(lireJetonDeSession(secret, signer(secret, 'session', { ...complet, d: 'abc', i: 'test' }), S), { u: 'u-1', n: 'mj', exp: EXP, v: S });
  assert.deepEqual(lireJetonDeSession(secret, creerJetonDeSession(secret, { ...complet, d: null, i: 'autre' }), S), { u: 'u-1', n: 'mj', exp: EXP, v: S }, 'rien d’inconnu n’est signé');
});

test('R315 : à la connexion, avec la connexion commune, le cookie vaut pour les deux sites (Domain=, `i` le site, `d` l’identifiant Discord du membre) et l’ancien cookie de l’hôte est retiré ; sans elle, rien ne change ; la déconnexion retire les deux', async () => {
  const m = mondeCommun();
  const { reponse } = await m.connecter({ retour: '/regles/' });
  const pose = cookieDe(reponse, COOKIE_SESSION);
  assert.match(pose, /^maverick_session=v1\.[^;]+; Path=\/; Domain=exemple\.test; HttpOnly; SameSite=Lax; Max-Age=43200; Secure$/);
  assert.ok(reponse.cookies.includes(RETIRE_DE_L_HOTE), 'l’ancien cookie propre à l’hôte est retiré');
  assert.deepEqual(m.lire(jetonDe(reponse)), { u: 'u-1', n: 'joueur', exp: EXP, v: S, d: IDENTIFIANT_D_ESSAI, i: 'dev' });
  assert.deepEqual(m.connexion.cookiesDeDeconnexion({}), [RETIRE_DE_L_HOTE, `${COOKIE_SESSION}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Domain=exemple.test; HttpOnly; SameSite=Lax; Secure`]);
  // sans connexion commune : un seul cookie, propre à l'hôte, sans `d` ni `i`
  const seul = monde();
  const { reponse: r2 } = await seul.connecter({ retour: '/regles/' });
  assert.doesNotMatch(cookieDe(r2, COOKIE_SESSION), /Domain=/);
  assert.equal(r2.cookies.filter((c) => c.startsWith(`${COOKIE_SESSION}=`)).length, 1);
  assert.deepEqual(Object.keys(lireJetonDeSession(seul.reglage.secret_de_session, jetonDe(r2), S)).sort(), ['exp', 'n', 'u', 'v']);
  assert.deepEqual(seul.connexion.cookiesDeDeconnexion({}), [RETIRE_DE_L_HOTE]);
});

test('R315 : la session d’un membre ouverte par l’autre site ne vaut rien ici telle quelle ; la revérification la convertit — le bot relit le membre, le compte est retrouvé ou créé, le niveau vient des rôles de CE site, l’expiration ne s’allonge jamais — et l’aller-retour ne demande jamais de se reconnecter', async () => {
  const m = mondeCommun({ simule: { membre: { ...MEMBRE_D_ESSAI, roles: [ROLE_MJ] } } });
  const prod = m.prod();
  const venue = m.venue('joueur');
  assert.equal(prod.connexion.session(venue).u, 'u-prod', 'la production lit sa session');
  assert.equal(m.connexion.session(venue), null, 'le site de dev ne croit pas un niveau calculé par la production');
  const revue = await m.convertir(venue);
  assert.equal(m.d.appelsDuBot().length, 1);
  assert.deepEqual(m.ecrits, [{
    discord_id: IDENTIFIANT_D_ESSAI, nom_affichage: 'Nom Global', niveau: 'mj', avatar_url: avatarParDefaut(IDENTIFIANT_D_ESSAI), banniere_url: null,
    serveur_rejoint_le: '2024-03-05T10:20:30Z', instant: '2026-11-27T12:00:00Z',
  }], 'le compte du site de dev est retrouvé ou créé comme au retour de Discord');
  assert.deepEqual(revue.session, { u: 'u-1', n: 'mj', exp: S + DUREE_SESSION_DEV_S, v: S, d: IDENTIFIANT_D_ESSAI, i: 'dev' }, 'MJ d’après les rôles du site de dev ; 12 h au plus');
  assert.match(revue.cookies[0], /^maverick_session=v1\.[^;]+; Path=\/; Domain=exemple\.test; HttpOnly; SameSite=Lax; Max-Age=43200; Secure$/);
  assert.equal(revue.cookies[1], RETIRE_DE_L_HOTE);
  const surDev = { cookie: revue.cookies[0].split(';')[0] };
  assert.equal(m.connexion.session(surDev).n, 'mj');
  assert.equal(m.convertir(surDev), null, 'convertie, elle vient d’être vérifiée : rien avant 5 minutes');
  // une requête partie avec le cookie de la production reçoit le même résultat, sans nouvel appel
  const encore = m.convertir(venue);
  assert.deepEqual([encore.session, m.d.appelsDuBot().length], [revue.session, 1]);
  // le retour en production : à son tour elle ne croit pas le niveau du site de dev, et convertit avec SES rôles (MJ y donne Joueur) ; l'expiration reste celle de 12 h
  assert.equal(prod.connexion.session(surDev), null);
  const retour = await prod.reverifier(surDev);
  assert.deepEqual(retour.session, { u: 'u-prod', n: 'joueur', exp: S + DUREE_SESSION_DEV_S, v: S, d: IDENTIFIANT_D_ESSAI, i: 'prod' });
  assert.deepEqual([prod.ecrits.length, prod.ecrits[0].niveau, m.d.appelsDuBot().length], [1, 'joueur', 2]);
  // des requêtes simultanées n'appellent Discord qu'une fois
  m.avancer(INTERVALLE_DE_REVERIFICATION_S);
  const autreVenue = m.venue('createur', { v: S + 1 });
  const [a, b] = await Promise.all([m.convertir(autreVenue), m.convertir(autreVenue)]);
  assert.deepEqual([a.session.n, b.session.n, m.d.appelsDuBot().length], ['mj', 'mj', 3]);
  // la session de dev la plus récemment vérifiée l'emporte (l'ancien cookie de l'hôte et le cookie commun peuvent coexister) ; une session de ce site passe avant celle de l'autre
  const ancien = creerJetonDeSession(SECRET_COMMUN, { u: 'u-1', n: 'joueur', exp: EXP, v: S - 600 });
  const recent = creerJetonDeSession(SECRET_COMMUN, { u: 'u-1', n: 'mj', exp: EXP, v: S - 10, d: IDENTIFIANT_D_ESSAI, i: 'dev' });
  for (const ordre of [[ancien, recent], [recent, ancien]]) assert.equal(m.connexion.session({ cookie: ordre.map((j) => `${COOKIE_SESSION}=${j}`).join('; ') }).n, 'mj');
  assert.equal(m.connexion.session({ cookie: `${venue.cookie}; ${COOKIE_SESSION}=${ancien}` }).n, 'joueur');
  // rien au journal qui soit secret
  const journal = m.journal.join('\n');
  for (const secret of [IDENTIFIANT_D_ESSAI, JETON_DU_BOT_D_ESSAI, SECRET_COMMUN]) assert.ok(!journal.includes(secret), `« ${secret.slice(0, 10)}… » au journal`);
});

test('R315 : la conversion — un départ constaté efface le compte de ce site (R312) et donne une session Observateur sans compte ; une panne : la session de l’autre site ne vaut rien ici (rien d’écrit, pause) ; un compte bot n’est jamais écrit ; un non-membre vaut pour les deux sites ; sans connexion commune, base absente ou gelée : rien', async () => {
  const depart = mondeCommun();
  depart.d.etat.membre = null;
  const parti = await depart.convertir(depart.venue('joueur'));
  assert.deepEqual(parti.session, { u: null, n: 'observateur', exp: S + DUREE_SESSION_DEV_S, v: S, i: 'dev' });
  assert.deepEqual([depart.effaces, depart.ecrits], [[IDENTIFIANT_D_ESSAI], []]);
  // une panne de Discord : rien d'écrit ni d'effacé, aucun cookie, pas de nouvel appel pendant la pause, une ligne au journal
  const panne = mondeCommun();
  panne.d.etat.bot.statut = 503;
  assert.equal(await panne.convertir(panne.venue('joueur')), null);
  assert.equal(panne.convertir(panne.venue('joueur')), null, 'pendant la pause, aucun nouvel appel');
  assert.deepEqual([panne.d.appelsDuBot().length, panne.ecrits, panne.effaces], [1, [], []]);
  assert.equal(panne.connexion.session(panne.venue('joueur')), null);
  assert.match(panne.journal.join('\n'), /revérification du niveau impossible \(Discord indisponible \(503\), session venue de l’autre site\)/);
  // un compte bot ou système (R310 (2)) : jamais écrit
  const robot = mondeCommun();
  robot.d.etat.utilisateur = { ...UTILISATEUR_D_ESSAI, bot: true };
  assert.equal(await robot.convertir(robot.venue('joueur')), null);
  assert.deepEqual(robot.ecrits, []);
  // un non-membre (sans compte) est Observateur sur les deux sites : sa session vaut telle quelle, sans appel
  const nonMembre = mondeCommun();
  const observateur = nonMembre.venue('observateur', { u: null, d: null });
  assert.deepEqual(nonMembre.connexion.session(observateur)?.n, 'observateur');
  assert.equal(nonMembre.convertir(observateur), null);
  // la base absente ou gelée, des rappels sans `enregistrer` : rien
  assert.equal(nonMembre.convertir(nonMembre.venue('joueur'), { ...nonMembre.rappels, permis: () => false }), null);
  assert.equal(nonMembre.convertir(nonMembre.venue('joueur'), { ...nonMembre.rappels, enregistrer: undefined }), null);
  assert.equal(nonMembre.d.appelsDuBot().length, 0);
  // sans connexion commune (même secret) : la session de l'autre site est ignorée, jamais convertie
  const seul = mondeDuBot({ secretDeSession: SECRET_COMMUN });
  const venue = { cookie: nonMembre.venue('joueur').cookie };
  assert.equal(seul.connexion.session(venue), null);
  assert.equal(seul.reverifier(venue, { ...seul.rappels, enregistrer: seul.enregistrer }), null);
  assert.equal(seul.d.appelsDuBot().length, 0);
});
