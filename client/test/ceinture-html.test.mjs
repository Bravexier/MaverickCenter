// La page Ceinture construite, /ressources/objets-a-la-ceinture/ (dist/ ; une page à elle depuis le 2026-10-29, « Cinq pages séparées », à l'adresse de
// l'ancienne page « Objets à la ceinture » ; avant, l'onglet Ceinture de la page « Équipement » ; demande du propriétaire, 2026-10-16 : « revoir intégralement la page des
// objets à la ceinture, renommer l'onglet en "Ceinture" et le mettre dans les onglets de équipement », des sous-onglets « plutôt que la recherche
// actuel », « dans l'ordre Consommable / Carquois / Bâton magiques », les consommables dans l'ordre fioles, remèdes, philtres, huiles, alchimie
// primitive, et les couleurs des tableaux des sources ; le 2026-10-22 : un onglet par famille de consommables, et « Partout il faut utiliser Que les
// couleurs du site […] Aucune couleur en dur ») : rendu depuis la base (lib/ceinture-db.mjs, vue v_objet_ceinture : décisions R81 et R82), trois
// sous-onglets et leurs panneaux dans l'ordre, les onglets des familles de consommables, une ligne par objet sur la couleur de la règle du site, des liens qui mènent
// à des pages et des ancres qui existent, les monnaies en icônes (R63), les règles de la ceinture ; plus de recherche. Le tableau des
// bâtons (le troisième sous-onglet) : test/equipement-html.test.mjs. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FAMILLES_DE_LA_CEINTURE, ONGLET_DES_BATONS, chargerObjetsDeCeinture } from '../src/lib/ceinture-db.mjs';
import { ancreDObjet, ancreDePotions } from '../src/lib/ceinture-rendu.mjs';
import { CONTRASTE_MINIMAL, contraste, couleurDePotion, lisible, nuanceDuNiveau } from '../src/lib/alchimie-couleurs.mjs';
import { classeDePotion, couleursDeLaPalette } from '../src/lib/palette-css.mjs';
import { SOUS_ONGLETS_DE_LA_CEINTURE } from '../src/lib/equipement.mjs';
import { chargerBatons } from '../src/lib/batons-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'objets-a-la-ceinture', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const onglet = main.slice(main.indexOf('<section class="equipement-panneau ceinture" id="ceinture"'));
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
  // la page est à l'adresse de l'ancienne page « Objets à la ceinture » (identifiants figés), plus de page « Équipement » (test/equipement-html.test.mjs)
  assert.ok(!existsSync(join(dist, 'ressources', 'equipement')), 'pas de page /ressources/equipement/');
  assert.ok(html.includes('<a href="/ressources/objets-a-la-ceinture/" aria-current="page">Ceinture</a>'), 'son entrée du menu, courante');
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
  // deux groupes d'onglets imbriqués sur la page Ceinture (une page à elle depuis le 2026-10-29, plus d'onglets de page « Équipement ») : la ceinture,
  // ses consommables (components/Onglets.astro : chacun sa barre)
  assert.deepEqual([...main.matchAll(/data-onglets="([^"]+)"/g)].map((m) => m[1]).filter((n) => ['Équipement', 'Ceinture', 'Consommables'].includes(n)), ['Ceinture', 'Consommables']);
});

test('consommables : un tableau par page de potion, deux ou trois côte à côte (demande du propriétaire, 2026-10-17), sur le gabarit commun', options, () => {
  // « Les tableaux des fioles sont trop larrges Mettre de coté 2 ou 3 tableaux serai plus lisible »
  for (const t of objets.tableaux.filter((x) => x.pages)) {
    const groupe = famille(`objets-${t.famille}`);
    assert.ok(groupe.length > 0, `${t.famille} : son onglet`);
    assert.ok(groupe.includes('<div class="tableaux tableaux--cote-a-cote ceint-potions">'), `${t.famille} : côte à côte (la section porte le nom de la famille)`);
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
  const pluriel = (n, mot, x = 's') => `${n} ${mot}${n > 1 ? x : ''}`;
  for (const t of objets.tableaux) {
    if (t.pages) {
      // une famille de consommables : le détail de son onglet (ses tableaux, ses objets)
      assert.match(onglet, new RegExp(`id="onglet-objets-${t.famille}" href="#objets-${t.famille}">\\s*<span class="onglet__nom">${t.titre}</span>\\s*<span class="onglet__detail">${pluriel(t.pages.length, 'tableau', 'x')} · ${pluriel(t.nombre, 'objet')}</span>`), t.famille);
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

/** La surface et le texte des deux thèmes (styles/global/base.css : `:root`, `:root[data-theme="dark"]`). */
const THEMES = (() => {
  const base = readFileSync(fileURLToPath(new URL('../src/styles/global/base.css', import.meta.url)), 'utf8');
  const bloc = (sel) => base.slice(base.indexOf(`${sel} {`), base.indexOf('}', base.indexOf(`${sel} {`)));
  const jeton = (corps, nom) => corps.match(new RegExp(`\\n\\s*${nom}: (#[0-9a-f]{6});`))?.[1];
  return Object.fromEntries([['clair', ':root'], ['sombre', ':root[data-theme="dark"]']]
    .map(([theme, sel]) => [theme, { surface: jeton(bloc(sel), '--surface'), texte: jeton(bloc(sel), '--text') }]));
})();
/** `color-mix(in srgb, <couleur> <part>, <fond>)`, comme le navigateur le calcule. */
const melange = (couleur, fond, part) => {
  const canaux = (hex) => hex.slice(1).match(/../g).map((x) => parseInt(x, 16));
  const [c, f] = [canaux(couleur), canaux(fond)];
  return `#${c.map((v, i) => Math.round(v * part + f[i] * (1 - part)).toString(16).padStart(2, '0')).join('')}`;
};

/** Les règles des feuilles en ligne de la page : Map(classe → { propriété: valeur }) pour chaque `.classe{…}` d'une balise <style>. */
const reglesDeLaPage = () => new Map([...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].flatMap((m) => [...m[1].matchAll(/\.([a-z0-9-]+)\{([^{}]*)\}/g)])
  .map(([, classe, corps]) => [classe, Object.fromEntries(corps.split(';').filter(Boolean).map((d) => d.split(':')))]));

test('chaque potion sur la couleur de la règle du site (son essence, ou la caractéristique d’un philtre, au niveau de son palier) ; les carquois et sacs sans couleur', options, () => {
  const regles = reglesDeLaPage();
  for (const x of objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages)) for (const p of x.potions) {
    const c = couleurDePotion({ page: x.id, essence: p.essence, caracteristique: x.caracteristique, niveau: p.niveau_rang });
    // la ligne ne porte que la classe de sa combinaison (base et niveau : « Règle de calcul »), dont la page émet la valeur calculée par la règle
    const debut = c
      ? `<tr class="ceint-ligne ligne-couleur ${classeDePotion(c)}" id="${ancreDObjet(p.id)}">`
      : `<tr class="ceint-ligne" id="${ancreDObjet(p.id)}">`;
    assert.ok(onglet.includes(debut), p.id);
    if (c) {
      assert.deepEqual(regles.get(classeDePotion(c)), { '--ligne-fond': c.fond, '--ligne-texte': c.texte }, `${p.id} : la classe ${classeDePotion(c)}`);
      assert.ok(contraste(c.fond, c.texte) >= CONTRASTE_MINIMAL, p.id);
      // la ligne : le texte du thème sur le fond du thème teinté de la couleur (12 %, 20 % au survol : styles/global/tableaux.css), dans les deux thèmes
      for (const [theme, { surface, texte }] of Object.entries(THEMES)) {
        for (const part of [0.12, 0.2]) {
          const fond = melange(c.fond, surface, part);
          assert.ok(contraste(texte, fond) >= CONTRASTE_MINIMAL, `${p.id}, ${theme} à ${part * 100} % : ${texte} sur ${fond} = ${contraste(texte, fond).toFixed(2)}`);
        }
      }
    }
  }
  // plus aucune potion neutre : les deux pages d'essence Anti (sans couleur dans le Doc ni sur le site) ont la couleur que le propriétaire leur a
  // choisie, le Vide (2026-10-23 : « Le remède enragé est de la couleur du Vide » ; « L'huile rage devrai être couleur du Vide »)
  const neutres = objets.tableaux.flatMap((t) => t.pages ?? []).flatMap((x) => x.potions).filter((p) => !p.couleur);
  assert.deepEqual(neutres.map((p) => p.id), []);
  // les choix du propriétaire du 2026-10-23 dans la page construite : chaque ligne de ces cartes porte la classe de la magie nommée, à son niveau
  for (const [page, magie] of [['ressources/fiole-verte-fonce', 'necromancie'], ['ressources/remede-poison', 'necromancie'], ['ressources/huile-toxique', 'necromancie'],
    ['ressources/remede-enrage', 'vide'], ['ressources/huile-rage', 'vide'], ['ressources/remede-saignement', 'sang'], ['ressources/remede-brulure', 'feu'],
    ['ressources/huile-seraphine', 'feu'], ['ressources/huile-hemophile', 'sang']]) {
    const x = objets.tableaux.flatMap((t) => t.pages ?? []).find((y) => y.id === page) ?? assert.fail(`page absente : ${page}`);
    for (const p of x.potions) {
      assert.ok(onglet.includes(`<tr class="ceint-ligne ligne-couleur couleur-potion-magie-${magie}-n${p.niveau_rang}" id="${ancreDObjet(p.id)}">`), p.id);
    }
  }
  assert.ok(!onglet.includes('couleur-potion-attribut-barre4-'), 'plus de potion sur la couleur de l’attribut 4ᵉ barre');
  // le texte d'aide des consommables ne parle de lignes neutres que s'il y en a, et ne nomme alors que des pages dont toutes les lignes le sont
  const aide = (/<p class="ceinture-aide">([\s\S]*?)<\/p>/.exec(panneau('ceinture-consommables'))?.[1] ?? assert.fail('texte d’aide absent')).replace(/\s+/g, ' ');
  assert.equal(/neutre/i.test(aide), neutres.length > 0, `texte d’aide : ${aide}`);
  for (const p of objets.tableaux.flatMap((t) => t.pages ?? []).filter((y) => aide.includes(y.titre))) {
    assert.ok(!/neutre/i.test(aide) || p.potions.every((y) => !y.couleur), `${p.titre} : l’aide la dit neutre`);
  }
  assert.ok(!panneau('ceinture-carquois').includes('ligne-couleur'), 'le classeur ne colore pas les carquois');
});

test('aucune couleur en dur dans l’onglet : ni hex ni style de couleur ; chaque classe « couleur-… » posée existe dans une feuille de la page, avec la valeur de sa règle', options, () => {
  // demande du propriétaire du 2026-10-22 : « Aucune couleur en dur. » ; « Module JS → classe » : une page ne pose plus que la classe
  const lignes = [...onglet.matchAll(/<tr\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(lignes.length > 150);
  for (const l of lignes) assert.ok(!/\bstyle=/.test(l), `une ligne sans style : ${l}`);
  assert.deepEqual(onglet.match(/style="[^"]*(?:--ligne-|--baton-|--mag|--g\b|--g-texte|#[0-9a-f]{3,6})[^"]*"/gi) ?? [], [], 'aucun style de couleur dans l’onglet');
  const regles = reglesDeLaPage();
  const palette = new Map(couleursDeLaPalette().map((c) => [c.classe, c]));
  const posees = new Set([...onglet.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => c.startsWith('couleur-')));
  assert.ok(posees.size > 20, `${posees.size} classes de couleur`);
  for (const c of posees) {
    assert.ok(regles.has(c), `classe absente des feuilles de la page : ${c}`);
    if (palette.has(c)) assert.deepEqual(regles.get(c), { '--couleur': palette.get(c).fond, '--couleur-texte': palette.get(c).texte }, c);
  }
  // la page n'émet que les combinaisons de potions qu'elle affiche
  const emises = [...regles.keys()].filter((c) => c.startsWith('couleur-potion-'));
  assert.deepEqual(emises.filter((c) => !posees.has(c)), [], 'une combinaison émise mais pas affichée');
});

/** La base de déploiement (SITE_BASE, « / » par défaut), terminée par « / » : retirée d'un href pour retrouver le fichier dans dist/. */
const BASE = `${(process.env.SITE_BASE ?? '/').replace(/\/+$/, '')}/`;
const fichierDeDist = (href) => join(dist, href.startsWith(BASE) ? href.slice(BASE.length) : href.replace(/^\/+/, ''));
/** Toutes les feuilles de la page : ses balises <style> et ses feuilles liées. */
const feuillesDeLaPage = () => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
  .concat([...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((l) => /rel="stylesheet"/.test(l))
    .map((l) => /href="([^"]*)"/.exec(l)[1]).map((h) => {
      assert.ok(existsSync(fichierDeDist(h)), `feuille absente de dist/ : ${h}`);
      return readFileSync(fichierDeDist(h), 'utf8');
    }));
/** Les règles ({ selecteur, corps }) qui ne valent qu'en thème sombre : dans un `@media (prefers-color-scheme: dark)`, ou sous `[data-theme="dark"]`. */
const reglesDuThemeSombre = (css) => {
  const sombres = [];
  for (const m of css.matchAll(/@media[^{]*prefers-color-scheme:\s*dark[^{]*\{/g)) {
    let i = m.index + m[0].length;
    const debut = i;
    for (let profondeur = 1; profondeur && i < css.length; i++) profondeur += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
    sombres.push(...[...css.slice(debut, i - 1).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, c]) => ({ selecteur: s.trim(), corps: c })));
  }
  for (const [, s, c] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/\[data-theme=["']?dark/.test(s)) sombres.push({ selecteur: s.trim(), corps: c });
  return sombres;
};
/** Les déclarations d'un corps de règle : Map(propriété → valeur). */
const declarations = (corps) => new Map(corps.split(';').map((d) => d.split(':')).filter((d) => d.length > 1)
  .map(([p, ...v]) => [p.trim(), v.join(':').trim()]));

test('les cartes en Vide (Huile rage, Remède enragé) : leurs lignes dans le dégradé du blanc (liseré, teinte) au texte foncé de la classe, en thème sombre comme en clair', options, () => {
  // demande du propriétaire du 2026-10-23, après « Le remède enragé est de la couleur du Vide » et « L'huile rage devrai être couleur du Vide » :
  // « Dans le screen que je t'ai envoyé les lignes ne sont pas affiché blanches. (du moins pas dans le monde sombre) » ; puis, à « Faut-il un palier
  // visible entre Apprenti et Avancé ? » : « Dégradé visible » (lib/alchimie-couleurs.mjs#NUANCES_D_UNE_BASE_BLANCHE)
  const regles = reglesDeLaPage();
  const vide = couleursDeLaPalette().find((c) => c.classe === 'couleur-magie-vide') ?? assert.fail('classe couleur-magie-vide absente de la palette');
  for (const page of ['ressources/huile-rage', 'ressources/remede-enrage']) {
    const x = objets.tableaux.flatMap((t) => t.pages ?? []).find((y) => y.id === page) ?? assert.fail(`page absente : ${page}`);
    assert.ok(x.potions.length >= 3, page);
    const fonds = [];
    for (const p of x.potions) {
      const c = couleurDePotion({ page, niveau: p.niveau_rang });
      const classe = `couleur-potion-magie-vide-n${p.niveau_rang}`;
      assert.equal(classeDePotion(c), classe, p.id);
      assert.ok(onglet.includes(`<tr class="ceint-ligne ligne-couleur ${classe}" id="${ancreDObjet(p.id)}">`), `${p.id} : ligne sans la classe du Vide`);
      // la teinte de son palier : le blanc du Vide nuancé par la règle des nuances (tirée du module), rendu lisible
      assert.equal(c.fond, lisible(nuanceDuNiveau(vide.fond, p.niveau_rang)), `${p.id} : la nuance de son palier`);
      assert.deepEqual(regles.get(classe), { '--ligne-fond': c.fond, '--ligne-texte': c.texte }, `${p.id} : la valeur de ${classe}`);
      assert.ok(contraste(c.fond, c.texte) >= CONTRASTE_MINIMAL && contraste(c.texte, '#ffffff') > contraste(c.texte, '#000000'), `${p.id} : texte foncé lisible`);
      fonds.push(c.fond);
    }
    assert.equal(new Set(fonds).size, fonds.length, `${page} : chaque palier a sa teinte (${fonds.join(', ')})`);
  }
  // le thème sombre ne touche ni à la ligne colorée ni à ses couleurs, ni au fond ou au texte des cases d'un tableau ; depuis la demande du propriétaire
  // du 2026-10-29 (« Je ne veux plus de ligne entièrement colorées de la couleur de la magie ») la ligne n'est plus sur sa couleur : le fond du thème
  // teinté de la couleur de sa classe, le texte du thème, le liseré de la couleur (styles/global/tableaux.css, test/tableaux.test.mjs)
  const css = feuillesDeLaPage().join('\n');
  const ligne = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel]) => /tr\.ligne-couleur\s*>\s*\*\s*$/.test(sel.trim()))
    .map(([, , corps]) => declarations(corps)).find((d) => d.has('background'));
  assert.ok(ligne, 'la règle de la ligne colorée (tableaux.css)');
  assert.equal(ligne.get('background'), 'color-mix(in srgb, var(--ligne-fond) 12%, var(--surface))');
  assert.equal(ligne.get('color'), 'var(--text)');
  const sombres = reglesDuThemeSombre(css);
  assert.ok(sombres.length > 0, 'les règles du thème sombre sont lues');
  const touche = /ligne-couleur|--ligne-(?:fond|texte)|couleur-potion-|couleur-magie-|--couleur(?:-texte)?\s*:|ceint-|ceinture/;
  assert.deepEqual(sombres.filter((r) => touche.test(r.selecteur) || touche.test(r.corps)).map((r) => `${r.selecteur}{${r.corps}}`), [],
    'une règle du thème sombre change la couleur des lignes');
  // une règle sombre générique sur les cases (td, th, tr, tbody, table, « > * », .table-donnees, .tableau) qui en poserait le fond ou le texte
  const caseDeTableau = /(?:^|[\s>+~,(])(?:td|th|tr|tbody|thead|table)(?=$|[\s>+~,.:#[)])|>\s*\*|\.table-donnees(?![\w-])|\.tableau(?![\w-])/;
  const couleurPosee = (corps) => [...declarations(corps).keys()].some((p) => ['background', 'background-color', 'color'].includes(p));
  assert.deepEqual(sombres.filter((r) => caseDeTableau.test(r.selecteur) && couleurPosee(r.corps)).map((r) => `${r.selecteur}{${r.corps}}`), [],
    'une règle du thème sombre pose le fond ou le texte des cases d’un tableau');
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
  // les liens vers la page même (les onglets des familles) ; les bombes, sur la page Armes (une page à elle depuis le 2026-10-29)
  const ancres = [...new Set([...onglet.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))];
  for (const a of ancres) assert.ok(main.includes(`id="${a}"`), `ancre absente de la page : #${a}`);
  assert.ok(liens.includes('/ressources/armes/#famille-bombes') && !ancres.includes('famille-bombes'), 'les bombes, sur la page Armes');
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
