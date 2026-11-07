// La garde des ancres figées des intertitres (lib/ancres-figees.mjs ; décision du chef technique, lot « Défauts du code ») : l'ancre `{#…}` d'un
// intertitre est un identifiant, unique dans sa page (docs/content-guide.md, « Ancres figées des intertitres ») ; le service d'édition refuse (400) un
// texte qui en retire, en renomme ou en double une (serveur/edition.mjs#modifier, l'API /api/v1/ comprise), et accepte une ancre ajoutée ou l'intertitre
// renommé qui garde la sienne. Au rejeu (service, mise à jour, db:appliquer-edition), un lot noté avant cette garde qui romprait une ancre des règles
// passe en conflit avec son motif, et n'a que le choix 2 (serveur/edition.mjs#ecrituresQuiRompentLesAncres, comme COLONNES_FIGEES). Les ancres
// d'essai sont posées par le test (par le service, ou dans sa copie des règles) : aucune page, ancre ni texte de la base n'est supposé.
//   node --test test/serveur-edition-ancres-figees.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ecrituresQuiRompentLesAncres, rejouerLeJournal } from '../serveur/edition.mjs';
import { examinerLeLot } from '../serveur/edition-conflits.mjs';
import { chargerJournal, nouveauLot } from '../serveur/edition-journal.mjs';
import { ancresDuCorps } from '../src/lib/ancres-figees.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { texteDePageModifiable } from '../src/lib/edition-modele.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const dossier = dossierTemporaire('ancres-figees');
const PID = process.pid;
const A = `essai-a-${PID}`;
const B = `essai-b-${PID}`;
/** Deux sections d'essai, chacune sous un intertitre à ancre figée, ajoutées au bout d'un corps. */
const sections = (titreA = 'Essai A', titreB = 'Essai B', ancreA = A, ancreB = B) =>
  `\n\n## ${titreA} {#${ancreA}}\n\nPremière section d’essai.\n\n## ${titreB} {#${ancreB}}\n\nSeconde section d’essai.\n`;

let n = 0;
/** Une base vivante d'essai ; `poser(db)` écrit d'abord dans sa copie des règles (un texte précis que le test pose lui-même). */
function vivante(poser) {
  const regles = join(dossier, `regles${(n += 1)}.db`);
  copyFileSync(cheminBase({ sansExemples: false }), regles);
  if (poser) {
    const r = new DatabaseSync(regles);
    try {
      poser(r);
    } finally {
      r.close();
    }
  }
  return ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: join(dossier, `b${n}`) }).chemin);
}

/** Les pages dont le texte se modifie (guide), choisies dans l'état courant, dans l'ordre de leur id. */
const pagesDuGuide = (db) => db.prepare("SELECT id, type, corps_md FROM page WHERE type = 'guide' ORDER BY id").all()
  .filter((p) => texteDePageModifiable(p.type, null));

const service = (db) => {
  const s = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);
  const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
  const ecrire = (id, texte) => appel('POST', '/api/edition/', { page: id, operations: [{ op: 'modifier', table: 'page', cle: { id }, valeurs: { corps_md: texte } }] });
  return { appel, corps, ecrire };
};

test('service : ajouter des ancres passe ; retirer, renommer ou doubler une ancre est refusé (400, l’ancre nommée) ; renommer l’intertitre en gardant l’ancre passe', () => {
  const db = vivante();
  try {
    const s = service(db);
    // une page du guide qui accepte deux sections de plus (son texte se modifie, ses blocs se lisent) : la première de l'état courant
    const page = pagesDuGuide(db).find((p) => s.ecrire(p.id, `${p.corps_md.trimEnd()}${sections()}`).statut === 200);
    assert.ok(page, 'une page du guide reçoit des ancres nouvelles');
    const pose = s.corps(page.id);
    assert.deepEqual(ancresDuCorps(pose).filter((a) => a.ancre === A || a.ancre === B).map((a) => a.ancre), [A, B], 'les ancres ajoutées, écrites');
    const refuse = (texte, ...ancres) => {
      const r = s.ecrire(page.id, texte);
      assert.equal(r.statut, 400, JSON.stringify(r.corps));
      for (const ancre of ancres) assert.ok(r.corps.erreur.includes(`{#${ancre}}`), r.corps.erreur);
      assert.equal(s.corps(page.id), pose, 'rien d’écrit');
    };
    // l'intertitre et sa section retirés
    refuse(pose.replace(`## Essai A {#${A}}\n\nPremière section d’essai.\n\n`, ''), A);
    // la marque seule retirée (l'intertitre reste)
    refuse(pose.replace(` {#${A}}`, ''), A);
    // l'ancre renommée
    refuse(pose.replace(`{#${A}}`, `{#${A}-bis}`), A);
    // l'ancre doublée sur un autre intertitre
    refuse(`${pose.trimEnd()}\n\n## Encore {#${B}}\n\nTroisième.\n`, B);
    // toutes les ancres réécrites en une seule (contrôle par mutation v2) : chacune disparaît, et la nouvelle est doublée
    refuse(pose.replace(/\{#[a-z0-9-]+\}/g, '{#plouf}'), A, B, 'plouf');
    // l'intertitre renommé, son ancre gardée ; une section ajoutée avec son ancre ; le texte d'une section changé : accepté
    const renomme = pose.replace(`## Essai A {#${A}}`, `## Essai A renommé {#${A}}`).replace('Seconde section d’essai.', 'Seconde section, réécrite.')
      + `\n## Essai C {#essai-c-${PID}}\n\nTroisième section.\n`;
    const ok = s.ecrire(page.id, renomme);
    assert.equal(ok.statut, 200, JSON.stringify(ok.corps));
    assert.deepEqual(ancresDuCorps(s.corps(page.id)).filter((a) => a.ancre.endsWith(`-${PID}`)).map((a) => [a.ancre, a.texte]),
      [[A, 'Essai A renommé'], [B, 'Essai B'], [`essai-c-${PID}`, 'Essai C']]);
  } finally {
    db.close();
  }
});

test('API /api/v1/ : le PATCH d’une page du guide suit la même garde (400 qui nomme l’ancre) ; garder l’ancre passe', () => {
  const db = vivante();
  try {
    const s = service(db);
    const page = pagesDuGuide(db).find((p) => s.ecrire(p.id, `${p.corps_md.trimEnd()}${sections()}`).statut === 200);
    assert.ok(page);
    const adresse = `/api/v1/pages-du-guide/${encodeURIComponent(page.id)}/`;
    const pose = s.corps(page.id);
    const refus = s.appel('PATCH', adresse, { corps_md: pose.replace(`{#${B}}`, '{#autre}') });
    assert.equal(refus.statut, 400, JSON.stringify(refus.corps));
    assert.ok(refus.corps.erreur.includes(`{#${B}}`), refus.corps.erreur);
    assert.equal(s.corps(page.id), pose);
    const ok = s.appel('PATCH', adresse, { corps_md: pose.replace(`## Essai B {#${B}}`, `## Essai B (v1) {#${B}}`) });
    assert.equal(ok.statut, 200, JSON.stringify(ok.corps));
    assert.ok(s.corps(page.id).includes(`## Essai B (v1) {#${B}}`));
  } finally {
    db.close();
  }
});

test('adaptateur du rejeu : une écriture qui romprait une ancre des règles est une forme ancienne sans équivalent (`conflit` qui nomme l’ancre) ; une ancre gardée, une colonne sans intertitre passent', () => {
  let id;
  const db = vivante((r) => {
    id = pagesDuGuide(r)[0].id;
    r.prepare('UPDATE page SET corps_md = corps_md || ? WHERE id = ?').run(sections(), id);
  });
  try {
    const adapter = ecrituresQuiRompentLesAncres(db);
    const regle = db.prepare('SELECT corps_md, titre FROM page WHERE id = ?').get(id);
    const m = (apres, table = 'page', cle = { id }) => ({ lot_id: 'l', rang: 1, table_nom: table, operation: 'modifier', cle: JSON.stringify(cle),
      avant: JSON.stringify({}), apres: JSON.stringify(apres) });
    const casse = adapter(m({ corps_md: regle.corps_md.replace(` {#${A}}`, '') }));
    assert.ok(casse.conflit?.includes(`{#${A}}`), JSON.stringify(casse));
    assert.ok(adapter(m({ corps_md: regle.corps_md.replace(/\{#[a-z0-9-]+\}/g, '{#plouf}') })).conflit?.includes('{#plouf}'), 'le doublon nommé');
    for (const tel of [
      m({ corps_md: regle.corps_md.replace('## Essai A', '## Essai A renommé') }), // l'ancre gardée
      m({ corps_md: regle.corps_md }), // la valeur déjà dans les règles
      m({ titre: `${regle.titre} (essai)` }), // une colonne sans intertitre
    ]) assert.equal(adapter(tel), tel);
  } finally {
    db.close();
  }
});

test('rejeu : un lot ancien qui retire une ancre des règles passe en conflit avec son motif, rien n’en est écrit ; sur la page « Mise à jour », seul le choix 2 ; un lot qui la garde passe', () => {
  let id;
  const db = vivante((r) => {
    id = pagesDuGuide(r)[0].id;
    r.prepare('UPDATE page SET corps_md = corps_md || ? WHERE id = ?').run(sections(), id);
  });
  try {
    const regle = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
    const casse = nouveauLot();
    const garde = nouveauLot();
    const lot = (l, apres) => ({ id: l.id, fait_le: l.instant, page_id: id, resume: 'Texte modifié', modifications: [
      { rang: 1, table: 'page', cle: { id }, operation: 'modifier', avant: { corps_md: regle }, apres: { corps_md: apres } },
    ] });
    const garde2 = regle.replace(`## Essai B {#${B}}`, `## Essai B renommé {#${B}}`);
    const journal = { format: 'maverick-edition/1', lots: [lot(casse, regle.replace(`{#${A}}`, `{#${A}-ancien}`)), lot(garde, garde2)] };
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, journal);
    const bilan = rejouerLeJournal(db);
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    assert.equal(bilan.conflits, 1);
    const etat = (l) => db.prepare('SELECT etat, detail FROM modification WHERE lot_id = ?').get(l);
    assert.equal(etat(casse.id).etat, 'conflit');
    assert.ok(etat(casse.id).detail.includes(`{#${A}}`), etat(casse.id).detail);
    assert.notEqual(etat(garde.id).etat, 'conflit', etat(garde.id).detail);
    assert.equal(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md, garde2, 'le lot qui garde l’ancre, seul écrit');
    const diag = examinerLeLot(db, casse.id);
    assert.equal(diag.conflits.length, 1);
    assert.deepEqual([diag.conflits[0].table, diag.conflits[0].choix_possibles], ['page', [2]]);
  } finally {
    db.close();
  }
});
