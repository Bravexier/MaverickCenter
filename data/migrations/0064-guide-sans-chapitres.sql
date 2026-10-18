-- 0064-guide-sans-chapitres : les pages du guide ne portent plus de numéro de chapitre ni de partie (page.donnees : « chapitre », « partie »). Le guide
-- est éclaté (demande du propriétaire, 2026-10-16 puis 2026-10-18 : « éclater le guide pour retravailler pleinement l'organisation des onglets et de la
-- présentation ») : ses pages ne forment plus un seul livre de 24 chapitres servi sous /guide/, elles sont rangées par le plan du site,
-- client/src/lib/livres.mjs (livres « Découvrir » et « Les bases » lus dans l'ordre, sommaires des Règles avancées et du Guide du MJ ; ordre de
-- lecture, numéros et couleurs des sections compris). Migration de DONNÉES.
--   Plus rien ne lit ces deux clés : la page de livre, la pagination, le sommaire de « Bienvenue », les notes de version (groupe et ordre d'une page),
--   l'aide « Entraînement » de la fiche (décision R71), la simulation de mise à jour et l'API (/api/v1/) lisent le plan ; client/src/content.config.ts
--   ne les déclare plus. Les 24 pages qui les portaient n'avaient rien d'autre dans `donnees` : il devient NULL, comme l'écrit tools/db/pages_md.py
--   pour un frontmatter sans clé supplémentaire. Chaque page n'est touchée que si son objet est exactement celui de l'import (registre
--   0064-guide-sans-chapitres.json, relu par client/test/guide-sans-chapitres.test.mjs) : rien d'autre ne change, ni titre, ni résumé, ni texte (les
--   liens Markdown écrits vers /guide/… sont réécrits au rendu, lib/guide-rendu.ts), ni identifiant. `donnees` ne se modifie pas sur le site de dev
--   (lib/edition-modele.mjs, TABLES.page : titre et texte) : rien ne va dans historique_modification, et les traces (notes de version déjà livrées,
--   qui disent encore « Chapitre N ») ne sont pas touchées.

UPDATE page SET donnees = NULL
WHERE type = 'guide' AND (id, donnees) IN (VALUES
  ('guide/bienvenue', '{"chapitre": 1, "partie": "decouvrir"}'),
  ('guide/le-jeu-de-role', '{"chapitre": 2, "partie": "decouvrir"}'),
  ('guide/l-univers', '{"chapitre": 3, "partie": "decouvrir"}'),
  ('guide/reussir-une-action', '{"chapitre": 4, "partie": "decouvrir"}'),
  ('guide/creer-son-personnage', '{"chapitre": 5, "partie": "creer"}'),
  ('guide/choisir-sa-race', '{"chapitre": 6, "partie": "creer"}'),
  ('guide/choisir-ses-magies', '{"chapitre": 7, "partie": "creer"}'),
  ('guide/choisir-sa-classe', '{"chapitre": 8, "partie": "creer"}'),
  ('guide/caracteristiques-et-competences', '{"chapitre": 9, "partie": "creer"}'),
  ('guide/premiers-sorts', '{"chapitre": 10, "partie": "creer"}'),
  ('guide/finaliser-son-personnage', '{"chapitre": 11, "partie": "creer"}'),
  ('guide/le-tour-de-jeu', '{"chapitre": 12, "partie": "jouer"}'),
  ('guide/attaquer-et-se-defendre', '{"chapitre": 13, "partie": "jouer"}'),
  ('guide/l-equipement', '{"chapitre": 14, "partie": "jouer"}'),
  ('guide/les-degats', '{"chapitre": 15, "partie": "jouer"}'),
  ('guide/les-postures', '{"chapitre": 16, "partie": "jouer"}'),
  ('guide/la-magie-en-jeu', '{"chapitre": 17, "partie": "jouer"}'),
  ('guide/blessures-et-etats', '{"chapitre": 18, "partie": "jouer"}'),
  ('guide/la-montee-de-niveau', '{"chapitre": 19, "partie": "progresser"}'),
  ('guide/le-mode-hyper', '{"chapitre": 20, "partie": "progresser"}'),
  ('guide/s-entrainer-et-exercer-un-metier', '{"chapitre": 21, "partie": "progresser"}'),
  ('guide/aide-memoire', '{"chapitre": 22, "partie": "plus-loin"}'),
  ('guide/lexique', '{"chapitre": 23, "partie": "plus-loin"}'),
  ('guide/les-documents-des-regles', '{"chapitre": 24, "partie": "plus-loin"}')
);
