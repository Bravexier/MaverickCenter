// Onglet Accessoires de la page /ressources/equipement/ construite (dist/ ; avant, la page /ressources/accessoires/ : test/equipement-html.test.mjs pour
// la page et ses onglets) : le générateur d'accessoire (demande du propriétaire) — pas de tableau Markdown, les règles en tête,
// un tableau par étape avec une case au dé, un tableau d'effets par propriété dans son onglet, la compétence en une ligne par compétence (bonus d'acquis
// au curseur), la monture, l'encart de l'accessoire créé ; les lignes d'effet et de monture dans la couleur de leur niveau ; pas de tableau des gemmes,
// une infobulle par gemme, la gemme dans la couleur de sa magie, une case à cocher par gemme au choix. Se saute sans dist/ (npm run build) ; la CI le
// lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bulleDeGemme, chargerAccessoires, cleDeRessource } from '../src/lib/accessoires-db.mjs';
import { cleDEffet, COULEURS_DES_NIVEAUX, gemmesAuChoix } from '../src/lib/accessoires-generateur.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { classeDeMagie, cssDeLaPalette } from '../src/lib/palette-css.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'equipement', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
// le panneau de l'onglet Accessoires, le dernier de la page (components/equipement/EquipementPage.astro)
const main = html.slice(html.indexOf('<section class="equipement-panneau" id="accessoires"'), html.indexOf('</main>'));
const a = present ? chargerAccessoires(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;

test('pas de tableau Markdown : le gabarit du générateur, avec les règles de l’onglet', options, () => {
  assert.ok(main.length > 1000, 'le panneau de l’onglet Accessoires');
  assert.match(main, /<div class="acc" data-accessoires>/);
  // le panneau de règles de l'onglet (migration 0056), en tête, déplié au départ comme avant, sans phrase au-dessus
  assert.match(main, /<div class="acc" data-accessoires><details class="preg" id="regles-accessoires" data-panneau-regles="accessoires" open>/);
  assert.ok(!main.includes('acc__chapo'), 'plus de chapeau');
  assert.equal((main.match(/<table>/g) ?? []).length, 0, 'aucun tableau rendu depuis le Markdown');
  assert.ok(!main.includes('Gemme précieuse'), 'pas de tableau des gemmes');
  assert.match(main, /data-acc-produit/, 'l’encart de l’accessoire créé');
  assert.match(main, /data-acc-tout-tirer/);
});

test('malédiction (décision R94) : l’aide du générateur dit la relance depuis l’étape 2, même emplacement, et la destruction à la seconde', options, () => {
  const aide = main.match(/<span class="acc-aide acc-aide--malediction">([^<]+)<\/span>/)?.[1] ?? '';
  assert.match(aide, /depuis l’étape 2/);
  assert.match(aide, /même emplacement/);
  assert.match(aide, /une seconde le détruit/);
  // le texte des règles (copie de la source) n'est pas réécrit (le script, lui : test/accessoires-script.test.mjs)
  assert.ok(main.includes('on relance les dés au début des étapes'), 'les règles de l’onglet, telles qu’écrites');
});

test('une case au dé par tableau des étapes : identité, propriété, chaque propriété à effets ; pas la monture', options, () => {
  const tables = (main.match(/<table class="table-donnees table-donnees--serree acc-table/g) ?? []).length;
  const des = [...main.matchAll(/<button type="button" class="acc-de js-seul" data-de="(\d+)"(?: data-de-bonus="(\d+)")?/g)];
  assert.equal(tables, 2 + a.proprietes.filter((p) => p.effets.length).length + 1);
  // pas de dé sur la Monture (« Pas de random à faire sur la table des Montures »)
  assert.equal(des.length, tables - 1);
  const monture = main.slice(main.indexOf('data-table="monture"'), main.indexOf('</section>', main.indexOf('data-table="monture"')));
  assert.ok(!monture.includes('data-de='), 'pas de dé sur la Monture');
  assert.deepEqual(des.map((d) => [d[1], d[2] ?? null]).slice(0, 2), [['4', null], ['100', null]]);
  assert.ok(des.some((d) => d[1] === '6' && d[2] === '20'), 'compétence : 1d6 puis 1d20');
});

test('une ligne à choisir par emplacement, propriété, effet (une par compétence) et monture ; effets et montures dans la couleur de leur niveau', options, () => {
  const choix = [...main.matchAll(/data-choix="(\w+)" data-valeur="([^"]+)"/g)];
  const compte = (s) => choix.filter((c) => c[1] === s).length;
  assert.equal(compte('emplacement'), a.emplacements.length);
  assert.equal(compte('propriete'), a.proprietes.length);
  const autres = a.proprietes.filter((p) => p.id !== 'competence').flatMap((p) => p.effets);
  assert.equal(compte('effet'), autres.length + a.competences.lignes.length);
  assert.equal(compte('monture'), a.montures.length);
  for (const e of autres) {
    const i = main.indexOf(`data-valeur="${cleDEffet(e.id)}"`);
    const debut = main.lastIndexOf('<t', i);
    const balise = main.slice(debut, main.indexOf('>', i));
    if (e.niveau) assert.ok(balise.includes(`--niv: ${COULEURS_DES_NIVEAUX[e.niveau]}`), e.id);
    else assert.ok(!balise.includes('--niv'), e.id);
  }
  for (const m of a.montures) assert.match(main, new RegExp(`style="--niv: ${COULEURS_DES_NIVEAUX[m.niveau]}" data-choix="monture" data-valeur="${m.niveau}"`));
});

test('gemmes : une infobulle par gemme, chaque mention dans la couleur de sa magie et reliée à son infobulle', options, () => {
  for (const g of a.gemmes) {
    const id = bulleDeGemme(g.id);
    assert.equal((main.match(new RegExp(` id="${id}"`, 'g')) ?? []).length, 1, id);
  }
  // la pastille et l'infobulle portent la classe de la magie (lib/palette-css.mjs), jamais une couleur en style
  const mentions = [...main.matchAll(/<span class="acc-gemme (couleur-magie-[a-z0-9-]+)" data-bulle="([^"]+)"/g)];
  assert.ok(mentions.length > 200);
  for (const [, classe, bulle] of mentions) {
    const g = a.gemmes.find((x) => bulleDeGemme(x.id) === bulle);
    assert.equal(classeDeMagie(g?.magie.nom), classe, bulle);
    assert.ok(cssDeLaPalette().includes(`.${classe}{`), `${classe} : une classe de la palette`);
  }
  assert.doesNotMatch(main, /class="acc-gemme[^"]*"[^>]*style=/, 'aucune pastille en style');
  for (const g of a.gemmes) assert.ok(main.includes(`<span class="bulle bulle--gemme ${classeDeMagie(g.magie.nom)}" role="tooltip" id="${bulleDeGemme(g.id)}" hidden`), `infobulle : ${g.nom}`);
  assert.doesNotMatch(main, /style="[^"]*--(?:g|g-texte|mag):/, 'ni --g ni --mag en style');
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('le script de la page n’importe que lib/accessoires-generateur.mjs et lib/monnaies.mjs (le prix calculé), qu’aucun autre script de page n’importe', () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/accessoires.mjs', import.meta.url)), ['../lib/accessoires-generateur.mjs', '../lib/monnaies.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/accessoires-generateur.mjs', import.meta.url)), [], 'module sans import');
  assert.deepEqual(imports(new URL('../src/lib/monnaies.mjs', import.meta.url)), [], 'module sans import');
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'accessoires.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /(accessoires-generateur|monnaies)\.mjs$/.test(m)), [], nom);
  }
});

const decoder = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('compétences : une ligne par compétence (« Compétence Force »), le bonus d’acquis au curseur, au dé ou saisi, qui donne le niveau, la couleur et le prix', options, () => {
  const debut = main.indexOf('<table class="table-donnees table-donnees--serree acc-table acc-table--competences">');
  const table = main.slice(debut, main.indexOf('</table>', debut));
  // une ligne : ses attributs (les valeurs ne contiennent pas de « " », échappé) et son contenu
  const lignes = table.split('<tr class="acc-ligne acc-effet acc-competence"').slice(1).map((t) => {
    const fin = t.indexOf('><td class="acc-jet">');
    const attributs = Object.fromEntries([...t.slice(0, fin).matchAll(/ ([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decoder(m[2])]));
    return { ...attributs, contenu: t.slice(fin, t.indexOf('</tr>')) };
  });
  assert.equal(lignes.length, a.competences.lignes.length, 'une ligne par compétence, et non plus une par niveau');
  assert.equal((table.match(/<tr class="acc-ligne/g) ?? []).length, a.competences.lignes.length);
  const min = Math.min(...a.competences.colonnes.map((c) => c.min));
  const max = Math.max(...a.competences.colonnes.map((c) => c.max));
  assert.deepEqual([min, max], [1, 20]);
  a.competences.lignes.forEach((l, i) => {
    const { style, 'data-valeur': valeur, 'data-jet': jet, 'data-acquis': acquis, 'data-libelle': libelle, 'data-niveaux': niveaux, contenu } = lignes[i];
    assert.equal(lignes[i]['data-choix'], 'effet');
    assert.equal(libelle, `Compétence ${l.caracteristique}`, 'la caractéristique dans le titre');
    assert.ok(contenu.includes(`>Compétence ${l.caracteristique}</button>`));
    assert.ok(!contenu.includes('acc-effet__sous'), 'plus de caractéristique sous le titre');
    // la ligne telle que construite : le plus petit bonus, son niveau, sa couleur, son prix
    assert.deepEqual([valeur, jet, acquis, style], [cleDEffet(l.effets[0].id), String(l.jet), String(min), `--niv: ${COULEURS_DES_NIVEAUX[l.effets[0].niveau]}`]);
    // les effets de ses niveaux : plages et prix écrits, couleur du niveau
    assert.deepEqual(JSON.parse(niveaux).map((n) => [n.valeur, n.niveau, n.min, n.max, n.prix, n.style]),
      l.effets.map((e) => [cleDEffet(e.id), e.niveau, e.bonus_min, e.bonus_max, e.prix_brut, `--niv: ${COULEURS_DES_NIVEAUX[e.niveau]}`]));
    assert.match(contenu, new RegExp(`<input type="range" class="acc-acquis__curseur" min="${min}" max="${max}" step="1" value="${min}" data-acc-acquis`));
    assert.match(contenu, new RegExp(`<input type="number" class="acc-acquis__saisie" min="${min}" max="${max}" step="1" value="${min}"`));
    assert.match(contenu, /data-acc-acquis-de="20"/, 'un dé (1d20) par ligne');
    // sans JavaScript : chaque plage écrite du bonus, son niveau et son prix écrit
    const plages = contenu.slice(contenu.indexOf('<ul class="acc-plages sans-js">'), contenu.indexOf('</ul>'));
    assert.deepEqual([...plages.matchAll(/<li>(\d+) % à (\d+) % : (Niveau \d)/g)].map((m) => [Number(m[1]), Number(m[2]), m[3]]),
      l.effets.map((e) => [e.bonus_min, e.bonus_max, e.niveau_brut]));
    assert.match(contenu, new RegExp(`aria-valuetext="${min} % : ${l.effets[0].niveau_brut}"`));
  });
});

test('effets : un onglet par propriété à effets, qui mène à son tableau ; plus de menus déroulants', options, () => {
  const proprietes = a.proprietes.filter((p) => p.effets.length);
  const onglets = [...main.matchAll(/<a class="onglet( is-active)?" id="onglet-effets-([^"]+)" href="#effets-([^"]+)" data-onglet-propriete="([^"]+)">/g)];
  assert.deepEqual(onglets.map((o) => [o[2], o[3], o[4]]), proprietes.map((p) => [p.id, p.id, p.id]));
  assert.deepEqual(onglets.map((o) => Boolean(o[1])), proprietes.map((_, i) => i === 0), 'le premier ouvert');
  for (const [i, p] of proprietes.entries()) assert.match(main, new RegExp(`<section class="tableau acc-famille${i === 0 ? ' is-active' : ''}" id="effets-${p.id}" data-propriete="${p.id}" data-table="effet"`));
  assert.ok(main.includes('data-onglets="Effets par propriété"'));
  assert.ok(!/<details class="acc-famille/.test(main), 'plus de <details>');
});

test('gemmes au choix : une case à cocher dans la ligne de l’effet, pour chaque gemme au choix', options, () => {
  const effets = a.proprietes.flatMap((p) => p.effets);
  const attendues = [];
  for (const p of a.proprietes) {
    const lignesDe = p.id === 'competence' ? a.competences.lignes.map((l) => ({ id: l.effets[0].id, gemmes: l.gemmes })) : p.effets;
    for (const e of lignesDe) {
      const { auChoix, max } = gemmesAuChoix(e.gemmes.map((r) => r.map((g) => cleDeRessource(g.id))));
      if (!max) continue;
      const i = main.indexOf(`data-valeur="${cleDEffet(e.id)}"`);
      const tr = main.slice(main.lastIndexOf('<tr', i), main.indexOf('</tr>', i));
      assert.ok(tr.includes(`data-au-choix="${max}"`), e.id);
      assert.deepEqual([...tr.matchAll(/data-acc-gemme="([^"]+)"/g)].map((m) => m[1]), auChoix, e.id);
      attendues.push(...auChoix);
    }
  }
  assert.ok(effets.some((e) => e.id.endsWith('competence:intelligence:1')), 'l’Intelligence de la compétence');
  // la ligne de l'Intelligence : ses quatre gemmes au choix, deux à cocher (« au moins deux » lu « deux », comme le 2026-10-14 : question posée au propriétaire)
  const i = main.indexOf('data-valeur="competence:intelligence:1"');
  const intelligence = main.slice(main.lastIndexOf('<tr', i), main.indexOf('</tr>', i));
  assert.equal((intelligence.match(/<input type="checkbox" class="js-seul" data-acc-gemme="/g) ?? []).length, 4);
  assert.ok(intelligence.includes('data-au-choix="2"'));
  assert.ok(intelligence.includes('role="group" aria-label="Gemmes au choix, 2 en tout"'));
  assert.ok(!/<label class="acc-gemme-choix"/.test(main), 'la case à côté de la gemme, pas autour');
  assert.equal((main.match(/data-acc-gemme="/g) ?? []).length, attendues.length, 'aucune autre case');
});
