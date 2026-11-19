// Corps des pages « Armures » et « Bouclier » suivi depuis les tables (lib/corps-armures.mjs) : chaque armure, bouclier, forme, poids, pièce et
// amélioration de la base retrouve sa ligne dans le corps de sa page, et une modification ne change que cette ligne (et le titre du tableau d'une forme
// renommée) ; une modification qui ne change rien de visible laisse la ligne telle que l'importeur l'a écrite. Une ligne introuvable lève une erreur.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  corpsDesArmuresApres, corpsDesArmuresEntier, ErreurCorpsArmures, finDeLigneDArmure, finDeLigneDeBouclier, ligneDAmelioration, ligneDeForme, ligneDePiece, ligneDePoids, ligneDuTotal,
  PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS, pageDeLaLigne,
} from '../src/lib/corps-armures.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { etatDuCorpsDesArmures } from '../serveur/edition-armures.mjs';

const db = ouvrirBase();
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
/** Les lignes qui diffèrent entre deux corps de même longueur. */
const differences = (a, b) => {
  const x = a.split('\n');
  const y = b.split('\n');
  assert.equal(x.length, y.length);
  return x.map((l, i) => [l, y[i]]).filter(([l, m]) => l !== m);
};

test('chaque armure, bouclier, forme et poids de la base retrouve sa ligne dans le corps de sa page', () => {
  const armures = corps(PAGE_DES_ARMURES).split('\n');
  for (const a of lignes('SELECT * FROM armure')) {
    assert.equal(armures.filter((l) => l.endsWith(finDeLigneDArmure(a))).length, 1, a.id);
  }
  const boucliers = corps(PAGE_DES_BOUCLIERS).split('\n');
  for (const b of lignes('SELECT * FROM bouclier')) assert.equal(boucliers.filter((l) => l.endsWith(finDeLigneDeBouclier(b))).length, 1, b.id);
  for (const f of lignes('SELECT * FROM bouclier_classe')) assert.ok(boucliers.includes(ligneDeForme(f)), f.id);
  for (const p of lignes('SELECT * FROM bouclier_poids')) assert.ok(boucliers.includes(ligneDePoids(p)), p.id);
  for (const cible of ['armure', 'bouclier']) {
    const page = cible === 'armure' ? armures : boucliers;
    assert.ok(page.includes(ligneDuTotal(db.prepare('SELECT total_brut FROM amelioration_total WHERE cible = ?').get(cible).total_brut)), `TOTAL ${cible}`);
  }
});

test('une modification ne change que sa ligne ; une forme renommée change aussi le titre de son tableau', () => {
  const essais = [
    ['armure', lignes("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre LIMIT 1")[0], { stats_brut: '+99AP', prix_brut: '12' }, 1],
    ['armure', lignes("SELECT * FROM armure WHERE sorte = 'particuliere' ORDER BY ordre LIMIT 1")[0], { effet: 'Un effet' }, 1],
    ['bouclier', lignes('SELECT * FROM bouclier ORDER BY id LIMIT 1')[0], { defense_brut: '+1AP' }, 1],
    ['bouclier_poids', lignes('SELECT * FROM bouclier_poids ORDER BY ordre LIMIT 1')[0], { force_brut: '9 de Force minimum' }, 1],
    ['armure_emplacement', lignes('SELECT * FROM armure_emplacement ORDER BY ordre LIMIT 1 OFFSET 1')[0], { cout_brut: '200 RF / 2 RO' }, 1],
    ['amelioration_equipement', lignes("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 3")[0], { effet_brut: '+7 AP' }, 1],
    ['amelioration_total', lignes("SELECT * FROM amelioration_total WHERE cible = 'armure'")[0], { total_brut: '1 Ro + 1 Matériau' }, 1],
    ['bouclier_classe', lignes("SELECT * FROM bouclier_classe WHERE classe = 1")[0], { nom: 'Bocle X' }, 2],
  ];
  for (const [table, avant, changes, n] of essais) {
    const id = pageDeLaLigne(table, avant);
    const apres = corpsDesArmuresApres(corps(id), table, avant, { ...avant, ...changes });
    assert.equal(differences(corps(id), apres).length, n, `${table} ${avant.id ?? avant.cible}`);
    if (table === 'amelioration_equipement') assert.ok(apres.split('\n').includes(ligneDAmelioration({ ...avant, ...changes })));
  }
});

test('rien de visible ne change : la ligne d’une pièce ou d’une amélioration reste telle que l’importeur l’a écrite', () => {
  for (const [table, l] of [
    ['armure_emplacement', lignes('SELECT * FROM armure_emplacement ORDER BY ordre')],
    ['amelioration_equipement', lignes("SELECT * FROM amelioration_equipement WHERE cible IN ('armure', 'bouclier')")],
    ['armure', lignes('SELECT * FROM armure')],
    ['bouclier', lignes('SELECT * FROM bouclier')],
  ]) {
    for (const avant of l) {
      const id = pageDeLaLigne(table, avant);
      assert.equal(corpsDesArmuresApres(corps(id), table, avant, { ...avant }), corps(id), `${table} ${avant.id}`);
    }
  }
});

test('ligne introuvable, création ou suppression : ErreurCorpsArmures ; une amélioration d’une autre cible n’a pas de page ici', () => {
  const a = lignes('SELECT * FROM armure ORDER BY ordre LIMIT 1')[0];
  assert.throws(() => corpsDesArmuresApres(corps(PAGE_DES_ARMURES), 'armure', { ...a, nom: 'Inconnue' }, a), ErreurCorpsArmures);
  assert.throws(() => corpsDesArmuresApres(corps(PAGE_DES_ARMURES), 'armure', null, a), ErreurCorpsArmures);
  assert.throws(() => corpsDesArmuresApres('', 'armure', a, a), ErreurCorpsArmures);
  assert.equal(pageDeLaLigne('amelioration_equipement', { cible: 'arme' }), null);
  assert.equal(pageDeLaLigne('amelioration_equipement', { cible: 'bouclier' }), PAGE_DES_BOUCLIERS);
});

// Le corps ENTIER (« Tout recalculer » : serveur/edition-lots.mjs#ecartsDuRecalcul) : chaque tableau est repéré par sa section et chaque ligne par son rang ; les
// matières des lignes de l'importeur (« Ligne », « Colonne », la matière d'un bouclier) restent, le reste de la ligne vient des tables.
const etat = () => etatDuCorpsDesArmures(db);
const entier = (id, e = etat()) => corpsDesArmuresEntier(id, corps(id), e);
const dernierCase = (l) => l.split(/(?<!\\)\|/).slice(-2)[0].trim();

test('le corps entier redonne le corps de la base : aucune ligne n’est refaite autrement que ce que les tables disent déjà (hors le nom d’une pièce que la migration 0005 a mis au féminin dans le corps seul)', () => {
  assert.equal(entier(PAGE_DES_BOUCLIERS), corps(PAGE_DES_BOUCLIERS));
  // « Jambe Droite » : la migration 0005 a corrigé le corps, pas la table (armure_emplacement.nom) ; tout le reste est identique, la ligne de la pièce a le même coût
  const refait = entier(PAGE_DES_ARMURES);
  const diffs = differences(corps(PAGE_DES_ARMURES), refait);
  const pieces = lignes('SELECT * FROM armure_emplacement');
  for (const [avant, apres] of diffs) {
    assert.ok(pieces.some((p) => ligneDePiece(p) === apres), `une ligne de pièce : ${avant}`);
    assert.equal(dernierCase(avant), dernierCase(apres), 'même coût');
  }
});

test('corps entier : une armure, un bouclier, une forme, un poids, une pièce, une amélioration et un total changés dans leurs tables se retrouvent à leur rang, nom compris', () => {
  const e = etat();
  const parOrdre = (liste) => [...liste].sort((a, b) => a.ordre - b.ordre);
  const combinaison = parOrdre(e.armures).filter((a) => a.sorte === 'combinaison')[3];
  const particuliere = parOrdre(e.armures).find((a) => a.sorte === 'particuliere');
  const piece = parOrdre(e.emplacements)[1];
  const amelioration = e.ameliorations.find((a) => a.cible === 'armure');
  const changees = {
    armures: e.armures.map((a) => (a.id === combinaison.id ? { ...a, nom: 'Armure du test', stats_brut: '+99AP' } : a.id === particuliere.id ? { ...a, nom: 'Particulière du test', effet: 'Effet du test' } : a)),
    emplacements: e.emplacements.map((p) => (p.id === piece.id ? { ...p, nom: 'Pièce du test', cout_brut: '1 RF / 1 RO' } : p)),
    ameliorations: e.ameliorations.map((a) => (a.id === amelioration.id ? { ...a, cout_brut: '12 RO', effet_brut: 'Effet d’amélioration du test' } : a)),
    totaux: e.totaux.map((t) => (t.cible === 'armure' ? { ...t, total_brut: 'Total du test' } : t)),
  };
  const refait = entier(PAGE_DES_ARMURES, { ...e, ...changees });
  const l = refait.split('\n');
  const ligneDe = (a) => l.find((x) => x.endsWith(finDeLigneDArmure(a)));
  assert.ok(ligneDe(changees.armures.find((a) => a.id === combinaison.id)), 'l’armure de la grille, nom et statistiques refaits');
  assert.ok(ligneDe(changees.armures.find((a) => a.id === particuliere.id)), 'l’armure particulière');
  assert.ok(l.includes(ligneDePiece({ nom: 'Pièce du test', cout_brut: '1 RF / 1 RO' })));
  assert.ok(l.includes(ligneDAmelioration({ ...amelioration, cout_brut: '12 RO', effet_brut: 'Effet d’amélioration du test' })));
  assert.ok(l.includes(ligneDuTotal('Total du test')));
  assert.equal(l.length, corps(PAGE_DES_ARMURES).split('\n').length, 'aucune ligne de plus ni de moins');
  // les matières en tête de la ligne de l'importeur restent à leur place
  const avant = corps(PAGE_DES_ARMURES).split('\n').find((x) => x.endsWith(finDeLigneDArmure(combinaison)));
  assert.equal(ligneDe(changees.armures.find((a) => a.id === combinaison.id)).split('|').slice(0, 3).join('|'), avant.split('|').slice(0, 3).join('|'));
  // la page des boucliers : une forme renommée (titre de son tableau), un bouclier et un poids changés
  const forme = e.classes.find((f) => f.classe === 2);
  const bouclier = e.boucliers.find((b) => b.classe_id === forme.id);
  const poids = e.poids.find((p) => p.ordre === 1);
  const refaitB = entier(PAGE_DES_BOUCLIERS, {
    ...e,
    classes: e.classes.map((f) => (f.id === forme.id ? { ...f, nom: 'Forme du test', categorie_brut: 'Classe du test' } : f)),
    boucliers: e.boucliers.map((b) => (b.id === bouclier.id ? { ...b, nom: 'Bouclier du test', defense_brut: '+9AP' } : b)),
    poids: e.poids.map((p) => (p.id === poids.id ? { ...p, nom: 'Poids du test', force_brut: '9 de Force minimum' } : p)),
  });
  const lb = refaitB.split('\n');
  assert.ok(lb.includes('### Forme du test') && !lb.includes(`### ${forme.nom}`), 'le titre du tableau de la forme');
  assert.ok(lb.includes(ligneDeForme({ ...forme, nom: 'Forme du test', categorie_brut: 'Classe du test' })));
  assert.ok(lb.some((x) => x.endsWith(finDeLigneDeBouclier({ ...bouclier, nom: 'Bouclier du test', defense_brut: '+9AP' }))));
  assert.ok(lb.includes(ligneDePoids({ nom: 'Poids du test', force_brut: '9 de Force minimum' })));
});

test('corps entier : un corps dont des lignes ne sont plus écrites comme les tables les rendent est refait (le rendu ligne à ligne ne les retrouvait plus) ; la prose reste', () => {
  const e = etat();
  const a = e.armures.find((x) => x.sorte === 'combinaison');
  const perime = corps(PAGE_DES_ARMURES).replace(finDeLigneDArmure(a), '| ancien rendu |');
  assert.notEqual(perime, corps(PAGE_DES_ARMURES));
  assert.throws(() => corpsDesArmuresApres(perime, 'armure', a, a), ErreurCorpsArmures);
  const refait = corpsDesArmuresEntier(PAGE_DES_ARMURES, perime, e);
  assert.ok(refait.split('\n').some((l) => l.endsWith(finDeLigneDArmure(a))));
  const prose = (c) => c.split('\n').filter((l) => !l.startsWith('|'));
  assert.deepEqual(prose(refait), prose(corps(PAGE_DES_ARMURES)));
});

test('corps entier : une section ou un tableau introuvable, un nombre de lignes qui n’est plus celui de la base, une autre page : ErreurCorpsArmures', () => {
  const e = etat();
  const a = e.armures.find((x) => x.sorte === 'combinaison');
  const corpsA = corps(PAGE_DES_ARMURES);
  assert.throws(() => corpsDesArmuresEntier(PAGE_DES_ARMURES, corpsA.replace('## FABRICATION', '## AUTRE'), e), ErreurCorpsArmures);
  assert.throws(() => corpsDesArmuresEntier(PAGE_DES_ARMURES, corpsA.split('\n').filter((l) => !l.endsWith(finDeLigneDArmure(a))).join('\n'), e), ErreurCorpsArmures, 'une ligne de moins');
  assert.throws(() => corpsDesArmuresEntier(PAGE_DES_ARMURES, '', e), ErreurCorpsArmures);
  assert.throws(() => corpsDesArmuresEntier(PAGE_DES_BOUCLIERS, corps(PAGE_DES_BOUCLIERS).replace('## Classes de boucliers', '## Formes'), e), ErreurCorpsArmures);
  assert.throws(() => corpsDesArmuresEntier('ressources/armes', corpsA, e), ErreurCorpsArmures);
  // une amélioration écrite « 100.0 » par l'importeur et « 100 » par la base : rien de visible, la ligne reste telle que l'importeur l'a écrite
  const am = e.ameliorations.find((x) => x.cible === 'armure');
  const decimale = ligneDAmelioration({ ...am, cout_brut: '100.0' });
  const ecrite = corpsA.split('\n');
  const k = ecrite.findIndex((l, i) => l.startsWith(`| +${am.niveau} | `) && i > ecrite.indexOf('## AMÉLIORATION'));
  assert.ok(k > 0);
  ecrite[k] = decimale;
  const lues = e.ameliorations.map((x) => (x.id === am.id ? { ...x, cout_brut: '100' } : x));
  assert.ok(corpsDesArmuresEntier(PAGE_DES_ARMURES, ecrite.join('\n'), { ...e, ameliorations: lues }).split('\n').includes(decimale));
  const autre = e.ameliorations.map((x) => (x.id === am.id ? { ...x, cout_brut: '101' } : x));
  assert.ok(corpsDesArmuresEntier(PAGE_DES_ARMURES, ecrite.join('\n'), { ...e, ameliorations: autre }).split('\n').includes(ligneDAmelioration({ ...am, cout_brut: '101' })));
});
