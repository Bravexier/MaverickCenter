// La page d'une notion créée sur le site de dev, dessinée sur la page 404 avant la refabrication (chantier 3 des mots-clés ; R309 (7)) : le gabarit
// de PageDuGuide.astro sans menu latéral, le fil « Accueil › Glossaire », le titre modifiable. Fonction pure (lib/page-de-notion-rendu.mjs) : le script
// qui la pose (scripts/edition/nouvelles.mjs) ne s'importe pas en test (ses feuilles `?raw`). Noms inventés.
//   node --test test/pages-de-notion-site-de-dev.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { CORPS_D_UNE_PAGE_DE_NOTION, morceauxDuChapitre, sansMarqueurs } from '../src/lib/guide.mjs';
import { DECOUVRIR, GLOSSAIRE, GUIDE_DU_MJ } from '../src/lib/livres.mjs';
import { htmlDeLaPageDeNotion, peutEtreUnePageDeNotion } from '../src/lib/page-de-notion-rendu.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';
import { echapperHtml } from '../src/lib/edition-rendu.mjs';

const ID = 'guide/zephyrion-notion';
const BASE = '/MaverickCenter/';
const html = (titre = 'Zephyrion') => htmlDeLaPageDeNotion({ id: ID, titre, base: BASE });

test('le titre est échappé, et modifiable (data-ed de page.titre)', () => {
  const rendu = html('Zéphyrion <b>"gras"</b> & Cie');
  assert.ok(!rendu.includes('<b>'), 'aucune balise du titre ne passe');
  assert.ok(rendu.includes('Zéphyrion &lt;b&gt;&quot;gras&quot;&lt;/b&gt; &amp; Cie'));
  assert.ok(rendu.includes(`data-ed="${echapperHtml(attributEd('page', { id: ID }, 'titre'))}"`));
  assert.ok(rendu.includes('id="guide-titre"'));
});

test('le fil d’Ariane mène à l’accueil puis au Glossaire (adresse préfixée)', () => {
  const rendu = html();
  assert.match(rendu, new RegExp(`<a href="${BASE}">Accueil</a> › <a href="${BASE}${GLOSSAIRE.chemin}">${GLOSSAIRE.titre}</a>`));
});

test('aucun menu latéral ni entrée de menu : une page de notion n’est dans aucun onglet', () => {
  const rendu = html();
  assert.ok(!rendu.includes('data-ed-menu'));
  assert.ok(!rendu.includes('lateral'));
  assert.ok(!rendu.includes('<nav'));
});

test('le corps porte data-ed-corps (l’id de la page) et data-ed-notion, sans morceau de texte à modifier', () => {
  const rendu = html();
  assert.ok(rendu.includes(`data-ed-corps="${ID}"`));
  assert.match(rendu, /<div class="guide-corps"[^>]* data-ed-notion/);
  assert.ok(!rendu.includes('data-ed-morceau'), 'le texte de la page est le seul bloc calculé : rien à écrire ici');
});

test('le bandeau « Page créée sur le site de dev » et la ligne qui dit que le contenu est calculé à la fabrication du site', () => {
  const rendu = html();
  assert.match(rendu, /<p class="banner" role="note">Page créée sur le site de dev/);
  assert.match(rendu, /calcul[ée]+ à la fabrication du site/);
});

test('le corps d’une page de notion ne donne aucun texte à l’index de recherche (lib/recherche-index.ts)', () => {
  assert.equal(sansMarqueurs(CORPS_D_UNE_PAGE_DE_NOTION).trim(), '');
  assert.deepEqual(morceauxDuChapitre(CORPS_D_UNE_PAGE_DE_NOTION), [{ bloc: 'notion' }]);
});

test('sur la page 404, seule une page guide/<slug> hors de Découvrir et du Guide du MJ peut être dessinée en page de notion', () => {
  assert.equal(peutEtreUnePageDeNotion(ID), true);
  assert.equal(peutEtreUnePageDeNotion(DECOUVRIR.groupes[0].pages[0]), false, 'une page de Découvrir');
  assert.equal(peutEtreUnePageDeNotion(GUIDE_DU_MJ.pages[0]), false, 'une page du Guide du MJ');
  assert.equal(peutEtreUnePageDeNotion('races/zephyrion'), false, 'pas une page du guide');
});

test('script de page : nouvelles.mjs dessine la page de notion avec ce module, et lui seul l’importe', () => {
  const scripts = ['nouvelles', 'guide', 'menus', 'editeur', 'extensions'].map((n) => [n, readFileSync(new URL(`../src/scripts/edition/${n}.mjs`, import.meta.url), 'utf8')]);
  const importeurs = scripts.filter(([, source]) => /from '\.\.\/\.\.\/lib\/page-de-notion-rendu\.mjs'/.test(source)).map(([n]) => n);
  assert.deepEqual(importeurs, ['nouvelles']);
});
