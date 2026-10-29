// Les cinq pages de l'équipement construites (dist/ ; demande du propriétaire du 2026-10-29 : « Cinq pages séparées », libellés « Comme les onglets
// (pluriel) » ; avant, les cinq onglets d'une seule page « Équipement », /ressources/equipement/) : Armes, Armures, Boucliers, Ceinture, Accessoires,
// chacune à son adresse, son titre, son entrée du menu courante ; des identifiants uniques sur chaque page ; en tête de chaque page qui sert une page
// du wiki (et du sous-onglet Bâtons magiques de la Ceinture), son panneau de règles (migration 0056 : titre, blocs et tuiles dans l'ordre de la base,
// deux colonnes sur un grand écran, plus de phrase au-dessus ; son texte dans l'index de la recherche) ; le texte de la page « Pièces élémentaires »
// sur les pages Armes et Armures (« Fusionner dans Armes et Armures »), qui n'est plus construite ; l'ancienne page « Équipement » non plus, et chaque
// id d'une page y mène depuis l'ancienne adresse (lib/equipement.mjs#RENVOIS_DES_PAGES_ECLATEES, page 404) ; le sous-onglet des bâtons magiques de la
// ceinture (une ligne par magie, liens vers « Composants ») ; aucun lien du site vers les anciennes adresses ; chaque page garde son script, et n'a
// qu'un script d'onglets ; Armes et Armures, celui des Pièces élémentaires (écrit en ligne). Le contenu des pages Armes, Armures et Boucliers, Ceinture (et ses règles, tirées du guide), Accessoires :
// test/armes-html.test.mjs, armures-html.test.mjs, ceinture-html.test.mjs, accessoires-html.test.mjs. Se saute sans dist/ (npm run build) ; la CI le
// lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ANCIENNE_PAGE_DE_L_EQUIPEMENT, ANCRE_DES_PIECES_ELEMENTAIRES, PAGE_DES_PIECES_ELEMENTAIRES, PAGES_DE_L_EQUIPEMENT, PAGES_SERVIES_PAR_L_EQUIPEMENT,
  RENVOIS_DES_PAGES_ECLATEES,
} from '../src/lib/equipement.mjs';
import { chargerBatons } from '../src/lib/batons-db.mjs';
import { ancreDeBatons, classeDesBatons } from '../src/lib/batons-rendu.mjs';
import { couleurDeMagie, texteSurCouleur } from '../src/lib/sort-format.mjs';
import { cssDeLaPalette } from '../src/lib/palette-css.mjs';
import { adresseDePage, cheminDePage } from '../src/lib/metiers.mjs';
import { adresseDeRenvoi } from '../src/lib/nav.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';
import { chargerPanneau } from '../src/lib/panneaux-regles-db.mjs';
import { ancreDuPanneau } from '../src/lib/panneaux-regles-rendu.mjs';
import { texteDesPiecesElementaires } from '../src/lib/pieces-elementaires.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichierDe = (chemin) => join(dist, ...chemin.split('/').filter(Boolean), 'index.html');
const present = PAGES_DE_L_EQUIPEMENT.every((p) => existsSync(fichierDe(p.chemin)));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
/** Le HTML de chaque page de l'équipement, par id (« armes »…), et son `<main>`. */
const html = Object.fromEntries(PAGES_DE_L_EQUIPEMENT.map((p) => [p.id, present ? readFileSync(fichierDe(p.chemin), 'utf8') : '']));
const main = Object.fromEntries(Object.entries(html).map(([id, h]) => [id, h.slice(h.indexOf('<main'), h.indexOf('</main>'))]));
const base = present ? ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }) : null;
const batons = present ? chargerBatons(base) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** La page qui porte un panneau de règles (son id : celui de la page, ou du sous-onglet Bâtons magiques de la Ceinture). */
const pageDuPanneau = (ancre) => PAGES_DE_L_EQUIPEMENT.find((p) => p.chemin === PAGES_SERVIES_PAR_L_EQUIPEMENT.find((o) => o.ancre === ancre).chemin).id;
const panneauDesBatons = present ? main.ceinture.slice(main.ceinture.indexOf('<section class="ceinture-panneau batons" id="batons-magiques"')) : '';

test('cinq pages, chacune à son adresse : son titre, son panneau (`section.equipement-panneau#<id>`), son entrée du menu courante ; plus de barre d’onglets de page', options, () => {
  for (const p of PAGES_DE_L_EQUIPEMENT) {
    const m = main[p.id];
    assert.match(m, new RegExp(`<div class="equipement" data-equipement="${p.id}">\\s*<h1 id="titre-${p.id}">${p.nom} <span class="badge">Ressource</span></h1>`), `${p.id} : le titre`);
    assert.equal((m.match(/<h1[\s>]/g) ?? []).length, 1, `${p.id} : un seul titre de page`);
    assert.match(html[p.id], new RegExp(`<title>${p.nom}\\b`), `${p.id} : le titre du document`);
    const panneaux = [...m.matchAll(/<section class="([^"]*\bequipement-panneau\b[^"]*)" id="([a-z-]+)" aria-labelledby="titre-([a-z-]+)"/g)];
    assert.deepEqual(panneaux.map((x) => [x[2], x[3]]), [[p.id, p.id]], `${p.id} : un panneau, étiqueté par le titre de la page`);
    assert.ok(!/\bis-active\b/.test(panneaux[0][1]), `${p.id} : plus d’onglet de page`);
    assert.ok(!m.includes('equipement-onglets') && !m.includes('data-onglets="Équipement"') && !m.includes('equipement-panneau__titre'), `${p.id} : plus de barre d’onglets`);
    // la rubrique Équipement du menu (2026-10-29) : une entrée par page, vers son adresse ; celle de la page courante
    for (const q of PAGES_DE_L_EQUIPEMENT) {
      const entree = q === p ? `<a href="/${q.chemin}" aria-current="page">${q.nom}</a>` : `<a href="/${q.chemin}">${q.nom}</a>`;
      assert.ok(html[p.id].includes(entree), `${p.id} : l’entrée du menu ${q.nom}`);
    }
    assert.match(html[p.id], /data-group="equipement" aria-pressed="true" aria-current="true"/, `${p.id} : la rubrique Équipement, ouverte`);
    // un seul lien vers /ressources/ : l'entrée Autres du menu Équipement (« sous menu-autres », 2026-10-29), aucun dans la page
    assert.equal(html[p.id].split('href="/ressources/"').length - 1, 1, 'un seul lien vers /ressources/');
    assert.ok(html[p.id].includes('<a href="/ressources/">Autres</a>'), 'celui de l’entrée Autres du menu');
    // une entrée du menu, sans fil d'Ariane comme les autres (Races, Métiers, Artisanat…)
    assert.doesNotMatch(m, /<p class="muted"><a href="\/">Accueil<\/a>/);
  }
});

test('identifiants uniques sur chaque page ; chaque id d’une page y mène depuis l’ancienne page « Équipement » (page 404)', options, () => {
  const eclatees = RENVOIS_DES_PAGES_ECLATEES;
  for (const p of PAGES_DE_L_EQUIPEMENT) {
    const ids = [...main[p.id].matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual([...new Set(doublons)], [], p.id);
    // l'ancienne adresse /ressources/equipement/#<id> mène à cette page (les ids du glossaire, `mot-cle-…`, sont sur toute page qui cite le mot-clé ;
    // ceux des modèles d'une famille d'armes créée, `__id__`, ne sont jamais visés ; la section « Pièces élémentaires », sur Armes et Armures, n'était
    // pas sur l'ancienne page)
    for (const id of ids.filter((x) => !x.startsWith('mot-cle-') && !x.includes('__id__') && x !== ANCRE_DES_PIECES_ELEMENTAIRES)) {
      const renvoi = adresseDeRenvoi('/ressources/equipement/', { eclatees, hash: `#${id}` });
      assert.equal(renvoi.split('#')[0], `/${p.chemin}`, `#${id} → ${renvoi}`);
    }
  }
  const ids = (id) => [...main[id].matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ['materiaux-armes', 'ameliorations-arme']) assert.ok(ids('armes').includes(id), id);
  assert.ok(ids('armures').includes('ameliorations-armure'));
  assert.ok(ids('boucliers').includes('ameliorations-bouclier'));
});

test('panneaux de règles (migration 0056) : un par page servie, en tête de son panneau, sans phrase au-dessus ; replié sauf celui des accessoires ; son titre et ses blocs dans l’ordre de la base', options, () => {
  for (const { ancre: id } of PAGES_SERVIES_PAR_L_EQUIPEMENT) {
    const m = main[pageDuPanneau(id)];
    const panneau = chargerPanneau(base, id);
    assert.ok(panneau, `${id} : son panneau dans la base`);
    const debut = m.indexOf(`<details class="preg" id="${ancreDuPanneau(id)}" data-panneau-regles="${id}"`);
    assert.ok(debut > 0, `${id} : son panneau dans la page`);
    const tete = m.slice(debut, m.indexOf('>', debut) + 1);
    assert.equal(/ open>$/.test(tete), id === 'accessoires', `${id} : ouvert au départ ou non (comme avant)`);
    const panneauHtml = m.slice(debut, m.indexOf('</details>', debut));
    assert.ok(panneauHtml.includes(`<summary class="preg__titre"><span data-ed="${echapper(attributEd('panneau_regles', { id }, 'titre'))}">${echapper(panneau.titre)}</span></summary>`), `${id} : le titre`);
    const blocs = [...panneauHtml.matchAll(/<div class="preg-bloc preg-bloc--(texte|tuile)" data-preg-bloc="(\d+)"/g)].map((x) => [Number(x[2]), x[1]]);
    assert.deepEqual(blocs, panneau.blocs.map((b) => [b.rang, b.tuile ? 'tuile' : 'texte']), `${id} : les blocs dans l’ordre de lecture`);
    // le panneau de règles suit l'ouverture de son panneau, ou le titre du sous-onglet (rien entre les deux : plus de chapeau)
    const fin = id === 'batons-magiques' ? m.indexOf('</h3>', m.lastIndexOf(`id="titre-${id}">`, debut)) + 5 : m.indexOf('>', m.lastIndexOf('<section', debut)) + 1;
    const entre = m.slice(fin, debut).replace(/<template data-armes-piece="[A-Z]+">[\s\S]*?<\/template>/g, '');
    // (la page Armes porte la classe du bleu des armes de départ : lib/palette-css.mjs, famille `arme`)
    assert.match(entre, /^(?:<div class="(?:armes couleur-arme-depart|acc)" data-(?:armes|accessoires)>)?$/, `${id} : rien avant le panneau`);
  }
  // la Ceinture (qui ne sert pas de page du wiki) n'a pas de panneau de règles : elle garde ses règles tirées du guide (test/ceinture-html.test.mjs)
  assert.ok(!main.ceinture.includes('data-panneau-regles="ceinture"'));
  const tous = Object.values(main).join('');
  assert.equal((tous.match(/<details class="preg" /g) ?? []).length, PAGES_SERVIES_PAR_L_EQUIPEMENT.length, 'un panneau par page servie, pas d’autre');
  // plus de chapeau ni d'encart de règles dans les pages qui ont un panneau
  for (const c of ['armes__chapo', 'armures__chapo', 'batons__chapo', 'acc__chapo', 'armes-regles', 'armures-regles', 'batons-regles', 'acc-regles']) assert.ok(!tous.includes(c), c);
});

test('« Pièces élémentaires » fusionnée dans Armes et Armures : son texte, replié sous le panneau de règles, la partie de chaque page, en lecture ; sa page n’est plus construite', options, () => {
  const corps = base.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_PIECES_ELEMENTAIRES).corps_md;
  const titre = base.prepare('SELECT titre FROM page WHERE id = ?').get(PAGE_DES_PIECES_ELEMENTAIRES).titre;
  const debut = `<details class="preg preg--pieces-elementaires" id="${ANCRE_DES_PIECES_ELEMENTAIRES}"><summary class="preg__titre">${echapper(titre)}</summary>`;
  for (const [id, autre] of [['armes', 'armures'], ['armures', 'armes']]) {
    const m = main[id];
    const i = m.indexOf(debut);
    assert.ok(i > 0, `${id} : la section, repliée, titrée comme la page`);
    assert.ok(i > m.indexOf(`data-panneau-regles="${id}"`), `${id} : sous le panneau de règles`);
    const section = m.slice(i, m.indexOf('</details>', i));
    assert.ok(!section.includes('data-ed') && !section.includes('data-panneau-regles'), `${id} : en lecture`);
    const { markdown, parties } = texteDesPiecesElementaires(corps, id);
    const sienne = parties.find((n) => texteDesPiecesElementaires(corps, autre).markdown.includes(`▸ ${n}`) === false);
    if (sienne) assert.ok(section.includes(`▸ ${sienne}`), `${id} : sa partie « ▸ ${sienne} »`);
    for (const n of parties.filter((x) => !markdown.includes(`▸ ${x}`))) assert.ok(!section.includes(`▸ ${n}`), `${id} : pas la partie « ▸ ${n} »`);
    assert.ok(!section.replace(/ data-balise="[^"]*"/g, '').includes('{{') && !section.includes('[['), `${id} : balises et liens rendus`);
  }
  for (const id of ['boucliers', 'ceinture', 'accessoires']) assert.ok(!main[id].includes('class="preg preg--pieces-elementaires"'), `${id} : pas de section « Pièces élémentaires »`);
  assert.ok(!existsSync(join(dist, ...PAGE_DES_PIECES_ELEMENTAIRES.split('/'))), 'plus de page /ressources/pieces-elementaires/');
  // ses tableaux sont déjà sur les deux pages, rendus depuis les tables : les armes élémentaires dans chaque tableau des armes (R167) et la colonne
  // « Coût élémentaire » des améliorations ; le choix des armures élémentaires et leurs améliorations (R165)
  const elementaires = base.prepare('SELECT count(*) AS n FROM arme_elementaire').get().n;
  assert.equal((main.armes.match(/<tr class="arme arme--elementaire /g) ?? []).length, elementaires, 'toutes les armes élémentaires');
  assert.ok(main.armes.includes('class="amelioration__cout-elementaire"'));
  assert.equal((main.armures.match(/<div class="pelem-armure" /g) ?? []).length, base.prepare('SELECT count(*) AS n FROM armure_elementaire').get().n, 'toutes les armures élémentaires');
  assert.ok(main.armures.includes('id="ameliorations-armure-elementaire"'));
});

test('panneau des armes : les huit blocs de l’import dans l’ordre (tant que le site de dev ne l’a pas remanié), en tuiles les définitions, Dague, Arme de jet et le prix', options, () => {
  const panneau = chargerPanneau(base, 'armes');
  const genres = panneau.blocs.map((b) => (b.tuile ? `tuile:${b.titre ?? ''}` : 'texte'));
  const importe = ['texte', 'tuile:', 'tuile:', 'tuile:', 'texte', 'tuile:Dague', 'tuile:Arme de jet', 'tuile:Comment déterminer le prix de votre arme ?'];
  if (JSON.stringify(genres) !== JSON.stringify(importe)) return; // remanié sur le site de dev : le test précédent suit la base
  const debut = main.armes.indexOf('<details class="preg" id="regles-armes"');
  const panneauHtml = main.armes.slice(debut, main.armes.indexOf('</details>', debut));
  const lus = [...panneauHtml.matchAll(/<div class="preg-bloc preg-bloc--(texte|tuile)"[^>]*>(?:<p class="preg-bloc__titre"[^>]*><span[^>]*>([^<]*)<\/span><\/p>)?/g)]
    .map((m) => (m[1] === 'tuile' ? `tuile:${m[2] ?? ''}` : 'texte'));
  assert.deepEqual(lus, importe);
});

test('panneaux de règles : leurs balises du glossaire rendues (mode complet « Libellé : définition », gras), aucune brute hors de `data-balise`', options, () => {
  const motsCles = new Map(base.prepare('SELECT id, libelle, description FROM mot_cle').all().map((m) => [m.id, m]));
  let completes = 0;
  for (const o of PAGES_SERVIES_PAR_L_EQUIPEMENT) {
    const m = main[pageDuPanneau(o.ancre)];
    // sauf dans les modèles d'une famille d'armes créée (décision R159 : `<template data-armes-modele>`, où le middleware ne rend rien ; le site de dev
    // rend leurs balises une fois posées, src/scripts/edition/mots-cles-vivants.mjs ; test/armes-html.test.mjs)
    const brutes = m.replace(/<template data-armes-modele="[a-z]+">[\s\S]*?<\/template>/g, '').replace(/ data-balise="[^"]*"/g, '');
    assert.ok(!brutes.includes('{{'), `${o.ancre} : aucune balise brute dans la page`);
    for (const b of chargerPanneau(base, o.ancre)?.blocs ?? []) {
      for (const [, id] of b.texte.matchAll(/\{\{([a-z0-9-]+):\}\}/g)) {
        const mc = motsCles.get(id);
        assert.ok(mc, `${o.ancre} : ${id} est un mot-clé`);
        const attendu = `<strong class="mot-cle-definition__nom">${echapper(mc.libelle)}</strong> : <span class="mot-cle-definition__texte">`;
        assert.ok(m.includes(`data-mot-cle="${id}"`) && m.includes(attendu), `${o.ancre} : ${id} en mode complet`);
        completes += 1;
      }
    }
  }
  // l'import : Recharge longue, Recharge très longue et Mordhau, en tuiles du panneau des armes
  assert.ok(completes >= 1);
});

test('panneaux de règles : deux colonnes séparées d’un filet à partir de 64rem ; une tuile, un paragraphe ou une liste jamais coupés entre deux colonnes, la fin d’un texte jamais séparée de la tuile qui suit ; le CSS une fois par page', options, () => {
  for (const p of PAGES_DE_L_EQUIPEMENT) {
    const h = html[p.id];
    assert.ok(h.includes('@media (min-width: 64rem) { .preg__corps { columns: 2; column-gap: 2.6rem; column-rule: 1px solid var(--border); } }'), p.id);
    assert.ok(h.includes('.preg-bloc__texte > *, .preg-bloc--tuile { break-inside: avoid; }'), p.id);
    // la fin d'un bloc de texte suivi d'une tuile reste avec elle (« CAS PARTICULIERS : » des armes)
    assert.ok(h.includes('.preg-bloc--texte:has(+ .preg-bloc--tuile), .preg-bloc--texte:has(+ .preg-bloc--tuile) > .preg-bloc__texte > :last-child { break-after: avoid; }'), p.id);
    assert.equal(h.split('.preg { --preg:').length - 1, 1, `${p.id} : le CSS, une fois par page`);
  }
});

test('recherche : le titre et le texte des panneaux de règles en tête de l’entrée de la page qu’ils servent ; « Pièces élémentaires » mène à sa section de la page Armes', options, () => {
  const index = JSON.parse(readFileSync(join(dist, 'search-index.json'), 'utf8'));
  for (const o of PAGES_SERVIES_PAR_L_EQUIPEMENT) {
    const panneau = chargerPanneau(base, o.ancre);
    const { chemin, ancre } = adresseDePage(o.page);
    const entree = index.find((e) => e.path === chemin && (e.ancre ?? '') === ancre && e.title === base.prepare('SELECT titre FROM page WHERE id = ?').get(o.page)?.titre);
    assert.ok(entree, `${o.page} : son entrée`);
    const premier = panneau.blocs.find((b) => !/^\{\{/.test(b.texte));
    const mots = premier.texte.replace(/[#>*_`|\\]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
    assert.ok(entree.text.startsWith(panneau.titre), `${o.ancre} : le titre du panneau en tête`);
    assert.ok(entree.text.includes(mots), `${o.ancre} : « ${mots} »`);
  }
  const pieces = index.find((e) => e.title === base.prepare('SELECT titre FROM page WHERE id = ?').get(PAGE_DES_PIECES_ELEMENTAIRES)?.titre && e.path === 'ressources/armes/');
  assert.equal(pieces?.ancre, ANCRE_DES_PIECES_ELEMENTAIRES, 'la page « Pièces élémentaires » : sa section de la page Armes');
});

test('ceinture, bâtons magiques : le panneau de règles en tête, une ligne par magie (Gemme, Bois, Niveau au curseur, Effet, Prix) et ses liens vers « Composants »', options, () => {
  assert.ok(panneauDesBatons.length > 1000, 'le panneau des bâtons');
  assert.match(panneauDesBatons, /<h3 class="ceinture-panneau__titre" id="titre-batons-magiques">Bâtons magiques<\/h3><details class="preg" id="regles-batons-magiques" data-panneau-regles="batons-magiques">/);
  assert.ok(!panneauDesBatons.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  const lignes = [...panneauDesBatons.matchAll(/<tr class="baton ligne-couleur [a-z0-9-]+" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(lignes, batons.magies.map((m) => ancreDeBatons(m.magie.id)));
  // demande du propriétaire du 2026-10-16 : plus de colonne Magie ni de colonne par niveau ; le niveau au curseur, l'effet et le prix du niveau choisi
  const entetes = [...panneauDesBatons.slice(panneauDesBatons.indexOf('<thead>'), panneauDesBatons.indexOf('</thead>')).matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes, ['Gemme', 'Bois', 'Niveau', 'Effet', 'Prix']);
  // chaque ligne sur la couleur de sa magie sur le site, comme ses infobulles (demande du propriétaire du 2026-10-22 : « Partout il faut utiliser Que les
  // couleurs du site ») : la classe de la magie, posée sur chaque page avec sa valeur (« Module JS → classe »), sans style ; au niveau 1
  assert.ok(html.ceinture.includes(`<style>${cssDeLaPalette()}</style>`), 'la palette du site, dans la page');
  for (const m of batons.magies) {
    const classe = classeDesBatons(m.magie);
    assert.ok(panneauDesBatons.includes(`<tr class="baton ligne-couleur ${classe}" id="${ancreDeBatons(m.magie.id)}" data-niveau="1">`), m.magie.nom);
    assert.ok(cssDeLaPalette().includes(`.${classe}{--couleur:${couleurDeMagie(m.magie.nom)};--couleur-texte:${texteSurCouleur(couleurDeMagie(m.magie.nom))}}`), `${m.magie.nom} : la valeur de sa classe`);
  }
  assert.ok(!/<tr class="baton[^>]*style=/.test(panneauDesBatons) && !/style="[^"]*(?:--baton-|--mag|--g\b)/.test(panneauDesBatons), 'aucun style de couleur dans les bâtons');
  assert.equal((panneauDesBatons.match(/<input type="range" class="baton-curseur__champ" min="1" max="3"/g) ?? []).length, batons.magies.length, 'un curseur par ligne');
  assert.equal((panneauDesBatons.match(/<span class="bulle bulle--baton" role="tooltip" id="bulle-baton-[a-z-]+-(?:gemme|bois)" hidden>/g) ?? []).length, batons.magies.length * 2, 'une infobulle par gemme et par bois');
  assert.equal((panneauDesBatons.match(/<a class="acc-gemme couleur-magie-[a-z0-9-]+" href="\/ressources\/composants\/#composant-gemme-[^"]+" data-bulle=/g) ?? []).length, batons.magies.length, 'la gemme : la pastille des accessoires, dans la classe de sa magie');
  assert.ok(!panneauDesBatons.includes('baton__qualite'), 'pas de ligne pour la qualité de la gemme');
  assert.ok(panneauDesBatons.includes('<section class="ceinture-panneau batons" id="batons-magiques" aria-labelledby="titre-batons-magiques" data-batons>'), 'la racine du script, le dernier sous-onglet de la ceinture');
  const composants = readFileSync(join(dist, 'ressources', 'composants', 'index.html'), 'utf8');
  const ancres = [...new Set([...panneauDesBatons.matchAll(/href="\/ressources\/composants\/#([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(ancres.length >= batons.magies.length * 2, 'une gemme et un bois par magie');
  for (const a of ancres) assert.ok(composants.includes(`id="${a}"`), `ancre absente de « Composants » : ${a}`);
});

test('l’ancienne page « Équipement », « Bâton magique » et « Pièces élémentaires » ne sont plus construites et aucun lien du site n’y mène ; ceux du wiki et du guide mènent à leur page', options, () => {
  const chemins = [ANCIENNE_PAGE_DE_L_EQUIPEMENT, 'ressources/baton-magique/', `${PAGE_DES_PIECES_ELEMENTAIRES}/`].map((c) => c.replace(/\/$/, ''));
  for (const c of chemins) assert.ok(!existsSync(join(dist, ...c.split('/'))), `pas de page /${c}/`);
  const anciennes = new RegExp(`href="[^"]*/(${chemins.join('|')})/`);
  const pages = readdirSync(dist, { recursive: true }).filter((n) => n.endsWith('.html') && n !== '404.html' && !n.startsWith('donnees') && !n.startsWith('debug'));
  for (const nom of pages) assert.ok(!anciennes.test(readFileSync(join(dist, nom), 'utf8')), nom);
  // le chapitre « L'équipement » du guide cite la page « Bouclier » (migration 0046) : son lien mène à la page Boucliers ; ses liens écrits vers
  // l'ancienne page « Équipement » (« [Armures](/ressources/equipement/#armures) », migration 0053) mènent à leur page, l'adresse écrite gardée
  // (data-lien-ecrit : lib/guide-rendu.ts), sans passer par la page 404 que la version portable n'a pas
  const guide = readFileSync(join(dist, ...cheminDePage('guide/l-equipement').split('/').filter(Boolean), 'index.html'), 'utf8');
  assert.ok(guide.includes(`href="/${cheminDePage('ressources/bouclier')}"`));
  assert.ok(guide.includes('<a href="/ressources/armures/" data-lien-ecrit="/ressources/equipement/#armures">'), 'un lien écrit vers un ancien onglet');
  assert.ok(guide.includes(`href="/ressources/armes/#${ANCRE_DES_PIECES_ELEMENTAIRES}" class="wikilink" data-cible="${PAGE_DES_PIECES_ELEMENTAIRES}"`), '[[ressources/pieces-elementaires]]');
  // la page 404 emporte les renvois des pages éclatées (data-eclatees), lus par son script (lib/nav.mjs#adresseDeRenvoi)
  const page404 = readFileSync(join(dist, '404.html'), 'utf8');
  const attribut = page404.match(/ data-eclatees="([^"]*)"/)?.[1] ?? '';
  const lu = attribut.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#38;|&amp;/g, '&');
  assert.deepEqual(JSON.parse(lu || 'null'), JSON.parse(JSON.stringify(RENVOIS_DES_PAGES_ECLATEES)), 'les renvois des pages éclatées, pour le script de la page 404');
});

test('chaque page garde son script ; un seul script d’onglets par page, et ses groupes d’onglets', options, () => {
  for (const [id, s] of [['armes', 'ArmesPage'], ['armures', 'ArmuresPage'], ['boucliers', 'ArmuresPage'], ['accessoires', 'AccessoiresPage']]) {
    assert.match(html[id], new RegExp(`<script type="module" src="[^"]*${s}\\.astro_astro_type_script`), `${id} : ${s}`);
  }
  // celui des bâtons magiques (src/scripts/batons.mjs), assez court pour qu'Astro l'écrive en ligne, une fois
  assert.equal((html.ceinture.match(/<script type="module">[^<]*\[data-baton-curseur\]/g) ?? []).length, 1, 'BatonsMagiques');
  // celui des Pièces élémentaires (src/scripts/pieces-elementaires.mjs : l'ancre du bloc replié l'ouvre ; test/pieces-elementaires-script.test.mjs),
  // en ligne aussi, une fois sur Armes et Armures, nulle part ailleurs
  for (const p of PAGES_DE_L_EQUIPEMENT) {
    const n = (html[p.id].match(/<script type="module">[^<]*details\.preg--pieces-elementaires/g) ?? []).length;
    assert.equal(n, ['armes', 'armures'].includes(p.id) ? 1 : 0, `${p.id} : script des Pièces élémentaires`);
  }
  for (const p of PAGES_DE_L_EQUIPEMENT) assert.equal((html[p.id].match(/onglets:brancher/g) ?? []).length, 1, `${p.id} : components/Onglets.astro, posé une fois`);
  // les groupes : les deux menus des familles d'armes (mêlée, distance : demande du propriétaire du 2026-10-23), les sous-onglets de la ceinture, les
  // familles des consommables (demande du propriétaire du 2026-10-22) et les tableaux d'effets des accessoires ; chacun est sa barre seule
  const groupes = (id) => [...main[id].matchAll(/data-onglets="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(groupes('armes'), ['Armes de mêlée', 'Armes à distance']);
  assert.deepEqual(groupes('armures'), []);
  assert.deepEqual(groupes('boucliers'), []);
  assert.deepEqual(groupes('ceinture'), ['Ceinture', 'Consommables']);
  assert.deepEqual(groupes('accessoires'), ['Effets par propriété']);
});
