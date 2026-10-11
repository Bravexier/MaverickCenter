-- 0012-eaunoire : la déesse de la Corruption s'appelle « Eaunoire », en un seul mot, et non plus « Démon d'Eau Noire » (décision R21 du propriétaire :
-- « La déesse de la Corruption ne s'appelle plus "demon d'eau noire" mais juste "Eaunoire" (en un seul mot) »). Migration de DONNÉES (aucun changement de
-- structure : seule la version du schéma monte). Le nom est corrigé partout où il est écrit : le dieu (dieu.nom, liste S5 de la fiche auto) et la phrase
-- de l'Elfe noir « après une fuite possible grâce au démon d'eau noire », dans le Markdown de sa page et dans le bloc de son onglet (race_onglet).
-- L'identifiant 'demon-deau-noire' ne change pas (identifiants stables : magie_dieu et les fiches de personnages le citent) ; la table dieu n'a pas de
-- clé de nom à recalculer. Le sort de la Corruption « Eau noire » n'est pas la déesse : il garde son nom.

UPDATE dieu SET nom = 'Eaunoire' WHERE id = 'demon-deau-noire' AND nom = 'Démon d''Eau Noire';
UPDATE page SET corps_md = replace(corps_md, 'grâce au démon d''eau noire.', 'grâce à Eaunoire.')
WHERE id = 'races/elfe-noir' AND instr(corps_md, 'grâce au démon d''eau noire.') > 0;
UPDATE race_onglet SET description_generale = replace(description_generale, 'grâce au démon d''eau noire.', 'grâce à Eaunoire.')
WHERE race_id = 'races/elfe-noir' AND instr(description_generale, 'grâce au démon d''eau noire.') > 0;
