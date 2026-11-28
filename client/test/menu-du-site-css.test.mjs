// La feuille du menu latéral du site (styles/global/menu-site.css, avec les variables du logo de styles/global/site-shell.css ; R319 (2)) : le bouton de la bande réduite est
// sous la pointe de l'épée du logo, calculée depuis la taille du logo affiché ; largeur animée, dépliage par grid-template-rows 0fr/1fr, pas d'animation sans
// `[data-anime]` ni sous prefers-reduced-motion ; aucune retenue de la molette (skill ui-defilement).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const lire = (rel) => readFileSync(new URL(rel, import.meta.url));
const css = (rel) => lire(rel).toString('utf8');
const menu = css('../src/styles/global/menu-site.css');
const coque = css('../src/styles/global/site-shell.css');

/** La largeur et la hauteur d'un WebP (VP8, VP8L ou VP8X). */
function tailleWebp(octets) {
  assert.equal(octets.toString('latin1', 0, 4), 'RIFF');
  assert.equal(octets.toString('latin1', 8, 12), 'WEBP');
  const type = octets.toString('latin1', 12, 16);
  if (type === 'VP8X') return [1 + octets.readUIntLE(24, 3), 1 + octets.readUIntLE(27, 3)];
  if (type === 'VP8L') { const b = octets.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return [octets.readUInt16LE(26) & 0x3fff, octets.readUInt16LE(28) & 0x3fff];
}

test('R319 (2), R317 (3) : l’en-tête garde la place d’origine (aligné sur le texte, le compte déborde à droite), dans la même colonne que la page (à droite du menu, suivant sa largeur) ; la bande réduite est à la mesure du bouton et ne bouge pas ; la place de la pointe de l’épée en haut du menu', () => {
  const [largeur, hauteur] = tailleWebp(lire('../public/logo.webp'));
  assert.deepEqual([largeur, hauteur], [319, 320]);
  const entete = css('../src/layouts/Base.astro');
  assert.ok(entete.includes(`width="${largeur}" height="${hauteur}"`), 'les dimensions écrites dans l’en-tête sont celles du fichier');
  // le retour du propriétaire (« Remet le à sa place d'origine ») : plus de pointe d'épée calculée, plus d'en-tête pleine largeur
  assert.doesNotMatch(coque, /--pointe-epee|--entete-marge/);
  assert.doesNotMatch(menu, /--pointe-epee/);
  assert.doesNotMatch(coque, /\.site-header__inner \{[^}]*max-width/, 'l’en-tête garde la largeur du contenu : le logo reste aligné sur le texte');
  assert.match(coque, /\.site-header__inner \{ display: flex;/);
  assert.match(css('../src/styles/global/compte.css'), /\.site-compte \{[^}]*position: absolute;/s, 'le compte déborde à droite');
  // le logo : sa hauteur est la variable, l'image garde sa proportion
  assert.match(coque, /\.brand img \{[^}]*height: var\(--logo-hauteur\); width: auto;/);
  assert.match(coque, /\.brand \{[^}]*width: var\(--logo-hauteur\);/);
  // l'en-tête suit la colonne de la page : il garde la place du menu latéral (sa largeur du moment, animée comme lui), le contenu centré dans le reste comme <main>
  assert.match(menu, /:root \{ --menu-courante: var\(--menu-largeur\); \}/);
  assert.match(menu, /:root:has\(\.menu-site\[data-reduit='oui'\]\) \{ --menu-courante: var\(--menu-bande\); \}/);
  assert.match(menu, /\.site-header \{ padding-left: var\(--menu-courante\); \}/);
  assert.match(menu, /:root:has\(\.menu-site\[data-anime\]\) \.site-header \{ transition: padding-left var\(--menu-duree\)/, 'animée comme le menu');
  assert.match(menu, /@media \(max-width: 56rem\) \{\s*:root, :root:has\(\.menu-site\[data-reduit='oui'\]\) \{ --menu-courante: 0px; \}/, 'sous 56 rem (tiroir), le menu ne prend rien');
  // la bande réduite : le bouton et son air, la même ouverte ou réduite (le bouton ne bouge pas)
  const rem = (x) => Number(x.replace('rem', ''));
  const bande = rem(menu.match(/--menu-bande:\s*([^;]+);/)[1]);
  const bouton = rem(menu.match(/--menu-bouton:\s*([^;]+);/)[1]);
  assert.equal(menu.match(/--menu-largeur-reduite:\s*([^;]+);/)[1].trim(), 'var(--menu-bande)');
  assert.match(menu, /\.menu-site__tete \{[^}]*padding-left: calc\(\(var\(--menu-bande\) - var\(--menu-bouton\)\) \/ 2\);/, 'le bouton est centré dans la bande, ouvert comme réduit');
  assert.ok(bande > bouton && bande < rem(menu.match(/--menu-largeur:\s*([^;]+);/)[1]), 'la bande est plus large que le bouton, plus étroite que le menu ouvert');
  // la hauteur de la bande est fixée : la place de la pointe, qui dépasse sous elle, se calcule
  assert.match(coque, /\.site-header__inner \{[^}]*min-height: var\(--bande-entete\);/);
  assert.match(menu, /--menu-haut:\s*calc\(var\(--logo-hauteur\) \+ 0\.5rem - var\(--bande-entete\) \+ 0\.5rem\);/);
});

test('R319 (2) : largeur animée en 0,3 s, dépliage des sous-pages par grid-template-rows 0fr/1fr, animations seulement après le premier affichage, aucune sous prefers-reduced-motion', () => {
  assert.match(menu, /--menu-duree:\s*0\.3s;/);
  assert.match(menu, /\.menu-site\[data-anime\] \{ transition: width var\(--menu-duree\)/);
  assert.match(menu, /\.menu-site\[data-reduit='oui'\] \{ width: var\(--menu-largeur-reduite\); \}/);
  assert.match(menu, /\.menu-site__sous \{ display: grid; grid-template-rows: 1fr; \}/);
  assert.match(menu, /\.menu-site__groupe\[data-replie='oui'\] > \.menu-site__sous \{ grid-template-rows: 0fr; visibility: hidden; \}/);
  assert.match(menu, /\.menu-site\[data-anime\] \.menu-site__sous \{ transition: grid-template-rows [^;]*visibility/);
  // aucune transition hors d'un sélecteur `[data-anime]`
  const sansCommentaires = menu.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selecteur] of sansCommentaires.matchAll(/([^{}]+)\{[^}]*\btransition:/g)) {
    if (!selecteur.trim().startsWith('@media (prefers-reduced-motion')) assert.match(selecteur, /\[data-anime\]/, `${selecteur.trim()} : une transition sans [data-anime]`);
  }
  assert.match(menu, /@media \(prefers-reduced-motion: reduce\) \{\s*\.menu-site\[data-anime\], \.menu-site\[data-anime\] \* \{ transition: none !important; \}/);
  // réduit : ni vu ni atteint au clavier (visibility), le cadre garde sa largeur d'ouvert
  assert.match(menu, /\.menu-site\[data-reduit='oui'\] :is\(\.menu-site__titres, \.menu-site__contenu\) \{ visibility: hidden; opacity: 0; \}/);
  assert.match(menu, /\.menu-site__cadre \{[^}]*width: var\(--menu-largeur\);/);
});

test('la feuille n’écrit aucune couleur (jetons du thème), est chargée par la feuille globale ; une liste `hidden` reste cachée quoi que dise un display plus bas', () => {
  assert.doesNotMatch(menu.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, 'aucune couleur en dur');
  assert.match(css('../src/styles/global.css'), /@import '\.\/global\/menu-site\.css';/);
  // le défaut vu sur la première capture : les listes des rubriques cachées (`hidden`) s'affichaient à la suite, un `display` de la feuille l'emportant sur l'attribut
  assert.match(menu, /\.menu-site \[hidden\] \{ display: none !important; \}/);
  assert.match(css('../src/styles/global/compte.css'), /\.site-compte \[hidden\] \{ display: none !important; \}/, 'le panneau du profil : ses entrées cachées de même');
  assert.match(menu, /@media print \{ \.menu-site \{ display: none; \} \.site-corps \{ display: block; \} [^}]*\}/);
  // la page remplit la place restante, centrée dans sa largeur maximale (celle de chaque page : main:has(…))
  assert.match(menu, /\.site-corps > main \{ flex: 1 1 0; min-width: 0; \}/);
});

test('R319 (2) : le tiroir de l’écran étroit (<= 56 rem) : glisse depuis la gauche sous l’en-tête, 18,75 rem, voile, cibles de 44 px, retient la molette (surcouche), animations coupées sous prefers-reduced-motion', () => {
  const etroit = menu.slice(menu.indexOf('@media (max-width: 56rem) {'));
  assert.ok(etroit.includes('.site-corps { display: block; }'), 'sans JavaScript : un bloc ouvert au-dessus de la page');
  assert.match(etroit, /\.menu-site\[data-js\] \{[^}]*position: fixed;[^}]*top: var\(--entete-bas, 0px\);[^}]*width: min\(18\.75rem/);
  assert.match(etroit, /\.menu-site\[data-js\]\[data-reduit='oui'\] \{[^}]*translateX\(-100%\);[^}]*visibility: hidden;/, 'fermé : hors de l’écran, ni vu ni atteint');
  assert.match(etroit, /\.menu-site\[data-js\]\[data-anime\] \{ transition: transform 0\.32s/);
  assert.match(etroit, /\.menu-site__voile:not\(\[hidden\]\) \{[^}]*position: fixed;[^}]*top: var\(--entete-bas, 0px\);[^}]*var\(--voile-tiroir\)/);
  assert.match(etroit, /\.menu-site\[data-js\] \.menu-site__cadre \{[^}]*overscroll-behavior: contain;/, 'surcouche : inscrite dans test/defilement.test.mjs');
  assert.match(etroit, /\.menu-site__burger:not\(\[hidden\]\) \{[^}]*width: 2\.75rem;[^}]*height: 2\.75rem;/, 'le bouton à trois barres : 44 px');
  assert.match(etroit, /min-height: 2\.75rem/, 'des entrées de 44 px');
  assert.match(etroit, /@media \(max-width: 56rem\) and \(prefers-reduced-motion: reduce\) \{\s*\.menu-site__voile:not\(\[hidden\]\) \{ animation: none; \}/);
  // les transitions du tiroir ne commencent qu'avec [data-anime]
  for (const [, selecteur] of etroit.matchAll(/([^{}]+)\{[^}]*\btransition:/g)) assert.match(selecteur, /\[data-anime\]/, selecteur.trim());
  // le bouton est caché sur grand écran ; l'en-tête le met à gauche du logo et les rubriques en ligne défilante
  assert.match(menu, /\.menu-site__burger, \.menu-site__voile \{ display: none; \}/);
  assert.match(coque, /grid-template-columns: auto auto minmax\(0, 1fr\);/);
  assert.match(coque, /\.site-nav__groups \{ flex-wrap: nowrap !important; overflow-x: auto;/);
  assert.match(css('../src/layouts/Base.astro'), /<button type="button" class="menu-site__burger" aria-expanded="false" aria-controls="menu-du-site" aria-label="[^"]+" data-menu-burger hidden>/);
});
