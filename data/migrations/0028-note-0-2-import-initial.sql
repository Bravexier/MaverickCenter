-- 0028-note-0-2-import-initial : la note de la version 0.2 (première livraison, page « Mise à jour ») ne liste plus ses modifications (demande du
-- propriétaire : « supprimer l'historique de la V0.2 et noter à la place "Import initial depuis les sources historiques" » ; « "Pour le moment en
-- V0.2" doit disparaître »). Migration de DONNÉES (aucun changement de structure : seule la version du schéma monte).
--   * note_version_ligne : les lignes de la V0.2 (la liste calculée de master à dev lors de la livraison) sont retirées ;
--   * note_version : le champ libre de la V0.2 perd « Pour le moment en V0.2 » et dit, à la place de la liste, « Import initial depuis les sources
--     historiques ».
-- L'historique des modifications du site de dev livrées avec la V0.2 (historique_modification) reste : les tests qui distinguent une valeur de
-- l'import d'une valeur modifiée par le site le lisent (client/src/lib/historique-site.mjs).

DELETE FROM note_version_ligne WHERE version = '0.2';

UPDATE note_version
SET texte = 'La mise en ligne du serveur live de Maverick.' || char(10) || char(10) || 'Import initial depuis les sources historiques.'
WHERE version = '0.2' AND texte = 'La mise en ligne du serveur live de Maverick. Pour le moment en V0.2';
