-- 0065-couts-des-sorts-tranches : les 26 coûts de sorts que la migration 0063 (décision R105) avait laissés dans l'écriture du classeur, tranchés par le
-- propriétaire le 2026-10-18 (décision R106 ; docs/sql/a-valider.md §5, questions S3 à S28). Migration de DONNÉES.
--   Chaque sort reçoit son « Coût » (cout_brut : la consommation de chakra, « 0 », « X » ou « N/A ») et son « Coût secondaire » (cout_secondaire : un
--   second coût, « 5% santé par tour », « 1 à 5 âmes », « X Sang », « 50% corruption », ou une précision, « Par tour et par cible », « Pour 1
--   barrière », « Par NPM de la créature invoquée ») tels que le propriétaire les a écrits ; l'orthographe de ses réponses est corrigée (« Charka »,
--   « crée », « saccrifée », « 1 dégâts », espaces doublées) et chaque correction est notée dans le registre 0065-couts-des-sorts-tranches.json (champ
--   `orthographe`), relu par client/test/sort-cout-secondaire.test.mjs. La partie Arcane de R105 (« la mention canalisé dans le cout secondaire ») est
--   remplacée par R106 : « Au lieu de mettre "canalysé" on remet "Par tour" », et le type de canalisation est écrit dans le coût secondaire.
--   Les colonnes typées suivent (lib/sort-analyse.mjs#analyserCout : cout_chakra pour un nombre, NULL pour « X » et « N/A » ; la ressource de la 4ème
--   barre pour « X Sang ») ; aucun de ces coûts n'écrivait d'expression de NM (sort_bonus_maitrise n'a pas de ligne « cout » pour eux) : rien d'autre ne
--   change. La case « Coût » de chaque sort dans le corps Markdown de la page de sa magie (recherche, [[liens]]) écrit les deux coûts en une case
--   (lib/sort-cout.mjs#coutEnUneCase : « 3 par tour et par cible », « 5% santé par tour ») ; le reste du corps est rendu octet pour octet. Ces coûts
--   ne se modifiaient pas encore sur le site de dev sans être tranchés : rien ne va dans historique_modification.

-- 1. Les 26 sorts : « Coût » et « Coût secondaire », leurs colonnes typées (lib/sort-analyse.mjs#analyserCout) ; chaque ligne n'est touchée que si
--    elle écrit encore le coût du classeur (registre `avant`) et pas de coût secondaire.
-- S3 : Arcane › Rune Arcane
UPDATE sort SET cout_brut = '3', cout_secondaire = 'Par tour et par cible', cout_chakra = 3, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:rune-arcane' AND cout_brut = '3xN/tour' AND cout_secondaire IS NULL;
-- S4 : Arcane › Rune Arcane multiple
UPDATE sort SET cout_brut = '10', cout_secondaire = 'Par tour et par cible', cout_chakra = 10, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:rune-arcane-multiple' AND cout_brut = '10xN/tour' AND cout_secondaire IS NULL;
-- S5 : Arcane › Peau de Chakra
UPDATE sort SET cout_brut = '13', cout_secondaire = 'Par tour et par cible', cout_chakra = 13, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:peau-de-chakra' AND cout_brut = '13xN/tour' AND cout_secondaire IS NULL;
-- S6 : Arcane › Vision magique
UPDATE sort SET cout_brut = '8', cout_secondaire = 'Par jour', cout_chakra = 8, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:vision-magique' AND cout_brut = '8xN/heure' AND cout_secondaire IS NULL;
-- S7 : Arcane › Inhalation magique
UPDATE sort SET cout_brut = '0', cout_secondaire = '5% santé par tour', cout_chakra = 0, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:inhalation-magique' AND cout_brut = '5% santé/tour' AND cout_secondaire IS NULL;
-- S8 : Arcane › Voile Chakratique
UPDATE sort SET cout_brut = '0', cout_secondaire = '15% santé par tour', cout_chakra = 0, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:voile-chakratique' AND cout_brut = '15% santé/tour' AND cout_secondaire IS NULL;
-- S9 : Glace › Exécution froide
UPDATE sort SET cout_brut = '20', cout_secondaire = 'Par tour', cout_chakra = 20, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-la-glace#sort:execution-froide' AND cout_brut = '20/tour' AND cout_secondaire IS NULL;
-- S10 : Arcane › Charge d'énergie
UPDATE sort SET cout_brut = '2', cout_secondaire = 'Pour 1 dégât supplémentaire', cout_chakra = 2, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:charge-denergie' AND cout_brut = '2=1 dégâts' AND cout_secondaire IS NULL;
-- S11 : Arcane › Souffle magique
UPDATE sort SET cout_brut = 'X', cout_secondaire = NULL, cout_chakra = NULL, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:souffle-magique' AND cout_brut = 'Choix' AND cout_secondaire IS NULL;
-- S12 : Arcane › Échange
UPDATE sort SET cout_brut = '2', cout_secondaire = 'Pour 1 barrière', cout_chakra = 2, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:echange' AND cout_brut = 'Choix' AND cout_secondaire IS NULL;
-- S13 : Arcane › Pluie de Chakra
UPDATE sort SET cout_brut = 'N/A', cout_secondaire = '25% Chakra maximum', cout_chakra = NULL, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:pluie-de-chakra' AND cout_brut = '25%' AND cout_secondaire IS NULL;
-- S14 : Arcane › Forge-Magie
UPDATE sort SET cout_brut = '2', cout_secondaire = 'Par taille de l''arme créée', cout_chakra = 2, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-larcane#sort:forge-magie' AND cout_brut = '2/taille' AND cout_secondaire IS NULL;
-- S15 : Glace › Sculpteur glacé
UPDATE sort SET cout_brut = '3', cout_secondaire = 'Par taille créée', cout_chakra = 3, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-la-glace#sort:sculpteur-glace' AND cout_brut = '3 / Taille' AND cout_secondaire IS NULL;
-- S16 : Vide › Télékinésie
UPDATE sort SET cout_brut = '4', cout_secondaire = 'Par taille créée', cout_chakra = 4, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-du-vide#sort:telekinesie' AND cout_brut = '4/taille' AND cout_secondaire IS NULL;
-- S17 : Vide › Lien mental
UPDATE sort SET cout_brut = '3', cout_secondaire = 'Par personne', cout_chakra = 3, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-du-vide#sort:lien-mental' AND cout_brut = '3/perso' AND cout_secondaire IS NULL;
-- S18 : Espace/Temps › Image diffuse
UPDATE sort SET cout_brut = '10', cout_secondaire = 'Par clone', cout_chakra = 10, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse' AND cout_brut = '10/Clones' AND cout_secondaire IS NULL;
-- S19 : Terre › Sable changeant
UPDATE sort SET cout_brut = '10', cout_secondaire = 'Par zone de 3x3', cout_chakra = 10, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-la-terre#sort:sable-changeant' AND cout_brut = '10/3x3' AND cout_secondaire IS NULL;
-- S20 : Terre › Appel aux Golems
UPDATE sort SET cout_brut = '6', cout_secondaire = 'Par NPM de la créature invoquée', cout_chakra = 6, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-la-terre#sort:appel-aux-golems' AND cout_brut = '6 (xNP de créature)' AND cout_secondaire IS NULL;
-- S21 : Ombre › Manteau noir
UPDATE sort SET cout_brut = '7', cout_secondaire = 'Par NPM de la créature sacrifiée', cout_chakra = 7, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-lombre#sort:manteau-noir' AND cout_brut = '7 (xNP de créature)' AND cout_secondaire IS NULL;
-- S22 : Ombre › Marionnette de l'ombre
UPDATE sort SET cout_brut = '5', cout_secondaire = 'Par NPM de la créature invoquée. +10% Barrière', cout_chakra = 5, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-lombre#sort:marionnette-de-lombre' AND cout_brut = '5 + 10% BA (xNPM de créature)' AND cout_secondaire IS NULL;
-- S23 : Nécromancie › Animation de mort
UPDATE sort SET cout_brut = '5', cout_secondaire = 'Par NPM de la créature invoquée. +1 Âme par NPM de la créature invoquée.', cout_chakra = 5, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND cout_brut = '5 + 1 âme (xNPM de créature)' AND cout_secondaire IS NULL;
-- S24 : Nécromancie › Forces des âmes
UPDATE sort SET cout_brut = '0', cout_secondaire = '1 à 5 âmes', cout_chakra = 0, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-la-necromancie#sort:forces-des-ames' AND cout_brut = '1 âme pour +3 dégâts' AND cout_secondaire IS NULL;
-- S25 : Sang › Perfusion
UPDATE sort SET cout_brut = '0', cout_secondaire = 'X Sang', cout_chakra = 0, cout_ressource = 'sang', cout_ressource_valeur = NULL
WHERE id = 'magies/magie-du-sang#sort:perfusion' AND cout_brut = 'Variable' AND cout_secondaire IS NULL;
-- S26 : Vide › Métronome
UPDATE sort SET cout_brut = 'N/A', cout_secondaire = 'Aléatoire', cout_chakra = NULL, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-du-vide#sort:metronome' AND cout_brut = 'Variable' AND cout_secondaire IS NULL;
-- S27 : Corruption › Pluie huileuse
UPDATE sort SET cout_brut = '0', cout_secondaire = '50% corruption', cout_chakra = 0, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-la-corruption#sort:pluie-huileuse' AND cout_brut = '50% CR max' AND cout_secondaire IS NULL;
-- S28 : Corruption › Sapeur
UPDATE sort SET cout_brut = '0', cout_secondaire = 'X Corruption', cout_chakra = 0, cout_ressource = NULL, cout_ressource_valeur = NULL
WHERE id = 'magies/magie-de-la-corruption#sort:sapeur' AND cout_brut = 'x CR' AND cout_secondaire IS NULL;

-- garde : les 26 sorts portent leurs deux coûts (un registre périmé, une ligne déjà modifiée sur le site de dev : la migration échoue)
CREATE TEMP TABLE garde_0065_sorts (couts_tranches INTEGER NOT NULL CHECK (couts_tranches = 26));
INSERT INTO garde_0065_sorts SELECT count(*) FROM sort WHERE (id, cout_brut, coalesce(cout_secondaire, '')) IN (VALUES
  ('magies/magie-de-larcane#sort:rune-arcane', '3', 'Par tour et par cible'),
  ('magies/magie-de-larcane#sort:rune-arcane-multiple', '10', 'Par tour et par cible'),
  ('magies/magie-de-larcane#sort:peau-de-chakra', '13', 'Par tour et par cible'),
  ('magies/magie-de-larcane#sort:vision-magique', '8', 'Par jour'),
  ('magies/magie-de-larcane#sort:inhalation-magique', '0', '5% santé par tour'),
  ('magies/magie-de-larcane#sort:voile-chakratique', '0', '15% santé par tour'),
  ('magies/magie-de-la-glace#sort:execution-froide', '20', 'Par tour'),
  ('magies/magie-de-larcane#sort:charge-denergie', '2', 'Pour 1 dégât supplémentaire'),
  ('magies/magie-de-larcane#sort:souffle-magique', 'X', ''),
  ('magies/magie-de-larcane#sort:echange', '2', 'Pour 1 barrière'),
  ('magies/magie-de-larcane#sort:pluie-de-chakra', 'N/A', '25% Chakra maximum'),
  ('magies/magie-de-larcane#sort:forge-magie', '2', 'Par taille de l''arme créée'),
  ('magies/magie-de-la-glace#sort:sculpteur-glace', '3', 'Par taille créée'),
  ('magies/magie-du-vide#sort:telekinesie', '4', 'Par taille créée'),
  ('magies/magie-du-vide#sort:lien-mental', '3', 'Par personne'),
  ('magies/magie-de-lespace-temps#sort:image-diffuse', '10', 'Par clone'),
  ('magies/magie-de-la-terre#sort:sable-changeant', '10', 'Par zone de 3x3'),
  ('magies/magie-de-la-terre#sort:appel-aux-golems', '6', 'Par NPM de la créature invoquée'),
  ('magies/magie-de-lombre#sort:manteau-noir', '7', 'Par NPM de la créature sacrifiée'),
  ('magies/magie-de-lombre#sort:marionnette-de-lombre', '5', 'Par NPM de la créature invoquée. +10% Barrière'),
  ('magies/magie-de-la-necromancie#sort:animation-de-mort', '5', 'Par NPM de la créature invoquée. +1 Âme par NPM de la créature invoquée.'),
  ('magies/magie-de-la-necromancie#sort:forces-des-ames', '0', '1 à 5 âmes'),
  ('magies/magie-du-sang#sort:perfusion', '0', 'X Sang'),
  ('magies/magie-du-vide#sort:metronome', 'N/A', 'Aléatoire'),
  ('magies/magie-de-la-corruption#sort:pluie-huileuse', '0', '50% corruption'),
  ('magies/magie-de-la-corruption#sort:sapeur', '0', 'X Corruption')
);
DROP TABLE garde_0065_sorts;

-- 2. La case « Coût » de chaque sort dans le tableau « ## Sorts » de la page de sa magie : les deux coûts en une case (lib/sort-cout.mjs#coutEnUneCase,
--    « 3 par tour et par cible »), la ligne réécrite comme le service le ferait (lib/corps-magies.mjs#corpsDeMagieApres) ; rien d'autre ne change.
UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Charge d''énergie | Amplification (IC pour 3 NM) | 2=1 dégâts | Soi-même | 1.0 | +X dégâts magiques | Dégâts magiques supplémentaires pour la prochaine attaque magique. |',
  '| 1.0 | Charge d''énergie | Amplification (IC pour 3 NM) | 2 pour 1 dégât supplémentaire | Soi-même | 1.0 | +X dégâts magiques | Dégâts magiques supplémentaires pour la prochaine attaque magique. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 1.0 | Charge d''énergie | Amplification (IC pour 3 NM) | 2=1 dégâts | Soi-même | 1.0 | +X dégâts magiques | Dégâts magiques supplémentaires pour la prochaine attaque magique. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Rune Arcane | Amplification<br>(IC x 1/NM) | 3xN/tour | 3.0 | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |',
  '| 1.0 | Rune Arcane | Amplification<br>(IC x 1/NM) | 3 par tour et par cible | 3.0 | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 1.0 | Rune Arcane | Amplification<br>(IC x 1/NM) | 3xN/tour | 3.0 | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Forge-Magie | Amplification (IC) | 2/taille | Soi-même | 1.0 | / | Permet de créer une catégorie d''arme à usage unique à l''aide de chakra pur. (+1 utilisation/NM) |',
  '| 1.0 | Forge-Magie | Amplification (IC) | 2 par taille de l''arme créée | Soi-même | 1.0 | / | Permet de créer une catégorie d''arme à usage unique à l''aide de chakra pur. (+1 utilisation/NM) |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 1.0 | Forge-Magie | Amplification (IC) | 2/taille | Soi-même | 1.0 | / | Permet de créer une catégorie d''arme à usage unique à l''aide de chakra pur. (+1 utilisation/NM) |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Inhalation magique | Amplification | 5% santé/tour | Soi-même | 1.0 | +5% de {{chakra\|chakra}} | Aspire le chakra ambiant pour régénérer la réserve personnelle. |',
  '| 2.0 | Inhalation magique | Amplification | 5% santé par tour | Soi-même | 1.0 | +5% de {{chakra\|chakra}} | Aspire le chakra ambiant pour régénérer la réserve personnelle. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 2.0 | Inhalation magique | Amplification | 5% santé/tour | Soi-même | 1.0 | +5% de {{chakra\|chakra}} | Aspire le chakra ambiant pour régénérer la réserve personnelle. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Souffle magique | Amplification | Choix | 2 (+1/NM) | Cône | Donne X {{chakra\|Chakra}} | Souffle du {{chakra\|chakra}} pour en donner une quantité au choix à la ou aux cibles. S''il y a plusieurs cibles, le {{chakra\|chakra}} donné est divisé. |',
  '| 2.0 | Souffle magique | Amplification | X | 2 (+1/NM) | Cône | Donne X {{chakra\|Chakra}} | Souffle du {{chakra\|chakra}} pour en donner une quantité au choix à la ou aux cibles. S''il y a plusieurs cibles, le {{chakra\|chakra}} donné est divisé. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 2.0 | Souffle magique | Amplification | Choix | 2 (+1/NM) | Cône | Donne X {{chakra\|Chakra}} | Souffle du {{chakra\|chakra}} pour en donner une quantité au choix à la ou aux cibles. S''il y a plusieurs cibles, le {{chakra\|chakra}} donné est divisé. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Échange | Soin | Choix | 1 (+1/NM) | 1.0 | / | Permet d''échanger son {{chakra\|chakra}} en {{barriere\|barrière}}. 2CK = 1BA (3CK = 2BA/3NM) |',
  '| 2.0 | Échange | Soin | 2 pour 1 barrière | 1 (+1/NM) | 1.0 | / | Permet d''échanger son {{chakra\|chakra}} en {{barriere\|barrière}}. 2CK = 1BA (3CK = 2BA/3NM) |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 2.0 | Échange | Soin | Choix | 1 (+1/NM) | 1.0 | / | Permet d''échanger son {{chakra\|chakra}} en {{barriere\|barrière}}. 2CK = 1BA (3CK = 2BA/3NM) |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Vision magique | Amplification (IC) | 8xN/heure | Soi-même | 1.0 | / | Permet de voir les auras magiques à travers les obstacles. |',
  '| 2.0 | Vision magique | Amplification (IC) | 8 par jour | Soi-même | 1.0 | / | Permet de voir les auras magiques à travers les obstacles. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 2.0 | Vision magique | Amplification (IC) | 8xN/heure | Soi-même | 1.0 | / | Permet de voir les auras magiques à travers les obstacles. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 3.0 | Rune Arcane multiple | Amplification<br>(IC x 1/NM) | 10xN/tour | Tous les alliés | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |',
  '| 3.0 | Rune Arcane multiple | Amplification<br>(IC x 1/NM) | 10 par tour et par cible | Tous les alliés | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 3.0 | Rune Arcane multiple | Amplification<br>(IC x 1/NM) | 10xN/tour | Tous les alliés | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 4.0 | Peau de Chakra | Amplification<br>(IC x 1/NM) | 13xN/tour | 3.0 | 1.0 | -20% dégâts magiques | Réduit les dégâts magiques subis. |',
  '| 4.0 | Peau de Chakra | Amplification<br>(IC x 1/NM) | 13 par tour et par cible | 3.0 | 1.0 | -20% dégâts magiques | Réduit les dégâts magiques subis. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 4.0 | Peau de Chakra | Amplification<br>(IC x 1/NM) | 13xN/tour | 3.0 | 1.0 | -20% dégâts magiques | Réduit les dégâts magiques subis. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 4.0 | Pluie de Chakra | Amplification | 25% | 3 (+1/NM) | Carré 4x4 | / | Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi 25% de leur {{chakra\|chakra}}. |',
  '| 4.0 | Pluie de Chakra | Amplification | 25% Chakra maximum | 3 (+1/NM) | Carré 4x4 | / | Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi 25% de leur {{chakra\|chakra}}. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 4.0 | Pluie de Chakra | Amplification | 25% | 3 (+1/NM) | Carré 4x4 | / | Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi 25% de leur {{chakra\|chakra}}. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 5.0 | Voile Chakratique | Amplification | 15% santé/tour | Soi-même | 1.0 | / | Permet au {{chakra\|Chakra}} de prendre le rôle de la Santé. Le coût en santé passe à 10% si 3NM. |',
  '| 5.0 | Voile Chakratique | Amplification | 15% santé par tour | Soi-même | 1.0 | / | Permet au {{chakra\|Chakra}} de prendre le rôle de la Santé. Le coût en santé passe à 10% si 3NM. |')
WHERE id = 'magies/magie-de-larcane' AND instr(corps_md, '| 5.0 | Voile Chakratique | Amplification | 15% santé/tour | Soi-même | 1.0 | / | Permet au {{chakra\|Chakra}} de prendre le rôle de la Santé. Le coût en santé passe à 10% si 3NM. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Sculpteur glacé | Construction (IC pour 3 NM) | 3 / Taille | Soi-même | 1.0 | / | Permet de créer un objet fait de glace. Sert 1 fois. Une taille = une épée en taille |',
  '| 1.0 | Sculpteur glacé | Construction (IC pour 3 NM) | 3 par taille créée | Soi-même | 1.0 | / | Permet de créer un objet fait de glace. Sert 1 fois. Une taille = une épée en taille |')
WHERE id = 'magies/magie-de-la-glace' AND instr(corps_md, '| 1.0 | Sculpteur glacé | Construction (IC pour 3 NM) | 3 / Taille | Soi-même | 1.0 | / | Permet de créer un objet fait de glace. Sert 1 fois. Une taille = une épée en taille |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 5.0 | Exécution froide | Entrave | 20/tour | 3 (+1/NM) | 1.0 | 20 dégâts perce AM/tour | Sort à maintenir pendant 4 tours, au bout du 5ème tour, la victime meurt. |',
  '| 5.0 | Exécution froide | Entrave | 20 par tour | 3 (+1/NM) | 1.0 | 20 dégâts perce AM/tour | Sort à maintenir pendant 4 tours, au bout du 5ème tour, la victime meurt. |')
WHERE id = 'magies/magie-de-la-glace' AND instr(corps_md, '| 5.0 | Exécution froide | Entrave | 20/tour | 3 (+1/NM) | 1.0 | 20 dégâts perce AM/tour | Sort à maintenir pendant 4 tours, au bout du 5ème tour, la victime meurt. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Télékinésie | Amplification (IC pour 3NM) | 4/taille | Vue | 1.0 | Variable | Permet au niveau 3 de maîtrise de soulever un objet et l''envoyer dans le même tour. |',
  '| 1.0 | Télékinésie | Amplification (IC pour 3NM) | 4 par taille créée | Vue | 1.0 | Variable | Permet au niveau 3 de maîtrise de soulever un objet et l''envoyer dans le même tour. |')
WHERE id = 'magies/magie-du-vide' AND instr(corps_md, '| 1.0 | Télékinésie | Amplification (IC pour 3NM) | 4/taille | Vue | 1.0 | Variable | Permet au niveau 3 de maîtrise de soulever un objet et l''envoyer dans le même tour. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Lien mental | Amplification (IC pour 3 NM) | 3/perso | 50 m | Vue | / | Permet de communiquer par la pensée. |',
  '| 2.0 | Lien mental | Amplification (IC pour 3 NM) | 3 par personne | 50 m | Vue | / | Permet de communiquer par la pensée. |')
WHERE id = 'magies/magie-du-vide' AND instr(corps_md, '| 2.0 | Lien mental | Amplification (IC pour 3 NM) | 3/perso | 50 m | Vue | / | Permet de communiquer par la pensée. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 5.0 | Métronome | Aléatoire | Variable | Variable | Variable | Variable | Lance un sort aléatoire (1d12 pour la magie => 1d4 le niveau => 1d6 le sort)<br>Les NM sont utiles pour le sort aléatoire |',
  '| 5.0 | Métronome | Aléatoire | Aléatoire | Variable | Variable | Variable | Lance un sort aléatoire (1d12 pour la magie => 1d4 le niveau => 1d6 le sort)<br>Les NM sont utiles pour le sort aléatoire |')
WHERE id = 'magies/magie-du-vide' AND instr(corps_md, '| 5.0 | Métronome | Aléatoire | Variable | Variable | Variable | Variable | Lance un sort aléatoire (1d12 pour la magie => 1d4 le niveau => 1d6 le sort)<br>Les NM sont utiles pour le sort aléatoire |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 4.0 | Image diffuse | Amplification (IC pour 3 NM) | 10/Clones | Soi-même | Carré 4x4 | / | Invoque 1 ou 2 clones (+1/NM) passifs du lanceur. |',
  '| 4.0 | Image diffuse | Amplification (IC pour 3 NM) | 10 par clone | Soi-même | Carré 4x4 | / | Invoque 1 ou 2 clones (+1/NM) passifs du lanceur. |')
WHERE id = 'magies/magie-de-lespace-temps' AND instr(corps_md, '| 4.0 | Image diffuse | Amplification (IC pour 3 NM) | 10/Clones | Soi-même | Carré 4x4 | / | Invoque 1 ou 2 clones (+1/NM) passifs du lanceur. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Appel aux Golems | Invocation (IC pour 3 NM) | 6 (xNP de créature) | 3.0 | 1.0 | / | Permet d''invoquer des golems (voir invocation). Sort interdit aux familiers et aux invocations. |',
  '| 1.0 | Appel aux Golems | Invocation (IC pour 3 NM) | 6 par NPM de la créature invoquée | 3.0 | 1.0 | / | Permet d''invoquer des golems (voir invocation). Sort interdit aux familiers et aux invocations. |')
WHERE id = 'magies/magie-de-la-terre' AND instr(corps_md, '| 1.0 | Appel aux Golems | Invocation (IC pour 3 NM) | 6 (xNP de créature) | 3.0 | 1.0 | / | Permet d''invoquer des golems (voir invocation). Sort interdit aux familiers et aux invocations. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 3.0 | Sable changeant | Construction | 10/3x3 | 2 (+2/NM) | Variable | / | Permet de créer un terrain sur lequel il est difficile de bouger. |',
  '| 3.0 | Sable changeant | Construction | 10 par zone de 3x3 | 2 (+2/NM) | Variable | / | Permet de créer un terrain sur lequel il est difficile de bouger. |')
WHERE id = 'magies/magie-de-la-terre' AND instr(corps_md, '| 3.0 | Sable changeant | Construction | 10/3x3 | 2 (+2/NM) | Variable | / | Permet de créer un terrain sur lequel il est difficile de bouger. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Marionnette de l''ombre | Invocation (IC pour 3 NM) | 5 + 10% BA (xNPM de créature) | 3.0 | 1.0 | / | Permet d''animer sa propre ombre (voir invocation) |',
  '| 1.0 | Marionnette de l''ombre | Invocation (IC pour 3 NM) | 5 par NPM de la créature invoquée. +10% Barrière | 3.0 | 1.0 | / | Permet d''animer sa propre ombre (voir invocation) |')
WHERE id = 'magies/magie-de-lombre' AND instr(corps_md, '| 1.0 | Marionnette de l''ombre | Invocation (IC pour 3 NM) | 5 + 10% BA (xNPM de créature) | 3.0 | 1.0 | / | Permet d''animer sa propre ombre (voir invocation) |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Manteau noir | Amplification (IC pour 3 NM) | 7 (xNP de créature) | Soi-même | 1.0 | Variable | Permet de sacrifier l''invocation de l''ombre pour avoir des bonus pendant 3 tours (voir invocation) |',
  '| 2.0 | Manteau noir | Amplification (IC pour 3 NM) | 7 par NPM de la créature sacrifiée | Soi-même | 1.0 | Variable | Permet de sacrifier l''invocation de l''ombre pour avoir des bonus pendant 3 tours (voir invocation) |')
WHERE id = 'magies/magie-de-lombre' AND instr(corps_md, '| 2.0 | Manteau noir | Amplification (IC pour 3 NM) | 7 (xNP de créature) | Soi-même | 1.0 | Variable | Permet de sacrifier l''invocation de l''ombre pour avoir des bonus pendant 3 tours (voir invocation) |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Animation de mort | Invocation (IC pour 3 NM) | 5 + 1 âme (xNPM de créature) | 3.0 | 1.0 | / | Permet d''invoquer des non-morts (voir invocation) |',
  '| 1.0 | Animation de mort | Invocation (IC pour 3 NM) | 5 par NPM de la créature invoquée. +1 Âme par NPM de la créature invoquée. | 3.0 | 1.0 | / | Permet d''invoquer des non-morts (voir invocation) |')
WHERE id = 'magies/magie-de-la-necromancie' AND instr(corps_md, '| 1.0 | Animation de mort | Invocation (IC pour 3 NM) | 5 + 1 âme (xNPM de créature) | 3.0 | 1.0 | / | Permet d''invoquer des non-morts (voir invocation) |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Forces des âmes | Amplification (IC pour 3 NM) | 1 âme pour +3 dégâts | 0 (+1/NM) | 1.0 | 3 dégâts/1 âme | Permet d''augmenter sa puissance grâce à deux âmes pour le prochain coup. (Maxi 5 âmes d''un coup) |',
  '| 2.0 | Forces des âmes | Amplification (IC pour 3 NM) | 1 à 5 âmes | 0 (+1/NM) | 1.0 | 3 dégâts/1 âme | Permet d''augmenter sa puissance grâce à deux âmes pour le prochain coup. (Maxi 5 âmes d''un coup) |')
WHERE id = 'magies/magie-de-la-necromancie' AND instr(corps_md, '| 2.0 | Forces des âmes | Amplification (IC pour 3 NM) | 1 âme pour +3 dégâts | 0 (+1/NM) | 1.0 | 3 dégâts/1 âme | Permet d''augmenter sa puissance grâce à deux âmes pour le prochain coup. (Maxi 5 âmes d''un coup) |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 4.0 | Perfusion | Soin (IC) | Variable | 4.0 | 1.0 | 4 (+1/NM) soin pour 1 sang | Utilise du sang pour récupérer de la santé. L''inverse est possible aussi de sacrifier de la santé pour récupérer du sang. |',
  '| 4.0 | Perfusion | Soin (IC) | X Sang | 4.0 | 1.0 | 4 (+1/NM) soin pour 1 sang | Utilise du sang pour récupérer de la santé. L''inverse est possible aussi de sacrifier de la santé pour récupérer du sang. |')
WHERE id = 'magies/magie-du-sang' AND instr(corps_md, '| 4.0 | Perfusion | Soin (IC) | Variable | 4.0 | 1.0 | 4 (+1/NM) soin pour 1 sang | Utilise du sang pour récupérer de la santé. L''inverse est possible aussi de sacrifier de la santé pour récupérer du sang. |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 4.0 | Pluie huileuse | Météo | 50% CR max | Soi-même | Terrain | / | Pose la météo "Pluie pétrole" pendant 2 tours (+1/NM). |',
  '| 4.0 | Pluie huileuse | Météo | 50% corruption | Soi-même | Terrain | / | Pose la météo "Pluie pétrole" pendant 2 tours (+1/NM). |')
WHERE id = 'magies/magie-de-la-corruption' AND instr(corps_md, '| 4.0 | Pluie huileuse | Météo | 50% CR max | Soi-même | Terrain | / | Pose la météo "Pluie pétrole" pendant 2 tours (+1/NM). |') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '| 5.0 | Sapeur | Entrave | x CR | 3 (+1/NM) | 1.0 | / | Donne autant de {{corruption\|corruption}} à la cible que la réserve actuelle de {{corruption\|corruption}}. |',
  '| 5.0 | Sapeur | Entrave | X Corruption | 3 (+1/NM) | 1.0 | / | Donne autant de {{corruption\|corruption}} à la cible que la réserve actuelle de {{corruption\|corruption}}. |')
WHERE id = 'magies/magie-de-la-corruption' AND instr(corps_md, '| 5.0 | Sapeur | Entrave | x CR | 3 (+1/NM) | 1.0 | / | Donne autant de {{corruption\|corruption}} à la cible que la réserve actuelle de {{corruption\|corruption}}. |') > 0;

-- garde : les 26 lignes réécrites sont dans leur page
CREATE TEMP TABLE garde_0065_corps (lignes INTEGER NOT NULL CHECK (lignes = 26));
INSERT INTO garde_0065_corps SELECT count(*) FROM (VALUES
  ('magies/magie-de-larcane', '| 1.0 | Charge d''énergie | Amplification (IC pour 3 NM) | 2 pour 1 dégât supplémentaire | Soi-même | 1.0 | +X dégâts magiques | Dégâts magiques supplémentaires pour la prochaine attaque magique. |'),
  ('magies/magie-de-larcane', '| 1.0 | Rune Arcane | Amplification<br>(IC x 1/NM) | 3 par tour et par cible | 3.0 | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |'),
  ('magies/magie-de-larcane', '| 1.0 | Forge-Magie | Amplification (IC) | 2 par taille de l''arme créée | Soi-même | 1.0 | / | Permet de créer une catégorie d''arme à usage unique à l''aide de chakra pur. (+1 utilisation/NM) |'),
  ('magies/magie-de-larcane', '| 2.0 | Inhalation magique | Amplification | 5% santé par tour | Soi-même | 1.0 | +5% de {{chakra\|chakra}} | Aspire le chakra ambiant pour régénérer la réserve personnelle. |'),
  ('magies/magie-de-larcane', '| 2.0 | Souffle magique | Amplification | X | 2 (+1/NM) | Cône | Donne X {{chakra\|Chakra}} | Souffle du {{chakra\|chakra}} pour en donner une quantité au choix à la ou aux cibles. S''il y a plusieurs cibles, le {{chakra\|chakra}} donné est divisé. |'),
  ('magies/magie-de-larcane', '| 2.0 | Échange | Soin | 2 pour 1 barrière | 1 (+1/NM) | 1.0 | / | Permet d''échanger son {{chakra\|chakra}} en {{barriere\|barrière}}. 2CK = 1BA (3CK = 2BA/3NM) |'),
  ('magies/magie-de-larcane', '| 2.0 | Vision magique | Amplification (IC) | 8 par jour | Soi-même | 1.0 | / | Permet de voir les auras magiques à travers les obstacles. |'),
  ('magies/magie-de-larcane', '| 3.0 | Rune Arcane multiple | Amplification<br>(IC x 1/NM) | 10 par tour et par cible | Tous les alliés | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |'),
  ('magies/magie-de-larcane', '| 4.0 | Peau de Chakra | Amplification<br>(IC x 1/NM) | 13 par tour et par cible | 3.0 | 1.0 | -20% dégâts magiques | Réduit les dégâts magiques subis. |'),
  ('magies/magie-de-larcane', '| 4.0 | Pluie de Chakra | Amplification | 25% Chakra maximum | 3 (+1/NM) | Carré 4x4 | / | Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi 25% de leur {{chakra\|chakra}}. |'),
  ('magies/magie-de-larcane', '| 5.0 | Voile Chakratique | Amplification | 15% santé par tour | Soi-même | 1.0 | / | Permet au {{chakra\|Chakra}} de prendre le rôle de la Santé. Le coût en santé passe à 10% si 3NM. |'),
  ('magies/magie-de-la-glace', '| 1.0 | Sculpteur glacé | Construction (IC pour 3 NM) | 3 par taille créée | Soi-même | 1.0 | / | Permet de créer un objet fait de glace. Sert 1 fois. Une taille = une épée en taille |'),
  ('magies/magie-de-la-glace', '| 5.0 | Exécution froide | Entrave | 20 par tour | 3 (+1/NM) | 1.0 | 20 dégâts perce AM/tour | Sort à maintenir pendant 4 tours, au bout du 5ème tour, la victime meurt. |'),
  ('magies/magie-du-vide', '| 1.0 | Télékinésie | Amplification (IC pour 3NM) | 4 par taille créée | Vue | 1.0 | Variable | Permet au niveau 3 de maîtrise de soulever un objet et l''envoyer dans le même tour. |'),
  ('magies/magie-du-vide', '| 2.0 | Lien mental | Amplification (IC pour 3 NM) | 3 par personne | 50 m | Vue | / | Permet de communiquer par la pensée. |'),
  ('magies/magie-du-vide', '| 5.0 | Métronome | Aléatoire | Aléatoire | Variable | Variable | Variable | Lance un sort aléatoire (1d12 pour la magie => 1d4 le niveau => 1d6 le sort)<br>Les NM sont utiles pour le sort aléatoire |'),
  ('magies/magie-de-lespace-temps', '| 4.0 | Image diffuse | Amplification (IC pour 3 NM) | 10 par clone | Soi-même | Carré 4x4 | / | Invoque 1 ou 2 clones (+1/NM) passifs du lanceur. |'),
  ('magies/magie-de-la-terre', '| 1.0 | Appel aux Golems | Invocation (IC pour 3 NM) | 6 par NPM de la créature invoquée | 3.0 | 1.0 | / | Permet d''invoquer des golems (voir invocation). Sort interdit aux familiers et aux invocations. |'),
  ('magies/magie-de-la-terre', '| 3.0 | Sable changeant | Construction | 10 par zone de 3x3 | 2 (+2/NM) | Variable | / | Permet de créer un terrain sur lequel il est difficile de bouger. |'),
  ('magies/magie-de-lombre', '| 1.0 | Marionnette de l''ombre | Invocation (IC pour 3 NM) | 5 par NPM de la créature invoquée. +10% Barrière | 3.0 | 1.0 | / | Permet d''animer sa propre ombre (voir invocation) |'),
  ('magies/magie-de-lombre', '| 2.0 | Manteau noir | Amplification (IC pour 3 NM) | 7 par NPM de la créature sacrifiée | Soi-même | 1.0 | Variable | Permet de sacrifier l''invocation de l''ombre pour avoir des bonus pendant 3 tours (voir invocation) |'),
  ('magies/magie-de-la-necromancie', '| 1.0 | Animation de mort | Invocation (IC pour 3 NM) | 5 par NPM de la créature invoquée. +1 Âme par NPM de la créature invoquée. | 3.0 | 1.0 | / | Permet d''invoquer des non-morts (voir invocation) |'),
  ('magies/magie-de-la-necromancie', '| 2.0 | Forces des âmes | Amplification (IC pour 3 NM) | 1 à 5 âmes | 0 (+1/NM) | 1.0 | 3 dégâts/1 âme | Permet d''augmenter sa puissance grâce à deux âmes pour le prochain coup. (Maxi 5 âmes d''un coup) |'),
  ('magies/magie-du-sang', '| 4.0 | Perfusion | Soin (IC) | X Sang | 4.0 | 1.0 | 4 (+1/NM) soin pour 1 sang | Utilise du sang pour récupérer de la santé. L''inverse est possible aussi de sacrifier de la santé pour récupérer du sang. |'),
  ('magies/magie-de-la-corruption', '| 4.0 | Pluie huileuse | Météo | 50% corruption | Soi-même | Terrain | / | Pose la météo "Pluie pétrole" pendant 2 tours (+1/NM). |'),
  ('magies/magie-de-la-corruption', '| 5.0 | Sapeur | Entrave | X Corruption | 3 (+1/NM) | 1.0 | / | Donne autant de {{corruption\|corruption}} à la cible que la réserve actuelle de {{corruption\|corruption}}. |')
) v JOIN page p ON p.id = v.column1 AND instr(p.corps_md, v.column2) > 0;
DROP TABLE garde_0065_corps;
