// Migration data/migrations/0111-relecture-des-regles-contre-les-decisions.sql (registre 0111-relecture-des-regles-contre-les-decisions.json,
// `textes` : une entrée par remplacement, avec sa correction C1 à C25 du cahier de game-design et sa décision ; `titres`, `alias`, `mots_cles_crees`,
// `constantes`) : les pages des Règles relues contre les décisions (R224 à R227 et celles qu'elles appliquent) et la réponse G43 ; R224 (1) : les copies
// de source sont corrigées là où elles contredisent une décision ; R225 : la santé du Potentiel Illimité, contrôlée par v_personnage_controle.
// Lecture seule de la base construite, sauf le test de R225, qui écrit ses fiches dans une copie.
// Ces textes (corps et résumés des pages du guide) sont modifiables sur le site de dev, source de ce qu'il modifie : ce que la 0111 a écrit se lit
// dans l'état de la migration (baseDImport({ garder: lotsAvant('0111') }), skill tests-conventions) ; aucun texte courant n'est figé. Les tests portent
// sur ce que la migration garantit : chaque fragment en place, les libellés de liens égaux au titre de la page visée, les balises canoniques, plus de
// numéro de décision dans les deux pages, l'AP et l'AM écrits égaux à ceux de la table armure.
//   node --test test/db-0111-relecture-des-regles.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { adresseDuGuide } from '../src/lib/livres.mjs';
import { formeCanonique, formesNonCanoniques, lireBalises } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { baseDImport, cheminDImport, lotsAvant } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { casDeSantePotentiel, CONSTANTE_SANTE_POTENTIEL, MAGIE_POTENTIEL, plafondDeSantePotentiel } from './aide-sante-potentiel.mjs';

const NOM = '0111-relecture-des-regles-contre-les-decisions';
const registre = JSON.parse(readFileSync(new URL(`../../data/migrations/${NOM}.json`, import.meta.url), 'utf8'));
const migration = readFileSync(new URL(`../../data/migrations/${NOM}.sql`, import.meta.url), 'utf8');
const apresLa0111 = () => baseDImport({ garder: lotsAvant('0111') });
const valeur = (db, t) => db.prepare(`SELECT "${t.col}" AS v FROM "${t.table}" WHERE id = ?`).get(t.cle.id)?.v;
// les copies de source (R224 (1) : liste V1 du §10 de docs/sql/a-valider.md, et les copies du Doc « Guide pour MJ » que V2 et V3 citent) : la 0111 ne
// les touche que par C18 et C19, chaque fois sous une décision
const COPIES = ['guide/formule-des-degats', 'guide/attaque-et-defense', 'guide/les-attaques-discretes', 'guide/les-portes', 'guide/alignement',
  'guide/jet-de-des', 'metiers/regles-des-metiers'];
const estUneCopie = (id) => COPIES.includes(id) || id.startsWith('guide/fiche-');
/** Le mot-clé de chaque ref et la page où mène son adresse, dans `db`. */
function cibles(db) {
  const index = indexDesAdresses(db, { exemples: true });
  return new Map(motsClesDeLaBase(db).map((m) => [m.id, { ...m, page: m.url ? pageDeLAdresse(index, m.url) : null }]));
}
/** Les balises que le remplacement `t` écrit (celles de `apres` absentes de `avant`). */
const balisesEcrites = (t) => lireBalises(t.apres, { markdown: true }).filter((b) => !t.avant.includes(b.brut));

test('0111 : le registre ne touche que le corps ou le résumé de pages des Règles ; une copie de source seulement par C18 et C19 (R224) ; C1 à C25, chacune sous sa décision quand elle en a une', () => {
  assert.equal(registre.migration, NOM);
  for (const t of registre.textes) {
    assert.equal(t.table, 'page', t.cle.id);
    assert.ok(t.col === 'corps_md' || t.col === 'resume', `${t.cle.id} : ${t.col}`);
    assert.ok(t.cle.id.startsWith('guide/') || estUneCopie(t.cle.id), t.cle.id);
    assert.notEqual(t.avant, t.apres, t.cle.id);
    assert.match(t.correction, /^C(2[0-5]|1[0-9]|[1-9])$/, t.cle.id);
    if (estUneCopie(t.cle.id)) {
      assert.ok(['C18', 'C19'].includes(t.correction), `${t.cle.id} : une copie ne change que par C18 ou C19`);
      assert.ok(t.decision, `${t.cle.id} : sous une décision`);
    }
    if (t.decision !== null) {
      for (const d of t.decision.match(/R\d+|G\d+/g)) assert.ok([...registre.decisions, ...registre.reponses].includes(d), `${t.correction} : ${d} listée`);
    }
    // la garde de la migration : un UPDATE par entrée, sur la page de l'entrée
    assert.ok(migration.includes(`WHERE id = '${t.cle.id}' AND length(${t.col})`), `${t.correction} ${t.cle.id}`);
  }
  // C23 (le titre) n'est pas un remplacement de texte : registre `titres`
  assert.deepEqual([...new Set([...registre.textes, ...registre.titres].map((t) => t.correction))].sort((a, b) => a.slice(1) - b.slice(1)),
    Array.from({ length: 25 }, (_, i) => `C${i + 1}`), 'les 25 corrections du cahier');
  assert.deepEqual(registre.titres.map((t) => t.correction), ['C23']);
  assert.equal(migration.match(/^UPDATE page SET /gm).length, registre.textes.length + registre.titres.length, 'une mise à jour gardée par entrée du registre');
  // R224 (4) (« Rien ajouter ») : la phrase du plafond du Potentiel Illimité n'est plus ajoutée à guide/premiers-sorts
  assert.ok(!registre.textes.some((t) => t.correction === 'C11' && t.cle.id === 'guide/premiers-sorts'));
});

test('0111 : chaque remplacement est en place dans l’état de la migration (le fragment écrit présent, l’ancien absent)', () => {
  const imp = apresLa0111();
  assert.equal(imp.prepare('PRAGMA user_version').get().user_version >= 111, true);
  for (const t of registre.textes) {
    const v = valeur(imp, t);
    assert.equal(typeof v, 'string', `${t.cle.id} présent`);
    assert.ok(v.includes(t.apres), `${t.correction} ${t.cle.id} : « ${t.apres.slice(0, 60)}… »`);
    if (!t.apres.includes(t.avant)) assert.ok(!v.includes(t.avant), `${t.correction} ${t.cle.id} : l’ancien fragment reste`);
  }
});

test('G43 (C3) : plus de numéro « (décision R…) » dans le texte de guide/les-postures et guide/l-equipement, dans l’état de la migration', () => {
  const imp = apresLa0111();
  const c3 = registre.textes.filter((t) => t.correction === 'C3');
  assert.deepEqual([...new Set(c3.map((t) => t.cle.id))].sort(), ['guide/l-equipement', 'guide/les-postures']);
  for (const t of c3) {
    // seule la parenthèse part : le reste du fragment est gardé
    assert.match(t.avant, / \(décision R\d+\)/, t.cle.id);
    assert.equal(t.avant.replace(/ \(décision R\d+\)/, ''), t.apres, t.cle.id);
  }
  for (const id of ['guide/les-postures', 'guide/l-equipement']) {
    const page = imp.prepare('SELECT corps_md, resume FROM page WHERE id = ?').get(id);
    assert.doesNotMatch(`${page.corps_md}\n${page.resume ?? ''}`, /\(décision R\d+\)/, id);
  }
});

test('R184 (2), (5), (11), R187 (1) (C4 à C8) : le texte affiché d’un lien que la 0111 écrit est le titre de la page où mène son mot-clé', () => {
  const imp = apresLa0111();
  const mc = cibles(imp);
  const titre = (id) => imp.prepare('SELECT titre FROM page WHERE id = ?').get(id)?.titre;
  const liens = registre.textes.filter((t) => ['C4', 'C5', 'C6', 'C7', 'C8'].includes(t.correction));
  assert.ok(liens.length > 0);
  for (const t of liens) {
    const ecrites = balisesEcrites(t);
    assert.equal(ecrites.length, 1, `${t.correction} ${t.cle.id} : une balise réécrite`);
    const [b] = ecrites;
    const m = mc.get(b.ref);
    assert.ok(m?.page, `${t.correction} ${b.ref} : un mot-clé qui mène à une page`);
    assert.equal(b.texte ?? m.libelle, titre(m.page), `${t.correction} ${t.cle.id} : ${b.brut} -> ${m.page}`);
    // le mot-clé ne change pas, seul le texte affiché (identifiants figés)
    assert.ok(lireBalises(t.avant, { markdown: true }).some((a) => a.ref === b.ref), `${t.correction} : même mot-clé`);
  }
  // C6 : plus aucun lien « Créer son personnage » des pages du guide ne mène ailleurs qu’à l’introduction de la création
  const ailleurs = [];
  for (const p of imp.prepare("SELECT id, corps_md FROM page WHERE id LIKE 'guide/%' AND instr(corps_md, '|Créer son personnage}}') > 0").all()) {
    for (const b of lireBalises(p.corps_md, { markdown: true })) {
      if (b.texte === 'Créer son personnage' && mc.get(b.ref)?.page !== 'guide/creer-son-personnage') ailleurs.push(`${p.id} ${b.brut}`);
    }
  }
  assert.deepEqual(ailleurs, []);
});

test('0111 : chaque balise écrite vise un mot-clé qui a une adresse (C11, C17 : Potentiel Illimité, armes, armures, bouclier, ceinture, accessoires) ; les cellules réécrites restent canoniques', () => {
  const imp = apresLa0111();
  const mc = cibles(imp);
  const vocabulaire = motsClesDeLaBase(imp);
  const refs = new Set(registre.textes.flatMap((t) => balisesEcrites(t).map((b) => b.ref)));
  for (const ref of ['potentiel-illimite', 'armes', 'armures', 'bouclier', 'ceinture', 'accessoires', 'armurier', 'les-neuf-alignements', ...registre.mots_cles_crees.map((m) => m.id)]) {
    assert.ok(refs.has(ref), ref);
  }
  for (const ref of refs) assert.ok(mc.get(ref)?.url, `${ref} : un mot-clé à adresse`);
  // chaque balise écrite l'est sous la forme que le service garde (texteAvecMotsClesCanoniques) : « {{id}} » quand le texte est le libellé du mot-clé,
  // sinon « {{id|texte}} » ; une modification du site de dev ne la réécrit donc pas (serveur-edition-conflits.test.mjs)
  for (const t of registre.textes) {
    for (const b of balisesEcrites(t)) assert.equal(formeCanonique(b.brut, vocabulaire, { markdown: true }).texte, b.brut, `${t.correction} ${t.cle.id} : ${b.brut}`);
  }
  for (const t of registre.textes) {
    assert.deepEqual(formesNonCanoniques(valeur(imp, t), vocabulaire, { markdown: t.col === 'corps_md' }), [], `${t.correction} ${t.cle.id}.${t.col}`);
  }
});

test('C15 : l’AP et l’AM écrits pour l’armure écailles et bois sont ceux de la ligne « Armure Bois/Écailles » de la table armure (état de la migration)', () => {
  // la migration écrit un texte fixe, lu dans la table à la version 110 : la comparaison se fait dans l'état de la migration (le site peut changer l'un
  // et l'autre depuis)
  const imp = apresLa0111();
  const [t] = registre.textes.filter((x) => x.correction === 'C15');
  const [, ap, am] = /écailles et bois (\d+) AP et (\d+) AM/.exec(t.apres).map(Number);
  const armure = imp.prepare("SELECT ap, am FROM armure WHERE id = 'ressources/armures#armure:armure-bois-ecailles'").get();
  assert.deepEqual([ap, am], [armure.ap, armure.am]);
});

test('R224 (2) : le mot-clé créé par la 0111 mène à sa page, porte son titre, sans définition, verrouillé comme tout mot-clé à adresse (0110)', () => {
  const imp = apresLa0111();
  const mc = cibles(imp);
  assert.ok(registre.mots_cles_crees.length > 0);
  for (const c of registre.mots_cles_crees) {
    const m = mc.get(c.id);
    assert.ok(m, c.id);
    assert.equal(m.page, c.page, `${c.id} : son adresse mène à ${c.page}`);
    assert.equal(m.libelle, imp.prepare('SELECT titre FROM page WHERE id = ?').get(c.page).titre, `${c.id} : libellé = titre de la page`);
    const ligne = imp.prepare('SELECT description, verrou FROM mot_cle WHERE id = ?').get(c.id);
    assert.deepEqual([ligne.description, ligne.verrou], [null, 1], c.id);
    // une seule adresse mène à la page (sinon un lien saisi vers elle serait ambigu : lib/mots-cles-liens.mjs#motsClesDeLAdresse)
    assert.deepEqual([...mc.values()].filter((x) => x.page === c.page).map((x) => x.id), [c.id]);
  }
});

test('R226 (4) (C23) : la page du Mode Super a le titre de la décision, différent de son titre d’avant, qui reste en alias ; id, adresse et entrée du menu inchangés', () => {
  const imp = apresLa0111();
  for (const t of registre.titres) {
    assert.notEqual(t.avant, t.apres);
    const page = imp.prepare('SELECT id, slug, titre, titre_cle FROM page WHERE id = ?').get(t.cle.id);
    assert.ok(page, `${t.cle.id} : même identifiant`);
    assert.equal(page.titre, t.apres, t.cle.id);
    assert.equal(page.slug, t.cle.id.slice(t.cle.id.indexOf('/') + 1), 'adresse inchangée');
    const alias = imp.prepare('SELECT texte FROM alias WHERE page_id = ?').all(t.cle.id).map((a) => a.texte);
    assert.ok(alias.includes(t.avant), `${t.cle.id} : l'ancien titre en alias`);
    // l'entrée du menu latéral ne porte que l'id de la page : son libellé est le titre (skill zone-guide)
    const entree = imp.prepare('SELECT libelle FROM regles_onglet_entree WHERE page_id = ?').get(t.cle.id);
    assert.ok(entree, `${t.cle.id} : rangée dans un onglet`);
    assert.equal(entree.libelle, null, 'le libellé de l’entrée vient du titre');
  }
  assert.deepEqual(registre.alias.map((a) => [a.page_id, a.texte]), registre.titres.map((t) => [t.cle.id, t.avant]));
});

// R225 : la règle gains_sante_potentiel de v_personnage_controle, sur des fiches d'essai écrites dans une copie de la base à l'état de la migration
// (data/rows garde les fiches vides). Le plafond et les cas viennent de test/aide-sante-potentiel.mjs, qui lit la donnée : aucune valeur n'est écrite ici.
test('R225 : un Potentiel Illimité inné qui met plus de N santé par niveau sur ses points d’attributs, dé bonus en plus, est signalé ; à la limite ou sous elle, non ; une autre magie innée, jamais', () => {
  const copie = fichierTemporaire('maverick.db', 'r225');
  copyFileSync(cheminDImport({ garder: lotsAvant('0111') }), copie);
  const db = new DatabaseSync(copie);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const n = db.prepare('SELECT valeur FROM regle_constante WHERE id = ?').get(CONSTANTE_SANTE_POTENTIEL);
    assert.ok(n && n.valeur > 0, 'la donnée de R225');
    assert.ok(registre.constantes.some((c) => c.id === CONSTANTE_SANTE_POTENTIEL && c.decision === 'R225'));
    const autre = db.prepare('SELECT id FROM magie WHERE id <> ? ORDER BY id LIMIT 1').get(MAGIE_POTENTIEL).id;
    const instant = '2026-11-08T12:00:00Z';
    const fiche = (id, magie, xp, gainsSante) => db.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, nom, mode_classe, xp,
      alignement_loyal, alignement_chaotique, alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le,
      magie_innee_id, gains_sante, gains_chakra) VALUES (?, 'pretire', NULL, 'tous', ?, 'mono', ?, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, 0)`)
      .run(id, id, xp, instant, instant, magie, gainsSante);
    const regle = (id) => db.prepare("SELECT detail FROM v_personnage_controle WHERE personnage_id = ? AND regle = 'gains_sante_potentiel'").all(id)
      .map((r) => r.detail);
    const cas = casDeSantePotentiel(db);
    // niveaux 1 (rien à répartir), 4 (des points, pas de dé) et 5 (le premier dé) : sous la limite, à la limite, au-dessus
    assert.deepEqual([...new Set(cas.map((c) => c.niveau))], [1, 4, 5]);
    assert.equal(plafondDeSantePotentiel(db, 1), 0, 'au niveau 1, aucun point d’attributs');
    assert.ok(plafondDeSantePotentiel(db, 5) > plafondDeSantePotentiel(db, 4) + n.valeur, 'au niveau 5, le dé bonus s’ajoute au plafond');
    for (const [i, c] of cas.entries()) {
      fiche(`pi-${i}`, MAGIE_POTENTIEL, c.xp, c.gains_sante);
      assert.deepEqual(regle(`pi-${i}`), c.signale ? [`${c.gains_sante} / ${c.plafond}`] : [], `niveau ${c.niveau}, ${c.gains_sante} santé`);
      // une autre magie innée : la règle ne la vise pas
      fiche(`autre-${i}`, autre, c.xp, c.gains_sante);
      assert.deepEqual(regle(`autre-${i}`), [], `${autre}, niveau ${c.niveau}`);
    }
    // la règle suit la donnée : relevée d'un point, la santé juste au-dessus de l'ancien plafond au niveau 4 n'est plus signalée
    const auDessus = cas.find((c) => c.niveau === 4 && c.signale);
    db.prepare('UPDATE regle_constante SET valeur = valeur + 1 WHERE id = ?').run(CONSTANTE_SANTE_POTENTIEL);
    assert.deepEqual(regle(`pi-${cas.indexOf(auDessus)}`), []);
  } finally {
    db.close();
  }
});

test('R228 : le mot-clé mode-super mène à la page du Mode Super, à l’adresse que le site lui donne (lib/livres.mjs#adresseDuGuide), verrouillé comme tout mot-clé à adresse', () => {
  const imp = apresLa0111();
  const mc = cibles(imp);
  assert.ok(registre.mots_cles.length > 0);
  for (const m of registre.mots_cles) {
    assert.equal(m.decision, 'R228');
    const ligne = imp.prepare('SELECT url, verrou FROM mot_cle WHERE id = ?').get(m.id);
    assert.ok(ligne, m.id);
    assert.equal(ligne.url, `/${adresseDuGuide(m.page)}`, `${m.id} : l'adresse de ${m.page}`);
    assert.equal(ligne.verrou, 1, `${m.id} : un mot-clé à adresse est verrouillé (0110)`);
    assert.equal(mc.get(m.id).page, m.page, `${m.id} : son adresse mène à ${m.page}`);
    assert.deepEqual([...mc.values()].filter((x) => x.page === m.page).map((x) => x.id), [m.id], 'une seule adresse mène à la page');
  }
});
