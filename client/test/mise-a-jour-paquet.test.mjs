// Le chemin « paquet » du workflow de mise à jour (lot 8 ; docs/serveur.md, « Mise à jour depuis la base source (lot 8) ») : scripts/mise-a-jour-paquet.mjs
// recontrôle un paquet de la base source (serveur/paquet.mjs) et en tire une copie de data/rows — seuls les fichiers changés, une table changée sans trace
// nouvelle refusée, ni ligne propre au site, ni HTML brut ajouté, ni autre structure, ni autre version — ; puis scripts/mise-a-jour-github.mjs le prend
// en charge sur un petit dépôt git (preparer, puis livrer à blanc) : liste blanche des tables de contenu du paquet, mode du paquet et entrées du workflow
// (simulation, copie) d'accord, la copie vers le dépôt jamais livrée vers master et sans « Lot : » (elle ne bloque pas les mises à jour).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerPaquet, ErreurPaquet } from '../scripts/mise-a-jour-paquet.mjs';
import {
  ARTEFACT, ARTEFACT_PAQUET, enveloppeGit, estUnPaquet, FORMAT_PAQUET as FORMAT_DU_SCRIPT, fusionDansDev, gitLocal, livraisonVersMaster, lotsEnAttente,
  MODES_DU_PAQUET as MODES_DU_SCRIPT, preparer, verifierCommit, verifierContrePaquet, verifierCopie, ENTETE_SQLITE as ENTETE_DU_SCRIPT,
} from '../scripts/mise-a-jour-github.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ENTETE_SQLITE, fabriquerPaquet, FORMAT_PAQUET, MODES_DU_PAQUET } from '../serveur/paquet.mjs';
import { baseDeDepart, copieDesRowsDeDepart } from './aide-base-de-depart.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { versionLibre } from './aide-mise-a-jour.mjs';

const racine = dossierTemporaire('mise-a-jour-paquet');
const RACINE = fileURLToPath(new URL('../../', import.meta.url));
// Ce fichier éprouve ce qui s'écrit dans data/rows : la base de départ et les lignes copiées sont celles du même départ (aide-base-de-depart.mjs : data/rows
// sans MAVERICK_CONTENU, sinon l'export du contenu fourni, VERSION compris), de sorte que les listes de fichiers changés sont celles du lot
const regles = baseDeDepart(join(racine, 'regles.db'), { deriver: true });
const { chemin } = preparerBaseVivante({ regles, dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
after(() => db.close());

// une modification en attente dans la base source : le bonus d'un métier (le contenu changé, le journal qui le dit)
const LOT_DU_SITE = '21111111-2222-4333-8444-555555555555';
const metier = db.prepare('SELECT id, bonus_brut FROM metier ORDER BY id LIMIT 1').get();
const nouveauBonus = `${metier.bonus_brut} (zqx)`;
db.prepare('UPDATE metier SET bonus_brut = ? WHERE id = ?').run(nouveauBonus, metier.id);
db.prepare("INSERT INTO modification_lot (id, fait_le, page_id, resume, nature) VALUES (?, '2026-11-14T10:00:00Z', ?, 'Métier : bonus', 'saisie')").run(LOT_DU_SITE, metier.id);
db.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, 1, 'metier', ?, 'modifier', ?, ?, 'en_attente')")
  .run(LOT_DU_SITE, JSON.stringify({ id: metier.id }), JSON.stringify({ bonus_brut: metier.bonus_brut }), JSON.stringify({ bonus_brut: nouveauBonus }));

const CIBLE = versionLibre(db);
const LOT = '3f8fad5b-d9cb-469f-a165-70867728950e';
const COPIE = '4f8fad5b-d9cb-469f-a165-70867728950e';
const paquets = dossierTemporaire('paquets', { dans: racine });
const PAQUET = join(paquets, 'mise-a-jour.db');
fabriquerPaquet({ source: chemin, destination: PAQUET, production: regles, id: LOT, mode: 'mise-a-jour', version: CIBLE, depuis: null, date: '2026-11-15', texte: 'Texte' });
const PAQUET_COPIE = join(paquets, 'copie.db');
fabriquerPaquet({ source: chemin, destination: PAQUET_COPIE, id: COPIE, mode: 'copie' });

/** Une copie des lignes de départ (data/rows ou l'export du contenu fourni) ; `lire()` : ses fichiers (pour vérifier que rien n'a changé). */
const copieDesLignes = () => {
  const rows = join(dossierTemporaire('rows', { dans: racine }), 'rows');
  copieDesRowsDeDepart(rows);
  return { rows, lire: () => Object.fromEntries(readdirSync(rows).map((f) => [f, readFileSync(join(rows, f), 'utf8')])) };
};
/** Une copie du paquet que `changer(db)` modifie (un paquet falsifié, comme un site de dev compromis le ferait). */
const paquetChange = (source, changer) => {
  const f = join(dossierTemporaire('falsifie', { dans: racine }), 'paquet.db');
  copyFileSync(source, f);
  const p = new DatabaseSync(f);
  try {
    p.exec('PRAGMA foreign_keys = OFF');
    changer(p);
  } finally {
    p.close();
  }
  return f;
};
const refuse = (code, fn) => assert.throws(fn, (e) => e instanceof ErreurPaquet && e.code === code, `code ${code} attendu`);

test('les constantes que le workflow recopie (il n\'importe que node:) sont celles du service', () => {
  assert.deepEqual([FORMAT_DU_SCRIPT, MODES_DU_SCRIPT, ENTETE_DU_SCRIPT], [FORMAT_PAQUET, MODES_DU_PAQUET, ENTETE_SQLITE]);
  assert.equal(estUnPaquet(readFileSync(PAQUET)), true);
  assert.equal(estUnPaquet(Buffer.from('{"format":"maverick-mise-a-jour/1"}')), false);
});

test('mise à jour : data/rows tiré du paquet, seuls les fichiers changés (contenu tracé et note de version), la note en Markdown', () => {
  const { rows, lire } = copieDesLignes();
  const avant = lire();
  const r = appliquerPaquet(PAQUET, { lot: LOT, mode: 'mise-a-jour', rows, version: CIBLE });
  assert.deepEqual(r.fichiers, ['historique_modification.sql', 'metier.sql', 'note_version.sql', 'note_version_ligne.sql']);
  assert.deepEqual([r.version, r.traces, r.tables.includes('metier')], [CIBLE, 1, true]);
  assert.match(r.markdown, new RegExp(`^## Version ${CIBLE.replace('.', '\\.')}`));
  const apres = lire();
  for (const f of Object.keys(avant)) assert.equal(apres[f] === avant[f], !r.fichiers.includes(f), f);
  assert.ok(apres['metier.sql'].includes('(zqx)'));
  assert.ok(apres['historique_modification.sql'].includes(LOT_DU_SITE));
  // la version de la note doit être celle que donnent dev et master
  refuse(6, () => appliquerPaquet(PAQUET, { lot: LOT, mode: 'mise-a-jour', rows: copieDesLignes().rows, version: '99.9' }));
});

test('copie vers le dépôt : sans note, l\'historique sans version ; elle ne se fait passer ni pour une mise à jour ni pour un autre lot', () => {
  const { rows, lire } = copieDesLignes();
  const r = appliquerPaquet(PAQUET_COPIE, { lot: COPIE, mode: 'copie', rows });
  assert.deepEqual([r.version, r.markdown, r.lignes], [null, '', 0]);
  assert.deepEqual(r.fichiers, ['historique_modification.sql', 'metier.sql']);
  assert.ok(lire()['metier.sql'].includes('(zqx)'));
  const vierge = copieDesLignes();
  const avant = vierge.lire();
  refuse(2, () => appliquerPaquet(PAQUET_COPIE, { lot: COPIE, mode: 'mise-a-jour', rows: vierge.rows }));
  refuse(2, () => appliquerPaquet(PAQUET, { lot: LOT, mode: 'copie', rows: vierge.rows }));
  refuse(2, () => appliquerPaquet(PAQUET_COPIE, { lot: LOT, mode: 'copie', rows: vierge.rows }));
  assert.deepEqual(vierge.lire(), avant, 'rien n\'est écrit');
});

test('recontrôles : lignes propres au site, HTML brut ajouté, table changée sans trace, autre structure — refusés, data/rows intact', () => {
  const { rows, lire } = copieDesLignes();
  const avant = lire();
  // une fiche (garde-fou 9)
  refuse(2, () => appliquerPaquet(paquetChange(PAQUET_COPIE, (p) => p.exec("INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES ('zqx', 'Zqx', '2026-11-15T00:00:00Z')")),
    { lot: COPIE, mode: 'copie', rows }));
  // du HTML brut ajouté au corps d'une page (tracé ou non : refusé d'abord)
  const page = db.prepare("SELECT id FROM page WHERE corps_md IS NOT NULL ORDER BY id LIMIT 1").get().id;
  refuse(3, () => appliquerPaquet(paquetChange(PAQUET_COPIE, (p) => p.prepare("UPDATE page SET corps_md = corps_md || '\n\n<script>alert(1)</script>' WHERE id = ?").run(page)),
    { lot: COPIE, mode: 'copie', rows }));
  // une table de contenu changée sans trace nouvelle dans l'historique
  const race = db.prepare('SELECT id FROM race ORDER BY id LIMIT 1').get().id;
  const sansTrace = paquetChange(PAQUET_COPIE, (p) => p.prepare("UPDATE race SET nom = nom || ' zqx' WHERE id = ?").run(race));
  assert.throws(() => appliquerPaquet(sansTrace, { lot: COPIE, mode: 'copie', rows }), (e) => e.code === 4 && e.details.sansTrace.includes('race'));
  // une autre structure que data/rows
  refuse(5, () => appliquerPaquet(paquetChange(PAQUET_COPIE, (p) => p.exec(`PRAGMA user_version = ${p.prepare('PRAGMA user_version').get().user_version + 1}`)),
    { lot: COPIE, mode: 'copie', rows }));
  assert.deepEqual(lire(), avant, 'data/rows intact après chaque refus');
});

test('la table des pages, page par page : une page typée refaite depuis ses tables passe avec la trace de sa table, une page libre changée sans trace est refusée', () => {
  // la page du métier tracé (son corps est refait depuis la table metier : colonneDerivee) : admise sans trace de sa ligne
  const typee = paquetChange(PAQUET_COPIE, (p) => p.prepare("UPDATE page SET corps_md = corps_md || '\n\nzqx' WHERE id = ?").run(metier.id));
  const r = appliquerPaquet(typee, { lot: COPIE, mode: 'copie', rows: copieDesLignes().rows });
  assert.ok(r.fichiers.includes('page.sql'));
  // une page du guide changée sans trace de sa ligne : la trace du métier ne la justifie pas
  const guide = db.prepare("SELECT id FROM page WHERE id GLOB 'guide/*' ORDER BY id LIMIT 1").get().id;
  const libre = paquetChange(PAQUET_COPIE, (p) => p.prepare("UPDATE page SET corps_md = corps_md || '\n\nzqx' WHERE id = ?").run(guide));
  const { rows, lire } = copieDesLignes();
  const avant = lire();
  assert.throws(() => appliquerPaquet(libre, { lot: COPIE, mode: 'copie', rows }), (e) => e.code === 4 && e.details.sansTrace.includes('page') && e.details.pages.includes(guide)
    && !e.details.pages.includes(metier.id));
  // une colonne non dérivée d'une page typée (son titre) non plus
  const titre = paquetChange(PAQUET_COPIE, (p) => p.prepare("UPDATE page SET titre = titre || ' zqx' WHERE id = ?").run(metier.id));
  assert.throws(() => appliquerPaquet(titre, { lot: COPIE, mode: 'copie', rows }), (e) => e.code === 4 && e.details.pages.includes(metier.id));
  assert.deepEqual(lire(), avant);
});

/** L'export d'une base par l'exporteur des importeurs (tools/db/exporter.py), une fois par base : son dossier. */
const exports_ = new Map();
const exporter = (base) => {
  if (!exports_.has(base)) {
    const dossier = dossierTemporaire('export', { dans: racine });
    const r = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), base, '--rows', dossier], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`export refusé : ${r.stderr || r.stdout}`);
    exports_.set(base, dossier);
  }
  return exports_.get(base);
};
/** Les fichiers de data/rows du petit dépôt : tous ceux de l'export de l'import (livrer exige l'égalité des deux ensembles). */
const fichiersDuDepot = () => readdirSync(exporter(regles)).filter((f) => f.endsWith('.sql')).sort();

describe('le workflow avec un paquet (dépôts git temporaires)', () => {
  const avecGit = spawnSync('git', ['--version']).status === 0;
  const passer = { skip: !avecGit && 'git indisponible' };
  const DEPOT = 'Bravexier/MaverickCenter';
  const RUN = `https://github.com/${DEPOT}/actions/runs/456`;
  const DEBUT = new Date('2026-11-15T12:30:00Z');
  const adresse = (lot) => `https://dev.maverick-jdr.com/api/mise-a-jour/lots/${lot}/`;
  const empreinte = (octets) => createHash('sha256').update(octets).digest('hex');
  const configurer = (g) => {
    g(['config', 'user.name', 'test']);
    g(['config', 'user.email', 'test@example.com']);
    g(['config', 'commit.gpgsign', 'false']);
  };
  /** Un dépôt « distant » nu (dev et master) et ses clones : la machine du job preparer, celle du job livrer. */
  const distant = () => {
    const dir = dossierTemporaire('distant', { dans: racine });
    const origine = join(dir, 'origine.git');
    enveloppeGit(gitLocal(dir))(['init', '--quiet', '--bare', '-b', 'dev', origine]);
    const cloner = (nom) => {
      enveloppeGit(gitLocal(dir))(['clone', '--quiet', origine, nom]);
      const d = join(dir, nom);
      const g = enveloppeGit(gitLocal(d));
      configurer(g);
      return { d, g };
    };
    const amorce = cloner('amorce');
    mkdirSync(join(amorce.d, 'data', 'rows'), { recursive: true });
    // de vrais fichiers de data/rows (ceux de l'import, exportés) : livrer réexporte le paquet et compare chaque fichier du commit
    for (const f of fichiersDuDepot()) copyFileSync(join(exporter(regles), f), join(amorce.d, 'data', 'rows', f));
    amorce.g(['add', '-A']);
    amorce.g(['commit', '--quiet', '-m', 'départ']);
    amorce.g(['push', '--quiet', 'origin', 'HEAD:refs/heads/dev', 'HEAD:refs/heads/master']);
    return { origine, cloner };
  };
  const servir = (lot, octets, api = []) => async (url, init = {}) => {
    if (url === adresse(lot)) return { status: 200, arrayBuffer: async () => new Uint8Array(octets).buffer };
    api.push({ url, methode: init.method ?? 'GET' });
    return { status: 200, text: async () => '[]', json: async () => [] };
  };
  /**
   * Le script du paquet simulé : il pose dans data/rows l'export du paquet (celui que donnerait le vrai script : test « mise à jour » plus haut), plus `plus`
   * (un fichier que la liste blanche doit refuser), et son résumé. Rend aussi les fichiers changés.
   */
  const executerPaquet = (d, { paquet, version, appels = [], plus = [] }) => (commande, args) => {
    appels.push(args.join(' '));
    if (args.some((a) => a.endsWith('mise-a-jour-paquet.mjs'))) {
      const fichiers = [];
      for (const f of fichiersDuDepot()) {
        const exporte = readFileSync(join(exporter(paquet), f), 'utf8');
        if (exporte !== readFileSync(join(d, 'data', 'rows', f), 'utf8')) fichiers.push(f);
        writeFileSync(join(d, 'data', 'rows', f), exporte);
      }
      for (const f of plus) writeFileSync(join(d, 'data', 'rows', f), `-- ${f} changé\n`);
      writeFileSync(args[args.indexOf('--resume') + 1], JSON.stringify({ version, depuis: null, lignes: 1, fichiers, markdown: version ? `## Version ${version}` : '' }));
    }
    return { code: 0 };
  };

  test('mise à jour (simulation) : preparer recontrôle le paquet par son script, livrer revérifie l\'artefact et la liste blanche des tables du paquet, rien n\'est poussé', passer, async () => {
    const SIMU = '5f8fad5b-d9cb-469f-a165-70867728950e';
    const fichier = join(paquets, 'simulation.db');
    fabriquerPaquet({ source: chemin, destination: fichier, production: regles, id: SIMU, mode: 'simulation', version: CIBLE, date: '2026-11-15' });
    const octets = readFileSync(fichier);
    const { origine, cloner } = distant();
    const prep = cloner('preparer');
    const artefact = dossierTemporaire('artefact', { dans: racine });
    const appels = [];
    const api = [];
    const entrees = { lot: SIMU, empreinte: empreinte(octets), adresse: adresse(SIMU), essai: true, depot: DEPOT, run: RUN, artefact, debut: DEBUT };
    const p = await preparer({ ...entrees, racine: prep.d, temp: dossierTemporaire('run', { dans: racine }) },
      { fetch: servir(SIMU, octets, api), git: gitLocal(prep.d), executer: executerPaquet(prep.d, { paquet: fichier, version: CIBLE, appels }) });
    assert.deepEqual([p.etat, p.paquet, p.copie, p.version], ['pret', true, false, CIBLE]);
    assert.deepEqual(p.fichiers, ['historique_modification.sql', 'metier.sql', 'note_version.sql', 'note_version_ligne.sql'].map((f) => `data/rows/${f}`));
    assert.ok(appels.some((a) => a.includes('mise-a-jour-paquet.mjs') && a.includes('--mode simulation') && a.includes(`--lot ${SIMU}`)), 'le script du paquet, pas le rejeu');
    assert.ok(!appels.some((a) => a.includes('mise-a-jour-regles.mjs')));
    assert.deepEqual([ARTEFACT_PAQUET, ARTEFACT.commit, ARTEFACT.preparation].map((f) => existsSync(join(artefact, f))), [true, true, true]);
    assert.equal(existsSync(join(artefact, ARTEFACT.lot)), false);
    assert.match(prep.g(['log', '-1', '--format=%B']).sortie, new RegExp(`^Lot : ${SIMU}$`, 'm'));

    const livr = cloner('livrer');
    const avant = enveloppeGit(gitLocal(origine))(['for-each-ref', '--format=%(refname) %(objectname)']).sortie;
    const outils = { fetch: servir(SIMU, octets, api), git: gitLocal(livr.d, { jeton: 'pat', jetonLecture: 'lecture' }), attendre: async () => {}, journal: () => {} };
    const r = await fusionDansDev({ ...entrees, jeton: 'pat', jetonLecture: 'lecture' }, outils);
    assert.deepEqual([r.etat, r.version, r.fichiers], ['essai', CIBLE, p.fichiers]);
    assert.equal((await livraisonVersMaster({ ...entrees, jeton: 'pat', jetonLecture: 'lecture' }, outils)).etat, 'essai');
    assert.equal(enveloppeGit(gitLocal(origine))(['for-each-ref', '--format=%(refname) %(objectname)']).sortie, avant, 'le distant n\'a pas changé');
    assert.ok(api.every((a) => a.methode === 'GET'));
    // le mode du paquet et l'entrée « essai » doivent s'accorder (un paquet de simulation lancé en vrai : refusé avant tout)
    await assert.rejects(preparer({ ...entrees, essai: false, racine: prep.d, temp: dossierTemporaire('run', { dans: racine }) },
      { fetch: servir(SIMU, octets), git: gitLocal(prep.d), executer: () => ({ code: 0 }) }), (e) => e.etape === 'entrees');
  });

  test('copie vers le dépôt : « Copie : <id> » (pas « Lot : »), jamais vers master ; la liste blanche refuse une table propre au site ; entrées et paquet d\'accord', passer, async () => {
    const octets = readFileSync(PAQUET_COPIE);
    const { cloner } = distant();
    const prep = cloner('preparer');
    const artefact = dossierTemporaire('artefact', { dans: racine });
    const entrees = { lot: COPIE, empreinte: empreinte(octets), adresse: adresse(COPIE), copie: true, depot: DEPOT, run: RUN, artefact, debut: DEBUT };
    const outils = (d, plus = []) => ({ fetch: servir(COPIE, octets), git: gitLocal(d), executer: executerPaquet(d, { paquet: PAQUET_COPIE, version: null, plus }) });
    // un fichier hors du contenu (une table de fiches) : refusé par la liste blanche du paquet, rien n'est commité
    await assert.rejects(preparer({ ...entrees, racine: prep.d, temp: dossierTemporaire('run', { dans: racine }) }, outils(prep.d, ['utilisateur.sql'])),
      (e) => e.etape === 'liste' && /utilisateur\.sql/.test(e.message));
    prep.g(['checkout', '--quiet', '--', '.']);
    const p = await preparer({ ...entrees, racine: prep.d, temp: dossierTemporaire('run', { dans: racine }) }, outils(prep.d));
    assert.deepEqual([p.etat, p.paquet, p.copie, p.version], ['pret', true, true, null]);
    const message = prep.g(['log', '-1', '--format=%B']).sortie;
    assert.match(message, new RegExp(`^Copie : ${COPIE}$`, 'm'));
    assert.doesNotMatch(message, /^Lot : /m, 'une copie ne se fait pas passer pour une mise à jour en attente');
    // poussée dans dev (comme la fusion le ferait), elle ne bloque aucune mise à jour suivante
    prep.g(['push', '--quiet', 'origin', `HEAD:refs/heads/dev`]);
    prep.g(['fetch', '--quiet', 'origin']);
    assert.deepEqual(lotsEnAttente(prep.g, LOT), []);
    // la liste blanche du job livrer : les tables de contenu du paquet ; une table de fiches n'en est pas
    const lecture = new DatabaseSync(PAQUET_COPIE, { readOnly: true });
    const tables = JSON.parse(lecture.prepare('SELECT tables_de_contenu AS t FROM paquet_meta').get().t);
    lecture.close();
    assert.ok(tables.includes('metier') && !tables.includes('utilisateur') && !tables.includes('modification'));
    assert.deepEqual(verifierCommit(prep.g, { base: 'HEAD~1', commit: 'HEAD', tables }), ['data/rows/historique_modification.sql', 'data/rows/metier.sql']);
    // le réexport du paquet (livrer) : le commit de l'artefact le porte octet pour octet ; un commit qui change une table autrement que le paquet est refusé
    const prepare = prep.g(['rev-parse', 'HEAD']).sortie.trim();
    assert.equal(verifierContrePaquet(prep.g, { commit: prepare, paquet: PAQUET_COPIE }), fichiersDuDepot().length);
    writeFileSync(join(prep.d, 'data', 'rows', 'metier.sql'), readFileSync(join(prep.d, 'data', 'rows', 'metier.sql'), 'utf8').replace('(zqx)', '(zqx autrement)'));
    prep.g(['commit', '--quiet', '-am', 'contenu changé autrement que le paquet']);
    const falsifie = prep.g(['rev-parse', 'HEAD']).sortie.trim();
    assert.throws(() => verifierContrePaquet(prep.g, { commit: falsifie, paquet: PAQUET_COPIE }), (e) => e.etape === 'paquet' && /data\/rows\/metier\.sql/.test(e.message));
    assert.throws(() => verifierContrePaquet(prep.g, { commit: prepare, paquet: PAQUET }), (e) => e.etape === 'paquet', 'un autre paquet ne donne pas ce commit');
    // un fichier que le paquet donne, retiré par le commit : refusé aussi (la liste blanche ne le verrait pas)
    prep.g(['reset', '--quiet', '--hard', prepare]);
    prep.g(['rm', '--quiet', 'data/rows/race.sql']);
    prep.g(['commit', '--quiet', '-m', 'une table retirée']);
    const ampute = prep.g(['rev-parse', 'HEAD']).sortie.trim();
    assert.throws(() => verifierContrePaquet(prep.g, { commit: ampute, paquet: PAQUET_COPIE }),
      (e) => e.etape === 'paquet' && /data\/rows\/race\.sql \(absent du commit\)/.test(e.message));
    prep.g(['reset', '--quiet', '--hard', prepare]);
    // octet pour octet, jamais après décodage : un paquet dont le texte porte le caractère de remplacement (U+FFFD, EF BF BD en UTF-8) et un commit qui écrit
    // à sa place un octet invalide (FF) donnent le même texte décodé ; ils sont refusés. Le commit qui porte l'export exact passe.
    const remplacement = paquetChange(PAQUET_COPIE, (p) => p.prepare('UPDATE metier SET bonus_brut = bonus_brut || ? WHERE id = ?').run('�', metier.id));
    const exportRemplacement = exporter(remplacement);
    const octetsExacts = readFileSync(join(exportRemplacement, 'metier.sql'));
    const rang = octetsExacts.indexOf(Buffer.from('�', 'utf8'));
    assert.ok(rang >= 0, 'l’export porte le caractère de remplacement');
    writeFileSync(join(prep.d, 'data', 'rows', 'metier.sql'), octetsExacts);
    prep.g(['commit', '--quiet', '-am', 'export exact']);
    const exact = prep.g(['rev-parse', 'HEAD']).sortie.trim();
    assert.equal(verifierContrePaquet(prep.g, { commit: exact, paquet: remplacement }), fichiersDuDepot().length);
    writeFileSync(join(prep.d, 'data', 'rows', 'metier.sql'), Buffer.concat([octetsExacts.subarray(0, rang), Buffer.from([0xff]), octetsExacts.subarray(rang + 3)]));
    prep.g(['commit', '--quiet', '-am', 'un octet invalide à la place']);
    const invalide = prep.g(['rev-parse', 'HEAD']).sortie.trim();
    assert.equal(prep.g(['show', `${invalide}:data/rows/metier.sql`]).sortie, prep.g(['show', `${exact}:data/rows/metier.sql`]).sortie, 'les deux textes décodés sont égaux');
    assert.throws(() => verifierContrePaquet(prep.g, { commit: invalide, paquet: remplacement }), (e) => e.etape === 'paquet' && /data\/rows\/metier\.sql/.test(e.message));
    prep.g(['reset', '--quiet', '--hard', prepare]);
    // jamais vers master : l'étape « Livraison vers master » ne fait rien
    const livr = cloner('livrer');
    const m = await livraisonVersMaster({ ...entrees, jeton: 'pat', jetonLecture: 'lecture' },
      { fetch: servir(COPIE, octets), git: gitLocal(livr.d, { jeton: 'pat', jetonLecture: 'lecture' }), attendre: async () => {}, journal: () => {} });
    assert.equal(m.etat, 'copie');
    // le paquet et les entrées : dans les deux sens ; jamais copie et simulation ensemble
    assert.throws(() => verifierCopie({ copie: true }, false), (e) => e.etape === 'entrees');
    assert.throws(() => verifierCopie({ copie: false }, true), (e) => e.etape === 'entrees');
    assert.throws(() => verifierCopie({ paquet: false }, true), (e) => e.etape === 'entrees', 'un lot figé n\'est jamais une copie');
    await assert.rejects(preparer({ ...entrees, copie: false, racine: prep.d, temp: dossierTemporaire('run', { dans: racine }) }, outils(prep.d)), (e) => e.etape === 'entrees');
    await assert.rejects(preparer({ ...entrees, essai: true, racine: prep.d, temp: dossierTemporaire('run', { dans: racine }) }, outils(prep.d)), (e) => e.etape === 'entrees');
  });
});
