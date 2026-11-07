// Le site CONSTRUIT et la migration 0098 (réponses du propriétaire du 2026-11-06, transmises par le leader-technique) :
//   - le Glossaire (/regles/glossaire/, Q6 et Q7) : au menu Règles après Exploration ; la liste de TOUS les mots-clés (libellé, un lien s'il a une
//     adresse ; abréviation ; pastille de sa couleur ; définition, ses balises rendues ; ses pages, un lien vers /recherche/?mot-cle=<id>) ; les couleurs
//     que propose le mode modification (data-couleurs) ; le Lexique y mène ; /recherche/ ne gère plus le vocabulaire ;
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
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { classeDuMotCle } from '../src/lib/mots-cles-liens.mjs';
import { FAMILLES_DE_LA_PALETTE } from '../src/lib/palette-css.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'regles', 'glossaire', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (chemin) => readFileSync(join(dist, chemin, 'index.html'), 'utf8');
const decoder = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('le Glossaire : au menu Règles après Exploration ; tous les mots-clés, chacun avec son lien, sa pastille, sa définition rendue et ses pages', options, () => {
  const html = lire(join('regles', 'glossaire'));
  assert.match(html, /<a href="\/regles\/exploration\/"[^>]*>Exploration<\/a><\/li>\s*<li>\s*<a href="\/regles\/glossaire\/" aria-current="page">Glossaire<\/a>/);
  assert.match(html, /<h1>Glossaire<\/h1>/);
  const vocabulaire = chargerVocabulaire(ouvrirBase());
  const liste = html.slice(html.indexOf('<ul class="glossaire-liste" id="liste-mots-cles">'), html.indexOf('id="aucun-mot-cle"'));
  const lignes = [...liste.matchAll(/<li class="glossaire-mot" data-id="([^"]+)"[^>]*>([\s\S]*?)<\/li>(?=<li class="glossaire-mot"|<\/ul>)/g)];
  assert.deepEqual(lignes.map((l) => l[1]).sort(), vocabulaire.map((m) => m.id).sort(), 'tous les mots-clés, avec ou sans définition');
  const parId = new Map(lignes.map((l) => [l[1], l[2]]));
  let liens = 0;
  for (const m of vocabulaire) {
    const ligne = parId.get(m.id);
    if (m.url) {
      liens += 1;
      assert.ok(ligne.includes(`<a class="glossaire-mot__nom" href="${m.url}">`), `${m.id} : le libellé mène à ${m.url}`);
    } else assert.ok(ligne.includes('<strong class="glossaire-mot__nom">'), `${m.id} : sans adresse, pas de lien`);
    const classe = classeDuMotCle(m);
    assert.ok(ligne.startsWith(`<span class="glossaire-mot__pastille${classe ? ` ${classe}` : ''}" aria-hidden="true"></span>`), `${m.id} : sa pastille`);
    assert.ok(ligne.includes(`<a class="glossaire-mot__pages" href="/recherche/?mot-cle=${encodeURIComponent(m.id)}">`), `${m.id} : ses pages`);
    assert.equal(ligne.includes('glossaire-mot__definition--vide'), !m.description, `${m.id} : sa définition`);
  }
  assert.ok(liens >= 270, `${liens} libellés liés`);
  // les balises des définitions rendues par le middleware (data-balise les garde)
  assert.doesNotMatch(liste.replace(/ data-[a-z-]+="[^"]*"/g, ''), /\{\{[^{}\n]+\}\}/, 'aucune balise brute');
  // les couleurs que propose le mode modification : toutes les familles de la palette ; leurs feuilles émises par la page
  const couleurs = JSON.parse(decoder(/data-couleurs="([^"]*)"/.exec(html)[1]));
  assert.deepEqual(couleurs.map((g) => g.famille), Object.keys(FAMILLES_DE_LA_PALETTE));
  for (const c of couleurs.flatMap((g) => g.couleurs)) assert.ok(html.includes(`.${c.classe}{`), `${c.classe} : sa feuille sur la page`);
  assert.match(html, /<script type="module" src="[^"]+"><\/script>|<script type="module">/, 'le script du filtre');
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
  const vocabulaire = new Map(chargerVocabulaire(ouvrirBase()).map((m) => [m.id, m]));
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
  assert.ok(liens > 100, `${liens} liens de mots-clés`);
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
  assert.match(lire(join('regles', 'les-degats')), /<div class="guide-reference">/, 'une page des onglets : l’accent du site');
  // aucune page n'a de couleur sur son <main> au départ (aucun mot-clé coloré ne mène à une page sans gabarit coloré)
  for (const rel of pages()) assert.doesNotMatch(readFileSync(join(dist, rel), 'utf8'), /<main class=/, relative('.', rel));
});
