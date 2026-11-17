// Ancres figées des intertitres (lib/ancres-figees.mjs ; lot « Défauts du code », point 6) : `## Texte {#ancre}` rattache une section par un identifiant
// que le renommage de l'intertitre sur le site de dev ne change pas. Le rendu passe par le processeur de @astrojs/markdown-remark, celui du build, avec
// le plugin seul, puis par les chaînes du site (test/aide-rendu-du-site.mjs) pour l'aller-retour de l'éditeur visuel.
//   node --test test/ancres-figees.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { ancreDuTitre, ancresDuCorps, ancresRompues, raisonDesAncresRompues, remarkAncresFigees, sansAncresFigees, sectionParAncre } from '../src/lib/ancres-figees.mjs';
import { htmlSur, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { enfantsDuHtml, rendreCommeLeGuide, rendreLeMarkdown } from './aide-rendu-du-site.mjs';

const CORPS = [
  'Intro.',
  '',
  '## Première {#premiere}',
  '',
  'Texte 1.',
  '',
  '### Détail {#detail}',
  '',
  'Sous 1.',
  '',
  '```',
  '## Pas un titre {#code}',
  '```',
  '',
  '## Seconde',
  '',
  'Texte 2.',
].join('\n');

test('ancreDuTitre : une ligne d’intertitre qui finit par {#ancre} ; rien ailleurs', () => {
  assert.deepEqual(ancreDuTitre('## La ceinture {#la-ceinture}'), { niveau: 2, texte: 'La ceinture', ancre: 'la-ceinture' });
  assert.deepEqual(ancreDuTitre('### Titre {#a1}  '), { niveau: 3, texte: 'Titre', ancre: 'a1' });
  for (const ligne of ['## La ceinture', 'Texte {#a}', '## Titre{#a}', '## Titre {#A}', '## Titre {#a b}', '## Titre {#-a}', '####### Titre {#a}']) {
    assert.equal(ancreDuTitre(ligne), null, ligne);
  }
});

test('ancresDuCorps : les ancres des intertitres, pas celles d’un bloc de code', () => {
  assert.deepEqual(ancresDuCorps(CORPS).map((a) => a.ancre), ['premiere', 'detail']);
});

test('sectionParAncre : la section jusqu’à l’intertitre suivant de même niveau ou plus haut, quel que soit le texte de l’intertitre', () => {
  assert.equal(sectionParAncre(CORPS, 'premiere'), 'Texte 1.\n\n### Détail {#detail}\n\nSous 1.\n\n```\n## Pas un titre {#code}\n```');
  assert.equal(sectionParAncre(CORPS, 'detail'), 'Sous 1.\n\n```\n## Pas un titre {#code}\n```', 'un « ## » de code ne ferme pas la section');
  assert.equal(sectionParAncre(CORPS, 'detail', { avecTitre: true }).split('\n')[0], '### Détail', 'le titre sans sa marque');
  assert.equal(sectionParAncre(CORPS, 'code'), null, 'une ancre écrite dans du code n’en est pas une');
  assert.equal(sectionParAncre(CORPS, 'absente'), null);
  // l'intertitre renommé (le site de dev réécrit son texte, l'ancre reste) : la même section
  const renomme = CORPS.replace('## Première {#premiere}', '## Tout autre intitulé {#premiere}');
  assert.equal(sectionParAncre(renomme, 'premiere'), sectionParAncre(CORPS, 'premiere'));
  assert.equal(sectionParAncre('## A {#a}\n\n## B', 'a'), null, 'section vide');
});

test('sansAncresFigees : le texte affiché, marques retirées des intertitres seulement', () => {
  assert.equal(sansAncresFigees(CORPS), CORPS.replace(' {#premiere}', '').replace(' {#detail}', ''));
  assert.equal(sansAncresFigees('Texte {#a}'), 'Texte {#a}');
});

test('remarkAncresFigees : l’ancre devient l’id du titre (gardé par le processeur du build) et data-ancre-figee ; le texte affiché perd la marque', async () => {
  const processeur = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [remarkAncresFigees] });
  const rendu = async (md) => (await processeur.render(md, { frontmatter: {} })).code;
  const html = await rendu('## La *ceinture* {#la-ceinture}\n\nTexte.\n\n## Sans ancre\n\n```\n## Code {#code}\n```');
  assert.match(html, /<h2 id="la-ceinture" data-ancre-figee="la-ceinture">La <em>ceinture<\/em><\/h2>/);
  assert.match(html, /<h2 id="sans-ancre">Sans ancre<\/h2>/, 'sans ancre : le slug du texte, comme avant');
  assert.ok(html.includes('## Code {#code}'), 'le code reste tel quel');
  assert.ok(!html.includes('{#la-ceinture}'));
  // renommé : même id
  assert.match(await rendu('## Autre intitulé {#la-ceinture}'), /<h2 id="la-ceinture" data-ancre-figee="la-ceinture">Autre intitulé<\/h2>/);
});

// Le branchement dans les chaînes du site (astro.config.mjs, lib/guide-rendu.ts, l'aide des tests) et l'aller-retour de l'éditeur visuel
// (lib/markdown-edition.mjs : data-ancre-figee → « {#ancre} »).
test('le plugin est déclaré dans astro.config.mjs, lib/guide-rendu.ts et l’aide des tests, qui doivent rester d’accord', () => {
  for (const fichier of ['../astro.config.mjs', '../src/lib/guide-rendu.ts', './aide-rendu-du-site.mjs']) {
    const source = readFileSync(new URL(fichier, import.meta.url), 'utf8');
    assert.match(source, /import \{ remarkAncresFigees \} from '[./a-z-]*ancres-figees\.mjs'/, `${fichier} : importé`);
    assert.match(source, /remarkPlugins: \[[^\]]*\][^\n]*remarkAncresFigees/, `${fichier} : dans la liste des plugins`);
  }
});

test('aller-retour de l’éditeur visuel : Markdown → HTML du site → Markdown garde l’ancre figée, même l’intertitre renommé', async () => {
  const md = '## La *ceinture* {#la-ceinture}\n\nTexte.\n\n### Sans ancre\n\nSuite.';
  for (const rendre of [rendreLeMarkdown, rendreCommeLeGuide]) {
    const html = await rendre(md);
    assert.match(html, /<h2 id="la-ceinture" data-ancre-figee="la-ceinture">/, 'rendu comme au build');
    assert.equal(versMarkdown(enfantsDuHtml(html)).trim(), md);
    // le HTML assaini (ce que l'éditeur réaffiche) garde l'attribut, et redonne le même Markdown
    assert.match(htmlSur(enfantsDuHtml(html)), /<h2 id="la-ceinture" data-ancre-figee="la-ceinture">/);
    assert.equal(versMarkdown(enfantsDuHtml(htmlSur(enfantsDuHtml(html)))).trim(), md);
  }
  // l'intertitre renommé dans l'éditeur (son texte change, l'attribut reste sur l'élément) : l'ancre suit
  const renomme = (await rendreLeMarkdown(md)).replace('La <em>ceinture</em>', 'Autre intitulé');
  assert.equal(versMarkdown(enfantsDuHtml(renomme)).split('\n')[0], '## Autre intitulé {#la-ceinture}');
  // une ancre qui n'a pas la forme d'une ancre figée n'est pas réécrite (rien d'inventé dans le Markdown)
  assert.equal(versMarkdown(enfantsDuHtml('<h2 data-ancre-figee="Pas Valide">Titre</h2>')).trim(), '## Titre');
  // un intertitre coupé en deux dans l'éditeur (le navigateur recopie les attributs) : l'ancre reste à la première moitié, jamais deux fois
  assert.equal(versMarkdown(enfantsDuHtml('<h2 data-ancre-figee="a">Début</h2><h2 data-ancre-figee="a">Fin</h2>')).trim(), '## Début {#a}\n\n## Fin');
});

test('ancresRompues : retirée, renommée ou doublée (garde du service) ; ajoutée, gardée sous un intertitre renommé, ou dans du code : rien', () => {
  const rien = { retirees: [], doublees: [] };
  assert.deepEqual(ancresRompues(CORPS, CORPS), rien);
  assert.deepEqual(ancresRompues(CORPS, CORPS.replace('## Première {#premiere}', '## Autre intitulé {#premiere}')), rien, 'l’intertitre renommé garde son ancre');
  assert.deepEqual(ancresRompues(CORPS, `${CORPS}\n\n## Nouvelle {#nouvelle}\n`), rien, 'une ancre ajoutée');
  assert.deepEqual(ancresRompues(CORPS, CORPS.replace('## Première {#premiere}', '## Première')).retirees, [{ ancre: 'premiere', texte: 'Première' }]);
  assert.deepEqual(ancresRompues(CORPS, CORPS.replace('{#detail}', '{#detail-2}')).retirees, [{ ancre: 'detail', texte: 'Détail' }], 'renommée');
  assert.deepEqual(ancresRompues(CORPS, null).retirees.map((a) => a.ancre), ['premiere', 'detail'], 'le texte vidé');
  assert.deepEqual(ancresRompues(CORPS, CORPS.replace('## Seconde', '## Seconde {#premiere}')), { retirees: [], doublees: [{ ancre: 'premiere', texte: 'Première' }] });
  // une ancre déjà doublée avant (aucune règle ne le permet, mais rien n'est imputé au texte qui ne l'aggrave pas)
  const deja = `${CORPS}\n\n## Bis {#premiere}\n`;
  assert.deepEqual(ancresRompues(deja, deja.replace('Texte 2.', 'Texte deux.')), rien);
  // une marque dans un bloc de code n'est pas une ancre : la retirer ne rompt rien
  assert.deepEqual(ancresRompues(CORPS, CORPS.replace('## Pas un titre {#code}', '## Pas un titre')), rien);
  assert.equal(raisonDesAncresRompues(CORPS, CORPS), null);
  const raison = raisonDesAncresRompues(CORPS, CORPS.replace(/\{#[a-z]+\}/g, '{#plouf}'));
  for (const ancre of ['premiere', 'detail', 'plouf']) assert.ok(raison.includes(`{#${ancre}}`), raison);
});
