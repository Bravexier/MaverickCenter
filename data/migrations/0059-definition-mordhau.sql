-- 0059-definition-mordhau : la définition du mot-clé « Mordhau » (glossaire, mot_cle.description, migration 0056) ne commence plus par « Ou demi-épée. »
-- (demande du propriétaire du 2026-10-17 : « Il faut changer la défintion de "Mordhau" pour retirer "ou demi-épée" »). Migration de DONNÉES.
--   Seule la première phrase part ; le reste de la définition est inchangé, mot pour mot. Les pages ne sont pas touchées : la demande ne vise que la
--   définition. guide/situations-avancees (« ## Mordhau ou Demi-épée », son résumé et son alias) est copiée du Google Doc qu'elle cite, et ne se réécrit
--   pas sans demande ; « *Mordhau ou Demi-épée* = … » de la page « Armes » n'est plus que la trace de l'import
--   (l'onglet Armes lit son panneau de règles). Rien ne va dans historique_modification : la migration n'est pas une modification du site de dev.

UPDATE mot_cle SET description = 'Avec certaines armes de corps à corps (notamment les épées), prendre l''arme par la lame et frapper avec le manche. '
    || 'Elle peut ainsi faire des dégâts de frappe alors qu''elle en est incapable, mais a 30 % de chance de perdre un cran de solidité '
    || '(exemple : plus de 70 au jet d''attaque).'
WHERE id = 'mordhau'
  AND description = 'Ou demi-épée. Avec certaines armes de corps à corps (notamment les épées), prendre l''arme par la lame et frapper avec le manche. '
    || 'Elle peut ainsi faire des dégâts de frappe alors qu''elle en est incapable, mais a 30 % de chance de perdre un cran de solidité '
    || '(exemple : plus de 70 au jet d''attaque).';
