// Guide du joueur CONSTRUIT (client/dist/guide/) : des chapitres lus dans l'ordre (lib/guide.mjs), une flèche de chaque côté (grisée au bord), le glissement du doigt, la pagination
// par partie colorée avec le titre de chaque chapitre en infobulle, et les tableaux tirés de la base (demande du propriétaire).
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/guide-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'guide', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (chemin) => {
  const html = readFileSync(join(dist, chemin, 'index.html'), 'utf8');
  return { html, main: html.slice(html.indexOf('<main'), html.indexOf('</main>')), ids: [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]) };
};
const accueil = present ? lire('guide') : { html: '', main: '', ids: [] };
const numeros = (main) => [...main.matchAll(/class="guide-pagination__numero" href="([^"]+)"[^>]*?aria-label="Chapitre (\d+) : ([^"]+)"/g)].map((m) => ({ href: m[1], n: Number(m[2]), titre: m[3] }));

test('/guide/ est le premier chapitre : flèche gauche grisée, flèche droite vers le chapitre 2, pagination des 24 chapitres', options, () => {
  assert.match(accueil.main, /<h1 id="guide-titre"[^>]*>Bienvenue dans Maverick<\/h1>/);
  assert.match(accueil.main, /<span class="guide-fleche guide-fleche--precedent" role="link" aria-disabled="true"/);
  assert.match(accueil.main, /<a class="guide-fleche guide-fleche--suivant" href="\/guide\/le-jeu-de-role\/" rel="next"/);
  const pagination = numeros(accueil.main);
  assert.deepEqual(pagination.map((p) => p.n), Array.from({ length: 24 }, (_, i) => i + 1));
  assert.equal(pagination[0].href, '/guide/', 'le chapitre 1 est servi à /guide/');
  assert.ok(!existsSync(join(dist, 'guide', 'bienvenue')), 'pas de page /guide/bienvenue/');
  assert.match(accueil.main, /aria-current="page"[^>]*>\s*1\s*</);
});

test('chaque numéro a son titre en infobulle, et la pagination est rangée en cinq parties colorées', options, () => {
  for (const [, id] of accueil.main.matchAll(/class="guide-pagination__numero"[^>]*data-bulle="([^"]+)"/g)) {
    assert.ok(accueil.ids.includes(id), `infobulle ${id} absente`);
  }
  const parties = [...accueil.main.matchAll(/<li class="guide-pagination__partie" style="--couleur-partie: (#[0-9a-f]{6})"><span class="guide-pagination__titre">([^<]+)</g)].map((m) => m[2]);
  assert.deepEqual(parties, ['Découvrir', 'Créer son personnage', 'Jouer', 'Progresser', 'Pour aller plus loin']);
});

test('le dernier chapitre grise la flèche droite ; un chapitre du milieu a ses deux voisins', options, () => {
  const dernier = lire('guide/les-documents-des-regles');
  assert.match(dernier.main, /<span class="guide-fleche guide-fleche--suivant" role="link" aria-disabled="true"/);
  assert.match(dernier.main, /<a class="guide-fleche guide-fleche--precedent" href="\/guide\/lexique\/" rel="prev"/);
  const degats = lire('guide/les-degats');
  assert.match(degats.main, /rel="prev"[\s\S]*rel="next"/);
  assert.match(degats.main, /class="guide-partie">Jouer</);
});

test('sur écran tactile, glisser le doigt tourne la page, sans que le navigateur ajoute un retour dans l’historique', options, () => {
  const { main } = lire('guide/les-degats');
  for (const evenement of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) assert.match(main, new RegExp(`addEventListener\\('${evenement}', function \\(e?\\) \\{[\\s\\S]*?\\}, \\{ passive: true \\}\\)`), evenement);
  assert.match(main, /dx < 0 \? '\[data-guide-suivant\]' : '\[data-guide-precedent\]'/, 'vers la gauche : chapitre suivant ; vers la droite : précédent');
  assert.match(main, /closest\('input, textarea, select, \[contenteditable\], \.guide-defile'\)/, 'pas sur un tableau qui défile ni dans un champ');
  assert.match(main, /t\.clientX < 24 \|\| t\.clientX > window\.innerWidth - 24/, 'pas depuis le bord de l’écran (gestes du système)');
  assert.match(main, /html \{ overscroll-behavior-x: none; \}/, 'Chrome ne fait pas du même geste un retour arrière');
});

test('les tableaux viennent de la base : progression, postures, compétences, personnages fil rouge', options, () => {
  const niveaux = lire('guide/la-montee-de-niveau').main;
  assert.equal((niveaux.match(/<tr>\s*<th scope="row">\d+<\/th>/g) ?? []).length, 20);
  assert.match(niveaux, /460\s250/, 'XP du niveau 20 (espace fine insécable de toLocaleString)');
  const postures = lire('guide/les-postures').main;
  assert.equal((postures.match(/class="guide-posture__nom"/g) ?? []).length, 6);
  const competences = lire('guide/caracteristiques-et-competences').main;
  assert.equal((competences.match(/class="guide-competences__groupe"/g) ?? []).length, 6);
  const attributs = lire('guide/finaliser-son-personnage').main;
  assert.equal((attributs.match(/class="guide-fil-rouge__perso"/g) ?? []).length, 4);
  assert.match(attributs, /20 de la race \+ 9 de la classe \+ 10 de la magie = 39/, 'santé du guerrier orios');
  assert.doesNotMatch(lire('guide/creer-son-personnage').main, /à préciser/, 'les quatre magies innées sont connues');
});

test('un chapitre n’a ni fil d’Ariane, ni mots-clés, ni pages liées sous le texte', options, () => {
  const page = lire('guide/le-tour-de-jeu').main;
  assert.doesNotMatch(page, /Accueil<\/a> ›/);
  assert.doesNotMatch(page, /class="tags"/);
  assert.doesNotMatch(page, /Cette page mentionne|Mentionnée par/);
});
