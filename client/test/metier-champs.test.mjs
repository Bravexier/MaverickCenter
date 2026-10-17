// Champs d'un métier (lib/metier-champs.mjs) : les découpages que l'édition du site de dev applique quand un champ change doivent redonner, sur les
// métiers de la base (72 à l'import ; le site de dev, source des données qu'il modifie, peut en créer ou en supprimer), exactement les lignes en place
// (metier_bonus et ses liens de règle, colonnes d'artisanat, metier_objet_depart, metier_recette_famille, résumé et corps de la page).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import {
  ATTRIBUT_DE_CIBLE, CHAMPS_DU_CORPS, artisanatBrut, caracteristiquesDuTest, corpsDeMetier, decouperArtisanat, decouperBonus, decouperEquipement, echapperMarkdown, famillesDeRecette,
  remplacerChampDuCorps, resumeDeDescription, testDArtisanat,
} from '../src/lib/metier-champs.mjs';

const db = ouvrirBase({ sansExemples: false });
const metiers = db.prepare('SELECT m.*, p.resume, p.corps_md FROM metier m JOIN page p ON p.id = m.id ORDER BY m.id').all();
const competences = db.prepare('SELECT id, nom, caracteristique_id, ordre FROM competence ORDER BY ordre').all().map((c) => ({ ...c }));
const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique').all();
const objets = db.prepare('SELECT id, nom_cle FROM objet_depart').all();

test('72 métiers à l’import ; tous ceux de la base sont relus (chacun a sa page)', () => {
  assert.equal(historiqueSite(db).effectifDImport('metier'), 72);
  assert.equal(metiers.length, db.prepare('SELECT count(*) AS n FROM metier').get().n);
});

test('bonus : le découpage redonne metier_bonus ligne pour ligne (rangs, options, valeurs typées, compétence ou attribut visé)', () => {
  const enPlace = db.prepare('SELECT rang, option, texte, valeur, unite, cible, cible_cle, competence_id, attribut FROM metier_bonus WHERE metier_id = ? ORDER BY rang, option');
  for (const m of metiers) assert.deepEqual(decouperBonus(m.bonus_brut, competences), enPlace.all(m.id).map((l) => ({ ...l })), m.id);
});

test('bonus : la virgule d’un texte libre n’est pas un séparateur ; une cible inconnue n’est pas typée', () => {
  assert.deepEqual(decouperBonus('+2% Esquive, +1AP donné par les armures cuir, peau', competences).map((l) => l.texte), ['+2% Esquive', '+1AP donné par les armures cuir, peau']);
  assert.equal(decouperBonus('+1 butin pour les ingrédients utiles en alchimie', competences)[0].valeur, null);
  assert.deepEqual(decouperBonus('+3% Parade OU Esquive', competences).map((l) => [l.option, l.cible, l.valeur, l.unite, l.competence_id]),
    [[1, 'Parade', 3, '%', 'parade'], [2, 'Esquive', 3, '%', 'esquive']]);
});

test('bonus : liens de règle (décisions R33, R37) — la compétence par son nom, « +N INI » vers l’initiative, les vitesses, « compétence sociale au choix » vers les 5 sociales', () => {
  assert.deepEqual(decouperBonus('+1 INI', competences)[0],
    { rang: 1, option: 1, texte: '+1 INI', valeur: 1, unite: null, cible: 'INI', cible_cle: 'ini', competence_id: null, attribut: 'initiative' });
  assert.deepEqual(decouperBonus('+2% arme lourde', competences)[0].competence_id, 'arme-lourde', 'casse et accents ignorés');
  // vitesse et vitesse de nage (décision R37) : « Vitesse nage », « Vitesse au sol pour le sprint » et les noms de la fiche
  assert.deepEqual(['competence_id', 'attribut', 'valeur'].map((c) => decouperBonus('+1 Vitesse nage', competences)[0][c]), [null, 'vitesse_nage', 1]);
  assert.deepEqual(['attribut', 'valeur', 'cible'].map((c) => decouperBonus('+1 Vitesse au sol pour le sprint', competences)[0][c]), ['vitesse', 1, 'Vitesse au sol pour le sprint']);
  assert.equal(decouperBonus('+2 Vitesse de nage', competences)[0].attribut, 'vitesse_nage');
  assert.equal(decouperBonus('+1 Vitesse', competences)[0].attribut, 'vitesse');
  const sociales = competences.filter((c) => c.caracteristique_id === 'social').map((c) => c.id);
  assert.deepEqual(decouperBonus('+5% dans une compétence sociale au choix', competences).map((l) => [l.rang, l.competence_id, l.valeur]), sociales.map((id) => [1, id, 5]));
  assert.equal(decouperBonus('+5% dans une compétence magique au choix', competences)[0].valeur, null, 'caractéristique inconnue : texte libre');
  // toute ligne typée qui nomme une compétence y est liée, et seule « INI » vise un attribut
  const lignes = db.prepare('SELECT b.*, c.id AS par_nom FROM metier_bonus b LEFT JOIN competence c ON c.id = b.cible_cle').all();
  for (const l of lignes) {
    if (l.par_nom) assert.equal(l.competence_id, l.par_nom, `${l.metier_id} ${l.rang}.${l.option}`);
    assert.equal(l.attribut, ATTRIBUT_DE_CIBLE[l.cible_cle] ?? null, `${l.metier_id} ${l.rang}.${l.option}`);
  }
});

test('artisanat : « Rien », texte et test entre crochets ; deux caractéristiques pour « A + B », « Artisanat A + B », « A x2 » (décision R34)', () => {
  for (const m of metiers) {
    // le découpage lit le texte sans les balises du glossaire (artisanat_texte, saisi sur le site de dev, les garde : artisanat_brut en est refait)
    const attendu = { peut_fabriquer: m.peut_fabriquer, artisanat_texte: texteSansBalises(m.artisanat_texte), test_brut: m.test_brut, test_carac_1_id: m.test_carac_1_id, test_carac_2_id: m.test_carac_2_id };
    assert.deepEqual(decouperArtisanat(m.artisanat_brut, caracteristiques), attendu, m.id);
  }
  assert.deepEqual(caracteristiquesDuTest('PERCEPTION x2', caracteristiques), ['perception', 'perception']);
  assert.deepEqual(caracteristiquesDuTest('Artisanat SOCIAL + INTELLIGENCE', caracteristiques), ['social', 'intelligence']);
  assert.deepEqual(caracteristiquesDuTest('FORCE  + VOLONTÉ', caracteristiques), ['force', 'volonte']);
  assert.equal(caracteristiquesDuTest('FORCE ou CHARISME', caracteristiques), null);
  // chaque métier qui a un test entre crochets a ses deux caractéristiques
  assert.deepEqual(metiers.filter((m) => m.test_brut && !m.test_carac_1_id).map((m) => m.id), []);
  // recomposer le champ depuis ses parties redonne la source quand le test est écrit comme elle
  assert.equal(testDArtisanat('force', 'volonte', caracteristiques), 'FORCE + VOLONTÉ');
  assert.equal(testDArtisanat('force', null, caracteristiques), null);
  for (const m of metiers) assert.equal(artisanatBrut(m.artisanat_texte, m.test_brut), m.artisanat_brut.trim(), m.id);
});

test('objets de départ : l’équipement découpé redonne metier_objet_depart (décision R35)', () => {
  const enPlace = db.prepare('SELECT rang, option, texte, objet_depart_id FROM metier_objet_depart WHERE metier_id = ? ORDER BY rang, option');
  for (const m of metiers) assert.deepEqual(decouperEquipement(m.equipement_brut, objets), enPlace.all(m.id).map((l) => ({ ...l })), m.id);
  assert.deepEqual(decouperEquipement('Rien', objets), []);
  assert.deepEqual(decouperEquipement('Pelle OU faucille en acier (arme)', objets).map((o) => [o.rang, o.option, o.texte]), [[1, 1, 'Pelle'], [1, 2, 'faucille en acier (arme)']]);
  assert.equal(decouperEquipement('Crochet (x3)', objets)[0].objet_depart_id, db.prepare("SELECT id FROM objet_depart WHERE nom_cle = 'crochet'").get()?.id ?? null);
});

test('familles de recettes : celles de metier_recette_famille, mot de la source compris', () => {
  const enPlace = db.prepare('SELECT famille, mot_source FROM metier_recette_famille WHERE metier_id = ?');
  const ordre = (l) => [...l].sort((a, b) => a.famille.localeCompare(b.famille));
  for (const m of metiers) assert.deepEqual(ordre(famillesDeRecette(m.artisanat_brut)), ordre(enPlace.all(m.id).map((l) => ({ ...l }))), m.id);
});

test('résumé de la page : la première phrase de la description', () => {
  for (const m of metiers) assert.equal(resumeDeDescription(m.description), m.resume, m.id);
});

test('corps de la page : remplacer un champ ne touche qu’à sa ligne ; un métier créé a les cinq champs dans l’ordre', () => {
  const alchimiste = metiers.find((m) => m.id === 'metiers/alchimiste');
  const corps = remplacerChampDuCorps(alchimiste.corps_md, 'Bonus', '+4% Connaissance');
  assert.match(corps, /^\*\*Bonus :\*\* \+4% Connaissance$/m);
  assert.equal(corps.replace(/^\*\*Bonus :\*\*.*$/m, ''), alchimiste.corps_md.replace(/^\*\*Bonus :\*\*.*$/m, ''), 'le lien [[Alchimie primitive]] reste');
  assert.match(remplacerChampDuCorps(alchimiste.corps_md, 'Avantage possible', null), /^\*\*Avantage possible :\*\*$/m);
  assert.equal(echapperMarkdown('Test [FORCE + VOLONTÉ] *x*'), 'Test \\[FORCE + VOLONTÉ\\] \\*x\\*');
  // les métiers dont aucun champ n'a de lien se réécrivent à l'identique (crochets du test échappés comme dans la source)
  const sansLien = metiers.filter((m) => !m.corps_md.includes('[['));
  assert.ok(sansLien.length >= 70);
  for (const m of sansLien) assert.equal(corpsDeMetier(m), m.corps_md.replace(/^\n/, ''), m.id);
  assert.deepEqual(CHAMPS_DU_CORPS.map((c) => c.colonne), ['description', 'bonus_brut', 'artisanat_brut', 'equipement_brut', 'avantage_brut']);
});
