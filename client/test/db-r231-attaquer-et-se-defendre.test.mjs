// Décision R231 du propriétaire (2026-11-08), appliquée par la migration data/migrations/0112-r231-attaquer-et-se-defendre.sql (registre
// 0112-r231-attaquer-et-se-defendre.json : `textes`, `mots_cles_crees`, `mots_cles_colores`, `renvois`). Lecture seule de la base construite.
//   - (1) guide/attaquer-et-se-defendre porte l'attaque, guide/attaque-et-defense la défense ; ids et adresses figés, l'ancien titre en alias, et
//     l'alias « Localisation des dégâts » passe à la page de l'attaque, qui porte le tableau ; les renvois des autres pages visent la page qui porte
//     maintenant le texte ; le mot-clé (verrouillé) de chaque page suit son titre.
//   - (4) les mots-clés de la fiche : chaque compétence de la table `competence` (Magie sous l'id magie-competence) et chaque caractéristique ont le
//     leur, de la couleur de leur caractéristique ; cinq notions ; aucun n'est verrouillé (R219 (5)).
// Les textes, titres, alias et mots-clés non verrouillés sont modifiables sur le site de dev, source de ce qu'il modifie : ce que la 0112 a écrit se lit
// dans l'état de la migration (baseDImport({ garder: lotsAvant('0112') }), skill tests-conventions), comparé au registre et aux tables, jamais à un
// texte écrit ici. `competence`, `caracteristique` et `magie.caracteristique_id` ne sont écrits ni par lib/edition-modele.mjs ni par le service.
// L'état courant ne garde que des invariants : les mots-clés verrouillés des deux pages y mènent.
//   node --test test/db-r231-attaquer-et-se-defendre.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ancresDuCorps } from '../src/lib/ancres-figees.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { lireBalises } from '../src/lib/mots-cles-balises.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';
import { avecLesClesDe, idDuMotCleNomme } from './aide-mots-cles.mjs';
import { fragmentRetireParLeSite } from './aide-fragments-du-site.mjs';

const NOM = '0112-r231-attaquer-et-se-defendre';
const registre = JSON.parse(readFileSync(new URL(`../../data/migrations/${NOM}.json`, import.meta.url), 'utf8'));
const apresLa0112 = () => baseDImport({ garder: lotsAvant('0112') });
const ATTAQUE = 'guide/attaquer-et-se-defendre';
const DEFENSE = 'guide/attaque-et-defense';
const adresse = (pageId) => `/${cheminDePage(pageId)}`;
/** L'id du mot-clé d'une compétence (R231 (4) : Magie prend magie-competence, sinon l'importeur des magies poserait l'étiquette « magie »). */
const idDeCompetence = (id) => (id === 'magie' ? 'magie-competence' : id);
/** Les ids des mots-clés que citent les balises d'un texte. */
const cites = (texte, markdown = false) => lireBalises(texte, { markdown }).map((b) => b.ref);
// Le registre de la 0112 nomme un mot-clé par son id texte d'alors, que ses balises citent ; depuis la migration 0113, l'id est un entier figé (le
// registre de la 0113 fait le pont : idDuMotCleNomme), les balises citent la clé (avecLesClesDe) et l'abréviation est un synonyme (0115).
const idDe = (table, id) => (table === 'mot_cle' ? idDuMotCleNomme(id) : id);
const cellule = (db, t) => db.prepare(`SELECT "${t.col}" AS v FROM "${t.table}" WHERE id = ?`).get(idDe(t.table, t.cle.id))?.v;
const motCle = (db, ancienId) => db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(idDuMotCleNomme(ancienId));
const cleDe = (db, ancienId) => motCle(db, ancienId)?.cle;
/**
 * Le fragment `fragment` est dans `texte`, ses balises écrites avec la clé d'aujourd'hui (avecLesClesDe) ou telles que la migration les a écrites : une
 * cellule que le site de dev a réécrite depuis reprend, dans la base d'import, l'« avant » de son lot, que le site écrivait avec ses anciennes clés.
 */
const contientLeFragment = (db, texte, fragment) => texte.includes(avecLesClesDe(db, fragment)) || texte.includes(fragment);
let baseCourante;
/** Le fragment de `t`, écrit par la 0112, retiré depuis par un lot du site (test/aide-fragments-du-site.mjs ; balises aussi à la clé d'aujourd'hui). */
const retireParLeSite = (t, fragment) => {
  baseCourante ??= ouvrirBase();
  return fragmentRetireParLeSite(baseCourante, { table: t.table, cle: { id: idDe(t.table, t.cle.id) }, col: t.col }, fragment,
    { lotsAvant: lotsAvant('0112'), ecritures: [fragment, avecLesClesDe(baseCourante, fragment)] });
};
const sansSynonyme = (db, m) => db.prepare('SELECT count(*) AS n FROM mot_cle_synonyme WHERE mot_cle_id = ?').get(m.id).n === 0;

test('R231 (4) : chaque compétence de la fiche a son mot-clé, de la couleur de sa caractéristique, sans adresse, abréviation ni verrou ; sa définition reprend sa phrase et cite sa caractéristique', () => {
  const db = apresLa0112();
  const competences = db.prepare('SELECT id, nom, caracteristique_id, description FROM competence ORDER BY ordre').all();
  assert.equal(competences.length, db.prepare('SELECT count(*) AS n FROM competence').get().n);
  assert.ok(competences.length > 0);
  const colores = new Map(registre.mots_cles_colores.map((m) => [m.id, m]));
  for (const c of competences) {
    const id = idDeCompetence(c.id);
    const m = motCle(db, id);
    assert.ok(m, `${c.id} : son mot-clé ${id}`);
    assert.equal(m.couleur, `caracteristique:${c.caracteristique_id}`, id);
    assert.equal(m.url, null, `${id} : sans adresse`);
    assert.ok(sansSynonyme(db, m), `${id} : sans abréviation`);
    assert.equal(m.verrou, 0, `${id} : R219 (5)`);
    if (colores.has(id)) {
      // Parade et Esquive existaient : id et définition gardés, seule la couleur change
      assert.equal(colores.get(id).couleur, m.couleur, id);
      assert.ok(!registre.mots_cles_crees.some((x) => x.id === id), id);
      continue;
    }
    assert.ok(registre.mots_cles_crees.some((x) => x.id === id && x.competence === c.id), `${id} : créé par la 0112`);
    assert.equal(m.cle, normalize(m.libelle));
    if (c.id !== 'magie') assert.equal(m.libelle, c.nom, id);
    else assert.equal(m.cle, id, 'la compétence Magie : un libellé distinct de l’étiquette « magie » des pages de magie');
    // la phrase de la compétence (le point final près, ajouté à une phrase qui n'en a pas), puis la balise de sa caractéristique, la dernière
    assert.ok(m.description.startsWith(c.description), `${id} : sa phrase`);
    assert.equal(cites(m.description).at(-1), cleDe(db, c.caracteristique_id), `${id} : sa caractéristique`);
  }
  // l'étiquette « magie » que tools/sheets/magies.py écrit sur les pages de magie n'a pas de mot-clé (un import ne pose qu'une écriture connue)
  assert.equal(db.prepare("SELECT count(*) AS n FROM mot_cle WHERE cle = 'magie'").get().n, 0);
});

test('R231 (4) : chaque caractéristique a son mot-clé, de sa couleur ; sa définition cite ses compétences et les magies innées qui lui donnent son +1', () => {
  const db = apresLa0112();
  const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique ORDER BY ordre').all();
  assert.ok(caracteristiques.length > 0);
  for (const k of caracteristiques) {
    const m = motCle(db, k.id);
    assert.ok(m, k.id);
    assert.deepEqual([m.libelle, m.couleur, m.url, sansSynonyme(db, m), m.verrou], [k.nom, `caracteristique:${k.id}`, null, true, 0], k.id);
    assert.ok(registre.mots_cles_crees.some((x) => x.id === k.id && x.caracteristique === k.id), k.id);
    const refs = cites(m.description);
    const competences = db.prepare('SELECT id FROM competence WHERE caracteristique_id = ? ORDER BY ordre').all(k.id).map((c) => cleDe(db, idDeCompetence(c.id)));
    // le mot-clé de chaque magie innée de la caractéristique : celui qui mène à sa page (jamais `sang`, la barre)
    const magies = db.prepare("SELECT k.cle FROM magie m JOIN mot_cle k ON k.url = '/' || m.id || '/' WHERE m.caracteristique_id = ? ORDER BY m.ordre").all(k.id)
      .map((r) => r.cle);
    assert.ok(magies.length > 0, `${k.id} : une magie innée au moins`);
    assert.deepEqual(refs, [cleDe(db, 'caracteristiques'), ...competences, ...magies], k.id);
  }
});

test('R231 (4) : les mots-clés créés et modifiés — ceux du registre, verrou 0, adresse du registre ; l’ancre que le cahier visait existe dans sa page', () => {
  const db = apresLa0112();
  const ids = registre.mots_cles_crees.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of registre.mots_cles_crees) {
    const m = motCle(db, r.id);
    assert.ok(m, r.id);
    assert.deepEqual([m.libelle, m.couleur, m.url, m.verrou], [r.libelle, r.couleur, r.url, 0], r.id);
    assert.ok(m.description, `${r.id} : décrit`);
    for (const ref of cites(m.description)) assert.ok(db.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(ref), `${r.id} cite ${ref}`);
    // une adresse donnée par le cahier (non posée : question à game-design) vise une ancre figée de la page
    if (r.url_du_cahier) {
      const [chemin, ancre] = r.url_du_cahier.split('#');
      const page = [ATTAQUE, DEFENSE].find((p) => adresse(p) === chemin);
      assert.ok(page, `${r.id} : ${chemin}`);
      assert.ok(ancresDuCorps(cellule(db, { table: 'page', col: 'corps_md', cle: { id: page } })).some((a) => a.ancre === ancre), `${r.id} : #${ancre}`);
    }
  }
  // chaque texte réécrit (corps entier, fragment ou libellé) est en place dans l'état de la migration
  for (const t of registre.textes) {
    assert.notEqual(t.avant, t.apres, t.cle.id);
    const v = cellule(db, t);
    assert.equal(typeof v, 'string', `${t.table} ${t.cle.id}.${t.col}`);
    if (!contientLeFragment(db, v, t.apres) && retireParLeSite(t, t.apres)) continue; // le site l'a retiré depuis : sa cellule est au site
    assert.ok(contientLeFragment(db, v, t.apres), `${t.table} ${t.cle.id}.${t.col} (${t.decision})`);
  }
  // la copie du Doc « Guide pour MJ » (sommaire) n'est pas réécrite
  assert.ok(!registre.textes.some((t) => t.cle.id === 'guide/guide-pour-mj-maverick'));
});

test('R231 (1) : titres, anciens titres en alias, « Localisation des dégâts » sur la page de l’attaque ; le mot-clé de chaque page suit son titre', () => {
  const db = apresLa0112();
  for (const id of [ATTAQUE, DEFENSE]) {
    const titre = registre.textes.find((t) => t.table === 'page' && t.cle.id === id && t.col === 'titre');
    assert.ok(titre, id);
    const page = db.prepare('SELECT titre, titre_cle FROM page WHERE id = ?').get(id);
    assert.deepEqual([page.titre, page.titre_cle], [titre.apres, normalize(titre.apres)], id);
    // l'ancien titre en alias (R184 (2))
    assert.ok(db.prepare('SELECT 1 FROM alias WHERE page_id = ? AND cle = ?').get(id, normalize(titre.avant)), `${id} : ancien titre en alias`);
    // le mot-clé de la page (son adresse y mène) prend le titre ; verrouillé, id et adresse inchangés
    const m = db.prepare('SELECT * FROM mot_cle WHERE url = ?').get(adresse(id));
    assert.deepEqual([m.libelle, m.cle, m.verrou], [page.titre, normalize(page.titre), 1], id);
  }
  assert.deepEqual(db.prepare('SELECT page_id FROM alias WHERE cle = ?').all(normalize('Localisation des dégâts')).map((r) => r.page_id), [ATTAQUE]);
});

test('R231 : les renvois des autres pages visent la page qui porte maintenant le texte (état de la migration)', () => {
  const db = apresLa0112();
  assert.ok(registre.renvois.length > 0);
  for (const r of registre.renvois) {
    assert.ok(registre.textes.some((t) => t.table === r.table && t.cle.id === r.cle.id && t.col === r.col && t.apres === r.apres), `${r.cle.id} : dans textes`);
    if (!contientLeFragment(db, cellule(db, r), r.apres) && retireParLeSite(r, r.apres)) continue; // le site l'a retiré depuis
    assert.ok(contientLeFragment(db, cellule(db, r), r.apres), r.cle.id);
    // les balises du renvoi qui mènent à l'une des deux pages mènent à celle qu'il vise
    const vers = cites(r.apres, true).map((ref) => motCle(db, ref)?.url).filter((u) => [ATTAQUE, DEFENSE].map(adresse).includes(u));
    assert.deepEqual([...new Set(vers)], [adresse(r.vers)], `${r.cle.id} : ${r.apres}`);
  }
  // chacune des deux pages reçoit au moins un renvoi
  assert.deepEqual([...new Set(registre.renvois.map((r) => r.vers))].sort(), [DEFENSE, ATTAQUE].sort());
});

test('aujourd’hui : les mots-clés verrouillés des deux pages y mènent toujours', () => {
  const db = ouvrirBase({ sansExemples: false });
  for (const id of [ATTAQUE, DEFENSE]) {
    const m = motCle(db, id.slice('guide/'.length));
    assert.deepEqual([m?.url, m?.verrou], [adresse(id), 1], id);
  }
});
