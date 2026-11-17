// Une page des Règles ne se supprime pas tant qu'un texte la cite (serveur/edition-plan.mjs, lib/citations-db.mjs : lien [[…]] par titre, alias, slug ou
// identifiant, adresse écrite, bloc de la chronologie ; depuis la migration 0098, un mot-clé dont l'adresse mène à la page et ses balises). Au rejeu, la même règle (« Aucune référence n'est jamais laissée rompue », docs/serveur.md) :
// quand le lot qui retirait la citation est en conflit, la suppression de la page l'est aussi, avec sa raison (serveur/edition.mjs#liensRompusParLeLot),
// et sur la page « Mise à jour » elle n'a que le choix 2 tant que le lien reste ; résolu le lot du lien, elle passe. Pages et textes créés par le test,
// titres libres, rien d'écrit en dur sur le contenu de la base.
//   node --test test/serveur-edition-liens-rompus.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { colonneDerivee, liensRompusParLeLot, rejouerLeJournal } from '../serveur/edition.mjs';
import { examinerLeLot, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { adresseDeLaPage } from '../src/lib/adresses-db.mjs';
import { citationsDe } from '../src/lib/citations-db.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('liens-rompus');
let compteur = 0;

/** Une base vivante neuve et le service qui l'écrit. */
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const lot = (operations) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
    corps: JSON.stringify({ page: 'regles/', operations }) }, { base: () => db, etat: () => ({}), edition: true });
  return { db, lot };
}
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
/** Un titre qu'aucune page ne porte (titre, slug, alias). */
function titreLibre(db, base) {
  for (let i = 1; ; i += 1) {
    const titre = `${base} ${process.pid}${i === 1 ? '' : ` ${i}`}`;
    if (!db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(normalize(titre))) return titre;
  }
}
/** Un libellé de mot-clé qu'aucun mot-clé ne porte (sa clé, normalize, libre ; aucun homonyme). */
function motCleLibre(db, base) {
  for (let i = 1; ; i += 1) {
    const libelle = `${base} ${process.pid}${i === 1 ? '' : ` ${i}`}`;
    if (!db.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(normalize(libelle))) return libelle;
  }
}
/** Un mot-clé écrit directement dans la base (les règles d'un essai) : l'id suivant (migration 0113) et sa clé ; rend son id. */
function insererMotCle(db, libelle, url) {
  const id = db.prepare('SELECT coalesce(max(id), 0) + 1 AS n FROM mot_cle').get().n;
  db.prepare('INSERT INTO mot_cle (id, libelle, cle, url) VALUES (?, ?, ?, ?)').run(id, libelle, normalize(libelle), url);
  return id;
}
const creer = (lot, titre) => ok(lot([{ op: 'creer', entite: 'page_des_regles', valeurs: { titre, onglet_id: 'combats', resume: 'Essai.' } }])).crees[0].id;
const corpsDe = (db, id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id)?.corps_md;

test('liensRompusParLeLot : la page retirée garde son titre et ses alias pour la résolution des liens ; une page d’exemple, une colonne dérivée, une page encore là ne comptent pas', () => {
  const { db, lot } = nouvelle();
  try {
    const titre = titreLibre(db, 'Page retirée d’essai');
    const cible = creer(lot, titre);
    const citante = creer(lot, titreLibre(db, 'Page qui cite d’essai'));
    const alias = `Autre nom ${process.pid}`;
    db.prepare('INSERT INTO alias (page_id, ordre, texte, cle) VALUES (?, 0, ?, ?)').run(cible, alias, normalize(alias));
    const page = { ...db.prepare('SELECT * FROM page WHERE id = ?').get(cible) };
    const ligneAlias = { ...db.prepare('SELECT * FROM alias WHERE page_id = ?').get(cible) };
    const lotDeRetrait = [
      { rang: 1, table_nom: 'alias', operation: 'supprimer', avant: JSON.stringify(ligneAlias) },
      { rang: 2, table_nom: 'page', operation: 'supprimer', avant: JSON.stringify(page) },
    ];
    // encore là : rien à regarder
    assert.deepEqual(liensRompusParLeLot(db, lotDeRetrait), []);
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      for (const t of ['alias', 'regles_onglet_entree', 'page_source', 'page_tag', 'page_entite']) db.prepare(`DELETE FROM "${t}" WHERE page_id = ?`).run(cible);
      db.prepare('DELETE FROM page WHERE id = ?').run(cible);
      for (const [ecrit, comment] of [[`Voir [[${titre}]].`, 'titre'], [`Voir [[${alias}|ce texte]].`, 'alias'], [`Voir [[${cible}|ici]].`, 'identifiant'],
        [`Voir [le texte](/regles/${cible.slice('guide/'.length)}/).`, 'adresse']]) {
        db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(ecrit, citante);
        const rompus = liensRompusParLeLot(db, lotDeRetrait);
        assert.equal(rompus.length, 1, comment);
        assert.deepEqual([rompus[0].rang, rompus[0].rangs.sort(), rompus[0].page, rompus[0].citations.map((c) => c.cle.id)], [2, [1, 2], cible, [citante]], comment);
        assert.ok(rompus[0].raison.includes(titre), rompus[0].raison);
      }
      // une suppression que le lot n'a pas faite (rejeu : « intégrée », la page que les règles n'avaient déjà plus) n'est pas de son fait
      assert.deepEqual(liensRompusParLeLot(db, lotDeRetrait, { faites: lotDeRetrait.slice(0, 1) }), []);
      // sans les alias que le lot retire, le lien par alias ne se résout plus vers elle (la raison de les relire dans le lot)
      db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`Voir [[${alias}]].`, citante);
      assert.deepEqual(liensRompusParLeLot(db, lotDeRetrait.slice(1)), []);
      // une page d'exemple seule, ou une colonne dérivée seule (corps d'une page typée, refait après le rejeu) : rien ne bloque
      db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run('Plus de lien.', citante);
      const exemple = db.prepare("SELECT id, corps_md FROM page WHERE statut = 'example' ORDER BY id").get();
      db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`${exemple.corps_md}\nVoir [[${titre}]].`, exemple.id);
      const typee = db.prepare("SELECT id, corps_md FROM page WHERE type = 'capacites' AND statut <> 'example' ORDER BY id").get();
      assert.ok(colonneDerivee('page', { id: typee.id }, 'corps_md'));
      db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`${typee.corps_md}\nVoir [[${titre}]].`, typee.id);
      assert.equal(citationsDe(db, cible, { absentes: [{ ...page, alias: [] }] }).length, 2, 'les deux sont bien des citations');
      assert.deepEqual(liensRompusParLeLot(db, lotDeRetrait), []);
      // depuis la migration 0098 : un mot-clé dont l'adresse mène à la page retirée (avec ou sans ancre), et ses balises, la citent encore
      const libelle = motCleLibre(db, 'Essai lien rompu');
      const mot = insererMotCle(db, libelle, adresseDeLaPage(cible));
      db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`Voir {{${normalize(libelle)}}}.`, citante);
      for (const url of [adresseDeLaPage(cible), `${adresseDeLaPage(cible)}#ancre-d-essai`]) {
        db.prepare('UPDATE mot_cle SET url = ? WHERE id = ?').run(url, mot);
        const rompus = liensRompusParLeLot(db, lotDeRetrait);
        assert.equal(rompus.length, 1, url);
        assert.deepEqual(rompus[0].citations.map((c) => [c.table, c.cle.id, c.comment]).sort(),
          [['mot_cle', mot, 'mot-cle'], ['page', citante, 'balise']], url);
        assert.ok(rompus[0].raison.includes(titre), rompus[0].raison);
      }
      // le mot-clé ne mène plus à la page (plus d'adresse, ou une autre) : ni lui ni ses balises ne la citent
      for (const url of [null, '/regles/']) {
        db.prepare('UPDATE mot_cle SET url = ? WHERE id = ?').run(url, mot);
        assert.deepEqual(liensRompusParLeLot(db, lotDeRetrait), [], String(url));
      }
    } finally {
      db.exec('ROLLBACK');
      db.exec('PRAGMA foreign_keys = ON');
    }
  } finally {
    db.close();
  }
});

test('rejeu : le lot qui retirait le lien est en conflit, la suppression de la page citée l’est aussi (sa raison) ; sur « Mise à jour », choix 2 seul, puis elle passe une fois le lien retiré', () => {
  // le site de dev : P et Q créées, Q cite P par son titre (règles livrées ensuite) ; puis le lien retiré, puis P supprimée
  const site = nouvelle();
  let titre;
  let cible;
  let citante;
  let livres;
  let suite;
  try {
    titre = titreLibre(site.db, 'Formule d’essai');
    cible = creer(site.lot, titre);
    citante = creer(site.lot, titreLibre(site.db, 'Guide d’essai'));
    // depuis la migration 0098, le service n'écrit plus de lien [[…]] (serveur/edition.mjs#texteSansLiens) : le lien est posé dans la base comme un
    // texte d'avant elle, et le lot qui le retire passe (un lien déjà là n'est pas lu)
    site.db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`Voir [[${titre}]].`, citante);
    livres = journalExporte(site.db);
    ok(site.lot([{ op: 'modifier', table: 'page', cle: { id: citante }, valeurs: { corps_md: 'Plus de lien.' } }]));
    ok(site.lot([{ op: 'supprimer', entite: 'page_des_regles', cle: { id: cible } }]));
    const deja = new Set(livres.lots.map((l) => l.id));
    const tout = journalExporte(site.db);
    suite = { ...tout, lots: tout.lots.filter((l) => !deja.has(l.id)) };
    assert.equal(suite.lots.length, 2);
  } finally {
    site.db.close();
  }
  // les règles : P et Q livrées, puis le texte de Q changé par une migration (le lot qui retirait le lien sera en conflit)
  const { db } = nouvelle();
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, livres);
    rejouerLeJournal(db);
    db.exec('DELETE FROM modification; DELETE FROM modification_lot');
    db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`Voir [[${titre}]]. Texte changé par une migration.`, citante);
    db.exec('COMMIT');
    db.exec('BEGIN');
    chargerJournal(db, suite);
    const bilan = rejouerLeJournal(db);
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    const [lien, retrait] = suite.lots.map((l) => l.id);
    assert.equal(bilan.conflits, suite.lots.reduce((n, l) => n + l.modifications.length, 0), 'les deux lots en conflit');
    const detail = db.prepare("SELECT detail FROM modification WHERE lot_id = ? AND etat = 'conflit'").get(retrait).detail;
    assert.ok(detail.includes(titre), detail);
    assert.ok(corpsDe(db, cible) !== undefined, 'la page citée reste');
    assert.ok(corpsDe(db, citante).includes(`[[${titre}]]`));
    // l'examen du lot de la suppression : elle et ce qui décrit la page n'ont que le choix 2, avec la raison
    const diag = examinerLeLot(db, retrait);
    const page = diag.conflits.find((c) => c.table === 'page');
    assert.deepEqual(page?.choix_possibles, [2]);
    assert.ok(page.raison.includes(titre), page.raison);
    assert.ok(diag.conflits.every((c) => c.choix_possibles.length === 1 && c.choix_possibles[0] === 2));
    // le lot du lien résolu (version 1 : le lien retiré), la suppression passe
    const dLien = examinerLeLot(db, lien);
    ok({ statut: 200, corps: resoudreLeConflit(db, { lot: lien, empreinte: dLien.empreinte, choix: Object.fromEntries(dLien.conflits.map((c) => [c.id, { choix: 1 }])) }) });
    assert.ok(!corpsDe(db, citante).includes(`[[${titre}]]`));
    const dRetrait = examinerLeLot(db, retrait);
    assert.deepEqual(dRetrait.conflits.filter((c) => c.table === 'page'), []);
    const fin = resoudreLeConflit(db, { lot: retrait, empreinte: dRetrait.empreinte, choix: Object.fromEntries(dRetrait.conflits.map((c) => [c.id, { choix: c.choix_possibles[0] }])) });
    assert.ok(fin.nouveau_lot);
    assert.equal(corpsDe(db, cible), undefined, 'la page est supprimée');
  } finally {
    db.close();
  }
});

test('rejeu : une page citée par un mot-clé à adresse et ses balises (migration 0098) — le lot qui retirait l’adresse en conflit, la suppression l’est aussi (sa raison) ; elle passe quand le mot-clé ne mène plus à la page', () => {
  // le site de dev : P et Q créées, le mot-clé M mène à P, Q le cite par sa balise (règles livrées ensuite) ; puis l'adresse de M retirée, puis P supprimée
  const site = nouvelle();
  let titre;
  let cible;
  let citante;
  let mot;
  let livres;
  let suite;
  try {
    titre = titreLibre(site.db, 'Formule à adresse d’essai');
    cible = creer(site.lot, titre);
    citante = creer(site.lot, titreLibre(site.db, 'Guide à balise d’essai'));
    mot = ok(site.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: motCleLibre(site.db, 'Essai adresse rompue'), url: adresseDeLaPage(cible) } }])).crees[0].id;
    const cleDuMot = site.db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(mot).cle;
    ok(site.lot([{ op: 'modifier', table: 'page', cle: { id: citante }, valeurs: { corps_md: `Voir {{${cleDuMot}}}.` } }]));
    // le garde-fou direct (serveur/edition-plan.mjs : citationsDe sur la base où la page est encore) voit le mot-clé et sa balise
    const refus = site.lot([{ op: 'supprimer', entite: 'page_des_regles', cle: { id: cible } }]);
    assert.equal(refus.statut, 409, JSON.stringify(refus.corps));
    assert.deepEqual(refus.corps.citations.map((c) => [c.table, c.cle.id, c.comment]).sort(), [['mot_cle', mot, 'mot-cle'], ['page', citante, 'balise']]);
    livres = journalExporte(site.db);
    ok(site.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: mot }, valeurs: { url: null } }]));
    ok(site.lot([{ op: 'supprimer', entite: 'page_des_regles', cle: { id: cible } }]));
    const deja = new Set(livres.lots.map((l) => l.id));
    const tout = journalExporte(site.db);
    suite = { ...tout, lots: tout.lots.filter((l) => !deja.has(l.id)) };
    assert.equal(suite.lots.length, 2);
  } finally {
    site.db.close();
  }
  // les règles : P, Q et M livrés, puis l'adresse de M changée par une migration (toujours vers P, à une ancre : le lot qui la retirait sera en conflit)
  const { db } = nouvelle();
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, livres);
    rejouerLeJournal(db);
    db.exec('DELETE FROM modification; DELETE FROM modification_lot');
    db.prepare('UPDATE mot_cle SET url = ? WHERE id = ?').run(`${adresseDeLaPage(cible)}#ancre-d-essai`, mot);
    db.exec('COMMIT');
    db.exec('BEGIN');
    chargerJournal(db, suite);
    const bilan = rejouerLeJournal(db);
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    const [adresse, retrait] = suite.lots.map((l) => l.id);
    assert.ok(bilan.conflits >= 2, 'les deux lots en conflit');
    assert.ok(db.prepare("SELECT 1 FROM modification WHERE lot_id = ? AND etat = 'conflit'").get(adresse), 'le retrait de l’adresse en conflit');
    const detail = db.prepare("SELECT detail FROM modification WHERE lot_id = ? AND etat = 'conflit' AND table_nom = 'page'").get(retrait)?.detail;
    assert.ok(detail?.includes(titre), detail);
    assert.ok(corpsDe(db, cible) !== undefined, 'la page citée reste');
    // l'examen du lot de la suppression : choix 2 seul, avec la raison
    const diag = examinerLeLot(db, retrait);
    const page = diag.conflits.find((c) => c.table === 'page');
    assert.deepEqual(page?.choix_possibles, [2]);
    assert.ok(page.raison.includes(titre), page.raison);
    // le lot de l'adresse résolu (version 1 : le mot-clé ne mène plus à la page), la suppression passe ; la balise reste, sans page derrière
    const dAdresse = examinerLeLot(db, adresse);
    ok({ statut: 200, corps: resoudreLeConflit(db, { lot: adresse, empreinte: dAdresse.empreinte, choix: Object.fromEntries(dAdresse.conflits.map((c) => [c.id, { choix: 1 }])) }) });
    assert.equal(db.prepare('SELECT url FROM mot_cle WHERE id = ?').get(mot).url, null);
    const dRetrait = examinerLeLot(db, retrait);
    assert.deepEqual(dRetrait.conflits.filter((c) => c.table === 'page'), []);
    const fin = resoudreLeConflit(db, { lot: retrait, empreinte: dRetrait.empreinte, choix: Object.fromEntries(dRetrait.conflits.map((c) => [c.id, { choix: c.choix_possibles[0] }])) });
    assert.ok(fin.nouveau_lot);
    assert.equal(corpsDe(db, cible), undefined, 'la page est supprimée');
  } finally {
    db.close();
  }
});

test('rejeu : un don ou un métier supprimé sur le site, dont la fiche ou l’ancre est devenue depuis l’adresse d’un mot-clé (règles livrées) — le lot en conflit, sa raison, choix 2 seul ; comme le service le refuse', () => {
  // le site de dev : un don et un métier créés (livrés ensuite), puis supprimés, chacun dans son lot, quand rien ne les citait
  const site = nouvelle();
  let livres;
  let suite;
  const cas = [];
  try {
    const classe = site.db.prepare("SELECT id FROM classe ORDER BY id = 'classes/guerrier' DESC, id LIMIT 1").get().id;
    const don = ok(site.lot([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau: '20', nom: titreLibre(site.db, 'Don d’adresse'), type: 'Passif' } }])).crees[0].id;
    const metier = ok(site.lot([{ op: 'creer', entite: 'metier', valeurs: { nom: titreLibre(site.db, 'Métier d’adresse') } }])).crees[0].id;
    livres = journalExporte(site.db);
    ok(site.lot([{ op: 'supprimer', entite: 'capacite', cle: { id: don } }]));
    ok(site.lot([{ op: 'supprimer', entite: 'metier', cle: { id: metier } }]));
    for (const id of [don, metier]) cas.push({ id, titre: site.db.prepare('SELECT titre FROM page WHERE id = ?').get(id)?.titre });
    const deja = new Set(livres.lots.map((l) => l.id));
    const tout = journalExporte(site.db);
    suite = { ...tout, lots: tout.lots.filter((l) => !deja.has(l.id)) };
    assert.equal(suite.lots.length, 2);
  } finally {
    site.db.close();
  }
  // les règles : le don et le métier livrés, puis un mot-clé dont l'adresse mène à chacun (une migration, ou le site de dev ailleurs)
  const { db } = nouvelle();
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, livres);
    rejouerLeJournal(db);
    db.exec('DELETE FROM modification; DELETE FROM modification_lot');
    for (const c of cas) {
      c.titre = db.prepare('SELECT titre FROM page WHERE id = ?').get(c.id).titre;
      const libelle = motCleLibre(db, 'Essai adresse de fiche');
      c.mot = insererMotCle(db, libelle, adresseDeLaPage(c.id));
    }
    db.exec('COMMIT');
    db.exec('BEGIN');
    chargerJournal(db, suite);
    rejouerLeJournal(db);
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    for (const [i, c] of cas.entries()) {
      const lot = suite.lots[i].id;
      const detail = db.prepare("SELECT detail FROM modification WHERE lot_id = ? AND etat = 'conflit' AND table_nom = 'page'").get(lot)?.detail;
      assert.ok(detail?.includes(c.titre), `${c.id} : ${detail}`);
      assert.ok(corpsDe(db, c.id) !== undefined, `${c.id} : sa page reste`);
      const diag = examinerLeLot(db, lot);
      for (const table of ['page', c.id.startsWith('metiers/') ? 'metier' : 'capacite']) {
        assert.deepEqual(diag.conflits.find((x) => x.table === table && x.cle.id === c.id)?.choix_possibles, [2], `${c.id} : ${table}`);
      }
    }
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});
