// Onglet « Ceinture » de la page /ressources/equipement/ construite (dist/ ; demande du propriétaire, 2026-10-16 : « revoir intégralement la page des
// objets à la ceinture, renommer l'onglet en "Ceinture" et le mettre dans les onglets de équipement », des sous-onglets « plutôt que la recherche
// actuel », « dans l'ordre Consommable / Carquois / Bâton magiques », les consommables dans l'ordre fioles, remèdes, philtres, huiles, alchimie
// primitive, et les couleurs des tableaux des sources) : rendu depuis la base (lib/ceinture-db.mjs, vue v_objet_ceinture : décisions R81 et R82), trois
// sous-onglets et leurs panneaux dans l'ordre, les tableaux repliables de chacun, une ligne par objet sur la couleur de sa source, des liens qui mènent
// à des pages et des ancres qui existent, les monnaies en icônes (R63), les règles de la ceinture ; plus de recherche ni de page à part. Le tableau des
// bâtons (le troisième sous-onglet) : test/equipement-html.test.mjs. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FAMILLES_DE_LA_CEINTURE, ONGLET_DES_BATONS, chargerObjetsDeCeinture } from '../src/lib/ceinture-db.mjs';
import { ancreDObjet, couleursDeLaLigne } from '../src/lib/ceinture-rendu.mjs';
import { SOUS_ONGLETS_DE_LA_CEINTURE } from '../src/lib/equipement.mjs';
import { chargerBatons } from '../src/lib/batons-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

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
  // seul le panneau de règles du sous-onglet Bâtons magiques (migration 0055) se modifie sur le site de dev (src/scripts/edition/panneaux.mjs)
  const horsDuPanneauDeRegles = onglet.replace(/<details class="preg" [\s\S]*?<\/details>/g, '');
  assert.ok(!horsDuPanneauDeRegles.includes('data-edition') && !horsDuPanneauDeRegles.includes('data-ed='), 'pas encore modifiable sur le site de dev');
});

test('plus de recherche : ni champ, ni « Tout déplier », ni script de la ceinture (demande du propriétaire)', options, () => {
  assert.ok(!onglet.includes('type="search"') && !onglet.includes('data-ceinture-recherche') && !onglet.includes('data-recherche'));
  assert.ok(!onglet.includes('data-ceinture-tout') && !html.includes('[data-ceinture]'));
});

test('les tableaux, dans leur sous-onglet et dans l’ordre : fioles, remèdes, philtres, huiles, alchimie primitive ; carquois et sacs', options, () => {
  for (const o of SOUS_ONGLETS_DE_LA_CEINTURE.filter((x) => x.id !== ONGLET_DES_BATONS)) {
    const ids = [...panneau(o.id).matchAll(/<details class="ceint-tableau" id="([^"]+)" open>/g)].map((m) => m[1]);
    assert.deepEqual(ids, FAMILLES_DE_LA_CEINTURE.filter((f) => f.onglet === o.id).map((f) => `objets-${f.famille}`), o.id);
  }
  assert.deepEqual([...panneau('ceinture-consommables').matchAll(/<nav class="ceinture-sommaire"[^>]*>([\s\S]*?)<\/nav>/g)].flatMap((m) => [...m[1].matchAll(/href="#([^"]+)"/g)].map((x) => x[1])),
    FAMILLES_DE_LA_CEINTURE.filter((f) => f.onglet === 'ceinture-consommables').map((f) => `objets-${f.famille}`), 'le sommaire des consommables');
  assert.ok(!panneau(ONGLET_DES_BATONS).includes('class="ceint-tableau"'), 'les bâtons ont leur tableau (lib/batons-rendu.mjs)');
});

test('une ligne par objet de la vue (sauf les bâtons), aux ancres uniques ; le compte de chaque tableau et de chaque sous-onglet', options, () => {
  const lignes = [...onglet.matchAll(/<tr class="ceint-ligne[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  const attendues = [
    ...objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages.flatMap((p) => p.potions.map((x) => ancreDObjet(x.id)))),
    ...tableau('contenant').objets.map((r) => ancreDObjet(r.id)),
  ];
  assert.deepEqual(lignes, attendues);
  assert.equal(new Set(lignes).size, lignes.length, 'ancres uniques');
  for (const t of objets.tableaux) {
    // le compte du tableau, dans son <summary> (pas celui d'un tableau suivant)
    const debut = onglet.indexOf(`id="objets-${t.famille}"`);
    const resume = onglet.slice(debut, onglet.indexOf('</summary>', debut));
    assert.match(resume, new RegExp(`<span class="ceint-tableau__compte">${t.nombre} objets?</span>$`), `${t.famille} : ${t.nombre} objets`);
  }
  // le détail de chaque sous-onglet : le nombre de tableaux (s'il y en a plusieurs) et d'objets ; celui des bâtons, les magies et les bâtons
  const batons = chargerBatons(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }));
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  for (const o of SOUS_ONGLETS_DE_LA_CEINTURE) {
    const siens = objets.tableaux.filter((t) => t.onglet === o.id);
    const detail = o.id === ONGLET_DES_BATONS
      ? `${pluriel(batons.magies.length, 'magie')} · ${pluriel(batons.nombre, 'bâton')}`
      : `${siens.length > 1 ? `${siens.length} tableaux · ` : ''}${pluriel(siens.reduce((n, t) => n + t.nombre, 0), 'objet')}`;
    assert.match(onglet, new RegExp(`id="onglet-${o.id}" href="#${o.id}">\\s*<span class="onglet__nom">${o.nom}</span>\\s*<span class="onglet__detail">${detail}</span>`), `${o.id} : ${detail}`);
  }
});

test('chaque potion sur la couleur de son palier dans le Doc « Alchimie » ; les carquois et sacs sans couleur', options, () => {
  for (const p of objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages.flatMap((x) => x.potions))) {
    const c = couleursDeLaLigne(p.couleur);
    const debut = c
      ? `<tr class="ceint-ligne ceint-ligne--couleur" id="${ancreDObjet(p.id)}" style="--ceint-fond: ${c.fond}; --ceint-texte: ${c.texte}">`
      : `<tr class="ceint-ligne" id="${ancreDObjet(p.id)}">`;
    assert.ok(onglet.includes(debut), p.id);
  }
  assert.ok(objets.tableaux.flatMap((t) => t.pages ?? []).flatMap((x) => x.potions).filter((p) => p.couleur).length > 150, 'presque toutes colorées');
  assert.ok(!panneau('ceinture-carquois').includes('ceint-ligne--couleur'), 'le classeur ne colore pas les carquois');
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
  // les liens vers la page même (les tableaux du sommaire, les bombes de l'onglet Armes)
  const ancres = [...new Set([...onglet.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))];
  for (const a of ancres) assert.ok(main.includes(`id="${a}"`), `ancre absente de la page : #${a}`);
  assert.ok(ancres.includes('famille-bombes'), 'les bombes, dans l’onglet Armes');
  for (const p of objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages)) assert.ok(liens.includes(`/${p.id}/`), `la page ${p.id}`);
  assert.ok(liens.includes('/guide/l-equipement/') && liens.includes('/guide/fiche-accessoires-et-ceinture/'), 'les pages du guide');
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
