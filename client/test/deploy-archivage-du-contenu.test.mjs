// Archivage de ce qui sort du dépôt au lot 12 (deploy/archivage-du-contenu/archiver.sh et verifier.sh ; R296 ; docs/chantier-base-de-dev.md, « Le jour J du lot 12 ») :
// exécutés pour de bon avec bash sur un dépôt git jetable et un faux gh. Les scripts sont ÉTEINTS (refus sans --jour-j), lisent un commit (jamais l'arbre de travail),
// n'écrivent jamais dans le dépôt et ne font que des GET. Le test se saute sans bash, sha256sum, tar, git ou node.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const ARCHIVER = join(ICI, '..', '..', 'deploy', 'archivage-du-contenu', 'archiver.sh');
const VERIFIER = join(ICI, '..', '..', 'deploy', 'archivage-du-contenu', 'verifier.sh');
const LISTER = join(ICI, '..', 'scripts', 'lister-ce-qui-sort.mjs');
const outil = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const MANQUE = ['bash', 'sha256sum', 'tar', 'gzip', 'git'].find((c) => !outil(c)) ?? null;
const SANS = MANQUE ? `${MANQUE} indisponible` : false;
const sha = (x) => createHash('sha256').update(x).digest('hex');

const ARBRE = {
  'data/rows/une_table.sql': 'INSERT INTO une_table VALUES (1);\n',
  'data/rows/VERSION': '1\n',
  'data/migrations/0001-structure.sql': 'CREATE TABLE t (id INTEGER PRIMARY KEY) STRICT;\n',
  'data/migrations/0002-donnees.sql': 'UPDATE t SET id = id + 1 WHERE id = 1;\n',
  'data/migrations/0002-donnees.json': '{"textes": []}\n',
  'data/migrations/0003-mixte.sql': 'CREATE TABLE u (id INTEGER PRIMARY KEY) STRICT;\nINSERT INTO u (id) VALUES (3);\n',
  'data/migrations/0003-mixte.json': '{}\n',
  'sources/raw/doc.md': '# un export\n',
  'sources/raw/classeurs/feuille.json': '{"a": 1}\n',
  'sources/sources.json': '{}\n',
  'client/src/lib/code.mjs': 'export const x = 1;\n',
};
const DE_BASE = ['data/rows/une_table.sql', 'data/rows/VERSION', 'data/migrations/0002-donnees.sql', 'data/migrations/0002-donnees.json', 'sources/raw/doc.md', 'sources/raw/classeurs/feuille.json'];
const MIXTES = ['data/migrations/0003-mixte.sql', 'data/migrations/0003-mixte.json'];

const git = (dossier, ...args) => execFileSync('git', ['-C', dossier, '-c', 'user.name=essai', '-c', 'user.email=essai@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
function poser(dossier, fichiers) {
  for (const [chemin, texte] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(dossier, chemin)), { recursive: true });
    writeFileSync(join(dossier, chemin), texte);
  }
}
/** Tout ce que contient un dossier (chemin → sha256), .git compris : sert à prouver qu'une commande n'y a rien écrit. */
function empreinte(dossier, sous = '') {
  const e = {};
  for (const d of readdirSync(join(dossier, sous), { withFileTypes: true })) {
    const chemin = join(sous, d.name);
    if (d.isDirectory()) Object.assign(e, empreinte(dossier, chemin));
    else e[chemin] = sha(readFileSync(join(dossier, chemin)));
  }
  return e;
}

/** Un monde jetable : un dépôt git validé (un commit), une destination vide, et un lanceur des scripts avec TMPDIR dans le monde. */
function monde(t) {
  const racine = dossierTemporaire('archivage', { t });
  const depot = join(racine, 'depot');
  const vers = join(racine, 'vers');
  mkdirSync(depot);
  mkdirSync(vers);
  git(depot, 'init', '-q');
  poser(depot, ARBRE);
  git(depot, 'add', '-A');
  git(depot, 'commit', '-q', '-m', 'essai');
  const commit = git(depot, 'rev-parse', 'HEAD').trim();
  const lancer = (script, args, env = {}) => {
    const r = spawnSync('bash', [script, ...args], {
      encoding: 'utf8', timeout: 120_000,
      env: { PATH: process.env.PATH, HOME: racine, LANG: 'C.UTF-8', ...variablesTemporaires(racine), MAVERICK_ARCHIVAGE_LISTE: LISTER, ...env },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const archiver = (args = [], env) => lancer(ARCHIVER, ['--jour-j', '--depot', depot, '--commit', commit, '--vers', vers, ...args], env);
  const archive = () => join(vers, readdirSync(vers).find((n) => n.startsWith('contenu-')));
  return { racine, depot, vers, commit, lancer, archiver, archive };
}

const lignesDuManifeste = (chemin) => readFileSync(chemin, 'utf8').split('\n---\n')[1].trim().split('\n').map((l) => l.split('\t'));
const entete = (chemin, cle) => readFileSync(chemin, 'utf8').split('\n').find((l) => l.startsWith(`${cle}=`))?.slice(cle.length + 1);

describe('archivage du contenu (lot 12)', { skip: SANS }, () => {
  it('éteint : rien sans --jour-j, et rien n\'est écrit', (t) => {
    const m = monde(t);
    const avant = empreinte(m.racine);
    const r = m.lancer(ARCHIVER, ['--depot', m.depot, '--commit', m.commit, '--vers', m.vers]);
    assert.equal(r.code, 2);
    assert.match(r.out, /--jour-j/);
    assert.deepEqual(empreinte(m.racine), avant, 'ni archive, ni dossier de travail');
    assert.equal(m.lancer(ARCHIVER, []).code, 2);
  });

  it('refuse une destination absente, relative, sans valeur, dans le dépôt, ou déjà archivée', (t) => {
    const m = monde(t);
    const sans = (args) => m.lancer(ARCHIVER, ['--jour-j', ...args]);
    assert.match(sans(['--depot', m.depot, '--commit', m.commit]).out, /--vers/, 'aucune destination par défaut');
    assert.equal(sans(['--depot', m.depot, '--commit', m.commit]).code, 2);
    assert.equal(sans(['--depot', m.depot, '--commit', m.commit, '--vers', 'relatif']).code, 2);
    assert.equal(sans(['--depot', m.depot, '--commit', m.commit, '--vers', join(m.racine, 'absent')]).code, 2);
    const dedans = join(m.depot, 'archives');
    mkdirSync(dedans);
    const avant = empreinte(m.depot);
    const r = sans(['--depot', m.depot, '--commit', m.commit, '--vers', dedans]);
    assert.equal(r.code, 2);
    assert.match(r.out, /dépôt/);
    assert.deepEqual(empreinte(m.depot), avant, 'rien écrit dans le dépôt');
    assert.equal(sans(['--depot', m.depot, '--vers', m.vers]).code, 2, 'un commit est exigé : jamais l\'arbre de travail');
    assert.equal(sans(['--depot', m.depot, '--commit', 'inconnu', '--vers', m.vers]).code, 2);
    assert.equal(m.archiver().code, 0);
    const encore = m.archiver();
    assert.equal(encore.code, 2, 'une archive n\'est jamais réécrite');
    assert.match(encore.out, /existe déjà/);
  });

  it('une archive par catégorie lue dans le commit, un manifeste (chemin, taille, sha256), le commit et la date ; les mixtes seulement sur demande', (t) => {
    const m = monde(t);
    // l'arbre de travail diffère du commit : une modification non validée et un fichier de plus ne sont jamais archivés
    poser(m.depot, { 'data/rows/VERSION': '2\n', 'data/rows/non-valide.sql': 'x\n' });
    const avant = empreinte(m.depot);
    const r = m.archiver();
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /verifier : OK/);
    assert.deepEqual(empreinte(m.depot), avant, 'le dépôt n\'est qu\'une source : rien n\'y est écrit');
    const d = m.archive();
    assert.deepEqual(readdirSync(m.vers).filter((n) => n.startsWith('.')), [], 'aucun dossier de travail laissé');
    assert.deepEqual(readdirSync(d).sort(), [
      'ARCHIVE.txt', 'SHA256SUMS', 'migrations-donnees.manifeste', 'migrations-donnees.tar.gz', 'rows.manifeste', 'rows.tar.gz', 'sources-raw.manifeste', 'sources-raw.tar.gz',
    ]);
    assert.equal(entete(join(d, 'ARCHIVE.txt'), 'commit'), m.commit);
    assert.match(entete(join(d, 'ARCHIVE.txt'), 'date'), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.equal(entete(join(d, 'ARCHIVE.txt'), 'avec_mixtes'), '0');
    const parCategorie = { rows: DE_BASE.filter((c) => c.startsWith('data/rows/')), 'migrations-donnees': DE_BASE.filter((c) => c.startsWith('data/migrations/')), 'sources-raw': DE_BASE.filter((c) => c.startsWith('sources/raw/')) };
    for (const [nom, chemins] of Object.entries(parCategorie)) {
      const manifeste = join(d, `${nom}.manifeste`);
      assert.equal(entete(manifeste, 'commit'), m.commit);
      assert.equal(entete(manifeste, 'fichiers'), String(chemins.length));
      assert.equal(entete(manifeste, 'archive_sha256'), sha(readFileSync(join(d, `${nom}.tar.gz`))));
      assert.deepEqual(lignesDuManifeste(manifeste), [...chemins].sort().map((c) => [sha(ARBRE[c]), String(Buffer.byteLength(ARBRE[c])), c]), `${nom} : sha256 et taille du contenu du COMMIT`);
    }
    assert.equal(sha(ARBRE['data/rows/VERSION']), lignesDuManifeste(join(d, 'rows.manifeste')).find((l) => l[2] === 'data/rows/VERSION')[0], 'la version validée, pas la modification en cours');
    // avec les mixtes : à part, dans leur propre archive
    const m2 = monde(t);
    assert.equal(m2.archiver(['--avec-mixtes']).code, 0);
    const d2 = m2.archive();
    assert.equal(entete(join(d2, 'ARCHIVE.txt'), 'avec_mixtes'), '1');
    assert.deepEqual(lignesDuManifeste(join(d2, 'migrations-mixtes.manifeste')).map((l) => l[2]), [...MIXTES].sort());
    assert.equal(lignesDuManifeste(join(d2, 'migrations-donnees.manifeste')).some((l) => MIXTES.includes(l[2])), false, 'les mixtes ne se mêlent pas aux migrations de données');
  });

  it('l\'outil de liste lit le commit : mêmes catégories que l\'inventaire, mixtes sur demande', (t) => {
    const m = monde(t);
    const liste = (...args) => spawnSync(process.execPath, ['--no-warnings', LISTER, '--racine', m.depot, '--ref', m.commit, ...args], { encoding: 'utf8' }).stdout.trim().split('\n').map((l) => l.split('\t'));
    assert.deepEqual(liste().map((l) => l[1]).sort(), [...DE_BASE].sort());
    assert.deepEqual(liste('--avec-mixtes').map((l) => l[1]).sort(), [...DE_BASE, ...MIXTES].sort());
    for (const [, chemin, octets] of liste('--avec-mixtes')) assert.equal(Number(octets), Buffer.byteLength(ARBRE[chemin]), chemin);
    assert.notEqual(spawnSync(process.execPath, ['--no-warnings', LISTER, '--racine', m.depot, '--ref', 'inconnu'], { encoding: 'utf8' }).status, 0);
  });

  it('--liste : sans node, la liste faite ailleurs ; seuls les trois chemins sont admis, les mixtes se demandent en toutes lettres', (t) => {
    const m = monde(t);
    const faire = (...args) => spawnSync(process.execPath, ['--no-warnings', LISTER, '--racine', m.depot, '--ref', m.commit, ...args], { encoding: 'utf8' }).stdout;
    const fichier = join(m.racine, 'liste.tsv');
    // un faux node en tête du PATH : s'il est appelé, il le note et échoue (avec --liste, le script n'a besoin d'aucun node)
    const bin = join(m.racine, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'node'), `#!/bin/sh\necho appele >> '${join(m.racine, 'node-appele')}'\nexit 1\n`);
    chmodSync(join(bin, 'node'), 0o755);
    const sansOutil = { MAVERICK_ARCHIVAGE_LISTE: '', PATH: `${bin}:${process.env.PATH}` };
    writeFileSync(fichier, faire());
    const r = m.archiver(['--liste', fichier], sansOutil);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(lignesDuManifeste(join(m.archive(), 'rows.manifeste')).map((l) => l[2]), ['data/rows/VERSION', 'data/rows/une_table.sql']);
    assert.equal(existsSync(join(m.racine, 'node-appele')), false, 'node n\'est pas appelé');
    // une ligne hors des trois chemins : refus, rien n'est écrit
    const m2 = monde(t);
    writeFileSync(join(m2.racine, 'liste.tsv'), `${faire()}rows\tclient/src/lib/code.mjs\t20\n`);
    const refus = m2.archiver(['--liste', join(m2.racine, 'liste.tsv')], sansOutil);
    assert.equal(refus.code, 2);
    assert.deepEqual(readdirSync(m2.vers), []);
    // mixtes : la liste et l'option disent la même chose
    const m3 = monde(t);
    writeFileSync(join(m3.racine, 'avec.tsv'), faire('--avec-mixtes'));
    writeFileSync(join(m3.racine, 'sans.tsv'), faire());
    assert.equal(m3.archiver(['--liste', join(m3.racine, 'avec.tsv')], sansOutil).code, 2, 'des mixtes dans la liste sans --avec-mixtes');
    assert.equal(m3.archiver(['--liste', join(m3.racine, 'sans.tsv'), '--avec-mixtes'], sansOutil).code, 2, '--avec-mixtes sans mixtes dans la liste');
    assert.equal(m3.archiver(['--liste', join(m3.racine, 'avec.tsv'), '--avec-mixtes'], sansOutil).code, 0);
  });

  it('une archive du contenu qui échoue est effacée ; la relance est possible, et une archive déjà complète n\'est jamais effacée', (t) => {
    const m = monde(t);
    const bonne = spawnSync(process.execPath, ['--no-warnings', LISTER, '--racine', m.depot, '--ref', m.commit], { encoding: 'utf8' }).stdout;
    const fausse = join(m.racine, 'fausse.tsv');
    writeFileSync(fausse, bonne.replace(/(rows\tdata\/rows\/VERSION\t)\d+/, '$1999'));
    const sansOutil = { MAVERICK_ARCHIVAGE_LISTE: '' };
    const r = m.archiver(['--liste', fausse], sansOutil);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /ne contient pas exactement/);
    assert.deepEqual(readdirSync(m.vers), [], 'ni archive à demi faite ni dossier de travail');
    assert.equal(m.archiver().code, 0, 'la relance passe');
    const complete = m.archive();
    const avant = empreinte(complete);
    assert.equal(m.archiver(['--liste', fausse], sansOutil).code, 2, 'une archive existante est refusée avant toute écriture');
    assert.deepEqual(empreinte(complete), avant, 'l\'archive complète est intacte');
  });

  it('verifier.sh : zéro écart sur une archive saine ; le moindre écart donne un code non nul', (t) => {
    const m = monde(t);
    assert.equal(m.archiver(['--avec-mixtes']).code, 0);
    const d = m.archive();
    assert.equal(m.lancer(VERIFIER, [d]).code, 0);
    assert.equal(m.lancer(VERIFIER, [d, '--commit', m.commit.slice(0, 12)]).code, 0, 'un commit abrégé (7 caractères au moins) est admis');
    const verifie = (args, attendu) => {
      const r = m.lancer(VERIFIER, args);
      assert.notEqual(r.code, 0, `${attendu} : ${r.out}`);
      assert.match(r.out, attendu);
    };
    verifie([d, '--commit', 'a'.repeat(40)], /commit de l'archive/);
    verifie([d, '--commit', m.commit.slice(0, 4)], /trop court/);
    assert.equal(m.lancer(VERIFIER, []).code, 2);
    assert.equal(m.lancer(VERIFIER, [join(m.racine, 'absent')]).code, 2);
    verifie([m.vers], /n'est pas une archive/);

    // copies altérées, une à une
    const copie = (nom) => {
      const cible = join(m.racine, nom);
      execFileSync('cp', ['-r', d, cible]);
      return cible;
    };
    const alteree = copie('archive-octet');
    writeFileSync(join(alteree, 'rows.tar.gz'), Buffer.concat([readFileSync(join(alteree, 'rows.tar.gz')), Buffer.from('x')]));
    verifie([alteree], /rows/);

    const manifeste = copie('archive-manifeste');
    const ligne = readFileSync(join(manifeste, 'rows.manifeste'), 'utf8').replace(sha(ARBRE['data/rows/VERSION']), '0'.repeat(64));
    writeFileSync(join(manifeste, 'rows.manifeste'), ligne);
    verifie([manifeste], /data\/rows\/VERSION|rows\.manifeste/);

    const manquante = copie('archive-sans-manifeste');
    execFileSync('rm', [join(manquante, 'sources-raw.manifeste')]);
    verifie([manquante], /sources-raw/);

    const autreCommit = copie('archive-autre-commit');
    writeFileSync(join(autreCommit, 'ARCHIVE.txt'), readFileSync(join(autreCommit, 'ARCHIVE.txt'), 'utf8').replace(m.commit, 'b'.repeat(40)));
    verifie([autreCommit], /ARCHIVE\.txt|commit/);

    const categorieRetiree = copie('archive-sans-categorie');
    execFileSync('rm', [join(categorieRetiree, 'migrations-donnees.tar.gz'), join(categorieRetiree, 'migrations-donnees.manifeste')]);
    writeFileSync(join(categorieRetiree, 'ARCHIVE.txt'), readFileSync(join(categorieRetiree, 'ARCHIVE.txt'), 'utf8').replace('migrations-donnees ', ''));
    verifie([categorieRetiree], /migrations-donnees/);

    const enTrop = copie('archive-fichier-en-trop');
    writeFileSync(join(enTrop, 'intrus.tar.gz'), 'x');
    verifie([enTrop], /intrus/);
  });

  it('les publications : gh api en GET seulement, un fichier par asset avec son sha256 ; une altération ou un sha256 que GitHub contredit sont refusés', (t) => {
    const m = monde(t);
    const appels = join(m.racine, 'gh-appels.log');
    const octets = { 11: 'installateur un\n', 12: 'installateur deux\n' };
    const bin = join(m.racine, 'bin');
    mkdirSync(bin);
    // un faux gh : répond à la liste des publications, à celle des fichiers (TSV, comme --jq) et au téléchargement d'un fichier ; note chaque appel
    writeFileSync(join(bin, 'gh'), `#!/bin/sh
printf '%s\\n' "$*" >> '${appels}'
D11=\${ESSAI_DIGEST_11:-${sha(octets[11])}}
[ "$1" = api ] || exit 9
case "$*" in
  *assets/11*) printf '%s' '${octets[11]}' ;;
  *assets/12*) printf '%s' '${octets[12]}' ;;
  *'.assets[]'*) printf '1\\tV0.1.0\\t11\\tun.sh\\t${octets[11].length}\\tsha256:%s\\n2\\tV0.2.0\\t12\\tdeux.sh\\t${octets[12].length}\\t\\n' "$D11" ;;
  *'.assets|length'*) printf '1\\tV0.1.0\\ttrue\\tfalse\\t1\\t2026-01-01T00:00:00Z\\n2\\tV0.2.0\\tfalse\\tfalse\\t1\\t2026-01-02T00:00:00Z\\n3\\tV0.3.0\\ttrue\\tfalse\\t0\\t2026-01-03T00:00:00Z\\n' ;;
  *--jq*) exit 8 ;;
  *) printf '[{"id": 1, "tag_name": "V0.1.0", "body": "notes"}]' ;;
esac
`);
    chmodSync(join(bin, 'gh'), 0o755);
    const env = { PATH: `${bin}:${process.env.PATH}` };
    const r = m.lancer(ARCHIVER, ['--jour-j', '--publications-seules', '--vers', m.vers], env);
    assert.equal(r.code, 0, r.out);
    const journal = readFileSync(appels, 'utf8').trim().split('\n');
    assert.ok(journal.length >= 4, 'les deux listes et les deux fichiers');
    for (const a of journal) {
      assert.match(a, /^api /, a);
      assert.doesNotMatch(a, /(^| )(-X|--method|-f|-F|--field|--raw-field|--input)( |=|$)/, `un GET seulement : ${a}`);
    }
    const d = join(m.vers, readdirSync(m.vers).find((n) => n.startsWith('publications-')));
    const lignes = lignesDuManifeste(join(d, 'publications.manifeste'));
    assert.deepEqual(lignes.map((l) => l.slice(0, 3)), [
      [sha(octets[11]), String(octets[11].length), 'V0.1.0/un.sh'], [sha(octets[12]), String(octets[12].length), 'V0.2.0/deux.sh'],
    ]);
    assert.equal(entete(join(d, 'publications.manifeste'), 'publications'), '3', 'une publication sans fichier compte aussi');
    assert.equal(readFileSync(join(d, 'V0.1.0', 'un.sh'), 'utf8'), octets[11]);
    assert.equal(JSON.parse(readFileSync(join(d, 'releases.json'), 'utf8'))[0].body, 'notes', 'la réponse complète de l\'API est gardée (titres, descriptions)');
    assert.equal(m.lancer(VERIFIER, [d]).code, 0);
    // altérations
    writeFileSync(join(d, 'V0.2.0', 'deux.sh'), 'autre chose\n');
    assert.notEqual(m.lancer(VERIFIER, [d]).code, 0, 'un fichier modifié');
    writeFileSync(join(d, 'V0.2.0', 'deux.sh'), octets[12]);
    writeFileSync(join(d, 'releases.json'), '[]');
    assert.notEqual(m.lancer(VERIFIER, [d]).code, 0, 'la description des publications altérée');
    writeFileSync(join(d, 'releases.json'), '[{"id": 1, "tag_name": "V0.1.0", "body": "notes"}]');
    assert.equal(m.lancer(VERIFIER, [d]).code, 0);
    writeFileSync(join(d, 'V0.3.0-intrus'), 'x');
    assert.notEqual(m.lancer(VERIFIER, [d]).code, 0, 'un fichier hors manifeste');
    // GitHub contredit le fichier reçu : rien n'est gardé comme bon
    const m2 = monde(t);
    const r2 = m2.lancer(ARCHIVER, ['--jour-j', '--publications-seules', '--vers', m2.vers], { ...env, ESSAI_DIGEST_11: '0'.repeat(64) });
    assert.notEqual(r2.code, 0);
    assert.match(r2.out, /sha256 différent/);
    assert.deepEqual(readdirSync(m2.vers), [], 'l\'archive à demi faite est effacée : rien ne reste, la relance n\'est pas refusée');
  });

  it('la source des scripts : aucun appel réseau ni écriture git autre que gh api en lecture', () => {
    for (const script of [ARCHIVER, VERIFIER]) {
      // le code seul : sans les commentaires ni le texte des messages (le geste que le script dit au propriétaire n'est pas un appel)
      const code = readFileSync(script, 'utf8').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n').replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'[^']*'/g, "''");
      assert.doesNotMatch(code, /\b(curl|wget|scp|rsync|ssh)\b/, script);
      assert.doesNotMatch(code, /git\b[^\n]*\b(push|fetch|pull|clone|commit|add|rm|reset|checkout|clean|gc|remote)\b/, script);
      assert.doesNotMatch(code, /gh\b[^\n]*\b(release (delete|create|upload|edit)|repo|workflow|pr)\b/, script);
      assert.doesNotMatch(code, /\b(DELETE|POST|PUT|PATCH)\b/, script);
    }
    // les appels de gh passent tous par gh_lire, qui refuse ce qui écrirait
    const archiver = readFileSync(ARCHIVER, 'utf8');
    assert.equal((archiver.match(/"\$GH" api/g) ?? []).length, 1, 'un seul appel de gh, dans gh_lire');
    assert.match(archiver, /--jour-j/);
    assert.doesNotMatch(archiver, /VERS=\$\{|--vers\)[^\n]*:-/, 'aucune destination par défaut');
    assert.equal(existsSync(join(dirname(ARCHIVER), 'README.md')), true, 'un README dit comment s\'en servir');
  });
});
