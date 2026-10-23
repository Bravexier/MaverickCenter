// Pages /chronologie/ construites (dist/) : la frise verticale à gauche (une ligne par événement, la date à gauche de la barre, le titre à droite, le
// dégradé porté par chaque ligne), à droite la page de l'événement (ou, sur /chronologie/, le mode d'emploi), tout à droite les chevrons Haut
// (précédent) et Bas (suivant), grisés aux bords ; extraits et date surlignée, scripts en ligne sans import, entrée du menu Codex. Se saute sans
// dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerChronologie, choixDuFiltre } from '../src/lib/chronologie-db.mjs';
import { adresseDEvenement, couleursDesEvenements, dateCourte, LIBELLE_SANS_CATEGORIE, libelleDeDate, SANS_CATEGORIE } from '../src/lib/chronologie.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { lireAttributEd } from '../src/lib/edition-modele.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'chronologie', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const evenements = present ? chargerChronologie(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : [];
const lireChemin = (chemin) => readFileSync(join(dist, chemin, 'index.html'), 'utf8');
const lire = (e) => lireChemin(adresseDEvenement(e.id));
const principal = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const decoder = (t) => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const hrefDe = (e) => `/${adresseDEvenement(e.id)}`;
/** Le texte affiché d'un morceau de HTML : sans le texte réservé aux lecteurs d'écran (.chrono-invisible) ni les balises. */
const visible = (html = '') => decoder(html.replace(/<span class="chrono-invisible">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/**
 * Les lignes de la frise d'une page : [{ id, style, categories, etiquette, href, courant, date, titre (affichés), nom (lu par un lecteur d'écran), repere }],
 * dans l'ordre.
 */
function frise(main) {
  const nav = main.match(/<nav class="frise" id="frise" aria-label="Frise chronologique" data-frise>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, 'une frise');
  // un attribut vide s'écrit sans valeur (`data-categories` : aucune catégorie)
  const lignes = /<li class="frise__evenement frise__evenement--[a-z]+" id="evenement-([^"]+)" style="([^"]+)" data-categories(?:="([^"]*)")? data-etiquette="([^"]*)">([\s\S]*?)<\/li>/g;
  return [...nav.matchAll(lignes)].map(([, id, style, categories, etiquette, ligne]) => ({
    id,
    style,
    categories: categories ?? '',
    etiquette: decoder(etiquette),
    href: ligne.match(/<a class="frise__lien" href="([^"]+)"/)?.[1],
    courant: / aria-current="page"/.test(ligne),
    date: visible(ligne.match(/<span class="frise__date">([\s\S]*?)<\/span>\s*<span class="frise__barre">/)?.[1]),
    titre: visible(ligne.match(/<span class="frise__titre">([\s\S]*?)<\/span>\s*<\/a>/)?.[1]),
    nom: decoder((ligne.match(/<a class="frise__lien"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(),
    repere: ligne.match(/<span class="(frise__repere[^"]*)"/)?.[1],
  }));
}
/** Les chevrons d'une page : { precedent, suivant } = href, ou null si le chevron est grisé. */
function chevrons(main) {
  const nav = main.match(/<nav class="chrono-chevrons"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, 'les chevrons');
  const lien = (rel) => nav.match(new RegExp(`<a class="chrono-chevron" href="([^"]+)" rel="${rel}"`))?.[1] ?? null;
  const grises = (nav.match(/<a class="chrono-chevron" role="link" aria-disabled="true"/g) ?? []).length;
  return { precedent: lien('prev'), suivant: lien('next'), grises };
}

test('une page par événement, à /chronologie/<id>/, titrée de l’événement ; /chronologie/ est la frise et son mode d’emploi', options, () => {
  assert.ok(evenements.length > 0);
  for (const e of evenements) {
    const titre = principal(lire(e)).match(/<h1 id="chrono-titre"><span data-ed="[^"]+">([^<]*)<\/span><\/h1>/)?.[1];
    assert.equal(titre === undefined ? undefined : decoder(titre), e.titre, `${e.id} : titre`);
  }
  // « événement N sur M » : sa place dans l'ordre de lecture (le rang n'est que l'ordre à date égale)
  evenements.forEach((e, i) => assert.match(principal(lire(e)), new RegExp(`<p class="chrono-numero">Chronologie · événement ${i + 1} sur ${evenements.length}</p>`), `${e.id} : numéro`));
  const accueil = principal(lireChemin('chronologie'));
  assert.match(accueil, /<h1 id="chrono-titre">Chronologie<\/h1>/);
  assert.ok(!accueil.includes('class="chrono-extrait"'), 'aucun extrait sur /chronologie/');
  assert.match(accueil, new RegExp(`<a class="chrono-commencer" href="${hrefDe(evenements[0])}" data-chrono-commencer>`), 'un lien vers le premier événement');
  assert.ok(!accueil.includes('class="chrono-barre__frise"') && !accueil.includes('class="frise-ouvrir"'), 'ni barre du bas ni mini-frise sur /chronologie/');
  assert.match(accueil, /<p class="chrono-accueil__court">/, 'la phrase courte du téléphone');
});

test('la frise, à gauche : tous les événements dans l’ordre, la date à gauche de la barre, le titre à droite, la page affichée repérée une fois', options, () => {
  const attendu = evenements.map((e) => ({ id: e.id, href: hrefDe(e), date: dateCourte(e), titre: e.titre }));
  const sans = (lignes) => lignes.map(({ id, href, date, titre }) => ({ id, href, date, titre }));
  const accueil = frise(principal(lireChemin('chronologie')));
  assert.deepEqual(sans(accueil), attendu, '/chronologie/ : toute la frise');
  assert.equal(accueil.filter((l) => l.courant).length, 0, '/chronologie/ : aucun événement repéré');
  for (const e of evenements) {
    const main = principal(lire(e));
    const lignes = frise(main);
    assert.deepEqual(sans(lignes), attendu, `${e.id} : toute la frise, dans l’ordre`);
    assert.deepEqual(lignes.filter((l) => l.courant).map((l) => l.id), [e.id], `${e.id} : la page affichée, une seule fois`);
    assert.ok(main.indexOf('<nav class="frise"') < main.indexOf('<article class="chrono-page"'), 'la frise avant la page (à gauche)');
  }
  // le nom d'un lien contient son texte affiché (WCAG 2.5.3), complété de « An » et de la portée d'un Impact
  accueil.forEach((l, i) => {
    const e = evenements[i];
    const nom = `${e.epoque === 'datee' ? 'An ' : ''}${dateCourte(e)} : ${e.titre}${e.portee ? `, Impact ${e.portee}` : ''}`;
    assert.equal(l.nom, nom, `${e.id} : nom du lien`);
  });
});

test('le dégradé : chaque ligne porte sa couleur et celles de ses voisines (le bas d’une ligne est le haut de la suivante) ; losange et gros point des Impacts', options, () => {
  const couleurs = couleursDesEvenements(evenements);
  const lignes = frise(principal(lireChemin('chronologie')));
  const variable = (style, nom) => style.match(new RegExp(`--${nom}: (#[0-9a-f]{6})`))?.[1];
  lignes.forEach((l, i) => {
    const e = evenements[i];
    assert.equal(variable(l.style, 'c'), couleurs.get(e.id), `${e.id} : sa couleur`);
    assert.equal(variable(l.style, 'c-avant'), couleurs.get((evenements[i - 1] ?? e).id), `${e.id} : couleur du précédent`);
    assert.equal(variable(l.style, 'c-apres'), couleurs.get((evenements[i + 1] ?? e).id), `${e.id} : couleur du suivant`);
    assert.equal(l.repere, ['frise__repere', e.portee && `frise__repere--${e.portee}`].filter(Boolean).join(' '), `${e.id} : repère`);
  });
});

test('les chevrons, tout à droite : Haut = précédent, Bas = suivant, grisés au premier et au dernier événement', options, () => {
  evenements.forEach((e, i) => {
    const c = chevrons(principal(lire(e)));
    assert.equal(c.precedent, evenements[i - 1] ? hrefDe(evenements[i - 1]) : null, `${e.id} : précédent`);
    assert.equal(c.suivant, evenements[i + 1] ? hrefDe(evenements[i + 1]) : null, `${e.id} : suivant`);
    assert.equal(c.grises, (i === 0) + (i === evenements.length - 1), `${e.id} : chevrons grisés`);
  });
  const accueil = chevrons(principal(lireChemin('chronologie')));
  assert.deepEqual(accueil, { precedent: null, suivant: hrefDe(evenements[0]), grises: 1 }, '/chronologie/ : Bas mène au premier événement');
});

test('les extraits : un bloc par passage, la date surlignée, un lien vers la page source ; identifiants uniques, chaque bulle existe', options, () => {
  for (const e of evenements) {
    const page = lire(e);
    const main = principal(page);
    // un morceau par extrait : de son début à celui du suivant (un extrait peut contenir une citation, donc un <blockquote> imbriqué)
    const blocs = main.split(/<blockquote class="chrono-extrait" data-chrono-bloc="\d+" data-chrono-page(?:="[^"]*")?>/).slice(1);
    assert.equal(blocs.length, e.extraits.length, `${e.id} : un bloc par extrait`);
    e.extraits.forEach((x, i) => {
      const marques = (blocs[i].match(/<mark class="chrono-surligne">/g) ?? []).length;
      assert.equal(marques, x.date_brut ? 1 : 0, `${e.id}, extrait ${i + 1} : ${x.date_brut ? `date « ${x.date_brut} » surlignée` : 'aucune date'}`);
    });
    for (const page of new Set(e.extraits.map((x) => x.page_id).filter(Boolean))) assert.ok(main.includes(`<a href="/${cheminDePage(page)}">`), `${e.id} : lien vers ${page}`);
    // téléphone : le milieu de la barre du bas (sans JavaScript, un lien vers sa ligne de /chronologie/) et le bouton posé sur la mini-frise ouvrent le tiroir
    assert.match(main, new RegExp(`<a class="chrono-barre__frise" href="/chronologie/#evenement-${e.id}" aria-controls="frise" data-frise-ouvrir>`), `${e.id} : milieu de la barre du bas`);
    assert.match(main, /<button type="button" class="frise-ouvrir" aria-controls="frise" aria-expanded="false" data-frise-ouvrir>/, `${e.id} : bouton de la mini-frise`);
    assert.match(main, /<div class="frise__entete">[\s\S]*?data-frise-fermer/, `${e.id} : en-tête du tiroir et sa croix`);
    assert.match(main, /<div class="frise-voile" data-frise-voile hidden><\/div>/, `${e.id} : le voile du tiroir`);
    const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${e.id} : identifiants uniques`);
    // (les bulles des mots-clés du glossaire : posées par le middleware en fin de page, src/middleware.mjs)
    const connus = new Set([...ids, ...[...page.matchAll(/ id="(mot-cle-[a-z0-9-]+)"/g)].map((m) => m[1])]);
    for (const [, cible] of main.matchAll(/data-bulle="([^"]+)"/g)) assert.ok(connus.has(cible), `${e.id} : bulle ${cible}`);
    assert.ok(!main.includes('') && !main.includes(''), `${e.id} : aucun marqueur de date oublié`);
  }
});

test('la mise en page demandée, dans la feuille de la page : frise au quart gauche (date | barre | titre), page aux trois quarts, chevrons fixés à droite, barre en dégradé', options, () => {
  const html = lireChemin(adresseDEvenement(evenements[0].id));
  /** Les déclarations des règles de la feuille de la chronologie au sélecteur exact donné (toutes, mises bout à bout). */
  const regle = (selecteur) => {
    const blocs = [];
    for (let i = html.indexOf(`\n${selecteur} {`); i >= 0; i = html.indexOf(`\n${selecteur} {`, i + 1)) blocs.push(html.slice(i, html.indexOf('}', i)));
    assert.ok(blocs.length, `règle ${selecteur}`);
    return blocs.join('\n');
  };
  assert.match(regle('main:has(> .chrono)'), /max-width: none;/, 'toute la largeur de l’écran');
  assert.match(regle('.chrono'), /grid-template-columns: minmax\(15rem, 1fr\) minmax\(0, 3fr\);/, 'un quart, trois quarts');
  assert.match(regle('.chrono'), /grid-template-areas: 'frise page';/, 'la frise à gauche, la page à droite');
  assert.match(regle('.frise__lien'), /grid-template-columns: var\(--date\) var\(--barre\) minmax\(0, 1fr\);/, 'la date à gauche de la barre, le titre à droite');
  assert.match(regle('.frise'), /position: sticky;[\s\S]*height: calc\(100dvh - var\(--frise-haut, 0px\)\);[\s\S]*overflow-y: auto;/, 'la frise défile seule, à hauteur d’écran sous l’en-tête');
  assert.match(regle('.frise'), /scroll-padding-block: 5\.5rem/, 'la ligne qui reçoit le focus n’est pas cachée par l’en-tête de la frise (filtre et légende)');
  assert.match(regle('.frise__tete'), /position: sticky;/, 'le filtre et la légende restent en haut de la frise');
  assert.match(regle('html.js .frise__filtre:not([hidden])'), /display: flex;/, 'le filtre, avec JavaScript seulement (et s’il y a de quoi choisir)');
  assert.match(html, /\n\.frise__evenement\.est-premier \.frise__barre::before \{/, 'les bouts de la barre suivent le filtre (première et dernière lignes visibles)');
  assert.match(regle('body:has(.chrono) .ed-cote'), /top: auto;[\s\S]*bottom: 1rem;/, 'le crayon du site de dev ne couvre pas les chevrons');
  assert.match(regle('.frise__barre::before'), /linear-gradient\([\s\S]*var\(--trait-avant\)[\s\S]*var\(--trait\) var\(--y\)[\s\S]*var\(--trait-apres\)/, 'le dégradé de chaque morceau de barre');
  assert.match(regle('.chrono-chevrons'), /position: fixed;[\s\S]*top: 50%;[\s\S]*right: max\(0\.75rem/, 'les chevrons, fixés tout à droite');
  assert.match(html, /\.frise__evenement:target > \.frise__lien/, 'la ligne où mène le milieu de la barre du bas sans JavaScript est marquée');
  // téléphone (demande du propriétaire : « la mini-frise, en plus du tiroir ») : les règles du bloc @media (max-width: 56rem)
  const telephone = html.slice(html.indexOf('@media (max-width: 56rem) {'), html.indexOf('@media (max-width: 56rem) and (max-height: 30rem)'));
  const regleTel = (selecteur) => {
    const i = telephone.indexOf(`\n  ${selecteur} {`);
    assert.ok(i >= 0, `règle du téléphone ${selecteur}`);
    return telephone.slice(i, telephone.indexOf('}', i));
  };
  assert.match(regleTel('html.js .chrono--evenement'), /grid-template-columns: 2\.25rem minmax\(0, 1fr\);[\s\S]*grid-template-areas: 'frise page';/, 'la mini-frise à gauche, la page à côté');
  assert.match(regleTel('html.js .chrono--evenement :is(.frise, .frise-ouvrir)'), /position: fixed;[\s\S]*top: var\(--mini-haut[\s\S]*bottom: var\(--mini-bas/, 'la mini-frise reste à l’écran pendant la lecture, de l’en-tête à la barre du bas');
  assert.match(regleTel('html:has(.chrono--evenement)'), /scroll-padding-bottom:/, 'le focus clavier ne passe pas sous la barre du bas');
  assert.ok(!/width: 100%/.test(regleTel('html.js .chrono--evenement .frise-ouvrir')), 'le bouton de la mini-frise garde sa largeur (fixé : 100 % serait tout l’écran)');
  assert.match(regleTel('html.js .chrono--evenement .frise.est-ouverte'), /position: fixed;[\s\S]*inset: 0 auto 0 0;/, 'le tiroir, par-dessus la page, depuis la gauche');
  assert.match(regleTel('.chrono--evenement .chrono-chevrons'), /bottom: 0;[\s\S]*grid-template-columns: 3rem minmax\(0, 1fr\) 3rem;/, 'la barre du bas : chevron, événement, chevron');
  assert.match(regleTel('body:has(.chrono--evenement)'), /padding-bottom: calc\(4\.25rem/, 'la page réserve la place de la barre du bas');
  // le panneau du site de dev (.ed-cote) au-dessus de la barre du bas, plus haut qu'elle (4.25rem, 3.5rem couché) : il ne couvre plus le chevron
  // « suivant », seul moyen d'avancer sans le glissement du doigt (essai réel en 390 px du 2026-10-22)
  const basDuPanneau = (bloc) => Number(bloc.match(/\n {2}body:has\(\.chrono--evenement\) \.ed-cote \{ bottom: calc\(([\d.]+)rem \+ env\(safe-area-inset-bottom\)\); \}/)?.[1]);
  const couche = html.slice(html.indexOf('@media (max-width: 56rem) and (max-height: 30rem)'));
  assert.ok(basDuPanneau(telephone) >= 4.25 + 0.5, 'téléphone : le panneau du site de dev au-dessus de la barre du bas');
  assert.ok(basDuPanneau(couche.slice(0, couche.indexOf('\n}'))) >= 3.5 + 0.5, 'téléphone couché : le panneau au-dessus de la barre plus basse');
  for (const [, attributs] of html.matchAll(/<a class="chrono-chevron" href=([^>]*)>/g)) {
    assert.match(attributs, / title="[^"]+" data-placement="cote"/, 'l’infobulle d’un chevron dit l’événement visé, à sa gauche (dessous, celle du Haut couvrirait le Bas)');
  }
});

test('catégories (migration 0043) : chaque ligne de la frise porte les siennes et son étiquette ; le filtre (liste déroulante, un choix) propose celles des événements et, hors de la production, « Sans catégorie (à trier) » ; la page d’un événement les montre, chacune mène à la frise filtrée', options, () => {
  const filtre = choixDuFiltre(evenements);
  const aTrier = process.env.SITE_MODE !== 'prod';
  const sans = aTrier ? filtre.sansCategorie : 0;
  const attendues = [
    ['', `Toutes (${evenements.length})`],
    ...filtre.categories.map((c) => [c.id, `${c.libelle} (${c.nombre})`]),
    ...(sans ? [[SANS_CATEGORIE, `${LIBELLE_SANS_CATEGORIE} (${sans})`]] : []),
  ];
  for (const chemin of ['chronologie', ...evenements.map((e) => adresseDEvenement(e.id))]) {
    const main = principal(lireChemin(chemin));
    frise(main).forEach((l, i) => {
      const e = evenements[i];
      assert.equal(l.categories, e.categories.map((c) => c.id).join(' '), `${chemin} : catégories de ${e.id}`);
      assert.equal(l.etiquette, `${libelleDeDate(e)} : ${e.titre}`, `${chemin} : étiquette de ${e.id} (infobulle des chevrons)`);
    });
    const zone = main.match(/<div class="frise__filtre" data-frise-filtre( hidden)?>/);
    assert.ok(zone, `${chemin} : le filtre`);
    assert.equal(Boolean(zone[1]), attendues.length < 2, `${chemin} : le filtre est caché s’il n’y a rien à choisir`);
    const choix = main.match(/<select id="frise-filtre" class="frise__filtre-choix" data-frise-choix( data-a-trier)?>([\s\S]*?)<\/select>/);
    assert.ok(choix, `${chemin} : la liste déroulante des catégories`);
    assert.equal(Boolean(choix[1]), aTrier, `${chemin} : « Sans catégorie » proposé hors de la production seulement`);
    assert.deepEqual([...choix[2].matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(([, v, t]) => [v, decoder(t)]), attendues, `${chemin} : les catégories proposées`);
    assert.match(main, /<label class="frise__filtre-libelle" for="frise-filtre">Catégorie<\/label>/, `${chemin} : le filtre est nommé`);
  }
  for (const e of evenements) {
    const main = principal(lire(e));
    const ul = main.match(/<ul class="chrono-categories" aria-label="Catégories" data-chrono-categories(?:="([^"]*)")?( data-a-trier)?( hidden)?>([\s\S]*?)<\/ul>/);
    assert.ok(ul, `${e.id} : ses catégories`);
    assert.equal(ul[1] ?? '', e.categories.map((c) => c.id).join(' '));
    assert.equal(Boolean(ul[2]), aTrier);
    assert.equal(Boolean(ul[3]), !e.categories.length && !aTrier, `${e.id} : sans catégorie, en production, rien n’est montré`);
    const pastilles = [...ul[4].matchAll(/<a class="chrono-categorie[^"]*" href="([^"]+)">([^<]*)<\/a>/g)].map(([, href, texte]) => [decoder(href), decoder(texte)]);
    const voulues = e.categories.length
      ? e.categories.map((c) => [`/chronologie/?filtre=${encodeURIComponent(c.id)}`, c.libelle])
      : aTrier ? [[`/chronologie/?filtre=${SANS_CATEGORIE}`, LIBELLE_SANS_CATEGORIE]] : [];
    assert.deepEqual(pastilles, voulues, `${e.id} : une pastille par catégorie, qui mène à la frise filtrée (aucune : « Sans catégorie (à trier) » hors de la production)`);
    // site de dev : date, titre, Impact et lieu sont des champs de l'événement (lib/edition-modele.mjs)
    const champs = [...main.matchAll(/data-ed(?:-lecture)?="([^"]+)"/g)].map(([, a]) => lireAttributEd(decoder(a))).filter((i) => i?.table === 'evenement' && i.cle.id === e.id);
    for (const colonne of ['titre', 'epoque', 'annee', 'annee_fin', 'portee', 'lieu']) assert.ok(champs.some((i) => i.colonne === colonne), `${e.id} : champ ${colonne}`);
  }
});

test('scripts en ligne sans import (version portable) ; le menu Codex mène à la chronologie ; transition entre les pages de la chronologie', options, () => {
  for (const chemin of ['chronologie', adresseDEvenement(evenements[0].id)]) {
    const html = lireChemin(chemin);
    for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.ok(!/(^|[;}\n])\s*import[\s{*"']|\bimport\(/.test(code), `${chemin} : script de page sans import`);
    // plus de glissement du doigt (réponse du propriétaire du 2026-10-22 : « Supprime juste le swipe. ») : les chevrons et ← → restent ; le retour
    // arrière au glissement horizontal est empêché pour tout le site, par la feuille globale (test/defilement.test.mjs, test/site-html.test.mjs)
    assert.doesNotMatch(html, /touchstart|touchmove|touchend|translateX\(/, `${chemin} : plus de glissement du doigt`);
    assert.match(html, /ArrowLeft/, `${chemin} : ← → au clavier`);
    assert.match(html, /@view-transition \{ navigation: auto; \}/, 'la page glisse d’un événement à l’autre (navigateurs qui le savent)');
  }
  assert.match(lireChemin('chronologie'), /<a href="\/chronologie\/" aria-current="page">Chronologie<\/a>/);
});
