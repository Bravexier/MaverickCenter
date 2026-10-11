// Le corps des pages typées suit leurs tables quand le site de dev les modifie (défaut D4 ; docs/serveur.md, « Édition ») : de bout en bout, par l'API
// du service (magies, sorts, races, classes, dons, métiers, créations), puis le journal rapatrié sur une copie de data/rows (db:appliquer-edition). Sur
// la copie : la nouvelle valeur est écrite dans le corps et l'ancienne n'y est plus (hors des citations de la fiche V15.2.2, jamais réécrites) ;
// chaque corps redit ses tables (rendus de lib/corps-*.mjs, ceux des importeurs) ; tools/db/races_onglet.py --verifier et tools/db/pages_md.py check
// passent ; la recherche (page_fts) trouve la nouvelle valeur et plus l'ancienne.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { choseASavoirSansTexte, corpsDeClasse, corpsDeDon, resumeDeDon } from '../src/lib/corps-classes.mjs';
import { donneesDeDon } from '../src/lib/dons-edition.mjs';
import { jsonCommePython } from '../src/lib/json-python.mjs';
import { corpsDeMagieApres, morceauxDuCorpsDeMagie } from '../src/lib/corps-magies.mjs';
import { corpsDeMetier, sansLiens } from '../src/lib/corps-metiers.mjs';
import { corpsDeRace, corpsDeRaceCreee, etatDeRace } from '../src/lib/corps-races.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { emettrePage, lirePages } from '../src/lib/pages-db.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROWS = join(RACINE, 'data', 'rows');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const tmp = mkdtempSync(join(tmpdir(), 'maverick-edition-corps-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

// --- modifications par l'API du service (base vivante du site de dev) --------------------------------------------------------------------------
const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(tmp, 'db') }).chemin);
const service = { base: () => vivante, etat: () => ({}), journal: () => {}, edition: true };
const lire = (sql, ...p) => vivante.prepare(sql).get(...p);
const corpsVivant = (id) => lire('SELECT corps_md FROM page WHERE id = ?', id).corps_md;
let nombreDeLots = 0;
function lot(operations, page = 'essai/') {
  const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page, operations }) }, service);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  nombreDeLots += 1;
  return r.corps;
}
const nomLibre = (table, base) => {
  for (let i = 1; ; i += 1) {
    const nom = i === 1 ? base : `${base} ${i}`;
    if (!lire(`SELECT 1 FROM "${table}" WHERE nom = ?`, nom)) return nom;
  }
};

const FEU = 'magies/magie-du-feu';
const OMBRE = 'magies/magie-de-lombre';
const BOULE = `${FEU}#sort:boule-de-feu`;
const MANTEAU = `${OMBRE}#sort:manteau-noir`;
const DRAKOS = 'races/drakos';
const ELFE_NOIR = 'races/elfe-noir';
const GUERRIER = 'classes/guerrier';
const MAITRE = `${GUERRIER}#specialite:maitre-darme`;
const BRAVE = 'capacites/guerrier-brave';
const HERBORISTE = 'metiers/herboriste';

// valeurs d'avant (l'ancienne valeur ne doit plus être écrite)
const avant = {
  feu: { ...lire('SELECT description, description_physique FROM magie WHERE id = ?', FEU) },
  roleFeu: lire("SELECT rang, role_brut FROM magie_role WHERE magie_id = ? AND role = 'entrave'", FEU),
  hyperFeu: lire("SELECT id, effet FROM mode_hyper_effet WHERE version = 'onglet_magie' AND magie_id = ? AND variante_brut = 'Mono-Magie'", FEU),
  boule: { ...lire('SELECT nom, cout_brut, dsb_brut, ordre FROM sort WHERE id = ?', BOULE) },
  drakos: { ...lire('SELECT histoire, sante_depart, avantages, don_base FROM race_onglet WHERE race_id = ?', DRAKOS) },
  caseDrakos: { ...lire('SELECT ligne, colonne, valeur FROM race_don_tableau_cellule WHERE race_id = ? AND ligne = 2 AND colonne = 2', DRAKOS) },
  donElfe: { ...lire("SELECT id, etiquette, nom, texte FROM race_don WHERE race_id = ? AND forme = 'ethnie' ORDER BY rang LIMIT 1", ELFE_NOIR) },
  hyperElfe: { ...lire("SELECT id, nom, effet FROM mode_hyper_effet WHERE version = 'onglet_race' AND race_id = ?", ELFE_NOIR) },
  guerrier: { ...lire('SELECT sante_depart, chakra_depart, barriere_depart, maitrise_arme, description, description_titre FROM classe WHERE id = ?', GUERRIER) },
  maitre: lire('SELECT nom FROM specialite WHERE id = ?', MAITRE).nom,
  brave: { ...lire('SELECT effet, remarque FROM capacite WHERE id = ?', BRAVE) },
  herboriste: corpsVivant(HERBORISTE),
  vide: lire("SELECT id, nom FROM magie WHERE id = 'magies/magie-du-vide'"),
  innees: vivante.prepare('SELECT magie_id FROM race_magie WHERE race_id = ? AND accessible = 1').all(DRAKOS).map((m) => m.magie_id),
};
const nouveau = {
  presentation: 'La magie zorglubpresentation brûle sans fin. Elle éclaire aussi.',
  physique: 'Les mages zorglubphysique ont des cheveux de braise.',
  role: 'PLACEMENT',
  hyperFeu: 'Effet zorglubhyper du feu en mono-magie.',
  boule: { nom: 'Boule de zorglubfeu', cout_brut: '5', dsb_brut: '3d6 dégâts (+1d6/NM)' },
  manteau: 'Manteau zorglubnoir',
  histoire: 'Histoire zorglubhistoire des Drakos.',
  sante: avant.drakos.sante_depart + 1,
  avantages: 'Avantage zorglubavantage du Drakos.',
  donBase: 'Don zorglubdonbase du Drakos.',
  case: 'zorglubcase',
  donElfe: { nom: 'Sang zorglubnom', texte: 'Don racial zorglubdonracial.' },
  hyperElfe: { nom: 'Condamné zorglubhypernom', effet: 'Effet zorglubhyperrace du peuple.' },
  guerrier: { sante_depart: avant.guerrier.sante_depart + 1, maitrise_arme: '- 1 maîtrise zorglubarme\n- 1 maîtrise Hache', description: 'Le Guerrier zorglubclasse frappe fort. Il ne recule jamais.' },
  maitre: 'MAÎTRE ZORGLUB',
  brave: { effet: 'Totalement zorglubeffet immunisé.', remarque: 'Remarque zorglubremarque ajoutée.' },
  herboristeLong: 'Premier zorglubpara un.\n\nSecond zorglubpara deux.',
  herboriste: 'Une seule ligne zorglubligne.',
};
const noms = { race: nomLibre('race', 'Race zorglub'), classe: nomLibre('classe', 'Classe zorglub') };

lot([
  { op: 'modifier', table: 'magie', cle: { id: FEU }, valeurs: { description: nouveau.presentation, description_physique: nouveau.physique } },
  { op: 'modifier', table: 'magie_role', cle: { magie_id: FEU, rang: avant.roleFeu.rang }, valeurs: { role_brut: nouveau.role } },
  { op: 'modifier', table: 'mode_hyper_effet', cle: { id: avant.hyperFeu.id }, valeurs: { effet: nouveau.hyperFeu } },
  { op: 'modifier', table: 'sort', cle: { id: BOULE }, valeurs: nouveau.boule },
], `${FEU}/`);
lot([{ op: 'modifier', table: 'sort', cle: { id: MANTEAU }, valeurs: { nom: nouveau.manteau } }], `${OMBRE}/`);
lot([
  { op: 'modifier', table: 'race_onglet', cle: { race_id: DRAKOS }, valeurs: { histoire: nouveau.histoire, sante_depart: nouveau.sante, avantages: nouveau.avantages, don_base: nouveau.donBase } },
  { op: 'modifier', table: 'race_don_tableau_cellule', cle: { race_id: DRAKOS, ligne: 2, colonne: 2 }, valeurs: { valeur: nouveau.case } },
  { op: 'magies_innees', race: DRAKOS, magies: avant.innees.filter((m) => m !== avant.vide.id) },
], `${DRAKOS}/`);
lot([
  { op: 'modifier', table: 'race_don', cle: { id: avant.donElfe.id }, valeurs: nouveau.donElfe },
  { op: 'modifier', table: 'mode_hyper_effet', cle: { id: avant.hyperElfe.id }, valeurs: nouveau.hyperElfe },
], `${ELFE_NOIR}/`);
lot([
  { op: 'modifier', table: 'classe', cle: { id: GUERRIER }, valeurs: nouveau.guerrier },
  { op: 'modifier', table: 'specialite', cle: { id: MAITRE }, valeurs: { nom: nouveau.maitre } },
  { op: 'modifier', table: 'capacite', cle: { id: BRAVE }, valeurs: nouveau.brave },
], `${GUERRIER}/`);
lot([{ op: 'modifier', table: 'metier', cle: { id: HERBORISTE }, valeurs: { description: nouveau.herboristeLong } }], 'metiers/');
const herboristeLong = corpsVivant(HERBORISTE);
lot([{ op: 'modifier', table: 'metier', cle: { id: HERBORISTE }, valeurs: { description: nouveau.herboriste } }], 'metiers/');
// créations : une race (son corps tiré de ses seules tables), modifiée ensuite ; une classe (une colonne de plus dans « Classes accessibles » des races)
const crees = lot([
  { op: 'creer', entite: 'race', valeurs: { nom: noms.race, nature: 'pure', presentation: 'Une race zorglubcreee.' } },
  { op: 'creer', entite: 'classe', valeurs: { nom: noms.classe, categorie_id: 'classe-magique', sante_depart: 6 } },
]).crees.map((c) => c.id);
const [raceCreee, classeCreee] = crees;
lot([
  { op: 'modifier', table: 'race_onglet', cle: { race_id: raceCreee }, valeurs: { histoire: 'Histoire zorglubcreee de la race.', sante_depart: 12 } },
  { op: 'modifier', table: 'classe', cle: { id: classeCreee }, valeurs: { description: 'Une classe zorglubclassecreee. Elle lance des sorts.' } },
], `${raceCreee}/`);
// Médusain : les trois dons dont l'onglet porte une note de cellule (O30, O34, O38) ; remarque modifiée, étiquette changée de graphie, remarque
// vidée puis remise (sa note de cellule revient sur la case du don)
const MEDUSAIN = { eau: 'races/medusain#don:eau-en-innee', foudre: 'races/medusain#don:foudre-en-innee', lumiere: 'races/medusain#don:lumiere-en-innee' };
lot([
  { op: 'modifier', table: 'race_don', cle: { id: MEDUSAIN.eau }, valeurs: { remarque: 'Jet de vigueur zorglubnote au tour suivant.' } },
  { op: 'modifier', table: 'race_don', cle: { id: MEDUSAIN.foudre }, valeurs: { etiquette: 'FOUDRE EN INNÉE' } },
  { op: 'modifier', table: 'race_don', cle: { id: MEDUSAIN.lumiere }, valeurs: { remarque: null } },
], 'races/medusain/');
lot([{ op: 'modifier', table: 'race_don', cle: { id: MEDUSAIN.lumiere }, valeurs: { remarque: 'Remarque zorglubrevenue.' } }], 'races/medusain/');
// formes que races_onglet.py ne sait pas relire dans le corps : refusées (422), rien n'est écrit
const donAnansi = lire("SELECT id FROM race_don WHERE race_id = 'races/anansi' AND forme = 'ethnie' ORDER BY rang").id;
const donUnique = lire("SELECT id FROM race_don WHERE forme = 'unique' ORDER BY id").id;
const refus = [
  { op: 'modifier', table: 'race_don', cle: { id: MEDUSAIN.eau }, valeurs: { etiquette: 'Eau en inné' } },
  { op: 'modifier', table: 'race_don', cle: { id: donUnique }, valeurs: { nom: 'Autre nom zorglub' } },
  { op: 'modifier', table: 'race_don', cle: { id: donAnansi }, valeurs: { remarque: 'Une remarque.' } },
  { op: 'modifier', table: 'race_don', cle: { id: donUnique }, valeurs: { remarque: 'Une remarque.' } },
  { op: 'modifier', table: 'race_don', cle: { id: donAnansi }, valeurs: { nom: 'Un nom' } },
  { op: 'modifier', table: 'race_onglet', cle: { race_id: 'races/mort-vivant' }, valeurs: { dons_tableau_titre: 'Un titre' } },
  { op: 'modifier', table: 'mode_hyper_effet', cle: { id: avant.hyperElfe.id }, valeurs: { nom: null } },
].map((op) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'essai/', operations: [op] }) }, service));
// D11 : une spécialité et ses dons créés dans la classe créée (une paire par « @i ») ; un don importé à note supprimé ; une spécialité importée
// supprimée avec ses dons (celle du don « Chasseur de primes » du Mercenaire : la correction tracée de sa cellule AC22 n'a plus de ligne, db:check l'ignore)
const D11 = {
  crees: lot([
    { op: 'creer', entite: 'specialite', valeurs: { classe_id: classeCreee, nom: 'ZORGLUBSPE', description: 'Spécialité zorglubspedesc.', don_nom: 'Zorglubcartouche', don_type: 'Passif', don_effet: 'Considérer comme classe magique.' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: classeCreee, specialite_id: '@0', niveau: '15', nom: 'Zorglubdon un', type: 'Actif', precision: '1 fois/combat', effet: 'Effet zorglubdonun. Et la suite.' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: classeCreee, specialite_id: '@0', avec: '@1', nom: 'Zorglubdon deux', type: 'Réaction', effet: 'Effet zorglubdondeux.' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: classeCreee, niveau: '5', nom: 'Zorglubdon trois', type: 'Passif' } },
  ], `${classeCreee}/`).crees.map((c) => c.id),
  // un don à note de cellule, dans un choix de deux d'une spécialité (lu avant d'écrire : le site a pu changer la base)
  donANote: vivante.prepare(`SELECT k.id FROM capacite k JOIN note_cellule n ON n.entite_table = 'capacite' AND n.entite_id = k.id
    WHERE k.nature = 'choix' AND k.specialite_id IS NOT NULL ORDER BY k.id`).all().map((k) => k.id)
    .find((id) => vivante.prepare("SELECT count(*) AS n FROM capacite a JOIN capacite b ON b.classe_id = a.classe_id AND b.ligne = a.ligne AND b.specialite_id = a.specialite_id AND b.nature = a.nature WHERE a.id = ?").get(id).n === 2),
  mercenaire: lire("SELECT specialite_id FROM capacite WHERE id = 'capacites/mercenaire-chasseur-de-primes'")?.specialite_id ?? null,
};
D11.donsDuMercenaire = D11.mercenaire ? vivante.prepare('SELECT id FROM capacite WHERE specialite_id = ?').all(D11.mercenaire).map((k) => k.id) : [];
lot([{ op: 'supprimer', entite: 'capacite', cle: { id: D11.donANote } }], 'classes/');
if (D11.mercenaire) lot([{ op: 'supprimer', entite: 'specialite', cle: { id: D11.mercenaire } }], 'classes/mercenaire/');

const journal = journalExporte(vivante);
vivante.close();

// --- le journal rapatrié sur une copie de data/rows ------------------------------------------------------------------------------------------
const rows = join(tmp, 'rows');
cpSync(ROWS, rows, { recursive: true });
const application = appliquerJournal(journal, { rows });
// les règles livrées contiennent maintenant le journal : le site de dev le rejoue (base-vivante#transferer), tout doit y être « intégré »
const lireRows = () => Object.fromEntries(readdirSync(rows).map((f) => [f, readFileSync(join(rows, f), 'utf8')]));
const rowsAppliquees = lireRows();
const seconde = appliquerJournal(journal, { rows });
const chemin = join(tmp, 'appliquee.db');
const construction = [
  spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', chemin, '--rows', rows], { encoding: 'utf8' }),
  spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-derive.mjs'), chemin], { encoding: 'utf8' }),
];
const db = new DatabaseSync(chemin, { readOnly: true });
after(() => db.close());
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const corps = (id) => ligne('SELECT corps_md FROM page WHERE id = ?', id).corps_md;
const executer = (sql, ...p) => lignes(sql, ...p);

/** Une section « ## Titre » du corps (jusqu'à la suivante), ou '' si elle n'y est pas. */
function section(c, titre, niveau = '##') {
  const lignesDuCorps = c.split('\n');
  const i = lignesDuCorps.indexOf(`${niveau} ${titre}`);
  if (i < 0) return '';
  const fin = lignesDuCorps.findIndex((l, j) => j > i && new RegExp(`^#{1,${niveau.length}} `).test(l));
  return lignesDuCorps.slice(i, fin < 0 ? undefined : fin).join('\n');
}
/** Les cases d'une ligne de tableau Markdown. */
const casesDe = (l) => l.slice(2, -2).split(/(?<!\\)\|/).map((c) => c.trim());
const debut = (texte) => texte.split('\n')[0].slice(0, 40);

test('le journal rapatrié s’applique sur la copie de data/rows ; chaque page réécrite y est une modification de la table page', () => {
  assert.equal(nombreDeLots, D11.mercenaire ? 14 : 13);
  assert.equal(journal.lots.length, nombreDeLots);
  assert.equal(application.ecrit, true, JSON.stringify(application.conflits));
  assert.deepEqual(application.conflits, []);
  for (const r of construction) assert.equal(r.status, 0, r.stderr);
  const pagesModifiees = new Set(journal.lots.flatMap((l) => l.modifications).filter((m) => m.table === 'page' && m.operation === 'modifier' && 'corps_md' in m.apres).map((m) => m.cle.id));
  for (const id of [FEU, OMBRE, DRAKOS, ELFE_NOIR, GUERRIER, BRAVE, HERBORISTE, raceCreee, classeCreee, 'bestiaire/bete-de-lombre']) assert.ok(pagesModifiees.has(id), id);
  // une colonne de plus dans la matrice des classes : « Nombre : N sur M » de toutes les races
  for (const r of lignes('SELECT id FROM race')) assert.ok(pagesModifiees.has(r.id), r.id);
});

test('rejoué une seconde fois (règles livrées qui le contiennent) : tout est « intégré », aucun conflit, data/rows ne change plus', () => {
  assert.deepEqual(seconde.conflits, []);
  assert.equal(seconde.bilan.appliquees, 0, JSON.stringify(seconde.bilan));
  assert.equal(seconde.bilan.integrees, journal.lots.reduce((n, l) => n + l.modifications.length, 0));
  assert.deepEqual(lireRows(), rowsAppliquees);
});

test('magie : présentation (et résumé), description physique, rôle, Mode Hyper, ligne du sort (nom, coût, D/S/B) ; sort renommé dans les pages du bestiaire', () => {
  const c = corps(FEU);
  const m = morceauxDuCorpsDeMagie(c);
  assert.ok(c.includes(nouveau.presentation));
  assert.ok(!c.includes(debut(avant.feu.description)), 'ancienne présentation');
  assert.equal(ligne('SELECT resume FROM page WHERE id = ?', FEU).resume, 'La magie zorglubpresentation brûle sans fin.');
  assert.ok(section(c, 'Description physique').includes(nouveau.physique));
  assert.ok(!c.includes(debut(avant.feu.description_physique)), 'ancienne description physique');
  assert.equal(m.roles[avant.roleFeu.rang - 1], nouveau.role);
  assert.ok(!m.roles.includes(avant.roleFeu.role_brut));
  assert.equal(m.hyper.find((h) => h.variante === 'Mono-Magie').effet, nouveau.hyperFeu);
  const cases = m.sorts[avant.boule.ordre - 1];
  assert.deepEqual([cases[1], cases[3], cases[6]], [nouveau.boule.nom, nouveau.boule.cout_brut, nouveau.boule.dsb_brut]);
  assert.equal(c.split(avant.boule.nom).length - 1, 0, 'ancien nom du sort');
  assert.ok(!c.includes(`| ${avant.boule.dsb_brut} |`), 'ancien D/S/B');
  const ombre = corps(OMBRE);
  assert.ok(ombre.includes(nouveau.manteau));
  for (const e of lignes('SELECT creature_id, libelle FROM creature_effet WHERE sort_id = ?', MANTEAU)) {
    assert.equal(e.libelle, `Effet "${nouveau.manteau}"`);
    assert.ok(corps(e.creature_id).split('\n').includes(`## Effet "${nouveau.manteau}"`), e.creature_id);
    assert.ok(!corps(e.creature_id).includes('## Effet "Manteau noir"'), e.creature_id);
  }
});

test('Médusain : la note de cellule d’un don suit sa remarque (modifiée, vidée puis remise sur sa case) ; une étiquette change de graphie', () => {
  const notes = Object.fromEntries(lignes("SELECT entite_id, cellule, texte FROM note_cellule WHERE entite_table = 'race_don'").map((n) => [n.entite_id, n]));
  assert.deepEqual(notes[MEDUSAIN.eau], { entite_id: MEDUSAIN.eau, cellule: 'O30', texte: 'Jet de vigueur zorglubnote au tour suivant.' });
  assert.equal(notes[MEDUSAIN.foudre].cellule, 'O34');
  assert.deepEqual(notes[MEDUSAIN.lumiere], { entite_id: MEDUSAIN.lumiere, cellule: 'O38', texte: 'Remarque zorglubrevenue.' });
  for (const [id, n] of Object.entries(notes)) assert.equal(ligne('SELECT remarque FROM race_don WHERE id = ?', id).remarque, n.texte, id);
  const c = section(corps('races/medusain'), 'Ethnies et dons raciaux');
  assert.ok(c.includes('Jet de vigueur zorglubnote au tour suivant.') && c.includes('Remarque zorglubrevenue.'));
  assert.ok(c.split('\n').includes('### FOUDRE EN INNÉE'));
});

test('formes que races_onglet.py ne relit pas : identifiant d’un don changé, remarque sans note de cellule, nom sans rubrique, titre du tableau du Mort-vivant, Mode Hyper sans nom : 422, rien n’est écrit', () => {
  for (const r of refus) {
    assert.equal(r.statut, 422, JSON.stringify(r.corps));
    assert.match(r.corps.erreur, /races_onglet\.py/);
  }
  assert.equal(journal.lots.length, nombreDeLots, 'aucun lot pour les refus');
});

test('race : histoire, santé, avantages, don de base, case du tableau, magies innées, don racial, Mode Hyper (les citations de la fiche restent)', () => {
  const c = corps(DRAKOS);
  assert.ok(section(c, 'Histoire').includes(nouveau.histoire));
  assert.ok(!c.includes(debut(avant.drakos.histoire)));
  const stats = section(c, 'Caractéristiques de départ').split('\n').filter((l) => l.startsWith('| '));
  assert.equal(casesDe(stats[2])[0], String(nouveau.sante));
  const ecart = c.split('\n').find((l) => l.startsWith('| Santé de départ<br>'));
  assert.equal(casesDe(ecart)[1], String(nouveau.sante), 'colonne « Onglet (retenu) » du tableau des écarts');
  assert.ok(section(c, 'Avantage(s) et inconvénient(s)').includes(`**Avantage(s)** : ${nouveau.avantages}`));
  assert.ok(!section(c, 'Avantage(s) et inconvénient(s)').includes(debut(avant.drakos.avantages)));
  assert.equal(section(c, 'Don de base').split('\n').slice(2).join('\n').trim(), nouveau.donBase);
  const eth = section(c, 'Ethnies et dons raciaux');
  const sang = eth.split('\n').find((l) => l.startsWith('| Sang |'));
  assert.equal(casesDe(sang)[1], nouveau.case);
  assert.ok(!sang.includes(avant.caseDrakos.valeur));
  const magies = section(c, 'Magies accessibles');
  assert.match(magies, new RegExp(`^Nombre : ${avant.innees.length - 1} sur 15\\.$`, 'm'));
  assert.ok(!magies.split('\n').find((l) => l.startsWith('Nombre :') === false && l.includes(', ')).split(', ').includes(avant.vide.nom));
  assert.ok(!JSON.parse(ligne('SELECT donnees FROM page WHERE id = ?', DRAKOS).donnees).magies_innees.includes(avant.vide.nom));
  const elfe = corps(ELFE_NOIR);
  const dons = section(elfe, 'Ethnies et dons raciaux');
  assert.ok(dons.includes(nouveau.donElfe.texte) && dons.includes(nouveau.donElfe.nom));
  assert.ok(!dons.includes(avant.donElfe.texte) && !dons.includes(avant.donElfe.nom));
  assert.equal(section(elfe, 'Capacité Mode Hyper').split('\n')[2], `**${nouveau.hyperElfe.nom}** : ${nouveau.hyperElfe.effet}`);
  assert.ok(!section(elfe, 'Capacité Mode Hyper').includes(avant.hyperElfe.nom));
});

test('classe : santé, maîtrises, présentation (et résumé), spécialité renommée ; don : effet et remarque ajoutée', () => {
  const c = corps(GUERRIER);
  const g = nouveau.guerrier;
  assert.ok(section(c, 'Don de départ').includes(`| ${g.sante_depart}.0 | ${avant.guerrier.chakra_depart}.0 | ${avant.guerrier.barriere_depart}.0 |`));
  assert.ok(!c.includes(`| ${avant.guerrier.sante_depart}.0 | ${avant.guerrier.chakra_depart}.0 |`));
  assert.ok(section(c, 'Maîtrise Arme', '###').includes('- 1 maîtrise zorglubarme'));
  assert.ok(!c.includes(avant.guerrier.maitrise_arme.split('\n')[0]));
  assert.ok(section(c, avant.guerrier.description_titre).includes(g.description));
  assert.ok(!c.includes(debut(avant.guerrier.description)));
  assert.equal(ligne('SELECT resume FROM page WHERE id = ?', GUERRIER).resume, 'Le Guerrier zorglubclasse frappe fort.');
  assert.ok(c.split('\n').includes(`### ${nouveau.maitre}`));
  assert.ok(!c.split('\n').includes(`### ${avant.maitre}`));
  assert.equal(corps(BRAVE), `${nouveau.brave.effet}\n\nNote de cellule : ${nouveau.brave.remarque}\n`);
  assert.equal(ligne('SELECT resume FROM page WHERE id = ?', BRAVE).resume, nouveau.brave.effet);
});

test('métier : une description sur plusieurs paragraphes puis sur une ligne ne laisse aucun paragraphe orphelin', () => {
  assert.ok(herboristeLong.includes('Premier zorglubpara un.\n\nSecond zorglubpara deux.'));
  const c = corps(HERBORISTE);
  assert.ok(c.split('\n').includes(`**Description du métier :** ${nouveau.herboriste}`));
  assert.ok(!c.includes('zorglubpara'));
  const sansDescription = (x) => x.replace(/^\*\*Description du métier :\*\*[^]*?\n\n(?=\*\*)/, '');
  assert.equal(sansDescription(c), sansDescription(avant.herboriste), 'les autres champs n’ont pas bougé');
  assert.equal(ligne('SELECT resume FROM page WHERE id = ?', HERBORISTE).resume, nouveau.herboriste);
});

test('pages créées par le site : le corps est le rendu de leurs tables, et le reste après une modification', () => {
  const etat = etatDeRace(executer, raceCreee);
  const c = corps(raceCreee);
  assert.equal(c, corpsDeRaceCreee(etat));
  assert.equal(corpsDeRace(c, etat), c, 'recalculé avec les mêmes tables : inchangé');
  assert.ok(section(c, 'Histoire').includes('Histoire zorglubcreee de la race.'));
  assert.match(section(c, 'Classes accessibles'), /^Nombre : 0 sur \d+\.$/m);
  const classe = ligne('SELECT * FROM classe WHERE id = ?', classeCreee);
  const cc = corps(classeCreee);
  // sa spécialité créée ensuite (D11) a sa bannière
  assert.equal(cc, corpsDeClasse({
    classe, categorie: ligne('SELECT * FROM categorie_classe WHERE id = ?', classe.categorie_id), specialites: lignes('SELECT * FROM specialite WHERE classe_id = ?', classeCreee),
    dons: lignes('SELECT id, specialite_id FROM capacite WHERE classe_id = ?', classeCreee),
  }));
  assert.ok(cc.includes('Une classe zorglubclassecreee. Elle lance des sorts.'));
});

test('chaque corps redit ses tables sur la copie : magies, races, classes, dons, métiers (rendus des importeurs, lib/corps-*.mjs)', () => {
  const pages = new Map(lignes('SELECT id, corps_md FROM page').map((p) => [p.id, p.corps_md]));
  const tables = {
    magie: lignes('SELECT * FROM magie'),
    magie_role: lignes('SELECT * FROM magie_role'),
    mode_hyper_effet: lignes("SELECT * FROM mode_hyper_effet WHERE version = 'onglet_magie'"),
    sort: lignes('SELECT * FROM sort'),
  };
  for (const [table, ls] of Object.entries(tables)) {
    for (const l of ls) {
      const id = table === 'magie' ? l.id : l.magie_id;
      assert.equal(corpsDeMagieApres(pages.get(id), table, l, l), pages.get(id), `${table} ${l.id ?? `${l.magie_id} ${l.rang}`}`);
    }
  }
  for (const r of lignes('SELECT id FROM race')) assert.equal(corpsDeRace(pages.get(r.id), etatDeRace(executer, r.id)), pages.get(r.id), r.id);
  for (const classe of lignes('SELECT * FROM classe')) {
    const c = pages.get(classe.id);
    const L = {
      classe,
      categorie: ligne('SELECT * FROM categorie_classe WHERE id = ?', classe.categorie_id),
      specialites: lignes('SELECT * FROM specialite WHERE classe_id = ?', classe.id),
      dons: lignes('SELECT specialite_id FROM capacite WHERE classe_id = ?', classe.id),
      annexe: lignes('SELECT * FROM classe_annexe WHERE classe_id = ?', classe.id),
    };
    assert.equal(corpsDeClasse(L, { choseASavoirSansTexte: choseASavoirSansTexte(c) }), c, classe.id);
  }
  for (const don of lignes('SELECT * FROM capacite')) assert.equal(corpsDeDon(don), pages.get(don.id), don.id);
  for (const m of lignes('SELECT * FROM metier')) assert.equal(sansLiens(pages.get(m.id)), corpsDeMetier(m), m.id);
});

test('D11 : spécialité et dons créés, don à note et spécialité importée supprimés, rapatriés : fiches (corps, résumé, donnees), corps de la classe, recherche', () => {
  const [spe, un, deux, trois] = D11.crees;
  assert.equal(spe, `${classeCreee}#specialite:zorglubspe`);
  const cartouche = ligne("SELECT id FROM capacite WHERE specialite_id = ? AND nature = 'specialite'", spe).id;
  const specialites = lignes('SELECT * FROM specialite WHERE classe_id = ?', classeCreee);
  const dons = lignes('SELECT * FROM capacite WHERE classe_id = ?', classeCreee);
  assert.deepEqual(dons.map((d) => d.id).sort(), [cartouche, un, deux, trois].sort());
  for (const don of dons) {
    const page = ligne('SELECT * FROM page WHERE id = ?', don.id);
    assert.equal(page.corps_md, corpsDeDon(don), don.id);
    assert.equal(page.resume, resumeDeDon(don), don.id);
    assert.equal(page.donnees, jsonCommePython(donneesDeDon(don, { specialites, donsDeLaClasse: dons })), don.id);
    assert.deepEqual([page.origine, page.statut, page.type], ['classes', 'draft', 'capacites']);
    const sources = lignes('SELECT s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ?', don.id);
    assert.equal(sources.length, 1, don.id);
    assert.ok(sources[0].texte.startsWith('Site de dev › '), don.id);
  }
  assert.deepEqual(JSON.parse(ligne('SELECT donnees FROM page WHERE id = ?', un).donnees).choix_exclusif_avec, [deux]);
  assert.equal(ligne('SELECT nature FROM capacite WHERE id = ?', trois).nature, 'classe');
  const classe = ligne('SELECT * FROM classe WHERE id = ?', classeCreee);
  const categorie = ligne('SELECT * FROM categorie_classe WHERE id = ?', classe.categorie_id);
  assert.equal(corps(classeCreee), corpsDeClasse({ classe, categorie, specialites, dons, annexe: [] }));
  assert.ok(corps(classeCreee).split('\n').includes('### ZORGLUBSPE'));
  // supprimés : ni ligne, ni fiche, ni note ; dans sa spécialité, le survivant reste un choix sans alternative
  assert.equal(ligne('SELECT 1 FROM capacite WHERE id = ?', D11.donANote), undefined);
  assert.equal(ligne('SELECT 1 FROM page WHERE id = ?', D11.donANote), undefined);
  assert.equal(ligne("SELECT 1 FROM note_cellule WHERE entite_table = 'capacite' AND entite_id = ?", D11.donANote), undefined);
  if (D11.mercenaire) {
    assert.equal(ligne('SELECT 1 FROM specialite WHERE id = ?', D11.mercenaire), undefined);
    for (const id of D11.donsDuMercenaire) assert.equal(ligne('SELECT 1 FROM page WHERE id = ?', id), undefined, id);
    assert.ok(!corps('classes/mercenaire').includes('### CHASSEUR DE PRIMES'));
    assert.equal(ligne("SELECT count(*) AS n FROM historique_modification WHERE table_nom = 'capacite' AND operation = 'supprimer'").n >= D11.donsDuMercenaire.length, true);
  }
  // recherche : page_fts (db-derive) trouve les dons créés
  const trouve = (mot) => lignes('SELECT page_id FROM page_fts WHERE page_fts MATCH ? ORDER BY page_id', mot).map((l) => l.page_id);
  assert.deepEqual(trouve('zorglubdonun'), [un]);
  assert.deepEqual(trouve('zorglubdondeux'), [deux]);
});

test('db:check passe sur la base construite depuis la copie', () => {
  const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-check.mjs'), chemin], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // la correction tracée de la cellule AC22 du Mercenaire (« Chasseur de primes ») : sa seule ligne supprimée par le site, elle est ignorée
  if (D11.mercenaire) assert.equal(JSON.parse(r.stdout).bilan.corrections_lignes_supprimees, 1);
});

test('recherche (page_fts) : la nouvelle valeur est trouvée dans sa page, l’ancienne nulle part', () => {
  const trouve = (mot) => lignes('SELECT page_id FROM page_fts WHERE page_fts MATCH ? ORDER BY page_id', mot).map((l) => l.page_id);
  assert.deepEqual(trouve('zorglubpresentation'), [FEU]);
  assert.deepEqual(trouve('zorglubfeu'), [FEU]);
  assert.deepEqual(trouve('zorglubhistoire'), [DRAKOS]);
  assert.deepEqual(trouve('zorglubdonracial'), [ELFE_NOIR]);
  assert.deepEqual(trouve('zorglubhyperrace'), [ELFE_NOIR]);
  assert.deepEqual(trouve('zorglubclasse'), [GUERRIER]);
  assert.deepEqual(trouve('zorglubeffet'), [BRAVE]);
  assert.deepEqual(trouve('zorglubremarque'), [BRAVE]);
  assert.deepEqual(trouve('zorglubligne'), [HERBORISTE]);
  assert.deepEqual(trouve('zorglubpara'), [], 'valeur intermédiaire du métier');
  assert.deepEqual(trouve('zorglubcreee'), [raceCreee]);
});

test('tools/db/races_onglet.py --verifier (races importées ; une race créée par le site n’a pas d’onglet) et pages_md check passent sur la copie', { skip: sansPython }, () => {
  const onglet = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'races_onglet.py'), '--verifier', '--rows', rows], { encoding: 'utf8' });
  assert.equal(onglet.status, 0, onglet.stdout + onglet.stderr);
  assert.match(onglet.stdout, /conformes aux pages \(race_onglet 27,/);
  const wiki = join(tmp, 'wiki');
  for (const p of lirePages(db)) {
    mkdirSync(join(wiki, p.type), { recursive: true });
    writeFileSync(join(wiki, p.type, `${p.slug}.md`), emettrePage(p));
  }
  const check = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'pages_md.py'), 'check', '--rows', rows, '--wiki', wiki], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.match(check.stdout, /est à jour/);
});
