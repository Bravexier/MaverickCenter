-- 0116-icone-des-mots-cles : l'icône d'un mot-clé (lot « mots-clés : ID entier, clé, catégories, synonymes », 2026-11-08). Demande du propriétaire :
-- « Exclue de partout. D'ailleurs tu peux mettre une colonne supplémentaire avec "icone" et tu la mettra dedans.. Pour le moment, seul les monnaies
-- vont l'utiliser. » Réponses (transmises par le leader-technique) : une colonne `icone` du mot-clé, modifiable sur le site de dev, choisie dans la
-- liste des icônes du site (pour l'instant les trois icônes de monnaie) ; RF, RO et PP remplis par la migration.
-- Migration de STRUCTURE et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev), et
-- aucune trace n'est à traduire (une colonne ajoutée ; aucune trace de mot_cle n'en parle).
--   1. mot_cle.icone (ADD COLUMN nullable, en dernier) : une référence « <famille>:<id> » d'une icône du site, sur le modèle de mot_cle.couleur
--      (même forme que la partie « famille:id » de son CHECK) ; NULL : aucune. Famille « monnaie », id = l'id de la monnaie (lib/monnaies.mjs#MONNAIES_DU_JEU,
--      classe piece--<id> de styles/global/monnaies.css). Le CHECK ne lit que la forme.
--   2. Les trois mots-clés d'une monnaie (monnaie_id : rf, ro, pp) reçoivent l'icône de leur monnaie : 'monnaie:' || monnaie_id.

ALTER TABLE mot_cle ADD COLUMN icone TEXT CHECK (icone IS NULL OR (icone GLOB '[a-z]*:[a-z0-9]*' AND icone NOT GLOB '*[^a-z0-9:-]*' AND icone NOT GLOB '*[^a-z]*:*' AND icone NOT GLOB '*:*:*' AND icone NOT GLOB '*--*' AND icone NOT GLOB '*-'));

UPDATE mot_cle SET icone = 'monnaie:' || monnaie_id WHERE monnaie_id IS NOT NULL;
