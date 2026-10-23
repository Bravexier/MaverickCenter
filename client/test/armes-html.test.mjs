// Onglet Armes de la page /ressources/equipement/ construite (dist/ ; avant, la page /ressources/armes/ : test/equipement-html.test.mjs pour la page et
// ses onglets) : rendu depuis les tables (pas de tableau Markdown), deux menus à onglets, mêlée puis distance (demande du propriétaire, 2026-10-23),
// un onglet et un tableau par famille sans les armes de monstres, les colonnes voulues par le propriétaire, les lignes de départ en bleu avec leur infobulle, la description en infobulle du nom, les compétences
// en couleur (décision R48) et leur filtre, le panneau de règles (migration 0056 : ses blocs dans l'ordre de la base, tuiles et leurs titres, la mise
// en forme du classeur), les matériaux dans leur couleur, les améliorations, les champs du mode modification (une famille : nom, dé, en-tête de coût,
// décision R159), les onglets gardés en mode modification, les modèles d'une famille créée (le même HTML que celui d'une famille de la base), l'infobulle
// du dé d'une famille (les paliers selon la Force que sa note écrit : PUGILAT ; demande du propriétaire, 2026-10-23). Se saute
// sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMPETENCES_D_ARME } from '../src/lib/arme-champs.mjs';
import { ancreDArme, ancreDeMateriau, chargerArmes, contexteDesArmes } from '../src/lib/armes-db.mjs';
import {
  ancreDArmeElementaire, COLONNES_D_UNE_ARME, htmlDeFamilleDepuisModele, htmlDeLigneDArmeElementaire, htmlDesEffets, htmlDuCoutElementaire, MODELE_DE_FAMILLE,
  RENDUS_DES_ARMES,
} from '../src/lib/armes-rendu.mjs';
import { texteDuCoutElementaire } from '../src/lib/arme-forge.mjs';
import { CLASSE_DES_ARMES_DE_DEPART, classeDeMagie, classeDeMateriau, cssDesFamilles } from '../src/lib/palette-css.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';
import { desSelonLaForce } from '../src/lib/maitrise-arme.mjs';
import { chargerPanneau } from '../src/lib/panneaux-regles-db.mjs';
import { htmlAvecMotsCles, texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'equipement', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
// le panneau de l'onglet Armes : de sa <section> au bloc des armures, qui le suit (components/equipement/EquipementPage.astro)
const main = html.slice(html.indexOf('<section class="equipement-panneau is-active" id="armes"'), html.indexOf('<div class="armures" data-armures>'));
const base = present ? ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }) : null;
const armes = present ? chargerArmes(base) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
// les balises du glossaire, rendues par le middleware (src/middleware.mjs) : en gras dans le texte, en texte simple dans un attribut
const vocabulaire = present ? chargerVocabulaire(base) : [];
const commeLaPage = (h) => htmlAvecMotsCles(h, vocabulaire).html;
// l'infobulle de la pastille du dé d'une famille : les paliers selon la Force que sa note écrit, lus dans la base (PUGILAT : « D6 1-2 Force, D8 3-4
// Force, D10 5 Force »), écrits comme le refus du dé du service ; sinon celle de toute famille
const INFOBULLE_PAR_DEFAUT = 'Dé de la famille, sauf indication contraire';
const infobulleDuDe = (f) => {
  const paliers = desSelonLaForce(f.note_brut);
  return paliers ? `Dé selon la Force : ${paliers.map((p) => `${p.de} ${p.min === p.max ? p.min : `${p.min}-${p.max}`} Force`).join(', ')}` : INFOBULLE_PAR_DEFAUT;
};
// la catégorie de chaque famille, lue dans la base (arme_famille.categorie, décision R127) : les deux menus à onglets, mêlée (`contact`) puis distance
const categorie = present ? Object.fromEntries(base.prepare('SELECT id, categorie FROM arme_famille').all().map((r) => [r.id, r.categorie])) : {};
const famillesAffichees = present ? ['contact', 'distance'].flatMap((c) => armes.familles.filter((f) => categorie[f.id] === c)) : [];

test('pas de tableau Markdown : l’onglet est le gabarit des armes, avec son panneau de règles replié et sans phrase au-dessus', options, () => {
  assert.ok(main.length > 1000, 'le panneau de l’onglet Armes');
  assert.match(main, /<div class="armes couleur-arme-depart" data-armes>(?:<template data-armes-piece="[A-Z]+">[\s\S]*?<\/template>)*<details class="preg" id="regles-armes" data-panneau-regles="armes">/, 'le panneau en tête');
  assert.ok(!main.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  assert.ok(!main.includes('armes__chapo'), 'plus de chapeau (demande du propriétaire, 2026-10-16)');
});

test('deux menus à onglets, « Armes de mêlée » puis « Armes à distance » (demande du propriétaire, 2026-10-23), groupés par la catégorie de la base (R127)', options, () => {
  // « Il faudrai réduire çà en deux menus à onglet. Un pour les armes de mêlée l'autre pour les armes à distances. » : chaque menu, un bloc (son
  // titre, sa barre seule, ses panneaux) ; l'onglet choisi est écrit dans l'adresse (« On peut retenir l'onglet ouvert #epee par exemple » : plus de
  // data-onglets-sans-adresse)
  const barres = [...main.matchAll(/<nav class="armes-onglets" aria-label="([^"]+)" data-onglets="([^"]+)">([\s\S]*?)<\/nav>/g)];
  assert.ok(!main.includes('data-onglets-sans-adresse'), 'les menus écrivent l’onglet choisi');
  assert.deepEqual(barres.map((m) => [m[1], m[2]]), [['Armes de mêlée', 'Armes de mêlée'], ['Armes à distance', 'Armes à distance']]);
  assert.match(main, /<section class="armes-bloc" id="armes-contact" aria-labelledby="armes-contact-titre" data-armes-bloc="contact"><h3 class="armes-bloc__titre" id="armes-contact-titre">Armes de mêlée<\/h3><nav class="armes-onglets"/);
  assert.match(main, /<section class="armes-bloc" id="armes-distance" aria-labelledby="armes-distance-titre" data-armes-bloc="distance"><h3 class="armes-bloc__titre" id="armes-distance-titre">Armes à distance<\/h3><nav class="armes-onglets"/);
  assert.ok(main.indexOf('data-armes-bloc="contact"') < main.indexOf('data-armes-bloc="distance"'), 'mêlée, puis distance');
  // l'ordre, celui de l'onglet (chargerArmes) dans chaque menu
  const blocs = { contact: main.slice(main.indexOf('data-armes-bloc="contact"'), main.indexOf('data-armes-bloc="distance"')), distance: main.slice(main.indexOf('data-armes-bloc="distance"'), main.indexOf('<aside class="armes-cote"')) };
  const vues = [];
  for (const [i, cat] of ['contact', 'distance'].entries()) {
    const attendues = armes.familles.filter((f) => categorie[f.id] === cat);
    assert.ok(attendues.length > 0, cat);
    // le nom et le dé suivent ceux du tableau en mode modification (data-ed-lecture, R159) ; le dé toujours écrit, caché s'il est vide
    const lecture = (colonne) => `data-ed-lecture="\\[&quot;arme_famille&quot;,\\{&quot;id&quot;:&quot;\\2&quot;\\},&quot;${colonne}&quot;\\]"`;
    const motif = new RegExp(`<a class="onglet( is-active)?" id="onglet-famille-([^"]+)" href="#famille-([^"]+)"><span class="onglet__nom" ${lecture('nom')}>([^<]+)</span><span class="onglet__de armes-onglets__de" title="[^"]+" ${lecture('de_brut')}( hidden)?>([^<]*)</span><span class="onglet__detail" data-armes-onglet-compte>([^<]+)</span></a>`, 'g');
    const onglets = [...barres[i][3].matchAll(motif)].map((m) => {
      assert.equal(Boolean(m[5]), !m[6], `${m[2]} : la pastille du dé cachée si et seulement si elle est vide`);
      return [m[0], m[1], m[2], m[3], m[4], m[6] || null, m[7]];
    });
    assert.equal(onglets.length, (barres[i][3].match(/class="onglet[ "]/g) ?? []).length, `${cat} : la barre n’a que ses onglets`);
    // chaque onglet vers le panneau de sa famille, avec son nom, la pastille de son dé et son nombre d'armes
    assert.deepEqual(onglets.map((m) => m[2]), attendues.map((f) => f.id), `${cat} : l’ordre de la base`);
    assert.ok(onglets.every((m) => m[2] === m[3]), `${cat} : chaque onglet pointe vers #famille-<id>`);
    // le nombre d'armes : toutes les lignes du tableau, ses armes élémentaires comprises (R167)
    const n = (f) => f.armes.length + f.armes_elementaires.length;
    assert.deepEqual(onglets.map((m) => [m[4], m[5] ?? null, m[6]]), attendues.map((f) => [echapper(f.nom), f.de_brut ? echapper(f.de_brut) : null, `${n(f)} arme${n(f) > 1 ? 's' : ''}`]), cat);
    assert.deepEqual(onglets.map((m) => Boolean(m[1])), attendues.map((_, k) => k === 0), `${cat} : un seul onglet ouvert, le premier`);
    // les panneaux : le tableau de chaque famille (gabarit commun, qui ne se replie plus), dans le même ordre, le seul ouvert celui de l'onglet ouvert
    const panneaux = [...blocs[cat].matchAll(/<(details|section) class="tableau armes-famille( is-active)?" id="famille-([^"]+)"/g)];
    assert.deepEqual(panneaux.map((m) => m[3]), attendues.map((f) => f.id), `${cat} : les panneaux`);
    assert.ok(panneaux.every((m) => m[1] === 'section'), `${cat} : plus de tableau repliable`);
    assert.deepEqual(panneaux.map((m) => Boolean(m[2])), attendues.map((_, k) => k === 0), `${cat} : un seul panneau ouvert`);
    vues.push(...attendues.map((f) => f.id));
  }
  // toutes les familles de l'onglet, sans les armes de monstres (R45)
  assert.deepEqual(vues, famillesAffichees.map((f) => f.id));
  assert.deepEqual([...vues].sort(), armes.familles.map((f) => f.id).sort(), 'chaque famille de l’onglet une fois');
  assert.ok(!vues.includes('arme-de-monstres'));
  // plus de « Tout déplier » ni « Tout replier » : les tableaux ne se replient plus
  assert.ok(!main.includes('Tout déplier') && !main.includes('Tout replier') && !main.includes('data-armes-tout'));
});

test('une ligne par arme, dans l’ordre de l’onglet (mêlée, puis distance) ; identifiants uniques', options, () => {
  const lignes = [...main.matchAll(/<tr class="arme(?: arme--depart)?" id="([^"]+)" data-arme=/g)].map((m) => m[1]);
  assert.deepEqual(lignes, famillesAffichees.flatMap((f) => f.armes.map((a) => ancreDArme(a.id))));
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('colonnes : Nom, Compétence, Type, Dégâts, Type de dégâts, Portée, Solidité, Origine ; Description, Coût, Effet, départ et Remarque en mode modification', options, () => {
  const tete = main.slice(main.indexOf('<thead>'), main.indexOf('</thead>'));
  const colonnes = [...tete.matchAll(/<th scope="col"(?: class="ed-seul")?>(.*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
  // « Solidité » partout à la place de « Durabilité » : l'en-tête est le mot-clé du glossaire, sa définition en infobulle (migration 0058)
  assert.deepEqual(colonnes.slice(0, 8), ['Nom', 'Compétence', 'Type', 'Dégâts', 'Type de dégâts', 'Portée', 'Solidité', 'Origine']);
  assert.match(tete, /<th scope="col"><strong class="mot-cle" data-mot-cle="solidite" data-bulle="mot-cle-solidite"[^>]*>Solidité<\/strong><\/th>/);
  assert.ok(!/durabilit/i.test(main.replace(/data-[\w-]*durabilite[\w-]*(="[^"]*")?|arme-bulle-durabilite|arme__durabilite|arme-durabilite/g, '')), 'plus de « durabilité » affichée');
  assert.equal(colonnes.length - 5, COLONNES_D_UNE_ARME);
  assert.equal((tete.match(/class="ed-seul"/g) ?? []).length, 5);
  assert.equal(colonnes.at(-1), 'Remarque');
});

test('effets supplémentaires sur une seconde ligne, sous l’arme (comme l’effet d’un sort choisi dans la fiche) : une par arme, effet en lecture', options, () => {
  for (const a of armes.familles.flatMap((f) => f.armes)) {
    const debut = main.indexOf(`id="${ancreDArme(a.id)}"`);
    const fin = main.indexOf('</tr>', debut) + 5;
    const suite = main.slice(fin, main.indexOf('</tr>', fin) + 5);
    assert.ok(suite.startsWith(`<tr class="arme-suite" data-arme-suite="${echapper(a.id)}"><td class="arme-suite__marge"></td><td class="arme__effets" colspan="${COLONNES_D_UNE_ARME - 1}" data-ed-lecture="${echapper(attributEd('arme', { id: a.id }, 'effet'))}" data-ed-rendu="arme-effets">`), a.id);
    assert.ok(suite.includes(commeLaPage(htmlDesEffets(a.effet))), `${a.id} : ses effets supplémentaires`);
    assert.ok(!main.slice(debut, fin).includes('class="arme__effets"'), `${a.id} : plus dans la ligne de l’arme`);
  }
});

test('armes de départ en bleu avec l’infobulle « Arme de départ » ; description en infobulle du nom ; remarque en étoile ; compétences en couleur', options, () => {
  for (const a of armes.familles.flatMap((f) => f.armes)) {
    const debut = main.indexOf(`id="${ancreDArme(a.id)}"`);
    const ligne = main.slice(main.lastIndexOf('<tr', debut), main.indexOf('</tr>', debut));
    assert.equal(ligne.includes('arme--depart') && ligne.includes('title="Arme de départ"'), a.depart_possible === 1, a.id);
    if (a.description) assert.ok(ligne.includes(`title="${echapper(texteSansBalises(a.description, vocabulaire))}"`), `${a.id} : description en infobulle`);
    assert.ok(ligne.includes(`data-ed="${echapper(attributEd('arme', { id: a.id }, 'effet'))}"`), `${a.id} : effet modifiable`);
    // la remarque (demande du propriétaire, décision R91) : modifiable dans sa colonne, l'étoile à côté du nom refaite depuis la ligne (en lecture)
    assert.ok(ligne.includes(`<td class="arme__remarque-texte ed-seul" data-ed="${echapper(attributEd('arme', { id: a.id }, 'remarque'))}">`), `${a.id} : remarque modifiable`);
    assert.ok(ligne.includes(`<span class="arme__note" data-ed-lecture="${echapper(attributEd('arme', { id: a.id }, 'remarque'))}" data-ed-rendu="arme-remarque">`), `${a.id} : étoile en lecture`);
    assert.equal(ligne.includes('class="arme__remarque"'), Boolean(a.remarque), `${a.id} : une étoile seulement avec une remarque`);
    assert.match(ligne, /<span class="arme-comp[^"]*" data-competences="(arme-lourde|arme-legere|arc|arbalete)( arme-legere)?"/, a.id);
  }
});

test('filtre par compétence (Lourde, Légère, Arc, Arbalète, à bascule, dans la couleur de leur caractéristique : décision R48) et « Arme de départ »', options, () => {
  const debut = main.indexOf('<div class="armes-filtre js-seul" role="group"');
  assert.ok(debut > 0, 'le filtre');
  const filtre = main.slice(debut, main.indexOf('</div>', debut));
  // la couleur : la classe de la caractéristique et celle de son second rang (lib/palette-css.mjs), jamais un style
  const boutons = [...filtre.matchAll(/<button type="button" class="arme-comp armes-filtre__choix (couleur-caracteristique-[\w-]+) couleur-2-caracteristique-[\w-]+" data-competence="([^"]+)" aria-pressed="false" title="([^"]+)">([^<]+)<\/button>/g)]
    .map(([tout, classe, id, titre, libelle]) => [tout, id, classe, titre, libelle]);
  assert.deepEqual(boutons.map((m) => m[1]), Object.keys(COMPETENCES_D_ARME));
  assert.deepEqual(boutons.map((m) => m[4]), ['Lourde', 'Légère', 'Arc', 'Arbalète']);
  const couleur = Object.fromEntries(boutons.map((m) => [m[4], m[2]]));
  assert.equal(couleur.Arc, couleur.Lourde, 'l’Arc a la couleur de la Force, comme l’Arme Lourde');
  assert.notEqual(couleur['Arbalète'], couleur.Lourde);
  assert.deepEqual(couleur, { Lourde: 'couleur-caracteristique-force', Légère: 'couleur-caracteristique-agilite', Arc: 'couleur-caracteristique-force', Arbalète: 'couleur-caracteristique-perception' }, 'R48');
  assert.doesNotMatch(main, /class="arme-comp[^"]*"[^>]*style=/, 'aucune couleur de compétence en style');
  // chaque pastille : la classe de la première caractéristique et le second rang de la seconde (ou de la même), émis par l'onglet
  const pastilles = [...main.matchAll(/<span class="arme-comp(?: arme-comp--deux)? (couleur-caracteristique-[\w-]+) (couleur-2-caracteristique-[\w-]+)"/g)];
  assert.ok(pastilles.length > 0, 'des pastilles de compétence');
  for (const m of pastilles) assert.ok(html.includes(`.${m[2]}{`), `${m[2]} : émise par la page`);
  // une arme de deux compétences (R48) : le premier rang est la caractéristique de sa première compétence, le second celle de la seconde
  // (invariant, quelles que soient les armes du site de dev), et au moins une arme a deux caractéristiques distinctes (le dégradé)
  const caracDe = Object.fromEntries(boutons.map((m) => [m[1], m[2].replace('couleur-caracteristique-', '')]));
  const deux = [...main.matchAll(/<span class="arme-comp arme-comp--deux couleur-caracteristique-([\w-]+) couleur-2-caracteristique-([\w-]+)" data-competences="([^"]+)"/g)];
  assert.ok(deux.length > 0, 'des armes de deux compétences');
  for (const [, premiere, seconde, competences] of deux) {
    const [c1, c2] = competences.split(' ');
    assert.deepEqual([premiere, seconde], [caracDe[c1], caracDe[c2]], competences);
  }
  assert.ok(deux.some(([, premiere, seconde]) => premiere !== seconde), 'au moins un second rang distinct du premier');
  assert.match(filtre, /data-armes-filtre-tout hidden>Toutes</);
  assert.ok(!main.includes('Précision'), 'plus de « Précision »');
  // chaque ligne porte ses compétences, toutes parmi celles du filtre (lib/armes-filtres.mjs les lit)
  for (const m of main.matchAll(/<td class="arme__competence"[^>]*><span class="arme-comp[^"]*" data-competences="([^"]+)"/g)) {
    assert.ok(m[1].split(' ').every((id) => id in COMPETENCES_D_ARME), m[1]);
  }
  assert.match(main, /<span data-armes-compte>\d+ armes<\/span>/);
  // « Arme de départ » : un bouton du filtre (avec JavaScript), la légende sans
  assert.match(filtre, /<button type="button" class="armes-filtre__depart" data-armes-filtre-depart aria-pressed="false" title="[^"]+">Arme de départ<\/button>/);
  assert.match(main, /<p class="armes-legende sans-js"><span class="armes-legende__depart" title="Arme de départ">Arme de départ<\/span><\/p>/);
});

test('panneau de règles (migration 0056) : son titre, ses blocs dans l’ordre de la base (texte ou tuile, titres des tuiles), la mise en forme du classeur, la phrase des armes de départ en bleu', options, () => {
  const panneau = chargerPanneau(base, 'armes');
  const debut = main.indexOf('<details class="preg" id="regles-armes" data-panneau-regles="armes">');
  assert.ok(debut > 0 && panneau);
  const regles = main.slice(debut, main.indexOf('</details>', debut));
  assert.ok(regles.includes(`<summary class="preg__titre"><span data-ed="${attributEd('panneau_regles', { id: 'armes' }, 'titre').replace(/"/g, '&quot;')}">${echapper(panneau.titre)}</span></summary>`), 'le titre, un champ du mode modification');
  const blocs = [...regles.matchAll(/<div class="preg-bloc preg-bloc--(texte|tuile)" data-preg-bloc="(\d+)" data-preg-ordre="(\d+)"/g)].map((m) => [m[1], Number(m[2]), Number(m[3])]);
  assert.deepEqual(blocs, panneau.blocs.map((b) => [b.tuile ? 'tuile' : 'texte', b.rang, b.ordre]));
  const titres = [...regles.matchAll(/<p class="preg-bloc__titre" data-ed-cadre( hidden)?><span data-ed="[^"]+">([^<]*)<\/span><\/p>/g)].map((m) => [m[2], Boolean(m[1])]);
  assert.deepEqual(titres, panneau.blocs.filter((b) => b.tuile).map((b) => [echapper(b.titre ?? ''), !b.titre]), 'le titre de chaque tuile, caché s’il est vide');
  // la mise en forme du classeur, tant que le bloc l'écrit
  if (panneau.blocs.some((b) => b.texte.includes('**Les armes en bleu sont'))) {
    assert.match(regles, /<p class="armes__phrase-depart"><strong>Les armes en bleu sont les armes possibles en arme de départ\.<\/strong><\/p>/);
  }
  if (panneau.blocs.some((b) => b.texte.includes('***CAS PARTICULIERS :***'))) {
    assert.match(regles, /<p><em><strong>CAS PARTICULIERS :<\/strong><\/em><\/p>|<p><strong><em>CAS PARTICULIERS :<\/em><\/strong><\/p>/);
  }
  assert.ok(!/\*{2,3}(Les armes|CAS)/.test(regles), 'aucune marque Markdown laissée telle quelle');
});

test('à côté des tableaux, toujours affiché : la fiche (un seul cadre, vide au départ, remplie par le script), puis les matériaux et les améliorations côte à côte', options, () => {
  const cote = main.slice(main.indexOf('<aside class="armes-cote"'), main.indexOf('</aside>'));
  // « Avoir l'endroit de l'arme en permanence visible comme c'est le cas pour l'armure » (demande du propriétaire, 2026-10-16) : la fiche n'est plus cachée
  assert.match(cote, /^<aside class="armes-cote"[^>]*>\s*<section class="arme-fiche" aria-label="Fiche de l’arme" aria-live="polite">\s*<p class="arme-fiche__vide">Choisissez une arme[^<]+<\/p>\s*<\/section>\s*<div class="armes-cote__tables">\s*<details class="tableau armes-famille armes-materiaux"/);
  assert.match(cote, /<\/details>\s*<details class="tableau armes-famille armes-ameliorations"/);
  assert.ok(!cote.includes('arme-resume') && !cote.includes('armes-cote__haut'), 'plus de second cadre');
  // les infobulles des tuiles de la fiche : écrites par le script hors du panneau, qui défile
  assert.match(main, /<\/aside>\s*<\/div>\s*<div class="armes-bulles" data-armes-bulles><\/div>/);
});

test('matériaux : toute la ligne dans leur couleur, prix en RO, effets en morceaux ; améliorations +1 à +10 sans ligne Total ; le fer est le matériau par défaut', options, () => {
  for (const m of armes.materiaux) {
    // la couleur sur la ligne entière (demande du propriétaire, 2026-10-16 : « La ligne tout entière devrait prendre la couleur du matériau ») : la
    // classe du matériau (lib/palette-css.mjs, famille `materiau`), jamais un style
    assert.ok(main.includes(`<tr class="materiau ligne-couleur ${classeDeMateriau(m.ligne.ressource_id)}" id="${ancreDeMateriau(m.ligne.ressource_id)}" data-materiau="${m.ligne.ressource_id}"${m.nom === 'Fer' ? ' data-defaut="1"' : ''}>`), m.nom);
  }
  assert.ok(!main.includes('<th scope="row" class="materiau__nom" style='), 'plus de couleur sur la seule case du nom');
  assert.doesNotMatch(main, /style="[^"]*--mat\b/, 'plus de --mat en style');
  // l'onglet émet les familles qu'il pose (les matériaux, le bleu des armes de départ, posé sur `.armes`)
  assert.ok(html.includes(`<style>${cssDesFamilles(['materiau', 'arme'])}</style>`), 'la feuille des matériaux et des armes de départ');
  assert.equal(CLASSE_DES_ARMES_DE_DEPART, 'couleur-arme-depart');
  // les effets sur une ligne (styles/armes/armes.css) : le bonus aux dégâts, puis les autres effets, en morceaux frères ; le mot « Dégâts » reste pour
  // les lecteurs d'écran (les effets se modifient sur la page Composants, R62 : le test lit ceux de la base)
  for (const m of armes.materiaux) assert.ok(main.includes(commeLaPage(RENDUS_DES_ARMES['materiau-effet'](m.ligne.effet_brut))), `${m.nom} : ses effets`);
  const avecBonus = armes.materiaux.map((m) => RENDUS_DES_ARMES['materiau-effet'](m.ligne.effet_brut)).filter((h) => h.includes('materiau-effet__bonus'));
  assert.ok(avecBonus.length > 0);
  for (const h of avecBonus) assert.match(h, /^<span class="materiau-effet"[^>]*><span class="materiau-effet__bonus"><span class="materiau-effet__mot">Dégâts <\/span>[+−]\d+<\/span>(<span class="materiau-effet__(cran|secondaire)">[^<]+<\/span>)*<\/span>$/);
  assert.deepEqual(armes.materiaux.filter((m) => m.defaut).map((m) => m.nom), ['Fer']);
  assert.equal([...main.matchAll(/<tr class="amelioration" id="amelioration-(\d+)"/g)].length, armes.ameliorations.length);
  // « La ligne "total" des améliorations est inutile » (demande du propriétaire, 2026-10-16)
  const ameliorations = main.slice(main.indexOf('id="ameliorations-arme"'), main.indexOf('</details>', main.indexOf('id="ameliorations-arme"')));
  assert.ok(!ameliorations.includes('<tfoot>') && !main.includes('data-armes-total'));
  for (const [abr, id] of [['PP', 'pp'], ['RO', 'ro'], ['RF', 'rf']]) {
    assert.ok(main.includes(`<template data-armes-piece="${abr}"><span class="piece piece--${id}"`), `l’icône ${abr} que reprend le script`);
  }
  // les matériaux en lecture : leur référence est la page « Composants » (décision R62)
  assert.ok(!/<td class="materiau__(prix|effet)" data-ed=/.test(main));
});

test('le script de la page n’importe que lib/arme-forge.mjs et lib/armes-filtres.mjs, qu’aucun autre script de page n’importe', options, () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/armes.mjs', import.meta.url)), ['../lib/arme-forge.mjs', '../lib/armes-filtres.mjs']);
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'armes.mjs')) {
    const autres = imports(new URL(nom, scripts)).filter((m) => /\/(arme-forge|armes-filtres)\.mjs$/.test(m));
    assert.deepEqual(autres, [], nom);
  }
});

test('mode modification : les onglets restent (« Je veux les onglets aussi ») — un panneau par menu, le titre de la famille ouverte montré, après les règles des onglets', options, () => {
  // demande du propriétaire, 2026-10-23 : « Je veux les onglets aussi », qui remplace pour l'affichage en onglets la demande antérieure « Quand le mode
  // Edition est lancé, il n'est pas possible de "sélectionner" une arme / matériau / amélioration, mais tous les tableaux sont visibles » : aucune règle
  // du mode modification ne cache les barres ni ne montre les panneaux fermés ; le titre de la famille (ses champs : nom, dé, R159) se montre, par une
  // règle de même spécificité que celle qui le cache sous html.js, et qui vient après elle
  const regle = (selecteur) => {
    const i = html.indexOf(`${selecteur} {`);
    assert.ok(i > 0, selecteur);
    return [i, html.slice(i, html.indexOf('}', i))];
  };
  regle('html.js .armes-bloc > .armes-famille:not(.is-active)');
  const [cacheTitre] = regle('html.js .armes-bloc > .armes-famille > .armes-famille__titre');
  const [iTitres, titres] = regle('body.ed-mode .armes-bloc > .armes-famille > .armes-famille__titre');
  assert.match(titres, /position: static;[^}]*clip: auto/);
  assert.ok(iTitres > cacheTitre, 'après la règle qui le cache');
  assert.doesNotMatch(html, /body\.ed-mode[^{]*\.armes-onglets/, 'les barres restent');
  assert.doesNotMatch(html, /body\.ed-mode[^{]*\.armes-famille:not\(\.is-active\)/, 'un seul panneau ouvert par menu');
  // les titres des menus restent : aucune règle du mode modification ne les cache
  assert.doesNotMatch(html, /body\.ed-mode[^{]*\.armes-bloc__titre/);
});

test('les familles d’un menu qui se suivent (sans JavaScript, à l’impression) gardent l’espace d’avant entre deux tableaux, jamais en mode onglets (mode modification compris)', options, () => {
  // l'espace entre deux tableaux de familles, celui de `.armes-tableaux` avant les menus (gap: 1.4rem)
  assert.match(html, /\.armes-tableaux \{[^}]*gap: 1\.4rem/);
  const suite = '.armes-bloc > .armes-famille:not(.est-filtree) ~ .armes-famille:not(.est-filtree)';
  assert.ok(html.includes(`html:not(.js) ${suite} { margin-top: 1.4rem; }`), 'sans JavaScript');
  const impression = html.slice(html.indexOf('@media print {', html.indexOf('.armes-onglets')));
  assert.ok(impression.slice(0, impression.indexOf('\n}')).includes(`  ${suite} { margin-top: 1.4rem; }`), 'à l’impression');
  // en mode onglets (html.js, mode modification compris), aucune marge entre familles : un seul panneau se voit
  assert.doesNotMatch(html, /html\.js \.armes-bloc > \.armes-famille[^{]*\{[^}]*margin/);
  assert.doesNotMatch(html, /body\.ed-mode \.armes-bloc > \.armes-famille[^{]*\{[^}]*margin/);
});

test('R159 : une famille se modifie dans l’en-tête de son tableau — son nom, son dé (toujours écrit, caché s’il est vide), l’en-tête de son coût', options, () => {
  const ed = (id, colonne) => echapper(attributEd('arme_famille', { id }, colonne));
  for (const f of famillesAffichees) {
    const debut = main.indexOf(`id="famille-${f.id}"`);
    const tableau = main.slice(debut, main.indexOf('</thead>', debut));
    assert.ok(tableau.includes(`<span class="tableau__nom armes-famille__nom" id="famille-${f.id}-titre" data-ed="${ed(f.id, 'nom')}">${echapper(f.nom)}</span>`), `${f.id} : son nom`);
    assert.ok(tableau.includes(`<span class="armes-famille__de" title="${echapper(infobulleDuDe(f))}" data-ed="${ed(f.id, 'de_brut')}" data-ed-cadre${f.de_brut ? '' : ' hidden'}>${echapper(f.de_brut ?? '')}</span>`), `${f.id} : son dé`);
    assert.ok(tableau.includes(`<th scope="col" class="ed-seul"><span data-ed="${ed(f.id, 'cout_libelle')}">${echapper(f.cout_libelle)}</span></th>`), `${f.id} : l’en-tête de son coût`);
  }
  // ARME DE MONSTRES reste hors de la page (R45) : aucun champ pour elle
  assert.ok(!main.includes('&quot;arme-de-monstres&quot;'));
});

test('le dé d’une famille dont la note écrit des dés selon la Force (PUGILAT) : ses paliers en infobulle, dans l’onglet et le titre du tableau, la note gardée ; les autres familles inchangées (demande du propriétaire, 2026-10-23)', options, () => {
  // « Inutile dans l'onglet des armes de changer ça. Juste l'indiquer suffit (en tooltip de la catégorie) » : la pastille du dé (« D6/D8/D10 »)
  const pugilat = famillesAffichees.find((f) => f.id === 'pugilat');
  assert.ok(pugilat && desSelonLaForce(pugilat.note_brut), 'PUGILAT : des paliers selon la Force dans sa note');
  assert.match(infobulleDuDe(pugilat), /^Dé selon la Force : D\d+ \d+(?:-\d+)? Force(?:, D\d+ \d+(?:-\d+)? Force)+$/);
  assert.ok(famillesAffichees.some((f) => !desSelonLaForce(f.note_brut)), 'des familles sans paliers');
  for (const f of famillesAffichees) {
    const attendu = `title="${echapper(infobulleDuDe(f))}"`;
    const onglet = main.match(new RegExp(`<a class="onglet(?: is-active)?" id="onglet-famille-${f.id}"[\\s\\S]*?</a>`))[0];
    assert.ok(onglet.includes(`<span class="onglet__de armes-onglets__de" ${attendu} `), `${f.id} : l’infobulle du dé de l’onglet`);
    const debut = main.indexOf(`id="famille-${f.id}"`);
    const titre = main.slice(debut, main.indexOf('</thead>', debut));
    assert.ok(titre.includes(`<span class="armes-famille__de" ${attendu} `), `${f.id} : l’infobulle du dé du titre du tableau`);
    if (desSelonLaForce(f.note_brut)) {
      assert.ok(!titre.includes(INFOBULLE_PAR_DEFAUT) && !onglet.includes(INFOBULLE_PAR_DEFAUT), f.id);
      // la note reste écrite sous le titre du tableau
      assert.ok(titre.includes(`<p class="tableau__note armes-famille__note">${echapper(f.note_brut.split('\n').join(' · '))}</p>`), `${f.id} : sa note`);
    } else {
      assert.ok(onglet.includes(`title="${INFOBULLE_PAR_DEFAUT}"`) && titre.includes(`title="${INFOBULLE_PAR_DEFAUT}"`), `${f.id} : l’infobulle de toute famille`);
    }
  }
});

test('R159 : les modèles d’une famille créée (onglet, tableau vide) donnent le HTML construit de chaque famille de la base, sans armes ; ids uniques', options, () => {
  const modeles = Object.fromEntries([...main.matchAll(/<template data-armes-modele="(onglet|famille)">([\s\S]*?)<\/template>/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(Object.keys(modeles), ['onglet', 'famille']);
  // après le panneau de côté et les bulles, hors des menus (que le filtre et les tests parcourent)
  assert.ok(main.indexOf('<template data-armes-modele="onglet">') > main.indexOf('data-armes-bulles'));
  // la famille fictive : des jetons qu'aucun identifiant ne donne (lib/text.mjs#normalize : jamais de « _ »)
  assert.ok(modeles.famille.includes(`id="famille-${MODELE_DE_FAMILLE.id}"`) && modeles.onglet.includes(`id="onglet-famille-${MODELE_DE_FAMILLE.id}"`));
  for (const f of famillesAffichees) {
    // le compte construit : ses armes et ses armes élémentaires (R167 ; une famille créée n'en a aucune)
    const total = f.armes.length + (f.armes_elementaires?.length ?? 0);
    const n = `${total} arme${total > 1 ? 's' : ''}`;
    // l'onglet construit, fermé, son compte celui d'une famille vide
    const onglet = main.match(new RegExp(`<a class="onglet(?: is-active)?" id="onglet-famille-${f.id}"[\\s\\S]*?</a>`))[0]
      .replace('class="onglet is-active"', 'class="onglet"').replace(`data-armes-onglet-compte>${n}<`, 'data-armes-onglet-compte>0 arme<')
      .replace(` title="${echapper(infobulleDuDe(f))}"`, ` title="${INFOBULLE_PAR_DEFAUT}"`);
    assert.equal(htmlDeFamilleDepuisModele(modeles.onglet, f), onglet, `${f.id} : l’onglet`);
    // le tableau construit, fermé, sans armes ni note (une famille créée n'en a pas : l'infobulle de son dé est celle de toute famille)
    const debut = main.indexOf(`<section class="tableau armes-famille`, main.indexOf(`id="famille-${f.id}"`) - 60);
    const tableau = main.slice(debut, main.indexOf('</section>', debut) + '</section>'.length)
      .replace('class="tableau armes-famille is-active"', 'class="tableau armes-famille"')
      .replace(/ data-note="[^"]*"/, ' data-note')
      .replace(` title="${echapper(infobulleDuDe(f))}"`, ` title="${INFOBULLE_PAR_DEFAUT}"`)
      .replace(/<p class="tableau__note armes-famille__note">[^<]*<\/p>/, '')
      .replace(`armes-famille__compte">${n}<`, 'armes-famille__compte">0 arme<')
      .replace(/<tbody>[\s\S]*<\/tbody>/, '<tbody></tbody>');
    // les balises du glossaire du modèle (« {{solidite}} ») : le middleware ne rend rien dans un <template>, le site de dev les rend une fois posées
    assert.equal(commeLaPage(htmlDeFamilleDepuisModele(modeles.famille, f)), tableau, `${f.id} : le tableau`);
  }
  // aucun id du modèle n'est celui d'un élément de la page (test/equipement-html.test.mjs : identifiants uniques)
  const idsDuModele = [...`${modeles.onglet}${modeles.famille}`.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  const autres = [...main.replace(/<template data-armes-modele="(?:onglet|famille)">[\s\S]*?<\/template>/g, '').matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(idsDuModele.length >= 3 && idsDuModele.every((id) => !autres.includes(id)), idsDuModele.join(', '));
});

test('R159 : les modèles d’une famille créée sont posés là où l’éditeur peut se charger — jamais dans la version portable (pas de service)', () => {
  // la condition de components/edition/Edition.astro dans layouts/Base.astro (`edition && !portable`, portable = INLINE_CSS=1)
  const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
  assert.match(lire('../src/layouts/Base.astro'), /const portable = process\.env\.INLINE_CSS === '1';[\s\S]*\{edition && !portable && <Edition /);
  const page = lire('../src/components/armes/ArmesPage.astro');
  assert.match(page, /const avecModeles = process\.env\.INLINE_CSS !== '1';/);
  const modeles = [...page.matchAll(/^\s*(.*)<template data-armes-modele="(onglet|famille)">/gm)];
  assert.deepEqual(modeles.map((m) => [m[2], m[1]]), [['onglet', '{avecModeles && '], ['famille', '{avecModeles && ']]);
});

// Armes élémentaires (décision R167 ; design du propriétaire, 2026-10-23 : « Met juste directement l'arme élémentaire dans chaque tableau. » ; « en
// sélectionnant l'arme élémentaire en question ça affichera ou non la bonne colone du tableau "amélioration" et grisera le "matériau" »).

test('R167 : chaque famille affichée liste ses 14 armes élémentaires, à la suite de ses armes, dans l’ordre de la base, sur le fond de leur magie ; aucune pour ARME DE MONSTRES', options, () => {
  const contexte = contexteDesArmes(base);
  for (const f of famillesAffichees) {
    assert.equal(f.armes_elementaires.length, 14, f.id);
    const debut = main.indexOf(`id="famille-${f.id}"`);
    const tableau = main.slice(debut, main.indexOf('</table>', debut));
    const lignes = [...tableau.matchAll(/<tr class="arme( arme--depart| arme--elementaire [\w-]+)?" id="([^"]+)"/g)].map((m) => [m[2], m[1]?.includes('elementaire') ?? false]);
    // les armes du catalogue, puis les armes élémentaires (ordre de arme_elementaire.ordre)
    assert.deepEqual(lignes, [...f.armes.map((a) => [ancreDArme(a.id), false]), ...f.armes_elementaires.map((ae) => [ancreDArmeElementaire(ae.id), true])], f.id);
    for (const ae of f.armes_elementaires) {
      // la ligne telle que la rend lib/armes-rendu.mjs (balises du glossaire comprises, comme le middleware), sur la classe de sa magie
      const attendu = commeLaPage(htmlDeLigneDArmeElementaire(ae, { type: f.type_elementaire, solidite: armes.solidite_elementaire }, contexte));
      assert.ok(tableau.includes(attendu.slice(0, attendu.indexOf('<td class="arme__competence">'))), `${ae.id} : sa ligne`);
      assert.ok(tableau.includes(`<tr class="arme-suite arme-suite--elementaire ${classeDeMagie(ae.magie)}" data-arme-suite="${echapper(ae.id)}">`), `${ae.id} : ses effets`);
    }
  }
  assert.ok(!main.includes('famille-arme-de-monstres'));
  assert.equal((main.match(/<tr class="arme arme--elementaire /g) ?? []).length, famillesAffichees.length * 14);
  // jamais un style, et chaque classe de magie posée existe sur la page (la palette de chaque page : layouts/Base.astro)
  assert.doesNotMatch(main, /<tr class="arme(-suite)? arme(-suite)?--elementaire[^>]*style=/);
  for (const classe of new Set([...main.matchAll(/arme--elementaire (couleur-magie-[\w-]+)/g)].map((m) => m[1]))) assert.ok(html.includes(`.${classe}{`), classe);
  // le « [Métier à définir] » de la page source n'est pas affiché
  assert.ok(!main.includes('Métier à définir'));
});

test('R167 : le tableau des améliorations a ses deux colonnes de coût (matériel, élémentaire), l’une ou l’autre selon l’arme choisie ; le matériau grisé', options, () => {
  const debut = main.indexOf('id="ameliorations-arme"');
  const tableau = main.slice(debut, main.indexOf('</details>', debut));
  assert.ok(tableau.includes('<thead><tr><th scope="col">Niveau</th><th scope="col" class="amelioration__cout">Coût</th><th scope="col" class="amelioration__cout-elementaire">Coût élémentaire</th><th scope="col">Effet</th></tr></thead>'));
  for (const a of armes.ameliorations) {
    const cumul = a.niveau > 1 ? texteDuCoutElementaire(armes.couts_elementaires.find((c) => c.niveau === a.niveau), null) : '';
    assert.ok(tableau.includes(`<td class="amelioration__cout-elementaire">${htmlDuCoutElementaire(a, cumul)}</td>`), `+${a.niveau} : son coût élémentaire, le cumul en infobulle`);
  }
  assert.match(tableau, /<p class="tableau__note armes-famille__note js-seul armes-ameliorations__note-elementaire">Arme élémentaire : [^<]+<\/p>/);
  assert.match(main, /<p class="tableau__note armes-famille__note js-seul armes-materiaux__note-elementaire">Une arme élémentaire n’a pas de matériau\.<\/p>/);
  // la feuille : une seule colonne de coût avec JavaScript (le coût matériel, ou l'élémentaire avec `armes--elementaire`), les deux sans JavaScript et
  // en mode modification ; les matériaux grisés
  assert.ok(html.includes('html.js .armes:not(.armes--elementaire) .armes-ameliorations .amelioration__cout-elementaire,\nhtml.js .armes.armes--elementaire .armes-ameliorations .amelioration__cout { display: none; }'));
  assert.ok(html.includes('body.ed-mode .armes .armes-ameliorations :is(.amelioration__cout, .amelioration__cout-elementaire) { display: table-cell !important; }'));
  assert.ok(html.includes('html.js .armes--elementaire .armes-materiaux tbody { opacity: 0.45; }'));
  // la ligne « Aucune » (avec JavaScript seulement, une colonne de coût visible) couvre le coût et l'effet
  assert.match(tableau, /<tr class="amelioration amelioration--aucune js-seul-ligne" data-niveau="0">[\s\S]*?<td colspan="2" class="muted">Arme non améliorée<\/td><\/tr>/);
});
