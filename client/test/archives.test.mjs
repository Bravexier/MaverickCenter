// Archives (/archives/, lib/archives.mjs) : les Google Docs et Sheets et l'ancien wiki qui ont servi de source au site (demande du propriétaire).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ancienWiki, DOCUMENTS_RETIRES, documentsDesArchives, lireArchives, urlGoogle } from '../src/lib/archives.mjs';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';

const registre = {
  copies: [
    { titre: 'Les races', genre: 'sheet', avant: 'ORIGINE-RACES', apres: 'COPIE-RACES' },
    { titre: 'MÉTIER', genre: 'doc', avant: 'ORIGINE-METIER', apres: 'COPIE-METIER' },
    { titre: 'Fiche auto V9', genre: 'sheet', avant: 'ORIGINE-FICHE', apres: 'COPIE-FICHE', dossier: 'Anciennes fiches auto' },
    { titre: 'Brouillon', genre: 'sheet', avant: 'ORIGINE-BROUILLON', apres: 'COPIE-BROUILLON' },
  ],
  fiche_corrigee: { titre: 'Fiche auto V10', genre: 'sheet', id: 'FICHE-CORRIGEE' },
  non_copies: [{ id: 'ORIGINAL-SEUL', raison: 'introuvable' }, { id: 'ORIGINE-CODEX', raison: 'introuvable' }],
};
const retires = new Set(['COPIE-BROUILLON']);
const manifeste = {
  google: [
    { id: 'COPIE-RACES', kind: 'sheet', title: 'Les races', url: 'https://docs.google.com/spreadsheets/d/COPIE-RACES/edit?gid=7#gid=7', original: 'https://docs.google.com/spreadsheets/d/ORIGINE-RACES/edit?gid=7#gid=7' },
    { id: 'ORIGINAL-SEUL', kind: 'doc', title: 'Bestiaire', url: 'https://docs.google.com/document/d/ORIGINAL-SEUL/edit', note: '…' },
    // copié après la migration : le manifeste donne la copie et l'original
    { id: 'COPIE-CODEX', kind: 'doc', title: 'Codex', url: 'https://docs.google.com/document/d/COPIE-CODEX/edit', original: 'https://docs.google.com/document/d/ORIGINE-CODEX/edit?tab=t.0' },
  ],
  fandom: [{ url: 'https://exemple.fandom.com/fr/wiki/Accueil', title: 'Accueil (ancien wiki)', note: 'note pour les développeurs' }],
};
const citations = [
  { page_id: 'races/elfe', google_id: 'COPIE-RACES', genre: 'sheet', fichier: null, onglets: null },
  { page_id: 'races/elfe', google_id: null, genre: 'sheet', fichier: 'Les races', onglets: ['Elfe'] },
  { page_id: 'races/nain', google_id: null, genre: 'sheet', fichier: 'Les races', onglets: ['Nain', 'Elfe'] },
  { page_id: 'metiers/forgeron', google_id: 'ORIGINE-METIER', genre: 'doc', fichier: null, onglets: null },
  { page_id: 'guide/x', google_id: null, genre: 'doc', fichier: 'Les races', onglets: null }, // même titre, autre genre : pas ce document
  { page_id: 'ressources/x', google_id: 'COPIE-BROUILLON', genre: 'sheet', fichier: null, onglets: null },
  { page_id: 'lore/brock', google_id: 'COPIE-CODEX', genre: 'doc', fichier: null, onglets: null },
  { page_id: 'lore/brock', google_id: null, genre: 'doc', fichier: 'Codex', onglets: null },
];

test('documents : rubriques, adresses (copie et origine), pages qui les citent et onglets repris ; un document retiré n’est pas montré', () => {
  const rubriques = documentsDesArchives({ registre, manifeste, citations, retires });
  assert.deepEqual(rubriques.map((r) => r.rubrique.id), ['jeu', 'fiches']);
  const [jeu, fiches] = rubriques.map((r) => r.documents);
  assert.deepEqual(jeu.map((d) => d.titre), ['Les races', 'Codex', 'MÉTIER', 'Bestiaire'], 'les plus cités d’abord, puis par titre ; pas le document retiré');
  const races = jeu[0];
  assert.equal(races.url, manifeste.google[0].url, 'adresse du manifeste, avec l’onglet');
  assert.equal(races.original, manifeste.google[0].original);
  assert.equal(races.pages, 2, 'une page qui cite l’adresse et le libellé ne compte qu’une fois ; un autre genre ne compte pas');
  assert.deepEqual(races.onglets, ['Elfe', 'Nain']);
  const metier = jeu[2];
  assert.equal(metier.url, urlGoogle('doc', 'COPIE-METIER'), 'hors manifeste : adresse tirée de l’identifiant');
  assert.equal(metier.original, urlGoogle('doc', 'ORIGINE-METIER'));
  assert.equal(metier.pages, 1, 'cité par l’identifiant d’origine');
  assert.deepEqual(fiches.map((d) => [d.titre, d.pages, Boolean(d.note)]), [['Fiche auto V10', 0, true], ['Fiche auto V9', 0, true]]);
  assert.equal(fiches[0].original, null, 'la fiche corrigée n’a pas d’original');
  const bestiaire = jeu[3];
  assert.deepEqual([bestiaire.genre, bestiaire.url, bestiaire.original, bestiaire.pages], ['doc', manifeste.google[1].url, null, 0], 'non copié : le titre et l’adresse d’origine du manifeste');
  assert.ok(bestiaire.note);
  const codex = jeu[1];
  assert.deepEqual([codex.id, codex.url, codex.original, codex.pages, codex.note], ['COPIE-CODEX', manifeste.google[2].url, manifeste.google[2].original, 1, null],
    'copié après la migration : la copie du manifeste, l’original en second lien, cité par l’identifiant de la copie ou par son titre');
  assert.ok(documentsDesArchives({ registre, manifeste, citations }).flatMap((r) => r.documents).some((d) => d.titre === 'Brouillon'), 'retirés par défaut : DOCUMENTS_RETIRES');
});

test('ancien wiki : adresse et titre du manifeste, sans ses notes de développeur', () => {
  assert.deepEqual(ancienWiki(manifeste), [{ url: 'https://exemple.fandom.com/fr/wiki/Accueil', titre: 'Accueil (ancien wiki)' }]);
  assert.deepEqual(ancienWiki({ google: [] }), []);
});

test('le vrai registre, le vrai manifeste et la base : chaque document une fois avec son titre, les classeurs du jeu cités par le site', () => {
  const { rubriques, ancienWiki: wiki } = lireArchives(ouvrirBase({ sansExemples: false }), trouverRacine());
  const documents = rubriques.flatMap((r) => r.documents);
  assert.equal(documents.length, 15 - 2 + 1 + 2, '15 copies sans « Familiers » ni « Prototype », la fiche corrigée, les 2 documents laissés par la migration 0014');
  assert.equal(new Set(documents.map((d) => d.id)).size, documents.length);
  for (const d of documents) assert.ok(d.titre, `${d.id} : sans titre`);
  assert.deepEqual(documents.filter((d) => ['Familiers', 'Prototype'].includes(d.titre)), [], 'demande du propriétaire');
  assert.equal(DOCUMENTS_RETIRES.size, 2);
  const bestiaire = documents.find((x) => x.titre === 'Bestiaire 2.0');
  assert.equal(bestiaire?.rubrique, 'jeu');
  assert.equal(bestiaire.original, null, 'Bestiaire 2.0 : l’adresse est celle de l’original');
  // CODEX Maverick : copié par le propriétaire le 2026-10-11, après la migration 0014 (sources/sources.json) ; ses pages du Codex le citent
  const codex = documents.find((x) => x.titre === 'CODEX Maverick');
  assert.equal(codex?.rubrique, 'jeu');
  assert.equal(codex.id, '1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg');
  assert.match(codex.original, /\/d\/1CwDqDKurMOdqig3ozX4NQETbBW9sggsxEqM1WfbOG5M\//, 'l’original en second lien');
  assert.ok(codex.pages > 100, `CODEX Maverick : ${codex.pages} pages`);
  for (const d of documents) assert.match(d.url, new RegExp(`^https://docs\\.google\\.com/(document|spreadsheets)/d/${d.id}/`), d.titre ?? d.id);
  const pages = Object.fromEntries(documents.map((d) => [d.titre, d.pages]));
  for (const titre of ['Classe Maverick V7', 'Les races', 'Magie Maverick V8', 'Invocation', 'Ressources et Craft', 'Mode hyper et co',
    'Règle du jeu/Guide pour MJ - Maverick', 'Créer sa fiche de personnage', 'MÉTIER', 'Alchimie', 'Fiche personnage Maverick Auto V15.2.2']) {
    assert.ok(pages[titre] > 0, `${titre} : cité par aucune page`);
  }
  assert.ok(documents.find((d) => d.titre === 'Les races').onglets.length > 20, 'les onglets des races');
  assert.deepEqual(wiki.map((w) => w.url), ['https://maverick-jdr.fandom.com/fr/wiki/Wiki_Maverick', 'https://maverick-jdr.fandom.com/fr/wiki/Progression']);
});
