// Rapprochement des classeurs et de la base, dans les deux sens (demande du propriétaire, 2026-10-15 ; décision R81 ; tools/sources/rapprocher.mjs,
// docs/sources.md, « Rapprochement d'un classeur ») : pour chaque instantané de sources/raw/classeurs/registre.json à l'état « rapproche », chaque ligne
// typée se lit dans les cellules qu'elle cite (orthographe des migrations défaite, valeurs d'import du site de dev), chaque cellule non vide est citée ou
// ignorée avec sa raison, chaque mot d'une cellule citée est dans la base, et les notes de cellule sont les mêmes de part et d'autre. Un écart fait
// échouer le test avec le relevé complet.
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import {
  adresse, avecCorrections, changements, citations, comparable, enA1, feuillesJson, formuleLisible, instantanesDuRegistre, lireRegistre, morceaux, nombreDEcarts, nombresDe,
  plage, rapport, rapprocher, remplacer, sansCorrections,
} from '../../tools/sources/rapprocher.mjs';
import { texteDInstantane } from '../../tools/sources/instantane.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';

const racine = new URL('../../', import.meta.url);
const lire = (chemin) => JSON.parse(readFileSync(new URL(chemin, racine), 'utf8'));
const cheminDe = (chemin) => new URL(chemin, racine).pathname;
const registre = lire('sources/raw/classeurs/registre.json');
const instantanes = instantanesDuRegistre();

test('adresses, plages et citations des source_ref', () => {
  assert.deepEqual(adresse('AB12'), { r: 12, c: 28 });
  assert.equal(enA1({ r: 12, c: 28 }), 'AB12');
  assert.equal(adresse('12'), null);
  assert.deepEqual(plage('C3:A1'), { r1: 1, c1: 1, r2: 3, c2: 3 });
  assert.deepEqual(citations('Classe Maverick V7 › Anansi › A2:L13, AM1:BA1 ; Classe Maverick V7 › Sommaire › I13:J13').map((c) => [c.onglet, c.plages.map((p) => p.texte)]),
    [['Anansi', ['A2:L13', 'AM1:BA1']], ['Sommaire', ['I13:J13']]]);
  assert.deepEqual(citations('Google Sheet « Classe Maverick V7 », onglet « Anansi »'), [{ classeur: 'Classe Maverick V7', onglet: 'Anansi', plages: [], illisibles: [], page: true }]);
  // Annotations : une parenthèse (même avec une virgule) et « décision R… » ne sont pas des plages ; un libellé de zone est illisible, jamais ignoré.
  const [dieu] = citations('Fiche auto V15.2.2 › Personnage › S5 (liste déroulante, rang 24)');
  assert.deepEqual([dieu.plages.map((p) => p.texte), dieu.illisibles], [['S5'], []]);
  assert.deepEqual(citations('Ressources et Craft › Accessoires › C4 ; décision R54')[0].illisibles, []);
  assert.deepEqual(citations('Les races › Majin › Don R (Race)')[0].illisibles, ['Don R']);
  assert.deepEqual(citations(null), []);
});

test('texte comparable, nombres, morceaux et valeurs JSON', () => {
  assert.equal(comparable('  l’armure  lourde\n'), "l'armure lourde");
  assert.deepEqual(morceaux('- 1 maîtrise Dague\n- 1 maîtrise au choix'), ['1 maîtrise Dague', '1 maîtrise au choix']);
  assert.deepEqual([...nombresDe('portée 4-18, 1 000 RO, -5 PV, 2,5')].sort((a, b) => a - b), [-5, 0, 1, 2.5, 4, 18, 1000]);
  assert.deepEqual([...nombresDe('1% -5% = Niveau 1 ; coût 7 (–1/NM)')].sort((a, b) => a - b), [-5, -1, 1, 5, 7]);
  assert.deepEqual(morceaux('Sang › Niveau 1'), ['Sang', 'Niveau 1']);
  assert.equal(formuleLisible('=IFERROR(__xludf.DUMMYFUNCTION("TEXTJOIN("", "",TRUE,A1:A3)"),"")'), 'TEXTJOIN(", ",TRUE,A1:A3)');
  assert.deepEqual(feuillesJson('{"elements":[{"nom":"Saut","n":2}]}'), { textes: ['Saut'], nombres: [2] });
  assert.equal(feuillesJson('Texte [entre crochets]'), null);
});

test('corrections d’orthographe dans les deux sens : occurrence par occurrence, jamais dans un mot ni deux fois', () => {
  const regs = [{ avant: 'Grace', apres: 'Grâce' }];
  assert.equal(sansCorrections('Grâce à son arme', regs), 'Grace à son arme');
  assert.equal(avecCorrections('Grace à son arme. Grâce à son armure', regs), 'Grâce à son arme. Grâce à son armure');
  // Plusieurs lignes portent la même correction ; le texte écrit déjà la forme corrigée : « mineure » ne devient pas « mineuree ».
  const mineure = [{ avant: 'panacée mineur', apres: 'panacée mineure' }, { avant: 'panacée mineur', apres: 'panacée mineure' }];
  assert.equal(avecCorrections('panacée mineur, panacée mineure', mineure), 'panacée mineure, panacée mineure');
  assert.equal(remplacer('une secte, ect', 'ect', 'etc'), 'une secte, etc');
  // Les corrections d'une ligne, dans l'ordre des migrations (elles peuvent se chevaucher : 0005 puis 0006) ; celles d'une autre ligne, sans chevauchement.
  const goule = [{ avant: 'Vivant ayant succombés à', apres: 'Vivant ayant succombé à' }, { avant: 'des Mort-Vivant', apres: 'des Morts-Vivants' }];
  assert.equal(sansCorrections('des Morts-Vivants ayant succombé à', goule), 'des Mort-Vivant ayant succombés à');
  assert.equal(avecCorrections('Une race méleant araignée', [], [{ avant: 'araignée', apres: 'araignées' }, { avant: 'race méleant araignée', apres: 'race mêlant araignée' }]),
    'Une race mêlant araignée');
});

test('chaque classeur du registre est rapproché ou en cours, avec son instantané et son registre', () => {
  for (const c of registre.classeurs) {
    assert.ok(['rapproche', 'en_cours'].includes(c.etat), `${c.titre} : état « ${c.etat} »`);
    const reg = lireRegistre(cheminDe(c.ignorer));
    for (const r of reg.regles) assert.ok(r.raison && (r.onglets ?? ['*']).length, `${c.ignorer} : une règle sans raison`);
    for (const [col, raison] of Object.entries(reg.derivees)) assert.ok(/^[a-z_]+\.[a-z0-9_]+$/.test(col) && raison, `${c.ignorer} : ${col}`);
    for (const l of reg.libelles) assert.ok(l.raison && (l.mots || l.valeurs), `${c.ignorer} : libellé sans raison, ou sans « mots » ni « valeurs »`);
    for (const v of reg.voulus) assert.ok(v.table && v.cle && v.colonne && typeof v.avant === 'string' && typeof v.apres === 'string' && v.raison, `${c.ignorer} : écart voulu incomplet`);
    for (const d of reg.conflits) assert.ok(['site', 'classeur'].includes(d.garder) && d.table && d.cle && d.colonne && d.decide_le && d.raison, `${c.ignorer} : conflit incomplet`);
    for (const m of reg.commentaires) assert.ok(m.onglet && adresse(m.cellule) && m.texte && m.raison, `${c.ignorer} : commentaire non importé incomplet`);
    for (const m of reg.copies) assert.ok(m.onglet && plage(m.plage) && m.de?.onglet && plage(m.de.plage) && m.raison, `${c.ignorer} : copie incomplète`);
  }
  assert.ok(registre.classeurs.some((c) => c.etat === 'rapproche'));
  assert.throws(() => lireRegistre(cheminDe('tools/sources/ignorer/absent.json')), /registre introuvable/);
  const inconnu = join(mkdtempSync(join(tmpdir(), 'registre-')), 'r.json');
  writeFileSync(inconnu, JSON.stringify({ regles: [], ignores: [] }));
  assert.throws(() => lireRegistre(inconnu), /section\(s\) inconnue\(s\) : ignores/);
});

test('un instantané se réécrit à l’identique (forme stable, rien de perdu)', () => {
  for (const c of registre.classeurs) {
    const texte = readFileSync(new URL(`sources/raw/classeurs/${c.fichier}`, racine), 'utf8');
    assert.equal(texteDInstantane(JSON.parse(texte)), texte, c.fichier);
  }
});

const db = ouvrirBase({ sansExemples: false });
const relever = (base, c, dump) => rapprocher(base, {
  classeur: c.titre, dump: dump ?? instantanes[c.titre], nomDuDump: `sources/raw/classeurs/${c.fichier}`, autres: instantanes, ...lireRegistre(cheminDe(c.ignorer)),
});
for (const c of registre.classeurs.filter((x) => x.etat === 'rapproche')) {
  test(`« ${c.titre} » et la base sont d’accord dans les deux sens`, () => {
    const R = relever(db, c);
    assert.ok(R.lignes > 0, 'des lignes de la base citent le classeur');
    assert.equal(nombreDEcarts(R), 0, rapport(R, { exemples: 50 }));
  });
}

const v7 = registre.classeurs.find((x) => x.titre === 'Classe Maverick V7');
const avecCellule = (onglet, r, c, changer) => {
  const dump = structuredClone(instantanes[v7.titre]);
  const x = dump.sheets.find((s) => s.name === onglet).cells.find((y) => y.r === r && y.c === c);
  x.v = changer(x.v);
  return dump;
};

test('le rapprochement voit un mot changé, un nombre changé et une cellule ajoutée', () => {
  const dump = structuredClone(instantanes[v7.titre]);
  const guerrier = dump.sheets.find((s) => s.name === 'Guerrier');
  const niveau = guerrier.cells.find((x) => typeof x.v === 'string' && x.v.startsWith('Lvl 20'));
  niveau.v = niveau.v.replace('Lvl 20', 'Lvl 21');
  const mot = guerrier.cells.find((x) => typeof x.v === 'string' && x.v.includes('dégâts') && x !== niveau);
  mot.v = mot.v.replace('dégâts', 'soins');
  guerrier.cells.push({ r: 99, c: 2, v: 'Nouvelle règle' });
  const R = relever(db, v7, dump);
  assert.equal(R.nombres.length, 1, 'le niveau changé');
  assert.ok(R.ecarts.length >= 1, 'le mot changé (base -> classeur)');
  assert.ok(R.motsAbsents.some((m) => m.mots.includes('soins')), 'le mot changé (classeur -> base)');
  assert.deepEqual(R.nonCitees.map((x) => `${x.onglet}!${x.cellule}`), ['Guerrier!B99']);
});

// Le site de dev est la source de ce qu'il modifie : une copie de la base où le site a supprimé ou modifié un don.
const dossier = mkdtempSync(join(tmpdir(), 'rapprochement-'));
after(() => rmSync(dossier, { recursive: true, force: true }));
const copieAvec = (nom, ecrire) => {
  const fichier = join(dossier, `${nom}.db`);
  copyFileSync(cheminBase({ sansExemples: false }), fichier);
  const w = new DatabaseSync(fichier);
  w.exec('PRAGMA foreign_keys = OFF');
  const id = 'capacites/anansi-piege-toile';
  const avant = { ...w.prepare('SELECT * FROM capacite WHERE id = ?').get(id) };
  const noter = (operation, av, ap) => w.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres)
    VALUES ('test-rapprochement', 1, '2026-10-15T00:00:00Z', 'test', NULL, 'capacite', ?, ?, ?, ?)`).run(JSON.stringify({ id }), operation, av && JSON.stringify(av), ap && JSON.stringify(ap));
  ecrire(w, id, avant, noter);
  w.close();
  return new DatabaseSync(fichier, { readOnly: true });
};
// « Piège-toile » est le nom du don dans Anansi!R11 (P11:U16).
const cellulePiege = (dump) => dump.sheets.find((s) => s.name === 'Anansi').cells.find((x) => x.r === 11 && x.c === 18);

test('une ligne supprimée par le site de dev se rapproche dans son état d’import ; sa cellule changée est un conflit', () => {
  const base = copieAvec('supprimee', (w, id, avant, noter) => { w.prepare('DELETE FROM capacite WHERE id = ?').run(id); noter('supprimer', avant, null); });
  assert.equal(cellulePiege(instantanes[v7.titre]).v, 'Piège-toile');
  const R = relever(base, v7);
  assert.equal(nombreDEcarts(R), 0, rapport(R, { exemples: 20 }));
  assert.deepEqual(R.site.supprimees.map((x) => x.ligne), ['capacite {"id":"capacites/anansi-piege-toile"}']);
  const C = relever(base, v7, avecCellule('Anansi', 11, 18, () => 'Piège-soie'));
  assert.deepEqual(C.conflits.map((x) => [x.colonne, x.note]), [['nom', 'ligne supprimée par le site de dev']]);
  base.close();
});

test('une colonne modifiée par le site de dev n’est pas un écart ; si sa cellule change aussi, c’est un conflit à trancher', () => {
  const base = copieAvec('modifiee', (w, id, avant, noter) => {
    w.prepare('UPDATE capacite SET nom = ? WHERE id = ?').run('Toile piégée', id);
    noter('modifier', { nom: avant.nom }, { nom: 'Toile piégée' });
  });
  const R = relever(base, v7);
  assert.equal(nombreDEcarts(R), 0, rapport(R, { exemples: 20 }));
  assert.deepEqual(R.site.modifiees.map((x) => [x.colonne, x.import, x.actuelle]), [['nom', 'Piège-toile', 'Toile piégée']]);
  const C = relever(base, v7, avecCellule('Anansi', 11, 18, () => 'Piège-soie'));
  assert.deepEqual(C.conflits.map((x) => [x.colonne, x.import, x.site]), [['nom', 'Piège-toile', 'Toile piégée']]);
  // La décision du propriétaire, inscrite au registre, résout le conflit tant que la cellule dit ce qu'il a vu.
  const decision = { table: 'capacite', cle: { id: 'capacites/anansi-piege-toile' }, colonne: 'nom', garder: 'site', valeur_classeur: 'Piège-soie', decide_le: '2026-10-15', raison: 'test' };
  const D = rapprocher(base, { ...lireRegistre(cheminDe(v7.ignorer)), classeur: v7.titre, dump: avecCellule('Anansi', 11, 18, () => 'Piège-soie'), autres: instantanes, conflits: [decision] });
  assert.equal(nombreDEcarts(D), 0, rapport(D, { exemples: 20 }));
  base.close();
});

test('une mise à jour du classeur : chaque cellule changée et les lignes de la base qu’elle touche (le contrôle que le rapprochement par ligne ne fait pas)', () => {
  // Une barrière de 1 devenue 5 : la ligne de la classe écrit déjà « 5 » ailleurs (classe de bouclier), le rapprochement ne la voit pas ; le diff, si.
  const apres = avecCellule('Guerrier', 5, 5, () => 5);
  assert.equal(nombreDEcarts(relever(db, v7, apres)), 0, 'limite documentée du rapprochement par ligne');
  assert.deepEqual(changements(db, { classeur: v7.titre, avant: instantanes[v7.titre], apres }), [
    { onglet: 'Guerrier', cellule: 'E5', avant: '1', apres: '5', lignes: ['classe {"id":"classes/guerrier"}'] },
  ]);
});

test('les tolérances du rapprochement, sur un classeur synthétique : première feuille, liste déroulante, écart voulu, commentaire écarté, autre classeur, source sans instantané, copie, entrée périmée', () => {
  const base = new DatabaseSync(':memory:');
  base.exec(`
    CREATE TABLE correction (classeur TEXT, onglet TEXT, cellule TEXT, champ TEXT, avant TEXT, apres TEXT);
    CREATE TABLE page_entite (entite_table TEXT, entite_id TEXT, page_id TEXT);
    CREATE TABLE note_cellule (entite_table TEXT, entite_id TEXT, rang INTEGER, texte TEXT, nature TEXT, source_ref TEXT, PRIMARY KEY (entite_table, entite_id, rang));
    CREATE TABLE commentaire_orphelin (id TEXT PRIMARY KEY, occurrence INTEGER, texte TEXT, source_ref TEXT);
    CREATE TABLE chose (id TEXT PRIMARY KEY, nom TEXT, source_ref TEXT);
  `);
  const ajouter = base.prepare('INSERT INTO chose VALUES (?, ?, ?)');
  ajouter.run('a', 'Alpha', 'Essai › première feuille › A1');                          // le premier onglet, sous le nom que lui donne l'import des races
  ajouter.run('b', 'Vert', 'Essai › Liste › B2 (liste déroulante, rang 2)');           // une saisie vide : sa liste de validation
  ajouter.run('c', "La lame d'Eaunoire", 'Essai › Texte › A1');                         // un écart voulu (décision), déclaré
  ajouter.run('d', 'xy', 'Essai › Texte › A2');                                          // une cellule qui porte un commentaire écarté à l'import
  ajouter.run('e', 'Bêta\nGamma', 'Essai › Texte › A3 ; Autre › Feuille › A1');          // une ligne qui cite deux classeurs
  ajouter.run('f', 'Delta\nEpsilon', 'Essai › Texte › A4 ; Google Doc « Notes » › Section'); // … dont l'un sans instantané
  ajouter.run('g', 'un\ndeux', 'Essai › Liste › D1:D2');                                 // la source d'une copie
  const dump = { sheets: [
    { name: 'Sommaire', cells: [{ r: 1, c: 1, v: 'Alpha' }] },
    { name: 'Liste', validations: [{ range: 'B2', type: 'list', formula1: '"Rouge,Vert"' }], cells: [{ r: 1, c: 4, v: 'un' }, { r: 2, c: 4, v: 'deux' }] },
    { name: 'Texte', cells: [
      { r: 1, c: 1, v: "La lame d'eau noire" }, { r: 2, c: 1, v: 'xy', threads: [{ text: 'salut', done: true }] }, { r: 3, c: 1, v: 'Bêta' }, { r: 4, c: 1, v: 'Delta' },
    ] },
    { name: 'Copie', cells: [{ r: 1, c: 1, v: 'un' }, { r: 2, c: 1, v: 'deux' }] },
  ] };
  const autres = { Autre: { sheets: [{ name: 'Feuille', cells: [{ r: 1, c: 1, v: 'Gamma' }] }] } };
  const registre = {
    voulus: [{ table: 'chose', cle: { id: 'c' }, colonne: 'nom', avant: "d'eau noire", apres: "d'Eaunoire", raison: 'décision' }],
    commentaires: [{ onglet: 'Texte', cellule: 'A2', texte: 'salut', raison: 'conversation' }],
    copies: [{ onglet: 'Copie', plage: 'A1:A2', de: { onglet: 'Liste', plage: 'D1:D2' }, raison: 'copie' }],
  };
  const R = rapprocher(base, { classeur: 'Essai', dump, autres, ...registre });
  assert.equal(nombreDEcarts(R), 0, rapport(R, { exemples: 20 }));
  assert.deepEqual([R.aRelire.map((x) => x.ligne), R.notes.declares, R.ignorees], [['chose {"id":"f"}'], 1, 2]);
  // Chaque tolérance retirée ou contredite redevient un écart.
  const sans = (cle) => rapprocher(base, { classeur: 'Essai', dump, autres, ...registre, [cle]: [] });
  assert.ok(sans('voulus').ecarts.length && sans('voulus').motsAbsents.length, 'écart voulu non déclaré');
  assert.equal(sans('commentaires').notes.manquantes.length, 1, 'commentaire non déclaré');
  assert.equal(sans('copies').nonCitees.length, 2, 'copie non déclarée');
  const copieChangee = structuredClone(dump);
  copieChangee.sheets[3].cells[1].v = 'trois';
  assert.equal(rapprocher(base, { classeur: 'Essai', dump: copieChangee, autres, ...registre }).copiesDifferentes.length, 1, 'copie qui diverge');
  const perimee = rapprocher(base, { classeur: 'Essai', dump, autres, ...registre, regles: [{ onglets: ['Texte'], plages: ['Z99'], raison: 'rien' }] });
  assert.deepEqual(perimee.perimees.map((x) => x.liste), ['regles'], 'entrée qui ne couvre plus rien');
  const sansAutre = rapprocher(base, { classeur: 'Essai', dump, ...registre });
  assert.ok(sansAutre.aRelire.some((x) => x.ligne === 'chose {"id":"e"}'), 'sans l’instantané de l’autre classeur, la ligne est à relire');
  base.close();
});
