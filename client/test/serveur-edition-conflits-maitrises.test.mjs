// La résolution d'un lot en conflit (serveur/edition-conflits.mjs, page « Mise à jour ») et les sources de maîtrise d'arme (décisions R148 à R151, R154 ;
// migration 0074) : maitrise_arme_part, maitrise_arme_part_famille et capacite_nm_gagne restent celles que le lecteur de lib/maitrise-arme.mjs tire de
// toute la base, quel que soit le choix (1, 2 ou 3) sur une ligne de classe_maitrise_arme ou l'effet d'un don. Les lignes de ces tables notées dans un
// lot ne sont jamais rejouées telles quelles, ni montrées comme des conflits : elles suivent leur source, refaite par le lecteur après les choix et
// notée dans le nouveau lot (edition-maitrises.mjs#sourcesRefaitesParLaResolution) ; un don supprimé perd les siennes avant lui, au journal
// (sourcesAvantLaSuppression). Le scénario : une base vivante, ses lots écrits par le vrai service d'édition (dont un noté comme avant 0074, sans ses
// parts), puis des règles livrées qui changent les mêmes lignes autrement, écrites par le même service sur une autre base et recopiées table par table.
import assert from 'node:assert/strict';
import { copyFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { conflitsDuJournal, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { TABLES_DES_SOURCES } from '../serveur/edition-maitrises.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { idDeSourceDeClasse } from '../src/lib/maitrise-arme.mjs';
import { sourcesEtLecteur, sourcesJustes } from './aide-maitrise-arme.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-conflits-maitrises-'));
const ouvertes = [];
after(() => {
  for (const b of ouvertes) if (b.isOpen) b.close();
  rmSync(racine, { recursive: true, force: true });
});
let compteur = 0;
const chemin = (nom) => join(racine, `${nom}-${(compteur += 1)}`);
const q = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const partsDe = (db, sourceId) => q(db, 'SELECT rang, genre, points, arme_famille_id, limite_famille FROM maitrise_arme_part WHERE source_id = ? ORDER BY rang', sourceId);
const nmDe = (db, id) => q(db, 'SELECT nm FROM capacite_nm_gagne WHERE capacite_id = ?', id).map((l) => l.nm);

const GUERRIER = 'classes/guerrier';
const ARCHER = 'classes/archer';
/** Version 1 (le site de dev), version 2 (les règles livrées), valeur saisie (choix 3). */
const TEXTES = {
  classe: {
    1: '- 1 maîtrise Hache\n- 1 maîtrise arme contact au choix (sauf Hache)\n- 1 maîtrise Arc',
    2: '- 1 maîtrise Dague\n- 1 maîtrise arme contact au choix (sauf Dague)',
    3: '- 1 maîtrise Épée\n- 1 maîtrise arme contact au choix (sauf Épée)\n- 2 maîtrises à répartir (1 maximum dans une seule)',
  },
  effet: {
    1: '+2 points de maîtrise Arcs.',
    2: '+1 maîtrise Dague, Gagne 1 niveau de maîtrise (NM).',
    3: 'Gagne 3 niveaux de maîtrise (NM), +1 point de maîtrise d’arme à distance au choix.',
  },
  // un don créé des deux côtés (même classe, même nom : même id)
  double: { 1: '+2 points de maîtrise Arcs.', 2: '+1 maîtrise Dague, +1 point de maîtrise à répartir.' },
};
const AUTRE_SITE = '- 1 maîtrise Hache\n- 1 maîtrise Arc';
const AUTRE_REGLES = '- 1 maîtrise Dague';
const CREE = { nom: 'Essai de conflit', effet: '+2 points de maîtrise Arcs, Gagne 2 niveaux de maîtrise (NM).' };
const SUPPRIME = { nom: 'Essai supprimé', effet: '+1 maîtrise Dague, Gagne 1 niveau de maîtrise (NM).' };
const DOUBLE = 'Essai double';
const creation = (classeId, nom, effet) => ({ op: 'creer', entite: 'capacite', valeurs: { classe_id: classeId, niveau: '20', nom, type: 'Passif', effet } });
const maitrises = (classeId, texte) => ({ op: 'modifier', table: 'classe', cle: { id: classeId }, valeurs: { maitrise_arme: texte } });
const effet = (id, texte) => ({ op: 'modifier', table: 'capacite', cle: { id }, valeurs: { effet: texte } });

/** Les règles livrées : `r0` plus ce que le service écrit sur une autre base (`lots` : [page, opérations]), recopié table par table. */
function reglesLivrees(r0, lots) {
  const dossier = chemin('regles-vivante');
  const rv = ouvrirBaseVivante(preparerBaseVivante({ regles: r0, dossier }).chemin);
  for (const [page, operations] of lots) enregistrer(rv, { page, operations });
  const tables = q(rv, 'SELECT DISTINCT table_nom AS t FROM modification ORDER BY t').map((l) => l.t);
  rv.close();
  const r1 = `${chemin('regles')}.db`;
  copyFileSync(r0, r1);
  const regles = new DatabaseSync(r1);
  regles.exec('PRAGMA foreign_keys = OFF');
  regles.prepare('ATTACH DATABASE ? AS rv').run(join(dossier, FICHIER_BASE));
  const connues = new Set(q(regles, "SELECT name FROM sqlite_master WHERE type = 'table'").map((t) => t.name));
  for (const t of tables) {
    assert.ok(connues.has(t), t); // un nom de table vérifié avant d'être écrit dans la requête
    regles.exec(`DELETE FROM main."${t}"; INSERT INTO main."${t}" SELECT * FROM rv."${t}";`);
  }
  regles.exec('DETACH DATABASE rv');
  assert.deepEqual(regles.prepare('PRAGMA foreign_key_check').all(), [], 'les règles livrées sont saines');
  sourcesJustes(regles, 'les sources des règles livrées sont celles du lecteur');
  regles.close();
  return r1;
}

const S = {};
before(() => {
  const r0 = `${chemin('regles')}.db`;
  copyFileSync(cheminBase({ sansExemples: false }), r0);
  S.dossier = chemin('dev');
  const dev = ouvrirBaseVivante(preparerBaseVivante({ regles: r0, dossier: S.dossier }).chemin);
  // un don des règles qui a une part imposée ; une autre classe, avec des maîtrises, dont aucun don ne suit la maîtrise au choix (R151)
  S.don = q(dev, "SELECT capacite_id AS id FROM maitrise_arme_part WHERE capacite_id IS NOT NULL AND genre = 'imposee' ORDER BY capacite_id LIMIT 1")[0].id;
  S.autre = q(dev, `SELECT c.id FROM classe c WHERE c.id NOT IN (?, ?) AND EXISTS (SELECT 1 FROM classe_maitrise_arme l WHERE l.classe_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM maitrise_arme_part m JOIN capacite k ON k.id = m.capacite_id WHERE m.genre = 'suit' AND k.classe_id = c.id)
    ORDER BY c.id LIMIT 1`, GUERRIER, ARCHER)[0].id;
  for (const nom of [CREE.nom, SUPPRIME.nom]) assert.equal(q(dev, 'SELECT 1 FROM capacite WHERE classe_id = ? AND nom = ?', S.autre, nom).length, 0, nom);
  assert.equal(q(dev, 'SELECT 1 FROM capacite WHERE classe_id = ? AND nom = ?', ARCHER, DOUBLE).length, 0, DOUBLE);
  const lot = (page, operations) => enregistrer(dev, { page, operations });
  // notés depuis 0074 (avec leurs parts) : les maîtrises d'une classe, l'effet d'un don, un don créé (que les règles créent aussi)
  S.classe = lot(GUERRIER, [maitrises(GUERRIER, TEXTES.classe[1])]).lot;
  S.effet = lot(S.don, [effet(S.don, TEXTES.effet[1])]).lot;
  S.double = lot(ARCHER, [creation(ARCHER, DOUBLE, TEXTES.double[1])]).lot;
  // un don créé (sain au rejeu), puis un lot noté comme avant 0074 (sans ses parts) : un don créé, le premier supprimé, les maîtrises de la classe
  S.supprime = lot(S.autre, [creation(S.autre, SUPPRIME.nom, SUPPRIME.effet)]).crees[0].id;
  const ancien = lot(S.autre, [creation(S.autre, CREE.nom, CREE.effet), { op: 'supprimer', entite: 'capacite', cle: { id: S.supprime } }, maitrises(S.autre, AUTRE_SITE)]);
  S.ancien = ancien.lot;
  S.cree = ancien.crees[0].id;
  const retirees = dev.prepare(`DELETE FROM modification WHERE lot_id = ? AND table_nom IN (${TABLES_DES_SOURCES.map(() => '?').join(', ')})`).run(S.ancien, ...TABLES_DES_SOURCES);
  assert.ok(retirees.changes > 0, 'le lot notait des parts, retirées comme avant 0074');
  dev.close();
  S.regles = reglesLivrees(r0, [
    [GUERRIER, [maitrises(GUERRIER, TEXTES.classe[2])]],
    [S.don, [effet(S.don, TEXTES.effet[2])]],
    [ARCHER, [creation(ARCHER, DOUBLE, TEXTES.double[2])]],
    [S.autre, [maitrises(S.autre, AUTRE_REGLES)]],
  ]);
  const { rejeu } = preparerBaseVivante({ regles: S.regles, dossier: S.dossier });
  assert.equal(rejeu.lots, 5);
  assert.equal(rejeu.appliquees > 0, true, 'le don créé seul passe');
});

/** Une copie de la base vivante du scénario. */
function copie() {
  const dossier = chemin('copie');
  cpSync(S.dossier, dossier, { recursive: true });
  const db = ouvrirBaseVivante(join(dossier, FICHIER_BASE));
  ouvertes.push(db);
  return db;
}
const lotsEnConflit = () => [S.classe, S.effet, S.double, S.ancien];

test('diagnostic : les lignes des sources de maîtrise d’arme d’un lot ne sont ni des conflits ni des modifications saines, elles suivent leur source', () => {
  const db = copie();
  const lots = conflitsDuJournal(db).lots;
  assert.deepEqual(lots.map((l) => l.lot).sort(), lotsEnConflit().sort());
  for (const l of lots) {
    for (const x of [...l.conflits, ...l.saines]) assert.ok(!TABLES_DES_SOURCES.includes(x.table), `${l.lot} : ${x.table} ${JSON.stringify(x.cle)}`);
  }
  const champ = (id, table, colonne) => lots.find((l) => l.lot === id).conflits.find((c) => c.table === table && c.colonne === colonne);
  assert.deepEqual(champ(S.classe, 'classe', 'maitrise_arme').choix_possibles, [1, 2, 3]);
  assert.deepEqual(champ(S.effet, 'capacite', 'effet').choix_possibles, [1, 2, 3]);
  assert.deepEqual(champ(S.ancien, 'classe', 'maitrise_arme').choix_possibles, [1, 2, 3]);
  assert.equal(lots.find((l) => l.lot === S.double).conflits.find((c) => c.table === 'capacite').genre, 'insertion');
});

/**
 * Résout les quatre lots dans une copie : `n` sur les champs du modèle et sur l'insertion du don (2 quand ce choix n'y est pas), `autres` sur les lignes
 * de classe_maitrise_arme (hors du modèle : au choix 1, la version du site de dev recopiée telle quelle). Les sources sont justes après chaque lot.
 */
function resoudreTout(n, autres) {
  const db = copie();
  const nouveaux = [];
  for (const id of lotsEnConflit()) {
    const d = conflitsDuJournal(db).lots.find((l) => l.lot === id);
    const choix = Object.fromEntries(d.conflits.map((c) => {
      const voulu = c.genre === 'champ' || c.genre === 'insertion' ? n : autres;
      const k = c.choix_possibles.includes(voulu) ? voulu : 2;
      return [c.id, { choix: k, ...(k === 3 ? { valeur: c.table === 'classe' ? TEXTES.classe[3] : TEXTES.effet[3] } : {}) }];
    }));
    const r = resoudreLeConflit(db, { lot: id, empreinte: d.empreinte, choix });
    if (r.nouveau_lot) nouveaux.push(r.nouveau_lot);
    sourcesJustes(db, `choix ${n} (autres ${autres}), après le lot ${id}`);
  }
  return { db, nouveaux };
}

for (const n of [1, 2, 3]) {
  test(`résolution au choix ${n} (maîtrises d’une classe, effet d’un don, don créé des deux côtés, lot noté avant 0074) : les sources sont celles du lecteur (R148 à R151, R154)`, () => {
    for (const autres of [1, 2]) {
      const { db, nouveaux } = resoudreTout(n, autres);
      assert.equal(q(db, 'SELECT maitrise_arme FROM classe WHERE id = ?', GUERRIER)[0].maitrise_arme, TEXTES.classe[n]);
      assert.equal(q(db, 'SELECT effet FROM capacite WHERE id = ?', S.don)[0].effet, TEXTES.effet[n]);
      // la ligne de classe que le site de dev ajoutait (n° 3) : une part imposée au choix 1, aucune au choix 2, une part à répartir au choix 3
      assert.deepEqual(partsDe(db, idDeSourceDeClasse(GUERRIER, 3)).map((p) => [p.genre, p.arme_famille_id]), { 1: [['imposee', 'arc']], 2: [], 3: [['choix', null]] }[n],
        `autres ${autres}`);
      assert.deepEqual(nmDe(db, S.don), { 1: [], 2: [1], 3: [3] }[n], 'les NM gagnés de l’effet gardé (R154)');
      // le don créé des deux côtés : les parts de l'effet gardé (le site de dev au choix 1, sinon les règles), sans mélange des deux
      const double = q(db, 'SELECT id, effet FROM capacite WHERE classe_id = ? AND nom = ?', ARCHER, DOUBLE)[0];
      assert.equal(double.effet, TEXTES.double[n === 1 ? 1 : 2]);
      assert.deepEqual(partsDe(db, double.id).map((p) => p.genre), n === 1 ? ['imposee'] : ['imposee', 'choix']);
      // le lot noté avant 0074 : le don qu'il crée reçoit ses parts et ses NM, celui qu'il supprime n'en laisse aucune
      assert.deepEqual(partsDe(db, S.cree), [{ rang: 1, genre: 'imposee', points: 2, arme_famille_id: 'arc', limite_famille: null }]);
      assert.deepEqual(nmDe(db, S.cree), [2]);
      assert.equal(q(db, 'SELECT 1 FROM capacite WHERE id = ?', S.supprime).length, 0);
      assert.deepEqual([partsDe(db, S.supprime), nmDe(db, S.supprime)], [[], []]);
      // notées dans les nouveaux lots (livrés par la mise à jour suivante), et retirées avant le don supprimé (pas par la cascade du schéma)
      const journal = q(db, `SELECT table_nom, operation, cle FROM modification WHERE lot_id IN (${nouveaux.map(() => '?').join(', ')}) ORDER BY lot_id, rang`, ...nouveaux);
      const rang = (table, operation, id) => journal.findIndex((m) => m.table_nom === table && m.operation === operation && Object.values(JSON.parse(m.cle)).includes(id));
      assert.ok(rang('maitrise_arme_part', 'inserer', S.cree) >= 0 && rang('capacite_nm_gagne', 'inserer', S.cree) >= 0, 'les sources du don créé, au journal');
      for (const t of ['maitrise_arme_part', 'capacite_nm_gagne']) {
        assert.ok(rang(t, 'supprimer', S.supprime) >= 0 && rang(t, 'supprimer', S.supprime) < rang('capacite', 'supprimer', S.supprime), `${t} retirée avant le don, au journal`);
      }
    }
  });
}

test('les lots de la résolution se rejouent sans conflit sur les règles livrées, et y laissent les mêmes sources, justes', () => {
  const { db } = resoudreTout(1, 1);
  const attendu = sourcesEtLecteur(db).tables;
  const neuve = ouvrirBaseVivante(preparerBaseVivante({ regles: S.regles, dossier: chemin('relivree') }).chemin);
  ouvertes.push(neuve);
  const lots = q(db, "SELECT * FROM modification_lot l WHERE EXISTS (SELECT 1 FROM modification m WHERE m.lot_id = l.id AND m.etat = 'en_attente') ORDER BY fait_le, id");
  assert.ok(lots.length >= 5, 'le don créé seul et les quatre résolutions');
  for (const l of lots) {
    neuve.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of q(db, "SELECT * FROM modification WHERE etat = 'en_attente' ORDER BY lot_id, rang")) {
    neuve.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', NULL, ?)")
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.apercu);
  }
  // rejoué clés coupées, comme base-vivante.mjs#transferer
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  assert.equal(bilan.conflits, 0, JSON.stringify(q(neuve, "SELECT detail FROM modification WHERE etat = 'conflit'")));
  assert.deepEqual(sourcesEtLecteur(neuve).tables, attendu);
  sourcesJustes(neuve);
});

test('maîtrise illisible (« Refuser à la saisie », choix du propriétaire du 2026-10-23) : un lot déjà noté qui en écrit une s’examine sans planter (choix 1 retiré, la raison citée) ; une saisie illisible au choix 3 est refusée ; le choix 2 passe', () => {
  const db = copie();
  // le lot de l'effet du don, tel qu'un site de dev d'avant le refus l'aurait noté
  const n = db.prepare('UPDATE modification SET apres = replace(apres, ?, ?) WHERE lot_id = ? AND table_nom = ?')
    .run(TEXTES.effet[1], '+2 points de maîtrise Truc.', S.effet, 'capacite').changes;
  assert.equal(n, 1);
  const d = conflitsDuJournal(db).lots.find((l) => l.lot === S.effet);
  const c = d.conflits.find((x) => x.table === 'capacite' && x.colonne === 'effet');
  assert.deepEqual(c.choix_possibles, [2, 3]);
  assert.match(c.refus_1, /Maîtrise illisible dans « \+2 points de maîtrise Truc »/);
  const avant = sourcesEtLecteur(db).tables;
  assert.throws(() => resoudreLeConflit(db, { lot: S.effet, empreinte: d.empreinte, choix: { [c.id]: { choix: 3, valeur: '+1 maîtrise Truc.' } } }),
    (e) => e.statut === 409 && /Maîtrise illisible dans « \+1 maîtrise Truc »/.test(e.message));
  assert.deepEqual(sourcesEtLecteur(db).tables, avant, 'rien n’est écrit');
  resoudreLeConflit(db, { lot: S.effet, empreinte: d.empreinte, choix: { [c.id]: { choix: 2 } } });
  assert.equal(q(db, 'SELECT effet FROM capacite WHERE id = ?', S.don)[0].effet, TEXTES.effet[2]);
  sourcesJustes(db);
});
