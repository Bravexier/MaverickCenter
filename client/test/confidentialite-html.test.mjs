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
import { CLE_DU_NIVEAU_VU } from '../src/lib/compte.mjs';

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

test('R319 : la page dit le stockage local du menu latéral, sous la clé que le script du menu écrit (jamais envoyée au serveur)', options, () => {
  const script = readFileSync(fileURLToPath(new URL('../src/components/MenuDuSite.astro', import.meta.url)), 'utf8');
  const cle = script.match(/var CLE = '([^']+)';/)[1];
  const source = readFileSync(fileURLToPath(new URL('../src/pages/confidentialite.astro', import.meta.url)), 'utf8');
  assert.ok(source.includes(`<code>${cle}</code>`), 'la clé du stockage local, telle que le script l’écrit');
  assert.match(lire('confidentialite'), new RegExp(`<code>${cle}</code>`), 'rendue dans la page');
  assert.ok(/localStorage/.test(source), 'le commentaire de tenue à jour de la page cite le stockage local');
});

test('R319 (1) : la page dit le stockage local du niveau choisi par un Créateur (« Voir le site en tant que… »), sous la clé que scripts/compte.mjs écrit (jamais envoyée au serveur)', () => {
  const script = readFileSync(fileURLToPath(new URL('../src/scripts/compte.mjs', import.meta.url)), 'utf8');
  assert.ok(/setItem\(CLE_DU_NIVEAU_VU,/.test(script), 'le script écrit sous la clé du module');
  const source = readFileSync(fileURLToPath(new URL('../src/pages/confidentialite.astro', import.meta.url)), 'utf8');
  assert.ok(source.includes(`<code>${CLE_DU_NIVEAU_VU}</code>`), 'la clé du stockage local, telle que le script l’écrit');
});

test('/confidentialite/ construite : la clé du niveau choisi est rendue dans la page', options, () => {
  assert.match(lire('confidentialite'), new RegExp(`<code>${CLE_DU_NIVEAU_VU}</code>`));
});
