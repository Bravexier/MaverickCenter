-- 0072-index-jamais-choisis : entretien de la base (sections 1 et 10). Migration de STRUCTURE seule : aucune ligne ne change.
-- Retire six index qu'aucun plan ne choisit sur un chemin réel du site, du service, des scripts db:* ou des importeurs (tools/) :
--   alias_texte          alias (texte)                    : alias se lit par page_id (clé primaire, UNIQUE (page_id, texte)) ou par cle (alias_cle) ;
--   source_google        source (google_id) partiel       : source se lit par id (clé primaire) ; archives.mjs filtre google_id en JavaScript ;
--   source_fichier       source (fichier) partiel         : idem pour fichier ;
--   page_entite_id       page_entite (entite_id)          : une entité se cherche par (entite_table, entite_id), la clé primaire ; une page par page_entite_page ;
--   note_cellule_nature  note_cellule (nature) partiel    : les notes se lisent par la clé primaire (entite_table, entite_id, rang), jamais par nature ;
--   ecart_source_nature  ecart_source (nature)            : les écarts se lisent par id ou par ecart_source_entite, jamais par nature.
-- Aucune de ces colonnes n'est l'enfant ni le parent d'une clé étrangère (les ON DELETE et les contrôles de clés n'en ont pas besoin). Seul le filtre
-- générique de l'API REST du site de dev (/api/v1/<ressource>/?<colonne>=…, client/serveur/ressources.mjs#lister) passe d'une recherche à un parcours
-- de ces petites tables (75 à 3 754 lignes : 0,15 ms au plus) ; aucun appel du site ne s'en sert. Aucun résultat ne change.
DROP INDEX alias_texte;
DROP INDEX source_google;
DROP INDEX source_fichier;
DROP INDEX page_entite_id;
DROP INDEX note_cellule_nature;
DROP INDEX ecart_source_nature;
