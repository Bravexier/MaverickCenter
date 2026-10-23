// Édition de la page « Composants » depuis le site de dev (serveur/edition-composants.mjs ; demande du propriétaire, 2026-10-14 : « chaque élément est
// modifiable en édition, supprimable, ajoutable ») : une cellule modifiée refait ce que la base en tire (prix en RF, ligne du CONVERTISSEUR, type et
// affinité d'un ingrédient) et les lignes des pages qui écrivent le composant ; création, suppression (refusée pour un composant cité par d'autres règles) ;
// le rejeu du journal (livraison) refait les mêmes lignes et les mêmes corps. Les tests lisent l'état avant d'écrire et prennent des noms absents de la base.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { prixEnRf } from '../src/lib/composants-champs.mjs';
import {
  PAGE_DE_L_INVENTAIRE, PAGE_DES_ACCESSOIRES, PAGE_DES_ARMURES, PAGE_DES_BATONS, PAGE_DES_BOUCLIERS, PAGE_DES_INGREDIENTS,
} from '../src/lib/corps-composants.mjs';
import { OBJETS_AU_CATALOGUE, retirerLesManquants } from '../serveur/fiches-retraits.mjs';
import { ficheVide, TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';

const racine = dossierTemporaire('edition-composants');
let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
const db = vivante();
const service = { base: () => db, etat: () => ({}), edition: true };
const enregistrer = (operations, base = db) =>
  traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'ressources/composants/', operations }) },
    base === db ? service : { base: () => base, etat: () => ({}), edition: true });
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const corps = (id, base = db) => base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
const lignesDe = (id, base = db) => corps(id, base).split('\n');
const appel = (methode, chemin, corps_) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps_ && JSON.stringify(corps_) }, service);
const ok = (r) => assert.equal(r.statut, 200, JSON.stringify(r.corps));
/** Un nom qu'aucune ressource ne porte encore. */
const nomLibre = (nom) => {
  let n = `${nom} ${process.pid}`;
  for (let i = 2; ligne('SELECT 1 FROM ressource WHERE nom = ?', n); i += 1) n = `${nom} ${process.pid} ${i}`;
  return n;
};

test('le modèle : ressource, gemme, ingrédient et monnaie se modifient ; composant, gemme, bois, ingrédient et monnaie se créent et se suppriment', () => {
  for (const t of ['ressource', 'gemme', 'ingredient_alchimie', 'monnaie']) assert.ok(TABLES[t], t);
  for (const e of ['composant', 'gemme', 'bois', 'ingredient', 'monnaie']) assert.ok(ENTITES[e]?.suppression, e);
});

test('objet de l’onglet : prix et description modifiés, prix en RF recalculé, sa ligne de l’onglet suit', () => {
  const avant = ligne("SELECT * FROM ressource WHERE page_id = ? AND section = 'MATOS AVENTURES' ORDER BY id LIMIT 1", PAGE_DE_L_INVENTAIRE);
  const r = enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: avant.id }, valeurs: { prix_brut: '1 200 RF / 12 RO', description: 'Essai.' } }]);
  ok(r);
  const apres = ligne('SELECT * FROM ressource WHERE id = ?', avant.id);
  assert.equal(apres.prix_rf, 1200);
  assert.ok(lignesDe(PAGE_DE_L_INVENTAIRE).includes(`| ${apres.nom} | 1 200 RF / 12 RO | Essai. |`));
});

test('une ressource qui n’est pas un composant (un livre) ne se modifie pas ici ; le prix d’une gemme est dans la table gemme', () => {
  // (une potion se modifie dans l'onglet Ceinture : test/serveur-edition-consommables.test.mjs)
  const livre = ligne("SELECT id FROM ressource WHERE genre = 'livre' LIMIT 1");
  assert.equal(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: livre.id }, valeurs: { nom: 'X' } }]).statut, 400);
  const gemme = ligne("SELECT id FROM ressource WHERE genre = 'gemme' LIMIT 1");
  assert.equal(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: gemme.id }, valeurs: { prix_brut: '1 RO' } }]).statut, 400);
});

test('gemme : prix modifiés (en RF recalculés), nom et description ; ses lignes des bâtons et des accessoires suivent, effets d’accessoire compris', () => {
  const g = ligne("SELECT r.*, g.* FROM gemme g JOIN ressource r ON r.id = g.ressource_id WHERE r.nom_cle = 'ambre'");
  ok(enregistrer([{ op: 'modifier', table: 'gemme', cle: { ressource_id: g.ressource_id }, valeurs: { prix_commune_brut: '55 RO', quart_parfaite_brut: '60 Ro' } }]));
  const apres = ligne('SELECT * FROM gemme WHERE ressource_id = ?', g.ressource_id);
  assert.deepEqual([apres.prix_commune_rf, apres.quart_parfaite_rf], [5500, 6000]);
  assert.ok(lignesDe(PAGE_DES_BATONS).some((l) => l.startsWith(`| Terre | ${g.nom} |`) && l.includes('| 55 RO |')));
  assert.ok(lignesDe(PAGE_DES_ACCESSOIRES).some((l) => l.startsWith(`| Terre | ${g.nom} |`) && l.includes('| 60 Ro |')));
  const nom = nomLibre('Ambre essai');
  ok(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: g.ressource_id }, valeurs: { nom } }]));
  assert.ok(lignesDe(PAGE_DES_BATONS).some((l) => l.startsWith(`| Terre | ${nom} |`)));
  assert.ok(corps(PAGE_DES_ACCESSOIRES).includes(`${nom} + Grenat`), 'la combinaison « Ambre + Grenat » d’un effet suit');
  assert.ok(!/\| Ambre \+ /.test(corps(PAGE_DES_ACCESSOIRES)));
});

test('matériau : prix et description dans les tableaux des armures et des boucliers ; renommé, aussi la page des armes et la monture', () => {
  const m = ligne("SELECT * FROM ressource WHERE genre = 'materiau' AND nom_cle = 'mythril'");
  ok(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: m.id }, valeurs: { prix_brut: '210 RO', description: 'Description d’essai.' } }]));
  for (const id of [PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS]) {
    assert.ok(lignesDe(id).some((l) => l.startsWith(`| ${m.nom} | 210 RO | Description d’essai. |`)), id);
  }
  const nom = nomLibre('Mythril essai');
  ok(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: m.id }, valeurs: { nom } }]));
  assert.ok(lignesDe(PAGE_DES_ACCESSOIRES).includes(`| Niveau 5 | ${nom} | 100 Ro | Effet suprême |`), 'la monture de niveau 5');
  assert.ok(corps(PAGE_DES_ARMURES).includes(`| ${nom} | 210 RO |`));
});

test('ingrédient : type et affinité refont type, majeur et affinité (créée si nouvelle) ; sa ligne de la liste d’ingrédients suit', () => {
  const i = ligne("SELECT r.nom, i.* FROM ingredient_alchimie i JOIN ressource r ON r.id = i.ressource_id WHERE i.categorie = 'amplificateur' AND i.majeur = 1 ORDER BY i.ressource_id LIMIT 1");
  ok(enregistrer([{ op: 'modifier', table: 'ingredient_alchimie', cle: { ressource_id: i.ressource_id }, valeurs: { type_brut: 'Baie (majeur)', affinite_brut: 'Vitesse + Santé + Coma' } }]));
  const apres = ligne('SELECT * FROM ingredient_alchimie WHERE ressource_id = ?', i.ressource_id);
  assert.deepEqual([apres.type, apres.majeur, apres.affinite_id], ['Baie', 1, 'coma+sante+vitesse']);
  assert.equal(ligne("SELECT libelle FROM affinite WHERE id = 'coma+sante+vitesse'").libelle, 'Vitesse + Santé + Coma');
  assert.ok(lignesDe(PAGE_DES_INGREDIENTS).includes(`| ${i.nom} | Baie (majeur) | Vitesse + Santé + Coma |`));
  const catalyseur = ligne("SELECT ressource_id FROM ingredient_alchimie WHERE categorie = 'catalyseur' LIMIT 1");
  assert.equal(enregistrer([{ op: 'modifier', table: 'ingredient_alchimie', cle: catalyseur, valeurs: { type_brut: 'Fruit (majeur)' } }]).statut, 400, 'seul un amplificateur est majeur');
});

test('monnaie (décision R61) : sa valeur ne se modifie pas, l’abréviation du RF, du RO et de la PP non plus ; une monnaie créée a sa ligne du CONVERTISSEUR ; l’unité ne se supprime pas', () => {
  for (const id of ['rf', 'ro', 'pp']) {
    assert.equal(enregistrer([{ op: 'modifier', table: 'monnaie', cle: { id }, valeurs: { valeur_rf: 7 } }]).statut, 400, `${id} : valeur`);
    assert.equal(enregistrer([{ op: 'modifier', table: 'monnaie', cle: { id }, valeurs: { abreviation: 'XX' } }]).statut, 400, `${id} : abréviation`);
  }
  const pp = ligne("SELECT nom FROM monnaie WHERE id = 'pp'").nom;
  ok(enregistrer([{ op: 'modifier', table: 'monnaie', cle: { id: 'pp' }, valeurs: { nom: `${pp} taillée` } }]));
  assert.ok(lignesDe(PAGE_DE_L_INVENTAIRE).includes(`- ${pp} taillée : PP`), 'la liste MONNAIE suit le nom');
  ok(enregistrer([{ op: 'modifier', table: 'monnaie', cle: { id: 'pp' }, valeurs: { nom: pp } }]));
  assert.equal(enregistrer([{ op: 'supprimer', entite: 'monnaie', cle: { id: 'rf' } }]).statut, 409);
  const r = enregistrer([{ op: 'creer', entite: 'monnaie', valeurs: { nom: `Ricken d’argent ${process.pid}`, abreviation: `RA${process.pid}`, valeur_rf: 10 } }]);
  ok(r);
  const id = r.corps.crees[0].id;
  assert.equal(ligne('SELECT convertisseur_brut FROM monnaie WHERE id = ?', id).convertisseur_brut, `1 RA${process.pid} : 10 RF`);
  assert.ok(lignesDe(PAGE_DE_L_INVENTAIRE).includes(`- 1 RA${process.pid} : 10 RF`));
  ok(enregistrer([{ op: 'supprimer', entite: 'monnaie', cle: { id } }]));
  assert.ok(!corps(PAGE_DE_L_INVENTAIRE).includes(`RA${process.pid}`));
});

test('composant créé à la fin de son tableau (ligne de l’onglet), puis supprimé : il quitte l’onglet, et l’inventaire d’une fiche le garde sous son nom', () => {
  const nom = nomLibre('Corde de chanvre');
  const r = enregistrer([{ op: 'creer', entite: 'composant', valeurs: { tableau: 'materiel:MATOS AVENTURES', nom, prix_brut: '3 RO', description: 'Une corde.' } }]);
  ok(r);
  const id = r.corps.crees[0].id;
  assert.ok(id.startsWith(`${PAGE_DE_L_INVENTAIRE}#materiel:`));
  const cree = ligne('SELECT * FROM ressource WHERE id = ?', id);
  assert.deepEqual([cree.section, cree.prix_rf], ['MATOS AVENTURES', 300]);
  assert.equal(cree.ordre, ligne("SELECT max(ordre) AS m FROM ressource WHERE section = 'MATOS AVENTURES'").m);
  assert.ok(lignesDe(PAGE_DE_L_INVENTAIRE).includes(`| ${nom} | 3 RO | Une corde. |`));
  assert.equal(enregistrer([{ op: 'creer', entite: 'composant', valeurs: { tableau: 'materiel:MATOS AVENTURES', nom } }]).statut, 409, 'nom pris');
  assert.equal(enregistrer([{ op: 'creer', entite: 'composant', valeurs: { tableau: 'potion', nom: 'X' } }]).statut, 400, 'tableau inconnu');
  // une fiche qui l'a dans son sac
  const cree2 = appel('POST', '/api/personnages/', { ...ficheVide(`Témoin ${process.pid}`), inventaire: [{ rang: 1, nom, quantite: 2, ressource_id: id }] });
  assert.equal(cree2.statut, 201, JSON.stringify(cree2.corps));
  const fiche = cree2.corps.personnage.id;
  ok(enregistrer([{ op: 'supprimer', entite: 'composant', cle: { id } }]));
  assert.equal(ligne('SELECT 1 FROM ressource WHERE id = ?', id), undefined);
  assert.ok(!lignesDe(PAGE_DE_L_INVENTAIRE).includes(`| ${nom} | 3 RO | Une corde. |`));
  assert.deepEqual({ ...ligne('SELECT nom, quantite, ressource_id FROM personnage_inventaire WHERE personnage_id = ?', fiche) }, { nom, quantite: 2, ressource_id: null });
  // décision R60 : une note datée le dit (« objet supprimé de la base, veuillez la mettre à jour »)
  assert.match(ligne('SELECT notes FROM personnage WHERE id = ?', fiche).notes, new RegExp(`l’objet « ${nom} » \\(inventaire\\) a été supprimé de la base ; il reste dans la fiche sous son nom : veuillez la mettre à jour\\.`));
});

test('un composant cité par d’autres règles ne se supprime pas (un matériau des armures, une gemme d’accessoire)', () => {
  const fer = ligne("SELECT id FROM ressource WHERE genre = 'materiau' AND nom_cle = 'fer'");
  const r = enregistrer([{ op: 'supprimer', entite: 'materiau', cle: { ressource_id: fer.id } }]);
  assert.equal(r.statut, 409);
  assert.match(r.corps.erreur ?? JSON.stringify(r.corps), /armure/);
  const grenat = ligne("SELECT id FROM ressource WHERE genre = 'gemme' AND nom_cle = 'grenat'");
  assert.equal(enregistrer([{ op: 'supprimer', entite: 'gemme', cle: grenat }]).statut, 409);
});

/**
 * Une magie d'essai, sans gemme ni bois, ajoutée par SQL à `base` (une copie de la base à part, jamais data/rows ni `db`) : la base n'a
 * aucune autre magie sans gemme ni bois que le Potentiel Illimité, qui n'en aura jamais (décision R160). Sa page et sa ligne copient celles du Potentiel
 * Illimité (rien n'en est lu : seule la clé étrangère de gemme.magie_id et bois.magie_id compte).
 */
function magieDEssai(base) {
  const copier = (table, ligne) => {
    const colonnes = Object.keys(ligne);
    base.prepare(`INSERT INTO "${table}" (${colonnes.map((c) => `"${c}"`).join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...Object.values(ligne));
  };
  const slug = `essai-r160-${process.pid}`;
  const id = `magies/${slug}`;
  const nom = `Magie d’essai ${process.pid}`;
  copier('page', { ...base.prepare('SELECT * FROM page WHERE id = ?').get(POTENTIEL_ILLIMITE), id, slug, titre: nom, titre_cle: `magie-d-essai-${process.pid}` });
  copier('magie', {
    ...base.prepare('SELECT * FROM magie WHERE id = ?').get(POTENTIEL_ILLIMITE), id, nom, nom_cle: `magie-d-essai-${process.pid}`,
    ordre: base.prepare('SELECT max(ordre) AS m FROM magie').get().m + 1,
  });
  return id;
}

/**
 * Le journal de `base` rejoué sur une base neuve qui a la même magie d'essai (magieDEssai) : mêmes lignes de `tables`, mêmes corps des pages des
 * bâtons et des accessoires, aucun lot illisible. La base neuve est fermée.
 */
function rejouerSurUneBaseNeuve(base, tables) {
  const neuve = vivante();
  try {
    magieDEssai(neuve);
    neuve.exec('PRAGMA foreign_keys = OFF');
    neuve.exec('BEGIN');
    chargerJournal(neuve, journalExporte(base));
    const sortie = {};
    rejouerLeJournal(neuve, sortie);
    neuve.exec('COMMIT');
    assert.deepEqual(sortie.illisibles, []);
    for (const id of [PAGE_DES_BATONS, PAGE_DES_ACCESSOIRES]) assert.equal(corps(id, neuve), corps(id, base), id);
    for (const t of tables) assert.deepEqual(neuve.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), base.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), t);
  } finally {
    neuve.close();
  }
}

test('gemme et bois créés pour une magie qui n’en a pas (jamais le Potentiel Illimité : R160), puis supprimés ; le rejeu de leur journal les refait', () => {
  // décision R160 : le Potentiel Illimité n'a jamais de gemme ni de bois, et les autres magies de la base en ont déjà ; une magie d'essai dans une base
  // à part (le rejeu du journal de `db`, plus bas, ne la connaît pas), dont le journal est rejoué ici sur une base neuve qui a la même magie d'essai
  const base = vivante();
  try {
    const enr = (operations) => enregistrer(operations, base);
    const lire = (sql, ...p) => base.prepare(sql).get(...p);
    const magie = { id: magieDEssai(base) };
    const nomG = nomLibre('Quartz');
    const g = enr([{ op: 'creer', entite: 'gemme', valeurs: { magie_id: magie.id, nom: nomG, description: 'Une gemme.', prix_commune_brut: '20 RO', quart_commune_brut: '5 Ro' } }]);
    ok(g);
    const idG = g.corps.crees[0].id;
    assert.deepEqual({ ...lire('SELECT prix_commune_rf, quart_commune_rf FROM gemme WHERE ressource_id = ?', idG) }, { prix_commune_rf: 2000, quart_commune_rf: 500 });
    assert.equal(enr([{ op: 'creer', entite: 'gemme', valeurs: { magie_id: magie.id, nom: nomLibre('Autre') } }]).statut, 409, 'une gemme par magie');
    const nomB = nomLibre('Chêne');
    const b = enr([{ op: 'creer', entite: 'bois', valeurs: { magie_id: magie.id, nom: nomB, prix_brut: '10 RO' } }]);
    ok(b);
    const idB = b.corps.crees[0].id;
    ok(enr([{ op: 'modifier', table: 'gemme', cle: { ressource_id: idG }, valeurs: { prix_parfaite_brut: '90 RO' } }]));
    assert.equal(lire('SELECT prix_parfaite_rf FROM gemme WHERE ressource_id = ?', idG).prix_parfaite_rf, 9000);
    // le rejeu refait la gemme et le bois créés (et le prix modifié)
    const tables = ['ressource', 'gemme', 'bois', 'page_entite'];
    rejouerSurUneBaseNeuve(base, tables);
    ok(enr([
      { op: 'supprimer', entite: 'gemme', cle: { ressource_id: idG } },
      { op: 'supprimer', entite: 'bois', cle: { ressource_id: idB } },
    ]));
    for (const id of [idG, idB]) assert.equal(lire('SELECT 1 FROM ressource WHERE id = ?', id), undefined);
    // puis leur suppression
    rejouerSurUneBaseNeuve(base, tables);
  } finally {
    base.close();
  }
});

test('ingrédient créé à la fin de sa catégorie (sa ligne de la liste d’ingrédients), puis supprimé', () => {
  const nomI = nomLibre('Mûre');
  const i = enregistrer([{ op: 'creer', entite: 'ingredient', valeurs: { categorie: 'catalyseur', nom: nomI, type_brut: 'Fruit', affinite_brut: 'Santé' } }]);
  ok(i);
  const idI = i.corps.crees[0].id;
  assert.equal(ligne('SELECT affinite_id FROM ingredient_alchimie WHERE ressource_id = ?', idI).affinite_id, 'sante');
  assert.ok(lignesDe(PAGE_DES_INGREDIENTS).includes(`| ${nomI} | Fruit | Santé |`));
  ok(enregistrer([{ op: 'supprimer', entite: 'ingredient', cle: { ressource_id: idI } }]));
  assert.ok(!corps(PAGE_DES_INGREDIENTS).includes(nomI));
  assert.equal(ligne('SELECT 1 FROM ressource WHERE id = ?', idI), undefined);
});

test('ni HTML brut ni lien non sûr dans les pages qui écrivent un composant ; le RF et le RO gardent leur abréviation et leur valeur', () => {
  const objet = ligne("SELECT id FROM ressource WHERE page_id = ? AND section = 'MATOS AVENTURES' ORDER BY id LIMIT 1", PAGE_DE_L_INVENTAIRE);
  const r = enregistrer([{ op: 'modifier', table: 'ressource', cle: objet, valeurs: { description: '<img src=x onerror=alert(1)>' } }]);
  assert.equal(r.statut, 400, JSON.stringify(r.corps));
  assert.ok(!corps(PAGE_DE_L_INVENTAIRE).includes('onerror'));
  for (const [id, valeurs] of [['ro', { valeur_rf: 1000 }], ['ro', { abreviation: 'RX' }], ['rf', { abreviation: 'RFX' }]]) {
    assert.equal(enregistrer([{ op: 'modifier', table: 'monnaie', cle: { id }, valeurs }]).statut, 400, `${id} ${JSON.stringify(valeurs)}`);
  }
  ok(enregistrer([{ op: 'modifier', table: 'monnaie', cle: { id: 'ro' }, valeurs: { nom: 'Ricken d’or' } }]));
});

test('OBJETS_AU_CATALOGUE : exactement les tables des fiches qui citent une ressource ; à la reconstruction, l’objet d’une ressource disparue reste sous son nom', () => {
  const citent = TABLES_FICHES.filter((t) => db.prepare(`PRAGMA foreign_key_list("${t}")`).all().some((f) => f.table === 'ressource')).sort();
  assert.deepEqual(citent, Object.keys(OBJETS_AU_CATALOGUE).sort());
  const base = vivante();
  const r = base.prepare("SELECT id, nom FROM ressource WHERE page_id = ? AND section = 'AUTRES' ORDER BY id LIMIT 1").get(PAGE_DE_L_INVENTAIRE);
  const cree = traiter({ methode: 'POST', chemin: '/api/personnages/', entetes: { 'content-type': 'application/json' },
    corps: JSON.stringify({ ...ficheVide(`Témoin ${process.pid}`), inventaire: [{ rang: 1, nom: r.nom, quantite: 1, ressource_id: r.id }] }) }, { base: () => base, etat: () => ({}), edition: true });
  assert.equal(cree.statut, 201, JSON.stringify(cree.corps));
  const fiche = cree.corps.personnage.id;
  base.exec('PRAGMA foreign_keys = OFF');
  base.prepare('DELETE FROM ressource WHERE id = ?').run(r.id); // les nouvelles règles ne l'ont plus
  base.prepare('ATTACH DATABASE ? AS ancienne').run(cheminBase({ sansExemples: false }));
  const acc = retirerLesManquants(base);
  base.exec('DETACH DATABASE ancienne');
  assert.deepEqual(acc.get(fiche)?.retraits, [{ nature: 'objet', id: r.id, nom: r.nom, emplacement: 'inventaire' }], 'la note de la fiche (R60)');
  assert.deepEqual({ ...base.prepare('SELECT nom, ressource_id FROM personnage_inventaire WHERE personnage_id = ?').get(fiche) }, { nom: r.nom, ressource_id: null });
  base.close();
});

test('matériau (décision R62) : type d’après l’armure (sa fiche d’armure suit), « Autres » refusé pour un matériau d’armure ; créé avec son type, puis supprimé', () => {
  const titane = ligne("SELECT r.id, r.nom, m.type FROM ressource r JOIN materiau m ON m.ressource_id = r.id WHERE r.nom_cle = 'titane'");
  const autre = titane.type === 'Lourd' ? 'Intermédiaire' : 'Lourd';
  ok(enregistrer([{ op: 'modifier', table: 'materiau', cle: { ressource_id: titane.id }, valeurs: { type: autre } }]));
  assert.equal(ligne('SELECT type FROM materiau_armure WHERE ressource_id = ?', titane.id).type, autre, 'la fiche d’armure suit');
  assert.ok(lignesDe(PAGE_DES_ARMURES).some((l) => l.startsWith(`| ${titane.nom} |`) && l.includes(`| ${autre} |`)), 'la fiche des matières de la page des armures suit');
  assert.equal(enregistrer([{ op: 'modifier', table: 'materiau', cle: { ressource_id: titane.id }, valeurs: { type: 'Autres' } }]).statut, 400);
  ok(enregistrer([{ op: 'modifier', table: 'materiau', cle: { ressource_id: titane.id }, valeurs: { type: titane.type } }]));
  const nom = nomLibre('Adamantium');
  const r = enregistrer([{ op: 'creer', entite: 'materiau', valeurs: { nom, type: 'Autres', prix_brut: '500 RO', description: 'Essai.' } }]);
  ok(r);
  const id = r.corps.crees[0].id;
  assert.deepEqual({ ...ligne('SELECT r.prix_rf, m.type FROM ressource r JOIN materiau m ON m.ressource_id = r.id WHERE r.id = ?', id) }, { prix_rf: 50000, type: 'Autres' });
  ok(enregistrer([{ op: 'supprimer', entite: 'materiau', cle: { ressource_id: id } }]));
  assert.equal(ligne('SELECT 1 FROM materiau WHERE ressource_id = ?', id), undefined);
});

test('onglet (migration 0057) : son titre et sa note se modifient ; une note vidée devient NULL ; le titre est obligatoire ; ni création ni suppression', () => {
  // demande du propriétaire, 2026-10-17 : des onglets « modifiables et directement liés en base »
  const avant = ligne("SELECT * FROM composant_onglet WHERE id = 'bois'");
  const titre = `Bois ${process.pid}`;
  ok(enregistrer([{ op: 'modifier', table: 'composant_onglet', cle: { id: 'bois' }, valeurs: { titre, note: 'Une note\nsur deux lignes.' }, avant: { titre: avant.titre, note: avant.note } }]));
  assert.deepEqual({ ...ligne("SELECT titre, note, ordre FROM composant_onglet WHERE id = 'bois'") }, { titre, note: 'Une note\nsur deux lignes.', ordre: avant.ordre });
  ok(enregistrer([{ op: 'modifier', table: 'composant_onglet', cle: { id: 'bois' }, valeurs: { note: '' } }]));
  assert.equal(ligne("SELECT note FROM composant_onglet WHERE id = 'bois'").note, null);
  assert.equal(enregistrer([{ op: 'modifier', table: 'composant_onglet', cle: { id: 'bois' }, valeurs: { titre: '  ' } }]).statut, 400);
  assert.equal(enregistrer([{ op: 'modifier', table: 'composant_onglet', cle: { id: 'bois' }, valeurs: { ordre: 1 } }]).statut, 400, 'la place ne se modifie pas');
  assert.equal(enregistrer([{ op: 'creer', entite: 'composant_onglet', valeurs: { titre: 'X' } }]).statut, 400);
  // le titre d'avant revient (le rejeu ci-dessous compare aussi la table)
  ok(enregistrer([{ op: 'modifier', table: 'composant_onglet', cle: { id: 'bois' }, valeurs: { titre: avant.titre, note: avant.note } }]));
  assert.deepEqual({ ...ligne("SELECT * FROM composant_onglet WHERE id = 'bois'") }, { ...avant });
});

test('prixEnRf : l’écriture des prix des composants', () => {
  assert.equal(prixEnRf('1 000 RF / 10 RO'), 1000);
  assert.equal(prixEnRf('0,6 Ro'), 60);
  assert.equal(prixEnRf('800 RF / 80 RO'), null);
  assert.equal(prixEnRf(null), null);
});

test('rejeu du journal (livraison) : les mêmes lignes et les mêmes corps de pages sur des règles neuves', () => {
  const journal = journalExporte(db);
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const sortie = {};
  rejouerLeJournal(neuve, sortie);
  neuve.exec('COMMIT');
  assert.deepEqual(sortie.illisibles, []);
  for (const id of [PAGE_DE_L_INVENTAIRE, PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS, PAGE_DES_BATONS, PAGE_DES_ACCESSOIRES, PAGE_DES_INGREDIENTS, 'ressources/armes']) {
    assert.equal(corps(id, neuve), corps(id), id);
  }
  for (const t of ['ressource', 'materiau', 'materiau_arme', 'materiau_armure', 'gemme', 'bois', 'ingredient_alchimie', 'affinite', 'monnaie', 'page_entite', 'composant_onglet']) {
    assert.deepEqual(neuve.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), t);
  }
  neuve.close();
});
