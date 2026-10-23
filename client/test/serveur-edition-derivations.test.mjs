// Édition depuis le site de dev (client/serveur/edition.mjs) : ce qu'une modification recalcule ailleurs dans la base, d'après les défauts relevés par
// les essais de vraies modifications — magies innées d'une race à liste d'onglet (ordre de l'onglet gardé, aucune contrainte heurtée), altérations
// d'état d'un sort refaites quand une case change (lib/sort-etats.mjs), nom d'un sort suivi par les créatures qui le citent, case diagonale d'un
// peuple créé, ordre de rejeu de lots enregistrés dans la même seconde.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { donneesDeRace, ECHELLE_MEME_PEUPLE, enregistrer as enregistrerLot } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte, nouveauLot, rejouer } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-derivations');
const vivante = (nom) => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, nom) }).chemin);
const db = vivante('db');
const service = { base: () => db, etat: () => ({}), edition: true };
const enregistrer = (operations, page = 'x/') =>
  traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page, operations }) }, service);
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
/** Un nom qu'aucune ligne de la table ne porte encore (les essais du site peuvent avoir créé « Lycan »…). */
const nomLibre = (table, base) => {
  for (let i = 1; ; i += 1) {
    const nom = i === 1 ? base : `${base} ${i}`;
    if (!ligne(`SELECT 1 FROM "${table}" WHERE nom = ?`, nom)) return nom;
  }
};

test('magies innées d’une race à liste d’onglet : la liste actuelle réenregistrée ne change rien (200), dans l’ordre des magies comme dans celui de l’onglet', () => {
  const races = lignes('SELECT DISTINCT race_id FROM race_magie_onglet ORDER BY race_id').map((r) => r.race_id);
  assert.ok(races.length >= 14, `${races.length} races à liste d’onglet`);
  for (const race of races) {
    const avant = lignes('SELECT * FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', race);
    const page = ligne('SELECT donnees FROM page WHERE id = ?', race).donnees;
    // ce que la page envoie (lib : donneesDeRace, ordre des magies), puis l'ordre de l'onglet
    for (const magies of [donneesDeRace(db, race).magiesInnees.ids, avant.map((l) => l.magie_id)]) {
      const r = enregistrer([{ op: 'magies_innees', race, magies }]);
      assert.equal(r.statut, 200, `${race} : ${JSON.stringify(r.corps)}`);
      assert.equal(r.corps.modifications, 0, `${race} : rien ne change`);
    }
    assert.deepEqual(lignes('SELECT * FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', race), avant, race);
    assert.equal(ligne('SELECT donnees FROM page WHERE id = ?', race).donnees, page, `${race} : page inchangée, octet pour octet`);
  }
});

test('magies innées : une magie retirée et une ajoutée gardent l’ordre de l’onglet (rang conservé, la nouvelle à la fin) ; la page suit dans l’ordre des magies', () => {
  const race = ligne("SELECT race_id FROM race_magie_onglet GROUP BY race_id HAVING count(*) = 3 ORDER BY race_id LIMIT 1").race_id;
  const avant = lignes('SELECT magie_id, rang FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', race);
  const retiree = avant[1].magie_id;
  const ajoutee = ligne('SELECT id FROM magie WHERE id NOT IN (SELECT magie_id FROM race_magie_onglet WHERE race_id = ?) ORDER BY ordre LIMIT 1', race).id;
  const voulues = [ajoutee, ...avant.filter((m) => m.magie_id !== retiree).map((m) => m.magie_id)];
  const r = enregistrer([{ op: 'magies_innees', race, magies: voulues }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(lignes('SELECT magie_id, rang FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', race), [
    { magie_id: avant[0].magie_id, rang: avant[0].rang }, { magie_id: avant[2].magie_id, rang: avant[2].rang }, { magie_id: ajoutee, rang: avant[2].rang + 1 },
  ]);
  const ordre = lignes('SELECT nom FROM magie WHERE id IN (?, ?, ?) ORDER BY ordre', ...voulues).map((m) => m.nom);
  assert.deepEqual(JSON.parse(ligne('SELECT donnees FROM page WHERE id = ?', race).donnees).magies_innees, ordre);
  // la magie retirée revient : à la fin de l'onglet
  assert.equal(enregistrer([{ op: 'magies_innees', race, magies: [...voulues, retiree] }]).statut, 200);
  assert.deepEqual(lignes('SELECT magie_id FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', race).map((m) => m.magie_id),
    [avant[0].magie_id, avant[2].magie_id, ajoutee, retiree]);
});

test('altérations d’état : « Inflige gel 1 » devenu « Inflige gel 2 » donne la ligne (gel, inflige, 2) ; une tournure ajoutée est retenue, une retirée part', () => {
  const sort = 'magies/magie-de-la-glace#sort:souffle-glacial';
  const gel = 'guide/liste-des-alterations-d-etat#etat:gel';
  const effets = ligne('SELECT effets FROM sort WHERE id = ?', sort).effets;
  assert.match(effets, /Inflige gel 1\./);
  const r = enregistrer([{ op: 'modifier', table: 'sort', cle: { id: sort }, valeurs: { effets: effets.replace('Inflige gel 1.', 'Inflige gel 2.') } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(lignes('SELECT etat_id, relation, rang, stade, champ, forme_trouvee, extrait FROM sort_etat WHERE sort_id = ?', sort),
    [{ etat_id: gel, relation: 'inflige', rang: 1, stade: 2, champ: 'effets', forme_trouvee: 'gel', extrait: 'Si jet de vigueur raté = Inflige gel 2.' }]);

  const r2 = enregistrer([{ op: 'modifier', table: 'sort', cle: { id: sort }, valeurs: { effets: 'Si jet de vigueur raté = Inflige gel 2. 3NM = Permet de soigner "Brûlure 1" et confusion.' } }]);
  assert.equal(r2.statut, 200, JSON.stringify(r2.corps));
  assert.deepEqual(lignes('SELECT etat_id, relation, stade FROM sort_etat WHERE sort_id = ? ORDER BY relation, etat_id', sort).map((l) => [l.etat_id.split(':')[1], l.relation, l.stade]),
    [['gel', 'inflige', 2], ['brulure', 'soigne', 1], ['confusion', 'soigne', null]]);
  const ligneEtat = ligne("SELECT origine, source_ref FROM sort_etat WHERE sort_id = ? AND relation = 'soigne' LIMIT 1", sort);
  assert.deepEqual({ ...ligneEtat }, { origine: 'magies', source_ref: ligne('SELECT source_ref FROM sort WHERE id = ?', sort).source_ref });
  assert.equal(enregistrer([{ op: 'modifier', table: 'sort', cle: { id: sort }, valeurs: { effets: 'Gèle la cible.' } }]).statut, 200);
  assert.equal(ligne('SELECT count(*) AS n FROM sort_etat WHERE sort_id = ?', sort).n, 0, '« Gèle » n’est pas une tournure retenue');
});

test('altérations d’état : seules les cases modifiées sont relues ; le rang de chaque altération est recompté dans l’ordre des cases', () => {
  // Regard ardent : brûlure 1 puis brûlure 2 dans ses effets ; une brûlure écrite dans sa case D/S/B (lue avant les effets) passe au rang 1
  const sort = 'magies/magie-du-feu#sort:regard-ardent';
  const effetsAvant = lignes("SELECT stade, forme_trouvee, extrait FROM sort_etat WHERE sort_id = ? AND champ = 'effets' ORDER BY rang", sort);
  assert.equal(effetsAvant.length, 2);
  const r = enregistrer([{ op: 'modifier', table: 'sort', cle: { id: sort }, valeurs: { dsb_brut: 'Inflige brûlure stade 3' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = lignes('SELECT rang, stade, champ, forme_trouvee, extrait FROM sort_etat WHERE sort_id = ? ORDER BY rang', sort);
  assert.deepEqual(apres.map((l) => [l.rang, l.champ, l.stade]), [[1, 'dsb', 3], [2, 'effets', 1], [3, 'effets', 2]]);
  assert.deepEqual(apres.slice(1).map(({ stade, forme_trouvee, extrait }) => ({ stade, forme_trouvee, extrait })), effetsAvant);
  // Rayon négatif : ses lignes gardent leur écriture d'import (espaces insécables) tant que sa case Effets n'est pas modifiée
  const rayon = 'magies/magie-de-lombre#sort:rayon-negatif';
  const etats = lignes('SELECT * FROM sort_etat WHERE sort_id = ? ORDER BY etat_id', rayon);
  assert.equal(enregistrer([{ op: 'modifier', table: 'sort', cle: { id: rayon }, valeurs: { cout_brut: '25' } }]).statut, 200);
  assert.deepEqual(lignes('SELECT * FROM sort_etat WHERE sort_id = ? ORDER BY etat_id', rayon), etats);
});

test('sort renommé : les panneaux « Effet "…" » des créatures qui le citent suivent (nom, libellé) ; invariant creature_effet.nom = sort.nom', () => {
  const sort = ligne('SELECT s.id, s.nom FROM sort s JOIN creature_effet e ON e.sort_id = s.id GROUP BY s.id ORDER BY count(*) DESC LIMIT 1');
  const nouveau = `${sort.nom} renouvelé`;
  const r = enregistrer([{ op: 'modifier', table: 'sort', cle: { id: sort.id }, valeurs: { nom: nouveau } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const effets = lignes('SELECT nom, libelle FROM creature_effet WHERE sort_id = ?', sort.id);
  assert.ok(effets.length >= 1);
  for (const e of effets) {
    assert.equal(e.nom, nouveau);
    assert.equal(e.libelle, `Effet "${nouveau}"`);
  }
  assert.ok(r.corps.lignes.some((l) => l.table === 'creature_effet'), 'notées au journal');
  assert.deepEqual(lignes('SELECT e.creature_id, e.rang FROM creature_effet e JOIN sort s ON s.id = e.sort_id WHERE e.nom <> s.nom'), []);
});

test('peuple créé (avec une race, ou seul) : il a sa case diagonale « Même peuple » ; chaque peuple de la base a la sienne', () => {
  const nomRace = nomLibre('race', 'Race d’essai');
  const r = enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: nomRace, nature: 'pure' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const nomPeuple = nomLibre('peuple', 'Peuple d’essai');
  const p = enregistrer([{ op: 'creer', entite: 'peuple', valeurs: { nom: nomPeuple, race_id: r.corps.crees[0].id } }]);
  assert.equal(p.statut, 200, JSON.stringify(p.corps));
  assert.ok(ligne('SELECT 1 FROM echelle_relation WHERE id = ?', ECHELLE_MEME_PEUPLE));
  for (const nom of [nomRace, nomPeuple]) {
    const id = ligne('SELECT id FROM peuple WHERE nom = ?', nom).id;
    assert.equal(ligne('SELECT echelle_id FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id = ?', id, id)?.echelle_id, ECHELLE_MEME_PEUPLE, nom);
  }
  assert.deepEqual(lignes(`SELECT p.id FROM peuple p WHERE NOT EXISTS (SELECT 1 FROM relation_peuple r WHERE r.ligne_peuple_id = p.id AND r.colonne_peuple_id = p.id
    AND r.echelle_id = ?)`, ECHELLE_MEME_PEUPLE), []);
  assert.deepEqual(lignes('SELECT ligne_peuple_id FROM relation_peuple WHERE echelle_id = ? AND ligne_peuple_id <> colonne_peuple_id', ECHELLE_MEME_PEUPLE), [],
    '« Même peuple » : seulement sur la diagonale');
});

test('lots de la même seconde : identifiants qui s’ordonnent comme leur enregistrement ; rejoués dans cet ordre sur des règles neuves', () => {
  // une seconde plus tard que tout lot déjà fait dans ce processus (nouveauLot ne redescend jamais : une date fixe échouerait une fois passée)
  const seconde = Math.ceil((Date.now() + 86_400_000) / 1000) * 1000;
  const date = new Date(seconde + 345);
  const ids = Array.from({ length: 5 }, () => nouveauLot(date));
  const attendu = new Date(seconde).toISOString().replace(/\.\d{3}Z$/, 'Z');
  assert.ok(ids.every((l) => l.instant === attendu), 'instant à la seconde (CHECK de modification_lot.fait_le)');
  assert.ok(ids.every((l) => l.id.startsWith(new Date(seconde + 345).toISOString())), 'identifiant : l’instant à la milliseconde');
  assert.deepEqual(ids.map((l) => l.id), [...ids.map((l) => l.id)].sort(), 'triés comme créés');
  assert.equal(new Set(ids.map((l) => l.id)).size, 5);
  assert.ok(nouveauLot(new Date(seconde)).id > ids[4].id, 'une horloge qui recule ne fait pas passer un lot avant les précédents');

  // trente lots dans la même seconde, chacun réécrit le même champ : seul l'ordre d'enregistrement donne la bonne valeur finale
  const source = vivante('db-source');
  const instant = '2026-10-11T10:00:00Z';
  const valeurs = Array.from({ length: 30 }, (_, i) => `+${i + 1}% Arme lourde`);
  for (const v of valeurs) {
    enregistrerLot(source, { page: 'metiers/', operations: [{ op: 'modifier', table: 'metier', cle: { id: 'metiers/forgeron' }, valeurs: { bonus_brut: v } }] }, { instant });
  }
  const journal = journalExporte(source);
  source.close();
  assert.equal(journal.lots.length, 30);
  assert.deepEqual(journal.lots.map((l) => l.modifications.find((m) => m.table === 'metier').apres.bonus_brut), valeurs, 'journal exporté dans l’ordre');
  const cible = vivante('db-cible');
  cible.exec('BEGIN');
  chargerJournal(cible, journal);
  const bilan = rejouer(cible);
  cible.exec('COMMIT');
  assert.equal(bilan.conflits, 0, JSON.stringify(bilan));
  assert.equal(cible.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut, valeurs.at(-1));
  cible.close();
});
