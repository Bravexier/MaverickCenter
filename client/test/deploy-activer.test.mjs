// L'activation d'un kit par la production (lot 11, PR 5a ; deploy/installateur/activer.sh et activation-conteneur.sh ; docs/chantier-base-de-dev.md §9, garde-fous 16, 17, 19, 20 ; docs/serveur.md,
// « Bascule 2 : préparation », « PR 5a »). Le vrai script, lancé avec bash dans un monde factice (une production, son kit, un VRAI paquet de mise à jour, un faux docker qui exécute en local) :
// ÉTEINT par défaut (rien ne change sans le fichier activation-par-paquet), refus avant toute bascule (rien n'a changé : sha256 de la base et arbre de site/), réussite (pages, service, gel
// levé, rapport lu par le site de dev), RETOUR AUTOMATIQUE (site précédent reposé, base remise si elle a changé, gel levé). L'essai de bout en bout, sous setpriv et avec le vrai service,
// est tools/essai-activation/ (docs/serveur.md). Des comptes seulement : les fiches sentinelles ne sortent jamais.
//   node --test test/deploy-activer.test.mjs
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { lireLActivation, RAISONS_DE_L_ACTIVATION } from '../serveur/paquets-de-la-production.mjs';
import { creerLActivation, skipActivation, NOM_DU_PAQUET, LOT, CIBLE, DEV, STRUCTURE } from './aide-activation.mjs';
import { sansMarque } from './aide-repetition-bascule-2.mjs';

const skip = skipActivation;
const sha256 = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const dernier = (sortie) => sortie.trim().split('\n').at(-1);

test('ÉTEINT par défaut : sans activation-par-paquet, le script refuse tout de suite (code 2) et rien ne change ; avec un lien à sa place, aussi', { skip }, (t) => {
  const m = creerLActivation(t, { interrupteur: false });
  const avant = [m.arbre(m.prod + '/site'), m.base()];
  let r = m.lancer();
  assert.equal(r.code, 2, r.out);
  assert.match(dernier(r.out), /== IMPOSSIBLE : l'activation par paquet est éteinte \(.*activation-par-paquet n'existe pas\) : rien n'a changé. Pour l'allumer, le jour J : sudo touch .*activation-par-paquet/);
  assert.equal(m.docker(), '', 'aucun appel à docker');
  assert.equal(existsSync(join(m.activation, 'rapport.json')), false, 'aucun rapport');
  assert.equal(existsSync(join(m.prod, 'db', 'gel.json')), false);
  assert.deepEqual([m.arbre(m.prod + '/site'), m.base()], avant);
  symlinkSync(m.d('docker.log'), join(m.prod, 'activation-par-paquet'));
  r = m.lancer();
  assert.equal(r.code, 2);
  assert.match(dernier(r.out), /activation-par-paquet n'est pas un fichier ordinaire/);
});

test('usage et instance : un argument inconnu (2) ; une instance qui n’est pas la production (2)', { skip }, (t) => {
  const m = creerLActivation(t);
  assert.equal(m.lancer(['--inconnue']).code, 2);
  writeFileSync(join(m.prod, 'VERSION'), 'tag=v9.0\nversion=9.0.0\nmode=test\n');
  const r = m.lancer();
  assert.equal(r.code, 2);
  assert.match(dernier(r.out), /n'est pas la production \(fichier VERSION, mode prod\)/);
});

test('RÉUSSITE : contrôles, pages fabriquées, bascule courte (gel, service arrêté, site précédent gardé, pages puis service posés), santé, gel levé, rapport lu par le site de dev ; aucun nom de fiche', { skip }, (t) => {
  const m = creerLActivation(t);
  const avant = { site: m.arbre(join(m.prod, 'site')), base: m.base() };
  const r = m.lancer();
  assert.equal(r.code, 0, r.out);
  assert.match(dernier(r.out), /== PASSEE : la production est à la V9\.2 \(kit V9\.1\.4\) : 5 pages, \d+ s, gel levé\. Le site précédent est gardé dans .*site\.precedent\//);
  assert.match(r.out, /paquet : 9\.2-5a5a5a5a-0000-4000-8000-000000000001\.db, .* Mo, fichier ordinaire \(non lu par root/);
  assert.match(r.out, /contrôles : PASSÉS .* paquet V9\.2, 0 problème\(s\) du contenu, 2 fiche\(s\) de la production refaites sur la copie/);
  assert.match(r.out, /fabrication : PASSÉE \(5 pages pour 5 servies/);
  assert.match(r.out, /base de la production mise de côté : sha256 [0-9a-f]{12}…/);
  assert.match(r.out, /contrôle de santé : PASSÉ \(version vue V9\.1\.4, version attendue V9\.1\.4, base disponible : true, base à jour : true\)/);
  assert.match(r.out, /gel des écritures : levé/);
  // le site : celui de la fabrication ; l'ancien est gardé tel quel dans site.precedent/ ; _serveur/ est celui du kit
  assert.equal(readFileSync(join(m.prod, 'site', 'index.html'), 'utf8'), `<html>${CIBLE}</html>`);
  assert.equal(existsSync(join(m.prod, 'site', 'ressources', 'vieille-page.html')), false, 'ce que le nouveau site n’a pas est retiré');
  assert.equal(JSON.parse(readFileSync(join(m.prod, 'site', '_serveur', 'version.json'), 'utf8')).version, DEV);
  // garde-fou 20 : le service posé vient du KIT SEUL (livrerServeur dans un conteneur sans paquet ni contenu), jamais de la sortie du conteneur de fabrication
  const posee = readFileSync(join(m.prod, 'site', '_serveur', 'serveur', 'index.mjs'), 'utf8');
  assert.equal(posee, readFileSync(new URL('../serveur/index.mjs', import.meta.url), 'utf8'), 'le service du kit, livré par livrerServeur');
  assert.doesNotMatch(posee, /FALSIFIÉ/);
  assert.match(r.out, /service du kit : fabriqué par le kit seul \(V9\.1\.4, sans paquet ni contenu\)/);
  assert.equal(existsSync(join(m.prod, 'site', '_serveur', 'ancien.mjs')), false);
  assert.equal(m.arbre(join(m.prod, 'site.precedent')), avant.site, 'site.precedent/ est le site d’avant, octet pour octet');
  assert.equal(existsSync(join(m.prod, 'db', 'gel.json')), false, 'le gel est levé');
  assert.equal(existsSync(join(m.activation, 'en-cours')), false);
  assert.equal(m.base(), avant.base, 'la base de la production n’a pas été touchée par le script (c’est le service qui la refait à son redémarrage)');
  // le rapport : validé par le service du site de dev, identique des deux côtés, sans nom de fiche
  const rapport = m.rapport();
  assert.deepEqual([rapport.etat, rapport.version, rapport.depuis, rapport.lot, rapport.mode, rapport.raisons, rapport.pages, rapport.gel_leve], ['passee', CIBLE, '9.0', LOT, 'paquet', [], 5, true]);
  assert.equal(m.rapportPartage().trim(), readFileSync(join(m.activation, 'rapport.json'), 'utf8').trim());
  const lu = lireLActivation(m.paquets);
  assert.deepEqual([lu.etat, lu.version, lu.depuis, lu.raisons, lu.pages, lu.perime], ['passee', CIBLE, '9.0', [], 5, false]);
  // le dernier paquet activé : de quoi rejouer un correctif urgent
  const enregistre = JSON.parse(readFileSync(join(m.activation, 'dernier-paquet.json'), 'utf8'));
  assert.deepEqual([enregistre.version, enregistre.lot, enregistre.empreinte, enregistre.structure], [CIBLE, LOT, m.identite.empreinte, STRUCTURE]);
  sansMarque(r.out, m.marques);
  sansMarque(readFileSync(join(m.activation, 'rapport.json'), 'utf8'), m.marques);
  assert.deepEqual(readdirSync(m.activation).filter((f) => f.startsWith('travail.')), [], 'le dossier de travail est effacé');
});

test('garde-fou 20 : les conteneurs sont sans réseau, sans capacité, en lecture seule, le paquet et le kit en lecture seule, jamais db/ ni secrets/ ni le socket Docker ; le gel précède l’arrêt du service', { skip }, (t) => {
  const m = creerLActivation(t);
  assert.equal(m.lancer().code, 0);
  const log = m.docker().split('\n').filter(Boolean);
  const runs = log.filter((l) => l.startsWith('run '));
  assert.ok(runs.length >= 5, `contrôles, fabrication, sauver, pages, service : ${runs.length}`);
  for (const l of runs) {
    assert.match(l, /--network none/);
    assert.match(l, /--read-only/);
    assert.match(l, /--cap-drop ALL/);
    assert.match(l, /--security-opt no-new-privileges/);
    assert.doesNotMatch(l, /docker\.sock|\/db\b|:\/db|secrets|metriques|maintenance/, 'jamais db/, secrets/, metriques/, maintenance/ ni le socket');
    if (!l.includes('maverick-activation-sauver')) assert.match(l, /-v \S+\/activation\/kit:\/kit:ro/, 'le kit en lecture seule');
  }
  const controles = runs.find((l) => l.includes('controles'));
  const fabrication = runs.find((l) => l.includes('fabrication') && l.includes('SITE_MODE=prod'));
  for (const l of [controles, fabrication]) {
    assert.match(l, /--user 65534:65534/);
    assert.match(l, /-v \S+\/paquets:\/paquets:ro/, 'le paquet (le dossier partagé) en lecture seule');
    assert.match(l, new RegExp(`-e EMPREINTE_ATTENDUE=${m.identite.empreinte}`), 'l’empreinte est celle que le kit annonce');
  }
  assert.match(fabrication, /-e HIDE_EXAMPLES=1/);
  assert.match(fabrication, /-e SITE_TAG=v9\.2/);
  assert.match(fabrication, /--memory \d+k --memory-swap \d+k/, 'mémoire plafonnée sans échange');
  // la pose des pages sous l'utilisateur de pose, avec _serveur/ remonté en lecture seule ; celle du service sous root, sans capacité, sur _serveur/ seulement
  const pages = runs.find((l) => l.includes('pose-pages'));
  assert.match(pages, /--user 65000:65000/);
  assert.match(pages, /-v \S+\/site:\/site -v \S+\/site\/_serveur:\/site\/_serveur:ro/);
  const service = runs.find((l) => l.includes('pose-service'));
  assert.match(service, /--user 0:0/);
  assert.match(service, /-v \S+\/site\/_serveur:\/serveur /);
  assert.doesNotMatch(service, /-v \S+\/site:\/site /, 'le service ne voit que _serveur/');
  assert.match(service, /poser-un-site\.mjs --serveur --source \/nouveau --cible \/serveur/);
  // l'ordre de la bascule : contrôles, fabrication, puis gel, arrêt du service, copie du site précédent, pages, service, relance
  const kitSeul = runs.find((l) => l.includes('serveur-kit'));
  assert.doesNotMatch(kitSeul, /paquets|\/production|SITE_MODE|PAQUET_NOM/, 'le service du kit se fabrique sans paquet ni contenu');
  assert.match(kitSeul, /-v \S+\/serveur-kit:\/serveur-kit /);
  // le gel de la bascule dure 45 min (le pire cas de la bascule est de 2100 s) et est posé quand le service s'arrête
  const gel = JSON.parse(readFileSync(m.d('faux-etat', 'gels'), 'utf8').trim().split('\n')[0]);
  assert.equal((Date.parse(gel.jusqu_a) - Date.parse(gel.pose_le)) / 60000, 45);
  const ordre = ['controles', 'fabrication', 'serveur-kit', 'compose stop serveur', 'sauver', 'pose-pages', 'pose-service', 'compose up -d serveur'].map((x) => log.findIndex((l) => l.includes(x)));
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'les étapes se suivent dans cet ordre');
  assert.ok(ordre.every((i) => i >= 0));
});

test('REFUS `empreinte` (garde-fou 17) : un AUTRE paquet (valide, d’une autre empreinte) sous le nom que le kit annonce ; rien n’a changé (sha256 de la base, arbre de site/, gel, docker de bascule)', { skip }, (t) => {
  const m = creerLActivation(t);
  const depose = join(m.paquets, NOM_DU_PAQUET);
  const autre = new DatabaseSync(depose);
  autre.exec("UPDATE note_version SET texte = coalesce(texte, '') || ' (autre paquet)' WHERE exemple = 0");
  autre.close();
  assert.notEqual(sha256(depose), m.identite.empreinte);
  const avant = { site: m.arbre(join(m.prod, 'site')), base: m.base() };
  const r = m.lancer();
  assert.equal(r.code, 1, r.out);
  assert.match(dernier(r.out), /la production n'a pas changé : son site, sa base et son service sont ceux d'avant/);
  assert.match(r.out, /== REFUSEE : le kit V9\.1\.4 ne s'active pas avec ce paquet \(raisons : empreinte ; le paquet reçu a l'empreinte [0-9a-f]{12}…, le kit annonce [0-9a-f]{12}…\)/);
  assert.deepEqual(m.rapport().raisons, ['empreinte']);
  assert.equal(m.rapport().etat, 'refusee');
  assert.equal(m.arbre(join(m.prod, 'site')), avant.site);
  assert.equal(m.base(), avant.base);
  assert.equal(existsSync(join(m.prod, 'site.precedent')), false);
  assert.equal(existsSync(join(m.prod, 'db', 'gel.json')), false, 'aucun gel posé');
  assert.doesNotMatch(m.docker(), /compose stop|pose-pages|pose-service|sauver/, 'aucun arrêt de service, aucune pose');
  assert.deepEqual(lireLActivation(m.paquets).etat, 'refusee');
  // un fichier qui n'est pas une base SQLite : refusé comme paquet irrégulier, sans planter les contrôles
  writeFileSync(depose, 'ceci n’est pas du SQLite');
  const r2 = m.lancer();
  assert.equal(r2.code, 1, r2.out);
  assert.ok(m.rapport().raisons.includes('paquet_irregulier'), r2.out);
  assert.equal(m.arbre(join(m.prod, 'site')), avant.site);
});

test('REFUS `empreinte` avec un VRAI autre paquet : la phrase dit les deux empreintes (12 caractères), le geste dit quoi refaire', { skip }, (t) => {
  const m = creerLActivation(t);
  // le kit annonce une autre empreinte que celle du paquet déposé
  const kit = JSON.parse(readFileSync(join(m.kit, 'kit.json'), 'utf8'));
  kit.paquet.empreinte = 'b'.repeat(64);
  writeFileSync(join(m.kit, 'kit.json'), `${JSON.stringify(kit, null, 2)}\n`);
  const r = m.lancer();
  assert.equal(r.code, 1, r.out);
  const rapport = m.rapport();
  assert.deepEqual(rapport.raisons, ['empreinte']);
  assert.match(rapport.phrase, new RegExp(`le paquet reçu a l'empreinte ${m.identite.empreinte.slice(0, 12)}…, le kit annonce bbbbbbbbbbbb…`));
  assert.match(rapport.geste, /refaire « Effectuer la mise à jour » sur le site de dev .* sudo bash .*activer\.sh --reprendre/);
  assert.match(r.out, /Activation refusée \(empreinte\) : le paquet reçu a l’empreinte/);
});

test('REFUS : un kit qui n’annonce aucun paquet (`kit_sans_paquet`), une structure autre que celle du paquet (`structure`)', { skip }, (t) => {
  const sans = creerLActivation(t, { paquet: false });
  let r = sans.lancer();
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(sans.rapport().raisons, ['kit_sans_paquet']);
  assert.match(r.out, /paquet : le kit n'en annonce aucun/);
  assert.equal(sans.base(), sans.base());
  const autre = creerLActivation(t, { structureDuKit: STRUCTURE + 1 });
  r = autre.lancer();
  assert.equal(r.code, 1, r.out);
  assert.ok(autre.rapport().raisons.includes('structure'));
  assert.match(autre.rapport().geste, /installer sur le site de dev le kit de la structure du paquet/);
  assert.doesNotMatch(autre.docker(), /compose stop/);
});

test('avec l’interrupteur mais SANS kit posé : refus (2) avant toute lecture, rien n’a changé, le geste dit d’où vient le kit (l’installateur « kit seul » de production) et la commande', { skip }, (t) => {
  const m = creerLActivation(t);
  rmSync(m.kit, { recursive: true, force: true });
  const avant = [m.arbre(join(m.prod, 'site')), m.base()];
  const r = m.lancer();
  assert.equal(r.code, 2, r.out);
  assert.match(dernier(r.out), /== IMPOSSIBLE : pas de kit dans .*activation\/kit \(kit\.json\) : la production le reçoit de l'installateur « kit seul » de production.*bascule-2\.json ; le poser par la dernière livraison : sudo sh .*mise-a-jour\.sh --force/);
  assert.equal(m.docker(), '', 'aucun conteneur lancé');
  assert.equal(existsSync(join(m.prod, 'db', 'gel.json')), false, 'aucun gel');
  assert.equal(existsSync(join(m.activation, 'rapport.json')), false, 'IMPOSSIBLE n’écrit pas de rapport : rien n’a été tenté');
  assert.deepEqual([m.arbre(join(m.prod, 'site')), m.base()], avant);
});

test('REFUS avant toute lecture du paquet : absent, lien, fichier irrégulier, trop gros ; root ne fait que des `stat` (aucun conteneur lancé)', { skip }, (t) => {
  const cas = [
    ['paquet_absent', (m) => rmSync(join(m.paquets, NOM_DU_PAQUET))],
    ['paquet_irregulier', (m) => { rmSync(join(m.paquets, NOM_DU_PAQUET)); symlinkSync(m.d('docker.log'), join(m.paquets, NOM_DU_PAQUET)); }],
    ['paquet_irregulier', (m) => { rmSync(join(m.paquets, NOM_DU_PAQUET)); spawnSync('mkfifo', [join(m.paquets, NOM_DU_PAQUET)]); }],
    ['paquet_irregulier', (m) => { rmSync(join(m.paquets, NOM_DU_PAQUET)); mkdirSync(join(m.paquets, NOM_DU_PAQUET)); }],
    ['paquet_trop_gros', (m) => { rmSync(join(m.paquets, NOM_DU_PAQUET)); writeFileSync(join(m.paquets, NOM_DU_PAQUET), ''); }],
  ];
  for (const [raison, preparer] of cas) {
    const m = creerLActivation(t);
    preparer(m);
    const r = m.lancer();
    assert.equal(r.code, 1, `${raison} : ${r.out}`);
    assert.deepEqual(m.rapport().raisons, [raison], r.out);
    assert.equal(m.docker(), '', 'aucun conteneur : le paquet n’a pas été lu');
  }
  // un fichier géant sans en écrire les octets : un fichier creux, au-delà du plafond de 512 Mo
  const m = creerLActivation(t);
  rmSync(join(m.paquets, NOM_DU_PAQUET));
  spawnSync('truncate', ['-s', '600M', join(m.paquets, NOM_DU_PAQUET)]);
  const r = m.lancer();
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(m.rapport().raisons, ['paquet_trop_gros']);
  assert.match(m.rapport().phrase, /pèse 629145600 octets \(attendu : plus de 0 et au plus 536870912\) : refusé sans être lu/);
  // un dossier partagé qui est un lien : refusé
  const l = creerLActivation(t);
  const reel = l.d('paquets-reels');
  mkdirSync(reel);
  rmSync(l.paquets, { recursive: true });
  symlinkSync(reel, l.paquets);
  assert.deepEqual((l.lancer(), l.rapport().raisons), ['paquet_absent']);
});

test('REFUS `contenu` (garde-fou 18) : le contenu a un problème, nommé par table, identifiant et règle ; rien n’a changé', { skip }, (t) => {
  const m = creerLActivation(t, { changerDev: (db) => db.prepare(`INSERT INTO ecart_source (id, entite_table, entite_id, champ, nature, source_a, detail, origine, source_ref)
    VALUES ('metier:zz-absent:nom:valeur_absente:fiche', 'metier', 'zz-absent', 'nom', 'valeur_absente', 'fiche', 'essai', (SELECT id FROM famille ORDER BY id LIMIT 1), 'essai')`).run() });
  const avant = m.base();
  const r = m.lancer();
  assert.equal(r.code, 1, r.out);
  assert.ok(m.rapport().raisons.includes('contenu'));
  assert.match(r.out, /problème du contenu : ecart_source metier:zz-absent \(règle entite_adressee\)/);
  assert.match(m.rapport().geste, /corriger sur le site de dev la ligne nommée ci-dessus/);
  assert.equal(m.base(), avant);
  assert.doesNotMatch(m.docker(), /compose stop/);
});

test('REFUS mémoire et disque : les chiffres de l’atelier et le geste ; rien n’a changé', { skip }, (t) => {
  const peu = creerLActivation(t, { memoire: [2_000_000, 1_000_000] });
  let r = peu.lancer();
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(peu.rapport().raisons, ['memoire']);
  assert.match(peu.rapport().phrase, /la fabrication des pages serait refusée \(memoire_insuffisante\) : \d+ Mo disponibles sur \d+ Mo, plafond possible \d+ Mo pour un besoin de \d+ Mo/);
  assert.match(peu.rapport().geste, /libérer de la mémoire \(il faut au moins \d+ Mo disponibles\)/);
  assert.equal(peu.docker(), '');
  const plein = creerLActivation(t);
  writeFileSync(join(plein.activation, 'reglages.env'), 'DISQUE_MIN_KO=999999999999\n');
  r = plein.lancer();
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(plein.rapport().raisons, ['disque']);
  assert.match(plein.rapport().phrase, /place insuffisante sous .*activation : \d+ Mo libres, \d+ Mo nécessaires \(2 fois le kit/);
});

test('REFUS verrou : une autre activation en cours (le verrou est pris) ; le verrou de l’atelier du site de dev aussi', { skip: skip || (spawnSync('flock', ['--version'], { stdio: 'ignore' }).status !== 0 && 'flock indisponible') }, (t) => {
  const m = creerLActivation(t);
  const tenu = spawnSync('bash', ['-c', `exec 9>"${join(m.activation, '.verrou')}"; flock -n 9; (cd "${m.prod}" && MAVERICK_DIR_NORMAL="${m.prod}" MAVERICK_ESSAI=1 MAVERICK_SAUV_DOCKER=${m.d('bin', 'docker')} PATH="${m.d('bin')}:$PATH" bash ./activer.sh) ; true`], { encoding: 'utf8' });
  // le verrou pris par ce même shell (fd 9 hérité) : le script le trouve pris
  assert.match(`${tenu.stdout}${tenu.stderr}`, /== REFUSEE : une autre activation est en cours \(le verrou .*\.verrou est pris\)/);
  mkdirSync(join(m.d('maverick-center-test'), 'atelier'), { recursive: true });
  const atelier = spawnSync('bash', ['-c', `exec 8>"${m.d('maverick-center-test', 'atelier', '.verrou')}"; flock -n 8; MAVERICK_DIR_NORMAL="${m.prod}" MAVERICK_DIR_TEST="${m.d('maverick-center-test')}" MAVERICK_ESSAI=1 MAVERICK_SAUV_DOCKER=${m.d('bin', 'docker')} PATH="${m.d('bin')}:$PATH" bash "${m.prod}/activer.sh"; true`], { encoding: 'utf8' });
  assert.match(`${atelier.stdout}${atelier.stderr}`, /== REFUSEE : une fabrication de l'atelier du site de dev est en cours/);
});

test('RETOUR AUTOMATIQUE (contrôle de santé raté) : le site précédent est reposé octet pour octet, le gel est levé, la production garde sa base ; le rapport le dit', { skip }, (t) => {
  const m = creerLActivation(t);
  const avant = { site: m.arbre(join(m.prod, 'site')), base: m.base() };
  const r = m.lancer([], { FAUX_SANTE: 'muet' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /RETOUR AUTOMATIQUE : le contrôle de santé a échoué en 2 s \(aucune réponse du service\)/);
  assert.match(r.out, /pages : le site précédent est reposé/);
  assert.match(r.out, /service : le code précédent est reposé/);
  assert.match(r.out, /base de la production : intacte \(sha256 [0-9a-f]{12}…, celle d'avant la bascule\)/);
  assert.match(dernier(r.out), /^activation : == RETOUR AUTOMATIQUE : le contrôle de santé a échoué en 2 s .* Le site précédent est remis, le gel est levé, la production a gardé sa base/);
  assert.equal(m.arbre(join(m.prod, 'site')), avant.site, 'le site de la production est celui d’avant, octet pour octet (pages, ressources, service)');
  assert.equal(m.base(), avant.base, 'la base : mêmes octets (sha256)');
  assert.equal(existsSync(join(m.prod, 'db', 'gel.json')), false, 'gel levé');
  assert.equal(existsSync(join(m.activation, 'en-cours')), false);
  const rapport = m.rapport();
  assert.deepEqual([rapport.etat, rapport.raisons, rapport.gel_leve, rapport.version], ['retour_automatique', ['sante'], true, CIBLE]);
  assert.equal(lireLActivation(m.paquets).etat, 'retour_automatique');
  assert.equal(existsSync(join(m.activation, 'dernier-paquet.json')), false, 'un paquet non activé n’est pas noté comme activé');
  assert.deepEqual(readdirSync(m.activation).filter((f) => f.startsWith('travail.')), []);
});

test('RETOUR AUTOMATIQUE : la base que le nouveau service a refaite est REMISE telle qu’elle était (sha256) ; une version autre que celle du kit refuse aussi', { skip }, (t) => {
  const m = creerLActivation(t);
  const avant = m.base();
  const r = m.lancer([], { FAUX_BASE_REFAITE: '1', FAUX_SANTE: 'muet' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /base de la production : remise telle qu'elle était \(le nouveau service l'avait refaite\), sha256 [0-9a-f]{12}…/);
  assert.equal(m.base(), avant, 'la base d’avant, octet pour octet');
  const autre = creerLActivation(t);
  const r2 = autre.lancer([], { FAUX_SANTE: 'autre' });
  assert.equal(r2.code, 1, r2.out);
  assert.match(r2.out, /le contrôle de santé a échoué en 2 s \(version vue V0\.0\.1, version attendue V9\.1\.4, base disponible : true, base à jour : true\)/);
});

test('RETOUR AUTOMATIQUE : la pose des pages échoue en cours de route (code 86) : site précédent reposé, gel levé ; le service n’a pas été touché', { skip }, (t) => {
  const m = creerLActivation(t);
  const avant = { site: m.arbre(join(m.prod, 'site')), base: m.base() };
  const r = m.lancer([], { FAUX_ISSUE: 'echec_pose' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /RETOUR AUTOMATIQUE : les pages du nouveau site n'ont pas pu être posées/);
  assert.equal(m.arbre(join(m.prod, 'site')), avant.site);
  assert.equal(m.base(), avant.base);
  assert.equal(existsSync(join(m.prod, 'db', 'gel.json')), false);
  assert.equal(m.rapport().etat, 'retour_automatique');
  assert.deepEqual(m.rapport().raisons, ['bascule']);
});

test('REFUS fabrication : un conteneur tué par la mémoire (OOM) refuse avant toute bascule, avec le plafond ; rien n’a changé', { skip }, (t) => {
  const m = creerLActivation(t);
  const avant = { site: m.arbre(join(m.prod, 'site')), base: m.base() };
  const r = m.lancer([], { FAUX_ISSUE: 'oom' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /les pages ne se fabriquent pas : le conteneur a dépassé son plafond de mémoire de \d+ Mo \(OOMKilled\)/);
  assert.deepEqual(m.rapport().raisons, ['fabrication']);
  assert.equal(m.arbre(join(m.prod, 'site')), avant.site);
  assert.doesNotMatch(m.docker(), /compose stop/);
});

test('--reprendre : une activation interrompue PENDANT la bascule (marqueur en-cours) refuse sans lui ; avec lui, le site précédent est remis AVANT de recommencer', { skip }, (t) => {
  const m = creerLActivation(t);
  const avant = m.arbre(join(m.prod, 'site'));
  // une première activation réussie, puis une seconde dont on simule la mort pendant la bascule : site/ à moitié posé, site.precedent/ complet, marqueur en place
  assert.equal(m.lancer().code, 0);
  const fini = m.arbre(join(m.prod, 'site'));
  assert.notEqual(fini, avant);
  const base = m.base();
  writeFileSync(join(m.activation, 'en-cours'), `debut=1\npose_commencee=1\nprecedent_complet=1\nsha_base=${base.padEnd(64, '0')}\n`);
  writeFileSync(join(m.prod, 'site', 'index.html'), '<html>à moitié posé</html>');
  const sansReprendre = m.lancer();
  assert.equal(sansReprendre.code, 2, sansReprendre.out);
  assert.match(dernier(sansReprendre.out), /== IMPOSSIBLE : une activation précédente a été interrompue PENDANT sa bascule .*en-cours existe\) .* sudo bash .*activer\.sh --reprendre/);
  assert.equal(readFileSync(join(m.prod, 'site', 'index.html'), 'utf8'), '<html>à moitié posé</html>', 'rien n’est touché sans --reprendre');
  const r = m.lancer(['--reprendre']);
  assert.match(r.out, /reprise : une activation précédente a été interrompue pendant sa bascule : retour au site précédent avant de recommencer/);
  assert.match(r.out, /pages : le site précédent est reposé/);
  assert.equal(existsSync(join(m.activation, 'en-cours')), false);
});

test('--correctif : sans paquet déjà activé, refus (`correctif_sans_paquet`) ; avec lui, le paquet EN PLACE est recontrôlé avec le nouveau kit et les pages sont refaites ; une autre structure refuse', { skip }, (t) => {
  const m = creerLActivation(t, { paquet: false });
  let r = m.lancer(['--correctif']);
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(m.rapport().raisons, ['correctif_sans_paquet']);
  assert.match(m.rapport().geste, /faire une activation normale avec un paquet/);
  assert.equal(m.rapport().mode, 'correctif');
  // un paquet déjà activé (le script l'a noté) : le kit du correctif n'annonce rien, le paquet en place est recontrôlé
  writeFileSync(join(m.activation, 'dernier-paquet.json'), `${JSON.stringify({ format: 'maverick-dernier-paquet/1', version: CIBLE, lot: LOT, empreinte: m.identite.empreinte, structure: STRUCTURE, kit: DEV })}\n`);
  r = m.lancer(['--correctif']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /correctif urgent : le dernier paquet activé \(V9\.2\) est recontrôlé avec le kit V9\.1\.4/);
  assert.match(dernier(r.out), /== PASSEE : /);
  assert.equal(m.rapport().mode, 'correctif');
  assert.match(m.docker(), /--correctif|CORRECTIF=1/);
  // le paquet en place ne passe plus avec un kit d'une autre structure
  const autre = creerLActivation(t, { paquet: false, structureDuKit: STRUCTURE + 1 });
  writeFileSync(join(autre.activation, 'dernier-paquet.json'), `${JSON.stringify({ format: 'maverick-dernier-paquet/1', version: CIBLE, lot: LOT, empreinte: autre.identite.empreinte, structure: STRUCTURE })}\n`);
  r = autre.lancer(['--correctif']);
  assert.equal(r.code, 1, r.out);
  assert.ok(autre.rapport().raisons.includes('structure'));
  assert.doesNotMatch(autre.docker(), /compose stop/);
});

test('les raisons que le script écrit sont celles qu’il déclare (« # raisons: ») et que le service du site de dev admet (RAISONS_DE_L_ACTIVATION)', () => {
  const script = readFileSync(new URL('../../deploy/installateur/activer.sh', import.meta.url), 'utf8');
  const declarees = new Set([...script.matchAll(/^# raisons: (.+)$/gm)].flatMap((x) => x[1].trim().split(/\s+/)));
  const ecrites = new Set([...script.matchAll(/(?:^|[ \t(;])(?:refuser|echec_de_la_bascule|retour_automatique)[ \t]+([a-z_]+)[ \t]+"/gm)].map((x) => x[1]));
  assert.ok(ecrites.size >= 10, [...ecrites].join(' '));
  for (const r of ecrites) assert.ok(declarees.has(r), `la raison ${r} est écrite sans être déclarée`);
  for (const r of declarees) assert.ok(RAISONS_DE_L_ACTIVATION.includes(r), `la raison ${r} est inconnue du service`);
  for (const attendue of ['paquet_absent', 'paquet_irregulier', 'paquet_trop_gros', 'memoire', 'disque', 'verrou', 'fabrication', 'bascule', 'sante', 'controles', 'correctif_sans_paquet', 'interrompue']) assert.ok(declarees.has(attendue), attendue);
  for (const etat of ['en_cours', 'refusee', 'retour_automatique', 'retour_incomplet', 'passee']) assert.ok(script.includes(`ecrire_le_rapport ${etat}`), etat);
});

test('les règles de mémoire, de disque et de délai sont celles de l’atelier (atelier/lib.sh) : les constantes et le calcul du plafond se rapprochent', () => {
  const lib = readFileSync(new URL('../../deploy/installateur/atelier/lib.sh', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../../deploy/installateur/activer.sh', import.meta.url), 'utf8');
  const valeur = (texte, nom) => new RegExp(`^${nom}=(\\d+)`, 'm').exec(texte)?.[1];
  for (const [nomLib, nomScript] of [['DEFAUT_MEMOIRE_MAX_KO'], ['DEFAUT_BESOIN_KO'], ['DEFAUT_DISQUE_MIN_KO'], ['DEFAUT_DELAI_S'], ['DEFAUT_CPUS'], ['PLAFOND_RESULTAT'], ['PLAFOND_JOURNAL'], ['PLAFOND_EXTRAIT', 'PLAFOND_PAQUET'], ['DELAI_POSE_S']].map(([a, b]) => [a, b ?? a])) {
    if (nomLib === 'DELAI_POSE_S') continue;
    assert.ok(valeur(lib, nomLib), `${nomLib} dans atelier/lib.sh`);
    assert.equal(valeur(script, nomScript), valeur(lib, nomLib), `${nomScript} = ${nomLib}`);
  }
  assert.equal(/^MOTIF_IMAGE='(.+)'$/m.exec(script)[1], /^MOTIF_IMAGE='(.+)'$/m.exec(lib)[1], 'l’image du kit : le même motif');
  assert.equal(/^MEMOIRE_POSE='(.+)'$/m.exec(script)[1], /^MEMOIRE_POSE='(.+)'$/m.exec(lib)[1], 'la pose : la même mémoire');
  const fonction = (texte) => /calculer_le_plafond\(\) \{[^\n]*\n([\s\S]*?)\n\}/.exec(texte)[1];
  assert.equal(fonction(script), fonction(lib), 'calculer_le_plafond : le même calcul');
});

test('garde-fou 20 : le rapport laissé dans paquets/ passe par activation/ (à root) puis un renommage : un lien posé sur activation.json par le service est remplacé, jamais suivi', { skip }, (t) => {
  const m = creerLActivation(t, { paquet: false });
  const cible = m.d('un-fichier-de-l-hote.txt');
  writeFileSync(cible, 'précieux');
  chmodSync(cible, 0o600);
  symlinkSync(cible, join(m.paquets, 'activation.json'));
  const r = m.lancer();
  assert.equal(r.code, 1, r.out);
  assert.equal(readFileSync(cible, 'utf8'), 'précieux', 'le fichier visé par le lien n’est pas écrit');
  assert.equal(statSync(cible).mode & 0o777, 0o600, 'ni ses droits changés');
  assert.equal(statSync(join(m.paquets, 'activation.json')).isFile(), true, 'le lien est remplacé par le rapport');
  assert.equal(lireLActivation(m.paquets).etat, 'refusee');
  assert.deepEqual(readdirSync(m.paquets).filter((f) => f.startsWith('.')), [], 'aucun fichier provisoire dans paquets/ (root n’y écrit que le renommage)');
  assert.deepEqual(readdirSync(m.activation).filter((f) => f.startsWith('.depot')), [], 'ni dans activation/');
  // un dossier partagé qui est un lien : le rapport n'y est pas laissé
  const l = creerLActivation(t, { paquet: false });
  const reel = l.d('paquets-reels');
  mkdirSync(reel);
  rmSync(l.paquets, { recursive: true });
  symlinkSync(reel, l.paquets);
  l.lancer();
  assert.deepEqual(readdirSync(reel), [], 'rien n’est écrit à travers un dossier partagé qui est un lien');
});

test('garde-fou 20 : un site fabriqué qui est un LIEN (ou un service du kit qui l’est) est refusé après le `docker rm`, avant tout montage et toute bascule', { skip }, (t) => {
  const m = creerLActivation(t);
  const avant = { site: m.arbre(join(m.prod, 'site')), base: m.base() };
  const r = m.lancer([], { FAUX_ISSUE: 'lien_site' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /le site fabriqué n'est pas un dossier ordinaire \(lien ou absent\)/);
  assert.deepEqual(m.rapport().raisons, ['fabrication']);
  assert.equal(m.arbre(join(m.prod, 'site')), avant.site);
  assert.equal(m.base(), avant.base);
  assert.doesNotMatch(m.docker(), /compose stop|pose-pages|pose-service|sauver/);
});

test('un SIGNAL pendant la pose : le conteneur en marche est supprimé D’ABORD, puis retour automatique (site précédent reposé, gel levé, base intacte) ; rapport `interrompue`', { skip }, async (t) => {
  const m = creerLActivation(t);
  const avant = { site: m.arbre(join(m.prod, 'site')), base: m.base() };
  const enfant = spawn('bash', [join(m.prod, 'activer.sh')], {
    env: {
      PATH: `${m.d('bin')}:${process.env.PATH}`, MAVERICK_DIR_NORMAL: m.prod, MAVERICK_DIR_TEST: m.d('maverick-center-test'), MAVERICK_SAUV_DOCKER: m.d('bin', 'docker'), MAVERICK_ESSAI: '1',
      MAVERICK_ACTIVATION_UTILISATEUR: '65000:65000', MAVERICK_ACTIVATION_PROC: m.d('proc'), MAVERICK_ACTIVATION_CGROUP: m.d('cgroup'), MAVERICK_DIR_ETC_SYSTEMD: m.d('etc-systemd'),
      MAVERICK_ACTIVATION_INTERVALLE: '0', MAVERICK_ACTIVATION_SANTE: '2', FAUX_JOURNAL: m.d('docker.log'), FAUX_ETAT: m.d('faux-etat'), FAUX_SERVICE: m.d('service.etat'), FAUX_PROD: m.prod,
      FAUX_VERSION_NOUVELLE: DEV, SITE_VERSION_DU_KIT: DEV, FAUX_ISSUE: 'enmarche', HOME: m.r, LANG: 'C.UTF-8',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let sortie = '';
  enfant.stdout.on('data', (d) => { sortie += d; });
  enfant.stderr.on('data', (d) => { sortie += d; });
  const fini = new Promise((ok) => enfant.on('exit', (code) => ok(code)));
  const limite = Date.now() + 120_000;
  while (!m.docker().includes('pose-pages') && Date.now() < limite) await new Promise((ok) => setTimeout(ok, 100));
  assert.ok(m.docker().includes('pose-pages'), `la pose n'a pas commencé : ${sortie}`);
  enfant.kill('SIGTERM');
  const code = await fini;
  assert.equal(code, 1, sortie);
  assert.match(sortie, /interruption pendant la bascule \(code 1\) : retour automatique/);
  const journal = m.docker().split('\n');
  const pose = journal.findIndex((x) => x.includes('pose-pages'));
  // le rm cherché est celui qui suit le lancement de la pose (pas celui, bien avant, du conteneur des contrôles)
  const rm = journal.findIndex((l, i) => i > pose && l.startsWith('rm -f faux-conteneur'));
  const retour = journal.findIndex((l, i) => i > pose && l.includes('pose-retour-pages'));
  assert.ok(pose >= 0 && rm > pose && retour > rm, 'le conteneur interrompu est supprimé avant que le retour ne repose le site');
  assert.equal(existsSync(m.d('faux-etat', 'enmarche')), false, 'le conteneur interrompu ne tourne plus');
  assert.equal(m.arbre(join(m.prod, 'site')), avant.site);
  assert.equal(m.base(), avant.base);
  assert.equal(existsSync(join(m.prod, 'db', 'gel.json')), false);
  assert.equal(existsSync(join(m.activation, 'en-cours')), false);
  assert.deepEqual([m.rapport().etat, m.rapport().raisons], ['retour_automatique', ['interrompue']]);
});
