-- 0058-solidite-mot-cle : « solidité » partout à la place de « durabilité », et un mot-clé du glossaire « Solidité » (demande du propriétaire du
-- 2026-10-17 : « met donc "solidité" partout à la place de durabilité. Et profite en pour en faire un mot clé », avec la définition « Etat de
-- l'équipement. Une Solidité à 0 rends l'objet inutilisable et exige une réparation à l'aide d'un kit de réparation, ou d'une compétence d'artisanat
-- adapté ainsi que le même matériaux que l'objet », « ou un truc reformulé ainsi »). Migration de DONNÉES (le schéma ne change pas ; sa version monte
-- d'un cran).
--   1. Glossaire : le mot-clé « Solidité » (id `solidite`), sa définition celle du propriétaire, l'orthographe corrigée (État, rend, adaptée, du même
--      matériau), rien d'autre de changé.
--   2. « Durabilité » quitte les textes de la base (les sources écrivent « solidité » plus de mille fois, « durabilité » une fois) :
--      * l'effet de la Garde horloge (armure élémentaire d'Espace/Temps) : « récupération d'un cran de durabilité » → « de solidité », dans
--        armure_elementaire.effets_brut, armure_elementaire_effet.texte et sa case du tableau de la page « Pièces élémentaires » ;
--      * la page « Pièces élémentaires » : « Durabilité et amélioration » et « 4 crans de solidité/durabilité » ;
--      * le guide : « L'armure a aussi une **durabilité** » (chapitre « L'équipement ») et « une Dur. (durabilité comme pour les armes) » (page « Fiche :
--        armure, défense, bouclier » : « Dur. » reste, c'est l'en-tête de la colonne de la fiche auto V15.2.2).
--   3. Balises du mot-clé (marquage explicite, sous la forme canonique de leur colonne : lib/mots-cles-balises.mjs) là où « solidité » nomme la valeur
--      de l'équipement dans ces textes, et à sa première mention dans le panneau de règles des armes (« Toutes les armes ont de base 2 crans de
--      solidité ») ; les effets (textes de case découpés par la page) restent en texte simple.
-- Rien ne va dans historique_modification : la migration n'est pas une modification du site de dev.

INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES ('solidite', 'Solidité', 'solidite',
  'État de l''équipement. Une Solidité à 0 rend l''objet inutilisable et exige une réparation à l''aide d''un kit de réparation, ou d''une compétence d''artisanat adaptée ainsi que du même matériau que l''objet.');

-- 2. L'effet de la Garde horloge
UPDATE armure_elementaire SET effets_brut = replace(effets_brut, 'récupération d''un cran de durabilité', 'récupération d''un cran de solidité')
  WHERE effets_brut LIKE '%cran de durabilité%';
UPDATE armure_elementaire_effet SET texte = replace(texte, 'récupération d''un cran de durabilité', 'récupération d''un cran de solidité')
  WHERE texte LIKE '%cran de durabilité%';

-- 2 et 3. Les pages
UPDATE page SET corps_md = replace(replace(replace(corps_md,
    'récupération d''un cran de durabilité', 'récupération d''un cran de solidité'),
    char(10) || 'Durabilité et amélioration' || char(10), char(10) || '{{solidite}} et amélioration' || char(10)),
    '4 crans de solidité/durabilité.', '4 crans de {{solidite|solidité}}.')
  WHERE id = 'ressources/pieces-elementaires';
UPDATE page SET corps_md = replace(corps_md, 'L’armure a aussi une **durabilité**.', 'L’armure a aussi une {{solidite|solidité}}.')
  WHERE id = 'guide/l-equipement';
UPDATE page SET corps_md = replace(corps_md, 'une Dur. (durabilité comme pour les armes)', 'une Dur. ({{solidite|solidité}} comme pour les armes)')
  WHERE id = 'guide/fiche-armure-defense-bouclier';

-- 3. Le panneau de règles des armes : sa première mention
UPDATE panneau_regles_bloc SET texte = replace(texte, 'Toutes les armes ont de base 2 crans de solidité,', 'Toutes les armes ont de base 2 crans de {{solidite|solidité}},')
  WHERE panneau_id = 'armes' AND texte LIKE 'Toutes les armes ont de base 2 crans de solidité,%';
