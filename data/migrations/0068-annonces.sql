-- 0068-annonces : l'encart « Notre prochaine rencontre IRL » de la page « Liens » (/decouvrir/liens/), modifiable sur le site de dev. Demande du
-- propriétaire du 2026-10-18 : « Laisse également un encart « Notre prochaine rencontre IRL » pour faire la place à une annonce dédiée aux prochaines
-- conventions où Maverick sera présent » ; ses choix du même jour : « titre fixe, annonce modifiable sur le site de dev (mode modification), partie en
-- production avec la mise à jour, texte d'attente « Aucune rencontre annoncée pour le moment. » quand elle est vide ». Migration de STRUCTURE et de DONNÉES.
--   * Structure : annonce (id : l'annonce que le site place, aujourd'hui la seule « prochaine-rencontre-irl » ; texte : le Markdown de l'annonce, balises
--     du glossaire comprises, NULL tant qu'aucune n'est écrite). Le titre de l'encart et le texte d'attente sont fixes : écrits par le site
--     (client/src/lib/livres.mjs#LIENS.rencontre), pas dans la base. Une table à elle plutôt qu'un panneau de règles : un panneau est l'encart d'un onglet
--     de l'Équipement (son id est l'ancre de l'onglet, sa page servie par l'onglet) et garde au moins un bloc non vide ; l'annonce, elle, est vide au départ.
--   * Données : une ligne, sans texte : aucune rencontre n'est annoncée (aucune source n'en écrit).
-- Rien ne va dans historique_modification : la migration n'est pas une modification du site de dev.

CREATE TABLE annonce (
  id    TEXT NOT NULL PRIMARY KEY CHECK (length(id) > 0 AND id NOT GLOB '*[^a-z0-9-]*' AND id NOT GLOB '*--*' AND id NOT GLOB '-*' AND id NOT GLOB '*-'),
  texte TEXT CHECK (texte IS NULL OR length(texte) > 0)
) STRICT;

INSERT INTO annonce (id, texte) VALUES ('prochaine-rencontre-irl', NULL);
