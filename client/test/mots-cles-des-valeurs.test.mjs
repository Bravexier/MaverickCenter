// Les valeurs fermées liées aux mots-clés du glossaire (migration 0125 ; lib/mots-cles-des-valeurs.mjs#liensDesValeursFermees) : un type de dégâts
// (taille, estoc, frappe : leur mot-clé ; feu, eau, glace : celui de leur magie) et une magie (son nom court, l'infobulle de son mot-clé) sont rendus par
// une seule fonction à toutes les pages ; sans mot-clé, null (un type que le site n'a pas lié). Les lignes se lisent par leur lien en base, jamais par un nom ni par un
// id supposé (le site de dev renomme les mots-clés) ; la fonction suit la base courante, sans cache.
//   node --test test/mots-cles-des-valeurs.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { chargerArmes } from '../src/lib/armes-db.mjs';
import { chargerArmures } from '../src/lib/armures-db.mjs';
import { chargerInvocations, chargerMonstres } from '../src/lib/bestiaire-db.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { lienDeLaMagie, lienDuTypeDeDegats, liensDesValeursFermees } from '../src/lib/mots-cles-des-valeurs.mjs';
import { htmlDeLaCible, htmlDeLaDefenseDeCreature } from '../src/lib/valeurs-fermees-rendu.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const liens = liensDesValeursFermees(db);
const motCle = (id) => db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id);

/** Ce qu'une balise a besoin de savoir du mot-clé : lu par son id, jamais figé. */
function verifierLeLien(lien, id, quoi) {
  const m = motCle(id);
  assert.ok(m, `${quoi} : le mot-clé existe`);
  assert.deepEqual({ id: lien.id, cle: lien.cle, libelle: lien.libelle, description: lien.description, couleur: lien.couleur, url: lien.url, icone: lien.icone },
    { id: m.id, cle: m.cle, libelle: m.libelle, description: m.description ?? '', couleur: m.couleur ?? null, url: m.url ?? null, icone: m.icone ?? null }, quoi);
}

test('une magie : son mot-clé (id, clé, libellé, définition, couleur) et son nom court en texte ; null sans mot-clé', () => {
  const magies = db.prepare('SELECT id, nom, mot_cle_id FROM magie ORDER BY id').all();
  assert.deepEqual(Object.keys(liens.magies).sort(), magies.map((m) => m.id), 'chaque magie a sa clé');
  assert.ok(magies.some((m) => m.mot_cle_id !== null), 'des magies liées');
  for (const g of magies) {
    const lien = lienDeLaMagie(liens, g.id);
    if (g.mot_cle_id === null) {
      assert.equal(lien, null, `${g.id} : sans mot-clé, sans lien`);
      continue;
    }
    verifierLeLien(lien, g.mot_cle_id, g.id);
    assert.equal(lien.texte, g.nom, `${g.id} : s'affiche par son nom court`);
    assert.equal(lien.magie_id, g.id);
  }
});

/** Chaque type de dégâts de `base` rendu comme sa ligne le dit (sa magie, son mot-clé ou rien), selon `liensDeLaBase` ; rend les types lus. */
function verifierLesTypes(base, liensDeLaBase) {
  const types = base.prepare('SELECT id, mot_cle_id, magie_id FROM type_degats ORDER BY id').all();
  assert.deepEqual(Object.keys(liensDeLaBase.degats).sort(), types.map((t) => t.id), 'chaque type de dégâts a sa clé');
  for (const t of types) {
    const lien = lienDuTypeDeDegats(liensDeLaBase, t.id);
    if (t.magie_id !== null) {
      assert.deepEqual(lien, lienDeLaMagie(liensDeLaBase, t.magie_id), `${t.id} : le lien de sa magie`);
      assert.ok(lien === null || lien.texte === base.prepare('SELECT nom FROM magie WHERE id = ?').get(t.magie_id).nom, `${t.id} : le nom court de la magie`);
    } else if (t.mot_cle_id !== null) {
      const m = base.prepare('SELECT * FROM mot_cle WHERE id = ?').get(t.mot_cle_id);
      assert.ok(m, `${t.id} : le mot-clé existe`);
      assert.equal(lien.id, m.id, `${t.id} : le mot-clé de sa ligne`);
      assert.equal(lien.cle, m.cle);
      assert.equal(lien.libelle, m.libelle);
      assert.equal(lien.texte, null, `${t.id} : la page garde son libellé`);
    } else {
      assert.equal(lien, null, `${t.id} : sans mot-clé, sans lien`);
    }
  }
  return types;
}

test('un type de dégâts : taille, estoc, frappe par leur mot-clé (texte null : la page garde son libellé) ; feu, eau, glace par celui de leur magie (son nom court) ; sans lien : null', (t) => {
  // l'état courant : chaque type est rendu comme sa ligne le dit, quels que soient ceux que le site a liés ou non à un mot-clé
  const types = verifierLesTypes(db, liens);
  for (const x of types.filter((y) => y.mot_cle_id !== null)) verifierLeLien(lienDuTypeDeDegats(liens, x.id), x.mot_cle_id, x.id);
  assert.equal(lienDuTypeDeDegats(liens, 'inconnu'), null);
  assert.equal(lienDeLaMagie(null, 'magies/x'), null);

  // les trois cas sur une copie, quel que soit le contenu du jour (le site lie ou délie les types à son gré) : un type sans magie lié à un mot-clé
  // (texte null), les autres sans mot-clé (null) ; les types d'une magie gardent le lien de leur magie
  const copie = join(dossierTemporaire('mots-cles-des-valeurs', { t }), 'base.db');
  copyFileSync(cheminBase({ sansExemples: false }), copie);
  const b = new DatabaseSync(copie);
  try {
    const sansMagie = b.prepare('SELECT id FROM type_degats WHERE magie_id IS NULL ORDER BY id').all().map((r) => r.id);
    assert.ok(sansMagie.length >= 2, 'des types de dégâts qui ne sont pas ceux d\'une magie (le schéma n\'en nomme que 14 liés)');
    const motCle = b.prepare('SELECT id FROM mot_cle ORDER BY id LIMIT 1').get();
    assert.ok(motCle, 'un mot-clé pour le lien');
    b.exec('UPDATE type_degats SET mot_cle_id = NULL WHERE magie_id IS NULL');
    b.prepare('UPDATE type_degats SET mot_cle_id = ? WHERE id = ?').run(motCle.id, sansMagie[0]);
    assert.ok(b.prepare('SELECT 1 FROM type_degats WHERE magie_id IS NOT NULL').get(), 'des types d\'une magie : la branche « lien de sa magie » est couverte');
    const l = liensDesValeursFermees(b);
    verifierLesTypes(b, l);
    assert.equal(l.degats[sansMagie[0]].id, motCle.id, 'lié à un mot-clé : son lien, sans texte');
    assert.equal(l.degats[sansMagie[0]].texte, null);
    for (const id of sansMagie.slice(1)) assert.equal(l.degats[id], null, `${id} : sans mot-clé, sans magie : null`);
  } finally {
    b.close();
  }
});

test('chaque module de lecture rend les liens de la base (une seule résolution) : armes, armures, bestiaire (monstres, invocations), magies, fiche', () => {
  const attendu = JSON.stringify(liens);
  assert.equal(JSON.stringify(chargerArmes(db).liens), attendu, 'armes');
  assert.equal(JSON.stringify(chargerArmures(db).liens), attendu, 'armures');
  assert.equal(JSON.stringify(chargerMonstres(db).liens), attendu, 'monstres');
  assert.equal(JSON.stringify(chargerInvocations(db).liens), attendu, 'invocations');
  assert.equal(JSON.stringify(chargerMagies(db).liens), attendu, 'magies');
  // la fiche lit ses règles sans balises (texte brut des définitions) : les mots-clés et les textes d'affichage sont les mêmes
  const fiche = chargerReglesDeFiche(db).liens;
  const identite = (l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v && { id: v.id, cle: v.cle, texte: v.texte, magie_id: v.magie_id }]));
  assert.deepEqual({ degats: identite(fiche.degats), magies: identite(fiche.magies) }, { degats: identite(liens.degats), magies: identite(liens.magies) }, 'fiche');
});

test('chaque valeur fermée des colonnes de type de dégâts de la base a un type_degats (donc un lien, ou null)', () => {
  for (const [table, colonne] of [['arme_degats', 'type_degats'], ['arme_elementaire_type_degats', 'type_degats'], ['armure_degats', 'type_degats'],
    ['personnage_arme', 'type_degats_choisi'], ['magie_resistance', 'cible_physique'], ['invocation_resistance', 'cible_degat'],
    ['creature_capacite_resistance', 'cible_degat'], ['creature_attaque_type', 'type']]) {
    const valeurs = db.prepare(`SELECT DISTINCT "${colonne}" AS v FROM "${table}" WHERE "${colonne}" IS NOT NULL`).all().map((r) => r.v);
    for (const v of valeurs) assert.ok(Object.hasOwn(liens.degats, v), `${table}.${colonne} = ${v} : un type de dégâts de la table de référence`);
  }
});

test('la résolution suit la base courante : mot-clé renommé ou recoloré, magie sans mot-clé ; une base d’avant la migration 0125 : aucun lien', () => {
  const b = new DatabaseSync(':memory:');
  b.exec(`CREATE TABLE mot_cle (id INTEGER PRIMARY KEY, cle TEXT, libelle TEXT, description TEXT, couleur TEXT, url TEXT, icone TEXT);
    CREATE TABLE magie (id TEXT PRIMARY KEY, nom TEXT, ordre INTEGER);`);
  assert.deepEqual(liensDesValeursFermees(b), { degats: {}, magies: {} }, 'sans la colonne ni la table');
  b.exec(`ALTER TABLE magie ADD COLUMN mot_cle_id INTEGER;
    CREATE TABLE type_degats (id TEXT PRIMARY KEY, mot_cle_id INTEGER, magie_id TEXT);
    INSERT INTO mot_cle VALUES (7, 'magie-du-feu', 'Magie du Feu', 'Définition.', 'rouge', '/magies/feu/', NULL), (8, 'taille', 'Taille', NULL, NULL, NULL, NULL);
    INSERT INTO magie VALUES ('m/feu', 'Feu', 1, 7), ('m/vide', 'Vide', 2, NULL);
    INSERT INTO type_degats VALUES ('taille', 8, NULL), ('feu', NULL, 'm/feu'), ('physique', NULL, NULL), ('eau', NULL, 'm/vide');`);
  let l = liensDesValeursFermees(b);
  assert.equal(l.magies['m/feu'].libelle, 'Magie du Feu');
  assert.equal(l.magies['m/feu'].texte, 'Feu');
  assert.equal(l.magies['m/feu'].description, 'Définition.');
  assert.equal(l.magies['m/vide'], null);
  assert.equal(l.degats.feu.cle, 'magie-du-feu', 'feu : la magie du même nom');
  assert.equal(l.degats.eau, null, 'une magie sans mot-clé : pas de lien');
  assert.equal(l.degats.physique, null);
  assert.equal(l.degats.taille.libelle, 'Taille');
  assert.equal(l.degats.taille.description, '', 'une définition absente se lit vide');
  assert.equal(l.degats.taille.classe, null, 'sans couleur, sans classe');
  b.exec("UPDATE mot_cle SET libelle = 'Autre nom', cle = 'autre-nom' WHERE id = 7");
  l = liensDesValeursFermees(b);
  assert.equal(l.degats.feu.libelle, 'Autre nom', 'un renommage se lit à l’appel suivant');
  assert.equal(l.magies['m/feu'].cle, 'autre-nom');
  b.close();
});

test('bestiaire : les cibles et les magies d’une créature se lient par identifiant (`cible_magie_id`, `magiesIds`, `resisteCibles`, `vulnerableCibles`)', () => {
  const { lignes } = chargerInvocations(db);
  const noms = new Map(db.prepare('SELECT id, nom FROM magie').all().map((m) => [m.id, m.nom]));
  let cibles = 0;
  for (const l of lignes) {
    assert.deepEqual(l.magiesIds.map((id) => noms.get(id)), l.magies, `${l.id} : magiesIds parallèle à magies`);
    for (const x of l.defensesEcrites.filter((d) => d.cible_type === 'magie')) {
      assert.equal(noms.get(x.cible_magie_id), x.cible, `${l.id} : cible_magie_id est la magie citée`);
      cibles += 1;
    }
    for (const d of l.defensesParMagie) {
      assert.deepEqual(d.resisteCibles.map((c) => c.nom), d.resiste, `${l.id} : mêmes cibles, même ordre`);
      assert.deepEqual(d.vulnerableCibles.map((c) => c.nom), d.vulnerable);
      for (const c of [...d.resisteCibles, ...d.vulnerableCibles].filter((x) => x.cible_type === 'magie')) {
        assert.equal(noms.get(c.cible_magie_id), c.nom, `${l.id} : l'id de la cible est celui de sa magie`);
        cibles += 1;
      }
    }
  }
  assert.ok(cibles > 0, 'des cibles de magie dans les créatures invoquées');
  // les lignes des tableaux (TableauInvocations) : les magies de la combinaison, par nom et par identifiant
  const { tableaux } = chargerInvocations(db);
  let blocs = 0;
  for (const t of tableaux) {
    for (const l of t.lignes) {
      assert.deepEqual(l.magiesIds.map((id) => noms.get(id)), l.magies, `${l.id} : magiesIds parallèle à magies`);
      blocs += 1;
    }
  }
  assert.ok(blocs > 0, 'des lignes de tableau');
});

test('une cible de créature se lie par son identifiant, pas par son nom ; un nom qui n’est pas celui de la magie n’y change rien', () => {
  const g = Object.entries(liens.magies).find(([, l]) => l);
  assert.ok(g, 'une magie liée');
  const [id, lien] = g;
  const attendu = `{{${lien.cle}|${lien.texte}}}`;
  assert.equal(htmlDeLaCible({ nom: lien.texte, cible_type: 'magie', cible_magie_id: id, cible_degat: null }, liens), attendu);
  assert.equal(htmlDeLaCible({ nom: 'Autre texte', cible_type: 'magie', cible_magie_id: id, cible_degat: null }, liens), attendu, 'par id : le nom court de la magie s’affiche, quel que soit le nom reçu');
  assert.equal(htmlDeLaCible({ nom: 'Brûlure', cible_type: 'etat', cible_magie_id: null, cible_degat: null }, liens), 'Brûlure', 'une altération : jamais liée');
  assert.equal(htmlDeLaCible({ nom: lien.texte, cible_type: 'magie', cible_magie_id: id, cible_degat: null }, null), lien.texte, 'sans liens : nu');
  const defense = { sens: 'resistance', cible_type: 'magie', cible_magie_id: id, cible: lien.texte, libelle: `Résistance : ${lien.texte}` };
  assert.equal(htmlDeLaDefenseDeCreature(defense, liens), `Résistance : ${attendu}`);
});
