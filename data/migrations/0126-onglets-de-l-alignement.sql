-- 0126-onglets-de-l-alignement : la page « Alignement » (guide/alignement) prend deux groupes d'onglets écrits dans son texte (syntaxe `::: onglets` … `:::`,
-- lib/markdown-onglets.mjs, docs/content-guide.md « Des onglets et des couleurs dans un texte »), décision R277 du propriétaire (2026-11-14), mot pour mot :
-- « Cette fois tu aura 2 tableaux. Un après les "Les Quatre Tendances" qui est un tableau à 4 onglet : Loyal, Chaotique, Bon, Mauvais. Le 2em tableau avec
-- les 9 onglet pour les alignements / Loyal Bon - Neutre Bon - Chaotique Bon / Loyal Neutre - Neutre - Chaotique Neutre / Loyal Mauvais - Neutre Mauvais -
-- Chaotique Mauvais » ; réponses : les quatre tendances sans couleur (« Je les choisirai ») ; « Les Quatre Tendances » : « Remettre en Titre (Recommandé) ».
-- Migration de DONNÉES seules (section 1 ; PRAGMA user_version 124 -> 125) ; rien ne va dans historique_modification. Registre :
-- 0126-onglets-de-l-alignement.json (`textes` : les trois fragments réécrits).
-- Écrite après le rapatriement du journal du site de dev du 2026-11-14 (le texte de la page est celui du site). Aucun mot de la page n'est réécrit (règle d'or) :
--   1. « … alignement.<br>*** **Les Quatre Tendances** » : le `<br>` et le gras collé sont retirés ; « Les Quatre Tendances », même texte, redevient un
--      intertitre « ## » (sans ancre figée : l'ancien intertitre « ## Les 4 tendances » n'en avait pas, et aucun lien de la base ne visait #les-4-tendances ;
--      l'alias « Les 4 tendances » de la page reste) ; puis `::: onglets`, les quatre « ### Loyal / Chaotique / Bon / Mauvais » tels quels et dans cet ordre, `:::`.
--   2. Sous « ## Les neuf alignements {#les-neuf-alignements} », son introduction reste au-dessus du groupe ; les neuf sections « ### {{<id>}} {#<id>} »
--      sont déplacées sans changer une ligne dans l'ordre de la grille (lib/caracteristiques-postures.mjs#ALIGNEMENTS_EN_GRILLE : LB NB CB / LN N CN /
--      LM NM CM), chaque intertitre préfixé de la couleur de son alignement dans la palette, « {couleur:alignement:<id>} » (lib/palette-css.mjs, famille
--      alignement ; lib/couleurs-ecrites.mjs#separerLaCouleur), ancres figées inchangées. La conclusion « **L’alignement n’impose pas …** » et les deux
--      lignes « **<br>** » qui la suivent valent pour tous les alignements : elles restent après le `:::`.
-- La garde : chaque marque citée est présente une fois, dans l'ordre attendu, et le texte n'a pas encore de groupe ; la mise à jour touche une ligne ; la
-- longueur obtenue est l'ancienne plus les seules marques ajoutées, moins le `<br>` et le gras retirés (le déplacement ne perd ni n'ajoute rien).

CREATE TEMP TABLE garde_0126 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- Les marques, chacune une fois dans le texte : rang = ordre dans le texte d'avant
CREATE TEMP TABLE marque_0126 (rang INTEGER PRIMARY KEY, quoi TEXT NOT NULL, texte TEXT NOT NULL);
INSERT INTO marque_0126 (rang, quoi, texte) VALUES
  (1, 'Les Quatre Tendances en gras', '<br>*** **Les Quatre Tendances**' || char(10) || char(10) || '### Loyal' || char(10)),
  (2, '### Chaotique', char(10) || '### Chaotique' || char(10)),
  (3, '### Bon', char(10) || '### Bon' || char(10)),
  (4, '### Mauvais', char(10) || '### Mauvais' || char(10)),
  (5, '## Les neuf alignements', char(10) || char(10) || '## Les neuf alignements {#les-neuf-alignements}' || char(10)),
  (6, 'loyal-bon', char(10) || '### {{loyal-bon}} {#loyal-bon}' || char(10)),
  (7, 'loyal-neutre', char(10) || '### {{loyal-neutre}} {#loyal-neutre}' || char(10)),
  (8, 'loyal-mauvais', char(10) || '### {{loyal-mauvais}} {#loyal-mauvais}' || char(10)),
  (9, 'neutre-bon', char(10) || '### {{neutre-bon}} {#neutre-bon}' || char(10)),
  (10, 'neutre', char(10) || '### {{neutre}} {#neutre}' || char(10)),
  (11, 'neutre-mauvais', char(10) || '### {{neutre-mauvais}} {#neutre-mauvais}' || char(10)),
  (12, 'chaotique-bon', char(10) || '### {{chaotique-bon}} {#chaotique-bon}' || char(10)),
  (13, 'chaotique-neutre', char(10) || '### {{chaotique-neutre}} {#chaotique-neutre}' || char(10)),
  (14, 'chaotique-mauvais', char(10) || '### {{chaotique-mauvais}} {#chaotique-mauvais}' || char(10)),
  (15, 'la conclusion', char(10) || '**L’alignement n’impose pas au personnage sa manière d’agir.');

INSERT INTO garde_0126 (quoi, lignes) SELECT 'page guide/alignement', count(*) FROM page WHERE id = 'guide/alignement';
INSERT INTO garde_0126 (quoi, lignes, attendu) SELECT 'aucun groupe d’onglets déjà écrit', count(*), 0 FROM page WHERE id = 'guide/alignement' AND instr(corps_md, ':::') > 0;
INSERT INTO garde_0126 (quoi, lignes)
  SELECT 'une fois : ' || m.quoi, (length(p.corps_md) - length(replace(p.corps_md, m.texte, ''))) / length(m.texte)
  FROM marque_0126 m, page p WHERE p.id = 'guide/alignement';

-- La position de chaque marque (celle du saut de ligne qui la commence, sauf la première), puis l'ordre
CREATE TEMP TABLE position_0126 AS
  SELECT m.rang, instr(p.corps_md, m.texte) AS pos FROM marque_0126 m, page p WHERE p.id = 'guide/alignement';
INSERT INTO garde_0126 (quoi, lignes, attendu)
  SELECT 'marques dans l’ordre', count(*), 14 FROM position_0126 a JOIN position_0126 b ON b.rang = a.rang + 1 WHERE a.pos > 0 AND b.pos > a.pos;

-- Le texte d'avant, les positions à plat (une ligne)
CREATE TEMP TABLE texte_0126 AS
  SELECT p.corps_md AS c,
    (SELECT pos FROM position_0126 WHERE rang = 6) AS lb, (SELECT pos FROM position_0126 WHERE rang = 7) AS ln,
    (SELECT pos FROM position_0126 WHERE rang = 8) AS lm, (SELECT pos FROM position_0126 WHERE rang = 9) AS nb,
    (SELECT pos FROM position_0126 WHERE rang = 10) AS n, (SELECT pos FROM position_0126 WHERE rang = 11) AS nm,
    (SELECT pos FROM position_0126 WHERE rang = 12) AS cb, (SELECT pos FROM position_0126 WHERE rang = 13) AS cn,
    (SELECT pos FROM position_0126 WHERE rang = 14) AS cm, (SELECT pos FROM position_0126 WHERE rang = 15) AS fin
  FROM page p WHERE p.id = 'guide/alignement';

-- 1 et 2. Le nouveau texte : ce qui précède la première section (le titre remis et le premier groupe), le second groupe dans l'ordre de la grille,
-- chaque section reprise du « ### » au saut de ligne qui précède la suivante (son « ### » préfixé de sa couleur), puis la fin du texte telle quelle.
UPDATE page SET corps_md = (
  SELECT
    replace(replace(substr(c, 1, lb),
      '<br>*** **Les Quatre Tendances**' || char(10) || char(10) || '### Loyal' || char(10),
      '***' || char(10) || char(10) || '## Les Quatre Tendances' || char(10) || char(10) || '::: onglets' || char(10) || char(10) || '### Loyal' || char(10)),
      char(10) || char(10) || '## Les neuf alignements {#les-neuf-alignements}' || char(10),
      char(10) || char(10) || ':::' || char(10) || char(10) || '## Les neuf alignements {#les-neuf-alignements}' || char(10))
    || '::: onglets' || char(10) || char(10)
    || '### {couleur:alignement:loyal-bon} ' || substr(c, lb + 5, ln - lb - 4)
    || '### {couleur:alignement:neutre-bon} ' || substr(c, nb + 5, n - nb - 4)
    || '### {couleur:alignement:chaotique-bon} ' || substr(c, cb + 5, cn - cb - 4)
    || '### {couleur:alignement:loyal-neutre} ' || substr(c, ln + 5, lm - ln - 4)
    || '### {couleur:alignement:neutre} ' || substr(c, n + 5, nm - n - 4)
    || '### {couleur:alignement:chaotique-neutre} ' || substr(c, cn + 5, cm - cn - 4)
    || '### {couleur:alignement:loyal-mauvais} ' || substr(c, lm + 5, nb - lm - 4)
    || '### {couleur:alignement:neutre-mauvais} ' || substr(c, nm + 5, cb - nm - 4)
    || '### {couleur:alignement:chaotique-mauvais} ' || substr(c, cm + 5, fin - cm - 4)
    || ':::' || char(10) || char(10)
    || substr(c, fin + 1)
  FROM texte_0126)
WHERE id = 'guide/alignement' AND NOT EXISTS (SELECT 1 FROM garde_0126 WHERE lignes <> attendu);
INSERT INTO garde_0126 (quoi, lignes) VALUES ('page.corps_md guide/alignement : deux groupes d’onglets', changes());

-- La longueur : l'ancienne, plus les marques ajoutées (deux ouvertures, deux fermetures, neuf préfixes de couleur, l'intertitre « ## »), moins `<br>` et `**` `**`
INSERT INTO garde_0126 (quoi, lignes)
  SELECT 'longueur : rien de perdu ni d’ajouté hors des marques', count(*) FROM page p, texte_0126 t
  WHERE p.id = 'guide/alignement' AND length(p.corps_md) = length(t.c)
    - length('<br>*** **Les Quatre Tendances**') + length('***' || char(10) || char(10) || '## Les Quatre Tendances')
    + 2 * length('::: onglets' || char(10) || char(10)) + 2 * length(':::' || char(10) || char(10))
    + length('{couleur:alignement:loyal-bon} {couleur:alignement:neutre-bon} {couleur:alignement:chaotique-bon} {couleur:alignement:loyal-neutre} '
      || '{couleur:alignement:neutre} {couleur:alignement:chaotique-neutre} {couleur:alignement:loyal-mauvais} {couleur:alignement:neutre-mauvais} '
      || '{couleur:alignement:chaotique-mauvais} ');

DROP TABLE texte_0126;
DROP TABLE position_0126;
DROP TABLE marque_0126;
DROP TABLE garde_0126;
