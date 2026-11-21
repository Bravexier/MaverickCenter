// Accès au site de dev (client/serveur/acces.mjs ; docs/serveur.md, « Accès au site de dev » ; R275, question 2, option b) : le réglage (empreintes, jamais un
// secret en clair), la clé de lecture qui ne permet jamais d'écrire, la session par cookie signé qui expire et tombe au changement de mot de passe,
// la limite des essais ratés, le réglage relu sans redémarrage, un réglage illisible qui ferme au lieu d'ouvrir, et rien de secret dans le journal.
// R291 : la clé de dépôt (facultative, rien en clair), posée par la commande de l'hôte ; tant qu'elle n'est pas posée la clé de lecture dépose une proposition,
// une fois posée elle ne dépose plus (403) et seuls la clé de dépôt et le mot de passe déposent, le lot s'appliquant aussitôt.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  COOKIE, DUREE_SESSION_S, ENTETE_CLE, ENTETES_CLE, LIMITES, MOT_DE_PASSE_MIN, commandeAcces, connexionSecurisee, cookiesDeSession, creerAcces, creerJeton, egaux, lireJeton,
  nouvelleCle, reglageApres, validerReglage, valeursDuCookie,
} from '../serveur/acces.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MOT = 'un mot de passe d’essai';
const AUTRE = 'un autre mot de passe d’essai';
const sha = (x) => createHash('sha256').update(x).digest('hex');
/** Un réglage posé dans un fichier de la copie ; rend { fichier, reglage, cle, ecrire }. */
function poser({ motDePasse = MOT, portee = null, nom = 'acces.json' } = {}) {
  const fichier = fichierTemporaire(nom, 'acces');
  const { reglage, cle } = reglageApres({ motDePasse, portee });
  writeFileSync(fichier, JSON.stringify(reglage));
  return { fichier, reglage, cle };
}
/** Un contrôle d'accès d'horloge réglable (secondes depuis 1970 ≈ maintenant) et son journal. */
function controle(fichier, depart = 1_800_000_000_000) {
  const t = { ms: depart };
  const journal = [];
  const acces = creerAcces({ fichier, horloge: () => t.ms, journal: (m) => journal.push(m) });
  return { acces, t, journal, avancer: (s) => { t.ms += s * 1000; } };
}
const cookieDe = (jeton) => ({ cookie: `${COOKIE}=${jeton}` });

test('le réglage : aucune valeur en clair, une empreinte scrypt salée, une clé de lecture que le fichier ne contient pas', () => {
  const { reglage, cle } = reglageApres({ motDePasse: MOT });
  const texte = JSON.stringify(reglage);
  assert.ok(!texte.includes(MOT) && !texte.includes(cle), 'ni le mot de passe ni la clé en clair');
  assert.equal(reglage.mot_de_passe.algo, 'scrypt');
  assert.equal(reglage.portee, 'ecriture', 'option b par défaut');
  assert.equal(reglage.cle_de_lecture.empreinte, sha(cle));
  assert.match(cle, /^mvk_[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(validerReglage(JSON.parse(texte)), reglage, 'le réglage relu est le réglage écrit');
  // un sel par pose : deux poses du même mot de passe ne donnent pas la même empreinte
  assert.notEqual(reglageApres({ motDePasse: MOT }).reglage.mot_de_passe.empreinte, reglage.mot_de_passe.empreinte);
});

test('changer le mot de passe : sessions fermées (nouveau secret), clé de lecture gardée ; refaire la clé : l’ancienne ne marche plus, le mot de passe reste', () => {
  const { reglage: r1, cle } = reglageApres({ motDePasse: MOT });
  const { reglage: r2, cle: cle2 } = reglageApres({ ancien: r1, motDePasse: AUTRE });
  assert.equal(cle2, null, 'la clé n’est pas montrée de nouveau');
  assert.deepEqual(r2.cle_de_lecture, r1.cle_de_lecture);
  assert.notEqual(r2.secret_de_session, r1.secret_de_session);
  assert.equal(r2.portee, 'ecriture');

  const { reglage: r3, cle: neuve } = reglageApres({ ancien: r2, refaireLaCle: true });
  assert.notEqual(neuve, cle);
  assert.equal(r3.cle_de_lecture.empreinte, sha(neuve));
  assert.notEqual(r3.cle_de_lecture.empreinte, sha(cle));
  assert.deepEqual(r3.mot_de_passe, r2.mot_de_passe);
  assert.equal(r3.secret_de_session, r2.secret_de_session, 'les sessions ouvertes restent ouvertes');

  // la portée est un simple réglage : même mot de passe, mêmes empreintes ; les sessions sont refaites (le cookie change de chemin)
  const { reglage: r4 } = reglageApres({ ancien: r3, portee: 'tout' });
  assert.equal(r4.portee, 'tout');
  assert.deepEqual(r4.mot_de_passe, r3.mot_de_passe);
  assert.notEqual(r4.secret_de_session, r3.secret_de_session);
  assert.equal(reglageApres({ ancien: r4, portee: 'tout' }).reglage.secret_de_session, r4.secret_de_session, 'portée inchangée : sessions gardées');
});

test('refus : mot de passe trop court ou sur plusieurs lignes, portée inconnue, rien à modifier sans mot de passe posé', () => {
  assert.throws(() => reglageApres({ motDePasse: 'court' }), new RegExp(`${MOT_DE_PASSE_MIN} caractères`));
  assert.throws(() => reglageApres({ motDePasse: 'une ligne\nde trop' }), /une seule ligne/);
  assert.throws(() => reglageApres({ motDePasse: MOT, portee: 'partout' }), /portée inconnue/);
  assert.throws(() => reglageApres({ portee: 'tout' }), /aucun mot de passe/);
  assert.throws(() => reglageApres({ refaireLaCle: true }), /aucun mot de passe/);
  assert.throws(() => validerReglage({ version: 1, portee: 'tout' }), /empreinte du mot de passe/);
});

test('sans réglage tout reste ouvert (comme avant) ; le fichier posé, retiré ou refait est pris en compte sans redémarrage', () => {
  const fichier = fichierTemporaire('acces.json', 'acces');
  const { acces, journal } = controle(fichier);
  assert.equal(acces.protege(), false);
  assert.equal(acces.droit({}).droit, 'ecriture');
  assert.equal(acces.controler({ methode: 'POST', chemin: '/api/edition/', entetes: {} }), null);
  assert.equal(acces.controler({ methode: 'DELETE', chemin: '/api/inconnue/', entetes: {} }), null);
  assert.deepEqual(journal, []);

  const { reglage } = reglageApres({ motDePasse: MOT });
  writeFileSync(fichier, JSON.stringify(reglage));
  assert.equal(acces.protege(), true);
  assert.equal(acces.controler({ methode: 'POST', chemin: '/api/edition/', entetes: {} }).statut, 401);
  assert.match(journal.at(-1), /réglage relu \(protégé, portée « ecriture »\)/);

  unlinkSync(fichier);
  assert.equal(acces.protege(), false);
  assert.match(journal.at(-1), /réglage retiré/);

  // refait avec la portée « tout » : relu même si la date du fichier est la même (taille et inode comptent aussi)
  writeFileSync(fichier, JSON.stringify(reglageApres({ motDePasse: MOT, portee: 'tout' }).reglage));
  assert.equal(acces.portee(), 'tout');
  const avant = statSync(fichier);
  writeFileSync(fichier, `${JSON.stringify(reglageApres({ motDePasse: MOT, portee: 'ecriture' }).reglage)} `);
  utimesSync(fichier, avant.atime, avant.mtime);
  assert.equal(acces.portee(), 'ecriture');
});

test('un réglage illisible ferme le site de dev au lieu de l’ouvrir : aucune connexion possible, les routes ouvertes répondent encore', () => {
  const fichier = fichierTemporaire('acces.json', 'acces');
  writeFileSync(fichier, '{ pas du json');
  const { acces, journal } = controle(fichier);
  assert.equal(acces.protege(), true);
  assert.equal(acces.controler({ methode: 'POST', chemin: '/api/edition/', entetes: {} }).statut, 401);
  assert.equal(acces.controler({ methode: 'GET', chemin: '/api/etat/', entetes: {} }), null);
  assert.deepEqual(acces.connecter(MOT, {}), { ok: false, raison: 'ferme' });
  assert.match(journal[0], /réglage invalide/);
  // un fichier au contenu faux mais bien formé : même chose
  writeFileSync(fichier, JSON.stringify({ version: 1, portee: 'tout' }));
  assert.equal(acces.connecter(MOT, {}).raison, 'ferme');
  // la commande de l'hôte le refait : le mot de passe passe
  writeFileSync(fichier, JSON.stringify(reglageApres({ motDePasse: MOT }).reglage));
  assert.equal(acces.connecter(MOT, {}).ok, true);
});

test('la clé de lecture lit mais n’écrit jamais ; le mot de passe (session) fait les deux ; sans rien : 401 qui dit ce qui manque', () => {
  const { fichier, cle } = poser();
  const { acces } = controle(fichier);
  const lecture = { methode: 'GET', chemin: '/api/edition/journal/' };
  const ecriture = { methode: 'POST', chemin: '/api/edition/' };
  const ouverte = { methode: 'GET', chemin: '/api/etat/' };

  assert.deepEqual(acces.controler({ ...lecture, entetes: {} }).corps.acces, 'cle');
  assert.equal(acces.controler({ ...ecriture, entetes: {} }).corps.acces, 'mot_de_passe');
  assert.equal(acces.controler({ ...ouverte, entetes: {} }), null);

  const avecCle = { [ENTETE_CLE]: cle };
  assert.equal(acces.controler({ ...lecture, entetes: avecCle }), null);
  assert.equal(acces.controler({ ...ouverte, entetes: avecCle }), null);
  const refus = acces.controler({ ...ecriture, entetes: avecCle });
  assert.equal(refus.statut, 401);
  assert.equal(refus.corps.acces, 'mot_de_passe', 'la clé de lecture ne permet pas d’écrire');
  assert.equal(acces.controler({ methode: 'PATCH', chemin: '/api/v1/metiers/x/', entetes: avecCle }).statut, 401);
  assert.equal(acces.controler({ methode: 'POST', chemin: '/api/mise-a-jour/lancer/', entetes: avecCle }).statut, 401);
  assert.equal(acces.controler({ methode: 'GET', chemin: '/api/v1/metiers/', entetes: avecCle }), null);

  // le second nom de l'en-tête (X-Maverick-Key) vaut X-Maverick-Cle : lecture permise, écriture refusée
  assert.deepEqual(ENTETES_CLE, [ENTETE_CLE, 'x-maverick-key']);
  const avecKey = { 'x-maverick-key': cle };
  assert.equal(acces.controler({ ...lecture, entetes: avecKey }), null);
  assert.equal(acces.controler({ methode: 'GET', chemin: '/api/v1/metiers/', entetes: avecKey }), null);
  assert.equal(acces.controler({ ...ecriture, entetes: avecKey }).corps.acces, 'mot_de_passe', 'X-Maverick-Key ne permet pas d’écrire');
  assert.equal(acces.controler({ ...lecture, entetes: { 'x-maverick-key': `${cle}x` } }).statut, 401);
  assert.equal(acces.controler({ ...lecture, entetes: { 'x-maverick-key': '' } }).statut, 401, 'une clé vide n’ouvre rien');
  assert.equal(acces.controler({ ...lecture, entetes: { [ENTETE_CLE]: 'mvk_faux', 'x-maverick-key': cle } }), null, 'la bonne clé sous l’un des deux noms suffit');

  // une clé fausse, ou la clé dans un autre en-tête (ou l'adresse) n'ouvre rien
  assert.equal(acces.controler({ ...lecture, entetes: { [ENTETE_CLE]: `${cle}x` } }).statut, 401);
  for (const nom of ['x-maverick-token', 'x-api-key', 'x-maverick-cle-key', 'maverick-key']) {
    assert.equal(acces.controler({ ...lecture, entetes: { [nom]: cle } }).statut, 401, `l’en-tête ${nom} n’ouvre rien`);
  }
  assert.equal(acces.controler({ ...lecture, entetes: { authorization: `Bearer ${cle}` } }).statut, 401);
  assert.equal(acces.controler({ methode: 'GET', chemin: `/api/edition/journal/?cle=${cle}`, entetes: {} }).statut, 401);

  const session = acces.connecter(MOT, {});
  assert.equal(session.ok, true);
  const entetes = cookieDe(session.jeton);
  assert.equal(acces.controler({ ...lecture, entetes }), null, 'le mot de passe vaut aussi pour la lecture');
  assert.equal(acces.controler({ ...ecriture, entetes }), null);
  assert.equal(acces.droit(entetes).droit, 'ecriture');
  assert.equal(acces.droit(avecCle).droit, 'lecture');
  assert.equal(acces.droit({}).droit, 'aucun');
});

test('une route inconnue demande le mot de passe (fermée par défaut), jamais la clé de lecture', () => {
  const { fichier, cle } = poser();
  const { acces } = controle(fichier);
  for (const [m, c] of [['GET', '/api/nouvelle-route/'], ['POST', '/api/etat/'], ['PUT', '/api/etat/'], ['GET', '/api/debug/inconnue/']]) {
    const r = acces.controler({ methode: m, chemin: c, entetes: { [ENTETE_CLE]: cle } });
    assert.equal(r.statut, 401, `${m} ${c}`);
    assert.equal(r.corps.acces, 'mot_de_passe', `${m} ${c}`);
  }
});

test('la session : cookie signé qui expire (12 h), falsifié ou d’un autre réglage refusé ; changer le mot de passe fait tomber les sessions ouvertes', () => {
  const { fichier } = poser();
  const { acces, avancer } = controle(fichier);
  const { jeton, expire_s: exp } = acces.connecter(MOT, {});
  assert.equal(exp, 1_800_000_000 + DUREE_SESSION_S);
  const ecriture = { methode: 'POST', chemin: '/api/edition/', entetes: cookieDe(jeton) };
  assert.equal(acces.controler(ecriture), null);
  avancer(DUREE_SESSION_S - 1);
  assert.equal(acces.controler(ecriture), null, 'encore valable une seconde avant');
  avancer(2);
  assert.equal(acces.controler(ecriture).statut, 401, 'expiré');
  avancer(-DUREE_SESSION_S);

  // falsifié : l'expiration reculée, la signature changée, un autre secret, un jeton illisible
  const [v, e, s] = jeton.split('.');
  for (const faux of [`${v}.${Number(e) + 86400}.${s}`, `${v}.${e}.${s.replace(/./, (c) => (c === '0' ? '1' : '0'))}`, creerJeton('00'.repeat(32), Number(e)), 'v1.x.y', '', jeton.slice(0, -1)]) {
    assert.equal(acces.controler({ ...ecriture, entetes: cookieDe(faux) }).statut, 401, faux);
  }
  // le jeton n'est pas lisible sans le secret du réglage, et le secret n'y est pas
  assert.equal(lireJeton('11'.repeat(32), jeton, 1_800_000_000), null);

  // un cookie du bon nom au milieu d'autres, ou doublé (deux chemins) : le valide compte
  assert.equal(acces.controler({ ...ecriture, entetes: { cookie: `autre=1; ${COOKIE}=n-importe-quoi; ${COOKIE}=${jeton}; z=2` } }), null);
  assert.deepEqual(valeursDuCookie(`a=1; ${COOKIE}=x; ${COOKIE}=y`), ['x', 'y']);

  // le mot de passe change (la commande de l'hôte réécrit le fichier) : la session ouverte tombe, sans redémarrage
  writeFileSync(fichier, JSON.stringify(reglageApres({ ancien: JSON.parse(readFileSync(fichier, 'utf8')), motDePasse: AUTRE }).reglage));
  assert.equal(acces.controler(ecriture).statut, 401, 'la session d’avant le changement est fermée');
  assert.equal(acces.connecter(MOT, {}).ok, false, 'l’ancien mot de passe ne passe plus');
  assert.equal(acces.controler({ ...ecriture, entetes: cookieDe(acces.connecter(AUTRE, {}).jeton) }), null);
});

test('limite des essais : 5 mots de passe ratés par source, 429 jusqu’à la fin de la fenêtre (même avec le bon), les autres sources et le succès ne sont pas touchés', () => {
  const { fichier } = poser();
  const { acces, avancer, journal } = controle(fichier);
  const depuis = (ip) => ({ 'x-forwarded-for': `${ip}, 172.18.0.1` });
  for (let i = 0; i < LIMITES.essais; i += 1) assert.equal(acces.connecter('faux faux faux', depuis('203.0.113.7')).raison, 'mot_de_passe');
  const bloque = acces.connecter(MOT, depuis('203.0.113.7'));
  assert.equal(bloque.ok, false, 'le bon mot de passe ne passe pas pendant l’attente');
  assert.equal(bloque.raison, 'limite');
  assert.ok(bloque.attente_s > 0 && bloque.attente_s <= LIMITES.fenetre_s, String(bloque.attente_s));
  assert.equal(acces.connecter(MOT, depuis('198.51.100.2')).ok, true, 'une autre source passe');
  avancer(LIMITES.fenetre_s + 1);
  assert.equal(acces.connecter(MOT, depuis('203.0.113.7')).ok, true, 'la fenêtre est passée');
  // un succès remet le compteur de sa source à zéro
  for (let i = 0; i < LIMITES.essais - 1; i += 1) acces.connecter('faux faux faux', depuis('192.0.2.9'));
  assert.equal(acces.connecter(MOT, depuis('192.0.2.9')).ok, true);
  for (let i = 0; i < LIMITES.essais - 1; i += 1) assert.equal(acces.connecter('faux faux faux', depuis('192.0.2.9')).raison, 'mot_de_passe');
  // jamais l'adresse d'un visiteur au journal
  assert.ok(journal.every((l) => !/\d+\.\d+\.\d+\.\d+/.test(l)), journal.join('\n'));
});

test('limite globale : des sources toujours nouvelles ne contournent pas les essais (60 par fenêtre)', () => {
  const { fichier } = poser();
  const { acces } = controle(fichier);
  for (let i = 0; i < LIMITES.global; i += 1) acces.connecter('faux faux faux', { 'x-forwarded-for': `10.0.${Math.floor(i / 200)}.${i % 200}` });
  assert.equal(acces.connecter(MOT, { 'x-forwarded-for': '10.9.9.9' }).raison, 'limite');
});

test('rien de secret au journal : ni mot de passe (bon ou faux), ni clé, ni jeton, ni empreinte, ni secret de session', () => {
  const { fichier, cle, reglage } = poser();
  const { acces, journal } = controle(fichier);
  const { jeton } = acces.connecter(MOT, {});
  acces.connecter('mauvais mauvais', {});
  for (let i = 0; i < LIMITES.essais; i += 1) acces.connecter('encore faux', { 'x-forwarded-for': '1.2.3.4' });
  acces.connecter(MOT, { 'x-forwarded-for': '1.2.3.4' });
  acces.controler({ methode: 'GET', chemin: '/api/edition/journal/', entetes: { [ENTETE_CLE]: cle } });
  const texte = journal.join('\n');
  assert.ok(journal.length >= 3, texte);
  for (const secret of [MOT, 'mauvais mauvais', 'encore faux', cle, jeton, reglage.secret_de_session, reglage.mot_de_passe.empreinte, reglage.mot_de_passe.sel, reglage.cle_de_lecture.empreinte]) {
    assert.ok(!texte.includes(secret), `« ${secret.slice(0, 12)}… » au journal`);
  }
});

test('le cookie : HttpOnly, SameSite=Strict, Path=/api/ (option b), Secure sauf en local ; portée « tout » : Path=/ et Lax ; fermé sous les deux chemins', () => {
  const [ouvert] = cookiesDeSession('v1.1.aa', { portee: 'ecriture', securise: true });
  assert.equal(ouvert, `${COOKIE}=v1.1.aa; Path=/api/; HttpOnly; SameSite=Strict; Secure`);
  assert.ok(!cookiesDeSession('v1.1.aa', { portee: 'ecriture', securise: false })[0].includes('Secure'));
  assert.equal(cookiesDeSession('v1.1.aa', { portee: 'tout', securise: true })[0], `${COOKIE}=v1.1.aa; Path=/; HttpOnly; SameSite=Lax; Secure`);
  const fermes = cookiesDeSession(null, { portee: 'ecriture', securise: true });
  assert.deepEqual(fermes.map((c) => /Path=([^;]+)/.exec(c)[1]), ['/api/', '/']);
  assert.ok(fermes.every((c) => c.startsWith(`${COOKIE}=;`) && c.includes('Max-Age=0') && c.includes('HttpOnly')));
  // derrière Caddy puis nginx, la requête arrive en http : un hôte public reste « sécurisé » ; en local, sans https, non
  assert.equal(connexionSecurisee({ 'x-forwarded-host': 'dev.exemple.invalid', 'x-forwarded-proto': 'http' }), true);
  assert.equal(connexionSecurisee({ host: 'localhost:8787' }), false);
  assert.equal(connexionSecurisee({ host: '192.168.1.20:8081' }), false);
  assert.equal(connexionSecurisee({ host: '127.0.0.1:8787', 'x-forwarded-proto': 'https' }), true);
});

test('comparaisons à temps constant (empreintes de même longueur) ; une clé de lecture neuve est unique', () => {
  assert.equal(egaux('abc', 'abc'), true);
  assert.equal(egaux('abc', 'abd'), false);
  assert.equal(egaux('abc', 'abcd'), false);
  assert.notEqual(nouvelleCle(), nouvelleCle());
});

test('la commande de l’hôte : le mot de passe vient de l’entrée standard (première ligne), jamais d’un argument ni d’un message ; REGLAGE puis CLE', async () => {
  const dossier = dossierTemporaire('acces-commande');
  const fichier = `${dossier}/acces.json`;
  const lancer = async (argv, entree = '') => {
    const sortie = [];
    const erreurs = [];
    const code = await commandeAcces(argv, { entree: [Buffer.from(entree)], sortie: (l) => sortie.push(l), erreur: (l) => erreurs.push(l), fichier });
    return { code, sortie, erreurs };
  };
  const premier = await lancer(['definir'], `${MOT}\nune deuxième ligne ignorée\n`);
  assert.equal(premier.code, 0);
  const reglage = JSON.parse(premier.sortie[0].replace(/^REGLAGE /, ''));
  assert.match(premier.sortie[1], /^CLE mvk_/);
  assert.equal(reglage.cle_de_lecture.empreinte, sha(premier.sortie[1].slice(4)));
  assert.ok(!premier.sortie.join('\n').includes(MOT));
  writeFileSync(fichier, JSON.stringify(reglage));

  const changement = await lancer(['definir'], `${AUTRE}\r\n`);
  assert.equal(changement.code, 0);
  assert.equal(changement.sortie.length, 1, 'pas de nouvelle clé : celle de la première pose est gardée');
  const r2 = JSON.parse(changement.sortie[0].replace(/^REGLAGE /, ''));
  assert.deepEqual(r2.cle_de_lecture, reglage.cle_de_lecture);
  writeFileSync(fichier, JSON.stringify(r2));
  assert.equal(creerAcces({ fichier }).connecter(AUTRE, {}).ok, true, 'la fin de ligne Windows n’est pas dans le mot de passe');

  const refaite = await lancer(['cle']);
  assert.match(refaite.sortie[1], /^CLE mvk_/);
  const tout = await lancer(['portee', 'tout']);
  assert.equal(JSON.parse(tout.sortie[0].replace(/^REGLAGE /, '')).portee, 'tout');

  // les refus disent pourquoi sans jamais répéter le mot de passe saisi
  const court = await lancer(['definir'], 'court\n');
  assert.equal(court.code, 1);
  assert.match(court.erreurs[0], /trop court/);
  assert.ok(!court.erreurs.join('').includes('court\n'), 'le message ne contient pas la saisie');
  assert.equal((await lancer(['portee', 'partout'])).code, 1);
  assert.equal((await lancer(['nimporte'])).code, 1);
  writeFileSync(fichier, '{ cassé');
  const illisible = await lancer(['cle']);
  assert.equal(illisible.code, 1);
  assert.match(illisible.erreurs[0], /illisible/);
  assert.equal((await lancer(['definir'], `${MOT}\n`)).code, 0, 'poser un mot de passe répare un réglage illisible (pas d’enfermement dehors)');
});

test('R291 : la clé de dépôt est facultative, se pose et se retire sans toucher au reste, ne s’écrit qu’en empreinte, et se garde quand le mot de passe, la clé de lecture ou la portée changent', () => {
  const { reglage: r1, cle } = reglageApres({ motDePasse: MOT });
  assert.equal(r1.cle_de_depot, null, 'pas posée : l’état sûr');
  const { reglage: r2, cleDeDepot, cle: aucune } = reglageApres({ ancien: r1, refaireLaCleDeDepot: true });
  assert.equal(aucune, null, 'la clé de lecture n’est pas refaite');
  assert.match(cleDeDepot, /^mvd_[A-Za-z0-9_-]{43}$/);
  assert.equal(r2.cle_de_depot.empreinte, sha(cleDeDepot));
  assert.deepEqual(r2.cle_de_lecture, r1.cle_de_lecture);
  assert.deepEqual(r2.mot_de_passe, r1.mot_de_passe);
  assert.equal(r2.secret_de_session, r1.secret_de_session, 'les sessions ouvertes restent ouvertes');
  assert.ok(!JSON.stringify(r2).includes(cleDeDepot), 'jamais en clair');
  assert.deepEqual(validerReglage(JSON.parse(JSON.stringify(r2))), r2);
  assert.notEqual(cleDeDepot, cle);
  // la refaire : l'ancienne ne marche plus
  const { reglage: r3, cleDeDepot: neuve } = reglageApres({ ancien: r2, refaireLaCleDeDepot: true });
  assert.notEqual(r3.cle_de_depot.empreinte, r2.cle_de_depot.empreinte);
  assert.equal(r3.cle_de_depot.empreinte, sha(neuve));
  // elle se garde quand le reste change
  assert.deepEqual(reglageApres({ ancien: r3, motDePasse: AUTRE }).reglage.cle_de_depot, r3.cle_de_depot);
  assert.deepEqual(reglageApres({ ancien: r3, refaireLaCle: true }).reglage.cle_de_depot, r3.cle_de_depot);
  assert.deepEqual(reglageApres({ ancien: r3, portee: 'tout' }).reglage.cle_de_depot, r3.cle_de_depot);
  // elle se retire : retour à l'état sûr
  const { reglage: r4, cleDeDepot: rien } = reglageApres({ ancien: r3, retirerLaCleDeDepot: true });
  assert.equal(r4.cle_de_depot, null);
  assert.equal(rien, null);
  assert.deepEqual(r4.cle_de_lecture, r3.cle_de_lecture);
  // refus : sans mot de passe posé, ou deux demandes contraires, ou une empreinte invalide ou identique à celle de la clé de lecture
  assert.throws(() => reglageApres({ refaireLaCleDeDepot: true }), /mot de passe/);
  assert.throws(() => reglageApres({ ancien: r1, refaireLaCleDeDepot: true, retirerLaCleDeDepot: true }), /en même temps/);
  assert.throws(() => validerReglage({ ...r1, cle_de_depot: { empreinte: 'abc' } }), /clé de dépôt invalide/);
  assert.throws(() => validerReglage({ ...r1, cle_de_depot: { empreinte: r1.cle_de_lecture.empreinte } }), /différer/);
});

test('R291 : les clés se distinguent par leur empreinte dans les mêmes en-têtes ; `depot` (droit) vaut la lecture, jamais l’écriture ; sans clé de dépôt posée, la clé de lecture dépose', () => {
  const { reglage: r1, cle } = reglageApres({ motDePasse: MOT });
  const fichier = fichierTemporaire('acces.json', 'acces');
  writeFileSync(fichier, JSON.stringify(r1));
  const { acces } = controle(fichier);
  const deposer = { methode: 'POST', chemin: '/api/edition/lots/' };
  const appliquer = { methode: 'POST', chemin: '/api/edition/lots/00000000-0000-4000-8000-000000000000/appliquer/' };
  const lecture = { methode: 'GET', chemin: '/api/edition/journal/' };
  const avecCle = { [ENTETE_CLE]: cle };

  // état sûr : pas de clé de dépôt posée, la clé de lecture dépose (une proposition), le dépôt n'est jamais direct
  assert.equal(acces.controler({ ...deposer, entetes: avecCle }), null);
  assert.equal(acces.depotDirectPose(), false);
  assert.deepEqual(acces.depot(avecCle), { direct: false, par: null });
  const session = acces.connecter(MOT, {});
  assert.deepEqual(acces.depot(cookieDe(session.jeton)), { direct: false, par: null }, 'le mot de passe lui-même ne fait rien appliquer tant que la clé de dépôt n’est pas posée');

  // la clé de dépôt posée (le service relit le fichier)
  const { reglage: r2, cleDeDepot } = reglageApres({ ancien: r1, refaireLaCleDeDepot: true });
  writeFileSync(fichier, JSON.stringify(r2));
  assert.equal(acces.depotDirectPose(), true);
  const avecDepot = { [ENTETE_CLE]: cleDeDepot };
  const avecKey = { 'x-maverick-key': cleDeDepot };
  assert.equal(acces.droit(avecDepot).droit, 'depot');
  assert.equal(acces.droit(avecKey).droit, 'depot', 'le second nom d’en-tête (formulaire sûr des sessions) la porte aussi');
  assert.equal(acces.droit(avecCle).droit, 'lecture');
  assert.equal(acces.droit({}).droit, 'aucun');
  assert.equal(acces.droit({ [ENTETE_CLE]: `${cleDeDepot}x` }).droit, 'aucun');
  assert.equal(acces.droit({ [ENTETE_CLE]: 'mvk_faux', 'x-maverick-key': cleDeDepot }).droit, 'depot', 'la bonne clé sous l’un des deux noms suffit');
  assert.deepEqual(acces.depot(avecDepot), { direct: true, par: 'cle_de_depot' });
  assert.deepEqual(acces.depot(cookieDe(acces.connecter(MOT, {}).jeton)), { direct: true, par: 'mot_de_passe' });
  assert.deepEqual(acces.depot(avecCle), { direct: false, par: null });
  assert.deepEqual(acces.depot({}), { direct: false, par: null });

  // déposer : la clé de dépôt ou le mot de passe ; la clé de lecture est refusée en 403 (valable, mais elle ne dépose plus), sans clé 401
  assert.equal(acces.controler({ ...deposer, entetes: avecDepot }), null);
  assert.equal(acces.controler({ ...deposer, entetes: avecKey }), null);
  assert.equal(acces.controler({ ...deposer, entetes: cookieDe(session.jeton) }), null);
  const refusLecture = acces.controler({ ...deposer, entetes: avecCle });
  assert.equal(refusLecture.statut, 403);
  assert.equal(refusLecture.corps.acces, 'cle_de_depot');
  assert.match(refusLecture.corps.erreur, /clé de dépôt est nécessaire/);
  const sansRien = acces.controler({ ...deposer, entetes: {} });
  assert.equal(sansRien.statut, 401);
  assert.equal(sansRien.corps.acces, 'cle_de_depot');
  assert.equal(acces.controler({ ...deposer, entetes: { [ENTETE_CLE]: `${cleDeDepot}x` } }).statut, 401);

  // la clé de dépôt lit comme la clé de lecture ; elle n'écrit rien d'autre (appliquer, édition, mise à jour : le mot de passe)
  assert.equal(acces.controler({ ...lecture, entetes: avecDepot }), null);
  assert.equal(acces.controler({ methode: 'GET', chemin: '/api/v1/metiers/', entetes: avecDepot }), null);
  for (const requete of [appliquer, { methode: 'POST', chemin: '/api/edition/' }, { methode: 'POST', chemin: '/api/mise-a-jour/lancer/' }, { methode: 'PATCH', chemin: '/api/v1/metiers/x/' },
    { methode: 'POST', chemin: appliquer.chemin.replace('appliquer', 'annuler') }, { methode: 'POST', chemin: appliquer.chemin.replace('appliquer', 'lignes/1/annuler') },
    { methode: 'GET', chemin: appliquer.chemin.replace('appliquer', 'lignes/1/annulation') }]) {
    const r = acces.controler({ ...requete, entetes: avecDepot });
    assert.equal(r.statut, 401, `${requete.methode} ${requete.chemin}`);
    assert.equal(r.corps.acces, 'mot_de_passe');
  }
  // l'état d'accès et la vérification d'un mandataire reconnaissent la clé (lecture au moins)
  assert.equal(acces.controler({ methode: 'GET', chemin: '/api/acces/verifier/', entetes: avecDepot }), null);

  // retirée : retour à l'état sûr, sans redémarrage
  writeFileSync(fichier, JSON.stringify(reglageApres({ ancien: r2, retirerLaCleDeDepot: true }).reglage));
  assert.equal(acces.depotDirectPose(), false);
  assert.equal(acces.controler({ ...deposer, entetes: avecCle }), null, 'la clé de lecture dépose de nouveau une proposition');
  assert.equal(acces.droit(avecDepot).droit, 'aucun', 'l’ancienne clé de dépôt ne marche plus');
});

test('R291 : la commande de l’hôte pose la clé de dépôt (CLE_DE_DEPOT, une seule fois) et la retire ; le journal du service n’en dit rien', async () => {
  const dossier = dossierTemporaire('acces-commande-depot');
  const fichier = `${dossier}/acces.json`;
  const lancer = async (argv, entree = '') => {
    const sortie = [];
    const erreurs = [];
    const code = await commandeAcces(argv, { entree: [Buffer.from(entree)], sortie: (l) => sortie.push(l), erreur: (l) => erreurs.push(l), fichier });
    return { code, sortie, erreurs };
  };
  // sans mot de passe posé : refusé, rien n'est écrit
  const sans = await lancer(['cle-de-depot']);
  assert.equal(sans.code, 1);
  assert.match(sans.erreurs[0], /mot de passe/);
  const premier = await lancer(['definir'], `${MOT}\n`);
  writeFileSync(fichier, premier.sortie[0].replace(/^REGLAGE /, ''));
  const cleDeLecture = premier.sortie[1].slice(4);

  const pose = await lancer(['cle-de-depot']);
  assert.equal(pose.code, 0);
  assert.equal(pose.sortie.length, 2, 'le réglage, puis la clé de dépôt ; pas de nouvelle clé de lecture');
  assert.match(pose.sortie[1], /^CLE_DE_DEPOT mvd_/);
  const r = JSON.parse(pose.sortie[0].replace(/^REGLAGE /, ''));
  assert.equal(r.cle_de_depot.empreinte, sha(pose.sortie[1].slice('CLE_DE_DEPOT '.length)));
  assert.equal(r.cle_de_lecture.empreinte, sha(cleDeLecture));
  assert.ok(!pose.sortie[0].includes('mvd_'), 'la clé n’est pas dans le réglage');
  writeFileSync(fichier, JSON.stringify(r));
  // les autres commandes la gardent ; le mot de passe aussi
  const changement = await lancer(['definir'], `${AUTRE}\n`);
  assert.deepEqual(JSON.parse(changement.sortie[0].replace(/^REGLAGE /, '')).cle_de_depot, r.cle_de_depot);
  assert.equal(changement.sortie.length, 1);
  const retiree = await lancer(['sans-cle-de-depot']);
  assert.equal(retiree.code, 0);
  assert.equal(JSON.parse(retiree.sortie[0].replace(/^REGLAGE /, '')).cle_de_depot, null);
  assert.equal(retiree.sortie.length, 1);
  // un réglage illisible : refusé (on repart du mot de passe)
  writeFileSync(fichier, '{ cassé');
  assert.equal((await lancer(['cle-de-depot'])).code, 1);

  // rien de secret au journal du service, clé de dépôt comprise
  writeFileSync(fichier, JSON.stringify(r));
  const { acces, journal } = controle(fichier);
  acces.controler({ methode: 'POST', chemin: '/api/edition/lots/', entetes: { [ENTETE_CLE]: pose.sortie[1].slice('CLE_DE_DEPOT '.length) } });
  acces.controler({ methode: 'POST', chemin: '/api/edition/lots/', entetes: { [ENTETE_CLE]: cleDeLecture } });
  const texte = journal.join('\n');
  assert.ok(journal.length >= 1, texte);
  for (const secret of [pose.sortie[1].slice('CLE_DE_DEPOT '.length), cleDeLecture, r.cle_de_depot.empreinte]) assert.ok(!texte.includes(secret));
});
