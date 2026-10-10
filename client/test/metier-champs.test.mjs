// Champs d'un métier (lib/metier-champs.mjs) : les découpages que l'édition du site de dev applique quand un champ change doivent redonner, sur les
// 72 métiers de la base, exactement les lignes en place (metier_bonus, colonnes d'artisanat, metier_recette_famille, résumé et corps de la page).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  CHAMPS_DU_CORPS, corpsDeMetier, decouperArtisanat, decouperBonus, echapperMarkdown, famillesDeRecette, remplacerChampDuCorps, resumeDeDescription,
} from '../src/lib/metier-champs.mjs';

const db = ouvrirBase({ sansExemples: false });
const metiers = db.prepare('SELECT m.*, p.resume, p.corps_md FROM metier m JOIN page p ON p.id = m.id ORDER BY m.id').all();
const competences = db.prepare('SELECT nom FROM competence').all().map((c) => c.nom);
const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique').all();

test('72 métiers relus', () => assert.equal(metiers.length, 72));

test('bonus : le découpage redonne metier_bonus ligne pour ligne (rangs, options, valeurs typées)', () => {
  const enPlace = db.prepare('SELECT rang, option, texte, valeur, unite, cible, cible_cle FROM metier_bonus WHERE metier_id = ? ORDER BY rang, option');
  for (const m of metiers) assert.deepEqual(decouperBonus(m.bonus_brut, competences), enPlace.all(m.id).map((l) => ({ ...l })), m.id);
});

test('bonus : la virgule d’un texte libre n’est pas un séparateur ; une cible inconnue n’est pas typée', () => {
  assert.deepEqual(decouperBonus('+2% Esquive, +1AP donné par les armures cuir, peau', competences).map((l) => l.texte), ['+2% Esquive', '+1AP donné par les armures cuir, peau']);
  assert.equal(decouperBonus('+1 Vitesse au sol pour le sprint', competences)[0].valeur, null);
  assert.deepEqual(decouperBonus('+3% Parade OU Esquive', competences).map((l) => [l.option, l.cible, l.valeur, l.unite]), [[1, 'Parade', 3, '%'], [2, 'Esquive', 3, '%']]);
  assert.deepEqual(decouperBonus('+1 INI', competences)[0], { rang: 1, option: 1, texte: '+1 INI', valeur: 1, unite: null, cible: 'INI', cible_cle: 'ini' });
});

test('artisanat : « Rien », texte et test entre crochets ; caractéristiques typées pour « CARAC + CARAC » seulement', () => {
  for (const m of metiers) {
    const attendu = { peut_fabriquer: m.peut_fabriquer, artisanat_texte: m.artisanat_texte, test_brut: m.test_brut, test_carac_1_id: m.test_carac_1_id, test_carac_2_id: m.test_carac_2_id };
    assert.deepEqual(decouperArtisanat(m.artisanat_brut, caracteristiques), attendu, m.id);
  }
  assert.equal(decouperArtisanat('Peut dessiner [PERCEPTION x2]', caracteristiques).test_carac_1_id, null);
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
