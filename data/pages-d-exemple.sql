-- data/pages-d-exemple.sql : les pages d'exemple (statut 'example') et leurs dépendants, des fixtures et non du lore.
-- Fabriqué depuis data/rows par client/scripts/db-pages-d-exemple.mjs. NE PAS ÉDITER À LA MAIN.
-- Inséré dans la copie de travail d'un contenu fourni qui n'a aucune page d'exemple (scripts/db-preparer-contenu.mjs#injecterLesPagesDExemple).

-- page (5)
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('bestiaire/exemple-creature', 'bestiaire', 'exemple-creature', 'Créature d''exemple', 'creature-dexemple', 'Page de démonstration pour une créature du bestiaire.', NULL, 'Contenu **fictif**. Voir la [[Magie d''exemple]].
', 'example', 'exemple', NULL);
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('classes/exemple-classe', 'classes', 'exemple-classe', 'Classe d''exemple', 'classe-dexemple', 'Page de démonstration pour une classe.', NULL, 'Contenu **fictif**. Cette classe peut accéder à la [[Magie d''exemple]]. Elle est jouable par la [[Race d''exemple]].
', 'example', 'exemple', NULL);
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('guide/utiliser-ce-wiki', 'guide', 'utiliser-ce-wiki', 'Utiliser ce wiki', 'utiliser-ce-wiki', 'Comment écrire des pages reliées entre elles par mots-clés.', NULL, 'Chaque page est un fichier Markdown dans `client/src/content/wiki/<catégorie>/`. Pour relier deux pages, écrivez le titre
(ou un alias) entre doubles crochets :

- `[[Titre]]` crée un lien vers la page qui porte ce titre, ce slug ou cet alias ;
- `[[Titre|texte affiché]]` change le texte du lien ;
- `[[races/slug]]` désigne une page précisément quand deux titres se ressemblent.

La casse, les accents et les apostrophes sont ignorés. Un lien vers une page qui n''existe pas s''affiche en rouge
et la page est listée dans « Pages à créer » de l''index.

## Exemple de liens

Un personnage de démonstration est une [[Race d''exemple]] qui suit la [[Classe d''exemple]] et pratique la [[Magie d''exemple]].
Il peut affronter une [[Créature d''exemple|créature quelconque]].
', 'example', 'exemple', 'Page de démonstration — à remplacer');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('magies/exemple-magie', 'magies', 'exemple-magie', 'Magie d''exemple', 'magie-dexemple', 'Page de démonstration pour une école de magie.', NULL, 'Contenu **fictif**. Une [[Créature d''exemple]] peut être sensible à cette magie.
', 'example', 'exemple', NULL);
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('races/exemple-race', 'races', 'exemple-race', 'Race d''exemple', 'race-dexemple', 'Page de démonstration pour une race.', NULL, 'Ceci est un contenu **fictif** servant à vérifier le site et le générateur. La [[Classe d''exemple]] et la
[[Magie d''exemple]] sont associées à cette race dans les données du générateur (`client/src/data/rules.json`).

Voir aussi : [[Utiliser ce wiki]].
', 'example', 'exemple', NULL);

-- alias (4)
INSERT INTO alias (page_id, ordre, texte, cle) VALUES ('bestiaire/exemple-creature', 0, 'Monstre exemple', 'monstre-exemple');
INSERT INTO alias (page_id, ordre, texte, cle) VALUES ('guide/utiliser-ce-wiki', 0, 'Aide', 'aide');
INSERT INTO alias (page_id, ordre, texte, cle) VALUES ('guide/utiliser-ce-wiki', 1, 'Comment contribuer', 'comment-contribuer');
INSERT INTO alias (page_id, ordre, texte, cle) VALUES ('races/exemple-race', 0, 'Peuple exemple', 'peuple-exemple');

-- source (1)
INSERT INTO source (id, nature, texte, url, genre, google_id, fichier, onglets) VALUES ('ref:page-de-demonstration-a-remplacer', 'libelle', 'Page de démonstration — à remplacer', NULL, NULL, NULL, NULL, NULL);

-- page_source (1)
INSERT INTO page_source (page_id, ordre, source_id) VALUES ('guide/utiliser-ce-wiki', 0, 'ref:page-de-demonstration-a-remplacer');
