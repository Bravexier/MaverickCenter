// Les routes de la connexion par Discord (client/serveur/api.mjs, discord.mjs, utilisateurs.mjs ; décision R310 ; docs/serveur.md, « Connexion par Discord ») : le service HTTP réel
// avec un Discord simulé (aucun appel réseau), la ligne de `utilisateur` écrite à la première connexion puis mise à jour (identifiant du site stable), le cookie de session, le profil
// de `GET /api/moi/`, la déconnexion, les refus (bot, état faux, retour hors du site, gel des écritures, base absente) et la porte du site de dev qui suit le niveau du cookie.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { COOKIE_ETAT, COOKIE_SESSION, reglageApres } from '../serveur/discord.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { enregistrerLaConnexion, lireLeProfil } from '../serveur/utilisateurs.mjs';
import { ROLE_CREATEUR, ROLE_MJ, SERVEUR_D_ESSAI, poserLAcces } from './aide-acces-d-essai.mjs';
import { poserUnCompte } from './aide-compte-d-essai.mjs';
import { IDENTIFIANT_D_ESSAI, MEMBRE_D_ESSAI, UTILISATEUR_D_ESSAI, discordSimule } from './aide-discord-simule.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const JSON_ = { 'content-type': 'application/json' };
const HASH = 'c'.repeat(32);

/** Le schéma de data/schema.sql, vide, comme règles d'un service d'essai (la table `utilisateur` y est telle que la migration 0132 la laisse). */
function reglesVides() {
  const dossier = dossierTemporaire('connexion-base');
  const regles = join(dossier, 'maverick.db');
  const schema = new DatabaseSync(regles);
  schema.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  schema.close();
  return { dossier, regles };
}
const baseVive = () => {
  const { dossier, regles } = reglesVides();
  const { chemin } = preparerBaseVivante({ regles, dossier: join(dossier, 'db') });
  return ouvrirBaseVivante(chemin);
};
const profilEcrit = (extra = {}) => ({
  discord_id: IDENTIFIANT_D_ESSAI, nom_affichage: 'Nom', niveau: 'joueur', avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png', banniere_url: null,
  serveur_rejoint_le: '2024-03-05T10:20:30Z', instant: '2026-11-27T12:00:00Z', ...extra,
});

test('R310 (5) : la première connexion écrit la ligne (identifiant du site tiré au hasard) ; les suivantes la mettent à jour sans changer l’identifiant ni la première connexion ; les contraintes de la table tiennent', () => {
  const db = baseVive();
  const id = enregistrerLaConnexion(db, profilEcrit());
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'identifiant aléatoire, sans rapport avec Discord');
  assert.ok(!id.includes(IDENTIFIANT_D_ESSAI));
  const ligne = () => ({ ...db.prepare('SELECT * FROM utilisateur').get() });
  assert.deepEqual(ligne(), {
    id, discord_id: IDENTIFIANT_D_ESSAI, nom_affichage: 'Nom', cree_le: '2026-11-27T12:00:00Z', niveau: 'joueur', avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png', banniere_url: null,
    serveur_rejoint_le: '2024-03-05T10:20:30Z', derniere_connexion_le: '2026-11-27T12:00:00Z',
  });
  // une seconde connexion, plus tard, d'un niveau et d'un nom changés : même ligne
  const id2 = enregistrerLaConnexion(db, profilEcrit({ nom_affichage: 'Autre nom', niveau: 'createur', banniere_url: 'https://cdn.discordapp.com/banners/1/x.png', serveur_rejoint_le: null, instant: '2026-12-01T08:00:00Z' }));
  assert.equal(id2, id);
  assert.equal(db.prepare('SELECT count(*) AS n FROM utilisateur').get().n, 1);
  assert.deepEqual(ligne(), {
    id, discord_id: IDENTIFIANT_D_ESSAI, nom_affichage: 'Autre nom', cree_le: '2026-11-27T12:00:00Z', niveau: 'createur', avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png',
    banniere_url: 'https://cdn.discordapp.com/banners/1/x.png', serveur_rejoint_le: null, derniere_connexion_le: '2026-12-01T08:00:00Z',
  });
  // un autre compte : une autre ligne, un autre identifiant
  const autre = enregistrerLaConnexion(db, profilEcrit({ discord_id: '800000000000000002' }));
  assert.notEqual(autre, id);
  // le profil : jamais l'identifiant Discord, ni la date de première connexion
  assert.deepEqual(lireLeProfil(db, id), { nom: 'Autre nom', avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png', banniere_url: 'https://cdn.discordapp.com/banners/1/x.png', niveau: 'createur', serveur_rejoint_le: null });
  assert.equal(lireLeProfil(db, 'inconnu'), null);
  // la table refuse ce qu'elle ne doit jamais garder (une adresse d'image qui n'est pas celle du CDN de Discord, un niveau inconnu)
  assert.throws(() => enregistrerLaConnexion(db, profilEcrit({ discord_id: '9', avatar_url: 'https://exemple.test/a.png' })), /CHECK|constraint/i);
  assert.throws(() => enregistrerLaConnexion(db, profilEcrit({ discord_id: '9', niveau: 'dieu' })), /CHECK|constraint/i);
  assert.throws(() => enregistrerLaConnexion(db, profilEcrit({ discord_id: 'pas-un-id' })), /CHECK|constraint/i);
  // un compte d'essai posé par l'aide des tests a la même forme que ce que le service écrit
  poserUnCompte(db, 'u-essai', 'Compte d’essai');
  assert.equal(db.prepare("SELECT niveau FROM utilisateur WHERE id = 'u-essai'").get().niveau, 'joueur');
});

/**
 * Un service HTTP réel (site de dev ou production) avec sa connexion Discord simulée ; `appel` ne suit jamais les redirections.
 * @param {{ edition?: boolean, simule?: object, roles?: Record<string, string> }} [o]
 */
async function service({ edition = true, simule = {}, roles } = {}) {
  const { dossier, regles } = reglesVides();
  const d = discordSimule({ client: { id: '999000111222333444', secret: 'secret-d-essai-de-l-application' }, ...simule });
  const a = poserLAcces({ prefixe: 'connexion', fetch: d.fetch, edition, roles });
  const lignes = [];
  const s = await demarrerService({
    regles, dossier: join(dossier, 'service-db'), port: 0, intervalle: 0, edition, metriques: false, journal: (l) => lignes.push(l),
    connexion: { fichier: a.fichierDiscord, fetch: d.fetch }, ...(edition ? { acces: a.fichierDesCles } : {}),
  });
  const appel = (methode, chemin, { entetes = {}, corps } = {}) => fetch(`${s.url}${chemin}`, {
    method: methode, redirect: 'manual', headers: { ...(corps === undefined ? {} : JSON_), ...entetes }, ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });
  const db = new DatabaseSync(join(dossier, 'service-db', FICHIER_BASE), { readOnly: true });
  const fin = async () => { db.close(); await s.arreter(); };
  return { s, d, a, appel, db, lignes, fin, comptes: () => db.prepare('SELECT * FROM utilisateur ORDER BY cree_le').all().map((l) => ({ ...l })) };
}
const cookiesPoses = (reponse) => Object.fromEntries(reponse.headers.getSetCookie().map((c) => [c.split('=')[0], c]));
const valeur = (cookie) => cookie.split(';')[0];

/** La connexion de bout en bout : de /api/connexion/discord/ au retour ; rend la réponse du retour, l'état et le cookie de session. */
async function seConnecter(m, { retour = '/regles/', entetes = {} } = {}) {
  const debut = await m.appel('GET', `/api/connexion/discord/?retour=${encodeURIComponent(retour)}`, { entetes });
  assert.equal(debut.status, 302);
  const autorisation = new URL(debut.headers.get('location'));
  const etat = autorisation.searchParams.get('state');
  const cookieEtat = valeur(cookiesPoses(debut)[COOKIE_ETAT]);
  const fin = await m.appel('GET', `/api/connexion/discord/retour/?code=${m.d.code}&state=${etat}`, { entetes: { ...entetes, cookie: cookieEtat } });
  const posés = cookiesPoses(fin);
  return { debut, autorisation, fin, cookies: posés, session: posés[COOKIE_SESSION] ? { cookie: valeur(posés[COOKIE_SESSION]) } : null };
}

test('R310 : de bout en bout sur le service HTTP — 302 vers Discord, retour, ligne écrite, cookie de session, /api/moi/ ; une seconde connexion met la même ligne à jour (niveau recalculé)', async () => {
  const m = await service({ simule: { utilisateur: { ...UTILISATEUR_D_ESSAI, avatar: HASH }, membre: { ...MEMBRE_D_ESSAI, nick: 'Le Surnom', roles: [] } } });
  try {
    assert.deepEqual(await (await m.appel('GET', '/api/moi/')).json(), { connexion_disponible: true, connecte: false, utilisateur: null });
    const c = await seConnecter(m, { retour: '/regles/classes/', entetes: { 'x-forwarded-host': 'dev.exemple.test' } });
    assert.equal(c.autorisation.origin + c.autorisation.pathname, 'https://discord.com/oauth2/authorize');
    assert.equal(c.autorisation.searchParams.get('scope'), 'identify guilds.members.read');
    assert.equal(c.autorisation.searchParams.has('prompt'), false, 'l’écran d’accord s’affiche toujours : le jeton est révoqué à chaque connexion');
    assert.equal(c.fin.status, 302);
    assert.equal(c.fin.headers.get('location'), '/regles/classes/');
    assert.equal(c.fin.headers.get('cache-control'), 'no-store');
    assert.equal(await c.fin.text(), '', 'une redirection n’a pas de corps');
    // les cookies : la session (Path=/, HttpOnly, SameSite=Lax, Secure derrière https) et le retrait de l'état
    assert.match(c.cookies[COOKIE_SESSION], new RegExp(`^${COOKIE_SESSION}=v1\\.[^;]+; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure$`));
    assert.match(c.cookies[COOKIE_ETAT], /^maverick_etat=; Max-Age=0/);
    // la ligne écrite : seulement ce que R310 (5) garde
    const [compte] = m.comptes();
    assert.deepEqual({ ...compte, id: undefined, cree_le: undefined, derniere_connexion_le: undefined }, {
      id: undefined, discord_id: IDENTIFIANT_D_ESSAI, nom_affichage: 'Le Surnom', cree_le: undefined, niveau: 'joueur',
      avatar_url: `https://cdn.discordapp.com/avatars/${IDENTIFIANT_D_ESSAI}/${HASH}.png`, banniere_url: null, serveur_rejoint_le: '2024-03-05T10:20:30Z', derniere_connexion_le: undefined,
    });
    assert.match(compte.cree_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.equal(compte.cree_le, compte.derniere_connexion_le);
    // /api/moi/ : le profil de la session, jamais l'identifiant Discord
    const moi = await (await m.appel('GET', '/api/moi/', { entetes: c.session })).json();
    assert.deepEqual(moi, {
      connexion_disponible: true, connecte: true,
      utilisateur: { nom: 'Le Surnom', avatar_url: `https://cdn.discordapp.com/avatars/${IDENTIFIANT_D_ESSAI}/${HASH}.png`, banniere_url: null, niveau: 'joueur', serveur_rejoint_le: '2024-03-05T10:20:30Z' },
    });
    assert.ok(!Object.keys(moi.utilisateur).some((k) => /discord|jeton|token|mail/i.test(k)), 'aucun identifiant ni jeton dans le profil');
    const acces = await (await m.appel('GET', '/api/acces/', { entetes: c.session })).json();
    assert.deepEqual([acces.protege, acces.connecte, acces.niveau, acces.droit], [true, true, 'joueur', 'aucun']);

    // la fois suivante : le rôle MJ est arrivé entre-temps, le surnom a changé ; la même ligne, le niveau recalculé
    m.d.etat.membre = { ...MEMBRE_D_ESSAI, nick: 'Nouveau surnom', roles: [ROLE_MJ] };
    const c2 = await seConnecter(m);
    assert.equal(c2.fin.headers.get('location'), '/regles/');
    const comptes = m.comptes();
    assert.equal(comptes.length, 1);
    assert.deepEqual([comptes[0].id, comptes[0].cree_le, comptes[0].niveau, comptes[0].nom_affichage], [compte.id, compte.cree_le, 'mj', 'Nouveau surnom']);
    // chaque cookie porte le niveau de sa connexion : l'ancien reste joueur jusqu'à son expiration, le nouveau est MJ
    assert.equal((await (await m.appel('GET', '/api/moi/', { entetes: c.session })).json()).utilisateur.niveau, 'joueur');
    assert.equal((await (await m.appel('GET', '/api/moi/', { entetes: c2.session })).json()).utilisateur.niveau, 'mj');
    // le journal : ni jeton, ni code, ni secret
    const journal = m.lignes.join('\n');
    assert.match(journal, /connexion : joueur \(utilisateur /);
    for (const secret of [m.d.code, ...m.d.jetons, 'secret-d-essai-de-l-application', c.session.cookie.split('=')[1], IDENTIFIANT_D_ESSAI]) assert.ok(!journal.includes(secret), `« ${secret.slice(0, 10)}… » au journal`);
    // tous les jetons Discord délivrés sont révoqués : le service n'en garde aucun
    assert.deepEqual([...m.d.revoques].sort(), [...m.d.jetons].sort());
  } finally {
    await m.fin();
  }
});

test('un retour avec un caractère hors latin-1 donne un en-tête Location valide : la connexion aboutit (302), la ligne est écrite une fois', async () => {
  const m = await service();
  try {
    const { fin } = await seConnecter(m, { retour: '/l’arme/' });
    assert.equal(fin.status, 302);
    assert.equal(fin.headers.get('location'), '/l%E2%80%99arme/');
    assert.equal(m.comptes().length, 1);
  } finally {
    await m.fin();
  }
});

test('R310 (3) : sur le site de dev, la porte suit le niveau du cookie de la connexion — Joueur et Observateur n’entrent pas, MJ lit, Créateur écrit — et les clés gardent leur comportement', async () => {
  for (const [roles, niveau, lecture, ecriture] of [[[], 'joueur', 403, 403], [[ROLE_MJ], 'mj', 200, 403], [[ROLE_CREATEUR], 'createur', 200, 400]]) {
    const m = await service({ simule: { membre: { ...MEMBRE_D_ESSAI, roles } } });
    try {
      const { session } = await seConnecter(m);
      assert.equal((await m.appel('GET', '/api/v1/', { entetes: session })).status, lecture, niveau);
      assert.equal((await m.appel('POST', '/api/edition/', { entetes: session, corps: {} })).status, ecriture, `${niveau} : 400 = la porte est passée, le lot vide est refusé par l’édition`);
      // les clés : exactement comme avant
      assert.equal((await m.appel('GET', '/api/v1/', { entetes: m.a.avecCle })).status, 200);
      assert.equal((await m.appel('POST', '/api/edition/', { entetes: m.a.avecCle, corps: {} })).status, 403);
      assert.equal((await m.appel('GET', '/api/v1/')).status, 401);
    } finally {
      await m.fin();
    }
  }
  // non membre, adhésion en attente, exclusion : observateur, connecté mais sans rien
  for (const simule of [{ membre: null }, { membre: { ...MEMBRE_D_ESSAI, pending: true, roles: [ROLE_CREATEUR] } }, { membre: { ...MEMBRE_D_ESSAI, communication_disabled_until: '2999-01-01T00:00:00+00:00', roles: [ROLE_CREATEUR] } }]) {
    const m = await service({ simule });
    try {
      const { session, fin } = await seConnecter(m);
      assert.equal(fin.status, 302);
      assert.equal(m.comptes()[0].niveau, 'observateur');
      const moi = await (await m.appel('GET', '/api/moi/', { entetes: session })).json();
      assert.deepEqual([moi.connecte, moi.utilisateur.niveau], [true, 'observateur']);
      assert.equal((await m.appel('GET', '/api/v1/', { entetes: session })).status, 403);
      assert.equal((await m.appel('POST', '/api/edition/', { entetes: session, corps: {} })).status, 403);
    } finally {
      await m.fin();
    }
  }
});

test('R307, R310 (4) : sur la production la connexion et le profil marchent (session de 7 jours) et rien n’est restreint de plus', async () => {
  const m = await service({ edition: false, simule: { membre: { ...MEMBRE_D_ESSAI, roles: [ROLE_CREATEUR] } } });
  try {
    const { session, cookies, fin } = await seConnecter(m);
    assert.equal(fin.status, 302);
    assert.match(cookies[COOKIE_SESSION], /Max-Age=604800/);
    assert.equal((await (await m.appel('GET', '/api/moi/', { entetes: session })).json()).utilisateur.niveau, 'createur');
    // la production n'a pas de porte : les routes ouvertes d'avant le restent, sans session ; les routes du site de dev répondent 403 comme avant
    assert.equal((await m.appel('GET', '/api/personnages/')).status, 200);
    assert.equal((await m.appel('GET', '/api/edition/listes/')).status, 403, 'l’édition n’existe pas en production (403 d’avant, inchangé)');
    assert.equal((await m.appel('GET', '/api/v1/')).status, 403);
    assert.deepEqual(await (await m.appel('GET', '/api/acces/')).json(), { protege: false, connecte: false, niveau: null, droit: 'ecriture', expire_le: null });
    assert.deepEqual((await (await m.appel('GET', '/api/acces/', { entetes: session })).json()).niveau, 'createur');
  } finally {
    await m.fin();
  }
});

test('R310 (2) : un compte bot ou système reçoit 403 et rien n’est écrit ; l’appartenance illisible ou Discord en panne : retour à /connexion/?erreur=…, rien d’écrit', async () => {
  for (const marque of [{ bot: true }, { system: true }]) {
    const m = await service({ simule: { utilisateur: { ...UTILISATEUR_D_ESSAI, ...marque } } });
    try {
      const { fin, cookies } = await seConnecter(m);
      assert.equal(fin.status, 403);
      assert.deepEqual(await fin.json(), { erreur: 'Connexion refusée : les comptes bot et système n’ont pas accès au site.', acces: 'bot' });
      assert.deepEqual(m.comptes(), []);
      assert.equal(cookies[COOKIE_SESSION], undefined);
    } finally {
      await m.fin();
    }
  }
  for (const [simule, erreur] of [[{ statutJeton: 500 }, 'discord'], [{ membre: null, statutMembre: 500 }, 'discord'], [{ code: 'un-autre-code' }, 'refus']]) {
    const m = await service({ simule });
    try {
      const debut = await m.appel('GET', '/api/connexion/discord/');
      const etat = new URL(debut.headers.get('location')).searchParams.get('state');
      const fin = await m.appel('GET', `/api/connexion/discord/retour/?code=${simule.code ? 'le-code' : m.d.code}&state=${etat}`, { entetes: { cookie: valeur(cookiesPoses(debut)[COOKIE_ETAT]) } });
      assert.equal(fin.status, 302);
      assert.equal(fin.headers.get('location'), `/connexion/?erreur=${erreur}`);
      assert.deepEqual(m.comptes(), []);
      assert.equal(cookiesPoses(fin)[COOKIE_SESSION], undefined);
    } finally {
      await m.fin();
    }
  }
});

test('le retour de Discord : état faux ou absent, refus de l’utilisateur, retour hors du site : toujours une redirection du site, jamais vers une autre origine, Discord n’est jamais appelé pour un état faux', async () => {
  const m = await service();
  try {
    const debut = await m.appel('GET', '/api/connexion/discord/?retour=https://exemple.test/vol');
    const etat = new URL(debut.headers.get('location')).searchParams.get('state');
    const cookie = valeur(cookiesPoses(debut)[COOKIE_ETAT]);
    for (const [adresse, entetes] of [
      [`/api/connexion/discord/retour/?code=${m.d.code}&state=faux`, { cookie }], [`/api/connexion/discord/retour/?code=${m.d.code}&state=${etat}`, {}], ['/api/connexion/discord/retour/', {}],
      [`/api/connexion/discord/retour/?code=${m.d.code}`, { cookie }], [`/api/connexion/discord/retour/?error=access_denied&state=faux`, { cookie }],
    ]) {
      const r = await m.appel('GET', adresse, { entetes });
      assert.equal(r.status, 302, adresse);
      assert.equal(r.headers.get('location'), '/connexion/?erreur=etat', adresse);
    }
    assert.equal(m.d.appels.length, 0);
    // le refus de l'utilisateur chez Discord (état bon) : « refus »
    const refus = await m.appel('GET', `/api/connexion/discord/retour/?error=access_denied&state=${etat}`, { entetes: { cookie } });
    assert.equal(refus.headers.get('location'), '/connexion/?erreur=refus');
    assert.equal(m.d.appels.length, 0);
    // le retour demandé était hors du site : après la connexion, /profil/
    const fin = await m.appel('GET', `/api/connexion/discord/retour/?code=${m.d.code}&state=${etat}`, { entetes: { cookie } });
    assert.equal(fin.headers.get('location'), '/profil/');
    // une méthode autre que GET, une adresse inconnue
    assert.equal((await m.appel('POST', '/api/connexion/discord/', { entetes: m.a.createur, corps: {} })).status, 405);
    assert.equal((await m.appel('GET', '/api/connexion/autre/', { entetes: m.a.createur })).status, 404);
    assert.equal((await m.appel('GET', '/api/connexion/discord/retour/autre/', { entetes: m.a.createur })).status, 404);
    assert.equal((await m.appel('GET', '/api/connexion/autre/')).status, 401, 'fermée comme toute route inconnue du site de dev');
  } finally {
    await m.fin();
  }
});

test('POST /api/deconnexion/ : retire le cookie de session ; mêmes refus que les écritures (JSON, requête d’une page de ce site) ; ouverte, sur les deux instances', async () => {
  for (const edition of [true, false]) {
    const m = await service({ edition });
    try {
      const { session } = await seConnecter(m);
      assert.equal((await m.appel('POST', '/api/deconnexion/', { entetes: session })).status, 415, 'un corps JSON est exigé');
      assert.equal((await m.appel('POST', '/api/deconnexion/', { entetes: { ...session, 'sec-fetch-site': 'cross-site' }, corps: {} })).status, 403, 'un autre site ne déconnecte pas à la place du visiteur');
      assert.equal((await m.appel('GET', '/api/deconnexion/', { entetes: session })).status, edition ? 403 : 405, 'seulement POST (sur le site de dev, une route inconnue est fermée à un Joueur)');
      const r = await m.appel('POST', '/api/deconnexion/', { entetes: { ...session, 'x-forwarded-host': 'dev.exemple.test' }, corps: {} });
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { connecte: false });
      assert.match(cookiesPoses(r)[COOKIE_SESSION], /^maverick_session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=\/; HttpOnly; SameSite=Lax; Secure$/);
      // sans session non plus : la déconnexion ne dit rien de plus
      assert.equal((await m.appel('POST', '/api/deconnexion/', { corps: {} })).status, 200);
      // le jeton n'est pas révoqué côté serveur : il expire seul (la déconnexion retire le cookie du navigateur)
      assert.equal((await (await m.appel('GET', '/api/moi/', { entetes: session })).json()).connecte, true);
    } finally {
      await m.fin();
    }
  }
});

test('sans connexion posée, le service dit « indisponible » partout ; le réglage posé ou retiré est pris en compte sans redémarrage ; --nouvelle-session ferme les sessions', async () => {
  const m = await service();
  try {
    const { session } = await seConnecter(m);
    assert.equal((await (await m.appel('GET', '/api/moi/', { entetes: session })).json()).connecte, true);
    // une nouvelle session : le cookie d'avant tombe
    const reglage = JSON.parse(readFileSync(m.a.fichierDiscord, 'utf8'));
    writeFileSync(m.a.fichierDiscord, JSON.stringify(reglageApres({ ancien: reglage, nouvelleSession: true })));
    assert.equal((await (await m.appel('GET', '/api/moi/', { entetes: session })).json()).connecte, false);
    assert.equal((await m.appel('GET', '/api/v1/', { entetes: session })).status, 401);
    // le réglage retiré : plus de connexion, et sur le site de dev rien ne s'ouvre pour autant
    writeFileSync(m.a.fichierDiscord, '{}');
    assert.deepEqual(await (await m.appel('GET', '/api/moi/')).json(), { connexion_disponible: false, connecte: false, utilisateur: null });
    const debut = await m.appel('GET', '/api/connexion/discord/');
    assert.equal(debut.headers.get('location'), '/connexion/?erreur=indisponible');
    assert.equal((await m.appel('GET', '/api/v1/')).status, 401);
    assert.equal((await m.appel('GET', '/api/v1/', { entetes: m.a.avecCle })).status, 200);
  } finally {
    await m.fin();
  }
});

test('le retour ne s’exécute pas pendant un gel des écritures ni sans base : /connexion/?erreur=indisponible, rien d’écrit, Discord pas appelé', async () => {
  const a = poserLAcces({ prefixe: 'connexion-gel' });
  const d = discordSimule();
  const db = baseVive();
  const debut = a.connexion.commencer({ retour: '/' });
  const requete = { methode: 'GET', chemin: '/api/connexion/discord/retour/', recherche: `?code=${d.code}&state=${new URL(debut.location).searchParams.get('state')}`, entetes: { cookie: debut.cookies[0].split(';')[0] } };
  const base = { edition: true, connexion: a.connexion, acces: a.acces, journal: () => {} };
  const gele = traiter(requete, { ...base, base: () => db, gel: { refus: (methode, chemin) => (methode === 'POST' && chemin === '/api/connexion/discord/retour/' ? { statut: 503, corps: {} } : null) } });
  assert.equal(gele.statut, 302);
  assert.equal(gele.entetes.Location, '/connexion/?erreur=indisponible');
  const sansBase = traiter(requete, { ...base, base: () => null });
  assert.equal(sansBase.entetes.Location, '/connexion/?erreur=indisponible');
  assert.equal(db.prepare('SELECT count(*) AS n FROM utilisateur').get().n, 0);
  assert.equal(d.appels.length, 0);
  // se déconnecter reste possible pendant un gel (ROUTES_EXEMPTEES de serveur/gel.mjs)
  const { ecritureGelee } = await import('../serveur/gel.mjs');
  assert.equal(ecritureGelee('POST', '/api/deconnexion/'), false);
  assert.equal(ecritureGelee('POST', '/api/acces/'), true, 'plus de mot de passe : cette route n’est plus exemptée');
});
