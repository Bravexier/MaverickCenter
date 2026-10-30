-- 0088-r181-dons-variables-du-mage-bleu : décision R181 du propriétaire (docs/decisions-regles.md, 2026-10-30) : « Il devra choisir l'un dons
-- disponible en bas de la fiche de la classe du mage bleu, limité sa magie innée (sauf mention contraire) pour le don "secondaire". » ; « Dans le cas où
-- il n'a pas de magie aquise, il ne peut pas choisir le don "secondaire" » ; chaque entrée ne se prend qu'une fois (Q93). Migration de STRUCTURE et de
-- DONNÉES :
--   * classe_annexe_entree (section 6) : le tableau libre du Mage Bleu (classe_annexe, A58:AR127) découpé en ses 54 entrées, une par ligne
--     « (Type) Nom. Effet » du texte de chaque ligne, citée sans rien réécrire (type_brut || ' ' || nom || '. ' || effet = la ligne de la source) ; id
--     figé '<classe_id>#entree:<libelle_cle>:<normalize(nom)>' ; type et limite typés seulement sous la forme « N fois/période » ;
--   * capacite_variable (section 6) : les cinq dons « Variable » du Mage Bleu et la magie que vise leur texte (« lié à sa magie innée » : Mimétisme, Mime,
--     Principale, Ultime raison ; « lié à sa magie acquise » : Secondaire) ;
--   * personnage_don_obtenu (section 13, vide dans data/rows ; la base vivante d'un serveur est reconstruite, pas migrée) : l'entrée choisie pour chaque
--     don « Variable », une entrée une seule fois par fiche ;
--   * v_personnage_controle : quatre règles de plus (don_obtenu_sans_magie_acquise, don_obtenu_a_choisir, don_obtenu_source_perdue,
--     don_obtenu_hors_liste) ; les autres sont celles de 0082, inchangées.

DROP VIEW v_personnage_controle;

CREATE TABLE classe_annexe_entree (
  id             TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),
  classe_id      TEXT    NOT NULL,
  annexe_rang    INTEGER NOT NULL,                                   -- la ligne du tableau (classe_annexe.rang), donc sa magie
  rang           INTEGER NOT NULL CHECK (rang >= 1),                 -- position de l'entrée dans le texte de la ligne, de haut en bas
  nom            TEXT    NOT NULL CHECK (length(nom) > 0),           -- tel qu'écrit, entre la parenthèse et le premier « . » : « Attrape-moi ! », « 25h »
  nom_cle        TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),   -- normalize(nom)
  type           TEXT    NOT NULL CHECK (type IN ('passif', 'actif', 'action', 'reaction')),   -- premier mot de type_brut, sans accent ni casse (comme capacite.type)
  type_brut      TEXT    NOT NULL CHECK (length(type_brut) > 0),     -- l'en-tête tel qu'écrit, parenthèses comprises : « (Actif 2 fois/combat) », « (Passif] » (Terre)
  limite_brute   TEXT,                                               -- la limite de l'en-tête, telle qu'écrite : « 2 fois/combat », « 1 fois/tour » ; NULL sans limite
  limite_nombre  INTEGER CHECK (limite_nombre >= 1),                 -- N de « N fois/période » (comme capacite.limite_nombre) ; NULL pour toute autre forme
  limite_periode TEXT,                                               -- période de cette limite, telle qu'écrite (« combat », « tour ») ; NULL avec limite_nombre
  effet          TEXT    NOT NULL CHECK (length(effet) > 0),         -- le reste de la ligne, tel qu'écrit (« cette créature »…)
  origine        TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref     TEXT    NOT NULL CHECK (length(source_ref) > 0),    -- la plage de la ligne du tableau (celle de classe_annexe)
  remarque       TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  FOREIGN KEY (classe_id, annexe_rang) REFERENCES classe_annexe (classe_id, rang),
  UNIQUE (classe_id, annexe_rang, rang),
  CHECK ((limite_nombre IS NULL) = (limite_periode IS NULL)),
  CHECK (limite_nombre IS NULL OR limite_brute IS NOT NULL)
) STRICT, WITHOUT ROWID;

INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:sang:temeraire', 'classes/mage-bleu', 1, 1, 'Téméraire', 'temeraire', 'passif', '(Passif)', NULL, NULL, NULL, 'Diminue de 5% le malus pour toucher une cible de la posture offensive.', 'classes', 'Classe Maverick V7 › Mage Bleu › A58:AR62');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:sang:regeneration', 'classes/mage-bleu', 1, 2, 'Régénération', 'regeneration', 'passif', '(Passif)', NULL, NULL, NULL, 'Récupère 1d4 santé chaque début de tour. (ne marche pas quand coma).', 'classes', 'Classe Maverick V7 › Mage Bleu › A58:AR62');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:sang:attaque-saignante', 'classes/mage-bleu', 1, 3, 'Attaque saignante', 'attaque-saignante', 'actif', '(Actif 2 fois/combat)', '2 fois/combat', 2, 'combat', 'La prochaine attaque réussie obligera le jet de vigueur à l''adversaire pour ne pas qu''il prenne "saignement 1".', 'classes', 'Classe Maverick V7 › Mage Bleu › A58:AR62');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:sang:rage-de-sang', 'classes/mage-bleu', 1, 4, 'Rage de sang', 'rage-de-sang', 'action', '(Action 1 fois/combat)', '1 fois/combat', 1, 'combat', 'Excite les alliés, leur donnant la capacité de faire +6 dégâts contre les cibles qui ont un état de saignement pendant 4 tours.', 'classes', 'Classe Maverick V7 › Mage Bleu › A58:AR62');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:arcane:rechargement', 'classes/mage-bleu', 2, 1, 'Rechargement', 'rechargement', 'passif', '(Passif)', NULL, NULL, NULL, 'Récupère 1d4 chakra chaque début de tour. (ne marche pas quand coma).', 'classes', 'Classe Maverick V7 › Mage Bleu › A63:AR67');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:arcane:rune-immediate', 'classes/mage-bleu', 2, 2, 'Rune immédiate', 'rune-immediate', 'passif', '(Passif)', NULL, NULL, NULL, 'Obtient une résistance à l''élément du dernier sort subi pour un tour. (non cumulable)', 'classes', 'Classe Maverick V7 › Mage Bleu › A63:AR67');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:arcane:miroir-partiel', 'classes/mage-bleu', 2, 3, 'Miroir partiel', 'miroir-partiel', 'reaction', '(Réaction 2 fois/combat)', '2 fois/combat', 2, 'combat', 'Renvoi à hauteur de 25% des effets du sort de l’adversaire (l’agresseur peut se défendre contre cette contre-attaque si c’est possible)', 'classes', 'Classe Maverick V7 › Mage Bleu › A63:AR67');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:corruption:science-du-critique', 'classes/mage-bleu', 3, 1, 'Science du critique', 'science-du-critique', 'passif', '(Passif)', NULL, NULL, NULL, 'Cette créature a +2 à la réussite critique et à l’échec critique.', 'classes', 'Classe Maverick V7 › Mage Bleu › A68:AR72');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:corruption:eponge-a-corruption', 'classes/mage-bleu', 3, 2, 'Éponge à corruption', 'eponge-a-corruption', 'passif', '(Passif)', NULL, NULL, NULL, 'Peut soigner une cible de 1d4 corruption si elle est à côté.', 'classes', 'Classe Maverick V7 › Mage Bleu › A68:AR72');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:corruption:pollution', 'classes/mage-bleu', 3, 3, 'Pollution', 'pollution', 'actif', '(Actif 2 fois/combat)', '2 fois/combat', 2, 'combat', 'L''attaque avec l''arme va diminuer pendant un tour une résistance magique aléatoire.', 'classes', 'Classe Maverick V7 › Mage Bleu › A68:AR72');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:corruption:petronage', 'classes/mage-bleu', 3, 4, 'Pétronage', 'petronage', 'passif', '(Passif)', NULL, NULL, NULL, 'La vitesse augmente de +1 sur un terrain marécageux.', 'classes', 'Classe Maverick V7 › Mage Bleu › A68:AR72');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:espace-temps:25h', 'classes/mage-bleu', 4, 1, '25h', '25h', 'actif', '(Actif 1 fois/combat)', '1 fois/combat', 1, 'combat', 'Cette créature est capable d’utiliser un sortilège de l’Espace/Temps qui est capable de placement, le sort ne fera rien d’autre que l’effet de placement.', 'classes', 'Classe Maverick V7 › Mage Bleu › A73:AR77');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:espace-temps:couple-extremite', 'classes/mage-bleu', 4, 2, 'Couple extrémité', 'couple-extremite', 'passif', '(Passif)', NULL, NULL, NULL, 'Tours impairs = +4 Initiative | Tours pairs = -4 Initiative.', 'classes', 'Classe Maverick V7 › Mage Bleu › A73:AR77');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:espace-temps:double', 'classes/mage-bleu', 4, 3, 'Double', 'double', 'passif', '(Passif)', NULL, NULL, NULL, 'Tous les 3 tours, un clone de la créature apparait et a 50% de chance de prendre la prochaine agression à la place de l''original.', 'classes', 'Classe Maverick V7 › Mage Bleu › A73:AR77');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:vide:attaque-dissipante', 'classes/mage-bleu', 5, 1, 'Attaque dissipante', 'attaque-dissipante', 'passif', '(Passif)', NULL, NULL, NULL, 'Tous les 3 tours, l’attaque de cette créature inflige l’effet du sort “dissipation” de la magie du vide.', 'classes', 'Classe Maverick V7 › Mage Bleu › A78:AR82');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:vide:maitre-du-silence', 'classes/mage-bleu', 5, 2, 'Maître du silence', 'maitre-du-silence', 'passif', '(Passif)', NULL, NULL, NULL, 'Cette créature ne peut pas subir les sorts ou effets qui empêchent d’utiliser la magie.', 'classes', 'Classe Maverick V7 › Mage Bleu › A78:AR82');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:vide:esprit-solide', 'classes/mage-bleu', 5, 3, 'Esprit solide', 'esprit-solide', 'passif', '(Passif)', NULL, NULL, NULL, 'Avantage sur les jets contre la couardise ou le contrôle mental.', 'classes', 'Classe Maverick V7 › Mage Bleu › A78:AR82');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:vide:totem-du-vide', 'classes/mage-bleu', 5, 4, 'Totem du vide', 'totem-du-vide', 'passif', '(Passif)', NULL, NULL, NULL, 'Les ennemis à 2 cases autour de la créature ont un malus de 10% à tous les jets qui impliquent la volonté.', 'classes', 'Classe Maverick V7 › Mage Bleu › A78:AR82');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:necromancie:squelettique', 'classes/mage-bleu', 6, 1, 'Squelettique', 'squelettique', 'passif', '(Passif)', NULL, NULL, NULL, 'Augmente d''un cran la résistance aux dégâts d''estoc des armures. Être sans armure donne 2AP base.', 'classes', 'Classe Maverick V7 › Mage Bleu › A83:AR87');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:necromancie:attaque-poison', 'classes/mage-bleu', 6, 2, 'Attaque poison', 'attaque-poison', 'actif', '(Actif 2 fois/combat)', '2 fois/combat', 2, 'combat', 'La prochaine attaque réussie obligera le jet de vigueur à l''adversaire pour ne pas qu''il prenne "poison 1".', 'classes', 'Classe Maverick V7 › Mage Bleu › A83:AR87');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:necromancie:chair-de-mort', 'classes/mage-bleu', 6, 3, 'Chair de mort', 'chair-de-mort', 'passif', '(Passif)', NULL, NULL, NULL, 'Avantage sur les jets contre le poison ou le contrôle mental.', 'classes', 'Classe Maverick V7 › Mage Bleu › A83:AR87');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:necromancie:attrape-moi', 'classes/mage-bleu', 6, 4, 'Attrape-moi !', 'attrape-moi', 'passif', '(Passif)', NULL, NULL, NULL, 'Augmente les jets de défense de 2% par créature empoisonnée sur le terrain.', 'classes', 'Classe Maverick V7 › Mage Bleu › A83:AR87');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:feu:moteur-thermique', 'classes/mage-bleu', 7, 1, 'Moteur thermique', 'moteur-thermique', 'passif', '(Passif)', NULL, NULL, NULL, 'Si un dégât de l''élément feu est encaissé, les dégâts augmentent de +3 et la vitesse de 1 pendant 2 tours.', 'classes', 'Classe Maverick V7 › Mage Bleu › A88:AR92');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:feu:deflagration', 'classes/mage-bleu', 7, 2, 'Déflagration', 'deflagration', 'passif', '(Passif)', NULL, NULL, NULL, 'Sacrifie les AP ou AM pour les ajouter à ses dégâts pendant 2 tours.', 'classes', 'Classe Maverick V7 › Mage Bleu › A88:AR92');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:feu:eponge-a-soin', 'classes/mage-bleu', 7, 3, 'Éponge à soin', 'eponge-a-soin', 'passif', '(Passif)', NULL, NULL, NULL, 'Obtient un bonus de +4 à chaque soin obtenu (magique ou potion).', 'classes', 'Classe Maverick V7 › Mage Bleu › A88:AR92');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:feu:sang-de-feu', 'classes/mage-bleu', 7, 4, 'Sang de feu', 'sang-de-feu', 'passif', '(Passif)', NULL, NULL, NULL, 'Sur les terrains ou météos où le feu est avantagé : +3 dégâts, +1 AP. Sur les terrains ou météos où le feu est désavantagé : -3 dégâts, -1 AP', 'classes', 'Classe Maverick V7 › Mage Bleu › A88:AR92');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:eau:gluant', 'classes/mage-bleu', 8, 1, 'Gluant', 'gluant', 'passif', '(Passif)', NULL, NULL, NULL, 'Augmente d''un cran la résistance aux dégâts de frappe des armures mais augmente la faiblesse à la foudre.', 'classes', 'Classe Maverick V7 › Mage Bleu › A93:AR97');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:eau:reparation', 'classes/mage-bleu', 8, 2, 'Réparation', 'reparation', 'passif', '(Passif)', NULL, NULL, NULL, 'Récupère 1d4 barrière chaque début de tour. (ne marche pas quand coma).', 'classes', 'Classe Maverick V7 › Mage Bleu › A93:AR97');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:eau:aisance-marine', 'classes/mage-bleu', 8, 3, 'Aisance marine', 'aisance-marine', 'passif', '(Passif)', NULL, NULL, NULL, '+1 vitesse dans l''eau.', 'classes', 'Classe Maverick V7 › Mage Bleu › A93:AR97');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:eau:mucus', 'classes/mage-bleu', 8, 4, 'Mucus', 'mucus', 'passif', '(Passif)', NULL, NULL, NULL, 'Annule les 4 premiers dégâts magiques encaissés. Se recharge tous les débuts de tour.', 'classes', 'Classe Maverick V7 › Mage Bleu › A93:AR97');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:glace:attaque-glacante', 'classes/mage-bleu', 9, 1, 'Attaque glaçante', 'attaque-glacante', 'actif', '(Actif 2 fois/combat)', '2 fois/combat', 2, 'combat', 'La prochaine attaque réussie obligera le jet de vigueur à l''adversaire pour ne pas qu''il prenne "gelé 1".', 'classes', 'Classe Maverick V7 › Mage Bleu › A98:AR102');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:glace:neige-permanente', 'classes/mage-bleu', 9, 2, 'Neige permanente', 'neige-permanente', 'passif', '(Passif)', NULL, NULL, NULL, 'Quand la météo neige est invoquée, elle perdurera tant que personne ne la change.', 'classes', 'Classe Maverick V7 › Mage Bleu › A98:AR102');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:glace:peau-froide', 'classes/mage-bleu', 9, 3, 'Peau froide', 'peau-froide', 'passif', '(Passif)', NULL, NULL, NULL, '+2 AM de base.', 'classes', 'Classe Maverick V7 › Mage Bleu › A98:AR102');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:glace:pas-de-la-neige', 'classes/mage-bleu', 9, 4, 'Pas de la neige', 'pas-de-la-neige', 'passif', '(Passif)', NULL, NULL, NULL, 'Ignore totalement les malus des terrains liés à la neige/glace.', 'classes', 'Classe Maverick V7 › Mage Bleu › A98:AR102');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:terre:racine', 'classes/mage-bleu', 10, 1, 'Racine', 'racine', 'passif', '(Passif)', NULL, NULL, NULL, 'Tant qu''il est sur de la terre, cette créature récupère 3 santé au début de son tour.', 'classes', 'Classe Maverick V7 › Mage Bleu › A103:AR107');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:terre:grimpeur', 'classes/mage-bleu', 10, 2, 'Grimpeur', 'grimpeur', 'passif', '(Passif)', NULL, NULL, NULL, 'Avantage sur le jet pour grimper un mur.', 'classes', 'Classe Maverick V7 › Mage Bleu › A103:AR107');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:terre:peau-dure', 'classes/mage-bleu', 10, 3, 'Peau dure', 'peau-dure', 'passif', '(Passif)', NULL, NULL, NULL, '+2 AP de base.', 'classes', 'Classe Maverick V7 › Mage Bleu › A103:AR107');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:terre:sujet-epineux', 'classes/mage-bleu', 10, 4, 'Sujet épineux', 'sujet-epineux', 'passif', '(Passif]', NULL, NULL, NULL, 'En posture de défense, cette créature inflige 4 dégâts lors d''une parade parfaite.', 'classes', 'Classe Maverick V7 › Mage Bleu › A103:AR107');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:vent:charge-sans-peur', 'classes/mage-bleu', 11, 1, 'Charge sans peur', 'charge-sans-peur', 'passif', '(Passif)', NULL, NULL, NULL, 'Permet d''avoir un bonus de +4 au jet d''initiative.', 'classes', 'Classe Maverick V7 › Mage Bleu › A108:AR112');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:vent:crache-spore', 'classes/mage-bleu', 11, 2, 'Crache spore', 'crache-spore', 'action', '(Action)', NULL, NULL, NULL, 'Crache des spores qui obligent toutes les créatures à 2 cases de lui de réussir un jet de vigueur, si elles ratent, elles sont "étourdies" pendant 1 tour.', 'classes', 'Classe Maverick V7 › Mage Bleu › A108:AR112');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:vent:chute-douce', 'classes/mage-bleu', 11, 3, 'Chute douce', 'chute-douce', 'passif', '(Passif)', NULL, NULL, NULL, 'Dégâts de chute divisés par 2 (AVANT L''ARMURE).', 'classes', 'Classe Maverick V7 › Mage Bleu › A108:AR112');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:vent:courant-rapide', 'classes/mage-bleu', 11, 4, 'Courant rapide', 'courant-rapide', 'passif', '(Passif)', NULL, NULL, NULL, 'Si cette créature termine son tour sans ennemi adjacent à lui = +2 INI pour le prochain tour.', 'classes', 'Classe Maverick V7 › Mage Bleu › A108:AR112');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:foudre:paratonnerre', 'classes/mage-bleu', 12, 1, 'Paratonnerre', 'paratonnerre', 'passif', '(Passif)', NULL, NULL, NULL, 'Attire les sorts de la foudre ou bien la foudre naturelle sur lui-même. (S''il est dans la portée du sort)', 'classes', 'Classe Maverick V7 › Mage Bleu › A113:AR117');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:foudre:pied-veloce', 'classes/mage-bleu', 12, 2, 'Pied véloce', 'pied-veloce', 'passif', '(Passif)', NULL, NULL, NULL, '+1 vitesse au sol en cas de météo “orage” ou “champ magnétique”.', 'classes', 'Classe Maverick V7 › Mage Bleu › A113:AR117');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:foudre:dynamo', 'classes/mage-bleu', 12, 3, 'Dynamo', 'dynamo', 'passif', '(Passif)', NULL, NULL, NULL, 'Gagne +3 dégâts de foudre (cumulable 3 fois) pour la prochaine action lorsque la foudre magique ou naturelle le touche.', 'classes', 'Classe Maverick V7 › Mage Bleu › A113:AR117');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:foudre:predateur-cinetique', 'classes/mage-bleu', 12, 4, 'Prédateur cinétique', 'predateur-cinetique', 'passif', '(Passif)', NULL, NULL, NULL, 'Si cette créature a parcouru 4 cases ou plus en ligne droite pour atteindre sa cible = +5% à la réussite de sa prochaine attaque.', 'classes', 'Classe Maverick V7 › Mage Bleu › A113:AR117');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:lumiere:force-solaire', 'classes/mage-bleu', 13, 1, 'Force solaire', 'force-solaire', 'passif', '(Passif)', NULL, NULL, NULL, 'Augmente tous les dégâts de +5 (+7 en grand soleil) mais prend 10% de la santé max en dégâts à chaque fin de tour.', 'classes', 'Classe Maverick V7 › Mage Bleu › A118:AR122');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:lumiere:lumiere-de-force', 'classes/mage-bleu', 13, 2, 'Lumière de force', 'lumiere-de-force', 'reaction', '(Réaction 1 fois/tour)', '1 fois/tour', 1, 'tour', 'Permet d''annuler 5 dégâts d''une attaque encaissée.', 'classes', 'Classe Maverick V7 › Mage Bleu › A118:AR122');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:lumiere:soin-non-mort', 'classes/mage-bleu', 13, 3, 'Soin non-mort', 'soin-non-mort', 'passif', '(Passif)', NULL, NULL, NULL, 'Cette créature est capable de soigner les non-morts et morts-vivants avec la magie de la lumière.', 'classes', 'Classe Maverick V7 › Mage Bleu › A118:AR122');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:lumiere:lanterne-sur-baton', 'classes/mage-bleu', 13, 4, 'Lanterne sur bâton', 'lanterne-sur-baton', 'passif', '(Passif)', NULL, NULL, NULL, 'Cette créature dévoile les ennemis invisibles ou discrets dans un rayon de 2 cases autour de lui.', 'classes', 'Classe Maverick V7 › Mage Bleu › A118:AR122');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:ombre:attaque-maudite', 'classes/mage-bleu', 14, 1, 'Attaque maudite', 'attaque-maudite', 'actif', '(Actif 2 fois/combat)', '2 fois/combat', 2, 'combat', 'La prochaine attaque réussie appliquera l''effet "malédiction" sur l''ennemi pendant 1 tour.', 'classes', 'Classe Maverick V7 › Mage Bleu › A123:AR127');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:ombre:vision-nocturne-partielle', 'classes/mage-bleu', 14, 2, 'Vision nocturne partielle', 'vision-nocturne-partielle', 'passif', '(Passif)', NULL, NULL, NULL, 'Annule les malus dus à l''obscurité.', 'classes', 'Classe Maverick V7 › Mage Bleu › A123:AR127');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:ombre:mantelet-des-tenebres', 'classes/mage-bleu', 14, 3, 'Mantelet des ténèbres', 'mantelet-des-tenebres', 'passif', '(Passif)', NULL, NULL, NULL, 'Impose un malus de 10% aux jets de parade/esquive aux ennemis à 1 case.', 'classes', 'Classe Maverick V7 › Mage Bleu › A123:AR127');
INSERT INTO classe_annexe_entree (id, classe_id, annexe_rang, rang, nom, nom_cle, type, type_brut, limite_brute, limite_nombre, limite_periode, effet, origine, source_ref) VALUES ('classes/mage-bleu#entree:ombre:obscurite-avantageuse', 'classes/mage-bleu', 14, 4, 'Obscurité avantageuse', 'obscurite-avantageuse', 'passif', '(Passif)', NULL, NULL, NULL, 'Cette créature est avantagée dans le noir, il impose un malus de 5% à tous les jets hostiles envers lui et toutes ses attaques ont un bonus de 4.', 'classes', 'Classe Maverick V7 › Mage Bleu › A123:AR127');

-- chaque entrée est une sous-entité de la page de sa classe (convention des id '<id de la page>#<sorte>:<slug>' : db:check, complétude de page_entite)
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine)
  SELECT 'classe_annexe_entree', id, classe_id, 0, 'classes' FROM classe_annexe_entree;

CREATE TABLE capacite_variable (
  capacite_id  TEXT    NOT NULL PRIMARY KEY REFERENCES capacite(id) ON DELETE CASCADE,
  magie        TEXT    NOT NULL CHECK (magie IN ('innee', 'acquise'))
) STRICT, WITHOUT ROWID;

INSERT INTO capacite_variable (capacite_id, magie) VALUES ('capacites/mage-bleu-mime', 'innee');
INSERT INTO capacite_variable (capacite_id, magie) VALUES ('capacites/mage-bleu-mimetisme', 'innee');
INSERT INTO capacite_variable (capacite_id, magie) VALUES ('capacites/mage-bleu-principale', 'innee');
INSERT INTO capacite_variable (capacite_id, magie) VALUES ('capacites/mage-bleu-secondaire', 'acquise');
INSERT INTO capacite_variable (capacite_id, magie) VALUES ('capacites/mage-bleu-ultime-raison', 'innee');

CREATE TABLE personnage_don_obtenu (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  source         TEXT    NOT NULL REFERENCES capacite(id),               -- le don « Variable » (capacite_variable.capacite_id)
  entree_id      TEXT    NOT NULL REFERENCES classe_annexe_entree(id),   -- l'entrée obtenue
  PRIMARY KEY (personnage_id, source),
  UNIQUE (personnage_id, entree_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_don_obtenu_source ON personnage_don_obtenu (source);   -- « les fiches qui ont ce don » (retrait d'un don, R42)

-- v_personnage_controle : copiée de data/schema.sql (dons « Variable » : décision R181)
CREATE VIEW v_personnage_controle AS
  -- Race : classe accessible (matrice « Accessibilité de Classe », décision R8)
  SELECT pc.personnage_id, 'classe_inaccessible' AS regle, pc.classe_id AS detail
  FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
  WHERE p.race_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM race_classe rc WHERE rc.race_id = p.race_id AND rc.classe_id = pc.classe_id AND rc.accessible = 1)
  UNION ALL
  -- Race et magie innée : toute fiche en a une (jusqu'à la migration 0038, une contrainte de la table pour toute fiche hors brouillon)
  SELECT p.id, 'race_manquante', NULL
  FROM personnage p
  WHERE p.race_id IS NULL
  UNION ALL
  SELECT p.id, 'magie_innee_manquante', NULL
  FROM personnage p
  WHERE p.magie_innee_id IS NULL
  UNION ALL
  -- Classe réservée à une magie innée, qui l'impose en classe 1 (classe.magie_innee_id ; l'Archimage et le Potentiel Illimité, décision R23)
  SELECT pc.personnage_id, 'classe_reservee', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_id IS NOT NULL AND c.magie_innee_id IS NOT p.magie_innee_id
  UNION ALL
  SELECT p.id, 'classe_imposee', c.id
  FROM personnage p
  JOIN classe c ON c.magie_innee_id = p.magie_innee_id
  JOIN personnage_classe pc ON pc.personnage_id = p.id AND pc.rang = 1
  WHERE pc.classe_id <> c.id
  UNION ALL
  -- Classe que ferme la magie innée, à tous les rangs (classe.magie_innee_exclue_id ; le Mage Bleu et le Potentiel Illimité, décision R25)
  SELECT pc.personnage_id, 'classe_exclue', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_exclue_id = p.magie_innee_id
  UNION ALL
  -- Magie innée accessible à la race : matrice « Accessibilité Magie » (R8), sauf liste de l'onglet de la race qui prime (R11)
  SELECT p.id, 'magie_innee_inaccessible', p.magie_innee_id
  FROM personnage p
  WHERE p.race_id IS NOT NULL AND p.magie_innee_id IS NOT NULL
    AND CASE WHEN EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id)
             THEN NOT EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id AND o.magie_id = p.magie_innee_id)
             ELSE NOT EXISTS (SELECT 1 FROM race_magie rm WHERE rm.race_id = p.race_id AND rm.magie_id = p.magie_innee_id AND rm.accessible = 1)
        END
  UNION ALL
  -- Magies incompatibles entre elles (bloc « Magie non compatible » des onglets de magie)
  SELECT p.id, 'magies_incompatibles', p.magie_innee_id || ' / ' || p.magie_acquise_id
  FROM personnage p
  JOIN v_magie_incompatible i ON i.a = p.magie_innee_id AND i.b = p.magie_acquise_id
  UNION ALL
  -- Mono-magie (décision R15) : pas de magie acquise avec une magie mono-magie, sauf ethnie citée par magie_ethnie_secondaire, que la magie
  -- mono-magie soit l'innée ou l'acquise (décision R20 : l'Elfe Noir Charbon et le Felfe Noir peuvent acquérir la Corruption)
  SELECT p.id, 'mono_magie', m.id
  FROM personnage p
  JOIN magie m ON m.mono_magie = 1 AND m.id IN (p.magie_innee_id, p.magie_acquise_id)
  WHERE p.magie_acquise_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM magie_ethnie_secondaire s WHERE s.magie_id = m.id AND s.ethnie_id = p.ethnie_id)
  UNION ALL
  -- Race à une seule magie (race.mono_magie ; la Lamia, décision R28) : pas de magie acquise
  SELECT p.id, 'race_mono_magie', p.magie_acquise_id
  FROM personnage p JOIN race r ON r.id = p.race_id
  WHERE r.mono_magie = 1 AND p.magie_acquise_id IS NOT NULL
  UNION ALL
  -- Ethnie : de la race choisie ; obligatoire quand la race en a ; liée à la magie innée quand elle porte une magie (BDD!X2). Sans race ou sans magie
  -- innée, rien à comparer : race_manquante, magie_innee_manquante le disent (migration 0038)
  SELECT p.id, 'ethnie_hors_race', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.race_id <> p.race_id
  UNION ALL
  SELECT p.id, 'ethnie_manquante', p.race_id
  FROM personnage p
  WHERE p.ethnie_id IS NULL AND EXISTS (SELECT 1 FROM ethnie e WHERE e.race_id = p.race_id)
  UNION ALL
  SELECT p.id, 'ethnie_magie', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.magie_id <> p.magie_innee_id
  UNION ALL
  -- Point de caractéristique de la magie innée : à choisir seulement quand la magie ne le fixe pas
  SELECT p.id, 'caracteristique_magie', COALESCE(p.caracteristique_magie_id, '(absente)')
  FROM personnage p JOIN magie m ON m.id = p.magie_innee_id
  WHERE (m.caracteristique_id IS NULL) <> (p.caracteristique_magie_id IS NOT NULL)
  UNION ALL
  -- Caractéristiques : les six, dans les bornes de la race, total exact du niveau (seuil 'caracteristiques_total', décision R3)
  SELECT p.id, 'caracteristique_manquante', c.id
  FROM personnage p CROSS JOIN caracteristique c
  WHERE NOT EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = p.id AND pc.caracteristique_id = c.id)
  UNION ALL
  SELECT pc.personnage_id, 'caracteristique_hors_bornes', pc.caracteristique_id || ' = ' || pc.base
  FROM personnage_caracteristique pc
  JOIN personnage p ON p.id = pc.personnage_id
  JOIN v_race_carac_borne b ON b.race_id = p.race_id AND b.caracteristique_id = pc.caracteristique_id
  WHERE pc.base < b.minimum OR pc.base > b.maximum
  UNION ALL
  SELECT n.personnage_id, 'caracteristiques_total', (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) || ' / ' || s.valeur
  FROM v_personnage_niveau n
  JOIN seuil_niveau s ON s.regle = 'caracteristiques_total'
   AND s.niveau_min = (SELECT MAX(t.niveau_min) FROM seuil_niveau t WHERE t.regle = 'caracteristiques_total' AND t.niveau_min <= n.niveau_global)
  WHERE EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id)
    AND (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) <> s.valeur
  UNION ALL
  -- Compétences : naturel au plus le maximum du niveau, total naturel = budget cumulé (R3)
  SELECT pc.personnage_id, 'competence_naturel_max', pc.competence_id || ' = ' || pc.naturel
  FROM personnage_competence pc
  JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE pc.naturel > v.competence_naturel_max
  UNION ALL
  SELECT n.personnage_id, 'competences_total', COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) || ' / ' || v.points_competences_cumul
  FROM v_personnage_niveau n
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) <> v.points_competences_cumul
  UNION ALL
  -- Entraînement (décision R104) : 15 compétences au plus (« Vous ne pouvez monter que 15 compétences maximum »), 10 points au plus chacune (« à hauteur
  -- maximum 10% de bonus » ; une ligne à 0 ne monte rien) ; l'Acquis, lui, se calcule (le plafond de 5 par point de caractéristique est appliqué par la page)
  SELECT pe.personnage_id, 'entrainement_competences', COUNT(*) || ' / ' || (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.competences_max')
  FROM personnage_entrainement pe
  WHERE pe.competence_id IS NOT NULL AND pe.valeur > 0
  GROUP BY pe.personnage_id
  HAVING COUNT(*) > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.competences_max')
  UNION ALL
  SELECT pe.personnage_id, 'entrainement_valeur', pe.competence_id || ' = ' || pe.valeur
  FROM personnage_entrainement pe
  WHERE pe.valeur > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.bonus_max_pct')
  UNION ALL
  -- Métier (décision R33) : un bonus choisi est une compétence d'un rang à choix du métier de la fiche ; chaque rang à choix a le sien
  SELECT c.personnage_id, 'metier_bonus_hors_choix', c.competence_id
  FROM personnage_metier_bonus c JOIN personnage p ON p.id = c.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM metier_bonus b WHERE b.metier_id = p.metier_id AND b.rang = c.rang AND b.competence_id = c.competence_id
                      AND (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) > 1)
  UNION ALL
  SELECT p.id, 'metier_bonus_manquant', b.texte
  FROM personnage p JOIN metier_bonus b ON b.metier_id = p.metier_id AND b.option = 1
  WHERE (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang AND o.competence_id IS NOT NULL) > 1
    AND NOT EXISTS (SELECT 1 FROM personnage_metier_bonus c WHERE c.personnage_id = p.id AND c.rang = b.rang)
  UNION ALL
  -- Gains de niveau (décision R73) : santé + chakra gagnés (personnage.gains_sante, gains_chakra) = les points d'attributs des niveaux atteints
  -- (v_niveau.points_attributs_cumul : 15 par niveau à partir du 2), plus le dé bonus de chaque niveau atteint qui en donne un, entre son plus petit
  -- et son plus grand résultat (niveau_global.de_attributs_min, de_attributs_max : 1 et 8) ; au niveau 1, rien. Détail : « total / à saisir », ou
  -- « total / minimum à maximum » quand un dé est atteint
  SELECT n.personnage_id, 'gains_niveau', (p.gains_sante + p.gains_chakra) || ' / ' || (v.points_attributs_cumul + v.de_attributs_min_cumul)
         || CASE WHEN v.de_attributs_max_cumul > v.de_attributs_min_cumul THEN ' à ' || (v.points_attributs_cumul + v.de_attributs_max_cumul) ELSE '' END
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE p.gains_sante + p.gains_chakra NOT BETWEEN v.points_attributs_cumul + v.de_attributs_min_cumul
                                               AND v.points_attributs_cumul + v.de_attributs_max_cumul
  UNION ALL
  -- Classes : la 2e existe exactement quand elle a des niveaux (R2) ; une spécialité se choisit au niveau de classe 10 (BDD!I2, J2)
  SELECT n.personnage_id, 'classe_2_manquante', CAST(n.niveau_classe_2 AS TEXT)
  FROM v_personnage_niveau n
  WHERE n.niveau_classe_2 > 0
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 2)
  UNION ALL
  SELECT n.personnage_id, 'classe_2_en_trop', pc.classe_id
  FROM v_personnage_niveau n JOIN personnage_classe pc ON pc.personnage_id = n.personnage_id AND pc.rang = 2
  WHERE n.niveau_classe_2 = 0
  UNION ALL
  SELECT n.personnage_id, 'classe_1_manquante', NULL
  FROM v_personnage_niveau n
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 1)
  UNION ALL
  SELECT pc.personnage_id, 'specialite_trop_tot', pc.specialite_id
  FROM personnage_classe pc JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  WHERE pc.specialite_id IS NOT NULL
    AND CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END < 10
  UNION ALL
  -- Dons choisis : d'une classe du personnage, de sa spécialité s'ils en dépendent, jamais deux options exclusives ensemble
  SELECT pk.personnage_id, 'capacite_hors_classe', pk.capacite_id
  FROM personnage_capacite pk JOIN capacite c ON c.id = pk.capacite_id
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = pk.personnage_id AND pc.classe_id = c.classe_id
                      AND (c.specialite_id IS NULL OR c.specialite_id = pc.specialite_id))
  UNION ALL
  SELECT a.personnage_id, 'capacites_exclusives', a.capacite_id || ' / ' || b.capacite_id
  FROM personnage_capacite a
  JOIN v_capacite_exclusive x ON x.capacite_id = a.capacite_id
  JOIN personnage_capacite b ON b.personnage_id = a.personnage_id AND b.capacite_id = x.autre_id
  WHERE a.capacite_id < b.capacite_id
  UNION ALL
  -- Sorts : d'une magie du personnage (le Potentiel Illimité « pioche ses sorts dans toutes les magies existantes », son Explication) ;
  -- NPM au plus la puissance magique du niveau (niveau_global : niveau 16 pour la 5, décision R16), le palier dont la note dit « non disponible pour
  -- les personnages avec une magie acquise » ne comptant pas pour eux. NM (décision R26) : au plus 3 sur un sort, toutes origines comprises ; ceux de niveau
  -- au plus niveau global − 1 sur un sort (BDD!BB6) et au plus les NM gagnés en tout ; au-delà, ils viennent d'un livre ou du MJ (décision R24). Depuis la
  -- décision R118 (migration 0066), les NM du MJ sont ceux de la fiche (personnage.nm_mj), pas d'un sort : les NM d'un sort sans celui de son livre
  -- comptent, au plus niveau global − 1 plus les NM du MJ sur un sort, au plus les NM gagnés plus ceux du MJ en tout (tant qu'un niveau donne un NM, la
  -- seconde règle implique la première, qui nomme le sort). Le livre d'un sort (personnage_livre_sort, décision R169, migration 0082) n'est ôté que
  -- d'un sort choisi (une ligne de personnage_sort, jointe par la clé primaire du livre : jamais deux lignes) qui a au moins 1 NM (comme
  -- lib/fiche-moteur.mjs#nmDuSort : jamais moins de 0 NM comptés) ; le livre d'un sort non choisi, en attente, ne change rien
  SELECT ps.personnage_id, 'sort_hors_magie', ps.sort_id
  FROM personnage_sort ps JOIN sort s ON s.id = ps.sort_id JOIN personnage p ON p.id = ps.personnage_id
  WHERE s.magie_id <> COALESCE(p.magie_innee_id, '') AND s.magie_id <> COALESCE(p.magie_acquise_id, '')
    AND COALESCE(p.magie_innee_id, '') <> 'magies/potentiel-illimite'
  UNION ALL
  SELECT ps.personnage_id, 'sort_puissance', ps.sort_id || ' : NPM ' || s.niveau
  FROM personnage_sort ps
  JOIN sort s ON s.id = ps.sort_id
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE s.niveau > (SELECT MAX(g.puissance_magique) FROM niveau_global g
                    WHERE g.niveau <= n.niveau_global AND (p.magie_acquise_id IS NULL OR g.puissance_magique_note IS NULL))
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_plafond', ps.sort_id || ' = ' || ps.niveau_maitrise
  FROM personnage_sort ps
  WHERE ps.niveau_maitrise > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_max')
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_max', ps.sort_id || ' = ' || (ps.niveau_maitrise - CASE WHEN l.sort_id IS NULL OR ps.niveau_maitrise = 0 THEN 0 ELSE 1 END)
  FROM personnage_sort ps
  LEFT JOIN personnage_livre_sort l ON l.personnage_id = ps.personnage_id AND l.sort_id = ps.sort_id
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE ps.niveau_maitrise - CASE WHEN l.sort_id IS NULL OR ps.niveau_maitrise = 0 THEN 0 ELSE 1 END > n.niveau_global - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_ecart_niveau_global') + p.nm_mj
  UNION ALL
  -- NM gagnés : ceux des niveaux (v_niveau.niveaux_maitrise_cumul), plus ceux qu'écrit un don acquis (« Gagne 4 niveaux de maîtrise (NM). » de
  -- l'Ocultomancien : capacite_nm_gagne, v_personnage_don_acquis ; décision R154, migration 0076), plus ceux du MJ ; sort_nm_max ne les lit pas.
  -- Détail : « comptés / des niveaux », puis « + N des dons » et « + N du MJ » quand il y en a
  SELECT n.personnage_id, 'sorts_nm_total', (SELECT SUM(ps.niveau_maitrise - CASE WHEN l.sort_id IS NULL OR ps.niveau_maitrise = 0 THEN 0 ELSE 1 END) FROM personnage_sort ps
                                             LEFT JOIN personnage_livre_sort l ON l.personnage_id = ps.personnage_id AND l.sort_id = ps.sort_id
                                             WHERE ps.personnage_id = n.personnage_id) || ' / '
         || v.niveaux_maitrise_cumul || CASE WHEN d.nm > 0 THEN ' + ' || d.nm || ' des dons' ELSE '' END
         || CASE WHEN p.nm_mj > 0 THEN ' + ' || p.nm_mj || ' du MJ' ELSE '' END
  FROM v_personnage_niveau n JOIN v_niveau v ON v.niveau = n.niveau_global JOIN personnage p ON p.id = n.personnage_id
  JOIN (SELECT q.id AS personnage_id, COALESCE((SELECT SUM(g.nm) FROM v_personnage_don_acquis a JOIN capacite_nm_gagne g ON g.capacite_id = a.capacite_id
                                                WHERE a.personnage_id = q.id), 0) AS nm
        FROM personnage q) d ON d.personnage_id = n.personnage_id
  WHERE (SELECT SUM(ps.niveau_maitrise - CASE WHEN l.sort_id IS NULL OR ps.niveau_maitrise = 0 THEN 0 ELSE 1 END) FROM personnage_sort ps
         LEFT JOIN personnage_livre_sort l ON l.personnage_id = ps.personnage_id AND l.sort_id = ps.sort_id
         WHERE ps.personnage_id = n.personnage_id) > v.niveaux_maitrise_cumul + d.nm + p.nm_mj
  UNION ALL
  -- Bouclier (décision R96) : une forme et une matière ; la matière, l'amélioration ou la solidité n'existent qu'avec la forme, et la forme attend sa matière
  SELECT p.id, 'bouclier_manquant', COALESCE(p.bouclier_materiau_id, p.bouclier_amelioration_id, CAST(p.bouclier_solidite AS TEXT))
  FROM personnage p
  WHERE p.bouclier_classe_id IS NULL AND COALESCE(p.bouclier_materiau_id, p.bouclier_amelioration_id, CAST(p.bouclier_solidite AS TEXT)) IS NOT NULL
  UNION ALL
  SELECT p.id, 'bouclier_matiere_manquante', p.bouclier_classe_id
  FROM personnage p
  WHERE p.bouclier_classe_id IS NOT NULL AND p.bouclier_materiau_id IS NULL
  UNION ALL
  -- la forme et la matière désignent un bouclier de la liste (table bouclier) : un couple que l'onglet Boucliers n'écrit pas est signalé
  SELECT p.id, 'bouclier_inconnu', p.bouclier_classe_id || ' + ' || p.bouclier_materiau_id
  FROM personnage p
  WHERE p.bouclier_classe_id IS NOT NULL AND p.bouclier_materiau_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM bouclier b WHERE b.classe_id = p.bouclier_classe_id AND b.materiau_id = p.bouclier_materiau_id)
  UNION ALL
  -- Posture Symbiose (décision R100) : sa magie est la magie innée ou la magie acquise du personnage, pas le Potentiel Illimité (question Q15)
  SELECT p.id, 'symbiose_magie', p.symbiose_magie_id
  FROM personnage p
  WHERE p.symbiose_magie_id IS NOT NULL
    AND (p.symbiose_magie_id = 'magies/potentiel-illimite' OR p.symbiose_magie_id NOT IN (coalesce(p.magie_innee_id, ''), coalesce(p.magie_acquise_id, '')))
  UNION ALL
  -- Maîtrises d'armes (décisions R148 à R151, migration 0076) : chaque point à choisir d'une source acquise (v_personnage_maitrise_part) a sa famille
  -- (personnage_maitrise_choix), parmi les options de sa part ; une ligne de choix relève d'une seule de ces règles : sur une famille sans maîtrise,
  -- maitrise_arme_exclue (ARME DE MONSTRES, R45) ; sinon, d'une source qui n'est plus acquise ou d'un point qu'elle n'a pas, maitrise_source_perdue ;
  -- sinon, hors des options, maitrise_hors_choix. Détail d'une ligne de choix : « source : point = famille ».
  -- Point sans famille (R148) : détail « source = nombre de points à choisir » ; l'accessoire « Un point de maîtrise d'arme » sans famille (R151),
  -- « accessoire:<emplacement> = 1 »
  SELECT a.personnage_id, 'maitrise_a_choisir', a.source_id || ' = ' || (a.points - (SELECT count(*) FROM personnage_maitrise_choix ch
                                                 WHERE ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points))
  FROM v_personnage_maitrise_part a
  WHERE a.genre = 'choix'
    AND (SELECT count(*) FROM personnage_maitrise_choix ch WHERE ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points) < a.points
  UNION ALL
  SELECT pa.personnage_id, 'maitrise_a_choisir', 'accessoire:' || pa.emplacement || ' = ' || e.valeur
  FROM personnage_accessoire pa JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
  WHERE pa.arme_famille_id IS NULL
  UNION ALL
  -- Maîtrise d'arme : pas sur une famille qui n'en a pas (arme_famille.maitrisable = 0 : ARME DE MONSTRES, armes exclusives aux monstres, décision R45),
  -- ni par un choix ni par l'accessoire (« accessoire:<emplacement> : 1 = famille »)
  SELECT ch.personnage_id, 'maitrise_arme_exclue', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch JOIN arme_famille f ON f.id = ch.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  SELECT pa.personnage_id, 'maitrise_arme_exclue', 'accessoire:' || pa.emplacement || ' : 1 = ' || pa.arme_famille_id
  FROM personnage_accessoire pa
  JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
  JOIN arme_famille f ON f.id = pa.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  -- Choix d'une source perdue (classe changée, spécialité perdue, niveau baissé, don à choix retiré) ou d'un point que sa part n'a pas : la page retire
  -- ces choix (comme acquisChoixValables), la base les signale
  SELECT ch.personnage_id, 'maitrise_source_perdue', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch JOIN arme_famille f ON f.id = ch.arme_famille_id
  WHERE f.maitrisable = 1
    AND NOT EXISTS (SELECT 1 FROM v_personnage_maitrise_part a WHERE a.personnage_id = ch.personnage_id AND a.source_id = ch.source AND a.genre = 'choix'
                      AND ch.rang <= a.points)
  UNION ALL
  -- Famille qui n'est pas une option de la part (Ménestrel : les quatre familles à distance, R151 ; « sauf », R138 ; catégorie, R127)
  SELECT ch.personnage_id, 'maitrise_hors_choix', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch
  JOIN arme_famille f ON f.id = ch.arme_famille_id
  JOIN v_personnage_maitrise_part a ON a.personnage_id = ch.personnage_id AND a.source_id = ch.source AND a.genre = 'choix' AND ch.rang <= a.points
  WHERE f.maitrisable = 1
    AND NOT EXISTS (SELECT 1 FROM maitrise_arme_part_famille o WHERE o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id)
  UNION ALL
  -- Limite écrite par famille (R150 : Maître d'arme 2, Combattant libre 3, lignes Bimane, Frappeur, Mercenaire 1 ; « catégorie » = famille, seuls les
  -- points de cette source comptent) ; sans limite écrite, la même famille peut revenir. Détail : « source : famille = points / limite »
  SELECT a.personnage_id, 'maitrise_meme_famille', a.source_id || ' : ' || ch.arme_famille_id || ' = ' || COUNT(*) || ' / ' || a.limite_famille
  FROM v_personnage_maitrise_part a
  JOIN personnage_maitrise_choix ch ON ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points
  JOIN maitrise_arme_part_famille o ON o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id
  WHERE a.genre = 'choix' AND a.limite_famille IS NOT NULL
  GROUP BY a.personnage_id, a.source_id, a.limite_famille, ch.arme_famille_id
  HAVING COUNT(*) > a.limite_famille
  UNION ALL
  -- Plafond (R149) : 4 points au plus par famille (maitrise_arme.des_max − maitrise_arme.des_sans_maitrise), les sources additionnées ; au-delà, signalé
  -- sans rien refuser, les points en trop ne donnent pas de dé. Détail : « famille = points / plafond »
  SELECT m.personnage_id, 'maitrise_plafond', m.arme_famille_id || ' = ' || m.points || ' / ' || m.points_comptes
  FROM v_personnage_maitrise_arme m
  WHERE m.points > m.points_comptes
  UNION ALL
  -- Dons « Variable » du Mage Bleu (décision R181) : un don acquis (v_personnage_don_acquis) de capacite_variable obtient une entrée du tableau libre
  -- de sa classe (classe_annexe_entree), sur la ligne de sa magie innée, ou acquise pour Secondaire (capacite_variable.magie). Don qui vise la magie
  -- acquise sans magie acquise : il ne se choisit pas (détail : le don)
  SELECT a.personnage_id, 'don_obtenu_sans_magie_acquise', a.capacite_id
  FROM v_personnage_don_acquis a
  JOIN capacite_variable v ON v.capacite_id = a.capacite_id
  JOIN personnage p ON p.id = a.personnage_id
  WHERE v.magie = 'acquise' AND p.magie_acquise_id IS NULL
  UNION ALL
  -- Don acquis sans choix, quand sa liste garde une entrée que la fiche n'a pas prise (« chaque entrée ne se prend qu'une fois ») : sans entrée libre
  -- (une magie à 3 entrées pour 4 dons « Variable », question Q96 ; une magie absente ou sans ligne), rien n'est exigé (détail : le don)
  SELECT a.personnage_id, 'don_obtenu_a_choisir', a.capacite_id
  FROM v_personnage_don_acquis a
  JOIN capacite_variable v ON v.capacite_id = a.capacite_id
  JOIN personnage p ON p.id = a.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM personnage_don_obtenu o WHERE o.personnage_id = a.personnage_id AND o.source = a.capacite_id)
    AND EXISTS (SELECT 1 FROM classe_annexe x JOIN classe_annexe_entree e ON e.classe_id = x.classe_id AND e.annexe_rang = x.rang
                WHERE x.classe_id = a.classe_id
                  AND x.magie_id = CASE v.magie WHEN 'innee' THEN p.magie_innee_id ELSE p.magie_acquise_id END
                  AND NOT EXISTS (SELECT 1 FROM personnage_don_obtenu o WHERE o.personnage_id = a.personnage_id AND o.entree_id = e.id))
  UNION ALL
  -- Un choix relève d'une seule règle : d'un don qui n'est plus acquis (classe, spécialité, niveau, don à choix perdus) ou qui n'est pas un don
  -- « Variable », don_obtenu_source_perdue (gardé sans effet, comme maitrise_source_perdue) ; sinon, d'une entrée hors de la liste du don (autre classe,
  -- autre magie, magie visée absente), don_obtenu_hors_liste. Détail : « source = entrée »
  SELECT o.personnage_id, 'don_obtenu_source_perdue', o.source || ' = ' || o.entree_id
  FROM personnage_don_obtenu o
  WHERE NOT EXISTS (SELECT 1 FROM v_personnage_don_acquis a JOIN capacite_variable v ON v.capacite_id = a.capacite_id
                    WHERE a.personnage_id = o.personnage_id AND a.capacite_id = o.source)
  UNION ALL
  SELECT o.personnage_id, 'don_obtenu_hors_liste', o.source || ' = ' || o.entree_id
  FROM personnage_don_obtenu o
  JOIN v_personnage_don_acquis a ON a.personnage_id = o.personnage_id AND a.capacite_id = o.source
  JOIN capacite_variable v ON v.capacite_id = a.capacite_id
  JOIN personnage p ON p.id = o.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM classe_annexe_entree e JOIN classe_annexe x ON x.classe_id = e.classe_id AND x.rang = e.annexe_rang
                    WHERE e.id = o.entree_id AND x.classe_id = a.classe_id
                      AND x.magie_id = CASE v.magie WHEN 'innee' THEN p.magie_innee_id ELSE p.magie_acquise_id END)
  UNION ALL
  -- Équipement : chaque amélioration vise le bon genre d'objet ; celle d'une arme, du catalogue ou élémentaire, est une ligne du tableau fondu des armes
  -- (cible 'arme' : décision R167, migration 0081)
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_id
  WHERE ae.cible <> 'arme'
  UNION ALL
  -- Arme élémentaire d'une magie que le personnage n'a ni en innée ni en acquise (page « Pièces élémentaires » : « il est nécessaire de posséder la magie
  -- pour utiliser les armes ou les armures » ; décision R167 : « les armes élémentaires de ses magies (innée et acquise, sans le Potentiel Illimité) »,
  -- le Potentiel Illimité n'en ouvre aucune autre) : signalée, jamais refusée. Détail : « rang : arme élémentaire »
  SELECT pa.personnage_id, 'arme_elementaire_hors_magie', pa.rang || ' : ' || ael.id
  FROM personnage_arme pa
  JOIN arme_elementaire ael ON ael.id = pa.arme_elementaire_id
  JOIN personnage p ON p.id = pa.personnage_id
  WHERE ael.magie_id <> COALESCE(p.magie_innee_id, '') AND ael.magie_id <> COALESCE(p.magie_acquise_id, '')
  UNION ALL
  -- Type physique choisi (personnage_arme.type_degats_choisi ; décision R167, Bombe : « Au choix » entre Estoc, Frappe et Taille) sur une arme élémentaire
  -- dont le type ne se choisit pas (arme_elementaire_type.type_degats_au_choix = 0), ou hors des types qu'offre son type élémentaire
  -- (arme_elementaire_type_degats) : signalé, jamais refusé (une arme du catalogue, elle, le refuse : CHECK). Détail : « rang : type choisi »
  SELECT pa.personnage_id, 'arme_type_degats_choisi', pa.rang || ' : ' || pa.type_degats_choisi
  FROM personnage_arme pa
  JOIN arme_elementaire ael ON ael.id = pa.arme_elementaire_id
  JOIN arme_elementaire_type t ON t.type_id = ael.type_id
  WHERE pa.type_degats_choisi IS NOT NULL
    AND (t.type_degats_au_choix = 0
         OR NOT EXISTS (SELECT 1 FROM arme_elementaire_type_degats d WHERE d.type_id = t.type_id AND d.type_degats = pa.type_degats_choisi))
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_id
  WHERE ae.cible <> 'armure'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'armure élémentaire : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_elementaire_id
  WHERE ae.cible <> 'armure_elementaire'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'bouclier : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.bouclier_amelioration_id
  WHERE ae.cible <> 'bouclier'
  UNION ALL
  -- Armure (décisions R95, R165) : une armure, de base ou élémentaire, jamais les deux (armure_double ; détail « armure / armure élémentaire ») ; une
  -- amélioration n'existe qu'avec son armure (armure_manquante) ; jamais une armure « Familier » (armure_familier) ; une armure élémentaire d'une
  -- magie innée ou acquise du personnage (armure_magie_absente ; le Potentiel Illimité n'en a pas) ; une partie n'a de solidité que si l'armure
  -- l'a (armure_partie_hors_armure) : une armure élémentaire a ses six parties, jamais « armure-complete » ; une armure de base à solidité unifiée
  -- (armure.solidite_uni = 1) n'a que « armure-complete », les autres les six parties (sans armure, toute partie est signalée ; une armure élémentaire
  -- compte comme une armure sans cran uni). Une fiche qui porte les deux armures est jugée sur l'élémentaire.
  SELECT p.id, 'armure_double', p.armure_id || ' / ' || p.armure_elementaire_id
  FROM personnage p
  WHERE p.armure_id IS NOT NULL AND p.armure_elementaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_manquante', p.armure_amelioration_id
  FROM personnage p
  WHERE p.armure_id IS NULL AND p.armure_amelioration_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_manquante', p.armure_amelioration_elementaire_id
  FROM personnage p
  WHERE p.armure_elementaire_id IS NULL AND p.armure_amelioration_elementaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_familier', p.armure_id
  FROM personnage p JOIN armure a ON a.id = p.armure_id
  WHERE a.type = 'Familier'
  UNION ALL
  SELECT p.id, 'armure_magie_absente', p.armure_elementaire_id
  FROM personnage p JOIN armure_elementaire e ON e.id = p.armure_elementaire_id
  WHERE e.magie_id NOT IN (coalesce(p.magie_innee_id, ''), coalesce(p.magie_acquise_id, ''))
  UNION ALL
  SELECT ap.personnage_id, 'armure_partie_hors_armure', ap.emplacement_id
  FROM personnage_armure_partie ap JOIN personnage p ON p.id = ap.personnage_id LEFT JOIN armure a ON a.id = p.armure_id
  WHERE (p.armure_elementaire_id IS NULL AND a.id IS NULL)
     OR (CASE WHEN p.armure_elementaire_id IS NOT NULL THEN 0 ELSE COALESCE(a.solidite_uni, 0) END = 1) <> (ap.emplacement_id = 'armure-complete')
  UNION ALL
  -- Accessoire : valeur tirée dans la fourchette de l'effet
  SELECT pa.personnage_id, 'accessoire_valeur', pa.emplacement || ' = ' || COALESCE(CAST(pa.valeur AS TEXT), '(absente)')
  FROM personnage_accessoire pa JOIN accessoire_effet ae ON ae.id = pa.accessoire_effet_id
  WHERE (ae.bonus_min IS NULL) <> (pa.valeur IS NULL)
     OR pa.valeur < ae.bonus_min OR pa.valeur > ae.bonus_max;
