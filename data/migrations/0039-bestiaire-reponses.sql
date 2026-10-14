-- 0039-bestiaire-reponses : réponses du propriétaire sur le bestiaire (2026-10-14). Migration de DONNÉES (schéma inchangé), écrite d'après l'écart entre
-- la base et l'extraction du doc « Bestiaire 2.0 » par tools/bestiaire/extraire.mjs, que client/test/bestiaire-extraction.test.mjs compare ensuite à la base.
--   * Décision R58 (« Oui » à « Faut-il les retirer ? ») : deux brouillons du doc, « Réanimé (EP5) (a continuer) » et « Vouivre squelette (EP8)
--     (a refaire) », ne sont pas repris. L'extraction les avait pris dans l'espèce qui les précède : la carte « Réanimé » rattachée au Rat et les trois
--     « Vouivres squelettes » à la Velue (avec leurs rubriques, caractéristiques, attaques, capacités et défenses), leur titre et leur description
--     collés dans la tactique du Rat putride et la dernière case du butin de la Velue (la case « RIEN ! » de la table du brouillon aussi). La note
--     « *Parmi Rouge, Jaune, Vert foncé, Brun », sous le butin du Blob métallique, n'est plus collée à sa dernière case. Les références au doc des
--     espèces Rat et Velue (et de ce qui les cite) finissent avant le brouillon.
--   * Décision R57 (« Corrige et rapproche les. Les fautes de frappe ça arrive. ») : quatre fautes du butin corrigées (« Petite os » -> « Petit os »,
--     « 4 os moyen » -> « Os moyen x 4 », « Gelée argent » -> « Gelée blanche », le nom du glossaire « Peau du radrak » -> « Peau de radrak » ; son
--     identifiant reste peau-du-radrak). Les rapprochements sans changement de texte (« Minitaire de Foudre », « Fragment de pièce de Feu ») sont
--     dans lib/monstre-champs.mjs#objetDuButin.

-- R58 : les cartes des brouillons et tout ce qui en vient
DELETE FROM monstre_defense WHERE monstre_id IN ('monstres/rat#carte:reanime', 'monstres/velue#carte:grande-vouivre-squelette', 'monstres/velue#carte:vouivre-squelette', 'monstres/velue#carte:vouivre-squelette-ancienne');
DELETE FROM monstre_capacite WHERE monstre_id IN ('monstres/rat#carte:reanime', 'monstres/velue#carte:grande-vouivre-squelette', 'monstres/velue#carte:vouivre-squelette', 'monstres/velue#carte:vouivre-squelette-ancienne');
DELETE FROM monstre_attaque WHERE monstre_id IN ('monstres/rat#carte:reanime', 'monstres/velue#carte:grande-vouivre-squelette', 'monstres/velue#carte:vouivre-squelette', 'monstres/velue#carte:vouivre-squelette-ancienne');
DELETE FROM monstre_caracteristique WHERE monstre_id IN ('monstres/rat#carte:reanime', 'monstres/velue#carte:grande-vouivre-squelette', 'monstres/velue#carte:vouivre-squelette', 'monstres/velue#carte:vouivre-squelette-ancienne');
DELETE FROM monstre_rubrique WHERE monstre_id IN ('monstres/rat#carte:reanime', 'monstres/velue#carte:grande-vouivre-squelette', 'monstres/velue#carte:vouivre-squelette', 'monstres/velue#carte:vouivre-squelette-ancienne');
DELETE FROM monstre WHERE id IN ('monstres/rat#carte:reanime', 'monstres/velue#carte:grande-vouivre-squelette', 'monstres/velue#carte:vouivre-squelette', 'monstres/velue#carte:vouivre-squelette-ancienne');

-- R58 : le texte des brouillons et la note, retirés du butin et de la tactique ; les références au doc
DELETE FROM monstre_butin WHERE espece_id = 'monstres/velue' AND rang = 8 AND categorie = 'boss';
DELETE FROM monstre_butin WHERE espece_id = 'monstres/velue' AND rang = 15 AND categorie = 'ennemi_simple';
UPDATE monstre_espece SET source_ref = 'Bestiaire 2.0 › lignes 24749-24900' WHERE id = 'monstres/rat';
UPDATE monstre_espece SET source_ref = 'Bestiaire 2.0 › lignes 26743-27187' WHERE id = 'monstres/velue';
UPDATE monstre_espece_lieu SET source_ref = 'Bestiaire 2.0 › lignes 24749-24900' WHERE espece_id = 'monstres/rat' AND rang = 1;
UPDATE monstre_espece_lieu SET source_ref = 'Bestiaire 2.0 › lignes 26743-27187' WHERE espece_id = 'monstres/velue' AND rang = 1;
UPDATE monstre_butin SET texte = 'Bloque la régénération de santé pour 24h' WHERE espece_id = 'monstres/blob-metallique' AND rang = 8 AND categorie = 'boss';
UPDATE monstre_butin SET source_ref = 'Bestiaire 2.0 › lignes 27113-27187' WHERE espece_id = 'monstres/velue' AND rang = 7 AND categorie = 'ennemi_simple';
UPDATE monstre SET source_ref = 'Bestiaire 2.0 › lignes 24854-24900' WHERE id = 'monstres/rat#carte:rat-putride';
UPDATE monstre_rubrique SET texte = 'Le rat putride s’est imposé comme un chef de groupe de rats, ses griffes et dents sont imprégnées de poison et il est capable de l’infliger très facilement. Mais il reste fragile comme tous ses homologues rongeurs.' WHERE monstre_id = 'monstres/rat#carte:rat-putride' AND rang = 10;

-- R57 : les fautes du butin
UPDATE monstre_butin_objet SET nom = 'Peau de radrak' WHERE id = 'peau-du-radrak';
UPDATE monstre_butin SET texte = 'Gelée blanche x 2d8' WHERE espece_id = 'monstres/blob-blanc' AND rang = 5 AND categorie = 'boss';
UPDATE monstre_butin SET texte = 'Gelée blanche x 1d6' WHERE espece_id = 'monstres/blob-blanc' AND rang = 5 AND categorie = 'ennemi_simple';
UPDATE monstre_butin SET texte = 'Gelée blanche x 2d6' WHERE espece_id = 'monstres/blob-blanc' AND rang = 5 AND categorie = 'mini_boss';
UPDATE monstre_butin SET texte = 'Petit os x 1d10' WHERE espece_id = 'monstres/karn' AND rang = 3 AND categorie = 'ennemi_simple';
UPDATE monstre_butin SET texte = 'Os moyen x 4' WHERE espece_id = 'monstres/squelette' AND rang = 1 AND categorie = 'ennemi_simple';
