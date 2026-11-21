// L'identité du lot (lot 11, PR 4 ; docs/serveur.md, « Bascule 2 : préparation », « PR 4 ») : sous l'interrupteur tools/flux-git/bascule-2.json (lu dans origin/dev), le
// commit d'une mise à jour porte TOUJOURS data/paquet.json (lot, version, empreinte du paquet, structure, commit du code, date : aucun contenu), en plus de la copie
// de data/rows : plus de « Rien à livrer », et le code désigne son paquet. Éteint, rien ne change. Contre un vrai git (dépôts temporaires) et des commandes simulées.
//   node --test test/mise-a-jour-identite.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import { FICHIER_D_IDENTITE as FICHIER_DU_KIT, FORMAT_D_IDENTITE as FORMAT_DU_KIT } from '../../deploy/installateur/kit.mjs';
import {
  FICHIER_D_IDENTITE, FORMAT_D_IDENTITE, FORMAT_PAQUET, INTERRUPTEUR_BASCULE_2, appliquerSurDev, bascule2Allumee, creerBundle, enveloppeGit, gitLocal, horodatage,
  identiteDuPaquet, importerCommit, lirePaquet, preparer, texteDeLIdentite, verifierCommit, verifierIdentite, verifierPreparation,
} from '../scripts/mise-a-jour-github.mjs';
import { lireLInterrupteur } from '../../tools/flux-git/bascule-2.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const LOT = '0f8fad5b-d9cb-469f-a165-70867728950e';
const DEPOT = 'Bravexier/MaverickCenter';
const ADRESSE = `https://dev.maverick-jdr.com/api/mise-a-jour/lots/${LOT}/`;
const RUN = `https://github.com/${DEPOT}/actions/runs/123`;
const DEBUT = new Date('2026-10-11T12:30:00Z');
const COMMIT_DU_CODE = 'c'.repeat(40);
const racine = dossierTemporaire('mise-a-jour-identite');
let n = 0;
const dossier = (prefixe) => dossierTemporaire(`${prefixe}-${(n += 1)}`, { dans: racine });
const empreinte = (octets) => createHash('sha256').update(octets).digest('hex');

/** Un paquet minimal : la seule vue que lirePaquet lit (paquet_meta, ici une table). `meta` surcharge les valeurs. */
function paquetDEssai(meta = {}) {
  const chemin = join(dossier('paquet'), 'paquet.db');
  const v = {
    format: FORMAT_PAQUET, id: LOT, mode: 'mise-a-jour', version: '0.2', majeure: 0, tables_de_contenu: JSON.stringify(['metier']), schema: 12,
    fabrique_le: '2026-10-11T12:00:00.000Z', commit_du_code: COMMIT_DU_CODE, ...meta,
  };
  const db = new DatabaseSync(chemin);
  db.exec('CREATE TABLE paquet_meta (format TEXT, id TEXT, mode TEXT, version TEXT, majeure INTEGER, tables_de_contenu TEXT, schema INTEGER, fabrique_le TEXT, commit_du_code TEXT)');
  db.prepare('INSERT INTO paquet_meta VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(v.format, v.id, v.mode, v.version, v.majeure, v.tables_de_contenu, v.schema, v.fabrique_le, v.commit_du_code);
  db.close();
  const octets = readFileSync(chemin);
  return { chemin, octets, empreinte: empreinte(octets), donnees: lirePaquet(octets, chemin, { empreinte: empreinte(octets), lot: LOT }) };
}

describe('l’identité du paquet (pure)', () => {
  test('lirePaquet donne la fiche ; le format et le nom du fichier sont ceux du kit', () => {
    const p = paquetDEssai();
    assert.deepEqual(p.donnees.fiche, { schema: 12, fabrique_le: '2026-10-11T12:00:00.000Z', commit_du_code: COMMIT_DU_CODE });
    assert.equal(FICHIER_D_IDENTITE, FICHIER_DU_KIT, 'copie de kit.mjs');
    assert.equal(FORMAT_D_IDENTITE, FORMAT_DU_KIT, 'copie de kit.mjs');
    assert.equal(FICHIER_D_IDENTITE, 'data/paquet.json');
    assert.equal(INTERRUPTEUR_BASCULE_2, 'tools/flux-git/bascule-2.json');
  });

  test('l’identité : lot, version, empreinte, structure, commit du code, date ; texte stable, LF final, aucun contenu', () => {
    const p = paquetDEssai();
    const identite = identiteDuPaquet(p.donnees, p.empreinte);
    assert.deepEqual(identite, { format: FORMAT_D_IDENTITE, lot: LOT, version: '0.2', empreinte: p.empreinte, structure: 12, commit_du_code: COMMIT_DU_CODE, fabrique_le: '2026-10-11T12:00:00.000Z' });
    assert.deepEqual(Object.keys(identite), ['format', 'lot', 'version', 'empreinte', 'structure', 'commit_du_code', 'fabrique_le'], 'l’ordre des clés est figé : le job livrer compare des octets');
    const texte = texteDeLIdentite(identite);
    assert.ok(texte.endsWith('}\n'));
    assert.deepEqual(JSON.parse(texte), identite);
    assert.equal(texteDeLIdentite(identiteDuPaquet(p.donnees, p.empreinte)), texte, 'déterministe');
  });

  test('un commit du code inconnu s’écrit null ; un paquet de copie, une empreinte, un commit ou une structure invalides sont refusés', () => {
    const sansCode = paquetDEssai({ commit_du_code: null });
    assert.equal(identiteDuPaquet(sansCode.donnees, sansCode.empreinte).commit_du_code, null);
    const p = paquetDEssai();
    assert.throws(() => identiteDuPaquet(p.donnees, 'abc'), (e) => e.etape === 'paquet');
    assert.throws(() => identiteDuPaquet({ ...p.donnees, copie: true }, p.empreinte), (e) => e.etape === 'paquet', 'une copie n’a ni version ni identité');
    assert.throws(() => identiteDuPaquet({ ...p.donnees, fiche: { ...p.donnees.fiche, commit_du_code: 'pas-un-commit' } }, p.empreinte), (e) => e.etape === 'paquet');
    assert.throws(() => identiteDuPaquet({ ...p.donnees, fiche: { ...p.donnees.fiche, schema: null } }, p.empreinte), (e) => e.etape === 'paquet', 'un paquet d’avant la fiche');
    assert.throws(() => identiteDuPaquet({ ...p.donnees, fiche: { ...p.donnees.fiche, fabrique_le: '' } }, p.empreinte), (e) => e.etape === 'paquet');
  });

  test('verifierPreparation : l’identité n’est admise que annoncée, dans la liste des fichiers, hors copie', () => {
    const base = 'a'.repeat(40);
    const pret = (extra) => ({
      format: 'maverick-mise-a-jour-preparation/1', lot: LOT, empreinte: 'e'.repeat(64), essai: false, etat: 'pret', base, commit: 'b'.repeat(40), version: '0.2', markdown: 'note',
      fichiers: ['data/rows/metier.sql'], quand: horodatage(DEBUT), ...extra,
    });
    const entrees = { lot: LOT, empreinte: 'e'.repeat(64), essai: false };
    assert.ok(verifierPreparation(pret(), entrees), 'sans identité : comme avant');
    assert.ok(verifierPreparation(pret({ identite: true, fichiers: ['data/paquet.json', 'data/rows/metier.sql'] }), entrees));
    assert.ok(verifierPreparation(pret({ identite: true, fichiers: ['data/paquet.json'] }), entrees), 'l’identité seule (aucune ligne ne change)');
    assert.throws(() => verifierPreparation(pret({ fichiers: ['data/paquet.json'] }), entrees), (e) => e.etape === 'artefact', 'non annoncée : refusée comme tout fichier hors de data/rows');
    assert.throws(() => verifierPreparation(pret({ identite: true }), entrees), (e) => e.etape === 'artefact', 'annoncée mais absente de la liste');
    assert.throws(() => verifierPreparation(pret({ identite: false, fichiers: ['data/paquet.json'] }), entrees), (e) => e.etape === 'artefact');
    assert.throws(() => verifierPreparation(pret({ identite: true, fichiers: ['data/paquet.json', 'data/autre.json'] }), entrees), (e) => e.etape === 'artefact');
    assert.throws(() => verifierPreparation({ ...pret({ identite: true, fichiers: ['data/paquet.json'] }), copie: true, version: null }, { ...entrees, copie: true }), (e) => e.etape === 'artefact', 'une copie n’a pas d’identité');
  });
});

const avecGit = spawnSync('git', ['--version']).status === 0;
const passer = { skip: !avecGit && 'git indisponible' };
const configurer = (g) => {
  g(['config', 'user.name', 'test']);
  g(['config', 'user.email', 'test@example.com']);
  g(['config', 'commit.gpgsign', 'false']);
};
const LIGNES = Array.from({ length: 12 }, (_, i) => `INSERT INTO metier VALUES (${i + 1});`);
const ecrireLignes = (d, f, lignes) => writeFileSync(join(d, 'data', 'rows', f), `${lignes.join('\n')}\n`);

/** Un dépôt « distant » (nu) avec dev et master, `interrupteur` (le texte de bascule-2.json sur dev, ou null : absent), et des clones. */
function distant(interrupteur = null) {
  const dir = dossier('distant');
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
  mkdirSync(join(amorce.d, 'tools', 'flux-git'), { recursive: true });
  ecrireLignes(amorce.d, 'metier.sql', LIGNES);
  for (const f of ['note_version.sql', 'note_version_ligne.sql', 'historique_modification.sql']) writeFileSync(join(amorce.d, 'data', 'rows', f), `-- ${f}\n`);
  if (interrupteur !== null) writeFileSync(join(amorce.d, INTERRUPTEUR_BASCULE_2), interrupteur);
  amorce.g(['add', '-A']);
  amorce.g(['commit', '--quiet', '-m', 'départ']);
  amorce.g(['push', '--quiet', 'origin', 'HEAD:refs/heads/dev', 'HEAD:refs/heads/master']);
  return { dir, origine, cloner, amorce };
}
const allume = JSON.stringify({ actif: true });
const eteint = JSON.stringify({ actif: false });

describe('l’interrupteur de la bascule 2, lu dans origin/dev', () => {
  test('absent ou éteint : false ; allumé : true ; illisible : refus net (on ne devine pas)', passer, () => {
    const lire = (interrupteur) => bascule2Allumee(distant(interrupteur).cloner('c').g);
    assert.equal(lire(null), false);
    assert.equal(lire(eteint), false);
    assert.equal(lire(allume), true);
    assert.throws(() => lire('{ pas du json'), (e) => e.etape === 'entrees' && /illisible/.test(e.message));
    assert.throws(() => lire(JSON.stringify({ actif: 'oui' })), (e) => e.etape === 'entrees');
  });

  test('la préparation, la livraison et le contrôle du contenu écrit lisent l’interrupteur de la même façon : clé « actif » absente = éteint partout, jamais un échec', passer, () => {
    const lire = (interrupteur) => bascule2Allumee(distant(interrupteur).cloner('c').g);
    const pourLeGel = JSON.stringify({ gel_des_fusions: true });
    assert.equal(lire(pourLeGel), false, 'seul le gel des fusions est allumé : la préparation ne change rien');
    assert.equal(lireLInterrupteur(pourLeGel), false);
    for (const texte of [null, '{}', eteint, allume, pourLeGel, JSON.stringify({ actif: true, gel_des_fusions: false })]) {
      assert.equal(lire(texte), lireLInterrupteur(texte), String(texte));
    }
    assert.throws(() => lire('[]'), (e) => e.etape === 'entrees');
  });

  test('l’arbre de travail n’y change rien : seule la référence origin/dev compte', passer, () => {
    const { cloner } = distant(eteint);
    const c = cloner('c');
    writeFileSync(join(c.d, INTERRUPTEUR_BASCULE_2), allume);
    assert.equal(bascule2Allumee(c.g), false);
  });
});

describe('preparer : l’identité du lot dans le commit', () => {
  /**
   * Prépare un paquet sur un clone de `distant(interrupteur)`. `lignes` : le paquet change une ligne de metier.sql (sinon rien ne change) ; `mode` : mise-a-jour ou copie.
   * Les commandes sont simulées : mise-a-jour-paquet.mjs écrit data/rows et le résumé, les contrôles réussissent.
   */
  async function preparerUnLot({ interrupteur, lignes = true, mode = 'mise-a-jour', essai = false, paquetMeta = {} }) {
    const { cloner } = distant(interrupteur);
    const prep = cloner('preparer');
    const p = paquetDEssai({ mode, version: mode === 'copie' ? null : '0.2', ...paquetMeta });
    const artefact = dossier('artefact');
    const fetch = async () => ({ status: 200, arrayBuffer: async () => new Uint8Array(p.octets).buffer });
    const executees = [];
    const executer = (commande, args) => {
      executees.push([commande, ...args]);
      if (args.some((a) => a.endsWith('mise-a-jour-paquet.mjs'))) {
        if (lignes) ecrireLignes(prep.d, 'metier.sql', LIGNES.map((l, i) => (i === 1 ? 'INSERT INTO metier VALUES (2, \'+2\');' : l)));
        const copie = mode === 'copie';
        if (!copie) writeFileSync(join(prep.d, 'data', 'rows', 'note_version.sql'), '-- note 0.2\n');
        writeFileSync(args[args.indexOf('--resume') + 1], JSON.stringify({
          version: copie ? null : '0.2', depuis: copie ? null : '0.1', lignes: 1, fichiers: lignes ? ['metier.sql', ...(copie ? [] : ['note_version.sql'])] : (copie ? [] : ['note_version.sql']), markdown: copie ? '' : '## Version 0.2',
        }));
      }
      return { code: 0 };
    };
    const entrees = { lot: LOT, empreinte: p.empreinte, adresse: ADRESSE, essai, copie: mode === 'copie', depot: DEPOT, run: RUN, artefact, debut: DEBUT, racine: prep.d, temp: dossier('run') };
    const preparation = await preparer(entrees, { fetch, git: gitLocal(prep.d), executer });
    return { preparation, prep, p, artefact, executees };
  }

  test('éteint (fichier absent ou actif: false) : aucun data/paquet.json, la préparation est celle d’avant, « rien » quand rien ne change', passer, async () => {
    for (const interrupteur of [null, eteint]) {
      const r = await preparerUnLot({ interrupteur });
      assert.equal(r.preparation.etat, 'pret');
      assert.deepEqual(r.preparation.fichiers, ['data/rows/metier.sql', 'data/rows/note_version.sql']);
      assert.ok(!('identite' in r.preparation), 'pas de champ de plus dans la préparation');
      assert.ok(!existsSync(join(r.prep.d, FICHIER_D_IDENTITE)));
    }
    // aucune ligne ni note : « rien », comme avant
    const { cloner } = distant(eteint);
    const prep = cloner('preparer');
    const p = paquetDEssai();
    const fetch = async () => ({ status: 200, arrayBuffer: async () => new Uint8Array(p.octets).buffer });
    const executer = (commande, args) => {
      if (args.some((a) => a.endsWith('mise-a-jour-paquet.mjs'))) writeFileSync(args[args.indexOf('--resume') + 1], JSON.stringify({ version: '0.2', depuis: '0.1', lignes: 0, fichiers: [], markdown: '## Version 0.2' }));
      return { code: 0 };
    };
    const rien = await preparer({ lot: LOT, empreinte: p.empreinte, adresse: ADRESSE, essai: false, depot: DEPOT, run: RUN, artefact: dossier('artefact'), debut: DEBUT, racine: prep.d, temp: dossier('run') }, { fetch, git: gitLocal(prep.d), executer });
    assert.equal(rien.etat, 'rien', 'éteint : « Rien à livrer » existe encore');
  });

  test('allumé : le commit porte data/paquet.json avec les lignes ; le fichier est l’identité du paquet, octet pour octet', passer, async () => {
    const r = await preparerUnLot({ interrupteur: allume });
    assert.equal(r.preparation.etat, 'pret');
    assert.equal(r.preparation.identite, true);
    assert.deepEqual(r.preparation.fichiers, ['data/paquet.json', 'data/rows/metier.sql', 'data/rows/note_version.sql']);
    assert.equal(readFileSync(join(r.prep.d, FICHIER_D_IDENTITE), 'utf8'), texteDeLIdentite(identiteDuPaquet(r.p.donnees, r.p.empreinte)));
    const identite = JSON.parse(readFileSync(join(r.prep.d, FICHIER_D_IDENTITE), 'utf8'));
    assert.deepEqual([identite.lot, identite.version, identite.empreinte, identite.structure, identite.commit_du_code], [LOT, '0.2', r.p.empreinte, 12, COMMIT_DU_CODE]);
    // le commit : l'identité et les lignes, rien d'autre ; la ligne « Lot : » y est (le contrôle du contenu écrit l'exige)
    const dansLeCommit = r.prep.g(['diff-tree', '-r', '--no-commit-id', '--name-only', r.preparation.commit]).sortie.trim().split('\n');
    assert.deepEqual(dansLeCommit, ['data/paquet.json', 'data/rows/metier.sql', 'data/rows/note_version.sql']);
    assert.match(r.prep.g(['log', '-1', '--format=%B', r.preparation.commit]).sortie, new RegExp(`^Lot : ${LOT}$`, 'm'));
    assert.ok(existsSync(join(r.artefact, 'commit.bundle')), 'le commit part dans l’artefact');
  });

  test('allumé : plus jamais « Rien à livrer » : aucune ligne ne change, le commit porte l’identité seule', passer, async () => {
    const { cloner } = distant(allume);
    const prep = cloner('preparer');
    const p = paquetDEssai();
    const fetch = async () => ({ status: 200, arrayBuffer: async () => new Uint8Array(p.octets).buffer });
    const executer = (commande, args) => {
      if (args.some((a) => a.endsWith('mise-a-jour-paquet.mjs'))) writeFileSync(args[args.indexOf('--resume') + 1], JSON.stringify({ version: '0.2', depuis: '0.1', lignes: 0, fichiers: [], markdown: '## Version 0.2' }));
      return { code: 0 };
    };
    const r = await preparer({ lot: LOT, empreinte: p.empreinte, adresse: ADRESSE, essai: false, depot: DEPOT, run: RUN, artefact: dossier('artefact'), debut: DEBUT, racine: prep.d, temp: dossier('run') }, { fetch, git: gitLocal(prep.d), executer });
    assert.equal(r.etat, 'pret');
    assert.deepEqual(r.fichiers, ['data/paquet.json']);
    assert.equal(r.identite, true);
  });

  test('allumé : une simulation écrit aussi l’identité (elle éprouve le même commit) ; une copie vers le dépôt n’en écrit pas', passer, async () => {
    const simulation = await preparerUnLot({ interrupteur: allume, essai: true, mode: 'simulation' });
    assert.equal(simulation.preparation.identite, true);
    const copie = await preparerUnLot({ interrupteur: allume, mode: 'copie' });
    assert.equal(copie.preparation.etat, 'pret');
    assert.deepEqual(copie.preparation.fichiers, ['data/rows/metier.sql'], 'une copie n’est pas un lot : pas de version, pas d’identité');
    assert.ok(!existsSync(join(copie.prep.d, FICHIER_D_IDENTITE)));
    assert.ok(!('identite' in copie.preparation));
  });

  test('allumé, un paquet sans de quoi écrire son identité (fiche absente) arrête la préparation : rien n’est commité', passer, async () => {
    await assert.rejects(preparerUnLot({ interrupteur: allume, paquetMeta: { schema: null } }), (e) => e.etape === 'paquet');
  });
});

describe('livrer : la liste blanche et la comparaison à l’identité du paquet', () => {
  /** Un commit de lot préparé sur un clone : metier.sql, note de version, et (si `identite`) data/paquet.json ; `autre` : un fichier de plus. */
  function commitDeLot(prep, { identite = null, autre = null } = {}) {
    const base = prep.g(['rev-parse', 'origin/dev']).sortie.trim();
    prep.g(['checkout', '--quiet', '-B', 'preparation', 'origin/dev']);
    ecrireLignes(prep.d, 'metier.sql', LIGNES.map((l, i) => (i === 1 ? 'INSERT INTO metier VALUES (2, \'+2\');' : l)));
    writeFileSync(join(prep.d, 'data', 'rows', 'note_version.sql'), '-- note 0.2\n');
    if (identite !== null) writeFileSync(join(prep.d, FICHIER_D_IDENTITE), identite);
    if (autre) writeFileSync(join(prep.d, autre), 'x\n');
    prep.g(['add', '-A']);
    prep.g(['-c', 'user.name=github-actions[bot]', 'commit', '--quiet', '--no-verify', '-m', 'Mise à jour des règles V0.2', '-m', `Lot : ${LOT}`]);
    return { base, commit: prep.g(['rev-parse', 'HEAD']).sortie.trim() };
  }
  const tables = ['metier'];

  test('verifierCommit : data/paquet.json refusé sans l’annonce, admis avec, jamais un autre fichier ni un lien', passer, () => {
    const { cloner } = distant(allume);
    const p = paquetDEssai();
    const texte = texteDeLIdentite(identiteDuPaquet(p.donnees, p.empreinte));
    const prep = cloner('preparer');
    const { base, commit } = commitDeLot(prep, { identite: texte });
    assert.throws(() => verifierCommit(prep.g, { base, commit, tables }), (e) => e.etape === 'liste' && /data\/paquet\.json/.test(e.message), 'éteint : refusé comme avant');
    assert.throws(() => verifierCommit(prep.g, { base, commit, tables, identite: false }), (e) => e.etape === 'liste');
    assert.deepEqual(verifierCommit(prep.g, { base, commit, tables, identite: true }), ['data/paquet.json', 'data/rows/metier.sql', 'data/rows/note_version.sql']);
    assert.deepEqual(verifierCommit(prep.g, { base, commit, tables, identite: true, fichiers: ['data/paquet.json', 'data/rows/metier.sql', 'data/rows/note_version.sql'] }).length, 3);
    assert.throws(() => verifierCommit(prep.g, { base, commit, tables, identite: true, fichiers: ['data/rows/metier.sql', 'data/rows/note_version.sql'] }), (e) => e.etape === 'liste', 'la liste annoncée doit l’inclure');
    // un autre fichier de data/ reste refusé, identité annoncée ou non
    const autre = cloner('autre');
    const c2 = commitDeLot(autre, { identite: texte, autre: 'data/autre.json' });
    assert.throws(() => verifierCommit(autre.g, { base: c2.base, commit: c2.commit, tables, identite: true }), (e) => e.etape === 'liste' && /autre\.json/.test(e.message));
  });

  test('verifierIdentite : le fichier du commit est exactement l’identité recalculée du paquet', passer, () => {
    const { cloner } = distant(allume);
    const p = paquetDEssai();
    const bon = texteDeLIdentite(identiteDuPaquet(p.donnees, p.empreinte));
    const prep = cloner('preparer');
    const { commit } = commitDeLot(prep, { identite: bon });
    assert.doesNotThrow(() => verifierIdentite(prep.g, { commit, donnees: p.donnees, empreinte: p.empreinte }));
    // un octet de plus, une valeur changée, une empreinte d'un autre paquet, un fichier absent : refusés
    for (const [nom, texte] of [['espace de fin', `${bon} `], ['version changée', bon.replace('"0.2"', '"0.3"')], ['autre empreinte', bon.replace(p.empreinte, 'f'.repeat(64))]]) {
      const c = cloner(nom.replace(/\W/g, ''));
      const cc = commitDeLot(c, { identite: texte });
      assert.throws(() => verifierIdentite(c.g, { commit: cc.commit, donnees: p.donnees, empreinte: p.empreinte }), (e) => e.etape === 'paquet', nom);
    }
    const sans = cloner('sans');
    const cs = commitDeLot(sans);
    assert.throws(() => verifierIdentite(sans.g, { commit: cs.commit, donnees: p.donnees, empreinte: p.empreinte }), (e) => e.etape === 'paquet' && /ne porte pas/.test(e.message));
  });

  test('appliquerSurDev : le commit rejoué sur un dev qui a bougé garde l’identité ; sans l’annonce, le rejeu la refuse', passer, () => {
    const d = distant(allume);
    const p = paquetDEssai();
    const texte = texteDeLIdentite(identiteDuPaquet(p.donnees, p.empreinte));
    const prep = d.cloner('preparer');
    const { base, commit } = commitDeLot(prep, { identite: texte });
    const fichier = join(prep.d, '..', 'commit.bundle');
    creerBundle(prep.g, { base, commit, fichier });
    const livr = d.cloner('livrer');
    const preparation = { format: 'x', lot: LOT, etat: 'pret', base, commit, version: '0.2', markdown: 'note', fichiers: ['data/paquet.json', 'data/rows/metier.sql', 'data/rows/note_version.sql'], quand: horodatage(DEBUT), identite: true };
    importerCommit(livr.g, fichier, preparation);
    // dev bouge loin des lignes du lot : rejeu propre
    d.amorce.g(['fetch', '--quiet', 'origin']);
    d.amorce.g(['checkout', '--quiet', '-B', 'dev', 'origin/dev']);
    ecrireLignes(d.amorce.d, 'metier.sql', LIGNES.map((l, i) => (i === 9 ? 'INSERT INTO metier VALUES (10, \'dev\');' : l)));
    d.amorce.g(['commit', '--quiet', '-am', 'autre travail sur dev']);
    d.amorce.g(['push', '--quiet', 'origin', 'HEAD:refs/heads/dev']);
    livr.g(['fetch', '--quiet', 'origin', '+refs/heads/dev:refs/remotes/origin/dev']);
    const a = appliquerSurDev(livr.g, { preparation, branche: 'feature/mise-a-jour-regles-20261011-1430', tables });
    assert.equal(a.rejoue, true);
    assert.equal(livr.g(['show', `${a.sha}:${FICHIER_D_IDENTITE}`]).sortie, texte, 'l’identité traverse le rebase telle quelle');
    assert.throws(() => appliquerSurDev(livr.g, { preparation: { ...preparation, identite: undefined }, branche: 'feature/mise-a-jour-regles-20261011-1430-2', tables }), (e) => e.etape === 'liste');
  });
});
