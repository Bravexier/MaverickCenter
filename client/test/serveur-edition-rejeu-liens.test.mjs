// Le rejeu d'un lot du site de dev noté avant la migration 0098 (les [[…]] et les liens Markdown internes devenus des balises de mots-clés) :
// serveur/edition.mjs#ancienneEcritureDesLiens lit ses textes comme la migration a réécrit les règles (la table de conversion de son registre,
// data/migrations/0098-liens-en-mots-cles.json : tableDesLiensDeLa0098). Sans lui, un tel lot écrirait un lien que db:check refuse, ou verrait un faux
// conflit sur un texte que la migration a converti. Une page d'exemple et un lien inconnu restent tels quels ; l'artisanat de l'Alchimiste, dont la
// migration a balisé le texte simple, l'est de même.
//   node --test test/serveur-edition-rejeu-liens.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { adaptateurDuJournal, ancienneEcritureDesLiens, rejouerLeJournal, tableDesLiensDeLa0098, tableDuRegistreDesLiens } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { liensDuTexte } from '../src/lib/liens-en-mots-cles.mjs';
import { formesNonCanoniques, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { REGISTRE_DES_LIENS } from '../src/lib/mots-cles-liens.mjs';
import { baseDImport, remettreDepuisLImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const REGISTRE = JSON.parse(readFileSync(join(RACINE, REGISTRE_DES_LIENS), 'utf8'));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const dossier = dossierTemporaire('rejeu-liens');
const m = (table, operation, cle, avant, apres) => ({ lot_id: 'l', rang: 0, table_nom: table, operation, cle: JSON.stringify(cle),
  avant: avant && JSON.stringify(avant), apres: apres && JSON.stringify(apres) });

/** Un remplacement du registre sur une page du guide (un seul lien de ce texte dans la page), et l'Alchimiste (texte simple balisé). */
const SUR_LA_PAGE = REGISTRE.remplacements.find((r) => r.table === 'page' && r.cle.id.startsWith('guide/') && r.compte === 1 && r.lien.startsWith('[['));
const ALCHIMISTE = REGISTRE.remplacements.find((r) => r.table === 'metier' && r.cle.id === 'metiers/alchimiste' && r.colonne === 'artisanat_texte');
/** Le texte tel qu'un lot d'avant la 0098 l'a noté : chaque balise que la migration a écrite sur cette ligne redevient ce qu'elle remplaçait. */
const avant0098 = (table, cle, colonne, texte) => REGISTRE.remplacements
  .filter((r) => r.table === table && r.colonne === colonne && JSON.stringify(r.cle) === JSON.stringify(cle))
  .reduce((t, r) => t.replaceAll(r.balise, r.lien), texte);

/**
 * Les lignes du scénario (la page du guide et l'Alchimiste du registre, avec son entité rattachée), remises telles que la base d'import les écrit si le site de dev les a supprimées
 * (test/aide-base-d-import.mjs, patron : serveur-edition-regles-du-don.test.mjs#remettreLesDonsDImport) : rend le nombre de lignes remises.
 */
function remettreLeScenario(db) {
  const dImport = baseDImport();
  db.exec('PRAGMA foreign_keys = ON');
  return remettreDepuisLImport(db, 'page', SUR_LA_PAGE.cle, { enfants: false, dImport }) + remettreDepuisLImport(db, 'metier', ALCHIMISTE.cle, { dImport })
    // l'entité rattachée du métier (db:check : chaque métier a la sienne)
    + remettreDepuisLImport(db, 'page_entite', { entite_table: 'metier', entite_id: ALCHIMISTE.cle.id }, { dImport });
}
// les règles du scénario (base vivante) et la copie de data/rows que le rapatriement réécrit : l'état courant, ses lignes remises s'il le faut
const REGLES = join(dossier, 'regles.db');
copyFileSync(cheminBase({ sansExemples: false }), REGLES);
const ROWS = (() => {
  const db = new DatabaseSync(REGLES);
  try {
    if (!remettreLeScenario(db)) return join(RACINE, 'data', 'rows');
  } finally {
    db.close();
  }
  const rows = join(dossier, 'rows');
  cpSync(join(RACINE, 'data', 'rows'), rows, { recursive: true });
  const base = join(dossier, 'rows.db');
  const b = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', base, '--rows', rows], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr || b.stdout);
  const db2 = new DatabaseSync(base);
  try {
    remettreLeScenario(db2);
  } finally {
    db2.close();
  }
  const e = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), base, '--rows', rows], { encoding: 'utf8' });
  assert.equal(e.status, 0, e.stderr || e.stdout);
  return rows;
})();
let n = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: REGLES, dossier: join(dossier, `b${(n += 1)}`) }).chemin);

test('la table de la 0098 : celle du registre (liens et adresses), et les textes simples balisés (Alchimiste, Apothicaire)', () => {
  const table = tableDesLiensDeLa0098();
  assert.ok(table, `registre ${REGISTRE_DES_LIENS} lu`);
  assert.equal(tableDesLiensDeLa0098(), table, 'lu une fois');
  assert.ok(table.parCle.size > 0 && table.parAdresse.size > 0);
  assert.deepEqual([...table.textes.keys()].map((k) => k.split('\u0000')[2]).sort(),
    ['artisanat_brut', 'artisanat_brut', 'artisanat_texte', 'artisanat_texte']);
  assert.ok(SUR_LA_PAGE && ALCHIMISTE);
  assert.deepEqual(tableDuRegistreDesLiens(null).textes, new Map());
});

test('adaptateur : les liens d’avant 0098 (avant et apres) deviennent les balises de la migration ; exemple, lien inconnu, autre table : tels quels', () => {
  const db = vivante();
  const adapter = ancienneEcritureDesLiens(db);
  const { id } = SUR_LA_PAGE.cle;
  const lu = adapter(m('page', 'modifier', { id }, { corps_md: `a ${SUR_LA_PAGE.lien} b` }, { corps_md: `a ${SUR_LA_PAGE.lien} b [Discord](/#lien-discord) [[Lien inconnu d’essai]] \`${SUR_LA_PAGE.lien}\`` }));
  assert.deepEqual(JSON.parse(lu.avant), { corps_md: `a ${SUR_LA_PAGE.balise} b` });
  assert.deepEqual(JSON.parse(lu.apres), { corps_md: `a ${SUR_LA_PAGE.balise} b [Discord](/#lien-discord) [[Lien inconnu d’essai]] \`${SUR_LA_PAGE.lien}\`` },
    'gardés : le lien de l’accueil, un lien inconnu, un lien dans un code');
  // un texte de case : « {{id|texte}} »
  const metier = db.prepare('SELECT id FROM metier ORDER BY id').get().id;
  const caseLue = adapter(m('metier', 'modifier', { id: metier }, null, { description: 'Voir [[Drakos]].' }));
  assert.deepEqual(JSON.parse(caseLue.apres), { description: 'Voir {{drakos|Drakos}}.' });
  // l'artisanat de l'Alchimiste : le texte simple balisé, une seule fois
  const texte = db.prepare('SELECT artisanat_texte FROM metier WHERE id = ?').get('metiers/alchimiste').artisanat_texte;
  assert.ok(texte.includes(ALCHIMISTE.balise), texte);
  const ancien = avant0098('metier', ALCHIMISTE.cle, 'artisanat_texte', texte);
  const alch = adapter(m('metier', 'modifier', ALCHIMISTE.cle, { artisanat_texte: ancien }, { artisanat_texte: `${ancien} (essai)` }));
  assert.deepEqual([JSON.parse(alch.avant).artisanat_texte, JSON.parse(alch.apres).artisanat_texte], [texte, `${texte} (essai)`]);
  const deja = m('metier', 'modifier', ALCHIMISTE.cle, { artisanat_texte: texte }, { artisanat_texte: `${texte} (essai)` });
  assert.deepEqual(adapter(deja), deja, 'déjà balisé : rien');
  // une page d'exemple, une table hors des textes (alias : une trace), une modification sans lien : rendues telles quelles
  const exemple = db.prepare("SELECT id FROM page WHERE statut = 'example' ORDER BY id").get().id;
  const surExemple = m('page', 'modifier', { id: exemple }, null, { corps_md: 'Voir [[Drakos]].' });
  assert.equal(adapter(surExemple), surExemple);
  const alias = m('alias', 'inserer', { page_id: id, ordre: 9 }, null, { texte: '[[Drakos]]' });
  assert.equal(adapter(alias), alias);
  const sans = m('page', 'modifier', { id }, { corps_md: 'x' }, { corps_md: 'y' });
  assert.equal(adapter(sans), sans);
  // des règles d'avant la 0098 (sans mot_cle.url), ou sans registre : rien n'est adapté
  const ancienne = new DatabaseSync(':memory:');
  ancienne.exec("CREATE TABLE mot_cle (id TEXT PRIMARY KEY, libelle TEXT); INSERT INTO mot_cle VALUES ('drakos', 'Drakos');");
  const lien = m('page', 'modifier', { id }, null, { corps_md: 'Voir [[Drakos]].' });
  assert.equal(ancienneEcritureDesLiens(ancienne)(lien), lien);
  assert.equal(ancienneEcritureDesLiens(db, null)(lien), lien);
  ancienne.close();
  // dans l'adaptateur du journal (le rejeu et l'examen d'un lot en conflit)
  const parLeJournal = adaptateurDuJournal(db)(m('metier', 'modifier', { id: metier }, null, { description: 'Voir [[Drakos]].' }));
  assert.deepEqual(JSON.parse(parLeJournal.apres), { description: 'Voir {{drakos|Drakos}}.' });
  db.close();
});

test('rejeu et db:appliquer-edition de lots d’avant 0098 : pas de faux conflit, les balises de la migration, aucun lien (db:check)', { skip: sansPython }, () => {
  // les lots, faits par le service sur une base d'aujourd'hui, puis récrits dans le journal comme le site de dev les notait avant la 0098
  const site = vivante();
  const s = { base: () => site, etat: () => ({}), edition: true };
  const lot = (operations, page) => {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page, operations }) }, s);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
  };
  const { id } = SUR_LA_PAGE.cle;
  const corps = site.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
  assert.ok(corps.includes(SUR_LA_PAGE.balise), 'la migration a écrit la balise');
  lot([{ op: 'modifier', table: 'page', cle: { id }, valeurs: { corps_md: `${corps}\n\nEssai de rejeu des liens.\n` }, avant: { corps_md: corps } }], `${id}/`);
  const artisanat = site.prepare('SELECT artisanat_texte FROM metier WHERE id = ?').get('metiers/alchimiste').artisanat_texte;
  lot([{ op: 'modifier', table: 'metier', cle: ALCHIMISTE.cle, valeurs: { artisanat_texte: `${artisanat} (essai)` }, avant: { artisanat_texte: artisanat } }], 'metiers/');
  const journal = journalExporte(site);
  site.close();
  assert.equal(journal.lots.length, 2);
  for (const l of journal.lots) {
    for (const x of l.modifications) {
      if (!['page', 'metier'].includes(x.table) || (x.table === 'page' && x.cle.id !== id)) continue;
      for (const ligne of [x.avant, x.apres]) {
        if (!ligne) continue;
        for (const [c, v] of Object.entries(ligne)) if (typeof v === 'string') ligne[c] = avant0098(x.table, x.cle, c, v);
      }
    }
  }
  const notee = journal.lots[0].modifications.find((x) => x.table === 'page' && x.cle.id === id);
  assert.ok(notee.avant.corps_md.includes(SUR_LA_PAGE.lien) && !notee.avant.corps_md.includes(SUR_LA_PAGE.balise), 'le lot d’avant 0098 note le lien');
  const verifier = (base) => {
    assert.equal(base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md, `${corps}\n\nEssai de rejeu des liens.\n`, 'aucun faux conflit, la balise');
    assert.equal(base.prepare('SELECT artisanat_texte FROM metier WHERE id = ?').get('metiers/alchimiste').artisanat_texte, `${artisanat} (essai)`);
    const vocabulaire = vocabulaireDesMotsCles(motsClesDeLaBase(base));
    const texte = base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
    assert.deepEqual(formesNonCanoniques(texte, vocabulaire, { markdown: true }), []);
    assert.deepEqual(liensDuTexte(texte, { markdown: true }).filter((l) => l.cible !== '/#lien-discord'), []);
  };
  // rejeu (livraison)
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  assert.equal(bilan.conflits, 0, JSON.stringify(neuve.prepare("SELECT lot_id, table_nom, detail FROM modification WHERE etat = 'conflit'").all()));
  verifier(neuve);
  neuve.close();
  // db:appliquer-edition, puis db:check (aucun lien, balises canoniques) sur data/rows reconstruit
  const rows = join(dossier, 'rapatriement', 'rows');
  cpSync(ROWS, rows, { recursive: true });
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  const base = join(dossier, 'rapatriement', 'regles.db');
  for (const [script, args] of [['db-build.mjs', ['--out', base, '--rows', rows]], ['db-derive.mjs', [base]], ['db-check.mjs', [base]]]) {
    const x = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', script), ...args], { encoding: 'utf8', cwd: RACINE });
    assert.equal(x.status, 0, `${script} : ${x.stderr || x.stdout}`.slice(0, 2000));
  }
  const reconstruite = new DatabaseSync(base, { readOnly: true });
  verifier(reconstruite);
  reconstruite.close();
});
