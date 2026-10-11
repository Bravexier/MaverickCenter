-- 0027-posture-du-moment : la fiche garde la posture du moment (demande du propriétaire : « Il faudra aussi un sélecteur des 6 postures »), comme les
-- autres valeurs du moment (santé actuelle, corruption…). Les six postures sont celles de la table `posture` (page « Postures » du guide, tableau de la
-- fiche auto V15.2.2, Personnage!BA16:BR25).
-- Migration de STRUCTURE seulement : colonne personnage.posture_id (NULL = aucune choisie), placée en dernier. Aucune ligne de data/rows ne change
-- (les fiches réelles vivent dans la base vivante du service, qui la reçoit vide).

ALTER TABLE personnage ADD COLUMN posture_id TEXT REFERENCES posture(id);
