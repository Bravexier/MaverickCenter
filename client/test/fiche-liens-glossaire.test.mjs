// Le type de dégâts choisi d'une arme, dans le résumé « Arme » de la fiche, lié au glossaire (migration 0125, demande du propriétaire : « Tous les liens communs,
// j'aimerais que tu les lies aux mots clés (ceux du glossaire) », « si ils existent » ; sa réponse « ok reco » : les commandes de la fiche — le menu du type, les
// pastilles de magie — restent sans lien, le texte affiché porte le gras et l'infobulle). `regles.liens` (lib/mots-cles-des-valeurs.mjs) donne le mot-clé de
// chaque type de dégâts et de chaque magie ; lib/fiche-moteur.mjs#typeDeDegatsAffiche en tire ce que scripts/fiche.mjs#motCleAffiche dessine.
// Le site de dev change les mots-clés (clé, libellé, définition, couleur) : le mot-clé se lit par l'id de la valeur dans la base courante, jamais écrit ici.
//   node --test test/fiche-liens-glossaire.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { typeDeDegatsAffiche } from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // telles que la page les reçoit
const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
// le nom et la définition se lisent sur l'élément du mot-clé (page, sort ou repère : migration 0136)
const motCle = (id) => lireUnMotCle(db, id);

test('un type physique lié à son mot-clé : son libellé de la page, la couleur du mot-clé, le libellé puis la définition en infobulle', () => {
  const types = db.prepare('SELECT id, mot_cle_id FROM type_degats WHERE magie_id IS NULL AND mot_cle_id IS NOT NULL ORDER BY id').all();
  assert.ok(types.length > 0, 'des types physiques liés');
  for (const t of types) {
    const m = motCle(t.mot_cle_id);
    const r = typeDeDegatsAffiche(regles, t.id, `nom-de-la-page-${t.id}`);
    assert.equal(r.motCle, true, t.id);
    assert.equal(r.texte, `nom-de-la-page-${t.id}`, `${t.id} : le libellé de la page, pas celui du mot-clé`);
    assert.equal(r.classe, regles.liens.degats[t.id].classe, `${t.id} : la classe de la palette du mot-clé`);
    assert.ok(r.classe === null || /^couleur-/.test(r.classe), `${t.id} : jamais une couleur écrite`);
    const definition = String(m.description ?? '').replace(/\{\{[^}|]+\|([^}]+)\}\}/g, '$1').trim();
    if (definition) assert.ok(r.infobulle.startsWith(`${m.libelle}\n`) && r.infobulle.length > m.libelle.length + 1, `${t.id} : « libellé », puis sa définition`);
    else assert.equal(r.infobulle, '', `${t.id} : un mot-clé sans définition est en gras sans bulle`);
  }
});

test('feu, eau, glace et une magie : le nom court de la magie (jamais « Magie du … »), la couleur et l\'infobulle de son mot-clé', () => {
  const liees = db.prepare('SELECT id, nom, mot_cle_id FROM magie WHERE mot_cle_id IS NOT NULL ORDER BY ordre').all();
  assert.ok(liees.length > 0, 'des magies liées');
  for (const g of liees) {
    const m = motCle(g.mot_cle_id);
    const r = typeDeDegatsAffiche(regles, g.id, 'autre');
    assert.deepEqual({ texte: r.texte, motCle: r.motCle }, { texte: g.nom, motCle: true }, `${g.id} : son nom court`);
    assert.ok(r.infobulle === '' || r.infobulle.startsWith(`${m.libelle}\n`), `${g.id} : l'infobulle de son mot-clé`);
  }
  // un type de dégâts d'une magie (type_degats.magie_id : feu, eau, glace) : le même rendu que sa magie
  for (const t of db.prepare('SELECT id, magie_id FROM type_degats WHERE magie_id IS NOT NULL ORDER BY id').all()) {
    assert.deepEqual(typeDeDegatsAffiche(regles, t.id, 'autre'), typeDeDegatsAffiche(regles, t.magie_id, 'autre'), `${t.id} : celui de sa magie`);
  }
});

test('une valeur sans mot-clé, ou une fiche sans `liens`, reste nue : rien n\'est deviné', () => {
  const nu = (id, nom) => ({ texte: nom, motCle: false, classe: null, infobulle: '' });
  for (const t of db.prepare('SELECT id FROM type_degats WHERE mot_cle_id IS NULL AND magie_id IS NULL').all()) assert.deepEqual(typeDeDegatsAffiche(regles, t.id, 'Physique'), nu(t.id, 'Physique'), t.id);
  for (const g of db.prepare('SELECT id, nom FROM magie WHERE mot_cle_id IS NULL').all()) assert.deepEqual(typeDeDegatsAffiche(regles, g.id, g.nom), nu(g.id, g.nom), g.id);
  assert.deepEqual(typeDeDegatsAffiche({}, 'estoc', 'Estoc'), nu('estoc', 'Estoc'), 'sans liens');
  assert.deepEqual(typeDeDegatsAffiche(undefined, 'estoc', 'Estoc'), nu('estoc', 'Estoc'), 'sans règles');
  assert.deepEqual(typeDeDegatsAffiche({ liens: { degats: {}, magies: {} } }, 'inconnu', 'Inconnu'), nu('inconnu', 'Inconnu'), 'un type inconnu');
  assert.equal(typeDeDegatsAffiche(regles, 'inconnu').texte, 'inconnu', 'sans nom, l\'id');
});

test('un mot-clé décrit : libellé et définition ; non décrit : gras sans infobulle ; sans couleur : pas de classe', () => {
  const liens = { degats: {
    decrit: { libelle: 'Libellé', description: ' La définition. ', classe: 'couleur-degats-x', texte: null },
    vide: { libelle: 'Libellé', description: '', classe: null, texte: null },
    court: { libelle: 'Magie du Feu', description: 'Définition', classe: null, texte: 'Feu' },
  }, magies: {} };
  assert.deepEqual(typeDeDegatsAffiche({ liens }, 'decrit', 'Page'), { texte: 'Page', motCle: true, classe: 'couleur-degats-x', infobulle: 'Libellé\nLa définition.' });
  assert.deepEqual(typeDeDegatsAffiche({ liens }, 'vide', 'Page'), { texte: 'Page', motCle: true, classe: null, infobulle: '' });
  assert.deepEqual(typeDeDegatsAffiche({ liens }, 'court', 'Page'), { texte: 'Feu', motCle: true, classe: null, infobulle: 'Magie du Feu\nDéfinition' });
});

test('la page (src/scripts/fiche.mjs, lue comme un texte) : le résumé de l\'arme dessine le mot-clé en gras, sans lien ni tabindex, couleur par classe, définition en infobulle ; les commandes restent sans lien', () => {
  const source = /function motCleAffiche\([\s\S]*?\n}\n/.exec(script)?.[0];
  assert.ok(source, 'motCleAffiche');
  const faux = (tag, attrs = {}, ...enfants) => ({ tag, attrs, enfants, title: '' });
  const motCleAffiche = new Function('el', `${source}\nreturn motCleAffiche;`)(faux);
  const e = motCleAffiche({ texte: 'Feu', classe: 'couleur-magie-feu', infobulle: 'Magie du Feu\nDéfinition' });
  assert.equal(e.tag, 'strong');
  assert.equal(e.attrs.class, 'mot-cle couleur-magie-feu');
  assert.deepEqual(e.enfants, ['Feu']);
  assert.equal(e.title, 'Magie du Feu\nDéfinition');
  assert.ok(!('href' in e.attrs) && !('tabindex' in e.attrs) && !('style' in e.attrs), 'ni lien, ni tabindex, ni style');
  const sans = motCleAffiche({ texte: 'Estoc', classe: null, infobulle: '' });
  assert.equal(sans.attrs.class, 'mot-cle');
  assert.equal(sans.title, '', 'pas de bulle sans définition');
  // un seul usage dans la page : le résumé ; les options du menu du type (commande) sont écrites sans lui
  assert.equal(script.match(/motCleAffiche\(/g).length, 2, 'sa définition et le résumé de l\'arme');
  assert.equal(script.match(/typeDeDegatsAffiche\(/g).length, 1, 'le résumé de l\'arme seul');
  const menu = /typeDegats\.replaceChildren\([^\n]*\n/.exec(script)?.[0] ?? '';
  assert.ok(menu && !menu.includes('motCle') && !menu.includes('typeDeDegatsAffiche'), 'le menu du type de dégâts reste sans lien');
});
