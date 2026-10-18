-- 0067-grenades-sort-prepare-arme-choisie : trois décisions du propriétaire du 2026-10-18 (réponses aux questions Q20 et Q22, docs/decisions-regles.md).
-- Migration de STRUCTURE et de DONNÉES.
--   1. R114 (Grenadier, « Pardon ?!? » : « Les bombes et les sorts "grenades" font +11 dégâts ») : un sort grenade se reconnaît à une étiquette posée
--      en base, pas à son nom (« Il faudra d'ailleurs redéfinir ce qu'est un sort "grenade" autrement que pas juste son nom (un tag en base par
--      exemple, qu'on pourrait utiliser pour d'autres choses ») :
--        * le mot-clé « Sort grenade » du glossaire (id `sort-grenade` = normalize(libelle), comme tout mot-clé à sa création), défini par le
--          propriétaire « Type particulier de sort provoquant une explosion localisée », avec le point final de toutes les définitions du glossaire
--          (comme 0058 pour « Solidité ») ; le site s'en sert : il est à protéger (client/src/lib/mots-cles.mjs#MOTS_CLES_PROTEGES, partie du site
--          à venir) ;
--        * la table des étiquettes d'un sort, sort_mot_cle (sort, mot-clé), qui pose « Sort grenade » sur les 14 sorts « Grenade… » de la
--          décision, un dans chaque magie (Collante, Paralysante, Cryogénique, Flash, Caustique, Pétrifiante, de Chakra, Incapacitante,
--          Distordue, Fumigène, Incendiaire, à Clous, Explosive, Implosive) : les 14 sorts de la table `sort` dont le nom commence par
--          « Grenade », cités par leur id (figé : 0006). Un id absent arrête la migration
--          (clé étrangère contrôlée avant le COMMIT). Une étiquette est une règle posée par décision : pas de cascade vers mot_cle (à la
--          différence de page_tag), la clé étrangère refuse de supprimer un mot-clé qui étiquette encore un sort ; le site refusera aussi de le
--          supprimer ou de le fusionner (partie du site à venir).
--   2. R115 (Mage Rouge et Mage Vert : « Le don niveau 1 (et son équivalent mage vert) permettrai de choisir le sort qui est préparé et de noter le
--      résultat du jet de magie si réussi » ; le sort préparé se lance « avec les règles de postures du moment où il a été préparé ») : le sort
--      préparé est un des sorts de la fiche (« Préparation » : « Permet de charger un sort d'attaque lvl1 ou lvl2 le premier tour… »), donc trois
--      colonnes de personnage_sort (section 13) : `prepare` (1 = le sort préparé, 0 par défaut), le résultat du jet de magie (prepare_jet, un D100 :
--      1 à 100) et la posture du moment de la préparation (prepare_posture_id → posture) ; un seul sort préparé par fiche (index unique partiel
--      personnage_sort_prepare). Le jet et la posture n'existent que sur le sort préparé (CHECK : « Lâcher le sort » les efface avec lui) ; le jet
--      reste NULL tant qu'il n'est pas noté (« si réussi »), la posture quand aucune n'était choisie (posture_id NULL). Sur personnage_sort plutôt
--      que sur personnage : la clé garantit que le sort est de la fiche, et un sort retiré des fiches (R42) part avec sa ligne, préparation comprise
--      (pas de nouvelle clé étrangère vers sort).
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
  mot_cle_id  TEXT NOT NULL REFERENCES mot_cle(id),
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

-- 2. R115 : le sort préparé, un des sorts de la fiche (colonnes ajoutées en dernier, avant les contraintes de la table)
ALTER TABLE personnage_sort ADD COLUMN prepare            INTEGER NOT NULL DEFAULT 0 CHECK (prepare IN (0, 1));
ALTER TABLE personnage_sort ADD COLUMN prepare_jet        INTEGER CHECK (prepare_jet IS NULL OR (prepare = 1 AND prepare_jet BETWEEN 1 AND 100));
ALTER TABLE personnage_sort ADD COLUMN prepare_posture_id TEXT    REFERENCES posture(id) CHECK (prepare_posture_id IS NULL OR prepare = 1);

CREATE UNIQUE INDEX personnage_sort_prepare ON personnage_sort (personnage_id) WHERE prepare = 1;

-- 3. R119 : la famille d'armes de l'arme choisie
ALTER TABLE personnage_acquis_choix ADD COLUMN arme_famille_id TEXT    REFERENCES arme_famille(id) CHECK (arme_famille_id IS NULL OR valeur IS NULL);

CREATE UNIQUE INDEX personnage_acquis_choix_arme ON personnage_acquis_choix (personnage_id, source, rang) WHERE arme_famille_id IS NOT NULL;
