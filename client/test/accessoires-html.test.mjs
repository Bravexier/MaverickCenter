// Page /ressources/accessoires/ construite (dist/) : le générateur d'accessoire (demande du propriétaire) — pas de tableau Markdown, les règles en tête,
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

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'accessoires', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const a = present ? chargerAccessoires(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;

test('pas de tableau Markdown : le gabarit du générateur, avec les règles de l’onglet', options, () => {
  assert.match(main, /<div class="acc" data-accessoires>/);
  assert.match(main, /<details class="acc-regles" open>/);
  assert.ok(main.includes('Les accessoires maudits'), 'les règles');
  assert.equal((main.match(/<table>/g) ?? []).length, 0, 'aucun tableau rendu depuis le Markdown');
  assert.ok(!main.includes('Gemme précieuse'), 'pas de tableau des gemmes');
  assert.match(main, /data-acc-produit/, 'l’encart de l’accessoire créé');
  assert.match(main, /data-acc-tout-tirer/);
});

test('une case au dé par tableau des étapes : identité, propriété, chaque propriété à effets ; pas la monture', options, () => {
  const tables = (main.match(/<table class="acc-table/g) ?? []).length;
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
  const mentions = [...main.matchAll(/<span class="acc-gemme" style="--g: (#[0-9a-f]{6}); --g-texte: #[0-9a-f]{6}" data-bulle="([^"]+)"/g)];
  assert.ok(mentions.length > 200);
  for (const [, couleur, bulle] of mentions) assert.equal(a.gemmes.find((g) => bulleDeGemme(g.id) === bulle)?.couleur, couleur, bulle);
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
  const debut = main.indexOf('<table class="acc-table acc-table--competences">');
  const table = main.slice(debut, main.indexOf('</table>', debut));
  // une ligne : ses attributs (les valeurs ne contiennent pas de « " », échappé) et son contenu
  const lignes = table.split('<tr class="acc-ligne acc-effet acc-competence"').slice(1).map((t) => {
    const fin = t.indexOf('><td class="acc-jet">');
    const attributs = Object.fromEntries([...t.slice(0, fin).matchAll(/ ([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decoder(m[2])]));
    return { ...attributs, contenu: t.slice(fin, t.indexOf('</tr>')) };
  });
  assert.equal(lignes.length, a.competences.lignes.length, 'une ligne par compétence, plus une par niveau');
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
    assert.match(contenu, /<span class="sans-js">1 % à 20 %<\/span>/, 'sans JavaScript : la plage du bonus');
  });
});

test('effets : un onglet par propriété à effets, qui mène à son tableau ; plus de menus déroulants', options, () => {
  const proprietes = a.proprietes.filter((p) => p.effets.length);
  const onglets = [...main.matchAll(/<a class="onglet( is-active)?" id="onglet-effets-([^"]+)" href="#effets-([^"]+)" data-onglet-propriete="([^"]+)">/g)];
  assert.deepEqual(onglets.map((o) => [o[2], o[3], o[4]]), proprietes.map((p) => [p.id, p.id, p.id]));
  assert.deepEqual(onglets.map((o) => Boolean(o[1])), proprietes.map((_, i) => i === 0), 'le premier ouvert');
  for (const [i, p] of proprietes.entries()) assert.match(main, new RegExp(`<section class="acc-famille${i === 0 ? ' is-active' : ''}" id="effets-${p.id}" data-propriete="${p.id}" data-table="effet"`));
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
  assert.equal((main.match(/data-acc-gemme="/g) ?? []).length, attendues.length, 'aucune autre case');
});
