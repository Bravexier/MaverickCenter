// Corps de la page « Armes » (lib/corps-armes.mjs) : chaque arme, matériau et amélioration de la base retrouve sa ligne Markdown dans la section de son
// tableau, la liste des armes de départ se refait à l'identique, et remplacer une ligne par elle-même redonne le corps à l'octet près (invariants
// rejoués sur toute la base : ils tiennent après une modification depuis le site, que le service et le rejeu du journal suivent avec ces fonctions).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { corpsAvecArmesDeDepart, corpsDesArmesApres, ErreurCorpsArmes, ligneDArme, ligneDeRemarque, ligneDuTotal, PAGE_DES_ARMES } from '../src/lib/corps-armes.mjs';

const db = ouvrirBase({ sansExemples: false });
const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_ARMES).corps_md;
const familles = db.prepare('SELECT id, nom FROM arme_famille ORDER BY ordre').all();
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
// une entrée sous le tableau de sa famille, qui suit la remarque ; celles de l'importeur (fil de commentaires de la cellule) partent avec elle.
const bombe = armes.find((a) => a.id === 'ressources/armes#arme:bombes:bombe-percante');
const FIL_QA6 = "Il faut perdre un bras pour avoir cette arme, ce qui fait que vous perdez une main. Ce n'est pas considéré comme un Canon d'artifice.";
const bornesDe = (a) => (lignes) => {
  const nom = familles.find((f) => f.id === a.famille_id).nom;
  const debut = lignes.findIndex((l) => l === `## ${nom}` || l.startsWith(`## ${nom} `));
  const fin = lignes.findIndex((l, i) => i > debut && /^## /.test(l));
  return [debut, fin < 0 ? lignes.length : fin];
};

test('décision R91 : la remarque de la Bombe perçante (fil de sa cellule QA6) retirée par une modification du site de dev ; l’import la garde', () => {
  assert.ok(bombe, 'la Bombe perçante');
  const historique = historiqueSite(db);
  assert.equal(historique.valeurDImport('arme', { id: bombe.id }, 'remarque'), FIL_QA6, 'la remarque de l’import');
  assert.ok(historique.modifiee('arme', { id: bombe.id }, 'remarque'), 'modifiée par le site (historique_modification)');
  // l'état courant : le corps ne cite plus le fil de l'import (une remarque remise sur le site y serait une entrée « Remarque de l’arme »)
  assert.ok(!/Commentaire résolu de la cellule « Effet \(Bombe perçante\) »/.test(corps));
  if (bombe.remarque === null) assert.ok(!corps.includes('Il faut perdre un bras'), 'sans remarque, le corps ne cite pas le fil');
});

// les essais qui suivent partent de la Bombe perçante sans remarque (le site de dev a pu lui en remettre une) et du corps qui va avec
const sansRemarque = { ...bombe, remarque: null };
const corpsSans = corpsDesArmesApres(corps, 'arme', bombe, sansRemarque, contexte);

test('remarque d’une arme : ajoutée (une entrée sous le tableau de sa famille), modifiée, retirée ; inchangée, le corps ne bouge pas', () => {
  const a = sansRemarque;
  const avec = { ...a, remarque: 'Une remarque *neuve*\nsur deux lignes.' };
  const ajoute = corpsDesArmesApres(corpsSans, 'arme', a, avec, contexte);
  const entree = ligneDeRemarque(avec);
  assert.equal(entree, '**Remarque de l’arme « Bombe perçante »** : Une remarque \\*neuve\\* sur deux lignes.');
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
  const renommee = { ...autre, nom: 'Bombe à clous', nom_brut: 'Bombe à clous' };
  const apresRenommage = corpsDesArmesApres(modifie, 'arme', autre, renommee, contexte);
  assert.ok(apresRenommage.includes(ligneDeRemarque(renommee)) && !apresRenommage.includes(ligneDeRemarque(autre)));
  const supprimee = corpsDesArmesApres(apresRenommage, 'arme', renommee, null, contexte);
  assert.ok(!supprimee.includes('Autre texte.') && !supprimee.includes(ligneDArme(renommee)));
});

test('remarque d’une arme : l’entrée de l’importeur (fil ou note de sa cellule, sur une ou plusieurs lignes) part quand la remarque change', () => {
  const a = sansRemarque;
  assert.ok(corpsSans.split('\n').includes(ligneDArme(a)), 'la ligne de la Bombe perçante');
  // le fil de l'import, sur une ligne, sous le tableau des bombes (le corps d'avant la décision R91) : vider la remarque le retire, et lui seul
  const tableau = corpsSans.split('\n');
  const [, fin] = bornesDe(a)(tableau);
  let derniere = fin - 1;
  while (!tableau[derniere].startsWith('|')) derniere -= 1;
  const avecFil = [...tableau.slice(0, derniere + 1), '', `**Commentaire résolu de la cellule « Effet (Bombe perçante) »** : ${FIL_QA6}`, ...tableau.slice(derniere + 1)].join('\n');
  assert.equal(corpsDesArmesApres(avecFil, 'arme', { ...a, remarque: FIL_QA6 }, a, contexte), corpsSans, 'le fil retiré, rien d’autre');
  // une note sur plusieurs paragraphes (libellé seul, puis le texte) d'une arme de la famille
  const note = ['**Note de la cellule « Nom (Bombe perçante) »**', '', 'Premier paragraphe.', '', 'Second paragraphe.'];
  const avecNote = [...tableau.slice(0, derniere + 1), '', ...note, ...tableau.slice(derniere + 1)].join('\n');
  const remplace = corpsDesArmesApres(avecNote, 'arme', { ...a, remarque: 'Premier paragraphe.\n\nSecond paragraphe.' }, { ...a, remarque: 'Neuve.' }, contexte);
  assert.ok(!remplace.includes('paragraphe') && remplace.includes(ligneDeRemarque({ ...a, remarque: 'Neuve.' })));
  // celle d'une autre arme reste
  const voisine = armes.find((x) => x.famille_id === a.famille_id && x.id !== a.id);
  const avecVoisine = [...tableau.slice(0, derniere + 1), '', `**Note de la cellule « Effet (${voisine.nom}) »** : Note voisine.`, ...tableau.slice(derniere + 1)].join('\n');
  assert.ok(corpsDesArmesApres(avecVoisine, 'arme', a, { ...a, remarque: 'Neuve.' }, contexte).includes('Note voisine.'));
});
