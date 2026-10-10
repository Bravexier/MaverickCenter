// Archives (/archives/, lib/archives.mjs) : les Google Docs et Sheets et l'ancien wiki qui ont servi de source au site (demande du propriétaire).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ancienWiki, documentsDesArchives, lireArchives, urlGoogle } from '../src/lib/archives.mjs';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';

const registre = {
  copies: [
    { titre: 'Les races', genre: 'sheet', avant: 'ORIGINE-RACES', apres: 'COPIE-RACES' },
    { titre: 'MÉTIER', genre: 'doc', avant: 'ORIGINE-METIER', apres: 'COPIE-METIER' },
    { titre: 'Fiche auto V9', genre: 'sheet', avant: 'ORIGINE-FICHE', apres: 'COPIE-FICHE', dossier: 'Anciennes fiches auto' },
  ],
  fiche_corrigee: { titre: 'Fiche auto V10', genre: 'sheet', id: 'FICHE-CORRIGEE' },
  non_copies: [{ id: 'PERDU', raison: 'introuvable' }],
};
const manifeste = {
  google: [
    { id: 'COPIE-RACES', kind: 'sheet', title: 'Les races', url: 'https://docs.google.com/spreadsheets/d/COPIE-RACES/edit?gid=7#gid=7', original: 'https://docs.google.com/spreadsheets/d/ORIGINE-RACES/edit?gid=7#gid=7' },
    { id: 'PERDU', kind: 'doc', title: null, url: 'https://docs.google.com/document/d/PERDU/edit', note: '…' },
  ],
  fandom: [{ url: 'https://exemple.fandom.com/fr/wiki/Accueil', title: 'Accueil (ancien wiki)', note: 'note pour les développeurs' }],
};
const citations = [
  { page_id: 'races/elfe', google_id: 'COPIE-RACES', genre: 'sheet', fichier: null, onglets: null },
  { page_id: 'races/elfe', google_id: null, genre: 'sheet', fichier: 'Les races', onglets: ['Elfe'] },
  { page_id: 'races/nain', google_id: null, genre: 'sheet', fichier: 'Les races', onglets: ['Nain', 'Elfe'] },
  { page_id: 'metiers/forgeron', google_id: 'ORIGINE-METIER', genre: 'doc', fichier: null, onglets: null },
  { page_id: 'guide/x', google_id: null, genre: 'doc', fichier: 'Les races', onglets: null }, // même titre, autre genre : pas ce document
];

test('documents : rubriques, adresses (copie et origine), pages qui les citent et onglets repris', () => {
  const rubriques = documentsDesArchives({ registre, manifeste, citations });
  assert.deepEqual(rubriques.map((r) => r.rubrique.id), ['jeu', 'fiches', 'introuvables']);
  const [jeu, fiches, introuvables] = rubriques.map((r) => r.documents);
  assert.deepEqual(jeu.map((d) => d.titre), ['Les races', 'MÉTIER'], 'les plus cités d’abord');
  const races = jeu[0];
  assert.equal(races.url, manifeste.google[0].url, 'adresse du manifeste, avec l’onglet');
  assert.equal(races.original, manifeste.google[0].original);
  assert.equal(races.pages, 2, 'une page qui cite l’adresse et le libellé ne compte qu’une fois ; un autre genre ne compte pas');
  assert.deepEqual(races.onglets, ['Elfe', 'Nain']);
  const metier = jeu[1];
  assert.equal(metier.url, urlGoogle('doc', 'COPIE-METIER'), 'hors manifeste : adresse tirée de l’identifiant');
  assert.equal(metier.original, urlGoogle('doc', 'ORIGINE-METIER'));
  assert.equal(metier.pages, 1, 'cité par l’identifiant d’origine');
  assert.deepEqual(fiches.map((d) => [d.titre, d.pages, Boolean(d.note)]), [['Fiche auto V10', 0, true], ['Fiche auto V9', 0, true]]);
  assert.equal(fiches[0].original, null, 'la fiche corrigée n’a pas d’original');
  assert.deepEqual(introuvables.map((d) => [d.titre, d.genre, d.url]), [[null, 'doc', manifeste.google[1].url]]);
});

test('ancien wiki : adresse et titre du manifeste, sans ses notes de développeur', () => {
  assert.deepEqual(ancienWiki(manifeste), [{ url: 'https://exemple.fandom.com/fr/wiki/Accueil', titre: 'Accueil (ancien wiki)' }]);
  assert.deepEqual(ancienWiki({ google: [] }), []);
});

test('le vrai registre, le vrai manifeste et la base : chaque document une fois, les classeurs du jeu cités par le site', () => {
  const { rubriques, ancienWiki: wiki } = lireArchives(ouvrirBase({ sansExemples: false }), trouverRacine());
  const documents = rubriques.flatMap((r) => r.documents);
  assert.equal(documents.length, 15 + 1 + 2, '15 copies, la fiche corrigée, 2 documents introuvables');
  assert.equal(new Set(documents.map((d) => d.id)).size, documents.length);
  for (const d of documents) assert.match(d.url, new RegExp(`^https://docs\\.google\\.com/(document|spreadsheets)/d/${d.id}/`), d.titre ?? d.id);
  const pages = Object.fromEntries(documents.map((d) => [d.titre, d.pages]));
  for (const titre of ['Classe Maverick V7', 'Les races', 'Magie Maverick V8', 'Invocation', 'Ressources et Craft', 'Mode hyper et co',
    'Règle du jeu/Guide pour MJ - Maverick', 'Créer sa fiche de personnage', 'MÉTIER', 'Alchimie', 'Fiche personnage Maverick Auto V15.2.2']) {
    assert.ok(pages[titre] > 0, `${titre} : cité par aucune page`);
  }
  assert.ok(documents.find((d) => d.titre === 'Les races').onglets.length > 20, 'les onglets des races');
  assert.deepEqual(wiki.map((w) => w.url), ['https://maverick-jdr.fandom.com/fr/wiki/Wiki_Maverick', 'https://maverick-jdr.fandom.com/fr/wiki/Progression']);
});
