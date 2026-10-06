// tools/sheets/xlsx_to_json.py et tools/sheets/xlsx_comments.py : les notes et les fils de commentaires de cellule d'un
// classeur .xlsx doivent arriver dans le dump JSON (champ `note`, comme tools/sheets/sheets_api_to_json.py ; champ `threads`
// pour les fils de commentaires), sans jamais se perdre en silence.
//
// Avant ce correctif, xlsx_to_json.py passait par openpyxl, qui (1) ne garde qu'UN commentaire par cellule (une note et un fil
// sur la même cellule : l'un des deux disparaît), (2) supprime avec un simple avertissement ceux des cellules fusionnées autres
// que la cellule en haut à gauche, et (3) ne lit pas les fils de commentaires. D'où une lecture directe du XML du classeur
// (xl/comments*.xml, xl/threadedComments/*.xml, relations de l'onglet), qui n'a besoin que de la bibliothèque standard :
// les tests de cette partie tournent partout ; ceux de la conversion complète sont sautés si openpyxl est absent.
// Le classeur est fabriqué à la main (fixtures/make-xlsx-notes.py, zipfile) : aucun .xlsx dans le dépôt.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const tool = (nom) => fileURLToPath(new URL(`../../tools/sheets/${nom}`, import.meta.url));
const fabrique = fileURLToPath(new URL('./fixtures/make-xlsx-notes.py', import.meta.url));
const python = spawnSync('python3', ['-I', '-c', 'pass']);
const openpyxl = spawnSync('python3', ['-I', '-c', 'import openpyxl']);
const sansPython = python.status !== 0 && 'python3 absent';
const sansOpenpyxl = (sansPython || (openpyxl.status !== 0 && 'openpyxl absent (dépendance de xlsx_to_json.py pour les .xlsx seulement)'));

const NOTE_DON = "Jet de vigueur pour esquiver l'altération d'état";
const NOTE_MULTI = 'Première ligne\nDeuxième ligne & <b> « accents » é\n  indentée ';

function classeur(variante = 'standard') {
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-notes-'));
  const xlsx = join(dir, 'classeur.xlsx');
  const run = spawnSync('python3', ['-I', fabrique, xlsx, variante], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return { dir, xlsx };
}

/** Lecture des commentaires seule (bibliothèque standard). */
function commentaires(xlsx) {
  const run = spawnSync('python3', ['-I', tool('xlsx_comments.py'), xlsx], { encoding: 'utf8' });
  return { ...run, json: run.status === 0 ? JSON.parse(run.stdout) : null };
}

/** Conversion complète .xlsx -> dump (openpyxl). */
function convertir(xlsx, sortie = join(mkdtempSync(join(tmpdir(), 'xlsx-dump-')), 'dump.json')) {
  const run = spawnSync('python3', ['-I', tool('xlsx_to_json.py'), xlsx, sortie], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return { ...run, dump: JSON.parse(readFileSync(sortie, 'utf8')) };
}

// ---------------------------------------------------------------------------------------------------------------------
// xlsx_comments.py : lecture directe du XML, sans openpyxl
// ---------------------------------------------------------------------------------------------------------------------

test('les notes sont lues à l’adresse exacte de leur cellule, texte tel que le classeur l’écrit', { skip: sansPython }, () => {
  const { json, status, stderr } = commentaires(classeur().xlsx);
  assert.equal(status, 0, stderr);
  const regles = json.sheets.find((s) => s.name === 'Règles');
  const note = (ref) => regles.notes.find((n) => n.ref === ref)?.text;
  assert.equal(note('A3'), NOTE_DON);
  assert.equal(note('C4'), 'Note sur une cellule vide', 'une note sur une cellule vide (aucun élément <c>) est lue');
  assert.equal(note('D5'), NOTE_MULTI, 'retours à la ligne, espaces de fin, « & », « < » et accents conservés tels quels');
  assert.equal(note('B3'), 'Gras puis normal', 'un texte riche (plusieurs segments) est concaténé');
});

test('une note n’est jamais amputée : le préfixe d’auteur « Jean: » écrit dans le texte est gardé', { skip: sansPython }, () => {
  const { json } = commentaires(classeur().xlsx);
  const autre = json.sheets.find((s) => s.name === 'Autre onglet');
  assert.deepEqual(autre.notes, [{ ref: 'B1', text: "Jean:\nNote de l'autre onglet" }]);
});

test('une note sur une cellule fusionnée non principale est lue à son adresse (openpyxl la supprime)', { skip: sansPython }, () => {
  const { json } = commentaires(classeur().xlsx);
  const regles = json.sheets.find((s) => s.name === 'Règles');
  assert.ok(regles.notes.some((n) => n.ref === 'F2' && n.text === 'Note sur cellule fusionnée'));
  assert.ok(regles.threads.some((t) => t.ref === 'E2' && t.text === 'Fil sur cellule fusionnée'));
});

test('les fils de commentaires sont lus à part des notes : réponses rattachées, état résolu, ordre du fichier', { skip: sansPython }, () => {
  const { json } = commentaires(classeur().xlsx);
  const regles = json.sheets.find((s) => s.name === 'Règles');
  const de = (ref) => regles.threads.filter((t) => t.ref === ref);
  assert.deepEqual(de('D5'), [{ ref: 'D5', text: 'Un fil résolu', done: true, replies: ['Marquée comme fermée'] }]);
  assert.deepEqual(de('G7').map((t) => t.text), ['Premier fil', 'Second fil'], 'deux fils sur la même cellule, dans l’ordre');
  assert.equal(de('G7')[0].done, undefined, 'done n’est écrit que pour un fil résolu');
  assert.equal(de('G7')[0].replies, undefined, 'replies n’est écrit que s’il y a des réponses');
});

test('le commentaire « ombre » d’un fil (« [Threaded comment] … ») n’est pas une note ; une note et un fil sur la même cellule coexistent', { skip: sansPython }, () => {
  const { json } = commentaires(classeur().xlsx);
  const regles = json.sheets.find((s) => s.name === 'Règles');
  assert.ok(regles.notes.every((n) => !n.text.startsWith('[Threaded comment]')));
  assert.deepEqual(regles.notes.map((n) => n.ref).sort(), ['A3', 'B3', 'C4', 'D5', 'F2']);
  assert.ok(regles.notes.some((n) => n.ref === 'D5') && regles.threads.some((t) => t.ref === 'D5'), 'D5 porte une note ET un fil');
});

test('tous les onglets sont listés, dans l’ordre du classeur, y compris sans commentaire ni relations', { skip: sansPython }, () => {
  const { json } = commentaires(classeur().xlsx);
  assert.deepEqual(json.sheets.map((s) => s.name), ['Règles', 'Autre onglet', 'Sans note']);
  assert.deepEqual(json.sheets[2], { name: 'Sans note', notes: [], threads: [] });
});

test('le classeur est une donnée non fiable : DTD, adresse invalide et note en double sont refusées avec un message clair', { skip: sansPython }, () => {
  const dtd = commentaires(classeur('dtd').xlsx);
  assert.notEqual(dtd.status, 0);
  assert.match(dtd.stderr, /DTD/);
  const ref = commentaires(classeur('ref-invalide').xlsx);
  assert.notEqual(ref.status, 0);
  assert.match(ref.stderr, /ZZZ/);
  const doublon = commentaires(classeur('doublon-note').xlsx);
  assert.notEqual(doublon.status, 0);
  assert.match(doublon.stderr, /A3/);
  assert.match(doublon.stderr, /deux notes/);
});

test('un commentaire « [Threaded comment] » dont le fil est absent est gardé comme note, avec un avertissement', { skip: sansPython }, () => {
  const { json, stderr, status } = commentaires(classeur('ombre-orpheline').xlsx);
  assert.equal(status, 0);
  assert.match(stderr, /G7/);
  const regles = json.sheets.find((s) => s.name === 'Règles');
  const note = regles.notes.find((n) => n.ref === 'G7');
  assert.ok(note && note.text.startsWith('[Threaded comment]') && note.text.endsWith('fil absent'), 'rien n’est perdu');
});

// ---------------------------------------------------------------------------------------------------------------------
// xlsx_to_json.py : le dump
// ---------------------------------------------------------------------------------------------------------------------

const cellule = (dump, onglet, r, c) => dump.sheets.find((s) => s.name === onglet).cells.find((x) => x.r === r && x.c === c);

test('une cellule avec valeur ET note : la note rejoint la cellule, la valeur est inchangée', { skip: sansOpenpyxl }, () => {
  const { dump } = convertir(classeur().xlsx);
  assert.deepEqual(cellule(dump, 'Règles', 3, 1), { r: 3, c: 1, v: 'Don', note: NOTE_DON });
  assert.deepEqual(cellule(dump, 'Règles', 3, 2), { r: 3, c: 2, v: 17, f: '=B2+1', note: 'Gras puis normal' }, 'formule, valeur en cache et note');
});

test('une cellule vide avec note : v vide + note ; une note et un fil sur la même cellule sont tous deux gardés', { skip: sansOpenpyxl }, () => {
  const { dump } = convertir(classeur().xlsx);
  assert.deepEqual(cellule(dump, 'Règles', 4, 3), { r: 4, c: 3, v: '', note: 'Note sur une cellule vide' });
  assert.deepEqual(cellule(dump, 'Règles', 5, 4), {
    r: 5, c: 4, v: 'Sort', note: NOTE_MULTI,
    threads: [{ text: 'Un fil résolu', done: true, replies: ['Marquée comme fermée'] }],
  });
  assert.deepEqual(cellule(dump, 'Règles', 7, 7), { r: 7, c: 7, v: '', threads: [{ text: 'Premier fil' }, { text: 'Second fil' }] });
});

test('une note ou un fil sur une cellule fusionnée non principale n’est pas perdu : il reste à son adresse', { skip: sansOpenpyxl }, () => {
  const { dump } = convertir(classeur().xlsx);
  assert.deepEqual(cellule(dump, 'Règles', 2, 6), { r: 2, c: 6, v: '', note: 'Note sur cellule fusionnée' });
  assert.deepEqual(cellule(dump, 'Règles', 2, 5), { r: 2, c: 5, v: '', threads: [{ text: 'Fil sur cellule fusionnée' }] });
  assert.deepEqual(dump.sheets[0].merged, ['E1:F2']);
  assert.deepEqual(cellule(dump, 'Règles', 1, 5), { r: 1, c: 5, v: 'Bloc' }, 'la cellule principale garde sa valeur, sans note');
});

test('plusieurs onglets : chaque note va dans son onglet ; un onglet sans commentaire est inchangé', { skip: sansOpenpyxl }, () => {
  const { dump } = convertir(classeur().xlsx);
  assert.deepEqual(dump.sheets.map((s) => s.name), ['Règles', 'Autre onglet', 'Sans note']);
  assert.deepEqual(cellule(dump, 'Autre onglet', 1, 2), { r: 1, c: 2, v: 'y', note: "Jean:\nNote de l'autre onglet" });
  assert.deepEqual(cellule(dump, 'Autre onglet', 1, 1), { r: 1, c: 1, v: 'x' });
  assert.deepEqual(dump.sheets[2].cells, [{ r: 1, c: 1, v: 'seul' }]);
});

test('sans note, la cellule est identique à celle d’avant : pas de clé « note » ni « threads » ; ordre par lignes puis colonnes', { skip: sansOpenpyxl }, () => {
  const { dump } = convertir(classeur().xlsx);
  assert.deepEqual(cellule(dump, 'Règles', 1, 1), { r: 1, c: 1, v: 'Titre' });
  assert.deepEqual(cellule(dump, 'Règles', 2, 2), { r: 2, c: 2, v: 16 });
  const positions = dump.sheets[0].cells.map((x) => [x.r, x.c]);
  assert.deepEqual(positions, [...positions].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  assert.deepEqual([dump.sheets[0].max_row, dump.sheets[0].max_col], [7, 7], 'les cellules qui ne portent qu’un commentaire comptent dans la dimension');
});

test('hors champs note et threads, le dump est identique à celui du même classeur sans commentaire', { skip: sansOpenpyxl }, () => {
  const { dump } = convertir(classeur().xlsx);
  const { dump: ref } = convertir(classeur('sans-commentaires').xlsx);
  const sansCommentaires = {
    sheets: dump.sheets.map((s) => ({
      ...s,
      max_row: undefined,
      max_col: undefined,
      cells: s.cells
        .filter((x) => !(x.v === '' && (x.note !== undefined || x.threads !== undefined) && x.f === undefined))
        .map(({ note, threads, ...reste }) => reste),
    })),
  };
  const attendu = { sheets: ref.sheets.map((s) => ({ ...s, max_row: undefined, max_col: undefined })) };
  assert.deepEqual(JSON.parse(JSON.stringify(sansCommentaires)), JSON.parse(JSON.stringify(attendu)));
});

test('contrôle de couverture : le dump porte exactement les notes et les fils que le XML du classeur déclare', { skip: sansOpenpyxl }, () => {
  const { xlsx } = classeur();
  const { json } = commentaires(xlsx);
  const colonne = (ref) => [...ref.match(/^[A-Z]+/)[0]].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0);
  const ligne = (ref) => Number(ref.match(/\d+$/)[0]);
  const attendues = new Set();
  let notes = 0;
  let fils = 0;
  for (const s of json.sheets) {
    for (const n of s.notes) { attendues.add(`${s.name}!${ligne(n.ref)},${colonne(n.ref)}`); notes += 1; }
    for (const t of s.threads) { attendues.add(`${s.name}!${ligne(t.ref)},${colonne(t.ref)}`); fils += 1; }
  }
  const { dump, stdout } = convertir(xlsx);
  const trouvees = new Set();
  let notesDump = 0;
  let filsDump = 0;
  for (const s of dump.sheets) {
    for (const x of s.cells) {
      if (x.note !== undefined) notesDump += 1;
      if (x.threads !== undefined) filsDump += x.threads.length;
      if (x.note !== undefined || x.threads !== undefined) trouvees.add(`${s.name}!${x.r},${x.c}`);
    }
  }
  assert.deepEqual([...trouvees].sort(), [...attendues].sort());
  assert.equal(notesDump, notes);
  assert.equal(filsDump, fils);
  assert.equal(notes, 6);
  assert.equal(fils, 4, 'quatre fils (la réponse « Marquée comme fermée » n’en est pas un)');
  assert.match(stdout.split('\n')[0], /^\d+ onglet\(s\), \d+ cellules -> /, 'la première ligne du résumé est inchangée');
  assert.match(stdout, new RegExp(`${notes} note\\(s\\)`), 'le résumé annonce le nombre de notes');
  assert.match(stdout, new RegExp(`${fils} fil\\(s\\)`), 'le résumé annonce le nombre de fils');
});

test('un classeur au contenu refusé (DTD) arrête la conversion au lieu de perdre ses notes', { skip: sansOpenpyxl }, () => {
  const { xlsx, dir } = classeur('dtd');
  const run = spawnSync('python3', ['-I', tool('xlsx_to_json.py'), xlsx, join(dir, 'dump.json')], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /DTD/);
});

test('le .csv reste converti sans openpyxl ni commentaire', { skip: sansPython }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-csv-'));
  writeFileSync(join(dir, 'a.csv'), 'a,b\n,c\n');
  const run = spawnSync('python3', ['-I', tool('xlsx_to_json.py'), join(dir, 'a.csv'), join(dir, 'a.json')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const dump = JSON.parse(readFileSync(join(dir, 'a.json'), 'utf8'));
  assert.deepEqual(dump.sheets[0].cells, [{ r: 1, c: 1, v: 'a' }, { r: 1, c: 2, v: 'b' }, { r: 2, c: 2, v: 'c' }]);
});
