// Cartes de monstre à plusieurs échelles de puissance et butin (demandes du propriétaire : « pour les tuiles des ennemis ayant plusieurs échelles de
// créature puisse être sélectionné (par un slider ?) et que ses caractéristiques soient calculées en fonction » ; le glossaire du butin « pour faire un
// tooltip […] sur le butin concerné ») : lib/monstre-champs.mjs (echellesEcrites, segmentsParEchelle, objetDuButin) et lib/monstre-rendu.mjs, rejoués
// sur toute la base. Rien n'est calculé : à chaque échelle, la carte montre la valeur qu'elle écrit pour cette échelle. Les monstres se modifient sur le
// site de dev : ce que l'import du doc garantit se lit dans son état d'import (lib/historique-site.mjs) ; l'état courant n'est tenu qu'à la cohérence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerMonstres } from '../src/lib/bestiaire-db.mjs';
import { htmlDeCarteMonstre, htmlDesCapacitesDeLaCarte } from '../src/lib/bestiaire-rendu.mjs';
import { magiesDesCibles as magiesDesCiblesDe, renvoisAuxDegatsMoyens } from '../src/lib/bestiaire-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { rendreChamp } from '../src/lib/edition-rendu.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { normalize } from '../src/lib/text.mjs';
import {
  apresUnTrait,
  avecLesValeurs,
  borneDuCurseur,
  bornes,
  echelleDuPrefixe,
  emplacements,
  emplacementsDetailles,
  suiteDesEmplacements,
  valeursAEnvoyer,
  echellesEcrites,
  objetDuButin,
  parEchelle,
  progressions,
  renvoieAuxDegatsMoyens,
  segmentsParEchelle,
  SENS_DEFENSE,
  texteParEchelle,
  valeurALEchelle,
} from '../src/lib/monstre-champs.mjs';
import {
  htmlDAttention, htmlDeCapacite, htmlDeLEchelle, htmlDeRubrique, htmlDesCapacitesDuMonstre, htmlDuButin, idDeBulleDuButin, phrasesDeDegats, texteDeCapacite,
} from '../src/lib/monstre-rendu.mjs';

const db = ouvrirBase({ sansExemples: false });
const cartes = db.prepare('SELECT * FROM monstre ORDER BY espece_id, rang').all();
const rubriques = db.prepare('SELECT * FROM monstre_rubrique ORDER BY monstre_id, rang').all();
const glossaire = db.prepare('SELECT id, nom, texte FROM monstre_butin_objet ORDER BY rang').all();
const echelles = db.prepare('SELECT * FROM monstre_echelle ORDER BY ep').all();
const elements = db.prepare('SELECT nom FROM magie ORDER BY ordre').all().map((m) => m.nom);
const historique = historiqueSite(db);
const cartesDImport = historique.lignesDImport('monstre');
const rubriquesDImport = historique.lignesDImport('monstre_rubrique');
const rubriquesDe = (id, liste = rubriques) => liste.filter((r) => r.monstre_id === id);
// le texte visible d'un fragment HTML (balises retirées, entités rendues)
const texte = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const nombres = (t) => [...String(t).matchAll(/\d+/g)].map((m) => m[0]);

test('échelles écrites : une plage donne toutes ses échelles, une liste seulement celles qu’elle nomme ; leurs bornes sont celles de la base', () => {
  assert.deepEqual(echellesEcrites('1-10'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(echellesEcrites('EP2 - 6'), [2, 3, 4, 5, 6]);
  assert.deepEqual(echellesEcrites('3,5,7'), [3, 5, 7]);
  assert.deepEqual(echellesEcrites('EP3, 5, 7'), [3, 5, 7]);
  assert.deepEqual(echellesEcrites('EP 4'), [4]);
  assert.deepEqual(echellesEcrites('7, 3, 3'), [3, 7], 'croissantes, sans doublon');
  assert.deepEqual(echellesEcrites('6-2'), [], 'plage à l’envers : aucune');
  assert.deepEqual(echellesEcrites(''), []);
  assert.deepEqual(echellesEcrites(null), []);
  assert.deepEqual(echellesEcrites('Variable'), []);
  // toute la base : les échelles écrites vont d'une borne à l'autre (une écriture sans nombre n'en a aucune : le texte fait foi, le service l'accepte)
  for (const [table, colonne] of [['monstre', 'echelle_brut'], ['monstre_espece', 'ep_brut']]) {
    for (const r of db.prepare(`SELECT ${colonne} AS brut, ep_min, ep_max FROM ${table}`).all()) {
      assert.deepEqual(bornes(r.brut), [r.ep_min, r.ep_max], `${table} : « ${r.brut} »`);
      const eps = echellesEcrites(r.brut);
      if (eps.length) assert.deepEqual([eps[0], eps.at(-1)], [r.ep_min, r.ep_max], `${table} : « ${r.brut} »`);
    }
  }
  // l'import du doc : chaque carte écrit au moins une échelle ; les listes « 3, 5, 7 » n'ont ni 4 ni 6
  for (const c of cartesDImport) assert.ok(echellesEcrites(c.echelle_brut).length >= 1, `${c.id} : « ${c.echelle_brut} »`);
  const listes = cartesDImport.filter((c) => /,/.test(c.echelle_brut));
  assert.ok(listes.length > 0 && listes.every((c) => echellesEcrites(c.echelle_brut).join() === '3,5,7'), 'les cartes « 3, 5, 7 » : ni 4 ni 6');
});

test('lignes par échelle : « EP 2 - 5 : … », « [EP3] … », une forme devant, deux colonnes ; les autres lignes restent à toutes les échelles', () => {
  const s = segmentsParEchelle('EP 1 : 20 EP 6 : 140\nEP 2 - 5 : 70\n\nNeige\n(Guerrier) EP 1 - 10 : 10\n[EP3,5] Santé : 330\nSe fier au tableau.');
  assert.deepEqual(s, [
    { eps: [1], forme: null, etiquette: 'EP 1', valeur: '20', texte: 'EP 1 : 20' },
    { eps: [6], forme: null, etiquette: 'EP 6', valeur: '140', texte: 'EP 6 : 140' },
    { eps: [2, 3, 4, 5], forme: null, etiquette: 'EP 2 - 5', valeur: '70', texte: 'EP 2 - 5 : 70' },
    { vide: true },
    { titre: 'Neige' },
    { eps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], forme: '(Guerrier)', etiquette: 'EP 1 - 10', valeur: '10', texte: '(Guerrier) EP 1 - 10 : 10' },
    { eps: [3, 5], forme: null, etiquette: 'EP 3,5', valeur: 'Santé : 330', texte: '[EP3,5] Santé : 330' },
    { texte: 'Se fier au tableau.' },
  ]);
  assert.equal(parEchelle('Santé : 20 / Chakra : 15'), false);
  assert.equal(parEchelle('Esquive EP élevée'), false);
  assert.equal(parEchelle(''), false);
});

test('l’import du doc : une carte à plusieurs échelles écrit chaque échelle dans chaque rubrique qui varie, une carte à une échelle n’en a aucune', () => {
  let multiples = 0;
  for (const c of cartesDImport) {
    const eps = echellesEcrites(c.echelle_brut);
    const varient = rubriquesDe(c.id, rubriquesDImport).filter((r) => parEchelle(r.texte));
    if (eps.length < 2) {
      assert.deepEqual(varient.map((r) => r.rubrique), [], `${c.nom} (EP ${c.echelle_brut}) : rien par échelle`);
      continue;
    }
    multiples += 1;
    assert.ok(varient.length > 0, `${c.nom} : au moins une rubrique écrite par échelle`);
    for (const rubrique of ['sante', 'chakra', 'barriere']) assert.ok(varient.some((r) => r.rubrique === rubrique), `${c.nom} : ${rubrique} par échelle`);
    for (const r of varient) {
      const segments = segmentsParEchelle(r.texte);
      const couvertes = new Set(segments.flatMap((x) => x.eps ?? []));
      assert.deepEqual(eps.filter((n) => !couvertes.has(n)), [], `${c.nom} · ${r.rubrique} : une valeur à chaque échelle écrite`);
      assert.deepEqual([...couvertes].filter((n) => !eps.includes(n)), [], `${c.nom} · ${r.rubrique} : aucune échelle que la carte n’écrit pas`);
    }
  }
  assert.ok(multiples >= 40, `${multiples} cartes à plusieurs échelles`);
});

test('toute la base : les lignes par échelle redonnent le texte de leur rubrique (aux espaces près)', () => {
  for (const r of rubriques) {
    const recompose = segmentsParEchelle(r.texte).map((x) => (x.vide ? '' : (x.texte ?? x.titre))).join('\n');
    assert.equal(recompose.replace(/\s+/g, ''), r.texte.replace(/\s+/g, ''), `${r.monstre_id} · ${r.rubrique}`);
  }
});

test('rendu par échelle : chaque valeur porte ses échelles (data-eps), aucun nombre qui ne soit écrit sur la carte', () => {
  for (const r of rubriques.filter((x) => parEchelle(x.texte))) {
    const html = htmlDeRubrique(r.rubrique, r.texte);
    const segments = segmentsParEchelle(r.texte).filter((x) => x.eps);
    const marques = [...html.matchAll(/data-eps="([\d ]+)"/g)].map((m) => m[1]);
    assert.deepEqual(marques.sort(), segments.map((x) => x.eps.join(' ')).sort(), `${r.monstre_id} · ${r.rubrique}`);
    const ecrits = new Set(nombres(r.texte));
    for (const n of nombres(texte(html))) assert.ok(ecrits.has(n), `${r.monstre_id} · ${r.rubrique} : « ${n} » n’est pas écrit`);
    if (['sante', 'chakra', 'barriere'].includes(r.rubrique)) {
      assert.equal((html.match(/<span class="bstat bstat--/g) ?? []).length, segments.length, `${r.monstre_id} · ${r.rubrique} : une tuile par valeur`);
    }
  }
  // une tuile nommée comme sur une carte à une seule échelle (demande du propriétaire : « ne doivent pas afficher l'EP, mais leur titre ») : le titre de la
  // rubrique, le nom écrit (« [EP3] Sang : 10 ») ou la forme (« (Guerrier) ») ; l'échelle à part (montrée sans curseur), la valeur seule
  const tuile = (eps, nom, ep, val) => `<span class="bstat bstat--sante" data-eps="${eps}"><span class="bstat__nom">${nom}<span class="bep-ep"> · ${ep}</span></span><span class="bstat__val">${val}</span></span>`;
  assert.equal(
    htmlDeRubrique('sante', 'EP 6 : 140\nEP 1 : 20\n[EP3] Sang : 10\n(Guerrier) EP 1 - 2 : 5'),
    `<span class="bstats bstats--ep">${tuile('1', 'Santé', 'EP 1', 20)}${tuile('1 2', '(Guerrier)', 'EP 1 - 2', 5)}${tuile('3', 'Sang', 'EP 3', 10)}${tuile('6', 'Santé', 'EP 6', 140)}</span>`,
  );
  // une ligne : la forme reste, l'échelle à part
  assert.equal(
    htmlDeRubrique('competences', '(Guerrier) EP 8 - 10 : +10% Esquive'),
    '<span class="bep-lignes"><span class="bep-ligne" data-eps="8 9 10"><span class="bforme">(Guerrier)</span> <span class="bep">EP 8 - 10</span> <span class="texte">+10% Esquive</span></span></span>',
  );
  // une rubrique sans échelle : comme avant
  assert.doesNotMatch(htmlDeRubrique('sante', 'Santé : 20'), /data-eps/);
});

test('butin : l’objet du glossaire écrit en tête de la case, suivi d’une quantité ou d’une amélioration ; avec son élément (décision R57) ; rien d’autre', () => {
  const g = [
    { id: 'gelee-verte', nom: 'Gelée verte', texte: 'Chair de blob vert.' },
    { id: 'gelee-verte-foncee', nom: 'Gelée verte foncée', texte: 'Chair de blob vert foncé.' },
    { id: 'coeur-polaire', nom: 'Cœur polaire', texte: 'Noyau cyan.' },
    { id: 'citron', nom: 'Citron', texte: 'Fruit de la Foudre, ingrédient alchimique.' },
    { id: 'os-moyen', nom: 'Os moyen', texte: 'Os de taille intermédiaire.' },
    { id: 'minitaire', nom: 'Minitaire', texte: 'Version miniature d’un élémentaire.' },
    { id: 'fragment-de-piece-elementaire', nom: 'Fragment de pièce élémentaire', texte: 'Morceau d’une pièce élémentaire brisée.' },
  ];
  const elements = ['Feu', 'Foudre', 'Eau', 'Espace/Temps', 'Arcane'];
  const id = (t) => objetDuButin(t, g, elements)?.objet.id ?? null;
  assert.equal(id('Gelée verte x 1d6'), 'gelee-verte');
  assert.equal(id('Gelée verte foncée x2'), 'gelee-verte-foncee', 'le nom le plus long l’emporte');
  assert.equal(id('Gelée verte'), 'gelee-verte');
  assert.equal(id('Gelée verte (1d4)'), 'gelee-verte');
  assert.equal(id('Gelée verte + 1'), 'gelee-verte');
  assert.equal(id('Gelée verte +2'), 'gelee-verte');
  assert.deepEqual(objetDuButin('Coeur polaire x 4', g), { objet: g[2], ecrit: 'Coeur polaire', reste: ' x 4' }, 'la ligature seule');
  // avec son élément : le fruit avec celui de sa définition, les objets de tous les éléments avec n'importe lequel
  assert.deepEqual(objetDuButin('Citron de foudre x 1d4', g, elements), { objet: g[3], ecrit: 'Citron de foudre', reste: ' x 1d4' });
  assert.equal(id('Citron de feu x 1d4'), null, 'un autre élément que celui de sa définition');
  assert.equal(id('Minitaire d’Eau'), 'minitaire');
  assert.equal(id('Minitaire de Feu + 1'), 'minitaire');
  assert.deepEqual(objetDuButin('Fragment de pièce de l’arcane x8', g, elements), { objet: g[6], ecrit: 'Fragment de pièce de l’arcane', reste: ' x8' });
  assert.equal(id('Fragment de pièce Espace/Temps x 1'), 'fragment-de-piece-elementaire');
  assert.equal(id('Fragment de pièce de Lune x 1'), null, 'pas une magie');
  assert.equal(objetDuButin('Minitaire de Foudre', g), null, 'sans la liste des éléments');
  for (const t of ['4 os moyen', 'gelée verte x 1', 'Gelée vertes', 'Gelée verte pour 24h', 'Cœur', 'Minitaire de Foudre géant', '']) assert.equal(id(t), null, t);
  assert.equal(objetDuButin('Gelée verte', []), null);
  // toute la base : l'objet trouvé et la suite redonnent la case
  for (const { texte: t } of db.prepare('SELECT texte FROM monstre_butin').all()) {
    const o = objetDuButin(t, glossaire, elements);
    if (!o) continue;
    assert.equal(o.ecrit + o.reste, t);
    const sans = (x) => x.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe');
    assert.ok(sans(o.ecrit) === sans(o.objet.nom) || o.ecrit.startsWith(`${o.objet.id === 'fragment-de-piece-elementaire' ? 'Fragment de pièce' : o.objet.nom} `), t);
  }
  // l'import du doc : plus de 200 cases citent un objet du glossaire
  const glossaireDImport = historique.lignesDImport('monstre_butin_objet');
  const citees = historique.lignesDImport('monstre_butin').filter((c) => objetDuButin(c.texte, glossaireDImport)).length;
  assert.ok(citees > 200, `${citees} cases citent un objet du glossaire`);
});

test('case de butin : l’objet en bouton à infobulle (la bulle de l’objet, écrite une fois dans la page), le texte de la case inchangé et échappé', () => {
  const g = [{ id: 'fraise', nom: 'Fraise' }];
  assert.equal(
    htmlDuButin('Fraise x 1d6', g),
    `<button type="button" class="bobjet" data-bulle="${idDeBulleDuButin('fraise')}" aria-describedby="bulle-butin-fraise">Fraise</button> x 1d6`,
  );
  assert.equal(htmlDuButin('Fraise de feu <x> 1d4', g), 'Fraise de feu &lt;x&gt; 1d4');
  for (const { texte: t } of db.prepare('SELECT texte FROM monstre_butin').all()) assert.equal(texte(htmlDuButin(t, glossaire)).replace(/\s+/g, ' ').trim(), t.replace(/\s+/g, ' ').trim());
  // le mode modification (lib/edition-rendu.mjs) refait la même case avec la liste du service (serveur/edition.mjs#listes)
  assert.equal(rendreChamp('monstre-butin', 'Fraise x 1d6', {}, { objetsDuButin: g }), htmlDuButin('Fraise x 1d6', g));
});

test('curseur d’échelle : seulement sur une carte à plusieurs échelles, sur les échelles qu’elle écrit, avec les repères du tableau de l’introduction', () => {
  assert.equal(htmlDeLEchelle('2', 'boss', echelles), '');
  assert.equal(htmlDeLEchelle('', 'boss', echelles), '');
  const html = htmlDeLEchelle('3, 5, 7', 'mini_boss', echelles, true);
  assert.match(html, /<input type="range" min="0" max="2" step="1" value="0" data-echelles="\[3,5,7\]" aria-valuetext="EP 3">/);
  assert.match(html, /<p class="bechelle__curseur js-seul">/);
  assert.match(html, /\(3 échelles : 3, 5, 7\)/);
  assert.match(htmlDeLEchelle('1-10', 'boss', echelles), /\(10 échelles : 1 à 10\)/);
  assert.deepEqual([...html.matchAll(/class="bechelle__repere" data-eps="(\d+)"/g)].map((m) => Number(m[1])), [3, 5, 7]);
  for (const ep of [3, 5, 7]) {
    const x = echelles.find((y) => y.ep === ep);
    assert.ok(html.includes(`data-libelle="EP ${ep} · niveaux ${x.niveau_min}-${x.niveau_max} · expérience reçue : ${x.xp_mini_boss}"`), `EP ${ep}`);
    for (const p of phrasesDeDegats(x.degats_brut, 'mini_boss')) assert.ok(texte(html).includes(p), p);
  }
  // les phrases de dégâts : celles de la catégorie seulement, telles qu'écrites dans le tableau de l'introduction
  for (const x of echelles) {
    const toutes = x.degats_brut.split(/\n+/).map((p) => p.trim());
    for (const [cat, debut] of [['ennemi_simple', 'Les ennemis simples '], ['mini_boss', 'Les mini boss '], ['boss', 'Les boss ']]) {
      const p = phrasesDeDegats(x.degats_brut, cat);
      assert.ok(p.length >= 1, `EP ${x.ep} · ${cat}`);
      assert.ok(p.every((y) => y.startsWith(debut) && toutes.includes(y)), `EP ${x.ep} · ${cat}`);
    }
  }
  assert.deepEqual(phrasesDeDegats(echelles[0].degats_brut, null), []);
  // une carte qui écrit ses propres dégâts (sans renvoi au tableau) : les niveaux et l'expérience, pas les phrases de dégâts moyens
  const sansRenvoi = htmlDeLEchelle('3, 5, 7', 'mini_boss', echelles);
  assert.doesNotMatch(sansRenvoi, /Dégâts moyens|bechelle__degats/);
  assert.match(sansRenvoi, /expérience reçue/);
  assert.equal(rendreChamp('monstre-echelle', '2-6', { id: 'x', categorie: 'boss' }, { echellesDePuissance: echelles }), htmlDeLEchelle('2-6', 'boss', echelles));
  assert.equal(
    rendreChamp('monstre-echelle', '2-6', { id: 'x', categorie: 'boss' }, { echellesDePuissance: echelles, renvoisAuxDegatsMoyens: ['x'] }),
    htmlDeLEchelle('2-6', 'boss', echelles, true),
  );
});

test('renvoi au tableau de l’introduction : écrit dans la rubrique « dégâts » de la carte ; la liste du service est celle des cartes', () => {
  assert.equal(renvoieAuxDegatsMoyens([{ rubrique: 'degats', texte: 'Se fier au dégâts moyen dans le tableau de l’introduction.\n\nArme : …' }]), true);
  assert.equal(renvoieAuxDegatsMoyens([{ rubrique: 'degats', texte: 'Se fier aux dégâts moyens dans le tableau de l\'introduction' }]), true);
  assert.equal(renvoieAuxDegatsMoyens([{ rubrique: 'capacites', texte: 'Se fier au dégâts moyen dans le tableau de l’introduction.' }]), false);
  assert.equal(renvoieAuxDegatsMoyens([{ rubrique: 'degats', texte: 'EP 3 : Poing - (1d6x1d8)+8' }]), false);
  assert.equal(renvoieAuxDegatsMoyens([]), false);
  const liste = new Set(renvoisAuxDegatsMoyens(db));
  for (const c of cartes) assert.equal(liste.has(c.id), renvoieAuxDegatsMoyens(rubriquesDe(c.id)), c.id);
  // l'import du doc : toutes les cartes à plusieurs échelles y renvoient, sauf l'Élémentaire de l'Espace/Temps, qui écrit ses dégâts
  const sans = cartesDImport.filter((c) => echellesEcrites(c.echelle_brut).length >= 2 && !renvoieAuxDegatsMoyens(rubriquesDe(c.id, rubriquesDImport)));
  assert.deepEqual(sans.map((c) => c.nom), ['Élémentaire de l’Espace/Temps']);
});

test('carte construite : le curseur (s’il y a lieu) entre la tête et la carte, une case de butin par objet cité', () => {
  const { lignes } = chargerMonstres(db);
  for (const l of lignes) {
    const html = htmlDeCarteMonstre(l, { logo: '/logo.webp', echelles, glossaire, elements });
    const plusieurs = l.carte && echellesEcrites(l.carte.echelle).length >= 2;
    assert.equal(/data-echelles=/.test(html), Boolean(plusieurs), l.id);
    if (l.carte) assert.match(html, /<\/header><div class="bcarte__echelle" data-ed-lecture="[^"]+" data-ed-rendu="monstre-echelle">/, l.id);
    else assert.doesNotMatch(html, /bcarte__echelle/, l.id);
    assert.equal(/bechelle__degats/.test(html), Boolean(plusieurs && renvoieAuxDegatsMoyens(l.carte.rubriques)), `${l.id} : dégâts moyens seulement sur renvoi`);
    const attendus = l.espece.butin.flatMap((t) => ['ennemi_simple', 'mini_boss', 'boss'].map((cat) => t[cat])).filter((t) => t && objetDuButin(t, glossaire, elements)).length;
    assert.equal((html.match(/<button type="button" class="bobjet" /g) ?? []).length, attendus, l.id);
  }
});

test('décisions R55 et R59 : « N (+k/mEP) » et « N (+k/EP) » valent N à l’EP 1, puis +k toutes les m échelles sans compter l’EP 1, Collecteurs compris', () => {
  const dix = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const lu = (texte, eps) => texteParEchelle(texte, eps).map((g) => [g.eps, g.morceaux.map((m) => m.texte ?? `${m.valeur}${m.mots}`).join('')]);
  // les calculs du propriétaire, EP 1 à 10 : « 5 (+2/3EP) » et « 2 + 1/EP » (« on ne compte pas le EP1 dans le calcul "par EP" »)
  const [f] = progressions('5 armure physique (+2/3EP)');
  assert.deepEqual(dix.map((ep) => valeurALEchelle(f, ep)), [5, 5, 5, 7, 7, 7, 9, 9, 9, 11]);
  const [g] = progressions('2 (+1/EP) armure physique');
  assert.deepEqual(dix.map((ep) => valeurALEchelle(g, ep)), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(lu('5 armure physique (+2/3EP) / 5 (+2/3EP) armure magique (Peau)', dix), [
    [[1, 2, 3], '5 armure physique / 5 armure magique (Peau)'],
    [[4, 5, 6], '7 armure physique / 7 armure magique (Peau)'],
    [[7, 8, 9], '9 armure physique / 9 armure magique (Peau)'],
    [[10], '11 armure physique / 11 armure magique (Peau)'],
  ]);
  assert.deepEqual(lu('2 (+1/EP) armure physique / 0 armure magique', [1, 2, 3]), [
    [[1], '2 armure physique / 0 armure magique'],
    [[2], '3 armure physique / 0 armure magique'],
    [[3], '4 armure physique / 0 armure magique'],
  ]);
  // la valeur ne dépend que de l'EP, pas de la première échelle de la carte : le Collecteur (EP 2 à 6), « 2 (+1/EP) », vaut 3 à l'EP 2 et 7 à l'EP 6
  assert.deepEqual(lu('2 (+1/EP) armure physique / 0 armure magique (Peau)', [2, 3, 4, 5, 6]).map(([eps, t]) => [eps, t.split(' ')[0]]), [
    [[2], '3'], [[3], '4'], [[4], '5'], [[5], '6'], [[6], '7'],
  ]);
  assert.deepEqual(lu('5 (+2/3EP) armure', [2, 3, 4]), [[[2, 3], '5 armure'], [[4], '7 armure']]);
  // des échelles regroupées seulement si elles se suivent dans la liste écrite et donnent le même texte
  assert.deepEqual(lu('1 (+2/3EP) armure', [1, 2, 4, 5]).map(([eps]) => eps), [[1, 2], [4, 5]]);
  assert.deepEqual(texteParEchelle('5 armure physique / 2 armure magique', dix), [], 'sans formule');
  // une carte d'une seule échelle : sa valeur (la formule ne dépend que de l'EP), son étiquette visible (pas de curseur)
  assert.deepEqual(lu('5 (+2/3EP) armure', [4]), [[[4], '7 armure']]);
  assert.match(htmlDeRubrique('defense', '5 (+2/3EP) armure', { echelles: [4] }), /data-eps="4"><span class="bep">EP 4<\/span> <span class="texte"><span class="bcalcul" [^>]+>7<\/span> armure/);
  assert.deepEqual(texteParEchelle('5 (+2/3EP) armure', []), [], 'sans échelle écrite : le texte tel qu’écrit');
  // « /0EP » n'est pas une formule : le texte tel qu'écrit, jamais NaN
  assert.deepEqual(progressions('2 (+1/0EP) armure'), []);
  assert.doesNotMatch(htmlDeRubrique('defense', '2 (+1/0EP) armure', { echelles: [1, 2, 3] }), /NaN|Infinity|bcalcul/);
  // rendu : une ligne par groupe d'échelles, la valeur calculée soulignée, la formule écrite et sa lecture en infobulle
  assert.equal(
    htmlDeRubrique('defense', '5 (+2/3EP) armure', { echelles: [1, 2, 3, 4] }),
    '<span class="bep-lignes"><span class="bep-ligne" data-eps="1 2 3"><span class="bep">EP 1 - 3</span> <span class="texte"><span class="bcalcul" title="« 5 (+2/3EP) » : 5 à l’EP 1, puis +2 tous les 3 EP">5</span> armure</span></span>'
      + '<span class="bep-ligne" data-eps="4"><span class="bep">EP 4</span> <span class="texte"><span class="bcalcul" title="« 5 (+2/3EP) » : 5 à l’EP 1, puis +2 tous les 3 EP">7</span> armure</span></span></span>',
  );
  assert.equal(
    htmlDeRubrique('defense', '2 (+1/EP) armure', { echelles: [2, 3] }),
    '<span class="bep-lignes"><span class="bep-ligne" data-eps="2"><span class="bep">EP 2</span> <span class="texte"><span class="bcalcul" title="« 2 (+1/EP) » : 2 à l’EP 1, puis +1 par EP">3</span> armure</span></span>'
      + '<span class="bep-ligne" data-eps="3"><span class="bep">EP 3</span> <span class="texte"><span class="bcalcul" title="« 2 (+1/EP) » : 2 à l’EP 1, puis +1 par EP">4</span> armure</span></span></span>',
  );
  assert.match(htmlDeRubrique('defense', '5 armure physique (+2/3EP)', { echelles: [1, 2] }), /title="« 5 armure physique \(\+2\/3EP\) » : 5 à l’EP 1, puis \+2 tous les 3 EP"/);
  assert.equal(htmlDeRubrique('defense', '5 (+2/3EP) armure'), '<span class="texte">5 (+2/3EP) armure</span>', 'sans les échelles de la carte : tel qu’écrit');
  // la défense seulement : une autre rubrique garde la formule telle qu'écrite
  assert.doesNotMatch(htmlDeRubrique('degats', 'Griffe - 2d10 + 2 (+1/EP) dégâts', { echelles: [1, 2, 3] }), /bcalcul|data-eps/);
  // toute la base : chaque formule d'une carte est lue à chacune de ses échelles, une fois, selon les calculs du propriétaire
  const attendue = (x, ep) => x.base + x.pas * Math.floor((ep - 1) / x.tous);
  let lues = 0;
  for (const c of cartes) {
    const eps = echellesEcrites(c.echelle_brut);
    for (const r of rubriquesDe(c.id).filter((x) => x.rubrique === 'defense' && progressions(x.texte).length)) {
      if (!eps.length) continue;
      lues++;
      const formules = progressions(r.texte);
      const groupes = texteParEchelle(r.texte, eps);
      assert.deepEqual(groupes.flatMap((x) => x.eps), eps, `${c.id} · ${r.rubrique}`);
      const html = htmlDeRubrique(r.rubrique, r.texte, { echelles: eps });
      assert.deepEqual([...html.matchAll(/data-eps="([\d ]+)"/g)].map((m) => m[1]), groupes.map((x) => x.eps.join(' ')), c.id);
      for (const groupe of groupes) {
        const valeurs = groupe.morceaux.filter((m) => m.texte === undefined).map((m) => m.valeur);
        for (const ep of groupe.eps) assert.deepEqual(valeurs, formules.map((x) => attendue(x, ep)), `${c.id} · EP ${ep}`);
        // le texte hors formules, inchangé
        assert.equal(groupe.morceaux.filter((m) => m.texte !== undefined).map((m) => m.texte).join(''), r.texte.replace(/\d+((?:[ \t]+\p{L}+)*?)[ \t]*\(\s*\+\s*\d+\s*\/\s*\d*\s*EP\s*\)/gu, ''), c.id);
      }
      assert.equal(rendreChamp('monstre-rubrique', r.texte, r, { echellesDesCartes: { [c.id]: c.echelle_brut } }), html, `${c.id} : rendu du mode modification`);
    }
  }
  assert.ok(lues > 0);
  // l'import du doc : 16 défenses à formule sur des cartes de l'EP 1 à 10 (3 « /mEP » : les Archidémons), 3 « /EP » sur les Collecteurs (EP 2 à 6) ;
  // toutes se calculent
  const aFormule = (liste) => cartesDImport.filter((c) => rubriquesDe(c.id, liste).some((x) => x.rubrique === 'defense' && progressions(x.texte).length));
  const importees = aFormule(rubriquesDImport);
  assert.deepEqual(importees.map((c) => echellesEcrites(c.echelle_brut)[0]).reduce((n, ep) => ({ ...n, [ep]: (n[ep] ?? 0) + 1 }), {}), { 1: 16, 2: 3 });
  const parM = importees.filter((c) => rubriquesDe(c.id, rubriquesDImport).some((x) => x.rubrique === 'defense' && progressions(x.texte).some((p) => p.tous > 1)));
  assert.equal(parM.length, 3, '« /mEP » : les trois Archidémons');
  for (const c of importees) {
    for (const r of rubriquesDe(c.id, rubriquesDImport).filter((x) => x.rubrique === 'defense')) assert.ok(texteParEchelle(r.texte, echellesEcrites(c.echelle_brut)).length, c.id);
  }
});

test('un trait du doc dans une rubrique : ce qui le suit va dans un panneau « Attention » (« Ottar (explication) », tactique de l’Os du blizzard)', () => {
  assert.equal(apresUnTrait('Texte de la tactique.'), null);
  assert.equal(apresUnTrait('Texte.\n\n________________\n\n'), null, 'rien après le trait');
  assert.deepEqual(apresUnTrait('Texte.\n\n\n________________\nTitre (explication)\nParagraphe.\n\nSuite.'), {
    avant: 'Texte.',
    apres: 'Titre (explication)\nParagraphe.\n\nSuite.',
  });
  const html = htmlDeRubrique('tactique', 'Texte.\n________________\nTitre <b>\nParagraphe.');
  assert.equal(
    html,
    '<span class="texte">Texte.</span><span class="battention" role="note"><span class="battention__titre">Attention</span> <span class="battention__motif">'
      + 'La place de ce texte sur la carte n’est pas décidée.</span><span class="texte">Titre &lt;b&gt;\nParagraphe.</span></span>',
  );
  assert.equal(htmlDeRubrique('tactique', '________________\nSeul.'), htmlDAttention('Seul.'), 'rien avant le trait : le panneau seul');
  // l'import du doc : une seule rubrique a un trait, la tactique de l'Os du blizzard, suivie de « Ottar (explication) » ; le panneau garde tout le texte
  const avecTrait = rubriquesDImport.filter((r) => apresUnTrait(r.texte));
  assert.deepEqual(avecTrait.map((r) => [r.monstre_id, r.rubrique]), [['monstres/os-du-froid#carte:os-du-blizzard', 'tactique']]);
  const [r] = avecTrait;
  assert.match(apresUnTrait(r.texte).apres, /^Ottar \(explication\)\nLes Ottars ont été des êtres humanoïdes/);
  const rendu = texte(htmlDeRubrique(r.rubrique, r.texte));
  for (const morceau of r.texte.split(/\n+/).filter((l) => !/^_+$/.test(l.trim()))) assert.ok(rendu.includes(morceau.trim()), morceau);
  // et la carte construite le montre (comme le mode modification)
  const ligne = chargerMonstres(db).lignes.find((l) => l.id === r.monstre_id);
  if (ligne && rubriquesDe(r.monstre_id).some((x) => apresUnTrait(x.texte))) assert.match(htmlDeCarteMonstre(ligne, { logo: '/logo.webp', echelles, glossaire, elements }), /class="battention"/);
});

test('décision R56 : une capacité « [EPN] » est gagnée à partir de l’EP N ; le curseur la cache en dessous', () => {
  const cap = (prefixe, nom, rang) => ({ rang, prefixe, id: 'x', nom, description: 'Texte.', valeurs: {}, sorts: null });
  const html = htmlDesCapacitesDuMonstre([cap('[EP3]', 'Nuage rapide', 1), cap('(Neige) [EP5]', 'Neige permanente', 2), cap('[Gauche]', 'Téméraire', 3), cap(null, 'Sans préfixe', 4)]);
  const lis = [...html.matchAll(/<li([^>]*)>/g)].map((m) => m[1]);
  assert.deepEqual(lis, [
    ' class="bcapacite" data-eps="3 4 5 6 7 8 9 10" data-capacite="x" data-rang="1"',
    ' class="bcapacite" data-eps="5 6 7 8 9 10" data-capacite="x" data-rang="2"',
    ' class="bcapacite" data-capacite="x" data-rang="3"',
    ' class="bcapacite" data-capacite="x" data-rang="4"',
  ]);
  assert.match(html, /<span class="prefixe" title="Gagnée à partir de l’EP 3">\[EP3\]<\/span>/);
  assert.match(html, /<span class="prefixe">\[Gauche\]<\/span>/);
  assert.equal(echelleDuPrefixe('(Neige/Cristal) [EP7]'), 7);
  assert.equal(echelleDuPrefixe('[Enflammé]'), null);
  assert.equal(echelleDuPrefixe(null), null);
  // toute la base : ep_min suit le préfixe ; une carte a autant de tuiles marquées que de capacités « à partir de l'EP N », chacune dans les échelles de sa
  // carte à l'import du doc (le site de dev peut changer l'échelle d'une carte, ou ses capacités)
  const placements = db.prepare('SELECT * FROM monstre_capacite').all();
  for (const p of placements) assert.equal(p.ep_min, echelleDuPrefixe(p.prefixe), `${p.monstre_id} ${p.rang}`);
  const { lignes } = chargerMonstres(db);
  const typees = db.prepare('SELECT monstre_id, count(*) AS n FROM monstre_capacite WHERE ep_min IS NOT NULL GROUP BY monstre_id').all();
  // à l'import du doc, 35 cartes ont une capacité « à partir de l'EP N » (lu dans l'état d'import : le site de dev peut en ajouter ou en retirer)
  assert.equal(new Set(historique.lignesDImport('monstre_capacite').filter((p) => p.ep_min !== null).map((p) => p.monstre_id)).size, 35);
  for (const { monstre_id: id, n } of typees) {
    const l = lignes.find((x) => x.id === id);
    assert.equal((htmlDesCapacitesDeLaCarte(l).match(/<li class="bcapacite" data-eps=/g) ?? []).length, n, id);
  }
  const importees = historique.lignesDImport('monstre_capacite').filter((p) => p.ep_min !== null);
  assert.ok(importees.length > 200, `${importees.length} capacités « [EPN] » à l’import`);
  for (const p of importees) {
    const c = cartesDImport.find((x) => x.id === p.monstre_id);
    assert.ok(p.ep_min >= c.ep_min && p.ep_min <= c.ep_max, `${p.monstre_id} : rang ${p.rang}`);
  }
});

test('capacités en tuiles (demande du propriétaire : « de la même manière que le font les dons de classe ») : pastilles, nom, texte de la capacité commune aux valeurs de la carte', () => {
  assert.equal(
    htmlDesCapacitesDuMonstre([
      { rang: 2, prefixe: '[EP3]', id: 'nuage-rapide', nom: 'Nuage rapide', description: 'Un <texte> à {10} % et {2}d6.', valeurs: { 1: 15 }, sorts: null },
      { rang: 5, prefixe: null, id: 'sans-prefixe', nom: 'Sans préfixe', description: 'Autre texte.', valeurs: {}, sorts: null },
    ]),
    '<ul class="bcapacites" role="list">'
      + '<li class="bcapacite" data-eps="3 4 5 6 7 8 9 10" data-capacite="nuage-rapide" data-rang="2"><p class="bcapacite__tete"><span class="prefixe" title="Gagnée à partir de l’EP 3">[EP3]</span> <strong class="bcapacite__nom">Nuage rapide</strong></p> '
      + '<div class="bcapacite__texte"><span class="texte">Un &lt;texte&gt; à 15 % et 2d6.</span></div></li>'
      + '<li class="bcapacite" data-capacite="sans-prefixe" data-rang="5"><p class="bcapacite__tete"><strong class="bcapacite__nom">Sans préfixe</strong></p> <div class="bcapacite__texte"><span class="texte">Autre texte.</span></div></li></ul>',
  );
  // décision R69 : un emplacement « {N} » vaut N, ou la valeur de la carte ; décision R66 : la liste de sorts de la carte suit la description
  assert.deepEqual(emplacements('Malus de {10}% et 3d{6}, pas {x}.'), [10, 6]);
  assert.equal(avecLesValeurs('Malus de {10}% et 3d{6}.', { 2: 10 }), 'Malus de 10% et 3d10.');
  assert.equal(avecLesValeurs('Sans emplacement.', { 1: 4 }), 'Sans emplacement.');
  // le curseur du site de dev : un pourcentage va de 0 à 100, sinon jusqu'au double de la plus grande valeur (20 au moins)
  const places = emplacementsDetailles('Malus de {10}% , {3} santé, {25} % et 3d{6}.');
  assert.deepEqual(places, [
    { numero: 1, commune: 10, pourcent: true }, { numero: 2, commune: 3, pourcent: false }, { numero: 3, commune: 25, pourcent: true }, { numero: 4, commune: 6, pourcent: false },
  ]);
  assert.deepEqual(places.map((p) => borneDuCurseur(p)), [100, 20, 100, 20]);
  assert.equal(borneDuCurseur({ commune: 6, pourcent: false }, 30), 60);
  // ce qui part : la valeur commune revient à null, une valeur inchangée ne part pas, un emplacement disparu non plus
  assert.deepEqual(valeursAEnvoyer('Malus de {10}% et {3}.', new Map([[1, 15], [2, 3], [5, 9]]), new Map()), { 1: 15 });
  assert.deepEqual(valeursAEnvoyer('Malus de {10}% et {3}.', new Map([[1, 10], [2, 7]]), new Map([[1, 15], [2, 7]])), { 1: null });
  // une description qui change son nombre d'emplacements : chacun se reconnaît au texte qui l'entoure (et à sa valeur commune), jamais deviné
  const suite = (a, b) => Object.fromEntries(suiteDesEmplacements(a, b));
  assert.deepEqual(suite('A {10} B {3} C', 'A {12} B {4} C'), { 1: 1, 2: 2 }, 'même nombre : chacun garde son numéro');
  assert.deepEqual(suite('A {10} B {3} C {5} D', 'A {10} B C {5} D'), { 1: 1, 3: 2 }, 'celui du milieu retiré : le dernier devient le 2e');
  assert.deepEqual(suite('A {10} B {5} D', 'A {10} B {3} C {5} D'), { 1: 1, 2: 3 }, 'un emplacement ajouté au milieu');
  assert.deepEqual(suite('A {2} puis {3} fin', 'A {3} fin'), { 2: 1 }, 'le premier retiré');
  // au début ou à la fin des deux descriptions, un texte vide ne reconnaît rien (tout le reste a pu changer) : la valeur propre part
  assert.deepEqual(suite('{2} puis {3}', '{3}'), {}, 'plus aucun texte autour : rien ne se reconnaît');
  assert.deepEqual(suite('Les dégâts magiques sont augmenté de +{3}', 'Les dégâts magiques sont augmentés de +{3}, et la portée de ses sorts de +{2}'), {});
  assert.deepEqual(suite('{3} santé récupérée par tour.', '{10}% de chance de régénérer {3} santé par tour.'), {});
  assert.deepEqual(suite('Soigne {3}', 'Soigne de {3} santé, portée {10}'), {});
  assert.deepEqual(suite('Soigne {3} santé.', 'Soigne {3} santé, portée {10}.'), { 1: 1 }, 'le texte qui précède reconnaît le premier');
  assert.deepEqual(suite('A {10} B {5} D', 'A {10} B {5} C {5} D'), { 1: 1 }, 'ambigu : aucune suite (ses valeurs propres partent)');
  assert.equal(texteDeCapacite({ description: 'Cette créature peut lancer les sorts, avec les niveaux de maîtrise maximum :', valeurs: {}, sorts: 'Éclair, Bulle d’eau.' }),
    'Cette créature peut lancer les sorts, avec les niveaux de maîtrise maximum : Éclair, Bulle d’eau.');
  // une carte sans capacité (créée sur le site de dev) : « — »
  assert.equal(htmlDesCapacitesDuMonstre([]), '<span class="vide">—</span>');
  // une capacité commune (créature invoquée, que les capacités communes des monstres ne touchent pas : décision R67) : sa pastille et sa classe
  assert.equal(
    htmlDeCapacite({ prefixes: [{ texte: 'commune', titre: 'Commune à toutes les créatures de « X »' }], nom: 'Inerte', texte: 'T.', commune: true }),
    '<li class="bcapacite bcapacite--commune"><p class="bcapacite__tete"><span class="prefixe" title="Commune à toutes les créatures de « X »">commune</span> <strong class="bcapacite__nom">Inerte</strong></p> <div class="bcapacite__texte"><span class="texte">T.</span></div></li>',
  );
  // le nom et le texte restent deux mots dans textContent, que lit la recherche (« Haine mutuelle Cette… », pas « mutuelleCette »)
  assert.doesNotMatch(htmlDesCapacitesDuMonstre([{ rang: 1, prefixe: null, id: 'h', nom: 'Haine mutuelle', description: 'Cette créature.', valeurs: {}, sorts: null }]), /<\/p><div/);
  // toute la base : une tuile par capacité de la carte, avec son nom et ses valeurs (plus aucun « {N} »), sans titre hN ni lien (la carte d'une créature
  // invoquée sert d'infobulle) ; le bloc est à la place de la rubrique « Capacité(s) », sans champ de texte (décision R66)
  const { lignes } = chargerMonstres(db);
  const e = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  for (const l of lignes.filter((x) => x.carte)) {
    const html = htmlDesCapacitesDeLaCarte(l);
    assert.equal((html.match(/<li class="bcapacite[ "]/g) ?? []).length, l.carte.capacites.length, l.id);
    for (const c of l.carte.capacites) assert.ok(html.includes(`<strong class="bcapacite__nom">${e(c.nom)}</strong>`), `${l.id} : ${c.nom}`);
    assert.doesNotMatch(html, /<h\d|<a |\{\d+\}/, l.id);
    const carte = htmlDeCarteMonstre(l, { logo: '/logo.webp', echelles, glossaire, elements });
    assert.ok(carte.includes(`<dd data-capacites-de="${e(l.id)}">${html}</dd>`), `${l.id} : le bloc des capacités`);
  }
});

test('santé, chakra, barrière écrites à part : un bloc « Santé, chakra, barrière », une colonne chacune, chaque rubrique gardant son champ', () => {
  const { lignes } = chargerMonstres(db);
  let trios = 0;
  for (const l of lignes.filter((x) => x.carte)) {
    const html = htmlDeCarteMonstre(l, { logo: '/logo.webp', echelles, glossaire, elements });
    const cles = l.carte.rubriques.map((r) => r.rubrique).join(',');
    const separees = /(^|,)sante,chakra,barriere(,|$)/.test(cles);
    assert.equal(html.includes('btrio'), separees, l.id);
    if (!separees) continue;
    trios += 1;
    assert.match(html, /<div class="brubrique brubrique--attributs btrio"><dt>Santé, chakra, barrière<\/dt><dd><dl class="btrio__cases"><div class="brubrique brubrique--sante"><dt>Santé<\/dt><dd data-ed-lecture="[^"]+" data-ed-rendu="monstre-rubrique" data-ed-sur-demande>/, l.id);
    // aucune tuile n'est nommée par son échelle
    assert.doesNotMatch(html, /<span class="bstat__nom">EP /, l.id);
  }
  // l'import du doc : les 40 cartes à plusieurs échelles écrivent santé, chakra, barrière à part
  const trioDImport = cartesDImport.filter((c) => /(^|,)sante,chakra,barriere(,|$)/.test(rubriquesDe(c.id, rubriquesDImport).sort((a, b) => a.rang - b.rang).map((r) => r.rubrique).join(','))).length;
  assert.equal(trioDImport, 40);
  assert.ok(trios > 0);
});

test('vulnérabilités et résistances dans la couleur de la magie qui va avec : la magie elle-même, ou la magie liée de l’altération d’état', () => {
  const table = magiesDesCiblesDe(db);
  assert.deepEqual(table.feu, ['Feu']);
  assert.deepEqual(table.brulure, ['Feu'], 'etat_magie : Brûlure -> Feu');
  assert.deepEqual(table.petrification, ['Terre'], 'écriture du bestiaire de l’état « Pétrifié »');
  assert.deepEqual(table['temps-espace'], ['Espace/Temps']);
  assert.equal(table.frappe, undefined);
  assert.equal(table.maladie, undefined);
  // chaque état lié à une magie (table etat_magie) a sa couleur ; une magie aussi
  for (const r of db.prepare('SELECT e.nom, m.nom AS magie FROM etat e JOIN etat_magie em ON em.etat_id = e.id JOIN magie m ON m.id = em.magie_id').all()) {
    assert.ok(table[normalize(r.nom)].includes(r.magie), r.nom);
  }
  const html = htmlDeRubrique('vulnerabilite', 'Feu, Brûlure, Frappe, Surcharge magique', { magiesDesCibles: table });
  assert.match(html, /<span class="bcible bcible--vulnerabilite bcible--magie" style="--c:#ff0000;--c2:#ff0000;--c-texte:#171210">Feu<\/span>/);
  assert.match(html, /<span class="bcible bcible--vulnerabilite bcible--magie" style="--c:#ff0000;[^"]*" title="Magie liée : Feu">Brûlure<\/span>/);
  assert.match(html, /<span class="bcible bcible--vulnerabilite">Frappe<\/span>/);
  assert.match(html, /bcible--magie bcible--deux"[^>]*title="Magie liée : Arcane, Corruption">Surcharge magique</);
  assert.doesNotMatch(htmlDeRubrique('vulnerabilite', 'Feu, Frappe'), /bcible--magie/, 'sans la table : neutre');
  // le mode modification redonne la même pastille
  assert.equal(rendreChamp('monstre-rubrique', 'Feu, Brûlure', { rubrique: 'resistance', monstre_id: 'x' }, { magiesDesCibles: table }), htmlDeRubrique('resistance', 'Feu, Brûlure', { magiesDesCibles: table }));
});

test('tuiles d’un groupe : une valeur sans nom écrit après un titre de groupe prend le titre (« Âme » du Collecteur), jamais celui de la rubrique', () => {
  const html = htmlDeRubrique('barriere', 'EP 2 : 10\nEP 3 : 20\n\nÂme\nEP 2 - 6 : 10');
  assert.match(html, /<span class="bstats__groupe">Âme<\/span><span class="bstat bstat--barriere" data-eps="2 3 4 5 6"><span class="bstat__nom">Âme<span class="bep-ep">/);
  assert.match(html, /data-eps="2"><span class="bstat__nom">Barrière</);
  // toute la base : sous un titre de groupe, une tuile porte le nom écrit, la forme ou le titre du groupe, jamais celui de la rubrique s'il n'est pas écrit
  for (const r of rubriques.filter((x) => ['sante', 'chakra', 'barriere'].includes(x.rubrique) && parEchelle(x.texte))) {
    const rendu = htmlDeRubrique(r.rubrique, r.texte);
    let groupe = null;
    for (const seg of segmentsParEchelle(r.texte)) {
      if (seg.titre) groupe = seg.titre;
      if (!seg.eps || !groupe) continue;
      const nom = seg.forme ?? seg.valeur.match(/^([\p{L}’' ]+?)\s*:/u)?.[1] ?? groupe;
      assert.ok(rendu.includes(`<span class="bstat__nom">${nom}<span class="bep-ep">`), `${r.monstre_id} : ${nom}`);
    }
  }
});

test('défense écrite par forme ou sur plusieurs lignes : chaque liste de cibles en pastilles colorées, le reste tel qu’écrit', () => {
  const table = magiesDesCiblesDe(db);
  const html = htmlDeRubrique('resistance', 'Guerrier : Eau, Frappe\nMage : Aucune\n\nAbsorbe(s) Dégâts/Effets = 0\nFeu', { magiesDesCibles: table });
  assert.equal(
    html.replace(/ style="[^"]*"/g, '').replace(/ title="[^"]*"/g, ''),
    '<span class="bdef-lignes"><span class="bdef-ligne"><span class="bforme">Guerrier :</span> <span class="bcibles"><span class="bcible bcible--resistance bcible--magie">Eau</span>'
      + '<span class="bcible bcible--resistance">Frappe</span></span></span><span class="bdef-ligne texte">Mage : Aucune</span><span class="bdef-ligne bdef-ligne--vide"></span>'
      + '<span class="bdef-ligne texte">Absorbe(s) Dégâts/Effets = 0</span><span class="bdef-ligne"><span class="bcibles"><span class="bcible bcible--resistance bcible--magie">Feu</span></span></span></span>',
  );
  assert.equal(htmlDeRubrique('resistance', 'Varie selon la magie'), '<span class="texte">Varie selon la magie</span>');
  assert.equal(htmlDeRubrique('resistance', 'Selon la forme\nVoir plus bas'), '<span class="texte">Selon la forme\nVoir plus bas</span>', 'aucune liste : tel qu’écrit');
  // toute la base : le texte des pastilles et des lignes redonne celui de la rubrique
  for (const r of rubriques.filter((x) => SENS_DEFENSE.includes(x.rubrique) && x.texte.trim())) {
    const rendu = htmlDeRubrique(r.rubrique, r.texte, { magiesDesCibles: table });
    const lu = rendu.replace(/<\/span><span class="bcible[^>]*>/g, ', ').replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    assert.equal(lu.replace(/[\s,.]+/g, ''), r.texte.replace(/[\s,.]+/g, ''), `${r.monstre_id} · ${r.rubrique}`);
  }
});
