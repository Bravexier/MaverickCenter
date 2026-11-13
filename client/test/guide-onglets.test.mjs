// Des sections d'une page du guide en onglets (lib/guide-onglets.mjs ; components/guide/PageDuGuide.astro les pose, components/Onglets.astro les branche) :
// le découpage du Markdown par l'ancre figée des intertitres `###`, la phrase de clôture, le panneau rendu (id de l'intertitre retiré, nom de l'onglet),
// et le mode modification du site de dev, qui relit le morceau sans perte (la barre porte `data-ed-ignorer`, groupe et panneaux sont transparents).
// Le rendu de la page construite, avec ses neuf alignements : test/guide-html.test.mjs.
//   node --test test/guide-onglets.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ancresRompues } from '../src/lib/ancres-figees.mjs';
import { decouperEnOnglets, panneauRendu } from '../src/lib/guide-onglets.mjs';
import { versMarkdown } from '../src/lib/markdown-edition.mjs';
import { enfantsDuHtml, rendreCommeLeGuide } from './aide-rendu-du-site.mjs';

const ANCRES = new Set(['aaa', 'bbb', 'ccc']);
const TEXTE = [
  '## Les trois {#les-trois}',
  '',
  'Introduction.',
  '',
  '### Alpha {#aaa}',
  '',
  'Texte de alpha.',
  '',
  '***Exemple :***',
  '',
  '| A | B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '### Bravo {#bbb}',
  '',
  'Texte de bravo.',
  '',
  '### Charlie {#ccc}',
  '',
  'Texte de charlie.',
  '',
  '**Une phrase de clôture, en gras.**',
  '',
].join('\n');

test('le découpage : l’introduction au-dessus, un panneau par intertitre à ancre figée dans l’ordre du texte, la barre nommée par l’intertitre qui la précède', () => {
  const d = decouperEnOnglets(TEXTE, ANCRES);
  assert.deepEqual(d.panneaux.map((p) => p.ancre), ['aaa', 'bbb', 'ccc']);
  assert.equal(d.avant, '## Les trois {#les-trois}\n\nIntroduction.');
  assert.equal(d.etiquette, 'les-trois');
  // chaque panneau garde tout son Markdown, de son intertitre (avec son ancre) au suivant
  assert.ok(d.panneaux[0].markdown.startsWith('### Alpha {#aaa}\n\nTexte de alpha.'));
  assert.ok(d.panneaux[0].markdown.includes('***Exemple :***') && d.panneaux[0].markdown.includes('| 1 | 2 |'));
  assert.equal(d.panneaux[1].markdown, '### Bravo {#bbb}\n\nTexte de bravo.');
  // rien ne se perd : l'introduction, les panneaux et la suite redonnent le texte (la phrase de clôture est la dernière suite)
  assert.equal([d.avant, ...d.panneaux.map((p) => p.markdown), d.apres].join('\n\n'), TEXTE.trim());
});

test('le déclencheur est l’ancre figée, jamais le texte de l’intertitre : renommé, il reste un onglet ; sans ancre ou d’une autre ancre, il n’en est pas un', () => {
  const renomme = TEXTE.replace('### Alpha {#aaa}', '### Un tout autre nom {#aaa}');
  assert.deepEqual(decouperEnOnglets(renomme, ANCRES).panneaux.map((p) => p.ancre), ['aaa', 'bbb', 'ccc']);
  assert.ok(decouperEnOnglets(renomme, ANCRES).panneaux[0].markdown.startsWith('### Un tout autre nom {#aaa}'));
  // un intertitre au nom d'un alignement mais sans ancre figée : pas un onglet
  const sansAncre = TEXTE.replace('### Bravo {#bbb}', '### Bravo');
  assert.equal(decouperEnOnglets(sansAncre, ANCRES), null, 'Alpha seul, puis Bravo sans ancre (niveau 3) ferme le groupe : un seul onglet, donc rien');
  // une ancre qui n'est pas dans l'ensemble donné
  assert.equal(decouperEnOnglets(TEXTE, new Set(['zzz'])), null);
  assert.deepEqual(decouperEnOnglets(TEXTE, new Set(['aaa', 'bbb']))?.panneaux.map((p) => p.ancre), ['aaa', 'bbb'], 'Charlie ferme le groupe, passé dans la suite');
});

test('au moins deux onglets ; une ancre déjà prise, un intertitre de même niveau ou plus haut ferme le groupe, la suite reste après les panneaux', () => {
  assert.equal(decouperEnOnglets('### Alpha {#aaa}\n\nTexte.\n', ANCRES), null, 'un seul onglet');
  assert.equal(decouperEnOnglets('Un texte sans intertitre.\n', ANCRES), null);
  assert.equal(decouperEnOnglets('', ANCRES), null);
  assert.equal(decouperEnOnglets(undefined, ANCRES), null);
  const double = '### Alpha {#aaa}\n\nA.\n\n### Bravo {#bbb}\n\nB.\n\n### Alpha encore {#aaa}\n\nC.\n';
  const d = decouperEnOnglets(double, ANCRES);
  assert.deepEqual(d.panneaux.map((p) => p.ancre), ['aaa', 'bbb']);
  assert.equal(d.apres, '### Alpha encore {#aaa}\n\nC.', 'la seconde ancre est dans la suite, pas un troisième onglet');
  const suite = `${TEXTE}\n## Pour finir {#pour-finir}\n\nLa suite.\n`;
  const e = decouperEnOnglets(suite, ANCRES);
  assert.equal(e.panneaux.length, 3);
  assert.equal(e.apres, '**Une phrase de clôture, en gras.**\n\n## Pour finir {#pour-finir}\n\nLa suite.', 'la phrase de clôture, puis la suite');
  // un intertitre de niveau 4 reste dans son panneau
  const profond = '### Alpha {#aaa}\n\nA.\n\n#### Détail\n\nD.\n\n### Bravo {#bbb}\n\nB.\n';
  assert.ok(decouperEnOnglets(profond, ANCRES).panneaux[0].markdown.includes('#### Détail'));
});

test('un intertitre dans un bloc de code n’est pas un onglet ; fins de ligne Windows', () => {
  const code = '### Alpha {#aaa}\n\nA.\n\n```\n### Bravo {#bbb}\n```\n\n### Charlie {#ccc}\n\nC.\n';
  const d = decouperEnOnglets(code, ANCRES);
  assert.deepEqual(d.panneaux.map((p) => p.ancre), ['aaa', 'ccc']);
  assert.ok(d.panneaux[0].markdown.includes('```\n### Bravo {#bbb}\n```'));
  assert.deepEqual(decouperEnOnglets(TEXTE.replace(/\n/g, '\r\n'), ANCRES).panneaux.map((p) => p.ancre), ['aaa', 'bbb', 'ccc']);
});

test('la phrase de clôture : le dernier paragraphe, d’une ligne, entièrement en gras, du dernier onglet seulement', () => {
  const d = decouperEnOnglets(TEXTE, ANCRES);
  assert.equal(d.apres, '**Une phrase de clôture, en gras.**');
  assert.ok(!d.panneaux[2].markdown.includes('clôture'));
  assert.equal(d.panneaux[2].markdown, '### Charlie {#ccc}\n\nTexte de charlie.');
  // ni le gras et l'italique (« ***Exemple :*** »), ni du gras au milieu d'un texte, ni un paragraphe de plusieurs lignes
  for (const dernier of ['***Exemple :***', 'Un texte avec du **gras** dedans.', '**Gras** puis du texte.', '**A** et **B**', '**Une phrase\nsur deux lignes.**', '*Italique.*']) {
    const e = decouperEnOnglets(`### Alpha {#aaa}\n\nA.\n\n### Bravo {#bbb}\n\nB.\n\n${dernier}\n`, ANCRES);
    assert.equal(e.apres, '', `${dernier} : reste dans le dernier onglet`);
    assert.ok(e.panneaux[1].markdown.endsWith(dernier), dernier);
  }
  // une phrase en gras à la fin d'un onglet qui n'est pas le dernier reste dans son onglet ; un onglet qui ne garderait que son intertitre ne la perd pas
  const milieu = decouperEnOnglets('### Alpha {#aaa}\n\nA.\n\n**Fin de alpha.**\n\n### Bravo {#bbb}\n\nB.\n', ANCRES);
  assert.equal(milieu.apres, '');
  assert.ok(milieu.panneaux[0].markdown.endsWith('**Fin de alpha.**'));
  const nu = decouperEnOnglets('### Alpha {#aaa}\n\nA.\n\n### Bravo {#bbb}\n\n**Seule.**\n', ANCRES);
  assert.equal(nu.apres, '');
  assert.equal(nu.panneaux[1].markdown, '### Bravo {#bbb}\n\n**Seule.**');
});

test('le panneau rendu : le nom de l’onglet est celui de l’intertitre tel qu’il est, l’intertitre n’a plus son id (celui du panneau), son ancre figée reste pour l’éditeur', () => {
  const html = '<h3 id="aaa" data-ancre-figee="aaa">Le <em>nom</em> &amp; l&#39;autre</h3>\n<p>Texte.</p>\n<h3 id="bbb">Un autre</h3>';
  const p = panneauRendu(html, 'aaa');
  assert.equal(p.titre, 'Le nom &amp; l&#39;autre', 'le texte de l’intertitre, ses entités écrites (posé tel quel en HTML)');
  assert.equal(p.html, '<h3 data-ancre-figee="aaa">Le <em>nom</em> &amp; l&#39;autre</h3>\n<p>Texte.</p>\n<h3 id="bbb">Un autre</h3>', 'seul le premier intertitre perd son id');
  assert.equal(panneauRendu('<p>Sans intertitre.</p>', 'aaa').titre, 'aaa');
  assert.equal(panneauRendu('<p>Sans intertitre.</p>', 'aaa').html, '<p>Sans intertitre.</p>');
  assert.equal(panneauRendu('', 'aaa').titre, 'aaa');
  assert.equal(panneauRendu(undefined, 'aaa').html, '');
});

// Le mode modification du site de dev (src/scripts/edition/guide.mjs) relit le HTML de chaque morceau de texte en Markdown (lib/markdown-edition.mjs#versMarkdown) :
// le morceau en onglets, tel que PageDuGuide.astro le compose, se relit comme le rendu à plat du même Markdown.
test('le mode modification relit un morceau en onglets sans perte : barre ignorée, groupe et panneaux transparents, ancres figées gardées', async () => {
  const d = decouperEnOnglets(TEXTE, ANCRES);
  const rendre = (markdown) => (markdown.trim() ? rendreCommeLeGuide(markdown) : '');
  const panneaux = await Promise.all(d.panneaux.map(async (p) => ({ ...panneauRendu(await rendre(p.markdown), p.ancre), ancre: p.ancre })));
  const compose = async (barre) => `${await rendre(d.avant)}<div class="onglets-guide" data-onglets>${barre(panneaux)}${panneaux.map((p) => `<section class="onglets-guide__panneau" id="${p.ancre}">${p.html}</section>`).join('')}</div>${await rendre(d.apres)}`;
  const barre = (ps) => `<nav class="onglets-guide__liste" data-ed-ignorer contenteditable="false">${ps.map((p) => `<a class="onglet" id="onglet-${p.ancre}" href="#${p.ancre}">${p.titre}</a>`).join('')}</nav>`;
  const html = await compose(barre);
  assert.equal((html.match(/id="aaa"/g) ?? []).length, 1, 'l’id de l’ancre est celui du panneau, une seule fois');
  const relu = versMarkdown(enfantsDuHtml(html));
  const aPlat = versMarkdown(enfantsDuHtml(await rendre(TEXTE)));
  assert.equal(relu, aPlat, 'le Markdown relu est celui du rendu à plat');
  assert.equal(relu.trim(), TEXTE.trim(), 'et celui de la page');
  assert.deepEqual(ancresRompues(TEXTE, relu), { retirees: [], doublees: [] }, 'aucune ancre figée perdue ni doublée (le service refuserait le texte)');
  // sans la marque `data-ed-ignorer`, la barre s'écrirait dans le texte : c'est elle qui la garde hors du Markdown
  const sansMarque = versMarkdown(enfantsDuHtml(await compose((ps) => barre(ps).replace(' data-ed-ignorer', ''))));
  assert.notEqual(sansMarque, aPlat);
});
