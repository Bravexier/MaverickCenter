// Champs d'une classe et d'un don (lib/classe-champs.mjs) : les découpages que l'édition du site de dev applique quand un champ change doivent
// redonner, sur toutes les classes et tous les dons de la base (39 et 660 à l'import), exactement les lignes en place.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import {
  analyserTypeDeDon, bouclierMax, decouperInventaire, decouperMaitriseArme, decouperMaitriseArmure, MOT_CLE_DE_CATEGORIE,
} from '../src/lib/classe-champs.mjs';

const db = ouvrirBase({ sansExemples: false });
const classes = db.prepare('SELECT * FROM classe ORDER BY id').all();
const objets = db.prepare('SELECT id, nom_cle FROM objet_depart').all();
const sans = (l, ...colonnes) => l.map((x) => Object.fromEntries(Object.entries(x).filter(([c]) => !colonnes.includes(c))));

test('39 classes, 660 dons à l’import (le site peut en créer : les contrôles suivants portent sur toutes les lignes en place)', () => {
  const historique = historiqueSite(db);
  assert.equal(historique.effectifDImport('classe'), 39);
  assert.equal(historique.effectifDImport('capacite'), 660);
});

test('maîtrise des armes : classe_maitrise_arme ligne pour ligne', () => {
  const enPlace = db.prepare('SELECT * FROM classe_maitrise_arme WHERE classe_id = ? ORDER BY rang');
  for (const c of classes) assert.deepEqual(decouperMaitriseArme(c.maitrise_arme), sans(enPlace.all(c.id), 'classe_id', 'origine', 'source_ref'), c.id);
});

test('maîtrise des armures : classe_maitrise_armure ligne pour ligne, et bouclier_classe_max', () => {
  const enPlace = db.prepare('SELECT * FROM classe_maitrise_armure WHERE classe_id = ? ORDER BY rang');
  for (const c of classes) {
    const lignes = decouperMaitriseArmure(c.maitrise_armure);
    assert.deepEqual(lignes, sans(enPlace.all(c.id), 'classe_id', 'origine', 'source_ref'), c.id);
    assert.equal(bouclierMax(lignes), c.bouclier_classe_max, c.id);
  }
});

test('inventaire de départ : classe_objet_depart, objet du glossaire compris', () => {
  const enPlace = db.prepare('SELECT rang, option, texte, objet_depart_id FROM classe_objet_depart WHERE classe_id = ? ORDER BY rang, option');
  for (const c of classes) assert.deepEqual(decouperInventaire(c.inventaire_depart, objets), enPlace.all(c.id).map((l) => ({ ...l })), c.id);
});

test('type d’un don : type et limite de capacite pour les 660 dons', () => {
  for (const k of db.prepare('SELECT id, type_brut, type, limite_nombre, limite_periode FROM capacite').all()) {
    if (k.type_brut === null) continue;
    assert.deepEqual(analyserTypeDeDon(k.type_brut), { type: k.type, limite_nombre: k.limite_nombre, limite_periode: k.limite_periode }, `${k.id} : ${k.type_brut}`);
  }
});

test('mot-clé de page de chaque catégorie : celui des classes en place', () => {
  for (const c of classes) {
    const tag = db.prepare('SELECT m.libelle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id WHERE t.page_id = ? AND t.ordre = 1').get(c.id)?.libelle;
    assert.equal(MOT_CLE_DE_CATEGORIE[c.categorie_id], tag, c.id);
  }
});
