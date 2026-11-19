// Le script de la répétition complète du jour J de la bascule 2 (lot 11, PR 3a ; docs/serveur.md, « Répétition complète du jour J ») : deploy/installateur/repetition-bascule-2.sh
// (préalable de la version du kit, verrou de l'atelier, dossier de travail, conteneur du code du site de dev, puis les pages de la production dans un conteneur de l'image du kit),
// lancé pour de bon avec bash dans un monde factice (aide-repetition-bascule-2.mjs) : un faux « docker » dont `compose run` exécute le vrai script de l'étape A et dont `run`
// exécute le vrai conteneur.sh de l'atelier, avec un kit factice dont fabriquer-depuis-contenu.mjs est un bouchon (la vraie fabrication est jouée à part, au plus près du réel).
// Des comptes seulement : aucun nom de fiche ne sort. Le shell nécessite bash et flock ; la copie prise à l'instant demande sqlite3 (les autres cas passent par
// --depuis-la-sauvegarde) : sans eux, ces cas sont ignorés.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  creerLInstance, DEV, metierRetire, PRODUCTION_PUBLIEE, sansMarque, sha, skipShell, skipSqlite3, STRUCTURE,
} from './aide-repetition-bascule-2.mjs';

test('repetition-bascule-2.sh : PASSERAIT (code 0) : étape A dans le conteneur du site de dev, étape B dans celui de l’atelier (règles de sûreté, mode prod, étiquette de la production) ; comptes seulement, travail effacé, production intacte', { skip: skipShell }, (t) => {
  const m = creerLInstance(t, { changerCopie: metierRetire });
  const avantProd = sha(m.prodDb);
  const avantDev = sha(m.dev);
  const r = m.lancer();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /repetition-bascule-2 : préalable : site de dev V9\.1\.4 = kit V9\.1\.4 \(structure \d+, image node:22-bookworm-slim\)/);
  assert.match(r.out, /étape A PASSERAIT/);
  // la référence de la note est ce que publie la production de --prod (montée explicitement sur /production), pas celle d'un autre dossier
  assert.match(r.out, new RegExp(`\\(V9\\.2, depuis la V${PRODUCTION_PUBLIEE.split('.').slice(0, 2).join('\\.')}\\)`));
  assert.match(r.out, /contrôle du contenu : \d+ table\(s\) contrôlée\(s\), 0 problème\(s\)/);
  assert.match(r.out, /adaptées \(metier\) : 2 fiche\(s\)/);
  assert.match(r.out, /étape B : les pages de la production \(V9\.2\)/);
  assert.match(r.out, /plafond du conteneur 1[0-9]{3} Mo/, 'le plafond est celui de l’atelier : la moitié du disponible (1 650 000 ko de 3 300 000)');
  assert.match(r.out, /pages fabriquées : 3 page\(s\) HTML, 4 fichier\(s\) ; durée de la fabrication 4 s/);
  assert.match(r.out, /pic de mémoire : 812 Mo \(\d+ % du plafond\) \(docker_stats\) ; pic d'un processus \(mesure interne\) : 1024 Mo/);
  assert.match(r.out, /repetition-bascule-2 : == la bascule PASSERAIT/);
  assert.equal(r.out.trim().split('\n').at(-1).startsWith('repetition-bascule-2 : == la bascule PASSERAIT'), true, 'dernière ligne');
  assert.equal(r.out.includes('@@version-paquet'), false, 'le marqueur du .sh ne s’affiche pas');
  const journal = m.docker();
  assert.ok(journal.includes(` -v ${m.d('prod', 'site')}:/production:ro serveur `), 'le site publié de --prod est monté en lecture seule sur /production');
  assert.match(journal, /^compose run --rm --no-deps -T -v [^ ]*\/dev\/var\/repetition-bascule-2\.[^ :]+:\/repetition -v [^ ]+\/prod\/site:\/production:ro serveur node \/site\/_serveur\/scripts\/repetition-bascule-2\.mjs --source \/db\/vivante\.db --travail \/repetition --production \/production --kit-version 9\.1\.4 --kit-structure \d+ /m);
  const run = journal.split('\n').find((l) => l.startsWith('run -d'));
  assert.ok(run, journal);
  for (const option of ['--network none', '--read-only', '--cap-drop ALL', '--security-opt no-new-privileges', '--user 65534:65534', '--cpus 1', '--memory-swap', '-e SITE_MODE=prod', '-e HIDE_EXAMPLES=1',
    '-e SITE_TAG=v9.2', '-e HOME=/travail/home', '-e TMPDIR=/travail/tmp', '-e MODE_REPETITION=1', '-e CONTENU_FICHIER=/contenu/paquet.db', ':/kit:ro', ':/contenu:ro', ':/conteneur.sh:ro', 'node:22-bookworm-slim sh /conteneur.sh']) {
    assert.ok(run.includes(option), `docker run : ${option}`);
  }
  assert.equal(/-v [^ ]*:\/(db|secrets|maintenance|metriques|var\/run\/docker\.sock)\b/.test(run), false, 'aucun montage de db/, de secrets/ ni du socket Docker');
  assert.match(run, /--memory \d+k --memory-swap \d+k/);
  assert.equal(sha(m.prodDb), avantProd, 'la base de la production n’a pas changé');
  assert.equal(sha(m.dev), avantDev, 'la base du site de dev n’a pas changé');
  assert.deepEqual(m.restes(), [], 'le dossier de travail est effacé');
  sansMarque(r.out, m.marques);
});

test('repetition-bascule-2.sh : l’étape B reçoit le paquet et le kit, ni extrait ni extrait.db : SITE_MODE=prod, HIDE_EXAMPLES=1, SITE_TAG=vX.Y, HOME sous le travail (--garder)', { skip: skipShell }, (t) => {
  const m = creerLInstance(t);
  const r = m.lancer(['--depuis-la-sauvegarde', '--garder']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /dossier de travail gardé : [^ ]+ \(il contient les fiches de la production/);
  assert.match(r.out.trim().split('\n').at(-1), /^repetition-bascule-2 : == la bascule PASSERAIT/, 'le verdict reste la dernière ligne, même avec --garder');
  const [travail] = m.restes();
  assert.match(travail, /^repetition-bascule-2\./);
  const environnement = readFileSync(m.d('dev', 'var', travail, 'resultats', 'environnement.txt'), 'utf8').trim();
  assert.equal(environnement, 'prod 1 v9.2 /travail/home simulation 9.2', 'le contenu du conteneur est le paquet de simulation de la V9.2');
});

test('repetition-bascule-2.sh : REFUSEE à l’étape A (code 1) : les raisons, aucune page fabriquée, aucun conteneur lancé', { skip: skipShell }, (t) => {
  const m = creerLInstance(t, { structureKit: STRUCTURE + 1 });
  const r = m.lancer();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /étape A REFUSEE : 1 refus \(structure\)/);
  assert.match(r.out, /activation : Activation refusée \(structure\)/);
  assert.match(r.out, /repetition-bascule-2 : == REFUSEE : étape A : /);
  assert.equal(/^run -d/m.test(m.docker()), false, 'aucun conteneur de fabrication');
  assert.deepEqual(m.restes(), []);
  sansMarque(r.out, m.marques);
});

test('repetition-bascule-2.sh : REFUSEE faute de mémoire (code 1) : les règles de l’atelier, chiffres et geste exact, aucun conteneur de fabrication', { skip: skipShell }, (t) => {
  const m = creerLInstance(t, { memoire: [4_000_000, 1_800_000] });
  const r = m.lancer();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /== REFUSEE : étape B : les pages ne se fabriqueraient pas, l'atelier les refuserait\. .*la fabrication serait refusée \(memoire_insuffisante\)/);
  assert.match(r.out, /1757 Mo disponibles sur 3906 Mo/);
  assert.match(r.out, /sudo sh [^ ]+\/dev\/atelier\/installer\.sh --besoin <taille>/);
  assert.equal(/^run -d/m.test(m.docker()), false);
});

test('repetition-bascule-2.sh : la fabrication des pages échoue ou est tuée par la mémoire (code 1) : la fin du journal du conteneur est gardée (200 Ko), le travail effacé', { skip: skipShell }, (t) => {
  const m = creerLInstance(t);
  let r = m.lancer(['--depuis-la-sauvegarde'], { FAUX_ISSUE: 'echec' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /journal du conteneur \(les 15 dernières lignes/);
  assert.match(r.out, /Fabrication en échec \(étape astro\) : essai/);
  assert.match(r.out, /== REFUSEE : étape B : la fabrication des pages a échoué \(code 1\)/);
  assert.match(readFileSync(m.d('dev', 'var', 'repetition-bascule-2-journal-du-conteneur.txt'), 'utf8'), /Fabrication en échec \(étape astro\) : essai/);
  assert.deepEqual(m.restes(), ['repetition-bascule-2-journal-du-conteneur.txt']);
  r = m.lancer(['--depuis-la-sauvegarde'], { FAUX_ISSUE: 'oom' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /== REFUSEE : étape B : la fabrication a dépassé le plafond de mémoire de \d+ Mo \(oom : OOMKilled\)/);
  r = m.lancer(['--depuis-la-sauvegarde'], { FAUX_ISSUE: 'docker_refuse' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /== REFUSEE : étape B : Docker refuse de lancer le conteneur \(docker_refuse\)/);
});

test('repetition-bascule-2.sh : préalable de la version (leçon 4) : le kit n’est pas celui du site installé, pas de kit, atelier absent : code 2, les deux versions et le geste', { skip: skipShell }, (t) => {
  let m = creerLInstance(t, { versionKit: '9.1.3' });
  let r = m.lancer();
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /== IMPOSSIBLE : la version installée du site de dev est la V9\.1\.4 \(v9\.1\.4\), le kit de l'atelier est celui de la V9\.1\.3/);
  assert.match(r.out, /attendre l'installation de la dernière livraison \(au plus 5 min\), ou sudo sh [^ ]+\/dev\/mise-a-jour\.sh/);
  assert.equal(m.docker(), '', 'rien n’est lancé');
  m = creerLInstance(t, { kit: false });
  r = m.lancer();
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /pas de kit dans [^ ]+\/atelier\/kit \(kit\.json\)/);
  assert.match(r.out, /installer l'atelier \(sudo sh [^ ]+\/atelier\/installer\.sh\)/);
  m = creerLInstance(t, { atelier: false });
  r = m.lancer();
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /l'atelier du site de dev n'est pas installé .* : sudo sh [^ ]+\/atelier\/installer\.sh/);
  assert.deepEqual(m.restes(), [], 'aucun dossier de travail pour un refus de préalable');
});

test('repetition-bascule-2.sh : une fabrication de l’atelier en cours (son verrou est pris) : refus (code 2) avec le geste ; usage (dev pris pour la production, option inconnue)', { skip: skipShell }, async (t) => {
  const m = creerLInstance(t);
  const fichier = m.d('dev', 'atelier', '.verrou');
  const verrou = spawn('flock', [fichier, 'sleep', '30'], { stdio: 'ignore', detached: true });
  try {
    // le verrou est pris pour de bon quand une sonde `flock -n` échoue
    for (let i = 0; i < 100 && spawnSync('flock', ['-n', fichier, 'true']).status === 0; i += 1) await new Promise((ok) => setTimeout(ok, 50));
    assert.notEqual(spawnSync('flock', ['-n', fichier, 'true']).status, 0, 'le verrou est tenu');
    const r = m.lancer();
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /== IMPOSSIBLE : une fabrication de l'atelier est en cours \(le verrou [^ ]+\/\.verrou est pris\) : attendre sa fin .* sudo sh [^ ]+\/installer\.sh --etat/);
  } finally {
    process.kill(-verrou.pid, 'SIGKILL');
  }
  writeFileSync(m.d('dev', 'VERSION'), 'tag=v9.0\nversion=9.0.0\nmode=prod\n');
  assert.match(m.lancer().out, /n'est pas le site de dev/);
  assert.equal(m.lancer(['--inconnue']).code, 2);
});

test('repetition-bascule-2.sh : la copie prise à l’instant (sqlite3 .backup, lecture seule) donne le même verdict', { skip: skipSqlite3 }, (t) => {
  const m = creerLInstance(t);
  const avant = sha(m.prodDb);
  const r = m.lancer([]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /base de la production : copie prise à l'instant/);
  assert.equal(sha(m.prodDb), avant);
});

test('repetition-bascule-2.sh : un outil qui n’est pas à root (sauvegarde/lib.sh, outils de l’atelier) n’est ni sourcé ni lu : refus (code 2), avant toute copie', { skip: skipShell }, (t) => {
  const m = creerLInstance(t);
  const autre = String(process.getuid() + 1);
  const r = m.lancer(['--depuis-la-sauvegarde'], { MAVERICK_REPETITION_PROPRIETAIRE: autre });
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /== IMPOSSIBLE : [^ ]+\/sauvegarde(\/lib\.sh)? n'appartient pas à root : refus/);
  assert.equal(m.docker(), '', 'rien n’est lancé');
  assert.deepEqual(m.restes(), [], 'aucune copie ni dossier de travail');
  // le propriétaire attendu est le bon : le contrôle passe pour la sauvegarde, et refuse les outils de l'atelier posés par un autre
  const bon = m.lancer(['--depuis-la-sauvegarde'], { MAVERICK_REPETITION_PROPRIETAIRE: String(process.getuid()) });
  assert.equal(bon.code, 0, bon.out);
});
