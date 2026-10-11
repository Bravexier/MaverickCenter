// Niveaux de maîtrise (NM) des sorts, sur les VRAIES données : migration 0004-bonus-maitrise (colonne `sort.bonus_maitrise`, table `sort_bonus_maitrise`, mode séparé du type,
// vue `v_sort_bonus_au_nm`). Les fonctions pures sont testées dans sort-maitrise.test.mjs.
//
// Trois garanties : (1) rien n'est inventé : chaque ligne recopie une expression exacte de la cellule du sort ; (2) rien n'est oublié : chaque mention de NM écrite dans une des sept colonnes
// de texte est couverte par une ligne ; (3) les représentations d'une même donnée (colonne, lignes typées, vue SQL, fonction JavaScript) se disent la même chose.
// Le site de dev est la source des sorts qu'il modifie (décision du propriétaire) : les effectifs et les cas cités de la migration se lisent sur les lignes
// d'avant ses modifications (historique_modification, lib/historique-site.mjs) ; l'état courant est contrôlé par les garanties (1) à (3).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { bonusDeMaitrise, COLONNES_NM } from '../src/lib/sort-analyse.mjs';
import { coutDeSort, valeurDeSort } from '../src/lib/sort-format.mjs';
import { applications, marquerBonus, ORDRE_CHAMPS_NM, sansBonus, texteDeBonus } from '../src/lib/sort-maitrise.mjs';

const db = ouvrirBase({ sansExemples: false });
const magies = chargerMagies(db);
const COLONNE = { type: 'type_brut', cout: 'cout_brut', portee: 'portee_brut', zone: 'zone_brut', dsb: 'dsb_brut', effets: 'effets', remarque: 'remarque' };
const sorts = new Map(db.prepare('SELECT * FROM sort').all().map((s) => [s.id, s]));
const lignes = db.prepare('SELECT * FROM sort_bonus_maitrise ORDER BY sort_id, champ, rang').all();
const slug = (id) => id.split('#sort:')[1];
const bonusDe = (id) => magies.sorts.get(`magies/${id}`)?.bonus ?? magies.sorts.get(id).bonus;
const sort = (nom) => [...magies.sorts.values()].find((s) => s.slug === nom);
// les lignes telles que la migration 0004 les a écrites (avant les modifications du site de dev), au format de lib/magies-db.mjs
const historique = historiqueSite(db);
const lignesImport = historique.lignesDImport('sort_bonus_maitrise');
const sortsImport = historique.lignesDImport('sort');
const enModele = (b) => ({ champ: b.champ, rang: b.rang, nature: b.nature, texteBrut: b.texte_brut, contexte: b.contexte, incrementBrut: b.increment_brut,
  incrementEntier: b.increment_entier, pasNm: b.pas_nm, seuilNm: b.seuil_nm });
const ordreDeLecture = (a, b) => ORDRE_CHAMPS_NM.indexOf(a.champ) - ORDRE_CHAMPS_NM.indexOf(b.champ) || a.rang - b.rang;
const bonusDImport = (nom) => lignesImport.filter((l) => slug(l.sort_id) === nom).sort(ordreDeLecture).map(enModele);
const idDe = (nom) => [...sorts.keys()].find((id) => slug(id) === nom);
/** Le sort n'a pas été réécrit par le site sur ces colonnes : ses exemples de l'import valent encore pour l'état courant. */
const intact = (nom, ...colonnes) => !colonnes.some((c) => historique.modifiee('sort', { id: idDe(nom) }, c));
// mention de NM : « NM », « 3NM », « 3 NM », « niveau(x) de maîtrise », « Maîtrise »
const MENTION = /(?<![A-Za-zÀ-ÿ])NM(?![A-Za-zÀ-ÿ])|[Mm]aîtrise/g;
const occurrences = (texte, sous) => {
  const o = [];
  for (let i = texte.indexOf(sous); i >= 0; i = texte.indexOf(sous, i + 1)) o.push(i);
  return o;
};

test('chaque ligne recopie une expression exacte de la cellule de son sort, dans la colonne indiquée (rien n’est inventé)', () => {
  assert.equal(lignesImport.length, 352, 'à l’import (migration 0004)');
  // aujourd'hui : exactement les expressions que le découpage de l'édition trouve dans les cellules (lib/sort-analyse.mjs, rejoué sur toute la base)
  let trouvees = 0;
  for (const s of sorts.values()) for (const [champ, colonne] of Object.entries(COLONNES_NM)) trouvees += bonusDeMaitrise(champ, s[colonne]).length;
  assert.equal(lignes.length, trouvees);
  for (const l of lignes) {
    const cellule = sorts.get(l.sort_id)[COLONNE[l.champ]];
    const nom = `${slug(l.sort_id)} ${l.champ} « ${l.texte_brut} »`;
    assert.ok(cellule, `${nom} : cellule vide`);
    assert.ok(cellule.includes(l.texte_brut), `${nom} : expression absente de la cellule`);
    assert.ok(cellule.includes(l.contexte), `${nom} : contexte absent de la cellule`);
    assert.ok(l.contexte.includes(l.texte_brut), `${nom} : le contexte ne contient pas l’expression`);
    assert.ok(l.contexte.length <= 160 && !l.texte_brut.includes('\n'), `${nom} : trop long ou sur plusieurs lignes`);
    if (l.nature === 'par_nm' && /^[+\-–−]\d+$/.test(l.increment_brut)) {
      assert.equal(l.increment_entier, (/^\+/.test(l.increment_brut) ? 1 : -1) * Number(l.increment_brut.slice(1)), `${nom} : entier signé`);
    } else assert.equal(l.increment_entier, null, `${nom} : un incrément qui n'est pas un entier signé reste sans valeur typée`);
  }
});

test('toute mention de NM écrite dans une des sept colonnes de texte est couverte par une ligne (rien n’est oublié)', () => {
  let mentions = 0;
  for (const s of sorts.values()) {
    for (const champ of ORDRE_CHAMPS_NM) {
      const cellule = s[COLONNE[champ]];
      if (!cellule) continue;
      const plages = lignes.filter((l) => l.sort_id === s.id && l.champ === champ).flatMap((l) => occurrences(cellule, l.contexte).map((i) => [i, i + l.contexte.length]));
      for (const m of cellule.matchAll(MENTION)) {
        mentions += 1;
        assert.ok(plages.some(([a, b]) => m.index >= a && m.index < b), `${slug(s.id)} ${champ} : « ${m[0]} » n’a pas de ligne`);
      }
    }
  }
  assert.equal(mentions, lignes.length, 'une mention par ligne dans les données actuelles');
});

test('répartition : 352 bonus sur 319 sorts ; trois sorts n’écrivent aucun NM et n’ont ni ligne ni « Bonus Maîtrise »', () => {
  // à l'import (migration 0004)
  const parCle = {};
  for (const l of lignesImport) parCle[`${l.champ}:${l.nature}`] = (parCle[`${l.champ}:${l.nature}`] ?? 0) + 1;
  assert.deepEqual(parCle, {
    'cout:par_nm': 56, 'dsb:par_nm': 83, 'effets:palier': 44, 'effets:par_nm': 43, 'effets:texte': 1, 'portee:par_nm': 44,
    'remarque:palier': 2, 'type:palier': 69, 'type:par_nm': 3, 'zone:palier': 2, 'zone:par_nm': 5,
  });
  assert.equal(new Set(lignesImport.map((l) => l.sort_id)).size, 319);
  const sans = sortsImport.filter((s) => s.bonus_maitrise === null).map((s) => slug(s.id)).sort();
  assert.deepEqual(sans, ['inhalation-magique', 'pour-moi', 'vision-magique']);
  for (const id of sans) assert.equal(lignesImport.filter((l) => slug(l.sort_id) === id).length, 0);
  // aujourd'hui : un sort n'a aucune ligne ⇔ pas de « Bonus Maîtrise » ⇔ aucune de ses sept cases ne mentionne de NM
  const avecLignes = new Set(lignes.map((l) => l.sort_id));
  for (const s of sorts.values()) {
    const mentionne = ORDRE_CHAMPS_NM.some((champ) => [...(s[COLONNE[champ]] ?? '').matchAll(MENTION)].length > 0);
    assert.equal(avecLignes.has(s.id), s.bonus_maitrise !== null, `${slug(s.id)} : lignes ⇔ « Bonus Maîtrise »`);
    assert.equal(avecLignes.has(s.id), mentionne, `${slug(s.id)} : lignes ⇔ mention de NM`);
  }
});

test('« Bonus Maîtrise » (sort.bonus_maitrise) est la recopie des lignes typées : une ligne « <Colonne> : <passage> » par bonus, dans l’ordre de lecture', () => {
  for (const s of magies.sorts.values()) {
    const ligne = db.prepare('SELECT bonus_maitrise FROM sort WHERE id = ?').get(s.id).bonus_maitrise;
    assert.equal(ligne, texteDeBonus(s.bonus), `${s.slug}`);
    assert.equal(s.bonus.length === 0, ligne === null);
    // dans l'ordre de lecture : colonnes du tableau puis position dans la cellule
    const cles = s.bonus.map((b) => ORDRE_CHAMPS_NM.indexOf(b.champ) * 100 + b.rang);
    assert.deepEqual(cles, [...cles].sort((a, b) => a - b), s.slug);
  }
});

test('cas connus : IC à 3 NM, coût et portée par NM, effet supplémentaire à 3 NM, durée par NM, tiret demi-cadratin, mention sans valeur typée', () => {
  // la page lit les lignes de la table telles quelles (lib/magies-db.mjs), dans l'ordre de lecture
  for (const s of magies.sorts.values()) assert.deepEqual(s.bonus, lignes.filter((l) => l.sort_id === s.id).sort(ordreDeLecture).map(enModele), s.slug);
  // les cas lus par la migration 0004 (lignes d'avant les modifications du site de dev)
  const lire = (nom) => bonusDImport(nom).map((b) => [b.champ, b.nature, b.texteBrut, b.seuilNm, b.pasNm, b.incrementBrut, b.incrementEntier]);
  assert.deepEqual(lire('boule-de-feu'), [
    ['dsb', 'par_nm', '+1d6/NM', null, 1, '+1d6', null],
    ['effets', 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre brûlure 1', 3, null, null, null],
  ]);
  assert.deepEqual(lire('attirance'), [['type', 'palier', 'IC x 2 si 3NM', 3, null, null, null]]);
  assert.deepEqual(lire('sang-durci'), [['type', 'palier', 'IC pour 3 NM', 3, null, null, null]]);
  assert.deepEqual(lire('verrouillage-simple'), [['effets', 'par_nm', '+1/NM', null, 1, '+1', 1]]);
  assert.equal(bonusDImport('verrouillage-simple')[0].contexte, 'Dure 2 tours (+1/NM)');
  assert.deepEqual(lire('laser-noir').filter((b) => b[0] === 'effets'), [['effets', 'par_nm', '1%/NM', null, 1, '1%', null]]);
  assert.deepEqual(lire('marquage'), [['dsb', 'par_nm', '+1d/3NM', null, 3, '+1d', null]]);
  assert.deepEqual(lire('metronome'), [['effets', 'texte', 'Les NM sont utiles pour le sort aléatoire', null, null, null, null]]);
  assert.deepEqual(lire('force-agile').filter((b) => b[0] === 'effets'), [['effets', 'palier', '1NM = +3 dégâts', 1, null, null, null]]);
  assert.deepEqual(lire('alea-negatif').map((b) => [b[0], b[1], b[3]]), [['remarque', 'palier', 3]], 'la note de cellule porte le palier');
  const tiret = lignesImport.map(enModele).filter((b) => b.texteBrut.includes('–'));
  assert.ok(tiret.length >= 2 && tiret.every((b) => b.incrementEntier === -1 && b.incrementBrut === '–1'), 'le « – » de la source est conservé et vaut -1');
  // « /3NM » collé à une proposition en toutes lettres = palier à 3 NM (lecture des trois grenades voisines)
  assert.deepEqual(lire('grenade-cryogenique'), [['effets', 'palier', 'Si jet de vigueur raté = Inflige gel 1/3NM', 3, null, null, null]]);
});

test('mode séparé du type : mode_brut = le texte entre parenthèses de la colonne Type ; sort_mode ne garde que les valeurs de base ; une condition de NM est un bonus', () => {
  let avecMode = 0;
  for (const s of sorts.values()) {
    const groupes = [...s.type_brut.replace(/\n/g, ' ').matchAll(/\(([^()]*)\)/g)].map((m) => m[1].trim());
    assert.equal(s.mode_brut, groupes.length ? groupes.join('\n') : null, slug(s.id));
    if (groupes.length) avecMode += 1;
    const modes = db.prepare('SELECT mode, libelle, fois FROM sort_mode WHERE sort_id = ? ORDER BY rang').all(s.id);
    const conditionnels = groupes.filter((g) => /NM/.test(g));
    const base = groupes.filter((g) => !/NM/.test(g)).flatMap((g) => g.split(/\s*\/\s*(?=\p{L})/u).map((x) => x.trim()));
    assert.deepEqual(modes.map((m) => m.libelle), base, `${slug(s.id)} : modes de base`);
    // chaque condition de NM du type est une ligne de bonus (champ 'type') qui la contient
    const bonusType = lignes.filter((l) => l.sort_id === s.id && l.champ === 'type');
    assert.equal(bonusType.length, conditionnels.length, `${slug(s.id)} : une ligne de bonus par condition de NM du type`);
    for (const g of conditionnels) assert.ok(bonusType.some((l) => g.includes(l.texte_brut)), `${slug(s.id)} : « ${g} »`);
    // les drapeaux historiques de la table des sorts disent la même chose que sort_mode
    assert.equal(!!s.ic_direct, modes.some((m) => m.mode === 'ic' && m.fois === null), `${slug(s.id)} : ic_direct`);
    assert.equal(!!s.imparable, modes.some((m) => m.mode === 'imparable'), `${slug(s.id)} : imparable`);
    assert.equal(!!s.inesquivable, modes.some((m) => m.mode === 'inesquivable'), `${slug(s.id)} : inesquivable`);
  }
  assert.equal(avecMode, [...sorts.values()].filter((s) => s.mode_brut !== null).length);
  // à l'import (migration 0004) : 126 sorts avec un mode, 59 modes de base
  assert.equal(sortsImport.filter((s) => s.mode_brut !== null).length, 126);
  const modesImport = historique.lignesDImport('sort_mode');
  assert.equal(modesImport.length, 59);
  assert.deepEqual(modesImport.filter((m) => m.fois !== null).sort((a, b) => a.libelle.localeCompare(b.libelle)).map((r) => [r.libelle, r.fois]), [['IC x 2', 2], ['IC x 3', 3]]);
  const modeBrut = (nom) => historique.valeurDImport('sort', { id: idDe(nom) }, 'mode_brut');
  const modes = (nom) => modesImport.filter((m) => m.sort_id === idDe(nom)).sort((a, b) => a.rang - b.rang).map((m) => m.libelle);
  assert.equal(modeBrut('rune-arcane'), 'IC x 1/NM');
  assert.deepEqual(modes('rune-arcane'), [], 'IC x 1/NM dépend du NM : ce n’est pas un mode de base');
  assert.equal(modeBrut('attirance'), 'IC\nIC x 2 si 3NM');
  assert.deepEqual(modes('attirance'), ['IC']);
  for (const nom of ['rune-arcane', 'attirance']) {
    if (intact(nom, 'type_brut')) assert.deepEqual([sort(nom).modeBrut, sort(nom).modes.map((m) => m.libelle)], [modeBrut(nom), modes(nom)], nom);
  }
});

test('la vue v_sort_bonus_au_nm et la fonction applications() disent la même chose pour tous les bonus (352 à l’import) à 0, 1, 2 et 3 NM', () => {
  const vue = db.prepare('SELECT sort_id, nm, champ, rang, applications FROM v_sort_bonus_au_nm').all();
  assert.equal(vue.length, lignes.length * 4);
  const lignesParCle = new Map(magies.sorts.size ? [...magies.sorts.values()].flatMap((s) => s.bonus.map((b) => [`${s.id}|${b.champ}|${b.rang}`, b])) : []);
  for (const v of vue) {
    const b = lignesParCle.get(`${v.sort_id}|${v.champ}|${v.rang}`);
    assert.equal(v.applications, applications(b, v.nm), `${slug(v.sort_id)} ${v.champ} « ${b.texteBrut} » à ${v.nm} NM`);
  }
  // un exemple lu en entier : « Boule de feu » à 2 NM = +1d6 deux fois, le palier de 3 NM pas encore (à l'import ; dans la vue tant que le site n'a pas réécrit le sort)
  assert.deepEqual(bonusDImport('boule-de-feu').map((b) => [b.champ, applications(b, 2)]), [['dsb', 2], ['effets', 0]]);
  if (intact('boule-de-feu', 'dsb_brut', 'effets')) {
    const bdf = db.prepare("SELECT champ, applications FROM v_sort_bonus_au_nm WHERE sort_id = 'magies/magie-du-feu#sort:boule-de-feu' AND nm = 2 ORDER BY rang, champ").all();
    assert.deepEqual(bdf.map((r) => [r.champ, r.applications]), [['dsb', 2], ['effets', 0]]);
  }
});

test('valeur de base : une fois l’expression de NM retirée, aucune cellule de coût, portée, zone ou D/S/B ne mentionne plus de NM', () => {
  for (const s of magies.sorts.values()) {
    for (const [champ, cle] of [['cout', 'coutBrut'], ['portee', 'porteeBrut'], ['zone', 'zoneBrut'], ['dsb', 'dsbBrut']]) {
      const base = sansBonus(s[cle], s.bonus, champ);
      assert.ok(!base || !/NM|aîtrise/.test(base), `${s.slug} ${champ} : « ${base} »`);
    }
  }
  // Boule de feu telle que l'import l'a écrite
  const bdf = (colonne) => historique.valeurDImport('sort', { id: idDe('boule-de-feu') }, colonne);
  assert.equal(sansBonus(bdf('dsb_brut'), bonusDImport('boule-de-feu'), 'dsb'), '2d6 dégâts');
  assert.equal(sansBonus(bdf('portee_brut'), bonusDImport('boule-de-feu'), 'portee'), '6');
});

test('à l’écran : chaque bonus d’une cellule de coût, portée, zone ou D/S/B est une pastille dans sa cellule, et le reste de la cellule ne mentionne plus de NM', () => {
  let pastilles = 0;
  for (const s of magies.sorts.values()) {
    for (const [champ, morceaux] of [
      ['cout', coutDeSort(s.coutBrut).parts],
      ['portee', valeurDeSort(s.porteeBrut).lignes],
      ['zone', valeurDeSort(s.zoneBrut).lignes],
      ['dsb', valeurDeSort(s.dsbBrut, { liste: true }).lignes],
    ]) {
      const marques = marquerBonus(morceaux, s.bonus, champ).flat();
      const nm = marques.filter((m) => m.nm).map((m) => m.texte);
      assert.deepEqual(nm.sort(), s.bonus.filter((b) => b.champ === champ).map((b) => b.texteBrut.trim()).sort(), `${s.slug} ${champ}`);
      for (const m of marques.filter((x) => !x.nm)) assert.ok(!/NM|aîtrise/.test(m.texte), `${s.slug} ${champ} : « ${m.texte} »`);
      pastilles += nm.length;
    }
  }
  assert.equal(pastilles, lignes.filter((l) => ['cout', 'portee', 'zone', 'dsb'].includes(l.champ)).length);
  assert.equal(lignesImport.filter((l) => ['cout', 'portee', 'zone', 'dsb'].includes(l.champ)).length, 190, 'à l’import');
  const dsb = historique.valeurDImport('sort', { id: idDe('boule-de-feu') }, 'dsb_brut');
  assert.deepEqual(marquerBonus(valeurDeSort(dsb, { liste: true }).lignes, bonusDImport('boule-de-feu'), 'dsb'), [[{ texte: '2d6 dégâts', modif: false }, { texte: '+1d6/NM', modif: true, nm: true }]]);
});

test('migration 0004 : le registre JSON décrit exactement les lignes de la base (modes et bonus) d’avant les modifications du site', () => {
  const registre = JSON.parse(readFileSync(join(trouverRacine(), 'data', 'migrations', '0004-bonus-maitrise.json'), 'utf8'));
  assert.equal(registre.migration, '0004-bonus-maitrise');
  assert.equal(registre.bonus.length, lignesImport.length);
  assert.equal(registre.modes.length, historique.effectifDImport('sort_mode'));
  const cle = (l) => `${l.sort_id}|${l.champ}|${l.rang}|${l.nature}|${l.texte_brut}|${l.contexte}`;
  // 0006 (noms à trancher) a corrigé ensuite un nom dans le contexte de certaines lignes (« Purée de pois ») : le registre décrit les lignes d'avant
  const noms0006 = JSON.parse(readFileSync(join(trouverRacine(), 'data', 'migrations', '0006-orthographe-noms.json'), 'utf8')).corrections
    .filter((c) => c.table === 'sort_bonus_maitrise' && c.col === 'contexte');
  const projete = (l) => noms0006.filter((c) => c.cle.sort_id === l.sort_id && c.cle.champ === l.champ && c.cle.rang === l.rang)
    .reduce((x, c) => ({ ...x, contexte: x.contexte.replaceAll(c.avant, c.apres) }), l);
  assert.deepEqual(registre.bonus.map(projete).map(cle).sort(), lignesImport.map(cle).sort());
});
