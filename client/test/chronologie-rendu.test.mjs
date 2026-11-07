// Le rendu d'un texte dans le navigateur du site de dev (lib/chronologie-rendu.mjs#htmlDuTexte : une description de la chronologie, un bloc d'un panneau
// de règles, l'annonce de l'accueil, créés ou modifiés depuis la construction) doit être celui du build (lib/guide-rendu.ts, rendu ici par
// test/aide-rendu-du-site.mjs#rendreCommeLeGuide : la même chaîne, mêmes plugins) : typographie (smartypants), règle CommonMark des délimiteurs,
// échappements, [[liens]] avec leur cible telle qu'écrite (data-cible, que l'éditeur en place réécrit), monnaies en icônes, citations, listes
// (lot « Défauts du code », point 8). Et redonner, par l'éditeur en place (lib/markdown-edition.mjs#versMarkdown), le même Markdown : sinon une retouche
// d'un mot réécrirait les liens du wiki ou les citations du reste du texte. Les textes sont lus dans la base courante (aucun texte figé : seule l'égalité
// des deux rendus est vérifiée), plus des échantillons que le test pose lui-même.
//   node --test test/chronologie-rendu.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { htmlDuTexte } from '../src/lib/chronologie-rendu.mjs';
import { marquerLaDate, surlignerLaDate } from '../src/lib/chronologie.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { versMarkdown } from '../src/lib/markdown-edition.mjs';
import { buildIndex, entryUrl, resolve, scanContent } from '../src/lib/wikilinks.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { DOSSIER_DU_WIKI, enfantsDuHtml, normal, rendreCommeLeGuide } from './aide-rendu-du-site.mjs';

const pages = scanContent(DOSSIER_DU_WIKI);
const index = buildIndex(pages);
// une page du wiki pour les liens des échantillons, prise dans les pages courantes (son titre et son id, pas un nom supposé)
const unePage = pages.find((p) => p.type === 'races') ?? pages[0];
/** L'adresse d'une page comme au build (lib/wikilinks.mjs#remarkWikilinks) ; celle que les scripts du site de dev calculent par la liste des pages. */
const page = (cible) => {
  const trouvee = resolve(index, cible);
  return trouvee?.entry ? entryUrl('/', trouvee.entry) : `/${cible}/`;
};
/** Le rendu du build d'un texte (la date surlignée comme components/chronologie/ChronologieEvenement.astro). */
const duBuild = async (texte, dateBrut = null) => surlignerLaDate(await rendreCommeLeGuide(marquerLaDate(texte, dateBrut)));
/**
 * Le HTML tel que le navigateur le lit (innerHTML) : analysé puis réécrit (hast-util-from-html, hast-util-to-html, dépendances de
 * @astrojs/markdown-remark), espaces entre balises retirés. Le HTML des monnaies est recopié tel quel dans le navigateur (`&#39;`, `&#8239;`) et réécrit
 * par rehype-raw au build (`&#x27;`, l'espace fine insécable en caractère) : le même DOM.
 */
const lu = (html) => normal(toHtml(fromHtml(html, { fragment: true })));
/** Une cible du texte qui ne mène à aucune page : le build pose un repère « page manquante » que le navigateur, sans l'index, ne pose pas. */
const cibleAbsente = (texte) => [...String(texte).matchAll(/\[\[([^[\]|]+?)(?:\|[^[\]]+?)?\]\]/g)].some((m) => !resolve(index, m[1].trim())?.entry);

/** Tous les textes de la base que le navigateur rend (la base courante par défaut) : [{ ou, texte, dateBrut }]. */
function textesDeLaBase(db = ouvrirBase({ sansExemples: false })) {
  return [
    ...db.prepare('SELECT evenement_id, rang, texte, date_brut FROM evenement_extrait ORDER BY evenement_id, rang').all()
      .map((b) => ({ ou: `evenement_extrait ${b.evenement_id}#${b.rang}`, texte: b.texte, dateBrut: b.date_brut })),
    ...db.prepare('SELECT panneau_id, rang, texte FROM panneau_regles_bloc ORDER BY panneau_id, rang').all()
      .map((b) => ({ ou: `panneau_regles_bloc ${b.panneau_id}#${b.rang}`, texte: b.texte, dateBrut: null })),
    ...db.prepare('SELECT id, texte FROM annonce WHERE texte IS NOT NULL ORDER BY id').all().map((a) => ({ ou: `annonce ${a.id}`, texte: a.texte, dateBrut: null })),
  ];
}

test('chaque texte de la base : le HTML du navigateur est celui du build, et l’éditeur en place en redonne le même Markdown', async () => {
  // l'étendue du contrôle se vérifie à l'import (le site de dev crée et supprime des blocs) ; dans la base courante, chaque texte qui reste
  assert.ok(textesDeLaBase(baseDImport()).length > 100, 'plus de cent textes à l’import');
  const textes = textesDeLaBase();
  const ecarts = [];
  const markdown = [];
  for (const { ou, texte, dateBrut } of textes) {
    const build = await duBuild(texte, dateBrut);
    const navigateur = htmlDuTexte(texte, { dateBrut, page });
    if (!cibleAbsente(texte) && lu(navigateur) !== lu(build)) ecarts.push(`${ou}\n--- build ---\n${build}\n--- navigateur ---\n${navigateur}`);
    if (versMarkdown(enfantsDuHtml(navigateur)) !== versMarkdown(enfantsDuHtml(build))) markdown.push(ou);
  }
  assert.deepEqual(ecarts.slice(0, 3), [], `${ecarts.length} texte(s) rendu(s) autrement qu’au build`);
  assert.deepEqual(markdown.slice(0, 5), [], `${markdown.length} texte(s) réécrit(s) autrement par l’éditeur`);
});

// des échantillons de ce que le rendu doit tenir (écrits ici : la base peut ne pas en avoir)
const ECHANTILLONS = [
  // typographie (remark-smartypants) : guillemets droits, apostrophes, tirets, points de suspension
  'Il dit "bonjour" et l\'autre répond \'non\'... -- puis --- et . . . fin',
  '« Déjà » courbes, l’apostrophe courbe gardée',
  // règle CommonMark des délimiteurs (gauche/droite) : gras collé à un mot, astérisque isolée, gras dans un mot
  '**gras** et *italique* et ***les deux*** ; un **gras **pas fermé ; a*b*c ; 2 * 3 * 4 ; __souligné__ et _em_ ; mot_avec_tirets',
  '**« Gras entre guillemets »** et *(italique entre parenthèses)*.',
  // échappements
  '\\*\\*pas gras\\*\\* et \\_pas\\_ et \\# pas un titre et 1\\. pas une liste',
  // liens, sauts, listes, citations, barré
  `Voir [[${unePage.title}]] et [[${unePage.id}|ces gens]] et [[Page qui n’existe pas]], [un site](https://example.org) et [une page](/regles/).<br>Ligne suivante.  \nForcée\\\nAussi.`,
  '> *« Une citation. »*\n>\n> — Quelqu’un\n\nLa suite ~~barrée~~.',
  'Avant\n\n- un\n- deux\n  - sous\n\n1. premier\n2) second\n\nAprès.',
  // monnaies, tableau GFM, intertitre (et son ancre figée)
  'Coûte 1245,5 RO ou 3 PP.\n\n| Objet | Prix (RO) |\n| --- | ---: |\n| {couleur:vert} Corde | 10 |\n\n### Un intertitre\n\n### Fixe {#fixe}',
];

test('échantillons : le rendu du navigateur est celui du build (typographie, gras, échappements, liens, listes, monnaies, tableaux)', async () => {
  // une cible absente : le build pose son repère « page manquante » (span), le navigateur un lien vers page(cible) ; le reste est le même
  const manquante = (html) => html.replace(/<span class="wikilink wikilink--missing" title="[^"]*" data-cible="([^"]*)">([^<]*)<\/span>/g,
    (_, cible, texte) => `<a href="${encodeURI(page(cible))}" class="wikilink" data-cible="${cible}">${texte}</a>`);
  for (const md of ECHANTILLONS) assert.equal(lu(htmlDuTexte(md, { page })), lu(manquante(await duBuild(md))), md);
});

test('la date surlignée et la sûreté : seul un <br> du HTML brut est rendu, un lien non sûr perd son adresse', () => {
  assert.match(htmlDuTexte('En 12 après, rien.', { dateBrut: '12 après' }), /<mark class="chrono-surligne">12 après<\/mark>/);
  for (const md of ['<script>alert(1)</script>', 'Texte <img src=x onerror=alert(1)> suite', '<div onclick="x()">bloc</div>']) {
    assert.doesNotMatch(htmlDuTexte(md), /<script|<img|<div/i, md);
  }
  const liens = htmlDuTexte('[x](javascript:alert(1)) et ![i](javascript:x) et [y](https://example.org)');
  assert.doesNotMatch(liens, /javascript:|<img/i);
  assert.match(liens, /<a href="https:\/\/example\.org">y<\/a>/);
  assert.match(htmlDuTexte('Un<br/>saut'), /Un<br>saut/);
});

test('sûreté des liens et images par référence : une définition non sûre ne donne ni lien ni image, une sûre garde son lien', () => {
  const nonSurs = [
    ['[clic][a]\n\n[a]: javascript:alert(1)', /<p>clic<\/p>/],
    ['[clic]\n\n[clic]: javascript:alert(2)', /<p>clic<\/p>/],
    ['[clic][]\n\n[clic]: JavaScript:alert(3)', /<p>clic<\/p>/],
    ['![image][b]\n\n[b]: javascript:alert(1)', /<p>image<\/p>/],
    ['![][b]\n\n[b]: data:image/svg+xml,x', /<p><\/p>/],
    ['> [c][q]\n>\n> [q]: vbscript:x', /<blockquote>\s*<p>c<\/p>\s*<\/blockquote>/],
    ['[*gras*][a]\n\n[a]: data:text/html,x', /<p><em>gras<\/em><\/p>/],
  ];
  for (const [md, attendu] of nonSurs) {
    const html = htmlDuTexte(md);
    assert.doesNotMatch(html, /<a\b|<img\b|javascript:|vbscript:|data:/i, md);
    assert.match(html, attendu, md);
  }
  // une définition sûre (http(s) ou adresse du site) garde son lien, même si une définition non sûre du même nom la suit ou la précède
  assert.match(htmlDuTexte('[ok][a]\n\n[a]: https://example.org'), /<a href="https:\/\/example\.org">ok<\/a>/);
  assert.match(htmlDuTexte('[ok][a]\n\n[a]: /regles/'), /<a href="\/regles\/">ok<\/a>/);
  assert.match(htmlDuTexte('[ok][a]\n\n[a]: javascript:x\n[a]: https://example.org'), /<a href="https:\/\/example\.org">ok<\/a>/);
  assert.doesNotMatch(htmlDuTexte('[ok][a]\n\n[a]: https://example.org\n[a]: javascript:x'), /javascript:/);
  // sans aucune définition, la référence reste le texte entre crochets, comme au build
  assert.match(htmlDuTexte('[sans][z]'), /<p>\[sans\]\[z\]<\/p>/);
});
