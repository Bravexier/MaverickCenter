// Cartes de monstre à plusieurs échelles de puissance et butin (demandes du propriétaire : « pour les tuiles des ennemis ayant plusieurs échelles de
// créature puisse être sélectionné (par un slider ?) et que ses caractéristiques soient calculées en fonction » ; le glossaire du butin « pour faire un
// tooltip […] sur le butin concerné ») : lib/monstre-champs.mjs (echellesEcrites, segmentsParEchelle, objetDuButin) et lib/monstre-rendu.mjs, rejoués
// sur toute la base. Rien n'est calculé : à chaque échelle, la carte montre la valeur qu'elle écrit pour cette échelle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerMonstres } from '../src/lib/bestiaire-db.mjs';
import { htmlDeCarteMonstre } from '../src/lib/bestiaire-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { rendreChamp } from '../src/lib/edition-rendu.mjs';
import { bornes, echellesEcrites, objetDuButin, parEchelle, segmentsParEchelle } from '../src/lib/monstre-champs.mjs';
import { htmlDeLEchelle, htmlDeRubrique, htmlDuButin, idDeBulleDuButin, phrasesDeDegats } from '../src/lib/monstre-rendu.mjs';

const db = ouvrirBase({ sansExemples: false });
const cartes = db.prepare('SELECT * FROM monstre ORDER BY espece_id, rang').all();
const rubriques = db.prepare('SELECT * FROM monstre_rubrique ORDER BY monstre_id, rang').all();
const glossaire = db.prepare('SELECT id, nom, texte FROM monstre_butin_objet ORDER BY rang').all();
const echelles = db.prepare('SELECT * FROM monstre_echelle ORDER BY ep').all();
const rubriquesDe = (id) => rubriques.filter((r) => r.monstre_id === id);
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
  for (const [table, colonne] of [['monstre', 'echelle_brut'], ['monstre_espece', 'ep_brut']]) {
    for (const r of db.prepare(`SELECT ${colonne} AS brut, ep_min, ep_max FROM ${table}`).all()) {
      const eps = echellesEcrites(r.brut);
      assert.ok(eps.length >= 1, `${table} : « ${r.brut} » écrit au moins une échelle`);
      assert.deepEqual([eps[0], eps.at(-1)], [r.ep_min, r.ep_max], `${table} : « ${r.brut} »`);
      assert.deepEqual([eps[0], eps.at(-1)], bornes(r.brut));
    }
  }
  const listes = cartes.filter((c) => /,/.test(c.echelle_brut));
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

test('toute la base : une carte à plusieurs échelles écrit chaque échelle dans chaque rubrique qui varie, une carte à une échelle n’en a aucune', () => {
  let multiples = 0;
  for (const c of cartes) {
    const eps = echellesEcrites(c.echelle_brut);
    const varient = rubriquesDe(c.id).filter((r) => r.rubrique !== 'capacites' && parEchelle(r.texte));
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
      // les segments redonnent le texte de la rubrique (aux espaces près)
      const recompose = segments.map((x) => (x.vide ? '' : (x.texte ?? x.titre))).join('\n');
      assert.equal(recompose.replace(/\s+/g, ''), r.texte.replace(/\s+/g, ''), `${c.nom} · ${r.rubrique}`);
    }
  }
  assert.ok(multiples >= 40, `${multiples} cartes à plusieurs échelles`);
});

test('rendu par échelle : chaque valeur porte ses échelles (data-eps), aucun nombre qui ne soit écrit sur la carte', () => {
  for (const r of rubriques.filter((x) => x.rubrique !== 'capacites' && parEchelle(x.texte))) {
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
  // une tuile : l'échelle (et le nom écrit) en étiquette, la valeur seule
  assert.equal(
    htmlDeRubrique('sante', 'EP 6 : 140\nEP 1 : 20\n[EP3] Sang : 10'),
    '<span class="bstats bstats--ep"><span class="bstat bstat--sante" data-eps="1"><span class="bstat__nom">EP 1</span><span class="bstat__val">20</span></span>'
      + '<span class="bstat bstat--sante" data-eps="3"><span class="bstat__nom">EP 3 · Sang</span><span class="bstat__val">10</span></span>'
      + '<span class="bstat bstat--sante" data-eps="6"><span class="bstat__nom">EP 6</span><span class="bstat__val">140</span></span></span>',
  );
  // une rubrique sans échelle : comme avant
  assert.doesNotMatch(htmlDeRubrique('sante', 'Santé : 20'), /data-eps/);
});

test('butin : l’objet du glossaire écrit en tête de la case, suivi d’une quantité ou d’une amélioration ; rien d’autre n’est rapproché', () => {
  const g = [
    { id: 'gelee-verte', nom: 'Gelée verte' },
    { id: 'gelee-verte-foncee', nom: 'Gelée verte foncée' },
    { id: 'coeur-polaire', nom: 'Cœur polaire' },
    { id: 'citron', nom: 'Citron' },
    { id: 'os-moyen', nom: 'Os moyen' },
  ];
  const id = (t) => objetDuButin(t, g)?.objet.id ?? null;
  assert.equal(id('Gelée verte x 1d6'), 'gelee-verte');
  assert.equal(id('Gelée verte foncée x2'), 'gelee-verte-foncee', 'le nom le plus long l’emporte');
  assert.equal(id('Gelée verte'), 'gelee-verte');
  assert.equal(id('Gelée verte (1d4)'), 'gelee-verte');
  assert.equal(id('Gelée verte + 1'), 'gelee-verte');
  assert.equal(id('Gelée verte +2'), 'gelee-verte');
  assert.deepEqual(objetDuButin('Coeur polaire x 4', g), { objet: g[2], ecrit: 'Coeur polaire', reste: ' x 4' }, 'la ligature seule');
  for (const t of ['Citron de foudre x 1d4', '4 os moyen', 'gelée verte x 1', 'Gelée vertes', 'Gelée verte pour 24h', 'Cœur', '']) assert.equal(id(t), null, t);
  assert.equal(objetDuButin('Gelée verte', []), null);
  // toute la base : l'objet trouvé et la suite redonnent la case
  const cases = db.prepare('SELECT texte FROM monstre_butin').all();
  let citees = 0;
  for (const { texte: t } of cases) {
    const o = objetDuButin(t, glossaire);
    if (!o) continue;
    citees += 1;
    assert.equal(o.ecrit + o.reste, t);
    assert.equal(o.ecrit.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe'), o.objet.nom.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe'));
  }
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
  const html = htmlDeLEchelle('3, 5, 7', 'mini_boss', echelles);
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
  assert.equal(rendreChamp('monstre-echelle', '2-6', { categorie: 'boss' }, { echellesDePuissance: echelles }), htmlDeLEchelle('2-6', 'boss', echelles));
});

test('carte construite : le curseur (s’il y a lieu) entre la tête et la carte, une case de butin par objet cité', () => {
  const { lignes } = chargerMonstres(db);
  for (const l of lignes) {
    const html = htmlDeCarteMonstre(l, { logo: '/logo.webp', echelles, glossaire });
    const plusieurs = l.carte && echellesEcrites(l.carte.echelle).length >= 2;
    assert.equal(/data-echelles=/.test(html), Boolean(plusieurs), l.id);
    if (l.carte) assert.match(html, /<\/header><div class="bcarte__echelle" data-ed-lecture="[^"]+" data-ed-rendu="monstre-echelle">/, l.id);
    else assert.doesNotMatch(html, /bcarte__echelle/, l.id);
    const attendus = l.espece.butin.flatMap((t) => ['ennemi_simple', 'mini_boss', 'boss'].map((cat) => t[cat])).filter((t) => t && objetDuButin(t, glossaire)).length;
    assert.equal((html.match(/<button type="button" class="bobjet" /g) ?? []).length, attendus, l.id);
  }
});
