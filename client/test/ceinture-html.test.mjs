// Onglet « Ceinture » de la page /ressources/equipement/ construite (dist/ ; demande du propriétaire, 2026-10-16 : « revoir intégralement la page des
// objets à la ceinture, renommer l'onglet en "Ceinture" et le mettre dans les onglets de équipement », des sous-onglets « plutôt que la recherche
// actuel », « dans l'ordre Consommable / Carquois / Bâton magiques », les consommables dans l'ordre fioles, remèdes, philtres, huiles, alchimie
// primitive, et les couleurs des tableaux des sources ; le 2026-10-22 : un onglet par famille de consommables, et « Partout il faut utiliser Que les
// couleurs du site […] Aucune couleur en dur ») : rendu depuis la base (lib/ceinture-db.mjs, vue v_objet_ceinture : décisions R81 et R82), trois
// sous-onglets et leurs panneaux dans l'ordre, les onglets des familles de consommables, une ligne par objet sur la couleur de la règle du site, des liens qui mènent
// à des pages et des ancres qui existent, les monnaies en icônes (R63), les règles de la ceinture ; plus de recherche ni de page à part. Le tableau des
// bâtons (le troisième sous-onglet) : test/equipement-html.test.mjs. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FAMILLES_DE_LA_CEINTURE, ONGLET_DES_BATONS, chargerObjetsDeCeinture } from '../src/lib/ceinture-db.mjs';
import { ancreDObjet, ancreDePotions, couleursDeLaLigne } from '../src/lib/ceinture-rendu.mjs';
import { couleurDePotion } from '../src/lib/alchimie-couleurs.mjs';
import { SOUS_ONGLETS_DE_LA_CEINTURE } from '../src/lib/equipement.mjs';
import { chargerBatons } from '../src/lib/batons-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'equipement', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const onglet = main.slice(main.indexOf('<section class="equipement-panneau ceinture" id="ceinture"'), main.indexOf('<section class="equipement-panneau" id="accessoires"'));
const objets = present ? chargerObjetsDeCeinture(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;
const tableau = (famille) => objets.tableaux.find((t) => t.famille === famille);
/** Le panneau d'un sous-onglet : de son <section> au suivant (ou à la fin de l'onglet). */
const panneau = (id) => {
  const debut = onglet.search(new RegExp(`<section class="ceinture-panneau[^"]*" id="${id}"`));
  const suivant = onglet.slice(debut + 1).search(/<section class="ceinture-panneau/);
  return debut < 0 ? '' : onglet.slice(debut, suivant < 0 ? onglet.length : debut + 1 + suivant);
};
/** Le panneau d'une famille de consommables (`objets-<famille>`) : de son <section> à la suivante (ou à la fin du sous-onglet Consommables). */
const famille = (id) => {
  const consommables = panneau('ceinture-consommables');
  const debut = consommables.search(new RegExp(`<section class="ceinture-famille[^"]*" id="${id}"`));
  const suivante = consommables.slice(debut + 1).search(/<section class="ceinture-famille/);
  return debut < 0 ? '' : consommables.slice(debut, suivante < 0 ? consommables.length : debut + 1 + suivante);
};
const CONSOMMABLES = FAMILLES_DE_LA_CEINTURE.filter((f) => f.onglet === 'ceinture-consommables');

test('l’onglet Ceinture : ses trois sous-onglets dans l’ordre, chacun un lien vers son panneau, le premier ouvert ; plus de page à part', options, () => {
  assert.ok(onglet.length > 10000, 'le panneau de l’onglet');
  const barre = onglet.slice(onglet.indexOf('<nav class="ceinture-onglets" aria-label="Ceinture" data-onglets="Ceinture">'), onglet.indexOf('</nav>', onglet.indexOf('class="ceinture-onglets"')));
  const onglets = [...barre.matchAll(/<a class="onglet( is-active)?" id="onglet-([a-z-]+)" href="#([a-z-]+)">\s*<span class="onglet__nom">([^<]+)<\/span>/g)];
  assert.deepEqual(onglets.map((m) => [m[2], m[3], m[4]]), SOUS_ONGLETS_DE_LA_CEINTURE.map((o) => [o.id, o.id, o.nom]));
  assert.deepEqual(onglets.map((m) => Boolean(m[1])), SOUS_ONGLETS_DE_LA_CEINTURE.map((o, i) => i === 0), 'seul le premier sous-onglet est ouvert');
  const panneaux = [...onglet.matchAll(/<section class="(ceinture-panneau[^"]*)" id="([a-z-]+)" aria-labelledby="titre-([a-z-]+)"/g)];
  assert.deepEqual(panneaux.map((m) => m[2]), SOUS_ONGLETS_DE_LA_CEINTURE.map((o) => o.id), 'un panneau par sous-onglet, dans l’ordre');
  for (const [, classes, id, titre] of panneaux) {
    assert.equal(titre, id);
    assert.equal(/\bis-active\b/.test(classes), id === SOUS_ONGLETS_DE_LA_CEINTURE[0].id, `${id} : ouvert au départ ou non`);
    assert.ok(onglet.includes(`<h3 class="ceinture-panneau__titre" id="titre-${id}">`), `${id} : son titre`);
  }
  // l'ancienne page n'est plus construite, ni dans le menu ; son adresse mène à l'onglet par la page 404 (test/equipement.test.mjs)
  assert.ok(!existsSync(join(dist, 'ressources', 'objets-a-la-ceinture')), 'pas de page /ressources/objets-a-la-ceinture/');
  assert.ok(!html.includes('ressources/objets-a-la-ceinture/'), 'aucun lien vers l’ancienne page');
});

test('mode modification (site de dev) : les quatre cases saisies de chaque potion, et rien d’autre de l’onglet hors du panneau de règles des bâtons', options, () => {
  // demande du propriétaire (2026-10-17) : « Les tableaux des consommables devrai pouvoir aussi être modifiées . (sauf pour les champ calculés) » : nom
  // et prix (la ressource), niveau et effet (la ligne de potion) ; en lecture, la couleur de la ligne, la valeur en RF, le titre et le résumé d'un groupe
  // (la page de la potion), les carquois et sacs (page « Composants ») et les bâtons ; le panneau de règles des bâtons : src/scripts/edition/panneaux.mjs
  const horsDuPanneauDeRegles = onglet.replace(/<details class="preg" [\s\S]*?<\/details>/g, '');
  assert.ok(!horsDuPanneauDeRegles.includes('data-edition'));
  const champs = [...horsDuPanneauDeRegles.matchAll(/<(t[hd]) [^>]*?class="(ceint-[a-z]+)" data-ed="([^"]+)"(?: data-ed-rendu="([^"]+)")?>/g)]
    .map((m) => [m[2], JSON.parse(m[3].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")), m[4] ?? 'texte']);
  assert.equal((horsDuPanneauDeRegles.match(/ data-ed=/g) ?? []).length, champs.length, 'chaque champ est une case d’une ligne de potion');
  const attendus = objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages.flatMap((x) => x.potions)).flatMap((p) => [
    ['ceint-nom', ['ressource', { id: p.id }, 'nom'], 'texte'],
    ['ceint-niveau', ['potion', { ressource_id: p.id }, 'niveau_id'], 'potion-niveau'],
    ['ceint-prix', ['ressource', { id: p.id }, 'prix_brut'], 'composant-prix'],
    ['ceint-effet', ['potion', { ressource_id: p.id }, 'effet'], 'potion-effet'],
  ]);
  assert.deepEqual(champs, attendus);
  assert.ok(!panneau('ceinture-carquois').includes(' data-ed='), 'les carquois et sacs se modifient dans « Composants »');
  assert.ok(!panneau(ONGLET_DES_BATONS).replace(/<details class="preg" [\s\S]*?<\/details>/g, '').includes(' data-ed='), 'le tableau des bâtons : en lecture');
  assert.ok(![...onglet.matchAll(/<tr class="ceint-groupe__titre">[\s\S]*?<\/tr>/g)].some((m) => m[0].includes('data-ed')), 'le titre et le résumé d’un groupe : en lecture');
});

test('plus de recherche : ni champ, ni « Tout déplier », ni script de la ceinture (demande du propriétaire)', options, () => {
  assert.ok(!onglet.includes('type="search"') && !onglet.includes('data-ceinture-recherche') && !onglet.includes('data-recherche'));
  assert.ok(!onglet.includes('data-ceinture-tout') && !html.includes('[data-ceinture]'));
});

test('consommables : un onglet par famille, dans l’ordre Fioles, Remèdes, Philtres, Huiles, Alchimie primitive, le premier ouvert ; carquois et sacs à part', options, () => {
  // demande du propriétaire (2026-10-22), à « Préférez-vous un second niveau d'onglets (Fioles / Remèdes / Philtres / Huiles / Alchimie primitive) ? » : « Oui »
  const consommables = panneau('ceinture-consommables');
  const barre = consommables.slice(consommables.indexOf('<nav class="ceinture-familles" aria-label="Consommables" data-onglets="Consommables">'), consommables.indexOf('</nav>'));
  assert.ok(barre.length > 0, 'la barre des familles, un groupe d’onglets à elle');
  const onglets = [...barre.matchAll(/<a class="onglet( is-active)?" id="onglet-([a-z-]+)" href="#([a-z-]+)">\s*<span class="onglet__nom">([^<]+)<\/span>/g)];
  assert.deepEqual(onglets.map((m) => [m[2], m[3], m[4]]), CONSOMMABLES.map((f) => [`objets-${f.famille}`, `objets-${f.famille}`, f.titre]));
  assert.deepEqual(onglets.map((m) => Boolean(m[1])), CONSOMMABLES.map((f, i) => i === 0), 'seule la première famille est ouverte');
  const panneaux = [...consommables.matchAll(/<section class="(ceinture-famille[^"]*)" id="([a-z-]+)" aria-labelledby="titre-([a-z-]+)">/g)];
  assert.deepEqual(panneaux.map((m) => m[2]), CONSOMMABLES.map((f) => `objets-${f.famille}`), 'un panneau par famille, dans l’ordre');
  for (const [, classes, id, titre] of panneaux) {
    assert.equal(titre, id);
    assert.equal(/\bis-active\b/.test(classes), id === `objets-${CONSOMMABLES[0].famille}`, `${id} : ouvert au départ ou non`);
    assert.ok(consommables.includes(`<h4 class="ceinture-famille__titre" id="titre-${id}">`), `${id} : son titre`);
  }
  assert.ok(!consommables.includes('ceinture-sommaire') && !consommables.includes('<details class="tableau ceint-tableau"'), 'plus de groupes repliables ni de sommaire');
  // les carquois et sacs : le tableau repliable de leur sous-onglet
  assert.deepEqual([...panneau('ceinture-carquois').matchAll(/<details class="tableau ceint-tableau" id="([^"]+)" open>/g)].map((m) => m[1]), ['objets-contenant']);
  assert.ok(!panneau(ONGLET_DES_BATONS).includes('ceint-tableau'), 'les bâtons ont leur tableau (lib/batons-rendu.mjs)');
  // trois groupes d'onglets imbriqués sur la page : la page, la ceinture, ses consommables (components/Onglets.astro : chacun sa barre)
  assert.deepEqual([...main.matchAll(/data-onglets="([^"]+)"/g)].map((m) => m[1]).filter((n) => ['Équipement', 'Ceinture', 'Consommables'].includes(n)), ['Équipement', 'Ceinture', 'Consommables']);
});

test('consommables : un tableau par page de potion, deux ou trois côte à côte (demande du propriétaire, 2026-10-17), sur le gabarit commun', options, () => {
  // « Les tableaux des fioles sont trop larrges Mettre de coté 2 ou 3 tableaux serai plus lisible »
  for (const t of objets.tableaux.filter((x) => x.pages)) {
    const groupe = famille(`objets-${t.famille}`);
    assert.ok(groupe.length > 0, `${t.famille} : son onglet`);
    assert.ok(groupe.includes(`<div class="tableaux tableaux--cote-a-cote ceint-potions" role="group" aria-labelledby="titre-objets-${t.famille}">`), `${t.famille} : côte à côte`);
    const cadres = [...groupe.matchAll(/<section class="tableau ceint-groupe" id="([^"]+)" aria-labelledby="([^"]+)">/g)];
    assert.deepEqual(cadres.map((m) => m[1]), t.pages.map((x) => ancreDePotions(x.id)), `${t.famille} : un tableau par page, dans l’ordre`);
    for (const [, id, titre] of cadres) assert.equal(titre, `${id}-titre`);
    for (const x of t.pages) {
      const id = ancreDePotions(x.id);
      const cadre = groupe.slice(groupe.indexOf(`id="${id}"`), groupe.indexOf('</section>', groupe.indexOf(`id="${id}"`)));
      // son titre (un lien vers la page de la potion), le nombre de ses paliers, puis la table du gabarit, ses quatre colonnes, ses lignes
      assert.match(cadre, new RegExp(`<h5 class="tableau__titre ceint-groupe__titre"><a class="tableau__nom ceint-groupe__nom" id="${id}-titre" href="/${x.id}/">`), id);
      assert.ok(cadre.includes(`<span class="tableau__compte ceint-groupe__compte">${x.potions.length} palier${x.potions.length > 1 ? 's' : ''}</span>`), id);
      assert.ok(cadre.includes(`<table class="table-donnees ceint-table ceint-table--potions" aria-labelledby="${id}-titre"><thead><tr><th scope="col">Nom</th><th scope="col">Niveau</th><th scope="col">Prix</th><th scope="col">Effet</th></tr></thead>`), id);
      assert.deepEqual([...cadre.matchAll(/<tr class="ceint-ligne[^"]*" id="([^"]+)"/g)].map((m) => m[1]), x.potions.map((q) => ancreDObjet(q.id)), id);
    }
  }
  // deux ou trois par rangée : la largeur minimale d'un tableau, dans la feuille de l'onglet (une grille « auto-fit » du gabarit)
  assert.match(html, /\.ceint-potions \{ --tableau-largeur: 30rem;/);
  assert.ok(!onglet.includes('ceint-groupe__resume') && !onglet.includes('scope="rowgroup"'), 'plus de groupes dans un seul tableau');
});

test('une ligne par objet de la vue (sauf les bâtons), aux ancres uniques ; le compte de chaque tableau et de chaque sous-onglet', options, () => {
  const lignes = [...onglet.matchAll(/<tr class="ceint-ligne[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  const attendues = [
    ...objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages.flatMap((p) => p.potions.map((x) => ancreDObjet(x.id)))),
    ...tableau('contenant').objets.map((r) => ancreDObjet(r.id)),
  ];
  assert.deepEqual(lignes, attendues);
  assert.equal(new Set(lignes).size, lignes.length, 'ancres uniques');
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  for (const t of objets.tableaux) {
    if (t.pages) {
      // une famille de consommables : le détail de son onglet (ses potions, ses paliers)
      assert.match(onglet, new RegExp(`id="onglet-objets-${t.famille}" href="#objets-${t.famille}">\\s*<span class="onglet__nom">${t.titre}</span>\\s*<span class="onglet__detail">${pluriel(t.pages.length, 'potion')} · ${pluriel(t.nombre, 'palier')}</span>`), t.famille);
      continue;
    }
    // le compte du tableau, dans son <summary> (pas celui d'un tableau suivant)
    const debut = onglet.indexOf(`id="objets-${t.famille}"`);
    const resume = onglet.slice(debut, onglet.indexOf('</summary>', debut));
    assert.match(resume, new RegExp(`<span class="tableau__compte ceint-tableau__compte">${t.nombre} objets?</span>$`), `${t.famille} : ${t.nombre} objets`);
  }
  // le détail de chaque sous-onglet : le nombre de familles (s'il y en a plusieurs) et d'objets ; celui des bâtons, les magies et les bâtons
  const batons = chargerBatons(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }));
  for (const o of SOUS_ONGLETS_DE_LA_CEINTURE) {
    const siens = objets.tableaux.filter((t) => t.onglet === o.id);
    const detail = o.id === ONGLET_DES_BATONS
      ? `${pluriel(batons.magies.length, 'magie')} · ${pluriel(batons.nombre, 'bâton')}`
      : `${siens.length > 1 ? `${siens.length} familles · ` : ''}${pluriel(siens.reduce((n, t) => n + t.nombre, 0), 'objet')}`;
    assert.match(onglet, new RegExp(`id="onglet-${o.id}" href="#${o.id}">\\s*<span class="onglet__nom">${o.nom}</span>\\s*<span class="onglet__detail">${detail}</span>`), `${o.id} : ${detail}`);
  }
});

test('chaque potion sur la couleur de la règle du site (son essence, ou la caractéristique d’un philtre, au niveau de son palier) ; les carquois et sacs sans couleur', options, () => {
  for (const x of objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages)) for (const p of x.potions) {
    const c = couleursDeLaLigne(couleurDePotion({ essence: p.essence, caracteristique: x.caracteristique, niveau: p.niveau_rang }));
    const debut = c
      ? `<tr class="ceint-ligne ligne-couleur" id="${ancreDObjet(p.id)}" style="--ligne-fond: ${c.fond}; --ligne-texte: ${c.texte}">`
      : `<tr class="ceint-ligne" id="${ancreDObjet(p.id)}">`;
    assert.ok(onglet.includes(debut), p.id);
  }
  // seules les potions d'essence Anti (sans couleur dans le Doc ni sur le site) restent neutres
  const neutres = objets.tableaux.flatMap((t) => t.pages ?? []).flatMap((x) => x.potions).filter((p) => !p.couleur);
  assert.deepEqual([...new Set(neutres.map((p) => p.essence))], ['anti']);
  assert.ok(!panneau('ceinture-carquois').includes('ligne-couleur'), 'le classeur ne colore pas les carquois');
});

test('les liens mènent à des pages construites et à des ancres qui existent (potions, Composants, Équipement, guide)', options, () => {
  const liens = [...new Set([...onglet.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))];
  assert.ok(liens.length > 50);
  const pages = new Map();
  for (const lien of liens) {
    const [chemin, ancre] = lien.split('#');
    const page = join(dist, decodeURI(chemin), 'index.html');
    assert.ok(existsSync(page), `page absente : ${lien}`);
    if (ancre) {
      if (!pages.has(page)) pages.set(page, readFileSync(page, 'utf8'));
      assert.ok(pages.get(page).includes(`id="${ancre}"`), `ancre absente : ${lien}`);
    }
  }
  // les liens vers la page même (les onglets des familles, les bombes de l'onglet Armes)
  const ancres = [...new Set([...onglet.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))];
  for (const a of ancres) assert.ok(main.includes(`id="${a}"`), `ancre absente de la page : #${a}`);
  assert.ok(ancres.includes('famille-bombes'), 'les bombes, dans l’onglet Armes');
  for (const p of objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages)) assert.ok(liens.includes(`/${p.id}/`), `la page ${p.id}`);
  assert.ok(liens.includes(`/${cheminDePage('guide/l-equipement')}`) && liens.includes(`/${cheminDePage('guide/fiche-accessoires-et-ceinture')}`), 'les pages du guide');
});

test('les prix et les textes écrivent les monnaies en icônes, jamais en abréviations (R63)', options, () => {
  const tableaux = panneau('ceinture-consommables') + panneau('ceinture-carquois');
  const texte = tableaux.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(texte, /\b\d[\d\s,.]*\s*(?:R[oOfF]|PP)\b/, 'pas de « 2 Ro » écrit');
  assert.ok((tableaux.match(/class="piece piece--/g) ?? []).length >= objets.tableaux.filter((t) => t.pages).reduce((n, t) => n + t.nombre, 0), 'un prix par potion');
});

test('les règles : la ceinture (guide, et le texte de la source en dépliable), repliées ; les titres des pages', options, () => {
  // les textes se modifient sur le site de dev (lib/ceinture-db.mjs les lit dans la base, ceinture-db.test.mjs les compare) : ici, leur place
  const regles = onglet.slice(onglet.indexOf('<details class="ceinture-regles">'), onglet.indexOf('class="ceinture-onglets"'));
  assert.ok(regles.length > 0 === Boolean(objets.regles.ceinture || objets.regles.reference), 'les règles, repliées');
  assert.equal(regles.includes('class="prose ceinture-regles__texte"'), Boolean(objets.regles.ceinture));
  assert.equal(/<details class="ceinture-regles__detail">[\s\S]*<\/details>/.test(regles), Boolean(objets.regles.reference), 'le texte de la source, en dépliable');
  for (const s of [objets.sources.chapitre, objets.sources.reference]) if (s) assert.ok(regles.includes(`>${s.titre.replace(/'/g, '&#39;')}</a>`) || regles.includes(`>${s.titre}</a>`), s.id);
});
