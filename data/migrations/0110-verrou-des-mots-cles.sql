-- 0110-verrou-des-mots-cles : le verrou des mots-clés (décisions R218 et R219 du propriétaire, 2026-11-07, lot « mots-clés et monnaies »). Migration de
-- STRUCTURE et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   1. mot_cle.verrou, ajoutée en dernière colonne : INTEGER NOT NULL DEFAULT 0, CHECK 0 ou 1 (R218 (2) : « Un boolean de verrou »). Un mot-clé
--      verrouillé ne se modifie ni ne se supprime depuis le site (R218 (3)) ; aucune route ne l'écrit : il ne change que par une migration (R218 (4)).
--      Le DEFAULT laisse à 0 un mot-clé créé plus tard (R219 (5)) ; race-hybride, absent de la base, est créé verrouillé par le service (R220 (2)).
--   2. verrou = 1 pour (R218 (5), R219 (1) et (2)) :
--      a. les mots-clés dont l'adresse mène à une page du site (R219 (1) : « Ceux qui mènent à une page ») : url renseignée ;
--      b. les monnaies RF, RO et PP (R218 (5)), sans adresse : les ids de la table monnaie, qui sont aussi ceux de leurs mots-clés ;
--      c. les mots-clés dont le site se sert (R219 (2) : « Verrouillés », le verrou remplace leur protection) : la liste
--         lib/mots-cles.mjs#MOTS_CLES_PROTEGES au moment de la migration, écrite telle quelle (le SQL ne lit pas le module) ; un id absent de la base
--         (race-hybride) ne touche rien ;
--      d. les mots-clés des races, des magies et des classes (R218 (5)) : celui qui mène à la page de la ligne, url = '/' || id || '/' (lecture de
--         game-design : classes raciales « X (classe) » comprises). Jamais par l'id court : celui d'une classe raciale (« anansi ») est le mot-clé de
--         la race. Au lot, chacune des 81 lignes (27 races, 15 magies, 39 classes) a exactement un tel mot-clé, déjà compté en (a).
--      Les autres gardent 0. À la migration : 287 mots-clés verrouillés sur 367 (275 à adresse, dont armurier et maroquinier, créés par la
--      migration 0104 ; rf, ro, pp ; et 9 mots-clés protégés sans adresse).

ALTER TABLE mot_cle ADD COLUMN verrou INTEGER NOT NULL DEFAULT 0 CHECK (verrou IN (0,1));

UPDATE mot_cle SET verrou = 1
WHERE url IS NOT NULL
   OR id IN (SELECT id FROM monnaie)
   OR id IN ('cac', 'distance', 'magique', 'hybride', 'hybride-animal', 'speciale', 'race-hybride', 'capacite-de-classe',
             'classe', 'race', 'metier', 'codex', 'sort-grenade', 'sort-fer')
   OR url IN (SELECT '/' || id || '/' FROM race UNION ALL SELECT '/' || id || '/' FROM magie UNION ALL SELECT '/' || id || '/' FROM classe);
