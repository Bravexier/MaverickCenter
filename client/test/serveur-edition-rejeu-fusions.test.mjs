// Le rejeu d'un lot du site de dev noté avant la migration 0090 (décision R183 (3) : « CR » fondu dans « Corruption », ses balises reciblées en
// « {{corruption|CR}} ») : serveur/edition.mjs#ancienneEcritureDesFusions lit ses balises et ses étiquettes de `cr` comme la migration a réécrit les
// règles. Les deux constats de la relecture (tech-qualite) : sans lui, un tel lot écrivait « {{cr}} » tel quel (db:check le refuse), et voyait un faux
// conflit sur un texte que la migration a reciblé (l'effet de « Aiguisage magique » : « les règles ont changé effets autrement »). Une écriture sur la
// ligne `cr` elle-même reste un vrai conflit (choix : rien n'est reporté sur « Corruption »). Décision R211 (« Les rendre supprimables ») : la cible
// supprimée depuis (elle se supprime dès que rien ne la mentionne), un tel lot écrit du texte simple et aucune étiquette vers elle. Les essais de
// l'adaptateur choisissent l'état de la cible dans leur copie des règles (remise depuis l'import, ou retirée), sans supposer celui du site de dev.
//   node --test test/serveur-edition-rejeu-fusions.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ancienneEcritureDesFusions, FUSIONS_DE_MIGRATION, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { formesNonCanoniques, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { baseDImport, lotsAvant, remettreDepuisLImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { idDEssai, reglesAvecDesMotsClesDEssai } from './aide-mots-cles.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const dossier = dossierTemporaire('rejeu-fusions');
const regles = reglesAvecDesMotsClesDEssai(join(dossier, 'regles'));
let n = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: regles.base, dossier: join(dossier, `b${(n += 1)}`) }).chemin);
/** Les règles telles que la migration 0090 les a trouvées : la cible (`corruption`, créée par le site de dev avant elle) y est. */
const dImport0090 = () => baseDImport({ garder: lotsAvant('0090') });
/**
 * Une copie des règles des tests, la cible d'une fusion de migration (`corruption`) présente (remise telle que la 0090 l'a trouvée si le site de dev l'a
 * supprimée depuis : décision R211) ou absente (retirée, avec ses étiquettes).
 */
const reglesOuLaCible = ({ cible }) => {
  const chemin = join(dossier, `copie-${(n += 1)}.db`);
  cpSync(regles.base, chemin);
  const db = new DatabaseSync(chemin);
  const id = CORRUPTION;
  if (cible) {
    db.exec('PRAGMA foreign_keys = ON');
    remettreDepuisLImport(db, 'mot_cle', { id }, { dImport: dImport0090() });
  } else {
    db.exec('PRAGMA foreign_keys = OFF');
    for (const sql of ['DELETE FROM sort_mot_cle WHERE mot_cle_id = ?', 'DELETE FROM page_tag WHERE tag_id = ?', 'DELETE FROM mot_cle WHERE id = ?']) db.prepare(sql).run(id);
  }
  return db;
};
const modification = (table, operation, cle, avant, apres) => ({ lot_id: 'l', rang: 0, table_nom: table, operation, cle: JSON.stringify(cle),
  avant: avant && JSON.stringify(avant), apres: apres && JSON.stringify(apres) });

const SORT = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
const AJOUT_PAGE = '\n\nEssai de rejeu : {{corruption|CR}}, {{corruption:}} et {{corruption|la CR}}.\n\n| a | b |\n| --- | --- |\n| x | {{corruption\\|CR}} |\n';
/** Le même ajout, tel qu'un lot d'avant 0090 l'a noté (forme canonique d'alors : « {{cr}} » dans un texte mis en forme montrait « CR »). */
const AJOUT_PAGE_AVANT_0090 = '\n\nEssai de rejeu : {{cr}}, {{cr :}} et {{cr|la CR}}.\n\n| a | b |\n| --- | --- |\n| x | {{cr\\|CR}} |\n';
// les mots-clés par leur id entier (migration 0113 : le registre de la migration traduit les anciens ids texte des lots ; mots-clés d'essai :
// test/aide-mots-cles.mjs) ; les lots d'avant la 0090 les écrivent par leur ancien id texte
const REGISTRE_0113 = new Map(JSON.parse(readFileSync(join(RACINE, 'data/migrations/0113-mots-cles-id-entier.json'), 'utf8')).motsCles.map((m) => [m.ancienId, m.id]));
const CORRUPTION = REGISTRE_0113.get(FUSIONS_DE_MIGRATION[0].cible);
const ESSAI_C = idDEssai('essai-glossaire-c');
const avant0090 = (t) => (typeof t === 'string' ? t.replaceAll('{{corruption|', '{{cr|') : t);
const ligneAvant0090 = (l) => (l && typeof l === 'object' ? Object.fromEntries(Object.entries(l).map(([c, v]) => [c, avant0090(v)])) : l);

test('FUSIONS_DE_MIGRATION : « CR » dans « Corruption » (migration 0090, R183 (3)) ; les règles n’ont plus `cr`', () => {
  assert.deepEqual(FUSIONS_DE_MIGRATION[0], { source: 'cr', cible: 'corruption', texte: 'CR', migration: '0090' });
  // les fusions de la 0115 (R233 (5)) : leurs sources absentes des règles, leur cible, Instant Cast, présente
  // celle de la 0122 (« La montée de niveau » dans « Fiche de personnage : Expérience/Niveau global ») : test plus bas
  assert.deepEqual(FUSIONS_DE_MIGRATION.slice(1).map((f) => [f.source, f.cible, f.migration]), [['action-bonus', 'instant-cast', '0115'], ['action-rapide', 'instant-cast', '0115'],
    ['la-montee-de-niveau', 'fiche-de-personnage-experience-niveau-global', '0122']]);
  const db = new DatabaseSync(regles.base, { readOnly: true });
  assert.equal(REGISTRE_0113.get('cr'), undefined, '`cr` n’existait plus à la 0113');
  for (const f of FUSIONS_DE_MIGRATION.slice(1)) assert.equal(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(REGISTRE_0113.get(f.source)), undefined, f.source);
  db.close();
  // la cible, Instant Cast, lue à l'import (le site de dev peut l'avoir supprimée depuis : tests-conventions)
  assert.ok(baseDImport().prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(REGISTRE_0113.get('instant-cast')));
  // l'abréviation de la 0090, devenue un synonyme (migration 0115), telle que la migration l'a écrite
  assert.ok(dImport0090().prepare('SELECT libelle FROM mot_cle_synonyme WHERE mot_cle_id = ?').all(CORRUPTION).some((x) => x.libelle === 'CR'));
});

test('FUSIONS_DE_MIGRATION (0122) : « La montée de niveau » fondu dans « Fiche de personnage : Expérience/Niveau global » ; un lot d’avant la migration lit ses balises comme elle les a reciblées', () => {
  // le registre de la migration nomme la fusion ; les ids figés se lisent dans le registre de la 0113 (un lot d'avant la 0122 écrit la clé de son temps)
  const registre = JSON.parse(readFileSync(join(RACINE, 'data/migrations/0122-retrait-la-montee-de-niveau.json'), 'utf8'));
  const f = FUSIONS_DE_MIGRATION.find((x) => x.migration === '0122');
  assert.deepEqual(f, { source: registre.fusion.source, cible: registre.fusion.cible, texte: registre.fusion.texte, migration: '0122' });
  assert.deepEqual([REGISTRE_0113.get(f.source), REGISTRE_0113.get(f.cible)], [registre.fusion.source_id, registre.fusion.cible_id]);
  // une copie des règles, la cible présente (remise depuis l'import si le site de dev l'a supprimée : décision R211), la source absente
  const chemin = join(dossier, `copie-${(n += 1)}.db`);
  cpSync(regles.base, chemin);
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  remettreDepuisLImport(db, 'mot_cle', { id: registre.fusion.cible_id });
  assert.equal(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(registre.fusion.source_id), undefined, 'la source a quitté le vocabulaire');
  const adapter = ancienneEcritureDesFusions(db);
  // chaque balise que la migration a reciblée (registre `textes`) : le lot qui la portait la porte reciblée, avant comme après
  for (const t of registre.textes) {
    const lu = adapter(modification(t.table, 'modifier', t.cle, { [t.col]: `a ${t.avant}.` }, { [t.col]: `a ${t.avant}, b.` }));
    assert.deepEqual([JSON.parse(lu.avant)[t.col], JSON.parse(lu.apres)[t.col]], [`a ${t.apres}.`, `a ${t.apres}, b.`], t.cle.id);
  }
  // les autres formes : texte écrit gardé, échappée d'un tableau, définition
  const formes = adapter(modification('page', 'modifier', { id: 'guide/bienvenue' }, null, { corps_md: '{{la-montee-de-niveau|monter}} {{la-montee-de-niveau\\|x}} {{la-montee-de-niveau:}}' }));
  assert.equal(JSON.parse(formes.apres).corps_md, `{{${f.cible}|monter}} {{${f.cible}\\|x}} {{${f.cible}:}}`);
  db.close();
});

test('adaptateur : balises (avant et apres, toute table), étiquettes de page et de sort (clé comprise, sans doublon) ; la ligne `cr` elle-même inchangée', () => {
  const db = reglesOuLaCible({ cible: true });
  const adapter = ancienneEcritureDesFusions(db);
  const m = modification;
  const texte = adapter(m('sort', 'modifier', { id: SORT }, { effets: 'a {{cr|CR}} b' }, { effets: '{{cr}} {{cr:}} {{cr :}} {{cr\\|x}} {{crane|y}} {{corruption|CR}}' }));
  assert.deepEqual(JSON.parse(texte.avant), { effets: 'a {{corruption|CR}} b' });
  assert.deepEqual(JSON.parse(texte.apres), { effets: '{{corruption|CR}} {{corruption:}} {{corruption:}} {{corruption\\|x}} {{crane|y}} {{corruption|CR}}' });
  // une page sans étiquette de corruption : reciblée ; une page qui l'a déjà : l'insertion est sans effet
  const sans = db.prepare('SELECT id FROM page WHERE id NOT IN (SELECT page_id FROM page_tag WHERE tag_id = ?) ORDER BY id LIMIT 1').get(CORRUPTION).id;
  const pose = adapter(m('page_tag', 'inserer', { page_id: sans, ordre: 9 }, null, { page_id: sans, ordre: 9, tag_id: 'cr' }));
  assert.deepEqual([JSON.parse(pose.apres).tag_id, pose.sansEffet ?? false], ['corruption', false]);
  const fusion = adapter(m('page_tag', 'modifier', { page_id: sans, ordre: 0 }, { tag_id: 'essai-glossaire-c' }, { tag_id: 'cr' }));
  assert.deepEqual([JSON.parse(fusion.avant).tag_id, JSON.parse(fusion.apres).tag_id], ['essai-glossaire-c', 'corruption']);
  const avecCorruption = db.prepare('SELECT page_id FROM page_tag WHERE tag_id = ? ORDER BY page_id LIMIT 1').get(CORRUPTION);
  if (avecCorruption) {
    const double = adapter(m('page_tag', 'inserer', { page_id: avecCorruption.page_id, ordre: 99 }, null, { page_id: avecCorruption.page_id, ordre: 99, tag_id: 'cr' }));
    assert.equal(double.sansEffet, true, 'la page a déjà l’étiquette');
  }
  // une étiquette de sort : la clé aussi
  const sort = adapter(m('sort_mot_cle', 'inserer', { sort_id: SORT, mot_cle_id: 'cr' }, null, { sort_id: SORT, mot_cle_id: 'cr' }));
  assert.deepEqual([JSON.parse(sort.cle), JSON.parse(sort.apres)], [{ sort_id: SORT, mot_cle_id: 'corruption' }, { sort_id: SORT, mot_cle_id: 'corruption' }]);
  // la ligne `cr` : ni reportée, ni changée (le rejeu la met en conflit) ; une modification sans `cr` : rendue telle quelle
  const surCr = m('mot_cle', 'modifier', { id: 'cr' }, { description: 'Ancienne.' }, { description: 'Nouvelle.' });
  assert.equal(adapter(surCr), surCr);
  const autre = m('sort', 'modifier', { id: SORT }, { effets: 'x' }, { effets: 'y' });
  assert.equal(adapter(autre), autre);
  db.close();
  // des règles qui ont encore `cr` (d'avant la 0090) : rien n'est adapté
  const ancienne = new DatabaseSync(':memory:');
  ancienne.exec("CREATE TABLE mot_cle (id TEXT PRIMARY KEY); INSERT INTO mot_cle VALUES ('cr'), ('corruption');");
  const lu = m('sort', 'modifier', { id: SORT }, { effets: '{{cr|CR}}' }, { effets: '{{cr|CR}} x' });
  assert.equal(ancienneEcritureDesFusions(ancienne)(lu), lu);
  ancienne.close();
});

test('R211 : la cible supprimée depuis, l’adaptateur écrit du texte simple (le texte écrit, sinon « CR ») et les étiquettes vers `cr` sont sans effet', () => {
  const db = reglesOuLaCible({ cible: false });
  const adapter = ancienneEcritureDesFusions(db);
  const m = modification;
  const texte = adapter(m('sort', 'modifier', { id: SORT }, { effets: 'a {{cr|CR}} b' }, { effets: '{{cr}} {{cr|x}} {{crane|y}}' }));
  assert.deepEqual(JSON.parse(texte.avant), { effets: 'a CR b' });
  assert.deepEqual(JSON.parse(texte.apres), { effets: 'CR x {{crane|y}}' }, 'une autre balise reste');
  // un texte mis en forme (Markdown), mode complet et case de tableau compris : aucune balise de `cr` ni de la cible
  const page = db.prepare("SELECT id FROM page WHERE type = 'guide' ORDER BY id LIMIT 1").get().id;
  const corps = adapter(m('page', 'modifier', { id: page }, { corps_md: 'x' }, { corps_md: AJOUT_PAGE_AVANT_0090 }));
  const ecrit = JSON.parse(corps.apres).corps_md;
  assert.doesNotMatch(ecrit, /\{\{(?:cr|corruption)\b/, ecrit);
  assert.match(ecrit, /Essai de rejeu : CR, CR et la CR\./);
  assert.match(ecrit, /\| x \| CR \|/);
  // une étiquette de page ou de sort vers `cr` : sans effet (le mot-clé n'existe plus)
  const page2 = db.prepare('SELECT id FROM page ORDER BY id LIMIT 1').get().id;
  assert.equal(adapter(m('page_tag', 'inserer', { page_id: page2, ordre: 9 }, null, { page_id: page2, ordre: 9, tag_id: 'cr' })).sansEffet, true);
  assert.equal(adapter(m('page_tag', 'modifier', { page_id: page2, ordre: 0 }, { tag_id: 'essai-glossaire-c' }, { tag_id: 'cr' })).sansEffet, true);
  assert.equal(adapter(m('sort_mot_cle', 'inserer', { sort_id: SORT, mot_cle_id: 'cr' }, null, { sort_id: SORT, mot_cle_id: 'cr' })).sansEffet, true);
  // la ligne `cr` elle-même : rendue telle quelle (le rejeu la met en conflit)
  const surCr = m('mot_cle', 'modifier', { id: 'cr' }, { description: 'Ancienne.' }, { description: 'Nouvelle.' });
  assert.equal(adapter(surCr), surCr);
  db.close();
});

test('R211, rejeu : un lot d’avant 0090 rejoué sur des règles sans la cible n’écrit aucune balise vers elle ni vers `cr`, sans conflit', () => {
  // le lot, fait par le service sur une base qui a la cible, puis récrit dans le journal comme le site de dev le notait avant la 0090
  const site = vivante();
  if (!site.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(CORRUPTION)) {
    site.exec('PRAGMA foreign_keys = ON');
    remettreDepuisLImport(site, 'mot_cle', { id: CORRUPTION }, { dImport: dImport0090() });
  }
  const page = site.prepare("SELECT id, corps_md FROM page WHERE type = 'guide' AND statut <> 'example' AND instr(corps_md, '{{') = 0 ORDER BY id LIMIT 1").get();
  const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
    corps: JSON.stringify({ page: `${page.id}/`, operations: [{ op: 'modifier', table: 'page', cle: { id: page.id }, valeurs: { corps_md: `${page.corps_md}${AJOUT_PAGE}` } }] }) },
  { base: () => site, etat: () => ({}), edition: true });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const journal = journalExporte(site);
  site.close();
  for (const m of journal.lots.flatMap((l) => l.modifications)) {
    if (m.table === 'page' && typeof m.apres?.corps_md === 'string') m.apres.corps_md = m.apres.corps_md.replace(AJOUT_PAGE, AJOUT_PAGE_AVANT_0090);
  }
  // les règles sans la cible (supprimée sur le site de dev, rapatriée : R211)
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  for (const sql of ['DELETE FROM sort_mot_cle WHERE mot_cle_id = ?', 'DELETE FROM page_tag WHERE tag_id = ?', 'DELETE FROM mot_cle WHERE id = ?']) {
    neuve.prepare(sql).run(CORRUPTION);
  }
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  assert.equal(bilan.conflits, 0, JSON.stringify(bilan));
  const corps = neuve.prepare('SELECT corps_md FROM page WHERE id = ?').get(page.id).corps_md;
  assert.ok(corps.startsWith(page.corps_md), 'le texte d’avant');
  const ajout = corps.slice(page.corps_md.length);
  assert.doesNotMatch(ajout, /\{\{/, ajout);
  assert.match(ajout, /Essai de rejeu : CR, CR et la CR\./);
  neuve.close();
});

test('rejeu et db:appliquer-edition d’un lot d’avant 0090 : pas de faux conflit sur « Aiguisage magique », des balises canoniques (db:check), l’étiquette reciblée ; une écriture sur `cr` en conflit', { skip: sansPython }, () => {
  // les lots, faits par le service sur une base d'aujourd'hui, puis récrits dans le journal comme le site de dev les notait avant la 0090
  const site = vivante();
  const s = { base: () => site, etat: () => ({}), edition: true };
  const lot = (operations, page) => {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page, operations }) }, s);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
  };
  const effets = site.prepare('SELECT effets FROM sort WHERE id = ?').get(SORT).effets;
  assert.match(effets, /\{\{corruption\|CR\}\}/, 'la migration a reciblé son « {{cr|CR}} »');
  lot([{ op: 'modifier', table: 'sort', cle: { id: SORT }, valeurs: { effets: `${effets} {{corruption|CR}} (essai)` }, avant: { effets } }], 'magies/magie-de-la-corruption/');
  const page = site.prepare("SELECT id, corps_md FROM page WHERE type = 'guide' AND statut <> 'example' AND instr(corps_md, '{{') = 0 ORDER BY id LIMIT 1").get();
  lot([{ op: 'modifier', table: 'page', cle: { id: page.id }, valeurs: { corps_md: `${page.corps_md}${AJOUT_PAGE}` } }], `${page.id}/`);
  lot([{ op: 'fusionner_mots_cles', mot_cle: ESSAI_C, dans: CORRUPTION }], 'recherche/');
  const journal = journalExporte(site);
  site.close();
  assert.equal(journal.lots.length, 3);
  const [lotSort, lotPage, lotFusion] = journal.lots;
  for (const m of lotSort.modifications) Object.assign(m, { avant: ligneAvant0090(m.avant), apres: ligneAvant0090(m.apres) });
  for (const m of lotPage.modifications) {
    if (m.table === 'page' && typeof m.apres?.corps_md === 'string') m.apres.corps_md = m.apres.corps_md.replace(AJOUT_PAGE, AJOUT_PAGE_AVANT_0090);
  }
  // la fusion d'alors : dans `cr` (ses étiquettes vers `cr`)
  for (const m of lotFusion.modifications) {
    if (m.table === 'page_tag' && m.apres?.tag_id === CORRUPTION) m.apres.tag_id = 'cr';
  }
  assert.ok(lotFusion.modifications.some((m) => m.table === 'page_tag' && m.apres?.tag_id === 'cr'), 'la fusion déplace une étiquette');
  // une écriture sur la ligne `cr` elle-même (sa définition), dans un lot à part
  const surCr = { id: '2026-11-01T00:00:00.000Z-000000-essai-cr', fait_le: '2026-11-01T00:00:00Z', auteur_id: null, page_id: 'recherche/', resume: 'Mot-clé CR : Définition',
    modifications: [{ rang: 1, table: 'mot_cle', cle: { id: 'cr' }, operation: 'modifier', avant: { description: 'Ancienne.' }, apres: { description: 'Nouvelle.' }, etat: 'en_attente', detail: null, apercu: null }] };
  const verifier = (base, { avecConflit }) => {
    assert.equal(base.prepare('SELECT effets FROM sort WHERE id = ?').get(SORT).effets, `${effets} {{corruption|CR}} (essai)`, 'aucun faux conflit, la balise reciblée');
    assert.equal(base.prepare('SELECT corps_md FROM page WHERE id = ?').get(page.id).corps_md, `${page.corps_md}${AJOUT_PAGE}`, 'les balises de la migration');
    assert.equal(base.prepare('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?').get(ESSAI_C).n, 0);
    assert.ok(base.prepare("SELECT 1 FROM page_tag WHERE page_id = 'lore/balogne' AND tag_id = ?").get(CORRUPTION), 'l’étiquette suit la fusion, vers corruption');
    const vocabulaire = vocabulaireDesMotsCles(motsClesDeLaBase(base));
    assert.deepEqual(formesNonCanoniques(base.prepare('SELECT effets FROM sort WHERE id = ?').get(SORT).effets, vocabulaire), []);
    assert.deepEqual(formesNonCanoniques(base.prepare('SELECT corps_md FROM page WHERE id = ?').get(page.id).corps_md, vocabulaire, { markdown: true }), []);
    if (avecConflit) {
      const conflits = base.prepare("SELECT lot_id, detail FROM modification WHERE etat = 'conflit'").all().map((c) => ({ ...c }));
      assert.deepEqual(conflits.map((c) => c.lot_id), [surCr.id], JSON.stringify(conflits));
      assert.match(conflits[0].detail, /n’existe plus/);
    }
  };
  // rejeu (livraison)
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, { ...journal, lots: [...journal.lots, surCr] });
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  assert.equal(bilan.conflits, 1, 'seule l’écriture sur `cr`');
  verifier(neuve, { avecConflit: true });
  neuve.close();
  // db:appliquer-edition, puis db:check sur data/rows reconstruit
  const rows = join(dossier, 'rapatriement', 'rows');
  cpSync(regles.rows, rows, { recursive: true });
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  const base = join(dossier, 'rapatriement', 'regles.db');
  for (const [script, args] of [['db-build.mjs', ['--out', base, '--rows', rows]], ['db-derive.mjs', [base]], ['db-check.mjs', [base]]]) {
    const x = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', script), ...args], { encoding: 'utf8', cwd: RACINE });
    assert.equal(x.status, 0, `${script} : ${x.stderr || x.stdout}`.slice(0, 2000));
  }
  const reconstruite = new DatabaseSync(base, { readOnly: true });
  verifier(reconstruite, { avecConflit: false });
  reconstruite.close();
});
