-- data/derive.sql : remplit les tables dérivées qui se calculent en SQL pur (exécuté par `npm run db:build` après le chargement des lignes).
-- Les tables dérivées qui demandent le code du site (lien, lien_candidat, page_fts : normalize(), résolution des [[liens]]) sont remplies par
-- client/scripts/db-derive.mjs. Ce fichier est idempotent : il vide puis recalcule.
--
-- entite_fts : un document par entité typée. nom (poids fort) ; contexte (parent ou rubrique) ; texte (le reste).
--   Recherche : SELECT entite_table, entite_id FROM entite_fts WHERE entite_fts MATCH :requete ORDER BY bm25(entite_fts, 0, 0, 6, 2, 1)
DELETE FROM entite_fts;

INSERT INTO entite_fts (entite_table, entite_id, nom, contexte, texte)
  -- magies
  SELECT 'magie', m.id, m.nom, 'magie', trim(COALESCE(m.description, '') || ' ' || COALESCE(m.description_physique, '') || ' ' || COALESCE(m.explication, ''))
    FROM magie m
  UNION ALL
  SELECT 'sort', s.id, s.nom, m.nom, trim(s.type_brut || ' ' || COALESCE(s.effets, '') || ' ' || COALESCE(s.dsb_brut, '') || ' ' || COALESCE(s.remarque, ''))
    FROM sort s JOIN magie m ON m.id = s.magie_id
  UNION ALL
  SELECT 'amelioration_cadaverique', a.id, a.nom, 'amélioration cadavérique', a.effet FROM amelioration_cadaverique a
  UNION ALL
  SELECT 'regle_magie', r.id, r.titre, 'règle de magie', r.texte FROM regle_magie r
  -- classes
  UNION ALL
  SELECT 'classe', c.id, c.nom, k.libelle, trim(COALESCE(c.description, '') || ' ' || COALESCE(c.chose_a_savoir, ''))
    FROM classe c JOIN categorie_classe k ON k.id = c.categorie_id
  UNION ALL
  SELECT 'specialite', sp.id, sp.nom, c.nom, COALESCE(sp.description, '')
    FROM specialite sp JOIN classe c ON c.id = sp.classe_id
  UNION ALL
  SELECT 'capacite', k.id, k.nom, c.nom || COALESCE(' ' || sp.nom, ''),
         trim(COALESCE(k.type_brut, '') || ' ' || COALESCE(k.effet, '') || ' ' || COALESCE(k.remarque, ''))
    FROM capacite k JOIN classe c ON c.id = k.classe_id LEFT JOIN specialite sp ON sp.id = k.specialite_id
  UNION ALL
  SELECT 'objet_depart', o.id, o.nom, 'objet de départ', o.description FROM objet_depart o
  -- races
  UNION ALL
  SELECT 'race', r.id, r.nom, 'race', trim(COALESCE(r.presentation, '') || ' ' || COALESCE(r.divers, '') || ' ' || COALESCE(r.don_base_effets, ''))
    FROM race r
  UNION ALL
  SELECT 'ethnie', e.id, e.nom, trim(r.nom || ' ' || COALESCE(e.libelle, '')), COALESCE(e.descriptif, '')
    FROM ethnie e JOIN race r ON r.id = e.race_id
  -- bestiaire
  UNION ALL
  SELECT 'invocation', i.id, i.nom, i.genre, COALESCE(i.texte_general, '') FROM invocation i
  UNION ALL
  SELECT 'creature', c.id, c.nom,
         COALESCE((SELECT group_concat(m.nom, ' ') FROM v_creature_magie vm JOIN magie m ON m.id = vm.magie_id WHERE vm.creature_id = c.id), ''),
         trim(COALESCE(c.description, '') || ' ' ||
              COALESCE((SELECT group_concat(a.brut, char(10)) FROM creature_attaque a WHERE a.creature_id = c.id), '') || ' ' ||
              COALESCE((SELECT group_concat(k.nom || '. ' || k.texte, char(10)) FROM creature_capacite k WHERE k.creature_id = c.id), '') || ' ' ||
              COALESCE(c.remarque, ''))
    FROM creature c
  -- équipement, ressources, craft
  UNION ALL
  SELECT 'arme', a.id, a.nom, t.nom, trim(COALESCE(a.effet, '') || ' ' || COALESCE(a.description, '') || ' ' || COALESCE(a.competence_brut, '') || ' ' || COALESCE(a.remarque, ''))
    FROM arme a JOIN arme_type t ON t.id = a.type_id
  UNION ALL
  SELECT 'armure', id, nom, type, trim(stats_brut || ' ' || COALESCE(effet, '') || ' ' || COALESCE(resistance_brut, '') || ' ' || COALESCE(faiblesse_brut, '')) FROM armure
  UNION ALL
  SELECT 'ressource', r.id, r.nom, r.genre, trim(COALESCE(r.description, '') || ' ' || COALESCE(p.effet, ''))
    FROM ressource r LEFT JOIN potion p ON p.ressource_id = r.id
  UNION ALL
  SELECT 'accessoire_effet', e.id, COALESCE(e.libelle, ''), p.nom, trim(COALESCE(e.gemmes_brut, '') || ' ' || COALESCE(e.remarque, ''))
    FROM accessoire_effet e JOIN accessoire_propriete p ON p.id = e.propriete_id
  UNION ALL
  SELECT 'familier', id, nom, categorie, trim(COALESCE(effet_brut, '') || ' ' || description) FROM familier
  UNION ALL
  SELECT 'machine_guerre', id, nom, categorie, description || ' ' || effet FROM machine_guerre
  UNION ALL
  SELECT 'maladie', id, nom, 'maladie', trim(COALESCE(effets, '') || ' ' || COALESCE(nature, '') || ' ' || COALESCE(soin_methode_brut, '') || ' ' || COALESCE(remarque, '')) FROM maladie
  UNION ALL
  SELECT 'metier', id, nom, 'métier', description || ' ' || bonus_brut || ' ' || artisanat_brut || ' ' || equipement_brut || ' ' || COALESCE(avantage_brut, '') FROM metier
  UNION ALL
  SELECT 'arme_elementaire', id, nom, 'arme élémentaire', trim(COALESCE(capacite_brut, '') || ' ' || COALESCE(remarque, '')) FROM arme_elementaire
  UNION ALL
  SELECT 'armure_elementaire', id, nom, 'armure élémentaire', effets_brut FROM armure_elementaire
  UNION ALL
  SELECT 'batiment', id, nom, 'bâtiment', description FROM batiment
  UNION ALL
  SELECT 'baton_magique', b.id, 'Bâton magique ' || m.nom || ' niveau ' || b.niveau, m.nom, b.bonus_brut
    FROM baton_magique b JOIN magie m ON m.id = b.magie_id
  UNION ALL
  SELECT 'peuple', id, nom, 'peuple', '' FROM peuple
  -- règles de la fiche et annexes
  UNION ALL
  SELECT 'etat', e.id, e.nom, e.type,
         trim(COALESCE((SELECT group_concat(effet, char(10) ORDER BY rang) FROM etat_stade WHERE etat_id = e.id), '') || char(10) ||
              COALESCE((SELECT group_concat(effet, char(10) ORDER BY palier_id) FROM etat_palier WHERE etat_id = e.id), ''))
    FROM etat e
  UNION ALL
  SELECT 'meteo', m.id, m.nom, 'météo',
         trim(m.description || char(10) || COALESCE((SELECT group_concat(texte, char(10) ORDER BY rang) FROM meteo_effet WHERE meteo_id = m.id), ''))
    FROM meteo m
  UNION ALL
  SELECT 'posture', p.id, p.nom, 'posture',
         trim(p.description || char(10) || COALESCE((SELECT group_concat(intitule || ' ' || texte, char(10) ORDER BY rang)
                                                       FROM posture_effet WHERE posture_id = p.id AND version = 'guide_mj'), ''))
    FROM posture p
  UNION ALL
  SELECT 'mode_super_objet', id, nom, 'mode super', trim(COALESCE(effet_passif, '') || ' ' || COALESCE(effet_actif, '') || ' ' || COALESCE(description, ''))
    FROM mode_super_objet
  UNION ALL
  SELECT 'competence', c.id, c.nom, k.nom, COALESCE(c.description, '') FROM competence c JOIN caracteristique k ON k.id = c.caracteristique_id
  UNION ALL
  SELECT 'dieu', id, nom, 'dieu', '' FROM dieu
  UNION ALL
  SELECT 'mode_hyper_effet', id, libelle, version, effet FROM mode_hyper_effet
  UNION ALL
  SELECT 'mode_texte', id, intitule, mode, texte FROM mode_texte;
