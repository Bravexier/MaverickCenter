// Corps des pages qui écrivent les composants (lib/corps-composants.mjs) : chaque objet de l'onglet « Équipement inventaire », gemme, bois, matériau et
// ingrédient d'alchimie de la base retrouve sa ligne (une case changée puis remise redonne le corps à l'octet près) ; la liste MONNAIE et le CONVERTISSEUR
// se refont à l'identique depuis la table monnaie ; les prix écrits redonnent les prix en RF de la base (lib/composants-champs.mjs#prixEnRf). Invariants
// rejoués sur toute la base : ils tiennent après une modification depuis le site, que le service et le rejeu du journal suivent avec ces fonctions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { convertisseurDeMonnaie, PRIX_DE_GEMME, prixEnRf } from '../src/lib/composants-champs.mjs';
import {
  corpsAvecMonnaies, corpsDuComposantApres, PAGE_DE_L_INVENTAIRE, PAGE_DES_ACCESSOIRES, PAGE_DES_ARMURES, PAGE_DES_BATONS, PAGE_DES_BOUCLIERS,
  PAGE_DES_INGREDIENTS, sectionDeLInventaire,
} from '../src/lib/corps-composants.mjs';

const db = ouvrirBase({ sansExemples: false });
const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
const monnaies = db.prepare('SELECT * FROM monnaie').all();
/** Une gemme, un bois ou un matériau créés depuis le site n'ont pas de ligne dans les pages de l'armurerie ou des bâtons (lib/corps-composants.mjs). */
const importe = "source_ref NOT LIKE 'Site de dev%'";
const contexte = { monnaies: () => monnaies, ressource: (id) => db.prepare('SELECT * FROM ressource WHERE id = ?').get(id) };
/** Une case changée puis remise : le corps revient à l'octet près, et il a bien changé entre-temps (la ligne a été trouvée). */
function allerRetour(page, table, ligne, changes, { trouvee = true } = {}) {
  const c = corps(page);
  const autre = { ...ligne, ...changes };
  const change = corpsDuComposantApres(page, c, table, ligne, autre, contexte);
  if (trouvee) assert.notEqual(change, c, `${page} : ligne de ${ligne.nom ?? ligne.ressource_id} introuvable`);
  assert.equal(corpsDuComposantApres(page, change, table, autre, ligne, contexte), c, `${page} : ${ligne.nom ?? ligne.ressource_id}`);
}

test('MONNAIE et CONVERTISSEUR se refont à l’identique ; le convertisseur de chaque monnaie aussi', () => {
  assert.equal(corpsAvecMonnaies(corps(PAGE_DE_L_INVENTAIRE), monnaies), corps(PAGE_DE_L_INVENTAIRE));
  const unite = monnaies.find((m) => m.valeur_rf === 1);
  for (const m of monnaies) assert.equal(convertisseurDeMonnaie(m, unite.abreviation), m.convertisseur_brut, m.id);
});

test('chaque objet de l’onglet « Équipement inventaire » retrouve sa ligne (prix, description)', () => {
  const objets = db.prepare('SELECT * FROM ressource WHERE page_id = ?').all(PAGE_DE_L_INVENTAIRE);
  assert.ok(objets.length >= 85);
  for (const r of objets) allerRetour(PAGE_DE_L_INVENTAIRE, 'ressource', r, { prix_brut: 'zz', ...(sectionDeLInventaire(r).description ? { description: 'zz' } : {}) });
});

test('chaque gemme retrouve ses lignes des bâtons (gemme entière) et des accessoires (quart de gemme), et chaque bois la sienne', () => {
  for (const g of db.prepare(`SELECT r.*, g.* FROM gemme g JOIN ressource r ON r.id = g.ressource_id WHERE r.${importe}`).all()) {
    for (const p of [PAGE_DES_BATONS, PAGE_DES_ACCESSOIRES]) {
      allerRetour(p, 'ressource', g, { description: 'zz' });
      allerRetour(p, 'gemme', g, p === PAGE_DES_BATONS ? { prix_commune_brut: 'zz' } : { quart_commune_brut: 'zz' });
    }
  }
  for (const b of db.prepare(`SELECT r.* FROM bois b JOIN ressource r ON r.id = b.ressource_id WHERE r.${importe}`).all()) allerRetour(PAGE_DES_BATONS, 'ressource', b, { prix_brut: 'zz' });
});

test('chaque matériau des armures retrouve sa ligne des tableaux MATÉRIAUX des armures et des boucliers', () => {
  for (const m of db.prepare(`SELECT * FROM ressource WHERE genre = 'materiau' AND page_id = ? AND ${importe}`).all(PAGE_DES_ARMURES)) {
    for (const p of [PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS]) allerRetour(p, 'ressource', m, { prix_brut: 'zz', description: 'zz' });
  }
});

test('chaque ingrédient d’alchimie retrouve sa ligne de la liste d’ingrédients (nom, type, affinité)', () => {
  for (const i of db.prepare('SELECT * FROM ingredient_alchimie').all()) {
    allerRetour(PAGE_DES_INGREDIENTS, 'ingredient_alchimie', i, { type_brut: 'zz', affinite_brut: 'zz' });
    allerRetour(PAGE_DES_INGREDIENTS, 'ressource', contexte.ressource(i.ressource_id), { nom: 'zz' });
  }
});

test('les prix écrits redonnent les prix en RF de la base (ressources et gemmes)', () => {
  for (const r of db.prepare('SELECT id, prix_brut, prix_rf FROM ressource').all()) assert.equal(prixEnRf(r.prix_brut), r.prix_rf, r.id);
  for (const g of db.prepare('SELECT * FROM gemme').all()) for (const p of PRIX_DE_GEMME) assert.equal(prixEnRf(g[`${p}_brut`]), g[`${p}_rf`], `${g.ressource_id} ${p}`);
});
