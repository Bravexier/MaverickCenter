// Corps des pages qui écrivent les composants (lib/corps-composants.mjs) : chaque objet de l'onglet « Équipement inventaire », gemme, bois, matériau et
// ingrédient d'alchimie de la base retrouve sa ligne (une case changée puis remise redonne le corps à l'octet près) ; la liste MONNAIE et le CONVERTISSEUR
// se refont à l'identique depuis la table monnaie ; les prix écrits redonnent les prix en RF de la base (lib/composants-champs.mjs#prixEnRf). Invariants
// rejoués sur toute la base : ils tiennent après une modification depuis le site, que le service et le rejeu du journal suivent avec ces fonctions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { convertisseurDeMonnaie, PRIX_DE_GEMME, prixEnRf } from '../src/lib/composants-champs.mjs';
import {
  corpsAvecMonnaies, corpsDeLaPageDesComposantsEntier, corpsDuComposantApres, ErreurCorpsComposants, PAGE_DE_L_INVENTAIRE, PAGES_DES_COMPOSANTS_AU_CORPS_ENTIER, PAGE_DES_ACCESSOIRES, PAGE_DES_ARMURES, PAGE_DES_BATONS, PAGE_DES_BOUCLIERS,
  PAGE_DES_INGREDIENTS, sectionDeLInventaire,
} from '../src/lib/corps-composants.mjs';
import { etatDuCorpsDesComposants } from '../serveur/edition-composants.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

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
  // l'unité seule (les autres supprimées sur le site de dev) : CONVERTISSEUR vidé, puis les monnaies remises : le corps revient à l'octet près
  const seule = corpsAvecMonnaies(corps(PAGE_DE_L_INVENTAIRE), [unite]);
  assert.doesNotMatch(seule.slice(seule.indexOf('### CONVERTISSEUR'), seule.indexOf('\n## ', seule.indexOf('### CONVERTISSEUR'))), /^- /m, 'convertisseur vide');
  assert.equal(corpsAvecMonnaies(corpsAvecMonnaies(seule, [unite]), monnaies), corps(PAGE_DE_L_INVENTAIRE));
});

test('chaque objet de l’onglet « Équipement inventaire » retrouve sa ligne (prix, description)', () => {
  // tous ceux de la base (le site de dev en supprime) ; quatre-vingt-cinq au moins à l'import
  const objets = db.prepare('SELECT * FROM ressource WHERE page_id = ?').all(PAGE_DE_L_INVENTAIRE);
  assert.ok(baseDImport().prepare('SELECT count(*) AS n FROM ressource WHERE page_id = ?').get(PAGE_DE_L_INVENTAIRE).n >= 85, 'à l’import');
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

// Le corps ENTIER d'une page (« Tout recalculer » : serveur/edition-lots.mjs#ecartsDuRecalcul) : « Équipement inventaire » et « Liste d'ingrédients », dont les
// tableaux se remplacent en bloc par les lignes de la table ; une ligne du corps qui n'est plus celle que la table rend est refaite sans être retrouvée par son nom.
const etat = () => etatDuCorpsDesComposants(db);
const entier = (page, e = etat(), c = corps(page)) => corpsDeLaPageDesComposantsEntier(page, c, e);

test('le corps entier redonne le corps des pages de l’inventaire et des ingrédients : chaque tableau, la monnaie et le convertisseur sont déjà ce que les tables disent', () => {
  assert.deepEqual([...PAGES_DES_COMPOSANTS_AU_CORPS_ENTIER].sort(), [PAGE_DE_L_INVENTAIRE, PAGE_DES_INGREDIENTS].sort());
  for (const page of PAGES_DES_COMPOSANTS_AU_CORPS_ENTIER) assert.equal(entier(page), corps(page), page);
});

test('corps entier : un objet et un ingrédient changés, créés ou retirés dans leurs tables (nom compris) se retrouvent dans les tableaux ; la prose reste', () => {
  const e = etat();
  const lignes = (page, e2) => entier(page, e2).split('\n');
  const objet = e.objets.find((r) => sectionDeLInventaire(r)?.description);
  const e1 = { ...e, objets: e.objets.map((r) => (r.id === objet.id ? { ...r, nom: 'Objet du test', prix_brut: '9 RO', description: 'Description du test' } : r)) };
  assert.ok(lignes(PAGE_DE_L_INVENTAIRE, e1).includes('| Objet du test | 9 RO | Description du test |'));
  assert.ok(!lignes(PAGE_DE_L_INVENTAIRE, e1).some((l) => l.startsWith(`| ${objet.nom} |`)));
  // un objet créé s'ajoute à la fin de son tableau, un objet retiré en part
  const cree = { ...objet, id: 'x#objet', nom: 'Objet créé', prix_brut: '1 RO', description: 'Créé', ordre: 10000 };
  assert.ok(lignes(PAGE_DE_L_INVENTAIRE, { ...e, objets: [...e.objets, cree] }).includes('| Objet créé | 1 RO | Créé |'));
  assert.ok(!lignes(PAGE_DE_L_INVENTAIRE, { ...e, objets: e.objets.filter((r) => r.id !== objet.id) }).some((l) => l.startsWith(`| ${objet.nom} |`)));
  assert.ok(lignes(PAGE_DES_INGREDIENTS, { ...e, ingredients: e.ingredients.map((x, k) => (k === 0 ? { ...x, nom: 'Ingrédient du test', type_brut: 'Type du test', affinite_brut: 'Affinité du test' } : x)) })
    .includes('| Ingrédient du test | Type du test | Affinité du test |'));
  for (const page of PAGES_DES_COMPOSANTS_AU_CORPS_ENTIER) {
    const prose = (c) => c.split('\n').filter((l) => !l.startsWith('|') && !l.startsWith('- '));
    assert.deepEqual(prose(entier(page, e1)), prose(corps(page)), page);
  }
});

test('corps entier : une ligne que le corps n’écrit plus comme la table (ancien rendu) est refaite, la ligne d’un objet gardée telle quelle quand son nom ne diffère que par la casse ou un retour <br>', () => {
  const e = etat();
  const objet = e.objets.find((r) => sectionDeLInventaire(r)?.description);
  const lignes = corps(PAGE_DE_L_INVENTAIRE).split('\n');
  const i = lignes.findIndex((l) => l.startsWith(`| ${objet.nom} |`));
  assert.ok(i > 0);
  lignes[i] = `| ${objet.nom} | ancien prix | ancienne description |`;
  assert.equal(entier(PAGE_DE_L_INVENTAIRE, e, lignes.join('\n')), corps(PAGE_DE_L_INVENTAIRE));
  const autreCasse = corps(PAGE_DE_L_INVENTAIRE).split('\n');
  const j = autreCasse.findIndex((l) => l.startsWith(`| ${objet.nom} |`));
  autreCasse[j] = autreCasse[j].replace(`| ${objet.nom} |`, `| ${objet.nom.toUpperCase()} |`);
  assert.equal(entier(PAGE_DE_L_INVENTAIRE, e, autreCasse.join('\n')), autreCasse.join('\n'), 'même nom à la casse près : la ligne reste');
});

test('corps entier : une section ou un tableau introuvable : ErreurCorpsComposants', () => {
  const e = etat();
  assert.throws(() => entier(PAGE_DES_INGREDIENTS, e, corps(PAGE_DES_INGREDIENTS).replace('## Solvant', '## Autre')), ErreurCorpsComposants);
  assert.throws(() => entier(PAGE_DE_L_INVENTAIRE, e, ''), ErreurCorpsComposants);
});

test('les matériaux, gemmes et bois ne sont JAMAIS réécrits par rang (le site en crée sans ligne dans ces pages) : supprimer le dernier puis en créer un ne change pas le corps', () => {
  const e = etat();
  // un élément retiré et un autre créé au même rang (la création reprend max(ordre) + 1) : donné au rendu, même sous les clés qu'un rendu par rang lirait, il ne décale aucune ligne
  const gemmes = db.prepare("SELECT nom, description, ordre FROM ressource WHERE genre = 'gemme' ORDER BY ordre").all().map((g) => ({ ...g }));
  const derniere = gemmes[gemmes.length - 1];
  const avec = { ...e, gemmes: [...gemmes.slice(0, -1), { ...derniere, nom: 'Gemme créée du test' }], bois: [], materiaux: [] };
  for (const page of [PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS, PAGE_DES_BATONS, PAGE_DES_ACCESSOIRES]) {
    assert.equal(corpsDeLaPageDesComposantsEntier(page, corps(page), avec), corps(page), `${page} : rendue telle quelle`);
  }
  assert.deepEqual(Object.keys(e).sort(), ['ingredients', 'monnaies', 'objets'], 'l’état du rendu entier ne porte ni matériau, ni gemme, ni bois');
});
