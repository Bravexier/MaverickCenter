-- 0048-ressources-et-craft-mise-a-jour : la mise à jour du classeur « Ressources et Craft » que le propriétaire a validée après le rapprochement de ses
-- classeurs originaux avec la base (décision R83 ; relevé docs/sql/rapprochement-classeurs.md, « Réponses du propriétaire (2026-10-15) » : « Oui met à jour
-- les objets tel que la dernière version des ressources les fait. »), et la décision R84 (liens vers le Google Doc « Alchimie »). Valeurs lues dans
-- l'instantané du classeur original (sources/raw/classeurs/ressources-et-craft.json). Migration de DONNÉES (aucun changement de structure : seule la
-- version du schéma monte). Aucune de ces lignes n'a été modifiée par le site de dev (historique_modification : rien sur ces tables ni sur ces pages).
-- Chaque fois, ce qui recopie la valeur suit, comme le ferait le service d'édition : le corps Markdown de la page (ses lignes de tableau) et les lignes
-- tirées de la valeur (accessoire_effet_cible, découpage de client/src/lib/accessoire-champs.mjs ; colonnes typées d'une amélioration et ligne TOTAL,
-- client/src/lib/armure-champs.mjs). L'orthographe suit les registres existants : « Munition infini avec » s'écrit « Munition infinie avec » comme dans
-- 0005-orthographe-base (lot-35:62, l'Arc d'Arcane) ; registre de cette migration : 0048-ressources-et-craft-mise-a-jour.json.
--
--   * Accessoires, effets de défense 9 (Accessoires!CI60) et 11 (CI64) : « Résistance Arcane et Surcharge Magique », « Résistance Corruption et Surcharge
--     Magique » (la base : « Résistance Surcharge Magique » pour les deux). Un cran de résistance à chaque magie ou altération nommée (décision R54) : la
--     magie d'abord (rang 1), l'altération ensuite (rang 2), dans l'ordre de l'écriture.
--   * Pièces élémentaires, Arbalète d'Eau (BU64) : « Recharge fluide (actif) : Munition infini avec cette arme. » (la base : « … L'arbalète peut absorber
--     l'humidité ambiante… ») ; nom et mode de la capacité inchangés.
--   * Pièces élémentaires, Épée de Lumière (DD8) : « Louons le Soleil » (la base : « Louons la Soleil ») ; texte de la capacité inchangé.
--   * Bouclier, améliorations +1 à +5 (BJ4:BJ12) : 50, 100, 200, 400, 800 RO, ligne TOTAL (BN14, « =BJ4+BJ8+BJ6+BJ10+BJ12 ») 1550 (la base : 500, 1000,
--     2000, 4000, 8000 et 15500). Les effets et les matériaux (« + matériaux », décision R76) ne changent pas.
--   * Décision R84 : les 9 descriptions des fioles en verre et des kits d'alchimiste (Équipement inventaire!BA4:BA22) renvoient au Google Doc « Alchimie »
--     original (1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k), comme l'écrit le classeur original, et non plus à sa copie (1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s,
--     migration 0014) ; le tableau de la page « Équipement inventaire » qui les recopie suit. Le manifeste (sources/sources.json), la table `source`, les
--     sources des pages (page_source) et les archives gardent la copie : elle reste la source des imports.

-- Accessoires : effets de défense 9 et 11
UPDATE accessoire_effet SET libelle = 'Résistance Arcane et Surcharge Magique'
WHERE id = 'ressources/accessoires#effet:defense:9' AND libelle = 'Résistance Surcharge Magique';
UPDATE accessoire_effet SET libelle = 'Résistance Corruption et Surcharge Magique'
WHERE id = 'ressources/accessoires#effet:defense:11' AND libelle = 'Résistance Surcharge Magique';

DELETE FROM accessoire_effet_cible WHERE effet_id IN ('ressources/accessoires#effet:defense:9', 'ressources/accessoires#effet:defense:11');
INSERT INTO accessoire_effet_cible (effet_id, rang, cible, cible_id, valeur, choix, origine, source_ref) VALUES
  ('ressources/accessoires#effet:defense:9', 1, 'resistance', 'magies/magie-de-larcane', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG60:CY60'),
  ('ressources/accessoires#effet:defense:9', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:surcharge-magique', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG60:CY60'),
  ('ressources/accessoires#effet:defense:11', 1, 'resistance', 'magies/magie-de-la-corruption', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG64:CY64'),
  ('ressources/accessoires#effet:defense:11', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:surcharge-magique', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG64:CY64');

UPDATE page SET corps_md = replace(replace(corps_md,
    '| 9.0 | Résistance Surcharge Magique | Niveau 3 | Perle + Perle | 74 Ro |',
    '| 9.0 | Résistance Arcane et Surcharge Magique | Niveau 3 | Perle + Perle | 74 Ro |'),
    '| 11.0 | Résistance Surcharge Magique | Niveau 3 | Onyx + Onyx | 144 Ro |',
    '| 11.0 | Résistance Corruption et Surcharge Magique | Niveau 3 | Onyx + Onyx | 144 Ro |')
WHERE id = 'ressources/accessoires';

-- Pièces élémentaires : Arbalète d'Eau, Épée de Lumière
UPDATE arme_elementaire
SET capacite_texte = 'Munition infinie avec cette arme.',
    capacite_brut = 'Recharge fluide (actif) : Munition infinie avec cette arme.'
WHERE id = 'ressources/pieces-elementaires#arme-elementaire:arbalete:eau'
  AND capacite_brut = 'Recharge fluide (actif) : L’arbalète peut absorber l’humidité ambiante pour créer des carreaux d’eau, évitant au porteur de manquer de munitions.';

UPDATE arme_elementaire
SET capacite_nom = 'Louons le Soleil',
    capacite_brut = replace(capacite_brut, 'Louons la Soleil (action) : ', 'Louons le Soleil (action) : ')
WHERE id = 'ressources/pieces-elementaires#arme-elementaire:epee:lumiere' AND capacite_nom = 'Louons la Soleil';

UPDATE page SET corps_md = replace(replace(corps_md,
    '| Recharge fluide (actif) : L’arbalète peut absorber l’humidité ambiante pour créer des carreaux d’eau, évitant au porteur de manquer de munitions. |',
    '| Recharge fluide (actif) : Munition infinie avec cette arme. |'),
    '| Louons la Soleil (action) : ',
    '| Louons le Soleil (action) : ')
WHERE id = 'ressources/pieces-elementaires';

-- Bouclier : coûts des améliorations +1 à +5 et ligne TOTAL
UPDATE amelioration_equipement SET cout_brut = '50', cout_ro = 50 WHERE id = 'ressources/bouclier#amelioration:bouclier:1' AND cout_brut = '500';
UPDATE amelioration_equipement SET cout_brut = '100', cout_ro = 100 WHERE id = 'ressources/bouclier#amelioration:bouclier:2' AND cout_brut = '1000';
UPDATE amelioration_equipement SET cout_brut = '200', cout_ro = 200 WHERE id = 'ressources/bouclier#amelioration:bouclier:3' AND cout_brut = '2000';
UPDATE amelioration_equipement SET cout_brut = '400', cout_ro = 400 WHERE id = 'ressources/bouclier#amelioration:bouclier:4' AND cout_brut = '4000';
UPDATE amelioration_equipement SET cout_brut = '800', cout_ro = 800 WHERE id = 'ressources/bouclier#amelioration:bouclier:5' AND cout_brut = '8000';
UPDATE amelioration_total SET total_brut = '1550' WHERE cible = 'bouclier' AND total_brut = '15500';

-- les lignes du tableau telles que le service les écrit (client/src/lib/corps-armures.mjs : ligneDAmelioration, ligneDuTotal)
UPDATE page SET corps_md = replace(replace(replace(replace(replace(replace(corps_md,
    '| +1 | 500.0 | +2 AP, +1 cran de solidité |', '| +1 | 50 | +2 AP, +1 cran de solidité |'),
    '| +2 | 1000.0 | +4 AP + matériaux |', '| +2 | 100 | +4 AP + matériaux |'),
    '| +3 | 2000.0 | +6 AP |', '| +3 | 200 | +6 AP |'),
    '| +4 | 4000.0 | +8 AP + matériaux |', '| +4 | 400 | +8 AP + matériaux |'),
    '| +5 | 8000.0 | +10 AP, +1 cran de solidité |', '| +5 | 800 | +10 AP, +1 cran de solidité |'),
    '**TOTAL** : 15500', '**TOTAL** : 1550')
WHERE id = 'ressources/bouclier';

-- Décision R84 : le Google Doc « Alchimie » original dans les descriptions des fioles en verre et des kits d'alchimiste, et dans le tableau qui les recopie
UPDATE ressource
SET description = replace(description, '1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s', '1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k')
WHERE id IN (
    'ressources/equipement-inventaire#materiel:fiole-en-verre-petite',
    'ressources/equipement-inventaire#materiel:fiole-en-verre-moyen',
    'ressources/equipement-inventaire#materiel:fiole-en-verre-super',
    'ressources/equipement-inventaire#materiel:fiole-en-verre-mega',
    'ressources/equipement-inventaire#materiel:kit-dalchimiste-novice',
    'ressources/equipement-inventaire#materiel:kit-dalchimiste-apprenti',
    'ressources/equipement-inventaire#materiel:kit-dalchimiste-avance',
    'ressources/equipement-inventaire#materiel:kit-dalchimiste-expert',
    'ressources/equipement-inventaire#materiel:kit-dalchimiste-maitre')
  AND description = 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing';

UPDATE page
SET corps_md = replace(corps_md, '<https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing>',
                                 '<https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing>')
WHERE id = 'ressources/equipement-inventaire';
