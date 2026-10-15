// Le rendu d'une description de la chronologie dans le navigateur (lib/chronologie-rendu.mjs#htmlDuTexte, site de dev : un événement créé ou modifié
// depuis la construction) doit redonner, par l'éditeur en place (lib/markdown-edition.mjs#versMarkdown), le même Markdown que le rendu du build (remark,
// [[liens]] : lib/wikilinks.mjs) : sinon une retouche d'un mot réécrirait les liens du wiki ou les citations du reste de la description.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { fromHtml } from 'hast-util-from-html';
import { htmlDuTexte } from '../src/lib/chronologie-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { versMarkdown } from '../src/lib/markdown-edition.mjs';
import { buildIndex, remarkWikilinks, scanContent } from '../src/lib/wikilinks.mjs';

const dossier = fileURLToPath(new URL('../src/content/wiki/', import.meta.url));
const index = buildIndex(scanContent(dossier));
const processeur = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [[remarkWikilinks, { index, base: '/' }]] });
const rendre = async (md) => (await processeur.render(md, { frontmatter: { status: 'example' } })).code;
const kebab = (nom) => nom.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
/** hast → l'arbre simple de lib/markdown-edition.mjs (comme test/markdown-edition.test.mjs). */
function arbre(n) {
  if (n.type === 'text') return { type: 'texte', valeur: n.value };
  if (n.type !== 'element') return null;
  const attributs = {};
  for (const [nom, valeur] of Object.entries(n.properties ?? {})) {
    if (valeur === false || valeur === null || valeur === undefined) continue;
    attributs[nom === 'className' ? 'class' : /^data[A-Z]/.test(nom) ? kebab(nom) : nom.toLowerCase()] = Array.isArray(valeur) ? valeur.join(' ') : String(valeur);
  }
  return { type: 'element', nom: n.tagName, attributs, enfants: (n.children ?? []).map(arbre).filter(Boolean) };
}
const enfants = (html) => fromHtml(html, { fragment: true }).children.map(arbre).filter(Boolean);
// les guillemets et apostrophes typographiques du build (smartypants) ne sont qu'un rendu : comparés droits
const droits = (t) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

test('chaque description de la base : le rendu du navigateur redonne le même Markdown que celui du build (liens du wiki, citations, listes…)', async () => {
  const blocs = ouvrirBase().prepare('SELECT evenement_id, rang, texte FROM evenement_extrait ORDER BY evenement_id, rang').all();
  assert.ok(blocs.length > 100, `${blocs.length} descriptions`);
  const ecarts = [];
  for (const b of blocs) {
    const attendu = droits(versMarkdown(enfants(await rendre(b.texte))));
    const obtenu = droits(versMarkdown(enfants(htmlDuTexte(b.texte))));
    if (obtenu !== attendu) ecarts.push(`${b.evenement_id}#${b.rang}\n--- build ---\n${attendu}\n--- navigateur ---\n${obtenu}`);
  }
  assert.deepEqual(ecarts.slice(0, 3), [], `${ecarts.length} description(s) réécrite(s) autrement`);
});

test('le rendu du navigateur : [[liens]] (cible gardée telle qu’écrite), citations « > », listes, gras et italique', async () => {
  for (const md of [
    'Voir [[Humain]] et [[races/elfe|les elfes]].',
    '> *« Une citation. »*\n\nLa suite.',
    'Avant\n\n- un\n- deux\n\nAprès **gras** et *italique*.',
  ]) assert.equal(droits(versMarkdown(enfants(htmlDuTexte(md)))), droits(versMarkdown(enfants(await rendre(md)))), md);
});
