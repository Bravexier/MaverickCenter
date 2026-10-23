// Les lignes des armes élémentaires de la page des armes (décision R167 ; lib/armes-rendu.mjs#htmlDeLigneDArmeElementaire, la case du coût élémentaire
// htmlDuCoutElementaire) rendues depuis la base (lib/armes-db.mjs#chargerArmes) : deux `<tr>` comme une arme du catalogue, sur le fond de leur magie (une
// classe de la palette, jamais un style), le dé et la portée de leur type, « +8 Dégâts », la solidité de base (4), la compétence au choix du porteur
// (« Mêlée / arme de jets / bombes  => Légère / Lourde Arc => Arc / Légère Arbalète => Arbalète »), la capacité ; l'arbalète ignore 4 AP, l'arme de jet et
// la bombe portent la mention de leur type ; ni prix en RO ni « [Métier à définir] » ; en lecture sur le site de dev (aucun `data-ed`). La fiche (le
// calcul) : test/arme-forge.test.mjs ; le script : test/armes-script.test.mjs ; le site construit : test/armes-html.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forgerArmeElementaire } from '../src/lib/arme-forge.mjs';
import { chargerArmes, contexteDesArmes } from '../src/lib/armes-db.mjs';
import {
  ancreDArmeElementaire, COLONNES_D_UNE_ARME, htmlDeLigneDArme, htmlDeLigneDArmeElementaire, htmlDesTypesDeDegatsElementaires, htmlDuCoutElementaire,
  MAINS_D_UNE_ARME_ELEMENTAIRE, RENDUS_DES_ARMES,
} from '../src/lib/armes-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { classeDeMagie } from '../src/lib/palette-css.mjs';

const db = ouvrirBase({ sansExemples: false });
const armes = chargerArmes(db);
const contexte = contexteDesArmes(db);
const ligneDe = (f, ae) => htmlDeLigneDArmeElementaire(ae, { type: f.type_elementaire, solidite: armes.solidite_elementaire }, contexte);
const avecType = armes.familles.filter((f) => f.type_elementaire);
const attribut = (html, nom) => html.match(new RegExp(` data-${nom}="([^"]*)"`))?.[1] ?? null;

test('R167 : chaque arme élémentaire, deux lignes (`tr.arme` puis `tr.arme-suite`) sur le fond de sa magie, ancre unique, en lecture sur le site de dev', () => {
  assert.equal(avecType.length, armes.familles.length, 'chaque famille de la page a son type élémentaire');
  const ancres = [];
  for (const f of avecType) {
    for (const ae of f.armes_elementaires) {
      const html = ligneDe(f, ae);
      const classe = classeDeMagie(ae.magie);
      assert.match(classe, /^couleur-magie-(?!par-defaut)/, `${ae.id} : une magie connue de la palette`);
      assert.ok(html.startsWith(`<tr class="arme arme--elementaire ${classe}" id="${ancreDArmeElementaire(ae.id)}" data-arme="`), ae.id);
      assert.equal((html.match(/<tr /g) ?? []).length, 2, `${ae.id} : deux lignes`);
      assert.ok(html.includes(`<tr class="arme-suite arme-suite--elementaire ${classe}" data-arme-suite="`), `${ae.id} : la ligne des effets, sur le même fond`);
      assert.ok(html.includes(`<td class="arme__effets" colspan="${COLONNES_D_UNE_ARME - 1}">`), ae.id);
      assert.doesNotMatch(html, /style=/, `${ae.id} : jamais un style`);
      assert.doesNotMatch(html, /data-ed/, `${ae.id} : aucun champ du mode modification`);
      assert.doesNotMatch(html, /arme--depart/, `${ae.id} : jamais une arme de départ`);
      assert.doesNotMatch(html, /data-monnaie|piece--|\bRO\b|Métier/, `${ae.id} : ni prix en RO ni métier`);
      assert.equal(attribut(html, 'gemme'), ae.gemme?.nom ?? null, `${ae.id} : la gemme de sa magie`);
      assert.ok(html.includes(`>${ae.nom.replace(/'/g, '&#39;')}</button>`), `${ae.id} : son nom`);
      // ses mains (« l'arme s'adapte au porteur ») : écrites comme celles d'une arme `une_ou_deux` du catalogue, à la même place (après le nom)
      assert.ok(html.includes(`</button></span><span class="arme__mains">${RENDUS_DES_ARMES['arme-mains']('une_ou_deux')}</span>`), `${ae.id} : une ou deux mains`);
      ancres.push(ancreDArmeElementaire(ae.id));
    }
  }
  assert.equal(new Set(ancres).size, ancres.length, 'ancres uniques');
  assert.equal(ancres.length, avecType.length * 14);
});

test('R167 : le dé et la portée de son type (rien de l’arme d’origine ; Pugilat selon la Force), +8, solidité 4, la compétence au choix du porteur', () => {
  assert.equal(armes.solidite_elementaire, 4);
  const competencesAttendues = (type) => (type === 'arc' ? ['arc', 'arme-legere'] : type === 'arbalete' ? ['arbalete'] : ['arme-legere', 'arme-lourde']);
  for (const f of avecType) {
    const t = f.type_elementaire;
    for (const ae of f.armes_elementaires) {
      const html = ligneDe(f, ae);
      const de = t.de ?? (t.de_regle.match(/D\d+/g) ?? []).join('/');
      assert.equal(attribut(html, 'de'), de, `${ae.id} : le dé du type`);
      assert.equal(Number(attribut(html, 'bonus')), ae.bonus_degats, ae.id);
      assert.equal(ae.bonus_degats, 8, `${ae.id} : « +8 Dégâts »`);
      assert.equal(attribut(html, 'portee'), t.portee_min === t.portee_max ? String(t.portee_min) : `${t.portee_min}-${t.portee_max}`, `${ae.id} : la portée du type`);
      assert.equal(attribut(html, 'durabilite'), '4', ae.id);
      assert.deepEqual(attribut(html, 'competences').split(' ').sort(), competencesAttendues(t.id), `${ae.id} : compétences`);
      if (!t.de) assert.ok(html.includes(`title="Dé selon la Force : ${t.de_regle}"`), `${ae.id} : Pugilat selon la Force`);
    }
  }
});

test('R167 : Arc court (ou n’importe quel arc) → « Arc de Sang », D8, portée 2-10, +8, solidité 4 ; au +5 : D8+18, solidité 5', () => {
  const arc = armes.familles.find((f) => f.armes.some((a) => a.nom === 'Arc court'));
  assert.ok(arc, 'la famille de l’Arc court');
  const sang = arc.armes_elementaires.find((ae) => ae.magie_id === 'magies/magie-du-sang');
  assert.equal(sang.nom, 'Arc de Sang');
  assert.equal(sang.gemme?.nom, 'Grenat');
  const html = ligneDe(arc, sang);
  assert.deepEqual([attribut(html, 'de'), attribut(html, 'portee'), attribut(html, 'bonus'), attribut(html, 'durabilite')], ['D8', '2-10', '8', '4']);
  const forge = (n) => forgerArmeElementaire({ de: 'D8', bonus_degats: 8, solidite: 4 }, armes.ameliorations, n);
  assert.deepEqual([forge(0).degats, forge(0).durabilite.total], ['D8+8', 4]);
  assert.deepEqual([forge(5).degats, forge(5).durabilite.total], ['D8+18', 5]);
  assert.deepEqual(forge(5).cout.gemmes, { commune: 6, raffinee: 3, parfaite: 0 });
  // chaque arme de la famille mène aux mêmes armes élémentaires : celles du tableau de la famille
  assert.ok(arc.armes.every((a) => a.famille_id === arc.id));
});

test('R167 : l’arbalète élémentaire ignore 4 AP ; l’arme de jet et la bombe portent la mention de leur type ; la capacité telle qu’écrite', () => {
  for (const f of avecType) {
    const t = f.type_elementaire;
    for (const ae of f.armes_elementaires) {
      const effets = ligneDe(f, ae).split('<tr class="arme-suite')[1];
      assert.equal(effets.includes(`data-ignore-ap="4">Ignore 4 AP</span>`), t.id === 'arbalete', `${ae.id} : ignore 4 AP`);
      const mention = 'Ces armes sont qu&#39;en un exemplaire et reviennent toujours dans la main du lanceur (sauf EC)';
      assert.equal(effets.includes(mention), ['arme-de-jet', 'bombe'].includes(t.id), `${ae.id} : la mention de l’exemplaire unique`);
      assert.equal(t.exemplaire_unique, ['arme-de-jet', 'bombe'].includes(t.id), `${t.id} : en un seul exemplaire`);
      if (ae.capacite_nom) assert.ok(effets.includes(`<strong class="arme-capacite__nom">${ae.capacite_nom.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}</strong>`), `${ae.id} : sa capacité`);
    }
  }
});

test('R167 : la case du coût élémentaire — le coût tel que la ligne l’écrit, ses valeurs, le cumul en infobulle, la place du nom de la gemme', () => {
  for (const a of armes.ameliorations) {
    const html = htmlDuCoutElementaire(a, 'cumul');
    assert.ok(html.includes(`>${a.cout_elementaire_brut}`), `+${a.niveau} : tel qu’écrit`);
    assert.equal(attribut(html, 'gemmes'), a.cout_gemmes === null ? null : String(a.cout_gemmes));
    assert.equal(attribut(html, 'qualite'), a.cout_gemmes_qualite);
    assert.equal(attribut(html, 'pieces'), a.cout_pieces_elementaires === null ? null : String(a.cout_pieces_elementaires));
    assert.equal(html.includes('data-armes-gemme'), a.cout_gemmes !== null, `+${a.niveau} : le nom de la gemme, seulement s’il en faut`);
    assert.ok(html.includes(`title="Du +1 au +${a.niveau} : cumul"`));
  }
  assert.ok(!htmlDuCoutElementaire(armes.ameliorations[0]).includes('title='), 'sans cumul, pas d’infobulle');
});

test('R167 : les mains d’une arme élémentaire, celles d’une arme `une_ou_deux` du catalogue, même écriture et même place', () => {
  assert.equal(MAINS_D_UNE_ARME_ELEMENTAIRE, 'une_ou_deux');
  assert.equal(RENDUS_DES_ARMES['arme-mains'](MAINS_D_UNE_ARME_ELEMENTAIRE), 'une ou deux mains');
  const f = avecType.find((x) => x.armes.some((a) => a.mains === 'une_ou_deux'));
  assert.ok(f, 'une famille qui a une arme à une ou deux mains');
  const catalogue = htmlDeLigneDArme(f.armes.find((a) => a.mains === 'une_ou_deux'), contexte);
  const mainsDe = (html) => html.match(/<span class="arme__mains"[^>]*>([^<]*)<\/span>/)?.[1];
  assert.equal(mainsDe(ligneDe(f, f.armes_elementaires[0])), mainsDe(catalogue));
  // juste après le nom, comme l'arme du catalogue (`.arme__libelle`, puis `.arme__mains`, puis `.arme__note`)
  for (const html of [catalogue, ligneDe(f, f.armes_elementaires[0])]) {
    assert.match(html, /<\/button><\/span><span class="arme__mains"[^>]*>[^<]*<\/span><span class="arme__note"/);
  }
});

test('R167, type de dégâts : la colonne d’une arme élémentaire dit ses types physiques (tous, ou l’un au choix pour la bombe), puis « + » et sa magie', () => {
  const span = (t, nom) => `<span class="arme-dgt arme-dgt--${t}">${nom}</span>`;
  for (const f of avecType) {
    const t = f.type_elementaire;
    for (const ae of f.armes_elementaires) {
      const types = ligneDe(f, ae).match(/<td class="arme__types">(.*?)<\/td>/)?.[1] ?? '';
      const magie = `<span class="arme-dgt arme-dgt--magie" data-magie="${ae.magie_id}">${ae.magie.replace(/'/g, '&#39;')}</span>`;
      assert.ok(types.endsWith(magie), `${ae.id} : ${types}`);
      assert.equal((types.match(/class="arme-dgt /g) ?? []).length, t.types_degats.length + 1, `${ae.id} : rien d’autre`);
      assert.equal(types.includes('(au choix)'), t.type_degats_au_choix, ae.id);
    }
  }
  const de = (id, magie) => avecType.find((f) => f.id === id).armes_elementaires.find((ae) => ae.magie_id === magie);
  const ligne = (famille, magie) => ligneDe(avecType.find((f) => f.id === famille), de(famille, magie)).match(/<td class="arme__types">(.*?)<\/td>/)[1];
  const m = (id, nom) => `<span class="arme-dgt arme-dgt--magie" data-magie="${id}">${nom}</span>`;
  assert.equal(ligne('arc', 'magies/magie-du-feu'), `${span('estoc', 'Estoc')} + ${m('magies/magie-du-feu', de('arc', 'magies/magie-du-feu').magie)}`, 'Arc de Feu : Estoc + Feu');
  assert.equal(ligne('dagues', 'magies/magie-du-sang'), `${span('estoc', 'Estoc')} ${span('taille', 'Taille')} + ${m('magies/magie-du-sang', de('dagues', 'magies/magie-du-sang').magie)}`, 'Dague de Sang');
  assert.equal(ligne('masse-marteau', 'magies/magie-du-feu'), `${span('frappe', 'Frappe')} + ${m('magies/magie-du-feu', de('masse-marteau', 'magies/magie-du-feu').magie)}`, 'Masse de Feu');
  assert.equal(ligne('bombes', 'magies/magie-du-feu'), `<span class="arme-dgt-choix" title="Un seul type, au choix du porteur">${span('estoc', 'Estoc')}, ${span('frappe', 'Frappe')} ou ${span('taille', 'Taille')} <small>(au choix)</small></span> + ${m('magies/magie-du-feu', de('bombes', 'magies/magie-du-feu').magie)}`);
  // sans type physique en données : la magie seule, rien de deviné
  const arc = avecType.find((f) => f.id === 'arc');
  assert.equal(htmlDesTypesDeDegatsElementaires(de('arc', 'magies/magie-du-feu'), { ...arc.type_elementaire, types_degats: undefined }), m('magies/magie-du-feu', de('arc', 'magies/magie-du-feu').magie));
});
