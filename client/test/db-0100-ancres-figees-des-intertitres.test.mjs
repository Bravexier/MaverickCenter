// Migration 0100-ancres-figees-des-intertitres (lot « Défauts du code », points 6 et 7) : pose les ancres figées (lib/ancres-figees.mjs) sur les
// intertitres que le code vise. Chaque altération d'état a la sienne sur sa page, égale au segment de son id après « #etat: »
// (lib/magies-db.mjs#ancreDeLEtat, identifiants figés, fautes comprises) ; la section de la ceinture a les deux de lib/ceinture-db.mjs
// (ANCRE_DES_REGLES sur CHAPITRE_DE_LA_CEINTURE, ANCRE_DE_LA_REFERENCE sur PAGE_DE_REFERENCE).
// Aucun texte figé : les intertitres attendus se tirent de la base (la ligne ancrée sans sa marque), jamais d'un littéral. À l'import
// (test/aide-base-d-import.mjs : la migration a le dernier mot sur un corps que le site avait écrit avant elle) la migration a tout posé ; aujourd'hui,
// seuls les invariants (une ancre au plus une fois par page) ; l'ancre de chaque état sur la base courante est dans test/etat-ancre.test.mjs.
//   node --test test/db-0100-ancres-figees-des-intertitres.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ANCRE_FIGEE, ancresDuCorps } from '../src/lib/ancres-figees.mjs';
import { ANCRE_DE_LA_REFERENCE, ANCRE_DES_REGLES, CHAPITRE_DE_LA_CEINTURE, PAGE_DE_REFERENCE } from '../src/lib/ceinture-db.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ancreDeLEtat } from '../src/lib/magies-db.mjs';
import { baseDImport, cheminDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';

const MIGRATION = '0100-ancres-figees-des-intertitres.sql';
const CEINTURE = [[CHAPITRE_DE_LA_CEINTURE, ANCRE_DES_REGLES], [PAGE_DE_REFERENCE, ANCRE_DE_LA_REFERENCE]];

// la page d'un état est le préfixe de son id (lib/magies-db.mjs, `pageId`)
const ETATS = "SELECT id, substr(id, 1, instr(id, '#') - 1) AS page_id FROM etat ORDER BY ordre, id";
/** Les ancres que la migration pose : [[page, ancre]] (une par état, puis les deux de la ceinture). */
const voulues = (db) => [...db.prepare(ETATS).all().map((e) => [e.page_id, ancreDeLEtat(e.id)]), ...CEINTURE];
const corpsDe = (db, id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id)?.corps_md;
const ancres = (corps) => ancresDuCorps(corps).map((a) => a.ancre);
/** Les ancres que le SQL de la migration écrit : une marque posée par une migration postérieure (0117 : `{#somnolence}`, état créé par elle) n'en est pas. */
const ANCRES_DE_LA_MIGRATION = new Set(
  [...readFileSync(new URL(`../../data/migrations/${MIGRATION}`, import.meta.url), 'utf8').matchAll(/\{#([a-z0-9-]+)\}/g)].map((m) => m[1]),
);
/** Le corps sans les marques de ses intertitres que la migration pose : le texte d'avant elle (elle n'ajoute que ` {#ancre}` au bout de la ligne). */
const sansMarques = (corps) =>
  corps.split('\n').map((l) => (ancresDuCorps(l).some((a) => ANCRES_DE_LA_MIGRATION.has(a.ancre)) ? l.replace(/ \{#[a-z0-9-]+\}$/, '') : l)).join('\n');

/** Une copie de `chemin` où rejouer la migration. */
function copie(t, chemin) {
  const fichier = fichierTemporaire('maverick.db', 'db-0100', { t });
  copyFileSync(chemin, fichier);
  const base = new DatabaseSync(fichier);
  t.after(() => base.close());
  return base;
}

test('migration 0100, à l’import : chaque état a son ancre (son id après « #etat: ») sur un intertitre de sa page, la ceinture ses deux ancres, chacune une fois', () => {
  const db = baseDImport();
  const liste = voulues(db);
  assert.ok(liste.length > CEINTURE.length, 'des altérations d’état');
  for (const [page, ancre] of liste) {
    assert.match(ancre, ANCRE_FIGEE, `${page}#${ancre} : forme d’une ancre figée`);
    assert.equal(ancres(corpsDe(db, page) ?? '').filter((a) => a === ancre).length, 1, `${page} : « {#${ancre}} » au bout d’un seul intertitre`);
  }
  // la page des états ne porte que les ancres des états (chaque ancre posée nomme un etat.id)
  const pages = new Set(db.prepare(ETATS).all().map((e) => e.page_id));
  for (const page of pages) {
    const etats = new Set(liste.filter(([p]) => p === page).map(([, a]) => a));
    assert.deepEqual(ancres(corpsDe(db, page)).filter((a) => !etats.has(a)), [], `${page} : une ancre qui ne nomme aucun état`);
  }
});

test('migration 0100, à l’import : retirées, les marques sont reposées par la migration, et seulement elles', (t) => {
  const db = copie(t, cheminDImport());
  const pages = [...new Set(voulues(db).map(([p]) => p))];
  const importes = new Map(pages.map((p) => [p, corpsDe(db, p)]));
  const ecrire = db.prepare('UPDATE page SET corps_md = ? WHERE id = ?');
  for (const p of pages) ecrire.run(sansMarques(importes.get(p)), p);
  rejouerLaMigration(db, MIGRATION);
  for (const p of pages) assert.equal(corpsDe(db, p), importes.get(p), `${p} : le corps que la migration a écrit`);
});

test('migration 0100 rejouée sur la base courante : aucune page ne change (rien n’est posé deux fois)', (t) => {
  const db = copie(t, cheminBase({ sansExemples: false }));
  const avant = db.prepare('SELECT id, corps_md FROM page ORDER BY id').all();
  rejouerLaMigration(db, MIGRATION);
  assert.deepEqual(db.prepare('SELECT id, corps_md FROM page ORDER BY id').all(), avant);
});

test('migration 0100, garde : seule la ligne entière exacte, présente une fois, dans une page sans l’ancre, reçoit la marque', (t) => {
  const db = copie(t, cheminDImport());
  for (const [page, ancre] of [voulues(db)[0], ...CEINTURE]) {
    const titre = ancresDuCorps(corpsDe(db, page)).find((a) => a.ancre === ancre);
    const ligne = sansMarques(corpsDe(db, page).split('\n')[titre.ligne]); // l'intertitre d'avant la migration, tiré de la base
    const marque = `${ligne} {#${ancre}}`;
    const cas = [
      [`${ligne}\n\nTexte d’essai.`, `${marque}\n\nTexte d’essai.`, 'en tête du corps'],
      [`Texte d’essai.\n\n${ligne}`, `Texte d’essai.\n\n${marque}`, 'en fin de corps, sans saut de ligne final'],
      [`${ligne}\n\nA.\n\n${ligne}\n`, null, 'présente deux fois : rien'],
      [`${ligne} bis\n\nA.\n`, null, 'intertitre renommé : rien'],
      [`Texte ${ligne}\n`, null, 'pas une ligne entière : rien'],
      [`${ligne} {#autre-ancre}\n`, null, 'ligne qui porte déjà une ancre : rien'],
      [`## Intertitre d’essai {#${ancre}}\n\n${ligne}\n`, null, 'ancre déjà dans la page : rien'],
    ];
    for (const [corps, attendu, raison] of cas) {
      db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(corps, page);
      rejouerLaMigration(db, MIGRATION);
      assert.equal(corpsDe(db, page), attendu ?? corps, `${page}#${ancre} : ${raison}`);
    }
  }
});

test('aujourd’hui : une ancre figée n’apparaît qu’une fois par page, dans les pages que la migration a marquées', () => {
  const db = ouvrirBase({ sansExemples: false });
  for (const page of new Set(voulues(db).map(([p]) => p))) {
    const liste = ancres(corpsDe(db, page) ?? '');
    assert.equal(new Set(liste).size, liste.length, `${page} : deux intertitres ont la même ancre`);
  }
});
