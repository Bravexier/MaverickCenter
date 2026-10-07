-- 0003-orthographe-magies : corrections orthographiques des textes des sorts, des magies et de leurs tables dérivées (décision R10 du propriétaire : « à corriger, jamais un chiffre ni le sens d'une règle »).
-- Migration de DONNÉES (aucun changement de structure : seule la version du schéma monte). Chaque correction est une substitution de lettres, d'accents, d'accords, de ponctuation ou de casse ;
-- aucun chiffre, signe, dé, nom de sort (identifiant) n'est changé et aucun mot n'est ajouté ni retiré. Le détail (avant, après, nature, raison) est dans 0003-orthographe-magies.json.
-- Les points laissés au propriétaire (noms de sorts dont la correction changerait l'identifiant, mots manquants, casse des termes du jeu) sont dans docs/sql/a-valider.md.

-- magie magies/potentiel-illimite banniere [accent] : « DIFFICILE A JOUER » -> « DIFFICILE À JOUER » (Majuscule accentuée : « À » (préposition) en capitales.)
UPDATE magie SET banniere = replace(banniere, 'DIFFICILE A JOUER', 'DIFFICILE À JOUER') WHERE id = 'magies/potentiel-illimite' AND instr(banniere, 'DIFFICILE A JOUER') > 0;
-- magie magies/potentiel-illimite description [grammaire] : « de l'égalé » -> « de l'égaler » (Infinitif attendu après « impossible de ».)
UPDATE magie SET description = replace(description, 'de l''égalé', 'de l''égaler') WHERE id = 'magies/potentiel-illimite' AND instr(description, 'de l''égalé') > 0;
-- magie magies/potentiel-illimite description_physique [grammaire] : « deviennent dorées » -> « deviennent dorés » (Accord avec « tatouages » (masculin pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'deviennent dorées', 'deviennent dorés') WHERE id = 'magies/potentiel-illimite' AND instr(description_physique, 'deviennent dorées') > 0;
-- magie magies/potentiel-illimite description_physique [grammaire] : « moins charnue » -> « moins charnus » (Accord avec « physiques » (masculin pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'moins charnue', 'moins charnus') WHERE id = 'magies/potentiel-illimite' AND instr(description_physique, 'moins charnue') > 0;
-- magie magies/potentiel-illimite description_physique [orthographe] : « la plus part des gens » -> « la plupart des gens » (« plupart » s'écrit en un seul mot.)
UPDATE magie SET description_physique = replace(description_physique, 'la plus part des gens', 'la plupart des gens') WHERE id = 'magies/potentiel-illimite' AND instr(description_physique, 'la plus part des gens') > 0;
-- magie magies/potentiel-illimite explication [grammaire] : « intérêt reposé sur » -> « intérêt repose sur » (Verbe conjugué attendu (sujet « le principal intérêt »), pas le participe.)
UPDATE magie SET explication = replace(explication, 'intérêt reposé sur', 'intérêt repose sur') WHERE id = 'magies/potentiel-illimite' AND instr(explication, 'intérêt reposé sur') > 0;
-- magie magies/potentiel-illimite explication [grammaire] : « toute les magies existante » -> « toutes les magies existantes » (Accord avec « magies » (féminin pluriel) : « toutes » et « existantes ».)
UPDATE magie SET explication = replace(explication, 'toute les magies existante', 'toutes les magies existantes') WHERE id = 'magies/potentiel-illimite' AND instr(explication, 'toute les magies existante') > 0;
-- magie magies/potentiel-illimite explication [grammaire] : « à peu de race » -> « à peu de races » (Pluriel après « peu de » (la liste qui suit en compte plusieurs).)
UPDATE magie SET explication = replace(explication, 'à peu de race', 'à peu de races') WHERE id = 'magies/potentiel-illimite' AND instr(explication, 'à peu de race') > 0;
-- magie magies/potentiel-illimite explication [ponctuation] : « Mono magie uniquement » -> « Mono-magie uniquement » (Trait d’union, comme « Mono-Magie » / « Bi-magie » dans la colonne variante des modes hyper.)
UPDATE magie SET explication = replace(explication, 'Mono magie uniquement', 'Mono-magie uniquement') WHERE id = 'magies/potentiel-illimite' AND instr(explication, 'Mono magie uniquement') > 0;
-- magie magies/potentiel-illimite explication [grammaire] : « dégâts physique, » -> « dégâts physiques, » (Accord de « physique » avec « dégâts » (masculin pluriel).)
UPDATE magie SET explication = replace(explication, 'dégâts physique,', 'dégâts physiques,') WHERE id = 'magies/potentiel-illimite' AND instr(explication, 'dégâts physique,') > 0;
-- magie magies/potentiel-illimite explication [grammaire] : « ne peux mettre » -> « ne peut mettre » (Le sujet implicite est le porteur de la magie (3e personne du singulier), pas « je/tu ».)
UPDATE magie SET explication = replace(explication, 'ne peux mettre', 'ne peut mettre') WHERE id = 'magies/potentiel-illimite' AND instr(explication, 'ne peux mettre') > 0;
-- magie magies/potentiel-illimite explication [grammaire] : « niveau globale » -> « niveau global » (Accord avec « niveau » (masculin).)
UPDATE magie SET explication = replace(explication, 'niveau globale', 'niveau global') WHERE id = 'magies/potentiel-illimite' AND instr(explication, 'niveau globale') > 0;
-- magie magies/potentiel-illimite explication [grammaire] : « bouclier lourds » -> « boucliers lourds » (Pluriel : « des armures lourdes ou boucliers lourds » (adjectif déjà au pluriel).)
UPDATE magie SET explication = replace(explication, 'bouclier lourds', 'boucliers lourds') WHERE id = 'magies/potentiel-illimite' AND instr(explication, 'bouclier lourds') > 0;
-- magie magies/potentiel-illimite caracteristique_brut [accent] : « ALEATOIRE » -> « ALÉATOIRE » (Accent sur la majuscule (convention commune).)
UPDATE magie SET caracteristique_brut = replace(caracteristique_brut, 'ALEATOIRE', 'ALÉATOIRE') WHERE id = 'magies/potentiel-illimite' AND instr(caracteristique_brut, 'ALEATOIRE') > 0;
-- mode_hyper_effet onglet_magie:magies/potentiel-illimite:forme_complete effet [grammaire] : « dégâts physique » -> « dégâts physiques » (Accord avec « dégâts » (pluriel).)
UPDATE mode_hyper_effet SET effet = replace(effet, 'dégâts physique', 'dégâts physiques') WHERE id = 'onglet_magie:magies/potentiel-illimite:forme_complete' AND instr(effet, 'dégâts physique') > 0;
-- regle_magie magies#regle:regle-speciale-pour-sort-niveau-5 texte [grammaire] : « si puissant qu'il demande » -> « si puissants qu'ils demandent » (Accord avec le sujet « Les sorts » (pluriel).)
UPDATE regle_magie SET texte = replace(texte, 'si puissant qu''il demande', 'si puissants qu''ils demandent') WHERE id = 'magies#regle:regle-speciale-pour-sort-niveau-5' AND instr(texte, 'si puissant qu''il demande') > 0;
-- regle_magie magies#regle:regle-speciale-pour-sort-niveau-5 texte [grammaire] : « pour être lancé. » -> « pour être lancés. » (Participe accordé avec « Les sorts » (masculin pluriel).)
UPDATE regle_magie SET texte = replace(texte, 'pour être lancé.', 'pour être lancés.') WHERE id = 'magies#regle:regle-speciale-pour-sort-niveau-5' AND instr(texte, 'pour être lancé.') > 0;
-- regle_magie magies#regle:regle-speciale-pour-sort-niveau-5 texte [orthographe] : « si il a » -> « s'il a » (Élision obligatoire de « si » devant « il ».)
UPDATE regle_magie SET texte = replace(texte, 'si il a', 's''il a') WHERE id = 'magies#regle:regle-speciale-pour-sort-niveau-5' AND instr(texte, 'si il a') > 0;
-- invocation bestiaire/animation-des-morts texte_general [frappe] : « Seule excepetion » -> « Seule exception » (Lettres en trop : « exception ».)
UPDATE invocation SET texte_general = replace(texte_general, 'Seule excepetion', 'Seule exception') WHERE id = 'bestiaire/animation-des-morts' AND instr(texte_general, 'Seule excepetion') > 0;
-- invocation bestiaire/animation-des-morts texte_general [grammaire] : « aide extérieur et » -> « aide extérieure et » (Accord avec « aide » (féminin).)
UPDATE invocation SET texte_general = replace(texte_general, 'aide extérieur et', 'aide extérieure et') WHERE id = 'bestiaire/animation-des-morts' AND instr(texte_general, 'aide extérieur et') > 0;
-- invocation bestiaire/animation-des-morts texte_general [grammaire] : « qui varie selon » -> « qui varient selon » (Le sujet « des statistiques et des données » est au pluriel.)
UPDATE invocation SET texte_general = replace(texte_general, 'qui varie selon', 'qui varient selon') WHERE id = 'bestiaire/animation-des-morts' AND instr(texte_general, 'qui varie selon') > 0;
-- invocation bestiaire/animation-des-morts texte_general [grammaire] : « plus chère en coût » -> « plus chères en coût » (Accord avec « invocations » (féminin pluriel).)
UPDATE invocation SET texte_general = replace(texte_general, 'plus chère en coût', 'plus chères en coût') WHERE id = 'bestiaire/animation-des-morts' AND instr(texte_general, 'plus chère en coût') > 0;
-- invocation bestiaire/animation-des-morts texte_general [grammaire] : « d'une seul magie » -> « d'une seule magie » (Accord avec « magie » (féminin).)
UPDATE invocation SET texte_general = replace(texte_general, 'd''une seul magie', 'd''une seule magie') WHERE id = 'bestiaire/animation-des-morts' AND instr(texte_general, 'd''une seul magie') > 0;
-- invocation bestiaire/animation-des-morts texte_general [orthographe] : « est résistance au Feu » -> « est résistant au Feu » (Adjectif attendu, parallèle à « est vulnérable » ; sujet « Celui » (masculin).)
UPDATE invocation SET texte_general = replace(texte_general, 'est résistance au Feu', 'est résistant au Feu') WHERE id = 'bestiaire/animation-des-morts' AND instr(texte_general, 'est résistance au Feu') > 0;
-- invocation bestiaire/appel-aux-golems texte_general [frappe] : « Seule excepetion » -> « Seule exception » (Lettres en trop : « exception ».)
UPDATE invocation SET texte_general = replace(texte_general, 'Seule excepetion', 'Seule exception') WHERE id = 'bestiaire/appel-aux-golems' AND instr(texte_general, 'Seule excepetion') > 0;
-- invocation bestiaire/appel-aux-golems texte_general [grammaire] : « aide extérieur et » -> « aide extérieure et » (Accord avec « aide » (féminin).)
UPDATE invocation SET texte_general = replace(texte_general, 'aide extérieur et', 'aide extérieure et') WHERE id = 'bestiaire/appel-aux-golems' AND instr(texte_general, 'aide extérieur et') > 0;
-- invocation bestiaire/appel-aux-golems texte_general [grammaire] : « qui varie selon » -> « qui varient selon » (Le sujet « des statistiques et des données » est au pluriel.)
UPDATE invocation SET texte_general = replace(texte_general, 'qui varie selon', 'qui varient selon') WHERE id = 'bestiaire/appel-aux-golems' AND instr(texte_general, 'qui varie selon') > 0;
-- invocation bestiaire/appel-aux-golems texte_general [grammaire] : « plus chère en coût » -> « plus chères en coût » (Accord avec « invocations » (féminin pluriel).)
UPDATE invocation SET texte_general = replace(texte_general, 'plus chère en coût', 'plus chères en coût') WHERE id = 'bestiaire/appel-aux-golems' AND instr(texte_general, 'plus chère en coût') > 0;
-- invocation bestiaire/appel-aux-golems texte_general [grammaire] : « d'une seul magie » -> « d'une seule magie » (Accord avec « magie » (féminin).)
UPDATE invocation SET texte_general = replace(texte_general, 'd''une seul magie', 'd''une seule magie') WHERE id = 'bestiaire/appel-aux-golems' AND instr(texte_general, 'd''une seul magie') > 0;
-- invocation bestiaire/appel-aux-golems texte_general [grammaire] : « golems invocable, » -> « golems invocables, » (Accord avec « golems » (pluriel).)
UPDATE invocation SET texte_general = replace(texte_general, 'golems invocable,', 'golems invocables,') WHERE id = 'bestiaire/appel-aux-golems' AND instr(texte_general, 'golems invocable,') > 0;
-- invocation bestiaire/appel-aux-golems texte_general [ponctuation] : « "Appel aux golems"⏎ » -> « "Appel aux golems".⏎ » (Point final manquant à la fin de la phrase.)
UPDATE invocation SET texte_general = replace(texte_general, '"Appel aux golems"
', '"Appel aux golems".
') WHERE id = 'bestiaire/appel-aux-golems' AND instr(texte_general, '"Appel aux golems"
') > 0;
-- invocation bestiaire/appel-aux-golems texte_general [grammaire] : « est résistante au Feu » -> « est résistant au Feu » (Accord avec « Celui » (masculin), parallèle à « est vulnérable ».)
UPDATE invocation SET texte_general = replace(texte_general, 'est résistante au Feu', 'est résistant au Feu') WHERE id = 'bestiaire/appel-aux-golems' AND instr(texte_general, 'est résistante au Feu') > 0;
-- invocation bestiaire/marionette-de-lombre texte_general [grammaire] : « qui varie selon » -> « qui varient selon » (Le sujet « des statistiques et des données » est au pluriel.)
UPDATE invocation SET texte_general = replace(texte_general, 'qui varie selon', 'qui varient selon') WHERE id = 'bestiaire/marionette-de-lombre' AND instr(texte_general, 'qui varie selon') > 0;
-- invocation bestiaire/marionette-de-lombre texte_general [grammaire] : « plus chère en coût » -> « plus chères en coût » (Accord avec « invocations » (féminin pluriel).)
UPDATE invocation SET texte_general = replace(texte_general, 'plus chère en coût', 'plus chères en coût') WHERE id = 'bestiaire/marionette-de-lombre' AND instr(texte_general, 'plus chère en coût') > 0;
-- invocation bestiaire/marionette-de-lombre texte_general [grammaire] : « d'une seul magie » -> « d'une seule magie » (Accord avec « magie » (féminin).)
UPDATE invocation SET texte_general = replace(texte_general, 'd''une seul magie', 'd''une seule magie') WHERE id = 'bestiaire/marionette-de-lombre' AND instr(texte_general, 'd''une seul magie') > 0;
-- creature_effet bestiaire/executeur-lunaire#1 texte [grammaire] : « sorts de l'ombre vole 2d6 » -> « sorts de l'ombre volent 2d6 » (Sujet « Tous les sorts » (pluriel).)
UPDATE creature_effet SET texte = replace(texte, 'sorts de l''ombre vole 2d6', 'sorts de l''ombre volent 2d6') WHERE creature_id = 'bestiaire/executeur-lunaire' AND rang = 1 AND instr(texte, 'sorts de l''ombre vole 2d6') > 0;
-- magie magies/magie-du-sang description_physique [grammaire] : « musculature qui est plus élevé que » -> « musculature qui est plus élevée que » (Accord avec « la musculature » (féminin).)
UPDATE magie SET description_physique = replace(description_physique, 'musculature qui est plus élevé que', 'musculature qui est plus élevée que') WHERE id = 'magies/magie-du-sang' AND instr(description_physique, 'musculature qui est plus élevé que') > 0;
-- magie magies/magie-du-sang description_physique [grammaire] : « et augmente au fur » -> « et augmentent au fur » (Sujet « les veines » (pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'et augmente au fur', 'et augmentent au fur') WHERE id = 'magies/magie-du-sang' AND instr(description_physique, 'et augmente au fur') > 0;
-- magie magies/magie-du-sang description_physique [grammaire] : « cheveux est couleurs bordeaux » -> « cheveux sont couleur bordeaux » (Sujet « les mèches » (pluriel) ; « couleur » est invariable devant le nom de couleur.)
UPDATE magie SET description_physique = replace(description_physique, 'cheveux est couleurs bordeaux', 'cheveux sont couleur bordeaux') WHERE id = 'magies/magie-du-sang' AND instr(description_physique, 'cheveux est couleurs bordeaux') > 0;
-- magie_role magies/magie-du-sang#role:1 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (Accent circonflexe : « dégâts » (convention commune).)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-du-sang' AND rang = 1 AND instr(role_brut, 'DÉGATS') > 0;
-- sort magies/magie-du-sang#sort:marquage dsb_brut [grammaire] : « dégâts reçu ( » -> « dégâts reçus ( » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET dsb_brut = replace(dsb_brut, 'dégâts reçu (', 'dégâts reçus (') WHERE id = 'magies/magie-du-sang#sort:marquage' AND instr(dsb_brut, 'dégâts reçu (') > 0;
-- sort magies/magie-du-sang#sort:attirance effets [orthographe] : « ne fonctionne que en ligne » -> « ne fonctionne qu'en ligne » (Élision obligatoire de « que » devant « en ».)
UPDATE sort SET effets = replace(effets, 'ne fonctionne que en ligne', 'ne fonctionne qu''en ligne') WHERE id = 'magies/magie-du-sang#sort:attirance' AND instr(effets, 'ne fonctionne que en ligne') > 0;
-- sort magies/magie-du-sang#sort:sang-durci effets [espace] : « +6AP.  Dure » -> « +6AP. Dure » (Double espace après le point.)
UPDATE sort SET effets = replace(effets, '+6AP.  Dure', '+6AP. Dure') WHERE id = 'magies/magie-du-sang#sort:sang-durci' AND instr(effets, '+6AP.  Dure') > 0;
-- sort magies/magie-du-sang#sort:sang-durci portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-sang#sort:sang-durci' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-sang#sort:sang-garde portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-sang#sort:sang-garde' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-sang#sort:sang-magie portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-sang#sort:sang-magie' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-sang#sort:sang-gain portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-sang#sort:sang-gain' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-sang#sort:deflagration-sanguine portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-sang#sort:deflagration-sanguine' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-sang#sort:sang-perfection portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-sang#sort:sang-perfection' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-sang#sort:sacrifice portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-sang#sort:sacrifice' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-sang#sort:saignee-forcee remarque [grammaire] : « si répéter. » -> « si répété. » (Participe passé attendu (« si [il est] répété »), pas l'infinitif.)
UPDATE sort SET remarque = replace(remarque, 'si répéter.', 'si répété.') WHERE id = 'magies/magie-du-sang#sort:saignee-forcee' AND instr(remarque, 'si répéter.') > 0;
-- sort magies/magie-du-sang#sort:morsure-aspirante effets [grammaire] : « les convertis en PV » -> « les convertit en PV » (Verbe conjugué à la 3e personne (sujet « Aspire … et les convertit »).)
UPDATE sort SET effets = replace(effets, 'les convertis en PV', 'les convertit en PV') WHERE id = 'magies/magie-du-sang#sort:morsure-aspirante' AND instr(effets, 'les convertis en PV') > 0;
-- sort magies/magie-du-sang#sort:morsure-aspirante effets [grammaire] : « les créature vivante » -> « les créatures vivantes » (Pluriel après « les » ; accord de « vivantes ».)
UPDATE sort SET effets = replace(effets, 'les créature vivante', 'les créatures vivantes') WHERE id = 'magies/magie-du-sang#sort:morsure-aspirante' AND instr(effets, 'les créature vivante') > 0;
-- sort magies/magie-du-sang#sort:coagulation remarque [grammaire] : « Le mur est fixée » -> « Le mur est fixé » (Accord avec « mur » (masculin).)
UPDATE sort SET remarque = replace(remarque, 'Le mur est fixée', 'Le mur est fixé') WHERE id = 'magies/magie-du-sang#sort:coagulation' AND instr(remarque, 'Le mur est fixée') > 0;
-- sort magies/magie-du-sang#sort:renfermement effets [frappe] : « régénaration » -> « régénération » (Lettre erronée : « régénération ».)
UPDATE sort SET effets = replace(effets, 'régénaration', 'régénération') WHERE id = 'magies/magie-du-sang#sort:renfermement' AND instr(effets, 'régénaration') > 0;
-- sort magies/magie-du-sang#sort:renfermement remarque [grammaire] : « santé récupéré par » -> « santé récupérée par » (Accord avec « santé » (féminin).)
UPDATE sort SET remarque = replace(remarque, 'santé récupéré par', 'santé récupérée par') WHERE id = 'magies/magie-du-sang#sort:renfermement' AND instr(remarque, 'santé récupéré par') > 0;
-- sort magies/magie-du-sang#sort:damocles effets [accent] : « réfléxe » -> « réflexe » (Pas d'accent sur le « x » : « réflexe ».)
UPDATE sort SET effets = replace(effets, 'réfléxe', 'réflexe') WHERE id = 'magies/magie-du-sang#sort:damocles' AND instr(effets, 'réfléxe') > 0;
-- sort magies/magie-du-sang#sort:damocles effets [frappe] : « La cilbe » -> « La cible » (Lettres permutées : « cible ».)
UPDATE sort SET effets = replace(effets, 'La cilbe', 'La cible') WHERE id = 'magies/magie-du-sang#sort:damocles' AND instr(effets, 'La cilbe') > 0;
-- sort magies/magie-du-sang#sort:damocles effets [orthographe] : « 4d6 de contre coup » -> « 4d6 de contrecoup » (« contrecoup » s'écrit en un seul mot.)
UPDATE sort SET effets = replace(effets, '4d6 de contre coup', '4d6 de contrecoup') WHERE id = 'magies/magie-du-sang#sort:damocles' AND instr(effets, '4d6 de contre coup') > 0;
-- sort magies/magie-du-sang#sort:damocles effets [orthographe] : « pas de contre coup » -> « pas de contrecoup » (« contrecoup » s'écrit en un seul mot.)
UPDATE sort SET effets = replace(effets, 'pas de contre coup', 'pas de contrecoup') WHERE id = 'magies/magie-du-sang#sort:damocles' AND instr(effets, 'pas de contre coup') > 0;
-- sort magies/magie-du-sang#sort:proportion-demesuree effets [grammaire] : « dégâts physique, » -> « dégâts physiques, » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET effets = replace(effets, 'dégâts physique,', 'dégâts physiques,') WHERE id = 'magies/magie-du-sang#sort:proportion-demesuree' AND instr(effets, 'dégâts physique,') > 0;
-- sort magies/magie-du-sang#sort:proportion-demesuree texte_niveau5 [espace] : « l'excès ... » -> « l'excès... » (Pas d'espace avant les points de suspension (cf. « douleur... » dans Sang Perfection).)
UPDATE sort SET texte_niveau5 = replace(texte_niveau5, 'l''excès ...', 'l''excès...') WHERE id = 'magies/magie-du-sang#sort:proportion-demesuree' AND instr(texte_niveau5, 'l''excès ...') > 0;
-- sort magies/magie-du-sang#sort:sacrifice effets [casse] : « 4 Cibles alliées » -> « 4 cibles alliées » (Pas de majuscule à un nom commun en milieu de phrase (« cible » est en minuscule ailleurs).)
UPDATE sort SET effets = replace(effets, '4 Cibles alliées', '4 cibles alliées') WHERE id = 'magies/magie-du-sang#sort:sacrifice' AND instr(effets, '4 Cibles alliées') > 0;
-- sort magies/magie-du-sang#sort:damocles zone_brut [casse] : « ligne de 3 » -> « Ligne de 3 » (Même casse que « Cercle de … » et que la forme majoritaire « Ligne de … » dans la colonne zone.)
UPDATE sort SET zone_brut = replace(zone_brut, 'ligne de 3', 'Ligne de 3') WHERE id = 'magies/magie-du-sang#sort:damocles' AND instr(zone_brut, 'ligne de 3') > 0;
-- magie magies/magie-de-larcane description_physique [grammaire] : « aux niveau des cheveux » -> « au niveau des cheveux » (« niveau » est singulier : « au niveau de »)
UPDATE magie SET description_physique = replace(description_physique, 'aux niveau des cheveux', 'au niveau des cheveux') WHERE id = 'magies/magie-de-larcane' AND instr(description_physique, 'aux niveau des cheveux') > 0;
-- magie magies/magie-de-larcane explication [grammaire] : « et vont consommer » -> « et va consommer » (Le sujet est « Chaque sort » (singulier), comme « possède » juste avant.)
UPDATE magie SET explication = replace(explication, 'et vont consommer', 'et va consommer') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 'et vont consommer') > 0;
-- magie magies/magie-de-larcane explication [grammaire] : « tant qu'ils sont actif » -> « tant qu'il est actif » (Le sujet est « Chaque sort » (singulier) : « il est actif » comme « va consommer ».)
UPDATE magie SET explication = replace(explication, 'tant qu''ils sont actif', 'tant qu''il est actif') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 'tant qu''ils sont actif') > 0;
-- magie magies/magie-de-larcane explication [ponctuation] : « (normal jusque là) » -> « (normal jusque-là) » (« jusque-là » prend un trait d’union)
UPDATE magie SET explication = replace(explication, '(normal jusque là)', '(normal jusque-là)') WHERE id = 'magies/magie-de-larcane' AND instr(explication, '(normal jusque là)') > 0;
-- magie magies/magie-de-larcane explication [grammaire] : « la concentration est perdu » -> « la concentration est perdue » (participe accordé avec « concentration » (féminin))
UPDATE magie SET explication = replace(explication, 'la concentration est perdu', 'la concentration est perdue') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 'la concentration est perdu') > 0;
-- magie magies/magie-de-larcane explication [grammaire] : « tout les sorts » -> « tous les sorts » (« tous » devant un pluriel masculin)
UPDATE magie SET explication = replace(explication, 'tout les sorts', 'tous les sorts') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 'tout les sorts') > 0;
-- magie magies/magie-de-larcane explication [grammaire] : « qui était actif » -> « qui étaient actifs » (accord avec « les sorts » (pluriel))
UPDATE magie SET explication = replace(explication, 'qui était actif', 'qui étaient actifs') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 'qui était actif') > 0;
-- magie magies/magie-de-larcane explication [grammaire] : « s'arrête immédiatement » -> « s'arrêtent immédiatement » (le sujet est « tous les sorts » (pluriel))
UPDATE magie SET explication = replace(explication, 's''arrête immédiatement', 's''arrêtent immédiatement') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 's''arrête immédiatement') > 0;
-- magie magies/magie-de-larcane explication [orthographe] : « va couté un » -> « va coûter un » (infinitif après « va » et accent circonflexe)
UPDATE magie SET explication = replace(explication, 'va couté un', 'va coûter un') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 'va couté un') > 0;
-- magie magies/magie-de-larcane explication [grammaire] : « nombre d'application qu'il » -> « nombre d'applications qu'il » (« nombre de » + pluriel)
UPDATE magie SET explication = replace(explication, 'nombre d''application qu''il', 'nombre d''applications qu''il') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 'nombre d''application qu''il') > 0;
-- magie magies/magie-de-larcane explication [accent] : « un sort qui coute 3 » -> « un sort qui coûte 3 » (accent circonflexe, comme « coût » dans le même texte)
UPDATE magie SET explication = replace(explication, 'un sort qui coute 3', 'un sort qui coûte 3') WHERE id = 'magies/magie-de-larcane' AND instr(explication, 'un sort qui coute 3') > 0;
-- magie_role magies/magie-de-larcane#role:2 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-de-larcane' AND rang = 2 AND instr(role_brut, 'DÉGATS') > 0;
-- sort magies/magie-de-larcane#sort:charge-denergie portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-larcane#sort:charge-denergie' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-larcane#sort:charge-denergie dsb_brut [grammaire] : « +X dégâts magique » -> « +X dégâts magiques » (accord avec « dégâts » (pluriel))
UPDATE sort SET dsb_brut = replace(dsb_brut, '+X dégâts magique', '+X dégâts magiques') WHERE id = 'magies/magie-de-larcane#sort:charge-denergie' AND instr(dsb_brut, '+X dégâts magique') > 0;
-- sort magies/magie-de-larcane#sort:claquement effets [casse] : « jet de Fermeté raté » -> « jet de fermeté raté » (forme majoritaire dans la colonne (« jet de fermeté »))
UPDATE sort SET effets = replace(effets, 'jet de Fermeté raté', 'jet de fermeté raté') WHERE id = 'magies/magie-de-larcane#sort:claquement' AND instr(effets, 'jet de Fermeté raté') > 0;
-- sort magies/magie-de-larcane#sort:forge-magie portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-larcane#sort:forge-magie' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-larcane#sort:inhalation-magique portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-larcane#sort:inhalation-magique' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-larcane#sort:souffle-magique effets [orthographe] : « Si il y a » -> « S'il y a » (élision obligatoire « si il » -> « s'il »)
UPDATE sort SET effets = replace(effets, 'Si il y a', 'S''il y a') WHERE id = 'magies/magie-de-larcane#sort:souffle-magique' AND instr(effets, 'Si il y a') > 0;
-- sort magies/magie-de-larcane#sort:vision-magique portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-larcane#sort:vision-magique' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-larcane#sort:mur-de-chakra effets [orthographe] : « si il prend » -> « s'il prend » (élision obligatoire « si il » -> « s'il »)
UPDATE sort SET effets = replace(effets, 'si il prend', 's''il prend') WHERE id = 'magies/magie-de-larcane#sort:mur-de-chakra' AND instr(effets, 'si il prend') > 0;
-- sort magies/magie-de-larcane#sort:pillage-defensif remarque [grammaire] : « barrière ennemi qui » -> « barrière ennemie qui » (adjectif accordé avec « barrière » (féminin))
UPDATE sort SET remarque = replace(remarque, 'barrière ennemi qui', 'barrière ennemie qui') WHERE id = 'magies/magie-de-larcane#sort:pillage-defensif' AND instr(remarque, 'barrière ennemi qui') > 0;
-- sort magies/magie-de-larcane#sort:champ-gardien portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-larcane#sort:champ-gardien' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-larcane#sort:champ-gardien effets [grammaire] : « les dégâts ignore les AM » -> « les dégâts ignorent les AM » (le sujet « les dégâts » est pluriel)
UPDATE sort SET effets = replace(effets, 'les dégâts ignore les AM', 'les dégâts ignorent les AM') WHERE id = 'magies/magie-de-larcane#sort:champ-gardien' AND instr(effets, 'les dégâts ignore les AM') > 0;
-- sort magies/magie-de-larcane#sort:peau-de-chakra dsb_brut [grammaire] : « -20% dégâts magique » -> « -20% dégâts magiques » (accord avec « dégâts » (pluriel))
UPDATE sort SET dsb_brut = replace(dsb_brut, '-20% dégâts magique', '-20% dégâts magiques') WHERE id = 'magies/magie-de-larcane#sort:peau-de-chakra' AND instr(dsb_brut, '-20% dégâts magique') > 0;
-- sort magies/magie-de-larcane#sort:pluie-de-chakra effets [orthographe] : « aux dessus des alliés » -> « au-dessus des alliés » (locution « au-dessus de »)
UPDATE sort SET effets = replace(effets, 'aux dessus des alliés', 'au-dessus des alliés') WHERE id = 'magies/magie-de-larcane#sort:pluie-de-chakra' AND instr(effets, 'aux dessus des alliés') > 0;
-- sort magies/magie-de-larcane#sort:miroir-magique portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-larcane#sort:miroir-magique' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-larcane#sort:foudre-argente effets [grammaire] : « de lourd dégâts » -> « de lourds dégâts » (adjectif accordé avec « dégâts » (pluriel))
UPDATE sort SET effets = replace(effets, 'de lourd dégâts', 'de lourds dégâts') WHERE id = 'magies/magie-de-larcane#sort:foudre-argente' AND instr(effets, 'de lourd dégâts') > 0;
-- sort magies/magie-de-larcane#sort:voile-chakratique portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-larcane#sort:voile-chakratique' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-larcane#sort:planete-chakratique portee_brut [casse] : « illimité » -> « Illimité » (convention : « Illimité » avec majuscule dans la colonne portée)
UPDATE sort SET portee_brut = replace(portee_brut, 'illimité', 'Illimité') WHERE id = 'magies/magie-de-larcane#sort:planete-chakratique' AND instr(portee_brut, 'illimité') > 0;
-- magie magies/magie-de-la-corruption description_physique [grammaire] : « aux niveau des cheveux » -> « au niveau des cheveux » (« niveau » est singulier : « au niveau de »)
UPDATE magie SET description_physique = replace(description_physique, 'aux niveau des cheveux', 'au niveau des cheveux') WHERE id = 'magies/magie-de-la-corruption' AND instr(description_physique, 'aux niveau des cheveux') > 0;
-- magie magies/magie-de-la-corruption description_physique [grammaire] : « couleur noires » -> « couleur noire » (l'adjectif s'accorde avec « couleur » (féminin singulier), comme « couleur argentée » pour l'Arcane)
UPDATE magie SET description_physique = replace(description_physique, 'couleur noires', 'couleur noire') WHERE id = 'magies/magie-de-la-corruption' AND instr(description_physique, 'couleur noires') > 0;
-- magie magies/magie-de-la-corruption description_physique [orthographe] : « couleur antrasite » -> « couleur anthracite » (« anthracite » s'écrit avec « th »)
UPDATE magie SET description_physique = replace(description_physique, 'couleur antrasite', 'couleur anthracite') WHERE id = 'magies/magie-de-la-corruption' AND instr(description_physique, 'couleur antrasite') > 0;
-- magie magies/magie-de-la-corruption description_physique [grammaire] : « deviennent noir aussi » -> « deviennent noirs aussi » (attribut accordé avec « tatouages » (pluriel))
UPDATE magie SET description_physique = replace(description_physique, 'deviennent noir aussi', 'deviennent noirs aussi') WHERE id = 'magies/magie-de-la-corruption' AND instr(description_physique, 'deviennent noir aussi') > 0;
-- magie magies/magie-de-la-corruption explication [orthographe] : « vases communiquant. » -> « vases communicants. » (adjectif « communicants » accordé avec « vases »)
UPDATE magie SET explication = replace(explication, 'vases communiquant.', 'vases communicants.') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'vases communiquant.') > 0;
-- magie magies/magie-de-la-corruption explication [grammaire] : « Chaque sorts demande » -> « Chaque sort demande » (« chaque » est suivi d’un singulier)
UPDATE magie SET explication = replace(explication, 'Chaque sorts demande', 'Chaque sort demande') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'Chaque sorts demande') > 0;
-- magie magies/magie-de-la-corruption explication [orthographe] : « se transfert dans » -> « se transfère dans » (verbe « transférer » : il se transfère)
UPDATE magie SET explication = replace(explication, 'se transfert dans', 'se transfère dans') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'se transfert dans') > 0;
-- magie magies/magie-de-la-corruption explication [accent] : « double du cout en » -> « double du coût en » (accent circonflexe, comme « coût » dans le même texte)
UPDATE magie SET explication = replace(explication, 'double du cout en', 'double du coût en') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'double du cout en') > 0;
-- magie magies/magie-de-la-corruption explication [accent] : « si le sort coute 4 » -> « si le sort coûte 4 » (accent circonflexe, comme « coûte » dans le même texte)
UPDATE magie SET explication = replace(explication, 'si le sort coute 4', 'si le sort coûte 4') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'si le sort coute 4') > 0;
-- magie magies/magie-de-la-corruption explication [grammaire] : « totalement immunisé à » -> « totalement immunisés à » (accord avec « ceux » (pluriel))
UPDATE magie SET explication = replace(explication, 'totalement immunisé à', 'totalement immunisés à') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'totalement immunisé à') > 0;
-- magie magies/magie-de-la-corruption explication [ponctuation] : « du trop plein de » -> « du trop-plein de » (« trop-plein » prend un trait d’union)
UPDATE magie SET explication = replace(explication, 'du trop plein de', 'du trop-plein de') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'du trop plein de') > 0;
-- magie magies/magie-de-la-corruption explication [grammaire] : « magie mal vu. » -> « magie mal vue. » (participe accordé avec « magie » (féminin))
UPDATE magie SET explication = replace(explication, 'magie mal vu.', 'magie mal vue.') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'magie mal vu.') > 0;
-- magie magies/magie-de-la-corruption explication [orthographe] : « n'enpiète » -> « n'empiète » (« m » devant « p »)
UPDATE magie SET explication = replace(explication, 'n''enpiète', 'n''empiète') WHERE id = 'magies/magie-de-la-corruption' AND instr(explication, 'n''enpiète') > 0;
-- magie magies/magie-de-la-corruption incompatibilite_note [ponctuation] : « c'est mono magie uniquement » -> « c'est mono-magie uniquement » (trait d’union, comme « Mono-Magie » ailleurs)
UPDATE magie SET incompatibilite_note = replace(incompatibilite_note, 'c''est mono magie uniquement', 'c''est mono-magie uniquement') WHERE id = 'magies/magie-de-la-corruption' AND instr(incompatibilite_note, 'c''est mono magie uniquement') > 0;
-- magie magies/magie-de-la-corruption incompatibilite_note [grammaire] : « les Felfe noirs » -> « les Felfes noirs » (pluriel après « les » (cf. « Felfes Noirs » dans la description))
UPDATE magie SET incompatibilite_note = replace(incompatibilite_note, 'les Felfe noirs', 'les Felfes noirs') WHERE id = 'magies/magie-de-la-corruption' AND instr(incompatibilite_note, 'les Felfe noirs') > 0;
-- magie magies/magie-de-la-corruption incompatibilite_note [frappe] : « avec uen autre » -> « avec une autre » (lettres permutées)
UPDATE magie SET incompatibilite_note = replace(incompatibilite_note, 'avec uen autre', 'avec une autre') WHERE id = 'magies/magie-de-la-corruption' AND instr(incompatibilite_note, 'avec uen autre') > 0;
-- magie magies/magie-de-la-corruption incompatibilite_note [grammaire] : « s'applique pour » -> « s'appliquent pour » (le sujet « les limitations » est pluriel)
UPDATE magie SET incompatibilite_note = replace(incompatibilite_note, 's''applique pour', 's''appliquent pour') WHERE id = 'magies/magie-de-la-corruption' AND instr(incompatibilite_note, 's''applique pour') > 0;
-- magie magies/magie-de-la-corruption incompatibilite_note [orthographe] : « primordialles » -> « primordiales » (un seul « l » après « -ia- »)
UPDATE magie SET incompatibilite_note = replace(incompatibilite_note, 'primordialles', 'primordiales') WHERE id = 'magies/magie-de-la-corruption' AND instr(incompatibilite_note, 'primordialles') > 0;
-- magie_role magies/magie-de-la-corruption#role:2 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-de-la-corruption' AND rang = 2 AND instr(role_brut, 'DÉGATS') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-la-corruption:bi effet [accent] : « le cout en corruption » -> « le coût en corruption » (« coût » prend un accent circonflexe)
UPDATE mode_hyper_effet SET effet = replace(effet, 'le cout en corruption', 'le coût en corruption') WHERE id = 'onglet_magie:magies/magie-de-la-corruption:bi' AND instr(effet, 'le cout en corruption') > 0;
-- sort magies/magie-de-la-corruption#sort:verrouillage-simple remarque [ponctuation] : « moment là » -> « moment-là » (« moment-là » prend un trait d’union)
UPDATE sort SET remarque = replace(remarque, 'moment là', 'moment-là') WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-simple' AND instr(remarque, 'moment là') > 0;
-- sort magies/magie-de-la-corruption#sort:verrouillage-simple remarque [grammaire] : « ne se cumule pas » -> « ne se cumulent pas » (le sujet « les verrouillages » est pluriel)
UPDATE sort SET remarque = replace(remarque, 'ne se cumule pas', 'ne se cumulent pas') WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-simple' AND instr(remarque, 'ne se cumule pas') > 0;
-- sort magies/magie-de-la-corruption#sort:verrouille-visible remarque [ponctuation] : « moment là » -> « moment-là » (« moment-là » prend un trait d’union)
UPDATE sort SET remarque = replace(remarque, 'moment là', 'moment-là') WHERE id = 'magies/magie-de-la-corruption#sort:verrouille-visible' AND instr(remarque, 'moment là') > 0;
-- sort magies/magie-de-la-corruption#sort:verrouille-visible remarque [grammaire] : « ne se cumule pas » -> « ne se cumulent pas » (le sujet « les verrouillages » est pluriel)
UPDATE sort SET remarque = replace(remarque, 'ne se cumule pas', 'ne se cumulent pas') WHERE id = 'magies/magie-de-la-corruption#sort:verrouille-visible' AND instr(remarque, 'ne se cumule pas') > 0;
-- sort magies/magie-de-la-corruption#sort:verrouillage-magique remarque [ponctuation] : « moment là » -> « moment-là » (« moment-là » prend un trait d’union)
UPDATE sort SET remarque = replace(remarque, 'moment là', 'moment-là') WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-magique' AND instr(remarque, 'moment là') > 0;
-- sort magies/magie-de-la-corruption#sort:verrouillage-magique remarque [grammaire] : « ne se cumule pas » -> « ne se cumulent pas » (le sujet « les verrouillages » est pluriel)
UPDATE sort SET remarque = replace(remarque, 'ne se cumule pas', 'ne se cumulent pas') WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-magique' AND instr(remarque, 'ne se cumule pas') > 0;
-- sort magies/magie-de-la-corruption#sort:verrouillage-physique remarque [ponctuation] : « moment là » -> « moment-là » (« moment-là » prend un trait d’union)
UPDATE sort SET remarque = replace(remarque, 'moment là', 'moment-là') WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-physique' AND instr(remarque, 'moment là') > 0;
-- sort magies/magie-de-la-corruption#sort:verrouillage-physique remarque [grammaire] : « ne se cumule pas » -> « ne se cumulent pas » (le sujet « les verrouillages » est pluriel)
UPDATE sort SET remarque = replace(remarque, 'ne se cumule pas', 'ne se cumulent pas') WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-physique' AND instr(remarque, 'ne se cumule pas') > 0;
-- sort magies/magie-de-la-corruption#sort:fer-corrompu effets [accent] : « Imprégne l'arme » -> « Imprègne l'arme » (verbe « imprégner » : « il imprègne ».)
UPDATE sort SET effets = replace(effets, 'Imprégne l''arme', 'Imprègne l''arme') WHERE id = 'magies/magie-de-la-corruption#sort:fer-corrompu' AND instr(effets, 'Imprégne l''arme') > 0;
-- sort magies/magie-de-la-corruption#sort:fer-corrompu effets [casse] : « mauvaise. inflige » -> « mauvaise. Inflige » (majuscule après un point)
UPDATE sort SET effets = replace(effets, 'mauvaise. inflige', 'mauvaise. Inflige') WHERE id = 'magies/magie-de-la-corruption#sort:fer-corrompu' AND instr(effets, 'mauvaise. inflige') > 0;
-- sort magies/magie-de-la-corruption#sort:fer-corrompu effets [grammaire] : « 5 point de » -> « 5 points de » (pluriel après un nombre > 1)
UPDATE sort SET effets = replace(effets, '5 point de', '5 points de') WHERE id = 'magies/magie-de-la-corruption#sort:fer-corrompu' AND instr(effets, '5 point de') > 0;
-- sort magies/magie-de-la-corruption#sort:petrole type_brut [orthographe] : « Entave » -> « Entrave » (convention : « Entrave »)
UPDATE sort SET type_brut = replace(type_brut, 'Entave', 'Entrave') WHERE id = 'magies/magie-de-la-corruption#sort:petrole' AND instr(type_brut, 'Entave') > 0;
-- sort magies/magie-de-la-corruption#sort:petrole effets [grammaire] : « qui ralenti ceux » -> « qui ralentit ceux » (verbe « ralentir » à la 3e personne : il ralentit)
UPDATE sort SET effets = replace(effets, 'qui ralenti ceux', 'qui ralentit ceux') WHERE id = 'magies/magie-de-la-corruption#sort:petrole' AND instr(effets, 'qui ralenti ceux') > 0;
-- sort magies/magie-de-la-corruption#sort:petrole remarque [orthographe] : « si il est raté » -> « s'il est raté » (élision obligatoire « si il » -> « s'il »)
UPDATE sort SET remarque = replace(remarque, 'si il est raté', 's''il est raté') WHERE id = 'magies/magie-de-la-corruption#sort:petrole' AND instr(remarque, 'si il est raté') > 0;
-- sort magies/magie-de-la-corruption#sort:petrole remarque [orthographe] : « réssayer » -> « réessayer » (verbe « réessayer »)
UPDATE sort SET remarque = replace(remarque, 'réssayer', 'réessayer') WHERE id = 'magies/magie-de-la-corruption#sort:petrole' AND instr(remarque, 'réssayer') > 0;
-- sort magies/magie-de-la-corruption#sort:mine-noire type_brut [espace] : « Attaque /Construction » -> « Attaque/Construction » (pas d'espace avant la barre oblique (cf. « Attaque/Entrave »))
UPDATE sort SET type_brut = replace(type_brut, 'Attaque /Construction', 'Attaque/Construction') WHERE id = 'magies/magie-de-la-corruption#sort:mine-noire' AND instr(type_brut, 'Attaque /Construction') > 0;
-- sort magies/magie-de-la-corruption#sort:mine-noire effets [espace] : « zone.  Ne se voit » -> « zone. Ne se voit » (espace double)
UPDATE sort SET effets = replace(effets, 'zone.  Ne se voit', 'zone. Ne se voit') WHERE id = 'magies/magie-de-la-corruption#sort:mine-noire' AND instr(effets, 'zone.  Ne se voit') > 0;
-- sort magies/magie-de-la-corruption#sort:mine-noire remarque [accent] : « seulement a portée » -> « seulement à portée » (préposition « à », pas le verbe « a »)
UPDATE sort SET remarque = replace(remarque, 'seulement a portée', 'seulement à portée') WHERE id = 'magies/magie-de-la-corruption#sort:mine-noire' AND instr(remarque, 'seulement a portée') > 0;
-- sort magies/magie-de-la-corruption#sort:fouet-tenebreux nom [accent] : « Fouet ténèbreux » -> « Fouet ténébreux » (« ténébreux » prend « é » (l'identifiant ne change pas))
UPDATE sort SET nom = replace(nom, 'Fouet ténèbreux', 'Fouet ténébreux') WHERE id = 'magies/magie-de-la-corruption#sort:fouet-tenebreux' AND instr(nom, 'Fouet ténèbreux') > 0;
-- sort magies/magie-de-la-corruption#sort:aura-de-frayeur type_brut [orthographe] : « Entave (IC » -> « Entrave (IC » (convention : « Entrave »)
UPDATE sort SET type_brut = replace(type_brut, 'Entave (IC', 'Entrave (IC') WHERE id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur' AND instr(type_brut, 'Entave (IC') > 0;
-- sort magies/magie-de-la-corruption#sort:aura-de-frayeur portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-corruption#sort:aura-de-frayeur effets [grammaire] : « Ceux qui rate » -> « Ceux qui ratent » (le sujet « ceux qui » est pluriel)
UPDATE sort SET effets = replace(effets, 'Ceux qui rate', 'Ceux qui ratent') WHERE id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur' AND instr(effets, 'Ceux qui rate') > 0;
-- sort magies/magie-de-la-corruption#sort:aura-de-frayeur effets [grammaire] : « le jet fuit. » -> « le jet fuient. » (le sujet « ceux » est pluriel)
UPDATE sort SET effets = replace(effets, 'le jet fuit.', 'le jet fuient.') WHERE id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur' AND instr(effets, 'le jet fuit.') > 0;
-- sort magies/magie-de-la-corruption#sort:grenade-collante effets [grammaire] : « d'énorme dégâts » -> « d'énormes dégâts » (adjectif accordé avec « dégâts » (pluriel))
UPDATE sort SET effets = replace(effets, 'd''énorme dégâts', 'd''énormes dégâts') WHERE id = 'magies/magie-de-la-corruption#sort:grenade-collante' AND instr(effets, 'd''énorme dégâts') > 0;
-- sort magies/magie-de-la-corruption#sort:grenade-collante effets [orthographe] : « innesquivable » -> « inesquivable » (un seul « n » (cf. « Inesquivable » dans Mine noire))
UPDATE sort SET effets = replace(effets, 'innesquivable', 'inesquivable') WHERE id = 'magies/magie-de-la-corruption#sort:grenade-collante' AND instr(effets, 'innesquivable') > 0;
-- sort magies/magie-de-la-corruption#sort:pluie-huileuse portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d’union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-corruption#sort:pluie-huileuse' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-larcane#sort:planete-chakratique effets [grammaire] : « = 1 Dégâts » -> « = 1 dégâts » (après « 1 », singulier ; pas de majuscule en milieu de phrase. | vérificateur : « Dégâts » avec majuscule en milieu de phrase alors que la forme majoritaire de la cellule est « dégâts » ; on ne touche pas au nombre du nom (étiquette d'unité, comme n=80).)
UPDATE sort SET effets = replace(effets, '= 1 Dégâts', '= 1 dégâts') WHERE id = 'magies/magie-de-larcane#sort:planete-chakratique' AND instr(effets, '= 1 Dégâts') > 0;
-- magie magies/magie-de-lespace-temps description [grammaire] : « sont capable de manipuler » -> « sont capables de manipuler » (accord en nombre avec « Les plus puissants pratiquants »)
UPDATE magie SET description = replace(description, 'sont capable de manipuler', 'sont capables de manipuler') WHERE id = 'magies/magie-de-lespace-temps' AND instr(description, 'sont capable de manipuler') > 0;
-- magie magies/magie-de-lespace-temps description [grammaire] : « Ne les sous-estimés jamais » -> « Ne les sous-estimez jamais » (impératif à la 2e personne du pluriel, pas un participe passé)
UPDATE magie SET description = replace(description, 'Ne les sous-estimés jamais', 'Ne les sous-estimez jamais') WHERE id = 'magies/magie-de-lespace-temps' AND instr(description, 'Ne les sous-estimés jamais') > 0;
-- magie magies/magie-de-lespace-temps description_physique [grammaire] : « d'étrange bandages » -> « d'étranges bandages » (accord en nombre avec « bandages »)
UPDATE magie SET description_physique = replace(description_physique, 'd''étrange bandages', 'd''étranges bandages') WHERE id = 'magies/magie-de-lespace-temps' AND instr(description_physique, 'd''étrange bandages') > 0;
-- magie magies/magie-de-lespace-temps description_physique [grammaire] : « couleur roses » -> « couleur rose » (« couleur » + adjectif de couleur reste invariable)
UPDATE magie SET description_physique = replace(description_physique, 'couleur roses', 'couleur rose') WHERE id = 'magies/magie-de-lespace-temps' AND instr(description_physique, 'couleur roses') > 0;
-- magie magies/magie-de-lespace-temps description_physique [grammaire] : « pied et jambes » -> « pieds et jambes » (énumération au pluriel (mains, bras, pieds et jambes))
UPDATE magie SET description_physique = replace(description_physique, 'pied et jambes', 'pieds et jambes') WHERE id = 'magies/magie-de-lespace-temps' AND instr(description_physique, 'pied et jambes') > 0;
-- magie magies/magie-de-lespace-temps description_physique [grammaire] : « semble être impossible à enlever » -> « semblent être impossibles à enlever » (le sujet est « bandages » (pluriel))
UPDATE magie SET description_physique = replace(description_physique, 'semble être impossible à enlever', 'semblent être impossibles à enlever') WHERE id = 'magies/magie-de-lespace-temps' AND instr(description_physique, 'semble être impossible à enlever') > 0;
-- sort magies/magie-de-lespace-temps#sort:substitution portee_brut [espace] : « 6 (+1/ NM) » -> « 6 (+1/NM) » (espace insécable parasite, forme des autres portées (« +1/NM ») | vérificateur : Faute réelle : espace insécable parasite après la barre oblique (les autres portées s'écrivent « +1/NM »). L'avant est précisé avec le caractère U+00A0 réellement présent dans le texte. Remplace le doublon n°71.)
UPDATE sort SET portee_brut = replace(portee_brut, '6 (+1/ NM)', '6 (+1/NM)') WHERE id = 'magies/magie-de-lespace-temps#sort:substitution' AND instr(portee_brut, '6 (+1/ NM)') > 0;
-- sort magies/magie-de-lespace-temps#sort:substitution effets [accent] : « taille a peu près égale » -> « taille à peu près égale » (locution « à peu près »)
UPDATE sort SET effets = replace(effets, 'taille a peu près égale', 'taille à peu près égale') WHERE id = 'magies/magie-de-lespace-temps#sort:substitution' AND instr(effets, 'taille a peu près égale') > 0;
-- sort magies/magie-de-lespace-temps#sort:fer-temporel effets [grammaire] : « rose et noir, » -> « rose et noire, » (accord en genre avec « l'arme »)
UPDATE sort SET effets = replace(effets, 'rose et noir,', 'rose et noire,') WHERE id = 'magies/magie-de-lespace-temps#sort:fer-temporel' AND instr(effets, 'rose et noir,') > 0;
-- sort magies/magie-de-lespace-temps#sort:ralentissement effets [espace] : « raté =  -2 » -> « raté = -2 » (espace double)
UPDATE sort SET effets = replace(effets, 'raté =  -2', 'raté = -2') WHERE id = 'magies/magie-de-lespace-temps#sort:ralentissement' AND instr(effets, 'raté =  -2') > 0;
-- sort magies/magie-de-lespace-temps#sort:inversion effets [grammaire] : « avec celui de la cible » -> « avec celle de la cible » (« celle » reprend « place » (féminin))
UPDATE sort SET effets = replace(effets, 'avec celui de la cible', 'avec celle de la cible') WHERE id = 'magies/magie-de-lespace-temps#sort:inversion' AND instr(effets, 'avec celui de la cible') > 0;
-- sort magies/magie-de-lespace-temps#sort:inversion remarque [grammaire] : « Peut être contrer par » -> « Peut être contré par » (participe passé après « être »)
UPDATE sort SET remarque = replace(remarque, 'Peut être contrer par', 'Peut être contré par') WHERE id = 'magies/magie-de-lespace-temps#sort:inversion' AND instr(remarque, 'Peut être contrer par') > 0;
-- sort magies/magie-de-lespace-temps#sort:frappe-temporelle effets [frappe] : « symtriquement » -> « symétriquement » (lettre manquante (symétriquement))
UPDATE sort SET effets = replace(effets, 'symtriquement', 'symétriquement') WHERE id = 'magies/magie-de-lespace-temps#sort:frappe-temporelle' AND instr(effets, 'symtriquement') > 0;
-- sort magies/magie-de-lespace-temps#sort:portail-piege effets [grammaire] : « d'invoqué un » -> « d'invoquer un » (infinitif après « permet de »)
UPDATE sort SET effets = replace(effets, 'd''invoqué un', 'd''invoquer un') WHERE id = 'magies/magie-de-lespace-temps#sort:portail-piege' AND instr(effets, 'd''invoqué un') > 0;
-- sort magies/magie-de-lespace-temps#sort:portail-piege effets [grammaire] : « portail piéger qui » -> « portail piégé qui » (participe passé adjectif de « portail »)
UPDATE sort SET effets = replace(effets, 'portail piéger qui', 'portail piégé qui') WHERE id = 'magies/magie-de-lespace-temps#sort:portail-piege' AND instr(effets, 'portail piéger qui') > 0;
-- sort magies/magie-de-lespace-temps#sort:horloge-aspirante effets [grammaire] : « dégâts infligé. » -> « dégâts infligés. » (accord en nombre avec « dégâts »)
UPDATE sort SET effets = replace(effets, 'dégâts infligé.', 'dégâts infligés.') WHERE id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante' AND instr(effets, 'dégâts infligé.') > 0;
-- sort magies/magie-de-lespace-temps#sort:horloge-aspirante effets [grammaire] : « les créature vivante. » -> « les créatures vivantes. » (pluriel après « les »)
UPDATE sort SET effets = replace(effets, 'les créature vivante.', 'les créatures vivantes.') WHERE id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante' AND instr(effets, 'les créature vivante.') > 0;
-- sort magies/magie-de-lespace-temps#sort:horloge-aspirante remarque [grammaire] : « barrière est vampirisé. » -> « barrière est vampirisée. » (accord en genre avec « la barrière »)
UPDATE sort SET remarque = replace(remarque, 'barrière est vampirisé.', 'barrière est vampirisée.') WHERE id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante' AND instr(remarque, 'barrière est vampirisé.') > 0;
-- sort magies/magie-de-lespace-temps#sort:horloge-aspirante remarque [orthographe] : « les points de vies, c'est » -> « les points de vie, c'est » (on écrit « points de vie » (forme dominante dans les données))
UPDATE sort SET remarque = replace(remarque, 'les points de vies, c''est', 'les points de vie, c''est') WHERE id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante' AND instr(remarque, 'les points de vies, c''est') > 0;
-- sort magies/magie-de-lespace-temps#sort:horloge-aspirante remarque [orthographe] : « les points de vies qui sont » -> « les points de vie qui sont » (on écrit « points de vie » (forme dominante dans les données))
UPDATE sort SET remarque = replace(remarque, 'les points de vies qui sont', 'les points de vie qui sont') WHERE id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante' AND instr(remarque, 'les points de vies qui sont') > 0;
-- sort magies/magie-de-lespace-temps#sort:celerite remarque [grammaire] : « naturellement 2 tour, » -> « naturellement 2 tours, » (pluriel après un nombre supérieur à 1)
UPDATE sort SET remarque = replace(remarque, 'naturellement 2 tour,', 'naturellement 2 tours,') WHERE id = 'magies/magie-de-lespace-temps#sort:celerite' AND instr(remarque, 'naturellement 2 tour,') > 0;
-- sort magies/magie-de-lespace-temps#sort:grenade-distordue effets [frappe] : « symtriquement » -> « symétriquement » (lettre manquante (symétriquement))
UPDATE sort SET effets = replace(effets, 'symtriquement', 'symétriquement') WHERE id = 'magies/magie-de-lespace-temps#sort:grenade-distordue' AND instr(effets, 'symtriquement') > 0;
-- sort magies/magie-de-lespace-temps#sort:grenade-distordue remarque [casse] : « si le lanceur est » -> « Si le lanceur est » (majuscule en début de phrase)
UPDATE sort SET remarque = replace(remarque, 'si le lanceur est', 'Si le lanceur est') WHERE id = 'magies/magie-de-lespace-temps#sort:grenade-distordue' AND instr(remarque, 'si le lanceur est') > 0;
-- sort magies/magie-de-lespace-temps#sort:grenade-distordue remarque [grammaire] : « peut décidé de » -> « peut décider de » (infinitif après « peut »)
UPDATE sort SET remarque = replace(remarque, 'peut décidé de', 'peut décider de') WHERE id = 'magies/magie-de-lespace-temps#sort:grenade-distordue' AND instr(remarque, 'peut décidé de') > 0;
-- sort magies/magie-de-lespace-temps#sort:grenade-distordue remarque [grammaire] : « être téléporter. » -> « être téléporté. » (participe passé après « être »)
UPDATE sort SET remarque = replace(remarque, 'être téléporter.', 'être téléporté.') WHERE id = 'magies/magie-de-lespace-temps#sort:grenade-distordue' AND instr(remarque, 'être téléporter.') > 0;
-- sort magies/magie-de-lespace-temps#sort:teleport-parfait effets [grammaire] : « sur de grande distance » -> « sur de grandes distances » (locution « sur de grandes distances » (pluriel))
UPDATE sort SET effets = replace(effets, 'sur de grande distance', 'sur de grandes distances') WHERE id = 'magies/magie-de-lespace-temps#sort:teleport-parfait' AND instr(effets, 'sur de grande distance') > 0;
-- sort magies/magie-de-lespace-temps#sort:teleport-parfait effets [grammaire] : « doivent touché le » -> « doivent toucher le » (infinitif après « doivent »)
UPDATE sort SET effets = replace(effets, 'doivent touché le', 'doivent toucher le') WHERE id = 'magies/magie-de-lespace-temps#sort:teleport-parfait' AND instr(effets, 'doivent touché le') > 0;
-- sort magies/magie-de-lespace-temps#sort:teleport-parfait effets [grammaire] : « pour être téléporter. » -> « pour être téléportés. » (participe passé après « être », accord avec « Les autres »)
UPDATE sort SET effets = replace(effets, 'pour être téléporter.', 'pour être téléportés.') WHERE id = 'magies/magie-de-lespace-temps#sort:teleport-parfait' AND instr(effets, 'pour être téléporter.') > 0;
-- sort magies/magie-de-lespace-temps#sort:image-diffuse portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d'union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-lespace-temps#sort:image-diffuse effets [grammaire] : « passif du lanceur » -> « passifs du lanceur » (accord en nombre avec « clones »)
UPDATE sort SET effets = replace(effets, 'passif du lanceur', 'passifs du lanceur') WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse' AND instr(effets, 'passif du lanceur') > 0;
-- sort magies/magie-de-lespace-temps#sort:image-diffuse remarque [grammaire] : « Ces clones imite » -> « Ces clones imitent » (le sujet « Ces clones » est pluriel)
UPDATE sort SET remarque = replace(remarque, 'Ces clones imite', 'Ces clones imitent') WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse' AND instr(remarque, 'Ces clones imite') > 0;
-- sort magies/magie-de-lespace-temps#sort:image-diffuse remarque [orthographe] : « dans ces actions » -> « dans ses actions » (possessif : les actions du lanceur (ses))
UPDATE sort SET remarque = replace(remarque, 'dans ces actions', 'dans ses actions') WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse' AND instr(remarque, 'dans ces actions') > 0;
-- sort magies/magie-de-lespace-temps#sort:image-diffuse remarque [orthographe] : « cette attaque à 50% de chance » -> « cette attaque a 50% de chance » (verbe avoir (a) et non la préposition)
UPDATE sort SET remarque = replace(remarque, 'cette attaque à 50% de chance', 'cette attaque a 50% de chance') WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse' AND instr(remarque, 'cette attaque à 50% de chance') > 0;
-- sort magies/magie-de-lespace-temps#sort:image-diffuse remarque [espace] : « d'atterrir  sur » -> « d'atterrir sur » (espace double)
UPDATE sort SET remarque = replace(remarque, 'd''atterrir  sur', 'd''atterrir sur') WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse' AND instr(remarque, 'd''atterrir  sur') > 0;
-- sort magies/magie-de-lespace-temps#sort:premonition portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d'union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-lespace-temps#sort:premonition' AND instr(portee_brut, 'Soi même') > 0;
-- magie magies/magie-du-vide description_physique [grammaire] : « aux niveau des yeux » -> « au niveau des yeux » (locution « au niveau de »)
UPDATE magie SET description_physique = replace(description_physique, 'aux niveau des yeux', 'au niveau des yeux') WHERE id = 'magies/magie-du-vide' AND instr(description_physique, 'aux niveau des yeux') > 0;
-- magie magies/magie-du-vide description_physique [orthographe] : « de l'oeil devient » -> « de l'œil devient » (ligature « œ » dans « œil »)
UPDATE magie SET description_physique = replace(description_physique, 'de l''oeil devient', 'de l''œil devient') WHERE id = 'magies/magie-du-vide' AND instr(description_physique, 'de l''oeil devient') > 0;
-- magie_role magies/magie-du-vide#role:2 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (accent circonflexe manquant (convention « dégâts »))
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-du-vide' AND rang = 2 AND instr(role_brut, 'DÉGATS') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-du-vide:bi effet [espace] : « bon)à la » -> « bon) à la » (espace manquante après la parenthèse fermante)
UPDATE mode_hyper_effet SET effet = replace(effet, 'bon)à la', 'bon) à la') WHERE id = 'onglet_magie:magies/magie-du-vide:bi' AND instr(effet, 'bon)à la') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-du-vide:bi effet [grammaire] : « attaque tenter contre » -> « attaque tentée contre » (participe passé accordé avec « attaque »)
UPDATE mode_hyper_effet SET effet = replace(effet, 'attaque tenter contre', 'attaque tentée contre') WHERE id = 'onglet_magie:magies/magie-du-vide:bi' AND instr(effet, 'attaque tenter contre') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-du-vide:mono effet [grammaire] : « qui tente des » -> « qui tentent des » (le sujet « qui » reprend « ennemis » (pluriel))
UPDATE mode_hyper_effet SET effet = replace(effet, 'qui tente des', 'qui tentent des') WHERE id = 'onglet_magie:magies/magie-du-vide:mono' AND instr(effet, 'qui tente des') > 0;
-- sort magies/magie-du-vide#sort:telekinesie remarque [grammaire] : « infini, il faut un certain niveau de magie pour certains objets⏎Magie 1 = taille » -> « infinie, il faut un certain niveau de magie pour certains objets⏎Magie 1 = taille » (accord en genre avec « La taille »)
UPDATE sort SET remarque = replace(remarque, 'infini, il faut un certain niveau de magie pour certains objets
Magie 1 = taille', 'infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = taille') WHERE id = 'magies/magie-du-vide#sort:telekinesie' AND instr(remarque, 'infini, il faut un certain niveau de magie pour certains objets
Magie 1 = taille') > 0;
-- sort magies/magie-du-vide#sort:telekinesie remarque [grammaire] : « infini, il faut un certain niveau de magie pour certains objets⏎Magie 1 = TP » -> « infinie, il faut un certain niveau de magie pour certains objets⏎Magie 1 = TP » (accord en genre avec « La taille »)
UPDATE sort SET remarque = replace(remarque, 'infini, il faut un certain niveau de magie pour certains objets
Magie 1 = TP', 'infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = TP') WHERE id = 'magies/magie-du-vide#sort:telekinesie' AND instr(remarque, 'infini, il faut un certain niveau de magie pour certains objets
Magie 1 = TP') > 0;
-- sort magies/magie-du-vide#sort:silence effets [grammaire] : « déjà subit le sort » -> « déjà subi le sort » (participe passé du verbe subir (subi))
UPDATE sort SET effets = replace(effets, 'déjà subit le sort', 'déjà subi le sort') WHERE id = 'magies/magie-du-vide#sort:silence' AND instr(effets, 'déjà subit le sort') > 0;
-- sort magies/magie-du-vide#sort:pression effets [grammaire] : « s’affaisse et » -> « s’affaissent et » (le sujet est « Les cibles »)
UPDATE sort SET effets = replace(effets, 's’affaisse et', 's’affaissent et') WHERE id = 'magies/magie-du-vide#sort:pression' AND instr(effets, 's’affaisse et') > 0;
-- sort magies/magie-du-vide#sort:pression effets [grammaire] : « sont incapable de » -> « sont incapables de » (accord en nombre avec « Les cibles »)
UPDATE sort SET effets = replace(effets, 'sont incapable de', 'sont incapables de') WHERE id = 'magies/magie-du-vide#sort:pression' AND instr(effets, 'sont incapable de') > 0;
-- sort magies/magie-du-vide#sort:dissipation remarque [grammaire] : « annulé par ce sort » -> « annulés par ce sort » (accord en nombre avec « Les buff »)
UPDATE sort SET remarque = replace(remarque, 'annulé par ce sort', 'annulés par ce sort') WHERE id = 'magies/magie-du-vide#sort:dissipation' AND instr(remarque, 'annulé par ce sort') > 0;
-- sort magies/magie-du-vide#sort:lame-du-vide effets [grammaire] : « dégâts fixe à » -> « dégâts fixes à » (accord en nombre avec « dégâts »)
UPDATE sort SET effets = replace(effets, 'dégâts fixe à', 'dégâts fixes à') WHERE id = 'magies/magie-du-vide#sort:lame-du-vide' AND instr(effets, 'dégâts fixe à') > 0;
-- sort magies/magie-du-vide#sort:lame-du-vide effets [grammaire] : « ennemis visible. » -> « ennemis visibles. » (accord en nombre avec « ennemis »)
UPDATE sort SET effets = replace(effets, 'ennemis visible.', 'ennemis visibles.') WHERE id = 'magies/magie-du-vide#sort:lame-du-vide' AND instr(effets, 'ennemis visible.') > 0;
-- sort magies/magie-du-vide#sort:aspect-vide portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d'union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vide#sort:aspect-vide' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-vide#sort:aspect-vide remarque [grammaire] : « attaques ne touche pas, SEULES les armes spectrales fonctionne dans » -> « attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans » (le sujet « les sorts et les attaques » et « les armes » est pluriel)
UPDATE sort SET remarque = replace(remarque, 'attaques ne touche pas, SEULES les armes spectrales fonctionne dans', 'attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans') WHERE id = 'magies/magie-du-vide#sort:aspect-vide' AND instr(remarque, 'attaques ne touche pas, SEULES les armes spectrales fonctionne dans') > 0;
-- sort magies/magie-du-vide#sort:aspect-vide remarque [grammaire] : « et sorts ne fonctionne pas, SEULES les armes spectrales fonctionne dans » -> « et sorts ne fonctionnent pas, SEULES les armes spectrales fonctionnent dans » (le sujet « les attaques et sorts » et « les armes » est pluriel)
UPDATE sort SET remarque = replace(remarque, 'et sorts ne fonctionne pas, SEULES les armes spectrales fonctionne dans', 'et sorts ne fonctionnent pas, SEULES les armes spectrales fonctionnent dans') WHERE id = 'magies/magie-du-vide#sort:aspect-vide' AND instr(remarque, 'et sorts ne fonctionne pas, SEULES les armes spectrales fonctionne dans') > 0;
-- sort magies/magie-du-vide#sort:touche-du-vide effets [grammaire] : « les créature vivante. » -> « les créatures vivantes. » (pluriel après « les »)
UPDATE sort SET effets = replace(effets, 'les créature vivante.', 'les créatures vivantes.') WHERE id = 'magies/magie-du-vide#sort:touche-du-vide' AND instr(effets, 'les créature vivante.') > 0;
-- sort magies/magie-du-vide#sort:touche-du-vide remarque [grammaire] : « barrière est vampirisé. » -> « barrière est vampirisée. » (accord en genre avec « la barrière »)
UPDATE sort SET remarque = replace(remarque, 'barrière est vampirisé.', 'barrière est vampirisée.') WHERE id = 'magies/magie-du-vide#sort:touche-du-vide' AND instr(remarque, 'barrière est vampirisé.') > 0;
-- sort magies/magie-du-vide#sort:touche-du-vide remarque [orthographe] : « les points de vies, c'est » -> « les points de vie, c'est » (on écrit « points de vie » (forme dominante dans les données))
UPDATE sort SET remarque = replace(remarque, 'les points de vies, c''est', 'les points de vie, c''est') WHERE id = 'magies/magie-du-vide#sort:touche-du-vide' AND instr(remarque, 'les points de vies, c''est') > 0;
-- sort magies/magie-du-vide#sort:touche-du-vide remarque [orthographe] : « les points de vies qui sont » -> « les points de vie qui sont » (on écrit « points de vie » (forme dominante dans les données))
UPDATE sort SET remarque = replace(remarque, 'les points de vies qui sont', 'les points de vie qui sont') WHERE id = 'magies/magie-du-vide#sort:touche-du-vide' AND instr(remarque, 'les points de vies qui sont') > 0;
-- sort magies/magie-du-vide#sort:alea-negatif remarque [ponctuation] : « au dessus » -> « au-dessus » (trait d'union dans « au-dessus »)
UPDATE sort SET remarque = replace(remarque, 'au dessus', 'au-dessus') WHERE id = 'magies/magie-du-vide#sort:alea-negatif' AND instr(remarque, 'au dessus') > 0;
-- sort magies/magie-du-vide#sort:alea-negatif remarque [grammaire] : « croix dure 1 » -> « croix durent 1 » (le sujet « les croix » est pluriel)
UPDATE sort SET remarque = replace(remarque, 'croix dure 1', 'croix durent 1') WHERE id = 'magies/magie-du-vide#sort:alea-negatif' AND instr(remarque, 'croix dure 1') > 0;
-- sort magies/magie-du-vide#sort:alea-negatif remarque [grammaire] : « Retire tout les effets » -> « Retire tous les effets » (« tous les » devant un pluriel masculin)
UPDATE sort SET remarque = replace(remarque, 'Retire tout les effets', 'Retire tous les effets') WHERE id = 'magies/magie-du-vide#sort:alea-negatif' AND instr(remarque, 'Retire tout les effets') > 0;
-- sort magies/magie-du-vide#sort:esprit-solide effets [grammaire] : « à tout agression » -> « à toute agression » (accord en genre avec « agression »)
UPDATE sort SET effets = replace(effets, 'à tout agression', 'à toute agression') WHERE id = 'magies/magie-du-vide#sort:esprit-solide' AND instr(effets, 'à tout agression') > 0;
-- sort magies/magie-du-vide#sort:saccage-temporel portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d'union (convention commune))
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vide#sort:saccage-temporel' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-vide#sort:mot-du-vide effets [grammaire] : « partiellement immatériel. » -> « partiellement immatérielle. » (accord en genre avec « La cible »)
UPDATE sort SET effets = replace(effets, 'partiellement immatériel.', 'partiellement immatérielle.') WHERE id = 'magies/magie-du-vide#sort:mot-du-vide' AND instr(effets, 'partiellement immatériel.') > 0;
-- sort magies/magie-du-vide#sort:metronome effets [grammaire] : « NM sont utile pour » -> « NM sont utiles pour » (accord en nombre avec « Les NM »)
UPDATE sort SET effets = replace(effets, 'NM sont utile pour', 'NM sont utiles pour') WHERE id = 'magies/magie-du-vide#sort:metronome' AND instr(effets, 'NM sont utile pour') > 0;
-- sort magies/magie-du-vide#sort:metronome texte_niveau5 [grammaire] : « puisse le sort surgisse » -> « puisse le sort surgir » (Après « puisse » : infinitif, comme dans les autres incantations (« puisse l’univers se vider », « puisse le Vide se déchaîner »).)
UPDATE sort SET texte_niveau5 = replace(texte_niveau5, 'puisse le sort surgisse', 'puisse le sort surgir') WHERE id = 'magies/magie-du-vide#sort:metronome' AND instr(texte_niveau5, 'puisse le sort surgisse') > 0;
-- sort magies/magie-du-vide#sort:metronome texte_niveau5 [accent] : « METRONOME ! » -> « MÉTRONOME ! » (accent sur la majuscule (nom du sort « Métronome »))
UPDATE sort SET texte_niveau5 = replace(texte_niveau5, 'METRONOME !', 'MÉTRONOME !') WHERE id = 'magies/magie-du-vide#sort:metronome' AND instr(texte_niveau5, 'METRONOME !') > 0;
-- sort magies/magie-du-vide#sort:metronome remarque [grammaire] : « Ne peut pas être relancer.⏎Le mage » -> « Ne peut pas être relancé.⏎Le mage » (participe passé après « être »)
UPDATE sort SET remarque = replace(remarque, 'Ne peut pas être relancer.
Le mage', 'Ne peut pas être relancé.
Le mage') WHERE id = 'magies/magie-du-vide#sort:metronome' AND instr(remarque, 'Ne peut pas être relancer.
Le mage') > 0;
-- sort magies/magie-du-vide#sort:metronome remarque [grammaire] : « sort.⏎⏎Ne peut pas être relancer. » -> « sort.⏎⏎Ne peut pas être relancé. » (participe passé après « être »)
UPDATE sort SET remarque = replace(remarque, 'sort.

Ne peut pas être relancer.', 'sort.

Ne peut pas être relancé.') WHERE id = 'magies/magie-du-vide#sort:metronome' AND instr(remarque, 'sort.

Ne peut pas être relancer.') > 0;
-- sort magies/magie-du-vide#sort:marteau-du-vide effets [grammaire] : « de terrible dégâts » -> « de terribles dégâts » (accord en nombre avec « dégâts »)
UPDATE sort SET effets = replace(effets, 'de terrible dégâts', 'de terribles dégâts') WHERE id = 'magies/magie-du-vide#sort:marteau-du-vide' AND instr(effets, 'de terrible dégâts') > 0;
-- sort magies/magie-du-vide#sort:sablier-du-vide effets [grammaire] : « et le retransmet » -> « et la retransmet » (Le pronom reprend « la santé » (féminin).)
UPDATE sort SET effets = replace(effets, 'et le retransmet', 'et la retransmet') WHERE id = 'magies/magie-du-vide#sort:sablier-du-vide' AND instr(effets, 'et le retransmet') > 0;
-- magie magies/magie-de-la-necromancie description [grammaire] : « de bon dégâts » -> « de bons dégâts » (adjectif accordé avec « dégâts » (pluriel))
UPDATE magie SET description = replace(description, 'de bon dégâts', 'de bons dégâts') WHERE id = 'magies/magie-de-la-necromancie' AND instr(description, 'de bon dégâts') > 0;
-- magie magies/magie-de-la-necromancie description_physique [grammaire] : « plus mince que » -> « plus minces que » (accord avec « Les nécromanciens »)
UPDATE magie SET description_physique = replace(description_physique, 'plus mince que', 'plus minces que') WHERE id = 'magies/magie-de-la-necromancie' AND instr(description_physique, 'plus mince que') > 0;
-- magie magies/magie-de-la-necromancie description_physique [orthographe] : « voir maigre pour » -> « voire maigres pour » (l'adverbe est « voire » (et même), pas l'infinitif « voir » ; « maigre » s'accorde avec « nécromanciens ».)
UPDATE magie SET description_physique = replace(description_physique, 'voir maigre pour', 'voire maigres pour') WHERE id = 'magies/magie-de-la-necromancie' AND instr(description_physique, 'voir maigre pour') > 0;
-- magie magies/magie-de-la-necromancie description_physique [orthographe] : « par endroit ( » -> « par endroits ( » (locution « par endroits »)
UPDATE magie SET description_physique = replace(description_physique, 'par endroit (', 'par endroits (') WHERE id = 'magies/magie-de-la-necromancie' AND instr(description_physique, 'par endroit (') > 0;
-- magie magies/magie-de-la-necromancie description_physique [ponctuation] : « phalanges, etc) » -> « phalanges, etc.) » (abréviation « etc. » : point manquant)
UPDATE magie SET description_physique = replace(description_physique, 'phalanges, etc)', 'phalanges, etc.)') WHERE id = 'magies/magie-de-la-necromancie' AND instr(description_physique, 'phalanges, etc)') > 0;
-- magie magies/magie-de-la-necromancie barre4_texte [grammaire] : « 10 Âme et » -> « 10 Âmes et » (pluriel après un nombre supérieur à 1)
UPDATE magie SET barre4_texte = replace(barre4_texte, '10 Âme et', '10 Âmes et') WHERE id = 'magies/magie-de-la-necromancie' AND instr(barre4_texte, '10 Âme et') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-la-necromancie:mono effet [grammaire] : « au lieu d'un seul. » -> « au lieu d'une seule. » (accord en genre avec « invocations » (féminin).)
UPDATE mode_hyper_effet SET effet = replace(effet, 'au lieu d''un seul.', 'au lieu d''une seule.') WHERE id = 'onglet_magie:magies/magie-de-la-necromancie:mono' AND instr(effet, 'au lieu d''un seul.') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-la-necromancie:mono effet [casse] : « déjà en ic) » -> « déjà en IC) » (sigle IC écrit en majuscules dans la même phrase)
UPDATE mode_hyper_effet SET effet = replace(effet, 'déjà en ic)', 'déjà en IC)') WHERE id = 'onglet_magie:magies/magie-de-la-necromancie:mono' AND instr(effet, 'déjà en ic)') > 0;
-- amelioration_cadaverique magies/magie-de-la-necromancie#amelioration:os-froid effet [grammaire] : « Dégâts magique divisé par 2 » -> « Dégâts magiques divisés par 2 » (accord avec « Dégâts » (pluriel))
UPDATE amelioration_cadaverique SET effet = replace(effet, 'Dégâts magique divisé par 2', 'Dégâts magiques divisés par 2') WHERE id = 'magies/magie-de-la-necromancie#amelioration:os-froid' AND instr(effet, 'Dégâts magique divisé par 2') > 0;
-- amelioration_cadaverique magies/magie-de-la-necromancie#amelioration:reanime effet [frappe] : « VItesse » -> « Vitesse » (majuscule parasite au milieu du mot)
UPDATE amelioration_cadaverique SET effet = replace(effet, 'VItesse', 'Vitesse') WHERE id = 'magies/magie-de-la-necromancie#amelioration:reanime' AND instr(effet, 'VItesse') > 0;
-- amelioration_cadaverique magies/magie-de-la-necromancie#amelioration:s-de-pierre effet [grammaire] : « Dégâts physique divisé par 2 » -> « Dégâts physiques divisés par 2 » (accord avec « Dégâts » (pluriel))
UPDATE amelioration_cadaverique SET effet = replace(effet, 'Dégâts physique divisé par 2', 'Dégâts physiques divisés par 2') WHERE id = 'magies/magie-de-la-necromancie#amelioration:s-de-pierre' AND instr(effet, 'Dégâts physique divisé par 2') > 0;
-- amelioration_cadaverique magies/magie-de-la-necromancie#amelioration:s-rayonnant effet [grammaire] : « Peut sacrifié » -> « Peut sacrifier » (infinitif après « Peut »)
UPDATE amelioration_cadaverique SET effet = replace(effet, 'Peut sacrifié', 'Peut sacrifier') WHERE id = 'magies/magie-de-la-necromancie#amelioration:s-rayonnant' AND instr(effet, 'Peut sacrifié') > 0;
-- sort magies/magie-de-la-necromancie#sort:animation-de-mort effets [grammaire] : « des non-mort ( » -> « des non-morts ( » (pluriel après « des »)
UPDATE sort SET effets = replace(effets, 'des non-mort (', 'des non-morts (') WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND instr(effets, 'des non-mort (') > 0;
-- sort magies/magie-de-la-necromancie#sort:animation-de-mort remarque [frappe] : « NIveau 2 » -> « Niveau 2 » (majuscule parasite (I))
UPDATE sort SET remarque = replace(remarque, 'NIveau 2', 'Niveau 2') WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND instr(remarque, 'NIveau 2') > 0;
-- sort magies/magie-de-la-necromancie#sort:animation-de-mort remarque [frappe] : « NIveau 3 » -> « Niveau 3 » (majuscule parasite (I))
UPDATE sort SET remarque = replace(remarque, 'NIveau 3', 'Niveau 3') WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND instr(remarque, 'NIveau 3') > 0;
-- sort magies/magie-de-la-necromancie#sort:animation-de-mort remarque [frappe] : « NIveau 4 » -> « Niveau 4 » (majuscule parasite (I))
UPDATE sort SET remarque = replace(remarque, 'NIveau 4', 'Niveau 4') WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND instr(remarque, 'NIveau 4') > 0;
-- sort magies/magie-de-la-necromancie#sort:animation-de-mort remarque [grammaire] : « 5 âmes⏎⏎Chaque niveau de puissance de la créature invoqué double » -> « 5 âmes⏎⏎Chaque niveau de puissance de la créature invoquée double » (le participe s'accorde avec « créature » (féminin). Première occurrence de la phrase (après la liste des niveaux). Voir a_valider pour « de le coût ».)
UPDATE sort SET remarque = replace(remarque, '5 âmes

Chaque niveau de puissance de la créature invoqué double', '5 âmes

Chaque niveau de puissance de la créature invoquée double') WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND instr(remarque, '5 âmes

Chaque niveau de puissance de la créature invoqué double') > 0;
-- sort magies/magie-de-la-necromancie#sort:animation-de-mort remarque [orthographe] : « morts vivants » -> « morts-vivants » (trait d'union (mort-vivant, cf. l'URL du wiki))
UPDATE sort SET remarque = replace(remarque, 'morts vivants', 'morts-vivants') WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND instr(remarque, 'morts vivants') > 0;
-- sort magies/magie-de-la-necromancie#sort:animation-de-mort remarque [grammaire] : « possible https » -> « possibles https » (accord avec « morts-vivants »)
UPDATE sort SET remarque = replace(remarque, 'possible https', 'possibles https') WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND instr(remarque, 'possible https') > 0;
-- sort magies/magie-de-la-necromancie#sort:animation-de-mort remarque [grammaire] : « (Invocation)⏎⏎Chaque niveau de puissance de la créature invoqué double » -> « (Invocation)⏎⏎Chaque niveau de puissance de la créature invoquée double » (le participe s'accorde avec « créature » (féminin). Seconde occurrence de la phrase (après le lien).)
UPDATE sort SET remarque = replace(remarque, '(Invocation)

Chaque niveau de puissance de la créature invoqué double', '(Invocation)

Chaque niveau de puissance de la créature invoquée double') WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND instr(remarque, '(Invocation)

Chaque niveau de puissance de la créature invoqué double') > 0;
-- sort magies/magie-de-la-necromancie#sort:mur-dos effets [grammaire] : « qui possède 10 PV » -> « qui possèdent 10 PV » (« qui » reprend « murs » (pluriel))
UPDATE sort SET effets = replace(effets, 'qui possède 10 PV', 'qui possèdent 10 PV') WHERE id = 'magies/magie-de-la-necromancie#sort:mur-dos' AND instr(effets, 'qui possède 10 PV') > 0;
-- sort magies/magie-de-la-necromancie#sort:corruption-dame effets [casse] : « jet de Vigueur raté » -> « jet de vigueur raté » (forme majoritaire « jet de vigueur » dans la colonne)
UPDATE sort SET effets = replace(effets, 'jet de Vigueur raté', 'jet de vigueur raté') WHERE id = 'magies/magie-de-la-necromancie#sort:corruption-dame' AND instr(effets, 'jet de Vigueur raté') > 0;
-- sort magies/magie-de-la-necromancie#sort:detection-de-vie portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-vie' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-necromancie#sort:detection-de-vie effets [orthographe] : « formes de vies » -> « formes de vie » (locution « formes de vie » (vie invariable))
UPDATE sort SET effets = replace(effets, 'formes de vies', 'formes de vie') WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-vie' AND instr(effets, 'formes de vies') > 0;
-- sort magies/magie-de-la-necromancie#sort:detection-de-vie effets [grammaire] : « ses dernier étant » -> « ces derniers étant » (« ces derniers » (démonstratif, pluriel : animaux et végétaux))
UPDATE sort SET effets = replace(effets, 'ses dernier étant', 'ces derniers étant') WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-vie' AND instr(effets, 'ses dernier étant') > 0;
-- sort magies/magie-de-la-necromancie#sort:detection-de-vie effets [grammaire] : « plus sombre) » -> « plus sombres) » (accord avec « ces derniers »)
UPDATE sort SET effets = replace(effets, 'plus sombre)', 'plus sombres)') WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-vie' AND instr(effets, 'plus sombre)') > 0;
-- sort magies/magie-de-la-necromancie#sort:forces-des-ames cout_brut [grammaire] : « 1 âmes » -> « 1 âme » (singulier après le nombre 1)
UPDATE sort SET cout_brut = replace(cout_brut, '1 âmes', '1 âme') WHERE id = 'magies/magie-de-la-necromancie#sort:forces-des-ames' AND instr(cout_brut, '1 âmes') > 0;
-- sort magies/magie-de-la-necromancie#sort:forces-des-ames dsb_brut [grammaire] : « 1 âmes » -> « 1 âme » (singulier après le nombre 1)
UPDATE sort SET dsb_brut = replace(dsb_brut, '1 âmes', '1 âme') WHERE id = 'magies/magie-de-la-necromancie#sort:forces-des-ames' AND instr(dsb_brut, '1 âmes') > 0;
-- sort magies/magie-de-la-necromancie#sort:pieu-dos cout_brut [grammaire] : « 2 âme » -> « 2 âmes » (pluriel après un nombre supérieur à 1)
UPDATE sort SET cout_brut = replace(cout_brut, '2 âme', '2 âmes') WHERE id = 'magies/magie-de-la-necromancie#sort:pieu-dos' AND instr(cout_brut, '2 âme') > 0;
-- sort magies/magie-de-la-necromancie#sort:armure-dos effets [grammaire] : « aux attaque de taille » -> « aux attaques de taille » (pluriel après « aux »)
UPDATE sort SET effets = replace(effets, 'aux attaque de taille', 'aux attaques de taille') WHERE id = 'magies/magie-de-la-necromancie#sort:armure-dos' AND instr(effets, 'aux attaque de taille') > 0;
-- sort magies/magie-de-la-necromancie#sort:detection-de-la-mort portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-la-mort' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-necromancie#sort:festin-des-ames portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-necromancie#sort:festin-des-ames' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-necromancie#sort:festin-des-ames effets [grammaire] : « âmes affamés » -> « âmes affamées » (accord avec « âmes » (féminin pluriel))
UPDATE sort SET effets = replace(effets, 'âmes affamés', 'âmes affamées') WHERE id = 'magies/magie-de-la-necromancie#sort:festin-des-ames' AND instr(effets, 'âmes affamés') > 0;
-- sort magies/magie-de-la-necromancie#sort:poison-de-masse portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-necromancie#sort:poison-de-masse' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-necromancie#sort:forge-de-ses-morts portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-necromancie#sort:calin-putrefie cout_brut [grammaire] : « 3 âme » -> « 3 âmes » (pluriel après un nombre supérieur à 1)
UPDATE sort SET cout_brut = replace(cout_brut, '3 âme', '3 âmes') WHERE id = 'magies/magie-de-la-necromancie#sort:calin-putrefie' AND instr(cout_brut, '3 âme') > 0;
-- sort magies/magie-de-la-necromancie#sort:vague-de-cadavre zone_brut [grammaire] : « 5 case » -> « 5 cases » (pluriel après un nombre supérieur à 1)
UPDATE sort SET zone_brut = replace(zone_brut, '5 case', '5 cases') WHERE id = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre' AND instr(zone_brut, '5 case') > 0;
-- sort magies/magie-de-la-necromancie#sort:cimetiere-ouvert portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-necromancie#sort:resurrection-noir remarque [grammaire] : « mois. Ou alors qu'une résurrection est appliquer » -> « mois. Ou alors qu'une résurrection est appliquée » (participe passé accordé avec « résurrection » (passif) ; première occurrence)
UPDATE sort SET remarque = replace(remarque, 'mois. Ou alors qu''une résurrection est appliquer', 'mois. Ou alors qu''une résurrection est appliquée') WHERE id = 'magies/magie-de-la-necromancie#sort:resurrection-noir' AND instr(remarque, 'mois. Ou alors qu''une résurrection est appliquer') > 0;
-- sort magies/magie-de-la-necromancie#sort:resurrection-noir remarque [grammaire] : « Est considérer comme mort » -> « Est considéré comme mort » (participe passé après « est »)
UPDATE sort SET remarque = replace(remarque, 'Est considérer comme mort', 'Est considéré comme mort') WHERE id = 'magies/magie-de-la-necromancie#sort:resurrection-noir' AND instr(remarque, 'Est considérer comme mort') > 0;
-- sort magies/magie-de-la-necromancie#sort:resurrection-noir remarque [grammaire] : « jours. Ou alors qu'une résurrection est appliquer » -> « jours. Ou alors qu'une résurrection est appliquée » (participe passé accordé avec « résurrection » (passif) ; seconde occurrence)
UPDATE sort SET remarque = replace(remarque, 'jours. Ou alors qu''une résurrection est appliquer', 'jours. Ou alors qu''une résurrection est appliquée') WHERE id = 'magies/magie-de-la-necromancie#sort:resurrection-noir' AND instr(remarque, 'jours. Ou alors qu''une résurrection est appliquer') > 0;
-- magie magies/magie-du-feu description_physique [grammaire] : « sont un peu calcinés » -> « sont un peu calcinées » (accord avec « mains » (féminin pluriel))
UPDATE magie SET description_physique = replace(description_physique, 'sont un peu calcinés', 'sont un peu calcinées') WHERE id = 'magies/magie-du-feu' AND instr(description_physique, 'sont un peu calcinés') > 0;
-- magie_role magies/magie-du-feu#role:1 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe (convention))
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-du-feu' AND rang = 1 AND instr(role_brut, 'DÉGATS') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-du-feu:bi effet [orthographe] : « une contre attaque » -> « une contre-attaque » (trait d'union (contre-attaque))
UPDATE mode_hyper_effet SET effet = replace(effet, 'une contre attaque', 'une contre-attaque') WHERE id = 'onglet_magie:magies/magie-du-feu:bi' AND instr(effet, 'une contre attaque') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-du-feu:mono effet [orthographe] : « une contre attaque » -> « une contre-attaque » (trait d'union (contre-attaque))
UPDATE mode_hyper_effet SET effet = replace(effet, 'une contre attaque', 'une contre-attaque') WHERE id = 'onglet_magie:magies/magie-du-feu:mono' AND instr(effet, 'une contre attaque') > 0;
-- sort magies/magie-du-feu#sort:aura-chaude portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-feu#sort:aura-chaude' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-feu#sort:aura-chaude effets [orthographe] : « si ils ratent » -> « s'ils ratent » (élision obligatoire « s'ils »)
UPDATE sort SET effets = replace(effets, 'si ils ratent', 's''ils ratent') WHERE id = 'magies/magie-du-feu#sort:aura-chaude' AND instr(effets, 'si ils ratent') > 0;
-- sort magies/magie-du-feu#sort:detection-du-feu effets [orthographe] : « d'être vivant » -> « d'êtres vivants » (nom « êtres » (pluriel, avec accent) ; accord de « vivants »)
UPDATE sort SET effets = replace(effets, 'd''être vivant', 'd''êtres vivants') WHERE id = 'magies/magie-du-feu#sort:detection-du-feu' AND instr(effets, 'd''être vivant') > 0;
-- sort magies/magie-du-feu#sort:braise-magique zone_brut [grammaire] : « Tout les ennemis visible » -> « Tous les ennemis visibles » (« tous les » + accord de « visibles » avec « ennemis »)
UPDATE sort SET zone_brut = replace(zone_brut, 'Tout les ennemis visible', 'Tous les ennemis visibles') WHERE id = 'magies/magie-du-feu#sort:braise-magique' AND instr(zone_brut, 'Tout les ennemis visible') > 0;
-- sort magies/magie-du-feu#sort:braise-magique effets [grammaire] : « de touché » -> « de toucher » (infinitif après « de »)
UPDATE sort SET effets = replace(effets, 'de touché', 'de toucher') WHERE id = 'magies/magie-du-feu#sort:braise-magique' AND instr(effets, 'de touché') > 0;
-- sort magies/magie-du-feu#sort:braise-magique effets [grammaire] : « tout les ennemi avec » -> « tous les ennemis avec » (« tous les » + pluriel de « ennemis »)
UPDATE sort SET effets = replace(effets, 'tout les ennemi avec', 'tous les ennemis avec') WHERE id = 'magies/magie-du-feu#sort:braise-magique' AND instr(effets, 'tout les ennemi avec') > 0;
-- sort magies/magie-du-feu#sort:braise-magique effets [accent] : « inflige Brulure 1 » -> « inflige brûlure 1 » (« brûlure » prend un accent circonflexe (écrit ainsi partout ailleurs) | vérificateur : Accent manquant; casse alignée sur la forme majoritaire « brûlure » (minuscule) de la colonne.)
UPDATE sort SET effets = replace(effets, 'inflige Brulure 1', 'inflige brûlure 1') WHERE id = 'magies/magie-du-feu#sort:braise-magique' AND instr(effets, 'inflige Brulure 1') > 0;
-- sort magies/magie-du-feu#sort:etincelle portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-feu#sort:etincelle' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-feu#sort:etincelle effets [orthographe] : « de contre coup » -> « de contrecoup » (trait d'union (contre-coup) | forme unique « contrecoup » dans tous les sorts)
UPDATE sort SET effets = replace(effets, 'de contre coup', 'de contrecoup') WHERE id = 'magies/magie-du-feu#sort:etincelle' AND instr(effets, 'de contre coup') > 0;
-- sort magies/magie-du-feu#sort:fournaise effets [grammaire] : « Ne peut être faire que » -> « Ne peut être fait que » (participe passé après « être »)
UPDATE sort SET effets = replace(effets, 'Ne peut être faire que', 'Ne peut être fait que') WHERE id = 'magies/magie-du-feu#sort:fournaise' AND instr(effets, 'Ne peut être faire que') > 0;
-- sort magies/magie-du-feu#sort:mur-de-flammes effets [grammaire] : « qui ne possède pas » -> « qui ne possèdent pas » (accord avec « Ceux » (pluriel))
UPDATE sort SET effets = replace(effets, 'qui ne possède pas', 'qui ne possèdent pas') WHERE id = 'magies/magie-du-feu#sort:mur-de-flammes' AND instr(effets, 'qui ne possède pas') > 0;
-- sort magies/magie-du-feu#sort:mur-de-flammes effets [grammaire] : « pour tenté de traverser » -> « pour tenter de traverser » (infinitif après « pour »)
UPDATE sort SET effets = replace(effets, 'pour tenté de traverser', 'pour tenter de traverser') WHERE id = 'magies/magie-du-feu#sort:mur-de-flammes' AND instr(effets, 'pour tenté de traverser') > 0;
-- sort magies/magie-du-feu#sort:diffusion portee_brut [orthographe] : « Soi même » -> « Soi-même » (convention : trait d'union)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-feu#sort:diffusion' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-feu#sort:diffusion effets [grammaire] : « dégâts fixe a tout ceux » -> « dégâts fixes à tous ceux » (« fixes » accordé avec « dégâts » ; préposition « à » ; « tous ceux »)
UPDATE sort SET effets = replace(effets, 'dégâts fixe a tout ceux', 'dégâts fixes à tous ceux') WHERE id = 'magies/magie-du-feu#sort:diffusion' AND instr(effets, 'dégâts fixe a tout ceux') > 0;
-- sort magies/magie-du-feu#sort:diffusion effets [grammaire] : « qui souffre » -> « qui souffrent » (accord du verbe avec « ceux » (pluriel) | vérificateur : Accord avec « ceux »; avant raccourci pour ne pas chevaucher la 60 (« d'une brulure »).)
UPDATE sort SET effets = replace(effets, 'qui souffre', 'qui souffrent') WHERE id = 'magies/magie-du-feu#sort:diffusion' AND instr(effets, 'qui souffre') > 0;
-- sort magies/magie-du-feu#sort:diffusion effets [accent] : « d'une brulure » -> « d'une brûlure » (« brûlure » prend un accent circonflexe)
UPDATE sort SET effets = replace(effets, 'd''une brulure', 'd''une brûlure') WHERE id = 'magies/magie-du-feu#sort:diffusion' AND instr(effets, 'd''une brulure') > 0;
-- sort magies/magie-du-feu#sort:marcheur-exalte effets [ponctuation] : « de la lave.. Les » -> « de la lave. Les » (point final doublé)
UPDATE sort SET effets = replace(effets, 'de la lave.. Les', 'de la lave. Les') WHERE id = 'magies/magie-du-feu#sort:marcheur-exalte' AND instr(effets, 'de la lave.. Les') > 0;
-- sort magies/magie-du-feu#sort:marcheur-exalte effets [grammaire] : « Les jambes possède » -> « Les jambes possèdent » (accord avec « jambes » (pluriel))
UPDATE sort SET effets = replace(effets, 'Les jambes possède', 'Les jambes possèdent') WHERE id = 'magies/magie-du-feu#sort:marcheur-exalte' AND instr(effets, 'Les jambes possède') > 0;
-- sort magies/magie-du-feu#sort:marcheur-exalte effets [accent] : « armure a cet endroit » -> « armure à cet endroit » (préposition « à » (et non le verbe « a »))
UPDATE sort SET effets = replace(effets, 'armure a cet endroit', 'armure à cet endroit') WHERE id = 'magies/magie-du-feu#sort:marcheur-exalte' AND instr(effets, 'armure a cet endroit') > 0;
-- sort magies/magie-du-feu#sort:bouclier-de-feu effets [accent] : « dégâts a toute attaque » -> « dégâts à toute attaque » (préposition « à » (et non le verbe « a »))
UPDATE sort SET effets = replace(effets, 'dégâts a toute attaque', 'dégâts à toute attaque') WHERE id = 'magies/magie-du-feu#sort:bouclier-de-feu' AND instr(effets, 'dégâts a toute attaque') > 0;
-- sort magies/magie-du-feu#sort:bouffee-infernale effets [accent] : « d'infliger Brulure 1 » -> « d'infliger brûlure 1 » (« brûlure » prend un accent circonflexe (écrit ainsi partout ailleurs) | vérificateur : Accent manquant; casse alignée sur la forme majoritaire « brûlure » (minuscule) de la colonne.)
UPDATE sort SET effets = replace(effets, 'd''infliger Brulure 1', 'd''infliger brûlure 1') WHERE id = 'magies/magie-du-feu#sort:bouffee-infernale' AND instr(effets, 'd''infliger Brulure 1') > 0;
-- sort magies/magie-du-feu#sort:combustion-forte effets [grammaire] : « aux immunisé » -> « aux immunisés » (pluriel après « aux »)
UPDATE sort SET effets = replace(effets, 'aux immunisé', 'aux immunisés') WHERE id = 'magies/magie-du-feu#sort:combustion-forte' AND instr(effets, 'aux immunisé') > 0;
-- sort magies/magie-du-feu#sort:combustion-forte effets [grammaire] : « ne peux l'être » -> « ne peut l'être » (sujet « ce qui » : 3e personne)
UPDATE sort SET effets = replace(effets, 'ne peux l''être', 'ne peut l''être') WHERE id = 'magies/magie-du-feu#sort:combustion-forte' AND instr(effets, 'ne peux l''être') > 0;
-- sort magies/magie-du-feu#sort:meteore-cramoisi effets [grammaire] : « de terrible dégâts » -> « de terribles dégâts » (adjectif accordé avec « dégâts » (pluriel))
UPDATE sort SET effets = replace(effets, 'de terrible dégâts', 'de terribles dégâts') WHERE id = 'magies/magie-du-feu#sort:meteore-cramoisi' AND instr(effets, 'de terrible dégâts') > 0;
-- sort magies/magie-du-feu#sort:bucher-purifiant effets [grammaire] : « de terrible dégâts » -> « de terribles dégâts » (adjectif accordé avec « dégâts » (pluriel))
UPDATE sort SET effets = replace(effets, 'de terrible dégâts', 'de terribles dégâts') WHERE id = 'magies/magie-du-feu#sort:bucher-purifiant' AND instr(effets, 'de terrible dégâts') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-la-necromancie:bi effet [grammaire] : « au lieu d'un seul. » -> « au lieu d'une seule. » (accord en genre avec « invocations » (féminin).)
UPDATE mode_hyper_effet SET effet = replace(effet, 'au lieu d''un seul.', 'au lieu d''une seule.') WHERE id = 'onglet_magie:magies/magie-de-la-necromancie:bi' AND instr(effet, 'au lieu d''un seul.') > 0;
-- sort magies/magie-du-feu#sort:bouclier-de-feu portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d'union (convention commune : « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-feu#sort:bouclier-de-feu' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-feu#sort:zenith portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d'union (convention commune : « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-feu#sort:zenith' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-feu#sort:pluie-chaude portee_brut [ponctuation] : « Soi même » -> « Soi-même » (trait d'union (convention commune : « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-feu#sort:pluie-chaude' AND instr(portee_brut, 'Soi même') > 0;
-- magie magies/magie-de-leau description_physique [grammaire] : « très long et mouillés » -> « très longues et mouillées » (Adjectifs en apposition accordés avec « mèches » (féminin pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'très long et mouillés', 'très longues et mouillées') WHERE id = 'magies/magie-de-leau' AND instr(description_physique, 'très long et mouillés') > 0;
-- magie magies/magie-de-leau description_physique [orthographe] : « plus estétique » -> « plus esthétique » (« esthétique » s'écrit avec un h.)
UPDATE magie SET description_physique = replace(description_physique, 'plus estétique', 'plus esthétique') WHERE id = 'magies/magie-de-leau' AND instr(description_physique, 'plus estétique') > 0;
-- magie magies/magie-de-leau description_physique [grammaire] : « ce dernier transpirent » -> « ce dernier transpire » (Le sujet « ce dernier » (le corps) est au singulier.)
UPDATE magie SET description_physique = replace(description_physique, 'ce dernier transpirent', 'ce dernier transpire') WHERE id = 'magies/magie-de-leau' AND instr(description_physique, 'ce dernier transpirent') > 0;
-- magie magies/magie-de-leau description_physique [grammaire] : « bleus azur » -> « bleu azur » (Adjectif de couleur composé (nuance) invariable, comme « bleu cyan » dans la magie de la glace.)
UPDATE magie SET description_physique = replace(description_physique, 'bleus azur', 'bleu azur') WHERE id = 'magies/magie-de-leau' AND instr(description_physique, 'bleus azur') > 0;
-- magie_role magies/magie-de-leau#role:2 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe, y compris en capitales.)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-de-leau' AND rang = 2 AND instr(role_brut, 'DÉGATS') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-leau:bi effet [grammaire] : « considérer comme » -> « considéré comme » (Après « est », participe passé et non infinitif.)
UPDATE mode_hyper_effet SET effet = replace(effet, 'considérer comme', 'considéré comme') WHERE id = 'onglet_magie:magies/magie-de-leau:bi' AND instr(effet, 'considérer comme') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-leau:bi effet [grammaire] : « attaque subis » -> « attaque subie » (Participe passé accordé avec « attaque » (féminin singulier).)
UPDATE mode_hyper_effet SET effet = replace(effet, 'attaque subis', 'attaque subie') WHERE id = 'onglet_magie:magies/magie-de-leau:bi' AND instr(effet, 'attaque subis') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-leau:mono effet [grammaire] : « considérer comme » -> « considéré comme » (Après « est », participe passé et non infinitif.)
UPDATE mode_hyper_effet SET effet = replace(effet, 'considérer comme', 'considéré comme') WHERE id = 'onglet_magie:magies/magie-de-leau:mono' AND instr(effet, 'considérer comme') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-leau:mono effet [grammaire] : « attaque subis » -> « attaque subie » (Participe passé accordé avec « attaque » (féminin singulier).)
UPDATE mode_hyper_effet SET effet = replace(effet, 'attaque subis', 'attaque subie') WHERE id = 'onglet_magie:magies/magie-de-leau:mono' AND instr(effet, 'attaque subis') > 0;
-- sort magies/magie-de-leau#sort:mucus-protecteur effets [grammaire] : « dégâts magique. » -> « dégâts magiques. » (Accord au pluriel avec « dégâts ».)
UPDATE sort SET effets = replace(effets, 'dégâts magique.', 'dégâts magiques.') WHERE id = 'magies/magie-de-leau#sort:mucus-protecteur' AND instr(effets, 'dégâts magique.') > 0;
-- sort magies/magie-de-leau#sort:fer-humide dsb_brut [ponctuation] : « ,+8 dégâts » -> « +8 dégâts » (Virgule parasite en début de cellule (le sort jumeau Fer froid porte « +8 dégâts »).)
UPDATE sort SET dsb_brut = replace(dsb_brut, ',+8 dégâts', '+8 dégâts') WHERE id = 'magies/magie-de-leau#sort:fer-humide' AND instr(dsb_brut, ',+8 dégâts') > 0;
-- sort magies/magie-de-leau#sort:barriere-deau portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-leau#sort:barriere-deau' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-leau#sort:ruisseau-conciliant portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-leau#sort:ruisseau-conciliant' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-leau#sort:trombe-deau effets [grammaire] : « urne rempli » -> « urne remplie » (Participe passé accordé avec « urne » (féminin).)
UPDATE sort SET effets = replace(effets, 'urne rempli', 'urne remplie') WHERE id = 'magies/magie-de-leau#sort:trombe-deau' AND instr(effets, 'urne rempli') > 0;
-- sort magies/magie-de-leau#sort:lame-sous-pression effets [grammaire] : « lame fait d'eau » -> « lame faite d'eau » (Participe passé accordé avec « lame » (féminin).)
UPDATE sort SET effets = replace(effets, 'lame fait d''eau', 'lame faite d''eau') WHERE id = 'magies/magie-de-leau#sort:lame-sous-pression' AND instr(effets, 'lame fait d''eau') > 0;
-- sort magies/magie-de-leau#sort:courant-salvateur effets [frappe] : « cilbes dessus » -> « cibles dessus » (Lettres permutées : « cibles ».)
UPDATE sort SET effets = replace(effets, 'cilbes dessus', 'cibles dessus') WHERE id = 'magies/magie-de-leau#sort:courant-salvateur' AND instr(effets, 'cilbes dessus') > 0;
-- sort magies/magie-de-leau#sort:courant-salvateur effets [grammaire] : « direction décidé par » -> « direction décidée par » (Participe passé accordé avec « direction » (féminin).)
UPDATE sort SET effets = replace(effets, 'direction décidé par', 'direction décidée par') WHERE id = 'magies/magie-de-leau#sort:courant-salvateur' AND instr(effets, 'direction décidé par') > 0;
-- sort magies/magie-de-leau#sort:eau-parfaite effets [grammaire] : « les altération » -> « les altérations » (Pluriel après « toutes les ».)
UPDATE sort SET effets = replace(effets, 'les altération', 'les altérations') WHERE id = 'magies/magie-de-leau#sort:eau-parfaite' AND instr(effets, 'les altération') > 0;
-- sort magies/magie-de-leau#sort:eau-parfaite effets [grammaire] : « lié à des éléments » -> « liées à des éléments » (Accord avec « altérations » (féminin pluriel).)
UPDATE sort SET effets = replace(effets, 'lié à des éléments', 'liées à des éléments') WHERE id = 'magies/magie-de-leau#sort:eau-parfaite' AND instr(effets, 'lié à des éléments') > 0;
-- sort magies/magie-de-leau#sort:dissolution portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-leau#sort:dissolution' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-leau#sort:dissolution effets [orthographe] : « Si il est fait » -> « S'il est fait » (Élision obligatoire de « si » devant « il ».)
UPDATE sort SET effets = replace(effets, 'Si il est fait', 'S''il est fait') WHERE id = 'magies/magie-de-leau#sort:dissolution' AND instr(effets, 'Si il est fait') > 0;
-- sort magies/magie-de-leau#sort:dissolution effets [casse] : « eau. dure 3 tours » -> « eau. Dure 3 tours » (Majuscule en début de phrase, après un point.)
UPDATE sort SET effets = replace(effets, 'eau. dure 3 tours', 'eau. Dure 3 tours') WHERE id = 'magies/magie-de-leau#sort:dissolution' AND instr(effets, 'eau. dure 3 tours') > 0;
-- sort magies/magie-de-leau#sort:dissolution remarque [casse] : « totalement insensible aux » -> « Totalement insensible aux » (Majuscule en début de texte.)
UPDATE sort SET remarque = replace(remarque, 'totalement insensible aux', 'Totalement insensible aux') WHERE id = 'magies/magie-de-leau#sort:dissolution' AND instr(remarque, 'totalement insensible aux') > 0;
-- sort magies/magie-de-leau#sort:dissolution remarque [grammaire] : « bénéficié d'une » -> « bénéficier d'une » (Infinitif après « de » (participe passé employé à tort).)
UPDATE sort SET remarque = replace(remarque, 'bénéficié d''une', 'bénéficier d''une') WHERE id = 'magies/magie-de-leau#sort:dissolution' AND instr(remarque, 'bénéficié d''une') > 0;
-- sort magies/magie-de-leau#sort:crachin effets [orthographe] : « dilluvienne » -> « diluvienne » (« diluvienne » s'écrit avec un seul l après le u.)
UPDATE sort SET effets = replace(effets, 'dilluvienne', 'diluvienne') WHERE id = 'magies/magie-de-leau#sort:crachin' AND instr(effets, 'dilluvienne') > 0;
-- sort magies/magie-de-leau#sort:cascade-apaisante effets [grammaire] : « santé récupéré par » -> « santé récupérée par » (Participe passé accordé avec « santé » (féminin).)
UPDATE sort SET effets = replace(effets, 'santé récupéré par', 'santé récupérée par') WHERE id = 'magies/magie-de-leau#sort:cascade-apaisante' AND instr(effets, 'santé récupéré par') > 0;
-- sort magies/magie-de-leau#sort:laser-hydraulique effets [accent] : « reflèxe » -> « réflexe » (« réflexe » : accent aigu sur le premier e.)
UPDATE sort SET effets = replace(effets, 'reflèxe', 'réflexe') WHERE id = 'magies/magie-de-leau#sort:laser-hydraulique' AND instr(effets, 'reflèxe') > 0;
-- sort magies/magie-de-leau#sort:larmes-doceane portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-leau#sort:larmes-doceane' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-leau#sort:larmes-doceane effets [espace] : « Empêche  les » -> « Empêche les » (Espace double.)
UPDATE sort SET effets = replace(effets, 'Empêche  les', 'Empêche les') WHERE id = 'magies/magie-de-leau#sort:larmes-doceane' AND instr(effets, 'Empêche  les') > 0;
-- sort magies/magie-de-leau#sort:larmes-doceane effets [grammaire] : « Sort Feu » -> « Sorts Feu » (Pluriel après l'article « les ».)
UPDATE sort SET effets = replace(effets, 'Sort Feu', 'Sorts Feu') WHERE id = 'magies/magie-de-leau#sort:larmes-doceane' AND instr(effets, 'Sort Feu') > 0;
-- sort magies/magie-de-leau#sort:larmes-doceane effets [grammaire] : « d'être utilisé le » -> « d'être utilisés le » (Accord avec « Sorts » (masculin pluriel).)
UPDATE sort SET effets = replace(effets, 'd''être utilisé le', 'd''être utilisés le') WHERE id = 'magies/magie-de-leau#sort:larmes-doceane' AND instr(effets, 'd''être utilisé le') > 0;
-- sort magies/magie-de-leau#sort:larmes-doceane remarque [grammaire] : « peux pas être » -> « peut pas être » (Le sujet « Cette météo » est à la 3e personne du singulier.)
UPDATE sort SET remarque = replace(remarque, 'peux pas être', 'peut pas être') WHERE id = 'magies/magie-de-leau#sort:larmes-doceane' AND instr(remarque, 'peux pas être') > 0;
-- sort magies/magie-de-leau#sort:larmes-doceane remarque [grammaire] : « retirer par les » -> « retirée par les » (Participe passé accordé avec « météo » (féminin) après « être ».)
UPDATE sort SET remarque = replace(remarque, 'retirer par les', 'retirée par les') WHERE id = 'magies/magie-de-leau#sort:larmes-doceane' AND instr(remarque, 'retirer par les') > 0;
-- sort magies/magie-de-leau#sort:larmes-doceane remarque [grammaire] : « peux pas contrer » -> « peut pas contrer » (Le sujet « Le Don » est à la 3e personne du singulier.)
UPDATE sort SET remarque = replace(remarque, 'peux pas contrer', 'peut pas contrer') WHERE id = 'magies/magie-de-leau#sort:larmes-doceane' AND instr(remarque, 'peux pas contrer') > 0;
-- sort magies/magie-de-leau#sort:pitie-doceane effets [grammaire] : « de ranimé un » -> « de ranimer un » (Infinitif après « Permet de ».)
UPDATE sort SET effets = replace(effets, 'de ranimé un', 'de ranimer un') WHERE id = 'magies/magie-de-leau#sort:pitie-doceane' AND instr(effets, 'de ranimé un') > 0;
-- magie magies/magie-de-la-glace description_physique [grammaire] : « membres où les zones » -> « membres ou les zones » (« ou » (alternative) et non « où » (lieu).)
UPDATE magie SET description_physique = replace(description_physique, 'membres où les zones', 'membres ou les zones') WHERE id = 'magies/magie-de-la-glace' AND instr(description_physique, 'membres où les zones') > 0;
-- magie_role magies/magie-de-la-glace#role:3 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe, y compris en capitales.)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-de-la-glace' AND rang = 3 AND instr(role_brut, 'DÉGATS') > 0;
-- sort magies/magie-de-la-glace#sort:sculpteur-glace portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-glace#sort:sculpteur-glace' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-glace#sort:fer-froid effets [grammaire] : « 3 tour. » -> « 3 tours. » (Pluriel après un nombre supérieur à 1.)
UPDATE sort SET effets = replace(effets, '3 tour.', '3 tours.') WHERE id = 'magies/magie-de-la-glace#sort:fer-froid' AND instr(effets, '3 tour.') > 0;
-- sort magies/magie-de-la-glace#sort:cerveau-gele effets [accent] : « a tout test » -> « à tout test » (Préposition « à » (et non le verbe avoir).)
UPDATE sort SET effets = replace(effets, 'a tout test', 'à tout test') WHERE id = 'magies/magie-de-la-glace#sort:cerveau-gele' AND instr(effets, 'a tout test') > 0;
-- sort magies/magie-de-la-glace#sort:lien-de-gel effets [orthographe] : « cases autours » -> « cases autour » (« autour » est invariable.)
UPDATE sort SET effets = replace(effets, 'cases autours', 'cases autour') WHERE id = 'magies/magie-de-la-glace#sort:lien-de-gel' AND instr(effets, 'cases autours') > 0;
-- sort magies/magie-de-la-glace#sort:lien-de-gel remarque [grammaire] : « adversaires disponible. » -> « adversaires disponibles. » (Accord au pluriel avec « adversaires ».)
UPDATE sort SET remarque = replace(remarque, 'adversaires disponible.', 'adversaires disponibles.') WHERE id = 'magies/magie-de-la-glace#sort:lien-de-gel' AND instr(remarque, 'adversaires disponible.') > 0;
-- sort magies/magie-de-la-glace#sort:lien-de-gel remarque [grammaire] : « ainsi libérer mais » -> « ainsi libérée mais » (Participe passé accordé avec « cible » (féminin) après « est ».)
UPDATE sort SET remarque = replace(remarque, 'ainsi libérer mais', 'ainsi libérée mais') WHERE id = 'magies/magie-de-la-glace#sort:lien-de-gel' AND instr(remarque, 'ainsi libérer mais') > 0;
-- sort magies/magie-de-la-glace#sort:cuirasse-arctique effets [orthographe] : « Peau Verglacé » -> « Peau Verglacée » (Renvoie au sort « Peau verglacée » (accord au féminin, e manquant).)
UPDATE sort SET effets = replace(effets, 'Peau Verglacé', 'Peau Verglacée') WHERE id = 'magies/magie-de-la-glace#sort:cuirasse-arctique' AND instr(effets, 'Peau Verglacé') > 0;
-- sort magies/magie-de-la-glace#sort:avalanche effets [grammaire] : « Inflige de dégâts » -> « Inflige des dégâts » (Article « des » devant « dégâts » (lettre manquante).)
UPDATE sort SET effets = replace(effets, 'Inflige de dégâts', 'Inflige des dégâts') WHERE id = 'magies/magie-de-la-glace#sort:avalanche' AND instr(effets, 'Inflige de dégâts') > 0;
-- sort magies/magie-de-la-glace#sort:stalactite effets [grammaire] : « Envoi un gros » -> « Envoie un gros » (Verbe conjugué à la 3e personne du singulier (comme « Envoie une lance » ailleurs).)
UPDATE sort SET effets = replace(effets, 'Envoi un gros', 'Envoie un gros') WHERE id = 'magies/magie-de-la-glace#sort:stalactite' AND instr(effets, 'Envoi un gros') > 0;
-- sort magies/magie-de-la-glace#sort:gel-profond remarque [casse] : « l'allié sera » -> « L'allié sera » (Majuscule en début de texte.)
UPDATE sort SET remarque = replace(remarque, 'l''allié sera', 'L''allié sera') WHERE id = 'magies/magie-de-la-glace#sort:gel-profond' AND instr(remarque, 'l''allié sera') > 0;
-- sort magies/magie-de-la-glace#sort:cape-hivernale dsb_brut [grammaire] : « dégâts magique » -> « dégâts magiques » (Accord au pluriel avec « dégâts ».)
UPDATE sort SET dsb_brut = replace(dsb_brut, 'dégâts magique', 'dégâts magiques') WHERE id = 'magies/magie-de-la-glace#sort:cape-hivernale' AND instr(dsb_brut, 'dégâts magique') > 0;
-- sort magies/magie-de-la-glace#sort:frappe-de-celsius texte_niveau5 [frappe] : « froid brise tout » -> « froid briser tout » (Après « puisse », infinitif (r final manquant).)
UPDATE sort SET texte_niveau5 = replace(texte_niveau5, 'froid brise tout', 'froid briser tout') WHERE id = 'magies/magie-de-la-glace#sort:frappe-de-celsius' AND instr(texte_niveau5, 'froid brise tout') > 0;
-- sort magies/magie-de-la-glace#sort:execution-froide texte_niveau5 [frappe] : « Celsius l’emporte sans » -> « Celsius l’emporter sans » (Après « puisse », infinitif (r final manquant).)
UPDATE sort SET texte_niveau5 = replace(texte_niveau5, 'Celsius l’emporte sans', 'Celsius l’emporter sans') WHERE id = 'magies/magie-de-la-glace#sort:execution-froide' AND instr(texte_niveau5, 'Celsius l’emporte sans') > 0;
-- sort magies/magie-de-la-glace#sort:execution-froide remarque [grammaire] : « victime ne peux rien » -> « victime ne peut rien » (Le sujet « La victime » est à la 3e personne du singulier.)
UPDATE sort SET remarque = replace(remarque, 'victime ne peux rien', 'victime ne peut rien') WHERE id = 'magies/magie-de-la-glace#sort:execution-froide' AND instr(remarque, 'victime ne peux rien') > 0;
-- sort magies/magie-de-la-glace#sort:execution-froide remarque [accent] : « faut a tout prix » -> « faut à tout prix » (Locution « à tout prix » (préposition).)
UPDATE sort SET remarque = replace(remarque, 'faut a tout prix', 'faut à tout prix') WHERE id = 'magies/magie-de-la-glace#sort:execution-froide' AND instr(remarque, 'faut a tout prix') > 0;
-- sort magies/magie-de-la-glace#sort:execution-froide remarque [espace] : « interrompu. ⏎Dans » -> « interrompu.⏎Dans » (Espace superflue en fin de ligne, avant le retour à la ligne.)
UPDATE sort SET remarque = replace(remarque, 'interrompu. 
Dans', 'interrompu.
Dans') WHERE id = 'magies/magie-de-la-glace#sort:execution-froide' AND instr(remarque, 'interrompu. 
Dans') > 0;
-- sort magies/magie-de-la-glace#sort:execution-froide remarque [frappe] : « ect... » -> « etc... » (Lettres permutées : « etc. ».)
UPDATE sort SET remarque = replace(remarque, 'ect...', 'etc...') WHERE id = 'magies/magie-de-la-glace#sort:execution-froide' AND instr(remarque, 'ect...') > 0;
-- sort magies/magie-de-la-glace#sort:execution-froide remarque [grammaire] : « à le choix » -> « a le choix » (Verbe « avoir » (« le MJ a le choix »), pas la préposition.)
UPDATE sort SET remarque = replace(remarque, 'à le choix', 'a le choix') WHERE id = 'magies/magie-de-la-glace#sort:execution-froide' AND instr(remarque, 'à le choix') > 0;
-- sort magies/magie-de-la-glace#sort:execution-froide remarque [frappe] : « du cerceuil » -> « du cercueil » (Lettres permutées : « cercueil » (bien écrit dans le texte de niveau 5).)
UPDATE sort SET remarque = replace(remarque, 'du cerceuil', 'du cercueil') WHERE id = 'magies/magie-de-la-glace#sort:execution-froide' AND instr(remarque, 'du cerceuil') > 0;
-- sort magies/magie-de-la-glace#sort:rayon-polaire texte_niveau5 [frappe] : « Sa volonté condense » -> « Sa volonté condenser » (Après « Puisse », infinitif (r final manquant).)
UPDATE sort SET texte_niveau5 = replace(texte_niveau5, 'Sa volonté condense', 'Sa volonté condenser') WHERE id = 'magies/magie-de-la-glace#sort:rayon-polaire' AND instr(texte_niveau5, 'Sa volonté condense') > 0;
-- sort magies/magie-de-la-glace#sort:rayon-polaire texte_niveau5 [frappe] : « polaire emprisonne tout » -> « polaire emprisonner tout » (Après « Puisse », infinitif (r final manquant).)
UPDATE sort SET texte_niveau5 = replace(texte_niveau5, 'polaire emprisonne tout', 'polaire emprisonner tout') WHERE id = 'magies/magie-de-la-glace#sort:rayon-polaire' AND instr(texte_niveau5, 'polaire emprisonne tout') > 0;
-- sort magies/magie-de-leau#sort:crachin portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-leau#sort:crachin' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-glace#sort:danse-de-celsius portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union dans « soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-glace#sort:danse-de-celsius' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-glace#sort:pergelisol dsb_brut [grammaire] : « +2 cran de » -> « +2 crans de » (Pluriel après un nombre supérieur à 1.)
UPDATE sort SET dsb_brut = replace(dsb_brut, '+2 cran de', '+2 crans de') WHERE id = 'magies/magie-de-la-glace#sort:pergelisol' AND instr(dsb_brut, '+2 cran de') > 0;
-- magie magies/magie-de-la-terre description [ponctuation] : « devant eux.. » -> « devant eux. » (Point final doublé en fin de texte.)
UPDATE magie SET description = replace(description, 'devant eux..', 'devant eux.') WHERE id = 'magies/magie-de-la-terre' AND instr(description, 'devant eux..') > 0;
-- magie magies/magie-de-la-terre description_physique [grammaire] : « de léger renforts » -> « de légers renforts » (Accord de l'adjectif avec « renforts » (pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'de léger renforts', 'de légers renforts') WHERE id = 'magies/magie-de-la-terre' AND instr(description_physique, 'de léger renforts') > 0;
-- magie_role magies/magie-de-la-terre#role:2 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe sur le a (convention commune).)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-de-la-terre' AND rang = 2 AND instr(role_brut, 'DÉGATS') > 0;
-- sort magies/magie-de-la-terre#sort:tremblement effets [accent] : « Réflèxe » -> « Réflexe » (« Réflexe » s'écrit avec é (cf. « stabilité/Réflexe » dans la magie du vent).)
UPDATE sort SET effets = replace(effets, 'Réflèxe', 'Réflexe') WHERE id = 'magies/magie-de-la-terre#sort:tremblement' AND instr(effets, 'Réflèxe') > 0;
-- sort magies/magie-de-la-terre#sort:appel-aux-golems effets [grammaire] : « et aux invocation. » -> « et aux invocations. » (Pluriel après « aux » (familiers et invocations).)
UPDATE sort SET effets = replace(effets, 'et aux invocation.', 'et aux invocations.') WHERE id = 'magies/magie-de-la-terre#sort:appel-aux-golems' AND instr(effets, 'et aux invocation.') > 0;
-- sort magies/magie-de-la-terre#sort:appel-aux-golems remarque [grammaire] : « golems possible » -> « golems possibles » (Accord avec « golems » (pluriel).)
UPDATE sort SET remarque = replace(remarque, 'golems possible', 'golems possibles') WHERE id = 'magies/magie-de-la-terre#sort:appel-aux-golems' AND instr(remarque, 'golems possible') > 0;
-- sort magies/magie-de-la-terre#sort:appel-aux-golems remarque [grammaire] : « créature invoqué double » -> « créature invoquée double » (Participe passé accordé avec « créature » (féminin).)
UPDATE sort SET remarque = replace(remarque, 'créature invoqué double', 'créature invoquée double') WHERE id = 'magies/magie-de-la-terre#sort:appel-aux-golems' AND instr(remarque, 'créature invoqué double') > 0;
-- sort magies/magie-de-la-terre#sort:racine-soignante effets [grammaire] : « environnement liée à » -> « environnement lié à » (« environnement » est masculin : « lié ».)
UPDATE sort SET effets = replace(effets, 'environnement liée à', 'environnement lié à') WHERE id = 'magies/magie-de-la-terre#sort:racine-soignante' AND instr(effets, 'environnement liée à') > 0;
-- sort magies/magie-de-la-terre#sort:arbre-fertilisant effets [grammaire] : « alliés a 3 cases » -> « alliés à 3 cases » (Préposition « à » (et non le verbe avoir).)
UPDATE sort SET effets = replace(effets, 'alliés a 3 cases', 'alliés à 3 cases') WHERE id = 'magies/magie-de-la-terre#sort:arbre-fertilisant' AND instr(effets, 'alliés a 3 cases') > 0;
-- sort magies/magie-de-la-terre#sort:infection effets [grammaire] : « pas élémentaire. » -> « pas élémentaires. » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET effets = replace(effets, 'pas élémentaire.', 'pas élémentaires.') WHERE id = 'magies/magie-de-la-terre#sort:infection' AND instr(effets, 'pas élémentaire.') > 0;
-- sort magies/magie-de-la-terre#sort:infection remarque [grammaire] : « pas élémentaire » -> « pas élémentaires » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET remarque = replace(remarque, 'pas élémentaire', 'pas élémentaires') WHERE id = 'magies/magie-de-la-terre#sort:infection' AND instr(remarque, 'pas élémentaire') > 0;
-- sort magies/magie-de-la-terre#sort:barriere-rocheuse effets [ponctuation] : « par dessus la » -> « par-dessus la » (« par-dessus » prend un trait d'union.)
UPDATE sort SET effets = replace(effets, 'par dessus la', 'par-dessus la') WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse' AND instr(effets, 'par dessus la') > 0;
-- sort magies/magie-de-la-terre#sort:barriere-rocheuse effets [grammaire] : « coups inférieur à » -> « coups inférieurs à » (Accord avec « coups » (pluriel).)
UPDATE sort SET effets = replace(effets, 'coups inférieur à', 'coups inférieurs à') WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse' AND instr(effets, 'coups inférieur à') > 0;
-- sort magies/magie-de-la-terre#sort:barriere-rocheuse remarque [grammaire] : « pour la brisé » -> « pour la briser » (Infinitif après « pour ».)
UPDATE sort SET remarque = replace(remarque, 'pour la brisé', 'pour la briser') WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse' AND instr(remarque, 'pour la brisé') > 0;
-- sort magies/magie-de-la-terre#sort:barriere-rocheuse remarque [grammaire] : « protection est brisé et » -> « protection est brisée et » (Participe accordé avec « la protection » (féminin).)
UPDATE sort SET remarque = replace(remarque, 'protection est brisé et', 'protection est brisée et') WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse' AND instr(remarque, 'protection est brisé et') > 0;
-- sort magies/magie-de-la-terre#sort:barriere-rocheuse remarque [grammaire] : « coup est encaisser. » -> « coup est encaissée. » (Participe passé (et non infinitif), accordé avec le sujet « l'intégralité » (féminin).)
UPDATE sort SET remarque = replace(remarque, 'coup est encaisser.', 'coup est encaissée.') WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse' AND instr(remarque, 'coup est encaisser.') > 0;
-- sort magies/magie-de-la-terre#sort:barriere-rocheuse remarque [grammaire] : « AP ne sont pas compté » -> « AP ne sont pas comptées » (Sujet pluriel « Les AP » (armure physique, féminin) : participe accordé.)
UPDATE sort SET remarque = replace(remarque, 'AP ne sont pas compté', 'AP ne sont pas comptées') WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse' AND instr(remarque, 'AP ne sont pas compté') > 0;
-- sort magies/magie-de-la-terre#sort:barriere-rocheuse remarque [grammaire] : « dégâts sont fait à » -> « dégâts sont faits à » (Accord avec « dégâts » (masculin pluriel).)
UPDATE sort SET remarque = replace(remarque, 'dégâts sont fait à', 'dégâts sont faits à') WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse' AND instr(remarque, 'dégâts sont fait à') > 0;
-- sort magies/magie-de-la-terre#sort:alourdissement effets [frappe] : « plus loude » -> « plus lourde » (Lettre manquante : « lourde » (accord avec « l'arme »).)
UPDATE sort SET effets = replace(effets, 'plus loude', 'plus lourde') WHERE id = 'magies/magie-de-la-terre#sort:alourdissement' AND instr(effets, 'plus loude') > 0;
-- sort magies/magie-de-la-terre#sort:alourdissement remarque [casse] : « équivalent à » -> « Équivalent à » (Majuscule en début de phrase.)
UPDATE sort SET remarque = replace(remarque, 'équivalent à', 'Équivalent à') WHERE id = 'magies/magie-de-la-terre#sort:alourdissement' AND instr(remarque, 'équivalent à') > 0;
-- sort magies/magie-de-la-terre#sort:frappe-racine remarque [grammaire] : « tout autre surface » -> « toute autre surface » (Accord avec « surface » (féminin).)
UPDATE sort SET remarque = replace(remarque, 'tout autre surface', 'toute autre surface') WHERE id = 'magies/magie-de-la-terre#sort:frappe-racine' AND instr(remarque, 'tout autre surface') > 0;
-- sort magies/magie-de-la-terre#sort:enracinement portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-terre#sort:enracinement' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-terre#sort:enracinement effets [grammaire] : « prenne 5 dégâts » -> « prennent 5 dégâts » (Le sujet est « Les ennemis » (pluriel).)
UPDATE sort SET effets = replace(effets, 'prenne 5 dégâts', 'prennent 5 dégâts') WHERE id = 'magies/magie-de-la-terre#sort:enracinement' AND instr(effets, 'prenne 5 dégâts') > 0;
-- sort magies/magie-de-la-terre#sort:enracinement effets [espace] : « la zone.  Le sort » -> « la zone. Le sort » (Espace double après le point.)
UPDATE sort SET effets = replace(effets, 'la zone.  Le sort', 'la zone. Le sort') WHERE id = 'magies/magie-de-la-terre#sort:enracinement' AND instr(effets, 'la zone.  Le sort') > 0;
-- sort magies/magie-de-la-terre#sort:grenade-petrifiante effets [espace] : « Terre.  (3NM » -> « Terre. (3NM » (Espace double après le point.)
UPDATE sort SET effets = replace(effets, 'Terre.  (3NM', 'Terre. (3NM') WHERE id = 'magies/magie-de-la-terre#sort:grenade-petrifiante' AND instr(effets, 'Terre.  (3NM') > 0;
-- sort magies/magie-de-la-terre#sort:redemption-de-dimitri portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-terre#sort:redemption-de-dimitri' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-terre#sort:floraison-salvatrice effets [grammaire] : « santé récupéré par » -> « santé récupérée par » (Participe accordé avec « la santé » (féminin).)
UPDATE sort SET effets = replace(effets, 'santé récupéré par', 'santé récupérée par') WHERE id = 'magies/magie-de-la-terre#sort:floraison-salvatrice' AND instr(effets, 'santé récupéré par') > 0;
-- sort magies/magie-de-la-terre#sort:morsure-terrestre effets [grammaire] : « de terrible dégâts » -> « de terribles dégâts » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET effets = replace(effets, 'de terrible dégâts', 'de terribles dégâts') WHERE id = 'magies/magie-de-la-terre#sort:morsure-terrestre' AND instr(effets, 'de terrible dégâts') > 0;
-- sort magies/magie-de-la-terre#sort:corps-de-maverium portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-terre#sort:corps-de-maverium texte_niveau5 [grammaire] : « nul magie » -> « nulle magie » (« magie » est féminin : « nulle ».)
UPDATE sort SET texte_niveau5 = replace(texte_niveau5, 'nul magie', 'nulle magie') WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND instr(texte_niveau5, 'nul magie') > 0;
-- sort magies/magie-de-la-terre#sort:corps-de-maverium remarque [grammaire] : « Tout les dégâts reçu sont réduit » -> « Tous les dégâts reçus sont réduits » (« Tous les » devant un pluriel masculin ; participes accordés avec « dégâts ».)
UPDATE sort SET remarque = replace(remarque, 'Tout les dégâts reçu sont réduit', 'Tous les dégâts reçus sont réduits') WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND instr(remarque, 'Tout les dégâts reçu sont réduit') > 0;
-- sort magies/magie-de-la-terre#sort:corps-de-maverium remarque [grammaire] : « protections ne fonctionne pas » -> « protections ne fonctionnent pas » (Le sujet est « les effets négatifs » (pluriel).)
UPDATE sort SET remarque = replace(remarque, 'protections ne fonctionne pas', 'protections ne fonctionnent pas') WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND instr(remarque, 'protections ne fonctionne pas') > 0;
-- sort magies/magie-de-la-terre#sort:corps-de-maverium remarque [frappe] : « Marverium » -> « Maverium » (Lettre en trop : le sort s'appelle « Corps de Maverium ».)
UPDATE sort SET remarque = replace(remarque, 'Marverium', 'Maverium') WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND instr(remarque, 'Marverium') > 0;
-- sort magies/magie-de-la-terre#sort:corps-de-maverium remarque [grammaire] : « tout les dégâts possible » -> « tous les dégâts possibles » (« Tous les » devant un pluriel masculin ; adjectif accordé avec « dégâts ».)
UPDATE sort SET remarque = replace(remarque, 'tout les dégâts possible', 'tous les dégâts possibles') WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND instr(remarque, 'tout les dégâts possible') > 0;
-- sort magies/magie-de-la-terre#sort:corps-de-maverium remarque [grammaire] : « tout les organes interne sont solidifié » -> « tous les organes internes sont solidifiés » (« Tous les » devant un pluriel masculin ; accords avec « organes ».)
UPDATE sort SET remarque = replace(remarque, 'tout les organes interne sont solidifié', 'tous les organes internes sont solidifiés') WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND instr(remarque, 'tout les organes interne sont solidifié') > 0;
-- sort magies/magie-de-la-terre#sort:corps-de-maverium remarque [grammaire] : « ne fonctionne pas temporairement » -> « ne fonctionnent pas temporairement » (Le sujet est « les organes internes » (pluriel).)
UPDATE sort SET remarque = replace(remarque, 'ne fonctionne pas temporairement', 'ne fonctionnent pas temporairement') WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND instr(remarque, 'ne fonctionne pas temporairement') > 0;
-- magie magies/magie-du-vent description_physique [grammaire] : « cheveux mi-long, » -> « cheveux mi-longs, » (Accord avec « cheveux » (pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'cheveux mi-long,', 'cheveux mi-longs,') WHERE id = 'magies/magie-du-vent' AND instr(description_physique, 'cheveux mi-long,') > 0;
-- magie magies/magie-du-vent description_physique [espace] : « visibleà » -> « visible à » (Espace manquante entre « visible » et « à ».)
UPDATE magie SET description_physique = replace(description_physique, 'visibleà', 'visible à') WHERE id = 'magies/magie-du-vent' AND instr(description_physique, 'visibleà') > 0;
-- magie magies/magie-du-vent description_physique [orthographe] : « l'oeil » -> « l'œil » (Ligature œ obligatoire dans « œil ».)
UPDATE magie SET description_physique = replace(description_physique, 'l''oeil', 'l''œil') WHERE id = 'magies/magie-du-vent' AND instr(description_physique, 'l''oeil') > 0;
-- magie magies/magie-du-vent description_physique [grammaire] : « nue est » -> « nu est » (« à l'œil nu » : « œil » est masculin.)
UPDATE magie SET description_physique = replace(description_physique, 'nue est', 'nu est') WHERE id = 'magies/magie-du-vent' AND instr(description_physique, 'nue est') > 0;
-- magie_role magies/magie-du-vent#role:2 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe sur le a (convention commune).)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-du-vent' AND rang = 2 AND instr(role_brut, 'DÉGATS') > 0;
-- sort magies/magie-du-vent#sort:vents-murmures effets [grammaire] : « Envoi un » -> « Envoie un » (Verbe « envoyer » conjugué à la 3e personne du présent.)
UPDATE sort SET effets = replace(effets, 'Envoi un', 'Envoie un') WHERE id = 'magies/magie-du-vent#sort:vents-murmures' AND instr(effets, 'Envoi un') > 0;
-- sort magies/magie-du-vent#sort:force-agile portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vent#sort:force-agile' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-vent#sort:cri-faible dsb_brut [grammaire] : « dégâts sonore » -> « dégâts sonores » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET dsb_brut = replace(dsb_brut, 'dégâts sonore', 'dégâts sonores') WHERE id = 'magies/magie-du-vent#sort:cri-faible' AND instr(dsb_brut, 'dégâts sonore') > 0;
-- sort magies/magie-du-vent#sort:cri-faible effets [frappe] : « Inflge surdité » -> « Inflige surdité » (Lettre manquante dans « Inflige ».)
UPDATE sort SET effets = replace(effets, 'Inflge surdité', 'Inflige surdité') WHERE id = 'magies/magie-du-vent#sort:cri-faible' AND instr(effets, 'Inflge surdité') > 0;
-- sort magies/magie-du-vent#sort:eternuement effets [orthographe] : « Éternu fort » -> « Éternue fort » (Verbe « éternuer » à la 3e personne du présent (même tournure que « Frappe le sol »).)
UPDATE sort SET effets = replace(effets, 'Éternu fort', 'Éternue fort') WHERE id = 'magies/magie-du-vent#sort:eternuement' AND instr(effets, 'Éternu fort') > 0;
-- sort magies/magie-du-vent#sort:eternuement effets [grammaire] : « faire reculé d'une » -> « faire reculer d'une » (Infinitif après « faire ».)
UPDATE sort SET effets = replace(effets, 'faire reculé d''une', 'faire reculer d''une') WHERE id = 'magies/magie-du-vent#sort:eternuement' AND instr(effets, 'faire reculé d''une') > 0;
-- sort magies/magie-du-vent#sort:recul-force effets [grammaire] : « Fait reculé la » -> « Fait reculer la » (Infinitif après « faire ».)
UPDATE sort SET effets = replace(effets, 'Fait reculé la', 'Fait reculer la') WHERE id = 'magies/magie-du-vent#sort:recul-force' AND instr(effets, 'Fait reculé la') > 0;
-- sort magies/magie-du-vent#sort:tornade remarque [grammaire] : « Réussir a sortir » -> « Réussir à sortir » (Préposition « à » (et non le verbe avoir).)
UPDATE sort SET remarque = replace(remarque, 'Réussir a sortir', 'Réussir à sortir') WHERE id = 'magies/magie-du-vent#sort:tornade' AND instr(remarque, 'Réussir a sortir') > 0;
-- sort magies/magie-du-vent#sort:tornade remarque [grammaire] : « pas réussir a sortir » -> « pas réussir à sortir » (Préposition « à » (et non le verbe avoir).)
UPDATE sort SET remarque = replace(remarque, 'pas réussir a sortir', 'pas réussir à sortir') WHERE id = 'magies/magie-du-vent#sort:tornade' AND instr(remarque, 'pas réussir a sortir') > 0;
-- sort magies/magie-du-vent#sort:grenade-explosive effets [grammaire] : « NM) supplémentaire en » -> « NM) supplémentaires en » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET effets = replace(effets, 'NM) supplémentaire en', 'NM) supplémentaires en') WHERE id = 'magies/magie-du-vent#sort:grenade-explosive' AND instr(effets, 'NM) supplémentaire en') > 0;
-- sort magies/magie-du-vent#sort:vibration portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vent#sort:vibration' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-vent#sort:vibration dsb_brut [grammaire] : « dégâts sonore » -> « dégâts sonores » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET dsb_brut = replace(dsb_brut, 'dégâts sonore', 'dégâts sonores') WHERE id = 'magies/magie-du-vent#sort:vibration' AND instr(dsb_brut, 'dégâts sonore') > 0;
-- sort magies/magie-du-vent#sort:vibration effets [frappe] : « Inflge surdité 2 » -> « Inflige surdité 2 » (Lettre manquante dans « Inflige ».)
UPDATE sort SET effets = replace(effets, 'Inflge surdité 2', 'Inflige surdité 2') WHERE id = 'magies/magie-du-vent#sort:vibration' AND instr(effets, 'Inflge surdité 2') > 0;
-- sort magies/magie-du-vent#sort:vibration effets [casse] : « stabilité/Réflexe raté » -> « stabilité/réflexe raté » (Casse incohérente dans la même expression : « stabilité » est en minuscule, « Réflexe » devrait l'être aussi (comme « jet de réflexe/stabilité » du sort Désarmer).)
UPDATE sort SET effets = replace(effets, 'stabilité/Réflexe raté', 'stabilité/réflexe raté') WHERE id = 'magies/magie-du-vent#sort:vibration' AND instr(effets, 'stabilité/Réflexe raté') > 0;
-- sort magies/magie-du-vent#sort:tempete portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vent#sort:tempete' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-vent#sort:danse-de-lair portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vent#sort:danse-de-lair' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-vent#sort:explosif portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune « Soi-même »).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vent#sort:explosif' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-vent#sort:megaphone dsb_brut [grammaire] : « dégâts sonore » -> « dégâts sonores » (Accord avec « dégâts » (pluriel).)
UPDATE sort SET dsb_brut = replace(dsb_brut, 'dégâts sonore', 'dégâts sonores') WHERE id = 'magies/magie-du-vent#sort:megaphone' AND instr(dsb_brut, 'dégâts sonore') > 0;
-- sort magies/magie-de-la-terre#sort:tremblement type_brut [casse] : « (imparable) » -> « (Imparable) » (Forme majoritaire dans la colonne : « (Imparable) » avec majuscule (16 contre 3).)
UPDATE sort SET type_brut = replace(type_brut, '(imparable)', '(Imparable)') WHERE id = 'magies/magie-de-la-terre#sort:tremblement' AND instr(type_brut, '(imparable)') > 0;
-- sort magies/magie-du-vent#sort:propulsion effets [grammaire] : « 1 dégâts » -> « 1 dégât » (Singulier après le nombre 1.)
UPDATE sort SET effets = replace(effets, '1 dégâts', '1 dégât') WHERE id = 'magies/magie-du-vent#sort:propulsion' AND instr(effets, '1 dégâts') > 0;
-- sort magies/magie-du-vent#sort:tornade type_brut [casse] : « (inesquivable/ imparable) » -> « (Inesquivable/ Imparable) » (Forme majoritaire dans la colonne : « Inesquivable » et « Imparable » avec majuscule.)
UPDATE sort SET type_brut = replace(type_brut, '(inesquivable/ imparable)', '(Inesquivable/ Imparable)') WHERE id = 'magies/magie-du-vent#sort:tornade' AND instr(type_brut, '(inesquivable/ imparable)') > 0;
-- sort magies/magie-du-vent#sort:vibration type_brut [casse] : « (imparable) » -> « (Imparable) » (Forme majoritaire dans la colonne : « (Imparable) » avec majuscule.)
UPDATE sort SET type_brut = replace(type_brut, '(imparable)', '(Imparable)') WHERE id = 'magies/magie-du-vent#sort:vibration' AND instr(type_brut, '(imparable)') > 0;
-- sort magies/magie-du-vent#sort:danse-de-lair effets [grammaire] : « vaporeuse donc » -> « vaporeuses donc » (Accord avec « Les jambes » (féminin pluriel).)
UPDATE sort SET effets = replace(effets, 'vaporeuse donc', 'vaporeuses donc') WHERE id = 'magies/magie-du-vent#sort:danse-de-lair' AND instr(effets, 'vaporeuse donc') > 0;
-- sort magies/magie-du-vent#sort:danse-de-lair effets [grammaire] : « insensible aux attaques » -> « insensibles aux attaques » (Accord avec « Les jambes » (pluriel).)
UPDATE sort SET effets = replace(effets, 'insensible aux attaques', 'insensibles aux attaques') WHERE id = 'magies/magie-du-vent#sort:danse-de-lair' AND instr(effets, 'insensible aux attaques') > 0;
-- magie magies/magie-de-la-foudre description_physique [grammaire] : « électricité parcours » -> « électricité parcourt » (Verbe parcourir à la 3e personne du singulier : le sujet est « l’électricité ».)
UPDATE magie SET description_physique = replace(description_physique, 'électricité parcours', 'électricité parcourt') WHERE id = 'magies/magie-de-la-foudre' AND instr(description_physique, 'électricité parcours') > 0;
-- magie magies/magie-de-la-foudre description_physique [grammaire] : « très conducteurs se trouvent » -> « très conductrices se trouvent » (Accord avec « plaques » (féminin pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'très conducteurs se trouvent', 'très conductrices se trouvent') WHERE id = 'magies/magie-de-la-foudre' AND instr(description_physique, 'très conducteurs se trouvent') > 0;
-- magie magies/magie-de-la-foudre description_physique [casse] : « (Bras, jambes » -> « (bras, jambes » (Pas de majuscule en début d'énumération entre parenthèses (jambes, organes vitaux sont en minuscules).)
UPDATE magie SET description_physique = replace(description_physique, '(Bras, jambes', '(bras, jambes') WHERE id = 'magies/magie-de-la-foudre' AND instr(description_physique, '(Bras, jambes') > 0;
-- magie_role magies/magie-de-la-foudre#role:1 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe (convention commune).)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-de-la-foudre' AND rang = 1 AND instr(role_brut, 'DÉGATS') > 0;
-- sort magies/magie-de-la-foudre#sort:contact-de-volt effets [grammaire] : « par cible touché » -> « par cible touchée » (Accord au féminin avec « cible ».)
UPDATE sort SET effets = replace(effets, 'par cible touché', 'par cible touchée') WHERE id = 'magies/magie-de-la-foudre#sort:contact-de-volt' AND instr(effets, 'par cible touché') > 0;
-- sort magies/magie-de-la-foudre#sort:chargeur portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-foudre#sort:chargeur' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-foudre#sort:chargeur remarque [accent] : « Peut etre » -> « Peut être » (Accent circonflexe manquant sur « être ».)
UPDATE sort SET remarque = replace(remarque, 'Peut etre', 'Peut être') WHERE id = 'magies/magie-de-la-foudre#sort:chargeur' AND instr(remarque, 'Peut etre') > 0;
-- sort magies/magie-de-la-foudre#sort:chargeur remarque [grammaire] : « lancer 3 » -> « lancé 3 » (Participe passé après « peut être » (le sort est lancé), pas l'infinitif.)
UPDATE sort SET remarque = replace(remarque, 'lancer 3', 'lancé 3') WHERE id = 'magies/magie-de-la-foudre#sort:chargeur' AND instr(remarque, 'lancer 3') > 0;
-- sort magies/magie-de-la-foudre#sort:chargeur remarque [accent] : « le meme tour » -> « le même tour » (Accent circonflexe manquant sur « même ».)
UPDATE sort SET remarque = replace(remarque, 'le meme tour', 'le même tour') WHERE id = 'magies/magie-de-la-foudre#sort:chargeur' AND instr(remarque, 'le meme tour') > 0;
-- sort magies/magie-de-la-foudre#sort:boules-de-foudre effets [grammaire] : « le plus proches » -> « le plus proche » (Superlatif accordé avec « l'ennemi » (singulier).)
UPDATE sort SET effets = replace(effets, 'le plus proches', 'le plus proche') WHERE id = 'magies/magie-de-la-foudre#sort:boules-de-foudre' AND instr(effets, 'le plus proches') > 0;
-- sort magies/magie-de-la-foudre#sort:plaque-miroir effets [grammaire] : « 3 plaque miroir » -> « 3 plaques miroir » (Pluriel après un nombre supérieur à 1 (on ne touche pas à « miroir », voir a_valider).)
UPDATE sort SET effets = replace(effets, '3 plaque miroir', '3 plaques miroir') WHERE id = 'magies/magie-de-la-foudre#sort:plaque-miroir' AND instr(effets, '3 plaque miroir') > 0;
-- sort magies/magie-de-la-foudre#sort:plaque-miroir effets [grammaire] : « vont absorbé 3 » -> « vont absorber 3 » (Infinitif après « vont ».)
UPDATE sort SET effets = replace(effets, 'vont absorbé 3', 'vont absorber 3') WHERE id = 'magies/magie-de-la-foudre#sort:plaque-miroir' AND instr(effets, 'vont absorbé 3') > 0;
-- sort magies/magie-de-la-foudre#sort:plaque-miroir effets [grammaire] : « le vise » -> « le visent » (Le sujet de « visent » est « sorts » (pluriel) ; le pronom « le » n'est pas touché.)
UPDATE sort SET effets = replace(effets, 'le vise', 'le visent') WHERE id = 'magies/magie-de-la-foudre#sort:plaque-miroir' AND instr(effets, 'le vise') > 0;
-- sort magies/magie-de-la-foudre#sort:dysfonctionnement effets [grammaire] : « dites mécanique » -> « dite mécanique » (Accord au singulier avec « créature ».)
UPDATE sort SET effets = replace(effets, 'dites mécanique', 'dite mécanique') WHERE id = 'magies/magie-de-la-foudre#sort:dysfonctionnement' AND instr(effets, 'dites mécanique') > 0;
-- sort magies/magie-de-la-foudre#sort:dysfonctionnement remarque [grammaire] : « Confusion 3" pour les créature » -> « Confusion 3" pour les créatures » (Pluriel après « les » (accord avec « mécaniques »).)
UPDATE sort SET remarque = replace(remarque, 'Confusion 3" pour les créature', 'Confusion 3" pour les créatures') WHERE id = 'magies/magie-de-la-foudre#sort:dysfonctionnement' AND instr(remarque, 'Confusion 3" pour les créature') > 0;
-- sort magies/magie-de-la-foudre#sort:dysfonctionnement remarque [grammaire] : « Confus" pour les créature » -> « Confus" pour les créatures » (Pluriel après « les » (accord avec « mécaniques »).)
UPDATE sort SET remarque = replace(remarque, 'Confus" pour les créature', 'Confus" pour les créatures') WHERE id = 'magies/magie-de-la-foudre#sort:dysfonctionnement' AND instr(remarque, 'Confus" pour les créature') > 0;
-- sort magies/magie-de-la-foudre#sort:eclair-en-chaine effets [grammaire] : « ses dégâts se divise » -> « ses dégâts se divisent » (Le sujet « ses dégâts » est au pluriel.)
UPDATE sort SET effets = replace(effets, 'ses dégâts se divise', 'ses dégâts se divisent') WHERE id = 'magies/magie-de-la-foudre#sort:eclair-en-chaine' AND instr(effets, 'ses dégâts se divise') > 0;
-- sort magies/magie-de-la-foudre#sort:colere-de-volt portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-foudre#sort:colere-de-volt' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-foudre#sort:cercle-electrique portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-foudre#sort:cercle-electrique' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-foudre#sort:cercle-electrique effets [grammaire] : « va électrisé » -> « va électriser » (Infinitif après « va ».)
UPDATE sort SET effets = replace(effets, 'va électrisé', 'va électriser') WHERE id = 'magies/magie-de-la-foudre#sort:cercle-electrique' AND instr(effets, 'va électrisé') > 0;
-- sort magies/magie-de-la-foudre#sort:manteau-de-volt effets [grammaire] : « devient immunisé à » -> « devient immunisée à » (Accord au féminin avec « la cible ».)
UPDATE sort SET effets = replace(effets, 'devient immunisé à', 'devient immunisée à') WHERE id = 'magies/magie-de-la-foudre#sort:manteau-de-volt' AND instr(effets, 'devient immunisé à') > 0;
-- sort magies/magie-de-la-foudre#sort:manteau-de-volt effets [espace] : « attaques.  Dure » -> « attaques. Dure » (Entre le point et « Dure » il y a une espace insécable suivie d'une espace normale (U+00A0 puis U+0020) : n'en garder qu'une. | vérificateur : Espace insécable suivie d'une espace normale : n'en garder qu'une (espace normale). Avant précisé avec l'insécable. Doublon #83 rejeté.)
UPDATE sort SET effets = replace(effets, 'attaques.  Dure', 'attaques. Dure') WHERE id = 'magies/magie-de-la-foudre#sort:manteau-de-volt' AND instr(effets, 'attaques.  Dure') > 0;
-- magie magies/magie-de-la-lumiere description_physique [grammaire] : « mèches beige, » -> « mèches beiges, » (« beige » est un adjectif variable : accord avec « mèches » (pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'mèches beige,', 'mèches beiges,') WHERE id = 'magies/magie-de-la-lumiere' AND instr(description_physique, 'mèches beige,') > 0;
-- magie magies/magie-de-la-lumiere description_physique [grammaire] : « yeux beige lors » -> « yeux beiges lors » (« beige » est un adjectif variable : accord avec « yeux » (pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'yeux beige lors', 'yeux beiges lors') WHERE id = 'magies/magie-de-la-lumiere' AND instr(description_physique, 'yeux beige lors') > 0;
-- magie magies/magie-de-la-lumiere description_physique [grammaire] : « les bracelet de » -> « les bracelets de » (Pluriel après « les ».)
UPDATE magie SET description_physique = replace(description_physique, 'les bracelet de', 'les bracelets de') WHERE id = 'magies/magie-de-la-lumiere' AND instr(description_physique, 'les bracelet de') > 0;
-- magie magies/magie-de-la-lumiere description_physique [casse] : « d'aurora et » -> « d'Aurora et » (Nom propre (Aurora, comme dans « Rayon d'Aurora » et « Louange d'Aurora »).)
UPDATE magie SET description_physique = replace(description_physique, 'd''aurora et', 'd''Aurora et') WHERE id = 'magies/magie-de-la-lumiere' AND instr(description_physique, 'd''aurora et') > 0;
-- magie magies/magie-de-la-lumiere description_physique [grammaire] : « un paire » -> « une paire » (« paire » est féminin.)
UPDATE magie SET description_physique = replace(description_physique, 'un paire', 'une paire') WHERE id = 'magies/magie-de-la-lumiere' AND instr(description_physique, 'un paire') > 0;
-- magie magies/magie-de-la-lumiere description_physique [grammaire] : « aile de lumière » -> « ailes de lumière » (Une paire d'ailes (pluriel).)
UPDATE magie SET description_physique = replace(description_physique, 'aile de lumière', 'ailes de lumière') WHERE id = 'magies/magie-de-la-lumiere' AND instr(description_physique, 'aile de lumière') > 0;
-- magie_role magies/magie-de-la-lumiere#role:3 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe (convention commune).)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-de-la-lumiere' AND rang = 3 AND instr(role_brut, 'DÉGATS') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-la-lumiere:bi effet [frappe] : « protction » -> « protection » (Lettre manquante dans « protection ».)
UPDATE mode_hyper_effet SET effet = replace(effet, 'protction', 'protection') WHERE id = 'onglet_magie:magies/magie-de-la-lumiere:bi' AND instr(effet, 'protction') > 0;
-- sort magies/magie-de-la-lumiere#sort:champ-de-force remarque [accent] : « disparait » -> « disparaît » (Accent circonflexe, comme dans le reste du texte (orthographe traditionnelle : dégâts, maîtrise…).)
UPDATE sort SET remarque = replace(remarque, 'disparait', 'disparaît') WHERE id = 'magies/magie-de-la-lumiere#sort:champ-de-force' AND instr(remarque, 'disparait') > 0;
-- sort magies/magie-de-la-lumiere#sort:champ-de-force remarque [grammaire] : « attaque ennemi. » -> « attaque ennemie. » (« ennemi » est ici adjectif et s'accorde au féminin avec « attaque ».)
UPDATE sort SET remarque = replace(remarque, 'attaque ennemi.', 'attaque ennemie.') WHERE id = 'magies/magie-de-la-lumiere#sort:champ-de-force' AND instr(remarque, 'attaque ennemi.') > 0;
-- sort magies/magie-de-la-lumiere#sort:champ-de-force remarque [grammaire] : « être amplifié » -> « être amplifiée » (Accord au féminin avec « La surcharge ».)
UPDATE sort SET remarque = replace(remarque, 'être amplifié', 'être amplifiée') WHERE id = 'magies/magie-de-la-lumiere#sort:champ-de-force' AND instr(remarque, 'être amplifié') > 0;
-- sort magies/magie-de-la-lumiere#sort:fer-lumineux effets [grammaire] : « pendant 3 tour. » -> « pendant 3 tours. » (Pluriel après un nombre supérieur à 1.)
UPDATE sort SET effets = replace(effets, 'pendant 3 tour.', 'pendant 3 tours.') WHERE id = 'magies/magie-de-la-lumiere#sort:fer-lumineux' AND instr(effets, 'pendant 3 tour.') > 0;
-- sort magies/magie-de-la-lumiere#sort:fer-lumineux remarque [grammaire] : « être aveugler au » -> « être aveuglé au » (Participe passé après « être » (cf. « être paralysé » dans le sort voisin Fer Foudroyant).)
UPDATE sort SET remarque = replace(remarque, 'être aveugler au', 'être aveuglé au') WHERE id = 'magies/magie-de-la-lumiere#sort:fer-lumineux' AND instr(remarque, 'être aveugler au') > 0;
-- sort magies/magie-de-la-lumiere#sort:energie-solaire portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-lumiere#sort:energie-solaire' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-lumiere#sort:flash remarque [grammaire] : « pas affecté par » -> « pas affectées par » (Accord avec « les créatures » (féminin pluriel).)
UPDATE sort SET remarque = replace(remarque, 'pas affecté par', 'pas affectées par') WHERE id = 'magies/magie-de-la-lumiere#sort:flash' AND instr(remarque, 'pas affecté par') > 0;
-- sort magies/magie-de-la-lumiere#sort:croisade-lumineuse portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-lumiere#sort:croisade-lumineuse' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-lumiere#sort:croisade-lumineuse effets [grammaire] : « liste défini » -> « liste définie » (Accord au féminin avec « liste ».)
UPDATE sort SET effets = replace(effets, 'liste défini', 'liste définie') WHERE id = 'magies/magie-de-la-lumiere#sort:croisade-lumineuse' AND instr(effets, 'liste défini') > 0;
-- sort magies/magie-de-la-lumiere#sort:croisade-lumineuse effets [grammaire] : « 2 boost si » -> « 2 boosts si » (Pluriel après un nombre supérieur à 1.)
UPDATE sort SET effets = replace(effets, '2 boost si', '2 boosts si') WHERE id = 'magies/magie-de-la-lumiere#sort:croisade-lumineuse' AND instr(effets, '2 boost si') > 0;
-- sort magies/magie-de-la-lumiere#sort:croisade-lumineuse effets [grammaire] : « 3 niveau de » -> « 3 niveaux de » (Pluriel après un nombre supérieur à 1.)
UPDATE sort SET effets = replace(effets, '3 niveau de', '3 niveaux de') WHERE id = 'magies/magie-de-la-lumiere#sort:croisade-lumineuse' AND instr(effets, '3 niveau de') > 0;
-- sort magies/magie-de-la-lumiere#sort:croisade-lumineuse remarque [grammaire] : « prochain sorts » -> « prochain sort » (« prochain » est singulier ; la première liste écrit « prochain sort d'ombre ».)
UPDATE sort SET remarque = replace(remarque, 'prochain sorts', 'prochain sort') WHERE id = 'magies/magie-de-la-lumiere#sort:croisade-lumineuse' AND instr(remarque, 'prochain sorts') > 0;
-- sort magies/magie-de-la-lumiere#sort:operation effets [espace] : « infirmités.(3 NM » -> « infirmités. (3 NM » (Espace manquante après le point.)
UPDATE sort SET effets = replace(effets, 'infirmités.(3 NM', 'infirmités. (3 NM') WHERE id = 'magies/magie-de-la-lumiere#sort:operation' AND instr(effets, 'infirmités.(3 NM') > 0;
-- sort magies/magie-de-la-lumiere#sort:explosion-glorifique portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-lumiere#sort:explosion-glorifique dsb_brut [accent] : « 5% a » -> « 5% à » (Préposition « à » (et non le verbe « a »).)
UPDATE sort SET dsb_brut = replace(dsb_brut, '5% a', '5% à') WHERE id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique' AND instr(dsb_brut, '5% a') > 0;
-- sort magies/magie-de-la-lumiere#sort:explosion-glorifique dsb_brut [grammaire] : « tout les jets » -> « tous les jets » (« tous les » devant un pluriel masculin.)
UPDATE sort SET dsb_brut = replace(dsb_brut, 'tout les jets', 'tous les jets') WHERE id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique' AND instr(dsb_brut, 'tout les jets') > 0;
-- sort magies/magie-de-la-lumiere#sort:explosion-glorifique effets [grammaire] : « annule mutuellement » -> « annulent mutuellement » (Le sujet « Les sorts Défaite annoncée et Explosion glorifique » est pluriel.)
UPDATE sort SET effets = replace(effets, 'annule mutuellement', 'annulent mutuellement') WHERE id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique' AND instr(effets, 'annule mutuellement') > 0;
-- sort magies/magie-de-la-lumiere#sort:regeneration effets [grammaire] : « récupéré par tour » -> « récupérée par tour » (Accord au féminin avec « la santé ».)
UPDATE sort SET effets = replace(effets, 'récupéré par tour', 'récupérée par tour') WHERE id = 'magies/magie-de-la-lumiere#sort:regeneration' AND instr(effets, 'récupéré par tour') > 0;
-- sort magies/magie-de-la-lumiere#sort:grenade-flash effets [grammaire] : « être aveugler au » -> « être aveuglé au » (Participe passé après « ne pas être » (comme « être paralysé » ailleurs).)
UPDATE sort SET effets = replace(effets, 'être aveugler au', 'être aveuglé au') WHERE id = 'magies/magie-de-la-lumiere#sort:grenade-flash' AND instr(effets, 'être aveugler au') > 0;
-- sort magies/magie-de-la-lumiere#sort:cercle-de-soin portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-lumiere#sort:cercle-de-soin' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-la-lumiere#sort:lance-sacree effets [grammaire] : « terrible dégâts » -> « terribles dégâts » (Accord au pluriel avec « dégâts ».)
UPDATE sort SET effets = replace(effets, 'terrible dégâts', 'terribles dégâts') WHERE id = 'magies/magie-de-la-lumiere#sort:lance-sacree' AND instr(effets, 'terrible dégâts') > 0;
-- sort magies/magie-de-la-lumiere#sort:louange-daurora effets [grammaire] : « de ranimé un » -> « de ranimer un » (Infinitif après « Permet de ».)
UPDATE sort SET effets = replace(effets, 'de ranimé un', 'de ranimer un') WHERE id = 'magies/magie-de-la-lumiere#sort:louange-daurora' AND instr(effets, 'de ranimé un') > 0;
-- sort magies/magie-de-la-lumiere#sort:louange-daurora remarque [grammaire] : « être utiliser sur » -> « être utilisé sur » (Participe passé après « peut être » (comme dans la colonne effets).)
UPDATE sort SET remarque = replace(remarque, 'être utiliser sur', 'être utilisé sur') WHERE id = 'magies/magie-de-la-lumiere#sort:louange-daurora' AND instr(remarque, 'être utiliser sur') > 0;
-- magie magies/magie-de-lombre description_physique [grammaire] : « bracelet faites » -> « bracelets faits » (Pluriel après « des » et accord au masculin pluriel avec « bracelets ».)
UPDATE magie SET description_physique = replace(description_physique, 'bracelet faites', 'bracelets faits') WHERE id = 'magies/magie-de-lombre' AND instr(description_physique, 'bracelet faites') > 0;
-- magie magies/magie-de-lombre description_physique [grammaire] : « des corne physiques » -> « des cornes physiques » (Pluriel après « des » (accord avec « physiques »).)
UPDATE magie SET description_physique = replace(description_physique, 'des corne physiques', 'des cornes physiques') WHERE id = 'magies/magie-de-lombre' AND instr(description_physique, 'des corne physiques') > 0;
-- magie magies/magie-de-lombre description_physique [grammaire] : « les entoures » -> « les entoure » (Le sujet de « entoure » est « une aura » (3e personne du singulier).)
UPDATE magie SET description_physique = replace(description_physique, 'les entoures', 'les entoure') WHERE id = 'magies/magie-de-lombre' AND instr(description_physique, 'les entoures') > 0;
-- magie_role magies/magie-de-lombre#role:2 role_brut [accent] : « DÉGATS » -> « DÉGÂTS » (« dégâts » prend un accent circonflexe (convention commune).)
UPDATE magie_role SET role_brut = replace(role_brut, 'DÉGATS', 'DÉGÂTS') WHERE magie_id = 'magies/magie-de-lombre' AND rang = 2 AND instr(role_brut, 'DÉGATS') > 0;
-- sort magies/magie-de-lombre#sort:brume-mental effets [casse] : « jet de Fermeté » -> « jet de fermeté » (Forme majoritaire dans la colonne : « jet de fermeté » en minuscule.)
UPDATE sort SET effets = replace(effets, 'jet de Fermeté', 'jet de fermeté') WHERE id = 'magies/magie-de-lombre#sort:brume-mental' AND instr(effets, 'jet de Fermeté') > 0;
-- sort magies/magie-de-lombre#sort:cri-ebranleur dsb_brut [grammaire] : « dégâts sonore » -> « dégâts sonores » (Accord au pluriel avec « dégâts ».)
UPDATE sort SET dsb_brut = replace(dsb_brut, 'dégâts sonore', 'dégâts sonores') WHERE id = 'magies/magie-de-lombre#sort:cri-ebranleur' AND instr(dsb_brut, 'dégâts sonore') > 0;
-- sort magies/magie-de-lombre#sort:cri-ebranleur effets [grammaire] : « au dégâts » -> « aux dégâts » (« dégâts » est pluriel : « aux ».)
UPDATE sort SET effets = replace(effets, 'au dégâts', 'aux dégâts') WHERE id = 'magies/magie-de-lombre#sort:cri-ebranleur' AND instr(effets, 'au dégâts') > 0;
-- sort magies/magie-de-lombre#sort:cri-ebranleur effets [grammaire] : « sonore qui » -> « sonores qui » (Accord au pluriel avec « dégâts ».)
UPDATE sort SET effets = replace(effets, 'sonore qui', 'sonores qui') WHERE id = 'magies/magie-de-lombre#sort:cri-ebranleur' AND instr(effets, 'sonore qui') > 0;
-- sort magies/magie-de-lombre#sort:lame-dombre portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-lombre#sort:lame-dombre' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-lombre#sort:lame-dombre effets [grammaire] : « lanceur réussi » -> « lanceur réussie » (« réussi » qualifie « une attaque » (féminin).)
UPDATE sort SET effets = replace(effets, 'lanceur réussi', 'lanceur réussie') WHERE id = 'magies/magie-de-lombre#sort:lame-dombre' AND instr(effets, 'lanceur réussi') > 0;
-- sort magies/magie-de-lombre#sort:lame-dombre remarque [accent] : « pas a faire » -> « pas à faire » (Préposition « à » (« n'a pas à faire ») et non le verbe « a ».)
UPDATE sort SET remarque = replace(remarque, 'pas a faire', 'pas à faire') WHERE id = 'magies/magie-de-lombre#sort:lame-dombre' AND instr(remarque, 'pas a faire') > 0;
-- sort magies/magie-de-lombre#sort:brouillard-obscur portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-lombre#sort:brouillard-obscur' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-lombre#sort:amplification-sombre remarque [accent] : « Echec critique » -> « Échec critique » (Accent sur la majuscule : « Échec ».)
UPDATE sort SET remarque = replace(remarque, 'Echec critique', 'Échec critique') WHERE id = 'magies/magie-de-lombre#sort:amplification-sombre' AND instr(remarque, 'Echec critique') > 0;
-- sort magies/magie-de-lombre#sort:ombre-menacante nom [accent] : « Ombre Menacante » -> « Ombre Menaçante » (Cédille manquante ; l'identifiant (sans accents ni cédilles) reste « ombre-menacante ».)
UPDATE sort SET nom = replace(nom, 'Ombre Menacante', 'Ombre Menaçante') WHERE id = 'magies/magie-de-lombre#sort:ombre-menacante' AND instr(nom, 'Ombre Menacante') > 0;
-- sort magies/magie-de-lombre#sort:ombre-menacante portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union : « Soi-même » (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-lombre#sort:ombre-menacante' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-de-lombre#sort:ombre-menacante remarque [grammaire] : « tout les début de tour » -> « tous les débuts de tour » (« tous les » devant un pluriel masculin, et « débuts » s'accorde.)
UPDATE sort SET remarque = replace(remarque, 'tout les début de tour', 'tous les débuts de tour') WHERE id = 'magies/magie-de-lombre#sort:ombre-menacante' AND instr(remarque, 'tout les début de tour') > 0;
-- sort magies/magie-de-lombre#sort:rayon-negatif dsb_brut [espace] : « dégâts  (+4/NM) » -> « dégâts (+4/NM) » (Double espace.)
UPDATE sort SET dsb_brut = replace(dsb_brut, 'dégâts  (+4/NM)', 'dégâts (+4/NM)') WHERE id = 'magies/magie-de-lombre#sort:rayon-negatif' AND instr(dsb_brut, 'dégâts  (+4/NM)') > 0;
-- sort magies/magie-de-lombre#sort:rayon-negatif effets [espace] : « «Couardise» » -> « « Couardise » » (Espaces insécables (U+00A0) manquantes à l'intérieur des guillemets, comme dans « Peur 2 » juste en dessous et dans « para-tonnerre » (Colonne tesla). Les deux espaces de l'après sont des U+00A0. | vérificateur : Espaces insécables manquantes dans les guillemets, comme dans « Peur 2 » et « para-tonnerre ». Après précisé avec U+00A0 de part et d'autre.)
UPDATE sort SET effets = replace(effets, '«Couardise»', '« Couardise »') WHERE id = 'magies/magie-de-lombre#sort:rayon-negatif' AND instr(effets, '«Couardise»') > 0;
-- sort magies/magie-de-lombre#sort:rayon-negatif effets [espace] : « Peur 2 » » -> « Peur 2 » » (Espace insécable avant « » », comme dans l'autre état de la même cellule (« Couardise »).)
UPDATE sort SET effets = replace(effets, 'Peur 2 »', 'Peur 2 »') WHERE id = 'magies/magie-de-lombre#sort:rayon-negatif' AND instr(effets, 'Peur 2 »') > 0;
-- sort magies/magie-de-lombre#sort:grenade-fumigene effets [espace] : « Ombre. ⏎Si » -> « Ombre.⏎Si » (Espace superflue en fin de ligne, avant le retour à la ligne.)
UPDATE sort SET effets = replace(effets, 'Ombre. 
Si', 'Ombre.
Si') WHERE id = 'magies/magie-de-lombre#sort:grenade-fumigene' AND instr(effets, 'Ombre. 
Si') > 0;
-- sort magies/magie-de-lombre#sort:grenade-fumigene effets [grammaire] : « tout les jets » -> « tous les jets » (« tous les » devant un pluriel masculin.)
UPDATE sort SET effets = replace(effets, 'tout les jets', 'tous les jets') WHERE id = 'magies/magie-de-lombre#sort:grenade-fumigene' AND instr(effets, 'tout les jets') > 0;
-- sort magies/magie-de-lombre#sort:defaite-annoncee remarque [grammaire] : « annule mutuellement » -> « annulent mutuellement » (Le sujet « Les sorts Défaite annoncée et Explosion glorifique » est pluriel.)
UPDATE sort SET remarque = replace(remarque, 'annule mutuellement', 'annulent mutuellement') WHERE id = 'magies/magie-de-lombre#sort:defaite-annoncee' AND instr(remarque, 'annule mutuellement') > 0;
-- sort magies/magie-de-lombre#sort:pire-ami effets [orthographe] : « que elle » -> « qu'elle » (Élision obligatoire devant « elle » : « qu'elle ».)
UPDATE sort SET effets = replace(effets, 'que elle', 'qu''elle') WHERE id = 'magies/magie-de-lombre#sort:pire-ami' AND instr(effets, 'que elle') > 0;
-- sort magies/magie-de-lombre#sort:pire-ami effets [grammaire] : « Peut être décimer par » -> « Peut être décimée par » (Après « être », on met un participe passé et non l'infinitif ; il s'accorde avec « l'ombre » (sujet de la phrase).)
UPDATE sort SET effets = replace(effets, 'Peut être décimer par', 'Peut être décimée par') WHERE id = 'magies/magie-de-lombre#sort:pire-ami' AND instr(effets, 'Peut être décimer par') > 0;
-- sort magies/magie-de-lombre#sort:pire-ami remarque [espace] : « santé  totale » -> « santé totale » (Double espace.)
UPDATE sort SET remarque = replace(remarque, 'santé  totale', 'santé totale') WHERE id = 'magies/magie-de-lombre#sort:pire-ami' AND instr(remarque, 'santé  totale') > 0;
-- sort magies/magie-de-lombre#sort:chaine-de-lentrave remarque [grammaire] : « amoindri au » -> « amoindries au » (Accord avec « ses chances » (féminin pluriel).)
UPDATE sort SET remarque = replace(remarque, 'amoindri au', 'amoindries au') WHERE id = 'magies/magie-de-lombre#sort:chaine-de-lentrave' AND instr(remarque, 'amoindri au') > 0;
-- sort magies/magie-de-lombre#sort:chaine-de-lentrave remarque [orthographe] : « 1e tentative » -> « 1re tentative » (Abréviation correcte de « première » : 1re (les suivantes 2e, 3e, 4e sont correctes).)
UPDATE sort SET remarque = replace(remarque, '1e tentative', '1re tentative') WHERE id = 'magies/magie-de-lombre#sort:chaine-de-lentrave' AND instr(remarque, '1e tentative') > 0;
-- sort magies/magie-de-lombre#sort:chaine-de-lentrave remarque [grammaire] : « Score normale » -> « Score normal » (« score » est masculin.)
UPDATE sort SET remarque = replace(remarque, 'Score normale', 'Score normal') WHERE id = 'magies/magie-de-lombre#sort:chaine-de-lentrave' AND instr(remarque, 'Score normale') > 0;
-- sort magies/magie-de-lombre#sort:chaine-de-lentrave remarque [casse] : « un échec met » -> « Un échec met » (Majuscule en début de phrase (nouveau paragraphe).)
UPDATE sort SET remarque = replace(remarque, 'un échec met', 'Un échec met') WHERE id = 'magies/magie-de-lombre#sort:chaine-de-lentrave' AND instr(remarque, 'un échec met') > 0;
-- sort magies/magie-de-lombre#sort:frappe-negative remarque [grammaire] : « sont cumulatif » -> « sont cumulatifs » (Accord au pluriel avec « les effets ».)
UPDATE sort SET remarque = replace(remarque, 'sont cumulatif', 'sont cumulatifs') WHERE id = 'magies/magie-de-lombre#sort:frappe-negative' AND instr(remarque, 'sont cumulatif') > 0;
-- sort magies/magie-de-la-foudre#sort:orage-violet effets [grammaire] : « se répercute dans » -> « se répercutent dans » (Le sujet « 15% des dégâts » est pluriel.)
UPDATE sort SET effets = replace(effets, 'se répercute dans', 'se répercutent dans') WHERE id = 'magies/magie-de-la-foudre#sort:orage-violet' AND instr(effets, 'se répercute dans') > 0;
-- sort magies/magie-de-la-lumiere#sort:recouvrer effets [orthographe] : « d'états » -> « d'état » (Expression « altérations d'état » (invariable), comme dans la description et ailleurs.)
UPDATE sort SET effets = replace(effets, 'd''états', 'd''état') WHERE id = 'magies/magie-de-la-lumiere#sort:recouvrer' AND instr(effets, 'd''états') > 0;
-- sort magies/magie-de-lombre#sort:javelot-sombre dsb_brut [espace] : « 7d6 +15 » -> « 7d6 + 15 » (Espace manquante après « + », comme dans les autres cellules de la colonne (« 7d6 + 15 dégâts »). Aucun chiffre ni signe modifié.)
UPDATE sort SET dsb_brut = replace(dsb_brut, '7d6 +15', '7d6 + 15') WHERE id = 'magies/magie-de-lombre#sort:javelot-sombre' AND instr(dsb_brut, '7d6 +15') > 0;
-- sort magies/magie-de-lombre#sort:defaite-annoncee portee_brut [ponctuation] : « Soi même » -> « Soi-même » (Trait d'union (convention commune).)
UPDATE sort SET portee_brut = replace(portee_brut, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-lombre#sort:defaite-annoncee' AND instr(portee_brut, 'Soi même') > 0;
-- sort magies/magie-du-sang#sort:proportion-demesuree remarque [espace] : « monterà 7 » -> « monter à 7 » (Mots collés : « monter à ».)
UPDATE sort SET remarque = replace(remarque, 'monterà 7', 'monter à 7') WHERE id = 'magies/magie-du-sang#sort:proportion-demesuree' AND instr(remarque, 'monterà 7') > 0;
-- mode_hyper_effet onglet_magie:magies/magie-de-lespace-temps:mono effet [orthographe] : « Lors qu'il subit » -> « Lorsqu'il subit » (« lorsque » s'écrit en un seul mot)
UPDATE mode_hyper_effet SET effet = replace(effet, 'Lors qu''il subit', 'Lorsqu''il subit') WHERE id = 'onglet_magie:magies/magie-de-lespace-temps:mono' AND instr(effet, 'Lors qu''il subit') > 0;
-- sort magies/magie-du-sang#sort:sang-garde remarque [espace] : « NB: Jet » -> « NB : Jet » (Espace avant les deux-points, comme ailleurs dans les textes (« exception : », « 5 : »).)
UPDATE sort SET remarque = replace(remarque, 'NB: Jet', 'NB : Jet') WHERE id = 'magies/magie-du-sang#sort:sang-garde' AND instr(remarque, 'NB: Jet') > 0;
-- sort magies/magie-de-la-terre#sort:terre-maudite remarque [accent] : « ne disparait que » -> « ne disparaît que » (Accent circonflexe de « disparaître » (i devant t), écrit « disparaît » partout ailleurs dans le corpus.)
UPDATE sort SET remarque = replace(remarque, 'ne disparait que', 'ne disparaît que') WHERE id = 'magies/magie-de-la-terre#sort:terre-maudite' AND instr(remarque, 'ne disparait que') > 0;

-- Copies du texte corrigé dans les tables dérivées du sort (extraits et libellés lus dans le texte), les notes de cellule (trace) et les pages Markdown.
-- Chaque ligne est gardée par sa valeur d'origine : elle ne change que si elle est encore telle qu'avant la migration.
UPDATE note_cellule SET texte = 'Saignement particulier = Saignement de stade 1 qui ne se soigne pas et qui se cumule pas avec le Saignement classique. N''augmente pas en intensité mais redémarre le nombre si répété.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-sang#sort:saignee-forcee' AND rang = 1 AND texte = 'Saignement particulier = Saignement de stade 1 qui ne se soigne pas et qui se cumule pas avec le Saignement classique. N''augmente pas en intensité mais redémarre le nombre si répéter.';
UPDATE note_cellule SET texte = 'Le mur est fixé au sol.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-sang#sort:coagulation' AND rang = 1 AND texte = 'Le mur est fixée au sol.';
UPDATE note_cellule SET texte = 'Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-sang#sort:renfermement' AND rang = 1 AND texte = 'Vu que c''est une régénération, la santé récupéré par tour se détermine au premier jet.';
UPDATE sort_etat SET extrait = 'Augmente la taille d''un cran, +1 Force, +15 (+5/NM) aux dégâts physiques, +1 portée pour 3 tours, inflige fatigue à la fin.', forme_trouvee = 'fatigue' WHERE sort_id = 'magies/magie-du-sang#sort:proportion-demesuree' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND relation = 'inflige' AND rang = 1 AND extrait = 'Augmente la taille d''un cran, +1 Force, +15 (+5/NM) aux dégâts physique, +1 portée pour 3 tours, inflige fatigue à la fin.' AND forme_trouvee = 'fatigue';
UPDATE note_cellule SET texte = 'Le regain ne peut être effectif que si c''est la barrière ennemie qui est touchée.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-larcane#sort:pillage-defensif' AND rang = 1 AND texte = 'Le regain ne peut être effectif que si c''est la barrière ennemi qui est touchée.';
UPDATE sort_progression_nm SET texte_brut = '3 NM = les dégâts ignorent les AM' WHERE sort_id = 'magies/magie-de-larcane#sort:champ-gardien' AND champ = 'effets' AND rang = 1 AND texte_brut = '3 NM = les dégâts ignore les AM';
UPDATE note_cellule SET texte = 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-corruption#sort:verrouillage-simple' AND rang = 1 AND texte = 'Si la cible est dans la posture indiquée à ce moment là, il doit changer de posture de suite.

Les verrouillages ne se cumule pas.';
UPDATE note_cellule SET texte = 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-corruption#sort:verrouille-visible' AND rang = 1 AND texte = 'Si la cible est dans la posture indiquée à ce moment là, il doit changer de posture de suite.

Les verrouillages ne se cumule pas.';
UPDATE note_cellule SET texte = 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-corruption#sort:verrouillage-magique' AND rang = 1 AND texte = 'Si la cible est dans la posture indiquée à ce moment là, il doit changer de posture de suite.

Les verrouillages ne se cumule pas.';
UPDATE note_cellule SET texte = 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-corruption#sort:verrouillage-physique' AND rang = 1 AND texte = 'Si la cible est dans la posture indiquée à ce moment là, il doit changer de posture de suite.

Les verrouillages ne se cumule pas.';
UPDATE sort_type SET libelle = 'Entrave' WHERE sort_id = 'magies/magie-de-la-corruption#sort:petrole' AND rang = 1 AND libelle = 'Entave';
UPDATE note_cellule SET texte = 'Bien entendu on est pas bloqué à vie, il est possible d''en sortir avec un jet d''athlétisme/équilibre, s''il est raté, il faut attendre le prochain tour pour réessayer. C''est juste le mouvement qui est bloqué, pas l''action évidemment.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-corruption#sort:petrole' AND rang = 1 AND texte = 'Bien entendu on est pas bloqué à vie, il est possible d''en sortir avec un jet d''athlétisme/équilibre, si il est raté, il faut attendre le prochain tour pour réssayer. C''est juste le mouvement qui est bloqué, pas l''action évidemment.';
UPDATE note_cellule SET texte = 'Elle peut se voir mais seulement avec un jet d''observation/distinction réussi en posture vigilance et seulement à portée de vue (Score de perception)' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-corruption#sort:mine-noire' AND rang = 1 AND texte = 'Elle peut se voir mais seulement avec un jet d''observation/distinction réussi en posture vigilance et seulement a portée de vue (Score de perception)';
UPDATE sort_type SET libelle = 'Entrave' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur' AND rang = 1 AND libelle = 'Entave';
UPDATE sort_progression_nm SET texte_brut = '+1/NM' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:substitution' AND champ = 'portee' AND rang = 1 AND texte_brut = '+1/ NM';
UPDATE note_cellule SET texte = 'Ne provoque pas d''attaque d''opportunité.

Il n’est pas possible d’échanger sa place avec une cible trop grosse.

Peut être contré par "Téléportation"' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lespace-temps#sort:inversion' AND rang = 1 AND texte = 'Ne provoque pas d''attaque d''opportunité.

Il n’est pas possible d’échanger sa place avec une cible trop grosse.

Peut être contrer par "Téléportation"';
UPDATE note_cellule SET texte = 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante' AND rang = 1 AND texte = 'Si c''est la barrière, la barrière est vampirisé.
Si c''est les points de vies, c''est les points de vies qui sont vampirisés';
UPDATE note_cellule SET texte = 'Un boss qui a naturellement 2 tours, n''aura qu''un seul tour avec deux actions.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lespace-temps#sort:celerite' AND rang = 1 AND texte = 'Un boss qui a naturellement 2 tour, n''aura qu''un seul tour avec deux actions.';
UPDATE note_cellule SET texte = 'Si le lanceur est dans la zone d''action de la grenade, il peut décider de ne pas être téléporté.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lespace-temps#sort:grenade-distordue' AND rang = 1 AND texte = 'si le lanceur est dans la zone d''action de la grenade, il peut décidé de ne pas être téléporter.';
UPDATE note_cellule SET texte = 'Ces clones imitent le lanceur dans ses actions mais sans pour autant faire des dégâts ou des effets sur les autres.
Si jamais une attaque risque d''arriver sur le lanceur, cette attaque a 50% de chance d''atterrir sur un des clones.
Si un clone prend un coup, il disparait.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lespace-temps#sort:image-diffuse' AND rang = 1 AND texte = 'Ces clones imite le lanceur dans ces actions mais sans pour autant faire des dégâts ou des effets sur les autres.
Si jamais une attaque risque d''arriver sur le lanceur, cette attaque à 50% de chance d''atterrir  sur un des clones.
Si un clone prend un coup, il disparait.';
UPDATE note_cellule SET texte = 'La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = taille 1 (1 kg maxi)
Magie 2 = taille 2 (2 kg maxi)
Magie 3 = taille 3 (3 kg maxi)
Magie 4 = taille 4 (4 kg maxi)
Magie 5 = taille 5 (5 kg maxi)' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:telekinesie' AND rang = 1 AND texte = 'La taille de l''objet n''est pas infini, il faut un certain niveau de magie pour certains objets
Magie 1 = taille 1 (1 kg maxi)
Magie 2 = taille 2 (2 kg maxi)
Magie 3 = taille 3 (3 kg maxi)
Magie 4 = taille 4 (4 kg maxi)
Magie 5 = taille 5 (5 kg maxi)';
UPDATE note_cellule SET texte = 'La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = TP
Magie 2 = P
Magie 3 = N
Magie 4 = G
Magie 5 = TG' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:telekinesie' AND rang = 2 AND texte = 'La taille de l''objet n''est pas infini, il faut un certain niveau de magie pour certains objets
Magie 1 = TP
Magie 2 = P
Magie 3 = N
Magie 4 = G
Magie 5 = TG';
UPDATE note_cellule SET texte = 'Les buff niveau 5 ne peuvent pas être annulés par ce sort.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:dissipation' AND rang = 2 AND texte = 'Les buff niveau 5 ne peuvent pas être annulé par ce sort.';
UPDATE note_cellule SET texte = 'L''équipement le devient aussi, les sorts et les attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans cet état.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:aspect-vide' AND rang = 1 AND texte = 'L''équipement le devient aussi, les sorts et les attaques ne touche pas, SEULES les armes spectrales fonctionne dans cet état.';
UPDATE note_cellule SET texte = 'L''équipement le devient aussi donc les attaques et sorts ne fonctionnent pas, SEULES les armes spectrales fonctionnent dans cet état.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:aspect-vide' AND rang = 2 AND texte = 'L''équipement le devient aussi donc les attaques et sorts ne fonctionne pas, SEULES les armes spectrales fonctionne dans cet état.';
UPDATE note_cellule SET texte = 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:touche-du-vide' AND rang = 1 AND texte = 'Si c''est la barrière, la barrière est vampirisé.
Si c''est les points de vies, c''est les points de vies qui sont vampirisés';
UPDATE note_cellule SET texte = '3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus.

RIEN N''EST ESQUIVABLE

1 : Inflige *saignement 1
2 : Met une croix en Force pour 1 tour
3 : Inflige *poison 1
4 : Oblige un jet de vigueur ou fermeté (le meilleur), si raté : Perd le tour
5 : Inflige *brûlure 1
6 : Met une croix en Perception pour 1 tour
7 : Inflige le sort de l''ombre "Malédiction" pour 1 tour
8 : Inflige *surdité 1
9 : Inflige *paralysie 1
10 : Met une croix en Volonté pour 1 tour
11 : Inflige *surcharge magique 1
12 : Inflige *peur 1
13 : Inflige *aveuglement 1
14 : Met une croix en Intelligence pour 1 tour
15 : Inflige *enragé 1
16 : Inflige gel 1
17 : Inflige confusion 1
18 : Met une croix en Agilité pour 1 tour
19 : Retire tous les effets positifs de la cible
20 : Inflige couardise' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:alea-negatif' AND rang = 1 AND texte = '3NM = les altérations d''états sont 1 cran au dessus et les croix dure 1 tour de plus.

RIEN N''EST ESQUIVABLE

1 : Inflige *saignement 1
2 : Met une croix en Force pour 1 tour
3 : Inflige *poison 1
4 : Oblige un jet de vigueur ou fermeté (le meilleur), si raté : Perd le tour
5 : Inflige *brûlure 1
6 : Met une croix en Perception pour 1 tour
7 : Inflige le sort de l''ombre "Malédiction" pour 1 tour
8 : Inflige *surdité 1
9 : Inflige *paralysie 1
10 : Met une croix en Volonté pour 1 tour
11 : Inflige *surcharge magique 1
12 : Inflige *peur 1
13 : Inflige *aveuglement 1
14 : Met une croix en Intelligence pour 1 tour
15 : Inflige *enragé 1
16 : Inflige gel 1
17 : Inflige confusion 1
18 : Met une croix en Agilité pour 1 tour
19 : Retire tout les effets positifs de la cible
20 : Inflige couardise';
UPDATE note_cellule SET texte = 'Ne peut pas être relancé.
Le mage noir et blanc peuvent le faire mais ça dépendra de la nature du premier sort.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:metronome' AND rang = 1 AND texte = 'Ne peut pas être relancer.
Le mage noir et blanc peuvent le faire mais ça dépendra de la nature du premier sort.';
UPDATE note_cellule SET texte = 'Ne peut pas être relancé.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vide#sort:metronome' AND rang = 2 AND texte = 'Ne peut pas être relancer.';
UPDATE note_cellule SET texte = 'Niveau 1 : 3 CK + 1 âme
Niveau 2 : 6 CK + 2 âmes
Niveau 3 : 12 CK + 3 âmes
Niveau 4 : 24 CK + 4 âmes
Niveau 5 : 48 CK + 5 âmes' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND rang = 1 AND texte = 'Niveau 1 : 3 CK + 1 âme
NIveau 2 : 6 CK + 2 âmes
NIveau 3 : 12 CK + 3 âmes
NIveau 4 : 24 CK + 4 âmes
Niveau 5 : 48 CK + 5 âmes';
UPDATE note_cellule SET texte = 'Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND rang = 2 AND texte = 'Chaque niveau de puissance de la créature invoqué double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.';
UPDATE note_cellule SET texte = 'Pour voir les morts-vivants possibles https://maverick-jdr.fandom.com/fr/wiki/Mort-Vivant_(Invocation)

Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-necromancie#sort:animation-de-mort' AND rang = 3 AND texte = 'Pour voir les morts vivants possible https://maverick-jdr.fandom.com/fr/wiki/Mort-Vivant_(Invocation)

Chaque niveau de puissance de la créature invoqué double de le coût précédent pour l''invoquer.';
UPDATE sort_etat SET extrait = 'Si jet de vigueur raté = Inflige "poison 1"', forme_trouvee = 'poison' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:corruption-dame' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND relation = 'inflige' AND rang = 1 AND extrait = 'Si jet de Vigueur raté = Inflige "poison 1"' AND forme_trouvee = 'poison';
UPDATE note_cellule SET texte = 'Est considérée comme morte tant que la cible n''a pas bu 1 super fiole de soin par jour sur 1 mois. Ou alors qu''une résurrection est appliquée sur lui.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-necromancie#sort:resurrection-noir' AND rang = 1 AND texte = 'Est considérée comme morte tant que la cible n''a pas bu 1 super fiole de soin par jour sur 1 mois. Ou alors qu''une résurrection est appliquer sur lui.';
UPDATE note_cellule SET texte = 'Est considéré comme mort tant que la cible n''a pas bu 1 fiole par jour sur 5 jours. Ou alors qu''une résurrection est appliquée sur lui.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-necromancie#sort:resurrection-noir' AND rang = 2 AND texte = 'Est considérer comme mort tant que la cible n''a pas bu 1 fiole par jour sur 5 jours. Ou alors qu''une résurrection est appliquer sur lui.';
UPDATE sort_etat SET extrait = 'Inflige fatigue 1 aux ennemis dans la zone s''ils ratent leur jet de vigueur', forme_trouvee = 'fatigue' WHERE sort_id = 'magies/magie-du-feu#sort:aura-chaude' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND relation = 'inflige' AND rang = 1 AND extrait = 'Inflige fatigue 1 aux ennemis dans la zone si ils ratent leur jet de vigueur' AND forme_trouvee = 'fatigue';
UPDATE sort_etat SET extrait = 'Permet de toucher tous les ennemis avec une braise faible, Coup critique = inflige brûlure 1.', forme_trouvee = 'brûlure' WHERE sort_id = 'magies/magie-du-feu#sort:braise-magique' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND relation = 'inflige' AND rang = 1 AND extrait = 'Permet de touché tout les ennemi avec une braise faible, Coup critique = inflige Brulure 1.' AND forme_trouvee = 'Brulure';
UPDATE sort_etat SET extrait = ', 10% de chance d''infliger brûlure 1.', forme_trouvee = 'brûlure' WHERE sort_id = 'magies/magie-du-feu#sort:bouffee-infernale' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND relation = 'inflige' AND rang = 1 AND extrait = ', 10% de chance d''infliger Brulure 1.' AND forme_trouvee = 'Brulure';
UPDATE sort_etat SET extrait = 'Permet d''infliger brûlure 3 aux immunisés et de brûler ce qui ne peut l''être.', forme_trouvee = 'brûlure' WHERE sort_id = 'magies/magie-du-feu#sort:combustion-forte' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND relation = 'inflige' AND rang = 1 AND extrait = 'Permet d''infliger brûlure 3 aux immunisé et de brûler ce qui ne peux l''être.' AND forme_trouvee = 'brûlure';
UPDATE note_cellule SET texte = 'Totalement insensible aux dégâts physiques et magiques qui ne sont pas une vulnérabilité. Permet de bénéficier d''une invisibilité quand vous êtes dans l''eau.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-leau#sort:dissolution' AND rang = 1 AND texte = 'totalement insensible aux dégâts physiques et magiques qui ne sont pas une vulnérabilité. Permet de bénéficié d''une invisibilité quand vous êtes dans l''eau.';
UPDATE note_cellule SET texte = 'Cette météo ne peut pas être retirée par les autres météos ou bien les effets de classes.
Le Don "Climatospetique" ne peut pas contrer cet effet.
Cet effet dure maximum 5 tours.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-leau#sort:larmes-doceane' AND rang = 1 AND texte = 'Cette météo ne peux pas être retirer par les autres météos ou bien les effets de classes.
Le Don "Climatospetique" ne peux pas contrer cet effet.
Cet effet dure maximum 5 tours.';
UPDATE note_cellule SET texte = '3NM = Inflige 4 dégâts perce AM lors du lien de gel.

Le lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d''adversaires disponibles. La cible est ainsi libérée mais peut se reprendre le lien de gel si jamais il est à côté d''un autre qui a le lien de gel et ainsi de suite...' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-glace#sort:lien-de-gel' AND rang = 1 AND texte = '3NM = Inflige 4 dégâts perce AM lors du lien de gel.

Le lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d''adversaires disponible. La cible est ainsi libérer mais peut se reprendre le lien de gel si jamais il est à côté d''un autre qui a le lien de gel et ainsi de suite...';
UPDATE note_cellule SET texte = 'L''allié sera aussi dispensé de jet de survie pendant cet état.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-glace#sort:gel-profond' AND rang = 1 AND texte = 'l''allié sera aussi dispensé de jet de survie pendant cet état.';
UPDATE note_cellule SET texte = 'La victime ne peut rien faire dans cet état, il faut à tout prix que le lanceur rate un jet de concentration ou bien qu''il soit interrompu.
Dans le cas d''un boss qui se fait enfermer, il peut lutter contre avec des jets d''athlétisme, concentration, vigueur, etc... le mj a le choix. Le lanceur devra faire un meilleur jet que la cible pour ne pas qu''il sorte du cercueil.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-glace#sort:execution-froide' AND rang = 1 AND texte = 'La victime ne peux rien faire dans cet état, il faut a tout prix que le lanceur rate un jet de concentration ou bien qu''il soit interrompu. 
Dans le cas d''un boss qui se fait enfermer, il peut lutter contre avec des jets d''athlétisme, concentration, vigueur, ect... le mj à le choix. Le lanceur devra faire un meilleur jet que la cible pour ne pas qu''il sorte du cerceuil.';
UPDATE note_cellule SET texte = 'Pour voir les golems possibles 


Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-terre#sort:appel-aux-golems' AND rang = 1 AND texte = 'Pour voir les golems possible 


Chaque niveau de puissance de la créature invoqué double de le coût précédent pour l''invoquer.';
UPDATE note_cellule SET texte = 'Les dégâts de l''infection ne sont pas élémentaires' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-terre#sort:infection' AND rang = 1 AND texte = 'Les dégâts de l''infection ne sont pas élémentaire';
UPDATE note_cellule SET texte = 'Si jamais un coup physique ou magique est encaissé par la protection, elle doit faire plus que la tolérance de cette dernière pour la briser.

Si elle fait moins, le coup est annulé et la protection se recharge pour le prochain coup

Si elle fait plus, la protection est brisée et l''intégralité du coup est encaissée.

Les AP ne sont pas comptées quand les dégâts sont faits à la protection.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-terre#sort:barriere-rocheuse' AND rang = 1 AND texte = 'Si jamais un coup physique ou magique est encaissé par la protection, elle doit faire plus que la tolérance de cette dernière pour la brisé.

Si elle fait moins, le coup est annulé et la protection se recharge pour le prochain coup

Si elle fait plus, la protection est brisé et l''intégralité du coup est encaisser.

Les AP ne sont pas compté quand les dégâts sont fait à la protection.';
UPDATE note_cellule SET texte = 'Équivalent à pétrifié 3 mais la victime ne peut pas prendre de dégâts sous le magma.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-terre#sort:alourdissement' AND rang = 1 AND texte = 'équivalent à pétrifié 3 mais la victime ne peut pas prendre de dégâts sous le magma.';
UPDATE note_cellule SET texte = 'Demande un sol, un mur, un plafond ou toute autre surface où la racine peut sortir, sous l''eau ça marche mais pas dans le ciel.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-terre#sort:frappe-racine' AND rang = 1 AND texte = 'Demande un sol, un mur, un plafond ou tout autre surface où la racine peut sortir, sous l''eau ça marche mais pas dans le ciel.';
UPDATE note_cellule SET texte = 'Corps de Maverium : Tous les dégâts reçus sont réduits à 0 et les effets négatifs sur les protections ne fonctionnent pas.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND rang = 1 AND texte = 'Corps de Maverium : Tout les dégâts reçu sont réduit à 0 et les effets négatifs sur les protections ne fonctionne pas.';
UPDATE note_cellule SET texte = 'Corps de Maverium permet d''ignorer tous les dégâts possibles quelle que soit leur puissance. Comme corps de pierre, tous les organes internes sont solidifiés et ne fonctionnent pas temporairement (comme un golem, pas besoin)' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-terre#sort:corps-de-maverium' AND rang = 2 AND texte = 'Corps de Marverium permet d''ignorer tout les dégâts possible quelle que soit leur puissance. Comme corps de pierre, tout les organes interne sont solidifié et ne fonctionne pas temporairement (comme un golem, pas besoin)';
UPDATE sort_etat SET extrait = 'Si jet de vigueur raté = Inflige surdité 1.', forme_trouvee = 'surdité' WHERE sort_id = 'magies/magie-du-vent#sort:cri-faible' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND relation = 'inflige' AND rang = 1 AND extrait = 'Si jet de vigueur raté = Inflge surdité 1.' AND forme_trouvee = 'surdité';
UPDATE note_cellule SET texte = 'Réussir à sortir vous fait prendre quand même 5d6 dégâts. Ne pas réussir à sortir vous fait voler et tomber par terre.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-vent#sort:tornade' AND rang = 1 AND texte = 'Réussir a sortir vous fait prendre quand même 5d6 dégâts. Ne pas réussir a sortir vous fait voler et tomber par terre.';
UPDATE sort_etat SET extrait = 'Incanche une vibration insupportable, Si jet de vigueur raté = Inflige surdité 2, Si jet de stabilité/réflexe raté = Tombe par terre.', forme_trouvee = 'surdité' WHERE sort_id = 'magies/magie-du-vent#sort:vibration' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND relation = 'inflige' AND rang = 1 AND extrait = 'Incanche une vibration insupportable, Si jet de vigueur raté = Inflge surdité 2, Si jet de stabilité/Réflexe raté = Tombe par terre.' AND forme_trouvee = 'surdité';
UPDATE note_cellule SET texte = 'Peut être lancé 3 fois dans le même tour.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-foudre#sort:chargeur' AND rang = 1 AND texte = 'Peut etre lancer 3 fois dans le meme tour.';
UPDATE note_cellule SET texte = 'C''est un équivalent de "Confusion 3" pour les créatures mécaniques.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-foudre#sort:dysfonctionnement' AND rang = 1 AND texte = 'C''est un équivalent de "Confusion 3" pour les créature mécaniques.';
UPDATE note_cellule SET texte = 'C''est un équivalent de "Confus" pour les créatures mécaniques.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-foudre#sort:dysfonctionnement' AND rang = 2 AND texte = 'C''est un équivalent de "Confus" pour les créature mécaniques.';
UPDATE note_cellule SET texte = 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparaît après l''attaque ennemie. Il va réduire les dégâts AVANT l''armure.

La surcharge peut être amplifiée avec 20 chakra maximum' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-lumiere#sort:champ-de-force' AND rang = 1 AND texte = 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparait après l''attaque ennemi. Il va réduire les dégâts AVANT l''armure.

La surcharge peut être amplifié avec 20 chakra maximum';
UPDATE note_cellule SET texte = 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être aveuglé au stade 1' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-lumiere#sort:fer-lumineux' AND rang = 1 AND texte = 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être aveugler au stade 1';
UPDATE note_cellule SET texte = 'Ce sort repose sur une existence des yeux, les créatures aveugles ne sont pas affectées par ce sort.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-lumiere#sort:flash' AND rang = 1 AND texte = 'Ce sort repose sur une existence des yeux, les créatures aveugles ne sont pas affecté par ce sort.';
UPDATE note_cellule SET texte = 'Liste des amplifications :
- Permet d''encaisser le prochain sort d''ombre (sauf niveau 5)
- Immunise à la peur pendant 3 tours.
- Immunise aux effets négatifs pour le tour.
- Immunise contre les altérations d''état niveau 1 pour 2 tours' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-lumiere#sort:croisade-lumineuse' AND rang = 2 AND texte = 'Liste des amplifications :
- Permet d''encaisser le prochain sorts d''ombre (sauf niveau 5)
- Immunise à la peur pendant 3 tours.
- Immunise aux effets négatifs pour le tour.
- Immunise contre les altérations d''état niveau 1 pour 2 tours';
UPDATE sort_etat SET extrait = '(3 NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1)', forme_trouvee = 'aveuglé' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:grenade-flash' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND relation = 'prend' AND rang = 1 AND extrait = '(3 NM = oblige un jet de vigueur pour ne pas être aveugler au stade 1)' AND forme_trouvee = 'aveugler';
UPDATE sort_progression_nm SET texte_brut = '3 NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:grenade-flash' AND champ = 'effets' AND rang = 1 AND texte_brut = '3 NM = oblige un jet de vigueur pour ne pas être aveugler au stade 1';
UPDATE note_cellule SET texte = 'Le sort peut être utilisé sur un allié qui n''est pas dans le coma.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-lumiere#sort:louange-daurora' AND rang = 1 AND texte = 'Le sort peut être utiliser sur un allié qui n''est pas dans le coma.';
UPDATE note_cellule SET texte = 'La lame fait partie de l''attaque qu''elle accompagne, l''adversaire n''a pas à faire une autre défense pour juste la lame. Les lames partent une par une' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lombre#sort:lame-dombre' AND rang = 1 AND texte = 'La lame fait partie de l''attaque qu''elle accompagne, l''adversaire n''a pas a faire une autre défense pour juste la lame. Les lames partent une par une';
UPDATE note_cellule SET texte = 'EC = Échec critique' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lombre#sort:amplification-sombre' AND rang = 1 AND texte = 'EC = Echec critique';
UPDATE note_cellule SET texte = 'L''ombre reste 3 tours.

Le jet de fermeté se relance tous les débuts de tour.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lombre#sort:ombre-menacante' AND rang = 1 AND texte = 'L''ombre reste 3 tours.

Le jet de fermeté se relance tout les début de tour.';
UPDATE sort_etat SET extrait = 'Fermeté réussi = État « Couardise »', forme_trouvee = ' Couardise ' WHERE sort_id = 'magies/magie-de-lombre#sort:rayon-negatif' AND etat_id = 'guide/liste-des-alterations-d-etat#etat:couardise' AND relation = 'inflige' AND rang = 1 AND extrait = 'Fermeté réussi = État «Couardise»' AND forme_trouvee = 'Couardise';
UPDATE note_cellule SET texte = 'Les sorts Défaite annoncée et Explosion glorifique s''annulent mutuellement.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lombre#sort:defaite-annoncee' AND rang = 1 AND texte = 'Les sorts Défaite annoncée et Explosion glorifique s''annule mutuellement.';
UPDATE note_cellule SET texte = 'Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de sa santé totale.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lombre#sort:pire-ami' AND rang = 1 AND texte = 'Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de sa santé  totale.';
UPDATE note_cellule SET texte = 'La victime ne peut rien faire si ce n''est tenter un jet d''athlétisme/concentration/magie/équilibre pour sortir du sort, sauf que ses chances sont amoindries au début :
1re tentative : Réussite divisée par 2
2e tentative : Réussite divisée par 1.5
3e tentative : Réussite divisée par 1.25
4e tentative : Score normal

Un échec met fin au tour, une réussite libère la victime qui peut jouer normalement.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lombre#sort:chaine-de-lentrave' AND rang = 1 AND texte = 'La victime ne peut rien faire si ce n''est tenter un jet d''athlétisme/concentration/magie/équilibre pour sortir du sort, sauf que ses chances sont amoindri au début :
1e tentative : Réussite divisée par 2
2e tentative : Réussite divisée par 1.5
3e tentative : Réussite divisée par 1.25
4e tentative : Score normale

un échec met fin au tour, une réussite libère la victime qui peut jouer normalement.';
UPDATE note_cellule SET texte = 'Donne un effet négatif selon la santé restante parmi les suivants (les effets sont cumulatifs) :

Santé à 100% = Oblige un jet de fermeté à la cible, si elle rate, elle prend peur 1.

Santé à 80% = Réduit d''un cran la résistance à l''ombre de la cible pour 1 tour.

Santé à 60% = Inflige Couardise

Santé à 40% = Ignore 50% des AM

Santé à 20% = Le sort inflige + 40 dégâts' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-lombre#sort:frappe-negative' AND rang = 1 AND texte = 'Donne un effet négatif selon la santé restante parmi les suivants (les effets sont cumulatif) :

Santé à 100% = Oblige un jet de fermeté à la cible, si elle rate, elle prend peur 1.

Santé à 80% = Réduit d''un cran la résistance à l''ombre de la cible pour 1 tour.

Santé à 60% = Inflige Couardise

Santé à 40% = Ignore 50% des AM

Santé à 20% = Le sort inflige + 40 dégâts';
UPDATE note_cellule SET texte = 'Le bonus en force casse les limites de la carac (oui oui, on peut monter à 7 de force temporairement)' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-sang#sort:proportion-demesuree' AND rang = 2 AND texte = 'Le bonus en force casse les limites de la carac (oui oui, on peut monterà 7 de force temporairement)';
UPDATE note_cellule SET texte = 'NB : Jet de défense désigne les jets d''Esquive ET de Parade' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-du-sang#sort:sang-garde' AND rang = 1 AND texte = 'NB: Jet de défense désigne les jets d''Esquive ET de Parade';
UPDATE note_cellule SET texte = 'La Nécrose ne disparaît que quand le lanceur est hors combat ou mort.' WHERE entite_table = 'sort' AND entite_id = 'magies/magie-de-la-terre#sort:terre-maudite' AND rang = 1 AND texte = 'La Nécrose ne disparait que quand le lanceur est hors combat ou mort.';
-- page magies/potentiel-illimite : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'MAGIE DIFFICILE A JOUER !!', 'MAGIE DIFFICILE À JOUER !!') WHERE id = 'magies/potentiel-illimite';
UPDATE page SET corps_md = replace(corps_md, 'Le Potentiel Illimité, aussi appelé Absolu Incomplet ou Magie Universelle, est l’essence brute de la création et de la destruction. Elle est le point de départ de toutes les autres magies, un pouvoir si vaste et si versatile qu''il est impossible de l''égalé. Les rares élus qui en héritent détiennent le couteau suisse de la magie, capable de piocher dans toutes les magies pour lancer des sorts.', 'Le Potentiel Illimité, aussi appelé Absolu Incomplet ou Magie Universelle, est l’essence brute de la création et de la destruction. Elle est le point de départ de toutes les autres magies, un pouvoir si vaste et si versatile qu''il est impossible de l''égaler. Les rares élus qui en héritent détiennent le couteau suisse de la magie, capable de piocher dans toutes les magies pour lancer des sorts.') WHERE id = 'magies/potentiel-illimite';
UPDATE page SET corps_md = replace(corps_md, 'Des yeux dorés/oranges, ainsi que des mèches dorées. Le corps est parsemé de tatouages couleur orange qui deviennent dorées quand un sort est utilisé, plus il y a de puissance, plus les cicatrices brillent. Ils ont des physiques moins charnue que la plus part des gens et ils semblent tout le temps épuisés.', 'Des yeux dorés/oranges, ainsi que des mèches dorées. Le corps est parsemé de tatouages couleur orange qui deviennent dorés quand un sort est utilisé, plus il y a de puissance, plus les cicatrices brillent. Ils ont des physiques moins charnus que la plupart des gens et ils semblent tout le temps épuisés.') WHERE id = 'magies/potentiel-illimite';
UPDATE page SET corps_md = replace(corps_md, 'Le principal intérêt reposé sur sa versatilité, en effet cette magie pioche ses sorts dans toute les magies existante. Cette versatilité a un prix qui est de ne pouvoir atteindre que le niveau 3 de puissance magique maximum en plus d''être limité à peu de race.', 'Le principal intérêt repose sur sa versatilité, en effet cette magie pioche ses sorts dans toutes les magies existantes. Cette versatilité a un prix qui est de ne pouvoir atteindre que le niveau 3 de puissance magique maximum en plus d''être limité à peu de races.') WHERE id = 'magies/potentiel-illimite';
UPDATE page SET corps_md = replace(corps_md, '- Mono magie uniquement.', '- Mono-magie uniquement.') WHERE id = 'magies/potentiel-illimite';
UPDATE page SET corps_md = replace(corps_md, '- Surtension corporelle (Vulnérabilité contre les dégâts physique, ne peux mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau globale.', '- Surtension corporelle (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global.') WHERE id = 'magies/potentiel-illimite';
UPDATE page SET corps_md = replace(corps_md, '- Impossible de porter des armures lourdes ou bouclier lourds même si la classe vous le permet.', '- Impossible de porter des armures lourdes ou boucliers lourds même si la classe vous le permet.') WHERE id = 'magies/potentiel-illimite';
UPDATE page SET corps_md = replace(corps_md, 'AU CHOIX ou ALEATOIRE', 'AU CHOIX ou ALÉATOIRE') WHERE id = 'magies/potentiel-illimite';
UPDATE page SET corps_md = replace(corps_md, 'Résistance à la magie et dégâts physique neutre.', 'Résistance à la magie et dégâts physiques neutre.') WHERE id = 'magies/potentiel-illimite';
-- page bestiaire/animation-des-morts : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'N’importe qui peut vous aider pour créer une invocation double magie, et ça ne lui consomme pas son tour et ne lui demande pas de jet mais 1 IC (si jamais il en avait encore quand il a fini son tour). Seule excepetion : le potentiel illimité ne peut pas faire d''invocation double élément tout seul, il lui faut de l''aide extérieur et il ne peut pas aider à faire une invocation double élément vu qu''il ne possède pas la bonne magie.', 'N’importe qui peut vous aider pour créer une invocation double magie, et ça ne lui consomme pas son tour et ne lui demande pas de jet mais 1 IC (si jamais il en avait encore quand il a fini son tour). Seule exception : le potentiel illimité ne peut pas faire d''invocation double élément tout seul, il lui faut de l''aide extérieure et il ne peut pas aider à faire une invocation double élément vu qu''il ne possède pas la bonne magie.') WHERE id = 'bestiaire/animation-des-morts';
UPDATE page SET corps_md = replace(corps_md, 'Chaque invocation possède des statistiques et des données qui varie selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chère en coût. Bien entendu, seuls les utilisateurs d''une seul magie peuvent invoquer les créatures NPM 5.', 'Chaque invocation possède des statistiques et des données qui varient selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chères en coût. Bien entendu, seuls les utilisateurs d''une seule magie peuvent invoquer les créatures NPM 5.') WHERE id = 'bestiaire/animation-des-morts';
UPDATE page SET corps_md = replace(corps_md, '- Élémentaire. Chaque créature possède la/les résistances magiques ainsi que la/les vulnérabilités magiques de son élément (sauf capacité lui donnant autre chose). \[Exemple. Celui du feu est résistance au Feu, Terre et Glace mais est vulnérable au Vent et à l''Eau\]. Chaque attaque physique de leur part est une attaque élémentaire.', '- Élémentaire. Chaque créature possède la/les résistances magiques ainsi que la/les vulnérabilités magiques de son élément (sauf capacité lui donnant autre chose). \[Exemple. Celui du feu est résistant au Feu, Terre et Glace mais est vulnérable au Vent et à l''Eau\]. Chaque attaque physique de leur part est une attaque élémentaire.') WHERE id = 'bestiaire/animation-des-morts';
-- page bestiaire/appel-aux-golems : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'N’importe qui peut vous aider pour créer une invocation double magie, et ça ne lui consomme pas son tour et ne lui demande pas de jet mais 1 IC (si jamais il en avait encore quand il a fini son tour). Seule excepetion : le potentiel illimité ne peut pas faire d''invocation double élément tout seul, il lui faut de l''aide extérieur et il ne peut pas aider à faire une invocation double élément vu qu''il ne possède pas la bonne magie.', 'N’importe qui peut vous aider pour créer une invocation double magie, et ça ne lui consomme pas son tour et ne lui demande pas de jet mais 1 IC (si jamais il en avait encore quand il a fini son tour). Seule exception : le potentiel illimité ne peut pas faire d''invocation double élément tout seul, il lui faut de l''aide extérieure et il ne peut pas aider à faire une invocation double élément vu qu''il ne possède pas la bonne magie.') WHERE id = 'bestiaire/appel-aux-golems';
UPDATE page SET corps_md = replace(corps_md, 'Chaque invocation possède des statistiques et des données qui varie selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chère en coût. Bien entendu, seuls les utilisateurs d''une seul magie peuvent invoquer les créatures NPM 5.', 'Chaque invocation possède des statistiques et des données qui varient selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chères en coût. Bien entendu, seuls les utilisateurs d''une seule magie peuvent invoquer les créatures NPM 5.') WHERE id = 'bestiaire/appel-aux-golems';
UPDATE page SET corps_md = replace(corps_md, 'Il existe plusieurs versions de golems invocable, ça varie selon les magies de l''utilisateur de la Terre ou bien de l''aide d''un allié. Car en effet, un allié peut très bien influer sa propre magie dans votre sort "Appel aux golems"', 'Il existe plusieurs versions de golems invocables, ça varie selon les magies de l''utilisateur de la Terre ou bien de l''aide d''un allié. Car en effet, un allié peut très bien influer sa propre magie dans votre sort "Appel aux golems".') WHERE id = 'bestiaire/appel-aux-golems';
UPDATE page SET corps_md = replace(corps_md, '- Élémentaire. Chaque créature possède la/les résistances magiques ainsi que la/les vulnérabilités magiques de son élément. \[Exemple. Celui du feu est résistante au Feu, Terre et Glace mais est vulnérable au Vent et à l''Eau\]. Chaque attaque physique de leur part est une attaque élémentaire. (Le Golem d''Argile ne possède pas cette capacité)', '- Élémentaire. Chaque créature possède la/les résistances magiques ainsi que la/les vulnérabilités magiques de son élément. \[Exemple. Celui du feu est résistant au Feu, Terre et Glace mais est vulnérable au Vent et à l''Eau\]. Chaque attaque physique de leur part est une attaque élémentaire. (Le Golem d''Argile ne possède pas cette capacité)') WHERE id = 'bestiaire/appel-aux-golems';
-- page bestiaire/marionette-de-lombre : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Chaque invocation possède des statistiques et des données qui varie selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chère en coût. Bien entendu, seuls les utilisateurs d''une seul magie peuvent invoquer les créatures NPM 5.', 'Chaque invocation possède des statistiques et des données qui varient selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chères en coût. Bien entendu, seuls les utilisateurs d''une seule magie peuvent invoquer les créatures NPM 5.') WHERE id = 'bestiaire/marionette-de-lombre';
-- page bestiaire/executeur-lunaire : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, '- Tous les sorts de l''ombre vole 2d6 chakra', '- Tous les sorts de l''ombre volent 2d6 chakra') WHERE id = 'bestiaire/executeur-lunaire';
-- page magies/magie-du-sang : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'La magie du Sang marque beaucoup sur la taille et la musculature qui est plus élevé que la moyenne (comme pour la terre), les veines sont apparentes un peu partout et augmente au fur et à mesure des niveaux de magie, les mèches des cheveux est couleurs bordeaux, les yeux sont bordeaux en combat.', 'La magie du Sang marque beaucoup sur la taille et la musculature qui est plus élevée que la moyenne (comme pour la terre), les veines sont apparentes un peu partout et augmentent au fur et à mesure des niveaux de magie, les mèches des cheveux sont couleur bordeaux, les yeux sont bordeaux en combat.') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, '+1d de dégâts reçu (+1d/3NM)', '+1d de dégâts reçus (+1d/3NM)') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'La cible est attirée de 3 cases vers le lanceur ne fonctionne que en ligne.', 'La cible est attirée de 3 cases vers le lanceur ne fonctionne qu''en ligne.') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, '+6AP.  Dure 3 tours.', '+6AP. Dure 3 tours.') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Saignement particulier = Saignement de stade 1 qui ne se soigne pas et qui se cumule pas avec le Saignement classique. N''augmente pas en intensité mais redémarre le nombre si répéter.', 'Saignement particulier = Saignement de stade 1 qui ne se soigne pas et qui se cumule pas avec le Saignement classique. N''augmente pas en intensité mais redémarre le nombre si répété.') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Aspire 25% des PV infligés et les convertis en PV. Ne marche que sur les créature vivante (50% au niveau 3 de maîtrise)', 'Aspire 25% des PV infligés et les convertit en PV. Ne marche que sur les créatures vivantes (50% au niveau 3 de maîtrise)') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Le mur est fixée au sol.', 'Le mur est fixé au sol.') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Donne une régénaration à un allié pendant 3 tours. Le lanceur doit réussir un jet de vigueur pour ne pas prendre saignement 1.', 'Donne une régénération à un allié pendant 3 tours. Le lanceur doit réussir un jet de vigueur pour ne pas prendre saignement 1.') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Vu que c''est une régénération, la santé récupéré par tour se détermine au premier jet.', 'Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet.') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Si jet de stabilité/réfléxe raté = La cilbe tombe par terre, inflige 4d6 de contre coup. (pas de contre coup au niveau 3 de maîtrise)', 'Si jet de stabilité/réflexe raté = La cible tombe par terre, inflige 4d6 de contrecoup. (pas de contrecoup au niveau 3 de maîtrise)') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Augmente la taille d''un cran, +1 Force, +15 (+5/NM) aux dégâts physique, +1 portée pour 3 tours, inflige fatigue à la fin.', 'Augmente la taille d''un cran, +1 Force, +15 (+5/NM) aux dégâts physiques, +1 portée pour 3 tours, inflige fatigue à la fin.') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Brock, libérez en moi l''excès ...', 'Brock, libérez en moi l''excès...') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Donne toute sa santé à 4 Cibles alliées. Coma. (Garde 1 santé à 3NM)', 'Donne toute sa santé à 4 cibles alliées. Coma. (Garde 1 santé à 3NM)') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'ligne de 3', 'Ligne de 3') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'Le bonus en force casse les limites de la carac (oui oui, on peut monterà 7 de force temporairement)', 'Le bonus en force casse les limites de la carac (oui oui, on peut monter à 7 de force temporairement)') WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = replace(corps_md, 'NB: Jet de défense désigne les jets d''Esquive ET de Parade', 'NB : Jet de défense désigne les jets d''Esquive ET de Parade') WHERE id = 'magies/magie-du-sang';
-- page magies/magie-de-larcane : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs de l''arcane sont marqués surtout aux niveau des cheveux et du corps, les cheveux possèdent des mèches de couleur argentée et le corps est parsemé de tatouages couleur argent qui deviennent blanc brillant aussi quand un sort est utilisé, plus il y a de puissance, plus les tatouages brillent.', 'Les utilisateurs de l''arcane sont marqués surtout au niveau des cheveux et du corps, les cheveux possèdent des mèches de couleur argentée et le corps est parsemé de tatouages couleur argent qui deviennent blanc brillant aussi quand un sort est utilisé, plus il y a de puissance, plus les tatouages brillent.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Chaque sort qui possède un coût en chakra "x/tour" ne possède pas de limite de tour et vont consommer du chakra tant qu''ils sont actif. Le lanceur doit faire un jet de magie pour pouvoir réussir son sort (normal jusque là) et une fois le sort lancé, le sort est maintenu tant que le lanceur le décide ou qu''il perd sa concentration. Il est possible de cumuler plusieurs fois le même sort ou alors de placer le même sort sur différentes cibles, le coût par tour en sera bien plus grand vu que tout se cumule.', 'Chaque sort qui possède un coût en chakra "x/tour" ne possède pas de limite de tour et va consommer du chakra tant qu''il est actif. Le lanceur doit faire un jet de magie pour pouvoir réussir son sort (normal jusque-là) et une fois le sort lancé, le sort est maintenu tant que le lanceur le décide ou qu''il perd sa concentration. Il est possible de cumuler plusieurs fois le même sort ou alors de placer le même sort sur différentes cibles, le coût par tour en sera bien plus grand vu que tout se cumule.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Perdre son sort : Si jamais une attaque est encaissée, il est nécessaire de faire un jet de magie/concentration, si jamais il est raté, la concentration est perdu et tout les sorts qui était actif s''arrête immédiatement.', 'Perdre son sort : Si jamais une attaque est encaissée, il est nécessaire de faire un jet de magie/concentration, si jamais il est raté, la concentration est perdue et tous les sorts qui étaient actifs s''arrêtent immédiatement.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Un sort qui possède la mention : XxN/tour, veut dire que le sort va couté un certain nombre de chakra (X) par nombre d''application qu''il y a eu (N) par tour.', 'Un sort qui possède la mention : XxN/tour, veut dire que le sort va coûter un certain nombre de chakra (X) par nombre d''applications qu''il y a eu (N) par tour.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Exemple : J''ai posé sur 3 personnes différentes un sort qui coute 3. Donc en 1 tour je vais consommer 9 chakra.', 'Exemple : J''ai posé sur 3 personnes différentes un sort qui coûte 3. Donc en 1 tour je vais consommer 9 chakra.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, '+X dégâts magique', '+X dégâts magiques') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Si jet de Fermeté raté = La cible ne peut utiliser de sorts pendant son tour. Ne peut être fait 2 fois de suite sur la même cible.', 'Si jet de fermeté raté = La cible ne peut utiliser de sorts pendant son tour. Ne peut être fait 2 fois de suite sur la même cible.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Souffle du chakra pour en donner une quantité au choix à la ou aux cibles. Si il y a plusieurs cibles, le chakra donné est divisé.', 'Souffle du chakra pour en donner une quantité au choix à la ou aux cibles. S''il y a plusieurs cibles, le chakra donné est divisé.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Bloque 40 (+10/NM) dégâts par tour pendant 3 tours, est détruit si il prend plus en 1 tour.', 'Bloque 40 (+10/NM) dégâts par tour pendant 3 tours, est détruit s''il prend plus en 1 tour.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Le regain ne peut être effectif que si c''est la barrière ennemi qui est touchée.', 'Le regain ne peut être effectif que si c''est la barrière ennemie qui est touchée.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Invoque un cercle qui va rendre de la barrière aux alliés et infliger des dégâts aux ennemis (3 NM = les dégâts ignore les AM).', 'Invoque un cercle qui va rendre de la barrière aux alliés et infliger des dégâts aux ennemis (3 NM = les dégâts ignorent les AM).') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, '-20% dégâts magique', '-20% dégâts magiques') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Fait pleuvoir une pluie blanche brillante aux dessus des alliés, leur redonnant ainsi 25% de leur chakra.', 'Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi 25% de leur chakra.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Inflige de lourd dégâts.', 'Inflige de lourds dégâts.') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'illimité', 'Illimité') WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = replace(corps_md, 'Les dégâts correspondent aux CK donnés par le lanceur et alliés. 2CK (1CK/3NM) = 1 Dégâts', 'Les dégâts correspondent aux CK donnés par le lanceur et alliés. 2CK (1CK/3NM) = 1 dégâts') WHERE id = 'magies/magie-de-larcane';
-- page magies/magie-de-la-corruption : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs de la corruption sont marqués surtout aux niveau des cheveux et du corps, les cheveux possèdent des mèches de couleur noires et le corps est parsemé de tatouages couleur antrasite qui deviennent noir aussi quand un sort est utilisé, plus il y a de puissance, plus les tatouages sont de plus en plus noirs.', 'Les utilisateurs de la corruption sont marqués surtout au niveau des cheveux et du corps, les cheveux possèdent des mèches de couleur noire et le corps est parsemé de tatouages couleur anthracite qui deviennent noirs aussi quand un sort est utilisé, plus il y a de puissance, plus les tatouages sont de plus en plus noirs.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'L''utilisateur de la corruption est un combattant qui fait énormément de dégâts et utilise énormément d''entrave. Il utilise le Chakra et la Corruption comme un système de vases communiquant.', 'L''utilisateur de la corruption est un combattant qui fait énormément de dégâts et utilise énormément d''entrave. Il utilise le Chakra et la Corruption comme un système de vases communicants.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Chaque sorts demande du chakra, à chaque utilisation d''un sort, le coût en chakra se transfert dans la corruption (si un sort coûte 4, vous obtenez 4 corruption), il est possible d''utiliser cette réserve de corruption pour lancer les mêmes sorts mais avec des effets supplémentaires mais il faut consommer le double du cout en corruption (si le sort coute 4, il vous faut 8 corruption). Bien entendu ceux qui sont de la corruption sont totalement immunisé à l''effet négatif du trop plein de corruption (qui est la transformation en abomination solvité, donc une mort du personnage) mais prudence, car quand on est gavé de corruption cela se voit physiquement sur le personnage et la corruption reste une magie mal vu.', 'Chaque sort demande du chakra, à chaque utilisation d''un sort, le coût en chakra se transfère dans la corruption (si un sort coûte 4, vous obtenez 4 corruption), il est possible d''utiliser cette réserve de corruption pour lancer les mêmes sorts mais avec des effets supplémentaires mais il faut consommer le double du coût en corruption (si le sort coûte 4, il vous faut 8 corruption). Bien entendu ceux qui sont de la corruption sont totalement immunisés à l''effet négatif du trop-plein de corruption (qui est la transformation en abomination solvité, donc une mort du personnage) mais prudence, car quand on est gavé de corruption cela se voit physiquement sur le personnage et la corruption reste une magie mal vue.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Attention, si le chakra permet d''obtenir de la corruption, l''inverse ne se fait pas. Et la corruption n''enpiète pas dans l''espace du chakra.', 'Attention, si le chakra permet d''obtenir de la corruption, l''inverse ne se fait pas. Et la corruption n''empiète pas dans l''espace du chakra.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Toutes les magies ne peuvent pas se combiner avec la corruption, c''est mono magie uniquement. Seuls les Elfes noirs (Charbon) et les Felfe noirs peuvent cette magie en innée/acquis avec uen autre magie (les limitations de la magie acquise s''applique pour les magies primordialles : Pas d''arcane, sang ou espace/temps)', 'Toutes les magies ne peuvent pas se combiner avec la corruption, c''est mono-magie uniquement. Seuls les Elfes noirs (Charbon) et les Felfes noirs peuvent cette magie en innée/acquis avec une autre magie (les limitations de la magie acquise s''appliquent pour les magies primordiales : Pas d''arcane, sang ou espace/temps)') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Divise par 2 le cout en corruption des sorts.', 'Divise par 2 le coût en corruption des sorts.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Si la cible est dans la posture indiquée à ce moment là, il doit changer de posture de suite.', 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Les verrouillages ne se cumule pas.', 'Les verrouillages ne se cumulent pas.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Imprégne l''arme d''une énergie mauvaise. inflige 5 point de corruption.', 'Imprègne l''arme d''une énergie mauvaise. Inflige 5 points de corruption.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Entave (IC pour 3 NM)', 'Entrave (IC pour 3 NM)') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Pose une zone qui ralenti ceux qui sont dedans. Capable de brûler.', 'Pose une zone qui ralentit ceux qui sont dedans. Capable de brûler.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Bien entendu on est pas bloqué à vie, il est possible d''en sortir avec un jet d''athlétisme/équilibre, si il est raté, il faut attendre le prochain tour pour réssayer. C''est juste le mouvement qui est bloqué, pas l''action évidemment.', 'Bien entendu on est pas bloqué à vie, il est possible d''en sortir avec un jet d''athlétisme/équilibre, s''il est raté, il faut attendre le prochain tour pour réessayer. C''est juste le mouvement qui est bloqué, pas l''action évidemment.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Attaque /Construction', 'Attaque/Construction') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Pose une mine qui explose quand une cible touche la zone.  Ne se voit pas.', 'Pose une mine qui explose quand une cible touche la zone. Ne se voit pas.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Elle peut se voir mais seulement avec un jet d''observation/distinction réussi en posture vigilance et seulement a portée de vue (Score de perception)', 'Elle peut se voir mais seulement avec un jet d''observation/distinction réussi en posture vigilance et seulement à portée de vue (Score de perception)') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Dure 3 tours. Si jet de Calme raté = Impossibilité pour la cible d''approcher. Si CR : Ceux qui rate le jet fuit.', 'Dure 3 tours. Si jet de Calme raté = Impossibilité pour la cible d''approcher. Si CR : Ceux qui ratent le jet fuient.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Explose dans 1 tour, inflige d''énorme dégâts de zone. (3NM = La grenade colle la cible)', 'Explose dans 1 tour, inflige d''énormes dégâts de zone. (3NM = La grenade colle la cible)') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Si CR : Le sort est innesquivable.', 'Si CR : Le sort est inesquivable.') WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = replace(corps_md, 'Fouet ténèbreux', 'Fouet ténébreux') WHERE id = 'magies/magie-de-la-corruption';
-- page magies/magie-de-lespace-temps : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs de l’Espace-Temps peuvent, à un niveau basique, créer des portails pour se déplacer rapidement entre deux points. Les plus puissants pratiquants de cette magie sont capable de manipuler l’espace autour de leurs adversaires, les téléportant contre leur gré, les envoyant dans des pièges ou les isolant de leurs alliés.', 'Les utilisateurs de l’Espace-Temps peuvent, à un niveau basique, créer des portails pour se déplacer rapidement entre deux points. Les plus puissants pratiquants de cette magie sont capables de manipuler l’espace autour de leurs adversaires, les téléportant contre leur gré, les envoyant dans des pièges ou les isolant de leurs alliés.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Bien qu’elle ne soit pas une magie de destruction directe, la magie de l’Espace-Temps est l’ultime outil tactique, rendant ses utilisateurs difficiles à approcher. Ne les sous-estimés jamais, ils ont toujours un coup d''avance par rapport à vous.', 'Bien qu’elle ne soit pas une magie de destruction directe, la magie de l’Espace-Temps est l’ultime outil tactique, rendant ses utilisateurs difficiles à approcher. Ne les sous-estimez jamais, ils ont toujours un coup d''avance par rapport à vous.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs de l''Espace/Temps possèdent d''étrange bandages de momies couleur roses sur les mains, bras (jusqu''en bas du coude), pied et jambes (jusqu''en bas du genou) et semble être impossible à enlever ou détruire, comme si c''était une seconde peau. Les mèches de cheveux sont roses.', 'Les utilisateurs de l''Espace/Temps possèdent d''étranges bandages de momies couleur rose sur les mains, bras (jusqu''en bas du coude), pieds et jambes (jusqu''en bas du genou) et semblent être impossibles à enlever ou détruire, comme si c''était une seconde peau. Les mèches de cheveux sont roses.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, '6 (+1/ NM)', '6 (+1/NM)') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Permet d''échanger sa place par rapport à un objet de taille a peu près égale et qui n''est pas "indéplaçable"', 'Permet d''échanger sa place par rapport à un objet de taille à peu près égale et qui n''est pas "indéplaçable"') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Rend l''arme rose et noir, tape dans l''élément Temps/Espace pendant 3 tours.', 'Rend l''arme rose et noire, tape dans l''élément Temps/Espace pendant 3 tours.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Si jet de Fermeté raté =  -2 à la vitesse de la cible pour 3 tours.', 'Si jet de Fermeté raté = -2 à la vitesse de la cible pour 3 tours.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Échange sa place avec celui de la cible', 'Échange sa place avec celle de la cible') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Peut être contrer par "Téléportation"', 'Peut être contré par "Téléportation"') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Invoque une main géante en bandelette, téléporte la cible symtriquement par rapport au lanceur. (choix possible)', 'Invoque une main géante en bandelette, téléporte la cible symétriquement par rapport au lanceur. (choix possible)') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Permet d''invoqué un portail piéger qui est relié aux autres portails. (3NM = Pas de dégâts alliés)', 'Permet d''invoquer un portail piégé qui est relié aux autres portails. (3NM = Pas de dégâts alliés)') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Vampirise 25% des dégâts infligé. (50% au niveau 3 de maîtrise), marche que sur les créature vivante.', 'Vampirise 25% des dégâts infligés. (50% au niveau 3 de maîtrise), marche que sur les créatures vivantes.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Si c''est la barrière, la barrière est vampirisé.', 'Si c''est la barrière, la barrière est vampirisée.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Si c''est les points de vies, c''est les points de vies qui sont vampirisés', 'Si c''est les points de vie, c''est les points de vie qui sont vampirisés') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Un boss qui a naturellement 2 tour, n''aura qu''un seul tour avec deux actions.', 'Un boss qui a naturellement 2 tours, n''aura qu''un seul tour avec deux actions.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Téléporte symtriquement par rapport à la grenade toutes les cibles dans son rayon d''action.', 'Téléporte symétriquement par rapport à la grenade toutes les cibles dans son rayon d''action.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'si le lanceur est dans la zone d''action de la grenade, il peut décidé de ne pas être téléporter.', 'Si le lanceur est dans la zone d''action de la grenade, il peut décider de ne pas être téléporté.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Permet de voyager sur de grande distance. Les autres doivent touché le lanceur pour être téléporter.', 'Permet de voyager sur de grandes distances. Les autres doivent toucher le lanceur pour être téléportés.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Invoque 1 ou 2 clones (+1/NM) passif du lanceur.', 'Invoque 1 ou 2 clones (+1/NM) passifs du lanceur.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Ces clones imite le lanceur dans ces actions mais sans pour autant faire des dégâts ou des effets sur les autres.', 'Ces clones imitent le lanceur dans ses actions mais sans pour autant faire des dégâts ou des effets sur les autres.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Si jamais une attaque risque d''arriver sur le lanceur, cette attaque à 50% de chance d''atterrir  sur un des clones.', 'Si jamais une attaque risque d''arriver sur le lanceur, cette attaque a 50% de chance d''atterrir sur un des clones.') WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = replace(corps_md, 'Lors qu''il subit une attaque/effet qui le bouge, il peut décider de bouger ou non.', 'Lorsqu''il subit une attaque/effet qui le bouge, il peut décider de bouger ou non.') WHERE id = 'magies/magie-de-lespace-temps';
-- page magies/magie-du-vide : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs du vide ont une pilosité blanche et possèdent une inversion aux niveau des yeux, le blanc de l''oeil devient noir.', 'Les utilisateurs du vide ont une pilosité blanche et possèdent une inversion au niveau des yeux, le blanc de l''œil devient noir.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Impose un désavantage (jette 2d100, garde le moins bon)à la première attaque tenter contre lui.', 'Impose un désavantage (jette 2d100, garde le moins bon) à la première attaque tentée contre lui.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Impose un désavantage (jette 2d100, garde le moins bon) aux ennemis qui tente des attaques contre lui.', 'Impose un désavantage (jette 2d100, garde le moins bon) aux ennemis qui tentent des attaques contre lui.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'La taille de l''objet n''est pas infini, il faut un certain niveau de magie pour certains objets', 'La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'La cible ne peut utiliser de sorts pendant 2 tours. Malus de 60% si jamais il est fait sur une cible qui a déjà subit le sort.', 'La cible ne peut utiliser de sorts pendant 2 tours. Malus de 60% si jamais il est fait sur une cible qui a déjà subi le sort.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Si jet d''athlétisme/équilibre raté = Les cibles s’affaisse et sont incapable de bouger pour leur prochain tour.', 'Si jet d''athlétisme/équilibre raté = Les cibles s’affaissent et sont incapables de bouger pour leur prochain tour.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Les buff niveau 5 ne peuvent pas être annulé par ce sort.', 'Les buff niveau 5 ne peuvent pas être annulés par ce sort.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Inflige des dégâts fixe à 4 ennemis visible. (Ignore les AM et BA pour 3NM)', 'Inflige des dégâts fixes à 4 ennemis visibles. (Ignore les AM et BA pour 3NM)') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'L''équipement le devient aussi, les sorts et les attaques ne touche pas, SEULES les armes spectrales fonctionne dans cet état.', 'L''équipement le devient aussi, les sorts et les attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans cet état.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'L''équipement le devient aussi donc les attaques et sorts ne fonctionne pas, SEULES les armes spectrales fonctionne dans cet état.', 'L''équipement le devient aussi donc les attaques et sorts ne fonctionnent pas, SEULES les armes spectrales fonctionnent dans cet état.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Vampirise 25% des dégâts, marche que sur les créature vivante.', 'Vampirise 25% des dégâts, marche que sur les créatures vivantes.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Si c''est la barrière, la barrière est vampirisé.', 'Si c''est la barrière, la barrière est vampirisée.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Si c''est les points de vies, c''est les points de vies qui sont vampirisés', 'Si c''est les points de vie, c''est les points de vie qui sont vampirisés') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, '3NM = les altérations d''états sont 1 cran au dessus et les croix dure 1 tour de plus.', '3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, '19 : Retire tout les effets positifs de la cible', '19 : Retire tous les effets positifs de la cible') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Permet de résister à tout agression mentale. (3NM = Immunité au contrôle mental passif)', 'Permet de résister à toute agression mentale. (3NM = Immunité au contrôle mental passif)') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'La cible sera partiellement immatériel. Impose un désavantage aux jets d''attaques des agresseurs. Dure 2 tours.', 'La cible sera partiellement immatérielle. Impose un désavantage aux jets d''attaques des agresseurs. Dure 2 tours.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Les NM sont utile pour le sort aléatoire', 'Les NM sont utiles pour le sort aléatoire') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Et puisse le sort surgisse, imprévisible et irrévocable…', 'Et puisse le sort surgir, imprévisible et irrévocable…') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'METRONOME !', 'MÉTRONOME !') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Ne peut pas être relancer.', 'Ne peut pas être relancé.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Inflige de terrible dégâts de vide sur une zone.', 'Inflige de terribles dégâts de vide sur une zone.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = replace(corps_md, 'Invoque un sablier qui aspire la santé des adversaires autour de lui et le retransmet au tour suivant aux alliés. Possède 20 PV.', 'Invoque un sablier qui aspire la santé des adversaires autour de lui et la retransmet au tour suivant aux alliés. Possède 20 PV.') WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = 'La magie de la nécromancie est une magie spécialisée dans l''invocation et l''entrave. Héritée de la Déesse de la Vie et de la Mort, elle permet de manipuler les forces liées au trépas, aux âmes et aux non-morts.

Les utilisateurs de la nécromancie peuvent invoquer des squelettes, des zombis et d''autres serviteurs non-morts pour combattre à leurs côtés. Ils sont également capables d''affaiblir leurs ennemis, de perturber leur vitalité ou de leur faire de bons dégâts avec le poison.

Associée au deuil, une émotion liée à l''acceptation et à la fixation, la nécromancie rappelle que la mort fait partie du cycle naturel du monde. Si certains utilisent ce pouvoir pour guider les âmes vers leur jugement, d''autres choisissent d''exploiter les morts pour satisfaire leurs propres ambitions.

## Description physique

Les nécromanciens sont généralement plus minces que la moyenne, voire maigres pour les plus anciens, avec moins de formes. Une aura verte émane de leurs mains et ils possèdent des excroissances osseuses par endroits (coude, genou, épaule, phalanges, etc.).

## Données

- **Santé offert** : 5.0
- **Chakra offert** : 5.0
- **Caractéritiques bonus** : VOLONTÉ
- **4ème barre** : Cette magie utilise la 4ème barre. Elle possède un maximum de 10 Âmes et la régénère de 1 par tour.
- **Résistance magique** : Nécromancie, Sang, Foudre
- **Résistance altération d''état** : Poison, Saignement, Paralysie
- **Vulnérabilité magique** : Glace, Eau
- **Vulnérabilité altération d''état** : Gelé, Confusion
- **Magie non compatible** : Sang

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Permet d''avoir deux invocations au lieu d''une seule. Passe le sort animation de mort en IC (ICx2 si jamais il est déjà en IC) |
| Bi-magie | Permet d''avoir deux invocations au lieu d''une seule. |

## Rôles

- INVOCATION
- ENTRAVE
- RENFORCEMENT

## TABLEAU "AMELIORATION CADAVERIQUE"

| Amélioration | Effet |
| --- | --- |
| Zombi | +6 AP, +8 dégâts, Rés Nécromancie |
| Zombinox | 30 PV qui prendront les coups avant la barrière. |
| Goule | Chaque coup physique sera répondu par 5 de C sur l''agresseur |
| Momie | Res Temps/Espace, 50% de chance d''infliger Malédiction à la cible. |
| Fantôme | Res Vide, 25% de chance d''ignorer une attaque. |
| Embrasé | Res Feu, 25% de chance que la cible se brûle. |
| Noyé | Res Eau, Double la vitesse dans l''eau |
| Os Froid | Res Glace, Dégâts magiques divisés par 2 |
| S. de pierre | Res Terre, Dégâts physiques divisés par 2 |
| Zompi | Res Vent, "Crache spore" chaque tour |
| Réanimé | Res Foudre, +3 INI et +1 Vitesse |
| S. rayonnant | Res Lumière, Peut sacrifier l''amélioration pour "Sacrifice lumineux" |
| Zombi obscur | Res Ombre, "Mantelet des ténèbres" passif |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Tir d''âme | Attaque | 3 + 1 âme | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Tire une âme en direction de la cible. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre poison 1. |
| 1.0 | Animation de mort | Invocation (IC pour 3 NM) | 5 + 1 âme (xNPM de créature) | 3.0 | 1.0 | / | Permet d''invoquer des non-morts (voir invocation) |
| 1.0 | Mur d''os | Construction | 4 + 1 âme | 2.0 | 3 cases (+1/NM) | / | Invoque des murs d''os qui possèdent 10 PV chacun. |
| 1.0 | Corruption d''âme | Attaque/ Entrave | 2 âmes | 1 (+1/NM) | 1.0 | 2d6 dégâts | Si jet de vigueur raté = Inflige "poison 1" |
| 1.0 | Détection de vie | Amplification | 7 (–1/NM) + 1 âme | Soi-même | 100 mètres | / | Permet de voir distinctement les formes de vie (animaux et végétaux, ces derniers étant plus sombres) |
| 2.0 | Forces des âmes | Amplification (IC pour 3 NM) | 1 âme pour +3 dégâts | 0 (+1/NM) | 1.0 | 3 dégâts/1 âme | Permet d''augmenter sa puissance grâce à deux âmes pour le prochain coup. (Maxi 5 âmes d''un coup) |
| 2.0 | Pieu d''os | Attaque | 7 + 2 âmes | 6 (+1/NM) | Cercle de 2 | 3d8 + 4 dégâts. | Invoque de pieu depuis le sol. Si jet de vigueur raté = Inflige poison 1 |
| 2.0 | Armure d''os | Amplification (IC pour 3 NM) | 5 + 2 âmes | 4.0 | 1.0 | +2AP (+1/NM) | Augmente les AP ainsi que la résistance aux attaques de taille. Dure 3 tours |
| 2.0 | Détection de la mort | Amplification | 10 (–1/NM) + 2 âmes | Soi-même | 100 mètres | / | Permet de détecter distinctement les non-morts et les utilisateurs de la nécromancie. |
| 2.0 | Fer Toxique | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme suinte une matière toxique, tape dans l''élément Nécromancie pendant 3 tours. |
| 3.0 | Festin des âmes | Attaque | 12 + 6 âmes | Soi-même | 4 cibles | 3d6 dégâts par tour | Des âmes affamées attaquent les 4 ennemis les plus proches. Dure 2 tours (+1/NM). |
| 3.0 | Poison de masse | Entrave | 13 (-1/NM) | Soi-même | Cercle de 6 | Inflige poison stade 1 | Si jet de vigueur raté = Inflige Empoisonné stade 1 à tous les ennemis dans la zone. |
| 3.0 | Prison d''os | Construction | 12 + 3 âmes | 6 (+1/NM) | Carré 3x3 | / | Emprisonne chair comme âme. 20 santé. |
| 3.0 | Forge de ses morts | Amplification (IC pour 3 NM) | 9 + 2 âmes | Soi-même | 1.0 | / | Utilise des âmes pour créer des armes simples, 1 seule utilisation (+1 par NM). |
| 3.0 | Câlin putréfié | Attaque | 13 + 3 âmes | 3 (+1/NM) | 1.0 | 7d6 + 15 dégâts | Invoque un zombie qui va tomber sur l''adversaire. Si jet de vigueur raté = Inflige Empoisonné stade 1. |
| 4.0 | Amélioration<br>Cadavérique | Amplification | 20 + 4 âmes | 0 (+1/NM) | 1.0 | Variable | Sacrifie l''invocation pour des amplifications pendant 3 tours (voir invocations) |
| 4.0 | Vague de cadavre | Attaque | 20 + 4 âmes | 4 (+1/NM) | Ligne de 5 cases | 6d6 + 6 dégâts | Invoque une vague de cadavre qui va s’écraser sur l''ennemi. Si jet de vigueur raté = Inflige Empoisonné stade 1. |
| 4.0 | Grenade caustique | Attaque | 25 + 4 âmes | 6.0 | Cercle de 3 | 6d6 + 35 dégâts | Si jet de vigueur raté = Inflige Empoisonné stade 2 à toutes les cibles (3NM = Sauf alliés). |
| 4.0 | Cimetière ouvert | Météo | 18 + 4 âmes | Soi-même | Terrain | / | Invoque la météo "Purée de poix" pendant 3 tours (+1/NM). |
| 4.0 | Répar Os | Soin | 20 + 5 âmes | 1.0 | 1.0 | Soigne 6d6 (+7/NM) | Permet de soigner les os et chair. |
| 5.0 | Déchirure | Attaque | 65 (-5/NM) | 5.0 | 1.0 | 10d6 + 50 dégâts (+10/NM) | Une terrible attaque qui inflige de gros dégâts, Si jet de vigueur raté = Inflige poison 2. |
| 5.0 | Réanimation | Invocation | 45 (-2/NM) + 10 âmes | 1.0 | 1.0 | / | Permet de réanimer un corps mort et d’en garder le contrôle pendant 1h. |
| 5.0 | Résurrection Noir | Soin | 35 (-2/NM) + 10 âmes | 5.0 | 1.0 | / | Revient sans PV, le chakra est utilisé comme énergie. |

## Notes et commentaires des sorts

**Commentaire résolu de la cellule « Coût » du sort « Animation de mort »**

Niveau 1 : 3 CK + 1 âme  
Niveau 2 : 6 CK + 2 âmes  
Niveau 3 : 12 CK + 3 âmes  
Niveau 4 : 24 CK + 4 âmes  
Niveau 5 : 48 CK + 5 âmes

**Note de la cellule « Effets secondaires » du sort « Animation de mort »**

Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.

**Commentaire résolu de la cellule « Effets secondaires » du sort « Animation de mort »**

Pour voir les morts-vivants possibles <https://maverick-jdr.fandom.com/fr/wiki/Mort-Vivant_(Invocation)>

Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

**Note de la cellule « Effets secondaires » du sort « Détection de vie »**

Ce sort permet de changer de vision et de voir la vie grouiller autour de soi, la vie se montre sous forme de petite brume, il est possible de détecter de l''humanoïde au simple brin d''herbe.

Attention un simple mur empêche de voir à travers ce dernier.

**Note de la cellule « Effets secondaires » du sort « Fer Toxique »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être empoisonné au stade 1

**Note de la cellule « Effets secondaires » du sort « Prison d''os »** : La prison d''os est Invulnérable à l''estoc, Résistant à la taille mais vulnérable à la frappe.

**Note de la cellule « Effets secondaires » du sort « Forge de ses morts »**

Cette arme est considérée comme Spectrale.  
Arme Spectrale = Peut toucher l''immatériel et ignore les AP.

**Commentaire résolu de la cellule « Effets secondaires » du sort « Forge de ses morts »**

Cette arme est considérée comme Spectrale.  
Arme Spectrale = Peut toucher l''immatériel et ignore les PA.

**Note de la cellule « Effets secondaires » du sort « Résurrection Noir »** : Est considérée comme morte tant que la cible n''a pas bu 1 super fiole de soin par jour sur 1 mois. Ou alors qu''une résurrection est appliquée sur lui.

**Commentaire résolu de la cellule « Effets secondaires » du sort « Résurrection Noir »** : Est considéré comme mort tant que la cible n''a pas bu 1 fiole par jour sur 5 jours. Ou alors qu''une résurrection est appliquée sur lui.

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-la-necromancie';
-- page magies/magie-du-feu : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs du feu ont certaines mèches rouges vif, les yeux rouges lors de l''utilisation d''un sort, possèdent des brûlures un peu partout sur le corps, leurs mains sont un peu calcinés (comme du bois brûlé encore chaud) et produisent du feu.', 'Les utilisateurs du feu ont certaines mèches rouges vif, les yeux rouges lors de l''utilisation d''un sort, possèdent des brûlures un peu partout sur le corps, leurs mains sont un peu calcinées (comme du bois brûlé encore chaud) et produisent du feu.') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, '(Réaction) Lors d''une agression, permet de répondre par une contre attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/3 tours)', '(Réaction) Lors d''une agression, permet de répondre par une contre-attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/3 tours)') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, '(Réaction) Lors d''une agression, permet de répondre par une contre attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/tour)', '(Réaction) Lors d''une agression, permet de répondre par une contre-attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/tour)') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Inflige fatigue 1 aux ennemis dans la zone si ils ratent leur jet de vigueur', 'Inflige fatigue 1 aux ennemis dans la zone s''ils ratent leur jet de vigueur') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Permet de détecter des sources de chaleur comme le feu ou bien un groupe d''être vivant.', 'Permet de détecter des sources de chaleur comme le feu ou bien un groupe d''êtres vivants.') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Tout les ennemis visible', 'Tous les ennemis visibles') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Permet de touché tout les ennemi avec une braise faible, Coup critique = inflige Brulure 1.', 'Permet de toucher tous les ennemis avec une braise faible, Coup critique = inflige brûlure 1.') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Inflige 2d6 de contre coup (-1d6 au Niveau 3 de Maîtrise).', 'Inflige 2d6 de contrecoup (-1d6 au Niveau 3 de Maîtrise).') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Faire surgir des flammes du sol pour attaquer les ennemis sur la ligne d''attaque. Ne peut être faire que sur un sol.', 'Faire surgir des flammes du sol pour attaquer les ennemis sur la ligne d''attaque. Ne peut être fait que sur un sol.') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Ceux qui ne possède pas de résistance au Feu doivent faire un jet d''Athlétisme ou Équilibre pour tenté de traverser. Dure 4 tours.', 'Ceux qui ne possèdent pas de résistance au Feu doivent faire un jet d''Athlétisme ou Équilibre pour tenter de traverser. Dure 4 tours.') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Augmente la température ambiante pendant 4 tours. Inflige 20 dégâts fixe a tout ceux qui souffre d''une brulure (1 fois).', 'Augmente la température ambiante pendant 4 tours. Inflige 20 dégâts fixes à tous ceux qui souffrent d''une brûlure (1 fois).') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Permet de marcher sur du feu ou de la lave.. Les jambes possède 6AP/6AM mais impossible de porter une armure a cet endroit temporairement', 'Permet de marcher sur du feu ou de la lave. Les jambes possèdent 6AP/6AM mais impossible de porter une armure à cet endroit temporairement') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Invoque une protection qui va infliger des dégâts a toute attaque au corps à corps. Dure 1 tour', 'Invoque une protection qui va infliger des dégâts à toute attaque au corps à corps. Dure 1 tour') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Un vrai lance-flamme craché par la gueule. , 10% de chance d''infliger Brulure 1.', 'Un vrai lance-flamme craché par la gueule. , 10% de chance d''infliger brûlure 1.') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Permet d''infliger brûlure 3 aux immunisé et de brûler ce qui ne peux l''être.', 'Permet d''infliger brûlure 3 aux immunisés et de brûler ce qui ne peut l''être.') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Inflige de terrible dégâts de feu. Si jet de vigueur raté = Inflige brûlure 1', 'Inflige de terribles dégâts de feu. Si jet de vigueur raté = Inflige brûlure 1') WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = replace(corps_md, 'Inflige de terrible dégâts de feu en zone. Si jet de vigueur raté = Inflige brûlure 2.', 'Inflige de terribles dégâts de feu en zone. Si jet de vigueur raté = Inflige brûlure 2.') WHERE id = 'magies/magie-du-feu';
-- page magies/magie-de-leau : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les spécialistes de l''eau ont les mèches bleutées, très long et mouillés en permanence, ont un corps plus estétique que la moyenne, ce dernier transpirent de l''eau tout le temps, les yeux sont bleus azur lors de l''utilisation d''un sort.', 'Les spécialistes de l''eau ont les mèches bleutées, très longues et mouillées en permanence, ont un corps plus esthétique que la moyenne, ce dernier transpire de l''eau tout le temps, les yeux sont bleu azur lors de l''utilisation d''un sort.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'L''utilisateur du mode hyper est considérer comme une source d''eau QUE pour lui.', 'L''utilisateur du mode hyper est considéré comme une source d''eau QUE pour lui.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'La première attaque subis réduit ses dégâts finaux de 20%.', 'La première attaque subie réduit ses dégâts finaux de 20%.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'L''utilisateur du mode hyper est considérer comme une source d''eau pour lui et ses alliés.', 'L''utilisateur du mode hyper est considéré comme une source d''eau pour lui et ses alliés.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Ignore des dégâts magique. L''effet augmente de +4 si utilisé à 4 cases de l''eau.', 'Ignore des dégâts magiques. L''effet augmente de +4 si utilisé à 4 cases de l''eau.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, ',+8 dégâts', '+8 dégâts') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Une urne rempli d''eau se déverse sur la zone. Bonus de +15 dégâts si un point d''eau est à 2 cases.', 'Une urne remplie d''eau se déverse sur la zone. Bonus de +15 dégâts si un point d''eau est à 2 cases.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Une lame fait d''eau sous pression tranche les adversaires. Ignore les AM quand un point d''eau est à 4 cases.', 'Une lame faite d''eau sous pression tranche les adversaires. Ignore les AM quand un point d''eau est à 4 cases.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Place un un courant d''eau qui va déplacer les cilbes dessus de 1(+1/NM) cases dans la direction décidé par le lanceur.', 'Place un un courant d''eau qui va déplacer les cibles dessus de 1(+1/NM) cases dans la direction décidée par le lanceur.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Soigne toutes les altération d''état lié à des éléments.', 'Soigne toutes les altérations d''état liées à des éléments.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Si il est fait dans l''eau : totalement insensible aux dégâts physiques et magiques qui ne sont pas une vulnérabilité. Réduit de 10 les dégâts encaissés quand il est fait en dehors de l’eau. dure 3 tours.', 'S''il est fait dans l''eau : totalement insensible aux dégâts physiques et magiques qui ne sont pas une vulnérabilité. Réduit de 10 les dégâts encaissés quand il est fait en dehors de l’eau. Dure 3 tours.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'totalement insensible aux dégâts physiques et magiques qui ne sont pas une vulnérabilité. Permet de bénéficié d''une invisibilité quand vous êtes dans l''eau.', 'Totalement insensible aux dégâts physiques et magiques qui ne sont pas une vulnérabilité. Permet de bénéficier d''une invisibilité quand vous êtes dans l''eau.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Invoque la météo "pluie" ou "pluie dilluvienne" pour 3 tours (+1/NM).', 'Invoque la météo "pluie" ou "pluie diluvienne" pour 3 tours (+1/NM).') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Régénération pendant 3 tours. +1 tour si utilisé à 4 cases de l''eau. Vu que c''est une régénération, la santé récupéré par tour se détermine au premier jet.', 'Régénération pendant 3 tours. +1 tour si utilisé à 4 cases de l''eau. Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Une attaque d''Eau en ligne qui touche tout sur son chemin. Si jet de stabilité/reflèxe raté = Tombe au sol', 'Une attaque d''Eau en ligne qui touche tout sur son chemin. Si jet de stabilité/réflexe raté = Tombe au sol') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, '(S''ajoute avec la météo pluie ou +) Empêche  les Sort Feu et Foudre d''être utilisé le temps de la météo.', '(S''ajoute avec la météo pluie ou +) Empêche les Sorts Feu et Foudre d''être utilisés le temps de la météo.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Cette météo ne peux pas être retirer par les autres météos ou bien les effets de classes.', 'Cette météo ne peut pas être retirée par les autres météos ou bien les effets de classes.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Le Don "Climatospetique" ne peux pas contrer cet effet.', 'Le Don "Climatospetique" ne peut pas contrer cet effet.') WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = replace(corps_md, 'Permet de ranimé un allié dans le coma en lui redonnant 1PV et 100% de sa barrière. Donne 10PV près d''un point d''eau.', 'Permet de ranimer un allié dans le coma en lui redonnant 1PV et 100% de sa barrière. Donne 10PV près d''un point d''eau.') WHERE id = 'magies/magie-de-leau';
-- page magies/magie-de-la-glace : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs de la glace ont les mèches bleu cyan, des cheveux assez courts en général, les yeux bleu cyan lors de l''utilisation d''un sort. Certaines parties du corps présentent des plaques de glace, elles sont généralement sur les membres où les zones vitales.', 'Les utilisateurs de la glace ont les mèches bleu cyan, des cheveux assez courts en général, les yeux bleu cyan lors de l''utilisation d''un sort. Certaines parties du corps présentent des plaques de glace, elles sont généralement sur les membres ou les zones vitales.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Refroidit l’arme au point de la rendre gelée, tape dans l''élément glace pendant 3 tour.', 'Refroidit l’arme au point de la rendre gelée, tape dans l''élément glace pendant 3 tours.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Jet de fermeté réussi = -10% a tout test d''I / Dure 3 tours pour les deux résultats.', 'Jet de fermeté réussi = -10% à tout test d''I / Dure 3 tours pour les deux résultats.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Bloque les mains de l''adversaire, au prochain tour, propage le lien de gel aux autres à 2 cases autours.', 'Bloque les mains de l''adversaire, au prochain tour, propage le lien de gel aux autres à 2 cases autour.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Le lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d''adversaires disponible. La cible est ainsi libérer mais peut se reprendre le lien de gel si jamais il est à côté d''un autre qui a le lien de gel et ainsi de suite...', 'Le lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d''adversaires disponibles. La cible est ainsi libérée mais peut se reprendre le lien de gel si jamais il est à côté d''un autre qui a le lien de gel et ainsi de suite...') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Augmente l''armure magique pendant 3 tours. Peut se cumuler avec Peau Verglacé.', 'Augmente l''armure magique pendant 3 tours. Peut se cumuler avec Peau Verglacée.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Inflige de dégâts de glace en zone.', 'Inflige des dégâts de glace en zone.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Envoi un gros pic de glace, +4 (+2/NM) dégâts quand il neige.', 'Envoie un gros pic de glace, +4 (+2/NM) dégâts quand il neige.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'l''allié sera aussi dispensé de jet de survie pendant cet état.', 'L''allié sera aussi dispensé de jet de survie pendant cet état.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, '-50% dégâts magique', '-50% dégâts magiques') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Et puisse la pureté du froid brise tout sur son passage…', 'Et puisse la pureté du froid briser tout sur son passage…') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Et puisse la grande Celsius l’emporte sans un cri…', 'Et puisse la grande Celsius l’emporter sans un cri…') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'La victime ne peux rien faire dans cet état, il faut a tout prix que le lanceur rate un jet de concentration ou bien qu''il soit interrompu.', 'La victime ne peut rien faire dans cet état, il faut à tout prix que le lanceur rate un jet de concentration ou bien qu''il soit interrompu.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Dans le cas d''un boss qui se fait enfermer, il peut lutter contre avec des jets d''athlétisme, concentration, vigueur, ect... le mj à le choix. Le lanceur devra faire un meilleur jet que la cible pour ne pas qu''il sorte du cerceuil.', 'Dans le cas d''un boss qui se fait enfermer, il peut lutter contre avec des jets d''athlétisme, concentration, vigueur, etc... le mj a le choix. Le lanceur devra faire un meilleur jet que la cible pour ne pas qu''il sorte du cercueil.') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Puisse Sa volonté condense l’hiver dans un seul éclat,', 'Puisse Sa volonté condenser l’hiver dans un seul éclat,') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, 'Puisse le souffle polaire emprisonne tout battement de vie,', 'Puisse le souffle polaire emprisonner tout battement de vie,') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = replace(corps_md, '+2 cran de résistance', '+2 crans de résistance') WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = 'La magie de la terre est une magie spécialisée dans la défense et le soutien. Héritée du Dieu de la Terre, une divinité patiente et loyale, elle puise sa force dans la roche, le métal, la flore et le sol lui-même.

Les utilisateurs de la terre peuvent provoquer des secousses, façonner la pierre et le métal, invoquer de puissants golems ou renforcer leur corps grâce à une armure minérale. Cette magie est également capable de soutenir ses alliés grâce aux propriétés curatives de certains sorts de la terre.

Associée à la détermination, une émotion liée à la ténacité et à l''obstination, la magie de la terre est souvent privilégiée par ceux qui avancent sans jamais céder, quelles que soient les difficultés qui se dressent devant eux.

## Description physique

Les utilisateurs de la Terre sont des personnes qui ont des tailles et une musculature plus haute que la moyenne (comme pour le sang), leurs corps possèdent de légers renforts de pierre un peu partout, les mèches sont brunes et les yeux d''un marron brillant lors de l''utilisation d''un sort.

## Données

- **Santé offert** : 0.0
- **Chakra offert** : 5.0
- **Caractéritiques bonus** : FORCE
- **Résistance magique** : Terre, Vent, Foudre
- **Résistance altération d''état** : Pétrification, Surdité, Paralysie
- **Vulnérabilité magique** : Feu, Sang
- **Vulnérabilité altération d''état** : Brûlure, Saignement

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | L''armure physique (AP) de base augmente de 25. |
| Bi-magie | L''armure physique (AP) de base augmente de 10. |

## Rôles

- RENFORCEMENT
- DÉGÂTS
- SOIN

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Lance Pierre | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Terre. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre pétrifié 1. |
| 1.0 | Tremblement | Attaque (Imparable) | 4.0 | 2 (+1/NM) | Cône | 1d6 dégâts (+2/NM) | Frappe le sol, oblige un jet de Stabilité/Réflexe aux cibles pour ne pas tomber. |
| 1.0 | Peau de pierre | Amplification (IC) | 4.0 | 1.0 | 1.0 | +2AP (+1AP/NM) | Augmente l''armure physique pendant 3 tours. Peut se cumuler avec Cuirasse de Roche. |
| 1.0 | Appel aux Golems | Invocation (IC pour 3 NM) | 6 (xNP de créature) | 3.0 | 1.0 | / | Permet d''invoquer des golems (voir invocation). Sort interdit aux familiers et aux invocations. |
| 1.0 | Racine soignante | Soin | 3.0 | 4.0 | 1.0 | 2d6 soin (+1d6/NM) | Soigne la cible mais doit être dans environnement lié à la terre pour fonctionner |
| 2.0 | Explosion rocheuse | Attaque | 7.0 | 3 (+1/NM) | Carré de 3 | 5d6 dégâts (+3/NM) | Une attaque de Terre de Zone. |
| 2.0 | Fer Raffiné | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Renforce l''arme avec un métal raffiné, tape dans l''élément terre pendant 3 tours. |
| 2.0 | Arbre fertilisant | Invocation | 8.0 | 3.0 | Cercle de 3 | Soigne 2d6 (+2/NM) | Pose un arbre, soigne les alliés à 3 cases autour de lui. Possède 20 PV. Un seul à la fois. |
| 2.0 | Infection | Soin/Entrave (IC pour 3 NM) | 8.0 | 6.0 | 1.0 | 4 dégâts (+1/NM) / tour | Lance une graine qui va aspirer la santé de la cible et la donner au lanceur pendant 3 tours. Les dégâts de l''infection ne sont pas élémentaires. |
| 2.0 | Cuirasse de roche | Amplification (IC) | 7.0 | 1.0 | 1.0 | +4AP (+2AP/NM) | Augmente l''armure physique pendant 3 tours. Peut se cumuler avec Peau de Pierre. |
| 3.0 | Barrière rocheuse | Protection | 16.0 | 1.0 | 1.0 | Donne une protection | Confère une protection par-dessus la barrière qui encaisse les coups inférieurs à 20 dégâts (+7/NM) |
| 3.0 | Alourdissement | Amplification/ Entrave (IC pour 3 NM) | 15.0 | 5.0 | 1.0 | -20% Réussite / +1D dégâts | Rend l''arme plus lourde et augmente ses dégâts pendant 3 tours. |
| 3.0 | Sable changeant | Construction | 10/3x3 | 2 (+2/NM) | Variable | / | Permet de créer un terrain sur lequel il est difficile de bouger. |
| 3.0 | Frappe racine | Attaque | 14.0 | 6 (+1/NM) | 1.0 | 7d6 + 25 dégâts | Si jet de vigueur raté = -1 vitesse pour la cible pour 1 tour. |
| 3.0 | Enracinement | Soin/Entrave | 13.0 | Soi-même | Cercle de 2 (+1/NM) | 4d6 de soin/tour | Les ennemis dans la zone prennent 5 dégâts et perdent 2INI et 1 Vitesse tant qu''ils sont dans la zone. Le sort reste tant que le lanceur ne bouge pas. |
| 4.0 | Rouille | Attaque | 20.0 | 4 (+1/NM) | 1.0 | 8d6 dégâts d''acide | 50% de chance de retirer un cran solidité à un morceau d’armure ou une arme. |
| 4.0 | Grenade Pétrifiante | Attaque | 23.0 | 7.0 | Cercle de 3 | 6d6 + 35 dégâts | Inflige des dégâts de zone de Terre. (3NM = Si jet de vigueur raté = Inflige pétrifié 1). |
| 4.0 | Anti-Mythril | Amplification (IC pour 3 NM) | 23.0 | 2.0 | 1.0 | / | L''effet du Mythril est annulé pendant 3 tours. |
| 4.0 | Rédemption de Dimitri | Météo | 20.0 | Soi-même | Terrain | / | Invoque la météo "tempête sable" ou "champ magnétique" pendant 3 tours (+1/NM). |
| 4.0 | Floraison salvatrice | Soin | 20.0 | 4.0 | 1.0 | 4d6 (+1d/NM) soin/tour | Pose une fleur sur la cible qui va la soigner pendant 3 tours. Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet. |
| 5.0 | Terre Maudite | Attaque | 55 (-5/NM) | 7.0 | 1.0 | 10d6 + 60 dégâts | La cible qui rate son jet de vigueur encaisse une charge de Nécrose, au bout de 4 charges, la cible meurt. |
| 5.0 | Morsure terrestre | Attaque (Inesquivable) | 55 (-5/NM) | 6.0 | 4x4 | 10d6 + 60 dégâts | Inflige de terribles dégâts perforants. |
| 5.0 | Corps de Maverium | Amplification | 70 (-5/NM) | Soi-même | 1.0 | Invincible | Confère l''état « Corps de Maverium » pour 3 tours. |

## Notes et commentaires des sorts

**Commentaire résolu de la cellule « Effets secondaires » du sort « Peau de pierre »** : Peut se cumuler avec Armure de Roche.

**Commentaire résolu de la cellule « Effets secondaires » du sort « Appel aux Golems »**

Pour voir les golems possibles 


Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

**Note de la cellule « Effets secondaires » du sort « Racine soignante »** : L''environnement doit être majoritairement de Montagne, Forêt, Plaine, Caverne.

**Note de la cellule « Effets secondaires » du sort « Fer Raffiné »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être pétrifié au stade 1

**Commentaire résolu de la cellule « Effets secondaires » du sort « Arbre fertilisant »** : La cible doit être vivante.

**Commentaire résolu de la cellule « Effets secondaires » du sort « Infection »** : Les dégâts de l''infection ne sont pas élémentaires

**Commentaire résolu de la cellule « Effets secondaires » du sort « Cuirasse de roche »** : Peut se cumuler avec Peau de Pierre.

**Note de la cellule « Effets secondaires » du sort « Barrière rocheuse »**

Si jamais un coup physique ou magique est encaissé par la protection, elle doit faire plus que la tolérance de cette dernière pour la briser.

Si elle fait moins, le coup est annulé et la protection se recharge pour le prochain coup

Si elle fait plus, la protection est brisée et l''intégralité du coup est encaissée.

Les AP ne sont pas comptées quand les dégâts sont faits à la protection.

**Commentaire résolu de la cellule « Effets secondaires » du sort « Barrière rocheuse »**

Corps de pierre : Double les PA, diminue la vitesse de 1 et les adversaires ont +15% de chance avec un jet de défense.  
Compatible avec Armure de roche et peau de pierre mais ils doivent avoir été lancés avant.

**Commentaire résolu de la cellule « Effets secondaires » du sort « Alourdissement »** : Équivalent à pétrifié 3 mais la victime ne peut pas prendre de dégâts sous le magma.

**Note de la cellule « Effets secondaires » du sort « Sable changeant »** : Le Terrain sable divise par 2 le déplacement, empêche le sprint et fait perdre un tour si jamais on saute.

**Note de la cellule « Effets secondaires » du sort « Frappe racine »** : Demande un sol, un mur, un plafond ou toute autre surface où la racine peut sortir, sous l''eau ça marche mais pas dans le ciel.

**Note de la cellule « Effets secondaires » du sort « Terre Maudite »** : La Nécrose ne disparaît que quand le lanceur est hors combat ou mort.

**Note de la cellule « Effets secondaires » du sort « Corps de Maverium »** : Corps de Maverium : Tous les dégâts reçus sont réduits à 0 et les effets négatifs sur les protections ne fonctionnent pas.

**Commentaire résolu de la cellule « Effets secondaires » du sort « Corps de Maverium »** : Corps de Maverium permet d''ignorer tous les dégâts possibles quelle que soit leur puissance. Comme corps de pierre, tous les organes internes sont solidifiés et ne fonctionnent pas temporairement (comme un golem, pas besoin)

**Commentaire résolu de la cellule « Effets secondaires » du sort « Corps de Maverium »** : Corps de Maverium : Invincible temporairement, diminue la vitesse de 1 et les adversaires ont +15% de chance avec un jet de défense.

## Textes des sorts de niveau 5

### Terre Maudite

> De la pierre naît la destruction,  
> De la terre jaillit la condamnation,  
> Que ce pieu porte en lui la marque d''un fléau,  
> Que la chair qu’il transperce pourrisse et se soumette,  
> Qu’à chaque coup, la mort se rapproche…  
> Et que Dimitri lui-même scelle votre destin !
>
> TERRE MAUDITE !

### Morsure terrestre

> Ô Dimitri, maître des montagnes et des abîmes,  
> Que ta volonté s’élève du sol et réclame son dû,  
> Que la pierre se dresse, impitoyable et implacable,  
> Qu’aucune chair, aucune armure ne résiste à ton courroux,  
> Que la terre s’ouvre, qu’elle enserre, qu’elle transperce,  
> Nul ne fuira l’étreinte de la roche...
>
> MORSURE TERRESTRE !

### Corps de Maverium

> Que ma chair devienne métal, que mon sang devienne acier,  
> Que le poids des montagnes coule dans mes veines,  
> Que nul coup, nulle magie ne puisse m’ébranler,  
> Que mon corps soit l’épreuve que nul ne brisera,  
> Par la volonté de Dimitri, je deviens son mur...
>
> CORPS DE MAVERIUM !

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-la-terre';
-- page magies/magie-du-vent : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les spécialistes du Vent ont les cheveux mi-long, mèches vert clair, les yeux vert clair lors de l''utilisation d''un sort, corps mince, leurs corps produisent un vent très léger, notamment au niveau des bras et jambes. Cette brise légère visibleà l''oeil nue est de couleur verte.', 'Les spécialistes du Vent ont les cheveux mi-longs, mèches vert clair, les yeux vert clair lors de l''utilisation d''un sort, corps mince, leurs corps produisent un vent très léger, notamment au niveau des bras et jambes. Cette brise légère visible à l''œil nu est de couleur verte.') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Envoi un court message de 8 mots (+2/NM) maximum.', 'Envoie un court message de 8 mots (+2/NM) maximum.') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, '5d6 (+3/NM) dégâts sonore', '5d6 (+3/NM) dégâts sonores') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Si jet de vigueur raté = Inflge surdité 1.', 'Si jet de vigueur raté = Inflige surdité 1.') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Éternu fort sur l''adversaire, permet de le faire reculé d''une case (+1/NM) en arrière.', 'Éternue fort sur l''adversaire, permet de le faire reculer d''une case (+1/NM) en arrière.') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Fait reculé la cible de 1 case (+1/NM)', 'Fait reculer la cible de 1 case (+1/NM)') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Réussir a sortir vous fait prendre quand même 5d6 dégâts. Ne pas réussir a sortir vous fait voler et tomber par terre.', 'Réussir à sortir vous fait prendre quand même 5d6 dégâts. Ne pas réussir à sortir vous fait voler et tomber par terre.') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Inflige des dégâts de zone de Vent. Inflige 2d6 dégâts (+1d6/NM) supplémentaire en intérieur.', 'Inflige des dégâts de zone de Vent. Inflige 2d6 dégâts (+1d6/NM) supplémentaires en intérieur.') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, '5d6 + 25 dégâts sonore', '5d6 + 25 dégâts sonores') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Incanche une vibration insupportable, Si jet de vigueur raté = Inflge surdité 2, Si jet de stabilité/Réflexe raté = Tombe par terre.', 'Incanche une vibration insupportable, Si jet de vigueur raté = Inflige surdité 2, Si jet de stabilité/réflexe raté = Tombe par terre.') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, '10d6 + 40 dégâts sonore', '10d6 + 40 dégâts sonores') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Fait un grand saut, inflige 1 dégâts frappe pour 20kg.', 'Fait un grand saut, inflige 1 dégât frappe pour 20kg.') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Attaque (inesquivable/ imparable)', 'Attaque (Inesquivable/ Imparable)') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Attaque/ Entrave (imparable)', 'Attaque/ Entrave (Imparable)') WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = replace(corps_md, 'Permet au lanceur de voler pour le combat entier. Les jambes deviennent vaporeuse donc insensible aux attaques', 'Permet au lanceur de voler pour le combat entier. Les jambes deviennent vaporeuses donc insensibles aux attaques') WHERE id = 'magies/magie-du-vent';
-- page magies/magie-de-la-foudre : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs de la foudre ont les mèches jaunes, les yeux jaunes lors de l''utilisation d''un sort, de l’électricité parcours en permanence leur corps. Des plaques de fer très conducteurs se trouvent sur certaines parties du corps (Bras, jambes, organes vitaux).', 'Les utilisateurs de la foudre ont les mèches jaunes, les yeux jaunes lors de l''utilisation d''un sort, de l’électricité parcourt en permanence leur corps. Des plaques de fer très conductrices se trouvent sur certaines parties du corps (bras, jambes, organes vitaux).') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'Un sort qui se propage aux adversaires au contact de la cible et inflige +2 dégâts par cible touché.', 'Un sort qui se propage aux adversaires au contact de la cible et inflige +2 dégâts par cible touchée.') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'Peut etre lancer 3 fois dans le meme tour.', 'Peut être lancé 3 fois dans le même tour.') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, '1 boule (+1/NM) vont apparaître et vont s''approcher de l''ennemi le plus proches de 2 cases par tour.', '1 boule (+1/NM) vont apparaître et vont s''approcher de l''ennemi le plus proche de 2 cases par tour.') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'Invoque 3 plaque miroir qui vont absorbé 3 sorts qui le vise (sort de niveau 3 maximum)', 'Invoque 3 plaques miroir qui vont absorber 3 sorts qui le visent (sort de niveau 3 maximum)') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'Une créature dites mécanique agit de manière incohérente pendant 1 tour (+1 tour/NM).', 'Une créature dite mécanique agit de manière incohérente pendant 1 tour (+1 tour/NM).') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'C''est un équivalent de "Confusion 3" pour les créature mécaniques.', 'C''est un équivalent de "Confusion 3" pour les créatures mécaniques.') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'C''est un équivalent de "Confus" pour les créature mécaniques.', 'C''est un équivalent de "Confus" pour les créatures mécaniques.') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'Inflige de gros dégâts et passe à la cible la plus proche suivante, ses dégâts se divise par 2 à chaque nouvelle cible (5 maxi)', 'Inflige de gros dégâts et passe à la cible la plus proche suivante, ses dégâts se divisent par 2 à chaque nouvelle cible (5 maxi)') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'Frappe au sol pour invoquer un cercle qui va électrisé les ennemis.', 'Frappe au sol pour invoquer un cercle qui va électriser les ennemis.') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'La cible devient immunisé à la Foudre et tape dans l''élément foudre avec un bonus de +20 aux attaques.  Dure 3 tours', 'La cible devient immunisée à la Foudre et tape dans l''élément foudre avec un bonus de +20 aux attaques. Dure 3 tours') WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = replace(corps_md, 'Une attaque surpuissante de foudre qui tape en zone. 15% des dégâts se répercute dans le chakra.', 'Une attaque surpuissante de foudre qui tape en zone. 15% des dégâts se répercutent dans le chakra.') WHERE id = 'magies/magie-de-la-foudre';
-- page magies/magie-de-la-lumiere : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs de la Lumière ont des cheveux avec les mèches beige, les yeux beige lors d''une utilisation de sort. Certains possèdent une petite aura de lumière qui émane des membres, d''autres ont les bracelet de lumière d''aurora et d''autres possèdent un paire d''aile de lumière (la déesse en possède 10)', 'Les utilisateurs de la Lumière ont des cheveux avec les mèches beiges, les yeux beiges lors d''une utilisation de sort. Certains possèdent une petite aura de lumière qui émane des membres, d''autres ont les bracelets de lumière d''Aurora et d''autres possèdent une paire d''ailes de lumière (la déesse en possède 10)') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Chaque tour, un soin ou une protction est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5).', 'Chaque tour, un soin ou une protection est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5).') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparait après l''attaque ennemi. Il va réduire les dégâts AVANT l''armure.', 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparaît après l''attaque ennemie. Il va réduire les dégâts AVANT l''armure.') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'La surcharge peut être amplifié avec 20 chakra maximum', 'La surcharge peut être amplifiée avec 20 chakra maximum') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Rend l''arme parfaitement lumineuse, tape dans l''élément lumière pendant 3 tour.', 'Rend l''arme parfaitement lumineuse, tape dans l''élément lumière pendant 3 tours.') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être aveugler au stade 1', 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être aveuglé au stade 1') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Ce sort repose sur une existence des yeux, les créatures aveugles ne sont pas affecté par ce sort.', 'Ce sort repose sur une existence des yeux, les créatures aveugles ne sont pas affectées par ce sort.') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Donne un boost parmi une liste défini (2 boost si 3 niveau de maîtrise)', 'Donne un boost parmi une liste définie (2 boosts si 3 niveaux de maîtrise)') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, '- Permet d''encaisser le prochain sorts d''ombre (sauf niveau 5)', '- Permet d''encaisser le prochain sort d''ombre (sauf niveau 5)') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Peut soigner temporairement les infirmités.(3 NM = Soigne une croix en carac)', 'Peut soigner temporairement les infirmités. (3 NM = Soigne une croix en carac)') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, '+8 dégâts, +2AM, +5% a tout les jets', '+8 dégâts, +2AM, +5% à tous les jets') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Motive les alliés et donne des amplificateurs pendant 1 tour. Les sorts Défaite annoncée et Explosion glorifique s''annule mutuellement.', 'Motive les alliés et donne des amplificateurs pendant 1 tour. Les sorts Défaite annoncée et Explosion glorifique s''annulent mutuellement.') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Dure 3 tours (+1/NM). Vu que c''est une régénération, la santé récupéré par tour se détermine au premier jet.', 'Dure 3 tours (+1/NM). Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet.') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Inflige des dégâts de zone de Lumière. (3 NM = oblige un jet de vigueur pour ne pas être aveugler au stade 1)', 'Inflige des dégâts de zone de Lumière. (3 NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1)') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Inflige de terrible dégâts de lumière. Si jet de vigueur raté = Inflige aveuglement 1', 'Inflige de terribles dégâts de lumière. Si jet de vigueur raté = Inflige aveuglement 1') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Permet de ranimé un allié dans le coma en lui redonnant 100% de ses points de vie. Le sort peut être utilisé sur un allié qui n''est pas dans le coma.', 'Permet de ranimer un allié dans le coma en lui redonnant 100% de ses points de vie. Le sort peut être utilisé sur un allié qui n''est pas dans le coma.') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Le sort peut être utiliser sur un allié qui n''est pas dans le coma.', 'Le sort peut être utilisé sur un allié qui n''est pas dans le coma.') WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = replace(corps_md, 'Permet de soigner totalement les altérations d''états.', 'Permet de soigner totalement les altérations d''état.') WHERE id = 'magies/magie-de-la-lumiere';
-- page magies/magie-de-lombre : mêmes corrections dans le texte Markdown
UPDATE page SET corps_md = replace(corps_md, 'Les utilisateurs de l''ombre ont des cheveux généralement plus courts et des mèches mauves, les yeux violets lors d''une utilisation de sort. Certains possèdent des bracelet faites d''ombre violettes, d''autres possèdent des cornes de Chakra couleur mauve (plus clair pour les femelles et plus sombre pour les mâles) si la race possède des corne physiques : c''est une aura ténébreuse violette qui les entoures ou alors une aura sombre émane de leur main et pied.', 'Les utilisateurs de l''ombre ont des cheveux généralement plus courts et des mèches mauves, les yeux violets lors d''une utilisation de sort. Certains possèdent des bracelets faits d''ombre violettes, d''autres possèdent des cornes de Chakra couleur mauve (plus clair pour les femelles et plus sombre pour les mâles) si la race possède des cornes physiques : c''est une aura ténébreuse violette qui les entoure ou alors une aura sombre émane de leur main et pied.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'DÉGATS', 'DÉGÂTS') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Si jet de Fermeté raté = Met une croix dans 1 une caractéristique au choix de l’adversaire pendant 1 tour.', 'Si jet de fermeté raté = Met une croix dans 1 une caractéristique au choix de l’adversaire pendant 1 tour.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, '5d6 dégâts sonore (+3/NM)', '5d6 dégâts sonores (+3/NM)') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Une attaque au dégâts sonore qui inflige un malus de 10% au prochain test de la victime.', 'Une attaque aux dégâts sonores qui inflige un malus de 10% au prochain test de la victime.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Soi même', 'Soi-même') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Créer 1 (+1/NM) lame(s) autour du lanceur, chaque lame va taper après une attaque du lanceur réussi.', 'Créer 1 (+1/NM) lame(s) autour du lanceur, chaque lame va taper après une attaque du lanceur réussie.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'La lame fait partie de l''attaque qu''elle accompagne, l''adversaire n''a pas a faire une autre défense pour juste la lame. Les lames partent une par une', 'La lame fait partie de l''attaque qu''elle accompagne, l''adversaire n''a pas à faire une autre défense pour juste la lame. Les lames partent une par une') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'EC = Echec critique', 'EC = Échec critique') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Le jet de fermeté se relance tout les début de tour.', 'Le jet de fermeté se relance tous les débuts de tour.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, '5d6 dégâts  (+4/NM)', '5d6 dégâts (+4/NM)') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Fermeté réussi = État «Couardise»', 'Fermeté réussi = État « Couardise »') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Fermeté raté = État « Peur 2 »', 'Fermeté raté = État « Peur 2 »') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Si jet de vigueur raté = Malus de 25% pour tout les jets pour 1 tour (-10%/NM)', 'Si jet de vigueur raté = Malus de 25% pour tous les jets pour 1 tour (-10%/NM)') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Les sorts Défaite annoncée et Explosion glorifique s''annule mutuellement.', 'Les sorts Défaite annoncée et Explosion glorifique s''annulent mutuellement.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Donne vie à l''ombre de la cible pour 6 tours et va attaquer que elle. Peut être décimer par une attaque de Lumière.', 'Donne vie à l''ombre de la cible pour 6 tours et va attaquer qu''elle. Peut être décimée par une attaque de Lumière.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de sa santé  totale.', 'Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de sa santé totale.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'La victime ne peut rien faire si ce n''est tenter un jet d''athlétisme/concentration/magie/équilibre pour sortir du sort, sauf que ses chances sont amoindri au début :', 'La victime ne peut rien faire si ce n''est tenter un jet d''athlétisme/concentration/magie/équilibre pour sortir du sort, sauf que ses chances sont amoindries au début :') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, '1e tentative : Réussite divisée par 2', '1re tentative : Réussite divisée par 2') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, '4e tentative : Score normale', '4e tentative : Score normal') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'un échec met fin au tour, une réussite libère la victime qui peut jouer normalement.', 'Un échec met fin au tour, une réussite libère la victime qui peut jouer normalement.') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Donne un effet négatif selon la santé restante parmi les suivants (les effets sont cumulatif) :', 'Donne un effet négatif selon la santé restante parmi les suivants (les effets sont cumulatifs) :') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, '7d6 +15 dégâts', '7d6 + 15 dégâts') WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = replace(corps_md, 'Ombre Menacante', 'Ombre Menaçante') WHERE id = 'magies/magie-de-lombre';
