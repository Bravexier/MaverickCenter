// « Posé une fois par page » (skill ui-onglets ; décision R277, onglets écrits dans un texte) : le script en ligne des onglets (components/Onglets.astro) et leur feuille
// (components/SupportDuMarkdown.astro) ne sont écrits qu'une fois par page, qu'elle ait déjà ses onglets (l'équipement, les pages de classe) ou que plusieurs textes
// écrivent un groupe `::: onglets`. Les deux composants se partagent lib/pose-unique.mjs#poserUneFois sur `Astro.locals`, le même objet pour toute la page : le test
// éprouve la fonction (une page = un objet) et lit les composants, qui doivent la demander avant d'écrire.
//   node --test test/pose-unique.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { poserUneFois } from '../src/lib/pose-unique.mjs';

const lire = (chemin) => readFileSync(new URL(`../src/${chemin}`, import.meta.url), 'utf8');

test('poserUneFois : vrai la première fois pour une page, faux ensuite ; une autre page, ou une autre clé, repart de zéro', () => {
  const page = {};
  assert.equal(poserUneFois(page, 'onglets'), true);
  assert.equal(poserUneFois(page, 'onglets'), false);
  assert.equal(poserUneFois(page, 'onglets'), false);
  assert.equal(poserUneFois(page, 'feuille-des-onglets'), true);
  assert.equal(poserUneFois({}, 'onglets'), true, 'une autre page');
});

test('les composants n’écrivent le script en ligne et la feuille des onglets qu’après poserUneFois, même quand une page pose Onglets.astro elle-même', () => {
  const onglets = lire('components/Onglets.astro');
  assert.match(onglets, /import \{ poserUneFois \} from '\.\.\/lib\/pose-unique\.mjs'/);
  assert.match(onglets, /const premiere = poserUneFois\(Astro\.locals, 'onglets'\)/);
  assert.match(onglets, /\{premiere && <script is:inline>\s*document\.documentElement\.classList\.add\('js'\);\s*<\/script>\}/, 'le script en ligne de la classe js, une fois');
  assert.equal((onglets.match(/<script is:inline>/g) ?? []).length, 1, 'un seul script en ligne');
  const support = lire('components/SupportDuMarkdown.astro');
  assert.match(support, /poserUneFois\(Astro\.locals, 'feuille-des-onglets'\) && <style is:inline data-onglets-feuille/, 'la feuille, une fois');
  assert.match(support, /\{avecOnglets && <Onglets \/>\}/, 'le script passe par le composant partagé (qui se garde lui-même)');
  // les pages qui posent Onglets.astro elles-mêmes (equipement, classes, bestiaire…) restent comme elles sont : c'est le composant qui se garde
  assert.match(lire('components/equipement/EquipementPage.astro'), /<Onglets \/>/);
});
