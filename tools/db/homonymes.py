"""Étiquettes qu'un import n'écrit pas, bien qu'un mot-clé du glossaire porte leur écriture. Sans dépendance : chargé par son chemin (`python3 -I`).

MAGIES_HOMONYMES : magies dont le nom est aussi celui d'un mot-clé du glossaire d'un autre sens : l'étiquette de la magie qu'un import écrit (page de
la magie, temples du Codex, créatures invoquées) n'est pas posée (« Corruption » : la jauge du personnage, pas la magie ; un homonyme n'est jamais lié
implicitement ; demande du propriétaire du 2026-10-18 : « Seulement là où il est pertinent ») ; « Sang » (migration 0090 : la quatrième barre de la
magie du Sang, un renvoi du glossaire vers « Âme », pas la magie). Lu par tools/docs/codex.py, tools/sheets/magies.py et tools/sheets/invocations.py.

ETIQUETTES_NON_POSEES : étiquettes que les importeurs des classeurs écrivaient sur leurs pages sans qu'aucun mot-clé les reçoive, jusqu'à ce que la
migration 0090 (le Lexique converti en mots-clés) crée un mot-clé de la même écriture : décision R183 (11), réponse du propriétaire à Q-J « Les exclure
de l'import ». Elles ne sont plus écrites (le `tags:` de la page ne les porte pas), et la page garde les étiquettes qu'elle avait avant la 0090.
Écriture telle que l'importeur l'écrit (minuscules, accents), comme MAGIES_HOMONYMES ; mot-clé entre parenthèses :
  * tools/sheets/equipement.py : « bouclier » (bouclier, page ressources/bouclier), « pièce élémentaire » (piece-elementaire) et « amélioration »
    (amelioration), page ressources/pieces-elementaires ;
  * tools/sheets/divers-craft.py : « tour » (tour, page ressources/fiche-de-tour) ;
  * tools/sheets/annexes-magie.py : « mode hyper » (mode-hyper, page guide/liste-des-effets-mode-hyper, retirée de la base par la migration 0095 ;
    la page guide/mode-hyper-magie, qui la portait aussi, n'est plus produite : décision R184 (9)) et « mode super » (mode-super, page
    guide/liste-des-effets-mode-super).
Test : client/test/importeurs-etiquettes.test.mjs (rejoue les trois importeurs sur les instantanés de sources/raw/classeurs/)."""

MAGIES_HOMONYMES = frozenset({'corruption', 'sang'})

ETIQUETTES_NON_POSEES = frozenset({'bouclier', 'pièce élémentaire', 'amélioration', 'tour', 'mode hyper', 'mode super'})
