// La page de chaque monstre (pages/bestiaire/monstres/[...chemin].astro, components/bestiaire/PageMonstre.astro ; demande du propriétaire : « Sur mobile
// l'apparence ne va pas. Choisir une ligne fait apparaître le bloc sur toute la page. Impossible de revenir en arrière. Prévoir une page spécifique pour
// chaque monstre dans le cas où on ne peut pas faire apparaître le tableau et la tuile en même temps »). L'adresse (pure) se contrôle toujours ; les pages
// construites (dist/), après le build (la CI le lance après le build).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerBestiaire } from '../src/lib/bestiaire-db.mjs';
import { cheminDeMonstre, objetsDuButinDe } from '../src/lib/bestiaire-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';
import { echellesEcrites } from '../src/lib/monstre-champs.mjs';
import { idDeBulleDuButin } from '../src/lib/monstre-rendu.mjs';
import { ecartsDeLaDescription } from './aide-bestiaire.mjs';

const db = ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' });
const { monstres } = chargerBestiaire(db);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (chemin) => readFileSync(join(dist, chemin, 'index.html'), 'utf8');

test('adresse d’une page de monstre : tirée de l’identifiant figé, jamais du nom ; unique ; sans conflit avec une page du wiki « bestiaire/<slug>/ »', () => {
  assert.equal(cheminDeMonstre('monstres/loup-garou#carte:loup-garou-superieur'), 'bestiaire/monstres/loup-garou/loup-garou-superieur/');
  assert.equal(cheminDeMonstre('monstres/ottar-amoureux'), 'bestiaire/monstres/ottar-amoureux/', 'une espèce sans carte');
  for (const autre of ['bestiaire/zombi', 'monstres/Loup', 'monstres/a#carte:b#c', '', null, undefined]) assert.equal(cheminDeMonstre(autre), null, String(autre));
  const chemins = monstres.lignes.map((l) => cheminDeMonstre(l.id));
  assert.ok(chemins.every(Boolean), 'chaque ligne a son adresse');
  assert.equal(new Set(chemins).size, chemins.length, 'une adresse par ligne');
  // trois segments au moins : jamais l'adresse d'une page du wiki (bestiaire/<slug>/, les créatures invoquées), qu'une route [type]/[slug] construit ;
  // et aucune page du wiki n'occupe bestiaire/monstres/ elle-même
  assert.ok(chemins.every((c) => c.split('/').filter(Boolean).length >= 3));
  assert.equal(db.prepare("SELECT 1 FROM page WHERE id = 'bestiaire/monstres'").get(), undefined);
});

test('une page par ligne du tableau des monstres, et aucune autre', options, () => {
  const construites = [];
  const parcourir = (dossier) => {
    for (const nom of readdirSync(join(dist, dossier))) {
      if (!statSync(join(dist, dossier, nom)).isDirectory()) continue;
      const chemin = `${dossier}${nom}/`;
      if (existsSync(join(dist, chemin, 'index.html'))) construites.push(chemin);
      parcourir(chemin);
    }
  };
  assert.ok(!existsSync(join(dist, 'bestiaire', 'monstres', 'index.html')), 'pas de page à bestiaire/monstres/ elle-même');
  parcourir('bestiaire/monstres/');
  assert.deepEqual(construites.sort(), monstres.lignes.map((l) => cheminDeMonstre(l.id)).sort());
});

test('la page : la carte seule (le nom en titre, sans « Fermer »), le retour au tableau, les autres cartes de l’espèce, les bulles du butin qu’elle cite', options, () => {
  const scriptDuBestiaire = readFileSync(join(dist, 'bestiaire', 'index.html'), 'utf8').match(/<script type="module" src="([^"]*ScriptDuBestiaire[^"]*)"/)?.[1];
  assert.ok(scriptDuBestiaire, 'le script du bestiaire, posé par ScriptDuBestiaire.astro');
  for (const l of monstres.lignes) {
    const html = lire(cheminDeMonstre(l.id));
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    const id = `carte-${l.ancre}`;
    assert.match(main, new RegExp(`<article class="bcarte bcarte--seule" id="${id}" aria-labelledby="${id}-titre"`), l.id);
    assert.match(main, new RegExp(`<h1 id="${id}-titre"[^>]*>`), `${l.id} : le nom en titre`);
    assert.equal((main.match(/<h1[ >]/g) ?? []).length, 1, `${l.id} : un seul titre`);
    // sous le titre, des sections en h2 (pas de niveau sauté)
    assert.doesNotMatch(main, /<h[3-6][ >]/, `${l.id} : sections en h2`);
    assert.doesNotMatch(main, /bcarte__fermer/, `${l.id} : pas de « Fermer »`);
    // la description de la page (balise meta) : l'espèce, celle de son groupe s'il en a un (« Ottar », décision R64)
    const espece = l.espece.groupe?.nom ?? l.espece.nom;
    const meta = l.carte ? `${l.nom} (${espece}) : la carte du bestiaire.` : l.espece.groupe ? `${l.nom} (${espece}) : sans carte de combat, dans le bestiaire.` : `${l.nom} : l’espèce du bestiaire.`;
    assert.ok(html.includes(`<meta name="description" content="${meta.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"`), `${l.id} : ${meta}`);
    // la description dans l'en-tête, sous les tags, repliée
    assert.deepEqual(ecartsDeLaDescription(main.slice(main.indexOf(`<article class="bcarte bcarte--seule" id="${id}"`)), l, attributEd), [], `${l.id} : description`);
    assert.match(main, new RegExp(`<a href="[^"]*/bestiaire/#${l.ancre}" data-retour>`), `${l.id} : le retour à sa ligne du tableau`);
    // les autres cartes de l'espèce, chacune vers sa page
    const especeDe = (x) => (x.espece.groupe ? `groupe:${x.espece.groupe.id}` : `espece:${x.espece.id}`);
    const voisines = monstres.lignes.filter((x) => especeDe(x) === especeDe(l) && x.id !== l.id);
    for (const v of voisines) assert.match(main, new RegExp(`<a href="[^"#]*/${cheminDeMonstre(v.id)}">`), `${l.id} -> ${v.id}`);
    assert.equal(main.includes('bmonstre__voisines'), voisines.length > 0, l.id);
    // les bulles du butin : celles que cite la carte, chacune une fois, et toute case de butin y renvoie
    const bulles = [...main.matchAll(/<span class="bulle" role="tooltip" id="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(bulles, objetsDuButinDe(l, monstres.glossaire, monstres.elements).map((o) => idDeBulleDuButin(o.id)), l.id);
    for (const [, cible] of main.matchAll(/data-bulle="([^"]+)"/g)) assert.ok(bulles.includes(cible), `${l.id} : ${cible}`);
    // identifiants uniques, renvois résolus
    const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${l.id} : identifiants uniques`);
    for (const [, cible] of main.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g)) assert.ok(ids.includes(cible), `${l.id} : ${cible}`);
    // le curseur d'échelle d'une carte qui en écrit plusieurs ; le script du bestiaire (le même fichier que /bestiaire/)
    assert.equal(/data-echelles=/.test(main), Boolean(l.carte && echellesEcrites(l.carte.echelle).length >= 2), `${l.id} : curseur`);
    assert.ok(html.includes(`<script type="module" src="${scriptDuBestiaire}"`), `${l.id} : script du bestiaire`);
    assert.match(html, new RegExp(`<title>${l.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;').replace(/'/g, '&#39;')} — Bestiaire`), `${l.id} : titre de la page`);
  }
});

test('le script de la page (src/scripts/bestiaire.mjs) : sur petit écran, une ligne mène à la page ; le retour arrière referme une carte ouverte par-dessus la page', () => {
  const script = readFileSync(fileURLToPath(new URL('../src/scripts/bestiaire.mjs', import.meta.url)), 'utf8');
  // le seuil est celui de la feuille de style (la carte y passe par-dessus la page)
  assert.match(script, /const large = \(\) => !matchMedia\('\(max-width: 70rem\)'\)\.matches;/);
  assert.match(readFileSync(fileURLToPath(new URL('../src/styles/bestiaire/bestiaire.css', import.meta.url)), 'utf8'), /@media \(max-width: 70rem\) \{\n {2}\.bvue/);
  assert.match(script, /history\.pushState\(\{ bestiaire: c\.id \}, '', location\.href\)/, 'une entrée d’historique pour la carte par-dessus la page');
  assert.match(script, /addEventListener\('popstate'/);
  assert.match(script, /location\.assign\(/, 'la page du monstre');
  // « ‹ Bestiaire » : les serveurs envoient Referrer-Policy: no-referrer, la page ne lit donc jamais document.referrer (marque du tableau, sessionStorage)
  assert.doesNotMatch(script.replace(/\/\/.*$/gm, ''), /document\.referrer/);
  assert.match(script, /sessionStorage\.setItem\(RETOUR,/);
  // un clic modifié (Ctrl/Cmd…) sur le nom ouvre la page dans un autre onglet
  assert.match(script, /e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey \|\| e\.altKey\) return;/);
  // un seul script, par un seul composant (pas de module partagé entre deux scripts : version portable)
  const composants = ['Bestiaire.astro', 'PageMonstre.astro'].map((f) => readFileSync(fileURLToPath(new URL(`../src/components/bestiaire/${f}`, import.meta.url)), 'utf8'));
  for (const c of composants) {
    assert.match(c, /<ScriptDuBestiaire \/>/);
    assert.doesNotMatch(c, /<script>/);
  }
});
