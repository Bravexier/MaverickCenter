-- 0109-r207-panneau-des-batons : décision R207 (3) du propriétaire (tests de fabrication, « Le doc métier fait foi », réponses du 2026-11-07), suite de
-- la migration 0105, qui avait réécrit les 42 recettes de bâton magique et la phrase de la page ressources/baton-magique, mais pas le bloc du panneau
-- de règles du sous-onglet Bâtons magiques qui la recopie (panneau_regles_bloc 'batons-magiques' rang 2, « Comment fabriquer un bâton magique ? ») :
-- Enchanteur « Test de Perception + Volonté ». Migration de DONNÉES seules (section 9 ; PRAGMA user_version 108 -> 109 ; rien d'autre ne change dans
-- data/schema.sql) ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev). Registre avant/après :
-- 0109-r207-panneau-des-batons.json (`textes`, comme la 0105 ; pas sous `corrections`).
-- La garde : le remplacement est gardé par le fragment d'avant, présent une seule fois, et doit changer exactement une ligne. Un bloc que le site de
-- dev aurait réécrit arrête la migration.

CREATE TEMP TABLE garde_0109 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

UPDATE panneau_regles_bloc SET texte = replace(texte, 'Morceau du bon bois + La bonne gemme + Test de Volonté + Intelligence = Bâton élémentaire vierge', 'Morceau du bon bois + La bonne gemme + Test de Perception + Volonté = Bâton élémentaire vierge') WHERE panneau_id = 'batons-magiques' AND rang = 2 AND length(texte) - length(replace(texte, 'Morceau du bon bois + La bonne gemme + Test de Volonté + Intelligence = Bâton élémentaire vierge', '')) = length('Morceau du bon bois + La bonne gemme + Test de Volonté + Intelligence = Bâton élémentaire vierge');
INSERT INTO garde_0109 (quoi, lignes, attendu) VALUES ('panneau_regles_bloc {"panneau_id":"batons-magiques","rang":2} : R207 (3) : Enchanteur', changes(), 1);

DROP TABLE garde_0109;
