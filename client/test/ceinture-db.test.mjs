// Objets à la ceinture (décisions R81 et R82) : la vue v_objet_ceinture (migration 0047) et le chargement de la page /ressources/objets-a-la-ceinture/
// (lib/ceinture-db.mjs ; les bâtons magiques, qui sont dans la vue, ont leur tableau dans l'onglet de la page « Équipement » : test/equipement.test.mjs),
// lus dans la base construite. Le site de dev peut créer, renommer et supprimer des contenants (page « Composants ») et réécrire
// les pages du guide : les tests contrôlent des invariants (la vue suit les tables, la page suit les sections), et ce qui vient de l'import (les
// contenants que le guide nomme, les sections des pages) est lu tel que l'import l'a laissé (lib/historique-site.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { normalize } from '../src/lib/text.mjs';
import {
  CHAPITRE_DE_LA_CEINTURE, FAMILLE_DES_BATONS, FAMILLES_DE_LA_CEINTURE, PAGE_DE_REFERENCE, TITRE_DE_LA_REFERENCE, TITRE_DES_REGLES,
  chargerObjetsDeCeinture, sectionDuCorps,
} from '../src/lib/ceinture-db.mjs';
import { ancreDObjet, htmlDeLigneDePotion, htmlDeLignes, texteDeRecherche } from '../src/lib/ceinture-rendu.mjs';

const db = ouvrirBase();
const vue = db.prepare('SELECT famille, ressource_id, baton_id FROM v_objet_ceinture').all().map((l) => ({ ...l }));
const objets = chargerObjetsDeCeinture(db);
const tableau = (famille) => objets.tableaux.find((t) => t.famille === famille);
const cle = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const historique = historiqueSite(db);
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

test('v_objet_ceinture : toutes les potions et huiles, chacune une fois, sous la famille de sa recette (R81)', () => {
  const potions = db.prepare('SELECT ressource_id, famille FROM potion').all();
  const dansLaVue = vue.filter((v) => v.famille !== 'contenant' && v.famille !== 'baton');
  assert.equal(dansLaVue.length, potions.length);
  const parId = new Map(dansLaVue.map((v) => [v.ressource_id, v.famille]));
  for (const p of potions) assert.equal(parId.get(p.ressource_id), p.famille, p.ressource_id);
  for (const f of ['fiole', 'philtre', 'remede', 'primitive', 'huile']) assert.ok(dansLaVue.some((v) => v.famille === f), `famille ${f}`);
});

test('v_objet_ceinture : les contenants sont les carquois, sacs de bombes et sacs de pierres du matériel, et rien d’autre (R81)', () => {
  const contenants = new Set(vue.filter((v) => v.famille === 'contenant').map((v) => v.ressource_id));
  const materiel = db.prepare("SELECT id, nom, nom_cle FROM ressource WHERE genre = 'materiel'").all();
  // la même règle qu'en SQL (LIKE sur la clé du nom, normalize(nom)), refaite ici depuis le nom
  const attendus = materiel.filter((r) => ['carquois', 'sac-de-bombe', 'sac-de-pierre'].some((m) => normalize(r.nom).includes(m))).map((r) => r.id);
  assert.deepEqual([...contenants].sort(), attendus.sort());
  // à l'import, le matériel avait un objet de chacune des sortes que le guide nomme (le site de dev peut depuis les renommer ou les supprimer)
  const importe = historique.lignesDImport('ressource').filter((r) => r.genre === 'materiel');
  for (const mot of ['carquois', 'sac-de-bombe', 'sac-de-pierre']) assert.ok(importe.some((r) => normalize(r.nom).includes(mot)), `le guide nomme « ${mot} »`);
  // le matériel que le guide cite aussi (briquet, torche, lanterne, corde, kits) n'est pas sur la page : il reste dans « Composants » (R81)
  for (const r of materiel.filter((x) => /^(briquet|torche|lanterne|corde|kit|sac de medecin)/.test(cle(x.nom)))) {
    assert.ok(!contenants.has(r.id), r.nom);
  }
  // les flèches et les carreaux ne sont pas des contenants
  for (const r of materiel.filter((x) => /^(fleche|carreau)$/.test(cle(x.nom)))) assert.ok(!contenants.has(r.id), r.nom);
});

test('v_objet_ceinture : tous les bâtons magiques ; une ligne = une potion, un contenant OU un bâton ; pas de bouclier (R82)', () => {
  const batons = db.prepare('SELECT id FROM baton_magique').all().map((b) => b.id);
  assert.deepEqual(vue.filter((v) => v.famille === 'baton').map((v) => v.baton_id).sort(), batons.sort());
  for (const v of vue) assert.ok((v.ressource_id === null) !== (v.baton_id === null), JSON.stringify(v));
  const ids = vue.map((v) => v.ressource_id ?? v.baton_id);
  assert.equal(new Set(ids).size, ids.length, 'chaque objet une seule fois (une potion n’est pas aussi un contenant)');
  const genres = db.prepare('SELECT DISTINCT r.genre FROM v_objet_ceinture v JOIN ressource r ON r.id = v.ressource_id').all().map((g) => g.genre).sort();
  assert.deepEqual(genres, ['materiel', 'potion']);
  const noms = db.prepare('SELECT r.nom FROM v_objet_ceinture v JOIN ressource r ON r.id = v.ressource_id').all().map((r) => cle(r.nom));
  assert.ok(!noms.some((n) => n.includes('bouclier')), 'le bouclier a son emplacement dans l’armure');
  assert.deepEqual(new Set(vue.map((v) => v.famille)), new Set([...FAMILLES_DE_LA_CEINTURE.map((f) => f.famille), FAMILLE_DES_BATONS]),
    'une famille de la vue = un tableau de la page, sauf les bâtons (l’onglet « Bâtons magiques » de la page « Équipement »)');
});

test('chargement : un tableau par famille, dans l’ordre ; chaque objet de la vue une fois, sauf les bâtons', () => {
  assert.deepEqual(objets.tableaux.map((t) => t.famille), FAMILLES_DE_LA_CEINTURE.map((f) => f.famille));
  assert.ok(!objets.tableaux.some((t) => t.famille === FAMILLE_DES_BATONS), 'pas de tableau des bâtons');
  assert.equal(objets.tableaux.reduce((n, t) => n + t.nombre, 0), vue.filter((v) => v.famille !== FAMILLE_DES_BATONS).length);
  for (const t of objets.tableaux.filter((x) => x.pages)) {
    const ids = t.pages.flatMap((p) => p.potions.map((x) => x.id));
    assert.equal(ids.length, t.nombre, t.famille);
    assert.equal(new Set(ids).size, ids.length, `${t.famille} : chaque potion une fois`);
    const titres = t.pages.map((p) => p.titre);
    assert.deepEqual(titres, [...titres].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })), `${t.famille} : pages par ordre alphabétique`);
    for (const p of t.pages) assert.ok(p.existe, `${p.id} : la page de la potion existe`);
  }
  assert.equal(tableau('contenant').objets.length, tableau('contenant').nombre);
});

test('chargement : dans une page, les potions dans l’ordre où la page les écrit', () => {
  for (const t of objets.tableaux.filter((x) => x.pages)) {
    for (const p of t.pages) {
      const corps = cle(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(p.id).corps_md);
      const places = p.potions.map((x) => corps.indexOf(`| ${cle(x.nom)} |`));
      assert.ok(places.every((i) => i >= 0), `${p.id} : chaque potion a son tableau dans la page`);
      assert.deepEqual(places, [...places].sort((a, b) => a - b), p.id);
    }
  }
});

test('règles : les sections des pages du guide ; l’import les écrivait, la page suit leur texte actuel', () => {
  const sections = [
    ['ceinture', CHAPITRE_DE_LA_CEINTURE, TITRE_DES_REGLES, /emplacements/],
    ['reference', PAGE_DE_REFERENCE, TITRE_DE_LA_REFERENCE, /non exhaustive/], // la liste du guide n'est pas exhaustive : la page le montre
  ];
  for (const [regle, id, titre, attendu] of sections) {
    const importe = historique.valeurDImport('page', { id }, 'corps_md');
    assert.match(sectionDuCorps(importe, titre) ?? '', attendu, `${id} : l’import écrit la section « ${titre ?? 'introduction'} »`);
    const actuel = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id)?.corps_md;
    assert.equal(objets.regles[regle], actuel === undefined ? null : sectionDuCorps(actuel, titre), `${regle} : la page suit le texte actuel`);
    if (objets.regles[regle]) assert.ok(!objets.regles[regle].split('\n').some((l) => /^#{1,2} /.test(l)), `${regle} : la section seule, sans le titre suivant`);
  }
  for (const [source, id] of [['chapitre', CHAPITRE_DE_LA_CEINTURE], ['reference', PAGE_DE_REFERENCE]]) {
    assert.equal(objets.sources[source]?.titre, db.prepare('SELECT titre FROM page WHERE id = ?').get(id)?.titre, `${source} : le titre actuel de la page`);
  }
});

test('sectionDuCorps : une section jusqu’au titre suivant de même niveau ou plus haut ; l’introduction ; absente', () => {
  const corps = 'Intro.\n\n## A\n\nTexte A.\n\n### A1\n\nSous A.\n\n## B\n\nTexte B.';
  assert.equal(sectionDuCorps(corps, null), 'Intro.');
  assert.equal(sectionDuCorps(corps, '## A'), 'Texte A.\n\n### A1\n\nSous A.');
  assert.equal(sectionDuCorps(corps, '## A', { avecTitre: true }).split('\n')[0], '## A');
  assert.equal(sectionDuCorps(corps, '### A1'), 'Sous A.');
  assert.equal(sectionDuCorps(corps, '## B'), 'Texte B.');
  assert.equal(sectionDuCorps(corps, '## C'), null);
  assert.equal(sectionDuCorps('## A\n\nTexte.', null), null, 'pas d’introduction');
});

test('rendu : lignes d’un effet sans leur puce, échappées ; monnaies en icônes', () => {
  assert.equal(htmlDeLignes('- Redonne 15 santé\n- 1 croix à la perception pendant 2 tours'), 'Redonne 15 santé<br>1 croix à la perception pendant 2 tours');
  assert.equal(htmlDeLignes('ampli am = +1 am <donné>'), 'ampli am = +1 am &lt;donné&gt;');
  assert.match(htmlDeLignes(''), /class="vide"/);
  const p = tableau('fiole').pages[0].potions[0];
  const html = htmlDeLigneDePotion(p);
  assert.ok(html.includes(`id="${ancreDObjet(p.id)}"`));
  assert.match(html, /class="piece piece--/, 'le prix en icônes (R63)');
  assert.ok(html.includes(`data-recherche="${echapper(texteDeRecherche(p.nom, p.niveau, p.effet))}"`));
  assert.equal(texteDeRecherche('Fiole  Rouge', null, 'Récupère'), 'fiole rouge recupere');
});
