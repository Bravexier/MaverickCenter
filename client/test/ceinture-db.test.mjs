// Objets à la ceinture (décisions R81 et R82) : la vue v_objet_ceinture (migration 0047) et le chargement de l'onglet « Ceinture » de la page
// /ressources/equipement/ (lib/ceinture-db.mjs ; demande du propriétaire du 2026-10-16 : les sous-onglets Consommables, Carquois et Bâtons magiques,
// les consommables dans l'ordre fioles, remèdes, philtres, huiles, alchimie primitive ; les bâtons, qui sont dans la vue, ont leur chargement à part :
// test/equipement.test.mjs), lus dans la base construite. Le site de dev peut créer, renommer et supprimer des contenants (page « Composants ») et réécrire
// les pages du guide : les tests contrôlent des invariants (la vue suit les tables, la page suit les sections), et ce qui vient de l'import (les
// contenants que le guide nomme, les sections des pages) est lu tel que l'import l'a laissé (lib/historique-site.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { normalize } from '../src/lib/text.mjs';
import {
  CHAPITRE_DE_LA_CEINTURE, FAMILLE_DES_BATONS, FAMILLES_DE_LA_CEINTURE, ONGLET_DES_BATONS, PAGE_DE_REFERENCE, TITRE_DE_LA_REFERENCE, TITRE_DES_REGLES,
  chargerObjetsDeCeinture, sectionDuCorps,
} from '../src/lib/ceinture-db.mjs';
import { ancreDObjet, ancreDePotions, htmlDeLigneDePotion, htmlDeLignes } from '../src/lib/ceinture-rendu.mjs';
import { SOUS_ONGLETS_DE_LA_CEINTURE } from '../src/lib/equipement.mjs';
import { AFFINITE_DES_PHILTRES, caracteristiqueDesCompetences, couleurDePotion } from '../src/lib/alchimie-couleurs.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';

const db = ouvrirBase();
const vue = db.prepare('SELECT famille, ressource_id, baton_id FROM v_objet_ceinture').all().map((l) => ({ ...l }));
const objets = chargerObjetsDeCeinture(db);
const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique').all();
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
    'une famille de la vue = un tableau de l’onglet, sauf les bâtons (leur sous-onglet, lib/batons-db.mjs)');
});

test('les sous-onglets : Consommables (fioles, remèdes, philtres, huiles, alchimie primitive, dans cet ordre), Carquois, puis Bâtons magiques', () => {
  // demande du propriétaire du 2026-10-16 : « dans l'ordre Consommable / Carquois / Bâton magiques. Les consommables regrouperai les fioles remêdes
  // philtres huiles et alchimie privatives dans cet ordre »
  const [consommables, carquois, batons] = SOUS_ONGLETS_DE_LA_CEINTURE.map((o) => o.id);
  assert.deepEqual(SOUS_ONGLETS_DE_LA_CEINTURE.map((o) => o.nom), ['Consommables', 'Carquois', 'Bâtons magiques']);
  assert.deepEqual(FAMILLES_DE_LA_CEINTURE.filter((f) => f.onglet === consommables).map((f) => f.famille), ['fiole', 'remede', 'philtre', 'huile', 'primitive']);
  assert.deepEqual(FAMILLES_DE_LA_CEINTURE.filter((f) => f.onglet === carquois).map((f) => f.famille), ['contenant']);
  assert.equal(ONGLET_DES_BATONS, batons);
  assert.ok(FAMILLES_DE_LA_CEINTURE.every((f) => f.onglet !== batons), 'le sous-onglet des bâtons a son tableau à part');
  assert.deepEqual(FAMILLES_DE_LA_CEINTURE.map((f) => f.titre), ['Fioles', 'Remèdes', 'Philtres', 'Huiles', 'Alchimie primitive', 'Carquois et sacs']);
});

test('chargement : un tableau par famille, dans l’ordre ; chaque objet de la vue une fois, sauf les bâtons', () => {
  assert.deepEqual(objets.tableaux.map((t) => t.famille), FAMILLES_DE_LA_CEINTURE.map((f) => f.famille));
  assert.deepEqual(objets.tableaux.map((t) => t.onglet), FAMILLES_DE_LA_CEINTURE.map((f) => f.onglet));
  assert.ok(!objets.tableaux.some((t) => t.famille === FAMILLE_DES_BATONS), 'pas de tableau des bâtons');
  assert.equal(objets.tableaux.reduce((n, t) => n + t.nombre, 0), vue.filter((v) => v.famille !== FAMILLE_DES_BATONS).length);
  for (const t of objets.tableaux.filter((x) => x.pages)) {
    const ids = t.pages.flatMap((p) => p.potions.map((x) => x.id));
    assert.equal(ids.length, t.nombre, t.famille);
    assert.equal(new Set(ids).size, ids.length, `${t.famille} : chaque potion une fois`);
    const titres = t.pages.map((p) => p.titre);
    assert.deepEqual(titres, [...titres].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })), `${t.famille} : pages par ordre alphabétique`);
    for (const p of t.pages) assert.ok(p.existe, `${p.id} : la page de la potion existe`);
    // chaque potion porte la couleur de la règle du site (lib/alchimie-couleurs.mjs : test/alchimie-couleurs.test.mjs) : l'essence de la première
    // variante de sa recette d'alchimie, la caractéristique de la page (une page de philtres seulement), son niveau
    for (const p of t.pages) {
      for (const x of p.potions) {
        const essence = db.prepare(`SELECT ri.affinite_id FROM recette_produit rp JOIN recette r ON r.id = rp.recette_id
          JOIN recette_ingredient ri ON ri.recette_id = r.id AND ri.role = 'essence' WHERE rp.ressource_id = ? AND r.genre = 'alchimie'
          ORDER BY r.variante, r.id, ri.rang, ri.option LIMIT 1`).get(x.id)?.affinite_id ?? null;
        assert.equal(x.essence, essence, `${x.id} : l'essence de sa recette`);
        assert.deepEqual(x.couleur, couleurDePotion({ page: p.id, essence, caracteristique: p.caracteristique, niveau: x.niveau_rang }), x.id);
      }
      const dePhiltres = p.potions.every((x) => x.essence === AFFINITE_DES_PHILTRES);
      if (!dePhiltres) assert.equal(p.caracteristique, null, `${p.id} : pas une page de philtres, pas de caractéristique`);
      else {
        const nommees = new Set(p.potions.map((x) => caracteristiqueDesCompetences(x.effet, caracteristiques)).filter(Boolean));
        assert.equal(p.caracteristique, nommees.size === 1 ? [...nommees][0] : null, `${p.id} : la caractéristique que nomment ses effets`);
      }
    }
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

test('rendu : l’ancre du tableau d’une page de potions, unique par page (un tableau par page, côte à côte : demande du propriétaire, 2026-10-17)', () => {
  assert.equal(ancreDePotions('ressources/fiole-rouge'), 'potions-fiole-rouge');
  assert.equal(ancreDePotions('ressources/philtre-de-l-escamoteur'), 'potions-philtre-de-l-escamoteur');
  const pages = objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages.map((p) => ancreDePotions(p.id)));
  assert.ok(pages.length > 40);
  assert.equal(new Set(pages).size, pages.length, 'une ancre par page');
  for (const a of pages) assert.match(a, /^potions-[a-z0-9-]+$/);
});

test('rendu : lignes d’un effet sans leur puce, échappées ; monnaies en icônes ; plus de texte de recherche', () => {
  assert.equal(htmlDeLignes('- Redonne 15 santé\n- 1 croix à la perception pendant 2 tours'), 'Redonne 15 santé<br>1 croix à la perception pendant 2 tours');
  assert.equal(htmlDeLignes('ampli am = +1 am <donné>'), 'ampli am = +1 am &lt;donné&gt;');
  assert.match(htmlDeLignes(''), /class="vide"/);
  const p = tableau('fiole').pages[0].potions[0];
  const html = htmlDeLigneDePotion(p);
  assert.ok(html.includes(`id="${ancreDObjet(p.id)}"`));
  assert.match(html, /class="piece piece--/, 'le prix en icônes (R63)');
  assert.ok(!html.includes('data-recherche'), 'plus de recherche (demande du propriétaire : des sous-onglets à la place)');
  // les cases saisies portent leur champ du mode modification (site de dev ; demande du propriétaire, 2026-10-17) : nom et prix (la ressource), niveau
  // et effet (la ligne de potion) ; le niveau s'écrit par son nom
  const ed = (table, cle, colonne) => echapper(attributEd(table, cle, colonne));
  assert.ok(html.includes(`<th scope="row" class="ceint-nom" data-ed="${ed('ressource', { id: p.id }, 'nom')}">${echapper(p.nom)}</th>`));
  assert.ok(html.includes(`<td class="ceint-niveau" data-ed="${ed('potion', { ressource_id: p.id }, 'niveau_id')}" data-ed-rendu="potion-niveau">${echapper(p.niveau)}</td>`));
  assert.ok(html.includes(`<td class="ceint-prix" data-ed="${ed('ressource', { id: p.id }, 'prix_brut')}" data-ed-rendu="composant-prix">`));
  assert.ok(html.includes(`<td class="ceint-effet" data-ed="${ed('potion', { ressource_id: p.id }, 'effet')}" data-ed-rendu="potion-effet">${htmlDeLignes(p.effet)}</td>`));
});
