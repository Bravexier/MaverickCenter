// La connexion par Discord (client/serveur/discord.mjs ; décision R310, docs/serveur.md, « Connexion par Discord ») : le niveau d'un membre, le nom, les images, les
// dates, le réglage de l'instance, la session signée, et le flux OAuth entier avec un Discord simulé (jamais le réseau) : membre, non membre, adhésion en
// attente, exclusion temporaire, compte bot, rôles MJ et Créateur, état faux, retour hors du site, échecs de Discord, révocation du jeton.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CODES_D_ERREUR, COOKIE_ETAT, COOKIE_SESSION, DUREE_SESSION_DEV_S, DUREE_SESSION_PROD_S, NIVEAUX, PORTEES_OAUTH, RETOUR_PAR_DEFAUT, SERVEUR_PAR_DEFAUT,
  adresseDAvatar, adresseDeBanniere, adresseDeRetourValide, avatarParDefaut, commandeDiscord, creerConnexion, creerJetonDeSession, instantDeDiscord,
  lireJetonDeSession, lireSigne, niveauDuMembre, nomAffiche, resumeDuReglage, retourValide, reglageApres, signer, validerReglage,
} from '../serveur/discord.mjs';
import {
  ADRESSE_DE_RETOUR_D_ESSAI, CLIENT_D_ESSAI, ROLE_CREATEUR, ROLE_MJ, SECRET_D_ESSAI, SERVEUR_D_ESSAI, poserLAcces, reglageDiscordDEssai,
} from './aide-acces-d-essai.mjs';
import { IDENTIFIANT_D_ESSAI, MEMBRE_D_ESSAI, UTILISATEUR_D_ESSAI, discordSimule } from './aide-discord-simule.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MAINTENANT = Date.parse('2026-11-27T12:00:00Z');
const HASH = 'a'.repeat(32);
const HASH2 = 'b1'.repeat(16);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('R310 (2) : le niveau se recalcule du membre — non membre, adhésion en attente, exclusion en cours : observateur ; membre : joueur ; rôles MJ et Créateur, le plus haut l’emporte', () => {
  const roles = { [ROLE_MJ]: 'mj', [ROLE_CREATEUR]: 'createur' };
  const niveau = (membre, plus = {}) => niveauDuMembre({ membre, roles, maintenant: MAINTENANT, ...plus });
  assert.equal(niveau(null), 'observateur', 'l’appel membre a échoué : non membre');
  assert.equal(niveau(undefined), 'observateur');
  assert.equal(niveau({ roles: [] }), 'joueur');
  assert.equal(niveau({ roles: [], pending: true }), 'observateur', 'adhésion en attente');
  assert.equal(niveau({ roles: [ROLE_CREATEUR], pending: true }), 'observateur', 'un rôle ne vaut rien tant que l’adhésion est en attente');
  assert.equal(niveau({ roles: [], communication_disabled_until: '2026-11-27T12:00:01Z' }), 'observateur', 'exclusion temporaire dans le futur');
  assert.equal(niveau({ roles: [ROLE_MJ], communication_disabled_until: '2026-12-31T00:00:00+00:00' }), 'observateur');
  assert.equal(niveau({ roles: [], communication_disabled_until: '2026-11-27T11:59:59Z' }), 'joueur', 'exclusion échue');
  assert.equal(niveau({ roles: [], communication_disabled_until: null }), 'joueur');
  assert.equal(niveau({ roles: [], communication_disabled_until: 'pas une date' }), 'observateur', 'une date illisible ne donne aucun droit de plus');
  assert.equal(niveau({ roles: ['1', ROLE_MJ, '2'] }), 'mj');
  assert.equal(niveau({ roles: [ROLE_MJ, ROLE_CREATEUR] }), 'createur');
  assert.equal(niveau({ roles: [ROLE_CREATEUR, ROLE_MJ] }), 'createur', 'l’ordre des rôles ne compte pas');
  assert.equal(niveau({ roles: ['123'] }), 'joueur', 'un rôle sans correspondance ne donne rien');
  assert.equal(niveau({ roles: [ROLE_MJ] }, { roles: {} }), 'joueur', 'sans correspondance posée, tout membre est joueur');
  assert.equal(niveau({ roles: ['constructor', '__proto__', 'toString'] }, { roles: {} }), 'joueur');
  assert.equal(niveau({ roles: [Number(ROLE_MJ)] }, { roles: { [ROLE_MJ]: 'mj' } }), 'joueur', 'un rôle qui n’est pas un identifiant en texte ne correspond pas par accident');
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
  casse({ roles: { pas_un_id: 'mj' } }, /identifiant de rôle/);
  casse({ roles: [] }, /correspondance/);
  casse({ secret_de_session: 'court' }, /secret de session/);
  assert.throws(() => validerReglage(null), /illisible/);
  assert.throws(() => validerReglage([]), /illisible/);
  // « roles » absent : aucune correspondance (tout membre est joueur)
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
  assert.throws(() => reglageApres({ ancien: deux, role: { id: ROLE_MJ, niveau: 'joueur' } }), /niveau inconnu/);
  assert.throws(() => reglageApres({ ancien: deux, role: { id: ROLE_MJ, niveau: 'observateur' } }), /niveau inconnu/);
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
  /** commencer puis terminer : { debut, reponse, ecrits } ; `retour` : le chemin demandé ; `changer` : modifie ce qui revient de Discord (état, code, cookie…). */
  async function connecter({ retour, changer = {}, entetes = {} } = {}) {
    const debut = connexion.commencer({ retour, entetes });
    const adresse = debut.location ? new URL(debut.location) : null;
    const cookieEtat = debut.cookies?.[0]?.split(';')[0] ?? '';
    const retourDeDiscord = { code: d.code, etat: adresse?.searchParams.get('state'), erreur: null, entetes: { cookie: cookieEtat, ...entetes }, ...changer };
    const reponse = await connexion.terminer({ ...retourDeDiscord, enregistrer });
    return { debut, adresse, reponse };
  }
  return { ...a, d, connexion, horloge, journal, ecrits, enregistrer, connecter };
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
    assert.deepEqual(m.connexion.session({ cookie: `${COOKIE_SESSION}=${jetonDe(reponse)}` }), { u: 'u-1', n: 'joueur', exp: MAINTENANT / 1000 + duree });
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
  assert.deepEqual(await essai(['777']), { niveau: 'joueur', session: 'joueur' });
  assert.deepEqual(await essai([ROLE_CREATEUR], { roles: {} }), { niveau: 'joueur', session: 'joueur' }, 'la correspondance vient du réglage de l’instance, jamais du code');
  assert.deepEqual(await essai([ROLE_CREATEUR], { roles: { 7777777: 'createur' } }), { niveau: 'joueur', session: 'joueur' });
});

test('R310 (2) : non membre (l’appel membre répond 404 ou 403), adhésion en attente, exclusion temporaire : observateur, connecté mais sans droit', async () => {
  for (const [nom, simule, rejoint] of [
    ['non membre (404)', { membre: null, statutMembre: 404 }, null],
    ['non membre (403)', { membre: null, statutMembre: 403 }, null],
    ['adhésion en attente', { membre: { ...MEMBRE_D_ESSAI, pending: true, roles: [ROLE_CREATEUR] } }, '2024-03-05T10:20:30Z'],
    ['exclusion en cours', { membre: { ...MEMBRE_D_ESSAI, communication_disabled_until: '2026-11-28T00:00:00.000000+00:00', roles: [ROLE_MJ] } }, '2024-03-05T10:20:30Z'],
  ]) {
    const m = monde({ simule });
    const { reponse } = await m.connecter();
    assert.equal(reponse.location, RETOUR_PAR_DEFAUT, nom);
    assert.equal(m.ecrits.length, 1, nom);
    assert.equal(m.ecrits[0].niveau, 'observateur', nom);
    assert.equal(m.ecrits[0].serveur_rejoint_le, rejoint, nom);
    assert.equal(m.connexion.session({ cookie: `${COOKIE_SESSION}=${jetonDe(reponse)}` }).n, 'observateur', nom);
    assert.equal(m.ecrits[0].nom_affichage, 'Nom Global', nom);
  }
  // l'exclusion échue ne retire rien
  const m = monde({ simule: { membre: { ...MEMBRE_D_ESSAI, communication_disabled_until: '2026-11-27T11:00:00Z' } } });
  await m.connecter();
  assert.equal(m.ecrits[0].niveau, 'joueur');
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
