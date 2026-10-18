// Éditeur visuel du guide (lib/markdown-edition.mjs, couleur des cases : lib/markdown-couleurs.mjs) : le HTML d'une page, réécrit en Markdown, doit
// redonner le même rendu. Aller-retour Markdown → HTML → Markdown → HTML sur toutes les pages du guide et du Codex, avec les plugins du site ([[liens]], couleurs) ;
// puis les écritures propres à l'éditeur (liens, couleurs, échappements, listes, tableaux) et le découpage du corps aux blocs tirés de la base ; enfin le
// même aller-retour sur tous les blocs des panneaux de règles (migration 0056), balises du glossaire comprises.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';
import { avecPhraseDesArmesDeDepart } from '../src/lib/armes-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { COULEURS_DE_CASE, decouperCorps, htmlSur, recomposerCorps, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { fragmentsAjoutes } from '../src/lib/markdown-sur.mjs';
import { texteDePageModifiable } from '../src/lib/edition-modele.mjs';
import { htmlAvecMotsCles, lireBalises } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { chargerPanneaux } from '../src/lib/panneaux-regles-db.mjs';
// le processeur Markdown du site et la lecture du HTML comme le ferait le navigateur (hast-util-from-html, dépendance de @astrojs/markdown-remark)
import { DOSSIER_DU_WIKI as dossier, enfantsDuHtml as enfants, normal, rendreCommeLeGuide, rendreLeMarkdown as rendre } from './aide-rendu-du-site.mjs';

const aller = async (md) => versMarkdown(enfants(await rendre(md)));

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
    // une page du guide est rendue comme au build (lib/guide-rendu.ts : anciennes adresses du guide menées à leur page du plan)
    const rendrePage = page.type === 'guide' ? rendreCommeLeGuide : rendre;
    for (const m of decouperCorps(page.corps)) {
      if (!m.visible) continue;
      morceaux++;
      const html = await rendrePage(m.texte);
      const md = versMarkdown(enfants(html));
      assert.equal(normal(await rendrePage(md)), normal(html), `${page.id} :\n${md}`);
      assert.equal(versMarkdown(enfants(await rendrePage(md))), md, `${page.id} : le Markdown réécrit est stable`);
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

test('liens du guide écrits vers une ancienne adresse (/guide/<slug>/) : rendus vers la page du plan, relus tels qu’écrits — modifier la page ne les réécrit pas', async () => {
  const pages = pagesModifiables.filter((p) => p.type === 'guide' && /\]\(\/guide\//.test(p.corps));
  const liens = pages.flatMap((p) => [...p.corps.matchAll(/\]\((\/guide\/[^)\s]*)\)/g)].map((m) => ({ id: p.id, ecrit: m[1] })));
  // ceux de la base aujourd'hui : neuf liens sur huit pages (les livres « Découvrir » et « Les bases »)
  assert.ok(liens.length >= 9, `${liens.length} liens`);
  for (const base of ['/', '/MaverickCenter/']) {
    const lienRelatif = (h) => (base !== '/' && h.startsWith(base) ? `/${h.slice(base.length)}` : h);
    for (const page of pages) {
      const corps = decouperCorps(page.corps);
      const visibles = corps.filter((m) => m.visible);
      const modifies = [];
      for (const m of visibles) {
        if (!/\]\(\/guide\//.test(m.texte)) {
          modifies.push(null);
          continue;
        }
        const html = await rendreCommeLeGuide(m.texte, base);
        // le lien mène à la page du plan (aucun lien du site construit ne mène à /guide/), l'adresse écrite gardée à côté
        assert.doesNotMatch(html, new RegExp(`href="${base}guide/`), `${page.id} : un lien mène encore à /guide/`);
        for (const [, ecrit] of m.texte.matchAll(/\]\((\/guide\/[^)\s]*)\)/g)) {
          assert.ok(html.includes(`data-lien-ecrit="${ecrit}"`), `${page.id} : ${ecrit} n’est pas gardé (${base})`);
        }
        // relu par l'éditeur (et par l'aperçu assaini : une seconde modification avant le build), le Markdown redonne les adresses écrites
        const md = versMarkdown(enfants(html), { lienRelatif });
        assert.equal(md.trim(), m.texte.trim().replace(/\n{3,}/g, '\n\n'), `${page.id} : le morceau relu n’est plus celui de la base`);
        assert.equal(versMarkdown(enfants(htmlSur(enfants(html))), { lienRelatif }), md, `${page.id} : aperçu assaini`);
        // un mot ajouté au morceau : la page enregistrée garde ses liens tels qu'écrits (le service reçoit le corps refait : recomposerCorps)
        modifies.push(md.replace(/\n$/, ' Ajouté.\n'));
      }
      const enregistre = recomposerCorps(page.corps, modifies);
      assert.notEqual(enregistre, page.corps);
      assert.deepEqual([...enregistre.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]), [...page.corps.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]),
        `${page.id} : les adresses des liens ont changé à l’enregistrement`);
    }
  }
  // un lien dont l'adresse a été changée dans l'éditeur (edition/texte-en-place.mjs#lienWeb retire data-lien-ecrit) : la nouvelle adresse
  assert.equal(versMarkdown(enfants('<p>Voir <a href="/races/">les races</a>.</p>')), 'Voir [les races](/races/).\n');
  // une adresse écrite qui ne serait pas une adresse du site depuis sa racine n'est pas relue (ni gardée par l'aperçu) : celle du lien
  assert.equal(versMarkdown(enfants('<p><a href="/regles/" data-lien-ecrit="javascript:alert(1)">x</a></p>')), '[x](/regles/)\n');
  assert.doesNotMatch(htmlSur(enfants('<p><a href="/regles/" data-lien-ecrit="//ailleurs.example/">x</a></p>')), /data-lien-ecrit/);
  // les autres liens, au rendu du guide, ne portent rien de plus
  assert.doesNotMatch(await rendreCommeLeGuide('[les races](/races/) et [[Humain]]'), /data-lien-ecrit/);
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

test('une monnaie en icône, un montant décomposé (lib/markdown-monnaies.mjs) redeviennent tels qu’écrits ; l’aperçu assaini les garde', async () => {
  const md = 'Une corde vaut 1245,5 RO, payable en RF.\n\n| Objet | Prix | Coût(RO) |\n| --- | --- | --- |\n| Corde | 10 Ro / 1 000 RF | 100 + 1 Matériau |';
  const html = await rendre(md);
  assert.match(html, /class="piece piece--pp"/);
  assert.match(html, /class="montant" data-montant="1245,5 RO"/);
  assert.equal((await aller(md)).trim(), md);
  const sur = htmlSur(enfants(html));
  assert.match(sur, /<span[^>]* class="montant" data-montant="10 Ro \/ 1 000 RF">/);
  assert.match(sur, /<span[^>]* class="piece piece--rf" role="img"[^>]* data-monnaie="RF"><\/span>/);
  assert.ok(!/<span[^>]*(piece|montant)[^>]*(onerror|style)=/.test(sur));
  assert.equal(versMarkdown(enfants(sur)).trim(), md, 'l’aperçu assaini se relit aussi');
});

// Le glossaire des mots-clés (migration 0056, lib/mots-cles-balises.mjs) : le HTML de la page porte les mots-clés rendus par le middleware ; l'éditeur
// les relit en balises (ni « **gras** » ni texte simple), le mode complet en « {{id:}} ».
const GLOSSAIRE = [
  { id: 'recharge-longue', libelle: 'Recharge longue', description: 'Doit utiliser son action ou son mouvement pour recharger.' },
  { id: 'non-mort', libelle: 'Non-mort', description: 'Une créature revenue de la mort.' },
  { id: 'mordhau', libelle: 'Mordhau', description: '' },
];
/** Le HTML de la page : le Markdown rendu (processeur du site), puis les mots-clés (src/middleware.mjs). */
const rendreLaPage = async (md) => htmlAvecMotsCles(await rendre(md), GLOSSAIRE).html;

test('mots-clés du glossaire : l’aller-retour garde les balises (texte écrit, libellé, mode complet, case de tableau avec « \\| ») et le rendu', async () => {
  const md = [
    'Une arme à {{recharge-longue|Recharge longue}} contre les {{non-mort|non-morts}}, et {{mordhau|Mordhau}}.',
    '{{recharge-longue:}}',
    '| Arme | Effet |\n| --- | --- |\n| Arbalète | {{recharge-longue\\|Recharge longue}} |',
  ].join('\n\n');
  const html = await rendreLaPage(md);
  assert.match(html, /<strong class="mot-cle" data-mot-cle="non-mort"[^>]*data-balise="\{\{non-mort\|non-morts\}\}">non-morts<\/strong>/);
  assert.match(html, /<td><strong class="mot-cle" data-mot-cle="recharge-longue"/, 'dans la case : un mot-clé, pas deux cases');
  const relu = versMarkdown(enfants(html));
  assert.equal(relu.trim(), md);
  assert.equal(normal(await rendreLaPage(relu)), normal(html));
});

test('mots-clés du glossaire : un texte changé dans l’éditeur s’écrit « {{id|texte}} » ; vidé, rien ; une balise sans texte écrit garde le libellé affiché', async () => {
  const html = await rendreLaPage('Voir {{non-mort}} et {{Recharge longue}}.');
  assert.equal(versMarkdown(enfants(html)), 'Voir {{non-mort|Non-mort}} et {{recharge-longue|Recharge longue}}.\n', 'la forme canonique, que le service enregistrerait');
  const change = html.replace('>Non-mort</strong>', '>morts-vivants</strong>').replace('>Recharge longue</strong>', '></strong>');
  assert.equal(versMarkdown(enfants(change)), 'Voir {{non-mort|morts-vivants}} et .\n');
  // gras ordinaire et mot-clé côte à côte
  assert.equal(versMarkdown(enfants('<p><strong>gras</strong> <strong class="mot-cle" data-mot-cle="non-mort" data-balise="{{non-mort|a*b}}">a*b</strong></p>')),
    '**gras** {{non-mort|a\\*b}}\n', 'le texte d’une balise échappé comme le reste du Markdown');
});

test('aperçu assaini : un mot-clé et le mode complet gardent leurs classes, leur id, leur balise et leur bulle ; rien d’autre', async () => {
  const html = await rendreLaPage('{{non-mort|morts}} et {{recharge-longue:}}');
  const piege = html.replace('<strong class="mot-cle"', '<strong onclick="x()" style="color:red" class="mot-cle"');
  const sur = htmlSur(enfants(piege));
  assert.match(sur, /<strong class="mot-cle" data-mot-cle="non-mort" data-bulle="mot-cle-non-mort" aria-describedby="mot-cle-non-mort" tabindex="0" data-balise="\{\{non-mort\|morts\}\}">morts<\/strong>/);
  assert.match(sur, /<span class="mot-cle-definition" data-mot-cle="recharge-longue" data-balise="\{\{recharge-longue:\}\}"><strong class="mot-cle-definition__nom">Recharge longue<\/strong>/);
  assert.ok(!/onclick|style=/.test(sur));
  assert.equal(versMarkdown(enfants(sur)), '{{non-mort|morts}} et {{recharge-longue:}}\n', 'l’aperçu assaini se relit aussi');
  assert.doesNotMatch(htmlSur(enfants('<strong class="mot-cle" data-mot-cle="X Y" data-balise="{{x}}">t</strong>')), /data-mot-cle/, 'un id qui n’en est pas un');
});

// Les panneaux de règles (migration 0056) : le texte de chaque bloc se modifie en place (src/scripts/edition/panneaux.mjs, même éditeur que la
// chronologie) ; le HTML de la page = le Markdown du bloc rendu au build (lib/guide-rendu.ts#rendreMarkdown : mêmes plugins), « Les armes en bleu… »
// retouché (avecPhraseDesArmesDeDepart), puis les balises du glossaire (le middleware). L'extension compare le Markdown relu à celui relu au départ,
// jamais au texte de la base (test/edition-panneaux.test.mjs) : ce test épingle qu'ils diffèrent pour certains blocs (espaces doublés, retours forcés).
test('aller-retour sur tous les blocs des panneaux de règles : le HTML ne change pas, les balises du glossaire reviennent en balises (pas en définition), rien d’ajouté', async () => {
  const db = ouvrirBase({ sansExemples: false });
  const vocabulaire = chargerVocabulaire(db);
  const blocs = chargerPanneaux(db).flatMap((p) => p.blocs.map((b) => ({ ...b, retouche: p.id === 'armes' ? avecPhraseDesArmesDeDepart : (h) => h })));
  assert.ok(blocs.length >= 13, `${blocs.length} blocs`);
  const page = async (b, md) => htmlAvecMotsCles(b.retouche(await rendre(md)), vocabulaire).html;
  let differents = 0;
  for (const b of blocs) {
    const quoi = `${b.panneau_id}#${b.rang}`;
    const html = await page(b, b.texte);
    const md = versMarkdown(enfants(html));
    assert.equal(normal(await page(b, md)), normal(html), `${quoi} : le HTML ne change pas\n${md}`);
    assert.equal(versMarkdown(enfants(await page(b, md))), md, `${quoi} : le Markdown réécrit est stable`);
    // les balises du glossaire : les mêmes, au même endroit du texte (une tuile qui n'est qu'une balise en mode complet le reste)
    assert.deepEqual(lireBalises(md).map((x) => x.brut), lireBalises(b.texte).map((x) => x.brut), `${quoi} : balises`);
    if (/^\{\{[^{}]+:\}\}$/.test(b.texte.trim())) assert.equal(md.trim(), b.texte.trim(), `${quoi} : la balise en mode complet, pas sa définition`);
    for (const m of vocabulaire.filter((v) => v.description)) {
      if (!b.texte.includes(m.description)) assert.ok(!md.includes(m.description), `${quoi} : la définition de « ${m.libelle} » n’est pas recopiée`);
    }
    assert.deepEqual(fragmentsAjoutes(b.texte, md), [], `${quoi} : rien que le service refuserait`);
    if (md.trim() !== b.texte.trim()) differents += 1;
  }
  assert.ok(blocs.some((b) => /^\{\{[^{}]+:\}\}$/.test(b.texte.trim())), 'au moins une tuile qui n’est qu’une balise en mode complet');
  assert.ok(differents > 0, 'au moins un bloc dont le Markdown relu n’est pas le texte de la base (comparer au texte de la base ferait un faux changement)');
});
