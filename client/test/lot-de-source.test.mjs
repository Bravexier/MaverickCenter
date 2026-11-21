// L'outil générique « lot de nature `source` » (scripts/lot-de-source.mjs ; lot 12 du chantier « la base du site de dev devient la source de vérité », R274,
// R275 (4), R278) : depuis une base réimportée et l'extrait du jour, un lot de changements de nature `source`, contrôlé, que l'outil n'envoie jamais.
// Le test porte sur le fonctionnement (opérations, nature, ordre, refus, absence d'envoi), pas sur une valeur du contenu : les lignes d'essai se choisissent dans
// l'état courant de la base d'essai (copie de l'extrait), jamais par un id supposé.
//   node --test test/lot-de-source.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ecrireLeLotDeSource, lotDeSource } from '../scripts/lot-de-source.mjs';
import { essayerLeLot } from '../serveur/edition-lots.mjs';
import { controlerLeLot } from '../src/lib/lot-de-changements.mjs';
import { copieDEssai, empreinteDuFichier } from './aide-contenu-fourni.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/lot-de-source.mjs', import.meta.url));
const ouvrir = (chemin) => new DatabaseSync(chemin, { readOnly: true });

/** Une copie de l'extrait (« avant ») et sa réimportation d'essai (« après ») : un texte réécrit, une ligne retirée, une ligne ajoutée, toutes lues dans l'état courant. */
function paire(dossier, modifier = () => {}) {
  const avant = copieDEssai(dossier, () => {}, 'avant.db');
  const apres = copieDEssai(dossier, (db) => {
    const metier = db.prepare('SELECT id, description FROM metier WHERE description IS NOT NULL ORDER BY id LIMIT 1').get();
    db.prepare('UPDATE metier SET description = ? WHERE id = ?').run(`${metier.description} Phrase d'essai de test/lot-de-source.test.mjs.`, metier.id);
    const [retiree, gardee] = db.prepare('SELECT page_id, ordre FROM alias ORDER BY page_id, ordre LIMIT 2').all();
    db.prepare('DELETE FROM alias WHERE page_id = ? AND ordre = ?').run(retiree.page_id, retiree.ordre);
    const ordre = db.prepare('SELECT max(ordre) + 1 AS o FROM alias WHERE page_id = ?').get(gardee.page_id).o;
    db.prepare('INSERT INTO alias (page_id, ordre, texte, cle) VALUES (?, ?, ?, ?)').run(gardee.page_id, ordre, 'Alias d\'essai', 'alias-d-essai');
    modifier(db);
  }, 'apres.db');
  return { avant, apres, metier: null };
}

test('lotDeSource : un lot de nature « source », contrôlé, avec les trois opérations', (t) => {
  const { avant, apres } = paire(dossierTemporaire('lot-de-source', { t }));
  const a = ouvrir(avant);
  const b = ouvrir(apres);
  try {
    const { lot, bilan } = lotDeSource(a, b, { titre: 'Réimport d’essai', auteur: 'test' });
    assert.equal(lot.format, 'maverick-lot/1');
    assert.equal(lot.nature, 'source');
    assert.equal(lot.decision, undefined, 'une source ne porte pas de numéro de décision');
    assert.equal(lot.auteur, 'test');
    assert.deepEqual([...new Set(lot.operations.map((o) => o.operation))].sort(), ['inserer', 'modifier', 'supprimer']);
    // l'ordre du service : modifications, insertions, suppressions
    const rangs = lot.operations.map((o) => ['modifier', 'inserer', 'supprimer'].indexOf(o.operation));
    assert.deepEqual(rangs, [...rangs].sort((x, y) => x - y));
    assert.deepEqual(Object.keys(bilan.tables).sort(), ['alias', 'metier']);
    assert.equal(bilan.operations, lot.operations.length);
    assert.equal(bilan.tables.metier.modifier, 1);
    // un lot que le contrôle du dépôt accepte, toutes tables ouvertes (comme sur une base dont le service est la source)
    const structure = (table) => {
      const infos = b.prepare(`PRAGMA table_info("${table}")`).all();
      return infos.length ? { colonnes: infos.map((c) => c.name), cle: infos.filter((c) => c.pk).sort((x, y) => x.pk - y.pk).map((c) => c.name) } : null;
    };
    assert.equal(controlerLeLot(lot, { structure, ouvertHorsEdition: true }).valide, true);
  } finally {
    a.close();
    b.close();
  }
});

test('lotDeSource : le texte réécrit est accepté entier par l’essai à blanc du service (le lot n’est qu’une proposition)', (t) => {
  const dossier = dossierTemporaire('lot-de-source-essai', { t });
  // seul le texte réécrit : la table des alias n'est pas écrite par le service d'édition
  const avant = copieDEssai(dossier, () => {}, 'avant.db');
  const apres = copieDEssai(dossier, (db) => {
    const metier = db.prepare('SELECT id, description FROM metier WHERE description IS NOT NULL ORDER BY id LIMIT 1').get();
    db.prepare('UPDATE metier SET description = ? WHERE id = ?').run(`${metier.description} Phrase d'essai de test/lot-de-source.test.mjs.`, metier.id);
  }, 'apres.db');
  const a = ouvrir(avant);
  const b = ouvrir(apres);
  let lot;
  try {
    lot = lotDeSource(a, b, { titre: 'Réimport d’essai' }).lot;
  } finally {
    a.close();
    b.close();
  }
  assert.equal(lot.operations.length, 1);
  const essai = essayerLeLot({ source: avant, dossier: join(dossier, 'essai'), depose: { id: 'essai-lot-de-source', titre: lot.titre, nature: lot.nature, decision: null, lot } });
  assert.equal(essai.comptes.refusees, 0, JSON.stringify(essai.operations?.filter((o) => o.etat === 'refusee').slice(0, 3)));
  assert.equal(essai.verdict, 'applicable');
});

test('lotDeSource : aucune différence, pas de lot ; deux bases incomparables ou un en-tête refusé, une erreur', (t) => {
  const dossier = dossierTemporaire('lot-de-source-refus', { t });
  const avant = copieDEssai(dossier, () => {}, 'avant.db');
  const meme = copieDEssai(dossier, () => {}, 'meme.db');
  const a = ouvrir(avant);
  const m = ouvrir(meme);
  try {
    assert.deepEqual(lotDeSource(a, m, { titre: 'Rien' }), { lot: null, bilan: { operations: 0, tables: {} } });
    assert.throws(() => lotDeSource(a, m, { titre: '' }), /titre/);
  } finally {
    m.close();
  }
  // une page d'exemple de plus dans l'« après » : des fixtures ne se proposent pas au site de dev
  const avecExemple = copieDEssai(dossier, (db) => db.exec("UPDATE page SET statut = 'example' WHERE id = (SELECT id FROM page WHERE statut <> 'example' ORDER BY id LIMIT 1)"), 'exemple.db');
  const e = ouvrir(avecExemple);
  try {
    assert.throws(() => lotDeSource(a, e, { titre: 'Exemple' }), /pages d'exemple/);
  } finally {
    e.close();
  }
  // une structure différente
  const autre = copieDEssai(dossier, (db) => db.exec('PRAGMA user_version = 1'), 'autre.db');
  const o = ouvrir(autre);
  try {
    assert.throws(() => lotDeSource(a, o, { titre: 'Structure' }), /même structure/);
  } finally {
    o.close();
    a.close();
  }
});

test('ecrireLeLotDeSource et la ligne de commande : le lot est écrit, l’extrait n’est jamais modifié, rien n’est envoyé', (t) => {
  const dossier = dossierTemporaire('lot-de-source-cli', { t });
  const { avant, apres } = paire(dossier);
  const empreinte = empreinteDuFichier(avant);
  const sortie = join(dossier, 'lot.json');
  const r = ecrireLeLotDeSource({ avant, apres, titre: 'Réimport d’essai', sortie });
  assert.deepEqual(JSON.parse(readFileSync(sortie, 'utf8')), r.lot);
  assert.equal(empreinteDuFichier(avant), empreinte, 'le fichier « avant » est copié, jamais modifié');

  const ligne = join(dossier, 'ligne.json');
  const cli = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--avant', avant, '--apres', apres, '--lot', ligne, '--titre', 'Réimport d’essai'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(readFileSync(ligne, 'utf8')), r.lot);
  assert.match(cli.stdout, /PROPOSER/);
  assert.match(cli.stdout, /n'envoie rien/);

  // sans différence : aucun fichier écrit, code 0
  const rien = join(dossier, 'rien.json');
  const identique = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--avant', avant, '--apres', avant, '--lot', rien, '--titre', 'Rien'], { encoding: 'utf8' });
  assert.equal(identique.status, 0, identique.stderr);
  assert.equal(existsSync(rien), false);

  // aucune option d'envoi, des options manquantes
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--envoyer'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--apres', apres], { encoding: 'utf8' }).status, 2);
});
