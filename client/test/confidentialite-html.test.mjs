// La page des règles de confidentialité (demande du propriétaire, 2026-11-21 : Google l'exige pour publier l'identifiant client du bouton « Exporter »
// de la fiche) : adresse stable /confidentialite/, lien discret au pied de chaque page (layouts/Base.astro), adresse de contact. Pas de prose figée :
// la route, le lien, le contact, et aucun script d'un autre site sur la page.
// Les tests du site construit ne tournent qu'après `npm run build` (la CI l'exécute juste après) et se sautent sinon.
//   node --test test/confidentialite-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CONTACT = 'contact@maverick-jdr.com';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'confidentialite', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (chemin) => readFileSync(join(dist, chemin, 'index.html'), 'utf8');
const lienDuPied = /<footer class="site-footer">[\s\S]*?<a class="site-footer__lien" href="\/confidentialite\/" data-confidentialite>[^<]+<\/a>[\s\S]*?<\/footer>/;

test('la page de confidentialité est une page du code, avec son adresse de contact', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/pages/confidentialite.astro', import.meta.url)), 'utf8');
  assert.ok(source.includes(`'${CONTACT}'`), 'l’adresse de contact');
});

test('/confidentialite/ : construite, un titre, le contact en lien mailto, aucun script ni feuille d’un autre site', options, () => {
  const html = lire('confidentialite');
  assert.match(html, /<h1>[^<]+<\/h1>/);
  assert.ok(html.includes(`<a href="mailto:${CONTACT}" data-contact>${CONTACT}</a>`), 'le contact');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc="https?:\/\//, 'aucun script d’un autre site');
  assert.doesNotMatch(html, /<link\b[^>]*\bhref="https?:\/\//, 'aucune feuille d’un autre site');
});

test('le pied de page mène à /confidentialite/ : accueil, fiche, page elle-même, maintenance', options, () => {
  for (const page of ['', 'fiche', 'confidentialite', 'maintenance']) assert.match(lire(page), lienDuPied, page || 'accueil');
});

// Date de dernière mise à jour : une constante du fichier de la page (MISE_A_JOUR), changée avec son texte, jamais la date du build. On n'en fige pas
// la valeur : une date réelle, pas dans le futur, rendue telle quelle dans un <time datetime>.
test('la page porte la date de son dernier changement : une date valide, pas dans le futur, rendue dans <time>', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/pages/confidentialite.astro', import.meta.url)), 'utf8');
  const date = source.match(/^const MISE_A_JOUR = '(\d{4}-\d{2}-\d{2})';$/m)?.[1];
  assert.ok(date, 'la constante MISE_A_JOUR');
  const jour = new Date(`${date}T00:00:00Z`);
  assert.equal(jour.toISOString().slice(0, 10), date, 'une date du calendrier');
  assert.ok(jour.getTime() <= Date.now(), 'pas dans le futur');
  if (present) assert.match(lire('confidentialite'), new RegExp(`<time datetime="${date}" data-mise-a-jour>[^<]+</time>`), 'rendue dans la page');
});
