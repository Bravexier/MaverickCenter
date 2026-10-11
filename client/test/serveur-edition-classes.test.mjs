// Édition des classes depuis le site de dev (client/serveur/edition.mjs) : don de départ, présentation, maîtrises et inventaire (tables de détail
// recalculées : lib/classe-champs.mjs), spécialités et dons (leur fiche suit) ; création d'une classe dans une catégorie, et d'une classe raciale pour
// une race hybride qui n'en a pas (demande du propriétaire).
// La base vivante part des règles de data/rows, où le site de dev a pu créer ou renommer : les données d'essai ont des noms absents de la base, et
// l'état attendu (ordre, races hybrides sans classe raciale) est lu avant d'écrire.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer as enregistrerLot, racesHybridesSansClasse } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerRaces } from '../src/lib/races-db.mjs';
import { groupClasses } from '../src/lib/class-groups.mjs';
import { normalize } from '../src/lib/text.mjs';
import { alternativesDe, placeNouvelleLigne } from '../src/lib/dons-edition.mjs';
import { resumeDeDon } from '../src/lib/corps-classes.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { ficheVide, jourDuRetrait, TABLES_FICHES } from '../src/lib/fiche-format.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-classes-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin_, corps) => traiter({ methode, chemin: chemin_, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
const enregistrer = (operations) => appel('POST', '/api/edition/', { page: 'classes/x', operations });
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p);
/** Un nom que la base n'a pas encore pour une entité (`table`, pages `<type>/<slug>`) : `nom`, ou `nom 2`, `nom 3`… */
const nomLibre = (nom, table, type) => {
  const pris = (n) => ligne(`SELECT 1 FROM "${table}" WHERE nom = ? OR id = ? UNION ALL SELECT 1 FROM page WHERE id = ?`, n, `${type}/${normalize(n)}`, `${type}/${normalize(n)}`)
    ?? (table === 'race' ? ligne('SELECT 1 FROM peuple WHERE nom = ? OR nom_cle = ?', n, normalize(n)) : null);
  let n = nom;
  for (let i = 2; pris(n); i += 1) n = `${nom} ${i}`;
  return n;
};

test('classe : don de départ, maîtrises (tables de détail et bouclier_classe_max), inventaire (objets du glossaire)', () => {
  const r = enregistrer([{ op: 'modifier', table: 'classe', cle: { id: 'classes/guerrier' }, valeurs: {
    sante_depart: 12, maitrise_arme: '- 1 maîtrise Hache\n- 1 maîtrise arme au choix', maitrise_armure: '- Légère à Lourde\n- Bouclier classe 1 à 4',
    inventaire_depart: 'P fiole rouge, Bandage (x2) OU torche, Objet inconnu',
  } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(lignes("SELECT forme, arme, categorie FROM classe_maitrise_arme WHERE classe_id = 'classes/guerrier' ORDER BY rang").map((l) => ({ ...l })),
    [{ forme: 'nommee', arme: 'Hache', categorie: null }, { forme: 'au_choix', arme: null, categorie: null }]);
  assert.equal(ligne("SELECT bouclier_classe_max FROM classe WHERE id = 'classes/guerrier'").bouclier_classe_max, 4);
  const inventaire = lignes("SELECT rang, option, texte, objet_depart_id FROM classe_objet_depart WHERE classe_id = 'classes/guerrier' ORDER BY rang, option");
  assert.deepEqual(inventaire.map((l) => [l.rang, l.option, l.objet_depart_id?.split(':').pop() ?? null]), [[1, 1, 'p-fiole-rouge'], [2, 1, 'bandage'], [2, 2, 'torche'], [3, 1, null]]);
  assert.equal(enregistrer([{ op: 'modifier', table: 'classe', cle: { id: 'classes/guerrier' }, valeurs: { sante_depart: -1 } }]).statut, 400);
});

// Un don d'une spécialité (pas son don de spécialité), sans remarque, dont la fiche a le titre « Nom (Classe) » et le résumé tiré de l'effet : « Anti-corps »
// de l'Anansi (spécialité CEMIES à l'import) s'il existe encore, sinon un autre (le site de dev a pu le supprimer, D11). Lu avant d'écrire.
const DON = lignes(`SELECT k.*, c.nom AS classe_nom, p.titre, p.resume AS resume_page FROM capacite k JOIN classe c ON c.id = k.classe_id JOIN page p ON p.id = k.id
  WHERE k.specialite_id IS NOT NULL AND k.nature <> 'specialite' AND k.remarque IS NULL AND p.titre = k.nom || ' (' || c.nom || ')'
  ORDER BY k.id = 'capacites/anansi-anti-corps' DESC, k.id`).find((k) => k.resume_page === resumeDeDon(k));

test('spécialité renommée : clé du nom, fiches de ses dons (spécialité citée, mot-clé)', () => {
  assert.ok(DON, 'un don de spécialité à fiche « Nom (Classe) »');
  const s = ligne('SELECT id, nom FROM specialite WHERE id = ?', DON.specialite_id);
  const nouveau = s.nom === 'CEMIES' ? 'CÉMIES' : `${s.nom} BIS`;
  const r = enregistrer([{ op: 'modifier', table: 'specialite', cle: { id: s.id }, valeurs: { nom: nouveau } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne('SELECT nom_cle FROM specialite WHERE id = ?', s.id).nom_cle, normalize(nouveau));
  assert.equal(JSON.parse(ligne('SELECT donnees FROM page WHERE id = ?', DON.id).donnees).specialite, nouveau);
});

test('don modifié : type et limite recalculés ; sa fiche suit (titre « Nom (Classe) », résumé, corps, type)', () => {
  const r = enregistrer([{ op: 'modifier', table: 'capacite', cle: { id: DON.id }, valeurs: {
    nom: 'Anticorps puissants', type_brut: 'Actif (2 fois/combat)', effet: 'Immunisé aux poisons.\nEt aux fioles.',
  } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual({ ...ligne('SELECT nom_cle, type, limite_nombre, limite_periode FROM capacite WHERE id = ?', DON.id) },
    { nom_cle: 'anticorps-puissants', type: 'actif', limite_nombre: 2, limite_periode: 'combat' });
  const page = ligne('SELECT titre, resume, corps_md, donnees FROM page WHERE id = ?', DON.id);
  assert.equal(page.titre, `Anticorps puissants (${DON.classe_nom})`);
  assert.equal(page.resume, 'Immunisé aux poisons.');
  assert.equal(page.corps_md, 'Immunisé aux poisons.  \nEt aux fioles.\n', 'le rendu de l’importeur : retour à la ligne forcé (lib/corps-classes.mjs#corpsDeDon)');
  assert.equal(JSON.parse(page.donnees).type_capacite, 'Actif (2 fois/combat)');
});

test('créer une classe dans une catégorie : page (mot-clé de la catégorie : rangée dans sa colonne), colonne de la matrice de la fiche', () => {
  const nom = nomLibre('Sorcier des marais', 'classe', 'classes');
  const id = `classes/${normalize(nom)}`;
  const ordre = ligne('SELECT max(ordre) AS m FROM classe').m + 1;
  const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-magique', nom, sante_depart: '6' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const c = ligne('SELECT * FROM classe WHERE id = ?', id);
  assert.deepEqual([c.categorie_id, c.sante_depart, c.ordre], ['classe-magique', 6, ordre], 'à la suite des classes de la base');
  const tags = lignes('SELECT libelle FROM page_tag WHERE page_id = ? ORDER BY ordre', id).map((t) => t.libelle);
  assert.deepEqual(tags, ['classe', 'magique']);
  const groupe = groupClasses([{ id, data: { title: nom, tags } }])[0];
  assert.equal(groupe.key, 'magiques');
  assert.equal(ligne('SELECT count(*) AS n FROM race_classe WHERE classe_id = ? AND accessible = 0', id).n, ligne('SELECT count(*) AS n FROM race').n);
  for (const [valeurs, motif] of [
    [{ categorie_id: 'inconnue', nom: 'X' }, /catégorie inconnue/],
    [{ categorie_id: 'classe-magique' }, /Nom/],
    [{ categorie_id: 'classe-magique', nom: 'Y', race_id: 'races/humain' }, /Seule une classe raciale/],
  ]) {
    const refus = enregistrer([{ op: 'creer', entite: 'classe', valeurs }]);
    assert.equal(refus.statut, 400, JSON.stringify(valeurs));
    assert.match(refus.corps.erreur, motif);
  }
});

test('classe raciale : seulement pour une race hybride sans classe raciale ; elle prend le nom de la race et lui est seule accessible', () => {
  // à l'import : le Drassah'thac seul (R14) ; le site a pu créer d'autres races hybrides, encore sans classe raciale
  const avant = racesHybridesSansClasse(db).map((r) => r.id);
  assert.ok(avant.includes('races/drassahthac'), 'le Drassah’thac (R14)');
  const lycan = nomLibre('Lycan', 'race', 'races');
  const gnome = nomLibre('Gnome', 'race', 'races');
  const [idLycan, idGnome] = [lycan, gnome].map((n) => `races/${normalize(n)}`);
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: lycan, nature: 'hybride' } }]).statut, 200);
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: gnome, nature: 'pure' } }]).statut, 200);
  const listes = appel('GET', '/api/edition/listes/').corps;
  assert.deepEqual(listes.racesSansClasse.map((r) => r.valeur).sort(), [...avant, idLycan].sort());
  assert.ok(listes.categories.some((c) => c.valeur === 'classe-hybride-animal'));
  for (const race of [idGnome, 'races/orios', 'races/humain']) {
    const refus = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-hybride-animal', race_id: race } }]);
    assert.equal(refus.statut, 400, race);
    assert.match(refus.corps.erreur, /race hybride qui n’a pas encore de classe raciale/);
  }
  const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-hybride-animal', race_id: idLycan, nom: 'ignoré' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const idClasse = `classes/${normalize(lycan)}`;
  assert.deepEqual(r.corps.crees, [{ entite: 'classe', id: idClasse, operation: 0 }]);
  assert.equal(ligne('SELECT nom FROM classe WHERE id = ?', idClasse).nom, lycan);
  assert.deepEqual(lignes('SELECT race_id FROM race_classe WHERE classe_id = ? AND accessible = 1', idClasse).map((l) => l.race_id), [idLycan]);
  assert.deepEqual(chargerRaces(db).races.get(idLycan).classeRaciale, { id: idClasse, nom: lycan }, 'la page de la race la cite');
  assert.deepEqual(racesHybridesSansClasse(db).map((r) => r.id).sort(), [...avant].sort());
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// D11 : créer et supprimer des spécialités et des dons (demande du propriétaire). Les classes d'essai sont créées ici (noms absents de la base) ;
// l'Archimage et les dons importés sont lus avant d'écrire.
// ---------------------------------------------------------------------------------------------------------------------------------------------
const donneesDe = (id) => JSON.parse(ligne('SELECT donnees FROM page WHERE id = ?', id).donnees);
const donDe = (id) => ligne('SELECT * FROM capacite WHERE id = ?', id);
const dernierResume = () => ligne('SELECT resume FROM modification_lot ORDER BY rowid DESC LIMIT 1').resume;
const clesIntactes = () => assert.deepEqual(lignes('PRAGMA foreign_key_check'), []);
const creerSpecialite = (classe, nom, autres = {}) =>
  enregistrer([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: classe, nom, don_nom: nom, don_type: 'Passif', ...autres } }]);
const creerDon = (valeurs) => enregistrer([{ op: 'creer', entite: 'capacite', valeurs }]);
const supprimer = (entite, id) => enregistrer([{ op: 'supprimer', entite, cle: { id } }]);
/** Un nom de don dont le titre « Nom (Classe) » est libre dans la base. */
const nomDeDonLibre = (nom, classeNom) => {
  let n = nom;
  for (let i = 2; ligne('SELECT 1 FROM cle_page WHERE cle = ?', normalize(`${n} (${classeNom})`)); i += 1) n = `${nom} ${i}`;
  return n;
};
function nouvelleClasse(nom) {
  const n = nomLibre(nom, 'classe', 'classes');
  const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-physique-corps-a-corps', nom: n } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return { id: r.corps.crees[0].id, nom: n, slug: r.corps.crees[0].id.slice('classes/'.length) };
}
const C1 = {};

test('D11 — créer une spécialité : ligne, page_entite, don de spécialité (niveau 10, ligne des autres), choix symétriques, bannière de la page', () => {
  Object.assign(C1, nouvelleClasse('Bretteur des dunes'));
  const r = creerSpecialite(C1.id, 'LAME COURBE', { description: 'Une lame.', don_nom: 'Lame courbe', don_type: 'Actif', don_precision: '1 fois/combat', don_effet: 'Frappe deux fois.' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  C1.spec1 = `${C1.id}#specialite:lame-courbe`;
  assert.deepEqual(r.corps.crees, [{ entite: 'specialite', id: C1.spec1, operation: 0 }]);
  assert.equal(dernierResume(), `Spécialité créée : LAME COURBE (${C1.nom})`);
  const s = ligne('SELECT * FROM specialite WHERE id = ?', C1.spec1);
  assert.deepEqual([s.classe_id, s.rang, s.nom, s.nom_cle, s.description, s.description_titre, s.origine], [C1.id, 1, 'LAME COURBE', 'lame-courbe', 'Une lame.', null, 'classes']);
  assert.match(s.source_ref, /^Site de dev › édition du \d{4}-\d\d-\d\d › /);
  assert.deepEqual({ ...ligne("SELECT page_id, principale FROM page_entite WHERE entite_table = 'specialite' AND entite_id = ?", C1.spec1) }, { page_id: C1.id, principale: 0 });
  const k = ligne('SELECT * FROM capacite WHERE specialite_id = ?', C1.spec1);
  assert.deepEqual([k.id, k.nature, k.niveau, k.rang, k.ligne, k.type, k.limite_nombre, k.limite_periode, k.type_brut, k.effet],
    [`capacites/${C1.slug}-lame-courbe`, 'specialite', 10, 1, 7, 'actif', 1, 'combat', 'Actif (1 fois/combat)', 'Frappe deux fois.']);
  C1.cartouche1 = k.id;
  const p = ligne('SELECT * FROM page WHERE id = ?', k.id);
  assert.deepEqual([p.type, p.slug, p.titre, p.statut, p.origine, p.resume, p.corps_md],
    ['capacites', `${C1.slug}-lame-courbe`, `Lame courbe (${C1.nom})`, 'draft', 'classes', 'Frappe deux fois.', 'Frappe deux fois.\n']);
  assert.deepEqual(lignes('SELECT libelle FROM page_tag WHERE page_id = ? ORDER BY ordre', k.id).map((t) => t.libelle), ['capacité de classe', C1.nom.toLowerCase(), 'lame courbe']);
  const sources = lignes('SELECT s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ?', k.id);
  assert.equal(sources.length, 1);
  assert.match(sources[0].texte, /^Site de dev › édition du /);
  assert.deepEqual({ ...ligne("SELECT page_id, principale FROM page_entite WHERE entite_table = 'capacite' AND entite_id = ?", k.id) }, { page_id: k.id, principale: 1 });
  assert.deepEqual(donneesDe(k.id), { classe: C1.id, specialite: 'LAME COURBE', niveau: 10, nature: 'specialite', rang: 1, ligne: 7, type_capacite: 'Actif (1 fois/combat)' });
  assert.match(ligne('SELECT corps_md FROM page WHERE id = ?', C1.id).corps_md, /## Sous-classes\n\n### LAME COURBE\n\n#### Description\n\nUne lame\.\n/);
  // la seconde : son don de spécialité sur la même ligne, au choix avec le premier (des deux côtés)
  const r2 = creerSpecialite(C1.id, 'ARC LONG', { don_nom: 'Arc long' });
  assert.equal(r2.statut, 200, JSON.stringify(r2.corps));
  C1.spec2 = `${C1.id}#specialite:arc-long`;
  const k2 = ligne('SELECT * FROM capacite WHERE specialite_id = ?', C1.spec2);
  C1.cartouche2 = k2.id;
  assert.deepEqual([k2.ligne, k2.rang, ligne('SELECT rang FROM specialite WHERE id = ?', C1.spec2).rang], [7, 1, 2]);
  assert.deepEqual(donneesDe(k.id).choix_exclusif_avec, [k2.id]);
  assert.deepEqual(donneesDe(k2.id).choix_exclusif_avec, [k.id]);
  assert.equal(donneesDe(k2.id).rang, 2, 'le rang d’un don de spécialité est celui de sa spécialité');
  const r3 = creerSpecialite(C1.id, 'TROISIÈME');
  assert.equal(r3.statut, 409);
  assert.match(r3.corps.erreur, /a déjà 2 spécialités \(LAME COURBE, ARC LONG\) : supprimez-en une d’abord/);
  // l'état vivant de la page (POST /api/edition/classe/)
  const etat = appel('POST', '/api/edition/classe/', { classe: C1.id });
  assert.equal(etat.statut, 200);
  assert.deepEqual(etat.corps.specialites.map((x) => x.id), [C1.spec1, C1.spec2]);
  assert.deepEqual(etat.corps.exclusions.map((e) => [e.capacite_id, e.autre_id]), [[k2.id, k.id], [k.id, k2.id]].sort());
  assert.equal(appel('POST', '/api/edition/classe/', { classe: 'classes/inconnue' }).statut, 404);
  clesIntactes();
});

test('D11 — refus de spécialité : classe inconnue, nom sans lettre, nom pris, Archimage ; un id déjà employé (spécialité renommée) reçoit -2', () => {
  const C2 = nouvelleClasse('Lancier des marais');
  assert.equal(creerSpecialite(C2.id, 'ROC').statut, 200);
  for (const [classe, nom, statut, motif] of [
    ['classes/inconnue', 'X', 400, /Nouvelle spécialité : classe inconnue/],
    [C2.id, '...', 400, /au moins une lettre ou un chiffre/],
    [C2.id, 'Roc', 409, /a déjà une spécialité « ROC »/],
    ['classes/archimage', 'Chronomancien', 409, /Les spécialités de la classe Archimage ne se modifient pas ici : la fiche de personnage les lit dans ses dons de niveau 10/],
  ]) {
    const r = creerSpecialite(classe, nom);
    assert.equal(r.statut, statut, `${classe} ${nom} : ${JSON.stringify(r.corps)}`);
    assert.match(r.corps.erreur, motif);
  }
  // renommée, la spécialité garde son id (…#specialite:roc) : une nouvelle « ROC » prend …-2
  assert.equal(enregistrer([{ op: 'modifier', table: 'specialite', cle: { id: `${C2.id}#specialite:roc` }, valeurs: { nom: 'PIERRE' } }]).statut, 200);
  const r = creerSpecialite(C2.id, 'ROC', { don_nom: 'Roc nouveau' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(r.corps.crees[0].id, `${C2.id}#specialite:roc-2`);
});

test('D11 — don de spécialité au niveau 15 : nouvelle ligne, seul donc sans alternative ; puis une paire dans un même lot (« @0 ») : choix symétriques, proposés par la fiche', () => {
  const attendue = placeNouvelleLigne(lignes('SELECT * FROM capacite WHERE classe_id = ?', C1.id), { specialiteId: C1.spec1, niveau: 15 });
  assert.equal(attendue, 14);
  const r = creerDon({ classe_id: C1.id, specialite_id: C1.spec1, niveau: '15', nom: 'Fente', type: 'Actif', precision: '2 fois/combat', effet: 'Touche de loin.' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  C1.fente = r.corps.crees[0].id;
  assert.equal(C1.fente, `capacites/${C1.slug}-fente`);
  assert.equal(dernierResume(), `Don créé : Fente (${C1.nom}, niveau 15)`);
  const k = donDe(C1.fente);
  assert.deepEqual([k.nature, k.niveau, k.ligne, k.rang, k.specialite_id, k.type, k.limite_nombre], ['choix', 15, 14, 1, C1.spec1, 'actif', 2]);
  assert.equal('choix_exclusif_avec' in donneesDe(C1.fente), false, 'seul sur sa ligne');
  assert.deepEqual(lignes('SELECT libelle FROM page_tag WHERE page_id = ? ORDER BY ordre', C1.fente).map((t) => t.libelle), ['capacité de classe', C1.nom.toLowerCase(), 'lame courbe']);
  // une paire au niveau 20 : le second don cite le premier par « @0 »
  const p = enregistrer([
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: C1.id, specialite_id: C1.spec1, niveau: '20', nom: 'Botte secrète', type: 'Passif' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: C1.id, specialite_id: C1.spec1, avec: '@0', nom: 'Garde haute', type: 'Réaction', precision: '1/tour' } },
  ]);
  assert.equal(p.statut, 200, JSON.stringify(p.corps));
  assert.deepEqual(p.corps.crees.map((c) => c.operation), [0, 1]);
  const [a, b] = p.corps.crees.map((c) => c.id);
  const [ka, kb] = [donDe(a), donDe(b)];
  assert.deepEqual([kb.ligne, kb.niveau, kb.rang, kb.nature, kb.specialite_id], [ka.ligne, 20, 2, 'choix', C1.spec1]);
  assert.deepEqual(donneesDe(a).choix_exclusif_avec, [b]);
  assert.deepEqual(donneesDe(b).choix_exclusif_avec, [a]);
  const regles = chargerReglesDeFiche(db).classes.find((c) => c.id === C1.id);
  assert.deepEqual(regles.choix.map((g) => g.options.map((o) => o.id)), [[a, b]], 'un choix demande au moins deux dons : la paire seule');
  assert.deepEqual(regles.specialites.map((s) => s.id), [C1.spec1, C1.spec2]);
  C1.paire = [a, b];
  clesIntactes();
});

test('D11 — don de classe : niveau 5 reçu sans choix ; une option à côté en fait un choix (les deux dons)', () => {
  const attendue = placeNouvelleLigne(lignes('SELECT * FROM capacite WHERE classe_id = ?', C1.id), { niveau: 5 });
  const r = creerDon({ classe_id: C1.id, niveau: '5', nom: 'Pas de côté', type: 'Passif', effet: 'Esquive.' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const id = r.corps.crees[0].id;
  assert.deepEqual({ ...ligne('SELECT nature, specialite_id, niveau, ligne, rang FROM capacite WHERE id = ?', id) }, { nature: 'classe', specialite_id: null, niveau: 5, ligne: attendue, rang: 1 });
  assert.ok(attendue < 7, 'avant l’étage des spécialités');
  assert.deepEqual(donneesDe(id), { classe: C1.id, niveau: 5, nature: 'classe', rang: 1, ligne: attendue, type_capacite: 'Passif' });
  const o = creerDon({ classe_id: C1.id, avec: id, nom: 'Roulade', type: 'Action', niveau: '20' });
  assert.equal(o.statut, 200, JSON.stringify(o.corps));
  assert.equal(dernierResume(), `Don créé : Roulade (${C1.nom}, niveau 5, au choix avec Pas de côté)`, 'le niveau de l’option est celui du choix');
  const opt = o.corps.crees[0].id;
  assert.equal(donDe(id).nature, 'choix');
  assert.deepEqual({ ...ligne('SELECT nature, ligne, rang, niveau FROM capacite WHERE id = ?', opt) }, { nature: 'choix', ligne: attendue, rang: 2, niveau: 5 });
  assert.deepEqual([donneesDe(id).nature, donneesDe(id).choix_exclusif_avec], ['choix', [opt]]);
  assert.deepEqual(donneesDe(opt).choix_exclusif_avec, [id]);
  C1.esquive = [id, opt];
});

test('D11 — Archimage : une option de plus à un palier ; un nouveau palier seul est reçu sans choix', () => {
  // un palier de l'Archimage (Création vivante à l'import), hors du choix miroir Élémentaliste / Occultiste, lu dans l'état courant
  const palier = ligne(`SELECT * FROM capacite WHERE classe_id = 'classes/archimage' AND nature = 'choix' AND specialite_id IS NULL
    AND nom_cle NOT IN (SELECT nom_cle FROM specialite WHERE classe_id = 'classes/archimage') ORDER BY id = 'capacites/archimage-creation-vivante' DESC, ligne, rang LIMIT 1`);
  const groupe = lignes("SELECT * FROM capacite WHERE classe_id = 'classes/archimage' AND ligne = ? AND specialite_id IS NULL", palier.ligne);
  const nom = nomDeDonLibre('Transmutation d’essai', 'Archimage');
  const r = creerDon({ classe_id: 'classes/archimage', avec: palier.id, nom, type: 'Passif' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const id = r.corps.crees[0].id;
  assert.deepEqual({ ...ligne('SELECT nature, ligne, niveau, rang FROM capacite WHERE id = ?', id) },
    { nature: 'choix', ligne: palier.ligne, niveau: palier.niveau, rang: Math.max(...groupe.map((d) => d.rang)) + 1 });
  for (const d of [...groupe, donDe(id)]) assert.equal(donneesDe(d.id).choix_exclusif_avec.length, groupe.length, d.id);
  const dons = lignes("SELECT * FROM capacite WHERE classe_id = 'classes/archimage'");
  const attendue = placeNouvelleLigne(dons, { niveau: 15 });
  const n = creerDon({ classe_id: 'classes/archimage', niveau: '15', nom: nomDeDonLibre('Arcane lointain', 'Archimage'), type: 'Passif' });
  assert.equal(n.statut, 200, JSON.stringify(n.corps));
  assert.deepEqual({ ...ligne('SELECT nature, ligne FROM capacite WHERE id = ?', n.corps.crees[0].id) }, { nature: 'classe', ligne: attendue });
  assert.ok(!alternativesDe(donDe(n.corps.crees[0].id), lignes("SELECT * FROM capacite WHERE classe_id = 'classes/archimage'")).length);
  // ses spécialités ne se créent ni ne se suppriment, ses dons miroirs ne se suppriment pas, et leur choix ne reçoit pas d'option (une troisième
  // « spécialité » pour la fiche, sans ligne specialite)
  const option = creerDon({ classe_id: 'classes/archimage', avec: 'capacites/archimage-occultiste', nom: nomDeDonLibre('Troisième voie', 'Archimage'), type: 'Passif' });
  assert.equal(option.statut, 409, JSON.stringify(option.corps));
  const miroirs = lignes("SELECT nom FROM capacite WHERE classe_id = 'classes/archimage' AND ligne = ? ORDER BY rang", donDe('capacites/archimage-occultiste').ligne).map((k) => k.nom);
  assert.ok(option.corps.erreur.includes(`Le choix ${miroirs.join(' / ')} donne les spécialités de la classe Archimage à la fiche de personnage : il ne reçoit pas d’option ici`), option.corps.erreur);
  assert.deepEqual(lignes("SELECT id FROM capacite WHERE classe_id = 'classes/archimage' AND ligne = ?", donDe('capacites/archimage-occultiste').ligne).map((k) => k.id),
    ['capacites/archimage-elementaliste', 'capacites/archimage-occultiste'], 'rien d’écrit');
  const miroir = supprimer('capacite', 'capacites/archimage-elementaliste');
  assert.equal(miroir.statut, 409);
  assert.match(miroir.corps.erreur, /« Élémentaliste » est aussi une spécialité de la classe Archimage pour la fiche de personnage : il ne se supprime pas d’ici/);
  const s = supprimer('specialite', 'classes/archimage#specialite:occultiste');
  assert.equal(s.statut, 409);
  assert.match(s.corps.erreur, /ne se modifient pas ici/);
});

test('D11 — classe raciale : un don de spécialité qui dit « considérer comme classe magique » rend sa spécialité magique (R7) ; ids préfixés du slug de la race', () => {
  const race = nomLibre('Centaure', 'race', 'races');
  const idRace = `races/${normalize(race)}`;
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: race, nature: 'hybride' } }]).statut, 200);
  const c = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-hybride-animal', race_id: idRace } }]);
  assert.equal(c.statut, 200, JSON.stringify(c.corps));
  const idClasse = c.corps.crees[0].id;
  assert.equal(creerSpecialite(idClasse, 'SAGE DES PLAINES', { don_nom: 'Sage', don_effet: 'Considérer comme classe magique.' }).statut, 200);
  assert.equal(creerSpecialite(idClasse, 'CHARGEUR', { don_nom: 'Chargeur', don_effet: 'Charge plus loin.' }).statut, 200);
  for (const k of lignes("SELECT id FROM capacite WHERE classe_id = ? AND nature = 'specialite'", idClasse)) assert.ok(k.id.startsWith(`capacites/${normalize(race)}-`), k.id);
  assert.equal(donneesDe(`capacites/${normalize(race)}-sage`).classe, idClasse);
  assert.equal(ligne('SELECT titre FROM page WHERE id = ?', `capacites/${normalize(race)}-sage`).titre, `Sage (${race})`);
  const regles = chargerReglesDeFiche(db).classes.find((x) => x.id === idClasse);
  assert.deepEqual(regles.specialites.map((s) => [s.nom, s.magique]), [['SAGE DES PLAINES', true], ['CHARGEUR', false]], 'rien n’est déduit : seul le texte du don le dit');
});

test('D11 — refus de don : classe, spécialité, niveau, place, type, titre pris deux fois, référence « @i » non résolue', () => {
  const avant = ligne('SELECT count(*) AS n FROM capacite').n;
  for (const [valeurs, motif] of [
    [{ classe_id: 'classes/inconnue', niveau: '1', nom: 'X', type: 'Passif' }, /Nouveau don : classe inconnue/],
    [{ classe_id: C1.id, specialite_id: 'classes/guerrier#specialite:epeiste', niveau: '15', nom: 'X', type: 'Passif' }, /n’est pas une spécialité de la classe/],
    [{ classe_id: 'classes/archimage', specialite_id: 'classes/archimage#specialite:elementaliste', niveau: '15', nom: 'X', type: 'Passif' }, /n’a pas de don de spécialité \(niveau 10\)/],
    [{ classe_id: C1.id, niveau: '7', nom: 'X', type: 'Passif' }, /Nouveau don : « Niveau de classe » : valeur hors de la liste/],
    [{ classe_id: C1.id, nom: 'X', type: 'Passif' }, /« Niveau de classe » obligatoire/],
    [{ classe_id: C1.id, specialite_id: C1.spec1, niveau: '5', nom: 'X', type: 'Passif' }, /« X » : Un don de spécialité commence au niveau 10, quand la spécialité est choisie/],
    [{ classe_id: C1.id, niveau: '5', nom: 'X', type: 'Actif', precision: '99999999999999999999 fois/combat' }, /« X » : Type « Actif \(99999999999999999999 fois\/combat\) » : le nombre de la limite est trop grand/],
    [{ classe_id: C1.id, avec: 'capacites/inconnu', nom: 'X', type: 'Passif' }, /don inconnu/],
    [{ classe_id: C1.id, avec: ligne('SELECT id FROM capacite WHERE classe_id <> ? ORDER BY id LIMIT 1', C1.id).id, nom: 'X', type: 'Passif' }, /ce don n’est pas de la classe/],
    [{ classe_id: C1.id, avec: C1.cartouche1, nom: 'X', type: 'Passif' }, /Un don de spécialité ne reçoit pas d’option : ajoutez une spécialité/],
    [{ classe_id: C1.id, niveau: '1', nom: 'X' }, /Nouveau don : « Type » obligatoire/],
    [{ classe_id: C1.id, niveau: '1', nom: 'X', type: 'Bizarre' }, /« Type » : valeur hors de la liste/],
    [{ classe_id: C1.id, avec: '@9', nom: 'X', type: 'Passif' }, /« @9 » ne désigne pas un don créé plus haut dans ce lot/],
    [{ classe_id: C1.id, specialite_id: '@0', niveau: '15', nom: 'X', type: 'Passif' }, /ne désigne pas une spécialité créée plus haut dans ce lot/],
  ]) {
    const r = creerDon(valeurs);
    assert.equal(r.statut, 400, `${JSON.stringify(valeurs)} : ${JSON.stringify(r.corps)}`);
    assert.match(r.corps.erreur, motif);
  }
  assert.equal(ligne('SELECT count(*) AS n FROM capacite').n, avant, 'rien d’écrit');
  // une limite trop grande : refus 400 en français (et non une erreur SQLite : colonne INTEGER d'une table STRICT), à la création d'une spécialité comme à
  // la modification du type d'un don
  const sp = creerSpecialite(nouvelleClasse('Classe aux limites').id, 'X', { don_precision: '99999999999999999999 fois/combat' });
  assert.equal(sp.statut, 400, JSON.stringify(sp.corps));
  assert.match(sp.corps.erreur, /« X » : Type « Passif \(99999999999999999999 fois\/combat\) » : le nombre de la limite est trop grand/);
  const m = enregistrer([{ op: 'modifier', table: 'capacite', cle: { id: C1.fente }, valeurs: { type_brut: 'Actif (99999999999999999999 fois/combat)' } }]);
  assert.equal(m.statut, 400, JSON.stringify(m.corps));
  assert.match(m.corps.erreur, /le nombre de la limite est trop grand/);
  assert.equal(donDe(C1.fente).type_brut, 'Actif (2 fois/combat)');
  // homonymes : l'id prend -<niveau>, le titre « , niveau N » ; une troisième fois, le titre n'a plus de forme libre
  const un = creerDon({ classe_id: C1.id, niveau: '15', nom: 'Doublon', type: 'Passif' });
  const deux = creerDon({ classe_id: C1.id, niveau: '15', nom: 'Doublon', type: 'Passif' });
  assert.equal(un.statut, 200, JSON.stringify(un.corps));
  assert.equal(deux.statut, 200, JSON.stringify(deux.corps));
  assert.deepEqual([un.corps.crees[0].id, deux.corps.crees[0].id], [`capacites/${C1.slug}-doublon`, `capacites/${C1.slug}-doublon-15`]);
  assert.deepEqual([un, deux].map((x) => ligne('SELECT titre FROM page WHERE id = ?', x.corps.crees[0].id).titre), [`Doublon (${C1.nom})`, `Doublon (${C1.nom}), niveau 15`]);
  const trois = creerDon({ classe_id: C1.id, niveau: '15', nom: 'Doublon', type: 'Passif' });
  assert.equal(trois.statut, 409);
  assert.match(trois.corps.erreur, /Un don « Doublon » existe déjà dans cette classe, aussi au niveau 15 : choisissez un autre nom/);
  C1.doublons = [un.corps.crees[0].id, deux.corps.crees[0].id];
});

test('D11 — l’id d’un don supprimé n’est jamais repris', () => {
  const r = creerDon({ classe_id: C1.id, niveau: '20', nom: 'Éphémère', type: 'Passif' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const id = r.corps.crees[0].id;
  assert.equal(id, `capacites/${C1.slug}-ephemere`);
  assert.equal(supprimer('capacite', id).statut, 200);
  assert.equal(ligne('SELECT 1 FROM page WHERE id = ?', id), undefined);
  const again = creerDon({ classe_id: C1.id, niveau: '20', nom: 'Éphémère', type: 'Passif' });
  assert.equal(again.statut, 200, JSON.stringify(again.corps));
  assert.equal(again.corps.crees[0].id, `capacites/${C1.slug}-ephemere-20`, 'l’ancien id est dans le journal : il ne désigne qu’un seul don');
});

test('D11 — supprimer un don : note de cellule, fiche, mots-clés, sources, entité rattachée ; le survivant d’un choix (seul dans une spécialité, reçu sans choix hors spécialité)', () => {
  // un don importé qui a une note de cellule, dans un choix de deux d'une spécialité, qu'aucune fiche ne cite
  const cible = lignes(`SELECT k.* FROM capacite k JOIN note_cellule n ON n.entite_table = 'capacite' AND n.entite_id = k.id
    WHERE k.nature = 'choix' AND k.specialite_id IS NOT NULL AND k.id NOT IN (SELECT capacite_id FROM personnage_capacite) ORDER BY k.id`)
    .find((k) => lignes("SELECT id FROM capacite WHERE classe_id = ? AND ligne = ? AND specialite_id = ? AND nature = 'choix'", k.classe_id, k.ligne, k.specialite_id).length === 2);
  assert.ok(cible, 'un don à note dans un choix de deux');
  const survivant = lignes("SELECT * FROM capacite WHERE classe_id = ? AND ligne = ? AND specialite_id = ? AND nature = 'choix' AND id <> ?", cible.classe_id, cible.ligne, cible.specialite_id, cible.id)[0];
  const r = supprimer('capacite', cible.id);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  for (const [sql, ...p] of [
    ['SELECT 1 FROM capacite WHERE id = ?', cible.id], ['SELECT 1 FROM page WHERE id = ?', cible.id], ['SELECT 1 FROM page_tag WHERE page_id = ?', cible.id],
    ['SELECT 1 FROM page_source WHERE page_id = ?', cible.id], ['SELECT 1 FROM page_entite WHERE page_id = ? OR entite_id = ?', cible.id, cible.id],
    ["SELECT 1 FROM note_cellule WHERE entite_table = 'capacite' AND entite_id = ?", cible.id],
  ]) assert.equal(ligne(sql, ...p), undefined, sql);
  assert.equal(donDe(survivant.id).nature, 'choix', 'dans une spécialité, le survivant reste un choix (sans alternative)');
  assert.equal('choix_exclusif_avec' in donneesDe(survivant.id), false);
  // hors spécialité : le survivant devient reçu sans choix
  const [pas, roulade] = C1.esquive;
  assert.equal(supprimer('capacite', roulade).statut, 200);
  assert.equal(dernierResume(), `Don supprimé : Roulade (${C1.nom}) ; Pas de côté devient reçu sans choix`);
  assert.equal(donDe(pas).nature, 'classe');
  assert.deepEqual([donneesDe(pas).nature, 'choix_exclusif_avec' in donneesDe(pas)], ['classe', false]);
  // une source que seule la fiche supprimée citait part avec elle (lot d'un autre jour : sa source « Site de dev › édition du … » lui est propre)
  const instant = '2031-02-03T04:05:06Z';
  const lot = enregistrerLot(db, { page: C1.id, operations: [{ op: 'creer', entite: 'capacite', valeurs: { classe_id: C1.id, niveau: '20', nom: 'Fugace', type: 'Passif' } }] }, { instant, id: `${instant}-d11-fugace` });
  const fugace = lot.crees[0].id;
  const source = ligne('SELECT source_id FROM page_source WHERE page_id = ?', fugace).source_id;
  assert.equal(supprimer('capacite', fugace).statut, 200);
  assert.equal(ligne('SELECT 1 FROM source WHERE id = ?', source), undefined, 'source orpheline retirée');
  clesIntactes();
});

/** Les modifications du journal sur une table des fiches de personnage : jamais (R42, les fiches s'écrivent hors du journal). */
const modificationsDeFiches = () => ligne('SELECT count(*) AS n FROM modification WHERE table_nom IN (SELECT value FROM json_each(?))', JSON.stringify(TABLES_FICHES)).n;
const SUITE_DU_RETRAIT = ' n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.';
/** Une fiche de JOUEUR écrite comme le fera la 1.0 (le service ne la liste ni ne la lit) : son nom ne doit jamais sortir par l'édition. */
function ficheDeJoueur(id, { classe = C1.id, specialite = null, capacites = [], creeLe = '2026-10-11T00:00:00Z' } = {}) {
  if (!ligne("SELECT 1 FROM utilisateur WHERE id = 'utilisateur-d11'")) {
    db.prepare("INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES ('utilisateur-d11', 'Joueur D11', '2026-10-11T00:00:00Z')").run();
  }
  db.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, statut, nom, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon,
    alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le) VALUES (?, 'joueur', 'utilisateur-d11', 'privee', 'brouillon', 'Secret du joueur',
    'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?)`).run(id, creeLe, creeLe);
  db.prepare('INSERT INTO personnage_classe (personnage_id, rang, classe_id, specialite_id) VALUES (?, 1, ?, ?)').run(id, classe, specialite);
  for (const k of capacites) db.prepare('INSERT INTO personnage_capacite (personnage_id, capacite_id) VALUES (?, ?)').run(id, k);
}
const retirerFicheDeJoueur = (id) => {
  db.prepare('DELETE FROM personnage WHERE id = ?').run(id);
  if (!ligne("SELECT 1 FROM personnage WHERE proprietaire_id = 'utilisateur-d11'")) db.prepare("DELETE FROM utilisateur WHERE id = 'utilisateur-d11'").run();
};

test('D11 / R42 — supprimer un don choisi : retiré du prétiré et de la fiche de joueur (anonyme), note datée, version changée ; refus restants', () => {
  const p = appel('POST', '/api/personnages/', { ...ficheVide('Fiche témoin D11'), classes: [{ rang: 1, classe_id: C1.id, specialite_id: C1.spec1 }], capacites: [{ capacite_id: C1.paire[0] }] });
  assert.equal(p.statut, 201, JSON.stringify(p.corps));
  const { id, version: v0 } = p.corps.personnage;
  ficheDeJoueur('fiche-joueur-d11', { specialite: C1.spec1, capacites: [C1.paire[1]] });
  try {
    assert.equal(appel('GET', '/api/personnages/fiche-joueur-d11/').statut, 404, 'le service ne lit pas une fiche de joueur');
    // la page de la classe sait qui perdra quoi (information pour la confirmation, plus un blocage)
    const etat = appel('POST', '/api/edition/classe/', { classe: C1.id }).corps;
    assert.deepEqual(etat.fiches[C1.paire[0]], ['Fiche témoin D11']);
    assert.deepEqual(etat.fiches[C1.paire[1]], ['fiche de joueur n° 1']);
    assert.deepEqual(etat.fiches[C1.spec1], ['Fiche témoin D11', 'fiche de joueur n° 1']);
    assert.ok(!JSON.stringify(etat).includes('Secret du joueur'), 'le nom d’une fiche de joueur ne sort pas');

    const r = supprimer('capacite', C1.paire[0]);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    const botte = `le don « Botte secrète » (classe ${C1.nom}, spécialité LAME COURBE, niveau 20)`;
    assert.deepEqual(r.corps.fiches, [{ fiche: 'Fiche témoin D11', retraits: [botte] }]);
    const relue = appel('GET', `/api/personnages/${id}/`).corps.personnage;
    assert.deepEqual(relue.capacites, []);
    assert.deepEqual(relue.classes, [{ rang: 1, classe_id: C1.id, specialite_id: C1.spec1 }], 'la spécialité reste : seul le don part');
    assert.notEqual(relue.version, v0, 'une fiche ouverte ailleurs le voit (409 à son prochain enregistrement)');
    assert.equal(relue.notes, `[${jourDuRetrait(relue.modifie_le)}] Retrait (règles modifiées) : ${botte}${SUITE_DU_RETRAIT}`);
    assert.ok(!dernierResume().includes('Fiche témoin'), 'le résumé du lot (historique, data/rows) ne nomme pas les fiches');
    assert.equal(modificationsDeFiches(), 0, 'rien des fiches au journal');

    const d = supprimer('capacite', C1.paire[1]);
    assert.equal(d.statut, 200, JSON.stringify(d.corps));
    const garde = `le don « Garde haute » (classe ${C1.nom}, spécialité LAME COURBE, niveau 20)`;
    assert.deepEqual(d.corps.fiches, [{ fiche: 'fiche de joueur n° 1', retraits: [garde] }]);
    assert.ok(!JSON.stringify(d.corps).includes('Secret du joueur'), 'le nom d’une fiche de joueur ne sort pas');
    assert.deepEqual(lignes("SELECT * FROM personnage_capacite WHERE personnage_id = 'fiche-joueur-d11'"), []);
    const notes = ligne("SELECT notes FROM personnage WHERE id = 'fiche-joueur-d11'").notes;
    assert.equal(notes.split('\n').length, 1);
    assert.match(notes, /^\[\d\d\/\d\d\/\d{4}\] Retrait \(règles modifiées\) : le don « Garde haute »/);
    assert.equal(modificationsDeFiches(), 0);

    // refus gardés : don de spécialité, don ou spécialité introuvable
    const c = supprimer('capacite', C1.cartouche1);
    assert.equal(c.statut, 409);
    assert.match(c.corps.erreur, /« Lame courbe » est le don de la spécialité LAME COURBE : supprimez la spécialité \(elle emporte ses dons\)/);
    assert.equal(supprimer('capacite', 'capacites/inconnu-d11').statut, 404);
    assert.equal(supprimer('specialite', `${C1.id}#specialite:inconnue`).statut, 404);
    clesIntactes();
  } finally {
    retirerFicheDeJoueur('fiche-joueur-d11');
  }
});

test('D11 / R42 — supprimer une spécialité : elle emporte son don de spécialité et ses dons, et part des fiches avec les dons choisis ; la bannière part ; une nouvelle du même nom prend -2', () => {
  const op = creerDon({ classe_id: C1.id, specialite_id: C1.spec2, niveau: '15', nom: 'Volée', type: 'Action' });
  assert.equal(op.statut, 200, JSON.stringify(op.corps));
  const volee = op.corps.crees[0].id;
  const siens = lignes('SELECT id FROM capacite WHERE specialite_id = ?', C1.spec2).map((k) => k.id);
  assert.equal(siens.length, 2);
  // un prétiré qui a la spécialité et l'un de ses dons ; une fiche de joueur qui n'a que la spécialité
  const p = appel('POST', '/api/personnages/', { ...ficheVide('Témoin spécialité D11'), classes: [{ rang: 1, classe_id: C1.id, specialite_id: C1.spec2 }], capacites: [{ capacite_id: volee }] });
  assert.equal(p.statut, 201, JSON.stringify(p.corps));
  ficheDeJoueur('fiche-joueur-spec-d11', { specialite: C1.spec2 });
  try {
    const r = supprimer('specialite', C1.spec2);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    assert.equal(dernierResume(), `Spécialité supprimée : ARC LONG (${C1.nom}, 2 don(s))`, 'le résumé ne nomme ni ne compte les fiches');
    assert.deepEqual(r.corps.fiches, [
      { fiche: 'Témoin spécialité D11', retraits: [`la spécialité « ARC LONG » (classe ${C1.nom}, avec le don choisi « Volée »)`] },
      { fiche: 'fiche de joueur n° 1', retraits: [`la spécialité « ARC LONG » (classe ${C1.nom})`] },
    ]);
    assert.ok(!JSON.stringify(r.corps).includes('Secret du joueur'));
    for (const fiche of [p.corps.personnage.id, 'fiche-joueur-spec-d11']) {
      assert.deepEqual(lignes('SELECT rang, classe_id, specialite_id FROM personnage_classe WHERE personnage_id = ?', fiche).map((l) => ({ ...l })), [{ rang: 1, classe_id: C1.id, specialite_id: null }], 'la classe reste');
      assert.deepEqual(lignes('SELECT * FROM personnage_capacite WHERE personnage_id = ?', fiche), []);
      assert.equal(ligne('SELECT notes FROM personnage WHERE id = ?', fiche).notes.split('\n').length, 1, 'une ligne de note par élément retiré');
    }
    assert.equal(modificationsDeFiches(), 0);
  } finally {
    retirerFicheDeJoueur('fiche-joueur-spec-d11');
  }
  assert.equal(ligne('SELECT 1 FROM specialite WHERE id = ?', C1.spec2), undefined);
  assert.equal(ligne("SELECT 1 FROM page_entite WHERE entite_table = 'specialite' AND entite_id = ?", C1.spec2), undefined);
  for (const id of siens) assert.equal(ligne('SELECT 1 FROM page WHERE id = ?', id), undefined, id);
  assert.equal('choix_exclusif_avec' in donneesDe(C1.cartouche1), false, 'le don de spécialité restant est seul');
  const corps = ligne('SELECT corps_md FROM page WHERE id = ?', C1.id).corps_md;
  assert.ok(!corps.includes('### ARC LONG') && corps.includes('### LAME COURBE'));
  const re = creerSpecialite(C1.id, 'ARC LONG', { don_nom: 'Arc long bis' });
  assert.equal(re.statut, 200, JSON.stringify(re.corps));
  assert.equal(re.corps.crees[0].id, `${C1.spec2}-2`, 'l’id d’une spécialité supprimée n’est pas repris');
  clesIntactes();
});

test('R42 — « fiche de joueur n° k » : le même numéro pour la même fiche dans l’état de la page (infobulle, confirmation) et dans la réponse du lot', () => {
  // une classe à deux spécialités ; trois fiches de joueur qui la citent : la plus ancienne (n° 1) a l'autre spécialité et ne perd rien, les deux
  // suivantes (n° 2 et 3) ont la spécialité supprimée ; un prétiré l'a aussi
  const C = nouvelleClasse('Archer des numéros');
  const garde = creerSpecialite(C.id, 'GARDÉE');
  assert.equal(garde.statut, 200, JSON.stringify(garde.corps));
  const perdue = creerSpecialite(C.id, 'PERDUE', { don_nom: 'Perdue' });
  assert.equal(perdue.statut, 200, JSON.stringify(perdue.corps));
  const [specGardee, specPerdue] = [garde, perdue].map((r) => r.corps.crees[0].id);
  const p = appel('POST', '/api/personnages/', { ...ficheVide('Témoin des numéros'), classes: [{ rang: 1, classe_id: C.id, specialite_id: specPerdue }] });
  assert.equal(p.statut, 201, JSON.stringify(p.corps));
  ficheDeJoueur('fiche-joueur-numeros-a', { classe: C.id, specialite: specGardee, creeLe: '2026-10-01T00:00:00Z' });
  ficheDeJoueur('fiche-joueur-numeros-b', { classe: C.id, specialite: specPerdue, creeLe: '2026-10-02T00:00:00Z' });
  ficheDeJoueur('fiche-joueur-numeros-c', { classe: C.id, specialite: specPerdue, creeLe: '2026-10-03T00:00:00Z' });
  try {
    const etat = appel('POST', '/api/edition/classe/', { classe: C.id }).corps;
    assert.deepEqual(etat.fiches[specGardee], ['fiche de joueur n° 1']);
    assert.deepEqual(etat.fiches[specPerdue], ['Témoin des numéros', 'fiche de joueur n° 2', 'fiche de joueur n° 3']);
    const r = supprimer('specialite', specPerdue);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    assert.deepEqual(r.corps.fiches.map((f) => f.fiche), etat.fiches[specPerdue], 'l’annonce nomme les fiches comme la confirmation');
    assert.ok(!JSON.stringify([etat, r.corps]).includes('Secret du joueur'), 'le nom d’une fiche de joueur ne sort pas');
    // la fiche n° 1 n'a rien perdu ; la page, relue, la désigne toujours ainsi
    assert.deepEqual(appel('POST', '/api/edition/classe/', { classe: C.id }).corps.fiches[specGardee], ['fiche de joueur n° 1']);
    clesIntactes();
  } finally {
    for (const id of ['fiche-joueur-numeros-a', 'fiche-joueur-numeros-b', 'fiche-joueur-numeros-c']) retirerFicheDeJoueur(id);
  }
});

test('R42 — un lot refusé n’écrit rien dans les fiches : retrait et note annulés avec la suppression', () => {
  const don = creerDon({ classe_id: C1.id, niveau: '1', nom: 'Don de la transaction', type: 'Passif' });
  assert.equal(don.statut, 200, JSON.stringify(don.corps));
  const k = don.corps.crees[0].id;
  const p = appel('POST', '/api/personnages/', { ...ficheVide('Témoin transaction D11'), notes: 'Mes notes.', classes: [{ rang: 1, classe_id: C1.id }], capacites: [{ capacite_id: k }] });
  assert.equal(p.statut, 201, JSON.stringify(p.corps));
  const avant = appel('GET', `/api/personnages/${p.corps.personnage.id}/`).corps.personnage;
  const r = enregistrer([
    { op: 'supprimer', entite: 'capacite', cle: { id: k } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: C1.id, niveau: '1', type: 'Passif', inconnu: 1 } },
  ]);
  assert.equal(r.statut, 400, JSON.stringify(r.corps));
  const apres = appel('GET', `/api/personnages/${p.corps.personnage.id}/`).corps.personnage;
  assert.deepEqual(apres.capacites, [{ capacite_id: k }]);
  assert.equal(apres.notes, 'Mes notes.');
  assert.equal(apres.version, avant.version);
  assert.ok(donDe(k), 'le don est toujours là');
});

test('D11 — messages accordés : « Nouvelle spécialité », « Nouveau don »', () => {
  const s = enregistrer([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: C1.id, don_nom: 'X', don_type: 'Passif' } }]);
  assert.equal(s.statut, 400);
  assert.match(s.corps.erreur, /Nouvelle spécialité : « Nom de la spécialité » obligatoire/);
  const d = enregistrer([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: C1.id, niveau: '1', type: 'Passif', inconnu: 1 } }]);
  assert.equal(d.statut, 400);
  assert.match(d.corps.erreur, /Nouveau don : le champ « inconnu » ne se donne pas à la création/);
});
