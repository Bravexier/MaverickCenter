// Éditeur visuel du guide (lib/markdown-edition.mjs, couleur des cases : lib/markdown-couleurs.mjs) : le HTML d'une page, réécrit en Markdown, doit
// redonner le même rendu. Aller-retour Markdown → HTML → Markdown → HTML sur toutes les pages du guide et du Codex, avec les plugins du site ([[liens]], couleurs) ;
// puis les écritures propres à l'éditeur (liens, couleurs, échappements, listes, tableaux) et le découpage du corps aux blocs tirés de la base.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
// hast-util-from-html : dépendance de @astrojs/markdown-remark (le processeur Markdown du site), pour lire le HTML rendu comme le ferait le navigateur
import { fromHtml } from 'hast-util-from-html';
import { buildIndex, remarkWikilinks, scanContent, splitFrontmatter } from '../src/lib/wikilinks.mjs';
import { remarkCouleursDeCase } from '../src/lib/markdown-couleurs.mjs';
import { COULEURS_DE_CASE, decouperCorps, htmlSur, recomposerCorps, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { fragmentsAjoutes } from '../src/lib/markdown-sur.mjs';
import { texteDePageModifiable } from '../src/lib/edition-modele.mjs';

const dossier = fileURLToPath(new URL('../src/content/wiki/', import.meta.url));
const index = buildIndex(scanContent(dossier));
const processeur = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [[remarkWikilinks, { index, base: '/' }], remarkCouleursDeCase] });
// status « example » : pas d'avertissement pour un lien cassé (ce test ne contrôle pas les liens)
const rendre = async (md) => (await processeur.render(md, { frontmatter: { status: 'example' } })).code;

const kebab = (nom) => nom.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
/** hast (HTML analysé) → l'arbre simple de lib/markdown-edition.mjs, comme arbreDuDom le tire du DOM. */
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
const aller = async (md) => versMarkdown(enfants(await rendre(md)));
// les espaces entre balises ne changent pas le rendu
const normal = (html) => html.replace(/\s+/g, ' ').replace(/>\s+</g, '><').replace(/\s+</g, '<').replace(/>\s+/g, '>').trim();

// les pages dont le texte se modifie : le guide et le Codex (lib/edition-modele.mjs#texteDePageModifiable)
const pagesModifiables = ['guide', 'lore'].flatMap((type) =>
  readdirSync(join(dossier, type))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ type, id: `${type}/${f.slice(0, -3)}`, ...splitFrontmatter(readFileSync(join(dossier, type, f), 'utf8')) }))
    .filter((p) => texteDePageModifiable(type, p.data.sources?.[0]))
    .map((p) => ({ type: p.type, id: p.id, corps: p.body })),
);

test('aller-retour sur toutes les pages du guide et du Codex : le Markdown réécrit d’après le HTML redonne le même HTML', async () => {
  const effectif = (type) => pagesModifiables.filter((p) => p.type === type).length;
  assert.ok(effectif('guide') >= 60, `${effectif('guide')} pages du guide`);
  assert.ok(effectif('lore') >= 100, `${effectif('lore')} pages du Codex`);
  let morceaux = 0;
  for (const page of pagesModifiables) {
    for (const m of decouperCorps(page.corps)) {
      if (!m.visible) continue;
      morceaux++;
      const html = await rendre(m.texte);
      const md = versMarkdown(enfants(html));
      assert.equal(normal(await rendre(md)), normal(html), `${page.id} :\n${md}`);
      assert.equal(await aller(md), md, `${page.id} : le Markdown réécrit est stable`);
      // ni HTML brut ni lien non sûr ajouté : le service refuserait le texte (lib/markdown-sur.mjs)
      assert.deepEqual(fragmentsAjoutes(m.texte, md), [], `${page.id} : fragments ajoutés par l’éditeur`);
      // l'aperçu assaini garde tout ce que le Markdown dit
      assert.equal(versMarkdown(enfants(htmlSur(enfants(html)))), md, `${page.id} : aperçu assaini`);
    }
  }
  assert.ok(morceaux > pagesModifiables.length);
});

test('liens : [[cible]] et [[cible|texte]] (cible gardée telle qu’écrite), lien vers une page absente, lien Markdown et adresse nue', async () => {
  assert.equal(await aller('Voir [[Humain]] et [[races/elfe|les elfes]].'), 'Voir [[Humain]] et [[races/elfe|les elfes]].\n');
  assert.equal(await aller('Une [[Page qui n’existe pas]].'), 'Une [[Page qui n’existe pas]].\n');
  assert.equal(await aller('[Les races](/races/) et <https://example.org>'), '[Les races](/races/) et <https://example.org>\n');
  const md = versMarkdown(enfants('<p>Lien <a href="/MaverickCenter/races/">races</a></p>'), { lienRelatif: (h) => h.replace(/^\/MaverickCenter\//, '/') });
  assert.equal(md, 'Lien [races](/races/)\n');
  // un lien retiré par l'éditeur : il ne reste que son texte
  assert.equal(versMarkdown(enfants('<p>Voir <span>Humain</span>.</p>')), 'Voir Humain.\n');
});

test('couleur des cases : écrite « {couleur:x} » en tête de case, rendue data-couleur ; couleur inconnue ignorée', async () => {
  const md = '| A | B |\n| --- | --- |\n| {couleur:vert} un | deux |\n| {couleur:fuchsia} trois | {couleur:rouge} |\n';
  const html = await rendre(md);
  assert.match(html, /<td data-couleur="vert">un<\/td>/);
  assert.match(html, /<td>\{couleur:fuchsia\} trois<\/td>/);
  assert.match(html, /<td data-couleur="rouge"><\/td>/);
  assert.equal(versMarkdown(enfants(html)), '| A | B |\n| --- | --- |\n| {couleur:vert} un | deux |\n| {couleur:fuchsia} trois | {couleur:rouge} |\n');
  assert.equal(versMarkdown(enfants('<table><tr><th data-couleur="bleu">T</th></tr><tr><td data-couleur="noir">x</td></tr></table>')), '| {couleur:bleu} T |\n| --- |\n| x |\n');
  assert.deepEqual(COULEURS_DE_CASE, ['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'gris']);
});

test('ce qu’on écrit reste du texte : échappements (mise en forme, liens, balises, débuts de ligne, barre verticale d’une case)', async () => {
  const html = '<p>2 * 3 = 6, [lien](x), &lt;b&gt;, a_b</p><p># pas un titre</p><p>1. pas une liste</p><p>- non plus</p><table><tr><th>a | b</th></tr></table>';
  const md = versMarkdown(enfants(html));
  assert.equal(normal(await rendre(md)), normal('<p>2 * 3 = 6, [lien](x), &#x3C;b>, a_b</p><p># pas un titre</p><p>1. pas une liste</p><p>- non plus</p><table><thead><tr><th>a | b</th></tr></thead></table>'));
  // seule exception : « [[Page]] » tapé dans le texte devient un lien du wiki
  assert.equal(versMarkdown(enfants('<p>Voir [[Humain]] ou [[races/elfe|elfes]].</p>')), 'Voir [[Humain]] ou [[races/elfe|elfes]].\n');
});

test('mise en page tapée dans l’éditeur : titres, listes imbriquées, citation, gras, italique, barré, saut de ligne, ligne', async () => {
  const html = [
    '<h2>Titre</h2><div>Un texte <b>gras</b> et <i>penché</i>, <s>barré</s><br>à la ligne.</div>',
    '<ul><li>un<ul><li>sous</li></ul></li><li>deux</li></ul><ol start="3"><li>trois</li><li>quatre</li></ol>',
    '<blockquote><p>cité</p></blockquote><hr><h3>Fin</h3>',
  ].join('');
  const md = versMarkdown(enfants(html));
  assert.equal(md, '## Titre\n\nUn texte **gras** et *penché*, ~~barré~~<br>à la ligne.\n\n- un\n  - sous\n- deux\n\n3. trois\n4. quatre\n\n> cité\n\n---\n\n### Fin\n');
  assert.equal(await aller(md), md);
});

test('deux listes de même sorte qui se suivent restent deux listes : la seconde prend l’autre marque (« * », « 1) »)', async () => {
  const html = '<ul><li>a</li></ul><ul><li>b</li></ul><ul><li>c</li></ul><ol><li>un</li></ol><ol><li>deux</li></ol><p>fin</p><ul><li>d</li></ul>';
  const md = versMarkdown(enfants(html));
  assert.equal(md, '- a\n\n* b\n\n- c\n\n1. un\n\n1) deux\n\nfin\n\n- d\n');
  assert.equal(normal(await rendre(md)), normal(html));
  assert.equal(await aller(md), md);
});

test('corps découpé aux blocs tirés de la base : rien ne se perd, seuls les morceaux de texte visibles sont remplacés', () => {
  const corps = 'Intro.\n\n<!-- guide:niveaux -->\n\nSuite **grasse**.\n\n<!-- guide:postures -->\n';
  const morceaux = decouperCorps(corps);
  assert.equal(morceaux.map((m) => m.texte ?? m.marqueur).join(''), corps);
  assert.deepEqual(morceaux.filter((m) => m.marqueur).map((m) => m.bloc), ['niveaux', 'postures']);
  assert.deepEqual(morceaux.filter((m) => m.visible).map((m) => m.texte.trim()), ['Intro.', 'Suite **grasse**.']);
  assert.equal(recomposerCorps(corps, [null, 'Autre suite.\n']), 'Intro.\n\n<!-- guide:niveaux -->\n\nAutre suite.\n\n<!-- guide:postures -->\n');
  assert.equal(recomposerCorps(corps, []), corps);
  for (const page of pagesModifiables) assert.equal(recomposerCorps(page.corps, []), page.corps, page.id);
});

test('aperçu assaini : ni script, ni style, ni attribut d’événement, ni adresse « javascript: » ; liens, couleurs et mise en page gardés', () => {
  const sale = [
    '<p onclick="x()">Texte <script>alert(1)</script><b style="color:red">gras</b> <img src=x onerror="y()">',
    '<a href="javascript:alert(1)">piège</a> <a href="//ailleurs.example/x">protocole relatif</a> <a href="/races/" target="_blank">races</a>',
    '<a class="wikilink autre" data-cible="Humain" href="/races/humain/">Humain</a> <iframe src="x"></iframe><style>p{}</style></p>',
    '<table><tr><td data-couleur="vert" style="background:red" align="center">a</td><td data-couleur="noir">b</td></tr></table>',
    '<h2 id="titre" class="x">T</h2><h3 id="bad id">U</h3><ol start="3"><li>c</li></ol><font color="red">police</font>',
  ].join('');
  assert.equal(htmlSur(enfants(sale)), [
    '<p>Texte <strong>gras</strong> ',
    '<a>piège</a> <a>protocole relatif</a> <a href="/races/">races</a>',
    '<a class="wikilink" data-cible="Humain" href="/races/humain/">Humain</a> </p>',
    '<table><tbody><tr><td data-couleur="vert" align="center">a</td><td>b</td></tr></tbody></table>',
    '<h2 id="titre">T</h2><h3>U</h3><ol start="3"><li>c</li></ol>police',
  ].join(''));
});

test('aperçu assaini : le `title` d’un lien, déplacé dans `data-infobulle` sur la page (components/Infobulles.astro), redevient `title`', () => {
  const page = '<p><a class="wikilink wikilink--missing" data-cible="Page" data-infobulle="Page à créer" aria-description="Page à créer">Page</a></p>';
  assert.equal(htmlSur(enfants(page)), '<p><a class="wikilink wikilink--missing" data-cible="Page" title="Page à créer">Page</a></p>');
});

test('mise en forme du navigateur : <strike>, <span style> en gras ou en italique, <div> de saisie, sauts de ligne de bord', () => {
  assert.equal(versMarkdown(enfants('<div>a <strike>b</strike> <span style="font-weight: bold;">c</span> <span style="font-style: italic">d</span></div><div>e</div>')),
    'a ~~b~~ **c** *d*\n\ne\n');
  assert.equal(versMarkdown(enfants('<p>a<br></p><p><br></p><h2>T<br></h2><table><tr><th><br></th><th>x</th></tr><tr><td><br></td><td>y<br>z</td></tr></table>')),
    'a\n\n## T\n\n|  | x |\n| --- | --- |\n|  | y<br>z |\n');
});
