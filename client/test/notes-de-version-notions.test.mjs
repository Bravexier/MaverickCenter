// La note de version et les pages de notion (chantier 3 des mots-clés, conception §3) : une notion est un mot-clé sans élément qui reçoit une page des Règles
// hors menu. La mise en place de plus de cent notions ne fait ni autant de lignes « Page du guide ajoutée » (rangées, faute de place, sous « Pages retirées »)
// ni autant de lignes « Lien » de mot-clé : une ligne condensée dit le nombre de pages ajoutées à des mots-clés qui existaient. Une notion née avec son
// mot-clé n'a que la ligne de sa page, rangée sous le Glossaire. Bases synthétiques (noms inventés), comme test/notes-de-version-ancrage.test.mjs.
//   node --test test/notes-de-version-notions.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GLOSSAIRE, installerLePlan } from '../src/lib/livres.mjs';
import { comparerBases, PAGES_RETIREES_DU_GUIDE } from '../src/lib/notes-de-version.mjs';

installerLePlan([{ id: 'onglet-essai', titre: 'Onglet d’essai', ouverture: 'guide/accueil-essai', entrees: [{ page: 'guide/accueil-essai' }, { page: 'guide/regle-essai' }] }]);

const motCle = (id, libelle, cle, plus = {}) => ({ id, libelle, cle, description: null, url: null, couleur: null, verrou: 0, monnaie_id: null, icone: null, ...plus });
const page = (id, titre, mot = null, plus = {}) => ({ id, type: 'guide', statut: 'canon', titre, corps_md: '<!-- guide:notion -->', donnees: null, mot_cle_id: mot, ...plus });
const duDomaine = (lignes, domaine) => lignes.filter((l) => l.domaine === domaine);
/** La ligne condensée : une ligne `ajoute` du domaine mots-clés qui n'est ni un champ ni une cellule (champ null), avec son nombre en tête. */
const condensee = (lignes) => duDomaine(lignes, 'mots-cles').filter((l) => l.nature === 'ajoute' && l.champ === null && /^\d/.test(l.entite));
const nombreDit = (l) => Number(l.entite.match(/^\d[\d ]*/)[0].replaceAll(' ', ''));

/** Trois mots-clés sans élément dans la production ; dans dev, chacun a sa page de notion et l'adresse de sa page (colonne `url`). */
function troisNotions() {
  const ref = { tables: {
    mot_cle: [motCle(20, 'Zephyrion', 'zephyrion'), motCle(21, 'Quorvane', 'quorvane'), motCle(22, 'Brumelle', 'brumelle')],
    page: [page('guide/accueil-essai', 'Accueil d’essai'), page('guide/regle-essai', 'Règle d’essai')],
  } };
  const dev = structuredClone(ref);
  for (const [id, titre, slug] of [[20, 'Zephyrion', 'zephyrion'], [21, 'Quorvane', 'quorvane'], [22, 'Brumelle', 'brumelle']]) {
    dev.tables.page.push(page(`guide/notion-${slug}`, titre, id));
    dev.tables.mot_cle.find((m) => m.id === id).url = `regles/glossaire/${slug}/`;
  }
  return { ref, dev };
}

test('pages de notion : trois pages posées sur trois mots-clés existants donnent une seule ligne qui dit 3, ni une ligne par page ni une ligne « Lien » par mot-clé', () => {
  const { ref, dev } = troisNotions();
  const lignes = comparerBases(ref, dev);
  assert.equal(condensee(lignes).length, 1, 'une seule ligne');
  assert.equal(nombreDit(condensee(lignes)[0]), 3);
  assert.equal(condensee(lignes)[0].sens, 'neutre');
  assert.equal(duDomaine(lignes, 'mots-cles').length, 1, 'rien d’autre dans les mots-clés : aucune ligne « Lien »');
  assert.ok(!lignes.some((l) => l.table_nom === 'mot_cle' && l.colonne === 'url'));
  assert.equal(duDomaine(lignes, 'guide').length, 0, 'aucune ligne « page ajoutée » par notion');
  // le nombre suit les données ; au singulier, le texte n'est plus au pluriel
  dev.tables.page.push(page('guide/notion-vorace', 'Vorace', 23));
  ref.tables.mot_cle.push(motCle(23, 'Vorace', 'vorace'));
  dev.tables.mot_cle.push(motCle(23, 'Vorace', 'vorace', { url: 'regles/glossaire/vorace/' }));
  assert.equal(nombreDit(condensee(comparerBases(ref, dev))[0]), 4);
  const seule = troisNotions();
  seule.dev.tables.page = seule.dev.tables.page.filter((p) => p.mot_cle_id !== 21 && p.mot_cle_id !== 22);
  seule.dev.tables.mot_cle = seule.dev.tables.mot_cle.map((m) => (m.id === 20 ? m : { ...m, url: null }));
  const une = condensee(comparerBases(seule.ref, seule.dev));
  assert.equal(nombreDit(une[0]), 1);
  assert.ok(!/pages/.test(une[0].entite), 'le singulier est accordé');
});

test('pages de notion : une notion nouvelle (mot-clé et page nouveaux) donne la ligne de sa page sous le Glossaire, aucune ligne de mot-clé, aucune ligne condensée', () => {
  const { ref } = troisNotions();
  const dev = structuredClone(ref);
  dev.tables.mot_cle.push(motCle(30, 'Nebuline', 'nebuline', { url: 'regles/glossaire/nebuline/' }));
  dev.tables.page.push(page('guide/notion-nebuline', 'Nebuline', 30));
  const lignes = comparerBases(ref, dev);
  const guide = duDomaine(lignes, 'guide');
  assert.equal(guide.length, 1);
  assert.equal(guide[0].nature, 'ajoute');
  assert.equal(guide[0].groupe, GLOSSAIRE.titre, 'rangée sous le Glossaire');
  assert.notEqual(guide[0].groupe, PAGES_RETIREES_DU_GUIDE);
  assert.equal(duDomaine(lignes, 'mots-cles').length, 0, 'ni ligne de mot-clé ni ligne condensée');
});

test('pages de notion : une page supprimée en dev (une page d’onglet que le plan de dev ne range plus, ou une page de notion retirée) reste sous « Pages retirées »', () => {
  const { ref, dev } = troisNotions();
  ref.tables.page.push(page('guide/ancienne-essai', 'Ancienne page'), page('guide/notion-retiree', 'Retirée', 20));
  const retirees = duDomaine(comparerBases(ref, dev), 'guide').filter((l) => l.nature === 'retire');
  assert.equal(retirees.length, 2);
  assert.ok(retirees.every((l) => l.groupe === PAGES_RETIREES_DU_GUIDE));
  assert.ok(retirees.every((l) => l.groupe !== GLOSSAIRE.titre));
});

test('pages de notion : une page de notion renommée ensuite donne la ligne de son renommage, sous le Glossaire', () => {
  const { ref } = troisNotions();
  ref.tables.mot_cle.push(motCle(40, 'Tenebrelle', 'tenebrelle', { url: 'regles/glossaire/tenebrelle/' }));
  ref.tables.page.push(page('guide/notion-tenebrelle', 'Tenebrelle', 40));
  const dev = structuredClone(ref);
  dev.tables.page.find((p) => p.id === 'guide/notion-tenebrelle').titre = 'Tenebrelle ancienne';
  dev.tables.mot_cle.find((m) => m.id === 40).libelle = 'Tenebrelle ancienne';
  const lignes = comparerBases(ref, dev);
  const guide = duDomaine(lignes, 'guide');
  assert.equal(guide.length, 1);
  assert.equal(guide[0].nature, 'modifie');
  assert.equal(guide[0].avant, 'Tenebrelle');
  assert.equal(guide[0].apres, 'Tenebrelle ancienne');
  assert.equal(guide[0].groupe, GLOSSAIRE.titre);
  assert.equal(duDomaine(lignes, 'mots-cles').length, 0, 'le mot-clé suit le titre de sa page : la ligne de la page suffit');
});

test('pages de notion : la définition d’un mot-clé de notion corrigée par un lot garde sa ligne (R309 (17)), même quand sa page est ajoutée dans la même mise à jour', () => {
  const { ref, dev } = troisNotions();
  dev.tables.mot_cle.find((m) => m.id === 20).description = 'Définition corrigée d’essai.';
  const lignes = duDomaine(comparerBases(ref, dev), 'mots-cles');
  const definitions = lignes.filter((l) => l.table_nom === 'mot_cle' && l.colonne === 'description');
  assert.equal(definitions.length, 1);
  assert.equal(definitions[0].nature, 'ajoute');
  assert.equal(definitions[0].entite, 'Zephyrion');
  assert.equal(nombreDit(condensee(lignes)[0]), 3, 'et la ligne condensée compte toujours les trois pages');
});
