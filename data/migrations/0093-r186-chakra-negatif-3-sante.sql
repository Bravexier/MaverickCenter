-- 0093-r186-chakra-negatif-3-sante : décision R186 du propriétaire (docs/decisions-regles.md, 2026-11-06), « Tout point de chakra dépensé (de
-- force) sous 0 ne coûte plus 2 santé mais 3! » : seule la valeur de R18 change (2 → 3 points de santé par point de chakra manquant).
-- Migration de DONNÉES seules ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   * Textes non cités d'une source qui écrivent ce tarif : quatre pages du guide (le chiffre, et les deux exemples qui en découlent : 4 manquants
--     → 12, 20 manquants → 60) et la définition du mot-clé `chakra`. Le reste de chaque phrase est gardé à l'identique.
--   * Précision du propriétaire (R186) : « Si c'est pas précisé ce prix de santé ignore la barrière », élargie à « Oui, tous les coûts » (« Tout
--     coût payé en santé ignore la barrière, sauf texte contraire ») : phrase (après celle du tarif) et exemple du propriétaire
--     (après l'exemple de base) ajoutés à guide/la-magie-en-jeu ; une phrase ajoutée à guide/les-degats (« Et la barrière ? »), après « Elle prend les coups avant la santé… ».
--     Ni la page transcrite du Codex ni le mot-clé `barriere` ne changent.
--   * Inchangés : les textes cités tels quels d'une source (mode_texte et guide/liste-des-effets-mode-hyper, « le manque sera pris dans les PV » ;
--     la page transcrite « Fiche de personnage : Attributs »), les notes de version publiées (section 15), historique_modification, le paiement
--     en corruption d'un sort de la Corruption (2 × le coût, R102) et l'échec critique (« consomme le double du coût »).
-- Chaque UPDATE est gardé par le texte d'avant (instr) : rejouée sur une base où le site de dev a réécrit la phrase, la migration ne change rien.

-- 1. Étape 6 : finaliser son personnage
UPDATE page SET corps_md = replace(corps_md,
  'À court de {{chakra|chakra}}, on peut quand même en dépenser : chaque point qui manque coûte 2 points de santé.',
  'À court de {{chakra|chakra}}, on peut quand même en dépenser : chaque point qui manque coûte 3 points de santé.')
WHERE id = 'guide/finaliser-son-personnage'
  AND instr(corps_md, 'À court de {{chakra|chakra}}, on peut quand même en dépenser : chaque point qui manque coûte 2 points de santé.') > 0;

-- 2. La magie en jeu : le tarif, la barrière (précision de R186), l'exemple de base puis celui du propriétaire
UPDATE page SET corps_md = replace(replace(corps_md,
  'il paie ce qui manque avec sa santé, à raison de **2 points de santé pour 1 point de {{chakra|chakra}}**. C’est le tarif de tout {{chakra|chakra}} dépensé sans l’avoir, en Mode Hyper ou non.',
  'il paie ce qui manque avec sa santé, à raison de **3 points de santé pour 1 point de {{chakra|chakra}}**. C’est le tarif de tout {{chakra|chakra}} dépensé sans l’avoir, en Mode Hyper ou non. Sauf si un texte le précise, tout coût payé en santé ignore la {{barriere|barrière}} : elle ne l’absorbe pas. C’est vrai de ce prix comme du coût en santé d’un sort ou d’un don.'),
  '*Exemple : il reste 3 de {{chakra|chakra}} au personnage, et son sort en coûte 7. Il dépense ses 3 points, et les 4 qui manquent lui coûtent 8 points de santé.*',
  '*Exemple : il reste 3 de {{chakra|chakra}} au personnage, et son sort en coûte 7. Il dépense ses 3 points, et les 4 qui manquent lui coûtent 12 points de santé.*'
  || char(10) || char(10)
  || '*Exemple : un sort coûte 5 de {{chakra|chakra}} à un personnage qui a 10 de santé, 2 de {{chakra|chakra}} et 3 de {{barriere|barrière}}. Il dépense ses 2 points, et les 3 qui manquent lui coûtent 9 points de santé : il finit à 1 de santé, 0 de {{chakra|chakra}} et 3 de {{barriere|barrière}}.*')
WHERE id = 'guide/la-magie-en-jeu'
  AND instr(corps_md, 'à raison de **2 points de santé pour 1 point de {{chakra|chakra}}**. C’est le tarif de tout {{chakra|chakra}} dépensé sans l’avoir, en Mode Hyper ou non.') > 0
  AND instr(corps_md, 'et les 4 qui manquent lui coûtent 8 points de santé.*') > 0;

-- 3. Le Mode Hyper
UPDATE page SET corps_md = replace(corps_md,
  'À court de {{chakra|chakra}}, en Mode Hyper ou non, on peut toujours en dépenser : chaque point qui manque se paie de **2 points de santé**.',
  'À court de {{chakra|chakra}}, en Mode Hyper ou non, on peut toujours en dépenser : chaque point qui manque se paie de **3 points de santé**.')
WHERE id = 'guide/le-mode-hyper'
  AND instr(corps_md, 'chaque point qui manque se paie de **2 points de santé**.') > 0;

-- 4. Mode Hyper 100 % : la sortie et son exemple
UPDATE page SET corps_md = replace(replace(corps_md,
  'il paie ce qui manque avec sa santé, comme toujours : **2 points de santé pour 1 point de {{chakra|chakra}}**.',
  'il paie ce qui manque avec sa santé, comme toujours : **3 points de santé pour 1 point de {{chakra|chakra}}**.'),
  'S’il ne lui en reste que 40, les 20 qui manquent lui coûtent 40 points de santé.*',
  'S’il ne lui en reste que 40, les 20 qui manquent lui coûtent 60 points de santé.*')
WHERE id = 'guide/le-mode-hyper-100'
  AND instr(corps_md, 'comme toujours : **2 points de santé pour 1 point de {{chakra|chakra}}**.') > 0
  AND instr(corps_md, 'les 20 qui manquent lui coûtent 40 points de santé.*') > 0;

-- 5. Les dégâts : la barrière ne prend pas un coût payé en santé (R186 élargie)
UPDATE page SET corps_md = replace(corps_md,
  'qui peut alors devenir négative (voir [[guide/blessures-et-etats|Blessures et états]]). Deux dons du Médusain',
  'qui peut alors devenir négative (voir [[guide/blessures-et-etats|Blessures et états]]). Un coût payé en santé ({{chakra|chakra}} manquant, coût d’un sort ou d’un don) ne passe pas par elle, sauf si un texte le précise. Deux dons du Médusain')
WHERE id = 'guide/les-degats'
  AND instr(corps_md, 'Elle prend les coups avant la santé, sauf contre-indication : une fois qu’elle est vide, ce qui reste des dégâts baisse la santé, qui peut alors devenir négative (voir [[guide/blessures-et-etats|Blessures et états]]). Deux dons du Médusain') > 0;

-- 6. Le mot-clé « Chakra »
UPDATE mot_cle SET description = replace(description,
  'la santé est consommée à la hauteur de 2 points pour un de Chakra.',
  'la santé est consommée à la hauteur de 3 points pour un de Chakra.')
WHERE id = 'chakra'
  AND instr(description, 'la santé est consommée à la hauteur de 2 points pour un de Chakra.') > 0;
