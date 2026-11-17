// Décision R195 : « Un mot clé peut toujours être changé [dans] tous les champs (sauf l'id technique clé primaire dans la table, jamais affichée) / Pas
// [d']exception » : le libellé d'un mot-clé dont le site se sert (lib/mots-cles.mjs#MOTS_CLES_PROTEGES : colonnes de /classes/, « race hybride »,
// « classe », « race », « métier », « codex », « capacité de classe », « Sort grenade », « Sort fer ») se modifie comme les autres. Le site les reconnaît
// à leur id, jamais à leur écriture : un renommage ne déplace aucune page (rangement de /classes/ et de /races/, couleur d'une classe) ni ne change aucun
// calcul (règles de la fiche, classe magique, races hybrides sans classe raciale) ; une page créée depuis le site reçoit les mêmes mots-clés. Depuis les
// décisions R218 et R219 (2), ces mots-clés sont verrouillés (mot_cle.verrou = 1 : aucun champ ne se modifie depuis le site,
// test/serveur-edition-verrou.test.mjs) : ce test lève leur verrou dans sa copie de la base, pour garder la preuve que le site les reconnaît à leur id
// (un admin pourra lever un verrou : R218 (4)).
//   node --test test/mots-cles-r195.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { racesHybridesSansClasse } from '../serveur/edition.mjs';
import { groupClasses } from '../src/lib/class-groups.mjs';
import { MOT_CLE_DE_CATEGORIE } from '../src/lib/classe-champs.mjs';
import { isMagicalClass } from '../src/lib/classe-magique.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { IDS_DES_MOTS_CLES_PROTEGES as ID } from '../src/lib/mots-cles-proteges.mjs';
import { avecLesMotsCles, lirePages, motsClesDesPages } from '../src/lib/pages-db.mjs';
import { classeDUneClasse } from '../src/lib/palette-css.mjs';
import { groupRaces, TAG_RACE_HYBRIDE } from '../src/lib/race-kinds.mjs';
import { chargerRaces, racesParNature } from '../src/lib/races-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const dossier = dossierTemporaire('mots-cles-r195');
const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(dossier, 'db') }).chemin);
// le verrou des mots-clés dont le site se sert, levé dans la copie (décision R218 (4) : seul un admin le changera ; ici, la base d'essai)
const PROTEGES = [...MOTS_CLES_PROTEGES.keys()];
db.prepare(`UPDATE mot_cle SET verrou = 0 WHERE id IN (${PROTEGES.map(() => '?').join(', ')})`).run(...PROTEGES);
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
const enregistrer = (operations, page = 'regles/glossaire/') => appel('POST', '/api/edition/', { page, operations });
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
/** Une écriture qu'aucun mot-clé, aucune race ni aucune classe n'a. */
const libre = (base) => {
  let t = base;
  const prise = (n) => motsClesDeLaBase(db).some((m) => normalize(m.libelle) === n || m.cle === n || m.synonymes.some((x) => normalize(x) === n));
  for (let i = 2; prise(normalize(t)) || ligne('SELECT 1 FROM page WHERE titre_cle = ?', normalize(t)) || ligne('SELECT 1 FROM peuple WHERE nom_cle = ?', normalize(t)); i += 1) t = `${base} ${i}`;
  return t;
};
const renommer = (id, libelle) => ({ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle }, avant: { libelle: ligne('SELECT libelle FROM mot_cle WHERE id = ?', id).libelle } });

/** Les pages de classes et de races comme le build les reçoit : le `tags:` du `.md` (lirePages, libellés) et leurs mots-clés par id (lib/wiki.ts). */
const pagesDuSite = () => avecLesMotsCles(lirePages(db).filter((p) => ['classes', 'races'].includes(p.type) && p.statut !== 'example')
  .map((p) => ({ id: p.id, data: { title: p.titre, tags: p.tags } })), motsClesDesPages(db));

/** Ce que le site range ou calcule d'après les mots-clés dont il se sert (jamais un texte : des ids, des clés de catégorie, des classes de couleur). */
function lecture() {
  const pages = pagesDuSite();
  const classes = pages.filter((p) => p.id.startsWith('classes/'));
  const fiche = chargerReglesDeFiche(db);
  return {
    classes: groupClasses(classes).map((g) => [g.key, g.sections.map((s) => [s.key, s.entries.map((e) => e.id)])]),
    couleurs: classes.map((c) => [c.id, classeDUneClasse(c)]),
    magiques: classes.filter((c) => isMagicalClass(pages, c)).map((c) => c.id),
    races: groupRaces(pages).map((g) => [g.key, g.entries.map((e) => e.id)]),
    natures: Object.fromEntries(Object.entries(racesParNature(db)).map(([k, v]) => [k, v.map((r) => r.id)])),
    hybrides: [...chargerRaces(db).races.values()].filter((r) => r.hybride).map((r) => r.id).sort(),
    sansClasse: racesHybridesSansClasse(db).map((r) => r.id),
    ficheClasses: fiche.classes.map((c) => [c.id, c.groupe.key, c.classe]),
    ficheRaces: fiche.races.map((r) => [r.id, r.nature, r.classe]),
    sorts: fiche.sorts.filter((s) => s.mots_cles).map((s) => [s.id, [...s.mots_cles].sort(), s.fer ?? false]),
  };
}

test('R195 : chaque mot-clé dont le site se sert se renomme ; aucune page ne change de place, aucun calcul ne change, la protection reste', () => {
  const avant = lecture();
  const presents = [...MOTS_CLES_PROTEGES.keys()].filter((id) => ligne('SELECT 1 FROM mot_cle WHERE id = ?', id));
  assert.ok(['codex', 'classe', 'race', 'magique', 'hybride-animal', 'sort-fer'].every((nom) => presents.includes(ID[nom])), presents.join());
  const nouveaux = new Map();
  for (const id of presents) {
    const libelle = libre(`Renommé ${id}`);
    ok(enregistrer([renommer(id, libelle)]));
    nouveaux.set(id, libelle);
  }
  for (const [id, libelle] of nouveaux) assert.equal(ligne('SELECT libelle FROM mot_cle WHERE id = ?', id).libelle, libelle, id);
  // le `tags:` des pages construites montre les nouveaux libellés (le renommage a bien eu lieu)…
  const classe = pagesDuSite().find((p) => p.id.startsWith('classes/') && p.data.mots_cles.includes('magique'));
  assert.ok(classe.data.tags.includes(nouveaux.get(ID.magique)), classe.id);
  assert.ok(!classe.data.tags.some((t) => normalize(t) === 'magique'), 'plus l’écriture d’origine');
  // …et rien de ce que le site range ou calcule ne bouge
  assert.deepEqual(lecture(), avant);
  // « codex » reste mentionné (les pages du Codex le portent : décision R196), il ne se supprime pas
  assert.equal(enregistrer([{ op: 'supprimer', entite: 'mot_cle', cle: { id: ID.codex } }]).statut, 409);
});

test('R195 : l’écriture qu’un mot-clé dont le site se sert a quittée se reprend, par un mot-clé créé ou renommé, sans rien déplacer', () => {
  const avant = lecture();
  assert.notEqual(normalize(ligne('SELECT libelle FROM mot_cle WHERE id = ?', ID.magique).libelle), 'magique', 'renommé par le test précédent');
  // un mot-clé créé sous l'écriture d'origine de « magique » : un autre id, non protégé
  const cree = ok(enregistrer([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'magique' } }])).crees[0].id;
  assert.notEqual(cree, ID.magique);
  assert.equal(MOTS_CLES_PROTEGES.has(cree), false);
  // un mot-clé renommé vers l'écriture d'origine de « codex » (le refus d'avant R195 est levé)
  const autre = ok(enregistrer([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libre('Essai R195') } }])).crees[0].id;
  ok(enregistrer([renommer(autre, 'codex')]));
  assert.deepEqual(lecture(), avant);
  // l'un et l'autre se suppriment (rien ne les mentionne)
  ok(enregistrer([{ op: 'supprimer', entite: 'mot_cle', cle: { id: cree } }]));
  ok(enregistrer([{ op: 'supprimer', entite: 'mot_cle', cle: { id: autre } }]));
});

test('R195 : une race hybride et une classe créées depuis le site après ces renommages reçoivent les mêmes mots-clés (par leur id), rangées comme avant', () => {
  // la race hybride : « race » et « race hybride » (créé avec elle s'il manque, sous son id), puis « race hybride » renommé
  const nom = libre('Lycan R195');
  const race = ok(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom, nature: 'hybride' } }], 'races/')).crees[0].id;
  // « race hybride » n'a pas d'id dans lib/mots-cles-proteges.mjs : créé avec la race (l'id suivant, verrouillé : décision R220 (2)), il se reconnaît
  // par sa clé ; il n'est donc pas renommé ici (son verrou le garde ; un renommage changerait sa clé, réponse du leader-technique du 2026-11-08)
  const hybride = ligne('SELECT id, verrou FROM mot_cle WHERE cle = ?', TAG_RACE_HYBRIDE);
  assert.equal(hybride?.verrou, 1);
  assert.deepEqual(db.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? ORDER BY ordre').all(race).map((t) => t.tag_id), [ID.race, hybride.id]);
  const lu = lecture();
  assert.ok(lu.natures.hybrides.includes(race) && lu.hybrides.includes(race) && lu.sansClasse.includes(race), 'parmi les races hybrides sans classe raciale');
  assert.ok(lu.races.find(([g]) => g === 'hybrides')[1].includes(race), '/races/ : parmi les hybrides');
  assert.equal(lu.ficheRaces.find(([id]) => id === race)?.[1], 'hybride', 'la fiche');
  // une classe de chaque catégorie : rangée dans sa colonne de /classes/, son mot-clé de catégorie par son id
  const colonne = { 'classe-physique-corps-a-corps': 'melee', 'classe-physique-distance': 'distance', 'classe-magique': 'magiques', 'classe-hybride': 'speciales', 'classe-speciale': 'speciales' };
  for (const [categorie, attendue] of Object.entries(colonne)) {
    const id = ok(enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: categorie, nom: libre(`Classe R195 ${categorie}`) } }], 'classes/')).crees[0].id;
    assert.deepEqual(db.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? ORDER BY ordre').all(id).map((t) => t.tag_id), [ID.classe, ID[MOT_CLE_DE_CATEGORIE[categorie]]], categorie);
    const rangee = lecture().classes.find(([, sections]) => sections.some(([, ids]) => ids.includes(id)))?.[0];
    assert.equal(rangee, attendue, `${categorie} : sa colonne de /classes/`);
  }
});
