// L'adresse d'une page et les lots de changements (décision R316, docs/chantier-adresses.md, §1, §6, choix 8, 9 et 12 ; serveur/edition-adresses.mjs#refusDeLAdresse) :
// aucun lot déposé n'écrit lui-même `page.slug_adresse` ni `page_ancienne_adresse` (refus sans numéro de décision : une session Créateur ne l’ouvre pas) ; un lot qui
// renomme une page passe et l'adresse suit ; l'annuler, en entier ou par une de ses lignes, rend l'état d'avant sans ancienne adresse ; l'annulation est refusée quand
// l'adresse d'avant est reprise, et nomme la page qui la tient ; le journal rejoué donne les mêmes adresses. Les contrôles du contenu (service et db:check) refusent
// deux pages à la même adresse, une ancienne adresse tenue par une page vivante et un segment sur une page à route fixe ; la surcouche des pages ne reçoit pas les
// lignes d'adresse. Petite base de test/aide-ancrage.mjs, noms inventés.
//   node --test test/serveur-edition-adresses-lots.test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { ErreurEdition, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte, lignesEnAttente } from '../serveur/edition-journal.mjs';
import { annuler, annulerUneLigne, decisionsCitees, lire } from '../serveur/edition-lots.mjs';
import { ADRESSES_DES_PAGES_SERVIES } from '../src/lib/equipement.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { adresseDesRegles, idDesRegles, nom, outilsDesCas, photo, poserUnePageDesRegles, refusDuDepot, TOUS_LES_VERROUS } from './aide-adresses-lots.mjs';
import { baseDAncrage, poserCapacite, poserClasse, poserPageLisible } from './aide-ancrage.mjs';

const { cas, deposerDirect, renommerParUnLot, renommerSurLeSite } = outilsDesCas('edition-adresses-lots');

test('R316 : aucun lot n’écrit page.slug_adresse ni une ligne de page_ancienne_adresse (insertion, modification, suppression), session Créateur comprise, et le refus ne cite aucun numéro', () => cas(
  (db) => ({ a: poserUnePageDesRegles(db, nom('un')), b: poserUnePageDesRegles(db, nom('autre')) }),
  async (m) => {
    const { a, b } = m.monde;
    renommerSurLeSite(m, a.id, nom('deux'));
    renommerSurLeSite(m, a.id, nom('trois')); // deux anciennes adresses à viser
    const [une, autre] = [`regles/${normalize(nom('deux'))}/`, `regles/${normalize(nom('un'))}/`];
    const libre = `regles/${normalize(nom('libre'))}/`;
    const avant = photo(m.db);
    assert.deepEqual(avant.anciennes.map((l) => l.adresse), [une, autre]);
    // une ligne par opération : l'essai juge chacune à part, et le refus dit chacune
    const ecritures = [
      { table: 'page', cle: { id: b.id }, operation: 'modifier', avant: { slug_adresse: null }, apres: { slug_adresse: normalize(nom('libre')) } },
      { table: 'page', cle: { id: a.id }, operation: 'modifier', avant: { slug_adresse: normalize(nom('trois')) }, apres: { slug_adresse: null } },
      { table: 'page_ancienne_adresse', cle: { adresse: libre }, operation: 'inserer', apres: { adresse: libre, page_id: b.id } },
      { table: 'page_ancienne_adresse', cle: { adresse: une }, operation: 'modifier', avant: { page_id: a.id }, apres: { page_id: b.id } },
      { table: 'page_ancienne_adresse', cle: { adresse: autre }, operation: 'supprimer', avant: { adresse: autre, page_id: a.id } },
    ];
    for (const [plus, par] of [[{}, 'cle_de_depot'], [{ verrous_ouverts: TOUS_LES_VERROUS }, 'createur']]) {
      const e = await refusDuDepot(deposerDirect(m, ecritures, plus, par));
      const refusees = e.details.motifs.filter((x) => /^opération \d+ : L’adresse d’une page vient de son titre : aucun lot ne l’écrit\.$/.test(x));
      assert.equal(refusees.length, ecritures.length, `${par} : ${JSON.stringify(e.details.motifs)}`);
      assert.deepEqual(decisionsCitees(e.details.motifs.join(' ; ')), [], par);
    }
    assert.deepEqual(photo(m.db), avant, 'rien n’est écrit');
  },
));

test('R316 : un lot qui renomme une page passe et l’adresse suit ; une de ses lignes annulée (elle emporte le groupe de l’adresse) ou le lot entier annulé rendent l’état d’avant sans ancienne adresse ; le journal rejoué donne les mêmes adresses (choix 8 ; un seul cas : la mise en place coûte)', () => cas(
  (db) => ({ ancree: poserUnePageDesRegles(db, nom('un')), seule: poserPageLisible(db, idDesRegles(nom('seule')), nom('seule')) }),
  async (m) => {
    const { ancree: { id, motCle }, seule } = m.monde;
    const depart = photo(m.db);
    const segment = (page) => m.db.prepare('SELECT slug_adresse AS s FROM page WHERE id = ?').get(page).s;

    // une page sans mot-clé : ses deux lignes (la page, l'ancienne adresse) forment un groupe ; annuler la dernière emporte la première
    const lotSeul = await renommerParUnLot(m, seule, nom('seule'), nom('isolee'));
    assert.equal(lotSeul.etat, 'applique', JSON.stringify(lotSeul.refus ?? null));
    assert.equal(segment(seule), normalize(nom('isolee')));
    assert.deepEqual(photo(m.db).anciennes, [{ adresse: `regles/${normalize(nom('seule'))}/`, page_id: seule }]);
    const numeros = lire(m.db, lotSeul.id).lignes.map((l) => l.n);
    assert.equal(numeros.length, 2, 'la page et l’ancienne adresse');
    annulerUneLigne(m.db, lotSeul.id, Math.max(...numeros));
    assert.deepEqual(photo(m.db), depart, 'une ligne annulée : titre, segment d’avant, aucune ancienne adresse');
    assert.deepEqual(lire(m.db, lotSeul.id).lignes.map((l) => l.etat), ['annulee', 'annulee'], 'les deux lignes sont annulées');

    // une page et son mot-clé ancré : le lot entier annulé rend aussi l'adresse du mot-clé
    const lotAncre = await renommerParUnLot(m, id, nom('un'), nom('deux'));
    assert.equal(lotAncre.etat, 'applique', JSON.stringify(lotAncre.refus ?? null));
    assert.equal(segment(id), normalize(nom('deux')));
    assert.equal(lireUnMotCle(m.db, motCle).url, adresseDesRegles(nom('deux')), 'l’adresse du mot-clé se lit sur sa page (migration 0136)');
    assert.deepEqual(photo(m.db).anciennes, [{ adresse: `regles/${normalize(nom('un'))}/`, page_id: id }]);
    // la surcouche des pages ne reçoit pas l'ancienne adresse, mais bien la page renommée
    const enAttente = lignesEnAttente(m.db, { pourLesPages: true });
    assert.ok(!enAttente.some((l) => l.table === 'page_ancienne_adresse'), JSON.stringify(enAttente.map((l) => l.table)));
    assert.ok(enAttente.some((l) => l.table === 'page' && l.cle.id === id));
    annuler(m.db, lotAncre.id);
    assert.deepEqual(photo(m.db), depart, 'le lot entier annulé : titre, segment, mot-clé d’avant, aucune ancienne adresse');

    const reste = await renommerParUnLot(m, id, nom('un'), nom('trois'));
    assert.equal(reste.etat, 'applique', JSON.stringify(reste.refus ?? null));
    const neuve = ouvrirBaseVivante(m.depart);
    try {
      const journal = journalExporte(m.db);
      neuve.exec('PRAGMA foreign_keys = OFF');
      neuve.exec('BEGIN');
      chargerJournal(neuve, journal);
      const bilan = rejouerLeJournal(neuve, {});
      neuve.exec('COMMIT');
      assert.equal(bilan.conflits, 0, JSON.stringify(bilan).slice(0, 2000));
      assert.deepEqual(photo(neuve), photo(m.db), 'segment, anciennes adresses et adresses des mots-clés');
    } finally {
      neuve.close();
    }
  },
));

test('R316 : l’annulation d’un renommage est refusée (409) quand l’adresse d’avant est reprise par une autre page, et nomme cette page (choix 12)', () => cas(
  (db) => {
    // deux dons de la même classe, sans mot-clé : le second peut prendre l'adresse que le premier quitte (une page des Règles ne le peut pas : son titre serait un
    // nom déjà pris ; un mot-clé ancré garderait l'ancienne clé du premier)
    const classe = poserClasse(db, 'classes/zephyrion-mage', nom('Mage'));
    const don = (slug, libelle, rang) => ({ id: poserCapacite(db, `capacites/zephyrion-mage-${slug}`, { classe, nom: libelle, niveau: 5, rang }) });
    return { a: don('zorblat', 'Zorblat', 2), b: don('zorblit', 'Zorblit', 1) };
  },
  async (m) => {
    const { a, b } = m.monde;
    const renommerLeDon = (id, avant, apres) => deposerDirect(m, [{ table: 'capacite', cle: { id }, operation: 'modifier', avant: { nom: avant }, apres: { nom: apres } }]);
    const renomme = await renommerLeDon(a.id, 'Zorblat', 'Zorblot');
    assert.equal(renomme.etat, 'applique', JSON.stringify(renomme.refus ?? null));
    const reprise = await renommerLeDon(b.id, 'Zorblit', 'Zorblat'); // reprend l'adresse quittée par a
    assert.equal(reprise.etat, 'applique', JSON.stringify(reprise.refus ?? null));
    assert.equal(m.db.prepare('SELECT slug_adresse AS s FROM page WHERE id = ?').get(b.id).s, 'zephyrion-mage-zorblat');
    const avant = photo(m.db);
    let refus = null;
    try {
      annuler(m.db, renomme.id);
    } catch (e) {
      refus = e;
    }
    assert.ok(refus instanceof ErreurEdition, String(refus));
    assert.equal(refus.statut, 409, refus.message);
    assert.ok(refus.message.includes(b.id), refus.message);
    assert.ok(refus.message.includes('/capacites/zephyrion-mage-zorblat/'), refus.message);
    assert.deepEqual(photo(m.db), avant, 'rien n’est écrit');
    assert.equal(m.db.prepare('SELECT etat FROM lot_de_changements WHERE id = ?').get(renomme.id).etat, 'applique');
  },
));

test('R316 : les contrôles du contenu refusent deux pages à la même adresse (les deux pages et l’adresse nommées), une ancienne adresse tenue par une page vivante et un segment sur une page à route fixe ; ils se taisent sur la base saine', () => {
  const db = baseDAncrage();
  const a = poserPageLisible(db, idDesRegles(nom('un')), nom('un'));
  const b = poserPageLisible(db, idDesRegles(nom('deux')), nom('deux'));
  const fixe = Object.keys(ADRESSES_DES_PAGES_SERVIES)[0];
  poserPageLisible(db, fixe, nom('fixe'));
  db.prepare('UPDATE page SET slug_adresse = ? WHERE id = ?').run(normalize(nom('trois')), b);
  db.prepare('INSERT INTO page_ancienne_adresse (adresse, page_id) VALUES (?, ?)').run(`regles/${normalize(nom('deux'))}/`, b);
  const nouveaux = (avant) => controlerLeContenu(db).problemes.filter((p) => !avant.includes(p));
  const sains = controlerLeContenu(db).problemes;
  assert.ok(!sains.some((p) => /adresse/.test(p)), JSON.stringify(sains));

  db.prepare('UPDATE page SET slug_adresse = ? WHERE id = ?').run(normalize(nom('un')), b);
  const doublon = nouveaux(sains);
  assert.equal(doublon.length, 1, JSON.stringify(doublon));
  for (const attendu of [a, b, adresseDesRegles(nom('un'))]) assert.ok(doublon[0].includes(attendu), doublon[0]);
  db.prepare('UPDATE page SET slug_adresse = ? WHERE id = ?').run(normalize(nom('trois')), b);

  db.prepare('INSERT INTO page_ancienne_adresse (adresse, page_id) VALUES (?, ?)').run(`regles/${normalize(nom('un'))}/`, b);
  const tenue = nouveaux(sains);
  assert.equal(tenue.length, 1, JSON.stringify(tenue));
  for (const attendu of [a, `regles/${normalize(nom('un'))}/`]) assert.ok(tenue[0].includes(attendu), tenue[0]);
  db.prepare('DELETE FROM page_ancienne_adresse WHERE adresse = ?').run(`regles/${normalize(nom('un'))}/`);

  db.prepare('UPDATE page SET slug_adresse = ? WHERE id = ?').run(normalize(nom('fixe')), fixe);
  const route = nouveaux(sains);
  assert.equal(route.length, 1, JSON.stringify(route));
  assert.ok(route[0].includes(fixe), route[0]);
  db.prepare('UPDATE page SET slug_adresse = NULL WHERE id = ?').run(fixe);

  assert.deepEqual(controlerLeContenu(db).problemes, sains, 'de nouveau saine');
  db.close();
});

test('R316 : la surcouche des pages ne reçoit ni une ligne de page_ancienne_adresse ni une page dont les modifications n’écrivent que slug_adresse (avec mot_cle_id) ; une autre colonne la garde', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE modification_lot (id TEXT PRIMARY KEY, fait_le TEXT, resolu_le TEXT);
    CREATE TABLE modification (lot_id TEXT, rang INTEGER, table_nom TEXT, cle TEXT, operation TEXT, avant TEXT, apres TEXT, etat TEXT, detail TEXT, apercu TEXT, PRIMARY KEY (lot_id, rang));
    CREATE TABLE page (id TEXT PRIMARY KEY, titre TEXT, slug_adresse TEXT, mot_cle_id INTEGER);
    CREATE TABLE page_ancienne_adresse (adresse TEXT PRIMARY KEY, page_id TEXT);
    INSERT INTO page VALUES ('essai/a', 'A', 'a2', NULL), ('essai/b', 'B', 'b2', 2), ('essai/c', 'C2', 'c2', NULL);
    INSERT INTO page_ancienne_adresse VALUES ('essai/a/', 'essai/a');
    INSERT INTO modification_lot VALUES ('L1', '2026-11-01T10:00:00Z', NULL), ('L2', '2026-11-02T10:00:00Z', NULL);
  `);
  let rang = 0;
  const noter = (lotId, table, cle, operation, { avant = null, apres = null } = {}) => db.prepare("INSERT INTO modification VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', NULL, NULL)")
    .run(lotId, (rang += 1), table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres));
  noter('L1', 'page', { id: 'essai/a' }, 'modifier', { avant: { slug_adresse: null }, apres: { slug_adresse: 'a2' } });
  noter('L1', 'page_ancienne_adresse', { adresse: 'essai/a/' }, 'inserer', { apres: { adresse: 'essai/a/', page_id: 'essai/a' } });
  noter('L1', 'page', { id: 'essai/b' }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 2 } });
  noter('L2', 'page', { id: 'essai/b' }, 'modifier', { avant: { slug_adresse: null }, apres: { slug_adresse: 'b2' } });
  noter('L2', 'page', { id: 'essai/c' }, 'modifier', { avant: { titre: 'C', slug_adresse: null }, apres: { titre: 'C2', slug_adresse: 'c2' } });
  assert.deepEqual(lignesEnAttente(db, { pourLesPages: true }).map((l) => `${l.table}:${l.cle.id ?? l.cle.adresse}`), ['page:essai/c']);
  assert.equal(lignesEnAttente(db).length, 4, 'sans l’option, toutes les lignes');
  db.close();
});
