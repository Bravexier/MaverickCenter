-- data/rows/regle_magie.sql : export déterministe, une instruction par ligne, triée par (id). NE PAS ÉDITER À LA MAIN.
INSERT INTO regle_magie (id, titre, niveau_sort, texte, origine, source_ref) VALUES ('magies#regle:choses-a-savoir', 'CHOSES A SAVOIR', NULL, 'CHOSES A SAVOIR

Ceci est une version en test des nouvelles magies, vous allez assez vite comprendre qu''il va exister ce qu''on peut appeler des spécialisations magiques, nous allons prendre le temps d''expliquer.

- Les spécialisations magiques sont débloquables dès le niveau 3 de puissance magique.

- Seuls les bi-magie doivent faire un choix de chemin, les mono-magie ont accès aux deux spécialisations.

- A partir du niveau 8 global, si les personnages ont toujours mono-magie, leur magie est dans un état de "Super-magie" ce qui leur permet de débloquer les emplacements de sort de la magie acquise.

- Vu que c''est une bêta, il peut y avoir des trucs trop forts, pas assez clairs, trop faibles. N''hésitez pas à faire un retour, un salon sera dédié au retour ou aux questions.', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');
INSERT INTO regle_magie (id, titre, niveau_sort, texte, origine, source_ref) VALUES ('magies#regle:regle-speciale-pour-sort-niveau-5', 'Règle spéciale pour sort niveau 5', 5, 'Règle spéciale pour sort niveau 5 : Les sorts sont si puissants qu''ils demandent un tour de charge pour être lancés. Donc on le charge avec l''action du premier tour et l''action du tour suivant sert à lancer le sort mais pas besoin de faire 2 jets de magie pour lancer le sort, celui du premier tour est pris en compte. Si jamais un ennemi attaque et touche, un jet de concentration est nécessaire pour ne pas perdre la charge du sort (perdre la charge du sort n''annule pas l''action du prochain tour mais perdra la moitié du coût en chakra). Pendant ce temps, le lanceur peut se défendre s''il a une posture qui le permet, se déplacer et même changer de posture le tour 2 avant de lancer son sort mais il est sera contraint de lancer le sort (donc pas d''IC le tour 2 si le sort n''est pas interrompu).', 'magies', 'Magie Maverick V8 › Sommaire › A31');
