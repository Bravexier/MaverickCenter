// Le poids de chaque bouclier préfabriqué (bouclier.poids_id, migration 0054, décision R92 ; demande du propriétaire du 2026-10-16 : « En ce qui
// concerne le poids base toi sur la couleur du tableau d'orignie et affiche le dans le résultat final », sic) : la couleur de fond de sa case dans l'onglet
// « Bouclier » du classeur ORIGINAL (vert Léger, jaune Moyen, orange Lourd, rouge Très lourd : les couleurs de la liste des poids), consignée case par
// case dans le registre de la migration (data/migrations/0054-poids-des-boucliers.json). La base dans son état d'import (lib/historique-site.mjs :
// le site de dev peut changer le poids d'un bouclier depuis) doit être exactement le registre ; les couleurs du site (lib/equipement-couleurs.mjs) sont
// celles de la légende, posées par la classe du poids (lib/palette-css.mjs, famille `poids`) ; la pastille d'un poids dit « Requiert N Force minimum ».
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chargerArmures, poidsDeBouclier } from '../src/lib/armures-db.mjs';
import { htmlDuPoids, RENDUS_DES_ARMURES } from '../src/lib/armures-rendu.mjs';
import { COULEUR_SANS_TYPE, COULEURS_DES_POIDS } from '../src/lib/equipement-couleurs.mjs';
import { classeDuPoids, FAMILLES_DE_LA_PALETTE, PAR_DEFAUT } from '../src/lib/palette-css.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const db = ouvrirBase({ sansExemples: false });
const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0054-poids-des-boucliers.json', import.meta.url), 'utf8'));
const h = historiqueSite(db);

test('registre de la migration 0054 : les 100 boucliers, chacun avec sa case, sa couleur et le poids de cette couleur (celle de la légende)', () => {
  const legende = Object.fromEntries(registre.legende.map((l) => [l.couleur, l.poids_id]));
  assert.deepEqual(Object.values(legende).sort(), ['leger', 'lourd', 'moyen', 'tres-lourd']);
  assert.equal(registre.boucliers.length, 100);
  assert.equal(new Set(registre.boucliers.map((b) => b.id)).size, 100);
  for (const b of registre.boucliers) {
    assert.match(b.cellule, /^[A-Z]{1,2}\d+$/, b.id);
    assert.equal(legende[b.couleur], b.poids_id, `${b.id} : la couleur ${b.couleur} est celle du poids ${b.poids_id}`);
  }
  const comptes = {};
  for (const b of registre.boucliers) comptes[b.poids_id] = (comptes[b.poids_id] ?? 0) + 1;
  assert.deepEqual(comptes, { leger: 37, moyen: 12, lourd: 21, 'tres-lourd': 30 });
});

test('la base dans son état d’import est le registre : chaque bouclier a le poids de la couleur de sa case, et sa case est celle de sa source', () => {
  const lignes = h.lignesDImport('bouclier');
  assert.equal(lignes.length, registre.boucliers.length);
  const parId = new Map(lignes.map((l) => [l.id, l]));
  for (const b of registre.boucliers) {
    const l = parId.get(b.id);
    assert.ok(l, b.id);
    assert.equal(l.poids_id, b.poids_id, b.id);
    assert.equal(l.source_ref, `Ressources et Craft › Bouclier › ${b.cellule}`, b.id);
  }
  // les poids existent (clé étrangère), dans l'ordre de la liste de l'onglet, avec leur Force minimum
  const poids = poidsDeBouclier(db);
  assert.deepEqual(poids.map((p) => [p.id, p.force_min, p.valeur, p.libelle]), [['leger', 1, 'leger', 'Léger'], ['moyen', 2, 'moyen', 'Moyen'], ['lourd', 3, 'lourd', 'Lourd'], ['tres-lourd', 4, 'tres-lourd', 'Très lourd']]);
});

test('état courant : tout bouclier a un poids de la liste (invariant), la page les charge avec ; les couleurs du site sont celles de la légende', () => {
  const armures = chargerArmures(db);
  const ids = new Set(armures.poids.map((p) => p.id));
  for (const b of armures.boucliers) assert.ok(ids.has(b.poids_id), `${b.id} : poids ${b.poids_id}`);
  assert.deepEqual(COULEURS_DES_POIDS, Object.fromEntries(registre.legende.map((l) => [l.poids_id, l.couleur])));
  // chaque poids de la base a sa classe, de la couleur de sa légende ; un poids sans couleur connue : la classe par défaut (le gris sans type)
  for (const p of armures.poids) assert.equal(classeDuPoids(p.id), `couleur-poids-${p.id}`, p.id);
  assert.equal(classeDuPoids('plume'), `couleur-poids-${PAR_DEFAUT}`);
  assert.equal(FAMILLES_DE_LA_PALETTE.poids[PAR_DEFAUT], COULEUR_SANS_TYPE);
});

test('la pastille d’un poids : la classe de sa couleur (jamais un style), sa Force minimum en data-force et « Requiert N Force minimum » en infobulle ; rien sans poids', () => {
  assert.equal(htmlDuPoids({ id: 'lourd', nom: 'Lourd', force_min: 3 }), '<span class="ppoids couleur-poids-lourd" data-poids="lourd" data-force="3" title="Requiert 3 Force minimum">Lourd</span>');
  assert.equal(htmlDuPoids({ id: 'x', nom: 'A <b>', force_min: null }), '<span class="ppoids couleur-poids-par-defaut" data-poids="x">A &lt;b&gt;</span>');
  assert.match(htmlDuPoids(null), /class="vide"/);
  const ctx = { poidsDeBouclier: poidsDeBouclier(db) };
  assert.equal(RENDUS_DES_ARMURES['bouclier-poids']('moyen', {}, ctx), htmlDuPoids(ctx.poidsDeBouclier[1]));
  assert.match(RENDUS_DES_ARMURES['bouclier-poids'](null, {}, ctx), /class="vide"/);
  // un identifiant que la liste n'a pas (liste absente) : affiché tel quel, sans Force
  assert.equal(RENDUS_DES_ARMURES['bouclier-poids']('moyen', {}, {}), '<span class="ppoids couleur-poids-moyen" data-poids="moyen">moyen</span>');
});

test('AP et AM séparés (« Sépare donc les AP des AM ») : chaque rendu lit sa colonne (ap, am : deux valeurs de la base, 2026-10-17) et porte sa valeur', () => {
  assert.equal(RENDUS_DES_ARMURES['protection-ap'](20, { ap: 20, am: 25 }), '<span class="pdef" data-ap="20"><span class="pdef__ap" title="Armure physique">+20&#8239;AP</span></span>');
  assert.equal(RENDUS_DES_ARMURES['protection-am'](25, { ap: 20, am: 25 }), '<span class="pdef" data-am="25"><span class="pdef__am" title="Armure magique">+25&#8239;AM</span></span>');
  // une case vide : « — », valeur 0 (la fiche compte 0) ; un malus s'écrit avec le signe moins typographique
  assert.match(RENDUS_DES_ARMURES['protection-am'](null, { ap: 3, am: null }), /^<span class="pdef" data-am="0"><span class="vide"/);
  assert.equal(RENDUS_DES_ARMURES['protection-ap'](-2), '<span class="pdef" data-ap="-2"><span class="pdef__ap" title="Armure physique">−2&#8239;AP</span></span>');
});
