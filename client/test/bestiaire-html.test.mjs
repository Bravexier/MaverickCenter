// Page /bestiaire/ construite (dist/) : deux onglets (monstres, créatures invoquées à part), un tableau filtrable chacun, une fiche sous chaque ligne,
// l'entrée du menu Codex. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerBestiaire } from '../src/lib/bestiaire-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'bestiaire', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const panneau = (id) => {
  const debut = main.indexOf(`<section class="bpanneau${id === 'monstres' ? ' is-active' : ''}" id="${id}"`);
  const fin = id === 'monstres' ? main.indexOf('<section class="bpanneau" id="invoquees"') : main.length;
  return main.slice(debut, fin);
};

test('deux onglets : les monstres (ouverts au départ) et, à part, les créatures invoquées', options, () => {
  assert.match(main, /<a class="onglet is-active" id="onglet-monstres" href="#monstres">/);
  assert.match(main, /<a class="onglet" id="onglet-invoquees" href="#invoquees">/);
  assert.match(main, /data-onglets="Catégories du bestiaire"/);
  assert.ok(panneau('monstres').length > 0 && panneau('invoquees').length > 0);
});

test('une case par monstre ou créature, chacune avec sa carte ; les identifiants sont uniques et les aria-controls mènent quelque part', options, () => {
  const { monstres, invocations } = chargerBestiaire(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }));
  // une case : la ligne d'un monstre, ou la case d'une créature invoquée dans la ligne de sa combinaison (ou de son NPM)
  const lignes = (bloc) => [...bloc.matchAll(/<tr class="bligne" id="([^"]+)" data-ligne/g)].map((m) => m[1]);
  const cases = (bloc) => [...bloc.matchAll(/<td class="bcase" id="([^"]+)" data-case data-carte="carte-\1"/g)].map((m) => m[1]);
  assert.deepEqual(lignes(panneau('monstres')), monstres.lignes.map((l) => l.ancre));
  assert.deepEqual(lignes(panneau('invoquees')), []);
  assert.deepEqual(cases(panneau('invoquees')), invocations.tableaux.flatMap((t) => t.lignes.flatMap((l) => l.cases.map((c) => c.ancre))));
  assert.deepEqual([...cases(panneau('invoquees'))].sort(), invocations.lignes.map((l) => l.ancre).sort(), 'chaque créature une fois');
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  const connus = new Set(ids);
  for (const [, cible] of main.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g)) assert.ok(connus.has(cible), cible);
  for (const ancre of [...lignes(main), ...cases(main)]) {
    assert.ok(connus.has(`carte-${ancre}`), `carte de ${ancre}`);
    assert.ok(main.includes(`<a class="bligne__ouvrir" href="#carte-${ancre}" aria-controls="carte-${ancre}"`), `lien vers la carte de ${ancre}`);
  }
  // liens internes vers une autre créature (même combinaison) : vers une ligne qui existe
  for (const [, cible] of main.matchAll(/href="#(invoquee-[^"]+)"/g)) assert.ok(connus.has(cible), cible);
});

test('filtres : formulaire caché sans JavaScript, une case par valeur, le préfixe « i- » pour les créatures invoquées', options, () => {
  for (const [id, facettes, prefixe] of [['monstres', ['espece', 'type', 'categorie', 'ep', 'lieu'], ''], ['invoquees', ['magie'], 'i-']]) {
    const bloc = panneau(id);
    assert.match(bloc, /<form class="bfiltres" role="search"[^>]*data-filtres hidden>/);
    assert.ok(bloc.includes(`data-prefixe="${prefixe}"`), id);
    assert.ok(bloc.includes(`data-facettes="${JSON.stringify(facettes).replace(/"/g, '&quot;')}"`), `${id} : filtres`);
    for (const f of facettes) assert.ok(bloc.includes(`<details class="bfacette" data-facette="${f}">`), `${id} : ${f}`);
    assert.ok((bloc.match(/<input type="checkbox" name="categorie" value="boss">/g) ?? []).length <= 1);
  }
  assert.match(panneau('monstres'), /<input type="checkbox" name="categorie" value="boss">/);
  assert.match(panneau('invoquees'), /<input type="checkbox" name="magie" value="feu">/);
});

test('tableau réduit (demande du propriétaire) : six colonnes pour les monstres ; la carte à côté, avec son portrait', options, () => {
  const entetes = (bloc) => [...bloc.slice(bloc.indexOf('<table class="btable">'), bloc.indexOf('</thead>', bloc.indexOf('<table class="btable">'))).matchAll(/<th scope="col"[^>]*>\s*([^<]+?)\s*<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes(panneau('monstres')), ['Espèce', 'Nom', 'Type', 'Catégorie', 'EP', 'Lieux']);
  // l'espèce d'abord, puis le nom, en-tête de ligne et lien vers la carte (une ligne de la base construite : le site de dev peut renommer une carte)
  const l = chargerBestiaire(ouvrirBase()).monstres.lignes.find((x) => x.carte);
  const html_ = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const re = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(panneau('monstres'), new RegExp(`<tr class="bligne" id="${re(l.ancre)}"[^>]*><td class="bligne__espece"[^>]*>${re(html_(l.espece.nom))}</td><th scope="row" class="bligne__nom"><a class="bligne__ouvrir"[^>]*>${re(html_(l.nom))}</a>`));
  assert.ok(panneau('monstres').includes(`data-tris="${JSON.stringify(['espece', 'nom', 'type', 'categorie', 'ep', 'lieu']).replace(/"/g, '&quot;')}"`));
  // moitié-moitié avec la carte (demande du propriétaire)
  assert.match(html, /\.bvue \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
  for (const id of ['monstres', 'invoquees']) {
    const bloc = panneau(id);
    assert.match(bloc, /<div class="bvue">[\s\S]*<aside class="bcartes" aria-label="[^"]+" data-cartes>/, `${id} : panneau des cartes à côté du tableau`);
    const cartes = (bloc.match(/<article class="bcarte" /g) ?? []).length;
    const cases = (bloc.match(/<tr class="bligne" /g) ?? []).length + (bloc.match(/<td class="bcase" /g) ?? []).length;
    assert.equal(cartes, cases, `${id} : une carte par case`);
    if (id === 'invoquees') {
      assert.equal((bloc.match(/<figure class="bcarte__portrait" data-vide>\s*<div class="bcarte__cadre"><img src="\/logo\.webp" alt=""/g) ?? []).length, cartes, 'invoquées : le logo en attendant un portrait');
    }
  }
});

test('créatures invoquées : trois tableaux dépliables (demande du propriétaire), golems et non-morts sur le même modèle — la combinaison, puis ses deux créatures côte à côte —, marionnettes par NPM (décision R53)', options, () => {
  const { invocations } = chargerBestiaire(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }));
  const bloc = panneau('invoquees');
  // un <details> par invocation, replié au départ, dans l'ordre du classeur ; son titre dit son effectif
  const replis = [...bloc.matchAll(/<details class="binvocation" id="tableau-([^"]+)" data-repli><summary><span class="binvocation__nom">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(replis, invocations.tableaux.map((t) => t.invocation.nomCle));
  assert.ok(!/<details class="binvocation"[^>]* open/.test(bloc), 'repliés au départ');
  for (const t of invocations.tableaux) {
    const debut = bloc.indexOf(`id="tableau-${t.invocation.nomCle}"`);
    const tableau = bloc.slice(debut, bloc.indexOf('</details>', debut));
    assert.ok(tableau.includes(`data-total="${t.creatures}"`), `${t.invocation.nom} : effectif`);
    const entetes = [...tableau.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]);
    assert.deepEqual(entetes, t.duo ? ['Magies', 'Créatures'] : ['NPM', 'Créature'], `${t.invocation.nom} : en-têtes`);
    if (t.duo) assert.ok(tableau.includes('<th scope="col" colspan="2">Créatures</th>'), 'les deux cases sous un seul en-tête (le classeur n’en a pas pour elles)');
    // une ligne par bloc : son en-tête (la combinaison, le mono d'abord ; ou le NPM de la marionnette), puis ses créatures, côte à côte
    const lignes = [...tableau.matchAll(/<tr class="bligne bligne--bloc" data-ligne[^>]*><th scope="row" class="bligne__bloc" title="([^"]*)">([\s\S]*?)<\/th>((?:<td class="bcase"[\s\S]*?<\/td>)+)<\/tr>/g)];
    assert.equal(lignes.length, t.lignes.length, `${t.invocation.nom} : une ligne par bloc`);
    lignes.forEach((m, k) => {
      const l = t.lignes[k];
      assert.equal(m[1], l.libelle.replace(/'/g, '&#39;'));
      assert.deepEqual([...m[3].matchAll(/<td class="bcase" id="([^"]+)"/g)].map((x) => x[1]), l.cases.map((c) => c.ancre), `${l.libelle} : ses créatures, côte à côte`);
      if (t.duo) assert.equal(m[2].includes('<span class="muted"> mono</span>'), l.mono, `${l.libelle} : mono`);
      else assert.equal(m[2], `NPM ${l.npm}`, `${l.libelle} : le NPM de la marionnette`);
    });
    if (t.duo) assert.ok(t.lignes[0].mono, `${t.invocation.nom} : le mono en premier`);
  }
  // dans une carte, « Même combinaison » nomme l'autre créature : hors du texte que cherche la recherche d'une case (src/scripts/bestiaire.mjs,
  // `data-hors-recherche`), sinon chercher une créature trouverait aussi sa voisine, qui ne serait pas estompée
  const combinaisons = [...bloc.matchAll(/<p([^>]*)>\s*<strong>Même combinaison :<\/strong>/g)];
  assert.equal(combinaisons.length, invocations.lignes.filter((l) => l.memeBloc.length).length);
  assert.ok(combinaisons.length > 0 && combinaisons.every((m) => /\sdata-hors-recherche\b/.test(m[1])), '« Même combinaison » hors de la recherche');
  // le NPM minimum et le qualificatif d'une capacité sont dans la carte
  for (const l of invocations.lignes) {
    const debut = bloc.indexOf(`id="carte-${l.ancre}"`);
    const carte = bloc.slice(debut, bloc.indexOf('</article>', debut));
    for (const k of l.capacites) {
      if (k.npm) assert.ok(carte.includes(`<span class="prefixe">NPM ${k.npm}</span>`), `${l.nom} : NPM de ${k.nom}`);
      if (k.etiquette) assert.ok(carte.replace(/&#39;/g, "'").includes(`<span class="prefixe">[${k.etiquette}]</span>`), `${l.nom} : [${k.etiquette}]`);
    }
  }
  // décision R53 : une créature invoquée n'a pas d'échelle de puissance ; nulle part « EP » dans l'onglet (tableaux, cartes : « Marionnette de l'ombre (NPM 3) »)
  // (le HTML brut : un attribut `title` s'affiche aussi, dans la bulle partagée de components/Infobulles.astro)
  assert.doesNotMatch(bloc, /\bEP\b/);
  const marionnettes = invocations.tableaux.find((t) => !t.duo);
  assert.ok(bloc.includes(`NPM 1 à ${marionnettes.lignes.length} · ${marionnettes.creatures} créatures`), 'le titre du tableau des marionnettes');
  // pas de tri (l'ordre du classeur) ; les cartes restent à côté
  assert.ok(bloc.includes('data-tris="[]"'));
  assert.ok(!/<th scope="col"[^>]* data-tri=/.test(bloc));
});

test('portraits des monstres (migration 0033) : un par carte, le logo en attendant une image, sinon le fichier publié par le build, cadré sans script', options, () => {
  // le site est la source de ce qu'il modifie : les portraits sont ceux de la base construite, quels qu'ils soient
  const db = ouvrirBase();
  const avecPortrait = chargerBestiaire(db).monstres.lignes.filter((l) => l.portrait);
  const bloc = panneau('monstres');
  const figures = [...bloc.matchAll(/<figure class="bcarte__portrait" data-portrait="([^"]*)"( data-vide)? data-ed-portrait="([^"]+)" data-logo="\/logo\.webp"><div class="bcarte__cadre"><img src="([^"]+)" alt="([^"]*)"( style="([^"]+)")?/g)];
  assert.equal(figures.length, (bloc.match(/<article class="bcarte" /g) ?? []).length, 'un portrait par carte, qui dit quelle ligne le porte');
  const images = figures.filter((f) => f[1]);
  assert.equal(images.length, avecPortrait.length);
  for (const f of figures.filter((x) => !x[1])) assert.ok(f[2] && f[4] === '/logo.webp' && f[5] === '', 'sans image : le logo, décoratif');
  for (const f of images) {
    assert.match(f[4], /^\/bestiaire\/portraits\/[0-9a-f]{16}\.(webp|jpg|png)$/);
    assert.ok(existsSync(join(dist, f[4])), `${f[4]} publié`);
    assert.ok(f[1].startsWith(`${f[4].split('/').pop().split('.')[0]}:`), 'data-portrait : l’empreinte du fichier montré, et son cadrage');
    assert.match(f[7], /^width:[\d.]+%;height:[\d.]+%;left:-?[\d.]+%;top:-?[\d.]+%$|object-fit:cover/);
    assert.ok(f[5].startsWith('Portrait : '));
  }
  // le cadre montre le carré cadré d'une image (lib/portrait.mjs#styleDuCadrage) : image en absolu dans un cadre carré qui coupe le reste
  assert.match(html, /\.bcarte__cadre \{ position: relative; width: 100%; aspect-ratio: 1; overflow: hidden;/);
});

test('sans JavaScript, une carte s’affiche par son lien (:target) ; le script de la page est un seul fichier sans import', options, () => {
  assert.match(html, /html:not\(\.js\) \.bcarte:target \{ display: block; \}/);
  // le mode modification du site de dev (components/edition/Edition.astro) charge son éditeur à part : il n'est pas dans la version portable
  const scripts = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]).filter((src) => !src.includes('Edition.astro'));
  assert.ok(scripts.length >= 1);
  for (const src of scripts) {
    const code = readFileSync(join(dist, src.replace(/^\//, '')), 'utf8');
    assert.ok(!/(^|[;}\n])\s*import[\s{*"']|\bimport\(/.test(code), `${src} importe un autre module (version portable)`);
  }
});

test('le menu Codex mène au bestiaire', options, () => {
  assert.match(html, /<a[^>]*href="\/bestiaire\/"[^>]*aria-current="page"[^>]*>Bestiaire<\/a>|<a[^>]*aria-current="page"[^>]*href="\/bestiaire\/"[^>]*>Bestiaire<\/a>/);
});
