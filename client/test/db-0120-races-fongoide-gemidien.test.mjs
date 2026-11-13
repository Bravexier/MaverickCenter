// Migration data/migrations/0120-races-fongoide-gemidien.sql (lot 4 « Races » de la mise à jour de Décembre) : décisions R239 (Fongoïde et Gémidien,
// deux races pures : don de base des races pures, une ethnie chacune sans don d'ethnie, classes comme les races pures, le Fongoïde sans Barde ni
// Parleur), R256 (vitesse 4 au sol, 4 à la nage), R13 (le reste suit leurs onglets : 14 magies innées pour le Fongoïde, R14, R22 ; le Gémidien
// mono-magie, R28, sans Potentiel Illimité ni Corruption), et les Modes Hyper de l'Elfe argenté et du Felfe changés par le docx (R237 (12)).
// Le site de dev est la source de ce qu'il modifie : les valeurs que la migration écrit se lisent dans la base d'import (test/aide-base-d-import.mjs) ;
// l'état courant ne garde que des invariants (chaque race a ses lignes, son corps redit ses tables). Aucun texte de l'onglet n'est écrit ici : les ids
// des deux races et les textes réécrits viennent du registre de la migration (test/aide-races-0120.mjs).
//   node --test test/db-0120-races-fongoide-gemidien.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corpsDeRaceCreee, etatDeRace } from '../src/lib/corps-races.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { effetsDuModeHyper } from '../src/lib/mode-hyper-texte.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { ORDRE_DES_RACES } from '../src/lib/race-kinds.mjs';
import { chargerRaces } from '../src/lib/races-db.mjs';
import { baseDImport, reglesDImport } from './aide-base-d-import.mjs';
import { MOTS_CLES_DE_LA_0120, RACES_DE_LA_0120, TEXTES_DE_LA_0120 } from './aide-races-0120.mjs';

const db = ouvrirBase({ sansExemples: false });
const dImport = baseDImport();
const [FONGOIDE, GEMIDIEN] = [...RACES_DE_LA_0120];
const PI = 'magies/potentiel-illimite';
const CORRUPTION = 'magies/magie-de-la-corruption';
const HUMAIN = 'races/humain';
const un = (base, sql, ...p) => base.prepare(sql).get(...p);
const tous = (base, sql, ...p) => base.prepare(sql).all(...p);

test('registre : deux races, Fongoïde puis Gémidien (ids figés), chacune avec sa page', () => {
  assert.deepEqual([FONGOIDE, GEMIDIEN], ['races/fongoide', 'races/gemidien']);
  for (const id of RACES_DE_LA_0120) {
    assert.ok(un(db, 'SELECT 1 FROM race WHERE id = ?', id), id);
    assert.ok(un(db, "SELECT 1 FROM page WHERE id = ? AND type = 'races'", id), `${id} : sa page`);
    assert.ok(un(db, "SELECT 1 FROM page_entite WHERE entite_table = 'race' AND entite_id = ? AND page_id = ? AND principale = 1", id, id), id);
  }
});

test('R239 (1) : deux races pures, à la fin des races pures (ORDRE_DES_RACES, race.ordre et race.rang_liste de l’import)', () => {
  const { races } = chargerRaces(db);
  for (const id of RACES_DE_LA_0120) assert.equal(races.get(id).hybride, false, `${id} : race pure`);
  const premiereHybride = ORDRE_DES_RACES.indexOf('races/drassahthac');
  assert.deepEqual(ORDRE_DES_RACES.slice(premiereHybride - 2, premiereHybride), [FONGOIDE, GEMIDIEN]);
  // à l'import : juste après le Mort-vivant, dernière race pure du classeur, dans les deux ordres ; aucune classe raciale
  const place = (id) => un(dImport, 'SELECT ordre, rang_liste FROM race WHERE id = ?', id);
  const mortVivant = place('races/mort-vivant');
  assert.deepEqual({ ...place(FONGOIDE) }, { ordre: mortVivant.ordre + 1, rang_liste: mortVivant.rang_liste + 1 });
  assert.deepEqual({ ...place(GEMIDIEN) }, { ordre: mortVivant.ordre + 2, rang_liste: mortVivant.rang_liste + 2 });
  assert.equal(un(dImport, 'SELECT count(*) AS n FROM race WHERE rang_liste IS NOT NULL').n, un(dImport, 'SELECT count(DISTINCT rang_liste) AS n FROM race').n,
    'des rangs distincts à l’import');
  for (const id of RACES_DE_LA_0120) {
    assert.equal(un(dImport, "SELECT count(*) AS n FROM race_classe rc JOIN classe c ON c.id = rc.classe_id WHERE rc.race_id = ? AND rc.accessible = 1 AND c.categorie_id = 'classe-hybride-animal'", id).n, 0, id);
  }
});

test('R13 : une ligne d’onglet, un don de race unique, un Mode Hyper nommé ; ni restriction de caractéristique ni AP/AM de la fiche', () => {
  for (const id of RACES_DE_LA_0120) {
    assert.ok(un(dImport, 'SELECT 1 FROM race_onglet WHERE race_id = ?', id), id);
    assert.deepEqual(tous(dImport, 'SELECT forme FROM race_don WHERE race_id = ?', id).map((d) => d.forme), ['unique'], `${id} : un don unique, aucun don d’ethnie`);
    const hyper = tous(dImport, "SELECT nom, effet FROM mode_hyper_effet WHERE race_id = ? AND portee = 'race'", id);
    assert.equal(hyper.length, 1, `${id} : la seule version de l'onglet (ni « Mode hyper et co » ni fiche V15.2.2)`);
    assert.ok(hyper[0].nom && hyper[0].effet, id);
    assert.equal(un(dImport, "SELECT version FROM mode_hyper_effet WHERE race_id = ?", id).version, 'onglet_race');
    assert.equal(un(dImport, 'SELECT count(*) AS n FROM race_restriction_carac WHERE race_id = ?', id).n, 0, id);
    assert.deepEqual({ ...un(dImport, 'SELECT ap, am, divers, presentation FROM race WHERE id = ?', id) }, { ap: null, am: null, divers: null, presentation: null }, id);
    // aucun peuple (relations entre les races : rien d'écrit)
    assert.equal(un(dImport, 'SELECT count(*) AS n FROM peuple WHERE race_id = ?', id).n, 0, id);
  }
});

test('R239 (2) : le don de base est celui des races pures (« Méditation (Action 3 fois/jour) », 3d6 + 6 chakra), pas celui de l’onglet', () => {
  // le texte des races pures tel qu'il était à la migration (balises du glossaire posées par le site comprises) : lu sans ses balises, que la base
  // d'import retire du texte des races pures (le site les y a posées) et pas de celui de la migration
  const donDe = (base, id) => texteSansBalises(un(base, 'SELECT don_base FROM race_onglet WHERE race_id = ?', id).don_base);
  for (const id of RACES_DE_LA_0120) assert.equal(donDe(dImport, id), donDe(dImport, HUMAIN), id);
  // la fiche le lit comme celui des races pures (R173 : une action, sa limite)
  const regles = reglesDImport();
  const fiche = (id) => regles.races.find((r) => r.id === id);
  for (const id of RACES_DE_LA_0120) assert.deepEqual(fiche(id).don_base_action, fiche(HUMAIN).don_base_action, id);
});

test('R256 : vitesse 4 au sol, 4 à la nage, pour les deux races', () => {
  for (const id of RACES_DE_LA_0120) {
    assert.deepEqual({ ...un(dImport, 'SELECT vitesse_sol, vitesse_nage FROM race_onglet WHERE race_id = ?', id) }, { vitesse_sol: 4, vitesse_nage: 4 }, id);
  }
});

test('R239 (3) : une seule ethnie chacune, au nom de la race, sans don d’ethnie', () => {
  for (const id of RACES_DE_LA_0120) {
    const ethnies = tous(dImport, 'SELECT e.nom, e.descriptif, e.magie_id, r.nom AS race FROM ethnie e JOIN race r ON r.id = e.race_id WHERE e.race_id = ?', id);
    assert.equal(ethnies.length, 1, id);
    assert.equal(ethnies[0].nom, ethnies[0].race, id);
    assert.deepEqual([ethnies[0].descriptif, ethnies[0].magie_id], [null, null], `${id} : ni don ni magie d'ethnie`);
    assert.equal(un(dImport, 'SELECT count(*) AS n FROM race_don WHERE race_id = ? AND ethnie_id IS NOT NULL', id).n, 0, `${id} : sans sous-race de la fiche`);
  }
  // aujourd'hui : chaque race a ses ethnies (le site peut en changer le nom, pas la race)
  for (const id of RACES_DE_LA_0120) assert.ok(un(db, 'SELECT count(*) AS n FROM ethnie WHERE race_id = ?', id).n >= 1, id);
});

test('magies innées : Fongoïde 14 (toutes sauf le Potentiel Illimité : R14, R22), Gémidien 13 (ni Potentiel Illimité ni Corruption), mono-magie (R28)', () => {
  const magies = tous(dImport, 'SELECT id FROM magie').map((m) => m.id);
  const innees = (id) => tous(dImport, 'SELECT magie_id FROM race_magie WHERE race_id = ? AND accessible = 1', id).map((m) => m.magie_id).sort();
  assert.deepEqual(innees(FONGOIDE), magies.filter((m) => m !== PI).sort());
  assert.deepEqual(innees(GEMIDIEN), magies.filter((m) => m !== PI && m !== CORRUPTION).sort());
  for (const id of RACES_DE_LA_0120) {
    assert.equal(un(dImport, 'SELECT count(*) AS n FROM race_magie WHERE race_id = ?', id).n, magies.length, `${id} : une case par magie`);
    assert.equal(un(dImport, 'SELECT count(*) AS n FROM race_magie_onglet WHERE race_id = ?', id).n, 0, `${id} : la matrice fait foi (R8)`);
  }
  // R28 : le Gémidien seul est mono-magie ; la Corruption innée du Fongoïde reste mono-magie par la règle de la magie (R15), pas par la race
  assert.equal(un(dImport, 'SELECT mono_magie FROM race WHERE id = ?', GEMIDIEN).mono_magie, 1);
  assert.equal(un(dImport, 'SELECT mono_magie FROM race WHERE id = ?', FONGOIDE).mono_magie, 0);
  // la fiche reçoit ces listes et la mono-magie
  const regles = reglesDImport();
  const fiche = (id) => regles.races.find((r) => r.id === id);
  assert.deepEqual([...fiche(FONGOIDE).magies].sort(), innees(FONGOIDE));
  assert.deepEqual([...fiche(GEMIDIEN).magies].sort(), innees(GEMIDIEN));
  assert.equal(fiche(GEMIDIEN).mono_magie, true);
  assert.equal(fiche(FONGOIDE).mono_magie, false);
  for (const id of RACES_DE_LA_0120) assert.equal(fiche(id).nature, 'pure', id);
});

test('R239 (4) : les classes des races pures, le Fongoïde sans Barde ni Parleur (son onglet, H19), aucune classe raciale', () => {
  const acces = (id) => new Map(tous(dImport, 'SELECT classe_id, accessible FROM race_classe WHERE race_id = ?', id).map((l) => [l.classe_id, l.accessible]));
  const humain = acces(HUMAIN);
  const fermees = ['classes/barde', 'classes/parleur'];
  for (const id of RACES_DE_LA_0120) assert.equal(acces(id).size, un(dImport, 'SELECT count(*) AS n FROM classe').n, `${id} : une case par classe`);
  for (const [classe, a] of acces(GEMIDIEN)) assert.equal(a, humain.get(classe), `Gémidien × ${classe}`);
  for (const [classe, a] of acces(FONGOIDE)) assert.equal(a, fermees.includes(classe) ? 0 : humain.get(classe), `Fongoïde × ${classe}`);
  for (const c of fermees) assert.equal(humain.get(c), 1, `${c} : ouverte aux races pures`);
  // R238 (1) : Boxeur et Porte-étendard (migration 0119) ouverts à toutes les races, ces deux-là comprises
  for (const id of RACES_DE_LA_0120) for (const c of ['classes/boxeur', 'classes/porte-etendard']) assert.equal(acces(id).get(c), 1, `${id} × ${c}`);
});

test('page de chaque race : le rendu de ses seules tables (lib/corps-races.mjs#corpsDeRaceCreee), sans section de la fiche V15.2.2', () => {
  for (const id of RACES_DE_LA_0120) {
    const page = un(db, 'SELECT corps_md, donnees FROM page WHERE id = ?', id);
    assert.equal(page.corps_md, corpsDeRaceCreee(etatDeRace((q, ...p) => db.prepare(q).all(...p), id)), id);
    assert.doesNotMatch(page.corps_md, /^## Écarts avec la fiche/m, id);
    // la liste des magies innées de la page (liens races ↔ magies) suit ses tables
    const noms = tous(db, 'SELECT m.nom FROM race_magie r JOIN magie m ON m.id = r.magie_id WHERE r.race_id = ? AND r.accessible = 1 ORDER BY m.ordre', id).map((m) => m.nom);
    if (!un(db, 'SELECT 1 FROM race_magie_onglet WHERE race_id = ?', id)) assert.deepEqual(JSON.parse(page.donnees).magies_innees, noms, id);
  }
});

test('R237 (12) : Modes Hyper de l’Elfe argenté et du Felfe changés par le docx (version de l’onglet, R13), noms inchangés ; le Felfe compte 1 dé', () => {
  assert.deepEqual(TEXTES_DE_LA_0120.map((t) => t.cle.id).sort(), ['onglet_race:races/elfe-argente', 'onglet_race:races/felfe']);
  for (const t of TEXTES_DE_LA_0120) {
    const effet = un(dImport, 'SELECT effet FROM mode_hyper_effet WHERE id = ?', t.cle.id).effet;
    assert.equal(effet, t.apres, t.cle.id);
    assert.notEqual(effet, t.avant, `${t.cle.id} : l'ancien effet de l'import est remplacé`);
    // les lectures des autres sources restent leurs traces (« Mode hyper et co », fiche V15.2.2)
    const race = t.cle.id.replace(/^onglet_race:/, '');
    assert.equal(un(dImport, "SELECT count(*) AS n FROM mode_hyper_effet WHERE race_id = ? AND version IN ('classeur_modes', 'fiche')", race).n, 2, race);
  }
  const felfe = un(dImport, "SELECT effet FROM mode_hyper_effet WHERE id = 'onglet_race:races/felfe'").effet;
  assert.doesNotMatch(felfe, /\b2d\b/);
  assert.deepEqual(effetsDuModeHyper(felfe), [{ cible: 'des_sorts', valeur: 1, soins: true }], 'la fiche compte le dé de plus que le texte écrit');
  // la fiche, la page du Mode Hyper et les pages de race lisent cette version (mode_hyper.races, guide-db, races-db) : la règle de la fiche le reçoit
  assert.equal(reglesDImport().mode_hyper.races['races/felfe'].effet, felfe);
  // aujourd'hui : la page de chaque race lit cette ligne (son corps la redit : tools/db/races_onglet.py --verifier, test/races-onglet.test.mjs)
  const { races } = chargerRaces(db);
  for (const t of TEXTES_DE_LA_0120) assert.equal(races.get(t.cle.id.replace(/^onglet_race:/, '')).hyper.id, t.cle.id);
});

test('R218 (5), R219 (5) : un mot-clé par race, qui la nomme et mène à sa page, de la forme de ceux des races pures, mais non verrouillé', () => {
  // le modèle : le mot-clé de l'Humain, race pure (par son adresse à l'import, figée par le registre 0113)
  const motCle = (base, id) => un(base, 'SELECT * FROM mot_cle WHERE id = ?', id);
  const categories = (base, id) => tous(base, 'SELECT categorie_id FROM mot_cle_categorie WHERE mot_cle_id = ? ORDER BY categorie_id', id).map((c) => c.categorie_id);
  const humain = un(dImport, "SELECT * FROM mot_cle WHERE url = '/races/humain/'");
  assert.equal(humain.verrou, 1, 'R218 (5) : le mot-clé d’une race du classeur est verrouillé');
  assert.deepEqual(Object.keys(MOTS_CLES_DE_LA_0120).sort(), [...RACES_DE_LA_0120].sort());
  for (const [race, id] of Object.entries(MOTS_CLES_DE_LA_0120)) {
    const m = motCle(dImport, id);
    assert.ok(m, `${race} : mot-clé ${id}`);
    assert.equal(m.libelle, un(dImport, 'SELECT nom FROM race WHERE id = ?', race).nom, race);
    assert.equal(m.url, `/${race}/`, race);
    assert.equal(m.couleur, humain.couleur, `${race} : couleur des races pures`);
    assert.deepEqual([m.description, m.monnaie_id, m.icone], [humain.description, humain.monnaie_id, humain.icone], race);
    assert.deepEqual(categories(dImport, id), categories(dImport, humain.id), `${race} : catégories des races pures`);
    assert.equal(m.verrou, 0, `${race} : R219 (5), « Un mot-clé créé plus tard n'est pas verrouillé, même pour une nouvelle race »`);
    assert.equal(un(dImport, 'SELECT count(*) AS n FROM mot_cle WHERE url = ?', m.url).n, 1, `${race} : un seul mot-clé mène à sa page`);
  }
  // aujourd'hui : le verrou ne change que par migration (R218 (4)) ; le mot-clé, non verrouillé, peut avoir été modifié ou supprimé sur le site
  for (const id of Object.values(MOTS_CLES_DE_LA_0120)) {
    const m = motCle(db, id);
    if (m) assert.equal(m.verrou, 0, `mot-clé ${id}`);
  }
});
