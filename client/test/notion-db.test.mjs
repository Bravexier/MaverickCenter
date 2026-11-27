// Le bloc calculé `notion` d'une page de notion (lib/notion-db.mjs, décision R309 (7)) : ce que la base sait du mot-clé qu'ancre la page, lu dans une base
// d'essai aux noms inventés (test/aide-ancrage.mjs). Aucun texte du site n'est figé : chaque valeur attendue est celle que le test a posée.
//   node --test test/notion-db.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adresseDeLaPage } from '../src/lib/adresses-db.mjs';
import { BLOC_DE_NOTION, CORPS_D_UNE_PAGE_DE_NOTION, morceauxDuChapitre } from '../src/lib/guide.mjs';
import { chargerNotion } from '../src/lib/notion-db.mjs';
import { baseDAncrage, poserMagie, poserMotCle, poserPage, poserSort } from './aide-ancrage.mjs';

/** Une base d'essai et une page de notion « Zephyrion » qui ancre son mot-clé (`page.mot_cle_id`). Le vocabulaire est lu une fois par base : une base par cas. */
function monde(options = {}) {
  const db = baseDAncrage();
  const page = poserPage(db, 'guide/zephyrion-notion', 'Zephyrion');
  const motCle = poserMotCle(db, { libelle: 'Zephyrion', url: adresseDeLaPage(page, null), ...options });
  db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(motCle, page);
  return { db, page, motCle };
}

const etiqueterUnSort = (db, sort, motCle) => db.prepare('INSERT INTO sort_mot_cle (sort_id, mot_cle_id) VALUES (?, ?)').run(sort, motCle);
const etiqueterUnePage = (db, page, motCle) => {
  const ordre = db.prepare('SELECT count(*) AS n FROM page_tag WHERE page_id = ?').get(page).n;
  db.prepare('INSERT INTO page_tag (page_id, ordre, tag_id) VALUES (?, ?, ?)').run(page, ordre, motCle);
};

test('la définition écrite est rendue telle quelle ; sans définition ni résumé, elle est absente (R268)', () => {
  const sans = monde();
  assert.equal(chargerNotion(sans.db, sans.page).definition, null);
  const avec = monde();
  avec.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run('Définition d’essai, avec {{zephyrion-b}}.', avec.motCle);
  assert.equal(chargerNotion(avec.db, avec.page).definition, 'Définition d’essai, avec {{zephyrion-b}}.');
});

test('un mot-clé sans définition prend le texte de son élément (le résumé de sa page), comme partout ailleurs', () => {
  const { db, page } = monde();
  db.prepare('UPDATE page SET resume = ? WHERE id = ?').run('Résumé d’essai.', page);
  assert.equal(chargerNotion(db, page).definition, 'Résumé d’essai.');
});

test('le type est la catégorie du mot-clé quand il en a exactement une ; les synonymes gardent leur ordre', () => {
  const une = monde({ categories: ['Règles'], synonymes: ['Zeph', 'Aure', 'Brise'] });
  const notion = chargerNotion(une.db, une.page);
  assert.equal(notion.type, 'Règles');
  assert.deepEqual(notion.synonymes, ['Zeph', 'Aure', 'Brise']);
  const deux = monde({ categories: ['Règles', 'Magie'] });
  assert.equal(chargerNotion(deux.db, deux.page).type, null);
  const aucune = monde();
  assert.equal(chargerNotion(aucune.db, aucune.page).type, null);
  assert.deepEqual(chargerNotion(aucune.db, aucune.page).synonymes, []);
});

test('les sorts étiquetés par le mot-clé sont groupés par magie (par nom), dans l’ordre de la magie, avec leur adresse', () => {
  const { db, page, motCle } = monde();
  poserMagie(db, 'magies/zephyrion-vent', 'Zephyrion Vent');
  poserMagie(db, 'magies/zephyrion-aube', 'Zephyrion Aube');
  const second = poserSort(db, 'magies/zephyrion-vent', 'Souffle B');
  const premier = poserSort(db, 'magies/zephyrion-vent', 'Souffle A');
  const autre = poserSort(db, 'magies/zephyrion-aube', 'Lueur');
  poserSort(db, 'magies/zephyrion-aube', 'Sans étiquette');
  for (const s of [premier, second, autre]) etiqueterUnSort(db, s, motCle);
  const { sorts } = chargerNotion(db, page);
  assert.deepEqual(sorts.map((g) => g.magie.nom), ['Zephyrion Aube', 'Zephyrion Vent']);
  assert.equal(sorts[0].magie.adresse, '/magies/zephyrion-aube/');
  assert.deepEqual(sorts[0].sorts, [{ id: autre, nom: 'Lueur', adresse: '/magies/zephyrion-aube/#sort-lueur' }]);
  // l'ordre de la page de la magie (sort.ordre), pas l'ordre alphabétique : « Souffle B » a été posé avant « Souffle A »
  assert.deepEqual(sorts[1].sorts.map((s) => s.nom), ['Souffle B', 'Souffle A']);
  assert.equal(sorts[1].sorts[0].adresse, '/magies/zephyrion-vent/#sort-souffle-b');
});

test('un mot-clé de type de sort montre les sorts de ce type ; un sort étiqueté et du type n’apparaît qu’une fois', () => {
  const { db, page, motCle } = monde();
  db.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'meteo'").run(motCle);
  poserMagie(db, 'magies/zephyrion-vent', 'Zephyrion Vent');
  const duType = poserSort(db, 'magies/zephyrion-vent', 'Averse', { types: ['meteo'] });
  const dUnAutreType = poserSort(db, 'magies/zephyrion-vent', 'Coup', { types: ['attaque'] });
  const aLesDeux = poserSort(db, 'magies/zephyrion-vent', 'Brume', { types: ['meteo', 'entrave'] });
  etiqueterUnSort(db, aLesDeux, motCle);
  const etiquete = poserSort(db, 'magies/zephyrion-vent', 'Bourrasque', { types: ['attaque'] });
  etiqueterUnSort(db, etiquete, motCle);
  const ids = chargerNotion(db, page).sorts.flatMap((g) => g.sorts.map((s) => s.id));
  assert.deepEqual([...ids].sort(), [aLesDeux, duType, etiquete].sort());
  assert.ok(!ids.includes(dUnAutreType));
  assert.equal(new Set(ids).size, ids.length, 'chaque sort une seule fois');
});

test('une magie dont la page a un segment renommé donne l’adresse d’aujourd’hui (R316)', () => {
  const { db, page, motCle } = monde();
  poserPage(db, 'magies/zephyrion-vent', 'Zephyrion Vent');
  poserMagie(db, 'magies/zephyrion-vent', 'Zephyrion Vent');
  db.prepare("UPDATE page SET slug_adresse = 'zephyrion-brise' WHERE id = 'magies/zephyrion-vent'").run();
  etiqueterUnSort(db, poserSort(db, 'magies/zephyrion-vent', 'Souffle A'), motCle);
  const [groupe] = chargerNotion(db, page).sorts;
  assert.equal(groupe.magie.adresse, '/magies/zephyrion-brise/');
  assert.equal(groupe.sorts[0].adresse, '/magies/zephyrion-brise/#sort-souffle-a');
});

test('les pages étiquetées sont groupées par rubrique, sans la page elle-même ni une page d’exemple', () => {
  const { db, page, motCle } = monde();
  const guide = poserPage(db, 'guide/zephyrion-regle', 'Règle B de Zephyrion');
  const guideBis = poserPage(db, 'guide/zephyrion-regle-a', 'Règle A de Zephyrion');
  const race = poserPage(db, 'races/zephyrion-peuple', 'Peuple de Zephyrion');
  const exemple = poserPage(db, 'guide/zephyrion-exemple', 'Exemple de Zephyrion');
  poserPage(db, 'classes/zephyrion-sans-etiquette', 'Classe sans étiquette');
  db.prepare("UPDATE page SET statut = 'example' WHERE id = ?").run(exemple);
  for (const p of [guide, guideBis, race, exemple, page]) etiqueterUnePage(db, p, motCle);
  const { pages } = chargerNotion(db, page);
  // l'ordre des rubriques est celui de lib/types.mjs#TYPES (les races avant le guide), les pages d'un groupe par titre
  assert.deepEqual(pages.map((g) => g.rubrique), ['races', 'guide']);
  assert.deepEqual(pages[0].pages, [{ id: race, titre: 'Peuple de Zephyrion', adresse: adresseDeLaPage(race, null) }]);
  assert.deepEqual(pages[1].pages.map((p) => p.id), [guideBis, guide]);
});

test('le lien de la Recherche porte la clé du mot-clé ; chaque partie vide est vide', () => {
  const { db, page, motCle } = monde();
  db.prepare('UPDATE mot_cle SET cle = ? WHERE id = ?').run('zephyrion-b', motCle);
  const notion = chargerNotion(db, page);
  assert.equal(notion.recherche, '/recherche/?mot-cle=zephyrion-b');
  assert.deepEqual(notion.mot_cle, { id: motCle, cle: 'zephyrion-b', libelle: 'Zephyrion' });
  assert.deepEqual(notion.sorts, []);
  assert.deepEqual(notion.pages, []);
  assert.deepEqual(notion.synonymes, []);
  assert.equal(notion.definition, null);
  assert.equal(notion.type, null);
});

test('une page sans mot-clé, ou inconnue, n’a pas de notion', () => {
  const { db } = monde();
  const nue = poserPage(db, 'guide/zephyrion-nue', 'Page nue');
  assert.equal(chargerNotion(db, nue), null);
  assert.equal(chargerNotion(db, 'guide/n-existe-pas'), null);
});

test('le corps d’une page de notion n’est que son marqueur de bloc', () => {
  assert.equal(BLOC_DE_NOTION, 'notion');
  assert.equal(CORPS_D_UNE_PAGE_DE_NOTION, '<!-- guide:notion -->\n');
  assert.deepEqual(morceauxDuChapitre(CORPS_D_UNE_PAGE_DE_NOTION), [{ bloc: 'notion' }]);
});
