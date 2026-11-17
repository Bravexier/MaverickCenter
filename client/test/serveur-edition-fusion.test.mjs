// Fusion à trois voies au rejeu du journal (serveur/edition-journal.mjs#rejouer, lib/fusion-trois-voies.mjs) et lots gardés (serveur/edition-conflits.mjs),
// demande du propriétaire : « j'aimerai que les modification apporté sur le site prime sur celle qui peuvent être faites "sous le radar" par le code et le
// dev. Si n'importe quel élément est modifiée à la fois par une modification manuelle et par une modification par le code et la livraison d'un build, je
// site essaye de faire un merge automatique entre les deux. Quand un conflit est trop ambigüe seulement là il est listé dans l'onglet mise à jour avec à
// gauche "modification sur site" et à droite "modification du code". C'est là que tu peux choisir entre 1, 2, ou 3 » ; réponses : « Pendant qu'un conflit
// ambigu attend son choix, la page du site affiche LA MODIFICATION DU SITE », « Une valeur courte non fusionnable […] modifiée des deux côtés : LISTÉE EN
// CONFLIT (la valeur du site reste affichée en attendant) ».
// Tout se prouve sur des copies : une base vivante, des lots écrits par le vrai service d'édition, puis une livraison (des règles changées) qui refait la
// base vivante. Les textes sont posés par le test (aucun texte de la base n'est lu) ; le métier est choisi par son id dans l'état d'import.
import assert from 'node:assert/strict';
import { copyFileSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { conflitsDuJournal, lotsEnConflit, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { noteEnPreparation } from '../serveur/notes-de-version.mjs';
import { chargerJournal, journalExporte, lignesEnAttente, lireLaTrace, ouvrirLot } from '../serveur/edition-journal.mjs';
import { decouperCorps } from '../src/lib/markdown-edition.mjs';
import { cheminDImport, texteDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('fusion');
const ouvertes = [];
after(() => {
  for (const b of ouvertes) if (b.isOpen) b.close();
});
let compteur = 0;
const chemin = (nom) => join(racine, `${nom}-${(compteur += 1)}`);

// le métier de l'essai, par son id dans l'état d'import ; ses textes sont ceux du test
const METIER = 'metiers/forgeron';
const P = ['Premier paragraphe du métier (essai de fusion).', 'Deuxième paragraphe du métier (essai de fusion).', 'Troisième paragraphe du métier (essai de fusion).'];
const texte = (p) => p.join('\n\n');
const avec = (i, phrase, p = P) => p.map((x, k) => (k === i ? phrase : x));
const EQUIPEMENT = 'Marteau (essai de fusion)';
/** Une livraison sans rapport avec les lots : l'équipement seul change (des règles identiques ne refont pas la base vivante). */
const SANS_RAPPORT = 'Pince (livraison sans rapport)';

/** Une copie des règles d'import, la description et l'équipement du métier posés. */
function regles(description, equipement = EQUIPEMENT) {
  const f = `${chemin('regles')}.db`;
  copyFileSync(cheminDImport(), f);
  const db = new DatabaseSync(f);
  db.prepare('UPDATE metier SET description = ?, equipement_brut = ? WHERE id = ?').run(description, equipement, METIER);
  db.close();
  return f;
}
const ouvrir = (dossier) => {
  const db = ouvrirBaseVivante(join(dossier, FICHIER_BASE));
  ouvertes.push(db);
  return db;
};
/** Une base vivante sur des règles `r0`, puis les lots du site de dev (des valeurs du métier, un lot chacune, dans l'ordre). */
function siteDeDev(r0, lots) {
  const dossier = chemin('vivante');
  preparerBaseVivante({ regles: r0, dossier });
  const db = ouvrir(dossier);
  const ids = lots.map((valeurs) => enregistrer(db, { page: METIER, operations: [{ op: 'modifier', table: 'metier', cle: { id: METIER }, valeurs }] }).lot);
  db.close();
  return { dossier, ids };
}
const copie = (dossier) => {
  const autre = chemin('copie');
  cpSync(dossier, autre, { recursive: true });
  return autre;
};
const metier = (db) => ({ ...db.prepare('SELECT description, equipement_brut FROM metier WHERE id = ?').get(METIER) });
/** Les états des modifications d'un lot (le service note aussi les lignes qu'il refait : la page du métier). */
const etats = (db, lot) => [...new Set(db.prepare('SELECT etat FROM modification WHERE lot_id = ? ORDER BY rang').all(lot).map((m) => m.etat))];
const diagnostic = (db, lot) => conflitsDuJournal(db).lots.find((l) => l.lot === lot);

/** Le journal exporté (« Effectuer la mise à jour »), rejoué sur une copie des règles comme le rapatriement : { bilan, conflits, metier }. */
function rejoueSurLesRegles(reglesDb, journal) {
  const f = `${chemin('rapatriement')}.db`;
  copyFileSync(reglesDb, f);
  const db = new DatabaseSync(f);
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, journal);
    const bilan = rejouerLeJournal(db);
    const conflits = db.prepare("SELECT detail FROM modification WHERE etat = 'conflit'").all().map((c) => c.detail);
    const m = metier(db);
    db.exec('ROLLBACK');
    return { bilan, conflits, metier: m };
  } finally {
    db.close();
  }
}

test('le code change un autre paragraphe : la fusion est écrite, le lot reste en attente, sans conflit ; le rapatriement redonne la même valeur', () => {
  const r0 = regles(texte(P));
  const { dossier, ids: [lot] } = siteDeDev(r0, [{ description: texte(avec(0, 'Premier paragraphe réécrit sur le site.')) }]);
  const r1 = regles(texte(avec(2, 'Troisième paragraphe réécrit par le code.')));
  const { rejeu } = preparerBaseVivante({ regles: r1, dossier });
  assert.equal(rejeu.conflits, 0, JSON.stringify(rejeu));
  const db = ouvrir(dossier);
  const attendue = texte(avec(2, 'Troisième paragraphe réécrit par le code.', avec(0, 'Premier paragraphe réécrit sur le site.')));
  assert.equal(metier(db).description, attendue, 'les deux changements');
  assert.deepEqual(etats(db, lot), ['en_attente']);
  assert.deepEqual(lotsEnConflit(db), []);
  const journal = journalExporte(db);
  const notee = journal.lots.find((l) => l.id === lot).modifications.find((m) => m.table === 'metier');
  assert.deepEqual([notee.avant.description, notee.apres.description], [texte(avec(2, 'Troisième paragraphe réécrit par le code.')), attendue],
    'la modification part désormais de la valeur des règles (l’historique la garde comme valeur d’avant)');
  const r = rejoueSurLesRegles(r1, journal);
  assert.deepEqual(r.conflits, []);
  assert.equal(r.metier.description, attendue, 'db:appliquer-edition et la mise à jour fusionnent de même (même evaluerUne)');
});

test('le code change le même passage : la valeur du site reste affichée, le lot est listé en conflit, gardé, avec la valeur du code et les passages', () => {
  const r0 = regles(texte(P));
  const site = texte(avec(1, 'Deuxième paragraphe réécrit sur le site.'));
  const code = texte(avec(1, 'Deuxième paragraphe réécrit par le code.'));
  const { dossier, ids: [lot] } = siteDeDev(r0, [{ description: site }]);
  const { rejeu } = preparerBaseVivante({ regles: regles(code), dossier });
  assert.ok(rejeu.gardees > 0 && rejeu.gardees === rejeu.conflits, JSON.stringify(rejeu));
  const db = ouvrir(dossier);
  assert.equal(metier(db).description, site, 'la modification du site prime');
  assert.deepEqual(etats(db, lot), ['conflit']);
  assert.deepEqual(lotsEnConflit(db).map((l) => l.id), [lot]);
  assert.ok(lignesEnAttente(db).some((l) => l.table === 'metier' && l.cle.id === METIER), 'la surcouche des pages montre la valeur du site');
  assert.equal(journalExporte(db).lots.some((l) => l.id === lot), false, 'un lot en conflit ne part pas');
  const { reprise } = lireLaTrace(db.prepare("SELECT detail FROM modification WHERE lot_id = ? AND table_nom = 'metier'").get(lot).detail);
  assert.equal(reprise.gardees.description.code, code, 'la valeur du code, gardée dans la trace : elle n’est plus dans la base');
  const d = diagnostic(db, lot);
  assert.equal(d.garde, true);
  assert.equal(d.conflits.length, 1);
  const [c] = d.conflits;
  assert.equal(c.id, `${c.rang}:description`);
  assert.equal(c.garde, true);
  assert.deepEqual(c.version_1, { genre: 'valeur', valeur: site });
  assert.deepEqual(c.version_2, { genre: 'valeur', valeur: code });
  assert.deepEqual(c.avant, { genre: 'valeur', valeur: texte(P) });
  assert.deepEqual(c.provenance_1, { genre: 'site', lot, fait_le: d.fait_le, resume: d.resume });
  assert.deepEqual(c.provenance_2, { genre: 'regles' });
  assert.equal(c.actuelle, null, 'la valeur du site est la valeur actuelle');
  assert.deepEqual(c.passages, [{ base: `${P[1]}\n`, site: 'Deuxième paragraphe réécrit sur le site.\n', code: 'Deuxième paragraphe réécrit par le code.\n' }]);
  assert.deepEqual(c.choix_possibles, [1, 2, 3]);
  assert.equal(c.bloque, null);
  assert.match(d.detail_lisible, /la valeur du site reste en place$/);
  assert.doesNotMatch(d.detail, /\{"reprise"/, 'la trace lue sans la reprise');
});

test('une valeur courte changée des deux côtés : gardée (la valeur du site) et listée en conflit, jamais fusionnée', () => {
  const r0 = regles(texte(P));
  const { dossier, ids: [lot] } = siteDeDev(r0, [{ equipement_brut: 'Enclume (site)' }]);
  preparerBaseVivante({ regles: regles(texte(P), 'Tenailles (code)'), dossier });
  const db = ouvrir(dossier);
  assert.equal(metier(db).equipement_brut, 'Enclume (site)');
  const [c] = diagnostic(db, lot).conflits;
  assert.equal(c.colonne, 'equipement_brut');
  assert.deepEqual([c.version_1.valeur, c.version_2.valeur], ['Enclume (site)', 'Tenailles (code)']);
  assert.deepEqual(c.passages, []);
});

test('pas de cascade : un lot suivant du même champ se rejoue sur la valeur du site, reste en attente, et ne part qu’après la résolution', () => {
  const r0 = regles(texte(P));
  const v1 = texte(avec(0, 'Premier paragraphe du site (1).'));
  const v2 = texte(avec(2, 'Troisième paragraphe du site (2).', avec(0, 'Premier paragraphe du site (1).')));
  const { dossier, ids: [l1, l2] } = siteDeDev(r0, [{ description: v1 }, { description: v2 }]);
  const code = texte(avec(0, 'Premier paragraphe du code.'));
  preparerBaseVivante({ regles: regles(code), dossier });
  const db = ouvrir(dossier);
  assert.equal(metier(db).description, v2, 'les deux lots du site, dans l’ordre');
  assert.deepEqual(etats(db, l1), ['conflit']);
  assert.deepEqual(etats(db, l2), ['en_attente'], 'le lot suivant n’est pas en conflit');
  const journal = journalExporte(db);
  assert.equal(journal.lots.some((l) => l.id === l2), false, 'retenu derrière le lot gardé');
  assert.deepEqual(journal.retenus, [{ id: l2, derriere: l1 }]);
  assert.deepEqual(conflitsDuJournal(db).retenus.map((r) => [r.lot, r.derriere]), [[l2, l1]]);
  const [c] = diagnostic(db, l1).conflits;
  assert.deepEqual(c.actuelle?.valeur, v2, 'la valeur actuelle, écrite par le lot suivant');
  assert.equal(c.actuelle.provenance.lot, l2);
  assert.deepEqual(c.lots_suivants.map((l) => l.lot), [l2]);
});

test('résolution d’un lot gardé : choix 1, 2, 3 ; la reprise prend sa place dans l’ordre du rejeu, et le journal exporté se rejoue sans conflit sur les règles', () => {
  const r0 = regles(texte(P));
  const v1 = texte(avec(0, 'Premier paragraphe du site (1).'));
  const v2 = texte(avec(2, 'Troisième paragraphe du site (2).', avec(0, 'Premier paragraphe du site (1).')));
  const { dossier } = siteDeDev(r0, [{ description: v1 }, { description: v2 }]);
  const code = texte(avec(0, 'Premier paragraphe du code.'));
  const r1 = regles(code);
  preparerBaseVivante({ regles: r1, dossier });
  const cas = [
    [1, undefined, v2],
    // choix 2 : la valeur du code, le lot suivant (le troisième paragraphe) refait dessus
    [2, undefined, texte(avec(2, 'Troisième paragraphe du site (2).', avec(0, 'Premier paragraphe du code.')))],
    [3, 'Valeur saisie (essai de fusion).', 'Valeur saisie (essai de fusion).'],
  ];
  for (const [n, valeur, attendue] of cas) {
    const ici = copie(dossier);
    const db = ouvrir(ici);
    const [l1] = lotsEnConflit(db).map((l) => l.id);
    const d = diagnostic(db, l1);
    const [c] = d.conflits;
    const r = resoudreLeConflit(db, { lot: l1, empreinte: d.empreinte, choix: { [c.id]: { choix: n, ...(n === 3 ? { valeur } : {}) } } });
    assert.equal(r.reprise, `${l1}-reprise`);
    assert.equal(metier(db).description, attendue, `choix ${n}`);
    assert.deepEqual(lotsEnConflit(db), [], `choix ${n} : plus rien à résoudre`);
    const lot = db.prepare('SELECT resolu_par, resolution FROM modification_lot WHERE id = ?').get(l1);
    assert.equal(lot.resolu_par, r.reprise);
    assert.deepEqual(JSON.parse(lot.resolution), [{ rang: c.rang, colonne: 'description', choix: n }]);
    assert.equal(r.nouveau_lot === null, n === 1, 'les choix 2 et 3 écrivent un lot à eux');
    const journal = journalExporte(db);
    assert.equal(journal.retenus, undefined, 'plus rien de retenu');
    const ordre = journal.lots.map((l) => l.id);
    assert.ok(ordre.indexOf(r.reprise) < ordre.findIndex((id) => id !== r.reprise && id !== r.nouveau_lot), 'la reprise passe avant le lot suivant');
    const repris = journal.lots.find((l) => l.id === r.reprise).modifications.find((m) => m.table === 'metier');
    assert.deepEqual([repris.avant.description, repris.apres.description], [code, v1], 'la reprise part de la valeur du code');
    const rapatrie = rejoueSurLesRegles(r1, journal);
    assert.deepEqual(rapatrie.conflits, [], `choix ${n}`);
    assert.equal(rapatrie.metier.description, attendue, `choix ${n} : les règles reçoivent la même valeur`);
    // la reconstruction suivante (une livraison sans rapport) redonne la même valeur, sans conflit
    const autre = copie(ici);
    db.close();
    const { rejeu } = preparerBaseVivante({ regles: regles(code, SANS_RAPPORT), dossier: autre });
    assert.equal(rejeu.conflits, 0, `choix ${n} : ${JSON.stringify(rejeu)}`);
    assert.equal(metier(ouvrir(autre)).description, attendue);
  }
});

test('choix 2 bloqué : un lot plus récent du même champ ne se fusionne pas avec la valeur du code', () => {
  const r0 = regles(texte(P));
  const v1 = texte(avec(0, 'Premier paragraphe du site (1).'));
  const v2 = texte(avec(0, 'Premier paragraphe du site (2).'));
  const { dossier, ids: [l1, l2] } = siteDeDev(r0, [{ description: v1 }, { description: v2 }]);
  preparerBaseVivante({ regles: regles(texte(avec(0, 'Premier paragraphe du code.'))), dossier });
  const db = ouvrir(dossier);
  const [c] = diagnostic(db, l1).conflits;
  assert.deepEqual(c.choix_possibles, [1, 3]);
  assert.match(c.refus_2, /^Le lot du .*plus récent, a modifié ce champ depuis, et sa modification ne se fusionne pas avec la valeur du code/);
  const l2Vu = c.lots_suivants[0];
  assert.deepEqual(c.refus_2_lot, { lot: l2, fait_le: l2Vu.fait_le, resume: l2Vu.resume }, 'le lot qui bloque, en champs structurés');
  assert.deepEqual(c.lots_suivants.map((l) => l.lot), [l2]);
});

test('ordre de résolution (bug des 03:16 et 03:17) : un lot plus récent du même champ ne se résout pas avant le plus ancien (409), le diagnostic le dit', () => {
  const r0 = regles(texte(P));
  const v1 = texte(avec(0, 'Premier paragraphe du site (1).'));
  const v2 = texte(avec(0, 'Premier paragraphe du site (2).'));
  const { dossier, ids: [l1, l2] } = siteDeDev(r0, [{ description: v1 }, { description: v2 }]);
  // une base vivante d'avant la fusion (lots annulés en entier, en cascade) : les deux lots sont en conflit
  preparerBaseVivante({ regles: regles(texte(avec(0, 'Premier paragraphe du code.'))), dossier, garderLeSite: false });
  const db = ouvrir(dossier);
  assert.deepEqual(lotsEnConflit(db).map((l) => l.id), [l1, l2]);
  const d2 = diagnostic(db, l2);
  const [c2] = d2.conflits;
  assert.equal(c2.bloque.lot, l1);
  assert.deepEqual(Object.keys(c2.bloque), ['lot', 'fait_le', 'resume', 'raison']);
  assert.match(c2.bloque.raison, /plus ancien/);
  assert.equal(d2.bloque, true);
  assert.equal(diagnostic(db, l1).conflits[0].bloque, null);
  assert.throws(() => resoudreLeConflit(db, { lot: l2, empreinte: d2.empreinte, choix: { [c2.id]: { choix: 1 } } }),
    (e) => e.statut === 409 && e.details?.bloque?.lot === l1 && /résolvez-le d’abord/.test(e.message));
  const d1 = diagnostic(db, l1);
  assert.deepEqual(d1.conflits[0].provenance_2, { genre: 'regles' }, 'la version 2 : les règles livrées');
  const saisie = texte(avec(0, 'Premier paragraphe saisi à la résolution.'));
  const { nouveau_lot: resolution } = resoudreLeConflit(db, { lot: l1, empreinte: d1.empreinte, choix: { [d1.conflits[0].id]: { choix: 3, valeur: saisie } } });
  assert.equal(metier(db).description, saisie);
  const apres = diagnostic(db, l2);
  const [c] = apres.conflits;
  assert.equal(c.bloque, null, 'le plus ancien résolu, le suivant se résout');
  assert.equal(c.provenance_2.genre, 'resolution', 'la version 2 vient de la résolution, pas de la dernière livraison');
  assert.equal(c.provenance_2.lot, resolution);
  assert.equal(c.provenance_2.resout, l1);
  assert.doesNotMatch(c.provenance_2.resume, /Résolution du conflit du lot|\d{4}-\d\d-\d\dT/, 'un résumé sans l’id du lot résolu');
  assert.equal(c.refus_1_lot, undefined, 'pas de refus du choix 1');
  assert.deepEqual(c.choix_possibles, [1, 2, 3], 'la résolution d’un lot plus ancien ne retire pas le choix 1');
  resoudreLeConflit(db, { lot: l2, empreinte: apres.empreinte, choix: { [c.id]: { choix: 1 } } });
  assert.equal(metier(db).description, v2, 'le plus récent l’emporte');
});

test('les lots annulés d’une base vivante d’avant sont réévalués à la reconstruction suivante : rien ne reste perdu', () => {
  const r0 = regles(texte(P));
  const v1 = texte(avec(0, 'Premier paragraphe du site (1).'));
  const v2 = texte(avec(2, 'Troisième paragraphe du site (2).', avec(0, 'Premier paragraphe du site (1).')));
  const { dossier, ids: [l1, l2] } = siteDeDev(r0, [{ description: v1 }, { description: v2 }]);
  const code = texte(avec(0, 'Premier paragraphe du code.'));
  preparerBaseVivante({ regles: regles(code), dossier, garderLeSite: false });
  let db = ouvrir(dossier);
  // avant : le premier lot annulé (sa valeur a disparu de la page) ; le second, fusionné avec le code (son troisième paragraphe), passe
  assert.equal(metier(db).description, texte(avec(2, 'Troisième paragraphe du site (2).', avec(0, 'Premier paragraphe du code.'))));
  assert.deepEqual(etats(db, l1), ['conflit']);
  db.close();
  preparerBaseVivante({ regles: regles(code, SANS_RAPPORT), dossier });
  db = ouvrir(dossier);
  assert.equal(metier(db).description, v2, 'après : la valeur du site revient');
  assert.deepEqual(lotsEnConflit(db).map((l) => l.id), [l1], 'seul le premier reste à résoudre, gardé');
  assert.deepEqual(etats(db, l2), ['en_attente']);
  assert.equal(diagnostic(db, l1).garde, true);
});

// Le diagnostic d'un lot gardé, pour la page (tech-front : lib/conflits-rendu.mjs) : test/fixtures/conflits-diagnostic-garde.json, recalculé par
// MAVERICK_ECRIRE_FIXTURE=1 node --test test/serveur-edition-fusion.test.mjs, jamais écrit à la main. Les ids et les dates des lots y sont remplacés par
// des repères stables, le nom du métier par celui de l'import (le site de dev peut le renommer : demande du propriétaire).
const FIXTURE_GARDE = new URL('./fixtures/conflits-diagnostic-garde.json', import.meta.url);
test('la fixture du diagnostic d’un lot gardé est celle du service (un lot gardé, un lot suivant du même champ, un champ court)', () => {
  const r0 = regles(texte(P));
  const v1 = texte(avec(1, 'Deuxième paragraphe réécrit sur le site.'));
  const v2 = texte(avec(2, 'Troisième paragraphe réécrit sur le site.', avec(1, 'Deuxième paragraphe réécrit sur le site.')));
  const { dossier, ids } = siteDeDev(r0, [{ description: v1, equipement_brut: 'Enclume (site)' }, { description: v2 }]);
  preparerBaseVivante({ regles: regles(texte(avec(1, 'Deuxième paragraphe réécrit par le code.')), 'Tenailles (code)'), dossier });
  const db = ouvrir(dossier);
  const nom = db.prepare('SELECT nom FROM metier WHERE id = ?').get(METIER).nom;
  let json = JSON.stringify(conflitsDuJournal(db));
  const lots = [...new Set(json.match(/\d{4}-\d\d-\d\dT[\d:.]+Z-\d{6}-[0-9a-f-]{36}/g))].sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
  lots.forEach((id, i) => {
    json = json.split(id).join(`lot-${i + 1}`);
  });
  json = json.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/g, '2026-11-12T10:00:00Z').replace(/"empreinte":"[0-9a-f]+"/g, '"empreinte":"…"')
    .split(nom).join(texteDImport('metier', { id: METIER }, 'nom'));
  const diag = JSON.parse(json);
  assert.deepEqual(diag.lots.map((l) => l.lot), ['lot-1']);
  assert.deepEqual(diag.retenus.map((r) => [r.lot, r.derriere]), [['lot-2', 'lot-1']]);
  if (process.env.MAVERICK_ECRIRE_FIXTURE === '1') writeFileSync(FIXTURE_GARDE, `${JSON.stringify(diag, null, 1)}\n`);
  assert.deepEqual(JSON.parse(readFileSync(FIXTURE_GARDE, 'utf8')), diag, 'relancer avec MAVERICK_ECRIRE_FIXTURE=1 node --test test/serveur-edition-fusion.test.mjs');
});

test('lot annulé dont un lot plus récent du site a écrit le champ depuis : choix 1 retiré, refus_1 et refus_1_lot (le lot, sa date, son résumé)', () => {
  const r0 = regles(texte(P));
  const v1 = texte(avec(0, 'Premier paragraphe du site (1).'));
  const v2 = texte(avec(2, 'Troisième paragraphe du site (2).', avec(0, 'Premier paragraphe du site (1).')));
  const { dossier, ids: [l1, l2] } = siteDeDev(r0, [{ description: v1 }, { description: v2 }]);
  // base vivante d'avant la fusion : le premier lot annulé, le second fusionné avec le code et en place
  preparerBaseVivante({ regles: regles(texte(avec(0, 'Premier paragraphe du code.'))), dossier, garderLeSite: false });
  const db = ouvrir(dossier);
  const c = diagnostic(db, l1).conflits.find((x) => x.colonne === 'description');
  assert.equal(c.provenance_2.genre, 'site');
  assert.equal(c.provenance_2.lot, l2);
  assert.deepEqual(c.choix_possibles, [2, 3]);
  assert.match(c.refus_1, /^Le lot du .*plus récent, a modifié ce champ depuis/);
  assert.deepEqual(c.refus_1_lot, { lot: l2, fait_le: c.provenance_2.fait_le, resume: c.provenance_2.resume });
});

test('un passage en conflit, un passage changé par le code seul, un par le site seul : la page montre le site sur le conflit et le code ailleurs ; choix 1 et 2', () => {
  const r0 = regles(texte(P));
  const site = texte(avec(2, 'Troisième paragraphe du site.', avec(1, 'Deuxième paragraphe du site.')));
  const code = texte(avec(0, 'Premier paragraphe du code.', avec(1, 'Deuxième paragraphe du code.')));
  const { dossier, ids: [lot] } = siteDeDev(r0, [{ description: site }]);
  const r1 = regles(code);
  preparerBaseVivante({ regles: r1, dossier });
  const siteGagne = texte(['Premier paragraphe du code.', 'Deuxième paragraphe du site.', 'Troisième paragraphe du site.']);
  const codeGagne = texte(['Premier paragraphe du code.', 'Deuxième paragraphe du code.', 'Troisième paragraphe du site.']);
  let db = ouvrir(dossier);
  assert.equal(metier(db).description, siteGagne, 'le site sur le passage en conflit, le changement du code ailleurs gardé');
  const [c] = diagnostic(db, lot).conflits;
  assert.deepEqual([c.version_1.valeur, c.version_2.valeur], [site, code], 'les deux modifications, telles quelles');
  assert.deepEqual(c.valeur_1, { genre: 'valeur', valeur: siteGagne });
  assert.deepEqual(c.valeur_2, { genre: 'valeur', valeur: codeGagne });
  assert.equal(c.actuelle, null);
  db.close();
  for (const [n, attendue] of [[1, siteGagne], [2, codeGagne]]) {
    const ici = copie(dossier);
    db = ouvrir(ici);
    const d = diagnostic(db, lot);
    resoudreLeConflit(db, { lot, empreinte: d.empreinte, choix: { [d.conflits[0].id]: { choix: n } } });
    assert.equal(metier(db).description, attendue, `choix ${n}`);
    const rapatrie = rejoueSurLesRegles(r1, journalExporte(db));
    assert.deepEqual(rapatrie.conflits, []);
    assert.equal(rapatrie.metier.description, attendue, `choix ${n} : les règles reçoivent la même valeur`);
    db.close();
  }
});

test('note en préparation : un lot gardé et les lots retenus derrière lui n’y sont pas ; ils y apparaissent après la résolution (réponse du propriétaire « Les retirer »)', () => {
  const r0 = regles(texte(P));
  const v1 = texte(avec(0, 'Premier paragraphe écrit sur le site (note).'));
  const v2 = texte(avec(2, 'Troisième paragraphe écrit sur le site (note).', avec(0, 'Premier paragraphe écrit sur le site (note).')));
  const { dossier, ids: [l1] } = siteDeDev(r0, [{ description: v1 }, { description: v2 }]);
  const r1 = regles(texte(avec(0, 'Premier paragraphe du code (note).')));
  preparerBaseVivante({ regles: r1, dossier });
  const db = ouvrir(dossier);
  // la référence (production) : les règles livrées elles-mêmes ; seule la part du site peut faire une ligne
  const note = () => noteEnPreparation(db, { reference: r1, versionDev: '0.3.70' });
  const lit = (n, phrase) => JSON.stringify(n.lignes).includes(phrase);
  const avant = note();
  assert.equal(lit(avant, 'écrit sur le site (note)'), false, 'ni le lot gardé ni le lot retenu');
  assert.equal(avant.en_attente, 0, 'le lot retenu ne compte pas parmi ce qui partira');
  assert.equal(avant.en_conflit.lots, 1);
  assert.equal(metier(db).description, v2, 'la base vivante n’a pas changé (savepoint annulé)');
  const d = diagnostic(db, l1);
  resoudreLeConflit(db, { lot: l1, empreinte: d.empreinte, choix: { [d.conflits[0].id]: { choix: 1 } } });
  const apres = note();
  assert.ok(lit(apres, 'Premier paragraphe écrit sur le site (note).') && lit(apres, 'Troisième paragraphe écrit sur le site (note).'), 'après la résolution');
  assert.ok(apres.en_attente > 0);
});

/** Une copie des règles d'import (le métier posé comme `regles`), puis `ecrire(db)` sur elle. */
function reglesAvec(description, ecrire) {
  const f = regles(description);
  const db = new DatabaseSync(f);
  ecrire(db);
  db.close();
  return f;
}
// une page du guide de l'import, choisie par son id (ordre stable) ; son corps est celui du test
const PAGE = (() => {
  const db = new DatabaseSync(cheminDImport(), { readOnly: true });
  try {
    return db.prepare("SELECT id FROM page WHERE id LIKE 'guide/%' AND statut <> 'example' ORDER BY id LIMIT 1").get().id;
  } finally {
    db.close();
  }
})();
const apercuDe = (corps) => decouperCorps(corps).filter((m) => m.visible).map((_m, i) => `<p>aperçu ${i}</p>`);

test('l’aperçu HTML d’une page du guide ne remplace jamais un corps qu’il ne décrit plus : corps fusionné, lot gardé où le code a changé ailleurs', () => {
  // un corps de page finit par un saut de ligne (l'éditeur l'écrit ainsi)
  const corps = (p) => `${texte(p)}\n`;
  const cas = [
    // [corps du site, corps du code, l'aperçu reste ?]
    ['fusionné', avec(0, 'Premier paragraphe de la page, du site.'), avec(2, 'Troisième paragraphe de la page, du code.'), false],
    ['gardé, le site gagne partout', avec(1, 'Deuxième paragraphe de la page, du site.'), avec(1, 'Deuxième paragraphe de la page, du code.'), true],
    ['gardé, le code a changé ailleurs', avec(1, 'Deuxième paragraphe de la page, du site.'), avec(2, 'Troisième.', avec(1, 'Deuxième paragraphe de la page, du code.')), false],
  ];
  for (const [nom, site, code, garde] of cas) {
    const r0 = reglesAvec(texte(P), (db) => db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(corps(P), PAGE));
    const dossier = chemin('vivante');
    preparerBaseVivante({ regles: r0, dossier });
    let db = ouvrir(dossier);
    const { lot } = enregistrer(db, { page: PAGE, operations: [{ op: 'modifier', table: 'page', cle: { id: PAGE }, valeurs: { corps_md: corps(site) }, apercu: apercuDe(corps(site)) }] });
    db.close();
    preparerBaseVivante({ regles: reglesAvec(texte(P), (x) => x.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(corps(code), PAGE)), dossier });
    db = ouvrir(dossier);
    const vue = lignesEnAttente(db).find((l) => l.table === 'page' && l.cle.id === PAGE);
    assert.ok(vue, nom);
    assert.equal(Array.isArray(vue.apercu), garde, `${nom} : ${JSON.stringify(vue.apercu)}`);
    if (!garde) assert.notEqual(vue.ligne.corps_md, corps(site), `${nom} : le corps en place n’est pas celui du site`);
    if (nom === 'fusionné') {
      const notee = journalExporte(db).lots.find((l) => l.id === lot).modifications.find((m) => m.table === 'page');
      assert.equal(notee.apercu, null, 'la modification réécrite au rejeu perd son aperçu');
    }
    db.close();
  }
});

test('lot annulé (base vivante d’avant) : un texte long ambigu se résout comme un lot gardé — choix 1 et 2 sur les passages en conflit seuls, le reste fusionné', () => {
  const r0 = regles(texte(P));
  const site = texte(avec(2, 'Troisième paragraphe du site.', avec(1, 'Deuxième paragraphe du site.')));
  const code = texte(avec(0, 'Premier paragraphe du code.', avec(1, 'Deuxième paragraphe du code.')));
  const { dossier, ids: [lot] } = siteDeDev(r0, [{ description: site }]);
  preparerBaseVivante({ regles: regles(code), dossier, garderLeSite: false });
  const siteGagne = texte(['Premier paragraphe du code.', 'Deuxième paragraphe du site.', 'Troisième paragraphe du site.']);
  const codeGagne = texte(['Premier paragraphe du code.', 'Deuxième paragraphe du code.', 'Troisième paragraphe du site.']);
  for (const [n, attendue] of [[1, siteGagne], [2, codeGagne]]) {
    const db = ouvrir(copie(dossier));
    assert.equal(metier(db).description, code, 'le lot annulé : la valeur du code en place');
    const d = diagnostic(db, lot);
    assert.equal(d.garde, false);
    const c = d.conflits.find((x) => x.colonne === 'description');
    assert.deepEqual([c.version_1.valeur, c.version_2.valeur], [site, code]);
    assert.deepEqual([c.valeur_1, c.valeur_2], [{ genre: 'valeur', valeur: siteGagne }, { genre: 'valeur', valeur: codeGagne }]);
    const choix = Object.fromEntries(d.conflits.map((x) => [x.id, { choix: x.id === c.id ? n : 2 }]));
    resoudreLeConflit(db, { lot, empreinte: d.empreinte, choix });
    assert.equal(metier(db).description, attendue, `choix ${n}`);
    db.close();
  }
});

test('un conflit dur (ligne supprimée par le code) avec le réglage de production : le lot entier est annulé, jamais gardé, même avec une fusion ambiguë', () => {
  const r0 = regles(texte(P));
  const dossier = chemin('vivante');
  preparerBaseVivante({ regles: r0, dossier });
  let db = ouvrir(dossier);
  const bonus = db.prepare('SELECT rang, option, texte FROM metier_bonus WHERE metier_id = ? ORDER BY rang, option LIMIT 1').get(METIER);
  assert.ok(bonus, 'le métier de l’import a un bonus');
  db.exec('BEGIN');
  const w = ouvrirLot(db, { id: '2026-11-12T09:00:00.000Z-000000-essai-fusion-dur', instant: '2026-11-12T09:00:00Z', pageId: METIER });
  w.modifier('metier', { id: METIER }, { description: texte(avec(1, 'Deuxième paragraphe du site.')) });
  w.modifier('metier_bonus', { metier_id: METIER, rang: bonus.rang, option: bonus.option }, { texte: `${bonus.texte} (site)` });
  w.terminer('Essai d’un conflit dur');
  db.exec('COMMIT');
  db.close();
  const code = texte(avec(1, 'Deuxième paragraphe du code.'));
  const { rejeu } = preparerBaseVivante({
    regles: reglesAvec(code, (x) => x.prepare('DELETE FROM metier_bonus WHERE metier_id = ? AND rang = ? AND option = ?').run(METIER, bonus.rang, bonus.option)), dossier,
  });
  assert.equal(rejeu.gardees, undefined, JSON.stringify(rejeu));
  db = ouvrir(dossier);
  assert.equal(metier(db).description, code, 'annulé en entier : la valeur du code');
  const d = diagnostic(db, '2026-11-12T09:00:00.000Z-000000-essai-fusion-dur');
  assert.equal(d.garde, false);
  assert.ok(d.conflits.some((c) => c.genre === 'ligne_supprimee'), JSON.stringify(d.conflits.map((c) => c.genre)));
  assert.doesNotMatch(db.prepare("SELECT detail FROM modification WHERE lot_id = '2026-11-12T09:00:00.000Z-000000-essai-fusion-dur' LIMIT 1").get().detail, /\{"reprise"/);
});
