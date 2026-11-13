// Pages de classe CONSTRUITES (client/dist/classes/*/index.html), rendues par le gabarit (components/classes/ClassePage.astro) depuis les tables
// de la base : aucun tableau Markdown, pas de source citée, les DONS disposés comme l'onglet avec leurs choix encadrés (« Au choix », « ou »),
// les spécialités en onglets.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/classes-html.test.mjs
// Le site de dev crée et supprime des spécialités et des dons (D11) : les comptes se comparent aux lignes de la base, classe par classe (plateau de
// lib/classes-db.mjs) ; les exemples de l'onglet (Archimage, Barde, Orios) se vérifient sur l'état d'import (test/aide-base-d-import.mjs), et seul
// l'ordre de la page du Barde se saute, visiblement, quand le site l'a remanié.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { htmlDuRepereMagique } from '../src/lib/classe-dons-rendu.mjs';
import { CLASSE_MAGIQUE_HORS_CATEGORIE } from '../src/lib/classe-magique.mjs';
import { chargerClasses } from '../src/lib/classes-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { CLASS_COLORS } from '../src/lib/class-groups.mjs';
import { cssDesFamilles } from '../src/lib/palette-css.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

const dossier = fileURLToPath(new URL('../dist/classes/', import.meta.url));
const present = existsSync(dossier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
// pages rendues par le gabarit (la classe d'exemple, sans ligne dans la base, garde le rendu Markdown)
const pages = present
  ? readdirSync(dossier, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ slug: d.name, html: readFileSync(join(dossier, d.name, 'index.html'), 'utf8') }))
      .filter((p) => p.html.includes('class="classe-hero"'))
  : [];
const page = (slug) => pages.find((p) => p.slug === slug)?.html ?? '';
const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const main = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const compte = (html, motif) => (html.match(motif) ?? []).length;
const db = ouvrirBase({ sansExemples: false });
const { classes } = chargerClasses(db);
const historique = historiqueSite(db);
// les classes dans l'état d'import (test/aide-base-d-import.mjs) : les exemples de l'onglet (Archimage, Barde, Orios) s'y vérifient sans condition
const importees = chargerClasses(baseDImport()).classes;
/** Les spécialités d'une classe (colonnes de son étage « specialites »), [] si elle n'en a pas. */
const colonnesDe = (classe) => classe.plateau.find((e) => e.forme === 'specialites')?.specialites ?? [];
/** Les spécialités qui font de la classe une classe magique (le don de la spécialité le dit : lib/classe-assemblage.mjs#ditClasseMagique). */
const magiquesDe = (classe) => (classe.amMagique === null ? [] : colonnesDe(classe).filter((c) => c.cartouche?.classeMagique));
/** Un texte en motif d'expression régulière, tel quel. */
const litteral = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Le nom courant d'une ligne de la base, lu par son id (le site de dev renomme dons et spécialités). */
const nomDe = (table, id) => db.prepare(`SELECT nom FROM ${table} WHERE id = ?`).get(id).nom;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Un texte de la page (HTML échappé) en motif d'expression régulière. */
const motif = (t) => echapper(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Une classe que le site n'a pas remaniée (aucun don ni spécialité créé ou supprimé, aucune nature changée). */
const intacte = (slug) => {
  const id = `classes/${slug}`;
  const classeDe = (table, l) => l.classe_id ?? historique.ligneDImport(table, { id: l.id })?.classe_id;
  return ![...historique.lignesRemaniees('capacite', ['nature', 'ligne', 'specialite_id']).map((l) => classeDe('capacite', l)),
    ...historique.lignesRemaniees('specialite').map((l) => classeDe('specialite', l))].includes(id) && !historique.creee('classe', { id });
};
/** Ce que la page d'une classe doit montrer, d'après son plateau : dons, choix par taille, « ou », onglets, dons reçus sans choix. */
function attendu(classe) {
  const groupes = classe.plateau.flatMap((e) => (e.forme === 'choix' ? [e.options] : e.forme === 'specialites' ? e.specialites.flatMap((s) => s.choix.map((g) => g.options)) : []))
    .filter((g) => g.length > 1);
  const colonnes = classe.plateau.find((e) => e.forme === 'specialites')?.specialites ?? [];
  return {
    dons: classe.dons.length,
    choix: groupes.reduce((m, g) => ({ ...m, [g.length]: (m[g.length] ?? 0) + 1 }), {}),
    ou: groupes.reduce((n, g) => n + g.length - 1, 0),
    onglets: colonnes.length,
    seuls: classe.plateau.filter((e) => e.forme === 'don').length,
  };
}

test('une page de classe rendue par le gabarit par classe de la base (41 à l’import)', options, () => {
  assert.equal(pages.length, classes.size);
  assert.equal(historique.effectifDImport('classe'), 41);
  for (const id of classes.keys()) assert.ok(page(id.slice('classes/'.length)), `${id} : page`);
});

test('chaque identifiant est unique ; les liens de la navigation et les aria-labelledby mènent à un élément de la page', options, () => {
  for (const { slug, html } of pages) {
    const tous = ids(html);
    assert.equal(new Set(tous).size, tous.length, `${slug} : identifiant en double`);
    const nav = html.slice(html.indexOf('class="classe-nav'), html.indexOf('</nav>', html.indexOf('class="classe-nav')));
    for (const [, cible] of nav.matchAll(/href="#([^"]+)"/g)) assert.ok(tous.includes(cible), `${slug} : #${cible} sans section`);
    for (const [, cible] of main(html).matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) assert.ok(tous.includes(cible), `${slug} : ${cible} introuvable`);
  }
});

test('retirés : tableaux Markdown, rendu Markdown, sources ; aucun tableau du tout', options, () => {
  for (const { slug, html } of pages) {
    const m = main(html);
    assert.ok(!m.includes('class="prose"'), `${slug} : rendu Markdown`);
    assert.ok(!/<table\b/.test(m), `${slug} : tableau`);
    assert.ok(!/\|\s*---/.test(m), `${slug} : tableau Markdown brut`);
    assert.ok(!/<h2[^>]*>Sources<\/h2>/.test(m), `${slug} : sources`);
    assert.ok(!m.includes('Capacités de la classe'), `${slug} : ancienne liste des capacités`);
  }
});

test('dons : un par don de la classe, chacun avec son ancre ; les choix sont encadrés avec « ou » entre les options', options, () => {
  for (const { slug, html } of pages) {
    const a = attendu(classes.get(`classes/${slug}`));
    const n = compte(html, /<article class="don[ "]/g);
    assert.equal(n, a.dons, `${slug} : nombre de dons`);
    assert.equal(compte(html, /<article class="don[^"]*" id="don-/g), n, `${slug} : ancre de chaque don`);
    if (n) assert.match(html, /<h2 id="dons-titre">Dons /, `${slug} : section « Dons »`);
    for (const [taille, k] of Object.entries(a.choix)) assert.equal(compte(html, new RegExp(`class="choix choix--${taille}"`, 'g')), k, `${slug} : choix de ${taille}`);
    assert.equal(compte(html, /class="choix choix--\d+"/g), Object.values(a.choix).reduce((x, y) => x + y, 0), `${slug} : choix encadrés`);
    assert.equal(compte(html, /class="choix__ou"/g), a.ou, `${slug} : « ou » entre les options`);
    assert.equal(compte(html, /class="onglets__ou"/g), Math.max(0, a.onglets - 1), `${slug} : « ou » entre les onglets des spécialités`);
    assert.equal(compte(html, /class="etage etage--don"/g), a.seuls, `${slug} : dons reçus sans choix`);
  }
  // à l'import : 17 dons par classe (14 pour l'Archimage), 3 choix de deux par spécialité, 3 dons reçus sans choix ; l'Archimage 2, 3, 3, 3
  const parClasse = new Map();
  for (const k of historique.lignesDImport('capacite')) parClasse.set(k.classe_id, (parClasse.get(k.classe_id) ?? 0) + 1);
  for (const [id, n] of parClasse) assert.equal(n, id === 'classes/archimage' ? 14 : 17, id);
  // l'Archimage à l'import : un choix de deux, trois choix de trois (la page rend ceux de la base courante : boucle ci-dessus)
  assert.deepEqual(attendu(importees.get('classes/archimage')).choix, { 2: 1, 3: 3 }, 'Archimage à l’import : ses choix');
  assert.equal(compte(page('archimage'), /class="specialite"/g), 0, 'Archimage : pas de spécialité (le site ne lui en crée pas)');
});

test('spécialités en onglets : un lien d’onglet par spécialité (gauche puis droite) vers son panneau, le premier ouvert ; chaque panneau garde son titre', options, () => {
  for (const { slug, html } of pages) {
    const n = attendu(classes.get(`classes/${slug}`)).onglets;
    const onglets = [...html.matchAll(/<a class="onglet( is-active)?" id="(onglet-[^"]+)" href="#(specialite-[^"]+)">/g)];
    assert.equal(onglets.length, n, `${slug} : un onglet par spécialité`);
    if (!n) continue;
    assert.deepEqual(onglets.map((o) => Boolean(o[1])), onglets.map((_, i) => i === 0), `${slug} : le premier onglet est ouvert`);
    const panneaux = [...html.matchAll(/<section class="specialite( is-active)?" id="(specialite-[^"]+)"/g)];
    assert.deepEqual(panneaux.map((p) => p[2]), onglets.map((o) => o[3]), `${slug} : un panneau par onglet, dans le même ordre`);
    assert.deepEqual(panneaux.map((p) => Boolean(p[1])), onglets.map((_, i) => i === 0), `${slug} : le premier panneau est ouvert`);
    assert.equal(compte(html, /<h3 class="specialite__titre"/g), n, `${slug} : titre de chaque panneau (sans JavaScript)`);
    assert.match(html, new RegExp(`class="onglets onglets--${n}"`));
    assert.match(html, /data-onglets/);
  }
  // le nom de chaque onglet : celui de sa spécialité dans la base courante (le site de dev le renomme)
  for (const { slug, html } of pages) {
    for (const { specialite: s } of colonnesDe(classes.get(`classes/${slug}`))) {
      assert.match(html, new RegExp(`id="onglet-${litteral(s.slug)}" href="#${litteral(s.ancre)}">\\s*<span class="onglet__surtitre">Spécialité</span>\\s*<span class="onglet__nom"[^>]*>${motif(s.nom)}</span>`), `${slug} : l’onglet ${s.id}`);
    }
  }
  // à l'import : deux spécialités par classe, sauf l'Archimage (aucune) ; le Barde, Danseur puis Ménestrel, aux noms de l'onglet
  for (const [id, classe] of importees) assert.equal(colonnesDe(classe).length, id === 'classes/archimage' ? 0 : 2, `${id} : ses spécialités à l’import`);
  assert.deepEqual(colonnesDe(importees.get('classes/barde')).map((c) => [c.specialite.ancre, c.specialite.nom]), [['specialite-danseur', 'DANSEUR'], ['specialite-menestrel', 'MÉNESTREL']]);
});

test('Barde : l’ordre de l’onglet (Prestation, Son perturbant, les spécialités, Chant double) et les paires du Ménestrel', { ...options, ...(present && !intacte('barde') ? { skip: 'Barde remanié sur le site de dev' } : {}) }, () => {
  const html = page('barde');
  const ordre = ['don-barde-prestation', 'don-barde-son-perturbant', 'specialite-danseur', 'specialite-menestrel', 'don-barde-chant-double'].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(ordre.every((i, k) => i > 0 && (k === 0 || i > ordre[k - 1])), `ordre ${ordre}`);
  const menestrel = html.slice(html.indexOf('id="specialite-menestrel"'), html.indexOf('id="don-barde-chant-double"'));
  // un choix = ce qui suit son cadre jusqu'au choix suivant (les cartes contiennent des blocs vides cachés, champs modifiables du site de dev)
  const paires = menestrel.split('<div class="choix choix--2"').slice(1).map((m) => [...m.matchAll(/class="don__nom"[^>]*><a [^>]*>([^<]+)</g)].map((x) => x[1]));
  // les dons de chaque paire, lus par leur id (le site de dev les renomme)
  assert.deepEqual(paires, [['nouvel-accord', 'echo'], ['balade-guerriere', 'amplification'], ['exaltation', 'touerk']]
    .map((paire) => paire.map((id) => echapper(nomDe('capacite', `capacites/barde-${id}`)))));
});

test('bandeau : « Don de départ » en tuiles ; classe magique (+4 AM) par catégorie ou par la spécialité ; classe raciale', options, () => {
  for (const { slug, html } of pages) assert.equal(compte(html, /class="classe-stat[ "]/g), 3, `${slug} : santé, chakra, barrière de départ`);
  assert.match(page('barde'), /<strong>Classe magique<\/strong> \+4 AM de base/);
  assert.match(page('archimage'), /<strong>Classe magique<\/strong> \+4 AM de base/);
  assert.match(page('orios'), /<strong>Classe raciale<\/strong> de la race <a href="[^"]*\/races\/orios\/">Orios<\/a>/);
  assert.ok(!page('guerrier').includes('Classe magique'));
  // classe magique par une spécialité (classe sans catégorie magique, hors Archimage) : la base courante dit lesquelles (le don de la spécialité le dit,
  // et le site de dev réécrit ce don) ; la page les nomme dans son bandeau, par le nom du don (son cartouche), et marque leur onglet et leur panneau
  for (const { slug, html } of pages) {
    const classe = classes.get(`classes/${slug}`);
    const magiques = magiquesDe(classe);
    const parSaCategorie = (classe.categorie?.amBase ?? null) !== null || classe.id === CLASSE_MAGIQUE_HORS_CATEGORIE;
    const liens = magiques.map((c, i) => `${i > 0 ? ' ou ' : ''}<a href="#${echapper(c.specialite.ancre)}">${echapper(c.cartouche.nom)}</a>`).join('');
    if (!parSaCategorie && magiques.length) assert.ok(html.includes(`<strong>Classe magique</strong> avec la spécialité ${liens} : +${classe.amMagique} AM de base`), `${slug} : le bandeau`);
    else assert.ok(!html.includes('avec la spécialité <a'), `${slug} : pas de classe magique par une spécialité`);
    assert.equal(compte(html, /<span class="specialite__magique">\s*Classe magique · \+\d+ AM<\/span>/g), magiques.length, `${slug} : le panneau de chaque spécialité magique`);
    assert.equal(compte(html, /<span class="onglet__magique"[^>]*>\s*Classe magique · \+\d+ AM\s*<\/span>/g), magiques.length, `${slug} : l’onglet de chaque spécialité magique`);
  }
  // à l'import : l'Orios est une classe magique avec la spécialité Chaman (le don « Chaman » le dit), seule
  const orios = importees.get('classes/orios');
  assert.deepEqual(magiquesDe(orios).map((c) => [c.specialite.ancre, c.cartouche.nom]), [['specialite-chaman', 'Chaman']]);
  assert.equal(htmlDuRepereMagique(orios, { classeId: orios.id, amBase: orios.categorie?.amBase ?? null, amMagique: orios.amMagique, note: orios.categorie?.note ?? null }),
    '<li id="repere-magique"><strong>Classe magique</strong> avec la spécialité <a href="#specialite-chaman">Chaman</a> : +4 AM de base</li>');
});

test('inventaire : infobulle de l’objet (glossaire) et « ou » entre deux options ; tableau du Mage Bleu par magie', options, () => {
  const html = page('mage-bleu');
  assert.match(html, /class="inventaire__choix"/);
  const bulle = /<button type="button" class="objet" data-bulle="([^"]+)" aria-describedby="\1"/.exec(html);
  assert.ok(bulle, 'objet avec infobulle');
  assert.match(html, new RegExp(`<span class="bulle" role="tooltip" id="${bulle[1]}" hidden>`));
  assert.equal(compte(html, /class="annexe-classe__carte[" ]/g), 14);
  // une entrée liée à une magie : la classe de la magie (lib/palette-css.mjs), jamais une couleur en style
  assert.equal(compte(html, /<article class="annexe-classe__carte annexe-classe__carte--magie couleur-magie-[a-z0-9-]+">/g), 14);
  assert.match(html, /<article class="annexe-classe__carte annexe-classe__carte--magie couleur-magie-sang">/);
  assert.doesNotMatch(html, /<article class="annexe-classe__carte[^>]*style=/);
  assert.match(html, /<h3><a href="[^"]*\/magies\/magie-du-sang\/">SANG<\/a><\/h3>/);
});

test('fiche d’un don : « Don » dans le bandeau et lien vers le don sur la page de la classe', options, () => {
  if (historique.supprimee('page', { id: 'capacites/barde-nouvel-accord' })) return; // supprimée par le site de dev
  const fiche = fileURLToPath(new URL('../dist/capacites/barde-nouvel-accord/index.html', import.meta.url));
  const html = readFileSync(fiche, 'utf8');
  assert.match(html, /<span class="badge">Don<\/span>/);
  assert.match(html, /href="[^"]*\/classes\/barde\/#don-barde-nouvel-accord"/);
  assert.ok(ids(page('barde')).includes('don-barde-nouvel-accord'));
});

test('/classes/ : une colonne par catégorie dans sa couleur, une pastille par classe (modèle de la carte des magies) ; noms = titres, description en infobulle', options, () => {
  const html = main(readFileSync(join(dossier, 'index.html'), 'utf8'));
  // la couleur d'une colonne : la classe de sa catégorie (lib/palette-css.mjs, famille `classe`, émise par la page), jamais un style
  const colonnes = [...html.matchAll(/<section class="classes-groupe (couleur-classe-[a-z]+)" id="([^"]+)">\s*<h2 class="classes-groupe__titre">\s*<span class="classes-groupe__point" aria-hidden="true"><\/span>\s*<span class="classes-groupe__nom">([^<]+)</g)];
  assert.deepEqual(
    colonnes.map(([, classe, id, titre]) => [id, classe, titre.trim()]),
    [
      ['melee', 'couleur-classe-melee', 'Physiques Mêlée'],
      ['distance', 'couleur-classe-distance', 'Physiques Distance'],
      ['magiques', 'couleur-classe-magiques', 'Magiques'],
      ['raciales', 'couleur-classe-raciales', 'Raciales'],
      ['speciales', 'couleur-classe-speciales', 'Spéciales'],
    ],
  );
  // les couleurs demandées par le propriétaire (rouge, vert, bleu, violet, jaune), dans la feuille de la page
  const liste = readFileSync(join(dossier, 'index.html'), 'utf8');
  assert.ok(liste.includes(`<style>${cssDesFamilles(['classe'])}</style>`), 'la feuille des catégories');
  assert.deepEqual(Object.values(CLASS_COLORS), ['#c62828', '#2e7d32', '#1e5bb8', '#7b3fa6', '#e3b104']);
  for (const [cle, couleur] of Object.entries(CLASS_COLORS)) assert.ok(liste.includes(`.couleur-classe-${cle}{--couleur:${couleur};`), cle);
  assert.doesNotMatch(html, /<section class="classes-groupe[^>]*style=/);
  // chaque classe rendue par le gabarit une fois, en pastille (point de couleur + nom), sous son titre (une classe raciale porte le nom de sa race)
  const liens = [...html.matchAll(/<a class="classe-pastille" href="[^"]*\/classes\/([^/"]+)\/"[^>]*>\s*<span class="classe-pastille__point" aria-hidden="true"><\/span>\s*<span class="classe-pastille__nom">([^<]+)<\/span>\s*<\/a>/g)].map(([, slug, nom]) => [slug, nom.trim()]);
  for (const { slug } of pages) assert.equal(liens.filter(([s]) => s === slug).length, 1, `${slug} : une fois dans le tableau`);
  assert.ok(!liens.some(([, nom]) => /\(classe\)/i.test(nom)), 'aucun « (classe) » (migration 0009)');
  assert.deepEqual(liens.find(([s]) => s === 'kitsune'), ['kitsune', 'Kitsune']);
  assert.ok(html.slice(html.indexOf('id="speciales"')).includes('/classes/parleur/'), 'le Parleur sous « Spéciales »');
  // infobulle : lien -> bulle cachée (role="tooltip"), `title` pour le cas sans JavaScript
  const bulles = [...html.matchAll(/<a class="classe-pastille" href="[^"]*" data-bulle="([^"]+)" aria-describedby="\1" title="([^"]+)">/g)];
  assert.ok(bulles.length >= 30, `${bulles.length} infobulles`);
  for (const [, id] of bulles) assert.match(html, new RegExp(`<span class="bulle" role="tooltip" id="${id}" hidden>`));
  // le nombre de classes de chaque colonne : leur somme est celle des pastilles (aucun nombre figé : le site et les migrations ajoutent des classes)
  const comptes = [...html.matchAll(/class="classes-groupe__compte">(\d+)</g)].map((m) => Number(m[1]));
  assert.ok(comptes.length >= 5 && comptes.every((n) => n > 0), 'une colonne par catégorie, chacune avec son nombre');
  assert.equal(comptes.reduce((a, n) => a + n, 0), liens.length, 'nombre de classes de la colonne');
  assert.ok(!/<table\b/.test(html) && !html.includes('classes-colonne'), 'plus de tableau');
});

test('fil d’Ariane d’une classe : sa catégorie, avec l’ancre de sa colonne', options, () => {
  assert.match(page('kitsune'), /Classes<\/a> › <a href="[^"]*\/classes\/#raciales">Raciales<\/a>/);
  assert.match(page('parleur'), /Classes<\/a> › <a href="[^"]*\/classes\/#speciales">Spéciales<\/a>/);
  assert.match(page('archer'), /Classes<\/a> › <a href="[^"]*\/classes\/#distance">Physiques Distance<\/a>/);
});

// R232 (4), qui remplace R191 : le mot-clé d'une classe raciale s'écrit comme sa race (« Orios »), sur toutes les pages ; plus aucune page n'admet
// « (classe) » (ni le Glossaire, ni la Recherche, ni Données, que R191 exceptait) : le fichier entier est lu, bulles et attributs compris.

// R191 étendue (réponse du propriétaire, « Rubrique Mots-clés (Recommandé) ») : « « Orios (classe) » est admis dans la rubrique « Mots-clés » des
// notes de version uniquement. C'est l'historique de la base, comme la page Données. R191 est étendue à ce seul endroit. » ; R232 (12) le garde : une
// note publiée reste telle quelle, elle garde le libellé qu'avait le mot-clé à sa publication. Sur /mise-a-jour/, seuls
// les blocs `details.nv-domaine[data-domaine="mots-cles"]` (lib/notes-de-version-rendu.mjs#htmlDeLaListe, de toute note rendue dans la page) sont
// retirés avant la recherche ; « (classe) » partout ailleurs sur la page reste une faute.
const NOTES_DE_VERSION = 'mise-a-jour/index.html';
/** Le HTML sans les blocs du domaine « Mots-clés » des notes de version, leurs `<details>` imbriqués compris. */
const sansLaRubriqueMotsCles = (html) => {
  const ouverture = /<details class="nv-domaine" data-domaine="mots-cles"[^>]*>/g;
  let sortie = '';
  let depuis = 0;
  for (let m; (m = ouverture.exec(html)); ) {
    sortie += html.slice(depuis, m.index);
    const balises = /<details\b|<\/details>/g;
    balises.lastIndex = ouverture.lastIndex;
    let profondeur = 1;
    for (let b; profondeur && (b = balises.exec(html)); ) profondeur += b[0] === '</details>' ? -1 : 1;
    assert.equal(profondeur, 0, 'le bloc « Mots-clés » des notes de version est fermé');
    depuis = ouverture.lastIndex = balises.lastIndex;
  }
  return sortie + html.slice(depuis);
};
const ecritClasse = (relatif, html) => /\(classe\)/i.test(relatif === NOTES_DE_VERSION ? sansLaRubriqueMotsCles(html) : html);

test('R191 étendue aux notes de version : « (classe) » admis dans la rubrique « Mots-clés » seulement, une faute partout ailleurs sur la page', () => {
  const domaine = (d, corps) => `<details class="nv-domaine" data-domaine="${d}" open><summary><h3>${d}</h3></summary><ul><li>${corps}</li></ul></details>`;
  const champ = (texte) => `<details class="nv-champ nv-champ--long"><summary>Texte</summary><ins>${texte}</ins></details>`;
  const motsCles = domaine('mots-cles', `Orios (classe) ${champ('Anansi (classe)')} Fenrir (classe)`);
  assert.equal(ecritClasse(NOTES_DE_VERSION, `<main>${motsCles}${motsCles}</main>`), false, 'deux notes, <details> imbriqués compris');
  for (const faute of [
    `<h1>Orios (classe)</h1>${motsCles}`,
    `${motsCles}<p>Orios (classe)</p>`,
    `${motsCles}${domaine('classes', 'Orios (classe)')}`,
    `${domaine('mots-cles', champ('Orios'))} Orios (classe)`,
    `<a title="Orios (classe)">Orios</a>${motsCles}`,
  ]) assert.equal(ecritClasse(NOTES_DE_VERSION, faute), true, faute);
  assert.equal(ecritClasse('classes/orios/index.html', motsCles), true, 'la rubrique n’est admise que sur la page des notes de version');
});

test('« (classe) » supprimé de partout (migration 0009 ; R232 (4), qui remplace R191), sauf dans la rubrique « Mots-clés » des notes de version (R232 (12)) : aucune page construite ne l’écrit, Glossaire, Recherche et Données compris, bulles comprises ; la classe raciale porte le nom de sa race', options, () => {
  const wiki = join(dossier, '..');
  const fautives = [];
  const parcourir = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const chemin = join(d, e.name);
      const relatif = chemin.slice(wiki.length).replace(/^[\\/]+/, '').split(/[\\/]/).join('/');
      if (e.isDirectory()) parcourir(chemin);
      else if (e.name.endsWith('.html') && ecritClasse(relatif, readFileSync(chemin, 'utf8'))) fautives.push(relatif);
    }
  };
  parcourir(wiki);
  assert.deepEqual(fautives, []);
  assert.ok(['regles/glossaire/index.html', 'recherche/index.html', 'donnees/index.html'].every((f) => existsSync(join(wiki, f))), 'les pages qu’exceptait R191 sont lues (le test ne passe pas à vide)');
  assert.match(page('orios'), /<h1[^>]*>\s*Orios\s*<\/h1>/);
});

test('page d’une classe : la couleur de sa catégorie de /classes/ par la classe de la catégorie (lib/palette-css.mjs, famille `classe`, émise par la page), jamais un style', options, () => {
  const couleurDe = (slug) => page(slug).match(/<div class="classe (couleur-classe-[a-z]+)" data-ed-classe="classes\/[^"]+"/)?.[1];
  assert.deepEqual(['guerrier', 'archer', 'mage', 'kitsune', 'archimage', 'flagelleur', 'parleur'].map(couleurDe),
    ['melee', 'distance', 'magiques', 'raciales', 'speciales', 'speciales', 'speciales'].map((k) => `couleur-classe-${k}`), 'le Parleur sous « Spéciales »');
  for (const p of pages) {
    assert.ok(couleurDe(p.slug), `${p.slug} : la classe de sa catégorie`);
    assert.ok(p.html.includes(`<style>${cssDesFamilles(['classe', 'don'])}</style>`), `${p.slug} : la feuille des catégories et des types de don`);
    assert.doesNotMatch(p.html, /--couleur-(?:classe|texte-classe):/, `${p.slug} : plus de couleur en style`);
  }
});

test('menu latéral d’une classe : les cinq catégories de /classes/ à dérouler, une seule à la fois, celle de la classe affichée ouverte', options, () => {
  const ordre = ['melee', 'distance', 'magiques', 'raciales', 'speciales'];
  const menuDe = (html) => {
    const m = main(html);
    const debut = m.indexOf('<nav class="classes-menu"');
    return { m, debut, menu: debut < 0 ? '' : m.slice(debut, m.indexOf('</nav>', debut)) };
  };
  for (const { slug, html } of pages) {
    const { m, debut, menu } = menuDe(html);
    assert.ok(debut >= 0, `${slug} : menu latéral`);
    assert.ok(debut < m.indexOf('<div class="classe couleur-classe-'), `${slug} : le menu à gauche, la page à droite`);
    // téléphone : un tiroir comme celui de la chronologie (réponse du propriétaire : « Sur mobile on le cachera dans un tiroir comme chronologie ») :
    // l'en-tête et sa croix, le bouton de la bande qui l'ouvre (fermé au build), le voile caché
    assert.ok(menu.startsWith('<nav class="classes-menu" id="classes-menu" aria-label="Classes" data-classes-menu>'), `${slug} : le menu et l'id du tiroir`);
    assert.match(menu, /<div class="classes-menu__entete">[\s\S]*?data-classes-fermer/, `${slug} : en-tête du tiroir et sa croix`);
    assert.match(m, /<button type="button" class="classes-ouvrir" aria-controls="classes-menu" aria-expanded="false" data-classes-ouvrir>/, `${slug} : le bouton de la bande`);
    assert.match(m, /<div class="classes-voile" data-classes-voile hidden><\/div>/, `${slug} : le voile du tiroir`);
    assert.equal(compte(m.slice(m.indexOf('class="classes-ouvrir__points"')), /class="classes-ouvrir__point couleur-classe-[a-z]+( est-courant)?"/g), 5, `${slug} : un point par type sur la bande`);
    // cinq <details> du même `name` (un seul ouvert à la fois), dans l'ordre et la couleur des colonnes de /classes/ ; un seul ouvert au build
    const groupes = [...menu.matchAll(/<details class="classes-menu__groupe couleur-classe-([a-z]+)" name="classes-menu"( open)?>/g)];
    assert.deepEqual(groupes.map(([, cle]) => cle), ordre, `${slug} : les cinq catégories`);
    const ouverts = groupes.filter(([, , open]) => open).map(([, cle]) => cle);
    // celle de la classe affichée : la même que sa couleur (Parleur sous « Spéciales » compris)
    const couleur = m.match(/<div class="classe couleur-classe-([a-z]+)"/)[1];
    assert.deepEqual(ouverts, [couleur], `${slug} : seule sa catégorie ouverte`);
    // chaque classe une fois ; la classe affichée marquée, dans le groupe ouvert
    const liens = [...menu.matchAll(/<a class="classes-menu__lien" href="[^"]*\/classes\/([^/"]+)\/"( aria-current="page")?>/g)];
    for (const p of pages) assert.equal(liens.filter(([, s]) => s === p.slug).length, 1, `${slug} : ${p.slug} une fois dans le menu`);
    assert.deepEqual(liens.filter(([, , c]) => c).map(([, s]) => s), [slug], `${slug} : la classe affichée marquée`);
    const groupeOuvert = menu.slice(menu.indexOf(' name="classes-menu" open>'));
    assert.ok(groupeOuvert.slice(0, groupeOuvert.indexOf('</details>')).includes('aria-current="page"'), `${slug} : marquée dans son groupe`);
  }
  assert.match(menuDe(page('parleur')).menu, /couleur-classe-speciales" name="classes-menu" open>/, 'le Parleur : « Spéciales » ouvert');
  assert.match(menuDe(page('kitsune')).menu, /couleur-classe-raciales" name="classes-menu" open>/);
});

test('menu latéral d’une classe, téléphone : la feuille du tiroir (bande fixée à gauche, tiroir par-dessus la page depuis la gauche, voile)', options, () => {
  const css = readFileSync(fileURLToPath(new URL('../src/styles/classe/menu.css', import.meta.url)), 'utf8');
  const telephone = css.slice(css.indexOf('@media (max-width: 56rem) {'), css.indexOf('@media (max-width: 56rem) and (prefers-reduced-motion'));
  const regleTel = (selecteur) => {
    const i = telephone.indexOf(`\n  ${selecteur} {`);
    assert.ok(i >= 0, `règle du téléphone ${selecteur}`);
    return telephone.slice(i, telephone.indexOf('}', i));
  };
  assert.match(regleTel('html.js .classe-cadre'), /grid-template-columns: 2\.25rem minmax\(0, 1fr\);/, 'la bande à gauche, la page à côté');
  assert.match(regleTel('html.js .classe-cadre :is(.classes-menu, .classes-ouvrir)'), /position: fixed;[\s\S]*top: var\(--mini-haut[\s\S]*bottom: var\(--mini-bas/, 'la bande reste à l’écran pendant la lecture');
  assert.match(regleTel('html.js .classe-cadre .classes-menu.est-ouvert'), /position: fixed;[\s\S]*inset: 0 auto 0 0;/, 'le tiroir, par-dessus la page, depuis la gauche');
  assert.match(regleTel('html.js .classes-voile:not([hidden])'), /position: fixed;[\s\S]*background: var\(--voile-tiroir\)/, 'le voile');
  // la page construite charge cette feuille
  assert.ok(page('guerrier').includes('.classes-menu.est-ouvert'), 'la feuille du menu dans la page');
});
