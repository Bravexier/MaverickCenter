// Corps de la page « Armes » (lib/corps-armes.mjs) : chaque arme, matériau et amélioration de la base retrouve sa ligne Markdown dans la section de son
// tableau, la liste des armes de départ se refait à l'identique, et remplacer une ligne par elle-même redonne le corps à l'octet près (invariants
// rejoués sur toute la base : ils tiennent après une modification depuis le site, que le service et le rejeu du journal suivent avec ces fonctions).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import {
  corpsAvecArmesDeDepart, corpsDesArmesApres, enteteDeFamille, ErreurCorpsArmes, libelleDeFamille, ligneDArme, ligneDeRemarque, ligneDuTotal, PAGE_DES_ARMES,
  titreDeSectionDeFamille,
} from '../src/lib/corps-armes.mjs';

const db = ouvrirBase({ sansExemples: false });
const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_ARMES).corps_md;
const familles = db.prepare('SELECT id, nom, libelle_brut FROM arme_famille ORDER BY ordre').all();
const armes = db.prepare('SELECT * FROM arme ORDER BY famille_id, ordre').all();
const nomDuMateriau = (id) => db.prepare('SELECT nom FROM ressource WHERE id = ?').get(id).nom;
const contexte = { familles, armes: () => armes, nomDuMateriau };

test('chaque ligne des tables de la page se retrouve dans le corps : la remplacer par elle-même ne change rien', () => {
  for (const a of armes) assert.equal(corpsDesArmesApres(corps, 'arme', a, a, contexte), corps, a.id);
  for (const m of db.prepare('SELECT * FROM materiau_arme').all()) assert.equal(corpsDesArmesApres(corps, 'materiau_arme', m, m, contexte), corps, m.ressource_id);
  for (const a of db.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'arme'").all()) assert.equal(corpsDesArmesApres(corps, 'amelioration_equipement', a, a, contexte), corps, a.id);
  const total = db.prepare("SELECT * FROM amelioration_total WHERE cible = 'arme'").get();
  assert.ok(corps.includes(ligneDuTotal(total.total_brut)));
  assert.equal(corpsDesArmesApres(corps, 'amelioration_total', total, total, contexte), corps);
});

test('la liste des armes de départ (nom sur fond bleu dans la source) se refait à l’identique depuis arme.depart_possible', () => {
  assert.equal(corpsAvecArmesDeDepart(corps, familles, armes), corps);
});

test('une arme modifiée : sa ligne change dans la section de SA famille seulement ; devenue arme de départ, elle entre dans la liste', () => {
  const crochets = armes.filter((a) => a.nom === 'Crochet grappin');
  if (crochets.length === 2 && ligneDArme(crochets[0]) === ligneDArme(crochets[1])) {
    const apres = { ...crochets[0], description: 'Texte neuf.' };
    const nouveau = corpsDesArmesApres(corps, 'arme', crochets[0], apres, contexte);
    assert.equal(nouveau.split('\n').filter((l) => l === ligneDArme(apres)).length, 1, 'une seule des deux lignes identiques change');
  }
  const a = armes.find((x) => x.depart_possible === 0 && x.famille_id !== 'arme-de-monstres');
  const apres = { ...a, depart_possible: 1 };
  const nouveau = corpsDesArmesApres(corps, 'arme', a, apres, { ...contexte, armes: () => armes.map((x) => (x.id === a.id ? apres : x)) });
  const puce = nouveau.split('\n').find((l) => l.startsWith('- Sous « ') && l.includes(a.nom));
  assert.ok(puce, `${a.nom} dans la liste des armes de départ`);
});

test('une ligne qui n’est plus dans le corps : ErreurCorpsArmes (le service refuse le lot plutôt que de laisser le corps en retard)', () => {
  const a = { ...armes[0], effet: 'Effet que le corps ne connaît pas' };
  assert.throws(() => corpsDesArmesApres(corps, 'arme', a, armes[0], contexte), ErreurCorpsArmes);
});

// La remarque d'une arme (demande du propriétaire, décision R91 : « pouvoir modifier la présence ou non de la remarque et en modifier le contenu ») :
// une entrée sous le tableau de sa famille, qui suit la remarque ; celles de l'importeur (fil ou note de la cellule) partent avec elle.
const BOMBE = 'ressources/armes#arme:bombes:bombe-percante';
const FIL_QA6 = "Il faut perdre un bras pour avoir cette arme, ce qui fait que vous perdez une main. Ce n'est pas considéré comme un Canon d'artifice.";
const historique = historiqueSite(db);
const famillesDeLaPage = new Set(db.prepare('SELECT id FROM arme_famille WHERE maitrisable = 1').all().map((f) => f.id));
/** Le nom d'une arme dans l'intitulé d'un commentaire de l'importeur : la première ligne de sa cellule Nom. */
const intitule = (a) => String(a.nom_brut ?? a.nom).split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).find(Boolean);
const bornesDe = (a) => (lignes) => {
  const debut = lignes.indexOf(titreDeSectionDeFamille(familles.find((f) => f.id === a.famille_id)));
  const fin = lignes.findIndex((l, i) => i > debut && /^## /.test(l));
  return [debut, fin < 0 ? lignes.length : fin];
};
/**
 * Une arme témoin de la page, sans remarque, et le corps qui va avec : la Bombe perçante, sinon (supprimée sur le site de dev, R52) la première arme
 * d'une famille de la page qui a une voisine ; le site de dev a pu lui donner une remarque, retirée ici.
 */
function temoin() {
  const a = armes.find((x) => x.id === BOMBE)
    ?? armes.find((x) => famillesDeLaPage.has(x.famille_id) && armes.some((y) => y.famille_id === x.famille_id && intitule(y) !== intitule(x)));
  const sans = { ...a, remarque: null };
  return { a: sans, corpsSans: corpsDesArmesApres(corps, 'arme', a, sans, contexte) };
}

test('décision R91 : la remarque de la Bombe perçante (fil de sa cellule QA6) retirée par une modification du site de dev ; l’import la garde', () => {
  assert.equal(historique.valeurDImport('arme', { id: BOMBE }, 'remarque'), FIL_QA6, 'la remarque de l’import');
  assert.ok(historique.modifiee('arme', { id: BOMBE }, 'remarque'), 'modifiée par le site (historique_modification)');
  // l'état courant : le corps ne cite plus le fil de l'import (une remarque remise sur le site y serait une entrée « Remarque de l’arme »)
  assert.ok(!/Commentaire résolu de la cellule « Effet \(Bombe perçante\) »/.test(corps));
});

test('état courant : chaque remarque d’arme a une entrée dans le corps, et chaque entrée « Remarque de l’arme » est la remarque d’une arme', () => {
  const entrees = corps.split('\n').filter((l) => l.startsWith('**Remarque de l’arme « '));
  const parLeSite = armes.filter((a) => a.remarque !== null && historique.modifiee('arme', { id: a.id }, 'remarque'));
  assert.deepEqual([...entrees].sort(), parLeSite.map(ligneDeRemarque).sort(), 'une entrée par remarque saisie sur le site, aucune de plus');
  // une remarque de l'import que le site n'a pas touchée : l'entrée de l'importeur, qui nomme la cellule Nom de l'arme
  for (const a of armes.filter((x) => x.remarque !== null && !historique.modifiee('arme', { id: x.id }, 'remarque'))) {
    assert.ok(corps.includes(` (${intitule(a)}) »**`), `${a.id} : l’entrée de l’importeur`);
  }
});

test('remarque d’une arme : ajoutée (une entrée sous le tableau de sa famille), modifiée, retirée ; inchangée, le corps ne bouge pas', () => {
  const { a, corpsSans } = temoin();
  const avec = { ...a, remarque: 'Une remarque *neuve*\nsur deux lignes.' };
  const ajoute = corpsDesArmesApres(corpsSans, 'arme', a, avec, contexte);
  const entree = ligneDeRemarque(avec);
  assert.ok(entree.endsWith('** : Une remarque \\*neuve\\* sur deux lignes.'), 'sur une ligne, échappée');
  if (a.id === BOMBE) assert.equal(entree, '**Remarque de l’arme « Bombe perçante »** : Une remarque \\*neuve\\* sur deux lignes.');
  const lignes = ajoute.split('\n');
  const i = lignes.indexOf(entree);
  const [debut, fin] = bornesDe(a)(lignes);
  assert.ok(i > debut && i < fin, 'dans la section de sa famille');
  assert.ok(lignes[i - 2].startsWith('| ') && lignes[i - 1] === '' && lignes[i + 1] === '', 'juste sous le tableau, entre deux lignes vides');
  assert.equal(corpsDesArmesApres(ajoute, 'arme', avec, avec, contexte), ajoute, 'inchangée : rien ne bouge');
  const autre = { ...a, remarque: 'Autre texte.' };
  const modifie = corpsDesArmesApres(ajoute, 'arme', avec, autre, contexte);
  assert.ok(!modifie.includes(entree) && modifie.includes(ligneDeRemarque(autre)), 'une seule entrée, la nouvelle');
  assert.equal(corpsDesArmesApres(modifie, 'arme', autre, a, contexte), corpsSans, 'vidée : le corps redevient celui d’avant');
  // renommée avec sa remarque : l'entrée suit le nom ; supprimée : l'entrée part avec sa ligne
  const renommee = { ...autre, nom: `${a.nom} à clous`, nom_brut: `${a.nom} à clous` };
  const apresRenommage = corpsDesArmesApres(modifie, 'arme', autre, renommee, contexte);
  assert.ok(apresRenommage.includes(ligneDeRemarque(renommee)) && !apresRenommage.includes(ligneDeRemarque(autre)));
  const supprimee = corpsDesArmesApres(apresRenommage, 'arme', renommee, null, contexte);
  assert.ok(!supprimee.includes('Autre texte.') && !supprimee.includes(ligneDArme(renommee)));
});

test('remarque d’une arme : l’entrée de l’importeur (fil ou note de sa cellule, sur une ou plusieurs lignes) part quand la remarque change, et elle seule', () => {
  const { a, corpsSans } = temoin();
  assert.ok(corpsSans.split('\n').includes(ligneDArme(a)), 'la ligne de l’arme témoin');
  const tableau = corpsSans.split('\n');
  const [, fin] = bornesDe(a)(tableau);
  let derniere = fin - 1;
  while (!tableau[derniere].startsWith('|')) derniere -= 1;
  const sousLeTableau = (...ajout) => [...tableau.slice(0, derniere + 1), '', ...ajout, ...tableau.slice(derniere + 1)].join('\n');
  // un fil sur une ligne (comme celui de QA6 sous la Bombe perçante avant la décision R91) : vider la remarque le retire, et lui seul
  const avecFil = sousLeTableau(`**Commentaire résolu de la cellule « Effet (${intitule(a)}) »** : ${FIL_QA6}`);
  assert.equal(corpsDesArmesApres(avecFil, 'arme', { ...a, remarque: FIL_QA6 }, a, contexte), corpsSans, 'le fil retiré, rien d’autre');
  // une note sur plusieurs paragraphes (libellé seul, puis le texte) ; un paragraphe libre qui la suit reste
  const note = [`**Note de la cellule « Nom (${intitule(a)}) »**`, '', 'Premier paragraphe.', '', 'Second paragraphe.'];
  const neuve = { ...a, remarque: 'Neuve.' };
  const remplace = corpsDesArmesApres(sousLeTableau(...note), 'arme', { ...a, remarque: 'Premier paragraphe.\n\nSecond paragraphe.' }, neuve, contexte);
  assert.ok(!remplace.includes('paragraphe') && remplace.includes(ligneDeRemarque(neuve)));
  const avecTexteLibre = sousLeTableau(...note, '', 'Texte libre de la section.');
  const garde = corpsDesArmesApres(avecTexteLibre, 'arme', { ...a, remarque: 'Premier paragraphe.\n\nSecond paragraphe.' }, neuve, contexte);
  assert.ok(garde.includes('Texte libre de la section.') && !garde.includes('Second paragraphe.'), 'la note seule part');
  // celle d'une autre arme reste
  const voisine = armes.find((x) => x.famille_id === a.famille_id && intitule(x) !== intitule(a));
  const avecVoisine = sousLeTableau(`**Note de la cellule « Effet (${intitule(voisine)}) »** : Note voisine.`);
  assert.ok(corpsDesArmesApres(avecVoisine, 'arme', a, neuve, contexte).includes('Note voisine.'));
});

// Familles d'armes renommées, au dé changé ou créées sur le site de dev (décision R159) : la section de chaque famille porte son bandeau tel qu'écrit
// (échappé comme l'importeur), son tableau commence par l'en-tête de sa colonne de coût ; les sections des familles sont les dernières du corps (une
// famille créée prend le dernier rang et sa section s'ajoute à la fin).
test('R159 : chaque famille a sa section, titrée par son bandeau échappé, son tableau ouvert par l’en-tête de son coût ; les familles ferment le corps', () => {
  const lignes = corps.split('\n');
  for (const f of familles) {
    const complete = db.prepare('SELECT * FROM arme_famille WHERE id = ?').get(f.id);
    const titre = titreDeSectionDeFamille(f);
    assert.equal(lignes.filter((l) => l === titre).length, 1, `${f.id} : une section « ${titre} »`);
    const i = lignes.indexOf(titre);
    assert.equal(lignes.find((l, k) => k > i && l.startsWith('|')), enteteDeFamille(complete), `${f.id} : l’en-tête de son tableau`);
  }
  const titres = lignes.filter((l) => /^## /.test(l));
  const deFamille = new Set(familles.map(titreDeSectionDeFamille));
  assert.ok(deFamille.has(titres.at(-1)), 'la dernière section du corps est celle d’une famille');
  assert.deepEqual(titres.slice(-familles.length), [...titres.slice(-familles.length)].filter((t) => deFamille.has(t)), 'les sections des familles se suivent à la fin');
});

test('R159 : le bandeau d’une famille refait depuis son nom et son dé, la note d’après le dé gardée ; rien de deviné sinon', () => {
  for (const f of db.prepare('SELECT * FROM arme_famille WHERE de_brut IS NOT NULL').all()) {
    assert.equal(libelleDeFamille(f, f), f.libelle_brut, `${f.id} : inchangé, il se refait à l’identique`);
  }
  const pugilat = { nom: 'PUGILAT', de_brut: 'D6/D8/D10', libelle_brut: 'PUGILAT - D6/D8/D10 (D6 1-2 Force, D8 3-4 Force, D10 5 Force)' };
  assert.equal(libelleDeFamille(pugilat, { nom: 'POINGS', de_brut: 'D8' }), 'POINGS - D8 (D6 1-2 Force, D8 3-4 Force, D10 5 Force)');
  assert.equal(libelleDeFamille(null, { nom: 'FOUETS', de_brut: 'D6' }), 'FOUETS - D6', 'une famille créée');
  assert.equal(libelleDeFamille({ nom: 'ARME DE MONSTRES', de_brut: null, libelle_brut: 'ARME DE MONSTRES - Se référer à la catégorie d’arme' }, { nom: 'X', de_brut: 'D6' }), null);
  assert.equal(libelleDeFamille({ nom: 'ARC', de_brut: 'D8', libelle_brut: 'ARCS - D8' }, { nom: 'X', de_brut: 'D6' }), null, 'un bandeau qui ne commence pas par « nom - dé »');
  assert.equal(libelleDeFamille({ nom: 'ARC', de_brut: 'D1', libelle_brut: 'ARC - D10' }, { nom: 'X', de_brut: 'D6' }), null, '« D1 » n’est pas le dé de « D10 »');
});

test('R159 : une famille renommée, au dé ou au coût changé : son titre, la liste des armes de départ, l’en-tête de son tableau ; ses armes suivent sous le nouveau titre', () => {
  const avant = db.prepare("SELECT * FROM arme_famille WHERE id = 'epees'").get();
  assert.equal(corpsDesArmesApres(corps, 'arme_famille', avant, avant, contexte), corps, 'inchangée : rien ne bouge');
  const apres = { ...avant, nom: 'LAMES', de_brut: 'D12', libelle_brut: 'LAMES - D12', cout_libelle: 'Coût en plus/moins' };
  const familles2 = familles.map((f) => (f.id === avant.id ? apres : f));
  const nouveau = corpsDesArmesApres(corps, 'arme_famille', avant, apres, { ...contexte, familles: familles2 });
  const lignes = nouveau.split('\n');
  assert.ok(lignes.includes('## LAMES - D12') && !lignes.includes('## ÉPÉES - D10'));
  const i = lignes.indexOf('## LAMES - D12');
  assert.equal(lignes.find((l, k) => k > i && l.startsWith('|')), '| Nom | Coût en plus/moins | Catégorie | Effet | Description |');
  const depart = armes.filter((a) => a.famille_id === 'epees' && a.depart_possible === 1);
  if (depart.length) assert.ok(lignes.some((l) => l.startsWith('- Sous « LAMES - D12 » : ')), 'la liste des armes de départ cite le nouveau bandeau');
  assert.ok(!lignes.some((l) => l.startsWith('- Sous « ÉPÉES')));
  const epee = armes.find((a) => a.famille_id === 'epees');
  assert.equal(corpsDesArmesApres(nouveau, 'arme', epee, epee, { ...contexte, familles: familles2 }), nouveau, 'ses armes se retrouvent sous le nouveau titre');
  assert.equal(nouveau.split('\n').length, corps.split('\n').length, 'aucune ligne ajoutée ni retirée');
});

test('R159 : une famille créée a sa section à la fin du corps, une arme s’y ajoute ; un titre strict (« ARC » ne prend pas « ARC LONG ») ; pas de suppression', () => {
  const famille = { id: 'arc-long', nom: 'ARC LONG', de_brut: 'D10', libelle_brut: 'ARC LONG - D10', cout_libelle: 'Coût en plus/moins', ordre: 99 };
  const familles2 = [...familles, famille];
  const ctx2 = { ...contexte, familles: familles2 };
  const cree = corpsDesArmesApres(corps, 'arme_famille', null, famille, ctx2);
  assert.ok(cree.endsWith('\n\n## ARC LONG - D10\n\n| Nom | Coût en plus/moins | Catégorie | Effet | Description |\n| --- | --- | --- | --- | --- |\n'), JSON.stringify(cree.slice(-200)));
  assert.equal(cree.slice(0, corps.replace(/\n*$/, '').length), corps.replace(/\n*$/, ''), 'le reste du corps ne change pas');
  assert.throws(() => corpsDesArmesApres(cree, 'arme_famille', null, famille, ctx2), ErreurCorpsArmes, 'une section déjà là');
  const arme = { ...armes.find((a) => a.famille_id === 'arc'), id: 'x', famille_id: 'arc-long', nom: 'Arc long d’essai', nom_brut: 'Arc long d’essai', depart_possible: 0, remarque: null };
  const avecArme = corpsDesArmesApres(cree, 'arme', null, arme, ctx2);
  assert.ok(avecArme.endsWith(`| --- | --- | --- | --- | --- |\n${ligneDArme(arme)}\n`), 'l’arme à la fin du tableau de la famille créée');
  // une arme de la famille ARC se trouve toujours dans SA section, pas dans celle d'ARC LONG
  const arc = armes.find((a) => a.famille_id === 'arc');
  assert.equal(corpsDesArmesApres(avecArme, 'arme', arc, arc, ctx2), avecArme);
  assert.throws(() => corpsDesArmesApres(cree, 'arme_famille', famille, null, ctx2), ErreurCorpsArmes, 'une famille ne se supprime pas');
});
