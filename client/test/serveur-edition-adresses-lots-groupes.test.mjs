// L'annulation d'une ligne d'un renommage qui déplace l'adresse (décision R316, serveur/edition-lots.mjs#lignesEmportees) : la ligne de la page, ses lignes
// d'ancienne adresse et les mots-clés dont l'adresse l'a suivie forment un groupe ; annuler n'importe laquelle de ces lignes rend d'un coup le titre, le segment,
// les anciennes adresses et l'adresse des mots-clés, sans problème de contrôle en plus. Une ligne du groupe retouchée depuis le lot garde le groupe entier,
// avec son motif. Petite base de test/aide-ancrage.mjs, noms inventés.
//   node --test test/serveur-edition-adresses-lots-groupes.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErreurEdition } from '../serveur/edition.mjs';
import { annulerUneLigne, lire, previsualiserLAnnulation } from '../serveur/edition-lots.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { adresseDesRegles, nom, numerosDe, outilsDesCas, photo, poserUnePageDesRegles } from './aide-adresses-lots.mjs';
import { DECOUVRIR } from '../src/lib/livres.mjs';
import { ancrerUnMotCle, poserMotCle, poserPageLisible } from './aide-ancrage.mjs';

const { cas, renommerParUnLot, renommerSurLeSite } = outilsDesCas('edition-adresses-lots-groupes');

/** Les lignes du lot appliqué `id` (edition-lots.mjs#lire). */
const lignesDuLot = (m, id) => lire(m.db, id).lignes;

test('R316 : annuler la ligne de la page, celle du mot-clé ancré ou celle de l’ancienne adresse d’un renommage emporte tout le groupe de l’adresse', () => cas(
  (db) => ({ pages: ['Alpha', 'Beta', 'Gamma'].map((s) => poserUnePageDesRegles(db, nom(s))) }),
  async (m) => {
    const depart = photo(m.db);
    const visees = ['page', 'mot_cle', 'page_ancienne_adresse'];
    const lots = [];
    for (const [i, s] of ['Alpha', 'Beta', 'Gamma'].entries()) {
      const fait = await renommerParUnLot(m, m.monde.pages[i].id, nom(s), nom(`${s}bis`));
      assert.equal(fait.etat, 'applique', JSON.stringify(fait.refus ?? null));
      lots.push(fait.id);
    }
    assert.notDeepEqual(photo(m.db), depart);
    for (const [i, table] of visees.entries()) {
      const lignes = lignesDuLot(m, lots[i]);
      const [numero] = numerosDe(lignes, table);
      assert.ok(numero, `${table} : ${JSON.stringify(lignes.map((l) => l.table))}`);
      const visee = lignes.find((l) => l.n === numero);
      assert.equal(visee.annulable_seule, true, `${table} : ${visee.motif}`);
      annulerUneLigne(m.db, lots[i], numero);
      assert.ok(lignesDuLot(m, lots[i]).filter((l) => numerosDe([l], 'mot_cle_ancienne_cle').length === 0).every((l) => l.etat === 'annulee'),
        `${table} : ${JSON.stringify(lignesDuLot(m, lots[i]).map((l) => [l.table, l.etat]))}`);
      // la page et son mot-clé sont revenus
      const { id, motCle } = m.monde.pages[i];
      const ici = photo(m.db);
      assert.deepEqual(ici.pages.find((p) => p.id === id), depart.pages.find((p) => p.id === id), table);
      assert.deepEqual(ici.motsCles.find((k) => k.id === motCle), depart.motsCles.find((k) => k.id === motCle), table);
      assert.deepEqual(ici.anciennes.filter((a) => a.page_id === id), [], table);
    }
    assert.deepEqual(photo(m.db), depart, 'les trois renommages annulés, une ligne chacun');
  },
));

// La page d'une magie ne se renomme pas par un lot déposé (seules les pages du guide et du Codex s'y modifient, et le nom de la magie ne change pas le titre de sa
// page) : le mot-clé d'un sort (`/magies/<page>/#sort-<slug>`) y est figuré par un mot-clé qui mène à une section de la page renommée, sous la même règle
// (lib/adresses-db.mjs#adresseQuiSuit : le chemin suit, l'ancre est gardée).
test('R316 : annuler la ligne de la page rend aussi l’adresse d’un mot-clé qui mène à une section de la page (comme celui d’un sort), son ancre gardée', () => cas(
  (db) => {
    const page = poserUnePageDesRegles(db, nom('Feu'));
    const section = poserMotCle(db, { libelle: nom('Braise'), url: `${adresseDesRegles(nom('Feu'))}#braise`, categories: ['Règles'] });
    return { ...page, section };
  },
  async (m) => {
    const { id, section } = m.monde;
    const depart = photo(m.db);
    const fait = await renommerParUnLot(m, id, nom('Feu'), nom('Flamme'));
    assert.equal(fait.etat, 'applique', JSON.stringify(fait.refus ?? null));
    const url = (k) => lireUnMotCle(m.db, k).url; // lue sur l'élément du mot-clé (migration 0136)
    assert.equal(url(section), `${adresseDesRegles(nom('Flamme'))}#braise`);
    // le mot-clé ancré (sa clé suit le titre) et celui de la section, dont l'adresse se lit sur son repère (migration 0136)
    assert.equal(numerosDe(lignesDuLot(m, fait.id), 'mot_cle').length, 1, 'la clé du mot-clé ancré');
    assert.equal(numerosDe(lignesDuLot(m, fait.id), 'repere').length, 1, 'l’adresse du mot-clé de la section');
    const [numero] = numerosDe(lignesDuLot(m, fait.id), 'page');
    annulerUneLigne(m.db, fait.id, numero);
    assert.deepEqual(photo(m.db), depart, 'la page, son ancienne adresse et les deux mots-clés reviennent');
  },
));

// La page Bienvenue est servie par une route fixe (lib/metiers.mjs#pageARouteFixe) : son titre change sans que son adresse bouge, aucun groupe d'adresse. Son
// mot-clé lit son nom sur elle (migration 0136) : annuler la ligne du titre doit en recalculer la clé, sans quoi les contrôles du contenu refusent l'annulation.
test('annuler seule la ligne du titre d’une page ancrée dont l’adresse ne bouge pas : acceptée, le nom et la clé du mot-clé reviennent', () => cas(
  (db) => {
    const id = poserPageLisible(db, DECOUVRIR.accueil, nom('Accueil'));
    return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Règles'] }) };
  },
  async (m) => {
    const { id, motCle } = m.monde;
    const depart = photo(m.db);
    const cleDAvant = lireUnMotCle(m.db, motCle).cle;
    const fait = await renommerParUnLot(m, id, nom('Accueil'), nom('Seuil'));
    assert.equal(fait.etat, 'applique', JSON.stringify(fait.refus ?? null));
    assert.equal(lireUnMotCle(m.db, motCle).libelle, nom('Seuil'));
    assert.notEqual(lireUnMotCle(m.db, motCle).cle, cleDAvant, 'la clé a suivi le titre');
    assert.deepEqual(photo(m.db).anciennes, [], 'l’adresse n’a pas bougé');
    // la ligne du mot-clé, dans les lignes du lot et dans l'aperçu de son annulation, se nomme par le nom qu'il lit sur sa page
    const [ligneDeCle] = numerosDe(lignesDuLot(m, fait.id), 'mot_cle');
    assert.ok(lignesDuLot(m, fait.id).find((l) => l.n === ligneDeCle).ligne.includes(nom('Seuil')), JSON.stringify(lignesDuLot(m, fait.id).map((l) => l.ligne)));
    const vu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier });
    const apercu = vu.operations.find((o) => o.rang_du_lot === ligneDeCle)?.apercu;
    assert.match(apercu?.ligne ?? '', /Zephyrion/, JSON.stringify(apercu ?? vu.operations)); // son nom (celui du moment de la remise), pas son numéro
    const [numero] = numerosDe(lignesDuLot(m, fait.id), 'page');
    annulerUneLigne(m.db, fait.id, numero);
    assert.equal(lireUnMotCle(m.db, motCle).cle, cleDAvant, 'la clé est revenue');
    assert.deepEqual(photo(m.db), depart, 'le titre et le nom sont revenus');
  },
));

test('R316 : une ligne du groupe de l’adresse retouchée depuis le lot garde tout le groupe en place, avec son motif', () => cas(
  (db) => ({ page: poserUnePageDesRegles(db, nom('Delta')) }),
  async (m) => {
    const { id } = m.monde.page;
    const fait = await renommerParUnLot(m, id, nom('Delta'), nom('Deltabis'));
    assert.equal(fait.etat, 'applique', JSON.stringify(fait.refus ?? null));
    // une seconde saisie sur le site : le titre change de casse, l'adresse ne bouge pas
    renommerSurLeSite(m, id, nom('Deltabis').toUpperCase());
    const lignes = lignesDuLot(m, fait.id);
    const groupe = ['page', 'mot_cle', 'page_ancienne_adresse'].flatMap((t) => numerosDe(lignes, t));
    assert.equal(groupe.length, 3, JSON.stringify(lignes.map((l) => l.table)));
    const motifs = new Set(lignes.filter((l) => groupe.includes(l.n)).map((l) => l.motif));
    assert.equal(motifs.size, 1, JSON.stringify([...motifs]));
    assert.ok([...motifs][0], 'un motif');
    assert.ok(lignes.filter((l) => groupe.includes(l.n)).every((l) => l.annulable_seule === false));
    const avant = photo(m.db);
    for (const numero of groupe) {
      // refusée (409 : rien à remettre), ou acceptée sans rien écrire ; toute autre erreur fait échouer le test
      try {
        annulerUneLigne(m.db, fait.id, numero);
      } catch (e) {
        assert.ok(e instanceof ErreurEdition && e.statut === 409, `ligne ${numero} : ${e?.stack ?? e}`);
      }
      assert.deepEqual(photo(m.db), avant, `ligne ${numero} : le groupe reste en place`);
    }
  },
));
