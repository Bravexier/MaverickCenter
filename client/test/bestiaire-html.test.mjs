// Page /bestiaire/ construite (dist/) : deux onglets (monstres, créatures invoquées à part), un tableau filtrable chacun, une fiche sous chaque ligne,
// l'entrée du menu Codex. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerBestiaire } from '../src/lib/bestiaire-db.mjs';
import { cheminDeMonstre } from '../src/lib/bestiaire-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { echellesEcrites, objetDuButin } from '../src/lib/monstre-champs.mjs';

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
  for (const ancre of [...lignes(main), ...cases(main)]) assert.ok(connus.has(`carte-${ancre}`), `carte de ${ancre}`);
  // le nom d'un monstre mène à sa page (le script ouvre la carte à côté sur un grand écran) ; celui d'une créature invoquée, à sa carte dans la page
  const parAncre = new Map(monstres.lignes.map((l) => [l.ancre, l]));
  for (const ancre of lignes(main)) {
    const lien = new RegExp(`<a class="bligne__ouvrir" href="[^"#]*/${cheminDeMonstre(parAncre.get(ancre).id)}" aria-controls="carte-${ancre}"`);
    assert.match(main, lien, `lien vers la page de ${ancre}`);
  }
  for (const ancre of cases(main)) assert.ok(main.includes(`<a class="bligne__ouvrir" href="#carte-${ancre}" aria-controls="carte-${ancre}"`), `lien vers la carte de ${ancre}`);
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

test('glossaire du butin (demande du propriétaire : « retirer le glossaire du butin ») : plus de section, ses définitions en infobulles des cases de butin', options, () => {
  const db = ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' });
  const glossaire = db.prepare('SELECT id, nom, texte FROM monstre_butin_objet ORDER BY rang').all();
  assert.ok(!main.includes('glossaire-du-butin') && !main.includes('bglossaire'), 'plus de glossaire affiché');
  // une bulle par objet, écrite une fois hors des cartes, qui ne contient que des <span>/<strong> (une bulle se place dans un <p> ou une case)
  const bulles = main.slice(main.indexOf('<div class="bbulles-butin">'));
  for (const g of glossaire) {
    const m = bulles.match(new RegExp(`<span class="bulle" role="tooltip" id="bulle-butin-${g.id}" hidden>([\\s\\S]*?)</span></span>`));
    assert.ok(m, g.id);
    assert.doesNotMatch(m[1], /<(?!\/?(span|strong)\b)/, `${g.id} : seulement des éléments en ligne`);
  }
  assert.equal((main.match(/id="bulle-butin-/g) ?? []).length, glossaire.length);
  // chaque case qui cite un objet le montre : autant de boutons que de cases citantes, carte par carte ; chacun mène à une bulle de la page
  const ids = new Set([...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  const declencheurs = [...main.matchAll(/<button type="button" class="bobjet" data-bulle="([^"]+)" aria-describedby="\1">/g)].map((m) => m[1]);
  for (const d of declencheurs) assert.ok(ids.has(d), d);
  const { monstres } = chargerBestiaire(db);
  const attendus = monstres.lignes.reduce(
    (n, l) => n + l.espece.butin.flatMap((t) => [t.ennemi_simple, t.mini_boss, t.boss]).filter((t) => t && objetDuButin(t, glossaire, monstres.elements)).length,
    0,
  );
  assert.equal(declencheurs.length, attendus);
  assert.ok(attendus > 0, `${attendus} cases de butin à infobulle`);
});

test('curseur d’échelle (demande du propriétaire) : sur chaque carte à plusieurs échelles et sur elles seules ; la carte ne montre que l’échelle choisie', options, () => {
  const { monstres } = chargerBestiaire(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }));
  const bloc = panneau('monstres');
  for (const l of monstres.lignes) {
    const debut = bloc.indexOf(`<article class="bcarte" id="carte-${l.ancre}"`);
    const carte = bloc.slice(debut, bloc.indexOf('</article>', debut));
    const eps = l.carte ? echellesEcrites(l.carte.echelle) : [];
    const curseur = carte.match(/<input type="range" min="0" max="(\d+)" step="1" value="0" data-echelles="([^"]+)"/);
    if (eps.length < 2) assert.equal(curseur, null, l.id);
    else {
      assert.ok(curseur, l.id);
      assert.equal(Number(curseur[1]), eps.length - 1, l.id);
      assert.deepEqual(JSON.parse(curseur[2].replace(/&quot;/g, '"')), eps, l.id);
    }
  }
  // le choix : une valeur (data-eps) cachée quand elle n'est pas de l'échelle choisie (data-ep sur la carte), pour chaque échelle du doc ; à l'écran seulement
  const regle = html.match(/@media screen \{\s*((?::is\(\.bcarte, \.bregles\)\[data-ep="\d+"\] \[data-eps\]:not\(\[data-eps~="\d+"\]\),?\s*)+)\{ display: none; \}/);
  assert.ok(regle, 'une règle, à l’écran seulement');
  const selecteurs = [...regle[1].matchAll(/:is\(\.bcarte, \.bregles\)\S+ \S+/g)].map((m) => m[0].replace(/,$/, ''));
  assert.deepEqual(selecteurs, Array.from({ length: 10 }, (_, k) => `:is(.bcarte, .bregles)[data-ep="${k + 1}"] [data-eps]:not([data-eps~="${k + 1}"])`));
  // l'échelle choisie, la carte a l'apparence d'une carte à une seule échelle : ni étiquette « EP n », ni ligne vide entre les échelles (demande du
  // propriétaire : « certains champs se décalent en fonction de l'EP ») ; santé, chakra, barrière écrites à part : une ligne de trois tuiles
  assert.match(html, /@media screen \{\s*\.bcarte\[data-ep\] \.bep-ligne > \.bep, \.bcarte\[data-ep\] \.bep-ep \{ display: none; \}[^}]*\.bcarte\[data-ep\] \.bep-ligne--vide \{ display: none; \}/);
  assert.match(html, /\.btrio__cases \{ margin: 0; display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  const avecTrio = monstres.lignes.filter((l) => l.carte && /(^|,)sante,chakra,barriere(,|$)/.test(l.carte.rubriques.map((r) => r.rubrique).join(','))).length;
  assert.equal((bloc.match(/<div class="brubrique brubrique--attributs btrio">/g) ?? []).length, avecTrio);
  assert.ok(avecTrio > 0);
  assert.doesNotMatch(bloc, /<span class="bstat__nom">EP /, 'aucune tuile nommée par son échelle');
  // sans JavaScript, pas de curseur : toutes les valeurs restent affichées
  assert.match(html, /html\.js \.bestiaire \.bregles__curseur\.js-seul, html\.js \.bestiaire \.bechelle__curseur\.js-seul \{ display: flex; \}/);
});

test('défilement (demande du propriétaire) : une barre visible au tableau et à la carte ; la carte à la hauteur de la partie visible de sa vue', options, () => {
  assert.match(html, /\.btableau__defile, \.bcartes \{ scrollbar-gutter: stable; \}/);
  assert.match(html, /\.btableau__defile::-webkit-scrollbar-thumb, \.bcartes::-webkit-scrollbar-thumb \{[^}]*background: var\(--bes-line\)/);
  assert.match(html, /@supports not selector\(::-webkit-scrollbar\) \{\s*\.btableau__defile, \.bcartes \{ scrollbar-width: thin;/);
  assert.match(html, /max-height: var\(--bcartes-max, calc\(100dvh - 1\.5rem\)\)/);
  // une carte ouverte : sa vue fait au moins un écran (sinon, à côté d'un tableau court, la carte fixerait elle-même sa hauteur)
  assert.match(html, /html\.js \.bvue:has\(> \.bcartes\.est-ouverte\) \{ min-height: calc\(100vh - 1\.5rem\); min-height: calc\(100dvh - 1\.5rem\); \}/);
  // à l'impression, toutes les échelles et aucun curseur
  const impression = html.slice(html.indexOf('@media print {'));
  assert.match(impression, /\.bechelle__curseur, \.bregles__curseur \{ display: none !important; \}/);
});

test('règles des échelles de puissance (demande du propriétaire : « retravailler le visuel ») : règles générales, tableau des attributs et de l’expérience, règles par échelle au curseur', options, () => {
  const db = ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' });
  const regles = db.prepare('SELECT texte FROM monstre_regle ORDER BY rang').all();
  const echelles = db.prepare('SELECT * FROM monstre_echelle ORDER BY ep').all();
  const debut = main.indexOf('<details class="brepere" id="echelles">');
  const bloc = main.slice(debut, main.indexOf('</details>', debut));
  assert.ok(debut > 0 && bloc.includes('data-regles-ep'));
  const general = bloc.slice(bloc.indexOf('<div class="bregles__general">'), bloc.indexOf('</ul>', bloc.indexOf('<div class="bregles__general">')));
  const echappe = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  assert.deepEqual([...general.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]), regles.map((r) => echappe(r.texte)));
  // le tableau : une ligne par échelle, les valeurs typées de monstre_echelle
  for (const e of echelles) {
    const l = bloc.match(new RegExp(`<tr id="ep-${e.ep}">([\\s\\S]*?)</tr>`));
    assert.ok(l, `EP ${e.ep}`);
    const cellules = [...l[1].matchAll(/<td[^>]*>\s*([^<]*?)\s*<\/td>/g)].map((m) => m[1]);
    assert.deepEqual(cellules, [`${e.niveau_min}-${e.niveau_max}`, ...['attributs', 'xp'].flatMap((p) => ['ennemi_simple', 'mini_boss', 'boss'].map((k) => String(e[`${p}_${k}`] ?? '—')))], `EP ${e.ep}`);
  }
  // les règles par échelle : une par échelle, chaque paragraphe du tableau de l'introduction en ligne de liste, au texte identique
  const sansBalises = (t) => t.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  for (const e of echelles) {
    const a = bloc.indexOf(`<article class="bregle" id="regles-ep-${e.ep}" data-eps="${e.ep}"`);
    assert.ok(a > 0, `EP ${e.ep}`);
    const article = bloc.slice(a, bloc.indexOf('</article>', a));
    const lis = [...article.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => sansBalises(m[1]));
    const paragraphes = (t) => String(t ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    assert.deepEqual(lis, [...paragraphes(e.regle_brut), ...paragraphes(e.degats_brut)], `EP ${e.ep}`);
  }
  assert.match(bloc, new RegExp(`<p class="bregles__curseur js-seul">\\s*<label>\\s*<span>Échelle</span>\\s*<input type="range" min="${echelles[0].ep}" max="${echelles.at(-1).ep}" step="1" value="${echelles[0].ep}" data-regles-curseur>`));
});
