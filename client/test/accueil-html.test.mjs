// L'accueil CONSTRUIT (client/dist/index.html) : sous la bienvenue et le carrousel, avant « Par où commencer ? », le serveur Discord, la page Tipeee (le
// texte de l'instantané) et l'encart « Notre prochaine rencontre IRL » (components/accueil/LiensEtRencontre.astro, lib/livres.mjs#LIENS_ET_RENCONTRE ;
// demandes du propriétaire du 2026-10-23 : « Ces 3 blocs auraient plus leur place dans l'onglet d'acceuil. », puis « Sous la bienvenue et le carrousel » ;
// avant, sous le texte de Bienvenue, et d'abord sur la page Liens). Leurs ancres sont figées : les liens écrits dans Bienvenue et Rejoindre une partie y
// mènent. Bienvenue ne les a plus : test/guide-html.test.mjs.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/accueil-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerAnnonce } from '../src/lib/annonces.mjs';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { LIENS_ET_RENCONTRE } from '../src/lib/livres.mjs';
import { CHEMIN_INSTANTANE, URL_PAGE } from '../src/lib/tipeee.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lireAccueil = () => {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  return { html, main: html.slice(html.indexOf('<main'), html.indexOf('</main>')) };
};
const sansStyles = (main) => main.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');

test('accueil : sous la bienvenue et le carrousel, avant « Par où commencer ? », Discord, Tipeee puis l’encart « Notre prochaine rencontre IRL »', options, () => {
  const { main } = lireAccueil();
  const corps = sansStyles(main);
  // l'ordre de la page : bienvenue et carrousel, Discord, Tipeee, l'encart, puis « Par où commencer ? »
  const places = ['<div class="accueil">', '<section class="carrousel"', '<div class="accueil-liens">', 'id="lien-discord"', 'id="lien-tipeee"',
    '<section class="annonce" id="prochaine-rencontre"', '<section class="accueil-debut"'].map((m) => [m, corps.indexOf(m)]);
  for (const [m, i] of places) assert.ok(i >= 0, `${m} absent de l’accueil`);
  assert.deepEqual(places.map(([m]) => m), [...places].sort((a, b) => a[1] - b[1]).map(([m]) => m), 'dans cet ordre');
  // les blocs ne sont pas dans le bloc de bienvenue (qui se met en deux colonnes à côté du carrousel) : après lui
  const finDeLaBienvenue = corps.indexOf('<div class="accueil-liens">');
  assert.equal(corps.slice(0, finDeLaBienvenue).match(/<div\b/g).length, corps.slice(0, finDeLaBienvenue).match(/<\/div>/g).length, 'hors de .accueil');
  // chaque lien sous son titre (h2, au niveau de l'encart), aux ancres figées de l'ancienne page Liens
  const sous = corps.slice(finDeLaBienvenue, corps.indexOf('<section class="accueil-debut"'));
  assert.deepEqual([...sous.matchAll(/<h2 class="accueil-liens__titre" id="lien-([a-z]+)-titre"><a class="accueil-liens__lien" href="([^"]+)" rel="noopener">([^<]+)<\/a><\/h2>/g)].map((m) => [m[1], m[2], m[3]]),
    LIENS_ET_RENCONTRE.liens.map((l) => [l.id, l.url, l.libelle]));
  assert.deepEqual(LIENS_ET_RENCONTRE.liens.map((l) => l.libelle), ['Serveur Discord « L’univers de Maverick »', 'Maverick JDR sur Tipeee']);
  const element = (id) => sous.match(new RegExp(`<section class="accueil-liens__element" id="lien-${id}" aria-labelledby="lien-${id}-titre">([\\s\\S]*?)</section>`))?.[1] ?? '';
  assert.match(element('discord'), /<div class="prose accueil-liens__presentation">/);
  assert.ok(element('discord').includes('« L’univers de Maverick » est le serveur Discord officiel du jeu'), 'la présentation du Discord, telle qu’écrite dans le plan');
  // Tipeee : les paragraphes de l'instantané livré avec le site (sources/tipeee/bienvenue.json), en texte seul, dans une citation que le script suit
  const instantane = JSON.parse(readFileSync(join(trouverRacine(), CHEMIN_INSTANTANE), 'utf8'));
  const citation = element('tipeee').match(/<blockquote class="prose accueil-liens__presentation accueil-tipeee" cite="([^"]+)" data-tipeee data-tipeee-api="([^"]+)" data-tipeee-lu-le="([^"]+)">([\s\S]*?)<\/blockquote>/);
  assert.ok(citation, 'la citation de Tipeee');
  assert.deepEqual(citation.slice(1, 4), [URL_PAGE, '/api/tipeee/', instantane.lu_le]);
  const paragraphes = [...citation[4].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  assert.deepEqual(paragraphes, instantane.paragraphes);
  assert.match(paragraphes[0], /^Bienvenue sur le Tipeee de MaverickJDR !/);
  assert.doesNotMatch(citation[4], /<(?!\/?p>)/, 'rien que des paragraphes de texte');
  // l'encart : le titre fixe, l'annonce de la base ou le texte d'attente ; la zone modifiable sur le site de dev
  assert.match(sous, /<section class="annonce" id="prochaine-rencontre" aria-labelledby="prochaine-rencontre-titre">\s*<h2 class="annonce__titre" id="prochaine-rencontre-titre">Notre prochaine rencontre IRL<\/h2>/);
  const zone = sous.match(/<div class="prose annonce__texte"([^>]*)>([\s\S]*?)<\/div>\s*<\/section>/);
  assert.ok(zone, 'la zone de l’annonce');
  assert.match(zone[1], /data-annonce="prochaine-rencontre-irl"/);
  assert.match(zone[1], /data-annonce-vide="Aucune rencontre annoncée pour le moment\."/);
  const annonce = chargerAnnonce(ouvrirBase({ sansExemples: false }), LIENS_ET_RENCONTRE.rencontre.annonce);
  if (annonce.texte) assert.doesNotMatch(zone[2], /annonce__vide/);
  else assert.equal(zone[2].trim(), '<p class="annonce__vide">Aucune rencontre annoncée pour le moment.</p>');
});

test('accueil : le script de Tipeee et le mode modification du site de dev (l’annonce), des ids uniques', options, () => {
  const { html, main } = lireAccueil();
  // le script qui reprend le texte du service (src/scripts/tipeee.mjs), un module de page mis en ligne, absent de la version portable (INLINE_CSS=1) :
  // reconnu à son contenu (il lit la citation `[data-tipeee]` et son `data-tipeee-api`), pas au seul module du carrousel
  const modules = [...html.matchAll(/<script type="module"(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)]
    .map(([, src, code]) => (src ? readFileSync(join(dist, src.replace(/^\//, '')), 'utf8') : code));
  assert.equal(modules.filter((code) => code.includes('[data-tipeee]') && code.includes('tipeeeApi')).length, 1, 'le script de Tipeee, une fois');
  // le mode modification se propose sur l'accueil (components/edition/Edition.astro, hors de <main>), sous l'id de LIENS_ET_RENCONTRE.page
  assert.match(html, new RegExp(`<div data-edition data-api="/api/" data-page="${LIENS_ET_RENCONTRE.page}"`));
  // aucun id de la page en double (les ancres des blocs à côté de celles de l'accueil et du carrousel)
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});
