// Les types de dégâts des attaques des créatures invoquées (lib/bestiaire-db.mjs#chargerInvocations, `attaques[].types`) : ceux que porte la base
// (creature_attaque_type, migration 0125 pour leur lien au glossaire), dans l'ordre de `rang` ; une attaque sans ligne n'a pas de type (`[]`), rien n'est
// déduit de son texte. Le test lit l'état courant de la base : il ne compare que la cohérence entre la page et la table, jamais une valeur précise.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerInvocations, chargerMonstres } from '../src/lib/bestiaire-db.mjs';
import { lienDuTypeDeDegats } from '../src/lib/mots-cles-des-valeurs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase({ sansExemples: false });
const { lignes, liens } = chargerInvocations(db);
const attaquesDeLaBase = Map.groupBy(db.prepare('SELECT id, creature_id FROM creature_attaque ORDER BY creature_id, rang').all(), (a) => a.creature_id);
const typesDeLaBase = db.prepare('SELECT type, libelle, magie_id FROM creature_attaque_type WHERE attaque_id = ? ORDER BY rang');

test('créatures invoquées : les types de chaque attaque sont ceux de creature_attaque_type, dans l\'ordre de rang ; sans ligne, []', () => {
  let vues = 0;
  let sansType = 0;
  for (const l of lignes) {
    const siennes = attaquesDeLaBase.get(l.id) ?? [];
    assert.equal(l.attaques.length, siennes.length, l.id);
    l.attaques.forEach((a, k) => {
      const attendus = typesDeLaBase.all(siennes[k].id).map((t) => ({ type: t.type, libelle: t.libelle, magie_id: t.magie_id }));
      assert.deepEqual(a.types, attendus, siennes[k].id);
      vues += 1;
      if (!attendus.length) sansType += 1;
    });
  }
  assert.equal(vues, db.prepare('SELECT count(*) AS n FROM creature_attaque').get().n);
  assert.equal(sansType, db.prepare('SELECT count(*) AS n FROM creature_attaque a WHERE NOT EXISTS (SELECT 1 FROM creature_attaque_type t WHERE t.attaque_id = a.id)').get().n);
});

test('créatures invoquées : chaque type exposé se résout par `liens.degats` (clé présente, lien ou null) ; feu, eau, glace : le lien de leur magie', () => {
  for (const l of lignes) {
    for (const a of l.attaques) {
      for (const t of a.types) {
        assert.ok(t.type in liens.degats, `${l.id} : type ${t.type} absent de liens.degats`);
        const lien = lienDuTypeDeDegats(liens, t.type);
        if (t.magie_id !== null) assert.deepEqual(lien, liens.magies[t.magie_id], `${l.id} : ${t.type}`);
      }
    }
  }
});

// Les cartes de monstre (migration 0130, R299, R300) : `attaques[].types` = les lignes de monstre_attaque_type, dans l'ordre écrit, avec la magie de type_degats ;
// `[]` sans ligne. Même forme que les créatures invoquées : le rendu de valeurs-fermees-rendu.mjs lit les deux.
const monstres = chargerMonstres(db);
const attaquesDesCartes = Map.groupBy(db.prepare('SELECT monstre_id, rang FROM monstre_attaque ORDER BY monstre_id, rang').all(), (a) => a.monstre_id);
const typesDeLaCarte = db.prepare('SELECT t.type, t.libelle, d.magie_id FROM monstre_attaque_type t JOIN type_degats d ON d.id = t.type WHERE t.monstre_id = ? AND t.attaque_rang = ? ORDER BY t.rang');

test('cartes de monstre : les types de chaque attaque sont ceux de monstre_attaque_type, dans l\'ordre de rang, avec la magie de type_degats ; sans ligne, []', () => {
  let vues = 0;
  for (const l of monstres.lignes.filter((x) => x.carte)) {
    const siennes = attaquesDesCartes.get(l.id) ?? [];
    assert.equal(l.carte.attaques.length, siennes.length, l.id);
    l.carte.attaques.forEach((a, k) => {
      assert.deepEqual(a.types, typesDeLaCarte.all(l.id, siennes[k].rang).map((t) => ({ type: t.type, libelle: t.libelle, magie_id: t.magie_id })), `${l.id} attaque ${siennes[k].rang}`);
      vues += 1;
    });
  }
  assert.equal(vues, db.prepare('SELECT count(*) AS n FROM monstre_attaque').get().n);
});

test('cartes de monstre : chaque type exposé se résout par `liens.degats` ; un type d\'une magie a le lien de sa magie', () => {
  for (const l of monstres.lignes.filter((x) => x.carte)) {
    for (const a of l.carte.attaques) {
      for (const t of a.types) {
        assert.ok(t.type in monstres.liens.degats, `${l.id} : type ${t.type} absent de liens.degats`);
        if (t.magie_id !== null) assert.deepEqual(lienDuTypeDeDegats(monstres.liens, t.type), monstres.liens.magies[t.magie_id], `${l.id} : ${t.type}`);
      }
    }
  }
});
