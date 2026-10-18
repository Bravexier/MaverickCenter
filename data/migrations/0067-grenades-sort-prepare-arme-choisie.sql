-- 0067-grenades-sort-prepare-arme-choisie : trois décisions du propriétaire du 2026-10-18 (réponses aux questions Q20 et Q22, docs/decisions-regles.md).
-- Migration de STRUCTURE et de DONNÉES.
--   1. R114 (Grenadier, « Pardon ?!? » : « Les bombes et les sorts "grenades" font +11 dégâts ») : un sort grenade se reconnaît à une étiquette posée
--      en base, pas à son nom (« Il faudra d'ailleurs redéfinir ce qu'est un sort "grenade" autrement que pas juste son nom (un tag en base par
--      exemple, qu'on pourrait utiliser pour d'autres choses ») :
--        * le mot-clé « Sort grenade » du glossaire (id `sort-grenade` = normalize(libelle), comme tout mot-clé à sa création), défini par le
--          propriétaire « Type particulier de sort provoquant une explosion localisée », avec le point final de toutes les définitions du glossaire
--          (comme 0058 pour « Solidité ») ; le site s'en sert : il est protégé (client/src/lib/mots-cles.mjs#MOTS_CLES_PROTEGES) ;
--        * la table des étiquettes d'un sort, sort_mot_cle (sort, mot-clé ; supprimer le mot-clé retire ses étiquettes, ON DELETE CASCADE comme
--          page_tag), qui pose « Sort grenade » sur les 14 sorts « Grenade… » de la décision, un dans chaque magie (Collante, Paralysante,
--          Cryogénique, Flash, Caustique, Pétrifiante, de Chakra, Incapacitante, Distordue, Fumigène, Incendiaire, à Clous, Explosive, Implosive) :
--          les 14 sorts de la table `sort` dont le nom commence par « Grenade », cités par leur id (figé : 0006). Un id absent arrête la migration
--          (clé étrangère contrôlée avant le COMMIT).
--   2. R115 (Mage Rouge et Mage Vert : « Le don niveau 1 (et son équivalent mage vert) permettrai de choisir le sort qui est préparé et de noter le
--      résultat du jet de magie si réussi » ; le sort préparé se lance « avec les règles de postures du moment où il a été préparé ») : trois
--      colonnes de personnage (section 13), le sort préparé (sort_prepare_id), le résultat du jet de magie (sort_prepare_jet, un D100 : 1 à 100) et
--      la posture du moment de la préparation (sort_prepare_posture_id). NULL = aucun sort préparé ; le jet et la posture n'existent qu'avec le sort
--      (contraintes CHECK des deux colonnes : un jet ou une posture sans sort ne voudrait rien dire, et « Lâcher le sort » les efface avec lui) ;
--      le jet reste NULL tant qu'il n'est pas noté (« si réussi »), la posture quand aucune n'était choisie (posture_id NULL).
--   3. R119 (« +N% de la compétence de l'arme choisie » : « La classe choisi une maîtrise pour une arme. C'est cette arme qui détermine le bonus. En
--      cas d'arme qui peu tout aussi bien avoir des armes lourdes et légère, ça reste au choix. ») : personnage_acquis_choix.arme_famille_id, la
--      famille d'armes de la maîtrise au choix de la classe, à côté de la compétence qui reçoit le bonus. Une colonne de la table des choix d'acquis
--      plutôt qu'une table à part : le bonus est un choix d'un don (sa source et son rang dans le texte), lu par le même chemin que « X ou Y »
--      (décision R104) ; chaque classe concernée n'a qu'un tel don par spécialité (Tueur Flétrisseur ou Sicaire, Mage Bleu Mage saphir, Mage Vert
--      Mage émeraude ou Mage jade, Barde Ménestrel : niveau 10), la famille n'est donc pas écrite deux fois. Le choix d'une arme n'est pas une
--      répartition (`valeur` NULL : CHECK) et n'a qu'une ligne (index unique partiel personnage_acquis_choix_arme).
-- Les tables des fiches restent vides dans data/rows ; rien ne va dans historique_modification (la migration n'est pas une modification du site de
-- dev). v_personnage_controle ne change pas.

-- 1. R114 : le mot-clé « Sort grenade » et les étiquettes des sorts
INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES ('sort-grenade', 'Sort grenade', 'sort-grenade',
  'Type particulier de sort provoquant une explosion localisée.');

CREATE TABLE sort_mot_cle (
  sort_id     TEXT NOT NULL REFERENCES sort(id),
  mot_cle_id  TEXT NOT NULL REFERENCES mot_cle(id) ON DELETE CASCADE,
  PRIMARY KEY (sort_id, mot_cle_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX sort_mot_cle_mot_cle ON sort_mot_cle (mot_cle_id);

INSERT INTO sort_mot_cle (sort_id, mot_cle_id) VALUES
  ('magies/magie-de-la-corruption#sort:grenade-collante', 'sort-grenade'),
  ('magies/magie-de-la-foudre#sort:grenade-paralysante', 'sort-grenade'),
  ('magies/magie-de-la-glace#sort:grenade-cryogenique', 'sort-grenade'),
  ('magies/magie-de-la-lumiere#sort:grenade-flash', 'sort-grenade'),
  ('magies/magie-de-la-necromancie#sort:grenade-caustique', 'sort-grenade'),
  ('magies/magie-de-la-terre#sort:grenade-petrifiante', 'sort-grenade'),
  ('magies/magie-de-larcane#sort:grenade-de-chakra', 'sort-grenade'),
  ('magies/magie-de-leau#sort:grenade-incapacitante', 'sort-grenade'),
  ('magies/magie-de-lespace-temps#sort:grenade-distordue', 'sort-grenade'),
  ('magies/magie-de-lombre#sort:grenade-fumigene', 'sort-grenade'),
  ('magies/magie-du-feu#sort:grenade-incendiaire', 'sort-grenade'),
  ('magies/magie-du-sang#sort:grenade-a-clous', 'sort-grenade'),
  ('magies/magie-du-vent#sort:grenade-explosive', 'sort-grenade'),
  ('magies/magie-du-vide#sort:grenade-implosive', 'sort-grenade');

-- 2. R115 : le sort préparé de la fiche (colonnes ajoutées en dernier, avant les contraintes de la table)
ALTER TABLE personnage ADD COLUMN sort_prepare_id       TEXT    REFERENCES sort(id);
ALTER TABLE personnage ADD COLUMN sort_prepare_jet      INTEGER CHECK (sort_prepare_jet IS NULL OR (sort_prepare_id IS NOT NULL AND sort_prepare_jet BETWEEN 1 AND 100));
ALTER TABLE personnage ADD COLUMN sort_prepare_posture_id TEXT  REFERENCES posture(id) CHECK (sort_prepare_posture_id IS NULL OR sort_prepare_id IS NOT NULL);

-- 3. R119 : la famille d'armes de l'arme choisie
ALTER TABLE personnage_acquis_choix ADD COLUMN arme_famille_id TEXT   REFERENCES arme_famille(id) CHECK (arme_famille_id IS NULL OR valeur IS NULL);

CREATE UNIQUE INDEX personnage_acquis_choix_arme ON personnage_acquis_choix (personnage_id, source, rang) WHERE arme_famille_id IS NOT NULL;
