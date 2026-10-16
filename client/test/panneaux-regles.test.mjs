// Panneaux de règles (migration 0055 ; lib/panneaux-regles-db.mjs, lib/panneaux-regles-rendu.mjs) : un panneau par page du wiki que sert
// /ressources/equipement/ (son id = l'ancre de l'onglet ou du sous-onglet de cette page, sa page : lib/equipement.mjs#PAGES_SERVIES_PAR_L_EQUIPEMENT ;
// l'onglet Ceinture, qui ne sert pas de page, n'en a pas), ses blocs dans l'ordre de lecture (ordre, puis rang), la place d'un bloc inséré et les ordres après un déplacement
// (le service et le mode modification s'en servent), le HTML d'un bloc (texte, tuile, titre échappé, champ du mode modification), et la copie de
// l'import : chaque bloc de texte se lit mot pour mot dans le corps de sa page tel que l'import l'a laissé, sauf les tuiles qui ne sont qu'une balise du
// glossaire. L'état courant (le site de dev modifie les panneaux) se contrôle par des invariants ; l'import par lib/historique-site.mjs.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { lireAttributEd } from '../src/lib/edition-modele.mjs';
import { ONGLETS_DE_L_EQUIPEMENT, PAGES_SERVIES_PAR_L_EQUIPEMENT } from '../src/lib/equipement.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { chargerPanneau, chargerPanneaux, ordonnerBlocs, ordresApresDeplacement, ordresApresInsertion } from '../src/lib/panneaux-regles-db.mjs';
import { ancreDuPanneau, empreinteDuTexte, htmlDesBlocs, htmlDuBloc } from '../src/lib/panneaux-regles-rendu.mjs';

const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);

test('un panneau par page servie de /ressources/equipement/ : (id, page_id) de panneau_regles = (ancre, page) de PAGES_SERVIES_PAR_L_EQUIPEMENT', () => {
  const lignes = db.prepare('SELECT id, page_id FROM panneau_regles ORDER BY id').all().map((l) => [l.id, l.page_id]);
  assert.deepEqual(lignes, PAGES_SERVIES_PAR_L_EQUIPEMENT.map((o) => [o.ancre, o.page]).sort(([a], [b]) => a.localeCompare(b)));
  // le sous-onglet des bâtons de l'onglet Ceinture a le sien ; l'onglet Ceinture, qui ne sert pas de page du wiki, n'en a pas (ses règles : le guide)
  assert.ok(lignes.some(([id]) => id === 'batons-magiques'));
  assert.ok(ONGLETS_DE_L_EQUIPEMENT.some((o) => o.id === 'ceinture' && o.page === null) && !lignes.some(([id]) => id === 'ceinture'));
  assert.deepEqual(chargerPanneaux(db).map((p) => p.id), lignes.map(([id]) => id));
  for (const [, page] of lignes) assert.ok(db.prepare('SELECT 1 FROM page WHERE id = ?').get(page), `${page} : la page du panneau existe`);
});

test('chargerPanneau : le titre, la page et les blocs dans l’ordre de lecture (ordre, puis rang) ; null pour un panneau inconnu ou une base sans la table', () => {
  for (const { ancre: id, page } of PAGES_SERVIES_PAR_L_EQUIPEMENT) {
    const p = chargerPanneau(db, id);
    assert.ok(p.titre.length > 0, id);
    assert.equal(p.page_id, page);
    assert.ok(p.blocs.length >= 1, `${id} : au moins un bloc`);
    const attendus = db.prepare('SELECT rang FROM panneau_regles_bloc WHERE panneau_id = ? ORDER BY ordre, rang').all(id).map((b) => b.rang);
    assert.deepEqual(p.blocs.map((b) => b.rang), attendus);
    for (const b of p.blocs) {
      assert.ok(b.tuile === 0 || b.tuile === 1);
      if (b.tuile === 0) assert.equal(b.titre, null, `${id} ${b.rang} : un bloc de texte n’a pas de titre`);
    }
  }
  assert.equal(chargerPanneau(db, 'aucun-panneau'), null);
  const vide = new DatabaseSync(':memory:');
  assert.equal(chargerPanneau(vide, 'armes'), null, 'une base d’avant la migration 0055');
  assert.deepEqual(chargerPanneaux(vide), []);
  vide.close();
  assert.deepEqual(ordonnerBlocs([{ rang: 3, ordre: 2 }, { rang: 1, ordre: 2 }, { rang: 2, ordre: 1 }]).map((b) => b.rang), [2, 1, 3], 'à ordre égal, le rang');
});

test('l’import (migration 0055) : les huit blocs des armes dans l’ordre, en tuiles Recharge longue, Recharge très longue, Mordhau, Dague, Arme de jet et le prix', () => {
  const blocs = ordonnerBlocs(historique.lignesDImport('panneau_regles_bloc').filter((b) => b.panneau_id === 'armes'));
  assert.deepEqual(blocs.map((b) => [b.tuile, b.titre]), [
    [0, null], [1, null], [1, null], [1, null], [0, null], [1, 'Dague'], [1, 'Arme de jet'], [1, 'Comment déterminer le prix de votre arme ?'],
  ]);
  assert.deepEqual(blocs.slice(1, 4).map((b) => b.texte), ['{{recharge-longue:}}', '{{recharge-tres-longue:}}', '{{mordhau:}}'], 'les définitions vivent dans le glossaire');
  assert.match(blocs[4].texte, /^\*\*Les armes en bleu sont les armes possibles en arme de départ\.\*\*/);
});

test('l’import : chaque bloc se lit mot pour mot dans le corps de sa page tel que l’import l’a laissé (sauf une tuile qui n’est qu’une balise du glossaire)', () => {
  const panneaux = historique.lignesDImport('panneau_regles');
  const blocs = historique.lignesDImport('panneau_regles_bloc');
  assert.ok(blocs.length >= panneaux.length);
  for (const b of blocs) {
    if (/^\{\{[a-z0-9-]+:\}\}$/.test(b.texte)) continue;
    const page = panneaux.find((p) => p.id === b.panneau_id).page_id;
    assert.ok(historique.valeurDImport('page', { id: page }, 'corps_md').includes(b.texte), `${b.panneau_id} ${b.rang} : copié de ${page}`);
  }
});

test('ordresApresInsertion : après un bloc, les suivants repoussés seulement s’il le faut ; à la fin ; un bloc inconnu', () => {
  const blocs = [1, 2, 3, 4].map((n) => ({ rang: n, ordre: n }));
  assert.deepEqual(ordresApresInsertion(blocs, 2), { ordre: 3, decalages: [{ rang: 3, ordre: 4 }, { rang: 4, ordre: 5 }] });
  assert.deepEqual(ordresApresInsertion(blocs, 4), { ordre: 5, decalages: [] });
  assert.deepEqual(ordresApresInsertion(blocs, null), { ordre: 5, decalages: [] });
  assert.deepEqual(ordresApresInsertion([], null), { ordre: 1, decalages: [] });
  assert.equal(ordresApresInsertion(blocs, 9), null);
  // un trou absorbe le décalage ; deux blocs au même ordre sont séparés (le nouveau entre eux)
  assert.deepEqual(ordresApresInsertion([{ rang: 1, ordre: 1 }, { rang: 2, ordre: 5 }], 1), { ordre: 2, decalages: [] });
  assert.deepEqual(ordresApresInsertion([{ rang: 1, ordre: 3 }, { rang: 2, ordre: 3 }, { rang: 3, ordre: 4 }], 1),
    { ordre: 4, decalages: [{ rang: 2, ordre: 5 }, { rang: 3, ordre: 6 }] });
});

test('ordresApresDeplacement : deux voisins échangés échangent leurs ordres ; rien si la séquence est celle de la base ; des ordres égaux séparés', () => {
  const blocs = [1, 2, 3, 4].map((n) => ({ rang: n, ordre: n * 10 }));
  assert.deepEqual([...ordresApresDeplacement(blocs, [1, 3, 2, 4])], [[3, 20], [2, 30]]);
  assert.equal(ordresApresDeplacement(blocs, [1, 2, 3, 4]).size, 0);
  assert.deepEqual([...ordresApresDeplacement(blocs, [4, 1, 2, 3])], [[4, 10], [1, 20], [2, 30], [3, 40]]);
  assert.deepEqual([...ordresApresDeplacement([{ rang: 1, ordre: 2 }, { rang: 2, ordre: 2 }], [2, 1])], [[1, 3]], 'le second après le premier');
  // des ordres égaux, la séquence de la base (ordre, puis rang) : séparés quand même, le second et ceux qui le suivent repoussés s'il le faut
  const egaux = [{ rang: 1, ordre: 2 }, { rang: 2, ordre: 2 }, { rang: 3, ordre: 3 }, { rang: 4, ordre: 9 }];
  assert.deepEqual(ordonnerBlocs(egaux).map((b) => b.rang), [1, 2, 3, 4]);
  assert.deepEqual([...ordresApresDeplacement(egaux, [1, 2, 3, 4])], [[2, 3], [3, 4]], 'rien ne change seulement si les ordres sont distincts');
  // un rang inconnu dans la séquence n'y prend pas de place
  assert.equal(ordresApresDeplacement(blocs, [99, 1, 2, 3, 4]).size, 0);
  assert.deepEqual([...ordresApresDeplacement(blocs, [1, 99, 3, 2, 4])], [[3, 20], [2, 30]]);
});

test('htmlDuBloc : un bloc de texte, une tuile et son titre (champ du mode modification, échappé ; caché s’il est vide) ; rang, ordre et empreinte', () => {
  const texte = htmlDuBloc({ panneau_id: 'armes', rang: 1, ordre: 1, tuile: 0, titre: null, texte: 'Un **texte**.' }, '<p>Un <strong>texte</strong>.</p>');
  assert.equal(texte, `<div class="preg-bloc preg-bloc--texte" data-preg-bloc="1" data-preg-ordre="1" data-preg-empreinte="${empreinteDuTexte('Un **texte**.')}"><div class="preg-bloc__texte"><p>Un <strong>texte</strong>.</p></div></div>`);
  const tuile = htmlDuBloc({ panneau_id: 'armes', rang: 6, ordre: 7, tuile: 1, titre: 'Dague <b>', texte: 'x' }, '<p>x</p>');
  assert.match(tuile, /^<div class="preg-bloc preg-bloc--tuile" data-preg-bloc="6" data-preg-ordre="7" /);
  assert.match(tuile, /<p class="preg-bloc__titre" data-ed-cadre><span data-ed="[^"]+">Dague &lt;b&gt;<\/span><\/p><div class="preg-bloc__texte"><p>x<\/p><\/div><\/div>$/);
  const ed = /data-ed="([^"]+)"/.exec(tuile)[1].replace(/&quot;/g, '"');
  assert.deepEqual(lireAttributEd(ed)?.cle, { panneau_id: 'armes', rang: 6 });
  assert.equal(lireAttributEd(ed)?.colonne, 'titre');
  assert.match(htmlDuBloc({ panneau_id: 'armes', rang: 2, ordre: 2, tuile: 1, titre: null, texte: 'y' }, ''), /<p class="preg-bloc__titre" data-ed-cadre hidden><span data-ed="[^"]+"><\/span><\/p>/);
  assert.notEqual(empreinteDuTexte('a'), empreinteDuTexte('b'));
  assert.equal(htmlDesBlocs([{ panneau_id: 'p', rang: 1, ordre: 1, tuile: 0, titre: null, texte: 'a', html: '<p>a</p>' }]), htmlDuBloc({ panneau_id: 'p', rang: 1, ordre: 1, tuile: 0, titre: null, texte: 'a' }, '<p>a</p>'));
  assert.equal(ancreDuPanneau('armes'), 'regles-armes');
});
