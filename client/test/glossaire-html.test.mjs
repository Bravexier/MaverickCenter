// Le site CONSTRUIT et la migration 0098 (réponses du propriétaire du 2026-11-06, transmises par le leader-technique) :
//   - le Glossaire (/regles/glossaire/, Q6 et Q7) : au menu Règles après Exploration ; le tableau de TOUS les mots-clés (décision R234 : au gabarit
//     commun ; ses noms, libellé et synonymes ; ses catégories ; son lien, le titre de sa page ; le menu de ses pages, ses mentions de R196 ; le liseré de
//     sa couleur ; sa définition dans une ligne en plus, ses balises rendues) ; les deux filtres (texte, catégorie) ; les couleurs que propose le mode
//     modification (data-couleurs) ; le Lexique y mène ; /recherche/ ne gère plus le vocabulaire ;
//   - les mots-clés à adresse sont des liens (vers une page construite), la feuille des mots-clés colorés est sur chaque page ;
//   - « il ne faut pas de changement par rapport à avant en terme de résultat » : les pages colorées gardent leur classe.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/glossaire-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cssDesMotsClesDuSite } from '../src/lib/couleur-de-la-page.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { mentionsDesMotsCles } from '../src/lib/mentions-des-mots-cles.mjs';
import { htmlDeLIcone, pagesDesMentions } from '../src/lib/mots-cles-balises.mjs';
import { categoriesDesMotsCles, chargerVocabulaire, pagesDesLiens } from '../src/lib/mots-cles-db.mjs';
import { classeDuMotCle } from '../src/lib/mots-cles-liens.mjs';
import { FAMILLES_DE_LA_PALETTE } from '../src/lib/palette-css.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'regles', 'glossaire', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (chemin) => readFileSync(join(dist, chemin, 'index.html'), 'utf8');
const decoder = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('R234 : le Glossaire — au menu Règles après Exploration ; le tableau de tous les mots-clés au gabarit commun (noms, catégories, lien au titre de sa page, menu de ses pages = ses mentions, liseré, définition rendue) ; les deux filtres', options, () => {
  const html = lire(join('regles', 'glossaire'));
  assert.match(html, /<a href="\/regles\/exploration\/"[^>]*>Exploration<\/a><\/li>\s*<li>\s*<a href="\/regles\/glossaire\/" aria-current="page">Glossaire<\/a>/);
  assert.match(html, /<h1>Glossaire<\/h1>/);
  const db = ouvrirBase();
  const vocabulaire = chargerVocabulaire(db);
  const categories = categoriesDesMotsCles(db);
  // le gabarit commun des tableaux (skill ui-tableaux) : le cadre, la zone qui défile, la table et ses en-têtes
  assert.match(html, /<div class="tableau glossaire-tableau">\s*<div class="tableau__defile">\s*<table class="table-donnees glossaire-table"[^>]* id="liste-mots-cles"/);
  assert.match(html, /<thead><tr><th scope="col">Icône<\/th><th scope="col">Mot-clé<\/th><th scope="col">Catégories<\/th><th scope="col">Lien<\/th><th scope="col">Pages<\/th><\/tr><\/thead>/);
  // le filtre par catégorie (R234 (4)) : toutes, puis chaque catégorie, dans l'ordre de leur id
  const choix = html.slice(html.indexOf('<select id="filtre-categorie"'), html.indexOf('</select>'));
  assert.deepEqual([...choix.matchAll(/<option value="(\d*|sans)">([^<]*)<\/option>/g)].map((o) => [o[1], decoder(o[2])]),
    [['', 'Toutes les catégories'], ['sans', 'Sans catégorie'], ...categories.map((c) => [String(c.id), c.libelle])]);
  const tableau = html.slice(html.indexOf('id="liste-mots-cles"'), html.indexOf('</table>'));
  const lignes = [...tableau.matchAll(/<tbody class="glossaire-mot" data-id="(\d+)"[^>]*>([\s\S]*?)<\/tbody>/g)];
  assert.deepEqual(lignes.map((l) => Number(l[1])).sort((a, b) => a - b), vocabulaire.map((m) => m.id).sort((a, b) => a - b), 'tous les mots-clés, avec ou sans définition');
  const parId = new Map(lignes.map((l) => [Number(l[1]), l[2]]));
  const mentions = mentionsDesMotsCles(db, vocabulaire.map((m) => m.id));
  const liens = pagesDesLiens(db, vocabulaire);
  const texte = (h) => decoder(h.replace(/<[^>]+>/g, ''));
  let avecLien = 0;
  for (const m of vocabulaire) {
    const ligne = parId.get(m.id);
    // son icône seule, en première colonne (R235 (2)) ; le RF, le RO et la PP l'ont reçue (migration 0116)
    assert.ok(ligne.includes(`<td class="glossaire-mot__icone">${htmlDeLIcone(m.icone)}</td>`), `${m.cle} : son icône`);
    // le liseré de sa couleur sur ses deux lignes (R234 (1))
    const classe = classeDuMotCle(m);
    const lignesColorees = [...ligne.matchAll(/<tr class="([^"]+)">/g)].map((x) => x[1]);
    assert.deepEqual(lignesColorees, ['glossaire-mot__ligne', 'glossaire-mot__suite'].map((c) => (classe ? `${c} ligne-couleur ${classe}` : c)), `${m.cle} : ses deux lignes`);
    // le lien : le titre de la page où mène son adresse, sinon l'adresse (R234 (2), réponse T5)
    const lien = /<td class="glossaire-mot__lien">([\s\S]*?)<\/td>/.exec(ligne)[1];
    if (m.url) {
      avecLien += 1;
      const page = liens.get(m.id);
      assert.ok(lien.startsWith(`<a href="${m.url}"`), `${m.cle} : mène à ${m.url}`);
      assert.equal(texte(lien), page ? page.titre : m.url, `${m.cle} : le titre de sa page`);
    } else assert.equal(texte(lien), '—', `${m.cle} : sans adresse`);
    // le menu de ses pages : ses mentions (R196), une ligne par page (R234 (3))
    const attendues = pagesDesMentions(mentions.get(m.id) ?? []).filter((x) => x.page !== null); // seulement les pages
    const items = [...ligne.matchAll(/<li(?: data-exemple)?>([\s\S]*?)<\/li>/g)].map((x) => texte(x[1]));
    assert.deepEqual(items, attendues.map((x) => x.libelle), `${m.cle} : ses pages`);
    if (attendues.length) assert.match(ligne, new RegExp(`<summary>${attendues.length} pages?</summary>`), `${m.cle} : leur total`);
    assert.equal(ligne.includes('glossaire-mot__definition--vide'), !m.description, `${m.cle} : sa définition`);
  }
  assert.equal(avecLien, vocabulaire.filter((m) => m.url).length);
  assert.ok(vocabulaire.filter((m) => m.icone).length >= 1 || !baseDImport().prepare('SELECT 1 FROM mot_cle WHERE icone IS NOT NULL').get(), 'des icônes dès l’import');
  // plus de 270 mots-clés à adresse à l'import (migration 0098)
  const lies = baseDImport().prepare('SELECT count(*) AS n FROM mot_cle WHERE url IS NOT NULL').get().n;
  assert.ok(lies >= 270, `${lies} libellés liés à l’import`);
  // les balises des définitions rendues par le middleware (data-balise les garde)
  assert.doesNotMatch(tableau.replace(/ data-[a-z-]+="[^"]*"/g, ''), /\{\{[^{}\n]+\}\}/, 'aucune balise brute');
  // les couleurs que propose le mode modification : toutes les familles de la palette ; leurs feuilles émises par la page
  const couleurs = JSON.parse(decoder(/data-couleurs="([^"]*)"/.exec(html)[1]));
  assert.deepEqual(couleurs.map((g) => g.famille), Object.keys(FAMILLES_DE_LA_PALETTE));
  for (const c of couleurs.flatMap((g) => g.couleurs)) assert.ok(html.includes(`.${c.classe}{`), `${c.classe} : sa feuille sur la page`);
  assert.match(html, /<script type="module" src="[^"]+"><\/script>|<script type="module">/, 'le script des filtres');
  assert.equal(html.split(' id="mot-cle-').length, html.split(' role="tooltip" id="mot-cle-').length, 'aucun id de la page ne commence par « mot-cle- », hors des bulles');
});

test('/recherche/ ne gère plus le vocabulaire (pas de mode modification) ; le Lexique mène au Glossaire', options, () => {
  assert.doesNotMatch(lire('recherche'), /data-edition/, 'plus d’éditeur sur /recherche/');
  const page404 = readFileSync(join(dist, '404.html'), 'utf8');
  const renvois = JSON.parse(decoder(/data-renvois="([^"]*)"/.exec(page404)[1]));
  assert.equal(renvois['regles/lexique/'], 'regles/glossaire/');
});

/** Les pages construites (index.html), relatives à dist/. */
const pages = () => readdirSync(dist, { recursive: true }).filter((f) => f.endsWith('index.html')).map((f) => f.split(sep).join('/'));

test('les mots-clés à adresse sont des liens vers une page construite ; la feuille des mots-clés colorés est sur chaque page ; leurs bulles portent leur couleur', options, () => {
  const feuille = `<style data-couleurs-mots-cles>${cssDesMotsClesDuSite()}</style>`;
  // par leur clé : celle que portent data-mot-cle et l'id d'une bulle (décision R232 (3))
  const vocabulaire = new Map(chargerVocabulaire(ouvrirBase()).map((m) => [m.cle, m]));
  let liens = 0;
  for (const rel of pages()) {
    const html = readFileSync(join(dist, rel), 'utf8');
    if (rel !== 'maintenance/index.html') assert.equal(html.split(feuille).length - 1, 1, `${rel} : la feuille des mots-clés colorés`);
    for (const [, classes, href, id] of html.matchAll(/<a class="(mot-cle(?: [a-z0-9-]+)?)" href="([^"]+)" data-mot-cle="([^"]+)"/g)) {
      liens += 1;
      const m = vocabulaire.get(id);
      assert.equal(href, m?.url, `${rel} : ${id} mène à son adresse`);
      assert.equal(classes, ['mot-cle', classeDuMotCle(m)].filter(Boolean).join(' '), `${rel} : ${id}, sa classe`);
      const chemin = href.replace(/[?#].*$/, '');
      assert.ok(existsSync(join(dist, chemin, 'index.html')) || existsSync(join(dist, chemin)), `${rel} : ${href} est construite`);
    }
    for (const [, classes, id] of html.matchAll(/<span class="(bulle(?: [a-z0-9-]+)?)" role="tooltip" id="mot-cle-([a-z0-9-]+)" hidden>/g)) {
      assert.equal(classes, ['bulle', classeDuMotCle(vocabulaire.get(id))].filter(Boolean).join(' '), `${rel} : la bulle de ${id}`);
    }
  }
  // des liens dès qu'un mot-clé a une adresse (le site de dev supprime des mots-clés à adresse : leurs balises deviennent du texte)
  assert.ok(liens > 0 || ![...vocabulaire.values()].some((m) => m.url), `${liens} liens de mots-clés`);
});

test('« rendu identique » : les pages colorées gardent leur classe (magie, catégorie de classe, nature de race, partie du guide) ; les autres, aucune', options, () => {
  assert.match(lire(join('magies', 'magie-du-feu')), /<div class="magie couleur-magie-feu">/);
  assert.match(lire(join('magies', 'magie-de-lespace-temps')), /<div class="magie couleur-magie-espace-temps">/);
  assert.match(lire(join('classes', 'guerrier')), /<div class="classe couleur-classe-melee" data-ed-classe=/);
  assert.match(lire(join('classes', 'anansi')), /<div class="classe couleur-classe-raciales" data-ed-classe=/);
  assert.match(lire(join('races', 'humain')), /<div class="race race--pure couleur-race-pure">/);
  assert.match(lire(join('races', 'kitsune')), /<div class="race race--hybride couleur-race-hybride">/);
  assert.match(lire(join('regles', 'creer-son-personnage')), /<div class="guide-reference guide-reference--couleur couleur-partie-creer">/);
  assert.match(lire('decouvrir'), /<div class="guide-reference guide-reference--couleur couleur-partie-decouvrir">/);
  // une page des onglets (« Les dégâts », que le site de dev peut supprimer : cas admis, vérifié) : l'accent du site
  if (existsSync(join(dist, 'regles', 'les-degats', 'index.html'))) assert.match(lire(join('regles', 'les-degats')), /<div class="guide-reference">/, 'une page des onglets : l’accent du site');
  else assert.ok(historiqueSite(ouvrirBase()).supprimee('page', { id: 'guide/les-degats' }), 'guide/les-degats non construite sans que le site de dev l’ait supprimée');
  // aucune page n'a de couleur sur son <main> au départ (aucun mot-clé coloré ne mène à une page sans gabarit coloré)
  for (const rel of pages()) assert.doesNotMatch(readFileSync(join(dist, rel), 'utf8'), /<main class=/, relative('.', rel));
});
