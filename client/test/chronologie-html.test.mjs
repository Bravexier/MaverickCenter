// Pages /chronologie/ construites (dist/) : la frise verticale à gauche (une ligne par événement, la date à gauche de la barre, le titre à droite, le
// dégradé porté par chaque ligne), à droite la page de l'événement (ou, sur /chronologie/, le mode d'emploi), tout à droite les chevrons Haut
// (précédent) et Bas (suivant), grisés aux bords ; extraits et date surlignée, scripts en ligne sans import, entrée du menu Codex. Se saute sans
// dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerChronologie } from '../src/lib/chronologie-db.mjs';
import { adresseDEvenement, couleursDesEvenements, dateCourte } from '../src/lib/chronologie.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

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

/** Les lignes de la frise d'une page : [{ id, style, href, courant, date, titre (affichés), nom (lu par un lecteur d'écran), repere }], dans l'ordre. */
function frise(main) {
  const nav = main.match(/<nav class="frise" aria-label="Frise chronologique" data-frise>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, 'une frise');
  return [...nav.matchAll(/<li class="frise__evenement frise__evenement--[a-z]+" id="evenement-([^"]+)" style="([^"]+)">([\s\S]*?)<\/li>/g)].map(([, id, style, ligne]) => ({
    id,
    style,
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
  const nav = main.match(/<nav class="chrono-chevrons" aria-label="[^"]+">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, 'les chevrons');
  const lien = (rel) => nav.match(new RegExp(`<a class="chrono-chevron" href="([^"]+)" rel="${rel}"`))?.[1] ?? null;
  const grises = (nav.match(/<span class="chrono-chevron" role="link" aria-disabled="true">/g) ?? []).length;
  return { precedent: lien('prev'), suivant: lien('next'), grises };
}

test('une page par événement, à /chronologie/<id>/, titrée de l’événement ; /chronologie/ est la frise et son mode d’emploi', options, () => {
  assert.ok(evenements.length > 0);
  for (const e of evenements) {
    const titre = principal(lire(e)).match(/<h1 id="chrono-titre">([^<]*)<\/h1>/)?.[1];
    assert.equal(titre === undefined ? undefined : decoder(titre), e.titre, `${e.id} : titre`);
  }
  const accueil = principal(lireChemin('chronologie'));
  assert.match(accueil, /<h1 id="chrono-titre">Chronologie<\/h1>/);
  assert.ok(!accueil.includes('class="chrono-extrait"'), 'aucun extrait sur /chronologie/');
  assert.match(accueil, new RegExp(`<a class="chrono-commencer" href="${hrefDe(evenements[0])}">`), 'un lien vers le premier événement');
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
    const main = principal(lire(e));
    // un morceau par extrait : de son début à celui du suivant (un extrait peut contenir une citation, donc un <blockquote> imbriqué)
    const blocs = main.split('<blockquote class="chrono-extrait">').slice(1);
    assert.equal(blocs.length, e.extraits.length, `${e.id} : un bloc par extrait`);
    e.extraits.forEach((x, i) => {
      const marques = (blocs[i].match(/<mark class="chrono-surligne">/g) ?? []).length;
      assert.equal(marques, x.date_brut ? 1 : 0, `${e.id}, extrait ${i + 1} : ${x.date_brut ? `date « ${x.date_brut} » surlignée` : 'aucune date'}`);
    });
    for (const page of new Set(e.extraits.map((x) => x.page_id))) assert.ok(main.includes(`<a href="/${page}/">`), `${e.id} : lien vers ${page}`);
    assert.match(main, new RegExp(`<a class="chrono-retour" href="/chronologie/#evenement-${e.id}">`), `${e.id} : retour à sa ligne de la frise (petit écran)`);
    const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${e.id} : identifiants uniques`);
    const connus = new Set(ids);
    for (const [, cible] of main.matchAll(/data-bulle="([^"]+)"/g)) assert.ok(connus.has(cible), `${e.id} : bulle ${cible}`);
    assert.ok(!main.includes('') && !main.includes(''), `${e.id} : aucun marqueur de date oublié`);
  }
});

test('scripts en ligne sans import (version portable) ; le menu Codex mène à la chronologie ; transition entre les pages de la chronologie', options, () => {
  for (const chemin of ['chronologie', adresseDEvenement(evenements[0].id)]) {
    const html = lireChemin(chemin);
    for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.ok(!/(^|[;}\n])\s*import[\s{*"']|\bimport\(/.test(code), `${chemin} : script de page sans import`);
    assert.match(html, /html \{ overscroll-behavior-x: none; \}/, 'le glissement du doigt ne fait pas un retour dans l’historique');
    assert.match(html, /@view-transition \{ navigation: auto; \}/, 'la page glisse d’un événement à l’autre (navigateurs qui le savent)');
  }
  assert.match(lireChemin('chronologie'), /<a href="\/chronologie\/" aria-current="page">Chronologie<\/a>/);
});
