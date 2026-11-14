// Les groupes d'onglets d'un texte Markdown (lib/onglets-groupe.mjs, lib/markdown-onglets.mjs) et les couleurs écrites (lib/couleurs-ecrites.mjs) ; décision R277 (docs/decisions-regles.md), demande du propriétaire :
// « La page des alignements a perdu le tableau et les onglets […] Cette fois tu auras 2 tableaux. Un après les "Les Quatre Tendances" qui est un tableau à 4 onglets […]
// Le 2em tableau avec les 9 onglets », « de manière à pouvoir faire manuellement ce genre de tableau et d'onglet », « Pour les couleurs il faudra reprendre la liste des
// couleurs de l'édition des mots clés du glossaire ». Le rendu (la chaîne du build, test/aide-rendu-du-site.mjs), la disposition de la barre, les couleurs (les sept noms
// d'avant et toute valeur du glossaire), l'aller-retour de l'éditeur (HTML → Markdown, aperçu assaini compris) et ce que lisent la recherche et les notes de version.
// Des textes d'essai : aucune page de la base n'est lue (le site de dev les écrit). Les outils du DOM (scripts/edition/onglets.mjs : sélection, Range) sont éprouvés dans un navigateur.
//   node --test test/onglets-markdown.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ancreDuTitre, ancresRompues, sansAncresFigees } from '../src/lib/ancres-figees.mjs';
import { classeDeLaCouleurEcrite, classesDeCase, COULEURS_DE_CASE, lireLaCouleurEcrite, marqueDeLaCouleur, separerLaCouleur } from '../src/lib/couleurs-ecrites.mjs';
import { htmlSur, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { sansMarquesDOnglets } from '../src/lib/markdown-onglets.mjs';
import { premiersMots } from '../src/lib/notes-de-version.mjs';
import { classesDeLaPalette, cssDesCouleursEcrites } from '../src/lib/palette-css.mjs';
import { colonnesDeLaBarre, htmlDuGroupe } from '../src/lib/onglets-groupe.mjs';
import { fragmentsAjoutes } from '../src/lib/markdown-sur.mjs';
import { attendre, el, fauxDocument } from './aide-faux-dom.mjs';
import { enfantsDuHtml as enfants, normal, rendreCommeLeGuide, rendreLeMarkdown } from './aide-rendu-du-site.mjs';

const TEXTE = `Introduction.

::: onglets

Avant la barre.

### {couleur:alignement:loyal-bon} {{loyal-bon}} {#loyal-bon}

Premier **texte**.

| A | B |
| --- | --- |
| {couleur:#c0392b} x | {couleur:magie:feu} y |

#### Sous-titre

Suite.

### Loyal {#loyal}

Deuxième texte.

### {couleur:rouge} Chaotique

Troisième.

:::

Fin.
`;

const classes = (html, motif) => [...html.matchAll(motif)].map((m) => m[1].split(/\s+/));

// --- La disposition de la barre ---------------------------------------------------------------------------------------------------------------------

test('R277 (4) colonnesDeLaBarre : une colonne par onglet jusqu’à 4 (les quatre tendances : une rangée de 4), puis 3 si multiple de 3 (les neuf alignements : 3×3), sinon 4', () => {
  assert.deepEqual([1, 2, 3, 4].map(colonnesDeLaBarre), [1, 2, 3, 4]);
  assert.equal(colonnesDeLaBarre(9), 3);
  assert.equal(colonnesDeLaBarre(6), 3);
  assert.equal(colonnesDeLaBarre(12), 3);
  assert.deepEqual([5, 7, 8, 10, 11].map(colonnesDeLaBarre), [4, 4, 4, 4, 4]);
  assert.equal(colonnesDeLaBarre(0), 1, 'jamais zéro colonne');
});

// --- Le rendu ---------------------------------------------------------------------------------------------------------------------------------------

test('R277 (5) un groupe `::: onglets` : une barre et un panneau par `###`, dans l’ordre du texte, le premier ouvert ; le texte avant la barre y reste, le reste du texte autour', async () => {
  for (const rendre of [rendreLeMarkdown, rendreCommeLeGuide]) {
    const html = await rendre(TEXTE);
    assert.equal((html.match(/data-onglets-md/g) ?? []).length, 1);
    assert.ok(html.indexOf('Introduction.') < html.indexOf('data-onglets-md') && html.indexOf('data-onglets-md') < html.indexOf('Avant la barre.'));
    assert.ok(html.indexOf('Avant la barre.') < html.indexOf('<nav class="onglets-md__liste"'), 'le texte d’avant reste au-dessus de la barre');
    assert.ok(html.lastIndexOf('</section>') < html.indexOf('Fin.'), 'la suite du texte après le groupe');
    assert.doesNotMatch(html, /:::/, 'aucune ligne de marque affichée');
    const onglets = [...html.matchAll(/<a class="([^"]*)" id="onglet-([^"]+)" href="#([^"]+)">([^<]*)<\/a>/g)];
    assert.deepEqual(onglets.map((o) => o[3]), ['loyal-bon', 'loyal', 'onglet-chaotique'], 'un onglet par ###, l’ancre figée ou le slug du texte');
    assert.deepEqual(onglets.map((o) => o[4]), ['{{loyal-bon}}', 'Loyal', 'Chaotique'], 'le nom de l’onglet est le texte de son intertitre, sans la marque de couleur ni l’ancre');
    assert.deepEqual(onglets.map((o) => o[1].split(/\s+/).includes('is-active')), [true, false, false], 'le premier est ouvert');
    assert.ok(onglets.every((o) => o[1].split(/\s+/).includes('onglet')), 'la classe que le script des onglets prend');
    const panneaux = [...html.matchAll(/<section class="([^"]*)" id="([^"]+)"/g)];
    assert.deepEqual(panneaux.map((p) => p[2]), ['loyal-bon', 'loyal', 'onglet-chaotique'], 'l’ancre figée est l’id du panneau');
    // l'intertitre garde son ancre pour l'éditeur et prend un id à lui (un id n'est qu'une fois dans la page)
    assert.match(html, /<h3 id="titre-loyal-bon" data-ancre-figee="loyal-bon">/);
    assert.equal(html.split('id="loyal-bon"').length - 1, 1);
    assert.match(html, /<nav class="onglets-md__liste" data-colonnes="3" data-ed-ignorer="" contenteditable="false">/);
  }
});

test('R277 (2, 3) la couleur d’un onglet : la classe de la palette sur son lien et son panneau, `data-couleur` ; sans couleur, aucune classe (onglet neutre) ; jamais un style', async () => {
  const html = await rendreLeMarkdown(TEXTE);
  const [premier, deuxieme, troisieme] = classes(html, /<a class="([^"]*)" id="onglet-/g);
  assert.ok(premier.includes('couleur-alignement-loyal-bon'));
  assert.deepEqual(deuxieme.filter((c) => c.startsWith('couleur-')), [], 'sans couleur : neutre');
  assert.ok(troisieme.includes('couleur-case-rouge'), 'un des sept noms d’avant');
  const panneaux = classes(html, /<section class="([^"]*)" id=/g);
  assert.ok(panneaux[0].includes('couleur-alignement-loyal-bon') && panneaux[2].includes('couleur-case-rouge'));
  assert.match(html, /<section class="[^"]*" id="loyal-bon" data-couleur="alignement:loyal-bon">/);
  assert.doesNotMatch(html, /<section class="[^"]*" id="loyal" data-couleur/);
  assert.doesNotMatch(html, /style=/);
});

test('un groupe mal formé reste tel qu’écrit : sans `###`, sans ligne `:::` de fin, dans un bloc de code, ou dans une citation', async () => {
  for (const md of ['::: onglets\n\nTexte seul.\n\n:::\n', '::: onglets\n\n### Un\n\nTexte.\n', '```\n::: onglets\n\n### Un\n\n:::\n```\n', '> ::: onglets\n>\n> ### Un\n>\n> :::\n']) {
    const html = await rendreLeMarkdown(md);
    assert.doesNotMatch(html, /data-onglets-md/, md);
  }
  assert.match(await rendreLeMarkdown('::: onglets\n\nTexte seul.\n\n:::\n'), /::: onglets/, 'rien n’est perdu : les lignes de marque s’affichent');
});

test('un id déjà pris reçoit « -2 », « -3 » (jamais un slug rappelé : « onglet-un-1-2 ») ; ids toujours uniques dans le texte', async () => {
  const html = await rendreLeMarkdown('::: onglets\n\n### Un {#onglet-un}\n\na\n\n### Un\n\nb\n\n### Un\n\nc\n\n### Autre {#autre}\n\nd\n\n### Autre 2 {#autre}\n\ne\n\n:::\n');
  const ids = [...html.matchAll(/<section class="[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['onglet-un', 'onglet-un-2', 'onglet-un-1', 'autre', 'autre-2']);
  assert.equal(new Set(ids).size, ids.length);
});

test('deux groupes dans un texte, des ids toujours uniques ; un `###` du contenu écrit par l’éditeur en `####` ne fait pas un onglet de plus', async () => {
  const md = '::: onglets\n\n### Un\n\na\n\n### Deux\n\nb\n\n:::\n\n::: onglets\n\n### Un\n\nc\n\n:::\n';
  const html = await rendreLeMarkdown(md);
  assert.equal((html.match(/data-onglets-md/g) ?? []).length, 2);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `ids uniques : ${ids}`);
});

// --- Les couleurs écrites ---------------------------------------------------------------------------------------------------------------------------

test('R277 (2) couleurs-ecrites : les sept noms d’avant, une référence « famille:id » ou « #rrggbb » (en minuscules) ; le reste n’est pas lu ; la marque de tête se sépare du texte', () => {
  assert.deepEqual(COULEURS_DE_CASE, ['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'gris']);
  for (const nom of COULEURS_DE_CASE) assert.equal(classeDeLaCouleurEcrite(nom), `couleur-case-${nom}`);
  assert.equal(classeDeLaCouleurEcrite('alignement:loyal-bon'), 'couleur-alignement-loyal-bon');
  assert.equal(classeDeLaCouleurEcrite('#C0392B'), 'couleur-ecrite-c0392b');
  assert.equal(lireLaCouleurEcrite('#C0392B').valeur, '#c0392b');
  for (const inconnue of ['fuchsia', '#abc', '#12345g', 'a:', ':b', 'Alignement:x', '', null, undefined, 3]) assert.equal(lireLaCouleurEcrite(inconnue), null, String(inconnue));
  assert.equal(marqueDeLaCouleur('vert'), '{couleur:vert}');
  assert.equal(marqueDeLaCouleur('fuchsia'), '');
  assert.deepEqual(separerLaCouleur('{couleur:magie:feu} Texte'), { texte: 'Texte', couleur: 'magie:feu' });
  assert.deepEqual(separerLaCouleur('{couleur:fuchsia} Texte'), { texte: '{couleur:fuchsia} Texte', couleur: null });
  assert.deepEqual(separerLaCouleur('Texte {couleur:vert}'), { texte: 'Texte {couleur:vert}', couleur: null }, 'seulement en tête');
  assert.deepEqual(classesDeCase('vert'), ['case-coloree', 'couleur-case-vert']);
  assert.deepEqual(classesDeCase('fuchsia'), []);
});

test('R277 (2, 5) la couleur d’une case : les sept noms d’avant (données existantes) et toute valeur du glossaire, rendues avec `data-couleur` et les classes, relues telles qu’écrites', async () => {
  const md = '| A | B | C |\n| --- | --- | --- |\n| {couleur:vert} un | {couleur:magie:feu} deux | {couleur:#C0392B} trois |\n| {couleur:fuchsia} quatre | {couleur:rouge} | cinq |\n';
  const html = await rendreLeMarkdown(md);
  assert.match(html, /<td data-couleur="vert" class="case-coloree couleur-case-vert">un<\/td>/);
  assert.match(html, /<td data-couleur="magie:feu" class="case-coloree couleur-magie-feu">deux<\/td>/);
  assert.match(html, /<td data-couleur="#c0392b" class="case-coloree couleur-ecrite-c0392b">trois<\/td>/);
  assert.match(html, /<td>\{couleur:fuchsia\} quatre<\/td>/, 'une valeur illisible reste du texte');
  // relu : « #rrggbb » en minuscules, le reste tel quel
  const relu = versMarkdown(enfants(html));
  assert.equal(relu, '| A | B | C |\n| --- | --- | --- |\n| {couleur:vert} un | {couleur:magie:feu} deux | {couleur:#c0392b} trois |\n| {couleur:fuchsia} quatre | {couleur:rouge} | cinq |\n');
  assert.equal(normal(await rendreLeMarkdown(relu)), normal(html), 'le rendu ne change pas');
  // l'aperçu assaini : la classe recalculée depuis la valeur, jamais celle reçue
  const td = (attributs) => [{ type: 'element', nom: 'table', attributs: {}, enfants: [{ type: 'element', nom: 'tr', attributs: {}, enfants: [{ type: 'element', nom: 'td', attributs, enfants: [{ type: 'texte', valeur: 'x' }] }] }] }];
  assert.equal(htmlSur(td({ 'data-couleur': 'alignement:neutre', class: 'couleur-case-rouge' })), '<table><tr><td data-couleur="alignement:neutre" class="case-coloree couleur-alignement-neutre">x</td></tr></table>');
  assert.equal(htmlSur(td({ 'data-couleur': 'rouge; background:red' })), '<table><tr><td>x</td></tr></table>');
});

test('la feuille des couleurs écrites : la règle d’une famille d’une zone et d’une couleur écrite ; rien pour une famille de chaque page, un nom d’avant ou une référence inconnue', () => {
  const css = cssDesCouleursEcrites(['alignement:loyal-bon', '#C0392B', 'vert', 'magie:feu', 'alignement:inexistant', 'zzz:x', '#C0392B']);
  assert.match(css, /^\.couleur-ecrite-c0392b\{--couleur:#[0-9a-f]{6};--couleur-texte:#[0-9a-f]{6}\}\.couleur-alignement-loyal-bon\{--couleur:#[0-9a-f]{6};--couleur-texte:#[0-9a-f]{6}\}$|^\.couleur-alignement-loyal-bon\{[^}]*\}\.couleur-ecrite-c0392b\{[^}]*\}$/);
  assert.equal((css.match(/\{/g) ?? []).length, 2, 'une règle par classe, sans doublon');
  for (const classe of ['couleur-case-vert', 'couleur-magie-feu']) assert.ok(classesDeLaPalette().has(classe), `${classe} : déjà sur chaque page`);
  assert.equal(cssDesCouleursEcrites(['vert', 'magie:feu', null, undefined, 'fuchsia']), '');
});

// --- L'éditeur : HTML → Markdown --------------------------------------------------------------------------------------------------------------------

test('R277 (5) aller-retour de l’éditeur : le Markdown du groupe (marque de couleur, ancre figée, `::: onglets`) est relu sans perte, du rendu comme de l’aperçu assaini', async () => {
  for (const rendre of [rendreLeMarkdown, rendreCommeLeGuide]) {
    const html = await rendre(TEXTE);
    const attendu = TEXTE;
    const md = versMarkdown(enfants(html));
    assert.equal(md.trim(), attendu.trim());
    assert.equal(normal(await rendre(md)), normal(html), 'le rendu du Markdown relu est le même');
    const apercu = htmlSur(enfants(html));
    assert.match(apercu, /<nav class="onglets-md__liste" data-colonnes="3" data-ed-ignorer contenteditable="false">/, 'l’aperçu garde sa barre');
    assert.equal(versMarkdown(enfants(apercu)).trim(), attendu.trim(), 'l’aperçu assaini redonne le même Markdown');
    assert.equal(versMarkdown(enfants(htmlSur(enfants(apercu)))).trim(), attendu.trim(), 'stable à la deuxième passe');
    assert.deepEqual(fragmentsAjoutes(TEXTE, md), [], 'ni HTML brut ni lien non sûr ajouté');
    assert.deepEqual(ancresRompues(TEXTE, md), { retirees: [], doublees: [] }, 'ancres figées gardées');
  }
});

test('l’éditeur : la barre est refaite d’après les panneaux (elle est ignorée de la relecture), la couleur d’un panneau devient la marque, un panneau sans intertitre reprend le texte de sa barre, un `###` du contenu s’écrit `####`', () => {
  const t = (valeur) => ({ type: 'texte', valeur });
  const e = (nom, attributs, ...enfantsDe) => ({ type: 'element', nom, attributs, enfants: enfantsDe });
  const groupe = (...panneaux) => e('div', { class: 'onglets-md', 'data-onglets-md': '' },
    e('nav', { class: 'onglets-md__liste', 'data-ed-ignorer': '' }, e('a', { href: '#a', class: 'onglet' }, t('Texte périmé de la barre')), e('a', { href: '#b', class: 'onglet' }, t('Nom de la barre'))),
    ...panneaux);
  // couleur changée (data-couleur) et intertitre renommé : la relecture ne lit que les panneaux
  assert.equal(versMarkdown([groupe(
    e('section', { id: 'a', 'data-couleur': 'alignement:neutre' }, e('h3', { 'data-ancre-figee': 'a' }, t('Renommé')), e('p', {}, t('Un.'))),
    e('section', { id: 'b' }, e('h3', {}, t('Deux')), e('h3', {}, t('Un sous-titre')), e('p', {}, t('Deux.'))),
  )]), '::: onglets\n\n### {couleur:alignement:neutre} Renommé {#a}\n\nUn.\n\n### Deux\n\n#### Un sous-titre\n\nDeux.\n\n:::\n');
  // un panneau dont l'intertitre a disparu : le texte de sa barre
  assert.equal(versMarkdown([groupe(e('section', { id: 'b', 'data-couleur': '#ABCDEF' }, e('p', {}, t('Texte.'))))]), '::: onglets\n\n### {couleur:#abcdef} Nom de la barre\n\nTexte.\n\n:::\n');
  // une couleur illisible ne s'écrit pas
  assert.equal(versMarkdown([groupe(e('section', { id: 'a', 'data-couleur': 'fuchsia' }, e('h3', {}, t('Un')), e('p', {}, t('x'))))]), '::: onglets\n\n### Un\n\nx\n\n:::\n');
});

test('htmlDuGroupe (aperçu de l’éditeur) est le HTML que le plugin remark pose dans le rendu du build', async () => {
  const md = '::: onglets\n\n### {couleur:vert} Un {#un}\n\na\n\n### Deux\n\nb\n\n:::\n';
  const rendu = await rendreLeMarkdown(md);
  const attendu = htmlDuGroupe({
    onglets: [
      { id: 'un', titre: 'Un', couleur: 'vert', classe: 'couleur-case-vert', html: '<h3 id="titre-un" data-ancre-figee="un">Un</h3>\n<p>a</p>' },
      { id: 'onglet-deux', titre: 'Deux', couleur: null, classe: null, html: '<h3 id="titre-onglet-deux">Deux</h3>\n<p>b</p>' },
    ],
  });
  const sansAttributsVides = (h) => normal(h).replace(/=""/g, '');
  assert.equal(sansAttributsVides(rendu), sansAttributsVides(attendu));
});

// --- Ce que lisent la recherche, les ancres et les notes de version -------------------------------------------------------------------------------------

test('la marque de couleur et les lignes de marque ne sont jamais du texte cherché ni le nom d’un intertitre', () => {
  assert.deepEqual(ancreDuTitre('### {couleur:alignement:loyal-bon} {{loyal-bon}} {#loyal-bon}'), { niveau: 3, texte: '{{loyal-bon}}', ancre: 'loyal-bon' });
  assert.equal(sansAncresFigees('### {couleur:vert} Chaotique\n\n### {couleur:#abcdef} Loyal {#loyal}\n\n```\n### {couleur:vert} code\n```').trim(), '### Chaotique\n\n### Loyal\n\n```\n### {couleur:vert} code\n```');
  assert.equal(sansMarquesDOnglets('a\n\n::: onglets\n\n### T\n\n:::\n\n```\n:::\n```\nb'), 'a\n\n\n### T\n\n\n```\n:::\n```\nb');
  assert.equal(premiersMots('{couleur:alignement:loyal-bon} Loyal bon {couleur:#abcdef} gris'), 'Loyal bon gris');
});

test('le plugin des onglets est déclaré après les ancres figées dans chaque chaîne Markdown du site, qui doivent rester d’accord', () => {
  for (const fichier of ['../astro.config.mjs', '../src/lib/guide-rendu.ts', '../src/lib/chronologie-rendu.mjs', '../src/lib/markdown-rendu.mjs', './aide-rendu-du-site.mjs']) {
    const source = readFileSync(new URL(fichier, import.meta.url), 'utf8');
    assert.match(source, /import \{ remarkOnglets \} from '[./a-z-]*markdown-onglets\.mjs'/, `${fichier} : importé`);
    const i = source.indexOf('remarkAncresFigees,');
    assert.ok(i > 0 && source.indexOf('remarkOnglets', i) > i, `${fichier} : après remarkAncresFigees`);
  }
});

// --- Le choix de couleur des barres d'outils (scripts/edition/couleurs.mjs) -------------------------------------------------------------------------------

test('le choix de couleur d’une barre : la liste des couleurs du site lue une fois (/couleurs-du-site.json), le contrôle de l’éditeur (ed.champ) posé dans le groupe, la couleur choisie appliquée et sa règle ajoutée à la page', async () => {
  const groupe = el('div', { role: 'group' });
  const document = fauxDocument(groupe);
  const lectures = [];
  const liste = [{ famille: 'alignement', libelle: 'Alignements', couleurs: [{ valeur: 'alignement:loyal-bon', libelle: 'Loyal Bon', classe: 'couleur-alignement-loyal-bon', fond: '#4e8794' }] }];
  Object.assign(globalThis, { document, fetch: async (adresse) => (lectures.push(adresse), { ok: true, json: async () => liste }) });
  const champs = [];
  const ed = {
    base: '/site/',
    annoncer: () => {},
    champ: (c) => {
      const element = el('span', {});
      champs.push({ c, element });
      return { element, lire: () => element.valeur ?? '' };
    },
  };
  const { ajouterLeChoixDeCouleur } = await import('../src/scripts/edition/couleurs.mjs?essai');
  const appliquees = [];
  ajouterLeChoixDeCouleur(ed, groupe, { etiquette: 'Onglet :', libelle: 'Couleur de l’onglet', lire: () => '', appliquer: (v) => appliquees.push(v), signal: undefined });
  ajouterLeChoixDeCouleur(ed, groupe, { etiquette: 'Case :', libelle: 'Couleur de la case', lire: () => '', appliquer: (v) => appliquees.push(v), signal: undefined });
  await attendre();
  await attendre();
  assert.deepEqual(lectures, ['/site/couleurs-du-site.json'], 'la liste, lue une fois pour les deux contrôles');
  assert.equal(champs.length, 2);
  assert.ok(champs.every(({ c }) => c.type === 'couleur' && c.choix === liste), 'le contrôle du glossaire (type couleur), la liste du site');
  assert.ok(groupe.querySelectorAll('span').length >= 2, 'les contrôles sont dans le groupe');
  // une couleur du site choisie : appliquée, avec sa règle dans la feuille de la page ; une couleur retirée : '' appliqué
  champs[0].element.valeur = 'alignement:loyal-bon';
  champs[0].element.dispatchEvent(new Event('input'));
  champs[1].element.valeur = '';
  champs[1].element.dispatchEvent(new Event('input'));
  assert.deepEqual(appliquees, ['alignement:loyal-bon', '']);
  const feuille = document.querySelector('style[data-couleurs-texte]');
  assert.ok(feuille && feuille.textContent.includes('.couleur-alignement-loyal-bon{--couleur:'), 'la règle de la classe posée sur la page');
  assert.doesNotMatch(feuille.textContent, /couleur-case/);
});
