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
