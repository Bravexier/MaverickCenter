// Le rendu du texte actuel d'une page du guide dans le navigateur du site de dev (lib/markdown-rendu.mjs#creerLeRendu, posé par
// src/scripts/edition/guide.mjs#surcouche quand l'aperçu d'un texte en attente manque : texte fusionné au rejeu, conflit résolu) doit être celui du
// build : @astrojs/markdown-remark avec les mêmes plugins (test/aide-rendu-du-site.mjs : astro.config.mjs pour le Codex, lib/guide-rendu.ts pour le
// guide). Et la décision « ligne en attente sans aperçu → rendu vivant » (lib/markdown-edition.mjs#etatDuTexte). Les corps sont posés par le test, ou lus
// dans les pages courantes (aucun texte figé : seule l'égalité des deux rendus est vérifiée).
//   node --test test/markdown-rendu.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { BLOCS } from '../src/lib/guide.mjs';
import { decouperCorps, etatDuTexte, htmlSur, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { creerLeRendu, remarkPluginsDuWiki } from '../src/lib/markdown-rendu.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { buildIndex, resolve, scanContent, splitFrontmatter } from '../src/lib/wikilinks.mjs';
import { DOSSIER_DU_WIKI, enfantsDuHtml, normal, rendreCommeLeGuide, rendreLeMarkdown } from './aide-rendu-du-site.mjs';

const entrees = scanContent(DOSSIER_DU_WIKI);
// les pages de la base vivante, comme GET /api/edition/pages/ les donne
const pages = entrees.map((e) => ({ id: e.id, titre: e.title }));
const sansAlias = buildIndex(entrees.map((e) => ({ ...e, aliases: [] })));
const rendu = creerLeRendu({ pages, base: '/' });
// une page du wiki pour les liens des échantillons, prise dans les pages courantes (son titre et son id, pas un nom supposé)
const unePage = entrees.find((e) => e.type === 'races') ?? entrees[0];

/** Le HTML tel que le navigateur le lit (innerHTML) : analysé puis réécrit, espaces entre balises retirés (comme test/chronologie-rendu.test.mjs). */
const lu = (html) => normal(toHtml(fromHtml(html, { fragment: true })));
/** Une cible [[…]] du texte qu'un alias seul résout : la route des pages n'en donne pas (lib/markdown-rendu.mjs#indexDesPages), l'index du build oui. */
const cibleParAlias = (texte) =>
  [...String(texte).matchAll(/\[\[([^[\]|]+?)(?:\|[^[\]]+?)?\]\]/g)].some((m) => !resolve(sansAlias, m[1].trim())?.entry && resolve(buildIndex(entrees), m[1].trim())?.entry);
/** Ce que l'éditeur redonne d'un HTML posé dans la page (htmlSur, comme guide.mjs#assainir) : son Markdown. */
const markdownRelu = (html) => versMarkdown(enfantsDuHtml(htmlSur(enfantsDuHtml(html))));

const ECHANTILLONS = [
  // [[liens]] : titre, id avec texte, page qui n'existe pas (le repère « page manquante », comme le build)
  `Voir [[${unePage.title}]] et [[${unePage.id}|ces gens]] et [[Une page qui n’existe pas]].`,
  // titres, ancre figée, typographie, listes, citation, barré
  '## Un titre {#ancre-posee}\n\nIl dit "bonjour" et l\'autre répond... -- fin.\n\n### Sous-titre\n\n- un\n- deux\n\n1. premier\n2. second\n\n> *« Citation. »*\n\nLe ~~barré~~ et **gras** et *italique*.',
  // tableau GFM, couleur de case, alignement
  '| A | B |\n| :--- | ---: |\n| {couleur:vert} un | deux |\n| trois | {couleur:rouge} quatre |\n',
  // monnaies en icônes et montant décomposé
  'Un coût de 1245,5 RO, ou 3 RF, ou une PP.',
  // liens Markdown vers le site (préfixés), vers une ancienne adresse du guide, vers le web
  'Voir [les races](/races/), [une ancienne page](/guide/les-postures/), [l’ancien guide](/guide/) et [un site](https://example.org).',
  // balises du glossaire : rendues ensuite par le vocabulaire vivant, le texte reste tel quel
  'Un {{mot-cle-pose}} et {{autre|texte écrit}}.',
  // HTML brut : seul le saut <br> reste
  'Ligne<br>suivante, `du code` et\n\n```\nun bloc\n```\n',
];

test('un corps posé par le test : le HTML du navigateur est celui du build, pour une page du guide (lib/guide-rendu.ts) comme pour le Codex (astro.config.mjs)', async () => {
  for (const [i, md] of ECHANTILLONS.entries()) {
    assert.equal(lu(rendu.guide(md)), lu(await rendreCommeLeGuide(md)), `guide, échantillon ${i}`);
    // le Codex : sans le préfixe ni les anciennes adresses (le build de ses pages passe par la configuration d'Astro)
    assert.equal(lu(rendu.codex(md)), lu(await rendreLeMarkdown(md)), `Codex, échantillon ${i}`);
  }
});

test('le préfixe de déploiement : les [[liens]] et les liens Markdown du guide le portent, comme au build', async () => {
  const base = '/MaverickCenter/';
  const md = `Voir [[${unePage.id}]] et [les races](/races/) et [une ancienne page](/guide/les-postures/).`;
  const html = creerLeRendu({ pages, base }).guide(md);
  assert.equal(lu(html), lu(await rendreCommeLeGuide(md, base)));
  assert.ok(html.includes(`href="${base}${cheminDePage(unePage.id)}"`), 'le [[lien]] porte le préfixe');
  assert.ok(html.includes(`href="${base}races/"`), 'le lien Markdown porte le préfixe');
});

test('une page créée sur le site de dev (absente de l’index du build) est liée par son adresse, avec son titre courant', () => {
  const id = 'lore/page-creee-par-le-test';
  const avec = creerLeRendu({ pages: [...pages, { id, titre: 'Page créée par le test' }], base: '/' });
  assert.ok(avec.guide('Voir [[Page créée par le test]] et [[lore/page-creee-par-le-test]].').split(`href="/${cheminDePage(id)}"`).length === 3, 'les deux liens mènent à la page');
  assert.ok(rendu.guide('Voir [[Page créée par le test]].').includes('wikilink--missing'), 'sans elle, le repère « page manquante »');
});

test('tout corps des pages courantes : le HTML du navigateur est celui du build, et l’éditeur en relit le même Markdown', async () => {
  const ecarts = [];
  const markdown = [];
  let verifies = 0;
  for (const e of entrees) {
    const { body } = splitFrontmatter(readFileSync(new URL(`${e.id}.md`, `file://${DOSSIER_DU_WIKI}`), 'utf8'));
    const guide = e.type === 'guide';
    // une page du guide est rendue morceau par morceau (autour de ses blocs tirés de la base), une page du Codex d'un bloc
    const textes = guide ? decouperCorps(body).filter((m) => m.visible).map((m) => m.texte) : body.trim() ? [body] : [];
    for (const [i, texte] of textes.entries()) {
      if (cibleParAlias(texte)) continue; // écart voulu : la route des pages ne donne pas les alias
      const navigateur = guide ? rendu.guide(texte) : rendu.codex(texte);
      const build = guide ? await rendreCommeLeGuide(texte) : await rendreLeMarkdown(texte);
      verifies++;
      if (lu(navigateur) !== lu(build)) ecarts.push(`${e.id} #${i}`);
      if (markdownRelu(navigateur) !== markdownRelu(build)) markdown.push(`${e.id} #${i}`);
    }
  }
  assert.ok(verifies > 0, 'des textes comparés');
  assert.deepEqual(ecarts.slice(0, 5), [], `${ecarts.length} texte(s) rendu(s) autrement qu’au build`);
  assert.deepEqual(markdown.slice(0, 5), [], `${markdown.length} texte(s) relu(s) autrement par l’éditeur`);
});

test('sûreté : le HTML rendu puis assaini (htmlSur) ne porte ni script, ni image, ni événement, ni adresse javascript: (le texte reste du texte)', () => {
  const md = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[piégé](javascript:alert(1)) et [[Page]] <a href="javascript:alert(2)" onclick="x()">lien</a>\n';
  const elements = (noeuds) => noeuds.flatMap((n) => (n.type === 'element' ? [n, ...elements(n.enfants)] : []));
  for (const rendre of [rendu.guide, rendu.codex]) {
    const sain = elements(enfantsDuHtml(htmlSur(enfantsDuHtml(rendre(md)))));
    assert.deepEqual(sain.filter((n) => ['script', 'img'].includes(n.nom)), []);
    for (const n of sain) {
      assert.deepEqual(Object.keys(n.attributs).filter((a) => /^on/i.test(a)), [], `<${n.nom}> sans événement`);
      assert.doesNotMatch(n.attributs.href ?? '', /^\s*javascript:/i);
    }
  }
});

test('les plugins du navigateur sont ceux d’astro.config.mjs (Codex) et de lib/guide-rendu.ts (guide), dans le même ordre', () => {
  const noms = (plugins) => plugins.map((p) => (Array.isArray(p) ? p[0] : p).name);
  const index = buildIndex([]);
  const codex = noms(remarkPluginsDuWiki({ index }));
  const guide = noms(remarkPluginsDuWiki({ index, adresse: () => '' }));
  assert.deepEqual(guide.slice(0, codex.length), codex, 'le guide ajoute ses anciennes adresses à la fin');
  assert.equal(guide.length, codex.length + 1);
  for (const [fichier, attendus] of [['../astro.config.mjs', codex], ['../src/lib/guide-rendu.ts', guide]]) {
    const source = readFileSync(new URL(fichier, import.meta.url), 'utf8');
    const depuis = source.slice(source.indexOf('remarkPlugins:'));
    const places = attendus.map((nom) => depuis.indexOf(nom));
    assert.ok(places.every((p) => p > 0), `${fichier} : tous les plugins déclarés`);
    assert.deepEqual(places, [...places].sort((a, b) => a - b), `${fichier} : dans le même ordre`);
  }
});

// --- La décision : une ligne en attente sans aperçu -----------------------------------------------------------------------------------------------
const MARQUEUR = `<!-- guide:${BLOCS[0]} -->`;

test('etatDuTexte : l’aperçu s’il va avec les morceaux, sinon le rendu vivant du texte actuel ; « périmé » seulement si ce texte ne se découpe pas comme la page', () => {
  const deux = `Un.\n\n${MARQUEUR}\n\nDeux.\n`;
  assert.equal(etatDuTexte(undefined, 1), null, 'aucune ligne en attente');
  assert.equal(etatDuTexte({ table: 'page', creee: false, ligne: { corps_md: 'Un.' } }, 1), null, 'le titre seul a changé (pas d’aperçu)');
  assert.equal(etatDuTexte({ creee: false, apercu: ['<p>x</p>', '<p>y</p>'], ligne: { corps_md: deux } }, 2), 'apercu');
  // l'aperçu manque (texte fusionné au rejeu, conflit résolu) : le texte actuel est rendu, si ses morceaux sont ceux de la page
  assert.equal(etatDuTexte({ creee: false, apercu: null, ligne: { corps_md: deux } }, 2), 'vivant');
  assert.equal(etatDuTexte({ creee: false, apercu: null, ligne: { corps_md: 'Un seul.' } }, 1), 'vivant');
  // l'aperçu ne va pas avec les morceaux de la page : le texte actuel
  assert.equal(etatDuTexte({ creee: false, apercu: ['<p>x</p>'], ligne: { corps_md: deux } }, 2), 'vivant');
  // un texte qui ne se découpe pas comme la page, ou une ligne supprimée : la page ne peut pas le montrer avant la prochaine mise à jour
  assert.equal(etatDuTexte({ creee: false, apercu: null, ligne: { corps_md: deux } }, 1), 'perime');
  assert.equal(etatDuTexte({ creee: false, apercu: null, ligne: { corps_md: `${MARQUEUR}\n` } }, 1), 'perime', 'un corps sans texte visible');
  assert.equal(etatDuTexte({ creee: false, apercu: null, ligne: null }, 1), 'perime');
  assert.equal(etatDuTexte({ creee: false, apercu: ['<p>x</p>'], ligne: { corps_md: deux } }, 3), 'perime');
  // une page créée sur le site de dev : son texte est rendu ; s'il ne se découpe pas comme la page, elle garde ses paragraphes
  assert.equal(etatDuTexte({ creee: true, apercu: null, ligne: { corps_md: 'À écrire.' } }, 1), 'vivant');
  assert.equal(etatDuTexte({ creee: true, apercu: null, ligne: { corps_md: deux } }, 1), null);
  assert.equal(etatDuTexte({ creee: true, apercu: ['<p>Écrit.</p>'], ligne: { corps_md: 'Écrit.' } }, 1), 'apercu', 'une page créée puis écrite : l’aperçu');
});
