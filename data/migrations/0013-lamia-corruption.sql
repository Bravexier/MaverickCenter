-- 0013-lamia-corruption : la Lamia a accès à la Corruption en magie innée (décision R22 du propriétaire : « les Lamia ont accès à la Corruption »).
-- Migration de DONNÉES (aucun changement de structure : seule la version du schéma monte). La matrice « Accessibilité Magie » de la fiche auto V15.2.2
-- met la case Lamia × Corruption (E24) à 0 : c'est une erreur de la fiche (comme le prévoit R8 : « il peut y avoir des ratés »). La liste des magies
-- innées de la Lamia est corrigée partout où elle est écrite :
--   * race_magie (matrice lue par la page de la race, la vue v_race_magie_accessible et les fiches de personnages) : accessible = 1 et valeur_brut = '1'
--     (la CHECK de la table les lie) ; source_ref garde la case E24 et dit la correction ;
--   * page races/lamia : magies_innees du front matter (lu par les pages de magie et le tableau des magies innées de /races/), et la section
--     « Magies accessibles » du Markdown (nombre et liste, dans l'ordre des colonnes de la matrice).
-- Le tableau « Écarts avec la fiche de personnage V15.2.2 » de la page cite la fiche telle quelle (« 13 sur 15 (à 0 dans la matrice : Potentiel Illimité,
-- Corruption) ») : il n'est pas touché. Une réimportation depuis la fiche (tools/sheets/races.py) remettrait 0 tant que la case E24 n'y est pas corrigée.

UPDATE race_magie
SET accessible = 1, valeur_brut = '1', source_ref = 'Fiche auto V15.2.2 › Accessibilité Magie › E24 (0 dans la fiche ; 1 : décision R22 du propriétaire)'
WHERE race_id = 'races/lamia' AND magie_id = 'magies/magie-de-la-corruption' AND accessible = 0 AND valeur_brut = '0';

UPDATE page SET donnees = replace(donnees, '"Sang", "Arcane", "Espace/Temps"', '"Sang", "Arcane", "Corruption", "Espace/Temps"')
WHERE id = 'races/lamia' AND instr(donnees, '"Sang", "Arcane", "Espace/Temps"') > 0;

UPDATE page SET corps_md = replace(
  replace(corps_md, 'Nombre : 13 sur 15.', 'Nombre : 14 sur 15.'),
  'Sang, Arcane, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre',
  'Sang, Arcane, Corruption, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre

Corruption : à 0 dans la matrice de la fiche, accessible d''après le propriétaire du projet (décision R22).')
WHERE id = 'races/lamia' AND instr(corps_md, 'Nombre : 13 sur 15.') > 0
  AND instr(corps_md, 'Sang, Arcane, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre') > 0;
