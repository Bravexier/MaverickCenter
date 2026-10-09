-- 0008-dons-de-classe : les « capacités de classe » s'appellent des DONS (leur nom dans le jeu, demande du propriétaire). Migration de données : seul le libellé
-- du type de page `capacites` change (table type_page, miroir de client/src/lib/types.mjs contrôlé par db:check). L'identifiant du type, l'adresse des pages
-- (/wiki/capacites/…), leurs ids et la table `capacite` ne changent pas (identifiants stables) ; l'étiquette « capacité de classe » posée par l'importeur
-- (tools/sheets/classes.py) reste celle de la source.

UPDATE type_page
SET libelle = 'Dons de classe',
    singulier = 'Don',
    description = 'Les dons des classes (les « capacités » des onglets), avec leurs choix exclusifs.'
WHERE id = 'capacites';
