// Le titre de la page d'une race ou d'une classe suit son nom (décision R316 (6)) : un lot qui change `race.nom` ou `classe.nom` (voie générique
// `ecrire_modifier`, serveur/edition.mjs) fait suivre le titre de la page s'il le portait encore, puis l'adresse suit en fin de lot (edition-adresses.mjs) et le
// mot-clé ancré avec elle. Un titre retouché à la main n'est pas écrasé. L'annulation (une ligne, puis le lot) rend l'état d'avant ; le rejeu donne la même base.
// Un seul cas, un seul dépôt : la mise en place d'un lot déposé coûte. Petite base de test/aide-ancrage.mjs, noms inventés.
//   node --test test/serveur-edition-adresses-races-classes.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { annuler, annulerUneLigne, lire } from '../serveur/edition-lots.mjs';
import { CATEGORIE_RACIALE } from '../src/lib/classe-champs.mjs';
import { nomDeTable } from '../src/lib/libelles-de-la-base.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { nom, outilsDesCas, photo, TOUS_LES_VERROUS } from './aide-adresses-lots.mjs';
import { ancrerUnMotCle, poserClasse, poserRace } from './aide-ancrage.mjs';

const { cas, deposerDirect } = outilsDesCas('edition-adresses-races-classes');

/** La photo d'un renommage (titres, segments, anciennes adresses, mots-clés), plus la clé des titres et le nom des races et des classes. */
const photoDe = (db) => ({
  ...photo(db),
  cles: db.prepare('SELECT id, titre_cle FROM page ORDER BY id').all().map((p) => ({ ...p })),
  elements: db.prepare('SELECT id, nom, NULL AS nom_cle FROM race UNION ALL SELECT id, nom, nom_cle FROM classe ORDER BY id').all().map((e) => ({ ...e })),
});

/** La page `id`, son mot-clé `motCle` (son nom et son adresse, lus sur son élément depuis la migration 0136) et ses anciennes adresses. */
const etat = (db, { id, motCle }) => ({
  page: { ...db.prepare('SELECT titre, titre_cle, slug_adresse FROM page WHERE id = ?').get(id) },
  motCle: (({ libelle, url }) => ({ libelle, url }))(lireUnMotCle(db, motCle)),
  anciennes: db.prepare('SELECT adresse FROM page_ancienne_adresse WHERE page_id = ? ORDER BY adresse').all(id).map((a) => a.adresse),
});

/** Ce qu'un renommage de `avant` en `apres` laisse sur la page `type/…` qui portait l'ancien nom. */
const renommee = (type, avant, apres) => ({
  page: { titre: apres, titre_cle: normalize(apres), slug_adresse: normalize(apres) },
  motCle: { libelle: apres, url: `/${type}/${normalize(apres)}/` },
  anciennes: [`${type}/${normalize(avant)}/`],
});

/** L'opération d'un lot qui renomme l'élément `table`/`id` (le nom, et sa clé pour une classe : une race n'en a pas). */
const renommage = (table, id, avant, apres) => {
  const cle = (n) => (table === 'classe' ? { nom_cle: normalize(n) } : {});
  return { table, cle: { id }, operation: 'modifier', avant: { nom: avant, ...cle(avant) }, apres: { nom: apres, ...cle(apres) } };
};

test('R316 (6) : un lot renomme une race et une classe à mot-clé ancré : titre, adresse, ancienne adresse et mot-clé suivent ; un titre retouché à la main ne bouge pas ; une classe raciale garde le segment de sa race ; annuler la ligne de la race, puis le lot, rend l’état d’avant ; le journal rejoué donne la même base', () => cas(
  (db) => {
    const ancre = (id, categorie) => ({ id, motCle: ancrerUnMotCle(db, 'page', id, { categories: [categorie] }) });
    const monde = {
      race: ancre(poserRace(db, 'races/zephyrion-elfe', nom('Elfe')), 'Race'),
      classe: ancre(poserClasse(db, 'classes/zephyrion-mage', nom('Mage')), 'Classe'),
      retouchee: ancre(poserRace(db, 'races/zephyrion-gnome', nom('Gnome')), 'Race'),
      raciale: (poserRace(db, 'races/zephyrion-lezard', nom('Lézard')), ancre(poserClasse(db, 'classes/zephyrion-lezard', nom('Lézard'), { categorie: CATEGORIE_RACIALE }), 'Classe')),
    };
    db.prepare('UPDATE page SET titre = ? WHERE id = ?').run(nom('Peuple gnome'), monde.retouchee.id);
    // les lignes que le rejeu contrôle (clés étrangères des lignes que le lot touche) : la famille que la copie pose, les catégories des classes
    db.exec("UPDATE race SET origine = 'docs'; UPDATE classe SET origine = 'docs'; UPDATE page_entite SET origine = 'docs'");
    ['essai', CATEGORIE_RACIALE].forEach((id, i) => db.prepare("INSERT INTO categorie_classe (id, libelle, ordre, origine, source_ref) VALUES (?, ?, ?, 'docs', '')").run(id, id, i + 1));
    return monde;
  },
  async (m) => {
    const { race, classe, retouchee, raciale } = m.monde;
    const depart = photoDe(m.db);
    const [avantRace, avantRetouchee] = [etat(m.db, race), etat(m.db, retouchee)];
    const fait = await deposerDirect(m, [
      renommage('race', race.id, nom('Elfe'), nom('Sylve')),
      renommage('classe', classe.id, nom('Mage'), nom('Sorcier')),
      renommage('race', retouchee.id, nom('Gnome'), nom('Kobold')),
      renommage('classe', raciale.id, nom('Lézard'), nom('Ophidien')),
    ], { verrous_ouverts: TOUS_LES_VERROUS }, 'createur');
    assert.equal(fait.etat, 'applique', JSON.stringify(fait.refus ?? null));
    assert.deepEqual(etat(m.db, race), renommee('races', nom('Elfe'), nom('Sylve')), 'la race');
    assert.deepEqual(etat(m.db, classe), renommee('classes', nom('Mage'), nom('Sorcier')), 'la classe (titre = nom)');
    assert.deepEqual(etat(m.db, retouchee), avantRetouchee, 'titre retouché à la main : ni le titre, ni l’adresse, ni le mot-clé ne bougent');
    assert.deepEqual(etat(m.db, raciale), {
      page: { titre: nom('Ophidien'), titre_cle: normalize(nom('Ophidien')), slug_adresse: null },
      motCle: { libelle: nom('Ophidien'), url: '/classes/zephyrion-lezard/' },
      anciennes: [],
    }, 'la classe raciale : le titre suit, l’adresse reste celle de sa race');

    // la ligne de la race seule : son groupe (la page, l'ancienne adresse, le mot-clé) revient avec elle
    const lignes = lire(m.db, fait.id).lignes;
    const ligneDeLaRace = lignes.find((l) => l.table === nomDeTable('race')); // la première race du lot : celle qui porte un mot-clé
    assert.ok(ligneDeLaRace, JSON.stringify(lignes.map((l) => [l.n, l.table])));
    annulerUneLigne(m.db, fait.id, ligneDeLaRace.n);
    assert.deepEqual(etat(m.db, race), avantRace, 'la race : titre, segment, anciennes adresses et mot-clé d’avant');
    assert.deepEqual(photoDe(m.db).elements.find((e) => e.id === race.id), depart.elements.find((e) => e.id === race.id), 'le nom de la race');
    assert.deepEqual(etat(m.db, classe), renommee('classes', nom('Mage'), nom('Sorcier')), 'la classe reste renommée');

    annuler(m.db, fait.id);
    assert.deepEqual(photoDe(m.db), depart, 'le lot entier annulé : la photo complète d’avant');

    const neuve = ouvrirBaseVivante(m.depart);
    try {
      neuve.exec('PRAGMA foreign_keys = OFF');
      neuve.exec('BEGIN');
      chargerJournal(neuve, journalExporte(m.db));
      const bilan = rejouerLeJournal(neuve, {});
      neuve.exec('COMMIT');
      assert.equal(bilan.conflits, 0, JSON.stringify(bilan).slice(0, 2000));
      assert.deepEqual(photoDe(neuve), photoDe(m.db), 'le journal rejoué (le renommage, puis ses annulations)');
    } finally {
      neuve.close();
    }
  },
));
