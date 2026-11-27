-- 0134-visibilite-par-niveau : qui voit quelle fiche se lit au niveau du compte (utilisateur.niveau, R310 (2), R311), plus dans utilisateur_role
-- (décision R318 ; feuille de route E8, « Fiches de personnage assignées à un compte »). Migration de STRUCTURE seule : elle n'écrit aucune valeur.
-- Le menu « Visible par » d'une fiche de joueur (demande du propriétaire, 2026-11-27) : « Tous (Joueurs et +) », « MJ (MJ et Créateur) »,
-- « Privé (Utilisateur et Créateur) ». La vue v_personnage_visible est recréée, mêmes colonnes et mêmes motifs :
--   'proprietaire' inchangé ;
--   'admin'   : tout compte de niveau 'createur' voit toutes les fiches (il lisait le rôle 'admin' de utilisateur_role) ;
--   'tous'    : visibilité 'tous', comptes de niveau 'joueur', 'mj' ou 'createur' (l'Observateur n'a plus ce motif ; il l'avait pour tout compte) ;
--   'mj'      : visibilité 'mj', comptes de niveau 'mj' ou 'createur' (il lisait le rôle 'mj' de utilisateur_role) ;
--   'groupe' et 'partage' inchangés.
-- Le prétiré reste ouvert à tout visiteur, connecté ou non (R307) : c'est le service qui le garantit (`nature = 'pretire'`, serveur/fiches.mjs), pas
-- la vue, qui ne connaît que les comptes. utilisateur_role reste (vide, rien ne l'écrit) : la vue ne la lit plus.

DROP VIEW v_personnage_visible;

CREATE VIEW v_personnage_visible AS
  SELECT p.id AS personnage_id, p.proprietaire_id AS utilisateur_id, 'proprietaire' AS motif, NULL AS groupe_id
  FROM personnage p WHERE p.proprietaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, u.id, 'admin', NULL
  FROM personnage p CROSS JOIN utilisateur u WHERE u.niveau = 'createur'
  UNION ALL
  SELECT p.id, u.id, 'tous', NULL
  FROM personnage p CROSS JOIN utilisateur u WHERE p.visibilite = 'tous' AND u.niveau IN ('joueur', 'mj', 'createur')
  UNION ALL
  SELECT p.id, u.id, 'mj', NULL
  FROM personnage p CROSS JOIN utilisateur u WHERE p.visibilite = 'mj' AND u.niveau IN ('mj', 'createur')
  UNION ALL
  SELECT i.personnage_id, m.utilisateur_id, 'groupe', i.groupe_id
  FROM groupe_membre i JOIN groupe_membre m ON m.groupe_id = i.groupe_id
  WHERE i.personnage_id IS NOT NULL
  UNION ALL
  SELECT s.personnage_id, s.utilisateur_id, 'partage', NULL
  FROM personnage_partage s;
