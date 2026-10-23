"""Magies dont le nom est aussi celui d'un mot-clé du glossaire d'un autre sens : l'étiquette de la magie qu'un import écrit (page de la magie,
temples du Codex, créatures invoquées) n'est pas posée (« Corruption » : la jauge du personnage, pas la magie ; un homonyme n'est jamais lié
implicitement ; demande du propriétaire du 2026-10-18 : « Seulement là où il est pertinent »). Sans dépendance : lu par tools/docs/codex.py,
tools/sheets/magies.py et tools/sheets/invocations.py (chargé par son chemin : `python3 -I`)."""

MAGIES_HOMONYMES = frozenset({'corruption'})
