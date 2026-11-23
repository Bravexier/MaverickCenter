// Ce que montre un mot-clé (décision R309, §8 de docs/chantier-ancrage-mots-cles.md) : sa définition écrite s'il en a une, sinon le texte de son élément
// (le résumé de sa page, les effets de son sort), lu à l'affichage et jamais recopié ; ni l'un ni l'autre : pas de bulle. Bases d'essai aux noms inventés
// (test/aide-ancrage.mjs) : rien n'est lu dans data/rows.
//   node --test test/mots-cles-element.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { vocabulaire } from '../serveur/edition-chronologie.mjs';
import {
  definitionDuMotCle, htmlDeLaBalise, htmlDeLaBulle, htmlDeLaLigneDuGlossaire, texteSansBalises, vocabulaireDesMotsCles, lireUneBalise,
} from '../src/lib/mots-cles-balises.mjs';
import { adresseDeLaPage } from '../src/lib/adresses-db.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDAncrage, poserMagie, poserMotCle, poserPage, poserSort } from './aide-ancrage.mjs';

/** Un mot-clé d'essai dont la clé est celle de son libellé (les balises la citent), avec sa définition écrite s'il en a une. */
function mot(db, libelle, { description = null } = {}) {
  const id = poserMotCle(db, { libelle });
  db.prepare('UPDATE mot_cle SET cle = ?, description = ? WHERE id = ?').run(normalize(libelle), description, id);
  return id;
}

/**
 * Une base d'essai : « Zéphyra » (une page, un résumé, aucune définition écrite), « Borée » (un sort, des effets), « Auster » (une page et une définition
 * écrite), « Notus » (rien), « Eurus » (une page sans résumé), « Levant » (une page dont le résumé porte une balise et un montant).
 */
function monde() {
  const db = baseDAncrage();
  const ids = {};
  ids.zephyra = mot(db, 'Zéphyra');
  db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(ids.zephyra, poserPage(db, 'guide/zephyra', 'Zéphyra', { resume: 'Le résumé de la page de Zéphyra.' }));
  ids.boree = mot(db, 'Borée');
  const magie = poserMagie(db, 'magies/magie-de-boree', 'Magie de Borée');
  db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(ids.boree, poserSort(db, magie, 'Borée', { effets: 'Les effets du sort Borée.\nUne seconde ligne.' }));
  ids.auster = mot(db, 'Auster', { description: 'La définition écrite d’Auster.' });
  db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(ids.auster, poserPage(db, 'guide/auster', 'Auster', { resume: 'Le résumé d’Auster, jamais montré.' }));
  ids.notus = mot(db, 'Notus');
  ids.eurus = mot(db, 'Eurus');
  db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(ids.eurus, poserPage(db, 'guide/eurus', 'Eurus'));
  ids.levant = mot(db, 'Levant');
  db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(ids.levant, poserPage(db, 'guide/levant', 'Levant', { resume: 'Voir {{boree|le vent du nord}} : coûte 5 RO.' }));
  return { db, ids };
}

/** Le vocabulaire prêt, tel que le lisent la bulle et les balises (le site construit : motsClesDeLaBase). */
const vocabulaireDe = (db) => vocabulaireDesMotsCles(motsClesDeLaBase(db));
const motDe = (v, cle) => v.parCle.get(cle);
const bulleDe = (v, cle) => htmlDeLaBulle(motDe(v, cle).id, v);
const texteDeLaBulle = (html) => /<span class="bulle__texte">(.*)<\/span><\/span>$/s.exec(html)?.[1] ?? null;

test('une définition écrite reste prioritaire sur le texte de l’élément (R309)', () => {
  const { db } = monde();
  const v = vocabulaireDe(db);
  const auster = motDe(v, 'auster');
  assert.equal(auster.element.texte, 'Le résumé d’Auster, jamais montré.', 'l’élément est bien lu');
  assert.equal(definitionDuMotCle(auster), 'La définition écrite d’Auster.');
  assert.equal(texteDeLaBulle(bulleDe(v, 'auster')), 'La définition écrite d’Auster.');
  assert.doesNotMatch(bulleDe(v, 'auster'), /jamais montré/);
});

test('sans définition : le résumé de la page, ou les effets du sort', () => {
  const { db } = monde();
  const v = vocabulaireDe(db);
  assert.equal(definitionDuMotCle(motDe(v, 'zephyra')), 'Le résumé de la page de Zéphyra.');
  assert.equal(definitionDuMotCle(motDe(v, 'boree')), 'Les effets du sort Borée.\nUne seconde ligne.');
  assert.equal(texteDeLaBulle(bulleDe(v, 'zephyra')), 'Le résumé de la page de Zéphyra.');
  // les retours à la ligne des effets sont gardés (la bulle les montre : white-space: pre-line)
  assert.equal(texteDeLaBulle(bulleDe(v, 'boree')), 'Les effets du sort Borée.\nUne seconde ligne.');
  // la balise le montre et pose sa bulle : `data-bulle`, sans définition écrite
  assert.match(htmlDeLaBalise(lireUneBalise('{{zephyra}}'), v).html, /data-bulle="mot-cle-zephyra"/);
  assert.equal(htmlDeLaBalise(lireUneBalise('{{zephyra}}'), v).id, motDe(v, 'zephyra').id);
  // jamais recopié : la définition écrite du vocabulaire reste vide, comme dans la base
  assert.equal(motDe(v, 'zephyra').description, '');
  assert.equal(db.prepare('SELECT description FROM mot_cle WHERE id = ?').get(motDe(v, 'zephyra').id).description, null);
});

test('ni l’un ni l’autre : pas de bulle', () => {
  const { db } = monde();
  const v = vocabulaireDe(db);
  for (const cle of ['notus', 'eurus']) { // Notus n'a pas d'élément ; la page d'Eurus n'a pas de résumé
    assert.equal(definitionDuMotCle(motDe(v, cle)), null, cle);
    assert.equal(bulleDe(v, cle), '', cle);
    const { html, id } = htmlDeLaBalise(lireUneBalise(`{{${cle}}}`), v);
    assert.doesNotMatch(html, /data-bulle|aria-describedby/, cle);
    assert.equal(id, null, cle);
  }
  assert.equal(definitionDuMotCle({ description: '', element: null }), null);
  assert.equal(definitionDuMotCle({ description: '', element: { texte: '' } }), null);
  assert.equal(definitionDuMotCle({ description: null }), null);
});

test('la bulle, le mode complet et la sous-ligne du Glossaire montrent le même texte', () => {
  const { db } = monde();
  const v = vocabulaireDe(db);
  for (const [cle, voulu] of [['zephyra', 'Le résumé de la page de Zéphyra.'], ['auster', 'La définition écrite d’Auster.']]) {
    const m = motDe(v, cle);
    assert.equal(texteDeLaBulle(bulleDe(v, cle)), voulu, `bulle de ${cle}`);
    assert.match(htmlDeLaBalise(lireUneBalise(`{{${cle}:}}`), v).html, new RegExp(`<span class="mot-cle-definition__texte">${voulu}</span>`), `mode complet de ${cle}`);
    assert.equal(texteSansBalises(`{{${cle}:}}`, v), `${m.libelle} : ${voulu}`, `texte simple du mode complet de ${cle}`);
    assert.match(htmlDeLaLigneDuGlossaire(m), new RegExp(`<td colspan="\\d+" class="glossaire-mot__definition">${voulu}</td>`), `sous-ligne de ${cle}`);
  }
  // sans rien à montrer : la ligne le dit, comme avant
  assert.match(htmlDeLaLigneDuGlossaire(motDe(v, 'notus')), /glossaire-mot__definition--vide">Pas encore de définition\.</);
});

test('une balise dans le texte de l’élément se rend comme dans une définition', () => {
  const { db } = monde();
  const v = vocabulaireDe(db);
  const bulle = bulleDe(v, 'levant');
  // la balise devient son texte simple, le montant ses icônes (htmlAvecMonnaies) : le même chemin qu'une définition écrite
  assert.doesNotMatch(bulle, /\{\{/);
  assert.match(bulle, /Voir le vent du nord : coûte <span class="montant"[^>]*>.*<span class="piece piece--ro"/);
  const ecrite = vocabulaireDesMotsCles([{ id: 1, cle: 'levant', libelle: 'Levant', description: 'Voir {{boree|le vent du nord}} : coûte 5 RO.' }, ...motsClesDeLaBase(db).filter((m) => m.cle === 'boree')]);
  assert.equal(texteDeLaBulle(bulle), texteDeLaBulle(htmlDeLaBulle(1, ecrite)));
  // la sous-ligne garde la balise telle qu'écrite (le middleware, ou mots-cles-vivants.mjs, la rend) et met le montant en icônes
  assert.match(htmlDeLaLigneDuGlossaire(motDe(v, 'levant')), /glossaire-mot__definition">Voir \{\{boree\|le vent du nord\}\} : coûte <span class="montant"/);
});

test('la définition écrite reste distincte : aucun champ de l’éditeur ne se pré-remplit avec le texte de l’élément', () => {
  const { db } = monde();
  const v = vocabulaireDe(db);
  const sansDefinition = htmlDeLaLigneDuGlossaire(motDe(v, 'zephyra'));
  assert.doesNotMatch(sansDefinition, /data-definition=/, 'data-definition : la définition écrite, lue par l’éditeur');
  assert.match(sansDefinition, /Le résumé de la page de Zéphyra\./, 'la sous-ligne montre le texte de l’élément');
  assert.match(htmlDeLaLigneDuGlossaire(motDe(v, 'auster')), /data-definition="La définition écrite d’Auster\."/);
  assert.doesNotMatch(htmlDeLaLigneDuGlossaire(motDe(v, 'auster')), /jamais montré/);
});

test('motsClesDeLaBase porte l’élément (le premier), et peut ne pas lire les textes', () => {
  const { db, ids } = monde();
  const tous = new Map(motsClesDeLaBase(db).map((m) => [m.id, m]));
  assert.deepEqual(tous.get(ids.zephyra).element, { table: 'page', id: 'guide/zephyra', adresse: adresseDeLaPage('guide/zephyra'), texte: 'Le résumé de la page de Zéphyra.' });
  assert.equal(tous.get(ids.boree).element.table, 'sort');
  assert.equal(tous.get(ids.notus).element, null);
  assert.equal(tous.get(ids.eurus).element.texte, null);
  // l'option des chemins d'écriture : aucun élément, rien d'autre ne change
  const sans = motsClesDeLaBase(db, { elements: false });
  assert.deepEqual(sans.map((m) => m.element), sans.map(() => null));
  assert.deepEqual(sans.map(({ element, ...m }) => m), motsClesDeLaBase(db).map(({ element, ...m }) => m));
});

test('le vocabulaire du site de dev porte le texte de l’élément jusqu’à la bulle (GET /api/edition/mots-cles/)', () => {
  const { db } = monde();
  // ce que reçoit le navigateur : le JSON de la route, puis vocabulaireDesMotsCles (mots-cles-vivants.mjs#definirLeVocabulaire)
  const recu = JSON.parse(JSON.stringify(vocabulaire(db)));
  const v = vocabulaireDesMotsCles(recu);
  assert.equal(recu.find((m) => m.cle === 'zephyra').description, null, 'la définition écrite reste vide : l’éditeur ne voit pas le texte de l’élément');
  assert.equal(texteDeLaBulle(bulleDe(v, 'zephyra')), 'Le résumé de la page de Zéphyra.');
  assert.equal(texteDeLaBulle(bulleDe(v, 'boree')), 'Les effets du sort Borée.\nUne seconde ligne.');
  assert.equal(bulleDe(v, 'notus'), '');
  assert.match(htmlDeLaLigneDuGlossaire({ ...recu.find((m) => m.cle === 'zephyra'), lien: null }), /Le résumé de la page de Zéphyra\./);
});

test('le service ne lit les textes des éléments que là où il les affiche (les chemins d’écriture passent `elements: false`)', () => {
  // un lot appelle motsClesDeLaBase à chaque ligne (et deux fois par mot-clé créé) : les textes des 1 764 éléments n'y servent à rien
  const dossier = fileURLToPath(new URL('../serveur/', import.meta.url));
  const avecTextes = [];
  for (const f of readdirSync(dossier).filter((x) => x.endsWith('.mjs'))) {
    for (const [i, ligne] of readFileSync(`${dossier}${f}`, 'utf8').split(/\r?\n/).entries()) {
      if (/motsClesDeLaBase\(/.test(ligne) && !/^\s*(import|\/\/|\*)/.test(ligne) && !ligne.includes('elements: false')) avecTextes.push(`${f}:${i + 1}`);
    }
  }
  // la liste de l'éditeur (`listes`, edition.mjs) et le vocabulaire du Glossaire (GET /api/edition/mots-cles/, edition-chronologie.mjs) : les deux affichent
  assert.deepEqual(avecTextes.map((x) => x.split(':')[0]).sort(), ['edition-chronologie.mjs', 'edition.mjs']);
});
