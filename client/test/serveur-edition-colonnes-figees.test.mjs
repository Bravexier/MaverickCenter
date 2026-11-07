// Une colonne que le site de dev a modifiée un temps, puis qu'un choix du propriétaire a figée (sortie de TABLES) : le nom d'une monnaie (réponse du
// propriétaire : « Figer les noms », R193). Le service la refuse (test/serveur-edition-composants.test.mjs) ; un lot du journal noté avant ce choix qui la
// réécrit est en conflit au rejeu, avec sa raison, et n'a que le choix 2 sur la page « Mise à jour » (serveur/edition.mjs#ecrituresFigees) ; une valeur
// déjà dans les règles passe. Les noms et valeurs viennent de la base (lus par id), jamais écrits ici.
//   node --test test/serveur-edition-colonnes-figees.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { COLONNES_FIGEES, ecrituresFigees, rejouerLeJournal } from '../serveur/edition.mjs';
import { examinerLeLot } from '../serveur/edition-conflits.mjs';
import { chargerJournal, nouveauLot } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { MONNAIES_DU_JEU } from '../src/lib/monnaies.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const dossier = dossierTemporaire('colonnes-figees');
let n = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(dossier, `b${(n += 1)}`) }).chemin);

test('COLONNES_FIGEES : aucune n’est modifiable (TABLES) ; le nom d’une monnaie se donne à sa création seulement', () => {
  for (const [table, colonnes] of Object.entries(COLONNES_FIGEES)) {
    for (const c of Object.keys(colonnes)) assert.ok(!TABLES[table]?.colonnes[c], `${table}.${c}`);
  }
  assert.deepEqual(Object.keys(COLONNES_FIGEES.monnaie), ['nom']);
  assert.equal(ENTITES.monnaie.champs.nom.requis, true);
});

test('adaptateur : une écriture sur une colonne figée est une forme ancienne sans équivalent (`conflit`) ; une valeur déjà là, une insertion, une autre colonne passent', () => {
  const db = vivante();
  try {
    const adapter = ecrituresFigees(db);
    const m = (operation, cle, avant, apres) => ({ lot_id: 'l', rang: 1, table_nom: 'monnaie', operation, cle: JSON.stringify(cle),
      avant: avant && JSON.stringify(avant), apres: apres && JSON.stringify(apres) });
    const ro = db.prepare("SELECT * FROM monnaie WHERE id = 'ro'").get();
    const renomme = adapter(m('modifier', { id: 'ro' }, { nom: ro.nom }, { nom: `${ro.nom} taillé` }));
    assert.equal(renomme.conflit, COLONNES_FIGEES.monnaie.nom);
    for (const tel of [
      m('modifier', { id: 'ro' }, { nom: `${ro.nom} taillé` }, { nom: ro.nom }), // les règles ont déjà ce nom
      m('modifier', { id: 'ro' }, { abreviation: 'X' }, { abreviation: 'Y' }), // une autre colonne
      m('inserer', { id: 'ra' }, null, { id: 'ra', nom: 'Essai', abreviation: 'RA', valeur_rf: 10 }), // une création : son nom se donne alors
    ]) assert.equal(adapter(tel), tel);
  } finally {
    db.close();
  }
});

test('rejeu (service, mise à jour, db:appliquer-edition) : un lot qui renomme une monnaie est en conflit, rien n’en est écrit ; sur la page « Mise à jour », seul le choix 2', () => {
  const db = vivante();
  try {
    const avant = Object.fromEntries(db.prepare('SELECT id, nom FROM monnaie').all().map((m) => [m.id, m.nom]));
    const pp = MONNAIES_DU_JEU.PP.id;
    const renomme = nouveauLot();
    const deja = nouveauLot();
    const journal = {
      format: 'maverick-edition/1',
      lots: [
        { id: renomme.id, fait_le: renomme.instant, page_id: 'ressources/composants', resume: 'Monnaie renommée', modifications: [
          { rang: 1, table: 'monnaie', cle: { id: pp }, operation: 'modifier', avant: { nom: avant[pp] }, apres: { nom: `${avant[pp]} taillée` } },
        ] },
        // un lot qui écrit le nom que les règles ont déjà : « intégré »
        { id: deja.id, fait_le: deja.instant, page_id: 'ressources/composants', resume: 'Monnaie déjà nommée', modifications: [
          { rang: 1, table: 'monnaie', cle: { id: 'rf' }, operation: 'modifier', avant: { nom: `${avant.rf} ancien` }, apres: { nom: avant.rf } },
        ] },
      ],
    };
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, journal);
    const bilan = rejouerLeJournal(db);
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    assert.equal(bilan.conflits, 1);
    const etat = (lot) => db.prepare('SELECT etat, detail FROM modification WHERE lot_id = ?').get(lot);
    assert.equal(etat(renomme.id).etat, 'conflit');
    assert.ok(etat(renomme.id).detail.includes(COLONNES_FIGEES.monnaie.nom), etat(renomme.id).detail);
    assert.equal(etat(deja.id).etat, 'integree');
    assert.deepEqual(Object.fromEntries(db.prepare('SELECT id, nom FROM monnaie').all().map((m) => [m.id, m.nom])), avant, 'aucun nom n’a changé');
    const diag = examinerLeLot(db, renomme.id);
    assert.equal(diag.conflits.length, 1);
    assert.deepEqual([diag.conflits[0].table, diag.conflits[0].choix_possibles], ['monnaie', [2]]);
  } finally {
    db.close();
  }
});
